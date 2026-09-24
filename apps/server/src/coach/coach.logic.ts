/**
 * Endgame AI Coach — Orchestrator (WP-594 / EC-629 / D-24403)
 *
 * `generateOrGetCoachReport` runs the WP-594 pipeline: entitlement gate (the
 * Legendary Pass) → ownership check → cache read → (on miss) assemble summary →
 * call the model → cache → return. Lazy + cached: the paid model runs at most
 * once per match; every later view is a cache hit. Fail-soft: a model failure
 * returns `coach_unavailable`, never blocks the endgame card (D-24403).
 *
 * WP-751 / D-24576 — a match with no score row (a casual, unscored match) is
 * coached too: its summary comes from the scoring inputs derived from the replay,
 * with no score, grade or PAR comparison. `generateOrGetCoachReportForMatch` is
 * the matchId entry for a client that never received a replay hash: Pass gate →
 * resolve the match to its replay (capturing on demand) → the same pipeline.
 *
 * Every external surface — entitlements, ownership, score, replay reduction,
 * cache read/write, match capture — is reached through the injectable
 * `CoachLogic` seam (mirroring WP-115's `LeaderboardLogic`), and the model client
 * is injected via `CoachDependencies`. So the whole pipeline is unit-testable
 * with fakes: the test suite touches NO real database and makes ZERO paid calls.
 *
 * Layer-boundary contract: same-layer server imports (entitlements,
 * identity/replayOwnership, competition, replay, match) plus the engine's
 * runtime-safe `.` surface (`evaluateEndgame`, `deriveScoringInputs`), the same
 * surface `competition.logic.ts` consumes. No `boardgame.io`, registry, or UI
 * import.
 *
 * Authority: WP-594 §Contract; EC-629; D-24403; WP-751 / EC-788 / D-24576.
 */

import { deriveScoringInputs, evaluateEndgame } from '@legendary-arena/game-engine';
import type { ReplayResult, ScoringInputs } from '@legendary-arena/game-engine';

import { getEntitlementsForAccount } from '../entitlements/entitlements.logic.js';
import { findReplayOwnershipForAccount } from '../identity/replayOwnership.logic.js';
import { findCompetitiveScore } from '../competition/competition.logic.js';
import {
  reduceReplayByHash,
  readReplayArtifactByHash,
  reduceMatchCapturingHeroPlays,
  readMatchIdByReplayHash,
  isMatchFinished,
  readReplayHashByMatchId,
} from '../replay/matchReplay.logic.js';
import { captureMatch } from '../replay/matchCapture.logic.js';
import { readMatchBotSeats } from '../match/seatAccount.logic.js';
import { readCoachReport, writeCoachReport } from './coachReport.persistence.js';
import { buildCasualCoachMatchSummary, buildCoachMatchSummary } from './coachSummary.logic.js';
import { computeSequenceTips } from './sequenceTeacher.logic.js';
import { computeTableCooperation } from './tableCooperation.logic.js';

import type { AccountId, DatabaseClient } from '../identity/identity.types.js';
import type { CompetitiveScoreRecord } from '../competition/competition.types.js';
import type { MatchReplayResult } from '../replay/matchReplay.logic.js';
import type { CoachDependencies, CoachMatchSummary, CoachResult } from './coach.types.js';

// why: the Legendary Pass entitlement key (WP-594 / D-24403). A distinct product
// from the supporter tier; the coach is gated on this key alone.
const LEGENDARY_PASS_KEY = 'legendary_pass_2026';

/**
 * Injectable dependency seam for the DB-backed reads/writes (mirrors WP-115's
 * `LeaderboardLogic`). Production callers omit it and the orchestrator resolves
 * to the imported functions; tests pass fakes returning canned results, so no
 * real database is touched.
 */
