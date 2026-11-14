/**
 * WP-890 local match spike (D-24842): the local master against boardgame.io's
 * own reducer, record replay, and the committed setup bundle's identity.
 *
 * The engine's AI (`getLegalMoves` + `createRandomPolicy`) appears here only,
 * as a test driver; the spike page never runs it.
 */

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPinia, setActivePinia } from 'pinia';

import {
  computeStateHash,
  createRandomPolicy,
  getLegalMoves,
  LegendaryGame,
  validateMatchSetup,
} from '@legendary-arena/game-engine';
import type { LegendaryGameState, UIState } from '@legendary-arena/game-engine';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — boardgame.io v0.50 ships no .d.ts alongside the dist CJS bundle.
import * as boardgameioInternal from 'boardgame.io/dist/cjs/internal.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — boardgame.io v0.50 ships no .d.ts alongside the dist CJS bundle.
import * as boardgameioMultiplayer from 'boardgame.io/dist/cjs/multiplayer.js';

import featuredSetupBundleJson from '../fixtures/localSpike/featuredSetupBundle.json';
import { FEATURED_TABLE } from '../lobby/featuredTable';
import { useConnectionStore } from '../stores/connection';
import { createSetupBundleReader, parseLocalSpikeSetupBundle } from './setupBundleReader';
import {
  createLocalMultiplayer,
  createLocalSpikeClient,
  createLocalSpikeGame,
  LOCAL_SPIKE_DEFAULT_SEED,
  replayLocalSpikeRecord,
  type LocalSpikeClientHandle,
  type LocalSpikeRecord,
  type LocalTransportCtor,
  type LocalTransportOptions,
} from './localSpikeClient';

const BUNDLE_FILE_PATH = fileURLToPath(
  new URL('../fixtures/localSpike/featuredSetupBundle.json', import.meta.url),
);
const MAX_POLICY_MOVES = 400;

/** The reference reducer's state, as far as this test reads it. */
interface ReferenceState {
  G: LegendaryGameState;
  ctx: { phase: string; turn: number; currentPlayer: string; numPlayers: number; gameover?: unknown };
  _stateID: number;
}

type ReferenceAction = { type: string; payload: unknown };

interface BgioInternal {
  InitializeGame(args: { game: unknown; numPlayers: number }): ReferenceState;
  CreateGameReducer(args: { game: unknown; isClient: boolean }): (
    state: ReferenceState,
    action: ReferenceAction,
  ) => ReferenceState;
}

// why: the `pkg.X ?? pkg.default?.X` fallback, the bgioClient.ts precedent;
// tsx exposes the CJS exports under `default`.
const internalNs = boardgameioInternal as unknown as Partial<BgioInternal> & {
  default?: Partial<BgioInternal>;
};
const InitializeGame = internalNs.InitializeGame ?? internalNs.default?.InitializeGame;
const CreateGameReducer = internalNs.CreateGameReducer ?? internalNs.default?.CreateGameReducer;

const bundle = parseLocalSpikeSetupBundle(featuredSetupBundleJson);

/**
 * Projects a reference state for player '0' through the engine's playerView.
 *
 * @param state - The reference reducer's state.
 * @returns The UIState the server would send seat 0.
 */
function referenceView(state: ReferenceState): UIState {
  const playerView = LegendaryGame.playerView;
  assert.ok(playerView !== undefined, 'LegendaryGame.playerView must be defined.');
  return playerView({ G: state.G, ctx: state.ctx as never, playerID: '0' }) as UIState;
}

/**
 * Builds a MAKE_MOVE action as boardgame.io's client sends it.
 *
 * @param moveName - The move.
 * @param moveArgs - Its single argument.
 * @returns The reducer action.
 */
function makeMoveAction(moveName: string, moveArgs: unknown): ReferenceAction {
  return { type: 'MAKE_MOVE', payload: { type: moveName, args: [moveArgs], playerID: '0' } };
}

/** What case 3 hands to cases 4 to 6. */
interface DrivenMatch {
  record: LocalSpikeRecord;
  liveStates: string[];
  initialReference: ReferenceState;
  initialLocalState: UIState | null;
  policyMoveCount: number;
  isGameOver: boolean;
}

let drivenMatch: DrivenMatch | null = null;

