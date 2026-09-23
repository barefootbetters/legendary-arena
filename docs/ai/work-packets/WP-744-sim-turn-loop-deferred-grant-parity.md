# WP-744 — Sim / PAR / fixture turn loops resolve and clear deferred conditional grants (Engine — simulation)

**Status:** Draft 2026-09-22 (EC-781; D-24567 reserved) — READY TO EXECUTE (pre-flight READY, copilot PASS r2, lint PASS r2)
**Primary Layer:** Game Engine — observation harnesses (`packages/game-engine/src/simulation/**`, `packages/game-engine/src/test/fixtures/runFixture.ts`)
**Dependencies:** WP-568 / D-24377 (wait-and-see deferred conditional grants) ✅, WP-656 / D-24467 (edge-triggered defeat grant + `villainOrMastermindDefeatedSinceResolve`) ✅, WP-266 (`applyOnBeginParity`) ✅, WP-732 / D-24553 (the four-loop parity precedent) ✅
**User-Visible Surface:** none — infrastructure (observation-harness parity; the regenerated runtime-observed feed shifts the operator dashboard's derived coverage totals by a few observations — no new UI, no player-facing change)
**Baseline:** `origin/main` @ `a4cfd995`

---

## Goal

Make the engine's simulation, PAR sweep and replay-fixture runner play wait-and-see
hero cards the way a live match does. Today a card such as Thor's **Surge of Power**,
Emma Frost's **Diamond Form**, Hawkeye's **Impossible Trick Shot** (D-24565) or
**Gamma-Draining Nanites** never pays out in those
harnesses when its condition becomes true later in the turn, and the waiting entries
pile up across turns. After this WP the three harnesses fire those grants after every
move and drop them at the turn boundary, exactly as `game.ts` does, so sim outcomes,
PAR sweeps and the runtime-observed feed stop under-counting these cards.

---

## User-Visible Impact

None on play.legendary-arena.com; the live game already runs `game.ts`. Payoff: sim
outcomes, scenario PAR runs over non-diagnostic hero pools, and the runtime-observed /
dashboard coverage feeds stop undercounting wait-and-see cards (Surge of Power,
Diamond Form, Impossible Trick Shot, Gamma-Draining Nanites, and WP-743's two).

---

## Assumes

All verified at baseline `a4cfd995`.

- **The live resolution path.** The play-phase `turn.onMove` in `game.ts` (~L763–796)
  runs after every play-phase move, in this order: `latchFinalTurnIfDeckExhausted`,
  `applyPileDepletionResourceLoss`, `checkAndTransformScheme`,
  `resolveDeferredHeroGrants(G, { G, ctx, random })`, `openDivingBlockSeatChoiceIfNeeded`.
- **The live clear path.** The play-phase `turn.onBegin` (~L798–818) runs
  `clearDeferredConditionalGrants(G)` and then a guarded
  `delete G.villainOrMastermindDefeatedSinceResolve`.
- **`resolveDeferredHeroGrants(G, ctx: unknown)`** (`hero/heroEffects.execute.ts`
  ~L5426) is exported, never throws, reads the turn through `readTurnNumber(ctx)`
  (`ctx.ctx.turn`, 0 when absent), dispatches fired effects through `runHookEffects`
  with the passed context (so a grant that draws uses `ctx.random.Shuffle`), and
  consumes the WP-656 edge flag at its end.
- **`clearDeferredConditionalGrants(G)`** (`hero/deferredConditionalGrants.ts` ~L122)
  is exported and is a guarded delete.
- **Three loops rebuild the turn cycle and skip both hooks.**
  - `simulation/simulation.runner.ts` `runPerTurnLoop`: move dispatch ~L652,
    `applyPileDepletionResourceLoss` ~L661 (the only `onMove` mirror), turn rotation +
    `applyOnBeginParity` ~L734. `simulateOneGame`, `simulateOneCoopGame` and
    `simulateOneGameAndCaptureMoves` all run through this one loop.
  - `simulation/par.aggregator.ts` private `simulateOneGame`: dispatch ~L719,
    `applyPileDepletionResourceLoss` ~L728, rotation + `applyOnBeginParity` ~L786.
  - `test/fixtures/runFixture.ts`: `dispatchSingleMove` ~L370 (no `onMove` mirror at
    all), `rotateToNextTurn` → `applyOnBeginParity` ~L334.
  - None calls `resolveDeferredHeroGrants` or `clearDeferredConditionalGrants`, and
    none clears the edge flag. A grep for either name under `src/simulation`,
    `src/test/fixtures` and `src/replay` finds no call.
- **Each loop already builds a live-shaped move context** per dispatch
  (`{ G, playerID, ctx: { phase, turn, currentPlayer, numPlayers }, events, random: { Shuffle } }`),
  the same object the dispatched move receives.
- **`replay/replay.execute.ts` is a deliberate exclusion.** Its header (D-24322
  clarification) documents that this reducer-determinism harness does not run any
  `turn.onMove` effect, and it has no turn-rotation site. The faithful server replay
  (D-24119) runs boardgame.io's reducer, which runs `game.ts`.
- **Wait-and-see condition types** (`WAIT_AND_SEE_CONDITION_TYPES`):
  `recruitMadeThisTurnAtLeast`, `distinctHeroClassesAtLeast`,
  `defeatedVillainOrMastermindThisTurn`, `cardsDrawnThisTurnAtLeast`. WP-743 (drafted,
  not executed) adds two more; this WP covers them without change.
- **Sentinel fixture.** `sentinel-core-doom-2p` uses Black Widow + Captain America,
  whose cards carry no wait-and-see condition. `PRE_WP080_HASH` is an empty replay.
- **Draft scaffold (observed, 2026-09-22, on `a4cfd995`).** The fix was prototyped on
  a throwaway branch (the exact edits in Scope A–C) and measured:
  - `pnpm --filter @legendary-arena/game-engine test`: **4121 / 4121 pass**, no
    sentinel or `PRE_WP080_HASH` failure.
  - `pnpm sim:runtime-observed:check`: **FAIL (drift)**. Baseline `main` passes the
    same check, so the drift is this change. Regenerated: `totalObservations`
    2528 → 2506, `parse-unrecognized` 2038 → 2016, all from `transform` (143 → 121).
  - `apps/dashboard` `useInPlayCoverage.test.ts`, after `prebuild:coverage` copies
    the regenerated feed: **1 fail**, `totalObs` actual **3011**, pinned 3012.
  - `pnpm sim:coverage --check`: exit 0, no baseline change.
  - **PAR profiles (`data/par/profile/v1/**`): unchanged by this fix.** The sweep's
    fixed diagnostic hero pool (`generate-par-profiles.mjs` `HERO_POOL`: core
    Spider-Man, Hulk, Wolverine, Black Widow, Cyclops, Iron Man) builds **99 hooks,
    0 with a wait-and-see condition** (`buildHeroAbilityHooks` against the local
    registry; control: core Thor builds 5, all `recruitMadeThisTurnAtLeast`). With no
    recorded entry the resolver is a no-op and the edge flag is never set, so the
    profiles cannot move. Empirically: the first 16 scenarios regenerated on the
    scaffold are **byte-identical** to the same 16 regenerated on unpatched `main`.
  - **Pre-existing, unrelated:** those same 16 scenarios already drift on unpatched
    `main` (12 of 16 profiles differ from the committed files) — the profiles are
    stale since the #2251 re-pin. Not this WP's change (see Out of Scope).
  - The sentinel's heroes (Black Widow + Captain America) build 33 hooks, 0
    wait-and-see — consistent with the unchanged oracles.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- **Found by** the WP-743 pre-flight (2026-09-22), recorded in WP-743 §Out of Scope
  as "Pre-existing sim gap (not fixed here)". The gap dates from WP-568 / WP-656: both
  wired the live hooks in `game.ts` and never mirrored them into the rebuilt loops.
- **Why it matters.** The sim and PAR are how the operator reads card and scenario
  strength (`sim:runtime-observed`, the dashboard coverage views, the diagnostic PAR
  profiles and their fidelity report). A wait-and-see card played before its
  condition is met is worth zero in every harness today, so those surfaces undercount
  exactly the cards the D-24377 whole-turn window was built for. (The diagnostic
  PAR profiles happen to use a hero pool with no such card, so they are unaffected
  today; scenario PAR runs over any other hero set are affected.) WP-743 adds two more
  such cards; without this WP they inherit the same undercount.
- **Why the call goes after `applyPileDepletionResourceLoss`.** That preserves the
  live `onMove` relative order (pile-depletion before deferred resolution). The other
  live `onMove` effects the sims do not mirror today are out of scope (below).
- **Why the clear goes in `applyOnBeginParity`.** It is the single shared `onBegin`
  mirror for all three loops (WP-266), which is exactly where WP-743 also puts its two
  flag deletes. One helper edit covers every loop, including the initial-turn call in
  the sim and PAR.
- **Why `replay.execute.ts` stays excluded.** It is contract-locked as the
  reducer-determinism tool (D-0205, D-24322) and already skips every `onMove`
  effect. Adding one there would contradict D-24322. The sim ↔ runFixture capture
  contract is the one that must hold, and both sides change together here. The
  WP-732 memory rule ("patch all four loops") is about **endgame timing**, which
  `replay.execute.ts` does honor; this WP records the exclusion in that file's header
  so the next reader does not re-litigate it.
- **Execution-order note with WP-743.** Both WPs edit `onBeginParity.ts` and both
  regenerate `runtime-observed-hollows.json` + the dashboard pin. They are independent
  (neither hard-depends on the other). Whichever executes second rebases and
  **regenerates** the derived artifacts; the observed numbers in this WP are the
  baseline-`a4cfd995` values and are not to be copied if WP-743 lands first.
  - If WP-743 lands first, keep its two flag deletes in `applyOnBeginParity` and add
    this WP's clear beside them.
  - If this WP lands first (WP-743 still Draft), this WP's governance-close `SPEC:`
    commit amends WP-743 §Out of Scope: the "Pre-existing sim gap (not fixed here)"
    bullet and its two "Consequence here" sub-bullets are replaced with "Fixed by
    WP-744 / D-24567: a sim Spring the Trap played before a same-turn Master Strike
    now grants when the strike arrives, as live does." 
- **Lane.** Two-session lane. The change touches the PAR aggregator's turn loop, and
  the lightweight lane excludes PAR surfaces (01.0a eligibility #6), even though no
  committed PAR artifact moves.
- DECISIONS: D-24377, D-24467, D-24322, D-0205, D-24553.
- Code to read first: `game.ts` play-phase `turn.onMove` + `turn.onBegin`;
  `hero/heroEffects.execute.ts` `resolveDeferredHeroGrants`;
  `hero/deferredConditionalGrants.ts`; `simulation/onBeginParity.ts` + its test;
  `simulation/simulation.captureMoves.test.ts` (the WP-732 round-trip pattern); the
  `replay/replay.execute.ts` header.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words,
  `is`/`has`/`can` booleans, JSDoc on every function, `// why:` on non-obvious
  choices, no `.reduce()` with branching.
- Determinism: no `Math.random()` or wall-clock. Randomness reaches the resolver only
  through the loop's existing seeded `random.Shuffle`.
- Error messages are full sentences.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and ask.

**Packet-specific:**
- **No `game.ts` change and no live-path change.** Only the three rebuilt loops and
  their shared parity helper change. A diff under `game.ts`, `hero/**`, `moves/**` or
  `setup/**` is out of scope.
- **Reuse the live functions.** Call the exported `resolveDeferredHeroGrants` and
  `clearDeferredConditionalGrants`. No re-implementation, no new helper module, no
  new `G` field.
- **One resolve call per loop, after each successfully dispatched move.** It receives
  the same move-context object the move received. It is skipped when no move was
  dispatched (the sim/PAR unknown-move path). In the sim and PAR it runs immediately
  **after** `applyPileDepletionResourceLoss`.
- **Hash oracles stay byte-unchanged.** The sentinel `finalStateHash` and
  `PRE_WP080_HASH` must not move (the scaffold observed both unchanged). A moved
  oracle is a bug to diagnose, never a re-pin.
- **`replay.execute.ts` changes by comment only.** No behavior change.
- **Derived artifacts regenerate through their sanctioned commands only**, never by
  hand. The dashboard `totalObs` re-pin is the paired feed-regen re-baseline and
  carries a `Tests-changed:` trailer.
- **Drift pins are runtime assertions** (D-24372). Never `any`, `@ts-ignore`, or a
  widened production type.

---

## Scope (In)

### A) `packages/game-engine/src/simulation/onBeginParity.ts` (**modified**)
- `applyOnBeginParity` additionally calls `clearDeferredConditionalGrants(gameState)`
  and then does a guarded `delete gameState.villainOrMastermindDefeatedSinceResolve`
  (guarded = only when `!== undefined`), mirroring `game.ts` `onBegin` in the same
  order.
- `// why:` on each: the whole-turn window ends at the turn boundary (D-24377), and
  it mirrors `game.ts` for the rebuilt loops (WP-744 / D-24567).
- Update the module JSDoc and the function JSDoc, which today say the helper owns
  only the two allowance flags, to name the deferred-grant clear and the edge-flag
  delete.
- New import: `clearDeferredConditionalGrants` from `../hero/deferredConditionalGrants.js`.

### B) `simulation/simulation.runner.ts` + `simulation/par.aggregator.ts` (**modified**)
- In each loop body, keep a reference to the move context of a dispatched move (a
  variable declared per iteration, `undefined` when `moveFn` is `undefined`).
- Immediately after the existing `applyPileDepletionResourceLoss(gameState)`, when a
  move was dispatched, call `resolveDeferredHeroGrants(gameState, <that context>)`.
- `// why:` naming `game.ts` `turn.onMove` (WP-568 / D-24377, WP-656 / D-24467), the
  live relative order, and WP-744 / D-24567.
- New import: `resolveDeferredHeroGrants` from `../hero/heroEffects.execute.js`.

### C) `packages/game-engine/src/test/fixtures/runFixture.ts` (**modified**)
- In `dispatchSingleMove`, immediately after `moveDispatch(moveContext, move.args)`
  and before the `endTurnFlag` rotation check, call
  `resolveDeferredHeroGrants(gameState, moveContext)`.
- `// why:` noting this is the lockstep partner of the sim loop (the capture →
  replay contract, D-24273) and that `record-game-fixture.mjs` records through it.
- New import: `resolveDeferredHeroGrants` from `../../hero/heroEffects.execute.js`.
- The rotation already calls `applyOnBeginParity`, so Scope A covers its clear.

### D) Derived artifacts (**modified**; regenerated by their sanctioned commands)
- **Certain** (observed drift at draft):
  - `docs/ai/coverage/runtime-observed-hollows.json` via `pnpm sim:runtime-observed`.
  - `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: re-pin the real-seed
    snapshot's `totalObs` (the `3012` assertion, ~L407) to the value computed from
    the regenerated feed (observed 3011 at `a4cfd995`), with a dated comment in the
    house style above it. `percentResolved` is expected to hold at 24.4; re-pin it
    only if it actually moves, with the same comment. `Tests-changed:` trailer.
- **Unaffected by construction (not in the allowlist):**
  - `data/par/profile/v1/**` — the fixed diagnostic hero pool has no wait-and-see
    hook (Assumes, draft scaffold). Do **not** regenerate them in this WP: they are
    already stale on `main` for unrelated reasons, and a regen here would bundle that
    drift into `EC-781:`.
  - `data/par/seed/**` — seed PAR is computed from authored difficulty ratings, not
    simulation (`generate-seed-par.mjs`).
- **Checked, expected unchanged:** `scripts/coverage/hero-effect-coverage.baseline.json`
  (`sim:coverage --check` exit 0 at draft).

### E) `packages/game-engine/src/replay/replay.execute.ts` (**modified — comment only**)
- Extend the D-24322 header paragraph to name `resolveDeferredHeroGrants` (and the
  `onBegin` deferred-grant clear) among the `turn.onMove` / `onBegin` effects this
  determinism harness deliberately does not run, and note that the sim, PAR and
  fixture harnesses do mirror them (WP-744 / D-24567). No code change.

### F) Tests
- **`simulation/onBeginParity.test.ts` (modified):** new cases:
  1. With a `G.deferredConditionalGrants` entry and
     `villainOrMastermindDefeatedSinceResolve: true`, `applyOnBeginParity` leaves
     **both keys absent** (`!('key' in G)`, not merely falsy).
  2. On a `G` that never had either key, neither key is created (oracle safety).
- **`simulation/deferredGrantParity.test.ts` (new)** — a mock-registry round trip
  in the WP-732 `simulation.captureMoves.test.ts` style. The sim exposes no final `G`
  (`simulateOneGameAndCaptureMoves` returns `{ moves, outcome, endgameReached,
  hollowEffects, hollowEffectsDropped }`, a shape pinned by an existing field-set
  test), so the sim side is observed through the policy's `playerView.log` (the
  `G.messages` projection). No new export.
  - **Registry** (a variant of `buildWinnableRegistry`,
    `simulation.captureMoves.test.ts` ~L189):
    - Mastermind base card `vAttack: '0'` with **at least 3 Tactics**. Each Tactic
      fight is a defeat and sets the edge (`fightMastermind.ts` ~L256–264), so the
      fight is always legal without depending on villain-deck order.
    - One hero whose only card is cost 0, `recruit: null`, with the core Diamond
      Form text: `Whenever you defeat a Villain or Mastermind this turn, you get
      +3[icon:recruit]. [keyword:defeated-villain-or-mastermind]` (the
      `heroAbility.setup.ts` ~L1277 marker arm).
  - **Policy** — two-phase, deterministic, spy. It records `playerView.log` and its
    chosen move at every decision, and sets **no** `decisionLog`.
    - **Phase 1** (until a grant line is first observed): at most one `recruitHero`
      per turn, then `playCard` for each copy of the card in hand, then **at most
      one** `fightMastermind` per turn and only while a copy is in its own
      `inPlayCards`; then `advanceStage`, then `endTurn`.
    - **Phase 2** (every turn after the turn the grant appeared): never `playCard`
      the card; **one** `fightMastermind` per turn whenever legal; then
      `advanceStage`, then `endTurn`.
    - The Mastermind has ≥3 Tactics and Final Blow stays off, so both phases get a
      fight before the last Tactic. Hero cards start in the Hero Deck/HQ, so choose
      a seed where the card is played by about turn 3.
    - **Two loud preconditions**, either missing fails the test: (i) a play of the
      card was observed; (ii) a Phase-2 `fightMastermind` was dispatched while no
      copy was in `inPlayCards`.
  - **Matching rules (locked).** Compare `LogEntry.text` only.
    - Grant: `/gained \+3 recruit from/` (`heroEffects.execute.ts` ~L1421).
    - Waiting: `/ability is waiting/` (~L763).
    - Fight boundary: the sim decision index at which the policy chose
      `fightMastermind`.
  - **Assertions** (one round-trip test carries all three):
    - **(a) Deferred fire.** In Phase 1 the first grant line appears in the log
      observed after the `fightMastermind` decision, not after the `playCard`
      decision, where the waiting line appears instead.
    - **(b) Cross-turn clear, observed as behavior.** The Phase-2 fight (no copy in
      play) adds **no** grant line. A stale entry would re-fire, because the fight
      sets the edge whenever the list is non-empty.
    - **(c) Fixture parity.** The ordered subsequence of `runFixture` `messages`
      matching `/ability is waiting|gained \+3 recruit from/` equals the same filter
      over the sim's last observed `playerView.log`. Sim-only lines (`Simulation
      warning:`, decision logs) are excluded by construction. Hash equality between
      sim and fixture is not asserted (the sim exposes no final state).
  - Do **not** assert equality with `replayGame` (`replay.execute.ts` is excluded by
    design, Scope E).
- **PAR loop.** `par.aggregator.ts`'s loop is private and policy-fixed, and no
  committed PAR artifact exercises a wait-and-see card, so it is covered by the
  Verification grep (exactly one call, after `applyPileDepletionResourceLoss`) and by
  code review of its placement, which is textually identical to the sim loop's. No
  new export is added for test access.

---

## Out of Scope

- **Other live `onMove` effects the rebuilt loops do not mirror:**
  `latchFinalTurnIfDeckExhausted`, `checkAndTransformScheme`,
  `openDivingBlockSeatChoiceIfNeeded`, and (in `runFixture` only)
  `applyPileDepletionResourceLoss`. Each is a separate parity question with its own
  hash/feed consequences (the sentinel is Legacy Virus, a pile-depletion scheme).
  Recorded here as a follow-up candidate, not fixed.
- `replay/replay.execute.ts` behavior (Scope E is comment-only; D-24322 stands).
- `game.ts`, the resolver, the condition set, and any card data.
- Seed PAR (`data/par/seed/**`) and the competitive server gate.
- **Regenerating the stale PAR profiles** (`data/par/profile/v1/**`). They already
  drift on `main` independent of this WP (observed at draft, 12 of the first 16
  scenarios). That is a separate `INFRA:` re-pin in the #2251 style.
- WP-743's flags and conditions (it lands them itself; this WP's call covers them).
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — deferred-grant clear + edge-flag delete + JSDoc
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — per-move resolve
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — per-move resolve
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — per-move resolve
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** — header comment only
- `packages/game-engine/src/simulation/onBeginParity.test.ts` — **modified** — two cases
- `packages/game-engine/src/simulation/deferredGrantParity.test.ts` — **new** — round trip
- `docs/ai/coverage/runtime-observed-hollows.json` — **modified** — regenerated
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **modified** — paired `totalObs` re-pin

No other files may be modified in the `EC-781:` commit. The governance
close `SPEC:` commit edits DECISIONS (D-24567 Active), STATUS, WORK_INDEX, EC_INDEX
and the mindmap, plus the conditional WP-743 §Out of Scope amendment (§Context).

---

## Contract

- **Harness parity:** after every successfully dispatched move, the simulation
  runner, the PAR aggregator and the fixture runner call
  `resolveDeferredHeroGrants(G, moveContext)`, and at every turn start
  `applyOnBeginParity` drops `G.deferredConditionalGrants` and
  `G.villainOrMastermindDefeatedSinceResolve`. This matches `game.ts` `turn.onMove` /
  `turn.onBegin` for deferred grants.
- **Exclusion:** `replay.execute.ts` does not resolve or clear deferred grants
  (D-24322 reducer-determinism harness).
- **Hash oracles:** sentinel `finalStateHash` and `PRE_WP080_HASH` unchanged.
- No new type, field, export, or move.

---

## Vision Alignment

- **Vision clauses touched:** §1 (rules authenticity — the harnesses now apply the
  printed whole-turn condition as the live game does), §8 / §22 / §26 (deterministic
  engine; the sim and coverage feeds regenerate through sanctioned commands).
  NG-1 untouched.
- **Conflict assertion:** No conflict. The live game is unchanged; the observation
  harnesses stop diverging from it.
- **Non-Goal proximity:** NG-1..8 not crossed. No scoring or PAR artifact changes.
- **Determinism:** the resolver is ctx-free apart from the loop's existing seeded
  `Shuffle`, so every harness stays byte-reproducible run to run. Sim trajectories
  that play wait-and-see cards change, legitimately, because they now match live
  play. The committed PAR profiles (no such card in their pool) and competitive
  seed PAR are unchanged.
- **Upgrade / replay story:** no persisted shape changes. Committed fixtures replay
  byte-identically (the sentinel plays no wait-and-see card). A future fixture
  recorded with such a card now bakes the live-faithful state.

## Funding Surface Gate

N/A — engine observation harnesses and derived diagnostics only; no UI, copy, or funding affordance.

## API Catalog

N/A (§21). No `apps/server` endpoint or `Library-only` server function changes.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] In a sim game, a wait-and-see card played before its condition is met grants
  when the condition turns true later that turn, and a later turn without a re-play
  grants nothing (the new round-trip test).
- [ ] No `deferredConditionalGrants` entry and no `villainOrMastermindDefeatedSinceResolve`
  survives a turn boundary in any of the three loops (`applyOnBeginParity` cases).
- [ ] Sim-captured moves replayed through `runFixture` produce the same grant lines in
  the same order relative to the fight lines.
- [ ] Each of `simulation.runner.ts`, `par.aggregator.ts`, `runFixture.ts` contains
  exactly one `resolveDeferredHeroGrants(` call; `game.ts` is not in the diff.
- [ ] Sentinel `finalStateHash` and `PRE_WP080_HASH` byte-unchanged (no re-pin).
- [ ] `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` exit 0 after the
  sanctioned regen; the dashboard suite is green with the re-pinned `totalObs`, and
  `pnpm --filter @legendary-arena/dashboard typecheck` exits 0.
- [ ] `data/par/**` is not in the `EC-781:` diff.
- [ ] `pnpm -r build` exits 0; engine suite green at baseline + new cases, counts in
  the commit body.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0; deferredGrantParity.test.ts + onBeginParity.test.ts pass; no sentinel / PRE_WP080 failure

Select-String -Path packages\game-engine\src\simulation\simulation.runner.ts,packages\game-engine\src\simulation\par.aggregator.ts,packages\game-engine\src\test\fixtures\runFixture.ts -Pattern "resolveDeferredHeroGrants\(" | Where-Object { $_.Line -notmatch "^\s*(//|\*|import)" }
# Expected: exactly 3 matches, one per file

pnpm sim:runtime-observed; pnpm sim:runtime-observed:check; pnpm sim:coverage --check
# Expected: sim:runtime-observed:check and sim:coverage --check exit 0

pnpm --filter @legendary-arena/dashboard prebuild:coverage; pnpm --filter @legendary-arena/dashboard test; pnpm --filter @legendary-arena/dashboard typecheck
# Expected: all exit 0 after the totalObs re-pin

git diff --name-only
# Expected (implementation commit): within ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` are modified in the `EC-781:`
  commit.
- [ ] Live verification (D-24026): N/A (`none — infrastructure`). The `docs/ai/STATUS.md`
  entry states "No user-observable change — infrastructure only" and names the
  runtime-observed / dashboard `totalObs` delta as the only derived shift.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md`: D-24567 landed Active.
- [ ] `WORK_INDEX.md` WP-744 is `[x]`, and `EC_INDEX.md` EC-781 is Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`;
  `roadmap:counts:check` exits 0.

---

## Reserved Decision (lands at execution)

- **D-24567 (reserved; Drafted 2026-09-22): the observation harnesses mirror the
  live deferred-grant lifecycle.**
  - The simulation runner, the PAR aggregator and the fixture runner call
    `resolveDeferredHeroGrants` after every dispatched move (after
    `applyPileDepletionResourceLoss` where that mirror exists), and the shared
    `applyOnBeginParity` drops `deferredConditionalGrants` and the WP-656 defeat edge
    at every turn start — the `game.ts` `turn.onMove` / `turn.onBegin` behavior for
    D-24377 / D-24467 grants.
  - `replay.execute.ts` stays excluded under D-24322 (reducer-determinism harness; it
    runs no `onMove` effect).
  - The other unmirrored `onMove` effects (final-turn latch, scheme transform,
    Diving-Block seat choice, and pile depletion in `runFixture`) remain open parity
    questions, not decided here.

---

## Lint Gate Self-Review (00.3)

Both rounds were run by an independent reviewer.

**Round 1: FAIL on §15 / §15.1**, fixed in this revision: the header surface now
uses the template value `none — infrastructure`, a `## User-Visible Impact` section
was added, and the DoD requires the D-24026 STATUS phrase. Also applied: a
"code to read first" list in §Context (§4 nit) and the dashboard `typecheck` gate
in Verification Steps + the EC (EC-template rule for an `apps/dashboard` edit).

**Round 2: all 21 sections PASS or N/A.** §10, §11 N/A (no env vars, no auth); §19
N/A (commit-time rule; baseline matches HEAD `a4cfd995`); §20, §21 N/A with named
reasons. The reviewer's three optional wording polishes (DoD N/A phrasing, AC typecheck
clause, Verification comment) were applied after round 2; no semantic change.

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-22)**, after PS-1 and PS-2 were applied (independent
reviewer; both were Scope F test-design fixes, no production-scope change, so no
re-run was required).

- **PS-1 (applied):** the sim exposes no final `G` (`simulateOneGameAndCaptureMoves`'
  return shape is pinned), so Scope F now observes the sim through a spy policy's
  `playerView.log` and compares grant lines (not hashes) with `runFixture`.
- **PS-2 (applied):** the fight target is a 0-cost Mastermind with ≥3 Tactics (a
  villain's City arrival depends on shuffle order), the hero must be recruited and
  reshuffled into hand, and the test asserts a loud played-the-card precondition.
- **RS applied:** events-inert `// why:` note + failure smell (RS-1); WP-732 added
  to the WORK_INDEX hard-deps (RS-2); commit body must explain the runtime-observed
  delta (RS-3); test-count accounting (RS-4); Impossible Trick Shot named (RS-6).
  RS-5 (fold the test into `simulation.captureMoves.test.ts`) declined:
  duplicate-first, separate file.
- **Verified in code:** only three loops dispatch outside boardgame.io
  (`replay.execute.ts` excluded by design); every other harness (engine-runner,
  sweep, runtime-observed, record-game-fixture, coop-winrate, PAR profiles) runs
  through one of them. Placement matches bgio order (move → `onMove` → `onEnd` →
  next `onBegin`). No test compares `replayGame` against the sim or `runFixture` by
  hash. Dependencies all `[x]`.

## Copilot Check (01.7)

**Round 1: RISK / HOLD** on modes #11, #12, #22, #26, #30 — all in the Scope F test
design, plus the WP-743 text interaction. Fixes applied:
- **#11 / #22 / #30:** a two-phase policy (Phase 1 one fight per turn while the card
  is in play; Phase 2 never plays it) so assertion (b) actually occurs and the game
  cannot end in the first positive turn; two loud preconditions.
- **#26:** locked matching rules (`LogEntry.text`, the grant and waiting patterns,
  the fight decision index, the filtered subsequence for (c)).
- **#12:** the conditional WP-743 §Out of Scope amendment in this WP's close.

**Round 2: PASS on all 30 modes.** Pre-flight READY stands (no production-scope
change).

---

## See Also

- WP-743 §Out of Scope ("Pre-existing sim gap") — where this was found
- WP-568 / D-24377, WP-656 / D-24467 — the live mechanics
- WP-266 — `applyOnBeginParity`; WP-732 / D-24553 — the four-loop parity precedent
- #2251 — the last PAR profile re-pin (the profiles are stale again on `main`, unrelated)
