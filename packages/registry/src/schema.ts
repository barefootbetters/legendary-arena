/**
 * schema.ts — matches the actual Legendary Arena R2 data format
 *
 * Data lives at:
 *   https://images.barefootbetters.com/metadata/card-types.json  → set index
 *   https://images.barefootbetters.com/metadata/{abbr}.json      → full set
 *
 * Image URLs are embedded directly in each card object (imageUrl field).
 */

import { z } from "zod";

// ── Set index (card-types.json) ───────────────────────────────────────────────
export const SetIndexEntrySchema = z.object({
  id:          z.number().int().positive(),
  abbr:        z.string().min(1).max(10),
  pkgId:       z.number().int().positive(),
  slug:        z.string().min(1),
  name:        z.string().min(1),
  releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type:        z.string().min(1),
});

// ── Hero class ────────────────────────────────────────────────────────────────
export const HeroClassSchema = z.enum([
  "covert", "instinct", "ranged", "strength", "tech",
]);

// ── Hero card (slot 1–4 inside a hero) ────────────────────────────────────────
export const HeroCardSchema = z.object({
  name:        z.string(),
  displayName: z.string(),
  slug:        z.string(),
  rarity:      z.union([z.literal(1), z.literal(2), z.literal(3)]),
  rarityLabel: z.string(),
  slot:        z.number().int().min(1).max(4),
  hc:          HeroClassSchema,
  cost:        z.number().int().min(0),
  attack:      z.string().nullable(),
  recruit:     z.string().nullable(),
  imageUrl:    z.string().url(),
  abilities:   z.array(z.string()),
});

// ── Hero ──────────────────────────────────────────────────────────────────────
export const HeroSchema = z.object({
  id:    z.number().int().positive(),
  name:  z.string(),
  slug:  z.string(),
  team:  z.string(),
  cards: z.array(HeroCardSchema),
});

// ── Mastermind card ───────────────────────────────────────────────────────────
export const MastermindCardSchema = z.object({
  name:      z.string(),
  slug:      z.string(),
  tactic:    z.boolean().optional(),
  vAttack:   z.string(),
  imageUrl:  z.string().url(),
  abilities: z.array(z.string()),
});

// ── Mastermind ────────────────────────────────────────────────────────────────
export const MastermindSchema = z.object({
  id:          z.number().int().positive(),
  name:        z.string(),
  slug:        z.string(),
  alwaysLeads: z.array(z.string()),
  vp:          z.number().int(),
  cards:       z.array(MastermindCardSchema),
});

// ── Villain card ──────────────────────────────────────────────────────────────
export const VillainCardSchema = z.object({
  name:      z.string(),
  slug:      z.string(),
  vp:        z.union([z.string(), z.number()]),
  vAttack:   z.string(),
  imageUrl:  z.string().url(),
  abilities: z.array(z.string()),
});

// ── Villain group ─────────────────────────────────────────────────────────────
export const VillainGroupSchema = z.object({
  id:    z.number().int().positive(),
  name:  z.string(),
  slug:  z.string(),
  ledBy: z.array(z.string()),
  cards: z.array(VillainCardSchema),
});

// ── Scheme ────────────────────────────────────────────────────────────────────
export const SchemeSchema = z.object({
  id:       z.number().int().positive(),
  name:     z.string(),
  slug:     z.string(),
  imageUrl: z.string().url(),
  cards:    z.array(z.object({ abilities: z.array(z.string()) })),
});

// ── Full set file ─────────────────────────────────────────────────────────────
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

// ── Search query ──────────────────────────────────────────────────────────────
export const CardQuerySchema = z.object({
  setAbbr:      z.string().optional(),
  heroClass:    HeroClassSchema.optional(),
  team:         z.string().optional(),
  nameContains: z.string().optional(),
  cardType:     z.enum(["hero", "mastermind", "villain", "scheme"]).optional(),
  rarity:       z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
