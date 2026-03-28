/**
 * In-memory registry store with Redis persistence.
 *
 * Priority order on startup:
 *   1. Redis (fast, reliable — primary store)
 *   2. IPNS → Storacha (decentralised audit trail — secondary)
 *   3. Empty registry (safe fallback)
 *
 * On every pipeline run both Redis and IPNS are updated so the full
 * decentralised audit trail is maintained alongside the reliable read path.
 *
 * Env vars:
 *   UPSTASH_REDIS_REST_URL    Upstash Redis REST endpoint
 *   UPSTASH_REDIS_REST_TOKEN  Upstash Redis REST token
 *   W3NAME_KEY                base64-encoded IPNS signing key (secondary)
 *   REGISTRY_CID              static Storacha CID fallback (tertiary)
 */
import { Redis } from "@upstash/redis";
import type { HypercertRegistry, RegistryEntry } from "@credence/types";
import { fetchRegistry, resolveIPNS, publishIPNS } from "@credence/storage";
import type { IPNSRevision } from "@credence/storage";

const REDIS_KEY = "credence:registry";
const SEED_TIMEOUT_MS = 12_000;

let store: HypercertRegistry = { updatedAt: new Date().toISOString(), entries: [] };
let currentCid: string | null = null;
let currentRevision: IPNSRevision | null = null;

// ── Redis client (lazy, null when env vars missing) ──────────────────────────

function getRedis(): Redis | null {
  const url   = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// ── Startup seeding ──────────────────────────────────────────────────────────

async function seedFromRedis(redis: Redis): Promise<boolean> {
  const raw = await redis.get<HypercertRegistry>(REDIS_KEY);
  if (!raw) return false;
  store = raw;
  console.log(`[registry] loaded ${store.entries.length} entries from Redis`);
  return true;
}

async function seedFromIPNS(): Promise<void> {
  const w3key = process.env["W3NAME_KEY"] ?? null;
  if (w3key) {
    console.log("[registry] resolving IPNS name…");
    const result = await resolveIPNS(w3key);
    if (result) {
      currentCid = result.cid;
      currentRevision = result.revision;
      store = await fetchRegistry(currentCid);
      console.log(`[registry] loaded ${store.entries.length} entries via IPNS → ${currentCid}`);
    } else {
      console.log("[registry] IPNS name has no record yet");
    }
    return;
  }

  const staticCid = process.env["REGISTRY_CID"] ?? null;
  if (staticCid) {
    console.log("[registry] loading from REGISTRY_CID", staticCid);
    currentCid = staticCid;
    store = await fetchRegistry(currentCid);
    console.log(`[registry] loaded ${store.entries.length} entries via static CID`);
  }
}

/** Seed the registry on startup. Redis is tried first; IPNS is the fallback. */
export async function initRegistry(): Promise<void> {
  const seed = async () => {
    const redis = getRedis();

    if (redis) {
      try {
        const loaded = await seedFromRedis(redis);
        if (loaded) return; // Redis had data — skip slower IPNS path
        console.log("[registry] Redis key empty — falling back to IPNS");
      } catch (err) {
        console.warn("[registry] Redis read failed:", err instanceof Error ? err.message : err);
      }
    } else {
      console.log("[registry] UPSTASH_REDIS_REST_URL/TOKEN not set — skipping Redis");
    }

    // Redis unavailable or empty — try IPNS/Storacha
    await seedFromIPNS();
  };

  const timeout = new Promise<void>((resolve) =>
    setTimeout(() => {
      console.warn(`[registry] seed timed out after ${SEED_TIMEOUT_MS}ms — starting with empty registry`);
      resolve();
    }, SEED_TIMEOUT_MS)
  );

  await Promise.race([seed(), timeout]);
}

// ── Public accessors ─────────────────────────────────────────────────────────

export function getRegistry(): HypercertRegistry {
  return store;
}

export function getRegistryCid(): string | null {
  return currentCid;
}

export function findEntry(slug: string): RegistryEntry | undefined {
  return store.entries.find((e) => e.slug === slug);
}

// ── Persistence ──────────────────────────────────────────────────────────────

/**
 * Persist a new registry snapshot.
 *
 * Writes to Redis immediately (fast, primary), then publishes to IPNS in the
 * background (slow, secondary — for the decentralised audit trail).
 */
export async function persistRegistry(
  updated: HypercertRegistry,
  newCid: string
): Promise<void> {
  store = updated;
  currentCid = newCid;

  // ── 1. Redis (primary) ───────────────────────────────────────────────────
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(REDIS_KEY, updated);
      console.log(`[registry] saved to Redis (${updated.entries.length} entries)`);
    } catch (err) {
      console.error("[registry] Redis write failed:", err instanceof Error ? err.message : err);
    }
  }

  // ── 2. IPNS / Storacha (secondary, non-blocking) ─────────────────────────
  const w3key = process.env["W3NAME_KEY"] ?? null;
  if (!w3key) {
    if (!redis) {
      console.log(`[registry] updated in-memory only (set UPSTASH_REDIS_REST_URL or REGISTRY_CID=${newCid} to persist)`);
    }
    return;
  }

  // Fire-and-forget — IPNS publish is slow and should not block the pipeline
  publishIPNS(w3key, newCid, currentRevision)
    .then((rev) => {
      currentRevision = rev;
      console.log(`[registry] IPNS updated → ${newCid}`);
    })
    .catch((err) => {
      // "outdated record" happens when currentRevision was reset by a server
      // restart — IPNS needs a monotonically increasing sequence number.
      // Redis already holds the authoritative registry; this is non-critical.
      console.warn("[registry] IPNS publish skipped (Redis is primary):", err instanceof Error ? err.message : err);
    });
}
