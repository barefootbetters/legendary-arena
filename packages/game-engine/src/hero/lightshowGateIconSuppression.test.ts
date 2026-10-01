/**
 * Lightshow gate icon suppression (D-24622).
 *
 * "[keyword:Lightshow]: <effect>" is gated (rules v23 ~L1616): once per turn, only when at least
 * two Lightshow cards were played this turn, the player uses a SINGLE Lightshow ability from any
 * of those cards. No Lightshow handler exists, yet the icon-magnitude (Step 2b) and icon->keyword
 * (Step 3) reads in buildHeroAbilityHooks fired every Lightshow line's icon as an unconditional
 * grant on every play. Operator match 19720cb4 showed it live: a lone Blazing Flare granted +2
 * recruit, and two Blazing Flares plus Twin Blast granted +2, +2 and +3. The parse site now
 * suppresses every icon from the Lightshow token to the end of the line (the D-24606 Focus
 * precedent), leaving an honest `lightshow` hollow until a Lightshow executor exists.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: the exact generated ability lines, verified against data/cards/xmen.json
// (aurora-northstar/blazing-flare, twin-blast, mach-10; dazzler/convert-sound-to-light;
// havok/blinding-burst; jubilee/prismatic-cascade). The missing space before "for each" in
// Mach 10 and Prismatic Cascade is the printed data verbatim.
const BLAZING_FLARE_ABILITY = '[keyword:Lightshow]: You get +2[icon:recruit].';
const TWIN_BLAST_ABILITY = '[keyword:Lightshow]: You get +3[icon:attack].';
const MACH_10_ABILITY =
  '[keyword:Lightshow]: You get +2[icon:attack]for each [keyword:Lightshow] card you played ' +
  'this turn.';
const CONVERT_SOUND_TO_LIGHT_ABILITY =
  '[keyword:Lightshow]: You get +1[icon:6] for each Lightshow card you played this turn.';
const BLINDING_BURST_ABILITY =
  '[keyword:Lightshow]: You get +3[icon:attack] usable only against the Mastermind.';
const PRISMATIC_CASCADE_ABILITY =
  '[keyword:Lightshow]: You get +1[icon:recruit]and +1[icon:attack]for each ' +
  '[keyword:Lightshow] card you played this turn.';

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
 * Asserts a Lightshow line is inert (no attack / recruit effect or keyword) and stays a
 * detectable hollow via its `lightshow` unresolved marker.
 */
function assertInertLightshowLine(hook: HeroAbilityHook, cardName: string): void {
  const resourceEffects = (hook.effects ?? []).filter(
    (effect) => effect.type === 'attack' || effect.type === 'recruit',
  );
  assert.deepStrictEqual(resourceEffects, [], `${cardName}: no attack or recruit grant`);
  assert.ok(!hook.keywords.includes('attack'), `${cardName}: no plain attack keyword`);
  assert.ok(!hook.keywords.includes('recruit'), `${cardName}: no plain recruit keyword`);
  assert.ok(
    (hook.unresolvedMarkers ?? []).includes('lightshow'),
    `${cardName}: the unmodeled Lightshow gate stays a parse-unrecognized hollow`,
  );
}

describe('Lightshow gate icon suppression (D-24622)', () => {
  it('Blazing Flare — a lone Lightshow card does not grant +2 recruit', () => {
    assertInertLightshowLine(buildHook(BLAZING_FLARE_ABILITY), 'Blazing Flare');
  });

  it('Twin Blast — the gated +3 attack is not granted on every play', () => {
    assertInertLightshowLine(buildHook(TWIN_BLAST_ABILITY), 'Twin Blast');
  });

  it('Mach 10 — the per-Lightshow-card scaler is not a flat +2 attack grant', () => {
    assertInertLightshowLine(buildHook(MACH_10_ABILITY), 'Mach 10');
  });

  it('Prismatic Cascade — neither the recruit nor the attack half is granted', () => {
    assertInertLightshowLine(buildHook(PRISMATIC_CASCADE_ABILITY), 'Prismatic Cascade');
  });

  it('Blinding Burst — the Mastermind-only +3 attack is not granted', () => {
    assertInertLightshowLine(buildHook(BLINDING_BURST_ABILITY), 'Blinding Burst');
  });

  it('Convert Sound to Light — stays an honest lightshow hollow', () => {
    assertInertLightshowLine(buildHook(CONVERT_SOUND_TO_LIGHT_ABILITY), 'Convert Sound to Light');
  });

  it('a grant icon on a line with no Lightshow gate is kept', () => {
    const hook = buildHook('You get +2[icon:recruit].');
    const recruitEffects = (hook.effects ?? []).filter((effect) => effect.type === 'recruit');
    assert.deepStrictEqual(recruitEffects, [{ type: 'recruit', magnitude: 2 }]);
    assert.equal(hook.unresolvedMarkers, undefined);
  });
});
