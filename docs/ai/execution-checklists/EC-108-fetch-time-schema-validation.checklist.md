# EC-108 — Fetch-Time Schema Validation for Registry-Viewer Clients (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` (amendment A-083-04 landed 2026-04-21 at A0 SPEC)
**Layer:** Registry (`packages/registry/src/schema.ts` + `packages/registry/src/index.ts` + `packages/registry/package.json`) +
Registry Viewer (`apps/registry-viewer/src/lib/**`) — **no engine, preplan, server, pg,
or boardgame.io**

## Execution Authority

This EC is the authoritative execution checklist for WP-083. Compliance is binary.
Failure to satisfy any item is failed execution. If EC-108 and WP-083 conflict on
**design intent**, the WP wins; on **execution contract** (locked values, guardrails,
pre-flight findings, staging discipline), the EC wins.

**EC slot note:** EC-108 is the next free slot after EC-107 (WP-082) in the
registry-viewer 101+ series. Commit prefix is `EC-108:`; `WP-083:` is rejected by
`.githooks/commit-msg` per P6-36.

## Execution Style

Validation retrofit. Add two genuinely new schemas at the registry boundary
(`ViewerConfigSchema`, `ThemeIndexSchema`); reuse the pre-existing theme schemas
already shipped by EC-055 (`ThemeDefinitionSchema` et al.) by importing them into
the viewer rather than redefining them; wire Zod `.safeParse(...)` into two viewer
fetchers (`registryClient.ts` + `themeClient.ts`); delete the local TS-interface
casts; log full-sentence diagnostics on validation failure. Zero engine / preplan
/ server / pg / boardgame.io involvement. Zero `G` mutation. Zero JSON content
changes. Zero R2 uploads.

---

## Pre-Flight STOP Gates (Reality Reconciliation — Critical)

**WP-083 as written assumes the theme schemas do not exist. They do.**
Before proceeding, one of two paths must be chosen, recorded in WP-083 §Amendments,
and landed in the A0 SPEC bundle:

### Finding 1 — Theme schemas already exist

At HEAD, `packages/registry/src/theme.schema.ts` (127 lines, authored by EC-055)
exports:

- `ThemeDefinitionSchema`
- `ThemeSetupIntentSchema`
- `ThemePlayerCountSchema` (with two `.refine(...)` invariants WP-083 omits)
- `ThemePrimaryStoryReferenceSchema`
- `ThemeMusicAssetsSchema` (not mentioned in WP-083 at all)
- Inferred type `ThemeDefinition`

All six are already re-exported from `packages/registry/src/index.ts` at lines
38–48. The viewer can import them today.

### Finding 2 — Shape divergence from WP-083

| Field / Attribute                      | WP-083 §A specifies                   | `theme.schema.ts` at HEAD                |
|----------------------------------------|---------------------------------------|------------------------------------------|
| `themeSchemaVersion`                   | `z.number().int().positive()`         | `z.literal(2)` (D-5504 version lock)     |
| Schema strictness                      | `.strict()` mandatory                 | **not** `.strict()` on any theme schema  |
| `themeId` regex                        | Unspecified (min(1) only)             | `^[a-z0-9]+(-[a-z0-9]+)*$` kebab lock    |
| `tags`                                 | `z.array(z.string()).optional()`      | `z.array(z.string().min(1)).default([])` |
| `references.primaryStory.externalIndexUrls` | Not in WP-083                    | `z.array(z.string().url()).default([])`  |
| Music fields (`musicTheme`, `musicAIPrompt`, `musicAssets`) | Not in WP-083 | Present, optional, added per D-5509      |

### Finding 3 — Registry rule authority

Per `.claude/rules/registry.md` §"Immutable Files (from WP-003)" and §"Schema
Authority": `schema.ts` and `theme.schema.ts` "must not be modified without
strong reason and a `DECISIONS.md` entry." **Overwriting `theme.schema.ts` to
match WP-083's shape would regress D-5504 (version-lock) and D-5509 (music
additions).**

### Required Reconciliation — Path A (recommended)

Amend WP-083 at pre-flight (amendments `A-083-01` through `A-083-04` landed in
Commit A0 SPEC bundle before execution) to:

- **Drop** all theme-schema additions from §A. `ThemeDefinitionSchema`,
  `ThemeSetupIntentSchema`, `ThemePlayerCountSchema`,
  `ThemePrimaryStoryReferenceSchema` are **reused verbatim** from
  `theme.schema.ts`. No schema body edit.
- **Keep** only the two genuinely new schemas: `ViewerConfigSchema` and
  `ThemeIndexSchema`. These go in `packages/registry/src/schema.ts` (the
  non-theme schema file) or in a new `viewerConfig.schema.ts` / `themeIndex.schema.ts`
  if the author prefers file-level separation. EC-108 locks **schema.ts**
  (co-located with the existing general schemas) to minimize churn.
- **Drop** `.strict()` from the "all six schemas are `.strict()`" invariant.
  `.strict()` applies only to the two new schemas WP-083 actually authors
  (`ViewerConfigSchema`, `ThemeIndexSchema`). Theme schemas remain as-is.
- **Drop** the §C re-export update for theme schemas — they are already
  re-exported. The §C change adds only `ViewerConfigSchema`, `ThemeIndexSchema`,
  and their two inferred types.
- **Delete the viewer's local `ThemeDefinition` interface** at `themeClient.ts:34–47`
  and import the already-exported `ThemeDefinition` type from the new
  `@legendary-arena/registry/theme.schema` subpath (A-083-04 addition — the
  barrel import would regress the browser build per the EC-107 /
  `glossaryClient.ts:20–28` precedent). This is a genuine win from this packet
  (unifies the type across registry + viewer) and was the WP's core intent.
- **(A-083-04)** Add `./theme.schema` subpath to
  `packages/registry/package.json` `exports` field so the viewer can import
  `ThemeDefinitionSchema` + `ThemeDefinition` without pulling Node-only
  `createRegistryFromLocalFiles` into the Rollup graph. Exact JSON delta
  locked in §Locked Values below.

### Required Reconciliation — Path B (rejected; documented for audit)

Redefining theme schemas to WP-083's specification would:

- Violate D-5504 (`themeSchemaVersion` version-lock semantics lost)
- Violate D-5509 (music fields dropped)
- Strand the 68 `content/themes/*.json` files with unresolved `.refine(...)`
  invariants that currently guarantee `min <= max` and `recommended ⊂ [min,max]`
