/**
 * useLoadoutLagnExport.ts — LAGN Tier 1 export composable for Registry Viewer Loadout tab (WP-245).
 *
 * Converts a MATCH-SETUP draft into LAGN Tier 1 JSON format, generates a UUID v4 game_id,
 * and validates the result via @legendary-arena/lagn. The variant is DERIVED from the
 * draft's seat count (read-only, not user-selected — see `variantForPlayerCount`); the
 * outcome is TRI-state (D-24358): "unset" by default, replaced by a LAGN import or
 * chosen by the user. An "unset" outcome omits the optional `result` block entirely.
 * Exposes a download-ready Blob.
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { validate, LAGN_VERSION, type LAGN } from "@legendary-arena/lagn";
import type { MatchSetupDocument, SupportPool } from "@legendary-arena/registry/setupContract";
import type { LagnImportedResult } from "../lib/loadoutLagnImport";

/**
 * The export verdict state.
 *
 * why: D-24358 — a Loadout-tab export is a Tier-1 SETUP document, and LAGN makes
 * `result` optional. "unset" is the default because asserting no verdict is legal
 * and honest, whereas defaulting to "victory" claims an authority the loadout
 * builder does not have: it silently turned a real co-op loss (`scheme-wins`)
 * into an exported victory.
 */
export type LoadoutOutcomeState = "unset" | "victory" | "loss";

/**
 * Mid-execution amendments (spec vs actual LAGN v1.0 validator):
 *
 * 1. Variant enum (EC-276 §Locked Values):
 *    EC specifies "classic" | "custom", validator expects "solo" | "cooperative" | "competitive"
 *    Mapping: "classic" → "solo", "custom" → "cooperative"
 *
 * 2. Outcome enum (validator source of truth):
 *    EC specifies "victory" | "loss", validator expects "victory" | "defeat" ✓ (compatible)
 *
 * 3. Loss condition enum (EC-276 vs validator):
 *    EC specifies "unavailable", validator expects "mastermind_defeated" | "city_overrun" | "deck_exhausted"
 *    SUPERSEDED by D-24358 (WP-549): the exporter no longer DERIVES a loss condition
 *    at all. It is import-only — emitted solely when a round-tripped LAGN carried one.
 *    why: "deck_exhausted" was stamped on every defeat, which is wrong for a
 *    scheme-completion or mastermind loss; the server producer (matchLagn.logic.ts
 *    toLagnResult), the sole authority for a real verdict, deliberately never emits it.
 */

export interface UseLoadoutLagnExportApi {
  /** Derived (read-only) export variant: "classic" (solo) for 1 seat, "custom" (cooperative) for 2+. */
  variant: ComputedRef<"classic" | "custom">;
  /** Human-readable label for the derived variant, shown as read-only text in the UI. */
  variantLabel: ComputedRef<string>;
  outcome: Ref<LoadoutOutcomeState>;
  /**
   * Replaces the export verdict from a LAGN import (D-24358).
   *
   * REPLACE, never merge: `undefined` resets the outcome to "unset" and clears any
   * imported loss condition, and an import also overrides a prior USER choice —
   * matching `applyLagnImport`'s total-replace contract. Keeping a stale outcome
   * because the incoming file carried none is the exact bug class D-24358 forbids.
   */
  applyImportedResult: (result: LagnImportedResult | undefined) => void;
  gameId: Ref<string>;
  buildLagnFile: () => { file: string; gameId: string } | null;
  exportToJsonBlob: () => Blob;
  exportFilename: () => string;
  validationErrors: ComputedRef<string[]>;
  isValid: ComputedRef<boolean>;
  regenerateGameId: () => void;
}

/**
 * Generate a fresh UUID v4 using Web Crypto API.
 */
function generateGameId(): string {
  return crypto.randomUUID();
}

/**
 * Map the EC-276 user-facing variant to the LAGN validator enum.
 */
