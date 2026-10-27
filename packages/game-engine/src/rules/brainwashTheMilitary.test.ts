/**
 * Brainwash the Military (WP-823 / D-24756) — S.H.I.E.L.D. Officers as Villains in
 * the Villain Deck, the Traitor Battalion Twists, gain-as-a-Hero on defeat, and the
 * "When 5 S.H.I.E.L.D. Officers escape" Evil Wins.
 *
 * Builds full G from the shipped data/cards/ca75.json (read from the repo root, the
 * clashMonsterPit.test.ts precedent) so the scheme's twist count and the villains
 * are the real card data.
 *
 * node:test + node:assert only. No boardgame.io import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { checkNoCardInMultipleZones } from '../invariants/gameRules.checks.js';
import { SCHEME_TWIST_RESOLVERS } from './schemeTwistResolvers.js';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import { applyEscapedPileResourceLoss } from './schemeResourceLoss.js';
import {
  isTwistLossSuppressed,
  resolveSchemeLossKind,
  resolveSchemeLossProgress,
  resolveSchemeLossThreshold,
} from './schemeLossProgress.js';
import {
  BRAINWASH_THE_MILITARY_SCHEME_ID,
  brainwashedOfficerExtId,
  resolveBrainwashedOfficerCount,
} from './brainwashTheMilitary.logic.js';
import { DEFAULT_IMPLEMENTATION_MAP } from './ruleRuntime.impl.js';
import { resolveFightCost } from '../economy/economy.resolve.js';
import { defeatCityVillainCore } from '../moves/fightVillain.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { TRAITOR_BATTALION_TWISTS } from '../types.js';
import type { LegendaryGameState, SetupContext } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';

const here = dirname(fileURLToPath(import.meta.url));
const ca75SetData = JSON.parse(
  readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', 'ca75.json'), 'utf8'),
) as {
  villains: Array<{ slug: string; cards: Array<{ slug: string; abilities?: string[] }> }>;
};

const OFFICER_TOKEN = 'pile-shield-officer' as CardExtId;
const TWIST_ID = 'scheme-twist-brainwash-the-military-00' as CardExtId;
const OTHER_SCHEME_ID = 'ca75/change-the-outcome-of-wwii';

/**
 * A setup registry over the real ca75 set: getSet serves ca75.json, and listCards
 * serves one flat villain card per printed villain (the shape the keyword and
 * display builders read).
 */
function buildCa75Registry() {
  const flatVillains: Array<{ key: string } & Record<string, unknown>> = [];
  for (const group of ca75SetData.villains) {
    for (const card of group.cards) {
      flatVillains.push({
        key: `ca75-villain-${group.slug}-${card.slug}`,
        cardType: 'villain',
        slug: card.slug,
        setAbbr: 'ca75',
        abilities: card.abilities ?? [],
      });
    }
  }
  return {
    listCards: () => flatVillains,
    listSets: () => [{ abbr: 'ca75' }],
    getSet: (abbr: string) => (abbr === 'ca75' ? ca75SetData : undefined),
  };
}

