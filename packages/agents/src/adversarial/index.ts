/**
 * Adversarial Agent — structured claim challenging with signed receipts.
 *
 * Input:  EvidenceRunResult (ProjectRecord[] + EvidenceBundle[]) from Evidence Agent
 * Output: AdversarialRunResult — updated ProjectRecord[] (with adversarialLogCid)
 *         + full AdversarialLog[] (signed agent receipts)
 *
 * Per project:
 *   1. Run LLM challenge against all extracted claims using full evidence as context
 *   2. Sign the resulting log entries with the operator wallet (EIP-191)
 *   3. Store AdversarialLog on Storacha, attach CID to ProjectRecord
 *   4. Update ProjectRecord with verifiedClaimCount, flaggedClaimCount, confidenceScore
 */
import type { AdversarialLog, AgentLogEntry, ProjectRecord } from "@credence/types";
import type { EvidenceRunResult } from "../evidence/index.js";
import { runAgent, type AgentContext } from "../runner.js";
import { uploadJSON } from "@credence/storage";
import { getOperatorWallet } from "../identity.js";
import { challengeClaims } from "./challenge.js";
import { signAdversarialLog } from "./sign.js";

const CONCURRENCY = 3;

function getAdversarialIdentity() {
  return {
    agentId: process.env["ADVERSARIAL_AGENT_ID"] ?? "unregistered",
    agentRegistry: `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`,
    operatorWallet: getOperatorWallet(),
  };
}

