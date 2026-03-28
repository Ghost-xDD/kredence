// Shared mock data — matches @credence/types shapes exactly
// Used by all dashboard pages to simulate a completed pipeline run

export type MockProject = {
  id: string;
  name: string;
  description: string;
  ecosystem: string;
  ecosystemKind: string;
  confidence: number; // 0–100
  verified: number;
  flagged: number;
  unresolved: number;
  contributors: { name: string; githubLogin: string }[];
  sources: { type: "github" | "website" | "onchain"; url: string }[];
  lastUpdated: string;
  hyperscan: string;
  rkey: string;
  storachaCids: { evidence: string; adversarial: string; hypercert: string };
  verifiedClaims: { id: string; text: string; evidence: string[] }[];
  flaggedClaims: { id: string; text: string; objection: string; challengeType: string }[];
  openQuestions: { id: string; text: string; note: string }[];
  evaluatorSummary: string;
  impactCategory: string[];
  timeframe: { start: string; end: string };
  atproto: { activityUri: string; hyperscanUrl: string };
};

export const MOCK_PROJECTS: MockProject[] = [
  {
    id: "storagedao",
    name: "StorageDAO",
    description: "A decentralized autonomous organization for community-governed Filecoin storage allocation. Members vote on storage deals, providers, and retrieval incentives.",
    ecosystem: "PL Genesis",
    ecosystemKind: "devspot-hackathon",
    confidence: 81,
    verified: 9,
    flagged: 1,
    unresolved: 0,
    contributors: [
      { name: "Alex Rivera", githubLogin: "arivera" },
      { name: "Priya Nair", githubLogin: "pnair" },
      { name: "Tomas Kral", githubLogin: "tkral" },
    ],
    sources: [
      { type: "github", url: "https://github.com/storagedao/storagedao" },
      { type: "website", url: "https://storagedao.xyz" },
      { type: "onchain", url: "https://basescan.org/address/0xabc123" },
    ],
    lastUpdated: "2025-03-14T09:12:00Z",
    hyperscan: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m8aaa111",
    rkey: "3mi3m8aaa111",
    storachaCids: {
      evidence: "bafybeidxyz1storagedaoevidence",
      adversarial: "bafybeidxyz1storagedaoadversarial",
      hypercert: "bafybeidxyz1storagedaohypercert",
    },
    verifiedClaims: [
      { id: "v1", text: "GitHub repo has 134 commits over the past 90 days.", evidence: ["GitHub API: 134 commits between Jan 1–Mar 14 2025"] },
      { id: "v2", text: "3 distinct contributors verified from commit history.", evidence: ["GitHub contributors API: arivera (89 commits), pnair (31 commits), tkral (14 commits)"] },
      { id: "v3", text: "Smart contract deployed and verified on Base Sepolia at 0xabc123.", evidence: ["Basescan: contract created block 7,234,112 · 208 transactions"] },
      { id: "v4", text: "DAO voting interface live at storagedao.xyz with 200 OK response.", evidence: ["HTTP GET storagedao.xyz returned 200, title='StorageDAO — Community Storage'"] },
      { id: "v5", text: "README documents governance flow with proposal lifecycle diagram.", evidence: ["README.md: 1,240 words, includes mermaid diagram of proposal→vote→execution flow"] },
      { id: "v6", text: "5 closed GitHub issues correspond to resolved milestone tasks.", evidence: ["GitHub Issues API: 5 issues closed with milestone 'v1.0'"] },
      { id: "v7", text: "Contract ABI exposes propose(), vote(), and execute() functions.", evidence: ["Basescan ABI: 3 public functions matching governance spec"] },
      { id: "v8", text: "15 storage deals brokered through the DAO contract onchain.", evidence: ["Basescan: 15 events matching DealBrokered(address,bytes32)"] },
      { id: "v9", text: "Project submitted a 3-minute demo video linked in README.", evidence: ["README line 47: 'Demo: https://youtu.be/…' — URL resolves with 200"] },
    ],
    flaggedClaims: [
      { id: "f1", text: "Claims 500 active DAO members.", objection: "Onchain voter participation shows 12 unique addresses across all votes. No off-chain membership registry verifiable.", challengeType: "vague-metric" },
    ],
    openQuestions: [],
    evaluatorSummary: "StorageDAO demonstrates strong execution: an active codebase, a live deployed contract, and verifiable onchain activity. The governance interface is functional and the README is thorough. The only flag is an unsubstantiated membership claim; all core technical claims check out.",
    impactCategory: ["infrastructure", "dao-tooling"],
    timeframe: { start: "2024-12-01", end: "2025-03-14" },
    atproto: { activityUri: "at://did:plc:fke3rhssj7rdghxee2t73x73/org.hypercerts.claim.activity/3mi3m8aaa111", hyperscanUrl: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m8aaa111" },
  },
  {
    id: "databridge",
    name: "DataBridge",
    description: "Cross-chain data indexer that aggregates on-chain events from EVM networks and persists snapshots to Filecoin via Storacha for long-term auditability.",
    ecosystem: "PL Genesis",
    ecosystemKind: "devspot-hackathon",
    confidence: 72,
    verified: 7,
    flagged: 2,
    unresolved: 1,
    contributors: [
      { name: "Marco Bianchi", githubLogin: "mbianchi" },
      { name: "Yuki Tanaka", githubLogin: "ytanaka" },
    ],
    sources: [
      { type: "github", url: "https://github.com/databridge-xyz/databridge" },
      { type: "website", url: "https://databridge.xyz" },
    ],
    lastUpdated: "2025-03-13T17:44:00Z",
    hyperscan: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m8bbb222",
    rkey: "3mi3m8bbb222",
    storachaCids: {
      evidence: "bafybeidxyz2databridgeevidence",
      adversarial: "bafybeidxyz2databridgeadversarial",
      hypercert: "bafybeidxyz2databridgehypercert",
    },
    verifiedClaims: [
      { id: "v1", text: "78 commits from 2 contributors over the 90-day window.", evidence: ["GitHub API: mbianchi (61), ytanaka (17)"] },
      { id: "v2", text: "Storacha integration present in source — w3up client imported and used.", evidence: ["github.com/databridge-xyz/databridge/src/storage.ts: `import { create } from '@web3-storage/w3up-client'`"] },
      { id: "v3", text: "Live indexer endpoint at api.databridge.xyz returns event data.", evidence: ["HTTP GET api.databridge.xyz/events?chain=base returned 200 with JSON payload"] },
      { id: "v4", text: "README documents 4 supported EVM chains: Base, Optimism, Arbitrum, Ethereum.", evidence: ["README.md: 'Supported chains' table with 4 rows"] },
      { id: "v5", text: "8 merged pull requests tagged 'feature' in the last 90 days.", evidence: ["GitHub PRs API: 8 PRs with label 'feature' merged Jan–Mar 2025"] },
      { id: "v6", text: "Snapshot CIDs are logged to a public JSON manifest on Storacha.", evidence: ["api.databridge.xyz/manifests returns array of bafyb… CIDs"] },
      { id: "v7", text: "2 external GitHub stars and 1 fork indicating community awareness.", evidence: ["GitHub repo: 2 stars, 1 fork as of evaluation date"] },
    ],
    flaggedClaims: [
      { id: "f1", text: "Claims to index 1M+ events per day.", objection: "The live API endpoint returned 2,341 events total across all chains at time of evaluation. No throughput metrics or load test results provided.", challengeType: "vague-metric" },
      { id: "f2", text: "Claims production deployment on all 4 chains.", objection: "Only Base chain endpoint responded. Optimism, Arbitrum, and Ethereum endpoints returned 404.", challengeType: "deployment" },
    ],
    openQuestions: [
      { id: "u1", text: "Demo URL listed in README (demo.databridge.xyz) was unreachable.", note: "Could be a temporary outage; domain resolves but returns 502 Bad Gateway." },
    ],
    evaluatorSummary: "DataBridge shows solid engineering — the Storacha integration is real and the indexer is live on Base. The throughput claim and multi-chain coverage are both overstated relative to what is verifiable. Core technical merit is high; marketing claims need calibration.",
    impactCategory: ["infrastructure", "data"],
    timeframe: { start: "2024-12-15", end: "2025-03-13" },
    atproto: { activityUri: "at://did:plc:fke3rhssj7rdghxee2t73x73/org.hypercerts.claim.activity/3mi3m8bbb222", hyperscanUrl: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m8bbb222" },
  },
  {
    id: "zkmarket",
    name: "ZKMarket",
    description: "Zero-knowledge marketplace for private NFT trading. Buyers prove ownership eligibility without revealing wallet identity, powered by snarkjs circuits.",
    ecosystem: "PL Genesis",
    ecosystemKind: "devspot-hackathon",
    confidence: 56,
    verified: 5,
    flagged: 4,
    unresolved: 0,
    contributors: [
      { name: "Dev Zero", githubLogin: "devzero" },
      { name: "anon_coder", githubLogin: "anon-coder-99" },
    ],
    sources: [
      { type: "github", url: "https://github.com/zkmarket/zkmarket" },
      { type: "website", url: "https://zkmarket.xyz" },
    ],
    lastUpdated: "2025-03-12T14:30:00Z",
    hyperscan: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m7rvz2g2y",
    rkey: "3mi3m7rvz2g2y",
    storachaCids: {
      evidence: "bafybeidxyz3zkmarketevidence",
      adversarial: "bafybeidxyz3zkmarketadversarial",
      hypercert: "bafybeidxyz3zkmarkethypercert",
    },
    verifiedClaims: [
      { id: "v1", text: "47 commits in the last 90 days from 2 contributors.", evidence: ["GitHub API: devzero (39), anon-coder-99 (8)"] },
      { id: "v2", text: "snarkjs is listed as a dependency in package.json.", evidence: ["github.com/zkmarket/zkmarket/package.json: `\"snarkjs\": \"^0.7.4\"`"] },
      { id: "v3", text: "ZK circuit files (.circom) present in /circuits directory.", evidence: ["GitHub tree: /circuits/ownership.circom, /circuits/transfer.circom"] },
      { id: "v4", text: "Frontend at zkmarket.xyz returns 200 OK.", evidence: ["HTTP GET zkmarket.xyz: 200, title='ZKMarket — Private NFT Trading'"] },
      { id: "v5", text: "README references snarkjs proof generation workflow.", evidence: ["README.md section 'How it works': describes groth16 proof flow"] },
    ],
    flaggedClaims: [
      { id: "f1", text: "Claims 10,000 test transactions processed.", objection: "The deployed contract on Base Sepolia shows 23 transactions total. No testnet or simulation logs provided.", challengeType: "vague-metric" },
      { id: "f2", text: "Claims 'production ready' status.", objection: "Last meaningful commit (circuit + contract changes) was 61 days before submission. The README still contains TODO comments in 4 sections.", challengeType: "overclaim" },
      { id: "f3", text: "Claims 4 active contributors.", objection: "Commit history shows 2 contributors with meaningful commits. The other 2 listed in README have 0 commits in the evaluation window.", challengeType: "attribution" },
      { id: "f4", text: "Claimed live demo at demo.zkmarket.xyz.", objection: "URL returns 404 at time of evaluation. Domain is registered but no content served.", challengeType: "dead-link" },
    ],
    openQuestions: [],
    evaluatorSummary: "ZKMarket has genuine ZK circuit work — the circom files and snarkjs integration are real. However, the project overclaims on transaction volume, contributor count, and deployment status. The core cryptographic contribution is valid; the surrounding claims inflate the picture.",
    impactCategory: ["privacy", "nft"],
    timeframe: { start: "2024-12-10", end: "2025-03-12" },
    atproto: { activityUri: "at://did:plc:fke3rhssj7rdghxee2t73x73/org.hypercerts.claim.activity/3mi3m7rvz2g2y", hyperscanUrl: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m7rvz2g2y" },
  },
  {
    id: "yaynay-wtf",
    name: "YayNay.wtf",
    description: "On-chain polling and signaling tool for DAOs. Members cast weighted votes stored as Filecoin-backed attestations for verifiable governance history.",
    ecosystem: "PL Genesis",
    ecosystemKind: "devspot-hackathon",
    confidence: 50,
    verified: 4,
    flagged: 4,
    unresolved: 0,
    contributors: [
      { name: "Sam Green", githubLogin: "samgreen" },
      { name: "Lena Müller", githubLogin: "lenamueller" },
      { name: "Raj Patel", githubLogin: "rajpatel" },
    ],
    sources: [
      { type: "github", url: "https://github.com/yaynay/yaynay-wtf" },
      { type: "website", url: "https://yaynay.wtf" },
    ],
    lastUpdated: "2025-03-10T11:22:00Z",
    hyperscan: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m7tczmt2r",
    rkey: "3mi3m7tczmt2r",
    storachaCids: {
      evidence: "bafybeidxyz4yaynayevidence",
      adversarial: "bafybeidxyz4yaynayadversarial",
      hypercert: "bafybeidxyz4yaynayhypercert",
    },
    verifiedClaims: [
      { id: "v1", text: "3 contributors verified from commit history.", evidence: ["GitHub API: samgreen (44), lenamueller (19), rajpatel (11)"] },
      { id: "v2", text: "Live site at yaynay.wtf returns 200 with poll interface.", evidence: ["HTTP GET yaynay.wtf: 200, visible poll UI in HTML snapshot"] },
      { id: "v3", text: "Smart contract deployed on Base Sepolia with 31 transactions.", evidence: ["Basescan: contract 0xdef456, 31 txs, deployed 2025-01-08"] },
      { id: "v4", text: "74 total commits in the 90-day window.", evidence: ["GitHub commits API: 74 commits Jan–Mar 2025"] },
    ],
    flaggedClaims: [
      { id: "f1", text: "Claims Filecoin-backed attestation storage.", objection: "No Filecoin or Storacha imports found in the codebase. Attestations are stored in the smart contract only.", challengeType: "consistency" },
      { id: "f2", text: "Claims 200 active users in beta.", objection: "Onchain interaction shows 7 unique addresses across all poll votes.", challengeType: "vague-metric" },
      { id: "f3", text: "Claims weighted voting based on token balance.", objection: "Smart contract uses 1-address-1-vote. No token balance lookup present in the contract ABI.", challengeType: "consistency" },
      { id: "f4", text: "Claims cross-chain attestation support.", objection: "Only Base Sepolia deployment found. No bridge or cross-chain contracts referenced in the codebase.", challengeType: "overclaim" },
    ],
    openQuestions: [],
    evaluatorSummary: "YayNay.wtf has a functioning on-chain poll contract and an active development team. The Filecoin/Storacha integration and weighted voting claims are not supported by the code. The team appears to have described intended features as implemented ones — a common pattern that the adversarial agent surfaces clearly.",
    impactCategory: ["dao-tooling", "social"],
    timeframe: { start: "2025-01-05", end: "2025-03-10" },
    atproto: { activityUri: "at://did:plc:fke3rhssj7rdghxee2t73x73/org.hypercerts.claim.activity/3mi3m7tczmt2r", hyperscanUrl: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m7tczmt2r" },
  },
  {
    id: "safenote",
    name: "Safenote",
    description: "End-to-end encrypted note sharing with Filecoin-backed persistence. Notes are encrypted client-side, chunked, and stored as Storacha CARs.",
    ecosystem: "PL Genesis",
    ecosystemKind: "devspot-hackathon",
    confidence: 56,
    verified: 4,
    flagged: 0,
    unresolved: 5,
    contributors: [
      { name: "Iris Chen", githubLogin: "irischen" },
      { name: "Felix Wagner", githubLogin: "fwagner" },
      { name: "Nia Osei", githubLogin: "niaosei" },
    ],
    sources: [
      { type: "github", url: "https://github.com/safenote-app/safenote" },
      { type: "website", url: "https://safenote.app" },
    ],
    lastUpdated: "2025-03-11T08:55:00Z",
    hyperscan: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m7tjxcl2r",
    rkey: "3mi3m7tjxcl2r",
    storachaCids: {
      evidence: "bafybeidxyz5safenoteeevidence",
      adversarial: "bafybeidxyz5safenoteadversarial",
      hypercert: "bafybeidxyz5safenotehypercert",
    },
    verifiedClaims: [
      { id: "v1", text: "3 contributors with 91 commits in the 90-day window.", evidence: ["GitHub: irischen (55), fwagner (24), niaosei (12)"] },
      { id: "v2", text: "Storacha w3up client integrated for encrypted note storage.", evidence: ["src/storage.ts: `import { create } from '@web3-storage/w3up-client'`; upload() called in note save flow"] },
      { id: "v3", text: "Client-side AES-GCM encryption present in source.", evidence: ["src/crypto.ts: uses Web Crypto API, AES-GCM, 256-bit key, per-note salt"] },
      { id: "v4", text: "safenote.app returns 200 with editor UI.", evidence: ["HTTP GET safenote.app: 200, visible TipTap editor in HTML snapshot"] },
    ],
    flaggedClaims: [],
    openQuestions: [
      { id: "u1", text: "Claimed 'zero-knowledge key derivation' in README.", note: "README mentions ZK key derivation but no ZK circuit or library is present in the repo. Could be aspirational documentation." },
      { id: "u2", text: "Retrieval flow from Storacha not demonstrated.", note: "Upload path is implemented; download/decrypt path has a TODO comment in storage.ts." },
      { id: "u3", text: "No tests found for the encryption module.", note: "src/crypto.ts has no test file. Correctness of encryption implementation cannot be independently verified from source alone." },
      { id: "u4", text: "Claimed IPFS gateway fallback.", note: "README references IPFS gateway as fallback but no IPFS client or gateway URL in the codebase." },
      { id: "u5", text: "Team size listed as 5 in submission form.", note: "Only 3 contributors found in git history. The other 2 may have contributed off-repo." },
    ],
    evaluatorSummary: "Safenote has a genuine Storacha integration and working client-side encryption. The high unresolved count reflects aspirational documentation rather than deception — the team described planned features alongside implemented ones. The core E2E encryption + Storacha storage is solid and verifiable.",
    impactCategory: ["privacy", "developer-tools"],
    timeframe: { start: "2024-12-20", end: "2025-03-11" },
    atproto: { activityUri: "at://did:plc:fke3rhssj7rdghxee2t73x73/org.hypercerts.claim.activity/3mi3m7tjxcl2r", hyperscanUrl: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m7tjxcl2r" },
  },
  {
    id: "chainvote",
    name: "ChainVote",
    description: "Gasless governance voting protocol with Filecoin attestation anchoring. Votes are signed off-chain, batched, and anchored to Filecoin for immutable record.",
    ecosystem: "PL Genesis",
    ecosystemKind: "devspot-hackathon",
    confidence: 34,
    verified: 3,
    flagged: 6,
    unresolved: 1,
    contributors: [
      { name: "Omar Hassan", githubLogin: "ohassan" },
    ],
    sources: [
      { type: "github", url: "https://github.com/chainvote/chainvote-protocol" },
      { type: "website", url: "https://chainvote.io" },
    ],
    lastUpdated: "2025-03-08T16:00:00Z",
    hyperscan: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m8ccc333",
    rkey: "3mi3m8ccc333",
    storachaCids: {
      evidence: "bafybeidxyz6chainvoteevidence",
      adversarial: "bafybeidxyz6chainvoteadversarial",
      hypercert: "bafybeidxyz6chainvotehypercert",
    },
    verifiedClaims: [
      { id: "v1", text: "1 contributor (ohassan) with 28 commits in the 90-day window.", evidence: ["GitHub: ohassan (28 commits)"] },
      { id: "v2", text: "EIP-712 typed data signing implemented in the frontend.", evidence: ["src/sign.ts: uses `eth_signTypedData_v4`"] },
      { id: "v3", text: "chainvote.io domain returns 200.", evidence: ["HTTP GET chainvote.io: 200, landing page content"] },
    ],
    flaggedClaims: [
      { id: "f1", text: "Claims a 4-person team.", objection: "Git history shows 1 contributor. The submission lists 4 names but 3 have 0 commits and no evidence of contribution.", challengeType: "attribution" },
      { id: "f2", text: "Claims Filecoin attestation anchoring is live.", objection: "No Filecoin or Storacha client in the codebase. The anchoring logic has a placeholder comment: `// TODO: upload to Storacha`.", challengeType: "deployment" },
      { id: "f3", text: "Claims gasless voting is implemented.", objection: "The gasless relay server is described in README but not present in the repo. The frontend calls a hardcoded localhost URL.", challengeType: "deployment" },
      { id: "f4", text: "Claims 1,200 votes cast in beta.", objection: "No deployed contract found on Base, Base Sepolia, or any other EVM chain. No testnet evidence of vote activity.", challengeType: "vague-metric" },
      { id: "f5", text: "Claims DAO integrations with 3 named protocols.", objection: "No integration code found. Protocol names appear only in the README and pitch deck link.", challengeType: "consistency" },
      { id: "f6", text: "Pitch deck claims $500K in TVL protected by the protocol.", objection: "Protocol is not deployed. TVL claim has no basis in verifiable evidence.", challengeType: "overclaim" },
    ],
    openQuestions: [
      { id: "u1", text: "Submission includes a Figma design link but no implementation.", note: "Design appears polished; implementation is significantly behind the described product." },
    ],
    evaluatorSummary: "ChainVote has a single active contributor who built a signing frontend. The gap between claimed and implemented features is significant: the Filecoin anchoring, gasless relay, DAO integrations, and vote activity are all unimplemented or unverifiable. The project appears to be pitching a vision rather than a working product.",
    impactCategory: ["dao-tooling"],
    timeframe: { start: "2025-01-20", end: "2025-03-08" },
    atproto: { activityUri: "at://did:plc:fke3rhssj7rdghxee2t73x73/org.hypercerts.claim.activity/3mi3m8ccc333", hyperscanUrl: "https://www.hyperscan.dev/data?did=did%3Aplc%3Afke3rhssj7rdghxee2t73x73&collection=org.hypercerts.claim.activity&rkey=3mi3m8ccc333" },
  },
];

export type MockAgentMeta = {
  name: string;
  slug: string;
  tag: string;
  step: string;
  role: "scout" | "evidence" | "adversarial" | "synthesis";
  description: string;
  detail: string;
  agentId: string;
  registry: string;
  operatorWallet: string;
  evaluations: number;
  lastActive: string;
  capabilities: string[];
  avgDurationMs: number;
  outputSummary: string;
};

export const MOCK_AGENTS: MockAgentMeta[] = [
  {
    name: "Scout",
    slug: "scout",
    tag: "discover",
    step: "01",
    role: "scout",
    description: "Crawls hackathons, grant programs, and manual lists. Discovers every submitted project and deduplicates across sources.",
    detail: "178 projects · Devspot, Filecoin Dev Grants",
    agentId: "42",
    registry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
    operatorWallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    evaluations: 12,
    lastActive: "2025-03-14",
    capabilities: ["Devspot scraping", "Filecoin Dev Grants API", "ETHGlobal showcase", "Manual URL list", "Deduplication by GitHub URL"],
    avgDurationMs: 34200,
    outputSummary: "Discovered 178 projects across 2 ecosystems. Deduplicated 4 cross-listed projects. Stored ProjectManifest on Storacha.",
  },
  {
    name: "Evidence",
    slug: "evidence",
    tag: "collect",
    step: "02",
    role: "evidence",
    description: "Pulls GitHub activity, website content, and on-chain data for every project. Extracts structured claims using GPT-4o.",
    detail: "1,602 claims · GitHub + web + onchain",
    agentId: "43",
    registry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
    operatorWallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    evaluations: 12,
    lastActive: "2025-03-14",
    capabilities: ["GitHub REST API (commits, PRs, issues)", "HTTP content extraction", "Onchain RPC queries (viem)", "Structured claim extraction via GPT-4o"],
    avgDurationMs: 118400,
    outputSummary: "Collected evidence for 178 projects. Extracted 1,602 structured claims. 3 projects had unreachable sources (logged and skipped).",
  },
  {
    name: "Adversarial",
    slug: "adversarial",
    tag: "challenge",
    step: "03",
    role: "adversarial",
    description: "Every claim is challenged. Flags unverified metrics, attribution gaps, and overclaims. Produces EIP-191 signed receipts.",
    detail: "341 flagged · EIP-191 signed logs",
    agentId: "44",
    registry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
    operatorWallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    evaluations: 12,
    lastActive: "2025-03-14",
    capabilities: ["Vague-metric detection", "Attribution verification", "Consistency cross-checking", "Deployment reachability probes", "Overclaim scoring", "EIP-191 receipt signing"],
    avgDurationMs: 87100,
    outputSummary: "Challenged 1,602 claims across 178 projects. 897 verified, 341 flagged, 364 unresolved. All logs EIP-191 signed.",
  },
  {
    name: "Synthesis",
    slug: "synthesis",
    tag: "publish",
    step: "04",
    role: "synthesis",
    description: "Assembles the final hypercert payload and publishes it as a live ATProto record on the Hypercerts network via Storacha.",
    detail: "178 hypercerts · ATProto + Storacha",
    agentId: "45",
    registry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
    operatorWallet: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    evaluations: 12,
    lastActive: "2025-03-14",
    capabilities: ["HypercertPayload assembly", "LLM evaluator summary (GPT-4o)", "Storacha CAR upload", "ATProto record publication", "Hyperscan link generation"],
    avgDurationMs: 56800,
    outputSummary: "Generated 178 hypercert payloads. Published 178 ATProto records. 0 publish failures.",
  },
];

export const PIPELINE_RUNS = [
  {
    id: "run-001",
    ecosystem: "PL Genesis Hackathon",
    ecosystemKind: "devspot-hackathon",
    identifier: "pl-genesis-frontiers-of-collaboration-hackathon.devspot.app",
    startedAt: "2025-03-14T06:00:00Z",
    completedAt: "2025-03-14T07:16:42Z",
    projectCount: 178,
    claimsExtracted: 1602,
    claimsFlagged: 341,
    hyperCertsPublished: 178,
    status: "complete" as const,
  },
  {
    id: "run-002",
    ecosystem: "Filecoin Dev Grants",
    ecosystemKind: "filecoin-devgrants",
    identifier: "filecoin-project/devgrants",
    startedAt: "2025-03-13T14:00:00Z",
    completedAt: "2025-03-13T15:04:18Z",
    projectCount: 34,
    claimsExtracted: 298,
    claimsFlagged: 71,
    hyperCertsPublished: 34,
    status: "complete" as const,
  },
];
