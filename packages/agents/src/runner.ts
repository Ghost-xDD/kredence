import type { AgentOutput, AgentRole } from "@credence/types";
import { uploadJSON } from "@credence/storage";
import { AgentLogger } from "./logger.js";

export type AgentContext = {
  agentId: string;
  agentRegistry: string;
  operatorWallet: string;
  role: AgentRole;
  logger: AgentLogger;
};

export type AgentRunResult<TOutput> = {
  output: TOutput;
  agentOutput: AgentOutput;
  logCid: string;
};

/**
 * Base runner that wraps an agent function with:
 * - structured logging
 * - compute budget tracking
 * - Storacha persistence of output + log
 * - AgentOutput envelope generation
 */
export async function runAgent<TInput, TOutput>(
  role: AgentRole,
  identity: { agentId: string; agentRegistry: string; operatorWallet: string },
  input: TInput,
  inputDescription: string,
  fn: (input: TInput, ctx: AgentContext) => Promise<{ output: TOutput; summary: string; confidence: number }>,
  options?: { maxDurationMs?: number }
): Promise<AgentRunResult<TOutput>> {
  const maxDuration = options?.maxDurationMs ?? 5 * 60 * 1000; // 5 min default
  const startMs = Date.now();

  const logger = new AgentLogger(identity.agentId, identity.agentRegistry, role);
  const ctx: AgentContext = { ...identity, role, logger };

  logger.log("info", "discover", "agent:start", {
    role,
    agentId: identity.agentId,
    inputDescription,
  });

  // Compute budget guard
  const budgetTimer = setTimeout(() => {
    logger.log("warn", "execute", "agent:budget-exceeded", { maxDurationMs: maxDuration });
  }, maxDuration);

  let result: { output: TOutput; summary: string; confidence: number };
  let exitStatus: "success" | "partial" | "failed" = "success";

  try {
    result = await fn(input, ctx);
    logger.log("info", "verify", "agent:output-ready", { summary: result.summary });
  } catch (err) {
    exitStatus = "failed";
    logger.log("error", "execute", "agent:error", {
      error: err instanceof Error ? err.message : String(err),
    });
    clearTimeout(budgetTimer);
    // Persist the failure log before re-throwing
    const failLog = logger.flush("failed");
    await uploadJSON(failLog, "agent_log.json");
    throw err;
  }

  clearTimeout(budgetTimer);
  const durationMs = Date.now() - startMs;

  // Persist output artifact — non-fatal if upload fails (main artifact may already be stored)
  logger.log("info", "submit", "agent:persisting-output");
  let outputCid = "upload-failed";
  let logCid = "upload-failed";
  try {
    ({ cid: outputCid } = await uploadJSON(result.output, `${role}-output.json`));
    const log = logger.flush(exitStatus);
    ({ cid: logCid } = await uploadJSON(log, "agent_log.json"));
  } catch (uploadErr) {
    logger.log("warn", "submit", "agent:upload-failed", {
      error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
    });
    const log = logger.flush("partial");
    try {
      ({ cid: logCid } = await uploadJSON(log, "agent_log.json"));
    } catch {
      // best-effort log upload
    }
  }

  logger.log("info", "submit", "agent:done", { outputCid, logCid, durationMs });


  const agentOutput: AgentOutput = {
    agentId: identity.agentId,
    agentRegistry: identity.agentRegistry,
    role,
    operatorWallet: identity.operatorWallet,
    inputScopeDescription: inputDescription,
    outputSummary: result.summary,
    confidenceScore: result.confidence,
    storachaCid: outputCid,
    completedAt: new Date().toISOString(),
    durationMs,
  };

  return { output: result.output, agentOutput, logCid };
}
