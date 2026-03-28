/**
 * Synthesis Agent — hypercert payload assembly.
 *
 * Input:  Combined output of Evidence + Adversarial agents
 * Output: HypercertPayload[] — one per project, stored on Storacha
 *
 * Per project:
 *   Deterministic (no LLM):
 *     - contributors     ← GitHub contributor list
 *     - timeframeStart   ← repo createdAt (or 90d window start)
 *     - timeframeEnd     ← repo pushedAt (last known activity)
 *     - verifiedClaims   ← adversarial log entries with outcome="verified"
 *     - flaggedClaims    ← adversarial log entries with outcome="flagged"
 *     - openQuestions    ← adversarial log entries with outcome="unresolved"
 *     - confidenceScore  ← from ProjectRecord (computed by Adversarial Agent)
 *     - evidenceRefs     ← Storacha CIDs for bundle and log
 *     - evaluatedBy      ← all four agent identities
 *
 *   LLM (one call per project):
 *     - description       ← what was built, from verified evidence only
 *     - impactCategory    ← inferred from topics, README, claims
 *     - workScopes        ← what the project does at a high level
 *     - evaluatorSummary  ← one-paragraph human-readable synthesis
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import type {
  AdversarialLog,
  AgentLogEntry,
  EvidenceBundle,
  FlaggedClaim,
  HypercertContributor,
  HypercertPayload,
  OpenQuestion,
  ProjectRecord,
  VerifiedClaim,
} from "@credence/types";
import type { AdversarialRunResult } from "../adversarial/index.js";
import type { EvidenceRunResult } from "../evidence/index.js";
import { runAgent } from "../runner.js";
import { structuredLLMCall } from "../llm.js";
import { uploadJSON } from "@credence/storage";
import { getOperatorWallet } from "../identity.js";
import { publishHypercert } from "../hypercerts/publish.js";

const CONCURRENCY = 3;

const IMPACT_CATEGORIES = [
  "public-goods",
  "infrastructure",
  "defi",
  "nft",
  "dao-tooling",
  "developer-tools",
  "privacy",
  "identity",
  "social",
  "gaming",
  "data",
  "ai",
  "cross-chain",
  "payments",
] as const;

const SynthesisLLMSchema = z.object({
  description: z
    .string()
    .describe(
      "1–2 sentence factual description of what was built, drawing only from verified evidence and observable GitHub data. Do not repeat self-reported claims that were flagged."
    ),
  impactCategory: z
    .array(z.string())
    .describe(
      `1–3 impact categories from this list: ${IMPACT_CATEGORIES.join(", ")}. Choose the most accurate ones.`
    ),
  workScopes: z
    .array(z.string())
    .describe(
      "3–5 short phrases (3–6 words each) describing what the project actually does, based on verified evidence."
    ),
  evaluatorSummary: z
    .string()
    .describe(
      "One paragraph (3–5 sentences) human-readable synthesis for a funder. Describe what was verifiably built, note any flagged claims, and give an honest assessment of evidence quality. Be specific — cite actual numbers from the evidence."
    ),
});

function getSynthesisIdentity() {
  return {
    agentId: process.env["SYNTHESIS_AGENT_ID"] ?? "unregistered",
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

// ── Deterministic assembly helpers ────────────────────────────────────────────

function buildContributors(bundle: EvidenceBundle): HypercertContributor[] {
  if (!bundle.github?.contributors.length) return [];
  return bundle.github.contributors.map((c) => ({
    name: c.login,
    githubLogin: c.login,
  }));
}

function buildTimeframe(bundle: EvidenceBundle): { start: string; end: string } {
  const ninety = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!;
  const today = new Date().toISOString().split("T")[0]!;

  if (!bundle.github) return { start: ninety, end: today };

  const start = bundle.github.createdAt
    ? bundle.github.createdAt.split("T")[0]!
    : ninety;
  const end = bundle.github.pushedAt
    ? bundle.github.pushedAt.split("T")[0]!
    : today;

  return { start, end };
}

function buildVerifiedClaims(log: AdversarialLog): VerifiedClaim[] {
  return log.entries
    .filter((e) => e.outcome === "verified")
    .map((e) => ({
      id: e.claimId,
      text: e.claimText,
      supportingEvidence: [e.challengeEvidence],
    }));
}

function buildFlaggedClaims(log: AdversarialLog): FlaggedClaim[] {
  return log.entries
    .filter((e) => e.outcome === "flagged")
    .map((e) => ({
      id: e.claimId,
      text: e.claimText,
      objection: e.objectionText ?? "Flagged — see challenge evidence.",
      challengeType: e.challengeType,
    }));
}

function buildOpenQuestions(log: AdversarialLog): OpenQuestion[] {
  return log.entries
    .filter((e) => e.outcome === "unresolved")
    .map((e) => ({
      claimId: e.claimId,
      text: e.claimText,
      objection: e.objectionText ?? "Unresolved — insufficient evidence to confirm or deny.",
    }));
}

function buildEvidenceContext(
  project: ProjectRecord,
  bundle: EvidenceBundle,
  log: AdversarialLog
): string {
  const parts: string[] = [];

  if (bundle.github) {
    const g = bundle.github;
    parts.push(
      `GitHub: ${g.repoUrl} | Stars: ${g.stars} | Commits/90d: ${g.commitCount90d} | Contributors: ${g.contributors.length} | Topics: ${g.topics.join(", ") || "none"} | Releases: ${g.releases.length}`
    );
    if (g.description) parts.push(`Repo description: ${g.description}`);
    if (g.readmeContent) parts.push(`README excerpt:\n${g.readmeContent.slice(0, 1500)}`);
  }

  if (bundle.website) {
    const w = bundle.website;
    parts.push(
      `Website: ${w.url} (${w.isLive ? "live" : "unreachable"}) | Title: ${w.title ?? "none"}`
    );
    if (w.bodyText) parts.push(`Website content: ${w.bodyText.slice(0, 800)}`);
  }

  const verified = log.entries.filter((e) => e.outcome === "verified");
  const flagged = log.entries.filter((e) => e.outcome === "flagged");

  if (verified.length > 0) {
    parts.push(
      `Verified claims (${verified.length}):\n${verified.map((e) => `- ${e.claimText}`).join("\n")}`
    );
  }
  if (flagged.length > 0) {
    parts.push(
      `Flagged claims (${flagged.length}):\n${flagged.map((e) => `- ${e.claimText} | Objection: ${e.objectionText}`).join("\n")}`
    );
  }

  return parts.join("\n\n");
}

// ── Per-project synthesis ─────────────────────────────────────────────────────

async function synthesizeProject(
  project: ProjectRecord,
  bundle: EvidenceBundle,
  log: AdversarialLog,
  identity: ReturnType<typeof getSynthesisIdentity>
): Promise<HypercertPayload> {
  const context = buildEvidenceContext(project, bundle, log);

  const llmResult = await structuredLLMCall({
    schema: SynthesisLLMSchema,
    schemaName: "synthesize_hypercert",
    system: `You are assembling a hypercert payload for a funding evaluation system. Your job is to produce an honest, evidence-grounded summary of a project's impact.

Rules:
- Base description and evaluatorSummary ONLY on verified claims and observable evidence (GitHub activity, live URLs).
- Do NOT repeat claims that were flagged as unverified or overclaimed.
- Be specific — cite actual numbers (commits, stars, contributors, release count).
- evaluatorSummary should help a funder decide whether this project's impact claims are credible. Mention what was flagged and why.
- If GitHub activity is low (0 commits in 90d), note this explicitly.
- impactCategory must only contain values from the allowed list.`,
    user: `Project: ${project.name}
${project.description ? `Submission description: ${project.description}` : ""}

${context}`,
    temperature: 0.2,
  });

  const { start, end } = buildTimeframe(bundle);

  // storachaRefs require both CIDs — use fallbacks if upload failed upstream
  const evidenceBundleCid = project.evidenceBundleCid ?? "unavailable";
  const adversarialLogCid = project.adversarialLogCid ?? "unavailable";

  const payload: HypercertPayload = {
    title: project.name,
    description: llmResult.description,
    contributors: buildContributors(bundle),
    timeframeStart: start,
    timeframeEnd: end,
    impactCategory: llmResult.impactCategory,
    workScopes: llmResult.workScopes,
    evidenceRefs: [
      {
        label: "Evidence Bundle",
        url: `https://${evidenceBundleCid}.ipfs.storacha.link`,
        storachaCid: evidenceBundleCid,
      },
      {
        label: "Adversarial Log (Signed Receipt)",
        url: `https://${adversarialLogCid}.ipfs.storacha.link`,
        storachaCid: adversarialLogCid,
      },
    ],
    verifiedClaims: buildVerifiedClaims(log),
    flaggedClaims: buildFlaggedClaims(log),
    openQuestions: buildOpenQuestions(log),
    evaluatorSummary: llmResult.evaluatorSummary,
    confidenceScore: project.confidenceScore ?? 0,
    evaluatedBy: [
      {
        agentId: process.env["SCOUT_AGENT_ID"] ?? "unregistered",
        agentRegistry: identity.agentRegistry,
        role: "scout",
        operatorWallet: identity.operatorWallet,
      },
      {
        agentId: process.env["EVIDENCE_AGENT_ID"] ?? "unregistered",
        agentRegistry: identity.agentRegistry,
        role: "evidence",
        operatorWallet: identity.operatorWallet,
      },
      {
        agentId: process.env["ADVERSARIAL_AGENT_ID"] ?? "unregistered",
        agentRegistry: identity.agentRegistry,
        role: "adversarial",
        operatorWallet: identity.operatorWallet,
      },
      {
        agentId: identity.agentId,
        agentRegistry: identity.agentRegistry,
        role: "synthesis",
        operatorWallet: identity.operatorWallet,
      },
    ],
    storachaRefs: {
      evidenceBundleCid,
      adversarialLogCid,
    },
    generatedAt: new Date().toISOString(),
  };

  return payload;
}

// ── Public Agent Entry Point ──────────────────────────────────────────────────

export type SynthesisRunResult = {
  projects: ProjectRecord[];
  payloads: HypercertPayload[];
};

export type SynthesisInput = {
  evidenceResult: EvidenceRunResult;
  adversarialResult: AdversarialRunResult;
};

export async function runSynthesisAgent(
  input: SynthesisInput,
  onEntry?: (entry: AgentLogEntry) => void
): Promise<SynthesisRunResult> {
  const identity = getSynthesisIdentity();
  const { evidenceResult, adversarialResult } = input;
  const projects = adversarialResult.projects;
  const logs = adversarialResult.logs;
  const bundles = evidenceResult.bundles;

  const { output } = await runAgent(
    "synthesis",
    identity,
    input,
    `Synthesize hypercert payloads for ${projects.length} projects`,
    async (_input, ctx) => {
      ctx.logger.log("info", "discover", "synthesis:start", { projectCount: projects.length });

      const sem = createSemaphore(CONCURRENCY);
      const updatedProjects: ProjectRecord[] = [];
      const allPayloads: HypercertPayload[] = [];

      await Promise.all(
        projects.map((project, i) =>
          sem(async () => {
            const bundle = bundles[i];
            const log = logs[i];

            if (!bundle || !log) {
              ctx.logger.log("warn", "plan", "synthesis:missing-inputs", { id: project.id });
              updatedProjects.push(project);
              return;
            }

            ctx.logger.log("info", "plan", "synthesis:project-start", {
              id: project.id,
              name: project.name,
              verified: log.verifiedCount,
              flagged: log.flaggedCount,
            });

            // LLM synthesis call
            ctx.logger.log("info", "execute", "synthesis:llm-start", { project: project.name });
            let payload: HypercertPayload;
            try {
              payload = (await ctx.logger.toolCall(
                "execute",
                "synthesize_hypercert",
                { project: project.name },
                () => synthesizeProject(project, bundle, log, identity)
              )) as HypercertPayload;
              ctx.logger.log("info", "execute", "synthesis:llm-done", {
                project: project.name,
                categories: payload.impactCategory.join(", "),
                confidence: payload.confidenceScore,
              });
            } catch (err) {
              ctx.logger.log("error", "execute", "synthesis:llm-failed", {
                name: project.name,
                error: err instanceof Error ? err.message : String(err),
              });
              updatedProjects.push(project);
              return;
            }

            // Store on Storacha
            ctx.logger.log("info", "submit", "synthesis:storing-payload", { id: project.id });
            let updatedProject = project;
            try {
              const { cid } = await uploadJSON(payload, `hypercert-${project.id}.json`);
              payload.storachaRefs.hypercertPayloadCid = cid;
              updatedProject = { ...project, hypercertPayloadCid: cid, lastUpdated: new Date().toISOString() };
              ctx.logger.log("info", "submit", "synthesis:payload-stored", {
                id: project.id,
                cid,
                verifiedClaims: payload.verifiedClaims.length,
                flaggedClaims: payload.flaggedClaims.length,
                confidence: payload.confidenceScore,
              });
            } catch (uploadErr) {
              ctx.logger.log("error", "submit", "synthesis:store-failed", {
                id: project.id,
                error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
              });
            }

            // Publish to Hypercerts ATProto network
            ctx.logger.log("info", "submit", "synthesis:hypercerts-publish-start", { id: project.id });
            try {
              const atproto = await publishHypercert(payload);
              if (atproto) {
                payload.atproto = atproto;
                ctx.logger.log("info", "submit", "synthesis:hypercerts-published", {
                  id: project.id,
                  activityUri: atproto.activityUri,
                  hyperscanUrl: atproto.hyperscanUrl,
                });

                // Re-upload payload now that atproto data is populated, so the
                // stored JSON reflects the full, final state (including ATProto refs).
                try {
                  const { cid: finalCid } = await uploadJSON(payload, `hypercert-${project.id}.json`);
                  payload.storachaRefs.hypercertPayloadCid = finalCid;
                  updatedProject = { ...updatedProject, hypercertPayloadCid: finalCid, lastUpdated: new Date().toISOString() };
                  ctx.logger.log("info", "submit", "synthesis:payload-updated", { id: project.id, cid: finalCid });
                } catch (reUploadErr) {
                  ctx.logger.log("warn", "submit", "synthesis:payload-update-failed", {
                    id: project.id,
                    error: reUploadErr instanceof Error ? reUploadErr.message : String(reUploadErr),
                  });
                }
              } else {
                ctx.logger.log("warn", "submit", "synthesis:hypercerts-skipped", {
                  id: project.id,
                  reason: "HYPERCERTS_HANDLE or HYPERCERTS_APP_PASSWORD not set",
                });
              }
            } catch (publishErr) {
              ctx.logger.log("error", "submit", "synthesis:hypercerts-failed", {
                id: project.id,
                error: publishErr instanceof Error ? publishErr.message : String(publishErr),
              });
            }

            updatedProjects.push(updatedProject);
            allPayloads.push(payload);
          })
        )
      );

      const withCid = updatedProjects.filter((p) => p.hypercertPayloadCid).length;
      ctx.logger.log("info", "verify", "synthesis:summary", {
        total: projects.length,
        withCid,
        avgConfidence:
          Math.round(
            (allPayloads.reduce((s, p) => s + p.confidenceScore, 0) /
              Math.max(1, allPayloads.length)) *
              100
          ) / 100,
      });

      return {
        output: { projects: updatedProjects, payloads: allPayloads },
        summary: `Generated hypercert payloads for ${withCid}/${projects.length} projects`,
        confidence: withCid / Math.max(1, projects.length),
      };
    },
    { maxDurationMs: 20 * 60 * 1000, ...(onEntry !== undefined ? { onEntry } : {}) }
  );

  return output;
}
