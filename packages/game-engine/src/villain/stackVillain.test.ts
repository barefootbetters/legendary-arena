/**
 * Stack cards enter the City as Villains (WP-869 / D-24814).
 *
 * chmp Groot from Planet X prints "Fight: Two Bystanders from the Bystander Stack enter the city as
 * 3 Attack 'Splintered Half-Groot' Villains. When you fight one, rescue it as a Bystander." cvwr
 * Agent Gabe Jones (Fight) and Agent Eric Marshall (Ambush) print "A S.H.I.E.L.D. Officer enters
 * the city as a 3 Attack Villain. When you fight it, gain it as a Hero." Groot's line logged an
 * `unmarked-ability` hollow (operator match OZLV05npDB8). The
 * `stack-cards-enter-city-as-villains` primitive is an executor no-op; the bridge at the end of
 * defeatCityVillainCore (Fight) and in performVillainReveal (Ambush) moves the stack cards.
 *
 * Builds the real hooks from the committed card data and drives the Fight through
 * defeatCityVillainCore and the Ambush through performVillainReveal. No boardgame.io imports.
 * node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { defeatCityVillainCore } from '../moves/fightVillain.js';
import { enterStackCardsAsVillains, performVillainReveal } from '../villainDeck/villainDeck.reveal.js';
import { villainCardStackVillainEntry } from './villainEffects.execute.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { resolveFightCost } from '../economy/economy.resolve.js';
import { buildUIState } from '../ui/uiState.build.js';
import { computeFinalScores, isBystanderCard } from '../scoring/scoring.logic.js';
import {
  STACK_VILLAIN_NAME_PATTERN,
  applyStackVillainDisplay,
  stackVillainDisplayName,
  stackVillainExtId,
} from '../rules/stackVillain.logic.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader, makePlayerZones } from '../test/fixtureBuilders.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';

// why: resolve the repo-root directories from this test's own location (the
// reenterSewers.test.ts precedent), so the tests read the card data and marker script that ship.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CARDS_DIRECTORY = join(REPO_ROOT, 'data', 'cards');
const MARKER_SCRIPT = join(REPO_ROOT, 'scripts', 'convert-cards', 'apply-effect-markers.mjs');
const PRIMITIVE = 'stack-cards-enter-city-as-villains';

type SetData = { villains?: Array<{ slug: string; cards: Array<{ slug: string; abilities?: string[] }> }> };

const CHMP_DATA = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'chmp.json'), 'utf8')) as SetData;
const CVWR_DATA = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'cvwr.json'), 'utf8')) as SetData;

/**
 * Reads every committed set file under data/cards.
 *
 * @returns Each set's JSON, in file-name order.
 */
function readAllSets(): SetData[] {
  const sets: SetData[] = [];
  for (const fileName of readdirSync(CARDS_DIRECTORY).sort()) {
    if (fileName.endsWith('.json')) {
      sets.push(JSON.parse(readFileSync(join(CARDS_DIRECTORY, fileName), 'utf8')) as SetData);
    }
  }
  return sets;
}

const ALL_SETS = readAllSets();

const EMPTY_REGISTRY: CardRegistryReader = { ...makeCardRegistryReader(), listCards: () => [] };
const BYSTANDER_TOKEN = 'pile-bystander' as CardExtId;
const OFFICER_TOKEN = 'pile-shield-officer' as CardExtId;
const FILLER = ['test-villain-a-00', 'test-villain-b-00', 'test-villain-c-00', 'test-villain-d-00'] as CardExtId[];
const ENTERING_VILLAIN = 'test-villain-entering-00' as CardExtId;
const CAPTURED_BYSTANDER = 'test-bystander-captured-00' as CardExtId;
const FIGHT_CTX = { currentPlayer: '0', turn: 3 };
const SHUFFLE_CONTEXT = { random: makeMockCtx({ numPlayers: 1 }).random };

/**
 * Builds the real villain hooks for the given set's groups.
 *
 * @param abbr - The set abbreviation.
 * @param setData - The committed set JSON.
 * @param groupIds - The `<set>/<group>` villain group ids.
 * @returns Every hook the groups produce.
 */
