# WP-289 — Simulation Move-Dispatch Completeness for Interactive Resolve Moves

**Status:** Ready to Execute
**Layer:** Game Engine (`packages/game-engine/src/simulation`)
**Depends on:** WP-286 ✅ (added `resolveDrawOrEmpowered` to the dispatch maps + `SIMULATION_MOVE_NAMES`), WP-285 ✅, WP-248 ✅, WP-242 ✅ (the resolve moves themselves)
**EC:** EC-321
**Decisions:** D-24073
**User-Visible Surface:** none — infrastructure (balance-simulation tooling; no gameplay, no client, no server)

---

## Goal

Close a systemic latent-hang gap in the balance-simulation framework: the two
`getLegalMoves`-driven dispatch maps (`MOVE_MAP` in `simulation.runner.ts` and in
`par.aggregator.ts`) hold only the 8 core gameplay moves plus `resolveDrawOrEmpowered`
(added by WP-286), but `getLegalMoves` can also short-circuit to **three other interactive
resolve moves** — `resolveKoHeroChoice`, `resolveOptionalKoReward`,
`resolveVictoryPileCardPick`. When one of those pending choices is parked, `getLegalMoves`
returns ONLY that resolve move (the block-all guard freezes everything else); if the
dispatch map has no entry, the runner skips it as "unknown" and the pending choice never
clears — an **infinite within-turn loop**, because `maxTurns` bounds turns, not within-turn
move-steps. This WP adds the three missing entries to both maps and adds a **drift guard**
that fails if any future `getLegalMoves`-emittable move is left undispatchable.

---

## Assumes

- **WP-286 ✅** (D-24069) — discovered and partially fixed this gap: it added
  `resolveDrawOrEmpowered` to both `MOVE_MAP`s and to `SIMULATION_MOVE_NAMES` after
  One-Hit Wonder's unconditional park hung the competent sweep (`sim:runtime-observed:check`
  ran ~20 min before the fix). WP-286 Amendment B flagged the remaining systemic gap; this WP
  closes it. The `// why: WP-286` dispatch comments are the precedent to mirror.
- **`SIMULATION_MOVE_NAMES`** in `packages/game-engine/src/simulation/ai.legalMoves.ts` —
  the canonical list of move names the sim's `getLegalMoves` can emit. Currently a
  module-local `const` (not exported); it already lists all four resolve moves. This WP
  **exports** it as the single source of truth the drift guard reads.
- **`getLegalMoves`** short-circuits (`ai.legalMoves.ts`) — returns EXACTLY ONE resolve move
  when a pending choice is parked: `hasPendingVictoryPileCardPick` →
  `resolveVictoryPileCardPick`; `hasPendingOptionalKoReward` → `resolveOptionalKoReward`;
  `hasPendingKoHeroChoice` → `resolveKoHeroChoice`; `hasPendingDrawOrEmpowered` →
  `resolveDrawOrEmpowered`. This WP does not change any short-circuit.
- **The three resolve move functions** are already exported and used at the real move sites:
  `resolveKoHeroChoice` (`moves/koHeroChoice.resolve.ts`), `resolveOptionalKoReward`
  (`moves/optionalKoReward.resolve.ts`), `resolveVictoryPileCardPick`
  (`moves/resolveVictoryPileCardPick.ts`). This WP only **wires them into the sim dispatch**.
- **`par.aggregator.ts` duplicates `MOVE_MAP`** (RS-10 forbids it importing
  `simulation.runner.ts`), so the fix lands in both files identically.

---

## Context

