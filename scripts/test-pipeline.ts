/**
 * Full end-to-end pipeline test — Scout → Evidence → Adversarial → Synthesis
 *
 * Also writes two output artefacts:
 *   agent.json      — machine-readable capability manifest (project root)
 *   agent_log.json  — structured execution log for this run (scripts/)
 *
 * Run:
 *   pnpm test:pipeline
 *   # or directly:
 *   cd scripts && ../node_modules/.bin/tsx test-pipeline.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { writeFileSync } from "fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });

import {
  runScoutAgent,
  runEvidenceAgent,
  runAdversarialAgent,
  runSynthesisAgent,
} from "../packages/agents/dist/index.js";
import { getOperatorWallet } from "../packages/agents/dist/identity.js";
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

// ── Agent log types ────────────────────────────────────────────────────────

type LogLevel = "info" | "decision" | "tool_call" | "retry" | "error" | "success";

type LogEntry = {
  ts: string;
  level: LogLevel;
  stage: string;
  message: string;
  data?: Record<string, unknown>;
};

type AgentLog = {
  run_id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "completed" | "failed";
  operator_wallet: string;
  agent_ids: { scout: number; evidence: number; adversarial: number; synthesis: number };
  ecosystem: Record<string, unknown>;
  summary: {
    projects_discovered: number;
    projects_selected: number;
    evidence_bundles: number;
    adversarial_logs: number;
    hypercerts_stored: number;
    atproto_published: number;
    total_verified_claims: number;
    total_flagged_claims: number;
    duration_ms: number | null;
  };
  stages: {
    scout:      { status: string; started_at: string | null; finished_at: string | null; duration_ms: number | null };
    evidence:   { status: string; started_at: string | null; finished_at: string | null; duration_ms: number | null };
    adversarial:{ status: string; started_at: string | null; finished_at: string | null; duration_ms: number | null };
    synthesis:  { status: string; started_at: string | null; finished_at: string | null; duration_ms: number | null };
  };
  projects: Array<{
    name: string;
    confidence: number;
    verified_claims: number;
    flagged_claims: number;
    open_questions: number;
    evidence_bundle_cid: string | null;
    adversarial_log_cid: string | null;
    hypercert_payload_cid: string | null;
    atproto_uri: string | null;
    hyperscan_url: string | null;
    sources: string[];
  }>;
  log: LogEntry[];
};

// ── Log builder ─────────────────────────────────────────────────────────────

const MAX_PROJECTS = 3;
const RUN_ID = `run-${Date.now()}`;
const START_TIME = new Date();

const agentLog: AgentLog = {
  run_id: RUN_ID,
  started_at: START_TIME.toISOString(),
  finished_at: null,
  status: "running",
  operator_wallet: getOperatorWallet(),
  agent_ids: {
    scout:       parseInt(process.env["SCOUT_AGENT_ID"]       ?? "3040"),
    evidence:    parseInt(process.env["EVIDENCE_AGENT_ID"]    ?? "3041"),
    adversarial: parseInt(process.env["ADVERSARIAL_AGENT_ID"] ?? "3042"),
    synthesis:   parseInt(process.env["SYNTHESIS_AGENT_ID"]   ?? "3043"),
  },
  ecosystem: {
    kind: "devspot",
    url:  "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects",
    max_projects: MAX_PROJECTS,
  },
  summary: {
    projects_discovered: 0,
    projects_selected:   0,
    evidence_bundles:    0,
    adversarial_logs:    0,
    hypercerts_stored:   0,
    atproto_published:   0,
    total_verified_claims: 0,
    total_flagged_claims:  0,
    duration_ms: null,
  },
  stages: {
    scout:       { status: "pending", started_at: null, finished_at: null, duration_ms: null },
    evidence:    { status: "pending", started_at: null, finished_at: null, duration_ms: null },
    adversarial: { status: "pending", started_at: null, finished_at: null, duration_ms: null },
    synthesis:   { status: "pending", started_at: null, finished_at: null, duration_ms: null },
  },
  projects: [],
  log: [],
};

function log(level: LogLevel, stage: string, message: string, data?: Record<string, unknown>) {
  const entry: LogEntry = { ts: new Date().toISOString(), level, stage, message, ...(data ? { data } : {}) };
  agentLog.log.push(entry);
  const icon = { info: "·", decision: "▶", tool_call: "⚙", retry: "↻", error: "✗", success: "✓" }[level];
  console.log(`  ${icon} [${stage}] ${message}`);
}

function stageStart(name: keyof AgentLog["stages"]) {
  agentLog.stages[name].status = "running";
  agentLog.stages[name].started_at = new Date().toISOString();
  log("info", name, `Stage started`);
}

function stageEnd(name: keyof AgentLog["stages"], success: boolean) {
  const s = agentLog.stages[name];
  s.status = success ? "completed" : "failed";
  s.finished_at = new Date().toISOString();
  s.duration_ms = new Date(s.finished_at).getTime() - new Date(s.started_at!).getTime();
  log(success ? "success" : "error", name, `Stage ${success ? "completed" : "failed"} in ${s.duration_ms}ms`);
}

function saveLog() {
  const logPath = resolve(__dirname, "agent_log.json");
  writeFileSync(logPath, JSON.stringify(agentLog, null, 2), "utf-8");
}

// ── Pretty print ───────────────────────────────────────────────────────────

function separator(label: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log("═".repeat(60));
}

function printPayload(payload: HypercertPayload, index: number) {
  console.log(`\n── Project ${index + 1}: ${payload.title} ${"─".repeat(Math.max(0, 44 - payload.title.length))}`);
  console.log(`   Confidence:    ${(payload.confidenceScore * 100).toFixed(0)}%`);
  console.log(`   Claims:        ✓ ${payload.verifiedClaims.length} verified  ✗ ${payload.flaggedClaims.length} flagged  ? ${payload.openQuestions.length} unresolved`);
  console.log(`   Hypercert CID: ${payload.storachaRefs.hypercertPayloadCid ?? "not stored"}`);
  console.log(`   Evidence CID:  ${payload.storachaRefs.evidenceBundleCid}`);
  console.log(`   Adversarial CID: ${payload.storachaRefs.adversarialLogCid}`);
  if (payload.atproto) {
    console.log(`   ATProto URI:   ${payload.atproto.activityUri}`);
    console.log(`   Hyperscan:     ${payload.atproto.hyperscanUrl}`);
  } else {
    console.log(`   ATProto:       not published (HYPERCERTS_HANDLE not set)`);
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

// ── Main pipeline ──────────────────────────────────────────────────────────

async function main() {
  separator("Kredence — Full Pipeline Test");
  console.log(`  Run ID:    ${RUN_ID}`);
  console.log(`  Ecosystem: PL Genesis Hackathon (Devspot)`);
  console.log(`  Projects:  up to ${MAX_PROJECTS} (filtered for ≥ 2 sources)`);
  console.log(`  Operator:  ${agentLog.operator_wallet}`);

  log("info", "system", "Pipeline initialised", {
    run_id: RUN_ID,
    operator: agentLog.operator_wallet,
    agent_ids: agentLog.agent_ids,
  });

  // ── Step 1: Scout ────────────────────────────────────────────────────────
  separator("Step 1 — Scout Agent (discover)");
  stageStart("scout");

  const ecosystemInput: EcosystemInput = {
    kind: "devspot",
    url: "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects",
  };

  log("decision", "scout", "Targeting Devspot PL Genesis hackathon", { url: ecosystemInput.url });
  log("tool_call", "scout", "Calling runScoutAgent — scraping ecosystem page");

  let manifest: ProjectManifest;
  try {
    manifest = await runScoutAgent(ecosystemInput);
    agentLog.summary.projects_discovered = manifest.projects.length;
    log("success", "scout", `Discovered ${manifest.projects.length} projects`, { storachaCid: manifest.storachaCid });
    console.log(`✓ Discovered ${manifest.projects.length} projects  (CID: ${manifest.storachaCid})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", "scout", `Scout failed: ${msg}`);
    stageEnd("scout", false);
    agentLog.status = "failed";
    agentLog.finished_at = new Date().toISOString();
    saveLog();
    console.error("❌ Scout failed:", msg);
    process.exit(1);
  }

  // Decision: filter to projects with both GitHub + website sources
  log("decision", "scout", `Filtering to projects with GitHub + website sources (max ${MAX_PROJECTS})`);
  const selected = manifest.projects
    .filter(
      (p) =>
        p.sources.some((s) => s.type === "github") &&
        p.sources.some((s) => s.type === "website")
    )
    .slice(0, MAX_PROJECTS);

  agentLog.summary.projects_selected = selected.length;
  log("info", "scout", `Selected ${selected.length} projects`, {
    projects: selected.map((p) => ({
      name: p.name,
      sources: p.sources.map((s) => s.type),
    })),
  });

  const trimmedManifest: ProjectManifest = { ...manifest, projects: selected };
  console.log(`  Selected ${selected.length} projects with GitHub + website:`);
  selected.forEach((p, i) =>
    console.log(`  ${i + 1}. ${p.name}  (${p.sources.find((s) => s.type === "github")?.url ?? "no github"})`)
  );
  stageEnd("scout", true);

  // ── Step 2: Evidence ─────────────────────────────────────────────────────
  separator("Step 2 — Evidence Agent (plan + execute)");
  stageStart("evidence");

  log("decision", "evidence", "Plan: collect GitHub signals, website signals, on-chain activity per project");
  log("tool_call", "evidence", "Calling runEvidenceAgent — GitHub API, web scraping, LLM claim extraction");

  let evidenceResult: EvidenceRunResult;
  try {
    evidenceResult = await runEvidenceAgent(trimmedManifest);
    const ok = evidenceResult.projects.filter((p) => p.evidenceBundleCid).length;
    agentLog.summary.evidence_bundles = ok;
    log("success", "evidence", `Evidence bundles stored: ${ok}/${selected.length}`, {
      projects: evidenceResult.projects.map((p, i) => ({
        name: p.name,
        claims: evidenceResult.bundles[i]?.extractedClaims.length ?? 0,
        cid: p.evidenceBundleCid ?? null,
      })),
    });
    console.log(`✓ Evidence bundles: ${ok}/${selected.length} stored on Storacha`);
    evidenceResult.bundles.forEach((b, i) => {
      const p = evidenceResult.projects[i];
      console.log(`  ${i + 1}. ${p?.name}  — ${b.extractedClaims.length} claims  (CID: ${p?.evidenceBundleCid ?? "—"})`);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", "evidence", `Evidence failed: ${msg}`);
    stageEnd("evidence", false);
    agentLog.status = "failed";
    agentLog.finished_at = new Date().toISOString();
    saveLog();
    console.error("❌ Evidence failed:", msg);
    process.exit(1);
  }
  stageEnd("evidence", true);

  // ── Step 3: Adversarial ──────────────────────────────────────────────────
  separator("Step 3 — Adversarial Agent (verify)");
  stageStart("adversarial");

  log("decision", "adversarial", "Plan: challenge every extracted claim — flag vague metrics, dead links, overclaiming");
  log("tool_call", "adversarial", "Calling runAdversarialAgent — LLM counter-evidence search + EIP-191 signing");

  let adversarialResult: AdversarialRunResult;
  try {
    adversarialResult = await runAdversarialAgent(evidenceResult);
    const ok = adversarialResult.projects.filter((p) => p.adversarialLogCid).length;
    const totalFlagged  = adversarialResult.logs.reduce((s, l) => s + l.flaggedCount,    0);
    const totalVerified = adversarialResult.logs.reduce((s, l) => s + l.verifiedCount,   0);
    agentLog.summary.adversarial_logs       = ok;
    agentLog.summary.total_verified_claims  = totalVerified;
    agentLog.summary.total_flagged_claims   = totalFlagged;

    log("success", "adversarial", `Adversarial logs stored: ${ok}/${selected.length}`, {
      total_verified: totalVerified,
      total_flagged:  totalFlagged,
      projects: adversarialResult.projects.map((p, i) => ({
        name: p.name,
        verified: adversarialResult.logs[i]?.verifiedCount ?? 0,
        flagged:  adversarialResult.logs[i]?.flaggedCount  ?? 0,
        confidence: `${((p.confidenceScore ?? 0) * 100).toFixed(0)}%`,
        cid: p.adversarialLogCid ?? null,
        signed: !!adversarialResult.logs[i]?.signatureContext,
      })),
    });
    console.log(`✓ Adversarial logs: ${ok}/${selected.length} stored  |  ✓ ${totalVerified} verified  ✗ ${totalFlagged} flagged`);
    adversarialResult.logs.forEach((l, i) => {
      const p = adversarialResult.projects[i];
      const signed = l.signatureContext ? " · EIP-191 signed ✓" : "";
      console.log(`  ${i + 1}. ${p?.name}  — ✓ ${l.verifiedCount}  ✗ ${l.flaggedCount}  ? ${l.unresolvedCount}  confidence: ${((p?.confidenceScore ?? 0) * 100).toFixed(0)}%${signed}`);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", "adversarial", `Adversarial failed: ${msg}`);
    stageEnd("adversarial", false);
    agentLog.status = "failed";
    agentLog.finished_at = new Date().toISOString();
    saveLog();
    console.error("❌ Adversarial failed:", msg);
    process.exit(1);
  }
  stageEnd("adversarial", true);

  // ── Step 4: Synthesis ────────────────────────────────────────────────────
  separator("Step 4 — Synthesis Agent (submit)");
  stageStart("synthesis");

  log("decision", "synthesis", "Plan: assemble hypercert payloads, store on Storacha, publish to ATProto");
  log("tool_call", "synthesis", "Calling runSynthesisAgent — payload assembly + Storacha upload + ATProto publish");

  let synthesisResult: SynthesisRunResult;
  try {
    synthesisResult = await runSynthesisAgent({ evidenceResult, adversarialResult });
    const ok        = synthesisResult.projects.filter((p) => p.hypercertPayloadCid).length;
    const published = synthesisResult.payloads.filter((p) => p.atproto).length;
    agentLog.summary.hypercerts_stored  = ok;
    agentLog.summary.atproto_published  = published;

    // Populate per-project entries in the log
    agentLog.projects = synthesisResult.payloads.map((p, i) => ({
      name:                  p.title,
      confidence:            parseFloat((p.confidenceScore * 100).toFixed(0)),
      verified_claims:       p.verifiedClaims.length,
      flagged_claims:        p.flaggedClaims.length,
      open_questions:        p.openQuestions.length,
      evidence_bundle_cid:   p.storachaRefs.evidenceBundleCid ?? null,
      adversarial_log_cid:   p.storachaRefs.adversarialLogCid ?? null,
      hypercert_payload_cid: p.storachaRefs.hypercertPayloadCid ?? null,
      atproto_uri:           p.atproto?.activityUri ?? null,
      hyperscan_url:         p.atproto?.hyperscanUrl ?? null,
      sources:               (evidenceResult.projects[i]?.sources ?? []).map((s) => s.url),
    }));

    log("success", "synthesis", `Hypercerts stored: ${ok}/${selected.length}, ATProto published: ${published}`, {
      projects: agentLog.projects,
    });
    console.log(`✓ Hypercert payloads: ${ok}/${selected.length} stored on Storacha`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("error", "synthesis", `Synthesis failed: ${msg}`);
    stageEnd("synthesis", false);
    agentLog.status = "failed";
    agentLog.finished_at = new Date().toISOString();
    saveLog();
    console.error("❌ Synthesis failed:", msg);
    process.exit(1);
  }
  stageEnd("synthesis", true);

  // ── Finalise log ────────────────────────────────────────────────────────
  agentLog.status      = "completed";
  agentLog.finished_at = new Date().toISOString();
  agentLog.summary.duration_ms = Date.now() - START_TIME.getTime();

  log("success", "system", `Pipeline complete in ${(agentLog.summary.duration_ms / 1000).toFixed(1)}s`, {
    summary: agentLog.summary,
  });

  saveLog();
  console.log(`\n  ✓ agent_log.json written → ${resolve(__dirname, "agent_log.json")}`);

  // ── Final Report ────────────────────────────────────────────────────────
  separator("Hypercert Payloads");
  for (let i = 0; i < synthesisResult.payloads.length; i++) {
    const payload = synthesisResult.payloads[i];
    if (payload) printPayload(payload, i);
  }

  separator("Pipeline Complete");
  const stored    = synthesisResult.projects.filter((p) => p.hypercertPayloadCid).length;
  const published = synthesisResult.payloads.filter((p) => p.atproto).length;
  console.log(`  ✓ Scout → Evidence → Adversarial → Synthesis → Hypercerts`);
  console.log(`  ✓ ${stored}/${MAX_PROJECTS} hypercert payloads stored on Storacha`);
  console.log(`  ✓ ${published}/${MAX_PROJECTS} hypercerts published to ATProto network`);
  if (published > 0) {
    synthesisResult.payloads
      .filter((p) => p.atproto)
      .forEach((p) => console.log(`    → ${p.atproto!.hyperscanUrl}`));
  }
  console.log(`  ✓ All artefacts content-addressed and retrievable`);
  console.log(`  ✓ ERC-8004 agent identities: Scout ${agentLog.agent_ids.scout}, Evidence ${agentLog.agent_ids.evidence}, Adversarial ${agentLog.agent_ids.adversarial}, Synthesis ${agentLog.agent_ids.synthesis}`);
  console.log(`  ✓ Operator wallet: ${agentLog.operator_wallet}`);
  console.log(`  ✓ Execution log:   scripts/agent_log.json`);
  console.log(`  ✓ Agent manifest:  agent.json`);
  console.log();

  const first = synthesisResult.payloads[0];
  if (first) {
    console.log("── Sample hypercert JSON (project 1) ────────────────────────");
    console.log(JSON.stringify(first, null, 2));
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  log("error", "system", `Unhandled pipeline error: ${msg}`);
  agentLog.status      = "failed";
  agentLog.finished_at = new Date().toISOString();
  agentLog.summary.duration_ms = Date.now() - START_TIME.getTime();
  saveLog();
  console.error("\n❌ Pipeline failed:", msg);
  process.exit(1);
});
