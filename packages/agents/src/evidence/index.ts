/**
 * Evidence Agent — autonomous evidence collection and normalization.
 *
 * Input:  ProjectManifest from Scout Agent
 * Output: Updated ProjectRecord[] (with evidenceBundleCid) + EvidenceBundle[]
 *
 * For each project:
 *   1. Collect GitHub signals (commits, PRs, issues, contributors, README)
 *   2. Collect website signals (title, description, liveness, body text)
 *   3. Collect onchain signals if a contract address is present
 *   4. Extract structured claims via LLM
 *   5. Store EvidenceBundle on Storacha and attach CID to ProjectRecord
 *
 * Projects are processed in parallel (bounded by CONCURRENCY).
 * Failures in individual sources are logged and do not block other sources.
 */
import type { EvidenceBundle, ProjectManifest, ProjectRecord } from "@credence/types";
import { runAgent, type AgentContext } from "../runner.js";
import { uploadJSON } from "@credence/storage";
import { getOperatorWallet } from "../identity.js";
import { collectGitHubEvidence } from "./github.js";
import { collectWebsiteEvidence } from "./website.js";
import { collectOnchainEvidence } from "./onchain.js";
import { extractClaims } from "./claims.js";

const CONCURRENCY = 3; // max parallel projects (GitHub API: 5,000 req/hr authenticated)

function getEvidenceIdentity() {
  return {
    agentId: process.env["EVIDENCE_AGENT_ID"] ?? "unregistered",
    agentRegistry: `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`,
    operatorWallet: getOperatorWallet(),
  };
}

// ── Concurrency semaphore ────────────────────────────────────────────────────

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

// ── Per-project evidence collection ─────────────────────────────────────────

