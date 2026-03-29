export { KredenceClient, KredenceError } from "./client.js";
export { PipelineRun } from "./pipeline.js";
export { TypedEmitter } from "./emitter.js";

export type {
  // Domain types
  AgentRole,
  AgentIdentity,
  AgentOutput,
  AgentManifest,
  AgentLogEntry,
  AgentLog,
  ChallengeOutcome,
  ChallengeType,
  AdversarialLogEntry,
  AdversarialLog,
  EcosystemInput,
  DevspotHackathon,
  FilecoinDevGrants,
  ETHGlobalShowcase,
  ChainlinkHackathon,
  Devfolio,
  Gitcoin,
  Octant,
  ManualURLList,
  GitHubRepo,
  GitHubSignals,
  WebsiteSignals,
  OnchainSignals,
  ExtractedClaim,
  EvidenceBundle,
  SourceType,
  ProjectSource,
  ProjectRecord,
  ProjectManifest,
  HypercertContributor,
  HypercertEvidenceRef,
  VerifiedClaim,
  FlaggedClaim,
  OpenQuestion,
  HypercertPayload,
  RegistryEntry,
  HypercertRegistry,
  // Protocol types
  PipelineSummary,
  ClientMessage,
  ServerMessage,
  // SDK config
  KredenceClientOptions,
  RunOptions,
  // REST responses
  HealthResponse,
  BadgeResponse,
} from "./types.js";
