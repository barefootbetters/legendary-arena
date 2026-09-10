/**
 * Tests for PendingKoDiscardChoicePrompt (WP-693 / EC-730 / D-24510 — Loki's
 * Maniacal Tyrant: "KO up to four cards from your discard pile").
 *
 * Covers: chooser-only render gate, empty "KO None" submit, up-to-cap multi-select,
 * over-cap block, and the distinct-ext_id guard (the engine rejects a repeated id).
 * node:test + @vue/test-utils.
 */

import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import type { UIPendingKoDiscardChoice } from '@legendary-arena/game-engine';
import type { SubmitMove } from './uiMoveName.types';

import PendingKoDiscardChoicePrompt from './PendingKoDiscardChoicePrompt.vue';

function makeChoice(cardIds: string[], maxCount = 4): UIPendingKoDiscardChoice {
  return {
    choiceType: 'ko-from-discard',
    playerID: 'player-0',
    maxCount,
    discard: cardIds.map((cardId) => ({ cardId, display: { name: cardId } })),
  } as unknown as UIPendingKoDiscardChoice;
}

describe('PendingKoDiscardChoicePrompt (WP-693 / D-24510)', () => {
  test('renders for the chooser and hides for a non-owner / spectator', () => {
    const owner = mount(PendingKoDiscardChoicePrompt, {
      props: { pendingKoDiscardChoice: makeChoice(['a', 'b']), viewerPlayerId: 'player-0', submitMove: () => {} },
    });
    assert.equal(owner.find('[data-testid="pending-ko-discard-choice-prompt"]').exists(), true);

    const opponent = mount(PendingKoDiscardChoicePrompt, {
      props: { pendingKoDiscardChoice: makeChoice(['a', 'b']), viewerPlayerId: 'player-1', submitMove: () => {} },
    });
    assert.equal(opponent.find('[data-testid="pending-ko-discard-choice-prompt"]').exists(), false);

    const spectator = mount(PendingKoDiscardChoicePrompt, {
      props: { pendingKoDiscardChoice: makeChoice(['a', 'b']), viewerPlayerId: null, submitMove: () => {} },
    });
    assert.equal(spectator.find('[data-testid="pending-ko-discard-choice-prompt"]').exists(), false);
  });

  test('empty selection submits "KO None" (cardIds: [])', async () => {
    let submitted: { name: string; args: unknown } | undefined;
    const submitMove: SubmitMove = (name, args) => { submitted = { name, args }; };
    const wrapper = mount(PendingKoDiscardChoicePrompt, {
      props: { pendingKoDiscardChoice: makeChoice(['a', 'b']), viewerPlayerId: 'player-0', submitMove },
    });
    assert.match(wrapper.find('[data-testid="pending-ko-discard-submit"]').text(), /KO None/);
    await wrapper.find('[data-testid="pending-ko-discard-submit"]').trigger('click');
    assert.deepEqual(submitted, { name: 'resolveKoDiscardChoice', args: { cardIds: [] } });
  });

  test('selecting two cards submits both ext_ids', async () => {
    let submitted: { name: string; args: unknown } | undefined;
    const submitMove: SubmitMove = (name, args) => { submitted = { name, args }; };
    const wrapper = mount(PendingKoDiscardChoicePrompt, {
      props: { pendingKoDiscardChoice: makeChoice(['a', 'b', 'c']), viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-ko-discard-card-0"]').trigger('click');
    await wrapper.find('[data-testid="pending-ko-discard-card-2"]').trigger('click');
    await wrapper.find('[data-testid="pending-ko-discard-submit"]').trigger('click');
    assert.deepEqual(submitted, { name: 'resolveKoDiscardChoice', args: { cardIds: ['a', 'c'] } });
  });

  test('cannot select more than maxCount cards', async () => {
    const wrapper = mount(PendingKoDiscardChoicePrompt, {
      props: { pendingKoDiscardChoice: makeChoice(['a', 'b', 'c'], 2), viewerPlayerId: 'player-0', submitMove: () => {} },
    });
    await wrapper.find('[data-testid="pending-ko-discard-card-0"]').trigger('click');
    await wrapper.find('[data-testid="pending-ko-discard-card-1"]').trigger('click');
    await wrapper.find('[data-testid="pending-ko-discard-card-2"]').trigger('click');
    assert.match(wrapper.find('[data-testid="pending-ko-discard-submit"]').text(), /KO 2 cards/);
  });

  test('cannot select a second copy of an already-selected ext_id (distinct-set guard)', async () => {
    let submitted: { name: string; args: unknown } | undefined;
    const submitMove: SubmitMove = (name, args) => { submitted = { name, args }; };
    // two identical 'dup' cards at index 0 and 1
    const wrapper = mount(PendingKoDiscardChoicePrompt, {
      props: { pendingKoDiscardChoice: makeChoice(['dup', 'dup', 'x']), viewerPlayerId: 'player-0', submitMove },
    });
    await wrapper.find('[data-testid="pending-ko-discard-card-0"]').trigger('click');
    await wrapper.find('[data-testid="pending-ko-discard-card-1"]').trigger('click'); // blocked (same ext_id)
    await wrapper.find('[data-testid="pending-ko-discard-submit"]').trigger('click');
    assert.deepEqual(submitted, { name: 'resolveKoDiscardChoice', args: { cardIds: ['dup'] } });
  });
});