function buildHooks(abbr: string, setData: SetData, groupIds: string[]): VillainAbilityHook[] {
  const registry = { getSet: (requested: string) => (requested === abbr ? setData : undefined) };
  const config = { villainGroupIds: groupIds, henchmanGroupIds: [] } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(registry, config);
}

const HOOKS = [
  ...buildHooks('chmp', CHMP_DATA, ['chmp/monsters-unleashed']),
  ...buildHooks('cvwr', CVWR_DATA, ['cvwr/shield-elite']),
];
const GROOT = 'chmp-villain-monsters-unleashed-groot-from-planet-x-00' as CardExtId;
const GABE_JONES = 'cvwr-villain-shield-elite-agent-gabe-jones-00' as CardExtId;
const ERIC_MARSHALL = 'cvwr-villain-shield-elite-agent-eric-marshall-00' as CardExtId;
const HALF_GROOT_00 = stackVillainExtId(GROOT, 0);
const HALF_GROOT_01 = stackVillainExtId(GROOT, 1);
const GABE_OFFICER = stackVillainExtId(GABE_JONES, 0);
const ERIC_OFFICER = stackVillainExtId(ERIC_MARSHALL, 0);

/**
 * A one-seat state with the given City, real hooks, and display entries for the marked cards,
 * the two stack tokens and every stack-villain id (seeded through applyStackVillainDisplay).
 *
 * @param city - The five City spaces.
 * @param bystanderStackSize - How many Bystander tokens the Bystander Stack holds.
 * @param officerStackSize - How many Officer tokens the Officer Stack holds.
 * @returns The game state.
 */
function makeState(city: (CardExtId | null)[], bystanderStackSize: number, officerStackSize: number): LegendaryGameState {
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
  const G = buildInitialGameState(config, EMPTY_REGISTRY, makeMockCtx({ numPlayers: 1 }));
  G.playerZones = { '0': { ...makePlayerZones(), deck: [], hand: [], discard: [], inPlay: [], victory: [] } };
  G.city = [...city];
  G.hq = [null, null, null, null, null];
  G.heroDeck = [];
  G.escapedPile = [];
  G.notableEvents = [];
  G.villainAttachedHeroes = {};
  G.attachedBystanders = {};
  G.villainAbilityHooks = HOOKS;
  G.villainDeck = { deck: [], discard: [] };
  G.villainDeckCardTypes = { [GROOT]: 'villain', [GABE_JONES]: 'villain', [ERIC_MARSHALL]: 'villain' };
  G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] = 0;
  G.piles.bystanders = Array.from({ length: bystanderStackSize }, () => BYSTANDER_TOKEN);
  G.piles.officers = Array.from({ length: officerStackSize }, () => OFFICER_TOKEN);
  const display: Record<CardExtId, LegendaryGameState['cardDisplayData'][CardExtId]> = {
    ...G.cardDisplayData,
    [GROOT]: { extId: GROOT, name: 'Groot from Planet X', imageUrl: '', cost: 0 },
    [GABE_JONES]: { extId: GABE_JONES, name: 'Agent Gabe Jones', imageUrl: '', cost: 0 },
    [ERIC_MARSHALL]: { extId: ERIC_MARSHALL, name: 'Agent Eric Marshall', imageUrl: '', cost: 0 },
    [BYSTANDER_TOKEN]: { extId: BYSTANDER_TOKEN, name: 'Bystander', imageUrl: 'bystander.webp', cost: null },
    [OFFICER_TOKEN]: { extId: OFFICER_TOKEN, name: 'S.H.I.E.L.D. Officer', imageUrl: 'officer.webp', cost: 3 },
  };
  applyStackVillainDisplay(display, HOOKS);
  G.cardDisplayData = display;
  return G;
}

/**
 * Builds the reveal context for the one seat.
 *
 * @returns The reveal context.
 */
function makeRevealContext(): RevealContext {
  return { random: SHUFFLE_CONTEXT.random, ctx: { currentPlayer: '0', turn: 4 } };
}

/**
 * Returns every log line's text.
 *
 * @param G - The game state.
 * @returns The message texts in order.
 */
function logTexts(G: LegendaryGameState): string[] {
  const texts: string[] = [];
  for (const message of G.messages) {
    texts.push(message.text);
  }
  return texts;
}

