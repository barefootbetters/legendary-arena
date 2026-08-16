/**
 * schema.ts — matches the actual Legendary Arena R2 data format
 *
 * Data lives at:
 *   https://images.legendary-arena.com/registry-config.json      → set abbreviation list
 *   https://images.legendary-arena.com/metadata/sets.json        → set index
 *   https://images.legendary-arena.com/metadata/{abbr}.json      → full set card data
 *
 * Image URLs are embedded directly in each card object (imageUrl field).
 * All imageUrl values should point to the R2 domain (images.legendary-arena.com).
 *
 * Schema permissiveness decisions (grounded in real data observations):
 *
 *   HeroSchema.id              — any int, nullable, optional:
 *                                  3dtc has null on heroes 2-4
 *                                  shld heroes 4-11 have no id key at all
 *                                  msp1 uses -1 as a sentinel value
 *   HeroCardSchema.*           — most fields optional: anni cards have only slug+imageUrl
 *   HeroCardSchema.slot        — no upper bound: mgtg MCU Guardians has 7-card hero decks
 *   HeroCardSchema.displayName — optional: amwp omits this field entirely
 *   HeroCardSchema.cost        — string|number|optional: amwp Wasp has '2*', '3*' star-cost cards
 *   MastermindCardSchema.vAttack — nullable: msmc/dstr/bkpt main card has vAttack:null
 *   MastermindSchema.vp        — nullable: mgtg MCU Guardians masterminds have vp:null
 *   VillainCardSchema.vp       — nullable: wpnx villain cards have vp:null
 *   SchemeSchema.id            — nullable: transform card reverse sides have id:null
 */

import { z } from "zod";

// ── Registry set-abbreviation list (R2 /registry-config.json artifact) ────────
// Simple array of set abbreviation strings. R2 artifact only — not the viewer's
// public config. For the viewer's public/registry-config.json (object shape with
// metadataBaseUrl, eagerLoad, rulebookPdfUrl), see ViewerConfigSchema below.
export const RegistryConfigSchema = z.array(
  z.string().min(2).max(10)
);

// ── Set index (sets.json) ─────────────────────────────────────────────────────
// One entry per expansion. releaseDate is ISO date string.
export const SetIndexEntrySchema = z.object({
  id:          z.number().int().positive(),
  abbr:        z.string().min(1).max(10),
  pkgId:       z.number().int().positive(),
  slug:        z.string().min(1),
  name:        z.string().min(1),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type:        z.string().min(1),
});

// ── Hero class string enum ────────────────────────────────────────────────────
export const HeroClassSchema = z.enum([
  "covert", "instinct", "ranged", "strength", "tech",
]);

// ── Hero card (one slot inside a hero deck) ───────────────────────────────────
// Permissiveness decisions:
//   - Most fields are optional because some sets (e.g. anni) produce cards
//     with only slug + imageUrl due to incomplete source data conversion.
//   - slot has no upper bound: MCU Guardians (mgtg) has 7-card hero decks.
//   - displayName is optional: amwp omits it entirely.
//   - cost accepts string|number|optional: amwp Wasp has '2*', '3*' star-cost cards.
//   - attack and recruit are strings ("2", "2+", "0+") to preserve the '+'
//     modifier; null when not applicable for this card.
export const HeroCardSchema = z.object({
  name:        z.string().optional(),
  displayName: z.string().optional(),
  slug:        z.string(),
  rarity:      z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  rarityLabel: z.string().optional(),
  slot:        z.number().int().min(1).optional(),
  hc:          HeroClassSchema.optional(),
  cost:        z.union([z.number().int().min(0), z.string()]).optional(),
  attack:      z.string().nullable().optional(),
  recruit:     z.string().nullable().optional(),
  abilities:   z.array(z.string()).optional(),
  // why: per-card cardType override (Phase 2 of WP-086). Defaults to "hero"
  // in the viewer's flattenSet when absent. Currently set only on
  // S.H.I.E.L.D. Officer Specials in shld.json so they appear under the
  // SHIELD ribbon's Officer-Special sub-chip rather than being miscounted as
  // heroes. Optional + string-typed so the registry stays permissive at load
  // and any future cardType slugs require only a card-types.json change.
  cardType:    z.string().optional(),
});

