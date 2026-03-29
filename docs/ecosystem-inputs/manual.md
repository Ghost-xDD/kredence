# Manual URL list

Evaluate an arbitrary list of project URLs. The simplest way to get started.

```ts
{ kind: 'manual', urls: string[] }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `urls` | `string[]` | ✓ | Array of project URLs — GitHub repos, websites, or a mix |

## Example

```ts
const run = client.run({
  kind: 'manual',
  urls: [
    'https://github.com/hypercerts-org/hypercerts',
    'https://github.com/gitcoinco/grants-stack',
    'https://myproject.xyz',
  ],
});
```

## URL resolution

For each URL, the Scout Agent:

1. If it's a GitHub URL → uses it directly as the primary evidence source
2. If it's a website URL → fetches the page and looks for a linked GitHub repository
3. Falls back to website evidence only if no GitHub repo can be resolved

## Notes

- This is the recommended input for quick one-off evaluations or testing.
- Duplicate URLs (same GitHub repo linked from multiple entries) are deduplicated automatically.
- `maxProjects` applies here too — the first N URLs after deduplication are evaluated.
