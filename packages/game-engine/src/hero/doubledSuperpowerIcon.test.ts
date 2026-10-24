/**
 * Doubled Superpower icons need that many OTHER matching cards (WP-741 / D-24563).
 *
 * The rulebook's "Critical Hit" Superpowers (rules v23 L683-696) print a repeated icon prefix
 * ("[hc:ranged][hc:ranged]:") that needs that many OTHER cards played this turn bearing the icon.
 * Before D-24563 every such line was satisfied by one other matching card. These tests pin the
 * corrected parse (one condition carrying requiredMatches, read only from the leading prefix) over
 * the real card data, and the end-to-end gate on Bishop's Concussive Blast, a mixed pair, Captain
 * Marvel's Cosmic Energies, Crystal of Kadavus, and Out of Time set-aside cards.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook, HeroCondition } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: a literal copy of the module-private D-24628 LEADING_GATE_PREFIX_PATTERN
// (setup/heroAbility.setup.ts), so the sweep measures the same leading icon run the parser reads.
const LEADING_GATE_PREFIX_PATTERN = /^\s*(?:\[(?:hc|team):[^\]]+\]\s*)+:/;

// why: resolve the repo-root data directory from this test's own location (the
// masterStrikeOrAmbushCondition.test.ts precedent), so the sweep reads what ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

interface HeroLine {
  key: string;
  line: string;
}

/**
 * Reads every hero ability line in data/cards.
 *
 * @returns Each line with its `{setAbbr}/{heroSlug}/{cardSlug}#{lineIndex}` key.
 */
function readAllHeroLines(): HeroLine[] {
  const lines: HeroLine[] = [];
  for (const fileName of readdirSync(CARDS_DIRECTORY).sort()) {
    const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, fileName), 'utf8'));
    for (const hero of setData.heroes ?? []) {
      for (const card of hero.cards ?? []) {
        const abilities: unknown[] = card.abilities ?? [];
        abilities.forEach((line, lineIndex) => {
          if (typeof line === 'string') {
            lines.push({ key: `${setData.abbr}/${hero.slug}/${card.slug}#${lineIndex}`, line });
          }
        });
      }
    }
  }
  return lines;
}

/**
 * Counts each [hc:X] / [team:X] token in a line's leading gate prefix, keyed by the condition
 * it emits ("heroClassMatch|ranged").
 *
 * @param line - The ability line.
 * @returns The prefix token counts (empty when the line has no leading gate prefix).
 */
function prefixTokenCounts(line: string): Map<string, number> {
  const counts = new Map<string, number>();
  const prefix = LEADING_GATE_PREFIX_PATTERN.exec(line)?.[0] ?? '';
  for (const match of prefix.matchAll(/\[(hc|team):([^\]]+)\]/g)) {
    const type = match[1] === 'hc' ? 'heroClassMatch' : 'requiresTeam';
    const key = `${type}|${match[2]!.trim().toLowerCase()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Builds the hook of one ability line alone, as a single-ability synthetic card.
 *
 * @param line - The ability line.
 * @returns The `#0` hooks the line produces.
 */
function buildLineAlone(line: string): HeroAbilityHook[] {
  const setData = {
    abbr: 'test',
    heroes: [{ slug: 'hero', cards: [{ slug: 'card', abilities: [line] }], physicalCards: [{ id: 'p0', count: 1, sides: ['card'] }] }],
  };
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'test' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: ['test/hero'] } as unknown as MatchConfiguration);
}

/**
 * Builds the real hooks for one hero deck from the committed card data.
 *
 * @param setAbbr - The set abbreviation.
 * @param heroSlug - The hero slug.
 * @returns Every hook the hero deck produces.
 */
function buildRealHeroHooks(setAbbr: string, heroSlug: string): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: [`${setAbbr}/${heroSlug}`] } as unknown as MatchConfiguration);
}

/**
 * Minimal state for driving executeHeroEffects.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @param cardTraits - Printed class / team per played card id.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[], cardTraits: Record<string, object>): LegendaryGameState {
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), inPlay: [] } },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats: {},
    cardTraits,
    cardDisplayData: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    heroAbilityHooks: hooks,
    villainAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * Puts the given cards in play (already played this turn), then plays the triggering card.
 *
 * @param G - The game state, mutated in place.
 * @param others - Cards played earlier this turn.
 * @param cardId - The card being played now.
 */
function playAfter(G: LegendaryGameState, others: string[], cardId: string): void {
  G.playerZones['0']!.inPlay = [...(others as CardExtId[]), cardId as CardExtId];
  executeHeroEffects(G, mockCtx, '0', cardId as CardExtId);
}

/**
 * Returns the text of every log line.
 *
 * @param G - The game state.
 * @returns The log texts, in order.
 */
function logTexts(G: LegendaryGameState): string[] {
  return G.messages.map((entry) => (typeof entry === 'string' ? entry : entry.text));
}

