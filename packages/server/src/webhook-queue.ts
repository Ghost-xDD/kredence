/**
 * Lightweight async job queue for webhook-triggered pipeline runs.
 *
 * Prevents concurrent pipeline runs from overloading the server.
 * Jobs are processed FIFO with a configurable concurrency limit (default: 1).
 */
import { nanoid } from "nanoid";
import { runPipeline } from "./pipeline.js";
import { getInstallationOctokit, parseRepo, writeHypercertJson, openBadgePr } from "./github-app.js";
import { getRegistry } from "./registry-store.js";

export type WebhookJob = {
  owner: string;
  repo: string;
  /** GitHub App installation ID — needed to authenticate write-back calls */
  installationId: number;
  /** e.g. "milestone.closed" or "release.published" */
  event: string;
};

const queue: WebhookJob[] = [];
let running = 0;
const CONCURRENCY = 1;

/** Add a job to the queue. Processing starts immediately if a slot is free. */
export function enqueueWebhookJob(job: WebhookJob): void {
  queue.push(job);
  console.log(`[webhook-queue] enqueued ${job.owner}/${job.repo} (${job.event}) — queue depth: ${queue.length}`);
  void processNext();
}

async function processNext(): Promise<void> {
  if (running >= CONCURRENCY || queue.length === 0) return;

  const job = queue.shift()!;
  running++;

  const repoUrl = `https://github.com/${job.owner}/${job.repo}`;
  const runId = nanoid();

  console.log(`[webhook-queue][${runId}] starting pipeline for ${repoUrl}`);

  try {
    await runPipeline(
      runId,
      { kind: "github-repo", repoUrl, installationId: job.installationId },
      1,
      (msg) => {
        // Log significant events; no WebSocket to stream to for webhook runs
        if (msg.type === "stage_start" || msg.type === "stage_done" || msg.type === "pipeline_error") {
          console.log(`[webhook-queue][${runId}]`, JSON.stringify(msg));
        }
      }
    );

    console.log(`[webhook-queue][${runId}] pipeline complete — starting write-back`);
    await writeBack(job, runId);
  } catch (err) {
    console.error(`[webhook-queue][${runId}] pipeline failed:`, err);
  } finally {
    running--;
    void processNext();
  }
}

async function writeBack(job: WebhookJob, runId: string): Promise<void> {
  const repoUrl = `https://github.com/${job.owner}/${job.repo}`;
  const parsed = parseRepo(repoUrl);
  if (!parsed) {
    console.warn(`[webhook-queue][${runId}] could not parse repo from ${repoUrl}`);
    return;
  }

  // Find the registry entry produced by this specific run (slug = project title,
  // NOT the repo name — so we match by runId which is always exact).
  const entry = getRegistry().entries.find((e) => e.runId === runId);
  if (!entry) {
    console.warn(`[webhook-queue][${runId}] no registry entry found for runId — skipping write-back`);
    return;
  }

  const octokit = await getInstallationOctokit(job.installationId);
  if (!octokit) {
    console.warn(`[webhook-queue][${runId}] GitHub App not configured — skipping write-back`);
    return;
  }

  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://kredence.xyz";

  try {
    // Fetch full payload from registry to write back to repo
    const { retrieveJSON } = await import("@credence/storage");
    const payload = await retrieveJSON(entry.cid, entry.filename);

    const fileUrl = await writeHypercertJson(octokit, parsed.owner, parsed.repo, payload as never);
    console.log(`[webhook-queue][${runId}] wrote .hypercert.json → ${fileUrl}`);

    const prUrl = await openBadgePr(octokit, parsed.owner, parsed.repo, entry.slug, appUrl);
    if (prUrl) {
      console.log(`[webhook-queue][${runId}] badge PR → ${prUrl}`);
    }
  } catch (err) {
    console.error(`[webhook-queue][${runId}] write-back failed:`, err);
  }
}
