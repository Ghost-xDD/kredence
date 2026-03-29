/**
 * Scout Agent — autonomous ecosystem discovery.
 *
 * Uses LangChain's tool-calling pattern: the agent is given a set of
 * discovery tools and selects the right one based on the EcosystemInput kind.
 * For hackathon scope, tool selection is deterministic (not LLM-driven),
 * but the project normalization step uses structured LLM output.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import type { AgentLogEntry, EcosystemInput, ProjectManifest, ProjectRecord } from "@credence/types";
import { runAgent } from "../runner.js";
import { scrapeDevspot } from "./devspot.js";
import { fetchFilecoinDevGrants } from "./filecoin-devgrants.js";
import { scrapeChainlinkHackathon } from "./chainlink-hackathon.js";
import { scrapeDevfolio } from "./devfolio.js";
import { fetchGitcoinRound } from "./gitcoin.js";
import { fetchOctantProjects } from "./octant.js";
import { scrapeEthGlobal } from "./ethglobal.js";
import { uploadJSON } from "@credence/storage";
import { getOperatorWallet } from "../identity.js";

// ── LangChain Tools ────────────────────────────────────────────────────────

const devspotTool = tool(
  async ({ url }: { url: string }) => {
    const projects = await scrapeDevspot(url);
    return JSON.stringify(projects);
  },
  {
    name: "scrape_devspot_hackathon",
    description:
      "Scrape all project submissions from a Devspot hackathon page. Input must be the full URL including ?activeTab=projects.",
    schema: z.object({
      url: z.string().url().describe("Devspot hackathon projects page URL"),
    }),
  }
);

const filecoinDevGrantsTool = tool(
  async ({ repo, labels }: { repo: string; labels?: string[] }) => {
    const projects = await fetchFilecoinDevGrants(repo, labels ?? []);
    return JSON.stringify(projects);
  },
  {
    name: "fetch_filecoin_dev_grants",
    description:
      "Fetch grant projects from a GitHub issues-based grants repository (e.g. filecoin-project/devgrants). Returns structured project list.",
    schema: z.object({
      repo: z.string().describe("GitHub repo in owner/repo format"),
      labels: z.array(z.string()).optional().describe("Optional label filters"),
    }),
  }
);

const manualUrlTool = tool(
  async ({ urls }: { urls: string[] }) => {
    const projects = urls.map((url, i) => ({
      id: `manual-${i}`,
      ecosystemKind: "manual",
      name: url,
      description: undefined,
      team: [],
      sources: [{ type: "website" as const, url }],
    }));
    return JSON.stringify(projects);
  },
  {
    name: "process_manual_urls",
    description: "Process a manual list of project URLs into a project manifest.",
    schema: z.object({
      urls: z.array(z.string().url()).describe("List of project URLs"),
    }),
  }
);

const chainlinkHackathonTool = tool(
  async ({ galleryUrl, maxProjects }: { galleryUrl: string; maxProjects?: number }) => {
    const projects = await scrapeChainlinkHackathon(galleryUrl, maxProjects);
    return JSON.stringify(projects);
  },
  {
    name: "scrape_chainlink_hackathon",
    description:
      "Scrape Chainlink Convergence hackathon gallery and project detail pages into normalized project records.",
    schema: z.object({
      galleryUrl: z.string().url().describe("Chainlink hackathon gallery URL"),
      maxProjects: z.number().int().positive().optional().describe("Optional cap on detail pages to fetch"),
    }),
  }
);

const devfolioTool = tool(
  async ({ hackathonSlug }: { hackathonSlug: string }) => {
    const projects = await scrapeDevfolio(hackathonSlug);
    return JSON.stringify(projects);
  },
  {
    name: "scrape_devfolio_hackathon",
    description:
      "Fetch all projects from a Devfolio hackathon by subdomain slug (e.g. 'ethbangkok').",
    schema: z.object({
      hackathonSlug: z.string().describe("Devfolio hackathon subdomain slug"),
    }),
  }
);

const gitcoinTool = tool(
  async ({ roundId, chainId }: { roundId: string; chainId?: number }) => {
    const projects = await fetchGitcoinRound(roundId, chainId);
    return JSON.stringify(projects);
  },
  {
    name: "fetch_gitcoin_round",
    description:
      "Fetch grant applications from a Gitcoin Grants Stack round using the public indexer.",
    schema: z.object({
      roundId: z.string().describe("Grants round contract address"),
      chainId: z.number().int().positive().optional().describe("Chain ID (default: 42161 Arbitrum)"),
    }),
  }
);

const octantTool = tool(
  async ({ epochNumber }: { epochNumber?: number }) => {
    const projects = await fetchOctantProjects(epochNumber);
    return JSON.stringify(projects);
  },
  {
    name: "fetch_octant_projects",
    description:
      "Fetch funded projects from Octant's public-goods funding platform for a given epoch.",
    schema: z.object({
      epochNumber: z.number().int().positive().optional().describe("Epoch number (omit for latest)"),
    }),
  }
);

const ethglobalTool = tool(
  async ({ eventSlug, maxProjects }: { eventSlug: string; maxProjects?: number }) => {
    const projects = await scrapeEthGlobal(eventSlug, maxProjects);
    return JSON.stringify(projects);
  },
  {
    name: "scrape_ethglobal_showcase",
    description:
      "Scrape all project submissions from an ETHGlobal hackathon showcase page. Input is the event slug (e.g. 'hackmoney2026', 'bangkok').",
    schema: z.object({
      eventSlug: z.string().describe("ETHGlobal event slug, e.g. 'hackmoney2026'"),
      maxProjects: z.number().int().positive().optional().describe("Optional cap on projects to fetch"),
    }),
  }
);

// ── Agent Identity ─────────────────────────────────────────────────────────

function getScoutIdentity() {
  return {
    agentId: process.env["SCOUT_AGENT_ID"] ?? "unregistered",
    agentRegistry: `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`,
    operatorWallet: getOperatorWallet(),
  };
}

// ── Main Scout Agent ───────────────────────────────────────────────────────

/**
 * Run the Scout Agent for a given ecosystem input.
 * Returns a full ProjectManifest stored on Storacha.
 */
