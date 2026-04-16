# WP-065 — Vue SFC Test Transform Pipeline

**Status:** Ready
**Primary Layer:** Shared internal tooling (new package
`packages/vue-sfc-loader/`)
**Dependencies:** None

---

## Session Context

Lint §7 and §12, plus `.claude/rules/code-style.md`, forbid Vitest,
Jest, and Mocha — `node:test` is the only permitted test runner
project-wide. But `.vue` Single-File Components cannot be imported by
Node without a compilation step, and no such step exists in the repo
today. This packet adds a minimal, reusable Node module-loader hook
that compiles `.vue` on-the-fly via `@vue/compiler-sfc`, making
`node:test` able to import, mount, and assert against Vue 3 SFCs. It
is a **hard prerequisite** for every UI packet that tests Vue
components — WP-061 (Gameplay Client Bootstrap), WP-062 (Arena HUD),
WP-064 (Game Log & Replay Inspector), and every future client UI WP.
The transform is intentionally scoped to **tests only**: runtime SFC
handling in Vite (for `pnpm dev` and `pnpm build`) is unchanged and
remains `@vitejs/plugin-vue`'s responsibility.

---

## Goal

After this session, `@legendary-arena/vue-sfc-loader` is an internal
private package under `packages/vue-sfc-loader/` that exports:

- A Node module-loader hook file consumable via
  `node --import @legendary-arena/vue-sfc-loader/register`, which makes
  `import HelloWorld from './HelloWorld.vue'` work under `node:test`.
- A pure helper `compileVue(source, filename): { code: string }` that
  wraps `@vue/compiler-sfc` and returns a single ESM JavaScript module
  representing the compiled SFC (template + script merged; style blocks
  stripped for test environments).
- A committed `test-fixtures/hello.vue` that the package's own tests
  import through the loader to prove the end-to-end pipeline works.

After this session, any Vue 3 SPA in the repo can add the transform to
its `test` script and then write `.vue` component tests under
`node:test` with no further setup. `pnpm --filter
@legendary-arena/vue-sfc-loader test` exits 0 and demonstrates
importing, mounting, and asserting on a compiled SFC.

---

## Assumes

- The repo uses Vue 3. (Confirmed by Vision §6 "Modern Web Application"
  and by the existing `apps/registry-viewer/` Vue 3 SPA.)
- Node v22+ is in use repo-wide. Node 22's `module.register()` /
  `--import` flag is the loader-registration mechanism this packet
  relies on.
- `pnpm -r build` and `pnpm -r test` exit 0 on `main`.
- `docs/ai/DECISIONS.md` exists.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirm
  that a new `packages/*` tooling package is consistent with the
  layering rules. This loader is consumed by app test scripts only; it
  is never imported at runtime from the game engine, registry, or
  server.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §7` — the
  forbidden-packages rule this WP exists to satisfy.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations),
  Rule 6 (`// why:` comments), Rule 11 (full-sentence error messages),
  Rule 13 (ESM only), Rule 14 (field names).
- `apps/registry-viewer/` — confirm whether any existing test
  infrastructure already uses a partial SFC transform. If so, this WP
  **consolidates** that work into a shared package; do not leave two
  parallel transforms in place.
- `@vue/compiler-sfc` package documentation — the authoritative
  compiler for Vue 3 SFCs. This packet uses it directly; do not try to
  reimplement SFC parsing.
- Node.js 22 docs on `module.register()` and the
  `load` / `resolve` customization hooks.

---

## Preflight (Must Pass Before Coding)

- **Vue version pinned:** confirm the exact `vue` version used by
  `apps/registry-viewer/`. `@vue/compiler-sfc` must match that version
  exactly (they are released together). A mismatch produces silent
  correctness drift in compiled templates.
- **`apps/registry-viewer/` test precedent:** grep for any existing
  `.vue` imports inside the viewer's test files or any existing
  `register.mjs` / loader hook. If one exists, this WP **replaces** it
  — do not leave two parallel SFC transforms alive in the repo. Record
  the consolidation decision in DECISIONS.md.
- **`jsdom` and `@vue/test-utils` availability:** confirm whether the
  repo already depends on these. If not, this WP adds both as
  dependencies of `@legendary-arena/vue-sfc-loader`. Their versions
  must match Vue 3.
