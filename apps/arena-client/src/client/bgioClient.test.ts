import '../testing/jsdom-setup';

import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import {
  createLiveClient,
  setClientFactoryForTesting,
  getLiveClientCallLog,
  resetLiveClientCallLog,
  MOVE_ACK_TIMEOUT_MS,
  RESYNC_COOLDOWN_MS,
  type BgioClientLike,
  type BgioClientFactory,
} from './bgioClient';
import { useUiStateStore } from '../stores/uiState';
import { useConnectionStore } from '../stores/connection';
import App from '../App.vue';

interface StubSubscriber {
  callback: (
    state:
      | { G?: unknown; isConnected?: boolean; _stateID?: number }
      | null
      | undefined,
  ) => void;
}

interface StubClient extends BgioClientLike {
  _subscribers: StubSubscriber[];
  _starts: number;
  _stops: number;
  // why: WP-311 — records start/stop call ORDER so the resync() test can assert
  // stop-then-start (a re-anchor tears the socket down before re-establishing it).
  _ops: string[];
  _moveLog: Array<{ name: string; args: unknown[] }>;
}

function makeStubFactory(): {
  factory: BgioClientFactory;
  lastClient: () => StubClient | null;
} {
  let captured: StubClient | null = null;

  const factory: BgioClientFactory = () => {
    const stub: StubClient = {
      _subscribers: [],
      _starts: 0,
      _stops: 0,
      _ops: [],
      _moveLog: [],
      moves: {
        drawCards: (...args: unknown[]) => {
          stub._moveLog.push({ name: 'drawCards', args });
        },
      },
      start: () => {
        stub._starts += 1;
        stub._ops.push('start');
      },
      stop: () => {
        stub._stops += 1;
        stub._ops.push('stop');
      },
      subscribe: (listener) => {
        stub._subscribers.push({ callback: listener });
        return () => {};
      },
    };
    captured = stub;
    return stub;
  };

  return { factory, lastClient: () => captured };
}

describe('createLiveClient', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetLiveClientCallLog();
  });

  afterEach(() => {
    setClientFactoryForTesting(null);
    resetLiveClientCallLog();
  });

  test('returns a handle with exactly the locked methods — resync, start, stop, submitMove', () => {
    const { factory } = makeStubFactory();
    setClientFactoryForTesting(factory);

    const handle = createLiveClient({
      matchID: 'match-1',
      playerID: '0',
      credentials: 'secret',
      serverUrl: 'http://localhost:8000',
      viewerPlayerId: '0',
    });

    const keys = Object.keys(handle).sort();
    assert.deepEqual(keys, ['resync', 'start', 'stop', 'submitMove']);
    assert.equal(typeof handle.start, 'function');
    assert.equal(typeof handle.stop, 'function');
    assert.equal(typeof handle.submitMove, 'function');
    assert.equal(typeof handle.resync, 'function');
  });

  test('resync() re-anchors by calling stop() then start() in that order (WP-311)', () => {
    const { factory, lastClient } = makeStubFactory();
    setClientFactoryForTesting(factory);

    const handle = createLiveClient({
      matchID: 'match-resync',
      playerID: '0',
      credentials: 'secret',
      serverUrl: 'http://localhost:8000',
    });

    const stub = lastClient();
    assert.ok(stub !== null);
    // why: createLiveClient itself does not call start() (App.vue does), so the
    // op log starts empty and captures only the resync() sequence.
    assert.deepEqual(stub!._ops, []);

    handle.resync();

    assert.deepEqual(stub!._ops, ['stop', 'start']);
    assert.equal(stub!._stops, 1);
    assert.equal(stub!._starts, 1);
  });

  test('subscribe callback surfaces state.isConnected + _stateID to the connection store (WP-311)', () => {
    const { factory, lastClient } = makeStubFactory();
    setClientFactoryForTesting(factory);

    createLiveClient({
      matchID: 'match-conn',
      playerID: '0',
      credentials: 'secret',
      serverUrl: 'http://localhost:8000',
    });

    const stub = lastClient();
    assert.ok(stub !== null);
    const connection = useConnectionStore();

    // A connected frame latches hasEverConnected and records the stateID.
    stub!._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 7 });
    assert.equal(connection.isConnected, true);
    assert.equal(connection.lastStateId, 7);
    assert.equal(connection.hasEverConnected, true);

    // A dropped frame flips isConnected false but keeps the hasEverConnected
    // latch, so the banner shows. A null/malformed G frame must still update
    // the connection status (the write runs before any G handling).
    stub!._subscribers[0]!.callback({ G: null, isConnected: false, _stateID: 7 });
    assert.equal(connection.isConnected, false);
    assert.equal(connection.hasEverConnected, true);
  });

  test('submitMove delegates to the underlying client.moves[name] bag', () => {
    const { factory, lastClient } = makeStubFactory();
    setClientFactoryForTesting(factory);

    const handle = createLiveClient({
      matchID: 'match-2',
      playerID: '0',
      credentials: 'secret',
      serverUrl: 'http://localhost:8000',
      viewerPlayerId: '0',
    });

    handle.submitMove('drawCards', 2, { reason: 'start-of-turn' });
    handle.submitMove('unknownMove', 'ignored');

    const stub = lastClient();
    assert.ok(stub !== null);
    assert.equal(stub!._moveLog.length, 1);
    assert.equal(stub!._moveLog[0]!.name, 'drawCards');
    assert.deepEqual(stub!._moveLog[0]!.args, [2, { reason: 'start-of-turn' }]);
  });

  test('subscribe callback writes state.G to the Pinia store via setSnapshot', () => {
    const { factory, lastClient } = makeStubFactory();
    setClientFactoryForTesting(factory);

    createLiveClient({
      matchID: 'match-3',
      playerID: '0',
      credentials: 'secret',
      serverUrl: 'http://localhost:8000',
      viewerPlayerId: '0',
    });

    const stub = lastClient();
    assert.ok(stub !== null);
    assert.equal(stub!._subscribers.length, 1);

    const store = useUiStateStore();
    assert.equal(store.snapshot, null);

    const sampleUiState = {
      game: {
        phase: 'play',
        turn: 1,
        stage: 'main',
        activePlayerId: '0',
      },
      players: [],
      progress: {},
      gameOver: null,
    } as unknown;

    stub!._subscribers[0]!.callback({ G: sampleUiState });
    // why: Pinia wraps reactive state; a reference-equal assertion would
    // compare the reactive proxy against the raw object. deepEqual is the
    // right granularity for this contract.
    assert.deepEqual(store.snapshot, sampleUiState);

    // why: a malformed (non-object) frame must coalesce to null rather than
    // propagate a primitive cast as UIState.
    stub!._subscribers[0]!.callback({ G: 'this is not an object' as unknown });
    assert.equal(store.snapshot, null);
  });
});

