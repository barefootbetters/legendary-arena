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

import { getEntitlementsForAccount } from '../entitlements/entitlements.logic.js';
import { findReplayOwnershipForAccount } from '../identity/replayOwnership.logic.js';
import { findCompetitiveScore } from '../competition/competition.logic.js';
import { reduceReplayByHash } from '../replay/matchReplay.logic.js';
import { readCoachReport, writeCoachReport } from './coachReport.persistence.js';
import { buildCoachMatchSummary } from './coachSummary.logic.js';

import type { AccountId } from '../identity/identity.types.js';
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
}

const PRODUCTION_COACH_LOGIC: CoachLogic = {
  getEntitlementsForAccount,
  findReplayOwnershipForAccount,
  findCompetitiveScore,
  reduceReplayByHash,
  readCoachReport,
  writeCoachReport,
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

  const summary = buildCoachMatchSummary(
    reduced.finalState,
    scoreRecord.scoreBreakdown,
    deps.resolveCardName,
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

  const stored = await logic.writeCoachReport(
    replayHash,
    accountId,
    deps.modelClient.model,
    report,
    deps.database,
  );
  return { ok: true, report: stored, wasCached: false };
}
