/**
 * Attempt a Heist (WP-865 / D-24808).
 *
 * Builds the REAL hooks from the committed data/cards/amwp.json, plays Heist cards through the real
 * hero executor, and attempts the Heist through the real attemptHeist move, so the readying, the
 * Heist Count, the revealed-card VP, the three outcomes, the once-per-turn latch and the no-op gates
 * are pinned together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from '../hero/heroEffects.execute.js';
import { attemptHeist, heistCount, heistRevealedVictoryPoints, isHeistAvailable } from './attemptHeist.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealedCardType } from '../villainDeck/villainDeck.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';
import {
  makeCardStatEntry,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const PETTY_LARCENY = 'amwp/scott-lang-cat-burglar/petty-larceny#0' as CardExtId;
const SHOCKING_SUPPORT = 'amwp/scott-lang-cat-burglar/shocking-support#0' as CardExtId;
const ANYTHING_FOR_CASSIE = 'amwp/scott-lang-cat-burglar/anything-for-cassie#0' as CardExtId;
const THE_BIG_SCORE = 'amwp/scott-lang-cat-burglar/the-big-score#0' as CardExtId;
const INFILTRATE = 'amwp/wasp/infiltrate#0' as CardExtId;
const TINY_LITTLE_RISK = 'amwp/ant-man/tiny-little-risk#0' as CardExtId;
const UP_THE_ANTE = 'amwp/ant-army/up-the-ante#0' as CardExtId;
const SHIELD_AGENT = 'starting-shield-agent#0' as CardExtId;
const HAND_FIVE = 'test/hand-hero/five-cost#0' as CardExtId;
const HAND_SIX = 'test/hand-hero/six-cost#0' as CardExtId;
const NO_STATS_HERO = 'test/no-stats-hero/unknown#0' as CardExtId;
const DIVING_BLOCK = 'core/captain-america/diving-block#0' as CardExtId;

const TOP_VILLAIN = 'test/villain-group/thug#0' as CardExtId;
const SECOND_VILLAIN = 'test/villain-group/thug#1' as CardExtId;
const BYSTANDER = 'bystander#0' as CardExtId;
const SCHEME_TWIST = 'scheme-twist#0' as CardExtId;
const MASTER_STRIKE = 'master-strike#0' as CardExtId;
const HENCHMAN = 'test/henchman-group/goon#0' as CardExtId;
const WOUND = 'pile-wound#0' as CardExtId;
const DECK = ['deck-01', 'deck-02', 'deck-03', 'deck-04', 'deck-05'] as CardExtId[];

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real hooks for the four amwp Heist hero decks from the committed card data, plus a
 * Diving Block hook for the pending-Wound case.
 *
 * @returns Every hook the match carries.
 */
function buildHooks(): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'amwp.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'amwp' ? setData : undefined) };
  const config = {
    heroDeckIds: ['amwp/scott-lang-cat-burglar', 'amwp/ant-man', 'amwp/wasp', 'amwp/ant-army'],
  } as unknown as MatchConfiguration;
  return [
    ...buildHeroAbilityHooks(registry, config),
    { cardId: DIVING_BLOCK, timing: 'onPlay', keywords: ['diving-block'] },
  ];
}

const HOOKS = buildHooks();

/**
 * A printed-cost card stat entry.
 *
 * @param cost - The printed cost.
 * @returns A static card stat entry with that cost.
 */
function costEntry(cost: number): CardStatEntry {
  return makeCardStatEntry({ cost });
}

/**
 * A two-seat state wide enough for the hero executor and the attemptHeist move. The Villain Deck
 * top card is a villain worth 2 VP; the Wound supply holds one Wound.
 *
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(): LegendaryGameState {
  const villainDeckCardTypes: Record<CardExtId, RevealedCardType> = {
    [TOP_VILLAIN]: 'villain',
    [SECOND_VILLAIN]: 'villain',
    [BYSTANDER]: 'bystander',
    [SCHEME_TWIST]: 'scheme-twist',
    [MASTER_STRIKE]: 'mastermind-strike',
    [HENCHMAN]: 'henchman',
  };
  return {
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': { ...makePlayerZones(), deck: [...DECK] },
      '1': { ...makePlayerZones(), deck: [...DECK] },
    },
    piles: makeGlobalPiles({ wounds: [WOUND], bystanders: ['pile-bystander#0' as CardExtId] }),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [TOP_VILLAIN, SECOND_VILLAIN], discard: [] },
    villainDeckCardTypes,
    cardVictoryPoints: { [TOP_VILLAIN]: 2, [SECOND_VILLAIN]: 2 },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    scheme: { twistPile: [] },
    heroAbilityHooks: HOOKS,
    villainAbilityHooks: [],
    cardStats: {
      [PETTY_LARCENY]: costEntry(1),
      [SHOCKING_SUPPORT]: costEntry(4),
      [ANYTHING_FOR_CASSIE]: costEntry(2),
      [THE_BIG_SCORE]: costEntry(8),
      [INFILTRATE]: costEntry(6),
      [TINY_LITTLE_RISK]: costEntry(6),
      [UP_THE_ANTE]: costEntry(1),
      [SHIELD_AGENT]: costEntry(0),
      [HAND_FIVE]: costEntry(5),
      [HAND_SIX]: costEntry(6),
    },
    cardTraits: {},
    cardKeywords: {},
    cardDisplayData: {},
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays a card for player 0: puts it in play and runs its hooks through the real executor.
 *
 * @param G - The game state.
 * @param cardId - The card to play.
 */
