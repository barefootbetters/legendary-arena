/**
 * Legal-move enumeration for the Legendary Arena balance simulation
 * framework.
 *
 * getLegalMoves is a pure function that enumerates every move currently
 * available to the active player. The AI policy can only choose from the
 * returned list — the same constraint a human player faces.
 *
 * No boardgame.io imports. No registry imports. No Math.random(). No
 * .reduce(). No IO.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { LegalMove } from './ai.types.js';
import { getAvailableAttack, getAvailableRecruit } from '../economy/economy.logic.js';
import { resolveFightCost } from '../economy/economy.resolve.js';
import { isGuardBlocking, getPatrolModifier } from '../board/boardKeywords.logic.js';
import { hasPendingKoHeroChoice } from '../moves/koHeroChoice.resolve.js';
import { hasPendingScryKoChoice } from '../moves/scryKoChoice.resolve.js';
import { hasPendingDiscardChoice } from '../moves/discardChoice.resolve.js';
import { hasPendingReorderChoice } from '../moves/reorderChoice.resolve.js';
import { hasPendingDefeatChoice } from '../moves/defeatChoice.resolve.js';
import { selectDiscardToLimitCards } from '../rules/mastermindHandlers.js';
import { selectDefaultKoTarget, selectScryKoTarget } from '../villain/villainEffects.execute.js';
import { hasPendingOptionalKoReward } from '../moves/optionalKoReward.resolve.js';
import { selectDefaultOptionalKoTarget } from '../hero/heroEffects.execute.js';
import {
  hasPendingVictoryPileCardPick,
  getEligibleVictoryVillains,
} from '../moves/resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from '../moves/drawOrEmpowered.resolve.js';
import {
  hasPendingReturnZeroCostDiscard,
  getEligibleZeroCostDiscardCards,
} from '../moves/resolveReturnZeroCostDiscard.js';
import {
  hasPendingDiscardToPlay,
  getEligibleDiscardToPlayCards,
} from '../moves/resolveDiscardToPlay.js';
import {
  hasPendingReturnOnDiscard,
  getEligibleReturnOnDiscardCards,
} from '../moves/resolveReturnOnDiscard.js';
import { hasPendingOptionalPutBottomHQ } from '../moves/resolveOptionalPutBottomHQ.js';
import { hasPendingPutAnyNumberBottomHQ } from '../moves/resolvePutAnyNumberBottomHQ.js';

// why: simulation covers the play-phase only; lobby moves (setPlayerReady,
// startMatchIfReady) are excluded because runSimulation starts the per-game
// loop post-lobby via buildInitialGameState + an externally tracked
// phase = 'play'. Local constant per WP-032 D-3202 precedent — NOT a
// drift-pinned canonical array. Adding a new play-phase move in a future
// WP requires updating this constant explicitly.
// why: WP-289 / D-24073 — exported as the single source of truth the dispatch drift guard reads
// (simulation.moveDispatch.drift.test.ts asserts both simulation MOVE_MAPs cover every name here).
export const SIMULATION_MOVE_NAMES = [
  'drawCards',
  'playCard',
  'endTurn',
  'advanceStage',
  'revealVillainCard',
  'fightVillain',
  'recruitHero',
  'fightMastermind',
  'resolveKoHeroChoice',
  // why: WP-470 / D-24282 — getLegalMoves short-circuits to resolveScryKoChoice when a
  // Doombot scry-KO choice is parked; it MUST be dispatchable in the sim (both MOVE_MAPs)
  // or the per-turn loop hangs (maxTurns bounds turns, not within-turn move-steps —
  // the WP-289 One-Hit-Wonder hang). Asserted by simulation.moveDispatch.drift.test.ts.
  'resolveScryKoChoice',
  // why: WP-476 / D-24284 — getLegalMoves short-circuits to resolveDiscardChoice when a
  // Magneto discard-to-limit choice is parked for the active player; it MUST be
  // dispatchable in the sim (both MOVE_MAPs) or the per-turn loop hangs (maxTurns bounds
  // turns, not within-turn move-steps — the WP-289 hang). Asserted by
  // simulation.moveDispatch.drift.test.ts.
  'resolveDiscardChoice',
  // why: WP-479 / D-24286 — getLegalMoves short-circuits to resolveReorderChoice when a
  // reveal-remainder reorder is parked; it MUST be dispatchable in the sim (both MOVE_MAPs)
  // or the per-turn loop hangs (maxTurns bounds turns, not within-turn move-steps — the
  // WP-289 hang). Asserted by simulation.moveDispatch.drift.test.ts.
  'resolveReorderChoice',
  // why: WP-486 / D-24291 — getLegalMoves short-circuits to resolveDefeatChoice when a
  // Silent Sniper defeat-with-a-Bystander choice is parked; it MUST be dispatchable in
  // the sim (both MOVE_MAPs) or the per-turn loop hangs (maxTurns bounds turns, not
  // within-turn move-steps — the WP-289 hang). Asserted by simulation.moveDispatch.drift.test.ts.
  'resolveDefeatChoice',
  'resolveOptionalKoReward',
  'resolveVictoryPileCardPick',
  'resolveDrawOrEmpowered',
  'resolveReturnZeroCostDiscard',
  'resolveDiscardToPlay',
  // why: WP-498 / D-24301 — getLegalMoves short-circuits to resolveReturnOnDiscard when the
  // optional return-on-discard choice is parked; it MUST be dispatchable in the sim or the
  // per-turn loop hangs (the WP-289 / D-24073 within-turn hang).
  'resolveReturnOnDiscard',
  // why: WP-427 / D-24248 — getLegalMoves now short-circuits to these two put-bottom-HQ
  // resolve moves when their block-all choice is parked; they MUST be dispatchable in the
  // sim (both MOVE_MAPs) or the per-turn loop hangs (maxTurns bounds turns, not
  // within-turn move-steps — the exact hang WP-289 / D-24073 documents).
  'resolveOptionalPutBottomHQ',
  'resolvePutAnyNumberBottomHQ',
] as const;

// why: type is exported implicitly via the const array above; external
// consumers can derive it from the string literals in SIMULATION_MOVE_NAMES.
type SimulationMoveName = typeof SIMULATION_MOVE_NAMES[number];

// why: silence the unused-type diagnostic while keeping the type alias
// available for future maintainers who want to narrow LegalMove.name.
void (0 as unknown as SimulationMoveName);

/**
 * Minimum lifecycle context for legal-move enumeration.
 *
 * // why: getLegalMoves needs phase + currentStage + turn to decide which
 * moves are legal. Smaller analog of SimulationMoveContext.ctx. Local per
 * D-2801 (local structural interface pattern).
 */
