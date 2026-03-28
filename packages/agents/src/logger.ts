import type { AgentLog, AgentLogEntry, AgentRole } from "@credence/types";
import { nanoid } from "nanoid";

export class AgentLogger {
  private entries: AgentLogEntry[] = [];
  private startedAt: string;
  private runId: string;

  constructor(
    private agentId: string,
    private agentRegistry: string,
    private role: AgentRole
  ) {
    this.runId = nanoid();
    this.startedAt = new Date().toISOString();
  }

  log(
    level: AgentLogEntry["level"],
    phase: AgentLogEntry["phase"],
    action: string,
    details?: Record<string, unknown>
  ): void {
    const entry: AgentLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      phase,
      action,
      ...(details ? { details } : {}),
    };
    this.entries.push(entry);

    const prefix = `[${this.role.toUpperCase()}][${phase}]`;
    if (level === "error") {
      console.error(prefix, action, details ?? "");
    } else if (level === "warn") {
      console.warn(prefix, action, details ?? "");
    } else {
      console.log(prefix, action, details ?? "");
    }
  }

  toolCall(
    phase: AgentLogEntry["phase"],
    tool: string,
    input: unknown,
    fn: () => Promise<unknown>
  ): Promise<unknown> {
    const startMs = Date.now();
    this.log("info", phase, `tool:${tool}:start`, { input });

    return fn()
      .then((output) => {
        const durationMs = Date.now() - startMs;
        const entry: AgentLogEntry = {
          timestamp: new Date().toISOString(),
          level: "info",
          phase,
          action: `tool:${tool}:done`,
          toolCall: { tool, input, output, durationMs },
        };
        this.entries.push(entry);
        return output;
      })
      .catch((err: unknown) => {
        const durationMs = Date.now() - startMs;
        const error = err instanceof Error ? err.message : String(err);
        const entry: AgentLogEntry = {
          timestamp: new Date().toISOString(),
          level: "error",
          phase,
          action: `tool:${tool}:error`,
          toolCall: { tool, input, durationMs, error },
        };
        this.entries.push(entry);
        throw err;
      });
  }

  getRunId(): string {
    return this.runId;
  }

  flush(exitStatus: AgentLog["exitStatus"] = "success"): AgentLog {
    return {
      agentId: this.agentId,
      agentRegistry: this.agentRegistry,
      role: this.role,
      runId: this.runId,
      startedAt: this.startedAt,
      completedAt: new Date().toISOString(),
      exitStatus,
      entries: this.entries,
    };
  }
}
