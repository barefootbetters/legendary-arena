# EC-550 — Super Hero Civil War: 2-Player Hero-Deck Setup Sizing

**WP:** WP-515 · **Layer:** Game Engine (`packages/game-engine`) · **Baseline:**
`origin/main` @ `e459b857` · **Lane:** Standard two-session.

Authoritative execution contract for WP-515. The WP is the design authority; on
conflict the WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*`.

> **Mirror WP-511's wound-sizing (D-24321) EXACTLY.** This is the second sizing case,
> so keep it a single explicit branch beside `resolveEffectiveWoundsCount` — do NOT
> generalize into a table. No loss change (WP-510/D-24318 ships the depletion loss);
> this WP only sizes the deck so the loss is reachable at 2p.

## Before Starting

- [ ] `git pull --ff-only origin main` clean; fresh branch off the reserve-merge base.
- [ ] WP-510 merged (`pile-depleted` / `heroDeck` loss + `turn.onMove` check).
- [ ] WP-511 merged (`setup/schemeSetupSizing.ts` + `resolveEffectiveWoundsCount`).
- [ ] Read `setup/schemeSetupSizing.ts` (the precedent), the `buildHeroDeck` call site
      in `setup/buildInitialGameState.ts` (currently `buildHeroDeck([...config.heroDeckIds],
      registry, context)` — the WP-514 `convertHeroesToSkrulls` step runs right after it,
      gated to Secret Invasion, so no overlap), and `setup/buildHeroDeck.ts` (5/3/3/3
      copy map → 14 cards per hero group).

## Locked Values (do not re-derive)

- Civil War scheme id: **`core/super-hero-civil-war`**.
- 2-player hero groups: **4** (`config.heroDeckIds.slice(0, 4)`); gated to
  **`numPlayers === 2`** only.
- 3/4/5-player and every non-Civil-War scheme: **requested ids unchanged**.
- Helper: **`resolveEffectiveHeroDeckIds(schemeId, numPlayers, requestedHeroDeckIds)`**
  in `setup/schemeSetupSizing.ts`, sibling to `resolveEffectiveWoundsCount`.
- No loss change (D-24318 owns it); no `schemeTwistConfigs.ts` / `schemeResourceLoss.ts`
  / `matchSetup.validate` / `setupContract` change.

## Guardrails

- [ ] Gate on BOTH `schemeId === 'core/super-hero-civil-war'` AND `numPlayers === 2`.
- [ ] Post-validation override only — the loadout still validates its normal id count;
      the scheme rule sizes the BUILT deck (the config-floor / built-pile split, D-24321).
- [ ] Deterministic first-4 (`slice(0, 4)`) — the engine cannot ask which 4. A list
      already shorter than 4 is returned unchanged (`slice` is safe; assert it).
- [ ] No `.reduce()`; no new `ctx.random` draw (the override changes the id list fed to
      the existing single shuffle); no `boardgame.io`/registry import in the pure helper.
- [ ] Apply at the `buildHeroDeck` call, BEFORE the WP-514 `convertHeroesToSkrulls`
      step (which passes through for Civil War) — do not disturb that call.
- [ ] Determinism: gated to Civil War + 2p → non-CW + 3-5p CW byte-identical. Sentinel
      is not a 2p Civil War fixture → sentinel + `PRE_WP080_HASH` expected byte-identical.
      Any shift → STOP; a genuine 2p Civil War fixture re-pin is deliberate + documented,
      never blind.

## Required Comments (`// why:`)

- [ ] `schemeSetupSizing.ts` `resolveEffectiveHeroDeckIds`: why 4 groups at 2p (printed
      setup) + why the first-4 is a deterministic engine choice (cannot ask which 4).
- [ ] `buildInitialGameState.ts`: why the override wraps the `buildHeroDeck` id list
      (post-validation sizing; makes the WP-510 2p loss reachable).

## Files to Produce (allowlist — see WP §Files Expected to Change)

- [ ] `setup/schemeSetupSizing.ts` (`resolveEffectiveHeroDeckIds`);
      `setup/buildInitialGameState.ts` (apply at `buildHeroDeck`).
- [ ] Tests: `setup/schemeSetupSizing.test.ts` (Civil War @2p → 4; @3-5p + non-CW →
      unchanged; short-list safety), `setup/*.test.ts` (2p CW builds 4 groups; 3p / 2p
      non-CW build 5).
- [ ] NOT touched: `schemeTwistConfigs.ts`, `schemeResourceLoss.ts`,
      `matchSetup.validate`, `setupContract`, `buildHeroDeck.ts`.
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, `DECISIONS` D-24328 Active,
      mindmap `✅` + `roadmap:counts:write`, `STATUS`, `NUMBER-LEDGER`.
- [ ] RS-1: when D-24328 lands, add a one-line cross-reference in D-24318's §Reachability
      note — it currently attributes the 2p Civil War hero-sizing follow-up to WP-511
      (which shipped only the Legacy Virus wound-sizing); WP-515/D-24328 is the actual
      completing WP. Small correction so the epic history is coherent.

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (record delta).
- [ ] `pnpm -r --no-bail test` exits 0 (whole workspace — the WP-508 lesson).
- [ ] Control-revert non-vacuous: return requested-unchanged → the 2p-CW 4-group build
      test fails; 3-5p / non-CW tests stay green. Restore.
- [ ] Sentinel + `PRE_WP080_HASH` byte-identical (or deliberate documented re-pin);
      `sim:runtime-observed:check` current; `pnpm -r build` 0.
- [ ] Two-commit topology: `EC-550:` impl + `SPEC:` govern-close.
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Common Failure Smells

- Gating on scheme id only (not `&& numPlayers === 2`) → 3-5p Civil War wrongly shrinks.
- Changing `matchSetup.validate` to require 4 ids at 2p (the override is post-validation;
  the loadout still provides its normal count).
- Touching the WP-510 loss config (this WP is sizing-only).
- A `slice` that throws / mishandles a <4-id list (assert the short-list path).
- Forgetting the whole-workspace run — a reachability/outcome shift is invisible to the
  engine suite alone (the WP-508 lesson).
