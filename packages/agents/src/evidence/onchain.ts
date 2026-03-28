/**
 * Onchain evidence collector.
 *
 * Fetches basic on-chain activity for a contract address:
 * transaction count, whether it's a deployed contract, and estimated
 * first/last activity timestamps where available.
 *
 * Uses viem with public RPC endpoints. ETH mainnet and Base Sepolia are supported.
 */
import { createPublicClient, http, type Hex } from "viem";
import { mainnet, baseSepolia, base } from "viem/chains";
import type { OnchainSignals } from "@credence/types";

function getRpcUrl(chainId: number): string {
  switch (chainId) {
    case 1:
      return "https://eth.llamarpc.com";
    case 8453:
      return "https://mainnet.base.org";
    case 84532:
      return process.env["BASE_SEPOLIA_RPC_URL"] ?? "https://sepolia.base.org";
    default:
      return "https://eth.llamarpc.com";
  }
}

function getChain(chainId: number) {
  switch (chainId) {
    case 8453:
      return base;
    case 84532:
      return baseSepolia;
    default:
      return mainnet;
  }
}

/**
 * Parse an address from various formats:
 * - plain address: "0x..."
 * - CAIP-10: "eip155:1:0x..."
 * - explorer URLs: "etherscan.io/address/0x..."
 */
function parseAddress(raw: string): { address: Hex; chainId: number } {
  // CAIP-10: eip155:chainId:address
  const caip10 = raw.match(/^eip155:(\d+):(0x[0-9a-fA-F]{40})$/);
  if (caip10?.[1] && caip10?.[2]) {
    return { address: caip10[2] as Hex, chainId: parseInt(caip10[1], 10) };
  }

  // Etherscan-style URL
  const explorerMatch = raw.match(/address\/(0x[0-9a-fA-F]{40})/);
  if (explorerMatch?.[1]) {
    return { address: explorerMatch[1] as Hex, chainId: 1 };
  }

  // Plain address
  const plainMatch = raw.match(/(0x[0-9a-fA-F]{40})/);
  if (plainMatch?.[1]) {
    return { address: plainMatch[1] as Hex, chainId: 1 };
  }

  throw new Error(`Cannot parse Ethereum address from: ${raw}`);
}

export async function collectOnchainEvidence(raw: string): Promise<OnchainSignals> {
  const { address, chainId } = parseAddress(raw);

  const client = createPublicClient({
    chain: getChain(chainId),
    transport: http(getRpcUrl(chainId)),
  });

  let transactionCount = 0;
  let isVerifiedContract = false;

  try {
    transactionCount = await client.getTransactionCount({ address });
  } catch {
    // RPC failed — leave at 0
  }

  try {
    const code = await client.getCode({ address });
    isVerifiedContract = !!code && code !== "0x";
  } catch {
    // ignore
  }

  // First/last activity is expensive to derive from public RPCs without indexers.
  // We leave these null for now — the Adversarial Agent can flag "deployment date unverifiable".
  return {
    address,
    chainId,
    transactionCount,
    firstActivityAt: null,
    lastActivityAt: null,
    isVerifiedContract,
  };
}
