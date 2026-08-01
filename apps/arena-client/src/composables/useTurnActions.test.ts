import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { activeStepFor, useTurnActions } from './useTurnActions';

describe('useTurnActions (WP-129)', () => {
  test('activeStepFor maps start → 1, main → 2, cleanup → 3', () => {
    assert.equal(activeStepFor('start'), 1);
    assert.equal(activeStepFor('main'), 2);
    assert.equal(activeStepFor('cleanup'), 3);
  });

  test('canRevealVillain allowed only in start', () => {
    assert.equal(useTurnActions('start').canRevealVillain().allowed, true);
    assert.equal(useTurnActions('main').canRevealVillain().allowed, false);
    assert.equal(useTurnActions('cleanup').canRevealVillain().allowed, false);
  });

  test('canPlayCard allowed only in main with full-sentence reason elsewhere', () => {
    assert.equal(useTurnActions('main').canPlayCard().allowed, true);
    const startResult = useTurnActions('start').canPlayCard();
    assert.equal(startResult.allowed, false);
    assert.match(startResult.reason!, /Only available during the Main/);
  });

  test('canFightVillain / canRecruitHero / canFightMastermind allowed only in main', () => {
    const main = useTurnActions('main');
    assert.equal(main.canFightVillain().allowed, true);
    assert.equal(main.canRecruitHero().allowed, true);
    assert.equal(main.canFightMastermind().allowed, true);

    const cleanup = useTurnActions('cleanup');
    assert.equal(cleanup.canFightVillain().allowed, false);
    assert.equal(cleanup.canRecruitHero().allowed, false);
    assert.equal(cleanup.canFightMastermind().allowed, false);
  });

  test('canPassPriority allowed at every stage (D-10011 advanceStage canonical)', () => {
    assert.equal(useTurnActions('start').canPassPriority().allowed, true);
    assert.equal(useTurnActions('main').canPassPriority().allowed, true);
    assert.equal(useTurnActions('cleanup').canPassPriority().allowed, true);
  });

  test('canEndTurn allowed only in cleanup', () => {
    assert.equal(useTurnActions('cleanup').canEndTurn().allowed, true);
    assert.equal(useTurnActions('start').canEndTurn().allowed, false);
    assert.equal(useTurnActions('main').canEndTurn().allowed, false);
  });

  test('disabled reason cites the current stage so the user understands why', () => {
    const result = useTurnActions('cleanup').canPlayCard();
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /current: cleanup/);
  });

  test('activeStep field on the returned record matches activeStepFor', () => {
    assert.equal(useTurnActions('start').activeStep, 1);
    assert.equal(useTurnActions('main').activeStep, 2);
    assert.equal(useTurnActions('cleanup').activeStep, 3);
  });
});

describe('useTurnActions — hasPendingChoice gating (WP-222 / EC-254 / D-22203)', () => {
  test('canEndTurn blocked at cleanup when hasPendingChoice is true', () => {
    const result = useTurnActions('cleanup', true, true).canEndTurn();
    assert.equal(result.allowed, false);
    assert.equal(
      result.reason,
      'Resolve the revealed card choice before ending your turn.',
      'gate reason must match locked value from EC-254',
    );
  });

  test('canPassPriority blocked at cleanup when hasPendingChoice is true', () => {
    const result = useTurnActions('cleanup', true, true).canPassPriority();
    assert.equal(result.allowed, false);
    assert.equal(
      result.reason,
      'Resolve the revealed card choice before ending your turn.',
      'gate reason must match locked value from EC-254',
    );
  });

  test('canEndTurn and canPassPriority allowed at cleanup when hasPendingChoice is false', () => {
    // why: default false — existing callers must be unaffected
    const actions = useTurnActions('cleanup', true, false);
    assert.equal(actions.canEndTurn().allowed, true);
    assert.equal(actions.canPassPriority().allowed, true);
  });

  test('canPassPriority allowed at start and main even when hasPendingChoice is true', () => {
    // why: D-22203 — only cleanup is blocked; start and main must remain
    // passable so the player can advance through stages to reach the prompt.
    assert.equal(useTurnActions('start', true, true).canPassPriority().allowed, true);
    assert.equal(useTurnActions('main', true, true).canPassPriority().allowed, true);
  });
});