function playCard(G: LegendaryGameState, cardId: CardExtId): void {
  G.playerZones['0']!.inPlay.push(cardId);
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/**
 * The move context attemptHeist reads.
 *
 * @param G - The game state.
 * @returns A move context for player 0.
 */
function moveContext(G: LegendaryGameState): never {
  return { G, playerID: '0', ctx: { ...mockCtx.ctx }, random: mockCtx.random } as never;
}

/**
 * The game log text, one line per entry.
 *
 * @param G - The game state.
 * @returns The log lines.
 */
function logLines(G: LegendaryGameState): string[] {
  const lines: string[] = [];
  for (const entry of G.messages as unknown[]) {
    if (typeof entry === 'string') {
      lines.push(entry);
    } else {
      lines.push((entry as { text: string }).text);
    }
  }
  return lines;
}

/**
 * The outcome of the first log entry whose text contains the given fragment.
 *
 * @param G - The game state.
 * @param fragment - Text the entry must contain.
 * @returns The entry outcome, or undefined when no entry matches.
 */
function outcomeOf(G: LegendaryGameState, fragment: string): string | undefined {
  for (const entry of G.messages as unknown[]) {
    const logEntry = entry as { text: string; outcome?: string };
    if (typeof logEntry.text === 'string' && logEntry.text.includes(fragment)) {
      return logEntry.outcome;
    }
  }
  return undefined;
}

describe('WP-865 Heist readying at play', () => {
  for (const cardId of [PETTY_LARCENY, ANYTHING_FOR_CASSIE, SHOCKING_SUPPORT, INFILTRATE, TINY_LITTLE_RISK, UP_THE_ANTE]) {
    it(`${cardId} is readied and grants nothing at play`, () => {
      const G = makeState();
      playCard(G, cardId);
      assert.deepEqual(G.turnEconomy.heistCrewCards, [cardId]);
      assert.equal(G.turnEconomy.attack, 0, 'no attack at play');
      assert.equal(G.turnEconomy.recruit, 0, 'no recruit at play');
      assert.equal(G.playerZones['0']!.hand.length, 0, 'no draw at play');
      assert.equal(G.playerZones['0']!.victory.length, 0, 'no rescue at play');
      assert.ok(
        logLines(G).some((line) => line.includes('readied') && line.includes('for a Heist — its Heist ability fires if a Heist you attempt this turn succeeds.')),
        'the readied line is logged',
      );
      assert.equal(outcomeOf(G, 'for a Heist'), 'applied');
    });
  }

  it('The Big Score is a hollow: it grants nothing and readies nothing', () => {
    const G = makeState();
    playCard(G, THE_BIG_SCORE);
    assert.equal(G.turnEconomy.heistCrewCards, undefined);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(isHeistAvailable(G, '0'), false, 'a hollow alone never offers a Heist');
  });
});

describe('WP-865 Heist outcomes', () => {
  it('higher: every readied ability fires in readying order and the revealed card stays on top', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HAND_FIVE];
    playCard(G, PETTY_LARCENY);
    playCard(G, INFILTRATE);
    assert.equal(isHeistAvailable(G, '0'), true);
    // why: Heist Count = costs {5 (hand), 1, 6} = 3 against a 2 VP villain.
    assert.equal(heistCount(G, '0'), 3);

    attemptHeist(moveContext(G));

    assert.equal(G.turnEconomy.recruit, 2, 'Petty Larceny +2 Recruit');
    assert.equal(G.turnEconomy.attack, 3, 'Infiltrate +3 Attack');
    assert.deepEqual(G.villainDeck.deck, [TOP_VILLAIN, SECOND_VILLAIN], 'the revealed card stays on top');
    assert.equal(G.turnEconomy.hasAttemptedHeistThisTurn, true);
    assert.equal(G.playerZones['0']!.discard.includes(WOUND), false, 'no Wound');
    const lines = logLines(G);
    const attemptIndex = lines.findIndex((line) => line.startsWith('Player 0 attempts a Heist: Heist Count 3 against'));
    assert.ok(attemptIndex >= 0, 'the attempt line is logged');
    assert.ok(lines[attemptIndex]!.endsWith('(2 VP).'));
    const recruitIndex = lines.findIndex((line, index) => index > attemptIndex && line.includes('recruit'));
    const attackIndex = lines.findIndex((line, index) => index > attemptIndex && line.includes('attack'));
    assert.ok(recruitIndex > attemptIndex && attackIndex > recruitIndex, 'readying order: recruit fires before attack');
    assert.equal(lines[lines.length - 1], 'The Heist worked! Player 0 uses 2 Heist abilities.');
    assert.equal(outcomeOf(G, 'attempts a Heist'), 'neutral');
    assert.equal(outcomeOf(G, 'The Heist worked!'), 'applied');
  });

  it('higher: a single readied ability logs the singular success line, and an inner draw draws', () => {
    const G = makeState();
    playCard(G, TINY_LITTLE_RISK);
    G.playerZones['0']!.hand = [HAND_FIVE, PETTY_LARCENY];
    // why: Heist Count = costs {5, 1, 6} = 3 against 2 VP.
    attemptHeist(moveContext(G));
    assert.equal(G.playerZones['0']!.hand.length, 4, 'Tiny little Risk draws two');
    assert.equal(logLines(G).at(-1), 'The Heist worked! Player 0 uses 1 Heist ability.');
  });

  it('tied: nothing happens and no Wound is gained', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HAND_FIVE];
    playCard(G, INFILTRATE);
    // why: Heist Count = costs {5, 6} = 2 ties the 2 VP villain.
    attemptHeist(moveContext(G));
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.playerZones['0']!.discard.length, 0, 'no Wound');
    assert.equal(G.turnEconomy.woundsDrawn, 0);
    assert.equal(G.turnEconomy.hasAttemptedHeistThisTurn, true, 'a tie still uses the attempt');
    assert.equal(logLines(G).at(-1), 'The Heist went sideways — Heist Count 2 ties 2 VP, so nothing happens.');
    assert.equal(outcomeOf(G, 'The Heist went sideways'), 'blocked');
  });

  it('lower: the player gains exactly one Wound and no ability fires', () => {
    const G = makeState();
    playCard(G, INFILTRATE);
    // why: Heist Count = cost {6} = 1 against 2 VP.
    attemptHeist(moveContext(G));
    assert.equal(G.turnEconomy.attack, 0, 'no ability fires');
    assert.deepEqual(G.playerZones['0']!.discard, [WOUND]);
    assert.equal(G.piles.wounds.length, 0);
    assert.equal(G.turnEconomy.woundsDrawn, 1);
    assert.equal(logLines(G).at(-1), 'The Heist failed — Heist Count 1 is lower than 2 VP, so Player 0 gains a Wound.');
    assert.equal(outcomeOf(G, 'The Heist failed'), 'blocked');
  });

  it('lower with an empty Wound supply: the no-wound line, nothing gained', () => {
    const G = makeState();
    G.piles.wounds = [];
    playCard(G, INFILTRATE);
    attemptHeist(moveContext(G));
    assert.equal(G.playerZones['0']!.discard.length, 0);
    assert.equal(G.turnEconomy.woundsDrawn, 0, 'no Wound landed, so woundsDrawn does not bump');
    assert.equal(logLines(G).at(-1), 'The Heist failed — Heist Count 1 is lower than 2 VP, but the Wound supply is empty.');
  });

  it('lower with Diving Block revealable: the Wound is not logged as gained', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [DIVING_BLOCK];
    playCard(G, INFILTRATE);
    attemptHeist(moveContext(G));
    assert.equal(G.pendingDivingBlockWounds?.length, 1, 'a Diving Block reveal is pending');
    assert.equal(G.turnEconomy.woundsDrawn, 1, 'the landed Wound bumps woundsDrawn');
    const lastLine = logLines(G).at(-1)!;
    assert.equal(lastLine, 'The Heist failed — Heist Count 1 is lower than 2 VP, so Player 0 must gain a Wound unless they block it.');
    assert.equal(lastLine.includes('gains a Wound'), false);
  });
});