/** A ca75 loadout; the scheme and the Officer Stack size are the parameters under test. */
function buildCa75Config(schemeId: string, officersCount: number): MatchSetupConfig {
  return {
    schemeId,
    mastermindId: 'ca75/arnim-zola',
    villainGroupIds: ['ca75/masters-of-evil-wwii'],
    henchmanGroupIds: [],
    heroDeckIds: ['ca75/agent-x-13', 'ca75/captain-america-falcon', 'ca75/winter-soldier'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount,
    sidekicksCount: 0,
  };
}

/** Builds a G for the scheme with a 30-card Officer Stack and 2 players. */
function buildState(schemeId: string = BRAINWASH_THE_MILITARY_SCHEME_ID): LegendaryGameState {
  return buildInitialGameState(
    buildCa75Config(schemeId, 30),
    buildCa75Registry(),
    makeMockCtx({ numPlayers: 2 }),
  );
}

/** Counts every Shuffle call a Brainwash setup build makes with the given Officer Stack. */
function countSetupShuffles(officersCount: number): number {
  const mockCtx = makeMockCtx({ numPlayers: 2 });
  let shuffleCount = 0;
  const countingCtx: SetupContext = {
    ...mockCtx,
    random: {
      Shuffle: <T,>(deck: T[]): T[] => {
        shuffleCount = shuffleCount + 1;
        return mockCtx.random.Shuffle(deck);
      },
    },
  };
  buildInitialGameState(buildCa75Config(BRAINWASH_THE_MILITARY_SCHEME_ID, officersCount), buildCa75Registry(), countingCtx);
  return shuffleCount;
}

const identityRandom = { Shuffle: <T,>(deck: T[]) => [...deck] };

/** A reveal context with an identity shuffle. */
function makeRevealContext(): RevealContext {
  return { random: identityRandom, ctx: { currentPlayer: '0', turn: 1 } };
}

/** Runs the Brainwash the Military twist resolver once. */
function runTwist(gameState: LegendaryGameState): void {
  SCHEME_TWIST_RESOLVERS['brainwash-the-military'](
    gameState,
    makeRevealContext(),
    DEFAULT_IMPLEMENTATION_MAP,
    {},
    TWIST_ID,
  );
}

/** Takes a card out of the Villain Deck (so it can be placed elsewhere). */
function removeFromVillainDeck(gameState: LegendaryGameState, cardId: CardExtId): void {
  gameState.villainDeck.deck = gameState.villainDeck.deck.filter((deckCardId) => deckCardId !== cardId);
}

/** Moves a Villain Deck card into a City space. */
function placeInCity(gameState: LegendaryGameState, cardId: CardExtId, cityIndex: number): void {
  removeFromVillainDeck(gameState, cardId);
  const city = [...gameState.city] as typeof gameState.city;
  city[cityIndex] = cardId;
  gameState.city = city;
}

/** Puts a Villain Deck card on top of the Villain Deck. */
function putOnTop(gameState: LegendaryGameState, cardId: CardExtId): void {
  removeFromVillainDeck(gameState, cardId);
  gameState.villainDeck.deck = [cardId, ...gameState.villainDeck.deck];
}

/** The first printed (non-converted) Villain in the Villain Deck. */
function firstPrintedVillain(gameState: LegendaryGameState): CardExtId {
  for (const cardId of gameState.villainDeck.deck) {
    if (gameState.villainDeckCardTypes[cardId] === 'villain' && gameState.convertedVillainOrigins?.[cardId] === undefined) {
      return cardId;
    }
  }
  throw new Error('The ca75 test Villain Deck has no printed Villain; check the loadout.');
}

/** The text of every log line. */
function logTexts(gameState: LegendaryGameState): string[] {
  return gameState.messages.map((entry) => entry.text);
}

describe('WP-823 Brainwash the Military — setup (D-24756)', () => {
  it('B1: 12 Officers join the Villain Deck as converted Villains and the Officer Stack shrinks to 18', () => {
    const gameState = buildState();
    const officerIds = gameState.villainDeck.deck.filter((cardId) => cardId.startsWith('shield-officer-villain-deck-'));
    const expectedIds: CardExtId[] = [];
    for (let index = 0; index < 12; index++) {
      expectedIds.push(brainwashedOfficerExtId(index));
    }
    assert.deepEqual([...officerIds].sort(), expectedIds);
    for (const officerId of officerIds) {
      assert.equal(gameState.villainDeckCardTypes[officerId], 'villain', officerId);
      assert.equal(gameState.convertedVillainOrigins?.[officerId], 'shield-officer', officerId);
      assert.equal(gameState.cardDisplayData[officerId]?.name, gameState.cardDisplayData[OFFICER_TOKEN]?.name, officerId);
      assert.equal(gameState.cardDisplayData[officerId]?.extId, officerId);
    }
    const twistCount = gameState.villainDeck.deck.filter((cardId) => gameState.villainDeckCardTypes[cardId] === 'scheme-twist').length;
    assert.equal(twistCount, 7);
    assert.equal(gameState.piles.officers.length, 18);
    assert.equal(gameState.counters[TRAITOR_BATTALION_TWISTS], undefined);
    checkNoCardInMultipleZones(gameState);
  });

  it('B1: adding the Officers draws nothing more at random than the same setup with no Officers', () => {
    // why: with officersCount 0 the scheme adds no Officers and everything else is
    // identical, so equal Shuffle counts prove the Officers cost no extra draw.
    assert.equal(countSetupShuffles(30), countSetupShuffles(0));
  });

  it('B2: another scheme gets no Officers and a full Officer Stack', () => {
    const gameState = buildState(OTHER_SCHEME_ID);
    for (const cardId of gameState.villainDeck.deck) {
      assert.equal(cardId.startsWith('shield-officer-villain-deck-'), false, cardId);
    }
    assert.equal(gameState.piles.officers.length, 30);
    assert.equal(gameState.convertedVillainOrigins, undefined);
  });

  it('B3: the Officer count is 12, capped by the Officer Stack, and 0 for other schemes', () => {
    assert.equal(resolveBrainwashedOfficerCount(BRAINWASH_THE_MILITARY_SCHEME_ID, 30), 12);
    assert.equal(resolveBrainwashedOfficerCount(BRAINWASH_THE_MILITARY_SCHEME_ID, 5), 5);
    assert.equal(resolveBrainwashedOfficerCount(BRAINWASH_THE_MILITARY_SCHEME_ID, 0), 0);
    assert.equal(resolveBrainwashedOfficerCount(BRAINWASH_THE_MILITARY_SCHEME_ID, -1), 0);
    assert.equal(resolveBrainwashedOfficerCount(OTHER_SCHEME_ID, 30), 0);
  });
});

describe('WP-823 Brainwash the Military — Officer Attack (D-24756)', () => {
  it('A1: an Officer has 3 Attack plus the Traitor Battalion', () => {
    const gameState = buildState();
    const officerId = brainwashedOfficerExtId(0);
    placeInCity(gameState, officerId, 2);
    assert.equal(resolveFightCost(gameState, officerId), 3);
    gameState.counters[TRAITOR_BATTALION_TWISTS] = 1;
    assert.equal(resolveFightCost(gameState, officerId), 4);
    gameState.counters[TRAITOR_BATTALION_TWISTS] = 6;
    assert.equal(resolveFightCost(gameState, officerId), 9);
  });

  it('A2: a printed Villain keeps its own fight cost', () => {
    const gameState = buildState();
    const villainId = firstPrintedVillain(gameState);
    placeInCity(gameState, villainId, 2);
    const printedCost = resolveFightCost(gameState, villainId);
    gameState.counters[TRAITOR_BATTALION_TWISTS] = 6;
    assert.equal(resolveFightCost(gameState, villainId), printedCost);
  });
});

describe('WP-823 Brainwash the Military — gain it as a Hero (D-24756)', () => {
  it('D1: a defeated Officer goes to the discard as a S.H.I.E.L.D. Officer, not the Victory Pile', () => {
    const gameState = buildState();
    const officerId = brainwashedOfficerExtId(3);
    placeInCity(gameState, officerId, 2);
    const victoryBefore = [...gameState.playerZones['0']!.victory];
    const stackBefore = gameState.piles.officers.length;

    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });

    assert.equal(gameState.city[2], null);
    const discard = gameState.playerZones['0']!.discard;
    assert.equal(discard[discard.length - 1], OFFICER_TOKEN);
    assert.deepEqual(gameState.playerZones['0']!.victory, victoryBefore);
    assert.equal(gameState.convertedVillainOrigins?.[officerId], undefined);
    assert.equal(gameState.piles.officers.length, stackBefore);
    for (const zones of Object.values(gameState.playerZones)) {
      assert.equal(zones.discard.includes(officerId), false);
      assert.equal(zones.victory.includes(officerId), false);
    }
    assert.equal(gameState.escapedPile.includes(officerId), false);
    const officerName = gameState.cardDisplayData[OFFICER_TOKEN]?.name;
    assert.ok(logTexts(gameState).includes(
      `Player 0 defeated ${officerName} (${officerId}) and gained it as a Hero into their discard pile.`,
    ));
    const fightEvents = gameState.notableEvents.filter((event) => event.type === 'fightResolved');
    const lastFight = fightEvents[fightEvents.length - 1];
    assert.ok(lastFight !== undefined && lastFight.type === 'fightResolved');
    assert.ok(lastFight.narrative.includes("gained the Hero into the active player's discard pile"));
    checkNoCardInMultipleZones(gameState);
  });

  it('D2: a printed Villain still goes to the Victory Pile with no gain clause', () => {
    const gameState = buildState();
    const villainId = firstPrintedVillain(gameState);
    placeInCity(gameState, villainId, 2);

    defeatCityVillainCore(gameState, { currentPlayer: '0', turn: 1 }, 2, { random: identityRandom });

    assert.ok(gameState.playerZones['0']!.victory.includes(villainId));
    assert.equal(gameState.playerZones['0']!.discard.includes(OFFICER_TOKEN), false);
    const fightEvents = gameState.notableEvents.filter((event) => event.type === 'fightResolved');
    const lastFight = fightEvents[fightEvents.length - 1];
    assert.ok(lastFight !== undefined && lastFight.type === 'fightResolved');
    assert.equal(lastFight.narrative.includes('gained the Hero'), false);
  });
});