export interface CoachLogic {
  readonly getEntitlementsForAccount: typeof getEntitlementsForAccount;
  readonly findReplayOwnershipForAccount: typeof findReplayOwnershipForAccount;
  readonly findCompetitiveScore: typeof findCompetitiveScore;
  readonly reduceReplayByHash: typeof reduceReplayByHash;
  readonly readCoachReport: typeof readCoachReport;
  readonly writeCoachReport: typeof writeCoachReport;
  // why: WP-710 / D-24533 — the sequence teacher needs the raw {initialState, log}
  // (not just the reduced final state) to re-run the capturing fold; injectable so the
  // DB-free coach tests can supply a canned artifact.
  readonly readReplayArtifactByHash: typeof readReplayArtifactByHash;
  // why: WP-742 / D-24564 — the match's bot-ally seat ids, so the summary can mark
  // the bot seat; injectable so the DB-free coach tests can supply canned seats.
  readonly readBotSeatIdsForReplay: (
    replayHash: string,
    database: DatabaseClient,
  ) => Promise<string[]>;
  // why: WP-751 / D-24576 — resolves a finished match id to its replay hash,
  // capturing on demand; injectable so the DB-free tests can prove a caller without
  // the Pass never reaches it (no capture writes).
  readonly captureMatchForCoach: (
    matchId: string,
    database: DatabaseClient,
  ) => Promise<string | null>;
}

/**
 * Resolves a replay's bot-ally seat ids (WP-742 / D-24564): replay hash → the
 * artifact's `match_id` column → the match's `legendary.match_bot_ally` seats.
 * Returns `[]` for a replay with no artifact row or a match with no bot ally —
 * the normal human-only case.
 *
 * @param replayHash The scored match's replay hash.
 * @param database The caller-injected `pg` pool.
 * @returns The bot seat ids (e.g. `['1']`), or `[]`.
 */
export async function readBotSeatIdsForReplay(
  replayHash: string,
  database: DatabaseClient,
): Promise<string[]> {
  const matchId = await readMatchIdByReplayHash(replayHash, database);
  if (matchId === null) {
    return [];
  }
  return readMatchBotSeats(matchId, database);
}

/**
 * Resolves a finished match id to its replay hash for the coach (WP-751 /
 * D-24576): finish gate → the captured artifact's hash → an on-demand capture when
 * no artifact exists yet. Returns `null` for an unfinished or unreplayable match.
 *
 * why: mirrors submit's on-demand capture (competition.logic.ts steps 2–3) because
 * the 5-minute harvester may not have run yet when the player opens the coach at
 * gameover. The capture is idempotent and writes only the replay artifact and the
 * per-seat ownership rows the harvester would write — it never publishes anything.
 *
 * @param matchId The finished match's boardgame.io id.
 * @param database The caller-injected `pg` pool.
 * @returns The match's replay hash, or `null` when it cannot be coached.
 */
export async function captureMatchForCoach(
  matchId: string,
  database: DatabaseClient,
): Promise<string | null> {
  const isFinished = await isMatchFinished(matchId, database);
  if (!isFinished) {
    return null;
  }
  const existingHash = await readReplayHashByMatchId(matchId, database);
  if (existingHash !== null) {
    return existingHash;
  }
  const captured = await captureMatch(matchId, database);
  return captured.replayHash;
}

const PRODUCTION_COACH_LOGIC: CoachLogic = {
  getEntitlementsForAccount,
  findReplayOwnershipForAccount,
  findCompetitiveScore,
  reduceReplayByHash,
  readCoachReport,
  writeCoachReport,
  readReplayArtifactByHash,
  readBotSeatIdsForReplay,
  captureMatchForCoach,
};

/**
 * Returns whether the account holds the Legendary Pass. A lookup failure OR a
 * missing Pass key both mean "no access"; the read failure is not distinguished
 * from absence, to avoid leaking entitlement-table state to the caller.
 *
 * @param accountId The authenticated caller.
 * @param database The caller-injected `pg` pool.
 * @param logic The injectable seam (for `getEntitlementsForAccount`).
 * @returns True when the caller holds the Pass.
 */
async function hasLegendaryPass(
  accountId: AccountId,
  database: DatabaseClient,
  logic: CoachLogic,
): Promise<boolean> {
  const entitlements = await logic.getEntitlementsForAccount(accountId, database);
  return (
    entitlements.ok === true &&
    entitlements.value.some((entitlement) => entitlement.entitlementKey === LEGENDARY_PASS_KEY)
  );
}

/**
 * Generate (or return the cached) endgame coaching for a finished match the caller
 * owns — scored, or casual (unscored) since WP-751. Never throws for an expected
 * failure — every outcome is a typed `CoachResult`. Only an unexpected
 * infrastructure fault propagates.
 *
 * @param accountId The authenticated caller (must hold the Legendary Pass + own the replay).
 * @param replayHash The match's replay hash.
 * @param deps The injected model client + card-name resolver + database.
 * @param logic Test-only injection seam for the DB-backed reads/writes.
 * @returns The typed coach result (report on success; a typed refusal otherwise).
 */
