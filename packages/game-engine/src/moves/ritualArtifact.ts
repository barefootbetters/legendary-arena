/**
 * Ritual Artifacts for the Legendary Arena game engine (WP-858 / D-24794).
 *
 * Rules v23 p.17: a played Hero Artifact stays in front of its player at end of turn (the
 * player "controls" it), and a Ritual Artifact may be discarded for its listed effect once its
 * Ritual condition was fulfilled this turn — optionally, on the turn it is played or any later
 * turn of that player. Two cards are modeled, each selected by its marker keyword only:
 *
 * - `ritual-recruited-hero` — Staff of Legba: "If you recruited a Hero, you may discard Staff of
 *   Legba to get +Attack equal to that Hero's cost."
 * - `ritual-hero-classes` — Medallion of Many Loas: "If you have at least three Hero Classes, you
 *   may discard Medallion of Many Loas to get +1 Attack for each Hero Class you have, including
 *   this one." (the effect magnitude is the class threshold).
 *
 * `ritualArtifactOptions` is the single legality predicate, shared by the `useRitualArtifact`
 * move and the `economy.ritualArtifactOptions` projection (the WP-783 phasingOptions contract).
 * getLegalMoves never emits the move, so bots never use a Ritual.
 *
 * This is a non-core move that gates internally (the phaseCard precedent). It is NOT added to
 * CoreMoveName, CORE_MOVE_NAMES, or MOVE_ALLOWED_STAGES.
 *
 * No registry imports. No .reduce(). Moves never throw. Imported bindings are read only inside
 * function bodies (this module joins the runtime-safe import cycle through phaseCard and
 * heroEffects.execute).
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import {
  executeSingleEffect,
  RITUAL_ARTIFACT_EXECUTED_KEYWORDS,
} from '../hero/heroEffects.execute.js';
import { countDistinctHeroClassesYouHave } from '../hero/heroConditions.evaluate.js';
import { recordRitualUsedPlayed } from '../economy/economy.logic.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** Arguments for the useRitualArtifact move. */
export interface UseRitualArtifactArgs {
  /** The ext_id of the Ritual Artifact, in play this turn or controlled, to discard. */
  cardId: CardExtId;
}

/**
 * Returns the card's Ritual effect descriptor, or undefined when the card is not a modeled
 * Ritual Artifact.
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The card to look up.
 * @returns The first hook effect whose type is a Ritual Artifact keyword, else undefined.
 */
function findRitualEffect(G: LegendaryGameState, cardId: CardExtId): HeroEffectDescriptor | undefined {
  // why: the Array.isArray guard covers narrow test mocks that omit G.heroAbilityHooks
  // (getHooksForCard would otherwise iterate undefined) — the phaseCard precedent.
  if (!Array.isArray(G.heroAbilityHooks)) {
    return undefined;
  }
  for (const hook of getHooksForCard(G.heroAbilityHooks, cardId)) {
    for (const effect of hook.effects ?? []) {
      if (RITUAL_ARTIFACT_EXECUTED_KEYWORDS.includes(effect.type)) {
        return effect;
      }
    }
  }
  return undefined;
}

/**
 * Whether a card is a modeled Ritual Artifact (one of its hooks carries a Ritual keyword).
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The card to check.
 * @returns true when the card is kept in front of its player at end of turn.
 */
export function isRitualArtifact(G: LegendaryGameState, cardId: CardExtId): boolean {
  // why: WP-858 / D-24794 — selection is by the marker keyword only, so every unmarked
  // Artifact card (Wand of Watoomb, the gotg / mgtg / asrd / fear Artifacts) keeps its
  // previous behaviour and is discarded at end of turn as before.
  return findRitualEffect(G, cardId) !== undefined;
}

/**
 * Whether this match contains a Staff of Legba-style Ritual (a hook carrying
 * `ritual-recruited-hero`), so the recruit moves must record recruited Hero costs.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when some hero hook carries the `ritual-recruited-hero` keyword.
 */
