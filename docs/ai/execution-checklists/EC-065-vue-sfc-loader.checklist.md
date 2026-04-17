# EC-065 — Vue SFC Test Loader Invariants (Execution Checklist)

**Source:** docs/ai/work-packets/WP-065-vue-sfc-test-transform.md
**Layer:** Shared Tooling (`packages/vue-sfc-loader/`)

## Before Starting

Items marked **Pre-resolved** were locked by the WP-065 pre-flight
(2026-04-17) and recorded in the session prompt's Locked Decisions.
Do not re-derive them during execution.

- [x] **Pre-resolved (Locked Decision 2):** Vue version = `^3.4.27`, matching `apps/registry-viewer/package.json:15`; `@vue/compiler-sfc` pinned to match exactly
- [x] **Pre-resolved (Locked Decision 3):** `apps/registry-viewer/` grepped for prior SFC test shim — **none found**; proceed (record in DECISIONS.md entry during execution)
- [x] **Pre-resolved (Locked Decision 6):** D-6501 already exists in `docs/ai/DECISIONS.md` and `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` lists the `shared-tooling` category for `packages/vue-sfc-loader/`
- [x] **Pre-resolved (Locked Decision 4):** Node 22 `module.register()` + `--import` API confirmed stable (floor v22; pre-flight observed v24.14.1); record both in DECISIONS.md entry during execution
- [x] **Pre-resolved (Locked Decision 1):** Canonical TS loader = `tsx` (verified across `packages/game-engine`, `packages/registry`, `apps/server` test scripts); substitute for `<repo-ts-loader>` placeholder in delivered README only, and record in DECISIONS.md
- [ ] `<script lang="ts">` smoke test run against `@vue/compiler-sfc.compileScript`; TS pass necessity recorded in DECISIONS.md (per Locked Decision 7 this runs **during execution**, not pre-flight)
- [x] **Pre-resolved (Locked Decision 5):** ARCHITECTURE.md on `main` already contains Shared Tooling row, `packages/vue-sfc-loader/` entry, and Package Import Rules row; do not edit ARCHITECTURE.md from inside this packet
- [ ] `pnpm -r build` and `pnpm -r test` exit 0 on `main`

## Locked Values (do not re-derive)
- Package name: `@legendary-arena/vue-sfc-loader`
- Register entry specifier: `@legendary-arena/vue-sfc-loader/register`
- Exported helper signature: `compileVue(source: string, filename: string): { code: string; map?: string }`
- Canonical `NODE_OPTIONS` composition: `--import <repo-ts-loader> --import @legendary-arena/vue-sfc-loader/register` (TS loader first, Vue loader second)
- TS transpile settings (if needed): `typescript.transpileModule({ module: 'ESNext', target: 'ES2022' })`
- Filename normalization: `filename.replace(/\\/g, '/')` — POSIX forward slashes only as compiler `id`
- DEBUG one-liner format: `compiled <file> template=<0|1> script=<0|1> styleStripped=<N> customStripped=<N> bytesIn=<N> bytesOut=<N>`

## Guardrails (Load-Bearing Invariants)
- **Loader chain ordering:** canonical TS loader always runs before `vue-sfc-loader/register`; reversing breaks `<script lang="ts">`
- **POSIX filename normalization:** compiler `id` is POSIX-only; OS-native path retained for error messages only
- **JS-only emission:** `compileVue` output is Node 22 ESM-parseable with no further transform; TS stripping happens *inside* `compileVue` via `typescript.transpileModule`, never via an outer loader
- **Loader scope is `.vue`-only:** `load()` intercepts URLs ending in `.vue`; everything else delegates to `nextLoad`
- **`compileVue` is pure:** no I/O, no `console.*`, no wall clock, no RNG, no mutation of inputs
- **`resolve()` is omitted unless Preflight produces a failing default-resolution case** — do not implement speculatively
- **Byte-for-byte determinism:** identical source + POSIX filename produces byte-identical module bodies across runs and across Windows/Linux (sourcemap comment line stripped for comparison)
- **Style + unknown custom blocks are intentionally stripped** and counted in DEBUG output; parse failures and zero-block results throw full-sentence errors
- **No bundler in `build`:** `tsc` only — no esbuild, rollup, swc, babel
- **Vue + `@vue/compiler-sfc` are `peerDependencies`**, not `dependencies` (prevents pnpm dual-install breaking `@vue/test-utils` mount checks and `instanceof` assertions)
- **Full-sentence error contract:** every error thrown by `compileVue` or the loader names the failing `.vue` file (OS-native path for humans), the block type where relevant (`template` | `script`), and the compiler diagnostic or actionable next step. Single-word or terse errors are forbidden per `code-style.md` Rule 11.
- **Sourcemap tolerance = path + non-zero line number only:** stack traces must reference the `.vue` path and a line ≥ 1. Perfect column accuracy is explicitly out of scope; do not invest in a template/script map merger.
- **`exactOptionalPropertyTypes`-safe construction for `compileVue` return:** `packages/game-engine/tsconfig.json` has `exactOptionalPropertyTypes: true`, and `packages/vue-sfc-loader/tsconfig.json` extends the repo's strict config. The `{ code: string; map?: string }` return must be constructed conditionally — build the base object without `map`, then assign `result.map = mapString` only when a map exists. Do **not** write `return { code, map: maybeMap }` where `maybeMap: string | undefined`; that fails type-checking under strict optional properties. Precedent: WP-029 `preserveHandCards` (01.4 §Risk Review lines 1741–1747).
  ```ts
  const result: { code: string; map?: string } = { code };
  if (mapString !== undefined) { result.map = mapString; }
  return result;
  ```

