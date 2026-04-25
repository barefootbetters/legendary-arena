/**
 * Replay Ownership Types — Server Layer (WP-052)
 *
 * Durable contracts for replay ownership metadata. Replay content is
 * never stored here — ownership references the cryptographic hash
 * produced by `computeStateHash` in `packages/game-engine/src/replay/
 * replay.hash.ts` (WP-027), the owning account's `AccountId`, the
 * scenario key, and visibility / retention bookkeeping.
 *
 * This module belongs to the server layer only. It must not be
 * imported from any package on the engine / registry / preplan / UI
 * chain. See `identity.types.ts` for the layer-boundary rationale.
 *
 * Authority: WP-052 §Scope B; D-5203 (identity persistence taxonomy);
 * docs/13-REPLAYS-REFERENCE.md §Privacy and Consent Controls;
 * §Storage and Access Architecture.
 */

import type { AccountId } from './identity.types.js';

/**
 * Visibility states for an owned replay. `private` means only the
 * owning account can view; `link` means anyone with the replay URL
 * can view (unlisted); `public` means the replay is discoverable
 * (e.g., listed on a profile page or community board). Default at
 * insertion is `'private'` per
 * 13-REPLAYS-REFERENCE.md §Privacy and Consent Controls.
 */
export type ReplayVisibility = 'private' | 'link' | 'public';

/**
 * Canonical readonly array mirroring the `ReplayVisibility` union.
 * Drift-detection test in `replayOwnership.logic.test.ts` asserts
 * forward and backward inclusion. Adding a value requires updating
 * both the union and this array in the same change.
 */
export const REPLAY_VISIBILITY_VALUES: readonly ReplayVisibility[] = [
  'private',
  'link',
  'public',
] as const;

/**
 * Replay ownership record. One row per (account, replay-hash) pair;
 * the underlying `legendary.replay_ownership` table enforces this
 * via `UNIQUE (player_id, replay_hash)`. `assignReplayOwnership`
 * relies on the unique constraint for race-safe idempotency.
 *
 * `Object.keys(record).sort()` MUST equal
 * `['accountId','createdAt','expiresAt','ownershipId','replayHash','scenarioKey','visibility']`.
 */
export interface ReplayOwnershipRecord {
  readonly ownershipId: number;
  readonly accountId: AccountId;
  // why: replayHash is a plain `string` (not branded). It carries the
  // cryptographic hash from WP-027's computeStateHash, which returns
  // string. A future WP may brand this hash; no branding is
  // introduced here to avoid premature widening (copilot finding #21
  // disposition).
  readonly replayHash: string;
  readonly scenarioKey: string;
  // why: visibility is the policy bit consumed by leaderboard /
  // profile / sharing surfaces; ownership lookup itself never
  // enforces visibility — `findReplayOwnership` returns metadata
  // only, and callers are responsible for access decisions. This
  // separation prevents lookup-versus-policy coupling and avoids
  // policy leaks at non-leaderboard call sites.
  readonly visibility: ReplayVisibility;
  readonly createdAt: string;
  // why: expiresAt is `string | null` (not optional `?:`) per
  // exactOptionalPropertyTypes. `null` means "indefinite retention"
  // (Supporter tier); a non-null ISO 8601 timestamp means the server
  // may purge after this date. Read-time enforcement in
  // listAccountReplays excludes expired rows even before any
  // background purge job runs.
  readonly expiresAt: string | null;
}

/**
 * Retention policy parameters for newly assigned replays. The MVP
 * uses `DEFAULT_RETENTION_POLICY` for every account; future WPs
 * will introduce per-account policies (Supporter tier extends
 * retention without altering competitive integrity per
 * `01-VISION.md §Financial Sustainability`).
 */
export interface ReplayRetentionPolicy {
  readonly minimumDays: number;
  readonly defaultDays: number;
  readonly extendedDays: number | null;
}

// why: minimumDays is 30 per 13-REPLAYS-REFERENCE.md §Storage.
// Extended retention (Supporter tier) is convenience only, never a
// gameplay advantage (per 01-VISION.md §Financial Sustainability);
// the policy here is storage-eligibility only and never affects
// competitive ranking.
// why: ownership records are immutable except for `visibility`;
// retention is enforced at read time by `listAccountReplays` and
// at write time by `computeExpiresAt`. The retention policy lives
// in code rather than the DB so the application can audit and
// override it without a schema migration.
/**
 * Default retention policy applied to newly assigned replays. 90 days
 * meets the published minimum of 30 with margin; `extendedDays` is
 * `null` (no extension) until a per-account override is wired in a
 * future WP.
 */
export const DEFAULT_RETENTION_POLICY: ReplayRetentionPolicy = {
  minimumDays: 30,
  defaultDays: 90,
  extendedDays: null,
};
