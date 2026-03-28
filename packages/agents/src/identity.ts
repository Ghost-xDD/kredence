// ERC-8004 identity helpers
// Contracts: https://github.com/erc-8004/erc-8004-contracts
//
// We use Base Sepolia for development (testnet with deployed registries).
// Switch to Base Mainnet for production.

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Contract addresses — Base Sepolia testnet
export const ERC8004_CONTRACTS = {
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const,
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const,
} as const;

export const AGENT_REGISTRY_PREFIX = `eip155:${baseSepolia.id}:${ERC8004_CONTRACTS.identityRegistry}`;

const IDENTITY_ABI = parseAbi([
  "function register(address to, string agentURI) returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string agentURI) external",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

const REPUTATION_ABI = parseAbi([
  "function giveFeedback(uint256 agentId, address clientAddress, int128 value, uint8 valueDecimals, bytes32 tag1, bytes32 tag2, string feedbackURI, bytes32 feedbackHash) external",
  "function getSummary(uint256 agentId, address[] clientAddresses, bytes32 tag1, bytes32 tag2) view returns (uint256 count, int128 summaryValue, uint8 summaryValueDecimals)",
]);

function getWalletClient() {
  const privateKey = process.env["OPERATOR_PRIVATE_KEY"];
  if (!privateKey) throw new Error("OPERATOR_PRIVATE_KEY env var is not set");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env["BASE_SEPOLIA_RPC_URL"] ?? "https://sepolia.base.org"),
  });
}

function getPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(process.env["BASE_SEPOLIA_RPC_URL"] ?? "https://sepolia.base.org"),
  });
}

/**
 * Register a new agent identity in the ERC-8004 IdentityRegistry.
 * Returns the minted agentId (tokenId).
 */
export async function registerAgentIdentity(agentURI: string): Promise<string> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const account = wallet.account;

  const hash = await wallet.writeContract({
    address: ERC8004_CONTRACTS.identityRegistry,
    abi: IDENTITY_ABI,
    functionName: "register",
    args: [account.address, agentURI],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // The agentId is emitted in the Transfer event (ERC-721 mint)
  // tokenId is the last log topic for a standard ERC-721 Transfer
  const transferLog = receipt.logs.at(-1);
  if (!transferLog) throw new Error("No Transfer log in registration receipt");

  const agentId = BigInt(transferLog.topics[3] ?? "0x0").toString();
  return agentId;
}

/**
 * Update the agentURI for an existing agent (e.g. after uploading a new registration file).
 */
export async function updateAgentURI(agentId: string, agentURI: string): Promise<string> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();

  const hash = await wallet.writeContract({
    address: ERC8004_CONTRACTS.identityRegistry,
    abi: IDENTITY_ABI,
    functionName: "setAgentURI",
    args: [BigInt(agentId), agentURI],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Submit reputation feedback for an agent after a completed evaluation run.
 * value + valueDecimals follow the ERC-8004 signed fixed-point format.
 */
export async function submitReputationFeedback(params: {
  agentId: string;
  value: number;        // e.g. 9977 for 99.77%
  valueDecimals: number; // e.g. 2
  tag1: string;         // e.g. "evaluation"
  tag2: string;         // e.g. "adversarial"
  feedbackURI?: string;
}): Promise<string> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();

  const toBytes32 = (s: string) =>
    `0x${Buffer.from(s.padEnd(32, "\0")).toString("hex")}` as `0x${string}`;

  const hash = await wallet.writeContract({
    address: ERC8004_CONTRACTS.reputationRegistry,
    abi: REPUTATION_ABI,
    functionName: "giveFeedback",
    args: [
      BigInt(params.agentId),
      wallet.account.address,
      BigInt(params.value),
      params.valueDecimals,
      toBytes32(params.tag1),
      toBytes32(params.tag2),
      params.feedbackURI ?? "",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Get the block explorer URL for a transaction on Base Sepolia.
 */
export function explorerTxUrl(hash: string): string {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

/**
 * Get the block explorer URL for an agent identity token.
 */
export function explorerAgentUrl(agentId: string): string {
  return `https://sepolia.basescan.org/token/${ERC8004_CONTRACTS.identityRegistry}?a=${agentId}`;
}
