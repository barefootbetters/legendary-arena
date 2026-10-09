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

/**
 * One printed Hero Deck count rule (D-24672). Three shapes cover every printed
 * count clause:
 * - `add` — "Add an extra Hero" style: `base + amount` from `fromPlayerCount`
 *   players upward, the base count below it;
 * - `exact` — "6 Heroes" style: exactly `count` at every player count;
 * - `exactAtPlayerCount` — "If only 2 players, use only 4 Heroes" style: exactly
 *   `count` at `playerCount` players, the base count at every other count.
 */
export type SchemeHeroCountRule =
  | { readonly kind: 'add'; readonly amount: number; readonly fromPlayerCount: number }
  | { readonly kind: 'exact'; readonly count: number }
  | { readonly kind: 'exactAtPlayerCount'; readonly playerCount: number; readonly count: number };

// why: a scheme's printed Hero Deck size is a REQUIREMENT override (D-24337 /
// D-24672) — the operator must supply exactly that many Heroes and the base count
// is rejected. One closed table, so the next printed rule is a data row rather than
// another `if`. Keyed by scheme ext_id. msis The Time Heist is deliberately absent
// (its 4 + 4 Past Hero Deck has no MatchSetupConfig home; a named follow-up).
/**
 * Every printed Hero Deck count rule, keyed by scheme ext_id (D-24672). The only
 * reader is `resolveEffectiveHeroCount`.
 */
export const SCHEME_HERO_COUNT_RULES: Readonly<Record<string, SchemeHeroCountRule>> = {
  // why: "6 Heroes" (D-24337). `exact 6` is identical to the former
  // `Math.max(base, 6)` because the base count never exceeds 6 (1–5p: 3/5/5/5/6).
  'core/secret-invasion-of-the-skrull-shapeshifters': { kind: 'exact', count: 6 },
  // "If only 2 players, use only 4 Heroes in the Hero Deck" (D-24385; the engine's
  // D-24328 build-side slice produces the same 4).
  'core/super-hero-civil-war': { kind: 'exactAtPlayerCount', playerCount: 2, count: 4 },
  'msp1/enslave-minds-with-the-chitauri-scepter': { kind: 'exact', count: 6 },
  'msp1/super-hero-civil-war': { kind: 'exactAtPlayerCount', playerCount: 2, count: 4 },
  'co2e/super-hero-civil-war': { kind: 'exactAtPlayerCount', playerCount: 2, count: 4 },
  'co2e/secret-invasion-of-the-skrull-shapeshifters': { kind: 'add', amount: 1, fromPlayerCount: 1 },
  '2099/subjugate-earth-with-mega-corporations': { kind: 'add', amount: 1, fromPlayerCount: 1 },
  '2099/befoul-earth-into-a-polluted-wasteland': { kind: 'add', amount: 1, fromPlayerCount: 1 },
  'cosm/contest-of-champions-the': { kind: 'add', amount: 1, fromPlayerCount: 1 },
  'cosm/annihilation-conquest': { kind: 'add', amount: 1, fromPlayerCount: 1 },
  'shld/hydra-helicarriers-hunt-heroes': { kind: 'add', amount: 1, fromPlayerCount: 1 },
  'wpnx/go-after-heroes-loved-ones': { kind: 'add', amount: 1, fromPlayerCount: 1 },
  // why: operator ruling 2026-10-08 (D-24672 §3) — "And two extra Heroes" both go
  // into the Hero Deck, so the requirement is base + 2.
  'mdns/wager-at-blackjack-for-heroes-souls': { kind: 'add', amount: 2, fromPlayerCount: 1 },
  'antm/age-of-ultron': { kind: 'add', amount: 1, fromPlayerCount: 4 },
  'bkwd/frame-heroes-for-murder': { kind: 'exact', count: 6 },
  'dkcy/detonate-the-helicarrier': { kind: 'exact', count: 6 },
  'rvlt/house-of-m': { kind: 'exact', count: 6 },
  'cvwr/avengers-vs-x-men': { kind: 'exact', count: 6 },
  'chmp/divide-and-conquer': { kind: 'exact', count: 7 },
  'cvwr/reveal-heroes-secret-identities': { kind: 'exact', count: 7 },
  'wwhk/break-the-planet-asunder': { kind: 'exact', count: 7 },
  // why: operator ruling 2026-10-08 (D-24672 §3) — "Use 7 Heroes" is an 84-card
  // Hero Deck. Its double-the-groups / keep-half Villain Deck clause is deferred to
  // a separate packet.
  'mgtg/star-lords-awesome-mix-tape': { kind: 'exact', count: 7 },
  'ca75/go-back-in-time-to-slay-heroes-ancestors': { kind: 'exact', count: 8 },
  'dead/deadpool-kills-the-marvel-universe': { kind: 'exactAtPlayerCount', playerCount: 2, count: 4 },
  'cvwr/epic-super-hero-civil-war': { kind: 'exactAtPlayerCount', playerCount: 1, count: 4 },
  'cosm/destroy-the-nova-corps': { kind: 'exactAtPlayerCount', playerCount: 1, count: 5 },
};

