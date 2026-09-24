/**
 * Endgame coach composable — Arena Client (WP-595 / EC-630 / D-24404)
 *
 * Drives the endgame coach panel's state: resolves the caller's Legendary-Pass
 * status (via `/api/me/entitlements`) and lazily fetches the coaching report on
 * demand — via `/api/me/scores/:replayHash/coach` (WP-594) for a scored match, or
 * `/api/me/matches/:matchId/coach` (WP-751 / WP-752) for a casual one. Store-free: its
 * dependencies (token getter + the two API fns) are injected, so it is unit-
 * testable without Pinia or a real network. `EndgameCoachPanel.vue` wires the
 * production deps (the auth store token + the real API wrappers).
 *
 * Layer-boundary: talks to the server only through the injected API wrappers;
 * imports no engine/server runtime.
 *
 * Authority: WP-595 §Scope; EC-630; D-24404; WP-752 / EC-789 / D-24576.
 */

import { ref, type Ref } from 'vue';

import type { EntitlementDisplay, BillingApiResult } from '../lib/api/billingApi';
import type { FetchCoachResult, StoredCoachReport } from '../lib/api/coachApi';

// why: the Legendary Pass entitlement key (WP-594 / D-24403). The client checks
// for it by value (it cannot import the server's ENTITLEMENT_KEYS union).
const LEGENDARY_PASS_KEY = 'legendary_pass_2026';

/**
 * Pass access, resolved once on init:
 * - `unknown` — not yet resolved.
 * - `guest` — no auth token (not signed in).
 * - `none` — signed in but without the Legendary Pass (→ locked-teaser upsell).
 * - `has` — signed in with the Legendary Pass (→ the coaching affordance).
 */
export type CoachPassStatus = 'unknown' | 'guest' | 'none' | 'has';

/**
 * The coach-fetch lifecycle:
 * - `idle` — not requested yet.
 * - `loading` — the fetch is in flight.
 * - `ready` — a report is loaded.
 * - `unavailable` — the model call failed server-side (retriable, not an error).
 * - `error` — a non-retriable fetch failure.
 */
export type CoachFetchStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

/**
 * What the coach fetches for: a scored match by its replay hash, or a casual
 * (unscored) match by its boardgame.io id.
 */
// why: WP-752 / D-24576 — an unscored match never gives the client a replay hash
// (the hash rides only on a competitive score record), so a casual match is
// addressed by its match id and the server resolves the replay.
export type CoachTarget =
  | { kind: 'replay'; replayHash: string }
  | { kind: 'match'; matchId: string };

/** Injected dependencies (production values are wired by the panel). */
export interface EndgameCoachDependencies {
  readonly getToken: () => string | null;
  readonly fetchEntitlements: (
    authToken: string | null,
  ) => Promise<BillingApiResult<EntitlementDisplay[]>>;
  readonly fetchCoachReport: (
    authToken: string | null,
    replayHash: string,
  ) => Promise<FetchCoachResult>;
  readonly fetchCoachReportForMatch: (
    authToken: string | null,
    matchId: string,
  ) => Promise<FetchCoachResult>;
}

/** The reactive surface + actions the panel binds to. */
export interface EndgameCoachController {
  readonly passStatus: Ref<CoachPassStatus>;
  readonly coachStatus: Ref<CoachFetchStatus>;
  readonly report: Ref<StoredCoachReport | null>;
  initialize(): Promise<void>;
  requestCoaching(): Promise<void>;
}

/**
 * Create the endgame coach controller for a match.
 *
 * @param target A ref to what to coach (`null` when there is nothing to coach).
 * @param deps The injected token getter + API wrappers.
 * @returns The reactive state + `initialize` / `requestCoaching` actions.
 */
export function useEndgameCoach(
  target: Readonly<Ref<CoachTarget | null>>,
  deps: EndgameCoachDependencies,
): EndgameCoachController {
  const passStatus: Ref<CoachPassStatus> = ref('unknown');
  const coachStatus: Ref<CoachFetchStatus> = ref('idle');
  const report: Ref<StoredCoachReport | null> = ref(null);

  /**
   * Resolve the caller's Pass status once (called on mount). A guest is `guest`;
   * an entitlements read that fails or lacks the Pass key fails closed to `none`
   * (the locked-teaser upsell), never `has`.
   */
  async function initialize(): Promise<void> {
    const token = deps.getToken();
    if (token === null) {
      passStatus.value = 'guest';
      return;
    }
    const result = await deps.fetchEntitlements(token);
    if (
      result.ok === true &&
      result.value.some((entitlement) => entitlement.entitlementKey === LEGENDARY_PASS_KEY)
    ) {
      passStatus.value = 'has';
    } else {
      passStatus.value = 'none';
    }
  }

  /**
   * The id a target is fetched by: its replay hash or its match id.
   *
   * @param currentTarget The coach target.
   * @returns The replay hash (replay target) or match id (match target).
   */
  function targetKey(currentTarget: CoachTarget): string {
    if (currentTarget.kind === 'replay') {
      return currentTarget.replayHash;
    }
    return currentTarget.matchId;
  }

  /**
   * Fetch the report for a target: a replay target through `fetchCoachReport`, a
   * match target through `fetchCoachReportForMatch`.
   *
   * @param currentTarget The coach target.
   * @returns The fetch result (the wrappers never throw).
   */
  function fetchForTarget(currentTarget: CoachTarget): Promise<FetchCoachResult> {
    if (currentTarget.kind === 'replay') {
      return deps.fetchCoachReport(deps.getToken(), currentTarget.replayHash);
    }
    return deps.fetchCoachReportForMatch(deps.getToken(), currentTarget.matchId);
  }

  /**
   * Fetch the coaching report on demand (Pass holders only). A `503` /
   * `coach_unavailable` maps to the retriable `unavailable` state; a
   * server-side `not_entitled` (defensive — should not happen once `has`) drops
   * back to the locked state; any other non-200 is `error`.
   */
  async function requestCoaching(): Promise<void> {
    if (passStatus.value !== 'has') {
      return;
    }
    const currentTarget = target.value;
    if (currentTarget === null || targetKey(currentTarget) === '') {
      return;
    }
    coachStatus.value = 'loading';
    const result = await fetchForTarget(currentTarget);
    if (result.status === 200 && result.report !== null) {
      report.value = result.report;
      coachStatus.value = 'ready';
      return;
    }
    if (result.status === 503 || result.error === 'coach_unavailable') {
      coachStatus.value = 'unavailable';
      return;
    }
    if (result.error === 'not_entitled') {
      passStatus.value = 'none';
      coachStatus.value = 'idle';
      return;
    }
    coachStatus.value = 'error';
  }

  return { passStatus, coachStatus, report, initialize, requestCoaching };
}
