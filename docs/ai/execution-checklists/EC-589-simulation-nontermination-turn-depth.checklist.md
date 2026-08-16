# EC-589 — Simulation Non-Termination at Turn Depth

**Work Packet:** WP-554
**Layer:** Game Engine (`packages/game-engine/src/simulation`)
**Status:** Pending
**Locks:** D-24363

> The WP is the authoritative design document. Where this EC and WP-554
> conflict, the WP wins. This EC extracts the drift-prone values.

---

## Before Starting

- [ ] `git fetch origin main`, branch from a clean tree, record the SHA.
- [ ] `pnpm -r build` **before** any test run — a stale `dist` reports import
      crashes as test failures and shrinks the totals at the same time. Record
      the pre-change `pnpm --filter @legendary-arena/game-engine test` count;
      AC-4 uses it as a floor.
- [ ] **Reproduce first.** Run the locked reproducer at `maxTurns: 14` / seed
      `t::1` and confirm it does not complete; then confirm `maxTurns: 13`
      completes in ~87 ms. Do not fix what you have not observed.
- [ ] Read `simulation.runner.ts:496-511` (the endTurn-outside-cleanup
      stuck-break). The new budget is modelled on it, deliberately.

## Locked Values

Reproducer composition — copy verbatim, do not re-derive:

```
schemeId:        'core/portals-to-the-dark-dimension'
mastermindId:    'core/magneto'
villainGroupIds: ['core/brotherhood', 'core/hydra']
henchmanGroupIds:['core/savage-land-mutates']
heroDeckIds:     ['core/black-widow', 'core/captain-america', 'core/cyclops',
                  'core/deadpool', 'core/emma-frost']
bystandersCount: 12   woundsCount: 30   officersCount: 16   sidekicksCount: 16
```

- Entry point: `simulateOneGameAndCaptureMoves(composition, registry,
  [createCompetentHeuristicPolicy('t::1')], 't::1', 0, maxTurns)`
- Hanging cell: seed `t::1`, `maxTurns: 14`. Fast cells: `maxTurns: 13` any
  seed; `maxTurns: 14` with seeds `s::1` / `s::2` / `s::3` (19–50 ms).
- Offending card: `core-villain-brotherhood-blob-01` (**Blob**), marker
  `[require-to-defeat:team:x-men]`, `vAttack` 4.
- `MAX_MOVE_STEPS_PER_TURN = 100` — **copy the driver's number, do not invent
  one.** `apps/server/src/bot-ally/botAllyDriver.mjs:108` already declares
  `BOT_MAX_MOVE_STEPS_PER_TURN = 100` for the identical purpose; the `// why:`
  must name that parity and D-24038. A different value in the two consumers is a
  drift bug, not a tuning choice.
- Fix site A: `ai.legalMoves.ts:512-529` (the `for (let cityIndex …)` loop).
- Fix site B: `simulation.runner.ts:424` loop; reset the counter in the
  `endTurnFlag.triggered` block at `:529-548`.
- Helpers to import: `getDefeatRequirement`, `playerMeetsDefeatRequirement`
  from `../moves/villainDefeatRequirement.logic.js`.

## Guardrails

1. **Do NOT edit `packages/game-engine/src/moves/fightVillain.ts`.** Its
   requirement check is correct and is the reference behaviour. `git diff
   --exit-code` on that path must return 0.
2. **Do NOT lower `MAX_TURNS`** (in the sweep, the runner, or
   `runtime-observed-hollows.mjs`) to make a gate green. That hides the defect
   and is the one outcome this WP exists to prevent.
3. **Do NOT re-baseline the runtime-observed sweep** or regenerate
   `docs/ai/coverage/runtime-observed-hollows.json` here — that artifact only
   shifts under WP-453 and belongs to its unhold.
4. **Do NOT touch card data.** Blob's marker is correctly authored.
5. **No `.reduce()`** in the enumeration loop or the runner; use `for` /
   `for...of` with descriptive names per `code-style.md`.
6. **No clock, timer, `Math.random()`, or wall-clock read** in the budget — it
   is an integer counter. A time-based bound would destroy determinism.
7. **Mirror, do not abstract.** The new stuck-break is the second copy of the
   existing idiom; `code-style.md` says duplicate first, abstract on the third.
8. **`ai.legalMoves.ts` stays boardgame.io-free.** Import only from the pure
   helper module named in Locked Values.

## Required Comments

- [ ] `// why:` on `MAX_MOVE_STEPS_PER_TURN` — value justification (AC-6).
- [ ] `// why:` at fix site A — that enumeration must agree with the reducer's
      check, naming `fightVillain.ts` and the Blob repro.
- [ ] `// why:` at fix site B — that `maxTurns` bounds turns, not within-turn
      move-steps, citing this as the tenth recurrence (WP-286, WP-289, WP-427,
      WP-470, WP-476, WP-479, WP-486, WP-498, WP-532, WP-538), the driver parity
      with `BOT_MAX_MOVE_STEPS_PER_TURN`, and D-24363.

## Files to Produce

| File | New? |
|---|---|
| `packages/game-engine/src/simulation/ai.legalMoves.ts` | edit |
| `packages/game-engine/src/simulation/ai.legalMoves.test.ts` | edit |
| `packages/game-engine/src/simulation/simulation.runner.ts` | edit |
| `packages/game-engine/src/simulation/simulation.moveStepBudget.test.ts` | **new** |
| `docs/ai/DECISIONS.md` (D-24363) | edit |

Governance close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`docs/ai/STATUS.md`.

**Conditional:** if the enumeration change shifts the recorded decision stream,
`packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
must be re-recorded. Expected **unchanged** (games die near turn 0 on `main`) —
confirm which case holds, state it in the PR body, do not assume.

## After Completing

- [ ] Re-run the locked reproducer at `maxTurns: 14` / `t::1` and record the
      actual milliseconds in the PR body — "it terminates now" without a number
      is not Done. Re-run `maxTurns: 13` and seeds `s::1`–`s::3`; the fast cells
      must stay fast.
- [ ] `pnpm -r build && pnpm --filter @legendary-arena/game-engine test` green,
      count >= the recorded floor.
- [ ] `node scripts/check-number-ledger.mjs` and `pnpm roadmap:counts:check` exit 0.
- [ ] Land D-24363; flip WORK_INDEX `[x]`, EC_INDEX `Complete`, mindmap node to `✅`,
      then `pnpm roadmap:counts:write`.
- [ ] Assess the `01.6` post-mortem trigger — tenth recurrence of the class.
- [ ] Two-commit topology: `EC-589:` implementation, then `SPEC:` governance close.

## Common Failure Smells

- **Over-filtering.** A change that drops `fightVillain` whenever a requirement
  *exists* (rather than when it is *unmet*) passes AC-1 and silently breaks
  every legitimate fight. AC-2 is the guard — make it fail first.
- **Fixing the reducer instead.** Making `fightVillain` throw or mutate on a
  refused fight would end the spin and violate the never-throw move contract.
- **Testing the budget with a real board.** AC-3 wants a stub policy that always
  returns a refused move; reproducing via a real seed makes the test slow and
  brittle.
- **`git status` noise after building.** `packages/lagn-spec/schemas/lagn-v1.json`
  shows ` M` from line-ending churn with a 0/0 numstat. Confirm with
  `git diff --ignore-cr-at-eol --numstat`, then `git checkout --` it.
