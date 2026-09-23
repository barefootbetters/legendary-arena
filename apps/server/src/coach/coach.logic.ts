/**
 * Endgame AI Coach — Orchestrator (WP-594 / EC-629 / D-24403)
 *
 * `generateOrGetCoachReport` runs the WP-594 pipeline: entitlement gate (the
 * Legendary Pass) → ownership check → cache read → (on miss) assemble summary →
 * call the model → cache → return. Lazy + cached: the paid model runs at most
 * once per match; every later view is a cache hit. Fail-soft: a model failure
 * returns `coach_unavailable`, never blocks the endgame card (D-24403).
 *
 * Every external surface — entitlements, ownership, score, replay reduction,
 * cache read/write — is reached through the injectable `CoachLogic` seam
 * (mirroring WP-115's `LeaderboardLogic`), and the model client is injected via
 * `CoachDependencies`. So the whole pipeline is unit-testable with fakes: the
 * test suite touches NO real database and makes ZERO paid calls.
 *
 * Layer-boundary contract: same-layer server imports only (entitlements,
 * identity/replayOwnership, competition, replay). Engine imports are type-only
 * (via the summary assembler). No `boardgame.io`, registry, or UI import.
 *
 * Authority: WP-594 §Contract; EC-629; D-24403.
 */

import { evaluateEndgame } from '@legendary-arena/game-engine';

import { getEntitlementsForAccount } from '../entitlements/entitlements.logic.js';
import { findReplayOwnershipForAccount } from '../identity/replayOwnership.logic.js';
import { findCompetitiveScore } from '../competition/competition.logic.js';
import {
  reduceReplayByHash,
  readReplayArtifactByHash,
  reduceMatchCapturingHeroPlays,
  readMatchIdByReplayHash,
} from '../replay/matchReplay.logic.js';
import { readMatchBotSeats } from '../match/seatAccount.logic.js';
import { readCoachReport, writeCoachReport } from './coachReport.persistence.js';
import { buildCoachMatchSummary } from './coachSummary.logic.js';
import { computeSequenceTips } from './sequenceTeacher.logic.js';
import { computeTableCooperation } from './tableCooperation.logic.js';

import type { AccountId, DatabaseClient } from '../identity/identity.types.js';
import type { CoachDependencies, CoachResult } from './coach.types.js';

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

const PRODUCTION_COACH_LOGIC: CoachLogic = {
  getEntitlementsForAccount,
  findReplayOwnershipForAccount,
  findCompetitiveScore,
  reduceReplayByHash,
  readCoachReport,
  writeCoachReport,
  readReplayArtifactByHash,
  readBotSeatIdsForReplay,
};

/**
 * Generate (or return the cached) endgame coaching for a scored match the caller
 * owns. Never throws for an expected failure — every outcome is a typed
 * `CoachResult`. Only an unexpected infrastructure fault propagates.
 *
 * @param accountId The authenticated caller (must hold the Legendary Pass + own the replay).
 * @param replayHash The scored match's replay hash.
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
  // Gate 1 — Legendary Pass entitlement. A lookup failure OR a missing Pass key
  // both mean "no access"; the read failure is not distinguished from absence to
  // avoid leaking entitlement-table state to the caller.
  const entitlements = await logic.getEntitlementsForAccount(accountId, deps.database);
  const hasPass =
    entitlements.ok === true &&
    entitlements.value.some((entitlement) => entitlement.entitlementKey === LEGENDARY_PASS_KEY);
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

  // The coach needs the stored score breakdown (the summary's numbers) and the
  // reduced final state (loadout + acquired cards). A match owned but not scored,
  // or not replayable, is not coachable → not_found.
  const scoreRecord = await logic.findCompetitiveScore(replayHash, deps.database);
  if (scoreRecord === null) {
    return { ok: false, reason: 'not_found' };
  }
  const reduced = await logic.reduceReplayByHash(replayHash, deps.database);
  if (reduced === null) {
    return { ok: false, reason: 'not_found' };
  }

  // why: the true match outcome comes from evaluateEndgame over the reduced state
  // — the only source that distinguishes a `tie` (a deck ran out with no winner)
  // from a win/loss. Wrapped so a malformed/partial reduced state can never break
  // the coach: on any evaluation miss we fall back to the breakdown's matchLost
  // flag (scheme-wins vs heroes-win), which is what the summary used before.
  let outcome: Parameters<typeof buildCoachMatchSummary>[2];
  try {
    outcome =
      evaluateEndgame(reduced.finalState)?.outcome ??
      (scoreRecord.scoreBreakdown.inputs.matchLost === true ? 'scheme-wins' : 'heroes-win');
  } catch {
    outcome =
      scoreRecord.scoreBreakdown.inputs.matchLost === true ? 'scheme-wins' : 'heroes-win';
  }

  // why: WP-742 / D-24564 — the bot-ally marker is advisory; a failed lookup must
  // never turn a paid report into coach_unavailable (the WP-710 best-effort
  // precedent), so any error yields no markers and one warning.
  let botSeatIds: string[];
  try {
    botSeatIds = await logic.readBotSeatIdsForReplay(replayHash, deps.database);
  } catch (caughtError) {
    console.warn(
      '[coach] Bot-seat lookup failed for replay ' +
        replayHash +
        '; coaching without bot markers. Underlying error: ' +
        (caughtError instanceof Error ? caughtError.message : String(caughtError)),
    );
    botSeatIds = [];
  }

  const summary = buildCoachMatchSummary(
    reduced.finalState,
    scoreRecord.scoreBreakdown,
    outcome,
    deps.resolveCardName,
    botSeatIds,
  );

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
