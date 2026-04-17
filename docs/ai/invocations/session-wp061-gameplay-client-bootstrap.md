# Session Prompt — WP-061 Gameplay Client Bootstrap

**Work Packet:** [docs/ai/work-packets/WP-061-gameplay-client-bootstrap.md](../work-packets/WP-061-gameplay-client-bootstrap.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-067-gameplay-client-bootstrap.checklist.md](../execution-checklists/EC-067-gameplay-client-bootstrap.checklist.md)
**Commit prefix:** `EC-067:` (NOT `EC-061:` — EC-061 is historically bound to the registry-viewer Rules Glossary panel, commit `1b923a4`)
**Pre-flight:** 2026-04-17 — READY TO EXECUTE, CONFIRM disposition (copilot check step 1b, 30/30 PASS)
**WP Class:** Contract-Only / Client-Only Bootstrap
**Primary layer:** Client UI (new `apps/arena-client/` Vue 3 SPA)

---

## Pre-Session Gates (Resolve Before Writing Any File)

These two items were locked by the pre-flight's "Authorized Next Step" section.
The first was raised at Finding #0; the second is the P6-26 code-category gate.

1. **EC slot confirmation.** The invoking operator must acknowledge that this WP
   ships under `EC-067:`, not `EC-061:`. Triple cross-referenced:
   WP-061 line 5, EC-067 lines 6-10, commit `846e3e5`
   ("SPEC: retarget WP-061 to EC-067 + propagate WP-065 lessons").
   If anyone insists on `EC-061:`, STOP and re-run pre-flight.

2. **Code-category row for `apps/arena-client/` (P6-26 / D-6501 precedent).**
   Before writing the first file under `apps/arena-client/`, confirm that
   [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md)
   has either an `apps/*`-wide row that covers this new client app or a
   dedicated row for `apps/arena-client/`. If absent, resolve as **PS-1** by
   adding a new `D-NNNN — Client app classification for apps/arena-client/`
   entry to [docs/ai/DECISIONS.md](../DECISIONS.md) and the matching
   category row **before** scaffolding starts. Scope-neutral — does not
   require a pre-flight re-run.

If either gate is unresolved, STOP.

---

## Runtime Wiring Allowance — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md)
§Escalation and the P6-10 precedent (WP-030 / WP-065). This WP is purely
additive at the engine layer. Each of the four 01.5 trigger criteria is
enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-061? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No engine type is modified. `UIState` and its 8 sub-types are consumed `import type` only. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No engine setup orchestrator is touched. `apps/arena-client/` is a new workspace app. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move is added, removed, or renamed. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook is added. No existing test asserts against `apps/arena-client/`. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock below applies
without the allowance. Any file beyond the allowlist in §Files Expected
to Change is a scope violation per **P6-27**, not a minor additive
deviation — escalate to a pre-flight amendment rather than shipping it.

---

## Authority Chain (Read in Order Before Coding)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary invariants (client apps consume engine types only)
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — `.test.ts` extension, ESM-only, `node:` prefix, no abbreviations
4. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary (Authoritative); §Persistence Boundary
5. [docs/ai/execution-checklists/EC-067-gameplay-client-bootstrap.checklist.md](../execution-checklists/EC-067-gameplay-client-bootstrap.checklist.md) — **primary execution authority**
6. [docs/ai/work-packets/WP-061-gameplay-client-bootstrap.md](../work-packets/WP-061-gameplay-client-bootstrap.md) — authoritative WP specification
7. [docs/ai/session-context/session-context-wp061.md](../session-context/session-context-wp061.md) — WP-065 exit state + lessons
8. [packages/vue-sfc-loader/README.md](../../../packages/vue-sfc-loader/README.md) — canonical `NODE_OPTIONS` pattern WP-061 consumes
9. [packages/game-engine/src/ui/uiState.types.ts](../../../packages/game-engine/src/ui/uiState.types.ts) — UIState shape for fixture construction
10. [apps/registry-viewer/package.json](../../../apps/registry-viewer/package.json) + [tsconfig.json](../../../apps/registry-viewer/tsconfig.json) — prior-art Vue 3 SPA layout

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, `apps/arena-client/` is a buildable, testable Vue 3 SPA that:

