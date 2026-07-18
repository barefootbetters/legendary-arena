/**
 * setupContract.types.ts — MATCH-SETUP document types for the registry-side
 * browser-safe validator and the registry-viewer loadout builder (WP-091).
 *
 * Canonical authority for the document shape:
 *   - docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md
 *   - docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json
 * Canonical authority for `heroSelectionMode` semantics, error code, error
 * message template, and human-readable label mapping:
 *   - docs/ai/DECISIONS.md — D-9301 (WP-093)
 *
 * Every field name here appears verbatim in the JSON document consumed by
 * the engine-side setup pipeline; drift is detected by the drift-detection
 * test inside setupContract.test.ts.
 */

// why: CardRegistryReader is redeclared registry-side (not imported) because
// packages/registry/** and apps/registry-viewer/** must never import from
// @legendary-arena/game-engine per the layer boundary in
// docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative). The real
// CardRegistry from @legendary-arena/registry satisfies this interface
// structurally via its listCards(): FlatCard[] surface.
//
// why: D-24018 — the validator now reads `extId` (the set-qualified
// "{setAbbr}/{slug}" form), not `key` (the flat-card display id). The engine's
// authoritative match-setup validator rejects flat-card keys (D-10014), so
// validating composition fields against `key` here green-lit loadouts the
// engine then rejected with an HTTP 500. Reading `extId` makes this validator
// accept exactly the id space the engine accepts.
//
// why: D-24091 — the reader is widened to `cardType` + `listSets` + `getSet`
// so the validator can check each composition field against its OWN entity
// id-space (per-field), not one type-blind global set. Scheme / mastermind /
// villain-group / hero ids are emitted onto `extId` by flattenSet and select by
// `cardType`; henchman-group ids are NOT emitted as flat cards, so they are
// derived from set data (`getSet(abbr)` → `henchmen[].slug`) — the same slug
// grammar the authoritative validator uses, re-derived registry-side to respect
// the layer boundary (no cross-layer import). The real CardRegistry already
// exposes all three members, so no production consumer changes.
export interface CardRegistryReader {
  /** Returns all cards. The validator selects per-field ext_ids by cardType. */
  listCards(): Array<{ extId: string; cardType: string }>;
  /** All loaded set index entries; henchman-group ids derive from set data. */
  listSets(): Array<{ abbr: string }>;
  /** Full set data for one set (read for its `henchmen[].slug` list). */
  getSet(abbr: string): unknown | undefined;
}

// why: SetupCompositionInput mirrors the engine's MatchSetupConfig
// (packages/game-engine/src/matchSetup.types.ts) field-for-field. The nine
// field names are locked by 00.2 §7 Match Configuration and by the
// 9-field composition lock in .claude/rules/code-style.md §Data Contracts.
// A compile-time drift-detection assertion in setupContract.test.ts keeps
// the registry-side mirror and the engine-side source of truth synchronized.
export interface SetupCompositionInput {
  schemeId: string;
  mastermindId: string;
  villainGroupIds: string[];
  henchmanGroupIds: string[];
  heroDeckIds: string[];
  bystandersCount: number;
  woundsCount: number;
  officersCount: number;
  sidekicksCount: number;
}

// why: HeroSelectionMode is a literal-union with exactly one v1 member
// ("GROUP_STANDARD") per WP-093 / D-9301. "HERO_DRAFT" is reserved for a
// future release and is deliberately NOT a member of the v1 union — adding
// it to the union here requires amending WP-093's naming-governance policy
// first (four-point policy, item 3). Future additions follow the same
// convention: amend D-9301, land a new DECISIONS entry, then extend this
// union.
export type HeroSelectionMode = "GROUP_STANDARD";

// why: WP-036 / D-24194 — support pools name WHICH bystander, wound, officer
// and sidekick cards make up the four supply piles; the composition block
// carries only HOW MANY. They live on the envelope, not the composition,
// because the 9-field composition lock (D-1244) forbids added fields while
// the envelope is extensible by design (MATCH-SETUP-SCHEMA.md §Extensibility
// Rules) — the same additive path `heroSelectionMode` took under WP-093 /
// D-9301.
//
// Absence is the default: no `supportPools` key means "unspecified pool,
// counts alone", which is every document written before this field existed.
// There is deliberately no "default" mode — absence already expresses it.
export type SupportPoolKind = "bystanders" | "wounds" | "officers" | "sidekicks";

/** Iteration order for the four support pools. */
export const SUPPORT_POOL_KINDS: readonly SupportPoolKind[] = [
  "bystanders",
  "wounds",
  "officers",
  "sidekicks",
] as const;

/**
 * How the author chose the pool. Stored alongside the resolved `cards` so a
 * preset round-trips the *intent* ("every sidekick in LGN-2E") and not just the
 * flattened result, which matters once the registry gains cards.
 */
export type SupportPoolMode = "sets" | "explicit";

/** One card in a support pool, with its multiplicity in the supply pile. */
export interface SupportPoolCard {
  /** Set-qualified ext_id, `<setAbbr>/<slug>`, per D-10014. */
  extId: string;
  /** Copies of this card in the pile. Positive; the pile total is the sum. */
  copies: number;
}

export interface SupportPool {
  mode: SupportPoolMode;
  /** Set abbreviations the pool was drawn from. Required when mode is "sets". */
  sets?: string[] | undefined;
  /**
   * The resolved cards. Always written — even in "sets" mode — so a record
   * stays reproducible against a registry snapshot that has since changed.
   */
  cards: SupportPoolCard[];
}

