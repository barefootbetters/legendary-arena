/**
 * Hero condition evaluation for the Legendary Arena game engine.
 *
 * Evaluates declarative hero ability conditions against current game state.
 * Pure functions only — conditions read G and return boolean, never mutating
 * state. Unsupported condition types return false (safe skip).
 *
 * WP-179: heroClassMatch and requiresTeam are fully wired against G.cardTraits.
 * requiresKeyword and playedThisTurn are unchanged from WP-023.
 *
 * No boardgame.io imports. No registry imports. No .reduce().
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroCondition } from '../rules/heroAbility.types.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';
import { cardHasClassWhenPlayed, getGrantedClasses } from './sizeChanging.logic.js';
import { cardHasTeamWhenPlayed } from './effectiveTeams.logic.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';

// ---------------------------------------------------------------------------
// evaluateCondition — single condition evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates a single hero ability condition against current game state.
 *
 * Pure function: reads G, returns boolean, never mutates state.
 * Unsupported condition types return false (safe skip).
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param condition - The condition descriptor to evaluate.
 * @param triggeringCardId - Optional CardExtId of the card whose superpower is
 *   being evaluated. When provided, heroClassMatch and requiresTeam exclude
 *   this card from the inPlay scan (self-exclusion rule).
 * @returns Whether the condition is met.
 */
