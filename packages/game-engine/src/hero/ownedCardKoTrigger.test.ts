/**
 * "Whenever a card you own is KO'd this turn" — Bishop's Absorb Energies (WP-853 / D-24789).
 *
 * The printed line was parsed to a flat on-play +2 Recruit (phantom on every play, nothing
 * on a KO — operator match g0OSXmiDT3o). These tests build the REAL hooks from the committed
 * data/cards/dkcy.json (the marker pass output), drive the real KO sites, and resolve through
 * resolveDeferredHeroGrants, so they pin the parse, the owner signal and the per-KO firing
 * together. The last suite is the per-function KO-site drift pin: every KO site in the engine
 * is classified (owned or not), so a new, unclassified site fails here.
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
import { recordDeferredConditionalGrant } from './deferredConditionalGrants.js';
import { OWNED_CARD_KOED_CONDITION_TYPE } from './heroConditions.evaluate.js';
import { resolveOptionalKoReward } from '../moves/optionalKoReward.resolve.js';
import { resolveKoDiscardChoice } from '../moves/koDiscardChoice.resolve.js';
import { healWounds } from '../moves/healWounds.js';
import { applyVanishingIllusionsKo } from '../moves/seatChoiceTactics.js';
import { mastermindStrikeHandler } from '../rules/mastermindHandlers.js';
import { SCHEME_TWIST_RESOLVERS } from '../rules/schemeTwistResolvers.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState, MatchConfiguration, PendingSeatChoice } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  makeCardStatEntry,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const SOURCE_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARDS_DIRECTORY = join(SOURCE_DIRECTORY, '..', '..', '..', 'data', 'cards');

const OTHER_COVERT = 'test/covert-hero/sneak#0';
const PLAIN_HERO = 'test/plain-hero/punch#0';

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0', numPlayers: 2 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real hooks for Bishop's hero deck from the committed card data.
 *
 * @returns Every hook the Bishop deck produces.
 */
function buildBishopHooks(): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'dkcy.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'dkcy' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: ['dkcy/bishop'] } as unknown as MatchConfiguration);
}

/**
 * Returns the card id of the given copy of a Bishop card.
 *
 * @param hooks - The Bishop deck's hooks.
 * @param cardSlug - The card slug.
 * @param copy - The copy number.
 * @returns The card's ext id.
 */
function bishopCardId(hooks: HeroAbilityHook[], cardSlug: string, copy: number): CardExtId {
  const cardId = `dkcy/bishop/${cardSlug}#${copy}`;
  assert.ok(hooks.some((hook) => hook.cardId === cardId), `the dkcy data builds a hook for ${cardId}`);
  return cardId as CardExtId;
}

