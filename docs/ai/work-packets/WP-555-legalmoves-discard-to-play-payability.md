# WP-555 — `getLegalMoves` Discard-to-Play Payability

**Status:** Draft 2026-08-15
**Layer:** Game Engine (`packages/game-engine/src/simulation`) — single layer
**Depends on:** WP-554 / EC-589 / D-24363 (the rule this applies, and the bound that made this findable)
**Reserves:** EC-590 · D-24364
**Baseline:** `origin/main` @ `c4abddc5`
**Lane:** Standard two-session (determinism/simulation surface — same criterion that
excluded WP-554 from the Lightweight Lane; ambiguity resolves against eligibility).

---

## 1. Goal

`getLegalMoves` offers a `playCard` the move reducer then refuses, so a bot
re-picks it forever. Mirror the reducer's `discard-to-play` payability
precondition in the enumeration branch, closing the third instance of a
divergence class whose rule is already locked by D-24363.

## 2. Assumes

- **D-24363 part 1 already locks the rule** (landed at WP-554): *every*
  affordability/eligibility branch in `getLegalMoves` MUST mirror the exact
  precondition the corresponding move enforces, deriving the answer from that
  move's single-authority helper rather than re-implementing it. This WP applies
  that rule; it does not create a new one.
- **`playCard`'s precondition** lives at `coreMoves.impl.ts:340-350` (WP-383 /
  D-24185): `getDiscardToPlayCost(G, args.cardId)`, refused when
  `cost > 0 && playerZones.hand.length < cost + 1`. The `+ 1` is load-bearing —
  the played card is **still in hand** at that point, so paying the cost needs
  that many *other* cards.
- **`getDiscardToPlayCost`** is exported from
  `packages/game-engine/src/moves/resolveDiscardToPlay.ts:59` and is already
  imported into `ai.legalMoves.ts`'s import block (as
  `hasPendingDiscardToPlay` / `getEligibleDiscardToPlayCards`), so no new module
  edge is introduced.
- **This is the only unmirrored precondition on `playCard`.** Verified on the
  baseline: every other guard in that move is a block-all pending check, and all
  of those already have a `getLegalMoves` short-circuit. One fix closes the move.
- **WP-554's bound is what makes this findable.** Before it, this wedged the
  process; now it terminates as a recorded stuck game in ~80 ms.

## 3. Context

Surfaced 2026-08-15 while unholding WP-453 (seeded setup shuffle). With WP-554
merged, `pnpm sim:runtime-observed` no longer hangs — it fails in ~8 s with
`5 of 312 swept game(s) did not reach endgame`.

**The backdrop is not at fault.** The failing games are not spread across the
matrix: all five are the **same** `core` hero-deck board (seeds 0, 1, 2, 4, 7);
the other 38 sets terminate. Raising the turn cap does nothing —

| `MAX_TURNS` | 50 | 75 | 100 | 150 | 200 |
|---|---|---|---|---|---|
| Result | 4 CAP | 4 CAP | 4 CAP | 4 CAP | 4 CAP |
| Wall-clock | ~150 ms | ~88 ms | ~77 ms | ~86 ms | ~75 ms |

Flat runtime across a 4× cap increase means the games are **not running long** —
they are wedging and hitting WP-554's within-turn budget.

**Root cause (instrumented).** Logging the legal set at the budget break showed,
every time, a hand reduced to a single Cyclops card:

```
[budget-break] turn= 6  stage= main  legal= playCard{"cardId":"core/cyclops/determination#2"} | recruitHero{...} | advanceStage{}
[budget-break] turn=23  stage= main  legal= playCard{"cardId":"core/cyclops/optic-blast#1"} | advanceStage{}
```

Both cards carry `[keyword:discard-to-play:1]` (`data/cards/core.json`):
*"To play this card, you must discard a card from your hand."* Once the hand
holds only that card, `hand.length (1) < cost + 1 (2)` — the play is refused
forever, but `ai.legalMoves.ts:495-497` enumerates `playCard` for **every** hand
card unconditionally. The bot re-picks it, nothing mutates, the turn wedges.

**Production reach.** The live bot-ally driver and autoplay consume the same
`getLegalMoves`. A bot ally whose hand comes down to an unpayable
discard-to-play card re-attempts the refused play until
`BOT_MAX_MOVE_STEPS_PER_TURN` faults the turn — the co-op freeze signature.
This is a real match-affecting defect, not only a CI one.

**Third instance of one class.** WP-214 closed the fight-**cost** half, WP-554
the **defeat-requirement** half, and this closes the **discard-to-play** half —
all three at enumeration branches of the same function.

