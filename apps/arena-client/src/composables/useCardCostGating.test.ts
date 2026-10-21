import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { UICardDisplay, UITurnEconomyState } from '@legendary-arena/game-engine';
import { canFight, canFightWithExcessiveViolence, canRecruit, useCardCostGating } from './useCardCostGating';
import { RESCUE_ON_FIGHT_RECRUIT_COST, canFightAndRescue } from './useCardCostGating';

function display(cost: number | null): UICardDisplay {
  return {
    extId: 'test-card',
    name: 'Test Card',
    imageUrl: 'https://images.legendary-arena.com/test.png',
    cost,
  };
}

function economy(values: { attack: number; recruit: number; available?: { attack?: number; recruit?: number } }): UITurnEconomyState {
  return {
    attack: values.attack,
    recruit: values.recruit,
    availableAttack: values.available?.attack ?? values.attack,
    availableRecruit: values.available?.recruit ?? values.recruit,
    piercing: 0,
    woundsDrawn: 0,
  };
}

describe('useCardCostGating (WP-129)', () => {
  test('canRecruit returns allowed when economy meets cost', () => {
    const result = canRecruit(display(3), economy({ attack: 0, recruit: 3 }));
    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
  });

  test('canRecruit returns disallowed with full-sentence reason when economy is short', () => {
    const result = canRecruit(display(5), economy({ attack: 0, recruit: 2 }));
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'Needs 5 recruit, you have 2.');
  });

  test('canRecruit returns structural-disallowed when cost is null', () => {
    const result = canRecruit(display(null), economy({ attack: 0, recruit: 9 }));
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'This card is not recruitable.');
  });

  test('canFight returns allowed when availableAttack matches villain cost exactly', () => {
    const result = canFight(4, economy({ attack: 4, recruit: 0 }));
    assert.equal(result.allowed, true);
  });

  test('canFight returns disallowed with full-sentence reason when economy is short', () => {
    const result = canFight(6, economy({ attack: 2, recruit: 0 }));
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'Needs 6 attack, you have 2.');
  });

  test('canFight returns structural-disallowed when cost is null', () => {
    const result = canFight(null, economy({ attack: 9, recruit: 0 }));
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'This card cannot be fought.');
  });

  test('useCardCostGating exposes both predicates bound to the supplied economy', () => {
    const gating = useCardCostGating(economy({ attack: 3, recruit: 4 }));
    assert.equal(gating.canFight(3).allowed, true);
    assert.equal(gating.canRecruit(display(4)).allowed, true);
    assert.equal(gating.canFight(5).allowed, false);
    assert.equal(gating.canRecruit(display(5)).allowed, false);
  });

  test('canRecruit reason cites WP-128 economy.availableRecruit field consumed', () => {
    // why: this assertion documents the disabled-state tooltip precedence
    // §7.10 contract — the reason text must mention the user's resource
    // count so they understand why their click did not fire.
    const result = canRecruit(display(7), economy({ attack: 0, recruit: 4 }));
    assert.match(result.reason!, /you have 4/);
  });
});

describe('canFightWithExcessiveViolence (WP-738 / D-24561)', () => {
  function evEconomy(availableAttack: number, available: boolean): UITurnEconomyState {
    const base = economy({ attack: availableAttack, recruit: 0 });
    return available ? { ...base, excessiveViolenceAvailable: true } : base;
  }

  test('false when the availability cue is absent, even if cost+1 is affordable', () => {
    assert.equal(canFightWithExcessiveViolence(3, evEconomy(9, false)), false);
  });

  test('false when available but availableAttack is below cost+1', () => {
    // why: cost 3 needs 4 attack for the +1 overspend; 3 is short by one.
    assert.equal(canFightWithExcessiveViolence(3, evEconomy(3, true)), false);
  });

  test('true when available and availableAttack meets cost+1 exactly', () => {
    assert.equal(canFightWithExcessiveViolence(3, evEconomy(4, true)), true);
  });

  test('false when the target cost is null (non-fightable)', () => {
    assert.equal(canFightWithExcessiveViolence(null, evEconomy(9, true)), false);
  });

  test('WP-750 / D-24574 — a projected cost of 0 is fightable with no attack', () => {
    // why: a card with no printed attack projects fightCost 0 — the engine
    // charges 0, so the old "This card cannot be fought." false lock is gone.
    const result = canFight(0, economy({ attack: 0, recruit: 0 }));
    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
  });

  test('WP-750 / D-24574 — EV against a projected cost of 0 needs exactly 1 attack', () => {
    assert.equal(canFightWithExcessiveViolence(0, evEconomy(0, true)), false);
    assert.equal(canFightWithExcessiveViolence(0, evEconomy(1, true)), true);
  });

  test('useCardCostGating exposes canFightWithExcessiveViolence bound to the economy', () => {
    const gating = useCardCostGating(evEconomy(4, true));
    assert.equal(gating.canFightWithExcessiveViolence(3), true);
    assert.equal(gating.canFightWithExcessiveViolence(4), false);
  });
});

