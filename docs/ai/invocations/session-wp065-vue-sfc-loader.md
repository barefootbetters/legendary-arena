# Session Execution Prompt — WP-065 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-065 — Vue SFC Test Transform Pipeline
**Mode:** Implementation (WP-065 not yet implemented)
**Work Packet Class:** Infrastructure & Verification
**Pre-Flight:** Complete (2026-04-17) — READY TO EXECUTE. All pre-session
actions resolved:
- **PS-1:** D-6501 created classifying `packages/vue-sfc-loader/` as
  Shared Tooling; `02-CODE-CATEGORIES.md` §Category Summary (line 46)
  and §Category Definitions (lines 221–231) updated.

**Copilot Check (01.7):** **Explicitly skipped for this packet
(accepted 2026-04-17).** Per `01.4` §Work Packet Execution Workflow,
step 1b is nominally mandatory for Infrastructure & Verification WPs.
WP-065 is narrow Shared Tooling — purely additive, no engine/state
touch, no `G` mutation, Scope Lock excludes all application trees.
The pre-flight's READY TO EXECUTE verdict (2026-04-17) plus the PS-1
completion record (D-6501 + `02-CODE-CATEGORIES.md` updates) constitute
the authorization trail in lieu of 01.7. Do not re-open this decision
during execution.

**EC:** `docs/ai/execution-checklists/EC-065-vue-sfc-loader.checklist.md`
**Pre-flight:** (inline in originating session on 2026-04-17; not saved
as a standalone artifact — if an auditable pre-flight file is required
by project policy, save it as
`docs/ai/invocations/preflight-wp065-vue-sfc-loader.md` before
execution)

**Success Condition (Binary):**
- `pnpm install` succeeds
- `pnpm --filter @legendary-arena/vue-sfc-loader build` exits 0
- `pnpm --filter @legendary-arena/vue-sfc-loader typecheck` exits 0
- `pnpm --filter @legendary-arena/vue-sfc-loader test` exits 0
- `pnpm -r build` and `pnpm -r test` continue to exit 0 on the rest of
  the repo (no regressions outside the new package)
- All WP-065 acceptance criteria and EC-065 After-Completing items
  satisfied
- Any deviation: **STOP and report failure**

---

## Runtime Wiring Allowance — NOT INVOKED

**`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` is NOT invoked by
this session prompt.**

Per 01.5 §Purpose (line 28): *"This is an allowance, not a default
right."* And per 01.5 §Escalation (line 136): *"This clause **must be
invoked in the session prompt**."* Silence therefore means the clause
does **not** apply — there is no default invocation.

Pre-flight verified WP-065 is **purely additive**, measured against the
four criteria enumerated in 01.5 §When to Include (lines 32–47):

- No new fields on `LegendaryGameState` — ABSENT (WP-065 does not touch
  `packages/game-engine/**` at all)
- No changes to `buildInitialGameState` return shape — ABSENT
- No new moves in `LegendaryGame.moves` — ABSENT
- No new phases or phase hooks — ABSENT

Per 01.5 §When to Include (lines 48–49): *"If a WP is purely additive
(new files only, no type or shape changes), this clause does not
apply."*

**Consequence:** the 01.5 allowance **may not be cited** during
execution or pre-commit review to justify edits outside the Scope Lock
below. If execution discovers a compiler error, type error, or test
failure in any file **outside** `packages/vue-sfc-loader/**` and the
three permitted governance files, **STOP and escalate** — do not
force-fit a wiring change. Per 01.5 §Escalation (lines 137–138): *"It
may **not** be cited retroactively in execution summaries or pre-commit
reviews to justify undeclared changes."*

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

### Governance Foundation

1. `.claude/CLAUDE.md`
2. `.claude/rules/architecture.md` — Layer Authority Hierarchy and the
   forbidden AI failure patterns.