- Require a new `DECISIONS.md` entry overruling D-5504 + D-5509 + an EC-055
  governance re-open

Path B is **rejected** unless a human approver explicitly signs off with a new
decision entry. EC-108 locks Path A.

### STOP gate (binary)

- [ ] **WP-083 amended per Path A** (A-083-01 drops theme schema additions;
      A-083-02 removes `.strict()` universal invariant; A-083-03 corrects §A
      field definitions to reference `theme.schema.ts` as-is; **A-083-04**
      adds `./theme.schema` subpath export and locks exact import lines for
      both retrofitted clients)
- [ ] **If any amendment has not landed in A0 SPEC bundle, STOP.** Do not begin
      execution.

---

## Before Starting (Preconditions — Blocking)

Each is a pass/fail gate.

- [ ] WP-082 / EC-107 complete (glossary-side validation landed). If WP-082 has
      not landed, `rulebookPdfUrl` is still absent from `registry-config.json`;
      this is fine because EC-108 makes `rulebookPdfUrl` optional in
      `ViewerConfigSchema` — WP-082 and WP-083 are order-independent by design.
- [ ] HEAD is at a clean point on branch `wp-083-fetch-time-schema-validation`
      cut from current `main`, OR on `wp-036-ai-playtesting` after EC-036
      governance closes cleanly (re-verify at pre-flight time).
- [ ] `packages/registry/src/schema.ts` exists and imports `zod` at line 29
      (the same pattern EC-107 extended for `KeywordGlossarySchema`).
- [ ] `packages/registry/src/theme.schema.ts` exists at HEAD with all five
      theme schemas unmodified (the pre-flight finding above).
- [ ] `packages/registry/src/index.ts` at HEAD re-exports general schemas at
      lines ~30–40 (10 names: `SetDataSchema`, `SetIndexEntrySchema`,
      `HeroCardSchema`, `HeroClassSchema`, `CardQuerySchema`, plus
      `KeywordGlossaryEntrySchema`, `KeywordGlossarySchema`,
      `RuleGlossaryEntrySchema`, `RuleGlossarySchema` — added by EC-107 —
      and their inferred types) and re-exports theme schemas at lines ~47–57
      (inferred `ThemeDefinition` type at line 48; five schemas at lines
      51–57; validators at line 60). **Only the general block is extended**
      by EC-108 — gains `ViewerConfigSchema` + `ThemeIndexSchema` + two
      inferred types. **Theme block at lines 47–57 is not modified** (theme
      schemas already exported). Line numbers are approximate; re-derive at
      execution time via `grep -n "export" packages/registry/src/index.ts`.
- [ ] `packages/registry/package.json` `exports` field at HEAD has exactly
      two entries: `.` (barrel) and `./schema` (Zod-only, from A-082-01).
      **A-083-04 adds a third entry `"./theme.schema"`** pointing at
      `./dist/theme.schema.js` + `./dist/theme.schema.d.ts`. Exact JSON
      delta locked in §Locked Values.
- [ ] `apps/registry-viewer/src/lib/registryClient.ts` at HEAD has the inline
      `RegistryConfig` interface (lines 5–8) and the unvalidated
      `await res.json()` parse (line 20).
- [ ] `apps/registry-viewer/src/lib/themeClient.ts` at HEAD has the inline
      `ThemeDefinition`, `ThemeSetupIntent`, `ThemePlayerCount`, and
      `ThemePrimaryStoryReference` interfaces (lines 10–47) and unvalidated
      JSON parses at lines 70 (`index.json`) and 79 (individual theme).
      **Deleting the four local interfaces is in scope even though their
      registry-package counterparts have a slightly different shape** — see
      §Locked Values "theme type compatibility" below.
- [ ] `apps/registry-viewer/public/registry-config.json` contains `metadataBaseUrl`
      and `eagerLoad` at HEAD. If WP-082 has landed, `rulebookPdfUrl` is also
      present; if not, it is absent. Either state parses against
      `ViewerConfigSchema` (both fields optional or present as URL strings).
- [ ] `content/themes/` contains the 68 hand-authored theme files **plus**
      any `content/themes/heroes/` subdirectory work currently dirty in the
      working tree (flag at pre-flight; do not fold unrelated theme authoring
      into this packet).
- [ ] `pnpm -r build` exits 0 at the pre-flight commit.
- [ ] `pnpm -r --if-present test` exits 0 at the pre-flight commit. Baseline
      passing count is **re-derived at pre-flight** (not assumed from prior ECs)
      and recorded in the session-context file.

If any precondition fails, STOP and ask before proceeding.

---

## Locked Values (Do Not Re-Derive)

### `ViewerConfigSchema` — exact shape

Append to `packages/registry/src/schema.ts` after the existing general schemas
(preserve existing export order per WP-083 §A ordering promise):

```ts
// ── Registry-viewer public config (apps/registry-viewer/public/registry-config.json) ──
// why: distinct from RegistryConfigSchema (R2 set-abbreviation artifact).
// Object shape consumed by the viewer at boot to locate metadata and optional
// rulebook PDF. rulebookPdfUrl is optional so WP-082 can add it before, after,
// or alongside EC-108 without schema churn.
export const ViewerConfigSchema = z
  .object({
    metadataBaseUrl: z.string().url(),
    eagerLoad: z.array(z.string().min(2).max(10)).optional(),
    rulebookPdfUrl: z.string().url().optional(),
  })
  .strict();

export type ViewerConfig = z.infer<typeof ViewerConfigSchema>;
```

`.strict()` is mandatory. The viewer config is a hard dependency; unknown
fields must surface at validation time, not paper over a typo silently.

### `ThemeIndexSchema` — exact shape

Append to `packages/registry/src/schema.ts`:

```ts
// ── Themes directory index (R2 /themes/index.json) ────────────────────────────
// why: root manifest of theme filenames; if malformed, the Themes subsystem
// is considered unavailable and must fail fast. Individual theme failures are
// non-fatal (warn + skip) because one bad theme must not hide the rest.
export const ThemeIndexSchema = z.array(z.string().regex(/\.json$/, "theme index entries must end in .json"));

export type ThemeIndex = z.infer<typeof ThemeIndexSchema>;
```

Per WP-083 §A guidance: the regex asserts each entry ends in `.json` so a
rogue `README.md` or `.DS_Store` leak surfaces at validation, not at fetch
time.

### `packages/registry/package.json` subpath addition — exact JSON (A-083-04)

Add a third subpath entry to the `exports` field. The existing `.` (barrel)
and `./schema` entries are preserved byte-for-byte.

