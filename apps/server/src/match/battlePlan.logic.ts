/**
 * Battle Plan API — Pure Logic (WP-635 / EC-670 / D-24449)
 *
 * Side-effect-free helpers for the Battle Plan routes: input validation for a
 * per-phase write, the closed-set phase→column map, and the record→response
 * projection shaper. No `pg`, no I/O, no boardgame.io — this file is independently
 * unit-testable and never touches a database.
 *
 * The projection shaper is the single site where the audit-only `updatedByExtId`
 * is stripped: it copies only the client-facing fields onto BattlePlanView and
 * never carries `updatedByExtId` or `createdAt` across the boundary.
 *
 * Layer/boundary: server layer only. Pure helper — no boardgame.io import.
 *
 * Authority: WP-635 §Scope C; EC-670 §Locked Values; D-24449.
 */

import { timingSafeEqual } from 'node:crypto';

import {
  BATTLE_PLAN_PHASES,
  GUEST_EDITOR_ID_PREFIX,
  type BattlePlanColumn,
  type BattlePlanErrorCode,
  type BattlePlanPhase,
  type BattlePlanRecord,
  type BattlePlanView,
  type UpdateBattlePlanInput,
} from './battlePlan.types.js';

// why: bound the per-phase free-text so a single write cannot store an unbounded
// blob. 4000 characters is a generous game-plan paragraph per phase without
// becoming a denial-of-service vector. Locked here (EC-670), not re-derived per
// call site. An empty string is allowed (it clears the phase).
export const BATTLE_PLAN_PHASE_MAX_LENGTH = 4000;

/**
 * The result of validating a PUT body: either the typed input, or a closed-set
 * error code identifying the first field that failed. Never throws.
 */
export type ValidateUpdateBattlePlanResult =
  | { readonly ok: true; readonly value: UpdateBattlePlanInput }
  | { readonly ok: false; readonly code: BattlePlanErrorCode };

/**
 * Narrow an unknown value to a BattlePlanPhase, or return null when it is not one
 * of the closed-set phases.
 *
 * @param candidate The raw `phase` value from the request body.
 * @returns The BattlePlanPhase when it matches the closed set, otherwise null.
 */
function asBattlePlanPhase(candidate: unknown): BattlePlanPhase | null {
  for (const battlePlanPhase of BATTLE_PLAN_PHASES) {
    if (candidate === battlePlanPhase) {
      return battlePlanPhase;
    }
  }
  return null;
}

/**
 * Validate a raw request body into an UpdateBattlePlanInput. Checks that `phase` is
 * one of the closed-set phases and that `text` is a string within the length cap.
 * An empty string is accepted (it clears the phase). Never throws — a malformed
 * body returns a typed error code the route maps to 400.
 *
 * @param body The parsed JSON request body (unknown shape until validated).
 * @returns `{ ok: true, value }` with the typed input, or `{ ok: false, code }`.
 */
export function validateUpdateBattlePlanInput(
  body: unknown,
): ValidateUpdateBattlePlanResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, code: 'invalid_request' };
  }

  const candidate = body as { phase?: unknown; text?: unknown };

  const phase = asBattlePlanPhase(candidate.phase);
  if (phase === null) {
    return { ok: false, code: 'unknown_phase' };
  }

  if (typeof candidate.text !== 'string') {
    return { ok: false, code: 'invalid_request' };
  }
  // why: the empty string is deliberately allowed (it clears the phase); only an
  // over-long text is rejected. No trim — leading/trailing whitespace is the
  // author's to keep in a free-text plan.
  if (candidate.text.length > BATTLE_PLAN_PHASE_MAX_LENGTH) {
    return { ok: false, code: 'text_too_long' };
  }

  return { ok: true, value: { phase, text: candidate.text } };
}

