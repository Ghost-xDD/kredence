import Link from "next/link";
import { Nav } from "../components/nav";
import { ExploreGrid } from "../components/explore-grid";
import type { HypercertRegistry } from "@credence/types";

const SERVER_URL =
  process.env["NEXT_PUBLIC_SERVER_URL"] ?? "http://localhost:3001";

async function getRegistry(): Promise<HypercertRegistry> {
  try {
    const res = await fetch(`${SERVER_URL}/projects`, {
      next: { revalidate: 30 }, // revalidate every 30 seconds
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<HypercertRegistry>;
  } catch {
    return { updatedAt: new Date().toISOString(), entries: [] };
  }
}

export default async function ExplorePage() {
  const registry = await getRegistry();
  const projects = [...registry.entries].sort((a, b) => b.confidenceScore - a.confidenceScore);

  const total  = projects.length;
  const high   = projects.filter((p) => p.confidenceScore >= 0.7).length;
  const mid    = projects.filter((p) => p.confidenceScore >= 0.4 && p.confidenceScore < 0.7).length;
  const low    = projects.filter((p) => p.confidenceScore < 0.4).length;
  const totalVerified = projects.reduce((s, p) => s + p.verifiedCount, 0);
  const totalFlagged  = projects.reduce((s, p) => s + p.flaggedCount, 0);
  const atprotoCount  = projects.filter((p) => p.hasAtproto).length;

  const STATS = [
    { value: String(total),        label: "Projects evaluated" },
    { value: String(totalVerified), label: "Claims verified" },
    { value: String(totalFlagged),  label: "Claims flagged" },
    { value: String(atprotoCount),  label: "Hypercerts published" },
  ];

  const isEmpty = total === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      {/* ── Header ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
          <h1 className="text-xl font-semibold text-[#0a0a0a] tracking-tight mb-1">Explore</h1>
          <p className="text-sm text-[#6b7280]">Browse all evaluated projects across every ecosystem run.</p>

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

      {/* ── Summary strips (only when there's data) ── */}
      {!isEmpty && (
        <section className="border-b border-[#e5e7eb]">
          <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                      <div className="h-full rounded-full" style={{ width: total ? `${(b.count / total) * 100}%` : "0%", backgroundColor: b.color }} />
                    </div>
                    <span className="text-xs font-mono text-[#9ca3af] w-4 text-right">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold text-[#0a0a0a] mb-4">Registry</h2>
              <div className="space-y-2">
                {[
                  { label: "Total evaluated",    val: total },
                  { label: "With ATProto record", val: atprotoCount },
                  { label: "Avg confidence",      val: total ? `${Math.round(projects.reduce((s, p) => s + p.confidenceScore, 0) / total * 100)}%` : "—" },
                  { label: "Last updated",        val: new Date(registry.updatedAt).toLocaleDateString() },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-[#6b7280]">{label}</span>
                    <span className="text-xs font-mono text-[#374151] tabular-nums">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Project grid ── */}
      <section className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
          {isEmpty ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-xl bg-[#f3f4f6] flex items-center justify-center mx-auto mb-5">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-[#9ca3af]">
                  <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M7 6l5 3-5 3V6z" fill="currentColor" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#0a0a0a] mb-1.5">No evaluations yet</p>
              <p className="text-xs text-[#9ca3af] max-w-[260px] mx-auto leading-relaxed mb-6">
                Run the pipeline to evaluate projects. Results will appear here automatically.
              </p>
              <Link href="/pipeline" className="text-xs text-white bg-[#0a0a0a] px-5 py-2.5 rounded-lg hover:bg-[#1f2937] transition-colors">
                Run pipeline →
              </Link>
            </div>
          ) : (
            <ExploreGrid projects={projects} />
          )}
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

