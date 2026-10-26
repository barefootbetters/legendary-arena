/**
 * Clash of the Monsters Unleashed (D-24736) — Monster Pit setup, the Twist 3-10
 * Gladiator resolver, and the "Wound Stack or Monster Pit runs out" Evil Wins.
 *
 * Builds full G from the shipped data/cards/chmp.json (read from the repo root,
 * the masterStrikeOrAmbushCondition.test.ts precedent) so the Monsters, their
 * printed Attack and their Ambush text are the real card data.
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
import { applyPileDepletionResourceLoss } from './schemeResourceLoss.js';
import { resolveSchemeLossKind, isTwistLossSuppressed } from './schemeLossProgress.js';
import {
  CLASH_SCHEME_ID,
  MONSTER_PIT_SETUP_SIZE,
  chooseGladiator,
  isMonsterPitCard,
  resolveEffectiveVillainGroupIds,
} from './clashMonsterPit.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';

const here = dirname(fileURLToPath(import.meta.url));
const chmpSetData = JSON.parse(
  readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', 'chmp.json'), 'utf8'),
) as {
  villains: Array<{ slug: string; cards: Array<{ slug: string; abilities?: string[] }> }>;
};

const GOOM = 'chmp-villain-monsters-unleashed-goom-00' as CardExtId;
const TRULL = 'chmp-villain-monsters-unleashed-trull-the-unhuman-00' as CardExtId;
const ZZUTAK = 'chmp-villain-monsters-unleashed-zzutak-00' as CardExtId;
const THE_WRECKER = 'chmp-villain-wrecking-crew-the-wrecker-00' as CardExtId;
const PILEDRIVER = 'chmp-villain-wrecking-crew-piledriver-00' as CardExtId;

/**
 * A setup registry over the real chmp set: getSet serves chmp.json, and
 * listCards serves one flat villain card per printed villain (the shape the
 * keyword and display builders read).
 */
function buildChmpRegistry() {
  const flatVillains: Array<Record<string, unknown>> = [];
  for (const group of chmpSetData.villains) {
    for (const card of group.cards) {
      flatVillains.push({
        key: `chmp-villain-${group.slug}-${card.slug}`,
        cardType: 'villain',
        slug: card.slug,
        setAbbr: 'chmp',
        abilities: card.abilities ?? [],
      });
    }
  }
  return {
    listCards: () => flatVillains,
    listSets: () => [{ abbr: 'chmp' }],
    getSet: (abbr: string) => (abbr === 'chmp' ? chmpSetData : undefined),
  };
}

