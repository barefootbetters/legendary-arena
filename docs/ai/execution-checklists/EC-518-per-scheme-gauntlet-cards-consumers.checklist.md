# EC-518 — Per-Scheme Gauntlet: Browser-Safe Export + Cards Consumers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-483-per-scheme-gauntlet-cards-consumers.md
**Layer:** Registry (producer) + App (`apps/registry-viewer`, consumer) — downward crossing

## Before Starting
- [ ] WP-471 ✅ + WP-472 ✅ + WP-474 (legends-board split) ✅ merged on `origin/main`
      (registry `getGauntletConfig`; D-24283 Active; the cards half deferred to this WP).
- [ ] On `origin/main`, worktree clean; registry + registry-viewer green.
- [ ] Confirm `gauntletConfigs.ts` still `readFileSync`s at module load and is barrel-only
      (no `./gauntletConfigs` subpath), and the cards libs import narrow subpaths only.
- [ ] **Scaffold (validation-tightening):** prototype the required `schemeId` add to
      `GauntletQualificationInput` (the ONLY required-field addition — `ResolveGauntletLegInput.schemeId`
      is already required) and run `pnpm --filter registry-viewer test` — record the
      `gauntletQualificationCheck.test.ts` fixture breaks before implementing.
- [ ] **Exact target file set (any outside = FAIL, STOP):** `scripts/generate-gauntlet-configs.mjs`,
      `packages/registry/src/gauntletConfigs.generated.ts`, `gauntletConfigs.{ts,test.ts}`,
      `packages/registry/package.json`, root `package.json`,
      `apps/registry-viewer/src/lib/gauntletQualificationCheck.{ts,test.ts}`,
      `loadoutGauntletPackImport.{ts,test.ts}`, `components/LoadoutBuilder.vue` (+ governance).

## Locked Values (do not re-derive)
- Mirror `gauntletLoadouts`: generator emits `gauntletConfigs.generated.ts` (banner:
  GENERATED — do not edit); default writes, `--check` fails on drift; root scripts
  `gauntlet:configs` / `gauntlet:configs:check`; deterministic (no clock, no randomness,
  **source key order preserved** at every Record level — no re-sort). The **enforcing**
  drift gate is the in-test deep-equal assertion in `gauntletConfigs.test.ts` (CI-run via
  `pnpm -r … test`); `gauntlet:configs:check` is a convenience mirror, NOT wired into
  `ci.yml` (matching `gauntlet:loadouts:check`).
- `gauntletConfigs.ts` imports the generated literal — **drop `node:fs` / `node:path` /
  `node:url`**. `getGauntletConfig` / `getActiveYear` / `validateGauntletConfigs`
  signatures + the `undefined`→menu-fallback semantics + `PLAYER_COUNT_SETUP` slicing are
  **preserved verbatim**.
- New subpath `@legendary-arena/registry/gauntletConfigs` in `packages/registry/package.json`
  (mirror the `./gauntletLoadouts` row). Its only transitive imports are `zod`,
  `./playerCountSetup.js`, and the generated literal — **no Node built-ins**.
- Consumers: `GauntletQualificationInput` gains `schemeId: string` + injected
  `approvedComposition?: GauntletConfigComposition`; `ResolveGauntletLegInput` gains the
  injected `approvedComposition?: GauntletConfigComposition` (**same field name in both
  helpers**; its `schemeId` is already required). Per-scheme path fires when `schemeId` is
  non-empty AND `approvedComposition` is present → resolve against that leg config
  (`checkGauntletQualification` reports `qualifies` with **`variantIndex: 0`**); else →
  today's per-mastermind menu path. The `getGauntletConfig` call lives in `LoadoutBuilder.vue`
  (parallel to `getGauntletLoadoutMenu`); the pure helpers stay **data-injected**
  (registry-loader-free unit tests).

## Guardrails
- registry-viewer reads the registry via **narrow browser-safe subpaths only** — NEVER the
  root barrel; the new `./gauntletConfigs` subpath must not pull a Node built-in.
- Do NOT change `getGauntletConfig`'s contract, `data/gauntlet-configs.json`, the server
  (`server.mjs` untouched — barrel import preserved), or any legends-board file (WP-474 owns).
- Do NOT let the pure helpers import a registry data loader — data is injected, validators/
  types come from subpaths (the existing pattern).
- `ci.yml` is NOT in the allowlist — do NOT wire `gauntlet:configs:check` into CI (mirror
  the un-wired `gauntlet:loadouts:check`); the in-test freshness assertion is the CI gate.
- No new contract file; no D-entry.

## Required `// why:` Comments
- Why `gauntletConfigs.ts` now imports the generated literal instead of reading the file
  (browser-safe: `node:fs` breaks the Vite bundle; freshness guarded by `gauntlet:configs:check`).
- Why the cards consumers resolve per-scheme config with a per-mastermind-menu fallback
  (the WP-472 `overlay ?? menu` model; absent leg → menu).
- Why the per-scheme config is injected into the pure helpers rather than imported (keeps
  their unit tests registry-loader-free — data is injected, like the menu).

## Files to Produce
- `scripts/generate-gauntlet-configs.mjs` (new) — generator + `--check`.
- `packages/registry/src/gauntletConfigs.generated.ts` (new, generated) — bundled literal.
- `gauntletConfigs.ts` — import literal, drop `node:fs`; contract preserved.
- `gauntletConfigs.test.ts` — load-source + freshness assertions; keep validator throw-cases.
- `packages/registry/package.json` — `./gauntletConfigs` subpath.
- root `package.json` — `gauntlet:configs` / `gauntlet:configs:check`.
- `gauntletQualificationCheck.ts` (+ test) — `schemeId` + injected per-scheme composition.
- `loadoutGauntletPackImport.ts` (+ test) — prefill by `input.schemeId` (config, else menu).
- `LoadoutBuilder.vue` — import browser-safe `getGauntletConfig`; inject into both call sites.

## After Completing
- [ ] `pnpm gauntlet:configs:check` clean; registry + registry-viewer `test`/`typecheck`/
      `build` + `pnpm -r build` exit 0; server suite green (barrel unchanged).
- [ ] **D-24026 live-verify (operator-pending):** cards badge + pack prefill honour the
      leg's scheme (Secret-Invasion → Skrulls; a non-swapped scheme → Brotherhood).
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-518 Done.
- [ ] No file outside the allowlist (+ governance) modified. No D-entry.

## Common Failure Smells
- Vite build errors on a Node built-in → the new subpath (or its transitive imports) still
  pulls `node:fs`; the refactor left a Node import in `gauntletConfigs.ts`.
- Badge/prefill still scheme-blind → `getGauntletConfig` not called at the orchestrator, or
  the injected composition not threaded into the helper input.
- `gauntlet:configs:check` red in CI → the generated literal is stale (regenerate after any
  `data/gauntlet-configs.json` edit) or non-deterministic output crept in.
- Typecheck breaks across the two test files → `schemeId` is required and fixtures lack it
  (expected; both `.test.ts` are in the allowlist — fold the fixture fill in).