/**
 * Returns the last notable event's narrative of the given type.
 *
 * @param G - The game state.
 * @param type - The notable event type.
 * @returns The narrative, or undefined when no such event was pushed.
 */
function lastNarrative(G: LegendaryGameState, type: 'fightResolved' | 'ambushResolved'): string | undefined {
  for (let index = G.notableEvents.length - 1; index >= 0; index--) {
    const event = G.notableEvents[index]!;
    if (event.type === type) {
      return (event as { narrative: string }).narrative;
    }
  }
  return undefined;
}

/**
 * Fires Groot from Planet X's Fight from City space 0 in a fresh state.
 *
 * @param bystanderStackSize - How many Bystander tokens the Bystander Stack holds.
 * @returns The game state after the defeat.
 */
function fightGroot(bystanderStackSize: number): LegendaryGameState {
  const G = makeState([GROOT, null, null, null, null], bystanderStackSize, 3);
  defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
  return G;
}

describe('WP-869 RS-1 parse and marker data (D-24814)', () => {
  it('each marked line parses from the committed JSON', () => {
    const groot = HOOKS.filter((hook) => hook.cardId === GROOT && hook.timing === 'onFight');
    assert.equal(groot.length, 1);
    assert.deepStrictEqual(groot[0]!.effects, [
      { primitive: PRIMITIVE, stackVillainKind: 'bystander', magnitude: 2, stackVillainName: 'splintered_half-groot' },
    ]);
    const gabe = HOOKS.filter((hook) => hook.cardId.startsWith('cvwr-villain-shield-elite-agent-gabe-jones-') && hook.timing === 'onFight');
    const eric = HOOKS.filter((hook) => hook.cardId.startsWith('cvwr-villain-shield-elite-agent-eric-marshall-') && hook.timing === 'onAmbush');
    assert.ok(gabe.length > 0 && eric.length > 0);
    for (const hook of [...gabe, ...eric]) {
      assert.deepStrictEqual(hook.effects, [{ primitive: PRIMITIVE, stackVillainKind: 'officer', magnitude: 1 }]);
      assert.equal(Object.hasOwn(hook.effects[0]!, 'stackVillainName'), false, 'no name key on the officer descriptor');
      assert.deepStrictEqual(hook.unresolvedMarkers ?? [], []);
    }
  });

  it('malformed tokens land in unresolvedMarkers', () => {
    const malformed = [`${PRIMITIVE}:wound:1`, `${PRIMITIVE}:bystander:0`, `${PRIMITIVE}:bystander:2:-groot`, `${PRIMITIVE}:bystander`];
    for (const token of malformed) {
      const setData = {
        villains: [{ slug: 'test-group', cards: [{ slug: 'test-card', abilities: [`Fight: Something happens. [effect:${token}]`] }] }],
      };
      const hooks = buildHooks('test', setData, ['test/test-group']);
      const fightHook = hooks.find((hook) => hook.timing === 'onFight');
      assert.ok(fightHook !== undefined, token);
      assert.deepStrictEqual(fightHook.effects, [], token);
      assert.deepStrictEqual(fightHook.unresolvedMarkers, [token], token);
    }
  });

  it('the display name comes from the name token', () => {
    assert.equal(stackVillainDisplayName('splintered_half-groot'), 'Splintered Half-Groot');
    assert.equal(STACK_VILLAIN_NAME_PATTERN.test('splintered_half-groot'), true);
    assert.equal(STACK_VILLAIN_NAME_PATTERN.test('-groot'), false);
  });

  it('every marked line in every set prints 3 Attack (RS-4: no Attack parameter)', () => {
    let markedLineCount = 0;
    for (const setData of ALL_SETS) {
      for (const group of setData.villains ?? []) {
        for (const card of group.cards) {
          for (const line of card.abilities ?? []) {
            if (line.includes(`[effect:${PRIMITIVE}:`)) {
              markedLineCount += 1;
              assert.ok(line.includes('3[icon:attack]'), line);
            }
          }
        }
      }
    }
    assert.equal(markedLineCount, 3);
  });

  it('no committed card in any set carries two stack-villain markers', () => {
    // why: a villain instance's hooks come from its card's lines, so one marker per card means at
    // most one stack-villain descriptor per instance, the RS-2 id-ownership rule.
    for (const setData of ALL_SETS) {
      for (const group of setData.villains ?? []) {
        for (const card of group.cards) {
          let markerCount = 0;
          for (const line of card.abilities ?? []) {
            markerCount += line.split(`[effect:${PRIMITIVE}:`).length - 1;
          }
          assert.ok(markerCount <= 1, `${group.slug}/${card.slug}`);
        }
      }
    }
  });

  it('no parsed villain instance carries two stack-villain descriptors', () => {
    const counts = new Map<CardExtId, number>();
    for (const hook of HOOKS) {
      for (const descriptor of hook.effects) {
        if (descriptor.primitive === PRIMITIVE) {
          counts.set(hook.cardId, (counts.get(hook.cardId) ?? 0) + 1);
        }
      }
    }
    assert.ok(counts.size > 0);
    for (const [cardId, count] of counts) {
      assert.equal(count, 1, cardId);
    }
  });

  it('the marker script carries the engine name pattern (the two grammar copies cannot drift)', () => {
    const scriptText = readFileSync(MARKER_SCRIPT, 'utf8');
    assert.ok(scriptText.includes(STACK_VILLAIN_NAME_PATTERN.source));
    assert.ok(scriptText.includes(`'${PRIMITIVE}'`));
  });
});

