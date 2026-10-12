/**
 * Man / Woman Out of Time — turn 1 set-aside, turn 2 replay, and the played vs have split
 * (WP-803 / D-24692).
 *
 * Turn 1 is driven through the real `playCard` move with hooks parsed from the printed card
 * text, so the parser, the gate, the handler and the ledger are exercised together. Turn 2
 * is driven through `advanceTurnStage` with the `beginMain` closure bound to
 * `replayOutOfTimeCards`, exactly as every turn loop binds it. The live boardgame.io wiring
 * (game.ts advanceStage, its reveal gate and block-all guards) is covered by the reducer
 * test in game.test.ts.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replayOutOfTimeCards } from './outOfTime.logic.js';
import { playCard } from './coreMoves.impl.js';
import { applyEndOfTurnCleanup } from './endOfTurnCleanup.logic.js';
import { resolvePutHandOnDeckTop } from './putHandOnDeckTop.resolve.js';
import { advanceTurnStage } from '../turn/turnLoop.js';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { resetTurnEconomy } from '../economy/economy.logic.js';
import { playedCardIdsThisTurn, playedCardIdsStillInPlay } from '../hero/splitCard.logic.js';
import { evaluateAllConditions, countDistinctHeroClassesYouHave } from '../hero/heroConditions.evaluate.js';
import { resolveCountSource } from '../hero/heroCountSource.resolve.js';
import { buildKoEligibleTargets, YOUR_HEROES_KO_ZONES } from '../villain/villainEffects.execute.js';
import { formatCardRef } from '../log/logDisplay.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { LegendaryGameState } from '../types.js';
import type { CardStatEntry } from '../economy/economy.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// why: the exact printed lines, verified against data/cards/ca75.json and anni.json.
const DEVOTED_PATRIOT_LINES = ['Draw a card. [keyword:draw:1]', '[hc:strength]: [keyword:Man Out of Time]'];
const STORM_THE_BEACHHEAD_LINES = [
  'You get +1[icon:attack] for each Hero class you have. [keyword:attack-per-count:distinct-hero-classes-played-this-turn:1]',
  '[keyword:Man Out of Time]',
];
const TIME_LOOP_EXPERIMENTS_LINES = [
  'Draw a card. Then put a card from your hand on top of your deck. [keyword:put-hand-on-deck-top:1]',
  '[hc:tech]: [keyword:Woman Out of Time]',
];

const DEVOTED_PATRIOT = 'ca75/captain-america-1941/devoted-patriot#0';
const STORM_THE_BEACHHEAD = 'ca75/captain-america-1941/storm-the-beachhead#0';
const TIME_LOOP_EXPERIMENTS = 'anni/brainstorm/time-loop-experiments#0';
const STRENGTH_ALLY = 'test/ally/strength-ally#0';
const TECH_ALLY = 'test/ally/tech-ally#0';

const DECK = ['deck-01', 'deck-02', 'deck-03', 'deck-04', 'deck-05', 'deck-06', 'deck-07', 'deck-08', 'deck-09', 'deck-10', 'deck-11', 'deck-12'];

/** A complete CardStatEntry for a test hero. */
function heroStat(attack: number, recruit: number, cost: number): CardStatEntry {
  return {
    attack,
    recruit,
    cost,
    fightCost: 0,
    fightCostMode: 'static',
    fightCostBase: 0,
    hasAttackIcon: attack > 0,
    hasRecruitIcon: recruit > 0,
    isShieldOrHydra: false,
  };
}

