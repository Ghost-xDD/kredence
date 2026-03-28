import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "../../components/nav";
import { MOCK_AGENTS, MOCK_PROJECTS } from "../../lib/mock-data";

const ICONS: Record<string, React.ReactNode> = {
  scout: (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="14" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  evidence: (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  adversarial: (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <path d="M9 2L11.5 7H16.5L12.5 10.5L14 16L9 13L4 16L5.5 10.5L1.5 7H6.5L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  synthesis: (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

function msToReadable(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// Sample log entries for the agent detail page
const SAMPLE_LOG = [
  { phase: "discover", action: "agent:start", level: "info", ts: "06:00:00.000", detail: "Input received, starting pipeline" },
  { phase: "plan", action: "adapter:selected", level: "info", ts: "06:00:00.014", detail: "Adapter: devspot-hackathon" },
  { phase: "execute", action: "http:fetch", level: "info", ts: "06:00:00.231", detail: "GET projects page 1 → 200 (24 projects)" },
  { phase: "execute", action: "http:fetch", level: "info", ts: "06:00:01.482", detail: "GET projects page 2 → 200 (24 projects)" },
  { phase: "execute", action: "http:fetch", level: "info", ts: "06:00:02.741", detail: "GET projects page 3 → 200 (24 projects)" },
  { phase: "execute", action: "dedup:run", level: "info", ts: "06:00:04.011", detail: "Deduplicated 4 cross-listed projects" },
  { phase: "verify", action: "manifest:built", level: "info", ts: "06:00:04.120", detail: "ProjectManifest: 178 projects" },
  { phase: "submit", action: "storacha:upload", level: "info", ts: "06:00:04.344", detail: "Uploaded manifest → bafybeidxyz0manifest" },
  { phase: "submit", action: "agent:done", level: "info", ts: "06:00:38.200", detail: "Completed in 38.2s" },
];

export default async function AgentDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const agent = MOCK_AGENTS.find((a) => a.slug === name);
  if (!agent) notFound();

  const chainId = agent.registry.split(":")[1];
  const registryAddr = agent.registry.split(":")[2];
  const explorerUrl = `https://basescan.org/address/${registryAddr}`;

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      {/* ── Breadcrumb + header ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
          <div className="flex items-center gap-2 text-xs text-[#9ca3af] mb-6">
            <Link href="/agents" className="hover:text-[#0a0a0a] transition-colors">Agents</Link>
            <span>/</span>
            <span className="text-[#0a0a0a]">{agent.name}</span>
          </div>

          <div className="flex items-start gap-5">
            <div className="w-12 h-12 rounded-xl bg-[#f3f4f6] flex items-center justify-center text-[#374151] shrink-0">
              {ICONS[agent.slug]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl font-semibold text-[#0a0a0a] tracking-tight">{agent.name} Agent</h1>
                <span className="text-[10px] font-mono text-[#9ca3af] bg-[#f3f4f6] px-1.5 py-0.5 rounded">{agent.tag}</span>
              </div>
              <p className="text-sm text-[#6b7280]">{agent.description}</p>
            </div>
          </div>

          {/* Identity grid */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <a href={explorerUrl} target="_blank" rel="noopener" className="group border border-[#e5e7eb] rounded-xl px-4 py-3 bg-white hover:border-[#c8cacf] transition-colors">
              <div className="text-[10px] text-[#9ca3af] mb-1 uppercase tracking-wider font-medium">Agent ID (ERC-8004)</div>
              <div className="text-xs font-mono text-[#374151] group-hover:text-[#0a0a0a] transition-colors">#{agent.agentId} on chain {chainId}</div>
            </a>
            <div className="border border-[#e5e7eb] rounded-xl px-4 py-3 bg-white">
              <div className="text-[10px] text-[#9ca3af] mb-1 uppercase tracking-wider font-medium">Operator Wallet</div>
              <div className="text-xs font-mono text-[#374151] truncate">{agent.operatorWallet}</div>
            </div>
            <div className="border border-[#e5e7eb] rounded-xl px-4 py-3 bg-white">
              <div className="text-[10px] text-[#9ca3af] mb-1 uppercase tracking-wider font-medium">Registry</div>
              <div className="text-xs font-mono text-[#374151] truncate">{agent.registry}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats + capabilities ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* Stats */}
          <div>
            <h2 className="text-xs font-semibold text-[#0a0a0a] mb-4">Performance</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: String(agent.evaluations), l: "Pipeline runs" },
                { v: msToReadable(agent.avgDurationMs), l: "Avg runtime" },
                { v: agent.lastActive, l: "Last active" },
              ].map((s) => (
                <div key={s.l} className="border border-[#e5e7eb] rounded-xl px-3 py-3 bg-white text-center">
                  <div className="text-base font-semibold text-[#0a0a0a] tabular-nums">{s.v}</div>
                  <div className="text-[10px] text-[#9ca3af] mt-0.5">{s.l}</div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-[#6b7280] leading-relaxed border border-[#e5e7eb] rounded-xl px-4 py-3 bg-[#f9fafb]">
              {agent.outputSummary}
            </p>
          </div>

          {/* Capabilities */}
          <div>
            <h2 className="text-xs font-semibold text-[#0a0a0a] mb-4">Capabilities</h2>
            <div className="space-y-2">
              {agent.capabilities.map((cap) => (
                <div key={cap} className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] shrink-0" />
                  <span className="text-xs text-[#374151]">{cap}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent evaluations ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h2 className="text-xs font-semibold text-[#0a0a0a] mb-4">Recent evaluations</h2>
          <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
            {MOCK_PROJECTS.slice(0, 4).map((p, i) => (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#f9fafb] transition-colors group${i < 3 ? " border-b border-[#e5e7eb]" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[#0a0a0a]">{p.name}</span>
                  <span className="ml-2 text-[10px] font-mono text-[#b0b6c0] bg-[#f3f4f6] px-1.5 py-0.5 rounded">{p.ecosystem}</span>
                </div>
                <span className="text-[11px] font-mono text-[#9ca3af] shrink-0">{new Date(p.lastUpdated).toLocaleDateString()}</span>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-[#d1d5db] group-hover:text-[#9ca3af] transition-colors shrink-0">
                  <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sample log ── */}
      <section className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h2 className="text-xs font-semibold text-[#0a0a0a] mb-4">Execution log <span className="font-mono font-normal text-[#9ca3af]">— run-001</span></h2>
          <div className="rounded-xl border border-[#e5e7eb] overflow-hidden bg-white">
            {SAMPLE_LOG.map((entry, i) => (
              <div key={i} className={`grid grid-cols-[56px_80px_1fr] gap-3 px-4 py-2.5 text-[11px] font-mono${i < SAMPLE_LOG.length - 1 ? " border-b border-[#f3f4f6]" : ""}`}>
                <span className="text-[#c4c8cf]">{entry.ts}</span>
                <span className={`${
                  entry.phase === "execute" ? "text-[#374151]" :
                  entry.phase === "submit" ? "text-[#16a34a]" :
                  "text-[#9ca3af]"
                }`}>{entry.phase}</span>
                <span className="text-[#6b7280]">{entry.detail}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#c4c8cf] mt-2 font-mono">
            Full log stored at Storacha · bafybeidxyz0agentlog{agent.agentId}
          </p>
        </div>
      </section>

      <footer className="border-t border-[#e5e7eb] mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
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
