/**
 * Magnitude-dropped hero effects are hollow, not synergy (D-24649).
 *
 * executeSingleEffect drops an MVP keyword with no valid magnitude (unless it is `ko`
 * or a NO_MAGNITUDE_KEYWORDS member) before its handler runs. Before D-24649 the
 * hollow detector and the WP-708 Synergy Rate both called such an effect reachable,
 * so a line like Storm's "[hc:ranged]: You may use this bonus [icon:attack] against
 * the Mastermind instead" — then parsed as a bare `{ type: 'attack' }` — logged an
 * "assembled" synergy on every play and never surfaced as hollow. Since WP-790 /
 * D-24652 that Storm line is fused into the preceding restricted grant (it widens the
 * grant to the Mastermind) and its hook keeps only its gate, with no `attack` effect.
 *
 * These tests pin:
 * - hookHasDispatchableEffect (the WP-776 predicate) per case, and a runtime parity
 *   sweep against executeSingleEffect over every MVP keyword;
 * - a magnitude-less-only hook records one `parse-unrecognized` hollow, labelled
 *   `<type>-no-magnitude`; a mixed hook and a recruit-time keyword do not;
 * - the Synergy Rate skips a magnitude-less-only gated hook and a gated keyword with
 *   no play-time handler (Goblin Glider's gated Dodge), and still counts a real one;
 * - the real Tidal Wave line parses into a gated hook with no `attack` effect (WP-790) and
 *   the real Goblin Glider line into the gated keyword shape; neither dispatches at play.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  executeHeroEffects,
  executeSingleEffect,
  hookHasDispatchableEffect,
  hookHasExecutableEffect,
  HERO_EFFECT_HANDLERS,
  MVP_KEYWORDS,
} from './heroEffects.execute.js';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook, HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import type { HeroKeyword } from '../rules/heroKeywords.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeCardRegistryReader, makePlayerZones } from '../test/fixtureBuilders.js';

/** Empty registry so the fixture does not depend on real card data. */
const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(), listCards: () => [] };

/**
 * Builds a full initial game state whose seat 0 has only the given cards in play and
 * whose hook table is exactly the given hooks.
 *
 * @param inPlay - Cards already in seat 0's play area.
 * @param heroAbilityHooks - The hooks under test.
 * @returns The game state.
 */
function makeState(inPlay: CardExtId[], heroAbilityHooks: HeroAbilityHook[]): LegendaryGameState {
  const config: MatchConfiguration = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 0,
  };
  const gameState = buildInitialGameState(config, EMPTY_REGISTRY, makeMockCtx({ numPlayers: 1 }));
  gameState.playerZones['0'] = { ...makePlayerZones(), inPlay };
  gameState.heroAbilityHooks = heroAbilityHooks;
  return gameState;
}

/**
 * Builds a hook for `hero-x` carrying the given effects and conditions.
 *
 * @param effects - The legacy effect descriptors.
 * @param isGated - Whether to add a `playedThisTurn: 1` condition (met once hero-x is in play).
 * @returns The hook.
 */
function makeHook(effects: HeroEffectDescriptor[], isGated: boolean): HeroAbilityHook {
  const hook: HeroAbilityHook = { cardId: 'hero-x', timing: 'onPlay', keywords: [], effects };
  if (isGated) {
    hook.conditions = [{ type: 'playedThisTurn', value: '1' }];
  }
  return hook;
}