function createSemaphore(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function acquire<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

async function evaluateProject(
  project: ProjectRecord,
  bundle: { projectId: string; extractedClaims: NonNullable<unknown>[] } & Record<string, unknown>,
  identity: ReturnType<typeof getAdversarialIdentity>,
  ctx: AgentContext
): Promise<{ updatedProject: ProjectRecord; log: AdversarialLog }> {
  ctx.logger.log("info", "plan", "adversarial:project-start", {
    id: project.id,
    name: project.name,
    claimCount: bundle.extractedClaims.length,
  });

  // ── LLM Challenge ──────────────────────────────────────────────────────────
  ctx.logger.log("info", "execute", "adversarial:challenge-start", { project: project.name });
  const entries = (await ctx.logger.toolCall(
    "execute",
    "challenge_claims",
    { project: project.name, claimCount: bundle.extractedClaims.length },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => challengeClaims(project, bundle as any)
  )) as Awaited<ReturnType<typeof challengeClaims>>;

  const verifiedCount = entries.filter((e) => e.outcome === "verified").length;
  const flaggedCount = entries.filter((e) => e.outcome === "flagged").length;
  const unresolvedCount = entries.filter((e) => e.outcome === "unresolved").length;

  ctx.logger.log("info", "execute", "adversarial:challenge-done", {
    project: project.name,
    verified: verifiedCount,
    flagged: flaggedCount,
    unresolved: unresolvedCount,
  });

  // ── Sign receipt ───────────────────────────────────────────────────────────
  ctx.logger.log("info", "verify", "adversarial:signing", { project: project.name });
  const signatureContext = (await ctx.logger.toolCall(
    "verify",
    "sign_adversarial_log",
    { projectId: project.id },
    () => signAdversarialLog(project.id, entries)
  )) as Awaited<ReturnType<typeof signAdversarialLog>>;

  // ── Assemble log ───────────────────────────────────────────────────────────
  const log: AdversarialLog = {
    projectId: project.id,
    agentId: identity.agentId,
    agentRegistry: identity.agentRegistry,
    operatorWallet: identity.operatorWallet,
    evaluatedAt: new Date().toISOString(),
    entries,
    verifiedCount,
    flaggedCount,
    unresolvedCount,
    signatureContext,
  };

  // Confidence = verified / total, weighted down if many unresolved
  const total = entries.length;
  const confidenceScore =
    total === 0 ? 0 : (verifiedCount + unresolvedCount * 0.5) / total;

  const updatedProject: ProjectRecord = {
    ...project,
    verifiedClaimCount: verifiedCount,
    flaggedClaimCount: flaggedCount,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    lastUpdated: new Date().toISOString(),
  };

  return { updatedProject, log };
}

// ── Public Agent Entry Point ─────────────────────────────────────────────────

export type AdversarialRunResult = {
  projects: ProjectRecord[];
  logs: AdversarialLog[];
};

export async function runAdversarialAgent(
  evidenceResult: EvidenceRunResult,
  onEntry?: (entry: AgentLogEntry) => void
): Promise<AdversarialRunResult> {
  const identity = getAdversarialIdentity();
  const { projects: evidenceProjects, bundles } = evidenceResult;

  const { output } = await runAgent(
    "adversarial",
    identity,
    evidenceResult,
    `Challenge claims for ${evidenceProjects.length} projects`,
    async (_input, ctx) => {
      ctx.logger.log("info", "discover", "adversarial:start", {
        projectCount: evidenceProjects.length,
      });

      const sem = createSemaphore(CONCURRENCY);
      const updatedProjects: ProjectRecord[] = [];
      const allLogs: AdversarialLog[] = [];

      await Promise.all(
        evidenceProjects.map((project, i) =>
          sem(async () => {
            const bundle = bundles[i];
            if (!bundle) {
              ctx.logger.log("warn", "plan", "adversarial:no-bundle", { id: project.id });
              updatedProjects.push(project);
              return;
            }

            let evaluationResult: Awaited<ReturnType<typeof evaluateProject>>;
            try {
              evaluationResult = await evaluateProject(project, bundle, identity, ctx);
            } catch (err) {
              ctx.logger.log("error", "execute", "adversarial:project-failed", {
                name: project.name,
                error: err instanceof Error ? err.message : String(err),
              });
              // Minimal log on total failure
              const emptyLog: AdversarialLog = {
                projectId: project.id,
                agentId: identity.agentId,
                agentRegistry: identity.agentRegistry,
                operatorWallet: identity.operatorWallet,
                evaluatedAt: new Date().toISOString(),
                entries: [],
                verifiedCount: 0,
                flaggedCount: 0,
                unresolvedCount: 0,
                signatureContext: null,
              };
              updatedProjects.push(project);
              allLogs.push(emptyLog);
              return;
            }

            const { updatedProject, log } = evaluationResult;

            // Store on Storacha
            ctx.logger.log("info", "submit", "adversarial:storing-log", { id: project.id });
            try {
              const { cid } = await uploadJSON(log, `adversarial-${project.id}.json`);
              updatedProjects.push({ ...updatedProject, adversarialLogCid: cid });
              allLogs.push(log);
              ctx.logger.log("info", "submit", "adversarial:log-stored", {
                id: project.id,
                cid,
                verified: log.verifiedCount,
                flagged: log.flaggedCount,
                unresolved: log.unresolvedCount,
                signed: log.signatureContext !== null,
              });
            } catch (uploadErr) {
              ctx.logger.log("error", "submit", "adversarial:store-failed", {
                id: project.id,
                error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
              });
              updatedProjects.push(updatedProject);
              allLogs.push(log);
            }
          })
        )
      );

      const withCid = updatedProjects.filter((p) => p.adversarialLogCid).length;
      const totalFlagged = allLogs.reduce((sum, l) => sum + l.flaggedCount, 0);
      const totalVerified = allLogs.reduce((sum, l) => sum + l.verifiedCount, 0);

      ctx.logger.log("info", "verify", "adversarial:summary", {
        total: evidenceProjects.length,
        withCid,
        totalVerified,
        totalFlagged,
      });

      return {
        output: { projects: updatedProjects, logs: allLogs },
        summary: `Challenged claims for ${withCid}/${evidenceProjects.length} projects — ${totalFlagged} flagged, ${totalVerified} verified`,
        confidence: withCid / Math.max(1, evidenceProjects.length),
      };
    },
    { maxDurationMs: 20 * 60 * 1000, ...(onEntry !== undefined ? { onEntry } : {}) }
  );

  return output;
}
