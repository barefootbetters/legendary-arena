import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeRevealPredicate,
  describeRevealActions,
  describeUnappliedRevealActions,
  formatRevealOutcomeLine,
} from './revealLog';
import type { UICardDisplay } from '../ui/uiState.types';

/** A minimal cardDisplayData snapshot for the reveal-log tests. */
function display(extId: string, name: string): UICardDisplay {
  return {
    extId,
    name,
    imageUrl: `https://images.legendary-arena.com/${extId}.webp`,
    cost: null,
  };
}

test('describeRevealPredicate renders each predicate kind', () => {
  assert.equal(describeRevealPredicate({ kind: 'always' }), 'always');
  assert.equal(describeRevealPredicate({ kind: 'cost-zero' }), 'cost is 0');
  assert.equal(describeRevealPredicate({ kind: 'cost-odd' }), 'cost is odd');
  assert.equal(describeRevealPredicate({ kind: 'cost-lte', threshold: 3 }), 'cost ≤ 3');
  assert.equal(describeRevealPredicate({ kind: 'cost-gte', threshold: 4 }), 'cost ≥ 4');
});

test('describeRevealPredicate handles a 0 threshold and a missing threshold', () => {
  // why: threshold 0 is legitimate (reveal M=0) and must not read as "no threshold".
  assert.equal(describeRevealPredicate({ kind: 'cost-lte', threshold: 0 }), 'cost ≤ 0');
  assert.equal(describeRevealPredicate({ kind: 'cost-lte' }), 'cost ≤ (no threshold)');
});

test('describeRevealActions maps each action kind and comma-joins them', () => {
  assert.equal(describeRevealActions([{ kind: 'draw' }]), 'drew it');
  assert.equal(describeRevealActions([{ kind: 'ko' }]), "KO'd it");
  assert.equal(describeRevealActions([{ kind: 'attack-by-cost' }]), 'gained attack');
  assert.equal(describeRevealActions([{ kind: 'attack-fixed', amount: 2 }]), 'gained attack');
  assert.equal(
    describeRevealActions([{ kind: 'choose-discard-or-return' }]),
    'queued a choice',
  );
  assert.equal(
    describeRevealActions([{ kind: 'attack-by-cost' }, { kind: 'choose-discard-or-return' }]),
    'gained attack, queued a choice',
  );
});

// why: WP-417 / D-24237 — WP-B.2 realized-result item; names the matched actions
// whose helper guard fired and mutated nothing.
test('describeUnappliedRevealActions names each unapplied action kind', () => {
  assert.equal(describeUnappliedRevealActions([{ kind: 'draw' }].map((a) => a.kind)), 'the draw');
  assert.equal(describeUnappliedRevealActions(['ko']), 'the KO');
  assert.equal(describeUnappliedRevealActions(['attack-by-cost']), 'the attack grant');
  assert.equal(describeUnappliedRevealActions(['choose-discard-or-return']), 'the choice');
  assert.equal(describeUnappliedRevealActions([]), '');
});

test('formatRevealOutcomeLine reports a matched-but-unapplied action', () => {
  const extId = 'core/hawkeye/quick-draw#3';
  const data = { [extId]: display(extId, 'Quick Draw') };
  assert.equal(
    formatRevealOutcomeLine(data, '0', extId, 2, {
      matched: true,
      predicateText: 'cost ≤ 2',
      actionsText: 'drew it',
      unappliedActionsText: 'the draw',
    }),
    'Player 0 revealed Quick Draw (core/hawkeye/quick-draw#3) (cost 2) — cost ≤ 2 matched: drew it, but the draw could not be applied.',
  );
});

test('formatRevealOutcomeLine omits the unapplied clause when everything applied', () => {
  const extId = 'core/hawkeye/quick-draw#3';
  const data = { [extId]: display(extId, 'Quick Draw') };
  assert.equal(
    formatRevealOutcomeLine(data, '0', extId, 2, {
      matched: true,
      predicateText: 'cost ≤ 2',
      actionsText: 'drew it',
      unappliedActionsText: '',
    }),
    'Player 0 revealed Quick Draw (core/hawkeye/quick-draw#3) (cost 2) — cost ≤ 2 matched: drew it.',
  );
});

test('formatRevealOutcomeLine renders a matched reveal with the named card', () => {
  const extId = 'antm/black-knight/amulet-of-avalon#3';
  const data = { [extId]: display(extId, 'Amulet of Avalon') };
  assert.equal(
    formatRevealOutcomeLine(data, '0', extId, 3, {
      matched: true,
      predicateText: 'cost ≤ 3',
      actionsText: 'drew it',
    }),
    'Player 0 revealed Amulet of Avalon (antm/black-knight/amulet-of-avalon#3) (cost 3) — cost ≤ 3 matched: drew it.',
  );
});

test('formatRevealOutcomeLine renders the no-branch-matched form', () => {
  const extId = 'core-wound';
  const data = { [extId]: display(extId, 'Wound') };
  assert.equal(
    formatRevealOutcomeLine(data, '0', extId, 5, { matched: false }),
    'Player 0 revealed Wound (core-wound) (cost 5) — no branch matched (left on top).',
  );
});

test('formatRevealOutcomeLine falls back to the ext-id when the card is absent', () => {
  assert.equal(
    formatRevealOutcomeLine({}, '1', 'core/missing#0', 2, {
      matched: true,
      predicateText: 'always',
      actionsText: 'gained attack',
    }),
    'Player 1 revealed core/missing#0 (core/missing#0) (cost 2) — always matched: gained attack.',
  );
});
