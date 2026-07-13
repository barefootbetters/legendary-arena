/**
 * playerCountSetup.ts — the canonical per-player-count setup table (WP-370).
 *
 * The Marvel Legendary rules fix each setup component by the number of
 * players. This module is the SINGLE SOURCE OF TRUTH for those numbers.
 * It is plain data plus pure lookups — no zod, no I/O — so it is safe to
 * import from the browser (registry-viewer loadout builder), the server
 * (match-create gate), and — via the registry object passed into
 * Game.setup() using structural typing — the game engine, which may not
 * import this package directly (layer boundary).
 *
 * why: D-24165 — the table lives here (game reference data) rather than in
 * the engine, so the engine (Node-built-ins-only imports) never imports
 * registry; every consumer reaches this one table legally. The engine
 * reads it off the CardRegistry object at setup time (structural typing on
 * its local CardRegistryReader), never as a static import.
 *
 * Distinct from the SUPPLY-PILE bystander count (`bystandersCount`, floored
 * at 30 by D-24032): `villainDeckBystanderCount` here is the number of
 * bystanders shuffled INTO the villain deck. Do not conflate the two.
 */

/** The four per-player-count setup counts, keyed to the composition fields. */
export interface PlayerCountSetupRow {
  /** Required villain groups — equals `villainGroupIds.length`. */
  readonly villainGroupCount: number;
  /** Required henchmen groups — equals `henchmanGroupIds.length`. */
  readonly henchmenGroupCount: number;
  /** Bystanders shuffled into the villain deck (a scheme's own count overrides). */
  readonly villainDeckBystanderCount: number;
  /** Required heroes — equals `heroDeckIds.length`. */
  readonly heroCount: number;
}

/** Supported player counts (base-game rules). */
export type SupportedPlayerCount = 1 | 2 | 3 | 4 | 5;

/**
 * The base-game (standard) setup table.
 *
 * why: D-24165 — standard rules only. The "What If…?" modified setup
 * (4p → 4 villain groups, 5p → 5 / 16 bystanders) is a game-mode variant
 * with no game-mode concept in the app today; it is deferred to a future
 * mode-aware packet rather than encoded here.
 */
export const PLAYER_COUNT_SETUP: Readonly<
  Record<SupportedPlayerCount, PlayerCountSetupRow>
> = {
  1: { villainGroupCount: 1, henchmenGroupCount: 1, villainDeckBystanderCount: 1, heroCount: 3 },
  2: { villainGroupCount: 2, henchmenGroupCount: 1, villainDeckBystanderCount: 2, heroCount: 5 },
  3: { villainGroupCount: 3, henchmenGroupCount: 1, villainDeckBystanderCount: 8, heroCount: 5 },
  4: { villainGroupCount: 3, henchmenGroupCount: 2, villainDeckBystanderCount: 8, heroCount: 5 },
  5: { villainGroupCount: 4, henchmenGroupCount: 2, villainDeckBystanderCount: 12, heroCount: 6 },
};

/**
 * Returns the setup row for a player count, or undefined when the count is
 * outside the supported 1–5 range.
 *
 * A count outside 1–5 is already rejected upstream (boardgame.io player
 * bounds, the setup-contract `playerCount` 1–5 schema); returning undefined
 * lets callers skip the composition check on an out-of-range count rather
 * than throw on a key they cannot map.
 */
export function getPlayerCountSetup(
  numPlayers: number,
): PlayerCountSetupRow | undefined {
  if (numPlayers === 1 || numPlayers === 2 || numPlayers === 3 || numPlayers === 4 || numPlayers === 5) {
    return PLAYER_COUNT_SETUP[numPlayers];
  }
  return undefined;
}

/** One composition-count mismatch against the player-count table. */
export interface PlayerCountCompositionMismatch {
  /** The composition array field whose length is wrong. */
  readonly field: 'villainGroupIds' | 'henchmanGroupIds' | 'heroDeckIds';
  /** A human label for the field (e.g. "villain groups"). */
  readonly label: string;
  /** The count the rules require for this player count. */
  readonly required: number;
  /** The count the submitted composition actually has. */
  readonly actual: number;
}

/** The composition array lengths a caller wants checked against a player count. */
export interface PlayerCountCompositionInput {
  readonly playerCount: number;
  readonly villainGroupIds: readonly unknown[];
  readonly henchmanGroupIds: readonly unknown[];
  readonly heroDeckIds: readonly unknown[];
}

/**
 * Returns the list of composition-count mismatches for a player count —
 * empty when the composition matches the rules table (or when the player
 * count is out of range and cannot be judged).
 *
 * Pure computation over the table. Consumers decide how to surface the
 * result: the engine BLOCKS (throws at Game.setup), the server rejects the
 * create request, and the loadout builder WARNS and gates export
 * (the D-24165 enforcement model).
 */
export function checkPlayerCountComposition(
  input: PlayerCountCompositionInput,
): PlayerCountCompositionMismatch[] {
  const row = getPlayerCountSetup(input.playerCount);
  if (row === undefined) {
    return [];
  }
  const mismatches: PlayerCountCompositionMismatch[] = [];
  if (input.villainGroupIds.length !== row.villainGroupCount) {
    mismatches.push({
      field: 'villainGroupIds',
      label: 'villain groups',
      required: row.villainGroupCount,
      actual: input.villainGroupIds.length,
    });
  }
  if (input.henchmanGroupIds.length !== row.henchmenGroupCount) {
    mismatches.push({
      field: 'henchmanGroupIds',
      label: 'henchmen groups',
      required: row.henchmenGroupCount,
      actual: input.henchmanGroupIds.length,
    });
  }
  if (input.heroDeckIds.length !== row.heroCount) {
    mismatches.push({
      field: 'heroDeckIds',
      label: 'heroes',
      required: row.heroCount,
      actual: input.heroDeckIds.length,
    });
  }
  return mismatches;
}