export async function runScoutAgent(
  input: EcosystemInput,
  onEntry?: (entry: AgentLogEntry) => void
): Promise<ProjectManifest> {
  const identity = getScoutIdentity();

  const { output, agentOutput } = await runAgent(
    "scout",
    identity,
    input,
    `Discover all projects in ${input.kind} ecosystem`,
    async (ecosystemInput, ctx) => {
      ctx.logger.log("info", "discover", "scout:selecting-adapter", { kind: ecosystemInput.kind });

      let rawProjects: ProjectRecord[] = [];

      // Deterministic adapter selection based on input kind
      switch (ecosystemInput.kind) {
        case "devspot": {
          ctx.logger.log("info", "plan", "scout:adapter-devspot", { url: ecosystemInput.url });
          const result = await ctx.logger.toolCall(
            "execute",
            "scrape_devspot_hackathon",
            { url: ecosystemInput.url },
            async () => scrapeDevspot(ecosystemInput.url)
          ) as Awaited<ReturnType<typeof scrapeDevspot>>;
          rawProjects = result;
          break;
        }

        case "filecoin-devgrants": {
          ctx.logger.log("info", "plan", "scout:adapter-filecoin", { repo: ecosystemInput.repo });
          const result = await ctx.logger.toolCall(
            "execute",
            "fetch_filecoin_dev_grants",
            { repo: ecosystemInput.repo, labels: ecosystemInput.labels },
            async () => fetchFilecoinDevGrants(ecosystemInput.repo, ecosystemInput.labels)
          ) as Awaited<ReturnType<typeof fetchFilecoinDevGrants>>;
          rawProjects = result;
          break;
        }

        case "manual": {
          ctx.logger.log("info", "plan", "scout:adapter-manual", { count: ecosystemInput.urls.length });
          rawProjects = ecosystemInput.urls.map((url, i) => ({
            id: `manual-${i}`,
            ecosystemKind: "manual" as const,
            name: url,
            team: [],
            sources: [{ type: "website" as const, url }],
          }));
          break;
        }

        case "chainlink-hackathon": {
          ctx.logger.log("info", "plan", "scout:adapter-chainlink-hackathon", {
            galleryUrl: ecosystemInput.galleryUrl,
            maxProjects: ecosystemInput.maxProjects,
          });
          const result = await ctx.logger.toolCall(
            "execute",
            "scrape_chainlink_hackathon",
            { galleryUrl: ecosystemInput.galleryUrl, maxProjects: ecosystemInput.maxProjects },
            async () => scrapeChainlinkHackathon(ecosystemInput.galleryUrl, ecosystemInput.maxProjects)
          ) as Awaited<ReturnType<typeof scrapeChainlinkHackathon>>;
          rawProjects = result;
          break;
        }

        case "devfolio": {
          ctx.logger.log("info", "plan", "scout:adapter-devfolio", { hackathonSlug: ecosystemInput.hackathonSlug });
          const result = await ctx.logger.toolCall(
            "execute",
            "scrape_devfolio_hackathon",
            { hackathonSlug: ecosystemInput.hackathonSlug },
            async () => scrapeDevfolio(ecosystemInput.hackathonSlug)
          ) as Awaited<ReturnType<typeof scrapeDevfolio>>;
          rawProjects = result;
          break;
        }

        case "gitcoin": {
          ctx.logger.log("info", "plan", "scout:adapter-gitcoin", { roundId: ecosystemInput.roundId, chainId: ecosystemInput.chainId });
          const result = await ctx.logger.toolCall(
            "execute",
            "fetch_gitcoin_round",
            { roundId: ecosystemInput.roundId, chainId: ecosystemInput.chainId },
            async () => fetchGitcoinRound(ecosystemInput.roundId, ecosystemInput.chainId)
          ) as Awaited<ReturnType<typeof fetchGitcoinRound>>;
          rawProjects = result;
          break;
        }

        case "octant": {
          ctx.logger.log("info", "plan", "scout:adapter-octant", { epochNumber: ecosystemInput.epochNumber });
          const result = await ctx.logger.toolCall(
            "execute",
            "fetch_octant_projects",
            { epochNumber: ecosystemInput.epochNumber },
            async () => fetchOctantProjects(ecosystemInput.epochNumber)
          ) as Awaited<ReturnType<typeof fetchOctantProjects>>;
          rawProjects = result;
          break;
        }

        case "github-repo": {
          // Single-repo input from the GitHub App webhook — no discovery needed.
          const repoUrl = ecosystemInput.repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
          const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
          const repoName = match ? `${match[1]}/${match[2]}` : repoUrl;
          ctx.logger.log("info", "plan", "scout:adapter-github-repo", { repoUrl, repoName });
          rawProjects = [
            {
              id: `github-${repoName.replace("/", "-")}`,
              ecosystemKind: "github-repo",
              name: repoName,
              team: [],
              sources: [{ type: "github" as const, url: repoUrl }],
            },
          ];
          break;
        }

        case "ethglobal": {
          ctx.logger.log("info", "plan", "scout:adapter-ethglobal", { eventSlug: ecosystemInput.eventSlug });
          const result = await ctx.logger.toolCall(
            "execute",
            "scrape_ethglobal_showcase",
            { eventSlug: ecosystemInput.eventSlug },
            async () => scrapeEthGlobal(ecosystemInput.eventSlug)
          ) as Awaited<ReturnType<typeof scrapeEthGlobal>>;
          rawProjects = result;
          break;
        }
      }

      // Deduplicate by GitHub repo URL if the same project appears under multiple sources
      const seen = new Set<string>();
      const deduped = rawProjects.filter((p) => {
        const githubSrc = p.sources.find((s) => s.type === "github");
        const key = githubSrc?.url ?? p.name;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      ctx.logger.log("info", "verify", "scout:deduplication", {
        before: rawProjects.length,
        after: deduped.length,
      });

      const manifest: ProjectManifest = {
        ecosystemInput,
        discoveredAt: new Date().toISOString(),
        projects: deduped,
        scoutAgentId: identity.agentId,
      };

      // Store manifest on Storacha
      ctx.logger.log("info", "submit", "scout:storing-manifest");
      const { cid } = await uploadJSON(manifest, "project-manifest.json");
      manifest.storachaCid = cid;

      ctx.logger.log("info", "submit", "scout:done", {
        projectCount: deduped.length,
        manifestCid: cid,
      });

      return {
        output: manifest,
        summary: `Discovered ${deduped.length} projects from ${ecosystemInput.kind} ecosystem`,
        confidence: 1.0,
      };
    },
    { ...(onEntry !== undefined ? { onEntry } : {}) }
  );

  return output;
}

// Export tools for use in higher-level agents if needed
export const scoutTools = [
  devspotTool,
  filecoinDevGrantsTool,
  manualUrlTool,
  chainlinkHackathonTool,
  devfolioTool,
  gitcoinTool,
  octantTool,
  ethglobalTool,
];