export interface SimulationLifecycleContext {
  readonly phase: string;
  readonly turn: number;
  readonly currentPlayer: string;
  readonly numPlayers: number;
}

/**
 * Returns the first present (non-null) HQ card id, or null when every HQ slot is
 * empty. Deterministic (lowest slot index) so the bot's mandatory put-bottom-HQ
 * pick (WP-427) is stable across replays.
 *
 * @param hq - The HQ slots; a null slot is an empty HQ position.
 * @returns The first non-null card id, or null when the HQ holds no card.
 */
function selectFirstHqCard(hq: ReadonlyArray<CardExtId | null>): CardExtId | null {
  for (const slot of hq) {
    if (slot !== null && slot !== undefined) {
      return slot;
    }
  }
  return null;
}

/**
 * Enumerates all legal moves for the active player.
 *
 * Pure function — deterministic, no side effects, no G mutation. The
 * returned array follows the canonical enumeration order locked by
 * pre-flight RS-13 so seeded selection is stable across refactors:
 *
 *   1. playCard intents — hand zone index ascending (if stage === 'main')
 *   2. recruitHero intents — HQ slot 0..4 ascending (if stage === 'main'
 *      and availableRecruit covers the slot's cost)
 *   3. fightVillain intents — City slot 0..4 ascending (if stage === 'main'
 *      and availableAttack covers baseFightCost + patrolModifier and the
 *      slot is not Guard-blocked)
 *   4. fightMastermind — one entry (if stage === 'main', tactics remain,
 *      and availableAttack covers the base-card fightCost)
 *   5. revealVillainCard — one entry if stage === 'start'
 *   6. advanceStage — one entry if stage !== 'cleanup'
 *   7. endTurn — one entry if stage === 'cleanup'
 *
 * // why: AI can only choose from legal moves — same constraint as human
 * players. Pre-flight RS-13 locks enumeration order; reordering silently
 * flips every seeded decision output. WP-032 D-3202 precedent: stage
 * gating is authoritative on the engine side, simulation mirrors it
 * read-only.
 *
 * @param gameState - The engine state. Not mutated.
 * @param context - Minimal lifecycle context (phase, turn, currentPlayer,
 *   numPlayers).
 * @returns LegalMove array in canonical enumeration order.
 */