- **Node 22 loader API stability:** confirm that `module.register()`
  with `--import` is still the supported API on the project's target
  Node version (22+). This is the Node API this packet uses directly.
  Log the exact Node minor version in DECISIONS.md.
- **`<script lang="ts">` smoke-test before writing `loader.ts`:**
  `@vue/compiler-sfc`'s `compileScript` behavior on TypeScript varies
  across versions — sometimes it strips TS types, sometimes it emits
  TS-with-types that needs a secondary transform. Before writing
  `loader.ts`, run a one-off smoke test: feed a minimal SFC with
  `<script lang="ts">` containing a type annotation into
  `compileScript` and inspect the output. Record the observed
  behavior in DECISIONS.md (e.g., "version X.Y.Z of
  `@vue/compiler-sfc` emits plain JS for `lang='ts'` scripts, so no
  secondary TS pass is required"). If the output still contains TS
  syntax, the loader must chain to the repo's TS transform (tsx or
  equivalent) after SFC compilation — note this in DECISIONS.md and
  adjust Scope (In) §C before writing.
- **Architecture layer classification:** confirm that
  `docs/ai/ARCHITECTURE.md §Layer Boundary` includes a "Shared
  Tooling" layer (amended 2026-04-16 for this packet). If the layer
  table does not list `packages/vue-sfc-loader/**` under Shared
  Tooling, stop and ask — the amendment must land before the package
  scaffolds.

