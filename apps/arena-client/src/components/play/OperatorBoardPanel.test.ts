import '../../testing/jsdom-setup';

/**
 * OperatorBoardPanel tests (WP-804 / EC-841).
 *
 * Mounts the panel against an inline `OperatorBoardResponse` fixture served by
 * a stubbed `globalThis.fetch`, a real Pinia (auth + uiState) and node:test
 * mock timers (only `setTimeout`; `flushPromises` runs on `setImmediate`).
 * Covers the five sections, card names with the raw-id fallback, decisions
 * newest first with their turn unchanged, collapse stopping the poll, both
 * downloads (the `GameLogDownloadButton.test.ts` pattern — no ESM module
 * mocking), and an error keeping the last board.
 */

import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import type { UIState } from '@legendary-arena/game-engine';

import OperatorBoardPanel from './OperatorBoardPanel.vue';
import { OPERATOR_BOARD_POLL_MS } from '../../composables/useOperatorBoard';
import { useAuthStore } from '../../stores/auth';
import { useUiStateStore } from '../../stores/uiState';
import { loadUiStateFixture } from '../../fixtures/uiState/index';
import type { OperatorBoardResponse } from '../../lib/api/operatorMatchApi';

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;

/**
 * Twelve effect traces, oldest first, so the panel's "last 10" drops the
 * first two.
 *
 * @returns The trace list.
 */
function buildEffectTraces(): NonNullable<UIState['effectTraces']> {
  const traces: NonNullable<UIState['effectTraces']> = [];
  for (let i = 1; i <= 12; i += 1) {
    traces.push({
      cardId: `trace-card-${i}`,
      scope: 'hero',
      timing: 'onPlay',
      effect: 'drawCards',
      handler: 'drawCards',
      status: i === 12 ? 'hollow' : 'executed',
      fireSite: 'heroPlay',
      params: {},
      turn: 3,
    } as unknown as NonNullable<UIState['effectTraces']>[number]);
  }
  return traces;
}

/**
 * The inline board fixture.
 *
 * @returns A full operator board response.
 */
function buildBoardFixture(): OperatorBoardResponse {
  return {
    matchId: 'op-match-1',
    operatorView: {
      board: { effectTraces: buildEffectTraces() } as unknown as UIState,
      currentStage: 'main',
      seats: [
        {
          playerId: '0',
          deckTopFirst: ['hero-deck-top', 'hero-deck-second'],
          hand: ['hero-hulk-smash', 'card-without-display'],
          discard: ['wound-a'],
          inPlay: [],
          victory: [],
          woundsByZone: { deck: 0, hand: 0, discard: 1, inPlay: 0, victory: 0 },
        },
        {
          playerId: '1',
          deckTopFirst: [],
          hand: ['wound-b'],
          discard: [],
          inPlay: [],
          victory: ['villain-defeated'],
          woundsByZone: { deck: 0, hand: 1, discard: 0, inPlay: 0, victory: 0 },
        },
      ],
      villainDeckTopFirst: ['villain-next', 'villain-after'],
      heroDeckTopFirst: ['hq-next'],
      mastermindTacticsTopFirst: ['tactic-one'],
      supplyCounts: { wounds: 28, bystanders: 20, officers: 30, sidekicks: 0 },
      koPile: [],
      escapedPile: ['villain-escaped'],
      counters: { escapedVillains: 1 },
      cardDisplay: {
        'hero-hulk-smash': { extId: 'hero-hulk-smash', name: 'Hulk Smash', imageUrl: '', cost: 5 },
        'villain-next': { extId: 'villain-next', name: 'Doombot Legion', imageUrl: '', cost: null },
        'trace-card-12': { extId: 'trace-card-12', name: 'Sonic Blast', imageUrl: '', cost: 4 },
      },
    },
    botDecisions: [
      {
        turn: 2,
        seat: '1',
        isForced: true,
        move: { name: 'endTurn', args: {} },
        decisionLog: ['only one legal move'],
        legalMoveCount: 1,
      },
      {
        turn: 3,
        seat: '1',
        isForced: false,
        move: { name: 'playCard', args: { cardId: 'x' } },
        decisionLog: ['scored 4 candidates', 'picked the highest'],
        legalMoveCount: 4,
      },
    ],
  } as unknown as OperatorBoardResponse;
}

