/**
 * Verify all four agent ERC-8004 identities on Base Sepolia.
 * Uses raw JSON-RPC eth_call so no extra dependencies are needed.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../.env") });

const RPC = process.env["BASE_SEPOLIA_RPC_URL"] ?? "https://sepolia.base.org";
const REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

// ownerOf(uint256) selector = 0x6352211e
// tokenURI(uint256) selector = 0xc87b56dd
function encodeUint256(n: number): string {
  return n.toString(16).padStart(64, "0");
}

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  const json = (await res.json()) as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result ?? "0x";
}

function decodeAddress(hex: string): string {
  // address is in last 20 bytes of 32-byte word
  return "0x" + hex.slice(hex.length - 40);
}

function decodeString(hex: string): string {
  if (!hex || hex === "0x") return "(empty)";
  // ABI-encoded string: offset(32) + length(32) + utf8 bytes
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  const lengthHex = data.slice(64, 128);
  const length = parseInt(lengthHex, 16);
  const strHex = data.slice(128, 128 + length * 2);
  return Buffer.from(strHex, "hex").toString("utf8");
}

const AGENTS = [
  { name: "Scout Agent",       id: 3040 },
  { name: "Evidence Agent",    id: 3041 },
  { name: "Adversarial Agent", id: 3042 },
  { name: "Synthesis Agent",   id: 3043 },
];

console.log("── ERC-8004 Identity Check — Base Sepolia ──────────────────\n");

for (const agent of AGENTS) {
  const encoded = encodeUint256(agent.id);
  try {
    const [ownerHex, uriHex] = await Promise.all([
      ethCall(REGISTRY, "0x6352211e" + encoded),
      ethCall(REGISTRY, "0xc87b56dd" + encoded),
    ]);
    const owner = decodeAddress(ownerHex);
    const uri = decodeString(uriHex);
    console.log(`✓ ${agent.name} (ID ${agent.id})`);
    console.log(`  Owner:   ${owner}`);
    console.log(`  URI:     ${uri}`);
    console.log(`  Explorer: https://sepolia.basescan.org/token/${REGISTRY}?a=${agent.id}`);
  } catch (err) {
    console.log(`✗ ${agent.name} (ID ${agent.id}): ${err instanceof Error ? err.message : err}`);
  }
  console.log();
}
