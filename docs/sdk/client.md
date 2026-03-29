# KredenceClient

The main entry point for all Kredence API interactions.

## Constructor

```ts
import { KredenceClient } from 'kredence';

const client = new KredenceClient(options?)
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `"https://credenceserver-production.up.railway.app"` | Base URL of the Kredence API server |
| `WebSocket` | `typeof WebSocket` | `globalThis.WebSocket` | Override for environments without native WebSocket (Node < 22) |

```ts
// Default — connects to hosted server
const client = new KredenceClient();

// Self-hosted
const client = new KredenceClient({
  baseUrl: 'http://localhost:3001',
});

// Node.js < 22
import WebSocket from 'ws';
const client = new KredenceClient({ WebSocket });
```

---

## REST methods

All REST methods use `fetch` internally and throw a [`KredenceError`](#kredenceerror) on non-2xx responses.

### `health()`

Check that the server is reachable and healthy.

```ts
const health = await client.health();
```

**Returns:** `HealthResponse`

```ts
type HealthResponse = {
  status: 'ok';
  version: string;
  ts: string; // ISO timestamp
};
```

**Example:**

```ts
const { status, version, ts } = await client.health();
console.log(`Server v${version} is ${status} as of ${ts}`);
```

---

### `listProjects()`

List all evaluated projects in the registry. Returns compact summary entries — use [`getProject()`](#getproject) for the full hypercert payload.

```ts
const registry = await client.listProjects();
```

**Returns:** `HypercertRegistry`

```ts
type HypercertRegistry = {
  updatedAt: string;       // ISO timestamp of last pipeline run
  entries: RegistryEntry[];
};

type RegistryEntry = {
  slug: string;            // URL-safe identifier, use with getProject()
  title: string;
  description: string;
  confidenceScore: number; // 0–1
  verifiedCount: number;
  flaggedCount: number;
  unresolvedCount: number;
  impactCategory: string[];
  workScopes: string[];
  contributors: string[];  // display names
  hasAtproto: boolean;
  atprotoUrl?: string;     // Hyperscan link if published to ATProto
  runId: string;
  evaluatedAt: string;
};
```

**Example:**

```ts
const { entries } = await client.listProjects();

// Sort by confidence
const ranked = [...entries].sort((a, b) => b.confidenceScore - a.confidenceScore);

for (const p of ranked) {
  const pct = Math.round(p.confidenceScore * 100);
  console.log(`${p.title} — ${pct}% (${p.verifiedCount}✓ ${p.flaggedCount}✗)`);
}
```

---

### `getProject(slug)`

Fetch the full `HypercertPayload` for a project. The payload is retrieved from Storacha.

```ts
const hypercert = await client.getProject('safenote');
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `slug` | `string` | URL-safe project identifier from `RegistryEntry.slug` |

**Returns:** `HypercertPayload`

**Throws:** `KredenceError` with `statusCode: 404` if the project doesn't exist.

**Example:**

```ts
const hypercert = await client.getProject('zkmarket');

console.log(hypercert.evaluatorSummary);

for (const claim of hypercert.verifiedClaims) {
  console.log('✓', claim.text);
}

for (const claim of hypercert.flaggedClaims) {
  console.log('✗', claim.text, '—', claim.objection);
}
```

---

### `getBadge(slug)`

Fetch the [shields.io endpoint JSON](https://shields.io/endpoint) for a project.

```ts
const badge = await client.getBadge('safenote');
```

**Returns:** `BadgeResponse`

```ts
type BadgeResponse = {
  schemaVersion: 1;
  label: string;
  message: string; // e.g. "72% · 4 verified"
  color: string;   // "brightgreen" | "yellow" | "red"
  namedLogo?: string;
};
```

Embed directly in any README:

```markdown
![Kredence](https://img.shields.io/endpoint?url=https://credenceserver-production.up.railway.app/badge/your-slug)
```

See the [Badge guide](/guides/badge) for full instructions.

---

### `run(input, options?)`

Start an autonomous evaluation pipeline run over WebSocket. Returns a [`PipelineRun`](/sdk/pipeline-run).

```ts
const run = client.run(input, options?)
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `input` | `EcosystemInput` | The ecosystem to evaluate |
| `options.maxProjects` | `number` | Projects to evaluate (default `3`, max `10`) |

**Returns:** [`PipelineRun`](/sdk/pipeline-run)

**Example:**

```ts
const run = client.run(
  { kind: 'gitcoin', roundId: '0x...' },
  { maxProjects: 5 }
);

run.on('project_complete', (payload) => console.log(payload.title));
const summary = await run.completed();
```

See [Ecosystem inputs](/ecosystem-inputs/github-repo) for all `EcosystemInput` shapes.

---

## KredenceError

Thrown by REST methods when the server returns a non-2xx status.

```ts
import { KredenceClient, KredenceError } from 'kredence';

try {
  const hypercert = await client.getProject('unknown-slug');
} catch (err) {
  if (err instanceof KredenceError) {
    console.error(err.statusCode); // 404
    console.error(err.message);    // "404 Not Found: not found"
  }
}
```

| Property | Type | Description |
|---|---|---|
| `statusCode` | `number` | HTTP status code |
| `message` | `string` | Human-readable error message |
