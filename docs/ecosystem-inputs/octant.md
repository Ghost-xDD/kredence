# Octant

Evaluate projects from an Octant funding epoch.

```ts
{ kind: 'octant', epochNumber?: number }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `epochNumber` | `number` | | Epoch to fetch (default: latest — epoch 7) |

## Example

```ts
// Latest epoch
const run = client.run({ kind: 'octant' });

// Specific epoch
const run = client.run({
  kind: 'octant',
  epochNumber: 6,
});
```

## Notes

- Octant funds Ethereum public goods projects. Projects are sourced from the Octant API.
- Omit `epochNumber` to evaluate the most recent epoch automatically.
