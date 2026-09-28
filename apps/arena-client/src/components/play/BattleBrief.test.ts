import '../../testing/jsdom-setup';

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import type { UIState } from '@legendary-arena/game-engine';

import BattleBrief from './BattleBrief.vue';
import type { SubmitMove } from './uiMoveName.types';
import { useUiStateStore } from '../../stores/uiState';
import { useConnectionStore } from '../../stores/connection';

/**
 * WP-786 / EC-823 — the battle brief. `globalThis.fetch` is stubbed (and
 * restored after each test); no network. The frame gate is proven with seeded
 * connection-store state ids.
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;
let fetchCount = 0;

afterEach(() => {
  globalThis.fetch = originalFetch;
  fetchCount = 0;
});

interface SnapshotOptions {
  readonly phase?: string;
  readonly seats?: number;
  readonly mastermindGameText?: readonly string[];
  readonly schemeGameText?: readonly string[];
  readonly hasSchemeDisplay?: boolean;
}

/**
 * Builds the minimal UIState the brief reads.
 *
 * @param options Phase, seat count, and game-text overrides.
 * @returns A UIState-shaped snapshot.
 */
function buildSnapshot(options: SnapshotOptions = {}): UIState {
  const seats = options.seats ?? 1;
  const players = [];
  for (let seatIndex = 0; seatIndex < seats; seatIndex++) {
    players.push({ playerId: String(seatIndex) });
  }
  const scheme: Record<string, unknown> = {
    id: 'core/midtown-bank-robbery',
    twistCount: 0,
    twistPile: [],
    gameText: options.schemeGameText ?? [
      'Setup: 8 Twists. 12 total Bystanders in the Villain Deck.',
      'Twist: Any Villain in the Bank captures 2 Bystanders.',
      'Evil Wins: When 8 Bystanders are carried away by escaping Villains.',
    ],
  };
  if (options.hasSchemeDisplay !== false) {
    scheme['display'] = { name: 'Midtown Bank Robbery', imageUrl: 'https://img/scheme.webp' };
  }
  return {
    game: { phase: options.phase ?? 'lobby' },
    players,
    mastermind: {
      id: 'core/magneto',
      display: { name: 'Magneto', imageUrl: 'https://img/magneto.webp' },
      gameText: options.mastermindGameText ?? [
        'Always Leads: Brotherhood',
        'Master Strike: Each player reveals an X-Men Hero or discards down to four cards.',
      ],
    },
    scheme,
  } as unknown as UIState;
}

/**
 * Stubs fetch so the match LAGN read returns the given status.
 *
 * @param status HTTP status for the LAGN read.
 */
function stubLagn(status: number): void {
  globalThis.fetch = (async () => {
    fetchCount++;
    if (status !== 200) {
      return { status, json: async () => ({}) } as Response;
    }
    return {
      status: 200,
      json: async () => ({
        lagn: {
          setup: {
            mastermind: { id: 'core/magneto', name: 'Magneto' },
            scheme: { id: 'core/midtown-bank-robbery', name: 'Midtown Bank Robbery' },
            villain_groups: [{ id: 'core/brotherhood', name: 'Brotherhood' }],
            henchmen_groups: [{ id: 'core/sentinel', name: 'Sentinel' }],
            heroes: [
              { id: 'core/spider-man', name: 'Spider-Man' },
              { id: 'core/hulk', name: 'Hulk' },
              { id: 'core/wolverine', name: 'Wolverine' },
            ],
          },
        },
      }),
    } as Response;
  }) as typeof globalThis.fetch;
}

interface RecordedMove {
  readonly name: string;
  readonly args: unknown;
}

/**
 * Mounts the brief with a snapshot and a recording submitMove.
 *
 * @param snapshot The UIState to serve.
 * @param matchId The match id prop.
 * @returns The wrapper and the recorded moves.
 */
function mountBrief(snapshot: UIState, matchId: string = 'match-1') {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(snapshot);
  const moves: RecordedMove[] = [];
  const submitMove: SubmitMove = (name, args) => {
    moves.push({ name, args });
  };
  const wrapper = mount(BattleBrief, { props: { submitMove, matchId } });
  return { wrapper, moves };
}

