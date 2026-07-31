/**
 * Villain & henchman ability hook contracts for the Legendary Arena game engine.
 *
 * Defines the data-only VillainAbilityHook descriptor, the canonical timing
 * and effect-keyword unions with their drift-detection arrays, and a pure
 * query helper. These contracts are built once at setup time (from registry
 * card text) and observed read-only by the Fight/Ambush executor.
 *
 * Mirrors the WP-021 HeroAbilityHook shape. This module imports no game
 * framework and no registry package — contracts only.
 */

import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// VillainAbilityTiming
// ---------------------------------------------------------------------------

/**
 * Closed canonical union of villain/henchman ability timing labels.
 *
 * `onAmbush` fires when a villain enters the City; `onFight` fires when a
 * villain or henchman is defeated; `onEscape` fires when a villain or
 * henchman is pushed off the City escape edge. Timing is read from the
 * `Ambush:` / `Fight:` / `Escape:` (or `Overrun:`) text prefix at setup
 * time — there is no NL inference.
 */
export type VillainAbilityTiming = 'onAmbush' | 'onFight' | 'onEscape';

// why: drift-detection array — must match the VillainAbilityTiming union
// exactly (the villainAbility.types.test.ts drift test asserts bidirectional
// parity). The three-entry canonical order is locked: 'onAmbush' (city
// entry, WP-185), 'onFight' (defeat, WP-185), 'onEscape' (escape edge,
// WP-186 / D-18601). 'onOverrun' is deliberately absent — `Overrun:` is a
// v1 synonym of `Escape:` and emits `onEscape` at parse time (D-18602).
// Adding a timing requires updating both this array and the union together,
// plus a DECISIONS.md entry.
/**
 * All villain ability timings in canonical order. Single source of truth.
 */
export const VILLAIN_ABILITY_TIMINGS: readonly VillainAbilityTiming[] = [
  'onAmbush',
  'onFight',
  'onEscape',
] as const;

// ---------------------------------------------------------------------------
// VillainEffectKeyword
// ---------------------------------------------------------------------------

/**
 * Closed canonical union of executable villain effect keywords (MVP v1).
 *
 * These are the only effect tokens the executor knows how to apply. Effect
 * keywords are sourced exclusively from `[effect:<VillainEffectKeyword>]`
 * markers on ability lines (authored by WP-187 / WP-188 / WP-190) — never
 * from free text or the `[keyword:]` / `[icon:]` namespaces.
 */
export type VillainEffectKeyword =
  | 'gainWoundEachPlayer'
  | 'gainWoundCurrentPlayer'
  | 'koHeroCurrentPlayer'
  | 'heroDeckTopToEscape'
  | 'captureBystander'
  | 'koHeroEachPlayer'
  | 'koHeroEachPlayerMag2'
  | 'captureHqHeroRightmost'
  | 'captureHqHeroHighestCost'
  | 'captureHqHeroLowestCost';

// why: drift-detection array — must match the VillainEffectKeyword union
// exactly. The ten-keyword vocabulary is the current locked MVP set. The
// first five (positions 1-5) carry forward unchanged from WP-185
// §Non-Negotiable Constraints — WP-187's executed markers and the overlay
// script's hardcoded copy depend on byte-identical ordering of positions
// 1-5, so insertions are appended at the end only.
// `koHeroEachPlayer` was added at position 6 by WP-189 to close the
// dominant blocked each-player-KO pattern (D-18901): each-player vocabulary
// is expanded incrementally, keyword-by-keyword, only where unconditional
// magnitude-1 patterns are present in the current dataset. Conditional and
// filtered each-player effects (cost-gated, class-gated, "or gains a
// Wound", source-filtered, compound clauses) remain out of scope for the MVP.
// `koHeroEachPlayerMag2` was added at position 7 by WP-202 to close the
// unconditional unfiltered magnitude-2 each-player-KO subset (D-20201):
// magnitude-N each-player-KO uses closed-union-per-magnitude keywords
// appended at position N (`koHeroEachPlayerMag2`, `koHeroEachPlayerMag3`
// if ever needed); parameterized markers (`[effect:koHeroEachPlayer:N]`)
// are rejected for v1 because the parser regex + executor dispatch
// contract + overlay validator + every drift test would all need to
// change for parameterization; the closed-union approach extends the
// WP-189 append-only-position-N pattern with no parser change, and the
// corpus shows only N=2 in v1 (zero N≥3 lines empirically). Any future
// addition requires a new WP plus a DECISIONS.md entry. The order here
// is the canonical emission order for multi-marker lines.
// `captureHqHeroRightmost`, `captureHqHeroHighestCost`,
// `captureHqHeroLowestCost` were added at positions 8, 9, 10 (0-indexed
// 7, 8, 9) by WP-214 to support the v1 HQ hero capture vocabulary
// (D-21401). Append-only; prior positions unchanged.
// why: D-24023 — this union + array are now FROZEN at 10 (the parser's
// legacy-translation input). No keyword is ever appended again; the
// closed-union-per-magnitude (D-20201) + incremental-expansion (D-18901)
// policies are retired in favor of VillainEffectDescriptor below.
/**
 * All villain effect keywords in canonical order. Single source of truth.
 */