describe('doubled-icon real-data sweep (WP-741 / D-24563)', () => {
  const heroLines = readAllHeroLines();

  it('every leading-repeat line collapses to one condition per repeated icon, carrying its count', () => {
    let repeatLineCount = 0;
    for (const { key, line } of heroLines) {
      const counts = prefixTokenCounts(line);
      const repeated = [...counts].filter(([, count]) => count >= 2);
      if (repeated.length === 0) {
        continue;
      }
      repeatLineCount += 1;
      const hooks = buildLineAlone(line);
      assert.equal(hooks.length, 1, `${key} builds exactly one hook`);
      const conditions: HeroCondition[] = hooks[0]!.conditions ?? [];
      for (const [conditionKey, multiplicity] of repeated) {
        const [type, value] = conditionKey.split('|');
        const matching = conditions.filter((condition) => condition.type === type && condition.value === value);
        assert.equal(matching.length, 1, `${key}: one ${conditionKey} condition`);
        assert.equal(matching[0]!.requiredMatches, multiplicity, `${key}: ${conditionKey} needs ${multiplicity}`);
      }
    }
    // why: 32 identical-repeat lines + 3 mixed lines with repeats, re-measured on 0ba20998. A
    // different count means the card data or the prefix match changed; explain it, never re-pin blindly.
    assert.equal(repeatLineCount, 35);
  });

  it('no line without a repeated leading prefix carries requiredMatches', () => {
    for (const { key, line } of heroLines) {
      const isRepeatLine = [...prefixTokenCounts(line).values()].some((count) => count >= 2);
      if (isRepeatLine) {
        continue;
      }
      for (const hook of buildLineAlone(line)) {
        for (const condition of hook.conditions ?? []) {
          assert.equal('requiredMatches' in condition, false, `${key} must not carry requiredMatches`);
        }
      }
    }
  });

  it('mid-sentence repeats stay two plain identical conditions (the Arc Reactor landmine)', () => {
    const landmines: [string, HeroCondition][] = [
      ['core/iron-man/arc-reactor#0', { type: 'heroClassMatch', value: 'tech' }],
      ['msp1/iron-man/arc-reactor#0', { type: 'heroClassMatch', value: 'tech' }],
      ['ssw1/captain-marvel/absorb-energies#0', { type: 'heroClassMatch', value: 'ranged' }],
      ['xmen/havok/radiation-focus-array#1', { type: 'heroClassMatch', value: 'ranged' }],
      ['2099/ghost-rider-2099/infernal-chainsaw#1', { type: 'heroClassMatch', value: 'tech' }],
    ];
    for (const [key, condition] of landmines) {
      const heroLine = heroLines.find((candidate) => candidate.key === key);
      assert.ok(heroLine !== undefined, `${key} exists in the card data`);
      assert.deepEqual(buildLineAlone(heroLine.line)[0]!.conditions, [condition, condition], `${key} is unchanged`);
    }
  });
});

describe('Bishop — Concussive Blast end to end (WP-741 / D-24563)', () => {
  const blast = 'dkcy/bishop/concussive-blast#0';
  const traits = {
    [blast]: { heroClass: 'ranged', team: 'x-men' },
    'dkcy/bishop/concussive-blast#1': { heroClass: 'ranged', team: 'x-men' },
    'ranged-a#0': { heroClass: 'ranged', team: 'avengers' },
    'ranged-b#0': { heroClass: 'ranged', team: 'avengers' },
  };

  it('one other Ranged Hero does not grant +3 and names the count', () => {
    const G = makeState(buildRealHeroHooks('dkcy', 'bishop'), traits);
    playAfter(G, ['ranged-a#0'], blast);
    assert.equal(G.turnEconomy.attack, 0);
    const blocked = logTexts(G).find((text) => text.includes('ability did not activate'));
    assert.ok(blocked !== undefined, 'the gated line is logged');
    assert.ok(blocked.includes('— it needs 2 other ranged Heroes played this turn.'), blocked);
    assert.ok(!blocked.includes('not supported yet'), 'a real payoff has no hollow tail');
  });

  it('two other Ranged Heroes grant +3', () => {
    const G = makeState(buildRealHeroHooks('dkcy', 'bishop'), traits);
    playAfter(G, ['ranged-a#0', 'ranged-b#0'], blast);
    assert.equal(G.turnEconomy.attack, 3);
  });

  it('a second copy of Concussive Blast counts as one of the two', () => {
    const G = makeState(buildRealHeroHooks('dkcy', 'bishop'), traits);
    playAfter(G, ['ranged-a#0', 'dkcy/bishop/concussive-blast#1'], blast);
    assert.equal(G.turnEconomy.attack, 3);
  });

  it('the card itself never counts toward the two', () => {
    const G = makeState(buildRealHeroHooks('dkcy', 'bishop'), traits);
    playAfter(G, ['ranged-a#0', blast], blast);
    assert.equal(G.turnEconomy.attack, 0);
  });
});

