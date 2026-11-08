# EC-913 — The Mandarin: Master Strike sends a Ring back into the City, Rings +1 Attack, The Mandarin -1 Attack per Ring (Execution Checklist)

**Source:** docs/ai/work-packets/WP-875-mandarin-master-strike-and-ring-attack.md
**Risk Tier:** MEDIUM — gameplay rules (fight costs, City entries and escapes, Wounds, a multi-seat choice) and one new lazily
created hashed `G` queue; no auth, money, persistence or server surface
**Layer:** Game Engine (one strike arm, one owed-entry queue opened from `onMove`, one seat-choice kind, two cost terms) + coverage data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] The WP-875 / EC-913 / D-24822 reservation (#3230) is on `main`. If WP-872 executed first, re-read every lockstep site it
      touched (`ALL_PENDING_FIELDS`, `isOperatorChoiceOpen`, the opener order, the loop mirrors) before editing.
- [ ] `pnpm -r build`, then game-engine and dashboard `test`, exit 0; record the counts (6643 / 0 at `7c197771`; re-record).
- [ ] Re-read at HEAD: `mastermindStrikeHandler` and `resolveBaronZemoStrike`; `openRevealOrWoundSeatChoiceIfNeeded` and its park
      rule; `reenterSewersOnVillainDeckReveal`; `resolveFightCost` / `resolveMastermindFightCost`; every `pendingNextHandFromPlayPicks` site.

## Locked Values (do not re-derive; verify at HEAD)
- **`mastermind/mandarin.logic.ts`** (no boardgame.io / registry / `villainDeck/` import): `MANDARIN_MASTERMIND_ID = 'rvlt/mandarin'`,
  `MANDARIN_RING_ID_PREFIX = 'henchman-mandarins-rings-'`, `MANDARIN_RING_ATTACK_BONUS = 1`, `MANDARIN_RING_VICTORY_REDUCTION = 1`,
  `MANDARIN_RING_VICTORY_REDUCTION_SOLO = 3`; `isMandarinRingCardId`, `listMandarinRingsInVictoryPile` (pile order),
  `countMandarinRingsInAllVictoryPiles`, `isMandarinLeading` (`G.selection?.mastermindId === MANDARIN_MASTERMIND_ID`),
  `mandarinRingAttackBonus(G, cardId)`, `mandarinVictoryPileAttackReduction(G)` (solo = `Object.keys(G.playerZones).length === 1`),
  `MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND = 'mandarin-ring-entry'` (here, so `seatChoice.resolve.ts` imports only this module),
  `queueMandarinRingEntry(G, playerID)` (lazy create, append `{ playerID }`), `countQueuedMandarinRingEntries(G, playerID)`,
  `applyMandarinRingEntryResolvedSeatChoice(G, choice)` (sets the seat's FIRST unchosen entry; skips an option without `cardId` or a
  seat with no unchosen entry).
- **Costs:** `resolveFightCost` adds `mandarinRingAttackBonus(G, villainCardId)` to `costBeforeReduction`;
  `resolveMastermindFightCost` subtracts `mandarinVictoryPileAttackReduction(G)` inside the existing `Math.max(0, …)`.
- **Types:** `interface PendingMandarinRingEntry { playerID: string; chosenCardId?: CardExtId }`;
  `pendingMandarinRingEntries?: PendingMandarinRingEntry[] | undefined` (lazy, never seeded).
- **Strike arm** `else if (mastermindId === MANDARIN_MASTERMIND_ID)` before the terminal `else` →
  `resolveMandarinStrike(gameState, currentPlayer: string | null)` fed `resolveCurrentPlayer(strikeContext)` (no non-null guard);
  seats via `seatsInTurnOrderFrom`. Available = Victory
  Pile Rings − `countQueuedMandarinRingEntries`. None available →
  `gainWoundToDiscard`; `[Mandarin Master Strike] Player ${seat} had no Mandarin's Ring in their Victory Pile and
  ${describeStrikeWound(outcome)}.`, or for `'no-wound'` `[Mandarin Master Strike] Player ${seat} had no Mandarin's Ring in their
  Victory Pile and the Wound supply is empty — no effect.`. One or more available → `queueMandarinRingEntry` + `[Mandarin Master Strike] Player
  ${seat} will send a Mandarin's Ring from their Victory Pile into the City.` (`neutral`). The arm moves no card, parks nothing.
- **Opener** `openMandarinRingEntriesIfNeeded(G, events, currentPlayer, revealContext, implementationMap)`, the only export of
  `moves/mandarinRingEntry.logic.ts`: no queue → return; empty → delete; wait on `hasAnyPendingChoice(G)` / `G.pendingHeroChoice` /
  `evaluateEndgame(G) !== null`. Settle pass (repeat until no change), queue order, first unchosen entry per seat only; available =
  the seat's pile-order Rings minus its earlier entries' `chosenCardId`s: 0 → remove the entry (rebind; delete when empty) + `[Mandarin Master Strike]
  Player ${playerID} no longer has a Mandarin's Ring in their Victory Pile, so none enters the City.` (`blocked`); 1 → chosen; 2+ →
  needs a choice. Any need → ONE seat choice (seats in queue order, each once; options = available Rings, `label` =
  `resolveCardName(G.cardDisplayData, cardId)`, `cardId`; `defaultOptionIndex: 0`), `[Mandarin Master Strike] Player ${seat} chooses
  which Mandarin's Ring enters the City.` (`neutral`) per seat (no prompt field exists), D-24743 park rule, return. All chosen →
  drain from the FRONT: stop if `evaluateEndgame(G) !== null` or the front has no `chosenCardId` (rest stays queued); else remove the
  front entry (rebind; delete when empty) BEFORE moving its Ring (`<ref>` = `formatCardRef(G.cardDisplayData, chosenCardId)`): gone →
  `[Mandarin Master Strike] Player ${playerID}'s <ref> is no longer in their Victory Pile, so it does not enter the City.`
  (`blocked`); else `moveCardFromZone`, `pushVillainIntoCity`, `[Mandarin Master Strike] Player ${playerID}'s <ref> entered the City
  from their Victory Pile.` (`threat`), `resolveVillainEscape` for an `escapedCard`. Stopped on an unchosen front (a chained strike
  appended it) with no endgame → back to the wait check IN THE SAME CALL. No
  card-attribution argument on any line.
- **Wiring:** `game.ts` `onMove`, at the reveal-or-wound position: `openRevealOrWoundSeatChoiceIfNeeded` (existing) → the Mandarin
  opener with `{ random, ctx: { currentPlayer: ctx.currentPlayer, turn: ctx.turn } }` and `DEFAULT_IMPLEMENTATION_MAP` → a second
  `openEscapeProcedureSeatChoiceIfNeeded` → `latchFinalTurnIfDeckExhausted(G); applyPileDepletionResourceLoss(G);` (D-24599 pair,
  the live ~935-945 order) → a second `openRevealOrWoundSeatChoiceIfNeeded` → the
  existing Diving Block opener; the new block only when `ctx` is present (no Purge-sweep re-run; it catches up next `onMove`). The five
  loop mirrors (runner ~711 / ~821, PAR ~786 / ~876, `runFixture.ts` ~427) add the opener, the re-run escape opener, `applyPileDepletionResourceLoss` (runner / PAR only) and the re-run reveal-or-wound
  opener (no latch) after their
  reveal-or-wound opener: `events` undefined, the loop's active seat, `DEFAULT_IMPLEMENTATION_MAP`,
  `{ random: { Shuffle: <T>(deck: T[]): T[] => shuffleWithPrng(deck, nextRandom) }, ctx: { currentPlayer, turn } }` (runFixture:
  `cursor.currentPlayer`, `cursor.turn`; verify local names). NEVER `seatChoiceContext` (acting seat) or `dispatchedMoveContext`.
  `onBegin` and `applyOnBeginParity` delete the queue; end-of-game drop; `isOperatorChoiceOpen` true when the queue has entries; the
  `applySeatChoiceByKind` arm calls the apply.
- **Pins / provenance (sanctioned, each citing WP-875 / D-24822):** `mastermindStrike.unresolved.test.ts` `checkedCount` 13 → 14
  and its comment; `ALL_PENDING_FIELDS` gains the field; one `operatorSetters.test.ts` row. `strike-provenance.json`
  `rvlt-mastermind-mandarin-master-strike` → `executable`, handler
  `packages/game-engine/src/rules/mastermindHandlers.ts#resolveMandarinStrike`, WP-875, D-24822 (sorted key order); pending
  `live-verify.json` rows `mastermind:rvlt/mandarin|master-strike`, `|ring-attack`, `|victory-pile-ring-reduction`
  (`key, kind, card, ability, wp, state: "pending", date, evidence: "", note`).

## Guardrails
- One cost authority each; no reader adds a Mandarin term itself; the four printed-Attack reads (Ebony Blade ~177,
  `uiState.build.ts` ~2223, `ai.legalMoves.ts` ~692, `clashMonsterPit.logic.ts` ~130) stay printed. A non-Mandarin match is
  byte-identical.
- The apply never moves a card; the opener is the only entry site; push-outs escape via `resolveVillainEscape`; writes rebind.
- No card data, client, server, UIState-field or registry change; `pushVillainIntoCity`, `resolveVillainEscape`, `replay.execute.ts`
  untouched; tactics and Epic Mandarin stay out.
- STOP if a sentinel / golden hash, a non-Mandarin cost or strike, or an existing strike / seat-choice / escape / WP-870 test changes
  beyond the sanctioned pins, or if a module cycle appears.
- Moves, handlers and the opener never throw. No `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`. Never edit a test to
  pass. Never `git stash`.

## Required `// why:` Comments
- `mandarin.logic.ts`: the id-prefix Ring test (D-24803 copies); solo = one seat (a bot ally is a player); the apply only records.
- `economy.resolve.ts`: each term in the single authority, read at fight time (D-24822; the D-24752 shape).
- `mastermindHandlers.ts`: a strike has no `events`, so Ring choices are queued; Wounds at strike time.
- `mandarinRingEntry.logic.ts`: the wait guards; the entry lives here because the escape needs the turn and the map; no Ambush
  (D-24811); queue order is turn order (D-24780); the park rule (D-24743).
- `game.ts` / loop mirrors / `onBeginParity.ts` / end-of-game drop / `isOperatorChoiceOpen` / `types.ts`: the lockstep (D-24822).

## Files to Produce
- Engine (`packages/game-engine/src/`): `mastermind/mandarin.logic.ts` (new), `moves/mandarinRingEntry.logic.ts` (new),
  `economy/economy.resolve.ts`, `rules/mastermindHandlers.ts`, `types.ts`, `moves/seatChoice.resolve.ts`, `game.ts`,
  `simulation/onBeginParity.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`,
  `endgame/mastermindVictory.logic.ts`, `moves/operatorSetters.logic.ts`.
- Tests: `mastermind/mandarin.test.ts` (new, T1-T18), `rules/mastermindStrike.unresolved.test.ts`,
  `endgame/mastermindVictory.logic.test.ts`, `moves/operatorSetters.test.ts`.
- Coverage: `scripts/coverage/strike-provenance.json`, `data/metadata/effect-implementation-index.json` (generated),
  `docs/ai/coverage/live-verify.json`; `runtime-observed-hollows.json` / `hero-effect-coverage.baseline.json` only if a gate moves.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24822), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine and dashboard `test` 0; engine delta recorded (expect at least +18). Sentinels byte-unchanged.
