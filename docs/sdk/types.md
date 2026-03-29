# Types

All types are exported from `kredence`. No separate `@types/` package required.

```ts
import type { HypercertPayload, EcosystemInput, ... } from 'kredence';
```

---

## Ecosystem inputs

```ts
type EcosystemInput =
  | GitHubRepo
  | Gitcoin
  | DevspotHackathon
  | FilecoinDevGrants
  | ETHGlobalShowcase
  | ChainlinkHackathon
  | Devfolio
  | Octant
  | ManualURLList;

type GitHubRepo        = { kind: 'github-repo';          repoUrl: string; installationId?: number };
type Gitcoin           = { kind: 'gitcoin';              roundId: string; chainId?: number };
type DevspotHackathon  = { kind: 'devspot';              url: string };
type FilecoinDevGrants = { kind: 'filecoin-devgrants';   repo: string; labels?: string[] };
type ETHGlobalShowcase = { kind: 'ethglobal';            eventSlug: string };
type ChainlinkHackathon= { kind: 'chainlink-hackathon';  galleryUrl: string; maxProjects?: number };
type Devfolio          = { kind: 'devfolio';             hackathonSlug: string };
type Octant            = { kind: 'octant';               epochNumber?: number };
type ManualURLList     = { kind: 'manual';               urls: string[] };
```

---

## Registry

```ts
type HypercertRegistry = {
  updatedAt: string;       // ISO timestamp
  entries: RegistryEntry[];
};

type RegistryEntry = {
  slug: string;
  cid: string;             // Storacha CID of the full HypercertPayload
  filename: string;
  title: string;
  description: string;
  confidenceScore: number; // 0–1
  verifiedCount: number;
  flaggedCount: number;
  unresolvedCount: number;
  impactCategory: string[];
  workScopes: string[];
  contributors: string[];
  hasAtproto: boolean;
  atprotoUrl?: string;
  runId: string;
  evaluatedAt: string;
};
```

---

## HypercertPayload

The full evaluation output for a single project.

```ts
type HypercertPayload = {
  // Core hypercert fields
  title: string;
  description: string;
  contributors: HypercertContributor[];
  timeframeStart: string;
  timeframeEnd: string;
  impactCategory: string[];
  workScopes: string[];

  // Evidence
  evidenceRefs: HypercertEvidenceRef[];

  // Evaluation results
  verifiedClaims: VerifiedClaim[];
  flaggedClaims: FlaggedClaim[];
  openQuestions: OpenQuestion[];
  evaluatorSummary: string;
  confidenceScore: number; // 0–1

  // Agent attribution
  evaluatedBy: Array<{
    agentId: string;
    agentRegistry: string;
    role: string;
    operatorWallet: string;
  }>;

  // Storacha audit trail
  storachaRefs: {
    evidenceBundleCid: string;
    adversarialLogCid: string;
    hypercertPayloadCid?: string;
  };

  // ATProto / Hyperscan (populated after publish)
  atproto?: {
    activityUri: string;
    activityCid: string;
    evaluationUri: string;
    evaluationCid: string;
    attachmentUri: string;
    attachmentCid: string;
    hyperscanUrl: string;
  };

  generatedAt: string;
};

type HypercertContributor = {
  name: string;
  githubLogin?: string;
  walletAddress?: string;
};

type HypercertEvidenceRef = {
  label: string;
  url: string;
  storachaCid?: string;
};

type VerifiedClaim = {
  id: string;
  text: string;
  supportingEvidence: string[];
};

type FlaggedClaim = {
  id: string;
  text: string;
  objection: string;
  challengeType: ChallengeType;
};

type OpenQuestion = {
  claimId: string;
  text: string;
  objection: string;
};
```

---

## Adversarial

```ts
type ChallengeOutcome = 'verified' | 'flagged' | 'unresolved';

type ChallengeType =
  | 'vague-metric'
  | 'attribution'
  | 'consistency'
  | 'deployment'
  | 'overclaim'
  | 'dead-link';

type AdversarialLog = {
  projectId: string;
  agentId: string;
  agentRegistry: string;
  operatorWallet: string;
  evaluatedAt: string;
  entries: AdversarialLogEntry[];
  verifiedCount: number;
  flaggedCount: number;
  unresolvedCount: number;
  signatureContext: {
    method: 'eip191' | 'eip712';
    signerAddress: string;
    messageHash: string;
    signature: string;
  } | null;
};

type AdversarialLogEntry = {
  claimId: string;
  claimText: string;
  challengeType: ChallengeType;
  challengeEvidence: string;
  outcome: ChallengeOutcome;
  objectionText: string | null;
};
```

---

## Evidence

```ts
type EvidenceBundle = {
  projectId: string;
  collectedAt: string;
  github?: GitHubSignals;
  website?: WebsiteSignals;
  onchain?: OnchainSignals;
  extractedClaims: ExtractedClaim[];
  sourcesFailed: Array<{ url: string; reason: string }>;
};

type GitHubSignals = {
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

type WebsiteSignals = {
  url: string;
  title: string | null;
  description: string | null;
  bodyText: string;
  fetchedAt: string;
  statusCode: number;
  isLive: boolean;
};

type OnchainSignals = {
  address: string;
  chainId: number;
  transactionCount: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  isVerifiedContract: boolean;
};
```

---

## Agent

```ts
type AgentRole = 'scout' | 'evidence' | 'adversarial' | 'synthesis';

type AgentLogEntry = {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  phase: 'discover' | 'plan' | 'execute' | 'verify' | 'submit';
  action: string;
  details?: Record<string, unknown>;
  toolCall?: {
    tool: string;
    input: unknown;
    output?: unknown;
    durationMs?: number;
    error?: string;
  };
  retry?: {
    attempt: number;
    maxAttempts: number;
    reason: string;
  };
};
```

---

## WebSocket protocol

```ts
type PipelineSummary = {
  projectsEvaluated: number;
  hypercertsStored: number;
  atprotoPublished: number;
  totalVerified: number;
  totalFlagged: number;
  totalUnresolved: number;
  durationMs: number;
};

type ServerMessage =
  | { type: 'ready'; serverVersion: string }
  | { type: 'pong' }
  | { type: 'pipeline_start'; runId: string; ecosystem: string }
  | { type: 'pipeline_done'; runId: string; summary: PipelineSummary }
  | { type: 'pipeline_error'; runId: string; stage: AgentRole | 'unknown'; message: string }
  | { type: 'stage_start'; runId: string; stage: AgentRole }
  | { type: 'stage_done'; runId: string; stage: AgentRole }
  | { type: 'log'; runId: string; entry: AgentLogEntry; agent: AgentRole }
  | { type: 'tool_call'; runId: string; agent: AgentRole; phase: string; tool: string; input: unknown }
  | { type: 'tool_done'; runId: string; agent: AgentRole; phase: string; tool: string; output: unknown; durationMs: number }
  | { type: 'tool_error'; runId: string; agent: AgentRole; phase: string; tool: string; error: string; durationMs: number }
  | { type: 'project_complete'; runId: string; payload: HypercertPayload };
```

---

## SDK config

```ts
type KredenceClientOptions = {
  baseUrl?: string;
  WebSocket?: typeof globalThis.WebSocket;
};

type RunOptions = {
  maxProjects?: number; // default 3, max 10
};
```
