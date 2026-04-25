# WP-055 — Theme Data Model (Mastermind / Scenario Themes v2)

**Status:** Complete
**Primary Layer:** Content / Data Contracts (Registry)
**Schema Version:** 2
**Last Updated:** 2026-04-19
**Dependencies:** WP-003 (registry exists), WP-005A (MatchSetupConfig locked)

**v2 Addendum (2026-04-19):** Schema bumped from 1 to 2 to introduce three
optional music fields (`musicTheme`, `musicAIPrompt`, `musicAssets`) per
D-5509. The v2 schema is a strict superset of v1 — all v1-required fields
retain their v1 semantics; v2 adds optional fields only. Per D-5504 (schema
evolution via versioning), the bump is required even for additive changes.
All 68 authored themes in `content/themes/` have been migrated to v2.

---

## Session Context

WP-005A locked the `MatchSetupConfig` contract (9 fields) and WP-003
established the card registry with Zod-based validation infrastructure.
Legendary Arena is expected to support **hundreds** of comic-accurate gameplay
themes — curated combinations of mastermind, scheme, villain groups, henchman
groups, and hero decks that recreate iconic Marvel storylines (researched via
Marvel Unlimited, Marvel Fandom, CMRO, Comic Vine, etc.).

This Work Packet defines the **authoritative JSON data model** for themes as a
**registry-layer content primitive**. It introduces **no runtime behavior** and
**no engine integration**.

---

## Why This Packet Matters

Themes are not ad-hoc flavor text. They are **loadable, validated, versioned
content** that will be referenced by:

- setup UI and scenario browsers
- PAR difficulty baselines (future)
- LLM export and scenario prompting
- community-authored content
- deterministic randomizers (future)

By locking a stable, engine-agnostic `ThemeDefinition` schema now, we prevent
schema drift across hundreds of themes and maintain alignment with **Vision
Goal 10: "Content as Data."** Themes become first-class citizens in the registry
— exactly like cards and sets — while remaining **purely static JSON**.

This packet converts comic-accurate theming from a wishlist into architecture.

### Music Field Semantics (Non-Normative)

The three v2 music fields carry an implicit editorial relationship that the
schema deliberately does **not** enforce. Future consumers must not infer
validation rules from this section — it exists solely to prevent a later WP
from "tightening" the schema with ordering constraints.

- `musicTheme` — human-readable mood or category label (e.g., "Terror / Horror Sting")
- `musicAIPrompt` — authoring provenance and intent (the prompt used to
  generate the score)
- `musicAssets` — published audio URLs hosted at `music.barefootbetters.com`

