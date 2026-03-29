# Chainlink Hackathon

Kredence can evaluate all project submissions from a Chainlink Convergence hackathon by crawling the public gallery and each project detail page.

## How it works

The adapter fetches the gallery page at `chain.link/hack-{id}`, extracts all project slugs, then concurrently fetches each project's detail page to collect the name, description, team, GitHub repository, and track. Up to 8 detail pages are fetched in parallel.

## Input

```ts
import { KredenceClient } from 'kredence';

const client = new KredenceClient();

const run = client.run({
  kind: 'chainlink-hackathon',
  galleryUrl: 'https://chain.link/hack-26',
  maxProjects: 100, // optional — omit to evaluate all submissions
});
```

| Field | Required | Description |
|---|---|---|
| `galleryUrl` | Yes | Full URL to the Chainlink hackathon gallery page |
| `maxProjects` | No | Cap the number of projects fetched (useful for testing) |

## Supported hackathons

Any `chain.link/hack-{id}` gallery URL is supported. The adapter has been tested against Chainlink Convergence (hack-26), which has 553 submissions across six tracks:

- Autonomous Agents
- CRE & AI
- DeFi & Tokenization
- Prediction Markets
- Privacy
- Risk & Compliance

## What gets collected

For each project, the Scout Agent extracts:

- Project name and description
- Team members
- GitHub repository URL (used as the primary evidence source)
- Hackathon track

The Evidence Agent then fetches commits, PRs, releases, and live deployment status from the linked GitHub repository.

## Example

```ts
const run = client.run({
  kind: 'chainlink-hackathon',
  galleryUrl: 'https://chain.link/hack-26',
});

run.on('project_complete', ({ title, confidenceScore, verifiedClaims }) => {
  console.log(`${title}: ${Math.round(confidenceScore * 100)}% · ${verifiedClaims.length} verified`);
});

const summary = await run.completed();
console.log(`Evaluated ${summary.projectsEvaluated} Chainlink submissions`);
```
