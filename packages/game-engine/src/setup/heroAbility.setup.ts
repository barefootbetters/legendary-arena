/**
 * Hero ability hook builder for setup-time resolution.
 *
 * Resolves hero cards from the selected hero decks, extracts structured
 * ability metadata from markup patterns, and produces a list of
 * HeroAbilityHook entries stored in G.heroAbilityHooks.
 *
 * No boardgame.io imports. No .reduce(). No throws. Setup-time only.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type {
  HeroAbilityHook,
  HeroCondition,
  HeroEffectDescriptor,
} from '../rules/heroAbility.types.js';
import type { HeroKeyword, HeroAbilityTiming } from '../rules/heroKeywords.js';
import { HERO_KEYWORDS } from '../rules/heroKeywords.js';
import type { HeroCountSource } from '../rules/heroCountSource.js';
import { HERO_COUNT_SOURCES } from '../rules/heroCountSource.js';
import type { RevealRule, RevealPredicate, RevealAction } from '../rules/revealRule.js';
import { revealRulesForLegacyKeyword, REVEAL_KEYWORDS } from '../rules/revealRule.js';
import type { EffectNode } from '../rules/effectPrimitive.types.js';
import {
  HERO_COMPOSITION_MARKERS,
  HERO_COMPOSITION_MARKER_NAMES,
  PARAMETERIZED_COMPOSITION_MARKER_NAMES,
  buildEmpoweredComposition,
  buildEmpoweredFreeChoiceComposition,
  buildEmpoweredChooseOneComposition,
  buildDynamicEmpoweredComposition,
} from '../rules/heroCompositions.js';
import { normalizeTraitSlug } from '../state/traits.normalize.js';
// why: D-18705 / D-18706 — hero hooks must key by the canonical-face slash
// instance id (the id the played card carries in `G` zones), resolving
// ability text from the canonical face (sides[0]). The shared emitter is the
// single source of those instance ids (import-not-duplicate, D-13702 RS-4).
import { heroCardInstanceExtIds } from './buildHeroDeck.js';

// ---------------------------------------------------------------------------
// HeroAbilityRegistryReader — local structural interface
// ---------------------------------------------------------------------------

// why: game-engine must not import @legendary-arena/registry; this interface
// is satisfied structurally by CardRegistry. It exposes the minimum fields
// needed for hero ability hook resolution at setup time.

/**
 * Minimal structural type for a flat card with hero ability data.
 * Matches a subset of FlatCard from the registry package.
 */
export interface HeroAbilityFlatCard {
  /** Unique key in format {setAbbr}-{cardType}-{groupSlug}-{cardSlug}. */
  key: string;
  /** Coarse card type: "hero", "mastermind", "villain", or "scheme". */
  cardType: string;
  /** Set abbreviation (e.g., "core", "2099"). */
  setAbbr: string;
  /** Card ability text lines with structured markup. */
  abilities: string[];
}

/**
 * Setup-time registry interface for hero ability hook resolution.
 *
 * Satisfied structurally by the real CardRegistry. Defined locally to
 * respect the layer boundary (same pattern as CardStatsRegistryReader
 * in economy.logic.ts).
 */
export interface HeroAbilityRegistryReader {
  /** All flat cards across all loaded sets. */
  listCards(): HeroAbilityFlatCard[];
}

// why: hook resolution reads the per-card ability text and the canonical-face
// (sides[0]) mapping from the hero entry in set data — the same source the
// hero deck reservoir and buildCardStats §1b read. The local structural
// interfaces respect the layer boundary (no @legendary-arena/registry import).

/**
 * Minimal structural type for one hero card entry in SetData.heroes[i].cards[j].
 *
 * `slug` is matched against the canonical-face slug (`physicalCards[].sides[0]`)
 * to resolve the ability text the played-card instance carries. `abilities`
 * holds the structured markup lines parsed into hooks.
 */
interface HeroAbilityHeroCardEntry {
  slug: string;
  name?: string;
  rarityLabel?: string;
  abilities?: string[];
}

/**
 * Minimal structural type for a hero entry in SetData.heroes[i].
 *
 * Carries the per-card data (`cards`) plus the copy-count / canonical-face
 * sources (`physicalCards`, `cardCounts`) the shared instance-id emitter reads.
 */
interface HeroAbilityHeroEntry {
  slug: string;
  cards: HeroAbilityHeroCardEntry[];
  physicalCards?: unknown;
  cardCounts?: unknown;
}

// ---------------------------------------------------------------------------
// Markup extraction — structured patterns only, no NL parsing
// ---------------------------------------------------------------------------

/** Regex for [hc:X] hero class condition markup. */
const HERO_CLASS_PATTERN = /\[hc:([^\]]+)\]/g;

// why: mirrors the [hc:X] pattern — same extraction semantics, same consumption
// behavior (markup tokens removed from downstream text after extraction).
/** Regex for [team:X] team condition markup. */
const TEAM_PATTERN = /\[team:([^\]]+)\]/g;

// why: optional :N suffix carries magnitude for rescue/reveal effects (D-21503)
// why: hyphen allowed in keyword names to support reveal-ko and reveal-min tokens (D-21701, D-21702)
/** Regex for [keyword:X] or [keyword:X:N] keyword markup (N = non-negative integer). */
const KEYWORD_PATTERN = /\[keyword:([a-zA-Z][a-zA-Z-]*)(?::(\d+))?\]/g;

// why: D-24044 — the ANCHORED Empowered parameter tail. The color must immediately follow
// the `[keyword:Empowered]` token as `by [hc:COLOR]` (the `^` anchors to the text right after
// the marker — a broad forward scan could wrongly bind a later, unrelated [hc:...] to
// Empowered). Non-global + stateless: a fresh `.exec` against the post-marker slice.
/** Regex for the anchored `by [hc:COLOR]` tail immediately after `[keyword:Empowered]`. */
const EMPOWERED_PARAM_TAIL_PATTERN = /^\s*by\s*\[hc:([a-z0-9-]+)\]/i;

// why: D-24047 — the ANCHORED leading `[hc:X]:` class-condition prefix gate of the
// conditional-prefix Empowered form. The `^` anchors to the line start so only a leading
// class condition (not a later, unrelated `[hc:...]`) is read as the gate; mirrors
// EMPOWERED_PARAM_TAIL_PATTERN's anchored, non-global, stateless `.exec` discipline.
/** Regex for the anchored leading `[hc:X]:` class-condition prefix gate. */
const EMPOWERED_PREFIX_GATE_PATTERN = /^\s*\[hc:([a-z0-9-]+)\]\s*:/i;

// why: D-24047 — gate #2 of the structural resolve gate counts `[keyword:Empowered]`
// markers (case-insensitive); the conditional-prefix form resolves ONLY a single marker.
// This is what rejects the two-marker choose-one (fight-or-flight); a condition-counting
// gate would mis-resolve it (the Honest-Partial Invariant). Global so String.match returns
// every occurrence (String.match ignores lastIndex, so the shared const stays stateless).
/** Regex for counting `[keyword:Empowered]` marker occurrences (case-insensitive). */
const EMPOWERED_MARKER_COUNT_PATTERN = /\[keyword:empowered\]/gi;

