# GitHub Repo

Evaluate a single GitHub repository directly.

```ts
{ kind: 'github-repo', repoUrl: string, installationId?: number }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `repoUrl` | `string` | ✓ | Full GitHub repo URL |
| `installationId` | `number` | | GitHub App installation ID for write-back after evaluation |

## Example

```ts
const run = client.run({
  kind: 'github-repo',
  repoUrl: 'https://github.com/hypercerts-org/hypercerts',
});
```

## Notes

- The evidence agent fetches commits, PRs, issues, releases, and README from the GitHub API.
- If `installationId` is provided, the hypercert payload is written back to the repository after the pipeline completes (via the Kredence GitHub App).
- Private repositories require a GitHub App installation with read access.