describe('useTurnActions — hasPendingKoChoice gating (WP-243 / EC-274 / D-24012)', () => {
  const KO_REASON = 'Choose a Hero to KO before taking another action.';

  test('canEndTurn blocked at EVERY stage when hasPendingKoChoice is true', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, true).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, KO_REASON, 'KO gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingKoChoice is true (board frozen)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, true).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, KO_REASON);
    }
  });

  test('defaults false — both allowed when no KO choice pending', () => {
    const actions = useTurnActions('cleanup', true, false, false);
    assert.equal(actions.canEndTurn().allowed, true);
    assert.equal(actions.canPassPriority().allowed, true);
  });

  test("OR'd gate: blocked when EITHER hasPendingChoice OR hasPendingKoChoice; KO reason takes precedence when both active", () => {
    // hero-only at cleanup → hero reason
    const heroOnly = useTurnActions('cleanup', true, true, false).canEndTurn();
    assert.equal(heroOnly.allowed, false);
    assert.match(heroOnly.reason!, /revealed card choice/);

    // KO-only at main → KO reason (hero gate would not fire at main)
    const koOnly = useTurnActions('main', true, false, true).canEndTurn();
    assert.equal(koOnly.allowed, false);
    assert.equal(koOnly.reason, KO_REASON);

    // both active at cleanup → KO reason takes precedence
    const both = useTurnActions('cleanup', true, true, true).canEndTurn();
    assert.equal(both.allowed, false);
    assert.equal(both.reason, KO_REASON, 'KO gate reason takes precedence over the hero reason');
  });
});

describe('useTurnActions — hasPendingOptionalKoReward gating (WP-249 / EC-280 / D-24020)', () => {
  const OPTIONAL_REASON = 'Choose a card to KO or Decline before taking another action.';

  test('canEndTurn blocked at EVERY stage when hasPendingOptionalKoReward is true', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, true).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, OPTIONAL_REASON, 'optional-KO-reward gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingOptionalKoReward is true (board frozen)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, true).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, OPTIONAL_REASON);
    }
  });

  test('defaults false — both allowed at cleanup when no optional-KO-reward choice pending', () => {
    const actions = useTurnActions('cleanup', true, false, false, false);
    assert.equal(actions.canEndTurn().allowed, true);
    assert.equal(actions.canPassPriority().allowed, true);
  });
});

describe('useTurnActions — hasPendingDrawOrEmpowered gating (WP-287 / EC-319 / D-24071)', () => {
  const DRAW_OR_EMPOWERED_REASON = 'Choose Draw a card or Empowered before taking another action.';

  test('canEndTurn blocked at EVERY stage when hasPendingDrawOrEmpowered is true (AC-6)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, true).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, DRAW_OR_EMPOWERED_REASON, 'draw-or-empowered gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingDrawOrEmpowered is true (board frozen) (AC-6)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, true).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, DRAW_OR_EMPOWERED_REASON);
    }
  });

  test('defaults false — both allowed at cleanup when no draw-or-empowered choice pending', () => {
    const actions = useTurnActions('cleanup', true, false, false, false, false);
    assert.equal(actions.canEndTurn().allowed, true);
    assert.equal(actions.canPassPriority().allowed, true);
  });
});

describe('useTurnActions — hasPendingVictoryPileCardPick gating (WP-313 / EC-343 / D-24099)', () => {
  const VICTORY_PILE_REASON = 'Pick a Villain from your Victory Pile before taking another action.';

  test('canEndTurn blocked at EVERY stage when hasPendingVictoryPileCardPick is true', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, false, true).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, VICTORY_PILE_REASON, 'victory-pile gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingVictoryPileCardPick is true (board frozen)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, false, true).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, VICTORY_PILE_REASON);
    }
  });

  test('defaults false — both allowed at cleanup when no victory-pile pick pending', () => {
    const actions = useTurnActions('cleanup', true, false, false, false, false, false);
    assert.equal(actions.canEndTurn().allowed, true);
    assert.equal(actions.canPassPriority().allowed, true);
  });
});

