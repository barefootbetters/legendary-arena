/**
 * Deferred conditional grants — the wait-and-see window for NUMERIC-THRESHOLD
 * hero conditions (WP-568 / D-24377).
 *
 * OPERATOR DECISION: a condition of the form "If you [did X] this turn" is a
 * WHOLE-TURN window, not a snapshot taken when the card is played. Thor's Surge
 * of Power therefore grants its +3 attack retroactively once the turn's recruit
 * total reaches 8, even if that recruit arrives after the card is in play.
 *
 * SCOPE IS DELIBERATELY TWO CONDITION TYPES. `heroClassMatch` and `requiresTeam`
 * keep ON-PLAY evaluation. All four live types are "this turn" scoped in
 * substance (the class gates read `playerZones.inPlay`, which clears each turn),
 * so the boundary is drawn at "is it a NUMERIC THRESHOLD", not at "does it read
 * inPlay" — `distinctHeroClassesAtLeast` reads `inPlay` like the class gates do
 * and is nonetheless in scope. Converting the class gates would change every
 * `[hc:X]` card in the game and remove play-ordering skill from class synergy.
 *
 * Pure: these helpers read and mutate `G` only through the entry list; the
 * firing itself is delegated by callback so this module never imports the hero
 * effect executor (which would be a cycle). No boardgame.io import.
 */

import type { LegendaryGameState, DeferredConditionalGrant } from '../types.js';
import type { HeroCondition } from '../rules/heroAbility.types.js';

// why: WP-568 / D-24377 §1 — the closed set of condition types that get the
// whole-turn window. A type NOT listed here keeps on-play evaluation, which is
// why adding one is a deliberate act rather than an emergent behaviour change.
export const WAIT_AND_SEE_CONDITION_TYPES: readonly string[] = [
  'recruitMadeThisTurnAtLeast',
  'distinctHeroClassesAtLeast',
];

/**
 * Reports whether a failed condition earns the whole-turn wait-and-see window.
 *
 * @param condition - The condition that failed at play time.
 * @returns True when the condition is one of the two numeric thresholds.
 */
export function isWaitAndSeeCondition(condition: HeroCondition): boolean {
  return WAIT_AND_SEE_CONDITION_TYPES.includes(condition.type);
}

/**
 * Records a hook whose numeric-threshold gate failed, to be re-checked this turn.
 *
 * why: the container is materialized LAZILY — a game in which nothing ever defers
 * carries no new `G` field at all, which is what keeps both sentinel oracles
 * byte-unchanged (D-24377 §6). It is deliberately NOT named `pending*`: every
 * `G.pending*Choices[]` in this engine is an INTERACTIVE choice with a resolve
 * move, and a parked one lacking a `UIState` projection and prompt hard-freezes
 * the human player. A deferred grant takes no player input and needs no prompt.
 *
 * @param G - The game state, mutated in place.
 * @param playerId - The player whose card is waiting.
 * @param cardId - The played card whose ability is waiting.
 * @param hookIndex - Index into `G.heroAbilityHooks` (built at setup, never
 *   mutated at runtime, so the index is stable for the match).
 */
export function recordDeferredConditionalGrant(
  G: LegendaryGameState,
  playerId: string,
  cardId: string,
  hookIndex: number,
): void {
  if (G.deferredConditionalGrants === undefined) {
    G.deferredConditionalGrants = [];
  }
  G.deferredConditionalGrants.push({ playerId, cardId, hookIndex });
}

/**
 * Drops every deferred grant. Called at the turn boundary.
 *
 * why: the window is THIS turn. A threshold never reached during the turn never
 * fires, and nothing may carry into the next turn — the condition text says
 * "this turn", and `G.turnEconomy` resets anyway, so a surviving entry would
 * re-evaluate against a fresh economy and could fire for the wrong turn.
 *
 * @param G - The game state, mutated in place.
 */
export function clearDeferredConditionalGrants(G: LegendaryGameState): void {
  if (G.deferredConditionalGrants !== undefined) {
    delete G.deferredConditionalGrants;
  }
}

/**
 * Re-checks every deferred grant and fires those whose gate is now satisfied.
 *
 * Iterates in INSERTION ORDER over a snapshot, so the sequence is deterministic
 * and stable across identical runs. An entry that fires is REMOVED, which is what
 * makes the grant idempotent: a threshold crossed, dropped and re-crossed within
 * one turn grants exactly once.
 *
 * @param G - The game state, mutated in place.
 * @param canFire - Predicate: does this entry's hook now pass all its conditions?
 * @param fire - Callback that applies the entry's hook effects.
 */
export function resolveDeferredConditionalGrants(
  G: LegendaryGameState,
  canFire: (entry: DeferredConditionalGrant) => boolean,
  fire: (entry: DeferredConditionalGrant) => void,
): void {
  const entries = G.deferredConditionalGrants;
  if (entries === undefined || entries.length === 0) {
    return;
  }

  // why: snapshot before iterating — `fire` mutates G (and may append log lines),
  // and removing from the live array mid-walk would skip entries. Explicit
  // for...of over the snapshot; no .reduce() (.claude/rules/code-style.md).
  const snapshot = [...entries];
  const survivors: DeferredConditionalGrant[] = [];
  const readyToFire: DeferredConditionalGrant[] = [];

  for (const entry of snapshot) {
    if (canFire(entry)) {
      readyToFire.push(entry);
    } else {
      survivors.push(entry);
    }
  }

  // why: rewrite the list BEFORE firing, so a fire callback that itself defers a
  // new grant (a chained threshold) appends to the surviving list rather than
  // being wiped by this assignment.
  if (survivors.length === 0) {
    delete G.deferredConditionalGrants;
  } else {
    G.deferredConditionalGrants = survivors;
  }

  for (const entry of readyToFire) {
    fire(entry);
  }
}
