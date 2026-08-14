/**
 * Villain & henchman ability hook builder for setup-time resolution.
 *
 * Reads villain per-card and henchman group-level ability text from the
 * registry, detects the `Ambush:` / `Fight:` timing prefix and any
 * `[effect:<VillainEffectKeyword>]` markers, and produces the deterministic
 * VillainAbilityHook[] table stored in G.villainAbilityHooks.
 *
 * Mirrors the WP-021 heroAbility.setup.ts discipline: a local structural
 * registry reader (no registry-package import), markup validated against a
 * canonical union, no NL parsing, no .reduce(), no throws. Setup-time only.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type {
  VillainAbilityHook,
  VillainAbilityTiming,
  VillainEffectKeyword,
  VillainEffectDescriptor,
  VillainEffectPrimitive,
} from '../rules/villainAbility.types.js';
import {
  VILLAIN_ABILITY_TIMINGS,
  VILLAIN_EFFECT_KEYWORDS,
  VILLAIN_EFFECT_PRIMITIVES,
  LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR,
} from '../rules/villainAbility.types.js';
// why: D-24295 — the universal `@<space>` location-gate suffix validates each space
// against the canonical CITY_SPACE_NAMES; CitySpaceName is the lifted field type.
import type { CitySpaceName } from '../board/citySpaceNames.js';
import { CITY_SPACE_NAMES } from '../board/citySpaceNames.js';
// why: D-24281 — reveal-or-wound stores its `requireValue` normalized to the
// `cardTraits` slug space so the executor's `===` trait comparison is
// casing/whitespace-safe. normalizeTraitSlug is the SINGLE canonical normalizer
// (traits.normalize.ts), the same one buildCardTraits + the D-24076 defeat-
// requirement setup use — reusing it here keeps marker values and trait slugs
// in one space; a second normalizer would be a drift source.
import { normalizeTraitSlug } from '../state/traits.normalize.js';
// why: D-18704 / D-18706 — villain hooks must key by the copy-indexed
// instance ext_id (matching the Fight/Ambush fire sites that pass a zone id),
// fanning out exactly like the henchman path already does. The shared emitter
// is imported, not re-implemented (D-13702 RS-4).
import { villainCardInstanceExtIds } from '../villainDeck/villainDeck.setup.js';

// ---------------------------------------------------------------------------
// VillainAbilityRegistryReader — local structural interface
// ---------------------------------------------------------------------------

// why: game-engine must not import the registry package; this interface is
// satisfied structurally by CardRegistry. It exposes only getSet — the single
// method needed to read villain and henchman ability text per the selected
// match groups (same getSet-per-group pattern as buildCardStats).

/**
 * Minimal structural type for a single villain card within a group.
 * Only the slug and ability text are needed for hook resolution.
 */
interface VillainAbilityVillainCard {
  slug: string;
  abilities: string[];
  /** Copy count (WP-167 / D-16701); read by the shared instance-id emitter. */
  copies?: number;
}

/**
 * Minimal structural type for a villain group entry in set data.
 */
interface VillainAbilityVillainGroup {
  slug: string;
  cards: VillainAbilityVillainCard[];
}

/**
 * Minimal structural type for a henchman group entry in set data.
 *
 * Henchman ability text is stored at the group level (`abilities[]`), shared
 * by every virtual copy in the group — the registry has no per-copy entry.
 */
interface VillainAbilityHenchmanGroup {
  slug: string;
  abilities: string[];
}

/**
 * Minimal structural type for set data returned by getSet().
 * Only the villain and henchman collections are read here.
 */
interface VillainAbilitySetData {
  villains: VillainAbilityVillainGroup[];
  henchmen: VillainAbilityHenchmanGroup[];
}

/**
 * Setup-time registry interface for villain/henchman ability resolution.
 *
 * Satisfied structurally by the real CardRegistry. Defined locally to respect
 * the layer boundary (same pattern as VillainDeckRegistryReader).
 */
export interface VillainAbilityRegistryReader {
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// why: standard Marvel Legendary base rule — 10 identical copies per henchman
// group in the villain deck (matches HENCHMAN_COPIES_PER_GROUP in
// villainDeck.setup.ts and the 10-copy cardStats loop in economy.logic.ts).
// One hook is fanned out per copy so each instance ext_id has its own entry.
/** Number of henchman virtual copies per group (instance ext_ids 00-09). */
const HENCHMAN_COPIES_PER_GROUP = 10;

// ---------------------------------------------------------------------------
// Internal collection entry (pre-sort)
// ---------------------------------------------------------------------------

/**
 * One pre-sort hook record carrying its source ability-line index so the
 * deterministic emission order can use it as the final tiebreaker.
 */
interface HookEntry {
  cardId: CardExtId;
  timing: VillainAbilityTiming;
  /** Index of the source ability line within its source abilities[] array. */
  lineIndex: number;
  /** Recognized legacy keywords on this line, in source order. */
  keywords: VillainEffectKeyword[];
  /** Executable descriptors on this line, in source order. */
  effects: VillainEffectDescriptor[];
  /** Raw `[effect:X]` tokens that resolved to nothing (WP-257 / D-24034). */
  unresolvedMarkers: string[];
}

// ---------------------------------------------------------------------------
// Marker + timing extraction (structured patterns only — no NL parsing)
// ---------------------------------------------------------------------------

/** Regex for [effect:X] effect-marker markup. */
const EFFECT_MARKER_PATTERN = /\[effect:([^\]]+)\]/g;

