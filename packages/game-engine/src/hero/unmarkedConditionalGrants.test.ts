/**
 * Unmarked "If <condition>, you get +N" grants (WP-745 / D-24568).
 *
 * Twelve hero lines printed "If <condition>, you get +N Attack/Recruit" with no marker, so the
 * parser read only the icon and granted the bonus on every play. Curated markers now gate each
 * line: four on-play play-history conditions over the shared played view (Dr. Octopus, both
 * Invisible Woman cards, Venomized Dr. Strange, Warriors Three), Rage's wait-and-see KO-pile event
 * over a gated turn-start snapshot, the shipped draw threshold (four lines) and the Savior
 * Bystander condition at a printed threshold (two Black Widow lines).
 *
 * Every hook is parsed from the COMMITTED data/cards JSON (never a hand-typed ability string),
 * and plays go through the real applyCardPlay / playCard + resolveSplitFaceChoice paths.
 *
 * No boardgame.io imports (the real LegendaryGame is imported only to invoke its play-phase
 * turn.onBegin). node:test + node:assert only.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { applyCardPlay, playCard } from '../moves/coreMoves.impl.js';
import { resolveSplitFaceChoice } from '../moves/splitFaceChoice.resolve.js';
import { resolveDeferredHeroGrants } from './heroEffects.execute.js';
import {
  CARD_PLAY_ORDINAL_CONDITION_TYPE,
  OTHER_CARD_OF_COST_PLAYED_CONDITION_TYPE,
  CARD_OF_COST_PLAYED_CONDITION_TYPE,
  OTHER_DISTINCT_HEROES_PLAYED_CONDITION_TYPE,
  HERO_KOED_THIS_TURN_CONDITION_TYPE,
} from './heroConditions.evaluate.js';
import { koCard } from '../board/ko.logic.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { LegendaryGame } from '../game.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { BYSTANDER_EXT_ID, SHIELD_AGENT_EXT_ID, SIDEKICK_EXT_ID, WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// ---------------------------------------------------------------------------
// The twelve in-scope lines
// ---------------------------------------------------------------------------

/** One printed line under test and the gate its marker must produce. */
interface GatedLine {
  setAbbr: string;
  heroDeckId: string;
  cardSlug: string;
  conditions: { type: string; value: string }[];
  effect: { type: 'attack' | 'recruit'; magnitude: number };
}

