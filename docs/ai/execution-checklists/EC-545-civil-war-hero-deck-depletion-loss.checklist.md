# EC-545 — Super Hero Civil War Hero-Deck-Depletion Loss + `pile-depleted` Kind

**WP:** WP-510 · **Layer:** Game Engine (`packages/game-engine`) · **Baseline:**
`origin/main` @ `19373db0` · **Lane:** Standard two-session.

This EC is the authoritative execution contract for WP-510. The WP is the design
authority; on conflict the WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*`.

## Before Starting

- [ ] `git pull --ff-only origin main` clean; on a fresh branch off `19373db0`.
- [ ] WP-508 / WP-509 merged (`resourceLossCondition` framework + `schemeResourceLoss.ts`
      on `main`). `pnpm --filter @legendary-arena/game-engine build` → 0 at baseline.
- [ ] Read `rules/schemeResourceLoss.ts` (mirror `applyEscapedPileResourceLoss`),
      `endgame/finalTurn.logic.ts` (tie latch/resolve), and `game.ts` play-phase
      `turn.onMove` (the `latchFinalTurnIfDeckExhausted(G)` call site).

## Locked Values (do not re-derive)

- New kind literal: **`'pile-depleted'`**; new field **`pile: 'heroDeck'`** (only
  `'heroDeck'` this WP — `'wounds'` is WP-511).
- Civil War scheme id: **`core/super-hero-civil-war`**; loss when
  **`G.heroDeck.length === 0`**.
- Counter set: **`ENDGAME_CONDITIONS.SCHEME_LOSS = 1`** (idempotent; guard `>= 1`).
- Wiring site: **play-phase `turn.onMove`**, immediately after
  `latchFinalTurnIfDeckExhausted(G)` (`game.ts` ~line 576).
- Tie-override needs **no** `finalTurn.logic.ts` / `evaluateEndgame` change (D-24319).

## Guardrails

- [ ] `SchemeResourceLossCondition` becomes a discriminated union on `kind` —
      flip `export interface` → `export type X = {…} | {…}` (a union can't be an
      `interface`); the `'escaped-pile-count'` member stays byte-identical, so
      `applyEscapedPileResourceLoss` is **not** edited.
- [ ] The depletion check is wired to `turn.onMove` ONLY — never a `recruitHero`-only
      check (must catch twist-driven refills).
- [ ] `applyPileDepletionResourceLoss` mutates only `G.counters` + log; pure;
      idempotent; no `.reduce()`, no `ctx.random.*`, no `boardgame.io`/registry import.
- [ ] `evaluateEndgame` stays counter-only; no new `G` field, no new counter.
- [ ] `finalTurn.logic.ts` is NOT in the allowlist (do not touch it).
- [ ] Determinism: sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical.
      Any drift → STOP, diagnose, never blind-re-pin.

## Required Comments (`// why:`)

- [ ] In `schemeResourceLoss.ts`: why `SCHEME_LOSS` is set at the `turn.onMove`
      chokepoint (central; catches any depletion path) rather than at `recruitHero`.
- [ ] In `game.ts`: why the call sits beside `latchFinalTurnIfDeckExhausted` (same
      cadence; `SCHEME_LOSS` pre-empts the tie via precedence — D-24319).
- [ ] In `schemeTwistConfigs.ts` Civil War entry: why `resourceLossCondition`
      suppresses the (now inert) `lossThresholdByPlayerCount` proxy.

## Files to Produce (allowlist — 7 code/test + governance)

- [ ] `rules/schemeTwistConfig.types.ts` — union widened + `pile-depleted`.
- [ ] `rules/schemeResourceLoss.ts` — `applyPileDepletionResourceLoss` + pile resolver.
- [ ] `rules/schemeTwistConfigs.ts` — Civil War `resourceLossCondition`.
- [ ] `game.ts` — `turn.onMove` wiring (01.5 runtime-wiring; one import + one line).
- [ ] `rules/schemeResourceLoss.test.ts` — pile-depletion + kind-narrowing tests.
- [ ] `rules/schemeHandlers.test.ts` — Civil War proxy suppressed.
- [ ] `endgame/finalTurn.logic.test.ts` — hero-deck-empty `SCHEME_LOSS` pre-empts tie.
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, `DECISIONS` D-24318 + D-24319
      Active, mindmap `✅` + `roadmap:counts:write`, `STATUS` close-out, `NUMBER-LEDGER`.

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (record delta).
- [ ] `pnpm -r --no-bail test` exits 0 (whole workspace — the WP-508 lesson).
- [ ] Control-revert non-vacuous: drop the Civil War config → AC-4 fails; drop the
      `game.ts` wiring → AC-5 fails. Restore both.
- [ ] Sentinel + PRE_WP080 byte-identical; `sim:runtime-observed:check` current;
      `pnpm -r build` 0.
- [ ] Two-commit topology: `EC-545:` impl + `SPEC:` govern-close.
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Common Failure Smells

- Wiring the check at `recruitHero` only → twist-driven depletion misses the loss.
- Editing `applyEscapedPileResourceLoss` or `finalTurn.logic.ts` (out of scope).
- A control-revert that still passes (vacuous) — the wiring revert MUST fail AC-5.
