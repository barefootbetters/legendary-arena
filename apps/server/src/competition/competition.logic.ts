/**
 * Competitive Score Submission & Verification — Server Layer (WP-053)
 *
 * Public functions for submitting, looking up, and listing competitive
 * score records in `legendary.competitive_scores`. The submission
 * pipeline orchestrates engine contracts (replay re-execution, hash
 * verification, scoring derivation) and persistence — but never
 * implements scoring math itself per D-5301 (server is enforcer, not
 * calculator). All persistent operations go through PostgreSQL via a
 * caller-injected `DatabaseClient` (`pg.Pool`); the pool is created
 * at server startup by future request-handler WPs and is not wired
 * by this packet.
 *
 * Cross-directory disambiguation: this module is the server-layer
 * competitive submission surface. It is distinct from any future
 * arena-client UI submit handler (none exists today) and from
 * apps/server/src/replay/ (WP-103 storage), apps/server/src/identity/
 * (WP-052 ownership), and apps/server/src/par/ (WP-051 / WP-053a PAR
 * gate). It consumes those siblings via their public exports and
 * never reaches into their internals.
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io`, `@legendary-arena/registry`, `@legendary-arena/preplan`,
 * `@legendary-arena/vue-sfc-loader`, or any UI / arena-client /
 * replay-producer / registry-viewer package. Engine imports are
 * limited to read-only types and pure scoring/replay functions per
 * the ARCHITECTURE.md Layer Boundary. The engine-layer plain-string
 * identifier (D-8701) is NEVER imported here — the server uses the
 * branded `AccountId` (D-5201) as its canonical owner reference.
 *
 * Authority: WP-053 §B / §C (16-step flow + locked CTE INSERT);
 * EC-053 §Locked Values; D-4801 (deriveScoringInputs reads game state
 * directly; no event log dependency); D-5103 (PAR gate is fs-free);
 * D-5201 (server identity is AccountId); D-5301 (server is enforcer,
 * not calculator); D-5302 (records are immutable; visibility checked
 * at submission time only); D-5304 (idempotent retry returns
 * { ok: true, wasExisting: true }; the retry-rejection string
 * forbidden by D-5304 does NOT appear in this layer); D-5305
 * (legendary.competitive_scores schema lock); D-5306 Option A
 * (scoringConfig flows from PAR artifact; defense-in-depth equality
 * check at step 12 detects corruption / mismatched-artifact bugs).
 */

import {
  buildScoreBreakdown,
  computeFinalScore,
  computeParScore,
  computeRawScore,
  deriveScoringInputs,
} from '@legendary-arena/game-engine';

import type {
  ReplayResult,
  ScenarioScoringConfig,
  ScenarioKey,
  ScoreBreakdown,
} from '@legendary-arena/game-engine';

import { issueTier1BadgesForSubmission } from '../badges/badge.issuance.js';

// why: WP-336 repoints the verifier onto the faithful reducer path. The single
// `reduceReplayByHash` (WP-334/WP-335/WP-336) reads the durable
// `bgio.replay_artifacts` row by `replayHash` and re-executes it through
// boardgame.io's own reducer, returning the reproduced final `G`, its canonical
// hash, and the completed play-turn count — replacing the old
// `loadReplay`(`replay_blobs`) + `replayGame`(determinism harness) pair, which
// live-captured matches never populated. Imported at runtime (the deps seam
// re-exposes it so tests can swap a stub).
import { reduceReplayByHash } from '../replay/matchReplay.logic.js';
import type { MatchReplayResult } from '../replay/matchReplay.logic.js';

// why: WP-052's findReplayOwnership returns the (accountId, scenarioKey,
// visibility) metadata flow steps 2-4 require. The locked
// ReplayOwnershipRecord shape pre-dates D-5201 rename — owner field
// is `accountId: AccountId`, not the engine-layer identifier.
import { findReplayOwnership } from '../identity/replayOwnership.logic.js';