// ── Physical card (deck-composition primitive — WP-138 Phase 1a) ──────────────
// why: D-13801 — `physicalCards[]` is the authoritative deck-composition
// surface for hero decks. A `PhysicalCard` represents a single physical
// artifact in the deck; its `sides[]` list names the per-face card slugs
// (one for solo cards, two for split-side cards like Falcon/Winter Soldier's
// Attune/Atone). Deck size for split heroes is the sum of `count` across
// `physicalCards[]`, NOT the sum of per-side `cardCounts`. The previous
// model conflated "card" with "card side" and silently produced inflated
// deck reservoirs for split heroes (Falcon/Winter Soldier 27 instead of 14).
// `cardCounts` becomes a derived view validated against physicalCards counts
// at registry load.
// why: D-13802 — `imageUrl` lives on the physicalCard, not on the card-side.
// The convert script computes it deterministically from sorted side slugs:
// solo cards `{abbr}-hr-{hero}-{slug}.webp`; split cards
// `{abbr}-hr-{hero}-{sortedA}-{sortedB}.webp` where sort is
// `Array.prototype.sort()` with NO comparator argument (UTF-16 code-unit
// ordering). See D-13802 for the full forbidden list of locale-aware
// comparison APIs and the rationale: locale-dependent collation would
// produce non-deterministic URLs across environments.
// why: D-13804 — physical-card identity is a registry concept, not an
// ext_id concept. Per-side ext_ids (D-13502 grammar
// `<setAbbr>/<heroSlug>/<cardSlug>` plus WP-137's `#N` copy suffix per
// D-13702) are unchanged. Replay or audit code MUST NOT assume that a
// per-side ext_id alone uniquely identifies a physical card instance —
// for split heroes, two ext_ids share one physicalCard.
// why: `sides` is typed `readonly string[]` (not a tuple union) with the
// `1 <= length <= 2` invariant enforced by the validator below. This
// keeps the ceiling raise (e.g., future triple-face cards in some games)
// a single Zod-check change rather than a TypeScript-type migration
// across every consumer. The `<= 2` ceiling is locked for this WP;
// raising it requires its own DECISIONS entry.
// why: D-14701 — physicalCard depicts hero plus a named non-hero companion
// character on the printed artwork (e.g., Drax/Irani Rael, Drax/Rhomann Dey
// in mgtg). The slug appears in the imageUrl between heroSlug and side
// slugs. Field is optional: most physicalCards have no companion (the
// printed art shows the hero alone or with only side slugs). The slug
// regex matches the slug grammar used elsewhere across the schema (lower-
// case alphanumerics and hyphens). PhysicalCardSchema is primary
// enforcement; heroImageUrl() has a defense-in-depth guard at the module
// boundary so direct callers also surface bad input loudly.
export const PhysicalCardSchema = z
  .object({
    id:            z.string().regex(/^p\d+$/, "physicalCard id must match ^p\\d+$ (e.g., p1, p2)"),
    count:         z.number().int().min(1),
    imageUrl:      z.string().url(),
    sides:         z.array(z.string().min(1))
                     .min(1, "physicalCard.sides[] must contain at least one side slug")
                     .max(2, "physicalCard.sides[] must contain at most two side slugs (D-13802 ceiling lock; raising requires a new DECISIONS entry)"),
    companionSlug: z
                     .string()
                     .min(1, "physicalCard.companionSlug must be a non-empty slug; check the patch entry or remove the field if no companion appears on the printed artwork")
                     .regex(/^[a-z0-9-]+$/, "physicalCard.companionSlug must match the slug regex ^[a-z0-9-]+$ (lowercase alphanumerics and hyphens only); check the patch entry for stray whitespace, uppercase, or punctuation")
                     .optional(),
  });

// ── Hero (a named hero deck with 3-7 cards) ───────────────────────────────────
// id permissiveness:
//   - 3dtc:  some heroes have null id
//   - shld:  heroes 4-11 have no id key at all (undefined, not null)
//   - msp1:  all heroes use -1 as a sentinel (no positive constraint)
//
// why: D-13701 (verbatim per EC-137 §Required `// why:` Comments):
// `cardCounts` keys are card display names from the upstream dataset; the engine resolves them against `cards[].name` and emits ext_ids using `cards[].slug`.
// The map is optional and nullable: present-with-value when the upstream
// patch supplies explicit copy counts (per-hero, per-card-name); null/absent
// when the engine falls back to the locked rarity → copy-count map (D-13501)
// keyed by `cards[].rarityLabel`. Values must be positive integers; 0,
// negative, non-integer, or non-number values are silently ignored and
// trigger the rarity-map fallback.
//
// why: D-13803 — `physicalCards[]` is required and non-empty whenever
// `cards[]` is non-empty. Solo heroes get one single-side physicalCard
// per `cards[]` entry (uniform model — no special-casing in consumer
// code: every hero has `physicalCards[]`). The empty-cards case
// (`cards: []`) is the only case `physicalCards: []` is allowed.
//
// superRefine enforces three cross-field invariants from WP-138:
//   - non-empty physicalCards when cards[] non-empty (D-13803)
//   - orphan-side rejection: every physicalCards[].sides[] entry resolves
//     to an existing cards[].slug under the same hero (WP-138 §8)
//   - duplicate-membership rejection: a side slug appears in at most one
//     physicalCard within the same hero (WP-138 §9)
//   - drift detection: when cardCounts is populated, for every side named
//     in cardCounts the sum of physicalCards[].count over physicalCards
//     whose sides[] includes that side must equal cardCounts[sideName]
//     (D-13801 — physicalCards is the authoritative deck-composition surface)
export const HeroSchema = z
  .object({
    id:            z.number().int().nullable().optional(),
    name:          z.string(),
    slug:          z.string(),
    team:          z.string(),
    cards:         z.array(HeroCardSchema),
    cardCounts:    z.record(z.string(), z.number().int().min(1)).nullable().optional(),
    physicalCards: z.array(PhysicalCardSchema),
  })
  .superRefine((hero, ctx) => {
    if (hero.cards.length > 0 && hero.physicalCards.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["physicalCards"],
        message:
          `Hero "${hero.slug}" has ${hero.cards.length} card-side(s) but no ` +
          `physicalCards[] entries. Every hero with non-empty cards[] must ` +
          `declare its deck composition via physicalCards[] (D-13803 uniform model).`,
      });
      return;
    }

    const cardSlugs = new Set<string>();
    for (const card of hero.cards) {
      cardSlugs.add(card.slug);
    }

    const sideOwner = new Map<string, string>();
    for (const physicalCard of hero.physicalCards) {
      for (const sideSlug of physicalCard.sides) {
        if (!cardSlugs.has(sideSlug)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["physicalCards"],
            message:
              `Hero "${hero.slug}" physicalCard "${physicalCard.id}" references ` +
              `unknown side slug "${sideSlug}". Every physicalCards[].sides[] ` +
              `entry must resolve to an existing cards[].slug under the same hero.`,
          });
        }
        const previousOwner = sideOwner.get(sideSlug);
        if (previousOwner !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["physicalCards"],
            message:
              `Hero "${hero.slug}" side slug "${sideSlug}" appears in physicalCards ` +
              `"${previousOwner}" and "${physicalCard.id}". A side slug must appear ` +
              `in at most one physicalCard within a given hero.`,
          });
        } else {
          sideOwner.set(sideSlug, physicalCard.id);
        }
      }
    }

    if (hero.cardCounts) {
      for (const [sideName, expectedCount] of Object.entries(hero.cardCounts)) {
        // why: cardCounts keys are display names (e.g., "Attune") per D-13701;
        // physicalCards.sides[] entries are slugs (e.g., "attune"). Resolve
        // the display name to its slug via cards[] before summing.
        const card = hero.cards.find((c) => c.name === sideName);
        if (!card) continue;
        const sideSlug = card.slug;
        let actualCount = 0;
        for (const physicalCard of hero.physicalCards) {
          if (physicalCard.sides.includes(sideSlug)) {
            actualCount += physicalCard.count;
          }
        }
        if (actualCount !== expectedCount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["physicalCards"],
            message:
              `Hero "${hero.slug}" cardCounts["${sideName}"] = ${expectedCount} but ` +
              `physicalCards summing for side slug "${sideSlug}" = ${actualCount}. ` +
              `physicalCards is the authoritative deck-composition surface ` +
              `(D-13801); cardCounts must equal the sum of physicalCards[].count ` +
              `over physicalCards whose sides[] includes the side slug.`,
          });
        }
      }
    }
  });

