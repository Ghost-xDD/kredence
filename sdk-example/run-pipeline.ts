/**
 * run-pipeline.ts
 *
 * Demonstrates a live pipeline run over WebSocket.
 * Shows all three consumption patterns:
 *   1. Event listeners   (.on)
 *   2. Async iterable    (for await)
 *   3. Completion promise (.completed)
 *
 * Run: npm run run-pipeline
 */
import { KredenceClient } from "kredence";
import type { HypercertPayload, PipelineSummary, ServerMessage } from "kredence";

const client = new KredenceClient({
  baseUrl: process.env["KREDENCE_API_URL"] ?? "https://credenceserver-production.up.railway.app",
});

// ── Input — swap for whichever ecosystem you want to evaluate ───────────────

const ECOSYSTEM_INPUT = {
  kind: "manual" as const,
  urls: [
    "https://github.com/hypercerts-org/hypercerts",
    "https://github.com/gitcoinco/grants-stack",
  ],
};

// ────────────────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function header(label: string) {
  const line = "─".repeat(60);
  console.log(`\n${line}`);
  console.log(` ${label}`);
  console.log(line);
}

// ── Example 1 — Event listener interface ─────────────────────────────────────

async function runWithEventListeners(): Promise<PipelineSummary> {
  header("Example 1: Event listeners");

  const run = client.run(ECOSYSTEM_INPUT, { maxProjects: 2 });
  const results: HypercertPayload[] = [];

  run.on("ready", ({ serverVersion }) => {
    console.log(`  Server ready (v${serverVersion}) — pipeline starting…`);
  });

  run.on("pipeline_start", ({ runId, ecosystem }) => {
    console.log(`  Run ID   : ${runId}`);
    console.log(`  Ecosystem: ${ecosystem}`);
  });

  run.on("stage_start", ({ stage }) => {
    process.stdout.write(`\n  [${stage}] running…`);
  });

  run.on("stage_done", ({ stage }) => {
    process.stdout.write(` done\n`);
    void stage;
  });

  run.on("log", ({ entry }) => {
    if (entry.level === "warn" || entry.level === "error") {
      console.log(`  ${entry.level.toUpperCase()} ${entry.action}`);
    }
  });

  run.on("project_complete", (payload) => {
    results.push(payload);
    const pct = Math.round(payload.confidenceScore * 100);
    console.log(`\n  ✓ Project complete: "${payload.title}"`);
    console.log(`    Confidence : ${pct}%`);
    console.log(`    Verified   : ${payload.verifiedClaims.length} claims`);
    console.log(`    Flagged    : ${payload.flaggedClaims.length} claims`);
    if (payload.verifiedClaims[0]) {
      console.log(`    Top claim  : ${payload.verifiedClaims[0].text}`);
    }
  });

  run.on("error", (err) => {
    console.error(`  Connection error: ${err.message}`);
  });

  const summary = await run.completed();

  console.log(`\n  Pipeline complete!`);
  console.log(`    Projects evaluated : ${summary.projectsEvaluated}`);
  console.log(`    Hypercerts stored  : ${summary.hypercertsStored}`);
  console.log(`    Total verified     : ${summary.totalVerified}`);
  console.log(`    Total flagged      : ${summary.totalFlagged}`);
  console.log(`    Duration           : ${formatMs(summary.durationMs)}`);

  return summary;
}

// ── Example 2 — Async iterable interface ─────────────────────────────────────

async function runWithAsyncIterable(): Promise<void> {
  header("Example 2: Async iterable");

  const run = client.run(ECOSYSTEM_INPUT, { maxProjects: 2 });
  const stageTimes: Record<string, number> = {};

  for await (const event of run) {
    switch (event.type) {
      case "ready":
        console.log(`  Connected (server v${event.serverVersion})`);
        break;

      case "stage_start":
        stageTimes[event.stage] = Date.now();
        console.log(`  → ${event.stage}`);
        break;

      case "stage_done": {
        const elapsed = Date.now() - (stageTimes[event.stage] ?? Date.now());
        console.log(`  ✓ ${event.stage} (${formatMs(elapsed)})`);
        break;
      }

      case "project_complete":
        console.log(`  Project: "${event.payload.title}" — ${Math.round(event.payload.confidenceScore * 100)}% confidence`);
        break;

      case "pipeline_done":
        console.log(`\n  Done — ${event.summary.projectsEvaluated} project(s) in ${formatMs(event.summary.durationMs)}`);
        break;

      case "pipeline_error":
        console.error(`  Pipeline error at stage "${event.stage}": ${event.message}`);
        break;
    }
  }
}

// ── Example 3 — One-liner: fire and forget ────────────────────────────────────

async function runFireAndForget(): Promise<void> {
  header("Example 3: One-liner .completed()");

  const summary = await client
    .run(ECOSYSTEM_INPUT, { maxProjects: 1 })
    .completed();

  console.log(
    `  Evaluated ${summary.projectsEvaluated} project(s) — ` +
    `${summary.totalVerified} verified, ${summary.totalFlagged} flagged`
  );
}

// ── Run all three demos sequentially ─────────────────────────────────────────

async function main() {
  console.log("Kredence SDK — pipeline examples");
  console.log(`Ecosystem: ${JSON.stringify(ECOSYSTEM_INPUT)}\n`);

  // Pick which demo to run. By default we run example 1.
  // Uncomment the others to try the different interfaces.

  await runWithEventListeners();

  // await runWithAsyncIterable();

  // await runFireAndForget();
}

main().catch(console.error);
