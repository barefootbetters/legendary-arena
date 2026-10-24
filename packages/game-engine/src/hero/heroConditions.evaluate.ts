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
import { cardHasClassWhenPlayed, getGrantedClasses, getCopiedClasses } from './sizeChanging.logic.js';
import { cardCountsAsTeamMember } from './effectiveTeams.logic.js';
import { BYSTANDER_EXT_ID, WOUND_EXT_ID } from '../setup/pilesInit.js';
import { computeDayNight } from '../rules/dayNight.logic.js';
import { offPlayCardTraits, playedCardIdsStillInPlay, playedCardIdsThisTurn } from './splitCard.logic.js';

// why: WP-777 / D-24616 — the one literal for "If you discarded any cards this turn"
// (New Wings, Pumpkin Bombs). The setup marker arm, the evaluate + describe cases, the
// wait-and-see list and the discardFromHand counter gate all key on this value, so a
// named constant keeps them from drifting apart.
export const CARDS_DISCARDED_THIS_TURN_CONDITION_TYPE = 'cardsDiscardedThisTurnAtLeast';

// ---------------------------------------------------------------------------
// matchReadsConditionType — does any hook in this match read a condition?
// ---------------------------------------------------------------------------

/**
 * Reports whether any hero ability hook in this match carries a condition of the
 * given type.
 *
 * // why: WP-777 / D-24616 (the WP-743 §C signature) — a per-turn tracker that only
 * one or two cards read is written only when this match can read it, so a match
 * without those cards keeps a byte-identical G and the sentinel hash oracles never
 * move. G.heroAbilityHooks is built once at setup and never changes, so the answer is
 * stable for the whole match. Explicit for...of loops; no .reduce().
 *
 * @param G - The game state to inspect (not mutated).
 * @param conditionType - The HeroCondition.type to look for.
 * @returns true when at least one hook has a condition of that type.
 */