export const VILLAIN_EFFECT_KEYWORDS: readonly VillainEffectKeyword[] = [
  'gainWoundEachPlayer',
  'gainWoundCurrentPlayer',
  'koHeroCurrentPlayer',
  'heroDeckTopToEscape',
  'captureBystander',
  'koHeroEachPlayer',
  'koHeroEachPlayerMag2',
  'captureHqHeroRightmost',
  'captureHqHeroHighestCost',
  'captureHqHeroLowestCost',
] as const;

// ---------------------------------------------------------------------------
// VillainEffectResult (WP-316 / D-24102)
// ---------------------------------------------------------------------------

/**
 * Per-effect outcome the villain-effect executor reports for one applied effect
 * (WP-316 / D-24102).
 *
 * `keyword` is the reverse-mapped legacy keyword, kept keyword-typed so the
 * fightResolved / ambushResolved `appliedEffects` surface stays byte-identical
 * to WP-200. `targets` names the card ext_ids the effect touched: the KO'd
 * hero(es), the captured HQ hero, or the escaped card. Wound / bystander effects
 * report `targets: []` (they narrate via the generic keyword label). `pending:
 * true` marks a parked interactive KO (a ≥2-eligible current-player KO) for which
 * no hero is KO'd yet at this fire site — the player picks later via
 * resolveKoHeroChoice, so no target name is known now.
 *
 * Additive over the WP-200 `VillainEffectKeyword[]` return: `results.map((r) =>
 * r.keyword)` reproduces the exact prior keyword array. The richer per-target
 * data feeds only the hash-excluded `G.messages` log lines (D-24081); the hashed
 * `G.notableEvents` surface (and the arena-client projection) never observe it.
 */
export interface VillainEffectResult {
  keyword: VillainEffectKeyword;
  targets: CardExtId[];
  pending?: boolean;
}

// ---------------------------------------------------------------------------
// VillainEffectPrimitive + VillainEffectDescriptor (WP-252 / D-24023)
// ---------------------------------------------------------------------------

// why: D-24023 — the parameterized effect vocabulary that retires the
// closed-union-per-magnitude (D-20201) and incremental-expansion-per-keyword
// (D-18901) policies. The 10 VILLAIN_EFFECT_KEYWORDS above are now FROZEN as the
// parser's legacy-translation INPUT only (no keyword is ever appended again);
// the executor and hooks speak VillainEffectDescriptor. A new target / magnitude
// / selector variant becomes a descriptor param (a data marker), not a new
// keyword + switch arm + drift test.

/**
 * Closed canonical union of villain effect primitives — the parameterized
 * vocabulary the executor dispatches on (WP-252). Five primitives collapse the
 * ten fragmented keywords along the target × magnitude × selector axes.
 */