const RAGE: GatedLine = {
  setAbbr: 'msis', heroDeckId: 'msis/wanda-vision', cardSlug: 'rage',
  conditions: [{ type: HERO_KOED_THIS_TURN_CONDITION_TYPE, value: '1' }],
  effect: { type: 'attack', magnitude: 2 },
};
const DR_OCTOPUS: GatedLine = {
  setAbbr: 'vill', heroDeckId: 'vill/dr-octopus', cardSlug: 'eighth-times-a-charm',
  conditions: [{ type: CARD_PLAY_ORDINAL_CONDITION_TYPE, value: '8' }],
  effect: { type: 'attack', magnitude: 2 },
};
const INVISIBLE_WOMAN_ANNI: GatedLine = {
  setAbbr: 'anni', heroDeckId: 'anni/fantastic-four-united', cardSlug: 'invisible-woman',
  conditions: [{ type: OTHER_CARD_OF_COST_PLAYED_CONDITION_TYPE, value: '4' }],
  effect: { type: 'recruit', magnitude: 2 },
};
const FOUR_OF_A_KIND: GatedLine = {
  setAbbr: 'ff04', heroDeckId: 'ff04/invisible-woman', cardSlug: 'four-of-a-kind',
  conditions: [{ type: OTHER_CARD_OF_COST_PLAYED_CONDITION_TYPE, value: '4' }],
  effect: { type: 'attack', magnitude: 2 },
};
const GRAND_RITUAL: GatedLine = {
  setAbbr: 'vnom', heroDeckId: 'vnom/venomized-dr-strange', cardSlug: 'complete-the-grand-ritual',
  conditions: [
    { type: CARD_OF_COST_PLAYED_CONDITION_TYPE, value: '4' },
    { type: CARD_OF_COST_PLAYED_CONDITION_TYPE, value: '2' },
  ],
  effect: { type: 'attack', magnitude: 2 },
};
const WARRIORS_THREE: GatedLine = {
  setAbbr: 'asrd', heroDeckId: 'asrd/warriors-three-the', cardSlug: 'three-stand-as-one',
  conditions: [{ type: OTHER_DISTINCT_HEROES_PLAYED_CONDITION_TYPE, value: '3' }],
  effect: { type: 'attack', magnitude: 3 },
};
const HAWKEYE: GatedLine = {
  setAbbr: 'co2e', heroDeckId: 'co2e/hawkeye', cardSlug: 'trick-arrow',
  conditions: [{ type: 'cardsDrawnThisTurnAtLeast', value: '1' }],
  effect: { type: 'attack', magnitude: 2 },
};
const WOLVERINE: GatedLine = {
  setAbbr: 'dkcy', heroDeckId: 'dkcy/wolverine', cardSlug: 'sudden-ambush',
  conditions: [{ type: 'cardsDrawnThisTurnAtLeast', value: '1' }],
  effect: { type: 'attack', magnitude: 2 },
};
const CAPTAIN_MARVEL: GatedLine = {
  setAbbr: 'rvlt', heroDeckId: 'rvlt/captain-marvel-agent-of-shield', cardSlug: 'radiant-blast',
  conditions: [{ type: 'cardsDrawnThisTurnAtLeast', value: '1' }],
  effect: { type: 'attack', magnitude: 1 },
};
const GAMORA: GatedLine = {
  setAbbr: 'mgtg', heroDeckId: 'mgtg/gamora', cardSlug: 'guardians-escape',
  conditions: [{ type: 'cardsDrawnThisTurnAtLeast', value: '2' }],
  effect: { type: 'attack', magnitude: 2 },
};
const BLACK_WIDOW_CO2E: GatedLine = {
  setAbbr: 'co2e', heroDeckId: 'co2e/black-widow', cardSlug: 'covert-operation',
  conditions: [{ type: 'bystandersInVictoryAtLeast', value: '4' }],
  effect: { type: 'attack', magnitude: 2 },
};
const BLACK_WIDOW_WTIF: GatedLine = {
  setAbbr: 'wtif', heroDeckId: 'wtif/apocalyptic-black-widow', cardSlug: 'humanitys-final-hope',
  conditions: [{ type: 'bystandersInVictoryAtLeast', value: '4' }],
  effect: { type: 'recruit', magnitude: 2 },
};

const ALL_LINES: readonly GatedLine[] = [
  RAGE, DR_OCTOPUS, INVISIBLE_WOMAN_ANNI, FOUR_OF_A_KIND, GRAND_RITUAL, WARRIORS_THREE,
  HAWKEYE, WOLVERINE, CAPTAIN_MARVEL, GAMORA, BLACK_WIDOW_CO2E, BLACK_WIDOW_WTIF,
];

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const playContext = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds a one-set registry reader from the COMMITTED data/cards JSON.
 *
 * @param setAbbr - Set abbreviation (the data/cards/<abbr>.json file).
 * @returns A structural registry reader for buildHeroAbilityHooks.
 */
