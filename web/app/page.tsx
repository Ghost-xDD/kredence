import Link from "next/link";
import { Nav } from "./components/nav";

const PIPELINE_STEPS = [
  {
    step: "01",
    tag: "discover",
    name: "Scout",
    description:
      "Crawls hackathons, grant programs, and manual lists. Discovers every submitted project and deduplicates across sources.",
    detail: "178 projects · Devspot, Filecoin Dev Grants",
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
    detail: "1,602 claims · GitHub + web + onchain",
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
    detail: "341 flagged · EIP-191 signed logs",
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
    detail: "178 hypercerts · ATProto + Storacha",
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

const RECENT = [
  {
    name: "ZKMarket",
    ecosystem: "PL Genesis",
    confidence: 56,
    verified: 5,
    flagged: 4,
    unresolved: 0,
    contributors: 2,
    hyperscan: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m7rvz2g2y",
    rkey: "3mi3m7rvz2g2y",
  },
  {
    name: "YayNay.wtf",
    ecosystem: "PL Genesis",
    confidence: 50,
    verified: 4,
    flagged: 4,
    unresolved: 0,
    contributors: 3,
    hyperscan: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m7tczmt2r",
    rkey: "3mi3m7tczmt2r",
  },
  {
    name: "Safenote",
    ecosystem: "PL Genesis",
    confidence: 56,
    verified: 4,
    flagged: 0,
    unresolved: 5,
    contributors: 3,
    hyperscan: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m7tjxcl2r",
    rkey: "3mi3m7tjxcl2r",
  },
];

const STATS = [
  { value: "178", label: "Projects evaluated" },
  { value: "1,602", label: "Claims extracted" },
  { value: "341", label: "Claims flagged" },
  { value: "178", label: "Hypercerts published" },
];



export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Dot grid background */}
        <div className="dot-grid absolute inset-0 pointer-events-none" aria-hidden />

        <div className="relative max-w-4xl mx-auto w-full px-6 pt-28 pb-24 text-center">
          {/* Headline */}
          <h1 className="text-[4.5rem] font-semibold tracking-[-0.03em] text-[#0a0a0a] leading-[1.05] mb-6">
            Evaluate Impact.<br />
            <span className="text-[#c8cacf]">Autonomously.</span>
          </h1>

          <p className="text-[#6b7280] text-[0.9375rem] max-w-sm mx-auto mb-10 leading-relaxed">
            Four autonomous agents that collect evidence, challenge claims, and
            publish verifiable hypercerts for any project ecosystem.
          </p>

          {/* Input */}
          <div className="max-w-lg mx-auto mb-4">
            <div className="flex items-center border border-[#e5e7eb] rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] px-4 py-3.5 gap-3">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-[#9ca3af] shrink-0">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Paste a hackathon URL, grant page, or ecosystem link…"
                className="flex-1 text-sm outline-none text-[#0a0a0a] placeholder:text-[#9ca3af] bg-transparent"
              />
              <button className="text-xs font-medium bg-[#0a0a0a] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#1f2937] transition-colors shrink-0">
                Evaluate
              </button>
            </div>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-14">
            {["PL Genesis Hackathon", "Filecoin Dev Grants", "ETHGlobal", "Manual URL list"].map((e) => (
              <button
                key={e}
                className="text-xs px-3 py-1 rounded-full bg-white border border-[#e5e7eb] text-[#374151] hover:border-[#d1d5db] hover:shadow-sm transition-all"
              >
                {e}
              </button>
            ))}
          </div>

          {/* Stats — unified card */}
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
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 pb-14">
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
                {/* Ghost step number watermark */}
                <span
                  className="absolute right-4 bottom-2 text-[4.5rem] font-semibold text-[#f3f4f6] tabular-nums leading-none select-none pointer-events-none"
                  aria-hidden
                >
                  {s.step}
                </span>

                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[10px] font-mono text-[#9ca3af]">{s.step}</span>
                  <div className="w-8 h-8 rounded-lg bg-[#f3f4f6] flex items-center justify-center text-[#374151] group-hover:bg-[#e5e7eb] transition-colors">
                    {s.icon}
                  </div>
                </div>

                {/* Title */}
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-[#0a0a0a]">{s.name}</span>
                  <span className="text-[10px] font-mono text-[#9ca3af]">{s.tag}</span>
                </div>

                {/* Description */}
                <p className="text-xs text-[#6b7280] leading-relaxed mb-4 relative">{s.description}</p>

                {/* Detail chip */}
                <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#9ca3af] bg-[#f9fafb] rounded-md px-2 py-1 border border-[#f3f4f6] relative">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d1d5db] shrink-0" />
                  {s.detail}
                </div>
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
              <p className="text-xs text-[#9ca3af] mt-0.5">Live on the ATProto Hypercerts network</p>
            </div>
            <a
              href="https://www.hyperscan.dev/agents/feed"
              target="_blank"
              rel="noopener"
              className="text-xs text-[#6b7280] hover:text-[#0a0a0a] transition-colors"
            >
              Explore on Hyperscan →
            </a>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_64px_64px_140px_20px] px-5 py-2.5 bg-[#f9fafb] border-b border-[#e5e7eb]">
              <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider">Project</span>
              <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider text-right">Verified</span>
              <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider text-right">Flagged</span>
              <span className="text-[10px] font-medium text-[#9ca3af] uppercase tracking-wider pl-4">Confidence</span>
              <span />
            </div>

            {RECENT.map((h, i) => {
              const barColor = h.confidence >= 70 ? "#16a34a" : h.confidence >= 40 ? "#d97706" : "#dc2626";
              return (
                <a
                  key={h.rkey}
                  href={h.hyperscan}
                  target="_blank"
                  rel="noopener"
                  className={`grid grid-cols-[1fr_64px_64px_140px_20px] items-center px-5 py-4 hover:bg-[#f9fafb] transition-colors group${i < RECENT.length - 1 ? " border-b border-[#e5e7eb]" : ""}`}
                >
                  {/* Name */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#0a0a0a]">{h.name}</span>
                      <span className="text-[10px] font-mono text-[#b0b6c0] bg-[#f3f4f6] px-1.5 py-0.5 rounded leading-none">
                        {h.ecosystem}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[#c4c8cf] mt-0.5">
                      {h.contributors} contributors
                      {h.unresolved > 0 && (
                        <span className="text-[#d97706]"> · {h.unresolved} unresolved</span>
                      )}
                    </div>
                  </div>

                  {/* Verified */}
                  <span className="text-xs font-medium text-[#16a34a] text-right tabular-nums">✓ {h.verified}</span>

                  {/* Flagged */}
                  <span className={`text-xs font-medium text-right tabular-nums ${h.flagged > 0 ? "text-[#dc2626]" : "text-[#d1d5db]"}`}>
                    {h.flagged > 0 ? `✗ ${h.flagged}` : "—"}
                  </span>

                  {/* Confidence */}
                  <div className="pl-4 flex items-center gap-2.5">
                    <div className="flex-1 h-[3px] rounded-full bg-[#f3f4f6] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${h.confidence}%`, backgroundColor: barColor }} />
                    </div>
                    <span className="text-xs tabular-nums font-medium shrink-0" style={{ color: barColor }}>{h.confidence}%</span>
                  </div>

                  {/* External link */}
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-[#d1d5db] group-hover:text-[#9ca3af] transition-colors ml-auto">
                    <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              );
            })}
          </div>

          <p className="text-[11px] text-[#b0b6c0] mt-3 font-mono text-center">
            did:plc:fke3rhssj7rdghxee2t73x73 · org.hypercerts.claim.activity
          </p>
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
            <a href="https://docs.hypercerts.org" target="_blank" rel="noopener" className="hover:text-[#0a0a0a] transition-colors">
              Hypercerts
            </a>
            {" · "}
            <a href="https://storacha.network" target="_blank" rel="noopener" className="hover:text-[#0a0a0a] transition-colors">
              Storacha
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
