# WP-830 — The Unbreakable Enigma Code: the face-down code, the paid peek and the Mastermind guess (Game Engine + client)

**Status:** Draft 2026-10-24 — gates pending (EC-868; **D-24763** reserved (#2996)).
**Primary Layer:** Game Engine (`rules/` scheme resolver + new Enigma module, `moves/` fightVillain / fightMastermind / dispatch / setter guard, `game.ts` onMove, `simulation/` bot, `ui/` projection) plus arena-client (a code readout, a guess picker, one heading)
**Dependencies:** none open. Builds on WP-763 / D-24595 (this scheme's printed Twist-6 loss, already correct), WP-793 / D-24656 (an owed choice opened after the move, and its waits), WP-684 / D-24501 (`G.pendingSeatChoice`), WP-819 / D-24753 (a paid "whenever you fight a Villain" option), WP-701 / D-24520 and WP-696 / D-24513 (the end-of-turn cleanup and the queued extra turn), WP-728 / D-24549 (a scheme-only `UIState.scheme` field passed through the audience filter), WP-823 / D-24756 (a scheme-specific resolver id, the contract precedent).
**User-Visible Surface:** `play.legendary-arena.com` (any match with the scheme The Unbreakable Enigma Code)
**Lane:** Standard (two-session). It adds a member to the `SchemeTwistResolverId` contract union, an optional `fightMastermind` argument, four lazily created `G` fields, a seat-choice kind and a per-audience `UIState` field (D-24028).
**Arc:** Cap 75th completion, remaining item 8 (auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at the reserve commit #2996 (`18d5ee7d`). WP-826 (#2986), WP-827 (#2989), WP-828 (#2992) and WP-829 (#2995), open at drafting, touch the same seat-choice dispatch / bot / drop-set / setter-guard / client-heading / notable-key / D-audit sites and the governance index files; whichever lands later rebases, keeping both sides' rows (the resolver-key drift lists then count twelve).

---

## Goal

As a player facing The Unbreakable Enigma Code, I want the scheme to work as printed: "Twists 1-5: Put a card from the Hero Deck face down next to the scheme as part of the 'Enigma Code.' Mix up those cards face-down." and "Special Rules: Whenever you fight a Villain, you may pay 1 [recruit] to look at one of the face-down Enigma Cards. When you fight the Mastermind, first guess the color of each Enigma card, and then reveal them. If you guessed them right, fight the Mastermind as normal. If not, your turn ends, and mix up the Enigma cards face-down."

Today the scheme is `counter-only`: Twists only count toward its loss ("Twist 6: Evil Wins!", already right), and the Mastermind is fought freely.

- Each of Twists 1-5 puts the top Hero Deck card face down into the Enigma Code and mixes the code. Nobody knows any card after a mix.
- After you fight a Villain, you are offered: pay 1 Recruit to look at one Enigma card you have not seen (or don't look). Only you see it; the log says which card number you looked at.
- When you fight the Mastermind with a code, you first guess each card's color (Strength, Instinct, Covert, Tech, Ranged, or Grey for a card with no Hero Class). Right: the code is revealed to everyone and the fight goes ahead. Wrong: no fight, your turn ends (normal cleanup), and the code is mixed face down.

## Scaffold (observed at drafting, REQUIRED evidence)

A working implementation was built and run on the baseline to measure these numbers, then reverted before the drafting commit (the patch is evidence only).

- **Tests.** The new engine file (E1-E19) passes 19 / 19 over the shipped `ca75.json`, the real `fightVillain` / `fightMastermind` moves and the LIVE `turn.onMove`. Engine and client typecheck clean.
- **Suite.** game-engine 5672 → 5697 / 0 fail (+25 tests: 19 in the new file, 6 from the `GATE_BLOCKERS` row; +4 suites); arena-client 2435 → 2446 / 0 fail (+11); `pnpm -r --no-bail test` 0 fail in every package; arena-client `typecheck` 0.
- **One existing assertion moved.** `rules/schemeTwistConfigs.test.ts`' WP-763 printed-count audit asserted `resolverId 'counter-only'` for all 27 printed-N schemes; this scheme's Twist now acts, so the audit gains a named one-entry exception (`AUDIT_PRINTED_RESOLVER_EXCEPTIONS`) and still asserts its threshold and its absent resource loss.
- **Revert proofs (observed).** Exactly as AC 3 lists them, (a)-(z2). Proof (o) first passed (E16 compared the bot's guess with itself); E16 now gives the unseen card a color other than the fallback.
- **Derived artifacts.** After a rebuild every card / coverage `:check` stayed current (`cards`, `cards:count-markers`, both ledgers, `effect-index`, `mechanics:metadata`, `gauntlet:loadouts`, `gauntlet:configs`, `sim:runtime-observed`, `sim:coverage --check`) and the dashboard `prebuild:coverage` / `test:coverage` / `typecheck` / `format:check` exit 0: nothing regenerates, and the dashboard pin does not move. These were measured at the #2996 base and are expectations, not targets.

## User-Visible Impact

- A Twist logs "[Enigma Code] Twist N: the top card of the Hero Deck joins the Enigma Code face down (K cards), and the code is mixed." The scheme tile shows "Enigma Code (K)" with one small box per card: "?" for a card you have not seen, its color(s) for one you have (its name on hover), and a "P0" marker under each card someone looked at.
- After a Villain fight with 1 Recruit left, a prompt "Enigma Code — pay 1 Recruit to look at a face-down card?" lists "Pay 1 Recruit: look at Enigma card N" for each card you have not seen, plus "Don't look".
- With a code, the Mastermind's Fight (and Excessive Violence) buttons open a guess picker over the Mastermind tile: one row per card with the six colors, a seen card starting on its color, "Guess and fight" and "Cancel".
- The guess logs "[Enigma Code] Player N guessed Strength, Tech. The code is <card>, <card>: right, so the fight goes ahead." or "…: wrong, so the turn ends and the code is mixed face down."

## Assumes

1. **Config** (`rules/schemeTwistConfigs.ts` on the baseline): the scheme (L265-271) is `resolverId: 'counter-only'`, `lossThreshold: 6`, no resource loss.
2. **Resolver contract**: `SchemeTwistResolverId` (`rules/schemeTwistConfig.types.ts`, ending `'counter-only'`) is a closed union; `SCHEME_TWIST_RESOLVERS` (`rules/schemeTwistResolvers.ts`) is a `Record` over it. A resolver receives `(gameState, context: RevealContext, implementationMap, params, twistCardId?)`; `context.random.Shuffle` is the reveal's deterministic shuffle; the `schemeTwistCount` increment is a rule effect applied after the resolver returns (`rules/schemeHandlers.ts` L46-57). `UNKNOWN_TWIST_CARD_ID` is module-private there, so the resolver lives in that file.
3. **Colors** (rules v23 "Class vs. Colors", p.49 "Divided Cards"): a color is a Hero Class; a card with no class is grey; off play a Divided Card counts as all its classes. `offPlayCardTraits(G, id)` (`hero/splitCard.logic.ts` L91) returns `heroClass` / `heroClass2` (a dual-class card's second class, WP-703; a split card's union). Class slugs are `tech` / `covert` / `strength` / `ranged` / `instinct` (`content/content.schemas.ts` `HERO_CLASSES`).
4. **Hero Deck top** is `G.heroDeck[0]` (`board/city.logic.ts` `refillHqSlot` L204).
5. **Fight moves**: `fightVillain` (`moves/fightVillain.ts`) ends its success path with `G.hasActedThisTurn` and the deferred-grant edge; `fightMastermind` (`moves/fightMastermind.ts`) validates (tactics / haunting / attack), then the stage gate and the block-all and heal-lock guards, then Step 3 (defeat, spend). Its args are `{ useExcessiveViolence? }`. Baron Zemo's `payToRescueBystander` (WP-819) is the paid-option precedent.
6. **Turn end from a move**: the `endTurn` move (`moves/coreMoves.impl.ts`) runs `applyEndOfTurnCleanup(G, playerID, { random })` (`moves/endOfTurnCleanup.logic.ts` L58: discard in play + hand, draw a new hand), then `consumeExtraTurn` (`turn/turnLoop.ts` L92) → `events.endTurn({ next })`, else `events.endTurn()`. A bare `events.endTurn()` skips that cleanup.
7. **Owed-choice plumbing**: `openEscapeProcedureSeatChoiceIfNeeded` (`villainDeck/villainEscapeProcedure.ts` L272) runs in `game.ts` turn.onMove (L889) after every move and waits on `hasAnyPendingChoice(G)` (`moves/phaseCard.ts` L82, which covers `pendingSeatChoice` but not `pendingHeroChoice`), `G.pendingHeroChoice` and `evaluateEndgame(G)`; `parkSeatChoice` (`moves/seatChoice.resolve.ts`) parks a one-seat choice; `applySeatChoiceByKind` dispatches by kind; the bot's `chooseByKind` (`simulation/ai.seatChoice.ts`) answers by kind. Seat-choice options reach the addressed seat's client.
8. **Recruit**: `getAvailableRecruit` / `spendRecruit` (`economy/economy.logic.ts` L728 / L793).
9. **Bot and sims**: `getLegalMoves` (`simulation/ai.legalMoves.ts`) emits `fightMastermind` with `args: {}`; the sim runner's and PAR aggregator's `MOVE_MAP` call `fightMastermind(context)` WITHOUT the args. The sim runner, PAR aggregator and fixture runner (`test/fixtures/runFixture.ts`) mirror only the return-on-discard and escape openers.
10. **Projection**: `buildUIState` builds `UIState.scheme` (with the Portals-only `darkPortals`); `filterUIStateForAudience(full, audience)` (`ui/uiState.filter.ts`) rebuilds `scheme` field by field, `audience` being `{ kind: 'player', playerId } | { kind: 'spectator' }`. The client receives only the filtered projection (`playerView`).
11. **Client**: `MastermindTile.vue` submits `fightMastermind` from its Fight and Excessive Violence buttons; `SchemeTile.vue` renders `scheme`; both pages (`PlayDesktop.vue`, `PlayMobile.vue`) mount `MastermindTile` with `snapshot.scheme.darkPortals`; `PendingSeatChoicePrompt.vue` has the per-kind heading switch.
12. **Drop set and guard**: `dropAllPendingPlayerChoices` (`endgame/mastermindVictory.logic.ts`) and its alphabetical `ALL_PENDING_FIELDS` drift test; `operatorSetters.logic.ts` treats an owed queue as open, pinned by `GATE_BLOCKERS` rows in `moves/operatorSetters.test.ts`.
13. **Shared helpers**: `formatCardRef(G.cardDisplayData, id)` (`log/logDisplay.ts` L128); `parkSeatChoice` / `resolveSeatChoice` (`moves/seatChoice.resolve.ts` L271 / L339); `evaluateEndgame` (`endgame/endgame.evaluate.ts`); `UICardDisplay` (`ui/uiState.types.ts` L384).
14. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why the peek is an owed choice after the fight.** "Whenever you fight a Villain, you may pay" is optional and is decided once the fight resolved; the D-24656 owed-choice pattern opens it after the move as the fighter's own seat choice, reusing the existing prompt (no new move), as the last opener so any reaction the fight caused (a Diving Block wave) comes first. Only the `fightVillain` move offers it: free defeats (Silent Sniper) are not fights. Likewise a free Mastermind defeat (Silent Sniper's `defeat-with-bystander`) needs no guess: only the `fightMastermind` move is a fight.
- **Why the peek options carry no card id.** A seat-choice prompt reaches the client; a `cardId` there would show the card without paying. The owed entry records which position each option means.
- **Why the guess is a `fightMastermind` argument.** "When you fight the Mastermind, first guess" is part of the fight request, like Excessive Violence. It is settled after every other gate, so a guess is only spent on a fight that would otherwise happen. A missing or malformed guess is an invalid request (a silent return, the move contract).
- **Why a wrong guess runs the cleanup.** "Your turn ends" is a normal turn end (discard, draw a new hand), and a queued extra turn still begins (D-24513). A bare `events.endTurn()` from inside a move skips the cleanup, so the guess path mirrors the `endTurn` move (two copies; the code style abstracts on the third).
- **Colors.** A color is a Hero Class; no class is grey (rules v23). A dual-class card or a Divided card is both its colors, so either guess is right for it (an inference from "a multicolored card", recorded).
- **Who knows what.** A peek is private to the peeking player ("look at"); who peeked which card number is public (the log and the readout). A right guess reveals the whole code to everyone until the next mix; a wrong guess reveals it in the log and then mixes it, so positions are unknown again. Every mix (each Twist, each wrong guess) forgets all knowledge.
- **The bot.** It looks at the first unseen card when offered (worth 1 Recruit), and fights the Mastermind only once it has seen the whole code (its own peeks, or a reveal), guessing each card's color. It never reads an unseen card and never gambles: a wrong guess would end its turn before it recruits and mix away every peek its partners paid for (the 01.4 finding).
- **Known gaps kept out of scope.** (1) The sim runner, PAR aggregator and fixture runner leave the peek opener unmirrored, so sim bots never peek (the queue grows and never drains there), never know the code, and so never fight the Mastermind once the code holds a card: sims under this scheme run to the Twist-6 loss. (2) Two seats cannot share a peek through the engine; players talk, as at the table.
- **Deploy note.** A cached pre-deploy client sends `fightMastermind {}`, which a match with a code silently rejects (the stale-bundle class); engine and client ship together, and the live-verify checks the gitSha.
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 / #2 (the projection is the only engine → client path), §Persistence Boundaries (runtime-only lazy `G` fields), §Layer Boundary (`.claude/rules/architecture.md`); `.claude/rules/architecture.md` §UIState Projection Integrity (the five-step field contract).
- `docs/ai/DECISIONS.md`: scan D-24595, D-24656, D-24501, D-24753, D-24520, D-24513, D-24549, D-24756, D-12803 before coding.
- User memory: `project_cap75_completion_arc` (drive the LIVE turn.onMove in tests; rebuild before trusting derived checks).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness except `ctx.random` (the reveal context's / the move's `random.Shuffle`), no I/O, no registry access at runtime. Resolvers and helpers never throw.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24763) before coding. One WP per session.

**Packet-specific:**
- **No setup or loss change.** The 6-Twist setup and the Twist-6 loss stay as they are.
- **Runtime-only, lazily initialized.** `enigmaCode`, `enigmaPeeks`, `isEnigmaCodeRevealed` and `pendingEnigmaPeekOffers` are absent until first used; never in `Game.setup`.
- **No unseen card reaches a client.** Only the audience-filtered `scheme.enigmaCode` carries Enigma card ids; seat-choice options carry none.
- **Tests drive the live wiring.** Peek offers open through `LegendaryGame.phases.play.turn.onMove`; fights go through the real moves.
- **Contract changes.** The `SchemeTwistResolverId` member and the `fightMastermind` argument are recorded in D-24763.

## Locked Values

- **Resolver id**: `'enigma-code'`, added to `SchemeTwistResolverId` before `'counter-only'` and registered in `SCHEME_TWIST_RESOLVERS` as `unbreakableEnigmaCode`. The config switches to `resolverId: 'enigma-code'`; `params: {}` and `lossThreshold: 6` unchanged.
- **Resolver** `unbreakableEnigmaCode`: `addHeroDeckCardToEnigmaCode(gameState, context.random)`, then push the `schemeTwistResolved` notable event with `resolverKey: 'enigmaCode'`.
- **Notable-event key**: `'enigmaCode'` appended to `SchemeTwistResolverKey` and `SCHEME_TWIST_RESOLVER_KEYS` (`events/notableEvents.types.ts`, ten → eleven), to both lists in `notableEvents.types.test.ts`, and to `RESOLVER_KEY_PHRASES` (`events/notableEvents.compose.ts`) as `'a card from the Hero Deck joined the face-down Enigma Code'`.
- **Types** (`types.ts`): `PendingEnigmaPeekOffer { playerID: string; positions: number[] }`; `LegendaryGameState.enigmaCode?: CardExtId[] | undefined`, `enigmaPeeks?: Record<string, number[]> | undefined`, `isEnigmaCodeRevealed?: boolean | undefined`, `pendingEnigmaPeekOffers?: PendingEnigmaPeekOffer[] | undefined`.
- **Module** `rules/enigmaCode.logic.ts`:
  - `ENIGMA_PEEK_SEAT_CHOICE_KIND = 'enigma-peek'`; `ENIGMA_CODE_LAST_BUILDING_TWIST = 5`; `ENIGMA_PEEK_RECRUIT_COST = 1`; `ENIGMA_COLORS = ['strength', 'instinct', 'covert', 'tech', 'ranged', 'grey'] as const` (exported from the engine index for the client).
  - `enigmaColorsOf(G, cardId)`: the distinct `heroClass` / `heroClass2` of `offPlayCardTraits`, or `['grey']` when none.
  - `addHeroDeckCardToEnigmaCode(G, random)`: Twist number = `counters.schemeTwistCount + 1`; above 5 → nothing; empty Hero Deck → mix the code anyway ("Mix up those cards face-down" is its own instruction) and log (`'neutral'`) `[Enigma Code] Twist ${n}: the Hero Deck is empty, so no card joins the Enigma Code; the code is mixed.`; else move `G.heroDeck[0]` to the end of the code, mix, log (`'threat'`) `[Enigma Code] Twist ${n}: the top card of the Hero Deck joins the Enigma Code face down (${k} card${s}), and the code is mixed.`
  - Mix (private `mixEnigmaCode(G, random)`): `G.enigmaCode = random.Shuffle([...code])`, delete `enigmaPeeks` and `isEnigmaCodeRevealed`.
  - Named helpers, so each function stays under one screen: `isEnigmaColor` / type `EnigmaColor`; private `isAnotherChoiceOpenOrMatchOver` (the opener's waits), `buildEnigmaPeekChoice`, `isEnigmaGuessRight` and `describeGuessAndCode` (the two log lists).
  - `unknownEnigmaPositions(G, playerID)`: none once revealed; else every position not in `enigmaPeeks[playerID]`, ascending.
  - `queueEnigmaPeekOffer(G, playerID)`: push `{ playerID, positions: [] }` (lazy-init) when the player has an unseen position.
  - `openEnigmaPeekSeatChoiceIfNeeded(G, events, currentPlayer?)`: no-op when the queue is absent, `G.pendingSeatChoice` is set, `hasAnyPendingChoice(G)` is true, `G.pendingHeroChoice` is set, or `evaluateEndgame(G) !== null`. Front to back: when the entry is the current player's (an offer is priced from `G.turnEconomy`, so another seat's is dropped), has an unseen position and `getAvailableRecruit ≥ 1`, set the entry's `positions` and `parkSeatChoice` a one-seat choice (options `Pay 1 Recruit: look at Enigma card ${position + 1}` per unseen position, then `Don't look`; no `cardId`; `defaultOptionIndex` = the decline) and stop; else drop the entry silently. Delete the queue when empty.
  - `applyEnigmaPeekResolvedSeatChoice(G, choice)`: pop the front; an option mapping to a position, with ≥ 1 Recruit available → `spendRecruit(1)`, add the position to `enigmaPeeks[seat]` (lazy-init), log (`'applied'`) `[Enigma Code] Player ${seat} paid 1 Recruit to look at Enigma card ${position + 1}.`; the decline does nothing.
  - `isEnigmaGuessWellFormed(G, guess)`: an array of exactly the code's length, every entry an `ENIGMA_COLORS` member.
  - `settleEnigmaGuess(G, playerID, guess, random, events): boolean`: right (every guess is one of its card's colors) → `isEnigmaCodeRevealed = true`, log (`'applied'`) `[Enigma Code] Player ${p} guessed ${colors}. The code is ${cards}: right, so the fight goes ahead.`, return true. Wrong → log (`'threat'`) `…: wrong, so the turn ends and the code is mixed face down.`, mix, `applyEndOfTurnCleanup(G, playerID, { random })`, then `events.endTurn({ next: playerID })` when `consumeExtraTurn`, else `events.endTurn()`; return false. `${colors}` is the color labels (`Strength` … `Grey`) joined by ", "; `${cards}` is `formatCardRef(G.cardDisplayData, id)` per card, joined by ", ".
  - `chooseBotEnigmaGuess(G, playerID): EnigmaColor[] | null`: `null` while the bot has an unseen position; else each card's first color (a seen card, or the revealed code).
- **fightVillain**: at the end of the success path, `if (G.enigmaCode !== undefined) queueEnigmaPeekOffer(G, ctx.currentPlayer);`.
- **fightMastermind**: new optional arg `enigmaGuess?: readonly string[]`. After the heal-lock check, before Step 3: when the code holds a card, return unless `isEnigmaGuessWellFormed`, then return unless `settleEnigmaGuess(...)`.
- **onMove** (`game.ts`): `openEnigmaPeekSeatChoiceIfNeeded(G, events, ctx?.currentPlayer)` as the LAST call, after the Diving Block opener, so every reaction the fight caused (an escape's steps, a Diving Block wave) resolves before the peek.
- **Dispatch**: `applySeatChoiceByKind` routes the kind to `applyEnigmaPeekResolvedSeatChoice` (after the escape HQ-KO branch). **Bot**: `chooseByKind` answers the kind with option 0. **Legal moves**: while the code holds a card, `fightMastermind` is offered only when `chooseBotEnigmaGuess` is not `null`, carrying `{ enigmaGuess }` (the bot never gambles: a wrong guess would end its turn and mix away its partners' peeks). **Harnesses**: the sim runner's, PAR aggregator's, replay executor's (`replay/replay.execute.ts`) and fixture runner's (`test/fixtures/runFixture.ts`) `MOVE_MAP`s pass `fightMastermind`'s args through.
- **Drop and guard**: `dropAllPendingPlayerChoices` sets `pendingEnigmaPeekOffers = undefined`; `ALL_PENDING_FIELDS` gains `'pendingEnigmaPeekOffers'` (alphabetical, after `pendingElectromagneticBubbleChoices`); `operatorSetters.logic.ts` treats a non-empty queue as owed, pinned by a `GATE_BLOCKERS` row `pendingEnigmaPeekOffers is non-empty`.
- **Projection** (the five-step contract): `UISchemeState.enigmaCode?: UIEnigmaCodeState` with `UIEnigmaCodeState { isRevealed: boolean; cards: UIEnigmaCard[] }` and `UIEnigmaCard { peekedBy: string[]; display?: UICardDisplay; colors?: string[] }` (both exported from the engine index). `buildUIState` adds it only while the code holds a card, every card with its display and colors. `filterUIStateForAudience` passes it through, keeping a card's `display` / `colors` only when `isRevealed` or the audience is a player in `peekedBy`; every audience keeps `isRevealed`, the card count and `peekedBy`.
- **Client**:
  - New `EnigmaCodePanel.vue` (mounted by `SchemeTile.vue` while `scheme.enigmaCode` is present), compact so the 1280x720 board keeps its scale: "Enigma Code (K)" (+ " — revealed"), one small box per card with the number, the `Tech / Covert` colors for a visible card (else "?") and a `P0 P1` marker for `peekedBy`; the box's title / aria-label is `<name> (<colors>). Seen by Player N` or `Face down. Seen by Player N`.
  - New `EnigmaGuessPicker.vue`: one row per card with the six colors (a visible card preselects its first color), "Guess and fight" (enabled once every card has a color) emitting the guess, and "Cancel".
  - New `enigmaColors.ts`: the labels for the engine's `ENIGMA_COLORS`.
  - `MastermindTile.vue`: optional prop `enigmaCode`; while it holds a card, Fight and Excessive Violence open the picker, and its submit sends `fightMastermind` with `{ enigmaGuess }` (plus `useExcessiveViolence: true` from the EV button). The picker is keyed by each card's visible state (`enigmaPickerKey`), so a mid-turn Twist or mix remounts it and it never submits colors for old positions. It opens as an overlay ON TOP of the tile (`position: absolute; inset: 0`, the tile `position: relative`; the #2970 Primus chooser precedent), never inline, and a watch closes it once the fight is no longer possible (the Fight gate closes or the game is over). Both pages pass `:enigma-code="snapshot.scheme.enigmaCode"`.
  - `PendingSeatChoicePrompt.vue`: `case 'enigma-peek': return 'Enigma Code — pay 1 Recruit to look at a face-down card?';`.

## Scope (In)

- **A)** NEW `rules/enigmaCode.logic.ts`; `replay/replay.execute.ts` + `test/fixtures/runFixture.ts` (args pass-through); `rules/schemeTwistConfig.types.ts` (one union member); `rules/schemeTwistConfigs.ts` (the resolver id); `rules/schemeTwistResolvers.ts` (resolver + registry + notable event); `events/notableEvents.types.ts` + `events/notableEvents.compose.ts` (the key); `types.ts`; `moves/fightVillain.ts` (the offer); `moves/fightMastermind.ts` (the guess); `game.ts` (onMove); `moves/seatChoice.resolve.ts`; `simulation/ai.seatChoice.ts`; `simulation/ai.legalMoves.ts`; `simulation/simulation.runner.ts` + `simulation/par.aggregator.ts` (args pass-through); `endgame/mastermindVictory.logic.ts`; `moves/operatorSetters.logic.ts`; `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`; `index.ts` (exports).
- **B)** Engine tests: NEW `rules/enigmaCode.logic.test.ts` (E1-E19); `endgame/mastermindVictory.logic.test.ts` (one field); `moves/operatorSetters.test.ts` (one row); `rules/schemeTwistConfigs.test.ts` (a named printed-count audit exception); `events/notableEvents.types.test.ts` (the key in both drift lists).
- **C)** Client: NEW `EnigmaCodePanel.vue` + test, `EnigmaGuessPicker.vue`, `enigmaColors.ts`; `SchemeTile.vue` + test (one case), `MastermindTile.vue` + test (six cases), `PendingSeatChoicePrompt.vue` + test (one case), `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` (one prop each).
- **D)** Derived artifacts only if their `:check` reports stale after a rebuild.

## Out of Scope

- Mirroring the peek opener in the sim runner, PAR aggregator or fixture runner.
- Any setup or loss change.
- Sharing a peek between seats through the engine.
- The last Cap 75th scheme (Change the Outcome of WWII).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/enigmaCode.logic.ts`, `rules/enigmaCode.logic.test.ts`: **new**
- `rules/schemeTwistConfig.types.ts` (union member), `rules/schemeTwistConfigs.ts` (resolver id), `rules/schemeTwistResolvers.ts` (resolver + registry + notable event), `events/notableEvents.types.ts` + `events/notableEvents.compose.ts` (key + phrase), `types.ts` (entry type + four fields), `moves/fightVillain.ts` (the offer), `moves/fightMastermind.ts` (the guess arg), `game.ts` (onMove opener), `moves/seatChoice.resolve.ts` (dispatch), `simulation/ai.seatChoice.ts` (bot peek), `simulation/ai.legalMoves.ts` (bot guess), `simulation/simulation.runner.ts` + `simulation/par.aggregator.ts` + `replay/replay.execute.ts` + `test/fixtures/runFixture.ts` (args pass-through), `endgame/mastermindVictory.logic.ts` (drop set), `moves/operatorSetters.logic.ts` (guard), `ui/uiState.types.ts` + `ui/uiState.build.ts` + `ui/uiState.filter.ts` (projection), `index.ts` (exports): modified
- `endgame/mastermindVictory.logic.test.ts` (one field), `moves/operatorSetters.test.ts` (one row), `rules/schemeTwistConfigs.test.ts` (the named audit exception), `events/notableEvents.types.test.ts` (the key in both drift lists): modified

**Client (`apps/arena-client/src/`)**
- `components/play/EnigmaCodePanel.vue` + `EnigmaCodePanel.test.ts`, `components/play/EnigmaGuessPicker.vue`, `components/play/enigmaColors.ts`: **new**
- `components/play/SchemeTile.vue` + test, `components/play/MastermindTile.vue` + test, `components/play/PendingSeatChoicePrompt.vue` + test, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`: modified

**Derived artifacts (regenerated only if their `:check` reports stale)**
- none expected (§Scaffold)

That is 40 hand-edited files (9 tests). The size is the scheme's three mechanics (a Twist, a paid peek, a fight gate) each needing its fixed wiring sites plus a per-viewer projection and its client; nothing in it is optional to make the scheme playable. It does not split cleanly: the guess gate without the picker makes the Mastermind unfightable live, and the peek without the guess makes players pay Recruit for nothing.

**Governance:** `docs/ai/DECISIONS.md` (D-24763), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-830-enigma-code.md`

## Contract

- `SchemeTwistResolverId` gains `'enigma-code'` (contract file; recorded in D-24763).
- `fightMastermind` gains the optional `enigmaGuess` argument (required only while the code holds a card).
- New runtime-only `G` fields `enigmaCode`, `enigmaPeeks`, `isEnigmaCodeRevealed`, `pendingEnigmaPeekOffers`, lazily initialized; new seat-choice kind `'enigma-peek'`; no new move.
- New per-audience UIState field `scheme.enigmaCode` (the five-step contract: declared, built, passed through the filter, an audience test, visible in the Play Diagnostics `uiStateSnapshot`).
- No setup, loss or card-data change.

## Test Contract

`rules/enigmaCode.logic.test.ts` builds a full 2-player G from `data/cards/ca75.json` (the `brainwashTheMilitary.test.ts` precedent) with this scheme, resolves Twists through `SCHEME_TWIST_RESOLVERS['enigma-code']` with a reversing Shuffle (proves the mix ran), fights through the real `fightVillain` / `fightMastermind`, opens peek offers through the LIVE `turn.onMove` and resolves them with `resolveSeatChoice`.

| # | Input | Expected | Invariant |
|---|---|---|---|
| E1 | the scheme's config | `resolverId 'enigma-code'`; `lossThreshold 6` | config |
| E2 | one Twist | the top Hero Deck card is the code; the deck is one shorter; the log; the `enigmaCode` notable event | Twist |
| E3 | six Twists | five cards | Twist 6 adds none |
| E4 | a Twist after a peek and a reveal | the code is reversed; peeks and reveal gone | mix |
| E5 | a 2-card code, a peek, then an empty Hero Deck | still two cards, mixed; the peek gone; the log | empty deck still mixes |
| E6 | single, dual and no class | `['tech']`, `['tech','covert']`, `['grey']` | colors |
| E7 | a real Villain fight with a 2-card code and 2 Recruit; onMove | one offer; seat choice for seat 0 with two "look at" options and "Don't look"; default = decline; no option has a `cardId` | offer |
| E8 | look at card 2, then a second offer declined | 1 Recruit spent, `enigmaPeeks {0: [1]}`, the log; the second offer lists only card 1; the decline spends nothing | peek |
| E9 | 0 Recruit; nothing unseen; another seat's offer | no choice and the queue gone; no offer queued; the other seat's offer dropped, not charged | not offered |
| E10 | the bot on an offer | option 0 | bot peek |
| E11 | a code and no / a malformed / an empty guess | no tactic defeated, no Attack spent | guess required |
| E12 | the right guess | a tactic defeated; `isEnigmaCodeRevealed`; the log | right |
| E13 | a wrong guess with a card in play | no fight, no Attack spent; the code reversed; peeks gone; in-play discarded and a 6-card hand drawn; `endTurn()` once; the log | wrong |
| E14 | a wrong guess with a queued extra turn | `endTurn({ next: '0' })` | extra turn |
| E15 | a dual-class card guessed as its second class | the fight goes ahead | multicolored |
| E16 | the bot with one card unseen, then all seen | `null` and no `fightMastermind` legal move; then each card's color, carried by `getLegalMoves` | bot never gambles |
| E17 | seat 0 peeked card 2 | seat 0 sees card 2 only; every unseen card's keys are exactly `['peekedBy']` (a runtime keyset pin, D-24372: no leaked `colors`); after a reveal everyone sees all | projection |
| E18 | no code | no `scheme.enigmaCode` before or after the filter | absent |
| E19 | a peek offer and a Diving Block Wound owed by the same move | the Diving Block wave opens; the peek stays owed | last opener |

Also: `ALL_PENDING_FIELDS` gains the queue; one `GATE_BLOCKERS` row (six setter cases); client cases: the panel (three), the picker through `MastermindTile` (six: Fight opens it; the guess is submitted with a seen card preselected; a changed code remounts it; game over closes it; the turn passing closes it; Cancel), `SchemeTile` mounting the panel (one), the seat-choice heading (one).

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (rules fidelity only, no paid or persuasive surface).

**Determinism preservation:**
- Every helper is a pure function of `G`; the mix uses the move's / reveal's `random.Shuffle`; the bot's guess and peek are deterministic; option order is position order.
- All four `G` fields are lazily created, so a match without this scheme is byte-identical; no hash fixture, PAR file or gauntlet config uses it. The sim / PAR `MOVE_MAP` change passes args the move already ignored when absent, so every other scheme's sim is unchanged.
- **Replay compat:** the resolver id is read from the static config table at runtime, not stored in `initialState`; a stored pre-deploy Enigma Code match replays its Twists through the new resolver, and its recorded `fightMastermind` moves carry no guess, so its D-24119 replay verification would no longer reproduce its final state. This is the WP-823 precedent, recorded in D-24763.

## Funding Surface Gate

§20 **N/A**: engine and gameplay UI. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Behavior.** E1-E19 pass; the client cases pass.
2. **Unchanged neighbors.** Every existing scheme, fight, seat-choice, projection and setter test passes unedited; the only edited existing assertions are the `ALL_PENDING_FIELDS` list, the new `GATE_BLOCKERS` row, the printed-count audit's resolver assertion (a named exception, its threshold assertions intact), and the two `SCHEME_TWIST_RESOLVER_KEYS` drift lists (ten → eleven).
3. **Revert proofs**, each restored afterwards: (a) config back to `counter-only` fails E1; (b) no Twist-6 stop fails E3; (c) no mix fails E4, E13; (d) a mix that keeps old knowledge fails E4, E5, E13; (e) only the first class counting fails E6, E15; (f) no `fightVillain` offer fails E7; (g) no onMove opener fails E7-E10; (h) no Recruit check at open fails E9; (i) a free peek fails E8; (j) no dispatch route fails E8; (k) no well-formed check fails E11; (l) a wrong guess that still fights fails E13; (m) no cleanup on a wrong guess fails E13; (n) an ignored extra turn fails E14; (o) a bot that gambles on unseen cards fails E16; (p) no bot peek case fails E10; (q) a filter that shows every seat every card fails E17; (r) a filter that drops the field fails E17; (s) no setter-guard line fails the six `GATE_BLOCKERS` cases; (t) the wrong notable key fails E2; (u) no mix on an empty Hero Deck fails E5; (v) no picker key fails the `MastermindTile` remount case; (w) a filter that keeps `colors` on an unseen card fails E17; (x) the peek opener before the Diving Block opener fails E19; (y) charging another seat's offer fails E9; (z) a picker that never closes fails the `MastermindTile` game-over and turn-passing cases; (z2) a close watch that reads only `isGameOver` fails the turn-passing case.
4. **Derived gates.** After `pnpm -r build`, every card / coverage `:check` exits 0 (`pnpm cards:check`, `pnpm cards:count-markers:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm gauntlet:loadouts:check`, `pnpm gauntlet:configs:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`), and from `apps/dashboard` `pnpm prebuild:coverage`, `pnpm test:coverage`, `pnpm typecheck` and `pnpm format:check` exit 0.
5. **Client.** `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
6. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; expected delta +25 tests / +4 suites (§Scaffold). A different delta is explained, never tuned.
3. AC 3 revert proofs from `packages/game-engine` with `node --import tsx --test src/rules/enigmaCode.logic.test.ts` (and `src/moves/operatorSetters.test.ts` for the guard), each restored.
4. Every check in AC 4 → 0 after the rebuild.
5. `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm --filter @legendary-arena/arena-client test` → 0 fail, expected delta +11 (2435 → 2446).
6. `pnpm -r --no-bail test` → 0 fail.
7. `git status --porcelain` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes and the diff is allowlist-only.
- [ ] D-24763 appended to `DECISIONS.md` as Active; 01.6 post-mortem written; `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]` with date, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-868:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, after `/api/version` shows a gitSha that contains the merge, in a 2-player operator (debug) match created after the deploy with The Unbreakable Enigma Code as the scheme and seat 1 a bot ally:
  - stage two Scheme Twists on top of the Villain Deck and reveal them: the scheme tile shows "Enigma Code (2)" with two "?";
  - fight a Villain with 1 Recruit left: the prompt offers "Pay 1 Recruit: look at Enigma card 1/2" and "Don't look"; look at card 1: the tile shows its color and a "P0" marker to you (its name and "Seen by Player 0" on hover); the Play Diagnostics `uiStateSnapshot` for seat 0 carries `scheme.enigmaCode.cards[0].display`, and seat 1's lacks it but lists `peekedBy: ['0']`;
  - fight the Mastermind: the guess picker opens with card 1 preselected; guess card 2 wrong: no Tactic is defeated, the turn ends with a new hand, the code is mixed (both "?" again);
  - on a later turn, guess both right (after peeking): the fight goes ahead and the code shows revealed;
  - fit (the D-24502 1280x720 invariant): with five Twists staged, a 1280x720 screenshot with the picker open shows "Guess and fight" in view and the board at its usual scale.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24763 — enigma-code.** It locks:
- the `enigma-code` resolver id (a `SchemeTwistResolverId` contract change; it amends D-24595 §Configuration, which recorded this printed-N scheme as `counter-only`), the `enigmaCode` notable-event key, and the optional `fightMastermind` `enigmaGuess` argument;
- the code: Twists 1-5 move the Hero Deck top card in and mix (`ctx.random`), mixing even when the Hero Deck is empty (an inference: "Mix up those cards" is its own instruction); each mix forgets every peek and the reveal;
- the peek: an owed offer after each `fightVillain` fight, opened as the fighter's seat choice by the LAST onMove opener (after Diving Block; waits as D-24656), dropped if it is not the current player's, options by position with no card id, 1 Recruit re-checked at open and resolve, the decline as the timeout default; private to the peeking seat, who-peeked public;
- the guess: settled after every other fight gate, on the `fightMastermind` move only (a free Mastermind defeat needs none); colors = Hero Classes plus grey, a multicolored card matching any of its colors (an inference); right → revealed to all until the next mix; wrong → mix, the `endTurn` move's cleanup and extra-turn handling, `events.endTurn`;
- the bot (peek the first unseen card; fight the Mastermind only with the whole code seen, never gambling), the sim / PAR / replay / fixture args pass-through;
- replay-compat (a pre-deploy Enigma Code match no longer replays to the same state, the WP-823 precedent) and the known gaps (sims never peek; no engine-side peek sharing).

---

## Gate Record

**Pre-flight (01.4) (independent subagent): READY TO EXECUTE; six non-blocking items, applied.** Verified the scope (every scaffold file allowlisted), Locked Values against the code, E1-E18 against the test file, every Assumes anchor on `18d5ee7d`, and card fidelity (rules v23 grey as a sixth color; every Villain fight, henchmen included, runs `fightVillain`). Hidden information: no unseen card id reaches a client (no `cardId` on peek options, logs name positions only until a guess reveals, the notable event names no card, `playerView` always filters, the Play Diagnostics snapshot is the filtered store, the operator view is debug-only per D-24689). The wrong-guess turn end mirrors the `endTurn` move and `turn.onEnd` still runs; Final Blow / Excessive Violence spend nothing on a wrong guess.
- **N1 (applied):** the bot ally would throw turns on a fallback guess and mix away its partners' paid peeks → it offers the Mastermind fight only once it has seen the whole code (`chooseBotEnigmaGuess` returns `null` otherwise; E16, proof (o)). That also removes the Hero-Deck-reading fallback (N5).
- **N2 (applied):** the replay executor and fixture runner `MOVE_MAP`s also dropped the args → both pass them through (two files added).
- **N3 (applied):** the picker could go stale under a mid-turn Twist or mix → keyed by each card's visible state (proof (v)).
- **N4 (applied):** an empty-deck Twist now still mixes ("Mix up those cards" is its own instruction; E5, proof (u)).
- **N6 (recorded):** a cached pre-deploy client sends `fightMastermind {}`; the gitSha-checked live-verify covers it (Context, deploy note).

**Copilot (01.7) (independent subagent): round 1 RISK (HOLD), five non-blocking fixes, all applied; round 2 CONFIRM, four low items, applied. Pre-flight stands.** Round 1 verified hidden information, the wrong-guess path (no Attack spent, EV unconsumed, `turn.onEnd` intact), Baron Zemo's paid rescue beside the peek, the drop set and setter guard, the bot-ally path and replay.
1. FM 11: unseen-card `colors` were not asserted → E17 pins every unseen card's keys to `['peekedBy']` (D-24372 runtime keyset; proof (w)).
2. FM 18 / 23: the peek opened ahead of a Diving Block wave from the same fight → the peek opener is the LAST onMove call (E19, proof (x)).
3. FM 11 (D-24502 fit): an inline picker would grow the nowrap adversary band and rescale the board → an overlay on the tile (the #2970 precedent), closed by a watch when the fight is no longer possible (proofs (z) / (z2)); a compact scheme-tile panel; a 1280x720 live-verify step.
4. FM 26: free Mastermind defeats need no guess → stated in Context and D-24763.
5. FM 22: an offer outliving its turn would be charged to the next player → the opener drops another seat's offer (E9, proof (y)).
- Round 2 (all five verified in docs and code; Locked Values byte-identical): a turn-passing close case (proof (z2)); a comment no longer claims a pending choice closes the picker; two stale Scope lines; the live-verify wording matches the compact panel; the submit row is sticky.

**Lint (00.3) (independent subagent): FAIL (two minor) → PASS after fixes.** F1 shared helpers were unanchored → new Assumes 13 (`formatCardRef`, `parkSeatChoice` / `resolveSeatChoice`, `evaluateEndgame`, `UICardDisplay`) and paths for the escape opener and fixture runner. F2 the Play Diagnostics step of the five-step contract had no gate → a live-verify assertion on seat 0's and seat 1's `uiStateSnapshot`. Nits applied: the schemeHandlers anchor (L46-57), named private helpers locked, the client delta stated, the dashboard trio in AC 4, the no-clean-split sentence, the scaffold reverted before the drafting commit.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present; 6 ACs; 4 Out-of-Scope items |
| §2 | PASS — full files, ESM / Node 22, 00.6, session protocol, packet-specific rules; Locked Values carry every text source |
| §3 | PASS — 14 anchored Assumes items, a BLOCKED clause |
| §4 | PASS — ARCHITECTURE Principles / Persistence / Layer Boundary, the UIState five-step rule, the DECISIONS scan list; 00.2 not needed (a projection field, no card data) |
| §5 | PASS — 40 hand-edited files, each described; the size justified (three mechanics, a per-viewer projection and its client; no clean split) |
| §6 | PASS — every symbol at its stated anchor |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine logic; the client submits intent and renders the filtered projection; `ENIGMA_COLORS` via the `.` runtime surface |
| §9 | PASS — pnpm / node / git only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test via tsx, local data, no boardgame.io testing import, network or DB |
| §13 | PASS — exact commands; expected deltas +25 / +4 (engine), +11 (client) |
| §14 | PASS — 6 binary ACs; AC 2 lists every edited existing assertion |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist-only diff; live-verify on `play.legendary-arena.com` including the diagnostics and 1280x720 steps |
| §16 | PASS — named helpers; longest function ~25 lines |
| §17 | PASS — §1 / §8 / §22 / §23 / §24 / NG-1; conflict, determinism and replay lines |
| §18 | N/A — no forbidden-token grep |
| §19 | N/A — commit-time discipline |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason (no endpoint, no `apps/server` surface; bot-ally autoplay gets the guess through `getLegalMoves`) |

EC-868 vs EC-TEMPLATE: PASS; Locked Values byte-identical to the WP; under the 100-line ceiling.

**Verdict:** PASS.
