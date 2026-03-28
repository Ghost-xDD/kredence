/**
 * Publish a HypercertPayload to the real Hypercerts AT Protocol network.
 *
 * Records created per project:
 *   1. org.hypercerts.claim.activity    — the main impact claim
 *   2. org.hypercerts.context.evaluation — Credence adversarial evaluation + score
 *   3. org.hypercerts.context.attachment — evidence links (Storacha CIDs + GitHub)
 *
 * Auth: ATProto app password
 *   HYPERCERTS_HANDLE       e.g. credence-agent.bsky.social
 *   HYPERCERTS_APP_PASSWORD e.g. xxxx-xxxx-xxxx-xxxx
 *
 * If credentials are missing the function skips gracefully and returns null.
 */

import { AtpAgent } from "@atproto/api";
import type { HypercertPayload } from "@credence/types";

export type AtProtoRefs = {
  activityUri: string;
  activityCid: string;
  evaluationUri: string;
  evaluationCid: string;
  attachmentUri: string;
  attachmentCid: string;
  hyperscanUrl: string;
};

let _agent: AtpAgent | null = null;
let _did: string | null = null;

async function getAgent(): Promise<{ agent: AtpAgent; did: string } | null> {
  if (_agent && _did) return { agent: _agent, did: _did };

  const handle = process.env["HYPERCERTS_HANDLE"];
  const password = process.env["HYPERCERTS_APP_PASSWORD"];

  if (!handle || !password) {
    return null;
  }

  const agent = new AtpAgent({ service: "https://bsky.social" });
  await agent.login({ identifier: handle, password });

  _agent = agent;
  _did = agent.session!.did;

  return { agent, did: _did };
}

/**
 * Truncate a string to fit ATProto `shortDescription` constraints:
 * maxLength 3000 chars, maxGraphemes 300.
 */
function toShortDescription(text: string): string {
  // Rough grapheme approximation: slice to 290 chars (safe margin)
  if ([...text].length <= 290) return text;
  const graphemes = [...text];
  return graphemes.slice(0, 287).join("") + "...";
}

/**
 * Format contributors list as a readable string for shortDescription.
 */
function formatContributors(payload: HypercertPayload): string {
  if (!payload.contributors.length) return "Unknown";
  return payload.contributors
    .map((c) => c.githubLogin ?? c.name)
    .slice(0, 10)
    .join(", ");
}

/**
 * Publish a single HypercertPayload to the AT Protocol Hypercerts network.
 * Returns ATProto URIs/CIDs for all created records, or null if credentials
 * are not configured.
 */
export async function publishHypercert(
  payload: HypercertPayload
): Promise<AtProtoRefs | null> {
  const session = await getAgent();
  if (!session) return null;

  const { agent, did } = session;
  const now = new Date().toISOString();

  // ── 1. Create the main activity claim ───────────────────────────────────────

  const activityRecord = {
    $type: "org.hypercerts.claim.activity",
    title: payload.title.slice(0, 256),
    shortDescription: toShortDescription(payload.evaluatorSummary),
    createdAt: now,
    startDate: new Date(payload.timeframeStart).toISOString(),
    endDate: new Date(payload.timeframeEnd).toISOString(),
    workScope: {
      $type: "org.hypercerts.claim.activity#workScopeString",
      scope: payload.workScopes.join(", ").slice(0, 100),
    },
    contributors: payload.contributors.slice(0, 50).map((c) => ({
      contributorIdentity: {
        $type: "org.hypercerts.claim.activity#contributorIdentity",
        identity: c.githubLogin
          ? `https://github.com/${c.githubLogin}`
          : c.name,
      },
      ...(c.githubLogin
        ? {
            contributionDetails: {
              $type: "org.hypercerts.claim.activity#contributorRole",
              role: "contributor",
            },
          }
        : {}),
    })),
  };

  const activityResult = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: "org.hypercerts.claim.activity",
    record: activityRecord,
  });

  const activityRef = {
    uri: activityResult.data.uri,
    cid: activityResult.data.cid,
  };

  // ── 2. Create attachment record (evidence links) ─────────────────────────────

  const evidenceLines: string[] = [];
  if (payload.storachaRefs.evidenceBundleCid !== "unavailable") {
    evidenceLines.push(
      `Evidence Bundle (Storacha): https://${payload.storachaRefs.evidenceBundleCid}.ipfs.storacha.link/`
    );
  }
  if (payload.storachaRefs.adversarialLogCid !== "unavailable") {
    evidenceLines.push(
      `Adversarial Log (Signed Receipt): https://${payload.storachaRefs.adversarialLogCid}.ipfs.storacha.link/`
    );
  }
  payload.evidenceRefs.forEach((ref) => {
    evidenceLines.push(`${ref.label}: ${ref.url}`);
  });

  const attachmentRecord = {
    $type: "org.hypercerts.context.attachment",
    title: `Credence Evidence Bundle — ${payload.title.slice(0, 200)}`,
    shortDescription: toShortDescription(
      `Automated evidence collection and adversarial evaluation by Credence. ` +
        `Verified claims: ${payload.verifiedClaims.length}. ` +
        `Flagged claims: ${payload.flaggedClaims.length}. ` +
        `Confidence score: ${Math.round(payload.confidenceScore * 100)}%. ` +
        `Contributors: ${formatContributors(payload)}.`
    ),
    contentType: "evidence",
    content: payload.evidenceRefs
      .filter((r) => r.url.startsWith("http"))
      .slice(0, 10)
      .map((ref) => ({
        $type: "org.hypercerts.defs#uri",
        uri: ref.url,
        description: ref.label,
      })),
    subjects: [activityRef],
    createdAt: now,
  };

  const attachmentResult = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: "org.hypercerts.context.attachment",
    record: attachmentRecord,
  });

  // ── 3. Create evaluation record (Credence adversarial score) ─────────────────

  const confidenceInt = Math.round(payload.confidenceScore * 100);

  const evaluationRecord = {
    $type: "org.hypercerts.context.evaluation",
    subject: activityRef,
    summary: toShortDescription(
      `Credence autonomous evaluation: ${payload.evaluatorSummary}`
    ),
    evaluators: [did],
    score: {
      $type: "org.hypercerts.context.evaluation#score",
      min: 0,
      max: 100,
      value: confidenceInt,
    },
    measurements: [
      {
        uri: attachmentResult.data.uri,
        cid: attachmentResult.data.cid,
      },
    ],
    createdAt: now,
  };

  const evaluationResult = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: "org.hypercerts.context.evaluation",
    record: evaluationRecord,
  });

  // ── Extract rkey from URI for Hyperscan URL ──────────────────────────────────
  // URI format: at://did:plc:.../org.hypercerts.claim.activity/rkey
  const rkey = activityRef.uri.split("/").pop() ?? "";
  const hyperscanUrl = `https://www.hyperscan.dev/data?did=${encodeURIComponent(did)}&collection=org.hypercerts.claim.activity&rkey=${rkey}`;

  return {
    activityUri: activityRef.uri,
    activityCid: activityRef.cid,
    evaluationUri: evaluationResult.data.uri,
    evaluationCid: evaluationResult.data.cid,
    attachmentUri: attachmentResult.data.uri,
    attachmentCid: attachmentResult.data.cid,
    hyperscanUrl,
  };
}
