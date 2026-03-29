# Quickstart

Get up and running with the Kredence SDK in under 5 minutes.

## 1. Install the SDK

::: code-group

```bash [npm]
npm install kredence
```

```bash [pnpm]
pnpm add kredence
```

```bash [yarn]
yarn add kredence
```

:::

## 2. Create a client

```ts
import { KredenceClient } from 'kredence';

const client = new KredenceClient();
// Connects to https://credenceserver-production.up.railway.app by default
```

## 3. Check the server is live

```ts
const health = await client.health();
console.log(health);
// { status: 'ok', version: '0.1.0', ts: '2026-03-29T...' }
```

## 4. Browse evaluated projects

```ts
const registry = await client.listProjects();

for (const entry of registry.entries) {
  const pct = Math.round(entry.confidenceScore * 100);
  console.log(`${entry.title} — ${pct}% confidence`);
  console.log(`  verified: ${entry.verifiedCount}  flagged: ${entry.flaggedCount}`);
}
```

## 5. Fetch a full hypercert

```ts
const hypercert = await client.getProject('safenote');

console.log(hypercert.evaluatorSummary);
console.log(hypercert.verifiedClaims);
console.log(hypercert.flaggedClaims);
```

## 6. Run an autonomous pipeline

This opens a WebSocket connection and runs the full four-stage agent pipeline against the ecosystem you provide.

```ts
const run = client.run(
  { kind: 'manual', urls: ['https://github.com/owner/repo'] },
  { maxProjects: 3 }
);

run.on('stage_start', ({ stage }) => console.log(`Running ${stage}…`));

run.on('project_complete', (payload) => {
  console.log(`✓ ${payload.title} — ${Math.round(payload.confidenceScore * 100)}%`);
});

const summary = await run.completed();
console.log(`Done. ${summary.projectsEvaluated} projects evaluated.`);
```

::: tip
The pipeline can take several minutes per project depending on the ecosystem size. Use the event interface or async iterable to stream progress in real time. See [PipelineRun](/sdk/pipeline-run) for all available events.
:::

## Next steps

- [KredenceClient reference](/sdk/client) — all REST methods
- [PipelineRun reference](/sdk/pipeline-run) — events, async iterable, promise API
- [Ecosystem inputs](/ecosystem-inputs/github-repo) — all supported platforms
- [Guides](/guides/badge) — embed a badge, build a dashboard, stream a pipeline
