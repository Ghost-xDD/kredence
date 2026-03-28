/**
 * Website evidence collector.
 *
 * Fetches a URL, checks liveness, and extracts title, meta description,
 * and cleaned body text for claim extraction.
 */
import type { WebsiteSignals } from "@credence/types";

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function extractMetaDescription(html: string): string | null {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,500})["']/i,
    /<meta[^>]+content=["']([^"']{1,500})["'][^>]+name=["']description["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,500})["']/i,
    /<meta[^>]+content=["']([^"']{1,500})["'][^>]+property=["']og:description["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractBodyText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

export async function collectWebsiteEvidence(url: string): Promise<WebsiteSignals> {
  const fetchedAt = new Date().toISOString();

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Credence/0.1 (impact evaluation agent)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });

    const statusCode = res.status;
    const isLive = res.ok;

    const contentType = res.headers.get("content-type") ?? "";
    let bodyText = "";
    let title: string | null = null;
    let description: string | null = null;

    if (contentType.includes("text/html") || contentType.includes("text/plain")) {
      const html = await res.text();
      title = extractTitle(html);
      description = extractMetaDescription(html);
      bodyText = extractBodyText(html);
    } else {
      // Non-HTML (JSON API, etc.) — mark as live but no extractable text
      await res.body?.cancel();
    }

    return { url, title, description, bodyText, fetchedAt, statusCode, isLive };
  } catch {
    // Timeout, DNS failure, connection refused, etc.
    return {
      url,
      title: null,
      description: null,
      bodyText: "",
      fetchedAt,
      statusCode: 0,
      isLive: false,
    };
  }
}