/**
 * Checks whether a string is a valid VillainEffectKeyword.
 *
 * @param value - The raw marker value to validate.
 * @returns True when value is one of the canonical effect keywords.
 */
function isValidVillainEffectKeyword(
  value: string,
): value is VillainEffectKeyword {
  for (const keyword of VILLAIN_EFFECT_KEYWORDS) {
    if (keyword === value) {
      return true;
    }
  }
  return false;
}

/**
 * Detects the timing label from an ability line's leading text prefix.
 *
 * Returns 'onAmbush' for an `Ambush:` prefix, 'onFight' for a `Fight:` prefix,
 * 'onEscape' for an `Escape:` or `Overrun:` prefix, or null when the line
 * matches none.
 *
 * @param abilityLine - One ability text line.
 * @returns The matched timing label, or null.
 */
// why: only the exact `Ambush:` / `Fight:` / `Escape:` / `Overrun:` prefixes
// (word immediately followed by a colon) match in v1, case-insensitive with
// leading whitespace trimmed. Variant forms like `Ambush —` or `Ambush :`
// (spaced colon) are intentionally excluded — matching them would require
// punctuation normalization and would break the no-inference rule. A future
// WP can add variants if a real card ever needs one. Both `Escape:` and
// `Overrun:` map to the same `onEscape` timing — they are v1 synonyms per
// D-18602; the engine collapses them at parse time and `'onOverrun'` is NOT
// in the VillainAbilityTiming union. Distinct overrun semantics are deferred
// to a future scheme-text WP. Effects on the matched line still come from
// `[effect:<VillainEffectKeyword>]` markers (same model as Ambush/Fight) —
// the prefix only determines timing, not effects.
function detectTiming(abilityLine: string): VillainAbilityTiming | null {
  const normalized = abilityLine.replace(/^\s+/, '').toLowerCase();
  if (normalized.startsWith('ambush:')) {
    return 'onAmbush';
  }
  if (normalized.startsWith('fight:')) {
    return 'onFight';
  }
  if (normalized.startsWith('escape:')) {
    return 'onEscape';
  }
  if (normalized.startsWith('overrun:')) {
    return 'onEscape';
  }
  return null;
}

/**
 * Checks whether a string is a valid VillainEffectPrimitive.
 *
 * @param value - The raw token to validate.
 * @returns True when value is one of the canonical primitives.
 */
function isVillainEffectPrimitive(
  value: string,
): value is VillainEffectPrimitive {
  for (const primitive of VILLAIN_EFFECT_PRIMITIVES) {
    if (primitive === value) {
      return true;
    }
  }
  return false;
}

/**
 * Parses a positive-integer magnitude token (1, 2, 3, …); rejects anything else.
 *
 * @param token - The raw magnitude token from a parameterized marker.
 * @returns The parsed integer, or null when the token is not a positive integer.
 */
// why: the magnitude grammar is intentionally strict — only bare positive
// decimal integers with no sign, decimal point, or leading zero. Rejecting
// loose forms keeps the descriptor output canonical so two spellings of the
// same magnitude can never produce two different descriptors.
function parsePositiveInteger(token: string): number | null {
  if (!/^[1-9][0-9]*$/.test(token)) {
    return null;
  }
  return Number.parseInt(token, 10);
}

/**
 * Parses the shared `<kind>:<value>` hero-trait predicate tail used by
 * `reveal-or-wound`, `ko-heroes-current-by-trait`, and
 * `rescue-bystanders-current-by-trait-count` (D-24281 / D-24290), or null when
 * malformed.
 *
 * Requires exactly 3 colon-parts (`<primitive>:<kind>:<value>`). `kind` is the
 * card-text namespace token `team` | `hc`; `hc` maps to the engine kind
 * `hero-class` (mirroring the require-to-defeat marker's team/hc → team/hero-class
 * mapping, D-24076). The value is NORMALIZED to the `cardTraits` slug space so a
 * handler's `===` trait comparison is casing/whitespace-safe and marker values
 * live in one namespace with the trait snapshot. A wrong kind, a wrong token
 * count, or an empty (or whitespace-only) value returns null.
 *
 * @param parts - The colon-split marker parts (`parts[0]` is the primitive token).
 * @returns The normalized predicate, or null when malformed.
 */
// why: D-24290 — extracted at the third trait-predicate copy (reveal-or-wound was
// the first, the two by-trait primitives are the second and third) per the
// duplicate-first / abstract-on-third rule (§Abstraction). One normalizer, one
// grammar — a second inline copy would be a drift source between the three.
function parseTraitPredicateTokens(
  parts: string[],
): { requireKind: 'team' | 'hero-class'; requireValue: string } | null {
  if (parts.length !== 3) {
    return null;
  }
  const kindToken = parts[1];
  let requireKind: 'team' | 'hero-class';
  if (kindToken === 'team') {
    requireKind = 'team';
  } else if (kindToken === 'hc') {
    requireKind = 'hero-class';
  } else {
    return null;
  }
  const rawValue = parts[2] ?? '';
  if (rawValue.length === 0) {
    return null;
  }
  const requireValue = normalizeTraitSlug(rawValue);
  // why: a value of only whitespace normalizes to '' — reject it so an empty
  // predicate can never reach a handler (it would match no hero).
  if (requireValue.length === 0) {
    return null;
  }
  return { requireKind, requireValue };
}

