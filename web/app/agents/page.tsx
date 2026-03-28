import Link from "next/link";
import { Nav } from "../components/nav";
import { MOCK_AGENTS } from "../lib/mock-data";

const ICONS: Record<string, React.ReactNode> = {
  scout: (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="14" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  evidence: (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
      <rect x="3" y="2" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="6" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  adversarial: (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
      <path d="M9 2L11.5 7H16.5L12.5 10.5L14 16L9 13L4 16L5.5 10.5L1.5 7H6.5L9 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  synthesis: (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
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

export default function AgentsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />

      {/* ── Header ── */}
      <section className="border-b border-[#e5e7eb]">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-[#0a0a0a] tracking-tight mb-1">Agents</h1>
              <p className="text-sm text-[#6b7280] max-w-md">
                Four autonomous agents with verifiable ERC-8004 on-chain identities. Each agent signs its outputs and stores all artifacts on Storacha.
              </p>
            </div>
            <a
              href="https://github.com/erc-8004/erc-8004-contracts"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 text-xs text-[#6b7280] hover:text-[#0a0a0a] border border-[#e5e7eb] hover:border-[#c8cacf] rounded-lg px-3 py-2 transition-all shrink-0"
            >
              ERC-8004 spec
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="opacity-50">
                <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>

          {/* Shared registry info */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Identity Registry", value: "0x8004A818…BD9e", sub: "Base Sepolia", href: "https://basescan.org/address/0x8004A818BFB912233c491871b3d84c89A494BD9e" },
              { label: "Reputation Registry", value: "0x8004BAa1…b63", sub: "Base Sepolia", href: "https://basescan.org/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" },
              { label: "Operator Wallet", value: "0xd8dA6BF2…6045", sub: "All chains", href: "https://basescan.org/address/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener"
                className="group flex items-start justify-between border border-[#e5e7eb] rounded-xl px-4 py-3.5 bg-white hover:border-[#c8cacf] hover:shadow-sm transition-all"
              >
                <div>
                  <div className="text-[10px] text-[#9ca3af] mb-1 uppercase tracking-wider font-medium">{item.label}</div>
                  <div className="text-xs font-mono text-[#0a0a0a]">{item.value}</div>
                  <div className="text-[10px] font-mono text-[#b0b6c0] mt-0.5">{item.sub}</div>
                </div>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#d1d5db] group-hover:text-[#9ca3af] transition-colors mt-1 shrink-0">
                  <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pipeline flow indicator ── */}
      <section className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-0 overflow-x-auto">
            {MOCK_AGENTS.map((agent, i) => (
              <div key={agent.slug} className="flex items-center shrink-0">
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-[10px] font-mono text-[#9ca3af]">{agent.step}</span>
                  <span className="text-xs font-medium text-[#374151]">{agent.name}</span>
                  <span className="text-[10px] font-mono text-[#b0b6c0]">{agent.tag}</span>
                </div>
                {i < MOCK_AGENTS.length - 1 && (
                  <span className="text-[#d1d5db] text-sm">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent cards ── */}
      <section className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-10 sm:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MOCK_AGENTS.map((agent) => (
              <Link
                key={agent.slug}
                href={`/agents/${agent.slug}`}
                className="group relative border border-[#e5e7eb] rounded-xl hover:border-[#c8cacf] hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all bg-white overflow-hidden flex flex-col"
              >
                {/* Ghost step number */}
                <span className="absolute right-4 bottom-3 text-[4.5rem] font-semibold text-[#f3f4f6] tabular-nums leading-none select-none pointer-events-none" aria-hidden>
                  {agent.step}
                </span>

                {/* Top section */}
                <div className="p-5 pb-4 relative">
                  <div className="flex items-start justify-between mb-5">
                    <span className="text-[10px] font-mono text-[#9ca3af]">{agent.step}</span>
                    <div className="w-10 h-10 rounded-xl bg-[#f3f4f6] flex items-center justify-center text-[#374151] group-hover:bg-[#e5e7eb] transition-colors">
                      {ICONS[agent.slug]}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-base font-semibold text-[#0a0a0a]">{agent.name}</span>
                    <span className="text-[10px] font-mono text-[#9ca3af]">{agent.tag}</span>
                  </div>
                  <p className="text-xs text-[#6b7280] leading-relaxed">{agent.description}</p>
                </div>

                {/* Identity strip */}
                <div className="border-t border-[#f3f4f6] px-5 py-3 bg-[#f9fafb] relative">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-sm font-semibold text-[#0a0a0a] tabular-nums">#{agent.agentId}</div>
                      <div className="text-[10px] text-[#9ca3af] mt-0.5">Agent ID</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#0a0a0a] tabular-nums">{agent.evaluations}</div>
                      <div className="text-[10px] text-[#9ca3af] mt-0.5">Runs</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#0a0a0a] tabular-nums">{msToReadable(agent.avgDurationMs)}</div>
                      <div className="text-[10px] text-[#9ca3af] mt-0.5">Avg time</div>
                    </div>
                  </div>
                </div>

                {/* Capabilities + output chip */}
                <div className="border-t border-[#f3f4f6] px-5 py-3 relative">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {agent.capabilities.slice(0, 3).map((cap) => (
                      <span key={cap} className="text-[10px] font-mono text-[#6b7280] bg-[#f3f4f6] rounded px-1.5 py-0.5">
                        {cap}
                      </span>
                    ))}
                    {agent.capabilities.length > 3 && (
                      <span className="text-[10px] font-mono text-[#9ca3af]">+{agent.capabilities.length - 3} more</span>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#9ca3af] bg-white rounded-md px-2 py-1 border border-[#e5e7eb]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] shrink-0" />
                    {agent.detail}
                  </div>
                </div>
              </Link>
            ))}
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
