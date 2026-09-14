import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import TurnActionBar from './TurnActionBar.vue';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

interface RecordedCall {
  name: UiMoveName;
  args: unknown;
}

function recorder(): { calls: RecordedCall[]; submitMove: SubmitMove } {
  const calls: RecordedCall[] = [];
  const submitMove: SubmitMove = (name, args) => {
    calls.push({ name, args });
  };
  return { calls, submitMove };
}

const ACTIVE = 'turn-action-bar__step--active';
const PRIMARY = 'turn-action-bar__action--primary';

// Jeff feedback (turn-bar one-click rebuild): the three Step boxes stay, but
// "Play Hand" and "Pass priority" / "Continue to Play" are gone. Reveal and End
// turn each work in ONE click, driven by state watchers rather than a synchronous
// two-move chain, and each Step box lights up only when its own button is usable.
describe('TurnActionBar — Step 1 Reveal (one click, watcher auto-advance)', () => {
  test('Reveal click emits revealVillainCard only (the watcher advances, not a chained move)', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', hasRevealedVillain: false, submitMove },
    });
    void wrapper.find('[data-testid="play-action-reveal"]').trigger('click');
    assert.equal(calls.length, 1, 'only the reveal move fires on click');
    assert.equal(calls[0]!.name, 'revealVillainCard');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('the watcher auto-advances start → main once the villain is revealed and nothing is pending', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', hasRevealedVillain: false, submitMove },
    });
    // the reveal is confirmed in state (server sets villainRevealedThisTurn)
    await wrapper.setProps({ hasRevealedVillain: true });
    assert.equal(calls.length, 1, 'the watcher fires exactly one advanceStage');
    assert.equal(calls[0]!.name, 'advanceStage');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('the auto-advance waits for a parked choice (Master Strike) and fires once it is resolved', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'start',
        hasRevealedVillain: true,
        hasPendingKoChoice: true,
        submitMove,
      },
    });
    // revealed but a KO choice is pending → do NOT advance yet
    assert.equal(calls.length, 0, 'no advance while a choice is pending');
    // the player resolves the KO
    await wrapper.setProps({ hasPendingKoChoice: false });
    assert.equal(calls.length, 1, 'advance fires once the choice clears');
    assert.equal(calls[0]!.name, 'advanceStage');
  });

  test('the auto-advance never fires when it is not the viewer’s turn', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', isViewerTurn: false, hasRevealedVillain: false, submitMove },
    });
    await wrapper.setProps({ hasRevealedVillain: true });
    assert.equal(calls.length, 0, 'a non-active client never dispatches the advance');
  });

  test('Reveal is a single static control (no "Continue to Play"); disabled once revealed', () => {
    const { submitMove } = recorder();
    const before = mount(TurnActionBar, {
      props: { currentStage: 'start', hasRevealedVillain: false, submitMove },
    });
    const beforeBtn = before.find('[data-testid="play-action-reveal"]');
    assert.match(beforeBtn.text(), /Reveal top of Villain Deck/);
    assert.equal(beforeBtn.attributes('disabled'), undefined, 'enabled before the reveal');

    const after = mount(TurnActionBar, {
      props: { currentStage: 'start', hasRevealedVillain: true, submitMove },
    });
    const afterBtn = after.find('[data-testid="play-action-reveal"]');
    assert.match(afterBtn.text(), /Reveal top of Villain Deck/, 'label never becomes "Continue to Play"');
    assert.equal(afterBtn.attributes('disabled'), '', 'disabled once the villain is revealed');
  });

  test('Reveal is disabled with a stage tooltip outside the start step', () => {
    const { submitMove } = recorder();
    for (const stage of ['main', 'cleanup'] as const) {
      const wrapper = mount(TurnActionBar, {
        props: { currentStage: stage, submitMove },
      });
      const reveal = wrapper.find('[data-testid="play-action-reveal"]');
      assert.equal(reveal.attributes('disabled'), '');
      assert.match(reveal.attributes('title')!, /Only available during the Start/);
    }
  });

  test('Reveal drops DOM focus after the click', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', submitMove },
      attachTo: document.body,
    });
    const reveal = wrapper.find('[data-testid="play-action-reveal"]');
    const el = reveal.element as HTMLButtonElement;
    el.focus();
    assert.equal(document.activeElement, el);
    void reveal.trigger('click');
    assert.notEqual(document.activeElement, el, 'reveal loses focus after firing');
    wrapper.unmount();
  });
});

