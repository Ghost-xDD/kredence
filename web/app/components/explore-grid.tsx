"use client";

import { useState } from "react";
import Link from "next/link";
import type { RegistryEntry } from "@credence/types";

const ECOSYSTEM_LABELS: Record<string, string> = {
  "devspot":             "Devspot",
  "filecoin-devgrants":  "Filecoin Dev Grants",
  "chainlink-hackathon": "Chainlink",
  "ethglobal":           "ETHGlobal",
  "devfolio":            "Devfolio",
  "gitcoin":             "Gitcoin",
  "octant":              "Octant",
  "github-repo":         "GitHub",
  "manual":              "Manual",
};

const SORT_OPTIONS = [
  { value: "confidence", label: "Confidence" },
  { value: "recent",     label: "Most recent" },
  { value: "verified",   label: "Most verified" },
] as const;

type SortKey = typeof SORT_OPTIONS[number]["value"];

function ecosystemLabel(kind: string | undefined) {
  if (!kind) return null;
  return ECOSYSTEM_LABELS[kind] ?? kind;
}

function ConfidenceDot({ value }: { value: number }) {
  const color = value >= 0.7 ? "#16a34a" : value >= 0.4 ? "#d97706" : "#dc2626";
  return <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: color }} />;
}

function EcosystemTag({ kind }: { kind: string | undefined }) {
  if (!kind) return null;
  const label = ecosystemLabel(kind);
  return (
    <span className="text-[10px] font-mono text-[#6b7280] bg-[#f3f4f6] border border-[#e5e7eb] rounded px-1.5 py-0.5 shrink-0">
      {label}
    </span>
  );
}

function ProjectCard({ p }: { p: RegistryEntry }) {
  const pct      = Math.round(p.confidenceScore * 100);
  const barColor = pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";

  return (
    <Link
      href={`/project/${p.slug}`}
      className="group border border-[#e5e7eb] rounded-xl p-5 hover:border-[#c8cacf] hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] hover:-translate-y-0.5 transition-all bg-white flex flex-col"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ConfidenceDot value={p.confidenceScore} />
          <span className="text-sm font-semibold text-[#0a0a0a] truncate">{p.title}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <EcosystemTag kind={p.ecosystemKind} />
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-[#d1d5db] group-hover:text-[#9ca3af] transition-colors">
            <path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <p className="text-xs text-[#6b7280] leading-relaxed mb-4 line-clamp-2">{p.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {p.impactCategory.slice(0, 3).map((c) => (
          <span key={c} className="text-[10px] font-mono text-[#9ca3af] bg-[#f9fafb] border border-[#f3f4f6] rounded px-1.5 py-0.5">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[3px] rounded-full bg-[#f3f4f6] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
          <span className="text-xs tabular-nums font-medium shrink-0" style={{ color: barColor }}>{pct}%</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-[#16a34a]">✓ {p.verifiedCount}</span>
          {p.flaggedCount > 0 && <span className="text-[#6b7280]">✗ {p.flaggedCount}</span>}
          {p.unresolvedCount > 0 && <span className="text-[#d97706]">⚠ {p.unresolvedCount}</span>}
          {p.hasAtproto && (
            <span className="ml-auto flex items-center gap-1 text-[#9ca3af]">
              <span className="w-1 h-1 rounded-full bg-[#16a34a]" />ATProto
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ExploreGrid({ projects }: { projects: RegistryEntry[] }) {
  const [activeEcosystem, setActiveEcosystem] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("confidence");

  // Derive unique ecosystems present in the data
  const ecosystems = [...new Set(
    projects.map((p) => p.ecosystemKind).filter(Boolean) as string[]
  )].sort();

  // Filter
  const filtered = activeEcosystem
    ? projects.filter((p) => p.ecosystemKind === activeEcosystem)
    : projects;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "confidence") return b.confidenceScore - a.confidenceScore;
    if (sort === "recent")     return new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime();
    if (sort === "verified")   return b.verifiedCount - a.verifiedCount;
    return 0;
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        {/* Ecosystem filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveEcosystem(null)}
            className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors ${
              activeEcosystem === null
                ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                : "text-[#6b7280] border-[#e5e7eb] hover:border-[#c8cacf]"
            }`}
          >
            All · {projects.length}
          </button>
          {ecosystems.map((kind) => {
            const count = projects.filter((p) => p.ecosystemKind === kind).length;
            return (
              <button
                key={kind}
                onClick={() => setActiveEcosystem(activeEcosystem === kind ? null : kind)}
                className={`text-[11px] font-mono px-2.5 py-1 rounded-full border transition-colors ${
                  activeEcosystem === kind
                    ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                    : "text-[#6b7280] border-[#e5e7eb] hover:border-[#c8cacf]"
                }`}
              >
                {ecosystemLabel(kind)} · {count}
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="text-[11px] font-mono text-[#6b7280] bg-transparent border border-[#e5e7eb] rounded-lg px-2.5 py-1 outline-none cursor-pointer hover:border-[#c8cacf] transition-colors"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {sorted.length === 0 ? (
        <p className="text-sm text-[#9ca3af] text-center py-12">No projects in this ecosystem yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sorted.map((p) => <ProjectCard key={p.slug} p={p} />)}
        </div>
      )}
    </div>
  );
}
