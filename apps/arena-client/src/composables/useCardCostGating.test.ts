import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { UICardDisplay, UITurnEconomyState } from '@legendary-arena/game-engine';
import { canFight, canFightWithExcessiveViolence, canRecruit, useCardCostGating } from './useCardCostGating';

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
    const result = canFight(display(4), economy({ attack: 4, recruit: 0 }));
    assert.equal(result.allowed, true);
  });

  test('canFight returns disallowed with full-sentence reason when economy is short', () => {
    const result = canFight(display(6), economy({ attack: 2, recruit: 0 }));
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'Needs 6 attack, you have 2.');
  });

  test('canFight returns structural-disallowed when cost is null', () => {
    const result = canFight(display(null), economy({ attack: 9, recruit: 0 }));
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'This card cannot be fought.');
  });

  test('useCardCostGating exposes both predicates bound to the supplied economy', () => {
    const gating = useCardCostGating(economy({ attack: 3, recruit: 4 }));
    assert.equal(gating.canFight(display(3)).allowed, true);
    assert.equal(gating.canRecruit(display(4)).allowed, true);
    assert.equal(gating.canFight(display(5)).allowed, false);
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
    assert.equal(canFightWithExcessiveViolence(display(3), evEconomy(9, false)), false);
  });

  test('false when available but availableAttack is below cost+1', () => {
    // why: cost 3 needs 4 attack for the +1 overspend; 3 is short by one.
    assert.equal(canFightWithExcessiveViolence(display(3), evEconomy(3, true)), false);
  });

  test('true when available and availableAttack meets cost+1 exactly', () => {
    assert.equal(canFightWithExcessiveViolence(display(3), evEconomy(4, true)), true);
  });

  test('false when the target cost is null (non-fightable)', () => {
    assert.equal(canFightWithExcessiveViolence(display(null), evEconomy(9, true)), false);
  });

  test('useCardCostGating exposes canFightWithExcessiveViolence bound to the economy', () => {
    const gating = useCardCostGating(evEconomy(4, true));
    assert.equal(gating.canFightWithExcessiveViolence(display(3)), true);
    assert.equal(gating.canFightWithExcessiveViolence(display(4)), false);
  });
});
