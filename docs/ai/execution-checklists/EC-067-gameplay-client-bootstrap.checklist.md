# EC-067 — Gameplay Client Bootstrap (Execution Checklist)

**Source:** docs/ai/work-packets/WP-061-gameplay-client-bootstrap.md
**Layer:** Client UI (new `apps/arena-client/` Vue 3 SPA)

> **EC numbering note:** `EC-061` was consumed by the registry-viewer
> Rules Glossary panel (commit `1b923a4`) and is now historically
> bound to that commit lineage. WP-061 therefore uses EC-067 — the
> next free slot in the shared 060+ range. Commits for WP-061 use
> the `EC-067:` prefix.

## Before Starting
- [ ] WP-028 complete: `UIState` and sub-types exported as types from `@legendary-arena/game-engine`
- [ ] WP-065 complete: `@legendary-arena/vue-sfc-loader/register` resolvable and `pnpm --filter @legendary-arena/vue-sfc-loader test` exits 0 on `main`
- [ ] `apps/arena-client/` covered by a code-category row in `02-CODE-CATEGORIES.md`; otherwise resolve as PS-# with a new `D-NNNN — Client app classification for apps/arena-client/` entry per P6-26 (new workspace-package category rule) **before** execution
- [ ] `pnpm -r build` and `pnpm -r test` exit 0 on `main` (registry pre-build dependency notwithstanding — no regressions outside apps/arena-client/)

## Locked Values (do not re-derive)
- Package name: `@legendary-arena/arena-client`; `"private": true`
- Store: one state field `snapshot: UIState | null`, one action `setSnapshot(next: UIState | null)`, **no getters**, **no additional state or actions**
- FixtureName union: `'mid-turn' | 'endgame-win' | 'endgame-loss'`
- UIState top-level keys: `game`, `players`, `city`, `hq`, `mastermind`, `scheme`, `economy`, `log`, `gameOver?`
- Phase names: `'lobby' | 'setup' | 'play' | 'end'`
- TurnStage values: `'start' | 'main' | 'cleanup'`
- Canonical test-script composition (direct CLI flags, no NODE_OPTIONS, no cross-env): `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`
- Fixture typing discipline: `export const midTurn = midTurnJson satisfies UIState;` — **never** `as UIState`

## Guardrails
- **Engine import is type-only:** `import type { UIState } from '@legendary-arena/game-engine'`. No runtime engine import anywhere in `apps/arena-client/src/`. No `@legendary-arena/registry` import. No `boardgame.io` import.
- **No wall clock or RNG:** no `Math.random`, `Date.now`, `performance.now` anywhere under `apps/arena-client/src/`.
- **vue-sfc-loader is consumed as devDependency only** (anti-production-bundle rule; D-6501/ARCHITECTURE.md §Package Import Rules).
- **Optional UIState fields are omitted from fixture JSON**, not set to `null` — repo tsconfig has `exactOptionalPropertyTypes: true`; JSON's `null` is a concrete value and breaks `satisfies UIState` against `gameOver?: UIGameOverState`.
- **jsdom mount setup is load-bearing:** `@vue/test-utils.mount()` under Vue 3.5.x + Node 22+ requires `globalThis.HTMLElement / Element / Node / SVGElement / MathMLElement` and `Object.defineProperty(globalThis, 'navigator', { value, writable: true, configurable: true })` — plain assignment to `navigator` throws `TypeError` (read-only getter in Node 22+). Reference: WP-065 `packages/vue-sfc-loader/src/loader.test.ts` driver.
- **Dev `?fixture=` harness is DCE-guarded:** a single `if (import.meta.env.DEV)` branch in `main.ts` with a unique marker string inside (e.g., `'__WP061_DEV_FIXTURE_HARNESS__'` inside a `// why:` comment or a `console.debug`) so the build-output grep check is unambiguous. Never grep for fixture names themselves — they survive minification through the imported JSON.
- **Unknown `?fixture=<name>` is silent no-op**, never a throw — invalid query strings must not crash dev.
- **01.5 Runtime Wiring Allowance is NOT INVOKED** — WP-061 is purely additive; the session prompt must include an explicit `### Runtime Wiring Allowance — NOT INVOKED` section per P6-10 precedent.
- **Any file beyond the allowlist is a scope violation, not a minor deviation** (P6-27). Stop and escalate to a pre-flight amendment rather than shipping a 20th file.

## Required `// why:` Comments
- `stores/uiState.ts`: store holds current projection only; derived view state belongs to future UI packets
- `stores/uiState.ts`: Pinia Options-API choice (if diverging from registry-viewer Setup-API precedent — clarity for single-field + single-action shape)
- `fixtures/uiState/typed.ts`: `satisfies UIState` (never `as UIState`) prevents silent drift
- `fixtures/uiState/index.ts`: single code path — no Vite vs Node branching
- `main.ts` dev branch: URL-based fixture selection is the team's reproducible-bug-report mechanism; the DCE marker comment
- `components/BootstrapProbe.vue`: wiring probe only; real HUD components arrive in the next UI packet
- `testing/jsdom-setup.ts`: jsdom globals injection mirrors WP-065 `loader.test.ts` driver; `navigator` via `Object.defineProperty` because Node 22+ exposes a read-only getter

