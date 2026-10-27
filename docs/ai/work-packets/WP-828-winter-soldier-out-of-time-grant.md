# WP-828 — Winter Soldier 2>4: a Hero in your hand gains Man Out of Time this turn (Game Engine + card data + one client heading)

**Status:** Draft 2026-10-24 — pre-flight READY (two text fixes); copilot RISK (all fixes applied); 00.3 PASS — see §Gate Record (EC-866; **D-24761** reserved (#2990)).
**Primary Layer:** Game Engine (`moves/` grant queue + seat choice, `hero/` handler, `moves/coreMoves.impl.ts` play core, `game.ts` onMove / onBegin, `simulation/` bot + turn parity) plus the hero-ability marker input, its regenerated card data, and one arena-client heading string
**Dependencies:** none open. Builds on WP-803 / D-24692 (Man / Woman Out of Time: the `out-of-time` handler, its three guards, `G.outOfTimeCards`, `replayOutOfTimeCards`), WP-684 / D-24501 (`G.pendingSeatChoice`, options carrying `cardId`, the Monarch's Decree pick pattern D-24511), D-24563 (the `[hc:tech]` gate).
**User-Visible Surface:** `play.legendary-arena.com` (any match using the Cap 75th hero Winter Soldier)
**Lane:** Standard (two-session). It adds a handler-bearing `HERO_KEYWORDS` member, two lazily created `G` fields, a seat-choice kind wired through the engine, the bot and the client, a hook in the shared play core, and turn-boundary state (D-24028).
**Arc:** Cap 75th completion, remaining item 6 (auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at `f85aaf4d` (the reserve commit #2990 on top of `07dc027a`). WP-826 (#2986) and WP-827 (#2989), open at drafting, also append `HERO_KEYWORDS` members and edit the same keyword / pin / marker / regenerated files, and WP-827 edits the same seat-choice / onMove / onBegin / drop-set / setter-guard sites. Whichever lands later rebases: counts N → N+1 (handlers M → M+1) govern, rows are kept from both sides, and generated files are regenerated, never hand-merged.

---

## Goal

As a player with Winter Soldier, I want 2>4 to do what it prints: "A Hero in your hand gains [keyword:Man Out of Time] this turn." and "[hc:tech]: Another Hero in your hand gains [keyword:Man Out of Time] this turn." — so the Hero I pick plays this turn and again at the start of my next turn.

Today both lines record an unresolved `man-out-of-time` marker and do nothing.

After this session:
- Playing 2>4 owes one grant per line that fires (the second needs another [hc:tech] card played this turn).
- Each grant is resolved after the play: no Hero in hand → a logged no-op; exactly one → it is granted with no prompt; two or more → you pick one ("Choose a Hero in your hand to gain Man Out of Time this turn"). A Wound or a Bystander is never a choice (the engine's "not a Hero" test).
- The second grant ("Another Hero") never offers a Hero already granted this turn.
- When a granted Hero is played this turn, it is set aside Out of Time after its abilities, exactly as if it printed Man Out of Time: it replays at the start of your next turn and is then discarded (WP-803). A grant on a card you do not play this turn lapses at the turn's end.

## Scaffold (observed at drafting, REQUIRED evidence)

On 2026-10-24 the change was prototyped in the drafting worktree, measured, and reverted. The patch is kept as evidence (`wp828-scaffold.patch` in the drafting session's scratchpad); the executor re-authors from Locked Values and the Test Contract and may consult it.

- **Parser probe.** With `[keyword:grant-out-of-time]` on each line: line 0 builds `effects [{ grant-out-of-time }]` with no condition; line 1 the same under `[{ heroClassMatch, tech }]`; no unresolved marker (the generic `isValidHeroKeyword` arm; `OUT_OF_TIME_LINE_PATTERN` does not match these lines, so 2>4 itself never goes Out of Time).
- **Tests.** The new file (W1-W12; W13-W15 were added at the gates) passed 12 / 12 on first run; engine typecheck clean.
- **Suite.** game-engine 5672 → 5684 / 0 fail (+12 tests, +4 suites); arena-client 2435 → 2436 (the heading case); `pnpm -r --no-bail test` 0 fail in every package; arena-client `typecheck` 0.
- **Revert proofs (observed).** (a) baseline `ca75.json`: W1-W8, W10 fail (W9, a negative case, and the reset cases W11 / W12 pass either way); (b) no `applyCardPlay` call: W8; (c) no onMove opener: W2-W8, W10; (d) no onBegin deletes: W12; (e) no parity deletes: W11; (f) no already-granted exclusion: W4, W5; (g) no `outOfTimePlayedCardIds` skip: W10 (the scaffold had no last-in-play check; under Locked Values W10 passes with (g) removed and W13 is the pin, per AC 3).
- **Derived artifacts (after a rebuild).** `apply-hero-ability-markers.mjs` updated exactly 2 lines. `sim:runtime-observed` went stale: the 13 `man-out-of-time` hollow observations (all 2>4) leave the sweep (7793 → 7780 observations, 79 → 78 mechanics, 0 dropped), and the dashboard `useInPlayCoverage` totalObs pin moves (next bullet). The hero ledger, effect index and card-mechanics stayed current: the ledger's `MECHANIC_FAMILY_RULES` folds `grant-out-of-time` into its existing Winter Soldier `out-of-time` row (already executable through Bionic Arm / Sniper Nest), so no row changes and no provenance row is read (none is added). Only that script's stale comment ("2>4 stays a runtime hollow") is corrected.
- **Dashboard.** totalObs 8714 → 8701 (-13, equal to the feed fall); resolvedObs 1091 and 12.5% unchanged; `test:coverage` 584 / 0, `typecheck` 0, `format:check` 0.
- These were measured at the #2990 base and are expectations, not targets; on a moved base the observed result governs.

## User-Visible Impact

- Winter Soldier's 2>4 now does something: one hand Hero (two with [hc:tech]) is set aside Out of Time when played this turn and plays again next turn.
- With two or more choices the prompt lists the hand Heroes by name.
- The log reads "Player 0's <card> gains Man Out of Time this turn (2>4)." and, on play, the WP-803 set-aside line.
- Every other card is unchanged.

---

## Assumes

1. **Out of Time** (`hero/heroEffects.execute.ts` on the baseline): `heroEffectOutOfTime` (L5286) runs three guards (L5294 once only, L5303 a copy not in play, L5309 not the last played card), then moves the card from `inPlay` into `G.outOfTimeCards[playerID]` and records it in `G.turnEconomy.outOfTimePlayedCardIds`. It is registered as `'out-of-time'` (L6404), is in `NO_MAGNITUDE_KEYWORDS`, and is reachable through the exported `executeSingleEffect` (L6480). `replayOutOfTimeCards` (`moves/outOfTime.logic.ts` L46) replays and discards set-aside cards on the next start → main advance.
2. **Play core**: `applyCardPlay` (`moves/coreMoves.impl.ts` L285) appends the card to `inPlay`, adds its economy and fires `executeHeroEffects` last (L331). It is the shared core for hand play and the Out of Time replay.
3. **Parser** (`setup/heroAbility.setup.ts`): `OUT_OF_TIME_LINE_PATTERN` (L141) matches only a bare "[gate]: [keyword:Man Out of Time]" line; the generic `isValidHeroKeyword` arm pushes any `HERO_KEYWORDS` member. The two 2>4 lines (`data/cards/ca75.json` L516-517) are unmarked.
4. **Seat choice**: `SeatChoiceOption.cardId` (`types.ts` L1360) carries a hand card for a pick; `applyMonarchsDiscard` (`moves/seatChoiceTactics.ts` L248) reads it back by `optionIndex`. `applySeatChoiceByKind` dispatches by kind; `chooseByKind` (`simulation/ai.seatChoice.ts` L97) answers for a bot. `parkSeatChoice` admits the active seat with no stage ride.
5. **Wave plumbing and turn boundary**: `game.ts` turn.onMove opens pending seat-choice queues after every move (the Diving Block opener at L911); onBegin deletes per-turn flags with guarded deletes, mirrored by `applyOnBeginParity`; the sim runner, PAR aggregator and fixture runner mirror only the return-on-discard and escape-procedure openers; the Diving Block opener (and so this one) stays unmirrored. The escape opener (`villainDeck/villainEscapeProcedure.ts` L283-290) waits on `hasAnyPendingChoice(G)` (`moves/phaseCard.ts`), `G.pendingHeroChoice` and `evaluateEndgame(G) !== null`.
6. **Keyword lockstep** (auto-memory `reference_hero_keyword_lockstep_sites`): `HERO_KEYWORDS` 78 (last `'out-of-time'`), `HERO_EFFECT_HANDLERS` 61, `NO_MAGNITUDE_KEYWORDS`, `HANDLED_KEYWORDS`; pins in `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts` (78) and `hero/heroEffects.execute.test.ts` (61, two asserts).
7. **Drop set and guard**: `dropAllPendingPlayerChoices` (`endgame/mastermindVictory.logic.ts`, `pendingOptionalPutBottomHQ` at L107) and its `ALL_PENDING_FIELDS` drift test; `operatorSetters.logic.ts` treats an owed queue as an open choice.
8. **Client**: `PendingSeatChoicePrompt.vue` picks its heading by `kind` and renders option labels; its test has per-kind heading cases.
9. **Ledger fold**: `scripts/hero-mechanic-ledger.mjs` `MECHANIC_FAMILY_RULES` folds any `…out-of-time` token into the `out-of-time` mechanic, so `grant-out-of-time` lands in Winter Soldier's existing `out-of-time` row and needs no `mechanic-provenance.json` row; its comment at L162-166 still says 2>4 "stays a runtime hollow".
10. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.
11. **Marker, label and pin anchors**: `VALID_TOKEN_PATTERN` (`scripts/convert-cards/apply-hero-ability-markers.mjs` L123) rejects `[keyword:grant-out-of-time]`; the `ca75` block of `hero-ability-markers.json` ends with the Agent X-13 `paramilitary-ops` entry; `resolveCardName` (`log/logDisplay.ts` L29) and `WOUND_EXT_ID` (`setup/pilesInit.ts` L25) supply the option label and the Wound id; `apps/dashboard/src/composables/useInPlayCoverage.test.ts` pins `totalObs` 8714 / `resolvedObs` 1091 (L591-592); `moves/operatorSetters.test.ts` lists its `GATE_BLOCKERS` (the escape-effect row is last); `setup/heroAbility.setup.ts` L139-140 and L434-436 describe 2>4 as unresolved.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why queue the grants instead of choosing inside the play.** Both 2>4 lines run in the same `executeHeroEffects` call, and the second must exclude the first's pick ("Another Hero"). Each line only queues an owed grant; the onMove opener resolves them one at a time after the play, so the exclusion is exact. This is the WP-827 / Diving Block opener shape.
- **Why a seat choice with `cardId` options, not a new pending-choice type.** The WP-684 seat choice already carries a hand pick (Monarch's Decree, D-24511), its prompt, its move (`resolveSeatChoice`), the bot hook and the projection. A new `pending*` queue would add a move, its guards and its sim dispatch for no gain.
- **Why the set-aside reuses the `out-of-time` handler.** Granted Man Out of Time is the printed keyword on another card; calling the WP-803 handler through `executeSingleEffect` keeps all three rules-v23 guards (once only, never a copy). It runs at the end of `applyCardPlay`, after the card's abilities, where the printed keyword's own hook would run. A card that already went Out of Time (its own keyword, or the replay) is skipped silently, so it is never logged twice.
- **Why auto-grant with one choice, and why the timeout default grants the first Hero.** "A Hero in your hand gains" is mandatory, not "may"; one eligible Hero is no choice, and an absent seat still owes the grant.
- **Why the bot picks the highest-cost Hero.** The granted Hero plays twice; cost is the engine's existing value proxy (first listed on a tie).
- **Known gaps kept out of scope.** (1) A split card chosen for a grant goes through `splitFaceChoice.resolve.ts`, which calls `executeHeroEffects` directly, not `applyCardPlay`, so the grant lapses there. (2) In sims and PAR the onMove opener is unmirrored, so owed grants lapse at the turn boundary (as Diving Block's interceptions do). (3) The S.H.I.E.L.D. Agent / Trooper starters share one id each, so granting one grants that id: the first copy played goes Out of Time, a second can never be "Another Hero". (4) A granted card whose own ability moves it out of play (Transform, a self-KO) is skipped silently. (5) A granted card whose ability opens a choice is set aside when `applyCardPlay` ends, before that choice resolves; no resolver reads its source card's presence in `inPlay`.
- **Superseded text.** D-24692 and two `setup/heroAbility.setup.ts` comments say 2>4 "stays a runtime hollow"; D-24761 supersedes that clause and this packet corrects the two comments (comment-only).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 (determinism), #2 (engine owns truth; the client renders labels), §Persistence Boundaries (runtime-only `G` fields, lazily initialized), §Layer Boundary (the client adds a heading string; `.claude/rules/architecture.md`).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (`[keyword:…]`).
- `docs/legendary-universal-rules-v23.md` §"Man (and Woman) Out of Time" (L1667-1694).
- `docs/ai/DECISIONS.md`: scan D-24692, D-24501, D-24511, D-24563 before coding; and D-24760 (WP-827, PR #2989; read it there if not yet merged), the sibling opener.
- User memory: `reference_hero_keyword_lockstep_sites`, `reference_three_bgio_bypassing_turn_loops`, `project_cap75_completion_arc` (the WP-827 lesson: drive the LIVE turn.onMove / onBegin).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness, no I/O, no registry access at runtime. Moves and helpers never throw.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24761) before coding. One WP per session.

**Packet-specific:**
- **Card data is generated.** Edit `hero-ability-markers.json`, run `node scripts/convert-cards/apply-hero-ability-markers.mjs`, commit its output. Never hand-edit `data/cards/ca75.json`.
- **Out of Time is unchanged** for cards that print it: WP-803's tests pass unedited; the set-aside path is the existing handler.
- **Runtime-only, lazily initialized.** Both new `G` fields are absent until first used and deleted at turn start in both turn loops.
- **Tests drive the live wiring.** Owed grants are opened through `LegendaryGame.phases.play.turn.onMove`, and the turn reset through the live `turn.onBegin` and `applyOnBeginParity`.

## Locked Values

- **Keyword**: `'grant-out-of-time'`, appended as the last member of the `HeroKeyword` union and `HERO_KEYWORDS` (N → N+1; 78 → 79 at baseline), in `HANDLED_KEYWORDS`, in `NO_MAGNITUDE_KEYWORDS`, and in `HERO_EFFECT_HANDLERS` (M → M+1; 61 → 62) as `heroEffectGrantOutOfTime`, which calls `queueOutOfTimeGrant(G, playerID, cardId)`.
- **Types** (`types.ts`): `PendingOutOfTimeGrant { playerID: string; sourceCardId: CardExtId }`; `LegendaryGameState.pendingOutOfTimeGrants?: PendingOutOfTimeGrant[] | undefined`; `LegendaryGameState.outOfTimeGrantedThisTurn?: CardExtId[] | undefined`.
- **Module** `moves/outOfTimeGrant.logic.ts`:
  - `OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND = 'out-of-time-grant'`.
  - `queueOutOfTimeGrant(G, playerID, sourceCardId)`: push `{ playerID, sourceCardId }` (lazy-init).
  - Eligible = the player's hand cards in hand order, excluding `WOUND_EXT_ID` and `BYSTANDER_EXT_ID` (the engine's "not a Hero" discriminant), cards in `outOfTimeGrantedThisTurn`, and duplicates.
  - `openOutOfTimeGrantSeatChoiceIfNeeded(G, events, currentPlayer?)`: no-op when the queue is absent, `G.pendingSeatChoice` is set, `hasAnyPendingChoice(G)` is true, `G.pendingHeroChoice` is set, or `evaluateEndgame(G) !== null` (the escape-opener precedent). Front to back: ≥ 2 eligible → `parkSeatChoice` a one-seat choice (options `{ label: resolveCardName(…), cardId }` in hand order, `defaultOptionIndex: 0`) and stop; exactly 1 → grant it and pop; 0 → log (`'neutral'`) `Player ${playerID} has no Hero left in hand to gain Man Out of Time (${source}).` and pop. Delete the queue when empty. The eligible collector and the grant are named helpers.
  - Grant: push the card to `outOfTimeGrantedThisTurn` (lazy-init) and log (`'applied'`) `Player ${playerID}'s ${card} gains Man Out of Time this turn (${source}).`
  - `applyOutOfTimeGrantResolvedSeatChoice(G, choice)`: the chosen option's `cardId`, if still in the seat's hand, is granted; pop the front entry; delete the queue when empty.
  - `applyGrantedOutOfTime(G, context, playerID, cardId)`: when the card is in `outOfTimeGrantedThisTurn`, not in `turnEconomy.outOfTimePlayedCardIds`, and still the last card of the player's `inPlay`, call `executeSingleEffect(G, context, playerID, cardId, { type: 'out-of-time' })`; otherwise return silently.
- **Play core**: `applyCardPlay` calls `applyGrantedOutOfTime(G, context, playerID, cardId)` right after `executeHeroEffects`.
- **onMove**: `openOutOfTimeGrantSeatChoiceIfNeeded(G, events, ctx?.currentPlayer)` right after the Diving Block opener (after the Flying Shield Block opener if WP-827 landed first). **onBegin** and **`applyOnBeginParity`**: guarded deletes of `outOfTimeGrantedThisTurn` and `pendingOutOfTimeGrants`.
- **Dispatch**: `applySeatChoiceByKind` routes the kind to `applyOutOfTimeGrantResolvedSeatChoice`. **Bot**: `chooseByKind` returns the index of the option whose `cardId` has the highest `cardStats` cost (first on a tie).
- **Drop and guard**: `dropAllPendingPlayerChoices` sets `pendingOutOfTimeGrants = undefined` (after `pendingOptionalPutBottomHQ`); `ALL_PENDING_FIELDS` gains `'pendingOutOfTimeGrants'` in the same place; `operatorSetters.logic.ts` treats a non-empty queue as owed, pinned by a `GATE_BLOCKERS` row `pendingOutOfTimeGrants is non-empty` in `moves/operatorSetters.test.ts`.
- **Comments**: `setup/heroAbility.setup.ts` L139-140 and L434-436 say the 2>4 lines resolve `grant-out-of-time` (from `[keyword:grant-out-of-time]`), not that the probe still flags them.
- **Client heading**: `case 'out-of-time-grant': return 'Choose a Hero in your hand to gain Man Out of Time this turn';`, pinned by one case in `PendingSeatChoicePrompt.test.ts`.
- **Marker**: `VALID_TOKEN_PATTERN` gains `^\[keyword:grant-out-of-time\]$`; `hero-ability-markers.json` `ca75` gains `{ "heroSlug": "winter-soldier", "cardSlug": "2-4", "abilityIndex": 0, "markupToken": "[keyword:grant-out-of-time]" }` and the same with `abilityIndex: 1`, after the last Paramilitary Ops entry (after the other packets' rows if they landed first).
- **Ledger comment**: the `BY_HOOK_KEYWORDS` comment in `scripts/hero-mechanic-ledger.mjs` says 2>4's grant lines resolve `grant-out-of-time`, folded into the same `out-of-time` row (replacing "2>4 stays a runtime hollow"). No `mechanic-provenance.json` row.
- **Rebase**: over WP-826 / WP-827, `ca75.json`, the marker map and the derived ledgers are regenerated through the regen chain, never hand-merged.

## Scope (In)

- **A)** NEW `moves/outOfTimeGrant.logic.ts`; `types.ts`; `hero/heroEffects.execute.ts` (handler, sets, registry); `moves/coreMoves.impl.ts` (one call); `game.ts`; `simulation/onBeginParity.ts`; `moves/seatChoice.resolve.ts`; `simulation/ai.seatChoice.ts`; `endgame/mastermindVictory.logic.ts`; `moves/operatorSetters.logic.ts`; `rules/heroKeywords.ts`.
- **B)** Tests: NEW `moves/outOfTimeGrant.logic.test.ts` (W1-W15); `endgame/mastermindVictory.logic.test.ts` (one field); `moves/operatorSetters.test.ts` (one `GATE_BLOCKERS` row); the four count-pin files (five asserts).
- **C)** `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` (one heading) and its test (one case).
- **D)** Marker validator + marker map → regenerated `data/cards/ca75.json`; the stale comments in `scripts/hero-mechanic-ledger.mjs` and `setup/heroAbility.setup.ts` (comment-only).
- **E)** Regenerated derived artifacts that their `:check` reports stale (after a rebuild), and the dashboard totalObs pin if the runtime-observed feed moves.

## Out of Scope

- A split card chosen for a grant (the split-face play path; Context known gap).
- Mirroring the onMove opener in the sim runner, PAR aggregator or fixture runner.
- The co-printed "gains [keyword:Teleport] / [keyword:Dodge] / [keyword:Switcheroo]" hand-grant lines on other cards.
- The three remaining Cap 75th schemes.

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `moves/outOfTimeGrant.logic.ts`, `moves/outOfTimeGrant.logic.test.ts`: **new**
- `types.ts`, `hero/heroEffects.execute.ts`, `moves/coreMoves.impl.ts`, `game.ts`, `simulation/onBeginParity.ts`, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts`, `endgame/mastermindVictory.logic.ts`, `moves/operatorSetters.logic.ts`, `rules/heroKeywords.ts`, `setup/heroAbility.setup.ts` (comments only): modified
- `endgame/mastermindVictory.logic.test.ts`, `moves/operatorSetters.test.ts`, `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`: modified

**Client**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue`, `PendingSeatChoicePrompt.test.ts`: modified

**Card data + scripts**
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`: modified
- `scripts/hero-mechanic-ledger.mjs`: modified (one comment)
- `data/cards/ca75.json` — regenerated

**Derived artifacts (regenerated only if their `:check` reports stale)**
- `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv` — regenerated
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` — regenerated
- `docs/ai/coverage/runtime-observed-hollows.json` — regenerated; `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: totalObs re-pin (the scaffold saw the feed move)

That is 25 hand-edited files (9 tests): 12 engine source (1 new), 6 engine tests + 1 new test, 2 client, 3 scripts, 1 dashboard test. The WP-827 precedent: a seat-choice consumer is wired at fixed sites (onMove, onBegin + parity, dispatch, bot, drop set, setter guard), each a few lines, plus the keyword lockstep pins and one play-core call.

**Governance:** `docs/ai/DECISIONS.md` (D-24761), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-828-winter-soldier-out-of-time-grant.md`

## Contract

- New `HeroKeyword` `'grant-out-of-time'` (closed canonical set, recorded in D-24761) with a play-time handler.
- New runtime-only `G` fields `pendingOutOfTimeGrants` and `outOfTimeGrantedThisTurn`, lazily initialized; new seat-choice kind `'out-of-time-grant'` (no new move).
- `applyCardPlay` gains one trailing call; behavior is unchanged for any card not granted this turn.
- No new UIState field.

## Test Contract

`moves/outOfTimeGrant.logic.test.ts` builds the Winter Soldier and Captain America 1941 hooks from `data/cards/ca75.json` onto a `buildInitialGameState` match, plays cards through the real `playCard` move, opens owed grants through the LIVE `turn.onMove`, resolves picks with `resolveSeatChoice`, and checks the reset through the live `turn.onBegin` and `applyOnBeginParity`. Hand Heroes are test ids with `cardStats` costs (A 2, B 6, C 4); a tech ally played first unlocks line 1.

| # | Input | Expected | Invariant |
|---|---|---|---|
| W1 | 2>4 hooks | two hooks, `effects [{ grant-out-of-time }]`; line 1 under `heroClassMatch tech`; no unresolved marker | parse |
| W2 | hand 2>4, A, a Wound; play 2>4 | no prompt; A granted; queue gone; grant log | auto with one; a Wound is not a Hero |
| W3 | hand 2>4, A, B | seat choice for seat 0, options `[A, B]`; pick 1 → B granted | choice |
| W4 | tech ally played; hand 2>4, A, B, C | two owed; first options `[A, B, C]`; pick A → second options `[B, C]`; pick → `[A, C]` granted | "Another Hero" |
| W5 | tech ally played; hand 2>4, A | A granted; the second logs "has no Hero left in hand" | |
| W6 | hand 2>4, a Wound, a Bystander | nothing granted; the "has no Hero left in hand" line | not a Hero |
| W7 | hand 2>4, A, B, C | the bot picks B (cost 6) | bot |
| W8 | grant A, then play A | A in `outOfTimeCards['0']`, not in play; in `outOfTimePlayedCardIds` | set-aside |
| W9 | grant A, play C | C stays in play | only the granted card |
| W10 | grant Storm the Beachhead (prints Man Out of Time), play it | set aside once; exactly one set-aside line | no double |
| W11 | `applyOnBeginParity` | both fields deleted; no key created when unset | turn reset (rebuilt loops) |
| W12 | live `turn.onBegin` | both fields deleted; no key created when unset | turn reset (live) |
| W13 | hand 2>4, S.H.I.E.L.D. Agent, S.H.I.E.L.D. Agent (one shared id); play 2>4, then both Agents | the Agent id auto-granted (deduped); the first Agent set aside, the second stays in play; no "not set aside" line | shared-id skip |
| W14 | `outOfTimeGrantedThisTurn` [A], `inPlay` [A, other]; call `applyGrantedOutOfTime` for A | A stays in play; no "a copy can't use Out of Time" line | last-in-play check |
| W15 | hand 2>4, A, B, with `G.pendingHeroChoice` set; play 2>4 and run onMove | no seat choice, queue intact; clear `pendingHeroChoice`, onMove → the choice opens. Repeat with a non-seat `hasAnyPendingChoice` member (`pendingDoOverChoices`, the `GATE_BLOCKERS` precedent) in place of `pendingHeroChoice`: same wait, same open on clear | freeze-guard wait |

Also: `ALL_PENDING_FIELDS` gains the queue, one `GATE_BLOCKERS` row (the setter guard), the four count-pin files (five asserts) move by one, and one client heading case.

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity), §10 (content as data), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (rules fidelity only, no paid or persuasive surface).

**Determinism preservation:**
- Every helper is a pure function of `G`; options follow hand order; the bot's pick is deterministic; no randomness.
- Both `G` fields are lazily created and deleted at turn start, so a match without Winter Soldier is byte-identical; hash fixtures play no ca75 hero.
- **Replay compat:** a stored match replays from its bgio `initialState` (setup-time hooks), so pre-deploy matches have no `grant-out-of-time` hook. Only matches created after the deploy carry it.
- No PAR seed or profile artifact and no gauntlet config contains a ca75 hero, so none is regenerated.

## Funding Surface Gate

§20 **N/A**: engine, card data and one prompt heading. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Behavior.** W1-W15 pass on the regenerated `data/cards/ca75.json`; the client heading case passes.
2. **Unchanged neighbors.** Every existing Out of Time, seat-choice, play and parity test passes unedited; the only edited existing assertions are the four count-pin files (five asserts), the `ALL_PENDING_FIELDS` list, the new `GATE_BLOCKERS` row and the dashboard `totalObs` pin (AC 6).
3. **Revert proofs**, each restored afterwards: (a) the baseline `data/cards/ca75.json` fails W1-W8, W10; (b) the `applyCardPlay` call removed fails W8; (c) the `game.ts` onMove opener removed fails W2-W8, W10; (d) the onBegin deletes removed fail W12; (e) the `applyOnBeginParity` deletes removed fail W11; (f) the already-granted exclusion removed fails W4, W5; (g) the `outOfTimePlayedCardIds` skip removed fails W13; (h) the `operatorSetters.logic.ts` line removed fails the new `GATE_BLOCKERS` row; (i) the last-in-play check removed fails W14; (j) either wait (`pendingHeroChoice`, or `hasAnyPendingChoice`), removed alone, fails W15; (k) the `applySeatChoiceByKind` route removed fails W3, W4; (l) the `chooseByKind` case removed fails W7.
4. **Card data.** `apply-hero-ability-markers.mjs` reports exactly 2 lines updated; `pnpm cards:check` and `pnpm cards:count-markers:check` exit 0.
5. **Derived gates.** After `pnpm -r build`: `pnpm ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `gauntlet:loadouts:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0 on the committed tree.
6. **Dashboard**: after `prebuild:coverage`, `test:coverage` passes with only `totalObs` changed by the feed's `summary.totalObservations` delta; `resolvedObs` / `percentResolved` byte-unchanged, else STOP; the feed's `distinctMechanics` falls by exactly one (`man-out-of-time`), else STOP; dashboard `typecheck` and `format:check` exit 0.
7. **Client.** `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
8. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; expected delta +21 tests / +4 suites: 15 from the new file (W1-W15) and 6 from the `GATE_BLOCKERS` row (one per setter case). A different delta is explained, never tuned.
3. AC 3 revert proofs from `packages/game-engine` with `node --import tsx --test src/moves/outOfTimeGrant.logic.test.ts`, each restored (for (a), `git restore --source "$(git merge-base HEAD origin/main)" -- data/cards/ca75.json`, then re-run `node scripts/convert-cards/apply-hero-ability-markers.mjs` and confirm `git diff --stat -- data/cards/ca75.json` matches the pre-proof state).
4. Regen chain, each step only if its `:check` reports stale after the prior step: `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `pnpm -r build` → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → `pnpm sim:runtime-observed`. Then each check in AC 4-5 → 0, and AC 6 if the feed moved.
4b. `sim:runtime-observed` regenerates (the scaffold saw it): `pnpm --filter @legendary-arena/dashboard run prebuild:coverage`, re-pin `totalObs` (expected 8714 → 8701), then `pnpm --filter @legendary-arena/dashboard run test:coverage`, `pnpm --filter @legendary-arena/dashboard typecheck` and `pnpm --filter @legendary-arena/dashboard run format:check` → 0; `resolvedObs` stays 1091.
5. `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
6. `pnpm -r --no-bail test` → 0 fail.
7. `git status --porcelain` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes and the diff is allowlist-only.
- [ ] D-24761 appended to `DECISIONS.md` as Active; 01.6 post-mortem written; `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]` with date, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-866:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, after `/api/version` shows a gitSha that contains the merge, in a 2-player operator (debug) match created after the deploy, seat 1 a bot ally, Winter Soldier in the loadout:
  - stage 2>4 and two other Heroes in your hand; play 2>4: the prompt "Choose a Hero in your hand to gain Man Out of Time this turn" lists both; pick one; the log says it gains Man Out of Time;
  - play the picked Hero: after its abilities it is set aside ("set … aside Out of Time"); at the start of your next turn it is played again and then discarded;
  - with a [hc:tech] card played first, 2>4 asks twice and the second prompt does not list the first pick.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24761 — winter-soldier-out-of-time-grant.** It locks:
- the keyword (play-time handler that only queues) and the module: owed grants opened by the onMove opener (auto with one Hero, a seat choice with two or more, a logged no-op with none; a Wound never eligible; already-granted Heroes excluded for "Another Hero"), the mandatory timeout default (first listed Hero), the bot's highest-cost pick;
- the turn-scoped grant list and the set-aside at the end of `applyCardPlay` through the WP-803 handler and its guards, skipped silently for a card already Out of Time;
- the resets in both turn loops; replay-compat;
- the known gaps (split cards; unmirrored in sims / PAR; one shared id per starter; a granted card that leaves play by its own ability is skipped silently; a granted card whose ability opens a choice is set aside before that choice resolves) and that it supersedes D-24692's "2>4 stays a runtime hollow" clause.

---

## Gate Record

**Pre-flight (01.4) (independent subagent): READY TO EXECUTE after two text fixes, applied (no re-run needed, per the reviewer).** Verified every Assumes anchor on `f85aaf4d`; dependencies Done (WP-803, WP-684, WP-694, WP-741); the `executeHeroEffects` call sites (only `applyCardPlay` reaches the set-aside; copies never do, matching rules v23 L1689); the server bot-ally driver and the seat-prompt redaction are kind-agnostic; `sim:coverage --check` only fails on a rise; no ca75 hero in PAR, gauntlet or sweep-hero fixtures.
- **PS-1 (fixed):** Assumes 5 said the rebuilt loops mirror no onMove openers; they mirror return-on-discard and escape-procedure, not Diving Block's (nor this one).
- **PS-2 (fixed):** D-24760 cited as living in PR #2989 until it merges.
- **RS-1..RS-9 (applied):** the opener waits on `hasAnyPendingChoice(G)`, `G.pendingHeroChoice` and `evaluateEndgame(G)` (the escape-opener precedent); a `GATE_BLOCKERS` row pins the setter guard; the two stale `setup/heroAbility.setup.ts` comments and D-24692's "2>4 stays a runtime hollow" clause are superseded; a granted card no longer last in play is skipped silently; shared starter ids and split cards recorded as known gaps; file counts and "five asserts" corrected; the no-op log reads "has no Hero left in hand".

**Copilot (01.7) (independent subagent): round 1 RISK (HOLD), seven fixes, all applied; round 2 RISK, two fixes, applied (CONFIRM once applied, per the reviewer; no round 3). Pre-flight stands.** Round 1 clean on FM 1-5, 7-10, 12-17, 19-25, 27-30 (the grant is mandatory and the timeout default grants; "Another Hero" is enforced; a granted card discarded, KO'd or never played lapses harmlessly; the turn-2 replay is safe twice over; hero ids are per copy; no resolver reads its source card in play; hashes / PAR / gates unaffected).
1. FM 11: the new last-in-play check made proof (g) unachievable and neither skip had a test → W13 (shared Agent id) and W14 (last-in-play) with proofs (g) / (i).
2. FM 11 / 18: the opener's waits had no test → W15 with proof (j).
3. FM 11: dispatch and bot wiring had no proof → (k) / (l).
4. FM 26: W5 / W6 still quoted the old log → "has no Hero left in hand".
5. FM 26 / 27: "not a Hero" narrower than the engine's precedent → Wounds and Bystanders excluded.
6. FM 26: the set-aside timing for a granted card that opens a choice → known gap (5).
7. FM 11 / 12: the test delta → +21 / +4; the source count → 12 (1 new).

Round 2 (all seven verified in both files; Locked Values byte-identical; +21 / +4 confirmed against `SETTER_CASES` (6); W13-W15 checked achievable against `src`, and `hasAnyPendingChoice` does not cover `pendingHeroChoice`, so both waits are needed):
1. FM 11: proof (j) pinned only the `pendingHeroChoice` half → W15 repeats with `pendingDoOverChoices`; (j) is either wait removed alone.
2. FM 26: the scaffold record's (g) → W10 annotated (W13 is the pin under Locked Values).

**Lint (00.3) (independent subagent): FAIL → PASS after three WP fixes (Assumes 11 anchors; AC 2 lists the dashboard pin; Verification 4b gives the dashboard commands) and one EC fix (full `pnpm --filter … typecheck` commands), applied, plus advisories (counts, D-24760 location, named helpers, the line-0 log wording, shared starter ids).

**Final gate state:** pre-flight READY TO EXECUTE · copilot RISK (every concern fixed and recorded above) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present and non-empty; 8 ACs; 4 Out-of-Scope items |
| §2 | PASS — full files, no diffs, ESM / Node 22, 00.6, session protocol, packet-specific rules; separate Locked Values |
| §3 | PASS — 11 anchored Assumes items (marker, label and pin anchors added), the WP-826 / WP-827 rebase rule, a BLOCKED clause |
| §4 | PASS — 00.2 §5, ARCHITECTURE Principles / Persistence / Layer Boundary, rules v23 L1667, DECISIONS scan list |
| §5 | PASS — every file listed; regenerated files tagged; the size justified |
| §6 | PASS — every symbol at its stated anchor; `executeSingleEffect`'s signature matches |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine logic; the client adds a heading; the bot reads `G.cardStats`; runtime-only lazy `G` fields |
| §9 | PASS — pnpm / node / git only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test via tsx, local data, no boardgame.io testing import, network or DB |
| §13 | PASS — exact commands, including the dashboard path (Verification 4b) |
| §14 | PASS — 8 binary ACs; AC 2 lists every edited existing assertion |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist-only diff; live-verify on `play.legendary-arena.com` |
| §16 | PASS — named helpers for the eligible collector and the grant |
| §17 | PASS — §1 / §10 / §8 / §22 / §23 / §24 / NG-1; conflict, determinism and replay lines |
| §18 | N/A — no forbidden-token grep |
| §19 | N/A — commit-time discipline |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |

EC-866 vs EC-TEMPLATE: FAIL → PASS after the typecheck-command fix; Locked Values byte-identical to the WP; under the 100-line ceiling.

**Verdict:** PASS.