**Before (HEAD at pre-flight — verify verbatim):**

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

**Locked invariants:**

- Only the `exports` field is modified; `name`, `version`, `description`,
  `type`, `main`, `types`, `files`, `scripts`, `dependencies`,
  `devDependencies` are all preserved byte-for-byte.
- `tsconfig.build.json` is NOT modified — `tsc -p tsconfig.build.json` already
  emits `dist/theme.schema.js` + `dist/theme.schema.d.ts` from
  `src/theme.schema.ts`. Verify via `ls packages/registry/dist/` after
  `pnpm --filter @legendary-arena/registry build`.
- The `.` (barrel) entry remains for CLI consumers (`validate.ts`,
  `upload-r2.ts`) that legitimately need `createRegistryFromLocalFiles`. No
  server-side consumer is affected.
- No `pnpm-lock.yaml` change is required (additive `exports` entry in an
  already-linked workspace package).

### `RegistryConfigSchema` comment update — exact text

The existing schema body at `schema.ts:33` is preserved **byte-for-byte**.
Only the adjacent comment is edited.

**Before (HEAD at pre-flight — verify verbatim):**

```
// ── Registry config (registry-config.json at R2 root) ─────────────────────────
// Simple array of set abbreviation strings. Not a source file — R2 artifact only.
```

**After:**

```
// ── Registry set-abbreviation list (R2 /registry-config.json artifact) ────────
// Simple array of set abbreviation strings. R2 artifact only — not the viewer's
// public config. For the viewer's public/registry-config.json (object shape with
// metadataBaseUrl, eagerLoad, rulebookPdfUrl), see ViewerConfigSchema below.
```

`export const RegistryConfigSchema = z.array(z.string().min(2).max(10));` is
**untouched**. A `git diff` of the schema body line must show zero change.

### `packages/registry/src/index.ts` — exact re-export delta

Extend the existing block at lines 30–36 (general schemas) to include the two
new schemas and their inferred types. **The theme block at lines 42–48 is NOT
modified.**

```ts
// Schema (for external validation use)
export {
  SetDataSchema,
  SetIndexEntrySchema,
  HeroCardSchema,
  HeroClassSchema,
  CardQuerySchema,
  ViewerConfigSchema,
  ThemeIndexSchema,
} from "./schema.js";

export type {
  ViewerConfig,
  ThemeIndex,
} from "./schema.js";
```

No `export *`. No barrel re-export. Explicit named re-export only, matching
the style extended in EC-107 for the glossary schemas.

### Zod error rendering — exact shape (mirrors EC-107 §"Zod validation")

Issue-path rendering is locked to:

```ts
const result = ViewerConfigSchema.safeParse(rawPayload);
if (!result.success) {
  const issue = result.error.issues[0];
  const path  = issue.path.length > 0 ? issue.path.join(".") : "root";
  // why: dot-joined path keeps viewer logs operator-readable without
  // Zod fluency; default ["eagerLoad","0"]-style array paths are noisy.
  // First issue only — additional issues suppressed so operator logs stay
  // scannable, per WP-083 §"Zod error reporting" lock.
  throw new Error(
    `[RegistryConfig] Rejected registry-config.json from ${url}: ${path} — ${issue.message}. ` +
    `Viewer cannot boot with an invalid config; fix the file and redeploy.`,
  );
}
const config = result.data;
```

The analogous theme-index case:

```ts
const indexResult = ThemeIndexSchema.safeParse(rawIndex);
if (!indexResult.success) {
  const issue = indexResult.error.issues[0];
  const path  = issue.path.length > 0 ? issue.path.join(".") : "root";
  throw new Error(
    `[Themes] Rejected themes/index.json from ${indexUrl}: ${path} — ${issue.message}. ` +
    `The Themes tab cannot populate without a valid index.`,
  );
}
```

The analogous individual-theme case (non-fatal, warn + skip):

```ts
const themeResult = ThemeDefinitionSchema.safeParse(rawTheme);
if (!themeResult.success) {
  const issue = themeResult.error.issues[0];
  const path  = issue.path.length > 0 ? issue.path.join(".") : "root";
  console.warn(
    `[Themes] Rejected ${filename} from ${themeUrl}: ${path} — ${issue.message}. ` +
    `Theme skipped; Themes tab will not show it.`,
  );
  return null;
}
return themeResult.data;
```

Locked invariants across all three:

- Prefix with `[RegistryConfig]` / `[Themes]` category tag
- Name the filename
- Include the URL
- Include dot-joined path or `root`
- Include `issue.message`
- End with a full-sentence operator-facing hint about resulting state
- Report **first issue only** — no `.format()` dumps, no multi-issue arrays
- `registryClient.ts` and `themeClient.ts` **index path** throw `Error`;
  individual-theme path uses `console.warn(...)` + `return null` (the
  `Promise.allSettled` null-filter loop at `themeClient.ts:72–87` already
  drops nulls cleanly — no new filtering required)

### `registryClient.ts` — exact edits (A-083-04 lock)

**Exact import line (must appear verbatim):**

```ts
import { ViewerConfigSchema, type ViewerConfig } from "@legendary-arena/registry/schema";
```

Barrel imports (`from "@legendary-arena/registry"`) are **forbidden** in this
file — they would re-introduce the browser-build failure documented at
`glossaryClient.ts:20–28` by pulling Node-only `createRegistryFromLocalFiles`
into the Rollup import graph.

The pre-existing `import { createRegistryFromHttp } from "../registry/browser";`
and `import type { CardRegistry } from "../registry/browser";` (lines 1–2 at
HEAD) are **not modified** — the viewer's local `registry/browser.ts` entry
point is a known architectural smell (EC-108 §Out of Scope) but out of scope
for this packet.

**Edit sequence:**

- Add the `import { ViewerConfigSchema, type ViewerConfig } from "@legendary-arena/registry/schema";`
  line alongside the existing imports (top of file).
- **Delete** the inline `interface RegistryConfig { ... }` block at lines 5–8.
- After `const rawPayload = await res.json();` (currently line 20 area — the
  variable name is `config` at HEAD; rename to `rawPayload` as part of this
  edit to distinguish the pre-validation raw value from the validated result),
  call `ViewerConfigSchema.safeParse(rawPayload)` and handle per the
  "Zod error rendering" lock above.
- On success: read `result.data.metadataBaseUrl` (and other fields). Re-bind
  to the name `config` if preferred for downstream readability, or inline
  `result.data.metadataBaseUrl` directly.
