"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Nav } from "../components/nav";
import { MOCK_PROJECTS } from "../lib/mock-data";

// ── Types ──────────────────────────────────────────────────────────────────

type Agent = "system" | "scout" | "evidence" | "adversarial" | "synthesis";
type Phase = "discover" | "plan" | "execute" | "verify" | "submit";
type EventType = "log" | "tool-call" | "tool-done" | "handover" | "project-complete";

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

// ── Scripted simulation events ─────────────────────────────────────────────

const EVENTS: PipelineEvent[] = [
  { id: "s0",  elapsed: 0,     agent: "system",      phase: "discover", type: "log",          message: "Pipeline started · PL Genesis Hackathon (Devspot)" },
  { id: "s1",  elapsed: 200,   agent: "scout",       phase: "discover", type: "log",          message: "Selecting adapter for devspot ecosystem" },
  { id: "s2",  elapsed: 500,   agent: "scout",       phase: "plan",     type: "log",          message: "Adapter: scrape_devspot_hackathon" },
  { id: "s3",  elapsed: 700,   agent: "scout",       phase: "execute",  type: "tool-call",    message: "scrape_devspot_hackathon",
    toolCall: { name: "scrape_devspot_hackathon", input: "pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects" } },
  { id: "s4",  elapsed: 1400,  agent: "scout",       phase: "execute",  type: "log",          message: "Page 1 fetched — 24 projects" },
  { id: "s5",  elapsed: 2100,  agent: "scout",       phase: "execute",  type: "log",          message: "Page 2 fetched — 24 projects" },
  { id: "s6",  elapsed: 2800,  agent: "scout",       phase: "execute",  type: "log",          message: "Page 3 fetched — 24 projects" },
  { id: "s7",  elapsed: 3500,  agent: "scout",       phase: "execute",  type: "log",          message: "Page 4 fetched — 24 projects" },
  { id: "s8",  elapsed: 4000,  agent: "scout",       phase: "execute",  type: "tool-done",    message: "scrape_devspot_hackathon",
    toolCall: { name: "scrape_devspot_hackathon", output: "178 projects discovered", durationMs: 3300 } },
  { id: "s9",  elapsed: 4300,  agent: "scout",       phase: "verify",   type: "log",          message: "Deduplicating by GitHub URL — 178 → 174 unique" },
  { id: "s10", elapsed: 4700,  agent: "scout",       phase: "submit",   type: "log",          message: "Storing ProjectManifest on Storacha…" },
  { id: "s11", elapsed: 5100,  agent: "scout",       phase: "submit",   type: "log",          message: "Manifest stored · bafybeidqzm7v4rsxhp..." },
  { id: "s12", elapsed: 5500,  agent: "system",      phase: "submit",   type: "handover",     message: "Scout → Evidence",
    detail: "174 projects · bafybeidqzm7..." },

  { id: "e0",  elapsed: 6200,  agent: "evidence",    phase: "discover", type: "log",          message: "Processing 3 projects with GitHub + website sources" },
  { id: "e1",  elapsed: 6600,  agent: "evidence",    phase: "plan",     type: "log",          message: "ZKMarket — 3 sources queued" },
  { id: "e2",  elapsed: 6900,  agent: "evidence",    phase: "execute",  type: "tool-call",    message: "github_commits",
    toolCall: { name: "github_commits", input: "github.com/zkmarket/zkmarket" } },
  { id: "e3",  elapsed: 8000,  agent: "evidence",    phase: "execute",  type: "tool-done",    message: "github_commits",
    toolCall: { name: "github_commits", output: "47 commits · 2 contributors (last 90d)", durationMs: 1100 } },
  { id: "e4",  elapsed: 8300,  agent: "evidence",    phase: "execute",  type: "tool-call",    message: "github_issues",
    toolCall: { name: "github_issues", input: "github.com/zkmarket/zkmarket" } },
  { id: "e5",  elapsed: 9000,  agent: "evidence",    phase: "execute",  type: "tool-done",    message: "github_issues",
    toolCall: { name: "github_issues", output: "5 closed · 3 open · milestone: v1.0", durationMs: 700 } },
  { id: "e6",  elapsed: 9300,  agent: "evidence",    phase: "execute",  type: "tool-call",    message: "fetch_website",
    toolCall: { name: "fetch_website", input: "zkmarket.xyz" } },
  { id: "e7",  elapsed: 9900,  agent: "evidence",    phase: "execute",  type: "tool-done",    message: "fetch_website",
    toolCall: { name: "fetch_website", output: "200 OK · 1,204 tokens extracted", durationMs: 600 } },
  { id: "e8",  elapsed: 10200, agent: "evidence",    phase: "execute",  type: "tool-call",    message: "llm:extract_claims",
    toolCall: { name: "llm:extract_claims", input: "ZKMarket evidence bundle (GPT-4o structured output)" } },
  { id: "e9",  elapsed: 12200, agent: "evidence",    phase: "execute",  type: "tool-done",    message: "llm:extract_claims",
    toolCall: { name: "llm:extract_claims", output: "9 structured claims extracted", durationMs: 2000 } },
  { id: "e10", elapsed: 12500, agent: "evidence",    phase: "submit",   type: "log",          message: "ZKMarket bundle stored · bafybeidxyz3ev..." },
  { id: "e11", elapsed: 12900, agent: "evidence",    phase: "plan",     type: "log",          message: "DataBridge — 2 sources queued" },
  { id: "e12", elapsed: 13200, agent: "evidence",    phase: "execute",  type: "tool-call",    message: "github_commits",
    toolCall: { name: "github_commits", input: "github.com/databridge-xyz/databridge" } },
  { id: "e13", elapsed: 14300, agent: "evidence",    phase: "execute",  type: "tool-done",    message: "github_commits",
    toolCall: { name: "github_commits", output: "78 commits · 2 contributors", durationMs: 1100 } },
  { id: "e14", elapsed: 14600, agent: "evidence",    phase: "execute",  type: "tool-call",    message: "fetch_website",
    toolCall: { name: "fetch_website", input: "databridge.xyz" } },
  { id: "e15", elapsed: 15300, agent: "evidence",    phase: "execute",  type: "tool-done",    message: "fetch_website",
    toolCall: { name: "fetch_website", output: "200 OK · 892 tokens", durationMs: 700 } },
  { id: "e16", elapsed: 15600, agent: "evidence",    phase: "execute",  type: "tool-call",    message: "llm:extract_claims",
    toolCall: { name: "llm:extract_claims", input: "DataBridge evidence bundle (GPT-4o)" } },
  { id: "e17", elapsed: 17700, agent: "evidence",    phase: "execute",  type: "tool-done",    message: "llm:extract_claims",
    toolCall: { name: "llm:extract_claims", output: "10 structured claims extracted", durationMs: 2100 } },
  { id: "e18", elapsed: 18000, agent: "evidence",    phase: "submit",   type: "log",          message: "DataBridge bundle stored · bafybeidxyz2ev..." },
  { id: "e19", elapsed: 18400, agent: "evidence",    phase: "plan",     type: "log",          message: "StorageDAO — 3 sources queued" },
  { id: "e20", elapsed: 18700, agent: "evidence",    phase: "execute",  type: "tool-call",    message: "github_commits",
    toolCall: { name: "github_commits", input: "github.com/storagedao/storagedao" } },
  { id: "e21", elapsed: 19600, agent: "evidence",    phase: "execute",  type: "tool-done",    message: "github_commits",
    toolCall: { name: "github_commits", output: "134 commits · 3 contributors", durationMs: 900 } },
  { id: "e22", elapsed: 19900, agent: "evidence",    phase: "execute",  type: "tool-call",    message: "onchain_rpc",
    toolCall: { name: "onchain_rpc", input: "base-sepolia:0xabc123def456 (StorageDAO contract)" } },
  { id: "e23", elapsed: 20600, agent: "evidence",    phase: "execute",  type: "tool-done",    message: "onchain_rpc",
    toolCall: { name: "onchain_rpc", output: "208 transactions · deployed block 7,234,112", durationMs: 700 } },
  { id: "e24", elapsed: 20900, agent: "evidence",    phase: "execute",  type: "tool-call",    message: "llm:extract_claims",
    toolCall: { name: "llm:extract_claims", input: "StorageDAO evidence bundle (GPT-4o)" } },
  { id: "e25", elapsed: 23100, agent: "evidence",    phase: "execute",  type: "tool-done",    message: "llm:extract_claims",
    toolCall: { name: "llm:extract_claims", output: "11 structured claims extracted", durationMs: 2200 } },
  { id: "e26", elapsed: 23400, agent: "evidence",    phase: "submit",   type: "log",          message: "StorageDAO bundle stored · bafybeidxyz1ev..." },
  { id: "e27", elapsed: 23800, agent: "system",      phase: "submit",   type: "handover",     message: "Evidence → Adversarial",
    detail: "30 claims extracted across 3 projects" },

  { id: "a0",  elapsed: 24500, agent: "adversarial", phase: "discover", type: "log",          message: "Challenging 30 claims across 3 projects" },
  { id: "a1",  elapsed: 24800, agent: "adversarial", phase: "plan",     type: "log",          message: "ZKMarket — challenging 9 claims" },
  { id: "a2",  elapsed: 25100, agent: "adversarial", phase: "execute",  type: "log",          message: "claim:v1 — 47 commits confirmed via GitHub API → ✓ verified" },
  { id: "a3",  elapsed: 25500, agent: "adversarial", phase: "execute",  type: "log",          message: "claim:v2 — snarkjs found in package.json → ✓ verified" },
  { id: "a4",  elapsed: 25900, agent: "adversarial", phase: "execute",  type: "tool-call",    message: "rpc_probe",
    toolCall: { name: "rpc_probe", input: "base-sepolia · ZKMarket contract (claimed: 10,000 transactions)" } },
  { id: "a5",  elapsed: 26600, agent: "adversarial", phase: "execute",  type: "tool-done",    message: "rpc_probe",
    toolCall: { name: "rpc_probe", output: "23 transactions found — claim: 10,000", durationMs: 700 } },
  { id: "a6",  elapsed: 26900, agent: "adversarial", phase: "execute",  type: "log",          message: "claim:f1 [vague-metric] — claimed 10,000 txs · found 23 onchain → ✗ flagged" },
  { id: "a7",  elapsed: 27300, agent: "adversarial", phase: "execute",  type: "tool-call",    message: "http_probe",
    toolCall: { name: "http_probe", input: "demo.zkmarket.xyz — claimed live demo" } },
  { id: "a8",  elapsed: 27900, agent: "adversarial", phase: "execute",  type: "tool-done",    message: "http_probe",
    toolCall: { name: "http_probe", output: "404 Not Found", durationMs: 600 } },
  { id: "a9",  elapsed: 28200, agent: "adversarial", phase: "execute",  type: "log",          message: "claim:f4 [dead-link] — demo.zkmarket.xyz → 404 → ✗ flagged" },
  { id: "a10", elapsed: 28600, agent: "adversarial", phase: "verify",   type: "log",          message: "ZKMarket — ✓ 5 verified · ✗ 4 flagged · confidence 56%" },
  { id: "a11", elapsed: 29000, agent: "adversarial", phase: "submit",   type: "log",          message: "ZKMarket log EIP-191 signed · bafybeidxyz3adv..." },
  { id: "a12", elapsed: 29400, agent: "adversarial", phase: "plan",     type: "log",          message: "DataBridge — challenging 10 claims" },
  { id: "a13", elapsed: 29800, agent: "adversarial", phase: "execute",  type: "tool-call",    message: "http_probe",
    toolCall: { name: "http_probe", input: "api.databridge.xyz/events?chain=base — claimed: 1M+ events/day" } },
  { id: "a14", elapsed: 30400, agent: "adversarial", phase: "execute",  type: "tool-done",    message: "http_probe",
    toolCall: { name: "http_probe", output: "200 OK · 2,341 total events (not 1M+/day)", durationMs: 600 } },
  { id: "a15", elapsed: 30700, agent: "adversarial", phase: "execute",  type: "log",          message: "claim:f1 [vague-metric] — 1M+/day unsubstantiated · found 2,341 total → ✗ flagged" },
  { id: "a16", elapsed: 31100, agent: "adversarial", phase: "verify",   type: "log",          message: "DataBridge — ✓ 7 verified · ✗ 2 flagged · confidence 72%" },
  { id: "a17", elapsed: 31500, agent: "adversarial", phase: "submit",   type: "log",          message: "DataBridge log EIP-191 signed · bafybeidxyz2adv..." },
  { id: "a18", elapsed: 31900, agent: "adversarial", phase: "plan",     type: "log",          message: "StorageDAO — challenging 11 claims" },
  { id: "a19", elapsed: 32200, agent: "adversarial", phase: "execute",  type: "tool-call",    message: "rpc_probe",
    toolCall: { name: "rpc_probe", input: "base-sepolia:0xabc123 — claimed: 500 DAO members" } },
  { id: "a20", elapsed: 32800, agent: "adversarial", phase: "execute",  type: "tool-done",    message: "rpc_probe",
    toolCall: { name: "rpc_probe", output: "12 unique voter addresses — claim: 500 members", durationMs: 600 } },
  { id: "a21", elapsed: 33100, agent: "adversarial", phase: "execute",  type: "log",          message: "claim:f1 [vague-metric] — 500 members unverifiable · 12 onchain voters → ✗ flagged" },
  { id: "a22", elapsed: 33700, agent: "adversarial", phase: "verify",   type: "log",          message: "StorageDAO — ✓ 9 verified · ✗ 1 flagged · confidence 81%" },
  { id: "a23", elapsed: 34100, agent: "adversarial", phase: "submit",   type: "log",          message: "StorageDAO log EIP-191 signed · bafybeidxyz1adv..." },
  { id: "a24", elapsed: 34500, agent: "system",      phase: "submit",   type: "handover",     message: "Adversarial → Synthesis",
    detail: "21 verified · 7 flagged · 1 unresolved" },

  { id: "sy0", elapsed: 35200, agent: "synthesis",   phase: "discover", type: "log",          message: "Assembling hypercert payloads for 3 projects" },
  { id: "sy1", elapsed: 35600, agent: "synthesis",   phase: "plan",     type: "log",          message: "ZKMarket — building payload" },
  { id: "sy2", elapsed: 35900, agent: "synthesis",   phase: "execute",  type: "tool-call",    message: "llm:evaluator_summary",
    toolCall: { name: "llm:evaluator_summary", input: "ZKMarket evidence + adversarial log (GPT-4o)" } },
  { id: "sy3", elapsed: 38100, agent: "synthesis",   phase: "execute",  type: "tool-done",    message: "llm:evaluator_summary",
    toolCall: { name: "llm:evaluator_summary", output: "Summary generated · 127 words", durationMs: 2200 } },
  { id: "sy4", elapsed: 38500, agent: "synthesis",   phase: "submit",   type: "log",          message: "ZKMarket payload stored · bafybeidxyz3hyp..." },
  { id: "sy5", elapsed: 38900, agent: "synthesis",   phase: "submit",   type: "log",          message: "ZKMarket published to ATProto · rkey=3mi3m7rvz2g2y" },
  { id: "sy6", elapsed: 39300, agent: "synthesis",   phase: "submit",   type: "project-complete", message: "ZKMarket complete", projectId: "zkmarket" },
  { id: "sy7", elapsed: 39700, agent: "synthesis",   phase: "plan",     type: "log",          message: "DataBridge — building payload" },
  { id: "sy8", elapsed: 40000, agent: "synthesis",   phase: "execute",  type: "tool-call",    message: "llm:evaluator_summary",
    toolCall: { name: "llm:evaluator_summary", input: "DataBridge evidence + adversarial log (GPT-4o)" } },
  { id: "sy9", elapsed: 42200, agent: "synthesis",   phase: "execute",  type: "tool-done",    message: "llm:evaluator_summary",
    toolCall: { name: "llm:evaluator_summary", output: "Summary generated · 134 words", durationMs: 2200 } },
  { id: "sy10",elapsed: 42600, agent: "synthesis",   phase: "submit",   type: "log",          message: "DataBridge published to ATProto · rkey=3mi3m8bbb222" },
  { id: "sy11",elapsed: 43000, agent: "synthesis",   phase: "submit",   type: "project-complete", message: "DataBridge complete", projectId: "databridge" },
  { id: "sy12",elapsed: 43400, agent: "synthesis",   phase: "plan",     type: "log",          message: "StorageDAO — building payload" },
  { id: "sy13",elapsed: 43700, agent: "synthesis",   phase: "execute",  type: "tool-call",    message: "llm:evaluator_summary",
    toolCall: { name: "llm:evaluator_summary", input: "StorageDAO evidence + adversarial log (GPT-4o)" } },
  { id: "sy14",elapsed: 46100, agent: "synthesis",   phase: "execute",  type: "tool-done",    message: "llm:evaluator_summary",
    toolCall: { name: "llm:evaluator_summary", output: "Summary generated · 141 words", durationMs: 2400 } },
  { id: "sy15",elapsed: 46500, agent: "synthesis",   phase: "submit",   type: "log",          message: "StorageDAO published to ATProto · rkey=3mi3m8aaa111" },
  { id: "sy16",elapsed: 46900, agent: "synthesis",   phase: "submit",   type: "project-complete", message: "StorageDAO complete", projectId: "storagedao" },
  { id: "sy17",elapsed: 47300, agent: "system",      phase: "submit",   type: "log",          message: "Pipeline complete · 3/3 hypercerts published · all artifacts stored on Storacha" },
];

