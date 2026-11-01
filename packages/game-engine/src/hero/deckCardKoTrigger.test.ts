/**
 * "Whenever a card is KO'd from your deck this turn, you may draw a card" — Miek's Endless
 * Appetite (WP-855 / D-24791).
 *
 * The printed line parsed to an empty hook (the card did nothing beyond its printed Attack).
 * These tests build the REAL hooks from the committed data/cards/wwhk.json (the marker pass
 * output), drive the real KO sites, and resolve through resolveDeferredHeroGrants, so they pin
 * the parse, the deck-only signal, the per-KO draw and the hold together. The last suite is the
 * deck-zone drift pin: every owned KO call that passes the literal 'deck' zone, by function.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects, resolveDeferredHeroGrants } from './heroEffects.execute.js';
import { DECK_CARD_KOED_CONDITION_TYPE } from './heroConditions.evaluate.js';
import { resolveScryKoChoice } from '../moves/scryKoChoice.resolve.js';
import { resolveKoDiscardChoice } from '../moves/koDiscardChoice.resolve.js';
import { resolveMelterKoChoice } from '../moves/melterKoChoice.resolve.js';
import { resolveRuthlessDictatorChoice } from '../moves/ruthlessDictatorChoice.resolve.js';
import { resolveHeroChoice } from '../moves/heroChoice.resolve.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const SOURCE_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARDS_DIRECTORY = join(SOURCE_DIRECTORY, '..', '..', '..', 'data', 'cards');

const DECK_A = 'test/deck-card/alpha#0' as CardExtId;
const DECK_B = 'test/deck-card/bravo#0' as CardExtId;
const DECK_C = 'test/deck-card/charlie#0' as CardExtId;
const DECK_D = 'test/deck-card/delta#0' as CardExtId;
const DECK_E = 'test/deck-card/echo#0' as CardExtId;
const PLAIN_HERO = 'test/plain-hero/punch#0' as CardExtId;

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real hooks for the given hero decks from the committed card data.
 *
 * @param heroDeckIds - Set-qualified hero ids (wwhk/miek-the-unhived, dkcy/bishop).
 * @returns Every hook those decks produce.
 */
