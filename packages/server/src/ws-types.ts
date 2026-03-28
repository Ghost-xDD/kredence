import type { AgentLogEntry, AgentRole, EcosystemInput, HypercertPayload } from "@credence/types";

// ── Client → Server ────────────────────────────────────────────────────────

export type ClientMessage =
  | { type: "run"; payload: EcosystemInput; maxProjects?: number }
  | { type: "ping" };

// ── Server → Client ────────────────────────────────────────────────────────

export type ServerMessage =
  /** Connection established, server ready */
  | { type: "ready"; serverVersion: string }
  | { type: "pong" }

  /** Pipeline lifecycle */
  | { type: "pipeline_start"; runId: string; ecosystem: string }
  | { type: "pipeline_done"; runId: string; summary: PipelineSummary }
  | { type: "pipeline_error"; runId: string; stage: AgentRole | "unknown"; message: string }

  /** Stage boundaries */
  | { type: "stage_start"; runId: string; stage: AgentRole }
  | { type: "stage_done"; runId: string; stage: AgentRole }

  /** Individual log entries — emitted for every AgentLogger.log() call */
  | { type: "log"; runId: string; entry: AgentLogEntry; agent: AgentRole }

  /** Tool call started */
  | {
      type: "tool_call";
      runId: string;
      agent: AgentRole;
      phase: AgentLogEntry["phase"];
      tool: string;
      input: unknown;
    }

  /** Tool call finished */
  | {
      type: "tool_done";
      runId: string;
      agent: AgentRole;
      phase: AgentLogEntry["phase"];
      tool: string;
      output: unknown;
      durationMs: number;
    }

  /** Tool call failed */
  | {
      type: "tool_error";
      runId: string;
      agent: AgentRole;
      phase: AgentLogEntry["phase"];
      tool: string;
      error: string;
      durationMs: number;
    }

  /** One project fully evaluated and stored */
  | { type: "project_complete"; runId: string; payload: HypercertPayload };

export type PipelineSummary = {
  projectsEvaluated: number;
  hypercertsStored: number;
  atprotoPublished: number;
  totalVerified: number;
  totalFlagged: number;
  totalUnresolved: number;
  durationMs: number;
};
