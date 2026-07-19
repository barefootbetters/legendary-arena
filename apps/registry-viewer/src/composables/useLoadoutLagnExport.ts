/**
 * useLoadoutLagnExport.ts — LAGN Tier 1 export composable for Registry Viewer Loadout tab (WP-245).
 *
 * Converts a MATCH-SETUP draft into LAGN Tier 1 JSON format, generates a UUID v4 game_id,
 * and validates the result via @legendary-arena/lagn. The variant is DERIVED from the
 * draft's seat count (read-only, not user-selected — see `variantForPlayerCount`); the
 * outcome stays user-selected. Exposes a download-ready Blob.
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
import { validate, LAGN_VERSION, type LAGN } from "@legendary-arena/lagn";
import type { MatchSetupDocument, SupportPool } from "@legendary-arena/registry/setupContract";

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
 *    Mapping: "loss" → "defeat" with loss_condition="deck_exhausted" (safest for setup-only exports)
 */

export interface UseLoadoutLagnExportApi {
  /** Derived (read-only) export variant: "classic" (solo) for 1 seat, "custom" (cooperative) for 2+. */
  variant: ComputedRef<"classic" | "custom">;
  /** Human-readable label for the derived variant, shown as read-only text in the UI. */
  variantLabel: ComputedRef<string>;
  outcome: Ref<"victory" | "loss">;
  lossReason: ComputedRef<"unavailable">;
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
): LAGN["setup"] {
  const pools = supportPoolsToLagn(supportPools);
  return {
    ...(pools === undefined ? {} : { support_pools: pools }),
    mastermind: {
      id: composition.mastermindId,
      name: "", // LAGN requires name field; registry viewer only stores ID. Validator handles optional resolution.
    },
    scheme: {
      id: composition.schemeId,
      name: "",
    },
    villain_groups: composition.villainGroupIds.map((id) => ({ id, name: "" })),
    henchmen_groups: composition.henchmanGroupIds.map((id) => ({ id, name: "" })),
    heroes: composition.heroDeckIds.map((id) => ({ id, name: "" })),
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
  outcome: "victory" | "loss",
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

  const setup = compositionToLagnSetup(composition, draft.supportPools);
  const lagnVariant = mapVariantToLagn(variant);
  const lagnOutcome = mapOutcomeToLagn(outcome);

  return {
    lagn_version: LAGN_VERSION,
    $schema: "https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json",
    game_id: gameId,
    variant: lagnVariant,
    player_count: draft.playerCount,
    setup,
    result: {
      outcome: lagnOutcome,
      loss_condition: lagnOutcome === "defeat" ? "deck_exhausted" : undefined,
    },
  };
}

/**
 * Builds a loadout-LAGN-export composable for a given draft.
 * Each invocation returns an independent composable (no module-level state).
 */
export function useLoadoutLagnExport(draft: Ref<MatchSetupDocument>): UseLoadoutLagnExportApi {
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
  const outcome = ref<"victory" | "loss">("victory");
  const gameId = ref<string>(generateGameId());

  const lossReason = computed<"unavailable">(() => "unavailable");

  const lagnObject = computed<LAGN | null>(() => {
    return buildLagnObject(draft.value, gameId.value, variant.value, outcome.value);
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
    lossReason,
    gameId,
    buildLagnFile,
    exportToJsonBlob,
    exportFilename,
    validationErrors,
    isValid,
    regenerateGameId,
  };
}
