/**
 * Evidence Agent smoke test.
 *
 * Runs the Scout Agent on a small subset of the PL Genesis hackathon
 * (first 3 projects), then runs the Evidence Agent on that manifest.
 *
 * Run:
 *   pnpm test:evidence
 *   # or directly:
 *   cd scripts && ../node_modules/.bin/tsx test-evidence.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });

import { runScoutAgent, runEvidenceAgent } from "../packages/agents/dist/index.js";
import type { EcosystemInput, ProjectManifest } from "../packages/types/dist/index.js";

// Limit to a small number of projects so the test is fast
const MAX_PROJECTS = 3;

async function main() {
  console.log("── Evidence Agent Smoke Test ───────────────────────────────\n");

  // ── Step 1: Scout ──────────────────────────────────────────────────────────
  console.log("Step 1 — Scout Agent: discovering projects…");
  const ecosystemInput: EcosystemInput = {
    kind: "devspot",
    url: "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects",
  };

  let manifest: ProjectManifest;
  try {
    manifest = await runScoutAgent(ecosystemInput);
    console.log(`✓ Scout discovered ${manifest.projects.length} projects`);
    if (manifest.storachaCid) {
      console.log(`  Manifest CID: ${manifest.storachaCid}`);
    }
  } catch (err) {
    console.error("❌ Scout Agent failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Trim to the first MAX_PROJECTS to keep the test fast
  const trimmedManifest: ProjectManifest = {
    ...manifest,
    projects: manifest.projects.slice(0, MAX_PROJECTS),
  };
  console.log(
    `\n  (Limiting to first ${trimmedManifest.projects.length} projects for evidence test)\n`
  );
  trimmedManifest.projects.forEach((p, i) => {
    const github = p.sources.find((s) => s.type === "github")?.url ?? "—";
    const website = p.sources.find((s) => s.type === "website")?.url ?? "—";
    console.log(`  ${i + 1}. ${p.name}`);
    console.log(`     github:  ${github}`);
    console.log(`     website: ${website}`);
  });

  // ── Step 2: Evidence ───────────────────────────────────────────────────────
  console.log("\nStep 2 — Evidence Agent: collecting evidence…\n");
  let result: Awaited<ReturnType<typeof runEvidenceAgent>>;
  try {
    result = await runEvidenceAgent(trimmedManifest);
  } catch (err) {
    console.error("❌ Evidence Agent failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log("\n── Results ─────────────────────────────────────────────────\n");

  for (let i = 0; i < result.bundles.length; i++) {
    const bundle = result.bundles[i];
    const project = result.projects[i];
    if (!bundle || !project) continue;

    console.log(`${i + 1}. ${project.name}`);
    console.log(`   CID: ${project.evidenceBundleCid ?? "not stored"}`);

    if (bundle.github) {
      console.log(
        `   GitHub: ★${bundle.github.stars}  ${bundle.github.commitCount90d} commits/90d  ${bundle.github.contributors.length} contributors`
      );
    } else {
      console.log("   GitHub: —");
    }

    if (bundle.website) {
      const status = bundle.website.isLive ? "live" : `dead (${bundle.website.statusCode})`;
      console.log(`   Website: ${status} — "${bundle.website.title ?? "no title"}"`);
    } else {
      console.log("   Website: —");
    }

    console.log(`   Claims extracted: ${bundle.extractedClaims.length}`);
    bundle.extractedClaims.slice(0, 3).forEach((c) => {
      const flag = c.isSelfReported ? "[self-reported]" : "[observable]";
      console.log(`     • ${flag} ${c.text}`);
    });

    if (bundle.sourcesFailed.length > 0) {
      console.log(`   Failed sources: ${bundle.sourcesFailed.length}`);
      bundle.sourcesFailed.forEach((f) => {
        console.log(`     ✗ ${f.url}: ${f.reason}`);
      });
    }

    console.log();
  }

  const withCid = result.projects.filter((p) => p.evidenceBundleCid).length;
  console.log(`✅ Evidence Agent complete — ${withCid}/${result.projects.length} bundles stored`);
}

main().catch((err) => {
  console.error("\n❌ Evidence test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