- The existing `throw new Error(...)` on HTTP failure at line 19 is preserved;
  the new validation throw is added **after** the `res.json()` call, not merged
  into the HTTP error path.

### `themeClient.ts` — exact edits (A-083-04 lock)

**Exact import lines (both must appear verbatim, split across the two
subpaths per A-083-04):**

```ts
import { ThemeIndexSchema } from "@legendary-arena/registry/schema";
import { ThemeDefinitionSchema, type ThemeDefinition } from "@legendary-arena/registry/theme.schema";
```

Barrel imports (`from "@legendary-arena/registry"`) are **forbidden** in this
file for the same browser-build reason as `registryClient.ts`. The split
between `./schema` (for `ThemeIndexSchema` — lives in `src/schema.ts` per
WP-083 §A) and `./theme.schema` (for `ThemeDefinitionSchema` + `ThemeDefinition`
— live in `src/theme.schema.ts`, locked by D-5504 / D-5509 / EC-055) is
deliberate and matches the file-level separation of the two schema authorities.

**Edit sequence:**

- Add the two import lines at the top of the file alongside the existing
  `import { devLog } from "./devLog";`.
- **Delete** the four inline interfaces at lines 12–47 (at HEAD):
  `ThemeSetupIntent`, `ThemePlayerCount`, `ThemePrimaryStoryReference`, and
  `ThemeDefinition`. Re-derive exact ranges via `grep -n "^export interface"
  apps/registry-viewer/src/lib/themeClient.ts` before deleting.
- Validate `themes/index.json` after `await indexResponse.json()` per the
  "Zod error rendering" lock (throw on failure).
- Validate each individual theme after `await themeResponse.json()` per the
  locked pattern (warn + skip on failure).
- Preserve the `Promise.allSettled` + null-filter loop at lines 72–87
  **byte-for-byte modulo the one-line type annotation change** — only the
  return-value shape inside the inner `map(...)` changes (`ThemeDefinition |
  null` instead of the locally-typed equivalent; the `ThemeDefinition` type
  is now imported from `@legendary-arena/registry/theme.schema`).
- Preserve the existing sort-by-name tail and any `devLog("theme", ...)`
  instrumentation verbatim.

### Theme type compatibility — critical

The viewer's **local** `ThemeDefinition` interface at `themeClient.ts:34–47`
is a simpler, hand-authored TS interface. The registry package's
`ThemeDefinition` (inferred from `ThemeDefinitionSchema` in `theme.schema.ts`)
is **wider and stricter**:

- Adds optional fields the viewer's interface omits (`musicTheme`,
  `musicAIPrompt`, `musicAssets`, `tags.default([])`, etc.)
- Narrows `themeSchemaVersion` to `z.literal(2)` (the viewer's interface had
  it as `number`)
- Applies refinements (`min <= max`, `recommended ⊂ [min,max]`) the viewer
  never enforced

**At compile time:** replacing the viewer's local interface with the registry
package's inferred type **strictly widens the compile-time surface** —
every existing consumer of `ThemeDefinition` already receives the same fields
and more. Downstream TS code that reads `theme.name`, `theme.description`,
`theme.setupIntent`, `theme.playerCount`, `theme.references?.primaryStory`,
`theme.flavorText`, `theme.comicImageUrl` keeps working. New fields
(`musicAssets` etc.) are optional; the viewer can ignore them.

**At runtime:** the 68 real theme files on R2 were authored against
`ThemeDefinitionSchema` by EC-055 and already validate. `themeSchemaVersion`
is `2` in every file; the `z.literal(2)` gate passes.

### Commit prefix

`EC-108:` on the execution commit (A). `SPEC:` on pre-flight bundle (A0) and
governance close (B). `WP-083:` is **forbidden** — the commit-msg hook at
`.githooks/commit-msg` rejects it per P6-36. Subject lines containing `WIP`
/ `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff` are also
rejected. Subject must be ≥ 12 characters of substantive summary.

### Three-commit topology

1. **A0 `SPEC:`** — pre-flight bundle: EC-108 file + `EC_INDEX.md` row +
   `WORK_INDEX.md` row + WP-083 amendments A-083-01 through **A-083-04**
   (theme schema scope reconciliation + `./theme.schema` subpath authorization)
   + session-context file + pre-flight verdict (v2 after A-083-04) + copilot
   check (v2) + session prompt. Lands before any viewer / schema / package.json
   edit.
2. **A `EC-108:`** — execution: `schema.ts` (two new schemas + one comment
   edit) + `index.ts` (two new named exports + two new type exports) +
   **`packages/registry/package.json` (`./theme.schema` subpath entry, A-083-04)**
   + `registryClient.ts` (validation retrofit with `./schema` subpath import) +
   `themeClient.ts` (validation retrofit with split `./schema` + `./theme.schema`
   subpath imports) + `apps/registry-viewer/CLAUDE.md` update +
   `docs/03.1-DATA-SOURCES.md` update (if applicable).
3. **B `SPEC:`** — governance close: `STATUS.md` (if exists) + `WORK_INDEX.md`
   (flip WP-083 `[ ]` → `[x]` with date + Commit A hash) + `EC_INDEX.md`
   (EC-108 → `Done`) + `DECISIONS.md` entries per WP-083 §Governance
   (D-083A–D-083**E**; D-083E added by A-083-04).

### 01.6 post-mortem disposition

Evaluate each trigger explicitly:

- **New long-lived abstraction?** `ViewerConfigSchema` and `ThemeIndexSchema`
  are **new instances of an existing abstraction** (Zod schemas in the
  registry package — `SetIndexEntrySchema`, `HeroCardSchema`,
  `ThemeDefinitionSchema`, `KeywordGlossarySchema`, etc. already follow this
  pattern). Not triggered.
- **New code category?** No — `packages/registry/src/schema.ts` and the
  viewer `src/lib/` directory are pre-classified.
- **New contract consumed by engine / other packages?** No — the two new
  schemas are consumed only by the viewer. Engine, server, preplan,
  arena-client, replay-producer do not import them.
- **New setup artifact in `G`?** No — zero engine involvement.
- **Novel keyboard / interaction pattern?** No — pure validation retrofit.

**Disposition: NOT TRIGGERED. 01.6 post-mortem is NOT required.** Matches
EC-106 precedent (glossary data migration class) and EC-107 (glossary
schema/label class). If execution surfaces a finding that would trigger a
post-mortem (e.g., the theme type widening cascades into a cross-layer TS
break that requires a new abstraction to paper over), re-evaluate and author
one.