If any item is unknown, **stop and ask** before writing code.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — no randomness in tooling.
- Never persist state — the loader is stateless per invocation.
- ESM only, Node v22+. `node:` prefix on all Node built-ins
  (`node:fs/promises`, `node:path`, `node:module`, `node:url`).
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file. No diffs, no
  snippets, no "show only the changed section" output.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`
  (use Node's built-in `fetch`); no ORMs; no `Jest`, no `Vitest`, no
  `Mocha` — only `node:test`; no `passport`, no `auth0`, no `clerk`;
  no `@swc/core`, no `babel` — the compiler is `@vue/compiler-sfc`
  plus whatever TypeScript transform the repo already uses.

**Packet-specific:**
- The loader is **tests-only**. Runtime SFC handling in Vite for
  `pnpm dev` and `pnpm build` is unchanged (`@vitejs/plugin-vue`
  remains the runtime transform). Do not touch Vite config.
- `compileVue` is a **pure function**: input is a string + filename,
  output is a string + optional sourcemap. No I/O. No `console.*`. No
  wall clock. No mutation of inputs.
- The loader hook reads the `.vue` file via `node:fs/promises`, passes
  contents to `compileVue`, and returns the result to Node's module
  system. Errors produce full-sentence messages naming the offending
  `.vue` file and the compiler diagnostic that failed.
- Style blocks (`<style>`) are **stripped** at test time (they emit no
  code). Test-time components render without CSS; this is acceptable
  because HUD/component tests assert on text content and
  `aria-label`-ed elements (per WP-062 debuggability), not on computed
  styles.
- `<script lang="ts">` is supported: after SFC block extraction, the
  TypeScript script content is passed through the **same TypeScript
  transform the repo already uses under `node:test`** (tsx or
  equivalent). Do not introduce a second TS transform.
- Sourcemaps are emitted so test stack traces point at `.vue` line
  numbers, not compiled JS. Inline sourcemap comment is acceptable.
- Consumers opt in via one of two mechanisms:
  1. `NODE_OPTIONS=--import @legendary-arena/vue-sfc-loader/register`
     in the consumer's `test` script (cross-platform, preferred).
  2. `node --import @legendary-arena/vue-sfc-loader/register
     --test src/**/*.test.ts` direct invocation.
  The README documents both patterns.

**Session protocol:**
- If `apps/registry-viewer/` already has a home-rolled SFC test
  shim, stop and ask before removing it — do not silently break
  existing tests. Consolidation must be explicit.
- If Node 22 `module.register()` behavior differs from documentation
  on Windows, stop and ask. Do not work around platform differences
  with per-OS code paths.

**Locked contract values:**
- Package name: `@legendary-arena/vue-sfc-loader`.
- Register entry import specifier:
  `@legendary-arena/vue-sfc-loader/register`.
- Exported helper: `compileVue(source: string, filename: string):
  { code: string; map?: string }`.

---

## Debuggability & Diagnostics

- **Compiler diagnostics surface loudly:** when `@vue/compiler-sfc`
  emits a diagnostic, the loader throws a full-sentence `Error`
  naming the `.vue` file path, the block type (`template` | `script`),
  and the diagnostic text verbatim. Example: `Compilation of
  "src/components/Hello.vue" failed in <template>: Element is missing
  end tag.`
- **Sourcemaps point at `.vue`:** test stack traces from a failing
  SFC test show the original `.vue` file and line number, not the
  generated JS. The register hook returns a `source` + `sourcemap`
  pair to Node.
- **No silent fallbacks:** if a file ends in `.vue` but parsing
  produces zero blocks, the loader throws (do not return an empty
  module silently).
- **`DEBUG=vue-sfc-loader` env opt-in:** when set, the loader writes a
  one-line summary to stderr for each compiled file:
  `compiled <file> blocks=<template|script|style counts>
  bytesIn=<N> bytesOut=<N>`. Silent otherwise.
- **Deterministic compilation:** given identical input source + id,
  `compileVue` returns byte-identical output across runs. A test
  asserts this directly.

---

## Scope (In)

### A) Package scaffold

- `packages/vue-sfc-loader/package.json` — **new**. Name
  `@legendary-arena/vue-sfc-loader`. `private: true`. Scripts:
  `build`, `test`, `typecheck`. Exports map publishing `./register`
  as a subpath entry so `--import @legendary-arena/vue-sfc-loader/register`
  resolves. Runtime deps: `@vue/compiler-sfc` (version matches the
  repo's `vue` dep exactly), `vue`. Dev deps: `@vue/test-utils`,
  `jsdom`, `typescript`.
- `packages/vue-sfc-loader/tsconfig.json` — **new**. Strict mode.
  Extends the repo's root TS config.
- `packages/vue-sfc-loader/README.md` — **new**. Engineering-grade
  usage doc: two consumer patterns (`NODE_OPTIONS` and direct
  `--import`), example `.vue` test, debugging tips, known limitations
  (no style rendering, script lang inheritance).

### B) SFC compiler wrapper

- `packages/vue-sfc-loader/src/compileVue.ts` — **new**:
  - `compileVue(source: string, filename: string): { code: string;
    map?: string }`
  - Uses `@vue/compiler-sfc` `parse`, `compileTemplate`, and
    `compileScript`.
  - Concatenates the compiled script and template render function into
    a single ESM module.
  - Strips `<style>` blocks (emits no code for them).
  - Handles `<script lang="ts">` by delegating to the repo's existing
    TS transform at the consumer level (this file produces JS that
    still contains TS if `lang="ts"` is detected — the TS-transform
    step applied to `.ts` files picks it up).
  - Emits inline sourcemap comment when `@vue/compiler-sfc` produces a
    map.
  - `// why:` comment explaining why style blocks are stripped in
    tests (CSS has no runtime effect under jsdom and tests assert on
    text + a11y, not styles).
  - Throws full-sentence errors naming file + block + diagnostic.

### C) Node module loader hook

- `packages/vue-sfc-loader/src/loader.ts` — **new**:
  - Exports Node 22 loader hook functions (`load`, optional `resolve`).
  - `load(url, context, nextLoad)`: if `url` ends in `.vue`, read the
    file via `node:fs/promises`, call `compileVue`, return
    `{ format: 'module', source: code, shortCircuit: true }`.
    Otherwise delegate to `nextLoad`.
  - Handles `file://` URL decoding via `node:url`'s `fileURLToPath`.
  - `// why:` comment: the loader only intercepts `.vue` — any other
    extension is passed through untouched so the TypeScript loader
    above it still runs.

### D) Register entry

- `packages/vue-sfc-loader/src/register.ts` — **new**:
  - Calls `register('./loader.js', import.meta.url)` from
    `node:module`.
  - Two lines of code. The point is to give consumers a stable
    `@legendary-arena/vue-sfc-loader/register` specifier.
  - `// why:` comment: this file exists purely so consumers have one
    flag to set (`--import @legendary-arena/vue-sfc-loader/register`)
    regardless of internal structure.