function buildHooks(heroDeckIds: string[]): HeroAbilityHook[] {
  const sets: Record<string, unknown> = {};
  for (const heroDeckId of heroDeckIds) {
    const setAbbr = heroDeckId.split('/')[0]!;
    sets[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  }
  const registry = { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
  return buildHeroAbilityHooks(registry, { heroDeckIds } as unknown as MatchConfiguration);
}

/**
 * Returns the card id of the given copy of a card, asserting the data builds a hook for it.
 *
 * @param hooks - The decks' hooks.
 * @param cardPath - `<set>/<hero>/<card>`.
 * @param copy - The copy number.
 * @returns The card's ext id.
 */
function cardIdOf(hooks: HeroAbilityHook[], cardPath: string, copy: number): CardExtId {
  const cardId = `${cardPath}#${copy}`;
  assert.ok(hooks.some((hook) => hook.cardId === cardId), `the card data builds a hook for ${cardId}`);
  return cardId as CardExtId;
}

/**
 * Returns the given copy of Endless Appetite.
 *
 * @param hooks - The decks' hooks.
 * @param copy - The copy number.
 * @returns The card's ext id.
 */
function endlessAppetite(hooks: HeroAbilityHook[], copy: number): CardExtId {
  return cardIdOf(hooks, 'wwhk/miek-the-unhived/endless-appetite', copy);
}

/**
 * A two-seat state wide enough for the hero executor and the KO moves, with player 0's deck set.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @param deck - Player 0's deck, top first.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[], deck: CardExtId[]): LegendaryGameState {
  const G = {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: ['wwhk/miek-the-unhived'],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: ['wwhk/miek-the-unhived'],
    },
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones() }, '1': { ...makePlayerZones() } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    scheme: { twistPile: [] },
    heroAbilityHooks: hooks,
    cardStats: {},
    cardTraits: {},
    cardKeywords: {},
    cardDisplayData: {},
    notableEvents: [],
  } as unknown as LegendaryGameState;
  G.playerZones['0']!.deck = [...deck];
  return G;
}

/**
 * Plays a card for player 0: puts it in play and runs its hooks.
 *
 * @param G - The game state.
 * @param cardId - The card to play.
 */
function playCard(G: LegendaryGameState, cardId: CardExtId): void {
  G.playerZones['0']!.inPlay.push(cardId);
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/**
 * The move context a KO move reads.
 *
 * @param G - The game state.
 * @param playerID - The acting player.
 * @returns A move context.
 */
function moveContext(G: LegendaryGameState, playerID: string): never {
  return { G, playerID, ctx: { ...mockCtx.ctx, currentPlayer: playerID }, random: mockCtx.random } as never;
}

/**
 * KOs one card from player 0's deck through the real scry-KO move (one parked choice).
 *
 * @param G - The game state.
 * @param revealedCardIds - The deck cards the choice shows.
 * @param koCardId - The revealed card to KO.
 */
function scryKoFromDeck(G: LegendaryGameState, revealedCardIds: CardExtId[], koCardId: CardExtId): void {
  G.pendingScryKoChoices = [{ choiceType: 'scry-ko', playerID: '0', revealedCardIds: [...revealedCardIds] }];
  resolveScryKoChoice(moveContext(G, '0'), { cardId: koCardId });
}

describe('Endless Appetite parse and play (WP-855 / D-24791)', () => {
  it('every copy carries the deck-KO condition and only the gated draw 1', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const appetiteHooks = hooks.filter((hook) => hook.cardId.startsWith('wwhk/miek-the-unhived/endless-appetite#'));
    assert.equal(appetiteHooks.length, 3, 'one hook per copy of the card');
    for (const hook of appetiteHooks) {
      assert.deepEqual(hook.conditions, [{ type: DECK_CARD_KOED_CONDITION_TYPE, value: '1' }]);
      assert.deepEqual(hook.effects, [{ type: 'draw', magnitude: 1 }], 'no unconditional effect');
    }
  });

  it('AC-1: playing it draws nothing and logs the waiting line', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B]);
    playCard(G, endlessAppetite(hooks, 0));

    assert.equal(G.playerZones['0']!.hand.length, 0);
    assert.equal(G.deferredConditionalGrants?.length, 1);
    assert.match(G.messages[G.messages.length - 1]!.text, /is waiting — it needs a card to be KO'd from your deck this turn/);

    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.hand.length, 0, 'a move with no KO draws nothing');
  });

  it('a count already above 0 at play still records the grant (always-defer)', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B]);
    playCard(G, endlessAppetite(hooks, 0));
    // why: a deck KO earlier in this same move, while the first copy waits.
    G.deckCardsKoedSinceResolve = { '0': 1 };

    playCard(G, endlessAppetite(hooks, 1));

    assert.equal(G.deferredConditionalGrants?.length, 2, 'the second copy waits too');
    assert.equal(G.playerZones['0']!.hand.length, 0, 'nothing draws at play');
    assert.match(G.messages[G.messages.length - 1]!.text, /is waiting/);
  });
});

