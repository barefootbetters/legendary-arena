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

import { LAGN_VERSION, type LAGN } from '@legendary-arena/lagn';
import type { CardRegistry } from '@legendary-arena/registry';

import type { DatabaseClient } from '../identity/identity.types.js';

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
 * Build a name resolver over the startup registry: a lookup from each entity's
 * set-qualified ext_id (`setAbbr/slug`) to its canonical display name, closed
 * over so the resolver is a plain `Map.get` with ext_id fallback.
 *
 * The lookup is built from `registry.listCards()` — each scheme, mastermind,
 * villain, and hero card is a `FlatCard` carrying its `extId` + `name`. Group- or
 * deck-level composition ids that are not a single card fall back to the ext_id
 * unchanged (the LAGN `name` is cosmetic — the viewer resolves ids, not names —
 * so an unresolved name is a labelling nicety, never a correctness issue).
 *
 * @param registry The startup CardRegistry (read-only).
 * @returns A resolver returning the display name, or the ext_id when absent.
 */
export function buildNameResolver(registry: CardRegistry): ResolveName {
  // why: build the ext_id → name map once here (not per-request) and close over
  // it; the resolver never mutates the registry, caches nothing else, and
  // persists nothing.
  const nameByExtId = new Map<string, string>();
  for (const card of registry.listCards()) {
    nameByExtId.set(card.extId, card.name);
  }
  return (extId) => nameByExtId.get(extId) ?? extId;
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