describe('WP-869 Groot from Planet X Fight (D-24814)', () => {
  it('two Bystanders leave the stack and enter the City as 3-Attack Splintered Half-Groots', () => {
    const G = fightGroot(5);
    assert.equal(G.piles.bystanders.length, 3, 'two tokens left the Bystander Stack');
    assert.deepStrictEqual(G.city, [HALF_GROOT_01, HALF_GROOT_00, null, null, null]);
    for (const halfGroot of [HALF_GROOT_00, HALF_GROOT_01]) {
      assert.equal(G.convertedVillainOrigins?.[halfGroot], 'bystander-stack-villain');
      assert.equal(G.villainDeckCardTypes[halfGroot], 'villain');
      assert.equal(resolveFightCost(G, halfGroot), 3);
      assert.equal(G.cardDisplayData[halfGroot]?.name, 'Splintered Half-Groot');
    }
    assert.equal(G.convertedVillainOrigins?.[BYSTANDER_TOKEN], undefined, 'the token id never converts');
    const uiState = buildUIState(G, { phase: 'play', turn: 3, currentPlayer: '0' });
    for (const space of [0, 1]) {
      const cityCard = uiState.city.spaces[space]!;
      assert.equal(cityCard.type, 'villain');
      assert.equal(cityCard.fightCost, 3);
      assert.equal(cityCard.display.name, 'Splintered Half-Groot');
    }
  });

  it('the narrative names the entry by display name only; the log uses the house Name (ext-id) form', () => {
    const G = fightGroot(5);
    const narrative = lastNarrative(G, 'fightResolved')!;
    assert.ok(narrative.includes('2 Splintered Half-Groot Villains enter the city'), narrative);
    assert.equal(narrative.includes('stack-villain-'), false);
    assert.equal(narrative.includes(PRIMITIVE), false);
    const entryLine = `Fight effect: Splintered Half-Groot (${HALF_GROOT_00}) enters the city from the Bystander Stack (Groot from Planet X (${GROOT})).`;
    const entryMessage = G.messages.find((message) => message.text === entryLine);
    assert.ok(entryMessage !== undefined, logTexts(G).join(' | '));
    assert.equal(entryMessage.outcome, 'threat');
  });

  it('the onFight trace for the primitive reads no-op, not fired', () => {
    const G = fightGroot(5);
    const traces = (G.diagnostics?.traces ?? []).filter((trace) => trace.effect === PRIMITIVE);
    assert.equal(traces.length, 1);
    assert.equal(traces[0]!.status, 'no-op');
    const hollows = (G.diagnostics?.hollowEffects ?? []).filter((hollow) => hollow.cardId === GROOT);
    assert.deepStrictEqual(hollows, []);
  });

  it('a one-card stack: one enters, then the empty-stack line', () => {
    const G = fightGroot(1);
    assert.equal(G.piles.bystanders.length, 0);
    assert.deepStrictEqual(G.city, [HALF_GROOT_00, null, null, null, null]);
    const texts = logTexts(G);
    assert.equal(texts[texts.length - 1], `Fight effect: the Bystander Stack is empty, so 1 of 2 entered the city (Groot from Planet X (${GROOT})).`);
    assert.equal(G.messages[G.messages.length - 1]?.outcome, 'blocked');
    assert.ok(lastNarrative(G, 'fightResolved')!.includes('; Splintered Half-Groot enters the city.'));
  });

  it('an empty stack: nothing moves and the narrative has no clause', () => {
    const G = fightGroot(0);
    assert.deepStrictEqual(G.city, [null, null, null, null, null]);
    assert.equal(G.convertedVillainOrigins?.[HALF_GROOT_00], undefined);
    assert.equal(lastNarrative(G, 'fightResolved'), 'Fought "Groot from Planet X".');
  });

  it('fighting a Half-Groot rescues it as a Bystander', () => {
    const G = fightGroot(5);
    const victoryBefore = computeFinalScores(G).players[0]!.bystanderVP;
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    const victory = G.playerZones['0']!.victory;
    assert.deepStrictEqual(victory, [GROOT, BYSTANDER_TOKEN]);
    assert.equal(G.convertedVillainOrigins?.[HALF_GROOT_01], undefined, 'the overlay entry is gone');
    assert.equal(G.city.includes(HALF_GROOT_01), false);
    assert.equal(G.playerZones['0']!.discard.includes(HALF_GROOT_01), false);
    assert.equal(G.escapedPile.includes(HALF_GROOT_01), false);
    const fought = G.notableEvents[G.notableEvents.length - 1] as { type: string; bystandersRescued: number };
    assert.equal(fought.type, 'fightResolved');
    assert.equal(fought.bystandersRescued, 1);
    assert.ok(logTexts(G).includes(`Player 0 rescued 1 bystander(s) from Splintered Half-Groot (${HALF_GROOT_01}).`));
    assert.equal(computeFinalScores(G).players[0]!.bystanderVP, victoryBefore + 1, 'it scores as a Bystander');
  });

  it('a Half-Groot holding a captured Bystander rescues both', () => {
    const G = fightGroot(5);
    G.attachedBystanders = { [HALF_GROOT_01]: [CAPTURED_BYSTANDER] };
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    const fought = G.notableEvents[G.notableEvents.length - 1] as { bystandersRescued: number };
    assert.equal(fought.bystandersRescued, 2);
    assert.ok(G.playerZones['0']!.victory.includes(CAPTURED_BYSTANDER));
  });

  it('an escaped Half-Groot is an escaped Villain, not a Bystander', () => {
    const G = fightGroot(5);
    G.city = [HALF_GROOT_01, FILLER[0]!, FILLER[1]!, FILLER[2]!, HALF_GROOT_00];
    G.villainDeck = { deck: [ENTERING_VILLAIN], discard: [] };
    G.villainDeckCardTypes[ENTERING_VILLAIN] = 'villain';
    performVillainReveal(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);
    assert.ok(G.escapedPile.includes(HALF_GROOT_00));
    assert.equal(G.convertedVillainOrigins?.[HALF_GROOT_00], 'bystander-stack-villain', 'it keeps its overlay entry');
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], 1);
    assert.equal(isBystanderCard(G, HALF_GROOT_00), false);
  });

  it('re-firing while both ids are out logs the no-free-id line; a defeat frees its id', () => {
    const G = fightGroot(5);
    const entry = villainCardStackVillainEntry(G, GROOT, 'onFight')!;
    enterStackCardsAsVillains(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP, GROOT, entry, 'onFight');
    assert.equal(G.piles.bystanders.length, 3, 'the stack is unchanged');
    assert.equal(
      G.messages[G.messages.length - 1]?.text,
      `Fight effect: no unused card remains, so 0 of 2 entered the city (Groot from Planet X (${GROOT})).`,
    );
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    assert.equal(G.convertedVillainOrigins?.[HALF_GROOT_01], undefined);
    enterStackCardsAsVillains(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP, GROOT, entry, 'onFight');
    assert.equal(G.city[0], HALF_GROOT_01, 'the freed id enters again');
    assert.equal(G.piles.bystanders.length, 2);
  });
});

