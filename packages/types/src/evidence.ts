// Evidence bundle — normalized evidence collected per project

export type GitHubSignals = {
  repoUrl: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  defaultBranch: string;
  pushedAt: string;
  createdAt: string;
  contributors: Array<{ login: string; contributions: number }>;
  commitCount90d: number;
  mergedPRCount90d: number;
  closedIssueCount90d: number;
  releases: Array<{ tag: string; publishedAt: string; body: string | null }>;
  readmeContent: string | null;
};

export type WebsiteSignals = {
  url: string;
  title: string | null;
  description: string | null;
  bodyText: string; // cleaned text content
  fetchedAt: string;
  statusCode: number;
  isLive: boolean;
};

export type OnchainSignals = {
  address: string;
  chainId: number;
  transactionCount: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  isVerifiedContract: boolean;
};

export type ExtractedClaim = {
  id: string;
  text: string;         // the claim as stated or implied
  source: string;       // which source it came from
  sourceType: import("./project.js").SourceType;
  isSelfReported: boolean; // true if from README/submission description (not independently observable)
};

export type EvidenceBundle = {
  projectId: string;
  collectedAt: string;
  github?: GitHubSignals;
  website?: WebsiteSignals;
  onchain?: OnchainSignals;
  extractedClaims: ExtractedClaim[];
  sourcesFailed: Array<{ url: string; reason: string }>;
};