- [ ] Provenance + pending live-verify rows added BEFORE `pnpm effect-index`. Then each exits 0: `effect-index:check`,
      `effect-index:test`, `sim:runtime-observed:check`, `sim:coverage --check`, `cards:check`; dashboard `prebuild:coverage` 0.
- [ ] Govern-close 0: `workindex:rows:check`, `workindex:executed:check`, `node scripts/check-number-ledger.mjs --check`;
      `git diff --name-only origin/main...HEAD` inside `## Files to Produce`. `(Select-String -Path <file> -Pattern 'openMandarinRingEntriesIfNeeded\(').Count` gives 2 / 2 / 1
      in runner / PAR / runFixture, each call followed by the re-runs (AC5).
- [ ] D-24822 → Active covering every clause of the WP's Reserved Decision; STATUS (tactics + Epic as follow-ups); WORK_INDEX checked;
      EC_INDEX Done; mindmap ✅ + `roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED.
- [ ] Live-on-surface (D-24026) on a Mandarin match created after the deploy, or operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- The strike still logs "Unhandled effect observed": the arm is after the terminal `else`, or the id constant is misspelled.
- A Ring shows Fight 3: the term went into a projection instead of `resolveFightCost`, or `isMandarinLeading` reads the wrong field.
- Rings never enter in a sim game: a loop mirror is missing. A Ring enters before its owner answers: the apply moved it.
- "Fight effect: … entered" or an Ambush fired on entry: the entry reused a reveal path instead of the D-24811 shape.
