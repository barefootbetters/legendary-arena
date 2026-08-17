# WP-561 — In-Play Hollow Baseline Rebuild

**Status:** Draft 2026-08-16
**Layer:** Dashboard + Coverage Feeds (no engine, no `G`, no gameplay)
**Depends on:** WP-274 / D-24050 (the metric this amends) · WP-453 / D-24273 (the fidelity change that stranded the seed)
**Reserves:** EC-596 · D-24370
**Baseline:** `origin/main` @ `8eb8b0c3`
**Lane:** Standard two-session (touches a committed metric artifact and amends a
prior decision; the Lightweight Lane excludes scoring/PAR-adjacent surfaces).

---

## 1. Goal

The `/coverage` in-play metric cannot credit the work it exists to prioritise.
Run the existing baseline maintenance script — overdue since WP-453 changed the
sweep — so that implementing a mechanic *moves* its observations into the
resolved numerator instead of deleting them from the denominator.

## 2. Assumes

- **The mechanism already exists and is correct.**
  `apps/dashboard/scripts/build-in-play-baseline.mjs` monotonically merges the
  live sweep into the committed baseline (`peakObs = max(prior, current)`,
  never lowering), is deterministic (fixed `generatedAt` sentinel, stable key
  sort, byte no-op on unchanged input), and is run **deliberately** via
  `pnpm --filter dashboard build:in-play-baseline` — not in the auto-build
  chain. Its own header states the rationale: *"the denominator must NOT
  silently shrink when a mechanic gets fixed."* **No new mechanism is built by
  this WP.**
- **D-24050 defines the metric** as obs-weighted and ledger-gated: a mechanic's
  obs count as resolved iff its hero-ledger status is exactly `executable`.
- **`computeInPlayCoverage` is exported and pure**
  (`apps/dashboard/src/composables/useInPlayCoverage.ts`), so the invariant below
  is verifiable without a browser.
- **WP-453 changed the measuring instrument.** The sweep went from games dying
  at ~turn 0 to 312 completing games / 31 mechanics / 2219 observations. The
  committed baseline was never re-run against it.

## 3. Context

Observed on the deployed `/coverage` page: **2.6% in-play hollows resolved
(59 / 2285)**, sitting beside **36.1% hero mechanics executable**.

The 2.6% is not merely unflattering — it is **structurally unable to rise**.
`resolvedObs` counts only `executable` mechanics, and an executable mechanic
logs no live hollows, so its `peakObs` falls back to its committed baseline
value. That baseline is a hand seed (`generatedAt: "seed"`) of **14 mechanics /
140 obs**, recorded under the pre-WP-453 sweep. Measured on the baseline commit,
the entire numerator is three entries: `dodge` 37 + `undercover` 20 +
`size-changing` 2 = 59. Nothing from the live sweep can ever enter it.

So the credit for shipping a fix is whatever the stale seed happened to hold:

| Implement | Live obs | Credited | Metric moves |
|---|---|---|---|
| `teleport` | 178 | **0** | 2.6% → 2.8% |
| `outwit` | 157 | **0** | 2.6% → 2.8% |
| `artifact` | 169 | **1** | 2.6% → 2.8% |
| `investigate` | 293 | **5** | 2.6% → 3.2% |
| `coordinate` | 212 | **7** | 2.6% → 3.2% |

In every case the percentage rises only because observations were **deleted from
the denominator** — the metric rewards a fix by erasing its evidence. That is
the exact failure D-24050's baseline mechanism was designed to prevent. The
mechanism is right; the data is stale by ~16×.

**Scaffold (observed, `01.4 §Empirical Scaffold`).** Ran the existing writer on
the baseline commit and drove the **real** `computeInPlayCoverage` (not a
re-implementation):

- Rebuild: **14 mechanics / 140 obs → 35 / 2285.**
- **Today's headline is byte-identical:** old baseline 59/2285 = 2.6%; rebuilt
  baseline 59/2285 = **2.6%**. The rebuild does not move the optic.
- **The invariant, simulating `teleport` shipping** (status → `executable`, live
  obs → 0):

  | Baseline | Result |
  |---|---|
  | old (seed 140) | 59 / 2107 = 2.8% — credits **0**, denominator shrinks |
  | rebuilt (2285) | 237 / 2285 = **10.4%** — credits the full **178**, denominator held |

- **Exactly one test breaks**, and it is the invariant's own test:
  `useInPlayCoverage credits a fixed mechanic from the committed seed
  (dodge 37 → 26.4%)` hard-pins the stale seed (`totalObs 140`,
  `percentResolved 26.4`) **in its title as well as its assertions**. Post-rebuild
  it is `37 / 2285` = **1.6%**. The large snapshot test (`totalObs 2285`,
  `2.6%`) passes **unchanged** — which is the confirmation that the denominator
  did not move.