/**
 * Validates a `@<space>[+<space>…]` gate suffix and lifts it to a
 * `requireCitySpaces` list, or null when it is empty or names an unknown space
 * (D-24295).
 *
 * Each space is validated against the canonical `CITY_SPACE_NAMES`; an unknown or
 * empty space returns null so the whole marker resolves to `unresolvedMarkers`
 * rather than silently accepting a mistyped space.
 *
 * @param spacesToken - The text after the `@` (e.g. `streets+bridge`).
 * @returns The validated space list, or null when empty / any space is unknown.
 */
function parseCityGateSuffix(spacesToken: string): CitySpaceName[] | null {
  if (spacesToken.length === 0) {
    return null;
  }
  const spaces: CitySpaceName[] = [];
  for (const rawSpace of spacesToken.split('+')) {
    // why: membership test against the closed CITY_SPACE_NAMES tuple; a `+`-split
    // empty segment (e.g. `streets+`) has length 0 and is not a member → null.
    if (!isCitySpaceName(rawSpace)) {
      return null;
    }
    spaces.push(rawSpace);
  }
  return spaces;
}

/**
 * Checks whether a string is one of the canonical City space names.
 *
 * @param value - The candidate space token.
 * @returns True when value is a member of CITY_SPACE_NAMES.
 */
function isCitySpaceName(value: string): value is CitySpaceName {
  for (const spaceName of CITY_SPACE_NAMES) {
    if (spaceName === value) {
      return true;
    }
  }
  return false;
}

/**
 * Parses a full effect marker value into a descriptor, splitting off the
 * universal `@<space>[+<space>…]` location-gate suffix FIRST (D-24295) and then
 * parsing the remaining primitive grammar.
 *
 * The gate suffix is split before the primitive `:`-grammar so a location gate
 * can decorate ANY effect token. An unknown / empty space, or more than one `@`,
 * returns null (→ `unresolvedMarkers`, never a silent accept). The remaining
 * left side parses by `parseUngatedEffect`; a present gate is attached as
 * `requireCitySpaces`.
 *
 * @param value - The raw marker value (the text inside `[effect:…]`).
 * @returns The parsed descriptor (with any location gate), or null.
 */
function parseParameterizedEffect(
  value: string,
): VillainEffectDescriptor | null {
  const gateSplit = value.split('@');
  // why: at most one `@` — a second gate suffix is malformed, not two gates.
  if (gateSplit.length > 2) {
    return null;
  }
  let requireCitySpaces: CitySpaceName[] | null = null;
  if (gateSplit.length === 2) {
    requireCitySpaces = parseCityGateSuffix(gateSplit[1]!);
    if (requireCitySpaces === null) {
      return null;
    }
  }
  const descriptor = parseUngatedEffect(gateSplit[0]!);
  if (descriptor === null) {
    return null;
  }
  if (requireCitySpaces !== null) {
    descriptor.requireCitySpaces = requireCitySpaces;
  }
  return descriptor;
}

/**
 * Parses a parameterized effect token `<primitive>[:<param>…]` (WITHOUT any
 * `@<space>` gate suffix — the wrapper strips that first) into a descriptor, or
 * null when the token is not a valid parameterized effect.
 *
 * Forward-compatible grammar (WP-252 / D-24023): accepting it makes a future
 * magnitude (e.g. `ko-hero:each:3`) or selector data-only — no new keyword, no
 * code change. Colon-delimited and positional per primitive:
 *   - `ko-hero:current` | `ko-hero:each:<N>`
 *   - `gain-wound:current` | `gain-wound:each` | `gain-wound:each-other[:<N>]` (D-24295)
 *   - `capture-hq-hero:rightmost` | `:highest-cost` | `:lowest-cost`
 *   - `reveal-or-wound:<kind>:<value>`  (kind `team` | `hc`; D-24281)
 *   - `draw-cards-current:<N>`  (N a positive integer; D-24290)
 *   - `override-next-hand-size:<N>`  (N the absolute next-hand target; D-24307)
 *   - `add-next-hand-size:<N>`  (N extra cards added to the next-hand target; D-24352)
 *   - `ko-heroes-current-by-trait:<kind>:<value>`  (kind `team` | `hc`; D-24290)
 *   - `rescue-bystanders-current-by-trait-count:<kind>:<value>`  (D-24290)
 *   - `give-hq-hero-by-trait-to-current:<kind>:<value>`  (kind `team` | `hc`; D-24335)
 *   - `capture-bystander` | `capture-bystander:<N>`  (N a rescue count; D-24295)
 *   - `gain-recruit-current` | `gain-recruit-current:<N>`  (N a recruit count, default 1; D-24350)
 *   - `hero-deck-top-to-escape` | `gain-officer-current`  (no params)
 *
 * @param value - The ungated marker value (the text inside `[effect:…]` minus
 *   any `@<space>` suffix).
 * @returns The parsed descriptor, or null.
 */
