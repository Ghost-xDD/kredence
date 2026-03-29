/**
 * list-projects.ts
 *
 * Demonstrates the REST API: health check, registry listing, full hypercert fetch.
 *
 * Run: npm run list
 */
import { KredenceClient, KredenceError } from "kredence";

const client = new KredenceClient({
  baseUrl: process.env["KREDENCE_API_URL"] ?? "https://credenceserver-production.up.railway.app",
});

async function main() {
  // ── 1. Health check ──────────────────────────────────────────────────────
  console.log("Checking server health…");
  const health = await client.health();
  console.log(`  status : ${health.status}`);
  console.log(`  version: ${health.version}`);
  console.log(`  time   : ${health.ts}`);

  // ── 2. List all evaluated projects ──────────────────────────────────────
  console.log("\nFetching project registry…");
  const registry = await client.listProjects();
  const { entries } = registry;

  if (entries.length === 0) {
    console.log("  No projects evaluated yet. Run a pipeline first.");
    return;
  }

  console.log(`  ${entries.length} project(s) found  (registry updated ${registry.updatedAt})\n`);

  for (const entry of entries) {
    const pct = Math.round(entry.confidenceScore * 100);
    const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
    console.log(`  ${entry.title}`);
    console.log(`    slug       : ${entry.slug}`);
    console.log(`    confidence : [${bar}] ${pct}%`);
    console.log(`    verified   : ${entry.verifiedCount}  flagged: ${entry.flaggedCount}  unresolved: ${entry.unresolvedCount}`);
    console.log(`    category   : ${entry.impactCategory.join(", ") || "—"}`);
    console.log(`    contributors: ${entry.contributors.join(", ") || "—"}`);
    if (entry.atprotoUrl) {
      console.log(`    hyperscan  : ${entry.atprotoUrl}`);
    }
    console.log();
  }

  // ── 3. Fetch the full hypercert for the top project ──────────────────────
  const top = entries[0];
  if (!top) return;

  console.log(`Fetching full hypercert for "${top.title}" (slug: ${top.slug})…`);
  try {
    const hypercert = await client.getProject(top.slug);

    console.log(`\n  evaluatorSummary:\n    ${hypercert.evaluatorSummary}`);
    console.log(`\n  Verified claims (${hypercert.verifiedClaims.length}):`);
    for (const c of hypercert.verifiedClaims.slice(0, 3)) {
      console.log(`    ✓ ${c.text}`);
    }
    console.log(`\n  Flagged claims (${hypercert.flaggedClaims.length}):`);
    for (const c of hypercert.flaggedClaims.slice(0, 3)) {
      console.log(`    ✗ ${c.text}`);
      console.log(`      reason: ${c.objection}`);
    }

    // ── 4. Badge URL ─────────────────────────────────────────────────────
    console.log(`\n  Embed this badge in your README:`);
    console.log(
      `    ![Kredence](https://img.shields.io/endpoint?url=https://api.kredence.xyz/badge/${top.slug})`
    );
  } catch (err) {
    if (err instanceof KredenceError) {
      console.error(`  HTTP ${err.statusCode}: ${err.message}`);
    } else {
      throw err;
    }
  }
}

main().catch(console.error);
