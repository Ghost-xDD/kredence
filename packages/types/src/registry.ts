/** A compact index entry stored in the mutable registry on Storacha. */
export type RegistryEntry = {
  /** URL-safe slug derived from the project title (used as the web route id). */
  slug: string;
  /** Storacha CID of the full HypercertPayload JSON file. */
  cid: string;
  /** Filename within the Storacha directory CID (e.g. "hypercert-abc123.json"). */
  filename: string;
  title: string;
  description: string;
  /** 0–1 */
  confidenceScore: number;
  verifiedCount: number;
  flaggedCount: number;
  unresolvedCount: number;
  impactCategory: string[];
  workScopes: string[];
  /** Display names of contributors. */
  contributors: string[];
  hasAtproto: boolean;
  atprotoUrl?: string;
  /** Which ecosystem adapter produced this entry (e.g. "devspot", "ethglobal"). */
  ecosystemKind?: string;
  /** Pipeline run that produced this entry. */
  runId: string;
  evaluatedAt: string; // ISO timestamp
};

export type HypercertRegistry = {
  updatedAt: string; // ISO timestamp
  entries: RegistryEntry[];
};
