/**
 * HTTP + WebSocket server.
 *
 * HTTP endpoints:
 *   GET  /health        — liveness check (used by load balancers / Railway)
 *   GET  /ws-info       — returns the WS URL (useful for client config)
 *
 * WebSocket endpoint:
 *   WS   /ws            — pipeline runner, one run per connection
 *
 * WSS in production: 
 *   The server itself speaks plain HTTP/WS. TLS termination is handled
 *   by the platform (Railway, Fly.io, Render) or an nginx/Caddy reverse
 *   proxy. The client connects via wss:// through the platform's ingress.
 *
 *   If you need in-process TLS (e.g. on a bare VPS), wrap createServer()
 *   with https.createServer({ cert, key }) and the WS server attaches to
 *   that instead. Set TLS_CERT_FILE / TLS_KEY_FILE env vars and swap in:
 *
 *     import { readFileSync } from "fs";
 *     import https from "https";
 *     const server = https.createServer({
 *       cert: readFileSync(process.env.TLS_CERT_FILE!),
 *       key:  readFileSync(process.env.TLS_KEY_FILE!),
 *     }, app);
 */
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { nanoid } from "nanoid";
import { runPipeline } from "./pipeline.js";
import type { ClientMessage, ServerMessage } from "./ws-types.js";
import { getRegistry, findEntry, initRegistry } from "./registry-store.js";
import { retrieveJSON } from "@credence/storage";

const SERVER_VERSION = "0.1.0";

// ── Helpers ────────────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      typeof (parsed as Record<string, unknown>)["type"] === "string"
    ) {
      return parsed as ClientMessage;
    }
  } catch {
    // ignore malformed JSON
  }
  return null;
}

// ── App factory ────────────────────────────────────────────────────────────

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env["CORS_ORIGIN"] ?? "*",
      methods: ["GET", "POST", "OPTIONS"],
    })
  );
  app.use(express.json());

  // ── REST endpoints ──────────────────────────────────────────────────────

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      version: SERVER_VERSION,
      ts: new Date().toISOString(),
    });
  });

  app.get("/ws-info", (req, res) => {
    const proto = req.headers["x-forwarded-proto"] === "https" ? "wss" : "ws";
    const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
    res.json({ url: `${proto}://${host}/ws` });
  });

  // ── Hypercert registry endpoints ────────────────────────────────────────

  /** List all evaluated projects (compact registry entries). */
  app.get("/projects", (_req, res) => {
    res.json(getRegistry());
  });

  /** Full HypercertPayload for a specific project slug — fetched from Storacha. */
  app.get("/projects/:slug", async (req, res) => {
    const entry = findEntry(req.params.slug ?? "");
    if (!entry) {
      res.status(404).json({ error: "not found" });
      return;
    }
    try {
      // `filename` was added after the initial release — fall back to slug-based
      // name for legacy entries that predate the field.
      const filename = entry.filename ?? `hypercert-${entry.slug}.json`;
      const payload = await retrieveJSON(entry.cid, filename);
      res.json(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: "failed to fetch from Storacha", detail: msg });
    }
  });

  // ── HTTP server (WS attaches here) ──────────────────────────────────────

  const server = createServer(app);

  // ── WebSocket server ────────────────────────────────────────────────────

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const ip = req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown";
    const connectionId = nanoid(8);
    console.log(`[ws][${connectionId}] connected from ${ip}`);

    // Track whether a pipeline run is already in progress on this connection
    let runActive = false;

    send(ws, { type: "ready", serverVersion: SERVER_VERSION });

    ws.on("message", async (raw) => {
      const msg = parseClientMessage(raw.toString());
      if (!msg) return;

      if (msg.type === "ping") {
        send(ws, { type: "pong" });
        return;
      }

      if (msg.type === "run") {
        if (runActive) {
          // One run per connection — ignore concurrent run requests
          console.warn(`[ws][${connectionId}] run request ignored — another run is active`);
          return;
        }

        const runId = nanoid();
        const maxProjects = Math.min(msg.maxProjects ?? 3, 10); // hard cap at 10
        runActive = true;

        console.log(
          `[ws][${connectionId}] starting run ${runId} — ecosystem: ${msg.payload.kind}, maxProjects: ${maxProjects}`
        );

        // Run in background — do not await (keeps the WS message handler free)
        runPipeline(runId, msg.payload, maxProjects, (serverMsg) => {
          send(ws, serverMsg);
        })
          .catch((err: unknown) => {
            console.error(`[ws][${connectionId}][${runId}] unhandled error:`, err);
          })
          .finally(() => {
            runActive = false;
            console.log(`[ws][${connectionId}] run ${runId} finished`);
          });
      }
    });

    ws.on("close", (code, reason) => {
      console.log(
        `[ws][${connectionId}] disconnected — code: ${code}, reason: ${reason.toString() || "(none)"}`
      );
    });

    ws.on("error", (err) => {
      console.error(`[ws][${connectionId}] error:`, err.message);
    });
  });

  // Periodic ping to keep connections alive through proxies / load balancers
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30_000);

  server.on("close", () => clearInterval(pingInterval));

  return server;
}
