/**
 * Focus cost icon suppression (D-24600).
 *
 * The Annihilation-era Focus prefix ("[keyword:Focus] 3[icon:recruit] [icon:5] <effect>",
 * ff04 "[keyword:Focus 9][icon:recruit]  [icon:5] <effect>") is a pay-to-activate ability:
 * spend N to do the effect. No Focus handler exists, yet the icon-magnitude (Step 2b) and
 * icon->keyword (Step 3) reads in buildHeroAbilityHooks promoted the COST to a +N grant and
 * fired the gated effect unconditionally: The Power Cosmic granted recruit + 9 attack on every
 * play. The parse site now suppresses every icon from the Focus token to the end of the line
 * (the D-24471 / D-24486 positional-suppression precedent), leaving an honest `focus` hollow.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: the exact generated ability lines, verified against data/cards/anni.json
// (fantastic-four-united/invisible-woman line 1, psi-lord/reshape-reality line 0,
// super-skrull/stretching-credibility line 0, super-skrull/rock-solid line 1) and
// ff04.json (silver-surfer/the-power-cosmic, silver-surfer/warp-speed). The double space
// in the ff04 form is the printed data verbatim.
const INVISIBLE_WOMAN_FOCUS_ABILITY =
  '[keyword:Focus] 4[icon:recruit] [icon:5] Rescue a Bystander, then you may KO a card from ' +
  'your hand or discard pile.';
const RESHAPE_REALITY_ABILITY =
  '[keyword:Focus] 3[icon:recruit] [icon:5] Reveal the top card of the Villain Deck. If ' +
  "it's a Scheme Twist, you get +4[icon:attack] and shuffle the Villain Deck.";
const STRETCHING_CREDIBILITY_ABILITY =
  '[keyword:Focus] 2[icon:attack] [icon:5] When you draw a new hand of cards at the end of ' +
  'this turn, draw an extra card.';
const ROCK_SOLID_FOCUS_ABILITY = '[keyword:Focus] 3[icon:attack] [icon:5] You get +2[icon:recruit].';
const THE_POWER_COSMIC_ABILITY = '[keyword:Focus 9][icon:recruit]  [icon:5] You get +9 [icon:attack].';
const WARP_SPEED_ABILITY = '[keyword:Focus 2][icon:recruit]  [icon:5] Draw a card.';

/** Parses one ability line into its single hook (`test/hero/card#0`). */
function buildHook(ability: string): HeroAbilityHook {
  const setData = {
    abbr: 'test',
    heroes: [{
      slug: 'hero',
      cards: [{ slug: 'card', abilities: [ability] }],
      physicalCards: [{ id: 'p0', count: 1, sides: ['card'] }],
    }],
    villains: [],
    henchmen: [],
    schemes: [],
    masterminds: [],
    bystanders: [],
    wounds: [],
    other: [],
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
  const hooks = buildHeroAbilityHooks(registry, config);
  const hook = hooks.find((candidate) => candidate.cardId === 'test/hero/card#0');
  assert.ok(hook !== undefined, 'the hook is built from the ability line');
  return hook;
}

/**
 * Asserts a Focus line is inert (no attack / recruit effect or keyword) and stays a
 * detectable hollow via its `focus` unresolved marker.
 */
function assertInertFocusLine(hook: HeroAbilityHook, cardName: string): void {
  const resourceEffects = (hook.effects ?? []).filter(
    (effect) => effect.type === 'attack' || effect.type === 'recruit',
  );
  assert.deepStrictEqual(resourceEffects, [], `${cardName}: no attack or recruit grant`);
  assert.ok(!hook.keywords.includes('attack'), `${cardName}: no plain attack keyword`);
  assert.ok(!hook.keywords.includes('recruit'), `${cardName}: no plain recruit keyword`);
  assert.ok(
    (hook.unresolvedMarkers ?? []).includes('focus'),
    `${cardName}: the unmodeled Focus cost stays a parse-unrecognized hollow`,
  );
}

describe('Focus cost icon suppression (D-24600)', () => {
  it('Invisible Woman — the "4[icon:recruit]" Focus cost is not a +4 recruit grant', () => {
    assertInertFocusLine(buildHook(INVISIBLE_WOMAN_FOCUS_ABILITY), 'Invisible Woman');
  });

  it('Reshape Reality — neither the cost nor the gated +4 attack is granted', () => {
    assertInertFocusLine(buildHook(RESHAPE_REALITY_ABILITY), 'Reshape Reality');
  });

  it('Stretching Credibility — an attack-icon Focus cost is not a +2 attack grant', () => {
    assertInertFocusLine(buildHook(STRETCHING_CREDIBILITY_ABILITY), 'Stretching Credibility');
  });

  it('Rock Solid — the gated "+2[icon:recruit]" is not granted for free', () => {
    assertInertFocusLine(buildHook(ROCK_SOLID_FOCUS_ABILITY), 'Rock Solid');
  });

  it('The Power Cosmic (ff04 "[keyword:Focus 9]" form) grants neither recruit nor +9 attack', () => {
    assertInertFocusLine(buildHook(THE_POWER_COSMIC_ABILITY), 'The Power Cosmic');
  });

  it('Warp Speed (ff04 form) records the focus marker instead of dropping it silently', () => {
    assertInertFocusLine(buildHook(WARP_SPEED_ABILITY), 'Warp Speed');
  });

  it('a grant icon on a line with no Focus cost is kept', () => {
    const hook = buildHook('You get +2[icon:attack].');
    const attackEffects = (hook.effects ?? []).filter((effect) => effect.type === 'attack');
    assert.deepStrictEqual(attackEffects, [{ type: 'attack', magnitude: 2 }]);
    assert.equal(hook.unresolvedMarkers, undefined);
  });
});
