/**
 * End-to-end tests for cvwr Cloak & Dagger Penumbra — "Whenever you play a Divided Card card
 * this turn, play both sides as if they were two different cards." (WP-780 / EC-817 / D-24619).
 *
 * Covers AC-1..AC-9 (AC-7c's Electromagnetic Bubble half lives in rules/tacticHandlers.test.ts):
 *  - AC-1: the as-generated cvwr Penumbra line parses to one `play-both-sides` effect with no
 *    unresolved markers, and playing it records no hollow.
 *  - AC-2: Penumbra then a split card — no picker, both faces' economy + hooks, one inPlay entry
 *    (face a), the both-sides ledger lists it, and exactly one PLAYED_LINE match in the log.
 *  - AC-3 / AC-4: a split card played BEFORE Penumbra, or on the next turn, parks the picker.
 *  - AC-5: a face-b id played under Penumbra normalises to one face-a entry.
 *  - AC-6 / AC-7: superpower ordering and later-card visibility through a third card C.
 *  - AC-7b: playedCardIdsThisTurn is identity on a G slice with no turnEconomy.
 *  - AC-7c (Blood Frenzy half): Blood Frenzy VP stays physical and equals computeFinalScores.
 *  - AC-8: physical reads — cleanup discards exactly one card; the duplicate-id invariant holds.
 *  - AC-9: a second Penumbra is a no-op on the flag.
 *  - Manly Dullard (cvwr Hercules, split face b with [keyword:discard-to-play:1], D-24620):
 *    under Penumbra face b fires its own hooks exactly as the picker path does; with no card to
 *    discard, face b is skipped entirely (D-24621).
 *
 * Hooks, split-face map and traits are built through the real setup builders. Uses node:test +
 * node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { buildSplitFaces } from '../setup/buildHeroDeck.js';
import { buildCardTraits } from '../setup/buildCardTraits.js';
import { playCard } from '../moves/coreMoves.impl.js';
import { resolveSplitFaceChoice } from '../moves/splitFaceChoice.resolve.js';
import { resolveDiscardToPlay } from '../moves/resolveDiscardToPlay.js';
import { applyEndOfTurnCleanup } from '../moves/endOfTurnCleanup.logic.js';
import { checkNoCardInMultipleZones } from '../invariants/gameRules.checks.js';
import { evaluateCondition } from './heroConditions.evaluate.js';
import { playedCardIdsThisTurn } from './splitCard.logic.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import { resetTurnEconomy } from '../economy/economy.logic.js';
import { formatPlayedCardLabel } from '../log/logDisplay.js';
import { victoryPointValueForCard } from '../economy/bloodFrenzy.logic.js';
import { computeFinalScores } from '../scoring/scoring.logic.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy, makeCardStatEntry } from '../test/fixtureBuilders.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';

// why: the arena-client play-diagnostics "played" matcher (effectProvenance.ts PLAYED_LINE),
// copied read-only — the both-sides sequence must match it exactly once (on the played line).
const PLAYED_LINE = /^(?:\d+\.\d+\.\d+ )?Player \d+ played (.+?)\.$/;

const SHADE = 'test/duo/shade#0' as CardExtId;
const ALPHA = 'test/duo/alpha#0' as CardExtId;
const BETA = 'test/duo/beta#0' as CardExtId;
const ALPHA_COPY = 'test/duo/alpha#1' as CardExtId;
const BETA_COPY = 'test/duo/beta#1' as CardExtId;
const CLOSER = 'test/duo/closer#0' as CardExtId;

// why: a synthetic set built through the REAL setup parser. The Penumbra stand-in (shade) is
// neither Tech nor Strength; face a (alpha) is Tech needing another Strength; face b (beta) is
// Strength needing another Tech; card C (closer) is neither, needing another Strength. No other
// card can satisfy any gate, so every draw is attributable (AC-6).
const SYNTHETIC_SET = {
  abbr: 'test',
  heroes: [{
    slug: 'duo',
    team: 'marvel-knights',
    cards: [
      {
        slug: 'shade',
        hc: 'ranged',
        abilities: [
          'Whenever you play a [rule:Divided Card] card this turn, play both sides as if they were two different cards. [keyword:play-both-sides]',
        ],
      },
      { slug: 'alpha', hc: 'tech', abilities: ['[hc:strength]: Draw a card. [keyword:draw:1]'] },
      { slug: 'beta', hc: 'strength', abilities: ['[hc:tech]: Draw a card. [keyword:draw:1]'] },
      { slug: 'closer', hc: 'covert', abilities: ['[hc:strength]: Draw a card. [keyword:draw:1]'] },
    ],
    physicalCards: [
      { id: 'p1', count: 1, sides: ['shade'] },
      { id: 'p2', count: 2, sides: ['alpha', 'beta'] },
      { id: 'p3', count: 1, sides: ['closer'] },
    ],
  }],
  villains: [], henchmen: [], schemes: [], masterminds: [], bystanders: [], wounds: [], other: [],
};

const CARDS_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../data/cards',
);

/**
 * Builds a setup-time registry reader over a single set's data.
 *
 * @param setData - The set JSON (heroes with cards + physicalCards).
 * @returns A registry reader accepted by the setup builders.
 */
