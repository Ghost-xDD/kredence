/**
 * Filecoin Dev Grants adapter — reads grant issues from the
 * filecoin-project/devgrants GitHub repository via the Issues API.
 *
 * Each issue represents a grant application with structured project info
 * in the body: team name, GitHub repo link, description, milestones.
 */
import { Octokit } from "@octokit/rest";
import type { ProjectRecord, ProjectSource } from "@credence/types";
import { nanoid } from "nanoid";

export type FilecoinGrantProject = Pick<
  ProjectRecord,
  "id" | "name" | "description" | "team" | "sources" | "ecosystemKind"
>;

const GITHUB_REPO_REGEX = /https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/g;
const TEAM_REGEX = /(?:team|organization|org|proposer)[:\s]+([^\n]+)/i;

/**
 * Extract GitHub repo URLs and team names from a grant issue body.
 */
function parseIssueBody(body: string): {
  githubRepos: string[];
  team: string[];
} {
  const githubRepos = [...new Set(body.match(GITHUB_REPO_REGEX) ?? [])];

  const teamMatch = body.match(TEAM_REGEX);
  const team = teamMatch
    ? teamMatch[1]
        ?.split(/[,\/]/)
        .map((s) => s.trim())
        .filter(Boolean) ?? []
    : [];

  return { githubRepos, team };
}

/**
 * Fetch grant projects from a GitHub issues-based grants repository.
 * @param repo  "owner/repo" format, defaults to "filecoin-project/devgrants"
 * @param labels  Filter labels to include (e.g. ["Open Grant", "RFP"])
 */
export async function fetchFilecoinDevGrants(
  repo = "filecoin-project/devgrants",
  labels: string[] = []
): Promise<FilecoinGrantProject[]> {
  const rawToken = process.env["GITHUB_TOKEN"] ?? "";
  const token = /^(ghp_|github_pat_|ghs_|gho_)/.test(rawToken) ? rawToken : undefined;
  if (rawToken && !token) {
    console.warn("[Scout/FilecoinDevGrants] GITHUB_TOKEN looks like a placeholder — falling back to unauthenticated (60 req/hr limit)");
  }

  // Try authenticated first; if token is expired/revoked, fall back to unauthenticated
  async function makeOctokit(auth?: string) {
    return new Octokit(auth ? { auth } : {});
  }

  let octokit = await makeOctokit(token);
  // Probe with a cheap request to detect bad credentials early
  if (token) {
    try {
      await octokit.rest.meta.get();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        console.warn("[Scout/FilecoinDevGrants] GitHub token is invalid or expired — falling back to unauthenticated");
        octokit = await makeOctokit();
      } else {
        throw err;
      }
    }
  }

  const [owner, repoName] = repo.split("/") as [string, string];

  console.log(`[Scout/FilecoinDevGrants] Fetching issues from ${repo}`);

  const issues = await octokit.paginate(octokit.issues.listForRepo, {
    owner,
    repo: repoName,
    state: "all",
    labels: labels.length > 0 ? labels.join(",") : undefined,
    per_page: 100,
  });

  // Filter out pull requests (GitHub API returns PRs mixed with issues)
  const grantIssues = issues.filter(
    (issue) =>
      !issue.pull_request &&
      issue.title.length > 0 &&
      issue.body &&
      issue.body.length > 100
  );

  console.log(`[Scout/FilecoinDevGrants] Found ${grantIssues.length} grant issues`);

  const projects: FilecoinGrantProject[] = grantIssues.map((issue) => {
    const body = issue.body ?? "";
    const { githubRepos, team } = parseIssueBody(body);

    const sources: ProjectSource[] = [
      {
        type: "submission-page",
        url: issue.html_url,
        resolvedAt: new Date().toISOString(),
      },
    ];

    for (const repoUrl of githubRepos.slice(0, 3)) {
      sources.push({ type: "github", url: repoUrl });
    }

    return {
      id: nanoid(),
      ecosystemKind: "filecoin-devgrants",
      name: issue.title,
      description: body.slice(0, 500).replace(/\r?\n/g, " ").trim(),
      team,
      sources,
    };
  });

  return projects;
}