describe('Endless Appetite per-KO draw and routing (WP-855 / D-24791)', () => {
  it('AC-2: a scry KO from the deck draws 1', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B, DECK_C]);
    playCard(G, endlessAppetite(hooks, 0));

    scryKoFromDeck(G, [DECK_A, DECK_B], DECK_A);
    assert.deepEqual(G.deckCardsKoedSinceResolve, { '0': 1 }, 'the deck KO site records the owner');
    resolveDeferredHeroGrants(G, mockCtx);

    assert.deepEqual(G.playerZones['0']!.hand, [DECK_B], 'hand +1, from the new deck top');
    assert.equal(Object.hasOwn(G, 'deckCardsKoedSinceResolve'), false, 'the count is consumed');
  });

  it('AC-2: a second deck KO in a later move draws 1 more', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B, DECK_C, DECK_D, DECK_E]);
    playCard(G, endlessAppetite(hooks, 0));

    scryKoFromDeck(G, [DECK_A, DECK_B], DECK_A);
    resolveDeferredHeroGrants(G, mockCtx);
    scryKoFromDeck(G, [DECK_C, DECK_D], DECK_C);
    resolveDeferredHeroGrants(G, mockCtx);

    assert.deepEqual(G.playerZones['0']!.hand, [DECK_B, DECK_D], 'one draw per KO (repeatable)');
  });

  it('AC-3: a non-KO move after a deck KO draws nothing', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B, DECK_C]);
    playCard(G, endlessAppetite(hooks, 0));
    scryKoFromDeck(G, [DECK_A, DECK_B], DECK_A);
    resolveDeferredHeroGrants(G, mockCtx);

    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.playerZones['0']!.hand.length, 1);
  });

  it('AC-3: a discard-pile KO draws nothing and records no deck count', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B]);
    playCard(G, endlessAppetite(hooks, 0));
    G.playerZones['0']!.discard.push(PLAIN_HERO);

    G.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 1 }];
    resolveKoDiscardChoice(moveContext(G, '0'), { cardIds: [PLAIN_HERO] });
    assert.deepEqual(G.ko, [PLAIN_HERO], 'the discard KO happened');
    assert.equal(Object.hasOwn(G, 'deckCardsKoedSinceResolve'), false, 'not a deck KO');
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.playerZones['0']!.hand.length, 0);
  });

  it('AC-2: two copies and one deck KO draw 2', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B, DECK_C]);
    playCard(G, endlessAppetite(hooks, 0));
    playCard(G, endlessAppetite(hooks, 1));

    scryKoFromDeck(G, [DECK_A, DECK_B], DECK_A);
    resolveDeferredHeroGrants(G, mockCtx);

    assert.deepEqual(G.playerZones['0']!.hand, [DECK_B, DECK_C]);
  });

  it('AC-3: a deck KO before the play draws nothing', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B, DECK_C]);
    scryKoFromDeck(G, [DECK_A, DECK_B], DECK_A);
    resolveDeferredHeroGrants(G, mockCtx);

    playCard(G, endlessAppetite(hooks, 0));
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.playerZones['0']!.hand.length, 0);
  });

  it('AC-4: a Melter KO from another player\'s deck routes to that owner and draws nothing for player 0', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B]);
    playCard(G, endlessAppetite(hooks, 0));
    G.playerZones['1']!.deck = [DECK_C, DECK_D];
    G.pendingMelterKoChoices = [{ choiceType: 'melter-ko', playerID: '0', revealedTops: [{ ownerPlayerID: '1', cardId: DECK_C }] }];

    resolveMelterKoChoice(moveContext(G, '0'), { ownerPlayerID: '1', cardId: DECK_C, keep: false });
    assert.deepEqual(G.deckCardsKoedSinceResolve, { '1': 1 }, 'routed to the owner, not the active player');
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.playerZones['0']!.hand.length, 0);
    assert.equal(G.playerZones['1']!.hand.length, 0, 'player 1 has no waiting grant');
  });

  it('AC-6: Absorb Energies and Endless Appetite both waiting, one deck KO pays both', () => {
    const hooks = buildHooks(['dkcy/bishop', 'wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B, DECK_C]);
    playCard(G, cardIdOf(hooks, 'dkcy/bishop/absorb-energies', 0));
    playCard(G, endlessAppetite(hooks, 0));

    scryKoFromDeck(G, [DECK_A, DECK_B], DECK_A);
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, 2, 'Absorb Energies +2 Recruit');
    assert.deepEqual(G.playerZones['0']!.hand, [DECK_B], 'Endless Appetite draws 1');
  });

  it('AC-7: with no deck-KO grant waiting, a deck KO leaves no deck count key', () => {
    const hooks = buildHooks(['dkcy/bishop', 'wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B]);
    // why: an Absorb Energies grant waits, so the owned count is written; the deck count's
    // own gate must still keep its key out.
    playCard(G, cardIdOf(hooks, 'dkcy/bishop/absorb-energies', 0));

    scryKoFromDeck(G, [DECK_A, DECK_B], DECK_A);

    assert.equal(G.ko.length, 1, 'the deck KO happened');
    assert.deepEqual(G.ownedCardsKoedSinceResolve, { '0': 1 });
    assert.equal(Object.hasOwn(G, 'deckCardsKoedSinceResolve'), false);
  });

  it('AC-7: the turn boundary clears the waiting grant and the count', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B]);
    playCard(G, endlessAppetite(hooks, 0));
    G.deckCardsKoedSinceResolve = { '0': 1 };

    applyOnBeginParity(G, '0');

    assert.equal(Object.hasOwn(G, 'deferredConditionalGrants'), false);
    assert.equal(Object.hasOwn(G, 'deckCardsKoedSinceResolve'), false);
  });
});