export function matchReadsConditionType(
  G: LegendaryGameState,
  conditionType: string,
): boolean {
  if (!Array.isArray(G.heroAbilityHooks)) {
    return false;
  }
  for (const hook of G.heroAbilityHooks) {
    for (const condition of hook.conditions ?? []) {
      if (condition.type === conditionType) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Master Strike / Ambush this-turn condition types (WP-743 / D-24566)
// ---------------------------------------------------------------------------

// why: WP-743 / D-24566 — named so the setup marker arm, the evaluator case, the
// describe case, the wait-and-see list and the reveal write-site gate all reference one
// literal (no cross-file drift). The reveal write-site gates its lazy flag writes on
// matchReadsConditionType above (shared with WP-777), so a match whose hooks never read
// a flag never gains that key on G and both hash oracles stay byte-unchanged.
/** Grief: a Master Strike was played this turn. */
export const MASTER_STRIKE_THIS_TURN_CONDITION_TYPE = 'masterStrikePlayedThisTurn';

/** Spring the Trap: a Master Strike or an Ambush Villain was played this turn. */
export const MASTER_STRIKE_OR_AMBUSH_THIS_TURN_CONDITION_TYPE = 'masterStrikeOrAmbushPlayedThisTurn';

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
    case 'heroClassMatch':
    case 'requiresTeam': {
      // why: self is excluded from the count — a card's own class or team does not satisfy its
      // own superpower; the rule requires *another* matching card played this turn.
      // why: D-24563 — counted through the shared countOtherInPlayMatchingCondition helper, so a
      // repeated prefix icon ("[hc:ranged][hc:ranged]:", requiredMatches 2) needs that many OTHER
      // matching cards. Distinct conditions are counted independently, so a multiclass card counts
      // toward each one it matches. The helper reads playedCardIdsThisTurn, so a card set aside
      // Out of Time earlier this turn still counts (rules v23 L3443-3446).
      return (
        countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId) >=
        effectiveRequiredMatches(condition)
      );
    }

    case 'requiresKeyword': {
      // why: evaluates keyword synergy — checks if any played card has
      // hooks with the specified keyword. Uses G.heroAbilityHooks which
      // is built at setup time and available at runtime.
      if (!G.heroAbilityHooks) {
        return false;
      }

      const targetKeyword = condition.value;

      // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
      for (const cardId of playedCardIdsThisTurn(G, playerZones.inPlay)) {
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

      // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
      return playedCardIdsThisTurn(G, playerZones.inPlay).length >= threshold;
    }

    case 'firstHeroPlayedThisTurn': {
      // why: WP-681 / D-24498 — Deadpool's "Hey, Can I Get a Do-Over?" gates on
      // "if this is the FIRST Hero you played this turn". "First Hero" means no OTHER
      // Hero is in the acting player's inPlay when this ability resolves. The played
      // Do-Over card is already in inPlay when executeHeroEffects runs, so it is
      // self-excluded via triggeringCardId (the heroClassMatch self-exclusion rule); if
      // any OTHER card remains in inPlay, a prior Hero was played this turn, so this is
      // NOT the first Hero and the gate fails. A boolean gate — condition.value is unused.
      // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
      for (const playedCardId of playedCardIdsThisTurn(G, playerZones.inPlay)) {
        if (triggeringCardId !== undefined && playedCardId === triggeringCardId) {
          continue;
        }
        return false;
      }
      return true;
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

      // why: D-24694 — rules v23 ~L1950-1953: "You can count all the classes you have
      // among cards you played this turn and cards in your hand." So Spectrum is the
      // hand + play distinct-class count, the same one "each color of Hero you have"
      // reads: hand cards contribute printed hc/hc2 (a split card both halves, WP-772);
      // played cards keep Penumbra both-sides (WP-780), hc2 (WP-703) and Size-Changing
      // grants (D-24074). It read played cards only until D-24694.
      return countDistinctHeroClassesYouHave(G, playerID) >= threshold;
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

    case 'cardsDrawnThisTurnAtLeast': {
      // why: WP-665 / D-24476 — reads G.turnEconomy.cardsDrawn, the per-turn count of
      // cards drawn from EFFECTS this turn (the end-of-turn hand fill is excluded). D-24732
      // widened the counter from the draw:N path to every effect draw by the current player.
      // Gamma-Draining Nanites' "if you drew two cards this turn" gate. A wait-and-see
      // condition (deferredConditionalGrants) so it re-checks each move this turn.
      const drawThreshold = parseInt(condition.value, 10);
      // why: safe-skip malformed data (mirrors recruitMadeThisTurnAtLeast's NaN guard).
      if (Number.isNaN(drawThreshold)) {
        return false;
      }

      return G.turnEconomy.cardsDrawn >= drawThreshold;
    }

    case CARDS_DISCARDED_THIS_TURN_CONDITION_TYPE: {
      // why: WP-777 / D-24616 — "If you discarded any cards this turn" (New Wings,
      // Pumpkin Bombs). Reads THIS player's entry of G.cardsDiscardedThisTurn, the
      // per-player count of card-effect hand discards kept at the discardFromHand
      // chokepoint. Per-player because a Master Strike or Covering Fire can make another
      // player discard during this turn, and that discard is theirs, not yours. An
      // absent map or entry means nothing was discarded (the counter is lazy).
      const discardThreshold = parseInt(condition.value, 10);
      // why: safe-skip malformed data (mirrors cardsDrawnThisTurnAtLeast's NaN guard).
      if (Number.isNaN(discardThreshold)) {
        return false;
      }

      return (G.cardsDiscardedThisTurn?.[playerID] ?? 0) >= discardThreshold;
    }

    case 'distinctHeroCostsAtLeast': {
      // why: D-24491 (corrects D-24464) — Outwit gates on REVEALING Heroes with N
      // different costs. Per universal-rules-v23 §Outwit, "reveal" spans the cards
      // you already played AND Heroes in your hand, and a 0-cost S.H.I.E.L.D. Agent
      // Hero counts: the rulebook's own worked example is a 2-cost Hero in hand +
      // a 6-cost Outwit card + a 0-cost S.H.I.E.L.D. Agent already played = the 3
      // different costs. So the scan is hand + inPlay, distinct costs INCLUDING 0;
      // only Wounds/Bystanders are excluded (they are not Heroes and carry no
      // cardStats row → cost 0). Self-inclusive: the Outwit card is already in
      // inPlay before executeHeroEffects runs. A CONDITION, not a keyword (the
      // D-24055 Spectrum posture); the earlier inPlay-only, non-zero-only reading
      // wrongly blocked Outwit whenever the qualifying Heroes were still in hand.
      if (!G.cardStats) {
        return false;
      }
      const threshold = parseInt(condition.value, 10);
      if (Number.isNaN(threshold)) {
        return false;
      }
      return countDistinctHeroCostsInHandOrPlay(G, playerID) >= threshold;
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
      // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
      // why: WP-803 / D-24692 — a "Heroes you have" read (hand + still in play), so a card that went Out of Time is excluded: rules v23 L3443-3447 (a played card that moved elsewhere doesn't count as "Your Heroes" or "Heroes you Have") + L3457-3470 ("Reveal a Hero" / "KO one of your Heroes" can't pick it).
      for (const zone of [playedCardIdsStillInPlay(G, playerZones.inPlay), playerZones.hand]) {
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
      // is non-exported. A CONDITION per D-24055. A defeated Killbot keeps its
      // villain-deck Bystander id, so it counts here too (rules v23 L2337-2341).
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
      // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
      // why: WP-803 / D-24692 — a "Heroes you have" read (hand + still in play), so a card that went Out of Time is excluded: rules v23 L3443-3447 (a played card that moved elsewhere doesn't count as "Your Heroes" or "Heroes you Have") + L3457-3470 ("Reveal a Hero" / "KO one of your Heroes" can't pick it).
      for (const zone of [playedCardIdsStillInPlay(G, playerZones.inPlay), playerZones.hand]) {
        for (const cardId of zone) {
          const cost = G.cardStats[cardId as CardExtId]?.cost ?? 0;
          const isCheap = cost === 1 || cost === 2;
          // why: getGrantedClasses reads G.cardSizeChangingClasses (the
          // Size-Changing grant map), distinct from Copy-Powers' class/team maps
          // (cardCopiedClasses / cardCopiedTeams, D-24730), so a non-empty list
          // identifies Size-Changing specifically — not a copy.
          const isSizeChanging = getGrantedClasses(G, cardId as CardExtId).length > 0;
          if (isCheap || isSizeChanging) {
            matchCount += 1;
          }
        }
      }
      return matchCount >= threshold;
    }

    case 'defeatedVillainOrMastermindThisTurn': {
      // why: WP-656 / D-24467 — Diamond Form's "Whenever you defeat a Villain or
      // Mastermind this turn, you get +3 Recruit." A wait-and-see gate re-checked by
      // the existing per-move onMove resolution (game.ts). It reads the EDGE signal
      // G.villainOrMastermindDefeatedSinceResolve, set (gated) at the fight sites and
      // consumed each resolution, so the gate is true only on the move immediately
      // after a qualifying defeat — never sticky. Ignores condition.value (a boolean
      // gate, no threshold). Safe-skip parity: an absent flag reads false, never throws.
      return G.villainOrMastermindDefeatedSinceResolve === true;
    }

    case MASTER_STRIKE_THIS_TURN_CONDITION_TYPE: {
      // why: WP-743 / D-24566 — Grief's "If a Master Strike was completed this turn". A
      // sticky per-turn predicate (a count >= 1 threshold) read from the gated lazy flag
      // performVillainReveal sets when a Master Strike reaches the strike pile. Ignores
      // condition.value. An absent flag reads false, so this never throws.
      return G.masterStrikePlayedThisTurn === true;
    }

    case MASTER_STRIKE_OR_AMBUSH_THIS_TURN_CONDITION_TYPE: {
      // why: WP-743 / D-24566 — Spring the Trap's "If a Master Strike or Villain that has
      // an Ambush ability was played this turn". Either sticky flag satisfies it; the
      // ambush flag alone never satisfies Grief's case above. Ignores condition.value.
      return G.masterStrikePlayedThisTurn === true || G.ambushVillainPlayedThisTurn === true;
    }

    case 'heroClassInDiscardPile': {
      // why: D-24544 — X-Gene glossary ("X-Gene [class]: <effect>" means "If you have a
      // [class] card in your discard pile, <effect>."): true iff the acting player's
      // discard pile holds >=1 card whose PRINTED class equals condition.value. Printed
      // class only — Size-Changing grants are an in-play-only effect and never apply to a
      // discarded card, mirroring the hand-half of countDistinctHeroClassesYouHave.
      // condition.value is the class read from the co-located [hc:X] token at parse time,
      // never a hardcoded literal.
      return discardHasHeroClass(G, playerID, condition.value);
    }

    case 'sunlightInEffect': {
      // why: WP-765 / D-24598 — "[keyword:Sunlight]: <effect>" works only while most HQ Heroes
      // have even printed costs (rules v23 ~L1696-1731). Read from the shared computeDayNight at
      // hook-resolution time, never cached per card: abilities resolve one at a time
      // (~L2603-2610), so each line re-reads the HQ as it resolves. Deliberately NOT a
      // wait-and-see or sequence-gate type — day/night is board state resolved per line, not a
      // turn window or a play-order synergy. Ignores condition.value.
      return computeDayNight(G) === 'sunlight';
    }

    case 'moonlightInEffect': {
      // why: WP-765 / D-24598 — the Moonlight mirror of the case above (most HQ Heroes have odd
      // printed costs); a tie is neither, so both day/night gates fail on a tie.
      return computeDayNight(G) === 'moonlight';
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
// countOtherInPlayMatchingCondition — how many OTHER played cards match (WP-740)
// ---------------------------------------------------------------------------

/**
 * Returns how many OTHER matching cards a condition requires (D-24563).
 *
 * `requiredMatches` when it is an integer above 1, else 1 — so an absent, 1, 0 or non-integer
 * value behaves exactly like a plain single-icon gate.
 *
 * @param condition - The condition being evaluated or described.
 * @returns The effective required count (always at least 1).
 */
function effectiveRequiredMatches(condition: HeroCondition): number {
  const requiredMatches = condition.requiredMatches;
  if (typeof requiredMatches === 'number' && Number.isInteger(requiredMatches) && requiredMatches > 1) {
    return requiredMatches;
  }
  return 1;
}

/**
 * Returns the printed cost floor a counted OTHER card must meet (WP-825 / D-24758).
 *
 * `minimumCost` when it is an integer of 1 or more, else 0 — so an absent, 0, negative or
 * non-integer value behaves exactly like a gate with no cost floor.
 *
 * @param condition - The condition being evaluated or described.
 * @returns The effective minimum printed cost (0 = no floor).
 */
function effectiveMinimumCost(condition: HeroCondition): number {
  const minimumCost = condition.minimumCost;
  if (typeof minimumCost === 'number' && Number.isInteger(minimumCost) && minimumCost >= 1) {
    return minimumCost;
  }
  return 0;
}

/**
 * Counts the OTHER cards the player played this turn that satisfy one condition.
 *
 * WP-740 / D-24562 introduced it for a doubled "both" line; since D-24563 it is the counting
 * primitive behind every heroClassMatch / requiresTeam gate — evaluateCondition calls it and
 * compares the count with the condition's requiredMatches (the rulebook's "Critical Hit" rule:
 * a repeated icon needs that many OTHER matching cards). Uses the shared membership helpers
 * (cardCountsAsTeamMember / cardHasClassWhenPlayed), so Copy-Powers teams, dual classes,
 * Size-Changing classes and the teamless basic S.H.I.E.L.D. tokens count identically. Only
 * heroClassMatch and requiresTeam are countable; any other type returns 0 (fails closed).
 *
 * why: this deliberately duplicates the module-private played-this-turn counters in
 * heroCountSource.resolve.ts (duplicate-first, 00.6 Rule 1) — those are count sources for
 * per-count grants keyed by a fixed team/class, this counts against a parsed HeroCondition.
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param condition - The condition each counted card must satisfy.
 * @param triggeringCardId - Optional: the card being evaluated, skipped by exact instance id,
 *   so a second copy of the same card (a different #N) still counts. When undefined, nothing
 *   is skipped.
 * @returns The number of other played-this-turn cards that satisfy the condition.
 */
export function countOtherInPlayMatchingCondition(
  G: LegendaryGameState,
  playerID: string,
  condition: HeroCondition,
  triggeringCardId?: CardExtId,
): number {
  const playerZones = G.playerZones[playerID];
  // why: cardHasClassWhenPlayed dereferences G.cardTraits[cardId] unguarded, so a missing
  // traits map must short-circuit BEFORE the loop (mirrors evaluateCondition's guard).
  if (!playerZones || !G.cardTraits) {
    return 0;
  }
  if (condition.type !== 'requiresTeam' && condition.type !== 'heroClassMatch') {
    return 0;
  }
  const minimumCost = effectiveMinimumCost(condition);
  let matchCount = 0;
  // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
  for (const playedCardId of playedCardIdsThisTurn(G, playerZones.inPlay)) {
    if (triggeringCardId !== undefined && playedCardId === triggeringCardId) {
      continue;
    }
    const cardId = playedCardId as CardExtId;
    let isMatch = false;
    if (condition.type === 'requiresTeam') {
      isMatch = cardCountsAsTeamMember(G, cardId, condition.value);
    } else {
      isMatch = cardHasClassWhenPlayed(G, cardId, condition.value);
    }
    // why: WP-825 / D-24758 — a printed "that costs N or more" floor. The cost reads
    // G.cardStats (the S.H.I.E.L.D. Agent / Trooper carry cost-0 rows, the Officer cost 3);
    // `?? 0` covers a card with no row, which never meets a floor of 1 or more.
    if (isMatch && minimumCost > 0) {
      const cost = G.cardStats?.[cardId]?.cost ?? 0;
      isMatch = cost >= minimumCost;
    }
    if (isMatch) {
      matchCount += 1;
    }
  }
  return matchCount;
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
 * Counts the distinct hero colors (classes) among the Heroes a player HAS —
 * their HAND plus their play area — for the "for each color of Hero you have"
 * count-scaled family (Captain America's Avengers Assemble! / Perfect Teamwork)
 * and for the Spectrum gate (`distinctHeroClassesAtLeast`, D-24694).
 *
 * "Heroes you have" is a rulebook term of art (D-24529): per
 * `docs/legendary-universal-rules-v23.md` §"'Your Heroes/Allies' & 'Heroes/Allies
 * You Have'" it "include[s] both the cards in your hand and the cards you have
 * played this turn" — the Heroes in the deck, discard, and KO pile don't count.
 * So the count is ORDER-INDEPENDENT: a Tech Hero still in hand counts even when
 * Avengers Assemble! is played first. Spectrum reads the same pool: rules v23
 * ~L1950-1953 count "the classes you have among cards you played this turn and
 * cards in your hand" (D-24694; it read the play area only before).
 *
 * Gray S.H.I.E.L.D. basics / Officers / Sidekicks carry no `heroClass` (no color),
 * so they never add to the count — matching the printed "color of Hero" wording.
 * A dual-class card contributes BOTH printed classes (WP-703). getGrantedClasses
 * (Size-Changing) is applied only to in-play cards, because that grant is an
 * in-play effect; a card in hand contributes only its printed color(s).
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @returns How many distinct hero colors the player has across hand and play.
 */
export function countDistinctHeroClassesYouHave(
  G: LegendaryGameState,
  playerID: string,
): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !G.cardTraits) {
    return 0;
  }
  const distinctClasses = new Set<string>();
  // why: HAND half — a Hero still in hand counts as "a Hero you have"; use its
  // printed color(s) only (no Size-Changing grant, which is an in-play effect).
  for (const handCardId of playerZones.hand) {
    // why: WP-772 / D-24604 — only the HAND half reads the off-play view: a split card in hand
    // counts as both halves' classes (rules v23 p.49), resolved through the split-face map.
    // The play-area half below keeps the chosen face only.
    const traitEntry = offPlayCardTraits(G, handCardId);
    if (traitEntry !== undefined && typeof traitEntry.heroClass === 'string' && traitEntry.heroClass.length > 0) {
      distinctClasses.add(traitEntry.heroClass);
    }
    // why: WP-703 / D-24523 — a dual-class card contributes BOTH printed classes.
    if (traitEntry !== undefined && typeof traitEntry.heroClass2 === 'string' && traitEntry.heroClass2.length > 0) {
      distinctClasses.add(traitEntry.heroClass2);
    }
  }
  // why: PLAY-AREA half — the one played-card class read for both this count and the
  // Spectrum gate, including heroClass2 and getGrantedClasses (an in-play
  // Size-Changing Hero contributes each granted color).
  // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
  // why: WP-803 / D-24692 — a "Heroes you have" read (hand + still in play), so a card that went Out of Time is excluded: rules v23 L3443-3447 (a played card that moved elsewhere doesn't count as "Your Heroes" or "Heroes you Have") + L3457-3470 ("Reveal a Hero" / "KO one of your Heroes" can't pick it).
  for (const playedCardId of playedCardIdsStillInPlay(G, playerZones.inPlay)) {
    const traitEntry = G.cardTraits[playedCardId as CardExtId];
    if (traitEntry !== undefined && typeof traitEntry.heroClass === 'string' && traitEntry.heroClass.length > 0) {
      distinctClasses.add(traitEntry.heroClass);
    }
    if (traitEntry !== undefined && typeof traitEntry.heroClass2 === 'string' && traitEntry.heroClass2.length > 0) {
      distinctClasses.add(traitEntry.heroClass2);
    }
    for (const grantedClass of getGrantedClasses(G, playedCardId as CardExtId)) {
      distinctClasses.add(grantedClass);
    }
    // why: D-24730 — Copy Powers' copied class lives in its own turn-scoped map.
    for (const copiedClass of getCopiedClasses(G, playedCardId as CardExtId)) {
      distinctClasses.add(copiedClass);
    }
  }
  return distinctClasses.size;
}

/**
 * Counts the distinct Hero costs a player can reveal — across HAND and in-play,
 * counting a 0-cost Hero (e.g. a S.H.I.E.L.D. Agent) as the distinct cost 0, and
 * excluding only Wounds/Bystanders (not Heroes). Mirrors the
 * `distinctHeroCostsAtLeast` gate so the failure message quotes the same number
 * the gate compared.
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @returns How many distinct Hero costs are revealable (hand + play).
 */
function countDistinctHeroCostsInHandOrPlay(G: LegendaryGameState, playerID: string): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !G.cardStats) {
    return 0;
  }
  const distinctCosts = new Set<number>();
  // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
  // why: WP-803 / D-24692 — a "Heroes you have" read (hand + still in play), so a card that went Out of Time is excluded: rules v23 L3443-3447 (a played card that moved elsewhere doesn't count as "Your Heroes" or "Heroes you Have") + L3457-3470 ("Reveal a Hero" / "KO one of your Heroes" can't pick it).
  for (const zone of [playedCardIdsStillInPlay(G, playerZones.inPlay), playerZones.hand]) {
    for (const cardId of zone) {
      // why: Wounds and Bystanders are not Heroes (and carry no cardStats row, so
      // would otherwise read as a phantom cost 0); every real Hero, including a
      // 0-cost S.H.I.E.L.D. basic, has a row and contributes its cost — 0 included.
      if (cardId === WOUND_EXT_ID || cardId === BYSTANDER_EXT_ID) {
        continue;
      }
      const cost = G.cardStats[cardId as CardExtId]?.cost ?? 0;
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
 * Whether a player's discard pile holds at least one card whose PRINTED hero class
 * (`heroClass` or `heroClass2`) equals the given class slug — the scan behind the
 * `heroClassInDiscardPile` condition (D-24544 / WP-723, X-23's X-Gene).
 *
 * why: reads PRINTED class only (`G.cardTraits`), never Size-Changing grants (an
 * in-play-only effect that cannot apply to a discarded card), mirroring the hand-half
 * of `countDistinctHeroClassesYouHave`. Explicit `for...of`, no `.reduce()`
 * (.claude/rules/code-style.md). A discarded token with no `cardTraits` row (a
 * Wound / S.H.I.E.L.D. basic) carries no class and is skipped.
 *
 * @param G - Current game state (read-only).
 * @param playerID - Active player ID.
 * @param heroClassSlug - The normalized class slug to look for (from the X-Gene [hc:X] token).
 * @returns Whether the discard pile holds a card of that printed class.
 */
function discardHasHeroClass(
  G: LegendaryGameState,
  playerID: string,
  heroClassSlug: string,
): boolean {
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !G.cardTraits) {
    return false;
  }
  for (const discardCardId of playerZones.discard) {
    // why: WP-772 / D-24604 — the discard pile is off play, so a split card there counts as
    // both halves' classes (rules v23 p.49), resolved through the split-face map.
    const traitEntry = offPlayCardTraits(G, discardCardId);
    if (traitEntry === undefined) {
      continue;
    }
    if (traitEntry.heroClass === heroClassSlug || traitEntry.heroClass2 === heroClassSlug) {
      return true;
    }
  }
  return false;
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
  // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
  // why: WP-803 / D-24692 — a "Heroes you have" read (hand + still in play), so a card that went Out of Time is excluded: rules v23 L3443-3447 (a played card that moved elsewhere doesn't count as "Your Heroes" or "Heroes you Have") + L3457-3470 ("Reveal a Hero" / "KO one of your Heroes" can't pick it).
  for (const zone of [playedCardIdsStillInPlay(G, playerZones.inPlay), playerZones.hand]) {
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
    case 'requiresTeam': {
      // why: D-24563 — a repeated prefix icon names its count; the single-icon wording is unchanged.
      const requiredMatches = effectiveRequiredMatches(condition);
      // why: WP-825 / D-24758 — a cost floor names the printed cost, so the log says why a
      // played cost-0 starter didn't count.
      const minimumCost = effectiveMinimumCost(condition);
      if (requiredMatches > 1) {
        const pluralCostClause = minimumCost > 0 ? ` that cost ${minimumCost} or more` : '';
        return `it needs ${requiredMatches} other ${condition.value} Heroes${pluralCostClause} played this turn`;
      }
      const costClause = minimumCost > 0 ? ` that costs ${minimumCost} or more` : '';
      return `it needs another ${condition.value} Hero${costClause} played this turn`;
    }

    case 'requiresKeyword':
      return `it needs another ${condition.value} card played this turn`;

    case 'playedThisTurn': {
      const playerZones = G.playerZones[playerID];
      // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
      const played = playerZones ? playedCardIdsThisTurn(G, playerZones.inPlay).length : 0;
      return `it needs ${condition.value} cards played this turn — you have played ${played}`;
    }

    case 'firstHeroPlayedThisTurn':
      // why: WP-681 / D-24498 — a boolean "first Hero this turn" gate; there is no
      // running count to quote. The line fires only when no other Hero has been played.
      return 'it needs to be the first Hero you played this turn';

    case 'distinctHeroClassesAtLeast': {
      // why: D-24694 — quotes the same hand + play count the gate compared.
      const distinct = countDistinctHeroClassesYouHave(G, playerID);
      return `it needs ${condition.value} different Hero classes in hand or play — you have ${distinct}`;
    }

    case 'recruitMadeThisTurnAtLeast':
      // why: quotes G.turnEconomy.recruit, the GROSS recruit MADE this turn (the
      // value the gate compares), not the net available — spending recruit does
      // not lower the gate, and a message quoting the remainder would mislead.
      return `it needs ${condition.value} or more recruit this turn — you have made ${G.turnEconomy.recruit}`;

    case 'cardsDrawnThisTurnAtLeast':
      // why: WP-665 / D-24476 — quotes G.turnEconomy.cardsDrawn, the per-turn effect-draw
      // count the gate compares (the "drew N cards this turn" wait-and-see window). The
      // count excludes the start-of-turn refill, so it reflects cards drawn from effects.
      return `it needs ${condition.value} or more cards drawn this turn — you have drawn ${G.turnEconomy.cardsDrawn}`;

    case CARDS_DISCARDED_THIS_TURN_CONDITION_TYPE: {
      // why: WP-777 / D-24616 — quotes this player's per-turn hand-discard count, the
      // value the gate compares (absent counter = nothing discarded yet).
      const discardedCount = G.cardsDiscardedThisTurn?.[playerID] ?? 0;
      return `it needs ${condition.value} or more cards discarded this turn — you have discarded ${discardedCount}`;
    }

    case 'distinctHeroCostsAtLeast': {
      const distinct = countDistinctHeroCostsInHandOrPlay(G, playerID);
      return `it needs ${condition.value} Heroes of different costs in hand or play — you have ${distinct}`;
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

    case 'defeatedVillainOrMastermindThisTurn':
      // why: WP-656 / D-24467 — a boolean defeat gate, so there is no running count
      // to quote. The line is the wait-and-see "not yet" phrasing (the ability applies
      // the moment a qualifying defeat lands this turn), matching the recorded log text.
      return 'it needs you to defeat a Villain or Mastermind this turn';

    case MASTER_STRIKE_THIS_TURN_CONDITION_TYPE:
      // why: WP-743 / D-24566 — a boolean per-turn gate; no running count to quote.
      return 'it needs a Master Strike played this turn';

    case MASTER_STRIKE_OR_AMBUSH_THIS_TURN_CONDITION_TYPE:
      // why: WP-743 / D-24566 — a boolean per-turn gate; no running count to quote.
      return 'it needs a Master Strike or a Villain with an Ambush ability played this turn';

    case 'heroClassInDiscardPile':
      // why: D-24544 — X-Gene's discard-pile class-presence gate; a boolean existence
      // gate over the discard pile, so there is no running count to quote.
      // why: WP-729 / D-24544 copy fix — article-aware so a vowel-initial hero class
      // ("instinct") reads "an instinct card", not the ungrammatical "a instinct card";
      // consonant classes (strength/covert/tech/ranged) keep "a". Copy-only, no behavior change.
      return `it needs a${/^[aeiou]/i.test(condition.value) ? 'n' : ''} ${condition.value} card in your discard pile`;

    case 'sunlightInEffect':
      // why: WP-765 / D-24598 — a boolean board-state gate; the HQ decides it, so there is no
      // running count to quote.
      return "it isn't Sunlight";

    case 'moonlightInEffect':
      return "it isn't Moonlight";

    default:
      return `its play condition could not be evaluated (unrecognized condition type "${condition.type}")`;
  }
}

// ---------------------------------------------------------------------------
// Sequence-teacher predicate (WP-710 / D-24533) — a pure Runtime-Safe read
// ---------------------------------------------------------------------------

/**
 * The closed set of "snapshot-gate" HeroCondition types the play-order sequence
 * teacher reasons about (WP-710 / D-24533): the class / team / keyword gates that
 * read `playerZones.inPlay` at play time and are therefore reorder-fixable.
 *
 * why: `firstHeroPlayedThisTurn` / `playedThisTurn` are excluded (a "play earliest"
 * / raw-count gate does not fit "play E before C"), and the numeric wait-and-see
 * thresholds (`WAIT_AND_SEE_CONDITION_TYPES`) are excluded because the engine already
 * retro-fires them — a reorder cannot "land" what auto-rescues. Kept as a runtime
 * array (not a compile-time union) because `HeroCondition.type` is a bare string; the
 * drift-parity assertions live in the test (disjoint from `WAIT_AND_SEE_CONDITION_TYPES`,
 * and every member has an `evaluateCondition` case).
 */
export const SEQUENCE_GATE_CONDITION_TYPES: readonly string[] = [
  'heroClassMatch',
  'requiresTeam',
  'requiresKeyword',
];

/**
 * The setup-static card data slice the sequence-teacher predicate needs — exactly
 * the maps `evaluateCondition`'s class / team / keyword gates read. The server passes
 * these from the reduced final match state.
 */
export type HeroConditionCardData = Pick<
  LegendaryGameState,
  'cardTraits' | 'cardSizeChangingClasses' | 'cardCopiedTeams' | 'heroAbilityHooks'
>;

/**
 * Whether a card carries a size-changing or copy-powers hook (WP-710 / D-24533).
 *
 * why: those two mechanics grant a class / team at RUNTIME (`cardSizeChangingClasses`
 * is setup-static but `cardCopiedTeams` is filled by the copy-powers handler mid-play),
 * and the sequence teacher never captures the per-play grant maps — so a card whose
 * class/team match could depend on such a grant is scoped OUT (the predicate returns
 * `unsupported`, and the teacher skips the whiff), keeping every emitted tip faithful.
 *
 * @param cardData - The setup-static card-data slice.
 * @param cardId - The card to classify.
 * @returns Whether the card has a size-changing or copy-powers hook.
 */
function isSizeChangingOrCopyPowers(cardData: HeroConditionCardData, cardId: CardExtId): boolean {
  const hooks = cardData.heroAbilityHooks ? getHooksForCard(cardData.heroAbilityHooks, cardId) : [];
  for (const hook of hooks) {
    if ((hook.sizeChangingClasses?.length ?? 0) > 0) {
      return true;
    }
    for (const keyword of hook.keywords) {
      if (keyword === 'copy-powers') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Pure Runtime-Safe predicate: does a snapshot-gate `HeroCondition` hold for a played
 * card given a candidate set of same-turn in-play cards? (WP-710 / D-24533.)
 *
 * why: the play-order sequence teacher (a server-layer read over the D-24119 replay)
 * calls this to (a) reproduce whether a clause whiffed over the captured real `inPlay`,
 * and (b) test whether an unconditional later-played hero would have satisfied it. It
 * REUSES the engine's `evaluateCondition` over a reconstructed minimal `G` slice — the
 * engine stays the sole authority on condition semantics (D-20105); the server never
 * re-implements them. Returns `unsupported` (teacher skips) when the played card or any
 * candidate is size-changing/copy-powers (uncaptured runtime grants could silently
 * satisfy the gate → a false whiff → a wrong tip). No `G` mutation; no `boardgame.io`.
 *
 * @param condition - The gate to evaluate (should be a `SEQUENCE_GATE_CONDITION_TYPES` member).
 * @param playedCardId - The played card that owns the clause (the self-exclusion trigger).
 * @param candidateInPlayIds - The in-play card ids to evaluate the gate over.
 * @param cardData - The setup-static card-data slice from the reduced final state.
 * @returns `'holds'` | `'fails'` | `'unsupported'`.
 */
export function heroConditionHoldsForInPlay(
  condition: HeroCondition,
  playedCardId: CardExtId,
  candidateInPlayIds: readonly CardExtId[],
  cardData: HeroConditionCardData,
): 'holds' | 'fails' | 'unsupported' {
  // why: fidelity scope-out — a size-changing/copy-powers card in the played card or
  // any candidate could satisfy the gate via a grant this read never captured.
  if (isSizeChangingOrCopyPowers(cardData, playedCardId)) {
    return 'unsupported';
  }
  for (const candidateId of candidateInPlayIds) {
    if (isSizeChangingOrCopyPowers(cardData, candidateId)) {
      return 'unsupported';
    }
  }
  // why: WP-825 / D-24758 — fidelity scope-out: the card-data slice carries no cardStats, so a
  // cost-floored gate would read every candidate as cost 0 and report a false whiff.
  if (effectiveMinimumCost(condition) > 0) {
    return 'unsupported';
  }
  // why: reconstruct the minimal G slice evaluateCondition's class/team/keyword gates
  // read (the four card-data maps + one seat's inPlay), then delegate to the real
  // evaluator — the engine owns the semantics (D-20105), including each type's own
  // self-exclusion of the triggering card.
  const seat = '0';
  const minimalGameState = {
    cardTraits: cardData.cardTraits,
    cardSizeChangingClasses: cardData.cardSizeChangingClasses,
    cardCopiedTeams: cardData.cardCopiedTeams,
    heroAbilityHooks: cardData.heroAbilityHooks,
    playerZones: { [seat]: { inPlay: [...candidateInPlayIds] } },
  } as unknown as LegendaryGameState;
  return evaluateCondition(minimalGameState, seat, condition, playedCardId) ? 'holds' : 'fails';
}
