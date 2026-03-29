# Devfolio

Evaluate all submissions from a Devfolio hackathon.

```ts
{ kind: 'devfolio', hackathonSlug: string }
```

| Field | Type | Required | Description |
|---|---|---|---|
| `hackathonSlug` | `string` | ✓ | Hackathon subdomain slug |

## Example

```ts
const run = client.run({
  kind: 'devfolio',
  hackathonSlug: 'ethbangkok',
});
```

## Finding the slug

The slug is the subdomain of the hackathon's Devfolio URL:

```
https://ethbangkok.devfolio.co  →  slug: "ethbangkok"
https://superhack.devfolio.co   →  slug: "superhack"
```
