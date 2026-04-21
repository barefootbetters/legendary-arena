import type { PrePlan } from './preplan.types.js';
import type { PlayerAffectingMutation } from './disruption.types.js';

/**
 * Decide whether a player-affecting mutation disrupts a pre-plan.
 *
 * Binary per-player detection (DESIGN-CONSTRAINT #4): the decision is
 * based solely on ownership — a pre-plan owned by the affected player is
 * disrupted. No plan-step or sandbox inspection occurs. This keeps the
 * detection layer mechanically simple and ensures disruption semantics
 * do not depend on the speculative contents of the sandbox.
 *
 * @param prePlan - The pre-plan under consideration, or `null` if the
 *   affected player has no active plan.
 * @param mutation - The authoritative mutation that just occurred.
 * @returns `true` when the plan exists, is active, and is owned by the
 *   affected player; `false` otherwise.
 */
export function isPrePlanDisrupted(
  prePlan: PrePlan | null,
  mutation: PlayerAffectingMutation,
): boolean {
  // why: pre-plan is advisory and only mutates while active; false-return
  // signals "no disruption possible" without throwing. Binary per-player
  // detection per DESIGN-CONSTRAINT #4 — no plan-step or sandbox inspection.
  // Null-on-inactive convention extended from WP-057 RS-8 to the detection
  // layer.
  if (prePlan === null) return false;
  if (prePlan.status !== 'active') return false;
  return prePlan.playerId === mutation.affectedPlayerId;
}
