/**
 * Devspot adapter — fetches projects via Devspot's internal REST API.
 *
 * API discovered via network inspection:
 * GET /api/hackathons/{hackathonId}/projects?page=1&page_size=500
 *
 * No authentication required for public hackathons.
 * No Playwright / browser needed.
 */
import type { ProjectRecord, ProjectSource } from "@credence/types";
import { nanoid } from "nanoid";

export type DevspotProject = Pick<
  ProjectRecord,
  "id" | "name" | "description" | "team" | "sources" | "ecosystemKind"
>;

type DevspotTeamMember = {
  id: number;
  status: string;
  user_id: string;
  is_project_manager: boolean;
  users: {
    full_name?: string;
    slug?: string;
    email?: string;
    main_role?: string;
    [key: string]: unknown;
  };
};

// Shape of a single project item from the API (actual field names confirmed via network inspection)
type DevspotAPIProject = {
  id: number;
  hackathon_id: number;
  name: string;
  tagline?: string | null;
  description?: string | null;
  project_url?: string | null;   // can be a GitHub URL or any project link
  demo_url?: string | null;
  video_url?: string | null;
  submitted: boolean;
  is_suspicious: boolean;
  needs_review: boolean;
  project_team_members?: DevspotTeamMember[];
  project_challenges?: Array<{ id: number; name?: string }>;
  technologies?: Array<{ name: string }> | null;
  [key: string]: unknown;
};

type DevspotAPIResponse = {
  message: string;
  data: {
    items: DevspotAPIProject[];
    pageNumber: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

/**
 * Extract the hackathon ID from a Devspot hackathon URL.
 * Falls back to a hardcoded ID if the URL doesn't contain one.
 */
function extractHackathonId(url: string): number {
  const match = url.match(/hackathons?\/(\d+)/);
  if (match?.[1]) return parseInt(match[1], 10);
  // PL Genesis hackathon ID discovered via network inspection
  return 52;
}

/**
 * Derive the base API URL from the hackathon page URL.
 * e.g. https://pl-genesis-...devspot.app/?activeTab=projects
 *   -> https://pl-genesis-...devspot.app/api/hackathons/52/projects
 */
function buildAPIUrl(hackathonUrl: string, hackathonId: number, page: number, pageSize: number): string {
  const base = new URL(hackathonUrl);
  base.pathname = `/api/hackathons/${hackathonId}/projects`;
  base.search = `?page=${page}&page_size=${pageSize}`;
  return base.toString();
}

/**
 * Fetch all projects from a Devspot hackathon via the REST API.
 * Paginates automatically if the API indicates more pages.
 */
export async function scrapeDevspot(hackathonUrl: string): Promise<DevspotProject[]> {
  const hackathonId = extractHackathonId(hackathonUrl);
  const PAGE_SIZE = 500;

  console.log(`[Scout/Devspot] Fetching projects from hackathon ID ${hackathonId} via API`);

  const allItems: DevspotAPIProject[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const apiUrl = buildAPIUrl(hackathonUrl, hackathonId, page, PAGE_SIZE);
    console.log(`[Scout/Devspot] GET ${apiUrl}`);

    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Credence/0.1 (impact evaluation agent)",
      },
    });

    if (!res.ok) {
      throw new Error(`Devspot API returned ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as DevspotAPIResponse;
    const items = json.data?.items ?? [];
    allItems.push(...items);

    hasMore = json.data?.hasNextPage === true;
    page++;
  }

  console.log(`[Scout/Devspot] Received ${allItems.length} projects from API`);

  const submitted = allItems.filter((item) => item.submitted === true);
  console.log(`[Scout/Devspot] ${submitted.length} submitted (${allItems.length - submitted.length} drafts filtered out)`);

  const BOILERPLATE_TAGLINES = new Set([
    "your project's tagline",
    "your project tagline",
    "add a tagline",
    "tagline",
  ]);

  const origin = new URL(hackathonUrl).origin;
  const resolvedAt = new Date().toISOString();

  return allItems.map((item): DevspotProject => {
    const sources: ProjectSource[] = [
      {
        type: "submission-page",
        url: `${origin}/projects/${item.id}`,
        resolvedAt,
      },
    ];

    // project_url may be a GitHub repo link or any other project URL
    const projectUrl = item.project_url ?? "";
    const demoUrl = item.demo_url ?? "";

    if (projectUrl) {
      const isGitHub = projectUrl.includes("github.com");
      sources.push({ type: isGitHub ? "github" : "website", url: projectUrl });
    }
    if (demoUrl && demoUrl !== projectUrl) {
      sources.push({ type: "website", url: demoUrl });
    }

    // Confirmed members only; prefer full_name, fall back to slug
    const team = (item.project_team_members ?? [])
      .filter((m) => m.status === "confirmed")
      .map((m) => m.users?.full_name ?? m.users?.slug ?? "")
      .filter(Boolean);

    const rawTagline = item.tagline ?? "";
    const tagline =
      rawTagline && !BOILERPLATE_TAGLINES.has(rawTagline.toLowerCase().trim())
        ? rawTagline.slice(0, 300)
        : undefined;

    // Prefer description; fall back to tagline if description is empty
    const description = item.description
      ? item.description.slice(0, 500)
      : tagline;

    const project: DevspotProject = {
      id: nanoid(),
      ecosystemKind: "devspot",
      name: item.name,
      team,
      sources,
    };

    if (description) project.description = description;

    return project;
  });
}
