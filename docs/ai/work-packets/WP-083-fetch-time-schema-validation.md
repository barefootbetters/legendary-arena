# WP-083 — Fetch-Time Schema Validation for Registry-Viewer Clients

**Status:** Draft — A-083-04 landed 2026-04-21 at A0 SPEC; READY TO EXECUTE after pre-flight v2 + copilot-check v2 CONFIRM
**Primary Layer:** Registry (`packages/registry/src/schema.ts` + `packages/registry/package.json`) + Registry Viewer (`apps/registry-viewer/src/lib/**`)
**Schema Version:** 1
**Last Updated:** 2026-04-21 (A-083-04 amendment)
**Dependencies:** WP-060 (glossary data migrated to R2 — `412a31c`); WP-082 / EC-107 complete (`3da6ac3` 2026-04-21) — landed the `./schema` subpath precedent that A-083-04 mirrors for `./theme.schema`. Independent of WP-082 content-wise; this WP's `ViewerConfigSchema` defines `rulebookPdfUrl` as an optional field so the two packets may land in either order.

---

## Session Context

The registry viewer has four R2 fetchers. An audit on 2026-04-21 mapped which ones
validate fetched payloads with Zod before use:

| Fetcher | File fetched | Validates? |
|---|---|---|
| `packages/registry/src/impl/httpRegistry.ts` | `sets.json`, `{abbr}.json` | ✅ `.safeParse()` via `SetIndexEntrySchema` + `SetDataSchema` |
| `apps/registry-viewer/src/lib/registryClient.ts` | `public/registry-config.json` | ❌ cast as `RegistryConfig` TS interface only |
| `apps/registry-viewer/src/lib/themeClient.ts` | `themes/index.json` + `themes/{file}.json` | ❌ cast as `string[]` and `ThemeDefinition` (local interface) only |
| `apps/registry-viewer/src/lib/glossaryClient.ts` | `keywords-full.json` + `rules-full.json` | ✅ (since WP-082) `.safeParse()` via `KeywordGlossarySchema` + `RuleGlossarySchema` |

WP-082 covers the glossary gap. This packet covers the other two:
`registryClient.ts` (viewer config) and `themeClient.ts` (themes).

A malformed viewer config or theme file today silently produces the wrong runtime
shape: the registry may load from the wrong URL, or a theme detail panel may
render `undefined` fields. Zod validation at the fetch boundary turns both into a
single, full-sentence diagnostic the developer can act on.

**Secondary finding (naming collision):** the existing `RegistryConfigSchema` at
`packages/registry/src/schema.ts:33` (`z.array(z.string().min(2).max(10))`) is
**not** the schema for the viewer's `public/registry-config.json`. It is for a
separate R2 artifact — a flat list of set abbreviations — and is currently not
fetched by any runtime loader. This naming collision must be resolved **without
renaming** the existing schema (which could break CI scripts that consume it).
The new schema introduced by this packet is named `ViewerConfigSchema`.

**Pre-existing theme-schema reality (Amendment A-083-01 — see §Amendments):**
The audit that drove this packet's first draft overlooked that
`packages/registry/src/theme.schema.ts` already exports
`ThemeDefinitionSchema`, `ThemeSetupIntentSchema`, `ThemePlayerCountSchema`,
`ThemePrimaryStoryReferenceSchema`, `ThemeMusicAssetsSchema`, and the inferred
`ThemeDefinition` type (shipped by WP-055 / EC-055 — locked by D-5504 version
semantics and D-5509 music additions). These schemas are **reused as-is** by
this packet; they are NOT redefined. Only `ViewerConfigSchema` and
`ThemeIndexSchema` are genuinely new.

---

## Goal

Add `ViewerConfigSchema` and `ThemeIndexSchema` to `packages/registry/src/schema.ts`;
retrofit `registryClient.ts` and `themeClient.ts` to validate with `.safeParse(...)`
at the fetch boundary (reusing the pre-existing `ThemeDefinitionSchema` from
`theme.schema.ts` verbatim); emit uniform, scannable validation messages; and
enforce severity by dependency type — **throw** for hard dependencies (viewer
config, theme index), **warn + skip** for isolated batch entries (individual
theme files). No payload files are edited and no runtime behavior changes beyond
validation wiring are allowed.

### After completion

- `packages/registry/src/schema.ts` exports `ViewerConfigSchema`,
  `ThemeIndexSchema`, and their inferred types — both additions appended
  alphabetically into a new block without reshuffling existing exports
- The existing `RegistryConfigSchema` body is preserved byte-for-byte; only its
  adjacent comment is updated to disambiguate it from `ViewerConfigSchema`
- `packages/registry/src/index.ts` re-exports `ViewerConfigSchema`,
  `ThemeIndexSchema`, and their two inferred types explicitly (no `export *`).
  The pre-existing theme-schema re-export block (lines 42–48) is **not modified**
- `apps/registry-viewer/src/lib/registryClient.ts` validates
  `registry-config.json` with `ViewerConfigSchema.safeParse(...)` and **throws**
  on validation failure
- `apps/registry-viewer/src/lib/themeClient.ts` validates:
  - `themes/index.json` with `ThemeIndexSchema.safeParse(...)` and **throws**
    on validation failure
  - each theme file with `ThemeDefinitionSchema.safeParse(...)` (imported from
    `@legendary-arena/registry`) and **warns + skips** on validation failure
- The four inline theme interfaces in `themeClient.ts` (lines 10–47) are
  deleted; the file imports the registry package's inferred `ThemeDefinition`
  type instead
- `apps/registry-viewer/CLAUDE.md` is updated to note fetch-boundary validation
  on all four R2 fetchers
- Baseline repo test count preserved; build passes

---

## Assumes

- WP-060 / EC-106 complete (glossary data in R2)
- WP-082 / EC-107 has landed OR is scheduled independently — `ViewerConfigSchema`
  declares `rulebookPdfUrl` as optional so WP-083 and WP-082 may land in either
  order
