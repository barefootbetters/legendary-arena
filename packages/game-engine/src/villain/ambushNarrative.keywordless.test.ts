/**
 * The Ambush overlay names keyword-less Ambush effects (WP-897 / D-24854).
 *
 * Keyword-less villain primitives self-narrate in the log and were dropped from the executor's
 * keyword `results`, so the `ambushResolved` overlay read "entered the city with no Ambush effect"
 * while the log said what happened. These tests build the REAL villain hooks from the committed
 * `data/cards/*.json` through the real setup parser, reveal through the real `revealVillainCard`,
 * and pin, per card: the narrative, the exact log lines, `appliedEffects` and the trace statuses.
 * The log / `appliedEffects` / trace literals are what `origin/main` produced before WP-897 (the
 * WP changes only the narrative).
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { descriptorToLegacyKeyword } from '../rules/villainAbility.types.js';
import { BYSTANDER_EXT_ID, SHIELD_OFFICER_EXT_ID, SIDEKICK_EXT_ID, WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

// why: the villain groups whose cards these tests reveal; their hooks come from the real parser.
const FIXTURE_GROUP_IDS = [
  'co2e/hydra',
  'co2e/sinister-spider-foes',
  'co2e/enemies-of-asgard',
  'co2e/masters-of-evil',
  'co2e/brotherhood-of-mutants',
  'co2e/radiation',
  'core/enemies-of-asgard',
  'chmp/monsters-unleashed',
  'mdns/fallen',
  'mdns/lilin',
  'msis/infinity-stones',
];

const KIDNAPPERS = 'co2e-villain-hydra-hydra-kidnappers-00' as CardExtId;
const VENOM = 'co2e-villain-sinister-spider-foes-venom-00' as CardExtId;
const YMIR = 'core-villain-enemies-of-asgard-ymir-frost-giant-king-00' as CardExtId;
const ENCHANTRESS = 'co2e-villain-enemies-of-asgard-enchantress-00' as CardExtId;
const FROST_GIANT = 'co2e-villain-enemies-of-asgard-frost-giant-warrior-00' as CardExtId;
const ZEMO = 'co2e-villain-masters-of-evil-baron-zemo-00' as CardExtId;
const WHIRLWIND = 'co2e-villain-masters-of-evil-whirlwind-00' as CardExtId;
const MYSTIQUE = 'co2e-villain-brotherhood-of-mutants-mystique-00' as CardExtId;
const JUGGERNAUT = 'co2e-villain-brotherhood-of-mutants-juggernaut-00' as CardExtId;
const LEADER = 'co2e-villain-radiation-the-leader-00' as CardExtId;
const TRULL = 'chmp-villain-monsters-unleashed-trull-the-unhuman-00' as CardExtId;
const METARCHUS = 'mdns-villain-fallen-metarchus-00' as CardExtId;
const MIND_STONE = 'msis-villain-infinity-stones-the-mind-stone-00' as CardExtId;
const BLACKOUT = 'mdns-villain-lilin-blackout-00' as CardExtId;
const OUTCAST = 'mdns-villain-lilin-outcast-00' as CardExtId;
const DRAWER = 'test/villain/drawer#0' as CardExtId;
const THUG = 'test/villain/thug#0' as CardExtId;
const FILLER = 'test/villain/filler#0' as CardExtId;

const HERO_CHEAP_A = 'test/hero/cheap-a#0' as CardExtId;
const HERO_CHEAP_B = 'test/hero/cheap-b#0' as CardExtId;
const HERO_PRICEY = 'test/hero/pricey#0' as CardExtId;
const HERO_REFILL_A = 'test/hero/refill-a#0' as CardExtId;
const HERO_REFILL_B = 'test/hero/refill-b#0' as CardExtId;
const HERO_RANGED = 'test/hero/ranged#0' as CardExtId;
const HERO_STRENGTH = 'test/hero/strength#0' as CardExtId;
const HERO_AVENGER = 'test/hero/avenger#0' as CardExtId;
const HERO_ODD_A = 'test/hero/odd-a#0' as CardExtId;
const HERO_ODD_B = 'test/hero/odd-b#0' as CardExtId;
const HERO_EVEN = 'test/hero/even#0' as CardExtId;
const HQ_CYCLOPS = 'core/cyclops/optic-blast#0' as CardExtId;
const HAND_CYCLOPS = 'co2e/cyclops/optic-blast#1' as CardExtId;
const DEMOLISHED = 'test/hero/demolished#0' as CardExtId;
const HAND_THREE = 'test/hero/three#0' as CardExtId;

/**
 * Builds a registry reader over the given `data/cards/*.json` sets.
 *
 * @param setAbbrs - The set abbreviations to load.
 * @returns A minimal registry with `getSet`.
 */