describe('WP-823 Brainwash the Military — Twists (D-24756)', () => {
  it('T1: Twist 1 stacks the Traitor Battalion and plays another card', () => {
    const gameState = buildState();
    const villainId = firstPrintedVillain(gameState);
    putOnTop(gameState, villainId);

    runTwist(gameState);

    assert.equal(gameState.counters[TRAITOR_BATTALION_TWISTS], 1);
    assert.equal(gameState.city[0], villainId);
    assert.ok(logTexts(gameState).includes(
      '[Brainwash the Military] Twist 1 joins the Traitor Battalion next to the Scheme — S.H.I.E.L.D. Officers now have 4 Attack. Another card is played from the Villain Deck.',
    ));
    const twistEvents = gameState.notableEvents.filter((event) => event.type === 'schemeTwistResolved');
    assert.equal(twistEvents.length, 1);
    const twistEvent = twistEvents[0];
    assert.ok(twistEvent !== undefined && twistEvent.type === 'schemeTwistResolved');
    assert.equal(twistEvent.resolverKey, 'brainwashTheMilitary');
  });

  it('T2: Twist 6 makes the played Officer a 9-Attack Villain', () => {
    const gameState = buildState();
    gameState.counters[TRAITOR_BATTALION_TWISTS] = 5;
    const officerId = brainwashedOfficerExtId(0);
    putOnTop(gameState, officerId);

    runTwist(gameState);

    assert.equal(gameState.counters[TRAITOR_BATTALION_TWISTS], 6);
    assert.equal(gameState.city[0], officerId);
    assert.equal(resolveFightCost(gameState, officerId), 9);
  });

  it('T3: a Twist played by Twist 6 is Twist 7 (numbered from the stack, not schemeTwistCount)', () => {
    const gameState = buildState();
    gameState.counters[TRAITOR_BATTALION_TWISTS] = 5;
    gameState.counters.schemeTwistCount = 5;
    const officerId = brainwashedOfficerExtId(0);
    placeInCity(gameState, officerId, 3);
    const nestedTwistId = gameState.villainDeck.deck.find(
      (cardId) => gameState.villainDeckCardTypes[cardId] === 'scheme-twist' && cardId !== TWIST_ID,
    );
    assert.ok(nestedTwistId !== undefined);
    putOnTop(gameState, nestedTwistId);

    runTwist(gameState);

    assert.equal(gameState.counters[TRAITOR_BATTALION_TWISTS], 6);
    assert.equal(gameState.city[3], null);
    assert.ok(gameState.escapedPile.includes(officerId));
    assert.ok(logTexts(gameState).includes('[Brainwash the Military] Twist 7: all 1 S.H.I.E.L.D. Officer(s) in the City escape.'));
  });

  it('T4: Twist 7 makes every Officer in the City escape, Bridge first, and leaves other Villains', () => {
    const gameState = buildState();
    gameState.counters[TRAITOR_BATTALION_TWISTS] = 6;
    const bridgeOfficer = brainwashedOfficerExtId(0);
    const bankOfficer = brainwashedOfficerExtId(1);
    const villainId = firstPrintedVillain(gameState);
    placeInCity(gameState, bridgeOfficer, 4);
    placeInCity(gameState, bankOfficer, 1);
    placeInCity(gameState, villainId, 2);
    const escapedBefore = gameState.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0;
    const deckLengthBefore = gameState.villainDeck.deck.length;
    const proceduresBefore = (gameState.pendingEscapeProcedures ?? []).length;

    runTwist(gameState);

    // why: each Officer runs the full escape (D-24656), so each owes its own HQ KO
    // through the escape procedure, Bridge first.
    const newProcedures = (gameState.pendingEscapeProcedures ?? []).slice(proceduresBefore);
    assert.deepEqual(
      newProcedures.map((procedure) => procedure.escapedCardId),
      [bridgeOfficer, bankOfficer],
    );
    assert.equal(gameState.counters[TRAITOR_BATTALION_TWISTS], 6);
    assert.equal(gameState.city[4], null);
    assert.equal(gameState.city[1], null);
    assert.equal(gameState.city[2], villainId);
    const bridgePosition = gameState.escapedPile.indexOf(bridgeOfficer);
    const bankPosition = gameState.escapedPile.indexOf(bankOfficer);
    assert.ok(bridgePosition >= 0 && bankPosition > bridgePosition);
    assert.equal(gameState.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS], escapedBefore + 2);
    assert.equal(gameState.villainDeck.deck.length, deckLengthBefore);
    assert.ok(logTexts(gameState).includes('[Brainwash the Military] Twist 7: all 2 S.H.I.E.L.D. Officer(s) in the City escape.'));
  });

  it('T5: Twist 7 with no Officer in the City says so and changes nothing', () => {
    const gameState = buildState();
    gameState.counters[TRAITOR_BATTALION_TWISTS] = 6;
    const cityBefore = [...gameState.city];
    const escapedBefore = [...gameState.escapedPile];

    runTwist(gameState);

    assert.deepEqual([...gameState.city], cityBefore);
    assert.deepEqual(gameState.escapedPile, escapedBefore);
    assert.ok(logTexts(gameState).includes('[Brainwash the Military] Twist 7: no S.H.I.E.L.D. Officer is in the City, so none escapes.'));
  });

  it('T6: a Twist with an empty Villain Deck still stacks', () => {
    const gameState = buildState();
    gameState.counters[TRAITOR_BATTALION_TWISTS] = 2;
    gameState.villainDeck.deck = [];
    gameState.villainDeck.discard = [];

    runTwist(gameState);

    assert.equal(gameState.counters[TRAITOR_BATTALION_TWISTS], 3);
    assert.ok(logTexts(gameState).includes('Villain deck exhausted after playing 0 of 1 card(s).'));
  });
});

