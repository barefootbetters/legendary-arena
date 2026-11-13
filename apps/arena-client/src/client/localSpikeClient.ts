/**
 * Local match client for the WP-890 spike (D-24842): `LegendaryGame` on an
 * in-browser boardgame.io `Local()` master, fed by a recorded setup bundle.
 *
 * Development-only. The page that uses it is compiled out of every build
 * unless `VITE_LOCAL_SPIKE` is set (App.vue). The UI still submits intents and
 * reads only the `playerView` projection; the engine runs on the local master
 * instead of the server. That is a development-only exception to "Engine Owns
 * Truth" recorded by D-24842. Nothing here persists anything.
 */

import {
  LegendaryGame,
  setRegistryForSetup,
  validateMatchSetup,
} from '@legendary-arena/game-engine';
import type { MatchConfiguration, UIState } from '@legendary-arena/game-engine';
// why: the boardgame.io v0.50 CJS bundles are loaded through a namespace import
// with a `pkg.X ?? pkg.default?.X` fallback, because Node's ESM resolver (tsx)
// and Vite disagree on these bundles' interop. Same precedent as bgioClient.ts.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — boardgame.io v0.50 ships no .d.ts alongside the dist CJS bundle.
import * as boardgameioClient from 'boardgame.io/dist/cjs/client.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — boardgame.io v0.50 ships no .d.ts alongside the dist CJS bundle.
import * as boardgameioMultiplayer from 'boardgame.io/dist/cjs/multiplayer.js';

import { useUiStateStore } from '../stores/uiState.js';
import { useConnectionStore } from '../stores/connection.js';
import { createSetupBundleReader, type LocalSpikeSetupBundle } from './setupBundleReader.js';

/** The spike's fixed seed; the recorded bundle was built with it. */
export const LOCAL_SPIKE_DEFAULT_SEED = 'local-spike-0001';

/** The fixed match id every local spike client uses. */
const LOCAL_SPIKE_MATCH_ID = 'local-spike';

/** The one seat a local spike match has. */
const LOCAL_SPIKE_PLAYER_ID = '0';

/** One boardgame.io frame as a subscriber sees it. */
interface LocalClientFrame {
  G?: unknown;
  isConnected?: boolean;
  _stateID?: number;
}

/** The subset of boardgame.io's Client this module uses. */
interface LocalBgioClient {
  start(): void;
  stop(): void;
  moves: Record<string, ((...args: unknown[]) => void) | undefined>;
  subscribe(listener: (state: LocalClientFrame | null | undefined) => void): unknown;
}

type LocalClientCtor = (args: {
  game: unknown;
  numPlayers: number;
  multiplayer: unknown;
  matchID: string;
  playerID: string;
}) => LocalBgioClient;
type LocalTransportCtor = () => unknown;

const bgioClientNs = boardgameioClient as unknown as {
  Client?: LocalClientCtor;
  default?: { Client?: LocalClientCtor };
};
const bgioMultiplayerNs = boardgameioMultiplayer as unknown as {
  Local?: LocalTransportCtor;
  default?: { Local?: LocalTransportCtor };
};

/**
 * Resolves boardgame.io's Client and Local constructors from the CJS bundles.
 *
 * @returns Both constructors.
 * @throws When either can't be found in the installed bundle.
 */
function resolveBoardgameio(): { Client: LocalClientCtor; Local: LocalTransportCtor } {
  const client = bgioClientNs.Client ?? bgioClientNs.default?.Client;
  const local = bgioMultiplayerNs.Local ?? bgioMultiplayerNs.default?.Local;
  if (client === undefined || local === undefined) {
    throw new Error(
      'boardgame.io Client or Local could not be resolved from the CJS bundles. ' +
        'Check that boardgame.io v0.50 is installed and that the dist path has not changed.',
    );
  }
  return { Client: client, Local: local };
}

/** One recorded move: the rest array passed to `submitMove(name, ...args)`. */
export interface LocalSpikeRecordedMove {
  readonly playerID: string;
  readonly moveName: string;
  readonly args: readonly unknown[];
}

/** Record v1: what replays a local spike match. */
export interface LocalSpikeRecord {
  readonly schemaVersion: 1;
  readonly recordKind: 'local-spike-record';
  readonly numPlayers: 1;
  readonly matchConfiguration: MatchConfiguration;
  readonly seed: string;
  readonly moves: LocalSpikeRecordedMove[];
}

/** The handle a local spike client returns. */
export interface LocalSpikeClientHandle {
  start(): void;
  stop(): void;
  submitMove(name: string, ...args: unknown[]): void;
  resync(): void;
  getRecord(): LocalSpikeRecord;
  getState(): UIState | null;
}

/** Options for {@link createLocalSpikeClient}. */
export interface CreateLocalSpikeClientOptions {
  readonly bundle: LocalSpikeSetupBundle;
  readonly matchConfiguration: MatchConfiguration;
  readonly seed: string;
  readonly writesStores: boolean;
}

/** The game copy a local master runs. */
export type LocalSpikeGame = typeof LegendaryGame & { seed: string };

/**
 * Builds a fresh copy of `LegendaryGame` for one local match.
 *
 * @param options - The match configuration and seed.
 * @returns A new game object pinned to that configuration and seed.
 */
