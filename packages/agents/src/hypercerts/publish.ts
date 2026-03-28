/**
 * Publish a HypercertPayload to the real Hypercerts AT Protocol network.
 *
 * Uses raw fetch against ATProto XRPC endpoints — no @atproto/api dependency,
 * which avoids the multiformats ESM/CJS conflict with @storacha/client.
 *
 * Records created per project:
 *   1. org.hypercerts.claim.activity    — the main impact claim
 *   2. org.hypercerts.context.attachment — evidence links (Storacha CIDs)
 *   3. org.hypercerts.context.evaluation — Credence adversarial score
 *
 * Auth: ATProto app password
 *   HYPERCERTS_HANDLE       e.g. credence-agent.bsky.social
 *   HYPERCERTS_APP_PASSWORD e.g. xxxx-xxxx-xxxx-xxxx
 *
 * If credentials are missing the function returns null gracefully.
 */

import type { HypercertPayload } from "@credence/types";

const PDS = "https://bsky.social";

export type AtProtoRefs = {
  activityUri: string;
  activityCid: string;
  evaluationUri: string;
  evaluationCid: string;
  attachmentUri: string;
  attachmentCid: string;
  hyperscanUrl: string;
};

type AtpSession = {
  did: string;
  accessJwt: string;
};

let _session: AtpSession | null = null;

async function getSession(): Promise<AtpSession | null> {
  if (_session) return _session;

  const handle = process.env["HYPERCERTS_HANDLE"];
  const password = process.env["HYPERCERTS_APP_PASSWORD"];
  if (!handle || !password) return null;

  const res = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: handle, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ATProto login failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { did: string; accessJwt: string };
  _session = { did: data.did, accessJwt: data.accessJwt };
  return _session;
}

async function createRecord(
  session: AtpSession,
  collection: string,
  record: Record<string, unknown>
): Promise<{ uri: string; cid: string }> {
  const res = await fetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection,
      record: { $type: collection, ...record },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createRecord(${collection}) failed (${res.status}): ${text}`);
  }

  return (await res.json()) as { uri: string; cid: string };
}

/** Truncate to ATProto shortDescription limit (300 graphemes). */
function shortDesc(text: string): string {
  const graphemes = [...text];
  if (graphemes.length <= 290) return text;
  return graphemes.slice(0, 287).join("") + "...";
}

/**
 * Publish a single HypercertPayload to the AT Protocol Hypercerts network.
 * Returns ATProto URIs/CIDs for all created records, or null if credentials
 * are not configured.
 */
export async function publishHypercert(
  payload: HypercertPayload
): Promise<AtProtoRefs | null> {
  const session = await getSession();
  if (!session) return null;

  const now = new Date().toISOString();

  // ── 1. Main activity claim ───────────────────────────────────────────────────

  const activityResult = await createRecord(session, "org.hypercerts.claim.activity", {
    title: payload.title.slice(0, 256),
    shortDescription: shortDesc(payload.evaluatorSummary),
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
      contributionDetails: {
        $type: "org.hypercerts.claim.activity#contributorRole",
        role: "contributor",
      },
    })),
  });

  const activityRef = { uri: activityResult.uri, cid: activityResult.cid };

  // ── 2. Attachment record (evidence links) ────────────────────────────────────

  const evidenceUris = [
    ...(payload.storachaRefs.evidenceBundleCid !== "unavailable"
      ? [
          {
            $type: "org.hypercerts.defs#uri",
            uri: `https://${payload.storachaRefs.evidenceBundleCid}.ipfs.storacha.link/`,
          },
        ]
      : []),
    ...(payload.storachaRefs.adversarialLogCid !== "unavailable"
      ? [
          {
            $type: "org.hypercerts.defs#uri",
            uri: `https://${payload.storachaRefs.adversarialLogCid}.ipfs.storacha.link/`,
          },
        ]
      : []),
  ];

  const attachmentResult = await createRecord(
    session,
    "org.hypercerts.context.attachment",
    {
      title: `Credence Evidence Bundle — ${payload.title.slice(0, 200)}`,
      shortDescription: shortDesc(
        `Credence agent evaluation. ` +
          `Verified: ${payload.verifiedClaims.length}. ` +
          `Flagged: ${payload.flaggedClaims.length}. ` +
          `Confidence: ${Math.round(payload.confidenceScore * 100)}%.`
      ),
      contentType: "evidence",
      content: evidenceUris,
      subjects: [activityRef],
      createdAt: now,
    }
  );

  // ── 3. Evaluation record (adversarial score) ─────────────────────────────────

  const evaluationResult = await createRecord(
    session,
    "org.hypercerts.context.evaluation",
    {
      subject: activityRef,
      summary: shortDesc(`Credence autonomous evaluation: ${payload.evaluatorSummary}`),
      evaluators: [session.did],
      score: {
        $type: "org.hypercerts.context.evaluation#score",
        min: 0,
        max: 100,
        value: Math.round(payload.confidenceScore * 100),
      },
      measurements: [{ uri: attachmentResult.uri, cid: attachmentResult.cid }],
      createdAt: now,
    }
  );

  // ── Hyperscan URL ────────────────────────────────────────────────────────────
  const rkey = activityRef.uri.split("/").pop() ?? "";
  const hyperscanUrl = `https://www.hyperscan.dev/data?did=${encodeURIComponent(session.did)}&collection=org.hypercerts.claim.activity&rkey=${rkey}`;

  return {
    activityUri: activityRef.uri,
    activityCid: activityRef.cid,
    evaluationUri: evaluationResult.uri,
    evaluationCid: evaluationResult.cid,
    attachmentUri: attachmentResult.uri,
    attachmentCid: attachmentResult.cid,
    hyperscanUrl,
  };
}