describe('TurnActionBar — Step 3 End turn (one click, single terminator)', () => {
  test('End turn from cleanup ends the turn directly (one endTurn move)', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'cleanup', submitMove },
    });
    void wrapper.find('[data-testid="play-action-end-turn"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'endTurn');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('End turn from main advances then ends in one click (advanceStage, then the watcher fires endTurn)', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', submitMove },
    });
    void wrapper.find('[data-testid="play-action-end-turn"]').trigger('click');
    assert.equal(calls.length, 1, 'the click advances to cleanup');
    assert.equal(calls[0]!.name, 'advanceStage');
    // the advance is confirmed (server flips the stage to cleanup)
    await wrapper.setProps({ currentStage: 'cleanup' });
    assert.equal(calls.length, 2, 'the watcher then ends the turn');
    assert.equal(calls[1]!.name, 'endTurn');
  });

  test('End turn from main does not re-fire on a double click', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', submitMove },
    });
    const btn = wrapper.find('[data-testid="play-action-end-turn"]');
    void btn.trigger('click');
    void btn.trigger('click');
    assert.equal(calls.length, 1, 'only one advanceStage while the end is in flight');
    assert.equal(calls[0]!.name, 'advanceStage');
  });

  test('End turn is enabled at main and cleanup, blocked at start (reveal first)', () => {
    const { submitMove } = recorder();
    const startEnd = mount(TurnActionBar, { props: { currentStage: 'start', submitMove } })
      .find('[data-testid="play-action-end-turn"]');
    assert.equal(startEnd.attributes('disabled'), '');
    assert.match(startEnd.attributes('title')!, /Reveal the villain/);

    for (const stage of ['main', 'cleanup'] as const) {
      const end = mount(TurnActionBar, { props: { currentStage: stage, submitMove } })
        .find('[data-testid="play-action-end-turn"]');
      assert.equal(end.attributes('disabled'), undefined, `End turn enabled at ${stage}`);
    }
  });

  test('End turn is blocked at EVERY stage with the KO tooltip when hasPendingKoChoice is true', () => {
    const { submitMove } = recorder();
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const end = mount(TurnActionBar, {
        props: { currentStage: stage, submitMove, hasPendingKoChoice: true },
      }).find('[data-testid="play-action-end-turn"]');
      assert.equal(end.attributes('disabled'), '', `end-turn disabled at ${stage}`);
      assert.match(end.attributes('title')!, /Choose a Hero to KO/);
    }
  });

  test('End turn is blocked with the discard tooltip when hasPendingDiscardChoice is true', () => {
    const { submitMove } = recorder();
    const end = mount(TurnActionBar, {
      props: { currentStage: 'main', submitMove, hasPendingDiscardChoice: true },
    }).find('[data-testid="play-action-end-turn"]');
    assert.equal(end.attributes('disabled'), '');
    assert.match(end.attributes('title')!, /Choose which cards to discard/);
  });

  test('End turn is disabled with the hero-choice tooltip at cleanup when hasPendingChoice is true', () => {
    const { submitMove } = recorder();
    const end = mount(TurnActionBar, {
      props: { currentStage: 'cleanup', submitMove, hasPendingChoice: true },
    }).find('[data-testid="play-action-end-turn"]');
    assert.equal(end.attributes('disabled'), '');
    assert.match(end.attributes('title')!, /Resolve the revealed card choice/);
  });
});

describe('TurnActionBar — removed controls (Jeff feedback)', () => {
  test('no "Play Hand" button (you play by clicking cards in hand)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, { props: { currentStage: 'main', submitMove } });
    assert.equal(wrapper.find('[data-testid="play-action-play-hand"]').exists(), false);
  });

  test('no "Pass priority" button', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, { props: { currentStage: 'main', submitMove } });
    assert.equal(wrapper.find('[data-testid="play-action-pass-priority"]').exists(), false);
  });

  test('the End Game control is not in the turn-action bar (it lives in the top ribbon)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', isViewerTurn: true, submitMove },
    });
    assert.equal(wrapper.find('[data-testid="play-end-game"]').exists(), false);
  });

  test('no play-action-draw control (WP-236)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, { props: { currentStage: 'start', submitMove } });
    assert.equal(wrapper.find('[data-testid="play-action-draw"]').exists(), false);
  });
});

