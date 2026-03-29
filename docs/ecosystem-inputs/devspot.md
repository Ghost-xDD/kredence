# Devspot

Evaluate all submissions from a Devspot hackathon.

```ts
{ kind: 'devspot', url: string }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | `string` | ✓ | Full URL to the hackathon projects tab |

## Example

```ts
const run = client.run({
  kind: 'devspot',
  url: 'https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects',
});
```

## How discovery works

The Scout Agent scrapes the Devspot projects tab. Each project card contains:
- Project name and tagline
- Team members
- GitHub repository link
- Demo URL
- Tech tags

The scraper handles pagination automatically to discover all submissions.

## Notes

- The `url` must point to the `?activeTab=projects` view of the hackathon.
- Projects without a GitHub link are evaluated on submission page content only.
