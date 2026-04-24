/**
 * useLoadoutDraft.ts — Vue composable for the registry-viewer's Loadout tab
 * (WP-091).
 *
 * Maintains an in-memory MATCH-SETUP draft and exposes mutator methods,
 * a live validation error list, JSON export/import, and "Start from
 * theme" pre-fill. Never persists (no localStorage / sessionStorage /
 * IndexedDB / cookies); re-opening the tab starts a fresh draft. Never
 * contacts the game server; the browser's download/upload is the only
 * external surface.
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";
// why: Import from the narrow `./setupContract` subpath (not the
// `@legendary-arena/registry` root barrel) because the root re-exports a
// node-only local-file registry factory (`node:fs/promises`, `node:path`)
// that breaks Vite's browser build. Same mitigation pattern as
// themeClient.ts for `./schema` and `./theme.schema`.
import {
  validateMatchSetupDocument,
  type CardRegistryReader,
  type HeroSelectionMode,
  type MatchSetupDocument,
  type MatchSetupValidationError,
  type ValidateMatchSetupDocumentResult,
} from "@legendary-arena/registry/setupContract";

import type { ThemeDefinition } from "../lib/themeClient";

/** Default pile-count values from EC-091 §Locked Values / §3.7. */
const DEFAULT_BYSTANDERS_COUNT = 30;
const DEFAULT_WOUNDS_COUNT = 30;
const DEFAULT_OFFICERS_COUNT = 30;
const DEFAULT_SIDEKICKS_COUNT = 0;
const DEFAULT_PLAYER_COUNT = 2;
const DEFAULT_EXPANSIONS = ["base"] as const;

/**
 * Generates a fresh 16-hex-character opaque seed.
 *
 * // why: Web Crypto (not Math.random) so the seed remains
 * // determinism-compatible with engine `ctx.random.*` downstream. The
 * // engine consumes this string as an opaque anchor; WP-091 never
 * // parses, interprets, hashes, or validates it beyond length/format.
 */