describe('useTurnActions — hasPendingOptionalPutBottomHQ gating (Ionic Energy fix)', () => {
  const PUT_BOTTOM_REASON =
    'Put a card from the HQ on the bottom of the Hero Deck, or Decline, before taking another action.';

  test('canEndTurn blocked at EVERY stage when hasPendingOptionalPutBottomHQ is true', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, false, false, true).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, PUT_BOTTOM_REASON, 'put-bottom-hq gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingOptionalPutBottomHQ is true (board frozen)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, false, false, true).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, PUT_BOTTOM_REASON);
    }
  });

  test('defaults false — both allowed at cleanup when no put-bottom-hq choice pending', () => {
    const actions = useTurnActions('cleanup', true, false, false, false, false, false, false);
    assert.equal(actions.canEndTurn().allowed, true);
    assert.equal(actions.canPassPriority().allowed, true);
  });
});

describe('useTurnActions — hasPendingPutAnyNumberBottomHQ gating (D-24132)', () => {
  const PUT_ANY_NUMBER_REASON =
    'Choose any number of cards from the HQ to put on the bottom, or Put None, before taking another action.';

  test('canEndTurn blocked at EVERY stage when hasPendingPutAnyNumberBottomHQ is true', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, false, false, false, true).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, PUT_ANY_NUMBER_REASON, 'put-any-number-hq gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingPutAnyNumberBottomHQ is true (board frozen)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, false, false, false, true).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, PUT_ANY_NUMBER_REASON);
    }
  });

  test('defaults false — both allowed at cleanup when no put-any-number-hq choice pending', () => {
    const actions = useTurnActions('cleanup', true, false, false, false, false, false, false, false);
    assert.equal(actions.canEndTurn().allowed, true);
    assert.equal(actions.canPassPriority().allowed, true);
  });
});

describe('useTurnActions — hasPendingReturnZeroCostDiscard gating (D-24139)', () => {
  const RETURN_ZERO_COST_REASON =
    'Return a 0-cost card from your discard pile to your hand before taking another action.';

  test('canEndTurn blocked at EVERY stage when hasPendingReturnZeroCostDiscard is true', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, false, false, false, false, true).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, RETURN_ZERO_COST_REASON, 'return-zero-cost gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingReturnZeroCostDiscard is true (board frozen)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, false, false, false, false, false, false, false, true).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, RETURN_ZERO_COST_REASON);
    }
  });

  test('defaults false — both allowed at cleanup when no return-zero-cost choice pending', () => {
    const actions = useTurnActions('cleanup', true, false, false, false, false, false, false, false, false);
    assert.equal(actions.canEndTurn().allowed, true);
    assert.equal(actions.canPassPriority().allowed, true);
  });
});