/**
 * Per-kind support pools. Any subset may be present; all are optional.
 *
 * why: written out longhand with explicit `| undefined` rather than
 * `Partial<Record<SupportPoolKind, SupportPool>>`. The package compiles under
 * `exactOptionalPropertyTypes`, where `Partial` means "may be absent" but NOT
 * "may be present and undefined" — which is exactly what zod's inferred output
 * type produces, so the Partial form fails to accept a parsed document.
 */
export interface SupportPools {
  bystanders?: SupportPool | undefined;
  wounds?: SupportPool | undefined;
  officers?: SupportPool | undefined;
  sidekicks?: SupportPool | undefined;
}

/**
 * SetupEnvelope — the MATCH-SETUP envelope metadata surrounding the
 * composition block. Field names and ordering match
 * MATCH-SETUP-JSON-SCHEMA.json verbatim.
 */
export interface SetupEnvelope {
  schemaVersion: "1.0";
  setupId: string;
  createdAt: string;
  createdBy: "player" | "system" | "simulation";
  seed: string;
  playerCount: number;
  themeId?: string;
  expansions: string[];
  heroSelectionMode?: HeroSelectionMode;
  supportPools?: SupportPools;
}

/**
 * Maps each support pool to the composition count it must agree with.
 *
 * why: the pool lives on the envelope and the count on the composition, so
 * "sum(copies) equals the count" is a cross-block invariant. This table is the
 * one place that pairing is written down — validators read it rather than
 * repeating four literal field names.
 */
export const SUPPORT_POOL_COUNT_FIELD: Readonly<
  Record<SupportPoolKind, keyof SetupCompositionInput>
> = {
  bystanders: "bystandersCount",
  wounds: "woundsCount",
  officers: "officersCount",
  sidekicks: "sidekicksCount",
} as const;

/**
 * MatchSetupDocument — the full authored document. Envelope fields are
 * flattened onto the root alongside a nested `composition` block, matching
 * the JSON shape documented in MATCH-SETUP-SCHEMA.md §Example.
 */
export interface MatchSetupDocument extends SetupEnvelope {
  composition: SetupCompositionInput;
}

/** Error code union for validator diagnostics. */
export type MatchSetupErrorCode =
  | "missing_field"
  | "unknown_extid"
  | "out_of_range"
  | "unknown_field"
  | "wrong_type"
  | "unsupported_hero_selection_mode";

/** A single validation error: field path, machine code, full-sentence message. */
export interface MatchSetupValidationError {
  field: string;
  code: MatchSetupErrorCode;
  message: string;
}

/** Result of validating a MATCH-SETUP document against the schema + registry. */
export type ValidateMatchSetupDocumentResult =
  | { ok: true; value: MatchSetupDocument }
  | { ok: false; errors: MatchSetupValidationError[] };

/**
 * UNSUPPORTED_HERO_SELECTION_MODE_TEMPLATE — the single source of truth
 * for the WP-093 error message template (D-9301). Both the zod-error upgrade
 * path (validator Step 1) and the defensive raw-input fallback (validator
 * Step 1b) substitute `<value>` into this string so byte-for-byte equality
 * with D-9301 is guaranteed regardless of which detector branch fires.
 * Tests assert exact-string equality with this constant; paraphrasing or
 * template-literal reassembly anywhere else is a WP-091 Session Abort
 * Condition.
 */
export const UNSUPPORTED_HERO_SELECTION_MODE_TEMPLATE =
  "The loadout envelope's heroSelectionMode is <value>, which is not a supported rule mode in v1 of the match setup schema. Supported modes: GROUP_STANDARD. (HERO_DRAFT is reserved for a future release and is not yet implemented.)";

/**
 * HERO_SELECTION_MODE_READONLY_LABEL — the full composed read-only label
 * the WP-091 rule-mode indicator renders. Sourced verbatim from D-9301 +
 * MATCH-SETUP-SCHEMA.md §Field Semantics / Hero Selection Mode. Consumed
 * byte-for-byte by LoadoutBuilder.vue.
 */
export const HERO_SELECTION_MODE_READONLY_LABEL =
  "Hero selection rule: GROUP_STANDARD — Classic Legendary hero groups";

/**
 * HERO_SELECTION_MODE_SHORT_LABEL — WP-093 short UI label for
 * "GROUP_STANDARD". Consumed byte-for-byte; never paraphrased as
 * "classic mode", "standard", "Legendary rules", etc.
 */
export const HERO_SELECTION_MODE_SHORT_LABEL =
  "Classic Legendary hero groups";

/**
 * HERO_SELECTION_MODE_LONG_EXPLANATION — WP-093 long explanation / hover
 * tooltip for "GROUP_STANDARD". The rule-mode indicator surfaces this
 * verbatim on hover.
 */
export const HERO_SELECTION_MODE_LONG_EXPLANATION =
  "The engine expands each selected hero group into its canonical card set at match start.";

/**
 * HERO_SELECTION_MODE_FUTURE_NOTICE — the one explanatory sentence WP-091
 * is permitted to emit beyond the machine name, sourced from D-9301's
 * future-notice UX copy. The info icon next to the rule-mode indicator
 * surfaces this verbatim; no other UI copy in the builder references
 * "Hero Draft" or "HERO_DRAFT" beyond this single sentence.
 */
export const HERO_SELECTION_MODE_FUTURE_NOTICE =
  "Hero Draft rules are planned for a future update.";
