/**
 * EIP-191 signing for adversarial log receipts.
 *
 * Produces a canonical message from { projectId, entries }, hashes it,
 * and signs with the operator wallet's private key. The resulting
 * signatureContext makes the AdversarialLog a verifiable agent receipt:
 * anyone can re-derive the message and verify the signature on-chain or off.
 */
import { createWalletClient, http, keccak256, toBytes } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { AdversarialLogEntry } from "@credence/types";

export type SignatureContext = {
  method: "eip191";
  signerAddress: string;
  messageHash: string;
  signature: string;
};

/**
 * Canonical message format: a deterministic JSON string of the log's
 * essential fields. Any verifier can reproduce this from the stored log.
 */
function buildCanonicalMessage(
  projectId: string,
  entries: AdversarialLogEntry[]
): string {
  return JSON.stringify({
    projectId,
    entries: entries.map((e) => ({
      claimId: e.claimId,
      challengeType: e.challengeType,
      outcome: e.outcome,
    })),
  });
}

export async function signAdversarialLog(
  projectId: string,
  entries: AdversarialLogEntry[]
): Promise<SignatureContext | null> {
  const privateKey = process.env["OPERATOR_PRIVATE_KEY"];
  if (!privateKey) {
    console.warn("[Adversarial/Sign] OPERATOR_PRIVATE_KEY not set — skipping signature");
    return null;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env["BASE_SEPOLIA_RPC_URL"] ?? "https://sepolia.base.org"),
  });

  const message = buildCanonicalMessage(projectId, entries);
  const messageHash = keccak256(toBytes(message));

  // EIP-191: personal_sign (prefixes with "\x19Ethereum Signed Message:\n" + length)
  const signature = await walletClient.signMessage({ message });

  return {
    method: "eip191",
    signerAddress: account.address,
    messageHash,
    signature,
  };
}