function mapVariantToLagn(userVariant: "classic" | "custom"): "solo" | "cooperative" | "competitive" {
  return userVariant === "classic" ? "solo" : "cooperative";
}

/**
 * Derive the user-facing export variant from the draft's seat count: a
 * single-seat draft is Classic (→ "solo"); any multi-seat draft is Custom
 * (→ "cooperative"). Mirrors the server-side `variantForSeatCount`
 * (`apps/server/src/match/matchLagn.logic.ts`) so the viewer's variant never
 * contradicts the player count — the engine has no competitive variant, so the
 * two are one axis, not two. This kills the "stuck on solo" trap where a
 * 2-player loadout (a fresh draft's default, or a multiplayer match imported via
 * `?lagn=`) exported as "solo" and failed the consistency guard.
 */
function variantForPlayerCount(playerCount: number): "classic" | "custom" {
  return playerCount === 1 ? "classic" : "custom";
}

/**
 * Map the EC-276 user-facing outcome to the LAGN validator enum.
 */
function mapOutcomeToLagn(userOutcome: "victory" | "loss"): "victory" | "defeat" {
  return userOutcome === "victory" ? "victory" : "defeat";
}

/**
 * Maps an imported LAGN verdict back onto the export's internal outcome state.
 *
 * why: D-24358 — the LAGN enum is `victory | defeat`; the internal state uses
 * `victory | loss` (the UI's wording). "unset" never reaches `mapOutcomeToLagn`.
 */
function mapLagnOutcomeToState(lagnOutcome: "victory" | "defeat"): LoadoutOutcomeState {
  return lagnOutcome === "victory" ? "victory" : "loss";
}

/**
 * Convert a MATCH-SETUP composition to LAGN GameSetup format.
 * All 9 composition fields are mapped per EC-276 locked values.
 */
/**
 * Translates the MATCH-SETUP envelope's `supportPools` into LAGN's
 * `setup.support_pools`.
 *
 * why: the two shapes are deliberately NOT identical — LAGN is snake_case and
 * names the officer pool `shield_officers` to match `shield_officers_count`
 * (D-24195), while the MATCH-SETUP envelope uses `officers` to match
 * `officersCount` (D-24194). Translating in one place keeps that rename from
 * being open-coded at each call site, the way `officersCount` ->
 * `shield_officers_count` already is below.
 */
function supportPoolsToLagn(
  pools: MatchSetupDocument["supportPools"],
): NonNullable<LAGN["setup"]["support_pools"]> | undefined {
  if (pools === undefined) {
    return undefined;
  }
  const out: NonNullable<LAGN["setup"]["support_pools"]> = {};
  const toLagnPool = (pool: SupportPool) => ({
    mode: pool.mode,
    ...(pool.sets === undefined ? {} : { sets: [...pool.sets] }),
    cards: pool.cards.map((card) => ({ ext_id: card.extId, copies: card.copies })),
  });
  if (pools.bystanders !== undefined) out.bystanders = toLagnPool(pools.bystanders);
  if (pools.wounds !== undefined) out.wounds = toLagnPool(pools.wounds);
  if (pools.officers !== undefined) out.shield_officers = toLagnPool(pools.officers);
  if (pools.sidekicks !== undefined) out.sidekicks = toLagnPool(pools.sidekicks);
  return Object.keys(out).length === 0 ? undefined : out;
}