/**
 * A two-seat state wide enough for the hero executor, the KO moves, the Red Skull strike,
 * the HQ twist and the Vanishing Illusions tactic.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[]): LegendaryGameState {
  return {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'core/red-skull',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: ['dkcy/bishop'],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'core/red-skull',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: ['dkcy/bishop'],
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
    cardTraits: { [OTHER_COVERT]: { heroClass: 'covert' } },
    cardKeywords: {},
    cardDisplayData: {},
    notableEvents: [],
  } as unknown as LegendaryGameState;
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

describe('Absorb Energies parse (WP-853 / D-24789)', () => {
  it('every copy carries the owned-KO condition and only the gated +2 recruit', () => {
    const hooks = buildBishopHooks();
    const absorbHooks = hooks.filter((hook) => hook.cardId.startsWith('dkcy/bishop/absorb-energies#'));
    assert.equal(absorbHooks.length, 5, 'one hook per copy of the card');
    for (const hook of absorbHooks) {
      assert.deepEqual(hook.conditions, [{ type: OWNED_CARD_KOED_CONDITION_TYPE, value: '1' }]);
      assert.deepEqual(hook.effects, [{ type: 'recruit', magnitude: 2 }], 'no unconditional effect');
    }
  });
});

describe('Absorb Energies play and per-KO grant (WP-853 / D-24789)', () => {
  it('AC-1: playing it gives 0 Recruit and logs the waiting line', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));

    assert.equal(G.turnEconomy.recruit, 0);
    assert.equal(G.deferredConditionalGrants?.length, 1);
    assert.match(G.messages[G.messages.length - 1]!.text, /is waiting — it needs a card you own to be KO'd this turn/);

    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 0, 'a move with no KO grants nothing');
  });

  it('AC-2: Whatever the Cost\'s KO through resolveOptionalKoReward gives +2', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    G.playerZones['0']!.inPlay.push(OTHER_COVERT);
    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));
    G.playerZones['0']!.hand.push(PLAIN_HERO);
    playCard(G, bishopCardId(hooks, 'whatever-the-cost', 0));
    resolveDeferredHeroGrants(G, mockCtx);
    const recruitBeforeKo = G.turnEconomy.recruit;
    assert.equal(G.pendingOptionalKoRewards?.length, 1, 'Whatever the Cost parks its optional KO');

    resolveOptionalKoReward(moveContext(G, '0'), { zone: 'hand', cardId: PLAIN_HERO });
    assert.deepEqual(G.ownedCardsKoedSinceResolve, { '0': 1 }, 'the KO site records the owner');
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, recruitBeforeKo + 2);
    assert.equal(Object.hasOwn(G, 'ownedCardsKoedSinceResolve'), false, 'the count is consumed');
  });

  it('AC-2: a resolveKoDiscardChoice KO gives +2, a second KO move +2 more, a non-KO move nothing', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));
    G.playerZones['0']!.discard.push(PLAIN_HERO, OTHER_COVERT);

    G.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 1 }];
    resolveKoDiscardChoice(moveContext(G, '0'), { cardIds: [PLAIN_HERO] });
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 2, 'first KO -> +2');

    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 2, 'a non-KO move grants nothing');

    G.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 1 }];
    resolveKoDiscardChoice(moveContext(G, '0'), { cardIds: [OTHER_COVERT] });
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 4, 'second KO -> +2 more (repeatable)');
  });

  it('AC-2: one move KOing three owned cards (heal three Wounds) gives +6', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));
    G.playerZones['0']!.hand.push(WOUND_EXT_ID, WOUND_EXT_ID, WOUND_EXT_ID);

    healWounds(moveContext(G, '0'));
    assert.deepEqual(G.ownedCardsKoedSinceResolve, { '0': 3 }, 'one count per healed Wound');
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, 6);
  });

  it('AC-2: two Absorb copies and one KO give +4', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));
    playCard(G, bishopCardId(hooks, 'absorb-energies', 1));
    G.playerZones['0']!.hand.push(WOUND_EXT_ID);

    healWounds(moveContext(G, '0'));
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, 4);
  });

  it('AC-3 / AC-6: a KO before the play gives nothing and creates no count key', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    G.playerZones['0']!.hand.push(WOUND_EXT_ID);

    healWounds(moveContext(G, '0'));
    assert.equal(G.ko.length, 1, 'the KO happened');
    assert.equal(Object.hasOwn(G, 'ownedCardsKoedSinceResolve'), false, 'no waiting grant -> no key');
    resolveDeferredHeroGrants(G, mockCtx);

    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.turnEconomy.recruit, 0);
  });

  it('a count already above 0 at play still records the grant (always-defer)', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    const firstCopy = bishopCardId(hooks, 'absorb-energies', 0);
    playCard(G, firstCopy);
    // why: a KO earlier in this same move, while the first copy waits.
    G.ownedCardsKoedSinceResolve = { '0': 1 };

    playCard(G, bishopCardId(hooks, 'absorb-energies', 1));

    assert.equal(G.deferredConditionalGrants?.length, 2, 'the second copy waits too');
    assert.equal(G.turnEconomy.recruit, 0, 'nothing fires at play');
    assert.match(G.messages[G.messages.length - 1]!.text, /is waiting/);
  });

  it('the turn boundary clears the waiting grant and the count', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));
    G.ownedCardsKoedSinceResolve = { '0': 1 };

    applyOnBeginParity(G, '0');

    assert.equal(Object.hasOwn(G, 'deferredConditionalGrants'), false);
    assert.equal(Object.hasOwn(G, 'ownedCardsKoedSinceResolve'), false);
  });
});

describe('Absorb Energies owner routing (WP-853 / D-24789)', () => {
  it('AC-4: another player\'s card KO\'d by the Red Skull strike gives the active player nothing', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));
    // why: the active player holds no Hero, so only player 1 loses one.
    G.playerZones['1']!.hand.push(PLAIN_HERO);

    mastermindStrikeHandler(G, {}, { cardId: 'strike-card' }, {});
    assert.deepEqual(G.ko, [PLAIN_HERO]);
    assert.deepEqual(G.ownedCardsKoedSinceResolve, { '1': 1 }, 'routed to the owner, not the active player');
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, 0);
  });

  it('AC-4: an HQ KO (koFromHq) gives nothing and records nothing', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));
    G.hq = [PLAIN_HERO, null, null, null, null] as LegendaryGameState['hq'];
    G.cardStats[PLAIN_HERO] = { ...makeCardStatEntry(), cost: 1 };

    SCHEME_TWIST_RESOLVERS['ko-from-hq'](
      G,
      { random: mockCtx.random, ctx: { currentPlayer: '0' } } as never,
      {},
      { koCount: 1 },
      'twist-card' as CardExtId,
    );
    assert.equal(G.ko.length, 1, 'the HQ card was KO\'d');
    assert.equal(Object.hasOwn(G, 'ownedCardsKoedSinceResolve'), false);
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, 0);
  });

  it('AC-4: a Victory Pile KO (Vanishing Illusions) gives nothing and records nothing (RS-1)', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    playCard(G, bishopCardId(hooks, 'absorb-energies', 0));
    G.playerZones['0']!.victory.push('test/villain/thug#0');
    const choice = {
      addressedSeats: ['0'],
      seatPrompts: { '0': { options: [{ cardId: 'test/villain/thug#0' }] } },
      submissions: { '0': { optionIndex: 0 } },
    } as unknown as PendingSeatChoice;

    applyVanishingIllusionsKo(G, choice);
    assert.equal(G.ko.length, 1, 'the Victory Pile card was KO\'d');
    assert.equal(Object.hasOwn(G, 'ownedCardsKoedSinceResolve'), false);
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, 0);
  });

  it('a waiting grant for another player does not fire on the active player\'s KO', () => {
    const hooks = buildBishopHooks();
    const G = makeState(hooks);
    const absorbId = bishopCardId(hooks, 'absorb-energies', 0);
    recordDeferredConditionalGrant(G, '1', absorbId, G.heroAbilityHooks.findIndex((hook) => hook.cardId === absorbId));
    G.playerZones['0']!.hand.push(WOUND_EXT_ID);

    healWounds(moveContext(G, '0'));
    assert.deepEqual(G.ownedCardsKoedSinceResolve, { '0': 1 });
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.turnEconomy.recruit, 0, 'player 1\'s grant reads player 1\'s count');
  });
});

// ---------------------------------------------------------------------------
// KO-site drift pin
// ---------------------------------------------------------------------------

/** KO sites and owned-KO recorder calls in one function. */
interface KoSiteCounts {
  koSites: number;
  ownedRecords: number;
}

