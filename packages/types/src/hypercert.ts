// Hypercert payload — aligned with Hypercerts supplementary data spec
// Docs: https://docs.hypercerts.org/

export type HypercertContributor = {
  name: string;
  githubLogin?: string;
  walletAddress?: string;
};

export type HypercertEvidenceRef = {
  label: string;
  url: string;
  storachaCid?: string;
};

export type VerifiedClaim = {
  id: string;
  text: string;
  supportingEvidence: string[];
};

export type FlaggedClaim = {
  id: string;
  text: string;
  objection: string;
  challengeType: import("./adversarial.js").ChallengeType;
};

export type OpenQuestion = {
  claimId: string;
  text: string;
  objection: string;
};

export type HypercertPayload = {
  // Core hypercert fields
  title: string;
  description: string;
  contributors: HypercertContributor[];
  timeframeStart: string;  // ISO date
  timeframeEnd: string;    // ISO date
  impactCategory: string[];
  workScopes: string[];

  // Evidence
  evidenceRefs: HypercertEvidenceRef[];

  // Evaluation results (supplementary data)
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

  // Storacha references for full audit trail
  storachaRefs: {
    evidenceBundleCid: string;
    adversarialLogCid: string;
    hypercertPayloadCid?: string;
  };

  // ATProto / Hypercerts network references (populated after publish)
  atproto?: {
    activityUri: string;   // at://did:.../org.hypercerts.claim.activity/rkey
    activityCid: string;
    evaluationUri: string;
    evaluationCid: string;
    attachmentUri: string;
    attachmentCid: string;
    hyperscanUrl: string;  // https://www.hyperscan.dev/data?...
  };

  generatedAt: string; // ISO timestamp
};