function makeRegistry(setData: { abbr: string }): unknown {
  return {
    listCards: () => [],
    listSets: () => [{ abbr: setData.abbr }],
    getSet: (abbr: string) => (abbr === setData.abbr ? setData : undefined),
  };
}

/**
 * Builds a match config selecting the given hero decks.
 *
 * @param heroDeckIds - Set-qualified hero deck ids.
 * @returns A MatchSetupConfig for the setup builders.
 */
function makeConfig(heroDeckIds: string[]): MatchSetupConfig {
  return {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: [],
    henchmanGroupIds: [],
    heroDeckIds,
    bystandersCount: 0,
    woundsCount: 0,
    officersCount: 0,
    sidekicksCount: 0,
  };
}

/**
 * Builds a playable one-seat G whose hooks, split-face map and traits come from the real
 * setup builders over `setData`.
 *
 * @param setData - The set JSON to build from.
 * @param heroDeckIds - The hero decks to enumerate.
 * @param zones - The seat's hand and deck.
 * @param cardStats - Per-instance attack / recruit rows (0 / 0 when omitted).
 * @returns A LegendaryGameState in the main stage.
 */
function makeBothSidesState(
  setData: { abbr: string },
  heroDeckIds: string[],
  zones: { hand: CardExtId[]; deck: CardExtId[] },
  cardStats: Record<string, CardStatEntry> = {},
): LegendaryGameState {
  const registry = makeRegistry(setData);
  const config = makeConfig(heroDeckIds);
  return {
    matchConfiguration: config,
    currentStage: 'main' as LegendaryGameState['currentStage'],
    playerZones: { '0': { ...makePlayerZones(), hand: [...zones.hand], deck: [...zones.deck] } },
    piles: { ...makeGlobalPiles() },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: makeTurnEconomy(),
    cardStats,
    cardTraits: buildCardTraits(registry, config),
    splitFaces: buildSplitFaces(heroDeckIds, registry),
    heroAbilityHooks: buildHeroAbilityHooks(registry, config),
    mastermind: { ...makeMastermindState(), id: 'test-mastermind', baseCardId: 'test-mastermind-base' },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    cardDisplayData: {},
    transformDeck: [],
    transformTargets: {},
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;
}

/**
 * Builds the synthetic-set state with the AC-2 economy (alpha 2 attack, beta 3 recruit).
 *
 * @param hand - The seat's hand.
 * @param deck - The seat's deck (draw sources).
 * @returns A playable LegendaryGameState.
 */
function makeSyntheticState(hand: CardExtId[], deck: CardExtId[] = []): LegendaryGameState {
  const cardStats: Record<string, CardStatEntry> = {
    [SHADE]: makeCardStatEntry({ attack: 4, recruit: 0, cost: 7 }),
    [ALPHA]: makeCardStatEntry({ attack: 2, recruit: 0, cost: 4 }),
    [BETA]: makeCardStatEntry({ attack: 0, recruit: 3, cost: 4 }),
    [ALPHA_COPY]: makeCardStatEntry({ attack: 2, recruit: 0, cost: 4 }),
    [BETA_COPY]: makeCardStatEntry({ attack: 0, recruit: 3, cost: 4 }),
    [CLOSER]: makeCardStatEntry({ attack: 1, recruit: 0, cost: 3 }),
  };
  return makeBothSidesState(SYNTHETIC_SET, ['test/duo'], { hand, deck }, cardStats);
}

/**
 * Plays one card as player 0 through the real playCard move.
 *
 * @param G - The game state.
 * @param cardId - The card to play from hand.
 */
function play(G: LegendaryGameState, cardId: CardExtId): void {
  playCard(makeMockMoveContext(G) as unknown as Parameters<typeof playCard>[0], { cardId });
}

/**
 * Loads the real generated cvwr set data.
 *
 * @returns The parsed data/cards/cvwr.json.
 */
function loadCvwr(): { abbr: string; heroes: { slug: string; cards: { slug: string; abilities: string[] }[] }[] } {
  return JSON.parse(readFileSync(path.join(CARDS_DIRECTORY, 'cvwr.json'), 'utf8'));
}

describe('AC-1 — Penumbra as generated (WP-780 / D-24619)', () => {
  it('parses to one play-both-sides effect with no unresolved markers and records no hollow', () => {
    const cvwr = loadCvwr();
    const G = makeBothSidesState(cvwr, ['cvwr/cloak-dagger'], { hand: [], deck: [] });
    const penumbraHooks = G.heroAbilityHooks.filter((hook) => hook.cardId === 'cvwr/cloak-dagger/penumbra#0');
    assert.equal(penumbraHooks.length, 1, 'one hook for the one ability line');
    const hook = penumbraHooks[0]!;
    assert.deepEqual(hook.keywords, ['play-both-sides']);
    assert.deepEqual((hook.effects ?? []).map((effect) => effect.type), ['play-both-sides']);
    assert.equal(hook.unresolvedMarkers, undefined, 'the rule:divided-card hollow is retired');

    G.playerZones['0']!.inPlay = [hook.cardId];
    executeHeroEffects(G, makeMockMoveContext(G), '0', hook.cardId);
    assert.equal(G.turnEconomy.isPlayBothSidesActive, true, 'the handler arms the flag');
    assert.equal((G.diagnostics?.hollowEffects ?? []).length, 0, 'playing Penumbra records no hollow');
  });
});

describe('AC-2 / AC-9 — Penumbra then a split card plays both sides', () => {
  it('grants both faces, fires both hooks, keeps one inPlay entry and logs the locked lines', () => {
    const G = makeSyntheticState([SHADE, ALPHA], ['deck-1'] as CardExtId[]);
    play(G, SHADE);
    const messagesBefore = G.messages.length;
    play(G, ALPHA);
    const faceALabel = formatPlayedCardLabel(G.cardDisplayData, ALPHA, '');

    assert.equal(G.pendingSplitFaceChoices, undefined, 'no picker parked');
    assert.deepEqual(G.playerZones['0']!.inPlay, [SHADE, ALPHA], 'the split card is ONE inPlay entry (face a)');
    assert.deepEqual(G.turnEconomy.bothSidesPlayedCardIds, [ALPHA]);
    assert.equal(G.turnEconomy.attack, 4 + 2, 'Penumbra 4 + face a 2 attack');
    assert.equal(G.turnEconomy.recruit, 3, 'face b 3 recruit');

    const sequence = G.messages.slice(messagesBefore);
    assert.equal(sequence[0]!.text, `Player 0 played ${faceALabel}.`);
    assert.equal(sequence[0]!.card, ALPHA);
    assert.equal(sequence[1]!.text, `Penumbra: both sides of ${faceALabel} play as two different cards.`);
    assert.equal(sequence[1]!.card, ALPHA);
    assert.match(sequence[2]!.text, /^Player 0 resolved side a: /);
    assert.equal(sequence[2]!.card, ALPHA);
    const sideBIndex = sequence.findIndex((entry) => entry.text.startsWith('Player 0 resolved side b: '));
    assert.ok(sideBIndex > 2, 'side b resolves after side a');
    assert.equal(sequence[sideBIndex]!.card, BETA);
    for (const entry of sequence.slice(0, 3).concat(sequence[sideBIndex]!)) {
      assert.equal(entry.outcome, 'neutral');
    }
    const playedMatches = sequence.filter((entry) => PLAYED_LINE.test(entry.text));
    assert.equal(playedMatches.length, 1, 'only the played line matches PLAYED_LINE');
    // why: face b's [hc:tech] draw fired (face a is Tech); face a's gated draw did not.
    assert.deepEqual(G.playerZones['0']!.hand, ['deck-1'], "face b's hook fired");
    assert.equal(G.lastPlayEffectsFired, 1, 'effects fired = face a (0) + face b (1)');
  });

  it('AC-9: a second Penumbra leaves the flag unchanged (idempotent)', () => {
    const G = makeSyntheticState([SHADE]);
    play(G, SHADE);
    const economyAfterFirst = { ...G.turnEconomy };
    G.playerZones['0']!.inPlay = [...G.playerZones['0']!.inPlay];
    executeHeroEffects(G, makeMockMoveContext(G), '0', SHADE);
    assert.equal(G.turnEconomy.isPlayBothSidesActive, true);
    assert.deepEqual(G.turnEconomy, economyAfterFirst, 'a second activation rebuilds the same economy');
  });
});

describe('AC-3 / AC-4 / AC-5 — when both sides apply', () => {
  it('AC-3: a split card played BEFORE Penumbra parks the picker as today', () => {
    const G = makeSyntheticState([ALPHA, SHADE]);
    play(G, ALPHA);
    assert.equal(G.pendingSplitFaceChoices?.length, 1, 'the picker is parked');
    resolveSplitFaceChoice(makeMockMoveContext(G) as unknown as Parameters<typeof resolveSplitFaceChoice>[0], { face: 'a' });
    play(G, SHADE);
    assert.equal(G.turnEconomy.bothSidesPlayedCardIds, undefined, 'an earlier split card is not re-played');
  });

  it('AC-4: next turn the fields are absent and a split play parks the picker', () => {
    const G = makeSyntheticState([SHADE, ALPHA, ALPHA_COPY]);
    play(G, SHADE);
    play(G, ALPHA);
    // why: resetTurnEconomy is the play-phase turn.onBegin reset (game.ts) — no new reset code.
    G.turnEconomy = resetTurnEconomy();
    assert.equal(G.turnEconomy.isPlayBothSidesActive, undefined);
    assert.equal(G.turnEconomy.bothSidesPlayedCardIds, undefined);
    play(G, ALPHA_COPY);
    assert.equal(G.pendingSplitFaceChoices?.length, 1, 'the picker is back');
  });

  it('AC-5: a face-b id played under Penumbra normalises to one face-a entry and resolves both faces', () => {
    const G = makeSyntheticState([SHADE, BETA_COPY]);
    play(G, SHADE);
    play(G, BETA_COPY);
    assert.deepEqual(G.playerZones['0']!.inPlay, [SHADE, ALPHA_COPY], 'entered as face a');
    assert.deepEqual(G.turnEconomy.bothSidesPlayedCardIds, [ALPHA_COPY]);
    assert.equal(G.turnEconomy.attack, 4 + 2);
    assert.equal(G.turnEconomy.recruit, 3);
    assert.equal(G.pendingSplitFaceChoices, undefined);
  });
});

describe('AC-6 / AC-7 — superpower ordering and later-card visibility', () => {
  /**
   * Plays the stand-in, the split card, then card C, asserting the split card's draws.
   *
   * @returns The game state after card C is played.
   */
  function playStandInSplitThenCloser(): LegendaryGameState {
    const G = makeSyntheticState([SHADE, ALPHA, CLOSER], ['deck-1', 'deck-2', 'deck-3'] as CardExtId[]);
    play(G, SHADE);
    play(G, ALPHA);
    // why: exactly one draw — face b's (Strength sees face a's Tech via the physical entry).
    // Face a's [hc:strength] draw does NOT fire: face b is not yet played when face a resolves.
    assert.deepEqual(G.playerZones['0']!.hand, [CLOSER, 'deck-1'], 'only face b drew');
    play(G, CLOSER);
    return G;
  }

  it("face a does not see face b; face b sees face a; card C's draw sees face b", () => {
    const G = playStandInSplitThenCloser();
    // why: C's [hc:strength] draw fires ONLY because the marked entry expands to face b.
    assert.deepEqual(G.playerZones['0']!.hand, ['deck-1', 'deck-2'], "card C's draw fired");
  });

  it('the played-this-turn count after C is 4 (stand-in, face a, face b, C)', () => {
    const G = playStandInSplitThenCloser();
    assert.equal(evaluateCondition(G, '0', { type: 'playedThisTurn', value: '4' }), true, 'count of 4');
    assert.equal(evaluateCondition(G, '0', { type: 'playedThisTurn', value: '5' }), false);
  });

  it('playedCardIdsThisTurn is identity (a fresh deep-equal copy) with the marker absent or empty', () => {
    const G = makeSyntheticState([]);
    const inPlay = [SHADE, ALPHA];
    const absent = playedCardIdsThisTurn(G, inPlay);
    assert.deepEqual(absent, inPlay);
    assert.notEqual(absent, inPlay, 'a fresh copy, never the zone itself');
    G.turnEconomy = { ...G.turnEconomy, bothSidesPlayedCardIds: [] };
    assert.deepEqual(playedCardIdsThisTurn(G, inPlay), inPlay);
  });

  it('AC-7b: identity on the heroConditionHoldsForInPlay minimal-G slice (no turnEconomy)', () => {
    const slice = { playerZones: { '0': { inPlay: [ALPHA] } } } as unknown as LegendaryGameState;
    assert.deepEqual(playedCardIdsThisTurn(slice, [ALPHA]), [ALPHA]);
  });
});

describe('AC-7c — Blood Frenzy VP stays physical', () => {
  it('a both-sides split card with a Tech face b: Blood Frenzy Ultron VP equals computeFinalScores', () => {
    const ultron = 'core-villain-masters-of-evil-ultron-01' as CardExtId;
    const G = makeSyntheticState([]);
    // why: face b (beta) is Strength in the synthetic set; relabel a Tech face b so the parity
    // check is non-vacuous — an expanded read would count the Tech face b and diverge.
    G.cardTraits = { ...G.cardTraits, [BETA]: { heroClass: 'tech', team: 'marvel-knights' } };
    G.cardTraits = { ...G.cardTraits, [ALPHA]: { heroClass: 'strength', team: 'marvel-knights' } };
    G.playerZones['0']!.inPlay = [ALPHA];
    G.playerZones['0']!.victory = [ultron];
    G.villainDeckCardTypes = { [ultron]: 'villain' } as LegendaryGameState['villainDeckCardTypes'];
    G.turnEconomy = { ...G.turnEconomy, isPlayBothSidesActive: true, bothSidesPlayedCardIds: [ALPHA] };

    const bloodFrenzyVp = victoryPointValueForCard(G, '0', ultron);
    assert.equal(bloodFrenzyVp, 2, 'Ultron base 2 + 0 Tech: the physical entry is face a only');
    assert.equal(computeFinalScores(G).players[0]!.villainVP, bloodFrenzyVp, 'Blood Frenzy == final score');
  });
});

describe('AC-8 — physical reads are unchanged', () => {
  it('cleanup discards exactly one card and the duplicate-id invariant holds', () => {
    const G = makeSyntheticState([SHADE, ALPHA], ['deck-1', 'deck-2', 'deck-3', 'deck-4', 'deck-5', 'deck-6', 'deck-7', 'deck-8'] as CardExtId[]);
    play(G, SHADE);
    play(G, ALPHA);
    assert.equal(G.playerZones['0']!.inPlay.length, 2, 'inPlay count is physical: Penumbra + ONE split card');
    assert.doesNotThrow(() => checkNoCardInMultipleZones(G));

    applyEndOfTurnCleanup(G, '0', makeMockCtx());
    const discardedSplitEntries = G.playerZones['0']!.discard.filter((cardId) => cardId === ALPHA || cardId === BETA);
    assert.deepEqual(discardedSplitEntries, [ALPHA], 'the physical split card is discarded once, as face a');
    assert.doesNotThrow(() => checkNoCardInMultipleZones(G));
  });
});

describe('Manly Dullard — a split face b with discard-to-play under Penumbra (D-24620)', () => {
  const PENUMBRA = 'cvwr/cloak-dagger/penumbra#0' as CardExtId;
  const BOY_GENIUS = 'cvwr/hercules/boy-genius#0' as CardExtId;
  const MANLY_DULLARD = 'cvwr/hercules/manly-dullard#0' as CardExtId;

  /**
   * Builds a real-cvwr state holding Penumbra and the Boy Genius / Manly Dullard split card.
   *
   * @param extraHand - Additional hand cards beyond the two played.
   * @param deck - The seat's deck.
   * @returns A playable LegendaryGameState.
   */
  function makeHerculesState(extraHand: CardExtId[], deck: CardExtId[]): LegendaryGameState {
    return makeBothSidesState(
      loadCvwr(),
      ['cvwr/cloak-dagger', 'cvwr/hercules'],
      { hand: [PENUMBRA, BOY_GENIUS, ...extraHand], deck },
      {
        [PENUMBRA]: makeCardStatEntry({ attack: 4, recruit: 0, cost: 7 }),
        [BOY_GENIUS]: makeCardStatEntry({ attack: 0, recruit: 0, cost: 4 }),
        [MANLY_DULLARD]: makeCardStatEntry({ attack: 3, recruit: 0, cost: 4 }),
      },
    );
  }

  it('face a draws, then face b grants its attack and parks its own discard-to-play cost', () => {
    const G = makeHerculesState([], ['deck-1'] as CardExtId[]);
    play(G, PENUMBRA);
    play(G, BOY_GENIUS);
    assert.deepEqual(G.playerZones['0']!.hand, ['deck-1'], "face a (Boy Genius) drew");
    assert.equal(G.turnEconomy.attack, 4 + 3, "face b (Manly Dullard) 3 attack granted");
    assert.deepEqual(
      G.pendingDiscardToPlay,
      [{ playerID: '0', sourceCardId: MANLY_DULLARD, remaining: 1 }],
      'face b parks its own discard cost, sourced to the face-b id (the picker-path behaviour)',
    );
  });

  it('with no card left in hand, face b is skipped: no attack, no hooks, no marker, one skip line (D-24621)', () => {
    const G = makeHerculesState([], []);
    play(G, PENUMBRA);
    play(G, BOY_GENIUS);
    assert.deepEqual(G.playerZones['0']!.hand, [], 'face a drew nothing from an empty deck');
    assert.equal(G.turnEconomy.attack, 4, 'face b (Manly Dullard) grants no +3 attack');
    assert.equal(G.pendingDiscardToPlay, undefined, 'no unpayable choice is parked');
    assert.equal(G.turnEconomy.bothSidesPlayedCardIds, undefined, 'only face a was played — not marked');
    assert.deepEqual(G.playerZones['0']!.inPlay, [PENUMBRA, BOY_GENIUS], 'one face-a entry');
    const skipLines = G.messages.filter((entry) => entry.text.includes('could not play side b'));
    assert.equal(skipLines.length, 1, 'exactly one skip line');
    assert.equal(skipLines[0]!.card, MANLY_DULLARD);
    assert.ok(
      !G.messages.some((entry) => entry.text.includes('resolved side b')),
      'face b never resolved',
    );
    assert.ok(
      !G.messages.some((entry) => entry.text.includes('could not pay the discard-to-play cost')),
      "face b's hooks never fired, so the handler's fail-closed line is not logged",
    );
  });

  it('with a card in hand, face b grants its attack and paying the cost discards it (D-24621)', () => {
    const SPARE = 'core/spider-man/astonishing-strength#0' as CardExtId;
    const G = makeHerculesState([SPARE], []);
    play(G, PENUMBRA);
    play(G, BOY_GENIUS);
    assert.equal(G.turnEconomy.attack, 4 + 3, 'face b attack granted');
    assert.deepEqual(G.turnEconomy.bothSidesPlayedCardIds, [BOY_GENIUS], 'both faces played — marked');
    assert.deepEqual(G.pendingDiscardToPlay, [{ playerID: '0', sourceCardId: MANLY_DULLARD, remaining: 1 }]);
    resolveDiscardToPlay(makeMockMoveContext(G) as unknown as Parameters<typeof resolveDiscardToPlay>[0], { cardId: SPARE });
    assert.deepEqual(G.playerZones['0']!.hand, []);
    assert.ok(G.playerZones['0']!.discard.includes(SPARE), 'the cost is charged');
    assert.equal(G.pendingDiscardToPlay?.length ?? 0, 0);
  });
});
