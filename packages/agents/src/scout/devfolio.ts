/**
 * Devfolio hackathon adapter.
 *
 * Uses Devfolio's public search API to enumerate all project submissions for a
 * given hackathon slug:
 *   POST https://api.devfolio.co/api/search/projects/
 *   Body: { hackathon_slug, count, page }
 *
 * Returns hits from Elasticsearch with full project source documents.
 */
import { nanoid } from "nanoid";
import type { ProjectRecord } from "@credence/types";
import type { ProjectSource } from "@credence/types";

const SEARCH_URL = "https://api.devfolio.co/api/search/projects/";
const UA = "Mozilla/5.0 (compatible; Credence/0.1)";
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

type DevfolioMember = {
  first_name?: string;
  last_name?: string;
  username?: string;
};

type DevfolioProject = {
  name?: string;
  slug?: string;
  tagline?: string;
  description?: Array<{ title?: string; content?: string }>;
  links?: string;
  members?: DevfolioMember[];
  prize_tracks?: Array<{ name?: string }>;
};

type SearchHit = {
  _source?: DevfolioProject;
};

type SearchResponse = {
  hits?: {
    total?: { value?: number };
    hits?: SearchHit[];
  };
};

function memberName(m: DevfolioMember): string {
  return [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username || "";
}

async function fetchPage(hackathonSlug: string, page: number): Promise<SearchResponse> {
  const body = JSON.stringify({ hackathon_slug: hackathonSlug, count: PAGE_SIZE, page });
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": UA,
    },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from Devfolio search`);
  return res.json() as Promise<SearchResponse>;
}

export async function scrapeDevfolio(hackathonSlug: string): Promise<ProjectRecord[]> {
  console.log(`[Scout/Devfolio] Starting scrape for slug="${hackathonSlug}"`);
  const resolvedAt = new Date().toISOString();
  const projects: ProjectRecord[] = [];

  let page = 1;
  let totalExpected: number | undefined;

  while (page <= MAX_PAGES) {
    let data: SearchResponse;
    try {
      data = await fetchPage(hackathonSlug, page);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Scout/Devfolio] Page ${page} failed: ${msg}`);
      break;
    }

    const hits = data.hits?.hits ?? [];
    if (totalExpected === undefined) {
      totalExpected = data.hits?.total?.value;
      console.log(`[Scout/Devfolio] Total hits: ${totalExpected ?? "?"}`);
    }

    if (hits.length === 0) break;

    for (const hit of hits) {
      const s = hit._source;
      if (!s) continue;

      const projectUrl = s.slug
        ? `https://devfolio.co/projects/${s.slug}`
        : undefined;

      const sources: ProjectSource[] = [];
      if (projectUrl) {
        sources.push({ type: "submission-page", url: projectUrl, resolvedAt });
      }
      if (s.links) {
        const type = s.links.includes("github.com") ? "github" : "website";
        sources.push({ type, url: s.links });
      }

      const descBlocks = (s.description ?? [])
        .map((b) => `${b.title ? b.title + ": " : ""}${b.content ?? ""}`)
        .join(" ")
        .trim();

      const proj: ProjectRecord = {
        id: nanoid(),
        ecosystemKind: "devfolio",
        name: s.name ?? s.slug ?? "Unknown",
        team: (s.members ?? []).map((m) => memberName(m)).filter(Boolean),
        sources,
      };
      const desc = (s.tagline || descBlocks).slice(0, 500);
      if (desc) proj.description = desc;
      projects.push(proj);
    }

    if (hits.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`[Scout/Devfolio] Scraped ${projects.length} projects from "${hackathonSlug}"`);
  return projects;
}
