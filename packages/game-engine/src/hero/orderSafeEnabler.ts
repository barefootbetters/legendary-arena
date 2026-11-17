/**
 * Order-safe enabler classification for the play-order sequence teacher (WP-900 / D-24857,
 * amending D-24533).
 *
 * The server teacher tells a player "Next time, play X before Y". That advice is only a net
 * gain when X loses nothing by being played earlier. This module is the engine's single
 * answer to "can this card be moved earlier without costing its own bonus?", so the server
 * keeps no condition-type or count-source literal of its own (D-20105: the engine is the
 * sole authority on condition semantics).
 *
 * The rule is FAIL-CLOSED: a hook is order-safe only when every condition type is on the
 * allowlist below and none of its effects reads turn or board state that the move can change.
 * A new condition type is rejected until it is added here with a reason; a new hook or
 * effect field fails `tsc` until it is classified in the two tables below.
 *
 * Pure: no boardgame.io, no registry, no I/O, no `G`. Reads hook descriptors only.
 */

import type { HeroAbilityHook, HeroCondition, HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import { WAIT_AND_SEE_CONDITION_TYPES } from './deferredConditionalGrants.js';

// why: WP-900 / D-24857 — the closed allowlist of condition types that playing a card EARLIER
// can never turn from true to false. The wait-and-see types are re-checked for the rest of the
// turn after a failed check (deferredConditionalGrants.ts), and the edge-triggered ones count
// events after the card is in play, so an earlier play sees at least as many.
// `firstHeroPlayedThisTurn` passes only when no other card was played before it, so moving the
// card earlier only helps. Every other type (class / team / keyword gates, play history, board
// and present state, and any type added later) is NOT order-safe. Built here, not in
// heroConditions.evaluate.ts, because deferredConditionalGrants.ts imports that module (cycle).
export const ORDER_SAFE_ENABLER_CONDITION_TYPES: readonly string[] = [
  ...WAIT_AND_SEE_CONDITION_TYPES,
  'firstHeroPlayedThisTurn',
];

/** How one hook or effect field bears on order safety. */
type FieldOrderSafety = 'safe' | 'rejected' | 'recursed';

// why: WP-900 / D-24857 — the forward rule is compile-enforced. `Record<keyof Required<…>>`
// makes `tsc` fail when a field is added to HeroEffectDescriptor until it is classified here:
// 'rejected' fields can make an effect order-unsafe, 'recursed' fields hold nested effects
// checked the same way, 'safe' fields never do (deck / hand reads go either way, provenance
// and targeting carry no resolve-time state).
const EFFECT_FIELD_ORDER_SAFETY: Record<keyof Required<HeroEffectDescriptor>, FieldOrderSafety> = {
  type: 'safe',
  magnitude: 'safe',
  countSource: 'rejected',
  perEach: 'safe',
  countScaledChoiceOptions: 'rejected',
  rewardType: 'safe',
  rewardComposition: 'rejected',
  empoweredClass: 'rejected',
  empoweredClasses: 'rejected',
  revealCount: 'safe',
  revealRules: 'safe',
  reorderRemainder: 'safe',
  investigateLookCount: 'safe',
  investigateCriteria: 'safe',
  revealCriterion: 'safe',
  digestThreshold: 'rejected',
  digestEffects: 'recursed',
  indigestionEffects: 'recursed',
  bothCondition: 'rejected',
  excessiveViolenceEffects: 'recursed',
  heistEffects: 'recursed',
  sunlightEffects: 'rejected',
  moonlightEffects: 'rejected',
  attackRestriction: 'rejected',
  fightCostReductionTarget: 'safe',
  nonGreyHeroKoAttack: 'rejected',
};

// why: WP-900 / D-24857 — the same compile-enforced classification for hook fields. Size-changing
// classes are 'safe' here because heroConditionHoldsForInPlay already scopes such cards out
// ('unsupported'), so they never become enablers.
const HOOK_FIELD_ORDER_SAFETY: Record<keyof Required<HeroAbilityHook>, FieldOrderSafety> = {
  cardId: 'safe',
  timing: 'safe',
  keywords: 'safe',
  conditions: 'rejected',
  effects: 'recursed',
  primitiveEffects: 'rejected',
  unresolvedMarkers: 'safe',
  resolvedMarkers: 'safe',
  sizeChangingClasses: 'safe',
  microscopicSizeChangingClasses: 'safe',
};

/**
 * The two field classification tables, exposed for this module's keyset test only (never
 * re-exported from the package barrel).
 */
export const ORDER_SAFETY_FIELD_TABLES = {
  effectFields: EFFECT_FIELD_ORDER_SAFETY,
  hookFields: HOOK_FIELD_ORDER_SAFETY,
} as const;

/**
 * Whether a condition's type is on the order-safe allowlist.
 *
 * @param condition - The condition to classify.
 * @returns True when moving its card earlier cannot make it false.
 */
function isOrderSafeCondition(condition: HeroCondition): boolean {
  return ORDER_SAFE_ENABLER_CONDITION_TYPES.includes(condition.type);
}

/**
 * Whether an effect's own grant reads turn or board state at resolve time, or locks the
 * turn's later draws (WP-900 / D-24857).
 *
 * @param effect - The effect descriptor.
 * @returns True when moving its card earlier can change what the effect does.
 */
function effectReadsResolveTimeState(effect: HeroEffectDescriptor): boolean {
  // why: WP-900 / D-24857 — every count source (played view, hand, Victory Pile, draws, deck
  // KOs) is read when the grant resolves; none is order-safe (Oddball, Perfect Teamwork).
  if (effect.countSource !== undefined || effect.nonGreyHeroKoAttack !== undefined) {
    return true;
  }
  for (const option of effect.countScaledChoiceOptions ?? []) {
    if (option.kind === 'count-scaled') {
      return true;
    }
  }
  // why: WP-900 / D-24857 — Digest reads the Victory Pile size, Empowered the HQ, day / night
  // is read at play, and a reward composition (Berserk, rooftops-conqueror) reads the deck top
  // or the City when the reward resolves.
  if (effect.digestThreshold !== undefined || effect.empoweredClass !== undefined) {
    return true;
  }
  if ((effect.empoweredClasses ?? []).length > 0 || effect.rewardComposition !== undefined) {
    return true;
  }
  if ((effect.sunlightEffects ?? []).length > 0 || (effect.moonlightEffects ?? []).length > 0) {
    return true;
  }
  // why: WP-900 / D-24857 — Shenanigans locks every later effect draw this turn, so moving it
  // before the whiffed card blocks that card's draws (a net loss).
  return effect.type === 'no-more-draws';
}

/**
 * Whether an effect carries a condition of its own that is not order-safe (WP-900 / D-24857).
 *
 * @param effect - The effect descriptor.
 * @returns True when the effect's "you get both" upgrade or Mastermind widening is order-dependent.
 */
function effectHasUnsafeCondition(effect: HeroEffectDescriptor): boolean {
  // why: WP-900 / D-24857 — Devouring Drool's "[hc:instinct]: Instead, you get both" rides
  // inside the effect; played before its class-mate it loses the upgrade (the mutually-enabling
  // pair D-24533 forbids).
  if (effect.bothCondition !== undefined && !isOrderSafeCondition(effect.bothCondition)) {
    return true;
  }
  for (const condition of effect.attackRestriction?.widenToMastermindWhen ?? []) {
    if (!isOrderSafeCondition(condition)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether every nested effect of an effect is order-safe (WP-900 / D-24857).
 *
 * @param effect - The effect descriptor.
 * @returns True when every Digest / Indigestion / Excessive Violence / Heist inner effect is order-safe.
 */
function nestedEffectsAreOrderSafe(effect: HeroEffectDescriptor): boolean {
  // why: WP-900 / D-24857 — fail-closed recursion. Excessive Violence and Heist fire later, so
  // some rejections here cost a tip that would have been safe; accepted.
  const nestedGroups = [
    effect.digestEffects,
    effect.indigestionEffects,
    effect.excessiveViolenceEffects,
    effect.heistEffects,
  ];
  for (const nestedGroup of nestedGroups) {
    for (const nestedEffect of nestedGroup ?? []) {
      if (!isOrderSafeEffect(nestedEffect)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Whether an effect loses nothing when its card is played earlier (WP-900 / D-24857).
 *
 * @param effect - The effect descriptor.
 * @returns True when the effect is order-safe.
 */
function isOrderSafeEffect(effect: HeroEffectDescriptor): boolean {
  if (effectReadsResolveTimeState(effect) || effectHasUnsafeCondition(effect)) {
    return false;
  }
  return nestedEffectsAreOrderSafe(effect);
}

/**
 * Pure Runtime-Safe predicate: can the card owning this hook be played earlier in the turn
 * without losing anything this hook grants? (WP-900 / D-24857.)
 *
 * why: the sequence teacher (apps/server, D-24533) only names an enabler for which every hook
 * passes this check. It ignores `hook.timing` on purpose: a card is rejected if ANY of its
 * hooks fails, whatever that hook's timing (fail-closed; do not narrow it to onPlay).
 *
 * @param hook - One of the candidate card's hooks.
 * @returns True when every condition is order-safe, the hook has no composition primitive,
 *   and every effect is order-safe.
 */
export function isOrderSafeEnablerHook(hook: HeroAbilityHook): boolean {
  for (const condition of hook.conditions ?? []) {
    if (!isOrderSafeCondition(condition)) {
      return false;
    }
  }
  // why: WP-900 / D-24857 — composition primitives (Berserk, Empowered, …) read the deck or
  // HQ when they resolve.
  if ((hook.primitiveEffects ?? []).length > 0) {
    return false;
  }
  for (const effect of hook.effects ?? []) {
    if (!isOrderSafeEffect(effect)) {
      return false;
    }
  }
  return true;
}
