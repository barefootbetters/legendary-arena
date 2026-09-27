/**
 * Ungated multi-word keyword lines surface as honest hollows (D-24624).
 *
 * KEYWORD_PATTERN admits only `[keyword:Name]` / `[keyword:Name:N]`, so a multi-word or
 * space-magnitude token ("[keyword:Soaring Flight]", "[keyword:Danger Sense 2]") is dropped.
 * On an UNGATED line with nothing else resolved the hook was fully empty, which the WP-257
 * detector reads as flavor text: 153 hero lines did nothing and reported nothing. The parser
 * now records the unmatched keyword name, and a line led by a recruit / fight / reveal keyword
 * carries that printed timing (data/metadata/keywords-full.json) instead of onPlay.
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

// why: the exact generated ability lines, verified against data/cards xmen.json
// (cannonball/kinetic-blast-field line 0, banshee/sonic-blastwave line 0,
// aurora-northstar line "All Heroes you recruit…"), cosm.json (moondragon/psionic-warning),
// mgtg.json (mantis Excessive Kindness), dims.json (jessica-jones Switcheroo 4),
// rlmk.json (medusa "When Recruited") and gotg.json (star-lord Artifact header).
const SOARING_FLIGHT_ABILITY = '[keyword:Soaring Flight]';
const PIERCING_ENERGY_ABILITY = '[keyword:Piercing Energy]';
const GRANT_SOARING_FLIGHT_ABILITY = 'All Heroes you recruit this turn have [keyword:Soaring Flight].';
const DANGER_SENSE_ABILITY = '[keyword:Danger Sense 2]';
const EXCESSIVE_KINDNESS_ABILITY = '[keyword:Excessive Kindness]: You may KO one of your cards.';
const SWITCHEROO_ABILITY = '[keyword:Switcheroo 4]';
const WHEN_RECRUITED_ABILITY = '[keyword:"When Recruited" Abilities]: Gain the [keyword:Thrones Favor].';
const ARTIFACT_HEADER_ABILITY = '[keyword:Artifact -]';

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

/** Builds a state with only the given hook's card in play. */
function makePlayState(hook: HeroAbilityHook): LegendaryGameState {
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
  gameState.playerZones['0']!.inPlay = [hook.cardId];
  gameState.cardTraits = { [hook.cardId]: { heroClass: 'covert', team: null } };
  gameState.heroAbilityHooks = [hook];
  return gameState;
}

describe('ungated multi-word keyword lines record an unresolved marker (D-24624)', () => {
  it('a bare play-time keyword header names the keyword at onPlay', () => {
    const hook = buildHook(DANGER_SENSE_ABILITY);
    assert.deepEqual(hook.keywords, []);
    assert.equal(hook.conditions, undefined, 'no gate is fabricated');
    assert.equal(hook.effects, undefined, 'no effect is fabricated');
    assert.deepEqual(hook.unresolvedMarkers, ['danger-sense']);
    assert.equal(hook.timing, 'onPlay');
  });

  it('recruit-time keywords carry onRecruit', () => {
    const soaringFlight = buildHook(SOARING_FLIGHT_ABILITY);
    assert.deepEqual(soaringFlight.unresolvedMarkers, ['soaring-flight']);
    assert.equal(soaringFlight.timing, 'onRecruit');

    const excessiveKindness = buildHook(EXCESSIVE_KINDNESS_ABILITY);
    assert.deepEqual(excessiveKindness.unresolvedMarkers, ['excessive-kindness']);
    assert.equal(excessiveKindness.timing, 'onRecruit');

    const whenRecruited = buildHook(WHEN_RECRUITED_ABILITY);
    assert.deepEqual(whenRecruited.unresolvedMarkers, ['"when-recruited"-abilities', 'thrones-favor']);
    assert.equal(whenRecruited.timing, 'onRecruit', 'the LEADING keyword sets the timing');
  });

  it('fight-time and reveal-time keywords carry their printed timing', () => {
    assert.equal(buildHook(PIERCING_ENERGY_ABILITY).timing, 'onFight');
    const switcheroo = buildHook(SWITCHEROO_ABILITY);
    assert.deepEqual(switcheroo.unresolvedMarkers, ['switcheroo']);
    assert.equal(switcheroo.timing, 'onReveal');
  });

  it('a sentence that only mentions a recruit keyword stays a play effect', () => {
    const hook = buildHook(GRANT_SOARING_FLIGHT_ABILITY);
    assert.deepEqual(hook.unresolvedMarkers, ['soaring-flight']);
    assert.equal(hook.timing, 'onPlay');
  });

  it('keeps the coverage-probe normalization for punctuated names', () => {
    assert.deepEqual(buildHook(ARTIFACT_HEADER_ABILITY).unresolvedMarkers, ['artifact--']);
  });

  it('plain-English lines and reminders stay empty (no gate-only fallback)', () => {
    assert.equal(buildHook('Nothing to see here.').unresolvedMarkers, undefined);
    assert.equal(buildHook('([keyword:Soaring Flight] is a reminder.)').unresolvedMarkers, undefined);
  });

  it('a line that resolved an effect keeps its hook free of markers', () => {
    const hook = buildHook('[keyword:draw:1] [keyword:Danger Sense 2]');
    assert.equal(hook.unresolvedMarkers, undefined);
    assert.ok((hook.effects ?? []).length > 0, 'the draw still resolves');
  });
});

describe('ungated keyword hooks at play time (D-24624)', () => {
  it('a recruit-time keyword records its hollow labelled onRecruit', () => {
    const hook = buildHook(SOARING_FLIGHT_ABILITY);
    const gameState = makePlayState(hook);

    executeHeroEffects(gameState, makeMockCtx(), '0', hook.cardId);

    const records = gameState.diagnostics?.hollowEffects ?? [];
    assert.equal(records.length, 1, 'exactly one hollow record');
    assert.equal(records[0]!.reason, 'parse-unrecognized');
    assert.equal(records[0]!.mechanic, 'soaring-flight');
    assert.equal(records[0]!.timing, 'onRecruit', 'the record never claims a play-time effect');
  });

  it('a play-time keyword records its hollow at onPlay', () => {
    const hook = buildHook(DANGER_SENSE_ABILITY);
    const gameState = makePlayState(hook);

    executeHeroEffects(gameState, makeMockCtx(), '0', hook.cardId);

    const records = gameState.diagnostics?.hollowEffects ?? [];
    assert.equal(records.length, 1, 'exactly one hollow record');
    assert.equal(records[0]!.mechanic, 'danger-sense');
    assert.equal(records[0]!.timing, 'onPlay');
  });
});