export function evaluateCondition(
  G: LegendaryGameState,
  playerID: string,
  condition: HeroCondition,
  triggeringCardId?: CardExtId,
): boolean {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return false;
  }

  switch (condition.type) {
    case 'heroClassMatch': {
      // why: self is excluded from scan — a card's own class does not satisfy
      // its own superpower. The physical card game rule requires *another*
      // card of the same class to have been played this turn.
      if (!G.cardTraits) {
        return false;
      }

      for (const playedCardId of playerZones.inPlay) {
        if (triggeringCardId !== undefined && playedCardId === triggeringCardId) {
          continue;
        }
        // why: D-24074 — an in-play Size-Changing card counts as each of its effective classes (printed plus granted), via the shared cardHasClassWhenPlayed helper
        if (cardHasClassWhenPlayed(G, playedCardId as CardExtId, condition.value)) {
          return true;
        }
      }

      return false;
    }

    case 'requiresTeam': {
      // why: self is excluded from scan — a card's own team does not satisfy
      // its own superpower. Same self-exclusion logic as heroClassMatch.
      if (!G.cardTraits) {
        return false;
      }

      for (const playedCardId of playerZones.inPlay) {
        if (triggeringCardId !== undefined && playedCardId === triggeringCardId) {
          continue;
        }
        // why: D-24391 — an in-play card counts as its printed team OR any team granted by Copy Powers (cardCopiedTeams), via the shared cardHasTeamWhenPlayed helper. Mirrors heroClassMatch routing through cardHasClassWhenPlayed; the self-exclusion loop above is preserved.
        if (cardHasTeamWhenPlayed(G, playedCardId as CardExtId, condition.value)) {
          return true;
        }
      }

      return false;
    }

    case 'requiresKeyword': {
      // why: evaluates keyword synergy — checks if any played card has
      // hooks with the specified keyword. Uses G.heroAbilityHooks which
      // is built at setup time and available at runtime.
      if (!G.heroAbilityHooks) {
        return false;
      }

      const targetKeyword = condition.value;

      for (const cardId of playerZones.inPlay) {
        const hooksForCard = getHooksForCard(G.heroAbilityHooks, cardId);
        for (const hook of hooksForCard) {
          for (const keyword of hook.keywords) {
            if (keyword === targetKeyword) {
              return true;
            }
          }
        }
      }

      return false;
    }

    case 'playedThisTurn': {
      // why: condition.value is always a string per HeroCondition contract
      // — parse to number for threshold comparison. Returns false if
      // parseInt produces NaN (safe skip for malformed data).
      const threshold = parseInt(condition.value, 10);
      if (Number.isNaN(threshold)) {
        return false;
      }

      return playerZones.inPlay.length >= threshold;
    }

    case 'distinctHeroClassesAtLeast': {
      // why: D-24055 — self-INCLUSIVE count (you *have* the classes; inverts
      // heroClassMatch's self-exclusion). S.H.I.E.L.D./Sidekick carry
      // `heroClass: null`, skipped by the `typeof === 'string'` guard, so never
      // count. Card is already in inPlay before executeHeroEffects runs.
      if (!G.cardTraits) {
        return false;
      }

      const threshold = parseInt(condition.value, 10);
      if (Number.isNaN(threshold)) {
        return false;
      }

      const distinctClasses = new Set<string>();
      for (const playedCardId of playerZones.inPlay) {
        const traitEntry = G.cardTraits[playedCardId as CardExtId];
        if (traitEntry !== undefined && typeof traitEntry.heroClass === 'string' && traitEntry.heroClass.length > 0) {
          distinctClasses.add(traitEntry.heroClass);
        }
        // why: D-24074 — an in-play Size-Changing card counts as each of its effective classes (printed plus granted), via the shared cardHasClassWhenPlayed helper
        for (const grantedClass of getGrantedClasses(G, playedCardId as CardExtId)) {
          distinctClasses.add(grantedClass);
        }
      }

      return distinctClasses.size >= threshold;
    }

    case 'recruitMadeThisTurnAtLeast': {
      // why: WP-545 / D-24354 — reads G.turnEconomy.recruit, the GROSS
      // recruit-MADE-this-turn accumulator (available = recruit − spentRecruit),
      // NOT the net available, so spending recruit does not lower the gate. The
      // printed condition ("If you made 8 or more Recruit this turn") counts
      // recruit generated, not recruit remaining.
      const threshold = parseInt(condition.value, 10);
      // why: safe-skip malformed data (mirrors playedThisTurn's NaN guard).
      if (Number.isNaN(threshold)) {
        return false;
      }

      return G.turnEconomy.recruit >= threshold;
    }

    case 'distinctHeroCostsAtLeast': {
      // why: D-24464 — Outwit gates on revealing Heroes with N different costs.
      // A CONDITION, not a keyword (the D-24055 Spectrum posture); mirrors
      // distinctHeroClassesAtLeast but counts distinct COSTS. Self-inclusive:
      // the played card is already in inPlay before executeHeroEffects runs.
      if (!G.cardStats) {
        return false;
      }
      const threshold = parseInt(condition.value, 10);
      if (Number.isNaN(threshold)) {
        return false;
      }
      const distinctCosts = new Set<number>();
      for (const playedCardId of playerZones.inPlay) {
        // why: safe access — a token in play has no cardStats row; a 0-cost card
        // (a S.H.I.E.L.D. basic) carries no Hero cost, so `> 0` excludes both
        // (only true Heroes contribute a distinct cost).
        const cost = G.cardStats[playedCardId as CardExtId]?.cost ?? 0;
        if (cost > 0) {
          distinctCosts.add(cost);
        }
      }
      return distinctCosts.size >= threshold;
    }

    case 'heroCostAtLeastInHandOrPlay': {
      // why: D-24464 — Worthy is true when you have a Hero costing >= N, counting
      // Heroes in HAND and in play. The first hand-inclusive condition scan; a
      // CONDITION per D-24055.
      if (!G.cardStats) {
        return false;
      }
      const threshold = parseInt(condition.value, 10);
      if (Number.isNaN(threshold)) {
        return false;
      }
      for (const zone of [playerZones.inPlay, playerZones.hand]) {
        for (const cardId of zone) {
          // why: safe access (a token has no cardStats row → cost 0, never >= 5).
          const cost = G.cardStats[cardId as CardExtId]?.cost ?? 0;
          if (cost >= threshold) {
            return true;
          }
        }
      }
      return false;
    }

    case 'bystandersInVictoryAtLeast': {
      // why: D-24464 — Savior gates on >= N Bystanders in the Victory Pile. The
      // two-arm predicate (a supply Bystander OR a rescued villain-deck Bystander)
      // is re-implemented INLINE here — the heroCountSource.resolve.ts classifier
      // is non-exported. A CONDITION per D-24055.
      const threshold = parseInt(condition.value, 10);
      if (Number.isNaN(threshold)) {
        return false;
      }
      let bystanderCount = 0;
      for (const cardId of playerZones.victory) {
        const extId = cardId as string;
        if (extId === BYSTANDER_EXT_ID || extId.startsWith('bystander-villain-deck-')) {
          bystanderCount += 1;
        }
      }
      return bystanderCount >= threshold;
    }

    case 'cheapOrSizeChangingAtLeast': {
      // why: D-24464 — Antics gates on >= N cards (hand + in-play) that cost 1-2
      // and/or are Size-Changing; each qualifying card counts ONCE. A CONDITION
      // per D-24055.
      if (!G.cardStats) {
        return false;
      }
      const threshold = parseInt(condition.value, 10);
      if (Number.isNaN(threshold)) {
        return false;
      }
      let matchCount = 0;
      for (const zone of [playerZones.inPlay, playerZones.hand]) {
        for (const cardId of zone) {
          const cost = G.cardStats[cardId as CardExtId]?.cost ?? 0;
          const isCheap = cost === 1 || cost === 2;
          // why: getGrantedClasses reads G.cardSizeChangingClasses (the
          // Size-Changing grant map), distinct from Copy-Powers' class/team maps,
          // so a non-empty list identifies Size-Changing specifically — not a copy.
          const isSizeChanging = getGrantedClasses(G, cardId as CardExtId).length > 0;
          if (isCheap || isSizeChanging) {
            matchCount += 1;
          }
        }
      }
      return matchCount >= threshold;
    }

    default: {
      // why: unsupported condition types are safely skipped — same pattern
      // as WP-022 for unsupported keywords. Future WPs will add new
      // condition types by extending this switch.
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// evaluateAllConditions — AND logic over all conditions
// ---------------------------------------------------------------------------

/**
 * Evaluates all conditions on a hero ability hook (AND logic).
 *
 * Returns true only if ALL conditions pass. Empty or undefined conditions
 * array returns true (unconditional effect).
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param conditions - Array of conditions to evaluate (may be undefined).
 * @param triggeringCardId - Optional CardExtId forwarded to each evaluateCondition call.
 * @returns Whether all conditions are met.
 */
export function evaluateAllConditions(
  G: LegendaryGameState,
  playerID: string,
  conditions: HeroCondition[] | undefined,
  triggeringCardId?: CardExtId,
): boolean {
  if (conditions === undefined || conditions.length === 0) {
    return true;
  }

  for (const condition of conditions) {
    if (!evaluateCondition(G, playerID, condition, triggeringCardId)) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// findFailedCondition + describeFailedCondition (WP-566 / D-24375)
// ---------------------------------------------------------------------------

/**
 * Returns the FIRST condition on a hook that fails, or undefined if all pass.
 *
 * why: a SIBLING of `evaluateAllConditions`, not a change to it. That function
 * is exported from `index.ts`, so widening its return type would be a public
 * contract change; this pair leaves it byte-identical. The iteration order is
 * deliberately the SAME short-circuit order, so the condition reported to the
 * player is always the one that actually stopped the ability.
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param conditions - Array of conditions to evaluate (may be undefined).
 * @param triggeringCardId - Optional CardExtId forwarded to each evaluateCondition call.
 * @returns The first failing condition, or undefined when every condition passes.
 */
export function findFailedCondition(
  G: LegendaryGameState,
  playerID: string,
  conditions: HeroCondition[] | undefined,
  triggeringCardId?: CardExtId,
): HeroCondition | undefined {
  if (conditions === undefined || conditions.length === 0) {
    return undefined;
  }

  // why: explicit for...of, no .reduce() (.claude/rules/code-style.md).
  for (const condition of conditions) {
    if (!evaluateCondition(G, playerID, condition, triggeringCardId)) {
      return condition;
    }
  }

  return undefined;
}

/**
 * Counts the distinct hero classes a player currently has in play.
 *
 * Mirrors the `distinctHeroClassesAtLeast` case's own counting so the message
 * quotes the same number the gate compared.
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @returns How many distinct hero classes are in play for that player.
 */
function countDistinctHeroClassesInPlay(
  G: LegendaryGameState,
  playerID: string,
): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !G.cardTraits) {
    return 0;
  }
  const distinctClasses = new Set<string>();
  for (const playedCardId of playerZones.inPlay) {
    const traitEntry = G.cardTraits[playedCardId as CardExtId];
    if (traitEntry !== undefined && typeof traitEntry.heroClass === 'string' && traitEntry.heroClass.length > 0) {
      distinctClasses.add(traitEntry.heroClass);
    }
    for (const grantedClass of getGrantedClasses(G, playedCardId as CardExtId)) {
      distinctClasses.add(grantedClass);
    }
  }
  return distinctClasses.size;
}

/**
 * Counts the distinct non-zero Hero costs a player currently has in play.
 * Mirrors the `distinctHeroCostsAtLeast` gate so the message quotes the same
 * number the gate compared.
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @returns How many distinct non-zero costs are in play for that player.
 */
function countDistinctHeroCostsInPlay(G: LegendaryGameState, playerID: string): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !G.cardStats) {
    return 0;
  }
  const distinctCosts = new Set<number>();
  for (const cardId of playerZones.inPlay) {
    const cost = G.cardStats[cardId as CardExtId]?.cost ?? 0;
    if (cost > 0) {
      distinctCosts.add(cost);
    }
  }
  return distinctCosts.size;
}

