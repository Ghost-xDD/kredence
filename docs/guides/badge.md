# Embed a badge

Add a live Kredence confidence badge to any GitHub README or website.

## How it works

The `/badge/:slug` endpoint returns a [shields.io endpoint JSON](https://shields.io/endpoint). Shields.io fetches this JSON and renders it as a badge — showing the project's confidence score and verified claim count, updated on every pipeline run.

## Find your project slug

```ts
import { KredenceClient } from 'kredence';

const client = new KredenceClient();
const { entries } = await client.listProjects();

for (const e of entries) {
  console.log(e.slug, e.title);
}
```

Or call the REST endpoint directly:

```bash
curl https://credenceserver-production.up.railway.app/projects \
  | jq '.entries[] | { slug, title }'
```

## Embed in a README

```markdown
![Kredence](https://img.shields.io/endpoint?url=https%3A%2F%2Fcredenceserver-production.up.railway.app%2Fbadge%2Fyour-slug)
```

Replace `your-slug` with your project's slug.

### With a link

```markdown
[![Kredence](https://img.shields.io/endpoint?url=https%3A%2F%2Fcredenceserver-production.up.railway.app%2Fbadge%2Fyour-slug)](https://kredence.xyz)
```

## Badge appearance

The badge color reflects the confidence score:

| Color | Score |
|---|---|
| 🟢 `brightgreen` | ≥ 70% |
| 🟡 `yellow` | 40–69% |
| 🔴 `red` | < 40% |

The message shows the score and verified claim count: **`72% · 4 verified`**

## Fetch badge data programmatically

```ts
const badge = await client.getBadge('safenote');

console.log(badge.message); // "72% · 4 verified"
console.log(badge.color);   // "brightgreen"
```
