/**
 * Competitive Score Submission Types — Server Layer (WP-053)
 *
 * Durable contracts for competitive submission requests, accepted
 * records, and rejection reasons. These types form the public surface
 * that future server WPs (WP-054 leaderboards, future submission HTTP
 * endpoints, future GDPR audit work) consume; field shapes, names,
 * and order are locked by WP-053 §A and EC-053 §Locked Values.
 *
 * This module belongs to the server layer only. It must not be
 * imported from `packages/game-engine/**`, `packages/registry/**`,
 * `packages/preplan/**`, `packages/vue-sfc-loader/**`, `apps/arena-client/**`,
 * `apps/replay-producer/**`, or `apps/registry-viewer/**`. The
 * canonical owner reference field on `CompetitiveScoreRecord` is
 * `accountId: AccountId` (the WP-052 branded server identifier per
 * D-5201) — the engine-layer plain-string identifier per D-8701 is a
 * deliberately distinct type in a different layer and must never be
 * imported here.
 *
 * Authority: WP-053 §A; EC-053 §Locked Values; D-5201 (server identity
 * is AccountId); D-5301 (server is enforcer, not calculator);
 * D-5302 (competitive records are immutable; visibility checked at
 * submission time only); D-5304 (idempotent retry returns
 * { ok: true, wasExisting: true } — never a rejection); D-5305 (schema
 * lock); D-5306 Option A (scoringConfig flows from PAR artifact).
 */

import type { ScoreBreakdown } from '@legendary-arena/game-engine';

import type { AccountId } from '../identity/identity.types.js';

// why: type-only re-export so callers in this directory and any
// future competition.* siblings can reference the database alias
// without crossing the identity layer boundary explicitly. Mirrors
// the WP-103 replay.types.ts:43 pattern (which re-exports the same
// DatabaseClient alias for the server replay subdirectory). The
// `export type { ... }` form is type-only by construction —
// TypeScript emits no runtime binding even when verbatimModuleSyntax
// is off — so no `pg` driver coupling is introduced via this surface.
export type { DatabaseClient } from '../identity/identity.types.js';

/**
 * The single payload field a client submits to request a competitive
 * scoring of one of its replays. The replay itself is referenced by
 * its cryptographic `replayHash` — never re-sent as content. The
 * server fetches the corresponding `ReplayInput` blob from
 * `legendary.replay_blobs` (WP-103) and re-executes it via the engine
 * before any score is stored.
 *
 * Future HTTP request handlers (out of scope for WP-053) deserialize
 * this shape from the wire; the current packet introduces only the
 * library surface, not the transport.
 */
// why: replay referenced by hash only; content is not resent by the
// client. The server has the canonical blob; trusting client-provided
// content would break the trust surface the entire submission flow
// exists to enforce. EC-053 §Required `// why:` Comments.
export interface CompetitiveSubmissionRequest {
  readonly replayHash: string;
}

/**
 * The set of structural reasons a competitive submission may be
 * rejected. These are hard failures for which the application
 * surfaces a typed reason rather than throwing — every expected
 * failure mode in WP-053 §B returns one of these values via
 * `SubmissionResult`.
 *
 * The string for retry-success is deliberately ABSENT: idempotent
 * retries (per D-5304) return `{ ok: true, wasExisting: true }` and
 * are NOT a rejection. The retry-rejection string forbidden by
 * D-5304 does not appear here, and no application code emits one
 * — verified by grep gate.
 */
// why: typed reasons enable precise client messages without leaking
// internals. The string for retry-success is deliberately ABSENT;
// idempotent retries return { ok: true, wasExisting: true } per
// D-5304 — retry is success, not rejection. EC-053 §Required `// why:`.
export type SubmissionRejectionReason =
  | 'replay_not_found'
  | 'not_owner'
  | 'guest_not_eligible'
  | 'visibility_not_eligible'
  | 'par_not_published'
  | 'replay_verification_failed';

