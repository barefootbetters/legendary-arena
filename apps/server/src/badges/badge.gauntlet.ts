/**
 * Gauntlet Champion Badge Issuance — Server Layer (WP-344 / D-24133)
 *
 * Completing a D-24131 set-gauntlet's last leg issues a per-gauntlet
 * badge `gauntlet.<setAbbr>.<mastermindSlug>` ("Dr. Doom Champion —
 * Core Set") through the WP-105 badge pipeline. Issuance is evaluated
 * on every winning submission for the (scheme, mastermind) pairs the
 * catalog maps to gauntlets, and is idempotent by construction: rows
 * carry `source_ref NULL`, so the WP-105 partial unique index
 * `(player_id, badge_key) WHERE source_ref IS NULL` suppresses
 * re-issuance on later wins in an already-complete gauntlet.
 *
 * The gauntlet catalog and the bound PAR gate reach this module by
 * STARTUP REGISTRATION from `server.mjs` (the `setRegistryForSetup`
 * precedent) — never by threading the locked WP-053 submission deps.
 * Unregistered context (tests, tooling) makes issuance a no-op, which
 * is the pre-WP-344 behavior.
 *
 * Layer-boundary contract: server-internal; no engine runtime, no
 * registry, no boardgame.io, no UI imports.
 *
 * Authority: WP-344 §Contract; EC-374 §Locked Values; D-24133; D-1004
 * (tiered issuer); D-5302 (append-only).
 */

import type { DatabaseClient } from '../identity/identity.types.js';
import type { LeaderboardDependencies } from '../leaderboards/leaderboard.types.js';
import type { GauntletDefinition } from '../legends/gauntlet.logic.js';
import { getPlayerGauntletProgress } from '../legends/gauntlet.logic.js';
import type { BadgeDefinition } from './badge.types.js';

// ---------------------------------------------------------------------------
// Startup-registered context
// ---------------------------------------------------------------------------

/** The startup-registered inputs gauntlet issuance needs. */
export interface GauntletBadgeContext {
  readonly catalog: readonly GauntletDefinition[];
  readonly leaderboardDeps: LeaderboardDependencies;
}

// why: module-level registration instead of threading the locked WP-053
// SubmissionDependencies seam — see the module header. Null until the
// wiring layer registers; issuance no-ops while null.
let gauntletBadgeContext: GauntletBadgeContext | null = null;

/**
 * Registers the gauntlet badge context (called once at server startup).
 * Exposed for tests via re-registration; passing the next context
 * replaces the previous one wholesale.
 */
export function registerGauntletBadgeContext(
  context: GauntletBadgeContext | null,
): void {
  gauntletBadgeContext = context;
}

// ---------------------------------------------------------------------------
// Badge key + definitions
// ---------------------------------------------------------------------------

/** The badge key for one gauntlet (locked grammar, EC-374). */
export function buildGauntletBadgeKey(definition: GauntletDefinition): string {
  return `gauntlet.${definition.setAbbr}.${definition.mastermindSlug}`;
}

/**
 * Builds the dynamic badge definitions for every catalog gauntlet, for
 * startup registration via `registerDynamicBadgeDefinitions`.
 */
export function buildGauntletBadgeDefinitions(
  catalog: readonly GauntletDefinition[],
): ReadonlyMap<string, BadgeDefinition> {
  const definitions = new Map<string, BadgeDefinition>();
  for (const gauntletDefinition of catalog) {
    const badgeKey = buildGauntletBadgeKey(gauntletDefinition);
    const legCount = gauntletDefinition.legSchemeSlugs.length;
    definitions.set(badgeKey, {
      badgeKey,
      tier: 1,
      sourceKind: 'competitive_history',
      label: `${gauntletDefinition.mastermindName} Champion — ${gauntletDefinition.setName}`,
      description:
        `Defeated ${gauntletDefinition.mastermindName} under every scheme in ` +
        `${gauntletDefinition.setName} (${legCount} replay-verified wins).`,
    });
  }
  return definitions;
}

// ---------------------------------------------------------------------------
// Issuance
// ---------------------------------------------------------------------------

/**
 * Evaluate and issue gauntlet champion badges for a competitive
 * submission. No-ops unless: a context is registered, the stored row is
 * a win, and the (scheme, mastermind) pair belongs to at least one
 * catalog gauntlet the player has now completed.
 *
 * Called inside the submission's existing fire-and-forget badge
 * try/catch (WP-105 posture: badge failure never fails a submission).
 *
 * @param playerId The internal bigint player id (badge row FK).
 * @param accountId The caller's AccountId (progress query identity).
 * @param scenarioKey The stored row's scenario key.
 * @param outcome The stored row's outcome (null legacy rows never issue).
 * @param configVersion The submission's scoringConfigVersion (audit pin).
 * @param database The caller's database client.
 */
export async function issueGauntletBadgesForSubmission(
  playerId: number,
  accountId: string,
  scenarioKey: string,
  outcome: string | null,
  configVersion: number,
  database: DatabaseClient,
): Promise<void> {
  if (gauntletBadgeContext === null) {
    return;
  }
  // why: only a defeat-the-mastermind row can complete a leg (D-24131 §3);
  // losses and legacy NULL-outcome rows never trigger evaluation.
  if (outcome !== 'heroes-win') {
    return;
  }

  const keyParts = scenarioKey.split('::');
  const schemeSlug = keyParts[0] ?? '';
  const mastermindSlug = keyParts[1] ?? '';

  const affectedGauntlets: GauntletDefinition[] = [];
  for (const definition of gauntletBadgeContext.catalog) {
    if (
      definition.mastermindSlug === mastermindSlug &&
      definition.legSchemeSlugs.includes(schemeSlug)
    ) {
      affectedGauntlets.push(definition);
    }
  }
  if (affectedGauntlets.length === 0) {
    return;
  }

  const progressEntries = await getPlayerGauntletProgress(
    accountId,
    affectedGauntlets,
    database,
    gauntletBadgeContext.leaderboardDeps,
  );

  const completedBoards = new Set<string>();
  for (const progress of progressEntries) {
    if (progress.isComplete) {
      completedBoards.add(progress.board);
    }
  }
  if (completedBoards.size === 0) {
    return;
  }

  const valueClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;
  for (const definition of affectedGauntlets) {
    const boardName = `gauntlet-${definition.setAbbr}-${definition.mastermindSlug}`;
    if (!completedBoards.has(boardName)) {
      continue;
    }
    valueClauses.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`,
    );
    // why: source_ref NULL — the WP-105 partial unique index
    // (player_id, badge_key) WHERE source_ref IS NULL is the idempotency
    // mechanism. Pinning the completing submission id instead would make
    // every LATER win in an already-complete gauntlet a fresh row under
    // the composite constraint (a duplicate badge per win).
    params.push(
      playerId,
      buildGauntletBadgeKey(definition),
      1,
      'competitive_history',
      null,
      configVersion,
    );
    paramIndex += 6;
  }

  const sql =
    'INSERT INTO legendary.player_badges ' +
    '(player_id, badge_key, tier, source_kind, source_ref, awarded_under_config_version) ' +
    'VALUES ' +
    valueClauses.join(', ') +
    ' ON CONFLICT DO NOTHING';

  await database.query(sql, params);
}
