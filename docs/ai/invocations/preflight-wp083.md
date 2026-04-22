# Pre-Flight — WP-083 (Fetch-Time Schema Validation for Registry-Viewer Clients)

**Target Work Packet:** WP-083
**Execution Checklist:** EC-108 (`docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md`)
**Previous WP Status:** WP-082 Complete (2026-04-21, commit `3da6ac3`, under EC-107)
**Pre-Flight Date:** 2026-04-21
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Work Packet Class:** Runtime Wiring (fetch-boundary retrofit; no `G` mutation; no engine/framework wiring; viewer-only runtime additions)

---

## Pre-Flight Intent

Validate readiness of WP-083 and EC-108 for execution. This is an audit pass only — no code is generated, no tests are run, no files are modified. The verdict is binary (READY TO EXECUTE / DO NOT EXECUTE YET) and authorizes (or denies) generation of `docs/ai/invocations/session-wp083-fetch-time-schema-validation.md`.

---

## Authority Chain (Read)

1. `.claude/CLAUDE.md` — EC-mode + lint gate rules (confirmed)
2. `docs/ai/ARCHITECTURE.md` — Registry + Registry-Viewer layer boundaries (confirmed)
3. `docs/03.1-DATA-SOURCES.md` — inputs inventory (partial coverage; see Traceability §)
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — directory classifications (gap noted; see §Code Category Boundary Check)
5. `docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md` — **primary authority**
6. `docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` — subordinate to EC-108

**Review order applied:** EC-108 → WP-083 → (no invocation prompt yet to review).

---

## Dependency & Sequencing Check

| WP | Status | Evidence |
|---|---|---|
| WP-060 (glossary data migration) | ✅ Complete | `WORK_INDEX.md:221` — `[x]` at commit `412a31c` |
| WP-082 / EC-107 (glossary schema + labels + PDF deep-links) | ✅ Complete | `WORK_INDEX.md:1148` — `[x]` at commit `3da6ac3` 2026-04-21; baseline **596 / 0** preserved |
| WP-055 / EC-055 (theme data model v2) | ✅ Complete (pre-dates this workflow) | `theme.schema.ts` at HEAD exports all five theme schemas + inferred `ThemeDefinition`; `theme.schema.ts:104 themeSchemaVersion: z.literal(2)` locks D-5504 |
| WP-083 dependency declared as WP-060 only | ✅ Verified | WP-083 line 7 |
| WP-082 order-independence claim | ✅ Verified | `public/registry-config.json` already has `rulebookPdfUrl` → WP-082 landed; `ViewerConfigSchema` makes this field optional so ordering is moot |

**Rule:** Dependencies complete. ✅

---

## Dependency Contract Verification

Reality-checked every claim WP-083 / EC-108 makes about repo state:

### ✅ Confirmed claims