// ── Mastermind card (main card, epic variant, or tactic) ──────────────────────
// vAttack is nullable: some sets (msmc, dstr, bkpt) have the main mastermind
// card with vAttack:null — the printed attack value appears only on the epic
// or is determined dynamically by the card's rules text.
// vAttack may also be a string ("8+", "7") or number (8) depending on the set.
export const MastermindCardSchema = z.object({
  name:      z.string(),
  slug:      z.string(),
  tactic:    z.boolean().optional(),
  vAttack:   z.union([z.string(), z.number()]).nullable(),
  // why: D-24189 — optional + additive per-card VP. The group-level
  // MastermindSchema.vp gives the base mastermind's VP; some sets (co2e 2e)
  // print a distinct VP on the epic face and on tactic cards, so those cards
  // carry their own vp. Absent on most cards (base face inherits the group
  // vp); string-or-number to match VillainCardSchema.vp across sets.
  vp:        z.union([z.string(), z.number()]).nullable().optional(),
  imageUrl:  z.string().url(),
  abilities: z.array(z.string()),
});

// ── Mastermind (one entity with its set of cards) ─────────────────────────────
// vp is nullable: mgtg MCU Guardians masterminds have vp:null.
export const MastermindSchema = z.object({
  id:          z.number().int().positive(),
  name:        z.string(),
  slug:        z.string(),
  alwaysLeads: z.array(z.string()),
  vp:          z.number().int().nullable(),
  cards:       z.array(MastermindCardSchema),
});

// ── Villain card ──────────────────────────────────────────────────────────────
// vp is nullable: wpnx has villain cards with vp:null.
// vp and vAttack may be strings or numbers in source data across different sets.
export const VillainCardSchema = z.object({
  name:      z.string(),
  slug:      z.string(),
  vp:        z.union([z.string(), z.number()]).nullable(),
  vAttack:   z.union([z.string(), z.number()]).nullable(),
  imageUrl:  z.string().url(),
  abilities: z.array(z.string()),
  // why: optional + additive (D-16701). When absent the engine treats the
  // card as a single copy; the card converter normally writes a value
  // (default 2), so absence is a legacy/malformed-input fallback, not a
  // converter output path.
  copies:    z.number().int().min(1).optional(),
});

// ── Villain group (a named collection of villain cards) ───────────────────────
export const VillainGroupSchema = z.object({
  id:    z.number().int().positive(),
  name:  z.string(),
  slug:  z.string(),
  ledBy: z.array(z.string()),
  cards: z.array(VillainCardSchema),
});

// ── Scheme ────────────────────────────────────────────────────────────────────
// id is nullable: scheme-transform reverse-side cards have id:null.
export const SchemeSchema = z.object({
  id:       z.number().int().positive().nullable(),
  name:     z.string(),
  slug:     z.string(),
  imageUrl: z.string().url(),
  cards:    z.array(z.object({ abilities: z.array(z.string()) })),
  // why: optional + additive (D-16702). Both omitted on schemes that carry
  // no villain-deck setup metadata, so the engine falls back to its defaults
  // (8 scheme twists; numPlayers-derived bystanders).
  villainDeckTwistCount:     z.number().int().min(0).optional(),
  villainDeckBystanderCount: z.number().int().min(0).optional(),
});

// ── Full per-set file ({abbr}.json) ───────────────────────────────────────────
export const SetDataSchema = z.object({
  id:          z.number().int().positive(),
  abbr:        z.string(),
  exportName:  z.string(),
  heroes:      z.array(HeroSchema),
  masterminds: z.array(MastermindSchema),
  villains:    z.array(VillainGroupSchema),
  henchmen:    z.array(z.unknown()),
  schemes:     z.array(SchemeSchema),
  bystanders:  z.array(z.unknown()),
  wounds:      z.array(z.unknown()),
  other:       z.array(z.unknown()),
});

