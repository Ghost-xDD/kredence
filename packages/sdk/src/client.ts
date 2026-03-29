import type {
  EcosystemInput,
  HypercertPayload,
  HypercertRegistry,
  HealthResponse,
  BadgeResponse,
  KredenceClientOptions,
  RunOptions,
} from "./types.js";
import { PipelineRun } from "./pipeline.js";

const DEFAULT_BASE_URL = "https://api.kredence.xyz";

/**
 * Client for the Kredence API.
 *
 * @example
 * ```ts
 * import { KredenceClient } from 'kredence';
 *
 * const client = new KredenceClient();
 *
 * // REST
 * const projects = await client.listProjects();
 *
 * // Live pipeline run
 * const run = client.run({ kind: 'manual', urls: ['https://github.com/owner/repo'] });
 * run.on('project_complete', (payload) => console.log(payload.title));
 * const summary = await run.completed();
 * ```
 */
export class KredenceClient {
  private baseUrl: string;
  private wsUrl: string;
  private WebSocketImpl: typeof globalThis.WebSocket | undefined;

  constructor(options: KredenceClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    // Derive the WS URL from the HTTP base URL
    this.wsUrl = this.baseUrl.replace(/^https?:\/\//, (match) =>
      match === "https://" ? "wss://" : "ws://"
    );
    this.WebSocketImpl = options.WebSocket;
  }

  // ── REST ────────────────────────────────────────────────────────────────

  /**
   * Check that the Kredence server is reachable and healthy.
   */
  async health(): Promise<HealthResponse> {
    return this._get<HealthResponse>("/health");
  }

  /**
   * List all evaluated projects in the registry.
   * Returns compact summary entries — use `getProject()` for the full payload.
   */
  async listProjects(): Promise<HypercertRegistry> {
    return this._get<HypercertRegistry>("/projects");
  }

  /**
   * Fetch the full `HypercertPayload` for a project by slug.
   *
   * @param slug - URL-safe project identifier (visible in `RegistryEntry.slug`)
   * @throws if the project is not found (404) or Storacha fetch fails (502)
   */
  async getProject(slug: string): Promise<HypercertPayload> {
    return this._get<HypercertPayload>(`/projects/${encodeURIComponent(slug)}`);
  }

  /**
   * Fetch the shields.io-compatible badge data for a project.
   * Embed with: `https://img.shields.io/endpoint?url=https://api.kredence.xyz/badge/{slug}`
   */
  async getBadge(slug: string): Promise<BadgeResponse> {
    return this._get<BadgeResponse>(`/badge/${encodeURIComponent(slug)}`);
  }

  // ── WebSocket ───────────────────────────────────────────────────────────

  /**
   * Start an autonomous evaluation pipeline run.
   *
   * Opens a WebSocket connection to the server, sends the ecosystem input,
   * and returns a `PipelineRun` you can listen to or iterate over.
   *
   * @example
   * ```ts
   * // Event interface
   * const run = client.run({ kind: 'gitcoin', roundId: '0x...' }, { maxProjects: 5 });
   * run.on('project_complete', (payload) => console.log(payload.title, payload.confidenceScore));
   * run.on('pipeline_done', (summary) => console.log('done', summary));
   *
   * // Promise interface
   * const summary = await run.completed();
   *
   * // Async iterable
   * for await (const event of run) {
   *   if (event.type === 'project_complete') console.log(event.payload.title);
   * }
   * ```
   */
  run(input: EcosystemInput, options: RunOptions = {}): PipelineRun {
    const wsUrl = `${this.wsUrl}/ws`;
    return new PipelineRun(wsUrl, input, options, this.WebSocketImpl);
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private async _get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { error?: string; detail?: string };
        detail = body.error ?? body.detail ?? "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      throw new KredenceError(
        `${res.status} ${res.statusText}${detail ? `: ${detail}` : ""}`,
        res.status
      );
    }
    return res.json() as Promise<T>;
  }
}

/**
 * Error thrown by `KredenceClient` REST methods when the server returns
 * a non-2xx status code.
 */
export class KredenceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "KredenceError";
  }
}
