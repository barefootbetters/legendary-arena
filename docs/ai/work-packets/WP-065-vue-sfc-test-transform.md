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

## Load-Bearing Invariants (Do Not Violate)

The following rules are relied upon by downstream UI work packets
(WP-061, WP-062, WP-064, and every future client UI WP) and by CI
determinism guarantees. Violations may not fail locally but will
surface as cross-platform divergence, CI-only errors, or subtle
mount-assertion failures far from the change site.

- **Loader chain ordering is fixed:** the repo's canonical TS loader
  always runs *before* `@legendary-arena/vue-sfc-loader/register`.
  Consumer `.test.ts` files get TS-transformed first; `.vue` imports
  are then SFC-compiled by this package. Reversing the order breaks
  `<script lang="ts">` handling in unrelated ways.
- **POSIX filename normalization in `compileVue`:** all filenames
  passed as the compiler `id` are POSIX-normalized
  (`filename.replace(/\\/g, '/')`). The original OS-native path is
  retained for error messages only. Compiler `id` identity is what
  determines byte-level emission stability across Windows and Linux.
- **JS-only emission from `compileVue`:** the returned `code` is
  always parseable as ESM JavaScript by Node 22 with no further
  transform. TS stripping, when needed, is performed *inside*
  `compileVue` via `typescript.transpileModule` — never by an outer
  loader. Node's loader chain does not re-transform the string
  returned from `load()`.
- **Sourcemap tolerance contract:** the acceptance bar is "stack
  trace contains the `.vue` path **and** a non-zero line number".
  Perfect column accuracy is explicitly out of scope because
  `@vue/compiler-sfc` produces separate maps for template and script
  and merging them perfectly is non-trivial.
- **Loader scope is `.vue`-only:** `load()` intercepts only URLs
  ending in `.vue`. Every other extension is passed through to
  `nextLoad` untouched so upstream loaders (TS, JSON, etc.) still run.

Each invariant above is enforced by an Acceptance Criterion or a test
in `## Scope (In)`. Changes to these rules require a DECISIONS.md
entry, not a silent edit.

---

## Preflight (Must Pass Before Coding)

- **Vue version pinned:** confirm the exact `vue` version used by
  `apps/registry-viewer/`. `@vue/compiler-sfc` must match that version
  exactly (they are released together). A mismatch produces silent
  correctness drift in compiled templates.
