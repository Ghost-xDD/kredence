import { config } from "dotenv";
import { join } from "path";
import { chromium } from "../packages/agents/node_modules/playwright/index.mjs";

config({ path: join(process.cwd(), "../.env") });

const URL = "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Use 'load' instead of 'networkidle' — SPA keeps background polling
  await page.goto(URL, { waitUntil: "load", timeout: 30_000 });

  // Wait for project names to appear — visible in screenshot as "Mini Hunt", "Team Ladybug"
  // Try waiting for any card-like text to appear
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    // Find all divs that have "rounded" in their class and contain visible text
    const allDivs = Array.from(document.querySelectorAll("div, article, section"));
    const candidates = allDivs.filter((el) => {
      const cls = (el as HTMLElement).className?.toString() ?? "";
      const text = el.textContent?.trim() ?? "";
      return (
        cls.includes("rounded") &&
        el.children.length >= 2 &&
        text.length > 10 &&
        text.length < 500
      );
    });

    return candidates.slice(0, 10).map((el) => ({
      tag: el.tagName,
      className: (el as HTMLElement).className?.toString().slice(0, 80),
      text: el.textContent?.trim().replace(/\s+/g, " ").slice(0, 200),
      childCount: el.children.length,
      links: Array.from(el.querySelectorAll("a")).map((a) => a.getAttribute("href")),
    }));
  });

  console.log("Card candidates:", result.length);
  result.forEach((c, i) => {
    console.log(`\n[${i}] <${c.tag}> children=${c.childCount}`);
    console.log("  class:", c.className);
    console.log("  text:", c.text);
    console.log("  links:", c.links);
  });

  // Get all hrefs that are project-specific (on the hackathon subdomain)
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]"))
      .map((a) => ({ href: a.getAttribute("href"), text: a.textContent?.trim().slice(0, 50) }))
  );
  console.log("\nAll links:", links.slice(0, 20));

  await page.screenshot({ path: "/tmp/devspot2.png", fullPage: false });
  await browser.close();
}

main().catch(console.error);