export function getLegalMoves(
  gameState: LegendaryGameState,
  context: SimulationLifecycleContext,
): LegalMove[] {
  const legalMoves: LegalMove[] = [];
  const activePlayer = context.currentPlayer;
  const zones = gameState.playerZones[activePlayer];
  if (zones === undefined) {
    // why: fail-closed — active player has no zones (malformed state).
    // Return empty list; the runner's zero-legal-moves fallback handles
    // the degenerate case.
    return legalMoves;
  }

  // why: pending hero-reveal discard-or-return short-circuit (D-22001). This is the
  // ONE block-all pending choice that previously had NO getLegalMoves short-circuit
  // (the WP-427 sibling left behind): pendingHeroChoice blocks endTurn and the cleanup
  // stage-advance, so without a resolve move here the bot dispatched a guard-rejected
  // endTurn/advanceStage and its turn faulted. The bot resolves it first, in any stage,
  // exactly like the eight queue-based choices below. Deterministic default: 'return'
  // (leave the revealed card on top) — the conservative choice that never discards a
  // possibly-valuable card; an expected-value default is a deferred refinement (mirrors
  // the D-24069 draw-or-empowered deterministic default). Returns a list of length
  // EXACTLY 1. Placed first to match endTurn's guard order (pendingHeroChoice first).
  if (gameState.pendingHeroChoice !== undefined) {
    return [{ name: 'resolveHeroChoice', args: { resolution: 'return' } }];
  }

  // why: pending return-zero-cost-discard short-circuit (D-24139) — while a mandatory
  // 0-cost discard-to-hand return is pending the engine block-all guard freezes every
  // other move, so the bot must resolve it first. Deterministic default target: the
  // FIRST eligible card in discard order (lowest index). Returns a list of length
  // EXACTLY 1. eligible is non-empty here because the park requires >=1 eligible card
  // and the block-all guard freezes the discard pile between park and resolve.
  if (hasPendingReturnZeroCostDiscard(gameState)) {
    const eligibleReturns = getEligibleZeroCostDiscardCards(gameState, activePlayer);
    if (eligibleReturns.length > 0) {
      return [{ name: 'resolveReturnZeroCostDiscard', args: { cardId: eligibleReturns[0]! } }];
    }
    // why: defensive — if no eligible card (engine-invariant violation after park), fail closed.
    return legalMoves;
  }

  // why: pending discard-to-play short-circuit (WP-383 / D-24184) — while a mandatory
  // discard-to-play cost is pending the block-all guard freezes every other move, so the
  // bot must pay it first. Deterministic default target: the FIRST hand card (lowest
  // index). Returns a list of length EXACTLY 1. eligible is non-empty because the
  // D-24185 precondition pre-guaranteed payability and the block-all guard freezes the
  // hand between park and resolve.
  if (hasPendingDiscardToPlay(gameState)) {
    const eligibleDiscards = getEligibleDiscardToPlayCards(gameState, activePlayer);
    if (eligibleDiscards.length > 0) {
      return [{ name: 'resolveDiscardToPlay', args: { cardId: eligibleDiscards[0]! } }];
    }
    // why: defensive — if no eligible card (engine-invariant violation after park), fail closed.
    return legalMoves;
  }

  // why: pending return-on-discard short-circuit (WP-498 / D-24301) — while an OPTIONAL
  // return-on-discard choice is pending the block-all guard freezes every other move, so
  // the bot must resolve it first. Deterministic default: ACCEPT the return (strictly
  // beneficial — a free card back in hand). Returns a list of length EXACTLY 1. If the
  // returnable card is somehow gone, decline (a valid resolution that clears the queue).
  if (hasPendingReturnOnDiscard(gameState)) {
    const eligibleReturns = getEligibleReturnOnDiscardCards(gameState, activePlayer);
    if (eligibleReturns.length > 0) {
      return [{ name: 'resolveReturnOnDiscard', args: { cardId: eligibleReturns[0]! } }];
    }
    return [{ name: 'resolveReturnOnDiscard', args: { decline: true } }];
  }

  // why: pending draw-or-empowered short-circuit (D-24069) — while a draw-or-empowered
  // choice is pending the engine block-all guard freezes every other move, so the bot must
  // resolve it first. Returns a list of length EXACTLY 1.
  if (hasPendingDrawOrEmpowered(gameState)) {
    // why: deterministic bot default — always empowered; an expected-value default is deferred (D-24069)
    return [{ name: 'resolveDrawOrEmpowered', args: { choice: 'empowered' } }];
  }

  // why: pending victory-pile villain-pick short-circuit (D-24067) — the bot must
  // resolve a pending pick before any other move. Picks the highest-fightCost
  // eligible villain (ties broken by lowest victory-pile index = first in
  // getEligibleVictoryVillains result after stable sort). Returns EXACTLY 1 move.
  if (hasPendingVictoryPileCardPick(gameState)) {
    const eligibleVillains = getEligibleVictoryVillains(gameState, activePlayer);
    if (eligibleVillains.length > 0) {
      // why: deterministic highest-attack pick; ties resolved by lowest victory-pile index (D-24067)
      let bestVillain: CardExtId = eligibleVillains[0]!;
      let bestAttack = gameState.cardStats[bestVillain]?.fightCost ?? 0;
      for (const villainId of eligibleVillains) {
        const villainAttack = gameState.cardStats[villainId]?.fightCost ?? 0;
        if (villainAttack > bestAttack) {
          bestAttack = villainAttack;
          bestVillain = villainId;
        }
      }
      return [{ name: 'resolveVictoryPileCardPick', args: { cardId: bestVillain } }];
    }
    // why: defensive — if no eligible villain (engine-invariant violation after park), fail closed.
    return legalMoves;
  }

  // why: pending optional-KO-reward short-circuit (D-24019) — inserted BEFORE
  // the KO-hero short-circuit per the fixed precedence lock. While an
  // optional-KO-reward choice is pending the engine block-all guard freezes
  // every other move, so the bot must resolve it first. The single legal move
  // is resolveOptionalKoReward with the deterministic default target
  // (selectDefaultOptionalKoTarget: lowest cost, discard-before-hand, lowest
  // index) — the bot KOs and takes the reward and NEVER declines (decline is
  // human-only). defaultTarget is non-null here because the park requires ≥1
  // eligible card and the board is frozen. Returns a list of length EXACTLY 1.
  if (hasPendingOptionalKoReward(gameState)) {
    const defaultTarget = selectDefaultOptionalKoTarget(zones, gameState.cardStats);
    if (defaultTarget !== null) {
      return [{ name: 'resolveOptionalKoReward', args: defaultTarget }];
    }
    // why: defensive — if no target exists (engine-invariant violation), fail
    // closed with an empty list rather than emit an unresolvable move.
    return legalMoves;
  }

  // why: pending-KO short-circuit (D-24009) — when a KO-a-Hero choice is
  // pending the engine block-all guard freezes every other move, so the bot
  // must resolve it before anything else. The single legal move is
  // resolveKoHeroChoice with the legacy auto-resolution target
  // (selectDefaultKoTarget reuses selectKoHeroTarget over discard → hand →
  // inPlay), keeping the bot KO target byte-identical to the prior
  // auto-resolution for replay determinism. selectDefaultKoTarget is non-null
  // here because a choice is appended only when ≥2 eligible targets exist and
  // the board is frozen. Returns a list of length EXACTLY 1 — no other move
  // is appended or merged.
  if (hasPendingKoHeroChoice(gameState)) {
    const defaultTarget = selectDefaultKoTarget(zones);
    if (defaultTarget !== null) {
      return [{ name: 'resolveKoHeroChoice', args: defaultTarget }];
    }
    // why: defensive — if no target exists (engine-invariant violation), fail
    // closed with an empty list rather than emit an unresolvable move.
    return legalMoves;
  }

  // why: WP-470 / D-24282 — pending Doombot scry-KO short-circuit. When a scry-KO
  // choice is parked the engine block-all guard freezes every other move, so the bot
  // must resolve it first. The single legal move is resolveScryKoChoice with the
  // deterministic default pick — selectScryKoTarget over the front entry's revealed
  // snapshot — keeping the bot's KO target byte-identical to the WP-447 auto-resolve
  // for replay determinism (only live human play gets the interactive prompt). The
  // pick is non-null because the park requires ≥2 revealed cards. Returns a list of
  // length EXACTLY 1 — omitting this MOVE_MAP path (or the dispatch entries) hangs the
  // per-turn loop.
  if (hasPendingScryKoChoice(gameState)) {
    const front = gameState.pendingScryKoChoices![0]!;
    const defaultCardId = selectScryKoTarget(front.revealedCardIds);
    if (defaultCardId !== null) {
      return [{ name: 'resolveScryKoChoice', args: { cardId: defaultCardId } }];
    }
    // why: defensive — an empty revealed snapshot is an engine-invariant violation;
    // fail closed rather than emit an unresolvable move.
    return legalMoves;
  }

  // why: WP-476 / D-24284 — pending discard-to-limit short-circuit. When a Magneto
  // discard choice is parked (for the active player only — non-current players are
  // auto-picked synchronously inside the strike) the engine block-all guard freezes
  // every other move, so the bot must resolve it first. The single legal move is
  // resolveDiscardChoice with the deterministic cheapest-first selection —
  // selectDiscardToLimitCards, the SAME selector the strike uses for non-current
  // auto-picks — so the bot's discard is identical whether it parked or auto-picked
  // (only live human play gets the interactive prompt). discardCount is > 0 because a
  // choice is parked only when the hand exceeds the limit and the board is frozen.
  // Returns a list of length EXACTLY 1 — omitting this path hangs the per-turn loop.
  if (hasPendingDiscardChoice(gameState)) {
    const front = gameState.pendingDiscardChoices![0]!;
    const discardCount = zones.hand.length - front.limit;
    if (discardCount > 0) {
      const cardIds = selectDiscardToLimitCards(gameState, zones.hand, discardCount);
      return [{ name: 'resolveDiscardChoice', args: { cardIds } }];
    }
    // why: defensive — a parked choice whose hand is already at/under the limit is an
    // engine-invariant violation; fail closed rather than emit an unresolvable move.
    return legalMoves;
  }

  // why: WP-479 / D-24286 — pending reveal-remainder reorder short-circuit. The engine
  // block-all guard freezes every other move, so the bot must resolve it first. The
  // deterministic default is the IDENTITY order (the parked cardIds unchanged — the order
  // the reveal loop already left), so par/replay stay byte-identical to a no-reorder world
  // except for the extra park→resolve move pair; only live human play gets the prompt.
  // Returns a list of length EXACTLY 1 — omitting this path hangs the per-turn loop.
  if (hasPendingReorderChoice(gameState)) {
    const front = gameState.pendingReorderChoices![0]!;
    return [{ name: 'resolveReorderChoice', args: { orderedCardIds: front.cardIds } }];
  }

  // why: WP-486 / D-24291 — pending defeat-with-a-Bystander short-circuit. The engine
  // block-all guard freezes every other move, so the bot must resolve it first. The
  // deterministic default picks the FIRST parked target (the pinned order: City spaces
  // ascending, then the Mastermind), so par/replay stay byte-identical except for the
  // extra park→resolve move pair; only live human play gets the prompt. Returns a list
  // of length EXACTLY 1 — omitting this path hangs the per-turn loop.
  if (hasPendingDefeatChoice(gameState)) {
    const front = gameState.pendingDefeatChoices![0]!;
    const target = front.targets[0]!;
    return [
      target.kind === 'villain'
        ? { name: 'resolveDefeatChoice', args: { targetKind: 'villain', cityIndex: target.cityIndex } }
        : { name: 'resolveDefeatChoice', args: { targetKind: 'mastermind' } },
    ];
  }

  // why: WP-427 / D-24248 — pending optional-put-bottom-HQ short-circuit. While a
  // single-card put-bottom-HQ choice (Ionic Energy's optional "You may put a card…"
  // or Absorb Ambient Power's mandatory "Put a card…") is pending, the engine
  // block-all guard freezes every OTHER move — but this file previously had NO
  // short-circuit for it, so getLegalMoves fell through to normal moves that the
  // guard then rejects. The bot could never resolve the choice: it dispatched a
  // rejected move, the fault fallback (endTurn / advanceStage) was equally blocked,
  // and its turn FAULTED ("The bot ally could not finish its turn"). Deterministic
  // default: the OPTIONAL form declines (neutral — no reward forgone); the MANDATORY
  // form (front.mandatory) cannot decline, so it moves the FIRST present HQ card
  // (lowest slot index — always valid, always unblocking). Returns EXACTLY 1 move.
  if (hasPendingOptionalPutBottomHQ(gameState)) {
    const front = gameState.pendingOptionalPutBottomHQ![0]!;
    if (front.mandatory === true) {
      const firstHqCardId = selectFirstHqCard(gameState.hq);
      if (firstHqCardId !== null) {
        return [{ name: 'resolveOptionalPutBottomHQ', args: { cardId: firstHqCardId } }];
      }
      // why: defensive — a mandatory choice over an empty HQ is an engine-invariant
      // violation; fail closed rather than emit an unresolvable move.
      return legalMoves;
    }
    return [{ name: 'resolveOptionalPutBottomHQ', args: { decline: true } }];
  }

  // why: WP-427 / D-24248 — pending put-any-number-bottom-HQ short-circuit (the
  // multi-select sibling: Wonder Man / Sunspot / Star-Lord). Same block-all freeze
  // and same missing-short-circuit fault as above. Deterministic bot default: the
  // empty "put none" selection — always valid, unblocking, and any trailing
  // Empowered grant on the pending entry still applies on resolve. Returns EXACTLY 1
  // move.
  if (hasPendingPutAnyNumberBottomHQ(gameState)) {
    return [{ name: 'resolvePutAnyNumberBottomHQ', args: { cardIds: [] } }];
  }

  const stage = gameState.currentStage;
  const availableAttack = getAvailableAttack(gameState.turnEconomy);
  const availableRecruit = getAvailableRecruit(gameState.turnEconomy);

  // 1. playCard intents — one entry per hand card, in hand order.
  // why: playCard args use cardId (ext_id), not hand index, per PlayCardArgs
  // in moves/coreMoves.types.ts. Duplicate ext_ids in hand (e.g., multiple
  // S.H.I.E.L.D. Agents) produce duplicate LegalMove entries; the policy may
  // select any, and the move dispatcher removes the first match from hand.
  if (stage === 'main') {
    for (const cardId of zones.hand) {
      legalMoves.push({ name: 'playCard', args: { cardId } });
    }
  }

  // 2. recruitHero intents — HQ slot 0..4 ascending (if affordable).
  if (stage === 'main') {
    for (let hqIndex = 0; hqIndex < gameState.hq.length; hqIndex++) {
      const slot: CardExtId | null = gameState.hq[hqIndex] ?? null;
      if (slot === null) continue;
      const requiredCost = gameState.cardStats[slot]?.cost ?? 0;
      if (availableRecruit >= requiredCost) {
        legalMoves.push({ name: 'recruitHero', args: { hqIndex } });
      }
    }
  }

  // 3. fightVillain intents — City slot 0..4 ascending (if affordable and
  //    not Guard-blocked).
  if (stage === 'main') {
    const cardKeywords = gameState.cardKeywords ?? {};
    for (let cityIndex = 0; cityIndex < gameState.city.length; cityIndex++) {
      const cityCard: CardExtId | null = gameState.city[cityIndex] ?? null;
      if (cityCard === null) continue;
      if (isGuardBlocking(gameState.city, cityIndex, cardKeywords)) continue;
      // why: use resolveFightCost — the WP-214 single authority for villain fight
      // cost — NOT the static cardStats.fightCost. Dynamic villains (vAttack "*"/"N+",
      // e.g. Skrull Queen Veranke after an Ambush capture) carry a static fightCost of
      // 0 but resolve to fightCostBase + captured-hero cost. Reading the static field
      // here offered the bot an unaffordable fight the fightVillain move then silently
      // rejected (it uses resolveFightCost, fightVillain.ts:95); because boardgame.io
      // still bumps _stateID on a void-return move, the bot-ally driver could not detect
      // the no-op and re-picked the same fight every step until the 100-step per-turn cap
      // FAULTED the co-op match (prod freeze, matches aifbXW04bA1 / eAVZNdWE5C1, 2026-07-27).
      const baseFightCost = resolveFightCost(gameState, cityCard);
      const patrolModifier = getPatrolModifier(cityCard, cardKeywords);
      const requiredFightCost = baseFightCost + patrolModifier;
      if (availableAttack >= requiredFightCost) {
        legalMoves.push({ name: 'fightVillain', args: { cityIndex } });
      }
    }
  }

  // 4. fightMastermind — at most one entry (affordable + tactics remain).
  if (stage === 'main' && gameState.mastermind.tacticsDeck.length > 0) {
    const mastermindFightCost =
      gameState.cardStats[gameState.mastermind.baseCardId]?.fightCost ?? 0;
    if (availableAttack >= mastermindFightCost) {
      legalMoves.push({ name: 'fightMastermind', args: {} });
    }
  }

  // 5. revealVillainCard — one entry if stage === 'start' AND the once-per-turn
  //    reveal allowance has not been consumed. The !villainRevealedThisTurn
  //    guard mirrors the move-level guard in villainDeck.reveal.ts so a bot
  //    policy that scores reveal highly cannot re-pick a guaranteed no-op reveal
  //    every move-step and spin the turn forever (never advancing to 'main').
  if (stage === 'start' && !gameState.villainRevealedThisTurn) {
    legalMoves.push({ name: 'revealVillainCard', args: {} });
  }

  // why: drawCards is no longer enumerated — the start-of-turn hand is drawn
  // automatically by the play-phase onBegin auto-draw (WP-236). Emitting
  // drawCards would only produce a guarded no-op (G.hasDrawnThisTurn is already
  // true after onBegin) and waste a bot move choice.

  // 6. advanceStage — one entry if not at cleanup.
  if (stage !== 'cleanup') {
    legalMoves.push({ name: 'advanceStage', args: {} });
  }

  // 7. endTurn — one entry if at cleanup.
  if (stage === 'cleanup') {
    legalMoves.push({ name: 'endTurn', args: {} });
  }

  // why: ordering locked by pre-flight RS-13 for deterministic seeded
  // selection; reordering silently flips every seeded decision output.
  return legalMoves;
}