function makeRegistry(setAbbrs: readonly string[]): { listCards: () => never[]; getSet: (abbr: string) => unknown } {
  const sets: Record<string, unknown> = {};
  for (const setAbbr of setAbbrs) {
    sets[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  }
  return { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
}

/**
 * Builds the real villain hooks for the listed groups.
 *
 * @param groupIds - Qualified villain group ids (`set/group`).
 * @returns The hooks the real setup parser builds.
 */
function buildHooks(groupIds: readonly string[]): VillainAbilityHook[] {
  const setAbbrs = new Set<string>();
  for (const groupId of groupIds) {
    setAbbrs.add(groupId.split('/')[0]!);
  }
  const config = { villainGroupIds: [...groupIds], henchmanGroupIds: [] } as unknown as MatchConfiguration;
  return buildVillainAbilityHooks(makeRegistry([...setAbbrs]), config);
}

/**
 * The display names of the fixture groups' first card copies, read from the card data.
 *
 * @param groupIds - Qualified villain group ids.
 * @returns `{ <cardId>-00: name }`.
 */
function readVillainNames(groupIds: readonly string[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const groupId of groupIds) {
    const [setAbbr, groupSlug] = groupId.split('/') as [string, string];
    const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8')) as {
      villains: { slug: string; cards: { slug: string; name: string }[] }[];
    };
    const group = setData.villains.find((entry) => entry.slug === groupSlug)!;
    for (const card of group.cards) {
      names[`${setAbbr}-villain-${groupSlug}-${card.slug}-00`] = card.name;
    }
  }
  return names;
}

const REAL_HOOKS = buildHooks(FIXTURE_GROUP_IDS);
const VILLAIN_NAMES = readVillainNames(FIXTURE_GROUP_IDS);

/**
 * The display data for every fixture card: villains from the card data, plus the test Heroes
 * and the supply tokens (so the pinned narratives read names, not ids).
 *
 * @returns A `G.cardDisplayData` snapshot.
 */
function makeDisplayData(): Record<string, { name: string; imageUrl: string; cost: number }> {
  const displayData: Record<string, { name: string; imageUrl: string; cost: number }> = {};
  for (const [cardId, name] of Object.entries(VILLAIN_NAMES)) {
    displayData[cardId] = { name, imageUrl: '', cost: 0 };
  }
  const extraNames: Record<string, string> = {
    [SHIELD_OFFICER_EXT_ID]: 'S.H.I.E.L.D. Officer',
    [SIDEKICK_EXT_ID]: 'Sidekick',
    [DRAWER]: 'Drawer',
    [THUG]: 'Thug',
    [FILLER]: 'Filler',
    [HERO_CHEAP_A]: 'Cheap A',
    [HERO_CHEAP_B]: 'Cheap B',
    [HERO_PRICEY]: 'Pricey',
    [HERO_REFILL_A]: 'Refill A',
    [HERO_REFILL_B]: 'Refill B',
    [HERO_RANGED]: 'Hawkeye',
    [HERO_STRENGTH]: 'Hulk',
    [HERO_AVENGER]: 'Captain America',
    [HQ_CYCLOPS]: 'Optic Blast',
    [HAND_CYCLOPS]: 'Optic Blast',
    [DEMOLISHED]: 'Demolished Hero',
    [HAND_THREE]: 'Three Coster',
  };
  for (const [cardId, name] of Object.entries(extraNames)) {
    displayData[cardId] = { name, imageUrl: '', cost: 0 };
  }
  return displayData;
}

/**
 * The villain classification and Ambush keyword of every fixture villain.
 *
 * @returns `villainDeckCardTypes` and `cardKeywords` for the fixture.
 */
function makeVillainTables(): { cardTypes: Record<string, string>; keywords: Record<string, string[]> } {
  const cardTypes: Record<string, string> = { [DRAWER]: 'villain', [THUG]: 'villain', [FILLER]: 'villain' };
  const keywords: Record<string, string[]> = { [DRAWER]: ['ambush'] };
  for (const cardId of Object.keys(VILLAIN_NAMES)) {
    cardTypes[cardId] = 'villain';
    keywords[cardId] = ['ambush'];
  }
  return { cardTypes, keywords };
}

/**
 * A two-seat state wide enough for a reveal and the villain executor.
 *
 * @returns A LegendaryGameState sufficient for these tests (HQ empty, every supply empty).
 */
function makeState(): LegendaryGameState {
  const tables = makeVillainTables();
  return {
    currentStage: 'start',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones() }, '1': { ...makePlayerZones() } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: tables.cardTypes,
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    scheme: { twistPile: [] },
    selection: { schemeId: 'test/scheme', mastermindId: 'test/mastermind', villainGroupIds: [...FIXTURE_GROUP_IDS], henchmanGroupIds: [], heroDeckIds: [] },
    heroAbilityHooks: [],
    villainAbilityHooks: [...REAL_HOOKS],
    cardStats: {},
    cardTraits: {},
    cardKeywords: tables.keywords,
    cardDisplayData: makeDisplayData(),
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Sets a Hero's printed cost (and zero Attack / Recruit).
 *
 * @param G - The game state.
 * @param cardId - The Hero.
 * @param cost - Its printed cost.
 */
function setCost(G: LegendaryGameState, cardId: CardExtId, cost: number): void {
  (G.cardStats as Record<string, unknown>)[cardId] = { attack: 0, recruit: 0, cost, fightCost: 0 };
}

/**
 * Sets a Hero's printed class and team.
 *
 * @param G - The game state.
 * @param cardId - The Hero.
 * @param heroClass - Its class slug, or null.
 * @param team - Its team slug, or null.
 */
function setTraits(G: LegendaryGameState, cardId: CardExtId, heroClass: string | null, team: string | null): void {
  (G.cardTraits as Record<string, unknown>)[cardId] = { heroClass, team };
}

/**
 * Reveals a card as player 0's start-of-turn Villain Deck reveal (the real move).
 *
 * @param G - The game state.
 * @param cardId - The card to put on top of the Villain Deck and reveal.
 * @param restOfDeck - Cards left under it.
 */
function reveal(G: LegendaryGameState, cardId: CardExtId, restOfDeck: CardExtId[] = []): void {
  G.currentStage = 'start';
  G.villainDeck.deck = [cardId, ...restOfDeck];
  revealVillainCard(makeMockMoveContext(G, { numPlayers: 2 }) as never);
}

/**
 * The log lines with their outcomes.
 *
 * @param G - The game state.
 * @returns "outcome: text" lines.
 */
function logLines(G: LegendaryGameState): string[] {
  return G.messages.map((message) => `${message.outcome}: ${message.text}`);
}

/**
 * Asserts the reveal's log lines equal the pinned origin/main literals (AC 9).
 *
 * @param G - The game state after the reveal.
 * @param name - The PINNED_LOGS key.
 */
function assertPinnedLog(G: LegendaryGameState, name: string): void {
  assert.deepEqual(logLines(G), PINNED_LOGS[name]);
}

/**
 * The ambushResolved event for a revealed card.
 *
 * @param G - The game state.
 * @param cardId - The revealed card.
 * @returns Its narrative and appliedEffects.
 */
function ambushFor(G: LegendaryGameState, cardId: CardExtId): { narrative: string; appliedEffects: unknown } {
  for (const event of G.notableEvents as unknown as { type: string; revealedCardId: string; narrative: string; appliedEffects: unknown }[]) {
    if (event.type === 'ambushResolved' && event.revealedCardId === cardId) {
      return event;
    }
  }
  assert.fail(`no ambushResolved event for ${cardId}`);
}

/**
 * The effect / status of every trace recorded for a card.
 *
 * @param G - The game state.
 * @param cardId - The card.
 * @returns `effect:status` strings in record order.
 */
function traceStatuses(G: LegendaryGameState, cardId: CardExtId): string[] {
  const statuses: string[] = [];
  for (const trace of G.diagnostics?.traces ?? []) {
    if (trace.cardId === cardId) {
      statuses.push(`${trace.effect}:${trace.status}`);
    }
  }
  return statuses;
}

/**
 * The clauses of the `Ambush effect:` lines in the log, prefix and final period removed.
 *
 * @param G - The game state.
 * @returns The clauses in log order.
 */
function ambushEffectClauses(G: LegendaryGameState): string[] {
  const prefix = 'Ambush effect: ';
  const clauses: string[] = [];
  for (const message of G.messages) {
    if (message.text.startsWith(prefix) && message.text.endsWith('.')) {
      clauses.push(message.text.slice(prefix.length, -1));
    }
  }
  return clauses;
}

/**
 * Asserts the overlay narrative is the card name plus exactly the clauses its `Ambush effect:`
 * lines logged (AC 3).
 *
 * @param G - The game state after the reveal.
 * @param cardId - The revealed card.
 */
function assertNarrativeEqualsLog(G: LegendaryGameState, cardId: CardExtId): void {
  const clauses = ambushEffectClauses(G);
  assert.ok(clauses.length > 0, 'the reveal logged at least one Ambush effect line');
  assert.equal(ambushFor(G, cardId).narrative, `"${VILLAIN_NAMES[cardId]}" ambushed: ${clauses.join('; ')}.`);
}

/**
 * Builds every villain group's hooks from all the committed card data.
 *
 * @returns Every hook the real parser builds from `data/cards/*.json`.
 */
function buildAllHooks(): VillainAbilityHook[] {
  const setAbbrs: string[] = [];
  const groupIds: string[] = [];
  for (const fileName of readdirSync(CARDS_DIRECTORY).sort()) {
    if (!fileName.endsWith('.json')) {
      continue;
    }
    const setAbbr = fileName.slice(0, -'.json'.length);
    setAbbrs.push(setAbbr);
    const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, fileName), 'utf8')) as { villains?: { slug: string }[] };
    for (const group of setData.villains ?? []) {
      groupIds.push(`${setAbbr}/${group.slug}`);
    }
  }
  const config = { villainGroupIds: groupIds, henchmanGroupIds: [] } as unknown as MatchConfiguration;
  return buildVillainAbilityHooks(makeRegistry(setAbbrs), config);
}

