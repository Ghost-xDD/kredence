import Link from "next/link";
import { Nav } from "./components/nav";
import { HeroInput } from "./components/hero-input";
import type { HypercertRegistry, RegistryEntry } from "@credence/types";

const SERVER_URL =
  process.env["NEXT_PUBLIC_SERVER_URL"] ?? "http://localhost:3001";

const PIPELINE_STEPS = [
  {
    step: "01",
    tag: "discover",
    name: "Scout",
    description:
      "Crawls hackathons, grant programs, and manual lists. Discovers every submitted project and deduplicates across sources.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <line x1="14" y1="14" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: "02",
    tag: "collect",
    name: "Evidence",
    description:
      "Pulls GitHub activity, website content, and on-chain data for every project. Extracts structured claims using GPT-4o.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <line x1="6" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: "03",
    tag: "challenge",
    name: "Adversarial",
    description:
      "Every claim is challenged. Flags unverified metrics, attribution gaps, and overclaims. Produces EIP-191 signed receipts.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2L11.5 7H16.5L12.5 10.5L14 16L9 13L4 16L5.5 10.5L1.5 7H6.5L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    step: "04",
    tag: "publish",
    name: "Synthesis",
    description:
      "Assembles the final hypercert payload and publishes it as a live ATProto record on the Hypercerts network via Storacha.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

async function getRegistry(): Promise<HypercertRegistry> {
  try {
    const res = await fetch(`${SERVER_URL}/projects`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<HypercertRegistry>;
  } catch {
    return { updatedAt: new Date().toISOString(), entries: [] };
  }
}

export default async function Home() {
  const registry = await getRegistry();
  const entries = [...registry.entries].sort(
    (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime()
  );
  const recent = entries.slice(0, 3);

  const totalVerified  = entries.reduce((s, p) => s + p.verifiedCount, 0);
  const totalFlagged   = entries.reduce((s, p) => s + p.flaggedCount, 0);
  const atprotoCount   = entries.filter((p) => p.hasAtproto).length;

  const STATS = [
    { value: String(entries.length || "—"), label: "Projects evaluated" },
    { value: totalVerified > 0 ? String(totalVerified) : "—", label: "Claims verified" },
    { value: totalFlagged > 0 ? String(totalFlagged) : "—",   label: "Claims flagged" },
    { value: atprotoCount > 0 ? String(atprotoCount) : "—",   label: "Hypercerts published" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="dot-grid absolute inset-0 pointer-events-none" aria-hidden />

        <div className="relative max-w-4xl mx-auto w-full px-6 pt-20 pb-14 sm:pt-28 sm:pb-24 text-center">
          <h1 className="text-[2.5rem] sm:text-[4.5rem] font-semibold tracking-[-0.03em] text-[#0a0a0a] leading-[1.1] sm:leading-[1.05] mb-5 sm:mb-6">
            Evaluate Impact.<br />
            <span className="text-[#c8cacf]">Autonomously.</span>
          </h1>

          <p className="text-[#6b7280] text-[0.9375rem] max-w-sm mx-auto mb-10 leading-relaxed">
            Four autonomous agents that collect evidence, challenge claims, and
            publish verifiable hypercerts for any project ecosystem.
          </p>

          <HeroInput />

          {/* Live stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#e5e7eb] rounded-2xl overflow-hidden bg-white shadow-[0_1px_6px_rgba(0,0,0,0.05)] divide-x divide-y sm:divide-y-0 divide-[#e5e7eb]">
            {STATS.map((s) => (
              <div key={s.label} className="px-4 py-5 text-center">
                <div className="text-2xl font-semibold text-[#0a0a0a] tabular-nums">{s.value}</div>
                <div className="text-[11px] text-[#9ca3af] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pipeline ──────────────────────────────────────────── */}
      <section className="border-t border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-sm font-semibold text-[#0a0a0a] flex items-center gap-2">
                The Pipeline
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#16a34a] bg-[#f0fdf4] border border-[#dcfce7] rounded-full px-2 py-0.5">
                  <span className="w-1 h-1 rounded-full bg-[#16a34a] animate-pulse" />
                  live
                </span>
              </h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">Four agents, fully autonomous</p>
            </div>
            <Link href="/agents" className="text-xs text-[#6b7280] hover:text-[#0a0a0a] transition-colors">
              View agents →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PIPELINE_STEPS.map((s) => (
              <Link
                key={s.name}
                href={`/agents/${s.name.toLowerCase()}`}
                className="group relative border border-[#e5e7eb] rounded-xl p-5 hover:border-[#c8cacf] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all bg-white overflow-hidden"
              >
                <span className="absolute right-4 bottom-2 text-[4.5rem] font-semibold text-[#f3f4f6] tabular-nums leading-none select-none pointer-events-none" aria-hidden>
                  {s.step}
                </span>
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[10px] font-mono text-[#9ca3af]">{s.step}</span>
                  <div className="w-8 h-8 rounded-lg bg-[#f3f4f6] flex items-center justify-center text-[#374151] group-hover:bg-[#e5e7eb] transition-colors">
                    {s.icon}
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-[#0a0a0a]">{s.name}</span>
                  <span className="text-[10px] font-mono text-[#9ca3af]">{s.tag}</span>
                </div>
                <p className="text-xs text-[#6b7280] leading-relaxed mb-4 relative">{s.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recent Hypercerts ─────────────────────────────────── */}
      <section>
        <div className="max-w-4xl mx-auto px-6 py-14">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-[#0a0a0a] flex items-center gap-2">
                Recent Hypercerts
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" />
              </h2>
              <p className="text-xs text-[#9ca3af] mt-0.5">
                {entries.length > 0 ? `${entries.length} project${entries.length === 1 ? "" : "s"} evaluated` : "No evaluations yet"}
              </p>
            </div>
            <Link href="/explore" className="hidden sm:block text-xs text-[#6b7280] hover:text-[#0a0a0a] transition-colors shrink-0">
              Explore all →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-6 py-12 text-center">
              <p className="text-sm font-medium text-[#0a0a0a] mb-1.5">No evaluations yet</p>
              <p className="text-xs text-[#9ca3af] mb-5 max-w-xs mx-auto leading-relaxed">
                Run the pipeline to evaluate a project ecosystem. Results appear here automatically.
              </p>
              <Link href="/pipeline" className="text-xs font-medium bg-[#0a0a0a] text-white px-4 py-2 rounded-lg hover:bg-[#1f2937] transition-colors">
                Run pipeline →
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_16px] sm:grid-cols-[1fr_64px_64px_140px_16px] px-4 sm:px-5 py-2.5 bg-[#f9fafb] border-b border-[#e5e7eb]">
                <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">Project</span>
                <span className="hidden sm:block text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider text-right">Verified</span>
                <span className="hidden sm:block text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider text-right">Flagged</span>
                <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider sm:pl-4">Confidence</span>
                <span />
              </div>

              {recent.map((h, i) => <RecentRow key={h.slug} h={h} isLast={i === recent.length - 1} />)}
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-[#e5e7eb] mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
          <span className="text-xs text-[#6b7280]">
            Built for{" "}
            <a href="https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app" target="_blank" rel="noopener" className="hover:text-[#0a0a0a] transition-colors">
              PL Genesis
            </a>
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

function RecentRow({ h, isLast }: { h: RegistryEntry; isLast: boolean }) {
  const pct      = Math.round(h.confidenceScore * 100);
  const barColor = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";

  return (
    <Link
      href={`/project/${h.slug}`}
      className={`grid grid-cols-[1fr_120px_16px] sm:grid-cols-[1fr_64px_64px_140px_16px] items-center px-4 sm:px-5 py-4 hover:bg-[#f9fafb] transition-colors group${!isLast ? " border-b border-[#e5e7eb]" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#0a0a0a] truncate">{h.title}</span>
        </div>
        <div className="text-[11px] font-mono text-[#c4c8cf] mt-0.5">
          {h.contributors.length} contributor{h.contributors.length !== 1 ? "s" : ""}
          {h.unresolvedCount > 0 && <span className="text-[#d97706]"> · {h.unresolvedCount} unresolved</span>}
          {h.hasAtproto && <span className="text-[#9ca3af]"> · ATProto</span>}
        </div>
      </div>

      <span className="hidden sm:block text-xs font-medium text-[#16a34a] text-right tabular-nums">✓ {h.verifiedCount}</span>
      <span className={`hidden sm:block text-xs font-medium text-right tabular-nums ${h.flaggedCount > 0 ? "text-[#dc2626]" : "text-[#d1d5db]"}`}>
        {h.flaggedCount > 0 ? `✗ ${h.flaggedCount}` : "—"}
      </span>

      <div className="flex items-center gap-2 sm:gap-2.5 sm:pl-4">
        <div className="flex-1 h-[3px] rounded-full bg-[#f3f4f6] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        <span className="text-xs tabular-nums font-medium shrink-0" style={{ color: barColor }}>{pct}%</span>
      </div>

      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-[#d1d5db] group-hover:text-[#9ca3af] transition-colors ml-auto">
        <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
