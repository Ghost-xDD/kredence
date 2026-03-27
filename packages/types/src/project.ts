// Core project and evidence types

export type SourceType = "github" | "website" | "onchain" | "document" | "submission-page";

export type ProjectSource = {
  type: SourceType;
  url: string;
  resolvedAt?: string; // ISO timestamp
};

export type ProjectRecord = {
  id: string; // deterministic: hash of primary source URL
  ecosystemKind: string;
  name: string;
  description?: string;
  team: string[];
  sources: ProjectSource[];
  // Populated after each pipeline stage
  evidenceBundleCid?: string;    // Storacha CID
  adversarialLogCid?: string;    // Storacha CID
  hypercertPayloadCid?: string;  // Storacha CID
  verifiedClaimCount?: number;
  flaggedClaimCount?: number;
  confidenceScore?: number;      // 0–1
  lastUpdated?: string;          // ISO timestamp
};

export type ProjectManifest = {
  ecosystemInput: import("./ecosystem.js").EcosystemInput;
  discoveredAt: string; // ISO timestamp
  projects: ProjectRecord[];
  scoutAgentId: string;
  storachaCid?: string;
};
