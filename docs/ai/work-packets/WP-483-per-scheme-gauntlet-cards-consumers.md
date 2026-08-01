# WP-483 — Per-Scheme Approved-Loadout: Browser-Safe Registry Export + Cards Consumers (Arc 4/5, cards half)

**User-Visible Surface:** `cards.legendary-arena.com` (the Loadout Builder's gauntlet
qualification badge and Gauntlet-Pack prefill now resolve the **leg's** approved
adversaries by scheme). **D-24026 live-verification applies** (operator-pending on the
Cloudflare Pages deploy).

## User-Visible Impact

On the cards builder, picking a Gauntlet-Pack leg — or hand-building a draft under a
gauntlet mastermind — now qualifies against **that leg's scheme** config, not the
mastermind's scheme-blind default. A Dr. Doom "Secret Invasion…" pack prefills Skrulls
(the leg's approved villains) where his other schemes prefill Brotherhood, and the
pre-play badge qualifies the draft against the leg's own approved adversaries. Non-Core
legs (no authored per-scheme override) are unchanged — they still resolve the
per-mastermind menu.

## Goal

Arc 4 of 5, **cards half**. WP-474 shipped the legends-board half of the per-scheme
consumer migration but **split off** the registry-viewer/cards half because the WP-471
`getGauntletConfig` loader is **Node-only** and breaks the Vite browser build. This
packet (1) adds a **browser-safe per-scheme registry export** — a generated/bundled
module mirroring the `gauntletLoadouts.generated.ts` precedent plus a narrow
`@legendary-arena/registry/gauntletConfigs` subpath with **no `node:fs`** — and (2)
threads `schemeId` through the cards consumers so the WP-454 qualification badge and the
WP-444 pack prefill resolve the **leg's** approved loadout. No new decision — this
consumes the D-24283 contract.

## Assumes

- **WP-471 ✅ on `origin/main`** — `packages/registry/src/gauntletConfigs.ts` exposes
  `getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, playerCount)` returning the
  per-scheme composition or **`undefined` for any absent leg** (the absent-leg → menu
  fallback model). Source: WORK_INDEX WP-471 row.
- **WP-472 ✅ on `origin/main`** — D-24283 Active (per-(scheme×mastermind×count) as an
  additive overlay; `effective = overlay.get(scheme) ?? menu`). Source: WORK_INDEX
  WP-472 row + DECISIONS D-24283.
- **WP-474 ✅ on `origin/main`** (merged 2026-08-01 as #1147, `c7f42443`) — WP-474's
  §Execution Reconciliation SPLIT the consumer migration: it shipped **legends-board only**;
  the cards half (AC#3 — badge + pack prefill + `LoadoutBuilder.vue`) was deferred to **this
  WP (WP-483 / EC-518)**. #1147 touched only legends-board files, so the three registry-viewer
  cards files this WP owns are untouched. Source: WP-474 + EC-509 §Execution Reconciliation.
  **Execute off current `origin/main`** so WP-474's legends-board changes and this cards
  baseline coexist (they share no files).
- **`gauntletLoadouts.generated.ts` precedent exists** — `scripts/generate-gauntlet-loadouts.mjs`
  bakes registry-derived data to a TS literal (root scripts `gauntlet:loadouts` /
  `gauntlet:loadouts:check`), and `gauntletLoadouts.ts` imports the literal (no `node:fs`),
  exposed browser-safe via the `./gauntletLoadouts` subpath. This WP mirrors that shape
  exactly for gauntlet configs.
- **The cards libs already avoid the registry root barrel** — `loadoutGauntletPackImport.ts`
  imports only narrow browser-safe subpaths (`/gauntletPack`, `/gauntletLoadouts`,
  `/playerCountSetup`) because "the root barrel pulls Node built-ins that break the Vite
  browser build." A new `./gauntletConfigs` subpath is the missing browser-safe source.

## Context (Read First)

**Why now:** the whole point of the per-scheme arc is that a mastermind's legs differ by
scheme. WP-472/473 made the server truth, leaderboard, and run-tracker per-scheme;
WP-474 made the legends board per-scheme. The cards builder is the last consumer still
resolving scheme-blind — its badge and pack prefill still read the per-mastermind menu,
so a Skrulls-leg pack prefills Brotherhood and the badge qualifies against the wrong
config. This packet closes that gap.

**Why a browser-safe export is needed first (the split rationale):** `gauntletConfigs.ts`
`readFileSync`s `data/gauntlet-configs.json` at module load and is reachable only through
the registry **root barrel** (no subpath). `apps/registry-viewer` is a Vite **browser**
app that cannot import the barrel. There is no browser-safe per-scheme data source today.
The fix mirrors `gauntletLoadouts`: bake the parsed config into a generated TS literal at
build time, refactor `gauntletConfigs.ts` to import the literal instead of `node:fs`, and
add the `./gauntletConfigs` subpath. This preserves `getGauntletConfig`'s signature and
its `undefined`→menu-fallback semantics exactly (WP-471 owns them) while removing the only
Node dependency from the module-load path. The server (which imports via the barrel) is
untouched.

**Single WP, one layer crossing (Registry producer → App consumer):** the browser-safe
export has no consumer other than this WP's cards changes, and the cards changes cannot
resolve per-scheme without it. Shipping them together avoids a dead-code interim (a
registry export nothing reads). The crossing is strictly downward (registry never imports
the app) — allowed per ARCHITECTURE.md §Layer Boundary — so this stays one WP rather than
a producer/consumer split.

**Validation-tightening note (scaffold-first at execution):** the **only** required-field
addition is `schemeId: string` on `GauntletQualificationInput` — every existing
construction in `gauntletQualificationCheck.test.ts` becomes type-incomplete and must gain
`schemeId`. `ResolveGauntletLegInput.schemeId` is **already required** and its fixtures
already supply it, so `loadoutGauntletPackImport.test.ts` gains only the **optional**
`approvedComposition?` — no fixture break there. Both `.test.ts` are in the allowlist. Run
the registry-viewer suite early (scaffold) to surface the `gauntletQualificationCheck`
fixture breaks before implementation is declared complete (`01.4 §Empirical Scaffold`).

## Scope (In)

- **`scripts/generate-gauntlet-configs.mjs` (NEW)** — reads `data/gauntlet-configs.json`,
  validates it (reusing `validateGauntletConfigs`), and emits the parsed config as a TS
  literal to `packages/registry/src/gauntletConfigs.generated.ts`. Default mode writes;
  `--check` regenerates in memory and exits non-zero on drift (a **committed, locally/
  CI-manually runnable** convenience gate — like `gauntlet:loadouts:check`, it is **not**
  wired into `ci.yml`; the enforcing gate is the in-test freshness assertion below).
  Deterministic — no wall-clock, no randomness, **source key order preserved** at every
  Record level (`years`→`sets`→`masterminds`→`schemes`; no key re-sorting) so output is
  byte-identical for identical input. Mirrors `scripts/generate-gauntlet-loadouts.mjs`.
- **`packages/registry/src/gauntletConfigs.generated.ts` (NEW, generated)** — the bundled
  config literal + a `// GENERATED — do not edit by hand` banner. Committed and CI-gated.
- **`packages/registry/src/gauntletConfigs.ts`** — import the generated literal instead of
  `readFileSync`; drop the `node:fs` / `node:path` / `node:url` imports and the
  `resolveConfigsPath` / `loadGauntletConfigs` read path. **Preserve exactly**:
  `getGauntletConfig` / `getActiveYear` / `validateGauntletConfigs` signatures, the
  per-count slicing via `PLAYER_COUNT_SETUP`, and the `undefined`→menu-fallback semantics.
- **`packages/registry/src/gauntletConfigs.test.ts`** — the loader now reads the bundled
  module (not the file at cwd); update the load-source assertions. **Keep** the
  `validateGauntletConfigs` throw-cases and the slicing/scheme-slug guards (still valid —
  the validator is unchanged). **MUST add the in-test freshness assertion** — the generated
  literal deep-equals the validated `data/gauntlet-configs.json`. This assertion is the
  **enforcing** drift gate (it runs in CI via `pnpm -r … test`, `ci.yml`); the standalone
  `gauntlet:configs:check` script is a convenience mirror, not CI-wired.
- **`packages/registry/package.json`** — add the `./gauntletConfigs` subpath export
  (`./dist/gauntletConfigs.js` + `.d.ts`), mirroring the `./gauntletLoadouts` row.
- **`package.json` (root)** — add `gauntlet:configs` and `gauntlet:configs:check` scripts
  next to the `gauntlet:loadouts` pair.
- **`apps/registry-viewer/src/lib/gauntletQualificationCheck.ts` (+ test)** — add
  `schemeId: string` to `GauntletQualificationInput` and the injected
  `approvedComposition?: GauntletConfigComposition` (the leg's per-scheme config, resolved
  by the caller). The **per-scheme path fires when `schemeId` is non-empty AND
  `approvedComposition` is present** — qualify the draft against that single leg config and
  report `qualifies` with **`variantIndex: 0`** (D-24283 = one canonical composition per
  leg). Otherwise (empty `schemeId`, or a non-Core / unswapped leg where
  `approvedComposition` is `undefined`) fall back to today's per-mastermind menu-variant
  iteration. `schemeId` is thus the explicit per-scheme selector that gates the branch.
- **`apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts` (+ test)** — add the
  injected `approvedComposition?: GauntletConfigComposition` to `ResolveGauntletLegInput`
  (same name/type as the qualification input). `resolveGauntletLegLoadout` **uses
  `input.schemeId`**: when `approvedComposition` is present (the caller resolved it via
  `getGauntletConfig(...schemeSlug-from-input.schemeId...)`) it prefills from that leg
  config; when `undefined` it falls back to the scheme-blind menu variant (today it echoes
  `schemeId` but always pulls scheme-blind). `schemeId` stays required — no fixture break.
- **`apps/registry-viewer/src/components/LoadoutBuilder.vue`** — import the browser-safe
  `getGauntletConfig` from `@legendary-arena/registry/gauntletConfigs`; at both call sites
  resolve the leg's per-scheme composition (parse `mastermindSlug` from `mastermindId`,
  `schemeSlug` from the scheme `extId`, narrow `playerCount`) and inject it as
  `approvedComposition`: into the `gauntletQualification` computed (which also passes
  `schemeId` = `draft.composition.schemeId` into the qualification input) and into
  `onPickGauntletLeg`'s `resolveGauntletLegLoadout` call (resolving from the picked leg's
  `schemeId`). An empty draft `schemeId` resolves to `undefined` → menu fallback, unchanged.

## Out of Scope

- **No change to `getGauntletConfig`'s signature or its `undefined`→menu-fallback
  semantics** (WP-471 owns the loader contract; this only changes its data source to the
  bundled literal).
- **No `apps/server` change** — the server imports `getGauntletConfig` via the barrel; the
  refactor preserves the barrel export, so server behavior is unchanged and `server.mjs` is
  not touched.
- **No legends-board change** — WP-474 owns the board half; its files are untouched here.
- **No edit to `data/gauntlet-configs.json`** — the authored file is the generator's input,
  unchanged. No new decision (consumes D-24283). **No D-entry.**

## Files Expected to Change

- `scripts/generate-gauntlet-configs.mjs` (new) — generator + `--check`
- `packages/registry/src/gauntletConfigs.generated.ts` (new, generated) — bundled literal
- `packages/registry/src/gauntletConfigs.ts` — import literal, drop `node:fs`
- `packages/registry/src/gauntletConfigs.test.ts` — load-source + freshness assertions
- `packages/registry/package.json` — `./gauntletConfigs` subpath export
- `package.json` (root) — `gauntlet:configs` / `gauntlet:configs:check` scripts
- `apps/registry-viewer/src/lib/gauntletQualificationCheck.ts` (+ `.test.ts`) — `schemeId` + injected config
- `apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts` (+ `.test.ts`) — use `schemeId`
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — thread `schemeId` + resolved config into both call sites

## Contract

> Full file contents (no diffs); ESM/Node v22+; `00.6`; registry-viewer reads the registry
> through **narrow browser-safe subpaths only** (never the root barrel); pure helpers stay
> **data-injected** (menu today, per-scheme config added) and registry-loader-free for
> unit-testability; the generated module is trusted at runtime and guarded by the
> `gauntlet:configs:check` freshness gate.

**Locked:**
- The browser-safe export is `@legendary-arena/registry/gauntletConfigs` and imports **no
  Node built-ins** — its transitive imports are `zod`, `./playerCountSetup.js`, and the
  generated literal only.
- `getGauntletConfig` / `getActiveYear` / `validateGauntletConfigs` keep their exact
  WP-471 signatures and the `undefined`→menu-fallback semantics; only the data source
  changes (bundled literal, not a runtime `readFileSync`).
- The generated module is derived from `data/gauntlet-configs.json`, byte-identical for
  identical input (source key order preserved, no re-sort). The **enforcing** drift gate is
  the in-test deep-equal assertion in `gauntletConfigs.test.ts` (CI-run via `pnpm -r … test`);
  `gauntlet:configs:check` is a convenience mirror, not CI-wired (matching `gauntlet:loadouts:check`).
- Consumers resolve the **leg's** config: per-scheme where authored (via `getGauntletConfig`),
  else the per-mastermind menu (`GAUNTLET_LOADOUT_MENUS`) — the WP-472 `overlay ?? menu`
  model. The `getGauntletConfig` call happens at the **LoadoutBuilder orchestrator**
  (parallel to today's `getGauntletLoadoutMenu` lookup); the pure helpers receive the
  resolved composition **injected** as `approvedComposition?: GauntletConfigComposition`
  (the **same field name in both helpers**), keeping their unit tests registry-free. The
  per-scheme `qualifies` verdict reports **`variantIndex: 0`** (one canonical composition
  per leg, D-24283).

## Acceptance Criteria

- [ ] `@legendary-arena/registry/gauntletConfigs` imports into the registry-viewer bundle
      with **no `node:fs`** (the Vite production build succeeds; no Node-builtin externals
      warning for this subpath).
- [ ] `pnpm gauntlet:configs` regenerates the literal; `pnpm gauntlet:configs:check` exits
      0 against the committed module and non-zero after a deliberate hand-edit; the
      `gauntletConfigs.test.ts` freshness assertion (literal deep-equals validated source
      JSON) fails on a hand-edited literal (the CI-enforcing drift gate).
- [ ] The cards badge qualifies a draft against the **leg's scheme** config (a Dr. Doom
      Secret-Invasion draft qualifies on Skrulls, not Brotherhood); an absent-leg / non-Core
      mastermind still qualifies against the per-mastermind menu.
- [ ] The Gauntlet-Pack prefill fills the **leg's** approved adversaries by `schemeId`
      (Secret-Invasion → Skrulls); an absent-leg falls back to the scheme-blind menu variant.
- [ ] `registry` + `registry-viewer` `test` / `typecheck` / `build` + `pnpm -r build` exit
      0; the server suite stays green (barrel import unchanged).
- [ ] No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
pnpm gauntlet:configs:check
pnpm --filter @legendary-arena/registry test
pnpm --filter registry-viewer test typecheck build
pnpm -r build
# Live smoke (D-24026): on cards.legendary-arena.com, load a Dr. Doom "Secret Invasion…"
# Gauntlet Pack — the prefill fills Skrulls; the badge qualifies against the leg. A
# non-swapped Dr. Doom scheme fills/qualifies Brotherhood.
```

## Vision Alignment

**Clauses:** §20-26 (gauntlet), §10 (presentation). **Conflict:** *No conflict* — a
browser-safe read + qualification-preview of the per-scheme contract; the server remains
the sole adjudicator. **NG:** none.

## Definition of Done

- [ ] All AC pass; registry + registry-viewer + `pnpm -r build` green; `gauntlet:configs:check` clean.
- [ ] **D-24026 live-verify (operator-pending):** the deployed cards badge + pack prefill
      honour the leg's scheme.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-518 Done.
- [ ] No files outside the list. No D-entry (consumes D-24283).

## Lint Gate Self-Review

- §1/§15: header + user-visible impact present; D-24026 stated. PASS.
- §2: full-file / no-diffs / `00.6`. PASS.
- §4: Context read-list present (WP-471 loader, WP-472/D-24283, WP-474 reconciliation,
  `gauntletLoadouts.generated.ts` precedent, the cards-lib subpath posture). PASS.
- §5: 6 registry/build files (1 generator, 1 generated, gauntletConfigs `{ts,test.ts}`, 2
  package.json) + 3 registry-viewer files (2 libs `{ts,test.ts}` + `LoadoutBuilder.vue`);
  one layer crossing (Registry producer → App consumer), downward, justified in §Context. PASS.
- §8: browser-safe subpath (no Node built-ins); registry never imports the app; server
  barrel import preserved. PASS.
- §17: §20-26 / §10; No conflict. PASS.
- §20: N/A — no funding surface, pricing, copy, or channel touched.
- §21: N/A — no `apps/server` HTTP endpoint or `Library-only` catalog function added,
  removed, or restatused; the new registry subpath export is a package-internal surface,
  not an `apps/server` catalog entry.
- No new contract file (`.types.ts` / `.validate.ts` / `.gating.ts`); no D-entry.

## Gate Verdicts (drafting session)

- **Pre-flight (01.4):** READY TO EXECUTE — no blocking items; two RS clarifications
  (`gauntlet:configs:check` not CI-wired; generator validates / runtime trusts the literal)
  folded in. Confirmed the design against actual source (`gauntletConfigs.ts`,
  `gauntletLoadouts` precedent, the two consumers, `LoadoutBuilder.vue`).
- **Copilot (01.7):** PASS (after a HOLD round applying six scope-neutral fixes —
  `variantIndex: 0`, load-bearing `schemeId`, freshness-gate framing, generator key-order,
  scaffold-note correction, unified `approvedComposition` field name).
- **Lint gate (00.3):** self-review above — 21 sections resolved; §20/§21 N/A justified.
