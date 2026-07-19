/**
 * supportPreset.ts — Support Preset serialization (WP-391 / EC-428 / D-24200).
 *
 * A Support Preset is a named, reusable, lockable definition of the NON-HERO
 * board: the four supply piles (bystanders, wounds, S.H.I.E.L.D. officers,
 * sidekicks) as both their counts and, where set, the pools naming which cards
 * fill them. Freezing it is what makes hero selection the only variable when
 * comparing runs on legends.legendary-arena.com.
 *
 * Storage is FILE-ONLY by operator decision: a preset is a downloaded JSON file
 * re-applied by upload. This preserves the never-persists invariant declared at
 * the top of useLoadoutDraft.ts — no localStorage, sessionStorage, IndexedDB or
 * cookies — with no backend and no amendment to that rule.
 *
 * Pure module: no Vue reactivity, no I/O beyond returning strings, no engine
 * import. Parsing never throws; it returns a discriminated result so the caller
 * can surface a full-sentence error.
 */

import {
  SUPPORT_COUNT_MINIMUMS,
  SUPPORT_POOL_COUNT_FIELD,
  type MatchSetupDocument,
  type SupportPool,
  type SupportPoolCountField,
  type SupportPoolKind,
  type SupportPools,
} from "@legendary-arena/registry/setupContract";

/**
 * Bumped when the preset shape changes incompatibly.
 *
 * why: a preset file outlives the tab that made it — that is the entire point
 * of file-only storage — so it must say what it is. A reader that cannot
 * recognise the version refuses the file rather than guessing at its shape.
 */
export const SUPPORT_PRESET_VERSION = "1.0";

export const SUPPORT_PRESET_KINDS: readonly SupportPoolKind[] = [
  "bystanders",
  "wounds",
  "officers",
  "sidekicks",
] as const;

/** A light record of the registry a preset was authored against. */
export interface SupportPresetRegistrySnapshot {
  /** Set abbreviations loaded at authoring time, sorted. */
  sets: string[];
  /** Total flat-card count at authoring time. */
  cardCount: number;
}

export interface SupportPreset {
  presetVersion: typeof SUPPORT_PRESET_VERSION;
  presetId: string;
  name: string;
  createdAt: string;
  /**
   * Whether the pools are locked against edits.
   *
   * why: the lock travels IN the file, so a preset handed to someone else
   * arrives locked. A lock that lived only in the tab would be lost by the act
   * of sharing, which is when it matters most.
   */
  locked: boolean;
  /**
   * All four counts, always written — including kinds with no pool.
   *
   * why: a pool derives its count, but a kind with no pool is still part of the
   * frozen board. Recording only pools would let bystandersCount drift between
   * two runs of the "same" preset, which defeats the comparison the preset
   * exists to enable.
   */
  counts: Record<SupportPoolCountField, number>;
  /** Pools for whichever kinds have them; absent kinds are count-only. */
  supportPools?: SupportPools;
  registry?: SupportPresetRegistrySnapshot;
}

export type SupportPresetParseResult =
  | { ok: true; preset: SupportPreset }
  | { ok: false; error: string };

const PRESET_ID_PATTERN = /^[a-z0-9-]+$/;

/** Lowercases and hyphenates a display name into a usable presetId. */
export function slugifyPresetName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "support-preset" : slug;
}

/**
 * Builds a preset from the current draft.
 *
 * Reads only; never mutates the draft. Pools are deep-copied so a later edit to
 * the draft cannot reach back into an already-built preset.
 */
export function buildSupportPreset(
  draft: MatchSetupDocument,
  options: {
    name: string;
    locked: boolean;
    createdAt: string;
    registry?: SupportPresetRegistrySnapshot;
  },
): SupportPreset {
  const preset: SupportPreset = {
    presetVersion: SUPPORT_PRESET_VERSION,
    presetId: slugifyPresetName(options.name),
    name: options.name.trim(),
    createdAt: options.createdAt,
    locked: options.locked,
    counts: {
      bystandersCount: draft.composition.bystandersCount,
      woundsCount: draft.composition.woundsCount,
      officersCount: draft.composition.officersCount,
      sidekicksCount: draft.composition.sidekicksCount,
    },
  };
  const pools = clonePools(draft.supportPools);
  if (pools !== undefined) {
    preset.supportPools = pools;
  }
  if (options.registry !== undefined) {
    preset.registry = {
      sets: [...options.registry.sets].sort(),
      cardCount: options.registry.cardCount,
    };
  }
  return preset;
}