describe('WP-869 S.H.I.E.L.D. Elite Officers (D-24814)', () => {
  it('logs the Officer gain line right after the fought line (operator match 8eURMq6tTSS 5.2.16-5.2.17)', () => {
    const G = makeState([GABE_OFFICER, null, null, null, null], 2, 3);
    G.convertedVillainOrigins = { [GABE_OFFICER]: 'officer-stack-villain' };
    G.villainDeckCardTypes[GABE_OFFICER] = 'villain';
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    const texts = logTexts(G);
    const foughtIndex = texts.indexOf(`Player 0 fought S.H.I.E.L.D. Officer (${GABE_OFFICER}) at city space 0.`);
    const gainIndex = texts.indexOf(`Player 0 defeated S.H.I.E.L.D. Officer (${GABE_OFFICER}) and gained it as a Hero into their discard pile.`);
    assert.ok(foughtIndex >= 0 && gainIndex >= 0, texts.join(' | '));
    assert.equal(gainIndex, foughtIndex + 1, 'the gain line follows the fight that caused it');
  });

  it("Agent Gabe Jones's Fight: one Officer enters at 3 Attack; fighting it gains the Officer Hero", () => {
    const G = makeState([GABE_JONES, null, null, null, null], 2, 3);
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    assert.equal(G.piles.officers.length, 2);
    assert.deepStrictEqual(G.city, [GABE_OFFICER, null, null, null, null]);
    assert.equal(G.convertedVillainOrigins?.[GABE_OFFICER], 'officer-stack-villain');
    assert.equal(resolveFightCost(G, GABE_OFFICER), 3);
    assert.equal(G.cardDisplayData[GABE_OFFICER]?.name, 'S.H.I.E.L.D. Officer');
    assert.ok(lastNarrative(G, 'fightResolved')!.endsWith('; S.H.I.E.L.D. Officer enters the city.'));
    defeatCityVillainCore(G, FIGHT_CTX, 0, SHUFFLE_CONTEXT);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [OFFICER_TOKEN]);
    assert.ok(
      logTexts(G).includes(`Player 0 defeated S.H.I.E.L.D. Officer (${GABE_OFFICER}) and gained it as a Hero into their discard pile.`),
    );
    assert.deepStrictEqual(G.playerZones['0']!.victory, [GABE_JONES], 'the Officer never enters the Victory Pile');
    assert.equal(G.convertedVillainOrigins?.[GABE_OFFICER], undefined);
    const narrative = lastNarrative(G, 'fightResolved')!;
    assert.ok(narrative.includes("gained the Hero into the active player's discard pile"), narrative);
  });

  it("Agent Eric Marshall's Ambush: he enters, then the Officer, and a full City pushes its last card out", () => {
    const G = makeState([FILLER[0]!, FILLER[1]!, FILLER[2]!, FILLER[3]!, null], 2, 3);
    G.villainDeck = { deck: [ERIC_MARSHALL], discard: [] };
    G.cardKeywords = { ...(G.cardKeywords ?? {}), [ERIC_MARSHALL]: ['ambush'] };
    performVillainReveal(G, makeRevealContext(), DEFAULT_IMPLEMENTATION_MAP);
    assert.deepStrictEqual(G.city, [ERIC_OFFICER, ERIC_MARSHALL, FILLER[0], FILLER[1], FILLER[2]]);
    assert.ok(G.escapedPile.includes(FILLER[3]!), 'the Bridge card escapes');
    assert.equal(G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], 1);
    assert.equal(G.piles.officers.length, 2);
    const narrative = lastNarrative(G, 'ambushResolved')!;
    assert.equal(narrative, '"Agent Eric Marshall" ambushed: S.H.I.E.L.D. Officer enters the city.');
    assert.ok(
      logTexts(G).includes(
        `Ambush effect: S.H.I.E.L.D. Officer (${ERIC_OFFICER}) enters the city from the S.H.I.E.L.D. Officer Stack (Agent Eric Marshall (${ERIC_MARSHALL})).`,
      ),
    );
  });
});