1. Exposes a Pinia store `useUiStateStore()` with one state field `snapshot: UIState | null` and one action `setSnapshot(next)`.
2. Provides `loadUiStateFixture(name: FixtureName): UIState` backed by three committed JSON fixtures (`mid-turn`, `endgame-win`, `endgame-loss`), each validated via `satisfies UIState` at import.
3. Mounts a single `<BootstrapProbe />` component that renders `snapshot.game.phase` (loaded) or an empty-state message (null), both with explicit `aria-label`.
4. Passes `pnpm --filter @legendary-arena/arena-client build`, `test`, and `typecheck` (all exit 0).
5. Supports dev-only `?fixture=<name>` URL harness behind `import.meta.env.DEV`, with DCE verification via a dedicated marker string.

No HUD. No scoreboard. No networking. No routing beyond a single mount point. Strictly plumbing.

---

## Locked Values (Do Not Re-Derive) — copied verbatim from EC-067

- **Package name:** `@legendary-arena/arena-client`; `"private": true`
- **Store shape:** one state field `snapshot: UIState | null`, one action `setSnapshot(next: UIState | null)`, **no getters**, **no additional state or actions**
- **FixtureName union:** `'mid-turn' | 'endgame-win' | 'endgame-loss'`
- **UIState top-level keys:** `game`, `players`, `city`, `hq`, `mastermind`, `scheme`, `economy`, `log`, `gameOver?`
- **Phase names:** `'lobby' | 'setup' | 'play' | 'end'`
- **TurnStage values:** `'start' | 'main' | 'cleanup'`
- **Canonical test-script composition** (direct CLI flags, no `NODE_OPTIONS`, no `cross-env`):
  `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`
