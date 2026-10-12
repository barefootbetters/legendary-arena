# EC-840 — Man / Woman Out of Time (Execution Checklist)

**Source:** docs/ai/work-packets/WP-803-out-of-time.md
**Layer:** Game Engine + App arena-client

## Before Starting
- [ ] Baseline `origin/main` includes the reserve commit (#2714). `pnpm install` and `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
- [ ] Re-read the anchors (all `~`):
  - `heroKeywords.ts`; the three `HERO_KEYWORDS.length` pins (77 at draft); the two handler-count asserts (`heroEffects.execute.test.ts:~140`, `:~7873`; 60 at draft)
  - `LEADING_GATE_PREFIX_PATTERN` `heroAbility.setup.ts:~131`; `HERO_PARSER_RECOGNIZED_MARKER_NAMES` `:~400` (drift test `setup/heroAbility.setup.test.ts:~1835`)
  - `playedCardIdsThisTurn` `splitCard.logic.ts:~169`; `applyCardPlay` `coreMoves.impl.ts:~285`
  - `advanceTurnStage` `turnLoop.ts:~121` and its five callers
  - `CarriedTurnFields` / `carryConversionFlag` / `markBothSidesPlayed` `economy.logic.ts:~481/~520/~973`
  - `victoryCards` in build / filter
- [ ] Re-count the `playedCardIdsThisTurn` callers (28 after D-24694) and match each one to its WP §Played-vs-Have bucket (10 have / 18 played). Any mismatch → STOP and amend the WP + D-24692.
- [ ] Check whether WP-741 (D-24563) has landed. Either way, gate conditions stay exactly as the parser builds them.
- [ ] The main checkout's branch `infra/endgame-readonly-board` has uncommitted edits to `PlayDesktop.vue` / `PlayMobile.vue`, and PR #2698 (a PAR re-pin) is open. Rebase on the `main` of execution day, and measure "PAR unchanged" against it.

## Locked Values (do not re-derive)
- **Keyword `'out-of-time'`,** appended last. Member of `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` and `HERO_EFFECT_HANDLERS` (`heroEffectOutOfTime`). The three length pins and both count asserts each move +1.
- **`HERO_PARSER_RECOGNIZED_MARKER_NAMES`** (the exported literal, not `RECOGNIZED_NON_KEYWORD_MARKERS`) gains `'man-out-of-time'`, `'woman-out-of-time'` and `'man/woman-out-of-time'`. Its drift test gets an asserting `SPACE_FORM_WHOLE_LINE_NAMES` branch: the built line yields `'out-of-time'` with `unresolvedMarkers` `[]`. Never a bare `continue`.
- **`OUT_OF_TIME_LINE_PATTERN`** = `/^\s*(?:(?:(?:\[(?:hc|team):[^\]]+\]|\[keyword:Savior\])\s*)+:\s*)?\[keyword:(?:Man|Woman|Man\/Woman) Out of Time\]\s*$/`. It runs after the Step 2 keyword loop (no early return). It pushes the keyword only (the generic builder emits the effect), keeps the gate conditions as built, and adds no unresolved slug. Parse tests deep-equal the hook's `conditions` against the same prefix over a gate-only body, never literal counts. `LEADING_GATE_PREFIX_PATTERN` is unchanged.
- **`G.outOfTimeCards?: Record<string, CardExtId[]>`** is lazy, with the player key and the field deleted when empty. Never written at setup.
- **`TurnEconomy.outOfTimePlayedCardIds?: CardExtId[]`** (contract file `economy.types.ts`) is active-player-scoped and carried only when defined. Helper `recordOutOfTimePlayed(economy, cardId)`.
- **Handler guards,** in order; each failure pushes one `blocked` sentence and returns:
  1. the card is not already in the ledger
  2. the card is in the player's `inPlay`
  3. the card is the last `inPlay` entry
- **Handler apply:** remove the card from `inPlay`, append it to `outOfTimeCards[playerID]`, call `recordOutOfTimePlayed`, then log `applied`.
- **Played vs have.**
  - `playedCardIdsThisTurn` = Penumbra-expanded `inPlay` + ledger entries not already present.
  - `playedCardIdsStillInPlay` = today's result.
  - The 10 "have" sites switch, including `countDistinctHeroClassesYouHave` (which also carries Spectrum since D-24694) and `collectDistinctHeroClassCards`. The 18 "played" sites are unchanged. The ledger read is `G.turnEconomy?.outOfTimePlayedCardIds`; it is appended on both paths (including the Penumbra-absent early return) and always returns a fresh array.
- **`replayOutOfTimeCards(G, context, playerID)`** (`moves/outOfTime.logic.ts`).
  - It returns early when there is no entry or no `playerZones`.
  - Otherwise it snapshots the list, deletes the key once (and the field if it is now empty), then for each snapshot card, in order:
  1. (already off the set-aside)
  2. `recordOutOfTimePlayed`
  3. log the return line
  4. `applyCardPlay`
  5. if the card is still in `inPlay`, move it to the end of `discard`

  It makes no `recordCardDiscardedThisTurn` / `discardFromHand` call.
- **`TurnLoopContext.beginMain: (startingPlayerID: string) => void`** is required and called only inside `if (nextStage === 'main')`, after the `logMeta.actionInStep = 0` reset and before `return` (`turnLoop.test.ts` asserts the order).
  - `game.ts` `advanceStage` takes the full move context (`{ G, ...context }`).
  - The four harnesses bind their move context the way their `MOVE_MAP.playCard` entries pass it.
- **`UIPlayerState.outOfTimeCards?: UIDisplayEntry[]`** is public: built with `buildDisplayEntries`, copied in both `redactHandCards` and `preserveHandCards`, and omitted when empty.
- **Client.** `PlayedCardsRow` prop `outOfTimeCards?`, default `[]`. Group `data-testid="play-out-of-time"` with heading `Out of Time — returns next turn`, placed before the played cards in the same well. "Played This Turn — N" counts `inPlayCards` only.
- **Log sentences**, each with its outcome:
  - `Player N set <card> aside Out of Time; it plays again at the start of their next turn.` (`applied`)
  - `Player N's <card> returns from Out of Time and is played a second time.` (`neutral`)
  - `<card> is not set aside again: a card goes Out of Time only once.` (`blocked`)
  - `<card> is not set aside: a copy can't use Out of Time.` (`blocked`)
- **Ledger.** `'out-of-time'` joins `BY_HOOK_KEYWORDS`. Provenance `{ "wp": "WP-803", "decision": "D-24692" }`.

## Guardrails
- A card goes Out of Time at most once per play-chain. Copies never do, and the replay never re-sets aside.
- The replay fires only on start → main: after the reveal and its choices, before any hand play. No new move, no `ctx.events.*` call, no stage write outside `advanceTurnStage`.
- No repeated-gate counting here. That belongs to WP-741; don't call or extend `countRepeatedBothCondition`.
- In a match without an Out of Time card, no `G` field is written. A change to the sentinel, `PRE_WP080_HASH` or PAR = STOP and diagnose.
- `PlayerZones` / `zones.types.ts` are untouched. Zones and the set-aside hold `CardExtId` only.
- The Winter Soldier "2>4" lines stay unresolved. No grant capability.
- No client rule logic. No edits to `apps/server`, `ai.legalMoves.ts` or `ai.competent.ts`. Moves and effects never throw.
- Tests assert exact arrays (`inPlay`, `outOfTimeCards[p]`, `discard`, the ledger) and include the negatives:
  - gate unmet
  - Copy Powers and Steal Abilities
  - replay-not-twice
  - no early replay
  - "have" reads ignoring a ledger card

## Required `// why:` Comments
- `OUT_OF_TIME_LINE_PATTERN`: rules v23 L1667. Savior is admitted because `LEADING_GATE_PREFIX_PATTERN` is hc/team-only (D-24628). The 2>4 grant lines are a different capability.
- Each handler guard: guard 1 = L1674 / L1692; guards 2–3 = L1689 (copies).
- `outOfTimeCards` lazy / delete-when-empty: hash stability (D-24526 precedent).
- The ledger in `playedCardIdsThisTurn`: L1682 + L3441-3453 (active-player scope). Each of the 10 "have" switches: L3443-3447 + L3457-3470.
- `beginMain` in `advanceTurnStage` and at each of the five bindings: L1678 (after "Play a Villain Card", before playing out the hand).
- The replay's pre-record before `applyCardPlay`, and the turn-2 discard that is not a "you discarded".
- The public projection disposition.

## Files to Produce
- `packages/game-engine/src/moves/outOfTime.logic.ts` + `.test.ts` — **new**
- `rules/heroKeywords.ts` (+ test), `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.ts` (+ test), `hero/gateOnlyHollow.test.ts` — **modified**
- `hero/heroEffects.execute.ts` (+ test), `economy/economy.types.ts`, `economy/economy.logic.ts` (+ test), `hero/splitCard.logic.ts` (+ test), `types.ts` — **modified**
- `hero/heroConditions.evaluate.ts`, `hero/heroCountSource.resolve.ts` (+ test), `villain/villainEffects.execute.ts`, `rules/tacticHandlers.ts` (+ test), `moves/villainDefeatRequirement.logic.ts` — **modified**
- `turn/turnLoop.ts` (+ `turnLoop.test.ts`, `turnLoop.integration.test.ts`), `game.ts`, `game.test.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`, `replay/replay.execute.ts` — **modified** (01.5 wiring + reducer test)
- `ui/uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`, `uiState.filter.test.ts`, `uiState.types.drift.test.ts` — **modified**
- `apps/arena-client/src/components/play/PlayedCardsRow.vue` (+ test), `pages/PlayDesktop.vue` (+ test), `pages/PlayMobile.vue` (+ test) — **modified**
- `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — **modified**
- **Regenerated:** `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv`, `data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`. **Re-pinned:** `apps/dashboard/src/composables/useInPlayCoverage.test.ts`
- `docs/ai/DECISIONS.md` (D-24692), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. Regenerate the feeds; every `:check` / `--check` → 0.
  - The six `out-of-time` ledger rows read `executable`.
  - `sim:coverage` shows `man-out-of-time` 8 → 4, and the woman / man-woman keys are gone.
  - No set's `executable` count fell.
- [ ] Run the dashboard `prebuild:snapshot`, `prebuild:coverage`, `prebuild:effect-index` and `prebuild:par`, then `test:coverage` + `typecheck`, then re-pin `useInPlayCoverage.test.ts`. Expect `totalObs` down and `percentResolved` flat or up (denominator only).
- [ ] Engine and arena-client suites pass; arena-client `typecheck` 0; `pnpm -r --no-bail test` → 0 fail; sentinel / `PRE_WP080_HASH` / PAR unchanged.
- [ ] Layout check at 1280×720 (WP Verification 7; the `mid-turn.json` fixture edit is local-only and reverted). `outOfTimeCards` visible in a live diagnostics download.
- [ ] D-24692 Active (every DoD clause). STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology (`EC-840:` then `SPEC:`) with `Tests-changed:` trailers. Live-verify (D-24026) after deploy.

## Common Failure Smells
- **Handler registered but never fires:** `'out-of-time'` is missing from `NO_MAGNITUDE_KEYWORDS`.
- **Every set-aside also logs "not set aside again":** the recognizer pushed the effect as well as the keyword, so it ran twice.
- **Savior lines still hollow:** the recognizer leaned on `LEADING_GATE_PREFIX_PATTERN`.
- **A replayed card vanishes into the set-aside again:** the replay did not `recordOutOfTimePlayed` **before** `applyCardPlay`.
- **"beginMain is not a function" in tests:** a test-built `TurnLoopContext` lacks the closure.
- **The sim / PAR / fixture loops disagree with live:** one of the five `advanceTurnStage` callers is missing the binding.
- **A later Superpower misses the set-aside card:** the ledger is not appended, or `carryConversionFlag` dropped it.
- **WP-801's KO or a "you have" read (Storm the Beachhead's class count) picks a set-aside card:** a "have" site was not switched.
- **The sentinel hash moved:** a field was written at setup, or an empty `[]` / `{}` was left behind.
- **`sim:coverage` still lists the woman / man-woman keys:** `HERO_PARSER_RECOGNIZED_MARKER_NAMES` was not updated.