3. `.claude/rules/code-style.md` — Rules 4 (no abbreviations), 6
   (`// why:` comments), 11 (full-sentence error messages), 13 (ESM
   only), and §Pure Helpers (no `boardgame.io` imports in helper files).
4. `.claude/rules/work-packets.md` — One-packet-per-session rule.

### Architecture & Work Packet Contract

5. `docs/ai/ARCHITECTURE.md` — specifically:
   - §Layer Boundary (Authoritative) — the Shared Tooling row (table
     line ~230) and the `vue-sfc-loader` row in §Package Import Rules
     (line ~199) define the enforceable boundaries for this package.
   - §Package Import Rules anti-production-bundle rule: no app may
     list `@legendary-arena/vue-sfc-loader` in `dependencies`; it is
     `devDependencies` only.
6. `docs/ai/execution-checklists/EC-065-vue-sfc-loader.checklist.md` —
   **the primary execution contract**. Every checkbox must be
   satisfied.
7. `docs/ai/work-packets/WP-065-vue-sfc-test-transform.md` — the
   authoritative specification. In any EC-vs-WP conflict, the **WP
   wins** per `.claude/CLAUDE.md` §Execution Checklists.
### Precedents & Category Verification

8. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4, 6, 11, 13 as
   above.
9. `docs/ai/DECISIONS.md` — read:
   - **D-6501 — Shared Tooling classification for
     `packages/vue-sfc-loader/`** (introduced PS-1 / WP-065).
   - D-2706, D-2801, D-3001, D-3101 — prior directory-classification
     precedents that D-6501 follows.

   **Note on ID encoding:** DECISIONS.md uses em-dashes in headings
   (e.g., `D‑0601`); grep by title keyword if a regular-hyphen ID
   search misses. Pre-flight Issue 1 flagged that D-6501's heading
   currently uses an em-dash while prior directory-classification
   entries (D-2706, D-2801, D-3001, D-3101) use regular hyphens — if
   the heading still uses an em-dash at execution time, the WP
   references still resolve via title search. Do not rewrite
   DECISIONS.md from inside this session to "normalize" the dash.
10. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — verify `shared-tooling`
    row exists in §Category Summary (line 46) and that the §Category
    Definitions block lists `packages/vue-sfc-loader/` under
    Directories. If either is missing, **STOP — PS-1 is not
    complete**.
11. `docs/ai/work-packets/WORK_INDEX.md` — confirm WP-065 is marked
    `[ ] ... ✅ Reviewed (2026-04-16 lint-gate pass)` with dependencies
    "none".

**Implementation anchors (read before coding):**

12. `apps/registry-viewer/package.json` — confirm Vue version is
    `^3.4.27`. This is the pin source for the new package's
    `peerDependencies` and `devDependencies`.
13. `packages/game-engine/package.json:19`, `packages/registry/package.json:19`,
    `apps/server/package.json:10` — confirm all three existing `test`
    scripts use `node --import tsx --test …`. This confirms the
    canonical TS loader is `tsx` (pre-flight RS-confirmed).
14. `apps/registry-viewer/` — confirm there are NO `*.test.*` files and
    NO `test` script in `package.json`. This confirms the "no prior
    SFC test shim" path is still valid at execution time.
15. Node.js 22 / 24 documentation on `module.register()` and the
    `load` / `resolve` customization hooks — `load()` is the surface
    WP-065 implements.
16. `@vue/compiler-sfc` package documentation — the authoritative
    compiler for Vue 3 SFCs. Use its `parse`, `compileScript`, and
    `compileTemplate` APIs directly. Do not reimplement SFC parsing.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for
execution. Do **not** revisit them or propose alternatives.

### 1. Canonical TS loader = `tsx` (locked)

Verified across the three existing package test scripts
(`packages/game-engine`, `packages/registry`, `apps/server`). The
WP-065 README and the canonical `NODE_OPTIONS` composition pattern
**must substitute `tsx` for the `<repo-ts-loader>` placeholder** in
the delivered README file:

