# Kredence

**Autonomous impact intelligence. No forms. No summaries. Just evidence.**

Kredence is a multi-agent system that discovers projects in a funding ecosystem, collects real evidence from GitHub, onchain activity, and deployments, adversarially challenges every impact claim, and produces continuously-updated hypercerts — without asking anyone to submit anything.

[![Kredence](https://img.shields.io/endpoint?url=https%3A%2F%2Fcredenceserver-production.up.railway.app%2Fbadge%2Fsafenote)](https://kredence.xyz)
[![npm](https://img.shields.io/npm/v/kredence)](https://npmjs.com/package/kredence)
[![docs](https://img.shields.io/badge/docs-docs.kredence.xyz-blue)](https://docs.kredence.xyz)

**[Website](https://kredence.xyz)** · **[Docs](https://docs.kredence.xyz)** · **[API](https://credenceserver-production.up.railway.app/health)** · **[npm](https://npmjs.com/package/kredence)** · **[Install GitHub App](https://github.com/apps/kredence-app/installations/new)**

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution](#the-solution)
3. [How It Works](#how-it-works)
   - [Scout Agent](#1-scout-agent)
   - [Evidence Agent](#2-evidence-agent)
   - [Adversarial Agent](#3-adversarial-agent)
   - [Synthesis Agent](#4-synthesis-agent)
4. [Agent Identity & Receipts](#agent-identity--receipts)
5. [Decentralised Storage](#decentralised-storage)
6. [Hypercert Output](#hypercert-output)
7. [GitHub App](#github-app)
8. [Ecosystem Integrations](#ecosystem-integrations)
9. [SDK](#sdk)
10. [API](#api)
11. [Architecture](#architecture)
12. [Running Locally](#running-locally)
13. [Agent Manifest](#agent-manifest)
14. [Execution Logs](#execution-logs)
15. [Tech Stack](#tech-stack)

---

## The Problem

Every grant round, hackathon, and DAO funding cycle faces the same failure mode: **impact claims are self-reported, scattered, and almost impossible to verify at scale.**

The tools that exist today ask projects to fill out forms, write milestone reports, or submit summaries. The output is optimistic — because the people writing them want to look good. Funders allocate on the basis of stories, not evidence. High-quality projects that ship consistently but never self-promote are invisible. Projects that overclaim are rarely caught.

This isn't a data problem. The evidence exists — it's in GitHub commit histories, deployed contracts, live websites, and onchain activity. The problem is that nobody has built the system to collect it autonomously, challenge it adversarially, and produce a structured, reusable record that funders can actually rely on.

**The deeper issue:** hypercerts — the open standard for recording impact — need a continuous evidence pipeline. Most hypercerts are minted once and never updated, even when the underlying project keeps building. They become snapshots rather than living records.

---

## The Solution

Point Kredence at an ecosystem — a grant round, a hackathon cohort, a DAO portfolio — and it runs a full autonomous evaluation pipeline:

```
Ecosystem Input  →  Scout  →  Evidence  →  Adversarial  →  Synthesis  →  Hypercert
```

No submission form. No human in the loop after initial configuration. Every project in the ecosystem is discovered, evaluated, adversarially challenged, and issued a living hypercert — with all evidence, objections, and agent attributions stored permanently on decentralised storage.

The output is a funder-facing dashboard showing what is actually being built, backed by evidence the agents collected and stress-tested themselves. Projects that overclaim get flagged. Claims that survive challenge are marked verified. Funders see the honest picture.

---

## How It Works

### 1. Scout Agent

**Role:** Autonomous ecosystem discovery

The Scout Agent takes an ecosystem identifier and enumerates every active project without any manual submission. It reads the native data format of each supported platform.

```
Input:  EcosystemInput  (grant round ID, hackathon URL, GitHub org, etc.)
Output: ProjectManifest (all discovered projects + evidence sources)
         └── stored on Storacha with content-addressed CID
```

Supported platforms: Gitcoin, Devspot, Devfolio, Chainlink Hackathon, ETHGlobal, Filecoin Dev Grants, Octant, GitHub repos, and manual URL lists.

The Scout Agent logs every adapter selection, project count, and resolution failure to a structured `agent_log.json` — a verifiable execution trail showing exactly how discovery happened.

---

### 2. Evidence Agent

**Role:** Multi-source evidence collection

For each discovered project, the Evidence Agent fetches and normalises evidence from every available source in parallel, respecting API rate limits and gracefully degrading on unavailable sources.

```
Input:  ProjectRecord (from Scout)
Output: EvidenceBundle per project
         └── stored on Storacha with content-addressed CID
```

| Source | Signals |
|---|---|
| **GitHub** | Commits (90d), merged PRs, closed issues, releases, contributors, README |
| **Website / demo** | Live status, page content, title, description |
| **Onchain** | Tx count, deployment date, contract verification |

After collection, the agent runs a structured LLM extraction pass to identify explicit and implied claims from README text and submission content. These become the adversarial input.

All tool calls — API requests, LLM calls, storage writes — are logged to `agent_log.json` with input, output, duration, and retry metadata.

---

### 3. Adversarial Agent

**Role:** Claim challenging and signed objection receipts

This is the core differentiator. Every extracted claim is challenged before it can enter a hypercert.

```
Input:  EvidenceBundle (extracted claims)
Output: AdversarialLog (signed agent receipt)
         └── stored on Storacha with content-addressed CID
```

For each claim, the agent:

1. Classifies the challenge type
2. Actively searches for counter-evidence
3. Records a structured outcome: `verified`, `flagged`, or `unresolved`
4. Signs the complete log with EIP-191 using the agent's operator wallet

**Challenge types the agent looks for:**

| Type | Description |
|---|---|
| `vague-metric` | Claim lacks specificity or a measurable outcome |
| `attribution` | Claimed contributor not verifiable in observable evidence |
| `consistency` | Claim appears only in self-reported text, not corroborated |
| `deployment` | Claimed deployment not reachable or verifiable onchain |
| `overclaim` | Claimed impact scope exceeds observable evidence |
| `dead-link` | Referenced URL is unreachable |

The resulting log is a **signed agent receipt** — a structured record attributable to a specific ERC-8004 agent identity, with a message hash and EIP-191 signature that any third party can verify onchain.

---

### 4. Synthesis Agent

**Role:** Final hypercert assembly

The Synthesis Agent takes the evidence bundle and adversarial log and assembles the final hypercert payload.

```
Input:  EvidenceBundle + AdversarialLog
Output: HypercertPayload
         └── stored on Storacha
         └── indexed in mutable IPNS registry (also cached in Redis)
         └── published to ATProto / Hyperscan network
```

The payload includes verified claims, flagged claims, open questions, a confidence score, and full agent attribution — ready for consumption by funders, evaluators, or any downstream system that reads hypercert supplementary data.

---

## Agent Identity & Receipts

Every agent in Kredence carries an onchain identity registered through [ERC-8004](https://github.com/erc-8004/erc-8004-contracts) — the decentralised trust framework for autonomous agents.

| Registry | Network | Address |
|---|---|---|
| Identity Registry | Base | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation Registry | Base | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| Identity Registry | Base Sepolia | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation Registry | Base Sepolia | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

Each agent output includes:

```json
{
  "agentId": "42",
  "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  "operatorWallet": "0xYourWallet",
  "role": "adversarial",
  "signatureContext": {
    "method": "eip191",
    "signerAddress": "0xYourWallet",
    "messageHash": "0xabc123...",
    "signature": "0xdef456..."
  }
}
```

The Adversarial Agent's objection logs are **signed receipts** — structured outputs that are cryptographically attributable to a registered agent identity. Any external system can verify that a specific agent, with a specific onchain history, produced a specific evaluation at a specific time.

This is not a label. The registration transactions are live on Base and viewable on block explorers. Agent reputation is queryable onchain.

---

## Decentralised Storage

All Kredence artifacts are stored on [Storacha](https://storacha.network) — a decentralised storage network built on IPFS and Filecoin — and returned as content-addressed CIDs.

```
credence:registry  (IPNS mutable pointer → latest HypercertRegistry)
    │
    ├── entries[n].cid → HypercertPayload JSON
    │       ├── storachaRefs.evidenceBundleCid  → EvidenceBundle
    │       └── storachaRefs.adversarialLogCid  → AdversarialLog (signed receipt)
    │
    └── ... (one entry per evaluated project)
```

**Why this matters:**

- Every evaluation run is **replayable** — any CID can be retrieved and verified independently
- Evidence bundles are **immutable** — what the agent saw cannot be retroactively changed
- The adversarial log is a **permanent, content-addressed receipt** — not a database row someone can edit
- Shared agent memory is **accessible across runs** — agents can build on prior context without losing state on restart

The registry is published under an IPNS name updated on every pipeline run, with Redis as a fast-read cache for the funder dashboard. Both are kept in sync — decentralised audit trail alongside the reliable read path.

---

## Hypercert Output

Kredence produces valid hypercert-compatible payloads aligned with the [Hypercerts supplementary data schema](https://docs.hypercerts.org/).

```json
{
  "title": "Safenote",
  "contributors": [{ "name": "codeaashu", "githubLogin": "codeaashu" }],
  "timeframeStart": "2025-09-01",
  "timeframeEnd": "2026-03-28",
  "impactCategory": ["privacy", "social"],
  "workScopes": ["web-app"],
  "evidenceRefs": [
    { "label": "GitHub repository", "url": "https://github.com/codeaashu/Safenote", "storachaCid": "bafybeig..." }
  ],
  "verifiedClaims": [
    { "id": "c1", "text": "The application is live at safenote.me.", "supportingEvidence": ["Website check returned 200"] }
  ],
  "flaggedClaims": [],
  "openQuestions": [],
  "evaluatorSummary": "Safenote is a web-based application...",
  "confidenceScore": 0.72,
  "evaluatedBy": [
    { "agentId": "42", "agentRegistry": "eip155:8453:0x8004...", "role": "adversarial", "operatorWallet": "0x..." }
  ],
  "storachaRefs": {
    "evidenceBundleCid": "bafybeig...",
    "adversarialLogCid": "bafybeig..."
  },
  "atproto": {
    "activityUri": "at://did:plc:...",
    "hyperscanUrl": "https://www.hyperscan.dev/data?..."
  },
  "generatedAt": "2026-03-28T16:37:40.500Z"
}
```

Hypercerts are not minted once and forgotten. Every time a project ships new evidence — a new release, a new milestone, a new deployment — the Evidence Agent detects it and the pipeline updates the hypercert. Living records, not snapshots.

---

## GitHub App

The fastest way to get your project evaluated. Install the Kredence GitHub App and every push to your default branch triggers a full pipeline run automatically — no manual invocations, no API calls.

**[→ Install on GitHub](https://github.com/apps/kredence-app/installations/new)**

After install, your project appears in the Kredence dashboard within minutes of your first push. The GitHub App will also open a PR adding a `.hypercert.json` file to your repository root after each evaluation.

---

## Ecosystem Integrations

Kredence connects to the following platforms natively. Point it at any of these and it discovers projects without manual enumeration.

| Platform | Input | Discovery method |
|---|---|---|
| **Gitcoin** | Round contract address | Grants Stack API — enumerates all funded applications |
| **Devspot** | Hackathon URL | Scrapes project cards with pagination |
| **Devfolio** | Hackathon slug | Devfolio API |
| **Chainlink Hackathon** | Gallery URL | Crawls `chain.link/hack-*` gallery and each project detail page |
| **ETHGlobal** | Event slug | Scrapes `ethglobal.com/showcase?events={slug}` and each project detail page |
| **Filecoin Dev Grants** | GitHub repo | Issues API — parses grant proposals by label |
| **Octant** | Epoch number | Octant API — fetches all epoch projects |
| **GitHub** | Repo URL | Direct evaluation of a single repository |
| **Manual** | URL list | Resolve + evaluate any set of project URLs |

---

## SDK

Install the TypeScript SDK from npm:

```bash
npm install kredence
```

### Browse evaluated projects

```ts
import { KredenceClient } from 'kredence';

const client = new KredenceClient();

const { entries } = await client.listProjects();
for (const project of entries) {
  console.log(project.title, `${Math.round(project.confidenceScore * 100)}%`);
}
```

### Fetch a full hypercert

```ts
const hypercert = await client.getProject('safenote');
console.log(hypercert.verifiedClaims);
console.log(hypercert.flaggedClaims);
console.log(hypercert.evaluatorSummary);
```

### Run an autonomous pipeline

```ts
const run = client.run(
  { kind: 'gitcoin', roundId: '0x...', chainId: 42161 },
  { maxProjects: 5 }
);

run.on('project_complete', (payload) => {
  console.log(`✓ ${payload.title} — ${Math.round(payload.confidenceScore * 100)}%`);
  console.log(`  ${payload.verifiedClaims.length} verified, ${payload.flaggedClaims.length} flagged`);
});

const summary = await run.completed();
console.log(`Evaluated ${summary.projectsEvaluated} projects in ${summary.durationMs}ms`);
```

The pipeline run streams live events — stage transitions, tool calls, project completions — over a WebSocket connection. Three consumption patterns are available simultaneously: event listeners, async iterable (`for await ... of`), and a promise interface (`.completed()`).

**Full SDK documentation:** [docs.kredence.xyz](https://docs.kredence.xyz)

---

## API

**Base URL:** `https://credenceserver-production.up.railway.app`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `GET` | `/projects` | List all evaluated projects (registry) |
| `GET` | `/projects/:slug` | Full hypercert payload for a project |
| `GET` | `/badge/:slug` | shields.io-compatible badge JSON |
| `WS` | `/ws` | Live pipeline run (WebSocket) |

### Embed a badge

```markdown
![Kredence](https://img.shields.io/endpoint?url=https%3A%2F%2Fcredenceserver-production.up.railway.app%2Fbadge%2Fyour-slug)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User / Funder                         │
│                    kredence.xyz dashboard                    │
└─────────────────────┬───────────────────────────────────────┘
                       │ HTTPS / WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                   @credence/server (Express + WS)            │
│  GET /projects   GET /projects/:slug   GET /badge/:slug      │
│  POST /webhook/github   WS /ws                               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Pipeline Runner                      │   │
│  │  Scout → Evidence → Adversarial → Synthesis          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Registry: Redis (fast) + IPNS → Storacha (audit trail)     │
└──────┬──────────────────────────────────────────────────────┘
       │
       ├── GitHub API (evidence collection)
       ├── Onchain RPC (contract verification)
       ├── OpenAI / Anthropic (claim extraction + adversarial)
       ├── Storacha (decentralised artifact storage)
       ├── ERC-8004 Identity Registry (Base)
       └── ATProto / Hypercerts network (hypercert publishing)
```

### Packages

| Package | Description |
|---|---|
| `packages/types` | Shared TypeScript types for all domain objects |
| `packages/agents` | Scout, Evidence, Adversarial, Synthesis agent implementations |
| `packages/storage` | Storacha client, IPNS publish/resolve, registry fetch |
| `packages/server` | Express + WebSocket server, registry store, GitHub App webhook |
| `packages/sdk` | Published npm package — `kredence` |
| `web` | Next.js funder dashboard |

---

## Running Locally

```bash
# Clone and install
git clone https://github.com/Ghost-xDD/credence
cd credence
pnpm install

# Environment
cp .env.example .env
# Fill in: GITHUB_TOKEN, STORACHA_KEY, OPENAI_API_KEY,
#          OPERATOR_PRIVATE_KEY, UPSTASH_REDIS_REST_URL/TOKEN

# Build packages
pnpm build:packages

# Start the API server
pnpm dev:server

# Start the dashboard (separate terminal)
pnpm dev
```

### Run a test pipeline

```bash
pnpm test:pipeline
```

This runs the full Scout → Evidence → Adversarial → Synthesis pipeline against a real ecosystem, outputs hypercert payloads, and writes two artefacts to the project root:

- **`agent.json`** — machine-readable capability manifest (operator, agent IDs, tools, constraints)
- **`agent_log.json`** — structured execution log for the run (decisions, tool calls, timings, results)

---

## Agent Manifest

`agent.json` at the project root is the machine-readable capability manifest for the full Kredence system. It declares the operator, all four ERC-8004 agent identities, every external tool, and the compute constraints for a pipeline run.

```json
{
  "schema": "https://eips.ethereum.org/EIPS/eip-8004#agent-manifest-v1",
  "name": "Kredence Autonomous Impact Intelligence",
  "operator": {
    "wallet": "0x134e3dD08dbf085adE908c894aD137157c35aa48",
    "chain": "eip155:84532",
    "registry": "0x8004A818BFB912233c491871b3d84c89A494BD9e"
  },
  "agents": [
    { "role": "scout",       "agentId": 3040, "erc8004": "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e:3040" },
    { "role": "evidence",    "agentId": 3041, "erc8004": "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e:3041" },
    { "role": "adversarial", "agentId": 3042, "erc8004": "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e:3042" },
    { "role": "synthesis",   "agentId": 3043, "erc8004": "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e:3043" }
  ],
  "pipeline": {
    "decisionLoop": "discover → plan → execute → verify → submit",
    "humanInvolvement": "none after initial launch"
  },
  "computeConstraints": {
    "maxProjectsPerRun": 10,
    "maxLLMCallsPerProject": 12,
    "maxRetries": 3,
    "timeoutPerStageMs": 120000
  }
}
```

See [`agent.json`](./agent.json) for the full manifest including all tools, task categories, and tech stack.

---

## Execution Logs

Every `pnpm test:pipeline` run writes `agent_log.json` to the project root alongside `agent.json`. It records every decision, tool call, stage timing, retry, and final output — providing a complete, replayable audit trail.

```json
{
  "run_id": "run-1774911800825",
  "started_at": "2026-03-30T23:03:20.825Z",
  "finished_at": "2026-03-30T23:06:27.457Z",
  "status": "completed",
  "operator_wallet": "0x134e3dD08dbf085adE908c894aD137157c35aa48",
  "agent_ids": { "scout": 3040, "evidence": 3041, "adversarial": 3042, "synthesis": 3043 },
  "summary": {
    "projects_selected": 3,
    "hypercerts_stored": 3,
    "atproto_published": 3,
    "total_verified_claims": 13,
    "total_flagged_claims": 10,
    "duration_ms": 186632
  },
  "stages": {
    "scout":       { "status": "completed", "duration_ms": 39887 },
    "evidence":    { "status": "completed", "duration_ms": 47896 },
    "adversarial": { "status": "completed", "duration_ms": 43306 },
    "synthesis":   { "status": "completed", "duration_ms": 55485 }
  },
  "projects": [
    {
      "name": "YayNay.wtf",
      "confidence": 50,
      "verified_claims": 4,
      "flagged_claims": 4,
      "hypercert_payload_cid": "bafkreicuxw7kjlpcrrfrn7tec3jezw6pczk3cka5jkxs4fvs5eezjb5qra",
      "atproto_uri": "at://did:plc:fke3rhssj7rdghxee2t73x73/org.hypercerts.claim.activity/3micrma3y7k2h",
      "hyperscan_url": "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3micrma3y7k2h"
    }
  ],
  "log": [
    { "ts": "...", "level": "decision", "stage": "scout",       "message": "Targeting Devspot PL Genesis hackathon" },
    { "ts": "...", "level": "tool_call","stage": "scout",       "message": "Calling runScoutAgent — scraping ecosystem page" },
    { "ts": "...", "level": "decision", "stage": "adversarial", "message": "Plan: challenge every extracted claim — flag vague metrics, dead links, overclaiming" },
    { "ts": "...", "level": "tool_call","stage": "adversarial", "message": "Calling runAdversarialAgent — LLM counter-evidence search + EIP-191 signing" },
    { "ts": "...", "level": "success",  "stage": "synthesis",   "message": "Hypercerts stored: 3/3, ATProto published: 3" }
  ]
}
```

`agent_log.json` is gitignored (runtime output). Generate it by running `pnpm test:pipeline`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS |
| **API server** | Node.js, Express, WebSocket (`ws`) |
| **Agent orchestration** | Custom multi-agent runner with sequential + parallel execution |
| **LLM** | OpenAI GPT-4o / Anthropic Claude (claim extraction, adversarial challenge, synthesis) |
| **Decentralised storage** | [Storacha](https://storacha.network) (evidence, logs, hypercerts) |
| **Mutable registry** | IPNS (decentralised) + Upstash Redis (fast cache) |
| **Agent identity** | [ERC-8004](https://github.com/erc-8004/erc-8004-contracts) on Base |
| **Hypercert publishing** | ATProto / Hypercerts network |
| **GitHub integration** | GitHub REST API + GitHub App (webhook-triggered pipeline) |
| **SDK** | [`kredence`](https://npmjs.com/package/kredence) on npm (TypeScript, ESM + CJS) |
| **Deployment** | Railway (server), Vercel (dashboard + docs) |

---

## Documentation

Full documentation at **[docs.kredence.xyz](https://docs.kredence.xyz)**

- [What is Kredence?](https://docs.kredence.xyz/introduction/what-is-kredence)
- [How it works](https://docs.kredence.xyz/introduction/how-it-works)
- [Quickstart](https://docs.kredence.xyz/introduction/quickstart)
- [SDK reference](https://docs.kredence.xyz/sdk/client)
- [API reference](https://docs.kredence.xyz/api-reference/rest)
- [Ecosystem inputs](https://docs.kredence.xyz/ecosystem-inputs/github-repo)

---

## License

MIT
