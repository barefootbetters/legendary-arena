/**
 * Per-clause attack/recruit value derivation for the Realized Value % signal
 * (WP-709 / D-24532).
 *
 * `heroClauseValue` sums the attack + recruit value a single Hero ability hook's
 * legacy `effects` offer at the current board state — the "value it could offer"
 * that the display-only per-match Realized Value % weights each conditional clause
 * by. It is a pure read over settled `G` (via `resolveCountSource`); it mutates
 * nothing and never throws in normal use.
 *
 * why: the value currency is attack + recruit magnitude ONLY — the exact set the
 * shipped count-scaled family (`attack-per-count` / `recruit-per-count`, WP-706
 * `resource: 'attack' | 'recruit'`) produces, plus the flat `attack` / `recruit`
 * keywords. Draw / KO / rescue / discard carry no scalar value in this model and
 * contribute 0 (a non-value clause stays in the Phase-1 Synergy Rate but carries no
 * value weight). `primitiveEffects` composition grants (Berserk / Empowered), the
 * `count-scaled-choose` pending-choice family, and `reveal-herodeck-attack` are v1
 * out-of-scope follow-ups — the same sites WP-706 excluded.
 *
 * No boardgame.io imports. No registry imports. No I/O. No randomness.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook, HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import { resolveCountSource } from './heroCountSource.resolve.js';

/**
 * Computes the attack/recruit value of one hero effect descriptor at the current
 * board state, or 0 when the effect is not a value keyword.
 *
 * A flat `attack` / `recruit` effect contributes its `magnitude`. A count-scaled
 * `attack-per-count` / `recruit-per-count` effect contributes
 * `magnitude × floor(resolveCountSource(...) / perEach)`.
 *
 * why: mirrors `buildCountScaledResolution`'s normalization exactly (WP-706) — the
 * same `perEach` absent/≤ 0 → 1 rule and the same `resolveCountSource(G, playerID,
 * countSource, cardId)` call with the played card as the self-exclusion trigger — so
 * for an assembled count-scaled clause this value equals that effect's
 * `EffectTrace.resolution.computedValue` (the AC-3 cross-check). Kept as a small,
 * pinned duplicate rather than a shared export because the two callers sit in
 * different files and the math is four lines (00.6 "duplicate first").
 *
 * @param G - Game state (read only).
 * @param playerID - The acting player.
 * @param cardId - The played card that owns the hook (the self-exclusion trigger).
 * @param effect - The hero effect descriptor to value.
 * @returns The attack/recruit value, or 0 for a non-value effect.
 */
function effectValue(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
  effect: HeroEffectDescriptor,
): number {
  const magnitude = typeof effect.magnitude === 'number' ? effect.magnitude : 0;
  if (effect.type === 'attack' || effect.type === 'recruit') {
    return magnitude;
  }
  if (effect.type === 'attack-per-count' || effect.type === 'recruit-per-count') {
    // why: a count-scaled effect with no source scales by nothing — 0 value (mirrors
    // the executor's own no-source skip and `buildCountScaledResolution`).
    if (effect.countSource === undefined) {
      return 0;
    }
    // why: same absent/≤ 0 → 1 normalization the executor + `buildCountScaledResolution`
    // apply, so this value never divides by 0/undefined and equals the granted value.
    const perEach = effect.perEach && effect.perEach > 0 ? effect.perEach : 1;
    // why: re-resolve from the settled G — byte-identical to the integer the grant
    // uses (the grant mutates only turnEconomy, never inPlay), and valid on BOTH the
    // assembled and the whiffed branch because the count source reads zones that are
    // independent of the hook's boolean condition.
    const count = resolveCountSource(G, playerID, effect.countSource, cardId);
    return magnitude * Math.floor(count / perEach);
  }
  return 0;
}

/**
 * Sums the attack/recruit value a single hero ability hook's legacy `effects`
 * offer at the current board state (WP-709 / D-24532).
 *
 * Used at the `evaluateAllConditions` chokepoint to weight each countable
 * conditional clause: the returned value accrues to `potentialValue` (always) and
 * to `realizedValue` (only when the clause's condition held). Returns 0 for a hook
 * with no attack/recruit effects.
 *
 * why: `for...of` over the descriptors, explicit accumulator — no `.reduce()` in
 * effect-value logic (code-style). Only the legacy `hook.effects` are valued;
 * `primitiveEffects` are v1 out of scope (see file header).
 *
 * @param G - Game state (read only).
 * @param playerID - The acting player.
 * @param cardId - The played card that owns the hook (the self-exclusion trigger).
 * @param hook - The hero ability hook whose clause value is summed.
 * @returns The total attack/recruit value the hook offers, or 0.
 */
export function heroClauseValue(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
  hook: HeroAbilityHook,
): number {
  if (hook.effects === undefined) {
    return 0;
  }
  let total = 0;
  for (const effect of hook.effects) {
    total += effectValue(G, playerID, cardId, effect);
  }
  return total;
}