```
NODE_OPTIONS="--import tsx --import @legendary-arena/vue-sfc-loader/register"
```

Keep the literal placeholder string `<repo-ts-loader>` unchanged in
the WP-065 and EC-065 spec files themselves (these are governance
documents authored to remain re-executable under a future loader
change). The substitution applies only to the delivered
`packages/vue-sfc-loader/README.md` body.

Record this substitution in a DECISIONS.md entry during execution:
**D-NNNN — Canonical TS loader = `tsx`** (see WP-065 DoD §Canonical
`NODE_OPTIONS` composition pattern).

### 2. Vue version pin = `^3.4.27` (locked)

Both `peerDependencies` and `devDependencies` blocks in
`packages/vue-sfc-loader/package.json` must pin `vue` and
`@vue/compiler-sfc` to `^3.4.27` exactly, matching
`apps/registry-viewer/package.json:15`. `@vue/compiler-sfc` releases
in lockstep with `vue`; any version drift silently corrupts
compiled templates.

Record this in a DECISIONS.md entry during execution: **D-NNNN — Vue
version pinning via peerDependencies** (see WP-065 DoD).

### 3. No prior SFC test shim in `apps/registry-viewer/` (locked)

Confirmed at pre-flight. Proceed with the "no shim found" path: no
consolidation work is in scope, and `apps/registry-viewer/**` must
remain **untouched**.

Record the finding in a DECISIONS.md entry during execution:
**D-NNNN — `apps/registry-viewer/` prior-shim disposition: none
found** (see WP-065 DoD).

### 4. Node floor ≥ v22; v24.14.1 observed at pre-flight (locked)

The WP's Node 22+ floor is the minimum requirement. Pre-flight was
conducted under Node v24.14.1. The `module.register()` +
`--import` API is stable across both. Record both the v22 floor and
the observed v24 runtime in the DECISIONS.md entry: **D-NNNN —
Node 22 `module.register()` as the loader API** (see WP-065 DoD).

### 5. ARCHITECTURE.md prerequisites already on `main` (locked)

Verified: `docs/ai/ARCHITECTURE.md` contains (a) the Shared Tooling
row in §Layer Boundary's Layer Overview table, (b) the
`packages/vue-sfc-loader/` entry in §Monorepo Package Boundaries,
and (c) the `vue-sfc-loader` row in §Package Import Rules including
the anti-production-bundle rule. **Do not edit ARCHITECTURE.md from
inside this session.** It is not in the Scope Lock below.

### 6. D-6501 already exists; Shared Tooling category row present (locked)

Verified. Do not re-create D-6501. Do not modify
`02-CODE-CATEGORIES.md` from inside this session — it is not in the
Scope Lock below. PS-1 is resolved; this session's responsibility is
the code and the remaining DoD DECISIONS.md entries (not D-6501).

### 7. TS smoke-test outcome NOT pre-decided (both branches intact)

The WP-065 Preflight item "`<script lang="ts">` smoke-test" is
**run during execution, not before**. The smoke test determines
whether `compileScript` already emits plain JS at Vue ^3.4.27 or
whether `compileVue` must internally invoke
`typescript.transpileModule({ module: 'ESNext', target: 'ES2022' })`.

- Outcome A (plain JS already): no `typescript` direct dependency;
  record in DECISIONS.md.
- Outcome B (TS remains): `typescript` is a direct dependency of
  `packages/vue-sfc-loader/`; record in DECISIONS.md.

**Do not** attempt to "let the outer TS loader catch up" — Node's
loader chain does not re-transform the string returned from
`load()`. The TS pass, when needed, happens inside `compileVue`.

### 8. `resolve()` is NOT implemented speculatively

Implement only `load()` in `loader.ts`. Only add `resolve()` if the
Preflight-style smoke test produces a failing default-resolution
case on Windows (drive-letter → `file://` URL). If `resolve()` is
added, document the exact failing case in DECISIONS.md. Adding
`resolve()` "to be safe" is a scope violation.