// ── Search query (for registry query() API) ───────────────────────────────────
export const CardQuerySchema = z.object({
  setAbbr:      z.string().optional(),
  heroClass:    HeroClassSchema.optional(),
  team:         z.string().optional(),
  nameContains: z.string().optional(),
  // why: cardType widened from the 4-value z.enum to z.string() because
  // data/metadata/card-types.json (consumed by the registry-viewer ribbon
  // generator under WP-086) is now the authoritative taxonomy. The registry
  // package stays permissive at load time; the viewer enforces the taxonomy
  // at fetch time via CardTypesIndexSchema.safeParse.
  cardType:     z.string().optional(),
  rarity:       z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

// ── Keyword & Rule glossary entries (keywords-full.json, rules-full.json) ─────
// why: Keyword and Rule glossary entries are intentionally separate
// schemas. The description/summary distinction is semantic (one
// defines an ability, the other states a rule). Duplicating the
// shared fields keeps semantics explicit at the registry boundary
// and avoids a future contributor extracting a base shape that
// blurs that distinction.
export const KeywordGlossaryEntrySchema = z.object({
  key:         z.string().min(1),
  label:       z.string().min(1),
  description: z.string().min(1),
  pdfPage:     z.number().int().min(1).optional(),
}).strict();

export const RuleGlossaryEntrySchema = z.object({
  key:     z.string().min(1),
  label:   z.string().min(1),
  summary: z.string().min(1),
  pdfPage: z.number().int().min(1).optional(),
}).strict();

export const KeywordGlossarySchema = z.array(KeywordGlossaryEntrySchema);
export const RuleGlossarySchema    = z.array(RuleGlossaryEntrySchema);

export type KeywordGlossaryEntry = z.infer<typeof KeywordGlossaryEntrySchema>;
export type RuleGlossaryEntry    = z.infer<typeof RuleGlossaryEntrySchema>;

// ── Card-types taxonomy (card-types.json) ─────────────────────────────────────
// why: card-types.json drives the registry-viewer ribbon as the authoritative
// taxonomy under WP-086. .strict() rejects unknown fields so any future
// pipeline drift surfaces as an explicit Zod error rather than silent data
// loss. parentType is nullable because top-level entries have no parent;
// non-null parentType references are validated at fetch time
// (cardTypesClient.ts) against existing slugs to detect orphan entries — that
// relational invariant is not expressible in Zod.
export const CardTypeEntrySchema = z.object({
  slug:       z.string().min(1),
  label:      z.string().min(1),
  emoji:      z.string().optional(),
  order:      z.number().int().nonnegative(),
  parentType: z.string().nullable(),
}).strict();

export const CardTypesIndexSchema = z.array(CardTypeEntrySchema);

export type CardTypeEntry  = z.infer<typeof CardTypeEntrySchema>;
export type CardTypesIndex = z.infer<typeof CardTypesIndexSchema>;

// ── Card-abilities effect-tag taxonomy (card-abilities.json) ────────────
// why: WP-125 second metadata-driven taxonomy under WP-086 precedent
// (card-types.json was the first). .strict() rejects unknown fields so any
// future pipeline drift surfaces as an explicit Zod error rather than silent
// data loss. The matcher.type field is locked to a single z.literal("regex")
// so adding a future matcher type (substring / token-presence / structured)
// is an explicit schema decision in a follow-up WP rather than a silent
// extension. D-12501 records the lock.
export const CardAbilityMatcherSchema = z.object({
  type:    z.literal("regex"),
  pattern: z.string().min(1),
  flags:   z.string().optional(),
}).strict();

export const CardAbilityEntrySchema = z.object({
  slug:     z.string().min(1).regex(/^[a-z][a-z0-9-]*$/),
  label:    z.string().min(1),
  emoji:    z.string().optional(),
  order:    z.number().int().nonnegative(),
  matchers: z.array(CardAbilityMatcherSchema).min(1),
}).strict();

export const CardAbilitiesIndexSchema = z.array(CardAbilityEntrySchema);

export type CardAbilityMatcher = z.infer<typeof CardAbilityMatcherSchema>;
export type CardAbilityEntry   = z.infer<typeof CardAbilityEntrySchema>;
export type CardAbilitiesIndex = z.infer<typeof CardAbilitiesIndexSchema>;

// ── Scheme twist pattern taxonomy (scheme-twist-patterns.json + assignments) ──
// why: WP-183 — static taxonomy for the 8 mechanical twist patterns observed
// across 191 schemes. z.enum on the slug field catches typos and invalid slugs
// at parse time in both the patterns index and the assignments map.
export const TWIST_PATTERN_SLUGS = [
  "reveal-or-punish",
  "stack-and-escalate",
  "chained-reveals",
  "bystander-capture",
  "hero-ko",
  "wound-distribution",
  "hand-disruption",
  "board-manipulation",
] as const;

export const TwistPatternSlugSchema = z.enum(TWIST_PATTERN_SLUGS);

export const SchemeTwistPatternSchema = z.object({
  slug:        TwistPatternSlugSchema,
  label:       z.string().min(1),
  emoji:       z.string().min(1),
  order:       z.number().int().nonnegative(),
  description: z.string().min(1),
});

export const SchemeTwistPatternsIndexSchema = z.array(SchemeTwistPatternSchema);

export const SchemeTwistAssignmentsSchema = z.record(
  z.string(),
  TwistPatternSlugSchema,
);

export type TwistPatternSlug       = z.infer<typeof TwistPatternSlugSchema>;
export type SchemeTwistPattern     = z.infer<typeof SchemeTwistPatternSchema>;
export type SchemeTwistPatternsIndex = z.infer<typeof SchemeTwistPatternsIndexSchema>;
export type SchemeTwistAssignments = z.infer<typeof SchemeTwistAssignmentsSchema>;

// ── Card mechanical pattern taxonomies (WP-184) ───────────────────────────────
// why: WP-184 — four sibling taxonomies for hero / villain / henchman /
// mastermind mechanical roles. Each taxonomy has its own per-slug z.enum so
// assignment files reject cross-taxonomy leakage (a hero slug must not parse
// as a villain assignment value, etc.) at parse time. The shared pattern
// definition shape mirrors WP-183's SchemeTwistPatternSchema but the slug
// field is a plain z.string() here — the per-taxonomy enums constrain values
// inside the assignment maps where leakage is most likely.
export const HERO_PATTERN_SLUGS = [
  "draw-engine",
  "attack-boost",
  "recruit-boost",
  "class-synergy",
  "team-synergy",
  "deck-thin",
  "reveal-manipulate",
  "wound-interact",
  "bystander-interact",
  "keyword-carrier",
] as const;

export const VILLAIN_PATTERN_SLUGS = [
  "fight-draw",
  "fight-wound-others",
  "fight-ko-hero",
  "fight-rescue",
  "fight-gain-hero",
  "fight-recruit",
  "ambush-capture",
  "ambush-cascade",
] as const;

export const HENCHMAN_PATTERN_SLUGS = [
  "hench-ko-hero",
  "hench-recruit",
  "hench-draw",
  "hench-deck-filter",
  "hench-gain-as-hero",
  "hench-conditional",
] as const;

export const MASTERMIND_PATTERN_SLUGS = [
  "strike-wound",
  "strike-discard",
  "strike-ko-hero",
  "strike-capture",
  "strike-spawn",
  "strike-deck-disrupt",
  "strike-escalate",
  "strike-board",
] as const;

export const HeroPatternSlugSchema       = z.enum(HERO_PATTERN_SLUGS);
export const VillainPatternSlugSchema    = z.enum(VILLAIN_PATTERN_SLUGS);
export const HenchmanPatternSlugSchema   = z.enum(HENCHMAN_PATTERN_SLUGS);
export const MastermindPatternSlugSchema = z.enum(MASTERMIND_PATTERN_SLUGS);

// Shared pattern definition shape — all four taxonomies validate against this.
export const CardPatternSchema = z.object({
  slug:        z.string().min(1),
  label:       z.string().min(1),
  emoji:       z.string().min(1),
  order:       z.number().int().nonnegative(),
  description: z.string().min(1),
});

export const CardPatternsIndexSchema = z.array(CardPatternSchema);

// Per-taxonomy assignment record schemas. z.record value type is the taxonomy's
// own slug enum so cross-taxonomy leakage rejects at parse time.
export const HeroPatternAssignmentsSchema       = z.record(z.string(), HeroPatternSlugSchema);
export const VillainPatternAssignmentsSchema    = z.record(z.string(), VillainPatternSlugSchema);
export const HenchmanPatternAssignmentsSchema   = z.record(z.string(), HenchmanPatternSlugSchema);
export const MastermindPatternAssignmentsSchema = z.record(z.string(), MastermindPatternSlugSchema);

export type HeroPatternSlug       = z.infer<typeof HeroPatternSlugSchema>;
export type VillainPatternSlug    = z.infer<typeof VillainPatternSlugSchema>;
export type HenchmanPatternSlug   = z.infer<typeof HenchmanPatternSlugSchema>;
export type MastermindPatternSlug = z.infer<typeof MastermindPatternSlugSchema>;
export type CardPattern           = z.infer<typeof CardPatternSchema>;
export type CardPatternsIndex     = z.infer<typeof CardPatternsIndexSchema>;
export type HeroPatternAssignments       = z.infer<typeof HeroPatternAssignmentsSchema>;
export type VillainPatternAssignments    = z.infer<typeof VillainPatternAssignmentsSchema>;
export type HenchmanPatternAssignments   = z.infer<typeof HenchmanPatternAssignmentsSchema>;
export type MastermindPatternAssignments = z.infer<typeof MastermindPatternAssignmentsSchema>;

// why: CardType = string is the named alias replacing the prior 4-value
// z.enum(["hero","mastermind","villain","scheme"]) at CardQuerySchema. The
// registry package stays permissive at load (any string accepted); the viewer
// enforces the 13-entry taxonomy at fetch time via
// CardTypesIndexSchema.safeParse. Phase 2 (separate WP) will populate per-card
// cardType slugs upstream via modern-master-strike — having a permissive load
// path now means Phase 2 won't require a registry-side schema change.
export type CardType = string;

// ── Registry-viewer public config (apps/registry-viewer/public/registry-config.json) ──
// why: distinct from RegistryConfigSchema (R2 set-abbreviation artifact).
// Object shape consumed by the viewer at boot to locate metadata and optional
// rulebook PDF. rulebookPdfUrl is optional so WP-082 can add it before, after,
// or alongside EC-108 without schema churn. rulesPageUrl (WP-039) is the
// optional www /rules HTML deep-link target; the GlossaryPanel shows it
// alongside the PDF link. It must be listed here because the schema is
// .strict() — an unrecognized key hard-fails the viewer boot.
export const ViewerConfigSchema = z
  .object({
    metadataBaseUrl: z.string().url(),
    eagerLoad: z.array(z.string().min(2).max(10)).optional(),
    rulebookPdfUrl: z.string().url().optional(),
    rulesPageUrl: z.string().url().optional(),
  })
  .strict();

export type ViewerConfig = z.infer<typeof ViewerConfigSchema>;

// ── Themes directory index (R2 /themes/index.json) ────────────────────────────
// why: root manifest of theme filenames; if malformed, the Themes subsystem
// is considered unavailable and must fail fast. Individual theme failures are
// non-fatal (warn + skip) because one bad theme must not hide the rest.
export const ThemeIndexSchema = z.array(z.string().regex(/\.json$/, "theme index entries must end in .json"));

export type ThemeIndex = z.infer<typeof ThemeIndexSchema>;

// ── Hero mechanic metadata feed (card-mechanics.json — WP-269 / D-24046) ──────
// why: WP-269 — the published, viewer-safe hero-mechanic index. It is generated
// from the committed hero ledger (docs/ai/coverage/hero-mechanic-ledger.json) by
// scripts/build-card-mechanics-metadata.mjs and fetched from R2 by the
// registry-viewer (the consumer half is WP-270). This schema stays data-only
// (zod + the parsed object); the engine-dependent source classification lives in
// the repo-root transform script, never here — so packages/registry never imports
// the engine package and the Layer Boundary holds. D-24046 locks the published
// contract shape, the closed source union, the hidden-by-default policy, and the
// bidirectional mechanic/card join the viewer depends on.
//
// The slug regex matches the transform's normalized output: lowercase
// alphanumeric segments separated by single hyphens, with no leading, trailing,
// or doubled hyphen. The `(unmarked)` sentinel from the ledger is normalized to
// the bare slug `unmarked`, so the feed never carries the raw parenthesized form.
export const CARD_MECHANIC_SOURCES = [
  "keyword",
  "composition-marker",
  "free-text",
] as const;

export const CardMechanicSourceSchema = z.enum(CARD_MECHANIC_SOURCES);

export const CardMechanicEntrySchema = z
  .object({
    slug:      z.string().min(1).regex(
                 /^[a-z0-9]+(-[a-z0-9]+)*$/,
                 "A mechanic slug must be lowercase alphanumeric segments joined by single hyphens (no leading, trailing, or doubled hyphen); check the transform's slug normalization.",
               ),
    label:     z.string().min(1),
    scope:     z.literal("hero"),
    source:    CardMechanicSourceSchema,
    cardCount: z.number().int().nonnegative(),
    cardIds:   z.array(z.string().min(1)),
    hidden:    z.boolean(),
  })
  .strict();

export const CardMechanicsCardEntrySchema = z
  .object({
    mechanics: z.array(z.string().min(1)),
  })
  .strict();

// superRefine enforces the cross-field invariants the field-level types cannot
// express, mirroring the WP-138 HeroSchema precedent above:
//   - mechanic slugs are unique across mechanics[]
//   - no duplicate cardIds within a single mechanic
//   - cardCount equals the number of cardIds
//   - mechanic -> card join: every mechanics[].cardIds[] entry resolves to a
//     cards{} entry whose mechanics include that slug
//   - card -> mechanic join: every cards[extId].mechanics[] slug is declared in
//     mechanics[]
// These are pure structural checks over the parsed object; they require no
// engine data, so the schema stays data-only.
export const CardMechanicsIndexSchema = z
  .object({
    version:     z.literal(1),
    scope:       z.literal("hero"),
    generatedAt: z.string().min(1),
    mechanics:   z.array(CardMechanicEntrySchema),
    cards:       z.record(z.string().min(1), CardMechanicsCardEntrySchema),
  })
  .strict()
  .superRefine((index, ctx) => {
    const declaredSlugs = new Set<string>();
    for (const mechanic of index.mechanics) {
      if (declaredSlugs.has(mechanic.slug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mechanics"],
          message:
            `Mechanic slug "${mechanic.slug}" appears more than once in mechanics[]. ` +
            `Each mechanic slug must be unique; merge the duplicate entries in the transform.`,
        });
      } else {
        declaredSlugs.add(mechanic.slug);
      }
    }

    for (const mechanic of index.mechanics) {
      const uniqueCardIds = new Set<string>();
      for (const cardId of mechanic.cardIds) {
        if (uniqueCardIds.has(cardId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["mechanics"],
            message:
              `Mechanic "${mechanic.slug}" lists the card id "${cardId}" more than once. ` +
              `Each mechanic's cardIds[] must be de-duplicated in the transform.`,
          });
        } else {
          uniqueCardIds.add(cardId);
        }
      }
      if (mechanic.cardCount !== mechanic.cardIds.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["mechanics"],
          message:
            `Mechanic "${mechanic.slug}" has cardCount ${mechanic.cardCount} but ${mechanic.cardIds.length} ` +
            `cardIds. cardCount must equal cardIds.length; recompute it from the de-duplicated card set.`,
        });
      }
    }

    for (const mechanic of index.mechanics) {
      for (const cardId of mechanic.cardIds) {
        const cardEntry = index.cards[cardId];
        if (!cardEntry || !cardEntry.mechanics.includes(mechanic.slug)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["mechanics"],
            message:
              `Mechanic "${mechanic.slug}" references card "${cardId}" but cards["${cardId}"] does not list ` +
              `that slug. Every mechanics[].cardIds[] entry must appear in cards{} with the mechanic's slug.`,
          });
        }
      }
    }

    for (const [extId, cardEntry] of Object.entries(index.cards)) {
      for (const slug of cardEntry.mechanics) {
        if (!declaredSlugs.has(slug)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cards"],
            message:
              `Card "${extId}" lists mechanic "${slug}" but no mechanics[] entry declares that slug. ` +
              `Every cards[extId].mechanics[] slug must exist in mechanics[].`,
          });
        }
      }
    }
  });

