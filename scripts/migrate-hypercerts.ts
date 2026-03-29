/**
 * One-off migration: re-publish all existing ATProto activity records
 * with the updated schema (adds description, IPFS CIDs, fixes workScope
 * truncation, adds contributionWeight).
 *
 * The AT URI (rkey) for every record stays identical — only the content
 * and CID change. Existing attachment and evaluation records are untouched.
 *
 * How it works:
 *   1. Load the registry from Redis (primary) or REGISTRY_CID (fallback).
 *   2. For every entry that has both `hasAtproto: true` and a payload `cid`,
 *      fetch the full HypercertPayload from Storacha.
 *   3. Call updateHypercert() → putRecord on bsky.social.
 *   4. Print a summary with the new CID for each record.
 *
 * Prerequisites:
 *   - HYPERCERTS_HANDLE + HYPERCERTS_APP_PASSWORD (ATProto credentials)
 *   - UPSTASH_REDIS_REST_URL + TOKEN  (or REGISTRY_CID as fallback)
 *   - STORACHA_PRINCIPAL + STORACHA_PROOF  (to fetch payloads from IPFS)
 *
 * Run:
 *   pnpm migrate:hypercerts
 *   # or directly:
 *   cd scripts && ../node_modules/.bin/tsx migrate-hypercerts.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../web/.env.local"), override: false });

import type { HypercertPayload, HypercertRegistry } from "../packages/types/src/index.js";
import { retrieveJSON } from "../packages/storage/dist/index.js";
import { updateHypercert } from "../packages/agents/dist/hypercerts/publish.js";

const SERVER_URL = process.env["SERVER_URL"] ?? process.env["NEXT_PUBLIC_SERVER_URL"] ?? "http://localhost:3001";
console.log(`Server URL: ${SERVER_URL}`);

/**
 * Fetch the full HypercertPayload from the live server API.
 * The server's in-memory registry always has the correct final CID
 * (post-ATProto re-upload), even when Redis has a stale initial CID.
 */
async function fetchPayloadFromServer(slug: string): Promise<HypercertPayload | null> {
  const res = await fetch(`${SERVER_URL}/projects/${encodeURIComponent(slug)}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Server returned ${res.status} for slug "${slug}"`);
  return res.json() as Promise<HypercertPayload>;
}

// ── Registry loading ─────────────────────────────────────────────────────────

/** Read a key from Upstash Redis using the REST API (no SDK required). */
async function redisGet<T>(url: string, token: string, key: string): Promise<T | null> {
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Redis GET failed: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { result: string | null };
  if (!body.result) return null;
  return JSON.parse(body.result) as T;
}