describe('restricted attack per fight target (WP-790 / D-24652)', () => {
  // why: availableAttack excludes "usable only against …" attack; the gate adds back the
  // grants eligible for the target, via the engine-exported sumRestrictedAttackForTarget.
  function restrictedEconomy(): UITurnEconomyState {
    return {
      ...economy({ attack: 3, recruit: 0, available: { attack: 1 } }),
      restrictedAttack: [{ remaining: 2, targets: ['rooftops'], label: 'Rooftops' }],
      excessiveViolenceAvailable: true,
    };
  }

  test('an eligible target counts the restricted attack', () => {
    assert.equal(canFight(3, restrictedEconomy(), 'rooftops').allowed, true);
  });

  test('an ineligible target stays disabled, with the reason using the per-target figure', () => {
    const result = canFight(3, restrictedEconomy(), 'sewers');
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'Needs 3 attack, you have 1.');
  });

  test('no target means no restricted attack (the pre-WP-790 figure)', () => {
    assert.equal(canFight(3, restrictedEconomy()).allowed, false);
  });

  test('the Excessive Violence +1 check uses the per-target figure', () => {
    assert.equal(canFightWithExcessiveViolence(2, restrictedEconomy(), 'rooftops'), true);
    assert.equal(canFightWithExcessiveViolence(2, restrictedEconomy(), 'mastermind'), false);
  });

  test('useCardCostGating passes the target through', () => {
    const gating = useCardCostGating(restrictedEconomy());
    assert.equal(gating.canFight(3, 'rooftops').allowed, true);
    assert.equal(gating.canFight(3, 'bridge').allowed, false);
    assert.equal(gating.canFightWithExcessiveViolence(2, 'rooftops'), true);
  });
});

describe('WP-820 canFightAndRescue (Baron Zemo, D-24753)', () => {
  // why: the economy() builder has no cue field, so each case spreads it in (the
  // evEconomy pattern above).
  function rescueEconomy(values: { attack: number; recruit: number }): UITurnEconomyState {
    return { ...economy(values), rescueOnFightAvailable: true };
  }

  test('the client constant mirrors the engine price of 2 Recruit', () => {
    assert.equal(RESCUE_ON_FIGHT_RECRUIT_COST, 2);
  });

  test('T1: true when the cue is on and both the fight and 2 Recruit are payable', () => {
    assert.equal(canFightAndRescue(3, rescueEconomy({ attack: 3, recruit: 2 })), true);
  });

  test('T2: false with 1 Recruit, without the cue, with a null cost, and with attack short', () => {
    assert.equal(canFightAndRescue(3, rescueEconomy({ attack: 3, recruit: 1 })), false, 'recruit 1');
    assert.equal(canFightAndRescue(3, economy({ attack: 3, recruit: 2 })), false, 'cue absent');
    assert.equal(canFightAndRescue(null, rescueEconomy({ attack: 3, recruit: 2 })), false, 'cost null');
    assert.equal(canFightAndRescue(3, rescueEconomy({ attack: 2, recruit: 2 })), false, 'attack 2');
  });

  test('T3: under recruit-as-attack the fight Recruit is counted (needs cost + 2 combined)', () => {
    // why: availableAttack already folds Recruit in under the conversion, so cost 5
    // plus the 2-Recruit rescue needs 7 from it: 7 passes, 6 does not.
    const payable: UITurnEconomyState = {
      ...economy({ attack: 3, recruit: 4, available: { attack: 7 } }),
      recruitSpendableAsAttack: true,
      rescueOnFightAvailable: true,
    };
    assert.equal(canFightAndRescue(5, payable), true);
    const short: UITurnEconomyState = {
      ...economy({ attack: 3, recruit: 3, available: { attack: 6 } }),
      recruitSpendableAsAttack: true,
      rescueOnFightAvailable: true,
    };
    assert.equal(canFightAndRescue(5, short), false);
  });

  test('useCardCostGating exposes canFightAndRescue bound to the economy', () => {
    const gating = useCardCostGating(rescueEconomy({ attack: 3, recruit: 2 }));
    assert.equal(gating.canFightAndRescue(3), true);
    assert.equal(gating.canFightAndRescue(4), false);
  });
});