/**
 * Stub fetch so every board request answers 200 with the fixture, or with the
 * given failure once `failAfter` successes have been served.
 *
 * @param failAfter How many requests succeed before every later one fails.
 * @returns A counter of board requests.
 */
function stubBoard(failAfter: number = Number.POSITIVE_INFINITY): () => number {
  let requestCount = 0;
  globalThis.fetch = (async () => {
    requestCount += 1;
    if (requestCount > failAfter) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'The board read failed.' }),
      } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => buildBoardFixture() } as unknown as Response;
  }) as typeof globalThis.fetch;
  return () => requestCount;
}

/**
 * Mount the panel and let its first poll land.
 *
 * @returns The mounted wrapper.
 */
async function mountPanel() {
  const wrapper = mount(OperatorBoardPanel, { props: { matchId: 'op-match-1' } });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  useAuthStore().setSession('admin-token', null);
  mock.timers.enable({ apis: ['setTimeout'] });
});

afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
  globalThis.fetch = originalFetch;
});

describe('OperatorBoardPanel (WP-804)', () => {
  test('renders all five sections, expanded on mount', async () => {
    stubBoard();
    const wrapper = await mountPanel();
    assert.equal(wrapper.find('[data-testid="operator-board-panel"]').exists(), true);
    assert.equal(
      wrapper.find('[data-testid="operator-board-toggle"]').attributes('aria-expanded'),
      'true',
    );
    for (const section of ['operator-seats', 'operator-decks', 'operator-piles', 'operator-engine', 'operator-bot-decisions']) {
      assert.equal(wrapper.find(`[data-testid="${section}"]`).exists(), true, section);
    }
    const decks = wrapper.find('[data-testid="operator-decks"]').text();
    assert.match(decks, /Doombot Legion, villain-after/, 'the villain deck is top-first, by name');
    const piles = wrapper.find('[data-testid="operator-piles"]').text();
    assert.match(piles, /wounds 28/);
    const engine = wrapper.find('[data-testid="operator-engine"]').text();
    assert.match(engine, /Stage: main/);
    assert.match(engine, /escapedVillains: 1/);
  });

  test('labels cards by name and falls back to the raw id', async () => {
    stubBoard();
    const wrapper = await mountPanel();
    const seats = wrapper.find('[data-testid="operator-seats"]').text();
    assert.match(seats, /Hulk Smash/);
    assert.match(seats, /card-without-display/, 'a card with no display entry shows its id');
    assert.doesNotMatch(seats, /hero-hulk-smash/, 'a card with a display entry shows its name, not its id');
  });

  test('lists the last 10 effect traces from the operator board as name + status', async () => {
    stubBoard();
    const wrapper = await mountPanel();
    const engine = wrapper.find('[data-testid="operator-engine"]').text();
    assert.match(engine, /Sonic Blast — hollow/);
    assert.match(engine, /trace-card-3 — executed/);
    assert.doesNotMatch(engine, /trace-card-2 /, 'only the last 10 are listed');
  });

  test('shows bot decisions newest first with their turn unchanged', async () => {
    stubBoard();
    const wrapper = await mountPanel();
    const entries = wrapper.findAll('[data-testid="operator-bot-decisions"] li.operator-decision');
    assert.equal(entries.length, 2);
    assert.match(entries[0]!.text(), /Turn 3 · seat 1 · policy · playCard · 4 legal/);
    assert.match(entries[0]!.text(), /picked the highest/);
    assert.match(entries[1]!.text(), /Turn 2 · seat 1 · forced · endTurn · 1 legal/);
  });

  test('the toggle collapses the panel and stops polling', async () => {
    const requestCount = stubBoard();
    const wrapper = await mountPanel();
    assert.equal(requestCount(), 1);

    await wrapper.find('[data-testid="operator-board-toggle"]').trigger('click');
    await flushPromises();
    assert.equal(
      wrapper.find('[data-testid="operator-board-toggle"]').attributes('aria-expanded'),
      'false',
    );
    assert.equal(wrapper.find('[data-testid="operator-seats"]').exists(), false);
    mock.timers.tick(OPERATOR_BOARD_POLL_MS * 3);
    await flushPromises();
    assert.equal(requestCount(), 1, 'no board request while collapsed');
  });

  test('Refresh fetches the board now', async () => {
    const requestCount = stubBoard();
    const wrapper = await mountPanel();
    await wrapper.find('[data-testid="operator-board-refresh"]').trigger('click');
    await flushPromises();
    assert.equal(requestCount(), 2);
  });

  test('an error keeps the last board on screen', async () => {
    stubBoard(1);
    const wrapper = await mountPanel();
    assert.equal(wrapper.find('[data-testid="operator-board-error"]').exists(), false);

    mock.timers.tick(OPERATOR_BOARD_POLL_MS);
    await flushPromises();
    assert.equal(
      wrapper.find('[data-testid="operator-board-error"]').text(),
      'The board read failed.',
    );
    assert.equal(wrapper.find('[data-testid="operator-seats"]').exists(), true, 'the last board stays');
  });

  test('both downloads produce the locked file names and bodies', async () => {
    stubBoard();
    const fixtureSnapshot = loadUiStateFixture('mid-turn');
    useUiStateStore().setSnapshot(fixtureSnapshot);
    mock.method(Date, 'now', () => 1700000000000);
    const wrapper = await mountPanel();

    // jsdom exposes no URL.createObjectURL, so stub it to capture the Blob, and
    // intercept the anchor's click via a document.createElement spy to capture
    // the download file name instead of performing a real browser save.
    const urlApi = URL as unknown as {
      createObjectURL: ((blob: Blob) => string) | undefined;
      revokeObjectURL: ((url: string) => void) | undefined;
    };
    const originalCreateObjectUrl = urlApi.createObjectURL;
    const originalRevokeObjectUrl = urlApi.revokeObjectURL;
    const blobs: Blob[] = [];
    urlApi.createObjectURL = (blob: Blob) => {
      blobs.push(blob);
      return 'blob:stub';
    };
    urlApi.revokeObjectURL = () => {};
    const realCreateElement = document.createElement.bind(document);
    const downloadedNames: string[] = [];
    (document as unknown as { createElement: typeof document.createElement }).createElement = ((
      tagName: string,
    ) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') {
        // why: override the instance click so the "download" is observed, not performed.
        (element as HTMLAnchorElement).click = function click(this: HTMLAnchorElement): void {
          downloadedNames.push(this.download);
        };
      }
      return element;
    }) as typeof document.createElement;

    try {
      await wrapper.find('[data-testid="operator-download-snapshot"]').trigger('click');
      await wrapper.find('[data-testid="operator-download-fixture"]').trigger('click');
    } finally {
      urlApi.createObjectURL = originalCreateObjectUrl;
      urlApi.revokeObjectURL = originalRevokeObjectUrl;
      (document as unknown as { createElement: typeof document.createElement }).createElement =
        realCreateElement as typeof document.createElement;
    }

    assert.deepEqual(downloadedNames, [
      'legendary-arena-operator-op-match-1-1700000000000.json',
      'legendary-arena-fixture-op-match-1-1700000000000.json',
    ]);
    assert.equal(blobs.length, 2);
    assert.equal(blobs[0]!.type, 'application/json');
    const fixture = buildBoardFixture();
    assert.deepEqual(JSON.parse(await blobs[0]!.text()), {
      matchId: 'op-match-1',
      capturedAtMs: 1700000000000,
      operatorView: fixture.operatorView,
      botDecisions: fixture.botDecisions,
    });
    assert.deepEqual(JSON.parse(await blobs[1]!.text()), JSON.parse(JSON.stringify(fixtureSnapshot)));
  });
});