### 9. Sourcemap acceptance = `.vue` path + non-zero line (locked)

Do not invest in a template/script sourcemap merger. Stack traces
must contain the `.vue` file path and a line number ≥ 1. Perfect
column accuracy is explicitly out of scope. Inline sourcemap
comment is acceptable.

### 10. POSIX filename normalization is load-bearing

`filename.replace(/\\/g, '/')` applied before any call to the
compiler is a **determinism invariant**. The original OS-native
path is retained for error messages only. A dedicated test must
assert byte-for-byte identical emitted module bodies for
`C:\fix\hello.vue` vs `/fix/hello.vue` (sourcemap-comment line
stripped for the comparison; error-path strings allowed to differ;
module body must not).

### 11. `exactOptionalPropertyTypes`-safe return construction for `compileVue`

`packages/game-engine/tsconfig.json` sets
`exactOptionalPropertyTypes: true`, and WP-065 §A requires
`packages/vue-sfc-loader/tsconfig.json` to extend the repo's strict
config. The `compileVue` return type `{ code: string; map?: string }`
must therefore be built **conditionally** — assign `map` only when a
map exists, never as an inline `string | undefined` expression:

```ts
const result: { code: string; map?: string } = { code };
if (mapString !== undefined) {
  result.map = mapString;
}
return result;
```

Do **not** write `return { code, map: maybeMap }` where
`maybeMap: string | undefined`. Do **not** use an inline ternary that
can return `undefined` on one branch. Both fail type-checking under
`exactOptionalPropertyTypes`. Precedent: WP-029 `preserveHandCards`
(01.4 §Risk Review lines 1741–1747). This rule is also present as a
Guardrail in EC-065.

---

## Scope Lock (Critical)

### WP-065 Is Allowed To

Create exactly these files:

- `packages/vue-sfc-loader/package.json` — new
- `packages/vue-sfc-loader/tsconfig.json` — new
- `packages/vue-sfc-loader/README.md` — new (with `tsx` substituted
  per Locked Decision 1)
- `packages/vue-sfc-loader/src/compileVue.ts` — new
- `packages/vue-sfc-loader/src/compileVue.test.ts` — new
- `packages/vue-sfc-loader/src/loader.ts` — new
- `packages/vue-sfc-loader/src/loader.test.ts` — new
- `packages/vue-sfc-loader/src/register.ts` — new
- `packages/vue-sfc-loader/test-fixtures/hello.vue` — new

Modify only if strictly required:

- Root `pnpm-workspace.yaml` — only if the new package is not already
  covered by an existing glob
- Root `package.json` — only if the new direct deps
  (`@vue/compiler-sfc`, `jsdom`, `@vue/test-utils`) must be added at
  the workspace root rather than inside the new package

Update per governance DoD:

- `docs/ai/STATUS.md`
- `docs/ai/DECISIONS.md` — append the 9 D-entries enumerated in
  WP-065 DoD (D-6501 is separate pre-flight work from PS-1 and is
  not one of the 9; do not duplicate it)
- `docs/ai/work-packets/WORK_INDEX.md` — check WP-065 off with today's
  date

### WP-065 Is Explicitly Not Allowed To

- Touch any file under:
  - `apps/arena-client/**`
  - `apps/registry-viewer/**`
  - `apps/server/**`
  - `packages/game-engine/**`
  - `packages/registry/**`
  - `packages/preplan/**`
- Edit `docs/ai/ARCHITECTURE.md` — prerequisite content already on
  `main` (Locked Decision 5)