// why: WP-853 / D-24789 — every KO site in the engine, by enclosing function, with how many
// of them record an owned KO. OWNED sites (a card leaving a player's hand, deck, discard or
// cards in play) record once each; HQ, Villain Deck and Victory Pile sites (x/0) do not
// (RS-1: Victory Pile not counted). A new KO site anywhere, or a recorder moved to another
// function, changes the scanned map and fails the deepEqual below until it is classified.
const LOCKED_TABLE: Record<string, KoSiteCounts> = {
  'hero/heroEffects.execute.ts#heroEffectKo': { koSites: 1, ownedRecords: 1 },
  'hero/heroEffects.execute.ts#applyRevealKo': { koSites: 1, ownedRecords: 1 },
  'hero/heroEffects.execute.ts#heroEffectKoWoundReward': { koSites: 1, ownedRecords: 1 },
  'hero/heroEffects.execute.ts#heroEffectKoWound': { koSites: 1, ownedRecords: 1 },
  'moves/exorciseHauntedHero.ts#exorciseHauntedHero': { koSites: 1, ownedRecords: 0 },
  'moves/healWounds.ts#healWounds': { koSites: 1, ownedRecords: 1 },
  'moves/koDiscardChoice.resolve.ts#resolveKoDiscardChoice': { koSites: 1, ownedRecords: 1 },
  'moves/koHeroChoice.resolve.ts#resolveKoHeroChoice': { koSites: 2, ownedRecords: 2 },
  'moves/melterKoChoice.resolve.ts#resolveMelterKoChoice': { koSites: 1, ownedRecords: 1 },
  'moves/optionalKoReward.resolve.ts#resolveOptionalKoReward': { koSites: 1, ownedRecords: 1 },
  'moves/revealThreeAssign.resolve.ts#applyRevealThreeDisposition': { koSites: 1, ownedRecords: 1 },
  'moves/revealTopDispose.resolve.ts#resolveRevealTopDispose': { koSites: 1, ownedRecords: 1 },
  'moves/ruthlessDictatorChoice.resolve.ts#resolveRuthlessDictatorChoice': { koSites: 1, ownedRecords: 1 },
  'moves/scryKoChoice.resolve.ts#resolveScryKoChoice': { koSites: 1, ownedRecords: 1 },
  'moves/seatChoiceTactics.ts#applyVanishingIllusionsKo': { koSites: 1, ownedRecords: 0 },
  'moves/seatChoiceTactics.ts#applyCrushPacifistResistanceKo': { koSites: 1, ownedRecords: 1 },
  'moves/operatorSetters.ts#koFromPlayerZone': { koSites: 1, ownedRecords: 1 },
  'rules/mastermindHandlers.ts#resolveRedSkullStrike': { koSites: 1, ownedRecords: 1 },
  'rules/mastermindHandlers.ts#resolveBaronZemoStrike': { koSites: 1, ownedRecords: 0 },
  'rules/schemeTwistResolvers.ts#koFromHq': { koSites: 1, ownedRecords: 0 },
  'rules/tacticHandlers.ts#resolveWhispersAndLies': { koSites: 1, ownedRecords: 0 },
  'rules/tacticHandlers.ts#resolveFindingZemo': { koSites: 1, ownedRecords: 0 },
  'rules/timestreamPurge.logic.ts#sweepPurgedHeroesFromHq': { koSites: 1, ownedRecords: 0 },
  'villain/villainEffects.execute.ts#villainEffectKoBystanderEachVictoryPile': { koSites: 1, ownedRecords: 0 },
  'villain/villainEffects.execute.ts#villainEffectScryKoOwnDeck': { koSites: 1, ownedRecords: 1 },
  'villain/villainEffects.execute.ts#villainEffectRevealTopKoGreyOrDrawByClass': { koSites: 1, ownedRecords: 1 },
  'villain/villainEffects.execute.ts#villainEffectKoWoundsCurrentHandAndDiscard': { koSites: 1, ownedRecords: 1 },
  'villain/villainEffects.execute.ts#villainEffectKoHeroesCurrentByTrait': { koSites: 1, ownedRecords: 1 },
  'villain/villainEffects.execute.ts#koOneHeroForPlayer': { koSites: 2, ownedRecords: 2 },
  'villain/villainEffects.execute.ts#koHeroesFromZoneForPlayer': { koSites: 1, ownedRecords: 1 },
  'villain/villainEffects.execute.ts#koSingleTarget': { koSites: 1, ownedRecords: 1 },
  'villainDeck/villainEscapeProcedure.ts#koHqHeroForEscape': { koSites: 1, ownedRecords: 0 },
};

