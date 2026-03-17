import Link from "next/link";

const VERDICTS = [
  {
    label: "Strong",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
    score: "94",
    project: "ETHGlobal Finalist — ZK Identity Bridge",
    summary: "All 4 claims verified against live deployments on Base Sepolia.",
  },
  {
    label: "Credible",
    color: "text-sky-400",
    dot: "bg-sky-400",
    score: "71",
    project: "Gitcoin Grant Final Report — RegenDAO",
    summary: "Strong GitHub activity. Milestone PDF partially verified.",
  },
  {
    label: "Partial",
    color: "text-amber-400",
    dot: "bg-amber-400",
    score: "52",
    project: "OSS Tooling — hyperscan-cli",
    summary: "Core claims credible. User count overclaimed — no analytics link.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold tracking-tight text-lg">Credence</span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-zinc-400">
          <Link href="/evaluate" className="hover:text-zinc-100 transition-colors">
            New Evaluation
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-100 transition-colors"
          >
            GitHub
          </a>
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="px-6 pt-24 pb-20 max-w-4xl mx-auto w-full text-center">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 border border-emerald-400/30 rounded-full px-3 py-1 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            ERC-8004 · Hypercerts · Storacha · Lit Protocol
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-balance leading-tight mb-6">
            Evidence-backed
            <br />
            <span className="text-emerald-400">impact evaluation</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10 text-balance">
            Submit a GitHub repo, grant report, or demo URL. Four specialised AI
            agents analyse the evidence, verify claims, and produce a
            Hypercert-ready record — with every step logged on-chain.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/evaluate"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-6 py-3 transition-colors"
            >
              Start Evaluation
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M2 8a.75.75 0 0 1 .75-.75h8.69L9.22 5.03a.75.75 0 1 1 1.06-1.06l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 1 1-1.06-1.06l2.22-2.22H2.75A.75.75 0 0 1 2 8Z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
            <a
              href="#examples"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-medium px-6 py-3 transition-colors"
            >
              See examples
            </a>
          </div>
        </section>

        {/* Pipeline diagram */}
        <section className="px-6 pb-20 max-w-4xl mx-auto w-full">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-6">
              Agent pipeline
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0">
              {[
                { name: "Extractor", desc: "Claims" },
                { name: "Verifier", desc: "Evidence" },
                { name: "Skeptic", desc: "Challenge" },
                { name: "Judge", desc: "Verdict" },
              ].map((agent, i) => (
                <div key={agent.name} className="flex items-center gap-3 sm:flex-1">
                  <div className="flex flex-col items-center sm:w-full">
                    <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-center w-full sm:w-auto">
                      <div className="text-sm font-semibold text-zinc-200">
                        {agent.name}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">{agent.desc}</div>
                    </div>
                  </div>
                  {i < 3 && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="w-4 h-4 text-zinc-600 flex-shrink-0 hidden sm:block"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2 8a.75.75 0 0 1 .75-.75h8.69L9.22 5.03a.75.75 0 1 1 1.06-1.06l3.5 3.5a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 1 1-1.06-1.06l2.22-2.22H2.75A.75.75 0 0 1 2 8Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "ERC-8004 Identity",
                "Reputation Registry",
                "Storacha CIDs",
                "Lit Signature",
                "ATProto Hypercert",
              ].map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-mono text-zinc-400 border border-zinc-700 rounded px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Example evaluations */}
        <section id="examples" className="px-6 pb-24 max-w-4xl mx-auto w-full">
          <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest mb-6">
            Example evaluations
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {VERDICTS.map((v) => (
              <div
                key={v.project}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col gap-3 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                    <span className={`text-sm font-semibold ${v.color}`}>
                      {v.label}
                    </span>
                  </div>
                  <span className="font-mono text-lg font-bold text-zinc-200">
                    {v.score}
                    <span className="text-zinc-500 text-sm font-normal">/100</span>
                  </span>
                </div>
                <p className="text-sm font-medium text-zinc-300 leading-snug">
                  {v.project}
                </p>
                <p className="text-xs text-zinc-500 leading-relaxed">{v.summary}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-6 text-center text-xs text-zinc-600">
        Credence · Built for ETHGlobal · ERC-8004 · Hypercerts · Storacha · Lit Protocol
      </footer>
    </div>
  );
}