WP-286's execution surfaced this: `antm/wonder-man`'s One-Hit Wonder parks a
`draw-or-empowered` choice **unconditionally** on play, so the competent sweep always reached
it and the missing dispatch entry hung the per-turn loop. The sibling resolve moves
(`resolveKoHeroChoice` / `resolveOptionalKoReward` / `resolveVictoryPileCardPick`) were never
hit only because their pending choices need preconditions a sweep rarely triggers (≥2 KO
targets; an optional-ko-reward card played with ≥1 eligible card; the-ebony-blade played with
≥1 villain in the victory pile). They are latent: a future card, board, or deeper sweep that
meets one of those preconditions would reintroduce the same infinite hang — and **nothing at
unit level guards it today** (the full engine suite passed 1651/0 with the gap present; only
the runtime-observed sweep CI gate caught the draw-or-empowered case, and only because
`antm/wonder-man` is in its hardcoded hero-deck sets).

This is recorded as WP-286 Amendment B (flagged for follow-up) in EC-318. Drafted against
`origin/main` at `97e08a24` (the WP-286/287 co-release squash + WP-288). Supersession check
clean: no WP/EC files or merged PRs under this slug.

**Why one WP:** the change is a single cohesive engine-simulation unit — the dispatch entries
are mechanical one-liners inseparable from the drift guard that protects them. No layer
boundary is crossed.

**Out-of-scope dispatch maps (deliberate):** `replay/replay.execute.ts` and
`test/fixtures/runFixture.ts` also omit the resolve moves, but they replay **recorded** move
lists, and no recorded fixture contains a resolve move (the sentinel is core-only). They are
not `getLegalMoves`-driven, so they cannot spontaneously hang; their completeness is a
separate, lower-priority concern noted but not fixed here.

---

## Scope (In)

- `simulation/ai.legalMoves.ts` — **export** `SIMULATION_MOVE_NAMES` (the drift guard's
  single source of truth). No logic change.
- `simulation/simulation.runner.ts` — add `resolveKoHeroChoice`, `resolveOptionalKoReward`,
  `resolveVictoryPileCardPick` to `MOVE_MAP` (mirroring the WP-286 `resolveDrawOrEmpowered`
  entry); export the map's key set (`SIMULATION_RUNNER_MOVE_NAMES`) for the drift guard.
- `simulation/par.aggregator.ts` — the same three additions to its duplicated `MOVE_MAP`;
  export its key set (`PAR_AGGREGATOR_MOVE_NAMES`).
- `simulation/simulation.moveDispatch.drift.test.ts` — **new**: assert both exported key sets
  are a **superset** of `SIMULATION_MOVE_NAMES` (every emittable move is dispatchable), and
  that the two maps agree with each other.

## Out of Scope

- **`getLegalMoves` logic, the short-circuits, or any resolve move** — unchanged; this WP
  only wires existing moves into the existing dispatch maps.
- **`replay/replay.execute.ts` + `test/fixtures/runFixture.ts`** — replay recorded lists; no
  fixture contains a resolve move; deferred (see §Context).
- **`dodgeCard` / `sendUndercover` / `playFromUndercover`** — registered moves that
  `getLegalMoves` never emits (the sim never plays them), so they are intentionally absent
  from `SIMULATION_MOVE_NAMES` and need no dispatch entry.
- **Any gameplay, determinism, or sentinel change** — the three added moves are never emitted
  in the current sweep (proven by the sweep passing today), so the runtime-observed artifact
  and `finalStateHash` are unchanged (confirmed empirically at execution).

---

## Files Expected to Change

- `packages/game-engine/src/simulation/ai.legalMoves.ts` — modified (export `SIMULATION_MOVE_NAMES`)
- `packages/game-engine/src/simulation/simulation.runner.ts` — modified (3 dispatch entries + key-set export)
- `packages/game-engine/src/simulation/par.aggregator.ts` — modified (3 dispatch entries + key-set export)
- `packages/game-engine/src/simulation/simulation.moveDispatch.drift.test.ts` — **new** (the drift guard)

**Governance (govern-close):** `docs/ai/DECISIONS.md` (D-24073), `docs/ai/work-packets/WORK_INDEX.md`
(WP-289 `[x]`), `docs/ai/execution-checklists/EC_INDEX.md` (EC-321 Done), `docs/ai/STATUS.md`,
`docs/05-ROADMAP-MINDMAP.md` (WP-289 node).

