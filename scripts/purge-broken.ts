/**
 * One-off purge: delete broken hypercert entries from both ATProto (Hyperscan)
 * and the Redis registry.
 *
 * "Broken" = the server returns 502 for the /projects/:slug endpoint, meaning
 * the Storacha upload failed or the CID is no longer accessible.
 *
 * This script:
 *   1. Deletes each broken entry's ATProto activity record (deleteRecord).
 *   2. Removes the entry from the Redis registry.
 *
 * After running, the next pipeline evaluation will re-create these from scratch
 * with valid Storacha CIDs and fresh ATProto records.
 *
 * Run:
 *   pnpm purge:broken
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });

import type { HypercertRegistry } from "../packages/types/src/index.js";

// ── Config ────────────────────────────────────────────────────────────────────

const PDS           = "https://bsky.social";
const HANDLE        = process.env["HYPERCERTS_HANDLE"]!;
const APP_PASSWORD  = process.env["HYPERCERTS_APP_PASSWORD"]!;
const REDIS_URL     = process.env["UPSTASH_REDIS_REST_URL"]!;
const REDIS_TOKEN   = process.env["UPSTASH_REDIS_REST_TOKEN"]!;
const REDIS_KEY     = "credence:registry";

if (!HANDLE || !APP_PASSWORD) {
  console.error("❌  HYPERCERTS_HANDLE / HYPERCERTS_APP_PASSWORD not set");
  process.exit(1);
}
if (!REDIS_URL || !REDIS_TOKEN) {
  console.error("❌  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set");
  process.exit(1);
}

// ── ATProto session ───────────────────────────────────────────────────────────

type AtpSession = { did: string; accessJwt: string };

async function createSession(): Promise<AtpSession> {
  const res = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: HANDLE, password: APP_PASSWORD }),
  });
  if (!res.ok) throw new Error(`createSession failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<AtpSession>;
}

async function deleteRecord(session: AtpSession, collection: string, rkey: string): Promise<void> {
  const res = await fetch(`${PDS}/xrpc/com.atproto.repo.deleteRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({ repo: session.did, collection, rkey }),
  });
  if (!res.ok) throw new Error(`deleteRecord failed (${res.status}): ${await res.text()}`);
}

// ── Redis helpers ─────────────────────────────────────────────────────────────

async function redisGet<T>(key: string): Promise<T | null> {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis GET failed: ${res.status}`);
  const body = (await res.json()) as { result: string | null };
  if (!body.result) return null;
  // Parse once; if the result is still a string it was double-encoded — parse again
  let parsed = JSON.parse(body.result);
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed as T;
}

async function redisSet(key: string, value: unknown): Promise<void> {
  // Store as a single JSON string (matching how @upstash/redis SDK stores objects)
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status} ${await res.text()}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract rkey from a Hyperscan URL or an at:// URI. */
function extractRkey(url: string): string | null {
  // Hyperscan: ...&rkey=3mi4zdyqieu2w
  const hm = url.match(/[?&]rkey=([^&]+)/);
  if (hm) return hm[1]!;
  // at://did:.../collection/rkey
  const am = url.match(/\/([^/]+)$/);
  if (am) return am[1]!;
  return null;
}

/** Return HTTP status for a server /projects/:slug request (no body read). */
async function probe(slug: string): Promise<number> {
  try {
    const res = await fetch(
      `https://credenceserver-production.up.railway.app/projects/${encodeURIComponent(slug)}`,
      { method: "HEAD", signal: AbortSignal.timeout(15_000) }
    );
    return res.status;
  } catch {
    return 0;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Kredence — Purge Broken Hypercerts");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. Load registry
  console.log("Loading registry from Redis…");
  const registry = await redisGet<HypercertRegistry>(REDIS_KEY);
  if (!registry) { console.error("❌  Registry not found"); process.exit(1); }
  console.log(`  ✓ ${registry.entries.length} entries\n`);

  // 2. Identify broken entries (server 502 or explicit slug list via PURGE_SLUGS)
  const explicitSlugs = process.env["PURGE_SLUGS"]
    ? new Set(process.env["PURGE_SLUGS"].split(",").map((s) => s.trim()))
    : null;

  let broken = registry.entries.filter((e) => e.hasAtproto && e.atprotoUrl);

  if (explicitSlugs) {
    broken = broken.filter((e) => explicitSlugs.has(e.slug));
    console.log(`Using explicit PURGE_SLUGS list (${broken.length} entries).\n`);
  } else {
    console.log(`Probing ${broken.length} ATProto entries for broken Storacha links…`);
    const probeResults: typeof broken = [];
    for (const e of broken) {
      process.stdout.write(`  ${e.slug}… `);
      const status = await probe(e.slug);
      if (status !== 200) {
        console.log(`✗ ${status} — broken`);
        probeResults.push(e);
      } else {
        console.log(`✓ 200`);
      }
    }
    broken = probeResults;
  }

  if (broken.length === 0) {
    console.log("\n✓  No broken entries found. Nothing to purge.");
    return;
  }

  console.log(`\n${broken.length} entries to purge:`);
  broken.forEach((e) => console.log(`  ✗  ${e.title} (${e.slug})`));

  // 3. ATProto session
  console.log("\nCreating ATProto session…");
  const session = await createSession();
  console.log(`  ✓ Authenticated as ${session.did}\n`);

  // 4. Delete ATProto records and strip from registry
  const purged: string[] = [];
  const failed: string[] = [];

  for (const entry of broken) {
    const rkey = extractRkey(entry.atprotoUrl!);
    if (!rkey) {
      console.log(`  ⚠  Cannot extract rkey from ${entry.atprotoUrl} — skipping ATProto delete`);
    } else {
      try {
        await deleteRecord(session, "org.hypercerts.claim.activity", rkey);
        console.log(`  ✓  Deleted ATProto record for ${entry.title}  (rkey: ${rkey})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // RecordNotFound is fine — already gone
        if (msg.includes("RecordNotFound") || msg.includes("not found")) {
          console.log(`  ⚠  ATProto record already gone for ${entry.title} — continuing`);
        } else {
          console.error(`  ✗  ATProto delete failed for ${entry.title}: ${msg}`);
          failed.push(entry.slug);
          continue;
        }
      }
    }
    purged.push(entry.slug);
    await new Promise((r) => setTimeout(r, 300)); // gentle rate-limiting
  }

  // 5. Write cleaned registry
  const purgedSet = new Set(purged);
  const kept = registry.entries.filter((e) => !purgedSet.has(e.slug));
  const updated: HypercertRegistry = { updatedAt: new Date().toISOString(), entries: kept };

  console.log("\nWriting cleaned registry to Redis…");
  await redisSet(REDIS_KEY, updated);
  console.log(`  ✓ ${kept.length} entries kept, ${purged.length} purged\n`);

  // 6. Summary
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Purge complete: ${purged.length} removed, ${failed.length} failed`);
  console.log("═══════════════════════════════════════════════════════");

  if (failed.length > 0) {
    console.log("\nFailed:");
    failed.forEach((s) => console.log("  ✗", s));
    process.exit(1);
  }

  console.log("\nRe-run the pipeline for these projects to re-evaluate them:");
  broken
    .filter((e) => purgedSet.has(e.slug))
    .forEach((e) => console.log(`  •  ${e.title}`));
}

main().catch((err) => {
  console.error("\n❌  Purge aborted:", err instanceof Error ? err.message : err);
  process.exit(1);
});
