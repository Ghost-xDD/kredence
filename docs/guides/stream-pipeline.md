# Stream a live pipeline

Show real-time progress as Kredence evaluates an ecosystem — useful for progress UIs, CLI tools, or server-sent event feeds.

## Terminal progress display

```ts
import { KredenceClient } from 'kredence';

const client = new KredenceClient();

const run = client.run(
  { kind: 'manual', urls: ['https://github.com/owner/repo'] },
  { maxProjects: 5 }
);

const stageStart: Record<string, number> = {};

run.on('ready', ({ serverVersion }) => {
  console.log(`\nConnected to Kredence v${serverVersion}\n`);
});

run.on('pipeline_start', ({ runId, ecosystem }) => {
  console.log(`Run ${runId} — evaluating ${ecosystem} ecosystem`);
});

run.on('stage_start', ({ stage }) => {
  stageStart[stage] = Date.now();
  process.stdout.write(`  [${stage.padEnd(12)}] running…`);
});

run.on('stage_done', ({ stage }) => {
  const elapsed = Date.now() - (stageStart[stage] ?? Date.now());
  process.stdout.write(` ${elapsed}ms\n`);
});

run.on('project_complete', (payload) => {
  const pct = Math.round(payload.confidenceScore * 100);
  const bar = '█'.repeat(Math.round(pct / 10)).padEnd(10, '░');
  console.log(`\n  ✓ ${payload.title}`);
  console.log(`    [${bar}] ${pct}%`);
  console.log(`    ${payload.verifiedClaims.length} verified · ${payload.flaggedClaims.length} flagged`);
});

run.on('pipeline_error', ({ stage, message }) => {
  console.error(`\n  ✗ Error at ${stage}: ${message}`);
});

const summary = await run.completed();
console.log(`\nDone — ${summary.projectsEvaluated} projects in ${summary.durationMs}ms`);
```

## Server-Sent Events (Next.js)

Stream pipeline events to a browser over SSE from a Next.js Route Handler:

```ts
// app/api/pipeline/route.ts
import { KredenceClient } from 'kredence';
import type { EcosystemInput } from 'kredence';

const client = new KredenceClient();

export async function POST(req: Request) {
  const input = (await req.json()) as EcosystemInput;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      const run = client.run(input, { maxProjects: 5 });

      run.on('stage_start',       (e) => send({ type: 'stage_start',       ...e }));
      run.on('stage_done',        (e) => send({ type: 'stage_done',        ...e }));
      run.on('project_complete',  (p) => send({ type: 'project_complete', payload: p }));
      run.on('pipeline_error',    (e) => send({ type: 'pipeline_error',   ...e }));

      const summary = await run.completed().catch((err: Error) => {
        send({ type: 'error', message: err.message });
        return null;
      });

      if (summary) send({ type: 'pipeline_done', summary });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
```

**Client-side consumption:**

```ts
const source = new EventSource('/api/pipeline');

source.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'project_complete') {
    console.log(msg.payload.title, msg.payload.confidenceScore);
  }

  if (msg.type === 'pipeline_done') {
    source.close();
  }
};
```

## Async iterable pattern

```ts
const run = client.run({ kind: 'octant', epochNumber: 7 });

const projects = [];

for await (const event of run) {
  if (event.type === 'project_complete') {
    projects.push(event.payload);
    console.log(`[${projects.length}] ${event.payload.title}`);
  }

  if (event.type === 'pipeline_done') {
    console.log(`Total: ${event.summary.projectsEvaluated} projects`);
    break;
  }
}
```

## Filtering log events

The `log` event streams every structured agent log entry. Filter by level or phase for a noise-free view:

```ts
run.on('log', ({ entry, agent }) => {
  // Only show warnings and errors
  if (entry.level === 'warn' || entry.level === 'error') {
    console.warn(`[${agent}] ${entry.action}`, entry.details);
  }
});

// Or only show tool calls
run.on('tool_call', ({ agent, tool, input }) => {
  console.log(`[${agent}] → ${tool}`, input);
});

run.on('tool_done', ({ agent, tool, durationMs }) => {
  console.log(`[${agent}] ← ${tool} (${durationMs}ms)`);
});
```
