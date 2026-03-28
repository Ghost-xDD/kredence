/**
 * One-shot ERC-8004 identity registration for all Credence agents.
 *
 * Follows the correct 4-step flow per spec:
 *   1. register()           → mint agentId (no args, emits Registered event)
 *   2. build agent card     → JSON with registrations[] containing the new agentId
 *   3. upload to Storacha   → get CID
 *   4. setAgentURI()        → point on-chain record to the IPFS card
 *
 * Run once per deployment environment. Add the printed env vars to .env.
 *
 * Run: cd scripts && ../node_modules/.bin/tsx register-agents.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });

import { mintAgentIdentity, setAgentURI, ERC8004_CONTRACTS, explorerAgentUrl } from "../packages/agents/dist/identity.js";
import { uploadJSON } from "../packages/storage/dist/store.js";

const BASE_SEPOLIA_ID = 84532;

const AGENTS: Array<{
  role: string;
  name: string;
  description: string;
  envKey: string;
}> = [
  {
    role: "scout",
    name: "Credence Scout Agent",
    description:
      "Autonomously discovers all projects in a target funding ecosystem (Devspot hackathon, Filecoin Dev Grants, ETHGlobal, or manual URL list) without requiring manual submission.",
    envKey: "SCOUT_AGENT_ID",
  },
  {
    role: "evidence",
    name: "Credence Evidence Agent",
    description:
      "Collects and normalizes evidence for each discovered project from GitHub repositories, demo URLs, and onchain activity. Extracts implied claims using structured LLM analysis.",
    envKey: "EVIDENCE_AGENT_ID",
  },
  {
    role: "adversarial",
    name: "Credence Adversarial Agent",
    description:
      "Challenges every extracted impact claim by searching for counter-evidence. Flags vague metrics, unverifiable attribution, dead links, and overclaiming.",
    envKey: "ADVERSARIAL_AGENT_ID",
  },
  {
    role: "synthesis",
    name: "Credence Synthesis Agent",
    description:
      "Assembles the final hypercert-ready payload from verified evidence and adversarial output. Produces a confidence-weighted impact record with full evidence provenance.",
    envKey: "SYNTHESIS_AGENT_ID",
  },
];

const REGISTRY = ERC8004_CONTRACTS.identityRegistry;
const AGENT_REGISTRY = `eip155:${BASE_SEPOLIA_ID}:${REGISTRY}`;

async function main() {
  if (!process.env["OPERATOR_PRIVATE_KEY"]) {
    throw new Error("OPERATOR_PRIVATE_KEY not set in .env");
  }

  const results: Array<{ role: string; agentId: string; envKey: string; agentUrl: string }> = [];

  for (const agent of AGENTS) {
    if (process.env[agent.envKey]) {
      console.log(`\n⏭  ${agent.role} — already registered (${agent.envKey}=${process.env[agent.envKey]}), skipping`);
      continue;
    }

    console.log(`\n── Registering ${agent.role} agent ──`);

    // Step 1: Mint identity on-chain → get agentId
    console.log("  Step 1: Minting identity on Base Sepolia…");
    const { agentId, txHash } = await mintAgentIdentity();
    console.log(`  Agent ID: ${agentId}  (tx: ${txHash})`);

    // Step 2: Build ERC-8004 agent card with registrations[]
    const agentCard = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: agent.name,
      description: agent.description,
      image: "ipfs://bafkreiaims435hmzeg3l6ixlrlvnei7wept5kmfd6c2ncz3ucl466xhucu",
      services: [],
      registrations: [
        {
          agentId: Number(agentId),
          agentRegistry: AGENT_REGISTRY,
        },
      ],
      supportedTrust: ["reputation"],
    };

    // Step 3: Upload agent card to Storacha
    console.log("  Step 2: Uploading agent card to Storacha…");
    const { cid } = await uploadJSON(agentCard, `agent-card-${agent.role}.json`);
    const agentURI = `ipfs://${cid}`;
    console.log(`  Card CID: ${cid}`);

    // Step 4: Point on-chain record to the IPFS card
    console.log("  Step 3: Setting agentURI on-chain…");
    await setAgentURI(agentId, agentURI);

    const agentUrl = explorerAgentUrl(agentId);
    results.push({ role: agent.role, agentId, envKey: agent.envKey, agentUrl });
    console.log(`  ✓ ${agent.role} registered → ${agentUrl}`);

    // Brief pause so nonce updates propagate before the next registration
    await new Promise((r) => setTimeout(r, 3000));
  }

  if (results.length === 0) {
    console.log("\nAll agents already registered. Nothing to do.");
    return;
  }

  console.log("\n── Add these to your .env ──────────────────────────");
  for (const r of results) {
    console.log(`${r.envKey}=${r.agentId}`);
  }

  console.log("\n── Block explorer links ────────────────────────────");
  for (const r of results) {
    console.log(`${r.role}: ${r.agentUrl}`);
  }
}

main().catch((err) => {
  console.error("\n❌ Registration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
