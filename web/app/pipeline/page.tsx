"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Nav } from "../components/nav";

// ── Local types (mirror @credence/types without bundling them client-side) ──

type AgentRole = "scout" | "evidence" | "adversarial" | "synthesis";
type Agent = "system" | AgentRole;
type Phase = "discover" | "plan" | "execute" | "verify" | "submit";
type EventType = "log" | "tool-call" | "tool-done" | "handover" | "project-complete";

type EcosystemInput =
  | { kind: "devspot"; url: string }
  | { kind: "filecoin-devgrants"; repo: string; labels?: string[] }
  | { kind: "chainlink-hackathon"; galleryUrl: string; maxProjects?: number }
  | { kind: "ethglobal"; eventSlug: string }
  | { kind: "devfolio"; hackathonSlug: string }
  | { kind: "gitcoin"; roundId: string; chainId?: number }
  | { kind: "octant"; epochNumber?: number }
  | { kind: "manual"; urls: string[] }
  | { kind: "github-repo"; repoUrl: string; installationId?: number };

type PipelineEvent = {
  id: string;
  elapsed: number;
  agent: Agent;
  phase: Phase;
  type: EventType;
  message: string;
  detail?: string;
  toolCall?: { name: string; input?: string; output?: string; durationMs?: number };
  projectId?: string;
};

type CompletedProject = {
  id: string;
  name: string;
  confidence: number;
  verified: number;
  flagged: number;
  hasAtproto: boolean;
};

// Server → Client message shapes (mirror ws-types.ts)
type ServerMessage =
  | { type: "ready"; serverVersion: string }
  | { type: "pong" }
  | { type: "pipeline_start"; runId: string; ecosystem: string }
  | { type: "pipeline_done"; runId: string; summary: PipelineSummary }
  | { type: "pipeline_error"; runId: string; stage: string; message: string }
  | { type: "stage_start"; runId: string; stage: AgentRole }
  | { type: "stage_done"; runId: string; stage: AgentRole }
  | { type: "log"; runId: string; agent: AgentRole; entry: { phase: string; action: string; details?: Record<string, unknown> } }
  | { type: "tool_call"; runId: string; agent: AgentRole; phase: string; tool: string; input: unknown }
  | { type: "tool_done"; runId: string; agent: AgentRole; phase: string; tool: string; output: unknown; durationMs: number }
  | { type: "tool_error"; runId: string; agent: AgentRole; phase: string; tool: string; error: string; durationMs: number }
  | { type: "project_complete"; runId: string; payload: {
      title: string;
      confidenceScore: number;
      verifiedClaims: unknown[];
      flaggedClaims: unknown[];
      atproto?: unknown;
      storachaRefs: { hypercertPayloadCid?: string };
    }
  };

type PipelineSummary = {
  projectsEvaluated: number;
  hypercertsStored: number;
  atprotoPublished: number;
  totalVerified: number;
  totalFlagged: number;
  totalUnresolved: number;
  durationMs: number;
};

// ── Meta ───────────────────────────────────────────────────────────────────

const STAGE_META = [
  { step: "01", name: "Scout",       tag: "discover",  agent: "scout"       as Agent },
  { step: "02", name: "Evidence",    tag: "collect",   agent: "evidence"    as Agent },
  { step: "03", name: "Adversarial", tag: "challenge", agent: "adversarial" as Agent },
  { step: "04", name: "Synthesis",   tag: "publish",   agent: "synthesis"   as Agent },
];

const STAGE_AGENTS: Agent[] = ["scout", "evidence", "adversarial", "synthesis"];