export async function generateOrGetCoachReport(
  accountId: AccountId,
  replayHash: string,
  deps: CoachDependencies,
  logic: CoachLogic = PRODUCTION_COACH_LOGIC,
): Promise<CoachResult> {
  // Gate 1 — Legendary Pass entitlement.
  const hasPass = await hasLegendaryPass(accountId, deps.database, logic);
  if (!hasPass) {
    return { ok: false, reason: 'not_entitled' };
  }

  // Gate 2 — the caller must own this replay (played it as an authenticated seat).
  const ownership = await logic.findReplayOwnershipForAccount(
    accountId,
    replayHash,
    deps.database,
  );
  if (ownership === null) {
    return { ok: false, reason: 'not_owner' };
  }

  // Cache — a second view of the same match's coaching never re-calls the model.
  const cached = await logic.readCoachReport(replayHash, deps.database);
  if (cached !== null) {
    return { ok: true, report: cached, wasCached: true };
  }

  // The coach needs the reduced final state (loadout + acquired cards) and the
  // match's numbers: the stored score breakdown for a scored match, or the inputs
  // derived from the replay for a casual one. A match that is not replayable is
  // not coachable → not_found.
  const scoreRecord = await logic.findCompetitiveScore(replayHash, deps.database);
  const reduced = await logic.reduceReplayByHash(replayHash, deps.database);
  if (reduced === null) {
    return { ok: false, reason: 'not_found' };
  }

  let summary: CoachMatchSummary;
  if (scoreRecord === null) {
    const casual = await prepareCasualCoachSummary(reduced, replayHash, deps, logic);
    if ('refusal' in casual) {
      return { ok: false, reason: casual.refusal };
    }
    summary = casual.summary;
  } else {
    summary = await prepareScoredCoachSummary(reduced, scoreRecord, replayHash, deps, logic);
  }

  return generateAndCacheReport(accountId, replayHash, summary, reduced, deps, logic);
}

/**
 * Generate (or return the cached) coaching for a finished match identified by its
 * boardgame.io id (WP-751 / D-24576) — the entry for a casual match, whose client
 * never receives a replay hash. Pass gate → resolve the match to its replay
 * (capturing on demand) → `generateOrGetCoachReport`, which rechecks the Pass and
 * then checks ownership.
 *
 * @param accountId The authenticated caller.
 * @param matchId The finished match's boardgame.io id.
 * @param deps The injected model client + card-name resolver + database.
 * @param logic Test-only injection seam for the DB-backed reads/writes.
 * @returns The typed coach result.
 */
export async function generateOrGetCoachReportForMatch(
  accountId: AccountId,
  matchId: string,
  deps: CoachDependencies,
  logic: CoachLogic = PRODUCTION_COACH_LOGIC,
): Promise<CoachResult> {
  // why: the Pass gate runs BEFORE the match is resolved, so a caller without the
  // Pass causes no capture writes and no replay reduction.
  const hasPass = await hasLegendaryPass(accountId, deps.database, logic);
  if (!hasPass) {
    return { ok: false, reason: 'not_entitled' };
  }

  const replayHash = await logic.captureMatchForCoach(matchId, deps.database);
  if (replayHash === null) {
    return { ok: false, reason: 'not_found' };
  }

  return generateOrGetCoachReport(accountId, replayHash, deps, logic);
}

/**
 * Builds the summary for a scored match from its stored breakdown (the WP-594
 * path, unchanged by WP-751).
 *
 * @param reduced The reduced replay (final state + hash + turn count).
 * @param scoreRecord The match's stored competitive score.
 * @param replayHash The match's replay hash.
 * @param deps Coach dependencies (database + resolveCardName).
 * @param logic The injectable seam (for the bot-seat lookup).
 * @returns The scored coach summary.
 */
