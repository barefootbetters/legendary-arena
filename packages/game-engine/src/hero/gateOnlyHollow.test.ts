/**
 * Gate-only hero lines surface as honest hollows (D-24623).
 *
 * A hero line whose only resolved piece is its play gate (`[hc:X]: <text>`,
 * `[team:X]: <text>`, or a condition keyword such as Outwit / Savior) parsed to a
 * hook with `conditions` and no effect. The WP-257 detector skips a hook that
 * declares nothing, so a passed gate fired nothing and reported nothing: cvwr
 * Storm & Black Panther "Tsunami of Justice" in operator match VP1KNXl2ENQ. The
 * parser now records `rule:<concept>`, the unmatched multi-word keyword name, or
 * `gate-only`, and a failed gate over such a body no longer implies the effect
 * would have fired.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { LegendaryGameState } from '../types.js';

// why: the exact generated ability lines, verified against data/cards cvwr.json
// (storm-black-panther/tsunami-of-justice), ca75.json
// (captain-america-1941/punch-evil-in-the-face), cvwr.json (falcon/talk-with-birds),
// amwp.json (ant-army/anti-tank-weapons line 0) and anni.json
// (brainstorm/protege-of-dr-doom line 1).
const TSUNAMI_OF_JUSTICE_ABILITY = '[hc:covert]: You may KO a card from your hand or discard pile.';
const PUNCH_EVIL_ABILITY = '[keyword:Savior]: [keyword:Man Out of Time]';
const TALK_WITH_BIRDS_ABILITY = '[hc:ranged]: Gain a [rule:Sidekick].';
const MICROSCOPIC_ABILITY = '[keyword:Microscopic Size-Changing] [hc:tech][hc:tech][hc:tech]';
const DANGER_SENSE_ABILITY = '[hc:covert]: [keyword:Danger Sense 2]';
const PROTEGE_REMINDER =
  '(Take another turn; or draw three extra cards at end of turn; or you may recruit a [hc:tech] or [hc:ranged] Hero for free; or all other players draw a card or discard a card.)';

/** Parses one ability line into its single hook (`test/hero/card#0`). */
function buildHook(ability: string): HeroAbilityHook {
  const setData = {
    abbr: 'test',
    heroes: [{
      slug: 'hero',
      cards: [{ slug: 'card', abilities: [ability] }],
      physicalCards: [{ id: 'p0', count: 1, sides: ['card'] }],
    }],
  };
  const registry = {
    listCards: () => [],
    listSets: () => [{ abbr: 'test' }],
    getSet: (abbr: string) => (abbr === 'test' ? setData : undefined),
  };
  const config: MatchSetupConfig = {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: ['test/hero'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  const hook = buildHeroAbilityHooks(registry, config).find(
    (candidate) => candidate.cardId === 'test/hero/card#0',
  );
  assert.ok(hook !== undefined, 'the hook is built from the ability line');
  return hook;
}

/**
 * Builds a state with the given hook's card in play, plus an optional second in-play
 * card of the given hero class so a `heroClassMatch` gate can pass.
 */
function makeGateState(hook: HeroAbilityHook, allyClass: string | null): LegendaryGameState {
  const gameState = buildInitialGameState(
    {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    {},
    makeMockCtx(),
  );
  const inPlay = [hook.cardId];
  const cardTraits: Record<string, { heroClass: string | null; team: string | null }> = {
    [hook.cardId]: { heroClass: 'covert', team: null },
  };
  if (allyClass !== null) {
    inPlay.push('ally-card');
    cardTraits['ally-card'] = { heroClass: allyClass, team: null };
  }
  gameState.playerZones['0']!.inPlay = inPlay;
  gameState.cardTraits = cardTraits;
  gameState.heroAbilityHooks = [hook];
  return gameState;
}

describe('gate-only hero lines record an unresolved marker (D-24623)', () => {
  it('Tsunami of Justice keeps its covert gate and records gate-only', () => {
    const hook = buildHook(TSUNAMI_OF_JUSTICE_ABILITY);
    assert.deepEqual(hook.conditions, [{ type: 'heroClassMatch', value: 'covert' }]);
    assert.deepEqual(hook.keywords, ['conditional']);
    assert.equal(hook.effects, undefined, 'no effect is fabricated');
    assert.deepEqual(hook.unresolvedMarkers, ['gate-only']);
  });

  it('a condition keyword gate over a multi-word keyword names that keyword', () => {
    const hook = buildHook(PUNCH_EVIL_ABILITY);
    assert.equal(hook.conditions?.[0]?.type, 'bystandersInVictoryAtLeast');
    assert.deepEqual(hook.unresolvedMarkers, ['man-out-of-time']);
  });

  it('a space-magnitude keyword drops its magnitude like the coverage probe', () => {
    assert.deepEqual(buildHook(DANGER_SENSE_ABILITY).unresolvedMarkers, ['danger-sense']);
    assert.deepEqual(buildHook(MICROSCOPIC_ABILITY).unresolvedMarkers, ['microscopic-size-changing']);
  });

  it('a gated [rule:X] line records the rule concept, not gate-only', () => {
    assert.deepEqual(buildHook(TALK_WITH_BIRDS_ABILITY).unresolvedMarkers, ['rule:sidekick']);
  });

  it('a whole-line reminder parenthetical stays exempt even with a gate', () => {
    assert.equal(buildHook(PROTEGE_REMINDER).unresolvedMarkers, undefined);
  });

  it('a gated line that resolved an effect keeps its hook free of markers', () => {
    const hook = buildHook('[hc:covert]: [keyword:draw:1]');
    assert.equal(hook.unresolvedMarkers, undefined);
    assert.ok((hook.effects ?? []).length > 0, 'the draw still resolves');
  });
});

describe('gate-only hooks at play time (D-24623)', () => {
  it('a passed gate records a parse-unrecognized gate-only hollow', () => {
    const hook = buildHook(TSUNAMI_OF_JUSTICE_ABILITY);
    const gameState = makeGateState(hook, 'covert');

    executeHeroEffects(gameState, makeMockCtx(), '0', hook.cardId);

    const records = gameState.diagnostics?.hollowEffects ?? [];
    assert.equal(records.length, 1, 'exactly one hollow record');
    assert.equal(records[0]!.reason, 'parse-unrecognized');
    assert.equal(records[0]!.mechanic, 'gate-only');
  });

  it('a failed gate records no hollow and says the effect is not supported', () => {
    const hook = buildHook(TSUNAMI_OF_JUSTICE_ABILITY);
    const gameState = makeGateState(hook, null);

    executeHeroEffects(gameState, makeMockCtx(), '0', hook.cardId);

    assert.equal(gameState.diagnostics?.hollowEffects?.length ?? 0, 0,
      'a failed gate is a reachable outcome, never hollow');
    const gateLine = gameState.messages.find((entry) => entry.text.includes('did not activate'));
    assert.ok(gateLine !== undefined, 'the failed gate is still logged');
    assert.ok(gateLine.text.includes('it needs another covert Hero played this turn'),
      'the failed condition is still named');
    assert.ok(gateLine.text.endsWith('Its effect is not supported yet.'),
      `the line must not imply a working effect: ${gateLine.text}`);
  });

  it('a failed gate over an executable effect keeps the original wording', () => {
    const hook = buildHook('[hc:covert]: [keyword:draw:1]');
    const gameState = makeGateState(hook, null);

    executeHeroEffects(gameState, makeMockCtx(), '0', hook.cardId);

    const gateLine = gameState.messages.find((entry) => entry.text.includes('did not activate'));
    assert.ok(gateLine !== undefined, 'the failed gate is logged');
    assert.ok(!gateLine.text.includes('not supported'), 'a real effect is not called unsupported');
  });
});
