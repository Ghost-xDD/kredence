# Gitcoin

Evaluate all projects funded in a Gitcoin grants round.

```ts
{ kind: 'gitcoin', roundId: string, chainId?: number }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `roundId` | `string` | ✓ | Grants round contract address |
| `chainId` | `number` | | Chain ID (default: `42161` — Arbitrum One) |

## Example

```ts
const run = client.run({
  kind: 'gitcoin',
  roundId: '0x1234567890abcdef1234567890abcdef12345678',
  chainId: 42161,
});
```

## Supported chains

| Chain | ID |
|---|---|
| Arbitrum One | 42161 |
| Optimism | 10 |
| Ethereum Mainnet | 1 |

## Notes

- The Scout Agent queries the Gitcoin Grants Stack API to enumerate all applications in the round.
- Each application is resolved to a GitHub repository for evidence collection.
- Projects without a linked GitHub repo are evaluated on website evidence only.
