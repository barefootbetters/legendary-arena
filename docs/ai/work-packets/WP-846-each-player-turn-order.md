# WP-846 — Each-Player Effects Start With the Current Player and Go Clockwise (Game Engine)

**Status:** Draft — pending execution
**Primary Layer:** Game Engine
**User-Visible Surface:** play.legendary-arena.com

---

## Goal

Rules v23 L2247: *"If an effect causes 'each player' to gain a Wound (or do anything
else), start with the current player then go clockwise."* The engine instead walks
every each-player effect in ascending seat id (`Object.keys(G.playerZones).sort()`),
which matches the rule only on seat 0's turn. After this WP the each-player loops whose
order changes an outcome or a prompt order start with the current player and go
clockwise (ascending seat id, wrapping): who gets the last Wound when the stack runs
short, which seat Flying Shield Block asks about first (each copy works once per turn,
D-24760), and the order return-on-discard reactions are offered. (The Diving Block queue
order also follows, but a Diving Block wave addresses every seat at once, so that is
cosmetic.)

## User-Visible Impact

In a multiplayer match on seat 2's turn, a "each player gains a Wound" with one Wound
left now wounds seat 2, not seat 0, and the log names players starting with seat 2.
Serial reaction prompts that one each-player effect raises (Flying Shield Block,
return-on-discard) come in the same current-player-first order. On seat 0's turn, and in every solo game,
nothing changes.

## Assumes

- **Baseline:** `origin/main` @ `1297317d`
  (2026-10-26). Re-baseline at execution.
- **Seat ids and turn order.** `playerZones` keys are `'0'..'n-1'`
  (`setup/buildInitialGameState.ts` ~L331), `maxPlayers` 5 (`game.ts` ~L364); integer-like
  keys enumerate ascending, so the four unsorted `Object.keys` loops already run sorted.
  Turn order is `next = (playOrderPos + 1) % playOrder.length` (`game.ts` ~L844) and
  nothing sets a custom `ctx.playOrder` (grep of `packages/` and `apps/server`), so
  "clockwise from the current player" = the sorted seat ids rotated to start at the
  current player. G + the current player id is enough; no `playOrder` read is needed.
- **The inventory** (draft-time, 2026-10-26, file-by-file; re-run at execution — line
  numbers drift): of ~70 `Object.keys(G.playerZones)` sites, 22 are in scope (§Scope
  table). Excluded classes and why are in Design Rationale. Full notes:
  `each-player-loop-inventory.md` in the session's shared notes folder (not in the repo);
  the tables below carry everything an executor needs.
- **Current-player access per family:** hero handlers get `playerID` (the active
  player); villain effects and tactics get `currentPlayer`; the Master Strike dispatcher
  `mastermindStrikeHandler` has the reveal context and `resolveCurrentPlayer(context)`
  (`rules/mastermindHandlers.ts` ~L230, `null` for stub contexts), but six of the
  in-scope strike functions take only `gameState` today; scheme-twist resolvers receive
  the reveal context as an unused `_context`; `resolveCoveringFireChoice` has `playerID`
  (= the active chooser).