describe('hookHasDispatchableEffect (D-24649 / WP-776)', () => {
  it('matches executeSingleEffect gate case by case', () => {
    const primitiveOnly = makeHook([], false);
    primitiveOnly.primitiveEffects = [{ type: 'sequence', steps: [] }];
    assert.equal(hookHasDispatchableEffect(primitiveOnly), true, 'a composition primitive always dispatches');
    assert.equal(hookHasDispatchableEffect(makeHook([{ type: 'attack', magnitude: 2 }], true)), true);
    assert.equal(hookHasDispatchableEffect(makeHook([{ type: 'attack' }], true)), false, 'a bare attack is dropped');
    assert.equal(hookHasDispatchableEffect(makeHook([{ type: 'ko' }], true)), true, 'ko bypasses the magnitude gate');
    assert.equal(hookHasDispatchableEffect(makeHook([{ type: 'rescue' }], true)), true, 'rescue defaults to 1');
    assert.equal(hookHasDispatchableEffect(makeHook([{ type: 'wall-crawl' }], true)), false,
      'wall-crawl runs at recruit time and has no play-time handler');
    assert.equal(hookHasDispatchableEffect(makeHook([{ type: 'attack' }, { type: 'recruit', magnitude: 1 }], true)), true,
      'one dispatchable effect is enough');
  });

  it('agrees with executeSingleEffect for every MVP keyword and magnitude (runtime parity sweep)', () => {
    // why: the gate reads nothing from G before the handler, so swapping every handler for
    // a no-op makes executeSingleEffect's boolean a pure readout of its gate.
    const handlers = HERO_EFFECT_HANDLERS as Record<string, unknown>;
    const originals = new Map<string, unknown>();
    for (const keyword of Object.keys(handlers)) {
      originals.set(keyword, handlers[keyword]);
      handlers[keyword] = () => {};
    }
    try {
      const magnitudes: Array<number | undefined> = [undefined, 0, 2, 1.5, -1];
      for (const keyword of MVP_KEYWORDS) {
        for (const magnitude of magnitudes) {
          const effect: HeroEffectDescriptor = { type: keyword as HeroKeyword };
          if (magnitude !== undefined) {
            effect.magnitude = magnitude;
          }
          const fired = executeSingleEffect({} as LegendaryGameState, {}, '0', 'x', effect);
          assert.equal(
            hookHasDispatchableEffect(makeHook([effect], false)),
            fired,
            `${keyword} with magnitude ${String(magnitude)}`,
          );
        }
      }
    } finally {
      for (const [keyword, handler] of originals) {
        handlers[keyword] = handler;
      }
    }
  });

  it('a magnitude-less-only hook is no longer executable either', () => {
    assert.equal(hookHasExecutableEffect(makeHook([{ type: 'attack' }, { type: 'recruit' }], true)), false);
    assert.equal(hookHasExecutableEffect(makeHook([{ type: 'wall-crawl' }], true)), true,
      'a recruit-time keyword stays executable (D-24033); only dispatch excludes it');
  });
});

describe('executeHeroEffects — magnitude-dropped effects are hollow (D-24649)', () => {
  const mockCtx = makeMockCtx();

  it('a magnitude-less-only hook records one parse-unrecognized hollow', () => {
    const gameState = makeState(['hero-x'], [makeHook([{ type: 'attack' }], false)]);
    executeHeroEffects(gameState, mockCtx, '0', 'hero-x');
    const records = gameState.diagnostics?.hollowEffects ?? [];
    assert.equal(records.length, 1, 'exactly one hollow record');
    assert.equal(records[0]!.reason, 'parse-unrecognized');
    assert.equal(records[0]!.mechanic, 'attack-no-magnitude');
    assert.equal(gameState.turnEconomy.attack, 0, 'and the hook granted nothing');
  });

  it('a mixed hook with one dispatchable effect records no hollow', () => {
    const gameState = makeState(['hero-x'], [makeHook([{ type: 'attack' }, { type: 'recruit', magnitude: 2 }], false)]);
    executeHeroEffects(gameState, mockCtx, '0', 'hero-x');
    assert.equal((gameState.diagnostics?.hollowEffects ?? []).length, 0);
    assert.equal(gameState.turnEconomy.recruit, 2);
  });

  it('a recruit-time keyword with no magnitude played at play time records no hollow', () => {
    // why: wall-crawl has no play-time handler; it never passes through the magnitude
    // pre-gate at its real executor, so it stays `applied` (D-24033).
    const gameState = makeState(['hero-x'], [makeHook([{ type: 'wall-crawl' }], false)]);
    executeHeroEffects(gameState, mockCtx, '0', 'hero-x');
    assert.equal((gameState.diagnostics?.hollowEffects ?? []).length, 0);
  });
});