describe('createLiveClient move-ack watchdog (WP-312)', () => {
  // why: the watchdog arms a setTimeout on submitMove; mock timers let us tick
  // past MOVE_ACK_TIMEOUT_MS deterministically without a real 4s wait. Scoped to
  // this describe so the other suites keep real timers.
  beforeEach(() => {
    setActivePinia(createPinia());
    resetLiveClientCallLog();
    mock.timers.enable({ apis: ['setTimeout'] });
  });

  afterEach(() => {
    mock.timers.reset();
    setClientFactoryForTesting(null);
    resetLiveClientCallLog();
  });

  /**
   * Drives a fresh live client with a stub factory and pushes an initial frame
   * at the given stateID so the watchdog has a baseline. Returns the handle +
   * the captured stub.
   */
  function startClientAtStateId(stateId: number): {
    handle: ReturnType<typeof createLiveClient>;
    stub: StubClient;
  } {
    const { factory, lastClient } = makeStubFactory();
    setClientFactoryForTesting(factory);
    const handle = createLiveClient({
      matchID: 'match-watchdog',
      playerID: '0',
      credentials: 'secret',
      serverUrl: 'http://localhost:8000',
    });
    const stub = lastClient();
    assert.ok(stub !== null);
    stub!._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: stateId });
    return { handle, stub: stub! };
  }

  test('a move acknowledged before the timeout does NOT trigger a resync', () => {
    const { handle, stub } = startClientAtStateId(5);
    handle.submitMove('drawCards', 1); // arms watchdog, baseline _stateID = 5
    // server advances _stateID -> the move is acknowledged, watchdog cleared
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 6 });
    mock.timers.tick(MOVE_ACK_TIMEOUT_MS + 1);
    // no resync: createLiveClient never called start()/stop() on its own
    assert.deepEqual(stub._ops, []);
  });

  test('a move NOT acknowledged within the timeout triggers exactly one resync', () => {
    const { handle, stub } = startClientAtStateId(5);
    handle.submitMove('drawCards', 1); // arms watchdog, baseline 5
    // no server frame advances _stateID (the wedge); the deadline elapses
    mock.timers.tick(MOVE_ACK_TIMEOUT_MS + 1);
    // resync re-anchors via stop() then start()
    assert.deepEqual(stub._ops, ['stop', 'start']);
  });

  test('a second stuck move within the cooldown does NOT trigger a second resync', () => {
    const { handle, stub } = startClientAtStateId(5);
    handle.submitMove('drawCards', 1);
    mock.timers.tick(MOVE_ACK_TIMEOUT_MS + 1); // first resync fires
    assert.deepEqual(stub._ops, ['stop', 'start']);

    // still stuck (no new frame); a second submit within the cooldown must not
    // arm a new watchdog, so ticking again produces no second resync.
    handle.submitMove('drawCards', 1);
    mock.timers.tick(MOVE_ACK_TIMEOUT_MS + 1);
    assert.deepEqual(stub._ops, ['stop', 'start']);

    // after the cooldown elapses, the watchdog is available again
    mock.timers.tick(RESYNC_COOLDOWN_MS + 1);
    handle.submitMove('drawCards', 1);
    mock.timers.tick(MOVE_ACK_TIMEOUT_MS + 1);
    assert.deepEqual(stub._ops, ['stop', 'start', 'stop', 'start']);
  });

  test('an unknown (no-op) move name does not arm the watchdog', () => {
    const { handle, stub } = startClientAtStateId(5);
    handle.submitMove('nonexistentMove', 1); // not in the stub moves bag → no dispatch
    mock.timers.tick(MOVE_ACK_TIMEOUT_MS + 1);
    assert.deepEqual(stub._ops, []);
  });

  test('the watchdog timer is cleared on stop() (no resync fires afterward)', () => {
    const { handle, stub } = startClientAtStateId(5);
    handle.submitMove('drawCards', 1); // arms watchdog
    handle.stop(); // clears the watchdog + calls client.stop()
    mock.timers.tick(MOVE_ACK_TIMEOUT_MS + 1);
    // only the explicit stop() ran; the watchdog did not fire a resync
    assert.deepEqual(stub._ops, ['stop']);
  });
});