function registryForSet(setAbbr: string): unknown {
  // why: resolve the repo-root data file from this test's own location (the
  // firstCardPlayed.test.ts precedent), so the test parses what ships.
  const here = dirname(fileURLToPath(import.meta.url));
  const setData = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', `${setAbbr}.json`), 'utf8'));
  return { listCards: () => [], getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
}

/**
 * Parses a hero deck from the committed data.
 *
 * @param line - Any line from the deck.
 * @returns Every hook the deck builds.
 */
function buildDeckHooks(line: GatedLine): HeroAbilityHook[] {
  const config = { heroDeckIds: [line.heroDeckId] } as unknown as MatchConfiguration;
  return buildHeroAbilityHooks(registryForSet(line.setAbbr), config);
}

/**
 * Returns the gated hook of one copy of the card, picked by its expected first condition.
 *
 * @param line - The line under test.
 * @param copyIndex - Which printed copy (`#N`).
 * @returns The gated hook.
 */
function findGatedHook(line: GatedLine, copyIndex = 0): HeroAbilityHook {
  const cardId = `${line.heroDeckId}/${line.cardSlug}#${copyIndex}`;
  const gatedHook = buildDeckHooks(line).find(
    (hook) =>
      hook.cardId === cardId &&
      (hook.conditions ?? []).some((condition) => condition.type === line.conditions[0]!.type),
  );
  assert.ok(gatedHook !== undefined, `${cardId} must carry a ${line.conditions[0]!.type} gate`);
  return gatedHook;
}

/**
 * Minimal state for the play path: the given hooks, a one-card deck and empty card maps.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @returns A LegendaryGameState sufficient for these plays.
 */
function makeState(hooks: HeroAbilityHook[]): LegendaryGameState {
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    currentStage: 'main',
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), inPlay: [], hand: [], deck: ['test/filler/deck-top#0' as CardExtId] } },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats: {},
    cardTraits: {},
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
 * A printed card-stat row with no base economy (only the cost matters here).
 *
 * @param cost - The printed cost.
 * @returns The stat entry.
 */
function costOnly(cost: number) {
  return { attack: 0, recruit: 0, cost, fightCost: 0, fightCostMode: 'static' as const, fightCostBase: 0 };
}

/**
 * Plays a filler card (no hooks) through applyCardPlay.
 *
 * @param G - The game state.
 * @param cardId - The filler card id.
 * @param cost - Its printed cost (recorded in G.cardStats).
 */
function playFiller(G: LegendaryGameState, cardId: string, cost = 3): void {
  (G.cardStats as Record<string, unknown>)[cardId] = costOnly(cost);
  applyCardPlay(G, playContext as unknown as Parameters<typeof applyCardPlay>[1], '0', cardId);
}

/**
 * Plays the gated card through applyCardPlay.
 *
 * @param G - The game state.
 * @param hook - The card's gated hook.
 */
function playGated(G: LegendaryGameState, hook: HeroAbilityHook): void {
  applyCardPlay(G, playContext as unknown as Parameters<typeof applyCardPlay>[1], '0', hook.cardId);
}

/**
 * The grant the line produced this turn.
 *
 * @param G - The game state.
 * @param line - The line under test.
 * @returns The attack or recruit total, matching the line's printed icon.
 */
function grantOf(G: LegendaryGameState, line: GatedLine): number {
  return line.effect.type === 'attack' ? G.turnEconomy.attack : G.turnEconomy.recruit;
}

// ---------------------------------------------------------------------------
// Case 1 — parse
// ---------------------------------------------------------------------------

describe('WP-745 case 1: parse — each committed line carries its gate beside the unchanged grant', () => {
  for (const line of ALL_LINES) {
    it(`${line.heroDeckId}/${line.cardSlug} parses to ${line.conditions.map((condition) => `${condition.type}:${condition.value}`).join(' + ')}`, () => {
      const hook = findGatedHook(line);
      assert.deepEqual(hook.conditions, line.conditions);
      assert.deepEqual(hook.effects, [line.effect]);
      assert.equal(hook.unresolvedMarkers, undefined, 'the gated line has no unresolved marker');
    });
  }
});

// ---------------------------------------------------------------------------
// Case 2 — ordinal
// ---------------------------------------------------------------------------