- `packages/registry/src/theme.schema.ts` is at HEAD as delivered by EC-055 —
  `ThemeDefinitionSchema` + nested schemas + `ThemeDefinition` inferred type are
  already exported through `packages/registry/src/index.ts:42–48`
- `apps/registry-viewer/src/lib/registryClient.ts` at HEAD has:
  - inline `RegistryConfig` interface (lines ~5–8)
  - unchecked JSON parse at ~line 20
- `apps/registry-viewer/src/lib/themeClient.ts` at HEAD has:
  - inline `ThemeSetupIntent`, `ThemePlayerCount`, `ThemePrimaryStoryReference`,
    and `ThemeDefinition` interfaces (lines 10–47)
  - unchecked JSON parses at ~lines 70 and 79
- `packages/registry/src/schema.ts` at HEAD exports `RegistryConfigSchema` (line ~33)
  as `z.array(z.string().min(2).max(10))` — preserved byte-for-byte by this WP
- `packages/registry/src/index.ts` re-exports schemas explicitly (no `export *`)
- `packages/registry/package.json` at HEAD has an `exports` field with exactly two
  entries: `.` (barrel, pulls in Node-only `createRegistryFromLocalFiles`) and
  `./schema` (Zod-only, safe for browser bundles; landed by WP-082 amendment
  A-082-01 at commit `3da6ac3`). **A-083-04 adds `./theme.schema`** as a third
  subpath so `themeClient.ts` can import `ThemeDefinitionSchema` +
  `ThemeDefinition` without pulling the barrel's Node-only factory into the
  Vite/Rollup graph. See §G below.
- `pnpm -r build` exits 0 (confirmed at pre-flight 2026-04-21)
- `pnpm -r --if-present test` exits 0 at the WP-083 starting commit — baseline
  **596 passing / 0 failing** (engine 444 / registry 13 / vue-sfc-loader 11 /
  replay-producer 4 / server 6 / preplan 52 / arena-client 66; registry-viewer
  has no test script); inherits the baseline locked at WP-082/EC-107 close.
  Re-derive at execution time per EC-108 §Before Starting.

If any assumption is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md` §1 ("Monorepo Package Boundaries") and
  §"Registry Layer (Data Input)" and §"Layer Boundary (Authoritative)"
- `.claude/rules/architecture.md` §"Layer Boundary (Authoritative)" —
  Registry + Registry Viewer layers only
- `.claude/rules/registry.md` — schema authority; `schema.ts` and
  `theme.schema.ts` must not be modified without a `DECISIONS.md` entry
- `docs/ai/REFERENCE/00.2-data-requirements.md` — field-naming authority
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code rules
- `docs/ai/DECISIONS.md` — scan for prior decisions before adding new ones.
  Pay particular attention to D-5504 (`themeSchemaVersion` lock as
  `z.literal(2)`) and D-5509 (theme music field additions)
- `docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md` — prior art for
  glossary fetch pattern
- `docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md` —
  sibling WP; validation warning format must match
- `docs/ai/work-packets/WP-055-theme-data-model.md` and
  `docs/ai/execution-checklists/EC-055-theme-data-model.checklist.md` —
  authoritative source for the pre-existing theme schemas this packet reuses
- `packages/registry/src/impl/httpRegistry.ts:60–80, 190–205` — reference
  pattern for `.safeParse(...)` + structured error handling
- `packages/registry/src/theme.schema.ts` — the theme schemas this packet
  reuses verbatim (not modifies)
- `apps/registry-viewer/src/lib/themeClient.ts:57–107` — current non-blocking
  theme loader (target of retrofit)
- `apps/registry-viewer/src/lib/registryClient.ts:12–46` — current registry
  config loader (target of retrofit)
- `apps/registry-viewer/src/lib/glossaryClient.ts` — EC-107 reference
  implementation of `.safeParse(...)` + `[Glossary] Rejected ...` error format
- `apps/registry-viewer/public/registry-config.json` — file whose shape defines
  `ViewerConfigSchema`

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**

- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension — never `.test.mjs`
- **Full file contents** for every new or modified file — no diffs, no snippets,
  no partial edits
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (no nested
  ternaries; no branching `.reduce()`; descriptive names; JSDoc on all
  functions; `// why:` comments for non-obvious code; full-sentence error
  messages)
- No `import *` or barrel re-exports

**Packet-specific:**

- **No content, data, or behavior changes beyond validation wiring** — no JSON
  file is edited; no URL changes; no new fetcher is introduced; no public-facing
  API signatures change. Every existing export from every modified file retains
  the same name and signature.
- **`RegistryConfigSchema` at `schema.ts:33` is LOCKED** — preserved
  byte-for-byte. Only its adjacent comment is updated to disambiguate from
  `ViewerConfigSchema`.
- **`theme.schema.ts` is LOCKED** — reused verbatim. No schema body, refinement,
  or export change. Modifying `theme.schema.ts` would regress D-5504 and D-5509;
  this is a STOP condition.
- **All new object schemas are `.strict()`** — `.strict()` applies to
  `ViewerConfigSchema` (the only new object schema). `ThemeIndexSchema` is an
  array schema and cannot be `.strict()`; it enforces structure by element
  validation (each element must match `/\.json$/`). Pre-existing theme object
  schemas are NOT retro-applied `.strict()` — doing so would break D-5509
  additive music fields.
- **No changes to auxiliary metadata schemas** (`CardTypeEntrySchema`,
  `HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`,
  `LeadsEntrySchema`) — preserved byte-for-byte.
- **Viewer's `src/registry/schema.ts` is NOT modified** — known architectural
  smell; out of scope.
- **Server-side and engine code untouched** — no changes to
  `packages/game-engine/`, `apps/server/`, or `packages/preplan/`.
- **No new dependencies** — `zod` already exists in both relevant packages.

**Zod error reporting (uniform across all clients):**

