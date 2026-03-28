/**
 * GitHub evidence collector.
 *
 * Fetches repository metadata, commit activity, PR/issue counts, releases,
 * contributors, and README content using the GitHub REST API (Octokit).
 */
import { Octokit } from "@octokit/rest";
import type { GitHubSignals } from "@credence/types";

function getOctokit(): Octokit {
  return new Octokit({
    auth: process.env["GITHUB_TOKEN"],
    userAgent: "Credence/0.1 (impact evaluation agent)",
  });
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match?.[1] || !match?.[2]) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export async function collectGitHubEvidence(repoUrl: string): Promise<GitHubSignals> {
  const octokit = getOctokit();
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new Error(`Invalid GitHub URL: ${repoUrl}`);

  const { owner, repo } = parsed;
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Repo metadata
  const { data: repoData } = await octokit.repos.get({ owner, repo });

  // Contributors — top 20 by commit count
  let contributors: Array<{ login: string; contributions: number }> = [];
  try {
    const { data: contribs } = await octokit.repos.listContributors({
      owner,
      repo,
      per_page: 20,
    });
    contributors = contribs
      .filter((c) => c.type !== "Anonymous")
      .map((c) => ({ login: c.login ?? "anonymous", contributions: c.contributions ?? 0 }));
  } catch {
    // private or empty repo — skip
  }

  // Commits in last 90 days (up to 100; 100 = "at least 100")
  let commitCount90d = 0;
  try {
    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo,
      since: since90d,
      per_page: 100,
    });
    commitCount90d = commits.length;
  } catch {
    // no commits or private repo
  }

  // Merged PRs in last 90 days
  let mergedPRCount90d = 0;
  try {
    const { data: prs } = await octokit.pulls.list({
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100,
    });
    mergedPRCount90d = prs.filter(
      (pr) => pr.merged_at !== null && (pr.merged_at ?? "") >= since90d
    ).length;
  } catch {
    // ignore
  }

  // Closed issues in last 90 days (excludes PRs)
  let closedIssueCount90d = 0;
  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100,
    });
    closedIssueCount90d = issues.filter(
      (issue) => !issue.pull_request && (issue.closed_at ?? "") >= since90d
    ).length;
  } catch {
    // ignore
  }

  // Recent releases (last 5)
  let releases: Array<{ tag: string; publishedAt: string; body: string | null }> = [];
  try {
    const { data: releaseData } = await octokit.repos.listReleases({
      owner,
      repo,
      per_page: 5,
    });
    releases = releaseData.map((r) => ({
      tag: r.tag_name,
      publishedAt: r.published_at ?? r.created_at,
      body: r.body ? r.body.slice(0, 500) : null,
    }));
  } catch {
    // ignore — no releases
  }

  // README content (decode from base64)
  let readmeContent: string | null = null;
  try {
    const { data: readme } = await octokit.repos.getReadme({ owner, repo });
    if ("content" in readme && readme.content) {
      const decoded = Buffer.from(readme.content, "base64").toString("utf-8");
      readmeContent = decoded.slice(0, 8000);
    }
  } catch {
    // no README — that itself is a signal
  }

  return {
    repoUrl,
    description: repoData.description ?? null,
    stars: repoData.stargazers_count ?? 0,
    forks: repoData.forks_count ?? 0,
    openIssues: repoData.open_issues_count ?? 0,
    topics: repoData.topics ?? [],
    defaultBranch: repoData.default_branch ?? "main",
    pushedAt: repoData.pushed_at ?? "",
    createdAt: repoData.created_at ?? "",
    contributors,
    commitCount90d,
    mergedPRCount90d,
    closedIssueCount90d,
    releases,
    readmeContent,
  };
}
