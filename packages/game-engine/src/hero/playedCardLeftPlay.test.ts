/**
 * WP-899 / EC-937 / D-24856 — "cards you played this turn" keeps a card that left play mid-turn.
 *
 * Rules v23 L3441-3453: a card you played this turn that then moved somewhere else still counts
 * as one of "the cards you played this turn", but not as "your Heroes" / "Heroes you have".
 * `playedCardIdsThisTurn` unions the lazy multiset ledger `G.turnEconomy.leftPlayPlayedCardIds`,
 * written at exactly two sites: `recordOwnedCardKoed` with zone 'inPlay' (every KO from play)
 * and the operator "Move a card" route.
 *
 * Every reader case takes its card out of play through the real chokepoint (or a real move or
 * effect); no test assigns `leftPlayPlayedCardIds` directly.
 *
 * No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCardPlay } from '../moves/coreMoves.impl.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import { koCard } from '../board/ko.logic.js';
import { recordOwnedCardKoed } from './deferredConditionalGrants.js';
import { playedCardIdsStillInPlay, playedCardIdsThisTurn } from './splitCard.logic.js';
import { countDistinctHeroClassesYouHave, evaluateCondition } from './heroConditions.evaluate.js';
import { resolveCountSource } from './heroCountSource.resolve.js';
import { applyHeroTransform } from './heroTransform.logic.js';
import { resolveKoHeroChoice } from '../moves/koHeroChoice.resolve.js';
import { replayOutOfTimeCards } from '../moves/outOfTime.logic.js';
import { operatorMoveCard } from '../moves/operatorSetters.js';
import { isFightRestrictionBlocking } from '../moves/villainDefeatRequirement.logic.js';
import {
  addResources,
  markBothSidesPlayed,
  recordOutOfTimePlayed,
  recordPlayedCardLeftPlay,
  resetTurnEconomy,
  spendAttack,
} from '../economy/economy.logic.js';
import { SHIELD_AGENT_EXT_ID } from '../setup/pilesInit.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const playContext = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/** A card's printed facts for the state builder. */
interface CardFacts {
  cost?: number;
  heroClass?: string | null;
  team?: string | null;
  name?: string;
}

/**
 * Minimal state for the play path: hooks, a one-card deck, and empty card maps.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @returns A LegendaryGameState sufficient for these plays.
 */