/**
 * Removes comments, keeping string and template literals intact, so a KO call quoted in a
 * comment never counts and a `//` or `/*` inside a string never eats real code.
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
 * Scans one source file for KO sites and owned-KO recorder calls, keyed by function.
 *
 * @param relativePath - The file's path relative to src, with forward slashes.
 * @param source - The file's text.
 * @returns A map `<path>#<function>` → counts (0/0 entries omitted).
 */
function scanKoSites(relativePath: string, source: string): Record<string, KoSiteCounts> {
  const code = stripComments(source);
  const declarations: { offset: number; name: string }[] = [];
  for (const match of code.matchAll(/\bfunction\s+([A-Za-z0-9_$]+)\s*[(<]/g)) {
    declarations.push({ offset: match.index, name: match[1]! });
  }
  const result: Record<string, KoSiteCounts> = {};
  const add = (position: number, field: keyof KoSiteCounts): void => {
    const key = `${relativePath}#${enclosingFunction(declarations, position)}`;
    const counts = result[key] ?? { koSites: 0, ownedRecords: 0 };
    counts[field] += 1;
    result[key] = counts;
  };
  for (const match of code.matchAll(/(\bfunction\s+)?\bkoCard\(/g)) {
    if (match[1] === undefined) {
      add(match.index, 'koSites');
    }
  }
  for (const match of code.matchAll(/\bmoveCardFromZone\(\s*[^,()]+(?:\([^)]*\))?[^,()]*,\s*(?:G|gameState)\.ko\s*[,)]/g)) {
    add(match.index, 'koSites');
  }
  for (const match of code.matchAll(/(\bfunction\s+)?\brecordOwnedCardKoed\(/g)) {
    if (match[1] === undefined) {
      add(match.index, 'ownedRecords');
    }
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

describe('KO-site drift pin (WP-853 / D-24789)', () => {
  it('AC-7: every engine KO site matches the locked per-function table', () => {
    const scanned: Record<string, KoSiteCounts> = {};
    for (const file of listSourceFiles(SOURCE_DIRECTORY)) {
      const relativePath = relative(SOURCE_DIRECTORY, file).split('\\').join('/');
      Object.assign(scanned, scanKoSites(relativePath, readFileSync(file, 'utf8')));
    }
    assert.deepEqual(
      scanned,
      LOCKED_TABLE,
      'A KO site was added, removed or moved. Classify it: if it takes a card from a player\'s ' +
        'hand, deck, discard pile or cards in play, call recordOwnedCardKoed(G, <owner>) beside it ' +
        '(Absorb Energies, D-24789), then update LOCKED_TABLE.',
    );
  });

  it('non-vacuous: catches koCard, single- and multi-line moveCardFromZone into G.ko, and skips comments', () => {
    const source = [
      'function first() {',
      '  G.ko = koCard(G.ko, cardId);',
      '  // G.ko = koCard(G.ko, commented);',
      '  /* recordOwnedCardKoed(G, playerID); */',
      '  const moved = moveCardFromZone(zones.victory, G.ko, cardId);',
      '}',
      'export function second() {',
      '  const moved = moveCardFromZone(',
      '    zones[from.zone],',
      '    gameState.ko,',
      '    cardId,',
      '  );',
      '  recordOwnedCardKoed(G, playerID);',
      '  const notKo = moveCardFromZone(zones.hand, zones.discard, cardId);',
      "  const text = 'https://example.com/*';",
      '}',
      'function koCard(pile, cardId) { return [...pile, cardId]; }',
    ].join('\n');

    assert.deepEqual(scanKoSites('synthetic.ts', source), {
      'synthetic.ts#first': { koSites: 2, ownedRecords: 0 },
      'synthetic.ts#second': { koSites: 1, ownedRecords: 1 },
    });
  });

  it('non-vacuous: a recorder in the wrong function changes the map', () => {
    const correct = 'function site() {\n  G.ko = koCard(G.ko, id);\n  recordOwnedCardKoed(G, owner);\n}\nfunction other() {}\n';
    const misplaced = 'function site() {\n  G.ko = koCard(G.ko, id);\n}\nfunction other() {\n  recordOwnedCardKoed(G, owner);\n}\n';

    assert.notDeepEqual(scanKoSites('a.ts', correct), scanKoSites('a.ts', misplaced));
    assert.deepEqual(scanKoSites('a.ts', misplaced), {
      'a.ts#site': { koSites: 1, ownedRecords: 0 },
      'a.ts#other': { koSites: 0, ownedRecords: 1 },
    });
  });
});
