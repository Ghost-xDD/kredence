/**
 * Octant funding platform adapter.
 *
 * Octant is a public-goods funding platform built by Golem Foundation.
 * Projects are funded per epoch via quadratic funding.
 *
 * Uses two public endpoints:
 *   GET /projects/details?epochs={n}&searchPhrases=
 *   → Returns { projectsDetails: [{ name, address, epoch }] }
 *
 *   GET /epochs/current
 *   → Returns the current epoch number when none is specified
 *
 * Project pages live at: https://octant.app/projects/{address}
 */
import { nanoid } from "nanoid";
import type { ProjectRecord, ProjectSource } from "@credence/types";

const OCTANT_API = "https://backend.mainnet.octant.app";
const OCTANT_APP = "https://octant.app";
const UA = "Mozilla/5.0 (compatible; Credence/0.1)";

type OctantEpochInfo = {
  currentEpoch?: number;
  pendingEpoch?: number;
};

type OctantProjectDetail = {
  name?: string;
  address?: string;
  epoch?: string | number;
};

type OctantDetailsResponse = {
  projectsDetails?: OctantProjectDetail[];
};

async function fetchOctantJson<T>(path: string): Promise<T> {
  const res = await fetch(`${OCTANT_API}${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from Octant API: ${path}`);
  return res.json() as Promise<T>;
}

async function resolveEpoch(epochNumber?: number): Promise<number> {
  if (epochNumber !== undefined) return epochNumber;
  try {
    const info = await fetchOctantJson<OctantEpochInfo>("/epochs/current");
    return info.currentEpoch ?? info.pendingEpoch ?? 7;
  } catch {
    return 7;
  }
}

export async function fetchOctantProjects(epochNumber?: number): Promise<ProjectRecord[]> {
  const epoch = await resolveEpoch(epochNumber);
  console.log(`[Scout/Octant] Fetching projects for epoch ${epoch}`);

  const data = await fetchOctantJson<OctantDetailsResponse>(
    `/projects/details?epochs=${epoch}&searchPhrases=`
  );

  const details = data.projectsDetails ?? [];
  console.log(`[Scout/Octant] Found ${details.length} projects in epoch ${epoch}`);

  const resolvedAt = new Date().toISOString();
  const projects: ProjectRecord[] = [];

  for (const p of details) {
    if (!p.address) continue;

    const projectUrl = `${OCTANT_APP}/projects/${p.address}`;
    const sources: ProjectSource[] = [
      { type: "submission-page", url: projectUrl, resolvedAt },
    ];

    projects.push({
      id: nanoid(),
      ecosystemKind: "octant",
      name: p.name ?? p.address,
      team: [],
      sources,
    });
  }

  console.log(`[Scout/Octant] Normalized ${projects.length} projects`);
  return projects;
}
