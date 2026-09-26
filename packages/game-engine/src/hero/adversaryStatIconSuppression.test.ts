/**
 * Adversary-stat icon suppression (D-24599).
 *
 * An unsigned attack icon that states an ADVERSARY's printed attack ("as if it were a
 * 4[icon:attack] Darkhold Demon Villain", "a Villain that has 3[icon:attack] or less",
 * "a Villain of 5 [icon:attack] or 6 [icon:attack]") describes the enemy — it is never a
 * resource the player gains. The icon-magnitude (Step 2b) and icon->keyword (Step 3) reads
 * in buildHeroAbilityHooks promoted it to a plain, unconditional attack effect: Wong's Face
 * Your Demons granted a free +4 attack on every play. The parse site now excludes those
 * icon positions (the D-24471 / D-24486 positional-suppression precedent).
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: the exact generated ability lines, verified against data/cards/mdns.json
// (wong-master-of-the-mystic-arts/face-your-demons), ssw2.json
// (soulsword-colossus/invade-the-inferno), cvwr.json (stature/crush-ants,
// trample-the-tiny), dkcy.json (ghost-rider/infernal-chains) and ff04.json
// (silver-surfer/epic-destiny). The "Vilan" typo is the printed data verbatim.
const FACE_YOUR_DEMONS_ABILITY =
  'Once this turn, you may fight the top card of the Bystander Deck as if it were a ' +
  '4[icon:attack] “Darkhold Demon” Vilan with “Fight: KO up to two of your Heroes. ' +
  'Rescue this card as a Bystander.”';
const FACE_YOUR_DEMONS_SUNLIGHT_ABILITY = '[keyword:Sunlight]: You get +2[icon:attack].';
const INVADE_THE_INFERNO_ABILITY =
  '[hc:covert]: Once this turn, you may fight the top card of the Bystander Stack as if it ' +
  'were a 3[icon:attack] Demon Villain with “Fight: KO one of your heroes.“';
const CRUSH_ANTS_ABILITY = '[hc:strength]: Defeat a Villain that has 3[icon:attack] or less.';
const TRAMPLE_THE_TINY_ABILITY = '[hc:strength]: Defeat each Villain that has 4 [icon:attack] or less.';
const INFERNAL_CHAINS_ABILITY = '[hc:strength]: Defeat a Villain of 3[icon:attack] or less for free.';
const EPIC_DESTINY_ABILITY =
  '[keyword:Focus 6][icon:recruit]  [icon:5] Defeat a Villain of 5 [icon:attack] or 6 [icon:attack].';

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

/** Asserts the parsed hook carries no attack grant of any magnitude. */
function assertNoAttackGrant(hook: HeroAbilityHook, cardName: string): void {
  const attackEffects = (hook.effects ?? []).filter((effect) => effect.type === 'attack');
  assert.deepStrictEqual(attackEffects, [], `${cardName}: the adversary's attack icon is not a player grant`);
  assert.ok(!hook.keywords.includes('attack'), `${cardName}: no plain attack keyword`);
}

describe('adversary-stat icon suppression (D-24599)', () => {
  it('Face Your Demons line 0 — "as if it were a 4[icon:attack] Darkhold Demon" grants no attack', () => {
    assertNoAttackGrant(buildHook(FACE_YOUR_DEMONS_ABILITY), 'Face Your Demons');
  });

  it('Face Your Demons Sunlight line still grants its printed +2 attack', () => {
    const hook = buildHook(FACE_YOUR_DEMONS_SUNLIGHT_ABILITY);
    const attackEffects = (hook.effects ?? []).filter((effect) => effect.type === 'attack');
    assert.deepStrictEqual(attackEffects, [{ type: 'attack', magnitude: 2 }]);
  });

  it('Invade the Inferno — "as if it were a 3[icon:attack] Demon Villain" grants no attack', () => {
    assertNoAttackGrant(buildHook(INVADE_THE_INFERNO_ABILITY), 'Invade the Inferno');
  });

  it('"N[icon:attack] or less" defeat thresholds grant no attack', () => {
    assertNoAttackGrant(buildHook(CRUSH_ANTS_ABILITY), 'Crush Ants');
    assertNoAttackGrant(buildHook(TRAMPLE_THE_TINY_ABILITY), 'Trample the Tiny');
    assertNoAttackGrant(buildHook(INFERNAL_CHAINS_ABILITY), 'Infernal Chains');
  });

  it('"a Villain of 5 [icon:attack] or 6 [icon:attack]" suppresses both icons', () => {
    assertNoAttackGrant(buildHook(EPIC_DESTINY_ABILITY), 'Epic Destiny');
  });

  it('a grant icon on the same line as an adversary-stat icon is kept', () => {
    const hook = buildHook(
      'Defeat a Villain that has 3[icon:attack] or less. You get +2[icon:attack].',
    );
    const attackEffects = (hook.effects ?? []).filter((effect) => effect.type === 'attack');
    assert.deepStrictEqual(attackEffects, [{ type: 'attack', magnitude: 2 }]);
  });
});
