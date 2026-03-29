# Filecoin Dev Grants

Evaluate active projects from the Filecoin Dev Grants program.

```ts
{ kind: 'filecoin-devgrants', repo: string, labels?: string[] }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `repo` | `string` | ✓ | GitHub repo in `owner/repo` format |
| `labels` | `string[]` | | Filter by issue labels (default: all open grants) |

## Example

```ts
// All active grants
const run = client.run({
  kind: 'filecoin-devgrants',
  repo: 'filecoin-project/devgrants',
});

// Filter by label
const run = client.run({
  kind: 'filecoin-devgrants',
  repo: 'filecoin-project/devgrants',
  labels: ['Open Grant', 'Active'],
});
```

## How discovery works

The Scout Agent queries the GitHub Issues API on the grants repository. Each issue represents a grant proposal and contains structured information: project name, team, GitHub repo link, and milestone descriptions.

## Notes

- The default repo is `filecoin-project/devgrants` — you can point at any grants repo that follows the same issue-based format.
- Common labels: `Open Grant`, `RFP`, `Next Step`, `Active`, `Complete`.
