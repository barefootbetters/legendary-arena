/**
 * Live boardgame.io client factory — the single runtime engine-import site
 * in apps/arena-client/.
 *
 * The sole runtime import of `@legendary-arena/game-engine` lives here so
 * that every other file in arena-client remains a `import type` consumer.
 * Grep verification in WP-090 Commit A verifies this invariant.
 *
 * The factory returns a narrow handle exposing exactly three methods:
 * `start()`, `stop()`, and `submitMove(name, ...args)`. The underlying
 * boardgame.io Client, its subscribe mechanism, and its moves bag are
 * intentionally not re-exported — every future gameplay UI packet must go
 * through `submitMove` for intent submission.
 */

import { LegendaryGame } from '@legendary-arena/game-engine';
import type { UIState } from '@legendary-arena/game-engine';
// why: boardgame.io v0.50 ships proxy-directory entries (`client/`,
// `multiplayer/`) whose `package.json` points to CJS via the `main` field
// and ESM via the (non-standard) `module` field. Under Vite this worked
// historically, but Node's native ESM resolver (and tsx by extension)
// rejects the directory import and fails to locate named bindings on the
// loose ESM artifact. Importing from the published CJS bundle via a
// namespace import (`import * as pkg`) sidesteps both CJS↔ESM interop
// quirks uniformly: tsx receives the CJS `module.exports` object under
// `pkg.default`; Vite receives the same object as `pkg` itself (its
// `__esModule: true` interop shim otherwise collapses the default lookup
// to undefined because this package sets `__esModule` but exports
// `Client` as a named property, not as `default`). Reading through the
// fallback chain `(pkg as any).Client ?? pkg.default?.Client` covers both.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — boardgame.io v0.50 ships no .d.ts alongside the dist CJS bundle.
import * as boardgameioClient from 'boardgame.io/dist/cjs/client.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — boardgame.io v0.50 ships no .d.ts alongside the dist CJS bundle.
import * as boardgameioMultiplayer from 'boardgame.io/dist/cjs/multiplayer.js';

type ClientCtor = (args: BgioClientFactoryArgs) => BgioClientLike;
type SocketIOCtor = (opts: { server: string }) => unknown;

// why: `pkg.Client` is the direct property set by the CJS bundle;
// `pkg.default.Client` is the path Vite's interop exposes when it rewrites
// the default import through `__esModule`. One of the two is always the
// callable constructor across tsx / Node / Vite runtimes.
const bgioClientNs = boardgameioClient as unknown as {
  Client?: ClientCtor;
  default?: { Client?: ClientCtor };
};
const bgioMultiplayerNs = boardgameioMultiplayer as unknown as {
  SocketIO?: SocketIOCtor;
  default?: { SocketIO?: SocketIOCtor };
};

const resolvedClient: ClientCtor | undefined =
  bgioClientNs.Client ?? bgioClientNs.default?.Client;
const resolvedSocketIO: SocketIOCtor | undefined =
  bgioMultiplayerNs.SocketIO ?? bgioMultiplayerNs.default?.SocketIO;

if (resolvedClient === undefined) {
  throw new Error(
    'boardgame.io Client constructor could not be resolved from the CJS bundle. ' +
      'Check that boardgame.io v0.50 is installed and that the dist path has not changed.',
  );
}
if (resolvedSocketIO === undefined) {
  throw new Error(
    'boardgame.io SocketIO transport could not be resolved from the CJS bundle. ' +
      'Check that boardgame.io v0.50 is installed and that the dist path has not changed.',
  );
}

const Client: ClientCtor = resolvedClient;
const SocketIO: SocketIOCtor = resolvedSocketIO;

import { useUiStateStore } from '../stores/uiState.js';
import { useConnectionStore } from '../stores/connection.js';
import { usePreplanStore } from '../stores/preplan.js';
import { detectPlayerAffectingMutations } from '../preplan/mutationDetector.js';
import { executeDisruptionPipeline } from '@legendary-arena/preplan';
import { applyDisruptionToStore } from '../preplan/preplanLifecycle.js';

/**
 * The minimal subset of boardgame.io's Client object that this module uses.
 * Declared structurally so tests can inject a lightweight stand-in without
 * pulling in the real boardgame.io runtime.
 */
export interface BgioClientLike {
  start(): void;
  stop(): void;
  moves: Record<string, (...args: unknown[]) => void>;
  // why: boardgame.io delivers `ClientState<G> = null | (State<G> & {
  // isConnected: boolean })` to subscribers, so every frame carries the
  // transport status (`isConnected`, from `transport.isConnected`) and the
  // authoritative `_stateID` alongside the `G` projection. WP-090 read only
  // `G`; WP-311 also reads `isConnected` / `_stateID` to drive the reconnect
  // banner. The two fields are optional here so test stubs may omit them.
  subscribe(
    listener: (
      state:
        | { G?: unknown; isConnected?: boolean; _stateID?: number }
        | null
        | undefined,
    ) => void,
  ): unknown;
}

export interface BgioClientFactoryArgs {
  game: unknown;
  multiplayer: unknown;
  matchID: string;
  playerID: string;
  credentials: string;
}

export type BgioClientFactory = (args: BgioClientFactoryArgs) => BgioClientLike;

export interface CreateLiveClientOptions {
  matchID: string;
  playerID: string;
  credentials: string;
  serverUrl: string;
  // why: viewerPlayerId is needed by the mutation detector to distinguish
  // mutations affecting the viewer's pre-plan from irrelevant changes to
  // other players' state. Optional today because App.vue's caller site is
  // outside the WP-070 allowlist — the middleware gracefully skips when
  // the field is absent.
  viewerPlayerId?: string;
}