/**
 * Counts the Bystanders in a player's Victory Pile — the two-arm predicate (a
 * supply Bystander OR a rescued villain-deck Bystander), mirroring the
 * `bystandersInVictoryAtLeast` gate.
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @returns How many Bystanders are in that player's Victory Pile.
 */
function countBystandersInVictory(G: LegendaryGameState, playerID: string): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return 0;
  }
  let count = 0;
  for (const cardId of playerZones.victory) {
    const extId = cardId as string;
    if (extId === BYSTANDER_EXT_ID || extId.startsWith('bystander-villain-deck-')) {
      count += 1;
    }
  }
  return count;
}

/**
 * Counts a player's cards (hand + in-play) that cost 1-2 and/or are
 * Size-Changing — each qualifying card once — mirroring the
 * `cheapOrSizeChangingAtLeast` gate.
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @returns How many cheap-or-Size-Changing cards the player has.
 */
function countCheapOrSizeChanging(G: LegendaryGameState, playerID: string): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !G.cardStats) {
    return 0;
  }
  let count = 0;
  for (const zone of [playerZones.inPlay, playerZones.hand]) {
    for (const cardId of zone) {
      const cost = G.cardStats[cardId as CardExtId]?.cost ?? 0;
      const isCheap = cost === 1 || cost === 2;
      const isSizeChanging = getGrantedClasses(G, cardId as CardExtId).length > 0;
      if (isCheap || isSizeChanging) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Describes, in player-facing English, why a condition failed.
 *
 * why: WP-566 / D-24375 section 1 — ONE generic line ("a play condition (such as
 * Hero class or team synergy) was not met") used to stand in for every failure.
 * Counted at source it was right for 2 of the 4 constructed condition types and
 * wrong for the two NUMERIC-THRESHOLD ones — which are also the two whose failure
 * a player could act on. A message that confidently misattributes the cause is
 * worse than a vague one: it sends the reader to the wrong card property.
 *
 * why: section 3 — the fallback names the offending `type` and says the condition
 * could not be EVALUATED, deliberately distinct from every "not met" line.
 * `HeroCondition.type` is a bare `string`, so this describer cannot be made
 * compiler-exhaustive; the loud fallback is therefore also the guarantee that a
 * future condition type added without a case here surfaces as a visible defect
 * signal rather than as a plausible-looking wrong sentence.
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param condition - The condition that failed.
 * @returns A clause naming what was required and, where useful, what was actual.
 */
export function describeFailedCondition(
  G: LegendaryGameState,
  playerID: string,
  condition: HeroCondition,
): string {
  switch (condition.type) {
    case 'heroClassMatch':
      return `it needs another ${condition.value} Hero played this turn`;

    case 'requiresTeam':
      return `it needs another ${condition.value} Hero played this turn`;

    case 'requiresKeyword':
      return `it needs another ${condition.value} card played this turn`;

    case 'playedThisTurn': {
      const playerZones = G.playerZones[playerID];
      const played = playerZones ? playerZones.inPlay.length : 0;
      return `it needs ${condition.value} cards played this turn — you have played ${played}`;
    }

    case 'distinctHeroClassesAtLeast': {
      const distinct = countDistinctHeroClassesInPlay(G, playerID);
      return `it needs ${condition.value} different Hero classes in play — you have ${distinct}`;
    }

    case 'recruitMadeThisTurnAtLeast':
      // why: quotes G.turnEconomy.recruit, the GROSS recruit MADE this turn (the
      // value the gate compares), not the net available — spending recruit does
      // not lower the gate, and a message quoting the remainder would mislead.
      return `it needs ${condition.value} or more recruit this turn — you have made ${G.turnEconomy.recruit}`;

    case 'distinctHeroCostsAtLeast': {
      const distinct = countDistinctHeroCostsInPlay(G, playerID);
      return `it needs ${condition.value} Heroes of different costs in play — you have ${distinct}`;
    }

    case 'heroCostAtLeastInHandOrPlay':
      // why: a boolean existence gate (any Hero costing >= N in hand or play), so
      // there is no meaningful running count to quote.
      return `it needs a Hero costing ${condition.value} or more in your hand or in play`;

    case 'bystandersInVictoryAtLeast': {
      const count = countBystandersInVictory(G, playerID);
      return `it needs ${condition.value} Bystanders in your Victory Pile — you have ${count}`;
    }

    case 'cheapOrSizeChangingAtLeast': {
      const count = countCheapOrSizeChanging(G, playerID);
      return `it needs ${condition.value} cards costing 1-2 or Size-Changing — you have ${count}`;
    }

    default:
      return `its play condition could not be evaluated (unrecognized condition type "${condition.type}")`;
  }
}