async function prepareScoredCoachSummary(
  reduced: MatchReplayResult,
  scoreRecord: CompetitiveScoreRecord,
  replayHash: string,
  deps: CoachDependencies,
  logic: CoachLogic,
): Promise<CoachMatchSummary> {
  // why: the true match outcome comes from evaluateEndgame over the reduced state
  // — the only source that distinguishes a `tie` (a deck ran out with no winner)
  // from a win/loss. Wrapped so a malformed/partial reduced state can never break
  // the coach: on any evaluation miss we fall back to the breakdown's matchLost
  // flag (scheme-wins vs heroes-win), which is what the summary used before.
  let outcome: CoachMatchSummary['outcome'];
  try {
    outcome =
      evaluateEndgame(reduced.finalState)?.outcome ??
      (scoreRecord.scoreBreakdown.inputs.matchLost === true ? 'scheme-wins' : 'heroes-win');
  } catch {
    outcome =
      scoreRecord.scoreBreakdown.inputs.matchLost === true ? 'scheme-wins' : 'heroes-win';
  }

  const botSeatIds = await readBotSeatIdsBestEffort(replayHash, deps, logic);

  return buildCoachMatchSummary(
    reduced.finalState,
    scoreRecord.scoreBreakdown,
    outcome,
    deps.resolveCardName,
    botSeatIds,
  );
}

/**
 * Builds the summary for a casual (unscored) match from the scoring inputs derived
 * from its replay (WP-751 / D-24576), or refuses with `not_found`.
 *
 * why: the PAR-free path. It reads no PAR artifact and computes no score (NG-1);
 * the summary carries no score, grade or expected adversity. Both engine calls sit
 * in ONE try/catch so a malformed reduced state can never 500 the coach — it is
 * simply not coachable.
 *
 * @param reduced The reduced replay (final state + hash + turn count).
 * @param replayHash The match's replay hash.
 * @param deps Coach dependencies (database + resolveCardName).
 * @param logic The injectable seam (for the bot-seat lookup).
 * @returns `{ summary }`, or `{ refusal: 'not_found' }` for an early-ended or
 *   unevaluable match.
 */
async function prepareCasualCoachSummary(
  reduced: MatchReplayResult,
  replayHash: string,
  deps: CoachDependencies,
  logic: CoachLogic,
): Promise<{ summary: CoachMatchSummary } | { refusal: 'not_found' }> {
  let outcome: CoachMatchSummary['outcome'];
  let inputs: ScoringInputs;
  try {
    const evaluation = evaluateEndgame(reduced.finalState);
    // why: WP-502 / D-24306 — a match the players ended early is never a result, so
    // it is never coached; a null evaluation means the match did not finish normally.
    if (evaluation === null || evaluation.endedEarly === true) {
      return { refusal: 'not_found' };
    }
    outcome = evaluation.outcome;
    const replayView: ReplayResult = {
      finalState: reduced.finalState,
      stateHash: reduced.stateHash,
      turnCount: reduced.turnCount,
    };
    inputs = deriveScoringInputs(replayView, reduced.finalState);
  } catch (caughtError) {
    console.warn(
      '[coach] Casual summary could not be derived for replay ' +
        replayHash +
        '; returning not_found. Underlying error: ' +
        (caughtError instanceof Error ? caughtError.message : String(caughtError)),
    );
    return { refusal: 'not_found' };
  }

  const botSeatIds = await readBotSeatIdsBestEffort(replayHash, deps, logic);

  return {
    summary: buildCasualCoachMatchSummary(
      reduced.finalState,
      inputs,
      outcome,
      deps.resolveCardName,
      botSeatIds,
    ),
  };
}

/**
 * Reads the match's bot-ally seat ids, or `[]` on any failure (WP-742 / D-24564).
 *
 * why: the bot-ally marker is advisory; a failed lookup must never turn a paid
 * report into coach_unavailable (the WP-710 best-effort precedent), so any error
 * yields no markers and one warning.
 *
 * @param replayHash The match's replay hash.
 * @param deps Coach dependencies (database).
 * @param logic The injectable seam (for `readBotSeatIdsForReplay`).
 * @returns The bot seat ids, or `[]`.
 */
async function readBotSeatIdsBestEffort(
  replayHash: string,
  deps: CoachDependencies,
  logic: CoachLogic,
): Promise<string[]> {
  try {
    return await logic.readBotSeatIdsForReplay(replayHash, deps.database);
  } catch (caughtError) {
    console.warn(
      '[coach] Bot-seat lookup failed for replay ' +
        replayHash +
        '; coaching without bot markers. Underlying error: ' +
        (caughtError instanceof Error ? caughtError.message : String(caughtError)),
    );
    return [];
  }
}

