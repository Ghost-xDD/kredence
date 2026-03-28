import { config } from "dotenv";
import { join } from "path";
import { chromium } from "../packages/agents/node_modules/playwright/index.mjs";

config({ path: join(process.cwd(), "../.env") });

const URL = "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    // Target the card containers
    const cards = Array.from(document.querySelectorAll("div.rounded-\\[12px\\]"));
    console.log("Cards found:", cards.length);

    return cards.slice(0, 5).map((card) => {
      // Get all text nodes and their parent tags
      const textNodes = Array.from(card.querySelectorAll("*"))
        .filter((el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 0)
        .map((el) => ({
          tag: el.tagName,
          className: (el as HTMLElement).className?.toString().slice(0, 60),
          text: el.textContent?.trim().slice(0, 80),
        }));

      // All links within the card
      const links = Array.from(card.querySelectorAll("a[href]")).map((a) => ({
        href: a.getAttribute("href"),
        text: a.textContent?.trim().slice(0, 40),
      }));

      // Card's own href or onclick
      const cardEl = card as HTMLElement;
      return {
        hasLink: !!card.querySelector("a"),
        cardOnClick: cardEl.getAttribute("onclick"),
        cardRole: cardEl.getAttribute("role"),
        links,
        textNodes,
      };
    });
  });

  result.forEach((card, i) => {
    console.log(`\n── Card ${i + 1} ──`);
    console.log("Links:", card.links);
    console.log("Text nodes:");
    card.textNodes.forEach((t) => console.log(`  <${t.tag} class="${t.className}">: ${t.text}`));
  });

  await browser.close();
}

main().catch(console.error);
