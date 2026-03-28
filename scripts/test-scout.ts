/**
 * Scout Agent smoke test.
 *
 * Tests both adapters with real network calls.
 * Storacha upload is skipped if credentials are not set.
 *
 * Run:  cd scripts && ../node_modules/.bin/tsx test-scout.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

// Load .env from workspace root regardless of CWD
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });
import { runScoutAgent } from "../packages/agents/dist/index.js";
import type { EcosystemInput } from "../packages/types/dist/index.js";

const SKIP_STORACHA = !process.env["STORACHA_PRINCIPAL"];

if (SKIP_STORACHA) {
  console.warn("⚠  STORACHA_PRINCIPAL not set — Storacha upload will be skipped\n");
  // Monkey-patch uploadJSON to be a no-op for the test
  process.env["STORACHA_SKIP"] = "1";
}

async function testAdapter(label: string, input: EcosystemInput) {
  console.log(`\n── ${label} ────────────────────────────`);
  const manifest = await runScoutAgent(input);
  console.log(`✓ Discovered ${manifest.projects.length} projects`);
  console.log(`  First 5:`);
  manifest.projects.slice(0, 5).forEach((p, i) => {
    const github = p.sources.find((s) => s.type === "github")?.url ?? "—";
    console.log(`  ${i + 1}. ${p.name}`);
    console.log(`     github: ${github}`);
  });
  if (manifest.storachaCid) {
    console.log(`  Manifest CID: ${manifest.storachaCid}`);
  }
}

async function safeTestAdapter(label: string, input: EcosystemInput) {
  try {
    await testAdapter(label, input);
  } catch (err) {
    console.error(
      `\n❌ ${label} failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

async function main() {
  console.log("── Scout Agent Smoke Test ──────────────────────────");

  // Run adapters independently so one failure doesn't block the other
  await safeTestAdapter("Devspot Hackathon", {
    kind: "devspot",
    url: "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects",
  });

  await safeTestAdapter("Filecoin Dev Grants", {
    kind: "filecoin-devgrants",
    repo: "filecoin-project/devgrants",
    labels: ["Open Grant"],
  });

  console.log("\n✅ Scout Agent smoke test complete");
}

main().catch((err) => {
  console.error("\n❌ Scout test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
