# REST endpoints

Base URL: `https://credenceserver-production.up.railway.app`

All responses are JSON. Non-2xx responses return `{ error: string, detail?: string }`.

---

## GET /health

Liveness check. Used by load balancers and health monitors.

```
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "ts": "2026-03-29T14:24:28.378Z"
}
```

**Example:**

::: code-group

```ts [SDK]
const health = await client.health();
```

```bash [curl]
curl https://credenceserver-production.up.railway.app/health
```

:::

---

## GET /projects

List all evaluated projects in the registry. Returns compact summary entries.

```
GET /projects
```

**Response:** `HypercertRegistry`

```json
{
  "updatedAt": "2026-03-28T16:37:40.500Z",
  "entries": [
    {
      "slug": "safenote",
      "cid": "bafybeig...",
      "filename": "hypercert-safenote.json",
      "title": "Safenote",
      "description": "Securely store and share private notes and messages.",
      "confidenceScore": 0.72,
      "verifiedCount": 4,
      "flaggedCount": 0,
      "unresolvedCount": 5,
      "impactCategory": ["privacy", "social"],
      "workScopes": ["web-app"],
      "contributors": ["codeaashu"],
      "hasAtproto": true,
      "atprotoUrl": "https://www.hyperscan.dev/data?...",
      "runId": "abc123",
      "evaluatedAt": "2026-03-28T16:37:40.500Z"
    }
  ]
}
```

**Example:**

::: code-group

```ts [SDK]
const registry = await client.listProjects();
```

```bash [curl]
curl https://credenceserver-production.up.railway.app/projects
```

:::

---

## GET /projects/:slug

Fetch the full `HypercertPayload` for a project. The payload is retrieved from Storacha.

```
GET /projects/:slug
```

**Parameters:**

| Name | In | Type | Description |
|---|---|---|---|
| `slug` | path | `string` | URL-safe project identifier |

**Response:** `HypercertPayload`

```json
{
  "title": "Safenote",
  "description": "...",
  "contributors": [{ "name": "codeaashu", "githubLogin": "codeaashu" }],
  "timeframeStart": "2025-09-01",
  "timeframeEnd": "2026-03-28",
  "impactCategory": ["privacy", "social"],
  "workScopes": ["web-app"],
  "evidenceRefs": [
    { "label": "GitHub repository", "url": "https://github.com/codeaashu/Safenote" }
  ],
  "verifiedClaims": [
    {
      "id": "c1",
      "text": "The repository has had 1 commit in the last 90 days.",
      "supportingEvidence": ["GitHub commit history"]
    }
  ],
  "flaggedClaims": [],
  "openQuestions": [],
  "evaluatorSummary": "Safenote is a web-based application...",
  "confidenceScore": 0.72,
  "evaluatedBy": [...],
  "storachaRefs": {
    "evidenceBundleCid": "bafybeig...",
    "adversarialLogCid": "bafybeig..."
  },
  "generatedAt": "2026-03-28T16:37:40.500Z"
}
```

**Errors:**

| Status | Condition |
|---|---|
| `404` | Project slug not found in registry |
| `502` | Failed to fetch payload from Storacha |

**Example:**

::: code-group

```ts [SDK]
const hypercert = await client.getProject('safenote');
```

```bash [curl]
curl https://credenceserver-production.up.railway.app/projects/safenote
```

:::

---

## GET /badge/:slug

Returns a [shields.io endpoint JSON](https://shields.io/endpoint) for embedding as a badge.

```
GET /badge/:slug
```

**Parameters:**

| Name | In | Type | Description |
|---|---|---|---|
| `slug` | path | `string` | URL-safe project identifier |

**Response:**

```json
{
  "schemaVersion": 1,
  "label": "Kredence",
  "message": "72% · 4 verified",
  "color": "brightgreen",
  "namedLogo": "github"
}
```

Color thresholds: `brightgreen` ≥ 70% · `yellow` ≥ 40% · `red` < 40%

**Embed in README:**

```markdown
![Kredence](https://img.shields.io/endpoint?url=https://credenceserver-production.up.railway.app/badge/your-slug)
```

**Example:**

::: code-group

```ts [SDK]
const badge = await client.getBadge('safenote');
```

```bash [curl]
curl https://credenceserver-production.up.railway.app/badge/safenote
```

:::

---

## GET /ws-info

Returns the WebSocket URL for the current server. Useful for client configuration.

```
GET /ws-info
```

**Response:**

```json
{
  "url": "wss://credenceserver-production.up.railway.app/ws"
}
```