export type CardMechanicSource     = z.infer<typeof CardMechanicSourceSchema>;
export type CardMechanicEntry      = z.infer<typeof CardMechanicEntrySchema>;
export type CardMechanicsCardEntry = z.infer<typeof CardMechanicsCardEntrySchema>;
export type CardMechanicsIndex     = z.infer<typeof CardMechanicsIndexSchema>;

// ── Effect implementation index (effect-implementation-index.json — WP-484 / D-24289) ──
// why: WP-484 — the published, dual-scope effect-implementation index. It is
// generated from the TWO committed mechanic ledgers
// (docs/ai/coverage/hero-mechanic-ledger.json + villain-mechanic-ledger.json) by
// scripts/build-effect-implementation-index.mjs, mirroring the WP-269 / D-24046
// card-mechanics.json feed pattern. It is the data backbone the future
// /debug/effects viewer reads: for every card × mechanic it surfaces the ledger's
// status + handler + wp + decision so "did card X's effect fire, and which handler
// ran?" has a single answer surface. This schema stays data-only (zod + the parsed
// object); it imports no engine-package module, so packages/registry never reaches
// the engine and the Layer Boundary holds. D-24289 locks the published contract shape,
// the closed scope/status unions, the verbatim (never-fabricated) handler/wp/decision
// pass-through, and the bidirectional entry/card join.
//
// Unlike CardMechanicsIndexSchema, the entry `mechanic` is the ledger token
// VERBATIM (not a normalized slug) — the villain `(unmarked)` sentinel appears as
// the literal parenthesized string — so there is no slug regex here; token
// normalization is card-mechanics.json's concern, not this index's.
// why: WP-507 / D-24313 — "mastermind" is a closed-enum widening (a registry
// contract change) so mastermind TACTIC cards can appear in the index alongside
// hero + villain scopes. It stays in lockstep with EffectImplementationSummarySchema.byScope,
// the superRefine scopeTally accumulator, and every dashboard consumer (scopeLabel,
// the filter chip list, the badge CSS) — all widened together.
export const EFFECT_INDEX_ENTRY_SCOPES = [
  "hero",
  "villain",
  "mastermind",
] as const;

