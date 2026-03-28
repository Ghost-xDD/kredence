// Agent identity, output, and manifest types
// ERC-8004 contracts: https://github.com/erc-8004/erc-8004-contracts
//
// Mainnet/Base IdentityRegistry:  0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
// Mainnet/Base ReputationRegistry: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
// Sepolia/Base Sepolia IdentityRegistry:  0x8004A818BFB912233c491871b3d84c89A494BD9e
// Sepolia/Base Sepolia ReputationRegistry: 0x8004B663056A597Dffe9eCcC1965A193B7388713

export type AgentRole = "scout" | "evidence" | "adversarial" | "synthesis";

export type AgentIdentity = {
  agentId: string;       // ERC-721 tokenId from IdentityRegistry
  agentRegistry: string; // "eip155:{chainId}:{identityRegistryAddress}"
  operatorWallet: string;
  agentURI: string;      // points to the agent registration file (IPFS or HTTPS)
};

export type AgentOutput = {
  agentId: string;
  agentRegistry: string;
  role: AgentRole;
  operatorWallet: string;
  inputScopeDescription: string;
  outputSummary: string;
  confidenceScore: number; // 0–1
  storachaCid: string;     // CID of the stored output artifact
  completedAt: string;     // ISO timestamp
  durationMs: number;
};

// agent.json — DevSpot Agent Manifest spec
export type AgentManifest = {
  name: string;
  version: string;
  description: string;
  agentId: string;
  agentRegistry: string;
  operatorWallet: string;
  role: AgentRole;
  supportedTools: string[];
  supportedTaskCategories: string[];
  computeConstraints: {
    maxDurationMs: number;
    maxLlmCalls: number;
    maxExternalRequests: number;
  };
  services: Array<{
    type: string;
    url: string;
  }>;
};

// agent_log.json — structured execution log
export type AgentLogEntry = {
  timestamp: string;
  level: "info" | "warn" | "error";
  phase: "discover" | "plan" | "execute" | "verify" | "submit";
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

export type AgentLog = {
  agentId: string;
  agentRegistry: string;
  role: AgentRole;
  runId: string;
  startedAt: string;
  completedAt: string | null;
  exitStatus: "success" | "partial" | "failed";
  entries: AgentLogEntry[];
};
