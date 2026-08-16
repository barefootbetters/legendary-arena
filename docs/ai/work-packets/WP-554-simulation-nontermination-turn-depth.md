# WP-554 — Simulation Non-Termination at Turn Depth

**Status:** Draft 2026-08-15
**Layer:** Game Engine (`packages/game-engine/src/simulation`) — single layer
**Depends on:** none blocking (see §2 — WP-453 is *unblocked by* this WP, not a prerequisite)
**Reserves:** EC-589 · D-24363
**Baseline:** `origin/main` @ `9250a50155b5c8d80a9c9e22e6de751d353c13cc`
**Lane:** Standard two-session (touches a determinism/simulation surface — the
Lightweight Lane's structural criterion #6 excludes RNG/determinism, so the lane
is not available).

---

## 1. Goal

Stop a simulated game from running forever. `getLegalMoves` offers a
`fightVillain` the move reducer then silently refuses, so the bot re-picks the
same rejected move without limit and the per-turn loop never advances. This WP
closes the divergence at its source and adds a structural within-turn move-step
budget so that *any* future divergence of this shape terminates as a recorded
"stuck" game instead of hanging the process.

## 2. Assumes

- **`getLegalMoves` is the shared move-enumeration surface** for the simulation
  runner (`simulation.runner.ts:455`), the live bot-ally driver
  (`apps/server/src/bot-ally/botAllyDriver.mjs`), and autoplay
  (`apps/server/src/autoplay/autoplay.mjs`). It is exported from the package
  root at `packages/game-engine/src/index.ts:478`. Confirmed by grep on the
  baseline commit.