export function matchHasRecruitedHeroRitual(G: LegendaryGameState): boolean {
  // why: WP-858 / D-24794 — the recruit record is written only in a match that can read it,
  // so no other match's G gains the field and the finalStateHash sentinels never move.
  if (!Array.isArray(G.heroAbilityHooks)) {
    return false;
  }
  for (const hook of G.heroAbilityHooks) {
    if (hook.keywords.includes('ritual-recruited-hero')) {
      return true;
    }
  }
  return false;
}

/**
 * Computes the Attack a Ritual Artifact would grant if used right now.
 *
 * Staff of Legba: the highest printed cost recruited this turn. Medallion of Many Loas: the
 * Hero Classes the player has (hand, still in play, controlled Artifacts). Read while the card
 * is still in play or controlled, so Medallion counts itself ("including this one").
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerId - The seat using the Ritual.
 * @param cardId - The Ritual Artifact.
 * @returns The Attack reward, or 0 for a card without a recognized Ritual.
 */
export function ritualArtifactReward(G: LegendaryGameState, playerId: string, cardId: CardExtId): number {
  const ritualEffect = findRitualEffect(G, cardId);
  if (ritualEffect === undefined) {
    return 0;
  }
  // why: WP-858 / D-24794 — an exhaustive if / else if over the modeled Ritual types; an
  // unrecognized type rewards 0 (and is never listed by ritualArtifactOptions), so a further
  // Ritual is added as a new branch here and in ritualConditionHolds.
  if (ritualEffect.type === 'ritual-recruited-hero') {
    return G.turnEconomy?.highestRecruitedHeroCost ?? 0;
  } else if (ritualEffect.type === 'ritual-hero-classes') {
    return countDistinctHeroClassesYouHave(G, playerId);
  } else {
    return 0;
  }
}

/**
 * Whether a Ritual Artifact's condition holds for the player right now.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerId - The seat using the Ritual.
 * @param ritualEffect - The card's Ritual effect descriptor.
 * @returns true when the Ritual may be used.
 */
function ritualConditionHolds(
  G: LegendaryGameState,
  playerId: string,
  ritualEffect: HeroEffectDescriptor,
): boolean {
  if (ritualEffect.type === 'ritual-recruited-hero') {
    // why: WP-858 / D-24794 — "If you recruited a Hero" is an event this turn; the turn record
    // holds it even when the Hero was recruited before the Staff was played (rules v23 p.17).
    return G.turnEconomy?.highestRecruitedHeroCost !== undefined;
  } else if (ritualEffect.type === 'ritual-hero-classes') {
    // why: WP-858 / D-24794 RS-6 — "If you have at least N Hero Classes" is a state, read at use
    // time (a conservative reading of "fulfilled … this turn").
    const threshold = ritualEffect.magnitude ?? 0;
    return countDistinctHeroClassesYouHave(G, playerId) >= threshold;
  } else {
    return false;
  }
}

/**
 * Lists the Ritual Artifacts the given player may use right now.
 *
 * Candidates are the distinct cards in the player's play area (played this turn), then the
 * Artifacts they control, in that order. A candidate is listed when it is a modeled Ritual
 * Artifact and its condition holds. Returns [] outside the `main` stage or while any pending
 * choice is open. Does not check the seat: callers pass `ctx.currentPlayer`.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerId - The seat whose Artifacts are checked.
 * @returns Usable Ritual Artifact ids, or [] when none.
 */
export function ritualArtifactOptions(G: LegendaryGameState, playerId: string): CardExtId[] {
  // why: WP-858 / D-24794 — the single legality predicate, shared by the useRitualArtifact move
  // and the economy.ritualArtifactOptions projection (the phasingOptions contract), so the Use
  // button the client shows and the move the engine accepts never disagree. Bots never use a
  // Ritual (getLegalMoves does not consult this). RS-3: the `main` window with no choice open —
  // rules v23 "You can only use Artifacts during your turn".
  if (G.currentStage !== 'main') return [];
  if (hasAnyPendingChoice(G)) return [];
  const playerZones = G.playerZones?.[playerId];
  if (!playerZones) return [];

  const candidates: CardExtId[] = [];
  for (const cardId of playerZones.inPlay) {
    if (!candidates.includes(cardId)) {
      candidates.push(cardId);
    }
  }
  for (const cardId of G.controlledArtifacts?.[playerId] ?? []) {
    if (!candidates.includes(cardId)) {
      candidates.push(cardId);
    }
  }

  const options: CardExtId[] = [];
  for (const cardId of candidates) {
    const ritualEffect = findRitualEffect(G, cardId);
    if (ritualEffect !== undefined && ritualConditionHolds(G, playerId, ritualEffect)) {
      options.push(cardId);
    }
  }
  return options;
}