async function loadRegistry(): Promise<HypercertRegistry> {
  // 1. Try Redis first (Upstash REST API — no SDK needed)
  const url   = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];

  if (url && token) {
    console.log("Loading registry from Redis…");
    try {
      const raw = await redisGet<HypercertRegistry>(url, token, "credence:registry");
      if (raw && raw.entries.length > 0) {
        console.log(`  ✓ ${raw.entries.length} entries loaded from Redis`);
        return raw;
      }
      console.log("  Redis key empty — falling back to REGISTRY_CID");
    } catch (err) {
      console.warn("  Redis read failed:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Fall back to static REGISTRY_CID
  const staticCid = process.env["REGISTRY_CID"];
  if (staticCid) {
    console.log(`Loading registry from Storacha CID: ${staticCid}`);
    const registry = await retrieveJSON<HypercertRegistry>(staticCid, "registry.json");
    console.log(`  ✓ ${registry.entries.length} entries loaded`);
    return registry;
  }

  throw new Error(
    "No registry source found. Set UPSTASH_REDIS_REST_URL/TOKEN or REGISTRY_CID."
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Kredence — Hypercert Schema Migration");
  console.log("═══════════════════════════════════════════════════════\n");

  const registry = await loadRegistry();

  // Allow targeting only failed entries via ONLY_SLUGS env var (comma-separated)
  const onlySlugs = process.env["ONLY_SLUGS"]
    ? new Set(process.env["ONLY_SLUGS"].split(",").map((s) => s.trim()))
    : null;

  const candidates = registry.entries.filter(
    (e) => e.hasAtproto && e.cid && (!onlySlugs || onlySlugs.has(e.slug))
  );
  const skipped    = registry.entries.length - candidates.length;

  console.log(`\nTotal entries:     ${registry.entries.length}`);
  console.log(`To migrate:        ${candidates.length}`);
  console.log(`Skipped (no ATP):  ${skipped}\n`);

  if (candidates.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  const results: Array<{
    title: string;
    status: "ok" | "error";
    oldUrl?: string;
    newCid?: string;
    error?: string;
  }> = [];

  for (const [i, entry] of candidates.entries()) {
    const prefix = `[${i + 1}/${candidates.length}]`;
    console.log(`${prefix} ${entry.title}`);
    console.log(`        Payload CID: ${entry.cid}`);
    console.log(`        ATProto URL: ${entry.atprotoUrl ?? "—"}`);

    try {
      // 1. Try the server API first — its in-memory registry always has the
      //    correct final CID, even when Redis has a stale pre-ATProto one.
      let payload: HypercertPayload | null = null;
      try {
        payload = await fetchPayloadFromServer(entry.slug);
        if (payload) console.log(`        ✓  fetched via server API`);
      } catch (serverErr) {
        const msg = serverErr instanceof Error ? serverErr.message : String(serverErr);
        console.log(`        ⚠  server fetch failed (${msg}) — falling back to Storacha`);
      }

      // 2. Fall back to direct Storacha fetch with retries
      if (!payload) {
        let lastErr: unknown;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            payload = await retrieveJSON<HypercertPayload>(entry.cid, "data.json", 60_000);
            break;
          } catch (fetchErr) {
            lastErr = fetchErr;
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            if (attempt < 3) {
              console.log(`        ⚠  Storacha attempt ${attempt} failed (${msg}) — retrying in 5s…`);
              await new Promise((r) => setTimeout(r, 5_000));
            }
          }
        }
        if (!payload) throw lastErr;
      }

      if (!payload.atproto) {
        console.log(`        ⚠  payload.atproto missing — skipping`);
        results.push({ title: entry.title, status: "error", error: "payload.atproto missing" });
        continue;
      }

      // Re-publish with updated schema
      const updated = await updateHypercert(payload);

      if (!updated) {
        console.log(`        ⚠  updateHypercert returned null (credentials missing?)`);
        results.push({ title: entry.title, status: "error", error: "updateHypercert returned null" });
        continue;
      }

      console.log(`        ✓  updated → new CID: ${updated.activityCid}`);
      console.log(`           URI stays: ${updated.activityUri}`);
      results.push({
        title: entry.title,
        status: "ok",
        oldUrl: entry.atprotoUrl,
        newCid: updated.activityCid,
      });

      // Small delay to avoid rate-limiting the PDS
      await new Promise((r) => setTimeout(r, 500));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`        ✗  failed: ${msg}`);
      results.push({ title: entry.title, status: "error", error: msg });
    }

    console.log();
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  const ok      = results.filter((r) => r.status === "ok");
  const failed  = results.filter((r) => r.status === "error");

  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Migration complete: ${ok.length} updated, ${failed.length} failed`);
  console.log("═══════════════════════════════════════════════════════\n");

  if (ok.length > 0) {
    console.log("Updated records:");
    for (const r of ok) {
      console.log(`  ✓ ${r.title}`);
      console.log(`    new ATProto CID: ${r.newCid}`);
      console.log(`    hyperscan: ${r.oldUrl}`);
    }
    console.log();
  }

  if (failed.length > 0) {
    console.log("Failed:");
    for (const r of failed) {
      console.log(`  ✗ ${r.title}: ${r.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Migration aborted:", err instanceof Error ? err.message : err);
  process.exit(1);
});