// why: D-24267 — `scry-ko-own-deck` is the sixth primitive (append-only,
// position 6), the first self-deck scry mechanic in the villain/henchman
// vocabulary: look at min(2, deck.length) of the current player's own deck, KO
// exactly one via the deterministic worst-first selectScryKoTarget, and leave
// the other on top. It is a no-param primitive (no target/magnitude/selector),
// so it parses through parseParameterizedEffect's generic no-param branch and
// is NOT a legacy keyword (it has no LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR entry,
// so the executor self-narrates via pushLog — see villainEffects.execute.ts).
// why: D-24270 — `gain-attached-hero` is the seventh primitive (append-only,
// position 7). It is a deliberate NO-OP in the executor: the captured-hero
// return on defeat is performed generically at the fight site
// (`awardAttachedHeroes`, WP-431) BEFORE the executor runs, so this primitive
// adds no mutation. It exists solely to give the printed `Fight: Gain that Hero`
// line a recognized, reachable descriptor so the D-24266 hollow-effect detector
// classifies it applied instead of falsely flagging `unmarked-ability`. No-param
// (parses through the generic no-param branch); NOT a legacy keyword.
// why: D-24281 — `reveal-or-wound` is the eighth primitive (append-only,
// position 8), the first CONDITIONAL each-player effect: each player either
// reveals (from hand) a Hero whose trait matches the descriptor's
// `requireKind`/`requireValue` predicate, or — only when they hold no match —
// gains a Wound (Sabretooth + the core siblings). It carries its own descriptor
// fields (below) rather than reusing target/magnitude/selector, and — like
// `scry-ko-own-deck` — is NOT a legacy keyword (no
// LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR entry), so it reverse-maps to `undefined`
// and self-narrates via pushLog in the executor.
export type VillainEffectPrimitive =
  | 'ko-hero'
  | 'gain-wound'
  | 'capture-hq-hero'
  | 'hero-deck-top-to-escape'
  | 'capture-bystander'
  | 'scry-ko-own-deck'
  | 'gain-attached-hero'
  | 'reveal-or-wound';

// why: drift-detection array — must match VillainEffectPrimitive exactly
// (villainAbility.types.test.ts asserts bidirectional parity). Adding a
// primitive requires updating both this array and the union, plus a DECISIONS
// entry. `scry-ko-own-deck` appended at position 6 by WP-447 (D-24267);
// `gain-attached-hero` appended at position 7 by WP-450 (D-24270);
// `reveal-or-wound` appended at position 8 by WP-469 (D-24281).
/** All villain effect primitives in canonical order. Single source of truth. */
export const VILLAIN_EFFECT_PRIMITIVES: readonly VillainEffectPrimitive[] = [
  'ko-hero',
  'gain-wound',
  'capture-hq-hero',
  'hero-deck-top-to-escape',
  'capture-bystander',
  'scry-ko-own-deck',
  'gain-attached-hero',
  'reveal-or-wound',
] as const;

/**
 * Parameterized villain effect descriptor (WP-252 / D-24023). The optional
 * fields are primitive-specific:
 *   - `ko-hero`:         `target` 'current' | 'each'; `magnitude` (each only)
 *   - `gain-wound`:      `target` 'current' | 'each'
 *   - `capture-hq-hero`: `selector` 'rightmost' | 'highest-cost' | 'lowest-cost'
 *   - `hero-deck-top-to-escape`, `capture-bystander`, `scry-ko-own-deck`,
 *     `gain-attached-hero`: no params
 *   - `ko-hero` with `target: 'each'`: optional `zone` (D-24280) restricts the
 *     per-player KO to a single source zone (Juggernaut's "from their discard
 *     pile" / "from their hand"); absent means the discard→hand→inPlay fallback.
 *   - `reveal-or-wound`: `requireKind` + `requireValue` (D-24281) — the
 *     hero-trait predicate each player must satisfy from hand to avoid a Wound.
 */
export interface VillainEffectDescriptor {
  primitive: VillainEffectPrimitive;
  target?: 'current' | 'each';
  magnitude?: number;
  selector?: 'rightmost' | 'highest-cost' | 'lowest-cost';
  // why: D-24281 — the reveal-or-wound hero-trait predicate, present ONLY on
  // `{ primitive: 'reveal-or-wound' }` descriptors. `requireKind` reuses the
  // VillainDefeatRequirementKind shape ('team' | 'hero-class') and `requireValue`
  // is stored NORMALIZED to the `cardTraits` slug space (normalizeTraitSlug =
  // trim().toLowerCase(), matching buildCardTraits + the D-24076 setup) so the
  // handler's `===` trait comparison is casing/whitespace-safe. Deliberately NOT
  // part of `descriptorKey` below — reveal-or-wound is keyword-less (it has no
  // LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR entry), so it reverse-maps to `undefined`
  // regardless and self-narrates; adding these to the key would change nothing.
  requireKind?: 'team' | 'hero-class';
  requireValue?: string;
  // why: D-24280 — a source-zone restriction for the each-player `ko-hero` KO.
  // It is a resolver-targeting detail present ONLY on `{ primitive: 'ko-hero',
  // target: 'each' }` descriptors (Juggernaut Ambush = 'discard', Escape =
  // 'hand'); a narrower union than `KoHeroTarget.zone` (no 'inPlay' — no printed
  // "from their inPlay" text exists). Deliberately NOT part of `descriptorKey`
  // below, so a zone-bearing descriptor reverse-maps to the same legacy keyword
  // as its zone-less sibling and narrates identically (see `descriptorKey`).
  zone?: 'discard' | 'hand';
}

