import type { HypercertRegistry, RegistryEntry } from "@credence/types";
import { retrieveJSON, uploadJSON } from "./store.js";

/**
 * Fetch the hypercert registry from Storacha by CID.
 * Returns an empty registry if the CID is null or the fetch fails.
 */
export async function fetchRegistry(cid: string | null): Promise<HypercertRegistry> {
  if (!cid) return { updatedAt: new Date().toISOString(), entries: [] };
  try {
    return await retrieveJSON<HypercertRegistry>(cid, "registry.json");
  } catch (err) {
    console.warn("[registry] failed to fetch CID", cid, "—", err instanceof Error ? err.message : err);
    return { updatedAt: new Date().toISOString(), entries: [] };
  }
}

/**
 * Merge new entries into the existing registry, re-upload it to Storacha,
 * and return the new CID.
 *
 * Entries with the same slug replace old ones (idempotent re-runs).
 */
export async function updateRegistry(
  currentCid: string | null,
  newEntries: RegistryEntry[]
): Promise<string> {
  const existing = await fetchRegistry(currentCid);

  const slugSet = new Set(newEntries.map((e) => e.slug));
  const merged: RegistryEntry[] = [
    ...existing.entries.filter((e) => !slugSet.has(e.slug)),
    ...newEntries,
  ];

  const registry: HypercertRegistry = {
    updatedAt: new Date().toISOString(),
    entries: merged,
  };

  const { cid } = await uploadJSON(registry, "registry.json");
  console.log(`[registry] updated — ${merged.length} entries, new CID: ${cid}`);
  return cid;
}
