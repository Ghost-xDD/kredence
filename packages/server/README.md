# @credence/server

Real-time WebSocket server for the Credence evaluation pipeline.

Runs **Scout → Evidence → Adversarial → Synthesis** and streams every agent log entry, tool call, and project result to connected clients over WebSocket.

## Quick start

```bash
# From repo root — builds packages then starts the server in watch mode
pnpm dev:server

# Server listens on http://localhost:3001
# WebSocket at   ws://localhost:3001/ws
```

## Environment variables

Copy `.env.example` from the repo root and fill in all values. The server loads `.env` automatically in development.

| Variable | Required | Description |
|---|---|---|
| `PORT` | no (default: 3001) | HTTP port |
| `CORS_ORIGIN` | no (default: *) | Allowed CORS origin(s), e.g. `https://credence.xyz` |
| `OPENAI_API_KEY` | **yes** | GPT-4o for claim extraction, adversarial review, evaluator summary |
| `STORACHA_*` | **yes** | Storacha client credentials (see `.env.example`) |
| `GITHUB_TOKEN` | **yes** | GitHub API token for Evidence agent |
| `OPERATOR_PRIVATE_KEY` | **yes** | Ethereum private key for EIP-191 signing |
| `SCOUT_AGENT_ID` / `EVIDENCE_AGENT_ID` / `ADVERSARIAL_AGENT_ID` / `SYNTHESIS_AGENT_ID` | yes | ERC-8004 token IDs |
| `HYPERCERTS_HANDLE` / `HYPERCERTS_APP_PASSWORD` | no | ATProto credentials for Hyperscan publishing |

## WebSocket protocol

Connect to `ws://localhost:3001/ws` (or `wss://…` in production).

### Client → Server

```jsonc
// Start a pipeline run
{ "type": "run", "payload": { "kind": "devspot", "url": "https://…" }, "maxProjects": 3 }

// Keepalive
{ "type": "ping" }
```

### Server → Client (event stream)

```jsonc
{ "type": "ready",            "serverVersion": "0.1.0" }
{ "type": "pipeline_start",  "runId": "abc123", "ecosystem": "devspot" }
{ "type": "stage_start",     "runId": "abc123", "stage": "scout" }
{ "type": "log",             "runId": "abc123", "agent": "scout", "entry": { "phase": "execute", "action": "scout:adapter-devspot", … } }
{ "type": "tool_call",       "runId": "abc123", "agent": "scout", "tool": "scrape_devspot_hackathon", "input": "https://…" }
{ "type": "tool_done",       "runId": "abc123", "agent": "scout", "tool": "scrape_devspot_hackathon", "output": "178 projects", "durationMs": 3200 }
{ "type": "stage_done",      "runId": "abc123", "stage": "scout" }
{ "type": "stage_start",     "runId": "abc123", "stage": "evidence" }
// … more log / tool_call / tool_done / tool_error events …
{ "type": "project_complete","runId": "abc123", "payload": { /* HypercertPayload */ } }
{ "type": "pipeline_done",   "runId": "abc123", "summary": { "projectsEvaluated": 3, "hypercertsStored": 3, … } }
```

### Error handling

```jsonc
{ "type": "pipeline_error", "runId": "abc123", "stage": "evidence", "message": "GitHub API rate limit exceeded" }
```

## Deployment

### Railway / Render / Fly.io

1. Point the platform at the repo root.
2. Set **build command**: `pnpm build` and **start command**: `node packages/server/dist/index.js`.
3. Add all environment variables from the table above.
4. The platform terminates TLS — your frontend connects via `wss://`.

### Docker (bare VPS)

```bash
# From repo root
docker build -f packages/server/Dockerfile -t credence-server .
docker run -p 3001:3001 --env-file .env credence-server
```

Put **nginx** or **Caddy** in front for WSS:

```nginx
# nginx example
server {
    listen 443 ssl;
    server_name api.credence.xyz;

    ssl_certificate     /etc/letsencrypt/live/api.credence.xyz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.credence.xyz/privkey.pem;

    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;   # long-lived connection for full pipeline run
    }

    location / {
        proxy_pass http://localhost:3001;
    }
}
```

## Connecting from the Next.js frontend

```typescript
const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws");

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  switch (msg.type) {
    case "stage_start":      /* update stage indicator */ break;
    case "log":              /* append to event feed   */ break;
    case "tool_call":        /* show active tool       */ break;
    case "tool_done":        /* update tool result     */ break;
    case "project_complete": /* add result card        */ break;
    case "pipeline_done":    /* show summary           */ break;
    case "pipeline_error":   /* show error state       */ break;
  }
};

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "run",
    payload: { kind: "devspot", url: "https://pl-genesis-…devspot.app/?activeTab=projects" },
    maxProjects: 3,
  }));
};
```