---

## Contract

- **D-24073 (the invariant this WP locks):** the simulation `getLegalMoves` move-emission set
  (`SIMULATION_MOVE_NAMES`) and the simulation dispatch maps (`MOVE_MAP` in
  `simulation.runner.ts` and `par.aggregator.ts`) must stay in sync — every name in
  `SIMULATION_MOVE_NAMES` MUST have a dispatch entry in both maps. A missing entry is not a
  benign skip: it is an infinite within-turn loop (`maxTurns` bounds turns, not move-steps).
  Enforced by `simulation.moveDispatch.drift.test.ts`.
- Move-name strings are the engine `LegendaryGame.moves` keys (verbatim); the dispatch entries
  reuse the already-exported move functions (no re-implementation).

---

## Acceptance Criteria

- **AC-1:** `simulation.runner.ts` `MOVE_MAP` dispatches `resolveKoHeroChoice`,
  `resolveOptionalKoReward`, and `resolveVictoryPileCardPick` (each calling the existing move
  function), in addition to the existing `resolveDrawOrEmpowered` + 8 base moves.
- **AC-2:** `par.aggregator.ts` `MOVE_MAP` dispatches the same three (its duplicated map).
- **AC-3:** `SIMULATION_MOVE_NAMES` is exported from `ai.legalMoves.ts` (no logic change).
- **AC-4:** `simulation.moveDispatch.drift.test.ts` asserts both exported map key sets are a
  superset of `SIMULATION_MOVE_NAMES`, and would FAIL if a name were added to
  `SIMULATION_MOVE_NAMES` without a dispatch entry in either map (negative assertion proven
  with a synthetic "phantom" move name).
- **AC-5:** `pnpm --filter @legendary-arena/game-engine build` 0; `test` green (≥ baseline +
  the drift cases); `tsc --noEmit` 0.
- **AC-6:** Determinism preserved — `pnpm sim:runtime-observed:check` exits 0 with the
  artifact **byte-current** (the three added moves are never emitted in the current sweep, so
  no trajectory change); sentinel `finalStateHash` unchanged.
- **AC-7:** Engine diff limited to the four `simulation/` files; no gameplay/move/rule file
  touched; `pnpm -r build` 0.

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine build        # 0
pnpm --filter @legendary-arena/game-engine test         # green; ≥ baseline + drift cases
pnpm --filter @legendary-arena/game-engine exec tsc --noEmit   # 0
pnpm sim:runtime-observed:check                          # 0; "artifact is current" (byte-stable)
pnpm -r build                                            # 0
git diff --name-only -- packages/game-engine             # only the 4 simulation/ files
```

---

## Vision Alignment

**Touched surfaces (§17.1):** Determinism / simulation tooling (Vision §3, §8) — the balance
sim is the determinism-proving harness.

**Clause check:** §3/§8 (determinism) — the fix makes the deterministic sim complete and
loop-free; it adds no randomness and changes no trajectory (the added moves are unreached in
the current sweep). No conflict.

**Conflict assertion:** No conflict.

**Non-Goal proximity:** No NG-1..7 crossed (no monetization, identity, scoring weights, or
gameplay surface).

**Determinism preservation:** The added dispatch entries reuse existing move functions; they
are only reached when `getLegalMoves` emits the corresponding resolve move, which does not
occur in the current sweep — so the runtime-observed artifact and `finalStateHash` are
unchanged (confirmed empirically). The drift guard adds a pure test.

---

## Funding Surface Gate

**N/A** — simulation-tooling infrastructure; no UI, copy, or funding channel; no §20.1 surface.

## §21 API Catalog

**N/A** — no `apps/server` HTTP endpoint or `Library-only` function added or modified.

---

## Lint Gate Self-Review

| § | Status | Notes |
|---|---|---|
| §1 Structure | ✅ PASS | All required sections present |
| §2 Constraints | ✅ PASS | Reuse-not-reimplement; both maps; drift guard; no logic change |
| §3 Assumes | ✅ PASS | WP-286/285/248/242 deps; SIMULATION_MOVE_NAMES + short-circuits cited |
| §4 Context | ✅ PASS | WP-286 Amendment B origin; baseline 97e08a24; supersession clean |
| §5 Files | ✅ PASS | 4 source/test files listed + governance |
| §6 Naming | ✅ PASS | Canonical move-name strings; SIMULATION_MOVE_NAMES verbatim |
| §7 Dependencies | ✅ PASS | No new npm deps |
| §8 Boundaries | ✅ PASS | Single layer (game-engine simulation); no crossing |
| §9 Windows | ✅ PASS | `pwsh` verification steps |
| §10 Env Vars | ✅ PASS | None |
| §11 Auth | N/A | No auth surface |
| §12 Tests | ✅ PASS | `node:test`; drift guard with positive + negative assertions |
| §13 Verification | ✅ PASS | Exact commands incl. the sweep determinism check |
| §14 AC Quality | ✅ PASS | 7 binary, observable items |
| §15 DoD | ✅ PASS | STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap; D-24026 N/A (infrastructure) |
| §16 Code Style | ✅ PASS | `// why:` on each dispatch entry + the exports; named imports; no `.reduce()` |
| §17 Vision | ✅ PASS | Determinism (§3/§8) cited; no conflict; determinism line present |
| §18 Grep/Prose | ✅ PASS | No literal-string grep gate restates a forbidden token in adjacent prose |
| §19 HEAD Staleness | N/A | Not a repo-state-summarizing artifact |
| §20 Funding | ✅ PASS | N/A with justification |
| §21 API Catalog | ✅ PASS | N/A with justification |

