// Adversarial log — signed agent receipts for each challenged claim

export type ChallengeOutcome = "verified" | "flagged" | "unresolved";

export type ChallengeType =
  | "vague-metric"       // claim lacks specificity or measurable outcome
  | "attribution"        // claimed contributor not verifiable in observable evidence
  | "consistency"        // claim appears only in self-reported text, not corroborated
  | "deployment"         // claimed deployment not reachable or verifiable onchain
  | "overclaim"          // claimed impact scope exceeds observable evidence
  | "dead-link";         // referenced URL is unreachable

export type AdversarialLogEntry = {
  claimId: string;
  claimText: string;
  challengeType: ChallengeType;
  challengeEvidence: string;  // what the agent found (or didn't find)
  outcome: ChallengeOutcome;
  objectionText: string | null; // null if verified
};

export type AdversarialLog = {
  projectId: string;
  agentId: string;        // ERC-8004 agentId
  agentRegistry: string;  // e.g. "eip155:84532:0x8004A818..."
  operatorWallet: string;
  evaluatedAt: string;
  entries: AdversarialLogEntry[];
  verifiedCount: number;
  flaggedCount: number;
  unresolvedCount: number;
  // Off-chain signing context — makes the log a verifiable agent receipt
  // messageHash = keccak256 of canonical JSON of { projectId, entries }
  // signature   = EIP-191 personal_sign of messageHash by signerAddress
  signatureContext: {
    method: "eip191" | "eip712";
    signerAddress: string;
    messageHash: string;
    signature: string;
  } | null;
};
