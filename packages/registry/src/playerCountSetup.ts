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

/** The scheme whose printed setup overrides the standard hero-group count. */
const SECRET_INVASION_SCHEME_ID = 'core/secret-invasion-of-the-skrull-shapeshifters';

// why: the card prints "Setup: 8 Twists. 6 Heroes. Skrull Villain Group required.
// Shuffle 12 random Heroes from the Hero Deck into the Villain Deck." A fixed count
// from the physical card, not a configurable param (mirrors SKRULL_HERO_COUNT = 12
// in the engine's convertHeroesToSkrulls).
/** Secret Invasion's printed hero-group count (its "6 Heroes" setup clause). */
const SECRET_INVASION_HERO_COUNT = 6;

/**
 * Returns the effective hero-group count a match must supply, applying any
 * scheme-specific setup override (D-24337).
 *
 * For Secret Invasion of the Skrull Shapeshifters the count is `Math.max(base, 6)`
 * — the printed "6 Heroes" clause, flat at every player count (2/3/4p 5→6; 5p is
 * already 6; solo-1p 3→6). Every other scheme returns the base count unchanged.
 *
 * why: this is a REQUIREMENT increase, not a build-time downsize. Unlike the two
 * engine `schemeSetupSizing` overrides (Legacy Virus wounds, Civil War hero deck)
 * — which post-validation size a BUILT pile below the validated config — "6 Heroes"
 * means the operator must actually SUPPLY 6 hero groups, so the override lives on
 * the requirement side (this resolver) and every hero-count enforcement site reaches
 * this one definition: `checkPlayerCountComposition` (below), the game engine's
 * `validatePlayerCountComposition` (via the registry object it reads structurally),
 * and the loadout builder. The base `PLAYER_COUNT_SETUP` table is never mutated.
 *
 * `numPlayers` is accepted for symmetry with the per-player-count table and for a
 * future per-count scheme override; the Secret Invasion branch is count-independent.
 *
 * @param schemeId - The selected scheme ext_id (`MatchSetupConfig.schemeId`).
 * @param numPlayers - The match player count (reserved; unused by the flat override).
 * @param baseHeroCount - The standard `PLAYER_COUNT_SETUP[numPlayers].heroCount`.
 * @returns The hero-group count the match must supply for this scheme.
 */
export function resolveEffectiveHeroCount(
  schemeId: string,
  numPlayers: number,
  baseHeroCount: number,
): number {
  if (schemeId === SECRET_INVASION_SCHEME_ID) {
    return Math.max(baseHeroCount, SECRET_INVASION_HERO_COUNT);
  }
  return baseHeroCount;
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
  /**
   * The selected scheme ext_id, so the hero-count requirement can be
   * scheme-aware (D-24337 — Secret Invasion requires 6 heroes). Optional:
   * when absent the base `heroCount` is used, so existing callers that omit it
   * keep the standard behaviour.
   */
  readonly schemeId?: string;
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
  // why: the hero-count requirement is scheme-aware (D-24337). A missing schemeId
  // resolves to the base count, so callers that omit it are unaffected.
  const requiredHeroCount = resolveEffectiveHeroCount(
    input.schemeId ?? '',
    input.playerCount,
    row.heroCount,
  );
  if (input.heroDeckIds.length !== requiredHeroCount) {
    mismatches.push({
      field: 'heroDeckIds',
      label: 'heroes',
      required: requiredHeroCount,
      actual: input.heroDeckIds.length,
    });
  }
  return mismatches;
}