describe('TurnActionBar — Heal Wounds (shown only when usable)', () => {
  test('Heal Wounds is shown and emits healWounds when usable', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', isViewerTurn: true, hasWoundInHand: true, submitMove },
    });
    const heal = wrapper.find('[data-testid="play-action-heal-wounds"]');
    assert.equal(heal.exists(), true, 'Heal shows when there is a Wound to heal');
    void heal.trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'healWounds');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('Heal Wounds is hidden (not a dim button) when there is nothing to heal', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', isViewerTurn: true, hasWoundInHand: false, submitMove },
    });
    assert.equal(
      wrapper.find('[data-testid="play-action-heal-wounds"]').exists(),
      false,
      'no dead Heal button in the active Step 2 box',
    );
  });

  test('Heal Wounds is hidden after acting this turn', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'main',
        isViewerTurn: true,
        hasWoundInHand: true,
        hasActedThisTurn: true,
        submitMove,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-action-heal-wounds"]').exists(), false);
  });
});

describe('TurnActionBar — step highlight matches the live button', () => {
  const stepActive = (wrapper: ReturnType<typeof mount>, step: 1 | 2 | 3): boolean =>
    wrapper.find(`[data-testid="play-turn-step-${step}"]`).classes().includes(ACTIVE);

  test('at start, only Step 1 is lit', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', hasRevealedVillain: false, submitMove },
    });
    assert.equal(stepActive(wrapper, 1), true, 'Step 1 lit (Reveal usable)');
    assert.equal(stepActive(wrapper, 2), false);
    assert.equal(stepActive(wrapper, 3), false);
  });

  test('at main, Step 2 (play) and Step 3 (End turn) are lit; Step 1 is not', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', submitMove },
    });
    assert.equal(stepActive(wrapper, 1), false, 'Step 1 dim (Reveal not usable at main)');
    assert.equal(stepActive(wrapper, 2), true, 'Step 2 lit during play');
    assert.equal(stepActive(wrapper, 3), true, 'Step 3 lit — End turn is usable');
  });

  test('at cleanup, only Step 3 is lit', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'cleanup', submitMove },
    });
    assert.equal(stepActive(wrapper, 1), false);
    assert.equal(stepActive(wrapper, 2), false);
    assert.equal(stepActive(wrapper, 3), true);
  });

  test('a pending choice at main dims Step 3 (End turn not usable), so no live button in a dim box mismatch', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', submitMove, hasPendingKoChoice: true },
    });
    // Step 3 header not lit because End turn is blocked; the button is disabled too — consistent.
    assert.equal(stepActive(wrapper, 3), false);
    assert.equal(
      wrapper.find('[data-testid="play-action-end-turn"]').attributes('disabled'),
      '',
    );
  });
});

describe('TurnActionBar — End turn primary accent', () => {
  test('End turn carries the primary accent while it is the live action (main / cleanup)', () => {
    const { submitMove } = recorder();
    for (const stage of ['main', 'cleanup'] as const) {
      const end = mount(TurnActionBar, { props: { currentStage: stage, submitMove } })
        .find('[data-testid="play-action-end-turn"]');
      assert.ok(end.classes().includes(PRIMARY), `End turn accented at ${stage}`);
    }
  });

  test('End turn is not accented at start, nor while a pending choice blocks it', () => {
    const { submitMove } = recorder();
    const atStart = mount(TurnActionBar, { props: { currentStage: 'start', submitMove } })
      .find('[data-testid="play-action-end-turn"]');
    assert.equal(atStart.classes().includes(PRIMARY), false);

    const blocked = mount(TurnActionBar, {
      props: { currentStage: 'main', submitMove, hasPendingKoChoice: true },
    }).find('[data-testid="play-action-end-turn"]');
    assert.equal(blocked.classes().includes(PRIMARY), false);
  });
});