function parseUngatedEffect(
  value: string,
): VillainEffectDescriptor | null {
  const parts = value.split(':');
  const primitiveToken = parts[0] ?? '';
  if (!isVillainEffectPrimitive(primitiveToken)) {
    return null;
  }
  if (primitiveToken === 'ko-hero') {
    const target = parts[1];
    if (target === 'current' && parts.length === 2) {
      return { primitive: 'ko-hero', target: 'current' };
    }
    // why: WP-492 / D-24298 — `ko-hero:current:<N>` (N ≥ 2) is the magnitude-N
    // interactive current-player KO (Whirlwind "KO two of your Heroes"). Magnitude 1
    // is the bare `ko-hero:current` above (magnitude-less → reverse-maps to the
    // `koHeroCurrentPlayer` legacy keyword); `ko-hero:current:1` is REJECTED here so
    // magnitude-1 never produces a keyword-less `{ …, magnitude: 1 }` descriptor.
    if (target === 'current' && parts.length === 3) {
      const magnitude = parsePositiveInteger(parts[2]!);
      if (magnitude === null || magnitude < 2) {
        return null;
      }
      return { primitive: 'ko-hero', target: 'current', magnitude };
    }
    if (target === 'each' && parts.length === 3) {
      const magnitude = parsePositiveInteger(parts[2]!);
      if (magnitude === null) {
        return null;
      }
      return { primitive: 'ko-hero', target: 'each', magnitude };
    }
    // why: D-24280 — the 4-token `ko-hero:each:<N>:<zone>` form (Juggernaut's
    // source-zone-restricted each-player KO). `zone` is exactly `discard` or
    // `hand` (no `inPlay` — no printed "from their inPlay" text); a bad zone or a
    // 5th token falls through to `null`.
    if (target === 'each' && parts.length === 4) {
      const magnitude = parsePositiveInteger(parts[2]!);
      if (magnitude === null) {
        return null;
      }
      const zone = parts[3];
      if (zone !== 'discard' && zone !== 'hand') {
        return null;
      }
      return { primitive: 'ko-hero', target: 'each', magnitude, zone };
    }
    return null;
  }
  if (primitiveToken === 'gain-wound') {
    const target = parts[1];
    if (parts.length === 2 && (target === 'current' || target === 'each')) {
      return { primitive: 'gain-wound', target };
    }
    // why: D-24295 — `gain-wound:each-other[:<N>]` (the Lizard) wounds every OTHER
    // player. Optional `:<N>` magnitude (default 1) mirrors ko-hero:each's magnitude
    // grammar so a future N-wound each-other line is data-only. Keyword-less → the
    // handler self-narrates.
    if (target === 'each-other') {
      if (parts.length === 2) {
        return { primitive: 'gain-wound', target: 'each-other', magnitude: 1 };
      }
      if (parts.length === 3) {
        const magnitude = parsePositiveInteger(parts[2]!);
        if (magnitude === null) {
          return null;
        }
        return { primitive: 'gain-wound', target: 'each-other', magnitude };
      }
      return null;
    }
    return null;
  }
  if (primitiveToken === 'capture-bystander') {
    // why: D-24295 — the no-arg form parses to the legacy-keyword descriptor
    // (magnitude undefined → Green Goblin's generic narration, unchanged). The
    // counted `capture-bystander:<N>` form (Abomination: 3) carries the rescue
    // COUNT as `magnitude`; its magnitude-bearing descriptor is keyword-less, so it
    // self-narrates. A non-positive-integer or 3+-token form is rejected.
    if (parts.length === 1) {
      return { primitive: 'capture-bystander' };
    }
    if (parts.length === 2) {
      const magnitude = parsePositiveInteger(parts[1]!);
      if (magnitude === null) {
        return null;
      }
      return { primitive: 'capture-bystander', magnitude };
    }
    return null;
  }
  if (primitiveToken === 'capture-hq-hero') {
    const selector = parts[1];
    if (
      parts.length === 2 &&
      (selector === 'rightmost' ||
        selector === 'highest-cost' ||
        selector === 'lowest-cost')
    ) {
      return { primitive: 'capture-hq-hero', selector };
    }
    return null;
  }
  if (primitiveToken === 'reveal-or-wound') {
    // why: D-24281 — grammar `reveal-or-wound:<kind>:<value>`; the shared
    // predicate parser (D-24290) validates the kind/value tail and normalizes the
    // value. A malformed tail returns null (an empty predicate would wound every
    // player unconditionally, so it must never reach the handler).
    const predicate = parseTraitPredicateTokens(parts);
    if (predicate === null) {
      return null;
    }
    return {
      primitive: 'reveal-or-wound',
      requireKind: predicate.requireKind,
      requireValue: predicate.requireValue,
    };
  }
  if (primitiveToken === 'draw-cards-current') {
    // why: D-24290 — grammar `draw-cards-current:<N>` (exactly 2 tokens); N is a
    // positive integer (Enchantress: 3). A missing or non-positive-integer count
    // falls through to null (the same strict magnitude grammar as `ko-hero:each:N`).
    if (parts.length !== 2) {
      return null;
    }
    const drawCount = parsePositiveInteger(parts[1]!);
    if (drawCount === null) {
      return null;
    }
    return { primitive: 'draw-cards-current', drawCount };
  }
  if (primitiveToken === 'override-next-hand-size') {
    // why: D-24307 — grammar `override-next-hand-size:<N>` (exactly 2 tokens); N is
    // the ABSOLUTE next-hand target size (Doctor Octopus villain Fight: 8), carried
    // as `magnitude` (the same strict positive-integer grammar as `ko-hero:each:N`).
    // A missing or non-positive-integer target falls through to null.
    if (parts.length !== 2) {
      return null;
    }
    const magnitude = parsePositiveInteger(parts[1]!);
    if (magnitude === null) {
      return null;
    }
    return { primitive: 'override-next-hand-size', magnitude };
  }
  if (primitiveToken === 'add-next-hand-size') {
    // why: D-24352 — grammar `add-next-hand-size:<N>` (exactly 2 tokens); N is the number
    // of EXTRA cards added to the current player's next-hand target (Savage Land Mutates: 1),
    // carried as `magnitude` (the same strict positive-integer grammar as
    // `override-next-hand-size:<N>`). A missing or non-positive-integer count falls through
    // to null. The additive-vs-absolute distinction lives in the handler, not the grammar.
    if (parts.length !== 2) {
      return null;
    }
    const magnitude = parsePositiveInteger(parts[1]!);
    if (magnitude === null) {
      return null;
    }
    return { primitive: 'add-next-hand-size', magnitude };
  }
  if (primitiveToken === 'ko-heroes-current-by-trait') {
    // why: D-24290 — grammar `ko-heroes-current-by-trait:<kind>:<value>` (the
    // Destroyer). Reuses the shared trait-predicate parser as the KO filter; a
    // malformed tail returns null.
    const predicate = parseTraitPredicateTokens(parts);
    if (predicate === null) {
      return null;
    }
    return {
      primitive: 'ko-heroes-current-by-trait',
      requireKind: predicate.requireKind,
      requireValue: predicate.requireValue,
    };
  }
  if (primitiveToken === 'rescue-bystanders-current-by-trait-count') {
    // why: D-24290 — grammar
    // `rescue-bystanders-current-by-trait-count:<kind>:<value>` (Baron Zemo).
    // Reuses the shared trait-predicate parser as the count filter; a malformed
    // tail returns null.
    const predicate = parseTraitPredicateTokens(parts);
    if (predicate === null) {
      return null;
    }
    return {
      primitive: 'rescue-bystanders-current-by-trait-count',
      requireKind: predicate.requireKind,
      requireValue: predicate.requireValue,
    };
  }
  if (primitiveToken === 'capture-bystanders-plus-per-hq-hero-by-trait') {
    // why: D-24334 — grammar
    // `capture-bystanders-plus-per-hq-hero-by-trait:<kind>:<value>` (co2e Baron Zemo
    // Ambush: `:team:avengers`). Reuses the shared trait-predicate parser as the
    // HQ-hero count filter; a malformed tail returns null (an empty predicate would
    // make the per-HQ-hero count meaningless, so it must never reach the handler).
    const predicate = parseTraitPredicateTokens(parts);
    if (predicate === null) {
      return null;
    }
    return {
      primitive: 'capture-bystanders-plus-per-hq-hero-by-trait',
      requireKind: predicate.requireKind,
      requireValue: predicate.requireValue,
    };
  }
  if (primitiveToken === 'give-hq-hero-by-trait-to-current') {
    // why: D-24335 — grammar `give-hq-hero-by-trait-to-current:<kind>:<value>` (co2e
    // Ultron Fight: `:hc:tech`). Reuses the shared trait-predicate parser as the HQ-hero
    // filter; a malformed tail returns null (an empty predicate would match no HQ Hero,
    // so it must never reach the handler).
    const predicate = parseTraitPredicateTokens(parts);
    if (predicate === null) {
      return null;
    }
    return {
      primitive: 'give-hq-hero-by-trait-to-current',
      requireKind: predicate.requireKind,
      requireValue: predicate.requireValue,
    };
  }
  if (primitiveToken === 'gain-wound-unless-victory-villain-group') {
    // why: D-24299 — grammar `gain-wound-unless-victory-villain-group:<groupSlug>`
    // (exactly 2 tokens; the group slug non-empty). Viper: `:hydra`. The slug is
    // normalized (normalizeTraitSlug = trim().toLowerCase()) so it matches the
    // registry-verbatim lowercase-kebab group segment in the villain instance
    // ext_id. A missing/empty slug or extra tokens returns null (→ unresolvedMarkers).
    if (parts.length !== 2) {
      return null;
    }
    const rawGroup = parts[1] ?? '';
    if (rawGroup.length === 0) {
      return null;
    }
    const victoryVillainGroup = normalizeTraitSlug(rawGroup);
    // why: a slug of only whitespace normalizes to '' — reject it so an empty
    // predicate can never reach the handler (it would match no villain).
    if (victoryVillainGroup.length === 0) {
      return null;
    }
    return { primitive: 'gain-wound-unless-victory-villain-group', victoryVillainGroup };
  }
  if (primitiveToken === 'gain-recruit-current') {
    // why: D-24350 — grammar `gain-recruit-current[:<N>]` (Hand Ninjas: `:1`). The
    // bare token defaults to 1; `:<N>` carries the recruit count as `magnitude` (the
    // same strict positive-integer grammar as `capture-bystander:<N>`). A 3+-token
    // form or a non-positive-integer count returns null (→ unresolvedMarkers).
    if (parts.length === 1) {
      return { primitive: 'gain-recruit-current', magnitude: 1 };
    }
    if (parts.length === 2) {
      const magnitude = parsePositiveInteger(parts[1]!);
      if (magnitude === null) {
        return null;
      }
      return { primitive: 'gain-recruit-current', magnitude };
    }
    return null;
  }
  // why: hero-deck-top-to-escape, gain-officer-current, and the other no-param
  // primitives take no params; reject any trailing colon-separated tokens so a
  // malformed marker does not silently collapse to a param-less descriptor.
  if (parts.length === 1) {
    return { primitive: primitiveToken };
  }
  return null;
}