function makeState(hooks: HeroAbilityHook[] = []): LegendaryGameState {
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
 * Records a card's printed facts in the setup tables the readers consult.
 *
 * @param G - The game state.
 * @param cardId - The card instance id.
 * @param facts - Its cost, class, team and name.
 */
function describeCard(G: LegendaryGameState, cardId: string, facts: CardFacts): void {
  (G.cardStats as Record<string, unknown>)[cardId] = {
    attack: 0, recruit: 0, cost: facts.cost ?? 3, fightCost: 0, fightCostMode: 'static', fightCostBase: 0,
  };
  if (facts.heroClass !== undefined || facts.team !== undefined) {
    (G.cardTraits as Record<string, unknown>)[cardId] = { heroClass: facts.heroClass ?? null, team: facts.team ?? null };
  }
  if (facts.name !== undefined) {
    (G.cardDisplayData as Record<string, unknown>)[cardId] = { name: facts.name };
  }
}

/**
 * Plays a card through the shared play core.
 *
 * @param G - The game state.
 * @param cardId - The card to play.
 * @param facts - Its printed facts (recorded first).
 */
function play(G: LegendaryGameState, cardId: string, facts: CardFacts = {}): void {
  describeCard(G, cardId, facts);
  applyCardPlay(G, playContext as unknown as Parameters<typeof applyCardPlay>[1], '0', cardId);
}

/**
 * KOs a played card out of play exactly as every KO site does: remove it from inPlay, put it in
 * the KO pile, then report it to the owned-KO chokepoint with the zone it left.
 *
 * @param G - The game state.
 * @param cardId - The card to KO from play.
 */
function koFromPlay(G: LegendaryGameState, cardId: string): void {
  const zones = G.playerZones['0']!;
  const moved = moveCardFromZone(zones.inPlay, [], cardId as CardExtId);
  assert.ok(moved.found, `${cardId} must be in play before it is KO'd out`);
  zones.inPlay = moved.from;
  G.ko = koCard(G.ko, cardId as CardExtId);
  recordOwnedCardKoed(G, '0', cardId as CardExtId, 'inPlay');
}

/**
 * The view for player 0.
 *
 * @param G - The game state.
 * @returns The played-this-turn view.
 */
function viewOf(G: LegendaryGameState): CardExtId[] {
  return playedCardIdsThisTurn(G, G.playerZones['0']!.inPlay);
}

/**
 * Builds a one-effect onPlay hook.
 *
 * @param cardId - The card the hook belongs to.
 * @param effectType - The effect type.
 * @returns The hook.
 */
function hookWithEffect(cardId: string, effectType: string): HeroAbilityHook {
  return {
    cardId: cardId as CardExtId,
    timing: 'onPlay',
    keywords: [effectType],
    effects: [{ type: effectType }],
  } as unknown as HeroAbilityHook;
}

// ---------------------------------------------------------------------------
// T1-T5 — the ledger and its write site 1
// ---------------------------------------------------------------------------

describe('WP-899 ledger and write site 1 (D-24856)', () => {
  it('T1: a KO from inPlay through recordOwnedCardKoed records the card', () => {
    const G = makeState();
    play(G, 'test/a#0');
    koFromPlay(G, 'test/a#0');
    assert.deepEqual(G.turnEconomy.leftPlayPlayedCardIds, ['test/a#0']);
  });

  it('T2: KOs from hand, discard and deck never materialize the ledger', () => {
    const G = makeState();
    recordOwnedCardKoed(G, '0', 'test/hand#0' as CardExtId, 'hand');
    recordOwnedCardKoed(G, '0', 'test/discard#0' as CardExtId, 'discard');
    recordOwnedCardKoed(G, '0', 'test/deck#0' as CardExtId, 'deck');
    assert.equal('leftPlayPlayedCardIds' in G.turnEconomy, false);
    assert.equal(JSON.stringify(G.turnEconomy).includes('leftPlay'), false, 'absent means omitted from the hashed JSON');
  });

  it('T3: the ledger survives every same-turn rebuild and is dropped at turn start', () => {
    const G = makeState();
    play(G, 'test/a#0');
    koFromPlay(G, 'test/a#0');
    let economy = addResources(G.turnEconomy, 3, 2);
    economy = spendAttack(economy, 1);
    economy = recordOutOfTimePlayed(economy, 'test/other#0' as CardExtId);
    assert.deepEqual(economy.leftPlayPlayedCardIds, ['test/a#0']);
    const before = economy.leftPlayPlayedCardIds;
    const next = recordPlayedCardLeftPlay(economy, 'test/b#0' as CardExtId);
    assert.deepEqual(before, ['test/a#0'], 'the helper builds a new array');
    assert.deepEqual(next.leftPlayPlayedCardIds, ['test/a#0', 'test/b#0']);
    assert.equal('leftPlayPlayedCardIds' in resetTurnEconomy(), false);
  });

  it('T4: a real KO-a-Hero choice from inPlay records the card and the view keeps it', () => {
    const G = makeState();
    play(G, 'test/a#0', { heroClass: 'covert' });
    play(G, 'test/b#0', { heroClass: 'tech' });
    G.pendingKoHeroChoices = [{ choiceType: 'ko-hero', playerID: '0' }] as unknown as LegendaryGameState['pendingKoHeroChoices'];
    resolveKoHeroChoice({ G, playerID: '0' } as unknown as Parameters<typeof resolveKoHeroChoice>[0], { zone: 'inPlay', cardId: 'test/a#0' as CardExtId });
    assert.ok(G.ko.includes('test/a#0' as CardExtId));
    assert.deepEqual(G.turnEconomy.leftPlayPlayedCardIds, ['test/a#0']);
    assert.deepEqual([...viewOf(G)].sort(), ['test/a#0', 'test/b#0']);
  });

  it('T5: a card that KOs itself on play still counts once in the view', () => {
    const G = makeState([hookWithEffect('test/self-ko#0', 'ko')]);
    play(G, 'test/first#0');
    play(G, 'test/self-ko#0');
    assert.ok(G.ko.includes('test/self-ko#0' as CardExtId), 'the generic ko effect removed it from play');
    assert.deepEqual(G.playerZones['0']!.inPlay, ['test/first#0']);
    assert.equal(viewOf(G).length, 2);
  });
});

// ---------------------------------------------------------------------------
// T6-T10 — readers
// ---------------------------------------------------------------------------

describe('WP-899 readers count a KO\'d-out play (D-24856)', () => {
  it('T6: a KO\'d-out first card makes the second card not the first Hero played', () => {
    const G = makeState();
    play(G, 'test/first#0');
    koFromPlay(G, 'test/first#0');
    play(G, 'test/first-strike#0');
    assert.equal(evaluateCondition(G, '0', { type: 'firstHeroPlayedThisTurn', value: '1' }, 'test/first-strike#0' as CardExtId), false);
  });

  it('T7: "at least N cards played" counts the KO\'d-out card', () => {
    const G = makeState();
    play(G, 'test/a#0');
    play(G, 'test/b#0');
    koFromPlay(G, 'test/a#0');
    play(G, 'test/winter-soldier#0');
    assert.equal(evaluateCondition(G, '0', { type: 'playedThisTurn', value: '3' }), true);
  });

  it('T7b: Squirrel Girl\'s "more than one card" restriction counts the KO\'d-out card', () => {
    const G = makeState();
    play(G, 'test/a#0');
    play(G, 'test/b#0');
    koFromPlay(G, 'test/a#0');
    assert.equal(isFightRestrictionBlocking(G, '0', 0, { kind: 'at-most-one-card-played' }), true);
  });

  it('T8: Invisible Woman\'s other-4-cost check counts the KO\'d 4-cost card', () => {
    const G = makeState();
    play(G, 'test/four-cost#0', { cost: 4 });
    koFromPlay(G, 'test/four-cost#0');
    play(G, 'test/invisible-woman#0', { cost: 4 });
    assert.equal(
      evaluateCondition(G, '0', { type: 'otherCardOfCostPlayedThisTurn', value: '4' }, 'test/invisible-woman#0' as CardExtId),
      true,
    );
  });

  it('T9: Warriors Three\'s distinct names include the KO\'d-out Hero', () => {
    const G = makeState();
    play(G, 'test/thor#0', { heroClass: 'strength', name: 'Thor' });
    play(G, 'test/loki#0', { heroClass: 'covert', name: 'Loki' });
    play(G, 'test/sif#0', { heroClass: 'instinct', name: 'Sif' });
    koFromPlay(G, 'test/loki#0');
    play(G, 'test/warriors-three#0', { heroClass: 'strength', name: 'Three Stand as One' });
    assert.equal(
      evaluateCondition(
        G, '0', { type: 'otherDistinctNonGreyHeroesPlayedThisTurnAtLeast', value: '3' }, 'test/warriors-three#0' as CardExtId,
      ),
      true,
    );
  });

  it('T10: a played-this-turn count source includes the KO\'d-out card', () => {
    const G = makeState();
    play(G, 'test/hawkeye#0', { heroClass: 'tech', team: 'avengers' });
    play(G, 'test/thor#0', { heroClass: 'strength', team: 'avengers' });
    koFromPlay(G, 'test/hawkeye#0');
    play(G, 'test/captain-america#0', { heroClass: 'covert', team: 'avengers' });
    assert.equal(resolveCountSource(G, '0', 'avengers-played-this-turn', 'test/captain-america#0' as CardExtId), 2);
  });
});

// ---------------------------------------------------------------------------
// T11-T13 — multiset, controls, absorption, expansion, Transform
// ---------------------------------------------------------------------------

describe('WP-899 multiset, controls and exclusions (D-24856)', () => {
  it('T11: two shared-id S.H.I.E.L.D. Agents count twice, one or both KO\'d out', () => {
    const G = makeState();
    play(G, SHIELD_AGENT_EXT_ID);
    play(G, SHIELD_AGENT_EXT_ID);
    koFromPlay(G, SHIELD_AGENT_EXT_ID);
    assert.deepEqual(viewOf(G), [SHIELD_AGENT_EXT_ID, SHIELD_AGENT_EXT_ID]);
    koFromPlay(G, SHIELD_AGENT_EXT_ID);
    assert.deepEqual(viewOf(G), [SHIELD_AGENT_EXT_ID, SHIELD_AGENT_EXT_ID]);
  });

  it('T12: "Heroes you have" ignores the KO\'d-out card', () => {
    const G = makeState();
    play(G, 'test/covert#0', { heroClass: 'covert' });
    play(G, 'test/tech#0', { heroClass: 'tech' });
    koFromPlay(G, 'test/tech#0');
    assert.deepEqual(playedCardIdsStillInPlay(G, G.playerZones['0']!.inPlay), ['test/covert#0']);
    assert.equal(countDistinctHeroClassesYouHave(G, '0'), 1);
    assert.deepEqual([...viewOf(G)].sort(), ['test/covert#0', 'test/tech#0']);
  });

  it('T13: an Out of Time replay KO\'d out counts once; a both-sides card KO\'d out counts as both faces', () => {
    const replayed = 'test/out-of-time#0';
    const G = makeState([hookWithEffect(replayed, 'ko')]);
    G.outOfTimeCards = { '0': [replayed as CardExtId] };
    replayOutOfTimeCards(G, playContext as unknown as Parameters<typeof replayOutOfTimeCards>[1], '0');
    assert.deepEqual(G.turnEconomy.outOfTimePlayedCardIds, [replayed]);
    assert.deepEqual(G.turnEconomy.leftPlayPlayedCardIds, [replayed]);
    assert.deepEqual(viewOf(G), [replayed], 'in both ledgers, counted once');

    const S = makeState();
    (S as { splitFaces?: Record<string, string> }).splitFaces = { 'test/divided-left': 'test/divided-right' };
    play(S, 'test/divided-left#0');
    S.turnEconomy = markBothSidesPlayed(S.turnEconomy, 'test/divided-left#0' as CardExtId);
    koFromPlay(S, 'test/divided-left#0');
    assert.deepEqual(viewOf(S), ['test/divided-left#0', 'test/divided-right#0']);
  });

  it('T13b: a Transform is not recorded; the second form stands in for the one play', () => {
    const G = makeState();
    (G as { transformTargets?: Record<string, string> }).transformTargets = { 'test/banner': 'test/hulk' };
    (G as { transformDeck?: string[] }).transformDeck = ['test/hulk#0'];
    play(G, 'test/banner#0');
    applyHeroTransform(G, '0', 'test/banner#0' as CardExtId);
    assert.deepEqual(G.playerZones['0']!.inPlay, ['test/hulk#0']);
    assert.equal('leftPlayPlayedCardIds' in G.turnEconomy, false);
    assert.equal(viewOf(G).length, 1);
  });
});

// ---------------------------------------------------------------------------
// T14 — write site 2 (operator)
// ---------------------------------------------------------------------------

describe('WP-899 operator "Move a card" from play (D-24856, D-24713 §6)', () => {
  it('T14: discard, deck-top and KO routes each record exactly one entry', () => {
    const G = makeState();
    (G as { isDebugMatch?: boolean }).isDebugMatch = true;
    play(G, 'test/a#0');
    play(G, 'test/b#0');
    play(G, 'test/c#0');
    const context = { G, ctx: { currentPlayer: '0' }, playerID: '0' } as unknown as Parameters<typeof operatorMoveCard>[0];
    const fromPlay = { zone: 'inPlay', playerId: '0' };
    operatorMoveCard(context, { cardId: 'test/a#0', from: fromPlay, to: { zone: 'discard', playerId: '0' } });
    operatorMoveCard(context, { cardId: 'test/b#0', from: fromPlay, to: { zone: 'deck', playerId: '0' } });
    operatorMoveCard(context, { cardId: 'test/c#0', from: fromPlay, to: { zone: 'ko' } });
    assert.deepEqual(G.playerZones['0']!.inPlay, []);
    assert.deepEqual(G.turnEconomy.leftPlayPlayedCardIds, ['test/a#0', 'test/b#0', 'test/c#0']);
    assert.equal(viewOf(G).length, 3);
  });
});

// ---------------------------------------------------------------------------
// T15 — drift pins: the closed inPlay write set and the two record sites
// ---------------------------------------------------------------------------

const SOURCE_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..');

// why: WP-899 / D-24856 — every function that writes inPlay, with its disposition. A new write
// is a decision (record the exit, or give the reason it is not one), never a silent re-pin.
const LOCKED_IN_PLAY_WRITE_TABLE: Record<string, number> = {
  'hero/heroEffects.execute.ts#heroEffectKo': 2, // KO: recorded through recordOwnedCardKoed
  'hero/heroEffects.execute.ts#heroEffectOutOfTime': 2, // own ledger (outOfTimePlayedCardIds)
  'hero/heroTransform.logic.ts#applyHeroTransform': 3, // not recorded: the second form stands in for the play
  'moves/communeSpiritWorld.logic.ts#applyCommuneCostResolvedSeatChoice': 2, // own ledger (ritualUsedPlayedCardIds)
  'moves/deferredHandInjection.logic.ts#pullCardIntoHand': 2, // end of turn (called only from cleanup)
  'moves/endOfTurnCleanup.logic.ts#applyEndOfTurnCleanup': 1, // end of turn
  'moves/endOfTurnCleanup.logic.ts#keepControlledArtifacts': 1, // end of turn
  'moves/outOfTime.logic.ts#replayOutOfTimeCards': 2, // own ledger (outOfTimePlayedCardIds)
  'moves/recruitSidekick.ts#returnPlayedSidekick': 1, // own count (sidekicksReturnedThisTurn)
  'moves/ritualArtifact.ts#useRitualArtifact': 2, // own ledger (ritualUsedPlayedCardIds)
  'moves/splitFaceChoice.resolve.ts#resolveSplitFaceChoice': 1, // relabel, not an exit
  'villain/villainEffects.execute.ts#koOneHeroForPlayer': 2, // KO: recorded through recordOwnedCardKoed
  'villain/villainEffects.execute.ts#villainEffectKoHeroesCurrentByTrait': 1, // KO: recorded through recordOwnedCardKoed
};

// why: WP-899 / D-24856 — the record calls by function (definitions excluded): exactly the two
// write sites, and the operator helper's two calls (deck-top and general branch).
const LOCKED_LEFT_PLAY_RECORD_TABLE: Record<string, number> = {
  'hero/deferredConditionalGrants.ts#recordOwnedCardKoed recordPlayedCardLeftPlay': 1,
  'moves/operatorSetters.ts#recordOperatorLeftPlay recordPlayedCardLeftPlay': 1,
  'moves/operatorSetters.ts#moveBetweenPlayerZones recordOperatorLeftPlay': 2,
};

/**
 * Removes comments, keeping string and template literals intact, so a call quoted in a
 * comment never counts.
 *
 * why: a third copy of the deckCardKoTrigger.test.ts / ownedCardKoTrigger.test.ts helper;
 * extracting a shared helper would edit those two frozen test files (D-24856 records it).
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
 * Names the function declaration enclosing a position.
 *
 * @param declarations - Each declaration's start offset and name, in source order.
 * @param position - The offset of the hit.
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
 * Lists the function declarations of comment-stripped source.
 *
 * @param code - Comment-stripped source text.
 * @returns Each declaration's offset and name, in source order.
 */
function listDeclarations(code: string): { offset: number; name: string }[] {
  const declarations: { offset: number; name: string }[] = [];
  for (const match of code.matchAll(/\bfunction\s+([A-Za-z0-9_$]+)\s*[(<]/g)) {
    declarations.push({ offset: match.index, name: match[1]! });
  }
  return declarations;
}

/**
 * Scans one file for inPlay writes: moveCardFromZone calls whose first argument ends in
 * `.inPlay`, and `.inPlay =` assignments whose right side does not start with `[...`.
 *
 * @param relativePath - The file's path relative to src, with forward slashes.
 * @param source - The file's text.
 * @returns `<path>#<function>` → write count (0 entries omitted).
 */
function scanInPlayWrites(relativePath: string, source: string): Record<string, number> {
  const code = stripComments(source);
  const declarations = listDeclarations(code);
  const result: Record<string, number> = {};
  const hitOffsets: number[] = [];
  for (const match of code.matchAll(/\bmoveCardFromZone\(\s*([A-Za-z0-9_$.?[\]'"]+)\s*,/g)) {
    if (/\.inPlay$/.test(match[1]!)) {
      hitOffsets.push(match.index);
    }
  }
  for (const match of code.matchAll(/\.inPlay\s*=(?!=)\s*(\S+)/g)) {
    if (!match[1]!.startsWith('[...')) {
      hitOffsets.push(match.index);
    }
  }
  for (const offset of hitOffsets) {
    const key = `${relativePath}#${enclosingFunction(declarations, offset)}`;
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

/**
 * Scans one file for record calls (not their definitions) by enclosing function.
 *
 * @param relativePath - The file's path relative to src, with forward slashes.
 * @param source - The file's text.
 * @returns `<path>#<function> <callee>` → call count (0 entries omitted).
 */
function scanRecordCalls(relativePath: string, source: string): Record<string, number> {
  const code = stripComments(source);
  const declarations = listDeclarations(code);
  const result: Record<string, number> = {};
  for (const match of code.matchAll(/(\bfunction\s+)?\b(recordPlayedCardLeftPlay|recordOperatorLeftPlay)\(/g)) {
    if (match[1] !== undefined) {
      continue;
    }
    const key = `${relativePath}#${enclosingFunction(declarations, match.index)} ${match[2]!}`;
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

/**
 * Runs a scanner over every engine source file.
 *
 * @param scanner - The per-file scanner.
 * @returns The merged map.
 */
function scanSources(scanner: (relativePath: string, source: string) => Record<string, number>): Record<string, number> {
  const scanned: Record<string, number> = {};
  for (const file of listSourceFiles(SOURCE_DIRECTORY)) {
    const relativePath = relative(SOURCE_DIRECTORY, file).split('\\').join('/');
    Object.assign(scanned, scanner(relativePath, readFileSync(file, 'utf8')));
  }
  return scanned;
}

describe('WP-899 drift pins (D-24856)', () => {
  it('T15: every function that writes inPlay is in the locked table', () => {
    assert.deepEqual(
      scanSources(scanInPlayWrites),
      LOCKED_IN_PLAY_WRITE_TABLE,
      'A function gained or lost an inPlay write. If it moves a played card out of play mid-turn, record it ' +
        '(recordOwnedCardKoed for a KO, else recordPlayedCardLeftPlay) or give the reason it does not, then update ' +
        'LOCKED_IN_PLAY_WRITE_TABLE (WP-899 / D-24856).',
    );
  });

  it('T15: the left-play record calls are exactly the two write sites', () => {
    assert.deepEqual(
      scanSources(scanRecordCalls),
      LOCKED_LEFT_PLAY_RECORD_TABLE,
      'A left-play record call was added or removed. The view must count each physical play once; record only a ' +
        'mid-turn exit from inPlay that no other ledger covers, then update LOCKED_LEFT_PLAY_RECORD_TABLE (WP-899 / D-24856).',
    );
  });

  it('T15: non-vacuous — a write or call in the wrong function changes the map, and comments never count', () => {
    const correct = [
      'function site(zones) {',
      '  zones.inPlay = moveCardFromZone(zones.inPlay, [], id).from;',
      '  recordPlayedCardLeftPlay(economy, id);',
      '}',
      'function other() {',
      '  // zones.inPlay = nothing; recordPlayedCardLeftPlay(economy, id);',
      '  zones.inPlay = [...zones.inPlay, id];',
      '}',
    ].join('\n');
    const misplaced = [
      'function site(zones) {',
      '}',
      'function other() {',
      '  zones.inPlay = moveCardFromZone(zones.inPlay, [], id).from;',
      '  recordPlayedCardLeftPlay(economy, id);',
      '}',
    ].join('\n');
    assert.deepEqual(scanInPlayWrites('a.ts', correct), { 'a.ts#site': 2 });
    assert.deepEqual(scanInPlayWrites('a.ts', misplaced), { 'a.ts#other': 2 });
    assert.deepEqual(scanRecordCalls('a.ts', correct), { 'a.ts#site recordPlayedCardLeftPlay': 1 });
    assert.deepEqual(scanRecordCalls('a.ts', misplaced), { 'a.ts#other recordPlayedCardLeftPlay': 1 });
  });
});