describe('WP-745 case 2: Dr. Octopus grants only as the exact eighth card played', () => {
  /**
   * Plays N-1 fillers, then Dr. Octopus.
   *
   * @param earlierPlays - How many cards are played before him.
   * @returns The state after his play.
   */
  function playAfter(earlierPlays: number): LegendaryGameState {
    const hook = findGatedHook(DR_OCTOPUS);
    const G = makeState([hook]);
    for (let playIndex = 0; playIndex < earlierPlays; playIndex++) {
      playFiller(G, `test/filler/card#${playIndex}`);
    }
    playGated(G, hook);
    return G;
  }

  it('8th play → +2', () => {
    assert.equal(playAfter(7).turnEconomy.attack, 2);
  });

  it('7th play → none, and the log names the ordinal', () => {
    const G = playAfter(6);
    assert.equal(G.turnEconomy.attack, 0);
    assert.ok(G.messages.some((message) => message.text.includes('it needs to be card number 8 you played this turn — it was card number 7')));
    assert.equal(G.deferredConditionalGrants, undefined, 'an on-play gate records no deferral');
  });

  it('9th play → none', () => {
    assert.equal(playAfter(8).turnEconomy.attack, 0);
  });

  // why: Out of Scope E / D-24568 §2 — the shared played view drops a card KO'd out of play, so
  // the exact ordinal can err late. This pins today's behaviour; the follow-up that keeps KO'd
  // plays in the view flips it.
  it('residual pin: one earlier play KO\'d out of play, then the 9th physical play reads as the 8th → +2', () => {
    const hook = findGatedHook(DR_OCTOPUS);
    const G = makeState([hook]);
    for (let playIndex = 0; playIndex < 8; playIndex++) {
      playFiller(G, `test/filler/card#${playIndex}`);
    }
    const zones = G.playerZones['0']!;
    zones.inPlay = zones.inPlay.filter((cardId) => cardId !== 'test/filler/card#0');
    G.ko = koCard(G.ko, 'test/filler/card#0' as CardExtId);
    playGated(G, hook);
    assert.equal(G.turnEconomy.attack, 2);
  });
});

// ---------------------------------------------------------------------------
// Case 3 — cost
// ---------------------------------------------------------------------------