/**
 * Returns the effective hero-group count a match must supply, applying the
 * scheme's printed Hero Deck count rule from `SCHEME_HERO_COUNT_RULES`
 * (D-24672; D-24337 Secret Invasion and D-24385 Civil War are rows).
 *
 * - no row → the base count;
 * - `add` → `base + amount` when `numPlayers >= fromPlayerCount`, else base;
 * - `exact` → `count` at every player count;
 * - `exactAtPlayerCount` → `count` when `numPlayers === playerCount`, else base.
 *
 * why: these are REQUIREMENT overrides, not build-time downsizes. Unlike the two
 * engine `schemeSetupSizing` overrides (Legacy Virus wounds, Civil War hero deck)
 * — which post-validation size a BUILT pile below the validated config — a
 * requirement override means the operator must actually SUPPLY that many hero
 * groups, so it lives on the requirement side (this resolver) and every hero-count
 * enforcement site reaches this one definition: `checkPlayerCountComposition`
 * (below), the game engine's `validatePlayerCountComposition` (via the registry
 * object it reads structurally), the server setup-requirements projection, the
 * loadout builder, and the gauntlet per-leg hero count (D-24671). The base
 * `PLAYER_COUNT_SETUP` table is never mutated.
 *
 * @param schemeId - The selected scheme ext_id (`MatchSetupConfig.schemeId`).
 * @param numPlayers - The match player count (used by the per-count rules).
 * @param baseHeroCount - The standard `PLAYER_COUNT_SETUP[numPlayers].heroCount`.
 * @returns The hero-group count the match must supply for this scheme.
 */
export function resolveEffectiveHeroCount(
  schemeId: string,
  numPlayers: number,
  baseHeroCount: number,
): number {
  // why: an own-property lookup, so a prototype key such as `constructor` or
  // `__proto__` resolves to the base count rather than an inherited member.
  if (!Object.hasOwn(SCHEME_HERO_COUNT_RULES, schemeId)) {
    return baseHeroCount;
  }
  const rule = SCHEME_HERO_COUNT_RULES[schemeId];
  if (rule === undefined) {
    return baseHeroCount;
  }
  if (rule.kind === 'add') {
    if (numPlayers >= rule.fromPlayerCount) {
      return baseHeroCount + rule.amount;
    }
    return baseHeroCount;
  }
  if (rule.kind === 'exact') {
    return rule.count;
  }
  if (rule.kind === 'exactAtPlayerCount') {
    if (numPlayers === rule.playerCount) {
      return rule.count;
    }
    return baseHeroCount;
  }
  // why: a new rule kind must get an explicit branch above, never a silent base
  // fallback — adding a fourth `SchemeHeroCountRule` kind fails this assignment at
  // the registry `tsc` build.
  const exhaustiveCheck: never = rule;
  return baseHeroCount;
}

/**
 * The schemes whose printed setup says "Add an extra Henchman group" (D-24666):
 * core Negative Zone Prison Breakout, its msp1 reprint Asgard Under Siege, and
 * vnom Invasion of the Venom Symbiotes. A closed list — the renamed-group and
 * different-shape variants need card-pool work, not a count.
 */
export const SCHEMES_WITH_EXTRA_HENCHMAN_GROUP: readonly string[] = [
  'core/negative-zone-prison-breakout',
  'msp1/asgard-under-siege',
  'vnom/invasion-of-the-venom-symbiotes',
];

/**
 * Returns the effective Henchman-group count a match must supply, applying the
 * printed "Add an extra Henchman group" setup clause (D-24666).
 *
 * A listed scheme requires exactly `baseHenchmenCount + 1` at every player count
 * (2 at 1–3p, 3 at 4–5p); every other scheme returns the base count unchanged.
 *
 * why: the card prints "Add an extra Henchman group" — a REQUIREMENT increase like
 * Secret Invasion's "6 Heroes" (D-24337), not a build-side downsize. The operator
 * must actually SUPPLY the extra group, so it lives on the requirement side (this
 * resolver) and every Henchman-count enforcement site reaches this one definition:
 * `checkPlayerCountComposition` (below), the game engine's
 * `validatePlayerCountComposition` (via the registry object it reads
 * structurally), the server setup-requirements projection, the loadout builder,
 * and `getGauntletConfig`. The base `PLAYER_COUNT_SETUP` table is never mutated.
 *
 * @param schemeId - The selected scheme ext_id (`MatchSetupConfig.schemeId`).
 * @param numPlayers - The match player count (accepted for signature parity with
 *   `resolveEffectiveHeroCount`; unused today).
 * @param baseHenchmenCount - The standard `PLAYER_COUNT_SETUP[numPlayers].henchmenGroupCount`.
 * @returns The Henchman-group count the match must supply for this scheme.
 */
export function resolveEffectiveHenchmenCount(
  schemeId: string,
  numPlayers: number,
  baseHenchmenCount: number,
): number {
  if (SCHEMES_WITH_EXTRA_HENCHMAN_GROUP.includes(schemeId)) {
    return baseHenchmenCount + 1;
  }
  return baseHenchmenCount;
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
   * The selected scheme ext_id, so the hero-count and Henchman-count
   * requirements can be scheme-aware (D-24337 — Secret Invasion requires 6
   * heroes; D-24666 — "Add an extra Henchman group"). Optional: when absent the
   * base `heroCount` / `henchmenGroupCount` are used, so existing callers that
   * omit it keep the standard behaviour.
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
  // why: the Henchman-count requirement is scheme-aware (D-24666). A missing
  // schemeId resolves to the base count, so callers that omit it are unaffected.
  const requiredHenchmenCount = resolveEffectiveHenchmenCount(
    input.schemeId ?? '',
    input.playerCount,
    row.henchmenGroupCount,
  );
  if (input.henchmanGroupIds.length !== requiredHenchmenCount) {
    mismatches.push({
      field: 'henchmanGroupIds',
      label: 'henchmen groups',
      required: requiredHenchmenCount,
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