export interface LiveClientHandle {
  start(): void;
  stop(): void;
  submitMove(name: string, ...args: unknown[]): void;
  /**
   * Forces a re-sync with the server, re-anchoring the client's `_stateID`
   * to the server's authoritative state. Used to recover a client that has
   * fallen behind (the WP-311 desync freeze) without a full page reload.
   */
  resync(): void;
}

function defaultClientFactory(args: BgioClientFactoryArgs): BgioClientLike {
  return Client(args) as unknown as BgioClientLike;
}

let activeClientFactory: BgioClientFactory = defaultClientFactory;
let liveClientCallLog: CreateLiveClientOptions[] = [];

/**
 * Replaces the internal Client factory with a test double.
 * Pass `null` to restore the real boardgame.io factory.
 *
 * Testing-only. Production code must never call this.
 */
export function setClientFactoryForTesting(
  factory: BgioClientFactory | null,
): void {
  activeClientFactory = factory ?? defaultClientFactory;
}

/**
 * Returns the ordered list of options passed to `createLiveClient` since the
 * last call to {@link resetLiveClientCallLog}. Testing-only.
 */
export function getLiveClientCallLog(): readonly CreateLiveClientOptions[] {
  return liveClientCallLog;
}

/** Clears the recorded call log. Testing-only. */
export function resetLiveClientCallLog(): void {
  liveClientCallLog = [];
}

/**
 * Creates a live boardgame.io client wired to the running server.
 *
 * The returned handle subscribes to every server-pushed state frame and
 * writes the `G` slice (post WP-089 playerView projection) into the Pinia
 * UI store via {@link useUiStateStore.setSnapshot}. Downstream HUD
 * components read that store and re-render reactively.
 *
 * @param options  Match identity + credentials + server URL.
 * @returns Exactly `{ start, stop, submitMove }` — never the underlying client.
 */
export function createLiveClient(
  options: CreateLiveClientOptions,
): LiveClientHandle {
  liveClientCallLog.push(options);

  const client = activeClientFactory({
    game: LegendaryGame,
    multiplayer: SocketIO({ server: options.serverUrl }),
    matchID: options.matchID,
    playerID: options.playerID,
    credentials: options.credentials,
  });

  let previousUIState: UIState | null = null;

  client.subscribe((state) => {
    // why: WP-311 — record the transport connection status on EVERY frame,
    // before any G handling, so the reconnect banner reflects a drop even on
    // frames whose G projection is null/malformed (the early returns below).
    // boardgame.io sets `state.isConnected` from `transport.isConnected`; a
    // null frame means no connection, so `isConnected` is treated as false.
    const isConnected = state?.isConnected === true;
    // why: read the frame's stateID for the connection store; never assign
    // `_stateID` (the client never pokes boardgame.io's authoritative version —
    // resync() re-anchors it via the framework's own sync instead).
    const rawStateId = state?._stateID;
    const stateId = typeof rawStateId === 'number' ? rawStateId : null;
    useConnectionStore().setConnected(isConnected, stateId);

    const projection = state?.G;
    if (projection !== null && projection !== undefined && typeof projection !== 'object') {
      // why: fail-closed on malformed server frames — a non-object projection
      // cannot be cast safely to UIState. Log once via console.warn (dev
      // surface only) and coalesce to null so the HUD drops to the empty
      // state rather than rendering garbage. FIX-22 per copilot review.
      console.warn(
        '[wp-090] subscribe received non-object state.G; coalescing to null',
      );
      useUiStateStore().setSnapshot(null);
      return;
    }
    // why: WP-089's playerView reshapes the client-visible G to the exact
    // UIState contract consumed by the HUD. The server enforces that
    // reshape; the client only trusts the projection.
    const currentUIState = (projection ?? null) as UIState | null;
    useUiStateStore().setSnapshot(currentUIState);

    // why: middleware runs after the UIState store write so that components
    // see the causal state change before the disruption notification. The
    // store must reflect the new state before disruption processing.
    if (currentUIState === null) {
      return;
    }

    if (previousUIState === null) {
      previousUIState = currentUIState;
      return;
    }

    if (previousUIState === currentUIState) {
      return;
    }

    if (options.viewerPlayerId === undefined) {
      previousUIState = currentUIState;
      return;
    }

    const preplanStore = usePreplanStore();
    if (!preplanStore.isActive) {
      previousUIState = currentUIState;
      return;
    }

    const mutations = detectPlayerAffectingMutations(
      previousUIState,
      currentUIState,
      options.viewerPlayerId,
    );

    for (const mutation of mutations) {
      const result = executeDisruptionPipeline(preplanStore.current!, mutation);
      if (result !== null && result.requiresImmediateNotification === true) {
        applyDisruptionToStore({ store: preplanStore, result });
        break;
      }
    }

    previousUIState = currentUIState;
  });

  return {
    start: () => client.start(),
    stop: () => client.stop(),
    // why: the client submits intent via boardgame.io's move API; the
    // server receives the intent and dispatches to the authoritative engine.
    // The client never computes outcomes.
    submitMove: (name: string, ...args: unknown[]): void => {
      const move = client.moves[name];
      if (typeof move === 'function') {
        move(...args);
      }
    },
    // why: WP-311 / D-24096 — force a re-sync by tearing down and
    // re-establishing the boardgame.io client (`stop()` then `start()`). That
    // re-runs the SocketIO connect → server `onSync` handshake, which re-anchors
    // the client's `_stateID` to the server's authoritative state. This is the
    // recovery for a client wedged one `_stateID` behind (the freeze this WP
    // fixes) — it re-reads authoritative state via boardgame.io's own sync,
    // never pokes `_stateID`, fabricates a frame, or calls a server endpoint.
    resync: (): void => {
      client.stop();
      client.start();
    },
  };
}
