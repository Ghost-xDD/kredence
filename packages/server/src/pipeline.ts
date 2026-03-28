/**
 * Pipeline runner with WebSocket event streaming.
 *
 * Wraps the four-agent pipeline (Scout → Evidence → Adversarial → Synthesis)
 * and emits structured ServerMessages for every AgentLogEntry so the client
 * can render the run in real time.
 */
import type { AdversarialLog, AgentLogEntry, AgentRole, EcosystemInput, HypercertPayload, ProjectRecord, RegistryEntry } from "@credence/types";
import {
  runScoutAgent,
  runEvidenceAgent,
  runAdversarialAgent,
  runSynthesisAgent,
} from "@credence/agents";
import { updateRegistry } from "@credence/storage";
import type { ServerMessage, PipelineSummary } from "./ws-types.js";
import { getRegistryCid, setRegistry, getRegistry } from "./registry-store.js";

export type EmitFn = (msg: ServerMessage) => void;

/**
 * Converts a raw AgentLogEntry into one or more structured ServerMessages
 * and emits them via the provided emit function.
 */
function makeOnEntry(runId: string, agent: AgentRole, emit: EmitFn) {
  return (entry: AgentLogEntry): void => {
    // Tool call start — action pattern: "tool:{name}:start"
    if (entry.action.endsWith(":start") && entry.details?.["input"] !== undefined) {
      const tool = entry.action.replace(/^tool:/, "").replace(/:start$/, "");
      emit({
        type: "tool_call",
        runId,
        agent,
        phase: entry.phase,
        tool,
        input: entry.details["input"],
      });
      return;
    }

    // Tool call done — action pattern: "tool:{name}:done"
    if (entry.toolCall && entry.action.endsWith(":done")) {
      emit({
        type: "tool_done",
        runId,
        agent,
        phase: entry.phase,
        tool: entry.toolCall.tool,
        output: entry.toolCall.output,
        durationMs: entry.toolCall.durationMs ?? 0,
      });
      return;
    }

    // Tool call error — action pattern: "tool:{name}:error"
    if (entry.toolCall && entry.action.endsWith(":error")) {
      emit({
        type: "tool_error",
        runId,
        agent,
        phase: entry.phase,
        tool: entry.toolCall.tool,
        error: entry.toolCall.error ?? "unknown error",
        durationMs: entry.toolCall.durationMs ?? 0,
      });
      return;
    }

    // Regular log entry
    emit({ type: "log", runId, agent, entry });
  };
}

export async function runPipeline(
  runId: string,
  input: EcosystemInput,
  maxProjects: number,
  emit: EmitFn
): Promise<void> {
  const startMs = Date.now();
  emit({ type: "pipeline_start", runId, ecosystem: input.kind });

  try {
    // ── Stage 1: Scout ─────────────────────────────────────────────────────
    emit({ type: "stage_start", runId, stage: "scout" });
    const manifest = await runScoutAgent(input, makeOnEntry(runId, "scout", emit));
    emit({ type: "stage_done", runId, stage: "scout" });

    // Filter to projects with at least one GitHub source + one website source
    const selected = manifest.projects
      .filter(
        (p) =>
          p.sources.some((s: { type: string; url: string }) => s.type === "github") &&
          p.sources.some((s: { type: string; url: string }) => s.type === "website")
      )
      .slice(0, maxProjects);

    const trimmedManifest = { ...manifest, projects: selected };

    // ── Stage 2: Evidence ──────────────────────────────────────────────────
    emit({ type: "stage_start", runId, stage: "evidence" });
    const evidenceResult = await runEvidenceAgent(
      trimmedManifest,
      makeOnEntry(runId, "evidence", emit)
    );
    emit({ type: "stage_done", runId, stage: "evidence" });

    // ── Stage 3: Adversarial ───────────────────────────────────────────────
    emit({ type: "stage_start", runId, stage: "adversarial" });
    const adversarialResult = await runAdversarialAgent(
      evidenceResult,
      makeOnEntry(runId, "adversarial", emit)
    );
    emit({ type: "stage_done", runId, stage: "adversarial" });

    // ── Stage 4: Synthesis ─────────────────────────────────────────────────
    emit({ type: "stage_start", runId, stage: "synthesis" });
    const synthesisResult = await runSynthesisAgent(
      { evidenceResult, adversarialResult },
      makeOnEntry(runId, "synthesis", emit)
    );
    emit({ type: "stage_done", runId, stage: "synthesis" });

    // Emit each completed hypercert
    for (const payload of synthesisResult.payloads) {
      if (payload) {
        emit({ type: "project_complete", runId, payload });
      }
    }

    // ── Persist registry ───────────────────────────────────────────────────
    const newEntries: RegistryEntry[] = synthesisResult.payloads
      .filter((p): p is HypercertPayload => !!p && !!p.storachaRefs.hypercertPayloadCid)
      .map((p) => ({
        slug: p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        cid:  p.storachaRefs.hypercertPayloadCid!,
        title: p.title,
        description: p.description,
        confidenceScore: p.confidenceScore,
        verifiedCount:  p.verifiedClaims.length,
        flaggedCount:   p.flaggedClaims.length,
        unresolvedCount: p.openQuestions.length,
        impactCategory: p.impactCategory,
        workScopes: p.workScopes,
        contributors: p.contributors.map((c) => c.name),
        hasAtproto: !!p.atproto,
        atprotoUrl: p.atproto?.hyperscanUrl,
        runId,
        evaluatedAt: p.generatedAt,
      }));

    if (newEntries.length > 0) {
      try {
        const newCid = await updateRegistry(getRegistryCid(), newEntries);
        const existing = getRegistry();
        const slugSet = new Set(newEntries.map((e) => e.slug));
        setRegistry(
          {
            updatedAt: new Date().toISOString(),
            entries: [
              ...existing.entries.filter((e) => !slugSet.has(e.slug)),
              ...newEntries,
            ],
          },
          newCid
        );
        console.log(`[pipeline][${runId}] registry updated — CID: ${newCid}`);
      } catch (err) {
        console.error(`[pipeline][${runId}] registry update failed:`, err);
      }
    }

    // Final summary
    const totalVerified   = adversarialResult.logs.reduce((s: number, l: AdversarialLog) => s + l.verifiedCount, 0);
    const totalFlagged    = adversarialResult.logs.reduce((s: number, l: AdversarialLog) => s + l.flaggedCount, 0);
    const totalUnresolved = adversarialResult.logs.reduce((s: number, l: AdversarialLog) => s + l.unresolvedCount, 0);

    const summary: PipelineSummary = {
      projectsEvaluated:  selected.length,
      hypercertsStored:   synthesisResult.projects.filter((p: ProjectRecord) => p.hypercertPayloadCid).length,
      atprotoPublished:   synthesisResult.payloads.filter((p: HypercertPayload | undefined) => p?.atproto).length,
      totalVerified,
      totalFlagged,
      totalUnresolved,
      durationMs: Date.now() - startMs,
    };

    emit({ type: "pipeline_done", runId, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline][${runId}] failed:`, message);
    emit({ type: "pipeline_error", runId, stage: "unknown", message });
  }
}