describe('local match spike (WP-890 / D-24842)', () => {
  before(() => {
    setActivePinia(createPinia());
  });

  test('1. validateMatchSetup passes for FEATURED_TABLE on the bundle reader', () => {
    const result = validateMatchSetup(FEATURED_TABLE, createSetupBundleReader(bundle), 1);
    assert.equal(result.ok, true);
  });

  describe('2. with fetch, WebSocket and XMLHttpRequest throwing', () => {
    const globals = globalThis as Record<string, unknown>;
    const saved = { fetch: globals.fetch, WebSocket: globals.WebSocket, XMLHttpRequest: globals.XMLHttpRequest };
    before(() => {
      for (const name of ['fetch', 'WebSocket', 'XMLHttpRequest']) {
        globals[name] = () => {
          throw new Error(`The local spike used the network (${name}); it must not.`);
        };
      }
    });
    after(() => {
      globals.fetch = saved.fetch;
      globals.WebSocket = saved.WebSocket;
      globals.XMLHttpRequest = saved.XMLHttpRequest;
    });

    test('the local client starts and delivers a first UIState', () => {
      const handle = createLocalSpikeClient({
        bundle,
        matchConfiguration: bundle.matchConfiguration,
        seed: LOCAL_SPIKE_DEFAULT_SEED,
        writesStores: false,
      });
      handle.start();
      const state = handle.getState();
      handle.stop();
      assert.notEqual(state, null);
      assert.equal(state?.game.phase, 'lobby');
    });

    test('3. reference equality: the local master equals CreateGameReducer after every step', (context) => {
      drivenMatch = driveMatchAgainstReference();
      context.diagnostic(`policy moves ${drivenMatch.policyMoveCount}, gameover ${String(drivenMatch.isGameOver)}`);
      assert.equal(drivenMatch.isGameOver, true, 'The driven match must reach gameover within 400 moves.');
    });
  });

  test('4. replay: a JSON round-tripped record replays to the live UIState strings', () => {
    assert.ok(drivenMatch !== null, 'Case 3 must run first.');
    const roundTripped = JSON.parse(JSON.stringify(drivenMatch.record)) as LocalSpikeRecord;
    const replayed = replayLocalSpikeRecord(roundTripped, bundle);
    assert.equal(replayed.length, drivenMatch.liveStates.length);
    for (let i = 0; i < replayed.length; i++) {
      assert.equal(replayed[i], drivenMatch.liveStates[i], `Replay differs at move ${i}.`);
    }
  });

  test('5. bundle identity: hash, image count, configuration and seed', () => {
    assert.ok(drivenMatch !== null, 'Case 3 must run first.');
    assert.equal(computeStateHash(drivenMatch.initialReference.G), bundle.initialStateHash);
    const imageUrls = drivenMatch.initialLocalState?.matchCardImageUrls ?? [];
    assert.equal(new Set(imageUrls).size, bundle.matchCardImageUrlCount);
    assert.deepEqual(bundle.matchConfiguration, FEATURED_TABLE);
    assert.equal(bundle.seed, LOCAL_SPIKE_DEFAULT_SEED);
  });

  test('6. no aliasing: the bundle is unchanged after play and replay', () => {
    assert.ok(drivenMatch !== null, 'Case 3 must run first.');
    assert.equal(`${JSON.stringify(bundle)}\n`, readFileSync(BUNDLE_FILE_PATH, 'utf8'));
  });
});

/**
 * Asserts the local client and the reference agree after one step.
 *
 * @param handle - The local client.
 * @param reference - The reference state.
 * @param stepLabel - Which step, for the failure message.
 */
function assertStepMatches(handle: LocalSpikeClientHandle, reference: ReferenceState, stepLabel: string): void {
  assert.equal(
    JSON.stringify(handle.getState()),
    JSON.stringify(referenceView(reference)),
    `UIState differs from the reference reducer at ${stepLabel}.`,
  );
  assert.equal(useConnectionStore().lastStateId, reference._stateID, `_stateID differs at ${stepLabel}.`);
}

/**
 * Plays the featured table on a local client and a reference reducer side by side.
 *
 * @returns The record, the live UIState strings and the counts.
 */
