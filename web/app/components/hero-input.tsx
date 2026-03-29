"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CHIPS = [
  {
    label: "PL Genesis Hackathon",
    source: "Devspot Hackathon",
    identifier: "https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects",
  },
  {
    label: "Filecoin Dev Grants",
    source: "Filecoin Dev Grants",
    identifier: "filecoin-project/devgrants",
  },
  {
    label: "ETHGlobal",
    source: "ETHGlobal",
    identifier: "hackmoney2026",
  },
  {
    label: "Chainlink Convergence",
    source: "Chainlink Convergence",
    identifier: "https://chain.link/hack-26",
  },
];

function detectSource(value: string): { source: string; identifier: string } {
  const trimmed = value.trim();
  if (/github\.com\/[^/\s]+\/[^/\s]+/.test(trimmed)) {
    return { source: "GitHub Repo", identifier: trimmed };
  }
  return { source: "Manual URL list", identifier: trimmed };
}

export function HeroInput() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function navigate(source: string, identifier: string) {
    const params = new URLSearchParams({ source, identifier });
    router.push(`/pipeline?${params.toString()}`);
  }

  function handleEvaluate() {
    if (!value.trim()) {
      router.push("/pipeline");
      return;
    }
    const { source, identifier } = detectSource(value);
    navigate(source, identifier);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleEvaluate();
  }

  return (
    <>
      {/* Search input */}
      <div className="max-w-lg mx-auto mb-4">
        <div className="flex items-center border border-[#e5e7eb] rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] px-4 py-3.5 gap-3">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-[#9ca3af] shrink-0">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste a GitHub URL, hackathon link, or ecosystem URL…"
            className="flex-1 text-sm text-[#374151] placeholder:text-[#9ca3af] outline-none bg-transparent"
          />
          <button
            onClick={handleEvaluate}
            className="text-xs font-medium bg-[#0a0a0a] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#1f2937] transition-colors shrink-0"
          >
            Evaluate
          </button>
        </div>
      </div>

      {/* Ecosystem chips */}
      <div className="flex flex-wrap justify-center gap-2 mb-14">
        {CHIPS.map((chip) => (
          <button
            key={chip.label}
            onClick={() => navigate(chip.source, chip.identifier)}
            className="text-xs px-3 py-1 rounded-full bg-white border border-[#e5e7eb] text-[#374151] hover:border-[#d1d5db] hover:shadow-sm transition-all"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </>
  );
}
