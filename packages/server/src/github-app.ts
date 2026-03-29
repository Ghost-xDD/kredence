/**
 * GitHub App helpers.
 *
 * Handles installation auth (JWT → installation access token) and
 * write-back (create/update .hypercert.json + open badge PR) after
 * a pipeline run triggered by a webhook event.
 *
 * Required env vars:
 *   GITHUB_APP_ID          — numeric App ID (from the App settings page)
 *   GITHUB_APP_PRIVATE_KEY — PEM private key, base64-encoded
 *   GITHUB_APP_WEBHOOK_SECRET — used in webhook.ts, not here
 */
import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";
import type { HypercertPayload } from "@credence/types";

// ── App singleton (lazy-initialised) ────────────────────────────────────────

let _app: App | null = null;

function getApp(): App | null {
  if (_app) return _app;

  const appId = process.env["GITHUB_APP_ID"];
  const rawKey = process.env["GITHUB_APP_PRIVATE_KEY"];
  if (!appId || !rawKey) return null;

  // Accept both raw PEM and base64-encoded PEM
  const privateKey = rawKey.includes("-----BEGIN")
    ? rawKey.replace(/\\n/g, "\n")
    : Buffer.from(rawKey, "base64").toString("utf-8");

  _app = new App({ appId, privateKey });
  return _app;
}

/**
 * Returns an @octokit/rest Octokit instance authenticated as the given
 * installation, or null if GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY are not set.
 *
 * We exchange an installation access token via the App JWT and then create a
 * fresh @octokit/rest Octokit with it — this gives us all the REST endpoint
 * methods (repos, pulls, git, etc.) that @octokit/app's base Octokit lacks.
 */
export async function getInstallationOctokit(installationId: number): Promise<Octokit | null> {
  const app = getApp();
  if (!app) return null;

  const { data } = await app.octokit.request(
    "POST /app/installations/{installation_id}/access_tokens",
    { installation_id: installationId }
  );

  return new Octokit({ auth: data.token });
}

// ── Write-back helpers ───────────────────────────────────────────────────────

/** Parse "owner/repo" from a full GitHub URL or an "owner/repo" string. */
export function parseRepo(repoUrl: string): { owner: string; repo: string } | null {
  const clean = repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
  const m = clean.match(/(?:github\.com\/)([^/]+)\/([^/]+)/) ?? clean.match(/^([^/]+)\/([^/]+)$/);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]! };
}

/**
 * Write (create or update) `.hypercert.json` in the default branch of the repo.
 * Returns the URL of the committed file.
 */
export async function writeHypercertJson(
  octokit: Octokit,
  owner: string,
  repo: string,
  payload: HypercertPayload
): Promise<string> {
  const content = Buffer.from(JSON.stringify(payload, null, 2)).toString("base64");
  const path = ".hypercert.json";

  // Check if the file already exists so we can include its SHA (required for updates)
  let existingSha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    if ("sha" in data) existingSha = data.sha;
  } catch {
    // 404 — file doesn't exist yet, will be created
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: existingSha
      ? "chore: update .hypercert.json [kredence]"
      : "chore: add .hypercert.json [kredence]",
    content,
    ...(existingSha ? { sha: existingSha } : {}),
  });

  return `https://github.com/${owner}/${repo}/blob/HEAD/${path}`;
}

/**
 * Open (or update) a PR that adds/updates the Kredence badge in the README.
 *
 * Badge format (shields.io endpoint):
 *   [![Kredence](https://img.shields.io/endpoint?url=https://api.kredence.xyz/badge/{slug})](https://kredence.xyz/project/{slug})
 *
 * Returns the PR URL, or null if the README could not be located.
 */
export async function openBadgePr(
  octokit: Octokit,
  owner: string,
  repo: string,
  slug: string,
  appUrl: string = "https://kredence.xyz",
  apiUrl: string = "https://credenceserver-production.up.railway.app"
): Promise<string | null> {
  const branch = "kredence/badge";
  const encodedBadgeUrl = encodeURIComponent(`${apiUrl}/badge/${slug}`);
  const badgeMarkdown =
    `[![Kredence](https://img.shields.io/endpoint?url=${encodedBadgeUrl})](${appUrl}/project/${slug})`;

  // Get the default branch SHA to base our new branch on
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;
  const { data: refData } = await octokit.git.getRef({
    owner, repo, ref: `heads/${defaultBranch}`,
  });
  const baseSha = refData.object.sha;

  // Create (or reset) the badge branch
  try {
    await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: baseSha });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 422) {
      // Branch already exists — force-update it to the current default branch tip
      await octokit.git.updateRef({ owner, repo, ref: `heads/${branch}`, sha: baseSha, force: true });
    } else {
      throw err;
    }
  }

  // Find the README file (case-insensitive search across common names)
  const readmeNames = ["README.md", "readme.md", "Readme.md", "README.MD"];
  let readmePath: string | null = null;
  let readmeContent = "";
  let readmeSha = "";

  for (const name of readmeNames) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: name, ref: branch });
      if ("content" in data && "sha" in data) {
        readmePath = name;
        readmeContent = Buffer.from(data.content, "base64").toString("utf-8");
        readmeSha = data.sha;
        break;
      }
    } catch {
      // try the next name
    }
  }

  if (!readmePath) return null;

  // Avoid duplicate badges — remove any existing Kredence badge line first
  const badgePattern = /\[!\[Kredence\].*\n?/g;
  const cleaned = readmeContent.replace(badgePattern, "");
  const updated = `${badgeMarkdown}\n\n${cleaned.trimStart()}`;

  await octokit.repos.createOrUpdateFileContents({
    owner, repo,
    path: readmePath,
    branch,
    message: "docs: add Kredence evaluation badge [kredence]",
    content: Buffer.from(updated).toString("base64"),
    sha: readmeSha,
  });

  // Check for an existing open PR from this branch to avoid duplicates
  const { data: prs } = await octokit.pulls.list({
    owner, repo, state: "open", head: `${owner}:${branch}`,
  });

  if (prs.length > 0) {
    return prs[0]!.html_url;
  }

  const { data: pr } = await octokit.pulls.create({
    owner, repo,
    title: "Add Kredence evaluation badge",
    body: [
      "This PR adds a [Kredence](https://kredence.xyz) evaluation badge to your README.",
      "",
      `**Project evaluation:** [${appUrl}/project/${slug}](${appUrl}/project/${slug})`,
      "",
      "Kredence autonomously evaluates your project's impact claims using evidence from GitHub,",
      "adversarial challenge, and synthesis into a living hypercert.",
      "",
      "_This PR was opened automatically by the Kredence GitHub App._",
    ].join("\n"),
    head: branch,
    base: defaultBranch,
  });

  return pr.html_url;
}