## Files to Produce
- `apps/arena-client/package.json` — **new** — pin `vue@^3.4.27` (pnpm may resolve 3.5.x; match WP-065 precedent); `@legendary-arena/vue-sfc-loader: workspace:*` in `devDependencies` only
- `apps/arena-client/tsconfig.json` — **new** — strict mode; `resolveJsonModule: true` in this file (no repo-wide change needed)
- `apps/arena-client/vite.config.ts` — **new** — Vue plugin + `build.sourcemap: true`
- `apps/arena-client/index.html` — **new** — `<div id="app">`, `<title>Legendary Arena</title>`
- `apps/arena-client/src/main.ts` — **new** — Pinia install, `app.mount('#app')`, dev-only `?fixture=` branch behind `import.meta.env.DEV`
- `apps/arena-client/src/App.vue` — **new** — `<main>` + `<BootstrapProbe />`
- `apps/arena-client/src/stores/uiState.ts` — **new** — Pinia store (Options API)
- `apps/arena-client/src/stores/uiState.test.ts` — **new**
- `apps/arena-client/src/fixtures/uiState/typed.ts` — **new** — `satisfies UIState` applied per import
- `apps/arena-client/src/fixtures/uiState/index.ts` — **new** — `loadUiStateFixture(name: FixtureName): UIState` single-path switch
- `apps/arena-client/src/fixtures/uiState/index.test.ts` — **new**
- `apps/arena-client/src/fixtures/uiState/mid-turn.json` — **new** — phase `'play'`, stage `'main'`, omit `gameOver`
- `apps/arena-client/src/fixtures/uiState/endgame-win.json` — **new** — phase `'end'`, `gameOver.outcome === 'win'`
- `apps/arena-client/src/fixtures/uiState/endgame-loss.json` — **new** — phase `'end'`, `gameOver.outcome === 'loss'`
- `apps/arena-client/src/components/BootstrapProbe.vue` — **new** — script-setup, `aria-label`-ed output
- `apps/arena-client/src/components/BootstrapProbe.test.ts` — **new** — imports `./testing/jsdom-setup.ts`
- `apps/arena-client/src/testing/jsdom-setup.ts` — **new** — global injection helper (WP-065 loader.test.ts precedent)
- `apps/arena-client/src/styles/base.css` — **new** — `:root` tokens with numeric contrast ratio comments
- `pnpm-workspace.yaml` — **modified** only if `apps/*` glob does not already cover it
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/DECISIONS.md` — **modified** (fixture validation strategy; NODE_OPTIONS-vs-direct-flags outcome; routing omission; build sourcemap default; client-app code-category PS-# resolution if needed)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `Select-String` confirms zero runtime engine/registry/`boardgame.io` imports and zero `Math.random`/`Date.now`/`performance.now` under `apps/arena-client/src/`
- [ ] `Select-String` confirms zero `as UIState` under `apps/arena-client/src/fixtures/uiState/`; `satisfies UIState` present ≥ 3 times in `typed.ts`
- [ ] Production build output contains zero occurrences of the DCE marker string from `main.ts` (not the fixture names)
- [ ] `git diff --name-only packages/game-engine/ packages/registry/ apps/server/ apps/registry-viewer/ packages/vue-sfc-loader/` returns no output
- [ ] `docs/ai/STATUS.md` / `DECISIONS.md` / `WORK_INDEX.md` updated per DoD
- [ ] **01.6 post-mortem is MANDATORY** — three triggering criteria apply (new contract, new long-lived abstraction, new code category directory). The session prompt must not soften this to "recommended" (P6-28)

## Common Failure Smells
- `TypeError: Cannot set property navigator of #<Object> which has only a getter` → jsdom setup uses plain assignment; use `Object.defineProperty(globalThis, 'navigator', ...)` per WP-065 precedent
- `ReferenceError: SVGElement is not defined` inside `@vue/runtime-dom.resolveRootNamespace` → missing `SVGElement`/`MathMLElement` in jsdom globals; Vue 3.5.x probes both at `app.mount`
- `ERR_INVALID_URL` with `input: 'c:/...'` when the test driver calls `await import(absolutePath)` on Windows → absolute path being interpreted as URL scheme; wrap with `pathToFileURL()` from `node:url`
- `Cannot find package 'vue' imported from ...` in a spawned child process → temp file written outside the workspace tree; place driver / temp files inside the package root so Node resolution walks up to the monorepo `node_modules`
- `satisfies UIState` compile error on a fixture with `"gameOver": null` → `exactOptionalPropertyTypes: true` treats `null` as a distinct value; **omit** the field entirely instead
- `SyntaxError: Unexpected token` in a `.test.ts` consumer → `tsx` missing from the test script or ordered after `vue-sfc-loader/register`; put `--import tsx` **first** (D-6507)
- Dev-build DCE grep matches fixture name strings → grep for the dedicated DCE marker comment/string, not the fixture names (JSON imports survive minification)