describe('BattleBrief (WP-786)', () => {
  test('outside the lobby phase it renders nothing and makes no fetch', async () => {
    stubLagn(200);
    const { wrapper } = mountBrief(buildSnapshot({ phase: 'play' }));
    await flushPromises();
    assert.equal(wrapper.find('[data-testid="battle-brief"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="battle-brief-show"]').exists(), false);
    assert.equal(fetchCount, 0);
  });

  test('in the lobby phase it shows the Mastermind, Always Leads, Scheme, Setup, and Evil Wins', async () => {
    stubLagn(200);
    const { wrapper } = mountBrief(buildSnapshot());
    await flushPromises();
    const mastermind = wrapper.find('[data-testid="battle-brief-mastermind"]').text();
    assert.match(mastermind, /Magneto/);
    assert.match(mastermind, /Always Leads/);
    assert.match(mastermind, /Brotherhood/);
    const scheme = wrapper.find('[data-testid="battle-brief-scheme"]').text();
    assert.match(scheme, /Midtown Bank Robbery/);
    assert.match(scheme, /Setup: 8 Twists/);
    assert.match(scheme, /Evil Wins: When 8 Bystanders/);
    assert.doesNotMatch(scheme, /Twist: Any Villain/);
  });

  test('missing lines are omitted, an absent scheme display shows no name, and "Twist N: Evil Wins!" is the fallback', async () => {
    stubLagn(200);
    const { wrapper } = mountBrief(
      buildSnapshot({
        mastermindGameText: ['Master Strike: Each player discards a card.'],
        schemeGameText: ['Setup: 6 Twists.', 'Twist 6: Evil Wins!'],
        hasSchemeDisplay: false,
      }),
    );
    await flushPromises();
    const mastermind = wrapper.find('[data-testid="battle-brief-mastermind"]');
    assert.doesNotMatch(mastermind.text(), /Always Leads/);
    assert.equal(mastermind.findAll('.battle-brief__line').length, 0);
    const scheme = wrapper.find('[data-testid="battle-brief-scheme"]');
    assert.equal(scheme.find('.battle-brief__name').exists(), false);
    assert.match(scheme.text(), /Twist 6: Evil Wins!/);
  });

  test('a successful loadout read lists the villain groups, henchmen, and heroes by name', async () => {
    stubLagn(200);
    const { wrapper } = mountBrief(buildSnapshot());
    await flushPromises();
    const lineup = wrapper.find('[data-testid="battle-brief-lineup"]').text();
    assert.match(lineup, /Brotherhood/);
    assert.match(lineup, /Sentinel/);
    assert.match(lineup, /Spider-Man, Hulk, Wolverine/);
    assert.equal(fetchCount, 1);
  });

  test('a failed loadout read shows the unavailable line and leaves Begin the Battle enabled', async () => {
    stubLagn(500);
    const { wrapper } = mountBrief(buildSnapshot());
    await flushPromises();
    assert.match(
      wrapper.find('[data-testid="battle-brief-lineup-unavailable"]').text(),
      /The lineup could not be loaded\. It will appear on the board\./,
    );
    assert.equal(wrapper.find('[data-testid="battle-brief-enter"]').attributes('disabled'), undefined);
  });

  test('Begin the Battle sends ready now and start only after the next server frame', async () => {
    stubLagn(200);
    const { wrapper, moves } = mountBrief(buildSnapshot());
    await flushPromises();
    const connectionStore = useConnectionStore();
    connectionStore.setConnected(true, 7);
    await flushPromises();
    await wrapper.find('[data-testid="battle-brief-enter"]').trigger('click');
    await flushPromises();
    assert.deepEqual(moves, [{ name: 'setPlayerReady', args: { ready: true } }]);
    connectionStore.setConnected(true, 8);
    await flushPromises();
    assert.deepEqual(moves, [
      { name: 'setPlayerReady', args: { ready: true } },
      { name: 'startMatchIfReady', args: {} },
    ]);
  });

  test('a second click and a further frame send nothing more', async () => {
    stubLagn(200);
    const { wrapper, moves } = mountBrief(buildSnapshot());
    await flushPromises();
    const connectionStore = useConnectionStore();
    connectionStore.setConnected(true, 7);
    const button = wrapper.find('[data-testid="battle-brief-enter"]');
    await button.trigger('click');
    connectionStore.setConnected(true, 8);
    await flushPromises();
    button.element.removeAttribute('disabled');
    await button.trigger('click');
    connectionStore.setConnected(true, 9);
    await flushPromises();
    assert.equal(moves.length, 2);
    assert.equal(wrapper.find('[data-testid="battle-brief-enter"]').text(), 'Beginning…');
  });

  test('the waiting line shows after entry only when more than one seat is at the table', async () => {
    stubLagn(200);
    const twoSeats = mountBrief(buildSnapshot({ seats: 2 }));
    await flushPromises();
    assert.match(twoSeats.wrapper.find('[data-testid="battle-brief-seats"]').text(), /2 seats at the table/);
    assert.equal(twoSeats.wrapper.find('[data-testid="battle-brief-waiting"]').exists(), false);
    await twoSeats.wrapper.find('[data-testid="battle-brief-enter"]').trigger('click');
    assert.match(
      twoSeats.wrapper.find('[data-testid="battle-brief-waiting"]').text(),
      /Waiting for the rest of the table…/,
    );

    const oneSeat = mountBrief(buildSnapshot({ seats: 1 }));
    await flushPromises();
    assert.match(oneSeat.wrapper.find('[data-testid="battle-brief-seats"]').text(), /1 seat at the table/);
    await oneSeat.wrapper.find('[data-testid="battle-brief-enter"]').trigger('click');
    assert.equal(oneSeat.wrapper.find('[data-testid="battle-brief-waiting"]').exists(), false);
  });

  test('Hide brief leaves only the Show button, and Show restores the brief, with no move', async () => {
    stubLagn(200);
    const { wrapper, moves } = mountBrief(buildSnapshot());
    await flushPromises();
    await wrapper.find('.battle-brief__hide').trigger('click');
    assert.equal(wrapper.find('[data-testid="battle-brief"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="battle-brief-show"]').exists(), true);
    await wrapper.find('[data-testid="battle-brief-show"]').trigger('click');
    assert.equal(wrapper.find('[data-testid="battle-brief"]').exists(), true);
    assert.equal(moves.length, 0);
  });
});
