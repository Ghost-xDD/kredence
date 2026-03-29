/**
 * Gitcoin Grants Stack adapter.
 *
 * Fetches grant applications from the public Gitcoin Grants Stack Indexer:
 *   https://grants-stack-indexer-v2.gitcoin.co/data/{chainId}/rounds/{roundId}/applications.json
 *
 * The indexer exposes pre-built JSON files for each round on supported chains.
 * Common chains:
 *   1    — Ethereum mainnet
 *   10   — Optimism
 *   137  — Polygon
 *   42161 — Arbitrum One (most QF rounds since GG18)
 */
import { nanoid } from "nanoid";
import type { ProjectRecord, ProjectSource } from "@credence/types";

const INDEXER_BASE = "https://grants-stack-indexer-v2.gitcoin.co/data";
const UA = "Mozilla/5.0 (compatible; Credence/0.1)";
const DEFAULT_CHAIN_ID = 42161;

type GitcoinProject = {
  title?: string;
  description?: string;
  website?: string;
  projectGithub?: string;
  projectTwitter?: string;
};

type GitcoinApplicationProject = {
  metadata?: {
    application?: {
      project?: GitcoinProject;
      recipient?: string;
    };
  };
  projectId?: string;
  status?: string;
};

export async function fetchGitcoinRound(
  roundId: string,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<ProjectRecord[]> {
  const normalizedRound = roundId.toLowerCase();
  const url = `${INDEXER_BASE}/${chainId}/rounds/${normalizedRound}/applications.json`;

  console.log(`[Scout/Gitcoin] Fetching round ${roundId} on chain ${chainId}`);
  console.log(`[Scout/Gitcoin] URL: ${url}`);

  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Gitcoin Grants Stack indexer returned HTTP ${res.status} for round "${roundId}" on chain ${chainId}. ` +
        `Verify the round ID and chain ID are correct.`
    );
  }

  const applications = (await res.json()) as GitcoinApplicationProject[];
  const resolvedAt = new Date().toISOString();

  console.log(`[Scout/Gitcoin] Found ${applications.length} applications`);

  const projects: ProjectRecord[] = [];

  for (const app of applications) {
    // Skip rejected/spam applications
    if (app.status && !["APPROVED", "IN_REVIEW", "PENDING"].includes(app.status.toUpperCase())) {
      continue;
    }

    const proj = app.metadata?.application?.project;
    if (!proj) continue;

    const name = proj.title ?? app.projectId ?? "Unknown";
    const sources: ProjectSource[] = [];

    const roundUrl = `https://explorer.gitcoin.co/#/round/${chainId}/${normalizedRound}`;
    sources.push({ type: "submission-page", url: roundUrl, resolvedAt });

    if (proj.website) {
      const type = proj.website.includes("github.com") ? "github" : "website";
      sources.push({ type, url: proj.website });
    }
    if (proj.projectGithub) {
      const ghUrl = proj.projectGithub.startsWith("http")
        ? proj.projectGithub
        : `https://github.com/${proj.projectGithub}`;
      sources.push({ type: "github", url: ghUrl });
    }

    const record: ProjectRecord = {
      id: nanoid(),
      ecosystemKind: "gitcoin",
      name,
      team: [],
      sources,
    };
    if (proj.description) record.description = proj.description.slice(0, 500);
    projects.push(record);
  }

  console.log(`[Scout/Gitcoin] Normalized ${projects.length} approved projects`);
  return projects;
}