/**
 * Extracts the recognized effects from an ability line, in source order, as
 * parallel keyword + descriptor arrays.
 *
 * Reads only `[effect:<value>]` markers. A legacy keyword value (in
 * VILLAIN_EFFECT_KEYWORDS) yields BOTH a keyword and its translated descriptor;
 * a parameterized value (`<primitive>:…`) yields a descriptor only (no legacy
 * keyword); an unknown value is ignored. The `[keyword:]` and `[icon:]`
 * namespaces and free-text English are never read for effects.
 *
 * @param abilityLine - One ability text line.
 * @returns Recognized keywords and descriptors in left-to-right source order.
 */
function extractEffects(abilityLine: string): {
  keywords: VillainEffectKeyword[];
  effects: VillainEffectDescriptor[];
  unresolvedMarkers: string[];
} {
  const keywords: VillainEffectKeyword[] = [];
  const effects: VillainEffectDescriptor[] = [];
  // why: WP-257 / D-24034 — raw `[effect:X]` tokens that resolve to neither a
  // legacy keyword nor a parameterized descriptor. The hollow detector reads this
  // so an unresolved villain marker flags `parse-unrecognized` at the Fight/Ambush/
  // Escape fire sites, distinct from a line that carries no effect marker at all.
  const unresolvedMarkers: string[] = [];
  const regex = new RegExp(EFFECT_MARKER_PATTERN.source, 'g');
  let match: RegExpExecArray | null = regex.exec(abilityLine);
  while (match !== null) {
    const rawValue = match[1]!;
    if (isValidVillainEffectKeyword(rawValue)) {
      // why: legacy grammar — record the keyword AND its frozen-table
      // descriptor, spread into a fresh object so no two hooks alias the shared
      // LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR entry (D-13502).
      keywords.push(rawValue);
      effects.push({ ...LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[rawValue] });
    } else {
      const descriptor = parseParameterizedEffect(rawValue);
      if (descriptor !== null) {
        // why: parameterized grammar — descriptor only, no legacy keyword. No
        // real card uses this yet; the executor's reverse-map yields undefined
        // for such a descriptor, so it is simply not recorded in appliedEffects
        // (descriptor-keyed narrative labels are deferred to WP-253).
        effects.push(descriptor);
      } else {
        // why: WP-257 / D-24034 — an `[effect:X]` marker that is neither a legacy
        // keyword nor a valid parameterized descriptor is a SAW-a-marker-resolved-
        // to-nothing case; record the raw token so the detector flags it hollow.
        unresolvedMarkers.push(rawValue);
      }
    }
    match = regex.exec(abilityLine);
  }
  return { keywords, effects, unresolvedMarkers };
}

