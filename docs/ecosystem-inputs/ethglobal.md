# ETHGlobal

Kredence can evaluate all project submissions from any ETHGlobal hackathon by scraping the public showcase gallery and each project's detail page.

## How it works

The adapter fetches `ethglobal.com/showcase?events={eventSlug}`, extracts all project links, then concurrently fetches each project detail page to collect the name, description, and any linked GitHub repositories or demo URLs. Up to 8 pages are fetched in parallel.

## Input

```ts
import { KredenceClient } from 'kredence';

const client = new KredenceClient();

const run = client.run({
  kind: 'ethglobal',
  eventSlug: 'hackmoney2026',
});
```

| Field | Required | Description |
|---|---|---|
| `eventSlug` | Yes | ETHGlobal event identifier as it appears in the showcase URL |
| `maxProjects` | No | Cap the number of projects fetched (useful for testing) |

## Finding the event slug

The event slug is the value of the `events` query parameter on the showcase page. For example:

| Hackathon | Slug |
|---|---|
| HackMoney 2026 | `hackmoney2026` |
| ETHGlobal Bangkok | `bangkok` |
| ETHGlobal Singapore | `singapore` |
| ETHGlobal New York | `newyork` |

Visit [ethglobal.com/showcase](https://ethglobal.com/showcase), filter by your event, and copy the slug from the URL.

## What gets collected

For each project, the adapter extracts:

- Project name
- Project description (from the "Project Description" section)
- GitHub repository URLs
- Demo / deployment URLs
- ETHGlobal showcase page URL (stored as `submission-page` source)

The Evidence Agent then fetches commits, PRs, releases, and live deployment status from any linked GitHub repository.

## Example

```ts
const run = client.run({
  kind: 'ethglobal',
  eventSlug: 'hackmoney2026',
  maxProjects: 50,
});

run.on('project_complete', ({ title, confidenceScore, verifiedClaims }) => {
  console.log(`${title}: ${Math.round(confidenceScore * 100)}% · ${verifiedClaims.length} verified`);
});

const summary = await run.completed();
console.log(`Evaluated ${summary.projectsEvaluated} ETHGlobal submissions`);
```