/** Parses the in-scope cards' printed lines into hooks (one copy of each). */
function parseOutOfTimeHooks() {
  const sets: Record<string, unknown> = {
    ca75: {
      abbr: 'ca75',
      heroes: [{
        slug: 'captain-america-1941',
        cards: [
          { slug: 'devoted-patriot', abilities: DEVOTED_PATRIOT_LINES },
          { slug: 'storm-the-beachhead', abilities: STORM_THE_BEACHHEAD_LINES },
        ],
        physicalCards: [
          { id: 'p0', count: 1, sides: ['devoted-patriot'] },
          { id: 'p1', count: 1, sides: ['storm-the-beachhead'] },
        ],
      }],
    },
    anni: {
      abbr: 'anni',
      heroes: [{
        slug: 'brainstorm',
        cards: [{ slug: 'time-loop-experiments', abilities: TIME_LOOP_EXPERIMENTS_LINES }],
        physicalCards: [{ id: 'p0', count: 1, sides: ['time-loop-experiments'] }],
      }],
    },
  };
  const registry = {
    listCards: () => [],
    listSets: () => [{ abbr: 'ca75' }, { abbr: 'anni' }],
    getSet: (abbr: string) => sets[abbr],
  };
  const config: MatchSetupConfig = {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: ['ca75/captain-america-1941', 'anni/brainstorm'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
  return buildHeroAbilityHooks(registry, config);
}

/** Builds a main-stage state for player 0 with the given hand and the shared test deck. */
function makeOutOfTimeState(hand: string[]): LegendaryGameState {
  const gameState = buildInitialGameState(
    {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    {},
    makeMockCtx(),
  );
  gameState.heroAbilityHooks = parseOutOfTimeHooks();
  gameState.cardTraits = {
    [DEVOTED_PATRIOT]: { heroClass: 'strength', team: null },
    [STORM_THE_BEACHHEAD]: { heroClass: 'tech', team: null },
    [TIME_LOOP_EXPERIMENTS]: { heroClass: 'tech', team: null },
    [STRENGTH_ALLY]: { heroClass: 'strength', team: null },
    [TECH_ALLY]: { heroClass: 'tech', team: null },
  };
  gameState.cardStats = {
    [DEVOTED_PATRIOT]: heroStat(2, 0, 3),
    [STORM_THE_BEACHHEAD]: heroStat(3, 0, 5),
    [TIME_LOOP_EXPERIMENTS]: heroStat(0, 1, 2),
    [STRENGTH_ALLY]: heroStat(1, 0, 2),
    [TECH_ALLY]: heroStat(0, 1, 2),
  };
  gameState.currentStage = 'main';
  gameState.playerZones['0']!.hand = [...hand];
  gameState.playerZones['0']!.deck = [...DECK];
  return gameState;
}

/** Plays a hand card through the real playCard move for player 0. */
function playFromHand(gameState: LegendaryGameState, cardId: string): void {
  playCard(makeMockMoveContext(gameState), { cardId });
}

/** Ends player 0's turn and starts their next one, stopping in the start stage. */
function rollToNextTurnStart(gameState: LegendaryGameState): void {
  applyEndOfTurnCleanup(gameState, '0', makeMockCtx());
  gameState.turnEconomy = resetTurnEconomy();
  gameState.currentStage = 'start';
}

/** Advances start → main the way every turn loop does, with beginMain bound to the replay. */
function advanceToMain(gameState: LegendaryGameState): void {
  const moveContext = makeMockMoveContext(gameState);
  advanceTurnStage(gameState, {
    currentPlayer: '0',
    events: { endTurn: () => {} },
    cleanup: () => {},
    beginMain: (startingPlayerID) => replayOutOfTimeCards(gameState, moveContext, startingPlayerID),
  });
}

/** The log texts, in order. */
function logTexts(gameState: LegendaryGameState): string[] {
  return gameState.messages.map((entry) => (typeof entry === 'string' ? entry : entry.text));
}

/** The outcome of the first log line containing `fragment`. */
function outcomeOf(gameState: LegendaryGameState, fragment: string): string | undefined {
  for (const entry of gameState.messages) {
    if (typeof entry !== 'string' && entry.text.includes(fragment)) {
      return entry.outcome;
    }
  }
  return undefined;
}

describe('Out of Time — turn 1 set-aside (WP-803 / D-24692)', () => {
  it('Devoted Patriot with its Strength gate met leaves play into the set-aside, still counted as played', () => {
    const gameState = makeOutOfTimeState([STRENGTH_ALLY, DEVOTED_PATRIOT]);

    playFromHand(gameState, STRENGTH_ALLY);
    playFromHand(gameState, DEVOTED_PATRIOT);

    const zones = gameState.playerZones['0']!;
    assert.deepStrictEqual(zones.inPlay, [STRENGTH_ALLY]);
    assert.deepStrictEqual(gameState.outOfTimeCards, { '0': [DEVOTED_PATRIOT] });
    assert.deepStrictEqual(gameState.turnEconomy.outOfTimePlayedCardIds, [DEVOTED_PATRIOT]);
    // why: line 0 ("Draw a card.") ran before the card was set aside.
    assert.deepStrictEqual(zones.hand, ['deck-01']);
    const setAsideLine = `Player 0 set ${formatCardRef(gameState.cardDisplayData, DEVOTED_PATRIOT)} aside Out of Time; it plays again at the start of their next turn.`;
    assert.ok(logTexts(gameState).some((text) => text.endsWith(setAsideLine)), 'the set-aside line is logged');
    assert.equal(outcomeOf(gameState, 'aside Out of Time'), 'applied');

    // why: a later Strength Superpower this turn still sees the set-aside card as played
    // (rules v23 L1682): the ally AND Devoted Patriot are the two other Strength cards.
    assert.equal(resolveCountSource(gameState, '0', 'strength-heroes-played-this-turn', 'test/later/strength#0'), 2);
    assert.deepStrictEqual(playedCardIdsThisTurn(gameState, zones.inPlay), [STRENGTH_ALLY, DEVOTED_PATRIOT]);
    assert.deepStrictEqual(playedCardIdsStillInPlay(gameState, zones.inPlay), [STRENGTH_ALLY]);
  });

  it('Devoted Patriot with its gate unmet stays in play and is discarded at cleanup, writing nothing', () => {
    const gameState = makeOutOfTimeState([DEVOTED_PATRIOT]);

    playFromHand(gameState, DEVOTED_PATRIOT);

    assert.deepStrictEqual(gameState.playerZones['0']!.inPlay, [DEVOTED_PATRIOT]);
    assert.equal(Object.keys(gameState).includes('outOfTimeCards'), false);
    assert.equal(Object.keys(gameState.turnEconomy).includes('outOfTimePlayedCardIds'), false);

    applyEndOfTurnCleanup(gameState, '0', makeMockCtx());
    assert.ok(gameState.playerZones['0']!.discard.includes(DEVOTED_PATRIOT), 'discarded at cleanup as today');
    assert.equal(gameState.playerZones['0']!.inPlay.includes(DEVOTED_PATRIOT), false);
  });

  it('a match with no Out of Time card writes neither the set-aside nor the ledger', () => {
    const gameState = makeOutOfTimeState([STRENGTH_ALLY, TECH_ALLY]);

    playFromHand(gameState, STRENGTH_ALLY);
    playFromHand(gameState, TECH_ALLY);
    rollToNextTurnStart(gameState);
    advanceToMain(gameState);

    assert.equal(Object.keys(gameState).includes('outOfTimeCards'), false);
    assert.equal(Object.keys(gameState.turnEconomy).includes('outOfTimePlayedCardIds'), false);
  });
});

describe('Out of Time — turn 2 replay (WP-803 / D-24692)', () => {
  it('replays Devoted Patriot once on start → main, credits it, then discards it', () => {
    const gameState = makeOutOfTimeState([STRENGTH_ALLY, DEVOTED_PATRIOT]);
    playFromHand(gameState, STRENGTH_ALLY);
    playFromHand(gameState, DEVOTED_PATRIOT);
    rollToNextTurnStart(gameState);
    const handBefore = [...gameState.playerZones['0']!.hand];
    const messageCountBefore = gameState.messages.length;

    advanceToMain(gameState);

    const zones = gameState.playerZones['0']!;
    assert.equal(gameState.currentStage, 'main');
    const newLines = logTexts(gameState).slice(messageCountBefore);
    const patriotRef = formatCardRef(gameState.cardDisplayData, DEVOTED_PATRIOT);
    assert.ok(newLines[0]!.endsWith(`Player 0's ${patriotRef} returns from Out of Time and is played a second time.`));
    assert.equal(outcomeOf(gameState, 'returns from Out of Time'), 'neutral');
    assert.ok(newLines[1]!.includes(`Player 0 played ${patriotRef}`), 'the play-core log line follows');
    // why: printed icons credited (+2 attack) and line 0's draw fired.
    assert.equal(gameState.turnEconomy.attack, 2);
    assert.equal(zones.hand.length, handBefore.length + 1);
    // why: then discarded, last; never set aside again.
    assert.equal(zones.discard[zones.discard.length - 1], DEVOTED_PATRIOT);
    assert.equal(zones.inPlay.includes(DEVOTED_PATRIOT), false);
    assert.equal(Object.keys(gameState).includes('outOfTimeCards'), false);
    assert.deepStrictEqual(gameState.turnEconomy.outOfTimePlayedCardIds, [DEVOTED_PATRIOT]);
    // why: it still counts as played this turn, exactly once.
    assert.deepStrictEqual(playedCardIdsThisTurn(gameState, zones.inPlay), [DEVOTED_PATRIOT]);
  });

  it('two set-aside cards replay in set-aside order, and an ungated one is blocked from going Out of Time again', () => {
    const gameState = makeOutOfTimeState([]);
    gameState.outOfTimeCards = { '0': [STORM_THE_BEACHHEAD, DEVOTED_PATRIOT] };
    gameState.currentStage = 'start';

    advanceToMain(gameState);

    const lines = logTexts(gameState);
    const stormRef = formatCardRef(gameState.cardDisplayData, STORM_THE_BEACHHEAD);
    const patriotRef = formatCardRef(gameState.cardDisplayData, DEVOTED_PATRIOT);
    const stormReturn = lines.findIndex((text) => text.includes(`${stormRef} returns from Out of Time`));
    const patriotReturn = lines.findIndex((text) => text.includes(`${patriotRef} returns from Out of Time`));
    assert.ok(stormReturn >= 0 && patriotReturn > stormReturn, 'Storm the Beachhead replays before Devoted Patriot');
    assert.ok(
      lines.some((text) => text.endsWith(`${stormRef} is not set aside again: a card goes Out of Time only once.`)),
      'the ungated replay hits guard 1',
    );
    assert.equal(outcomeOf(gameState, 'is not set aside again'), 'blocked');
    const discard = gameState.playerZones['0']!.discard;
    assert.deepStrictEqual(discard.slice(-2), [STORM_THE_BEACHHEAD, DEVOTED_PATRIOT]);
    assert.deepStrictEqual(gameState.playerZones['0']!.inPlay, []);
    assert.deepStrictEqual(gameState.turnEconomy.outOfTimePlayedCardIds, [STORM_THE_BEACHHEAD, DEVOTED_PATRIOT]);
    assert.equal(Object.keys(gameState).includes('outOfTimeCards'), false);
  });

  it('replay keeps another player\'s set-aside and returns early (mutating nothing) with no entry', () => {
    const gameState = makeOutOfTimeState([]);
    gameState.outOfTimeCards = { '1': [STORM_THE_BEACHHEAD] };
    const before = JSON.stringify(gameState);

    replayOutOfTimeCards(gameState, makeMockMoveContext(gameState), '0');
    assert.equal(JSON.stringify(gameState), before, 'no entry for player 0 → nothing mutated');

    replayOutOfTimeCards(gameState, makeMockMoveContext(gameState), '7');
    assert.equal(JSON.stringify(gameState), before, 'no playerZones → nothing mutated');
  });

  it('only the start → main advance replays (main → cleanup does not)', () => {
    const gameState = makeOutOfTimeState([]);
    gameState.outOfTimeCards = { '0': [STORM_THE_BEACHHEAD] };
    gameState.currentStage = 'main';

    advanceToMain(gameState);

    assert.equal(gameState.currentStage, 'cleanup');
    assert.deepStrictEqual(gameState.outOfTimeCards, { '0': [STORM_THE_BEACHHEAD] });
  });
});

describe('Out of Time — a choice opened by the card (Time Loop Experiments)', () => {
  it('turn 1 sets the card aside with its choice pending; turn 2 re-opens the choice in main after the discard', () => {
    const gameState = makeOutOfTimeState([TECH_ALLY, TIME_LOOP_EXPERIMENTS, 'hand-x']);

    playFromHand(gameState, TECH_ALLY);
    playFromHand(gameState, TIME_LOOP_EXPERIMENTS);

    assert.deepStrictEqual(gameState.outOfTimeCards, { '0': [TIME_LOOP_EXPERIMENTS] });
    assert.equal(gameState.pendingPutHandOnDeckTop?.length, 1, 'the put-on-top choice is pending');
    resolvePutHandOnDeckTop(makeMockMoveContext(gameState), { cardId: 'hand-x' });
    assert.equal(gameState.pendingPutHandOnDeckTop?.length ?? 0, 0, 'the turn-1 choice resolves');
    assert.equal(gameState.playerZones['0']!.deck[0], 'hand-x');

    rollToNextTurnStart(gameState);
    advanceToMain(gameState);

    const zones = gameState.playerZones['0']!;
    assert.equal(gameState.currentStage, 'main');
    assert.equal(gameState.pendingPutHandOnDeckTop?.length, 1, 'the replay re-opens the choice in main');
    assert.equal(zones.discard[zones.discard.length - 1], TIME_LOOP_EXPERIMENTS, 'the card is already discarded');
    const handCard = zones.hand[0]!;
    resolvePutHandOnDeckTop(makeMockMoveContext(gameState), { cardId: handCard });
    assert.equal(gameState.pendingPutHandOnDeckTop?.length ?? 0, 0, 'the turn-2 choice resolves');
    assert.equal(gameState.playerZones['0']!.deck[0], handCard, 'the chosen card went on top of the deck');
  });
});

describe('Out of Time — played vs have (rules v23 L3443-3447)', () => {
  const LEDGER_CARDS = ['test/ledger/covert#0', 'test/ledger/ranged#0', 'test/ledger/instinct#0'];

  /** A state whose only trace of three costly Heroes of distinct classes is the Out of Time ledger. */
  function makeLedgerOnlyState(): LegendaryGameState {
    const gameState = makeOutOfTimeState([]);
    gameState.cardTraits[LEDGER_CARDS[0]!] = { heroClass: 'covert', team: null };
    gameState.cardTraits[LEDGER_CARDS[1]!] = { heroClass: 'ranged', team: null };
    gameState.cardTraits[LEDGER_CARDS[2]!] = { heroClass: 'instinct', team: null };
    for (const cardId of LEDGER_CARDS) {
      gameState.cardStats[cardId] = heroStat(0, 0, 6);
    }
    gameState.turnEconomy = { ...gameState.turnEconomy, outOfTimePlayedCardIds: [...LEDGER_CARDS] };
    return gameState;
  }

  it('"have" reads ignore a card that is only in the ledger', () => {
    const gameState = makeLedgerOnlyState();
    const zones = gameState.playerZones['0']!;

    assert.equal(evaluateAllConditions(gameState, '0', [{ type: 'heroCostAtLeastInHandOrPlay', value: '5' }]), false);
    assert.equal(countDistinctHeroClassesYouHave(gameState, '0'), 0);
    // why: Spectrum ("at least 3 classes of Hero you have") rides countDistinctHeroClassesYouHave.
    assert.equal(evaluateAllConditions(gameState, '0', [{ type: 'distinctHeroClassesAtLeast', value: '3' }]), false);
    // why: WP-801's "KO one of your Heroes" candidates read the raw hand / inPlay zones.
    assert.deepStrictEqual(buildKoEligibleTargets(zones, YOUR_HEROES_KO_ZONES), []);

    // why: positive control — the same three cards in play satisfy every one of those reads.
    zones.inPlay = [...LEDGER_CARDS];
    assert.equal(evaluateAllConditions(gameState, '0', [{ type: 'heroCostAtLeastInHandOrPlay', value: '5' }]), true);
    assert.equal(countDistinctHeroClassesYouHave(gameState, '0'), 3);
    assert.equal(evaluateAllConditions(gameState, '0', [{ type: 'distinctHeroClassesAtLeast', value: '3' }]), true);
    assert.equal(buildKoEligibleTargets(zones, YOUR_HEROES_KO_ZONES).length, 3);
  });

  it('a "played" count source counts a replaying card exactly once', () => {
    const gameState = makeOutOfTimeState([]);
    gameState.playerZones['0']!.inPlay = [DEVOTED_PATRIOT];
    gameState.turnEconomy = { ...gameState.turnEconomy, outOfTimePlayedCardIds: [DEVOTED_PATRIOT] };

    assert.equal(resolveCountSource(gameState, '0', 'strength-heroes-played-this-turn', 'test/later/strength#0'), 1);
    assert.deepStrictEqual(playedCardIdsThisTurn(gameState, gameState.playerZones['0']!.inPlay), [DEVOTED_PATRIOT]);
  });

  it('playedCardIdsThisTurn on a G slice with no turnEconomy returns a fresh copy of inPlay', () => {
    const inPlay = ['a#0', 'b#0'];
    const slice = { playerZones: {} } as unknown as LegendaryGameState;

    const played = playedCardIdsThisTurn(slice, inPlay);

    assert.deepStrictEqual(played, ['a#0', 'b#0']);
    assert.notStrictEqual(played, inPlay);
  });
});