export function createLocalSpikeGame(options: {
  matchConfiguration: MatchConfiguration;
  seed: string;
}): LocalSpikeGame {
  const engineSetup = LegendaryGame.setup;
  if (engineSetup === undefined) {
    throw new Error('LegendaryGame has no setup function; the engine build is incomplete.');
  }
  // why: boardgame.io 0.50.2 never passes setupData to a local match: the
  // master creates it with `setupData: undefined`, LegendaryGame's
  // validateSetupData refuses that, and LocalTransport drops the refusal
  // silently, leaving the client's state null (WP §Assumes 4). So `setup`
  // closes over the configuration, and `validateSetupData` is replaced. It is
  // replaced only because createLocalSpikeClient has already run
  // validateMatchSetup on this configuration and thrown on failure.
  // why: a fresh object per client, because Local() keys its master by the
  // game object; a reused object would reuse a finished match (WP §Assumes 7).
  return {
    ...LegendaryGame,
    seed: options.seed,
    setup: (context) => engineSetup(context, options.matchConfiguration),
    validateSetupData: () => undefined,
  };
}

/**
 * Reads a frame's `G` as the UIState projection, or null.
 *
 * @param state - A boardgame.io frame.
 * @returns The projection, or null when the frame has none.
 */
function readProjection(state: LocalClientFrame | null | undefined): UIState | null {
  const projection = state?.G;
  if (projection === null || projection === undefined || typeof projection !== 'object') {
    return null;
  }
  // why: the local master runs LegendaryGame.playerView, which returns UIState;
  // the client trusts the projection exactly as createLiveClient does.
  return projection as UIState;
}

/**
 * Validates the configuration on the bundle reader and installs the reader.
 *
 * @param bundle - The setup bundle.
 * @param matchConfiguration - The configuration to play.
 * @throws A full-sentence error when the configuration is invalid.
 */
function prepareSetupReader(bundle: LocalSpikeSetupBundle, matchConfiguration: MatchConfiguration): void {
  const reader = createSetupBundleReader(bundle);
  const validation = validateMatchSetup(matchConfiguration, reader, bundle.numPlayers);
  if (!validation.ok) {
    const firstMessage = validation.errors[0]?.message ?? 'an unknown error';
    throw new Error(`The local spike match configuration failed setup validation: ${firstMessage}`);
  }
  // why: Game.setup() reads the module-level holder that setRegistryForSetup
  // sets (game.ts). The server sets it in its own process; in the browser no
  // other code reads or sets it, so the spike points it at the bundle reader.
  setRegistryForSetup(reader);
}

/**
 * Creates a boardgame.io client on a `Local()` master for one spike match.
 *
 * @param options - Bundle, configuration, seed and whether frames write the stores.
 * @returns The local client handle.
 * @throws When the configuration fails validation; no client is built then.
 */
export function createLocalSpikeClient(options: CreateLocalSpikeClientOptions): LocalSpikeClientHandle {
  prepareSetupReader(options.bundle, options.matchConfiguration);
  const { Client, Local } = resolveBoardgameio();
  const client = Client({
    game: createLocalSpikeGame({ matchConfiguration: options.matchConfiguration, seed: options.seed }),
    numPlayers: 1,
    multiplayer: Local(),
    matchID: LOCAL_SPIKE_MATCH_ID,
    playerID: LOCAL_SPIKE_PLAYER_ID,
  });
  const moves: LocalSpikeRecordedMove[] = [];
  let latestState: UIState | null = null;
  client.subscribe((state) => {
    latestState = readProjection(state);
    if (options.writesStores) {
      const rawStateId = state?._stateID;
      useConnectionStore().setConnected(
        state?.isConnected === true,
        typeof rawStateId === 'number' ? rawStateId : null,
      );
      useUiStateStore().setSnapshot(latestState);
    }
  });
  return {
    start: () => client.start(),
    stop: () => client.stop(),
    submitMove: (name: string, ...args: unknown[]): void => {
      moves.push({ playerID: LOCAL_SPIKE_PLAYER_ID, moveName: name, args: structuredClone(args) });
      client.moves[name]?.(...args);
    },
    // why: there is no server to re-anchor to; the local master is the authority.
    resync: (): void => undefined,
    getRecord: (): LocalSpikeRecord =>
      structuredClone({
        schemaVersion: 1,
        recordKind: 'local-spike-record',
        numPlayers: 1,
        matchConfiguration: options.matchConfiguration,
        seed: options.seed,
        moves,
      }),
    getState: () => latestState,
  };
}

/**
 * Replays a record on a fresh local master.
 *
 * @param record - A record v1.
 * @param bundle - The setup bundle the record was played on.
 * @returns The UIState after each move, as `JSON.stringify` strings.
 */
export function replayLocalSpikeRecord(record: LocalSpikeRecord, bundle: LocalSpikeSetupBundle): string[] {
  // why: writesStores is false so a replay never moves the live board.
  const handle = createLocalSpikeClient({
    bundle,
    matchConfiguration: record.matchConfiguration,
    seed: record.seed,
    writesStores: false,
  });
  const states: string[] = [];
  handle.start();
  try {
    for (const move of record.moves) {
      handle.submitMove(move.moveName, ...move.args);
      // why: delivery is synchronous (in-memory storage) and subscribers fire
      // more than once per move, so the latest frame is read; frames are never counted.
      states.push(JSON.stringify(handle.getState()));
    }
  } finally {
    handle.stop();
  }
  return states;
}