function generateSeed(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/**
 * Builds a fresh blank draft with all envelope defaults populated and
 * composition fields empty. Composition counts default per EC-091
 * §Locked Values; the user may override any field before export.
 */
function createBlankDraft(): MatchSetupDocument {
  const createdAt = new Date().toISOString();
  return {
    schemaVersion: "1.0",
    setupId: `setup-${createdAt.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
    createdAt,
    createdBy: "player",
    seed: generateSeed(),
    playerCount: DEFAULT_PLAYER_COUNT,
    expansions: [...DEFAULT_EXPANSIONS],
    // why: Downloaded JSON always emits heroSelectionMode explicitly
    // (L4 / WP-093 builder-emission policy). The backward-compat
    // absent-default is for accepting older uploaded JSON only — the
    // builder's authoring output is never implicit.
    heroSelectionMode: "GROUP_STANDARD",
    composition: {
      schemeId: "",
      mastermindId: "",
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: DEFAULT_BYSTANDERS_COUNT,
      woundsCount: DEFAULT_WOUNDS_COUNT,
      officersCount: DEFAULT_OFFICERS_COUNT,
      sidekicksCount: DEFAULT_SIDEKICKS_COUNT,
    },
  };
}

/** The public API returned by `useLoadoutDraft()`. */
export interface UseLoadoutDraftApi {
  draft: Ref<MatchSetupDocument>;
  errors: ComputedRef<MatchSetupValidationError[]>;
  isValid: ComputedRef<boolean>;
  setScheme: (schemeId: string) => void;
  setMastermind: (mastermindId: string) => void;
  addVillainGroup: (groupId: string) => void;
  removeVillainGroup: (groupId: string) => void;
  addHenchmanGroup: (groupId: string) => void;
  removeHenchmanGroup: (groupId: string) => void;
  addHeroGroup: (groupId: string) => void;
  removeHeroGroup: (groupId: string) => void;
  setCount: (
    field: "bystandersCount" | "woundsCount" | "officersCount" | "sidekicksCount",
    value: number,
  ) => void;
  setPlayerCount: (value: number) => void;
  setSeed: (seed: string) => void;
  reRollSeed: () => void;
  setThemeId: (themeId: string | undefined) => void;
  setHeroSelectionMode: (mode: HeroSelectionMode) => void;
  prefillFromTheme: (theme: ThemeDefinition) => void;
  loadFromJson: (
    jsonText: string,
  ) => { ok: true } | { ok: false; errors: MatchSetupValidationError[] };
  exportToJsonBlob: () => Blob;
  exportFilename: () => string;
  resetDraft: () => void;
}

/**
 * Builds a loadout-draft composable bound to the supplied card registry.
 * Each invocation returns an independent draft (no module-level state,
 * no singletons).
 *
 * @param registry - A CardRegistryReader whose `listCards()` surface
 *                   supplies the ext_id universe for validation.
 */
export function useLoadoutDraft(registry: CardRegistryReader): UseLoadoutDraftApi {
  const draft = ref<MatchSetupDocument>(createBlankDraft());

  const validationResult = computed<ValidateMatchSetupDocumentResult>(() => {
    return validateMatchSetupDocument(draft.value, registry);
  });

  const errors = computed<MatchSetupValidationError[]>(() => {
    const result = validationResult.value;
    if (result.ok) {
      return [];
    }
    return result.errors;
  });

  const isValid = computed<boolean>(() => validationResult.value.ok);

  function setScheme(schemeId: string): void {
    draft.value.composition.schemeId = schemeId.trim();
  }

  function setMastermind(mastermindId: string): void {
    draft.value.composition.mastermindId = mastermindId.trim();
  }

  function addUniqueId(list: string[], groupId: string): void {
    const trimmed = groupId.trim();
    if (trimmed === "") {
      return;
    }
    if (list.includes(trimmed)) {
      return;
    }
    list.push(trimmed);
  }

  function removeId(list: string[], groupId: string): void {
    const index = list.indexOf(groupId);
    if (index >= 0) {
      list.splice(index, 1);
    }
  }

  function addVillainGroup(groupId: string): void {
    addUniqueId(draft.value.composition.villainGroupIds, groupId);
  }

  function removeVillainGroup(groupId: string): void {
    removeId(draft.value.composition.villainGroupIds, groupId);
  }

  function addHenchmanGroup(groupId: string): void {
    addUniqueId(draft.value.composition.henchmanGroupIds, groupId);
  }

  function removeHenchmanGroup(groupId: string): void {
    removeId(draft.value.composition.henchmanGroupIds, groupId);
  }

  function addHeroGroup(groupId: string): void {
    addUniqueId(draft.value.composition.heroDeckIds, groupId);
  }

  function removeHeroGroup(groupId: string): void {
    removeId(draft.value.composition.heroDeckIds, groupId);
  }

  function setCount(
    field: "bystandersCount" | "woundsCount" | "officersCount" | "sidekicksCount",
    value: number,
  ): void {
    const coerced = Number.isFinite(value) ? Math.trunc(value) : 0;
    const clamped = coerced < 0 ? 0 : coerced;
    draft.value.composition[field] = clamped;
  }

  function setPlayerCount(value: number): void {
    const coerced = Number.isFinite(value) ? Math.trunc(value) : DEFAULT_PLAYER_COUNT;
    draft.value.playerCount = coerced;
  }

  function setSeed(seed: string): void {
    draft.value.seed = seed.trim();
  }

  function reRollSeed(): void {
    draft.value.seed = generateSeed();
  }

  function setThemeId(themeId: string | undefined): void {
    if (themeId === undefined || themeId === "") {
      delete draft.value.themeId;
      return;
    }
    draft.value.themeId = themeId;
  }

  function setHeroSelectionMode(mode: HeroSelectionMode): void {
    draft.value.heroSelectionMode = mode;
  }

  function prefillFromTheme(theme: ThemeDefinition): void {
    // why: Spread-copy every array field from the theme before assigning
    // to the draft (L10 / A-091-04 / copilot Issue 17 FIX). Direct
    // reference assignment would alias the registry-loaded theme
    // singleton and let subsequent draft edits corrupt every consumer
    // holding that reference. Precedent: WP-028 projection-aliasing
    // post-mortem. Scalar fields (schemeId, mastermindId) are immutable
    // strings so no spread is needed.
    const composition = draft.value.composition;
    composition.schemeId = theme.setupIntent.schemeId;
    composition.mastermindId = theme.setupIntent.mastermindId;
    composition.villainGroupIds = [...theme.setupIntent.villainGroupIds];
    composition.henchmanGroupIds = [...theme.setupIntent.henchmanGroupIds];
    composition.heroDeckIds = [...theme.setupIntent.heroDeckIds];
    draft.value.themeId = theme.themeId;
  }

  function loadFromJson(
    jsonText: string,
  ): { ok: true } | { ok: false; errors: MatchSetupValidationError[] } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseFailure) {
      const message =
        parseFailure instanceof Error ? parseFailure.message : String(parseFailure);
      return {
        ok: false,
        errors: [
          {
            field: "root",
            code: "wrong_type",
            message: `The pasted text could not be parsed as JSON: ${message}`,
          },
        ],
      };
    }
    const result = validateMatchSetupDocument(parsed, registry);
    if (!result.ok) {
      return { ok: false, errors: result.errors };
    }
    draft.value = result.value;
    return { ok: true };
  }

  function buildSerializedDocument(): string {
    // why: Deterministic key ordering across two consecutive exports of
    // the same draft. JSON.stringify(value, replacer) with an array
    // replacer emits fields in the supplied order; fields in the array
    // but absent from the object are silently skipped. Envelope fields
    // come first (schema order), then composition last. This also keeps
    // downloaded JSON stable under `git diff` and easy for reviewers to
    // scan.
    const keyOrder: readonly string[] = [
      "schemaVersion",
      "setupId",
      "createdAt",
      "createdBy",
      "seed",
      "playerCount",
      "themeId",
      "expansions",
      "heroSelectionMode",
      "composition",
      "schemeId",
      "mastermindId",
      "villainGroupIds",
      "henchmanGroupIds",
      "heroDeckIds",
      "bystandersCount",
      "woundsCount",
      "officersCount",
      "sidekicksCount",
    ];
    return JSON.stringify(draft.value, keyOrder as string[], 2);
  }

  function exportToJsonBlob(): Blob {
    return new Blob([buildSerializedDocument()], { type: "application/json" });
  }

  function exportFilename(): string {
    const slug = draft.value.composition.schemeId.trim();
    if (slug !== "") {
      return `loadout-${slug}.json`;
    }
    const fallback = draft.value.createdAt.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    return `loadout-${fallback}.json`;
  }

  function resetDraft(): void {
    draft.value = createBlankDraft();
  }

  return {
    draft,
    errors,
    isValid,
    setScheme,
    setMastermind,
    addVillainGroup,
    removeVillainGroup,
    addHenchmanGroup,
    removeHenchmanGroup,
    addHeroGroup,
    removeHeroGroup,
    setCount,
    setPlayerCount,
    setSeed,
    reRollSeed,
    setThemeId,
    setHeroSelectionMode,
    prefillFromTheme,
    loadFromJson,
    exportToJsonBlob,
    exportFilename,
    resetDraft,
  };
}
