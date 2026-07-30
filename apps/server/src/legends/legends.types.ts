/**
 * Legends Snapshot Publisher — Type Definitions (WP-142)
 *
 * Durable contracts for the public, no-auth JSON leaderboard snapshots
 * written to R2 on a 5-minute cadence. These types define the snapshot
 * payload shape, manifest shape, and publish-result shape. The publisher
 * consumes existing leaderboard logic outputs and projects them to the
 * public snapshot schema (handle + score + rank + minimal per-board
 * context). No PII beyond the already-public player handle.
 *
 * Authority: WP-142; D-14201..D-14207; EC-157 §Locked Values.
 */

// ---------------------------------------------------------------------------
// Snapshot entry types — fixed property order for deterministic JSON
// ---------------------------------------------------------------------------

/**
 * A single row in a global-top snapshot board. Property order is fixed
 * for deterministic JSON.stringify output (byte-identical across runs).
 */
export interface GlobalTopSnapshotEntry {
  readonly handle: string;
  readonly rank: number;
  readonly scenarioKey: string;
  readonly score: number;
}

/**
 * A single row in a per-scenario snapshot board. Property order is fixed
 * for deterministic JSON.stringify output.
 */
export interface ScenarioSnapshotEntry {
  readonly handle: string;
  readonly rank: number;
  readonly score: number;
}

/**
 * A single row in a gauntlet snapshot board (WP-342 / D-24131). Property
 * order is fixed for deterministic JSON.stringify output. Scores are on
 * the PAR golf scale (lower is better); `averageScoreCentis` is the
 * integer centesimal average of the best-per-leg scores (display layers
 * divide by 100).
 */
export interface GauntletSnapshotEntry {
  readonly handle: string;
  readonly rank: number;
  readonly totalScore: number;
  readonly legCount: number;
  readonly averageScoreCentis: number;
  // why: additive (WP-344 / D-24134 §4) — the full team roster's display
  // names, handle-ASC; `handle` equals `players[0]` so pre-WP-345 renderers
  // degrade sanely. Solo boards carry a one-element roster.
  readonly players: readonly string[];
}

/**
 * A single row in a fixed-hero-pool gauntlet snapshot board
 * (WP-384 / D-24187). The open-entry fields plus the hero pool the
 * championship was earned with. Property order is fixed for
 * deterministic JSON.stringify output.
 */
export interface GauntletFixedSnapshotEntry {
  readonly handle: string;
  readonly rank: number;
  readonly totalScore: number;
  readonly legCount: number;
  readonly averageScoreCentis: number;
  readonly players: readonly string[];
  // why: D-24187 §6 — the union of set-qualified hero ids across the
  // entry's chosen legs, sorted ASC: the team the champion is celebrated
  // for. Its size is ≤ the board's pool budget by construction.
  readonly heroPool: readonly string[];
}

/**
 * One leg of a gauntlet as published on the index (WP-344 / D-24134 §5) —
 * the data the client's per-leg challenge links and leg display need.
 * `schemeName` is the registry's display name; `schemeSlug` combines with
 * the gauntlet's `setAbbr` into the set-qualified id the challenge URL
 * carries.
 */
export interface GauntletIndexLeg {
  readonly schemeSlug: string;
  readonly schemeName: string;
}

/**
 * Complete-entry counts per player count for one gauntlet
 * (WP-344 / D-24134 §5). Keys are the stringified player counts 1-5 in
 * fixed order for deterministic JSON.
 */
export type GauntletEntryCounts = Readonly<
  Record<'1' | '2' | '3' | '4' | '5', number>
>;

/**
 * One row of the gauntlet index artifact — every catalog gauntlet appears
 * here (including `entryCount: 0` "unclaimed" boards, which get NO board
 * file per D-24131 §7). `board` is the snapshot stem, e.g.
 * `gauntlet-core-dr-doom`.
 */
/**
 * One approved configuration as the board publishes it (WP-395 / D-24199):
 * the set-qualified group ids a player must configure to have their run count.
 */
export interface GauntletIndexApprovedLoadout {
  readonly villainGroupIds: readonly string[];
  readonly henchmanGroupIds: readonly string[];
}

/**
 * The approved configurations for one gauntlet, keyed by player count as a
 * string (JSON object keys are always strings on the wire).
 */
export type GauntletIndexApprovedLoadouts = Readonly<
  Record<string, readonly GauntletIndexApprovedLoadout[]>
>;

export interface GauntletIndexEntry {
  readonly setAbbr: string;
  readonly setName: string;
  readonly mastermindSlug: string;
  readonly mastermindName: string;
  readonly legCount: number;
  // why: `entryCount` predates the player-count dimension and now reports
  // the SOLO board's complete-entry count (WP-344 / D-24134 §5) — the
  // deployed WP-343 index renders it unchanged; per-count detail lives in
  // the additive `entryCounts`.
  readonly entryCount: number;
  readonly board: string;
  readonly entryCounts: GauntletEntryCounts;
  // why: additive (WP-384 / D-24187 §6) — complete-entry counts per player
  // count for the fixed-hero-pool division; the client's fixed claim chips
  // and division-tab gating read these. Fixed boards are lazy files
  // (`<board>-fixed[-p<N>]`), so zero counts mean "unclaimed", not "missing".
  readonly fixedEntryCounts: GauntletEntryCounts;
  readonly legs: readonly GauntletIndexLeg[];
  // why: WP-395 / D-24199 — the approved villain + henchmen configurations a
  // leg must be played with, keyed by player count. Published so the board and
  // the challenge link can SHOW the requirement; a qualification rule the
  // player cannot see reads as a broken feature (D-24186 / D-24190). Optional
  // so a pre-WP-395 snapshot still parses.
  readonly approvedLoadouts?: GauntletIndexApprovedLoadouts;
}