export const EFFECT_INDEX_STATUSES = [
  "executable",
  "deferred",
  "condition",
  "unsupported",
  "unmarked",
  // why: WP-548 / D-24357 — `subsystem` is a closed-enum widening (a registry
  // contract change) for a card implemented by a subsystem OTHER than the
  // [effect:X] villain-ability pipeline (setup:require-to-defeat, scoring:dynamic-vp):
  // done, not a TODO. It stays in lockstep with EffectImplementationSummarySchema.byStatus,
  // WP-559 / D-24368 extended it to the HERO ledger too, so this enum now spans BOTH
  // committed ledgers; villain entries are card-keyed, hero entries (card x mechanic).
  // the superRefine statusTally accumulator, and every dashboard consumer (statusLabel,
  // the filter chip list, the badge CSS) — all widened together.
  "subsystem",
] as const;

export const EffectIndexEntryScopeSchema = z.enum(EFFECT_INDEX_ENTRY_SCOPES);
export const EffectIndexStatusSchema     = z.enum(EFFECT_INDEX_STATUSES);

// why: WP-491 / D-24297 — a hero effect can be printed on any of a hero's ~4 card
// designs; `EffectDesign` identifies one carrying design (its slug + display name),
// read verbatim from the registry card. Both fields are required and non-empty, and
// the object is `.strict()` so a malformed design element is rejected at parse time.
export const EffectDesignSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

