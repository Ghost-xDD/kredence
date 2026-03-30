/**
 * One-off cleanup: remove registry entries that have no ATProto record.
 *
 * These entries have Storacha CIDs but failed ATProto publishing (ExpiredToken).
 * Deleting them from Redis lets the next pipeline run re-evaluate them cleanly,
 * this time with the session-refresh fix in place.
 *
 * Nothing to remove from Hyperscan — these entries never had ATProto records.
 *
 * Run:
 *   cd scripts && ../node_modules/.bin/tsx cleanup-registry.ts
 *   # or:
 *   pnpm --filter scripts tsx cleanup-registry.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });

import type { HypercertRegistry } from "../packages/types/src/index.js";

const REDIS_URL   = process.env["UPSTASH_REDIS_REST_URL"]!;
const REDIS_TOKEN = process.env["UPSTASH_REDIS_REST_TOKEN"]!;
const REDIS_KEY   = "credence:registry";

if (!REDIS_URL || !REDIS_TOKEN) {
  console.error("❌  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set");
  process.exit(1);
}

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

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Kredence — Registry Cleanup (remove no-ATProto entries)");
  console.log("═══════════════════════════════════════════════════════\n");

  console.log("Loading registry from Redis…");
  const registry = await redisGet<HypercertRegistry>(REDIS_KEY);
  if (!registry) {
    console.error("❌  Registry not found in Redis");
    process.exit(1);
  }
  console.log(`  ✓ ${registry.entries.length} entries loaded\n`);

  const toRemove = registry.entries.filter((e) => !e.hasAtproto);
  const toKeep   = registry.entries.filter((e) =>  e.hasAtproto);

  if (toRemove.length === 0) {
    console.log("✓  Nothing to remove — all entries already have ATProto records.");
    return;
  }

  console.log(`Entries to REMOVE (${toRemove.length}):`);
  for (const e of toRemove) {
    console.log(`  ✗  ${e.title} (${e.slug})  CID: ${e.cid}`);
  }

  console.log(`\nEntries to KEEP (${toKeep.length}):`);
  for (const e of toKeep) {
    console.log(`  ✓  ${e.title} (${e.slug})`);
  }

  console.log("\nWriting cleaned registry to Redis…");
  const updated: HypercertRegistry = {
    updatedAt: new Date().toISOString(),
    entries: toKeep,
  };

  await redisSet(REDIS_KEY, updated);
  console.log(`  ✓ Registry updated: ${toKeep.length} entries kept, ${toRemove.length} removed\n`);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Done. Re-run the pipeline to re-evaluate removed entries.");
  console.log("═══════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("\n❌  Cleanup aborted:", err instanceof Error ? err.message : err);
  process.exit(1);
});
