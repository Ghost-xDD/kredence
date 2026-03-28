/**
 * Entry point — loads .env, starts the HTTP + WebSocket server.
 */
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from repo root when running locally
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { createApp } from "./app.js";
import { initRegistry } from "./registry-store.js";

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

// Seed in-memory registry from Storacha before accepting connections
await initRegistry();

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