// why: AC 9 — the exact log lines each reveal produced on origin/main before WP-897 (the WP adds
// no line and changes none); filled from the pre-change engine and pinned here.
const PINNED_LOGS: Record<string, string[]> = {
  kidnappers: [
    'threat: [Ambush] HYDRA Kidnappers (co2e-villain-hydra-hydra-kidnappers-00) revealed and entered the city!',
    'applied: Ambush effect: captured S.H.I.E.L.D. Officer from the S.H.I.E.L.D. Officer Deck.',
  ],
  kidnappersBlocked: [
    'threat: [Ambush] HYDRA Kidnappers (co2e-villain-hydra-hydra-kidnappers-00) revealed and entered the city!',
    'blocked: Ambush effect: nothing was captured because the S.H.I.E.L.D. Officer Deck and the Sidekick Deck are empty.',
  ],
  venom: [
    'threat: [Ambush] Venom (co2e-villain-sinister-spider-foes-venom-00) revealed and entered the city!',
    'applied: Ambush effect: captured Sidekick from the Sidekick Deck.',
    'applied: Ambush effect: captured Cheap A, Cheap B from the HQ (cost 2 or less).',
  ],
  ymir: [
    'threat: [Ambush] Ymir, Frost Giant King (core-villain-enemies-of-asgard-ymir-frost-giant-king-00) revealed and entered the city!',
    'applied: Ambush effect: 1 player(s) had no Ranged Hero and gained a Wound (Player 1).',
    'neutral: Ambush effect: Player 0 can reveal a matching Ranged Hero and will choose whether to reveal it or gain a Wound.',
  ],
  zemo: [
    'threat: [Ambush] Baron Zemo (co2e-villain-masters-of-evil-baron-zemo-00) revealed and entered the city!',
    'applied: Ambush effect: captured 2 Bystander(s) (1 + one per avengers Hero in the HQ).',
  ],
  whirlwind: [
    'threat: [Ambush] Whirlwind (co2e-villain-masters-of-evil-whirlwind-00) revealed and entered the city!',
    'applied: Ambush effect: Whirlwind (sewers) and Thug (bridge) swapped City spaces.',
  ],
  mystique: [
    'threat: [Ambush] Mystique (co2e-villain-brotherhood-of-mutants-mystique-00) revealed and entered the city!',
    'applied: Ambush effect: each player must discard an X-Men Hero.',
  ],
  frostGiant: [
    'threat: [Ambush] Frost Giant Warrior (co2e-villain-enemies-of-asgard-frost-giant-warrior-00) revealed and entered the city!',
    'applied: Ambush effect: each player must discard a Ranged Hero or gain a Wound.',
  ],
  juggernaut: [
    'threat: [Ambush] Juggernaut (co2e-villain-brotherhood-of-mutants-juggernaut-00) revealed and entered the city!',
    'applied: Ambush effect: Player 0 discarded Optic Blast (same card name as a Hero in the HQ).',
    'applied: Ambush effect: put 2 Hero(es) from the HQ on the bottom of the Hero Deck (Optic Blast, Pricey); the HQ refilled.',
  ],
  metarchus: [
    'threat: [Ambush] Metarchus (mdns-villain-fallen-metarchus-00) revealed and entered the city!',
    "threat: Ambush effect: Metarchus haunts Pricey (HQ slot 1); that Hero can't be recruited until exorcised.",
  ],
  mindStone: [
    'threat: [Ambush] The Mind Stone (msis-villain-infinity-stones-the-mind-stone-00) revealed and entered the city!',
    'applied: Ambush effect: Heroes in the HQ cost 2 more this turn (The Mind Stone): Cheap A, Pricey.',
  ],
  trull: [
    'threat: [Ambush] Trull the Unhuman (chmp-villain-monsters-unleashed-trull-the-unhuman-00) revealed and entered the city!',
    'applied: Ambush effect: Demolish revealed Demolished Hero (cost 3) and put it on the bottom of the Hero Deck.',
    'applied: Ambush effect: Player 0 discarded Three Coster (cost 3).',
    'blocked: Ambush effect: Player 1 has no card that costs 3 to discard.',
    'threat: Ambush effect: a bystander was captured.',
  ],
  trullEmptyDeck: [
    'threat: [Ambush] Trull the Unhuman (chmp-villain-monsters-unleashed-trull-the-unhuman-00) revealed and entered the city!',
    'blocked: Ambush effect: the Hero Deck is empty, so nothing is Demolished.',
    'threat: Ambush effect: a bystander was captured.',
  ],
  enchantress: [
    'threat: [Ambush] Enchantress (co2e-villain-enemies-of-asgard-enchantress-00) revealed and entered the city!',
    'applied: Ambush effect: captured a Bystander from the Victory Pile of Player 1.',
    'threat: Ambush effect: a bystander was captured.',
  ],
  leaderRevealed: [
    'threat: [Ambush] The Leader (co2e-villain-radiation-the-leader-00) revealed and entered the city!',
    'blocked: Ambush effect: Player 0 revealed a Strength Hero, so no card is played from the Villain Deck.',
  ],
  leaderUnrevealed: [
    'threat: [Ambush] The Leader (co2e-villain-radiation-the-leader-00) revealed and entered the city!',
    'threat: Ambush effect: The Leader (co2e-villain-radiation-the-leader-00) plays the top card of the Villain Deck.',
    'neutral: Filler (test/villain/filler#0) revealed and entered the city.',
  ],
};

