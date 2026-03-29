/**
 * ETHGlobal Showcase adapter.
 *
 * Crawls the public showcase gallery filtered by event slug, then fetches
 * each project detail page to collect name, description, and linked URLs.
 *
 *   Gallery: https://ethglobal.com/showcase?events={eventSlug}
 *   Detail:  https://ethglobal.com/showcase/{project-slug}
 */
import { nanoid } from "nanoid";
import type { ProjectRecord, ProjectSource } from "@credence/types";

const BASE_URL = "https://ethglobal.com";
const DETAIL_CONCURRENCY = 8;

type ListingMeta = {
  projectUrl: string;
  name: string;
  description: string | undefined;
};

type DetailMeta = {
  description: string | undefined;
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

/**
 * Extract project slugs and names from the ETHGlobal showcase gallery page.
 * Projects appear as anchor tags linking to /showcase/{slug}.
 */
function extractListings(html: string): ListingMeta[] {
  const listings: ListingMeta[] = [];
  const seen = new Set<string>();

  // Match all links to /showcase/{slug} — slug contains at least one hyphen and alphanumeric suffix
  const linkRe = /href=(["'])(\/showcase\/([a-z0-9][a-z0-9-]*[a-z0-9]))\1([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(linkRe)) {
    const path = m[2];
    const slug = m[3];
    // Skip the main /showcase index link
    if (!slug || slug === "showcase" || seen.has(path!)) continue;
    seen.add(path!);

    const innerText = stripTags(m[5] ?? "");
    // ETHGlobal listing text format: "Description textEvent Name Year"
    // We parse out the name from the h2 sibling — handled via the detail page.
    // The listing text is the description + event name concatenated.

    listings.push({
      projectUrl: `${BASE_URL}${path}`,
      name: slug!, // placeholder — overwritten by detail page
      description: innerText || undefined,
    });
  }

  return listings;
}

/**
 * Extract meaningful content from an ETHGlobal project detail page.
 *
 * Structure:
 *   ## ProjectName
 *   ### Created At  →  event link
 *   ### Project Description  →  paragraphs
 *   ### How it's Made  →  tech description (may contain GitHub links)
 */
function extractDetail(html: string): DetailMeta {
  // Pull all external hrefs from the page body
  const allLinks: string[] = [];
  for (const m of html.matchAll(/href=(["'])(https?:\/\/[^"'<>\s]+)\1/gi)) {
    const href = m[2];
    if (href) allLinks.push(href);
  }

  // Grab the Project Description section text
  let description: string | undefined;
  const descStart = html.search(/###\s*Project Description/i);
  if (descStart >= 0) {
    const rest = html.slice(descStart);
    const nextSection = rest.slice(1).search(/###/);
    const section = nextSection > 0 ? rest.slice(0, nextSection + 1) : rest;
    const text = stripTags(section)
      .replace(/Project Description/i, "")
      .trim();
    if (text.length > 20) description = text.slice(0, 800);
  }

  // Also pull GitHub links from How it's Made
  const githubLinks = allLinks.filter((u) => u.includes("github.com"));
  const demoLinks = allLinks.filter(
    (u) =>
      !u.includes("ethglobal.com") &&
      !u.includes("discord.com") &&
      !u.includes("twitter.com") &&
      !u.includes("t.co") &&
      !u.includes("github.com")
  );

  return {
    description,
    links: uniq([...githubLinks, ...demoLinks]),
  };
}

/**
 * Extract the project name from the detail page h2.
 */
function extractName(html: string, fallback: string): string {
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const name = stripTags(h2?.[1] ?? "").trim();
  return name || fallback;
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
 * Fetch and normalise all projects from an ETHGlobal showcase event.
 *
 * @param eventSlug  ETHGlobal event slug, e.g. "hackmoney2026" or "bangkok"
 * @param maxProjects  Optional cap on the number of projects to fetch
 */
export async function scrapeEthGlobal(
  eventSlug: string,
  maxProjects?: number
): Promise<ProjectRecord[]> {
  const galleryUrl = `${BASE_URL}/showcase?events=${encodeURIComponent(eventSlug)}`;
  const resolvedAt = new Date().toISOString();

  console.log(`[Scout/ETHGlobal] Fetching gallery: ${galleryUrl}`);
  const galleryHtml = await fetchHtml(galleryUrl);

  let listings = extractListings(galleryHtml);
  console.log(`[Scout/ETHGlobal] Found ${listings.length} projects`);

  if (maxProjects !== undefined) {
    listings = listings.slice(0, maxProjects);
  }

  const details = await mapWithConcurrency(
    listings,
    DETAIL_CONCURRENCY,
    async (listing): Promise<{ name: string; detail: DetailMeta }> => {
      try {
        const html = await fetchHtml(listing.projectUrl);
        const name = extractName(html, listing.name);
        const detail = extractDetail(html);
        return { name, detail };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Scout/ETHGlobal] Failed detail fetch: ${listing.projectUrl} (${msg})`);
        return { name: listing.name, detail: { description: undefined, links: [] } };
      }
    }
  );

  return listings.map((listing, i): ProjectRecord => {
    const { name, detail } = details[i] ?? { name: listing.name, detail: { description: undefined, links: [] } };

    const sources: ProjectSource[] = [
      { type: "submission-page", url: listing.projectUrl, resolvedAt },
      ...detail.links.map((url): ProjectSource => ({
        type: url.includes("github.com") ? "github" : "website",
        url,
      })),
    ];

    const record: ProjectRecord = {
      id: nanoid(),
      ecosystemKind: "ethglobal",
      name,
      team: [],
      sources,
    };

    const desc = detail.description ?? listing.description;
    if (desc) record.description = desc;

    return record;
  });
}