### 01.5 runtime-wiring allowance

**NOT INVOKED.** No `LegendaryGameState` field added, no `buildInitialGameState`
change, no `LegendaryGame.moves` entry, no phase hook. The viewer analog is
also not invoked — the `GlossaryEntry` shape is unchanged, and
`themeClient.ts` already has its `ThemeDefinition` consumer path in place.

---

## Guardrails (Non-Negotiable)

- **No imports from `packages/game-engine/`, `packages/preplan/`,
  `apps/server/`, `pg`, or `boardgame.io`** in any changed file. Registry +
  Viewer layers only.
- **No modification of `packages/registry/src/theme.schema.ts`.** The five
  theme schemas + `ThemeDefinition` type are reused as-is. A `git diff` of
  `theme.schema.ts` must be empty.
- **No modification of `packages/registry/src/theme.validate.ts`.** The
  offline validator path is orthogonal to fetch-time validation.
- **`RegistryConfigSchema` schema body is preserved byte-for-byte.** Only the
  adjacent comment is edited. A `git diff` of that `export const` line must
  be empty.
- **`.strict()` is mandatory** on `ViewerConfigSchema` only. Not added to
  `ThemeIndexSchema` (an array schema — `.strict()` is meaningless there);
  not added to the theme schemas (would break D-5509 additive music fields).
- **No `.parse(...)` at the fetch boundary** — `.safeParse(...)` for both
  fatal-throw and warn+skip paths. The fatal paths raise `throw new Error(...)`
  **after** `safeParse` returns; they do not use `.parse()`'s automatic throw.
- **No new Zod schemas for auxiliary metadata** (`CardTypeEntrySchema`,
  `HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`,
  `LeadsEntrySchema`). They are untouched — wiring them to a fetcher is
  future-WP scope per WP-083 §Out of Scope.
- **No content changes** to `public/registry-config.json`, `content/themes/*.json`,
  or any R2 artifact. This packet validates existing shapes; it does not
  modify data.
- **No refactoring or stylistic cleanup** in the two retrofitted clients
  beyond the validation wiring. Existing sort / `devLog` / `Promise.allSettled`
  logic is preserved verbatim.
- **No `import *` or barrel re-exports** anywhere.
- **No new dependencies.** `zod` is already a dependency of both
  `packages/registry` and `apps/registry-viewer`.
- **No staging of out-of-scope dirty-tree items.** The WP-083 pre-flight
  session-context file enumerates in-scope vs out-of-scope modified files;
  stage by exact filename only. `git add .` / `git add -A` / `git add -u`
  are forbidden (P6-27 / P6-44).
- **Never use `--no-verify` or `--no-gpg-sign`** — commit-msg hook must pass
  on its merits.
- **Never push to remote** unless explicitly asked.
- **Baseline invariance:** `pnpm -r --if-present test` must exit 0 with the
  pre-flight baseline preserved. No new test file is required by WP-083;
  optional schema-parse tests (if authored) live under
  `packages/registry/src/` mirroring `theme.schema.test.ts` precedent with
  exactly one `describe()` per file.
- **Paraphrase discipline (P6-43 / P6-50):** JSDoc and `// why:` text must
  not reference `G`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io`,
  `ctx.random`, or engine move names. The changed files are registry- and
  viewer-layer only; engine vocabulary is out of scope.

---

## Required `// why:` Comments

- `packages/registry/src/schema.ts` — one `// why:` block above `ViewerConfigSchema`
  explaining it is distinct from `RegistryConfigSchema` and that `rulebookPdfUrl`
  is optional for WP-082 ordering independence (verbatim text in §Locked Values).
- `packages/registry/src/schema.ts` — one `// why:` block above `ThemeIndexSchema`
  explaining the root-manifest rationale and the throw-vs-warn asymmetry.
- `apps/registry-viewer/src/lib/registryClient.ts` — one `// why:` on the
  dot-joined issue-path rendering (verbatim text in §Locked Values).
- `apps/registry-viewer/src/lib/themeClient.ts` — one `// why:` on the
  dot-joined issue-path rendering for the index branch; one `// why:` on the
  individual-theme branch explaining that `console.warn` + `return null`
  preserves the existing `Promise.allSettled` null-filter without new guards.
- Preserve every existing `// why:` comment in both clients verbatim (none
  of the existing rationales are invalidated by this retrofit).

---

## Files to Produce

Exact files. Anything outside this list is out of scope.

- `packages/registry/src/schema.ts` — **modified** — append `ViewerConfigSchema`
  + `ThemeIndexSchema` + two inferred types; update the adjacent comment on
  `RegistryConfigSchema` per §Locked Values (schema body **unchanged**)
- `packages/registry/src/index.ts` — **modified** — extend the existing
  general-schema export block (lines ~30–40 at HEAD; re-derive) with
  `ViewerConfigSchema` + `ThemeIndexSchema`; add a parallel `export type { ... }`
  line for `ViewerConfig` + `ThemeIndex`. **Do not modify the theme export
  block at lines ~47–57.**
- `packages/registry/package.json` — **modified (A-083-04)** — add
  `"./theme.schema"` subpath to the `exports` field per §Locked Values. No
  other field in this file is modified.
- `apps/registry-viewer/src/lib/registryClient.ts` — **modified** — delete
  inline `RegistryConfig` interface; import `ViewerConfigSchema` + `ViewerConfig`;
  call `ViewerConfigSchema.safeParse(...)`; throw full-sentence `Error` on
  validation failure
- `apps/registry-viewer/src/lib/themeClient.ts` — **modified** — delete the
  four inline interfaces (lines 10–47); import `ThemeIndexSchema` +
  `ThemeDefinitionSchema` + `ThemeDefinition` type; validate index (throw on
  failure) and each theme (warn + skip on failure); preserve
  `Promise.allSettled` + null-filter + sort tail verbatim
- `apps/registry-viewer/CLAUDE.md` — **modified** — §"Key Files" notes
  fetch-time Zod validation on `registryClient.ts` + `themeClient.ts`;
  §"Design Patterns" extends the Zod-inferred-types bullet to cover all four
  R2 fetchers (registry, themes, keywords, rules)
- `docs/03.1-DATA-SOURCES.md` — **modified** — add a note on fetch-time
  validation if the existing doc organization supports it; skip if not (lint
  gate §1 satisfied via WORK_INDEX status column per repo convention)
