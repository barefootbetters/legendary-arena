# EC-559 — Secret Invasion "6 Heroes" Setup Requirement — Enforcement Core

**WP:** WP-524 · **Layer:** Registry + Game Engine + registry-viewer · **Baseline:**
`origin/main` @ `c5cfa21b` · **Lane:** Standard two-session. **Epic:** ship as a set with
WP-525.

Authoritative execution contract for WP-524. The WP is the design authority; on conflict
the WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*`.

> **CONTRAST with WP-515/EC-550, do NOT mirror it.** WP-515 was a post-validation DOWNSIZE
> and its EC forbids touching `matchSetup.validate`. WP-524 is a requirement INCREASE and
> **MUST** touch `validatePlayerCountComposition` (a 6-hero loadout must pass the engine;
> a 5-hero one must fail). The override lives on the REQUIREMENT side (registry resolver
> reached by the engine + registry-viewer), NOT in `schemeSetupSizing.ts`.

## Before Starting

- [ ] `git pull --ff-only origin main` clean; fresh branch off the reserve-merge base.
- [ ] WP-514 merged (conversion/combat — untouched here). WP-370/D-24165 merged
      (`PLAYER_COUNT_SETUP` SSOT + `checkPlayerCountComposition` + the structural reader).
- [ ] Read `playerCountSetup.ts` (table + `checkPlayerCountComposition` at `:104-137`),
      `matchSetup.validate.ts` (`CardRegistryReader` `:47-64`, `validatePlayerCountComposition`
      `:481-497`, `validateMatchSetup` `:562/:571` where `input.schemeId` is in scope),
      the two registry impls (`localRegistry.ts:196`, `httpRegistry.ts:175`), and
      registry-viewer `useLoadoutDraft.ts` (`checkPlayerCountComposition` call `:455`,
      `requiredPlayerCountSetup` computed `:451`).

## Locked Values (do not re-derive)

- Scheme id: **`core/secret-invasion-of-the-skrull-shapeshifters`**.
- Effective hero count: **`Math.max(baseHeroCount, 6)`** for that scheme, else `baseHeroCount`
  unchanged. FLAT 6 at every player count (2/3/4p 5→6; 5p 6; 1p 3→6). No other scheme changes.
- Helper: **`resolveEffectiveHeroCount(schemeId, numPlayers, baseHeroCount)`** in
  `packages/registry/src/playerCountSetup.ts`.
- `PlayerCountCompositionInput.schemeId` is **optional** — absent → base behaviour (existing
  callers, incl. `autoplayDefault.test.ts`, stay green).
- Base `PLAYER_COUNT_SETUP` table values are **not** mutated.

## Guardrails

- [ ] ONE definition of "6" (the registry resolver); the engine reaches it via the reader —
      NO copy of the scheme id / "6" in `matchSetup.validate.ts` or `schemeSetupSizing.ts`.
- [ ] Both registry impls (`localRegistry.ts` + `httpRegistry.ts`) expose
      `resolveEffectiveHeroCount` — the engine may receive either.
- [ ] `validatePlayerCountComposition` uses
      `registry.resolveEffectiveHeroCount?.(schemeId, numPlayers, row.heroCount) ?? row.heroCount`
      — the `?.`/`?? ` fallback is for **hand-rolled engine `CardRegistryReader` mocks** where
      the method is optional and reverting to base is intended. Production impls CANNOT forget
      it: `resolveEffectiveHeroCount` is a **required** member of the real `CardRegistry`
      interface (`types/index.ts`), so a missing impl is a **compile error**, not a runtime
      revert (RS-1).
- [ ] No `.reduce()`; no new `ctx.random`; no `boardgame.io` import in the registry helper;
      no registry import in the engine (structural reader only).
- [ ] 9-field `MatchSetupConfig` composition lock preserved (`heroDeckIds` unchanged field).
- [ ] Determinism: gated to Secret Invasion → other schemes/counts byte-identical. No
      committed Secret Invasion fixture → sentinel `finalStateHash` + `PRE_WP080_HASH`
      **byte-identical; STOP on any shift** (a shift means the gate leaked).

## Required Comments (`// why:`)

- [ ] `playerCountSetup.ts` `resolveEffectiveHeroCount`: why flat 6 (printed "6 Heroes")
      + why the requirement side, not a build-time downsize (contrast the two sizing overrides).
- [ ] `matchSetup.validate.ts`: why `schemeId` is forwarded + why the `?.`/`??` fallback.

## Files to Produce (allowlist — see WP §Files Expected to Change)

- [ ] Registry: `playerCountSetup.ts` (resolver + scheme-aware checker), `types/index.ts`
      (`CardRegistry` method), `impl/localRegistry.ts` + `impl/httpRegistry.ts` (expose it),
      `playerCountSetup.test.ts`.
- [ ] Engine: `matchSetup.validate.ts` (reader method + forward schemeId + effective check),
      `matchSetup.validate.test.ts` (6-hero SI passes; 5-hero fails; non-SI unchanged). The SI
      cases MUST supply `resolveEffectiveHeroCount` on their mock reader — a method-less mock
      falls back to base 5 and would let a 5-hero SI config pass (a false green; copilot NOTE-A).
- [ ] registry-viewer: `useLoadoutDraft.ts` (thread schemeId + effective display),
      `useLoadoutDraft.test.ts` (SI @2p requires/displays 6).
- [ ] NOT touched: `schemeSetupSizing.ts`, `setupContract`, `buildInitialGameState.ts` logic
      (only exercised in tests), server + arena-client (WP-525), the conversion path (WP-514).
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, `DECISIONS` D-24337 Active, mindmap
      `✅` + `roadmap:counts:write`, `STATUS`, `NUMBER-LEDGER`.

## After Completing

- [ ] `pnpm --filter @legendary-arena/{registry,game-engine,registry-viewer} build && test`
      green (record delta).
- [ ] `pnpm -r --no-bail test` exits 0 (whole workspace).
- [ ] Control-revert non-vacuous: resolver returns `baseHeroCount` → SI-requires-6 tests fail
      at registry + engine + registry-viewer; non-scheme tests stay green. Restore.
- [ ] Sentinel + `PRE_WP080_HASH` byte-identical; `sim:runtime-observed:check` current;
      `pnpm -r build` 0.
- [ ] Two-commit topology: `EC-559:` impl + `SPEC:` govern-close.
- [ ] Paired with WP-525 — NOT production-deployed alone.
- [ ] D-24026 live-verify performed or explicitly operator-pending (with WP-525).

## Common Failure Smells

- Mirroring EC-550's "don't touch `matchSetup.validate`" — WRONG class; this WP must touch it.
- A second hardcode of the scheme id / "6" in the engine instead of reaching the resolver.
- Forgetting one registry impl (`httpRegistry.ts`) → a **compile error** (the method is
  required on `CardRegistry`), not a silent revert — but do add it to BOTH impls. (If a test
  mock omits it, the engine falls back to base and would then REJECT a correct 6-hero SI
  loadout — a loud failure, not a silent wrong-accept.)
- Making `schemeId` required on `checkPlayerCountComposition` → breaks the base callers.
- Forgetting the whole-workspace run (a cross-layer requirement change).
