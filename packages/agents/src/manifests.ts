import type { AgentManifest, AgentRole } from "@credence/types";
import { AGENT_REGISTRY_PREFIX } from "./identity.js";

/**
 * Generate an agent.json manifest for a given agent role.
 * agentId is populated after ERC-8004 registration.
 */
export function buildAgentManifest(
  role: AgentRole,
  agentId: string,
  operatorWallet: string,
  agentURI: string
): AgentManifest {
  const base: Omit<AgentManifest, "name" | "description" | "supportedTools" | "supportedTaskCategories"> = {
    version: "0.1.0",
    agentId,
    agentRegistry: `${AGENT_REGISTRY_PREFIX}`,
    operatorWallet,
    role,
    computeConstraints: {
      maxDurationMs: 5 * 60 * 1000,
      maxLlmCalls: 20,
      maxExternalRequests: 100,
    },
    services: [
      {
        type: "agentURI",
        url: agentURI,
      },
    ],
  };

  switch (role) {
    case "scout":
      return {
        ...base,
        name: "Credence Scout Agent",
        description:
          "Autonomously discovers all projects in a target funding ecosystem (Devspot hackathon, Filecoin Dev Grants, ETHGlobal showcase, or manual URL list) without requiring manual submission.",
        supportedTools: ["devspot-scraper", "github-issues-api", "ethglobal-scraper", "url-fetcher"],
        supportedTaskCategories: ["ecosystem-discovery", "project-enumeration"],
      };
    case "evidence":
      return {
        ...base,
        name: "Credence Evidence Agent",
        description:
          "Collects and normalizes evidence for each discovered project from GitHub repositories, demo URLs, and onchain activity. Extracts implied claims using structured LLM analysis.",
        supportedTools: ["github-rest-api", "web-fetcher", "evm-rpc", "llm-structured"],
        supportedTaskCategories: ["evidence-collection", "claim-extraction"],
      };
    case "adversarial":
      return {
        ...base,
        name: "Credence Adversarial Agent",
        description:
          "Challenges every extracted impact claim by searching for counter-evidence. Flags vague metrics, unverifiable attribution, dead links, and overclaiming. Produces signed objection receipts.",
        supportedTools: ["github-rest-api", "web-fetcher", "evm-rpc", "llm-structured"],
        supportedTaskCategories: ["claim-verification", "adversarial-evaluation", "receipt-generation"],
      };
    case "synthesis":
      return {
        ...base,
        name: "Credence Synthesis Agent",
        description:
          "Assembles the final hypercert-ready payload from verified evidence and adversarial output. Produces a confidence-weighted impact record with full evidence provenance.",
        supportedTools: ["llm-structured", "storacha-storage"],
        supportedTaskCategories: ["hypercert-generation", "impact-synthesis"],
      };
  }
}