/**
 * Removes a controlled Artifact from its player's list, deleting the empty key and map.
 *
 * @param G - Game state, mutated in place.
 * @param playerId - The controlling player.
 * @param cardId - The Artifact to remove.
 * @returns true when the card was found and removed.
 */
function removeControlledArtifact(G: LegendaryGameState, playerId: string, cardId: CardExtId): boolean {
  const controlled = G.controlledArtifacts?.[playerId];
  if (G.controlledArtifacts === undefined || controlled === undefined) {
    return false;
  }
  const removal = moveCardFromZone(controlled, [], cardId);
  if (!removal.found) {
    return false;
  }
  // why: WP-858 / D-24794 — delete the empty key, then the empty map, so a player who used every
  // Artifact leaves G exactly as a match that never kept one (no empty-container hash surface).
  if (removal.from.length > 0) {
    G.controlledArtifacts[playerId] = removal.from;
  } else {
    delete G.controlledArtifacts[playerId];
  }
  if (Object.keys(G.controlledArtifacts).length === 0) {
    delete G.controlledArtifacts;
  }
  return true;
}

/**
 * Uses a Ritual Artifact: discards it from play or from the controlled Artifacts and grants its
 * Attack reward.
 *
 * Any ineligible call — the wrong stage, a pending choice, a card that is not a usable Ritual
 * Artifact of the current player — returns silently with no mutation. Moves never throw.
 *
 * @param context - boardgame.io move context with G, ctx, random.
 * @param args - The ext_id of the Ritual Artifact to use.
 */
export function useRitualArtifact(
  { G, playerID, ...context }: MoveContext,
  args: UseRitualArtifactArgs,
): void {
  // Step 1: Validate args — a non-empty string cardId.
  // why: a client may submit no payload; reading a field off undefined / null throws.
  if (args === null || typeof args !== 'object') return;
  const cardId = args.cardId;
  if (typeof cardId !== 'string' || cardId.length === 0) return;

  // Step 2: Stage gate (non-core move, internal gating).
  if (G.currentStage !== 'main') return;

  // Step 3: Legality — the single shared predicate (stage, pending choice, held, condition).
  const playerId = context.ctx.currentPlayer;
  if (!ritualArtifactOptions(G, playerId).includes(cardId)) return;
  const playerZones = G.playerZones[playerId];
  if (!playerZones) return;

  // Step 4: Reward — read BEFORE the card leaves, so Medallion counts itself.
  const reward = ritualArtifactReward(G, playerId, cardId);

  // Step 5: Discard the card, from play first, else from the controlled Artifacts.
  const playResult = moveCardFromZone(playerZones.inPlay, playerZones.discard, cardId);
  if (playResult.found) {
    playerZones.inPlay = playResult.from;
    playerZones.discard = playResult.to;
    // why: WP-858 / D-24794 RS-5 — rules v23 L3441-3453: the card was played this turn, so it
    // still counts as "played this turn" after it moves to the discard pile.
    G.turnEconomy = recordRitualUsedPlayed(G.turnEconomy, cardId);
  } else if (removeControlledArtifact(G, playerId, cardId)) {
    playerZones.discard = [...playerZones.discard, cardId];
  } else {
    return;
  }

  // Step 6: Narrate, then grant through the shared flat attack executor (which logs the grant).
  pushLog(G, `Player ${playerId} used ${formatCardRef(G.cardDisplayData, cardId)}'s Ritual: discarded it.`);
  if (reward > 0) {
    executeSingleEffect(G, context, playerId, cardId, { type: 'attack', magnitude: reward });
  }
}
