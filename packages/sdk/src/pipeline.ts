import type { HypercertPayload } from "@credence/types";
import { TypedEmitter } from "./emitter.js";
import type { EcosystemInput } from "./types.js";
import type { ServerMessage, PipelineSummary, RunOptions } from "./types.js";

type PipelineEvents = {
  /** Server is connected and ready to accept a run command. */
  ready: { serverVersion: string };
  /** Pipeline has started processing. */
  pipeline_start: { runId: string; ecosystem: string };
  /** An agent stage has begun. */
  stage_start: { runId: string; stage: string };
  /** An agent stage has completed. */
  stage_done: { runId: string; stage: string };
  /** A structured log entry from an agent. */
  log: Extract<ServerMessage, { type: "log" }>;
  /** An agent tool call has started. */
  tool_call: Extract<ServerMessage, { type: "tool_call" }>;
  /** An agent tool call succeeded. */
  tool_done: Extract<ServerMessage, { type: "tool_done" }>;
  /** An agent tool call failed. */
  tool_error: Extract<ServerMessage, { type: "tool_error" }>;
  /** One project has been fully evaluated. */
  project_complete: HypercertPayload;
  /** The pipeline finished successfully. */
  pipeline_done: PipelineSummary;
  /** The pipeline failed. */
  pipeline_error: { stage: string; message: string };
  /** Any raw server message (useful for debugging). */
  message: ServerMessage;
  /** Fatal connection or protocol error. */
  error: Error;
  /** The WebSocket connection closed. */
  close: { code: number; reason: string };
};

/**
 * A live pipeline run connected to the Kredence server over WebSocket.
 *
 * Implements `AsyncIterable<ServerMessage>` so you can consume events with
 * `for await … of` in addition to the `.on()` event interface.
 *
 * @example
 * ```ts
 * const run = client.run({ kind: 'manual', urls: ['https://github.com/...'] });
 * run.on('project_complete', (payload) => console.log(payload.title));
 * const summary = await run.completed();
 * ```
 */
export class PipelineRun
  extends TypedEmitter<PipelineEvents>
  implements AsyncIterable<ServerMessage>
{
  readonly runId: string | undefined;

  private ws: WebSocket;
  private _input: EcosystemInput;
  private _maxProjects: number;

  // Async iterable queue
  private _queue: ServerMessage[] = [];
  private _resolvers: Array<(result: IteratorResult<ServerMessage>) => void> = [];
  private _iterDone = false;

  // Completion promise
  private _donePromise: Promise<PipelineSummary>;
  private _doneResolve!: (s: PipelineSummary) => void;
  private _doneReject!: (e: Error) => void;

  constructor(
    wsUrl: string,
    input: EcosystemInput,
    options: RunOptions = {},
    WebSocketImpl?: typeof globalThis.WebSocket
  ) {
    super();

    this._input = input;
    this._maxProjects = options.maxProjects ?? 3;

    this._donePromise = new Promise<PipelineSummary>((res, rej) => {
      this._doneResolve = res;
      this._doneReject = rej;
    });
    // Prevent unhandled rejection when the caller uses the event interface only
    this._donePromise.catch(() => undefined);

    const WS = WebSocketImpl ?? globalThis.WebSocket;
    if (!WS) {
      throw new Error(
        "WebSocket is not available in this environment. " +
          "Pass a WebSocket implementation via KredenceClientOptions.WebSocket, e.g.:\n" +
          "  import WebSocket from 'ws';\n" +
          "  new KredenceClient({ WebSocket })"
      );
    }

    this.ws = new WS(wsUrl);

    this.ws.onmessage = (event: MessageEvent<string>) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      // Feed async iterable consumers
      this._push(msg);

      // Emit raw message event
      this.emit("message", msg);

      // Dispatch typed events
      switch (msg.type) {
        case "ready":
          this.emit("ready", { serverVersion: msg.serverVersion });
          // Start the run now that the server is ready
          this.ws.send(
            JSON.stringify({
              type: "run",
              payload: this._input,
              maxProjects: this._maxProjects,
            })
          );
          break;

        case "pipeline_start":
          this.emit("pipeline_start", { runId: msg.runId, ecosystem: msg.ecosystem });
          break;

        case "stage_start":
          this.emit("stage_start", { runId: msg.runId, stage: msg.stage });
          break;

        case "stage_done":
          this.emit("stage_done", { runId: msg.runId, stage: msg.stage });
          break;

        case "log":
          this.emit("log", msg);
          break;

        case "tool_call":
          this.emit("tool_call", msg);
          break;

        case "tool_done":
          this.emit("tool_done", msg);
          break;

        case "tool_error":
          this.emit("tool_error", msg);
          break;

        case "project_complete":
          this.emit("project_complete", msg.payload);
          break;

        case "pipeline_done":
          this.emit("pipeline_done", msg.summary);
          this._doneResolve(msg.summary);
          this._closeIter();
          break;

        case "pipeline_error": {
          const err = new Error(`[${msg.stage}] ${msg.message}`);
          this.emit("pipeline_error", { stage: msg.stage, message: msg.message });
          this._doneReject(err);
          this._closeIterWithError(err);
          break;
        }
      }
    };

    this.ws.onerror = () => {
      const err = new Error("WebSocket connection error");
      this.emit("error", err);
      this._doneReject(err);
      this._closeIterWithError(err);
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.emit("close", { code: event.code, reason: event.reason });
      if (!this._iterDone) {
        const err = new Error(`WebSocket closed unexpectedly (code ${event.code})`);
        this._doneReject(err);
        this._closeIterWithError(err);
      }
    };
  }

  /**
   * Resolves with the pipeline summary when the run completes successfully,
   * or rejects if the run fails or the connection drops.
   */
  completed(): Promise<PipelineSummary> {
    return this._donePromise;
  }

  /** Close the connection early. */
  abort(): void {
    this.ws.close(1000, "aborted");
  }

  // ── AsyncIterable implementation ────────────────────────────────────────

  [Symbol.asyncIterator](): AsyncIterator<ServerMessage> {
    return {
      next: (): Promise<IteratorResult<ServerMessage>> => {
        if (this._queue.length > 0) {
          return Promise.resolve({ value: this._queue.shift()!, done: false });
        }
        if (this._iterDone) {
          return Promise.resolve({ value: undefined as never, done: true });
        }
        return new Promise<IteratorResult<ServerMessage>>((resolve) => {
          this._resolvers.push(resolve);
        });
      },
      return: (): Promise<IteratorResult<ServerMessage>> => {
        this._closeIter();
        return Promise.resolve({ value: undefined as never, done: true });
      },
    };
  }

  private _push(msg: ServerMessage): void {
    if (this._iterDone) return;
    if (this._resolvers.length > 0) {
      this._resolvers.shift()!({ value: msg, done: false });
    } else {
      this._queue.push(msg);
    }
  }

  private _closeIter(): void {
    this._iterDone = true;
    for (const resolve of this._resolvers) {
      resolve({ value: undefined as never, done: true });
    }
    this._resolvers = [];
  }

  private _closeIterWithError(err: Error): void {
    this._iterDone = true;
    for (const resolve of this._resolvers) {
      resolve({ value: undefined as never, done: true });
    }
    this._resolvers = [];
    // Ensure callers using for-await get the error surfaced via pipeline_error event
    void err;
  }
}
