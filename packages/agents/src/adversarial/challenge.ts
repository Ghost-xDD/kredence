/**
 * LLM-based adversarial challenge engine.
 *
 * One structured LLM call per project evaluates ALL extracted claims at once
 * against ALL available evidence. This is intentionally a single call (not per-claim)
 * so the LLM can reason across claims — e.g. spot that a contributor claim is
 * contradicted by the GitHub activity section it already read.
 *
 * Challenge types (from @credence/types):
 *   vague-metric  — claim lacks a specific, measurable outcome
 *   attribution   — claimed contributor cannot be verified from commit/PR history
 *   consistency   — claim appears only in self-reported text, not corroborated elsewhere
 *   deployment    — claimed deployment is unreachable or unverifiable
 *   overclaim     — claimed impact scope exceeds what the observable evidence supports
 *   dead-link     — referenced URL is unreachable (isLive: false or statusCode 0)
 *
 * Outcome:
 *   verified    — claim is supported by at least one independent, observable source
 *   flagged     — claim is contradicted or unsupported — objectionText is required
 *   unresolved  — cannot confirm or deny with available evidence
 */
import { z } from "zod";
import { structuredLLMCall } from "../llm.js";
import type { AdversarialLogEntry, EvidenceBundle, ExtractedClaim, ProjectRecord } from "@credence/types";

const ChallengeResultSchema = z.object({
  challenges: z.array(
    z.object({
      claimId: z.string().describe("Must match the claimId from the input exactly"),
      challengeType: z.enum([
        "vague-metric",
        "attribution",
        "consistency",
        "deployment",
        "overclaim",
        "dead-link",
      ]),
      challengeEvidence: z
        .string()
        .describe(
          "What you found (or didn't find) in the evidence that supports or undermines this claim"
        ),
      outcome: z.enum(["verified", "flagged", "unresolved"]),
      objectionText: z
        .string()
        .nullable()
        .describe(
          "Required when outcome is flagged or unresolved. Null when verified. Must cite specific evidence."
        ),
    })
  ),
});

function buildEvidenceSummary(bundle: EvidenceBundle): string {
  const parts: string[] = [];

  if (bundle.github) {
    const g = bundle.github;
    const ageMs = g.createdAt ? Date.now() - new Date(g.createdAt).getTime() : null;
    const ageDays = ageMs !== null ? Math.floor(ageMs / (1000 * 60 * 60 * 24)) : null;
    const ageLabel =
      ageDays === null
        ? "unknown"
        : ageDays <= 14
          ? `${ageDays} days (created for this hackathon)`
          : ageDays <= 90
            ? `${ageDays} days (recently created)`
            : `${Math.floor(ageDays / 30)} months (pre-existing)`;

    parts.push(`### GitHub (independently verified)
Repository: ${g.repoUrl}
Age: ${ageLabel}
Stars: ${g.stars} | Forks: ${g.forks}
Commits (last 90d): ${g.commitCount90d}
Merged PRs (last 90d): ${g.mergedPRCount90d}
Closed issues (last 90d): ${g.closedIssueCount90d}
Contributors (${g.contributors.length}): ${
      g.contributors.length > 0
        ? g.contributors.map((c) => `${c.login} (${c.contributions} commits)`).join(", ")
        : "none listed"
    }
Topics: ${g.topics.join(", ") || "none"}
Releases: ${g.releases.map((r) => r.tag).join(", ") || "none"}
Last push: ${g.pushedAt || "unknown"}
README: ${g.readmeContent ? `${g.readmeContent.slice(0, 2000)}` : "not present"}`);
  }

  if (bundle.website) {
    const w = bundle.website;
    parts.push(`### Website (${w.url})
Status: ${w.isLive ? `live (HTTP ${w.statusCode})` : `UNREACHABLE (HTTP ${w.statusCode})`}
Title: ${w.title ?? "none"}
Description: ${w.description ?? "none"}
Content excerpt: ${w.bodyText.slice(0, 800) || "no text content"}`);
  } else {
    parts.push(`### Website
No website source collected.`);
  }

  if (bundle.onchain) {
    const o = bundle.onchain;
    parts.push(`### Onchain (chain ${o.chainId})
Address: ${o.address}
Is deployed contract: ${o.isVerifiedContract}
Transaction count: ${o.transactionCount}`);
  }

  if (bundle.sourcesFailed.length > 0) {
    parts.push(
      `### Failed sources\n${bundle.sourcesFailed.map((f) => `- ${f.url}: ${f.reason}`).join("\n")}`
    );
  }

  return parts.join("\n\n");
}