const WS_URL =
  (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001") + "/ws";

// ── Live Stats ─────────────────────────────────────────────────────────────

type LiveStats = {
  scoutVisible: boolean;
  pagesScraped: number;
  projectsRaw: number;
  projectsIndexed: number;
  duplicatesRemoved: number;
  manifestCid: string | null;
  evidenceVisible: boolean;
  evidenceProjectsDone: number;
  claimsExtracted: number;
  sourcesQueried: number;
  adversarialVisible: boolean;
  adversarialVerified: number;
  adversarialFlagged: number;
  adversarialUnresolved: number;
  avgConfidence: string | null;
  synthesisVisible: boolean;
  hypercertsBuilt: number;
  atprotoPublished: number;
};

const INITIAL_STATS: LiveStats = {
  scoutVisible: false, pagesScraped: 0, projectsRaw: 0, projectsIndexed: 0,
  duplicatesRemoved: 0, manifestCid: null,
  evidenceVisible: false, evidenceProjectsDone: 0, claimsExtracted: 0, sourcesQueried: 0,
  adversarialVisible: false, adversarialVerified: 0, adversarialFlagged: 0,
  adversarialUnresolved: 0, avgConfidence: null,
  synthesisVisible: false, hypercertsBuilt: 0, atprotoPublished: 0,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function buildPayload(source: string, identifier: string): EcosystemInput {
  switch (source) {
    case "Filecoin Dev Grants":
      return { kind: "filecoin-devgrants", repo: identifier || "filecoin-project/devgrants" };
    case "Chainlink Convergence":
      return { kind: "chainlink-hackathon", galleryUrl: identifier || "https://chain.link/hack-26" };
    case "Devfolio": {
      // Accept either a full URL like https://ethbangkok.devfolio.co or just the slug
      const slug = identifier.replace(/^https?:\/\//, "").replace(/\.devfolio\.co.*$/, "").trim();
      return { kind: "devfolio", hackathonSlug: slug || "ethbangkok" };
    }
    case "Gitcoin Grants": {
      // Accept "roundAddress" or "chainId/roundAddress"
      const parts = identifier.split("/");
      const roundId = parts.length >= 2 ? (parts[1] ?? "") : (parts[0] ?? "");
      const chainId = parts.length >= 2 ? parseInt(parts[0] ?? "42161", 10) : 42161;
      return { kind: "gitcoin", roundId, chainId };
    }
    case "Octant": {
      const epoch = parseInt(identifier, 10);
      return { kind: "octant", epochNumber: isNaN(epoch) ? undefined : epoch };
    }
    case "Manual URL list":
      return { kind: "manual", urls: identifier.split(",").map((s) => s.trim()).filter(Boolean) };
    default:
      return { kind: "devspot", url: identifier };
  }
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stringify(val: unknown): string {
  if (typeof val === "string") return val;
  try { return JSON.stringify(val); } catch { return String(val); }
}

/** Compact human-readable summary of a tool value for the event feed display. */
function formatValue(val: unknown, depth = 0): string {
  if (val === null || val === undefined) return "";

  if (typeof val === "string") return val.length > 120 ? `${val.slice(0, 117)}…` : val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);

  if (Array.isArray(val)) {
    const n = val.length;
    if (n === 0) return "0 items";
    const first = val[0] as Record<string, unknown> | undefined;
    if (first && typeof first === "object") {
      if ("ecosystemKind" in first || ("name" in first && "sources" in first))
        return `${n} project${n !== 1 ? "s" : ""} discovered`;
      if ("claimId" in first && "outcome" in first) {
        const verified = (val as { outcome: string }[]).filter((c) => c.outcome === "verified").length;
        return `${n} claims · ${verified} verified · ${n - verified} flagged`;
      }
      if ("id" in first && "text" in first && "sourceType" in first)
        return `${n} claim${n !== 1 ? "s" : ""} extracted`;
      const label = String(first.name ?? first.title ?? first.text ?? "").slice(0, 60);
      return label ? `${label}${n > 1 ? ` +${n - 1}` : ""}` : `${n} items`;
    }
    return `${n} items`;
  }

  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    // Unwrap single-key wrappers like { url: "..." } or { project: {...} }
    const keys = Object.keys(obj);
    if (keys.length === 1 && depth === 0) {
      return formatValue(obj[keys[0]!], 1);
    }
    // Prefer meaningful fields
    if ("title" in obj)   return String(obj.title).slice(0, 100);
    if ("name"  in obj)   return String(obj.name).slice(0, 100);
    if ("url"   in obj)   return String(obj.url).slice(0, 120);
    if ("action" in obj)  return String(obj.action).slice(0, 100);
    return `{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", …" : ""}}`;
  }

  return String(val).slice(0, 120);
}

function formatOutput(raw: string): string {
  if (!raw) return "";
  try { return formatValue(JSON.parse(raw) as unknown); }
  catch { return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw; }
}

// Internal housekeeping actions that add no signal to the feed
const NOISE_ACTIONS = new Set([
  "agent:start", "agent:done", "agent:output-ready", "agent:persisting-output",
  "scout:adapter-devspot", "scout:adapter-chainlink-hackathon",
  "scout:adapter-devfolio", "scout:adapter-gitcoin", "scout:adapter-octant",
  "synthesis:start", "synthesis:llm-start", "synthesis:llm-done",
  "synthesis:storing-payload", "adversarial:start", "evidence:start",
]);

// ── Component ──────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [status, setStatus]               = useState<"idle" | "running" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [events, setEvents]               = useState<PipelineEvent[]>([]);
  const [completedProjects, setCompleted] = useState<CompletedProject[]>([]);
  const [elapsedMs, setElapsedMs]         = useState(0);
  const [source, setSource]               = useState("Devspot Hackathon");
  const [identifier, setIdentifier]       = useState(
    "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects"
  );

  // Live agent state
  const [activeAgent, setActiveAgent]   = useState<Agent | null>(null);
  const [activePhase, setActivePhase]   = useState<Phase>("discover");
  const [activeAction, setActiveAction] = useState<string>("");
  const [activeTool, setActiveTool]     = useState<string | null>(null);
  const [agentKey, setAgentKey]         = useState(0);

  // Handover state
  const [handover, setHandover] = useState<{
    visible: boolean; from: string; to: string; detail?: string; exiting?: boolean;
  }>({ visible: false, from: "", to: "" });

  // Live stats
  const [stats, setStats]             = useState<LiveStats>(INITIAL_STATS);
  const [flashedKeys, setFlashedKeys] = useState<Set<string>>(new Set());

  const feedRef          = useRef<HTMLDivElement>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef            = useRef<WebSocket | null>(null);
  const startedAtRef     = useRef<number>(0);
  const eventCounterRef  = useRef(0);
  const prevStageRef     = useRef<AgentRole | null>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  // Cleanup WS on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const flash = useCallback((keys: string[]) => {
    setFlashedKeys((fk) => new Set([...fk, ...keys]));
    setTimeout(() => {
      setFlashedKeys((fk) => {
        const next = new Set(fk);
        keys.forEach((k) => next.delete(k));
        return next;
      });
    }, 900);
  }, []);

  const updateStats = useCallback((update: Partial<LiveStats>) => {
    setStats((s) => ({ ...s, ...update }));
    flash(Object.keys(update));
  }, [flash]);

  const triggerHandover = useCallback(
    (from: string, to: string, detail?: string) => {
      setHandover({ visible: true, from, to, detail, exiting: false });
      setTimeout(() => setHandover((h) => ({ ...h, exiting: true })), 2600);
      setTimeout(() => setHandover({ visible: false, from: "", to: "" }), 2900);
    },
    []
  );

  const addEvent = useCallback((ev: Omit<PipelineEvent, "id" | "elapsed">) => {
    const id = `ev-${eventCounterRef.current++}`;
    const elapsed = Date.now() - startedAtRef.current;
    setEvents((prev) => [...prev, { ...ev, id, elapsed }]);
  }, []);

  function startPipeline() {
    if (status === "running") return;

    // Reset state
    setStatus("running");
    setErrorMsg(null);
    setEvents([]);
    setCompleted([]);
    setElapsedMs(0);
    setActiveAgent(null);
    setActiveAction("");
    setActiveTool(null);
    setStats(INITIAL_STATS);
    setFlashedKeys(new Set());
    eventCounterRef.current = 0;
    prevStageRef.current = null;

    const startMs = Date.now();
    startedAtRef.current = startMs;
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startMs), 250);

    const payload = buildPayload(source, identifier);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[pipeline] WS connected");
    };

    ws.onmessage = (event) => {
      let msg: ServerMessage;
      try { msg = JSON.parse(event.data as string) as ServerMessage; }
      catch { return; }

      const elapsed = Date.now() - startMs;

      switch (msg.type) {
        case "ready": {
          ws.send(JSON.stringify({ type: "run", payload, maxProjects: 3 }));
          break;
        }

        case "pipeline_start": {
          addEvent({ agent: "system", phase: "discover", type: "log",
            message: `Pipeline started · ${msg.ecosystem}` });
          break;
        }

        case "stage_start": {
          const newAgent = msg.stage;
          const stageName = newAgent.charAt(0).toUpperCase() + newAgent.slice(1);

          // Handover from previous stage
          if (prevStageRef.current) {
            const from = prevStageRef.current.charAt(0).toUpperCase() + prevStageRef.current.slice(1);
            triggerHandover(from, stageName);
            addEvent({ agent: "system", phase: "submit", type: "handover",
              message: `${from} → ${stageName}` });
          }
          prevStageRef.current = msg.stage;

          setActiveAgent(newAgent);
          setAgentKey((k) => k + 1);
          setActivePhase("discover");
          setActiveAction("Starting…");
          setActiveTool(null);

          // Show stats section for this agent
          if (newAgent === "scout")       updateStats({ scoutVisible: true });
          if (newAgent === "evidence")    updateStats({ evidenceVisible: true });
          if (newAgent === "adversarial") updateStats({ adversarialVisible: true });
          if (newAgent === "synthesis")   updateStats({ synthesisVisible: true });
          break;
        }

        case "stage_done": {
          // Nothing extra needed — UI infers done state from seenStageAgents
          break;
        }

        case "log": {
          const { phase, action, details } = msg.entry;
          addEvent({ agent: msg.agent, phase: phase as Phase, type: "log", message: action,
            detail: details ? stringify(Object.values(details)[0]) : undefined });
          setActivePhase(phase as Phase);
          setActiveAction(action);
          setActiveTool(null);

          // Extract live stats from structured log details
          if (msg.agent === "scout") {
            if (action === "scout:deduplication" && details) {
              const before = (details["before"] as number) ?? 0;
              const after  = (details["after"]  as number) ?? 0;
              updateStats({ projectsIndexed: after, duplicatesRemoved: before - after });
            }
            if (action === "scout:done" && details) {
              const cid = details["manifestCid"] as string | undefined;
              if (cid) updateStats({ manifestCid: `${cid.slice(0, 16)}…` });
            }
          }

          if (msg.agent === "evidence") {
            if (action === "evidence:claims:done" && details) {
              const n = (details["claimCount"] as number) ?? 0;
              setStats((s) => ({ ...s, claimsExtracted: s.claimsExtracted + n }));
              flash(["claimsExtracted"]);
            }
            if (action === "evidence:project-start") {
              setStats((s) => ({ ...s, evidenceProjectsDone: s.evidenceProjectsDone + 1 }));
              flash(["evidenceProjectsDone"]);
            }
          }

          if (msg.agent === "adversarial" && action === "adversarial:challenge-done" && details) {
            const ver = (details["verified"]   as number) ?? 0;
            const flg = (details["flagged"]    as number) ?? 0;
            const unr = (details["unresolved"] as number) ?? 0;
            setStats((s) => ({
              ...s,
              adversarialVerified:   s.adversarialVerified   + ver,
              adversarialFlagged:    s.adversarialFlagged    + flg,
              adversarialUnresolved: s.adversarialUnresolved + unr,
            }));
            const total = ver + flg + unr;
            if (total > 0) {
              const pct = Math.round((ver / total) * 100);
              updateStats({ avgConfidence: `${pct}%` });
            }
            flash(["adversarialVerified", "adversarialFlagged", "adversarialUnresolved", "avgConfidence"]);
          }
          break;
        }

        case "tool_call": {
          addEvent({ agent: msg.agent, phase: msg.phase as Phase, type: "tool-call",
            message: msg.tool,
            toolCall: { name: msg.tool, input: formatValue(msg.input) } });
          setActivePhase(msg.phase as Phase);
          setActiveTool(msg.tool);
          setActiveAction(`↳ ${msg.tool}`);
          break;
        }

        case "tool_done": {
          const out = stringify(msg.output);
          addEvent({ agent: msg.agent, phase: msg.phase as Phase, type: "tool-done",
            message: msg.tool,
            toolCall: { name: msg.tool, output: out, durationMs: msg.durationMs } });
          setActiveTool(null);
          setActiveAction(`✓ ${msg.tool} — ${formatOutput(out)}`);

          // Scout: count raw projects from scraper output
          const SCOUT_SCRAPER_TOOLS = new Set([
            "scrape_devspot_hackathon", "fetch_filecoin_dev_grants", "process_manual_urls",
            "scrape_chainlink_hackathon", "scrape_devfolio_hackathon",
            "fetch_gitcoin_round", "fetch_octant_projects",
          ]);
          if (msg.agent === "scout" && SCOUT_SCRAPER_TOOLS.has(msg.tool)) {
            try {
              const projects = JSON.parse(out) as unknown;
              if (Array.isArray(projects)) {
                updateStats({ projectsRaw: projects.length, pagesScraped: 1 });
              }
            } catch { /* ignore */ }
          }

          // Evidence: count sources queried per tool call
          if (msg.agent === "evidence") {
            setStats((s) => ({ ...s, sourcesQueried: s.sourcesQueried + 1 }));
            flash(["sourcesQueried"]);
          }
          break;
        }

        case "tool_error": {
          addEvent({ agent: msg.agent, phase: msg.phase as Phase, type: "tool-done",
            message: msg.tool,
            toolCall: { name: msg.tool, output: `Error: ${msg.error}`, durationMs: msg.durationMs } });
          setActiveTool(null);
          break;
        }

        case "project_complete": {
          void elapsed; // used above
          const p = msg.payload;
          const proj: CompletedProject = {
            id: slugify(p.title),
            name: p.title,
            confidence: Math.round(p.confidenceScore * 100),
            verified: p.verifiedClaims.length,
            flagged:  p.flaggedClaims.length,
            hasAtproto: !!p.atproto,
          };
          setCompleted((prev) => [...prev, proj]);
          addEvent({ agent: "synthesis", phase: "submit", type: "project-complete",
            message: `${p.title} complete`, projectId: proj.id });
          updateStats({ hypercertsBuilt: (stats.hypercertsBuilt || 0) + 1 });
          if (p.atproto) updateStats({ atprotoPublished: (stats.atprotoPublished || 0) + 1 });
          break;
        }

        case "pipeline_done": {
          const s = msg.summary;
          addEvent({ agent: "system", phase: "submit", type: "log",
            message: `Pipeline complete · ${s.projectsEvaluated} projects · ${s.hypercertsStored} hypercerts stored · ${formatElapsed(s.durationMs)}` });
          setStatus("done");
          setActiveAgent(null);
          if (timerRef.current) clearInterval(timerRef.current);
          // Reconcile final stats
          setStats((prev) => ({
            ...prev,
            adversarialVerified:  s.totalVerified,
            adversarialFlagged:   s.totalFlagged,
            adversarialUnresolved: s.totalUnresolved,
            hypercertsBuilt:      s.hypercertsStored,
            atprotoPublished:     s.atprotoPublished,
            evidenceProjectsDone: s.projectsEvaluated,
          }));
          break;
        }

        case "pipeline_error": {
          setErrorMsg(msg.message);
          setStatus("error");
          setActiveAgent(null);
          if (timerRef.current) clearInterval(timerRef.current);
          break;
        }

        default:
          break;
      }
    };

    ws.onerror = () => {
      setErrorMsg("WebSocket connection failed. Is the server running?");
      setStatus("error");
      if (timerRef.current) clearInterval(timerRef.current);
    };

    ws.onclose = (ev) => {
      if (ev.code !== 1000 && ev.code !== 1001) {
        setStatus((s) => s === "running" ? "error" : s);
        setErrorMsg((m) => m ?? "Connection closed unexpectedly.");
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
  }

  function reset() {
    wsRef.current?.close(1000, "reset");
    wsRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("idle");
    setErrorMsg(null);
    setEvents([]);
    setCompleted([]);
    setElapsedMs(0);
    setActiveAgent(null);
    setActiveAction("");
    setActiveTool(null);
    setHandover({ visible: false, from: "", to: "" });
    setStats(INITIAL_STATS);
    setFlashedKeys(new Set());
    prevStageRef.current = null;
    eventCounterRef.current = 0;
  }

  // Stage status helper
  const seenStageAgents = new Set(
    events.filter((e) => STAGE_AGENTS.includes(e.agent)).map((e) => e.agent as Agent)
  );

  function stageStatus(agent: Agent): "pending" | "active" | "done" {
    if (status === "done") return "done";
    if (!seenStageAgents.has(agent)) return "pending";
    const lastActive = STAGE_AGENTS.slice().reverse().find((a) => seenStageAgents.has(a));
    return lastActive === agent ? "active" : "done";
  }

  const currentStageMeta = STAGE_META.find((s) => s.agent === activeAgent);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Nav />

      {/* ── Input bar ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-5">
          <div className="flex items-stretch border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.04)] bg-white">
            <div className="hidden sm:flex items-center border-r border-[#e5e7eb] px-3 shrink-0">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={status === "running"}
                className="text-xs text-[#374151] bg-transparent outline-none cursor-pointer disabled:opacity-50 py-3"
              >
                <option>Devspot Hackathon</option>
                <option>Chainlink Convergence</option>
                <option>Devfolio</option>
                <option>Gitcoin Grants</option>
                <option>Octant</option>
                <option>Filecoin Dev Grants</option>
                <option>Manual URL list</option>
              </select>
            </div>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={status === "running"}
              className="flex-1 text-xs font-mono text-[#374151] px-4 py-3.5 outline-none disabled:opacity-50 bg-transparent"
              placeholder={
                source === "Devfolio"       ? "ethbangkok  (subdomain slug or full URL)" :
                source === "Gitcoin Grants" ? "42161/0xRoundAddress  (chainId/address)" :
                source === "Octant"         ? "7  (epoch number, leave blank for latest)" :
                "Paste ecosystem URL or identifier…"
              }
            />
            {(status === "idle" || status === "error") && (
              <button
                onClick={startPipeline}
                className="bg-[#0a0a0a] text-white text-xs font-semibold px-6 hover:bg-[#1f2937] transition-colors shrink-0"
              >
                Run →
              </button>
            )}
            {status === "running" && (
              <div className="flex items-center gap-2 px-5 border-l border-[#e5e7eb] shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a] animate-pulse" />
                <span className="text-[11px] font-mono text-[#6b7280] tabular-nums">{formatElapsed(elapsedMs)}</span>
              </div>
            )}
            {status === "done" && (
              <button
                onClick={reset}
                className="text-xs text-[#6b7280] px-5 border-l border-[#e5e7eb] hover:text-[#0a0a0a] transition-colors shrink-0"
              >
                Reset
              </button>
            )}
          </div>

          {/* Error banner */}
          {status === "error" && errorMsg && (
            <div className="mt-3 flex items-center justify-between gap-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg px-4 py-2.5">
              <span className="text-xs text-[#dc2626]">{errorMsg}</span>
              <button onClick={reset} className="text-[11px] text-[#dc2626] opacity-60 hover:opacity-100 shrink-0">Dismiss</button>
            </div>
          )}
        </div>
      </section>

      {/* ── Idle empty state ── */}
      {status === "idle" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6 py-20">
            <div className="w-12 h-12 rounded-xl bg-[#f3f4f6] flex items-center justify-center mx-auto mb-5">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-[#9ca3af]">
                <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M7 6l5 3-5 3V6z" fill="currentColor" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#0a0a0a] mb-1.5">Ready to evaluate</p>
            <p className="text-xs text-[#9ca3af] max-w-[280px] mx-auto leading-relaxed">
              Enter an ecosystem identifier above and click Run to start the four-agent pipeline.
            </p>
            <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-mono text-[#c4c8cf]">
              {["Scout", "Evidence", "Adversarial", "Synthesis"].map((name, i, arr) => (
                <span key={name} className="flex items-center gap-2">
                  <span>{name}</span>
                  {i < arr.length - 1 && <span className="text-[#e5e7eb]">→</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Running / Done / Error layout ── */}
      {status !== "idle" && (
        <div className="flex-1 flex flex-col">
          <div className="max-w-5xl mx-auto w-full px-5 sm:px-6">
          <div className="flex gap-6 items-start">

          {/* ── Left: main column ── */}
          <div className="flex-1 min-w-0">

            {/* ── Stage pills ── */}
            <div className="grid grid-cols-4 gap-2 pt-5 pb-4">
              {STAGE_META.map((stage) => {
                const st = stageStatus(stage.agent);
                const isActive = st === "active";
                const isDone   = st === "done";
                return (
                  <div
                    key={stage.step}
                    className={`rounded-xl px-3 py-2.5 transition-all duration-300 ${
                      isActive
                        ? "bg-[#0a0a0a] shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
                        : isDone
                        ? "bg-[#f9fafb] border border-[#e5e7eb]"
                        : "bg-[#f9fafb] border border-[#f3f4f6] opacity-40"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      )}
                      {isDone && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {st === "pending" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db]" />
                      )}
                      <span className={`text-[9px] font-mono ${isActive ? "text-[#6b7280]" : isDone ? "text-[#9ca3af]" : "text-[#c4c8cf]"}`}>
                        {stage.step}
                      </span>
                    </div>
                    <div className={`text-[11px] font-semibold leading-none ${isActive ? "text-white" : isDone ? "text-[#374151]" : "text-[#9ca3af]"}`}>
                      {stage.name}
                    </div>
                    <div className={`text-[9px] font-mono mt-0.5 ${isActive ? "text-[#6b7280]" : "text-[#c4c8cf]"}`}>
                      {stage.tag}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Active agent card ── */}
            {activeAgent && activeAgent !== "system" && (
              <div key={agentKey} className="animate-agent-enter mb-4">
                <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb]">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#0a0a0a] animate-pulse" />
                      <span className="text-[11px] font-semibold text-[#0a0a0a] uppercase tracking-wide">
                        {currentStageMeta?.step} · {currentStageMeta?.name} Agent
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#9ca3af] border border-[#e5e7eb] bg-white px-2 py-0.5 rounded-full">
                      {activePhase}
                    </span>
                  </div>
                  <div className="px-4 py-3 min-h-[52px]">
                    {activeTool ? (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono text-[#9ca3af] uppercase tracking-wide">tool call</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a] animate-pulse" />
                        </div>
                        <span className="text-sm font-mono font-medium text-[#0a0a0a]">{activeTool}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-[#374151] leading-relaxed">{activeAction}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Handover notification ── */}
            {handover.visible && (
              <div className={`mb-4 ${handover.exiting ? "animate-handover-out" : "animate-handover-in"}`}>
                <div className="rounded-xl bg-[#0a0a0a] px-5 py-4 flex items-center gap-4">
                  <div>
                    <div className="text-[10px] font-mono text-[#4b5563] uppercase tracking-widest mb-1">Handover</div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-bold text-white">{handover.from}</span>
                      <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                        <path d="M1 5h14M10 1l5 4-5 4" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-sm font-bold text-white">{handover.to}</span>
                    </div>
                  </div>
                  {handover.detail && (
                    <span className="ml-auto text-[11px] font-mono text-[#4b5563] text-right shrink-0">
                      {handover.detail}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Event feed ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">Agent Log</span>
                {status === "done" && (
                  <span className="text-[10px] font-mono text-[#16a34a]">✓ complete · {formatElapsed(elapsedMs)}</span>
                )}
              </div>
              <div
                ref={feedRef}
                className="rounded-xl border border-[#e5e7eb] overflow-hidden font-mono text-[11px] max-h-[340px] overflow-y-auto"
              >
                {events.length === 0 && (
                  <div className="flex items-center gap-2 px-4 py-4 text-[#c4c8cf]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e5e7eb] animate-pulse" />
                    Connecting…
                  </div>
                )}

                {events.map((ev) => {
                  if (ev.type === "project-complete") return null;
                  if (ev.type === "log" && NOISE_ACTIONS.has(ev.message)) return null;

                  if (ev.type === "handover") {
                    return (
                      <div key={ev.id} className="flex items-center gap-0 bg-[#0a0a0a]">
                        <span className="text-[#374151] text-[10px] px-4 py-2.5 shrink-0 tabular-nums w-16">
                          {formatElapsed(ev.elapsed)}
                        </span>
                        <span className="text-[10px] font-semibold text-white uppercase tracking-widest px-2">
                          handover
                        </span>
                        <span className="text-[#9ca3af] px-2">·</span>
                        <span className="text-[11px] text-[#d1d5db] font-medium">{ev.message}</span>
                        {ev.detail && (
                          <span className="ml-auto text-[10px] text-[#4b5563] px-4">{ev.detail}</span>
                        )}
                      </div>
                    );
                  }

                  const isSystem   = ev.agent === "system";
                  const isToolCall = ev.type === "tool-call";
                  const isToolDone = ev.type === "tool-done";
                  const isFlagged  = ev.message.includes("✗");
                  const isVerified = ev.message.includes("✓");

                  return (
                    <div
                      key={ev.id}
                      className={`flex items-start gap-0 border-b border-[#f3f4f6] hover:bg-[#fafafa] transition-colors ${
                        isToolCall ? "bg-[#f9fafb]" : ""
                      }`}
                    >
                      <span className="text-[#c4c8cf] px-4 py-2 shrink-0 tabular-nums w-16 pt-2.5">
                        {formatElapsed(ev.elapsed)}
                      </span>
                      {!isSystem ? (
                        <span className="shrink-0 text-[9px] font-medium text-[#9ca3af] uppercase tracking-wide w-20 pt-2.5 leading-none">
                          {ev.agent}
                        </span>
                      ) : (
                        <span className="w-20 shrink-0" />
                      )}
                      <span className="shrink-0 text-[#d1d5db] w-14 pt-2.5 hidden sm:block">
                        {ev.phase}
                      </span>
                      <div className={`flex-1 min-w-0 py-2 pr-4 ${isToolCall || isToolDone ? "border-l-2 border-[#e5e7eb] pl-3 ml-0" : ""}`}>
                        {isToolCall && (
                          <div>
                            <span className="text-[#6b7280]">↳ </span>
                            <span className="text-[#0a0a0a] font-medium">{ev.toolCall?.name}</span>
                            {ev.toolCall?.input && (
                              <div className="text-[#9ca3af] mt-0.5 truncate pl-3">{ev.toolCall.input}</div>
                            )}
                          </div>
                        )}
                        {isToolDone && (
                          <div>
                            <span className="text-[#9ca3af]">  ✓ </span>
                            <span className="text-[#6b7280]">
                              {formatOutput(ev.toolCall?.output ?? "")}
                            </span>
                            {ev.toolCall?.durationMs && (
                              <span className="text-[#c4c8cf] ml-2">{ev.toolCall.durationMs}ms</span>
                            )}
                          </div>
                        )}
                        {ev.type === "log" && (
                          <span className={
                            isSystem          ? "text-[#9ca3af]"  :
                            isFlagged         ? "text-[#6b7280]"  :
                            isVerified        ? "text-[#6b7280]"  :
                            ev.message.includes("Pipeline complete") ? "text-[#16a34a] font-medium" :
                            "text-[#374151]"
                          }>
                            {ev.message}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {status === "running" && (
                  <div className="flex items-center gap-2 px-4 py-2.5 text-[#c4c8cf]">
                    <span className="w-1 h-1 rounded-full bg-[#d1d5db] animate-pulse" />
                    <span>running…</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Results ── */}
            {completedProjects.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">
                    Hypercerts · {completedProjects.length}
                  </span>
                  {status === "done" && (
                    <Link href="/explore" className="text-xs text-[#6b7280] hover:text-[#0a0a0a] transition-colors">
                      Explore all →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {completedProjects.map((p) => {
                    const barColor =
                      p.confidence >= 70 ? "#16a34a" :
                      p.confidence >= 40 ? "#d97706" : "#dc2626";
                    return (
                      <Link
                        key={p.id}
                        href={`/project/${p.id}`}
                        className="group border border-[#e5e7eb] rounded-xl p-4 bg-white hover:border-[#c8cacf] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-sm font-semibold text-[#0a0a0a]">{p.name}</span>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-[#d1d5db] group-hover:text-[#9ca3af] shrink-0 mt-0.5 transition-colors">
                            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <div className="flex-1 h-[3px] rounded-full bg-[#f3f4f6] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p.confidence}%`, backgroundColor: barColor }} />
                          </div>
                          <span className="text-xs tabular-nums font-medium shrink-0" style={{ color: barColor }}>{p.confidence}%</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-[#9ca3af]">
                          <span>✓ {p.verified} verified</span>
                          {p.flagged > 0 && <span>✗ {p.flagged} flagged</span>}
                          {p.hasAtproto && (
                            <span className="ml-auto flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-[#16a34a]" />
                              ATProto
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: stats panel ── */}
          <div className="w-52 shrink-0 hidden sm:block pt-5 sticky top-6 self-start pb-10">
            <div className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider mb-4">Live Stats</div>

            {stats.scoutVisible && (
              <div className="animate-agent-enter mb-5">
                <div className="text-[10px] font-semibold text-[#0a0a0a] uppercase tracking-widest mb-2">Scout</div>
                <div className="space-y-1.5">
                  {[
                    { label: "Pages scraped",     key: "pagesScraped",     val: stats.pagesScraped     || "—" },
                    { label: "Projects raw",       key: "projectsRaw",      val: stats.projectsRaw      || "—" },
                    { label: "Projects indexed",   key: "projectsIndexed",  val: stats.projectsIndexed  || "—" },
                    { label: "Duplicates removed", key: "duplicatesRemoved",val: stats.duplicatesRemoved || "—" },
                    { label: "Manifest",           key: "manifestCid",      val: stats.manifestCid      || "—" },
                  ].map(({ label, key, val }) => (
                    <div key={key} className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-[#9ca3af] leading-snug shrink-0">{label}</span>
                      <span className={`text-[11px] font-mono tabular-nums truncate text-right transition-colors duration-500 ${
                        flashedKeys.has(key) ? "text-[#0a0a0a] font-semibold" : "text-[#6b7280]"
                      }`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.evidenceVisible && (
              <div className="animate-agent-enter mb-5">
                <div className="text-[10px] font-semibold text-[#0a0a0a] uppercase tracking-widest mb-2">Evidence</div>
                <div className="space-y-1.5">
                  {[
                    { label: "Processed",        key: "evidenceProjectsDone", val: stats.evidenceProjectsDone ? `${stats.evidenceProjectsDone} proj` : "—" },
                    { label: "Claims extracted", key: "claimsExtracted",      val: stats.claimsExtracted      || "—" },
                    { label: "Sources queried",  key: "sourcesQueried",       val: stats.sourcesQueried       || "—" },
                  ].map(({ label, key, val }) => (
                    <div key={key} className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-[#9ca3af] leading-snug shrink-0">{label}</span>
                      <span className={`text-[11px] font-mono tabular-nums transition-colors duration-500 ${
                        flashedKeys.has(key) ? "text-[#0a0a0a] font-semibold" : "text-[#6b7280]"
                      }`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.adversarialVisible && (
              <div className="animate-agent-enter mb-5">
                <div className="text-[10px] font-semibold text-[#0a0a0a] uppercase tracking-widest mb-2">Adversarial</div>
                <div className="space-y-1.5">
                  {[
                    { label: "Verified",       key: "adversarialVerified",   val: stats.adversarialVerified   || "—" },
                    { label: "Flagged",        key: "adversarialFlagged",    val: stats.adversarialFlagged    || "—" },
                    { label: "Unresolved",     key: "adversarialUnresolved", val: stats.adversarialUnresolved || "—" },
                    { label: "Avg confidence", key: "avgConfidence",         val: stats.avgConfidence         || "—" },
                  ].map(({ label, key, val }) => (
                    <div key={key} className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-[#9ca3af] leading-snug shrink-0">{label}</span>
                      <span className={`text-[11px] font-mono tabular-nums transition-colors duration-500 ${
                        flashedKeys.has(key) ? "text-[#0a0a0a] font-semibold" : "text-[#6b7280]"
                      }`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.synthesisVisible && (
              <div className="animate-agent-enter mb-5">
                <div className="text-[10px] font-semibold text-[#0a0a0a] uppercase tracking-widest mb-2">Synthesis</div>
                <div className="space-y-1.5">
                  {[
                    { label: "Hypercerts built",  key: "hypercertsBuilt",  val: stats.hypercertsBuilt  || "—" },
                    { label: "ATProto published", key: "atprotoPublished", val: stats.atprotoPublished || "—" },
                  ].map(({ label, key, val }) => (
                    <div key={key} className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-[#9ca3af] leading-snug shrink-0">{label}</span>
                      <span className={`text-[11px] font-mono tabular-nums transition-colors duration-500 ${
                        flashedKeys.has(key) ? "text-[#0a0a0a] font-semibold" : "text-[#6b7280]"
                      }`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          </div>{/* end flex row */}
          </div>
        </div>
      )}

      <footer className="border-t border-[#e5e7eb] mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
          <span className="text-xs text-[#6b7280]">
            Powered by{" "}
            <a href="https://docs.hypercerts.org" target="_blank" rel="noopener" className="hover:text-[#0a0a0a] transition-colors">Hypercerts</a>
            {" · "}
            <a href="https://storacha.network" target="_blank" rel="noopener" className="hover:text-[#0a0a0a] transition-colors">Storacha</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
