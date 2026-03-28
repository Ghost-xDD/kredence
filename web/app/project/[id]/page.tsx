import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "../../components/nav";
import { MOCK_PROJECTS, MOCK_AGENTS } from "../../lib/mock-data";

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  "vague-metric": "Vague metric",
  "attribution": "Attribution",
  "consistency": "Inconsistent",
  "deployment": "Not deployed",
  "overclaim": "Overclaim",
  "dead-link": "Dead link",
};

function ConfidenceRing({ value }: { value: number }) {
  const color = value >= 70 ? "#16a34a" : value >= 40 ? "#d97706" : "#dc2626";
  const bg = value >= 70 ? "#f0fdf4" : value >= 40 ? "#fffbeb" : "#fef2f2";
  return (
    <div className="flex flex-col items-center justify-center px-6 py-4 rounded-xl border border-[#e5e7eb] bg-white text-center" style={{ borderColor: color + "33" }}>
      <div className="text-[2.5rem] font-semibold tabular-nums leading-none" style={{ color }}>
        {value}%
      </div>
      <div className="text-[10px] text-[#9ca3af] mt-1.5 uppercase tracking-wider font-medium">Confidence</div>
      <div className="mt-2 w-full h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: bg }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SourceIcon({ type }: { type: string }) {
  if (type === "github") return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#374151]">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
  if (type === "website") return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[#374151]">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1C8 1 5 4 5 8s3 7 3 7M8 1c0 0 3 3 3 7s-3 7-3 7M1 8h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[#374151]">
      <rect x="1" y="4" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 4V3a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  scout: <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" /><circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" /><line x1="14" y1="14" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  evidence: <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" /><line x1="6" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="6" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  adversarial: <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M9 2L11.5 7H16.5L12.5 10.5L14 16L9 13L4 16L5.5 10.5L1.5 7H6.5L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>,
  synthesis: <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" /><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" /></svg>,
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const hypercertJson = {
    title: project.name,
    description: project.description,
    contributors: project.contributors,
    timeframeStart: project.timeframe.start,
    timeframeEnd: project.timeframe.end,
    impactCategory: project.impactCategory,
    confidenceScore: project.confidence / 100,
    verifiedClaims: project.verifiedClaims.length,
    flaggedClaims: project.flaggedClaims.length,
    openQuestions: project.openQuestions.length,
    evaluatorSummary: project.evaluatorSummary,
    storachaRefs: project.storachaCids,
    atproto: project.atproto,
    generatedAt: project.lastUpdated,
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Nav />

      {/* ── Hero ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-[#9ca3af] mb-6">
            <Link href="/explore" className="hover:text-[#0a0a0a] transition-colors">Explore</Link>
            <span>/</span>
            <span className="text-[#0a0a0a]">{project.name}</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Left: name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap mb-3">
                <h1 className="text-2xl font-semibold text-[#0a0a0a] tracking-tight">{project.name}</h1>
                <span className="text-[10px] font-mono text-[#b0b6c0] bg-[#f3f4f6] px-1.5 py-0.5 rounded leading-none">{project.ecosystem}</span>
              </div>

              <p className="text-sm text-[#6b7280] leading-relaxed mb-4 max-w-xl">{project.description}</p>

              {/* Impact categories + timeframe */}
              <div className="flex items-center gap-3 flex-wrap">
                {project.impactCategory.map((c) => (
                  <span key={c} className="text-[10px] font-mono text-[#6b7280] bg-[#f9fafb] border border-[#e5e7eb] rounded-full px-2.5 py-1">
                    {c}
                  </span>
                ))}
                <span className="text-[10px] font-mono text-[#9ca3af]">
                  {new Date(project.timeframe.start).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  {" – "}
                  {new Date(project.timeframe.end).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
              </div>
            </div>

            {/* Right: confidence + hyperscan badge */}
            <div className="flex flex-col gap-3 sm:items-end shrink-0">
              <ConfidenceRing value={project.confidence} />

              {/* Hyperscan badge */}
              <a
                href={project.atproto.hyperscanUrl}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 text-xs font-medium text-white bg-[#0a0a0a] hover:bg-[#1f2937] transition-colors rounded-lg px-3.5 py-2"
              >
                <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
                  <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
                  <rect x="11" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.4" />
                  <rect x="1" y="11" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.4" />
                  <rect x="11" y="11" width="6" height="6" rx="1.5" fill="currentColor" />
                </svg>
                View on Hyperscan
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-60">
                  <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>

              {/* ATProto URI */}
              <p className="text-[10px] font-mono text-[#c4c8cf] max-w-[200px] break-all text-right hidden sm:block">
                {project.rkey}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Evaluator verdict ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {(() => {
            const accentColor = project.confidence >= 70 ? "#16a34a" : project.confidence >= 40 ? "#d97706" : "#dc2626";
            const total = project.verified + project.flagged + project.unresolved;
            const vPct = total > 0 ? (project.verified / total) * 100 : 0;
            const fPct = total > 0 ? (project.flagged / total) * 100 : 0;
            const uPct = total > 0 ? (project.unresolved / total) * 100 : 0;
            return (
              <div
                className="rounded-xl border bg-white overflow-hidden"
                style={{ borderColor: accentColor + "33", borderLeftColor: accentColor, borderLeftWidth: 3 }}
              >
                {/* Agent header */}
                <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: accentColor + "22", backgroundColor: accentColor + "08" }}>
                  <div className="flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 18 18" fill="none" style={{ color: accentColor }}>
                      <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                      <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span className="text-[11px] font-mono font-medium" style={{ color: accentColor }}>Synthesis Agent</span>
                    <span className="text-[10px] font-mono text-[#9ca3af]">· #45 · EIP-191 signed</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#b0b6c0]">
                    {new Date(project.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>

                {/* Summary text */}
                <div className="px-5 py-5">
                  <p className="text-[0.9375rem] text-[#0a0a0a] leading-[1.65] font-normal">
                    {project.evaluatorSummary}
                  </p>
                </div>

                {/* Claim ratio bar */}
                <div className="px-5 pb-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-mono text-[#9ca3af] shrink-0">Claims</span>
                    <div className="flex-1 h-[5px] rounded-full overflow-hidden bg-[#f3f4f6] flex gap-px">
                      <div className="h-full bg-[#a3a3a3] transition-all rounded-l-full" style={{ width: `${vPct}%` }} />
                      <div className="h-full bg-[#d1d5db] transition-all" style={{ width: `${fPct}%` }} />
                      <div className="h-full bg-[#e5e7eb] transition-all rounded-r-full" style={{ width: `${uPct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-[#9ca3af] shrink-0">{total} total</span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-mono text-[#6b7280]">
                    <span>{project.verified} verified</span>
                    {project.flagged > 0 && <span className="text-[#9ca3af]">{project.flagged} flagged</span>}
                    {project.unresolved > 0 && <span className="text-[#9ca3af]">{project.unresolved} unresolved</span>}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 w-full flex-1">

        {/* ── Evidence sources ── */}
        <section className="py-8 border-b border-[#e5e7eb]">
          <h2 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider mb-4">Evidence Sources</h2>
          <div className="flex flex-wrap gap-2">
            {project.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 border border-[#e5e7eb] rounded-lg px-3 py-2 bg-white hover:border-[#c8cacf] hover:shadow-sm transition-all text-sm text-[#374151] group"
              >
                <SourceIcon type={s.type} />
                <span className="text-xs font-mono text-[#6b7280]">{s.type}</span>
                <span className="text-xs text-[#0a0a0a] font-medium truncate max-w-[160px]">
                  {s.url.replace(/^https?:\/\//, "")}
                </span>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="text-[#d1d5db] group-hover:text-[#9ca3af] transition-colors shrink-0">
                  <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </div>
        </section>

        {/* ── Verified claims ── */}
        {project.verifiedClaims.length > 0 && (
          <section className="py-8 border-b border-[#e5e7eb]">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">Verified Claims</h2>
              <span className="text-[10px] font-mono text-[#16a34a] bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-2 py-0.5">{project.verifiedClaims.length}</span>
            </div>
            <div className="space-y-2">
              {project.verifiedClaims.map((claim) => (
                <div key={claim.id} className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-white">
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <span className="w-4 h-4 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0a0a0a]">{claim.text}</p>
                      {claim.evidence.map((e, i) => (
                        <p key={i} className="text-[11px] font-mono text-[#9ca3af] mt-1.5 leading-relaxed">{e}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Flagged claims ── */}
        {project.flaggedClaims.length > 0 && (
          <section className="py-8 border-b border-[#e5e7eb]">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">Flagged Claims</h2>
              <span className="text-[10px] font-mono text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-full px-2 py-0.5">{project.flaggedClaims.length}</span>
            </div>
            <div className="space-y-2">
              {project.flaggedClaims.map((claim) => (
                <div key={claim.id} className="border border-[#fee2e2] rounded-xl overflow-hidden bg-white">
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <span className="w-4 h-4 rounded-full bg-[#fef2f2] border border-[#fecaca] flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap mb-1.5">
                        <p className="text-sm text-[#0a0a0a]">{claim.text}</p>
                        <span className="text-[9px] font-mono text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                          {CHALLENGE_TYPE_LABELS[claim.challengeType] ?? claim.challengeType}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6b7280] leading-relaxed border-l-2 border-[#fecaca] pl-2.5">{claim.objection}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Unresolved ── */}
        {project.openQuestions.length > 0 && (
          <section className="py-8 border-b border-[#e5e7eb]">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">Unresolved</h2>
              <span className="text-[10px] font-mono text-[#d97706] bg-[#fffbeb] border border-[#fde68a] rounded-full px-2 py-0.5">{project.openQuestions.length}</span>
            </div>
            <div className="space-y-2">
              {project.openQuestions.map((q) => (
                <div key={q.id} className="border border-[#fde68a] rounded-xl bg-white px-4 py-3.5 flex items-start gap-3">
                  <span className="w-4 h-4 rounded-full bg-[#fffbeb] border border-[#fde68a] flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M5 2v4M5 8v.5" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </span>
                  <div>
                    <p className="text-sm text-[#0a0a0a] mb-1">{q.text}</p>
                    <p className="text-[11px] text-[#6b7280] leading-relaxed">{q.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Agent receipts ── */}
        <section className="py-8 border-b border-[#e5e7eb]">
          <h2 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider mb-4">Agent Receipts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MOCK_AGENTS.map((agent) => (
              <Link
                key={agent.slug}
                href={`/agents/${agent.slug}`}
                className="group border border-[#e5e7eb] rounded-xl px-4 py-4 bg-white hover:border-[#c8cacf] hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#f3f4f6] flex items-center justify-center text-[#374151] shrink-0 group-hover:bg-[#e5e7eb] transition-colors">
                    {AGENT_ICONS[agent.slug]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-[#0a0a0a]">{agent.name}</span>
                      <span className="text-[9px] font-mono text-[#9ca3af]">{agent.tag}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#9ca3af] w-16 shrink-0">Agent ID</span>
                        <span className="text-[10px] font-mono text-[#374151]">#{agent.agentId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#9ca3af] w-16 shrink-0">Storacha</span>
                        <span className="text-[10px] font-mono text-[#374151] truncate">bafybeid…{agent.agentId}out</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-[#9ca3af] w-16 shrink-0">Signed</span>
                        <span className="text-[10px] font-mono text-[#16a34a]">EIP-191 ✓</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Storacha CIDs ── */}
        <section className="py-8 border-b border-[#e5e7eb]">
          <h2 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider mb-4">Storacha References</h2>
          <div className="space-y-2">
            {[
              { label: "Evidence Bundle", cid: project.storachaCids.evidence },
              { label: "Adversarial Log", cid: project.storachaCids.adversarial },
              { label: "Hypercert Payload", cid: project.storachaCids.hypercert },
            ].map((ref) => (
              <div key={ref.label} className="flex items-center gap-3 border border-[#e5e7eb] rounded-xl px-4 py-3 bg-white">
                <span className="text-xs text-[#6b7280] w-36 shrink-0">{ref.label}</span>
                <span className="text-[11px] font-mono text-[#374151] truncate flex-1">{ref.cid}</span>
                <a
                  href={`https://storacha.network/files/${ref.cid}`}
                  target="_blank"
                  rel="noopener"
                  className="text-[10px] font-mono text-[#9ca3af] hover:text-[#0a0a0a] transition-colors shrink-0"
                >
                  retrieve ↗
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* ── Hypercert JSON ── */}
        <section className="py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">Hypercert Payload</h2>
            <a
              href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(hypercertJson, null, 2))}`}
              download={`${project.id}-hypercert.json`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6b7280] hover:text-[#0a0a0a] border border-[#e5e7eb] hover:border-[#c8cacf] rounded-lg px-3 py-1.5 transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v7M6 8L3.5 5.5M6 8L8.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M1 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Download JSON
            </a>
          </div>
          <div className="border border-[#e5e7eb] rounded-xl overflow-hidden bg-[#f9fafb]">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e5e7eb] bg-white">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f3f4f6] border border-[#e5e7eb]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#f3f4f6] border border-[#e5e7eb]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#f3f4f6] border border-[#e5e7eb]" />
              </div>
              <span className="text-[10px] font-mono text-[#9ca3af] ml-1">{project.id}-hypercert.json</span>
            </div>
            <pre className="text-[11px] font-mono text-[#374151] p-4 overflow-x-auto leading-relaxed max-h-80 overflow-y-auto">
              {JSON.stringify(hypercertJson, null, 2)}
            </pre>
          </div>
        </section>

      </div>

      <footer className="border-t border-[#e5e7eb] mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
          <span className="text-xs text-[#6b7280]">
            Built for{" "}
            <a href="https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app" target="_blank" rel="noopener" className="hover:text-[#0a0a0a] transition-colors">PL Genesis</a>
            {" · "}Powered by{" "}
            <a href="https://docs.hypercerts.org" target="_blank" rel="noopener" className="hover:text-[#0a0a0a] transition-colors">Hypercerts</a>
            {" · "}
            <a href="https://storacha.network" target="_blank" rel="noopener" className="hover:text-[#0a0a0a] transition-colors">Storacha</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