// why: D-24047 — gate #5 of the structural resolve gate rejects a multi-class continuation
// `... by [hc:Y] and [hc:Z]`. Applied ONLY to the slice after the consumed count tail
// (never a broad scan of the whole text); anchored, non-global, stateless `.exec`/`.test`.
/** Regex for an `and [hc:...]` multi-class continuation immediately after the count tail. */
const EMPOWERED_MULTICLASS_TAIL_PATTERN = /^\s*and\s*\[hc:/i;

// why: WP-310 / D-24098 — the anchored MULTI-class Empowered tail
// `by [hc:X] and [hc:Y] (and [hc:Z]…)`. The `(?:…)+` requires at least ONE
// `and [hc:…]` continuation, so this NEVER matches the single-class `by [hc:X]`
// form (owned by tryResolveEmpoweredCore) — preserving the single-class path.
// Anchored to the post-marker slice, non-global, stateless `.exec`.
/** Regex for the anchored multi-class `by [hc:X] and [hc:Y] (and …)` tail. */
const EMPOWERED_MULTICLASS_FULL_TAIL_PATTERN =
  /^\s*by\s*\[hc:[a-z0-9-]+\](?:\s*and\s*\[hc:[a-z0-9-]+\])+/i;

// why: D-24063 — anchored "Choose one:" prefix gate for the choose-one Empowered pre-pass.
// Non-global + anchored so it only fires when the line STARTS with this prefix; reuses the
// stateless `.test` discipline of EMPOWERED_PREFIX_GATE_PATTERN (no lastIndex concern).
/** Regex for the anchored "Choose one:" choose-one form prefix. */
const EMPOWERED_CHOOSE_ONE_PREFIX_PATTERN = /^\s*Choose one\s*:/i;

// why: D-24063 — extracts each `[keyword:Empowered] by [hc:X]` class tail from a choose-one
// line. Stored as non-global source; a fresh new RegExp(source, 'gi') is created inside the
// helper to avoid lastIndex state on the module-level const (same pattern as HERO_CLASS_PATTERN).
/** Regex source for `[keyword:Empowered] by [hc:X]` — instantiated global inside the choose-one helper. */
const EMPOWERED_CHOOSE_ONE_CLASS_TAIL_PATTERN = /\[keyword:Empowered\]\s*by\s*\[hc:([a-z0-9-]+)\]/i;

// why: D-24069 — the draw-or-empowered choose-one form pairs a printed "Draw a card" option with a
// single Empowered marker. This presence check distinguishes it from the WP-283 two-empowered
// choose-one (which offers two Empowered halves and no draw). Non-global so the stateless `.test`
// carries no lastIndex; the structural work is done by the prefix + single-marker + class-tail gates.
/** Regex for the "Draw a card" draw option in a draw-or-empowered choose-one line. */
const DRAW_A_CARD_PATTERN = /Draw a card/i;

// why: D-24065 — anchored pattern for the dynamic Empowered form whose class is the runtime
// class of a revealed card, not a static `[hc:X]` literal. Locked to this exact phrasing
// (cross-the-multiverse); wildcard extension beyond this phrasing family is forbidden.
/** Regex for the "by the Hero Classes of the card you revealed this way" dynamic tail. */
const EMPOWERED_REVEALED_CLASSES_PATTERN = /by the Hero Classes of the card you revealed this way/i;

// why: D-24016 — the count-scaled attack token has three segments
// ([keyword:attack-per-count:<source>:<perUnit>]); KEYWORD_PATTERN only captures
// keyword(:N)?, so the count source and per-unit rate need a dedicated pattern.
/** Regex for [keyword:attack-per-count:<source>:<perUnit>] count-scaled markup. */
const COUNT_SCALED_PATTERN = /\[keyword:attack-per-count:([a-z][a-z-]*):(\d+)\]/g;

// why: D-24019 — the optional-KO-reward token has three segments
// ([keyword:optional-ko-reward:<reward>:<n>]); KEYWORD_PATTERN cannot match it
// (it stops at the second colon), so the reward and magnitude need a dedicated
// pattern. The capture group is (\d+) — matching the COUNT_SCALED_PATTERN
// precedent, NOT [1-9]\d*. The strict [1-9]\d* gate is the apply-script's job
// (build time); here the parser captures the integer and the n ≥ 1 check is
// enforced downstream (isValidMagnitude at the reward executor).
/** Regex for [keyword:optional-ko-reward:<reward>:<n>] optional-KO-reward markup. */
const OPTIONAL_KO_REWARD_PATTERN = /\[keyword:optional-ko-reward:([a-z][a-z-]*):(\d+)\]/g;

// why: WP-382 / D-24183 — the ko-wound-reward token mirrors optional-ko-reward's
// three-segment shape ([keyword:ko-wound-reward:<reward>:<n>]); like it, the
// third `:<reward>` segment means KEYWORD_PATTERN cannot match it, so it never
// reaches the unresolved-marker scan.
/** Regex for [keyword:ko-wound-reward:<reward>:<n>] KO-a-Wound-then-reward markup. */
const KO_WOUND_REWARD_PATTERN = /\[keyword:ko-wound-reward:([a-z][a-z-]*):(\d+)\]/g;

// why: [keyword:optional-put-bottom-hq:<n>] token for "You may put a card from the
// HQ on the bottom of the Hero Deck". Simple 2-segment token carrying just the
// magnitude (always 1 for this MVP form). Follows the COUNT_SCALED_PATTERN precedent.
/** Regex for [keyword:optional-put-bottom-hq:<n>] optional-put-bottom-HQ markup. */
const OPTIONAL_PUT_BOTTOM_HQ_PATTERN = /\[keyword:optional-put-bottom-hq:(\d+)\]/g;

// why: D-24132 — [keyword:put-any-number-bottom-hq:<n>] token for "Choose any number of
// cards/Heroes from the HQ. Put them on the bottom of the Hero Deck" (the MULTI-select
// sibling of optional-put-bottom-hq). Simple 2-segment token carrying just the magnitude
// (always 1 for this MVP form). Follows the OPTIONAL_PUT_BOTTOM_HQ_PATTERN precedent.
/** Regex for [keyword:put-any-number-bottom-hq:<n>] put-any-number-bottom-HQ markup. */
const PUT_ANY_NUMBER_BOTTOM_HQ_PATTERN = /\[keyword:put-any-number-bottom-hq:(\d+)\]/g;

// why: D-24133 — the MANDATORY single-card "Put a card from the HQ on the bottom of the
// Hero Deck. If that card had a recruit/attack icon, you get +N" form (Wonder Man's Absorb
// Ambient Power) is marked `[keyword:put-bottom-hq-icon-reward:<n>]`. It needs NO dedicated
// extraction step: the generic KEYWORD_PATTERN loop (Step 2) already matches the 2-segment
// token, records the keyword, and captures the magnitude N (the icon-reward amount); the
// effect builder's fallback emits `{ type, magnitude }`, and the park handler reads the
// magnitude. (The sibling optional-/put-any-number- dedicated steps are belt-and-suspenders;
// deduplicateKeywords collapses the double-push.)

// why: D-24132 — a put-any-number-bottom-hq line MAY carry a trailing "Then you get
// [keyword:Empowered] by [hc:X] (and [hc:Y]…)" grant on the SAME line (Wonder Man's 8th
// Wonder of the World). This detection pattern finds the `[keyword:Empowered]` token so the
// pre-pass can slice the anchored `by [hc:…]` tail after it and route the classes onto the
// put-any-number effect (applied AFTER the moves at resolve time) instead of a play-time
// standalone Empowered primitive. Non-global source; a fresh RegExp is created per use.
/** Regex for the `[keyword:Empowered]` token (case-insensitive), for the put-any-number tail. */
const EMPOWERED_MARKER_TOKEN_PATTERN = /\[keyword:empowered\]/i;

// why: D-24024 — the forward-compat parameterized reveal token has 3+
// colon-separated segments ([keyword:reveal:<predicate>:<actions>(:continue)?]).
// KEYWORD_PATTERN stops at the second colon and cannot match it; the legacy
// [keyword:reveal:<n>] form is disambiguated because the predicate segment must
// START WITH A LETTER (so a bare digit magnitude routes to KEYWORD_PATTERN, not
// here). One token = one RevealRule (mirrors COUNT_SCALED_PATTERN's
// one-token-one-effect shape). predicate ∈ {always, cost-zero, cost-odd,
// cost-lte-<n>, cost-gte-<n>}; actions are '+'-joined ∈ {draw, ko, attack-by-cost,
// attack-fixed-<n>, choose-discard-or-return}; an optional trailing ':continue'.
// No card uses this grammar this WP — it makes a new reveal variant data-only.
/** Regex for [keyword:reveal:<predicate>:<actions>(:continue)?] parameterized reveal markup. */
const REVEAL_RULE_PATTERN = /\[keyword:reveal:([a-z][a-z0-9-]*):([a-z][a-z0-9+-]*)(?::(continue))?\]/g;

// why: D-24027 — how many deck-top cards a reveal descriptor peeks is DESCRIPTOR-level
// (the reveal handler's loop bound), NOT rule-level (the per-card predicate), so it rides
// a dedicated 2-segment token mirroring COUNT_SCALED_PATTERN's dedicated-token shape — not
// the legacy `[keyword:reveal:N]` magnitude (that is a draw threshold) nor a RevealRule
// segment. Disambiguation: `[keyword:reveal-count:N]` is NOT matched by REVEAL_RULE_PATTERN
// (which needs the literal `reveal:<predicate>`); KEYWORD_PATTERN matches it as keyword
// `reveal-count`, but isValidHeroKeyword('reveal-count') is false (it is a modifier marker,
// never a HeroKeyword — absent from HERO_KEYWORDS), so only REVEAL_COUNT_PATTERN consumes it.
/** Regex for [keyword:reveal-count:<n>] reveal-count modifier markup. */
const REVEAL_COUNT_PATTERN = /\[keyword:reveal-count:(\d+)\]/g;

// why: WP-479 / D-24286 — a bare `[keyword:reveal-reorder]` modifier marker (no
// value segment) sets the reveal descriptor's `reorderRemainder` flag. Like
// `reveal-count` it is a MODIFIER marker, never a HeroKeyword (absent from
// HERO_KEYWORDS); KEYWORD_PATTERN matches it as keyword `reveal-reorder` but
// isValidHeroKeyword is false, so it must be listed in RECOGNIZED_NON_KEYWORD_MARKERS
// below to avoid a false parse-unrecognized flag.
/** Regex for the [keyword:reveal-reorder] reveal-reorder modifier marker. */
const REVEAL_REORDER_PATTERN = /\[keyword:reveal-reorder\]/;

// why: D-24024 — the 8 legacy reveal keywords whose markers translate to the
// collapsed `reveal` descriptor. Built from the canonical REVEAL_KEYWORDS array so
// the parser and the translation function share one source of truth.
const REVEAL_KEYWORD_SET: ReadonlySet<HeroKeyword> = new Set<HeroKeyword>(REVEAL_KEYWORDS);

// why: WP-257 / D-24034 — a `[keyword:X]` token whose X is NOT a HeroKeyword and
// NOT a composition marker is normally an unresolved marker (→ parse-unrecognized).
// But a few `[keyword:...]` tokens are recognized MODIFIER markers consumed by a
// dedicated pattern, not by KEYWORD_PATTERN's keyword arm. `reveal-count` is the
// one whose first segment (a bare hyphenated word + `:<n>`) ALSO matches
// KEYWORD_PATTERN, so the unresolved-marker scan must exclude it to avoid a false
// flag. (`attack-per-count` / `optional-ko-reward` / the parameterized `reveal:...`
// tokens carry extra colon segments that KEYWORD_PATTERN cannot match, so they
// never reach the keyword arm; only `reveal-count` needs listing here.)
const RECOGNIZED_NON_KEYWORD_MARKERS: ReadonlySet<string> = new Set<string>([
  'reveal-count',
  // why: WP-479 / D-24286 — reveal-reorder is a bare modifier marker (like
  // reveal-count), not a HeroKeyword; exclude it from the unresolved-marker scan.
  'reveal-reorder',
]);

// why: D-24019 — the reward of an optional-ko-reward effect is dispatched to an
// ALREADY-BUILT reward executor; only these four are seeded. An unseeded reward
// (e.g. a not-yet-built gain-shard) emits no descriptor — such a marker can
// never reach the pending queue. Mirrored defensively in heroEffects.execute.ts.
const OPTIONAL_KO_REWARD_SEEDED_REWARDS: ReadonlySet<HeroKeyword> = new Set<HeroKeyword>([
  'rescue',
  'draw',
  'attack',
  'recruit',
]);

// why: WP-382 / D-24183 — the seeded reward vocabulary for ko-wound-reward
// (draw / attack / recruit — the Healing Factor family's core vocabulary). An
// unseeded reward emits no descriptor. Mirrors the same constant in
// hero/heroEffects.execute.ts (two copies, per duplicate-first).
const KO_WOUND_REWARD_SEEDED_REWARDS: ReadonlySet<HeroKeyword> = new Set<HeroKeyword>([
  'draw',
  'attack',
  'recruit',
]);

// why: D-24148 — the shuffle-discard-empty-reward token has three segments
// ([keyword:shuffle-discard-empty-reward:<reward>:<n>]); KEYWORD_PATTERN cannot
// match it (it stops at the second colon), so it needs a dedicated pattern like
// the D-24019 precedent above. The capture group is (\d+) — the strict [1-9]\d*
// gate is the apply-script's job (build time); the n ≥ 1 check is enforced in
// the extraction step below.
/** Regex for [keyword:shuffle-discard-empty-reward:<reward>:<n>] markup. */
const SHUFFLE_DISCARD_EMPTY_REWARD_PATTERN = /\[keyword:shuffle-discard-empty-reward:([a-z][a-z-]*):(\d+)\]/g;

// why: D-24148 — the empty-discard grant dispatches to G.turnEconomy via
// addResources; only the two printed variants are seeded (Reprocess = recruit,
// Electromagnetic Eyebeams = attack). An unseeded reward segment emits no
// descriptor, so the line stays a hollow-detectable no-op instead of silently
// half-executing. Deliberately narrower than the D-24019 set.
const SHUFFLE_DISCARD_EMPTY_REWARD_SEEDED_REWARDS: ReadonlySet<HeroKeyword> = new Set<HeroKeyword>([
  'attack',
  'recruit',
]);

// why: extract magnitude from icon-adjacent integers — avoids per-card manual markup (D-21505)
/** Regex for attack/recruit icon-adjacent magnitude, e.g. "+2[icon:attack]". */
const ICON_MAGNITUDE_PATTERN = /\+?(\d+)\s*\[icon:(attack|recruit)\]/g;

// why: extract magnitude from icon-adjacent integers — avoids per-card manual markup (D-21505)
/** Regex for VP-cost-threshold in reveal lines: "2[icon:vp] or less". Non-global; first match only. */
const VP_COST_THRESHOLD_PATTERN = /(\d+)\s*\[icon:vp\]\s*or less/;

/** Regex for [icon:X] icon markup. */
const ICON_PATTERN = /\[icon:([^\]]+)\]/g;

/** Regex for [timing:X] explicit timing markup. */
const TIMING_PATTERN = /\[timing:([^\]]+)\]/;

/**
 * Maps icon markup values to HeroKeyword values.
 *
 * Only icons that directly correspond to a canonical keyword are mapped.
 * Unrecognized icon values are ignored.
 */
const ICON_TO_KEYWORD: Record<string, HeroKeyword> = {
  attack: 'attack',
  recruit: 'recruit',
  ko: 'ko',
};

/**
 * Maps timing markup values to HeroAbilityTiming values.
 */
const TIMING_MARKUP_MAP: Record<string, HeroAbilityTiming> = {
  onPlay: 'onPlay',
  onFight: 'onFight',
  onRecruit: 'onRecruit',
  onKO: 'onKO',
  onReveal: 'onReveal',
};

// why: D-24049 — a few keywords fire at a non-onPlay timing by default. Wall-Crawl
// ("when you recruit this Hero, you may put it on top of your deck") fires at recruit,
// so [keyword:Wall-Crawl] must land on an onRecruit hook. This keyword→default-timing
// map is consulted in Step 5: a keyword listed here sets the hook's default timing; an
// explicit [timing:X] marker still overrides; a keyword absent from the map keeps the
// onPlay default.
const KEYWORD_TIMING_DEFAULTS: Partial<Record<HeroKeyword, HeroAbilityTiming>> = {
  'wall-crawl': 'onRecruit',
  // why: WP-498 / D-24301 — return-on-discard is reactive: it fires when a card
  // effect discards the marked card from hand, so its hook lands on onDiscard (the
  // parser default is onPlay). The timing is declarative-only — the discardFromHand
  // chokepoint keys on the keyword, not this timing — but the hook must carry it so
  // the per-hook timing-membership drift test passes.
  'return-on-discard': 'onDiscard',
};

// why: D-24055 — the rulebook value for Spectrum: ≥3 Hero classes.
const SPECTRUM_CLASS_THRESHOLD = 3;

// why: D-24074 / WP-290 — detects whether an ability line carries the Size-Changing
// keyword. On such a line the same-line `[hc:...]` tokens are the GRANTED classes (the
// card gains them when played), not `heroClassMatch` play-conditions — so Step 1a routes
// them to the granted-class list instead of conditions. Non-global, stateless `.test`
// (no lastIndex concern); case-insensitive to match the `[keyword:X]` lowercasing.
const SIZE_CHANGING_MARKER_PATTERN = /\[keyword:size-changing\]/i;

/**
 * Extracts structured hero ability metadata from a single ability text.
 *
 * Follows the authoritative parsing order:
 * 1. Extract [hc:X] -> HeroCondition entries
 * 2. Extract [keyword:X] -> HeroKeyword entries
 * 3. Extract [icon:X] -> HeroKeyword entries
 * 4. Normalize keywords (dedup, validate against union)
 * 5. Assign timing (explicit markup or default 'onPlay')
 *
 * No step depends on results of a later step.
 */