function compositionToLagnSetup(
  composition: MatchSetupDocument["composition"],
  supportPools: MatchSetupDocument["supportPools"],
  resolveName: (extId: string) => string,
): LAGN["setup"] {
  const pools = supportPoolsToLagn(supportPools);
  // why: resolve each composition ext_id to its group-level display name via the
  // caller's resolver. The old code hardcoded `name: ""` on the false premise
  // that "the viewer only stores IDs" — the viewer loads the full registry, and
  // a blank name shipped every exported loadout with no human-readable entity
  // names (a Red Skull / Super Hero Civil War export showed only bare ext_ids).
  return {
    ...(pools === undefined ? {} : { support_pools: pools }),
    mastermind: {
      id: composition.mastermindId,
      name: resolveName(composition.mastermindId),
    },
    scheme: {
      id: composition.schemeId,
      name: resolveName(composition.schemeId),
    },
    villain_groups: composition.villainGroupIds.map((id) => ({ id, name: resolveName(id) })),
    henchmen_groups: composition.henchmanGroupIds.map((id) => ({ id, name: resolveName(id) })),
    heroes: composition.heroDeckIds.map((id) => ({ id, name: resolveName(id) })),
    bystanders_count: composition.bystandersCount,
    wounds_count: composition.woundsCount,
    shield_officers_count: composition.officersCount,
    sidekicks_count: composition.sidekicksCount,
  };
}

/**
 * Build a LAGN object from draft state and user-selected variant/outcome.
 * Returns null if composition is missing required fields.
 */
function buildLagnObject(
  draft: MatchSetupDocument,
  gameId: string,
  variant: "classic" | "custom",
  outcome: LoadoutOutcomeState,
  importedLossCondition: string | undefined,
  resolveName: (extId: string) => string,
): LAGN | null {
  const composition = draft.composition;

  // Validate that all required composition fields are present.
  if (!composition.mastermindId || !composition.schemeId) {
    return null;
  }
  if (composition.villainGroupIds.length === 0 || composition.henchmanGroupIds.length === 0) {
    return null;
  }
  if (composition.heroDeckIds.length === 0) {
    return null;
  }

  const setup = compositionToLagnSetup(composition, draft.supportPools, resolveName);
  const lagnVariant = mapVariantToLagn(variant);

  const document: LAGN = {
    lagn_version: LAGN_VERSION,
    $schema: "https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json",
    game_id: gameId,
    variant: lagnVariant,
    player_count: draft.playerCount,
    setup,
  };

  // why: D-24358 — build the `result` block CONDITIONALLY. An "unset" outcome must
  // leave the KEY ABSENT, not set to undefined: `JSON.stringify` would drop an
  // undefined value from the file while the in-memory object still carried the
  // property, so a test asserting only on the parsed file would pass on a shape the
  // contract forbids. `result` is optional in LAGN, so omitting it is valid.
  if (outcome === "unset") {
    return document;
  }

  const lagnOutcome = mapOutcomeToLagn(outcome);
  const result: NonNullable<LAGN["result"]> = { outcome: lagnOutcome };
  // why: D-24358 — `loss_condition` is IMPORT-ONLY; it is never derived from the
  // outcome. Emit it only when a round-tripped LAGN actually carried one.
  if (importedLossCondition !== undefined) {
    result.loss_condition = importedLossCondition as NonNullable<LAGN["result"]>["loss_condition"];
  }
  document.result = result;
  return document;
}

/**
 * Builds a loadout-LAGN-export composable for a given draft.
 * Each invocation returns an independent composable (no module-level state).
 *
 * @param draft The MATCH-SETUP draft to export.
 * @param resolveName Resolves a composition ext_id to its display name (build one
 *   from the loaded registry via `buildEntityNameResolver`). Defaults to
 *   id-fallback (name === ext_id) so a caller without a registry never emits a
 *   blank name.
 */