- **`getDefeatRequirement` / `playerMeetsDefeatRequirement`** exist as pure,
  boardgame.io-free helpers at
  `packages/game-engine/src/moves/villainDefeatRequirement.logic.ts:26,50`
  (the file's own header states "Deterministic, side-effect free, independently
  testable; no boardgame.io"). They are therefore importable from
  `ai.legalMoves.ts` without crossing a layer or purity boundary.
- **`fightVillain.ts:127-131`** already consults those helpers and returns
  `void` when the requirement is unmet — the move-side behaviour is correct and
  is NOT being changed. This WP brings the *enumeration* side into agreement
  with it.
- **WP-453 (PR #1440) is held in draft** pending this WP. It is **not** a
  prerequisite: every acceptance criterion below is testable on `main` as-is.
  The relationship runs the other way — WP-453 cannot merge until this lands.
  (The EC-589/WP-554 ledger reservations, written before the investigation
  completed, record "hard-dep WP-453"; §3 explains why that is superseded.)

## 3. Context

While executing WP-453 (seeded setup shuffle), the per-PR
`sim:runtime-observed:check` gate went from ~50 s on `main` to **35+ minutes**
on the WP-453 branch. The reservation for this WP was written expecting an
*investigation*. The investigation is now complete, so this WP drafts as a
**fix**.

**Bisect (measured 2026-08-15).** `simulateOneGameAndCaptureMoves` on
`core/portals-to-the-dark-dimension` + `core/magneto` (brotherhood + hydra,
savage-land-mutates, 5 heroes, playerCount 1), competent-heuristic policy:

| Turn cap | Seeds `s::1`–`s::3` | Seed `t::1` |
|---|---|---|
| 12 / 13 | 19–98 ms | ~87 ms |
| 14 | 19–50 ms | **no completion in >500 s** |

A specific `(board, seed, turn-depth)` combination — not a uniform slowdown.

**Root cause (instrumented 2026-08-15).** Logging the policy's chosen intent
every 20 000 iterations of the shared turn loop produced an unchanging line:

```
turn= 13  stage= main  move= fightVillain {"cityIndex":3}
city= [...,"core-villain-brotherhood-blob-01",null]
economy= {"attack":4,"recruit":3,"spentAttack":0,...}
```

City slot 3 holds **Blob**, whose card data carries
`You can't defeat Blob unless you have an [team:x-men] Hero.
[require-to-defeat:team:x-men]` (`data/cards/core.json`). Blob's `vAttack` is 4
and the player has 4 attack, so `ai.legalMoves.ts:512-529` — which gates
`fightVillain` on Guard-blocking, `resolveFightCost` and `getPatrolModifier`
only, and **never consults the defeat requirement** — offers the move. The
reducer's requirement check rejects it, returns `void`, mutates nothing, and
the next iteration enumerates the identical move set. `turnsElapsed` increments
**only** when `endTurnFlag.triggered` (`simulation.runner.ts:529-548`), so
`maxTurns` never bounds this: the loop spins inside turn 13 forever.

**Why it was invisible before.** The pre-WP-453 reverse-mock setup shuffle
stacked every `scheme-twist-…` on top of the villain deck and killed these
games at or near turn 0, so the harness never reached turn 13. The
"~2.7 ms each" budget at `scripts/coverage/runtime-observed-hollows.mjs:77` was
calibrated against games that barely ran.

**Why the structural guard, and not just the Blob fix.** This is at least the
**tenth** recorded instance of the same hang class. `ai.legalMoves.ts` and
`simulation.runner.ts` carry a comment for each — WP-286, WP-289 / D-24073,
WP-427 / D-24248, WP-470 / D-24282, WP-476 / D-24284, WP-479 / D-24286,
WP-486 / D-24291, WP-498 / D-24301, WP-532 / D-24343, WP-538 / D-24347 — every
one fixed by adding one more move to the dispatch list, every one repeating the
same sentence: *"maxTurns bounds turns, not within-turn move-steps."* Ten
reactive point-fixes, no bound. A within-turn move-step budget converts the
whole class from "CI hangs for 35 minutes" into "one game is recorded stuck" —
the same treatment the loop already gives the endTurn-outside-cleanup case at
`simulation.runner.ts:496-511`.

**The bound already exists in production; only the simulation lacks it.** The
bot-ally driver declares `BOT_MAX_MOVE_STEPS_PER_TURN = 100`
(`apps/server/src/bot-ally/botAllyDriver.mjs:108`) with exactly this rationale:
*"the cap bounds a within-turn spin so `BOT_MAX_TURNS` (which counts whole
turns) cannot be out-waited by a single stuck turn — the ~10-minute freeze class
D-24038 fixed for autoplay."* The simulation runner has `MAX_TURNS_PER_GAME` but
no move-step counterpart, so it is the one consumer of `getLegalMoves` that can
still spin unbounded. This WP brings it to parity rather than inventing a new
safety concept.

**Production reach, and a direct precedent at the same site.** The live bot-ally
driver and autoplay consume the same `getLegalMoves`, so a bot ally holding ≥4
attack against Blob with no X-Men Hero played re-attempts a rejected fight in a
real match until the 100-step cap faults the turn. This has already happened
once for the *sibling* divergence: the comment at `ai.legalMoves.ts:516-524`
records that enumerating on static `cardStats.fightCost` instead of
`resolveFightCost` "offered the bot an unaffordable fight the fightVillain move
then silently rejected … until the 100-step per-turn cap FAULTED the co-op match
(prod freeze, matches `aifbXW04bA1` / `eAVZNdWE5C1`, 2026-07-27)." WP-214 fixed
the cost half of this guard at this exact line. The defeat-requirement half was
left open.

**Scaffold (observed, not reasoned — `01.4 §Empirical Scaffold`).** The
enumeration change narrows an existing path, so the validation-tightening class
applies. Prototyped on 2026-08-15 in the draft worktree: the defeat-requirement
`continue` plus the two imports, nothing else. Result —
`pnpm --filter @legendary-arena/game-engine test` **2648 pass / 0 fail**,
identical to the pre-change baseline of **2648 pass / 0 fail**. No pre-existing
fixture asserts that a requirement-blocked `fightVillain` is enumerated, so no
fixture migration folds into scope. Prototype discarded; execution re-implements.

**Sequencing note (supersedes the ledger reservation).** EC-589's reservation
text assigns the sweep re-baseline and the regeneration of
`docs/ai/coverage/runtime-observed-hollows.json` to this WP. That artifact only
shifts **under WP-453's seeded shuffle**, so re-baselining here would force a
dependency on WP-453 that this WP otherwise does not have. The re-baseline
moves to WP-453's unhold (§5).

## 4. Scope (In)

- Add a defeat-requirement check to the `fightVillain` enumeration branch in
  `ai.legalMoves.ts`, mirroring the reducer's check in `fightVillain.ts:127-131`
  and following the existing `isGuardBlocking(...) continue` idiom in the same
  loop.
- Add a within-turn move-step budget (`MAX_MOVE_STEPS_PER_TURN = 100`, the
  simulation-side counterpart of the driver's `BOT_MAX_MOVE_STEPS_PER_TURN`) to
  the shared turn loop in
  `simulation.runner.ts`, modelled exactly on the existing
  endTurn-outside-cleanup stuck-break (log a warning, set
  `turnsElapsed = maxTurns`, `break`).
- Unit tests for both, in the existing `ai.legalMoves.test.ts` and a new
  `simulation.moveStepBudget.test.ts`.
- Land `D-24363`.

## 5. Scope (Out)

- **No change to `fightVillain.ts`.** The reducer is already correct; changing
  it would move the bug rather than close it.
- **No change to the mastermind path.** `fightMastermind.ts` does not consult
  `getDefeatRequirement` (verified by grep on the baseline) — masterminds carry
  no `[require-to-defeat:…]` marker, so there is no divergence to close there.
- **No re-baseline of the runtime-observed sweep** and no regeneration of
  `docs/ai/coverage/runtime-observed-hollows.json` — see §3's sequencing note;
  both belong to WP-453's unhold. **Observed at draft:** with the prototype
  applied on `main`, `pnpm sim:runtime-observed:check` reports *"artifact is
  current"* (3.9 s), so this fix on its own causes no artifact drift. The
  exclusion is measured, not assumed.
- **No `MAX_TURNS` cap chosen to make a CI gate green.** Explicitly forbidden:
  the sweep's turn depth is not to be lowered as a substitute for this fix.
- **No card-data edit.** Blob's marker is correct as authored.
- **No new villain effect primitive**, no vocabulary change, no registry change.

## 6. Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/simulation/ai.legalMoves.ts` | defeat-requirement `continue` in the `fightVillain` loop + two imports |
| `packages/game-engine/src/simulation/ai.legalMoves.test.ts` | AC-1 / AC-2 cases |
| `packages/game-engine/src/simulation/simulation.runner.ts` | `MAX_MOVE_STEPS_PER_TURN` const + counter + stuck-break |
| `packages/game-engine/src/simulation/simulation.moveStepBudget.test.ts` | **new** — AC-3 |
| `docs/ai/DECISIONS.md` | D-24363 |
| `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md` | governance close |

**Conditional (execution-time finding, not pre-authorized scope):** if the
enumeration change shifts the recorded decision stream,
`packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
needs re-recording. **Observed at draft: unchanged** — the scaffold's 2648 / 0
run includes the fixture's hash assertion and it passed. The EC still requires
the executor to confirm this against their own implementation rather than
inherit the draft's observation.

## 7. Contract

- `getLegalMoves` **must not** enumerate a move the corresponding reducer will
  refuse. The `fightVillain` entry is offered only when the city slot is
  occupied, not Guard-blocked, affordable *and* the acting player satisfies the
  villain's `[require-to-defeat:…]` requirement.
- The shared turn loop terminates unconditionally. `MAX_MOVE_STEPS_PER_TURN`
  bounds move-steps **within** one turn; `maxTurns` continues to bound turns.
  Exhausting the budget records the game as stuck (`turnsElapsed = maxTurns`,
  contributing 0 to winRate) — identical treatment to the existing
  endTurn-outside-cleanup break.

## 8. Acceptance Criteria

- **AC-1** — `getLegalMoves` does **not** include `fightVillain` for a city slot
  whose villain carries an unmet `[require-to-defeat:…]` requirement, even when
  attack covers the fight cost.
- **AC-2** — `getLegalMoves` **does** include that `fightVillain` once the
  requirement is satisfied. (Guards against over-filtering: AC-1 alone is
  satisfiable by never offering the move.)
- **AC-3** — a game driven by a policy that always returns a move the reducer
  refuses terminates via the move-step budget, is recorded stuck, and does not
  exceed `MAX_MOVE_STEPS_PER_TURN` policy calls in a single turn.
- **AC-4** — `pnpm --filter @legendary-arena/game-engine test` is green, with
  the pre-change test count as the floor (no test lost to an import crash).
- **AC-5** — `grep -n "require-to-defeat\|DefeatRequirement"
  packages/game-engine/src/simulation/ai.legalMoves.ts` returns at least one
  match, and `packages/game-engine/src/moves/fightVillain.ts` is byte-identical
  to the baseline (`git diff --exit-code` on that path returns 0).
- **AC-6** — `MAX_MOVE_STEPS_PER_TURN` is `100`, mirroring the driver's
  `BOT_MAX_MOVE_STEPS_PER_TURN` (`botAllyDriver.mjs:108`), and carries a
  `// why:` comment naming that parity and D-24038, in the style of
  `MAX_TURNS_PER_GAME`'s comment at `simulation.runner.ts:85-89`.

## 9. Verification Steps

1. `pnpm -r build && pnpm --filter @legendary-arena/game-engine test` — green,
   count ≥ baseline.
2. Re-run the locked reproducer (EC §Locked Values) at `maxTurns: 14`, seed
   `t::1`. Expect completion in **< 5 s**, versus no completion in >500 s.
   Record the observed number.
3. Confirm `maxTurns: 13` and seeds `s::1`–`s::3` still complete in tens of ms
   (no regression to the fast cases).
4. `node scripts/check-number-ledger.mjs` and `pnpm roadmap:counts:check` exit 0.
5. **Cross-WP (post-merge, belongs to WP-453's unhold, not a gate here):**
   rebase PR #1440 onto this and confirm `sim:runtime-observed:check` returns to
   the ~50 s order.

## 10. Definition of Done

- AC-1 … AC-6 all satisfied.
- D-24363 landed in `DECISIONS.md`.
- WORK_INDEX / EC_INDEX / mindmap / STATUS updated; `roadmap:counts:check` and
  `ledger:numbers:check` exit 0.
- Verification step 2 recorded with an actual measured figure in the WP or the
  PR body — a claim of "it terminates now" without the number is not Done.
- `01.6` post-mortem trigger assessed. This is the tenth recurrence of the
  within-turn hang class (§3); the executor applies `01.6`'s own criteria and
  authors the post-mortem in Session 2 if it fires.

## Vision Alignment

Required by `00.3 §17.1` — this touches **simulation** (Vision §26) and
**determinism / RNG sourcing** (Vision §8, §22).

**Vision clauses touched:** §3, §4, §8, §16, §22, §26.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
§8 (Deterministic Game Engine) and §22 (Deterministic & Reproducible
Evaluation) are strengthened, not traded: a loop that cannot terminate cannot
produce a reproducible evaluation at all. §26 (Simulation-Calibrated PAR
Determination) depends on the sweep completing, which today it does not at
depth. §4 (Faithful Multiplayer Experience) and §3 (Player Trust & Fairness)
are served by removing a live bot-ally stall. §16 (Performance &
Responsiveness) is the surface the 35-minute CI gate violates.

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed. No monetization,
no paid surface, no gating, no persuasive or social mechanic, no mechanical
advantage sold or granted. The change is a correctness fix to move enumeration
plus a termination bound.

**Determinism preservation:** the change is deterministic and replay-faithful.
No clock, timer, `Math.random()`, or wall-clock read is introduced — the
move-step budget is a plain integer counter compared against a compile-time
constant, so a given `(setup, seed, policy)` triple still produces a byte-identical
move stream. Narrowing enumeration removes only moves the reducer already
refused, i.e. moves that could never appear in a replayable trace
(`simulation.runner.ts:514-520` excludes refused dispatches from the recorder).
The executor confirms empirically whether `finalStateHash` on the sentinel
fixture moves (§6) rather than assuming it does not.

## Gate Record (Phase 1)

**WP class:** Infrastructure & Verification (simulation harness + its move
enumeration; adds no move, no phase, no `G` mutation in gameplay, no `game.ts`
wiring). Mandatory sections for this class: Dependency Check, Input Data
Traceability, Structural Readiness, Scope Lock, Test Expectations, Risk Review,
Runtime Readiness, Dependency Contract Verification, Maintainability.

| Gate | Verdict | Notes |
|---|---|---|
| Pre-flight (`01.4`) | **READY TO EXECUTE** (2026-08-15) | **Dependency check:** no prerequisite WP; WP-453 is downstream, not upstream. **Dependency contract verification:** `getDefeatRequirement(G, cardId)` and `playerMeetsDefeatRequirement(G, playerId, requirement)` read at source — signatures compatible with the enumeration call site, both pure and boardgame.io-free, so `ai.legalMoves.ts` keeps its documented purity. `activePlayer` (`ai.legalMoves.ts:196`) is the correct player argument. **Empirical Scaffold (REQUIRED — this is a validation-tightening WP):** prototyped and run, **2648 pass / 0 fail vs a 2648 / 0 baseline**, zero fixture migration; `sim:runtime-observed:check` **OK, artifact current** with the prototype applied, so the Scope (Out) exclusion of the artifact regeneration is observed rather than argued; the sentinel fixture test is inside that green suite, so `finalStateHash` is unchanged. Prototype discarded. **Corrections made during pre-flight, not deferred:** (a) every `file:line` citation was originally taken from the WP-453 worktree, which carries extra lines — all re-read and re-pinned against baseline `9250a501`; (b) the recurrence count was understated as "fourth" — the actual comment set names ten WPs; (c) `MAX_MOVE_STEPS_PER_TURN` was drafted at an invented `500` and is now pinned to `100` to match the driver's existing `BOT_MAX_MOVE_STEPS_PER_TURN`. |
| Copilot (`01.7`) | **PASS** (2026-08-15) | Adversarial pass found no BLOCK. Two RISKs, both closed in-text: **(1)** an over-filtering implementation would satisfy AC-1 while breaking every legitimate fight — AC-2 and the first Failure Smell exist specifically to kill that, and the EC directs the executor to make AC-2 fail first. **(2)** a `100`-step budget could in principle false-flag a legitimately long turn — rejected on evidence: the driver has run real matches at exactly this bound since D-24038, and a realistic turn is ~25–30 steps. Also confirmed the WP does not quietly inherit the ledger reservation's re-baseline scope; the supersession is stated in §3 and enforced by Guardrail 3. |
| Lint gate (`00.3`) | **PASS** | All 21 sections resolved below; §17 triggered (simulation + determinism/RNG) and answered in `## Vision Alignment` with clause numbers and the determinism line. |

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Title | Verdict |
|---|---|---|
| 1 | Work Packet Structure | PASS — all 10 numbered sections present in template order |
| 2 | Non-Negotiable Constraints Block | PASS — §5 (no `fightVillain.ts` edit, no `MAX_TURNS` cap, no re-baseline) + EC Guardrails |
| 3 | Prerequisites (`## Assumes`) | PASS — §2; each line cites a file:line verified on the baseline commit |
| 4 | Context References | PASS — §3 carries the bisect table, the instrumented spin output, and the four prior recurrences with their D-numbers |
| 5 | Output Completeness | PASS — §6, four code/test files + governance, with the fixture listed as a conditional execution-time finding |
| 6 | Naming Consistency | PASS — `MAX_MOVE_STEPS_PER_TURN` mirrors the existing `MAX_TURNS_PER_GAME`; full English words, no abbreviations |
| 7 | Dependency Discipline | PASS — no blocking dependency; §2 corrects the ledger's stale "hard-dep WP-453" |
| 8 | Architectural Boundaries | PASS — `packages/game-engine/src/simulation` only. Both imported helpers are documented boardgame.io-free pure helpers, so `ai.legalMoves.ts` stays pure per `code-style.md §Pure Helpers` |
| 9 | Windows Compatibility | PASS — no shell, path, or filesystem work |
| 10 | Environment Variable Hygiene | N/A — no env read |
| 11 | Authentication Clarity | N/A — no auth surface |
| 12 | Test Quality | PASS — AC-2 exists specifically to defeat the over-filtering degenerate pass; AC-4 pins the test count as a floor per the stale-`dist` false-red trap |
| 13 | Commands and Verification | PASS — §9, each step operator-runnable; step 2 requires a recorded figure |
| 14 | Acceptance Criteria Quality | PASS — AC-1..AC-6 each independently checkable; AC-5 is a grep + `git diff --exit-code` |
| 15 | Definition of Done | PASS — §10, binary, and refuses an unmeasured "it terminates now" |
| 16 | Code Style | PASS — `for` loop + `continue` idiom already in the file, no `.reduce()`, `// why:` required by AC-6, junior-readable integer counter |
| 17 | Vision Alignment | PASS — triggered (simulation + determinism/RNG); `## Vision Alignment` cites §3, §4, §8, §16, §22, §26 with the determinism line |
| 18 | Prose-vs-Grep Discipline | PASS — AC-5's greps are scoped to two named source paths, so this WP's own prose cannot satisfy them |
| 19 | Bridge-vs-HEAD Staleness | PASS — baseline SHA recorded in the header; every cited file:line read at that commit |
| 20 | Funding Surface Gate | N/A — no funding, monetization, or paid surface |
| 21 | API Catalog Update | N/A — no HTTP endpoint added/changed, and no `Library-only` catalog entry touched. `getLegalMoves` is already exported from the package root; its signature is unchanged |