describe('WP-745 case 3: cost gates read the played view', () => {
  it('Four of a Kind after another 4-cost play → +2 Attack', () => {
    const hook = findGatedHook(FOUR_OF_A_KIND);
    const G = makeState([hook]);
    playFiller(G, 'test/filler/four-cost#0', 4);
    (G.cardStats as Record<string, unknown>)[hook.cardId] = costOnly(4);
    playGated(G, hook);
    assert.equal(G.turnEconomy.attack, 2);
  });

  it('Four of a Kind as the only 4-cost card played (herself) → none', () => {
    const hook = findGatedHook(FOUR_OF_A_KIND);
    const G = makeState([hook]);
    playFiller(G, 'test/filler/three-cost#0', 3);
    (G.cardStats as Record<string, unknown>)[hook.cardId] = costOnly(4);
    playGated(G, hook);
    assert.equal(G.turnEconomy.attack, 0);
    assert.ok(G.messages.some((message) => message.text.includes('it needs another card costing 4 played this turn')));
  });

  it('a second Four of a Kind copy counts as the other 4-cost card', () => {
    const firstCopy = findGatedHook(FOUR_OF_A_KIND, 0);
    const secondCopy = findGatedHook(FOUR_OF_A_KIND, 1);
    const G = makeState([firstCopy, secondCopy]);
    (G.cardStats as Record<string, unknown>)[firstCopy.cardId] = costOnly(4);
    (G.cardStats as Record<string, unknown>)[secondCopy.cardId] = costOnly(4);
    playGated(G, firstCopy);
    assert.equal(G.turnEconomy.attack, 0, 'the first copy has no other 4-cost card');
    playGated(G, secondCopy);
    assert.equal(G.turnEconomy.attack, 2, 'the second copy counts the first');
  });

  it('anni Invisible Woman after another 4-cost play → +2 Recruit', () => {
    const hook = findGatedHook(INVISIBLE_WOMAN_ANNI);
    const G = makeState([hook]);
    playFiller(G, 'test/filler/four-cost#0', 4);
    playGated(G, hook);
    assert.equal(G.turnEconomy.recruit, 2);
  });

  it('a 4-cost card that went Out of Time this turn still counts (the shared view)', () => {
    const hook = findGatedHook(FOUR_OF_A_KIND);
    const G = makeState([hook]);
    (G.cardStats as Record<string, unknown>)['test/filler/out-of-time#0'] = costOnly(4);
    G.turnEconomy.outOfTimePlayedCardIds = ['test/filler/out-of-time#0' as CardExtId];
    playGated(G, hook);
    assert.equal(G.turnEconomy.attack, 2);
  });

  it('Dr. Strange after a 4-cost and a 2-cost → +2', () => {
    const hook = findGatedHook(GRAND_RITUAL);
    const G = makeState([hook]);
    playFiller(G, 'test/filler/four-cost#0', 4);
    playFiller(G, 'test/filler/two-cost#0', 2);
    playGated(G, hook);
    assert.equal(G.turnEconomy.attack, 2);
  });

  it('Dr. Strange after only a 4-cost → none', () => {
    const hook = findGatedHook(GRAND_RITUAL);
    const G = makeState([hook]);
    playFiller(G, 'test/filler/four-cost#0', 4);
    playGated(G, hook);
    assert.equal(G.turnEconomy.attack, 0);
    assert.ok(G.messages.some((message) => message.text.includes('it needs a card costing 2 played this turn')));
  });

  it('Dr. Strange after a 4-cost Hero and a played Sidekick (cost 2) → +2', () => {
    const hook = findGatedHook(GRAND_RITUAL);
    const G = makeState([hook]);
    playFiller(G, 'test/filler/four-cost#0', 4);
    playFiller(G, SIDEKICK_EXT_ID, 2);
    playGated(G, hook);
    assert.equal(G.turnEconomy.attack, 2);
  });

  it('a Sidekick returned to the stack this turn still counts as the 2-cost card', () => {
    const hook = findGatedHook(GRAND_RITUAL);
    const G = makeState([hook]);
    (G.cardStats as Record<string, unknown>)[SIDEKICK_EXT_ID] = costOnly(2);
    playFiller(G, 'test/filler/four-cost#0', 4);
    G.turnEconomy.sidekicksReturnedThisTurn = 1;
    playGated(G, hook);
    assert.equal(G.turnEconomy.attack, 2);
  });
});

// ---------------------------------------------------------------------------
// Case 4 — distinct non-grey Heroes
// ---------------------------------------------------------------------------

describe('WP-745 case 4: Warriors Three counts other non-grey Heroes with different names', () => {
  /**
   * Plays named, classed filler Heroes, then Warriors Three.
   *
   * @param earlier - [card id, name, hero class or '' for grey] per earlier play.
   * @returns The state after Warriors Three's play.
   */
  function playAfter(earlier: [string, string, string][]): LegendaryGameState {
    const hook = findGatedHook(WARRIORS_THREE);
    const G = makeState([hook]);
    (G.cardTraits as Record<string, unknown>)[hook.cardId] = { heroClass: 'strength' };
    (G.cardDisplayData as Record<string, unknown>)[hook.cardId] = { name: 'Three Stand as One' };
    for (const [cardId, name, heroClass] of earlier) {
      if (heroClass !== '') {
        (G.cardTraits as Record<string, unknown>)[cardId] = { heroClass };
      }
      (G.cardDisplayData as Record<string, unknown>)[cardId] = { name };
      playFiller(G, cardId);
    }
    playGated(G, hook);
    return G;
  }

  it('three other non-grey Heroes with three names → +3', () => {
    const G = playAfter([
      ['test/a/alpha#0', 'Alpha', 'tech'],
      ['test/b/beta#0', 'Beta', 'covert'],
      ['test/c/gamma#0', 'Gamma', 'ranged'],
    ]);
    assert.equal(G.turnEconomy.attack, 3);
  });

  it('two copies of one card count once → none', () => {
    const G = playAfter([
      ['test/a/alpha#0', 'Alpha', 'tech'],
      ['test/a/alpha#1', 'Alpha', 'tech'],
      ['test/b/beta#0', 'Beta', 'covert'],
    ]);
    assert.equal(G.turnEconomy.attack, 0);
    assert.ok(G.messages.some((message) => message.text.includes('it needs 3 other non-grey Heroes with different names played this turn')));
  });

  it('a S.H.I.E.L.D. Agent (grey) does not count → none', () => {
    const G = playAfter([
      ['test/a/alpha#0', 'Alpha', 'tech'],
      ['test/b/beta#0', 'Beta', 'covert'],
      [SHIELD_AGENT_EXT_ID, 'S.H.I.E.L.D. Agent', ''],
    ]);
    assert.equal(G.turnEconomy.attack, 0);
  });

  it('Warriors Three never counts itself: two others plus itself → none', () => {
    const G = playAfter([
      ['test/a/alpha#0', 'Alpha', 'tech'],
      ['test/b/beta#0', 'Beta', 'covert'],
    ]);
    assert.equal(G.turnEconomy.attack, 0);
  });
});