describe('the keyword-less Ambush set in the card data (WP-897 RS-5)', () => {
  it('the real parser finds exactly the 16 keyword-less Ambush primitives, in printed order', () => {
    const primitives = new Set<string>();
    const descriptorsByCard = new Map<string, { isLegacy: boolean; primitive: string; isConditional: boolean }[]>();
    for (const hook of buildAllHooks()) {
      if (hook.timing !== 'onAmbush') {
        continue;
      }
      const cardDescriptors = descriptorsByCard.get(hook.cardId) ?? [];
      for (const descriptor of hook.effects) {
        const isLegacy = descriptorToLegacyKeyword(descriptor) !== undefined;
        if (!isLegacy) {
          primitives.add(descriptor.primitive);
        }
        cardDescriptors.push({ isLegacy, primitive: descriptor.primitive, isConditional: descriptor.requireCondition !== undefined });
      }
      descriptorsByCard.set(hook.cardId, cardDescriptors);
      // why: the "again" wording is keyed to requireCondition, so every conditional hunt must
      // follow an unconditional hunt in the same hook (Blackout's Moonlight repeat).
      let hasUnconditionalHunt = false;
      for (const descriptor of hook.effects) {
        if (descriptor.primitive !== 'villain-hunt-for-victims') {
          continue;
        }
        if (descriptor.requireCondition === undefined) {
          hasUnconditionalHunt = true;
        } else {
          assert.ok(hasUnconditionalHunt, `${hook.cardId}: a conditional hunt follows an unconditional one`);
        }
      }
    }
    assert.deepEqual([...primitives].sort(), [
      'capture-bystander-each-victory-pile',
      'capture-bystanders-plus-per-hq-hero-by-trait',
      'capture-hq-heroes-cost-lte',
      'capture-pile-hero',
      'demolish-each-player',
      'discard-hand-matching-hq-card-names-each-player',
      'discard-hero-each-player-by-trait',
      'discard-hero-or-wound-each-player-by-trait',
      'haunt-hq-hero',
      'hq-heroes-cost-change',
      'hq-heroes-to-hero-deck-bottom',
      'play-villain-deck-cards',
      'reveal-or-wound',
      'stack-cards-enter-city-as-villains',
      'swap-two-city-villains',
      'villain-hunt-for-victims',
    ]);
    // why: the overlay lists keyword clauses before keyword-less ones, which equals printed order
    // only while no keyword-less descriptor precedes a legacy one across a card's Ambush hooks.
    for (const [cardId, descriptors] of descriptorsByCard) {
      let hasSeenKeywordless = false;
      for (const descriptor of descriptors) {
        if (!descriptor.isLegacy) {
          hasSeenKeywordless = true;
        } else {
          assert.ok(!hasSeenKeywordless, `${cardId}: no keyword-less Ambush descriptor precedes a legacy one`);
        }
      }
    }
  });
});