describe('mixed pairs and doubled mixed lines (WP-741 / D-24563)', () => {
  const brains = 'msis/bruce-banner/brains-and-brawn#0';
  const cosmic = 'ssw1/captain-marvel/cosmic-energies#0';

  it('a mixed [hc:tech][hc:strength] pair fires with ONE dual-class other, or one of each', () => {
    const traits = {
      [brains]: { heroClass: 'strength', heroClass2: 'tech', team: 'avengers' },
      'dual#0': { heroClass: 'tech', heroClass2: 'strength', team: 'avengers' },
      'tech#0': { heroClass: 'tech', team: 'avengers' },
      'strength#0': { heroClass: 'strength', team: 'avengers' },
    };
    const withDual = makeState(buildRealHeroHooks('msis', 'bruce-banner'), traits);
    playAfter(withDual, ['dual#0'], brains);
    assert.equal(withDual.turnEconomy.attack, 2);
    const withPair = makeState(buildRealHeroHooks('msis', 'bruce-banner'), traits);
    playAfter(withPair, ['tech#0', 'strength#0'], brains);
    assert.equal(withPair.turnEconomy.attack, 2);
  });

  it('Cosmic Energies needs two other Strength AND two other Ranged cards', () => {
    const traits = {
      [cosmic]: { heroClass: 'ranged', team: 'avengers' },
      'dual-a#0': { heroClass: 'strength', heroClass2: 'ranged', team: 'avengers' },
      'dual-b#0': { heroClass: 'strength', heroClass2: 'ranged', team: 'avengers' },
      'strength#0': { heroClass: 'strength', team: 'avengers' },
      'ranged-a#0': { heroClass: 'ranged', team: 'avengers' },
      'ranged-b#0': { heroClass: 'ranged', team: 'avengers' },
    };
    const twoDuals = makeState(buildRealHeroHooks('ssw1', 'captain-marvel'), traits);
    playAfter(twoDuals, ['dual-a#0', 'dual-b#0'], cosmic);
    assert.equal(twoDuals.turnEconomy.attack, 6);
    const oneStrength = makeState(buildRealHeroHooks('ssw1', 'captain-marvel'), traits);
    playAfter(oneStrength, ['strength#0', 'ranged-a#0', 'ranged-b#0'], cosmic);
    assert.equal(oneStrength.turnEconomy.attack, 0);
  });
});

describe('Crystal of Kadavus — "Do this ability again" (WP-741 / D-24563)', () => {
  const crystal = 'vnom/venomized-dr-strange/crystal-of-kadavus#0';
  const traits = {
    [crystal]: { heroClass: 'ranged', team: 'venomverse' },
    'venom-a#0': { heroClass: 'strength', team: 'venomverse' },
    'venom-b#0': { heroClass: 'instinct', team: 'venomverse' },
  };

  /**
   * Builds a state whose deck holds six cards to reveal.
   *
   * @returns The state.
   */
  function crystalState(): LegendaryGameState {
    const G = makeState(buildRealHeroHooks('vnom', 'venomized-dr-strange'), traits);
    G.playerZones['0']!.deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as CardExtId[];
    return G;
  }

  it('one other Venomverse Hero blocks the repeat and names the count', () => {
    const G = crystalState();
    playAfter(G, ['venom-a#0'], crystal);
    assert.equal(G.pendingRevealThreeAssign?.[0]?.remainingRepeats, 0);
    assert.ok(
      logTexts(G).some((text) => text.includes('did not activate one of its abilities — it needs 2 other venomverse Heroes played this turn.')),
    );
  });

  it('two other Venomverse Heroes re-arm the reveal', () => {
    const G = crystalState();
    playAfter(G, ['venom-a#0', 'venom-b#0'], crystal);
    assert.equal(G.pendingRevealThreeAssign?.[0]?.remainingRepeats, 1);
  });
});

describe('Out of Time cards and a doubled gate (WP-741 / D-24563)', () => {
  const blast = 'dkcy/bishop/concussive-blast#0';
  const traits = {
    [blast]: { heroClass: 'ranged', team: 'x-men' },
    'ranged-a#0': { heroClass: 'ranged', team: 'avengers' },
    'set-aside#0': { heroClass: 'ranged', team: 'avengers' },
  };

  it('a card set aside Out of Time earlier this turn counts toward the gate', () => {
    const G = makeState(buildRealHeroHooks('dkcy', 'bishop'), traits);
    G.turnEconomy = { ...G.turnEconomy, outOfTimePlayedCardIds: ['set-aside#0' as CardExtId] };
    playAfter(G, ['ranged-a#0'], blast);
    assert.equal(G.turnEconomy.attack, 3);
  });

  it("a card's own Out of Time replay never counts itself", () => {
    const G = makeState(buildRealHeroHooks('dkcy', 'bishop'), traits);
    G.turnEconomy = { ...G.turnEconomy, outOfTimePlayedCardIds: [blast as CardExtId] };
    playAfter(G, ['ranged-a#0'], blast);
    assert.equal(G.turnEconomy.attack, 0);
  });
});