- Edit `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — PS-1 already
  landed it (Locked Decision 6)
- Touch any Vite config anywhere in the repo — runtime SFC handling
  stays with `@vitejs/plugin-vue` and is not in scope
- Introduce any test runner other than `node:test`
- Introduce any TS loader other than `tsx` (which is consumed via
  `NODE_OPTIONS`, not bundled into this package)
- Add `axios`, `node-fetch`, `passport`, `auth0`, `clerk`, `@swc/*`,
  or `babel` as dependencies
- Add a bundler (esbuild, rollup, swc, webpack) — `build` is `tsc`
  only
- Add `@vitejs/plugin-vue` — that is the runtime transform, not the
  test transform
- Use `Math.random()`, `Date.now()`, `performance.now()`, or any
  wall-clock source inside `compileVue.ts` or `loader.ts`
- Implement `resolve()` speculatively (Locked Decision 8)
- Expand `compileVue` to emit styles, handle custom blocks, support
  HMR, or compile Vue 2 SFCs
- Import `boardgame.io` from any file in this package — the package
  is Shared Tooling, not engine code

**Rule:** Anything not explicitly allowed is out of scope. If
compilation or tests demand a change to a forbidden file, **STOP and
escalate**.

---

## Implementation Order (Recommended)

The following order minimizes rework and keeps each verification step
meaningful. Deviate only if a specific step blocks on a discovery.

1. **Scaffold the package manifest first.**
   - `package.json`, `tsconfig.json`, `README.md` (with `<repo-ts-loader>`
     replaced by `tsx` in the composition pattern, worked example, and
     troubleshooting section). Register `"./register"` in the exports
     map pointing at `dist/register.js`.
   - Add `@vue/compiler-sfc` and `vue` as `peerDependencies` pinned to
     `^3.4.27`. Mirror them in `devDependencies`. Add
     `@vue/test-utils`, `jsdom`, and `typescript` to `devDependencies`.
     Set `build` = `tsc`; `test` = `node --import tsx --test src/**/*.test.ts`;
     `typecheck` = `tsc --noEmit`.
   - Run `pnpm install` at the workspace root. If the new package is
     not picked up, update `pnpm-workspace.yaml` (only if required).

2. **Run the `<script lang="ts">` smoke test (Locked Decision 7).**
   - Write a throwaway Node script (NOT committed) that feeds a
     minimal SFC with `<script lang="ts">` into
     `@vue/compiler-sfc.compileScript({ id: 'smoke.vue',
     babelParserPlugins: ['typescript'] })` and inspects the output.
   - Record the outcome (plain JS vs TS-remaining) as a DECISIONS.md
     entry: **D-NNNN — TS strategy outcome for vue-sfc-loader**.
   - If TS remains, keep `typescript` as a `dependencies` entry
     (not just `devDependencies`) — `compileVue` will call it at
     runtime.

3. **Implement `compileVue.ts`.**
   - Signature: `compileVue(source: string, filename: string):
     { code: string; map?: string }`. Pure function. No I/O.
   - POSIX-normalize `filename` before any compiler call. Retain the
     OS-native path for error messages. `// why:` comment: deterministic
     compiler identity across Windows and Linux.
   - Call `@vue/compiler-sfc.parse` first; re-throw diagnostics as
     full-sentence errors prefixed with the OS-native file path.
   - Compile template via `compileTemplate`; compile script via
     `compileScript` (with `babelParserPlugins: ['typescript']` when
     `<script lang="ts">` is detected).
   - Apply `typescript.transpileModule` **only** if Step 2 required it.
   - Concatenate compiled script + template render function into a
     single ESM module with exactly one `export default`.
   - SFC validity rules per WP-065 §B: template-only valid; script-only
     valid; zero+zero invalid; multi-template/multi-script invalid
     (delegate to `@vue/compiler-sfc.parse` diagnostic, re-throw with
     file-path prefix).
   - Strip `<style>` and unknown custom blocks. `// why:` comment on
     each strip site: intentional test-time behavior, not a silent
     fallback. Count strips and surface via the DEBUG line (see
     below).
   - Emit inline sourcemap comment pointing at the `.vue` path and a
     non-zero line number.
   - Throw full-sentence errors naming file + block + diagnostic.
   - **Build the `{ code; map? }` return object conditionally** per
     Locked Decision 11 — `const result: { code: string; map?: string }
     = { code }; if (mapString !== undefined) { result.map = mapString; }
     return result;`. Do NOT write `return { code, map: maybeMap }`
     inline; that fails `exactOptionalPropertyTypes`.

