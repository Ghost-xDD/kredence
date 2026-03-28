/**
 * In-memory registry store — survives across WebSocket connections within
 * a single server process. On startup it seeds itself from IPNS (preferred)
 * or a static REGISTRY_CID (fallback). After each successful pipeline run,
 * the new CID is published back to IPNS so the registry survives restarts.
 *
 * Env vars:
 *   W3NAME_KEY      base64-encoded IPNS signing key (generate once with
 *                   `pnpm --filter @credence/storage run gen-ipns-key`)
 *   REGISTRY_CID    static fallback if W3NAME_KEY is not set (manual update
 *                   required after each run)
 */
import type { HypercertRegistry, RegistryEntry } from "@credence/types";
import { fetchRegistry, resolveIPNS, publishIPNS } from "@credence/storage";
import type { IPNSRevision } from "@credence/storage";

let store: HypercertRegistry = { updatedAt: new Date().toISOString(), entries: [] };
let currentCid: string | null = null;
let currentRevision: IPNSRevision | null = null;

/** Seed the registry from IPNS (preferred) or a static CID env var. */
export async function initRegistry(): Promise<void> {
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
      console.log("[registry] IPNS name has no record yet — starting with empty registry");
    }
    return;
  }

  const staticCid = process.env["REGISTRY_CID"] ?? null;
  if (staticCid) {
    console.log("[registry] loading from REGISTRY_CID", staticCid);
    currentCid = staticCid;
    store = await fetchRegistry(currentCid);
    console.log(`[registry] loaded ${store.entries.length} entries`);
    return;
  }

  console.log("[registry] no W3NAME_KEY or REGISTRY_CID — starting with empty registry");
}

export function getRegistry(): HypercertRegistry {
  return store;
}

export function getRegistryCid(): string | null {
  return currentCid;
}

export function findEntry(slug: string): RegistryEntry | undefined {
  return store.entries.find((e) => e.slug === slug);
}

/**
 * Persist a new registry snapshot: update the in-memory store and,
 * if W3NAME_KEY is configured, publish the new CID to IPNS so the
 * registry survives server restarts without any manual env-var changes.
 */
export async function persistRegistry(
  updated: HypercertRegistry,
  newCid: string
): Promise<void> {
  store = updated;
  currentCid = newCid;

  const w3key = process.env["W3NAME_KEY"] ?? null;
  if (!w3key) {
    console.log(`[registry] updated in-memory (no W3NAME_KEY — set REGISTRY_CID=${newCid} to persist across restarts)`);
    return;
  }

  try {
    currentRevision = await publishIPNS(w3key, newCid, currentRevision);
    console.log(`[registry] IPNS updated → ${newCid}`);
  } catch (err) {
    console.error("[registry] IPNS publish failed — registry still updated in-memory:", err);
  }
}