Prototype reverted; baseline re-verified green.

## 4. Scope (In)

- Run `pnpm --filter dashboard build:in-play-baseline` and commit the
  regenerated `apps/dashboard/src/data/in-play-hollow-baseline.json`.
- Re-pin the one broken test (assertions **and** title).
- Land `D-24370`, amending D-24050 with the **rebuild trigger**.
- Correct the two `/coverage` headline subtitles so row-weighted and
  observation-weighted stop reading as comparable percentages.
- Update `wiki/dashboard.md` in lockstep — **mechanism, not numbers**.

## 5. Scope (Out)

- **No change to `build-in-play-baseline.mjs`.** It is correct; it was simply
  not run. `git diff --exit-code` on that path must return 0.
- **No change to `computeInPlayCoverage`** or the `max(baseline, live)` rule.
- **No lowering of the denominator** by any means. A rebuild that reduces
  `totalObs` is a monotonicity regression and the script is designed to throw on
  it — do not work around that.
- **No engine, sweep-script, backdrop, or `assertAllGamesTerminated` change.**
- **No other committed artifact regenerated** in this packet.
- **No re-pin of the large snapshot test.** It must pass untouched; if it does
  not, the rebuild changed the denominator and that is a bug, not a win.

## 6. Files Expected to Change

| File | Change |
|---|---|
| `apps/dashboard/src/data/in-play-hollow-baseline.json` | regenerated (committed) |
| `apps/dashboard/src/composables/useInPlayCoverage.test.ts` | re-pin one test + its title |
| `apps/dashboard/src/pages/coverage/CoveragePage.vue` | two headline subtitles |
| `wiki/dashboard.md` | mechanism paragraph, lockstep |
| `docs/ai/DECISIONS.md` | D-24370 (amends D-24050) |
| indices + mindmap + STATUS | governance |

## 7. Contract

- The committed baseline is the **frozen high-water denominator**. It is rebuilt
  by running the existing writer, never hand-edited, and never lowered.
- **Rebuild trigger:** a material change in sweep fidelity — backdrop, shuffle,
  turn depth — REQUIRES a baseline rebuild in the same packet or the immediately
  following one. Otherwise `resolvedObs` stays pinned to the old instrument while
  `totalObs` moves to the new one, and the metric silently stops being able to
  credit work.
- A rebuild MUST NOT be used to move the headline percentage.

## 8. Acceptance Criteria

- **AC-1** — the regenerated baseline holds **35 mechanics / 2285 total peakObs**
  and no mechanic's peak is lower than before (monotonic).
- **AC-2** — the large snapshot test passes **unmodified**: `totalObs 2285`,
  `percentResolved 2.6`.
- **AC-3** — the invariant test is re-pinned to `totalObs 2285`,
  `resolvedObs 37`, `percentResolved 1.6`, and its **title no longer embeds the
  stale numbers**.
- **AC-4** — a test drives the real `computeInPlayCoverage` to assert the
  invariant directly: a mechanic flipped to `executable` with its live obs
  removed **retains** its peak in `totalObs` and **gains** it in `resolvedObs`
  (denominator unchanged). This is the claim the packet exists for; assert it,
  do not infer it from the snapshot.
- **AC-5** — `git diff --exit-code apps/dashboard/scripts/build-in-play-baseline.mjs`
  returns 0, and re-running the writer on the committed result is a byte no-op.
- **AC-6** — `pnpm --filter dashboard test` green, `vue-tsc` clean,
  `pnpm -r --no-bail test` green.
- **AC-7** — the two `/coverage` subtitles distinguish row-weighted from
  observation-weighted, and `wiki/dashboard.md` describes the baseline's role
  without quoting a figure that will drift.

## 9. Verification Steps

1. `pnpm -r build`, then `pnpm --filter dashboard build:in-play-baseline`.
2. Re-run the writer; confirm a byte no-op (AC-5).
3. `pnpm --filter dashboard test` and `pnpm -r --no-bail test`.
4. Confirm the four numbers by inspection: 35 / 2285 / 2.6% / 1.6%.
5. **D-24026 live-verification (REQUIRED):** after deploy, `/coverage` still
   reads **2.6%** with the corrected subtitles. An unchanged headline is the
   success condition here, not a null result.

## 10. Definition of Done

- AC-1 … AC-7 satisfied.
- D-24370 landed, explicitly amending D-24050.
- Indices / mindmap / STATUS updated; `roadmap:counts:check` and
  `ledger:numbers:check` exit 0.
