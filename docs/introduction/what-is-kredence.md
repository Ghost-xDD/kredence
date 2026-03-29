# What is Kredence?

Kredence is an autonomous agent system that discovers projects in a funding ecosystem, monitors them as they ship, adversarially challenges their impact claims, and produces continuously-updated hypercerts that funders can use to allocate with confidence.

## The problem

Most impact evaluation tools ask projects to submit something. Forms, milestone reports, self-assessments. The output is optimistic — because the people filling them out want to look good.

Kredence does not ask projects to submit anything.

Point it at an ecosystem — a Gitcoin round, a DAO cohort, a hackathon track — and it finds every active project, pulls their evidence from GitHub, deployments, and onchain activity, runs an adversarial challenge on every claim, and builds a living hypercert for each project.

## What Kredence produces

For each project discovered in an ecosystem, Kredence outputs:

| Artifact | Description |
|---|---|
| **Project manifest** | Structured list of all discovered projects and their evidence sources |
| **Evidence bundle** | Raw and normalised evidence — commits, PRs, deployments, README claims |
| **Adversarial log** | Signed agent receipt of every claim challenged, with outcome: `verified`, `flagged`, or `unresolved` |
| **Hypercert payload** | Title, contributors, timeframe, impact category, evidence references, and adversarial summary |

## What makes it different

**Against AI summarisers** — Kredence runs an adversarial agent on every claim _before_ it enters a hypercert. The output is a structured evidence record with verified claims, flagged overclaims, and open objections — not a confidence score from a single LLM pass.

**Against manual evaluation** — Kredence produces consistent, replayable, evidence-backed records across an entire ecosystem simultaneously.

**Against self-reported systems** — No submission form. Projects that ship consistently but never fill out forms are still discovered and evaluated.

## The agent pipeline

```
Ecosystem Input
    │
    ▼
Scout Agent          Discovers all active projects autonomously
    │
    ▼
Evidence Agent       Collects GitHub, onchain, and website evidence
    │
    ▼
Adversarial Agent    Challenges every claim — flags, verifies, or marks unresolved
    │
    ▼
Synthesis Agent      Assembles the final hypercert payload
    │
    ▼
Hypercert + Dashboard
```

Each agent carries an [ERC-8004](https://github.com/erc-8004/erc-8004-contracts) onchain identity. Every output includes identity metadata. The Adversarial Agent's objection logs are signed receipts.

## Next steps

- [How it works](/introduction/how-it-works) — a deeper look at each agent stage
- [Quickstart](/introduction/quickstart) — run your first evaluation in under 5 minutes
