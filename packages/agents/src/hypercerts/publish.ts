/**
 * Publish a HypercertPayload to the real Hypercerts AT Protocol network.
 *
 * Uses raw fetch against ATProto XRPC endpoints — no @atproto/api dependency,
 * which avoids the multiformats ESM/CJS conflict with @storacha/client.
 *
 * Records created per project:
 *   1. org.hypercerts.claim.activity    — the main impact claim
 *   2. org.hypercerts.context.attachment — evidence links (Storacha CIDs)
 *   3. org.hypercerts.context.evaluation — Kredence adversarial score
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

async function createSession(): Promise<AtpSession> {
  const handle = process.env["HYPERCERTS_HANDLE"];
  const password = process.env["HYPERCERTS_APP_PASSWORD"];
  if (!handle || !password) throw new Error("HYPERCERTS_HANDLE/APP_PASSWORD not set");

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
  return { did: data.did, accessJwt: data.accessJwt };
}

async function getSession(): Promise<AtpSession | null> {
  const handle = process.env["HYPERCERTS_HANDLE"];
  const password = process.env["HYPERCERTS_APP_PASSWORD"];
  if (!handle || !password) return null;

  if (!_session) {
    _session = await createSession();
  }
  return _session;
}

/** Clear cached session so next call forces a fresh login. */
function invalidateSession(): void {
  _session = null;
}

