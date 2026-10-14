import '../../testing/jsdom-setup';

/**
 * OperatorSetterPane tests (WP-807 / EC-844 §D).
 *
 * Mounts the pane (real Tweakpane, jsdom, `attachTo: document.body`) against an
 * inline `OperatorView` fixture and a recording `submitMove`. Covers the six
 * folders, every button's exact intent, stable-key "Move card", the off-turn
 * disabled state and its click-time re-check, the Escape candidate, the
 * rebuild (one live pane, empty decks) and the unmount dispose.
 *
 * Test helpers (WP-807 §D, locked): buttons by exact trimmed title among
 * `button.tp-btnv_b`, expecting one; folders from `.tp-fldv_t`; inputs by
 * `.tp-lblv_l` binding label, then a `change` event. Tweakpane's `<option>`s
 * carry no `value` attribute (its list maps `selectedIndex` to the option's
 * bound value), so a list is driven by the option's text → `selectedIndex`.
 */

import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import type { OperatorView, UIState } from '@legendary-arena/game-engine';

import OperatorSetterPane from './OperatorSetterPane.vue';
import type { SubmitMove } from './uiMoveName.types';

enableAutoUnmount(afterEach);

const ALL_BUTTON_TITLES = [
  'Set supply count',
  'Move villain card to top',
  'Reveal a Scheme Twist now',
  'Reveal a Master Strike now',
  'Move hero card to top',
  'Place hero in HQ space',
  'Move card',
  'Add to this turn',
  "Escape the Villain at the City's edge",
];

/** The fixture's adjustable parts. */
interface ViewOptions {
  activePlayerId?: string;
  currentStage?: string;
  hasEdgeVillain?: boolean;
  villainDeck?: string[];
  seatZeroHand?: string[];
}

/**
 * An inline two-seat operator view, on seat 0's turn in `main` unless told otherwise.
 *
 * @param options The parts to change.
 * @returns The view.
 */
function buildView(options: ViewOptions = {}): OperatorView {
  const edgeVillain = options.hasEdgeVillain === false ? null : { extId: 'villain-edge' };
  return {
    board: {
      game: { activePlayerId: options.activePlayerId ?? '0' },
      city: { spaces: [null, null, null, null, edgeVillain] },
    } as unknown as UIState,
    currentStage: options.currentStage ?? 'main',
    seats: [
      {
        playerId: '0',
        deckTopFirst: ['deck-one'],
        hand: options.seatZeroHand ?? ['hand-one', 'hand-two'],
        discard: [],
        inPlay: [],
        victory: [],
        woundsByZone: { deck: 0, hand: 0, discard: 0, inPlay: 0, victory: 0 },
      },
      {
        playerId: '1',
        deckTopFirst: [],
        hand: [],
        discard: ['discard-one'],
        inPlay: [],
        victory: [],
        woundsByZone: { deck: 0, hand: 0, discard: 0, inPlay: 0, victory: 0 },
      },
    ],
    villainDeckTopFirst: options.villainDeck ?? ['villain-a', 'villain-b', 'villain-c'],
    heroDeckTopFirst: ['hero-a', 'hero-b'],
    mastermindTacticsTopFirst: [],
    supplyCounts: { wounds: 30, bystanders: 10, officers: 30, sidekicks: 0 },
    koPile: [],
    escapedPile: [],
    counters: {},
    cardDisplay: {
      'hand-one': { extId: 'hand-one', name: 'Hand One', imageUrl: '', cost: 1 },
      'hand-two': { extId: 'hand-two', name: 'Hand Two', imageUrl: '', cost: 2 },
      inserted: { extId: 'inserted', name: 'Inserted', imageUrl: '', cost: 3 },
      'villain-a': { extId: 'villain-a', name: 'Villain A', imageUrl: '', cost: null },
      'villain-b': { extId: 'villain-b', name: 'Villain B', imageUrl: '', cost: null },
      'villain-c': { extId: 'villain-c', name: 'Villain C', imageUrl: '', cost: null },
      'hero-a': { extId: 'hero-a', name: 'Hero A', imageUrl: '', cost: 3 },
      'hero-b': { extId: 'hero-b', name: 'Hero B', imageUrl: '', cost: 4 },
    },
  } as unknown as OperatorView;
}

/** A recorded `submitMove` call. */
type SubmitCall = [string, unknown];

/**
 * Mount the pane with a recording `submitMove`.
 *
 * @param view The operator view.
 * @returns The wrapper and the recorded calls.
 */
function mountPane(view: OperatorView) {
  const calls: SubmitCall[] = [];
  const submitMove: SubmitMove = (name, args) => {
    calls.push([name, args]);
  };
  const wrapper = mount(OperatorSetterPane, {
    props: { operatorView: view, playerId: '0', submitMove },
    attachTo: document.body,
  });
  return { wrapper, calls };
}

/**
 * The one Tweakpane button with this exact title.
 *
 * @param title The button title.
 * @returns The button element.
 */