describe('WP-865 Heist no-ops', () => {
  it('a second attempt in the same turn changes nothing', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HAND_FIVE, HAND_SIX];
    playCard(G, PETTY_LARCENY);
    attemptHeist(moveContext(G));
    const before = JSON.stringify(G);
    attemptHeist(moveContext(G));
    assert.equal(JSON.stringify(G), before);
    assert.equal(isHeistAvailable(G, '0'), false);
  });

  it('an attempt with nothing readied changes nothing', () => {
    const G = makeState();
    const before = JSON.stringify(G);
    attemptHeist(moveContext(G));
    assert.equal(JSON.stringify(G), before);
  });

  it('an attempt with an empty Villain Deck changes nothing', () => {
    const G = makeState();
    playCard(G, INFILTRATE);
    G.villainDeck.deck = [];
    const before = JSON.stringify(G);
    assert.equal(isHeistAvailable(G, '0'), false);
    attemptHeist(moveContext(G));
    assert.equal(JSON.stringify(G), before);
  });

  it('an attempt outside the main stage changes nothing', () => {
    const G = makeState();
    playCard(G, INFILTRATE);
    G.currentStage = 'cleanup';
    const before = JSON.stringify(G);
    attemptHeist(moveContext(G));
    assert.equal(JSON.stringify(G), before);
  });

  it('an attempt while a choice is open changes nothing', () => {
    const G = makeState();
    playCard(G, INFILTRATE);
    G.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 1 }] as never;
    const before = JSON.stringify(G);
    assert.equal(isHeistAvailable(G, '0'), false);
    attemptHeist(moveContext(G));
    assert.equal(JSON.stringify(G), before);
  });

  it('a Heist card played after the attempt is too late and is not readied', () => {
    const G = makeState();
    playCard(G, INFILTRATE);
    attemptHeist(moveContext(G));
    playCard(G, SHOCKING_SUPPORT);
    assert.deepEqual(G.turnEconomy.heistCrewCards, [INFILTRATE], 'the late card is not readied');
    assert.equal(G.turnEconomy.attack, 0, 'the late card grants nothing');
    assert.ok(
      logLines(G).some((line) => line.includes('after this turn\'s Heist, so it is too late for its Heist ability.')),
      'the too-late line is logged',
    );
    assert.equal(outcomeOf(G, 'too late for its Heist ability'), 'blocked');
  });
});