function driveMatchAgainstReference(): DrivenMatch {
  assert.ok(InitializeGame !== undefined && CreateGameReducer !== undefined, 'boardgame.io internal.js must resolve.');
  const handle = createLocalSpikeClient({
    bundle,
    matchConfiguration: bundle.matchConfiguration,
    seed: LOCAL_SPIKE_DEFAULT_SEED,
    writesStores: true,
  });
  // why: the reference is the D-24119 CreateGameReducer replay pattern, so
  // equality means the local master behaves as the server's reducer does.
  const referenceGame = createLocalSpikeGame({ matchConfiguration: bundle.matchConfiguration, seed: LOCAL_SPIKE_DEFAULT_SEED });
  const reducer = CreateGameReducer({ game: referenceGame, isClient: false });
  let reference = InitializeGame({ game: referenceGame, numPlayers: 1 });
  const initialReference = reference;
  handle.start();
  const initialLocalState = handle.getState();
  assertStepMatches(handle, reference, 'the initial state');
  const liveStates: string[] = [];
  const lobbyMoves: Array<[string, unknown]> = [['setPlayerReady', { ready: true }], ['startMatchIfReady', {}]];
  for (const [moveName, moveArgs] of lobbyMoves) {
    handle.submitMove(moveName, moveArgs);
    reference = reducer(reference, makeMoveAction(moveName, moveArgs));
    liveStates.push(JSON.stringify(handle.getState()));
    assertStepMatches(handle, reference, moveName);
  }
  const policy = createRandomPolicy(LOCAL_SPIKE_DEFAULT_SEED);
  let policyMoveCount = 0;
  while (reference.ctx.gameover === undefined && policyMoveCount < MAX_POLICY_MOVES) {
    const { phase, turn, currentPlayer, numPlayers } = reference.ctx;
    const legalMoves = getLegalMoves(reference.G, { phase, turn, currentPlayer, numPlayers });
    const intent = policy.decideTurn(referenceView(reference), legalMoves);
    handle.submitMove(intent.move.name, intent.move.args);
    reference = reducer(reference, makeMoveAction(intent.move.name, intent.move.args));
    policyMoveCount += 1;
    liveStates.push(JSON.stringify(handle.getState()));
    assertStepMatches(handle, reference, `policy move ${policyMoveCount} (${intent.move.name})`);
  }
  const record = handle.getRecord();
  handle.stop();
  return {
    record,
    liveStates,
    initialReference,
    initialLocalState,
    policyMoveCount,
    isGameOver: reference.ctx.gameover !== undefined,
  };
}

// why: D-24851 follow-up (b). boardgame.io 0.50's `Local()` keeps its masters in
// a module-level map that is never pruned. These tests run the REAL `Local()`, so
// a boardgame.io upgrade that changes how that map is keyed fails here loudly.
describe('local master map: one entry per page (D-24851 follow-up)', () => {
  const multiplayerNs = boardgameioMultiplayer as unknown as {
    Local?: LocalTransportCtor;
    default?: { Local?: LocalTransportCtor };
  };
  const Local = multiplayerNs.Local ?? multiplayerNs.default?.Local;

  /**
   * Builds the transport options a boardgame.io client would pass, for a tiny game.
   *
   * @param gameKey - The key the client would pass (its own game object).
   * @returns The options.
   */
  function makeTransportOptions(gameKey: object): LocalTransportOptions {
    return {
      gameKey,
      game: { name: 'map-probe', setup: () => ({}) },
      transportDataCallback: () => undefined,
      matchID: 'default',
      playerID: '0',
      gameName: 'map-probe',
      numPlayers: 1,
    };
  }

  /**
   * Reads the master a local transport is bound to.
   *
   * @param transport - A transport from a `multiplayer` factory.
   * @returns Its master.
   */
  function readMaster(transport: unknown): unknown {
    return (transport as { master: unknown }).master;
  }

  test('Local() is found in the installed boardgame.io bundle', () => {
    assert.equal(typeof Local, 'function');
  });

  test('each client gets a fresh master, and a new client overwrites the shared entry', () => {
    assert.ok(Local !== undefined);
    const firstFactory = createLocalMultiplayer(Local);
    const firstMaster = readMaster(firstFactory(makeTransportOptions({})));
    // Same factory again: Local() finds its own entry, so the master is reused.
    assert.equal(readMaster(firstFactory(makeTransportOptions({}))), firstMaster, 'the same client reuses its master');

    const secondFactory = createLocalMultiplayer(Local);
    const secondMaster = readMaster(secondFactory(makeTransportOptions({})));
    assert.notEqual(secondMaster, firstMaster, 'a new client gets a fresh master');

    // The first client's entry was overwritten: asking with its storageKey again
    // builds yet another master instead of finding the old one. If the map held
    // one entry per game object (the leak), this would return firstMaster.
    const rebuiltMaster = readMaster(firstFactory(makeTransportOptions({})));
    assert.notEqual(rebuiltMaster, firstMaster, 'the first master is no longer in the map');
    assert.notEqual(rebuiltMaster, secondMaster);
  });

  test('without the shared key, Local() keeps one master per game object (the leak this avoids)', () => {
    assert.ok(Local !== undefined);
    const plainFactory = Local();
    const firstGameKey = {};
    const firstMaster = readMaster(plainFactory(makeTransportOptions(firstGameKey)));
    readMaster(plainFactory(makeTransportOptions({})));
    assert.equal(
      readMaster(plainFactory(makeTransportOptions(firstGameKey))),
      firstMaster,
      'boardgame.io still holds the first game object\'s master',
    );
  });
});
