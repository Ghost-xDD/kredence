# WebSocket protocol

The Kredence pipeline runs over a persistent WebSocket connection.

**Endpoint:** `wss://credenceserver-production.up.railway.app/ws`

One pipeline run per connection. The server hard-caps `maxProjects` at 10.

---

## Connection lifecycle

```
Client                          Server
  │                               │
  │─── connect /ws ──────────────>│
  │                               │
  │<── { type: "ready" } ─────────│  Server ready
  │                               │
  │─── { type: "run", ... } ─────>│  Start pipeline
  │                               │
  │<── { type: "pipeline_start" } │
  │<── { type: "stage_start" }    │  scout
  │<── { type: "log" } ...        │
  │<── { type: "tool_call" } ...  │
  │<── { type: "stage_done" }     │
  │<── { type: "stage_start" }    │  evidence
  │    ...                        │
  │<── { type: "project_complete"}│  first project done
  │    ...                        │
  │<── { type: "pipeline_done" }  │  all done
  │                               │
  └─── close ────────────────────>│
```

---

## Client → Server messages

### `run`

Start a pipeline run. Send this immediately after receiving `ready`.

```json
{
  "type": "run",
  "payload": {
    "kind": "manual",
    "urls": ["https://github.com/owner/repo"]
  },
  "maxProjects": 3
}
```

| Field | Type | Description |
|---|---|---|
| `payload` | `EcosystemInput` | The ecosystem to evaluate |
| `maxProjects` | `number` | Optional, default `3`, max `10` |

Only one `run` per connection. Subsequent `run` messages on the same connection are ignored.

### `ping`

Keep-alive ping.

```json
{ "type": "ping" }
```

The server responds with `{ "type": "pong" }`.

---

## Server → Client messages

### `ready`

Sent immediately on connection. Wait for this before sending `run`.

```json
{ "type": "ready", "serverVersion": "0.1.0" }
```

### `pipeline_start`

```json
{
  "type": "pipeline_start",
  "runId": "v8Kj3mNp",
  "ecosystem": "manual"
}
```

### `stage_start` / `stage_done`

```json
{ "type": "stage_start", "runId": "v8Kj3mNp", "stage": "scout" }
{ "type": "stage_done",  "runId": "v8Kj3mNp", "stage": "scout" }
```

Stage values: `scout` · `evidence` · `adversarial` · `synthesis`

### `log`

Structured log entry from an agent.

```json
{
  "type": "log",
  "runId": "v8Kj3mNp",
  "agent": "evidence",
  "entry": {
    "timestamp": "2026-03-29T14:24:28.378Z",
    "level": "info",
    "phase": "execute",
    "action": "fetch_github",
    "details": { "repo": "owner/repo", "commits90d": 42 }
  }
}
```

### `tool_call` / `tool_done` / `tool_error`

```json
{
  "type": "tool_call",
  "runId": "v8Kj3mNp",
  "agent": "evidence",
  "phase": "execute",
  "tool": "fetch_github_repo",
  "input": { "owner": "owner", "repo": "repo" }
}

{
  "type": "tool_done",
  "runId": "v8Kj3mNp",
  "agent": "evidence",
  "phase": "execute",
  "tool": "fetch_github_repo",
  "output": { "stars": 12, "commitCount90d": 42 },
  "durationMs": 834
}
```

### `project_complete`

Emitted once per project when the full hypercert payload is ready.

```json
{
  "type": "project_complete",
  "runId": "v8Kj3mNp",
  "payload": { ...HypercertPayload }
}
```

### `pipeline_done`

Final message. Emitted after all projects are evaluated.

```json
{
  "type": "pipeline_done",
  "runId": "v8Kj3mNp",
  "summary": {
    "projectsEvaluated": 3,
    "hypercertsStored": 3,
    "atprotoPublished": 2,
    "totalVerified": 11,
    "totalFlagged": 4,
    "totalUnresolved": 2,
    "durationMs": 94321
  }
}
```

### `pipeline_error`

Emitted if the pipeline fails unrecoverably.

```json
{
  "type": "pipeline_error",
  "runId": "v8Kj3mNp",
  "stage": "evidence",
  "message": "GitHub API rate limit exceeded"
}
```

---

## Raw WebSocket example (no SDK)

```ts
const ws = new WebSocket('wss://credenceserver-production.up.railway.app/ws');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'ready') {
    ws.send(JSON.stringify({
      type: 'run',
      payload: { kind: 'manual', urls: ['https://github.com/owner/repo'] },
      maxProjects: 2,
    }));
  }

  if (msg.type === 'project_complete') {
    console.log(msg.payload.title, msg.payload.confidenceScore);
  }

  if (msg.type === 'pipeline_done') {
    console.log('Done:', msg.summary);
    ws.close();
  }
};
```

::: tip
Use the [SDK](/sdk/pipeline-run) instead of raw WebSocket — it handles reconnection edge cases, typed events, async iteration, and the `ready` → `run` handshake automatically.
:::
