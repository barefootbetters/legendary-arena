/**
 * A [team:X] in the body after an explicit gate prefix is not a play gate (D-24628).
 *
 * Step 1b turned EVERY inline [team:X] into a requiresTeam gate. On a line that opens with an
 * explicit "[hc:X]:" / "[team:X]:" gate, a [team:Y] after the colon names a target or criterion,
 * so the card demanded "another Y Hero played this turn" it never prints: xmen Cannonball
 * Natural Leader logged "needs another shield Hero" in live match 039e3dce. Two lines whose
 * resource grant rides an unmodeled clause (bkpt Okoye, vill Magneto) now drop that free grant
 * and record an honest hollow instead of firing it more often without the spurious gate.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: the exact generated ability lines, verified against data/cards xmen.json
// (cannonball/natural-leader line 1), wwhk.json (rick-jones/hacktivist), ca75.json
// (steve-rogers-director-of-shield/reassign-to-civilian-duty), co2e.json
// (nick-fury/stealth-assault-squad), msmc.json (m/interweaving-powers), bkpt.json
// (general-okoye/direct-the-agents-of-wakanda) and vill.json (magneto/mutants-will-rule).
const NATURAL_LEADER_ABILITY = '[hc:strength]: Return a [team:shield]Hero from your discard pile to your hand.';
const HACKTIVIST_ABILITY = '[hc:tech]: Reveal the top card of your deck. If it\'s a[team:shield], draw it.';
const REASSIGN_ABILITY =
  '[team:shield][team:shield][team:shield]: You may KO a [team:shield] Hero that you played this turn. If you do, rescue a Bystander.';
const STEALTH_ASSAULT_ABILITY = 'You get +2[icon:attack] if you played another [team:shield] Hero that costs 1 or more this turn.';
const INTERWEAVING_ABILITY = '[keyword:When Recruited] [team:x-factor-investigations]: [keyword:Clone]';
const OKOYE_ABILITY =
  '[team:heroes-of-wakanda]: You may KO a [team:shield] Hero or Wound from your hand or discard pile to get +2[icon:attack].';
const MAGNETO_ABILITIES = [
  '[keyword:Dodge]',
  '[hc:strength]: Choose a player. That player reveals a [team:brotherhood] Ally or gains a Bindings. If a Bindings is gained this way, you get +1[icon:recruit].',
];

/** Builds the `#0` hooks for one hero card with the given ability lines. */
function buildHooks(setAbbr: string, heroSlug: string, cardSlug: string, abilities: string[]): HeroAbilityHook[] {
  const setData = {
    abbr: setAbbr,
    heroes: [{
      slug: heroSlug,
      cards: [{ slug: cardSlug, abilities }],
      physicalCards: [{ id: 'p0', count: 1, sides: [cardSlug] }],
    }],
  };
  const registry = {
    listCards: () => [],
    listSets: () => [{ abbr: setAbbr }],
    getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined),
  };
  const config: MatchSetupConfig = {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: [`${setAbbr}/${heroSlug}`],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  return buildHeroAbilityHooks(registry, config).filter(
    (candidate) => candidate.cardId === `${setAbbr}/${heroSlug}/${cardSlug}#0`,
  );
}

/** Builds the single `#0` hook of a one-line test card. */
function buildHook(ability: string): HeroAbilityHook {
  const hooks = buildHooks('test', 'hero', 'card', [ability]);
  assert.equal(hooks.length, 1, 'one hook per ability line');
  return hooks[0]!;
}

describe('a body [team:X] after a gate prefix is not a gate (D-24628)', () => {
  it('Natural Leader keeps only its Strength gate', () => {
    assert.deepEqual(buildHook(NATURAL_LEADER_ABILITY).conditions, [{ type: 'heroClassMatch', value: 'strength' }]);
  });

  it('a reveal criterion after the gate is dropped too (Hacktivist)', () => {
    assert.deepEqual(buildHook(HACKTIVIST_ABILITY).conditions, [{ type: 'heroClassMatch', value: 'tech' }]);
  });

  it('a multi-token team prefix keeps its printed gates and drops the body repeat', () => {
    const conditions = buildHook(REASSIGN_ABILITY).conditions ?? [];
    assert.equal(conditions.length, 3, 'three printed [team:shield] gate tokens, not four');
  });

  it('a line with no gate prefix keeps its inline condition', () => {
    assert.deepEqual(buildHook(STEALTH_ASSAULT_ABILITY).conditions, [{ type: 'requiresTeam', value: 'shield' }]);
  });

  it('a keyword-led prefix keeps its team gate', () => {
    assert.deepEqual(buildHook(INTERWEAVING_ABILITY).conditions, [{ type: 'requiresTeam', value: 'x-factor-investigations' }]);
  });
});

describe('unmodeled conditional grants are honest hollows (D-24628)', () => {
  it('Okoye keeps her Wakanda gate and drops the free +2 attack', () => {
    const [hook] = buildHooks('bkpt', 'general-okoye', 'direct-the-agents-of-wakanda', [OKOYE_ABILITY]);
    assert.ok(hook !== undefined);
    assert.deepEqual(hook.conditions, [{ type: 'requiresTeam', value: 'heroes-of-wakanda' }]);
    assert.equal(hook.effects, undefined, 'no free attack grant');
    assert.deepEqual(hook.unresolvedMarkers, ['unmodeled-conditional-grant']);
  });

  it('Magneto drops the free +1 recruit and leaves his Dodge line alone', () => {
    const [dodgeHook, grantHook] = buildHooks('vill', 'magneto', 'mutants-will-rule', MAGNETO_ABILITIES);
    assert.ok(dodgeHook !== undefined && grantHook !== undefined);
    assert.deepEqual(dodgeHook.effects, [{ type: 'dodge' }]);
    assert.equal(dodgeHook.unresolvedMarkers, undefined, 'the Dodge line is not an unmodeled grant');
    assert.deepEqual(grantHook.conditions, [{ type: 'heroClassMatch', value: 'strength' }]);
    assert.equal(grantHook.effects, undefined, 'no free recruit grant');
    assert.deepEqual(grantHook.unresolvedMarkers, ['unmodeled-conditional-grant']);
  });

  it('the same text on a card not on the allowlist keeps its parsed grant', () => {
    const hook = buildHook(OKOYE_ABILITY);
    assert.deepEqual(hook.effects, [{ type: 'attack', magnitude: 2 }]);
  });
});