// ---------------------------------------------------------------------------
// Case 5 — Rage, driven through the split-card play path
// ---------------------------------------------------------------------------

const GRIEF_ID = 'msis/wanda-vision/grief#0' as CardExtId;
const RAGE_ID = 'msis/wanda-vision/rage#0' as CardExtId;
const KOED_HERO = 'core/spider-man/astonishing-strength#0' as CardExtId;

/**
 * Builds a move context for playCard / resolveSplitFaceChoice.
 *
 * @param G - The game state.
 * @returns The move context.
 */
function makeMoveContext(G: LegendaryGameState): Parameters<typeof playCard>[0] {
  return {
    G,
    ctx: {
      numPlayers: 2, currentPlayer: '0', phase: 'play', turn: 1,
      playOrder: ['0', '1'], playOrderPos: 0, activePlayers: null,
    },
    events: {
      endTurn: mock.fn(), setPhase: mock.fn(), endPhase: mock.fn(), setStage: mock.fn(),
      endStage: mock.fn(), pass: mock.fn(), endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(), Die: mock.fn(), Number: mock.fn(),
    },
    playerID: '0',
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof playCard>[0];
}

/**
 * A match with the Wanda & Vision deck's real hooks, Grief/Rage in hand, and the KO-pile
 * snapshot taken at length 0 (as the turn's onBegin would).
 *
 * @param koPile - The KO pile before the play (all KO'd this turn).
 * @returns The state.
 */
function makeRageState(koPile: CardExtId[]): LegendaryGameState {
  const G = makeState(buildDeckHooks(RAGE));
  G.playerZones['0']!.hand = [GRIEF_ID];
  G.splitFaces = { 'msis/wanda-vision/grief': 'msis/wanda-vision/rage' } as Record<CardExtId, CardExtId>;
  (G.cardStats as Record<string, unknown>)[GRIEF_ID] = costOnly(5);
  (G.cardStats as Record<string, unknown>)[RAGE_ID] = costOnly(5);
  (G.cardTraits as Record<string, unknown>)[KOED_HERO] = { heroClass: 'strength' };
  G.koPileLengthAtTurnStart = 0;
  G.ko = [...koPile];
  return G;
}

/**
 * Plays the Grief/Rage card and chooses the Rage face.
 *
 * @param G - The game state.
 */
function playRage(G: LegendaryGameState): void {
  playCard(makeMoveContext(G), { cardId: GRIEF_ID });
  resolveSplitFaceChoice(makeMoveContext(G) as Parameters<typeof resolveSplitFaceChoice>[0], { face: 'b' });
  assert.deepEqual(G.playerZones['0']!.inPlay, [RAGE_ID], 'the card is in play as its Rage face');
}

describe('WP-745 case 5: Rage waits for a Hero put into the KO pile this turn', () => {
  it('a Hero KO\'d earlier this turn → +2 on play', () => {
    const G = makeRageState([KOED_HERO]);
    playRage(G);
    assert.equal(G.turnEconomy.attack, 2);
    assert.equal(G.deferredConditionalGrants, undefined, 'nothing waits when the gate already passed');
  });

  it('a basic S.H.I.E.L.D. Agent counts as a Hero', () => {
    const G = makeRageState([SHIELD_AGENT_EXT_ID]);
    playRage(G);
    assert.equal(G.turnEconomy.attack, 2);
  });

  it('only a Wound and a Bystander KO\'d → none, and the grant waits', () => {
    const G = makeRageState([WOUND_EXT_ID, BYSTANDER_EXT_ID]);
    playRage(G);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.deferredConditionalGrants?.length, 1, 'Rage waits for the rest of the turn');
    assert.equal(G.deferredConditionalGrants?.[0]?.cardId, RAGE_ID, 'the waiting grant is Rage\'s, not Grief\'s');
  });

  it('Rage played first, then a Hero KO\'d → the waiting grant fires once; a second KO adds nothing', () => {
    const G = makeRageState([]);
    playRage(G);
    assert.equal(G.turnEconomy.attack, 0);
    G.ko = koCard(G.ko, KOED_HERO);
    resolveDeferredHeroGrants(G, playContext);
    assert.equal(G.turnEconomy.attack, 2, 'fires when the KO lands');
    G.ko = koCard(G.ko, KOED_HERO);
    resolveDeferredHeroGrants(G, playContext);
    assert.equal(G.turnEconomy.attack, 2, 'one-shot: a second KO does not grant again');
  });

  it('a Hero KO\'d before the turn-start snapshot (an earlier turn) → none', () => {
    const G = makeRageState([KOED_HERO]);
    G.koPileLengthAtTurnStart = 1;
    playRage(G);
    assert.equal(G.turnEconomy.attack, 0);
  });

  it('no snapshot at all (a match whose hooks never read it) → none', () => {
    const G = makeRageState([KOED_HERO]);
    delete G.koPileLengthAtTurnStart;
    playRage(G);
    assert.equal(G.turnEconomy.attack, 0);
  });
});