**Scaffold (observed, `01.4 §Empirical Scaffold`).** Narrowing an existing path,
so the validation-tightening class applies. Prototyped on the baseline: the
payability `continue` plus one added named import.
`pnpm --filter @legendary-arena/game-engine test` → **2656 pass / 0 fail**,
identical to the 2656 / 0 baseline; no fixture migration folds into scope.
`sim:runtime-observed:check` reports the artifact **current** on `main` with the
prototype applied. Applied onto the WP-453 branch, its previously-failing sweep
**completed: 312 games, 31 distinct mechanics, 2219 observations, 13.0 s, zero
non-terminating**. Prototype discarded.

## 4. Scope (In)

- Add a discard-to-play payability check to the `playCard` enumeration branch in
  `ai.legalMoves.ts`, deriving the cost from `getDiscardToPlayCost` and skipping
  when `cost > 0 && hand.length < cost + 1`.
- Tests in the existing `ai.legalMoves.test.ts`.
- Land `D-24364`.

## 5. Scope (Out)

- **No change to `coreMoves.impl.ts`.** The reducer is correct and is the
  reference behaviour; `git diff --exit-code` on that path must return 0.
- **No backdrop swap.** `core/portals-to-the-dark-dimension` is a faithful
  true-twist-loss scheme and is not the cause. Changing it would mask the defect
  and discard the coverage D-24323 chose it for.
- **No relaxation of `assertAllGamesTerminated`** in
  `scripts/runtime-observed-hollows.mjs`. That guard did its job.
- **No `MAX_TURNS` change** in either direction — measured irrelevant above, and
  D-24363 explicitly rejects turn-cap tuning as a substitute for a root fix.
- **No regeneration of `docs/ai/coverage/runtime-observed-hollows.json`.**
  Verified: the artifact stays current on `main` under this fix. It shifts only
  under WP-453's seeded shuffle and belongs to that WP's unhold.
- **No card-data edit.** The Cyclops markers are correctly authored.

## 6. Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/simulation/ai.legalMoves.ts` | payability `continue` + one named import |
| `packages/game-engine/src/simulation/ai.legalMoves.test.ts` | AC-1 … AC-3 cases |
| `docs/ai/DECISIONS.md` | D-24364 |
| `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md` | governance close |

Observed at draft: the sentinel fixture is **unchanged** (the scaffold's 2656 / 0
includes its hash assertion). The executor confirms against their own build.

## 7. Contract

`getLegalMoves` offers `playCard` for a hand card only when the card's
`discard-to-play` cost is payable — `cost === 0`, or `hand.length >= cost + 1`.
The cost is read from `getDiscardToPlayCost`, the same single authority
`playCard` uses; the payability arithmetic is never re-implemented.

## 8. Acceptance Criteria

- **AC-1** — `getLegalMoves` does **not** offer `playCard` for a card with
  `discard-to-play` cost 1 when it is the only card in hand.
- **AC-2** — `getLegalMoves` **does** offer that same card when the hand holds
  exactly `cost + 1` cards. (Boundary + anti-over-filtering guard: suppressing
  whenever the keyword is *present* would satisfy AC-1 and break every
  legitimate play of these cards.)
- **AC-3** — a card with no `discard-to-play` keyword is offered exactly as
  before, including when it is the only card in hand.
- **AC-4** — `pnpm --filter @legendary-arena/game-engine test` green with 2656
  as the floor.
- **AC-5** — `git diff --exit-code packages/game-engine/src/moves/coreMoves.impl.ts`
  returns 0, and `scripts/runtime-observed-hollows.mjs` is likewise unchanged.
- **AC-6** — the enumeration reads `getDiscardToPlayCost`; a grep of
  `ai.legalMoves.ts` for `getDiscardToPlayCost` returns at least one match.

## 9. Verification Steps

1. `pnpm -r build && pnpm --filter @legendary-arena/game-engine test` — green,
   count ≥ 2656.
2. `pnpm sim:runtime-observed:check` on `main` — expect *artifact is current*
   (this fix causes no drift on its own).
3. `node scripts/check-number-ledger.mjs --check` and
   `pnpm roadmap:counts:check` exit 0.