## Required `// why:` Comments
- `compileVue.ts` filename-normalization site: deterministic compiler identity across Windows and Linux
- `compileVue.ts` each `<style>` / unknown-block strip point: intentional test-time behavior, not a silent fallback
- `loader.ts` `.vue`-only intercept: upstream TS loader must still see non-`.vue` specifiers
- `register.ts`: single stable `--import` specifier for consumers regardless of internal layout
- `loader.test.ts` child-process pattern: loader hooks install per-process; verification requires a fresh process
- Any `ctx.random.*` or environment-sensitive read (should be none — absence is the invariant)

## Files to Produce
- `packages/vue-sfc-loader/package.json` — **new**
- `packages/vue-sfc-loader/tsconfig.json` — **new**
- `packages/vue-sfc-loader/README.md` — **new**
- `packages/vue-sfc-loader/src/compileVue.ts` — **new**
- `packages/vue-sfc-loader/src/compileVue.test.ts` — **new**
- `packages/vue-sfc-loader/src/loader.ts` — **new**
- `packages/vue-sfc-loader/src/loader.test.ts` — **new**
- `packages/vue-sfc-loader/src/register.ts` — **new**
- `packages/vue-sfc-loader/test-fixtures/hello.vue` — **new**
- `pnpm-workspace.yaml` — **modified** (only if new package not covered by existing glob)
- `package.json` (root) — **modified** (only if workspace-root deps required)
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md` — **modified** (governance)

## After Completing
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader build` exits 0
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/vue-sfc-loader test` exits 0
- [ ] Loader child-process test proves end-to-end import + mount under `@vue/test-utils` + `jsdom`
- [ ] Determinism test asserts byte-for-byte identical module bodies across `C:\fix\hello.vue` vs `/fix/hello.vue`
- [ ] `git status --porcelain` shows only expected files added or modified; no stray untracked files in restricted directories
- [ ] `git diff --name-only` shows only files from WP-065 `## Files Expected to Change`
- [ ] `git diff --name-only apps/arena-client/ apps/registry-viewer/ apps/server/ packages/game-engine/ packages/registry/ packages/preplan/` returns no output (those trees untouched)
- [ ] No `vitest` / `jest` / `mocha` / `axios` / `node-fetch` / `passport` / `auth0` / `clerk` / `@swc/*` / `babel` imports anywhere in the package
- [ ] `docs/ai/STATUS.md` updated — WP-061+ unblocked
- [ ] `docs/ai/DECISIONS.md` updated with all 9 decisions enumerated in WP-065 DoD
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-065 checked off with today's date
- [ ] EC-105 (deferred) can now be re-evaluated for scheduling

## Common Failure Smells
- `SyntaxError: Unexpected token` in a `.test.ts` consumer → TS loader likely missing from `NODE_OPTIONS` or ordered *after* `vue-sfc-loader`
- `SyntaxError` inside compiled SFC output on `<script lang="ts">` → `compileVue` is returning TS; the internal `typescript.transpileModule` pass was skipped or the outer TS loader was mistakenly relied on
- Determinism test flakes on Windows-only or Linux-only CI → filename passed to compiler `id` was not POSIX-normalized
- `@vue/test-utils` `mount()` fails with `instanceof` / component-identity errors → pnpm installed a second copy of Vue; check `peerDependencies` vs `dependencies`
- Stack trace points at compiled output instead of `.vue` path → sourcemap comment missing or `filename` argument to compiler was not set
- `resolve()` added "to be safe" and non-`.vue` specifiers now break → remove `resolve()`; default Node resolution is the contract