/**
 * Canonical readonly array mirroring the `SubmissionRejectionReason`
 * union. TypeScript unions are not enumerable at runtime; the
 * drift-detection test in `competition.logic.test.ts` asserts forward
 * and backward inclusion between this array and the union via an
 * exhaustive switch with a `never` default branch. Adding a value
 * requires updating both the union and this array in the same
 * change (code-style §Drift Detection). Mirrors the WP-052
 * `AUTH_PROVIDERS` and WP-052 `REPLAY_VISIBILITY_VALUES` patterns.
 */
// why: canonical runtime list — TypeScript unions are not enumerable
// at runtime; the drift-detection test in competition.logic.test.ts
// uses this array to assert exhaustiveness against the union via a
// `never` check at the default branch. EC-053 §Required `// why:`.
export const SUBMISSION_REJECTION_REASONS: readonly SubmissionRejectionReason[] = [
  'replay_not_found',
  'not_owner',
  'guest_not_eligible',
  'visibility_not_eligible',
  'par_not_published',
  'replay_verification_failed',
] as const;

/**
 * Competitive score record. One row per (player_id, replay_hash) pair
 * in `legendary.competitive_scores`; the underlying table enforces
 * this via `UNIQUE (player_id, replay_hash)`. Records are write-once
 * per D-5302 — no UPDATE function exists in the application layer.
 *
 * `Object.keys(record).sort()` MUST equal:
 *   ['accountId','createdAt','finalScore','parVersion','rawScore',
 *    'replayHash','scenarioKey','scoreBreakdown','scoringConfigVersion',
 *    'stateHash','submissionId']
 * — exactly 11 keys; drift-detection test #9 enforces this.
 */
// why: immutable snapshot of verified execution. The two version
// fields (parVersion text + scoringConfigVersion integer) pin the
// scoring context at submission time so historical results remain
// comparable only to peers under the same weights/PAR. Future
// re-scoring under a new config would create a NEW record, never
// an UPDATE on this one (D-5302). EC-053 §Required `// why:`.
// why: stateHash equals replayHash for every accepted record — the
// application's step-9 verification asserts equality before INSERT.
// The two fields exist for redundant audit provenance, not because
// they may differ.
// why: accountId is the WP-052 branded server identifier per D-5201;
// the engine-layer plain-string identifier (D-8701) is a different
// type in a different layer. The CTE at every read/write site
// bridges accountId (text ext_id) to the internal bigint FK in
// legendary.players.
// why: scoreBreakdown stored as jsonb (see migration 007) for full
// audit transparency. EC-053 §Required `// why:` Comments —
// "scoreBreakdown as jsonb: full transparency and auditability".
export interface CompetitiveScoreRecord {
  readonly submissionId: number;
  readonly accountId: AccountId;
  readonly replayHash: string;
  readonly scenarioKey: string;
  readonly rawScore: number;
  readonly finalScore: number;
  readonly scoreBreakdown: ScoreBreakdown;
  readonly parVersion: string;
  readonly scoringConfigVersion: number;
  readonly stateHash: string;
  readonly createdAt: string;
}

/**
 * Discriminated-union result type for competitive score submission.
 * The `ok: true` branch carries the stored record plus a `wasExisting`
 * flag distinguishing fresh inserts (`false`) from idempotent retries
 * (`true`); the `ok: false` branch carries a typed
 * `SubmissionRejectionReason`.
 *
 * `submitCompetitiveScore` MUST NOT throw for any expected failure
 * mode — every outcome defined in WP-053 §B is returned via this
 * shape. Only infrastructure-level errors (connection lost,
 * permission denied, malformed SQL) propagate as exceptions.
 */
// why: idempotent retry returns success (wasExisting: true) — never
// a rejection. Callers can surface "already submitted" UX without a
// failure path. Per D-5304: retries never produce duplicates and
// never re-execute the replay. EC-053 §Required `// why:`.
export type SubmissionResult =
  | { ok: true; record: CompetitiveScoreRecord; wasExisting: boolean }
  | { ok: false; reason: SubmissionRejectionReason };