### E) Test fixture

- `packages/vue-sfc-loader/test-fixtures/hello.vue` — **new**. A
  minimal valid SFC with `<script setup lang="ts">` and `<template>`,
  exporting a component that renders `Hello, {{ name }}!` when given a
  `name` prop. Includes a trivial `<style>` block so the style-strip
  behavior is exercised.

### F) Tests

- `packages/vue-sfc-loader/src/compileVue.test.ts` — **new**, uses
  `node:test` + `node:assert`:
  - Compiling `hello.vue` (read via `node:fs/promises`) returns a
    `code` string containing a `default export` of a component.
  - The `<style>` block content is absent from the returned code.
  - Two identical calls produce byte-identical output (determinism).
  - Calling with malformed `.vue` content throws a full-sentence error
    naming the fixture filename and the compiler diagnostic.
- `packages/vue-sfc-loader/src/loader.test.ts` — **new**, uses
  `node:test` + `node:assert` + `@vue/test-utils` + `jsdom`:
  - Spawns a child Node process with
    `--import @legendary-arena/vue-sfc-loader/register` and runs a
    script that imports `hello.vue`, mounts it, and asserts the DOM
    text matches `Hello, Claude!` when `name="Claude"` is passed.
  - Asserts that stack traces from a deliberately broken fixture
    reference the `.vue` file path (sourcemap integrity).
  - `// why:` comment on the child-process pattern: loader hooks
    install per-process, so verifying them requires a fresh process.

---

## Out of Scope

- No changes to Vite config anywhere in the repo. Runtime SFC handling
  stays with `@vitejs/plugin-vue` via Vite — do not touch it.
- No hot module replacement. HMR is a dev-server concern, not a test
  concern.
- No CSS-in-JS, no scoped-style simulation under jsdom. Tests that
  need computed styles are out of scope for this loader; they belong
  in future E2E/integration WPs.
- No custom language blocks (`<i18n>`, `<docs>`, etc.). Stripped
  silently at test time only if present; production Vite handles them.
- No Vue 2 support. Vue 3 only.
- No TypeScript transform implementation — this package delegates TS
  handling to the repo's existing transform layer.
- No changes to `apps/*` or `packages/game-engine/**`,
  `packages/registry/**`, `packages/preplan/**` beyond the
  workspace-manifest update (if required).
- Refactors, cleanups, or "while I'm here" improvements.

---

## Files Expected to Change

- `packages/vue-sfc-loader/package.json` — **new**
- `packages/vue-sfc-loader/tsconfig.json` — **new**
- `packages/vue-sfc-loader/README.md` — **new**
- `packages/vue-sfc-loader/src/compileVue.ts` — **new**
- `packages/vue-sfc-loader/src/compileVue.test.ts` — **new**
- `packages/vue-sfc-loader/src/loader.ts` — **new**
- `packages/vue-sfc-loader/src/loader.test.ts` — **new**
- `packages/vue-sfc-loader/src/register.ts` — **new**
- `packages/vue-sfc-loader/test-fixtures/hello.vue` — **new**
- Root `pnpm-workspace.yaml` — **modified** only if the new package is
  not already covered by an existing glob
- Root `package.json` — **modified** only if the new direct deps
  (`@vue/compiler-sfc`, `jsdom`, `@vue/test-utils`) need to be added
  at the workspace root. Otherwise all deps live inside the new
  package's `package.json`.
- `docs/ai/STATUS.md` — **modified** (governance per DoD)
- `docs/ai/DECISIONS.md` — **modified** (governance per DoD —
  consolidation decision if `apps/registry-viewer/` had a prior shim;
  Vue version pinning; Node 22 loader-API choice; style-strip
  rationale)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (governance per
  DoD)

No other files may be modified. `apps/arena-client/**`,
`apps/registry-viewer/**`, `apps/server/**`,
`packages/game-engine/**`, `packages/registry/**`,
`packages/preplan/**` must be untouched.

---

## Acceptance Criteria

### Package Scaffold
- [ ] `@legendary-arena/vue-sfc-loader` exists as a private package
      under `packages/vue-sfc-loader/`.
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader build` exits 0.
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader typecheck` exits 0.
- [ ] `package.json` exports map publishes
      `./register` at subpath `@legendary-arena/vue-sfc-loader/register`.