export function useLoadoutLagnExport(
  draft: Ref<MatchSetupDocument>,
  resolveName: (extId: string) => string = (extId) => extId,
): UseLoadoutLagnExportApi {
  // why: the variant is DERIVED from the draft's seat count, not chosen — the
  // engine has no competitive variant, so variant and player_count are one axis
  // (1 → solo, 2+ → cooperative), mirroring the server's variantForSeatCount. A
  // computed keeps it always consistent with player_count by construction, which
  // is why the old cross-field consistency guard is gone: the contradiction it
  // caught (a fixed "solo" default against a 2-seat draft) can no longer arise.
  const variant = computed<"classic" | "custom">(() =>
    variantForPlayerCount(draft.value.playerCount),
  );
  const variantLabel = computed<string>(() =>
    variant.value === "classic" ? "Solo (1 player)" : "Cooperative (2–5 players)",
  );
  // why: D-24358 — "unset" is the default, NOT "victory". See LoadoutOutcomeState.
  const outcome = ref<LoadoutOutcomeState>("unset");
  const gameId = ref<string>(generateGameId());

  // why: D-24358 — import-only, never derived. Holds the `loss_condition` a
  // round-tripped LAGN carried so it can be re-emitted verbatim; cleared on any
  // import that carries none, and on a user-chosen outcome.
  const importedLossCondition = ref<string | undefined>(undefined);

  function applyImportedResult(result: LagnImportedResult | undefined): void {
    // why: D-24358 — REPLACE, never merge. An import with no `result` resets to
    // "unset" and clears the loss condition; keeping the previous verdict because
    // the incoming file carried none is the bug class this WP exists to fix. This
    // also overrides a prior USER choice, matching applyLagnImport's total-replace
    // contract for every other field.
    if (result === undefined) {
      outcome.value = "unset";
      importedLossCondition.value = undefined;
      return;
    }
    outcome.value = mapLagnOutcomeToState(result.outcome);
    importedLossCondition.value = result.lossCondition;
  }

  const lagnObject = computed<LAGN | null>(() => {
    return buildLagnObject(
      draft.value,
      gameId.value,
      variant.value,
      outcome.value,
      importedLossCondition.value,
      resolveName,
    );
  });

  const validationErrors = computed<string[]>(() => {
    if (!lagnObject.value) {
      return ["Draft composition is incomplete (missing mastermind, scheme, villain group, henchman group, or hero group)."];
    }
    const result = validate(lagnObject.value);
    return result.valid ? [] : result.errors || [];
  });

  const isValid = computed<boolean>(() => validationErrors.value.length === 0);

  function buildLagnFile(): { file: string; gameId: string } | null {
    if (!isValid.value || !lagnObject.value) {
      return null;
    }
    // Custom replacer to maintain field order while preserving nested objects.
    // JSON.stringify's array replacer only works on top-level keys, so we use
    // a function replacer that orders keys but includes all nested properties.
    const keyOrder = [
      "lagn_version",
      "$schema",
      "game_id",
      "variant",
      "player_count",
      "setup",
      "result",
      "mastermind",
      "scheme",
      "villain_groups",
      "henchmen_groups",
      "heroes",
      "bystanders_count",
      "wounds_count",
      "shield_officers_count",
      "sidekicks_count",
      "outcome",
      "loss_condition",
      "id",
      "name",
    ];

    function replacer(key: string, value: unknown): unknown {
      if (typeof value !== "object" || value === null) {
        return value;
      }
      // Preserve arrays as arrays
      if (Array.isArray(value)) {
        return value;
      }
      const obj = value as Record<string, unknown>;
      const ordered: Record<string, unknown> = {};
      for (const k of keyOrder) {
        if (k in obj) {
          ordered[k] = obj[k];
        }
      }
      // Include any remaining keys not in keyOrder
      for (const k of Object.keys(obj)) {
        if (!(k in ordered)) {
          ordered[k] = obj[k];
        }
      }
      return ordered;
    }

    const file = JSON.stringify(lagnObject.value, replacer, 2);
    return { file, gameId: gameId.value };
  }

  function exportToJsonBlob(): Blob {
    const built = buildLagnFile();
    if (!built) {
      return new Blob([], { type: "application/json" });
    }
    return new Blob([built.file], { type: "application/json" });
  }

  function exportFilename(): string {
    return `game-${gameId.value}.lagn.json`;
  }

  function regenerateGameId(): void {
    gameId.value = generateGameId();
  }

  return {
    variant,
    variantLabel,
    outcome,
    applyImportedResult,
    gameId,
    buildLagnFile,
    exportToJsonBlob,
    exportFilename,
    validationErrors,
    isValid,
    regenerateGameId,
  };
}
