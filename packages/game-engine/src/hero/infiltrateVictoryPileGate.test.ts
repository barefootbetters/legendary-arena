/**
 * WP-904 / D-24861 — Black Widow's "Infiltrate the Conspiracy" line 1 gates its +3 Attack on
 * ">= 4 Bystanders and/or Undercover Heroes in your Victory Pile".
 *
 * Before this WP the line carried no marker, so buildHeroAbilityHooks read only the
 * +3[icon:attack] and granted it on every play (the phantom-grant family). The curated marker
 * [keyword:bystanders-or-undercover-threshold:4] now adds the on-play condition
 * `bystandersOrUndercoverInVictoryAtLeast` that counts victory ∩ (bystanders ∪ undercover) by
 * membership in `victory` (Unleash-proof) and fires the +3 only at >= 4. The grant stays on the
 * hook; the marker only gates it.
 *
 * Reading A (D-24861): the count is read on play, present-state. The same-card line-0 Undercover
 * send parks and resolves after commit, so the Hero it is about to send is NOT counted.
 *
 * Parse cases build hooks from the ability lines verbatim in the committed data/cards/bkwd.json,
 * so the test fails if the marker ever leaves that generated file. node:test + node:assert only;
 * no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { evaluateCondition, describeFailedCondition } from './heroConditions.evaluate.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { makePlayerZones } from '../test/fixtureBuilders.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { LegendaryGameState } from '../types.js';

const BKWD_JSON_PATH = fileURLToPath(new URL('../../../../data/cards/bkwd.json', import.meta.url));

/** Reads the Infiltrate the Conspiracy ability lines straight from the committed bkwd.json. */
function committedInfiltrateAbilities(): string[] {
  const set = JSON.parse(readFileSync(BKWD_JSON_PATH, 'utf8')) as {
    heroes: { slug: string; cards: { slug: string; abilities: string[] }[] }[];
  };
  const blackWidow = set.heroes.find((hero) => hero.slug === 'black-widow');
  assert.ok(blackWidow, 'bkwd.json has a black-widow hero');
  const infiltrate = blackWidow.cards.find((card) => card.slug === 'infiltrate-the-conspiracy');
  assert.ok(infiltrate, 'black-widow has infiltrate-the-conspiracy');
  return infiltrate.abilities;
}

