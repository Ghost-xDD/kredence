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
import type { EcosystemInput, ProjectManifest, ProjectRecord } from "@credence/types";
import { runAgent } from "../runner.js";
import { scrapeDevspot } from "./devspot.js";
import { fetchFilecoinDevGrants } from "./filecoin-devgrants.js";
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
export async function runScoutAgent(input: EcosystemInput): Promise<ProjectManifest> {
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

        case "ethglobal": {
          ctx.logger.log("warn", "plan", "scout:adapter-ethglobal-not-implemented", {
            eventSlug: ecosystemInput.eventSlug,
          });
          throw new Error("ETHGlobal adapter not yet implemented — use manual URL list for now");
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
    }
  );

  return output;
}

// Export tools for use in higher-level agents if needed
export const scoutTools = [devspotTool, filecoinDevGrantsTool, manualUrlTool];