/** Deep-copies pools, or returns undefined when there are none. */
export function clonePools(pools: SupportPools | undefined): SupportPools | undefined {
  if (pools === undefined) {
    return undefined;
  }
  const out: SupportPools = {};
  for (const kind of SUPPORT_PRESET_KINDS) {
    const pool = pools[kind];
    if (pool === undefined) {
      continue;
    }
    const copy: SupportPool = {
      mode: pool.mode,
      cards: pool.cards.map((card) => ({ extId: card.extId, copies: card.copies })),
    };
    if (pool.sets !== undefined) {
      copy.sets = [...pool.sets];
    }
    out[kind] = copy;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

/** Serializes a preset with a stable key order so files diff cleanly. */
export function serializeSupportPreset(preset: SupportPreset): string {
  const keyOrder = [
    "presetVersion",
    "presetId",
    "name",
    "createdAt",
    "locked",
    "counts",
    "bystandersCount",
    "woundsCount",
    "officersCount",
    "sidekicksCount",
    "supportPools",
    "bystanders",
    "wounds",
    "officers",
    "sidekicks",
    "mode",
    "sets",
    "cards",
    "extId",
    "copies",
    "registry",
    "cardCount",
  ];
  // why: a replacer ARRAY is a whitelist — every key, nested ones included,
  // must appear above or it is dropped from the file. This is the same trap
  // that silently emptied pools in the MATCH-SETUP serializer (EC-425); the
  // round-trip test is what keeps it closed.
  return JSON.stringify(preset, keyOrder, 2);
}

export function supportPresetFilename(preset: SupportPreset): string {
  return `support-preset-${preset.presetId}.json`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePool(raw: unknown, kind: string): SupportPool | string {
  if (!isPlainObject(raw)) {
    return `The ${kind} pool must be an object.`;
  }
  const mode = raw["mode"];
  if (mode !== "sets" && mode !== "explicit") {
    return `The ${kind} pool's mode must be either "sets" or "explicit".`;
  }
  const rawCards = raw["cards"];
  if (!Array.isArray(rawCards) || rawCards.length === 0) {
    return `The ${kind} pool must list at least one card.`;
  }
  const cards: SupportPool["cards"] = [];
  for (const entry of rawCards) {
    if (!isPlainObject(entry)) {
      return `Every card in the ${kind} pool must be an object.`;
    }
    const extId = entry["extId"];
    const copies = entry["copies"];
    if (typeof extId !== "string" || extId === "") {
      return `Every card in the ${kind} pool must carry a non-empty extId string.`;
    }
    if (typeof copies !== "number" || !Number.isInteger(copies) || copies <= 0) {
      return `Every card in the ${kind} pool must carry a positive integer copies value; ${extId} does not.`;
    }
    cards.push({ extId, copies });
  }
  const pool: SupportPool = { mode, cards };
  const rawSets = raw["sets"];
  if (rawSets !== undefined) {
    if (!Array.isArray(rawSets) || rawSets.some((entry) => typeof entry !== "string")) {
      return `The ${kind} pool's sets must be an array of set abbreviations.`;
    }
    pool.sets = rawSets as string[];
  }
  // why: mirrors the D-24194 contract rule rather than trusting the file — a
  // preset is user-supplied input and may have been hand-edited.
  if (pool.mode === "sets" && pool.sets === undefined) {
    return `The ${kind} pool is in "sets" mode but does not list the sets it was drawn from.`;
  }
  if (pool.mode === "explicit" && pool.sets !== undefined) {
    return `The ${kind} pool is in "explicit" mode and must not carry a sets array.`;
  }
  return pool;
}

/**
 * Parses preset JSON. Never throws.
 *
 * Validates the cross-field invariant D-24194 enforces on the document — each
 * pool's copies must sum to its paired count — and the D-24032 supply floors,
 * so a bad preset is refused at load rather than producing a draft that fails
 * at match creation.
 */
export function parseSupportPreset(text: string): SupportPresetParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "The preset file is not valid JSON." };
  }
  if (!isPlainObject(raw)) {
    return { ok: false, error: "The preset file must contain a JSON object." };
  }
  if (raw["presetVersion"] !== SUPPORT_PRESET_VERSION) {
    return {
      ok: false,
      error: `This build reads Support Preset version ${SUPPORT_PRESET_VERSION}; the file declares ${JSON.stringify(raw["presetVersion"])}.`,
    };
  }
  const name = raw["name"];
  if (typeof name !== "string" || name.trim() === "") {
    return { ok: false, error: "The preset must carry a non-empty name." };
  }
  const presetId = raw["presetId"];
  if (typeof presetId !== "string" || !PRESET_ID_PATTERN.test(presetId)) {
    return {
      ok: false,
      error: "The presetId must match the pattern ^[a-z0-9-]+$ (lowercase letters, digits, and hyphens).",
    };
  }
  const locked = raw["locked"];
  if (typeof locked !== "boolean") {
    return { ok: false, error: "The preset's locked field must be true or false." };
  }
  const rawCounts = raw["counts"];
  if (!isPlainObject(rawCounts)) {
    return { ok: false, error: "The preset must carry a counts object." };
  }
  const counts = {} as Record<SupportPoolCountField, number>;
  for (const kind of SUPPORT_PRESET_KINDS) {
    const field = SUPPORT_POOL_COUNT_FIELD[kind];
    const value = rawCounts[field];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return { ok: false, error: `The preset's ${field} must be a non-negative integer.` };
    }
    const minimum = SUPPORT_COUNT_MINIMUMS[field];
    if (value < minimum) {
      return {
        ok: false,
        error: `The preset's ${field} is ${value}, below the minimum of ${minimum} the game server requires; this preset would fail at match creation.`,
      };
    }
    counts[field] = value;
  }

  const preset: SupportPreset = {
    presetVersion: SUPPORT_PRESET_VERSION,
    presetId,
    name: name.trim(),
    createdAt: typeof raw["createdAt"] === "string" ? raw["createdAt"] : "",
    locked,
    counts,
  };

  const rawPools = raw["supportPools"];
  if (rawPools !== undefined) {
    if (!isPlainObject(rawPools)) {
      return { ok: false, error: "The preset's supportPools must be an object." };
    }
    const pools: SupportPools = {};
    for (const kind of SUPPORT_PRESET_KINDS) {
      const rawPool = rawPools[kind];
      if (rawPool === undefined) {
        continue;
      }
      const parsed = parsePool(rawPool, kind);
      if (typeof parsed === "string") {
        return { ok: false, error: parsed };
      }
      const total = parsed.cards.reduce((sum, card) => sum + card.copies, 0);
      const declared = counts[SUPPORT_POOL_COUNT_FIELD[kind]];
      if (total !== declared) {
        return {
          ok: false,
          error: `The ${kind} pool sums to ${total} copies but the preset declares ${SUPPORT_POOL_COUNT_FIELD[kind]} ${declared}; the two must agree.`,
        };
      }
      pools[kind] = parsed;
    }
    if (Object.keys(pools).length > 0) {
      preset.supportPools = pools;
    }
  }

  const rawRegistry = raw["registry"];
  if (isPlainObject(rawRegistry)) {
    const sets = rawRegistry["sets"];
    const cardCount = rawRegistry["cardCount"];
    if (Array.isArray(sets) && sets.every((entry) => typeof entry === "string") && typeof cardCount === "number") {
      preset.registry = { sets: sets as string[], cardCount };
    }
  }

  return { ok: true, preset };
}
