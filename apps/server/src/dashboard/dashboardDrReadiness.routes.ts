/**
 * Dashboard DR Readiness — Routes (WP-517 / EC-552)
 *
 * Registers one read-only, `admin-session-required` GET on the `/api/dash/*`
 * surface, backing the dashboard's DR-readiness ops tile:
 *
 *   * GET /api/dash/dr-readiness → DrReadiness  (drill posture from GitHub issues)
 *
 * Mirrors the `dashboardRuntime` idiom exactly: `Cache-Control: no-store` first
 * (D-11504), `requireAdminSession` (WP-159) gate, bare `{ data: T }` body
 * (D-20503). The pool is passed only so the admin gate can look up the session's
 * account — the projection reads NO database and NO registry; it reads the
 * `DR drill due — <Month> <Year>` issues over the GitHub REST API.
 *
 * Mock-first (D-24330): with no/invalid `DASH_GITHUB_TOKEN` — or on any GitHub
 * fetch failure — the route serves the mock payload with `200`, never a `500`.
 * The heavy lifting (issues → readiness) is the PURE `deriveDrReadiness`; this
 * module only supplies the wall clock, the token/repo, the fetch, and a short
 * in-process cache.
 *
 * Authority: WP-517 §Scope/§Contract; EC-552; D-24330; D-20503; D-11504; D-15901.
 */

import {
  buildMockDrReadiness,
  deriveDrReadiness,
} from './dashboardDrReadiness.logic.js';
import type {
  DashboardDrReadinessRouteDependencies,
  DatabaseClient,
  DrReadiness,
  DrillIssue,
} from './dashboardDrReadiness.types.js';
import type { RequireAuthenticatedSessionOptions } from '../auth/sessionToken.types.js';

/** Minimal structural Koa context surface this handler touches. */
interface KoaDashboardContext {
  readonly req: Parameters<
    DashboardDrReadinessRouteDependencies['requireAdminSession']
  >[0];
  set(field: string, value: string): void;
  status: number;
  body: unknown;
}

interface KoaRouter {
  get(
    path: string,
    handler: (koaContext: KoaDashboardContext) => Promise<void> | void,
  ): unknown;
}

/**
 * In-process cache TTL. why: the GitHub REST API rate-limits (5000 req/hr
 * authenticated), and this admin tile polls per view; caching the derived
 * result for 5 minutes keeps a busy operator session well under the limit
 * while the "overdue / last drill" signal changes at most daily.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Default repository the drill issues live in; overridable via `DASH_GITHUB_REPO`. */
const DEFAULT_GITHUB_REPO = 'barefootbetters/legendary-arena';

/** GitHub REST page size — one page of 100 comfortably covers the drill-issue history. */
const GITHUB_ISSUES_PER_PAGE = 100;

interface CacheEntry {
  readonly data: DrReadiness;
  readonly expiresAtMs: number;
}

/** Module-scoped single-slot cache (one endpoint, no per-caller keying). */
let cacheEntry: CacheEntry | null = null;

/**
 * Read `DASH_GITHUB_TOKEN`, returning `null` when unset or blank. A `null` token
 * routes to the mock-first fallback (`sync:false`, `issues:read` scope expected
 * when present).
 */
