/**
 * Entry point — loads .env, starts the HTTP + WebSocket server.
 */

// Polyfill File/Blob for Storacha (w3up-client) on Node <20.
// Node 20+ exposes these as globals; this is a no-op there.
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
if (typeof globalThis.File === "undefined") {
  // @ts-expect-error — polyfill for older Node runtimes
  globalThis.File = NodeFile;
}
if (typeof globalThis.Blob === "undefined") {
  // @ts-expect-error — polyfill for older Node runtimes
  globalThis.Blob = NodeBlob;
}

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from repo root when running locally
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { createApp } from "./app.js";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

const server = createApp();

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  Credence Pipeline Server  v0.1.0        ║
╠══════════════════════════════════════════╣
║  HTTP   →  http://localhost:${PORT}          ║
║  WS     →  ws://localhost:${PORT}/ws         ║
║  Health →  http://localhost:${PORT}/health   ║
╚══════════════════════════════════════════╝
`);
});

process.on("SIGTERM", () => {
  console.log("[server] SIGTERM received — shutting down gracefully");
  server.close(() => {
    console.log("[server] closed");
    process.exit(0);
  });
});
