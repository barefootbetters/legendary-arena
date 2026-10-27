# EC-868 — The Unbreakable Enigma Code (Execution Checklist)

**Source:** docs/ai/work-packets/WP-830-enigma-code.md
**Layer:** Game Engine (scheme resolver + Enigma module, the two fight moves, onMove, dispatch, bot, sims, setter guard, per-audience projection) plus arena-client (code readout, guess picker, one heading)

## Before Starting
- [ ] The scheme's config is `resolverId: 'counter-only'`, `lossThreshold: 6` (`rules/schemeTwistConfigs.ts`); `SchemeTwistResolverId` ends with `'counter-only'`.
- [ ] `fightMastermind` takes `{ useExcessiveViolence? }`; the sim runner and PAR aggregator call `fightMastermind(context)` without args; `getLegalMoves` emits `fightMastermind` with `args: {}`.
- [ ] The `endTurn` move runs `applyEndOfTurnCleanup` then `consumeExtraTurn` → `events.endTurn`.
- [ ] `schemeTwistConfigs.test.ts`' printed-count audit asserts `counter-only` for all 27 printed-N schemes.
- [ ] The drafting scaffold patch is evidence only; re-author from Locked Values and the Test Contract.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] Rebuild first. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine and client totals.

## Locked Values (do not re-derive)
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

## Guardrails
- No setup, loss or card-data change; the 6-Twist setup and the Twist-6 loss stay.
- All four `G` fields are lazily created; never in `Game.setup`.
- No unseen Enigma card id reaches a client: only the filtered `scheme.enigmaCode` carries ids; peek options carry none.
- Tests fight through the real moves and open offers through the LIVE `turn.onMove`.
- The `SchemeTwistResolverId` member and the `enigmaGuess` argument are contract changes, recorded in D-24763.
- The only edited existing assertions: `ALL_PENDING_FIELDS`, the new `GATE_BLOCKERS` row, the printed-count audit's named resolver exception, and the two resolver-key drift lists.
- Regenerate only what a `:check` reports stale after a rebuild; hash oracles byte-identical, else STOP.

## Required `// why:` Comments
- The union member, the config entry and the resolver: WP-830 / D-24763, the printed Twists.
- The Twist number (counter + 1); the mix (forgets every peek and the reveal).
- The peek offer: owed after the fight; options with no card id; the decline as the timeout default; the opener's waits.
- The guess: settled after every other gate; a wrong guess runs the `endTurn` move's cleanup and extra-turn handling.
- The colors (grey for no class; a multicolored card matches either color); the bot never reads an unseen card.
- The projection: per-audience; the filter keeps a card only for a viewer who has seen it, or once revealed.
- The sim / PAR / replay / fixture args pass-through; the bot never gambles on unseen cards; the picker key; the printed-count audit exception.

## Files to Produce
- `packages/game-engine/src/rules/enigmaCode.logic.ts` + `enigmaCode.logic.test.ts` — **new** (E1-E19)
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`, `rules/schemeTwistConfigs.ts` + `schemeTwistConfigs.test.ts` (the named exception), `rules/schemeTwistResolvers.ts`, `events/notableEvents.types.ts` + test, `events/notableEvents.compose.ts`, `types.ts`, `moves/fightVillain.ts`, `moves/fightMastermind.ts`, `game.ts`, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts`, `simulation/ai.legalMoves.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `replay/replay.execute.ts`, `test/fixtures/runFixture.ts`, `endgame/mastermindVictory.logic.ts` + test, `moves/operatorSetters.logic.ts` + `operatorSetters.test.ts`, `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `index.ts` — **modified**
- `apps/arena-client/src/components/play/EnigmaCodePanel.vue` + `EnigmaCodePanel.test.ts`, `EnigmaGuessPicker.vue`, `enigmaColors.ts` — **new**
- `apps/arena-client/src/components/play/SchemeTile.vue` + test, `MastermindTile.vue` + test, `PendingSeatChoicePrompt.vue` + test, `apps/arena-client/src/pages/PlayDesktop.vue`, `PlayMobile.vue` — **modified**
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-830-enigma-code.md` — **modified / new** (governance close)

## After Completing
- [ ] E1-E19 pass (offers opened through the live `turn.onMove`, fights through the real moves); the client cases and the `GATE_BLOCKERS` row pass; `ALL_PENDING_FIELDS` lists the queue; engine and client deltas as in WP §Scaffold.
- [ ] Revert proofs as listed in WP AC 3, each restored.
- [ ] Every card / coverage `:check` → 0 after the rebuild; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; dashboard `test:coverage` / `typecheck` / `format:check` → 0.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.
- [ ] D-24763 Active; 01.6 post-mortem WP COMPLETE; STATUS updated; WORK_INDEX `[x]` with date; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Allowlist-only diff (revert `lagn-v1.json` CRLF churn). Two-commit topology `EC-868:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: a 2-player operator match with this scheme created after the deploy (gitSha checked): staged Twists build a face-down code; a paid peek shows one card to the peeking seat only; a wrong guess ends the turn and mixes the code; a right guess lets the fight go ahead and reveals the code.

## Common Failure Smells
- A Twist does nothing → the config still says `counter-only`.
- The Mastermind can't be fought at all → the client still submits `fightMastermind` without `enigmaGuess`, or the sim `MOVE_MAP` drops the args.
- A wrong guess leaves the hand in place → the cleanup is missing (a bare `events.endTurn()`).
- Another seat sees a peeked card → the filter keeps `display` (or `colors`) for every player.
- The board shrinks when the guess opens → the picker renders inline instead of over the tile.
- A peek costs nothing / no prompt after a fight → the spend, the `fightVillain` call or the onMove opener is missing.
- The heading reads "Your choice" → the client case is missing.