export const EffectImplementationEntrySchema = z
  .object({
    extId:    z.string().min(1),
    name:     z.string().min(1),
    set:      z.string().min(1),
    scope:    EffectIndexEntryScopeSchema,
    mechanic: z.string().min(1),
    status:   EffectIndexStatusSchema,
    // why: handler/wp/decision are verbatim ledger pass-throughs — the empty
    // string "" where the ledger row carries no value (an unsupported/unmarked
    // row where no handler ran), never null and never a fabricated path. So these
    // accept an empty string (no .min(1)); the honesty constraint is enforced by
    // the transform passing the ledger value through unchanged, not by the schema
    // demanding a value.
    handler:  z.string(),
    wp:       z.string(),
    decision: z.string(),
    // why: WP-491 / D-24297 — the card design(s) whose printed ability carries this
    // mechanic. Optional and populated for HERO entries only (villain entries and hero
    // `(unmarked)` entries omit it — a villain's extId already names the card, and an
    // unmarked row has no carrying design). `.min(1)` when present: the transform never
    // emits an empty `designs`, it omits the key instead.
    designs:  z.array(EffectDesignSchema).min(1).optional(),
  })
  .strict();

export const EffectImplementationCardEntrySchema = z
  .object({
    scope:     EffectIndexEntryScopeSchema,
    mechanics: z.array(z.string().min(1)),
  })
  .strict();