// ---------------------------------------------------------------------------
// Case 6 — reused conditions
// ---------------------------------------------------------------------------

const DRAW_FILLER = 'test/filler/draw-one#0' as CardExtId;

/**
 * A synthetic hook for a filler card that draws one card (the real heroEffectDraw path, which
 * counts toward G.turnEconomy.cardsDrawn).
 */
const DRAW_ONE_HOOK = {
  cardId: DRAW_FILLER,
  timing: 'onPlay',
  keywords: ['draw'],
  effects: [{ type: 'draw', magnitude: 1 }],
} as unknown as HeroAbilityHook;

describe('WP-745 case 6: the draw lines wait for the draw count; Black Widow needs 4 Bystanders', () => {
  for (const line of [HAWKEYE, WOLVERINE, CAPTAIN_MARVEL]) {
    it(`${line.cardSlug}: no draw → none and the grant waits; after a draw it fires`, () => {
      const hook = findGatedHook(line);
      const G = makeState([hook, DRAW_ONE_HOOK]);
      playGated(G, hook);
      assert.equal(grantOf(G, line), 0);
      assert.equal(G.deferredConditionalGrants?.length, 1, 'the line waits');
      applyCardPlay(G, playContext as unknown as Parameters<typeof applyCardPlay>[1], '0', DRAW_FILLER);
      assert.equal(G.turnEconomy.cardsDrawn, 1, 'the draw counted');
      resolveDeferredHeroGrants(G, playContext);
      assert.equal(grantOf(G, line), line.effect.magnitude);
    });
  }

  it('Gamora needs two draws', () => {
    const hook = findGatedHook(GAMORA);
    const G = makeState([hook]);
    G.turnEconomy.cardsDrawn = 1;
    playGated(G, hook);
    assert.equal(G.turnEconomy.attack, 0);
    G.turnEconomy.cardsDrawn = 2;
    resolveDeferredHeroGrants(G, playContext);
    assert.equal(G.turnEconomy.attack, 2);
  });

  for (const line of [BLACK_WIDOW_CO2E, BLACK_WIDOW_WTIF]) {
    it(`${line.heroDeckId}: 4 Bystanders in VP → +2; 3 → none and no deferral`, () => {
      const hook = findGatedHook(line);
      const withFour = makeState([hook]);
      withFour.playerZones['0']!.victory = [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID];
      playGated(withFour, hook);
      assert.equal(grantOf(withFour, line), 2);

      const withThree = makeState([hook]);
      withThree.playerZones['0']!.victory = [BYSTANDER_EXT_ID, BYSTANDER_EXT_ID, BYSTANDER_EXT_ID];
      playGated(withThree, hook);
      assert.equal(grantOf(withThree, line), 0);
      assert.equal(withThree.deferredConditionalGrants, undefined, 'an on-play gate records no deferral');
    });
  }
});