describe('executeHeroEffects — Synergy Rate counts only dispatchable clauses (D-24649)', () => {
  const mockCtx = makeMockCtx();

  it('a met gate over magnitude-less icons is not counted', () => {
    const gameState = makeState(['hero-x'], [makeHook([{ type: 'attack' }, { type: 'recruit' }], true)]);
    executeHeroEffects(gameState, mockCtx, '0', 'hero-x');
    assert.equal(gameState.diagnostics?.conditionalClauses, undefined,
      'nothing happened, so no clause was assembled');
  });

  it('a met gate over a keyword with no play-time handler is not counted', () => {
    const gameState = makeState(['hero-x'], [makeHook([{ type: 'dodge' }], true)]);
    executeHeroEffects(gameState, mockCtx, '0', 'hero-x');
    assert.equal(gameState.diagnostics?.conditionalClauses, undefined);
  });

  it('a met gate over a real grant is still counted as assembled', () => {
    const gameState = makeState(['hero-x'], [makeHook([{ type: 'attack', magnitude: 2 }], true)]);
    executeHeroEffects(gameState, mockCtx, '0', 'hero-x');
    assert.deepEqual(gameState.diagnostics?.conditionalClauses?.['0'], {
      played: 1,
      assembled: 1,
      potentialValue: 2,
      realizedValue: 2,
    });
  });
});

describe('real card lines parse into the excluded shapes (D-24649)', () => {
  /**
   * Parses one hero card's printed abilities through the real setup parser.
   *
   * @param setAbbr - The set abbreviation.
   * @param heroSlug - The hero slug.
   * @param cardSlug - The card slug.
   * @param hc - The card's hero class.
   * @param abilities - The ability lines, verbatim from data/cards.
   * @returns The parsed hooks.
   */
  function parse(setAbbr: string, heroSlug: string, cardSlug: string, hc: string, abilities: string[]): HeroAbilityHook[] {
    const cards = [{ slug: cardSlug, hc, abilities }];
    const setData = {
      abbr: setAbbr,
      heroes: [{ slug: heroSlug, cards, physicalCards: [{ id: 'p0', count: 1, sides: [cardSlug] }] }],
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
    return buildHeroAbilityHooks(registry, config);
  }

  it('Storm Tidal Wave: the gated "use this bonus [icon:attack] against the Mastermind" line dispatches nothing', () => {
    // why: verbatim from data/cards/co2e.json (co2e/storm/tidal-wave).
    const hooks = parse('co2e', 'storm', 'tidal-wave', 'ranged', [
      'You get +3[icon:attack] usable only against Villains in the Sewers or Bridge.',
      '[hc:ranged]: You may use this bonus [icon:attack] against the Mastermind instead.',
    ]);
    const gated = hooks.filter((hook) => (hook.conditions?.length ?? 0) > 0);
    assert.equal(gated.length, 1, 'one gated hook');
    // why: WP-790 / D-24652 — the follow-up line is fused into the preceding restricted grant
    // as its Mastermind widen, so the gated hook carries no `attack` effect at all (it used to
    // carry a bare magnitude-less one). Intentional behavior change; see the EC-827 commit.
    assert.equal(
      (gated[0]!.effects ?? []).some((effect) => effect.type === 'attack'),
      false,
      'no attack effect on the gated hook',
    );
    assert.equal(hookHasExecutableEffect(gated[0]!), false);
    assert.equal(hookHasDispatchableEffect(gated[0]!), false);
  });

  it('Goblin Glider: the gated Dodge-grant line is executable but dispatches nothing at play', () => {
    // why: verbatim from data/cards/vill.json (vill/green-goblin/goblin-glider).
    const hooks = parse('vill', 'green-goblin', 'goblin-glider', 'tech', [
      '[keyword:Dodge]',
      'When you play or [keyword:Dodge] with this card, another [team:hydra] Ally in your hand gains [keyword:Dodge] this turn.',
    ]);
    const gated = hooks.filter((hook) => (hook.conditions?.length ?? 0) > 0);
    assert.equal(gated.length, 1, 'one gated hook');
    assert.equal(hookHasExecutableEffect(gated[0]!), true);
    assert.equal(hookHasDispatchableEffect(gated[0]!), false);
  });
});