export const EffectImplementationSummarySchema = z
  .object({
    totalEntries: z.number().int().nonnegative(),
    byScope: z
      .object({
        hero:       z.number().int().nonnegative(),
        villain:    z.number().int().nonnegative(),
        mastermind: z.number().int().nonnegative(),
      })
      .strict(),
    // why: byStatus emits all six status keys in the fixed union order, a
    // zero-count status included as 0, so the published shape stays stable across
    // card-data changes (a status appearing or vanishing never adds or drops a key).
    byStatus: z
      .object({
        executable:  z.number().int().nonnegative(),
        deferred:    z.number().int().nonnegative(),
        condition:   z.number().int().nonnegative(),
        unsupported: z.number().int().nonnegative(),
        unmarked:    z.number().int().nonnegative(),
        // why: WP-548 / D-24357 — the villain ledger's "covered by a non-[effect:X]
        // subsystem" status; seeded here so the strict byStatus shape carries the key.
        subsystem:   z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

// superRefine enforces the cross-field invariants the field-level types cannot
// express, mirroring the CardMechanicsIndexSchema precedent above:
//   - summary.totalEntries equals entries.length
//   - summary.byScope / byStatus counts equal the actual entry tallies
//   - entry -> card join: every entries[] (extId, mechanic) appears in
//     cards[extId].mechanics, with cards[extId].scope matching the entry's scope
//   - card -> entry join: every cards[extId].mechanics[] slug has a matching
//     entries[] row for that (extId, mechanic)
// These are pure structural checks over the parsed object; they require no engine
// data, so the schema stays data-only.
export const EffectImplementationIndexSchema = z
  .object({
    version:     z.literal(1),
    scope:       z.literal("all"),
    generatedAt: z.string().min(1),
    summary:     EffectImplementationSummarySchema,
    entries:     z.array(EffectImplementationEntrySchema),
    cards:       z.record(z.string().min(1), EffectImplementationCardEntrySchema),
  })
  .strict()
  .superRefine((index, ctx) => {
    if (index.summary.totalEntries !== index.entries.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["summary", "totalEntries"],
        message:
          `summary.totalEntries is ${index.summary.totalEntries} but entries[] has ${index.entries.length} ` +
          `rows. totalEntries must equal entries.length; recompute the summary from the final entries.`,
      });
    }

    // why: the comparison loop below iterates EFFECT_INDEX_ENTRY_SCOPES, but this
    // accumulator is a hardcoded literal — the WP-507 "mastermind" scope needs its
    // own `mastermind: 0` seed here, else a mastermind entry does
    // `scopeTally['mastermind'] += 1` on undefined → NaN and every regenerated index fails.
    const scopeTally = { hero: 0, villain: 0, mastermind: 0 };
    // why: WP-548 / D-24357 — the statusTally accumulator is a hardcoded literal
    // (like scopeTally above); the new `subsystem` status needs its own `subsystem: 0`
    // seed here, else a subsystem entry does `statusTally['subsystem'] += 1` on
    // undefined → NaN and every regenerated index fails the byStatus comparison.
    const statusTally = { executable: 0, deferred: 0, condition: 0, unsupported: 0, unmarked: 0, subsystem: 0 };
    for (const entry of index.entries) {
      scopeTally[entry.scope] += 1;
      statusTally[entry.status] += 1;
    }
    for (const scopeName of EFFECT_INDEX_ENTRY_SCOPES) {
      if (index.summary.byScope[scopeName] !== scopeTally[scopeName]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["summary", "byScope", scopeName],
          message:
            `summary.byScope.${scopeName} is ${index.summary.byScope[scopeName]} but ${scopeTally[scopeName]} ` +
            `entries carry scope "${scopeName}". Each byScope count must equal the actual entry tally.`,
        });
      }
    }
    for (const statusName of EFFECT_INDEX_STATUSES) {
      if (index.summary.byStatus[statusName] !== statusTally[statusName]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["summary", "byStatus", statusName],
          message:
            `summary.byStatus.${statusName} is ${index.summary.byStatus[statusName]} but ${statusTally[statusName]} ` +
            `entries carry status "${statusName}". Each byStatus count must equal the actual entry tally.`,
        });
      }
    }

    for (const entry of index.entries) {
      const cardEntry = index.cards[entry.extId];
      if (!cardEntry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries"],
          message:
            `Entry "${entry.extId}" (mechanic "${entry.mechanic}") has no cards["${entry.extId}"] record. ` +
            `Every entries[] extId must appear in cards{}.`,
        });
        continue;
      }
      if (cardEntry.scope !== entry.scope) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cards", entry.extId, "scope"],
          message:
            `cards["${entry.extId}"].scope is "${cardEntry.scope}" but its entry for mechanic "${entry.mechanic}" ` +
            `carries scope "${entry.scope}". A card's scope must match the scope of its entries.`,
        });
      }
      if (!cardEntry.mechanics.includes(entry.mechanic)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries"],
          message:
            `Entry "${entry.extId}" lists mechanic "${entry.mechanic}" but cards["${entry.extId}"].mechanics ` +
            `does not include it. Every entries[] (extId, mechanic) must appear in cards[extId].mechanics.`,
        });
      }
    }

    const entryPairs = new Set<string>();
    for (const entry of index.entries) {
      entryPairs.add(`${entry.extId} ${entry.mechanic}`);
    }
    for (const [extId, cardEntry] of Object.entries(index.cards)) {
      for (const mechanic of cardEntry.mechanics) {
        if (!entryPairs.has(`${extId} ${mechanic}`)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cards", extId, "mechanics"],
            message:
              `Card "${extId}" lists mechanic "${mechanic}" but no entries[] row has that (extId, mechanic) pair. ` +
              `Every cards[extId].mechanics[] entry must have a matching entries[] row.`,
          });
        }
      }
    }
  });

export type EffectIndexEntryScope        = z.infer<typeof EffectIndexEntryScopeSchema>;
export type EffectIndexStatus            = z.infer<typeof EffectIndexStatusSchema>;
export type EffectDesign                 = z.infer<typeof EffectDesignSchema>;
export type EffectImplementationEntry    = z.infer<typeof EffectImplementationEntrySchema>;
export type EffectImplementationCardEntry = z.infer<typeof EffectImplementationCardEntrySchema>;
export type EffectImplementationSummary  = z.infer<typeof EffectImplementationSummarySchema>;
export type EffectImplementationIndex    = z.infer<typeof EffectImplementationIndexSchema>;
