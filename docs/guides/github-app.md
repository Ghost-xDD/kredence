# Install the GitHub App

The Kredence GitHub App connects directly to your repository. When installed, any push to your default branch automatically triggers a full pipeline run — Scout through Synthesis — and the results appear in the Kredence dashboard within minutes.

No manual pipeline invocation. No API calls. Just install and ship.

## What the app does

When you push to a monitored repository, the GitHub App webhook fires and Kredence:

1. **Evaluates your repository** as a single-project ecosystem input
2. **Collects evidence** — commits, PRs, releases, live URLs, onchain activity
3. **Challenges every claim** extracted from your README and submission content
4. **Updates your hypercert** — confidence score, verified claims, flagged items
5. **Opens a PR** adding a `.hypercert.json` file to your repo root (optional)

Your badge automatically reflects the new score after each run.

## Install

Click the button below to install the Kredence GitHub App on your account or organisation:

**[→ Install Kredence on GitHub](https://github.com/apps/kredence/installations/new)**

You can scope the installation to specific repositories or grant access to all repositories.

## After installing

1. **Your repository appears in the dashboard** at [kredence.xyz](https://kredence.xyz) within a few minutes of the first push
2. **Grab your project slug** from the dashboard or via the API:

```bash
curl https://credenceserver-production.up.railway.app/projects \
  | jq '.entries[] | { slug, title }'
```

3. **Embed your badge** in your README:

```markdown
[![Kredence](https://img.shields.io/endpoint?url=https%3A%2F%2Fcredenceserver-production.up.railway.app%2Fbadge%2Fyour-slug)](https://kredence.xyz)
```

## Permissions the app requests

| Permission | Reason |
|---|---|
| **Contents** (read) | Read `README.md`, commit history, and file structure |
| **Metadata** (read) | Required for all GitHub Apps |
| **Pull requests** (write) | Open a PR adding `.hypercert.json` after each run |

The app never writes to your main branch directly. All changes come through a pull request you control.

## Trigger a run manually

You can also trigger a pipeline run without waiting for a push, using the SDK:

```ts
import { KredenceClient } from 'kredence';

const client = new KredenceClient();

const run = client.run({
  kind: 'github',
  repoUrl: 'https://github.com/your-org/your-repo',
});

run.on('project_complete', (payload) => {
  console.log(payload.title, `${Math.round(payload.confidenceScore * 100)}%`);
});

await run.completed();
```

## Uninstall

Go to [github.com/settings/installations](https://github.com/settings/installations), find Kredence, and click **Uninstall**. Your existing hypercert data is retained and still accessible via the API.
