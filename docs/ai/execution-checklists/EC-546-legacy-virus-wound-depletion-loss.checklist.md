# EC-546 — Legacy Virus Wound-Stack-Depletion Loss + Scheme Setup Sizing

**WP:** WP-511 · **Layer:** Game Engine (`packages/game-engine`) · **Baseline:**
`origin/main` @ `2cceb9d0` · **Lane:** Standard two-session.

This EC is the authoritative execution contract for WP-511. The WP is the design
authority; on conflict the WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*`.

## Before Starting

- [ ] `git pull --ff-only origin main` clean; fresh branch off `2cceb9d0`.
- [ ] WP-510 merged (`pile-depleted` kind + `applyPileDepletionResourceLoss` +
      `remainingPileCount` + `game.ts` `turn.onMove` wiring on `main`).
- [ ] Read `rules/schemeResourceLoss.ts` (`remainingPileCount` switch),
      `setup/buildInitialGameState.ts` (`numPlayers` at ~`:249`, `buildGlobalPiles`
      call at ~`:306`), and `setup/pilesInit.ts` (`buildGlobalPiles` — do NOT edit it).

## Locked Values (do not re-derive)

- Legacy Virus scheme id: **`core/legacy-virus-the`**; wound stack **`6 × numPlayers`**
  (12/18/24/30 at 2/3/4/5p); loss when **`G.piles.wounds.length === 0`**.
- New pile literal: **`'wounds'`** → **`G.piles.wounds.length`** (`WOUND_EXT_ID = 'pile-wound'`).
- Counter set: **`ENDGAME_CONDITIONS.SCHEME_LOSS = 1`** (idempotent; guard `>= 1`).
- The 30 `woundsCount` floor (D-24032) is **NOT changed**; sizing is a
  **post-validation** override at the `buildGlobalPiles` call.
- **`PRE_WP080_HASH` MUST stay `ec64506a`** (it is NOT Legacy Virus). The **only**
  re-pin is `sentinel-core-doom-2p.replay.json`'s `finalStateHash`.

## Guardrails

- [ ] Reuse the WP-510 `pile-depleted` kind — widen exactly one `pile` literal
      (`'heroDeck' | 'wounds'`) + one `remainingPileCount` case. Do NOT edit
      `applyPileDepletionResourceLoss` or the `game.ts` `turn.onMove` wiring.
- [ ] Sizing is post-validation: no config `woundsCount < 30` is created; the
      floor stays. Compute in `buildInitialGameState`, pass `{ ...config,
      woundsCount }` to `buildGlobalPiles`. Do NOT edit `pilesInit.ts`.
- [ ] `resolveEffectiveWoundsCount` is pure — no `G`, no I/O, no boardgame.io
      import; one explicit Legacy Virus branch (not a general framework).
- [ ] No `.reduce()`; no new `G` field; no new counter; `evaluateEndgame` stays
      counter-only. `finalTurn.logic.ts` / `evaluateEndgame` not touched.
- [ ] The sentinel re-pin is **deliberate + verified** (regenerate, re-run green).
      `PRE_WP080_HASH` unchanged. Any OTHER hash drift → STOP.

## Required Comments (`// why:`)

- [ ] In `buildInitialGameState.ts`: why the wound count is overridden
      post-validation (floor governs the config; scheme rule governs the built pile).
- [ ] In `schemeSetupSizing.ts`: why Legacy Virus is 6×players (the printed setup)
      and why below the 30 floor is intentional.
- [ ] In `schemeTwistConfigs.ts` Legacy Virus entry: why `resourceLossCondition`
      suppresses the (now inert) `lossThreshold: 8` proxy.

## Files to Produce (allowlist — 9 code/test + governance)

- [ ] `rules/schemeTwistConfig.types.ts` — `pile: 'heroDeck' | 'wounds'`.
- [ ] `rules/schemeResourceLoss.ts` — `remainingPileCount` gains `'wounds'`.
- [ ] `rules/schemeTwistConfigs.ts` — Legacy Virus `resourceLossCondition`.
- [ ] `setup/schemeSetupSizing.ts` — **new** `resolveEffectiveWoundsCount`.
- [ ] `setup/buildInitialGameState.ts` — wire the helper into the pile build.
- [ ] `state/zones.types.ts` — lockstep comment fix (`GlobalPiles.wounds` doc; comment-only).
- [ ] `test/fixtures/games/sentinel-core-doom-2p.replay.json` — deliberate re-pin.
- [ ] `setup/schemeSetupSizing.test.ts` — **new** sizing unit tests.
- [ ] `rules/schemeResourceLoss.test.ts` — wounds pile-depletion tests.
- [ ] `rules/schemeHandlers.test.ts` — Legacy Virus proxy suppressed.
- [ ] **Execution-scope expansion (D-24322, folded per operator):** `simulation/simulation.runner.ts` + `simulation/par.aggregator.ts` (call `applyPileDepletionResourceLoss` after each move — sim-visibility); `scripts/runtime-observed-hollows.mjs` + `scripts/coop-winrate.mjs` (backdrop → Cosmic Cube); `docs/ai/coverage/runtime-observed-hollows.json` (regenerated); `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (lockstep pinned values). Surfaced by the `sim:runtime-observed:check` CI-gate timeout (Legacy Virus's deck-dependent loss stopped terminating the solo coverage sweep). Verified by full suite + control-reverts, not a second gate pass.
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, `DECISIONS` D-24320 + D-24321
      Active, mindmap `✅` + `roadmap:counts:write`, `STATUS` close-out, `NUMBER-LEDGER`.

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (record delta).
- [ ] Re-pin flow: sentinel fixture fails on old hash → regenerate via
      `node scripts/record-game-fixture.mjs --input <fixture> --name sentinel-core-doom-2p`
      (after `pnpm -r build`) → re-run green. Confirm 12-wound setup; `PRE_WP080_HASH`
      still `ec64506a`.
- [ ] Review the regenerated fixture diff — confirm it reflects ONLY wound-count
      deltas (pile size / any wound-driven snapshot counts), no unrelated
      snapshot/message drift baked in by the regenerate.
- [ ] `pnpm -r --no-bail test` exits 0 (whole workspace — the WP-508 lesson).
- [ ] Control-revert non-vacuous: revert sizing → sentinel hash fails; revert config
      → AC-4 fails. Restore both.
- [ ] `sim:runtime-observed:check` current; `pnpm -r build` 0.
- [ ] Two-commit topology: `EC-546:` impl + `SPEC:` govern-close.
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Common Failure Smells

- Editing `pilesInit.ts` / `buildGlobalPiles` signature (out of scope — pass an
  adjusted config instead).
- Lowering the 30 floor or creating a config `woundsCount < 30`.
- Re-pinning `PRE_WP080_HASH` (over-broad override — it is NOT Legacy Virus).
- A blind fixture-hash bump instead of a regenerate-and-verify.