describe('WP-865 Heist Count', () => {
  it('equal costs count once and 0-cost cards never count', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [HAND_SIX, SHIELD_AGENT];
    G.playerZones['0']!.inPlay = [INFILTRATE, TINY_LITTLE_RISK, SHIELD_AGENT];
    assert.equal(heistCount(G, '0'), 1, 'three cost-6 cards and two 0-cost starters count as one');
  });

  it("a hand card's cost counts", () => {
    const G = makeState();
    G.playerZones['0']!.inPlay = [INFILTRATE];
    assert.equal(heistCount(G, '0'), 1);
    G.playerZones['0']!.hand = [HAND_FIVE];
    assert.equal(heistCount(G, '0'), 2);
  });

  it('a played card that has since left play does not count', () => {
    const G = makeState();
    G.playerZones['0']!.inPlay = [INFILTRATE];
    G.playerZones['0']!.discard = [HAND_FIVE];
    G.turnEconomy = { ...G.turnEconomy, ritualUsedPlayedCardIds: [HAND_FIVE] };
    assert.equal(heistCount(G, '0'), 1, 'only the card still in play counts');
  });

  it('an id with no cardStats entry adds nothing', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [NO_STATS_HERO];
    G.playerZones['0']!.inPlay = [INFILTRATE];
    assert.equal(heistCount(G, '0'), 1);
  });
});

describe('WP-865 revealed-card VP', () => {
  it('villain: printed VP from cardVictoryPoints, else the scoring fallback', () => {
    const G = makeState();
    G.cardVictoryPoints = { [TOP_VILLAIN]: 3 };
    assert.equal(heistRevealedVictoryPoints(G, TOP_VILLAIN), 3);
    assert.equal(heistRevealedVictoryPoints(G, SECOND_VILLAIN), 1, 'a villain without a normalized VP reads VP_VILLAIN');
  });

  it('henchman: printed VP, else VP_HENCHMAN', () => {
    const G = makeState();
    assert.equal(heistRevealedVictoryPoints(G, HENCHMAN), 1);
    G.cardVictoryPoints = { [HENCHMAN]: 2 };
    assert.equal(heistRevealedVictoryPoints(G, HENCHMAN), 2);
  });

  it('bystander reads 1 VP; Scheme Twist, Master Strike and an unclassified card read 0', () => {
    const G = makeState();
    assert.equal(heistRevealedVictoryPoints(G, BYSTANDER), 1);
    assert.equal(heistRevealedVictoryPoints(G, SCHEME_TWIST), 0);
    assert.equal(heistRevealedVictoryPoints(G, MASTER_STRIKE), 0);
    assert.equal(heistRevealedVictoryPoints(G, 'test/unknown/card#0' as CardExtId), 0);
  });

  it('a Scheme Twist on top: Heist Count 1 succeeds', () => {
    const G = makeState();
    G.villainDeck.deck = [SCHEME_TWIST, TOP_VILLAIN];
    playCard(G, INFILTRATE);
    attemptHeist(moveContext(G));
    assert.equal(G.turnEconomy.attack, 3);
    assert.deepEqual(G.villainDeck.deck, [SCHEME_TWIST, TOP_VILLAIN], 'the Scheme Twist stays on top');
  });
});
