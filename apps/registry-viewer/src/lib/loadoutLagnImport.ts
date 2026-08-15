/**
 * loadoutLagnImport.ts — parse a LAGN file into a loadout composition
 * (WP-291 / EC-323 / D-24075).
 *
 * The Loadout tab can already EXPORT a LAGN file (WP-245's "Download LAGN")
 * but had no way to import one back: the only importer (`loadFromJson`)
 * validates against the MATCH-SETUP schema, so a LAGN file — a different shape
 * (`lagn_version` / `setup` / `result`) — is rejected. This module closes that
 * export/import asymmetry: it validates a pasted/uploaded LAGN via the
 * published `@legendary-arena/lagn` validator and reverses WP-245's
 * `compositionToLagnSetup` mapping back into the five MATCH-SETUP composition
 * fields + the four supply counts + the player count.
 *
 * The set-qualified ext_ids the LAGN `setup` block stores (e.g.
 * `setup.heroes[].id = "core/wolverine"`, D-24018) are the SAME id-space the
 * loadout composition uses, so no registry lookup or id translation is needed
 * here. Whether each id resolves to a real card is left to the draft's live
 * MATCH-SETUP validation after the import applies — this module only proves the
 * file is a well-formed LAGN and extracts its composition.
 *
 * Pure helper module: no Vue reactivity, no I/O, no engine / game-framework
 * import. It never mutates anything; it returns extracted data the caller
 * applies to the draft via the existing `UseLoadoutDraftApi` setters.
 */

import { validate, type LAGN } from "@legendary-arena/lagn";
import type { SupportPool, SupportPools } from "@legendary-arena/registry/setupContract";

/**
 * The composition a LAGN file carries, in MATCH-SETUP field names (the
 * canonical 00.2 §8.1 names the draft uses), plus the player count. Every id is
 * the set-qualified ext_id the LAGN `setup` block stored.
 */
export interface LagnLoadoutComposition {
  schemeId: string;
  mastermindId: string;
  villainGroupIds: string[];
  henchmanGroupIds: string[];
  heroDeckIds: string[];
  bystandersCount: number;
  woundsCount: number;
  officersCount: number;
  sidekicksCount: number;
  playerCount: number;
  /**
   * The support pools the LAGN named, in MATCH-SETUP shape, or undefined when
   * the record carries none.
   *
   * why: EC-429 — LAGN 1.1.0 has carried `setup.support_pools` since D-24195,
   * and the viewer has exported them since EC-425, but this importer never read
   * them back. A `?lagn=` share link therefore delivered the heroes and
   * villains while silently dropping the harness — which is the whole point of
   * sharing a frozen board. Reading them here closes the round trip.
   */
  supportPools?: SupportPools | undefined;
  /**
   * The match verdict the LAGN carried, or undefined when the record has none.
   *
   * why: D-24358 — this importer previously mapped only `setup` + `player_count`
   * (+ `supportPools`) and DROPPED the `result` block, so a shared match link
   * delivered the board but the re-export rebuilt a verdict from a dropdown that
   * defaults to "victory" — a real co-op loss (`scheme-wins`) re-exported as a
   * victory. Surfacing it here is the same remedy EC-429 / D-24195 applied to
   * `supportPools` when the `?lagn=` round trip silently dropped the harness.
   */
  result?: LagnImportedResult | undefined;
}

/**
 * The subset of a LAGN `result` block this app round-trips.
 *
 * why: D-24358 — the KNOWN keys only, copied explicitly rather than spread.
 * `parseLagnLoadout` hands back the raw parsed object (`parsed as LAGN`), so
 * zod's strip never runs; `result` additionally permits `victory_points` and
 * `timestamp`, and the schema sets `additionalProperties: true`. A spread would
 * therefore round-trip arbitrary unknown keys out of an untrusted file.
 */
export interface LagnImportedResult {
  outcome: "victory" | "defeat";
  lossCondition?: string | undefined;
}

/** The result of parsing a pasted/uploaded LAGN file. */
export type ParseLagnLoadoutResult =
  | { ok: true; composition: LagnLoadoutComposition }
  | { ok: false; errors: string[] };

/**
 * Maps a validated LAGN's `setup` block (plus its `player_count`) into the
 * MATCH-SETUP composition field names. Reverses WP-245's
 * `compositionToLagnSetup`: `setup.shield_officers_count` → `officersCount`,
 * `setup.villain_groups[].id` → `villainGroupIds`, and so on.
 *
 * @param lagn - A LAGN object already accepted by the published validator.
 */
/**
 * Reverses `supportPoolsToLagn` (useLoadoutLagnExport): LAGN is snake_case and
 * names the officer pool `shield_officers` to match `shield_officers_count`
 * (D-24195), while the MATCH-SETUP envelope uses `officers` to match
 * `officersCount` (D-24194).
 *
 * why: the rename is the same non-1:1 mapping the counts already carry a few
 * lines below. Doing it in one place keeps a future reader from having to
 * rediscover that `officers` and `shield_officers` are the same pool.
 *
 * The LAGN validator has already enforced that each pool's copies sum to its
 * paired count (D-24195), so no re-derivation is needed here — the counts
 * mapped alongside are guaranteed consistent with these pools.
 */