- **Determinism surfaces (measured at draft by reading the oracles):**
  `hashGameState` (`test/fixtures/hashGameState.ts`) excludes `G.messages` but includes
  `notableEvents`; `computeStateHash` (`replay/replay.hash.ts`) includes `G.messages`
  (competition verification, desync detection). The sentinel
  `sentinel-core-doom-2p.replay.json` fires only the core Dr. Doom Master Strike, on
  seat 0's turn, and that strike is out of scope; `PRE_WP080_HASH` is an empty replay;
  `sim:runtime-observed` runs `PLAYER_COUNT = 1` (so the dashboard `totalObs` pin
  holds). All three are expected unchanged; confirm at execution, and a move is
  STOP-and-explain. **The multi-seat diagnostic PAR profiles are expected to move**:
  `generate-par-profiles.mjs` sweeps 2-5 players, and the committed scenarios under
  `data/par/profile/v1` play Legacy Virus (S1), core Loki (R5) and reveal-or-wound
  villains (V6). They are already stale against `main` (open PR #2698), so movement
  cannot be attributed in-commit; they are **re-pinned by a follow-up `INFRA:` PR after
  EC-884 merges** (the WP-792 / WP-793 operator-ruling precedent). Default applied at
  draft; Jeff may rule otherwise. Seed PAR is rating-based and does not move. Stored
  `competitive_scores` stay frozen (the D-24616 precedent).
- **Reused (exist on `main`, unchanged):** `gainWoundForPlayer` (`board/wounds.logic.ts`,
  the Wound chokepoint that queues Diving Block / Flying Shield Block), `discardFromHand`
  (`moves/discardFromHand.ts`, the discard chokepoint that fills the return-on-discard /
  teleport queues), `resolveCurrentPlayer` and `mastermindStrikeHandler`
  (`rules/mastermindHandlers.ts`), `hashGameState` (`test/fixtures/hashGameState.ts`),
  `computeStateHash` (`replay/replay.hash.ts`); test-local `makeRevealContext(currentPlayer)`
  (`rules/schemeTwistResolvers.test.ts` ~L25). R1 already takes
  `currentPlayer: string | null`; none of R4-R10 is exported.
- **Dependencies:** none open — WP-469 (V6, D-24281), WP-684 (D-24501), WP-816 (V3,
  D-24749), WP-827 (Flying Shield Block, D-24760) and WP-843 (H7, D-24777) are Done.
  **Coordination with WP-845** (drafted: reveal-or-wound
  seat choice): its enqueue-time split runs inside two in-scope loops (H7, V6). Either
  order works: if WP-845 lands first, this WP rotates those loops with its split inside;
  if this lands first, WP-845 builds on the rotated loops. WP-845's **apply stays
  ascending** (D-24501 governs every simultaneous apply) and its `revealingSeats` stay
  recorded ascending (its `enqueueRevealOrWoundChoice` sorts them itself, so rotating
  the enclosing loop cannot reorder them); only its inline cannot-reveal Wounds follow
  the rotated loop. Under
  a short supply, cannot-reveal seats are served in turn order at effect time and
  decliners in ascending order at apply: a mixed-order residual D-24780 records. (Default
  applied at draft; Jeff may instead rule a D-24501 carve-out, which changes both WPs.)
  Soft ordering also with WP-844 (on `main`, `heroEffects.execute.ts` beside
  `heroEffectGainWound`), INFRA #3033 (a `heroAbility.types.ts` comment), and WP-837
  (Frost Giant Warrior's discard-or-Wound wounds seats when its choice opens, a new
  in-scope loop if WP-837 lands first; the EC's STOP-and-amend rule covers it). Soft ordering with the drafted
  co2e villain packets WP-836..840 (same `villainEffects.execute.ts`, anchor shifts only).

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` L2247-2248.
- The six source files in §Scope and their test files.
- `docs/ai/DECISIONS.md` — D-18902 (sorted seat order for replay determinism),
  D-24156, D-24281, D-24343 (Paibok order, operator-ruled), D-24501 (ascending
  simultaneous apply), D-24656 (replay-stall precedent), D-24760 (Flying Shield Block
  asking order), D-24777 §6; the reserved **D-24780** below.
- `packages/game-engine/src/turn/turnPhases.logic.ts` — the pure-helper neighbour the
  new helper sits beside.
- `.claude/rules/code-style.md` §Pure Helpers.

## Design Rationale

**Lane.** Standard two-session lane: gameplay surface and determinism surfaces (D-24028
criteria #6 and #8 fail), six source files plus tests.

**One helper.** `seatsInTurnOrderFrom(seatIds, currentPlayer)` in new pure module
`turn/seatOrder.logic.ts`: sort a copy of the ids with the default (lexical) compare,
`[...seatIds].sort()` — D-18902's choice and the one every simultaneous apply uses —
then rotate so
`currentPlayer` is first. If `currentPlayer` is `null` / `undefined` / not a seat, return
the sorted list unchanged (stub contexts and unit tests keep today's order). Each
in-scope loop replaces `Object.keys(G.playerZones).sort()` with
`seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)`. "Each other player"
loops **rotate first, then filter**: `seatsInTurnOrderFrom(Object.keys(G.playerZones),
currentPlayer).filter((seat) => seat !== currentPlayer)`. T6 / T9 today build a
pre-filtered `otherSeats` list; passing that list to the helper would hit the
not-a-seat fallback and silently stay sorted. Loops that skip inside the body (T1, V1,
M1) keep their skip. For the reachable ids `'0'..'4'` lexical order is ascending seat
order. No boardgame.io import, no RNG.

**Forward rule.** A new each-player loop whose order changes a Wound-stack, Flying
Shield Block or discard-reaction outcome MUST iterate `seatsInTurnOrderFrom`; one that
does not stays on `.sort()` with a `// why:` saying why. Stated in D-24780 and the
helper's JSDoc.

**Scope rule: change a loop only where order changes a rules outcome or a prompt
order.** That is:
- **(a) the Wound stack** — the player who misses the last Wound; every Wound also
  passes `gainWoundForPlayer`, so Flying Shield Block's serial waves (FIFO per holder,
  once per turn) are asked in loop order. The Diving Block queue fills in loop order
  too, but its wave is simultaneous, so that part is cosmetic;
- **discard reactions** — every effect discard passes `discardFromHand`, so the
  return-on-discard / teleport queues fill in loop order.