// why: D-24023 — the frozen legacy-keyword → descriptor translation table. The
// parser maps each legacy `[effect:<keyword>]` marker through this to a
// descriptor, so existing card data keeps working unchanged. Total over the 10
// frozen keywords; each maps to a distinct descriptor (injective — pinned by the
// reverse-map round-trip test).
/** Maps each legacy VillainEffectKeyword to its parameterized descriptor. */
export const LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR: Readonly<
  Record<VillainEffectKeyword, VillainEffectDescriptor>
> = {
  gainWoundEachPlayer: { primitive: 'gain-wound', target: 'each' },
  gainWoundCurrentPlayer: { primitive: 'gain-wound', target: 'current' },
  koHeroCurrentPlayer: { primitive: 'ko-hero', target: 'current' },
  heroDeckTopToEscape: { primitive: 'hero-deck-top-to-escape' },
  captureBystander: { primitive: 'capture-bystander' },
  koHeroEachPlayer: { primitive: 'ko-hero', target: 'each', magnitude: 1 },
  koHeroEachPlayerMag2: { primitive: 'ko-hero', target: 'each', magnitude: 2 },
  captureHqHeroRightmost: { primitive: 'capture-hq-hero', selector: 'rightmost' },
  captureHqHeroHighestCost: { primitive: 'capture-hq-hero', selector: 'highest-cost' },
  captureHqHeroLowestCost: { primitive: 'capture-hq-hero', selector: 'lowest-cost' },
};

/**
 * Canonical string key for a descriptor (primitive + its params). Stable field
 * order; absent params render empty. Used to build + query the inverse lookup.
 *
 * @param descriptor - A villain effect descriptor.
 * @returns A stable string key uniquely identifying the descriptor's shape.
 */
function descriptorKey(descriptor: VillainEffectDescriptor): string {
  // why: D-24280 — `zone` is DELIBERATELY excluded from the key. A zone-restricted
  // each-player KO (e.g. Juggernaut's `ko-hero:each:2:discard`) shares a key with
  // the zone-less `koHeroEachPlayerMag2` descriptor, so it reverse-maps to that
  // legacy keyword and narrates per-target KO'd-hero names for free (WP-316) —
  // the zone is a resolver-targeting detail invisible to the player-facing label.
  // Adding `zone` here would make the reverse-map return undefined, silencing the
  // KO's narration; do not add it.
  return [
    descriptor.primitive,
    descriptor.target ?? '',
    descriptor.magnitude ?? '',
    descriptor.selector ?? '',
  ].join('|');
}

// why: D-24023 — the inverse lookup (descriptor → its legacy keyword). The
// executor reverse-maps each dispatched descriptor back to a keyword for the
// applied-effects accumulator, so notableEvents / EFFECT_KEYWORD_LABELS / the
// replay state-hash / arena-client stay keyword-typed and byte-identical. Total
// + injective over the 10 legacy descriptors.
/** Inverse of LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR: descriptor key → keyword. */
export const DESCRIPTOR_TO_LEGACY_VILLAIN_KEYWORD: ReadonlyMap<string, VillainEffectKeyword> =
  new Map<string, VillainEffectKeyword>(
    VILLAIN_EFFECT_KEYWORDS.map((keyword) => [
      descriptorKey(LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[keyword]),
      keyword,
    ]),
  );

/**
 * Returns the legacy keyword for a dispatched descriptor, or undefined for a
 * descriptor that did not originate from a legacy marker (no card uses such a
 * marker in this WP — descriptor-keyed narrative labels are deferred to WP-253).
 *
 * @param descriptor - A dispatched VillainEffectDescriptor.
 * @returns The legacy keyword, or undefined.
 */
export function descriptorToLegacyKeyword(
  descriptor: VillainEffectDescriptor,
): VillainEffectKeyword | undefined {
  return DESCRIPTOR_TO_LEGACY_VILLAIN_KEYWORD.get(descriptorKey(descriptor));
}

// ---------------------------------------------------------------------------
// VillainDefeatRequirement (WP-292 / D-24076)
// ---------------------------------------------------------------------------