**No dependency or ordering is enforced between these fields at the registry
layer.** A theme may ship `musicAssets` without `musicTheme`, or `musicTheme`
without `musicAssets`. Consumers must treat all three as independent, optional
editorial data. Any future WP proposing a cross-field rule (e.g., "if assets
exist, theme must exist") must first land a `DECISIONS.md` entry and a
schema-version bump per D-5504.

---

## Goal

Establish a **stable, extensible, engine-agnostic Theme Data Contract (v2)**
such that:

- Themes are expressible entirely as static JSON files in `content/themes/`
- All themes share a consistent Zod-validated schema
- Referential intent is explicit (`ext_id` strings only)
- Future phases (UI, loaders, randomizers, PAR, LLM tools) can consume
  themes without schema churn

This WP defines **what a theme is**, not **what the engine does with it**.

### After completion:

- A `ThemeDefinition` Zod schema exists in `packages/registry/`
- Canonical storage layout is locked:
  - `content/themes/`
  - one file per theme
  - filename slug must match `themeId`
- Two example themes demonstrate the schema
- Governance decisions are recorded in `DECISIONS.md`

---

## Assumes

- WP-003 complete: `packages/registry/` exists and uses Zod
- WP-005A complete: `MatchSetupConfig` fields are locked
  (`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, and count fields)
- Card metadata exists with stable `ext_id` values
- `pnpm -r build` exits 0
- `pnpm test` exits 0

If any assumption is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — theme
  definitions are **registry-layer data only**. No engine or gameplay logic.
- `docs/ai/ARCHITECTURE.md — "Registry Layer (Data Input)"` — registry may
  read JSON, validate via Zod, and expose read-only structures.
- `packages/game-engine/src/matchSetup.types.ts` — `setupIntent` fields
  **must match** `MatchSetupConfig` identifiers exactly.
- `packages/registry/src/schema.ts` — follow established Zod patterns.
- `docs/ai/REFERENCE/00.6-code-style.md` — full-sentence comments, no
  abbreviations, ESM only.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Data only** — no runtime behavior, loaders, UI, randomizers, or logic
- **Registry-layer only** — new code lives in `packages/registry/` or
  `content/themes/`
- **No engine imports** — no files from `packages/game-engine/`
- **No gameplay logic** — themes describe composition only
- **Exact field alignment** — `setupIntent` mirrors `MatchSetupConfig` ID
  fields; **count fields excluded** because themes describe content
  composition, not pile sizing
- **IDs only** — all references are stable `ext_id` strings
- **External URLs are editorial** — never authoritative or required at runtime
- **No PAR scoring** — difficulty scoring deferred to later WPs
- **Immutable IDs** — once published, `themeId` never changes
- **Schema evolution via versioning only**, never mutation
- **Array order is intentional and must be preserved by consumers.** Themes
  express authorial emphasis through ordering — `villainGroupIds[0]` may be
  the featured or primary group, `heroDeckIds[0]` may be the marquee hero.
  Arrays in `setupIntent` and `playerCount.recommended` are sequences, not
  sets. Loaders, projectors, and UI surfaces must never sort, deduplicate by
  identity, or otherwise reorder them.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths
- **Reality-reconciliation at pre-flight (WP-042 precedent):** before locking
  any Zod schema field name, file path, or contract reference in the session
  invocation prompt as a "Locked Value", grep the actual source
  (`packages/registry/src/schema.ts`, `packages/registry/src/index.ts`, at
  least one representative `content/themes/*.json`, and `apps/registry-viewer/
  src/`) to confirm the name exists and matches. WP-042's 01.6 post-mortem
  §8 documents three session-prompt vs reality drifts that were caught only
  at execution time and cost authoring cycles — the pre-flight grep prevents
  the same class of issue here

**Locked contract values:**

- **MatchSetupConfig field names (from WP-005A):**
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **Theme storage layout:**
  `content/themes/` — one JSON file per theme, named by `themeId` slug

- **Schema version:** `themeSchemaVersion: 2`

---

## Debuggability & Diagnostics

- Validation must be deterministic and reproducible
- Errors must include:
  - `themeId` (when available)
  - failing field path — one of four stable labels:
    `'file'` (I/O failure), `'json'` (malformed JSON), `'themeId'`
    (filename-to-themeId mismatch), or a dot-joined Zod issue path
    (schema violation)
  - full-sentence error message
- Neither `validateTheme` nor `validateThemeFile` ever throws; both
  return `ValidationResult`. I/O and JSON-parse failures return
  structured errors with stable paths `'file'` and `'json'`
  respectively so directory scanners can aggregate without try/catch
- Identical JSON input must always yield identical validation output
- Filename slug **must** equal `themeId`
- `themeSchemaVersion` must equal `2`

---

## Scope (In)

### A) `packages/registry/src/theme.schema.ts` — new

```ts
import { z } from 'zod';

export const ThemeSetupIntentSchema = z.object({
  mastermindId: z.string().min(1),
  schemeId: z.string().min(1),
  villainGroupIds: z.array(z.string().min(1)).min(1),
  henchmanGroupIds: z.array(z.string().min(1)).default([]),
  heroDeckIds: z.array(z.string().min(1)).min(1),
  // why: exact field names from MatchSetupConfig (WP-005A);
  // count fields excluded because themes describe composition, not pile sizing
});

export const ThemePlayerCountSchema = z.object({
  recommended: z.array(z.number().int().min(1).max(6)).min(1),
  min: z.number().int().min(1).max(6),
  max: z.number().int().min(1).max(6),
})
.refine((data) => data.min <= data.max, {
  message: 'playerCount.min must be less than or equal to playerCount.max',
})
.refine(
  (data) => data.recommended.every(
    (count) => count >= data.min && count <= data.max
  ),
  { message: 'all recommended player counts must be within [min, max]' },
);

export const ThemePrimaryStoryReferenceSchema = z.object({
  issue: z.string().optional(),
  year: z.number().int().optional(),
  externalUrl: z.string().url().optional(),
  marvelUnlimitedUrl: z.string().url().optional(),
  externalIndexUrls: z.array(z.string().url()).default([]),
  // why: all fields are editorial only — not authoritative and never
  // required at runtime; vendor-specific URLs (Marvel Unlimited, Fandom,
  // CMRO, Comic Vine) may rot and must never be treated as dependencies
});

export const ThemeMusicAssetsSchema = z.object({
  previewIntroUrl: z.string().url().optional(),
  matchStartUrl: z.string().url().optional(),
  ambientLoopUrl: z.string().url().optional(),
  mainThemeUrl: z.string().url().optional(),
  schemeTwistUrl: z.string().url().optional(),
  masterStrikeUrl: z.string().url().optional(),
  villainAmbushUrl: z.string().url().optional(),
  bystanderUrl: z.string().url().optional(),
  // why: every URL is optional so themes can ship partial audio coverage
  // while the full asset pipeline documented in
  // content/media/MUSIC-AUTHORING.md is being produced
});

export const ThemeDefinitionSchema = z.object({
  themeSchemaVersion: z.literal(2),
  themeId: z.string().min(1).regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'themeId must be kebab-case',
  ),
  name: z.string().min(1),
  description: z.string().min(1),
  setupIntent: ThemeSetupIntentSchema,
  playerCount: ThemePlayerCountSchema,
  tags: z.array(z.string().min(1)).default([]),
  references: z.object({
    primaryStory: ThemePrimaryStoryReferenceSchema,
  }).optional(),
  flavorText: z.string().optional(),
  comicImageUrl: z.string().url().nullable().optional(),
  musicTheme: z.string().optional(),
  musicAIPrompt: z.string().optional(),
  musicAssets: ThemeMusicAssetsSchema.optional(),
  // why: comicImageUrl is an editorial cover image reference fetched from
  // Comic Vine API. Nullable because not all themes have verified covers.
  // URLs are hotlinked, not hosted — no images are stored in R2.
  // why: musicTheme / musicAIPrompt / musicAssets are v2 additions (D-5509).
  // All three are optional; themes without authored audio omit them.
  // why: parDifficultyRating intentionally excluded from v2 —
  // PAR scoring does not exist yet (WP-048)
  // note: themes intentionally exclude any rule logic, modifiers, or effects
});

export type ThemeDefinition = z.infer<typeof ThemeDefinitionSchema>;
```

### B) `packages/registry/src/theme.validate.ts` — new

```ts
import { ThemeDefinitionSchema } from './theme.schema.ts';
import type { ThemeDefinition } from './theme.schema.ts';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

type ValidationSuccess = { success: true; theme: ThemeDefinition };
type ValidationFailure = { success: false; errors: Array<{ path: string; message: string }> };
type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validate a parsed object against the ThemeDefinition schema.
 *
 * Never throws — returns `{ success: false, errors: [...] }` for any
 * schema violation. Error paths are dot-joined from the Zod issue path.
 *
 * why: the returned `theme` is Zod's parsed value. `safeParse` produces
 * a fresh top-level object, but nested arrays and objects may share
 * references with the input `data`. Callers that plan to mutate either
 * the input or the returned theme after validation must clone first
 * (e.g., `structuredClone(result.theme)`). This mirrors the WP-028 /
 * D-2802 aliasing-prevention precedent.
 */
export function validateTheme(data: unknown): ValidationResult {
  const result = ThemeDefinitionSchema.safeParse(data);
  if (result.success) {
    return { success: true, theme: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Read a JSON file, validate it, and check filename-to-themeId alignment.
 *
 * Never throws — all failure modes return a structured
 * `ValidationFailure` with one of four stable error-path labels:
 *   - `'file'`     — I/O failure (ENOENT, EACCES, etc.)
 *   - `'json'`     — malformed JSON
 *   - `'themeId'`  — filename-to-themeId mismatch
 *   - `<schema>`   — Zod issue path (dot-joined) for schema violations
 *
 * This contract lets directory scanners and authoring CLIs aggregate
 * errors across many files without try/catch noise, and is consistent
 * with the project-wide "pure helpers return structured results; only
 * `Game.setup()` may throw" rule (`.claude/rules/code-style.md`).
 */
export async function validateThemeFile(filePath: string): Promise<ValidationResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (error) {
    // why: I/O failures return structured results instead of throwing so
    // callers can aggregate file-scan errors uniformly (never throw rule)
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      errors: [{
        path: 'file',
        message: `Cannot read theme file "${filePath}": ${message}.`,
      }],
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    // why: malformed JSON returns a structured result instead of throwing
    // so authoring workflows can report "invalid JSON at <path>" uniformly
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      errors: [{
        path: 'json',
        message: `Theme file "${filePath}" contains invalid JSON: ${message}.`,
      }],
    };
  }

  const validation = validateTheme(data);

  if (validation.success) {
    const filenameSlug = basename(filePath, '.json');
    if (filenameSlug !== validation.theme.themeId) {
      // why: filename-to-themeId alignment prevents silent mismatches
      // when themes are loaded by directory scan
      return {
        success: false,
        errors: [{
          path: 'themeId',
          message: `Filename slug "${filenameSlug}" does not match themeId "${validation.theme.themeId}". Theme files must be named {themeId}.json.`,
        }],
      };
    }
  }

  return validation;
}
```

### C) `content/themes/` — shipped theme directory (already exists; migrated to v2)

The `content/themes/` directory ships with 68 authored theme files plus a
`content/themes/index.json` R2 manifest, a `CATALOG.md` slug reference, and
a `THEME-INDEX.md` governance index. WP-055 does NOT create this directory —
it was authored during the v1 design pass. WP-055's content responsibilities
are (a) commit the v1→v2 music-field migration for all 68 shipped themes,
and (b) add one new minimal-example theme. Files named `{themeId}.json`
serve as living documentation and validation test fixtures.

The JSON below illustrates the v2 shape — the file already exists on disk
and the working tree holds its v2 migration as part of the shipped set.

#### `content/themes/dark-phoenix-saga.json` — reference example (all fields populated; shipped, not new)

```json
{
  "themeSchemaVersion": 2,
  "themeId": "dark-phoenix-saga",
  "name": "Dark Phoenix Saga",
  "description": "Jean Grey becomes the Dark Phoenix, forcing the X-Men to confront cosmic power, betrayal, and the possible end of the universe.",
  "setupIntent": {
    "mastermindId": "dark-phoenix-jean-grey",
    "schemeId": "dark-phoenix-rises",
    "villainGroupIds": [
      "hellfire-club",
      "shiar-imperial-guard",
      "brood"
    ],
    "henchmanGroupIds": [
      "hellfire-goons"
    ],
    "heroDeckIds": [
      "cyclops",
      "wolverine",
      "storm",
      "phoenix"
    ]
  },
  "playerCount": {
    "recommended": [3, 4],
    "min": 2,
    "max": 6
  },
  "tags": [
    "x-men",
    "cosmic",
    "tragic-hero",
    "1970s",
    "phoenix-force"
  ],
  "references": {
    "primaryStory": {
      "issue": "X-Men #129-137",
      "year": 1980,
      "externalUrl": "https://marvel.fandom.com/wiki/Dark_Phoenix_Saga",
      "marvelUnlimitedUrl": "https://www.marvel.com/unlimited/series/dark-phoenix-saga",
      "externalIndexUrls": [
        "https://marvel.fandom.com/wiki/Dark_Phoenix_Saga",
        "https://cmro.travis-starnes.com/story_arc.php?arc=123"
      ]
    }
  },
  "flavorText": "The fire rises. The Phoenix must be stopped — or the universe will burn.",
  "comicImageUrl": "https://comicvine.gamespot.com/a/uploads/original/6/67663/5329124-10.jpg",
  "musicTheme": "Terror / Horror Sting",
  "musicAIPrompt": "Create a 45-second seamless loopable orchestral film score in the exact style of John Williams. Terror / Horror Sting. Jean Grey's descent into the Dark Phoenix — cosmic power turning to tragedy. Fractured strings, dissonant woodwinds, low choral whispers, sudden orchestral hits. High cinematic energy, wide stereo, instrumental only, perfectly loopable with no fade in/out.",
  "musicAssets": {
    "previewIntroUrl": "https://music.barefootbetters.com/themes/dark-phoenix-saga_MT01_preview-intro.mp3",
    "matchStartUrl": "https://music.barefootbetters.com/themes/dark-phoenix-saga_MT02_match-start.mp3",
    "ambientLoopUrl": "https://music.barefootbetters.com/themes/dark-phoenix-saga_MT03_ambient-loop.mp3",
    "mainThemeUrl": "https://music.barefootbetters.com/themes/dark-phoenix-saga_MT04_main-theme.mp3",
    "schemeTwistUrl": "https://music.barefootbetters.com/themes/dark-phoenix-saga_ES01_scheme-twist.mp3",
    "masterStrikeUrl": "https://music.barefootbetters.com/themes/dark-phoenix-saga_ES02_master-strike.mp3",
    "villainAmbushUrl": "https://music.barefootbetters.com/themes/dark-phoenix-saga_ES03_villain-ambush.mp3",
    "bystanderUrl": "https://music.barefootbetters.com/themes/dark-phoenix-saga_ES04_bystander.mp3"
  }
}
```

#### `content/themes/minimal-example.json` — minimal example (required fields only)

```json
{
  "themeSchemaVersion": 2,
  "themeId": "minimal-example",
  "name": "Minimal Example",
  "description": "A minimal theme demonstrating that all editorial, reference, and music fields are optional.",
  "setupIntent": {
    "mastermindId": "example-mastermind",
    "schemeId": "example-scheme",
    "villainGroupIds": [
      "example-villain-group"
    ],
    "heroDeckIds": [
      "example-hero"
    ]
  },
  "playerCount": {
    "recommended": [2],
    "min": 2,
    "max": 2
  }
}
```

> **Note:** The `ext_id` values in these examples (e.g., `dark-phoenix-jean-grey`,
> `example-mastermind`) are illustrative. When authoring real themes, use actual
> `ext_id` values from the card registry data. Referential integrity validation
> against the registry is deferred to the first WP that consumes themes at runtime.

### D) `packages/registry/src/theme.schema.test.ts` — new

Uses `node:test` and `node:assert` only. No boardgame.io import.

Ten tests:
1. Valid theme with all fields passes validation. Also asserts top-level
   distinctness: `result.theme !== inputData` — pins the WP-028 / D-2802
   aliasing-prevention precedent at the documented boundary
   (`safeParse` returns a fresh top-level object for object schemas;
   nested references may still share by design, per `validateTheme`
   JSDoc). Single `test()` call with two assertions.
2. Valid theme with only required fields passes validation
3. Missing `themeSchemaVersion` fails validation
4. Invalid `themeId` format (uppercase, spaces) fails validation
5. Empty `heroDeckIds` array fails validation (`.min(1)` enforced)
6. `playerCount` with `min > max` fails validation
7. `playerCount.recommended` value outside `[min, max]` fails validation
8. `validateThemeFile` manifest + error-path matrix. One `test()` call
   with three internal assertions (Part A/B/C wrapping per WP-033 P6-23
   precedent — preserves the locked 10-test / 2-suite count):
   - **Part A — manifest-driven happy path:** every theme filename
     listed in `content/themes/index.json` passes `validateThemeFile`.
     The manifest is the authoritative list of shipped theme files;
     aggregate and manifest artifacts in the same directory
     (`00-ALL_THEMES_COMBINED.json`, `01-ALL_THEMES_COMBINED.json`,
     `index.json` itself) are NOT themes and must be excluded by
     construction — a naïve `readdir` scan would load them and fail
     validation. The test reads `content/themes/index.json`, iterates
     the resulting `string[]`, and calls `validateThemeFile` on each.
   - **Part B — I/O failure returns structured result (never throws):**
     `validateThemeFile('<path-that-does-not-exist>.json')` resolves
     (not rejects) with
     `{ success: false, errors: [{ path: 'file', message: /^Cannot read theme file/ }] }`.
   - **Part C — malformed JSON returns structured result (never throws):**
     write `"{ not valid json"` to a fixture path under `os.tmpdir()`
     via `node:fs/promises writeFile`, then
     `validateThemeFile(<fixtureTmpPath>)` resolves with
     `{ success: false, errors: [{ path: 'json', message: /contains invalid JSON/ }] }`.
     Clean up the tmp fixture in a `t.after()` hook.
9. `themeSchemaVersion: 1` fails validation (literal v2 enforced — v1 files
   must be migrated, never loaded as-is)
10. `musicAssets` with a non-URL string in any URL field fails validation

### E) `packages/registry/src/index.ts` — modify (public-surface re-export)

Extend the registry package's public surface so future WPs consuming themes
(UI browsers, setup projectors, scenario loaders) can import from
`@legendary-arena/registry` rather than deep-path imports into
`packages/registry/src/theme.*.js`. Follows the existing export pattern
used for card types, factories, and schemas.

Add the following lines to `packages/registry/src/index.ts`:

```ts
// Theme types
export type { ThemeDefinition } from "./theme.schema.js";

// Theme schemas
export {
  ThemeDefinitionSchema,
  ThemeSetupIntentSchema,
  ThemePlayerCountSchema,
  ThemePrimaryStoryReferenceSchema,
  ThemeMusicAssetsSchema,
} from "./theme.schema.js";

// Theme validators
export { validateTheme, validateThemeFile } from "./theme.validate.js";
```

Export ordering: theme exports land **below** the existing card-data
re-exports, in the same Types → Schemas → Functions grouping the file
already uses. No re-ordering or renaming of existing exports is permitted.

---

## Scope (Out)

- **No theme loader or runtime registry** — loading themes into a queryable
  runtime registry is future work
- **No random theme selection** — theme randomization is future work
- **No PAR integration** — `parDifficultyRating` is excluded from v1; PAR
  scoring belongs to WP-048 and successors
- **No engine integration** — themes are not wired into `Game.setup()`,
  `MatchSetupConfig`, or any engine flow
- **No UI browsing or filtering** — theme display is a client concern
- **No LLM export** — prompt-generation from themes is future work
- **No community theme authoring** — contribution workflows are future work
- **No external scraping** — Marvel Fandom, CMRO, Comic Vine are authoring
  aids only; no automated fetching or dependency
- **No referential integrity validation against registry** — v1 validates
  schema shape only; verifying that `mastermindId` actually exists in the card
  registry is deferred to a theme loader WP (it requires registry access at
  validation time, which crosses layer concerns for a static schema)
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `packages/registry/src/theme.schema.ts` — **new** —
  ThemeDefinitionSchema, ThemeSetupIntentSchema, ThemePlayerCountSchema,
  ThemePrimaryStoryReferenceSchema Zod schemas and inferred TypeScript types
- `packages/registry/src/theme.validate.ts` — **new** —
  validateTheme (sync), validateThemeFile (async) helper functions
- `packages/registry/src/theme.schema.test.ts` — **new** —
  `node:test` coverage (10 tests — includes tests #9 and #10 added
  with the v2 schema bump per D-5509); all 10 wrapped in one
  `describe('theme schema (WP-055)')` block so the suite count
  increments cleanly by +1 (registry 3/1 → 13/2)
- `content/themes/minimal-example.json` — **new** —
  minimal example theme (required fields only; required to satisfy
  the "at least two example theme files" acceptance criterion)
- `content/themes/*.json` — **modify (v1→v2 migration per D-5509)** —
  68 shipped theme files migrated to `themeSchemaVersion: 2` with
  three optional music fields (`musicTheme`, `musicAIPrompt`,
  `musicAssets`). The migration was staged in the working tree during
  the v2 design pass (2026-04-19) and must be committed under WP-055's
  allowlist so the §D.8 manifest-driven validation test sees a fully
  migrated shipped set. `dark-phoenix-saga.json` is one of the 68
  migrated files and serves as the full-example reference shown in
  §C above; it is a **modify**, not a **new**, because the file has
  been shipped since the v1 authoring pass. The authoritative list
  of the 68 filenames is `content/themes/index.json` — no file
  outside that manifest may be modified by this WP
- `packages/registry/src/index.ts` — **modify (public-surface extension)** —
  append the theme type / schema / validator exports listed in §E above.
  Pure additive edit — no existing export may be reordered, renamed, or
  removed. Enables consumers to import via `@legendary-arena/registry`
  instead of deep paths

No other files may be modified. The following working-tree edits that
appear adjacent to WP-055 work are **explicitly out of scope** and must
remain quarantined: `apps/registry-viewer/src/lib/themeClient.ts`,
`apps/registry-viewer/CLAUDE.md` (both hold v1→v2 viewer-side edits
that belong to a separate viewer-domain commit).

---

## Governance (Required)

Add the following decisions to `DECISIONS.md`:

- Themes are **data, not behavior**
- Theme schema is engine-agnostic (registry layer only)
- `themeId` values are immutable once published
- Schema evolution uses versioning, not mutation
- External comic references (including vendor-specific URLs like Marvel
  Unlimited, Fandom, CMRO, Comic Vine) are editorial only — never
  authoritative or required at runtime; URLs may rot without consequence
- `parDifficultyRating` excluded from v2 (PAR system does not exist yet)
- `setupIntent` uses `MatchSetupConfig` field names but excludes count
  fields (themes describe content composition, not pile sizing)
- Referential integrity validation deferred to a theme loader WP
- Music fields (`musicTheme`, `musicAIPrompt`, `musicAssets`) added at v2
  per D-5509 — all optional, editorial in spirit, engine ignores missing values

Update `WORK_INDEX.md` to add WP-055 with status.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Schema Correctness
- [ ] `ThemeDefinitionSchema` Zod schema exists and exports `ThemeDefinition` type
- [ ] `themeSchemaVersion` is `z.literal(2)` — not a generic number
- [ ] `themeId` enforces kebab-case via regex
- [ ] `setupIntent` field names match `MatchSetupConfig` exactly:
      `mastermindId`, `schemeId`, `villainGroupIds`, `henchmanGroupIds`,
      `heroDeckIds`
- [ ] No `parDifficultyRating` field exists in the schema
- [ ] `playerCount` refinements enforce `min <= max` and `recommended` within range
- [ ] `ThemeMusicAssetsSchema` exists with all 8 optional URL fields
      (`previewIntroUrl`, `matchStartUrl`, `ambientLoopUrl`, `mainThemeUrl`,
      `schemeTwistUrl`, `masterStrikeUrl`, `villainAmbushUrl`, `bystanderUrl`)
- [ ] `musicTheme`, `musicAIPrompt`, and `musicAssets` are all optional on `ThemeDefinitionSchema`

### Validation
- [ ] `validateTheme` returns structured result (never throws)
- [ ] `validateThemeFile` checks filename-to-themeId alignment
- [ ] Error messages are full sentences including field path

### Content
- [ ] `content/themes/minimal-example.json` exists and passes
      `validateTheme` (the new minimal example)
- [ ] Every filename listed in `content/themes/index.json` exists on
      disk at `themeSchemaVersion: 2` (v1→v2 migration committed for
      all 68 shipped themes per D-5509)
- [ ] Every filename listed in `content/themes/index.json` passes
      `validateThemeFile` (manifest-driven scan per §D.8)
- [ ] Every filename listed in `content/themes/index.json` matches its
      file's `themeId` (filename-to-themeId alignment)

### Layer Boundary
- [ ] No imports from `packages/game-engine/`
      (confirmed with `grep`)
- [ ] No `boardgame.io` import in any new file
      (confirmed with `grep`)
- [ ] No files created or modified outside `packages/registry/src/` and
      `content/themes/`

### Tests
- [ ] All 10 tests pass (the 8 v1-era tests + tests #9 and #10 added
      with the v2 schema bump per D-5509)
- [ ] Test files use `.test.ts` extension
- [ ] Tests use `node:test` and `node:assert` only
- [ ] No boardgame.io import in test files

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `grep`)
- [ ] WP-005A contract files (`matchSetup.types.ts`) unmodified

---

## Verification Steps

```bash
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm test
# Expected: TAP output — all tests passing

# Step 3 — confirm no engine imports in theme files
grep -r "game-engine" packages/registry/src/theme.*.ts
# Expected: no output

# Step 4 — confirm no boardgame.io import in theme files
grep -r "boardgame.io" packages/registry/src/theme.*.ts
# Expected: no output

# Step 5 — confirm no require() in theme files
grep -r "require(" packages/registry/src/theme.*.ts
# Expected: no output

# Step 6 — confirm all themes listed in the manifest are valid JSON
# why: manifest-driven scan (NOT readdir) — aggregate/manifest artifacts
# in content/themes/ (00-ALL_THEMES_COMBINED.json, 01-ALL_THEMES_COMBINED.json,
# index.json itself) are not themes and must be excluded
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(
  await readFile('content/themes/index.json', 'utf-8'),
);
for (const file of manifest) {
  JSON.parse(await readFile('content/themes/' + file, 'utf-8'));
  console.log(file, 'OK');
}
"
# Expected: every file listed in index.json prints OK

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 8 — confirm WP-005A contracts unmodified
git diff packages/game-engine/src/matchSetup.types.ts
# Expected: no changes
```

---

## Session Recommendations (Preserved from Design Review 2026-04-12)

The following decisions were made during the WP-055 design review session and
are recorded here to prevent a future execution session from re-deriving them
as standalone work packets.

### Editorial reference fields belonged in v1, not a separate WP-055A

A proposal to create WP-055A (Theme Editorial Reference Extensions) was
rejected at the 2026-04-12 review. Adding optional fields
(`marvelUnlimitedUrl`, `externalIndexUrls`) to a Zod schema was judged
backwards-compatible and was folded into `ThemePrimaryStoryReferenceSchema`
without a version bump.

**Superseded 2026-04-19 (D-5504 / D-5509):** On re-reading D-5504 ("Schema
changes require a version bump, never mutation of existing fields"), any
schema change — additive or otherwise — now requires a version bump. The
music-fields addition is the first such bump (v1 → v2). Future additive
fields will also require a version bump. The editorial-fields exemption
above is grandfathered in v1; it would not be permitted today.

### Theme loader does not need its own WP

A proposal for WP-056 (Theme Registry Loader) was rejected as standalone work.
The loader is ~15 lines wrapping `validateThemeFile` in a directory scan. It
will land as a scope item in the first WP that actually consumes themes at
runtime (UI browser, setup projector, etc.).

### Referential integrity validation does not need its own WP

A proposal for WP-057 (Theme Referential Integrity Validator) was rejected as
standalone work. Checking that `setupIntent` IDs exist in the card registry is
~30 lines of code. It will land as a prerequisite step in the first WP that
wires themes into something requiring valid references.

### Theme-to-MatchSetupConfig projection does not need its own WP

A proposal for WP-058 (Theme -> MatchSetupConfig Projection) was rejected as
standalone work. The projection is a trivial spread operation (~10 lines). The
consuming WP will already have legitimate access to `MatchSetupConfig` and can
do the mapping inline. Creating a local structural interface to avoid a
cross-layer import was identified as over-engineering.

### Summary: WP-055 is the only theme data WP

All downstream theme concerns (loading, integrity checks, projection, UI) are
deferred to their respective consumer WPs as scope items, not standalone
contracts. Do not create WP-055A, WP-056, WP-057, or WP-058 for themes.

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (all test files)
- [ ] No engine imports in theme files (confirmed with `grep`)
- [ ] No `boardgame.io` import in theme files (confirmed with `grep`)
- [ ] No `require()` in any generated file (confirmed with `grep`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] WP-005A contract files not modified (confirmed with `git diff`)
- [ ] Example theme files pass JSON parse and schema validation
- [ ] `docs/ai/STATUS.md` updated — theme data model v1 established;
      ThemeDefinition schema with Zod validation; content/themes/ directory
      with example themes; themes are data-only, engine-agnostic content
- [ ] `docs/ai/DECISIONS.md` updated with all items from ## Governance
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-055 added with status
