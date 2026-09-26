/**
 * Pure helper that decides whether the active player can fight a city
 * villain / the Mastermind, or recruit an HQ hero, given the current turn
 * economy and the card's cost.
 *
 * Consumes WP-128 fields `economy.availableAttack` and
 * `economy.availableRecruit`. Recruit reads `UICardDisplay.cost` (added by
 * WP-111); Fight reads the engine's projected fight cost (WP-750 / D-24574:
 * `UICityCard.fightCost` / `UIMastermindState.fightCost`), passed in as a number.
 * Returns a `{ allowed, reason }` pair so binding sites (button
 * `aria-disabled` + `title`) can render the locked tooltip precedence
 * without re-deriving the message.
 *
 * Disabled-state tooltip precedence per EC-132 §3 (locked):
 *   (1) stage gating — owned by `useTurnActions`, not this composable
 *   (2) resource affordability — this composable's responsibility
 *   (3) structural lock (e.g., empty slot, mastermind defeated) — owned by
 *       individual SFCs
 *
 * @see WP-129 §Acceptance Criteria — cost gating
 * @see EC-132 §3 disabled-state tooltip precedence
 * @see WP-111 D-11104 (UICardDisplay.cost projection)
 * @see WP-750 D-24574 (Fight gates on the engine's projected fight cost)
 */

import type { UICardDisplay, UITurnEconomyState } from '@legendary-arena/game-engine';

export interface GatingResult {
  /** True when the affordance is enabled; false when it should render disabled. */
  allowed: boolean;
  /**
   * Human-readable reason when `allowed === false`; null when allowed.
   * Bound by the caller's `aria-disabled` / `title` binding site.
   */
  reason: string | null;
}

const ALLOWED: GatingResult = { allowed: true, reason: null };

/**
 * Decide whether the active player can recruit a hero with the given
 * display data using the supplied turn economy. Returns disallowed when
 * `availableRecruit < hero.cost`. Heroes with `cost === null` (sidekicks,
 * non-recruitable artifacts) are treated as disallowed with a structural
 * reason.
 *
 * // why: cost gate consumes WP-128 `economy.availableRecruit`. The
 * structural-null branch protects HQ slots that hold non-recruitable
 * cards from rendering as enabled when the economy can technically
 * "afford" them.
 */
export function canRecruit(
  hero: UICardDisplay,
  economy: UITurnEconomyState,
): GatingResult {
  const cost = hero.cost;
  if (cost === null) {
    return {
      allowed: false,
      reason: 'This card is not recruitable.',
    };
  }
  if (economy.availableRecruit < cost) {
    return {
      allowed: false,
      reason: `Needs ${cost} recruit, you have ${economy.availableRecruit}.`,
    };
  }
  return ALLOWED;
}

/**
 * Decide whether the active player can fight a target whose fight cost is
 * `cost`. Returns disallowed when `availableAttack < cost`. A `null` cost
 * (a snapshot with no projected cost and no printed cost) is treated as
 * disallowed with a structural reason.
 *
 * // why: WP-750 / D-24574 — the cost is a NUMBER, the engine's projected fight
 * cost, never the printed `display.cost`. The printed cost diverged from the
 * engine both ways: dead buttons (Dark Portal, captured Heroes, Skrull — the
 * engine charged more) and false locks (null printed attack, Killbots — the
 * engine charged 0 or a counter). The caller supplies the projection, so the
 * client never re-derives a cost term. Consumes WP-128 `economy.availableAttack`.
 */
export function canFight(
  cost: number | null,
  economy: UITurnEconomyState,
): GatingResult {
  if (cost === null) {
    return {
      allowed: false,
      reason: 'This card cannot be fought.',
    };
  }
  if (economy.availableAttack < cost) {
    return {
      allowed: false,
      reason: `Needs ${cost} attack, you have ${economy.availableAttack}.`,
    };
  }
  return ALLOWED;
}

/**
 * Decide whether the active player can fight a villain/Mastermind **using
 * Excessive Violence** — the availability cue is set (WP-739 /
 * `economy.excessiveViolenceAvailable`) AND they can afford one attack MORE
 * than the target's fight cost (the WP-736 `+1` overspend). Takes the same
 * projected fight cost `canFight` takes (WP-750 / D-24574), so the client gate
 * mirrors the engine gate `getSpendableAttack >= requiredFightCost + 1` exactly
 * and the engine stays the sole authority. Returns a plain boolean (this is an enable check
 * for a secondary affordance, not a disabled-tooltip gate).
 *
 * // why: WP-738 / D-24561 — per-target enable for the "Fight using Excessive
 * Violence" control; the omit-when-absent field is treated as false, and a
 * non-fightable (`cost === null`) target is never EV-fightable.
 */
export function canFightWithExcessiveViolence(
  cost: number | null,
  economy: UITurnEconomyState,
): boolean {
  if (economy.excessiveViolenceAvailable !== true) {
    return false;
  }
  if (cost === null) {
    return false;
  }
  return economy.availableAttack >= cost + 1;
}

/**
 * Composable wrapper exposing `canRecruit` / `canFight` /
 * `canFightWithExcessiveViolence` over the supplied economy. Returned as a
 * plain object so SFC templates can bind directly without further unwrapping.
 */
export function useCardCostGating(
  economy: UITurnEconomyState,
): {
  canRecruit: (hero: UICardDisplay) => GatingResult;
  canFight: (cost: number | null) => GatingResult;
  canFightWithExcessiveViolence: (cost: number | null) => boolean;
} {
  return {
    canRecruit: (hero) => canRecruit(hero, economy),
    canFight: (cost) => canFight(cost, economy),
    canFightWithExcessiveViolence: (cost) =>
      canFightWithExcessiveViolence(cost, economy),
  };
}