/** A chmp loadout; the scheme and villain groups are the parameters under test. */
function buildChmpConfig(schemeId: string, villainGroupIds: string[]): MatchSetupConfig {
  return {
    schemeId,
    mastermindId: 'chmp/fin-fang-foom',
    villainGroupIds,
    henchmanGroupIds: [],
    heroDeckIds: ['chmp/gwenpool', 'chmp/ms-marvel', 'chmp/nova'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

/** Builds a Clash G at the given player count. */
function buildClashState(numPlayers: number): LegendaryGameState {
  return buildInitialGameState(
    buildChmpConfig(CLASH_SCHEME_ID, ['chmp/wrecking-crew']),
    buildChmpRegistry(),
    makeMockCtx({ numPlayers }),
  );
}

const identityRandom = { Shuffle: <T,>(deck: T[]) => [...deck] };

/** A reveal context with an identity shuffle. */
function makeRevealContext(): RevealContext {
  return { random: identityRandom, ctx: { currentPlayer: '0' } };
}

/**
 * Runs the Clash twist resolver as twist number `twistNumber` (the dispatcher raises
 * the counter before the resolver runs, D-24775, so the counter is set to twistNumber).
 */
function runClashTwist(gameState: LegendaryGameState, twistNumber: number): void {
  gameState.counters.schemeTwistCount = twistNumber;
  SCHEME_TWIST_RESOLVERS['clash-monster-pit'](
    gameState,
    makeRevealContext(),
    {},
    {},
    'scheme-twist-clash-of-the-monsters-unleashed-00' as CardExtId,
  );
}

/**
 * Puts villain cards into a player's Victory Pile, taking them out of the
 * Villain Deck and the Monster Pit first so each card stays in one zone.
 */
function setVictoryPile(gameState: LegendaryGameState, playerId: string, cardIds: CardExtId[]): void {
  gameState.villainDeck.deck = gameState.villainDeck.deck.filter((cardId) => !cardIds.includes(cardId));
  gameState.monsterPit = (gameState.monsterPit ?? []).filter((cardId) => !cardIds.includes(cardId));
  gameState.playerZones[playerId]!.victory = [...cardIds];
}

/** Counts the Wounds in a player's discard pile. */
function countWounds(gameState: LegendaryGameState, playerId: string): number {
  let woundCount = 0;
  for (const cardId of gameState.playerZones[playerId]!.discard) {
    if (cardId.includes('wound')) {
      woundCount = woundCount + 1;
    }
  }
  return woundCount;
}

/** Joins the game log into one string for substring assertions. */
function logText(gameState: LegendaryGameState): string {
  return gameState.messages.map((entry) => entry.text).join('\n');
}

describe('Clash of the Monsters Unleashed setup (D-24736)', () => {
  for (const [numPlayers, expectedWounds] of [[1, 6], [2, 12], [4, 24], [5, 30]] as const) {
    it(`a ${numPlayers}-player Clash match builds a ${expectedWounds}-Wound Stack (6 per player)`, () => {
      const gameState = buildClashState(numPlayers);
      assert.equal(gameState.piles.wounds.length, expectedWounds);
    });
  }

  it('builds an 8-card Monster Pit from Monsters Unleashed, out of the Villain Deck', () => {
    const gameState = buildClashState(2);
    const monsterPit = gameState.monsterPit ?? [];
    assert.equal(monsterPit.length, MONSTER_PIT_SETUP_SIZE);
    for (const cardId of monsterPit) {
      assert.ok(isMonsterPitCard(cardId), `${cardId} is a Monsters Unleashed card`);
      assert.equal(gameState.villainDeckCardTypes[cardId], 'villain', `${cardId} stays typed 'villain'`);
      assert.ok(gameState.cardStats[cardId], `${cardId} has a cardStats entry`);
      assert.ok(gameState.cardDisplayData[cardId], `${cardId} has display data`);
    }
    assert.equal(
      gameState.villainDeck.deck.some((cardId) => isMonsterPitCard(cardId)),
      false,
      'no Monster is left in the Villain Deck',
    );
    assert.equal(gameState.cardStats[GOOM]!.fightCost, 6, 'Goom prints 6 Attack');
    assert.doesNotThrow(() => checkNoCardInMultipleZones(gameState));
  });

  it('keeps the loadout villain groups in G.selection and builds the chosen group into the deck', () => {
    const gameState = buildClashState(2);
    assert.deepEqual([...gameState.selection.villainGroupIds], ['chmp/wrecking-crew']);
    assert.ok(gameState.villainDeck.deck.includes(THE_WRECKER), 'the Wrecking Crew is in the Villain Deck');
    const twistCount = gameState.villainDeck.deck.filter((cardId) => cardId.startsWith('scheme-twist-')).length;
    assert.equal(twistCount, 10, 'Clash prints 10 Twists (D-24735)');
  });

  it('does not add the group twice when the loadout already picked Monsters Unleashed', () => {
    assert.deepEqual(
      resolveEffectiveVillainGroupIds(CLASH_SCHEME_ID, ['chmp/monsters-unleashed']),
      ['chmp/monsters-unleashed'],
    );
    const gameState = buildInitialGameState(
      buildChmpConfig(CLASH_SCHEME_ID, ['chmp/monsters-unleashed', 'chmp/wrecking-crew']),
      buildChmpRegistry(),
      makeMockCtx({ numPlayers: 2 }),
    );
    assert.equal(gameState.monsterPit?.length, MONSTER_PIT_SETUP_SIZE);
  });

  it('another scheme gets no Monster Pit and its requested Wound Stack', () => {
    const gameState = buildInitialGameState(
      buildChmpConfig('chmp/hypnotize-every-human', ['chmp/wrecking-crew']),
      buildChmpRegistry(),
      makeMockCtx({ numPlayers: 2 }),
    );
    assert.equal('monsterPit' in gameState, false, 'the Pit key is omitted');
    assert.equal(gameState.piles.wounds.length, 30);
    assert.equal(gameState.villainDeck.deck.some((cardId) => isMonsterPitCard(cardId)), false);
    assert.deepEqual(
      resolveEffectiveVillainGroupIds('chmp/hypnotize-every-human', ['chmp/wrecking-crew']),
      ['chmp/wrecking-crew'],
    );
  });
});

describe('Clash Twist 3-10: Gladiators against the Monster Pit (D-24736)', () => {
  it('Twists 1 and 2 leave the Monster Pit shut', () => {
    const gameState = buildClashState(2);
    runClashTwist(gameState, 1);
    runClashTwist(gameState, 2);
    assert.equal(gameState.monsterPit?.length, MONSTER_PIT_SETUP_SIZE);
    assert.ok(logText(gameState).includes('the Monster Pit stays shut'));
  });

  it('Twist 3: the top Monster enters the city; a stronger Gladiator holds, no Gladiator gains a Wound', () => {
    const gameState = buildClashState(2);
    gameState.monsterPit = [GOOM, TRULL];
    setVictoryPile(gameState, '0', [THE_WRECKER]);
    setVictoryPile(gameState, '1', []);
    const bystandersBefore = gameState.piles.bystanders.length;

    runClashTwist(gameState, 3);

    assert.deepEqual(gameState.monsterPit, [TRULL], 'the top Monster left the Pit');
    assert.equal(gameState.city[0], GOOM, 'Goom entered the city');
    // why: Goom's printed "Ambush: Goom captures a Bystander" fires only through the
    // reveal pipeline — this proves the Monster entered as a full Villain.
    assert.equal(gameState.attachedBystanders[GOOM]?.length, 1, "Goom's Ambush captured a Bystander");
    assert.equal(gameState.piles.bystanders.length, bystandersBefore - 1);
    assert.equal(countWounds(gameState, '0'), 0, 'The Wrecker (7) holds against Goom (6)');
    assert.equal(countWounds(gameState, '1'), 1, 'no Gladiator gains a Wound');
    assert.doesNotThrow(() => checkNoCardInMultipleZones(gameState));
    const lastEvent = gameState.notableEvents[gameState.notableEvents.length - 1] as { resolverKey?: string };
    assert.equal(lastEvent.resolverKey, 'clashMonsterPit');
  });

  it('a weaker Gladiator gains a Wound; an equal one holds', () => {
    const gameState = buildClashState(2);
    setVictoryPile(gameState, '0', [PILEDRIVER]);
    setVictoryPile(gameState, '1', [PILEDRIVER.replace('-00', '-01') as CardExtId, TRULL]);
    gameState.monsterPit = [ZZUTAK];

    runClashTwist(gameState, 4);

    assert.equal(countWounds(gameState, '0'), 1, 'Piledriver (6) is weaker than Zzutak (9)');
    assert.equal(countWounds(gameState, '1'), 1, 'Trull (8) is also weaker than Zzutak (9)');
  });

  it('chooses the highest printed Attack as the Gladiator', () => {
    const gameState = buildClashState(2);
    setVictoryPile(gameState, '0', [PILEDRIVER, ZZUTAK, THE_WRECKER]);
    assert.deepEqual(chooseGladiator(gameState, '0'), { cardId: ZZUTAK, printedAttack: 9 });
    setVictoryPile(gameState, '1', []);
    assert.equal(chooseGladiator(gameState, '1'), null);
  });

  it('an empty Wound Stack logs instead of wounding', () => {
    const gameState = buildClashState(2);
    gameState.monsterPit = [ZZUTAK];
    gameState.piles.wounds = [];
    runClashTwist(gameState, 5);
    assert.equal(countWounds(gameState, '0'), 0);
    assert.ok(logText(gameState).includes('but the Wound Stack is empty'));
  });
});

describe('Clash Evil Wins: the Wound Stack or the Monster Pit runs out (D-24736)', () => {
  it('is configured as a two-pile loss with no twist proxy', () => {
    const config = SCHEME_TWIST_CONFIGS.get(CLASH_SCHEME_ID);
    assert.deepEqual(config?.resourceLossCondition, { kind: 'pile-depleted', piles: ['wounds', 'monsterPit'] });
    const gameState = buildClashState(2);
    assert.equal(isTwistLossSuppressed(gameState), true);
  });

  it('a full Pit and Wound Stack is not a loss', () => {
    const gameState = buildClashState(2);
    applyPileDepletionResourceLoss(gameState);
    assert.equal(gameState.counters.schemeLoss ?? 0, 0);
  });

  it('the Monster Pit running out is a scheme loss', () => {
    const gameState = buildClashState(2);
    gameState.monsterPit = [];
    applyPileDepletionResourceLoss(gameState);
    assert.equal(gameState.counters.schemeLoss, 1);
    assert.ok(logText(gameState).includes('the Monster Pit has run out'));
  });

  it('the Wound Stack running out is a scheme loss', () => {
    const gameState = buildClashState(2);
    gameState.piles.wounds = [];
    applyPileDepletionResourceLoss(gameState);
    assert.equal(gameState.counters.schemeLoss, 1);
    assert.ok(logText(gameState).includes('the Wound Stack has run out'));
  });

  it('the eight Monsters empty the Pit on Twist 10', () => {
    const gameState = buildClashState(2);
    for (let twistNumber = 1; twistNumber <= 9; twistNumber++) {
      runClashTwist(gameState, twistNumber);
    }
    assert.equal(gameState.monsterPit?.length, 1, 'one Monster is left after Twist 9');
    runClashTwist(gameState, 10);
    assert.equal(gameState.monsterPit?.length, 0, 'Twist 10 releases the last Monster');
  });

  it('the meter reports the Monster Pit once it is the further-along pile', () => {
    const gameState = buildClashState(2);
    gameState.monsterPit = (gameState.monsterPit ?? []).slice(0, 2);
    assert.equal(resolveSchemeLossKind(gameState), 'monster-pit');
  });
});