/**
 * Calls the model with the summary, merges the deterministic sequence tips and
 * Table Cooperation lines, and caches the report. Shared by the scored and casual
 * paths.
 *
 * @param accountId The caller (recorded on the cache row).
 * @param replayHash The match's replay hash (the cache key).
 * @param summary The match summary handed to the model.
 * @param reduced The reduced replay (for the sequence teacher).
 * @param deps Coach dependencies.
 * @param logic The injectable seam.
 * @returns The fresh report, or `coach_unavailable` when the model call fails.
 */
async function generateAndCacheReport(
  accountId: AccountId,
  replayHash: string,
  summary: CoachMatchSummary,
  reduced: MatchReplayResult,
  deps: CoachDependencies,
  logic: CoachLogic,
): Promise<CoachResult> {
  // Model call — fail-soft: any transport/parse/shape failure returns
  // coach_unavailable (retriable) rather than throwing, so the endgame card is
  // never blocked.
  let report;
  try {
    report = await deps.modelClient.generate(summary);
  } catch (caughtError) {
    console.warn(
      '[coach] Model generation failed for replay ' +
        replayHash +
        '; returning coach_unavailable (the endgame card is unaffected). Underlying error: ' +
        (caughtError instanceof Error ? caughtError.message : String(caughtError)),
    );
    return { ok: false, reason: 'coach_unavailable' };
  }

  // why: WP-710 / D-24533 — compute the deterministic play-order "opportunity" tips
  // server-side and merge them onto the report BEFORE persistence, so they ride the
  // persisted/served CoachReport jsonb blob (and the cache-hit path serves them). NOT
  // model-authored. Best-effort: any teacher failure yields no tips, never blocks the coach.
  const sequenceTips = await computeSequenceTipsForReplay(replayHash, reduced.finalState, deps, logic);

  // why: WP-717 / D-24540 — compute the deterministic, celebration-only Table Cooperation
  // recognition from the already-built summary (a pure derivation — no model, no replay
  // read) and merge it onto the report BEFORE persistence, so it rides the persisted/served
  // CoachReport blob and the cache-hit path serves it. Every multi-seat match is cooperative.
  const tableCooperation = computeTableCooperation(summary);
  const reportWithTips = { ...report, sequenceTips, tableCooperation };

  const stored = await logic.writeCoachReport(
    replayHash,
    accountId,
    deps.modelClient.model,
    reportWithTips,
    deps.database,
  );
  return { ok: true, report: stored, wasCached: false };
}

/**
 * Computes the WP-710 play-order sequence-teacher tips for a replay, or `[]`
 * (WP-710 / D-24533).
 *
 * why: re-reads the raw `{ initialState, log }` and runs the single capturing fold
 * (`reduceMatchCapturingHeroPlays`) to recover each hero play's real `inPlay`, then the
 * pure `computeSequenceTips`. Guarded — a missing artifact or any fold/compute error
 * yields no tips, so the coach report is never blocked by the teacher.
 *
 * @param replayHash - The match's replay hash.
 * @param finalState - The reduced final state (supplies the setup-static card data).
 * @param deps - Coach dependencies (database + resolveCardName).
 * @param logic - The injectable seam (for `readReplayArtifactByHash`).
 * @returns The tips, or `[]`.
 */
async function computeSequenceTipsForReplay(
  replayHash: string,
  finalState: Parameters<typeof computeSequenceTips>[1],
  deps: CoachDependencies,
  logic: CoachLogic,
): Promise<readonly string[]> {
  try {
    const artifact = await logic.readReplayArtifactByHash(replayHash, deps.database);
    if (artifact === null) {
      return [];
    }
    const { heroPlays } = reduceMatchCapturingHeroPlays(artifact);
    return computeSequenceTips(heroPlays, finalState, deps.resolveCardName);
  } catch (caughtError) {
    console.warn(
      '[coach] Sequence-teacher computation failed for replay ' +
        replayHash +
        '; returning no tips (the coach report is unaffected). Underlying error: ' +
        (caughtError instanceof Error ? caughtError.message : String(caughtError)),
    );
    return [];
  }
}