// ---------------------------------------------------------------------------
// Set-qualified ID parsing (local copy)
// ---------------------------------------------------------------------------

/**
 * Parses a set-qualified ID `<setAbbr>/<slug>` into its components.
 *
 * Returns null on malformed input — empty string, missing or multiple
 * slashes, empty parts, or surrounding whitespace.
 */
// why: D-10014 — duplicated locally to avoid a circular import between
// setup-time builders and matchSetup.validate.ts. Identical rejection rules
// to the copies in villainDeck.setup.ts and economy.logic.ts.
function parseQualifiedId(
  input: string,
): { setAbbr: string; slug: string } | null {
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
// Registry shape guards + finders
// ---------------------------------------------------------------------------

/**
 * Runtime guard for the VillainAbilityRegistryReader interface.
 *
 * @param registry - Candidate registry object.
 * @returns True when getSet is callable.
 */
function isVillainAbilityRegistryReader(
  registry: unknown,
): registry is VillainAbilityRegistryReader {
  if (!registry || typeof registry !== 'object') return false;
  const candidate = registry as Record<string, unknown>;
  return typeof candidate.getSet === 'function';
}

/**
 * Finds a villain group's cards within a set's villains[].
 *
 * @param setData - Raw set data from getSet().
 * @param groupSlug - The villain group slug to match.
 * @returns The group's villain cards, or null when absent/malformed.
 */
function findVillainGroupCards(
  setData: unknown,
  groupSlug: string,
): VillainAbilityVillainCard[] | null {
  if (!setData || typeof setData !== 'object') return null;
  const candidate = setData as { villains?: unknown };
  if (!Array.isArray(candidate.villains)) return null;

  for (const rawGroup of candidate.villains) {
    if (!rawGroup || typeof rawGroup !== 'object') continue;
    const group = rawGroup as Partial<VillainAbilityVillainGroup>;
    if (group.slug !== groupSlug) continue;
    if (!Array.isArray(group.cards)) return null;
    return group.cards as VillainAbilityVillainCard[];
  }
  return null;
}

/**
 * Finds a henchman group's ability text within a set's henchmen[].
 *
 * @param setData - Raw set data from getSet().
 * @param groupSlug - The henchman group slug to match.
 * @returns The group's ability lines, or null when absent/malformed.
 */
function findHenchmanGroupAbilities(
  setData: unknown,
  groupSlug: string,
): string[] | null {
  if (!setData || typeof setData !== 'object') return null;
  const candidate = setData as { henchmen?: unknown };
  if (!Array.isArray(candidate.henchmen)) return null;

  for (const rawGroup of candidate.henchmen) {
    if (!rawGroup || typeof rawGroup !== 'object') continue;
    const group = rawGroup as Partial<VillainAbilityHenchmanGroup>;
    if (group.slug !== groupSlug) continue;
    if (!Array.isArray(group.abilities)) return null;
    return group.abilities as string[];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Per-source collectors
// ---------------------------------------------------------------------------

/**
 * Collects hook entries for the selected villain groups.
 *
 * Villain hooks are fanned out one per (copy-indexed instance ext_id ×
 * matched ability line) via the shared villainCardInstanceExtIds emitter, so
 * the keys equal the zone-instance grammar the Fight/Ambush fire sites pass
 * (D-18704). Before WP-191 these keyed the single definition id, so
 * getVillainHooksForCard (called with a copy-indexed zone id) always missed
 * and no villain onFight/onAmbush hook ever fired. Gate-consistency with
 * buildCardKeywords (D-18507) is preserved because that builder now emits the
 * `ambush` keyword under the same copy-indexed instance ids.
 *
 * @param registry - Setup-time registry reader.
 * @param matchConfig - Validated match config providing villainGroupIds.
 * @param entries - Accumulator appended in place.
 */
function collectVillainHookEntries(
  registry: VillainAbilityRegistryReader,
  matchConfig: MatchSetupConfig,
  entries: HookEntry[],
): void {
  for (const villainGroupId of matchConfig.villainGroupIds) {
    const parsed = parseQualifiedId(villainGroupId);
    if (parsed === null) continue;
    const setData = registry.getSet(parsed.setAbbr);
    const groupCards = findVillainGroupCards(setData, parsed.slug);
    if (groupCards === null) continue;

    for (const card of groupCards) {
      if (typeof card.slug !== 'string') continue;
      if (!Array.isArray(card.abilities)) continue;
      const instanceExtIds = villainCardInstanceExtIds(
        parsed.setAbbr,
        parsed.slug,
        card.slug,
        card,
      );

      for (let lineIndex = 0; lineIndex < card.abilities.length; lineIndex++) {
        const abilityLine = card.abilities[lineIndex];
        if (typeof abilityLine !== 'string') continue;
        const timing = detectTiming(abilityLine);
        if (timing === null) continue;
        const extracted = extractEffects(abilityLine);
        // why: fan out one freshly-constructed hook per copy instance so
        // copies never alias a shared keywords/effects array (D-13502),
        // mirroring the henchman fan-out below. The deterministic sort in
        // buildVillainAbilityHooks restores the locked total order
        // (cardId lexical, timing, lineIndex).
        for (const cardId of instanceExtIds) {
          entries.push({
            cardId,
            timing,
            lineIndex,
            keywords: [...extracted.keywords],
            effects: [...extracted.effects],
            unresolvedMarkers: [...extracted.unresolvedMarkers],
          });
        }
      }
    }
  }
}

/**
 * Collects hook entries for the selected henchman groups.
 *
 * Henchman ability text is group-level, so one hook is fanned out per virtual
 * copy ext_id `henchman-{groupSlug}-{NN}` (00-09).
 *
 * @param registry - Setup-time registry reader.
 * @param matchConfig - Validated match config providing henchmanGroupIds.
 * @param entries - Accumulator appended in place.
 */
function collectHenchmanHookEntries(
  registry: VillainAbilityRegistryReader,
  matchConfig: MatchSetupConfig,
  entries: HookEntry[],
): void {
  for (const henchmanGroupId of matchConfig.henchmanGroupIds) {
    const parsed = parseQualifiedId(henchmanGroupId);
    if (parsed === null) continue;
    const setData = registry.getSet(parsed.setAbbr);
    const abilities = findHenchmanGroupAbilities(setData, parsed.slug);
    if (abilities === null) continue;

    for (let lineIndex = 0; lineIndex < abilities.length; lineIndex++) {
      const abilityLine = abilities[lineIndex];
      if (typeof abilityLine !== 'string') continue;
      const timing = detectTiming(abilityLine);
      // why: henchman onAmbush hooks are intentionally NOT emitted in v1
      // (D-18507). buildCardKeywords never tags henchmen with the `ambush`
      // board keyword, so the reveal-site hasAmbush gate can never fire a
      // henchman onAmbush hook — emitting one would be unreachable and would
      // violate the gate-consistency invariant. Henchman Ambush effects are
      // deferred to a future WP that adds henchman keyword detection. The
      // same filter also defers henchman onEscape hooks (WP-186): no real
      // henchman card in the v1 data carries an `Escape:` line with an
      // `[effect:]` marker, so emitting henchman onEscape hooks would have
      // no consumer; the escape fire site still calls executeVillainAbilities
      // on a henchman escape, which safely no-ops via per-card hook lookup.
      if (timing !== 'onFight') continue;

      const extracted = extractEffects(abilityLine);
      // why: fan out one freshly-constructed hook per virtual copy ext_id so
      // copies never alias a shared keywords/effects array (D-13502).
      for (
        let copyIndex = 0;
        copyIndex < HENCHMAN_COPIES_PER_GROUP;
        copyIndex++
      ) {
        const paddedIndex = String(copyIndex).padStart(2, '0');
        const cardId =
          `henchman-${parsed.slug}-${paddedIndex}` as CardExtId;
        entries.push({
          cardId,
          timing,
          lineIndex,
          keywords: [...extracted.keywords],
          effects: [...extracted.effects],
          unresolvedMarkers: [...extracted.unresolvedMarkers],
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// buildVillainAbilityHooks — setup-time builder
// ---------------------------------------------------------------------------

/**
 * Builds the villain/henchman ability hook table from registry data at setup.
 *
 * Called during Game.setup() via buildInitialGameState. Reads villain per-card
 * and henchman group-level ability text for the selected match groups, emits
 * one hook per matched (card-instance × ability line), and returns the table
 * in a stable total order: (1) cardId lexical ascending, (2) timing per
 * VILLAIN_ABILITY_TIMINGS, (3) ability-line index.
 *
 * After setup, G.villainAbilityHooks is immutable — moves must never modify it.
 *
 * @param registry - Card registry for resolving ability text. Used at setup
 *   time only. Accepts unknown to support narrow test mocks; returns an empty
 *   array when the registry does not satisfy VillainAbilityRegistryReader.
 * @param matchConfig - Validated match setup config (villain + henchman group ids).
 * @returns The deterministic VillainAbilityHook table.
 */
export function buildVillainAbilityHooks(
  registry: unknown,
  matchConfig: MatchSetupConfig,
): VillainAbilityHook[] {
  if (!isVillainAbilityRegistryReader(registry)) {
    return [];
  }

  const entries: HookEntry[] = [];
  collectVillainHookEntries(registry, matchConfig, entries);
  collectHenchmanHookEntries(registry, matchConfig, entries);

  // why: stable total order for byte-identical hook tables across Node
  // versions and replay — cardId lexical, then timing per the canonical
  // array, then ability-line index. localeCompare is not used (locale-
  // sensitive); plain < / > gives stable codepoint ordering.
  entries.sort((left, right) => {
    if (left.cardId !== right.cardId) {
      return left.cardId < right.cardId ? -1 : 1;
    }
    const leftTimingRank = VILLAIN_ABILITY_TIMINGS.indexOf(left.timing);
    const rightTimingRank = VILLAIN_ABILITY_TIMINGS.indexOf(right.timing);
    if (leftTimingRank !== rightTimingRank) {
      return leftTimingRank - rightTimingRank;
    }
    return left.lineIndex - right.lineIndex;
  });

  const hooks: VillainAbilityHook[] = [];
  for (const entry of entries) {
    // why: keywords (legacy VillainEffectKeyword[]) and effects (descriptors)
    // are now DISTINCT arrays (D-24023 retyped effects to
    // VillainEffectDescriptor[]); both freshly built per entry — keywords as a
    // fresh string array, effects as freshly-spread descriptor objects — so no
    // two hooks (e.g., card copies sharing a source line) alias a mutable array
    // or descriptor object (D-13502).
    const hookKeywords: VillainEffectKeyword[] = [...entry.keywords];
    const hookEffects: VillainEffectDescriptor[] = [];
    for (const descriptor of entry.effects) {
      hookEffects.push({ ...descriptor });
    }
    const hook: VillainAbilityHook = {
      cardId: entry.cardId,
      timing: entry.timing,
      keywords: hookKeywords,
      effects: hookEffects,
    };
    // why: WP-257 / D-24034 — assign unresolvedMarkers only when non-empty
    // (exactOptionalPropertyTypes forbids `: x ?? undefined`), freshly copied so
    // no two hooks alias a shared array (D-13502). Absent means "no unresolved
    // marker" — the common case for a fully-recognized line.
    if (entry.unresolvedMarkers.length > 0) {
      hook.unresolvedMarkers = [...entry.unresolvedMarkers];
    }
    hooks.push(hook);
  }

  return hooks;
}