function findButton(title: string): HTMLButtonElement {
  const matches = [...document.querySelectorAll<HTMLButtonElement>('button.tp-btnv_b')].filter(
    (button) => button.textContent?.trim() === title,
  );
  assert.equal(matches.length, 1, `exactly one "${title}" button`);
  return matches[0]!;
}

/**
 * The control under the binding with this label.
 *
 * @param label The binding label.
 * @param selector `select` or `input`.
 * @returns The control element.
 */
function findControl(label: string, selector: 'select' | 'input'): HTMLSelectElement | HTMLInputElement {
  const rows = [...document.querySelectorAll('.tp-lblv')].filter(
    (row) => row.querySelector('.tp-lblv_l')?.textContent?.trim() === label,
  );
  assert.equal(rows.length, 1, `exactly one "${label}" binding`);
  const control = rows[0]!.querySelector<HTMLSelectElement | HTMLInputElement>(selector);
  assert.ok(control, `the "${label}" binding has a ${selector}`);
  return control;
}

/**
 * The option texts of a list binding.
 *
 * @param label The binding label.
 * @returns The option texts, in order.
 */
function optionTexts(label: string): string[] {
  const select = findControl(label, 'select') as HTMLSelectElement;
  return [...select.options].map((option) => option.textContent ?? '');
}

/**
 * Choose a list option by its text, then dispatch `change`.
 *
 * @param label The binding label.
 * @param text The option text.
 */
function chooseOption(label: string, text: string): void {
  const select = findControl(label, 'select') as HTMLSelectElement;
  const index = optionTexts(label).indexOf(text);
  assert.notEqual(index, -1, `"${label}" offers "${text}"`);
  select.selectedIndex = index;
  select.dispatchEvent(new window.Event('change'));
}

/**
 * Type a number into a number binding, then dispatch `change`.
 *
 * @param label The binding label.
 * @param value The number.
 */
function enterNumber(label: string, value: number): void {
  const input = findControl(label, 'input') as HTMLInputElement;
  input.value = String(value);
  input.dispatchEvent(new window.Event('change'));
}

/**
 * Click a button the way a script can even when it is disabled.
 *
 * @param button The button.
 */
