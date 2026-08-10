/**
 * Dashboard DR Readiness — Types (WP-517 / EC-552)
 *
 * Server-side shapes for the `/api/dash/dr-readiness` feed — a read-only,
 * `admin-session-required` projection of the `DR drill due — <Month> <Year>`
 * GitHub issues the `dr-drill-reminder` workflow opens each month (#1298). The
 * feed answers the ops question "are we current on the disaster-recovery drill
 * cadence?" so DR posture is a daily-visible dashboard signal instead of a doc
 * nobody re-reads.
 *
 * The derivation is PURE (`deriveDrReadiness(issues, referenceDate)` in
 * `dashboardDrReadiness.logic.ts`) — the route supplies a normalized
 * `DrillIssue[]` plus an injected wall-clock reference date, and the logic reads
 * no clock and no network. Like `dashboardRuntime.types.ts`, this endpoint reads
 * NO database and NO registry; the pool is threaded only so the admin gate can
 * resolve the session's account.
 *
 * The dashboard has no server import and vice-versa, so the wire shape
 * (`DrReadiness`) is mirrored on the dashboard side in
 * `apps/dashboard/src/services/drReadinessMocks.ts`.
 *
 * Authority: WP-517 §Contract; EC-552 Locked Values; D-24330; D-20503 (bare
 * `{ data: T }` envelope); D-15901 (`admin-session-required`).
 */

import type { AdminSessionResult } from '../auth/adminSession.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import type { DatabaseClient } from './dashboardBilling.types.js';

export type { DatabaseClient };

/**
 * Outcome of the most-recent drill, read from the `- [ ] Drill passed` checkbox
 * on the newest CLOSED drill issue: `pass` (checked), `fail` (present but
 * unchecked), or `unknown` (the checkbox line is absent — an older issue opened
 * before WP-517 added the marker, or a manually-opened issue).
 */
export type DrillResult = 'pass' | 'fail' | 'unknown';

/** The last drill's completion date (UTC `YYYY-MM-DD`) plus its pass/fail result. */
export interface LastDrill {
  /** UTC `YYYY-MM-DD` the drill issue was CLOSED (the drill's completion date). */
  readonly date: string;
  /** Pass/fail read from the newest closed drill issue's `Drill passed` checkbox. */
  readonly result: DrillResult;
}

/** The DR-readiness projection returned in the `{ data }` envelope. */
export interface DrReadiness {
  /** Newest CLOSED drill issue's date + result, or `null` when none has closed yet. */
  readonly lastDrill: LastDrill | null;
  /** The 1st of the next month (UTC `YYYY-MM-DD`), derived from the reference date. */
  readonly nextDue: string;
  /** `true` when an OPEN drill issue's title month is earlier than the reference month. */
  readonly overdue: boolean;
  /**
   * `github` when derived from live drill issues; `mock` when the feed served
   * the mock-first fallback (no/invalid `DASH_GITHUB_TOKEN`, or a GitHub fetch
   * failure). Distinct from the dashboard's `ServiceResponse.source`
   * freshness label — this rides INSIDE `data`.
   */
  readonly source: 'github' | 'mock';
}

/**
 * A drill issue normalized from the GitHub REST issues payload into the minimal
 * fields the pure derivation needs. The route maps each raw GitHub item into
 * this shape (flagging pull requests) so `deriveDrReadiness` stays free of any
 * GitHub-response coupling and is unit-tested with plain fixtures.
 */
export interface DrillIssue {
  /** Issue title, e.g. `DR drill due — August 2026` (em-dash U+2014). */
  readonly title: string;
  /** GitHub issue state. */
  readonly state: 'open' | 'closed';
  /** Issue body (holds the `- [ ] Drill passed` checkbox), or `null` when empty. */
  readonly body: string | null;
  /** ISO-8601 close time, or `null` for an open issue. */
  readonly closedAt: string | null;
  /**
   * `true` when this row is actually a pull request. GitHub's issues endpoint
   * returns PRs too (each carries a `pull_request` member); the derivation
   * excludes them.
   */
  readonly isPullRequest: boolean;
}

/**
 * Caller-injected dependencies for the DR-readiness route. Mirrors
 * `DashboardRuntimeRouteDependencies` — the admin gate needs the session bundle
 * (verifier / accountResolver / database) even though the projection itself
 * reads no database (it reads the drill issues over the GitHub REST API).
 */
export interface DashboardDrReadinessRouteDependencies {
  readonly requireAdminSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<AdminSessionResult>;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
}
