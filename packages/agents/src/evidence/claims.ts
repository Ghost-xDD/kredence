/**
 * LLM-based claim extractor.
 *
 * Given an evidence bundle and project metadata, uses a structured LLM call
 * to extract concrete, verifiable (or challengeable) claims.
 * These claims feed directly into the Adversarial Agent.
 */
import { z } from "zod";
import { nanoid } from "nanoid";
import { structuredLLMCall } from "../llm.js";
import type { EvidenceBundle, ExtractedClaim, ProjectRecord } from "@credence/types";

const ClaimsSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string().describe("The claim as stated or strongly implied — one sentence"),
      source: z
        .string()
        .describe(
          "Which source this comes from (e.g. 'README', 'project website', 'GitHub description')"
        ),
      sourceType: z.enum(["github", "website", "onchain", "document", "submission-page"]),
      isSelfReported: z
        .boolean()
        .describe(
          "True if from README, submission description, or project website — not independently verifiable from activity data"
        ),
    })
  ),
});

type ClaimsInput = Omit<EvidenceBundle, "extractedClaims">;

export async function extractClaims(
  bundle: ClaimsInput,
  project: Pick<ProjectRecord, "id" | "name" | "description">
): Promise<ExtractedClaim[]> {
  const parts: string[] = [];

  if (project.description) {
    parts.push(`## Project Submission Description\n${project.description}`);
  }

  if (bundle.github) {
    if (bundle.github.description) {
      parts.push(`## GitHub Repository Description\n${bundle.github.description}`);
    }
    if (bundle.github.readmeContent) {
      parts.push(`## README\n${bundle.github.readmeContent.slice(0, 4000)}`);
    }

    // Derive repo age context
    const repoAgeLabel = (() => {
      if (!bundle.github.createdAt) return "unknown";
      const ageMs = Date.now() - new Date(bundle.github.createdAt).getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      if (ageDays <= 14) return `${ageDays} days old (created for this hackathon)`;
      if (ageDays <= 90) return `${ageDays} days old (recently created)`;
      return `${Math.floor(ageDays / 30)} months old (pre-existing project)`;
    })();

    const activitySummary = [
      `Repository age: ${repoAgeLabel} (created: ${bundle.github.createdAt})`,
      `Stars: ${bundle.github.stars}`,
      `Forks: ${bundle.github.forks}`,
      `Commits (last 90 days): ${bundle.github.commitCount90d}`,
      `Merged PRs (last 90 days): ${bundle.github.mergedPRCount90d}`,
      `Closed issues (last 90 days): ${bundle.github.closedIssueCount90d}`,
      `Contributors: ${bundle.github.contributors.length} (${bundle.github.contributors.map((c) => `${c.login} (${c.contributions} commits)`).join(", ") || "none"})`,
      `Topics: ${bundle.github.topics.join(", ") || "none"}`,
      `Releases: ${bundle.github.releases.map((r) => r.tag).join(", ") || "none"}`,
      `Last push: ${bundle.github.pushedAt || "unknown"}`,
    ].join("\n");
    parts.push(`## GitHub Activity (INDEPENDENTLY VERIFIED — not self-reported)\n${activitySummary}`);
  }

  if (bundle.website) {
    const websiteContent = [
      bundle.website.title ? `Title: ${bundle.website.title}` : null,
      bundle.website.description ? `Meta description: ${bundle.website.description}` : null,
      bundle.website.bodyText ? `Body text:\n${bundle.website.bodyText.slice(0, 2000)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (websiteContent) {
      parts.push(
        `## Project Website (${bundle.website.url}) — Live: ${bundle.website.isLive}\n${websiteContent}`
      );
    }
  }

  if (bundle.onchain) {
    parts.push(
      `## Onchain Activity\nAddress: ${bundle.onchain.address}\nChain ID: ${bundle.onchain.chainId}\nTransaction count: ${bundle.onchain.transactionCount}\nIs deployed contract: ${bundle.onchain.isVerifiedContract}`
    );
  }

  if (parts.length === 0) {
    return [];
  }

  const context = parts.join("\n\n---\n\n");

  const result = await structuredLLMCall({
    schema: ClaimsSchema,
    schemaName: "extract_claims",
    system: `You are an adversarial impact evaluator. Your job is to extract specific, concrete claims from project evidence so they can be independently verified or challenged.

Focus on claims about:
- Impact metrics (users, transactions, TVL, adoption numbers, integrations)
- Technical capabilities ("supports X", "integrates with Y", "deployed on Z network")
- Team and contributor claims ("built by N contributors", "team of X people")
- Deployment and production status ("live", "in production", "deployed at address 0x...")
- Usage and adoption claims ("X users", "Y transactions processed")
- Problem-solving claims ("enables X", "solves Y problem for Z users")

Rules:
- Each claim must be a single, specific assertion
- Extract only claims that could be verified or challenged with evidence
- Do NOT include vague platitudes like "great UX" or "powerful tool"
- Mark isSelfReported=true for claims that come only from README, website, or submission description (not from GitHub activity data or onchain data)
- Extract 5–10 of the most important claims

Return exactly the JSON object with a "claims" array.`,
    user: `Project: ${project.name}\n\n${context}`,
    temperature: 0.1,
  });

  return result.claims.map((c) => ({
    id: nanoid(),
    text: c.text,
    source: c.source,
    sourceType: c.sourceType,
    isSelfReported: c.isSelfReported,
  }));
}