/**
 * The board fixture with the fields the WP-807 setter pane reads: the active
 * seat and the City's spaces, plus set-aside counts when asked.
 *
 * @param hasSetAside Whether the view carries `setAsideCounts`.
 * @returns A full operator board response.
 */
function buildSetterBoardFixture(hasSetAside: boolean): OperatorBoardResponse {
  const fixture = buildBoardFixture();
  const board = {
    ...fixture.operatorView.board,
    game: { activePlayerId: '0' },
    city: { spaces: [null, null, null, null, null], escapedPile: [] },
  } as unknown as UIState;
  const operatorView = { ...fixture.operatorView, board };
  if (hasSetAside) {
    return {
      ...fixture,
      operatorView: { ...operatorView, setAsideCounts: { wounds: 30, bystanders: 2, officers: 0, sidekicks: 1 } },
    };
  }
  return { ...fixture, operatorView };
}

/**
 * Stub fetch so every board request answers 200 with the setter fixture.
 *
 * @param hasSetAside Whether the view carries `setAsideCounts`.
 * @returns A counter of board requests.
 */
function stubSetterBoard(hasSetAside: boolean = false): () => number {
  let requestCount = 0;
  globalThis.fetch = (async () => {
    requestCount += 1;
    return { ok: true, status: 200, json: async () => buildSetterBoardFixture(hasSetAside) } as unknown as Response;
  }) as typeof globalThis.fetch;
  return () => requestCount;
}