4. **Implement `compileVue.test.ts`.**
   - `node:test` + `node:assert` + `node:fs/promises` (for reading
     the fixture).
   - Tests:
     - Compiling `hello.vue` returns a `code` containing exactly one
       top-level `export default`.
     - Style block content is absent.
     - Two identical calls produce byte-identical bodies after
       stripping the sourcemap comment line.
     - Compiling with `C:\fix\hello.vue` and `/fix/hello.vue` as
       filenames produces byte-identical bodies (Locked Decision 10).
     - Template-only SFC compiles and exports a component.
     - Script-only SFC compiles and exports a component.
     - Zero-template AND zero-script input throws a full-sentence
       error naming the file.
     - Malformed `.vue` input throws a full-sentence error naming the
       file and the compiler diagnostic.
     - Confirm `compileVue` emits JavaScript parseable by Node 22+
       by writing the output to a temp `.js` file in `$env:TEMP`,
       spawning a child Node process to require it, asserting exit
       code 0 and no `SyntaxError` in stderr. Delete the temp file
       in a `finally` block.

5. **Implement `loader.ts`.**
   - Export a `load(url, context, nextLoad)` hook per Node 22
     customization-hook API.
   - Branch on `url.endsWith('.vue')`: read the file via
     `node:fs/promises`, call `compileVue`, return
     `{ format: 'module', source: code, shortCircuit: true }`.
   - Handle `file://` URL decoding via `node:url.fileURLToPath`.
   - For non-`.vue`, delegate to `nextLoad(url, context)`. `// why:`
     comment: upstream TS loader must still see non-`.vue` specifiers.
   - Do NOT implement `resolve()` (Locked Decision 8).
   - `DEBUG=vue-sfc-loader` env opt-in emits one line to stderr per
     compiled file in the exact format:
     `compiled <file> template=<0|1> script=<0|1> styleStripped=<N>
     customStripped=<N> bytesIn=<N> bytesOut=<N>`. Silent otherwise.

6. **Implement `register.ts`.**
   - Two-line file: `import { register } from 'node:module'; import
     { pathToFileURL } from 'node:url';` then call
     `register('./loader.js', pathToFileURL(__filename))` (or
     `import.meta.url` in a way that resolves after `tsc` emission).
   - `// why:` comment: single stable `--import` specifier for
     consumers regardless of internal layout.

7. **Commit `test-fixtures/hello.vue`.**
   - `<script setup lang="ts">` with a `name` prop.
   - `<template>` rendering `Hello, {{ name }}!`.
   - `<style>` block (content stripped at compile time).

8. **Implement `loader.test.ts`.**
   - `node:test` + `node:assert` + `@vue/test-utils` + `jsdom`.
   - Spawn a child Node process with
     `NODE_OPTIONS="--import tsx --import @legendary-arena/vue-sfc-loader/register"`.
     Inside the child, import `hello.vue`, mount it under jsdom with
     `mount(..., { props: { name: 'Claude' } })`, and assert
     `wrapper.text() === 'Hello, Claude!'`.
   - `// why:` comment on the child-process pattern: loader hooks
     install per-process, so verifying them requires spawning a fresh
     Node process with the `--import` flags. In-process testing would
     verify hook registration in isolation but not actual import
     resolution or `.vue` compilation end-to-end.
   - Second test: spawn a child with a deliberately broken fixture and
     assert the stderr stack trace contains the `.vue` path AND a
     line number ≥ 1 (Locked Decision 9).

9. **Run the EC-065 After-Completing block end-to-end.**
   - `pnpm --filter @legendary-arena/vue-sfc-loader build`, then
     `typecheck`, then `test` — each must exit 0.
   - Run all EC-065 Common Failure Smells as a mental audit of
     symptoms vs fixes before declaring done.