- **`apps/registry-viewer/` test precedent:** grep for any existing
  `.vue` imports inside the viewer's test files or any existing
  `register.mjs` / loader hook / custom transform. Two outcomes:
  - **No existing shim found** → proceed. Document the finding in
    DECISIONS.md ("no prior SFC test shim in registry-viewer;
    vue-sfc-loader is the first transform").
  - **An existing shim IS found** → this WP is **BLOCKED**.
    Consolidation requires modifying files under
    `apps/registry-viewer/**`, which is explicitly out of scope for
    this packet's Scope Enforcement (see `## Files Expected to
    Change`). Do not silently leave two parallel transforms; do not
    expand this packet's file set to cover shim removal. Instead,
    draft a dedicated "Consolidate registry-viewer SFC shim" WP that
    lists the exact shim files to remove and runs before WP-065, or
    narrowly amend this packet's Files Expected to Change with the
    exact shim file paths (no wildcard) and the rationale in
    DECISIONS.md.
- **`jsdom` and `@vue/test-utils` availability:** confirm whether the
  repo already depends on these. If not, this WP adds both as
  dependencies of `@legendary-arena/vue-sfc-loader`. Their versions
  must match Vue 3.
- **Node 22 loader API stability:** confirm that `module.register()`
  with `--import` is still the supported API on the project's target
  Node version (22+). This is the Node API this packet uses directly.
  Log the exact Node minor version in DECISIONS.md.
- **Canonical TS loader name:** identify the repo's canonical TS
  loader package for `node:test` (the one that handles consumer
  `.test.ts` files). Candidates include `tsx`, `ts-node`, a repo-local
  loader, or whatever `apps/registry-viewer/`'s `test` script already
  imports. Record the exact package name verbatim in DECISIONS.md
  and substitute it for the `<repo-ts-loader>` placeholder in this
  package's README before the session completes. If no canonical TS
  loader is identifiable, STOP and raise the decision to a separate
  WP — this packet must not introduce one.
- **`<script lang="ts">` smoke-test before writing `compileVue.ts`:**
  `@vue/compiler-sfc`'s `compileScript` behavior on TypeScript varies
  across versions — sometimes it strips TS types, sometimes it emits
  TS-with-types. `compileVue` **must always return JS** (see
  Non-Negotiable Constraints). Before coding, run a one-off smoke
  test: feed a minimal SFC with `<script lang="ts">` containing a
  type annotation into `compileScript` with `babelParserPlugins:
  ['typescript']` and inspect the output. Two outcomes:
  - Output is already plain JS → record in DECISIONS.md ("version
    X.Y.Z emits plain JS for `lang='ts'`; no secondary TS pass
    required"). `compileVue` emits `compileScript` output directly.
  - Output still contains TS syntax → `compileVue` applies
    `typescript.transpileModule({ module: 'ESNext', target:
    'ES2022' })` to the script block after `compileScript`, before
    concatenating with the template render function. Add
    `typescript` to the package's direct dependencies. Record this
    in DECISIONS.md.
  Do NOT attempt to "let the outer TS loader catch up" — Node's
  loader chain does not re-transform the string returned from
  `load()`.
- **Architecture layer classification (already merged on `main`):**
  verify that `docs/ai/ARCHITECTURE.md` on the current branch
  contains all three of the following, merged 2026-04-16 to prepare
  for this packet:
  1. A "Shared Tooling" row in §Layer Boundary's Layer Overview
     table.
  2. A `packages/vue-sfc-loader/ @legendary-arena/vue-sfc-loader`
     entry in §Section 1 — Monorepo Package Boundaries with its
     responsibility, layer, and import rules.
  3. A `vue-sfc-loader` row in the §Package Import Rules table
     including the anti-production-bundle rule.
  If any of the three is missing, STOP — do not attempt to amend
  ARCHITECTURE.md from inside this packet. ARCHITECTURE.md is not
  listed in `## Files Expected to Change`, so editing it here would
  be a scope violation. If an amendment is needed, either land it
  separately on `main` first or narrowly amend this packet's file
  list with the ARCHITECTURE.md entry and a DECISIONS.md rationale.

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
  no `@swc/core`, no `babel`. Permitted compilers: `@vue/compiler-sfc`
  for SFC parsing and `typescript` (the TS compiler package) **only
  inside `compileVue`** for the `transpileModule` TS→JS pass, if the
  Preflight smoke test shows it is needed. No other TS transform
  (tsx, ts-node, esbuild, etc.) is installed inside this package.

**Packet-specific:**
- The loader is **tests-only**. Runtime SFC handling in Vite for
  `pnpm dev` and `pnpm build` is unchanged (`@vitejs/plugin-vue`
  remains the runtime transform). Do not touch Vite config.
- `compileVue` is a **pure function**: input is a string + filename,
  output is a string + optional sourcemap. No I/O. No `console.*`. No
  wall clock. No mutation of inputs.
- `compileVue` is **not a general SFC compiler**. It exists solely to
  produce **Node-parseable ESM JavaScript** for test environments.
  This boundary preempts future "why not emit styles?", "why not
  support custom blocks?", and "why not let an external TS loader
  handle TS?" expansions — all three are out of scope by design, not
  oversight.
- **`compileVue` MUST emit JavaScript only — never TypeScript**, even
  when the input `<script lang="ts">` contains TS syntax. Node's
  loader chain decides transforms by the specifier (`.vue`); once
  `load()` returns `{ format: 'module', source: <string> }`, no
  further loader gets a second pass at that string as TS. Relying on
  tsx or any external TS loader to "catch up after" would fail with
  `Unexpected token` errors on `lang="ts"` SFCs.
  - If the Preflight smoke test proves
    `@vue/compiler-sfc.compileScript({ ..., babelParserPlugins:
    ['typescript'] })` already emits plain JS for `lang="ts"`,
    record that in DECISIONS.md and no further action is needed.
  - Otherwise, `compileVue` applies a deterministic TS-to-JS pass
    **internally** using `typescript.transpileModule` with
    `{ module: 'ESNext', target: 'ES2022' }` (or whatever settings
    Preflight confirms match the repo). `typescript` is added as a
    direct dependency. No Babel, no SWC, no tsx dependency inside
    this package.
- The loader hook reads the `.vue` file via `node:fs/promises`, passes
  contents to `compileVue`, and returns the result to Node's module
  system. Errors produce full-sentence messages naming the offending
  `.vue` file and the compiler diagnostic that failed.
- **Filename normalization for compiler identity:** `compileVue`
  normalizes filenames to POSIX-style forward slashes before passing
  them as the compiler `id` (so the same SFC produces byte-identical
  output on Windows and Linux CI). The original OS-native path is
  still used for error messages so humans see the path their shell
  understands. This is a determinism-load-bearing rule; a test
  asserts that two calls with `C:\foo\Hello.vue` and `/foo/Hello.vue`
  as filenames produce compiler outputs differing only in the error
  path (never in the emitted module body).
- **Style and unknown-custom blocks are stripped — this is
  intentional test-time behavior, not a silent fallback.** The
  compiler stripping is documented and counted in DEBUG output (see
  Debuggability). "No silent fallbacks" applies to *parse failures*
  and *zero-block results* (which throw), not to intentional
  block-type omission at test time.
- Sourcemaps are emitted so test stack traces reference the `.vue`
  file path with a non-zero line number. Perfect column accuracy is
  not required — `@vue/compiler-sfc` produces separate maps for
  template and script, and merging them perfectly is non-trivial.
  Inline sourcemap comment is acceptable. The acceptance criterion
  is "stack trace contains the `.vue` path **and** a non-zero line
  number", not "maps every byte."
- **Consumers opt in via one canonical `NODE_OPTIONS` pattern**
  documented in the README. The pattern is composed of two loaders
  in a fixed order:
  - `NODE_OPTIONS="--import <repo-ts-loader> --import @legendary-arena/vue-sfc-loader/register"`
    — TS loader first (so consumer `.test.ts` files are handled),
    Vue loader second (handles `.vue` imports). `compileVue` itself
    emits JS only, so this composition is stable.
  - The exact name of `<repo-ts-loader>` (e.g., `tsx`, `ts-node`, or
    a repo-internal loader) is **not baked into this WP** — it is
    determined by the Preflight item below and recorded in
    DECISIONS.md. The README uses the literal confirmed name when
    the session executes; before execution, the README placeholder
    reads `<repo-ts-loader>` verbatim.
  - Alternatives (direct `node --import ...`) are shown in the
    README but are not the recommended default.

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
- **Sourcemaps reference `.vue` path and line number:** test stack
  traces from a failing SFC test show the original `.vue` file path
  and a non-zero line number. Perfect column mapping is not required
  — merging `compileTemplate` and `compileScript` maps perfectly is
  non-trivial and out of scope. Success is defined as "a human can
  find the failing line in the `.vue` file from the stack trace."
- **Parse-failure and zero-block throws — not silent:** if a file
  ends in `.vue` but `@vue/compiler-sfc.parse` throws OR returns zero
  `<template>`/`<script>` blocks combined, the loader throws a
  full-sentence `Error`. Intentional stripping of `<style>` blocks
  and unknown custom blocks is **not** a silent fallback — it is
  documented test-time behavior and is surfaced via the DEBUG
  counters below.
- **`DEBUG=vue-sfc-loader` env opt-in:** when set, the loader writes a
  one-line summary to stderr for each compiled file:
  `compiled <file> template=<0|1> script=<0|1> styleStripped=<N>
  customStripped=<N> bytesIn=<N> bytesOut=<N>`. Silent otherwise.
  Custom-block counts make the intentional stripping visible without
  dumping contents.
- **Deterministic compilation (load-bearing):** given identical
  source, identical POSIX-normalized filename, and identical
  `@vue/compiler-sfc` / `typescript` versions, `compileVue` returns
  byte-identical output across runs and across OSes (Windows vs
  Linux CI). A test asserts this directly by compiling the same
  source with two filename inputs — `C:\fix\hello.vue` and
  `/fix/hello.vue` — and asserting identical emitted module bodies.

---

## Scope (In)

### A) Package scaffold

- `packages/vue-sfc-loader/package.json` — **new**. Name
  `@legendary-arena/vue-sfc-loader`. `private: true`. Scripts:
  `build` (runs `tsc` only — **no bundler**, no esbuild, no rollup),
  `test`, `typecheck`. Exports map publishes `./register` as a
  subpath entry pointing at the compiled `dist/register.js`, so
  `--import @legendary-arena/vue-sfc-loader/register` resolves.
  - **Dependency strategy (anti-duplication and version alignment):**
    - `peerDependencies`: `vue` and `@vue/compiler-sfc` — pinned to
      match the repo's current Vue version exactly. This prevents
      pnpm from installing a second copy of Vue when apps consume
      this package, which would break `@vue/test-utils` mount checks
      and `instanceof` assertions in subtle ways.
    - `devDependencies`: `vue` and `@vue/compiler-sfc` at the same
      version (so this package's own tests resolve them), plus
      `@vue/test-utils`, `jsdom`, `typescript`. Use `workspace:*` or
      whatever the repo's canonical workspace-version protocol is.
    - `dependencies`: none on Vue; `typescript` is added here only
      if the Preflight TS smoke test shows `compileScript` does not
      emit plain JS (see Preflight + Non-Negotiable Constraints).
- `packages/vue-sfc-loader/tsconfig.json` — **new**. Strict mode.
  Extends the repo's root TS config. Emits ESM to `dist/` (the
  package's published entry is compiled JS, not TS — important
  because consumers `--import` the compiled `register.js` via the
  exports map and no TS loader is in the chain yet at that point).
- `packages/vue-sfc-loader/README.md` — **new**. Engineering-grade
  usage doc. Must document:
  - The **canonical `NODE_OPTIONS` composition pattern**, with the
    TS loader name as a placeholder in the draft:
    `NODE_OPTIONS="--import <repo-ts-loader> --import @legendary-arena/vue-sfc-loader/register"`
    (TS loader first, Vue loader second — so consumer `.test.ts`
    files get TS-transformed and `.vue` imports then get SFC-compiled
    by this package). The literal string `<repo-ts-loader>` is
    replaced with the exact package name confirmed in the Preflight
    "Canonical TS loader name" item and recorded in DECISIONS.md
    before the session closes.
  - A worked example: minimal `.vue`, minimal `.test.ts` that
    imports and mounts it, `package.json` script line.
  - Debugging tips: `DEBUG=vue-sfc-loader`, how to read stack traces,
    how to find the sourcemap.
  - Known limitations: no style rendering, no HMR, no custom blocks,
    tests-only.
  - Troubleshooting section: cross-reference the "Common Failure
    Smells" table in `EC-065-vue-sfc-loader.checklist.md` so a
    consumer hitting a cryptic error (e.g., `Unexpected token` in a
    `.test.ts`) can diagnose loader-ordering, TS-pass, or
    peer-dependency misconfiguration without re-reading this WP.

### B) SFC compiler wrapper

- `packages/vue-sfc-loader/src/compileVue.ts` — **new**:
  - `compileVue(source: string, filename: string): { code: string;
    map?: string }`.
  - **Filename normalization:** before any call into
    `@vue/compiler-sfc`, `filename` is normalized to POSIX
    (`filename.replace(/\\/g, '/')`) and used as both the `filename`
    parameter to the compiler and the compiler `id`. The original
    OS-native filename is retained for error messages. `// why:`
    comment: deterministic compiler identity across Windows and Linux.
  - Uses `@vue/compiler-sfc` `parse`, `compileTemplate`, and
    `compileScript` (with `babelParserPlugins: ['typescript']` when
    `<script lang="ts">` is detected).
  - **Emits JavaScript only.** If the Preflight smoke test shows
    `compileScript` output still contains TS syntax, `compileVue`
    feeds the script block through `typescript.transpileModule({
    compilerOptions: { module: 'ESNext', target: 'ES2022',
    sourceMap: true } })` before concatenation. The emitted module
    body must be parseable as ESM JavaScript by Node 22 without any
    further transform.
  - Concatenates the compiled script (now JS) and the template render
    function into a single ESM module with **exactly one `export
    default`** (the Vue component object, typically the result of
    `defineComponent(...)` when `<script setup>` is used, or the
    script's existing default export merged with the template's
    render function). No additional top-level exports may leak into
    the emitted module unless they are required by `@vue/compiler-sfc`
    output (document any such required re-exports in the README).
  - **SFC validity rules (explicit):**
    - A template-only SFC (one `<template>`, zero `<script>`) is
      **valid**: compile the template and synthesize a default-export
      component object wrapping the render function.
    - A script-only SFC (zero `<template>`, one `<script>`) is
      **valid**: emit the compiled script with its existing default
      export; no render function required.
    - Zero templates AND zero scripts is **invalid**: throw a
      full-sentence error naming the file.
    - More than one `<template>` or more than one `<script>` block
      is **invalid** per Vue 3 SFC rules: delegate the diagnostic to
      `@vue/compiler-sfc.parse` and re-throw with the file path
      prefix.
  - **Strips `<style>` blocks and any unknown custom blocks** —
    intentional test-time behavior documented in Non-Negotiable
    Constraints. `// why:` comment on each strip point.
  - Emits an inline sourcemap comment pointing at the `.vue` path
    and a non-zero line number (perfect column accuracy not
    required; see Non-Negotiable Constraints sourcemap rule).
  - Throws full-sentence errors naming file + block + diagnostic.
  - Pure function: no I/O, no `console.*`, no wall clock, no RNG, no
    mutation of `source` or `filename`.

### C) Node module loader hook

- `packages/vue-sfc-loader/src/loader.ts` — **new**:
  - Exports Node 22 loader hook functions (`load`, optional
    `resolve`).
  - `load(url, context, nextLoad)`: if `url` ends in `.vue`, read the
    file via `node:fs/promises`, call `compileVue`, return
    `{ format: 'module', source: code, shortCircuit: true }`.
    Otherwise delegate to `nextLoad`.
  - Handles `file://` URL decoding via `node:url`'s `fileURLToPath`.
  - **`resolve()` is implemented only if Preflight proves it is
    necessary.** If default Node resolution correctly maps
    `./Hello.vue` specifiers to `file://` URLs on both Windows and
    Linux, `resolve()` is omitted (keeping the loader surface
    minimal). If Preflight discovers a Windows-specific misbehavior
    (e.g., drive-letter paths not resolving to `file://` URLs),
    implement `resolve()` to force `file://` URL construction via
    `node:url`'s `pathToFileURL` and document the case in
    DECISIONS.md. Do NOT implement `resolve()` speculatively.
    `// why:` (for the WP itself, not the code) implementing
    `resolve()` too eagerly risks diverging from Node's native
    resolution semantics and breaking interop with other loaders in
    the chain. A minimal loader surface is easier to audit, port to
    future Node LTS versions, and compose with the canonical TS
    loader. Any future maintainer tempted to "helpfully" add
    `resolve()` must first produce a failing-test case that default
    Node resolution cannot handle.
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
    install per-process, so verifying them requires spawning a fresh
    Node process with the `--import` flags. In-process testing would
    verify hook registration in isolation but not actual import
    resolution or `.vue` compilation end-to-end.

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
- No attempt is made to track, polyfill, or forward-port **future Vue
  SFC features** (e.g., new block types, evolving `<script setup>`
  syntax, or post-3.x compiler APIs) inside this loader. When Vue
  ships new SFC capabilities, the response is to bump
  `@vue/compiler-sfc` in lockstep with `vue` and retest — never to
  add per-feature shims inside `compileVue`. This keeps the loader's
  surface area bounded by whatever `@vue/compiler-sfc` already
  supports at the pinned version.
- No general-purpose TypeScript loader (tsx, ts-node, esbuild-register,
  @swc/register, etc.) is introduced. This package performs a
  **minimal, deterministic type-stripping pass** via
  `typescript.transpileModule` **only inside `compileVue`** and **only
  when the Preflight smoke test shows `@vue/compiler-sfc.compileScript`
  leaves TS syntax in its output**. Consumer `.test.ts` files remain
  the responsibility of the repo's canonical TS loader, invoked via
  `NODE_OPTIONS` before this package's loader (see README).
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
      exactly one `export default` statement at the top level. No
      additional top-level exports appear except any required by
      `@vue/compiler-sfc` and explicitly documented in the README.
- [ ] **Output is always JavaScript** — the returned `code` is
      parseable by Node 22 without any TS transform step. The
      corresponding test writes the output to a temp `.js` file in
      `$env:TEMP`, requires it via a spawned child Node process,
      asserts exit code `0`, asserts `stderr` does NOT contain
      `SyntaxError`, and deletes the temp file in a `finally` block.
- [ ] The emitted module's `export default` is a Vue component
      object that `@vue/test-utils`' `mount()` accepts (verified by
      the loader child-process test in §Loader Hook).