- `packages/registry/src/schema.ts:33` — `RegistryConfigSchema = z.array(z.string().min(2).max(10))`. **Byte-for-byte preservable.** ✅
- `packages/registry/src/schema.ts:29` — `import { z } from "zod";` (EC-108 precondition). ✅
- `packages/registry/src/theme.schema.ts` exists at HEAD; exports `ThemeDefinitionSchema` (line 103), `ThemeSetupIntentSchema` (line 30), `ThemePlayerCountSchema` (line 39 with both `.refine(...)` invariants D-5504/D-5509 references depend on), `ThemePrimaryStoryReferenceSchema` (line 61), `ThemeMusicAssetsSchema` (line 74), inferred `ThemeDefinition` type (line 126). **Unmodified; locked by D-5504 / D-5509.** ✅
- `packages/registry/src/index.ts` re-exports all five theme schemas (lines 51–57) + `ThemeDefinition` type (line 48). EC-108 guardrail "theme block not modified" is viable. ✅
- `apps/registry-viewer/src/lib/registryClient.ts` has inline `RegistryConfig` interface at lines 5–8 and unvalidated `await res.json()` cast at line 20. ✅
- `apps/registry-viewer/src/lib/themeClient.ts` has four inline interfaces at lines 12–47 (`ThemeSetupIntent`, `ThemePlayerCount`, `ThemePrimaryStoryReference`, `ThemeDefinition`) and unvalidated parses at lines 70 + 79. ✅
- `apps/registry-viewer/src/lib/glossaryClient.ts` precedent — `.safeParse(...)` + `[Glossary] Rejected ...` + `issue.path.join(".")` pattern exists verbatim. ✅
- `apps/registry-viewer/public/registry-config.json` contains `metadataBaseUrl`, `rulebookPdfUrl`, `eagerLoad` (all three URL-typed or string-array-typed). **Pre-validated against `ViewerConfigSchema` shape.** ✅
- `content/themes/` contains 69 individual theme JSONs + `index.json` + `00-ALL_THEMES_COMBINED.json` + `01-ALL_THEMES_COMBINED.json` (72 total `.json` entries; 69 after EC-055 §D.8 aggregate exclusion — **one more than EC-108 line 155's "68 hand-authored theme files" claim**; minor drift, expected per EC-108 "re-derived at pre-flight" language). ✅
- `content/themes/heroes/` is untracked and contains only `black-widow.json` — unrelated to WP-083. Must be explicitly excluded from staging per EC-108 §Non-Negotiable "No staging of out-of-scope dirty-tree items". ✅ (flagged)
- `pnpm -r build` exits 0 at HEAD (re-run during pre-flight — all seven packages/apps build cleanly). ✅
- Test baseline **596 passing / 0 failing** preserved from WP-082/EC-107 close. `pnpm -r --if-present test` not re-run during pre-flight (build-green + recency of WP-082 baseline sufficient); executor must re-derive at EC-108 §Preconditions step before Commit A. ✅
- `packages/registry/package.json` `exports` field has exactly two entries: `.` (barrel) and `./schema` (Zod-only subpath). ✅
- `apps/registry-viewer/package.json` declares `"@legendary-arena/registry": "workspace:*"` (landed by WP-082 amendment A-082-01). ✅
- `.githooks/commit-msg` enforces `EC-###:` / `SPEC:` / `INFRA:` prefixes and rejects `WP-083:` per P6-36. EC-108 commit prefix `EC-108:` at execution is correct. ✅
- `docs/ai/DECISIONS.md:2811` D-5504 present; line 2859 D-5509 present; P6-36 referenced throughout STATUS/WORK_INDEX/DECISIONS. ✅

### ⚠️ Discrepancies (non-blocking line-number drift)

- EC-108 line 50 claims "All six are already re-exported from `packages/registry/src/index.ts` at **lines 38–48**." Actual at HEAD: type at line 48, schemas at **lines 51–57**, validators at line 60. EC-107 extended the general-schema block (lines 30–40 now cover 10 names including keyword + rule glossary schemas) which shifted the theme block downward. EC-108 already says "re-derive at pre-flight"; line drift noted but not blocking.
- EC-108 lines 137–138 ("general block at 30–36", "theme block at 42–48") have the same drift from the same cause.
- EC-108 line 143 (themeClient interfaces at "lines 10–47") — actual 12–47, trivial drift.
- EC-108 verification step 11 theme-count assumes aggregate-exclusion produces "N" where N matches pre-flight count. N is **69** at HEAD (not 68). Executor must re-derive on Commit A verification, not fail the gate on a literal 68.

### ❌ Blocking contract gaps — see §Risk Review PS-1, PS-2 below

---

## Input Data Traceability Check

Answered YES / NO per 01.4 §Input Data Traceability Check:

- [x] **NO** — `apps/registry-viewer/public/registry-config.json` (viewer public config) is **not listed** in `docs/03.1-DATA-SOURCES.md`. The document covers R2 card data, R2 metadata, R2 images, rules text, PAR artifacts, match-setup config — but not the viewer's public config JSON. EC-108 §F grants permission to skip 03.1 update "if the existing doc structure doesn't support it." Soft gap — NOT converted to blocker; WP-083 §Governance already acknowledges.
- [x] **NO** — `content/themes/*.json` (source files for R2 `/themes/{file}.json`) are not listed in 03.1 either. Same soft gap. Themes are documented in `apps/registry-viewer/CLAUDE.md` §"Theme Data Pipeline" but not in 03.1 as an authoritative input source. Soft gap.
- [x] **YES** — rulebook PDF entry exists in 03.1 (lines 72–84 — added by WP-082/EC-107).
- [x] **YES** — schema authority for all fetched payloads is `packages/registry/src/schema.ts` + `packages/registry/src/theme.schema.ts`; runnable via `pnpm registry:validate`.
- [x] **YES** — no "implicit data" (no hardcoded literals derived from R2 content); validation is pure shape-check.

**Verdict on this section:** 2 soft NOs. Neither blocks; both are acknowledged as out-of-scope documentation drift that WP-083 explicitly grants permission to skip.

---

## Structural Readiness Check (Types & Contracts)

- [x] **YES** — all prior WPs (WP-060, WP-082) compile and test (596/0 at HEAD).
- [x] **YES** — no known EC violations open.
- [x] **YES** — required types exist (all five theme schemas + `ThemeDefinition` type; `zod` already a dep of both packages; `.safeParse` + glossary-client precedent pattern).
- [x] **YES** — no naming or ownership conflicts (`ViewerConfigSchema` is distinct from `RegistryConfigSchema`; WP-083 §A and EC-108 §Locked Values both lock this).
- [x] **NO (conditional)** — architectural boundary risk: **theme-schema import source is unresolved** (see Risk Review PS-2). Barrel vs subpath determines whether the viewer's Vite build tree-shakes the Node-only `createRegistryFromLocalFiles` factory. `glossaryClient.ts` documented this exact failure mode at its `// why:` comment (lines 20–28). Without an explicit resolution, the executor must guess.
- [x] **YES** — R2 validation not required (WP-083 does not re-upload JSON).
- [x] **YES** — field-path reads against actual type definitions (all theme-field reads in `themeClient.ts` currently access `name`, `description`, `themeId`, etc. — all present in `ThemeDefinition` package type).

**One conditional NO on architectural-boundary risk** → converts to PS-2 rather than auto-converting the verdict.

---

## Runtime Readiness Check (Mutation & Framework)

WP-083 is a **retrofit**, not a new runtime surface. No engine / framework concerns apply.

- [x] **YES** — no `game.ts`, phase hook, or move-map touches.
- [x] **YES** — no `ctx.events.*`, no `ctx.random.*`, no `boardgame.io` import anywhere in WP-083 scope.
- [x] **YES** — viewer-side Vite + Rollup build already exercises the pattern via `glossaryClient.ts`; no new test infrastructure required.
- [x] **YES** — no 01.5 runtime wiring allowance invocation needed (EC-108 §"01.5 runtime-wiring allowance: NOT INVOKED" confirms).
- [x] **YES** — no boundary violations at the engine/framework level (all work is Registry + Viewer).
- [x] **YES** — integration points (`registryClient.getRegistry()` + `themeClient.getThemes()`) are already called from `App.vue`; validation-retrofit preserves the call shape.

---

## Established Patterns to Follow (Locked Precedents)

Reused / respected by WP-083 as written:

- **Fetch-boundary `.safeParse(...)` with first-issue rendering** — precedent `glossaryClient.ts`; EC-108 §"Zod error rendering" mirrors the pattern (first issue only, `issue.path.join(".")` or `"root"`, `[Tag] Rejected <file> from <URL>: <path> — <message>. <operator sentence>`).
- **Throw vs warn+skip severity by dependency class** — hard dependencies throw; batch entries warn+skip. EC-108 §Locked Values locks this explicitly; precedent `glossaryClient.ts` (network throw) + this packet extends to schema failures.
- **`.strict()` on new object schemas only** — `ViewerConfigSchema` strict; `ThemeIndexSchema` (array) not strict; **theme schemas NOT retro-applied `.strict()`** per D-5509 additive-music-fields preservation.
- **Inline interface deletion + inferred-type import** — same technique EC-107 used for glossary types in `useRules.ts`.
- **`workspace:*` dep + subpath export** — precedent A-082-01 (viewer's `@legendary-arena/registry` workspace-link + the `./schema` subpath). WP-083 may need to extend this precedent to cover theme schemas — see PS-2.
- **No `export *`, no barrel re-exports** — preserved.

---

## Maintainability & Upgrade Readiness

- [x] **YES** — extension seam: the validation-retrofit pattern generalises to any future R2 fetcher; `.strict()` + subpath export pattern is reusable.
- [x] **YES** — patch locality: a future fix lives in `schema.ts` (schema body) OR the client file (error-message wording); never cross-cutting.
- [x] **YES** — fail-safe: hard deps throw (fail loud); batch entries warn+skip (fail soft). Neither mutates game state; neither cascades.
- [x] **YES** — deterministic reconstructability: validation is pure (no side effects); errors deterministic by Zod issue path.
- [x] **YES** — backward-compatible test surface: no test mocks need updates because the shipped R2 data (real `registry-config.json`, 69 themes, `themes/index.json`) all validate.
- [x] **YES** — semantic naming stability: `ViewerConfigSchema` and `ThemeIndexSchema` are final names (locked by D-083B at governance close).

---

## Code Category Boundary Check

Per `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §Category Summary (lines 36–49):

| File touched | Expected category | Current 02-CODE-CATEGORIES.md row |
|---|---|---|
| `packages/registry/src/schema.ts` | `data-input` | `data-input` → `packages/registry/` ✅ |
| `packages/registry/src/index.ts` | `data-input` | ✅ |
| `apps/registry-viewer/src/lib/registryClient.ts` | **(unclassified)** | **No `apps/registry-viewer/` row** — gap |
| `apps/registry-viewer/src/lib/themeClient.ts` | **(unclassified)** | — |
| `apps/registry-viewer/CLAUDE.md` | `docs` | ✅ |
| `docs/03.1-DATA-SOURCES.md` (if edited) | `docs` | ✅ |
| `docs/ai/DECISIONS.md` | `docs` | ✅ |

**Finding:** `apps/registry-viewer/` is not enumerated in the Category Summary table. `client-app` row covers `apps/arena-client/` only; `cli-producer-app` covers `apps/replay-producer/` only.

**Severity:** This is a **pre-existing documentation gap** — WP-060/EC-106 and WP-082/EC-107 both modified `apps/registry-viewer/src/lib/` without a category row existing, and neither pre-flight flagged it as blocking. The precedent is that the viewer is implicitly treated as a client-category cousin of `arena-client` without an explicit row. WP-083 does not regress; flagging as an **observation, not a blocker**. A separate docs-housekeeping WP should add a `registry-viewer-app` category row citing D-6511 analog — but forcing that into WP-083's scope is scope creep.

**No new directories created by WP-083**; every touched path already exists. No PS-# for category classification.

---

## Scope Lock

### WP-083 Is Allowed To (extract from EC-108 §Files to Produce):

- **Modify** `packages/registry/src/schema.ts` — append `ViewerConfigSchema` + `ThemeIndexSchema` + inferred types; update comment adjacent to `RegistryConfigSchema` (schema body **unchanged, byte-for-byte**).
- **Modify** `packages/registry/src/index.ts` — extend general-schema re-export block with `ViewerConfigSchema` + `ThemeIndexSchema`; parallel `export type { ViewerConfig, ThemeIndex }`. Theme-schema block untouched.
- **Modify** `apps/registry-viewer/src/lib/registryClient.ts` — delete inline `RegistryConfig` interface; `.safeParse(...)`; throw on failure.
- **Modify** `apps/registry-viewer/src/lib/themeClient.ts` — delete 4 inline interfaces; `.safeParse(...)` for index (throw) + per theme (warn+skip); preserve `Promise.allSettled` + null-filter + sort tail.
- **Modify** `apps/registry-viewer/CLAUDE.md` — fetch-boundary validation note.
- **Modify** `docs/03.1-DATA-SOURCES.md` (optional — skip permitted per WP-083 §F).
- **Modify** `docs/ai/DECISIONS.md` — four governance entries at Commit B.
- **Modify** `docs/ai/work-packets/WORK_INDEX.md` (Commit B) + `docs/ai/execution-checklists/EC_INDEX.md` (EC-108 row add at A0, flip to `Done` at B).
- **Create** `docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md` at Commit A0 (already drafted).

**One allowlist addition proposed** (see PS-2): `packages/registry/package.json` if Option A of PS-2 is chosen.

### WP-083 Is Explicitly Not Allowed To:

- Modify `packages/registry/src/theme.schema.ts` or `theme.validate.ts` (D-5504 / D-5509 lock).
- Modify `RegistryConfigSchema`'s schema body (byte-for-byte preservation is the whole point of the naming-collision fix).
- Add `.strict()` to theme schemas (would regress D-5509 additive fields).
- Add `.strict()` to `ThemeIndexSchema` (array — meaningless).
- Use `.parse(...)` at any fetch boundary (only `.safeParse(...)`).
- Touch `apps/registry-viewer/src/lib/glossaryClient.ts` (WP-082/EC-107 territory).
- Touch the viewer's local `src/registry/schema.ts` duplicate (known smell; out of scope).
- Modify `public/registry-config.json` or any `content/themes/*.json`.
- Touch engine / preplan / server / pg / boardgame.io.
- Use `git add .` / `git add -A` / `git add -u`.
- Use `--no-verify` or `--no-gpg-sign`.

---

## Test Expectations (Locked)

- **New tests:** 0 required by WP-083 / EC-108. Optional schema-parse tests may be added following `theme.schema.test.ts` precedent (one `describe()` per file) — authored only if executor judges a stronger contract enforcement is warranted; otherwise skip.
- **Existing test changes:** none (viewer has no test script; registry package's 13 tests continue to pass unchanged).
- **Baseline locked:** **596 passing / 0 failing** (engine 444 / registry 13 / vue-sfc-loader 11 / replay-producer 4 / server 6 / preplan 52 / arena-client 66). Re-derive during EC-108 §Preconditions.
- **Test boundaries:** no `boardgame.io/testing` imports; no modifications to `makeMockCtx` or shared helpers; tests (if any added) use `node:test` only.
- **Defensive guards:** none needed — validation failures produce string error messages; existing mock inputs (shipped R2 data) all validate.

---

## Mutation Boundary Confirmation

**Not applicable.** WP-083 is not a Behavior / State Mutation packet — no `G` mutation. Retrofit validates derived structures (fetched JSON) at the viewer boundary; no engine-authoritative state is touched. Section skipped per 01.4 rules.

---

## Risk & Ambiguity Review

### RS-1 — Theme-schema import source (HIGH impact; convertible to PS-2)

- **Risk:** EC-108 §`themeClient.ts` edits (line 346) instructs "Import `ThemeIndexSchema`, `ThemeDefinitionSchema`, and inferred `ThemeDefinition` type from `@legendary-arena/registry`". The **barrel** import pulls in `createRegistryFromLocalFiles` (Node-only — `node:fs/promises`, `node:path`). `glossaryClient.ts:20–28` explicitly documents that Vite + Rollup **fail the browser build** on barrel imports of registry schemas:
  > "Vite externalizes those for the browser build, but Rollup resolves the import graph before tree-shaking can prune the unused Node-only factory, so the browser build fails on `resolve` from `__vite-browser-external`."
  The fix used by EC-107 was a dedicated `./schema` subpath entry in `packages/registry/package.json` `exports`. But that subpath only covers `schema.ts` — **not** `theme.schema.ts`. `ThemeDefinitionSchema` + `ThemeDefinition` type are not reachable via `./schema`.
- **Impact:** HIGH — barrel import per EC-108's letter would regress the browser build and replay the EC-107 failure mode. Executor must not guess.
- **Mitigation options:**
  - **(A) [recommended]** Add a `./theme.schema` subpath export to `packages/registry/package.json` (mirrors A-082-01 precedent). Two-line addition to the `exports` field. Adds **`packages/registry/package.json`** to the WP-083 allowlist and a new `A-083-04` amendment. Viewer imports:
    - `ViewerConfigSchema`, `ThemeIndexSchema` from `@legendary-arena/registry/schema`
    - `ThemeDefinitionSchema`, `ThemeDefinition` from `@legendary-arena/registry/theme.schema`
  - **(B)** Extend `./schema` to re-export theme schemas by adding `export { ThemeDefinitionSchema, ThemeMusicAssetsSchema, ... } from "./theme.schema.js";` + `export type { ThemeDefinition } from "./theme.schema.js";` at end of `schema.ts`. Zero allowlist additions (schema.ts already in allowlist) and zero `package.json` changes. Downside: blurs file-level responsibility — `schema.ts` becomes a re-export hub for `theme.schema.ts`.
  - **(C)** Import theme schemas from the barrel. **Rejected** — reproduces EC-107 failure.
  - **(D)** Move `ThemeIndexSchema` authoring into `theme.schema.ts` and rely on option (A) subpath. Rejected — `theme.schema.ts` is locked by `.claude/rules/registry.md` immutable-files rule without a DECISIONS entry, and D-5509 scope bounds.
- **Decision / pattern to follow:** **LOCKED — Option (A).** Adds `A-083-04` amendment to WP-083 authorizing a two-line `packages/registry/package.json` `exports` addition. One extra file in the Commit A allowlist. Matches A-082-01 precedent exactly. Executor must not use barrel imports anywhere in `themeClient.ts` or `registryClient.ts`.

### RS-2 — EC-108 line-number drift (LOW impact)

- **Risk:** EC-108 references `index.ts` lines 38–48 for the theme re-export block; actual is 47–57. Same for general block 30–36 vs actual 30–40. Plus themeClient interface lines 10–47 vs actual 12–47.
- **Impact:** LOW — EC-108 already instructs "re-derive at execution time". Executor reads actual lines and edits by symbol, not by line number.
- **Mitigation:** No change needed. Flag in session prompt as "line numbers in EC-108 are approximate — re-derive at execution time".
- **Decision:** Accept as authored.

### RS-3 — Theme count drift (LOW impact)

- **Risk:** EC-108 and CLAUDE.md both claim "68 hand-authored theme files"; HEAD count is **69** (post-`EC-055` plus whatever landed since). EC-108 verification step 11 expects `fail: 0` but does not hard-code `ok: 68` — it says "N matches the content/themes/ count at pre-flight".
- **Impact:** LOW — the verification gate is zero-failure, not count-literal. Executor re-derives N at pre-flight.
- **Mitigation:** Record `N = 69` in the session-context file so verification gate uses the re-derived value.
- **Decision:** Accept.

### RS-4 — Stray working-tree items (MEDIUM impact)

- **Risk:** Working tree carries ~25 untracked items unrelated to WP-083: `.claude/worktrees/` (tooling), `content/themes/heroes/black-widow.json`, multiple `docs/ai/` artifacts for WP-067/WP-084/WP-048/forensics, WP-084 drafts, WP-083 drafts, and `data/cards/bkpt.json` (modified) + `package.json` (modified). EC-108 §Non-Negotiable forbids `git add .` / `git add -A` / `git add -u`.
- **Impact:** MEDIUM — executor must enumerate each file by name and stage only WP-083-allowlist items. A single stray staging error regresses the Acceptance Criteria "files-outside-allowlist" gate.
- **Mitigation:** The A0 SPEC session-context file must explicitly list all in-scope files per commit (A0 / A / B) and enumerate out-of-scope working-tree items as "must not be staged". Stash or branch-shelve is operator discretion; pre-flight recommends leaving items in working tree and relying on exact-filename staging.
- **Decision:** PS-3 — author session-context-wp083 with explicit in-scope / out-of-scope tables.

### RS-5 — `ThemeDefinition` narrowing (not widening) (LOW impact)

- **Risk:** WP-083 §E and EC-108 §"Theme type compatibility" claim the shift from the viewer's local `ThemeDefinition` interface to the registry package's inferred type is a "strict widening of the compile-time surface". This is not quite right: `themeSchemaVersion` **narrows** from `number` to `z.literal(2)`. Optional fields (`musicTheme`, `musicAIPrompt`, `musicAssets`, `references.primaryStory.externalIndexUrls`, `tags` as `default([])`) do widen. `playerCount` refinements are runtime-only.
- **Impact:** LOW — no code in `themeClient.ts` **writes** to `themeSchemaVersion`; only reads via `theme.themeSchemaVersion` (if referenced at all). All 69 shipped themes have `themeSchemaVersion: 2`, so the narrow `literal(2)` gate passes at runtime.
- **Mitigation:** Note in the session prompt that the change is "strict widening for optional fields; narrowing for `themeSchemaVersion` (read-only in the viewer; safe)". If any downstream consumer (e.g., a Vue SFC reading `theme.themeSchemaVersion` for `number`-typed arithmetic) exists, the executor must audit — but a grep of the 13 viewer Vue/TS files for `themeSchemaVersion` should return zero or trivial references.
- **Decision:** Accept; add a one-sentence clarification to the session prompt.

### RS-6 — `registryClient.ts` import-style ambiguity (MEDIUM impact; subsumed by RS-1 resolution)

- **Risk:** EC-108 §`registryClient.ts` edits (line 332) says "Import `ViewerConfigSchema` and type `ViewerConfig` from `@legendary-arena/registry` (match the existing `createRegistryFromHttp` import path style used elsewhere in the viewer)". But `registryClient.ts:1` imports `createRegistryFromHttp` from `"../registry/browser"` (viewer-local relative path), **not** from the package. So "match existing style" is ambiguous — could be read as viewer-local or package-level.
- **Impact:** MEDIUM — if read as viewer-local, executor would look for a viewer-local `ViewerConfigSchema` (doesn't exist). If read as barrel, re-introduces RS-1's Vite/Rollup risk.
- **Mitigation:** Subsumed by RS-1 / PS-2 resolution. Lock the import source as `@legendary-arena/registry/schema` (`./schema` subpath) for both `ViewerConfigSchema` and `ThemeIndexSchema`.
- **Decision:** Accept with RS-1 resolution.

### RS-7 — `03.1-DATA-SOURCES.md` coverage gap (LOW impact)

- **Risk:** Viewer public config + themes are not in 03.1.
- **Impact:** LOW — WP-083 §F grants skip permission and authorizes the status-column-only path.
- **Mitigation:** None required by this WP.
- **Decision:** Accept; revisit in a future docs-housekeeping WP.

### RS-8 — Commit topology discipline (LOW impact)

- **Risk:** The three-commit topology (A0 `SPEC:` → A `EC-108:` → B `SPEC:`) is standard; the commit-msg hook enforces prefixes. P6-36 rejects `WP-083:`.
- **Impact:** LOW — EC-108 locks this.
- **Mitigation:** None.
- **Decision:** Accept.

---

## Pre-Flight Verdict

**DO NOT EXECUTE YET** — conditional on resolving two Pre-Session Actions.

**Justification (3–6 sentences):**

Dependency readiness is solid (WP-060 + WP-082 complete at commits `412a31c` + `3da6ac3`, baseline 596/0 preserved, all build pipelines green). Contract fidelity is verified for every concrete claim EC-108 makes about HEAD state — schemas, inline interfaces, config JSON, registry package `exports` field, commit-msg hook, and decision IDs D-5504/D-5509 are all as described modulo minor line-number drift (accepted as authored). Scope lock and fail-safe / extension seam properties are strong — the packet is a textbook fetch-boundary retrofit mirroring `glossaryClient.ts`. **However, two blocking gaps prevent READY**: (1) the packet's session-context / SPEC bundle has not been assembled yet (EC-108 is not in `EC_INDEX.md`, WP-083 is not in `WORK_INDEX.md`); (2) the theme-schema import source is unresolved — the barrel would reproduce the EC-107 browser-build failure, and the existing `./schema` subpath does not cover `theme.schema.ts`. Both are resolvable before execution; neither changes the WP's behavior or allowlist beyond one `packages/registry/package.json` line-add.

---

## Pre-Session Actions (PS)

All three must resolve before the verdict flips to READY. After resolution, log under "Authorized Next Step".

### PS-1 — Assemble A0 SPEC bundle (standard)

- [ ] Add WP-083 row to `docs/ai/work-packets/WORK_INDEX.md` (dependencies, EC-108 reference, commit-prefix reminder).
- [ ] Add EC-108 row to `docs/ai/execution-checklists/EC_INDEX.md` (status: Draft at A0; flipped to Done at B).
- [ ] Author `docs/ai/session-context/session-context-wp083.md` with: dependency chain, 69-theme count, test baseline 596/0, in-scope vs out-of-scope working-tree tables (per PS-3 below), WP-083 + EC-108 path references, commit topology, RS-1 through RS-8 rollup.
- [ ] Author the session execution prompt `docs/ai/invocations/session-wp083-fetch-time-schema-validation.md` only **after** PS-2 and PS-3 resolve and this pre-flight's verdict flips.

### PS-2 — Lock theme-schema import source (design decision)

- [ ] Amend WP-083 with **A-083-04** authorizing a `./theme.schema` subpath export in `packages/registry/package.json` (Option A from RS-1). Add one file to WP-083 §Files Expected to Change: `packages/registry/package.json`.
- [ ] Update EC-108 §Files to Produce with the same file + subpath-export shape.
- [ ] Lock viewer imports:
  - `registryClient.ts` → `import { ViewerConfigSchema, type ViewerConfig } from "@legendary-arena/registry/schema";`
  - `themeClient.ts` → `import { ThemeIndexSchema } from "@legendary-arena/registry/schema";` + `import { ThemeDefinitionSchema, type ThemeDefinition } from "@legendary-arena/registry/theme.schema";`
- [ ] Confirm a **new DECISIONS.md entry** (D-083E at governance-close) locks the subpath-export pattern as a reusable retrofit precedent.

### PS-3 — Enumerate working-tree in-scope vs out-of-scope (stage hygiene)

- [ ] The session-context-wp083 file must explicitly list every dirty-tree item (see `git status` snapshot; ~25 items) under one of two headings:
  - **In-scope for Commit A0 / A / B** (EC-108 file, WP-083 amendments, session-context, invocation prompt, the registry package-json change from PS-2, the four touched clients/indexes/DECISIONS).
  - **Out-of-scope, must not be staged** (`content/themes/heroes/black-widow.json`, `data/cards/bkpt.json`, `package.json`, `.claude/worktrees/`, WP-084 drafts, WP-067 drafts, WP-048 drafts, forensics artifacts, and any other untracked item).
- [ ] Recommend leaving out-of-scope items in working tree (not stashed) — executor stages by exact filename only per EC-108 §Non-Negotiable.

---

## Invocation Prompt Conformance Check (Pre-Generation)

**Not performed.** The session execution prompt must NOT be generated until all three PS-# items resolve. On resolution, re-run this section against the drafted prompt:

- [ ] All EC-108 locked values copied verbatim (especially the `[RegistryConfig] Rejected ... at path '...': ...` and `[Themes] Rejected ...` formats)
- [ ] No new keywords, helpers, file paths, or timing rules appear only in the prompt
- [ ] Import-source lock (PS-2 resolution) appears verbatim in the prompt
- [ ] PS-3 out-of-scope enumeration appears verbatim
- [ ] Commit topology and commit-prefix discipline (EC-108, not WP-083) copied verbatim
- [ ] 01.5 NOT INVOKED declared explicitly

---

## Authorized Next Step

**Blocked on PS-1, PS-2, PS-3.** Session prompt generation is NOT authorized until all three resolve.

When all three PS-# items resolve:

```
**Pre-session actions — ALL RESOLVED (YYYY-MM-DD):**

1. PS-1: A0 SPEC bundle assembled — WORK_INDEX row + EC_INDEX row + session-context-wp083.md authored.
2. PS-2: Amendment A-083-04 landed; packages/registry/package.json "./theme.schema" subpath authorized;
   viewer imports locked to "./schema" and "./theme.schema" subpaths exclusively.
3. PS-3: session-context-wp083.md §2 enumerates in-scope vs out-of-scope working-tree items.

All mandatory pre-session actions are complete. No re-run of pre-flight required —
these updates resolve risks identified by this pre-flight without changing the WP's
behavioral scope (one file added to allowlist; no new tests; no new runtime behavior).
```

At that point: proceed to 01.7 copilot check → generate `docs/ai/invocations/session-wp083-fetch-time-schema-validation.md`.

---

## Final Instruction

Pre-flight verdict: **DO NOT EXECUTE YET** with three resolvable Pre-Session Actions. The packet's **design** is sound — the retrofit is mechanically clean, dependencies are green, scope is tight, fail-safe properties are strong, and EC-108 correctly refuses to modify `theme.schema.ts` or `RegistryConfigSchema`. The **governance surface** simply hasn't been assembled yet (PS-1), one **design decision** must be locked before the executor can write the import lines (PS-2), and **staging discipline** requires an explicit dirty-tree enumeration (PS-3). None change the WP's behavior or extend its blast radius beyond one `packages/registry/package.json` line-add.

Do not proceed to session-prompt generation. Do not execute the WP. Resolve PS-1 / PS-2 / PS-3, log resolution in "Authorized Next Step", then run the 01.7 copilot check.

---

# Re-Run 2026-04-21 (v2) — Post-Resolution Pre-Flight

**Pre-flight v1 verdict:** DO NOT EXECUTE YET (2026-04-21, above)
**Pre-flight v2 verdict:** **READY TO EXECUTE**
**Re-run trigger:** PS-1 / PS-2 / PS-3 resolution + A-083-04 amendment landed at A0 SPEC bundle

## Resolution of Pre-Session Actions

### PS-1 — A0 SPEC bundle assembled ✅

- [x] WP-083 row added to `docs/ai/work-packets/WORK_INDEX.md` between WP-082 and WP-084 with dependencies, EC-108 reference, commit-prefix reminder, and full execution notes.
- [x] EC-108 row added to `docs/ai/execution-checklists/EC_INDEX.md` between EC-107 and EC-109, status: Draft at A0; will flip to Done at Commit B.
- [x] `docs/ai/session-context/session-context-wp083.md` authored with 10 sections: dependency chain, test baseline, working-tree coordination with WP-084 (in-flight parallel), in-scope/out-of-scope tables (~60 dirty-tree items enumerated, 35 attributed to WP-084 in-flight), conflict-resolution rules, key artifacts, commit topology, governance entries, architectural patterns, known pre-existing issues, execution read order, amendments record, end state.
- [x] Session execution prompt `docs/ai/invocations/session-wp083-fetch-time-schema-validation.md` will be authored only **after** this pre-flight v2 + copilot-check v2 flip to READY/CONFIRM (standard sequence).

### PS-2 — Theme-schema import source locked ✅

- [x] **Amendment A-083-04 landed** in WP-083 §Amendments. The amendment:
  - Adds `packages/registry/package.json` to §Files Expected to Change (one new file in allowlist).
  - Authorizes a two-line addition to the `exports` field: `"./theme.schema": { "import": "./dist/theme.schema.js", "types": "./dist/theme.schema.d.ts" }`.
  - Locks exact import lines in §Scope (In) §D (for `registryClient.ts`) and §E (for `themeClient.ts`).
  - Adds §Scope (In) §G codifying the package.json edit.
  - Adds §Acceptance Criteria items for the subpath presence + no-barrel-imports.
  - Adds §Verification Step 6.5 / 6.6 / 6.7 (grep `themeSchemaVersion`, resolve subpath import, forbid barrel imports).
  - Adds D-083E to §Governance locking the `./theme.schema` subpath as a reusable retrofit precedent alongside D-083A–D-083D.
- [x] **EC-108 updated in parallel** with the same A-083-04 locks: §STOP gate entry for A-083-04, §Pre-Flight STOP Gates Path A bullet, §Before Starting precondition, §Locked Values `package.json` subpath addition section (exact JSON before/after), §Locked Values `registryClient.ts` + `themeClient.ts` exact-import blocks, §Files to Produce line for `packages/registry/package.json`, §Verification Steps 7.1 / 7.2 / 7.3, §Common Failure Smells entries for missing subpath + barrel regression, §Three-commit-topology line listing `packages/registry/package.json` in Commit A.
- [x] **Rationale locked:** mirrors EC-107 / A-082-01 precedent for `./schema`; zero barrel imports; zero touching of `theme.schema.ts` (D-5504 / D-5509 / EC-055 lock preserved); zero touching of `theme.validate.ts`.

### PS-3 — Working-tree enumeration ✅

- [x] `session-context-wp083.md` §2 enumerates the working-tree state observed at 2026-04-21 session-context-authoring time.
- [x] §2.1 locks branch strategy: executor cuts a fresh `wp-083-fetch-time-schema-validation` branch from `main` to avoid the in-flight WP-084 execution state. `pnpm -r build` + `pnpm -r --if-present test` re-confirm baseline on the fresh branch.
- [x] §2.2 lists 8 in-scope items (A0 SPEC bundle files) by exact filename.
- [x] §2.3 lists ~60 out-of-scope items, categorized:
  - **35 WP-084 execution-class changes** (5 JSON deletions + 5 docs sweep + validate.ts + viewer cleanup + 00.2 rewrite + etc.) — must not be staged in WP-083 commits.
  - **3 WP-084 governance artifacts** (EC-109 + preflight-wp084 + kickoff-wp084) — already WP-084's problem.
  - **~20 unrelated pre-existing drift items** (data/cards/bkpt.json, package.json, content/themes/heroes/, .claude/worktrees/, unrelated WP drafts).
- [x] §2.4 codifies conflict-resolution rules for the two overlap files (`packages/registry/src/schema.ts`, `apps/registry-viewer/CLAUDE.md`, plus DECISIONS.md / WORK_INDEX.md / EC_INDEX.md / 03.1-DATA-SOURCES.md) — confirming clean merge in both possible orderings (WP-084-first or WP-083-first).

## New Risk Entry — RS-9 (added 2026-04-21 during v2)

### RS-9 — WP-084 in-flight working-tree state (MEDIUM impact; mitigated)

- **Risk:** session-context authoring at 2026-04-21 observed WP-084 execution partially applied in the working tree: 5 data/metadata JSONs deleted, `schema.ts` modified (-48 lines — the five auxiliary schemas removed), viewer `localRegistry.ts` deleted, `scripts/Validate-R2-old.ps1` deleted, ~15 doc-sweep modifications, plus `registry/scripts/validate.ts` Phase-2 excision. This state post-dates the v1 pre-flight (which was authored against the original session-start snapshot of ~25 dirty items) and reflects another session actively executing WP-084.
- **Impact:** MEDIUM if executor tries to run WP-083 atop the current working tree (merge conflicts + scope contamination + potential to accidentally stage WP-084 work in WP-083 commits). Mitigated by branch-strategy lock in §2.1.
- **Mitigation:** executor cuts fresh branch from `main` (recommended: commit `1a474d0` "SPEC: amend WP-084 / EC-109 per pre-flight (A-084-01)" or later, whichever is the most recent `main` tip when execution starts). This isolates WP-083 from WP-084's uncommitted work. Section §2.4 confirms all WP-083 / WP-084 file overlaps produce clean merges in either ordering, so WP-084 landing concurrently or after WP-083 is safe.
- **Decision / pattern to follow:** Lock branch strategy to "fresh cut from main" (codified in session-context-wp083 §2.1). WP-083 executor does NOT inherit the current working tree. WP-083 does NOT stage any WP-084 file. If WP-084 has landed on main by the time WP-083 executes, re-derive line numbers in `schema.ts` (EC-108 already instructs this) and re-confirm the 596/0 baseline on the fresh branch.

## Updated Structural Readiness

The only NO from v1 was the theme-schema import-source conditional. That is now a PASS:

- [x] **YES** — architectural boundary risk resolved. A-083-04 locks imports to `./schema` + `./theme.schema` subpaths exclusively. Barrel imports forbidden and grep-gated at Verification Step 7.3. No remaining unresolved structural-readiness question.

## Updated Code Category Boundary Check

Unchanged from v1 — the `apps/registry-viewer/` category gap is a pre-existing doc issue not in WP-083 scope. Recorded in session-context §7 as "known pre-existing issues, NOT addressed by this WP".

## Updated Scope Lock

### WP-083 Is Allowed To (updated to include A-083-04)

Prior list + one addition:

- **Modify** `packages/registry/package.json` — extend `exports` field with `"./theme.schema"` subpath entry per §Locked Values. No other field in that file is modified.

### WP-083 Is Explicitly Not Allowed To

Unchanged. The existing prohibitions (no barrel imports, no `theme.schema.ts` edit, no `theme.validate.ts` edit, no `RegistryConfigSchema` body change, no engine/preplan/server imports, no `git add .`/`-A`/`-u`, no `--no-verify`) all continue to apply.

## Pre-Flight v2 Verdict

**READY TO EXECUTE** — all three Pre-Session Actions from v1 resolve; new RS-9 mitigated by branch-strategy lock; A-083-04 amendment lands at A0 SPEC with full file-list, import-line, verification-step, and governance coverage.

**Justification (3–6 sentences):** Dependencies remain green (WP-060 + WP-082 complete; WP-055 theme schemas intact; build exit-0 reconfirmed). Contract fidelity is now complete — every import source, every schema location, every error-message shape, every verification gate is locked with explicit EC-108 text. Scope lock expands by exactly one file (`packages/registry/package.json`, under amendment A-083-04 at A0 SPEC) mirroring the A-082-01 precedent; no other allowlist change. The working-tree complication (RS-9 — WP-084 partial execution observed) is mitigated by mandatory fresh-branch cut from `main`; the two WPs are declared independent and their file overlaps merge cleanly in either ordering. All 10 maintainability checks pass; fail-safe properties strong; extension seams locked (Zod schema + subpath-export + `.safeParse()` fetch-boundary pattern generalizes). No architectural or determinism risk remains.

## Invocation Prompt Conformance Check (Pre-Generation) — Ready to Run

Once the copilot-check v2 returns CONFIRM, the session execution prompt may be generated. Re-apply this checklist at prompt-author time:

- [ ] All EC-108 locked values copied verbatim (import lines, `package.json` subpath JSON, error-message formats, severity policy, verification step text).
- [ ] No new keywords, helpers, file paths, or timing rules appear only in the prompt.
- [ ] Import-source lock (A-083-04) appears verbatim in the prompt — both subpaths explicit.
- [ ] Session-context §2.1 branch-strategy lock is restated (cut from `main`, not from current dirty working tree).
- [ ] Session-context §2.3 out-of-scope enumeration is linked (not duplicated — too long for a session prompt; a link back to session-context suffices).
- [ ] Commit topology and commit-prefix discipline (`EC-108:` at Commit A; `SPEC:` at A0 and B; `WP-083:` forbidden per P6-36) copied verbatim.
- [ ] 01.5 NOT INVOKED declared explicitly with all four criteria marked absent.
- [ ] 01.6 post-mortem NOT TRIGGERED justification stated.
- [ ] Paraphrase discipline (P6-50) called out.
- [ ] `.reduce()` ban and P6-22 escaped-dot grep patterns explicit.

## Authorized Next Step

**Pre-session actions — ALL RESOLVED (2026-04-21):**

1. **PS-1:** A0 SPEC bundle assembled — WORK_INDEX row + EC_INDEX row + session-context-wp083.md authored with full 10-section coverage including working-tree / WP-084-coordination enumeration.
2. **PS-2:** Amendment A-083-04 landed in WP-083 §Amendments + §Files Expected to Change + §Scope (In) §D / §E / §G + §Acceptance + §Verification Steps + §Governance (D-083E). EC-108 updated in parallel with matching locks in §Pre-Flight STOP Gate, §Before Starting, §Locked Values (new `package.json subpath addition` section + both client exact-import blocks), §Files to Produce, §Verification Steps 7.1 / 7.2 / 7.3, §Common Failure Smells, §Three-commit topology.
3. **PS-3:** session-context-wp083.md §2 enumerates in-scope (8 items) vs out-of-scope (~60 items: 35 WP-084 execution-class + 3 WP-084 governance + ~20 unrelated drift); §2.1 locks fresh-branch-from-main strategy; §2.4 codifies WP-083 ↔ WP-084 conflict-resolution rules (clean merge in either ordering).

All mandatory pre-session actions are complete. **Pre-flight verdict flips to READY TO EXECUTE.**

**Next step:** run 01.7 copilot check v2. Expected disposition: **CONFIRM**. On CONFIRM, generate `docs/ai/invocations/session-wp083-fetch-time-schema-validation.md` and proceed to WP-083 A0 SPEC commit.

