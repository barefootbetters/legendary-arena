/**
 * Current-Match Loadout LAGN Projection — Server Layer (WP-361)
 *
 * Projects a live/completed match's setup as a read-only **Tier-1 LAGN**
 * document (`@legendary-arena/lagn`). The full 9-field composition + player
 * count are already persisted verbatim in the WP-309 `bgio.matches` blob at
 * `initial_state.G.matchConfiguration` / `initial_state.ctx.numPlayers`; this
 * module reads them (a thin `SELECT initial_state`-only read), maps them to
 * Tier-1 LAGN, and resolves each ext_id to a display name via the startup
 * registry (falling back to the ext_id unchanged when the registry has no
 * entry).
 *
 * Persistence-boundary posture (D-24153, extending the D-24095/D-24119 blob-read
 * carve-out): this read is a **derived, read-only projection** — a convenience
 * representation, NOT a source of truth. The persisted match blob remains
 * authoritative; the LAGN is never written back, never a save-game, and never
 * round-tripped into gameplay state. The reader SELECTs `initial_state` only
 * (not `log`) because the Tier-1 projection needs no move log.
 *
 * Validation ownership: `buildMatchLagn` is **construction-only** — it never
 * calls `validate()`. The route (`matchLagn.routes.ts`) validates the built
 * document exactly once before returning it. The name resolver never
 * synthesizes, localizes, or title-cases names — it returns the canonical
 * registry display name or the ext_id verbatim.
 *
 * Layer-boundary contract: this module imports the pure `@legendary-arena/lagn`
 * validator (a zod schema, no upward edge) and the `@legendary-arena/registry`
 * `CardRegistry` **type** for name lookup. It imports no engine, game-framework,
 * pre-planning, or UI / client package (the server layer-boundary set — see
 * `.claude/rules/architecture.md`). The `pg` driver is reachable only through the
 * supplied `DatabaseClient`.
 *
 * Authority: WP-361 / EC-391; D-24153 (endpoint + carve-out extension);
 * D-24095 / D-24119 (the blob-read carve-out this extends); D-24018 (composition
 * ext_ids are set-qualified `setAbbr/slug`); D-5201 (AccountId).
 */

import { LAGN_VERSION, type LAGN, type LagnPlayer } from '@legendary-arena/lagn';
import type { CardRegistry } from '@legendary-arena/registry';

import type { AccountId, DatabaseClient } from '../identity/identity.types.js';

/**
 * The nine-field match-setup composition as read from the blob, in the
 * canonical `00.2 §8.1` `MatchSetupConfig` field names. Typed here as a plain
 * object (no engine import) — it is the same shape the engine persisted.
 */
export interface MatchLagnComposition {
  readonly schemeId: string;
  readonly mastermindId: string;
  readonly villainGroupIds: readonly string[];
  readonly henchmanGroupIds: readonly string[];
  readonly heroDeckIds: readonly string[];
  readonly bystandersCount: number;
  readonly woundsCount: number;
  readonly officersCount: number;
  readonly sidekicksCount: number;
}

/** The composition + seat count read from a single match's blob. */
export interface MatchConfigurationForLagn {
  readonly matchConfiguration: MatchLagnComposition;
  readonly numPlayers: number;
}

/**
 * Resolve a set-qualified ext_id (`setAbbr/slug`) to a display name. Returns the
 * canonical registry display name, or the ext_id unchanged when the registry has
 * no entry for it. Never synthesizes or transforms the name.
 */
export type ResolveName = (extId: string) => string;

/**
 * Read a match's setup composition + seat count from the WP-309 `bgio.matches`
 * blob (the D-24153 carve-out authorizes this server-layer read). SELECTs
 * `initial_state` only — the Tier-1 projection needs no `log`. Returns `null`
 * when the row is absent OR its `initial_state` is null (a setState-upsert row is
 * not projectable — fail closed, exactly like `readMatchForReplay`).
 *
 * @param matchId The match id.
 * @param database The caller-injected `pg` pool.
 * @returns The composition + seat count, or `null` when not projectable.
 */