- [ ] Style blocks and unknown custom blocks are stripped from the
      returned code; a DEBUG summary emitted under
      `DEBUG=vue-sfc-loader` names the stripped counts.
- [ ] Two identical calls with the same source + POSIX filename
      produce **byte-for-byte identical** emitted module bodies after
      stripping the sourcemap comment line. The sourcemap comment
      may encode the filename or other context and is allowed to
      differ across equivalent calls; the executable module body
      must not. A future maintainer may not weaken this assertion
      (e.g., to "semantically equivalent" or "AST-identical") —
      byte-for-byte is the contract.
- [ ] **Filename normalization holds cross-platform**: compiling the
      same source with `C:\fix\hello.vue` and `/fix/hello.vue` as
      filenames produces **byte-for-byte identical** emitted module
      bodies (same sourcemap-comment-stripped comparison; error-path
      strings may differ; module output must not).
- [ ] A template-only SFC (no `<script>`) compiles and mounts.
- [ ] A script-only SFC (no `<template>`) compiles and exports a
      valid component.
- [ ] Malformed `.vue` input throws a full-sentence error naming
      file and diagnostic.
- [ ] A `.vue` input with zero `<template>` AND zero `<script>`
      blocks throws (not returns empty).

### Loader Hook
- [ ] Importing a `.vue` file via a child Node process with the
      canonical `NODE_OPTIONS` pattern succeeds.
