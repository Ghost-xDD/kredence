/**
 * In-memory registry store — survives across WebSocket connections within
 * a single server process. Seeded from Storacha on startup if REGISTRY_CID
 * is set, and updated after each successful pipeline run.
 */
import type { HypercertRegistry, RegistryEntry } from "@credence/types";
import { fetchRegistry } from "@credence/storage";

let store: HypercertRegistry = { updatedAt: new Date().toISOString(), entries: [] };
let currentCid: string | null = process.env["REGISTRY_CID"] ?? null;

/** Load registry from Storacha on startup (if REGISTRY_CID is set). */
export async function initRegistry(): Promise<void> {
  if (!currentCid) {
    console.log("[registry] no REGISTRY_CID set — starting with empty registry");
    return;
  }
  console.log("[registry] loading from CID", currentCid);
  store = await fetchRegistry(currentCid);
  console.log(`[registry] loaded ${store.entries.length} entries`);
}

export function getRegistry(): HypercertRegistry {
  return store;
}

export function getRegistryCid(): string | null {
  return currentCid;
}

/** Called after a successful pipeline run to merge new entries. */
export function setRegistry(updated: HypercertRegistry, newCid: string): void {
  store = updated;
  currentCid = newCid;
}

export function findEntry(slug: string): RegistryEntry | undefined {
  return store.entries.find((e) => e.slug === slug);
}
