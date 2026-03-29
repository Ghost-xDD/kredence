// Input adapter types — one per supported funding platform

export type DevspotHackathon = {
  kind: "devspot";
  /** Full URL to the hackathon projects tab, e.g.
   *  https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/?activeTab=projects */
  url: string;
};

export type FilecoinDevGrants = {
  kind: "filecoin-devgrants";
  /** GitHub repo in owner/repo format, defaults to filecoin-project/devgrants */
  repo: string;
  /** Filter by label, e.g. "Open Grant", "RFP", "Next Step" */
  labels?: string[];
};

export type ETHGlobalShowcase = {
  kind: "ethglobal";
  /** ETHGlobal event slug, e.g. "bangkok" */
  eventSlug: string;
};

export type ChainlinkHackathon = {
  kind: "chainlink-hackathon";
  /** Gallery page URL, defaults to https://chain.link/hack-26 */
  galleryUrl: string;
  /** Optional limit for how many project detail pages to fetch */
  maxProjects?: number;
};

export type ManualURLList = {
  kind: "manual";
  /** Array of project URLs — GitHub repos, websites, or mix */
  urls: string[];
};

export type GitHubRepo = {
  kind: "github-repo";
  /** Full GitHub repo URL, e.g. https://github.com/owner/repo */
  repoUrl: string;
  /** GitHub App installation ID — used for write-back after pipeline completes */
  installationId?: number;
};

export type EcosystemInput =
  | DevspotHackathon
  | FilecoinDevGrants
  | ETHGlobalShowcase
  | ChainlinkHackathon
  | ManualURLList
  | GitHubRepo;