- [ ] The imported component mounts under `@vue/test-utils` + `jsdom`
      and renders the expected text.
- [ ] A deliberately broken fixture produces a stack trace that
      contains the `.vue` file path **and** a non-zero line number.
      Perfect column accuracy is not asserted (sourcemap merging
      between template and script is non-trivial).

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

# Step 10 — cross-platform determinism sanity check (run on both
# Windows and Linux CI if feasible)
# The determinism test inside compileVue.test.ts already asserts
# byte-for-byte identical output across C:\ and POSIX filenames on
# the current host. If WP-065 is ever re-executed on a new OS or new
# Node minor version, re-run this filter to confirm the invariant
# still holds on the target CI environment before unblocking WP-061+.
pnpm --filter @legendary-arena/vue-sfc-loader test
# Expected: determinism test passes on the target platform
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
- [ ] `docs/ai/DECISIONS.md` updated. Each decision below is
      recorded in the repo's standard **Decision / Rationale /
      Alternatives rejected** format (three subsections per entry,
      as used elsewhere in DECISIONS.md):
      - **D-NNNN Vue version pinning via peerDependencies.**
        Rationale: pnpm can install a second copy of Vue if versions
        drift, silently breaking `@vue/test-utils` mount checks.
        Alternatives rejected: direct `dependencies` entry;
        installing Vue only in `apps/*`.
      - **D-NNNN `apps/registry-viewer/` prior-shim disposition.**
        Rationale: no two parallel SFC transforms may coexist.
        Outcome: either "no shim found, proceed" or "shim found,
        BLOCKED pending a consolidation WP". Alternatives rejected:
        silently leaving two transforms; implicit removal from this
        packet's scope.
      - **D-NNNN Intentional stripping of style and custom blocks.**
        Rationale: CSS has no runtime effect under jsdom; tests
        assert on text + a11y. Alternatives rejected: emitting
        `<style>` into a no-op module; surfacing custom blocks as
        test-visible warnings.
      - **D-NNNN Node 22 `module.register()` as the loader API.**
        Rationale: stable API in Node 22 LTS; works cross-platform.
        Alternatives rejected: legacy `--loader` hook (deprecated);
        CommonJS `require.extensions` (not ESM-compatible).
      - **D-NNNN TS strategy outcome.** Rationale: captures whether
        the Preflight smoke test showed `compileScript` emits plain
        JS, OR whether `typescript.transpileModule` is required
        inside `compileVue`. Alternatives rejected: relying on an
        outer TS loader (incompatible with Node's loader chain
        semantics — `load()` return is not re-transformed); adding
        tsx/ts-node/esbuild as an in-package dependency.
      - **D-NNNN Canonical `NODE_OPTIONS` composition pattern.**
        Rationale: deterministic loader ordering (TS first, Vue
        second) and a single documented pattern prevents per-app
        drift. Alternatives rejected: letting each app invent its
        own ordering; using direct `node --import` invocations as
        the default.
      - **D-NNNN Filename normalization to POSIX for compiler
        identity.** Rationale: Windows and Linux CI must produce
        byte-identical compiler output. Alternatives rejected:
        passing the raw OS-native path (produces divergent
        compiler IDs); using a hash instead of a path (loses
        debuggability).
      - **D-NNNN Sourcemap tolerance = path + non-zero line,
        not perfect column accuracy.** Rationale: `@vue/compiler-sfc`
        produces separate template and script maps; merging perfectly
        is non-trivial and out of scope. Alternatives rejected:
        custom map-merger (scope creep); no sourcemap (breaks stack
        trace debuggability).
      - **D-NNNN Canonical TS loader name (literal string) recorded
        after Preflight.** Rationale: the exact package name (e.g.,
        `tsx`) must be auditable and propagated to WP-061+ without
        cross-referencing commits. Alternatives rejected: hard-coding
        `tsx` before verification; leaving it implicit.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-065 checked off with
      today's date and a note linking this file.