**Lint gate verdict: ALL PASS — ready for pre-flight.**

---

## Pre-flight Verdict

**READY TO EXECUTE**

- ✅ WP-286 on main (`resolveDrawOrEmpowered` in both `MOVE_MAP`s + `SIMULATION_MOVE_NAMES`,
  confirmed at `97e08a24`) — the precedent to mirror
- ✅ The three resolve moves + their `getLegalMoves` short-circuits confirmed present on main
- ✅ `SIMULATION_MOVE_NAMES` lists all four resolve moves (the export target)
- ✅ Scope locked: 4 simulation/ files; no layer crossing; reuse not re-implement
- ✅ Determinism expected unchanged (the added moves are unreached in the current sweep —
  proven by the sweep passing today; executor confirms empirically via
  `sim:runtime-observed:check`)
- ✅ Ambiguity resolved: replay maps + sim-unemitted moves explicitly out of scope

---

## Copilot Check Verdict

**PASS**

Direct structural mirror of WP-286's dispatch fix (016c50fe), generalized to the three
sibling resolve moves and hardened with a drift guard. The load-bearing risks: (1) a hidden
trajectory change in the sweep — mitigated by the empirical `sim:runtime-observed:check` and
the fact that the moves are unreached today; (2) the drift guard must actually fail on a gap —
covered by the negative ("phantom move") assertion (AC-4). No new contract, no gameplay
change, no determinism impact expected.

---

## Definition of Done

- [ ] All 7 Acceptance Criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine test` green (≥ baseline + drift cases)
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` 0
- [ ] `pnpm sim:runtime-observed:check` 0 (artifact byte-current); `finalStateHash` unchanged
- [ ] `pnpm -r build` 0
- [ ] `docs/ai/STATUS.md` updated with the WP-289 execution summary
- [ ] `docs/ai/DECISIONS.md` — D-24073 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-289 checkbox flipped to `[x]`
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-321 flipped to Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-289 node added
- [ ] No files outside `## Files Expected to Change` modified
- [ ] **User-Visible Surface: none — infrastructure.** STATUS.md entry states "No
      user-observable change — balance-simulation tooling only; closes the WP-286 Amendment-B
      systemic dispatch gap + adds a drift guard." D-24026 N/A (no live surface).