describe('WP-823 Brainwash the Military — Evil Wins (D-24756)', () => {
  it('L1: the fifth escaped Officer loses the game', () => {
    const gameState = buildState();
    for (let index = 0; index < 4; index++) {
      const officerId = brainwashedOfficerExtId(index);
      removeFromVillainDeck(gameState, officerId);
      gameState.escapedPile = [...gameState.escapedPile, officerId];
    }
    gameState.counters[TRAITOR_BATTALION_TWISTS] = 6;
    placeInCity(gameState, brainwashedOfficerExtId(4), 4);

    runTwist(gameState);

    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS], 1);
    assert.ok(logTexts(gameState).includes('Scheme loss triggered — 5 S.H.I.E.L.D. Officers escaped (threshold 5).'));
  });

  it('L2: escaped printed Villains do not count toward the five', () => {
    const gameState = buildState();
    for (let index = 0; index < 4; index++) {
      const officerId = brainwashedOfficerExtId(index);
      removeFromVillainDeck(gameState, officerId);
      gameState.escapedPile = [...gameState.escapedPile, officerId];
    }
    const printedVillains = gameState.villainDeck.deck
      .filter((cardId) => gameState.villainDeckCardTypes[cardId] === 'villain' && gameState.convertedVillainOrigins?.[cardId] === undefined)
      .slice(0, 3);
    assert.equal(printedVillains.length, 3);
    for (const villainId of printedVillains) {
      removeFromVillainDeck(gameState, villainId);
      gameState.escapedPile = [...gameState.escapedPile, villainId];
    }

    applyEscapedPileResourceLoss(gameState);

    assert.equal(gameState.counters[ENDGAME_CONDITIONS.SCHEME_LOSS] ?? 0, 0);
  });

  it('L3: the twist proxy is off and the meter counts escaped Officers out of 5', () => {
    const gameState = buildState();
    assert.equal(isTwistLossSuppressed(gameState), true);
    assert.equal(resolveSchemeLossKind(gameState), 'escaped-officer');
    assert.equal(resolveSchemeLossProgress(gameState), 0);
    assert.equal(resolveSchemeLossThreshold(gameState), 5);
    for (let index = 0; index < 2; index++) {
      const officerId = brainwashedOfficerExtId(index);
      removeFromVillainDeck(gameState, officerId);
      gameState.escapedPile = [...gameState.escapedPile, officerId];
    }
    assert.equal(resolveSchemeLossProgress(gameState), 2);
    assert.equal(resolveSchemeLossThreshold(gameState), 5);
  });

  it('L4: the scheme config is the locked entry', () => {
    assert.deepEqual(SCHEME_TWIST_CONFIGS.get(BRAINWASH_THE_MILITARY_SCHEME_ID), {
      schemeId: 'ca75/brainwash-the-military',
      resolverId: 'brainwash-the-military',
      params: {},
      lossThreshold: 7,
      resourceLossCondition: {
        kind: 'escaped-converted-count',
        origin: 'shield-officer',
        threshold: 5,
      },
    });
  });
});
