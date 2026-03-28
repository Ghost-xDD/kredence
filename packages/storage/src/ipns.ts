/**
 * IPNS helpers for mutable registry pointers using w3name.
 *
 * A single IPNS name acts as a stable, permanent pointer to the
 * latest registry CID. After every pipeline run the name is updated
 * so that any server restart can resolve the latest snapshot without
 * needing to update an env var manually.
 *
 * Key management:
 *   - Generate once:   `pnpm --filter @credence/storage run gen-ipns-key`
 *   - Store the printed W3NAME_KEY value in Railway (and local .env).
 *   - The name string is derived from the key and never changes.
 */
import * as Name from "w3name";

export type IPNSRevision = Name.Revision;

/**
 * Load the signing key from a base64-encoded env value.
 * The key contains both the private and public halves.
 */
async function loadKey(keyBase64: string): Promise<Name.WritableName> {
  const raw = Buffer.from(keyBase64, "base64");
  return Name.from(raw);
}

/**
 * Resolve the IPNS name bound to `keyBase64` to the latest registry CID.
 * Returns null if no record has been published yet.
 */
export async function resolveIPNS(
  keyBase64: string
): Promise<{ cid: string; revision: IPNSRevision } | null> {
  try {
    const name = await loadKey(keyBase64);
    const revision = await Name.resolve(name);
    // revision.value is an IPFS path like "/ipfs/bafkrei..."
    const cid = revision.value.replace(/^\/ipfs\//, "");
    return { cid, revision };
  } catch {
    // Name not published yet, or network error — caller handles gracefully
    return null;
  }
}

/**
 * Publish `cid` to the IPNS name bound to `keyBase64`.
 * Pass the previous revision so the sequence number is incremented
 * correctly. Pass null on first publish (uses v0).
 */
export async function publishIPNS(
  keyBase64: string,
  cid: string,
  previousRevision: IPNSRevision | null
): Promise<IPNSRevision> {
  const name = await loadKey(keyBase64);
  const value = `/ipfs/${cid}`;
  const revision = previousRevision
    ? await Name.increment(previousRevision, value)
    : await Name.v0(name, value);
  await Name.publish(revision, name.key);
  return revision;
}

/**
 * Create a fresh IPNS signing key.
 * Run once, then store the output as the W3NAME_KEY env var.
 */
export async function createIPNSKey(): Promise<{
  keyBase64: string;
  nameString: string;
}> {
  const name = await Name.create();
  return {
    keyBase64: Buffer.from(name.key.raw).toString("base64"),
    nameString: name.toString(),
  };
}