/**
 * Mount the panel with the given optional props and let the lazy pane load.
 *
 * @param extraProps `submitMove` and / or `playerId`.
 * @returns The mounted wrapper.
 */
async function mountSetterPanel(extraProps: Record<string, unknown>) {
  const wrapper = mount(OperatorBoardPanel, {
    props: { matchId: 'op-match-1', ...extraProps },
    attachTo: document.body,
  });
  for (let i = 0; i < 5; i += 1) {
    await flushPromises();
  }
  return wrapper;
}

describe('OperatorBoardPanel setter pane (WP-807)', () => {
  const noopSubmitMove = () => {};

  test('no setter pane without a submitMove', async () => {
    stubSetterBoard();
    const wrapper = await mountSetterPanel({ playerId: '0' });
    assert.equal(wrapper.find('[data-testid="operator-seats"]').exists(), true, 'the board loaded');
    assert.equal(wrapper.find('[data-testid="operator-setters"]').exists(), false);
  });

  test('no setter pane with a submitMove but an empty playerId', async () => {
    stubSetterBoard();
    const wrapper = await mountSetterPanel({ submitMove: noopSubmitMove, playerId: '' });
    assert.equal(wrapper.find('[data-testid="operator-seats"]').exists(), true, 'the board loaded');
    assert.equal(wrapper.find('[data-testid="operator-setters"]').exists(), false);
  });

  test('the setter pane appears with a submitMove and a playerId', async () => {
    stubSetterBoard();
    const wrapper = await mountSetterPanel({ submitMove: noopSubmitMove, playerId: '0' });
    assert.equal(wrapper.find('[data-testid="operator-setters"]').exists(), true);
  });

  test('a submitted event fetches the board at once', async () => {
    const requestCount = stubSetterBoard();
    const wrapper = await mountSetterPanel({ submitMove: noopSubmitMove, playerId: '0' });
    assert.equal(requestCount(), 1);
    wrapper.findComponent({ name: 'OperatorSetterPane' }).vm.$emit('submitted');
    await flushPromises();
    assert.equal(requestCount(), 2);
  });

  test('the set-aside line renders only when setAsideCounts is present', async () => {
    stubSetterBoard(false);
    const withoutSetAside = await mountSetterPanel({ submitMove: noopSubmitMove, playerId: '0' });
    assert.equal(withoutSetAside.find('[data-testid="operator-set-aside"]').exists(), false);
    withoutSetAside.unmount();

    stubSetterBoard(true);
    const withSetAside = await mountSetterPanel({ submitMove: noopSubmitMove, playerId: '0' });
    assert.equal(
      withSetAside.find('[data-testid="operator-set-aside"]').text(),
      'Set aside — Wounds 30, Bystanders 2, Officers 0, Sidekicks 1',
    );
  });
});