/**
 * A setup registry over one real set: getSet serves the JSON, and listCards serves one flat
 * villain card per printed villain (the brainwashTheMilitary.test.ts precedent).
 *
 * @param abbr - The set abbreviation.
 * @param setData - The committed set JSON.
 * @returns The registry reader.
 */
function buildSetRegistry(abbr: string, setData: SetData) {
  const flatVillains: Array<{ key: string } & Record<string, unknown>> = [];
  for (const group of setData.villains ?? []) {
    for (const card of group.cards) {
      flatVillains.push({
        key: `${abbr}-villain-${group.slug}-${card.slug}`,
        cardType: 'villain',
        slug: card.slug,
        setAbbr: abbr,
        abilities: card.abilities ?? [],
      });
    }
  }
  return {
    listCards: () => flatVillains,
    listSets: () => [{ abbr }],
    getSet: (requested: string) => (requested === abbr ? setData : undefined),
  };
}

/**
 * Lists the display-data ids that belong to converted stack cards.
 *
 * @param G - The game state.
 * @returns The `stack-villain-` ids, sorted.
 */
function stackVillainDisplayIds(G: LegendaryGameState): string[] {
  return Object.keys(G.cardDisplayData).filter((cardId) => cardId.startsWith('stack-villain-')).sort();
}

