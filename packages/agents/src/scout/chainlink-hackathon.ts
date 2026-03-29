/**
 * Chainlink Convergence Hackathon adapter.
 *
 * Crawls the public gallery page and then each project detail page:
 *   https://chain.link/hack-26
 *   https://chain.link/hack-26/projects/{slug}
 */
import { nanoid } from "nanoid";
import type { ProjectRecord, ProjectSource } from "@credence/types";

export type ChainlinkProject = Pick<
  ProjectRecord,
  "id" | "name" | "description" | "team" | "sources" | "ecosystemKind"
>;

const DEFAULT_GALLERY_URL = "https://chain.link/hack-26";
const DEFAULT_MAX_PROJECTS = 553;
const DETAIL_CONCURRENCY = 8;

const TRACKS = [
  "Autonomous Agents",
  "CRE & AI",
  "DeFi & Tokenization",
  "Prediction Markets",
  "Privacy",
  "Risk & Compliance",
] as const;

type ListingMeta = {
  projectUrl: string;
  listingText?: string;
};

type DetailMeta = {
  name: string;
  track?: string;
  demoUrl?: string;
  links: string[];
};

function stripTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toAbsolute(baseUrl: string, maybeRelative: string): string {
  return new URL(maybeRelative, baseUrl).toString();
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Credence/0.1 (impact evaluation agent)",
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed ${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

function extractListingMeta(galleryUrl: string, html: string): ListingMeta[] {
  const hrefRe = /href=(["'])(\/hack-26\/projects\/[^"'#?\s<>]+)\1/gi;
  const urls: string[] = [];
  for (const m of html.matchAll(hrefRe)) {
    const rel = m[2];
    if (rel) urls.push(toAbsolute(galleryUrl, rel));
  }

  const uniqueUrls = uniq(urls);
  const listingByUrl = new Map<string, ListingMeta>();
  for (const projectUrl of uniqueUrls) {
    listingByUrl.set(projectUrl, { projectUrl });
  }

  // Attempt to capture short listing text near each project URL on the gallery page.
  for (const [projectUrl] of listingByUrl) {
    const relPath = new URL(projectUrl).pathname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const snippetRe = new RegExp(
      `<a[^>]+href=(["'])${relPath}\\1[^>]*>([\\s\\S]*?)<\\/a>`,
      "i"
    );
    const m = html.match(snippetRe);
    if (!m?.[2]) continue;
    const listingText = stripTags(m[2]);
    if (listingText) {
      listingByUrl.set(projectUrl, { projectUrl, listingText });
    }
  }

  return [...listingByUrl.values()];
}

function extractDetailMeta(projectUrl: string, html: string): DetailMeta {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const name = stripTags(h1Match?.[1] ?? "") || projectUrl;

  const demoMatch = html.match(
    /<a[^>]+href=(["'])(https?:\/\/[^"'<>]+)\1[^>]*>\s*View Demo\s*<\/a>/i
  );
  const demoUrl = demoMatch?.[2];

  const text = stripTags(html);
  const track = TRACKS.find((t) => text.includes(t));

  const links: string[] = [];
  const linksHeader = html.search(/<h2[^>]*>\s*Links\s*<\/h2>/i);
  if (linksHeader >= 0) {
    const rest = html.slice(linksHeader);
    const stopAt = rest.search(/<h[12][^>]*>/i);
    const section = stopAt > 0 ? rest.slice(0, stopAt) : rest;
    for (const m of section.matchAll(/href=(["'])(https?:\/\/[^"'<>]+)\1/gi)) {
      const href = m[2];
      if (href) links.push(href);
    }
  }

  return {
    name,
    ...(track ? { track } : {}),
    ...(demoUrl ? { demoUrl } : {}),
    links: uniq(links),
  };
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const out: Array<U | undefined> = new Array<U | undefined>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor;
      if (i >= items.length) return;
      cursor += 1;
      const item = items[i];
      if (item === undefined) return;
      out[i] = await fn(item, i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return out as U[];
}

/**
 * Fetch projects from Chainlink Convergence gallery and detail pages.
 */
export async function scrapeChainlinkHackathon(
  galleryUrl = DEFAULT_GALLERY_URL,
  maxProjects = DEFAULT_MAX_PROJECTS
): Promise<ChainlinkProject[]> {
  const resolvedAt = new Date().toISOString();
  const galleryHtml = await fetchHtml(galleryUrl);

  const listings = extractListingMeta(galleryUrl, galleryHtml).slice(0, maxProjects);
  console.log(`[Scout/Chainlink] Found ${listings.length} project links on gallery`);

  const details = await mapWithConcurrency(listings, DETAIL_CONCURRENCY, async (listing) => {
    try {
      const detailHtml = await fetchHtml(listing.projectUrl);
      return extractDetailMeta(listing.projectUrl, detailHtml);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Scout/Chainlink] Failed detail fetch: ${listing.projectUrl} (${msg})`);
      return {
        name: listing.projectUrl,
        links: [],
      } satisfies DetailMeta;
    }
  });

  return listings.map((listing, i): ChainlinkProject => {
    const detail = details[i] ?? { name: listing.projectUrl, links: [] };
    const externalLinks = uniq([
      ...(detail.demoUrl ? [detail.demoUrl] : []),
      ...detail.links,
    ]).filter((url) => !url.startsWith("https://chain.link/hack-26"));

    const sources: ProjectSource[] = [
      { type: "submission-page", url: listing.projectUrl, resolvedAt },
      ...externalLinks.map((url): ProjectSource => ({
        type: url.includes("github.com") ? "github" : "website",
        url,
      })),
    ];

    let description = listing.listingText;
    if (description && detail.track) {
      description = description.replace(new RegExp(`\\b${escapeRegExp(detail.track)}\\b`, "i"), "").trim();
    }
    if (!description && detail.track) {
      description = `${detail.track} submission`;
    }

    const project: ChainlinkProject = {
      id: nanoid(),
      ecosystemKind: "chainlink-hackathon",
      name: detail.name,
      team: [],
      sources,
    };

    if (description) {
      project.description = description.slice(0, 500);
    }

    return project;
  });
}