function parseAbilityText(abilityText: string): {
  keywords: HeroKeyword[];
  conditions: HeroCondition[];
  effects: HeroEffectDescriptor[];
  primitiveEffects: EffectNode[];
  unresolvedMarkers: string[];
  resolvedMarkers: string[];
  sizeChangingClasses: string[];
  timing: HeroAbilityTiming;
} {
  const keywords: HeroKeyword[] = [];
  const heroClassConditions: HeroCondition[] = [];
  const teamConditions: HeroCondition[] = [];
  // why: D-24074 / WP-290 — the granted Hero Classes parsed from a Size-Changing line's
  // same-line `[hc:...]` tokens (Step 1a). Empty on every non-Size-Changing line and on a
  // Size-Changing line with no `[hc:X]` (recognized, no grant — graceful empty, no throw).
  const sizeChangingClasses: string[] = [];
  // why: D-24074 / WP-290 — when the line carries [keyword:Size-Changing], its [hc:...]
  // tokens are the GRANTED classes, not heroClassMatch conditions. Computed once up front
  // so Step 1a routes every same-line [hc:...] to the grant list (guardrail #4: extract ALL).
  const lineHasSizeChanging = SIZE_CHANGING_MARKER_PATTERN.test(abilityText);
  const effects: HeroEffectDescriptor[] = [];
  // why: D-24031 — composition markers (Berserk) accumulate here as deep copies of their
  // registry AST, kept separate from `keywords`/`effects` (the open mechanic space).
  const primitiveEffects: EffectNode[] = [];
  // why: WP-257 / D-24034 — raw `[keyword:X]` tokens that resolve to no keyword,
  // composition, or recognized modifier. The hollow detector reads this so an
  // unresolved marker flags `parse-unrecognized` while flavor text (no marker) does not.
  const unresolvedMarkers: string[] = [];
  // why: D-24045 — the positive symmetric record of `unresolvedMarkers`: composition
  // markers that RESOLVED on this line (a primitive attached). Pushed in the SAME two
  // branches that push `primitiveEffects`; the mechanic ledger reads it to classify
  // composition-marker status by-hook (per-card), not by-name (resolves the D-24044
  // over-claim). Parse-time provenance only — never affects execution.
  const resolvedMarkers: string[] = [];

  // Step 1a: Extract [hc:X] condition markup
  // why: defense-in-depth normalization on already-validated hc values — pipeline
  // produces lowercase, but a single authoring slip like [hc:Tech] should not
  // silently break superpowers.
  let heroClassMatch: RegExpExecArray | null = null;
  const heroClassRegex = new RegExp(HERO_CLASS_PATTERN.source, 'g');
  heroClassMatch = heroClassRegex.exec(abilityText);
  while (heroClassMatch !== null) {
    const normalizedClass = normalizeTraitSlug(heroClassMatch[1]!);
    if (lineHasSizeChanging) {
      // why: D-24074 — on a Size-Changing line the [hc:...] tokens are the GRANTED classes
      // (the card gains them on play), so route them to the grant list and emit NO
      // heroClassMatch condition for them (extract ALL on this line — guardrail #4). The
      // [keyword:Size-Changing] token itself is a recognized HeroKeyword (Step 2), so no
      // unresolved marker is recorded either.
      sizeChangingClasses.push(normalizedClass);
    } else {
      heroClassConditions.push({
        type: 'heroClassMatch',
        value: normalizedClass,
      });
    }
    heroClassMatch = heroClassRegex.exec(abilityText);
  }

  // Step 1b: Extract [team:X] condition markup
  const teamRegex = new RegExp(TEAM_PATTERN.source, 'g');
  let teamMatch: RegExpExecArray | null = teamRegex.exec(abilityText);
  while (teamMatch !== null) {
    teamConditions.push({
      type: 'requiresTeam',
      value: normalizeTraitSlug(teamMatch[1]!),
    });
    teamMatch = teamRegex.exec(abilityText);
  }

  // Condition emission order: all heroClassMatch first, then requiresTeam
  // (deterministic, independent of markup position in text).
  const conditions: HeroCondition[] = [...heroClassConditions, ...teamConditions];

  // Pre-pass: resolve the choose-one Empowered form before the KEYWORD_PATTERN loop.
  // why: D-24063 — the choose-one line must produce ONE composition for the whole line;
  // running a pre-pass before the per-token loop prevents double-composition (once per
  // [keyword:Empowered] token). processedAsChooseOne suppresses the per-token empowered
  // dispatch for this line when the pre-pass already resolved it.
  let processedAsChooseOne = false;
  const chooseOneResult = tryResolveEmpoweredChooseOneLine(abilityText);
  if (chooseOneResult !== undefined) {
    primitiveEffects.push(chooseOneResult.composition);
    // why: D-24045 — record the resolved composition marker by-hook (same gate as all
    // other primitiveEffects pushes); 'empowered' is the normalized marker name.
    resolvedMarkers.push('empowered');
    // why: D-24063 — suppresses per-token empowered handling in the KEYWORD_PATTERN loop
    // below so the choose-one composition is built exactly once for the whole line.
    processedAsChooseOne = true;
    // The [hc:X] tokens in the choose-one form are count parameters, not gate conditions
    // (same suppression as the sole-condition core path). Clear so 'conditional' is not added.
    conditions.splice(0, conditions.length);
  }

  // Pre-pass: resolve the draw-or-empowered choose-one form before the KEYWORD_PATTERN loop.
  // why: D-24069 — One-Hit Wonder's "Choose one: Draw a card, or you get [keyword:Empowered] by
  // [hc:X]" must emit ONE draw-or-empowered effect carrying the empowered class and suppress the
  // per-token empowered dispatch, so the line no longer falls through to tryResolveEmpoweredCore
  // (the silent-empowered bug). Runs AFTER the two-empowered choose-one pre-pass (which already
  // returned undefined for this single-marker shape) and BEFORE the per-token loop.
  let processedAsDrawOrEmpowered = false;
  let drawOrEmpoweredClass: string | undefined;
  if (!processedAsChooseOne) {
    const drawOrEmpoweredResult = tryResolveDrawOrEmpoweredLine(abilityText);
    if (drawOrEmpoweredResult !== undefined) {
      keywords.push('draw-or-empowered');
      drawOrEmpoweredClass = drawOrEmpoweredResult.empoweredClass;
      // why: D-24069 — suppresses the per-token empowered dispatch in the KEYWORD_PATTERN loop
      // below so the line emits exactly one draw-or-empowered effect (mirrors processedAsChooseOne).
      processedAsDrawOrEmpowered = true;
      // why: the [hc:X] is the Empowered count PARAMETER, not a gate condition; clear it so the
      // hook adds no 'conditional' keyword (same suppression as the choose-one path above).
      conditions.splice(0, conditions.length);
    }
  }

  // Pre-pass: capture a put-any-number-bottom-hq line's trailing Empowered grant before the
  // KEYWORD_PATTERN loop (D-24132). When the line carries the put-any-number marker AND a
  // same-line "[keyword:Empowered] by [hc:…]" tail (Wonder Man's 8th Wonder of the World), the
  // Empowered classes are the count PARAMETERS of a grant that must apply AFTER the moves
  // resolve — so capture them onto the put-any-number effect and suppress the per-token
  // Empowered dispatch (which would otherwise emit a standalone play-time primitive that fires
  // BEFORE the choice resolves, counting the pre-move HQ). Runs AFTER the choose-one / draw-or-
  // empowered pre-passes (which returned undefined for this shape) and BEFORE the per-token loop.
  let processedAsPutAnyNumberEmpowered = false;
  let putAnyNumberEmpoweredClasses: string[] = [];
  if (
    !processedAsChooseOne
    && !processedAsDrawOrEmpowered
    && PUT_ANY_NUMBER_BOTTOM_HQ_PATTERN.test(abilityText)
  ) {
    // why: PUT_ANY_NUMBER_BOTTOM_HQ_PATTERN is global; .test advances lastIndex on the shared
    // const, so reset it after the presence check to keep the module-level const stateless.
    PUT_ANY_NUMBER_BOTTOM_HQ_PATTERN.lastIndex = 0;
    const tailClasses = extractPutAnyNumberEmpoweredTailClasses(abilityText);
    if (tailClasses.length > 0) {
      putAnyNumberEmpoweredClasses = tailClasses;
      processedAsPutAnyNumberEmpowered = true;
      // why: the Empowered tail's [hc:…] tokens parsed as heroClassMatch conditions in Step 1a
      // are the grant's count PARAMETERS, not gate conditions — remove the matching ones so they
      // neither gate the put-any-number effect nor add a 'conditional' keyword. Removes ONLY the
      // consumed params (not a blanket clear) so any unrelated gate on the line survives.
      for (const empoweredClass of putAnyNumberEmpoweredClasses) {
        const paramIndex = findFirstHeroClassMatchIndex(conditions, empoweredClass);
        if (paramIndex !== -1) {
          conditions.splice(paramIndex, 1);
        }
      }
    }
  }

  // Step 2: Extract [keyword:X] or [keyword:X:N] markup
  // Collect magnitudes keyed by keyword — explicit markup wins over icon-derived.
  const magnitudes: Map<string, number> = new Map();
  const keywordRegex = new RegExp(KEYWORD_PATTERN.source, 'g');
  let keywordMatch: RegExpExecArray | null = keywordRegex.exec(abilityText);
  while (keywordMatch !== null) {
    const normalizedKeyword = keywordMatch[1]!.toLowerCase();
    if (isValidHeroKeyword(normalizedKeyword)) {
      keywords.push(normalizedKeyword);
      // Capture optional :N magnitude suffix when present and valid integer
      const magnitudeString = keywordMatch[2];
      if (magnitudeString !== undefined && /^\d+$/.test(magnitudeString)) {
        magnitudes.set(normalizedKeyword, parseInt(magnitudeString, 10));
      }
    } else if (isParameterizedCompositionMarker(normalizedKeyword)) {
      // why: D-24044 — a PARAMETERIZED composition marker (empowered) whose AST is BUILT per
      // a parameter parsed from the text immediately after the marker, not a static
      // HERO_COMPOSITION_MARKERS row. It resolves to a built composition ONLY for the
      // unconditional core form (an anchored `by [hc:COLOR]` tail whose color is the line's
      // sole condition); any deferred variant (no anchored tail, a prefix gate, multi-class,
      // a team gate) instead records an unresolved marker so the WP-257 hollow detector still
      // flags it — the Honest-Partial Invariant. Checked BEFORE isHeroCompositionMarker since
      // `empowered` is in HERO_COMPOSITION_MARKER_NAMES (the deduped union) too.
      //
      // why: D-24063 / D-24069 / D-24132 — processedAsChooseOne (the two-empowered choose-one),
      // processedAsDrawOrEmpowered (draw + single empowered), and processedAsPutAnyNumberEmpowered
      // (put-any-number + trailing empowered) each suppress per-token empowered handling when their
      // whole-line pre-pass already claimed the line. Skipping here prevents double-composition / a
      // stray standalone play-time empowered composition on a line a pre-pass owns (for put-any-
      // number, the grant is applied AFTER the moves at resolve time instead).
      if (!processedAsChooseOne && !processedAsDrawOrEmpowered && !processedAsPutAnyNumberEmpowered) {
        const textAfterMarker = abilityText.slice(keywordMatch.index + keywordMatch[0]!.length);
        // why: D-24047 — resolve-order: try the unchanged sole-condition core FIRST, then the
        // conditional-prefix class-gated form, then the free-choice fallback, then the
        // unresolved fallback. This keeps the core path and its two baseline-verified cases
        // untouched: `one-hit-wonder` (single marker + single condition, no prefix) still
        // resolves via the core path.
        const empoweredComposition = tryResolveEmpoweredCore(textAfterMarker, conditions);
        if (empoweredComposition !== undefined) {
          primitiveEffects.push(empoweredComposition);
          // why: D-24045 — record the resolved composition marker (same gate as the
          // primitiveEffects push). A deferred variant takes the else branch and records an
          // unresolved marker instead — the Honest-Partial symmetry the ledger reads by-hook.
          resolvedMarkers.push(normalizedKeyword);
          // why: D-24044 — suppress the consumed [hc:COLOR] param so it does not ALSO gate the
          // hook (it is the count parameter, not a condition). The resolve gate guarantees it is
          // the line's sole condition, so clearing `conditions` removes exactly it — which also
          // prevents the 'conditional' keyword being added downstream.
          conditions.splice(0, conditions.length);
        } else {
          const conditionalPrefixMatch = tryResolveEmpoweredConditionalPrefix(
            abilityText,
            textAfterMarker,
            conditions,
          );
          if (conditionalPrefixMatch !== undefined) {
            primitiveEffects.push(conditionalPrefixMatch.composition);
            // why: D-24045 — same by-hook provenance gate as the core path.
            resolvedMarkers.push(normalizedKeyword);
            // why: D-24047 — suppress ONLY the consumed count param heroClassMatch(Y) and
            // RETAIN the leading prefix gate heroClassMatch(X). The retained gate IS the
            // conditional behavior the WP-256 executor honors (it runs primitiveEffects only
            // when the hook's conditions pass), so this lifts D-24044's conditional-prefix
            // deferral for the class-gated case WITHOUT an executor edit. NEVER clear all
            // conditions on this path (that is the sole-condition core-path shortcut). The
            // helper confirmed a matching count param exists, so the index is always found.
            const consumedParamIndex = findFirstHeroClassMatchIndex(
              conditions,
              conditionalPrefixMatch.countColor,
            );
            if (consumedParamIndex !== -1) {
              conditions.splice(consumedParamIndex, 1);
            }
          } else {
            // why: WP-310 / D-24098 — the unconditional MULTI-class form
            // `by [hc:X] and [hc:Y] (and …)`. Tried AFTER the single-class core +
            // conditional-prefix paths (which both defer a multi-class tail) and BEFORE the
            // free-choice/dynamic fallbacks, so no existing form's routing changes.
            const multiClassCompositions = tryResolveEmpoweredMultiClass(
              textAfterMarker,
              conditions,
            );
            if (multiClassCompositions !== undefined) {
              // why: WP-310 — push one composition per parsed class in printed order; the
              // executor runs each (every entry grants +Attack by that class's HQ count), so
              // the applied bonus is their sum.
              for (const composition of multiClassCompositions) {
                primitiveEffects.push(composition);
              }
              // why: D-24045 — same by-hook provenance gate as all other resolution paths.
              resolvedMarkers.push(normalizedKeyword);
              // why: WP-310 — the parsed classes are the line's SOLE conditions (the resolve
              // gate guaranteed conditions === the N count params), so clear them all —
              // mirroring the core path's sole-condition shortcut. This prevents the consumed
              // count params gating the hook or adding a stray 'conditional' keyword downstream.
              conditions.splice(0, conditions.length);
            } else {
              const freeChoiceComposition = tryResolveEmpoweredFreeChoice(textAfterMarker, conditions);
              if (freeChoiceComposition !== undefined) {
                primitiveEffects.push(freeChoiceComposition);
                // why: D-24045 — same by-hook provenance gate as all other resolution paths.
                resolvedMarkers.push(normalizedKeyword);
              } else {
                // why: D-24065 — dynamic fallback: recognizes "by the Hero Classes of the card
                // you revealed this way" (cross-the-multiverse); last fallback before the
                // unresolved-marker path.
                const dynamicComposition = tryResolveEmpoweredDynamic(textAfterMarker);
                if (dynamicComposition !== undefined) {
                  primitiveEffects.push(dynamicComposition);
                  // why: D-24045 — same by-hook provenance gate as all other resolution paths.
                  resolvedMarkers.push(normalizedKeyword);
                } else {
                  unresolvedMarkers.push(normalizedKeyword);
                }
              }
            }
          }
        }
      }
    } else if (isHeroCompositionMarker(normalizedKeyword)) {
      // why: D-24031 — a composition marker (berserk) attaches a DEEP COPY of its AST to
      // primitiveEffects, NEVER to hook.keywords (berserk is not a HeroKeyword;
      // isValidHeroKeyword stays false). structuredClone (a Node v22 global, deterministic
      // over the plain-JSON AST) forecloses both aliasing the shared registry const
      // (D-13502) and hand-literal drift. A cousin is a registry row, not an engine edit.
      const composition = HERO_COMPOSITION_MARKERS[normalizedKeyword];
      if (composition !== undefined) {
        primitiveEffects.push(structuredClone(composition));
        // why: D-24045 — record the resolved composition marker (same gate as the
        // primitiveEffects push). A static composition (berserk) always resolves here, so it
        // stays executable in the ledger; only deferred parameterized variants go unsupported.
        resolvedMarkers.push(normalizedKeyword);
      }
    } else if (normalizedKeyword === 'spectrum') {
      // why: D-24055 — [keyword:Spectrum] is the rulebook gate, modeled as a
      // condition (not a keyword), so the line's printed effects gate on ≥3 classes.
      // Placed before the unresolved-marker fallback so it never flags.
      conditions.push({
        type: 'distinctHeroClassesAtLeast',
        value: String(SPECTRUM_CLASS_THRESHOLD),
      });
    } else if (!RECOGNIZED_NON_KEYWORD_MARKERS.has(normalizedKeyword)) {
      // why: WP-257 / D-24034 — a `[keyword:X]` token that is NOT a valid keyword,
      // NOT a composition marker, and NOT a recognized modifier (reveal-count) is a
      // SAW-a-marker-resolved-to-nothing case. Record the raw token so the hollow
      // detector can flag `parse-unrecognized` at runtime — distinct from flavor
      // text, which contains no marker token and so records nothing here.
      unresolvedMarkers.push(normalizedKeyword);
    }
    keywordMatch = keywordRegex.exec(abilityText);
  }

  // Step 2b: Extract icon-adjacent magnitudes for attack/recruit keywords.
  // Only sets magnitude if no explicit [keyword:X:N] markup already provided it.
  const iconMagnitudeRegex = new RegExp(ICON_MAGNITUDE_PATTERN.source, 'g');
  let iconMagnitudeMatch: RegExpExecArray | null = iconMagnitudeRegex.exec(abilityText);
  while (iconMagnitudeMatch !== null) {
    const iconKeyword = iconMagnitudeMatch[2]!.toLowerCase();
    const iconMagnitudeValue = parseInt(iconMagnitudeMatch[1]!, 10);
    if (!magnitudes.has(iconKeyword)) {
      magnitudes.set(iconKeyword, iconMagnitudeValue);
    }
    iconMagnitudeMatch = iconMagnitudeRegex.exec(abilityText);
  }

  // Step 2c: Extract VP-cost threshold for reveal lines.
  // Pattern: "N[icon:vp] or less" — non-global, first match only.
  // Only sets magnitude if no explicit [keyword:reveal:N] markup provided it.
  const vpThresholdMatch = VP_COST_THRESHOLD_PATTERN.exec(abilityText);
  if (vpThresholdMatch !== null && !magnitudes.has('reveal')) {
    const vpThresholdValue = parseInt(vpThresholdMatch[1]!, 10);
    magnitudes.set('reveal', vpThresholdValue);
  }

  // Step 2d: Extract [keyword:attack-per-count:<source>:<perUnit>] count-scaled
  // markup. The per-unit rate is stored in magnitudes; the count source is
  // stored in countSources so the effect builder can attach it. Only sources in
  // HERO_COUNT_SOURCES are accepted — an unrecognized source is ignored (no
  // 'attack-per-count' effect is emitted, so the icon-suppression below does not
  // fire and the line keeps its printed attack icon).
  // why: D-24016 — count-scaled attack tokens have three segments not matched by
  // KEYWORD_PATTERN; the per-unit rate is the magnitude, the source resolves the count.
  const countSources: Map<HeroKeyword, HeroCountSource> = new Map();
  const countScaledRegex = new RegExp(COUNT_SCALED_PATTERN.source, 'g');
  let countScaledMatch: RegExpExecArray | null = countScaledRegex.exec(abilityText);
  while (countScaledMatch !== null) {
    const countSourceCandidate = countScaledMatch[1]!;
    const perUnitString = countScaledMatch[2]!;
    if (isValidHeroCountSource(countSourceCandidate)) {
      keywords.push('attack-per-count');
      magnitudes.set('attack-per-count', parseInt(perUnitString, 10));
      countSources.set('attack-per-count', countSourceCandidate);
    }
    countScaledMatch = countScaledRegex.exec(abilityText);
  }

  // Step 2e: Extract [keyword:optional-ko-reward:<reward>:<n>] markup. The
  // reward is stored in rewardTypes; the reward magnitude is stored in
  // magnitudes so the effect builder can attach both. A descriptor is emitted
  // ONLY when the reward is in the seeded set AND n ≥ 1 — an unseeded reward
  // (e.g. a not-yet-built gain-shard) or a zero magnitude emits no effect, so
  // such a marker can never reach the pending queue.
  // why: D-24019 — the optional-KO-reward token has three segments not matched
  // by KEYWORD_PATTERN; the reward dispatches to the existing executor and the
  // magnitude is the reward magnitude.
  const rewardTypes: Map<HeroKeyword, HeroKeyword> = new Map();
  const optionalKoRewardRegex = new RegExp(OPTIONAL_KO_REWARD_PATTERN.source, 'g');
  let optionalKoRewardMatch: RegExpExecArray | null = optionalKoRewardRegex.exec(abilityText);
  while (optionalKoRewardMatch !== null) {
    const rewardCandidate = optionalKoRewardMatch[1]!;
    const rewardMagnitude = parseInt(optionalKoRewardMatch[2]!, 10);
    if (isValidHeroKeyword(rewardCandidate)
      && OPTIONAL_KO_REWARD_SEEDED_REWARDS.has(rewardCandidate)
      && rewardMagnitude >= 1) {
      keywords.push('optional-ko-reward');
      magnitudes.set('optional-ko-reward', rewardMagnitude);
      rewardTypes.set('optional-ko-reward', rewardCandidate);
    }
    optionalKoRewardMatch = optionalKoRewardRegex.exec(abilityText);
  }

  // Step 2f: Extract [keyword:ko-wound-reward:<reward>:<n>] markup (WP-382 / D-24183).
  // why: mirrors Step 2e — the ko-wound-reward token has three segments; the reward
  // dispatches to the same reward executor after the Wound is KO'd, and the
  // magnitude is the reward magnitude. A descriptor is emitted ONLY when the reward
  // is seeded AND n >= 1.
  const koWoundRewardRegex = new RegExp(KO_WOUND_REWARD_PATTERN.source, 'g');
  let koWoundRewardMatch: RegExpExecArray | null = koWoundRewardRegex.exec(abilityText);
  while (koWoundRewardMatch !== null) {
    const rewardCandidate = koWoundRewardMatch[1]!;
    const rewardMagnitude = parseInt(koWoundRewardMatch[2]!, 10);
    if (isValidHeroKeyword(rewardCandidate)
      && KO_WOUND_REWARD_SEEDED_REWARDS.has(rewardCandidate)
      && rewardMagnitude >= 1) {
      keywords.push('ko-wound-reward');
      magnitudes.set('ko-wound-reward', rewardMagnitude);
      rewardTypes.set('ko-wound-reward', rewardCandidate);
    }
    koWoundRewardMatch = koWoundRewardRegex.exec(abilityText);
  }

  // Step 2e-bis: Extract [keyword:shuffle-discard-empty-reward:<reward>:<n>]
  // markup (D-24148). Mirrors Step 2e: the reward is stored in rewardTypes and
  // the grant magnitude in magnitudes so the effect builder can attach both. A
  // descriptor is emitted ONLY when the reward is in the seeded set AND n ≥ 1 —
  // an unseeded reward or a zero magnitude emits no effect.
  const shuffleDiscardRewardRegex = new RegExp(SHUFFLE_DISCARD_EMPTY_REWARD_PATTERN.source, 'g');
  let shuffleDiscardRewardMatch: RegExpExecArray | null = shuffleDiscardRewardRegex.exec(abilityText);
  while (shuffleDiscardRewardMatch !== null) {
    const shuffleRewardCandidate = shuffleDiscardRewardMatch[1]!;
    const shuffleRewardMagnitude = parseInt(shuffleDiscardRewardMatch[2]!, 10);
    if (isValidHeroKeyword(shuffleRewardCandidate)
      && SHUFFLE_DISCARD_EMPTY_REWARD_SEEDED_REWARDS.has(shuffleRewardCandidate)
      && shuffleRewardMagnitude >= 1) {
      keywords.push('shuffle-discard-empty-reward');
      magnitudes.set('shuffle-discard-empty-reward', shuffleRewardMagnitude);
      rewardTypes.set('shuffle-discard-empty-reward', shuffleRewardCandidate);
    }
    shuffleDiscardRewardMatch = shuffleDiscardRewardRegex.exec(abilityText);
  }

  // Step 2f: Extract [keyword:optional-put-bottom-hq:<n>] markup. Simple 2-segment token
  // for "You may put a card from the HQ on the bottom of the Hero Deck". The magnitude
  // is always 1 for this MVP form (how many cards to move). Only one occurrence per line.
  const optionalPutBottomHqRegex = new RegExp(OPTIONAL_PUT_BOTTOM_HQ_PATTERN.source, 'g');
  let optionalPutBottomHqMatch: RegExpExecArray | null = optionalPutBottomHqRegex.exec(abilityText);
  if (optionalPutBottomHqMatch !== null) {
    const magnitude = parseInt(optionalPutBottomHqMatch[1]!, 10);
    if (magnitude >= 1) {
      keywords.push('optional-put-bottom-hq');
      magnitudes.set('optional-put-bottom-hq', magnitude);
    }
  }

  // Step 2f-bis: Extract [keyword:put-any-number-bottom-hq:<n>] markup (D-24132). Simple
  // 2-segment token for "Choose any number of cards/Heroes from the HQ. Put them on the bottom
  // of the Hero Deck" (the MULTI-select sibling of optional-put-bottom-hq). The magnitude is
  // always 1 for this MVP form. Only one occurrence per line. Any trailing Empowered classes
  // were captured by the pre-pass into putAnyNumberEmpoweredClasses and attach in the builder.
  const putAnyNumberBottomHqRegex = new RegExp(PUT_ANY_NUMBER_BOTTOM_HQ_PATTERN.source, 'g');
  const putAnyNumberBottomHqMatch = putAnyNumberBottomHqRegex.exec(abilityText);
  if (putAnyNumberBottomHqMatch !== null) {
    const magnitude = parseInt(putAnyNumberBottomHqMatch[1]!, 10);
    if (magnitude >= 1) {
      keywords.push('put-any-number-bottom-hq');
      magnitudes.set('put-any-number-bottom-hq', magnitude);
    }
  }

  // Step 2g: Extract [keyword:reveal:<predicate>:<actions>(:continue)?] parameterized
  // reveal tokens (forward-compat — no card uses this grammar this WP). Each token is
  // ONE RevealRule, accumulated in source order. When at least one rule parses, the
  // base 'reveal' keyword is recorded so the effect builder emits a single collapsed
  // reveal descriptor carrying these rules.
  // why: D-24024 — the parameterized grammar makes a new reveal variant a data marker
  // rather than a new keyword + handler + drift-test + WP. A malformed predicate or
  // action voids that one rule token (safe-skip, no throw).
  const parameterizedRevealRules: RevealRule[] = [];
  const revealRuleRegex = new RegExp(REVEAL_RULE_PATTERN.source, 'g');
  let revealRuleMatch: RegExpExecArray | null = revealRuleRegex.exec(abilityText);
  while (revealRuleMatch !== null) {
    const parsedRule = parseRevealRuleToken(revealRuleMatch[1]!, revealRuleMatch[2]!, revealRuleMatch[3]);
    if (parsedRule !== null) {
      parameterizedRevealRules.push(parsedRule);
    }
    revealRuleMatch = revealRuleRegex.exec(abilityText);
  }
  if (parameterizedRevealRules.length > 0) {
    keywords.push('reveal');
  }

  // Step 2h: Extract the [keyword:reveal-count:<n>] modifier — how many deck-top
  // cards the reveal descriptor peeks. Absent ⇒ the WP-253 default of 1. Only the
  // first occurrence is read (one reveal descriptor per ability line).
  // why: D-24027 — the count is DESCRIPTOR-level (the reveal handler's peek-loop
  // bound), not rule-level (a per-card predicate); a dedicated 2-segment token
  // (mirrors COUNT_SCALED_PATTERN) keeps it distinct from the legacy
  // `[keyword:reveal:N]` draw threshold. `reveal-count` is a modifier marker, never
  // a HeroKeyword, so it contributes no keyword/effect of its own.
  let revealCount = 1;
  const revealCountRegex = new RegExp(REVEAL_COUNT_PATTERN.source, 'g');
  const revealCountMatch = revealCountRegex.exec(abilityText);
  if (revealCountMatch !== null) {
    const parsedRevealCount = parseInt(revealCountMatch[1]!, 10);
    // why: guard n ≥ 1 (mirrors the optional-ko-reward magnitude gate) — a 0 count
    // would build a reveal that peeks nothing, so fall back to the default.
    if (parsedRevealCount >= 1) {
      revealCount = parsedRevealCount;
    }
  }

  // why: WP-479 / D-24286 — the [keyword:reveal-reorder] modifier marker (bare, no
  // value) flags that the reveal's non-drawn remainder is player-reordered. Threaded
  // onto the collapsed reveal descriptor below, like revealCount.
  const reorderRemainder = REVEAL_REORDER_PATTERN.test(abilityText);

  // Step 3: Extract [icon:X] markup
  const iconRegex = new RegExp(ICON_PATTERN.source, 'g');
  let iconMatch: RegExpExecArray | null = iconRegex.exec(abilityText);
  while (iconMatch !== null) {
    const iconValue = iconMatch[1]!.toLowerCase();
    const mappedKeyword = ICON_TO_KEYWORD[iconValue];
    if (mappedKeyword !== undefined) {
      keywords.push(mappedKeyword);
    }
    iconMatch = iconRegex.exec(abilityText);
  }

  // Step 4: Normalize keywords — dedup, validate against union
  let uniqueKeywords = deduplicateKeywords(keywords);

  // Icon-suppression: a count-scaled attack effect subsumes the printed attack
  // icon on the same line. Without this, "+N[icon:attack] for each X" would emit
  // BOTH a flat 'attack' effect (from the icon, Steps 2b/3) AND the
  // 'attack-per-count' effect — a double-count (N flat + N×count). Drop the plain
  // 'attack' keyword and its magnitude so only the count-scaled effect remains.
  // why: the count-scaled keyword subsumes the printed attack icon (D-24016;
  // mirrors the D-21901 reveal-cost-attack precedent).
  let lineHasCountScaledAttack = false;
  for (const keyword of uniqueKeywords) {
    if (keyword === 'attack-per-count') {
      lineHasCountScaledAttack = true;
      break;
    }
  }
  if (lineHasCountScaledAttack) {
    const keywordsWithoutAttackIcon: HeroKeyword[] = [];
    for (const keyword of uniqueKeywords) {
      if (keyword !== 'attack') {
        keywordsWithoutAttackIcon.push(keyword);
      }
    }
    uniqueKeywords = keywordsWithoutAttackIcon;
    magnitudes.delete('attack');
  }

  // Icon-suppression (sibling): a shuffle-discard-empty-reward effect subsumes
  // the printed reward icon on the same line. Without this, "If your discard
  // pile is empty, you get +2[icon:recruit]..." would emit BOTH a flat
  // 'recruit' effect (from the icon, Steps 2b/3 — granted UNCONDITIONALLY on
  // every play) AND the conditional effect — a double-grant on the empty-discard
  // branch and a phantom grant on the shuffle branch. Drop the plain keyword
  // matching the seeded rewardType and its magnitude so only the conditional
  // effect remains.
  // why: D-24148 — the conditional keyword subsumes the printed reward icon
  // (mirrors the D-24016 count-scaled suppression above).
  const shuffleDiscardRewardType = rewardTypes.get('shuffle-discard-empty-reward');
  if (shuffleDiscardRewardType !== undefined) {
    const keywordsWithoutRewardIcon: HeroKeyword[] = [];
    for (const keyword of uniqueKeywords) {
      if (keyword !== shuffleDiscardRewardType) {
        keywordsWithoutRewardIcon.push(keyword);
      }
    }
    uniqueKeywords = keywordsWithoutRewardIcon;
    magnitudes.delete(shuffleDiscardRewardType);
  }

  // If conditions were found, add 'conditional' keyword
  if (conditions.length > 0) {
    let hasConditional = false;
    for (const keyword of uniqueKeywords) {
      if (keyword === 'conditional') {
        hasConditional = true;
        break;
      }
    }
    if (!hasConditional) {
      uniqueKeywords.push('conditional');
    }
  }

  // Build effect descriptors from extracted keywords.
  // Apply magnitude from the magnitudes map when available.
  for (const keyword of uniqueKeywords) {
    if (keyword !== 'conditional') {
      const magnitude = magnitudes.get(keyword);
      if (keyword === 'attack-per-count') {
        // why: the count-scaled attack effect carries its count source so the
        // executor can resolve the count to scale the per-unit magnitude by.
        // Step 2d records both the per-unit magnitude and the source together,
        // so the guard both narrows the optional Map reads and is defensive.
        const countSource = countSources.get('attack-per-count');
        if (magnitude !== undefined && countSource !== undefined) {
          effects.push({ type: keyword, magnitude, countSource });
        }
      } else if (keyword === 'optional-ko-reward') {
        // why: D-24019 — the optional-KO-reward effect carries its rewardType so
        // the resolve move can dispatch the reward to the existing executor on
        // KO; magnitude is the reward magnitude. Step 2e records both together,
        // so the guard both narrows the optional Map reads and is defensive.
        const rewardType = rewardTypes.get('optional-ko-reward');
        if (magnitude !== undefined && rewardType !== undefined) {
          effects.push({ type: keyword, magnitude, rewardType });
        }
      } else if (keyword === 'ko-wound-reward') {
        // why: WP-382 / D-24183 — the ko-wound-reward effect carries its rewardType
        // so the executor can dispatch the reward via executeSingleEffect after
        // KO'ing the Wound; magnitude is the reward magnitude. Step 2f records both,
        // so the guard both narrows the optional Map reads and is defensive.
        const koWoundRewardType = rewardTypes.get('ko-wound-reward');
        if (magnitude !== undefined && koWoundRewardType !== undefined) {
          effects.push({ type: keyword, magnitude, rewardType: koWoundRewardType });
        }
      } else if (keyword === 'shuffle-discard-empty-reward') {
        // why: D-24148 — the shuffle-discard-empty-reward effect carries its
        // rewardType so the executor's empty-discard branch can grant the right
        // resource; magnitude is the grant amount. Step 2e-bis records both
        // together, so the guard both narrows the optional Map reads and is
        // defensive.
        const shuffleRewardType = rewardTypes.get('shuffle-discard-empty-reward');
        if (magnitude !== undefined && shuffleRewardType !== undefined) {
          effects.push({ type: keyword, magnitude, rewardType: shuffleRewardType });
        }
      } else if (keyword === 'draw-or-empowered') {
        // why: D-24069 — the draw-or-empowered effect carries the empowered hero class parsed by
        // the pre-pass so the park site records it on the PendingDrawOrEmpowered entry; the resolve
        // move's 'empowered' branch reuses buildEmpoweredComposition(empoweredClass). The pre-pass
        // guarantees drawOrEmpoweredClass is set whenever this keyword reaches the effect builder.
        if (drawOrEmpoweredClass !== undefined) {
          effects.push({ type: keyword, empoweredClass: drawOrEmpoweredClass });
        }
      } else if (keyword === 'put-any-number-bottom-hq') {
        // why: D-24132 — the put-any-number-bottom-hq effect carries any trailing Empowered
        // classes captured by the pre-pass so the park site records them on the pending entry;
        // the resolve move applies each via buildEmpoweredComposition AFTER the moves resolve.
        // Omit-when-empty: no empoweredClasses field when the line has no Empowered tail.
        effects.push({
          type: keyword,
          ...(magnitude !== undefined ? { magnitude } : {}),
          ...(putAnyNumberEmpoweredClasses.length > 0
            ? { empoweredClasses: putAnyNumberEmpoweredClasses }
            : {}),
        });
      } else if (REVEAL_KEYWORD_SET.has(keyword)) {
        // why: D-24024 — the dual-grammar seam. A legacy reveal-* keyword translates
        // through revealRulesForLegacyKeyword into the collapsed `reveal` descriptor;
        // the parameterized `[keyword:reveal:...]` grammar (Step 2f) supplies its rules
        // directly for the base `reveal` keyword. Either way the LEGACY keyword stays
        // on hook.keywords (narrative identity — no reverse-map), only the effect is
        // translated. An invalid magnitude yields empty revealRules (a no-op reveal),
        // reproducing the legacy pre-gate/self-guard skip while still emitting one effect.
        let revealRules: RevealRule[];
        if (keyword === 'reveal' && parameterizedRevealRules.length > 0) {
          revealRules = parameterizedRevealRules;
        } else {
          revealRules = revealRulesForLegacyKeyword(keyword, magnitude);
        }
        // why: D-24027 — the descriptor-level reveal-count (Step 2g; default 1) sets how
        // many deck-top cards the reveal handler peeks. Threaded onto the one collapsed
        // reveal descriptor this line emits, whether legacy-translated or parameterized.
        // why: WP-479 / D-24286 — thread reorderRemainder onto the reveal descriptor
        // only when the marker is present, so descriptors without it stay byte-identical.
        effects.push(reorderRemainder ? { type: 'reveal', revealCount, revealRules, reorderRemainder: true } : { type: 'reveal', revealCount, revealRules });
      } else if (magnitude !== undefined) {
        effects.push({ type: keyword, magnitude });
      } else {
        effects.push({ type: keyword });
      }
    }
  }

  // Step 5: Assign timing — a keyword default (e.g. wall-crawl → onRecruit), then an
  // explicit [timing:X] markup override; otherwise 'onPlay'. No NL inference.
  // why: D-24049 — a keyword's default timing (KEYWORD_TIMING_DEFAULTS) is applied
  // first so [keyword:Wall-Crawl] resolves to an onRecruit hook; an explicit [timing:X]
  // marker still wins (applied after); a line with no mapped keyword keeps onPlay.
  let timing: HeroAbilityTiming = 'onPlay';
  for (const keyword of uniqueKeywords) {
    const keywordDefaultTiming = KEYWORD_TIMING_DEFAULTS[keyword];
    if (keywordDefaultTiming !== undefined) {
      timing = keywordDefaultTiming;
      break;
    }
  }
  const timingMatch = TIMING_PATTERN.exec(abilityText);
  if (timingMatch !== null) {
    const mappedTiming = TIMING_MARKUP_MAP[timingMatch[1]!];
    if (mappedTiming !== undefined) {
      timing = mappedTiming;
    }
  }

  return {
    keywords: uniqueKeywords,
    conditions,
    effects: effects.length > 0 ? effects : [],
    primitiveEffects,
    unresolvedMarkers,
    resolvedMarkers,
    sizeChangingClasses,
    timing,
  };
}

