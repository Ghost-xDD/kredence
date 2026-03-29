# kredence

TypeScript SDK for the [Kredence](https://kredence.xyz) autonomous impact intelligence API.

Kredence discovers projects in a funding ecosystem, collects evidence from GitHub and onchain activity, adversarially challenges every impact claim, and produces continuously-updated hypercerts. This SDK gives you programmatic access to the pipeline and results.

## Installation

```bash
npm install kredence
# or
pnpm add kredence
# or
yarn add kredence
```

**Requirements:** Node.js ≥ 18. The SDK uses native `fetch` and `WebSocket` (available in Node 18+ and all modern browsers). For Node < 22 where native WebSocket may not be available, pass a WebSocket implementation (see below).

## Quick start

```ts
import { KredenceClient } from 'kredence';

const client = new KredenceClient();

// Browse evaluated projects
const registry = await client.listProjects();
console.log(registry.entries.map((e) => e.title));

// Full hypercert for a project
const hypercert = await client.getProject('my-project-slug');
console.log(hypercert.verifiedClaims, hypercert.confidenceScore);

// Run an autonomous evaluation pipeline
const run = client.run(
  { kind: 'manual', urls: ['https://github.com/owner/repo'] },
  { maxProjects: 5 }
);

run.on('project_complete', (payload) => {
  console.log(payload.title, `${Math.round(payload.confidenceScore * 100)}% confident`);
});

const summary = await run.completed();
console.log(`Evaluated ${summary.projectsEvaluated} projects in ${summary.durationMs}ms`);
```

## API

### `new KredenceClient(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string` | `"https://api.kredence.xyz"` | API server URL |
| `WebSocket` | `typeof WebSocket` | `globalThis.WebSocket` | Override for environments without native WebSocket |

For Node.js < 22:

```ts
import WebSocket from 'ws';
import { KredenceClient } from 'kredence';

const client = new KredenceClient({ WebSocket });
```

### REST methods

#### `client.health()`
Returns `HealthResponse` — confirms the server is reachable.

#### `client.listProjects()`
Returns `HypercertRegistry` — all evaluated projects with compact summary entries sorted by confidence score. Use this to build a portfolio view.

#### `client.getProject(slug)`
Returns the full `HypercertPayload` for a project, including verified claims, flagged claims, evidence references, and agent attribution. The payload is fetched from Storacha.

#### `client.getBadge(slug)`
Returns a [shields.io endpoint JSON](https://shields.io/endpoint) you can embed directly in any README:

```markdown
![Kredence](https://img.shields.io/endpoint?url=https://api.kredence.xyz/badge/your-slug)
```

### `client.run(input, options?)`

Starts a live evaluation pipeline run and returns a `PipelineRun`.

**Ecosystem inputs:**

```ts
// Evaluate a specific GitHub repo
client.run({ kind: 'github-repo', repoUrl: 'https://github.com/owner/repo' })

// Evaluate projects from a Gitcoin round
client.run({ kind: 'gitcoin', roundId: '0x...', chainId: 42161 })

// Evaluate submissions from a Devspot hackathon
client.run({ kind: 'devspot', url: 'https://your-hackathon.devspot.app/?activeTab=projects' })

// Evaluate active Filecoin Dev Grants
client.run({ kind: 'filecoin-devgrants', repo: 'filecoin-project/devgrants' })

// Evaluate from an Octant epoch
client.run({ kind: 'octant', epochNumber: 7 })

// Evaluate a custom list of URLs
client.run({ kind: 'manual', urls: ['https://github.com/...', 'https://myproject.xyz'] })
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxProjects` | `number` | `3` | Projects to evaluate (server caps at 10) |

### `PipelineRun`

#### Event interface

```ts
run.on('pipeline_start', ({ runId, ecosystem }) => { ... });
run.on('stage_start',    ({ runId, stage }) => { ... });     // 'scout' | 'evidence' | 'adversarial' | 'synthesis'
run.on('stage_done',     ({ runId, stage }) => { ... });
run.on('project_complete', (payload: HypercertPayload) => { ... });
run.on('pipeline_done',  (summary: PipelineSummary) => { ... });
run.on('pipeline_error', ({ stage, message }) => { ... });
run.on('log',            (entry) => { ... });                // agent structured logs
run.on('tool_call',      (event) => { ... });                // agent tool invocations
run.on('tool_done',      (event) => { ... });
run.on('error',          (err: Error) => { ... });           // connection errors
run.on('close',          ({ code, reason }) => { ... });
```

#### Promise interface

```ts
const summary = await run.completed();
// { projectsEvaluated, hypercertsStored, totalVerified, totalFlagged, durationMs, ... }
```

#### Async iterable interface

```ts
for await (const event of run) {
  if (event.type === 'project_complete') {
    console.log(event.payload.title);
  }
  if (event.type === 'pipeline_done') {
    console.log(event.summary);
    break;
  }
}
```

#### `run.abort()`

Close the WebSocket connection early.

## Types

All Kredence domain types are exported from the package root:

```ts
import type {
  HypercertPayload,
  HypercertRegistry,
  RegistryEntry,
  EcosystemInput,
  PipelineSummary,
  ServerMessage,
  // ... and more
} from 'kredence';
```

## Self-hosting

Point the SDK at your own server:

```ts
const client = new KredenceClient({ baseUrl: 'http://localhost:3001' });
```

## License

MIT
