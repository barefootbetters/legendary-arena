/**
 * Dashboard Matches + Players + KPIs Endpoints — Types (WP-374 / EC-403)
 *
 * Server-side response shapes for the `/api/dash/{matches,players,kpis}` feeds,
 * **byte-matching** the dashboard's own contract types (`MatchRecord`,
 * `PlayerRecord`, `KpiSnapshot`) so the dashboard's `endpoints.ts` client consumes
 * them unchanged. The dashboard has no server import and vice-versa, so the shapes
 * are mirrored here.
 *
 * **Drift source of truth:** `apps/dashboard/src/types/index.ts`.
 *
 * Authority: WP-374 §Contract; D-24169 (match-summary blob carve-out);
 * D-20503 (bare `{ data: T }` envelope).
 */

import type { CardRegistry } from '@legendary-arena/registry';

import type { AdminSessionResult } from '../auth/adminSession.js';
import type {
  AccountResolver,
  RequireAuthenticatedSessionOptions,
  SessionTokenRequest,
  SessionVerifier,
} from '../auth/sessionToken.types.js';
import type { DatabaseClient } from './dashboardBilling.types.js';

export type { DatabaseClient };

/** One recent match, projected read-only from the `bgio.matches` blob (D-24169). */
export interface MatchRecord {
  readonly id: string;
  readonly startedAt: string;
  readonly duration: number;
  readonly playerCount: number;
  readonly scheme: string;
  readonly mastermind: string;
  readonly outcome: 'villain_wins' | 'hero_wins' | 'in_progress';
}

/** One player row with aggregated competitive-score stats. */
export interface PlayerRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly matchesPlayed: number;
  readonly winRate: number;
  readonly lastActive: string;
  readonly status: 'active' | 'inactive' | 'banned';
}

/** One dashboard KPI with its current + prior-window value and trend. */
export interface KpiSnapshot {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly previousValue: number;
  readonly unit: string;
  readonly trend: 'up' | 'down' | 'flat';
  readonly target?: number;
  readonly tolerance?: number;
  readonly direction?: 'higher-is-better' | 'lower-is-better';
}

/**
 * Caller-injected dependencies for the dashboard gameplay routes. Mirrors the
 * WP-373 `DashboardBillingRouteDependencies` bundle plus the startup `registry`
 * (used to build the ext_id → display-name resolver for `/matches`, the WP-361
 * idiom — a `CardRegistry` **type** only, no engine import).
 */
export interface DashboardGameplayRouteDependencies {
  readonly requireAdminSession: (
    request: SessionTokenRequest,
    options: RequireAuthenticatedSessionOptions,
  ) => Promise<AdminSessionResult>;
  readonly registry: CardRegistry;
  readonly verifier?: SessionVerifier;
  readonly accountResolver?: AccountResolver;
}