/**
 * Map a Battle Plan phase to its storage column. A closed-set `switch` — NOT a
 * dynamic property access on the request string — so an untrusted `phase` can only
 * ever resolve to one of the three known column names, never an arbitrary column.
 * The phase values and column names coincide, but the explicit switch is the guard
 * against `obj[phase]`-style dynamic access (EC-670 §Guardrails).
 *
 * @param phase The validated closed-set phase.
 * @returns The storage column the phase maps to.
 */
export function phaseColumnFor(phase: BattlePlanPhase): BattlePlanColumn {
  switch (phase) {
    case 'pre_battle':
      return 'pre_battle';
    case 'battle_adjustments':
      return 'battle_adjustments';
    case 'post_battle':
      return 'post_battle';
    default: {
      // why: exhaustiveness guard — a new BattlePlanPhase added without a case here
      // fails at type-check time (the `never` assignment), so the map can never
      // silently drop a phase.
      const unhandled: never = phase;
      throw new Error(
        `phaseColumnFor received an unhandled BattlePlanPhase: ${String(unhandled)}.`,
      );
    }
  }
}

/**
 * Shape a persisted Battle Plan record into the client-facing view. This is the
 * single site that strips the audit-only `updatedByExtId` (and `createdAt`): it
 * copies only the client fields and never carries an internal ext_id outward.
 *
 * @param record The persisted battle_plan row.
 * @returns The redacted client projection.
 */
export function toBattlePlanView(record: BattlePlanRecord): BattlePlanView {
  return {
    matchId: record.matchId,
    preBattle: record.preBattle,
    battleAdjustments: record.battleAdjustments,
    postBattle: record.postBattle,
    updatedAt: record.updatedAt,
  };
}

/**
 * Verify a guest's supplied seat credential against the match's seat-credential map
 * in CONSTANT time (WP-638 / D-24451). Returns true only when `playerId` names a
 * seat whose stored credential byte-for-byte matches `supplied`. Never throws.
 *
 * why (no seat-existence oracle): an absent seat and a wrong credential BOTH return
 * false, so the caller maps them to the same `403 not_a_participant`; an attacker
 * cannot use the response to learn which seats exist.
 *
 * why (constant-time + length-guard): the credential is a secret; a `===` compare or
 * an unguarded length would leak, via timing, how much of a guess matched.
 * `timingSafeEqual` throws on unequal-length buffers, so the length precheck runs
 * first — a differing length is already a definite non-match and leaks only length,
 * not content (the `guestAccess.logic.ts` password-verify precedent).
 *
 * @param seatCredentials The seat-id → credential map from the bgio match metadata.
 * @param playerId The bgio seat id the guest claims (from `X-Guest-Player-Id`).
 * @param supplied The credential the guest supplied (from `X-Guest-Credentials`).
 * @returns True only when the supplied credential matches the seat's stored one.
 */
export function verifyGuestSeatCredential(
  seatCredentials: Record<string, string>,
  playerId: string,
  supplied: string,
): boolean {
  const storedCredential = seatCredentials[playerId];
  if (typeof storedCredential !== 'string') {
    return false;
  }
  const storedBuffer = Buffer.from(storedCredential, 'utf8');
  const suppliedBuffer = Buffer.from(supplied, 'utf8');
  if (storedBuffer.length !== suppliedBuffer.length) {
    return false;
  }
  return timingSafeEqual(storedBuffer, suppliedBuffer);
}

/**
 * Build the synthetic audit editor id for a guest seat write: `guest:<playerId>`
 * (WP-638 / D-24451). Written to `battle_plan.updated_by_ext_id` for audit only; it
 * is never projected to a client (`toBattlePlanView` strips `updatedByExtId`). The
 * `guest:` prefix namespaces the id away from every real `legendary.players.ext_id`.
 *
 * @param playerId The bgio seat id of the verified guest (from `X-Guest-Player-Id`).
 * @returns The `guest:<playerId>` audit editor id.
 */
export function guestEditorId(playerId: string): string {
  return `${GUEST_EDITOR_ID_PREFIX}${playerId}`;
}
