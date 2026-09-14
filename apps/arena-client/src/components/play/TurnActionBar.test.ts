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

describe('TurnActionBar (WP-129 — 3-step rewrite of WP-100; WP-236 — Draw scaffold retired)', () => {
  test('Reveal click emits revealVillainCard then auto-advances into main at play.start', () => {
    // why: the reveal is the only start-stage action, so the client fires the
    // engine's own two-move contract (revealVillainCard → advanceStage) in one
    // click, landing the player in main. The engine stays untouched; this mirrors
    // the autoplay bot's reveal step.
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', submitMove },
    });
    void wrapper.find('[data-testid="play-action-reveal"]').trigger('click');
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.name, 'revealVillainCard');
    assert.deepEqual(calls[0]!.args, {});
    assert.equal(calls[1]!.name, 'advanceStage');
    assert.deepEqual(calls[1]!.args, {});
  });

  test('Reveal auto-advance is latched: a second click before the frame lands does not re-fire advanceStage', () => {
    // why: without the latch, a fast double-click would advance start → main →
    // cleanup and skip the main stage. currentStage stays 'start' here (no frame
    // has flipped it), so the second click must be a no-op until the stage changes.
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', submitMove },
    });
    const reveal = wrapper.find('[data-testid="play-action-reveal"]');
    void reveal.trigger('click');
    void reveal.trigger('click');
    assert.equal(calls.length, 2, 'only the first click emits the reveal + advance pair');
    assert.equal(calls[0]!.name, 'revealVillainCard');
    assert.equal(calls[1]!.name, 'advanceStage');
  });

  test('Reveal auto-advance latch resets when the stage changes, so the next turn reveals fresh', async () => {
    // why: the latch clears on any currentStage change (the watch), so a new turn
    // returning to 'start' re-arms a fresh reveal + advance.
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', submitMove },
    });
    void wrapper.find('[data-testid="play-action-reveal"]').trigger('click');
    assert.equal(calls.length, 2);
    // advance to main (post-reveal frame), then a fresh turn returns to start
    await wrapper.setProps({ currentStage: 'main' });
    await wrapper.setProps({ currentStage: 'start' });
    void wrapper.find('[data-testid="play-action-reveal"]').trigger('click');
    assert.equal(calls.length, 4, 'the next turn reveal fires a fresh reveal + advance pair');
    assert.equal(calls[2]!.name, 'revealVillainCard');
    assert.equal(calls[3]!.name, 'advanceStage');
  });

  test('Reveal drops DOM focus after the click so it does not look stuck-active', () => {
    // why: revealVillainCard leaves G.currentStage on 'start' (the reveal →
    // advanceStage two-move contract), so without an explicit blur the reveal
    // button keeps its focus ring after firing and reads as if the click never
    // registered. attachTo document.body so jsdom tracks document.activeElement.
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', submitMove },
      attachTo: document.body,
    });
    const reveal = wrapper.find('[data-testid="play-action-reveal"]');
    const revealEl = reveal.element as HTMLButtonElement;
    revealEl.focus();
    assert.equal(document.activeElement, revealEl, 'button should hold focus before the click');
    void reveal.trigger('click');
    assert.notEqual(
      document.activeElement,
      revealEl,
      'reveal button must lose focus after firing the move',
    );
    wrapper.unmount();
  });

  test('Reveal is enabled only in start with stage tooltip otherwise', () => {
    const { submitMove } = recorder();
    const startWrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', submitMove },
    });
    assert.equal(
      startWrapper.find('[data-testid="play-action-reveal"]').attributes('disabled'),
      undefined,
    );

    for (const stage of ['main', 'cleanup'] as const) {
      const wrapper = mount(TurnActionBar, {
        props: { currentStage: stage, submitMove },
      });
      const reveal = wrapper.find('[data-testid="play-action-reveal"]');
      assert.equal(reveal.attributes('disabled'), '');
      assert.match(reveal.attributes('title')!, /Only available during the Start/);
    }
  });

  // Jeff feedback — "Pass priority" was removed from Step 2. End turn is now the
  // single forward action; from the main stage it chains advanceStage → endTurn.

  test('End turn from the main stage chains advanceStage → endTurn (single terminator; no Pass priority)', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      // empty hand so the play-your-hand gate does not block End turn
      props: { currentStage: 'main', handCards: [], submitMove },
    });
    void wrapper.find('[data-testid="play-action-end-turn"]').trigger('click');
    assert.equal(calls.length, 2, 'End turn from main advances then ends');
    assert.equal(calls[0]!.name, 'advanceStage');
    assert.deepEqual(calls[0]!.args, {});
    assert.equal(calls[1]!.name, 'endTurn');
    assert.deepEqual(calls[1]!.args, {});
  });

  test('the Pass priority button no longer exists', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', handCards: [], submitMove },
    });
    assert.equal(
      wrapper.find('[data-testid="play-action-pass-priority"]').exists(),
      false,
      'Step 2 no longer renders a "Pass priority" button',
    );
  });

  test('Step 1 becomes "Continue to Play" when the villain is revealed but the turn is still at start (parked-choice recovery)', () => {
    // why: normally the reveal auto-advances into main; but if the revealed villain
    // parked a pending choice, the turn stays at 'start'. With Pass priority gone,
    // the Step-1 button becomes the manual advance so the player is never stranded.
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', submitMove, hasRevealedVillain: true },
    });
    const button = wrapper.find('[data-testid="play-action-reveal"]');
    assert.equal(button.attributes('disabled'), undefined, 'the continue action is enabled');
    assert.match(button.text(), /Continue to Play/);
    void button.trigger('click');
    assert.equal(calls.length, 1, 'continue fires a single advanceStage');
    assert.equal(calls[0]!.name, 'advanceStage');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('Step 1 shows "Reveal top of Villain Deck" before the reveal', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', submitMove, hasRevealedVillain: false },
    });
    assert.match(
      wrapper.find('[data-testid="play-action-reveal"]').text(),
      /Reveal top of Villain Deck/,
    );
  });

  test('End Turn click emits endTurn with empty payload at play.cleanup', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'cleanup', submitMove },
    });
    void wrapper.find('[data-testid="play-action-end-turn"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'endTurn');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('End turn is enabled at main (hand played) and cleanup, blocked at start', () => {
    const { submitMove } = recorder();
    // start: blocked — the reveal (which auto-advances) is the way forward, not End turn
    const startWrapper = mount(TurnActionBar, {
      props: { currentStage: 'start', handCards: [], submitMove },
    });
    const startEnd = startWrapper.find('[data-testid="play-action-end-turn"]');
    assert.equal(startEnd.attributes('disabled'), '');
    assert.match(startEnd.attributes('title')!, /Reveal the villain/);

    // main + cleanup with an empty hand (nothing left to play): End turn enabled
    for (const stage of ['main', 'cleanup'] as const) {
      const wrapper = mount(TurnActionBar, {
        props: { currentStage: stage, handCards: [], submitMove },
      });
      assert.equal(
        wrapper.find('[data-testid="play-action-end-turn"]').attributes('disabled'),
        undefined,
        `End turn should be enabled at stage '${stage}' once the hand is played`,
      );
    }
  });

  test('End turn is blocked at main while playable cards remain (play your hand first)', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', handCards: ['iron-man-tech'], submitMove },
    });
    const endTurn = wrapper.find('[data-testid="play-action-end-turn"]');
    assert.equal(endTurn.attributes('disabled'), '', 'End turn disabled while a playable card remains');
    assert.match(endTurn.attributes('title')!, /Play your hand/i);
    await wrapper.setProps({ handCards: [] });
    assert.equal(
      wrapper.find('[data-testid="play-action-end-turn"]').attributes('disabled'),
      undefined,
      'End turn enabled once the hand is played',
    );
  });

  test('Draw scaffold is gone — no play-action-draw control rendered (WP-236)', () => {
    // why: WP-236 retired the "Draw to 6" scaffold button. The engine now
    // auto-draws the start-of-turn hand at onBegin, so the button (and its
    // handCount prop) are deleted, not refactored. The control must not render
    // in any stage.
    const { submitMove } = recorder();
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const wrapper = mount(TurnActionBar, {
        props: { currentStage: stage, submitMove },
      });
      assert.equal(
        wrapper.find('[data-testid="play-action-draw"]').exists(),
        false,
        `the Draw control must not render at stage '${stage}'`,
      );
    }
  });

  test('renders 3 steps with the active step flagged', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', submitMove },
    });
    const root = wrapper.find('[data-testid="play-turn-action-bar"]');
    assert.equal(root.attributes('data-active-step'), '2');
    assert.equal(wrapper.find('[data-testid="play-turn-step-1"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-turn-step-2"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-turn-step-3"]').exists(), true);
  });

  test('End Turn is disabled with pending-choice tooltip at cleanup when hasPendingChoice is true', () => {
    // why: D-22203 — the engine's dual turn-end guard (WP-220) blocks endTurn
    // when pendingHeroChoice is set; the client gate surfaces the reason.
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'cleanup', submitMove, hasPendingChoice: true },
    });
    const endTurn = wrapper.find('[data-testid="play-action-end-turn"]');
    assert.equal(endTurn.attributes('disabled'), '');
    assert.match(
      endTurn.attributes('title')!,
      /Resolve the revealed card choice/,
      'End Turn tooltip must cite the pending choice gate reason',
    );
  });

  test('End turn is disabled at main too when hasPendingChoice is true (End turn now fires from main)', () => {
    // why: D-22203 — a pending hero-reveal choice must block End turn wherever the
    // player clicks; End turn now fires from the main stage, so the gate is checked
    // at main, not only cleanup.
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', handCards: [], submitMove, hasPendingChoice: true },
    });
    const endTurn = wrapper.find('[data-testid="play-action-end-turn"]');
    assert.equal(endTurn.attributes('disabled'), '');
    assert.match(endTurn.attributes('title')!, /Resolve the revealed card choice/);
  });

  test('End turn is disabled at EVERY stage with the KO tooltip when hasPendingKoChoice is true (D-24012)', () => {
    // why: D-24012 — a pending KO-a-Hero choice freezes the board, so End turn (the
    // single terminator) is blocked at every stage with the KO reason.
    const { submitMove } = recorder();
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const wrapper = mount(TurnActionBar, {
        props: { currentStage: stage, handCards: [], submitMove, hasPendingKoChoice: true },
      });
      const endTurn = wrapper.find('[data-testid="play-action-end-turn"]');
      assert.equal(endTurn.attributes('disabled'), '', `end-turn disabled at ${stage}`);
      assert.match(endTurn.attributes('title')!, /Choose a Hero to KO/);
    }
  });

  test('KO gate reason takes precedence over the hero-choice reason when both are active', () => {
    // why: D-24012 — when both pending systems are active at cleanup, the KO
    // gate reason wins in the TurnActionBar messaging.
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'cleanup', submitMove, hasPendingChoice: true, hasPendingKoChoice: true },
    });
    const endTurn = wrapper.find('[data-testid="play-action-end-turn"]');
    assert.match(
      endTurn.attributes('title')!,
      /Choose a Hero to KO/,
      'KO gate reason takes precedence over the hero-choice reason',
    );
  });

  test('End turn is disabled at EVERY stage with the discard tooltip when hasPendingDiscardChoice is true (WP-477 / D-24284)', () => {
    // why: WP-477 completes WP-476's deferred wiring — a pending Magneto discard-to-limit
    // choice freezes the board, so End turn is blocked at every stage. Proves the prop
    // threads through TurnActionBar to its useTurnActions slot.
    const { submitMove } = recorder();
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const wrapper = mount(TurnActionBar, {
        props: { currentStage: stage, handCards: [], submitMove, hasPendingDiscardChoice: true },
      });
      const endTurn = wrapper.find('[data-testid="play-action-end-turn"]');
      assert.equal(endTurn.attributes('disabled'), '', `end-turn disabled at ${stage}`);
      assert.match(endTurn.attributes('title')!, /Choose which cards to discard/);
    }
  });

  // why: WP-380 — the Heal Wounds button (engine healWounds). Lives in Step 2
  // (play.main); enabled only for the viewer with a Wound in hand, not acted, not
  // healed; disabled-with-tooltip otherwise per the EC-132 §3 precedence.
  test('Heal Wounds click emits healWounds with empty payload when enabled', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', isViewerTurn: true, hasWoundInHand: true, submitMove },
    });
    const heal = wrapper.find('[data-testid="play-action-heal-wounds"]');
    assert.equal(
      heal.attributes('disabled'),
      undefined,
      'enabled with a Wound in hand, not acted, not healed',
    );
    void heal.trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'healWounds');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('Heal Wounds is disabled with a tooltip when no Wound is in hand', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', isViewerTurn: true, hasWoundInHand: false, submitMove },
    });
    const heal = wrapper.find('[data-testid="play-action-heal-wounds"]');
    assert.equal(heal.attributes('disabled'), '');
    assert.match(heal.attributes('title')!, /no Wounds in hand/i);
  });

  test('Heal Wounds is disabled after acting this turn', () => {
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
    const heal = wrapper.find('[data-testid="play-action-heal-wounds"]');
    assert.equal(heal.attributes('disabled'), '');
    assert.match(heal.attributes('title')!, /after recruiting or fighting/i);
  });

  test('Heal Wounds is disabled after already healing this turn', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'main',
        isViewerTurn: true,
        hasWoundInHand: true,
        hasHealedThisTurn: true,
        submitMove,
      },
    });
    const heal = wrapper.find('[data-testid="play-action-heal-wounds"]');
    assert.equal(heal.attributes('disabled'), '');
    assert.match(heal.attributes('title')!, /already healed/i);
  });

  // why: EC-565 — the heal button must disable while a return-on-discard choice is
  // pending, proving hasPendingReturnOnDiscard is actually threaded into healGate().
  // Before the fix the prop was declared but never passed, so canHealWounds could not
  // see it and the button stayed a live-but-dead click (the engine healWounds no-ops).
  test('Heal Wounds is disabled while a return-on-discard choice is pending (engine parity)', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'main',
        isViewerTurn: true,
        hasWoundInHand: true,
        hasPendingReturnOnDiscard: true,
        submitMove,
      },
    });
    const heal = wrapper.find('[data-testid="play-action-heal-wounds"]');
    assert.equal(heal.attributes('disabled'), '');
    assert.match(heal.attributes('title')!, /pending choice/i);
    void heal.trigger('click');
    assert.equal(calls.length, 0, 'a disabled heal button emits no move');
  });

  // Jeff feedback — the End Game control moved out of TurnActionBar into the top
  // ribbon (EndGameControl in TopHudBar); its tests live in EndGameControl.test.ts.

  test('End Game control no longer lives in the turn-action bar', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: 'main', isViewerTurn: true, submitMove },
    });
    assert.equal(
      wrapper.find('[data-testid="play-end-game"]').exists(),
      false,
      'End Game moved to the top ribbon (EndGameControl); the bar must not render it',
    );
  });

  // Jeff feedback — the "Play Hand" convenience button (Step 2). Plays every
  // playable (non-Wound) hand card in one click, greys out once the hand is
  // emptied of playable cards, and gates Pass priority at main until then.

  test('Play Hand emits one playCard per playable hand card, in order', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'main',
        isViewerTurn: true,
        handCards: ['iron-man-tech', 'shield-agent', 'spider-man-instinct'],
        submitMove,
      },
    });
    const playHand = wrapper.find('[data-testid="play-action-play-hand"]');
    assert.equal(playHand.attributes('disabled'), undefined, 'enabled with playable cards in hand');
    void playHand.trigger('click');
    assert.equal(calls.length, 3);
    assert.deepEqual(
      calls.map((call) => call.name),
      ['playCard', 'playCard', 'playCard'],
    );
    assert.deepEqual(
      calls.map((call) => call.args),
      [
        { cardId: 'iron-man-tech' },
        { cardId: 'shield-agent' },
        { cardId: 'spider-man-instinct' },
      ],
    );
  });

  test('Play Hand skips Wounds (never submits a playCard for a Wound)', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'main',
        isViewerTurn: true,
        // why: WOUND_EXT_ID ('pile-wound') — a Wound carries no play value and cannot be played.
        handCards: ['pile-wound', 'iron-man-tech', 'pile-wound'],
        submitMove,
      },
    });
    void wrapper.find('[data-testid="play-action-play-hand"]').trigger('click');
    assert.equal(calls.length, 1, 'only the single non-Wound card is played');
    assert.deepEqual(calls[0]!.args, { cardId: 'iron-man-tech' });
  });

  test('Play Hand is disabled with a tooltip once no playable cards remain (only Wounds / empty)', () => {
    const { submitMove } = recorder();
    for (const handCards of [[], ['pile-wound', 'pile-wound']]) {
      const wrapper = mount(TurnActionBar, {
        props: { currentStage: 'main', isViewerTurn: true, handCards, submitMove },
      });
      const playHand = wrapper.find('[data-testid="play-action-play-hand"]');
      assert.equal(playHand.attributes('disabled'), '', 'greyed with nothing playable to play');
      assert.match(playHand.attributes('title')!, /no more cards to play/i);
    }
  });

  test('Play Hand is disabled with a stage tooltip outside the main step', () => {
    const { submitMove } = recorder();
    for (const stage of ['start', 'cleanup'] as const) {
      const wrapper = mount(TurnActionBar, {
        props: { currentStage: stage, isViewerTurn: true, handCards: ['iron-man-tech'], submitMove },
      });
      const playHand = wrapper.find('[data-testid="play-action-play-hand"]');
      assert.equal(playHand.attributes('disabled'), '');
      assert.match(playHand.attributes('title')!, /Only available during the Main/);
    }
  });

  test('End turn is not blocked by the hand gate when only Wounds remain in hand', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'main',
        isViewerTurn: true,
        handCards: ['pile-wound', 'pile-wound'],
        submitMove,
      },
    });
    assert.equal(
      wrapper.find('[data-testid="play-action-end-turn"]').attributes('disabled'),
      undefined,
      'a hand of only Wounds counts as nothing-left-to-play; End turn is enabled',
    );
  });

  // Jeff feedback — the primary accent follows the forward action: Play Hand while
  // cards remain, then End turn once the hand is played. "Pass priority" is gone.
  const PRIMARY = 'turn-action-bar__action--primary';

  test('Play Hand is the highlighted primary action while the hand has playable cards', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'main',
        isViewerTurn: true,
        handCards: ['iron-man-tech', 'shield-agent'],
        submitMove,
      },
    });
    assert.ok(
      wrapper.find('[data-testid="play-action-play-hand"]').classes().includes(PRIMARY),
      'Play Hand carries the primary-action highlight while cards remain to play',
    );
    assert.equal(
      wrapper.find('[data-testid="play-action-end-turn"]').classes().includes(PRIMARY),
      false,
      'End turn is NOT highlighted while Play Hand is the recommended action',
    );
  });

  test('the highlight moves to End turn once the hand is played', async () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'main',
        isViewerTurn: true,
        handCards: ['iron-man-tech'],
        submitMove,
      },
    });
    // hand emptied (all cards played) — Play Hand greys out and the accent moves to
    // End turn (the genuine forward action — NOT the old blue "Pass priority").
    await wrapper.setProps({ handCards: [] });
    assert.ok(
      wrapper.find('[data-testid="play-action-end-turn"]').classes().includes(PRIMARY),
      'End turn becomes the primary action once nothing is left to play',
    );
    assert.equal(
      wrapper.find('[data-testid="play-action-play-hand"]').classes().includes(PRIMARY),
      false,
      'the greyed-out Play Hand no longer carries the highlight',
    );
  });

  test('nothing in Step 2/3 is highlighted when a pending choice blocks the forward action', () => {
    const { submitMove } = recorder();
    const wrapper = mount(TurnActionBar, {
      props: {
        currentStage: 'main',
        isViewerTurn: true,
        handCards: [],
        // a board-freezing pending choice blocks End turn at every stage
        hasPendingKoChoice: true,
        submitMove,
      },
    });
    assert.equal(
      wrapper.find('[data-testid="play-action-play-hand"]').classes().includes(PRIMARY),
      false,
    );
    assert.equal(
      wrapper.find('[data-testid="play-action-end-turn"]').classes().includes(PRIMARY),
      false,
      'a blocked forward action is never falsely highlighted',
    );
  });
});