describe('Endless Appetite hold while a choice is parked (WP-855 / D-24791)', () => {
  it('AC-5: Ruthless Dictator — the draw waits for the last disposition, then takes the card put back', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B, DECK_C, DECK_D]);
    playCard(G, endlessAppetite(hooks, 0));
    G.pendingRuthlessDictatorChoices = [{
      choiceType: 'ruthless-dictator',
      playerID: '0',
      revealedCardIds: [DECK_A, DECK_B, DECK_C],
      availableDispositions: ['ko', 'discard', 'top'],
    }];

    resolveRuthlessDictatorChoice(moveContext(G, '0'), { cardId: DECK_A, disposition: 'ko' });
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.hand.length, 0, 'held: the choice still snapshots the deck top');
    assert.deepEqual(G.deckCardsKoedSinceResolve, { '0': 1 }, 'the count is kept while held');

    resolveRuthlessDictatorChoice(moveContext(G, '0'), { cardId: DECK_B, disposition: 'discard' });
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.hand.length, 0, 'still held');

    resolveRuthlessDictatorChoice(moveContext(G, '0'), { cardId: DECK_C, disposition: 'top' });
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.pendingRuthlessDictatorChoices?.length ?? 0, 0, 'the queue completes');
    assert.deepEqual(G.playerZones['0']!.hand, [DECK_C], 'one draw, of the card put back on top');
    assert.equal(Object.hasOwn(G, 'deckCardsKoedSinceResolve'), false, 'consumed once released');
  });

  it('AC-5: a parked pendingHeroChoice holds the draw until it resolves', () => {
    const hooks = buildHooks(['wwhk/miek-the-unhived']);
    const G = makeState(hooks, [DECK_A, DECK_B, DECK_C]);
    playCard(G, endlessAppetite(hooks, 0));
    // why: Gambit's Kinetic Card parks a discard-or-return choice on deck[0] without
    // blocking play, so a deck KO can land while it is open.
    G.pendingHeroChoice = { choiceType: 'discard-or-return', cardId: DECK_A, playerID: '0' };

    scryKoFromDeck(G, [DECK_B], DECK_B);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.hand.length, 0, 'held: Kinetic Card still holds deck[0]');
    assert.deepEqual(G.deckCardsKoedSinceResolve, { '0': 1 });

    resolveHeroChoice(moveContext(G, '0'), { resolution: 'discard' });
    resolveDeferredHeroGrants(G, mockCtx);

    assert.deepEqual(G.playerZones['0']!.discard, [DECK_A], 'Kinetic Card discarded its card');
    assert.deepEqual(G.playerZones['0']!.hand, [DECK_C], 'the draw takes the card that lay below it');
  });
});

// ---------------------------------------------------------------------------
// Deck-zone drift pin
// ---------------------------------------------------------------------------

// why: WP-855 / D-24791 — every owned KO call that passes the literal 'deck' zone, by
// enclosing function. These are the KOs from a player's deck that Endless Appetite reacts
// to (the ninth deck site, the operator koFromPlayerZone, passes its narrowed `from.zone`).
// A 'deck' added to a call that does not take a deck card, or dropped from one that does,
// changes the scanned map and fails the deepEqual below. The WP-853 LOCKED_TABLE
// (ownedCardKoTrigger.test.ts) still classifies every KO site; this pins the zone.
const LOCKED_DECK_ZONE_TABLE: Record<string, number> = {
  'hero/heroEffects.execute.ts#applyRevealKo': 1,
  'moves/melterKoChoice.resolve.ts#resolveMelterKoChoice': 1,
  'moves/revealThreeAssign.resolve.ts#applyRevealThreeDisposition': 1,
  'moves/revealTopDispose.resolve.ts#resolveRevealTopDispose': 1,
  'moves/ruthlessDictatorChoice.resolve.ts#resolveRuthlessDictatorChoice': 1,
  'moves/scryKoChoice.resolve.ts#resolveScryKoChoice': 1,
  'villain/villainEffects.execute.ts#villainEffectScryKoOwnDeck': 1,
  'villain/villainEffects.execute.ts#villainEffectRevealTopKoGreyOrDrawByClass': 1,
};

/**
 * Removes comments, keeping string and template literals intact, so a call quoted in a
 * comment never counts and a `//` or `/*` inside a string never eats real code.
 *
 * why: copied from ownedCardKoTrigger.test.ts (its helpers are private and that file stays
 * frozen); duplicate-first (00.6 Rule 1).
 *
 * @param source - TypeScript source text.
 * @returns The source with comments replaced by spaces (newlines kept).
 */
function stripComments(source: string): string {
  let output = '';
  let index = 0;
  while (index < source.length) {
    const character = source[index]!;
    const next = source[index + 1];
    if (character === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
      }
    } else if (character === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        output += source[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      index += 2;
    } else if (character === '\'' || character === '"' || character === '`') {
      output += character;
      index += 1;
      while (index < source.length && source[index] !== character) {
        if (source[index] === '\\') {
          output += source[index];
          index += 1;
        }
        output += source[index] ?? '';
        index += 1;
      }
      output += source[index] ?? '';
      index += 1;
    } else {
      output += character;
      index += 1;
    }
  }
  return output;
}

