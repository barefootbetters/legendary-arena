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
import type { MatchSeatIdentity } from '../match/seatAccount.logic.js';

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
 * scoring of a finished match it played. The match is referenced by its
 * `matchId` — the arena-client never obtains a `replayHash` (it cannot
 * run `computeStateHash`), so the server resolves the replay itself:
 * it looks the durable `bgio.replay_artifacts` row up by `match_id`
 * (capturing on-demand if the harvester scan has not run yet),
 * re-reduces it, and re-verifies the hash before any score is stored
 * (WP-338 / D-24126).
 */
// why: the match is referenced by matchId, not replayHash — the client
// has the matchId at gameover but cannot compute the hash. The server
// resolves + re-reduces + hash-verifies the replay authoritatively;
// trusting a client-provided score would break the trust surface the
// whole submission flow exists to enforce (D-5301).
export interface CompetitiveSubmissionRequest {
  readonly matchId: string;
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
  | 'replay_verification_failed'
  // why: match_not_finished — a submit-by-matchId request (WP-338) for a match
  // that has not reached gameover. Scoring is end-of-match only (D-4804), so the
  // server rejects (and does NOT capture) an unfinished match rather than scoring
  // a non-terminal state. Maps to HTTP 409 (a conflict with match state).
  | 'match_not_finished'
  // why: WP-502 / D-24306 — the finished match was ended early by the players
  // (the endedEarly gameover marker). An abandoned/timed-out match is never a
  // ranked result, so the server refuses to score it — a PERMANENT ineligibility,
  // not a retriable failure. Maps to HTTP 422 (the default eligibility branch).
  | 'ended_early';

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
  'match_not_finished',
  'ended_early',
] as const;

/**
 * Which side won the match a competitive score records, mirroring the
 * engine's `EndgameOutcome` two-value closed set. Stored on
 * `legendary.competitive_scores.outcome` (migration 026); `null` marks
 * a row inserted before the column existed (or a defensive
 * null-evaluation), which never qualifies as a gauntlet leg.
 */
// why: D-24131 §3 — the gauntlet boards qualify legs on "the mastermind
// was defeated", a fact the score columns alone cannot express. The
// union mirrors the engine's EndgameOutcome values verbatim; the
// assignment site in competition.logic.ts is typed against this union
// so an engine-side value change fails compilation here.
export type CompetitiveOutcome = 'heroes-win' | 'scheme-wins';

/**
 * Canonical readonly array mirroring the `CompetitiveOutcome` union.
 * The drift-detection test in `competition.logic.test.ts` asserts
 * forward and backward inclusion between this array and the union,
 * mirroring the `SUBMISSION_REJECTION_REASONS` pattern above.
 */
// why: canonical runtime list — TypeScript unions are not enumerable
// at runtime; the drift test uses this array to assert exhaustiveness
// against the union via a `never` check (code-style §Drift Detection).
export const COMPETITIVE_OUTCOMES: readonly CompetitiveOutcome[] = [
  'heroes-win',
  'scheme-wins',
] as const;

/**
 * Competitive score record. One row per (player_id, replay_hash) pair
 * in `legendary.competitive_scores`; the underlying table enforces
 * this via `UNIQUE (player_id, replay_hash)`. Records are write-once
 * per D-5302 — no UPDATE function exists in the application layer.
 *
 * `Object.keys(record).sort()` MUST equal:
 *   ['accountId','createdAt','finalScore','henchmanKey','isRankedEligible',
 *    'outcome','parVersion','playerCount','rawScore','replayHash',
 *    'scenarioKey','scoreBreakdown','scoringConfigVersion','stateHash',
 *    'submissionId','teamKey']
 * — exactly 16 keys. (Amended from the WP-053 11-key lock by D-24131,
 * which adds `outcome`; to 13 keys by D-24134, which adds `playerCount`;
 * to 14 keys by WP-354 / D-24146, which adds `isRankedEligible`; to 15
 * keys by D-24187, which adds `teamKey`; to 16 keys by WP-395 / D-24199,
 * which adds `henchmanKey`.)
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
  // why: nullable — see CompetitiveOutcome; a NULL row predates
  // migration 026 (or hit the defensive null-evaluation path) and
  // never qualifies as a gauntlet leg per D-24131 §3.
  readonly outcome: CompetitiveOutcome | null;
  // why: nullable — how many seats the scored match was played with
  // (1-5), derived server-side from the reduced final state's
  // per-player record (migration 027). A NULL row predates the
  // column (or hit the defensive out-of-range path) and never
  // qualifies on any count-keyed gauntlet board per D-24134 §1.
  readonly playerCount: number | null;
  // why: WP-354 / D-24146 — whether this run's authenticated human
  // roster formed a mutual-friend clique at submission (migration 029,
  // default true). Evaluated ONCE at submission and never re-written
  // (FR-7); solo / single-account runs are vacuously eligible. The
  // public ranked leaderboard filters to `true`; the owner's own
  // My-Scores read is unfiltered (they see their Casual runs).
  readonly isRankedEligible: boolean;
  // why: nullable — the hero team the scored match was played with:
  // the set-qualified hero ids (D-10014) sorted ASC and joined `+`,
  // derived server-side from the reduced final state's
  // matchConfiguration (migration 034, step 14d). A NULL row predates
  // the column (until the one-time D-24187 §2 artifact backfill fills
  // it — rows with no surviving artifact stay NULL) and never
  // qualifies on any fixed-hero-pool board per D-24187 §1.
  readonly teamKey: string | null;
  // why: nullable — the henchmen groups the scored match was played
  // with: the set-qualified henchman group ids (D-10014) sorted ASC
  // and joined `+`, derived server-side from the reduced final
  // state's matchConfiguration (migration 035, step 14e). Henchmen
  // are not part of ScenarioKey, so this column is the ONLY queryable
  // record of them; a NULL row predates it (no backfill exists — the
  // table was empty when the column landed) and never satisfies the
  // D-24199 canonical loadout requirement on any gauntlet board.
  readonly henchmanKey: string | null;
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
// why: WP-593 / D-24402 — the `ok` branch may carry a derived, non-persisted
// per-seat identity roster (`Player N (Bot)` / `Player N (@handle)` on the
// endgame report card). Optional: only the by-matchId submit path can build it
// (it holds the matchId the identities are keyed on); the inner replayHash-keyed
// impl and older callers omit it, and the card degrades to plain "Player N".
// It is never part of the locked 16-key CompetitiveScoreRecord (it is match
// metadata, not a score-row column).
export type SubmissionResult =
  | {
      ok: true;
      record: CompetitiveScoreRecord;
      wasExisting: boolean;
      seatIdentities?: readonly MatchSeatIdentity[];
    }
  | { ok: false; reason: SubmissionRejectionReason };