describe('HYDRA Kidnappers and Venom (WP-897 AC 1 / AC 2 / AC 9)', () => {
  it('Kidnappers names the captured Officer', () => {
    const G = makeState();
    G.piles.officers = [SHIELD_OFFICER_EXT_ID, SHIELD_OFFICER_EXT_ID];
    reveal(G, KIDNAPPERS);
    assertPinnedLog(G, 'kidnappers');
    const ambush = ambushFor(G, KIDNAPPERS);
    assert.equal(ambush.narrative, '"HYDRA Kidnappers" ambushed: captured S.H.I.E.L.D. Officer from the S.H.I.E.L.D. Officer Deck.');
    assert.deepEqual(ambush.appliedEffects, []);
    assert.deepEqual(traceStatuses(G, KIDNAPPERS), ['capture-pile-hero:fired']);
  });

  it('Kidnappers with both decks empty names the blocked capture', () => {
    const G = makeState();
    reveal(G, KIDNAPPERS);
    assertPinnedLog(G, 'kidnappersBlocked');
    assert.equal(
      ambushFor(G, KIDNAPPERS).narrative,
      '"HYDRA Kidnappers" ambushed: nothing was captured because the S.H.I.E.L.D. Officer Deck and the Sidekick Deck are empty.',
    );
    assertNarrativeEqualsLog(G, KIDNAPPERS);
  });

  it('Venom names the captured Sidekick and the cheap HQ Heroes', () => {
    const G = makeState();
    G.piles.sidekicks = [SIDEKICK_EXT_ID];
    G.hq = [HERO_CHEAP_A, HERO_PRICEY, HERO_CHEAP_B, null, null] as LegendaryGameState['hq'];
    G.heroDeck = [HERO_REFILL_A, HERO_REFILL_B];
    setCost(G, HERO_CHEAP_A, 2);
    setCost(G, HERO_PRICEY, 5);
    setCost(G, HERO_CHEAP_B, 1);
    reveal(G, VENOM);
    assertPinnedLog(G, 'venom');
    const ambush = ambushFor(G, VENOM);
    assert.equal(
      ambush.narrative,
      '"Venom" ambushed: captured Sidekick from the Sidekick Deck; captured Cheap A, Cheap B from the HQ (cost 2 or less).',
    );
    assert.deepEqual(ambush.appliedEffects, []);
    assert.deepEqual(traceStatuses(G, VENOM), ['capture-pile-hero:fired', 'capture-hq-heroes-cost-lte:fired']);
  });
});