export async function readMatchConfigurationForLagn(
  matchId: string,
  database: DatabaseClient,
): Promise<MatchConfigurationForLagn | null> {
  // why: a direct read-only SELECT of `initial_state` only (not `log`/`metadata`)
  // — the minimal read the D-24153 carve-out authorizes for the Tier-1 loadout
  // projection. jsonb arrives already parsed from node-pg.
  const result = await database.query(
    'SELECT initial_state FROM bgio.matches WHERE match_id = $1',
    [matchId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const initialState = result.rows[0].initial_state;
  if (initialState === null || initialState === undefined) {
    return null;
  }
  // why: the persisted match-store initial state is `{ G, ctx, ... }`; `G` is the
  // engine's LegendaryGameState whose `matchConfiguration` is the full 9-field
  // input, and the seat count lives on the framework's `ctx.numPlayers`. Read as a
  // plain object — a malformed blob yields a document that fails the route's
  // `validate()` (a `500`), never a partial return.
  const blob = initialState as {
    G?: { matchConfiguration?: MatchLagnComposition };
    ctx?: { numPlayers?: number };
  };
  const matchConfiguration = blob.G?.matchConfiguration;
  if (matchConfiguration === undefined || matchConfiguration === null) {
    return null;
  }
  return {
    matchConfiguration,
    numPlayers: blob.ctx?.numPlayers as number,
  };
}

/**
 * Build a name resolver over the startup registry: a lookup from each
 * composition entity's set-qualified ext_id (`setAbbr/slug`) to its canonical
 * **group-level** display name, closed over so the resolver is a plain `Map.get`
 * with ext_id fallback.
 *
 * The lookup is built from the group-level entities exposed by
 * `registry.getSet(abbr)` — one entry per hero, mastermind, villain group,
 * henchman group, and scheme — NOT from `registry.listCards()`. A mastermind,
 * villain group, and hero each own several cards that all share one ext_id
 * (`setAbbr/slug`): a mastermind's base face plus its four Tactics, a villain
 * group's members, a hero's card set. Keying the flattened card list by ext_id
 * therefore lets the LAST card written win — resolving `core/red-skull` to its
 * "Ruthless Dictator" Tactic card instead of the "Red Skull" base face (the
 * D-24169 dashboard match-summary mislabel this fixes). Reading the entity name
 * (`mastermind.name`, `villainGroup.name`, `hero.name`, …) yields exactly one
 * order-independent entry per ext_id — the base-face name for a mastermind by
 * data invariant. An ext_id with no entity (a deck-level id, a malformed row)
 * falls back to the ext_id unchanged (the `name` is cosmetic — the viewer
 * resolves ids, not names).
 *
 * @param registry The startup CardRegistry (read-only).
 * @returns A resolver returning the display name, or the ext_id when absent.
 */
export function buildNameResolver(registry: CardRegistry): ResolveName {
  // why: build the ext_id → name map once here (not per-request) and close over
  // it; the resolver never mutates the registry, caches nothing else, and
  // persists nothing.
  const nameByExtId = new Map<string, string>();
  for (const setEntry of registry.listSets()) {
    const setData = registry.getSet(setEntry.abbr);
    if (setData === undefined) {
      continue;
    }
    // why: use setData.abbr (not setEntry.abbr) for the ext_id prefix so the key
    // is byte-identical to the `${abbr}/${slug}` ext_id flattenSet derives.
    const setAbbr = setData.abbr;
    for (const hero of setData.heroes) {
      nameByExtId.set(`${setAbbr}/${hero.slug}`, hero.name);
    }
    for (const mastermind of setData.masterminds) {
      nameByExtId.set(`${setAbbr}/${mastermind.slug}`, mastermind.name);
    }
    for (const villainGroup of setData.villains) {
      nameByExtId.set(`${setAbbr}/${villainGroup.slug}`, villainGroup.name);
    }
    for (const scheme of setData.schemes) {
      nameByExtId.set(`${setAbbr}/${scheme.slug}`, scheme.name);
    }
    // why: SetDataSchema types `henchmen` as unknown[] (it carries no gameplay
    // schema), so narrow each entry to the { name, slug } shape the data holds
    // before mapping; a malformed entry is skipped rather than throwing.
    for (const henchmanGroup of setData.henchmen) {
      if (isNamedEntity(henchmanGroup)) {
        nameByExtId.set(`${setAbbr}/${henchmanGroup.slug}`, henchmanGroup.name);
      }
    }
  }
  return (extId) => nameByExtId.get(extId) ?? extId;
}

/**
 * Narrow an untyped set entity (a henchman group, typed `unknown` by
 * SetDataSchema) to the `{ name, slug }` shape the name resolver maps. Returns
 * `false` for any value missing a string `name` or `slug`.
 *
 * @param value The candidate entity.
 * @returns True when the value has string `name` and `slug` fields.
 */
function isNamedEntity(value: unknown): value is { name: string; slug: string } {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { name?: unknown; slug?: unknown };
  return typeof candidate.name === 'string' && typeof candidate.slug === 'string';
}

/**
 * Map one entity array (villain groups / henchmen groups / heroes) to the LAGN
 * `{ id, name }[]` shape, resolving each name. A non-array input (a malformed
 * blob) yields `[]`, which fails the route's `validate()` (`min(1)`) rather than
 * throwing — the mapper never throws.
 *
 * @param ids The set-qualified ext_ids for one composition field.
 * @param resolveName The registry name resolver.
 * @returns The LAGN entity-array entries.
 */
function toLagnEntityArray(
  ids: readonly string[],
  resolveName: ResolveName,
): { id: string; name: string }[] {
  if (!Array.isArray(ids)) {
    return [];
  }
  const entries: { id: string; name: string }[] = [];
  for (const id of ids) {
    entries.push({ id, name: resolveName(id) });
  }
  return entries;
}

/**
 * Derive the LAGN `variant` from the seat count. A 1-seat match is `'solo'`;
 * every multi-seat match is `'cooperative'` (the game is co-op vs the
 * Mastermind — never `'competitive'`).
 *
 * @param numPlayers The seat count read from the blob.
 * @returns The LAGN variant.
 */
function variantForSeatCount(numPlayers: number): 'solo' | 'cooperative' {
  // why: 1 seat → solo, otherwise cooperative; mirrors the Registry Viewer's
  // useLoadoutLagnExport classic→solo / custom→cooperative mapping. The engine
  // has no competitive variant.
  return numPlayers === 1 ? 'solo' : 'cooperative';
}

/**
 * Build a Tier-1 LAGN document from a match's composition + seat count.
 *
 * **Construction-only**: this function never calls `validate()` — the route
 * validates the returned document exactly once. It never throws: a malformed
 * composition (a non-array group field, a corrupt `numPlayers`) produces a
 * document that fails that validation (a `500`), never a partial or guessed
 * return. `numPlayers` is passed through as-read (no coercion/default); an
 * out-of-range value fails LAGN's `player_count` `int 1–5` check.
 *
 * @param matchId The match id (used as the LAGN `game_id`).
 * @param composition The 9-field composition read from the blob.
 * @param numPlayers The seat count read from the blob.
 * @param resolveName The registry name resolver (canonical name or ext_id).
 * @returns A Tier-1 LAGN document (setup only — no card_catalog / replay / result).
 */
export function buildMatchLagn(
  matchId: string,
  composition: MatchLagnComposition,
  numPlayers: number,
  resolveName: ResolveName,
): LAGN {
  return {
    lagn_version: LAGN_VERSION,
    $schema: 'https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json',
    game_id: matchId,
    variant: variantForSeatCount(numPlayers),
    player_count: numPlayers,
    setup: {
      mastermind: {
        id: composition.mastermindId,
        name: resolveName(composition.mastermindId),
      },
      scheme: {
        id: composition.schemeId,
        name: resolveName(composition.schemeId),
      },
      villain_groups: toLagnEntityArray(composition.villainGroupIds, resolveName),
      henchmen_groups: toLagnEntityArray(composition.henchmanGroupIds, resolveName),
      heroes: toLagnEntityArray(composition.heroDeckIds, resolveName),
      bystanders_count: composition.bystandersCount,
      wounds_count: composition.woundsCount,
      // why: the ONLY non-1:1 rename — the composition's `officersCount` (the
      // S.H.I.E.L.D. officer pile, 00.2 §7) is LAGN's `shield_officers_count`.
      shield_officers_count: composition.officersCount,
      sidekicks_count: composition.sidekicksCount,
    },
  };
}

// ============================================================================
// Result-LAGN Producer — Server Layer (WP-406 / D-24216)
// ============================================================================
//
// why: a result LAGN is a completed match's self-describing scoresheet — the
// setup (reused from `buildMatchLagn`) PLUS the outcome, the participant roster,
// and a scoring-profile label. It is DESCRIPTIVE ONLY (D-24214 / D-24215):
// nothing scores, credits, ranks, or verifies from it. Competitive credit stays
// `matchId -> bgio blob -> re-execute -> AccountId`, server-side (D-5301 /
// D-24126); a reader that scored from `players[]` or `scoring_profile` would
// reopen that trust hole. Every read here fits an EXISTING carve-out — the
// composition via D-24153 (reused helper), the outcome via `metadata.gameover`
// (D-24169), the roster via the `legendary.match_seat_accounts` DOMAIN table (no
// blob read at all). No new persistence-boundary carve-out (D-24216).

/**
 * The scoring-profile label the producer stamps by default.
 *
 * why: `scoring_profile` is a DESCRIPTIVE label (D-24215), never read back for
 * scoring — the server derives the applicable ruleset from the match, never from
 * a client-supplied tag. The concrete profile vocabulary is the leaderboard's /
 * Hall of Legends' to own, so the producer emits a documented default here; a
 * future packet may refine it from the match's competitive context. `'classic'`
 * is the base, non-gauntlet ruleset.
 */
export const DEFAULT_SCORING_PROFILE = 'classic';

/** The endgame verdict as stored in the blob's `metadata.gameover`. */
export interface StoredGameover {
  readonly outcome?: string;
  readonly reason?: string;
}

/**
 * Read a match's endgame verdict from `bgio.matches.metadata.gameover` — the
 * value boardgame.io persisted from the engine's `endIf` return (an
 * `EndgameResult`). Returns `null` when the match row is absent OR the match has
 * not reached gameover (no `gameover` key) — the caller treats a `null` on an
 * otherwise-projectable match as "still in progress".
 *
 * why: reads `metadata->'gameover'` only — the same METADATA surface
 * `isMatchFinished` reads, authorized by the D-24169 carve-out. It never reads
 * `state`/`log`, so it needs no D-24119 re-reduce and no new carve-out: the
 * stored verdict already carries the outcome the result LAGN reports.
 *
 * @param matchId The match id.
 * @param database The caller-injected `pg` pool.
 * @returns The stored gameover verdict, or `null` when absent / unfinished.
 */
export async function readMatchGameover(
  matchId: string,
  database: DatabaseClient,
): Promise<StoredGameover | null> {
  const result = await database.query(
    "SELECT metadata->'gameover' AS gameover FROM bgio.matches WHERE match_id = $1",
    [matchId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const gameover = result.rows[0].gameover;
  if (gameover === null || gameover === undefined) {
    return null;
  }
  return gameover as StoredGameover;
}

/**
 * Map a stored endgame verdict to a LAGN `result` block, or `undefined` when the
 * outcome is not a decisive victory/defeat.
 *
 * why: `heroes-win -> victory`, `scheme-wins -> defeat`. A deck-exhaustion
 * `'tie'` (D-24159) or any unrecognized value has no LAGN outcome, so the
 * `result` block is OMITTED (it is optional in LAGN) rather than guessed.
 * `loss_condition` is deliberately omitted: the engine's `reason` is a
 * human-readable string, not LAGN's closed `LossCondition` enum, and mapping one
 * to the other would fabricate a field the record cannot support.
 *
 * @param gameover The stored endgame verdict, or `null` for an unfinished match.
 * @returns The LAGN result block, or `undefined` for a non-decisive outcome.
 */
export function toLagnResult(
  gameover: StoredGameover | null,
): { outcome: 'victory' | 'defeat' } | undefined {
  if (gameover?.outcome === 'heroes-win') {
    return { outcome: 'victory' };
  }
  if (gameover?.outcome === 'scheme-wins') {
    return { outcome: 'defeat' };
  }
  return undefined;
}

/** The claimed public alias + mutable label for one account. */
export interface ResultPlayerIdentity {
  readonly displayHandle: string | null;
  readonly displayName: string | null;
}

/**
 * Read the public identity (claimed handle + mutable display name) for a set of
 * accounts from `legendary.players`, keyed by `AccountId` (= `ext_id`).
 *
 * why: a DOMAIN-table read (`legendary.players`), NOT a blob read — no
 * persistence-boundary carve-out involved. Batched via `ext_id = ANY($1)` (the
 * WP-351 friend-summary pattern) so the roster resolves in one round trip. An
 * account with no row is simply absent from the map (defensive; every recorded
 * seat has a players row by FK).
 *
 * @param accountIds The seat accounts to resolve.
 * @param database The caller-injected `pg` pool.
 * @returns A map from `AccountId` to its public identity.
 */
export async function readAccountPublicIdentities(
  accountIds: readonly AccountId[],
  database: DatabaseClient,
): Promise<Map<AccountId, ResultPlayerIdentity>> {
  const identities = new Map<AccountId, ResultPlayerIdentity>();
  if (accountIds.length === 0) {
    return identities;
  }
  const result = await database.query(
    'SELECT ext_id, display_handle, display_name FROM legendary.players ' +
      'WHERE ext_id = ANY($1)',
    [accountIds as AccountId[]],
  );
  for (const row of result.rows as {
    ext_id: string;
    display_handle: string | null;
    display_name: string | null;
  }[]) {
    identities.set(row.ext_id as AccountId, {
      displayHandle: row.display_handle ?? null,
      displayName: row.display_name ?? null,
    });
  }
  return identities;
}

/**
 * Project a match's seat roster to the LAGN `players[]` block, or `undefined`
 * when no seat qualifies.
 *
 * why: `player_id` is the account's claimed public handle (`display_handle`). A
 * seat whose account has NOT claimed a handle is OMITTED — never emitted with the
 * internal `AccountId` (D-24214 privacy: LAGN is shareable) and never with a
 * synthesized id (inventing an id space is a prohibited pattern). A result LAGN
 * credits only participants who have a public identity. `display_name` carries
 * the mutable label when present.
 *
 * why: returns `undefined` (omit the key) rather than `[]` when no seat has a
 * public identity — an empty array asserts "zero participants," which is a
 * different claim than "no roster to report". Bots/guests have no
 * `match_seat_accounts` row, so `players.length <= player_count` holds by
 * construction and the WP-405 count refinement is never tripped.
 *
 * @param seats The recorded seats `{ playerId, accountId }` (bgio seat ids).
 * @param identities The resolved public identity per account.
 * @returns The LAGN players array, or `undefined` when no seat qualifies.
 */
export function buildResultPlayers(
  seats: readonly { playerId: string; accountId: AccountId }[],
  identities: ReadonlyMap<AccountId, ResultPlayerIdentity>,
): LagnPlayer[] | undefined {
  const players: LagnPlayer[] = [];
  for (const seat of seats) {
    const identity = identities.get(seat.accountId);
    const handle = identity?.displayHandle;
    // why: omit a handleless seat rather than leak the AccountId or synthesize an
    // id (D-24214). `?? ''` collapses null/undefined; an empty handle is treated
    // as unclaimed.
    if (handle === undefined || handle === null || handle === '') {
      continue;
    }
    const entry: LagnPlayer = {
      seat: Number(seat.playerId),
      player_id: handle,
    };
    if (identity?.displayName !== undefined && identity?.displayName !== null) {
      entry.display_name = identity.displayName;
    }
    players.push(entry);
  }
  if (players.length === 0) {
    return undefined;
  }
  // why: stable seat order so the emitted document is deterministic across reads.
  players.sort((first, second) => first.seat - second.seat);
  return players;
}

/**
 * Build a result LAGN for a completed match: the Tier-1 setup (reused verbatim
 * from `buildMatchLagn` — no fork) PLUS `scoring_profile` and, when present, the
 * `players[]` roster and the `result` block.
 *
 * **Construction-only**: like `buildMatchLagn`, this never calls `validate()` —
 * the route validates the built document exactly once before returning it. It
 * stamps `LAGN_VERSION` (1.4.0 as of the WP-406 writer flip), so `players[]`
 * clears the WP-405 version gate.
 *
 * @param matchId The match id (the LAGN `game_id`).
 * @param composition The 9-field composition read from the blob.
 * @param numPlayers The seat count read from the blob.
 * @param resolveName The registry name resolver.
 * @param players The projected roster, or `undefined` to omit `players[]`.
 * @param result The projected outcome, or `undefined` to omit `result`.
 * @param scoringProfile The descriptive scoring-profile label.
 * @returns A result LAGN document (setup + scoring_profile + optional players/result).
 */
export function buildResultMatchLagn(
  matchId: string,
  composition: MatchLagnComposition,
  numPlayers: number,
  resolveName: ResolveName,
  players: LagnPlayer[] | undefined,
  result: { outcome: 'victory' | 'defeat' } | undefined,
  scoringProfile: string,
): LAGN {
  const document: LAGN = {
    ...buildMatchLagn(matchId, composition, numPlayers, resolveName),
    scoring_profile: scoringProfile,
  };
  if (players !== undefined) {
    document.players = players;
  }
  if (result !== undefined) {
    document.result = result;
  }
  return document;
}