describe('createLiveClient reconnect-resync', () => {
  // why: onTransportReconnect defers the resync via setTimeout(0); mock timers
  // let us fire that deferred tear-down deterministically. Scoped to this
  // describe so the other real-timer suites are unaffected.
  beforeEach(() => {
    setActivePinia(createPinia());
    resetLiveClientCallLog();
    mock.timers.enable({ apis: ['setTimeout'] });
  });

  afterEach(() => {
    mock.timers.reset();
    setClientFactoryForTesting(null);
    resetLiveClientCallLog();
  });

  function startClient(): {
    handle: ReturnType<typeof createLiveClient>;
    stub: StubClient;
  } {
    const { factory, lastClient } = makeStubFactory();
    setClientFactoryForTesting(factory);
    const handle = createLiveClient({
      matchID: 'match-reconnect',
      playerID: '0',
      credentials: 'secret',
      serverUrl: 'http://localhost:8000',
    });
    const stub = lastClient();
    assert.ok(stub !== null);
    return { handle, stub: stub! };
  }

  test('a genuine reconnect (connected → dropped → connected) forces exactly one resync', () => {
    const { stub } = startClient();
    // first connect: never treated as a reconnect
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 5 });
    // server restart drops the socket
    stub._subscribers[0]!.callback({ G: null, isConnected: false, _stateID: 5 });
    // socket reconnects — but boardgame.io left us on the stale _stateID
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 5 });
    // the resync is deferred out of the subscribe frame; nothing yet
    assert.deepEqual(stub._ops, []);
    mock.timers.tick(1);
    assert.deepEqual(stub._ops, ['stop', 'start']);
  });

  test('the FIRST connect (incl. a pre-connect disconnected frame) never resyncs', () => {
    const { stub } = startClient();
    // a pre-connect frame reports disconnected before the socket is up
    stub._subscribers[0]!.callback({ G: null, isConnected: false, _stateID: 0 });
    // the first real connect must NOT be mistaken for a reconnect
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 1 });
    mock.timers.tick(1);
    assert.deepEqual(stub._ops, []);
  });

  test('the reconnect frames produced by the resync itself do not loop (cooldown-gated)', () => {
    const { stub } = startClient();
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 5 });
    stub._subscribers[0]!.callback({ G: null, isConnected: false, _stateID: 5 });
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 5 });
    mock.timers.tick(1);
    assert.deepEqual(stub._ops, ['stop', 'start']);

    // the resync's own stop()/start() drives another drop→restore; within the
    // cooldown these must NOT trigger a second resync.
    stub._subscribers[0]!.callback({ G: null, isConnected: false, _stateID: 5 });
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 5 });
    mock.timers.tick(1);
    assert.deepEqual(stub._ops, ['stop', 'start']);

    // once the cooldown elapses, a fresh reconnect resyncs again
    mock.timers.tick(RESYNC_COOLDOWN_MS + 1);
    stub._subscribers[0]!.callback({ G: null, isConnected: false, _stateID: 5 });
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 5 });
    mock.timers.tick(1);
    assert.deepEqual(stub._ops, ['stop', 'start', 'stop', 'start']);
  });

  test('stop() clears a pending reconnect-resync so it never fires against a torn-down client', () => {
    const { handle, stub } = startClient();
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 5 });
    stub._subscribers[0]!.callback({ G: null, isConnected: false, _stateID: 5 });
    stub._subscribers[0]!.callback({ G: {}, isConnected: true, _stateID: 5 });
    // reconnect scheduled but not yet fired; tearing down must cancel it
    handle.stop();
    mock.timers.tick(1);
    assert.deepEqual(stub._ops, ['stop']);
  });
});