// ---------------------------------------------------------------------------
// Cases 7 + 8 — oracle safety and the turn-start snapshot
// ---------------------------------------------------------------------------

/**
 * Sets up a real match through LegendaryGame.setup and returns it with its play-phase onBegin.
 *
 * @returns The state and a function that runs one turn start.
 */
function makeRealMatch(): { gameState: LegendaryGameState; beginTurn: () => void } {
  const configuration: MatchConfiguration = {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
  const mockContext = makeMockCtx({ numPlayers: 2 });
  const gameState = LegendaryGame.setup!(
    mockContext as Parameters<NonNullable<typeof LegendaryGame.setup>>[0],
    configuration,
  );
  const playPhase = (
    LegendaryGame.phases as Record<string, { turn?: { onBegin?: (context: unknown) => void } }>
  ).play;
  const onBegin = playPhase?.turn?.onBegin;
  assert.notEqual(onBegin, undefined, 'play phase must define a turn.onBegin hook');
  const beginContext = {
    G: gameState,
    ctx: { currentPlayer: '0', numPlayers: 2, phase: 'play', turn: 1 },
    random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
    events: { setPhase: (): void => {}, endTurn: (): void => {} },
  };
  return { gameState, beginTurn: () => onBegin!(beginContext) };
}

describe('WP-745 case 7: oracle safety — no Rage hook, no snapshot key', () => {
  it('the real turn.onBegin never writes koPileLengthAtTurnStart without a reading hook', () => {
    const { gameState, beginTurn } = makeRealMatch();
    gameState.ko = koCard(gameState.ko, KOED_HERO);
    beginTurn();
    assert.equal('koPileLengthAtTurnStart' in gameState, false);
  });

  it('applyOnBeginParity never writes it without a reading hook', () => {
    const G = makeState([findGatedHook(DR_OCTOPUS)]);
    applyOnBeginParity(G, '0');
    assert.equal('koPileLengthAtTurnStart' in G, false);
  });
});

describe('WP-745 case 8: the turn start re-takes the KO-pile snapshot when Rage is in the match', () => {
  it('the real turn.onBegin sets it to the KO pile length', () => {
    const { gameState, beginTurn } = makeRealMatch();
    gameState.heroAbilityHooks = [...gameState.heroAbilityHooks, findGatedHook(RAGE)];
    gameState.ko = koCard(koCard(gameState.ko, KOED_HERO), WOUND_EXT_ID);
    beginTurn();
    assert.equal(gameState.koPileLengthAtTurnStart, gameState.ko.length);
    gameState.ko = koCard(gameState.ko, KOED_HERO);
    beginTurn();
    assert.equal(gameState.koPileLengthAtTurnStart, gameState.ko.length, 'overwritten every turn start');
  });

  it('applyOnBeginParity sets it the same way', () => {
    const G = makeState([findGatedHook(RAGE)]);
    G.ko = [KOED_HERO, WOUND_EXT_ID];
    applyOnBeginParity(G, '0');
    assert.equal(G.koPileLengthAtTurnStart, 2);
  });
});