describe('every clause-setting primitive narrates its logged clause (WP-897 AC 3 / AC 9)', () => {
  it('Ymir: one player gains a Wound, the other can reveal (the owed wording)', () => {
    const G = makeState();
    G.piles.wounds = [WOUND_EXT_ID, WOUND_EXT_ID];
    G.playerZones['0']!.hand = [HERO_RANGED];
    setTraits(G, HERO_RANGED, 'ranged', null);
    reveal(G, YMIR);
    assertPinnedLog(G, 'ymir');
    assertNarrativeEqualsLog(G, YMIR);
    assert.equal(
      ambushFor(G, YMIR).narrative,
      '"Ymir, Frost Giant King" ambushed: 1 player(s) had no Ranged Hero and gained a Wound (Player 1); Player 0 can reveal a matching Ranged Hero and will choose whether to reveal it or gain a Wound.',
    );
    assert.deepEqual(ambushFor(G, YMIR).appliedEffects, []);
    assert.deepEqual(traceStatuses(G, YMIR), ['reveal-or-wound:fired']);
  });

  it('Baron Zemo names the Bystanders captured', () => {
    const G = makeState();
    G.piles.bystanders = [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID];
    G.hq = [HERO_AVENGER, null, null, null, null] as LegendaryGameState['hq'];
    setTraits(G, HERO_AVENGER, 'strength', 'avengers');
    reveal(G, ZEMO);
    assertPinnedLog(G, 'zemo');
    assertNarrativeEqualsLog(G, ZEMO);
    assert.deepEqual(ambushFor(G, ZEMO).appliedEffects, []);
    assert.deepEqual(traceStatuses(G, ZEMO), ['capture-bystanders-plus-per-hq-hero-by-trait:fired']);
  });

  it('Whirlwind names the swapped Villains', () => {
    const G = makeState();
    G.city = [null, null, null, null, THUG] as LegendaryGameState['city'];
    reveal(G, WHIRLWIND);
    assertPinnedLog(G, 'whirlwind');
    assertNarrativeEqualsLog(G, WHIRLWIND);
    assert.deepEqual(ambushFor(G, WHIRLWIND).appliedEffects, []);
    assert.deepEqual(traceStatuses(G, WHIRLWIND), ['swap-two-city-villains:fired']);
  });

  it('Mystique names the owed discard', () => {
    const mystique = makeState();
    reveal(mystique, MYSTIQUE);
    assertPinnedLog(mystique, 'mystique');
    assertNarrativeEqualsLog(mystique, MYSTIQUE);
    assert.equal(ambushFor(mystique, MYSTIQUE).narrative, '"Mystique" ambushed: each player must discard an X-Men Hero.');
    assert.deepEqual(traceStatuses(mystique, MYSTIQUE), ['discard-hero-each-player-by-trait:fired']);
  });

  it('Frost Giant Warrior names the owed discard or Wound', () => {
    const frostGiant = makeState();
    reveal(frostGiant, FROST_GIANT);
    assertPinnedLog(frostGiant, 'frostGiant');
    assertNarrativeEqualsLog(frostGiant, FROST_GIANT);
    assert.equal(
      ambushFor(frostGiant, FROST_GIANT).narrative,
      '"Frost Giant Warrior" ambushed: each player must discard a Ranged Hero or gain a Wound.',
    );
    assert.deepEqual(traceStatuses(frostGiant, FROST_GIANT), ['discard-hero-or-wound-each-player-by-trait:fired']);
  });

  it('Juggernaut names the discards, then the HQ bottomed', () => {
    const G = makeState();
    G.hq = [HQ_CYCLOPS, HERO_PRICEY, null, null, null] as LegendaryGameState['hq'];
    G.heroDeck = [HERO_REFILL_A, HERO_REFILL_B];
    G.playerZones['0']!.hand = [HAND_CYCLOPS, HERO_STRENGTH];
    reveal(G, JUGGERNAUT);
    assertPinnedLog(G, 'juggernaut');
    assertNarrativeEqualsLog(G, JUGGERNAUT);
    assert.deepEqual(ambushFor(G, JUGGERNAUT).appliedEffects, []);
    assert.deepEqual(traceStatuses(G, JUGGERNAUT), [
      'discard-hand-matching-hq-card-names-each-player:fired',
      'hq-heroes-to-hero-deck-bottom:fired',
    ]);
  });

  it('Metarchus names the haunted Hero', () => {
    const G = makeState();
    G.hq = [HERO_CHEAP_A, HERO_PRICEY, null, null, null] as LegendaryGameState['hq'];
    reveal(G, METARCHUS);
    assertPinnedLog(G, 'metarchus');
    assertNarrativeEqualsLog(G, METARCHUS);
    assert.deepEqual(ambushFor(G, METARCHUS).appliedEffects, []);
    assert.deepEqual(traceStatuses(G, METARCHUS), ['haunt-hq-hero:fired']);
  });

  it('The Mind Stone names the cost change', () => {
    const G = makeState();
    G.hq = [HERO_CHEAP_A, HERO_PRICEY, null, null, null] as LegendaryGameState['hq'];
    reveal(G, MIND_STONE);
    assertPinnedLog(G, 'mindStone');
    assertNarrativeEqualsLog(G, MIND_STONE);
    assert.deepEqual(ambushFor(G, MIND_STONE).appliedEffects, []);
    assert.deepEqual(traceStatuses(G, MIND_STONE), ['hq-heroes-cost-change:fired']);
  });

  it('Trull (Demolish shape c): the reveal, then one clause per seat, one with no card of that cost', () => {
    const G = makeState();
    G.piles.bystanders = [BYSTANDER_EXT_ID];
    G.heroDeck = [DEMOLISHED, HERO_REFILL_A];
    setCost(G, DEMOLISHED, 3);
    setCost(G, HAND_THREE, 3);
    G.playerZones['0']!.hand = [HAND_THREE];
    reveal(G, TRULL);
    assertPinnedLog(G, 'trull');
    const demolishClauses = ambushEffectClauses(G).slice(0, -1);
    assert.deepEqual(demolishClauses, [
      'Demolish revealed Demolished Hero (cost 3) and put it on the bottom of the Hero Deck',
      'Player 0 discarded Three Coster (cost 3)',
      'Player 1 has no card that costs 3 to discard',
    ]);
    const keywordClause = ambushEffectClauses(G).at(-1)!;
    assert.equal(
      ambushFor(G, TRULL).narrative,
      `"Trull the Unhuman" ambushed: ${keywordClause}; ${demolishClauses.join('; ')}.`,
      'the keyword clause precedes the keyword-less clause (AC 4)',
    );
    assert.deepEqual(ambushFor(G, TRULL).appliedEffects, ['captureBystander']);
    assert.deepEqual(traceStatuses(G, TRULL), ['capture-bystander:fired', 'demolish-each-player:fired']);
  });

  it('Trull (Demolish shape a): the Hero Deck is empty', () => {
    const G = makeState();
    G.piles.bystanders = [BYSTANDER_EXT_ID];
    reveal(G, TRULL);
    assertPinnedLog(G, 'trullEmptyDeck');
    assert.equal(ambushEffectClauses(G)[0], 'the Hero Deck is empty, so nothing is Demolished');
    assert.equal(
      ambushFor(G, TRULL).narrative,
      `"Trull the Unhuman" ambushed: ${ambushEffectClauses(G).at(-1)!}; the Hero Deck is empty, so nothing is Demolished.`,
    );
  });

  it('Enchantress: the keyword capture, then the Victory Pile capture (AC 4)', () => {
    const G = makeState();
    G.piles.bystanders = [BYSTANDER_EXT_ID];
    G.playerZones['1']!.victory = [BYSTANDER_EXT_ID];
    reveal(G, ENCHANTRESS);
    assertPinnedLog(G, 'enchantress');
    const clauses = ambushEffectClauses(G);
    assert.deepEqual(clauses.slice(0, -1), ['captured a Bystander from the Victory Pile of Player 1']);
    assert.equal(
      ambushFor(G, ENCHANTRESS).narrative,
      `"Enchantress" ambushed: ${clauses.at(-1)!}; captured a Bystander from the Victory Pile of Player 1.`,
    );
    assert.deepEqual(ambushFor(G, ENCHANTRESS).appliedEffects, ['captureBystander']);
    assert.deepEqual(traceStatuses(G, ENCHANTRESS), ['capture-bystander:fired', 'capture-bystander-each-victory-pile:fired']);
  });
});