// why: jsdom's default document URL is `about:blank` and its `location`
// object is non-configurable, so manipulating the URL via
// `history.replaceState` or `Object.defineProperty(window, 'location', …)`
// both fail. App.vue exposes a `searchOverride` prop as a testing seam;
// each App-routing test passes the exact query string it wants to exercise.

describe('App routing', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetLiveClientCallLog();
    const { factory } = makeStubFactory();
    setClientFactoryForTesting(factory);
  });

  afterEach(() => {
    setClientFactoryForTesting(null);
    resetLiveClientCallLog();
  });

  test('empty query string → <LobbyView /> renders (route="lobby")', () => {
    const wrapper = mount(App, { props: { searchOverride: '' } });

    assert.equal(
      wrapper.find('[data-testid="app-root"]').attributes('data-route'),
      'lobby',
    );
    assert.equal(wrapper.find('[data-testid="lobby-view"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="arena-hud"]').exists(), false);
    assert.equal(getLiveClientCallLog().length, 0);
  });

  test('?match=...&player=...&credentials=... → live branch renders ArenaHud and invokes createLiveClient', () => {
    const wrapper = mount(App, {
      props: {
        searchOverride: '?match=match-live&player=0&credentials=secret-live',
      },
    });

    assert.equal(
      wrapper.find('[data-testid="app-root"]').attributes('data-route'),
      'live',
    );
    assert.equal(wrapper.find('[data-testid="lobby-view"]').exists(), false);
    assert.equal(getLiveClientCallLog().length, 1);
    assert.deepEqual(getLiveClientCallLog()[0], {
      matchID: 'match-live',
      playerID: '0',
      credentials: 'secret-live',
      serverUrl: 'http://localhost:8000',
    });
  });

  test('?fixture=mid-turn → fixture path renders ArenaHud and does NOT invoke createLiveClient', () => {
    const wrapper = mount(App, {
      props: { searchOverride: '?fixture=mid-turn' },
    });

    assert.equal(
      wrapper.find('[data-testid="app-root"]').attributes('data-route'),
      'fixture',
    );
    assert.equal(wrapper.find('[data-testid="lobby-view"]').exists(), false);
    assert.equal(getLiveClientCallLog().length, 0);
  });

  test('precedence fixture > live and partial live params fall back to lobby', () => {
    // Part 1: both fixture and live params → fixture wins.
    const fixtureWrapper = mount(App, {
      props: {
        searchOverride:
          '?fixture=mid-turn&match=also-present&player=0&credentials=also-here',
      },
    });
    assert.equal(
      fixtureWrapper
        .find('[data-testid="app-root"]')
        .attributes('data-route'),
      'fixture',
    );
    assert.equal(getLiveClientCallLog().length, 0);

    // Part 2: only ?match= without ?player= / ?credentials= → lobby fallback.
    const partialWrapper = mount(App, {
      props: { searchOverride: '?match=match-only' },
    });
    assert.equal(
      partialWrapper
        .find('[data-testid="app-root"]')
        .attributes('data-route'),
      'lobby',
    );
    assert.equal(
      partialWrapper.find('[data-testid="lobby-view"]').exists(),
      true,
    );
    assert.equal(getLiveClientCallLog().length, 0);
  });
});
