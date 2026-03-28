import * as Client from "@web3-storage/w3up-client";
import { StoreMemory } from "@web3-storage/w3up-client/stores/memory";
import * as Proof from "@web3-storage/w3up-client/proof";
import { Signer } from "@ucanto/principal/ed25519";

let _client: Client.Client | null = null;

/**
 * Returns a singleton w3up client authenticated via a pre-issued delegation proof.
 *
 * Setup (one-time):
 *   1. npm i -g @web3-storage/w3cli
 *   2. w3 login your@email.com
 *   3. w3 space create credence
 *   4. w3 key create > key.out          # generates an agent key
 *   5. w3 delegation create --can 'store/add' --can 'upload/add' \
 *        $(head -1 key.out) | base64 > proof.b64
 *   6. Copy key.out line 2 (the DID key) into STORACHA_PRINCIPAL
 *      Copy proof.b64 contents into STORACHA_PROOF
 */
export async function getStorachaClient(): Promise<Client.Client> {
  if (_client) return _client;

  const principalKey = process.env["STORACHA_PRINCIPAL"];
  const proofB64 = process.env["STORACHA_PROOF"];

  if (!principalKey || !proofB64) {
    throw new Error(
      "STORACHA_PRINCIPAL and STORACHA_PROOF env vars must be set. See .env.example for setup instructions."
    );
  }

  const principal = Signer.parse(principalKey);
  const client = await Client.create({ principal, store: new StoreMemory() });

  const proof = await Proof.parse(proofB64);
  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did());

  _client = client;
  return client;
}
