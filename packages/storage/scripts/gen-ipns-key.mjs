/**
 * One-time key generation for the IPNS registry pointer.
 *
 * Run:
 *   node packages/storage/scripts/gen-ipns-key.mjs
 *
 * Then add W3NAME_KEY to your Railway env vars (and local .env).
 * The IPNS name string is derived from the key — you don't need to
 * store it separately, but it's printed here for reference.
 */
import * as Name from "w3name";

const name = await Name.create();
const keyBase64 = Buffer.from(name.key.raw).toString("base64");

console.log("\n✓ IPNS key generated\n");
console.log("Add this to Railway env vars and your local .env:\n");
console.log(`W3NAME_KEY=${keyBase64}`);
console.log(`\nYour IPNS name (public, for reference):\n${name.toString()}\n`);