- D-24026 recorded.
- `01.6` post-mortem assessed — expected **not** triggered (runs an existing
  script; no new contract, abstraction, builder, or category).

## Vision Alignment

Required by `00.3 §17.1` — **scoring / PAR / simulation-adjacent measurement**
(Vision §20–26) and a **dashboard surface**.

**Vision clauses touched:** §14, §20, §26.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
§14 (Explicit Decisions, No Silent Drift) is load-bearing — a metric whose
numerator and denominator are measured on different instruments is silent drift,
and this removes it while writing the trigger that prevents recurrence. §26
(Simulation-Calibrated PAR) is served: the sweep's output becomes usable as a
priority signal rather than a number that only falls.

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed. Internal operator
surface; no monetization, gating, or persuasive mechanic. Note the deliberate
anti-gaming stance: the WP forbids using a rebuild to improve the headline.

**Determinism preservation:** the writer is deterministic — fixed `generatedAt`
sentinel (never a wall-clock), stable key sort, byte no-op on unchanged input.
No engine, `G`, RNG, or replay surface is touched; the artifact is build-time
only and never re-enters gameplay.

## Gate Record (Phase 1)

**WP class:** Infrastructure & Verification (a committed measurement artifact and
its dashboard consumer).

| Gate | Verdict | Notes |
|---|---|---|
| Pre-flight (`01.4`) | **READY TO EXECUTE** (2026-08-16) | Dependencies verified on `main`: D-24050 defines the metric; WP-453 changed the instrument. **The reservation's framing was corrected during pre-flight:** it implied building a rebuild capability, but `build-in-play-baseline.mjs` already exists, is deterministic and monotonic, and is deliberately out of the auto-build chain — so the packet is "run the overdue maintenance", materially smaller than reserved. **Empirical Scaffold: run**, driving the real `computeInPlayCoverage`: rebuild 14/140 → 35/2285; today's headline byte-identical at 2.6%; the invariant demonstrated (`teleport` credits 0 → 178, denominator held); exactly one test breaks, with the stale numbers in its title as well as its body. |
| Copilot (`01.7`) | **PASS** (2026-08-16) | Two RISKs closed in-text: (1) a reader could take "rebuild the baseline" as re-baselining to flatter the number — §5 and §7 forbid it explicitly and AC-2 pins the headline unchanged; (2) re-pinning the invariant test could be mistaken for weakening it — AC-4 adds a direct assertion of the credit behaviour so the invariant is tested on its merits rather than through a snapshot constant. |
| Lint gate (`00.3`) | **PASS** | 21/21 below; §17 triggered and answered. |

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Title | Verdict |
|---|---|---|
| 1 | Work Packet Structure | PASS — all 10 sections in order |
| 2 | Non-Negotiable Constraints Block | PASS — §5 + §7 (never lower the denominator, never rebuild to move the number) |
| 3 | Prerequisites (`## Assumes`) | PASS — §2; the writer's own header quoted from source |
| 4 | Context References | PASS — §3 carries the credit table, the scaffold output, and the numerator decomposition |
| 5 | Output Completeness | PASS — §6; the one breaking test was found by running, not predicted |
| 6 | Naming Consistency | PASS — reuses `peakObs` / `resolvedObs` / `totalObs` verbatim |
| 7 | Dependency Discipline | PASS — WP-274 and WP-453 both merged |
| 8 | Architectural Boundaries | PASS — dashboard + its committed artifact; no engine or registry edge |
| 9 | Windows Compatibility | PASS — no new shell/path work |
| 10 | Environment Variable Hygiene | N/A — no env read |
| 11 | Authentication Clarity | N/A |
| 12 | Test Quality | PASS — AC-4 tests the invariant directly rather than via a pinned constant, which is what makes the re-pin in AC-3 safe |
| 13 | Commands and Verification | PASS — §9, including the byte-no-op re-run |
| 14 | Acceptance Criteria Quality | PASS — AC-1..AC-7 independently checkable |
| 15 | Definition of Done | PASS — §10, binary |
| 16 | Code Style | PASS — no new logic; a regenerated artifact, a re-pin, and two subtitles |
| 17 | Vision Alignment | PASS — triggered (measurement/PAR-adjacent); block cites §14, §20, §26 with the determinism line |
| 18 | Prose-vs-Grep Discipline | PASS — AC-5's grep is scoped to a named path |
| 19 | Bridge-vs-HEAD Staleness | PASS — baseline SHA in header; all citations read at that commit |
| 20 | Funding Surface Gate | N/A — internal operator surface |
| 21 | API Catalog Update | N/A — no endpoint |