10. **Governance updates (DoD).**
    - Append the 9 D-entries enumerated in WP-065 DoD to
      `docs/ai/DECISIONS.md` (D-6501 is separate pre-flight work
      from PS-1 and is not one of the 9; do not duplicate). Use regular
      hyphens in the heading IDs (match D-2706 / D-2801 / D-3001 /
      D-3101 / D-6501 precedent at the end of DECISIONS.md, not the
      em-dash convention of older entries).
    - Update `docs/ai/STATUS.md` noting `node:test` can now import
      `.vue` SFCs across the repo via one shared loader, and that
      WP-061 onward are unblocked on the test-harness side.
    - Check WP-065 off in `docs/ai/work-packets/WORK_INDEX.md` with
      today's date and a link to this session prompt.

---

## Execution Verification Checklist (Mirror of EC-065 §After Completing + §Scope Enforcement)

Run each of the following after implementation. All must pass before
declaring the session complete.

**Package health:**
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader build` exits 0
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader test` exits 0

**Invariant compliance (`Select-String` on Windows, `grep` equivalent
on Linux):**
- [ ] No import of `vitest`, `jest`, or `mocha` anywhere in
  `packages/vue-sfc-loader/src`
- [ ] No import of `axios`, `node-fetch`, `passport`, `auth0`, `clerk`,
  `@swc/*`, or `babel` anywhere in `packages/vue-sfc-loader/src`
- [ ] No `Math.random`, `Date.now`, or `performance.now` in
  `compileVue.ts` or `loader.ts`
- [ ] `compileVue.ts` does not import from `node:fs` (pure function
  invariant; `loader.ts` does the reading)
- [ ] `register.ts` imports from `node:module`
- [ ] No import of `boardgame.io` anywhere in the package

**Determinism and cross-platform:**
- [ ] Determinism test passes — two identical calls produce byte-identical
  module bodies (sourcemap comment stripped)
- [ ] Filename-normalization test passes — `C:\fix\hello.vue` vs
  `/fix/hello.vue` produce byte-identical bodies (sourcemap comment
  stripped; error-path strings allowed to differ)

**End-to-end:**
- [ ] Loader child-process test proves import + mount under
  `@vue/test-utils` + `jsdom` with the canonical `NODE_OPTIONS` pattern
- [ ] Broken-fixture stack trace contains the `.vue` path and a line
  number ≥ 1

**Scope enforcement:**
- [ ] `git diff --name-only apps/arena-client/ apps/registry-viewer/ apps/server/ packages/game-engine/ packages/registry/ packages/preplan/`
  returns no output
- [ ] `git diff --name-only` lists only files from WP-065 §Files
  Expected to Change (plus this session prompt's permitted governance
  edits)
- [ ] `git status --porcelain` has no unexpected untracked files in
  restricted directories

