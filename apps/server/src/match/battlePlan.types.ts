/**
 * Battle Plan API — Types (WP-635 / EC-670 / D-24449)
 *
 * Durable contracts for the per-match Battle Plan: the free-text, football-style
 * "game plan" a team writes during a match, in three lifecycle-tied phases
 * (pre-battle plan, battle adjustments, post-battle analysis). One Postgres domain
 * table backs these types — legendary.battle_plan (one shared row per match). The
 * Battle Plan is a TEAM document, not per-player rows.
 *
 * Layer/boundary: server layer only. Imports nothing from boardgame.io,
 * @legendary-arena/game-engine (runtime), @legendary-arena/registry, or any UI
 * package. battle_plan is ordinary domain storage — never runtime G/ctx, never a
 * snapshot, never a save-game, never hashed (D-24449).
 *
 * Authority: WP-635 §Scope B; EC-670 §Locked Values; D-24449.
 */

/**
 * A Battle Plan phase — the closed set of three lifecycle-tied phases. The request
 * `phase` field maps 1:1 to the three storage columns. Mirrored by the
 * BATTLE_PLAN_PHASES canonical array; a drift-detection test asserts they match.
 */
export type BattlePlanPhase = 'pre_battle' | 'battle_adjustments' | 'post_battle';

/**
 * Canonical readonly array mirroring the BattlePlanPhase union. Adding a value
 * requires updating both this array and the union in the same change (code-style
 * §Drift Detection); the drift test in battlePlan.logic.test.ts enforces it.
 */
export const BATTLE_PLAN_PHASES: readonly BattlePlanPhase[] = [
  'pre_battle',
  'battle_adjustments',
  'post_battle',
] as const;

/**
 * The storage column a phase maps to. The values are identical to BattlePlanPhase
 * (the API field name and the column name coincide), but the two are kept as
 * distinct types so the phase→column mapping is an explicit closed-set switch
 * (`phaseColumnFor`) rather than a dynamic property access on the request string.
 */
export type BattlePlanColumn = 'pre_battle' | 'battle_adjustments' | 'post_battle';

/**
 * A persisted Battle Plan (the legendary.battle_plan row shape, camelCase). The
 * TypeScript fields are camelCase; the underlying columns are snake_case, mapped
 * explicitly at the read site. Each phase is null until a participant writes it.
 * `updatedByExtId` is retained for audit and is NEVER projected to the client.
 */
export interface BattlePlanRecord {
  readonly matchId: string;
  readonly preBattle: string | null;
  readonly battleAdjustments: string | null;
  readonly postBattle: string | null;
  readonly updatedByExtId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The client-facing projection of a Battle Plan, returned by GET (and the PUT
 * response). Deliberately OMITS `id`, `createdAt`, and `updatedByExtId` — the
 * response never exposes an internal account ext_id to co-participants (D-5201). A
 * future client WP that wants a "last edited by" label adds a public-handle
 * projection then.
 */
export interface BattlePlanView {
  readonly matchId: string;
  readonly preBattle: string | null;
  readonly battleAdjustments: string | null;
  readonly postBattle: string | null;
  readonly updatedAt: string;
}

/**
 * The GET / PUT response envelope. `battlePlan` is the current document, or `null`
 * when no plan row exists for the match yet (GET only — a PUT always returns the
 * document it just wrote).
 */
export interface BattlePlanResponse {
  readonly battlePlan: BattlePlanView | null;
}

/**
 * The validated input for PUT /api/match/:matchId/battle-plan. `phase` is one of
 * the closed-set phases; `text` is the phase body — a string within the length cap,
 * possibly empty (an empty string clears the phase). The editor is never in the
 * body — it is the authenticated session's account.
 */
export interface UpdateBattlePlanInput {
  readonly phase: BattlePlanPhase;
  readonly text: string;
}

/**
 * Closed-set error codes for the Battle Plan routes. `invalid_request` is a
 * malformed / non-object body; `unknown_phase` is a `phase` outside the closed set;
 * `text_too_long` is a `text` over BATTLE_PLAN_PHASE_MAX_LENGTH; `not_a_participant`
 * is an authenticated caller absent from the match's seat roster (OR a guest whose
 * seat credential does not verify — the two are indistinguishable, no seat-existence
 * oracle); `internal_error` is the locked 500 envelope (no leaked internals).
 * Session-validation codes (missing_token, …) come from the auth layer and are
 * surfaced verbatim by the routes, separate from this set.
 */
export type BattlePlanErrorCode =
  | 'invalid_request'
  | 'unknown_phase'
  | 'text_too_long'
  | 'not_a_participant'
  | 'internal_error';

/**
 * A guest's proof of seat, parsed from the request headers (WP-638 / D-24451):
 * `playerId` is the boardgame.io seat id (e.g. `"1"`) from `X-Guest-Player-Id`;
 * `credentials` is the boardgame.io `playerCredentials` string from
 * `X-Guest-Credentials`. Read from HEADERS only — never the URL/query, because the
 * credential is sensitive and a query string would leak it into logs / history. The
 * header names are deliberately distinct from the WP-177 rewind headers
 * (`X-Player-ID` / `X-Credentials`) so the two auth surfaces never alias.
 */
export interface GuestSeatProof {
  readonly playerId: string;
  readonly credentials: string;
}

// why: the synthetic editor-id prefix stamped into `updated_by_ext_id` for a guest
// write (WP-638 / D-24451). A guest has no `legendary.players.ext_id` (a UUID), so
// `guest:<playerId>` namespaces the audit id away from every real account id and can
// never collide with one. Audit-only — `toBattlePlanView` strips it, so it is never
// projected to a client. Locked format constant, not re-derived per call site.
export const GUEST_EDITOR_ID_PREFIX = 'guest:';