**Excluded, with reasons:**
- **RNG-only loops** (Gambit's Hypnotic Charm others, Psychic Link draws, Monarch's
  Decree draw, Melter): order only changes which seat's
  reshuffle uses which random value. A physical table has no shared random stream, so
  there is no rule to match, and changing them moves trajectories for nothing.
- **Rogue Steal Abilities** re-fires the copies in seat order; at the table the
  playing player picks that order, so there is no each-player order to align to.
- **Paibok the Power Skrull** (non-current players gain first, then the current player
  picks): operator-ruled ordering in D-24343. Reopening it is its own decision.
- **Log-only and append-order-only loops** (core Magneto / Dr. Doom / Red Skull strikes'
  per-seat lines and `notableEvents`, Whispers and Lies and other `G.ko` appends,
  Prisoners of War, Executioner, `ko-hero` each, Fallen Idols, Computer-Uploaded Genius,
  the escape cost-discard builder): no outcome changes; reordering would move hashed
  arrays and the competition hash for no gameplay change. Core Magneto (R1) is the
  exception: it is in scope for its discard reactions.
- **Simultaneous seat-choice applies** (Diving Block, Flying Shield Block, Monarch's
  discard, Vanishing Illusions, Random Acts, the escape discards, and WP-845's):
  D-24501 locks ascending apply for simultaneous choices; that is a separate decision.
- **Flying Shield Block's asking order** (recipient first, then ascending, D-24760): it
  is "any player may reveal", not an each-player effect, and `gainWoundForPlayer` has no
  current player. Separate decision.
- **Builders of simultaneous prompts** (every addressed seat answers at once): order is
  cosmetic.
- **Not effects:** invariant checks, scoring, snapshot, the UI / operator projections,
  `zones.validate`, `ai.seatChoice`; the Ymir tie-break `selectPlayerWithMostWounds`
  (already current player first, then lowest seat) and `buildDominateTheWeakChoice`
  (one chooser's option order). R8's `hypnoThralls` order is display-only; R8 is in
  scope for its discards.
- **Out-of-scope observation (follow-up, not this WP):** Diving Block lands the Wound
  and then undoes it (D-24499), so with one Wound left a Diving Block holder takes and
  returns it while later seats get nothing; at the table the Wound would pass on.
  Pre-existing; AC fixtures keep Diving Block off the short-supply recipient.

**Replay compatibility.** Runtime handler code that existing hooks reach changes, so
this is not setup-only. A multi-seat match captured before the deploy and re-executed
after (competition verification, coach `reduceReplayByHash`) diverges if an in-scope
loop ran on a non-seat-0 turn and either logged per seat (the message log is in
`computeStateHash`) or met a short supply / reaction. Rotating M1's draw branch and R10's reveal branch also
moves deck-order RNG, so those diverge in state, not only in log lines. Accepted, no
migration: the D-24656 position. Solo matches are unaffected (rotation is the identity).

## Scope (In)

| # | File | Function (card) | Scope | Why in scope |
|---|---|---|---|---|
| H1 | `hero/heroEffects.execute.ts` | `heroEffectGainWound` `gain-wound-each` (Crazed Rampage core, …) | each | Wound stack |
| H7 | same | `heroEffectRevealOrGainWoundEach` (co2e Crazed Rampage) | each | Wound stack |
| R1 | `rules/mastermindHandlers.ts` | `resolveMagnetoStrike` (core Magneto) | each | discard reactions |
| R4 | same | `resolveDoctorDoomStrike` (co2e Dr. Doom) | each | Wound stack + discard reactions |
| R5 | same | `resolveCoreLokiStrike` | each | Wound stack |
| R6 | same | `resolveBaronZemoStrike` | each | Wound stack |
| R7 | same | `discardCardOfCostForEachPlayer` (Arnim Zola strike) | each | discard reactions |
| R8 | same | `resolveLokiStrike` (co2e Loki) | each | discard reactions |
| R9 | same | `resolveCo2eMagnetoStrike` | each | Wound stack + discard reactions |
| R10 | same | `resolveDoctorOctopusStrike` (co2e Doctor Octopus) | each | discard reactions (its discard branch reaches `discardFromHand`; its reveal branch's reshuffle order moves too, like M1's draw branch) |
| T1 | `rules/tacticHandlers.ts` | `resolveCrushingShockwave` (Magneto) | each other | Wound stack |
| T6 | same | `dealFindingZemoWounds` (Zemo) | each other | Wound stack |
| T9 | same | `resolvePetProjects` (Zola) | each other | Wound stack |
| S1 | `rules/schemeTwistResolvers.ts` | `revealOrPunish` (Legacy Virus) | each | Wound stack + discard reactions |
| S2 | same | `woundAll` (Cosmic Cube) | each | Wound stack |
| S4 | same | `woundPlayerIfGladiatorIsWeaker` loop (Clash of the Monsters) | each | Wound stack |
| V1 | `villain/villainEffects.execute.ts` | `villainEffectGainWound` `each-other` | each other | Wound stack |
| V2 | same | `villainEffectGainWound` `each` | each | Wound stack |
| V3 | same | `applyGainWoundEachNonSavior` (Radioactive Man) | each | Wound stack |
| V6 | same | `villainEffectRevealOrWound` (Sabretooth, Frost Giant, …) | each | Wound stack |
| V10 | same | `villainEffectGainWoundUnlessVictoryVillainGroup` | each | Wound stack |
| M1 | `moves/coveringFireChoice.resolve.ts` | `resolveCoveringFireChoice` (Hawkeye) | each other | discard reactions (one loop serves both branches) |

- **New** `turn/seatOrder.logic.ts` (`seatsInTurnOrderFrom`) + `turn/seatOrder.logic.test.ts`.
- **Threading:** R4-R10 gain a `currentPlayer: string | null` parameter supplied by
  `mastermindStrikeHandler` from `resolveCurrentPlayer(context)` (for R7 through
  `resolveArnimZolaStrike`; for R10 beside its shuffle function); S4 swaps the shared
  `playerIds` constant that feeds both the gladiator pass and the wound loop; S1 / S2 / S4 read the current player from their reveal
  context the same way (duplicate-first: a local reader, or reuse if one already
  exists in that file). No exported signature changes.
- **Tests:** helper unit tests; one rotation case per site (AC-8: 3 players, current
  `'1'`, per-seat order `1, 2, 0` in the reaction queue, Wound recipients or log); one
  short-supply test per Wound family (1 Wound left, current `'2'` → seat 2 gets it);
  existing assertions are re-asserted only under the Verification step 5b rule, each
  named in the commit body (product behaviour intentionally changed).

## Out of Scope

- The excluded loop classes in Design Rationale "Excluded": RNG-only loops (Hypnotic
  Charm others, Psychic Link, Monarch's Decree draw, Melter), Rogue Steal Abilities
  re-fire, Paibok (D-24343), log- and append-order-only loops, simultaneous seat-choice
  applies (D-24501, WP-845's included), Flying Shield Block's asking order (D-24760),
  builders of simultaneous prompts, and the "Not effects" class.
- Any change to `ctx.playOrder`, turn order, or first-player selection.
- The Diving Block land-then-undo short-supply behaviour (D-24499; follow-up).
- Re-pinning `data/par/profile/v1/**` (follow-up `INFRA:` after EC-884 merges).
- Any `UIState` field, card data or marker change, registry or server change.

## Files Expected to Change

- `packages/game-engine/src/turn/seatOrder.logic.ts` — **new** (pure `seatsInTurnOrderFrom`: sorted copy rotated to the current player; sorted fallback)
- `packages/game-engine/src/turn/seatOrder.logic.test.ts` — **new** (the AC-1 helper cases: rotation, wrap, null / undefined / unknown fallback, no input mutation)
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (H1, H7)
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** (R1, R4-R10 + threading)
- `packages/game-engine/src/rules/tacticHandlers.ts` — **modified** (T1, T6, T9)
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — **modified** (S1, S2, S4)
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** (V1, V2, V3, V6, V10)
- `packages/game-engine/src/moves/coveringFireChoice.resolve.ts` — **modified** (M1)
- Tests **modified** (new rotation / short-supply cases, plus any order assertion that
  moves): `hero/heroEffects.execute.test.ts`, `hero/crazedRampage.revealOrGainWound.test.ts`,
  `rules/mastermindHandlers.test.ts`, `rules/tacticHandlers.test.ts`,
  `rules/schemeTwistResolvers.test.ts`, `villain/villainEffects.execute.test.ts`,
  `moves/coveringFireChoice.resolve.test.ts`
- **Conditional (only if the measured run moves them; predicted not to):**
  `test/fixtures/games/sentinel-core-doom-2p.replay.json` (recorder only),
  `replay/replay.execute.test.ts` (`PRE_WP080_HASH`),
  `docs/ai/coverage/runtime-observed-hollows.json` +
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts`. A move is
  STOP-and-explain, then re-pin by its writer with the cause. **Not in this WP:**
  `data/par/profile/v1/**` (follow-up `INFRA:` re-pin).
- **Comment-only, outside the six files:** `rules/heroKeywords.ts` (the covering-fire
  comment, ~L88) and `types.ts` (~L1221) describe M1's sorted order; updated in the same
  edit (comments only, types byte-identical). The touched functions' "sorted id order"
  JSDoc and `// why: D-18902` lines are updated too.
- Governance close: `docs/ai/DECISIONS.md` (D-24780), `docs/ai/STATUS.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/coverage/live-verify.json`.

The file count is above 00.3 §5's ~8 because the rule spans six effect families; each
source edit is a one-line loop-source swap plus, for the strikes and schemes, threading
the current player.

## Non-Negotiable Constraints

> - Full file contents for every new or modified file — no diffs, no snippets; human-style
>   code per `docs/ai/REFERENCE/00.6-code-style.md`; ESM only; Node v22+; no
>   `.reduce()`; JSDoc on every function; `// why:` on every swapped loop citing
>   rules v23 L2247 / D-24780.
> - The helper is pure (no boardgame.io, no RNG, no `G` read beyond the ids passed);
>   unknown / absent current player → sorted order.
> - Only the 22 in-scope loops change; every excluded site stays byte-identical.
> - Loop bodies are unchanged except the iteration source; no other behaviour change.
> - Never hand-edit a pinned hash; re-pin only what the measured run moved, by its
>   writer. Never weaken an assertion.
> - On any ambiguity the WP + EC do not resolve, STOP and surface it.

## Contract

- `seatsInTurnOrderFrom(seatIds: readonly string[], currentPlayer: string | null | undefined): string[]`
  — `[...seatIds].sort()` (lexical, D-18902), rotated to start at `currentPlayer`; sorted when `currentPlayer`
  is absent or not in `seatIds`; never mutates its input.
- The 22 in-scope loops iterate that order.

## Vision Alignment

- **Vision clauses touched:** §1 (rules v23 L2247 followed); §2; §8 / §22 (order is a
  pure function of seat ids and the current player; no RNG added; M1's draw and R10's
  reveal branches reorder RNG consumption deterministically); §18 / §24 (new replays are
  faithful; a pre-deploy multi-seat log that ran an in-scope loop on a non-seat-0 turn
  diverges on re-execution — competitive verification, coach `reduceReplayByHash` —
  accepted in D-24780, the D-24656 position); §26 (multi-seat PAR profiles move;
  re-pinned by the follow-up `INFRA:`).
- **Conflict assertion:** No conflict — a printed rule (L2247) is followed; no RNG
  added, no paid advantage (NG-1 untouched).
- **Non-Goal proximity check:** N/A — none of NG-1..NG-8 crossed.
- **Determinism preservation:** order is a pure function of seat ids and the current
  player; solo and seat-0 turns are unchanged; oracle movement is measured and
  re-pinned only by recorder.

## Funding Surface Gate

§20 N/A — engine gameplay only; no funding affordance or copy.

## API Catalog Update

§21 N/A per D-11804 — no HTTP endpoint or server-reachable library function changes.

## Acceptance Criteria

- **AC-1** Helper: `(['0','1','2'], '1')` → `['1','2','0']`; `(['2','0','1'], '0')` →
  `['0','1','2']`; `(['0','1'], undefined)` / `(['0','1'], null)` / `(['0','1'], '7')` →
  `['0','1']`; `(['0','1','2','3','4'], '4')` → `['4','0','1','2','3']`; the input array
  is not mutated.
- **AC-2** Short supply, one per "each" Wound family (hero H1, strike R5, scheme S2,
  villain V2): 3 players, current `'2'`, one Wound left, no seat holding Diving Block /
  Flying Shield Block → seat 2 gains it and seats 0 and 1 gain none (each family's
  existing empty-supply narration, unchanged). Each-other variant (tactic T1, villain
  V1): current `'1'`, one Wound left → seat 2 gains it.
- **AC-2b** Pre-filtered each-other list (T6 or T9): current `'1'`, 3 players → the
  Wounds go in order `2, 0` (catches the rotate-then-filter trap).
- **AC-3** Rotation canary: 3 players, current `'1'`, every seat holding Diving Block,
  ample supply → `G.pendingDivingBlockWounds` seat order `1, 2, 0` (one hero and one
  villain case). Cosmetic for Diving Block itself; kept as a cheap order probe.
- **AC-3b** Flying Shield Block (the outcome case): 3 players, current `'1'`, only seat 0
  holds Flying Shield Block, every seat gains a Wound (one hero or villain site) → the
  first Flying Shield Block wave asks seat 0 about Player 1's Wound (today it asks about
  seat 0's own).
- **AC-4** Discard-reaction order (S1's discard-hand penalty, or R9 / R7, which
  auto-discard for every seat; not R1, whose current player parks an interactive
  discard): 3 players, current `'1'`, every seat holding a return-on-discard card that
  the effect discards → `G.pendingReturnOnDiscard` owner order `1, 2, 0`.
- **AC-5** Seat-0 and solo identity: for each family, current `'0'` (and a 1-player
  state) → `G` matches literal expected values captured on the **unmodified** baseline
  before any code change (one 3-player seat-0 input per family; computing them with the
  new code is forbidden), and the existing seat-0 tests stay byte-unchanged. Never shown
  by passing a null current player (R1's null path also changes how it parks).
- **AC-6** Excluded sites unchanged: a test for one excluded RNG loop (Psychic Link)
  and Paibok with current `'1'` still runs ascending (the Psychic Link case in
  `hero/heroEffects.execute.test.ts`, the Paibok case in
  `villain/villainEffects.execute.test.ts`; `hero/psychicLink.revealFromHand.test.ts` is
  not touched).
- **AC-7** Determinism: the sentinel `finalStateHash`, its messages oracle,
  `PRE_WP080_HASH` and `sim:runtime-observed:check` are run and are byte-unchanged
  (predicted); a move is STOP-and-explain. **Any** test file outside the allowlist that
  shifts (likeliest: `simulation/seatChoiceDispatch.test.ts`, a seeded 2-seat core Loki
  sim; `moves/divingBlock.multiSeatWave.test.ts`, a core Loki strike on seat 1's turn in
  a 4-seat reducer match; `game.test.ts`; `moves/coreMoves.integration.test.ts`) is
  STOP-and-amend, never silently updated. PAR profiles are left for the follow-up `INFRA:` re-pin.
- **AC-8** Every site, table-driven: for **each of the 22 sites**, 3 players, current
  `'1'`, assert per-seat order `1, 2, 0` (each-other sites `2, 0`) in the log, the Wound
  recipients or the reaction queue, driven through its public entry point:
  `mastermindStrikeHandler` with a context carrying `ctx.currentPlayer: '1'` (proves the
  R4-R10 threading), the scheme resolvers with `makeRevealContext('1')`, the villain
  executor, the exported tactic functions, the hero handler, `resolveCoveringFireChoice`.
  Cases live in the seven allowlisted test files.
- **AC-9** Grep gate (after coding): (a) non-comment `seatsInTurnOrderFrom(` calls per
  file — hero 2, mastermind 8, tactic 3, scheme 3, villain 5, coveringFire 1 (22 total;
  none elsewhere except the helper's definition in `turn/seatOrder.logic.ts` and its own
  test; command: Verification step 5c); (b) the per-file count of
  `Object\.keys\([A-Za-z.]*playerZones\)` (regex) code sites is **unchanged** from the baseline in
  all six files (the swap keeps `Object.keys(G.playerZones)` as the helper's argument;
  the pattern also catches `gameState.playerZones`); (c) the diff hunks touch only the 22
  named functions, the threading in `mastermindStrikeHandler` /
  `resolveArnimZolaStrike`, the helper import in each of the six files, the scheme
  file's local current-player reader, and the touched functions' JSDoc / `// why:`
  lines, so every other site is byte-identical.

## Verification Steps

1. Inventory (PowerShell, repo root):
   `Get-ChildItem packages/game-engine/src -Recurse -Filter *.ts | Where-Object Name -notlike '*.test.ts' | Select-String -Pattern 'Object\.keys\([A-Za-z.]*playerZones\)' | Where-Object { $_.Line -notmatch '^\s*(//|\*|/\*)' } | Group-Object Path | Select-Object Count, Name`
   — draft-time (2026-10-26) 61 code lines; the six source files hero 7, mastermind 10,
   tactic 9, scheme 3, villain 10, coveringFire 1. Confirm the 22 in-scope sites by
   function name; a new each-player Wound / discard loop on `main` since the draft → STOP and
   amend the WP (in scope by the rule) before coding.
2. `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0
   (record the delta and each moved assertion).
3. `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` exit 0.
4. `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` and
   `pnpm --filter @legendary-arena/dashboard run prebuild:effect-index`, then
   `pnpm -r --no-bail test` — 0 failures.
5. **Revert proofs:** (a) make the helper return the sorted list → AC-2, AC-3, AC-3b and
   AC-8 fail; (b) pass `null` instead of `resolveCurrentPlayer(context)` into one strike
   (R6) → that site's AC-8 case fails; restore both.
5b. **Re-assertion rule for existing tests:** only a test whose current player is
   non-zero may be re-asserted; with ample supply the new expected order is a
   permutation of the old one (same seats, same outcomes); any seat-0 or solo test that
   moves → STOP (it breaks AC-5). Each re-asserted test is named in the commit body.
5c. **AC-9 counts:** (a)
   `Get-ChildItem packages/game-engine/src -Recurse -Filter *.ts | Select-String -Pattern 'seatsInTurnOrderFrom\(' | Where-Object { $_.Line -notmatch '^\s*(//|\*|/\*)' } | Group-Object Path | Select-Object Count, Name`
   → hero 2, mastermind 8, tactic 3, scheme 3, villain 5, coveringFire 1,
   `turn/seatOrder.logic.ts` 1 (the definition), plus `turn/seatOrder.logic.test.ts`; no
   other file. (b) step 1's command: the six-file counts equal the Before Starting
   capture.
6. `git diff --name-only` equals the EC allowlist; no CRLF-only churn.

## Definition of Done

- [ ] AC-1..AC-9 (+ AC-2b, AC-3b) satisfied; Verification Steps green, including both revert proofs.
- [ ] No files outside the finalised EC allowlist.
- [ ] `docs/ai/DECISIONS.md` **D-24780 Active**.
- [ ] `docs/ai/STATUS.md` close-out entry.
- [ ] **D-24026 live-on-surface:** a `play.legendary-arena.com` multiplayer match
      created after the deploy where an in-scope each-player effect fires on a non-seat-0
      turn and the per-seat log line names the current player first (a family that names
      seats: core Loki strike R5, reveal-or-wound V6, or Finding Zemo T6 — not the
      gain-wound-each summary line, which names none); recorded in STATUS / DECISIONS
      and `docs/ai/coverage/live-verify.json`, or operator-pending.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`,
      then `pnpm roadmap:counts:check` exits 0.
- [ ] STATUS close-out carries an **owed** line: the multi-seat PAR profile re-pin
      (`node scripts/generate-par-profiles.mjs --version v1`), one `INFRA:` run covering
      both EC-883 (WP-845) and EC-884, after open PR #2698 (default applied; Jeff may rule
      otherwise).

## Reserved Decision (lands at execution)

**D-24780 — Order-sensitive each-player loops start with the current player and go
clockwise (rules v23 L2247).** Records: the helper and its fallback; the scope rule
(Wound stack and discard reactions); the 22 sites; each excluded class and why (RNG-only,
Rogue re-fire, Paibok / D-24343, log- and append-only, simultaneous applies / D-24501,
Flying Shield Block asking order / D-24760, simultaneous builders); amends D-18902 /
D-24156 / D-24281 / D-24777 §6 for the in-scope loops; measured oracle movement; replay
divergence for pre-deploy multi-seat logs accepted (D-24656 position); the WP-845
mixed-order residual (cannot-reveal seats in turn order at effect time, decliners
ascending at apply); multi-seat PAR profiles re-pinned by a follow-up `INFRA:` PR;
M1's draw branch and R10's reveal branch move the RNG stream; the authorized
comment-only edits (`heroKeywords.ts`, `types.ts`); the "Not effects" class; the
Diving Block land-then-undo follow-up; the lexical comparator (kept from D-18902); the
forward rule for new each-player loops; Flying Shield Block's asking order as the
reaction outcome and the Diving Block queue order as cosmetic; the consolidated owed PAR
re-pin shared with D-24779.

## Lint Gate Self-Review (00.3)

Completed at draft against all 21 sections, after both gates, by an independent
subagent. Its first run FAILED §1 (Out of Scope by cross-reference, not a bullet list),
§2 (no explicit diff / snippet ban, no Node v22+, `00.6` not cited by path), §3 (reused
helpers not listed with files; Done WPs unnamed), §5 (new files without descriptions;
AC-6's host test unnamed), §13 (the inventory / AC-9 pattern
`Object.keys([A-Za-z.]*playerZones)` matched 0 lines, so AC-9 (b) passed vacuously; no
exact commands for the inventory, the AC-9 (a) count or the dashboard prebuilds), §14
(AC-9 (a) would fail a correct build on the helper's own definition line) and §17
(§8 / §18 and NG-8 missing), plus EC-884 against EC-TEMPLATE (`roadmap:counts:check`
missing). All were fixed in place; the list shows the post-fix state.

- **PASS:** §1 (every required section present, §Contract included; Out of Scope names
  five exclusions as bullets); §2 (full-file / no-diffs / no-snippets / ESM / Node v22 /
  `docs/ai/REFERENCE/00.6-code-style.md` constraints, packet-specific purity,
  byte-identical-excluded-site and loop-body constraints, STOP-on-ambiguity, locked
  values in §Contract and EC-884); §3 (WP-469 / WP-684 / WP-816 / WP-827 / WP-843 Done;
  seat-id and turn-order facts with files; every reused helper named with its file
  (`gainWoundForPlayer`, `discardFromHand`, `resolveCurrentPlayer`,
  `mastermindStrikeHandler`, `makeRevealContext`); per-family current-player source;
  hash surfaces measured; WP-845 / WP-844 / WP-837 / WP-836..840 ordering recorded); §5
  (every file marked new / modified / comment-only / conditional with its change; AC-6
  homed in allowlisted files; the count above ~8 is justified under §Files); §6
  (canonical names; no 00.2 field touched; paths verified on disk); §7 (no new
  dependency); §8 (engine-only; pure helper beside `turnPhases.logic.ts`, no
  boardgame.io, no RNG, no `G` field, no persistence); §9 (`pnpm` / `node` / `git`; the
  inventory and AC-9 counts are PowerShell `Select-String`, run at draft); §12
  (`node:test`; cases in the seven allowlisted test files; no network / DB; hash oracles
  stand in for the golden test); §13 (exact commands, each "exits 0", an expected count,
  or the AC a revert proof fails); §14 (eleven binary ACs naming functions, seats, queues
  and counts; AC-9 (a) allows the helper's definition file); §15 / §15.1 (STATUS,
  DECISIONS D-24780 Active, WORK_INDEX + EC_INDEX, scope-boundary check;
  `play.legendary-arena.com` declared with a live-on-surface DoD item naming the per-seat
  log lines); §16 (`00.6` cited; one helper with 22 uses; local current-player reader
  duplicate-first; no `.reduce()`; JSDoc and `// why:` locations in EC-884); §17 (clauses
  §1 / §2 / §8 / §18 / §22 / §24 / §26, no-conflict assertion, NG-1..NG-8 check,
  determinism line); §19 (baseline `1297317d` cited; re-baseline at execution).
- **§4:** Context is specific (rules v23 L2247-2248, the six files, named D-entries,
  `turnPhases.logic.ts`, code-style §Pure Helpers). No data-shape, layer-boundary or
  import change and no `UIState` field, so 00.2 and ARCHITECTURE.md are not required
  references.
- **EC-884:** under the 100-line ceiling; build + engine test in Before Starting (engine
  WP, no typecheck line needed); mindmap + `roadmap:counts:write` / `:check`;
  live-on-surface gate; Locked Values match the WP (helper signature, the 22 sites,
  current-player sources, rotate-then-filter, test shape); grep pattern escaped.
- **N/A, with reason:** §10 (no environment variables); §11 (no authentication); §18 (no
  forbidden-token grep; the `seatsInTurnOrderFrom(` / `Object.keys` count gates exclude
  comment lines); §20 (engine gameplay only; no funding affordance or copy); §21 (no HTTP
  endpoint touched and no `apps/server/src/**`-reachable catalog function changed; R4-R10
  are file-private, per D-11804).

## Gate Record

- **01.4 pre-flight (independent subagent):** NOT READY → READY TO EXECUTE. Engine
  baseline observed 5864 / 1318 suites / 0 fail. PS-1: co2e Doctor Octopus's discard
  branch reaches `discardFromHand`, so it is in scope by the WP's own rule (R10, 22
  sites). PS-2: pre-filtered each-other lists (T6 / T9) would silently stay sorted;
  rotate-then-filter locked, AC-2b added. PS-3: WP-845's apply stays ascending
  (D-24501, default; Jeff may rule a carve-out). PS-4: multi-seat PAR profiles move and
  are re-pinned by a follow-up `INFRA:` PR (WP-792 / WP-793 precedent, default; Jeff
  may rule otherwise). PS-5: AC-2 (T1 is each-other) and AC-4 (R1 parks
  interactively) corrected. RS-1..RS-11 folded. Re-confirmation: READY TO EXECUTE
  after C-1 (WP-845's enqueue sorts `revealingSeats` itself; EC Before Starting check),
  C-2 / C-3 (stale counts), C-4 (R8 reason), C-5 (D-24780 record list), all applied.
- **01.7 copilot (independent subagent):** pass 1 RISK / HOLD — #11 (ACs covered ~9 of
  22 sites; added AC-8 per-site table, AC-9 grep gate, R6 null revert proof, the
  permutation-only re-assertion rule, AC-5 literal baseline), #26 (Flying Shield Block is
  the reaction outcome, Diving Block queue order cosmetic; AC-3b; per-seat-logging
  live-verify), #23 (lexical sort per D-18902), #12 (any outside-allowlist mover is
  STOP; two likeliest run right after the swap), #30 (owed shared PAR re-pin line), #14
  (forward rule), #20 (EC-883 L8 / D-24779 residual) — all applied. Pass 2 RISK / HOLD
  — AC-9 as written would fail a correct swap (the `Object.keys` count stays unchanged)
  and missed `gameState.playerZones`; EC AC-5 wording and the §Scope Tests bullet —
  applied. Pass 3: **CONFIRM** after one inline wording fix (AC-9 (c) also allows the
  six helper imports, the scheme current-player reader and JSDoc / `// why:` lines),
  applied.
- **00.3 lint (independent subagent):** FAIL on §1 / §2 / §3 / §5 / §13 / §14 / §17 and
  one EC-TEMPLATE item (worst: the inventory / AC-9 grep pattern was unescaped and matched
  nothing); all fixed in place, the PowerShell inventory re-run at draft (six-file counts
  hero 7 / mastermind 10 / tactic 9 / scheme 3 / villain 10 / coveringFire 1). Re-lint:
  **PASS** (every section PASS or justified N/A; EC-884 meets EC-TEMPLATE).
- **01.7 pass 4 (diff-confirm of the post-lint edits):** **CONFIRM**, no finding reopened
  (the escaped pattern's counts re-derived independently; the comment filter keeps AC-9
  (b) non-vacuous; baseline `1297317d` moves no engine source).
