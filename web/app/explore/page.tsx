import Link from "next/link";
import { Nav } from "../components/nav";
import { MOCK_PROJECTS } from "../lib/mock-data";

const STATS = [
  { value: "178", label: "Projects evaluated" },
  { value: "1,602", label: "Claims extracted" },
  { value: "341", label: "Claims flagged" },
  { value: "178", label: "Hypercerts published" },
];

const CATEGORIES = ["All", "infrastructure", "dao-tooling", "privacy", "developer-tools", "nft", "social", "data"];

function ConfidenceDot({ value }: { value: number }) {
  const color = value >= 70 ? "#16a34a" : value >= 40 ? "#d97706" : "#dc2626";
  return <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: color }} />;
}

export default function ExplorePage() {
  const sorted = [...MOCK_PROJECTS].sort((a, b) => b.confidence - a.confidence);

  // Confidence distribution buckets
  const high = MOCK_PROJECTS.filter((p) => p.confidence >= 70).length;
  const mid = MOCK_PROJECTS.filter((p) => p.confidence >= 40 && p.confidence < 70).length;
  const low = MOCK_PROJECTS.filter((p) => p.confidence < 40).length;

  // Most common flag types across all projects
  const flagTypeCount: Record<string, number> = {};
  MOCK_PROJECTS.forEach((p) => {
    p.flaggedClaims.forEach((f) => {
      flagTypeCount[f.challengeType] = (flagTypeCount[f.challengeType] ?? 0) + 1;
    });
  });
  const topFlags = Object.entries(flagTypeCount).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      {/* ── Header ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
          <h1 className="text-xl font-semibold text-[#0a0a0a] tracking-tight mb-1">Explore</h1>
          <p className="text-sm text-[#6b7280]">Browse all evaluated projects across every ecosystem run.</p>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 border border-[#e5e7eb] rounded-2xl overflow-hidden bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)] divide-x divide-y sm:divide-y-0 divide-[#e5e7eb]">
            {STATS.map((s) => (
              <div key={s.label} className="px-4 py-5 text-center">
                <div className="text-2xl font-semibold text-[#0a0a0a] tabular-nums">{s.value}</div>
                <div className="text-[11px] text-[#9ca3af] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Summary strips ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Confidence distribution */}
          <div>
            <h2 className="text-xs font-semibold text-[#0a0a0a] mb-4">Confidence distribution</h2>
            <div className="space-y-2.5">
              {[
                { label: "High (≥70%)", count: high, color: "#16a34a" },
                { label: "Medium (40–69%)", count: mid, color: "#d97706" },
                { label: "Low (<40%)", count: low, color: "#dc2626" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-xs text-[#6b7280] w-32 shrink-0">{b.label}</span>
                  <div className="flex-1 h-[5px] rounded-full bg-[#f3f4f6] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(b.count / MOCK_PROJECTS.length) * 100}%`, backgroundColor: b.color }}
                    />
                  </div>
                  <span className="text-xs font-mono text-[#9ca3af] w-4 text-right">{b.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Most flagged types */}
          <div>
            <h2 className="text-xs font-semibold text-[#0a0a0a] mb-4">Most common flag types</h2>
            <div className="space-y-2">
              {topFlags.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[#6b7280]">{type}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-[3px] rounded-full bg-[#f3f4f6] overflow-hidden">
                      <div className="h-full rounded-full bg-[#dc2626]" style={{ width: `${(count / 10) * 100}%` }} />
                    </div>
                    <span className="text-[11px] font-mono text-[#9ca3af] tabular-nums">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Filter row ── */}
      <section className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider shrink-0 mr-1">Filter</span>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`text-xs px-2.5 py-1 rounded-full border shrink-0 transition-colors ${
                c === "All"
                  ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                  : "bg-white text-[#374151] border-[#e5e7eb] hover:border-[#d1d5db]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* ── Project grid ── */}
      <section className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sorted.map((p) => {
              const barColor = p.confidence >= 70 ? "#16a34a" : p.confidence >= 40 ? "#d97706" : "#dc2626";
              return (
                <Link
                  key={p.id}
                  href={`/project/${p.id}`}
                  className="group border border-[#e5e7eb] rounded-xl p-5 hover:border-[#c8cacf] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all bg-white flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#0a0a0a]">{p.name}</span>
                      <span className="text-[10px] font-mono text-[#b0b6c0] bg-[#f3f4f6] px-1.5 py-0.5 rounded leading-none">
                        {p.ecosystem}
                      </span>
                    </div>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-[#d1d5db] group-hover:text-[#9ca3af] transition-colors shrink-0 mt-0.5">
                      <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <p className="text-xs text-[#6b7280] leading-relaxed mb-4 line-clamp-2">{p.description}</p>

                  {/* Categories */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {p.impactCategory.map((c) => (
                      <span key={c} className="text-[10px] font-mono text-[#9ca3af] bg-[#f9fafb] border border-[#f3f4f6] rounded px-1.5 py-0.5">
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Confidence + stats */}
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-[3px] rounded-full bg-[#f3f4f6] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.confidence}%`, backgroundColor: barColor }} />
                      </div>
                      <span className="text-xs tabular-nums font-medium shrink-0" style={{ color: barColor }}>{p.confidence}%</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-[#16a34a]">✓ {p.verified}</span>
                      {p.flagged > 0 && <span className="text-[#dc2626]">✗ {p.flagged}</span>}
                      {p.unresolved > 0 && <span className="text-[#d97706]">⚠ {p.unresolved}</span>}
                      <span className="ml-auto text-[#c4c8cf]">{p.contributors.length} contributors</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
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
