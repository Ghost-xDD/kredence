import Link from 'next/link';

export function Nav() {
  return (
    <header className="border-b border-[#e5e7eb] bg-white sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#0a0a0a" />
            <rect
              x="11"
              y="1"
              width="6"
              height="6"
              rx="1.5"
              fill="#0a0a0a"
              opacity="0.4"
            />
            <rect
              x="1"
              y="11"
              width="6"
              height="6"
              rx="1.5"
              fill="#0a0a0a"
              opacity="0.4"
            />
            <rect x="11" y="11" width="6" height="6" rx="1.5" fill="#0a0a0a" />
          </svg>
          <span className="font-semibold text-sm tracking-tight text-[#0a0a0a]">
            Kredence
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-6 text-sm text-[#374151]">
          <Link
            href="/pipeline"
            className="hover:text-[#0a0a0a] transition-colors"
          >
            Pipeline
          </Link>
          <Link
            href="/explore"
            className="hover:text-[#0a0a0a] transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/agents"
            className="hover:text-[#0a0a0a] transition-colors"
          >
            Agents
          </Link>
          <Link
            href="https://www.hyperscan.dev"
            target="_blank"
            rel="noopener"
            className="hover:text-[#0a0a0a] transition-colors flex items-center gap-1"
          >
            Hyperscan
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className="opacity-40"
            >
              <path
                d="M2 8L8 2M8 2H4M8 2V6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link
            href="https://docs.kredence.xyz"
            target="_blank"
            rel="noopener"
            className="hover:text-[#0a0a0a] transition-colors flex items-center gap-1"
          >
            Docs
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className="opacity-40"
            >
              <path
                d="M2 8L8 2M8 2H4M8 2V6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button className="hidden sm:block text-[#6b7280] hover:text-[#0a0a0a] transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle
                cx="7"
                cy="7"
                r="5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M11 11L14 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <Link
            href="/pipeline"
            className="text-xs font-medium bg-[#0a0a0a] text-white px-3 py-1.5 rounded-md hover:bg-[#374151] transition-colors"
          >
            Run Pipeline
          </Link>
        </div>
      </div>
    </header>
  );
}
