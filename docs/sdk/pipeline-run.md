# PipelineRun

Returned by [`client.run()`](/sdk/client#run). Represents a live pipeline execution connected to the Kredence server over WebSocket.

`PipelineRun` supports three consumption patterns simultaneously — use whichever fits your use case.

## Event interface

The most flexible pattern. Listen to specific events as they stream in.

```ts
const run = client.run(
  { kind: 'manual', urls: ['https://github.com/owner/repo'] },
  { maxProjects: 3 }
);

run.on('project_complete', (payload) => {
  console.log(payload.title, payload.confidenceScore);
});

run.on('pipeline_done', (summary) => {
  console.log('Done:', summary.projectsEvaluated, 'projects');
});

run.on('error', (err) => {
  console.error('Connection failed:', err.message);
});
```

### Events

| Event | Payload type | Description |
|---|---|---|
| `ready` | `{ serverVersion: string }` | Connection established, server ready |
| `pipeline_start` | `{ runId: string; ecosystem: string }` | Pipeline has started |
| `stage_start` | `{ runId: string; stage: string }` | An agent stage has begun |
| `stage_done` | `{ runId: string; stage: string }` | An agent stage completed |
| `log` | `{ runId, entry: AgentLogEntry, agent: AgentRole }` | Structured agent log entry |
| `tool_call` | `{ runId, agent, phase, tool, input }` | Agent tool call started |
| `tool_done` | `{ runId, agent, phase, tool, output, durationMs }` | Agent tool call succeeded |
| `tool_error` | `{ runId, agent, phase, tool, error, durationMs }` | Agent tool call failed |
| `project_complete` | `HypercertPayload` | One project fully evaluated |
| `pipeline_done` | `PipelineSummary` | All projects evaluated successfully |
| `pipeline_error` | `{ stage: string; message: string }` | Pipeline failed |
| `message` | `ServerMessage` | Raw server message (all events) |
| `error` | `Error` | Fatal connection error |
| `close` | `{ code: number; reason: string }` | WebSocket connection closed |

### Stage names

The `stage_start` / `stage_done` events use these stage values:

| Stage | Description |
|---|---|
| `scout` | Discovering projects in the ecosystem |
| `evidence` | Collecting GitHub, onchain, and website evidence |
| `adversarial` | Challenging impact claims |
| `synthesis` | Assembling the final hypercert payload |

---

## Promise interface

Wait for the run to complete and get a summary. Simplest for fire-and-forget usage.

```ts
const summary = await run.completed();

console.log(summary.projectsEvaluated);  // number of projects evaluated
console.log(summary.totalVerified);      // total verified claims across all projects
console.log(summary.totalFlagged);       // total flagged claims
console.log(summary.durationMs);         // total run duration
```

**Returns:** `Promise<PipelineSummary>`

**Throws** if the pipeline fails or the connection drops.

```ts
type PipelineSummary = {
  projectsEvaluated: number;
  hypercertsStored: number;
  atprotoPublished: number;
  totalVerified: number;
  totalFlagged: number;
  totalUnresolved: number;
  durationMs: number;
};
```

::: tip
`.completed()` and event listeners work simultaneously — you can attach listeners for granular progress and still `await run.completed()` for the final result.
:::

---

## Async iterable interface

Iterate over every server message as it arrives. Useful for processing events in sequence or building a structured log.

```ts
const run = client.run({ kind: 'octant', epochNumber: 7 });

for await (const event of run) {
  switch (event.type) {
    case 'stage_start':
      console.log(`→ ${event.stage}`);
      break;
    case 'project_complete':
      console.log(`✓ ${event.payload.title}`);
      break;
    case 'pipeline_done':
      console.log('Summary:', event.summary);
      break;
    case 'pipeline_error':
      console.error('Error:', event.message);
      break;
  }
}
```

The iterator completes (returns `done: true`) when the pipeline finishes — either successfully (`pipeline_done`) or with an error (`pipeline_error`).

---

## `abort()`

Close the WebSocket connection early.

```ts
const run = client.run({ kind: 'gitcoin', roundId: '0x...' });

// Cancel after 60 seconds
setTimeout(() => run.abort(), 60_000);

await run.completed().catch(() => console.log('Run aborted'));
```

---

## Full example

```ts
import { KredenceClient } from 'kredence';
import type { HypercertPayload } from 'kredence';

const client = new KredenceClient();
const results: HypercertPayload[] = [];

const run = client.run(
  { kind: 'devspot', url: 'https://my-hackathon.devspot.app/?activeTab=projects' },
  { maxProjects: 10 }
);

run.on('ready', ({ serverVersion }) => {
  console.log(`Connected to Kredence server v${serverVersion}`);
});

run.on('stage_start', ({ stage }) => {
  process.stdout.write(`\n[${stage}] `);
});

run.on('log', ({ entry }) => {
  if (entry.level !== 'info') {
    console.log(`${entry.level.toUpperCase()} ${entry.action}`);
  }
});

run.on('project_complete', (payload) => {
  results.push(payload);
  const pct = Math.round(payload.confidenceScore * 100);
  console.log(`\n✓ ${payload.title} — ${pct}% confidence`);
  console.log(`  ${payload.verifiedClaims.length} verified, ${payload.flaggedClaims.length} flagged`);
});

run.on('pipeline_error', ({ stage, message }) => {
  console.error(`Pipeline error at ${stage}: ${message}`);
});

const summary = await run.completed();

console.log(`\nEvaluated ${summary.projectsEvaluated} projects in ${summary.durationMs}ms`);
console.log(`Total verified: ${summary.totalVerified}  Total flagged: ${summary.totalFlagged}`);
```