async function xrpcPost(
  endpoint: string,
  body: Record<string, unknown>,
  label: string
): Promise<{ uri: string; cid: string }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const session = await getSession();
    if (!session) throw new Error("ATProto credentials not configured");

    const res = await fetch(`${PDS}/xrpc/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({ repo: session.did, ...body }),
    });

    if (!res.ok) {
      const text = await res.text();
      // Expired token — invalidate session and retry once with a fresh login
      if (attempt === 1 && (text.includes("ExpiredToken") || res.status === 401)) {
        invalidateSession();
        continue;
      }
      throw new Error(`${label} failed (${res.status}): ${text}`);
    }

    return (await res.json()) as { uri: string; cid: string };
  }
  throw new Error(`${label}: exhausted retries`);
}

async function createRecord(
  _session: AtpSession,
  collection: string,
  record: Record<string, unknown>
): Promise<{ uri: string; cid: string }> {
  return xrpcPost("com.atproto.repo.createRecord", {
    collection,
    record: { $type: collection, ...record },
  }, `createRecord(${collection})`);
}

/**
 * Overwrite an existing ATProto record in-place (same rkey → same AT URI,
 * new CID). Used to migrate already-published activity records to the
 * current schema without changing their canonical identifier.
 */
async function putRecord(
  _session: AtpSession,
  collection: string,
  rkey: string,
  record: Record<string, unknown>
): Promise<{ uri: string; cid: string }> {
  return xrpcPost("com.atproto.repo.putRecord", {
    collection,
    rkey,
    record: { $type: collection, ...record },
  }, `putRecord(${collection}/${rkey})`);
}

/** Truncate to ATProto shortDescription limit (300 graphemes). */
function shortDesc(text: string): string {
  const graphemes = [...text];
  if (graphemes.length <= 290) return text;
  return graphemes.slice(0, 287).join("") + "...";
}

/**
 * Truncate a string at a word boundary (comma or space) within `max` chars.
 * Avoids cutting mid-word the way a raw .slice(0, N) would.
 */
function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const candidate = s.slice(0, max);
  const lastComma = candidate.lastIndexOf(",");
  const lastSpace = candidate.lastIndexOf(" ");
  const cut = lastComma > 0 ? lastComma : lastSpace > 0 ? lastSpace : max;
  return s.slice(0, cut);
}

/** Build the rich `description` field for the activity record. */
function buildDescription(payload: HypercertPayload): string {
  const refs = payload.storachaRefs;
  const hasCids =
    refs.evidenceBundleCid !== "unavailable" ||
    refs.adversarialLogCid !== "unavailable" ||
    (refs.hypercertPayloadCid && refs.hypercertPayloadCid !== "unavailable");

  const lines: string[] = [
    `Kredence autonomous evaluation of ${payload.title}.`,
    "",
    "Evaluation Summary",
    payload.evaluatorSummary,
    "",
    "Results",
    `  Verified claims:  ${payload.verifiedClaims.length}`,
    `  Flagged claims:   ${payload.flaggedClaims.length}`,
    `  Open questions:   ${payload.openQuestions.length}`,
    `  Confidence:       ${Math.round(payload.confidenceScore * 100)}%`,
  ];

  if (payload.verifiedClaims.length > 0) {
    lines.push("", "Verified");
    for (const c of payload.verifiedClaims.slice(0, 5)) {
      lines.push(`  ✓ ${c.text}`);
    }
    if (payload.verifiedClaims.length > 5) {
      lines.push(`  … and ${payload.verifiedClaims.length - 5} more`);
    }
  }

  if (payload.flaggedClaims.length > 0) {
    lines.push("", "Flagged");
    for (const c of payload.flaggedClaims.slice(0, 5)) {
      lines.push(`  ✗ ${c.text}`);
      lines.push(`    ${c.objection}`);
    }
    if (payload.flaggedClaims.length > 5) {
      lines.push(`  … and ${payload.flaggedClaims.length - 5} more`);
    }
  }

  if (hasCids) {
    lines.push("", "Evidence (Storacha / IPFS)");
    if (refs.evidenceBundleCid && refs.evidenceBundleCid !== "unavailable") {
      lines.push(`  Evidence bundle CID: ${refs.evidenceBundleCid}`);
      lines.push(`  https://${refs.evidenceBundleCid}.ipfs.storacha.link/`);
    }
    if (refs.adversarialLogCid && refs.adversarialLogCid !== "unavailable") {
      lines.push(`  Adversarial log CID: ${refs.adversarialLogCid}`);
      lines.push(`  https://${refs.adversarialLogCid}.ipfs.storacha.link/`);
    }
    if (refs.hypercertPayloadCid && refs.hypercertPayloadCid !== "unavailable") {
      lines.push(`  Payload CID: ${refs.hypercertPayloadCid}`);
      lines.push(`  https://${refs.hypercertPayloadCid}.ipfs.storacha.link/`);
    }
  }

  if (payload.evaluatedBy.length > 0) {
    lines.push("", "Evaluated by");
    for (const e of payload.evaluatedBy) {
      lines.push(`  ${e.agentId} (${e.role})`);
    }
  }

  lines.push("", `Protocol: Kredence | kredence.xyz`);
  lines.push(`Generated: ${payload.generatedAt}`);

  return lines.join("\n");
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
  const confidence = Math.round(payload.confidenceScore * 100);

  // ── 1. Main activity claim ───────────────────────────────────────────────────

  const activityResult = await createRecord(session, "org.hypercerts.claim.activity", {
    title: payload.title.slice(0, 256),
    shortDescription: shortDesc(
      `${payload.verifiedClaims.length} verified, ${payload.flaggedClaims.length} flagged` +
      ` — confidence ${confidence}% — Kredence`
    ),
    description: buildDescription(payload),
    createdAt: now,
    startDate: new Date(payload.timeframeStart).toISOString(),
    endDate: new Date(payload.timeframeEnd).toISOString(),
    workScope: {
      $type: "org.hypercerts.claim.activity#workScopeString",
      scope: truncateAtWord(payload.workScopes.join(", "), 200),
    },
    contributors: payload.contributors.slice(0, 50).map((c) => ({
      contributionWeight: "1",
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
      title: `Kredence Evidence Bundle — ${payload.title.slice(0, 200)}`,
      shortDescription: shortDesc(
        `Kredence agent evaluation. ` +
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
      summary: shortDesc(`Kredence autonomous evaluation: ${payload.evaluatorSummary}`),
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

/**
 * Update an already-published activity record in-place using putRecord.
 *
 * The AT URI (and rkey) stay identical — only the record content and its
 * CID change. Existing attachment and evaluation records are left untouched.
 *
 * Requires payload.atproto to be populated (i.e. the record was previously
 * published by publishHypercert).
 *
 * Returns the new CID of the updated activity record, or null if credentials
 * are missing or atproto refs are absent.
 */
export async function updateHypercert(
  payload: HypercertPayload
): Promise<{ activityUri: string; activityCid: string } | null> {
  if (!payload.atproto) return null;

  const session = await getSession();
  if (!session) return null;

  const rkey = payload.atproto.activityUri.split("/").pop();
  if (!rkey) throw new Error(`Cannot extract rkey from URI: ${payload.atproto.activityUri}`);

  const confidence = Math.round(payload.confidenceScore * 100);

  const result = await putRecord(session, "org.hypercerts.claim.activity", rkey, {
    title: payload.title.slice(0, 256),
    shortDescription: shortDesc(
      `${payload.verifiedClaims.length} verified, ${payload.flaggedClaims.length} flagged` +
      ` — confidence ${confidence}% — Kredence`
    ),
    description: buildDescription(payload),
    createdAt: payload.atproto.activityCid
      ? new Date().toISOString()  // keep a fresh updatedAt-style timestamp
      : new Date().toISOString(),
    startDate: new Date(payload.timeframeStart).toISOString(),
    endDate: new Date(payload.timeframeEnd).toISOString(),
    workScope: {
      $type: "org.hypercerts.claim.activity#workScopeString",
      scope: truncateAtWord(payload.workScopes.join(", "), 200),
    },
    contributors: payload.contributors.slice(0, 50).map((c) => ({
      contributionWeight: "1",
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

  return { activityUri: result.uri, activityCid: result.cid };
}