function lagnToSupportPools(setup: LAGN["setup"]): SupportPools | undefined {
  const pools = setup.support_pools;
  if (pools === undefined) {
    return undefined;
  }
  const toMatchSetupPool = (pool: NonNullable<typeof pools.bystanders>): SupportPool => {
    const converted: SupportPool = {
      mode: pool.mode,
      cards: pool.cards.map((card) => ({ extId: card.ext_id, copies: card.copies })),
    };
    if (pool.sets !== undefined) {
      converted.sets = [...pool.sets];
    }
    return converted;
  };
  const out: SupportPools = {};
  if (pools.bystanders !== undefined) out.bystanders = toMatchSetupPool(pools.bystanders);
  if (pools.wounds !== undefined) out.wounds = toMatchSetupPool(pools.wounds);
  if (pools.shield_officers !== undefined) out.officers = toMatchSetupPool(pools.shield_officers);
  if (pools.sidekicks !== undefined) out.sidekicks = toMatchSetupPool(pools.sidekicks);
  return Object.keys(out).length === 0 ? undefined : out;
}

/**
 * Reverses the exporter's `result` emission: the validated block's KNOWN keys,
 * copied one at a time.
 *
 * why: D-24358 — never spread the incoming block (see `LagnImportedResult`).
 * This performs NO inference: it never derives an outcome from scores, players,
 * or player count, and it never invents a `loss_condition`. A record with no
 * `result` returns undefined, which the exporter treats as "unset".
 *
 * @param lagn - A LAGN object already accepted by the published validator.
 * @returns The imported verdict, or undefined when the record carries none.
 */
function lagnToImportedResult(lagn: LAGN): LagnImportedResult | undefined {
  const result = lagn.result;
  if (result === undefined) {
    return undefined;
  }
  const imported: LagnImportedResult = { outcome: result.outcome };
  if (result.loss_condition !== undefined) {
    imported.lossCondition = result.loss_condition;
  }
  return imported;
}

function lagnToComposition(lagn: LAGN): LagnLoadoutComposition {
  const setup = lagn.setup;
  const supportPools = lagnToSupportPools(setup);
  const result = lagnToImportedResult(lagn);
  return {
    ...(supportPools === undefined ? {} : { supportPools }),
    ...(result === undefined ? {} : { result }),
    schemeId: setup.scheme.id,
    mastermindId: setup.mastermind.id,
    // why: take only the `id` off each group entry — the LAGN stores `{ id, name }`
    // but the loadout composition is ext_id strings only (00.2 §8.1).
    villainGroupIds: setup.villain_groups.map((group) => group.id),
    henchmanGroupIds: setup.henchmen_groups.map((group) => group.id),
    heroDeckIds: setup.heroes.map((hero) => hero.id),
    bystandersCount: setup.bystanders_count,
    woundsCount: setup.wounds_count,
    // why: LAGN names this `shield_officers_count`; the MATCH-SETUP composition
    // field is `officersCount` (00.2 §8.1) — the only non-1:1 field name.
    officersCount: setup.shield_officers_count,
    sidekicksCount: setup.sidekicks_count,
    playerCount: lagn.player_count,
  };
}

/**
 * Parses pasted/uploaded text as a LAGN file and extracts its composition.
 * Returns `{ ok: false, errors }` with full-sentence messages when the text is
 * not JSON or is not a valid LAGN file (e.g. a MATCH-SETUP document pasted into
 * the LAGN box) so the Loadout tab can show the user what to fix.
 *
 * @param jsonText - The raw text of a `.json` LAGN file (or pasted JSON).
 */
export function parseLagnLoadout(jsonText: string): ParseLagnLoadoutResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (parseFailure) {
    const message = parseFailure instanceof Error ? parseFailure.message : String(parseFailure);
    return {
      ok: false,
      errors: [`The pasted text could not be parsed as JSON: ${message}`],
    };
  }
  // why: validate against the published @legendary-arena/lagn schema (the same
  // validator the export uses) so a non-LAGN file — a MATCH-SETUP document, an
  // arbitrary JSON object — is rejected with the validator's own field-level
  // errors rather than silently producing an empty or partial composition.
  const result = validate(parsed);
  if (!result.valid) {
    const errors = result.errors && result.errors.length > 0 ? result.errors : [];
    return {
      ok: false,
      errors:
        errors.length > 0
          ? errors
          : ["The file is not a valid LAGN file. Export it from the Loadout tab's Download LAGN button, or use Load JSON for a MATCH-SETUP document."],
    };
  }
  return { ok: true, composition: lagnToComposition(parsed as LAGN) };
}