describe('WP-869 RS-2 setup display (D-24814)', () => {
  it('a Monsters Unleashed match seeds exactly the two Half-Groot display entries', () => {
    const config: MatchSetupConfig = {
      schemeId: 'chmp/steal-all-oxygen-on-earth',
      mastermindId: 'chmp/fin-fang-foom',
      villainGroupIds: ['chmp/monsters-unleashed'],
      henchmanGroupIds: [],
      heroDeckIds: ['chmp/gwenpool', 'chmp/ms-marvel', 'chmp/nova'],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    };
    const G = buildInitialGameState(config, buildSetRegistry('chmp', CHMP_DATA), makeMockCtx({ numPlayers: 2 }));
    assert.deepStrictEqual(stackVillainDisplayIds(G), [HALF_GROOT_00, HALF_GROOT_01]);
    assert.equal(G.cardDisplayData[HALF_GROOT_00]?.name, 'Splintered Half-Groot');
    assert.equal(G.cardDisplayData[HALF_GROOT_00]?.extId, HALF_GROOT_00);
    assert.equal(G.convertedVillainOrigins?.[HALF_GROOT_00], undefined, 'nothing converts until the Fight');
  });

  it("a S.H.I.E.L.D. Elite match seeds the Officers' entries and Eric Marshall carries Ambush", () => {
    const config: MatchSetupConfig = {
      schemeId: 'cvwr/predict-future-crime',
      mastermindId: 'cvwr/misty-knight',
      villainGroupIds: ['cvwr/shield-elite'],
      henchmanGroupIds: [],
      heroDeckIds: ['cvwr/captain-america-secret-avenger', 'cvwr/cloak-dagger', 'cvwr/daredevil'],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    };
    const G = buildInitialGameState(config, buildSetRegistry('cvwr', CVWR_DATA), makeMockCtx({ numPlayers: 2 }));
    const ids = stackVillainDisplayIds(G);
    assert.equal(ids.length, 4, ids.join(', '));
    for (const cardId of ids) {
      assert.equal(G.cardDisplayData[cardId]?.name, G.cardDisplayData[OFFICER_TOKEN]?.name);
    }
    assert.ok((G.cardKeywords?.[ERIC_MARSHALL] ?? []).includes('ambush'), 'the Ambush site fires for him');
  });

  it('a match without a marked card has no stack-villain entries', () => {
    const config: MatchSetupConfig = {
      schemeId: 'cvwr/predict-future-crime',
      mastermindId: 'cvwr/misty-knight',
      villainGroupIds: ['cvwr/great-lakes-avengers'],
      henchmanGroupIds: [],
      heroDeckIds: ['cvwr/captain-america-secret-avenger', 'cvwr/cloak-dagger', 'cvwr/daredevil'],
      bystandersCount: 30,
      woundsCount: 30,
      officersCount: 30,
      sidekicksCount: 0,
    };
    const G = buildInitialGameState(config, buildSetRegistry('cvwr', CVWR_DATA), makeMockCtx({ numPlayers: 2 }));
    assert.deepStrictEqual(stackVillainDisplayIds(G), []);
  });
});