function buildClaimsBlock(claims: ExtractedClaim[]): string {
  return claims
    .map(
      (c, i) =>
        `[${i + 1}] claimId=${c.id}\n` +
        `    text: "${c.text}"\n` +
        `    source: ${c.source} | sourceType: ${c.sourceType} | isSelfReported: ${c.isSelfReported}`
    )
    .join("\n\n");
}

export async function challengeClaims(
  project: Pick<ProjectRecord, "id" | "name" | "description">,
  bundle: EvidenceBundle
): Promise<AdversarialLogEntry[]> {
  const claims = bundle.extractedClaims;
  if (claims.length === 0) return [];

  const evidenceSummary = buildEvidenceSummary(bundle);
  const claimsBlock = buildClaimsBlock(claims);
  const claimIds = claims.map((c) => c.id);

  const result = await structuredLLMCall({
    schema: ChallengeResultSchema,
    schemaName: "challenge_claims",
    system: `You are an adversarial impact evaluator running structured challenges on project claims.

Your job is to evaluate each claim against all available evidence and assign:
- A challenge type (the most relevant concern for this claim)
- An outcome: verified, flagged, or unresolved
- An objection (required when flagged or unresolved — must cite specific evidence)

CHALLENGE TYPE GUIDE:
• vague-metric    — the claim mentions impact but uses no specific, measurable number or methodology
• attribution     — a contributor or team size claim cannot be verified from GitHub commit/PR history
• consistency     — claim appears only in self-reported text (README/website) with no independent corroboration
• deployment      — claims live deployment but website is unreachable, or contract address is unverifiable
• overclaim       — claimed scope or impact is disproportionate to observable activity (e.g. "thousands of users" with 0 GitHub stars)
• dead-link       — a referenced URL is unreachable (HTTP 0 or non-200 status code)

OUTCOME RULES:
• verified     — at least one independently observable source (GitHub activity, live URL, onchain data) corroborates the claim
• flagged      — the claim is contradicted by evidence, or a deployment/metric claim has no observable backing. objectionText is REQUIRED and must cite specific numbers or facts from the evidence.
• unresolved   — the claim is plausible but cannot be confirmed or denied with available sources. objectionText is REQUIRED explaining what would be needed to verify.

CRITICAL RULES:
1. Every claimId in the input MUST appear exactly once in your output.
2. Do NOT rubber-stamp self-reported claims as verified. isSelfReported=true means the claim comes from the project's own words — it requires independent corroboration to be verified.
3. A claim like "actively developed" with 0 commits in 90 days should be flagged as overclaim.
4. A website with isLive=false should cause any "live demo" claim to be flagged as dead-link or deployment.
5. Contributor count claims must match GitHub's contributor list — not the team self-reported on the submission.
6. objectionText must be a complete sentence citing specific numbers. "No evidence found" is not acceptable.`,
    user: `Project: ${project.name}${project.description ? `\nDescription: ${project.description}` : ""}

## Evidence
${evidenceSummary}

## Claims to Challenge
${claimsBlock}

Challenge every claim. Return one entry per claimId. IDs to cover: ${claimIds.join(", ")}`,
    temperature: 0.1,
  });

  // Guarantee one entry per claimId — fill in unresolved for anything the LLM missed
  const byId = new Map(result.challenges.map((c) => [c.claimId, c]));
  return claims.map((claim): AdversarialLogEntry => {
    const challenge = byId.get(claim.id);
    if (!challenge) {
      return {
        claimId: claim.id,
        claimText: claim.text,
        challengeType: "consistency",
        challengeEvidence: "LLM did not produce a challenge entry for this claim.",
        outcome: "unresolved",
        objectionText: "This claim was not evaluated — treat as unresolved pending manual review.",
      };
    }
    return {
      claimId: claim.id,
      claimText: claim.text,
      challengeType: challenge.challengeType,
      challengeEvidence: challenge.challengeEvidence,
      outcome: challenge.outcome,
      objectionText: challenge.objectionText,
    };
  });
}