/**
 * Checks if a string is a valid HeroKeyword.
 */
function isValidHeroKeyword(value: string): value is HeroKeyword {
  for (const keyword of HERO_KEYWORDS) {
    if (keyword === value) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a string is a hero composition marker (a key in HERO_COMPOSITION_MARKERS).
 *
 * Mirrors isValidHeroKeyword. A composition marker is the OPEN mechanic space (D-24031),
 * distinct from the closed HeroKeyword union — `berserk` is a marker, never a keyword.
 */
function isHeroCompositionMarker(value: string): boolean {
  for (const markerName of HERO_COMPOSITION_MARKER_NAMES) {
    if (markerName === value) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a string is a parameterized composition marker
 * (a name in PARAMETERIZED_COMPOSITION_MARKER_NAMES).
 *
 * Mirrors isHeroCompositionMarker, but for markers whose AST is BUILT per a parsed parameter
 * (empowered) rather than stored as a static HERO_COMPOSITION_MARKERS row (D-24044).
 */
function isParameterizedCompositionMarker(value: string): boolean {
  for (const markerName of PARAMETERIZED_COMPOSITION_MARKER_NAMES) {
    if (markerName === value) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves the unconditional core form of a parameterized Empowered marker, or undefined for
 * a deferred variant. Returns a built `gain-resource` composition ONLY when (a) the text
 * immediately after the marker is an anchored `by [hc:COLOR]` tail, AND (b) that color is the
 * line's SOLE condition (no prefix gate, no multi-class, no team gate). Any miss → undefined,
 * so the caller records an unresolved marker (the Honest-Partial Invariant). Does not mutate
 * `conditions`; the caller suppresses the consumed param on a match.
 *
 * @param textAfterMarker - The ability text immediately following the `[keyword:Empowered]` token.
 * @param conditions - The line's conditions (heroClassMatch + requiresTeam), in hook order.
 * @returns The built Empowered composition, or undefined for a deferred variant.
 */
function tryResolveEmpoweredCore(
  textAfterMarker: string,
  conditions: HeroCondition[],
): EffectNode | undefined {
  // why: D-24044 — anchored marker-tail match only; the color must immediately follow as
  // `by [hc:COLOR]`. A non-anchored scan would bind a later unrelated [hc:...] to Empowered.
  const tailMatch = EMPOWERED_PARAM_TAIL_PATTERN.exec(textAfterMarker);
  if (tailMatch === null) {
    return undefined;
  }
  const heroClass = normalizeTraitSlug(tailMatch[1]!);
  // why: D-24044 Honest-Partial — resolve ONLY when the consumed [hc:COLOR] param is the
  // line's sole condition. A residual condition (an [hc:X]:/[team:X]: prefix gate, a
  // multi-class `and [hc:Y]`, or a team gate) means a deferred variant → keep it hollow.
  const onlyCondition = conditions[0];
  if (
    conditions.length !== 1
    || onlyCondition === undefined
    || onlyCondition.type !== 'heroClassMatch'
    || onlyCondition.value !== heroClass
  ) {
    return undefined;
  }
  return buildEmpoweredComposition(heroClass);
}

/**
 * Extracts the trailing "Empowered by [classes]" hero classes from a put-any-number-bottom-hq
 * line, or an empty array when the line has no Empowered tail (D-24132). Finds the
 * `[keyword:Empowered]` token, then reads the anchored `by [hc:X] (and [hc:Y]…)` tail
 * immediately after it — the same multi-class / single-class grammar the standalone Empowered
 * resolvers accept. Returns the normalized classes in printed order. Pure; mutates nothing.
 *
 * @param abilityText - The full ability text line (already carrying the put-any-number marker).
 * @returns The normalized Empowered classes in printed order (empty when there is no tail).
 */
function extractPutAnyNumberEmpoweredTailClasses(abilityText: string): string[] {
  const markerMatch = EMPOWERED_MARKER_TOKEN_PATTERN.exec(abilityText);
  if (markerMatch === null) {
    return [];
  }
  const textAfterMarker = abilityText.slice(markerMatch.index + markerMatch[0]!.length);
  const classes: string[] = [];
  // why: try the multi-class tail first (`by [hc:X] and [hc:Y]…`); its `(?:and [hc:…])+`
  // requirement means it never matches the single-class form, so the single-class fallback
  // below owns `by [hc:X]`. Extract every [hc:…] token from whichever tail matched.
  const multiClassTail = EMPOWERED_MULTICLASS_FULL_TAIL_PATTERN.exec(textAfterMarker);
  if (multiClassTail !== null) {
    const classTokenRegex = /\[hc:([a-z0-9-]+)\]/gi;
    let classMatch = classTokenRegex.exec(multiClassTail[0]!);
    while (classMatch !== null) {
      classes.push(normalizeTraitSlug(classMatch[1]!));
      classMatch = classTokenRegex.exec(multiClassTail[0]!);
    }
    return classes;
  }
  const singleClassTail = EMPOWERED_PARAM_TAIL_PATTERN.exec(textAfterMarker);
  if (singleClassTail !== null) {
    classes.push(normalizeTraitSlug(singleClassTail[1]!));
  }
  return classes;
}

/**
 * Resolves the unconditional MULTI-class Empowered form
 * (`by [hc:X] and [hc:Y] (and [hc:Z]…)`), or undefined for a deferred variant. Returns ONE
 * built `gain-resource` composition PER parsed class, in printed order — the total is the sum
 * of each class's HQ count (e.g. `by [hc:ranged] and [hc:strength]` grants +1 Attack per Ranged
 * card plus +1 per Strength card in the HQ). Resolves ONLY when (a) the text immediately after
 * the marker is an anchored `by [hc:X] and [hc:Y]…` tail with two-or-more classes, AND (b) those
 * parsed classes are the line's SOLE conditions (each a consumed count param — no prefix gate,
 * no team gate, no residual). Any miss → undefined, so the caller records an unresolved marker
 * (the Honest-Partial Invariant — e.g. a prefix-gated multi-class stays hollow). Reuses the
 * WP-256 `buildEmpoweredComposition` substrate — no new keyword / value-expression / node type.
 * Does not mutate `conditions`; the caller clears the consumed params on a match.
 *
 * @param textAfterMarker - The ability text immediately following the `[keyword:Empowered]` token.
 * @param conditions - The line's conditions (heroClassMatch + requiresTeam), in hook order.
 * @returns One composition per parsed class in printed order, or undefined for a deferred variant.
 */
function tryResolveEmpoweredMultiClass(
  textAfterMarker: string,
  conditions: HeroCondition[],
): EffectNode[] | undefined {
  // why: WP-310 — anchored multi-class tail only; the `(?:and [hc:…])+` requirement means the
  // single-class `by [hc:X]` form (owned by tryResolveEmpoweredCore) never matches here.
  const tailMatch = EMPOWERED_MULTICLASS_FULL_TAIL_PATTERN.exec(textAfterMarker);
  if (tailMatch === null) {
    return undefined;
  }
  // why: WP-310 — extract every `[hc:X]` class token from the matched tail, in printed order.
  // A fresh global RegExp avoids carrying lastIndex state on a shared module-level const.
  const classTokenRegex = /\[hc:([a-z0-9-]+)\]/gi;
  const parsedClasses: string[] = [];
  let classMatch = classTokenRegex.exec(tailMatch[0]!);
  while (classMatch !== null) {
    parsedClasses.push(normalizeTraitSlug(classMatch[1]!));
    classMatch = classTokenRegex.exec(tailMatch[0]!);
  }
  // why: WP-310 Honest-Partial — resolve ONLY when the parsed classes are the line's SOLE
  // conditions (each a consumed count param). This generalizes tryResolveEmpoweredCore's
  // sole-condition gate to N classes: a residual condition (a leading [hc:X]:/[team:X]: prefix
  // gate, a team gate, or any non-heroClassMatch) makes the counts unequal or the type check
  // fail → a deferred variant, kept hollow.
  if (conditions.length !== parsedClasses.length) {
    return undefined;
  }
  for (const condition of conditions) {
    if (condition.type !== 'heroClassMatch') {
      return undefined;
    }
  }
  for (const parsedClass of parsedClasses) {
    if (findFirstHeroClassMatchIndex(conditions, parsedClass) === -1) {
      return undefined;
    }
  }
  // why: WP-310 / D-24098 — one buildEmpoweredComposition per parsed class, pushed in printed
  // order. The sum is commutative but the order is fixed for deterministic replay. No `.reduce()`.
  const compositions: EffectNode[] = [];
  for (const parsedClass of parsedClasses) {
    compositions.push(buildEmpoweredComposition(parsedClass));
  }
  return compositions;
}

/**
 * Detection-only resolver for the conditional-prefix class-gated Empowered form
 * (`[hc:X]: ... [keyword:Empowered] by [hc:Y]`). Returns the built composition plus the
 * NORMALIZED count color `Y` when `abilityText` matches the canonical structural shape, or
 * undefined for any non-canonical / still-deferred form. Reads `conditions` only to confirm
 * the consumed count param `heroClassMatch(Y)` is present; mutates NOTHING — the caller
 * performs the push + suppression after a canonical match. The caller guarantees the marker
 * is `empowered` (gate #1) and that the unconditional core path already returned undefined.
 *
 * @param abilityText - The full ability text line.
 * @param textAfterMarker - The text immediately following the `[keyword:Empowered]` token.
 * @param conditions - The line's conditions (heroClassMatch + requiresTeam), in hook order.
 * @returns The built composition + normalized count color, or undefined for any non-canonical shape.
 */
function tryResolveEmpoweredConditionalPrefix(
  abilityText: string,
  textAfterMarker: string,
  conditions: HeroCondition[],
): { composition: EffectNode; countColor: string } | undefined {
  // why: D-24047 gate #2 — resolve ONLY a single [keyword:Empowered] marker. The two-marker
  // choose-one (fight-or-flight) is rejected here; a condition-counting gate would mis-resolve
  // it (treating the second branch's count param as a gate) — the Honest-Partial Invariant.
  const markerMatches = abilityText.match(EMPOWERED_MARKER_COUNT_PATTERN);
  if (markerMatches === null || markerMatches.length !== 1) {
    return undefined;
  }
  // why: D-24047 gate #3 — require a leading `[hc:X]:` class-condition prefix (the retained gate).
  const prefixMatch = EMPOWERED_PREFIX_GATE_PATTERN.exec(abilityText);
  if (prefixMatch === null) {
    return undefined;
  }
  // why: D-24047 gate #4 — require the anchored fixed-color count tail `by [hc:Y]` immediately
  // after the marker (never a broad forward scan that could bind an unrelated later [hc:...]).
  const tailMatch = EMPOWERED_PARAM_TAIL_PATTERN.exec(textAfterMarker);
  if (tailMatch === null) {
    return undefined;
  }
  // why: D-24047 gate #5 — reject a `... by [hc:Y] and [hc:Z]` multi-class continuation,
  // inspecting ONLY the slice after the consumed tail.
  const textAfterTail = textAfterMarker.slice(tailMatch[0]!.length);
  if (EMPOWERED_MULTICLASS_TAIL_PATTERN.test(textAfterTail)) {
    return undefined;
  }
  // why: D-24047 gate #6 — reject team-gated forms. A fresh non-global test off the canonical
  // TEAM_PATTERN source (the global const carries lastIndex state; a fresh RegExp is stateless).
  if (new RegExp(TEAM_PATTERN.source).test(abilityText)) {
    return undefined;
  }
  // why: D-24047 — normalize the count color ONCE; Step 1a stored heroClassConditions
  // normalized, so the existence check below compares normalized-to-normalized. The prefix
  // class X stays the retained gate (the caller keeps it); only the count color Y is consumed.
  const countColor = normalizeTraitSlug(tailMatch[1]!);
  // why: D-24047 — confirm the consumed count param is present before declaring a canonical
  // match. It always is on the canonical shape (the anchored tail guarantees Step 1a extracted
  // `[hc:Y]`); if it were somehow absent, return undefined so the caller leaves conditions
  // unchanged and records the marker unresolved — never throw, never mutate here.
  if (findFirstHeroClassMatchIndex(conditions, countColor) === -1) {
    return undefined;
  }
  return { composition: buildEmpoweredComposition(countColor), countColor };
}

/**
 * Finds the index of the first `heroClassMatch` condition whose value equals the given
 * NORMALIZED slug, or -1 when none matches. Used both to confirm the consumed Empowered
 * count param exists (detection) and to suppress exactly one occurrence of it (the caller),
 * so suppression removes a single param and retains the leading prefix gate.
 *
 * @param conditions - The line's conditions, in hook order.
 * @param normalizedValue - The normalized hero-class slug to find.
 * @returns The index of the first matching heroClassMatch condition, or -1.
 */
function findFirstHeroClassMatchIndex(
  conditions: HeroCondition[],
  normalizedValue: string,
): number {
  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index]!;
    if (condition.type === 'heroClassMatch' && condition.value === normalizedValue) {
      return index;
    }
  }
  return -1;
}

/**
 * Detection resolver for the choose-one Empowered form ("Choose one: ... [keyword:Empowered]
 * by [hc:X], or ... [keyword:Empowered] by [hc:Y]"). Returns the built composition plus the
 * extracted class list when all gates pass, or undefined for any non-canonical form. Reads
 * `abilityText` only; mutates nothing — the caller performs push and condition suppression
 * after a canonical match.
 *
 * @param abilityText - The full ability text line.
 * @returns The built composition + extracted class list, or undefined for any non-canonical shape.
 */
function tryResolveEmpoweredChooseOneLine(
  abilityText: string,
): { composition: EffectNode; classes: string[] } | undefined {
  // why: D-24063 — choose-one resolved as oracle-max of the two enumerated classes; one
  // composition for the whole line. Prefix gate limits this path to "Choose one:" lines only,
  // leaving the general empowered dispatch entirely unaffected for all other card texts.
  if (!EMPOWERED_CHOOSE_ONE_PREFIX_PATTERN.test(abilityText)) {
    return undefined;
  }
  // The canonical choose-one form has exactly 2 [keyword:Empowered] markers.
  const markerMatches = abilityText.match(EMPOWERED_MARKER_COUNT_PATTERN);
  if (markerMatches === null || markerMatches.length !== 2) {
    return undefined;
  }
  // Extract each `[keyword:Empowered] by [hc:X]` class tail in source order.
  // why: fresh RegExp per call (same lastIndex-safe pattern as heroClassRegex / teamRegex).
  const extractedClasses: string[] = [];
  const classTailRegex = new RegExp(EMPOWERED_CHOOSE_ONE_CLASS_TAIL_PATTERN.source, 'gi');
  let classTailMatch: RegExpExecArray | null = classTailRegex.exec(abilityText);
  while (classTailMatch !== null) {
    extractedClasses.push(normalizeTraitSlug(classTailMatch[1]!));
    classTailMatch = classTailRegex.exec(abilityText);
  }
  // Must have found exactly one class tail per marker; any other count is non-canonical.
  if (extractedClasses.length !== 2) {
    return undefined;
  }
  return {
    composition: buildEmpoweredChooseOneComposition(extractedClasses),
    classes: extractedClasses,
  };
}

/**
 * Detection resolver for the draw-or-empowered choose-one form ("Choose one: Draw a card, or you
 * get [keyword:Empowered] by [hc:X]" — One-Hit Wonder). Returns the parsed empowered hero class
 * when all gates pass, or undefined for any non-canonical form. Reads `abilityText` only; mutates
 * nothing — the caller records the keyword + class and suppresses the per-token empowered dispatch
 * after a canonical match.
 *
 * Gated strictly so it never claims the WP-283 two-empowered choose-one (fight-or-flight, two
 * markers) nor the core empowered path (no "Choose one:" prefix): (1) a "Choose one:" prefix,
 * (2) a "Draw a card" draw option, (3) exactly ONE [keyword:Empowered] marker, (4) exactly one
 * `[keyword:Empowered] by [hc:X]` class tail. Any miss → undefined. (D-24069)
 *
 * @param abilityText - The full ability text line.
 * @returns The normalized empowered hero class, or undefined for any non-canonical shape.
 */
function tryResolveDrawOrEmpoweredLine(abilityText: string): { empoweredClass: string } | undefined {
  // why: D-24069 gate #1 — the "Choose one:" prefix (reuses the WP-283 prefix const); limits this
  // path to choose-one lines, leaving every other card text's empowered dispatch unaffected.
  if (!EMPOWERED_CHOOSE_ONE_PREFIX_PATTERN.test(abilityText)) {
    return undefined;
  }
  // why: D-24069 gate #2 — a printed "Draw a card" option separates this form from the WP-283
  // two-empowered choose-one (two Empowered halves, no draw).
  if (!DRAW_A_CARD_PATTERN.test(abilityText)) {
    return undefined;
  }
  // why: D-24069 gate #3 — EXACTLY ONE [keyword:Empowered] marker. Two markers is the WP-283
  // fight-or-flight shape (claimed by tryResolveEmpoweredChooseOneLine); zero is not this form.
  // String.match with the global const ignores lastIndex (stateless), mirroring the choose-one helper.
  const markerMatches = abilityText.match(EMPOWERED_MARKER_COUNT_PATTERN);
  if (markerMatches === null || markerMatches.length !== 1) {
    return undefined;
  }
  // why: D-24069 gate #4 — extract the single `[keyword:Empowered] by [hc:X]` class tail (fresh
  // RegExp per call, the lastIndex-safe pattern used by heroClassRegex / the choose-one helper).
  const classTailRegex = new RegExp(EMPOWERED_CHOOSE_ONE_CLASS_TAIL_PATTERN.source, 'gi');
  const extractedClasses: string[] = [];
  let classTailMatch: RegExpExecArray | null = classTailRegex.exec(abilityText);
  while (classTailMatch !== null) {
    extractedClasses.push(normalizeTraitSlug(classTailMatch[1]!));
    classTailMatch = classTailRegex.exec(abilityText);
  }
  if (extractedClasses.length !== 1) {
    return undefined;
  }
  return { empoweredClass: extractedClasses[0]! };
}

/**
 * Resolver for the free-choice Empowered form ("by the color of your choice" — no
 * `[hc:CLASS]` literal in the tail after the marker). Returns a built free-choice
 * composition when `EMPOWERED_PARAM_TAIL_PATTERN` does NOT match `textAfterMarker`, and
 * undefined when it DOES match (that case is the core path's domain — a literal class IS
 * present). Called after both `tryResolveEmpoweredCore` and
 * `tryResolveEmpoweredConditionalPrefix` already returned undefined.
 *
 * @param textAfterMarker - The ability text immediately following the `[keyword:Empowered]` token.
 * @returns The built free-choice composition, or undefined when a class literal tail is present.
 */
function tryResolveEmpoweredFreeChoice(
  textAfterMarker: string,
  conditions: HeroCondition[],
): EffectNode | undefined {
  // why: D-24063 — guard: return undefined when EMPOWERED_PARAM_TAIL_PATTERN matches —
  // a literal `by [hc:CLASS]` tail means the core path's domain; free-choice applies ONLY
  // when no class literal follows the marker ("by the color of your choice").
  if (EMPOWERED_PARAM_TAIL_PATTERN.test(textAfterMarker)) {
    return undefined;
  }
  // why: D-24065 — guard: return undefined when the revealed-classes dynamic pattern matches
  // the text after the marker. The dynamic form ("by the Hero Classes of the card you revealed
  // this way") has no [hc:X] literal and no conditions, so without this guard the free-choice
  // path would capture it before tryResolveEmpoweredDynamic can. The dynamic resolver is the
  // last fallback; this guard lets it reach that position.
  if (EMPOWERED_REVEALED_CLASSES_PATTERN.test(textAfterMarker)) {
    return undefined;
  }
  // why: D-24063 — free-choice applies ONLY when no [hc:X] token appears ANYWHERE on the line.
  // A non-empty conditions array means at least one heroClassMatch was extracted (prefix gate,
  // detached literal, or non-anchored class reference) — that form is not the simple free-choice,
  // so defer to keep Honest-Partial invariant intact.
  if (conditions.length > 0) {
    return undefined;
  }
  return buildEmpoweredFreeChoiceComposition();
}

/**
 * Resolver for the dynamic Empowered form ("by the Hero Classes of the card you revealed
 * this way" — no `[hc:CLASS]` literal; class is determined at runtime from the top deck card).
 * Returns a built dynamic composition when `EMPOWERED_REVEALED_CLASSES_PATTERN` matches
 * `textAfterMarker`, and undefined otherwise. Called as the LAST fallback before
 * `unresolvedMarkers.push`, after core, conditional-prefix, free-choice, and choose-one
 * all returned undefined.
 *
 * @param textAfterMarker - The ability text immediately following the `[keyword:Empowered]` token.
 * @returns The built dynamic composition, or undefined when the pattern does not match.
 */
// why: D-24065 — recognizes "classes of the card you revealed" phrasing; last fallback
// before unresolved; cards whose empowered form refers to a runtime-dynamic class (cross-the-multiverse).
function tryResolveEmpoweredDynamic(textAfterMarker: string): EffectNode | undefined {
  if (!EMPOWERED_REVEALED_CLASSES_PATTERN.test(textAfterMarker)) {
    return undefined;
  }
  return buildDynamicEmpoweredComposition();
}

// ---------------------------------------------------------------------------
// Parameterized reveal token parsing (forward-compat; D-24024)
// ---------------------------------------------------------------------------

/**
 * Parses a non-negative integer from a parameterized reveal token segment.
 *
 * @param value - The digit substring (e.g. the `2` of `cost-lte-2`).
 * @returns The parsed integer, or null when the segment is not all digits.
 */
function parseRevealTokenInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  return parseInt(value, 10);
}

/**
 * Parses a parameterized reveal predicate segment into a RevealPredicate.
 *
 * Grammar: `always` | `cost-zero` | `cost-odd` | `cost-lte-<n>` | `cost-gte-<n>`.
 *
 * @param token - The predicate segment of a `[keyword:reveal:...]` token.
 * @returns The RevealPredicate, or null when the segment is unrecognized.
 */
function parseRevealPredicateToken(token: string): RevealPredicate | null {
  if (token === 'always') {
    return { kind: 'always' };
  }
  if (token === 'cost-zero') {
    return { kind: 'cost-zero' };
  }
  if (token === 'cost-odd') {
    return { kind: 'cost-odd' };
  }
  if (token.startsWith('cost-lte-')) {
    const threshold = parseRevealTokenInteger(token.slice('cost-lte-'.length));
    return threshold === null ? null : { kind: 'cost-lte', threshold };
  }
  if (token.startsWith('cost-gte-')) {
    const threshold = parseRevealTokenInteger(token.slice('cost-gte-'.length));
    return threshold === null ? null : { kind: 'cost-gte', threshold };
  }
  return null;
}

/**
 * Parses a parameterized reveal action segment into a RevealAction.
 *
 * Grammar: `draw` | `ko` | `attack-by-cost` | `attack-fixed-<n>` |
 * `choose-discard-or-return`.
 *
 * @param token - One action segment (the `+`-joined parts are split by the caller).
 * @returns The RevealAction, or null when the segment is unrecognized.
 */
function parseRevealActionToken(token: string): RevealAction | null {
  if (token === 'draw') {
    return { kind: 'draw' };
  }
  if (token === 'ko') {
    return { kind: 'ko' };
  }
  if (token === 'attack-by-cost') {
    return { kind: 'attack-by-cost' };
  }
  if (token === 'choose-discard-or-return') {
    return { kind: 'choose-discard-or-return' };
  }
  if (token.startsWith('attack-fixed-')) {
    const amount = parseRevealTokenInteger(token.slice('attack-fixed-'.length));
    return amount === null ? null : { kind: 'attack-fixed', amount };
  }
  return null;
}

/**
 * Parses one parameterized reveal token (one RevealRule) from its captured
 * segments. Returns null when the predicate or any action segment is malformed —
 * a malformed token voids that one rule (safe-skip, no throw).
 *
 * @param predicateToken - The predicate segment.
 * @param actionsToken - The `+`-joined actions segment.
 * @param continueToken - The optional `continue` flag (undefined when absent).
 * @returns The RevealRule, or null when any segment is malformed.
 */
function parseRevealRuleToken(
  predicateToken: string,
  actionsToken: string,
  continueToken: string | undefined,
): RevealRule | null {
  const predicate = parseRevealPredicateToken(predicateToken);
  if (predicate === null) {
    return null;
  }
  const actions: RevealAction[] = [];
  for (const actionToken of actionsToken.split('+')) {
    const action = parseRevealActionToken(actionToken);
    if (action === null) {
      return null;
    }
    actions.push(action);
  }
  if (actions.length === 0) {
    return null;
  }
  const rule: RevealRule = { predicate, actions };
  if (continueToken === 'continue') {
    rule.continue = true;
  }
  return rule;
}

/**
 * Checks if a string is a valid HeroCountSource.
 *
 * Used to gate the count-scaled attack token: only a source in
 * HERO_COUNT_SOURCES produces an 'attack-per-count' effect; an unrecognized
 * source is ignored (no effect emitted).
 */
function isValidHeroCountSource(value: string): value is HeroCountSource {
  for (const source of HERO_COUNT_SOURCES) {
    if (source === value) {
      return true;
    }
  }
  return false;
}

/**
 * Removes duplicate keywords while preserving order.
 */
function deduplicateKeywords(keywords: HeroKeyword[]): HeroKeyword[] {
  const seen = new Set<HeroKeyword>();
  const result: HeroKeyword[] = [];
  for (const keyword of keywords) {
    if (!seen.has(keyword)) {
      seen.add(keyword);
      result.push(keyword);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hero slug extraction (same pattern as economy.logic.ts)
// ---------------------------------------------------------------------------

/**
 * Extracts the hero slug from a hero FlatCard key.
 *
 * Key format: {setAbbr}-hero-{heroSlug}-{slot}
 * The heroSlug is between "hero-" and the last "-{slot}" segment.
 *
 * Promoted to a named export for WP-113 — the validator's
 * `buildKnownHeroQualifiedIds` consumes this as the single source of
 * truth for hero-slug grammar (Class A: flat-card-key decoder). Inventing
 * a parallel decoder is contract drift per D-10014 Authority Lock.
 */
// why: D-10014 — single source of truth — flat-card-key decoder.
export function extractHeroSlug(card: HeroAbilityFlatCard): string {
  const prefix = `${card.setAbbr}-hero-`;
  if (!card.key.startsWith(prefix)) {
    return '';
  }

  // why: slot is always the last segment after the final "-"
  const afterPrefix = card.key.slice(prefix.length);
  const lastDashIndex = afterPrefix.lastIndexOf('-');
  if (lastDashIndex === -1) {
    return '';
  }

  return afterPrefix.slice(0, lastDashIndex);
}

/**
 * Parses a set-qualified ID `<setAbbr>/<slug>` into its components.
 *
 * Returns null on malformed input. Locally duplicated per WP-113 §6 step 1.
 */
// why: D-10014 — duplicated locally to avoid a circular import between
// builders and matchSetup.validate.ts.
function parseQualifiedId(input: string): { setAbbr: string; slug: string } | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  if (input !== input.trim()) return null;
  const slashIndex = input.indexOf('/');
  if (slashIndex === -1) return null;
  if (input.indexOf('/', slashIndex + 1) !== -1) return null;
  const setAbbr = input.slice(0, slashIndex);
  const slug = input.slice(slashIndex + 1);
  if (setAbbr.length === 0 || slug.length === 0) return null;
  return { setAbbr, slug };
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/**
 * Runtime type guard for HeroAbilityRegistryReader.
 *
 * Returns true if the registry object has the required listCards method
 * and returns cards with abilities arrays.
 */
// why: D-10014 — orchestration-side diagnostic detection seam. The
// orchestration layer (buildInitialGameState) imports this guard to detect
// registry-reader interface mismatches and emit G.messages diagnostics.
export function isHeroAbilityRegistryReader(
  registry: unknown,
): registry is HeroAbilityRegistryReader {
  if (!registry || typeof registry !== 'object') return false;

  const candidate = registry as Record<string, unknown>;
  return typeof candidate.listCards === 'function';
}

// ---------------------------------------------------------------------------
// buildHeroAbilityHooks — setup-time builder
// ---------------------------------------------------------------------------

// why: setup-time-only pattern — same as buildVillainDeck,
// buildCardStats. Registry data is consumed once and never accessed
// at runtime.

/**
 * Builds hero ability hooks from registry card data at setup time.
 *
 * Called during Game.setup() via buildInitialGameState. Resolves hero
 * cards from the selected hero decks, extracts structured ability
 * metadata, and produces a list of HeroAbilityHook entries.
 *
 * After setup, G.heroAbilityHooks is immutable — moves must never
 * modify it.
 *
 * @param registry - Card registry for resolving hero card data.
 *   Used at setup time only. Accepts unknown to support narrow test
 *   mocks. If the registry does not satisfy HeroAbilityRegistryReader
 *   structurally, returns an empty array gracefully.
 * @param matchConfig - Validated match setup config with heroDeckIds.
 * @returns Array of HeroAbilityHook entries for all selected hero cards.
 */
export function buildHeroAbilityHooks(
  registry: unknown,
  matchConfig: MatchSetupConfig,
): HeroAbilityHook[] {
  if (!isHeroAbilityRegistryReader(registry)) {
    return [];
  }

  // why: hook keys are the canonical-face slash instance ids emitted by
  // heroCardInstanceExtIds (D-18705), which reads the hero entry from set
  // data — so getSet is required here even though isHeroAbilityRegistryReader
  // guards only listCards (the guard's listCards-only contract is pinned by
  // buildInitialGameState.loadout.test.ts and the validator's
  // buildKnownHeroQualifiedIds). When getSet is absent (narrow listCards-only
  // test mocks), no hero entries are reachable, so no hooks are built —
  // identical to the empty-result path, no throw.
  const candidate = registry as { getSet?: unknown };
  if (typeof candidate.getSet !== 'function') {
    return [];
  }
  const getSet = candidate.getSet as (abbr: string) => unknown;

  const hooks: HeroAbilityHook[] = [];

  // Iterate selected hero decks deterministically.
  // why: D-10014 — Builder Filtering Order — iterate named set only. Each
  // heroDeckIds entry is `<setAbbr>/<heroSlug>`; resolve the hero entry from
  // that set's data only. Hero slugs collide across sets (51 / 307 instances
  // per the D-10014 PS-8 probe), so the named-set filter is non-negotiable.
  for (const heroDeckId of matchConfig.heroDeckIds) {
    const parsed = parseQualifiedId(heroDeckId);
    if (parsed === null) {
      // Malformed input: skip silently. The validator is the authoritative
      // format-error reporter; this builder is defense-in-depth.
      continue;
    }

    const heroEntry = findHeroAbilityHeroEntry(getSet(parsed.setAbbr), parsed.slug);
    if (heroEntry === null) continue;

    // why: D-18705 — emit one hook per (canonical-face slash instance id ×
    // ability line). The instance ids come from the shared emitter (matching
    // the played-card zone id getHooksForCard reads at the play site); the
    // ability text is resolved from the cards[] entry whose slug === the
    // canonical face (sides[0]). A copy with no resolvable canonical-face
    // card entry emits no hook (safe-skip, no throw) — non-canonical-face
    // ability text is out of scope.
    const instances = heroCardInstanceExtIds(parsed.setAbbr, parsed.slug, heroEntry);
    for (const instance of instances) {
      const cardEntry = findHeroAbilityCardBySlug(heroEntry.cards, instance.cardSlug);
      if (cardEntry === null) continue;
      if (!Array.isArray(cardEntry.abilities) || cardEntry.abilities.length === 0) {
        continue;
      }

      for (const abilityText of cardEntry.abilities) {
        if (typeof abilityText !== 'string' || abilityText.trim() === '') {
          continue;
        }

        const parsedAbility = parseAbilityText(abilityText);

        // why: freshly-constructed hook per instance — copies never alias a
        // shared object or arrays (D-13502).
        const hook: HeroAbilityHook = {
          cardId: instance.extId,
          timing: parsedAbility.timing,
          keywords: parsedAbility.keywords,
        };

        if (parsedAbility.conditions.length > 0) {
          hook.conditions = parsedAbility.conditions;
        }

        if (parsedAbility.effects.length > 0) {
          hook.effects = parsedAbility.effects;
        }

        // why: D-24031 — assign primitiveEffects only when non-empty (mirror the
        // effects/conditions conditional construction — exactOptionalPropertyTypes
        // forbids `: x ?? undefined`). Each element is already a deep copy of its
        // registry AST, so the hook never aliases the shared HERO_COMPOSITION_MARKERS const.
        if (parsedAbility.primitiveEffects.length > 0) {
          hook.primitiveEffects = parsedAbility.primitiveEffects;
        }

        // why: WP-257 / D-24034 — assign unresolvedMarkers only when non-empty (same
        // exactOptionalPropertyTypes conditional-construction pattern). Absent means
        // "no unresolved marker" — flavor-text lines carry no markers and so omit it,
        // which is exactly what keeps flavor text from flagging hollow at runtime.
        if (parsedAbility.unresolvedMarkers.length > 0) {
          hook.unresolvedMarkers = parsedAbility.unresolvedMarkers;
        }

        // why: D-24045 — assign resolvedMarkers only when non-empty (mirror the
        // unresolvedMarkers conditional-assign verbatim — exactOptionalPropertyTypes forbids
        // assigning `undefined`). Absent means "no composition resolved on this line"; the
        // mechanic ledger reads this per card to classify composition markers by-hook.
        if (parsedAbility.resolvedMarkers.length > 0) {
          hook.resolvedMarkers = parsedAbility.resolvedMarkers;
        }

        // why: D-24074 / WP-290 — assign the granted-class list only when non-empty (same
        // exactOptionalPropertyTypes conditional-construction pattern as the fields above).
        // Absent means "no Size-Changing grant" — both non-Size-Changing lines and a
        // Size-Changing line with no [hc:X] omit it; getGrantedClasses treats absent as [].
        if (parsedAbility.sizeChangingClasses.length > 0) {
          hook.sizeChangingClasses = parsedAbility.sizeChangingClasses;
        }

        hooks.push(hook);
      }
    }
  }

  return hooks;
}

/**
 * Finds a hero entry within set data's heroes[] by slug.
 *
 * Returns null when the set data is absent/malformed or the named hero is
 * not present (no cross-set fallback) — mirrors the soft-skip pattern in
 * buildHeroDeckCards and buildCardStats.
 *
 * @param setData - Raw set data from getSet().
 * @param heroSlug - Hero slug to match.
 * @returns The matching hero entry, or null.
 */
function findHeroAbilityHeroEntry(
  setData: unknown,
  heroSlug: string,
): HeroAbilityHeroEntry | null {
  if (!setData || typeof setData !== 'object') return null;
  const candidate = setData as { heroes?: unknown };
  if (!Array.isArray(candidate.heroes)) return null;

  for (const entry of candidate.heroes) {
    if (!entry || typeof entry !== 'object') continue;
    const heroEntry = entry as HeroAbilityHeroEntry;
    if (typeof heroEntry.slug !== 'string') continue;
    if (heroEntry.slug !== heroSlug) continue;
    if (!Array.isArray(heroEntry.cards)) continue;
    return heroEntry;
  }
  return null;
}

/**
 * Finds the hero card entry whose slug matches the canonical-face slug.
 *
 * @param cards - The hero entry's cards array.
 * @param slug - The canonical-face slug (physicalCards[].sides[0]).
 * @returns The matching card entry, or null when none matches.
 */
function findHeroAbilityCardBySlug(
  cards: HeroAbilityHeroCardEntry[],
  slug: string,
): HeroAbilityHeroCardEntry | null {
  for (const cardEntry of cards) {
    if (!cardEntry || typeof cardEntry !== 'object') continue;
    if (cardEntry.slug === slug) return cardEntry;
  }
  return null;
}