describe('The Leader, the fallback and the gates (WP-897 AC 5 / AC 6 / AC 7 / AC 8)', () => {
  it('co2e The Leader with a Strength Hero revealed names the reveal', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HERO_STRENGTH];
    setTraits(G, HERO_STRENGTH, 'strength', null);
    reveal(G, LEADER, [FILLER]);
    assertPinnedLog(G, 'leaderRevealed');
    assertNarrativeEqualsLog(G, LEADER);
    assert.equal(
      ambushFor(G, LEADER).narrative,
      '"The Leader" ambushed: Player 0 revealed a Strength Hero, so no card is played from the Villain Deck.',
    );
    assert.deepEqual(traceStatuses(G, LEADER), ['play-villain-deck-cards:no-op']);
  });

  it('co2e The Leader unrevealed keeps its play narrative, with no fallback', () => {
    const G = makeState();
    reveal(G, LEADER, [FILLER]);
    assertPinnedLog(G, 'leaderUnrevealed');
    assert.equal(ambushFor(G, LEADER).narrative, '"The Leader" ambushed: plays the top card of the Villain Deck.');
  });

  it('a keyword-less descriptor that sets no clause reads the honest fallback', () => {
    const G = makeState();
    G.villainAbilityHooks = [
      { cardId: DRAWER, timing: 'onAmbush', keywords: [], effects: [{ primitive: 'draw-cards-current', drawCount: 1 }] },
    ] as unknown as LegendaryGameState['villainAbilityHooks'];
    G.playerZones['0']!.deck = [HERO_CHEAP_A];
    reveal(G, DRAWER);
    assert.equal(ambushFor(G, DRAWER).narrative, '"Drawer" ambushed: its Ambush effect resolved (see the log).');
    assert.deepEqual(traceStatuses(G, DRAWER), ['draw-cards-current:fired']);
  });

  it('a gated-out descriptor adds nothing: Blackout under Sunlight hunts once, under Moonlight twice', () => {
    const sunlight = makeState();
    sunlight.hq = [HERO_EVEN, HERO_EVEN, HERO_ODD_A, null, null] as LegendaryGameState['hq'];
    setCost(sunlight, HERO_EVEN, 4);
    setCost(sunlight, HERO_ODD_A, 3);
    reveal(sunlight, BLACKOUT);
    assert.equal(ambushFor(sunlight, BLACKOUT).narrative, '"Blackout" ambushed: it Hunts for Victims.');
    const moonlight = makeState();
    moonlight.hq = [HERO_ODD_A, HERO_ODD_B, HERO_EVEN, null, null] as LegendaryGameState['hq'];
    setCost(moonlight, HERO_ODD_A, 3);
    setCost(moonlight, HERO_ODD_B, 5);
    setCost(moonlight, HERO_EVEN, 4);
    reveal(moonlight, BLACKOUT);
    assert.equal(ambushFor(moonlight, BLACKOUT).narrative, '"Blackout" ambushed: it Hunts for Victims; it Hunts for Victims again.');
  });

  it('a card whose Ambush has no descriptor still reads "no Ambush effect"', () => {
    const G = makeState();
    reveal(G, OUTCAST);
    assert.equal(ambushFor(G, OUTCAST).narrative, '"Outcast" entered the city with no Ambush effect.');
  });
});