All validation-failure messages emitted by `registryClient.ts` and
`themeClient.ts` must render exactly two fields from the **first** Zod issue
only:

- `issue.path.join('.')` — dotted path (`root` if the path array is empty)
- `issue.message` — Zod's issue message

Forbidden: `.format()` dumps, multi-issue lists, raw `issues` arrays, or
inconsistent per-client rendering. This mirrors the pattern locked by EC-107
in `glossaryClient.ts`.

**Session protocol:**

- If any `registry-config.json` field is added or renamed between pre-flight
  and execution commit, STOP and re-derive `ViewerConfigSchema`.
- Executor must confirm no production theme fails validation by running the
  dev server and checking the browser console before governance-close.
- If any shipped theme in `content/themes/` fails
  `ThemeDefinitionSchema.safeParse(...)` at the Verification Step 6 gate, STOP
  — this indicates either authoring drift in the theme file OR a pre-existing
  schema bug; neither is in scope for this packet to fix silently.

---

## Amendments

Amendments land in Commit A0 (SPEC) before execution.

### A-083-01 — Theme schemas are reused, not redefined

The original §A specified adding `ThemeDefinitionSchema`, `ThemeSetupIntentSchema`,
`ThemePlayerCountSchema`, and `ThemePrimaryStoryReferenceSchema` to
`schema.ts`. This was drafted without awareness that those schemas already
exist in `packages/registry/src/theme.schema.ts` (EC-055). This amendment
restricts §A to the two genuinely new schemas (`ViewerConfigSchema`,
`ThemeIndexSchema`); the viewer imports theme schemas from the existing
registry package export surface.

### A-083-02 — `.strict()` scoped to new object schemas only

The original acceptance line "all six new schemas are `.strict()`" was based on
A-083-01's incorrect assumption that six schemas would be authored. This
amendment narrows the rule to "all new object schemas are `.strict()`", which
resolves to `ViewerConfigSchema` only. `ThemeIndexSchema` is an array and
cannot be `.strict()`. Pre-existing theme schemas remain unchanged.

### A-083-03 — `themeSchemaVersion` range-validation scope correction

The original §Scope bullet for `themeSchemaVersion` (structural validation only,
range check deferred) is superseded by D-5504: the pre-existing
`ThemeDefinitionSchema` already locks `themeSchemaVersion: z.literal(2)`. No
structural-vs-range question remains. The note is removed.

### A-083-04 — `./theme.schema` subpath export for browser-safe theme-schema imports

**Source:** `docs/ai/invocations/preflight-wp083.md` §RS-1 and
`docs/ai/invocations/copilot-check-wp083.md` Finding #12, authored 2026-04-21
against the original WP-083 draft.

**Reason:** the 2026-04-21 pre-flight discovered that the original WP-083 §E
instructs the viewer to `import { ThemeDefinitionSchema, type ThemeDefinition,
ThemeIndexSchema } from "@legendary-arena/registry"` (the barrel). The barrel
re-exports `createRegistryFromLocalFiles` at `index.ts:27`, which imports
Node-only modules (`node:fs/promises`, `node:path`). Vite externalizes those
for the browser build, but Rollup resolves the import graph before tree-shaking
can prune the unused factory, so the viewer's production build would fail on
`resolve` from `__vite-browser-external` — the exact failure mode
`glossaryClient.ts:20–28` documents and EC-107/WP-082 resolved for general
schemas by adding a `./schema` subpath export at amendment A-082-01.

The `./schema` subpath covers `packages/registry/src/schema.ts` only (via
`"./dist/schema.js"`). Theme schemas live in `packages/registry/src/theme.schema.ts`
(locked by D-5504 / D-5509 / EC-055) and are **not reachable** through the
existing `./schema` subpath. Without a second subpath, the viewer has three
unacceptable choices: (a) barrel import and break the browser build, (b) move
theme schemas out of `theme.schema.ts` into `schema.ts` (prohibited by
D-5504 / D-5509), or (c) re-export theme schemas from `schema.ts` (blurs
file-level responsibility and couples two locked authorities).

**Scope-neutral decision per WP-082 / A-082-01 precedent framework?** No —
A-083-04 **expands** the allowlist beyond the original WP by adding
`packages/registry/package.json`. This is not a scope-neutral mid-execution
amendment; it is a pre-execution authored amendment that *adds* one file to
§Files Expected to Change, adds one entry to §Governance (D-083E), and locks
exact import lines in §Scope (In) §D and §E. The amendment lands on the A0 SPEC
bundle **before** any Commit A edit, so the executor works from a complete
allowlist.

**Added to scope (Commit A):**

- `packages/registry/package.json` — extend the `exports` field with a third
  subpath entry `"./theme.schema"` pointing at `"./dist/theme.schema.js"` +
  `"./dist/theme.schema.d.ts"`. See §Scope (In) §G for the exact JSON delta.