function dispatchClick(button: HTMLButtonElement): void {
  button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('OperatorSetterPane (WP-807)', () => {
  test('renders six folders in order and the open hint on own turn in main', () => {
    const { wrapper } = mountPane(buildView());
    const folderTitles = [...document.querySelectorAll('.tp-fldv_t')].map((title) => title.textContent?.trim());
    assert.deepEqual(folderTitles, ['Supply', 'Villain deck', 'Hero deck', 'Move a card', 'Turn economy', 'Escape']);
    assert.equal(document.querySelectorAll('.tp-rotv').length, 1);
    assert.equal(
      wrapper.find('[data-testid="operator-setters-hint"]').text(),
      'Setters change the board through the engine. A refused setter changes nothing.',
    );
    for (const title of ALL_BUTTON_TITLES) {
      assert.equal(findButton(title).disabled, false, title);
    }
  });

  test('"Set supply count" submits the bound pile and count, then emits submitted', () => {
    const { wrapper, calls } = mountPane(buildView());
    chooseOption('Pile', 'Bystander');
    enterNumber('Count', 4);
    findButton('Set supply count').click();
    assert.deepEqual(calls, [['operatorSetSupplyCount', { pile: 'bystanders', count: 4 }]]);
    assert.equal(wrapper.emitted('submitted')?.length, 1);
  });

  test('the deck-top buttons submit their own deck with the chosen card', () => {
    const { calls } = mountPane(buildView());
    chooseOption('Villain card', '2. Villain B');
    findButton('Move villain card to top').click();
    chooseOption('Hero card', '2. Hero B');
    findButton('Move hero card to top').click();
    assert.deepEqual(calls, [
      ['operatorMoveToDeckTop', { deck: 'villain', cardId: 'villain-b' }],
      ['operatorMoveToDeckTop', { deck: 'hero', cardId: 'hero-b' }],
    ]);
  });

  test('the reveal buttons submit their own card type', () => {
    const { calls } = mountPane(buildView());
    findButton('Reveal a Scheme Twist now').click();
    findButton('Reveal a Master Strike now').click();
    assert.deepEqual(calls, [
      ['operatorRevealNow', { cardType: 'scheme-twist' }],
      ['operatorRevealNow', { cardType: 'mastermind-strike' }],
    ]);
  });

  test('"Place hero in HQ space" submits HQ index = space − 1 from the hero deck', () => {
    const { calls } = mountPane(buildView());
    chooseOption('Hero card', '2. Hero B');
    enterNumber('HQ space', 3);
    findButton('Place hero in HQ space').click();
    assert.deepEqual(calls, [
      ['operatorMoveCard', { cardId: 'hero-b', from: { zone: 'heroDeck' }, to: { zone: 'hq', hqIndex: 2 } }],
    ]);
  });

  test('"Add to this turn" and the Escape button submit their locked intents', () => {
    const { wrapper, calls } = mountPane(buildView());
    chooseOption('Resource', 'Recruit');
    enterNumber('Amount', 5);
    findButton('Add to this turn').click();
    findButton("Escape the Villain at the City's edge").click();
    assert.deepEqual(calls, [
      ['operatorAddEconomy', { resource: 'recruit', amount: 5 }],
      ['operatorEscapeVillain', {}],
    ]);
    assert.equal(wrapper.emitted('submitted')?.length, 2);
  });

  test('"Move card" submits the chosen source and destination', () => {
    const { calls } = mountPane(buildView());
    chooseOption('Card', 'Player 1 · discard pile · discard-one');
    chooseOption('Destination', 'Player 0 · deck (top)');
    findButton('Move card').click();
    chooseOption('Card', 'Wound supply (top)');
    chooseOption('Destination', 'KO pile');
    findButton('Move card').click();
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], [
      'operatorMoveCard',
      { cardId: 'discard-one', from: { zone: 'discard', playerId: '1' }, to: { zone: 'deck', playerId: '0' } },
    ]);
    const [, supplyArgs] = calls[1]!;
    assert.deepEqual((supplyArgs as { from: unknown }).from, { zone: 'supply', pile: 'wounds' });
    assert.deepEqual((supplyArgs as { to: unknown }).to, { zone: 'ko' });
  });

  test('"Move card" keeps its card by stable key when a card is inserted before it', async () => {
    const { wrapper, calls } = mountPane(buildView());
    chooseOption('Card', 'Player 0 · hand · Hand Two');
    chooseOption('Destination', 'KO pile');
    await wrapper.setProps({ operatorView: buildView({ seatZeroHand: ['hand-one', 'inserted', 'hand-two'] }) });
    assert.equal(document.querySelectorAll('.tp-rotv').length, 1, 'the new option list rebuilt the pane');
    findButton('Move card').click();
    assert.deepEqual(calls, [
      ['operatorMoveCard', { cardId: 'hand-two', from: { zone: 'hand', playerId: '0' }, to: { zone: 'ko' } }],
    ]);
  });

  test('on another seat turn every button is disabled and the hint shows the closed text', () => {
    const { wrapper } = mountPane(buildView({ activePlayerId: '1' }));
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('button.tp-btnv_b')];
    assert.equal(buttons.length, ALL_BUTTON_TITLES.length);
    for (const button of buttons) {
      assert.equal(button.disabled, true, button.textContent?.trim());
    }
    assert.equal(
      wrapper.find('[data-testid="operator-setters-hint"]').text(),
      'Setters run on your turn, in the main stage, with no choice open.',
    );
  });

  test('outside main every button is disabled', () => {
    mountPane(buildView({ currentStage: 'start' }));
    for (const title of ALL_BUTTON_TITLES) {
      assert.equal(findButton(title).disabled, true, title);
    }
  });

  test('the click-time re-check: a dispatched click off-turn submits nothing', () => {
    const { wrapper, calls } = mountPane(buildView({ activePlayerId: '1' }));
    for (const title of ALL_BUTTON_TITLES) {
      dispatchClick(findButton(title));
    }
    assert.deepEqual(calls, []);
    assert.equal(wrapper.emitted('submitted'), undefined);
  });

  test('with no Villain at the City edge the Escape button is disabled and its click submits nothing', () => {
    const { calls } = mountPane(buildView({ hasEdgeVillain: false }));
    const escapeButton = findButton("Escape the Villain at the City's edge");
    assert.equal(escapeButton.disabled, true);
    assert.equal(findButton('Add to this turn').disabled, false, 'only Escape is disabled');
    dispatchClick(escapeButton);
    assert.deepEqual(calls, []);
  });

  test('a view change rebuilds one pane; an empty villain deck rebuilds and submits nothing', async () => {
    const { wrapper, calls } = mountPane(buildView());
    await wrapper.setProps({ operatorView: buildView({ villainDeck: ['villain-b', 'villain-c'] }) });
    assert.equal(document.querySelectorAll('.tp-rotv').length, 1);
    assert.deepEqual(optionTexts('Villain card'), ['1. Villain B', '2. Villain C']);

    await wrapper.setProps({ operatorView: buildView({ villainDeck: [] }) });
    assert.equal(document.querySelectorAll('.tp-rotv').length, 1);
    assert.deepEqual(optionTexts('Villain card'), []);
    findButton('Move villain card to top').click();
    assert.deepEqual(calls, []);
  });

  test('unmount disposes the pane', () => {
    const { wrapper } = mountPane(buildView());
    const host = wrapper.find('[data-testid="operator-setter-pane"]').element;
    assert.notEqual(host.querySelector('.tp-rotv'), null);
    wrapper.unmount();
    assert.equal(host.querySelector('.tp-rotv'), null);
  });
});