- **Fixture typing discipline:** `export const midTurn = midTurnJson satisfies UIState;` — **never** `as UIState`
- **Vue version pin:** `vue@^3.4.27` (matches `apps/registry-viewer/` and vue-sfc-loader peerDep per D-6502)
- **vue-sfc-loader classification:** `devDependencies` only — never `dependencies` (anti-production-bundle rule; D-6501)
- **DCE marker string:** `'__WP061_DEV_FIXTURE_HARNESS__'` — the grep target for production-build verification (never grep for fixture names; they survive minification through JSON imports)

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- No runtime import of `@legendary-arena/game-engine` anywhere in `apps/arena-client/src/` — `import type` only.
- No import of `@legendary-arena/registry` anywhere in `apps/arena-client/src/`.
- No import of `boardgame.io` anywhere in `apps/arena-client/src/`.
- No `Math.random`, `Date.now`, or `performance.now` in any file under `apps/arena-client/src/`.
- No persistence of `UIState` — store holds the current snapshot only. No localStorage, sessionStorage, IndexedDB, or cookies.
- ESM only; Node v22+. `node:` prefix on all Node built-in imports.
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file in the output. No diffs. No "show only the changed section."
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`, no ORMs (N/A), no Jest, no Vitest, no Mocha, no `passport`, no `auth0`, no `clerk`, no `cross-env`. The **only** permitted test runner is `node:test`.

**Packet-specific:**
- `UIState` is imported as a type only: `import type { UIState } from '@legendary-arena/game-engine'`. Verify with `Select-String`.
- The Pinia store exposes exactly one state field (`snapshot`) and exactly one action (`setSnapshot`). No getters, no additional state, no additional actions.
- Fixtures are committed JSON files. Each is imported through a typed TS module that applies `satisfies UIState` at the import site. A bare `as UIState` cast is forbidden — it would silently mask drift.
- `<BootstrapProbe />` renders only `snapshot.game.phase` (when loaded) and a fallback "no snapshot loaded" message (when null). It is a wiring probe, not a feature.
- No router beyond a single placeholder mount at `/`. No `vue-router` guard logic, no auth, no redirects.
- No CSS framework beyond a minimal reset and a single global stylesheet establishing base font, color tokens, and focus-ring defaults. Component styling is scoped.
- Tests use `node:test` + `node:assert` + `@vue/test-utils` + `jsdom`. The `.vue` SFC transform pipeline is provided exclusively by WP-065 (`@legendary-arena/vue-sfc-loader/register`). The `test` script uses **direct `--import` CLI flags** (no `NODE_OPTIONS`, no `cross-env`). Matches the precedent set by `packages/game-engine`, `packages/registry`, and `apps/server`.
- **jsdom + `@vue/test-utils.mount()` setup boilerplate is load-bearing.** Under Vue 3.5.x + Node 22+, `@vue/runtime-dom.resolveRootNamespace` probes `SVGElement` during `app.mount()`; a plain assignment `globalThis.navigator = dom.window.navigator` throws `TypeError: Cannot set property navigator of #<Object> which has only a getter`. Every component test that calls `mount()` imports a shared `src/testing/jsdom-setup.ts` helper that injects `HTMLElement`, `Element`, `Node`, `SVGElement`, `MathMLElement` and assigns `navigator` via `Object.defineProperty(globalThis, 'navigator', { value, writable: true, configurable: true })`. Precedent: WP-065 [packages/vue-sfc-loader/src/loader.test.ts](../../../packages/vue-sfc-loader/src/loader.test.ts) driver.
- **Optional `UIState` fields are OMITTED from fixture JSON**, not emitted as `null` or `undefined`. Repo tsconfig has `exactOptionalPropertyTypes: true` (verified in `packages/game-engine/tsconfig.json:8` and inherited by this app's tsconfig). Under that flag, `{ gameOver: null }` is not assignable to `{ gameOver?: UIGameOverState }` — the field must be absent for `satisfies UIState` to hold. JSON cannot represent `undefined`, so **omit** is the only correct form.
- **Dev `?fixture=` harness is DCE-guarded:** a single `if (import.meta.env.DEV)` branch in `main.ts` with the unique marker string `'__WP061_DEV_FIXTURE_HARNESS__'` inside it (e.g., inside a `console.debug(...)` call or assigned `const __marker = '__WP061_DEV_FIXTURE_HARNESS__';`). The marker is the grep target for production-build verification.
- **Unknown `?fixture=<name>` is silent no-op**, never a throw — invalid query strings must not crash dev.

**Session protocol:**
- If any precedent file (`apps/registry-viewer/`, `packages/vue-sfc-loader/`) contradicts this prompt, STOP and ask.
- If the shape of a fixture conflicts with `UIState`, STOP and ask — do not invent fields.

---

## Required `// why:` Comments (copied verbatim from EC-067)

- [apps/arena-client/src/stores/uiState.ts](../../../apps/arena-client/src/stores/uiState.ts): store holds current projection only; derived view state belongs to future UI packets
- [apps/arena-client/src/stores/uiState.ts](../../../apps/arena-client/src/stores/uiState.ts): Pinia Options-API choice (if diverging from registry-viewer Setup-API precedent — clarity for single-field + single-action shape)
- [apps/arena-client/src/fixtures/uiState/typed.ts](../../../apps/arena-client/src/fixtures/uiState/typed.ts): `satisfies UIState` (never `as UIState`) prevents silent drift
- [apps/arena-client/src/fixtures/uiState/index.ts](../../../apps/arena-client/src/fixtures/uiState/index.ts): single code path — no Vite vs Node branching
- [apps/arena-client/src/main.ts](../../../apps/arena-client/src/main.ts) dev branch: URL-based fixture selection is the team's reproducible-bug-report mechanism; the DCE marker comment
- [apps/arena-client/src/components/BootstrapProbe.vue](../../../apps/arena-client/src/components/BootstrapProbe.vue): wiring probe only; real HUD components arrive in the next UI packet
- [apps/arena-client/src/testing/jsdom-setup.ts](../../../apps/arena-client/src/testing/jsdom-setup.ts): jsdom globals injection mirrors WP-065 `loader.test.ts` driver; `navigator` via `Object.defineProperty` because Node 22+ exposes a read-only getter

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation, not a "minor additive deviation."
STOP and escalate to a pre-flight amendment rather than shipping the extra file.

### New — `apps/arena-client/`
- `apps/arena-client/package.json` — new. Name `@legendary-arena/arena-client`; `private: true`; scripts `dev`, `build`, `preview`, `test`, `typecheck`. Pin `vue@^3.4.27`. List `@legendary-arena/vue-sfc-loader: workspace:*` under `devDependencies` only (never `dependencies`).
- `apps/arena-client/tsconfig.json` — new. `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `resolveJsonModule: true`. Self-contained (no repo-wide base).
- `apps/arena-client/vite.config.ts` — new. Vue plugin + `build.sourcemap: true`.
- `apps/arena-client/index.html` — new. `<div id="app">`, `<title>Legendary Arena</title>`.
- `apps/arena-client/src/main.ts` — new. Creates app, installs Pinia, mounts. Contains the single `if (import.meta.env.DEV)` dev-branch with the `__WP061_DEV_FIXTURE_HARNESS__` marker and `?fixture=` parsing.
- `apps/arena-client/src/App.vue` — new. `<main>` wrapper + `<BootstrapProbe />`.
- `apps/arena-client/src/stores/uiState.ts` — new. Pinia Options-API store.
- `apps/arena-client/src/stores/uiState.test.ts` — new.
- `apps/arena-client/src/fixtures/uiState/typed.ts` — new. `satisfies UIState` applied per import.
- `apps/arena-client/src/fixtures/uiState/index.ts` — new. `loadUiStateFixture(name: FixtureName): UIState` single-path switch.
- `apps/arena-client/src/fixtures/uiState/index.test.ts` — new.
- `apps/arena-client/src/fixtures/uiState/mid-turn.json` — new. Phase `'play'`, stage `'main'`, **omit `gameOver` key entirely**.
- `apps/arena-client/src/fixtures/uiState/endgame-win.json` — new. Phase `'end'`, `gameOver.outcome === 'win'`.
- `apps/arena-client/src/fixtures/uiState/endgame-loss.json` — new. Phase `'end'`, `gameOver.outcome === 'loss'`.
- `apps/arena-client/src/components/BootstrapProbe.vue` — new. Script-setup Composition API with `aria-label`-ed output.
- `apps/arena-client/src/components/BootstrapProbe.test.ts` — new. First import: `import './testing/jsdom-setup.ts'` (load-bearing).
- `apps/arena-client/src/testing/jsdom-setup.ts` — new. Side-effect module installing jsdom globals per WP-065 precedent.
- `apps/arena-client/src/styles/base.css` — new. `:root` tokens with numeric contrast-ratio comments (not "AA compliant" hand-waving).

### Modified — conditional / governance
- `pnpm-workspace.yaml` — modified only if the new package is not already covered by an existing `apps/*` glob.
- `docs/ai/STATUS.md` — modified per DoD.
- `docs/ai/DECISIONS.md` — modified per DoD (fixture validation strategy; NODE_OPTIONS-vs-direct-flags outcome; routing omission; build sourcemap default; client-app PS-# resolution if required).
- `docs/ai/work-packets/WORK_INDEX.md` — modified per DoD.
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — modified **only if** Pre-Session Gate #2 determines a new category row is needed for `apps/arena-client/`; any such modification requires a matching `D-NNNN` entry in `DECISIONS.md`.

### Must remain UNTOUCHED
- `packages/game-engine/**`
- `packages/registry/**`
- `packages/vue-sfc-loader/**`
- `apps/server/**`
- `apps/registry-viewer/**`

---

## Acceptance Criteria

### Scaffold
- [ ] `apps/arena-client/package.json` declares `@legendary-arena/arena-client` with scripts `dev`, `build`, `preview`, `test`, `typecheck`.
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.

### Layer Boundary
- [ ] Zero runtime imports of `@legendary-arena/game-engine` under `apps/arena-client/src/` (only `import type` permitted). Confirmed with `Select-String`.
- [ ] Zero imports of `@legendary-arena/registry` under `apps/arena-client/src/`. Confirmed with `Select-String`.
- [ ] Zero imports of `boardgame.io` under `apps/arena-client/src/`. Confirmed with `Select-String`.
- [ ] Zero occurrences of `Math.random`, `Date.now`, or `performance.now` under `apps/arena-client/src/`. Confirmed with `Select-String`.

### Store
- [ ] `useUiStateStore()` exposes exactly one state field (`snapshot`) and exactly one action (`setSnapshot`). No getters. No additional state or actions.
- [ ] `snapshot` is typed as `UIState | null`.
- [ ] No source file wraps `snapshot` in `Ref<>` at the consumer side.

### Fixtures
- [ ] `fixtures/uiState/typed.ts` exists and applies `satisfies UIState` to each imported JSON fixture (Select-String matches ≥ 3).
- [ ] Zero bare `as UIState` casts anywhere in `fixtures/uiState/`.
- [ ] All three fixtures compile (typecheck passes with `resolveJsonModule`).
- [ ] `endgame-win.json` and `endgame-loss.json` both include a `gameOver` block with the expected outcome.
- [ ] `mid-turn.json` does NOT contain a `gameOver` key at all (Select-String for `gameOver` in that file returns zero matches).
- [ ] `loadUiStateFixture` has a single code path (no environment branching between Vite and Node).

### Probe
- [ ] `<BootstrapProbe />` renders the empty-state message when `snapshot === null`.
- [ ] `<BootstrapProbe />` renders the phase value when a fixture is loaded.
- [ ] Both states include explicit `aria-label` attributes.

### Dev Fixture Harness
- [ ] `main.ts` contains exactly one `if (import.meta.env.DEV)` branch parsing `?fixture=` from `window.location.search`.
- [ ] Unknown `fixture` names in the query string do NOT populate the store (silent no-op; no throw).
- [ ] The dev branch contains the dedicated DCE marker string `'__WP061_DEV_FIXTURE_HARNESS__'`.
- [ ] The dev branch is dead-code eliminated in production builds: `Select-String` of `dist/` for the marker returns zero matches.

### Base Styles & Accessibility
- [ ] `base.css` defines `--color-foreground`, `--color-background`, `--color-focus-ring` with explicit numeric contrast-ratio comments.
- [ ] Both light and dark `prefers-color-scheme` blocks define the same token set with their own documented ratios.

### Scope Enforcement
- [ ] No files outside §Files Expected to Change were modified (confirmed with `git diff --name-only`).
- [ ] `packages/game-engine/**`, `packages/registry/**`, `packages/vue-sfc-loader/**`, `apps/server/**`, and `apps/registry-viewer/**` are untouched.

---

## Verification Steps (pwsh, run in order)

```pwsh
# Step 1 — install and build
pnpm install
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0

# Step 2 — typecheck
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0

# Step 3 — run tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests pass

# Step 4 — confirm no engine runtime import
Select-String -Path "apps/arena-client/src" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }
# Expected: no output

# Step 5 — confirm no registry or boardgame.io import
Select-String -Path "apps/arena-client/src" -Pattern "@legendary-arena/registry|boardgame.io" -Recurse
# Expected: no output

# Step 6 — confirm no wall-clock or RNG
Select-String -Path "apps/arena-client/src" -Pattern "Math\.random|Date\.now|performance\.now" -Recurse
# Expected: no output

# Step 7 — confirm no bare `as UIState` cast in fixtures
Select-String -Path "apps/arena-client/src/fixtures/uiState" -Pattern "as UIState" -Recurse
# Expected: no output

# Step 8 — confirm typed.ts uses `satisfies UIState` (≥ 3 matches)
Select-String -Path "apps/arena-client/src/fixtures/uiState/typed.ts" -Pattern "satisfies UIState"
# Expected: at least three matches (one per fixture)

# Step 9 — confirm dev fixture harness is behind import.meta.env.DEV
Select-String -Path "apps/arena-client/src/main.ts" -Pattern "import\.meta\.env\.DEV"
# Expected: at least one match

# Step 10 — confirm mid-turn fixture omits gameOver key
Select-String -Path "apps/arena-client/src/fixtures/uiState/mid-turn.json" -Pattern "gameOver"
# Expected: no output

# Step 11 — confirm DCE marker exists in dev source
Select-String -Path "apps/arena-client/src/main.ts" -Pattern "__WP061_DEV_FIXTURE_HARNESS__"
# Expected: at least one match

# Step 12 — confirm DCE marker is stripped from production build
pnpm --filter @legendary-arena/arena-client build
Select-String -Path "apps/arena-client/dist" -Pattern "__WP061_DEV_FIXTURE_HARNESS__" -Recurse
# Expected: no output

# Step 13 — confirm jsdom-setup.ts is imported by every component test that mounts
Select-String -Path "apps/arena-client/src/components" -Pattern "from '.+/testing/jsdom-setup" -Recurse
# Expected: at least one match per *.test.ts that calls mount()

# Step 14 — confirm engine, server, registry-viewer, and vue-sfc-loader untouched
git diff --name-only packages/game-engine/ packages/registry/ packages/vue-sfc-loader/ apps/server/ apps/registry-viewer/
# Expected: no output

# Step 15 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Post-Mortem — MANDATORY (P6-28)

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) §When Post-Mortem Is Required.
Three triggering criteria apply to WP-061:

1. **New contract consumed by future WPs** — `useUiStateStore()` shape, `loadUiStateFixture` signature, `FixtureName` union, and the dev `?fixture=` URL convention will be inherited by WP-062 (Arena HUD), WP-064 (Log/Replay Inspector), and every subsequent UI packet.
2. **New long-lived abstraction** — the Pinia store pattern, the typed-fixture loader pattern, and the jsdom-setup module are all patterns every subsequent UI WP will copy.
3. **New code-category directory** — `apps/arena-client/` is the first gameplay client app in the repo.

**Per P6-28, 01.6 mandatoriness rules override any session-prompt "recommended" softening.** This section is not softenable. Run the post-mortem in the same session as execution, immediately after acceptance criteria pass, before committing.

---

## Definition of Done

- [ ] Pre-Session Gates #1 (EC slot) and #2 (code-category row) both resolved.
- [ ] All Acceptance Criteria above pass.
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] No runtime import of `@legendary-arena/game-engine`, `@legendary-arena/registry`, or `boardgame.io` in `apps/arena-client/`.
- [ ] No wall-clock or `Math.random` use in `apps/arena-client/`.
- [ ] No `as UIState` cast in `fixtures/uiState/` — only `satisfies`.
- [ ] Dev-only `?fixture=` harness is behind `import.meta.env.DEV` and the `__WP061_DEV_FIXTURE_HARNESS__` marker is stripped from production builds.
- [ ] `packages/game-engine/**`, `packages/registry/**`, `packages/vue-sfc-loader/**`, `apps/server/**`, `apps/registry-viewer/**` are untouched.
- [ ] `docs/ai/STATUS.md` updated — a Vue 3 client skeleton now exists and consumes committed `UIState` fixtures; no live match wiring yet.
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: chosen test runner + SFC transform pipeline (cites D-6507); fixture validation approach (`satisfies` + `resolveJsonModule`); decision to omit routing in the bootstrap; decision to enable build sourcemaps.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-061 checked off with today's date and a note linking this session prompt.
- [ ] Commit uses the `EC-067:` prefix (NOT `EC-061:`).
- [ ] 01.6 post-mortem is complete (MANDATORY per P6-28).
- [ ] `### Runtime Wiring Allowance — NOT INVOKED` section in this prompt is accurate at execution time — verify no engine type or move was added during the session.
- [ ] If Pre-Session Gate #2 required a PS-# resolution, a `D-NNNN — Client app classification for apps/arena-client/` entry exists in `DECISIONS.md` with a matching row in `02-CODE-CATEGORIES.md`.

---

## Out of Scope (Explicit)

- No HUD, scoreboard, player panels, or match-specific UI — WP-062 (Arena HUD).
- No spectator-specific views — future spectator HUD WP.
- No log/replay inspector — WP-064.
- No replay snapshot production — WP-063.
- No lobby, match setup, or matchmaking UI — future WP.
- No networking: no WebSocket client, no boardgame.io client binding, no REST calls.
- No auth flow, no session handling, no cookies.
- No theming system beyond the base CSS tokens.
- No card images, tooltips, or registry access.
- No changes to `packages/game-engine/**`, `packages/registry/**`, `apps/server/**`, or `apps/registry-viewer/**`.
- No refactors, cleanups, or "while I'm here" improvements unless explicitly listed in §Files Expected to Change.

---

## Final Instruction

Execute exactly this scope. No synthesis, no scope expansion, no "helpful"
additions. If any required modification cannot be classified as within the
WP-061 allowlist + the NOT-INVOKED 01.5 scope lock, STOP and escalate
rather than force-fitting. P6-27 is active.

When finished: run the verification steps in order, capture output, run the
mandatory post-mortem, then hand off to step 5 (pre-commit review) in a
separate session with the `EC-067:` commit prefix locked.