- `docs/ai/DECISIONS.md` — **modified** — four governance entries per WP-083
  §Governance (viewer-side validation mandate; `RegistryConfigSchema` vs
  `ViewerConfigSchema` naming lock; throw vs warn+skip severity policy;
  auxiliary schemas remain offline-only; WP-082 cross-link)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (Commit B) — flip
  WP-083 `[ ]` → `[x]` with date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (Commit A0) —
  add EC-108 row; flipped to `Done` in Commit B
- `docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md`
  — **this file** (lands in Commit A0)

No other files may be modified. In particular:

- `packages/registry/src/theme.schema.ts` — **not touched** (reality finding)
- `packages/registry/src/theme.validate.ts` — **not touched**
- `apps/registry-viewer/src/lib/glossaryClient.ts` — **not touched**
  (WP-082 / EC-107 territory)
- `apps/registry-viewer/public/registry-config.json` — **not touched**
  (content unchanged; schema validates existing shape)
- `content/themes/*.json` — **not touched** (validation happens at fetch,
  not authoring)
- `packages/game-engine/**` / `packages/preplan/**` / `apps/server/**` /
  `apps/arena-client/**` / `apps/replay-producer/**` — **not touched**

---

## Out of Scope (Do NOT Expand)

- **Glossary client validation** — covered by WP-082 / EC-107. This packet
  does NOT modify `glossaryClient.ts`.
- **Viewer's local `src/registry/schema.ts`** — the viewer keeps a duplicate
  of some registry package schemas locally for browser-bundling reasons.
  Deduplicating that is a separate architectural concern; out of scope for
  EC-108.
- **Auxiliary metadata schemas** — `CardTypeEntrySchema`, `HeroClassEntrySchema`,
  `HeroTeamEntrySchema`, `IconEntrySchema`, `LeadsEntrySchema` are untouched.
- **`RegistryConfigSchema` runtime validation** — the existing array-of-strings
  schema is not fetched by any current loader. Wiring it to a new R2 fetcher
  is out of scope.
- **Deleting `card-types-old.json`** — confirmed orphaned at pre-flight but
  deletion is a micro-cleanup, not this WP.
- **Server-side validation** — the server uses `createRegistryFromLocalFiles()`
  which validates via the registry package; no gap exists server-side.
- **Behavioral or content changes** — no JSON file is edited; no URL moves;
  no fetcher is added or renamed. Pure validation retrofit.
- **Theme schema modifications** — the five theme schemas in `theme.schema.ts`
  are locked by D-5504 / D-5509 / EC-055; modifying them would require a
  separate WP with DECISIONS review.
- **`themeSchemaVersion` range validation** — `z.literal(2)` (already in
  place per D-5504) is structural lock. Any future version-allowlist or
  migration path is a new WP when v3 actually ships.
- **New test frameworks.** Any tests use `node:test` only.
- **No staging of any pre-existing untracked file or modified doc outside
  the files listed in §Files to Produce.**

---

## Verification Steps (Run In Order; All Must Pass)