describe('useTurnActions — hasPendingDiscardToPlay gating (WP-383 / D-24184)', () => {
  const DISCARD_TO_PLAY_REASON =
    'Discard a card from your hand to complete the play before taking another action.';
  // why: hasPendingDiscardToPlay is the 9th pending flag (position 11): stage,
  // isViewerTurn, then 8 falses for the other pending flags, then true.
  const withDiscardToPlay = (stage: string) =>
    useTurnActions(stage, true, false, false, false, false, false, false, false, false, true);

  test('canEndTurn blocked at EVERY stage when hasPendingDiscardToPlay is true', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = withDiscardToPlay(stage).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, DISCARD_TO_PLAY_REASON, 'discard-to-play gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingDiscardToPlay is true (board frozen)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = withDiscardToPlay(stage).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, DISCARD_TO_PLAY_REASON);
    }
  });

  // why: WP-380 — canHealWounds gates the Heal-Wounds button. Args after the
  // pending flags are: hasWoundInHand, hasActedThisTurn, hasHealedThisTurn.
  // WP-470 / D-24282 added hasPendingScryKoChoice (position 12), so the pending
  // cluster is now 10 flags (positions 3–12).
  const NO_PENDING = [false, false, false, false, false, false, false, false, false, false] as const;

  test('canHealWounds allowed on the viewer main turn with a Wound in hand, not acted, not healed', () => {
    const result = useTurnActions('main', true, ...NO_PENDING, true, false, false).canHealWounds();
    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
  });

  test('canHealWounds blocked when it is not the viewer turn', () => {
    const result = useTurnActions('main', false, ...NO_PENDING, true, false, false).canHealWounds();
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /not your turn/i);
  });

  test('canHealWounds blocked outside the main stage', () => {
    for (const stage of ['start', 'cleanup'] as const) {
      const result = useTurnActions(stage, true, ...NO_PENDING, true, false, false).canHealWounds();
      assert.equal(result.allowed, false, `heal blocked at ${stage}`);
      assert.match(result.reason!, /Only available during the Main/);
    }
  });

  test('canHealWounds blocked while a block-all choice is pending', () => {
    // 4th arg (hasPendingKoChoice) = true; scry flag (position 12) = false, wound (13) = true
    const result = useTurnActions('main', true, false, true, false, false, false, false, false, false, false, false, true, false, false).canHealWounds();
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /pending choice/i);
  });

  test('canHealWounds blocked while a Doombot scry-KO choice is pending (WP-470)', () => {
    // scry flag (position 12) = true, wound (13) = true — heal must be blocked by the pending choice
    const result = useTurnActions('main', true, false, false, false, false, false, false, false, false, false, true, true, false, false).canHealWounds();
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /pending choice/i);
  });

  test('canHealWounds blocked with no Wound in hand', () => {
    const result = useTurnActions('main', true, ...NO_PENDING, false, false, false).canHealWounds();
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /no Wounds in hand/i);
  });

  test('canHealWounds blocked after recruiting or fighting this turn', () => {
    const result = useTurnActions('main', true, ...NO_PENDING, true, true, false).canHealWounds();
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /after recruiting or fighting/i);
  });

  test('canHealWounds blocked after already healing this turn', () => {
    const result = useTurnActions('main', true, ...NO_PENDING, true, false, true).canHealWounds();
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /already healed/i);
  });
});

describe('useTurnActions — hasPendingScryKoChoice gating (WP-470 / D-24282)', () => {
  const SCRY_KO_REASON =
    'Choose one of the top two cards to KO before taking another action.';
  // why: hasPendingScryKoChoice is the 10th pending flag (position 12): stage,
  // isViewerTurn, then 9 falses for the other pending flags, then true.
  const withScryKo = (stage: string) =>
    useTurnActions(stage, true, false, false, false, false, false, false, false, false, false, true);

  test('canEndTurn blocked at EVERY stage when hasPendingScryKoChoice is true', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = withScryKo(stage).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, SCRY_KO_REASON, 'scry-KO gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingScryKoChoice is true (board frozen)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = withScryKo(stage).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, SCRY_KO_REASON);
    }
  });
});

describe('useTurnActions — hasPendingDiscardChoice gating (WP-476 / D-24284)', () => {
  const DISCARD_REASON =
    'Choose which cards to discard before taking another action.';
  // why: hasPendingDiscardChoice is APPENDED LAST (position 16) so the existing
  // positional TurnActionBar caller stays valid without edits: stage, isViewerTurn,
  // 10 pending falses, hasWoundInHand/hasActedThisTurn/hasHealedThisTurn (3 falses),
  // then true.
  const withDiscardChoice = (stage: string) =>
    useTurnActions(
      stage, true, false, false, false, false, false, false, false, false, false, false,
      false, false, false, true,
    );

  test('canEndTurn blocked at EVERY stage when hasPendingDiscardChoice is true', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = withDiscardChoice(stage).canEndTurn();
      assert.equal(result.allowed, false, `endTurn blocked at ${stage}`);
      assert.equal(result.reason, DISCARD_REASON, 'discard gate reason matches the locked value');
    }
  });

  test('canPassPriority blocked at EVERY stage when hasPendingDiscardChoice is true (board frozen)', () => {
    for (const stage of ['start', 'main', 'cleanup'] as const) {
      const result = withDiscardChoice(stage).canPassPriority();
      assert.equal(result.allowed, false, `passPriority blocked at ${stage}`);
      assert.equal(result.reason, DISCARD_REASON);
    }
  });
});