// why: WP-052's isGuest type guard is the fail-fast step 1. Calling
// it before any DB query is the contractual no-DB-hits-for-guests
// guarantee; the EC §Guardrails explicitly forbids any database
// access prior to this guard.
import { isGuest } from '../identity/identity.types.js';

import type {
  AccountId,
  PlayerAccount,
  PlayerIdentity,
} from '../identity/identity.types.js';

import type {
  CompetitiveScoreRecord,
  DatabaseClient,
  SubmissionResult,
} from './competition.types.js';

// ---------------------------------------------------------------------------
// PAR gate hit shape — local re-statement
// ---------------------------------------------------------------------------

// why: parGate.mjs is JSDoc-typed (the .mjs file does not export
// TypeScript types). Re-stating the post-WP-053a return shape here
// keeps the deps interface strongly typed without crossing into the
// untyped module. Field order matches the JSDoc typedef in
// apps/server/src/par/parGate.mjs:32-47 verbatim.
// why: exported (additive, WP-332) so the request-handler layer can
// type the injected `checkParPublished` binding without re-stating
// the shape; every pre-existing export is byte-unchanged.
export interface ParGateHit {
  readonly parValue: number;
  readonly parVersion: string;
  readonly source: 'simulation' | 'seed';
  readonly scoringConfig: ScenarioScoringConfig;
}

// ---------------------------------------------------------------------------
// Dependency injection seam
// ---------------------------------------------------------------------------

/**
 * Internal seam used by `submitCompetitiveScoreImpl` so test #7 can
 * verify via a spy that `reduceReplay` is NOT called on the
 * idempotent-retry path (the D-5304 contract). Production callers
 * receive the defaults below; tests swap in stubs or spies.
 *
 * `checkParPublished` is included in this seam (rather than as a
 * separate parameter) because the locked public signature for
 * `submitCompetitiveScore` is exactly three arguments
 * (identity, replayHash, database). Per the session prompt's
 * "implementer's choice" authorization for parGate wiring shape, the
 * deps seam is the chosen MVP path — tests inject a stub gate; future
 * production wiring will import `submitCompetitiveScoreImpl` directly
 * and supply the bound `parGate.checkParPublished` from server
 * startup.
 *
 * WP-336: `reduceReplay` replaces the old `loadReplay` + `replayGame`
 * pair (and the `registry` field the engine harness needed) — the
 * reducer needs no `CardRegistryReader`, since card resolution is baked
 * into the persisted `initialState`.
 */
interface SubmissionDependencies {
  readonly reduceReplay: typeof reduceReplayByHash;
  readonly checkParPublished: (scenarioKey: ScenarioKey) => ParGateHit | null;
}

// why: production defaults wire the real faithful-reducer lookup. The
// default checkParPublished returns null (fail-closed) because the
// lifecycle prohibition forbids WP-053 from wiring the real PAR gate at
// server startup — the public submitCompetitiveScore exists as a
// library surface today, not as a request-path consumer. Future
// production wiring (the WP-332 request handler) calls
// submitCompetitiveScoreImpl via submitCompetitiveScoreForRequest with a
// real bound parGate.checkParPublished. Until then the public wrapper
// rejects every submission with par_not_published before reaching the
// reduceReplay call.
const PRODUCTION_DEPENDENCIES: SubmissionDependencies = {
  reduceReplay: reduceReplayByHash,
  checkParPublished: () => null,
};

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

/**
 * Internal shape returned by every competitive-score SELECT /
 * RETURNING used in this module. The TypeScript application layer
 * maps this row shape to `CompetitiveScoreRecord` via
 * `mapCompetitiveScoreRow`.
 */
interface CompetitiveScoreRow {
  submission_id: number | string;
  account_id: string;
  replay_hash: string;
  scenario_key: string;
  raw_score: number;
  final_score: number;
  score_breakdown: ScoreBreakdown;
  par_version: string;
  scoring_config_version: number;
  state_hash: string;
  created_at: Date | string;
}

