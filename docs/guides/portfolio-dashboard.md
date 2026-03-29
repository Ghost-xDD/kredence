# Build a portfolio dashboard

Display all evaluated projects in a ranked, filterable view using the Kredence SDK.

## Fetch the registry

```ts
import { KredenceClient } from 'kredence';
import type { RegistryEntry } from 'kredence';

const client = new KredenceClient();
const { entries, updatedAt } = await client.listProjects();
```

## Sort and filter

```ts
// Sort by confidence score (highest first)
const ranked = [...entries].sort((a, b) => b.confidenceScore - a.confidenceScore);

// Filter by impact category
const privacyProjects = entries.filter((e) =>
  e.impactCategory.includes('privacy')
);

// Filter out low-confidence projects
const verified = entries.filter((e) => e.confidenceScore >= 0.5);
```

## React example

```tsx
import { useEffect, useState } from 'react';
import { KredenceClient } from 'kredence';
import type { RegistryEntry } from 'kredence';

const client = new KredenceClient();

export function ProjectDashboard() {
  const [entries, setEntries] = useState<RegistryEntry[]>([]);

  useEffect(() => {
    client.listProjects().then(({ entries }) => {
      setEntries([...entries].sort((a, b) => b.confidenceScore - a.confidenceScore));
    });
  }, []);

  return (
    <ul>
      {entries.map((entry) => (
        <li key={entry.slug}>
          <strong>{entry.title}</strong>
          <span>{Math.round(entry.confidenceScore * 100)}%</span>
          <span>{entry.verifiedCount} verified · {entry.flaggedCount} flagged</span>
          <span>{entry.impactCategory.join(', ')}</span>
        </li>
      ))}
    </ul>
  );
}
```

## Drill into a project

When a user clicks a project, fetch the full hypercert:

```tsx
async function openProject(slug: string) {
  const hypercert = await client.getProject(slug);

  console.log(hypercert.evaluatorSummary);
  console.log(hypercert.verifiedClaims);
  console.log(hypercert.flaggedClaims);

  // Link to Hyperscan if published to ATProto
  if (hypercert.atproto) {
    window.open(hypercert.atproto.hyperscanUrl);
  }
}
```

## Next.js App Router example

```ts
// app/projects/page.tsx
import { KredenceClient } from 'kredence';

const client = new KredenceClient();

export default async function ProjectsPage() {
  const { entries } = await client.listProjects();
  const ranked = [...entries].sort((a, b) => b.confidenceScore - a.confidenceScore);

  return (
    <main>
      <h1>Impact Dashboard</h1>
      {ranked.map((entry) => (
        <a key={entry.slug} href={`/projects/${entry.slug}`}>
          <h2>{entry.title}</h2>
          <p>{Math.round(entry.confidenceScore * 100)}% confidence</p>
          <p>{entry.verifiedCount} verified · {entry.flaggedCount} flagged</p>
        </a>
      ))}
    </main>
  );
}

// app/projects/[slug]/page.tsx
export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const hypercert = await client.getProject(params.slug);

  return (
    <main>
      <h1>{hypercert.title}</h1>
      <p>{hypercert.evaluatorSummary}</p>
      <section>
        <h2>Verified claims</h2>
        <ul>
          {hypercert.verifiedClaims.map((c) => (
            <li key={c.id}>✓ {c.text}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Flagged claims</h2>
        <ul>
          {hypercert.flaggedClaims.map((c) => (
            <li key={c.id}>✗ {c.text} — {c.objection}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```