**Governance:**
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` contains the 9 WP-065 DoD D-entries
  (D-6501 is separate pre-flight work from PS-1 and is not one of
  the 9)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checks WP-065 off with
  today's date

---

## Common Failure Smells (From EC-065 — Re-Stated Here for Session
Recovery)

- `SyntaxError: Unexpected token` in a `.test.ts` consumer →
  TS loader (`tsx`) missing from `NODE_OPTIONS` or ordered *after*
  `vue-sfc-loader`. Fix: ensure `--import tsx` appears **before**
  `--import @legendary-arena/vue-sfc-loader/register`.
- `SyntaxError` inside compiled SFC output on `<script lang="ts">` →
  Step 2 smoke test was read wrong. `compileVue` returned TS. Either
  enable the internal `typescript.transpileModule` pass (Outcome B)
  or verify the `@vue/compiler-sfc` version produces plain JS
  (Outcome A).
- Determinism test flakes on Windows-only or Linux-only CI → filename
  passed to compiler `id` was not POSIX-normalized. Locked Decision 10.
- `@vue/test-utils.mount()` fails with `instanceof` / component-identity
  errors → pnpm installed a second copy of Vue. Verify `vue` and
  `@vue/compiler-sfc` are in `peerDependencies`, NOT `dependencies`.
- Stack trace points at compiled output instead of `.vue` path →
  sourcemap inline comment missing, or `filename` argument to the
  compiler was not set. Locked Decision 9.
- `resolve()` added "to be safe" and non-`.vue` specifiers now break →
  Remove `resolve()`. Default Node resolution is the contract. Locked
  Decision 8.

---

## Execution Summary Requirements (End of Session)

At the end of the session, produce an execution summary in the same
session (before handing off to post-mortem) that includes:

1. **Files created / modified** — exact list matching the Scope Lock.
2. **Smoke-test outcome** — Outcome A (plain JS) vs Outcome B
   (TS-remaining) from Step 2, with the recorded D-NNNN ID.
3. **Test count delta** — the new test count contributed by
   `packages/vue-sfc-loader/`, plus confirmation that no test count
   outside this package changed.
4. **Canonical `NODE_OPTIONS` pattern as shipped** — the literal
   string that appears in `README.md`, with `tsx` substituted.
5. **D-entries created** — the 9 new D-NNNN IDs (one per WP-065 DoD
   decision), each one-line rationale, confirming D-6501 was NOT
   duplicated (it is separate pre-flight work from PS-1, not one of
   the 9).
6. **Scope compliance statement** — an explicit confirmation that no
   file under `apps/arena-client/**`, `apps/registry-viewer/**`,
   `apps/server/**`, `packages/game-engine/**`, `packages/registry/**`,
   `packages/preplan/**`, `docs/ai/ARCHITECTURE.md`, or
   `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` was modified.
7. **Runtime Wiring Allowance statement** — an explicit confirmation
   that 01.5 was NOT invoked, was NOT needed, and was NOT relied
   upon anywhere in the diff.
8. **Deviations** — any step where reality diverged from the
   Implementation Order above (deviations do NOT violate scope; they
   just need to be noted for post-mortem input).

---

## Post-Session Handoff

After this session completes:

- **Step 4 (Post-mortem, `01.6`):** run the 10-section post-mortem in
  the same session. For an Infrastructure & Verification WP that
  introduces new contracts (the `compileVue` signature, the
  `NODE_OPTIONS` composition pattern, the DEBUG line format), the
  post-mortem is recommended rather than strictly mandatory. If
  time-boxed, at minimum run the Projection Aliasing check (N/A for
  WP-065 — no `G` reads) and the Long-Lived Abstractions check
  (verify `compileVue` signature is stable under future Vue minors).
- **Step 5 (Pre-commit review):** separate session. Gatekeeper reads
  the diff and this session's summary; does not re-run tests.
- **Step 6 (Commit):** commit message prefix `EC-065:` per
  `01.3-commit-hygiene-under-ec-mode.md`.
- **Step 7 (Lessons learned):** capture any drift between the WP text
  and the delivered code; update the pre-flight precedent log if a
  new pattern emerged (e.g., "first Shared Tooling package — record
  the directory-classification PS pattern as now-established for
  `packages/*` tooling, matching the `src/*` precedent of
  D-2706/D-2801/D-3001/D-3101").
- **Step 8 (Session context):** produce
  `docs/ai/session-context/session-context-wp061.md` (or whichever WP
  picks up next on the UI-test-harness chain) noting that `tsx`-first
  `NODE_OPTIONS` composition is the locked consumer pattern.

---

## Final Guard

The session prompt **must conform exactly** to the scope, constraints,
and decisions locked by the pre-flight and by the Locked Decisions
section above. No new scope may be introduced. If execution discovers
that a locked decision is wrong, **STOP** — do not unilaterally
revise. Escalate to a pre-flight amendment (following the WP-031
A-031-01 / A-031-02 / A-031-03 amendment precedent if needed).
