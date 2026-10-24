# WP-829 — Go Back in Time to Slay Heroes' Ancestors: the Purge Twist and the HQ KO rule (Game Engine + one client heading)

**Status:** Draft 2026-10-24 — gates pending (EC-867; **D-24762** reserved (#2993)).
**Primary Layer:** Game Engine (`rules/` scheme resolver + new Purge module, `game.ts` onMove, `moves/` dispatch / setter guard, `simulation/` bot) plus one arena-client heading string
**Dependencies:** none open. Builds on WP-763 / D-24595 (this scheme's `pile-depleted` Hero Deck loss, already correct), WP-799 (its 8-Hero setup, already correct), WP-793 / D-24656 (the escape procedure: an owed queue opened after the move as the active player's HQ pick, and its waits), WP-684 / D-24501 (`G.pendingSeatChoice`, `cardId` options), WP-823 / D-24756 (a scheme-specific resolver id, the contract precedent).
**User-Visible Surface:** `play.legendary-arena.com` (any match with the scheme Go Back in Time to Slay Heroes' Ancestors)
**Lane:** Standard (two-session). It adds a member to the `SchemeTwistResolverId` contract union (`rules/schemeTwistConfig.types.ts`), two lazily created `G` fields and a seat-choice kind (D-24028).
**Arc:** Cap 75th completion, remaining item 7 (auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at the reserve commit #2993 (on top of `54c3b535`); the scaffold ran on `54c3b535`. WP-826 (#2986), WP-827 (#2989) and WP-828 (#2992), open at drafting, touch the same seat-choice dispatch / bot / drop-set / setter-guard / client-heading sites and the governance index files; whichever lands later rebases, keeping both sides' rows.

---

## Goal

As a player facing Go Back in Time to Slay Heroes' Ancestors, I want its Twist and its special rule to work as printed: "Twist: Put a Hero from the HQ next to the Scheme, 'Purged from the Timestream.'" and "Special Rules: Whenever a Hero is in the HQ whose Hero Name has been Purged from the Timestream, KO that Hero." — so the scheme eats the Hero Deck the way it should.

Today the scheme is `counter-only`: Twists only count, nothing is Purged, nothing is KO'd. Its loss ("When the Hero Deck runs out") and its 8-Hero setup are already right.

After this session:
- Each Twist owes one Purge, made after the move that revealed it. You pick the Hero from the HQ (a prompt listing each HQ Hero with its cost); with one HQ Hero it is Purged with no prompt; with none, nothing happens.
- The Purged Hero leaves the HQ and is set next to the Scheme (not KO'd); its slot refills from the Hero Deck.
- From then on, every Hero in the HQ that shares a Purged Hero's name is KO'd and its slot refilled, after each Purge and after every move, until none is left. The KOs drain the Hero Deck toward the scheme's loss.

## Scaffold (observed at drafting, REQUIRED evidence)

On 2026-10-24 the change was prototyped in the drafting worktree, measured, and reverted. The patch is kept as evidence (`wp829-scaffold.patch` in the drafting session's scratchpad); the executor re-authors from Locked Values and the Test Contract and may consult it.

- **Tests.** The new file (B1-B16; B14-B16 added with the gate fixes) passes 16 / 16 after one fixture fix (B5 first used an empty Hero Deck, which is already the scheme's loss, so the opener rightly waited). Engine typecheck clean.
- **Suite.** game-engine 5672 → 5694 / 0 fail (+22 tests: 16 in the new file, 6 from the `GATE_BLOCKERS` row; +4 suites); arena-client 2435 → 2436; `pnpm -r --no-bail test` 0 fail in every package; arena-client `typecheck` 0.
- **One existing assertion moved.** `rules/schemeTwistConfigs.test.ts`' WP-763 D-pure audit asserted `resolverId 'counter-only'` for all 15 pile-runout schemes; this scheme's Twist now does something, so the audit gains a named one-entry exception (`AUDIT_PURE_RESOLVER_EXCEPTIONS`) and still asserts its piles, threshold and fallback.
- **Revert proofs (observed, after the 01.4 ordering fix).** Exactly as AC 3 lists them, (a)-(m).
- **Derived artifacts.** After a rebuild every card / coverage `:check` stayed current (`cards`, `cards:count-markers`, both ledgers, `effect-index`, `mechanics:metadata`, `gauntlet:loadouts`, `gauntlet:configs`, `sim:runtime-observed`, `pnpm sim:coverage --check`): nothing regenerates, and the dashboard pin does not move.
- These were measured at the #2993 base and are expectations, not targets.

## User-Visible Impact

- A Go Back in Time Twist now logs "[Go Back in Time] Player N must Purge a Hero in the HQ from the Timestream." and, after the move, prompts "Go Back in Time — choose a Hero in the HQ to Purge from the Timestream".
- The Purge logs "[Go Back in Time] Player N Purged <card> from the Timestream: every other card of its Hero in the HQ is now KO'd." and each KO "… was KO'd from the HQ: its Hero was Purged from the Timestream." Each Twist also records a `schemeTwistResolved` notable event.
- Every other scheme is unchanged.

---

## Assumes

1. **Config** (`rules/schemeTwistConfigs.ts` on the baseline): the scheme (L508-515) is `resolverId: 'counter-only'` with `resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' }`.
2. **Resolver contract**: `SchemeTwistResolverId` (`rules/schemeTwistConfig.types.ts` L115-126, ending `'counter-only'`) is a closed union; `SCHEME_TWIST_RESOLVERS` (`rules/schemeTwistResolvers.ts` L1115) is a `Record` over it, so a new member needs a registered resolver. A resolver receives `(gameState, context: RevealContext, implementationMap, params, twistCardId?)`; `context.ctx.currentPlayer` is the active player (`villainDeck/villainDeck.reveal.ts` L94).
3. **HQ helpers**: `refillHqSlot(hq, slot, heroDeck)` (`board/city.logic.ts` L204) returns new arrays; `koCard` (`board/ko.logic.ts` L24); the private `koFromHq` (`rules/schemeTwistResolvers.ts` L453) is the remove-then-refill template.
4. **Shared helpers**: `hasAnyPendingChoice` (`moves/phaseCard.ts` L82; covers `pendingSeatChoice` but not `pendingHeroChoice`); `parkSeatChoice` / `resolveSeatChoice` (`moves/seatChoice.resolve.ts` L271 / L339); `resolveCardName` / `formatCardRef` (`log/logDisplay.ts`); `G.cardStats[id].cost`; `UNKNOWN_TWIST_CARD_ID` is module-private (`rules/schemeTwistResolvers.ts` L82), so the resolver lives in that file.
5. **Escape precedent**: `openEscapeProcedureSeatChoiceIfNeeded` (`villainDeck/villainEscapeProcedure.ts` L272) runs in `game.ts` turn.onMove (L889) after every move, waits on `hasAnyPendingChoice(G) || G.pendingHeroChoice` (L283) and `evaluateEndgame(G)`, and parks a one-seat HQ pick (`buildEscapeHqKoChoice`, L192, options carrying `cardId`). The onMove re-runs `latchFinalTurnIfDeckExhausted` and `applyPileDepletionResourceLoss` (`rules/schemeResourceLoss.ts` L321) right after the openers.
6. **Seat-choice plumbing**: `applySeatChoiceByKind` dispatches by kind; the bot's `chooseByKind` answers discard-like picks with `indexOfLeastValuableCard` (`simulation/ai.seatChoice.ts` L302); the client heading switch is `PendingSeatChoicePrompt.vue` (with per-kind test cases).
7. **Drop set and guard**: `dropAllPendingPlayerChoices` (`endgame/mastermindVictory.logic.ts`, `pendingSmashDiscards` L120) and its `ALL_PENDING_FIELDS` drift test; `operatorSetters.logic.ts` treats an owed queue as open, pinned by `GATE_BLOCKERS` rows in `moves/operatorSetters.test.ts`.
8. **Hero ids**: HQ / Hero Deck cards are `{set}/{hero}/{card}#{n}` (`setup/buildHeroDeck.ts`), so `{set}/{hero}` identifies the Hero deck (the Hero Name).
9. **Sims**: the sim runner, PAR aggregator and fixture runner mirror the return-on-discard and escape-procedure openers only; a new opener is unmirrored there unless added.
10. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why queue the Purge.** A Twist resolves inside a Villain Deck reveal, where no seat choice can be answered; the escape procedure (D-24656) queues its HQ pick and opens it after the move. Same shape here, same waits.
- **Why a player choice, not the older cheapest-first auto-pick.** `ko-from-hq` twists (D-24349) auto-pick; the escape procedure (D-24656) made "choose a Hero in the HQ" a real pick. Which Hero is Purged decides which Hero Name is gone for the match, so it is the player's decision; the bot and the timeout default pick deterministically (the cheapest / the leftmost).
- **Why "Purged" is not "KO'd".** The card text sets the Hero "next to the Scheme"; only HQ Heroes sharing its name are KO'd. The Purged list (`G.purgedFromTimestream`) is permanent for the match.
- **Why a sweep after each move, and where.** "Whenever a Hero is in the HQ" is continuous. Every HQ refill path (recruit, KOs, the sweep itself) ends a move, so a sweep after every move, plus one inside each Purge, catches every arrival before the player can act on it. It runs BEFORE any opener lists the HQ, never under a parked seat-choice HQ pick: a sweep that KOs a listed option would let the player pick a Hero that is already gone (the 01.4 pre-flight finding). Active-player HQ choices re-validate against the live HQ when they resolve.
- **Escape before Purge.** When one move owes both an escape procedure and a Purge, the escape's steps resolve first (its opener runs first and the Purge opener waits on its seat choice). This is deliberate: the escape steps are owed in rule order by the move that caused them, and the Purge comes from a Twist.
- **Hero Name = the Hero deck.** Matching on `{set}/{hero}` is exact for every loadout that does not field two different Hero decks with the same printed name (no ca75 loadout does); that edge is recorded.
- **Known gaps kept out of scope.** (1) No board readout of the Purged Heroes (the log names each; a UIState field is a later five-step contract). (2) The sim runner, PAR aggregator, fixture runner and autoplay leave the opener and sweep unmirrored: the resolver still runs there, so `pendingTimestreamPurges` grows and never drains (nothing reads it), and no Hero is Purged or KO'd; on such a state the operator setters stay closed, since `isOperatorChoiceOpen` sees the undrained queue. (3) Two Hero decks sharing one printed name would not share a Purge.
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 / #2, §Persistence Boundaries (runtime-only lazy `G` fields), §Layer Boundary (`.claude/rules/architecture.md`).
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` is untouched (no setup change).
- `docs/ai/DECISIONS.md`: scan D-24595, D-24656, D-24349, D-24501, D-24756, D-24318 before coding.
- User memory: `project_cap75_completion_arc` (drive the LIVE turn.onMove in tests; rebuild before trusting derived checks).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness, no I/O, no registry access at runtime. Resolvers and helpers never throw.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24762) before coding. One WP per session.

**Packet-specific:**
- **No setup or loss change.** The 8-Hero setup and the `pile-depleted` loss stay as they are.
- **Runtime-only, lazily initialized.** `pendingTimestreamPurges` and `purgedFromTimestream` are absent until first used; never in `Game.setup`.
- **Tests drive the live wiring.** Owed Purges open through `LegendaryGame.phases.play.turn.onMove`.
- **Contract change.** The `SchemeTwistResolverId` member is recorded in D-24762.

## Locked Values

- **Resolver id**: `'go-back-in-time'`, added to `SchemeTwistResolverId` before `'counter-only'` and registered in `SCHEME_TWIST_RESOLVERS` as `goBackInTime`. The scheme's config switches to `resolverId: 'go-back-in-time'`; `params: {}` and `resourceLossCondition` unchanged.
- **Resolver** `goBackInTime`: `queueTimestreamPurge(gameState, context.ctx.currentPlayer, twistCardId ?? UNKNOWN_TWIST_CARD_ID)`, log (`'threat'`) `[Go Back in Time] Player ${currentPlayer} must Purge a Hero in the HQ from the Timestream.`, and push the `schemeTwistResolved` notable event with `resolverKey: 'goBackInTime'` (the WP-823 lockstep).
- **Notable-event key**: `'goBackInTime'` appended to `SchemeTwistResolverKey` and `SCHEME_TWIST_RESOLVER_KEYS` (`events/notableEvents.types.ts`, ten → eleven), to both lists in `notableEvents.types.test.ts`, and to `RESOLVER_KEY_PHRASES` (`events/notableEvents.compose.ts`) as `'a Hero in the HQ must be Purged from the Timestream'`.
- **Types** (`types.ts`): `PendingTimestreamPurge { chooserPlayerID: string; twistCardId: CardExtId }`, placed with its own JSDoc ABOVE the `PendingDivingBlockWound` JSDoc (never between that JSDoc and its interface); `LegendaryGameState.pendingTimestreamPurges?: PendingTimestreamPurge[] | undefined`; `LegendaryGameState.purgedFromTimestream?: CardExtId[] | undefined`.
- **Module** `rules/timestreamPurge.logic.ts`:
  - `TIMESTREAM_PURGE_SEAT_CHOICE_KIND = 'timestream-purge'`.
  - `queueTimestreamPurge(G, chooserPlayerID, twistCardId)`: push (lazy-init).
  - `heroNameOf(cardId)`: the first two `/` segments, `{set}/{hero}`.
  - `sweepPurgedHeroesFromHq(G): number`: no-op (0) when nothing is Purged; else repeat full HQ passes, KO'ing (`koCard`) every HQ card whose `heroNameOf` matches a Purged card's and refilling its slot (`refillHqSlot`), logging (`'threat'`) `[Go Back in Time] ${card} was KO'd from the HQ: its Hero was Purged from the Timestream.`, until a pass KOs nothing; return the KO count.
  - **Text sources** (every log and label): `${card}` is `formatCardRef(G.cardDisplayData, cardId)`; an option label's name is `resolveCardName(G.cardDisplayData, cardId)` and its cost `String(G.cardStats[cardId]?.cost ?? 0)` (the `buildEscapeHqKoChoice` form). `G.cardDisplayData` carries no Hero Name, so no log prints one or the raw `{set}/{hero}` slug.
  - `purgeHeroFromTimestream(G, cardId, chooserPlayerID): boolean` (shared by the auto and resolved paths; `false`, doing nothing, when the card is not in the HQ): remove the card from its HQ slot, push it to `purgedFromTimestream` (lazy-init), refill the slot, log (`'threat'`) `[Go Back in Time] Player ${chooser} Purged ${card} from the Timestream: every other card of its Hero in the HQ is now KO'd.`, run the sweep, then `applyPileDepletionResourceLoss(G)`.
  - Named helpers: `isPurgedHeroName`, `listHqHeroes`, `isAnotherChoiceOpenOrMatchOver` (the opener's five waits) and `buildTimestreamPurgeChoice`, so each function stays under one screen.
  - `openTimestreamPurgeSeatChoiceIfNeeded(G, events, currentPlayer?)`: no-op when the queue is absent, `G.pendingSeatChoice` is set, `hasAnyPendingChoice(G)` is true, `G.pendingHeroChoice` is set, or `evaluateEndgame(G) !== null`. Then run the sweep and `applyPileDepletionResourceLoss(G)`, and return if `evaluateEndgame(G) !== null` (the pick never lists a Hero the rule is about to KO). Front to back: ≥ 2 HQ Heroes → `parkSeatChoice` a one-seat choice for the entry's chooser (`buildTimestreamPurgeChoice`: options in slot order, each `` { label: `${name} (cost ${cost})`, cardId } `` per the text sources above, `defaultOptionIndex: 0`) and stop; 1 → Purge it and pop; 0 → log (`'neutral'`) `[Go Back in Time] No Hero in the HQ to Purge from the Timestream.` and pop. Delete the queue when empty.
  - `applyTimestreamPurgeResolvedSeatChoice(G, choice)`: Purge the chosen option's `cardId`; pop; delete the queue when empty. If the card is no longer in the HQ, nothing is Purged, it logs (`'neutral'`) `[Go Back in Time] ${card} is no longer in the HQ: the Purge is still owed.`, and the entry stays queued, so the next onMove re-opens it (a mandatory Purge is never lost).
- **onMove** (`game.ts`): `sweepPurgedHeroesFromHq(G)` right BEFORE the escape-procedure opener (so neither HQ pick lists a Hero the rule KOs); then, right after that opener, `openTimestreamPurgeSeatChoiceIfNeeded(G, events, ctx?.currentPlayer)` and `if (G.pendingSeatChoice === undefined) sweepPurgedHeroesFromHq(G);` (an escape auto-KO's refill; never under a parked seat-choice HQ pick, which blocks every move until the next onMove's first sweep). The first sweep is unconditional: an active-player choice that lists HQ cards (`pendingGiveHqHeroChoice`, the put-bottom-HQ choices) re-validates against the live HQ when it resolves, so a KO under it cannot stick a pick, all before the `latchFinalTurnIfDeckExhausted` / `applyPileDepletionResourceLoss` re-runs.
- **Dispatch**: `applySeatChoiceByKind` routes the kind to `applyTimestreamPurgeResolvedSeatChoice` (after the escape HQ-KO branch). **Bot**: `chooseByKind` answers the kind with `indexOfLeastValuableCard` (beside the discard kinds).
- **Drop and guard**: `dropAllPendingPlayerChoices` sets `pendingTimestreamPurges = undefined` (after `pendingSmashDiscards`); `ALL_PENDING_FIELDS` gains `'pendingTimestreamPurges'` in the same place; `operatorSetters.logic.ts` treats a non-empty queue as owed, pinned by a `GATE_BLOCKERS` row `pendingTimestreamPurges is non-empty`.
- **Client heading**: `case 'timestream-purge': return 'Go Back in Time — choose a Hero in the HQ to Purge from the Timestream';`, pinned by one case in `PendingSeatChoicePrompt.test.ts`.

## Scope (In)

- **A)** NEW `rules/timestreamPurge.logic.ts`; `rules/schemeTwistConfig.types.ts` (one union member); `rules/schemeTwistConfigs.ts` (the resolver id); `rules/schemeTwistResolvers.ts` (resolver + registry + notable event); `events/notableEvents.types.ts` + `events/notableEvents.compose.ts` (the resolver key); `types.ts`; `game.ts` (onMove); `moves/seatChoice.resolve.ts`; `simulation/ai.seatChoice.ts`; `endgame/mastermindVictory.logic.ts`; `moves/operatorSetters.logic.ts`.
- **B)** Tests: NEW `rules/timestreamPurge.logic.test.ts` (B1-B16); `endgame/mastermindVictory.logic.test.ts` (one field); `moves/operatorSetters.test.ts` (one row); `rules/schemeTwistConfigs.test.ts` (a named D-pure audit exception); `events/notableEvents.types.test.ts` (the key in both drift lists).
- **C)** `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` (one heading) and its test (one case).
- **D)** Derived artifacts only if their `:check` reports stale after a rebuild.

## Out of Scope

- A board readout of the Purged Heroes (a UIState field).
- Any setup or loss change.
- Mirroring the opener / sweep in the sim runner, PAR aggregator or fixture runner.
- The two remaining Cap 75th schemes.

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/timestreamPurge.logic.ts`, `rules/timestreamPurge.logic.test.ts`: **new**
- `rules/schemeTwistConfig.types.ts` (union member), `rules/schemeTwistConfigs.ts` (resolver id), `rules/schemeTwistResolvers.ts` (resolver + registry + notable event), `types.ts` (entry type + two fields), `game.ts` (onMove sweeps + opener), `moves/seatChoice.resolve.ts` (dispatch), `simulation/ai.seatChoice.ts` (bot), `endgame/mastermindVictory.logic.ts` (drop set), `moves/operatorSetters.logic.ts` (guard), `events/notableEvents.types.ts` + `events/notableEvents.compose.ts` (the resolver key and phrase): modified
- `endgame/mastermindVictory.logic.test.ts` (one field), `moves/operatorSetters.test.ts` (one row), `rules/schemeTwistConfigs.test.ts` (the named D-pure audit exception), `events/notableEvents.types.test.ts` (the key in both drift lists): modified

**Client**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue`, `PendingSeatChoicePrompt.test.ts`: modified

**Derived artifacts (regenerated only if their `:check` reports stale)**
- none expected (§Scaffold results)

That is 19 hand-edited files (6 tests). The WP-827 / WP-828 precedent: a seat-choice consumer wired at fixed sites, plus one resolver.

**Governance:** `docs/ai/DECISIONS.md` (D-24762), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-829-go-back-in-time-purge.md`

## Contract

- `SchemeTwistResolverId` gains `'go-back-in-time'` (contract file; recorded in D-24762).
- New runtime-only `G` fields `pendingTimestreamPurges` and `purgedFromTimestream`, lazily initialized; new seat-choice kind `'timestream-purge'` (no new move).
- No new UIState field; no setup, loss or card-data change.

## Test Contract

`rules/timestreamPurge.logic.test.ts` builds a full G from `data/cards/ca75.json` (the `brainwashTheMilitary.test.ts` precedent) with this scheme and four ca75 Hero decks, resolves Twists through `SCHEME_TWIST_RESOLVERS['go-back-in-time']`, opens owed Purges through the LIVE `turn.onMove`, and resolves picks with `resolveSeatChoice`. Fixtures set `G.hq` / `G.heroDeck` from the match's real Hero cards, grouped by Hero Name.

| # | Input | Expected | Invariant |
|---|---|---|---|
| B1 | the scheme's config | `resolverId 'go-back-in-time'`; the `pile-depleted` heroDeck loss kept | config |
| B2 | one Twist | queue `[{ chooserPlayerID '0', twistCardId }]` | resolver |
| B3 | Twist + onMove, five HQ Heroes | seat choice for seat 0; options = HQ in slot order, labels end "(cost N)" | choice |
| B4 | HQ: Falcon A, X, Falcon B, Y, Z; pick Falcon A | A Purged (not in KO); Falcon B KO'd; no Falcon left in the HQ; both slots refilled; queue gone; Purge log | Purge + sweep |
| B5 | one HQ Hero (Hero Deck non-empty) | Purged with no prompt; then an empty HQ logs the no-op | auto / none |
| B6 | two Twists | the second Purge opens after the first resolves | queue |
| B7 | `G.pendingHeroChoice` set | no choice, queue intact; cleared → the choice opens | wait |
| B8 | the bot | picks the cheapest listed Hero | bot |
| B9 | a Purged name; an HQ Hero of that name; onMove | it is KO'd and its slot refilled | sweep after a move |
| B10 | refills that keep drawing the Purged name | the sweep repeats (3 KOs) until another Hero lands | repeat |
| B11 | a Purge whose sweep empties the Hero Deck | `SCHEME_LOSS` set | loss |
| B12 | nothing Purged | sweep returns 0; the HQ is unchanged; no field is created | no-op |
| B13 | `heroNameOf` | `{set}/{hero}` for each deck | Hero Name |
| B14 | a Purged name; a same-name HQ Hero plus two others; Twist + onMove | that Hero is KO'd before the pick opens; it is not an option; every option is in the HQ | sweep before listing |
| B15 | the picked Hero leaves the HQ before the pick resolves | nothing Purged; the "still owed" log; the Purge stays owed; the next onMove re-opens it | never lost |
| B16 | one Twist | a `schemeTwistResolved` notable event, `resolverKey 'goBackInTime'`, the Twist id | notable event |

Also: `ALL_PENDING_FIELDS` gains the queue, one `GATE_BLOCKERS` row (six setter cases), one client heading case.

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (rules fidelity only, no paid or persuasive surface).

**Determinism preservation:**
- Every helper is a pure function of `G`; options follow HQ slot order; the bot's and the timeout's picks are deterministic; no randomness (refills draw the Hero Deck top).
- Both `G` fields are lazily created, so a match without this scheme is byte-identical; no hash fixture, PAR file or gauntlet config uses it.
- **Replay compat:** the resolver id is read from the static config table at runtime, not stored in `initialState`; a stored match with this scheme replays its Twists through the new resolver. The `D-24119` replay verification of a pre-deploy Go Back in Time match (Twists counted only) would no longer reproduce its final state. This is the WP-823 precedent (a scheme config change), recorded in D-24762.

## Funding Surface Gate

§20 **N/A**: engine and one prompt heading. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Behavior.** B1-B16 pass; the client heading case passes.
2. **Unchanged neighbors.** Every existing scheme, escape-procedure, seat-choice and setter test passes unedited; the only edited existing assertions are the `ALL_PENDING_FIELDS` list, the new `GATE_BLOCKERS` row, the D-pure audit's resolver assertion (a named exception for this scheme, its loss assertions intact), and the two `SCHEME_TWIST_RESOLVER_KEYS` drift lists (ten → eleven).
3. **Revert proofs**, each restored afterwards: (a) config back to `counter-only` fails B1; (b) no onMove opener fails B3-B8, B11, B14, B15; (c) no onMove sweeps fails B9; (d) no sweep inside the Purge fails B4; (e) no loss check inside the Purge fails B11; (f) no `pendingHeroChoice` wait fails B7; (g) a single sweep pass fails B10; (h) no dispatch route fails B4, B6, B11; (i) no bot case fails B8; (j) no setter-guard line fails the six `GATE_BLOCKERS` cases; (k) the old order (no sweep before listing, one unconditional sweep after the opener) fails B14; (l) a resolved path that pops a Purge that Purged nothing fails B15; (m) the wrong notable resolver key fails B16.
4. **Derived gates.** After `pnpm -r build`, every card / coverage `:check` exits 0 (`pnpm cards:check`, `pnpm cards:count-markers:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm gauntlet:loadouts:check`, `pnpm gauntlet:configs:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`).
5. **Client.** `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
6. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; expected delta +22 tests / +4 suites (§Scaffold). A different delta is explained, never tuned.
3. AC 3 revert proofs from `packages/game-engine` with `node --import tsx --test src/rules/timestreamPurge.logic.test.ts` (and `src/moves/operatorSetters.test.ts` for the guard), each restored.
4. Every check in AC 4 → 0 after the rebuild.
5. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
6. `pnpm -r --no-bail test` → 0 fail.
7. `git status --porcelain` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes and the diff is allowlist-only.
- [ ] D-24762 appended to `DECISIONS.md` as Active; 01.6 post-mortem written; `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]` with date, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-867:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, after `/api/version` shows a gitSha that contains the merge, in a 2-player operator (debug) match created after the deploy with Go Back in Time to Slay Heroes' Ancestors as the scheme and seat 1 a bot ally:
  - stage a Scheme Twist on top of the Villain Deck and reveal it: the log says you must Purge, and the prompt lists the HQ Heroes with costs;
  - pick a Hero that has a second card of the same Hero in the HQ (stage one with the setters): the pick leaves the HQ (not to the KO pile), the second is KO'd, both slots refill;
  - on a later move, put another card of that Hero into the HQ (a recruit refill or a setter): it is KO'd after the move.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24762 — go-back-in-time-purge.** It locks:
- the `go-back-in-time` resolver id (a `SchemeTwistResolverId` contract change; it amends D-24595 §Configuration, which recorded this D-pure scheme as `counter-only`), the `goBackInTime` notable-event key, and the module: owed Purges opened after the move (auto with one HQ Hero, a seat choice with two or more, a no-op with none; the escape-opener waits), the mandatory timeout default (the leftmost Hero) and the bot's least-valuable pick;
- Purged ≠ KO'd (the permanent `purgedFromTimestream` list), the Hero Name as the `{set}/{hero}` Hero deck (an inference: the card does not say who chooses or define a Hero Name), the active player as the chooser (an inference), and the sweep after each Purge and each move, before any HQ pick is listed and never under one, repeating until no Purged name is left;
- escape-before-Purge when one move owes both; the chooser is always the active player (the queue is drained within the move's turn, so `parkSeatChoice`'s stage-ride path is never needed);
- replay-compat (a pre-deploy Go Back in Time match no longer replays to the same state, the WP-823 precedent) and the known gaps (no board readout; unmirrored in sims / PAR; same-name Hero decks).

---

## Gate Record

**Pre-flight (01.4) (independent subagent): DO NOT EXECUTE YET → READY after one blocking fix, applied in scope (the conditional-verdict rule; no re-run needed).** Verified every Assumes anchor on `e0f731fc`; the scaffold's 16 files matched the allowlist; Locked Values matched the code; B1-B13 matched the test file one to one; the seatChoice.resolve ↔ module import cycle follows the escape / Diving Block precedent; the printed text (ca75.json) is implemented with two recorded inferences (the active player chooses; Hero Name = the `{set}/{hero}` deck).
- **PF-1 (blocking, fixed):** the onMove order ran the Purge opener and then the sweep, so a choice could list a Hero the sweep KO'd straight after, and picking it silently lost a mandatory Purge (the same sweep could also KO an option of a just-parked escape HQ pick). Now the sweep runs before the escape opener; the Purge opener sweeps after its waits, before listing; the post-opener sweep runs only while no seat choice is parked; a pick whose Hero has gone keeps the Purge owed. Pinned by B14 / B15 with proofs (k) / (l).
- **PF-2..PF-5 (applied):** the Purge log no longer names a "Hero Name" it cannot know ("every other card of its Hero"); the `goBackInTime` notable-event key lands in lockstep (WP-823 precedent; B16, proof (m)); D-24762 amends D-24595 §Configuration; known gap (2) now says the resolver still runs in sims and the queue never drains there.

**Copilot (01.7) (independent subagent): CONFIRM, four non-blocking items, applied.** Verified replay (configs are read at runtime; lazy fields make an in-flight match benign), the onMove sequence and every opener's waits, the drop set, the setter guard (a setter-staged same-name Hero is KO'd by the top sweep, as the live-verify expects), the bot / timeout path and card fidelity for all five ca75 Heroes.
1. FM 26: "never under a parked one" was wider than the code → reworded to seat-choice HQ picks; active-player HQ choices re-validate against the live HQ.
2. FM 18 / 23: escape-before-Purge when one move owes both → recorded as deliberate (Context, D-24762).
3. FM 22: a pick that Purges nothing was silent → a `'neutral'` "still owed" log, locked and asserted in B15.
4. FM 15: the scaffold's `PendingTimestreamPurge` detached the Diving-Block JSDoc → Locked Values place it above that JSDoc.
- Executor notes recorded in D-24762 / known gap (2): the chooser is always the active player (no stage-ride path); an undrained sim queue keeps the operator setters closed there.

**Lint (00.3) (independent subagent): FAIL (three minor) → PASS after fixes.** F1 Assumes 3 named the wrong files for `koCard` / `koFromHq` and left shared helpers unanchored → corrected, new Assumes 4. F2 the log / label text sources were unlocked → locked (`formatCardRef`, `resolveCardName`, `G.cardStats[id].cost`). F3 a broken backtick span → a double-backtick span. Nits applied: Out of Scope split into four bullets; named helpers locked; `pnpm` prefixes on every check; per-file descriptions.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present; 6 ACs; 4 Out-of-Scope items |
| §2 | PASS — full files, ESM / Node 22, 00.6, session protocol, packet-specific rules; Locked Values carry every text source |
| §3 | PASS — 10 anchored Assumes items, a BLOCKED clause |
| §4 | PASS — ARCHITECTURE Principles / Persistence / Layer Boundary, DECISIONS scan list; 00.2 not needed (no card data) |
| §5 | PASS — 19 hand-edited files, each described; the size justified by the WP-827 / WP-828 precedent |
| §6 | PASS — every symbol at its stated anchor |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine logic; the client adds a heading; runtime-only lazy `G` fields |
| §9 | PASS — pnpm / node / git only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test via tsx, local data, no boardgame.io testing import, network or DB |
| §13 | PASS — exact commands; expected delta +22 / +4 |
| §14 | PASS — 6 binary ACs; AC 2 lists every edited existing assertion |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist-only diff; live-verify on `play.legendary-arena.com` |
| §16 | PASS — named helpers for the Purge, the choice builder, the waits and the HQ list |
| §17 | PASS — §1 / §8 / §22 / §23 / §24 / NG-1; conflict, determinism and replay lines |
| §18 | N/A — no forbidden-token grep |
| §19 | N/A — commit-time discipline |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason (no endpoint, no `apps/server` surface) |

EC-867 vs EC-TEMPLATE: PASS; Locked Values byte-identical to the WP; under the 100-line ceiling.

**Verdict:** PASS.