/**
 * A named group in a set's roster with no coverage flag (WP-461): a mastermind
 * or a scheme, where `slug`/`name` are the registry's canonical fields. Every
 * mastermind is a gauntlet and every scheme is a leg of every gauntlet, so these
 * are covered by construction and need no per-group coverage flag.
 */
export interface SetNamedGroup {
  readonly slug: string;
  readonly name: string;
}

/**
 * A villain or henchman group in a set's roster with its gauntlet-coverage flag
 * (WP-461). `usedByGauntlets` is PER-SET-SCOPED: true iff this group's
 * set-qualified id (`${setAbbr}/${slug}`) appears in at least one approved
 * configuration of one of THIS set's own masterminds at any player count — i.e.
 * completing this set's gauntlet challenge would fight it. A group in the set but
 * in no approved config of the set's masterminds is `false` (the transparency the
 * WP-462 reveal surfaces).
 */
export interface SetAdversaryGroup {
  readonly slug: string;
  readonly name: string;
  readonly usedByGauntlets: boolean;
}

/**
 * The full per-set roster the legends board's "Show set details" reveal renders
 * (WP-461 / D-24279): every mastermind, scheme, villain group, and henchman group
 * a set ships, with villains/henchmen carrying the per-set gauntlet-coverage flag.
 * Property order is fixed for deterministic JSON.
 */
export interface SetDetails {
  readonly setAbbr: string;
  readonly setName: string;
  readonly masterminds: readonly SetNamedGroup[];
  readonly schemes: readonly SetNamedGroup[];
  readonly villains: readonly SetAdversaryGroup[];
  readonly henchmen: readonly SetAdversaryGroup[];
}

/**
 * The gauntlet index artifact written to `legends/v1/gauntlet-index.json`
 * whenever a gauntlet catalog is provided to the publisher.
 */
export interface GauntletIndexSnapshot {
  readonly gauntlets: readonly GauntletIndexEntry[];
  // why: WP-461 / D-24279 — additive optional per-set rosters (masterminds/
  // schemes/villains/henchmen with per-set villain/henchman coverage flags) so
  // the board can render a "Show set details" reveal. Optional so a pre-WP-461
  // consumer ignores it and an old snapshot still parses.
  readonly sets?: readonly SetDetails[];
  readonly generatedAt: string;
  readonly schemaVersion: 1;
}

// ---------------------------------------------------------------------------
// Board snapshot envelope
// ---------------------------------------------------------------------------

/**
 * A single board snapshot written to R2 at `legends/v1/<board>.json`.
 * The `entries` array is sorted by rank ASC, handle ASC.
 */
export interface LegendsSnapshotBoard<
  TEntry extends GlobalTopSnapshotEntry | ScenarioSnapshotEntry,
> {
  readonly board: string;
  readonly entries: readonly TEntry[];
  readonly rowCount: number;
  readonly schemaVersion: 1;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/**
 * Manifest written to `legends/v1/manifest.json` as the transactional
 * commit point. Consumers reading a stale manifest see a consistent
 * prior snapshot, never a half-written one. Per D-14204.
 */
export interface LegendsManifest {
  readonly boards: readonly string[];
  readonly generatedAt: string;
  readonly schemaVersion: 1;
  // why: additive optional fields (WP-342 / D-24131 §7) — present only when
  // the publisher runs with a gauntlet catalog. `boards[]` and
  // `schemaVersion` are byte-compatible with pre-WP-342 consumers; the
  // deployed SPA ignores unknown fields until its gauntlet WP lands.
  readonly gauntletBoards?: readonly string[];
  readonly gauntletIndex?: string;
}

// ---------------------------------------------------------------------------
// Publish result
// ---------------------------------------------------------------------------

/**
 * Outcome of publishing a single board to R2.
 */
export interface BoardPublishOutcome {
  readonly board: string;
  readonly byteCount: number;
  readonly putLatencyMs: number;
  readonly rowCount: number;
  readonly success: boolean;
  readonly errorMessage?: string;
}

/**
 * Aggregate result of a single `publishAllBoards` run.
 */
export interface PublishResult {
  readonly boards: readonly BoardPublishOutcome[];
  readonly manifestWritten: boolean;
  readonly runId: string;
}

// ---------------------------------------------------------------------------
// Health state
// ---------------------------------------------------------------------------

/**
 * Health state exposed by `GET /health/legends-publisher`. Replaced
 * atomically via `state = { ... }` (never field-by-field mutation).
 */
export interface LegendsPublisherHealthState {
  readonly intervalMs: number;
  readonly lastErrorAt: string | null;
  readonly lastErrorMessage: string | null;
  readonly lastSuccessAt: string | null;
  readonly status: 'error' | 'idle' | 'ok';
}

// ---------------------------------------------------------------------------
// R2 client interface (subset of S3Client used by the publisher)
// ---------------------------------------------------------------------------

/**
 * Minimal R2 client interface consumed by the publisher. Production
 * code passes the real `S3Client`; tests pass a stub.
 */
export interface LegendsR2Client {
  readonly putObject: (params: {
    readonly body: string;
    readonly bucket: string;
    readonly contentType: string;
    readonly key: string;
    readonly signal: AbortSignal;
  }) => Promise<void>;
}
