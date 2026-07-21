# WP-411 — Set `ctx.gameover` at end of game (top-level `endIf`) — unblock the completed-match pipeline

**Status:** Ready
**Primary Layer:** Game Engine (`game.ts` — the boardgame.io `Game` object) + an engine-runner integration test
**Dependencies:** WP-304 / D-24088 (`apps/engine-runner` headless match harness — the integration-test vehicle), the endgame evaluator (`endgame/endgame.evaluate.ts`, `evaluateEndgame`) — both on `main`.
**User-Visible Surface:** `none directly — engine wiring`. But this is the **keystone** that unblocks every completed-match consumer: competitive submission (WP-338), result-LAGN (WP-406), the Hall of Legends view + download (WP-407/408), and match-summary analytics (D-24169). **D-24026 live-verify applies** — after deploy, a real completed match must set `metadata.gameover` and be readable at `GET /api/match/:matchId/result-lagn`.

> Baseline: `origin/main` at commit `0b76b5f7` (INFRA NotableGameEvent variant count, PR #894).

---

## Session Context

While live-verifying the WP-407/408 Hall-of-Legends surface, a real completed
match (`J8rw6ziU4Xg`, a clean 2-player victory — Magneto's four tactics defeated,
`mastermindDefeated` in the diagnostics) returned `404 match_not_finished` from
`GET /api/match/:matchId/result-lagn`. A direct DB read confirmed the root cause:

```
match_id      | meta_has_gameover | meta_gameover | state_ctx_gameover
J8rw6ziU4Xg   | f                 |               |
```

**Both `metadata.gameover` AND `state.ctx.gameover` are null after a decisive win.**
The server's authoritative game state never recorded gameover.

The engine reason (verified this session): the endgame check is a **phase-level
`endIf`** on the `play` phase —

```ts
// game.ts (current)
play: {
  next: 'end',
  endIf: ({ G }) => {
    const result = evaluateEndgame(G);
    return (result ?? undefined) as unknown as boolean | void;
  },
  ...
},
...
end: {},   // empty
```

In boardgame.io a **phase** `endIf` only **ends the phase** (here → the empty
`end` phase); it does **not** set `ctx.gameover`. Only a **top-level Game `endIf`**
sets `ctx.gameover` and ends the game. `LegendaryGame` has **no top-level `endIf`**
and **no `events.endGame()`** call anywhere in the engine (both greps empty). The
`// why:` comment beside the phase `endIf` states the mistaken belief that
"boardgame.io stores any truthy endIf return as ctx.gameover" — true only for the
top-level `endIf`. So the game reaches its win/loss condition, ends the `play`
phase, transitions to the empty `end` phase, and **never sets gameover**.

**Blast radius (why this is critical, not cosmetic):** every completed-match
consumer gates on `metadata.gameover` / `isMatchFinished`:
- **Competitive submission** (WP-338) — which is exactly why production
  `competitive_scores` is **empty** (no score has ever been submittable).
- **result-LAGN** (WP-406) and the **Hall of Legends** view + download (WP-407/408).
- **Match-summary / dashboard analytics** (D-24169).
- Every "find a finished match" query in production returns **0 rows** — no match
  has *ever* registered gameover.

**Why no test caught it:** the engine tests assert the pure `evaluateEndgame(G)`
function directly; **nothing** asserts that the boardgame.io wiring turns that into
`ctx.gameover`, and the engine-runner harness plays a bounded number of turns
without asserting the match *terminates*. This WP closes both the wiring gap and
the test gap.

---

## Goal

After this session, a completed match sets `ctx.gameover` through a **top-level
`LegendaryGame.endIf`** that returns the endgame evaluation, so boardgame.io
persists `metadata.gameover`, `isMatchFinished` becomes true for finished matches,
and the whole completed-match pipeline (competitive scoring, result-LAGN, Hall of
Legends, match summaries) can finally trigger. A **regression test** proves the
wiring: the `endIf` returns the endgame result for a terminal state and `undefined`
for a mid-game state, and an **engine-runner integration test** plays a match to a
real win/loss and asserts `ctx.gameover` is set. The redundant, incorrect
`play`-phase `endIf` (and its misleading comment) is removed; the four-phase
structure (lobby/setup/play/end) is preserved.

---

## User-Visible Impact

**No new UI, but it is the switch that turns the completed-match pipeline on.**
Before this WP no match finishes in a way the server recognizes; after it, finished
matches set `metadata.gameover` and become readable/submittable. The observable
proof is the D-24026 live-verify: a real completed match now returns a document
from `result-lagn` (and, transitively, populates the Hall of Legends and unblocks
competitive submission). `docs/ai/STATUS.md` must describe this as an
engine-pipeline fix and record the live-verify as the completion gate.

---

## Assumes

- `packages/game-engine/src/game.ts` exports `LegendaryGame: Game<...>` with a
  `phases` block (`lobby`, `setup`, `play`, `end`) and imports `evaluateEndgame`
  from `endgame/endgame.evaluate.ts` (already used by the `play`-phase `endIf`).
  The `LegendaryGame` object has **no** top-level `endIf`.
- `packages/game-engine/src/endgame/endgame.evaluate.ts` exports
  `evaluateEndgame(G): EndgameResult | null` — a pure read over `G.counters`
  (heroes-win / scheme-wins / tie), the same function the phase `endIf` calls.
- `packages/game-engine/src/game.test.ts` pins **exactly 4 phases** (lobby,
  setup, play, end) and the move set. Removing/renaming a phase would break it —
  this WP keeps all four phases.
- `apps/engine-runner/src/runMatch.ts` runs a headless match to a bounded turn
  cap via the public engine surface (no `boardgame.io/testing`); `runMatch.test.ts`
  is the integration-test home.
- The `finalStateHash` sentinel oracle (`test/fixtures/hashGameState.ts`) hashes
  `G`; setting `ctx.gameover` does not mutate `G`. **But** recorded sentinel /
  golden fixtures may have been captured from games that ran *past* the gameover
  point (the old flow never terminated) — see the determinism note; the scaffold
  resolves it.
- `pnpm -r build` exits 0; engine + engine-runner + server suites pass on `0b76b5f7`.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a line:

- `packages/game-engine/src/game.ts` — the `LegendaryGame` object (top level:
  `setup`, `moves`, `phases`; **no `endIf`**), and the `play`-phase `endIf` +
  `next: 'end'` + the empty `end: {}` phase. The top-level `endIf` goes on the
  `LegendaryGame` object (a sibling of `moves`/`phases`), **not** inside a phase.
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — `evaluateEndgame`
  return shape (`{ outcome, reason } | null`); `null` = game continues.
- `packages/game-engine/src/game.test.ts` — the "exactly 4 phases" + move-set
  pins (keep them green) and the `LegendaryGame.setup!(...)` test pattern (the
  precedent for a new `LegendaryGame.endIf(...)` unit assertion).
- `apps/engine-runner/src/runMatch.ts` + `runMatch.test.ts` — how a full match is
  driven headless; where the "plays to a real gameover" integration test lands.
- `packages/game-engine/src/test/fixtures/hashGameState.ts` and the sentinel /
  golden `finalStateHash` fixtures + `replay/replay.execute.test.ts`
  (`PRE_WP080_HASH`) — the determinism oracles the scaffold must re-run.
- `apps/server/src/replay/matchReplay.logic.ts` — `isMatchFinished` reads
  `metadata ? 'gameover'`; this WP is what finally makes that true (no server
  edit here — the server already reads it correctly).
- `docs/ai/DECISIONS.md` — the reserved D-24223 at the tail of this WP; D-24119 /
  D-24169 (the completed-match reads this unblocks).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 6 (`// why:` on the `endIf` and
  its determinism rationale), ESM, no `.reduce()`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- All randomness via `ctx.random.*`; never `Math.random()`. The `endIf` is a
  **pure read** of `G` — it consumes no randomness.
- Moves never throw; only `Game.setup()` may throw. The `endIf` never throws.
- `G` / `ctx` are runtime-only; `G` stays JSON-serializable. `ctx.gameover` is set
  by the framework from the `endIf` return — application code does not write it.
- ESM only, Node v22+; `node:` prefix; test files `.test.ts`; no
  `boardgame.io/testing` (use the engine-runner / `makeMockCtx`).
- Every `ctx.events.setPhase()` / `endTurn()` needs a `// why:` — **not touched
  here** (the fix removes an `endIf`, adds a top-level `endIf`; no phase/turn
  event call is added).

**Packet-specific (locked):**
- **The fix is a top-level `LegendaryGame.endIf`:**
  ```ts
  endIf: ({ G }) => evaluateEndgame(G) ?? undefined,
  ```
  It returns the endgame result (truthy → boardgame.io sets `ctx.gameover` to it
  and ends the game) or `undefined` (game continues). `// why:` — a **phase**
  `endIf` only ends the phase; only a **top-level** `endIf` sets `ctx.gameover`;
  the prior phase-level check never terminated the match (the bug this fixes).
- **Remove the redundant `play`-phase `endIf`** and its misleading comment — the
  top-level `endIf` now owns termination, and a duplicate `evaluateEndgame` call at
  phase level is dead (gameover short-circuits before phase-end) and perpetuates
  the wrong mental model. **Keep** the `end` phase and `play.next` as-is (the
  four-phase structure is pinned by `game.test.ts`); do not restructure phases.
- **`gameover` value = the `evaluateEndgame` result verbatim** (`{ outcome, reason }`).
  Downstream already consumes this shape: the D-24169 match summary and the WP-406
  producer read `metadata.gameover.outcome` (`heroes-win` / `scheme-wins` / `tie`).
  Do not reshape it.
- **No new gameplay, no scoring change, no new move/phase/counter.** The win/loss
  *conditions* are unchanged (same `evaluateEndgame`); only *where boardgame.io is
  told the game ended* changes.
- **Determinism (load-bearing — scaffold-verified, see below).** Setting
  `ctx.gameover` does not mutate `G`, so `finalStateHash` (a hash of `G`) is
  unchanged for an identical `G`. **But** a game now **terminates** at the win/loss
  point instead of accepting further moves, so any recorded fixture captured *past*
  that point is now invalid. The scaffold MUST re-run the sentinel / golden
  `finalStateHash` fixtures and `PRE_WP080_HASH`; if any moved, the fix is correct
  and those fixtures are **re-recorded** (via the canonical recorder, never
  hand-edited) with the reason recorded — a deliberate re-pin, not a silent shift.

**Session protocol:** if the `end`-phase reconciliation or the determinism
treatment is unclear after the scaffold, stop and record the decision in the EC —
never guess.

**Locked contract values (do not re-derive):**
- **Top-level field:** `LegendaryGame.endIf = ({ G }) => evaluateEndgame(G) ?? undefined`.
- **`ctx.gameover` value:** the `EndgameResult` (`{ outcome, reason }`), framework-set.
- **Phases stay four:** `lobby`, `setup`, `play`, `end` (the `end` phase is retained).
- **Removed:** the `play`-phase `endIf` (superseded).

---

## Debuggability & Diagnostics

- The `endIf` is a pure function of `G`: `LegendaryGame.endIf({ G })` is directly
  unit-testable — non-`undefined` for a terminal `G`, `undefined` otherwise.
- The engine-runner integration test observes real termination: a match driven to
  a win/loss condition ends with `ctx.gameover` set to the `evaluateEndgame` result.
- No new `G` mutation; `G` stays JSON-serializable; the fix consumes no randomness,
  so replay reproduction is byte-identical up to the (now-correct) termination point.

---

## Scope (In)

### A) Engine — the top-level `endIf` (`packages/game-engine/src/game.ts`, **modified**)
- Add `endIf: ({ G }) => evaluateEndgame(G) ?? undefined` to the `LegendaryGame`
  object (top level, beside `moves` / `phases`). JSDoc / `// why:` per the locked
  constraint (phase-vs-game `endIf`; this is what finally sets `ctx.gameover`).
- **Remove** the `play`-phase `endIf` and its incorrect comment. Keep
  `play.next: 'end'` and the `end` phase (four-phase structure preserved).

### B) Engine — the wiring regression test (`packages/game-engine/src/game.test.ts`, **modified**)
- Assert `LegendaryGame.endIf` is defined and, given a **terminal** `G` (a state
  where `evaluateEndgame` returns non-null — construct via the endgame counters or
  a fixture), returns that result; given a **mid-game** `G`, returns `undefined`.
- Keep the existing "exactly 4 phases" and move-set assertions green.

### C) Engine-runner — the end-to-end termination test (`apps/engine-runner/src/runMatch.test.ts`, **modified/new**)
- Drive a headless match to a real win/loss condition and assert the run
  **terminates with `ctx.gameover` set** to the `evaluateEndgame` result — the
  coverage whose absence let the bug hide. If `runMatch` currently caps turns
  without asserting termination, add the gameover assertion (and, if needed, a
  deterministic scenario that reaches a win/loss within the cap).

### D) Determinism fixtures (**conditional — only if the scaffold shows movement**)
- If the sentinel / golden `finalStateHash` fixtures or `PRE_WP080_HASH` move
  (because a recorded game now terminates earlier), **re-record** them via the
  canonical recorder (`scripts/…record-game-fixture.mjs` / the replay re-pin), never
  by hand, and record the deliberate re-pin + reason in the EC and `DECISIONS.md`.
  If nothing moves, this scope item is a no-op (documented as verified).

---

## Out of Scope

- **No server change.** `isMatchFinished` / the result-LAGN producer / competitive
  submission already read `metadata.gameover` correctly — they were simply never
  reached. This WP does not touch `apps/server/**`.
- **No new gameplay, scoring, PAR, or leaderboard logic.** Win/loss conditions are
  unchanged.
- **No phase restructuring.** The four phases stay; the `end` phase is not removed
  (pinned by `game.test.ts`) even though the game now ends via `gameover` before
  reaching it.
- **No `NotableGameEvent` / `notableEvents` change**, no UIState change, no
  card-data change.
- **No retroactive backfill** of the historically-stuck production matches
  (`J8rw6ziU4Xg` etc.). They pre-date the fix and stay unfinished; a separate
  operational decision (out of scope) may reap or ignore them.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/game.ts` — **modified** — add top-level `endIf`; remove the `play`-phase `endIf`
- `packages/game-engine/src/game.test.ts` — **modified** — `endIf` wiring assertion (keep the 4-phase + move-set pins)
- `apps/engine-runner/src/runMatch.test.ts` — **modified/new** — full-match terminates with `ctx.gameover`
- `packages/game-engine/src/test/fixtures/*` + `replay/replay.execute.test.ts` — **modified ONLY IF the scaffold shows a hash/fixture shift** (deliberate re-record + reason)
- `docs/ai/DECISIONS.md` — **modified** — land **D-24223** Active
- `docs/ai/STATUS.md` — **modified** — engine-pipeline fix + the D-24026 live-verify gate
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

No other files may be modified (save one same-layer `01.5` wiring exception,
recorded in the EC).

---

## Contract

boardgame.io semantics: a truthy **top-level** `Game.endIf` return sets
`ctx.gameover` (to the returned value) and ends the game; boardgame.io's store then
persists `gameover` into the match `metadata`. After this WP a completed match's
`bgio.matches` row satisfies `metadata ? 'gameover'`, so `isMatchFinished` is true
and `GET /api/match/:matchId/result-lagn` returns the LAGN 1.4.0 result document
(WP-406). No HTTP contract changes — §21 N/A (the endpoint's behavior for a
*finished* match is already catalogued; this WP makes matches actually finish).

---

## Acceptance Criteria

All binary pass/fail.

- **AC-1** — `LegendaryGame.endIf` is defined at the top level and returns the
  `evaluateEndgame(G)` result for a terminal `G`, `undefined` for a mid-game `G`
  (unit-asserted in `game.test.ts`).
- **AC-2** — The `play`-phase `endIf` is removed; `LegendaryGame` still defines
  exactly four phases (lobby, setup, play, end) and the unchanged move set
  (`game.test.ts` green).
- **AC-3** — An engine-runner integration test drives a match to a real win/loss
  and asserts it **terminates with `ctx.gameover`** set to the `evaluateEndgame`
  result.
- **AC-4** — **Determinism resolved, never silent:** the sentinel / golden
  `finalStateHash` fixtures and `PRE_WP080_HASH` are re-run; each is either
  unchanged **or** re-recorded via the canonical recorder with the reason recorded.
- **AC-5** — `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test`,
  `pnpm --filter @legendary-arena/engine-runner test`, and `pnpm -r --no-bail test`
  pass (no new failures).
- **AC-6** — **D-24026 live-verify (post-deploy):** a real completed match sets
  `metadata.gameover` (`SELECT metadata ? 'gameover' …` is `t`) and
  `GET /api/match/:matchId/result-lagn` returns a valid LAGN 1.4.0 document — the
  terminal action that has been impossible until this fix. (This simultaneously
  unblocks the WP-407/408 populated-roster verifications.)

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
pnpm --filter @legendary-arena/engine-runner test
pnpm -r --no-bail test
# scaffold: confirm the endIf is top-level, not in a phase
Select-String -Path "packages\game-engine\src\game.ts" -Pattern "endIf"
# expect: exactly one match, at the LegendaryGame top level (not under `play:`)
git diff --name-only   # only Files Expected to Change (+ any recorded 01.5 file)
pnpm roadmap:counts:check
```

Then the AC-6 live pass on the deployed bundle: play a match to gameover, confirm
`metadata.gameover` is set and `result-lagn` returns the document.

---

## Empirical Scaffold (REQUIRED — 01.4; RUN, not reasoned)

This packet changes **when a match terminates**, a determinism-adjacent change. Per
`01.4 §Empirical Scaffold` a `READY` reached by argument is invalid for this class.
The executor MUST, before close:
1. Add the top-level `endIf`, remove the phase `endIf`, build, and run the engine +
   engine-runner + replay suites.
2. Record the sentinel / golden `finalStateHash` + `PRE_WP080_HASH` verdicts
   (unchanged vs moved). A move is **expected-correct** if a recorded game ran past
   the win/loss point under the old (never-terminating) flow — re-record and re-pin
   with the reason. A move with no such explanation is a **STOP**.
3. Confirm `game.test.ts`'s four-phase + move-set pins stay green.

---

## Vision Alignment

- **Clauses touched:** none of the §17.1 trigger surfaces directly (no scoring
  math, identity, monetization, or card-data change). **Determinism note
  (load-bearing):** the fix sets `ctx.gameover` (framework state, not `G`), so an
  identical `G` hashes identically; the only determinism exposure is that games now
  *terminate* at the win/loss point, which may invalidate fixtures recorded past it
  — handled by AC-4's re-run-and-re-pin discipline (dual-oracle hazard per
  `reference_hashed_g_field_dual_repin`). No conflict: this restores intended
  behavior (a game that ends) and confers no gameplay capability.
- **Determinism:** unchanged win/loss conditions; deterministic pure `endIf`.

## Funding Surface Gate

N/A — an engine wiring fix; no funding affordance/channel/copy.

## API Catalog

N/A — no HTTP endpoint or `apps/server/src/**` library function is added or changed;
the fix makes an already-catalogued endpoint reachable by making matches finish.

---

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| §1 Structure | PASS — all sections; Out of Scope lists ≥2 exclusions (server, phases, gameplay, backfill) |
| §2 Non-negotiables | PASS — engine-wide + packet-specific + locked values; determinism discipline explicit |
| §3 Assumes | PASS — exact objects/exports (`LegendaryGame`, `evaluateEndgame`, the 4-phase pin, engine-runner) + green baseline `0b76b5f7` |
| §4 Context refs | PASS — game.ts, endgame evaluator, game.test.ts, runMatch, the hash oracles, the D-entries |
| §5 Output completeness | PASS — small closed allowlist; determinism fixtures conditional-and-gated |
| §6 Naming | PASS — `endIf`, `evaluateEndgame`, `gameover`; no abbreviations |
| §7 Dependency discipline | PASS — no new dependency |
| §8 Architectural boundaries | PASS — engine + engine-runner test; no server edit; no new import edge |
| §9 Windows | PASS — `pwsh` `Select-String` scaffold |
| §10 Env vars | N/A |
| §11 Auth | N/A |
| §12 Test quality | PASS — unit (endIf) + integration (engine-runner termination); no `boardgame.io/testing` |
| §13 Commands | PASS — runnable verbatim |
| §14 AC quality | PASS — 6 binary criteria; AC-6 drives the terminal live action |
| §15 DoD | PASS — see below |
| §15.1 D-24026 | **TRIGGERED** — not `none — infrastructure` in effect: the fix unblocks user-visible completed-match surfaces; AC-6 is the live pass |
| §16 Code style | PASS — `// why:` on the `endIf`; no `.reduce()`; ESM |
| §17 Vision | PASS + the determinism note (fixtures re-run-and-re-pin, never silent) |
| §18 Determinism | **PASS, asserted** — AC-4 forces the fixture/hash verdict; re-pin is deliberate + reasoned |
| §19 Rollback | PASS — reverting restores the (buggy) prior state; no data migrates; historically-stuck matches unaffected either way |
| §20 Migration | N/A — no DB migration; stuck matches are not backfilled (Out of Scope) |
| §21 API catalog | N/A — no endpoint add/modify; the fix makes an existing endpoint reachable |

**Lint verdict: PASS (all 21 resolved).**

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] AC-1..AC-6 satisfied; AC-6 **live-verified** on the deployed bundle (a real
      completed match sets `metadata.gameover` and returns a `result-lagn` document)
- [ ] Empirical scaffold RUN; sentinel/golden `finalStateHash` + `PRE_WP080_HASH`
      verdict recorded (unchanged, or re-recorded + reasoned)
- [ ] `pnpm -r build` 0; engine + engine-runner suites pass; `pnpm -r --no-bail test`
      no new failures; `game.test.ts` four-phase + move-set pins green
- [ ] `git diff --name-only` matches `## Files Expected to Change`
- [ ] `docs/ai/DECISIONS.md` — **D-24223** landed Active
- [ ] `docs/ai/STATUS.md` updated (engine-pipeline fix + the D-24026 live-verify gate)
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `📝 → ✅`; `roadmap:counts:check` 0

---

## Reserved Decisions (land at execution)

- **D-24223 (reserved; Drafted 2026-07-21, not yet landed)** — The end-of-game
  condition is a **top-level `LegendaryGame.endIf`** that returns
  `evaluateEndgame(G) ?? undefined`, so boardgame.io sets `ctx.gameover` and
  persists `metadata.gameover`. The prior implementation placed the endgame check
  as a **phase-level `endIf`** on the `play` phase, which only ended the phase
  (→ the empty `end` phase) and **never set `ctx.gameover`** — so no match ever
  registered gameover, and every completed-match consumer (competitive submission
  WP-338, result-LAGN WP-406, Hall of Legends WP-407/408, match summaries D-24169)
  was unreachable (production `competitive_scores` empty). The four-phase structure
  (lobby/setup/play/end) is retained; the redundant phase `endIf` is removed. The
  fix mutates no `G`, so `finalStateHash` is unchanged for an identical `G`; the
  only determinism exposure is that games now terminate at the win/loss point,
  which is reconciled by re-running and, if needed, deliberately re-recording the
  sentinel/golden fixtures.

---

## See Also

- WP-338 / D-24126 — competitive submission (gates on `isMatchFinished`, the
  consumer this unblocks).
- WP-406 / D-24216 — the result-LAGN producer (gates on `metadata.gameover`).
- WP-407 / WP-408 — the Hall of Legends view + download whose AC-6 populated-roster
  live-verify is **blocked on this fix**.
- WP-304 / D-24088 — `apps/engine-runner` (the integration-test vehicle).
- `reference_hashed_g_field_dual_repin` — the dual-oracle hash-re-pin hazard.
