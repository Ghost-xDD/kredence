/**
 * One-time script to inspect the Devspot DOM and figure out the correct selectors.
 * Run: cd scripts && ../node_modules/.bin/tsx inspect-devspot.ts
 */
import { config } from "dotenv";
import { join } from "path";
import { chromium } from "../packages/agents/node_modules/playwright/index.mjs";

// CWD is /credence/scripts when run via `cd scripts && tsx ...`
config({ path: join(process.cwd(), "../.env") });

const URL = "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Navigating...");
  await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    // Snapshot the key parts of the DOM to understand the structure
    const body = document.body;

    // Get all unique tag names and their class names
    const elements = Array.from(body.querySelectorAll("*")).slice(0, 300);
    const classSnapshot = elements
      .filter((el) => el.className && typeof el.className === "string" && el.className.length > 0)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className.split(" ")[0]}`)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 80);

    // Find all <a> tags with meaningful hrefs
    const links = Array.from(document.querySelectorAll("a[href]"))
      .map((a) => ({ href: a.getAttribute("href"), text: a.textContent?.trim().slice(0, 60) }))
      .filter((l) => l.href && l.href.length > 1)
      .slice(0, 30);

    // Get the full page title and any h1/h2 text
    const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
      .map((h) => `${h.tagName}: ${h.textContent?.trim().slice(0, 80)}`)
      .slice(0, 20);

    return { classSnapshot, links, headings, title: document.title };
  });

  console.log("\nPage title:", result.title);
  console.log("\nHeadings:");
  result.headings.forEach((h) => console.log(" ", h));
  console.log("\nLinks (first 30):");
  result.links.forEach((l) => console.log(`  [${l.text}] → ${l.href}`));
  console.log("\nClass snapshot (first 80 unique):");
  result.classSnapshot.forEach((c) => console.log(" ", c));

  // Also save a screenshot for visual inspection
  await page.screenshot({ path: "/tmp/devspot-snapshot.png", fullPage: false });
  console.log("\nScreenshot saved to /tmp/devspot-snapshot.png");

  await browser.close();
}

main().catch(console.error);