// ── Meta ───────────────────────────────────────────────────────────────────

const STAGE_META = [
  { step: "01", name: "Scout",       tag: "discover",  agent: "scout"       as Agent },
  { step: "02", name: "Evidence",    tag: "collect",   agent: "evidence"    as Agent },
  { step: "03", name: "Adversarial", tag: "challenge", agent: "adversarial" as Agent },
  { step: "04", name: "Synthesis",   tag: "publish",   agent: "synthesis"   as Agent },
];

const STAGE_AGENTS: Agent[] = ["scout", "evidence", "adversarial", "synthesis"];

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [status, setStatus]           = useState<"idle" | "running" | "done">("idle");
  const [events, setEvents]           = useState<PipelineEvent[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs]     = useState(0);
  const [source, setSource]           = useState("Devspot Hackathon");
  const [identifier, setIdentifier]   = useState(
    "pl-genesis-frontiers-of-collaboration-hackathon.devspot.app"
  );

  // Live agent state
  const [activeAgent, setActiveAgent]   = useState<Agent | null>(null);
  const [activePhase, setActivePhase]   = useState<Phase>("discover");
  const [activeAction, setActiveAction] = useState<string>("");
  const [activeTool, setActiveTool]     = useState<string | null>(null);
  const [agentKey, setAgentKey]         = useState(0); // triggers re-animation on change

  // Handover state
  const [handover, setHandover] = useState<{
    visible: boolean; from: string; to: string; detail?: string; exiting?: boolean;
  }>({ visible: false, from: "", to: "" });

  const feedRef     = useRef<HTMLDivElement>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const triggerHandover = useCallback(
    (from: string, to: string, detail?: string) => {
      setHandover({ visible: true, from, to, detail, exiting: false });
      // Start exit animation at 2.6s, fully dismiss at 2.9s
      setTimeout(() => setHandover((h) => ({ ...h, exiting: true })), 2600);
      setTimeout(() => setHandover({ visible: false, from: "", to: "" }), 2900);
    },
    []
  );

  function startPipeline() {
    if (status === "running") return;
    setStatus("running");
    setEvents([]);
    setCompletedIds([]);
    setElapsedMs(0);
    setActiveAgent(null);
    setActiveAction("");
    setActiveTool(null);

    const startMs = Date.now();
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startMs), 250);

    const touts = EVENTS.map((ev) =>
      setTimeout(() => {
        setEvents((prev) => [...prev, ev]);

        if (ev.type === "handover") {
          const [from, to] = ev.message.split(" → ");
          triggerHandover(from ?? "", to ?? "", ev.detail);
          // Switch the active agent immediately on handover
          const newAgent = STAGE_META.find((s) => s.name === to)?.agent ?? null;
          if (newAgent) {
            setActiveAgent(newAgent);
            setAgentKey((k) => k + 1);
            setActivePhase("discover");
            setActiveAction("");
            setActiveTool(null);
          }
          return;
        }

        if (ev.agent !== "system") {
          setActiveAgent((prev) => {
            if (prev !== ev.agent) setAgentKey((k) => k + 1);
            return ev.agent;
          });
          setActivePhase(ev.phase);

          if (ev.type === "tool-call") {
            setActiveTool(ev.toolCall?.name ?? null);
            setActiveAction(`↳ ${ev.toolCall?.name ?? ev.message}`);
          } else if (ev.type === "tool-done") {
            setActiveTool(null);
            setActiveAction(`✓ ${ev.toolCall?.name} — ${ev.toolCall?.output ?? ""}`);
          } else if (ev.type === "log") {
            setActiveAction(ev.message);
          }
        }

        if (ev.type === "project-complete" && ev.projectId) {
          setCompletedIds((prev) => [...prev, ev.projectId!]);
        }

        if (ev.id === "sy17") {
          setStatus("done");
          setActiveAgent(null);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, ev.elapsed)
    );
    timeoutsRef.current = touts;
  }

  function reset() {
    timeoutsRef.current.forEach(clearTimeout);
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus("idle");
    setEvents([]);
    setCompletedIds([]);
    setElapsedMs(0);
    setActiveAgent(null);
    setActiveAction("");
    setActiveTool(null);
    setHandover({ visible: false, from: "", to: "" });
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

  const completedProjects = completedIds
    .map((id) => MOCK_PROJECTS.find((p) => p.id === id))
    .filter(Boolean) as (typeof MOCK_PROJECTS)[number][];

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
              placeholder="Paste ecosystem URL or identifier…"
            />
            {status === "idle" && (
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

      {/* ── Running / Done layout ── */}
      {status !== "idle" && (
        <div className="flex-1 flex flex-col">
          <div className="max-w-4xl mx-auto w-full px-5 sm:px-6">

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
                  {/* Header row */}
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

                  {/* Live action */}
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
              <div
                className={`mb-4 ${handover.exiting ? "animate-handover-out" : "animate-handover-in"}`}
              >
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
                    Initialising…
                  </div>
                )}

                {events.map((ev) => {
                  if (ev.type === "project-complete") return null;

                  // ── Handover row ──
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

                  const isSystem = ev.agent === "system";
                  const isToolCall = ev.type === "tool-call";
                  const isToolDone = ev.type === "tool-done";
                  const isFlagged  = ev.message.includes("→ ✗ flagged");
                  const isVerified = ev.message.includes("→ ✓ verified") || ev.message.includes("✓ verified");

                  return (
                    <div
                      key={ev.id}
                      className={`flex items-start gap-0 border-b border-[#f3f4f6] hover:bg-[#fafafa] transition-colors ${
                        isToolCall ? "bg-[#f9fafb]" : ""
                      }`}
                    >
                      {/* Timestamp */}
                      <span className="text-[#c4c8cf] px-4 py-2 shrink-0 tabular-nums w-16 pt-2.5">
                        {formatElapsed(ev.elapsed)}
                      </span>

                      {/* Agent badge */}
                      {!isSystem ? (
                        <span className="shrink-0 text-[9px] font-medium text-[#9ca3af] uppercase tracking-wide w-20 pt-2.5 leading-none">
                          {ev.agent}
                        </span>
                      ) : (
                        <span className="w-20 shrink-0" />
                      )}

                      {/* Phase */}
                      <span className="shrink-0 text-[#d1d5db] w-14 pt-2.5 hidden sm:block">
                        {ev.phase}
                      </span>

                      {/* Content */}
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
                            <span className="text-[#6b7280]">{ev.toolCall?.output}</span>
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
                    Hypercerts · {completedProjects.length} / 3
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
                          <span className="ml-auto flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-[#16a34a]" />
                            ATProto
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
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
