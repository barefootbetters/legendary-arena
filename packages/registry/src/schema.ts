/**
 * schema.ts — matches the actual Legendary Arena R2 data format
 *
 * Data lives at:
 *   https://images.barefootbetters.com/registry-config.json      → set abbreviation list
 *   https://images.barefootbetters.com/metadata/sets.json        → set index
 *   https://images.barefootbetters.com/metadata/{abbr}.json      → full set card data
 *
 * Image URLs are embedded directly in each card object (imageUrl field).
 * All imageUrl values should point to the R2 domain (images.barefootbetters.com).
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

// ── Registry config (registry-config.json at R2 root) ─────────────────────────
// Simple array of set abbreviation strings. Not a source file — R2 artifact only.
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
  imageUrl:    z.string().url(),
  abilities:   z.array(z.string()).optional(),
});

// ── Hero (a named hero deck with 3-7 cards) ───────────────────────────────────
// id permissiveness:
//   - 3dtc:  some heroes have null id
//   - shld:  heroes 4-11 have no id key at all (undefined, not null)
//   - msp1:  all heroes use -1 as a sentinel (no positive constraint)
export const HeroSchema = z.object({
  id:    z.number().int().nullable().optional(),
  name:  z.string(),
  slug:  z.string(),
  team:  z.string(),
  cards: z.array(HeroCardSchema),
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
  cardType:     z.enum(["hero", "mastermind", "villain", "scheme"]).optional(),
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
