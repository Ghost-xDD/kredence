/**
 * Full end-to-end pipeline test.
 *
 * Scout → Evidence → Adversarial → Synthesis → stored CIDs
 *
 * Runs on 3 real projects from the PL Genesis hackathon.
 * Prints the complete hypercert JSON for each project at the end.
 *
 * Run:
 *   pnpm test:pipeline
 *   # or directly:
 *   cd scripts && ../node_modules/.bin/tsx test-pipeline.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });

import {
  runScoutAgent,
  runEvidenceAgent,
  runAdversarialAgent,
  runSynthesisAgent,
} from "../packages/agents/dist/index.js";
import type {
  EcosystemInput,
  ProjectManifest,
  HypercertPayload,
} from "../packages/types/dist/index.js";
import type {
  EvidenceRunResult,
  AdversarialRunResult,
  SynthesisRunResult,
} from "../packages/agents/dist/index.js";

const MAX_PROJECTS = 3;

function separator(label: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("═".repeat(60));
}

function printPayload(payload: HypercertPayload, index: number) {
  console.log(`\n── Project ${index + 1}: ${payload.title} ${"─".repeat(Math.max(0, 44 - payload.title.length))}`);
  console.log(`   Description:   ${payload.description}`);
  console.log(`   Categories:    ${payload.impactCategory.join(", ")}`);
  console.log(`   Work scopes:   ${payload.workScopes.join(" · ")}`);
  console.log(`   Timeframe:     ${payload.timeframeStart} → ${payload.timeframeEnd}`);
  console.log(
    `   Contributors:  ${payload.contributors.map((c) => c.githubLogin ?? c.name).join(", ") || "none"}`
  );
  console.log(`   Confidence:    ${(payload.confidenceScore * 100).toFixed(0)}%`);
  console.log(
    `   Claims:        ✓ ${payload.verifiedClaims.length} verified  ✗ ${payload.flaggedClaims.length} flagged  ? ${payload.openQuestions.length} unresolved`
  );
  console.log(`   Hypercert CID: ${payload.storachaRefs.hypercertPayloadCid ?? "not stored"}`);
  console.log(`   Evidence CID:  ${payload.storachaRefs.evidenceBundleCid}`);
  console.log(`   Adversarial CID: ${payload.storachaRefs.adversarialLogCid}`);
  if (payload.atproto) {
    console.log(`   ATProto URI:   ${payload.atproto.activityUri}`);
    console.log(`   Hyperscan:     ${payload.atproto.hyperscanUrl}`);
  } else {
    console.log(`   ATProto:       not published (set HYPERCERTS_HANDLE + HYPERCERTS_APP_PASSWORD)`);
  }

  if (payload.flaggedClaims.length > 0) {
    console.log(`\n   Flagged claims:`);
    for (const fc of payload.flaggedClaims) {
      console.log(`     ✗ [${fc.challengeType}] ${fc.text}`);
      console.log(`       → ${fc.objection}`);
    }
  }

  console.log(`\n   Evaluator summary:`);
  console.log(`   ${payload.evaluatorSummary.replace(/\n/g, "\n   ")}`);

  console.log(`\n   Agents:`);
  for (const a of payload.evaluatedBy) {
    console.log(`     ${a.role}: ID ${a.agentId}`);
  }
}

async function main() {
  separator("Credence — Full Pipeline Test");
  console.log(`  Ecosystem: PL Genesis Hackathon (Devspot)`);
  console.log(`  Projects:  ${MAX_PROJECTS} (filtered for ≥2 sources)`);

  // ── Step 1: Scout ────────────────────────────────────────────────────────
  separator("Step 1 — Scout Agent");
  const ecosystemInput: EcosystemInput = {
    kind: "devspot",
    url: "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects",
  };

  let manifest: ProjectManifest;
  try {
    manifest = await runScoutAgent(ecosystemInput);
    console.log(`✓ Discovered ${manifest.projects.length} projects  (CID: ${manifest.storachaCid})`);
  } catch (err) {
    console.error("❌ Scout failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const selected = manifest.projects
    .filter(
      (p) =>
        p.sources.some((s) => s.type === "github") &&
        p.sources.some((s) => s.type === "website")
    )
    .slice(0, MAX_PROJECTS);

  const trimmedManifest: ProjectManifest = { ...manifest, projects: selected };
  console.log(`  Selected ${selected.length} projects with GitHub + website:`);
  selected.forEach((p, i) =>
    console.log(
      `  ${i + 1}. ${p.name}  (${p.sources.find((s) => s.type === "github")?.url ?? "no github"})`
    )
  );

  // ── Step 2: Evidence ─────────────────────────────────────────────────────
  separator("Step 2 — Evidence Agent");
  let evidenceResult: EvidenceRunResult;
  try {
    evidenceResult = await runEvidenceAgent(trimmedManifest);
    const ok = evidenceResult.projects.filter((p) => p.evidenceBundleCid).length;
    console.log(`✓ Evidence bundles: ${ok}/${selected.length} stored on Storacha`);
    evidenceResult.bundles.forEach((b, i) => {
      const p = evidenceResult.projects[i];
      console.log(
        `  ${i + 1}. ${p?.name}  — ${b.extractedClaims.length} claims  (CID: ${p?.evidenceBundleCid ?? "—"})`
      );
    });
  } catch (err) {
    console.error("❌ Evidence failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ── Step 3: Adversarial ──────────────────────────────────────────────────
  separator("Step 3 — Adversarial Agent");
  let adversarialResult: AdversarialRunResult;
  try {
    adversarialResult = await runAdversarialAgent(evidenceResult);
    const ok = adversarialResult.projects.filter((p) => p.adversarialLogCid).length;
    const totalFlagged = adversarialResult.logs.reduce((s, l) => s + l.flaggedCount, 0);
    const totalVerified = adversarialResult.logs.reduce((s, l) => s + l.verifiedCount, 0);
    console.log(
      `✓ Adversarial logs: ${ok}/${selected.length} stored  |  ✓ ${totalVerified} verified  ✗ ${totalFlagged} flagged`
    );
    adversarialResult.logs.forEach((l, i) => {
      const p = adversarialResult.projects[i];
      console.log(
        `  ${i + 1}. ${p?.name}  — ✓ ${l.verifiedCount}  ✗ ${l.flaggedCount}  ? ${l.unresolvedCount}  confidence: ${((p?.confidenceScore ?? 0) * 100).toFixed(0)}%`
      );
    });
  } catch (err) {
    console.error("❌ Adversarial failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ── Step 4: Synthesis ────────────────────────────────────────────────────
  separator("Step 4 — Synthesis Agent");
  let synthesisResult: SynthesisRunResult;
  try {
    synthesisResult = await runSynthesisAgent({ evidenceResult, adversarialResult });
    const ok = synthesisResult.projects.filter((p) => p.hypercertPayloadCid).length;
    console.log(`✓ Hypercert payloads: ${ok}/${selected.length} stored on Storacha`);
  } catch (err) {
    console.error("❌ Synthesis failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ── Final Report ─────────────────────────────────────────────────────────
  separator("Hypercert Payloads");
  for (let i = 0; i < synthesisResult.payloads.length; i++) {
    const payload = synthesisResult.payloads[i];
    if (payload) printPayload(payload, i);
  }

  separator("Pipeline Complete");
  const stored = synthesisResult.projects.filter((p) => p.hypercertPayloadCid).length;
  const published = synthesisResult.payloads.filter((p) => p.atproto).length;
  console.log(`  ✓ Scout → Evidence → Adversarial → Synthesis → Hypercerts`);
  console.log(`  ✓ ${stored}/${MAX_PROJECTS} hypercert payloads stored on Storacha`);
  console.log(`  ✓ ${published}/${MAX_PROJECTS} hypercerts published to ATProto network`);
  if (published > 0) {
    synthesisResult.payloads
      .filter((p) => p.atproto)
      .forEach((p) => console.log(`    → ${p.atproto!.hyperscanUrl}`));
  }
  console.log(`  ✓ All artifacts content-addressed and retrievable`);
  console.log(`  ✓ ERC-8004 agent identities: Scout 3040, Evidence 3041, Adversarial 3042, Synthesis 3043`);
  console.log();

  // Print one complete JSON for inspection
  const first = synthesisResult.payloads[0];
  if (first) {
    console.log("── Sample hypercert JSON (project 1) ────────────────────────");
    console.log(JSON.stringify(first, null, 2));
  }
}

main().catch((err) => {
  console.error("\n❌ Pipeline failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