/** Builds the hooks for Infiltrate the Conspiracy from the committed ability lines. */
function buildInfiltrateHooks(): HeroAbilityHook[] {
  const setData = {
    abbr: 'bkwd',
    heroes: [{
      slug: 'black-widow',
      cards: [{ slug: 'infiltrate-the-conspiracy', abilities: committedInfiltrateAbilities() }],
      physicalCards: [{ id: 'p0', count: 1, sides: ['infiltrate-the-conspiracy'] }],
    }],
  };
  const registry = {
    listCards: () => [],
    listSets: () => [{ abbr: 'bkwd' }],
    getSet: (abbr: string) => (abbr === 'bkwd' ? setData : undefined),
  };
  const config: MatchSetupConfig = {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: ['bkwd/black-widow'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  return buildHeroAbilityHooks(registry, config);
}

/** Returns the Infiltrate line-1 (attack-grant) hook — the one whose effects grant Attack. */
function infiltrateAttackHook(): HeroAbilityHook {
  const attackHooks = buildInfiltrateHooks().filter((hook) =>
    hook.effects.some((effect) => effect.type === 'attack'),
  );
  assert.equal(attackHooks.length, 1, 'exactly one Infiltrate hook grants Attack');
  return attackHooks[0]!;
}

/**
 * A minimal game state carrying only the one player's Victory Pile and Undercover tracker — the
 * two zones the on-play count reads. The evaluator and describer dereference nothing else for
 * this condition type.
 */
function stateWith(victory: string[], undercover: string[]): LegendaryGameState {
  return {
    playerZones: { '0': makePlayerZones({ victory, undercover }) },
  } as unknown as LegendaryGameState;
}

describe('WP-904 — Infiltrate the Conspiracy parses to a gated +3 Attack', () => {
  it('line 1 keeps its +3 Attack grant AND gains the Victory-Pile gate', () => {
    const hook = infiltrateAttackHook();
    assert.deepEqual(hook.effects, [{ type: 'attack', magnitude: 3 }], 'the +3 Attack grant stays');
    assert.deepEqual(
      hook.conditions,
      [{ type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }],
      'the grant is gated on the new on-play condition at threshold 4',
    );
    assert.ok(hook.keywords.includes('attack'), 'the line keeps keywords: [attack]');
  });

  it('is no longer an ungated grant and leaves no unresolved marker', () => {
    const hook = infiltrateAttackHook();
    assert.notDeepEqual(hook.conditions, [], 'the pre-WP-904 ungated parse (conditions: []) is gone');
    assert.deepEqual(hook.unresolvedMarkers ?? [], [], 'the curated marker resolves — no hollow');
  });
});

describe('WP-904 — bystandersOrUndercoverInVictoryAtLeast fires at exactly >= 4', () => {
  it('false with 3 Bystanders in the Victory Pile', () => {
    const G = stateWith([BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, 'bystander-villain-deck-0'], []);
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }), false);
  });

  it('true with 4 Bystanders in the Victory Pile', () => {
    const G = stateWith(
      [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, 'bystander-villain-deck-7'],
      [],
    );
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }), true);
  });

  it('true with 3 Bystanders + 1 Undercover Hero (the widened count)', () => {
    const G = stateWith(
      [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, 'bystander-villain-deck-0', 'bkwd/black-widow/some-hero#2'],
      ['bkwd/black-widow/some-hero#2'],
    );
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }), true);
  });

  it('true with 4 Undercover Heroes and no Bystanders', () => {
    const undercoverHeroes = ['hero#1', 'hero#2', 'hero#3', 'hero#4'];
    const G = stateWith([...undercoverHeroes], [...undercoverHeroes]);
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }), true);
  });

  it('does not count a Victory-Pile card that is neither a Bystander nor Undercover', () => {
    const G = stateWith(
      [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, 'some-villain', 'another-villain'],
      [],
    );
    // three Bystanders + two plain villains = 3, below the threshold.
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }), false);
  });

  it('Unleash-robust: a tracker id no longer in the Victory Pile is not counted', () => {
    // why: the undercover tracker is append-only; a Hero Unleashed out of the Victory Pile
    // leaves `victory` and must stop counting even though its id lingers in `undercover`.
    const G = stateWith(
      [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID],
      ['hero#1', 'hero#2'], // both tracked, neither in victory any longer
    );
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }), false);
  });

  it('a card both in victory and in the tracker counts once (no double count)', () => {
    const G = stateWith(
      ['hero#1', 'hero#2', 'hero#3'],
      ['hero#1', 'hero#2', 'hero#3'],
    );
    // three Undercover Heroes = 3, not 6; the threshold of 4 is not met.
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }), false);
  });

  it('a NaN / garbage threshold reads false (safe skip)', () => {
    const G = stateWith([BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID], []);
    assert.equal(evaluateCondition(G, '0', { type: 'bystandersOrUndercoverInVictoryAtLeast', value: 'x' }), false);
  });
});

describe('WP-904 — describeFailedCondition quotes the running count', () => {
  it('names the requirement and the actual Bystander/Undercover count', () => {
    const G = stateWith([BYSTANDER_EXT_ID, 'bkwd/black-widow/some-hero#2'], ['bkwd/black-widow/some-hero#2']);
    assert.equal(
      describeFailedCondition(G, '0', { type: 'bystandersOrUndercoverInVictoryAtLeast', value: '4' }),
      'it needs 4 Bystanders and/or Undercover Heroes in your Victory Pile — you have 2',
    );
  });
});
