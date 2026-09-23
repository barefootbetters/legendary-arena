# WP-749 — Sim / PAR loops resolve a seat choice addressed to a non-active seat (Engine — simulation)

**Status:** Draft 2026-09-22 (EC-786; D-24573 reserved) — READY TO EXECUTE (pre-flight READY, copilot PASS r3, lint PASS)
**Primary Layer:** Game Engine — observation harnesses (`packages/game-engine/src/simulation/**`, `packages/game-engine/src/test/fixtures/runFixture.ts`)
**Dependencies:** WP-684 / D-24501 (non-active / multi-seat pending choice) ✅, WP-694 / D-24511 (Vanishing Illusions + Monarch's Decree seat-choice tactics) ✅, WP-744 / D-24567 (loop `onMove` deferred-grant parity) ✅, WP-732 / D-24553 ✅
**User-Visible Surface:** none — infrastructure (observation-harness parity; the regenerated diagnostic PAR profiles shift the operator dashboard's PAR-fidelity view — no new UI, no player-facing change)
**Baseline:** `origin/main` @ `fbd5981e`

---

## Goal

Let the simulation and PAR turn loops finish a turn in which a card or tactic asks
**another** player to choose. Today, when Loki's **Vanishing Illusions** ("each other
player must KO a Villain from their Victory Pile") or any other WP-684 seat choice is
addressed to a non-active seat, the loops only ever consult the current player. That
player is correctly blocked, so the bot falls back to `endTurn` outside cleanup and the
game is recorded as **stuck**. After this WP the loops resolve the choice for the
addressed seat with its deterministic default, exactly as `getLegalMoves` already
offers it, and the game plays on.

---

## User-Visible Impact

None on play.legendary-arena.com; the live game routes a seat choice to the addressed
seat through boardgame.io. Payoff: the diagnostic PAR profiles stop recording most Loki
games as stuck (observed at draft: negative-zone / Loki / brotherhood+enemies-of-asgard
9 / 1 / 190 → 199 / 1 / 0 win / loss / stuck), so the operator's PAR-fidelity view
reflects difficulty rather than a harness gap.

---

## Assumes

All verified at baseline `fbd5981e`.

- **The seat-choice model** (`moves/seatChoice.resolve.ts`, WP-684 / D-24501):
  `G.pendingSeatChoice` holds one open choice with `addressedSeats`, per-seat
  `seatPrompts`, `submissions` and `defaultOptionIndex`. `getOutstandingSeats(choice)`
  (exported, ~L129) returns the addressed seats that have not submitted, in
  `addressedSeats` order. `resolveSeatChoice` validates that the submitting `playerID`
  is addressed and outstanding, records it, and applies atomically once every addressed
  seat has submitted. `parkSeatChoice`'s stage ride is `typeof`-guarded, so it is a no-op
  in the loops.
- **`getLegalMoves` already answers for any seat** (`simulation/ai.legalMoves.ts`
  ~L300–316): while a seat choice is open, for the enumerated seat
  (`context.currentPlayer`) that is addressed and outstanding it returns **exactly**
  `[{ name: 'resolveSeatChoice', args: { optionIndex: choice.defaultOptionIndex } }]`
  (the disconnect/timeout default); for every other seat it returns an empty list.
- **Both loops can already dispatch it.** `resolveSeatChoice` is a key in the
  `MOVE_MAP` of `simulation/simulation.runner.ts` (~L331) and
  `simulation/par.aggregator.ts`, pinned by `simulation.moveDispatch.drift.test.ts`.
- **Neither loop ever acts as a non-active seat.** `runPerTurnLoop`
  (`simulation.runner.ts`) and the PAR `simulateOneGame` (`par.aggregator.ts`) build the
  lifecycle context with `currentPlayer`, ask only the current player's policy, and
  dispatch with `playerID: currentPlayer`. With a choice addressed only to another seat,
  the current player's legal list is empty, the policy falls back to `endTurn`, and the
  loop's "endTurn outside cleanup" guard flags the game stuck.
- **`runFixture` cannot replay the move.** Its `MOVE_MAP`
  (`test/fixtures/runFixture.ts`) has no `resolveSeatChoice` entry and throws on an
  unknown move name. It dispatches every move with `move.playerId` as `playerID`, so a
  captured non-active-seat move replays correctly once the entry exists.
- **Seat choices that reach a non-active seat under the loops' default-only
  resolution:** Vanishing Illusions (`vanishing-illusions-ko`, tactic id
  `core-mastermind-loki-vanishing-illusions`, addressed to every other seat holding a
  qualifying Villain) and Random Acts pass-left (`random-acts-pass-left`, addressed to
  the active seat **and** others; the active seat resolves first via the existing
  path). Here, Hold This and Monarch's Decree mode are addressed to the active seat
  only. The Monarch's Decree discard chain is unreachable in the loops (the mode's
  default is draw, and `getLegalMoves` only offers the default). Diving Block's wave is
  never opened in the loops (the live `turn.onMove` hook
  `openDivingBlockSeatChoiceIfNeeded` is not mirrored — Out of Scope).
- **Why the runtime-observed feed cannot move:** its sweep runs only `core/dr-doom`
  (`scripts/runtime-observed-hollows.mjs` ~L131), whose Monarch's Decree mode is
  active-only with a draw default, so the new branch never fires there. The dashboard's
  PAR-fidelity JSON is built at dashboard build time (not committed) and no test reads
  `data/par/**`.
- **Sentinel fixture.** `sentinel-core-doom-2p`'s recorded move list contains no
  `resolveSeatChoice` move, so adding the `runFixture` entry cannot change its replay.
- **Draft scaffold (observed 2026-09-22, on `3b879f71` + WP-744).** The Scope A–C edits
  were prototyped on a throwaway branch:
  - `pnpm -r build` exit 0. Engine suite **4124 / 4124 pass** (942 suites); sentinel
    `finalStateHash` and `PRE_WP080_HASH` unchanged.
  - `pnpm sim:runtime-observed:check`: **OK (no drift)**. `pnpm sim:coverage --check`:
    exit 0. So the dashboard `useInPlayCoverage` pin does not move.
  - PAR, three scenarios at `--sample 200` (win / loss / stuck, committed → scaffold):
    - negative-zone / Loki / brotherhood+enemies-of-asgard: 9 / 1 / 190 → **199 / 1 / 0**
    - midtown / Loki / brotherhood+enemies-of-asgard: 6 / 3 / 191 → **194 / 3 / 3**
    - legacy-virus / Dr Doom / masters-of-evil (control): 160 / 40 / 0 → 160 / 40 / 0
  - No other committed artifact is sim-derived (`coop-winrate` writes to stdout only;
    `sweep-output/` is untracked).

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- **Found by** the #2297 PAR re-pin (2026-09-22): a bisect of the Loki stuck spike put
  it on WP-732, and every stuck game in the bisected scenario had an open
  `vanishing-illusions-ko` seat choice addressed to the other seat. Before WP-732 a
  final-tactic Vanishing Illusions ended the game immediately, hiding it; the 136
  non-final-tactic stuck games predate WP-732.
- **Why the default, not the policy.** `getLegalMoves` returns exactly one move for an
  outstanding addressed seat — the `defaultOptionIndex` the live disconnect/timeout
  path applies, chosen so an all-bot resolution is replay-identical (its own comment).
  Dispatching that move directly adds no policy call, consumes no policy randomness,
  and pushes no decision log, so games that never open a seat choice are
  byte-identical. A smarter bot choice for another seat's prompt is a separate
  policy question.
- **Why before the active seat's step.** The live framework blocks the active seat
  until every addressed seat submits, so the outstanding seats act first. If the
  current player is itself outstanding, the existing path already works (its legal
  list is that same single move), so the new branch runs only when the current player
  is **not** outstanding.
- **Why the per-move hooks run after it.** `game.ts` `turn.onMove` fires after every
  move, including a non-active seat's. The branch therefore runs the same two
  post-move mirrors the loops run for any move (`applyPileDepletionResourceLoss`, then
  `resolveDeferredHeroGrants`, WP-744).
- **Why duplicated, not a helper.** The sim and PAR loops are deliberate duplicates
  (RS-10; `simulation.moveDispatch.drift.test.ts` pins both maps). This follows that
  precedent: the same block in each loop, pinned by the new test.
- **`replay.execute.ts` stays out of scope.** It is the D-0205 reducer-determinism
  harness with a core-moves-only map; no pipeline feeds it a sim trace and compares.
- **Execution-order note.** Independent of WP-743 / WP-745 / WP-747 / WP-748 (none
  touches these loops' move-selection step). Any concurrent PAR re-pin must be
  regenerated, never hand-merged.
- **Lane.** Two-session lane: PAR surfaces are excluded from the lightweight lane
  (01.0a eligibility #6).
- DECISIONS: D-24501, D-24511, D-24567, D-24553, D-24273, D-0205, D-24406.
- Code to read first: `moves/seatChoice.resolve.ts` (L1–320); `simulation/ai.legalMoves.ts`
  seat-choice short-circuit; `simulation/simulation.runner.ts` `runPerTurnLoop`;
  `simulation/par.aggregator.ts` `simulateOneGame`; `test/fixtures/runFixture.ts`
  `MOVE_MAP` + `dispatchSingleMove`; `rules/tacticHandlers.ts` Vanishing Illusions;
  `simulation/simulation.captureMoves.test.ts` (the round-trip pattern);
  `simulation/deferredGrantParity.test.ts` (WP-744's spy-policy pattern).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words,
  `is`/`has`/`can` booleans, JSDoc on every function, `// why:` on non-obvious
  choices, no `.reduce()` with branching.
- Determinism: no `Math.random()` or wall-clock. The branch consumes no randomness of
  its own; the dispatched move receives the loop's existing seeded `Shuffle`.
- Error messages are full sentences.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and ask.

**Packet-specific:**
- **No live-path change.** No edit under `game.ts`, `moves/**`, `rules/**`, `hero/**`,
  `setup/**`, or `simulation/ai.legalMoves.ts`. The engine and `getLegalMoves` are
  already correct.
- **The acting seat's move is `getLegalMoves`' own answer.** Dispatch its single
  `resolveSeatChoice` result unchanged; never synthesize an `optionIndex`, never call a
  policy for the non-active seat.
- **Fail loud, never spin.** If the acting seat's legal list is not exactly one
  `resolveSeatChoice`, log a full-sentence warning and flag the game stuck (the loops'
  existing stuck mechanism). No new cap, no retry.
- **Hash oracles byte-unchanged.** The sentinel `finalStateHash` and `PRE_WP080_HASH`
  must not move (the scaffold observed both unchanged). A moved oracle is a bug, never
  a re-pin.
- **Derived artifacts regenerate through their sanctioned commands only.**
- **Drift pins are runtime assertions** (D-24372). Never `any`, `@ts-ignore`, or a
  widened production type.

---

## Scope (In)

### A) `simulation/simulation.runner.ts` — `runPerTurnLoop` (**modified**)
Immediately after the `evaluateEndgame` check and before the active seat's
lifecycle-context / legal-move / policy step:
- When `gameState.pendingSeatChoice` is defined, take
  `outstandingSeats = getOutstandingSeats(choice)`. When it is non-empty **and** does
  not include `currentPlayer`, the acting seat is `outstandingSeats[0]`.
- Ask `getLegalMoves(gameState, { phase: 'play', turn, currentPlayer: actingSeat, numPlayers })`.
  If the result is not exactly one move named `resolveSeatChoice`, push
  `Simulation warning: seat <seat> owes a seat choice but has no single resolveSeatChoice move — flagging game <gameIndex> as stuck.`,
  set `turnsElapsed = maxTurns`, and break.
- Otherwise build the move context for `actingSeat` with the loop's `buildMoveContext`
  (a fresh `{ triggered: false }` end-turn flag), dispatch
  `MOVE_MAP.resolveSeatChoice(context, move.args)`, report it to `onMoveDispatched` with
  `playerId: actingSeat` (the capture contract, D-24273), then run
  `applyPileDepletionResourceLoss(gameState)` and
  `resolveDeferredHeroGrants(gameState, context)`, and `continue` the loop.
- The iteration counts against the existing per-turn move-step budget
  (`MAX_MOVE_STEPS_PER_TURN`).
- Import `getOutstandingSeats` from `../moves/seatChoice.resolve.js` (alongside the
  existing `resolveSeatChoice` import).
- `// why:` citing WP-749 / D-24573, WP-684 / D-24501, the deterministic default, and
  the live `onMove` order.

### B) `simulation/par.aggregator.ts` — `simulateOneGame` (**modified**)
The same block at the same position, with the loop's own names:
`PAR aggregator warning:` prefix (no game index), `turnsElapsed = MAX_TURNS_PER_GAME`
on the stuck path, `movesDispatched += 1` after the dispatch (so the iteration counts
against the per-game `MAX_MOVES_PER_GAME`), and no capture callback.

### C) `test/fixtures/runFixture.ts` (**modified**)
- Add `resolveSeatChoice` to `MOVE_MAP` (`(context, args) => resolveSeatChoice(context as never, args as never)`),
  with a `// why:` naming the sim capture → fixture replay lockstep (D-24273) and that
  `dispatchSingleMove` already passes `move.playerId` as `playerID`.
- Import `resolveSeatChoice` from `../../moves/seatChoice.resolve.js`.

### D) Derived artifacts (**modified**; regenerated)
- **Certain:** `data/par/profile/v1/**` (the 128 diagnostic profiles +
  `fidelity-report.{json,md}`) via
  `pnpm -r build; node scripts/generate-par-profiles.mjs --version v1 --sample 200`.
  - **Attribution rule:** first run the command on the untouched execution baseline. If
    that already drifts from the committed files, land that drift as its own `INFRA:`
    re-pin first (the #2297 precedent), then rebase and regenerate here.
  - A second run of any subset (`--limit N`) must be byte-identical; restore the full
    `fidelity-report.{json,md}` afterwards (a `--limit` run rewrites it).
- **Checked, expected unchanged:** `docs/ai/coverage/runtime-observed-hollows.json`
  (`sim:runtime-observed:check` OK at draft), so
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` is **not** touched;
  `scripts/coverage/hero-effect-coverage.baseline.json` (`sim:coverage --check`).
  If either `:check` drifts at execution, STOP and report (it was not observed at
  draft and would mean the change reaches the sweep).
- **Unaffected by construction:** `data/par/seed/**` (ratings-derived).

### E) Tests
- **`simulation/seatChoiceDispatch.test.ts` (new)** — a mock-registry round trip in
  the `simulation.captureMoves.test.ts` / `deferredGrantParity.test.ts` style, two
  seats:
  - **Harness:** `node:test` + `node:assert` only; no `boardgame.io` import.
  - **Registry** (locked recipe): a local copy of `simulation.captureMoves.test.ts`'s
    (non-exported) `buildWinnableRegistry`, modified so its mastermind
    is `loki` in set `core` with a 0-cost base card and a **single** `vanishing-illusions`
    Tactic (tactic id `core-mastermind-loki-vanishing-illusions`, `rules/tacticHandlers.ts`
    ~L196). One Tactic removes tactic-order dependence; villain-reveal order remains
    seed-dependent, so the test locks a literal seed string (recorded in the file), a
    single Villain group of ≥ 8 `vAttack: '0'` copies (only `-villain-` ids qualify for
    the KO, `moves/seatChoiceTactics.ts` ~L77), and one henchman group at `vAttack: '9'`
    so henchmen are never the fight target. `bystandersCount: 4` (the `captureMoves` /
    `deferredGrantParity` precedent; the sim path calls `buildInitialGameState` directly
    and never runs the D-24032 supply-floor validator). `bystandersCount` sizes only the
    supply pile; villain-deck bystanders come from the scheme / player-count table /
    `numPlayers` (`villainDeck.setup.ts` ~L288–298), so it is not a reveal-order lever. Loki's Master
    Strike may wound seats — harmless.
  - **Policies** (strict priority lists over the offered legal moves): seat 1 —
    `revealVillainCard` → first `fightVillain` (sets a shared flag) → `advanceStage` →
    `endTurn`; seat 0 — `revealVillainCard` → `fightMastermind` iff the flag is set →
    `advanceStage` → `endTurn`.
  - **Loud precondition:** the policy-observed log contains
    `Fight effect: each other player must KO a Villain from their Victory Pile (Vanishing Illusions).`
    and does **not** contain `no other player had a Villain in their Victory Pile to KO`.
  - **Assertions (locked):**
    - **(a)** The captured move list contains a `resolveSeatChoice` whose `playerId` is
      `'1'`, positioned after seat 0's `fightMastermind` and before seat 0's next
      `endTurn`.
    - **(b)** `captured.endgameReached === true` and `captured.outcome.winner ===
      'heroes-win'`, and the policy-observed log contains a line matching
      `/KO'd .+ from their Victory Pile \(Vanishing Illusions\)\./` after the fight.
      (The endTurn-outside-cleanup warning is pushed just before `break`, so no policy
      ever observes it; the terminal outcome is the falsifiable signal.)
    - **(c)** `runFixture` on the captured moves replays without throwing and its
      `messages` contain the same Vanishing Illusions KO line.
  - **Fallback** (only if the recipe above cannot be made deterministic): a Random Acts
    pass-left (a mock hero card carrying the `random-acts` marker, both seats holding
    cards), with assertion (a) applying to seat 1's resolve. Record the choice in the
    commit body.
  - **Counts:** +1 test, +1 suite (one `describe`).
- **`simulation.moveDispatch.drift.test.ts`:** unchanged (both maps already carry
  `resolveSeatChoice`).
- **Engine suite:** baseline + the new file's cases; sentinel and `PRE_WP080_HASH`
  pass unchanged.

---

## Out of Scope

- **Mirroring `openDivingBlockSeatChoiceIfNeeded`** (the live `onMove` hook that opens
  Diving Block's seat choice) and the other unmirrored `onMove` effects
  (`latchFinalTurnIfDeckExhausted`, `checkAndTransformScheme`, and pile depletion in
  `runFixture`). Each moves hashes or feeds on its own; Diving Block is Captain
  America's card and the sentinel plays Captain America. Separate follow-ups.
- A smarter bot choice for a non-active seat's prompt (the default is used).
- `replay.execute.ts` (D-0205 core-moves-only determinism harness).
- Any engine, `getLegalMoves`, UI, or server change.
- Seed PAR (`data/par/seed/**`) and the competitive server gate.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — non-active seat-choice branch
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — the same branch
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — `resolveSeatChoice` map entry (import beside the other move imports; the stale non-core-entry count comment ~L163 may be corrected in the same file — re-count the entries, don't increment)
- `packages/game-engine/src/simulation/seatChoiceDispatch.test.ts` — **new** — round trip
- `data/par/profile/v1/**` — **modified** — regenerated diagnostic profiles + fidelity report

No other files may be modified in the `EC-786:` commit. A baseline-drift PAR re-pin
(Scope D attribution rule) is a separate earlier `INFRA:` PR. The governance close
`SPEC:` commit edits DECISIONS (D-24573 Active), STATUS, WORK_INDEX, EC_INDEX and the
mindmap.

---

## Contract

- **Harness behavior:** when `G.pendingSeatChoice` is open and the current player is
  not an outstanding addressed seat, the simulation runner and the PAR aggregator
  dispatch, for the first outstanding addressed seat, the single `resolveSeatChoice`
  move `getLegalMoves` returns for that seat, then run their per-move `onMove` mirrors.
  A seat with no such single move ends the game as stuck with a warning.
- **Capture:** such a move is captured with that seat's `playerId`, and `runFixture`
  replays it.
- **Hash oracles:** sentinel `finalStateHash` and `PRE_WP080_HASH` unchanged.
- No new type, field, export, or move.

---

## Vision Alignment

- **Vision clauses touched:** §1 (rules authenticity — the harness lets the other
  player make the printed choice instead of freezing), §8 / §22 / §26 (deterministic
  engine; the diagnostic PAR feed regenerates through its sanctioned command).
  NG-1 untouched.
- **Conflict assertion:** No conflict. The live game is unchanged; the harness stops
  mis-recording finished games as stuck.
- **Non-Goal proximity:** NG-1..8 not crossed. The PAR profiles are
  `authoritative: false`; competitive seed PAR is untouched.
- **Determinism:** the branch reads `G` and calls `getLegalMoves`, both pure; it
  consumes no randomness. Games that never open a non-active seat choice are
  byte-identical (the scaffold's control scenario and the unchanged runtime-observed
  feed confirm it).
- **Upgrade / replay story:** no persisted shape changes; committed fixtures replay
  byte-identically (none contains a `resolveSeatChoice` move).

## Funding Surface Gate

N/A — engine observation harnesses and derived diagnostics only; no UI, copy, or funding affordance.

## API Catalog

N/A (§21). No `apps/server` endpoint or `Library-only` server function changes.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] A sim game in which a seat choice is addressed to a non-active seat resolves it
  and continues; the captured moves include that seat's `resolveSeatChoice` (new test,
  assertion a).
- [ ] That game terminates heroes-win and logs the Vanishing Illusions KO after the fight (assertion b).
- [ ] `runFixture` replays the captured moves, including the non-active seat's move,
  and reproduces the resolution line (assertion c).
- [ ] Sentinel `finalStateHash` and `PRE_WP080_HASH` byte-unchanged (no re-pin).
- [ ] `sim:runtime-observed:check` and `sim:coverage --check` exit 0 with no
  regeneration; `useInPlayCoverage.test.ts` is not in the diff.
- [ ] `data/par/profile/v1/**` regenerated: the negative-zone / Loki /
  brotherhood+enemies-of-asgard profile's `stuckAtCapCount` falls from 190 to ≤ 10, and
  the legacy-virus / Dr Doom / masters-of-evil control profile is byte-unchanged; a
  second `--limit` run is byte-identical; win + loss + stuck totals 25600.
- [ ] `pnpm -r build` exits 0; engine suite green at baseline + new cases, counts in
  the commit body.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0; seatChoiceDispatch.test.ts passes; no sentinel / PRE_WP080 failure

pnpm sim:runtime-observed:check && pnpm sim:coverage --check
# Expected: both exit 0 with no regeneration

node scripts/generate-par-profiles.mjs --version v1 --sample 200
git diff --exit-code -- data/par/profile/v1/legacy-virus-the--dr-doom--masters-of-evil.json
# Expected: exit 0 (control scenario unchanged)
node -e "const p=require('./data/par/profile/v1/negative-zone-prison-breakout--loki--brotherhood_enemies-of-asgard.json'); console.log(p.winCount, p.lossCount, p.stuckAtCapCount)"
# Expected: stuckAtCapCount <= 10
node -e "const fs=require('fs');let t=0;for(const f of fs.readdirSync('data/par/profile/v1')){if(!f.startsWith('fidelity-report')&&f.endsWith('.json')){const p=require('./data/par/profile/v1/'+f);t+=p.winCount+p.lossCount+p.stuckAtCapCount}}console.log(t)"
# Expected: 25600
git add data/par/profile/v1
node scripts/generate-par-profiles.mjs --version v1 --sample 200 --limit 4
git diff --exit-code -- data/par/profile/v1 ':!data/par/profile/v1/fidelity-report.*'
git restore --worktree -- data/par/profile/v1/fidelity-report.json data/par/profile/v1/fidelity-report.md
git diff --exit-code -- data/par/profile/v1
# Expected: exit 0 (the --limit re-run is byte-identical; the full fidelity report is restored from the index)

git diff --name-only
# Expected (implementation commit): within ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` are modified in the `EC-786:`
  commit.
- [ ] Live verification (D-24026): N/A (`none — infrastructure`). The
  `docs/ai/STATUS.md` entry states "No user-observable change — infrastructure only"
  and names the PAR-profile regeneration (Loki stuck → finished) as the only derived
  shift.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md`: D-24573 landed Active.
- [ ] `WORK_INDEX.md` WP-749 is `[x]`, and `EC_INDEX.md` EC-786 is Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`;
  `roadmap:counts:check` exits 0.

---

## Reserved Decision (lands at execution)

- **D-24573 (reserved; Drafted 2026-09-22): the observation harnesses resolve a
  non-active seat choice with its deterministic default.**
  - When a WP-684 seat choice is open and the current player is not an outstanding
    addressed seat, the simulation runner and the PAR aggregator dispatch, for the first
    outstanding addressed seat, the single `resolveSeatChoice` that `getLegalMoves`
    returns for it (`defaultOptionIndex`, the disconnect/timeout default), then run the
    per-move `onMove` mirrors. No policy is consulted for that seat.
  - `runFixture` replays such moves; `replay.execute.ts` stays core-moves-only (D-0205).
  - Opening Diving Block's wave (`openDivingBlockSeatChoiceIfNeeded`) in the loops
    remains an open parity question.

---

## Lint Gate Self-Review (00.3)

Run by an independent reviewer. **Round 1: all 21 sections PASS or N/A** — §10, §11 N/A
(no env vars, no auth); §18 N/A (no literal-token grep step); §19 N/A (commit-time
rule; baseline `fbd5981e`); §20, §21 N/A with named reasons. The reviewer's optional
polish was applied (separate STATUS DoD item, non-exported `buildWinnableRegistry`
noted, test-harness import constraint, fail-fast `&&` in Verification, re-count the
`runFixture` comment); no semantic change.

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-22)** after PS-1 and PS-2 (independent reviewer; text-only,
no re-run required).

- **PS-1 (applied):** Here, Hold This and Monarch's Decree mode are active-only, and
  the Monarch's discard chain is unreachable under default-only resolution; Assumes
  now names only Vanishing Illusions and Random Acts pass-left, and the test fallback
  is Random Acts pass-left.
- **PS-2 (applied):** the endTurn-outside-cleanup warning is pushed just before
  `break`, so no policy observes it; assertion (b) is now the terminal `heroes-win`
  outcome plus the Vanishing Illusions KO line, with a real precondition.
- **RS applied:** locked test recipe (single-Tactic Loki, `vAttack '0'` villains,
  `vAttack '9'` henchmen, flag-sequenced policies; +1 test / +1 suite) (RS-1); why
  runtime-observed cannot move (RS-2); the unclamped-default note (RS-3); residual
  Loki stuck games explained in the commit body (RS-4); runFixture import placement +
  stale count comment (RS-5).
- **Verified in code:** the trigger is correct for every seat-choice kind (Monarch's
  mode stays on the active path; Random Acts' active seat resolves first); chains still
  park on `G` without `setActivePlayers`; the `ctx.playOrder` fallback equals
  boardgame.io's default order; `runFixture` never validates `move.playerId`; the branch
  counts against the step budgets; no committed fixture contains `resolveSeatChoice`;
  PR #2206 does not conflict; dependencies all `[x]`.

## Copilot Check (01.7)

**Round 1: RISK / HOLD** on modes #11, #12, #22, #26 (#30 withdrawn — lint is the next
gate). Fixes applied: a locked seed + ≥ 8 `vAttack '0'` villain copies + strict-priority
policies + an ordering clause on assertion (a) (#11); Verification commands for the
control `--exit-code`, the 25600 total, the `--limit` re-run and the fidelity-report
restore (#12); the stuck-path backstop named per loop (`MAX_MOVE_STEPS_PER_TURN` /
`MAX_MOVES_PER_GAME`) (#22); a runnable residual-stuck check (#26).

**Round 2: RISK on #26** — the `bystandersCount` clause pointed at a supply-pile knob,
not a reveal-order lever; replaced with `bystandersCount: 4` and the reason.

**Round 3: PASS on all 30 modes.** Pre-flight READY stands (no scope change).

---

## See Also

- #2297 — the PAR re-pin whose bisect found this
- WP-684 / D-24501 — the seat-choice capability; WP-694 / D-24511 — Vanishing Illusions
- WP-744 / D-24567 — the loops' `onMove` parity this branch reuses