```bash
# 1. Dependencies up to date
pnpm install --frozen-lockfile
# expect: exits 0, pnpm-lock.yaml unchanged

# 2. Typecheck — all packages
pnpm -r --if-present typecheck
# expect: exits 0

# 3. Lint viewer — warning budget inherits EC-107 baseline
pnpm --filter registry-viewer lint
# expect: 0 errors; warnings ≤ post-EC-107 baseline (re-derived at pre-flight)

# 4. Build all
pnpm -r build
# expect: exits 0

# 5. Test baseline preserved
pnpm -r --if-present test
# expect: pre-flight baseline passing / 0 failing (record at pre-flight)

# 6. Two new schemas present and exported
grep -cE "^export const (ViewerConfigSchema|ThemeIndexSchema)" \
  packages/registry/src/schema.ts
# expect: 2

grep -cE "(ViewerConfig|ThemeIndex)(Schema)?" \
  packages/registry/src/index.ts
# expect: >= 4 (two schemas + two inferred types)

grep -c ".strict()" packages/registry/src/schema.ts
# expect: >= 1 new .strict() hit (on ViewerConfigSchema); pre-existing
# .strict() hits unchanged — record pre-flight count and assert delta = +1

# 7. theme.schema.ts untouched
git diff --name-only packages/registry/src/theme.schema.ts
# expect: no output

git diff --name-only packages/registry/src/theme.validate.ts
# expect: no output

# 7.1. (A-083-04) themeSchemaVersion narrowing safety — grep before delete
grep -rn "themeSchemaVersion" apps/registry-viewer/src/
# expect before Commit A: exactly one hit at
#   apps/registry-viewer/src/lib/themeClient.ts:35 (inline interface being deleted).
# expect after Commit A: zero hits.
# If any hit appears outside themeClient.ts's deleted inline interface, STOP
# and audit — the registry package's inferred ThemeDefinition narrows this
# field from `number` to `z.literal(2)`, which is safe for read-only
# consumers but would break number-typed arithmetic or comparisons.

# 7.2. (A-083-04) package.json exports field extended with ./theme.schema
grep -c "\"./theme.schema\"" packages/registry/package.json
# expect: 1

node --input-type=module -e "
import { ThemeDefinitionSchema } from '@legendary-arena/registry/theme.schema';
console.log('theme subpath resolves:', typeof ThemeDefinitionSchema);
" 2>&1 | head -n 5
# expect: 'theme subpath resolves: object' (Zod schemas are objects).
# If 'export not found' or 'resolves: undefined' appears, the package.json
# exports entry was not added correctly — revisit §Locked Values
# "package.json subpath addition".

# 7.3. (A-083-04) no barrel registry imports in retrofitted clients
grep -nE "from ['\"]@legendary-arena/registry['\"]" \
  apps/registry-viewer/src/lib/registryClient.ts \
  apps/registry-viewer/src/lib/themeClient.ts
# expect: no output — both files import from the narrow `./schema` and
# `./theme.schema` subpaths only. A barrel hit would regress the EC-107
# browser-build failure documented at glossaryClient.ts:20–28.

# 8. RegistryConfigSchema body preserved byte-for-byte
grep -A 1 "^export const RegistryConfigSchema" packages/registry/src/schema.ts
# expect: body shows z.array(z.string().min(2).max(10)) exactly as at HEAD

# 9. Viewer config validates
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
import { ViewerConfigSchema } from './packages/registry/dist/index.js';
const config = JSON.parse(await readFile('apps/registry-viewer/public/registry-config.json', 'utf8'));
ViewerConfigSchema.parse(config);
console.log('viewer config: OK');
"
# expect: "viewer config: OK"; no Zod errors

# 10. Themes index fixture validates (skip if no local mirror of R2)
node --input-type=module -e "
import { ThemeIndexSchema } from './packages/registry/dist/index.js';
const probe = ['msis-thanos-endgame.json', 'amwp-ultron-age.json'];
ThemeIndexSchema.parse(probe);
console.log('theme index probe: OK');
"
# expect: "theme index probe: OK"

# 11. All 68 local themes validate against existing ThemeDefinitionSchema
node --input-type=module -e "
import { readdir, readFile } from 'node:fs/promises';
import { ThemeDefinitionSchema } from './packages/registry/dist/index.js';
const dir = 'content/themes';
const files = (await readdir(dir)).filter(f => f.endsWith('.json') && !f.startsWith('index') && !f.startsWith('00-') && !f.startsWith('01-'));
let ok = 0, fail = 0;
for (const file of files) {
  const data = JSON.parse(await readFile(dir + '/' + file, 'utf8'));
  const result = ThemeDefinitionSchema.safeParse(data);
  if (result.success) ok++;
  else { fail++; console.error(file, result.error.issues[0]); }
}
console.log('themes ok:', ok, 'fail:', fail);
"
# expect: 'themes ok: N fail: 0' where N matches the content/themes/ count
# at pre-flight (re-derived; ignore aggregate files 00-*.json, 01-*.json,
# index.json per EC-055 §D.8 precedent)

# 12. Inline interfaces removed from clients
grep -cE "^interface (RegistryConfig|ThemeDefinition|ThemeSetupIntent|ThemePlayerCount|ThemePrimaryStoryReference)" \
  apps/registry-viewer/src/lib/registryClient.ts \
  apps/registry-viewer/src/lib/themeClient.ts
# expect: 0 (all five local interfaces deleted)

# 13. safeParse present in both clients
grep -c "safeParse" apps/registry-viewer/src/lib/registryClient.ts
# expect: 1

grep -c "safeParse" apps/registry-viewer/src/lib/themeClient.ts
# expect: 2 (one for index, one per theme)

# 14. .parse( forbidden at fetch boundary
grep -cE "\.parse\\(" apps/registry-viewer/src/lib/registryClient.ts \
                      apps/registry-viewer/src/lib/themeClient.ts
# expect: 0 — .parse throws unpredictably; .safeParse is the locked path

# 15. Dot-joined issue path rendering present
grep -c "issue.path.join" apps/registry-viewer/src/lib/registryClient.ts
# expect: >= 1

grep -c "issue.path.join" apps/registry-viewer/src/lib/themeClient.ts
# expect: >= 2 (one per validation branch, or one shared helper)

# 16. Full-sentence error prefixes present
grep -cE "\[RegistryConfig\] Rejected" apps/registry-viewer/src/lib/registryClient.ts
# expect: >= 1

grep -cE "\[Themes\] Rejected" apps/registry-viewer/src/lib/themeClient.ts
# expect: >= 2 (one for index branch, one for per-theme branch)

# 17. No engine / preplan / server / pg / boardgame.io imports in changed files
grep -rE "from ['\"](@legendary-arena/(game-engine|preplan|server)|boardgame\\.io|pg)" \
  apps/registry-viewer/src/lib/registryClient.ts \
  apps/registry-viewer/src/lib/themeClient.ts \
  packages/registry/src/schema.ts \
  packages/registry/src/index.ts
# expect: no output

# 18. No Math.random / ctx.random / Date.now in changed files
grep -cE "(Math\\.random|ctx\\.random|Date\\.now)" \
  apps/registry-viewer/src/lib/registryClient.ts \
  apps/registry-viewer/src/lib/themeClient.ts \
  packages/registry/src/schema.ts
# expect: 0

# 19. No .reduce( in changed files (code-style invariant)
grep -cE "\\.reduce\\(" \
  apps/registry-viewer/src/lib/registryClient.ts \
  apps/registry-viewer/src/lib/themeClient.ts \
  packages/registry/src/schema.ts
# expect: 0

# 20. P6-50 paraphrase discipline — no engine vocabulary in JSDoc / comments
grep -cE "(LegendaryGameState|LegendaryGame|boardgame\\.io|ctx\\.random)" \
  packages/registry/src/schema.ts \
  apps/registry-viewer/src/lib/registryClient.ts \
  apps/registry-viewer/src/lib/themeClient.ts
# expect: 0

# 21. CLAUDE.md mentions the retrofit
grep -c "fetch-time" apps/registry-viewer/CLAUDE.md
# expect: >= 1

# 22. Files outside allowlist not modified
git diff --name-only
# expect: only files from §Files to Produce (plus EC_INDEX / WORK_INDEX on
# their respective commits)
```

### Manual DEV smoke test

```bash
pnpm --filter registry-viewer dev
```

- **23a.** Visit `http://localhost:5173/`. Console shows no `[RegistryConfig]
  Rejected ...` or `[Themes] Rejected ...` warnings. Cards load, themes load.
- **23b.** DevTools → Network → confirm `registry-config.json`, `themes/index.json`,
  and individual theme JSONs fetch successfully (HTTP 200). No duplicate fetches.
- **23c.** Open the Themes tab. All 68 themes render with their names. Scroll
  confirms no gaps or "undefined" text.
- **23d.** (Negative test — viewer config) Temporarily edit
  `public/registry-config.json` to set `"metadataBaseUrl": 123` (invalid URL
  / wrong type), reload dev server. Expect a thrown `Error` in the browser
  console whose message starts with `[RegistryConfig] Rejected
  registry-config.json from ...: metadataBaseUrl — Expected string, received
  number. Viewer cannot boot ...`. Revert the edit.
- **23e.** (Negative test — theme index) Temporarily edit R2 or a local proxy
  of `themes/index.json` to `["valid.json", 42]`. Reload. Expect a thrown
  `Error` in the browser console whose message starts with `[Themes]
  Rejected themes/index.json from ...: 1 — Expected string, received
  number.`. Revert.
- **23f.** (Negative test — individual theme) Temporarily corrupt one theme
  file (e.g., delete the `name` field from `msis-thanos-endgame.json` on a
  local R2 mirror), reload. Expect exactly one `console.warn` starting
  `[Themes] Rejected msis-thanos-endgame.json from ...: name — ...`. Confirm:
  - That theme is absent from the Themes tab
  - All 67 other themes still render
  - No exception thrown
  Revert the corruption.