async function collectProjectEvidence(
  project: ProjectRecord,
  ctx: AgentContext
): Promise<EvidenceBundle> {
  const collectedAt = new Date().toISOString();
  const sourcesFailed: EvidenceBundle["sourcesFailed"] = [];

  // Intermediate state (claims extracted at the end)
  let github: EvidenceBundle["github"];
  let website: EvidenceBundle["website"];
  let onchain: EvidenceBundle["onchain"];

  // ── GitHub ─────────────────────────────────────────────────────────────────
  const githubSource = project.sources.find((s) => s.type === "github");
  if (githubSource) {
    ctx.logger.log("info", "execute", "evidence:github:start", { url: githubSource.url });
    try {
      github = (await ctx.logger.toolCall(
        "execute",
        "collect_github_evidence",
        { url: githubSource.url },
        () => collectGitHubEvidence(githubSource.url)
      )) as Awaited<ReturnType<typeof collectGitHubEvidence>>;
      ctx.logger.log("info", "execute", "evidence:github:done", {
        stars: github.stars,
        commits90d: github.commitCount90d,
        contributors: github.contributors.length,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      sourcesFailed.push({ url: githubSource.url, reason });
      ctx.logger.log("warn", "execute", "evidence:github:failed", {
        url: githubSource.url,
        reason,
      });
    }
  }

  // ── Website(s) ─────────────────────────────────────────────────────────────
  // Prefer the first live website; fall back to first available
  const websiteSources = project.sources.filter((s) => s.type === "website");
  for (const ws of websiteSources.slice(0, 2)) {
    ctx.logger.log("info", "execute", "evidence:website:start", { url: ws.url });
    try {
      const signals = (await ctx.logger.toolCall(
        "execute",
        "collect_website_evidence",
        { url: ws.url },
        () => collectWebsiteEvidence(ws.url)
      )) as Awaited<ReturnType<typeof collectWebsiteEvidence>>;

      // Prefer a live website over a dead one
      if (!website || signals.isLive) {
        website = signals;
      }
      ctx.logger.log("info", "execute", "evidence:website:done", {
        url: ws.url,
        isLive: signals.isLive,
        statusCode: signals.statusCode,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      sourcesFailed.push({ url: ws.url, reason });
      ctx.logger.log("warn", "execute", "evidence:website:failed", { url: ws.url, reason });
    }
  }

  // ── Onchain ────────────────────────────────────────────────────────────────
  const onchainSource = project.sources.find((s) => s.type === "onchain");
  if (onchainSource) {
    ctx.logger.log("info", "execute", "evidence:onchain:start", { url: onchainSource.url });
    try {
      onchain = (await ctx.logger.toolCall(
        "execute",
        "collect_onchain_evidence",
        { url: onchainSource.url },
        () => collectOnchainEvidence(onchainSource.url)
      )) as Awaited<ReturnType<typeof collectOnchainEvidence>>;
      ctx.logger.log("info", "execute", "evidence:onchain:done", {
        txCount: onchain.transactionCount,
        isContract: onchain.isVerifiedContract,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      sourcesFailed.push({ url: onchainSource.url, reason });
      ctx.logger.log("warn", "execute", "evidence:onchain:failed", {
        url: onchainSource.url,
        reason,
      });
    }
  }

  // ── LLM Claim Extraction ───────────────────────────────────────────────────
  // Build the partial bundle, only including optional fields when they have values
  const bundleWithoutClaims: Omit<EvidenceBundle, "extractedClaims"> = {
    projectId: project.id,
    collectedAt,
    ...(github !== undefined && { github }),
    ...(website !== undefined && { website }),
    ...(onchain !== undefined && { onchain }),
    sourcesFailed,
  };

  let extractedClaims: EvidenceBundle["extractedClaims"] = [];
  ctx.logger.log("info", "execute", "evidence:claims:start", { project: project.name });
  try {
    extractedClaims = (await ctx.logger.toolCall(
      "execute",
      "extract_claims",
      { project: project.name },
      () => extractClaims(bundleWithoutClaims, project)
    )) as Awaited<ReturnType<typeof extractClaims>>;
    ctx.logger.log("info", "execute", "evidence:claims:done", {
      claimCount: extractedClaims.length,
    });
  } catch (err) {
    ctx.logger.log("warn", "execute", "evidence:claims:failed", {
      reason: err instanceof Error ? err.message : String(err),
    });
    extractedClaims = [];
  }

  return { ...bundleWithoutClaims, extractedClaims };
}

// ── Public Agent Entry Point ─────────────────────────────────────────────────

export type EvidenceRunResult = {
  projects: ProjectRecord[];
  bundles: EvidenceBundle[];
};

export async function runEvidenceAgent(manifest: ProjectManifest): Promise<EvidenceRunResult> {
  const identity = getEvidenceIdentity();

  const { output } = await runAgent(
    "evidence",
    identity,
    manifest,
    `Collect evidence for ${manifest.projects.length} projects from ${manifest.ecosystemInput.kind} ecosystem`,
    async (projectManifest, ctx) => {
      ctx.logger.log("info", "discover", "evidence:start", {
        projectCount: projectManifest.projects.length,
        ecosystemKind: projectManifest.ecosystemInput.kind,
      });

      const sem = createSemaphore(CONCURRENCY);
      const updatedProjects: ProjectRecord[] = [];
      const allBundles: EvidenceBundle[] = [];

      await Promise.all(
        projectManifest.projects.map((project) =>
          sem(async () => {
            ctx.logger.log("info", "plan", "evidence:project-start", {
              id: project.id,
              name: project.name,
            });

            let bundle: EvidenceBundle;
            try {
              bundle = await collectProjectEvidence(project, ctx);
            } catch (err) {
              ctx.logger.log("error", "execute", "evidence:project-failed", {
                name: project.name,
                error: err instanceof Error ? err.message : String(err),
              });
              // Minimal bundle on complete agent failure
              bundle = {
                projectId: project.id,
                collectedAt: new Date().toISOString(),
                extractedClaims: [],
                sourcesFailed: project.sources.map((s) => ({
                  url: s.url,
                  reason: "agent error — collection skipped",
                })),
              };
            }

            // Persist bundle to Storacha
            ctx.logger.log("info", "submit", "evidence:storing-bundle", {
              projectId: project.id,
            });
            try {
              const { cid } = await uploadJSON(bundle, `evidence-${project.id}.json`);
              const updatedProject: ProjectRecord = {
                ...project,
                evidenceBundleCid: cid,
                lastUpdated: new Date().toISOString(),
              };
              updatedProjects.push(updatedProject);
              allBundles.push(bundle);
              ctx.logger.log("info", "submit", "evidence:bundle-stored", {
                projectId: project.id,
                cid,
                claimCount: bundle.extractedClaims.length,
                sourcesOk:
                  project.sources.length - bundle.sourcesFailed.length,
                sourcesFailed: bundle.sourcesFailed.length,
              });
            } catch (uploadErr) {
              ctx.logger.log("error", "submit", "evidence:bundle-store-failed", {
                projectId: project.id,
                error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
              });
              // Keep going — attach bundle without CID
              updatedProjects.push({ ...project, lastUpdated: new Date().toISOString() });
              allBundles.push(bundle);
            }
          })
        )
      );

      const successCount = updatedProjects.filter((p) => p.evidenceBundleCid).length;
      ctx.logger.log("info", "verify", "evidence:summary", {
        total: projectManifest.projects.length,
        withCid: successCount,
        failed: projectManifest.projects.length - successCount,
      });

      return {
        output: { projects: updatedProjects, bundles: allBundles },
        summary: `Collected evidence for ${successCount}/${projectManifest.projects.length} projects`,
        confidence: successCount / Math.max(1, projectManifest.projects.length),
      };
    },
    { maxDurationMs: 20 * 60 * 1000 } // 20 min for large ecosystems
  );

  return output;
}
