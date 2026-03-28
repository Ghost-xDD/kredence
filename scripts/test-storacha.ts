/**
 * Storacha upload + retrieve round-trip test.
 *
 * Prerequisites:
 *   1. Copy .env.example to .env and fill in STORACHA_PRINCIPAL + STORACHA_PROOF
 *   2. Run: pnpm test:storacha
 */
import "dotenv/config";

// Import directly from built dist to avoid ESM/CJS resolution issues in root scripts
import { uploadJSON, retrieveJSON, verifyCID } from "../packages/storage/dist/index.js";

async function main() {
  console.log("── Storacha round-trip test ──────────────────────");

  // 1. Upload
  const payload = {
    test: true,
    timestamp: new Date().toISOString(),
    message: "credence storacha round-trip",
  };

  console.log("1. Uploading test payload...");
  const { cid, url } = await uploadJSON(payload, "test.json");
  console.log(`   ✓ CID: ${cid}`);
  console.log(`   ✓ URL: ${url}`);

  // 2. Verify gateway reachability (retry for propagation delay)
  console.log("2. Verifying CID is reachable via gateway...");
  let reachable = false;
  for (let i = 0; i < 10; i++) {
    reachable = await verifyCID(cid, "test.json");
    if (reachable) break;
    process.stdout.write(`   retrying (${i + 1}/10)...\r`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!reachable) throw new Error("CID not reachable after 10 retries — check gateway or try again");
  console.log("   ✓ Gateway confirmed reachable    ");

  // 3. Retrieve and compare
  console.log("3. Retrieving and comparing payload...");
  const retrieved = await retrieveJSON<typeof payload>(cid, "test.json");
  if (retrieved.message !== payload.message) {
    throw new Error(`Payload mismatch:\n  expected: ${payload.message}\n  got:      ${retrieved.message}`);
  }
  console.log("   ✓ Retrieved payload matches original");

  console.log(`\n✅ Round-trip passed — CID: ${cid}`);
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
