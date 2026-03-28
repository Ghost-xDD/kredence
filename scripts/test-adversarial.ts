/**
 * Adversarial Agent smoke test.
 *
 * Runs Scout → Evidence (3 projects) → Adversarial and prints the full
 * challenge breakdown per project: claim text, challenge type, outcome,
 * and objection text for flagged/unresolved claims.
 *
 * Run:
 *   pnpm test:adversarial
 *   # or directly:
 *   cd scripts && ../node_modules/.bin/tsx test-adversarial.ts
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
} from "../packages/agents/dist/index.js";
import type {
  EcosystemInput,
  ProjectManifest,
  AdversarialLog,
} from "../packages/types/dist/index.js";
import type { EvidenceRunResult } from "../packages/agents/dist/index.js";

const MAX_PROJECTS = 3;

const OUTCOME_ICON: Record<string, string> = {
  verified: "✓",
  flagged: "✗",
  unresolved: "?",
};

const OUTCOME_LABEL: Record<string, string> = {
  verified: "VERIFIED",
  flagged: "FLAGGED",
  unresolved: "UNRESOLVED",
};

function printLog(log: AdversarialLog, projectName: string) {
  console.log(`\n── ${projectName} ─────────────────────────────────────────`);
  console.log(
    `   CID: ${log.projectId} | ` +
      `✓ ${log.verifiedCount} verified  ✗ ${log.flaggedCount} flagged  ? ${log.unresolvedCount} unresolved`
  );
  if (log.signatureContext) {
    console.log(`   Signed by: ${log.signatureContext.signerAddress}`);
    console.log(`   Hash: ${log.signatureContext.messageHash}`);
  }

  for (const entry of log.entries) {
    const icon = OUTCOME_ICON[entry.outcome] ?? "?";
    const label = OUTCOME_LABEL[entry.outcome] ?? entry.outcome;
    console.log(`\n   ${icon} [${label}] (${entry.challengeType})`);
    console.log(`     Claim: "${entry.claimText}"`);
    console.log(`     Evidence: ${entry.challengeEvidence}`);
    if (entry.objectionText) {
      console.log(`     Objection: ${entry.objectionText}`);
    }
  }
}

async function main() {
  console.log("── Adversarial Agent Smoke Test ────────────────────────────\n");

  // ── Step 1: Scout ──────────────────────────────────────────────────────────
  console.log("Step 1 — Scout Agent…");
  const ecosystemInput: EcosystemInput = {
    kind: "devspot",
    url: "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects",
  };
  let manifest: ProjectManifest;
  try {
    manifest = await runScoutAgent(ecosystemInput);
    console.log(`✓ Discovered ${manifest.projects.length} projects`);
  } catch (err) {
    console.error("❌ Scout failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Pick projects that have both GitHub and a real website
  const selected = manifest.projects
    .filter(
      (p) =>
        p.sources.some((s) => s.type === "github") && p.sources.some((s) => s.type === "website")
    )
    .slice(0, MAX_PROJECTS);

  const trimmedManifest: ProjectManifest = { ...manifest, projects: selected };
  console.log(`   (Selected ${selected.length} projects with ≥2 sources)\n`);

  // ── Step 2: Evidence ───────────────────────────────────────────────────────
  console.log("Step 2 — Evidence Agent…");
  let evidenceResult: EvidenceRunResult;
  try {
    evidenceResult = await runEvidenceAgent(trimmedManifest);
    const withCid = evidenceResult.projects.filter((p) => p.evidenceBundleCid).length;
    console.log(`✓ Evidence collected for ${withCid}/${selected.length} projects\n`);
  } catch (err) {
    console.error("❌ Evidence failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ── Step 3: Adversarial ────────────────────────────────────────────────────
  console.log("Step 3 — Adversarial Agent…\n");
  let adversarialResult: Awaited<ReturnType<typeof runAdversarialAgent>>;
  try {
    adversarialResult = await runAdversarialAgent(evidenceResult);
  } catch (err) {
    console.error("❌ Adversarial failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log("\n══ Adversarial Report ══════════════════════════════════════");

  for (let i = 0; i < adversarialResult.logs.length; i++) {
    const log = adversarialResult.logs[i];
    const project = adversarialResult.projects[i];
    if (!log || !project) continue;
    printLog(log, project.name);
  }

  // Summary stats
  const totalVerified = adversarialResult.logs.reduce((s, l) => s + l.verifiedCount, 0);
  const totalFlagged = adversarialResult.logs.reduce((s, l) => s + l.flaggedCount, 0);
  const totalUnresolved = adversarialResult.logs.reduce((s, l) => s + l.unresolvedCount, 0);
  const withCid = adversarialResult.projects.filter((p) => p.adversarialLogCid).length;
  const signed = adversarialResult.logs.filter((l) => l.signatureContext !== null).length;

  console.log(`\n══ Summary ═════════════════════════════════════════════════`);
  console.log(`   Projects evaluated: ${adversarialResult.projects.length}`);
  console.log(`   Logs stored on Storacha: ${withCid}`);
  console.log(`   Logs signed: ${signed}`);
  console.log(`   Total claims: ${totalVerified + totalFlagged + totalUnresolved}`);
  console.log(`   ✓ Verified:   ${totalVerified}`);
  console.log(`   ✗ Flagged:    ${totalFlagged}`);
  console.log(`   ? Unresolved: ${totalUnresolved}`);

  if (totalFlagged === 0 && totalUnresolved === 0) {
    console.warn(
      "\n⚠  All claims verified — adversarial agent may not be challenging enough."
    );
  } else {
    console.log("\n✅ Adversarial Agent complete — non-trivial objections produced");
  }
}

main().catch((err) => {
  console.error("\n❌ Adversarial test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