- **23g.** (Negative test — unknown field) Temporarily add `"xyz": 1` to
  `public/registry-config.json`. Reload. Expect a thrown `Error` mentioning
  an unrecognized key (`.strict()` catches this). Revert.
- **23h.** (Configuration-absence test — if WP-082 has not yet landed)
  Confirm the viewer still boots when `rulebookPdfUrl` is absent from
  `registry-config.json`. No warning, no broken UI (the field is optional in
  `ViewerConfigSchema`).

### Manual PROD smoke test

```bash
pnpm --filter registry-viewer build
pnpm --filter registry-viewer preview
```

- **24a.** Visit `http://localhost:4173/`. Repeat 23a–23c against the production
  bundle. All must pass.
- **24b.** DevTools → Network → confirm the production bundle makes the same
  three categories of fetch (registry-config, themes-index, individual-themes)
  with no duplicates and no validation warnings.

---

## After Completing

- [ ] Verification steps 1–22 all pass
- [ ] Manual DEV smoke (23a–23h) passes
- [ ] Manual PROD smoke (24a–24b) passes
- [ ] Test baseline preserved (record pre-flight vs post-execution in the
      execution summary; no regression)
- [ ] No file outside §Files to Produce modified (`git diff --name-only`)
- [ ] All `// why:` comments from §Required Comments present
- [ ] All existing `// why:` comments in both clients preserved verbatim
- [ ] `packages/registry/src/theme.schema.ts` and `theme.validate.ts` both
      show empty `git diff`
- [ ] `RegistryConfigSchema` body byte-for-byte unchanged (verification step 8)
- [ ] Three-commit topology: A0 `SPEC:` → A `EC-108:` → B `SPEC:` all landed
      with hook-compliant subjects (no `--no-verify`)
- [ ] `EC_INDEX.md` has EC-108 flipped to `Done` in Commit B
- [ ] `WORK_INDEX.md` has WP-083 `[ ]` → `[x]` with date + Commit A hash in
      Commit B
- [ ] `docs/ai/DECISIONS.md` has the four WP-083 §Governance entries recorded
      (viewer validation mandate; naming distinction; severity policy;
      auxiliary-schemas remain offline; WP-082 cross-link)
- [ ] `apps/registry-viewer/CLAUDE.md` updated with the fetch-time validation
      note for both clients
- [ ] WP-083 §Amendments carries A-083-01 / A-083-02 / A-083-03 (theme schema
      reality reconciliation) with Commit A0 hash references
- [ ] None of the out-of-scope inherited dirty-tree items staged or committed

---

## Common Failure Smells

- **`pnpm -r build` fails with `Cannot find name 'ViewerConfig'`** in the
  viewer. The registry package was not rebuilt before the viewer build. Run
  `pnpm --filter @legendary-arena/registry build` first, or rely on
  `pnpm -r build` which handles the topology.
- **`pnpm -r build` fails with `Property 'musicAssets' does not exist on
  type 'ThemeDefinition'`** at a downstream viewer call site. The viewer was
  reading fields under the assumption of the old narrower local interface.
  Fix by adding `theme.musicAssets?.xyz` optional-chaining; **do not**
  reintroduce a local `ThemeDefinition` interface.
- **`[Themes] Rejected` fires for a valid theme file.** The schema is
  stricter than the data — except `theme.schema.ts` is unchanged by EC-108,
  so this should not happen for the 68 shipped themes. If it does, the
  corrupted theme is real authoring drift; escalate to the author rather
  than loosening the schema.
- **`[RegistryConfig] Rejected` fires for a valid config.** Likely an
  unexpected field leaked in (e.g., comment, trailing comma). `.strict()`
  catches this — either remove the stray field or widen the schema via a
  DECISIONS.md entry (not a silent change).
- **Default Zod path `["0","label"]` appears in warning text.** The
  `issue.path.join(".")` rendering was not applied. Fix per §Locked Values
  "Zod error rendering."
- **Browser console shows `Error: [object Object]` instead of a full
  sentence.** The error was thrown with a non-string argument, or
  `String(...)` was applied where `err.message` should have been. Check the
  throw site; the locked pattern is `throw new Error('[Prefix] Rejected ... — ...')`.
- **`git diff` shows `theme.schema.ts` modified.** Regression of the D-5504
  / D-5509 lock. Revert immediately and re-read the §Pre-Flight STOP Gates
  section.
- **`pnpm-lock.yaml` shows a diff.** No new dependency is authorized by this
  packet. Investigate — likely an unintended side-effect of a `pnpm install`
  variant; revert.
- **Commit message rejected by hook.** Subject contains a forbidden word
  (`WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff`)
  or uses `WP-083:` prefix. Rephrase using `EC-108:` + a substantive ≥12-char
  summary.
- **`viewer config: OK` fails with path `rulebookPdfUrl`** during
  verification step 9. Means WP-082 landed with a malformed URL. Cross-check
  with EC-107 pre-flight; do not silently widen `ViewerConfigSchema` to
  accept the malformed value.
- **Theme type compatibility break** — `themeClient.ts` calls a method or
  reads a field on a theme that the local interface had but the inferred
  type lacks (or vice versa). This should be impossible given the registry
  inferred type is strictly wider for optional fields, but `themeSchemaVersion`
  narrows from `number` to `z.literal(2)` — the Step 7.1 grep gate catches
  any consumer that would break on the narrowing. If it surfaces, the
  investigation leads to the call site, not the schema.
- **`Cannot find module '@legendary-arena/registry/theme.schema'`** at import
  resolution in the viewer — A-083-04 subpath entry was not added to
  `packages/registry/package.json`, or the registry package was not rebuilt
  before the viewer build (`pnpm --filter @legendary-arena/registry build`
  must run first, or rely on `pnpm -r build` which handles the topology).
  Verify via `grep -c "\"./theme.schema\"" packages/registry/package.json`
  (expect 1) and `ls packages/registry/dist/theme.schema.*` (expect two
  files: `.js` and `.d.ts`).
- **`Cannot find module '__vite-browser-external'` during viewer production
  build** — a barrel import `from "@legendary-arena/registry"` crept into
  `registryClient.ts` or `themeClient.ts`. Fix by rewriting to the narrow
  `./schema` or `./theme.schema` subpath per §Locked Values; Step 7.3 grep
  gate catches this automatically. Do NOT suppress the error with a
  `// @ts-ignore` or a Vite `optimizeDeps` entry.