**Added to §Scope (In):** new section §G ("Extend registry package exports
map"). §D and §E are updated to lock the exact import lines for
`registryClient.ts` and `themeClient.ts` against the two subpaths.

**Added to §Governance:** D-083E — locks the `./theme.schema` subpath export
as a reusable retrofit precedent alongside D-083A–D-083D and the A-082-01
`./schema` precedent.

**Added to §Acceptance Criteria:** two new items — `package.json` `exports`
field contains `"./theme.schema"`; no import of `@legendary-arena/registry`
(barrel) appears in `registryClient.ts` or `themeClient.ts`.

**Added to §Verification Steps:** Step 6.5 — grep for `themeSchemaVersion` in
`apps/registry-viewer/src/` to confirm zero consumers outside the inline
interface being deleted (mitigates pre-flight RS-5 / copilot-check Finding
#21 — `themeSchemaVersion` narrows from `number` to `z.literal(2)` when the
local interface is replaced with the registry's inferred type).

**Authority:** author-approved 2026-04-21 after reading preflight-wp083.md §RS-1
and copilot-check-wp083.md Finding #12. Re-runs 01.4 pre-flight + 01.7 copilot
check post-amendment; verdict flips from DO NOT EXECUTE YET / SUSPEND to READY
TO EXECUTE / CONFIRM before the session prompt is generated.

**Cross-references:**
- `docs/ai/invocations/preflight-wp083.md` §Pre-Session Actions PS-2
- `docs/ai/invocations/copilot-check-wp083.md` Finding #12
- `docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md`
  §Locked Values (updated in parallel for `package.json` + imports + Step 6.5)
- WP-082 amendment A-082-01 and DECISIONS.md entry locking `./schema` subpath
  (the precedent this amendment mirrors)

---

## Scope (In)

### A) New Zod schemas in `packages/registry/src/schema.ts`

Append the following **without reshuffling unrelated existing exports**. New
schemas may be grouped as a single new block appended to the file; within the
new block, keep declarations alphabetical by schema name.

#### `ThemeIndexSchema` (exported)

Theme filename list fetched from `{metadataBaseUrl}/themes/index.json`:

```ts
// why: root manifest of theme filenames. The /\.json$/ regex keeps a rogue
// README.md or .DS_Store leak from masquerading as a theme file at fetch time.
export const ThemeIndexSchema = z.array(
  z.string().regex(/\.json$/, "theme index entries must end in .json"),
);

export type ThemeIndex = z.infer<typeof ThemeIndexSchema>;
```

#### `ViewerConfigSchema` (exported)

Matches `apps/registry-viewer/public/registry-config.json`:

```ts
// why: distinct from RegistryConfigSchema (R2 set-abbreviation artifact).
// Object shape consumed by the viewer at boot. rulebookPdfUrl is optional
// so WP-082 and WP-083 are order-independent.
export const ViewerConfigSchema = z
  .object({
    metadataBaseUrl: z.string().url(),
    eagerLoad: z.array(z.string().min(2).max(10)).optional(),
    rulebookPdfUrl: z.string().url().optional(),
  })
  .strict();

export type ViewerConfig = z.infer<typeof ViewerConfigSchema>;
```

### B) Update existing comment on `RegistryConfigSchema`

Update the comment adjacent to `RegistryConfigSchema` to clarify it is **not**
the viewer's public config. The schema body is unchanged.

From:

```
// ── Registry config (registry-config.json at R2 root) ─────────────────────────
// Simple array of set abbreviation strings. Not a source file — R2 artifact only.
```

To:

```
// ── Registry set-abbreviation list (R2 /registry-config.json artifact) ────────
// Simple array of set abbreviation strings. R2 artifact only — not the viewer's
// public config. For the viewer's public/registry-config.json (object shape with
// metadataBaseUrl, eagerLoad, rulebookPdfUrl), see ViewerConfigSchema below.
```

### C) Export the new schemas from the package index

Update `packages/registry/src/index.ts` to extend the existing general-schema
re-export block (lines 30–36) with `ViewerConfigSchema` and `ThemeIndexSchema`,
and add a parallel `export type { ... }` for their inferred types. **The
theme-schema re-export block at lines 42–48 is NOT modified.**

```ts
// Schema (for external validation use)
export {
  SetDataSchema,
  SetIndexEntrySchema,
  HeroCardSchema,
  HeroClassSchema,
  CardQuerySchema,
  ThemeIndexSchema,
  ViewerConfigSchema,
} from "./schema.js";

export type {
  ThemeIndex,
  ViewerConfig,
} from "./schema.js";
```

No `export *`. No barrel re-export. Explicit named re-export only, matching
the style extended in EC-107 for the glossary schemas.

### D) Retrofit `apps/registry-viewer/src/lib/registryClient.ts`

- Import `ViewerConfigSchema` and inferred `ViewerConfig` type from the
  registry package's `./schema` subpath (**not** the barrel — mirrors the
  `glossaryClient.ts:29–32` precedent established by EC-107 / A-082-01):

  ```ts
  import { ViewerConfigSchema, type ViewerConfig } from "@legendary-arena/registry/schema";
  ```

  Barrel imports (`from "@legendary-arena/registry"`) are **forbidden** in
  this file — they would re-introduce the browser-build failure documented at
  `glossaryClient.ts:20–28` by pulling Node-only `createRegistryFromLocalFiles`
  into the Rollup import graph.
- The pre-existing `createRegistryFromHttp` + `CardRegistry` imports from
  `"../registry/browser"` (viewer-local relative path) are **not modified** —
  the viewer's browser entry-point duplication is a known architectural smell
  (EC-108 §Out of Scope) but out of scope for WP-083.
- Remove the inline `RegistryConfig` interface (lines 5–8)
- After `await res.json()`, call `ViewerConfigSchema.safeParse(...)`
- On failure: **throw** `Error` with a full-sentence message that renders only
  the first Zod issue as `path.join('.')` + `message`. Example shape:

  > `[RegistryConfig] Rejected registry-config.json from <URL> at path '<PATH>': <MESSAGE>. Viewer cannot boot with an invalid config; fix the file and redeploy.`

- Success path reads `parseResult.data.metadataBaseUrl` etc. No other
  behavior changes.

### E) Retrofit `apps/registry-viewer/src/lib/themeClient.ts`

- Import `ThemeIndexSchema` from the `./schema` subpath (new schema authored
  by this WP §A — lives in `packages/registry/src/schema.ts` alongside the
  other general schemas):

  ```ts
  import { ThemeIndexSchema } from "@legendary-arena/registry/schema";
  ```

- Import `ThemeDefinitionSchema` and inferred `ThemeDefinition` type from the
  **new `./theme.schema` subpath** landed by A-083-04 (the theme schemas live
  in `packages/registry/src/theme.schema.ts`, locked by D-5504 / D-5509, and
  are not reachable through the existing `./schema` subpath):

  ```ts
  import { ThemeDefinitionSchema, type ThemeDefinition } from "@legendary-arena/registry/theme.schema";
  ```

  Barrel imports (`from "@legendary-arena/registry"`) are **forbidden** in
  this file for the same browser-build reason as §D above.
- **Delete** the four inline interfaces at lines 10–47: `ThemeSetupIntent`,
  `ThemePlayerCount`, `ThemePrimaryStoryReference`, `ThemeDefinition`.
  Downstream consumers of the exported `ThemeDefinition` type now receive the
  wider, schema-inferred shape (includes optional `musicTheme`,
  `musicAIPrompt`, `musicAssets` per D-5509; narrows `themeSchemaVersion` to
  `literal(2)`; applies `playerCount` refinements). This is a strict widening
  of the compile-time surface — no existing consumer is broken.

**Validate `themes/index.json`:**

- Call `ThemeIndexSchema.safeParse(...)` after `await indexResponse.json()`
- On failure: **throw** `Error` with a full-sentence message including the
  URL and first Zod issue `path` + `message`. The theme index is treated as
  a root manifest; if malformed, the Themes subsystem is considered
  unavailable and must fail fast. Example:

  > `[Themes] Rejected themes/index.json from <URL> at path '<PATH>': <MESSAGE>. The Themes tab cannot populate without a valid index.`

**Validate each individual theme file:**

- Call `ThemeDefinitionSchema.safeParse(...)` after `await themeResponse.json()`
- On failure: `console.warn(...)` a full-sentence message including
  filename + URL + first Zod issue `path` + `message` + an explicit
  "Theme skipped" note, then return `null`. The existing
  `Promise.allSettled` + null-filter loop at lines 72–87 already drops nulls
  cleanly. Example:

  > `[Themes] Rejected <FILE> from <URL> at path '<PATH>': <MESSAGE>. Theme skipped; Themes tab will not show it.`

- Preserve the `Promise.allSettled`, null-filter, sort-by-name, and any
  `devLog("theme", ...)` instrumentation byte-for-byte.

### F) Documentation

- Update `apps/registry-viewer/CLAUDE.md`:
  - §"Key Files" — annotate `registryClient.ts` and `themeClient.ts` as
    Zod-validated at fetch
  - §"Design Patterns" — extend the Zod-inferred-types bullet to note
    `.safeParse()` at the fetch boundary for all four R2 fetchers (registry
    config, themes, keywords, rules). The fourth was already added by EC-107;
    this WP completes the set.
- Update `docs/03.1-DATA-SOURCES.md` only if the existing doc structure
  supports a small additive note; otherwise skip (lint gate §1 is satisfied
  via WORK_INDEX status column per repo convention).

### G) Extend registry package `exports` map (A-083-04)

Add a third subpath entry to `packages/registry/package.json` `exports` field
so viewer code can import theme schemas without pulling the barrel's Node-only
`createRegistryFromLocalFiles` factory into the Rollup import graph. Mirrors
the A-082-01 precedent for `./schema`.

**Before (at HEAD):**

```json
"exports": {
  ".": {
    "import": "./dist/index.js",
    "types": "./dist/index.d.ts"
  },
  "./schema": {
    "import": "./dist/schema.js",
    "types": "./dist/schema.d.ts"
  }
}
```

**After:**

```json
"exports": {
  ".": {
    "import": "./dist/index.js",
    "types": "./dist/index.d.ts"
  },
  "./schema": {
    "import": "./dist/schema.js",
    "types": "./dist/schema.d.ts"
  },
  "./theme.schema": {
    "import": "./dist/theme.schema.js",
    "types": "./dist/theme.schema.d.ts"
  }
}
```

No other `package.json` field is modified. `tsconfig.build.json` already
emits `dist/theme.schema.js` + `dist/theme.schema.d.ts` from `src/theme.schema.ts`,
so no build-config change is required.

---

## Out of Scope

- **Glossary client validation** — covered by WP-082 / EC-107. This packet
  does NOT modify `apps/registry-viewer/src/lib/glossaryClient.ts`.
- **Viewer's local `src/registry/schema.ts`** — known duplication; out of
  scope.
- **Auxiliary metadata schemas runtime wiring** — `CardTypeEntrySchema`,
  `HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`,
  `LeadsEntrySchema` are untouched; wiring them to a fetcher is future-WP
  scope.
- **`RegistryConfigSchema` runtime fetch** — currently unused at runtime;
  wiring it is out of scope.
- **Any JSON content edits** — `public/registry-config.json` and
  `content/themes/*.json` must not be edited in this WP.
- **Server-side changes** — `createRegistryFromLocalFiles()` already validates
  via the registry package.
- **Theme schema modifications** — `theme.schema.ts` is locked by D-5504 /
  D-5509 / EC-055. Adding `.strict()`, changing `themeSchemaVersion`, or
  rearranging fields requires a separate WP with DECISIONS review.
- **Deleting `card-types-old.json`** — confirmed orphaned but micro-cleanup
  is not this WP.
- **New test frameworks** — any tests added use `node:test` only.
- **Refactoring or style cleanup** outside the retrofit.

---

## Files Expected to Change

**Registry package core (Commit A):**

- `packages/registry/src/schema.ts` — **modified** — append `ViewerConfigSchema`
  + `ThemeIndexSchema` + two inferred types; update comment adjacent to
  `RegistryConfigSchema` (schema body **unchanged, byte-for-byte**)
- `packages/registry/src/index.ts` — **modified** — extend the general-schema
  re-export block (lines ~30–40 at HEAD; re-derive at execution time) with
  `ViewerConfigSchema` + `ThemeIndexSchema`; add a parallel `export type { ... }`
  for the two inferred types. **Theme block (lines ~47–57 at HEAD) is NOT
  modified.**
- `packages/registry/package.json` — **modified (A-083-04)** — add a third
  subpath entry `"./theme.schema"` to the `exports` field per §Scope (In) §G.
  No other field in this file is modified.

**Viewer clients (Commit A):**

- `apps/registry-viewer/src/lib/registryClient.ts` — **modified** — delete
  inline `RegistryConfig` interface; import `ViewerConfigSchema` + `ViewerConfig`
  type from `@legendary-arena/registry/schema` subpath (per §D, **barrel
  forbidden**); call `ViewerConfigSchema.safeParse(...)`; throw full-sentence
  `Error` on validation failure
- `apps/registry-viewer/src/lib/themeClient.ts` — **modified** — delete the
  four inline interfaces (lines ~12–47 at HEAD); import `ThemeIndexSchema`
  from `@legendary-arena/registry/schema` AND `ThemeDefinitionSchema` +
  `ThemeDefinition` type from `@legendary-arena/registry/theme.schema` subpath
  (per §E, **barrel forbidden**); validate index (throw on failure) and each
  theme (warn + skip on failure)

**Documentation (Commit A):**

- `apps/registry-viewer/CLAUDE.md` — **modified** — fetch-boundary validation
  note for both clients; update §Design Patterns bullet
- `docs/03.1-DATA-SOURCES.md` — **modified (optional)** — small additive note
  if doc structure supports it

**Governance (Commit B):**

- `docs/ai/DECISIONS.md` — **modified** — governance entries D-083A–D-083E
  (see §Governance; D-083E added by A-083-04)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — flip WP-083 `[ ]` →
  `[x]` with date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-108 row flipped
  to `Done`

No other files may be modified. In particular:

- `packages/registry/src/theme.schema.ts` — **not touched**
- `packages/registry/src/theme.validate.ts` — **not touched**
- `apps/registry-viewer/src/lib/glossaryClient.ts` — **not touched**
  (WP-082 / EC-107 territory)
- `apps/registry-viewer/public/registry-config.json` — **not touched**
- `content/themes/*.json` — **not touched**

---

## Governance (Required)

Add the following entries to `docs/ai/DECISIONS.md` using the repo's standard
Decision / Rationale / Introduced / Status format. Final numeric IDs are
allocated at governance-close (Commit B); the `D-083N` labels below are
placeholders that the executor replaces with the next free IDs in the
chronological sequence.

#### D-083A — Viewer fetches validate at the boundary

**Decision:** Every R2 fetcher in the registry viewer validates its payload
with `.safeParse(...)` against a schema owned by the registry package
(`packages/registry/src/schema.ts` or `packages/registry/src/theme.schema.ts`).
Inline TS-interface casts on fetched JSON are forbidden.
**Rationale:** Prevents silent shape drift and makes failures
developer-actionable at the first point of ingestion. Completes the
viewer-side validation rollout initiated by WP-082.
**Introduced:** WP-082 / WP-083
**Status:** Active Policy

#### D-083B — `ViewerConfigSchema` is distinct from `RegistryConfigSchema`

**Decision:** `ViewerConfigSchema` is the schema for
`apps/registry-viewer/public/registry-config.json` (object shape).
`RegistryConfigSchema` remains the schema for the R2 `/registry-config.json`
set-abbreviation list (array of strings). These names and meanings are locked
and must not be conflated or renamed.
**Rationale:** Avoids breaking external tooling and prevents the recurring
misconfiguration class caused by the naming collision.
**Introduced:** WP-083
**Status:** Active Policy

#### D-083C — Validation severity policy by dependency type

**Decision:** Validation failures are handled by dependency severity:
**throw** when the payload is a hard dependency (viewer config, theme index);
**warn and skip** when the failure is isolated to a single entry in a batch
(individual theme file). All diagnostics render only `issue.path.join('.')` +
`issue.message` from the first Zod issue; `.format()` dumps and multi-issue
lists are forbidden.
**Rationale:** Hard dependencies must fail loudly to avoid undefined runtime
behavior; batch entries should degrade gracefully while preserving operator
visibility. Uniform error shape keeps logs scannable.
**Introduced:** WP-083
**Status:** Active Policy

#### D-083D — Auxiliary metadata schemas remain offline-only

**Decision:** `CardTypeEntrySchema`, `HeroClassEntrySchema`,
`HeroTeamEntrySchema`, `IconEntrySchema`, and `LeadsEntrySchema` remain
defined but unfetched at runtime. Their consumers are offline CI validation
(`validate.ts`). Wiring them to a runtime fetcher requires its own WP.
**Rationale:** Avoids scope creep and preserves the current runtime data
surface until explicitly expanded.
**Introduced:** WP-083
**Status:** Active Policy

#### D-083E — Theme-schema subpath export for browser-safe viewer imports

**Decision:** `packages/registry/package.json` exposes theme schemas via a
dedicated `./theme.schema` subpath (`import { ThemeDefinitionSchema, type
ThemeDefinition } from "@legendary-arena/registry/theme.schema";`). Viewer
code (and any future browser-bundled consumer) **must** use this subpath
instead of the barrel `@legendary-arena/registry`. The barrel re-exports
`createRegistryFromLocalFiles` which imports Node-only modules (`node:fs/promises`,
`node:path`); Rollup resolves the import graph before tree-shaking can prune
the unused factory, so a barrel import of theme schemas would break the
viewer's production build at `resolve` from `__vite-browser-external`.
**Rationale:** Locks the retrofit precedent A-082-01 established for general
schemas (`./schema`) and extends it to theme schemas without modifying
`theme.schema.ts` (locked by D-5504 / D-5509). Preserves file-level separation
of concerns — `schema.ts` and `theme.schema.ts` each expose their own subpath
independently. Future retrofit WPs consuming theme schemas in a browser bundle
cite this decision instead of re-litigating the import-path question.
**Introduced:** WP-083 (amendment A-083-04)
**Status:** Active Policy

Also update:

- `docs/ai/work-packets/WORK_INDEX.md`: flip WP-083 `[ ]` → `[x]` with
  execution date and Commit A hash on governance-close (Commit B)
- `docs/ai/execution-checklists/EC_INDEX.md`: mark the allocated EC (EC-108
  at time of drafting; re-confirm at pre-flight) as `Done` on
  governance-close
- `docs/03.1-DATA-SOURCES.md` only if applicable per §Scope

---

## Acceptance Criteria

- [ ] `packages/registry/src/schema.ts` exports `ViewerConfigSchema` +
      `ThemeIndexSchema` (two new exports)
- [ ] All new **object** schemas are `.strict()`. In practice this is
      `ViewerConfigSchema`. `ThemeIndexSchema` is an array and not `.strict()`.
- [ ] `ViewerConfigSchema` includes `rulebookPdfUrl: z.string().url().optional()`
- [ ] Existing `RegistryConfigSchema` schema body preserved byte-for-byte;
      only the adjacent comment is updated
- [ ] `packages/registry/src/theme.schema.ts` is unmodified (`git diff` empty)
- [ ] `packages/registry/src/theme.validate.ts` is unmodified (`git diff` empty)
- [ ] `packages/registry/src/index.ts` re-exports `ViewerConfigSchema` +
      `ThemeIndexSchema` + two inferred types explicitly (no `export *`); the
      pre-existing theme export block (lines ~47–57 at HEAD; re-derive) is
      unchanged
- [ ] **(A-083-04)** `packages/registry/package.json` `exports` field contains
      three subpath entries: `.`, `./schema`, and `./theme.schema`; the new
      `./theme.schema` entry points at `./dist/theme.schema.js` +
      `./dist/theme.schema.d.ts`
- [ ] **(A-083-04)** No `import ... from "@legendary-arena/registry"` (barrel)
      appears in `apps/registry-viewer/src/lib/registryClient.ts` or
      `apps/registry-viewer/src/lib/themeClient.ts`. Both files import from
      the narrow subpaths (`@legendary-arena/registry/schema` and/or
      `@legendary-arena/registry/theme.schema`) only.
- [ ] `apps/registry-viewer/src/lib/registryClient.ts` has no inline
      `RegistryConfig` interface and calls `ViewerConfigSchema.safeParse(...)`
- [ ] `registryClient.ts` throws a full-sentence `Error` on validation failure
      that names the URL and renders only first Zod issue `path` + `message`
- [ ] `apps/registry-viewer/src/lib/themeClient.ts` has no inline
      `ThemeSetupIntent` / `ThemePlayerCount` / `ThemePrimaryStoryReference` /
      `ThemeDefinition` interfaces
- [ ] `themeClient.ts` validates the index with `ThemeIndexSchema` (throw on
      failure) and each theme with `ThemeDefinitionSchema` (warn + skip on
      failure)
- [ ] All validation-failure messages render exactly `issue.path.join('.')` +
      `issue.message` from the **first** Zod issue only
- [ ] All shipped themes in `content/themes/` validate against
      `ThemeDefinitionSchema` with zero failures (verification Step 6 gate)
- [ ] `apps/registry-viewer/public/registry-config.json` validates against
      `ViewerConfigSchema` with zero failures (verification Step 5 gate)
- [ ] No imports of `packages/game-engine/`, `packages/preplan/`,
      `apps/server/`, `pg`, or `boardgame.io` in any changed file
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm -r --if-present test` exits 0 with baseline passing count
      preserved
- [ ] `git diff --name-only` shows only files listed in §"Files Expected to
      Change"

---

## Verification Steps

```bash
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run tests (baseline passing count preserved)
pnpm -r --if-present test
# Expected: exits 0; repo-wide baseline preserved

# Step 3 — new schemas exported from the package
grep -cE "^export const (ViewerConfigSchema|ThemeIndexSchema)" \
  packages/registry/src/schema.ts
# Expected: 2

grep -cE "(ViewerConfig|ThemeIndex)(Schema)?" \
  packages/registry/src/index.ts
# Expected: >= 4 (two schemas + two inferred types)

# Step 4 — existing RegistryConfigSchema body unchanged + theme.schema.ts
# and theme.validate.ts untouched
grep -A 1 "^export const RegistryConfigSchema" packages/registry/src/schema.ts
# Expected: body shows z.array(z.string().min(2).max(10)) exactly as at HEAD

git diff --name-only packages/registry/src/theme.schema.ts
# Expected: no output

git diff --name-only packages/registry/src/theme.validate.ts
# Expected: no output

# Step 5 — viewer config validates
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
import { ViewerConfigSchema } from './packages/registry/dist/index.js';
const config = JSON.parse(await readFile('apps/registry-viewer/public/registry-config.json', 'utf8'));
ViewerConfigSchema.parse(config);
console.log('viewer config: OK');
"
# Expected: "viewer config: OK"

# Step 6 — all shipped themes validate (count may drift; fail must be 0)
node --input-type=module -e "
import { readdir, readFile } from 'node:fs/promises';
import { ThemeDefinitionSchema } from './packages/registry/dist/index.js';
const dir = 'content/themes';
const files = (await readdir(dir)).filter(f =>
  f.endsWith('.json') && !f.startsWith('index') && !f.startsWith('00-') && !f.startsWith('01-')
);
let ok = 0, fail = 0;
for (const file of files) {
  const data = JSON.parse(await readFile(dir + '/' + file, 'utf8'));
  const result = ThemeDefinitionSchema.safeParse(data);
  if (result.success) ok++;
  else { fail++; console.error(file, result.error.issues[0]); }
}
console.log('themes ok:', ok, 'fail:', fail);
"
# Expected: 'themes ok: N fail: 0' where N matches the content/themes/ count
# at pre-flight (69 at 2026-04-21; re-derive at execution; aggregate files
# 00-*.json / 01-*.json / index.json excluded per EC-055 §D.8 precedent)

# Step 6.5 — (A-083-04) themeSchemaVersion narrowing safety check
grep -rn "themeSchemaVersion" apps/registry-viewer/src/
# Expected before Commit A: exactly one hit at apps/registry-viewer/src/lib/themeClient.ts:35
#   (the inline interface being deleted).
# Expected after Commit A: zero hits (inline interface removed; registry
#   package's inferred ThemeDefinition narrows the field to z.literal(2) —
#   safe because viewer reads but never writes the field).
# If any hit appears outside themeClient.ts's deleted inline interface, STOP
# and audit the consumer — a number-typed arithmetic or comparison on the
# field would break after the type narrows to literal(2).

# Step 6.6 — (A-083-04) new ./theme.schema subpath resolves from viewer
node --input-type=module -e "
import { ThemeDefinitionSchema } from '@legendary-arena/registry/theme.schema';
console.log('theme subpath resolves:', typeof ThemeDefinitionSchema);
" 2>&1 | head -n 5
# Expected: 'theme subpath resolves: object' (Zod schemas are objects)
# If the import resolves to undefined or throws an export-not-found error,
# the package.json exports field was not updated correctly — revisit §G.

# Step 6.7 — (A-083-04) no barrel imports of registry in the two retrofitted clients
grep -nE "from ['\"]@legendary-arena/registry['\"]" \
  apps/registry-viewer/src/lib/registryClient.ts \
  apps/registry-viewer/src/lib/themeClient.ts
# Expected: no output. Both files import from the narrow subpaths only.

# Step 7 — inline interfaces removed from clients
grep -cE "^(export )?interface (RegistryConfig|ThemeDefinition|ThemeSetupIntent|ThemePlayerCount|ThemePrimaryStoryReference)" \
  apps/registry-viewer/src/lib/registryClient.ts \
  apps/registry-viewer/src/lib/themeClient.ts
# Expected: 0

# Step 8 — safeParse present in both clients; .parse( absent at fetch
# boundary
grep -c "safeParse" apps/registry-viewer/src/lib/registryClient.ts
# Expected: 1

grep -c "safeParse" apps/registry-viewer/src/lib/themeClient.ts
# Expected: 2 (one for index, one per theme)

grep -cE "\.parse\(" apps/registry-viewer/src/lib/registryClient.ts \
                     apps/registry-viewer/src/lib/themeClient.ts
# Expected: 0 — .parse throws unpredictably; .safeParse is the locked path

# Step 9 — dot-joined issue path rendering present
grep -c "issue.path.join" apps/registry-viewer/src/lib/registryClient.ts
# Expected: >= 1

grep -c "issue.path.join" apps/registry-viewer/src/lib/themeClient.ts
# Expected: >= 2 (index branch + per-theme branch, or one shared helper)

# Step 10 — full-sentence error prefixes present
grep -cE "\[RegistryConfig\] Rejected" apps/registry-viewer/src/lib/registryClient.ts
# Expected: >= 1

grep -cE "\[Themes\] Rejected" apps/registry-viewer/src/lib/themeClient.ts
# Expected: >= 2

# Step 11 — no game engine / boardgame.io / preplan / server / pg imports
grep -rE "from ['\"](@legendary-arena/(game-engine|preplan|server)|boardgame\.io|pg)" \
  apps/registry-viewer/src/lib/registryClient.ts \
  apps/registry-viewer/src/lib/themeClient.ts \
  packages/registry/src/schema.ts \
  packages/registry/src/index.ts
# Expected: no output

# Step 12 — scope enforcement
git diff --name-only
# Expected: only files listed in §"Files Expected to Change"

# Step 13 — manual smoke (happy path)
#   pnpm --filter registry-viewer dev
#   Confirm: cards load, themes load, no console warnings about validation
#
# Step 14 — manual negative tests (scratch branch only; not production)
#   (a) Temporarily set metadataBaseUrl = 123 (number) in registry-config.json,
#       reload dev server: expect thrown Error in the browser console with
#       "[RegistryConfig] Rejected ... at path 'metadataBaseUrl': ...". Revert.
#   (b) Temporarily add an unknown field (e.g., "xyz": 1) to registry-config.json:
#       expect thrown Error naming the unrecognized key (.strict() catches it).
#       Revert.
#   (c) Temporarily corrupt one theme file (delete its 'name' field), reload:
#       expect one console.warn with "[Themes] Rejected <FILE> from <URL>
#       at path 'name': ..."; confirm the theme is absent from the Themes
#       tab but other themes still render; revert.
#   (d) Temporarily serve an invalid themes/index.json entry (e.g., [42]):
#       expect thrown Error with "[Themes] Rejected themes/index.json ...".
#       Revert.
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm -r --if-present test` exits 0 with baseline passing count
      preserved
- [ ] All shipped themes in `content/themes/` validate against
      `ThemeDefinitionSchema` (verification Step 6, fail = 0)
- [ ] `apps/registry-viewer/public/registry-config.json` validates against
      `ViewerConfigSchema` (verification Step 5)
- [ ] Manual smoke (happy path): dev server loads cards and themes with no
      validation warnings
- [ ] Manual smoke (negative paths): scratch-branch tests (Step 14 a–d)
      confirm throw (config, unknown key, index) and warn + skip (individual
      theme) behaviors
- [ ] No files outside §"Files Expected to Change" were modified (confirmed
      with `git diff --name-only`)
- [ ] `packages/registry/src/theme.schema.ts` and
      `packages/registry/src/theme.validate.ts` both show empty `git diff`
- [ ] `docs/ai/DECISIONS.md` updated with D-083A–D-083D (final IDs allocated
      at governance-close)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-083 flipped `[ ]` → `[x]`
      with date + Commit A hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has the allocated EC
      (EC-108) flipped to `Done`
- [ ] `apps/registry-viewer/CLAUDE.md` updated
- [ ] Three-commit topology followed: A0 `SPEC:` pre-flight bundle → A
      `EC-108:` execution → B `SPEC:` governance close (commit prefix
      `WP-083:` is forbidden per P6-36)