4. **Cross-WP (belongs to WP-453's unhold, not a gate here):** with this merged,
   WP-453's `pnpm sim:runtime-observed` completes with zero non-terminating
   games.

## 10. Definition of Done

- AC-1 … AC-6 satisfied.
- D-24364 landed.
- WORK_INDEX / EC_INDEX / mindmap / STATUS updated; `roadmap:counts:check` and
  `ledger:numbers:check` exit 0.
- `01.6` post-mortem assessed. Expected **not triggered** — no new contract,
  abstraction, builder, or code category; this is the third application of an
  existing rule.

## Vision Alignment

Required by `00.3 §17.1` — **simulation** (Vision §26) and **determinism / RNG
sourcing** (Vision §8, §22).

**Vision clauses touched:** §3, §4, §8, §16, §22, §26.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
§8 and §22 are strengthened — a bot that cannot make progress cannot produce a
reproducible evaluation, and §26's PAR calibration depends on the sweep
completing. §3 and §4 are served by removing a live bot-ally stall in co-op.
§16 is the surface the wedged turn violates.

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed. No monetization,
paid surface, gating, or persuasive mechanic; no mechanical advantage granted.

**Determinism preservation:** deterministic and replay-faithful. No clock,
timer, or `Math.random()`. The check is a pure integer comparison over existing
state. Narrowing enumeration removes only moves the reducer already refused, so
no move that could appear in a replayable trace is affected; the sentinel
fixture `finalStateHash` was observed unchanged at draft and is re-confirmed at
execution.

## Gate Record (Phase 1)

**WP class:** Infrastructure & Verification (move enumeration for the simulation
harness; adds no move, no phase, no `G` mutation, no `game.ts` wiring).

| Gate | Verdict | Notes |
|---|---|---|
| Pre-flight (`01.4`) | **READY TO EXECUTE** (2026-08-15) | Dependencies: WP-554 / D-24363 merged (`d66de5e2`). Contract verification: `getDiscardToPlayCost(G, cardId): number` read at source (`resolveDiscardToPlay.ts:59`) — signature fits the enumeration call site; the module is already imported by `ai.legalMoves.ts`, so no new edge. Confirmed the `+ 1` semantics against `coreMoves.impl.ts:349` rather than inferring them. Confirmed by grep that no other `playCard` precondition is unmirrored, so this does not become a fourth round. **Empirical Scaffold: run.** 2656 / 0 vs a 2656 / 0 baseline; artifact current; and the prototype turned WP-453's failing sweep into 312 games / 31 mechanics / 13.0 s with zero non-terminating games. |
| Copilot (`01.7`) | **PASS** (2026-08-15) | Two RISKs, both closed in-text: (1) over-filtering on keyword *presence* rather than payability — AC-2 pins the exact `cost + 1` boundary and the EC directs it to fail first; (2) the temptation to "fix" this by swapping the backdrop or relaxing the sweep guard — both are named in §5 and in the EC Guardrails, with the measurement table showing the backdrop is not the cause. |
| Lint gate (`00.3`) | **PASS** | 21/21 below; §17 triggered and answered. |

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Title | Verdict |
|---|---|---|
| 1 | Work Packet Structure | PASS — all 10 numbered sections in template order |
| 2 | Non-Negotiable Constraints Block | PASS — §5 (no reducer edit, no backdrop swap, no guard relaxation, no `MAX_TURNS` change) + EC Guardrails |
| 3 | Prerequisites (`## Assumes`) | PASS — §2; each line cites a file:line read at baseline `c4abddc5` |
| 4 | Context References | PASS — §3 carries the cap-sweep table, the instrumented budget-break output, and the card data proving the marker |
| 5 | Output Completeness | PASS — §6, two code/test files + governance |
| 6 | Naming Consistency | PASS — reuses `getDiscardToPlayCost` verbatim; no new identifier introduced |
| 7 | Dependency Discipline | PASS — WP-554 merged; no other dependency |
| 8 | Architectural Boundaries | PASS — `packages/game-engine/src/simulation` only; the helper is a pure boardgame.io-free module already imported, so `ai.legalMoves.ts` stays pure |
| 9 | Windows Compatibility | PASS — no shell/path work |
| 10 | Environment Variable Hygiene | N/A — no env read |
| 11 | Authentication Clarity | N/A — no auth surface |
| 12 | Test Quality | PASS — AC-2 pins the boundary at exactly `cost + 1`, which is where an off-by-one would hide; AC-4 pins the count floor |
| 13 | Commands and Verification | PASS — §9, each step operator-runnable |
| 14 | Acceptance Criteria Quality | PASS — AC-1..AC-6 independently checkable; AC-5 is `git diff --exit-code` |
| 15 | Definition of Done | PASS — §10, binary |
| 16 | Code Style | PASS — `continue` idiom already used twice in this file, no `.reduce()`, junior-readable integer comparison |
| 17 | Vision Alignment | PASS — triggered (simulation + determinism); block cites §3, §4, §8, §16, §22, §26 with the determinism line |
| 18 | Prose-vs-Grep Discipline | PASS — AC-5/AC-6 greps are scoped to named source paths, so this WP's prose cannot satisfy them |
| 19 | Bridge-vs-HEAD Staleness | PASS — baseline SHA in the header; every citation read at that commit |
| 20 | Funding Surface Gate | N/A — no funding or monetization surface |
| 21 | API Catalog Update | N/A — no HTTP endpoint; `getLegalMoves`' signature is unchanged |