### Compiler Wrapper
- [ ] `compileVue` is a pure function (no `console.*`, no `fs`, no
      wall clock, no RNG — confirmed with `Select-String`).
- [ ] Compiling `test-fixtures/hello.vue` returns a string containing
      an ESM default export.
- [ ] Style blocks are stripped from the returned code.
- [ ] Two identical calls produce byte-identical output.
- [ ] Malformed `.vue` input throws a full-sentence error naming file
      and diagnostic.

### Loader Hook
- [ ] Importing a `.vue` file via a child Node process with
      `--import @legendary-arena/vue-sfc-loader/register` succeeds.
- [ ] The imported component mounts under `@vue/test-utils` + `jsdom`
      and renders the expected text.
- [ ] A deliberately broken fixture produces a stack trace referencing
      the `.vue` file path (sourcemap integrity).

### Lint Alignment
- [ ] No import of `vitest`, `jest`, or `mocha` anywhere in the package
      (confirmed with `Select-String`).
- [ ] No import of `axios`, `node-fetch`, `passport`, `auth0`, or
      `clerk` anywhere in the package.
- [ ] No `Math.random`, `Date.now`, or `performance.now` in
      `compileVue.ts` or `loader.ts`.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`).
- [ ] `apps/arena-client/**`, `apps/registry-viewer/**`,
      `apps/server/**`, `packages/game-engine/**`,
      `packages/registry/**`, `packages/preplan/**` untouched.

---

## Verification Steps

```pwsh
# Step 1 — install and build
pnpm install
pnpm --filter @legendary-arena/vue-sfc-loader build
# Expected: exits 0

# Step 2 — typecheck
pnpm --filter @legendary-arena/vue-sfc-loader typecheck
# Expected: exits 0

# Step 3 — run tests (includes the loader child-process test)
pnpm --filter @legendary-arena/vue-sfc-loader test
# Expected: all tests passing

# Step 4 — confirm no forbidden test-runner imports
Select-String -Path "packages\vue-sfc-loader\src" -Pattern "from 'vitest'|from 'jest'|from 'mocha'" -Recurse
# Expected: no output

# Step 5 — confirm no forbidden HTTP/auth packages
Select-String -Path "packages\vue-sfc-loader\src" -Pattern "from 'axios'|from 'node-fetch'|from 'passport'|from 'auth0'|from 'clerk'" -Recurse
# Expected: no output

# Step 6 — confirm compiler-wrapper purity
Select-String -Path "packages\vue-sfc-loader\src\compileVue.ts" -Pattern "console\.|Date\.now|Math\.random|performance\.now|from 'node:fs"
# Expected: no output

# Step 7 — confirm register entry uses node:module
Select-String -Path "packages\vue-sfc-loader\src\register.ts" -Pattern "from 'node:module'"
# Expected: at least one match

# Step 8 — confirm other packages and apps untouched
git diff --name-only apps/arena-client/ apps/registry-viewer/ apps/server/ packages/game-engine/ packages/registry/ packages/preplan/
# Expected: no output

# Step 9 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] Preflight items all resolved (Vue version confirmed, viewer
      precedent consolidated if present, `jsdom` + `@vue/test-utils`
      availability settled, Node 22 loader-API behavior confirmed on
      Windows).
- [ ] All acceptance criteria above pass.
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader build` exits 0.
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader test` exits 0.
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader typecheck`
      exits 0.
- [ ] No forbidden test-runner, HTTP, or auth package imports in the
      new package.
- [ ] Loader child-process test proves end-to-end import + mount works.
- [ ] `apps/arena-client/**`, `apps/registry-viewer/**`,
      `apps/server/**`, `packages/game-engine/**`,
      `packages/registry/**`, `packages/preplan/**` untouched.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — `node:test` can now import `.vue`
      SFCs across the repo via one shared loader; WP-061 onward are
      unblocked.
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: Vue version
      pinning; whether `apps/registry-viewer/` had a prior shim and
      how it was consolidated; style-strip rationale; Node 22 loader
      API choice and observed Windows behavior; decision not to emit
      styles under jsdom.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-065 checked off with
      today's date and a note linking this file.
