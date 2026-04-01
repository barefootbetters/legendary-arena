# Prompt 02 — Registry Schema (Zod + TypeScript Types)

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. ESM only. Node v22+. Zod v3. Schema must accept all
> real-world field variations documented in Prompt 01. No strict validation that
> rejects entire sets on minor field variance.

## Assumes

- Prompt 01 complete: R2 data structure and field variations are documented
- `zod` is installed in the registry package (`packages/registry/`)
- Real-world variations confirmed:
  - `hero.id` can be null
  - `hero.cards[].slot` can exceed 4
  - `hero.cards[].displayName` can be missing
  - `hero.cards[].cost` can be string, number, or null
  - `mastermind.cards[].vAttack` can be string, number, or null
  - `villain.cards[].vp` can be string, number, or null
  - `scheme.id` can be null

---

## Role

You are defining the TypeScript type system and Zod runtime validation schemas
for the Legendary Arena card registry. These schemas are the single source of
truth — all TypeScript types are inferred from Zod schemas so runtime and
compile-time validation can never drift apart.

The schema philosophy is **permissive on input, strict on what we use**.
We accept the full variance of 40+ sets without rejecting valid data. Fields
that vary across sets are typed as `optional().nullable()`. The viewer handles
missing/null values gracefully with fallbacks.

---

## Deliverables

### 1. Zod schema file (`packages/registry/src/schema.ts`)

Define schemas in this order:

**`SetIndexEntrySchema`** — one entry from `sets.json`:
- `id: number`
- `abbr: string` (required — used as file path key)
- `pkgId: number | null | undefined`
- `slug: string | null | undefined`
- `name: string` (required — displayed in UI)
- `releaseDate: string | null | undefined`
- `type: string | null | undefined`

**`HeroClassSchema`** — enum:
`"covert" | "instinct" | "ranged" | "strength" | "tech"`

**`HeroCardSchema`** — one card within a hero's cards array:
- `name: string`
- `displayName: string | null | undefined`
- `slug: string`
- `rarity: 1 | 2 | 3`
- `rarityLabel: string | null | undefined`
- `slot: number` (no upper bound — some sets have 5–9 cards per hero)
- `hc: HeroClass | null | undefined`
- `cost: number | string | null | undefined`
- `attack: string | null | undefined`
- `recruit: string | null | undefined`
- `imageUrl: string (url) | null | undefined`
- `abilities: string[]` (default `[]`)

**`HeroSchema`** — one hero character:
- `id: number | null`
- `name: string`
- `slug: string`
- `team: string | null | undefined`
- `cards: HeroCard[]`

**`MastermindCardSchema`** — tactic or epic tactic card:
- `name: string`
- `slug: string`
- `tactic: boolean | undefined`
- `vAttack: string | number | null | undefined`
- `imageUrl: string (url) | null | undefined`
- `abilities: string[]` (default `[]`)

**`MastermindSchema`**:
- `id: number`
- `name: string`
- `slug: string`
- `alwaysLeads: string[]` (default `[]`)
- `vp: number | null | undefined`
- `cards: MastermindCard[]`

**`VillainCardSchema`**:
- `name: string`
- `slug: string`
- `vp: string | number | null | undefined`
- `vAttack: string | number | null | undefined`
- `imageUrl: string (url) | null | undefined`
- `abilities: string[]` (default `[]`)

**`VillainGroupSchema`**:
- `id: number`
- `name: string`
- `slug: string`
- `ledBy: string[]` (default `[]`)
- `cards: VillainCard[]`

**`SchemeSchema`**:
- `id: number | null`
- `name: string`
- `slug: string`
- `imageUrl: string (url) | null | undefined`
- `cards: Array<{ abilities: string[] }>` (default `[]`)

**`SetDataSchema`** — full per-set JSON:
- `id: number`
- `abbr: string`
- `exportName: string | null | undefined`
- `heroes: Hero[]` (default `[]`)
- `masterminds: Mastermind[]` (default `[]`)
- `villains: VillainGroup[]` (default `[]`)
- `henchmen: unknown[]` (default `[]`)
- `schemes: Scheme[]` (default `[]`)
- `bystanders: unknown[]` (default `[]`)
- `wounds: unknown[]` (default `[]`)
- `other: unknown[]` (default `[]`)

**`CardQuerySchema`** — viewer search/filter query:
- `setAbbr: string | undefined`
- `heroClass: HeroClass | undefined`
- `team: string | undefined`
- `nameContains: string | undefined`
- `cardType: "hero"|"mastermind"|"villain"|"henchman"|"scheme"|"bystander"|"wound"|"location"|"other" | undefined`
- `rarity: 1|2|3 | undefined`

### 2. TypeScript types file (`packages/registry/src/types/index.ts`)

Infer all types from Zod schemas using `z.infer<typeof Schema>`:

```typescript
export type SetIndexEntry   = z.infer<typeof SetIndexEntrySchema>;
export type SetData         = z.infer<typeof SetDataSchema>;
export type Hero            = z.infer<typeof HeroSchema>;
export type HeroCard        = z.infer<typeof HeroCardSchema>;
export type HeroClass       = z.infer<typeof HeroClassSchema>;
export type Mastermind      = z.infer<typeof MastermindSchema>;
export type MastermindCard  = z.infer<typeof MastermindCardSchema>;
export type VillainGroup    = z.infer<typeof VillainGroupSchema>;
export type VillainCard     = z.infer<typeof VillainCardSchema>;
export type Scheme          = z.infer<typeof SchemeSchema>;
export type CardQuery       = z.infer<typeof CardQuerySchema>;
```

