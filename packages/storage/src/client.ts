import { create } from "@storacha/client";
import { StoreMemory } from "@storacha/client/stores/memory";
import * as Proof from "@storacha/client/proof";
import { Signer } from "@storacha/client/principal/ed25519";
import type { Client } from "@storacha/client";

let _client: Client | null = null;

/**
 * Returns a singleton Storacha client authenticated via a pre-issued delegation proof.
 *
 * Setup (one-time, using the storacha CLI):
 *   1. npm i -g @storacha/cli
 *   2. storacha login your@email.com
 *   3. storacha space create credence
 *   4. storacha key create > key.out
 *   5. storacha delegation create --can 'store/add' --can 'upload/add' \
 *        $(head -1 key.out) | base64 > proof.b64
 *
 * STORACHA_PRINCIPAL = line 2 of key.out (the did:key:... value)
 * STORACHA_PROOF     = contents of proof.b64
 */
export async function getStorachaClient(): Promise<Client> {
  if (_client) return _client;

  const principalKey = process.env["STORACHA_PRINCIPAL"];
  const proofB64 = process.env["STORACHA_PROOF"];

  if (!principalKey || !proofB64) {
    throw new Error(
      "STORACHA_PRINCIPAL and STORACHA_PROOF env vars must be set. See .env.example."
    );
  }

  const principal = Signer.parse(principalKey);
  const client = await create({ principal, store: new StoreMemory() });

  const proof = await Proof.parse(proofB64);
  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did());

  _client = client;
  return client;
}
