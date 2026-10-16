import '../../testing/jsdom-setup';

/**
 * OperatorSetterPane tests (WP-807 / EC-844 §D).
 *
 * Mounts the real Tweakpane pane in jsdom (`attachTo: document.body`) against an
 * inline `OperatorView` fixture. Buttons are found by exact title among
 * `button.tp-btnv_b` (the pane and folder titles are buttons too), folders by
 * `.tp-fldv_t`, and inputs by their binding label.
 *
 * Tweakpane values each `<option>` by its list index, not by the bound value, so
 * a list is set by its visible option text (the label the pane shows). Events
 * are built from jsdom's `window` — Node's own `Event` is not one jsdom accepts.
 */

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import type { OperatorView, UIState } from '@legendary-arena/game-engine';

import OperatorSetterPane from './OperatorSetterPane.vue';
import type { UiMoveName } from './uiMoveName.types';

enableAutoUnmount(afterEach);

/** One recorded `submitMove` call. */
interface SubmittedMove {
  name: UiMoveName;
  args: unknown;
}

const OPEN_HINT = 'Setters change the board through the engine. A refused setter changes nothing.';
const CLOSED_HINT = 'Setters run on your turn, in the main stage, with no choice open.';

const BUTTON_TITLES = [
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

/**
 * The inline operator view: seat 0's turn in `main`, a Villain at the escape edge.
 *
 * @param overrides Fields that replace the defaults.
 * @param activePlayerId The seat whose turn it is.
 * @param edgeCard What City space 4 holds.
 * @returns The view.
 */
function buildView(
  overrides: Partial<OperatorView> = {},
  activePlayerId: string = '0',
  edgeCard: unknown = { extId: 'villain-edge' },
): OperatorView {
  return {
    board: {
      game: { activePlayerId },
      city: { spaces: [null, null, null, null, edgeCard], escapedPile: [] },
    } as unknown as UIState,
    currentStage: 'main',
    seats: [
      {
        playerId: '0',
        deckTopFirst: ['deck-top'],
        hand: ['hand-first', 'hand-second'],
        discard: [],
        inPlay: [],
        victory: [],
        woundsByZone: { deck: 0, hand: 0, discard: 0, inPlay: 0, victory: 0 },
      },
      {
        playerId: '1',
        deckTopFirst: [],
        hand: [],
        discard: [],
        inPlay: [],
        victory: [],
        woundsByZone: { deck: 0, hand: 0, discard: 0, inPlay: 0, victory: 0 },
      },
    ],
    villainDeckTopFirst: ['v-top', 'v-deep'],
    heroDeckTopFirst: ['h-top', 'h-deep'],
    mastermindTacticsTopFirst: [],
    supplyCounts: { wounds: 30, bystanders: 30, officers: 30, sidekicks: 0 },
    koPile: [],
    escapedPile: [],
    counters: {},
    cardDisplay: {
      'v-top': { extId: 'v-top', name: 'Villain Top', imageUrl: '', cost: null },
      'v-deep': { extId: 'v-deep', name: 'Villain Deep', imageUrl: '', cost: null },
    },
    ...overrides,
  };
}

/**
 * Mount the pane and record every submit.
 *
 * @param view The operator view.
 * @returns The wrapper and the recorded submits.
 */
async function mountPane(view: OperatorView = buildView()) {
  const submitted: SubmittedMove[] = [];
  const wrapper = mount(OperatorSetterPane, {
    props: {
      operatorView: view,
      playerId: '0',
      submitMove: (name: UiMoveName, args: unknown) => {
        submitted.push({ name, args });
      },
    },
    attachTo: document.body,
  });
  await flushPromises();
  return { wrapper, submitted };
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
 * The input or select of the binding with this label.
 *
 * @param label The binding label.
 * @returns The control element.
 */
function findControl(label: string): HTMLSelectElement | HTMLInputElement {
  const rows = [...document.querySelectorAll('.tp-lblv')].filter(
    (row) => row.querySelector('.tp-lblv_l')?.textContent?.trim() === label,
  );
  assert.equal(rows.length, 1, `exactly one "${label}" binding`);
  const control = rows[0]!.querySelector('select') ?? rows[0]!.querySelector('input');
  assert.ok(control !== null, `the "${label}" binding has a control`);
  return control;
}

/**
 * Pick a list option by its visible text and fire `change`, as a user would.
 *
 * @param label The binding label.
 * @param optionText The option's text.
 */
function setList(label: string, optionText: string): void {
  const select = findControl(label) as HTMLSelectElement;
  const index = [...select.options].findIndex((option) => option.textContent?.trim() === optionText);
  assert.notEqual(index, -1, `"${label}" offers "${optionText}"`);
  select.selectedIndex = index;
  select.dispatchEvent(new window.Event('change'));
}

/**
 * Type a number into a binding and fire `change`, as a user edit would.
 *
 * @param label The binding label.
 * @param value The new number.
 */
function setNumber(label: string, value: number): void {
  const input = findControl(label);
  input.value = String(value);
  input.dispatchEvent(new window.Event('change'));
}

/**
 * The option texts of a list binding.
 *
 * @param label The binding label.
 * @returns The texts, in list order.
 */
function listTexts(label: string): string[] {
  const select = findControl(label) as HTMLSelectElement;
  return [...select.options].map((option) => option.textContent?.trim() ?? '');
}

/**
 * Click an enabled button and return the single submit it produced.
 *
 * @param title The button title.
 * @param submitted The recorded submits.
 * @returns The submit.
 */
function clickAndTakeSubmit(title: string, submitted: SubmittedMove[]): SubmittedMove {
  const before = submitted.length;
  const button = findButton(title);
  assert.equal(button.disabled, false, `"${title}" is enabled`);
  button.click();
  assert.equal(submitted.length, before + 1, `"${title}" submits exactly once`);
  return submitted[submitted.length - 1]!;
}

describe('OperatorSetterPane (WP-807)', () => {
  test('renders six folders in order and the open hint on the own turn in main', async () => {
    const { wrapper } = await mountPane();
    const folderTitles = [...document.querySelectorAll('.tp-fldv_t')].map((title) => title.textContent?.trim());
    assert.deepEqual(folderTitles, ['Supply', 'Villain deck', 'Hero deck', 'Move a card', 'Turn economy', 'Escape']);
    assert.equal(wrapper.find('[data-testid="operator-setters-hint"]').text(), OPEN_HINT);
    assert.equal(document.querySelectorAll('.tp-rotv').length, 1);
  });

  test('"Set supply count" submits the bound pile and count, then emits submitted', async () => {
    const { wrapper, submitted } = await mountPane();
    setList('Pile', 'Bystander');
    setNumber('Count', 4);
    const move = clickAndTakeSubmit('Set supply count', submitted);
    assert.deepEqual(move, { name: 'operatorSetSupplyCount', args: { pile: 'bystanders', count: 4 } });
    assert.equal(wrapper.emitted('submitted')?.length, 1);
  });

  test('the deck, reveal, escape, economy and HQ buttons each submit their locked intent', async () => {
    const { wrapper, submitted } = await mountPane();
    setList('Villain card', '2. Villain Deep');
    assert.deepEqual(clickAndTakeSubmit('Move villain card to top', submitted), {
      name: 'operatorMoveToDeckTop',
      args: { deck: 'villain', cardId: 'v-deep' },
    });
    setList('Hero card', '2. h-deep');
    assert.deepEqual(clickAndTakeSubmit('Move hero card to top', submitted), {
      name: 'operatorMoveToDeckTop',
      args: { deck: 'hero', cardId: 'h-deep' },
    });
    assert.deepEqual(clickAndTakeSubmit('Reveal a Scheme Twist now', submitted), {
      name: 'operatorRevealNow',
      args: { cardType: 'scheme-twist' },
    });
    assert.deepEqual(clickAndTakeSubmit('Reveal a Master Strike now', submitted), {
      name: 'operatorRevealNow',
      args: { cardType: 'mastermind-strike' },
    });
    assert.deepEqual(clickAndTakeSubmit("Escape the Villain at the City's edge", submitted), {
      name: 'operatorEscapeVillain',
      args: {},
    });
    setList('Resource', 'Recruit');
    setNumber('Amount', 5);
    assert.deepEqual(clickAndTakeSubmit('Add to this turn', submitted), {
      name: 'operatorAddEconomy',
      args: { resource: 'recruit', amount: 5 },
    });
    setNumber('HQ space', 3);
    assert.deepEqual(clickAndTakeSubmit('Place hero in HQ space', submitted), {
      name: 'operatorMoveCard',
      args: { cardId: 'h-deep', from: { zone: 'heroDeck' }, to: { zone: 'hq', hqIndex: 2 } },
    });
    assert.equal(wrapper.emitted('submitted')?.length, 7);
  });

  test('"Move card" submits the chosen source and destination', async () => {
    const { submitted } = await mountPane();
    setList('Card', 'You (Player 0) · hand · hand-second');
    setList('Destination', 'Player 1 · discard pile');
    assert.deepEqual(clickAndTakeSubmit('Move card', submitted), {
      name: 'operatorMoveCard',
      args: {
        cardId: 'hand-second',
        from: { zone: 'hand', playerId: '0' },
        to: { zone: 'discard', playerId: '1' },
      },
    });
  });

  test('"Move card" keeps its card by stable key when a card is inserted before it', async () => {
    const { wrapper, submitted } = await mountPane();
    setList('Card', 'You (Player 0) · hand · hand-second');
    setList('Destination', 'KO pile');
    const view = buildView();
    const shifted = buildView({
      seats: [{ ...view.seats[0]!, hand: ['hand-inserted', 'hand-first', 'hand-second'] }, view.seats[1]!],
    });
    await wrapper.setProps({ operatorView: shifted });
    await flushPromises();
    const move = clickAndTakeSubmit('Move card', submitted);
    assert.deepEqual(move.args, {
      cardId: 'hand-second',
      from: { zone: 'hand', playerId: '0' },
      to: { zone: 'ko' },
    });
  });

  test('off-turn: every button is disabled and the hint shows the closed text', async () => {
    const { wrapper } = await mountPane(buildView({}, '1'));
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('button.tp-btnv_b')];
    assert.equal(buttons.length, BUTTON_TITLES.length);
    for (const button of buttons) {
      assert.equal(button.disabled, true, `${button.textContent?.trim()} is disabled`);
    }
    assert.equal(wrapper.find('[data-testid="operator-setters-hint"]').text(), CLOSED_HINT);
  });

  test('outside the main stage every button is disabled', async () => {
    await mountPane(buildView({ currentStage: 'start' }));
    for (const title of BUTTON_TITLES) {
      assert.equal(findButton(title).disabled, true, `${title} is disabled`);
    }
  });

  test('off-turn: a dispatched click on every button submits nothing (the click re-check)', async () => {
    const { wrapper, submitted } = await mountPane(buildView({}, '1'));
    for (const title of BUTTON_TITLES) {
      findButton(title).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    }
    assert.equal(submitted.length, 0);
    assert.equal(wrapper.emitted('submitted'), undefined);
  });

  test('with no Villain at the City edge the Escape button is disabled on the own turn', async () => {
    await mountPane(buildView({}, '0', null));
    assert.equal(findButton("Escape the Villain at the City's edge").disabled, true);
    assert.equal(findButton('Move card').disabled, false, 'the other setters stay enabled');
  });

  test('an operatorView change rebuilds one pane without the removed card', async () => {
    const { wrapper, submitted } = await mountPane();
    assert.deepEqual(listTexts('Villain card'), ['1. Villain Top', '2. Villain Deep']);
    await wrapper.setProps({ operatorView: buildView({ villainDeckTopFirst: ['v-deep'] }) });
    await flushPromises();
    assert.equal(document.querySelectorAll('.tp-rotv').length, 1);
    assert.deepEqual(listTexts('Villain card'), ['1. Villain Deep']);

    await wrapper.setProps({ operatorView: buildView({ villainDeckTopFirst: [] }) });
    await flushPromises();
    assert.equal(document.querySelectorAll('.tp-rotv').length, 1);
    assert.deepEqual(listTexts('Villain card'), []);
    findButton('Move villain card to top').click();
    assert.equal(submitted.length, 0, 'an empty villain deck submits nothing');
  });

  test('unmount disposes the pane', async () => {
    const { wrapper } = await mountPane();
    const host = wrapper.find('[data-testid="operator-setter-pane"]').element;
    assert.notEqual(host.querySelector('.tp-rotv'), null);
    wrapper.unmount();
    assert.equal(host.querySelector('.tp-rotv'), null);
  });
});