Also define these manually (not Zod-inferred):

**`FlatCard`** — normalised single card for search grid display:
```typescript
export interface FlatCard {
  key:         string;   // "{setAbbr}-{cardType}-{slug}[-{slot}]"
  cardType:    "hero"|"mastermind"|"villain"|"henchman"|"scheme"|"bystander"|"wound"|"location"|"other";
  setAbbr:     string;
  setName:     string;
  name:        string;
  slug:        string;
  imageUrl:    string;   // empty string if missing — never null
  heroName?:   string;   // hero character name (hero cards only)
  team?:       string;
  hc?:         HeroClass;
  rarity?:     1 | 2 | 3;
  rarityLabel?: string;
  slot?:       number;
  cost?:       number;   // coerced to number; undefined if non-numeric
  attack?:     string | null;
  recruit?:    string | null;
  abilities:   string[];
}
```

**`FlatCardType`** — union of FlatCard cardType values:
```typescript
export type FlatCardType = FlatCard["cardType"];
```

**`CardQueryExtended`** — adds multi-type support to CardQuery:
```typescript
export interface CardQueryExtended extends CardQuery {
  cardTypes?: FlatCardType[];
}
```

**`RegistryInfo`**:
```typescript
export interface RegistryInfo {
  totalSets:       number;
  totalHeroes:     number;
  totalCards:       number;
  loadedSetAbbrs:  string[];
  metadataBaseUrl: string;
}
```

**`HealthReport`**:
```typescript
export interface HealthReport {
  generatedAt: string;
  summary: {
    setsIndexed:  number;
    setsLoaded:   number;
    totalHeroes:  number;
    totalCards:   number;
    parseErrors:  number;
  };
  errors: Array<{
    setAbbr?:  string;
    code:      string;
    message:   string;
  }>;
}
```

**`CardRegistry`** interface — full API surface:
```typescript
export interface CardRegistry {
  info():                    RegistryInfo;
  listSets():                SetIndexEntry[];
  getSet(abbr: string):      SetData | undefined;
  listHeroes():              Hero[];
  listCards():               FlatCard[];
  query(q: CardQuery):       FlatCard[];
  validate():                HealthReport;
}
```

**`HttpRegistryOptions`**:
```typescript
export interface HttpRegistryOptions {
  metadataBaseUrl: string;
  eagerLoad?:      string[];  // set abbrs to load on init; ["*"] = all
}
```

### 3. Shared helpers file (`packages/registry/src/shared.ts`)

Pure functions with no I/O:

**`flattenSet(set: SetData, setName: string): FlatCard[]`**
Converts one full set into individual FlatCard records:
- Hero cards: one FlatCard per slot per hero
- Mastermind cards: one FlatCard per tactic/epic card
- Villain cards: one FlatCard per card per group
- Henchmen: parse as `unknown[]`, extract `name`, `slug`, `imageUrl`, `abilities`
  defensively (cast to `Record<string, unknown>`)
- Schemes: one FlatCard per scheme (abilities flattened from nested cards array)
- Bystanders, wounds, other: same defensive extraction pattern

**`applyQuery(cards: FlatCard[], q: CardQueryExtended): FlatCard[]`**
Filter logic:
- If `q.cardTypes` has entries, filter by that array (multi-select)
- Else if `q.cardType` is set, filter by single type
- Apply `setAbbr`, `heroClass`, `team`, `rarity` filters
- Apply `nameContains` case-insensitive match against `name` + `heroName`

**`buildHealthReport(sets, loadedSets, errors): HealthReport`**
Produces a health report from the current registry state.

---

## Hard Constraints

- All TypeScript types must be inferred from Zod schemas — no manual type
  definitions that duplicate schema fields
- Schema must use `safeParse` (not `parse`) everywhere — never throw on bad data
- `FlatCard.imageUrl` must always be a string (never null/undefined) —
  use `""` as the fallback value
- `FlatCard.abilities` must always be a string array (never null/undefined) —
  use `[]` as the fallback
- No I/O in `shared.ts` — pure data transformation only
- No browser or Node.js APIs in `schema.ts` or `shared.ts`

---

## Acceptance Checklist

- [ ] `SetDataSchema.safeParse(real2099Json)` returns `success: true`
- [ ] Schema accepts `hero.id = null` without error
- [ ] Schema accepts `hero.cards[].slot > 4` without error
- [ ] Schema accepts `mastermind.cards[].vAttack = null` without error
- [ ] Schema accepts `mastermind.cards[].vAttack = 9` (number) without error
- [ ] Schema accepts `scheme.id = null` without error
- [ ] `FlatCard.imageUrl` is never null or undefined in `flattenSet` output
- [ ] `FlatCard.abilities` is never null or undefined in `flattenSet` output
- [ ] `applyQuery` with `cardTypes: ["hero", "villain"]` returns only hero and villain cards
- [ ] All types are inferred from Zod — no manual type definitions duplicate schema fields