/**
 * Map a competitive_scores row (with `account_id` joined from
 * `legendary.players.ext_id`) to the locked `CompetitiveScoreRecord`
 * shape. `bigserial` columns may arrive from `pg` as either `number`
 * or `string` depending on driver configuration; both are coerced to
 * `number` here. Timestamps arrive as `Date` and are converted to
 * ISO 8601 strings to match the contract. score_breakdown is
 * deserialized by pg's jsonb codec at the driver level — no manual
 * JSON deserialization is performed.
 */
// why: pg's jsonb codec deserializes column values at the driver
// level — a manual JSON-parsing call against row.score_breakdown
// would double-decode and break (the row value is already a JS
// object). Mirrors WP-103's loadReplay precedent for the same codec.
function mapCompetitiveScoreRow(row: CompetitiveScoreRow): CompetitiveScoreRecord {
  return {
    submissionId:
      typeof row.submission_id === 'string'
        ? Number(row.submission_id)
        : row.submission_id,
    accountId: row.account_id as AccountId,
    replayHash: row.replay_hash,
    scenarioKey: row.scenario_key,
    rawScore: row.raw_score,
    finalScore: row.final_score,
    scoreBreakdown: row.score_breakdown,
    parVersion: row.par_version,
    scoringConfigVersion: row.scoring_config_version,
    stateHash: row.state_hash,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Idempotency fast-path query
// ---------------------------------------------------------------------------

/**
 * Look up an existing competitive_scores row for the
 * (accountId, replayHash) pair. Returns the mapped record on hit,
 * `null` on miss. Used at flow step 4b to short-circuit the
 * submission pipeline before any replay I/O or PAR-gate I/O.
 */
async function findExistingByAccountAndHash(
  accountId: AccountId,
  replayHash: string,
  database: DatabaseClient,
): Promise<CompetitiveScoreRecord | null> {
  const result = await database.query(
    'SELECT cs.submission_id, p.ext_id AS account_id, cs.replay_hash, ' +
      'cs.scenario_key, cs.raw_score, cs.final_score, cs.score_breakdown, ' +
      'cs.par_version, cs.scoring_config_version, cs.state_hash, ' +
      'cs.created_at ' +
      'FROM legendary.competitive_scores cs ' +
      'JOIN legendary.players p ON cs.player_id = p.player_id ' +
      'WHERE p.ext_id = $1 AND cs.replay_hash = $2 LIMIT 1',
    [accountId, replayHash],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapCompetitiveScoreRow(result.rows[0]);
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * Submit a competitive score for the replay identified by
 * `replayHash`. Returns a structured `SubmissionResult` — never
 * throws for any expected failure mode defined by WP-053 §B. Only
 * infrastructure-level errors (connection lost, permission denied,
 * malformed SQL) propagate as exceptions for the caller (a future
 * request handler) to translate into HTTP responses or operator
 * alerts.
 *
 * Accepts `PlayerIdentity` (the WP-052 discriminated union), not
 * bare `AccountId`, so guest rejection can be enforced inside this
 * function rather than delegated upstream. Per D-5201, after the
 * `isGuest(identity)` guard the type narrows to `PlayerAccount` and
 * `identity.accountId` is the canonical owner reference.
 *
 * The 16-step flow defined by WP-053 §B is implemented inside the
 * internal `submitCompetitiveScoreImpl`; this public function is a
 * thin wrapper using PRODUCTION_DEPENDENCIES.
 */
// why: server orchestrates; engine computes scoring. Every numeric
// output traces to an engine function call — no scoring math lives
// in this module per D-5301. EC-053 §Required `// why:` Comments
// — "submitCompetitiveScore delegation".
export async function submitCompetitiveScore(
  identity: PlayerIdentity,
  replayHash: string,
  database: DatabaseClient,
): Promise<SubmissionResult> {
  return submitCompetitiveScoreImpl(identity, replayHash, database);
}

/**
 * Production request-path dependencies for a competitive submission:
 * the bound PAR-gate check. The request-handler layer (WP-332)
 * constructs this once at server startup and passes it per request.
 * Kept separate from the internal `SubmissionDependencies` seam so
 * route code never needs to name the module-internal `reduceReplay`
 * default. WP-336 dropped the `registry` field — the faithful reducer
 * needs no `CardRegistryReader` (card resolution is baked into the
 * persisted `initialState`).
 */
export interface CompetitiveSubmissionProductionDependencies {
  readonly checkParPublished: (scenarioKey: ScenarioKey) => ParGateHit | null;
}

/**
 * Production request-path entry for competitive score submission
 * (WP-332). Delegates to `submitCompetitiveScoreImpl`, supplying the
 * real module-internal `reduceReplay` plus the caller-injected
 * `checkParPublished`. This is the entry an HTTP route must call — NOT
 * the `submitCompetitiveScore` wrapper above.
 */
// why: the `submitCompetitiveScore` wrapper above uses
// PRODUCTION_DEPENDENCIES, whose `checkParPublished` returns null
// (fail-closed per the WP-053 lifecycle prohibition), so it rejects
// EVERY submission with par_not_published before any replay reduction. A
// working request path MUST inject the live bound PAR-gate check; this
// wrapper is that injection seam (WP-332 §Scope B). reduceReplay stays
// the module default so route code never imports the replay surface
// directly.
export async function submitCompetitiveScoreForRequest(
  identity: PlayerIdentity,
  replayHash: string,
  database: DatabaseClient,
  productionDeps: CompetitiveSubmissionProductionDependencies,
): Promise<SubmissionResult> {
  return submitCompetitiveScoreImpl(identity, replayHash, database, {
    reduceReplay: reduceReplayByHash,
    checkParPublished: productionDeps.checkParPublished,
  });
}

/**
 * Look up a single competitive score record by `replayHash`.
 * Returns the mapped record if found, `null` otherwise. Read-only
 * access surface for future leaderboard / profile / audit consumers.
 */
export async function findCompetitiveScore(
  replayHash: string,
  database: DatabaseClient,
): Promise<CompetitiveScoreRecord | null> {
  const result = await database.query(
    'SELECT cs.submission_id, p.ext_id AS account_id, cs.replay_hash, ' +
      'cs.scenario_key, cs.raw_score, cs.final_score, cs.score_breakdown, ' +
      'cs.par_version, cs.scoring_config_version, cs.state_hash, ' +
      'cs.created_at ' +
      'FROM legendary.competitive_scores cs ' +
      'JOIN legendary.players p ON cs.player_id = p.player_id ' +
      'WHERE cs.replay_hash = $1 LIMIT 1',
    [replayHash],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapCompetitiveScoreRow(result.rows[0]);
}

/**
 * List every competitive score record owned by an account, newest
 * first. Returns an empty array when the account has no submissions
 * or doesn't exist (the function does not distinguish — there is no
 * caller use case for "unknown account" here, mirroring WP-052's
 * `listAccountReplays` precedent).
 */
export async function listPlayerCompetitiveScores(
  accountId: AccountId,
  database: DatabaseClient,
): Promise<CompetitiveScoreRecord[]> {
  const result = await database.query(
    'SELECT cs.submission_id, p.ext_id AS account_id, cs.replay_hash, ' +
      'cs.scenario_key, cs.raw_score, cs.final_score, cs.score_breakdown, ' +
      'cs.par_version, cs.scoring_config_version, cs.state_hash, ' +
      'cs.created_at ' +
      'FROM legendary.competitive_scores cs ' +
      'JOIN legendary.players p ON cs.player_id = p.player_id ' +
      'WHERE p.ext_id = $1 ' +
      'ORDER BY cs.created_at DESC',
    [accountId],
  );
  return result.rows.map((row: CompetitiveScoreRow) =>
    mapCompetitiveScoreRow(row),
  );
}

// ---------------------------------------------------------------------------
// Internal impl — the 16-step flow
// ---------------------------------------------------------------------------

/**
 * Internal implementation of the WP-053 §B 16-step submission flow.
 * Exposed (not via the package barrel — direct test-only import) so
 * tests can verify the dependency-injection contract for test #7
 * (D-5304 — idempotent retry MUST NOT call reduceReplay).
 *
 * Production callers should prefer `submitCompetitiveScore`, which
 * is the locked 3-arg public entry. Direct callers of Impl supply
 * a `deps` object with a real `parGate.checkParPublished`.
 */
export async function submitCompetitiveScoreImpl(
  identity: PlayerIdentity,
  replayHash: string,
  database: DatabaseClient,
  deps: SubmissionDependencies = PRODUCTION_DEPENDENCIES,
): Promise<SubmissionResult> {
  // why: step 1 — guest fail-fast per D-5304-equivalent eligibility
  // contract. The isGuest guard runs BEFORE any database access so
  // the "no DB hits for guests" guarantee in EC-053 §Guardrails is
  // structurally enforced. Identity narrows to PlayerAccount on the
  // false branch.
  if (isGuest(identity)) {
    return { ok: false, reason: 'guest_not_eligible' };
  }
  const account: PlayerAccount = identity;

  // step 2 — ownership lookup
  const ownership = await findReplayOwnership(replayHash, database);
  if (ownership === null) {
    return { ok: false, reason: 'replay_not_found' };
  }

  // step 3 — owner check
  if (ownership.accountId !== account.accountId) {
    return { ok: false, reason: 'not_owner' };
  }

  // why: step 4 — visibility checked at submission time only per
  // D-5302. Once accepted, a competitive record is immutable; a
  // later visibility change does NOT retroactively invalidate the
  // record. There is no recheck after insert.
  if (ownership.visibility === 'private') {
    return { ok: false, reason: 'visibility_not_eligible' };
  }

  // why: step 4b — idempotency fast-path per D-5304. Look up an
  // existing competitive record keyed on (accountId, replayHash)
  // BEFORE any replay I/O or PAR-gate I/O. If present, return the
  // existing record with wasExisting: true; never re-execute the
  // replay, never call loadReplay, never call checkParPublished.
  // Monotonic-PAR rationale: PAR versions only advance forward; the
  // existing record's scoring context is already pinned via
  // parVersion + scoringConfigVersion, so re-scoring under a newer
  // config would be a NEW record (a future feature), never an
  // UPDATE on this one.
  const existing = await findExistingByAccountAndHash(
    account.accountId,
    replayHash,
    database,
  );
  if (existing !== null) {
    return { ok: true, record: existing, wasExisting: true };
  }

  // step 5 — scenario key extraction (literal field on
  // ReplayOwnershipRecord per WP-052; do NOT re-derive from the replay)
  const scenarioKey = ownership.scenarioKey;

  // why: step 6 — PAR gate via the bound method on the gate object
  // returned by createParGate (RS-1). The bare module function in
  // parGate.mjs takes 3 args (simulationIndex, seedIndex, scenarioKey);
  // the bound method takes 1 (scenarioKey) and is what the deps seam
  // exposes. On null the submission rejects with par_not_published —
  // missing PAR is fail-closed per D-5103. On success the gate
  // returns the post-WP-053a tuple { parValue, parVersion, source,
  // scoringConfig } — non-optional scoringConfig per D-5306 Option A.
  const hit = deps.checkParPublished(scenarioKey);
  if (hit === null) {
    return { ok: false, reason: 'par_not_published' };
  }

  // why: step 7+8 — faithful replay reduction (WP-336). reduceReplay reads the
  // durable bgio.replay_artifacts row by replayHash (WP-335) and re-executes it
  // through boardgame.io's own reducer (WP-334), returning the reproduced final
  // G, its canonical hash, and the completed play-turn count. This replaces the
  // old loadReplay(replay_blobs) + replayGame(determinism harness) pair, which
  // live-captured matches never populated. A null result means no captured
  // artifact exists for the submitted hash — a verification failure rather than a
  // silent 404, and returned (not thrown) per WP-053 §B's "never throw for
  // expected failures" guarantee. The reduction itself is deterministic and
  // fails closed on a malformed artifact.
  let reduced: MatchReplayResult;
  try {
    const reducedOrNull = await deps.reduceReplay(replayHash, database);
    if (reducedOrNull === null) {
      return { ok: false, reason: 'replay_verification_failed' };
    }
    reduced = reducedOrNull;
  } catch {
    // why: catch swallows a malformed-artifact error deliberately — a corrupt
    // artifact is an expected rejection mode, not an infrastructure error. The
    // structured SubmissionResult is the contract.
    return { ok: false, reason: 'replay_verification_failed' };
  }

  // why: step 9 — state-hash anchor (anti-tamper). reduced.stateHash is the
  // canonical computeStateHash of the reduced final G; comparing it to the
  // submitted replayHash confirms the submission names a captured artifact whose
  // reduction actually yields that hash. Mismatch means the submitted hash does
  // not correspond to the reduced state; fail closed. The accepted record's
  // stateHash equals replayHash for every accepted submission.
  if (reduced.stateHash !== replayHash) {
    return { ok: false, reason: 'replay_verification_failed' };
  }

  // why: step 10 — derived scoring inputs. Per D-4801, the second argument is
  // the final game state (reduced.finalState) — the engine reads the terminal
  // state directly, with no event log dependency. The first argument is a
  // ReplayResult-shaped view whose `moveCount` slot carries the completed
  // play-TURN count (reduced.turnCount), because deriveScoringInputs reads
  // `.moveCount` as `rounds` and the PAR baselines were calibrated with
  // rounds = turn count (D-24123). The engine is NOT edited; retiring the
  // `moveCount` field name in favor of a turns-native input is deferred to WP-4.
  const scoringView: ReplayResult = {
    finalState: reduced.finalState,
    stateHash: reduced.stateHash,
    moveCount: reduced.turnCount,
  };
  const scoringInputs = deriveScoringInputs(scoringView, reduced.finalState);

  // step 11 — raw score; engine computes, server stores
  const rawScore = computeRawScore(scoringInputs, hit.scoringConfig);

  // why: step 12 — defense-in-depth equality check per D-5306
  // Option A. computeParScore(hit.scoringConfig) MUST equal
  // hit.parValue because both flow from the same PAR artifact
  // returned by the gate; structural drift is impossible. This
  // check is preserved as belt-and-suspenders against corruption /
  // bit-flips / mismatched-artifact hand-off bugs — NOT as a
  // primary safety net against legitimate drift. Mismatch fails
  // closed as replay_verification_failed.
  if (computeParScore(hit.scoringConfig) !== hit.parValue) {
    return { ok: false, reason: 'replay_verification_failed' };
  }

  // step 13 — final score normalized against published parValue
  // (never a re-derived value)
  const finalScore = computeFinalScore(rawScore, hit.parValue);

  // step 14 — full breakdown for audit transparency
  const scoreBreakdown = buildScoreBreakdown(scoringInputs, hit.scoringConfig);

  // why: step 15 — locked CTE INSERT with the
  // ON CONFLICT (player_id, replay_hash) DO UPDATE SET player_id =
  // legendary.competitive_scores.player_id no-op self-assignment +
  // RETURNING (xmax = 0) AS was_inserted pattern. The self-assignment
  // forces RETURNING to emit the conflicting row's columns on
  // conflict (DO NOTHING would emit zero rows). The xmax = 0 idiom
  // distinguishes fresh inserts (true) from race-lost retries
  // (false). The CTE resolves accountId → player_id in one
  // statement so the unknown-account path doesn't need a separate
  // 23503 catch — mirrors WP-052's assignReplayOwnership precedent.
  // why: race-condition recovery — if the step 4b existence check
  // lost a race and the INSERT raises 23505 (UNIQUE violation on
  // player_id, replay_hash), the locked DO UPDATE clause still
  // emits the existing row's columns via RETURNING; the CTE's
  // SELECT then completes normally with was_inserted = false. No
  // 23505 catch is required at this site because the no-op
  // self-assignment turns the conflict into a successful UPDATE.
  // Per D-5304: never re-throw, never re-execute.
  const insertResult = await database.query(
    'WITH resolved_player AS ( ' +
      'SELECT player_id FROM legendary.players WHERE ext_id = $1 ' +
      '), ' +
      'inserted AS ( ' +
      'INSERT INTO legendary.competitive_scores ' +
      '(player_id, replay_hash, scenario_key, raw_score, final_score, ' +
      'score_breakdown, par_version, scoring_config_version, state_hash) ' +
      'SELECT player_id, $2, $3, $4, $5, $6, $7, $8, $9 ' +
      'FROM resolved_player ' +
      'ON CONFLICT (player_id, replay_hash) ' +
      'DO UPDATE SET player_id = legendary.competitive_scores.player_id ' +
      'RETURNING submission_id, player_id, replay_hash, scenario_key, ' +
      'raw_score, final_score, score_breakdown, ' +
      'par_version, scoring_config_version, state_hash, created_at, ' +
      '(xmax = 0) AS was_inserted ' +
      ') ' +
      'SELECT i.submission_id, p.ext_id AS account_id, i.replay_hash, ' +
      'i.scenario_key, i.raw_score, i.final_score, i.score_breakdown, ' +
      'i.par_version, i.scoring_config_version, i.state_hash, ' +
      'i.created_at, i.was_inserted, i.player_id ' +
      'FROM inserted i ' +
      'JOIN legendary.players p ON i.player_id = p.player_id',
    [
      account.accountId,
      replayHash,
      scenarioKey,
      rawScore,
      finalScore,
      scoreBreakdown,
      hit.parVersion,
      hit.scoringConfig.scoringConfigVersion,
      // why: the stored state_hash is the reduced final G's canonical hash,
      // which step 9 has just confirmed equals replayHash for every accepted
      // submission (the anti-tamper anchor).
      reduced.stateHash,
    ],
  );

  // why: zero rows means the resolved_player CTE matched no
  // legendary.players row for this accountId — the account was
  // deleted between the step-2 ownership lookup and this INSERT.
  // Treat as replay_not_found rather than replay_verification_failed
  // because the failure mode is identity disappearance, not replay
  // tampering. Defensive: this path is exceedingly rare in practice.
  if (insertResult.rows.length === 0) {
    return { ok: false, reason: 'replay_not_found' };
  }

  const row: CompetitiveScoreRow & { was_inserted: boolean; player_id: number | string } =
    insertResult.rows[0];
  const record = mapCompetitiveScoreRow(row);

  // why: badge issuance is fire-and-forget relative to the submission
  // pipeline. The competitive submission is the authoritative record;
  // badges are derived. Badge issuance failure MUST NOT fail the
  // submission — the try/catch ensures a badge error degrades gracefully
  // to a warning log. The caller's transaction context is passed through
  // so badge rows participate in the same commit.
  const resolvedPlayerId =
    typeof row.player_id === 'string'
      ? Number(row.player_id)
      : row.player_id;
  try {
    await issueTier1BadgesForSubmission(
      resolvedPlayerId,
      record.submissionId,
      record.scoreBreakdown,
      record.scenarioKey,
      record.scoringConfigVersion,
      database,
    );
  } catch (badgeError) {
    console.warn(
      '[badges] Tier 1 badge issuance failed for submission ' +
        String(record.submissionId) +
        '; competitive record is unaffected.',
      badgeError,
    );
  }

  return {
    ok: true,
    record,
    wasExisting: row.was_inserted === false,
  };
}