function readGithubToken(): string | null {
  const raw = process.env.DASH_GITHUB_TOKEN;
  if (raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Resolve the `owner/repo` coordinate. why: `GITHUB_REPOSITORY` only exists
 * inside GitHub Actions, so the server reads an explicit coordinate — an env
 * override for non-default deployments, else the default constant.
 */
function readRepoCoordinate(): string {
  const raw = process.env.DASH_GITHUB_REPO;
  if (raw === undefined) {
    return DEFAULT_GITHUB_REPO;
  }
  const trimmed = raw.trim();
  return trimmed.length === 0 ? DEFAULT_GITHUB_REPO : trimmed;
}

/** Narrow one raw GitHub issues-endpoint item into the normalized `DrillIssue`. */
function toDrillIssue(rawItem: unknown): DrillIssue {
  const item = rawItem as Record<string, unknown>;
  return {
    title: typeof item.title === 'string' ? item.title : '',
    state: item.state === 'closed' ? 'closed' : 'open',
    body: typeof item.body === 'string' ? item.body : null,
    closedAt: typeof item.closed_at === 'string' ? item.closed_at : null,
    // why: GitHub's issues endpoint returns pull requests too (each carries a
    // `pull_request` member); flag them so the pure derivation excludes them.
    isPullRequest: item.pull_request !== undefined && item.pull_request !== null,
  };
}

/**
 * Fetch the repo's issues (open + closed) over the GitHub REST API and map them
 * to `DrillIssue[]`. Throws on a non-2xx response or a non-array body — the
 * caller converts any throw into the mock-first fallback.
 */
async function fetchDrillIssues(token: string): Promise<DrillIssue[]> {
  const repo = readRepoCoordinate();
  const url = `https://api.github.com/repos/${repo}/issues?state=all&per_page=${GITHUB_ISSUES_PER_PAGE}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'legendary-arena-dashboard',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub issues fetch failed with status ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('GitHub issues response was not an array');
  }
  return payload.map(toDrillIssue);
}

/**
 * Resolve the current `DrReadiness`, honoring the mock-first contract and the
 * in-process cache. Never throws — every failure mode degrades to the mock
 * payload so the route returns `200`.
 */
async function loadDrReadiness(referenceDate: Date): Promise<DrReadiness> {
  const token = readGithubToken();
  if (token === null) {
    // why: mock-first (D-24330) — a missing/blank token is the normal state
    // in local/dev/preview; serve the mock payload with 200, never an error,
    // so the tile always renders.
    return buildMockDrReadiness(referenceDate);
  }

  if (cacheEntry !== null && Date.now() < cacheEntry.expiresAtMs) {
    return cacheEntry.data;
  }

  try {
    const issues = await fetchDrillIssues(token);
    const data = deriveDrReadiness(issues, referenceDate);
    cacheEntry = { data, expiresAtMs: Date.now() + CACHE_TTL_MS };
    return data;
  } catch (fetchError) {
    void fetchError;
    // why: an invalid token or a GitHub outage must NOT 500 the admin tile —
    // degrade to the same mock payload as the no-token path (mock-first).
    return buildMockDrReadiness(referenceDate);
  }
}

/**
 * Run the admin gate. Returns `true` for an authenticated admin; otherwise
 * writes the mapped error response and returns `false`. (Byte-for-byte the same
 * three-code mapping as the `dashboardRuntime` gate.)
 */
async function passesAdminGate(
  koaContext: KoaDashboardContext,
  database: DatabaseClient,
  deps: DashboardDrReadinessRouteDependencies,
): Promise<boolean> {
  const authResult = await deps.requireAdminSession(koaContext.req, {
    verifier: deps.verifier,
    accountResolver: deps.accountResolver,
    database: database as unknown as RequireAuthenticatedSessionOptions['database'],
  });
  if (authResult.ok === true) {
    return true;
  }
  if (authResult.code === 'unauthorized') {
    koaContext.status = 401;
    koaContext.body = { code: 'unauthorized', reason: authResult.reason };
    return false;
  }
  if (authResult.code === 'forbidden') {
    koaContext.status = 403;
    koaContext.body = { code: 'forbidden', reason: authResult.reason };
    return false;
  }
  koaContext.status = 500;
  koaContext.body = { code: 'internal_error' };
  return false;
}

/**
 * Register the dashboard DR-readiness route. The router is mutated in place;
 * returns `void`.
 */
export function registerDashboardDrReadinessRoutes(
  router: KoaRouter,
  database: DatabaseClient,
  deps: DashboardDrReadinessRouteDependencies,
): void {
  router.get('/api/dash/dr-readiness', async (koaContext) => {
    koaContext.set('Cache-Control', 'no-store');
    try {
      if ((await passesAdminGate(koaContext, database, deps)) === false) {
        return;
      }
      // why: the ONE clock read for this feed lives here at the route boundary.
      // The wall-clock reference date is captured now and injected into the pure
      // `deriveDrReadiness` / `buildMockDrReadiness`, so the logic never reads a
      // clock and stays unit-testable against a fixed date.
      const referenceDate = new Date();
      const data = await loadDrReadiness(referenceDate);
      koaContext.status = 200;
      koaContext.body = { data };
    } catch (caughtError) {
      void caughtError;
      koaContext.status = 500;
      koaContext.body = { code: 'internal_error' };
    }
  });
}
