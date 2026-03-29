# How it works

A Kredence evaluation run flows through four sequential agent stages. Each stage produces a structured artifact stored on Storacha with a content-addressed reference.

## Stage 1 — Scout Agent

**Role:** Autonomous ecosystem discovery

The Scout Agent takes an ecosystem identifier and enumerates every active project without requiring manual submission. It knows how to read the native data format of each supported platform.

```
Input:  EcosystemInput  (Gitcoin round ID, Devspot URL, GitHub org, etc.)
Output: ProjectManifest (structured list of discovered projects + evidence sources)
```

Supported platforms: [GitHub Repo](/ecosystem-inputs/github-repo), [Gitcoin](/ecosystem-inputs/gitcoin), [Devspot](/ecosystem-inputs/devspot), [Filecoin Dev Grants](/ecosystem-inputs/filecoin-devgrants), [Octant](/ecosystem-inputs/octant), [Devfolio](/ecosystem-inputs/devfolio), [Manual URL list](/ecosystem-inputs/manual).

## Stage 2 — Evidence Agent

**Role:** Continuous evidence collection

For each project in the manifest, the Evidence Agent fetches and normalises evidence from every available source in parallel.

```
Input:  ProjectRecord stub from Scout Agent
Output: EvidenceBundle per project (stored on Storacha)
```

Evidence sources collected per project:

| Source | Signals collected |
|---|---|
| **GitHub** | Commits (90d), merged PRs, closed issues, releases, contributors, README |
| **Website / demo** | Page content, title, description, live status |
| **Onchain** | Transaction count, deployment date, contract verification status |

After collection, the Evidence Agent runs an LLM extraction pass to identify explicit and implied claims in the README and submission text. These become the input to the Adversarial Agent.

## Stage 3 — Adversarial Agent

**Role:** Claim challenging and objection logging

This is the core differentiator. The Adversarial Agent challenges every extracted claim before it can enter a hypercert.

```
Input:  EvidenceBundle (extracted claims)
Output: AdversarialLog (signed agent receipt, stored on Storacha)
```

For each claim, the agent:

1. Classifies the challenge type
2. Searches for counter-evidence
3. Records an outcome: `verified`, `flagged`, or `unresolved`

**Challenge types:**

| Type | Description |
|---|---|
| `vague-metric` | Claim lacks specificity or a measurable outcome |
| `attribution` | Claimed contributor not verifiable in observable evidence |
| `consistency` | Claim appears only in self-reported text, not corroborated |
| `deployment` | Claimed deployment not reachable or verifiable onchain |
| `overclaim` | Claimed impact scope exceeds observable evidence |
| `dead-link` | Referenced URL is unreachable |

The resulting log is signed with EIP-191 by the agent's operator wallet, making it a verifiable receipt attributable to an ERC-8004 identity.

## Stage 4 — Synthesis Agent

**Role:** Final hypercert assembly

The Synthesis Agent takes the evidence bundle and adversarial log and assembles the final hypercert payload.

```
Input:  EvidenceBundle + AdversarialLog
Output: HypercertPayload (stored on Storacha, indexed in registry)
```

The payload includes:
- Core hypercert fields (title, contributors, timeframe, impact category, work scopes)
- Evidence references (Storacha CIDs)
- Verified claims with supporting evidence
- Flagged claims with objections
- Open questions (unresolved challenges)
- Evaluator summary
- Confidence score (0–1)
- Agent attribution (ERC-8004 identities for all four agents)

## Agent identity

Each agent registers an ERC-8004 identity on Base:

| Registry | Address |
|---|---|
| Identity Registry (Base) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Reputation Registry (Base) | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

Every agent output includes:
- `agentId` — ERC-721 tokenId from the Identity Registry
- `agentRegistry` — `eip155:{chainId}:{registryAddress}`
- `operatorWallet` — the wallet that registered the agent
- `signature` — EIP-191 personal_sign of the output hash

## Storage

All artifacts are stored on [Storacha](https://storacha.network) and returned as content-addressed CIDs:

```
credence:registry → HypercertRegistry (IPNS mutable pointer)
    ├── entries[0].cid → HypercertPayload
    │       ├── storachaRefs.evidenceBundleCid → EvidenceBundle
    │       └── storachaRefs.adversarialLogCid → AdversarialLog
    └── entries[1].cid → HypercertPayload
            └── ...
```

The registry is published under an IPNS name updated on every pipeline run, with Redis as a fast read cache.