/**
 * Names the function declaration enclosing a position: the nearest preceding
 * `function <name>(` (export / async prefixes allowed).
 *
 * @param declarations - Each declaration's start offset and name, in source order.
 * @param position - The offset of the call.
 * @returns The enclosing function name, or '<module>' before any declaration.
 */
function enclosingFunction(declarations: { offset: number; name: string }[], position: number): string {
  let name = '<module>';
  for (const declaration of declarations) {
    if (declaration.offset > position) {
      break;
    }
    name = declaration.name;
  }
  return name;
}

/**
 * Returns a call's argument text: from just after its opening parenthesis to the matching
 * closing one.
 *
 * @param code - Comment-stripped source text.
 * @param openIndex - The offset of the call's opening parenthesis.
 * @returns The argument text (the rest of the source if the call never closes).
 */
function callArguments(code: string, openIndex: number): string {
  let depth = 0;
  for (let index = openIndex; index < code.length; index++) {
    if (code[index] === '(') {
      depth += 1;
    } else if (code[index] === ')') {
      depth -= 1;
      if (depth === 0) {
        return code.slice(openIndex + 1, index);
      }
    }
  }
  return code.slice(openIndex + 1);
}

/**
 * Scans one source file for owned-KO recorder calls that pass the literal 'deck', by function.
 *
 * @param relativePath - The file's path relative to src, with forward slashes.
 * @param source - The file's text.
 * @returns A map `<path>#<function>` → count of such calls (0 entries omitted).
 */
function scanDeckZoneRecords(relativePath: string, source: string): Record<string, number> {
  const code = stripComments(source);
  const declarations: { offset: number; name: string }[] = [];
  for (const match of code.matchAll(/\bfunction\s+([A-Za-z0-9_$]+)\s*[(<]/g)) {
    declarations.push({ offset: match.index, name: match[1]! });
  }
  const result: Record<string, number> = {};
  for (const match of code.matchAll(/(\bfunction\s+)?\brecordOwnedCardKoed\(/g)) {
    if (match[1] !== undefined) {
      continue;
    }
    const openIndex = match.index + match[0].length - 1;
    if (!callArguments(code, openIndex).includes('\'deck\'')) {
      continue;
    }
    const key = `${relativePath}#${enclosingFunction(declarations, match.index)}`;
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

/**
 * Lists every non-test .ts file under a directory.
 *
 * @param directory - The directory to walk.
 * @returns Absolute file paths, sorted.
 */
function listSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory).sort()) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Deck-zone drift pin (WP-855 / D-24791)', () => {
  it('AC-8: the owned KO calls passing \'deck\' are exactly the locked deck sites', () => {
    const scanned: Record<string, number> = {};
    for (const file of listSourceFiles(SOURCE_DIRECTORY)) {
      const relativePath = relative(SOURCE_DIRECTORY, file).split('\\').join('/');
      Object.assign(scanned, scanDeckZoneRecords(relativePath, readFileSync(file, 'utf8')));
    }
    assert.deepEqual(
      scanned,
      LOCKED_DECK_ZONE_TABLE,
      'An owned KO call gained or lost the \'deck\' zone. Pass the zone the card actually left: ' +
        '\'deck\' only for a card taken from the owner\'s deck (Endless Appetite, D-24791), then ' +
        'update LOCKED_DECK_ZONE_TABLE.',
    );
  });

  it('non-vacuous: a \'deck\' call in the wrong function changes the map, and comments and other zones never count', () => {
    const correct = [
      'function site() {',
      "  recordOwnedCardKoed(G, owner, cardId, 'deck');",
      "  recordOwnedCardKoed(G, owner, cardId, 'hand');",
      "  // recordOwnedCardKoed(G, owner, cardId, 'deck');",
      '}',
      'function other() {',
      '  recordOwnedCardKoed(G, owner, readId(zones), from.zone);',
      '}',
      "export function recordOwnedCardKoed(G, owner, cardId, fromZone) { return fromZone === 'deck'; }",
    ].join('\n');
    const misplaced = [
      'function site() {',
      "  recordOwnedCardKoed(G, owner, cardId, 'hand');",
      '}',
      'function other() {',
      "  recordOwnedCardKoed(\n    G,\n    owner,\n    readId(zones),\n    'deck',\n  );",
      '}',
    ].join('\n');

    assert.deepEqual(scanDeckZoneRecords('a.ts', correct), { 'a.ts#site': 1 });
    assert.deepEqual(scanDeckZoneRecords('a.ts', misplaced), { 'a.ts#other': 1 });
    assert.notDeepEqual(scanDeckZoneRecords('a.ts', correct), scanDeckZoneRecords('a.ts', misplaced));
  });
});
