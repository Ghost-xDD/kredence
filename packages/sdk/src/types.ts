// Re-export all domain types from @credence/types
export type {
  // Agent
  AgentRole,
  AgentIdentity,
  AgentOutput,
  AgentManifest,
  AgentLogEntry,
  AgentLog,
  // Adversarial
  ChallengeOutcome,
  ChallengeType,
  AdversarialLogEntry,
  AdversarialLog,
  // Ecosystem inputs
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
  // Evidence
  GitHubSignals,
  WebsiteSignals,
  OnchainSignals,
  ExtractedClaim,
  EvidenceBundle,
  // Project
  SourceType,
  ProjectSource,
  ProjectRecord,
  ProjectManifest,
  // Hypercert
  HypercertContributor,
  HypercertEvidenceRef,
  VerifiedClaim,
  FlaggedClaim,
  OpenQuestion,
  HypercertPayload,
  // Registry
  RegistryEntry,
  HypercertRegistry,
} from "@credence/types";

import type { AgentLogEntry, AgentRole, HypercertPayload } from "@credence/types";

// ── WebSocket protocol types ───────────────────────────────────────────────
// These mirror packages/server/src/ws-types.ts and define the public wire API.

export type PipelineSummary = {
  projectsEvaluated: number;
  hypercertsStored: number;
  atprotoPublished: number;
  totalVerified: number;
  totalFlagged: number;
  totalUnresolved: number;
  durationMs: number;
};

/** Messages sent from client → server over the WebSocket. */
export type ClientMessage =
  | { type: "run"; payload: import("@credence/types").EcosystemInput; maxProjects?: number }
  | { type: "ping" };

/** Messages received from server → client over the WebSocket. */
export type ServerMessage =
  | { type: "ready"; serverVersion: string }
  | { type: "pong" }
  | { type: "pipeline_start"; runId: string; ecosystem: string }
  | { type: "pipeline_done"; runId: string; summary: PipelineSummary }
  | { type: "pipeline_error"; runId: string; stage: AgentRole | "unknown"; message: string }
  | { type: "stage_start"; runId: string; stage: AgentRole }
  | { type: "stage_done"; runId: string; stage: AgentRole }
  | { type: "log"; runId: string; entry: AgentLogEntry; agent: AgentRole }
  | { type: "tool_call"; runId: string; agent: AgentRole; phase: AgentLogEntry["phase"]; tool: string; input: unknown }
  | { type: "tool_done"; runId: string; agent: AgentRole; phase: AgentLogEntry["phase"]; tool: string; output: unknown; durationMs: number }
  | { type: "tool_error"; runId: string; agent: AgentRole; phase: AgentLogEntry["phase"]; tool: string; error: string; durationMs: number }
  | { type: "project_complete"; runId: string; payload: HypercertPayload };

// ── REST response types ────────────────────────────────────────────────────

export type HealthResponse = {
  status: "ok";
  version: string;
  ts: string;
};

export type BadgeResponse = {
  schemaVersion: 1;
  label: string;
  message: string;
  color: string;
  namedLogo?: string;
};

// ── SDK config ─────────────────────────────────────────────────────────────

export type KredenceClientOptions = {
  /**
   * Base URL of the Kredence API server.
   * @default "https://api.kredence.xyz"
   */
  baseUrl?: string;
  /**
   * Override the WebSocket constructor.
   * Useful in Node.js < 22 where native WebSocket is unavailable:
   *   import WebSocket from 'ws';
   *   new KredenceClient({ WebSocket })
   */
  WebSocket?: typeof globalThis.WebSocket;
};

export type RunOptions = {
  /**
   * Maximum number of projects to evaluate in this run. Hard-capped at 10
   * by the server. Defaults to 3.
   */
  maxProjects?: number;
};