// why: D-24076 — a villain defeat-requirement is a fight PRECONDITION ("You
// can't defeat X unless you have a [class/team] Hero"), architecturally distinct
// from the onFight/onAmbush/onEscape consequence hooks above: it gates whether
// the fight may resolve at all, rather than firing an effect after defeat. It is
// sourced exclusively from the [require-to-defeat:<kind>:<value>] data marker
// (WP-292), never from free text.

/**
 * Closed canonical union of villain defeat-requirement kinds.
 *
 * 'team' requires a Hero of a given team affiliation; 'hero-class' requires a
 * Hero of a given class. The marker's `<kind>` token (`team` | `hc`) maps to
 * these at parse time.
 */
export type VillainDefeatRequirementKind = 'team' | 'hero-class';

// why: drift-detection array — must match VillainDefeatRequirementKind exactly
// (villainAbility.types.test.ts asserts bidirectional parity). Adding a kind
// requires updating both this array and the union together, plus a DECISIONS
// entry. The marker tokens `team` / `hc` map to these two kinds respectively.
/** All villain defeat-requirement kinds in canonical order. Single source of truth. */
export const VILLAIN_DEFEAT_REQUIREMENT_KINDS: readonly VillainDefeatRequirementKind[] = [
  'team',
  'hero-class',
] as const;

/**
 * The condition a player must satisfy to defeat a given villain.
 *
 * `value` is a normalized team slug (kind 'team', e.g. 'x-men') or hero-class
 * slug (kind 'hero-class', e.g. 'covert'). Built once at setup from the
 * [require-to-defeat:<kind>:<value>] marker and stored per villain-instance in
 * G.villainDefeatRequirements; immutable during gameplay.
 */
export interface VillainDefeatRequirement {
  kind: VillainDefeatRequirementKind;
  value: string;
}

// ---------------------------------------------------------------------------
// VillainAbilityHook — data-only descriptor
// ---------------------------------------------------------------------------

/**
 * Declarative, data-only representation of one villain/henchman ability line.
 *
 * Built at setup time from registry card text and stored in
 * G.villainAbilityHooks. Immutable during gameplay — moves must never modify
 * these hooks.
 *
 * `keywords` (the recognized legacy keywords) and `effects` (the parameterized
 * descriptors) are now **distinct arrays** built in parallel from the same
 * source tokens (WP-252 / D-24023). They were the same reference in v1; the
 * descriptor retype of `effects` makes them separate types. `keywords` stays
 * keyword-typed so any keyword-typed consumer (and the reverse-mapped
 * applied-effects narrative surface) is byte-identical.
 */
export interface VillainAbilityHook {
  /** The card-instance ext_id this hook fires for. */
  cardId: CardExtId;
  /** When the hook fires, derived from the ability-line text prefix. */
  timing: VillainAbilityTiming;
  /** Recognized legacy effect keywords on this line, in source order. */
  keywords: VillainEffectKeyword[];
  /** Executable effect descriptors applied left-to-right by the executor. */
  effects: VillainEffectDescriptor[];
  // why: WP-257 / D-24034 — raw `[effect:X]` marker tokens the parser SAW but
  // resolved to neither a legacy keyword NOR a parameterized descriptor. Hooks
  // otherwise carry parsed descriptors only, so an unresolved marker would be
  // indistinguishable from a line with no effect marker at all; surfacing the raw
  // token here is what makes `parse-unrecognized` detectable at the Fight/Ambush/
  // Escape fire sites. Additive optional: absent or empty means "no unresolved
  // marker".
  unresolvedMarkers?: string[];
}

// ---------------------------------------------------------------------------
// Query helper (pure, read-only)
// ---------------------------------------------------------------------------

/**
 * Returns the hooks for a specific card and timing.
 *
 * Filters by both the card-instance ext_id and the timing label so the
 * executor receives exactly the hooks that should fire at a given fire site.
 *
 * @param hooks - The full villain ability hook table (G.villainAbilityHooks).
 * @param cardId - The card-instance ext_id to match.
 * @param timing - The timing label to match.
 * @returns A freshly-constructed array of matching hooks (never the input).
 */
export function getVillainHooksForCard(
  hooks: readonly VillainAbilityHook[],
  cardId: CardExtId,
  timing: VillainAbilityTiming,
): VillainAbilityHook[] {
  const result: VillainAbilityHook[] = [];
  for (const hook of hooks) {
    if (hook.cardId === cardId && hook.timing === timing) {
      result.push(hook);
    }
  }
  return result;
}
