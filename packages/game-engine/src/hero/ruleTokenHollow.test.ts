/**
 * `[rule:X]`-only hero lines surface as honest hollows (D-24618).
 *
 * A `[rule:X]` token names a rules concept (Shard, Sidekick, Divided Card,
 * multicolored). The parser models none of them, so a line whose only markup is
 * `[rule:X]` built an empty hook — indistinguishable from flavor text — and the
 * hollow detector never flagged it: Penumbra ("Whenever you play a [rule:Divided
 * Card] card this turn, play both sides…") was played 4 times in match 19720cb4
 * with no hollow record. The parser now records `rule:<concept>` as an unresolved
 * marker on a line that resolved nothing else, so the detector flags it
 * `parse-unrecognized`. Reminder parentheticals stay exempt, and a line that
 * already resolved an effect keeps its hook byte-identical.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: the exact generated ability lines, verified against data/cards/cvwr.json
// (cloak-dagger/penumbra), cosm.json (adam-warlock/soulblast), ssw1.json
// (black-panther/king-of-wakanda), msis.json (black-panther/vibranium-nanites) and
// mgtg.json (rocket-groot/we-are-groot).
const PENUMBRA_ABILITY =
  'Whenever you play a [rule:Divided Card] card this turn, play both sides as if they were two different cards.';
const SOULBLAST_ABILITY = 'Gain 2 [rule:Shards].';
const KING_OF_WAKANDA_ABILITY = 'Gain three [rule:Sidekicks].';
const VIBRANIUM_NANITES_ABILITY =
  "Reveal the top card of your deck. If it's [rule:multicolored], draw it. Otherwise, put it back or discard it.";
const WE_ARE_GROOT_REMINDER = '(Each [rule:Divided Card] has two different card names.)';

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

describe('[rule:X]-only hero lines record an unresolved rule marker (D-24618)', () => {
  it('Penumbra records rule:divided-card and nothing executable', () => {
    const hook = buildHook(PENUMBRA_ABILITY);
    assert.deepEqual(hook.unresolvedMarkers, ['rule:divided-card']);
    assert.equal(hook.effects, undefined, 'no effect is fabricated');
    assert.deepEqual(hook.keywords, []);
  });

  it('a plural rule token folds onto its singular concept', () => {
    assert.deepEqual(buildHook(SOULBLAST_ABILITY).unresolvedMarkers, ['rule:shard']);
    assert.deepEqual(buildHook(KING_OF_WAKANDA_ABILITY).unresolvedMarkers, ['rule:sidekick']);
  });

  it('a multi-word lower-case concept slugifies verbatim', () => {
    assert.deepEqual(buildHook(VIBRANIUM_NANITES_ABILITY).unresolvedMarkers, ['rule:multicolored']);
  });

  it('a whole-line reminder parenthetical records no marker', () => {
    assert.equal(buildHook(WE_ARE_GROOT_REMINDER).unresolvedMarkers, undefined);
  });

  it('a line that already resolved an effect keeps its hook free of rule markers', () => {
    // why: scoped to fully-empty lines — a rule token beside a real effect must not
    // change the hook (the mixed-hook rule would never flag it anyway, and an extra
    // field would perturb the coverage probe's hook dedupe for no signal).
    const hook = buildHook('[keyword:draw:1] Gain a [rule:Shard].');
    assert.equal(hook.unresolvedMarkers, undefined);
    assert.ok((hook.effects ?? []).length > 0, 'the draw still resolves');
  });

  it('a line with no rule token and no markup stays flavor text', () => {
    assert.equal(buildHook('Nothing to see here.').unresolvedMarkers, undefined);
  });
});
