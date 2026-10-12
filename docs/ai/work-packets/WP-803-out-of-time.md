# WP-803 — Man / Woman Out of Time: set the card aside, replay it after next turn's villain card, then discard it (Game Engine + App arena-client)

**Status:** Draft 2026-10-11
**Primary Layer:** Game Engine (keyword lockstep, parser recognizer, hero handler, turn-start replay, played-this-turn ledger, UIState projection) + App arena-client (an "Out of Time" group in the played-cards row)
**Dependencies:**
- WP-705 / D-24526 (Teleport-on-discard — the set-aside-in-no-zone, lazily created `G` field precedent)
- WP-780 / D-24619 (Penumbra — the `playedCardIdsThisTurn` chokepoint and its turn-scoped `TurnEconomy` ledger)
- WP-736 / D-24556 (Excessive Violence — the space-form `[keyword:…]` + by-hook ledger precedent)
- D-24628 (leading gate prefixes — `LEADING_GATE_PREFIX_PATTERN`)
- WP-701 / D-24520 (the `cleanup` closure on `TurnLoopContext` — the per-stage closure template)
- WP-744 / D-24567 (all four bgio-bypassing turn loops reuse `advanceTurnStage`)
- WP-783 / D-24629 (handler-bearing keyword lockstep, three `HERO_KEYWORDS.length` pins)
- WP-128 / D-12803 (audience-filter redaction matrix)

**Order-independent sibling:** WP-741 / D-24563 (Draft, gates passed). It makes a repeated leading gate (`[team:shield]`×4) need that many other cards via `HeroCondition.requiredMatches`. This packet does **not** count repeated gates itself; it keeps whatever conditions the parser builds and lets the shared evaluator decide. Either packet may land first. See Context.

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). Two layers, a contract-file edit (`economy.types.ts`), a new `G` field, a new `UIState` field and a turn-loop wiring change: fails lightweight-lane criteria 1, 3, 4 and 6.

> Baseline: `origin/main` at `295f9dc5` (includes #2714 reserve, #2722 / D-24694, #2723 / D-24695, #2724 / D-24696). Drafted at `c8c96134`; re-synced 2026-10-12.

---

## Goal

Legendary's **Man (and Woman) Out of Time** (`docs/legendary-universal-rules-v23.md` L1667-1694, rulebook p.29; `keywords-full.json` `manoutoftime`). The rule, verbatim:

> This keyword means "After you use this card's abilities, set it aside. At the beginning of your next turn, play this card a second time and then discard it."
>
> - The card is discarded the second time you play it, so you can only play the card twice. You can't use Man Out of Time again to play that card for a third turn.
> - Play your returning Man Out of Time cards after the "Play a Villain Card" part of your turn and before you start playing out your hand.
> - You "played" a Man Out of Time card on both the first turn you played it and the second turn when you replayed it, so it can help activate your Superpower Abilities on both turns.
> - You can use a Focus ability on a Man Out of Time card throughout the first and second turns you play the card.
> - If a special ability lets you copy (or play a copy of) a Hero card, you can't use Man Out of Time on the copy.
> - Some enemies send your cards Out of Time, setting them aside in the same way. When you play and discard that card at the start of your next turn, you can't use Man Out of Time again.

Rules v23 L3441-3470 (cards you played this turn) adds that a card which moved to "Man Out of Time" still counts as played this turn. Its worked example: a Woman Out of Time card replayed and discarded counts for "play a Hero this turn", but "Reveal a Hero" or "KO one of your Heroes" can't pick it, "since it has already gone to another pile or location". Perfect Teamwork ("for each color of Hero you have") is the passage's next example.

**Today:** Out of Time does nothing. All 16 printed hero lines that carry the token (14 self-keyword lines plus Winter Soldier's two "2>4" grant lines) fall to the parser's unresolved-marker fallback and record `parse-unrecognized` hollows on every play. `runtime-observed-hollows.json` has `man-out-of-time` 77, `woman-out-of-time` 66 and `man/woman-out-of-time` 28. The hero ledger's six `out-of-time` rows read `unsupported`.

**After this session:**
1. **Recognition.** `out-of-time` is a handler-bearing, no-magnitude `HeroKeyword`. The parser resolves a line that is the Out of Time token, behind an optional gate made of `[hc:…]`, `[team:…]` or `[keyword:Savior]` icons. The spellings `Man`, `Woman` and `Man/Woman` are all recognized.
2. **Turn 1.** When the line's gate holds, the handler moves the card out of `inPlay` into the owner's set-aside (`G.outOfTimeCards[playerID]`). It records the card in the turn's played-this-turn ledger, so the card still counts as played for Superpower gates and played-card counts for the rest of the turn.
3. **Turn 2.** On the owner's next start → main advance, each set-aside card is played a second time through the shared play core: printed icons, abilities and the play log line. That advance happens only after the villain card is revealed and every reveal choice is resolved, and before any hand card can be played. The card then goes to the discard pile. It stays in the ledger for the turn and can never go Out of Time a second time.
4. **Copies.** A copied card (Copy Powers, Steal Abilities) never goes Out of Time.
5. **Projection.** A public, per-player `UIPlayerState.outOfTimeCards?: UIDisplayEntry[]`, omitted when empty.
6. **Client.** `PlayedCardsRow` shows the viewer's set-aside cards in a labelled "Out of Time" group.

## User-Visible Impact

- Six heroes play as printed:
  - ca75: Captain America 1941, Agent X-13, Steve Rogers (Director of S.H.I.E.L.D.) and Winter Soldier
  - anni: Brainstorm and Psi-Lord
- When an Out of Time card's gate holds, the card leaves play after its abilities and shows under **Out of Time** in your played row. Next turn, right after you advance past the villain card, it plays again and goes to your discard pile.
- The Hollow effects panel stops listing these lines. Winter Soldier's "2>4" grant lines stay listed (Out of Scope).

---

## Assumes

1. **Keyword lockstep sites** (all in `packages/game-engine/src`; re-read counts at execution, since other keyword WPs move them):
   - `rules/heroKeywords.ts`: the `HeroKeyword` union `:~26-103` and `HERO_KEYWORDS` `:~112-190`, whose last entry is `'spinning-cyclone'`.
   - **Three** `HERO_KEYWORDS.length` pins:
     - `rules/heroKeywords.test.ts:~67`
     - `rules/heroAbility.setup.test.ts:~682`: the length assert; the ordered `expectedKeywords` array sits above it, and `:~712` holds no number
     - `setup/heroAbility.setup.test.ts:~1464`: the X-Gene pin, 77 at draft
   - `hero/heroEffects.execute.ts`:
     - `HANDLED_KEYWORDS` `:~124`
     - `NO_MAGNITUDE_KEYWORDS` `:~469`, the most-missed site: without it the magnitude pre-gate silently drops the effect
     - `HERO_EFFECT_HANDLERS` `:~6107`
     - `MVP_KEYWORDS` `:~426`, derived from the above
   - The handler count is pinned **twice** in `hero/heroEffects.execute.test.ts`, at `:~140` and `:~7873`; both read 60 at draft.
2. **Parser** (`setup/heroAbility.setup.ts`):
   - `KEYWORD_PATTERN` `:~136` cannot match a name with spaces. Today the token reaches `collectUnmatchedKeywordSlugs` `:~2797` via the fallback `:~2560-2581`, which emits `man-out-of-time`, `woman-out-of-time` or `man/woman-out-of-time`. The fallback is skipped automatically once a line resolves a keyword.
   - `LEADING_GATE_PREFIX_PATTERN` `:~131` (D-24628) matches **only** `[hc:]` / `[team:]` prefixes, so the two Savior-gated lines need their own pattern. The leading-prefix pattern itself must not be widened: D-24628 and the fight-cost clause read it.
   - Gate conditions are built in Step 1 / 1b `:~1230-1296`. `[keyword:Savior]` becomes `{ type: 'bystandersInVictoryAtLeast', value: '3' }` `:~1667-1670`.
   - The generic hook builder (`:~2501-2505`) emits one `{ type: keyword }` effect per resolved no-magnitude keyword, so the recognizer pushes the **keyword only**.
   - `KEYWORD_TIMING_DEFAULTS` `:~607` is a `Partial<…>`, so no entry is needed and the hook keeps `onPlay`.
   - `HERO_PARSER_RECOGNIZED_MARKER_NAMES` `:~400-420` feeds the `sim:coverage` probe (`scripts/hero-effect-coverage.mjs:~44,~75`). Its drift test is `setup/heroAbility.setup.test.ts:~1835`.
   - Since D-24696 (#2724) the list ends with `'gain-officer'`, and the drift test's `ALLOWLIST_GATED_NAMES` includes it. The three Out of Time slugs are appended after it; parser anchors shifted about +9..+12 lines.
3. **Executor** (`hero/heroEffects.execute.ts`):
   - `executeHeroEffects` `:~810`. The gate is evaluated at `:~856` (`evaluateAllConditions`), and `executeSingleEffect` `:~6312` dispatches handlers.
   - The executor runs **all** of a card's lines in order, in one pass, without parking any (`:~837-979`). A line that opens a choice (e.g. `put-hand-on-deck-top` `:~3166`) leaves the choice pending while the later lines still run. On every in-scope card, the Out of Time line is the **last** line.
   - Copy re-fire sites:
     - `applyCopyPowers` `:~4913-4976` calls `executeHeroEffects(…, chosenHeroId)` with the real in-play card's id. That card is always earlier in `inPlay` than Rogue's card, on both the immediate and the `resolveCopyPowersChoice` path.
     - `heroEffectStealAbilities` `:~5074-5160` re-fires on a card sitting in the discard pile.
   - No copy flag exists.
4. **Gate semantics** (`hero/heroConditions.evaluate.ts`):
   - `heroClassMatch` / `requiresTeam` need one **other** played card and exclude the card itself (`:~110-151`).
   - Savior reads `playerZones.victory` (`:~334-351`).
   - None of hc / team / Savior is wait-and-see (`hero/deferredConditionalGrants.ts:~67-90`).
   - Today four identical `requiresTeam` conditions AND to "one other". WP-741 changes that repo-wide; this packet is neutral to it.
5. **Played-this-turn chokepoint.** `playedCardIdsThisTurn(G, inPlay)` (`hero/splitCard.logic.ts:~169`) is the only rules-facing "played this turn" read. It expands Penumbra's `turnEconomy.bothSidesPlayedCardIds` and has 28 non-test callers on `main` after D-24694 (#2722), classified in §Played-vs-Have Map.
   - Every "played" caller evaluates the **active** player, so an active-player-scoped `TurnEconomy` ledger is correct.
   - `TurnEconomy` is reset by `resetTurnEconomy()` at every turn start (`game.ts:~924` and the sim / PAR / fixture rotations).
   - Ledger template:
     - `CarriedTurnFields` (`economy/economy.logic.ts:~481`) and `carryConversionFlag` (`:~520`) carry `bothSidesPlayedCardIds` (`:~543`), only when defined.
     - `markBothSidesPlayed` (`:~973`) is the append-helper template.
6. **Play core.** `applyCardPlay(G, context: Omit<MoveContext, 'G' | 'playerID'>, playerID, cardId)` (`moves/coreMoves.impl.ts:~285-332`) does four things:
   1. appends to `inPlay`
   2. credits `cardStats` attack / recruit
   3. logs `Player N played …`
   4. sets `G.lastPlayEffectsFired = executeHeroEffects(…)`
   It has no stage check, and its only caller is `playCard` `:~593`. `playCard` is allowed only in `main` (`moves/coreMoves.gating.ts:29`), `endTurn` only in `cleanup` (`:34`).
7. **Stage advance.** start → main happens only through `advanceTurnStage` (`turn/turnLoop.ts:~121-158`; `TurnLoopContext` `:~20-38` with its `cleanup` closure). It has exactly five callers:
   - `game.ts:~259` (`advanceStage`, after the reveal gate `:~249` and the block-all guards `:~136-237`). It destructures only `{ G, ctx, events, random }` today.
   - `simulation/simulation.runner.ts:~306`
   - `simulation/par.aggregator.ts:~466`
   - `test/fixtures/runFixture.ts:~153`
   - `replay/replay.execute.ts:~114`

   Nothing in `packages/`, `apps/` or `scripts/` writes `currentStage = 'main'` any other way. Three test files construct `TurnLoopContext`: `turn/turnLoop.test.ts`, `turn/turnLoop.integration.test.ts` and `rules/tacticHandlers.test.ts`. The server bot autoplay submits through `Master.onUpdate`, so the live `advanceStage` runs.
8. **Set-aside precedent.** `G.pendingTeleportReturns?` (`types.ts:~2227`) holds a card in no zone, lazily created. `G.deferredHandInjections?: Record<string, CardExtId[]>` (`types.ts:~1878`) is the per-player lazy-map shape. Omit-when-absent keeps the hash oracles byte-identical for matches with no Out of Time card: `computeStateHash` (`replay/replay.hash.ts:~67`, `PRE_WP080_HASH` `replay.execute.test.ts:~181`) and `hashGameState` (the sentinel `finalStateHash`). None of these boards carries a ca75 / anni hero: the sentinel deck is core, PRE_WP080 is the empty replay, and the PAR `HERO_POOL` is core-only. `PlayerZones` (`state/zones.types.ts:~41-61`) is **not** touched.
9. **Projection.**
   - `UIPlayerState` is at `ui/uiState.types.ts:~449-585`. The public per-player precedent is `victoryCards?: UIDisplayEntry[]` `:~573`.
   - The build loop is `ui/uiState.build.ts:~709-831`, with `buildDisplayEntries(zone, G)` at `:~233`.
   - The filter has two helpers, and a public field is added to **both**: `redactHandCards` `:~222-283` (passes `victoryCards` via `deepCopyDisplayEntries` `:~272`) and `preserveHandCards` `:~291-403` (`:~393`).
   - The public matrix test is at `uiState.filter.test.ts:~298-322`; the `UIPlayerState` built-projection keyset pins are in `uiState.types.drift.test.ts`.
   - Play Diagnostics exports the viewer's audience-filtered UIState snapshot (`DiagnosticExportButton.vue:67`).
10. **Client.**
    - `PlayedCardsRow.vue` has props `inPlayCards` / `inPlayDisplay` `:~26-40`, the heading "Played This Turn — N" `:~103-104` and an empty state `:~110`.
    - It is mounted in `PlayDesktop.vue:~946-951` and in the `PlayMobile.vue:~666-671` band.
    - The viewer is the player whose `handCards` is defined (`PlayDesktop.vue:~424-435`).
11. **Coverage feeds.**
    - `scripts/hero-mechanic-ledger.mjs`:
      - `BY_HOOK_KEYWORDS` `:162` holds transform, excessive-violence, blood-frenzy and day-night-both.
      - The `out-of-time$` fold is at `:~298`.
      - Rows are hero × mechanic; `statusForMechanic` is at `:~371-417`.
    - `scripts/coverage/mechanic-provenance.json` (`phasing` `:35` is the template).
    - `sim:coverage` baseline `unsupportedMechanics`: `man-out-of-time` 8, `man/woman-out-of-time` 4, `woman-out-of-time` 4.
    - The dashboard pin is `useInPlayCoverage.test.ts:~557-558` (`totalObs 8897`, `percentResolved 13.9`). `in-play-hollow-baseline.json` has no out-of-time keys.
    - The raw runtime keys (`man-out-of-time` …) are never folded to the ledger's `out-of-time`.
    - `hero/gateOnlyHollow.test.ts:~32,~115-119` uses `'[keyword:Savior]: [keyword:Man Out of Time]'` as its gate-only-hollow example.
12. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**; reconcile the WP and D-24692 first. Line anchors are `~` approximate; re-read at execution.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` L1667-1694 (the keyword), L3441-3470 (cards you played this turn), L522-533 (turn order: villain card first), L1844-1853 (Savior).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative), §Persistence Boundaries, §The Turn Stage Cycle; `.claude/rules/architecture.md` §Zone Contents, §Move Validation Contract, §UIState Projection Integrity, §Phase & Turn Transitions; `.claude/rules/code-style.md` §Drift Detection (runtime pins).
- `docs/ai/REFERENCE/00.2-data-requirements.md` (CardExtId naming; no field renames).
- `docs/ai/DECISIONS.md`: D-24526, D-24619, D-24556, D-24563 (WP-741, drafted), D-24628, D-24520, D-24567, D-24322, D-24616 §5, D-24687 §4, D-12803, D-24026. Scan for any later entry touching `playedCardIdsThisTurn` or `TurnLoopContext`.
- `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` (the five `advanceTurnStage` callers are wiring).
- `docs/ai/work-packets/WP-741-*.md` (the order-independent sibling).
- User memory: `reference_hero_keyword_lockstep_sites`, `reference_three_bgio_bypassing_turn_loops`, `reference_simulation_harness_bypasses_bgio`, `reference_hashed_g_field_dual_repin`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_sim_coverage_baseline_gate_distinct`.

**Why one packet across engine and client.** The engine half removes a card from the played row and brings it back a turn later. Without a render, a played card just vanishes from the board. The client half is one prop on an existing row plus two page mounts: six files, half of them tests. So the WP-783 / WP-776 single-packet precedent applies. Splitting would ship either a projection with no consumer or a disappearing card.

**Why the card leaves `inPlay` (and the alternative rejected).** The rules say three things:
- The card is set aside *after you use its abilities*, and on turn 2 it is discarded *after* the second play.
- Effects that need the card's location ("Reveal a Hero", "KO one of your Heroes", "Heroes you have") can't pick it.
- Superpower counts still see it.

The rejected alternative left the card in `inPlay` until cleanup and diverted it there. That needs no ledger, but WP-801's "KO one of your Heroes" auto-pick and every "you have" read could then take a card the rules put out of reach, on both turns.

The chosen design moves the card out on both turns and keeps it countable through the one existing chokepoint, `playedCardIdsThisTurn`, which Penumbra already extends the same way.

**Why the replay hangs on start → main.** That advance is the exact rules window. The `advanceStage` reveal gate and block-all guards mean it fires only after the villain card is revealed and its choices are resolved. `playCard` is `main`-only, so no hand card can come first. All five turn loops already route the advance through `advanceTurnStage`, so one required closure covers live play, sim, PAR, fixtures and replay with no per-harness logic.

**Why repeated gates are left to WP-741.** Agent X-13's Sniper Squad (`[team:shield]`×4) and Psi-Lord's Reshape Reality (`[team:fantastic-four]`×2) need that many other cards. That is the repo-wide WP-741 / D-24563 fix, which counts any leading repeated prefix through `HeroCondition.requiredMatches` and already sweeps Sniper Squad's line. It also retires `countRepeatedBothCondition`. If this packet counted repeats itself, it would fork that design and collide with its retirement. Instead the Out of Time hook keeps the parser's gate conditions exactly as built, so it is right before WP-741 (today's one-other evaluation) and after it.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. No `.reduce()` with branching. All randomness goes through the move context (`ctx.random` via the passed context). No `Math.random`, clocks or I/O in engine code.
- Zones and the new set-aside hold `CardExtId` strings only.
- The client renders a projection only; the engine decides every outcome.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24692) before coding. One WP per session.

**Packet-specific:**
- **Keyword.**
  - `'out-of-time'` is appended last to the `HeroKeyword` union and `HERO_KEYWORDS`, and joins `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` and `HERO_EFFECT_HANDLERS` (handler `heroEffectOutOfTime`).
  - All three length pins and both handler-count asserts move by +1.
  - `'man-out-of-time'`, `'woman-out-of-time'` and `'man/woman-out-of-time'` are appended to the exported `HERO_PARSER_RECOGNIZED_MARKER_NAMES` literal (not `RECOGNIZED_NON_KEYWORD_MARKERS`, which the keyword loop reads). Its drift test routes them to a `SPACE_FORM_WHOLE_LINE_NAMES` branch that builds `[keyword:Man Out of Time]` / `[keyword:Woman Out of Time]` / `[keyword:Man/Woman Out of Time]` and asserts `'out-of-time'` is in `keywords` with `unresolvedMarkers` `[]`. It is an asserting branch, never a bare `continue`. The `sim:coverage` probe then stops counting resolved lines. A hero whose hooks still leave the slug unresolved (2>4) keeps being flagged.
- **Parser recognizer** (`setup/heroAbility.setup.ts`):
  - `OUT_OF_TIME_LINE_PATTERN = /^\s*(?:(?:(?:\[(?:hc|team):[^\]]+\]|\[keyword:Savior\])\s*)+:\s*)?\[keyword:(?:Man|Woman|Man\/Woman) Out of Time\]\s*$/`.
  - The recognizer runs **after** the Step 2 keyword loop. There is no early-return fast path in `parseAbilityText`, which would bypass WP-741's prefix collapse if WP-741 lands later.
  - When a line matches, it pushes keyword `'out-of-time'` only: the generic builder emits the single `{ type: 'out-of-time' }` effect. It keeps its gate conditions exactly as Step 1 / 1b and the Savior arm build them today (or as WP-741 builds them, if WP-741 landed first). It adds no unresolved slug.
  - A line where the token sits inside other text (Winter Soldier "2>4") does not match and keeps today's unresolved slug.
- **Handler `heroEffectOutOfTime(G, ctx, playerID, cardId, effect)`.** It applies only when **all** of the following hold. Otherwise it pushes one `blocked` log sentence naming the reason and returns.
  1. `cardId` is not already in `G.turnEconomy.outOfTimePlayedCardIds`, which rules out a replay, or a card that already went Out of Time this turn. Reason: `… is not set aside again: a card goes Out of Time only once.`
  2. `cardId` is in the player's `inPlay`. Steal Abilities re-fires a card from the discard pile, so it fails here. Reason: `… is not set aside: a copy can't use Out of Time.`
  3. `cardId` is the **last** entry of the player's `inPlay`, i.e. the card being played now. The Copy Powers target is always earlier. Reason: the copy sentence above.

  On apply:
  - Remove `cardId` from `inPlay`.
  - Append it to `G.outOfTimeCards[playerID]`, creating the map and key lazily.
  - Set `G.turnEconomy = recordOutOfTimePlayed(G.turnEconomy, cardId)`.
  - `pushLog` `Player N set <formatCardRef(cardId)> aside Out of Time; it plays again at the start of their next turn.` (`applied`).
- **Set-aside storage** (`types.ts`): `LegendaryGameState.outOfTimeCards?: Record<string, CardExtId[]>`. It is never written at setup. A player key is deleted when its list empties, and the field is deleted when no key remains. Order is set-aside order.
- **Ledger** (`economy/economy.types.ts`, contract file — D-24692): `TurnEconomy.outOfTimePlayedCardIds?: CardExtId[]`, lazily materialized, active-player-scoped (JSDoc says so).
  - It joins `CarriedTurnFields` and `carryConversionFlag`, carried only when defined.
  - Helper `recordOutOfTimePlayed(economy, cardId)` in `economy/economy.logic.ts` follows the `markBothSidesPlayed` shape.
  - `resetTurnEconomy()` drops it with no edit.
- **Played vs have** (`hero/splitCard.logic.ts`):
  - `playedCardIdsThisTurn(G, inPlay)` returns today's Penumbra-expanded `inPlay`, then appends each `G.turnEconomy?.outOfTimePlayedCardIds` entry not already present.
    - It reads optionally, because minimal-G slices without `turnEconomy` reach it via `heroConditionHoldsForInPlay`.
    - It appends on **both** paths, including the Penumbra-absent early return.
    - It always returns a fresh array.
    - Its JSDoc states the active-player scope.
  - New export `playedCardIdsStillInPlay(G, inPlay)` returns exactly today's result.
  - The ten "have" callers in §Played-vs-Have Map switch to `playedCardIdsStillInPlay`, each with a `// why:` citing rules v23 L3443-3447 (moved cards "don't count as 'Your Heroes' or 'Heroes you Have'") and L3457-3470. The eighteen "played" callers are unchanged.
- **Turn-start replay** (`moves/outOfTime.logic.ts`, new): `replayOutOfTimeCards(G, context, playerID): void`.
  - It returns early, mutating nothing, when the player has no entry or no `playerZones`.
  - Otherwise it snapshots the list, deletes the player key once (and the field when no key remains), then loops the **snapshot** in order:
  1. (The card is already off the set-aside.)
  2. `G.turnEconomy = recordOutOfTimePlayed(G.turnEconomy, cardId)`. The pre-record makes the handler's guard 1 block a second set-aside.
  3. `pushLog` `Player N's <card> returns from Out of Time and is played a second time.` (outcome `neutral`)
  4. `applyCardPlay(G, context, playerID, cardId)`.
  5. If the card is still in `inPlay`, move it to the end of `discard`.

  It never throws, and has no stage check (the caller is the window). It makes no `recordCardDiscardedThisTurn` and no `discardFromHand` call: the end-of-play discard is the keyword's own cleanup, not "you discarded".
- **Wiring** (01.5):
  - `TurnLoopContext` gains a **required** `beginMain: (startingPlayerID: string) => void`.
  - `advanceTurnStage` calls `context.beginMain(context.currentPlayer)` inside `if (nextStage === 'main')`, **after** the `logMeta.actionInStep = 0` reset and before the `return`, so the replay's log lines number from the fresh step. It carries a `// why:`, and `turnLoop.test.ts` asserts the order. It is called on no other transition.
  - Bindings:
    - `game.ts` `advanceStage` takes the full move context (`({ G, ...context })`, keeping its `ctx` / `events` / `random` reads from that rest) and binds `(startingPlayerID) => replayOutOfTimeCards(G, context, startingPlayerID)`.
    - The four harness wrappers bind their own move context the way their `MOVE_MAP.playCard` entries pass it.
  - The three test files that construct `TurnLoopContext` pass a no-op or recording closure.
  - No `ctx.events.*` call is added. There is no new move, so `game.ts` moves and `CORE_MOVE_NAMES` / the sim / replay maps are unchanged.
- **Projection** (five steps): `UIPlayerState.outOfTimeCards?: UIDisplayEntry[]`.
  - Build it with `buildDisplayEntries(G.outOfTimeCards?.[playerId] ?? [], G)`, omitted when empty.
  - It is **public**: copied with `deepCopyDisplayEntries` in both `redactHandCards` and `preserveHandCards`, the `victoryCards` disposition. The card was played face-up and is set aside in the open.
  - Tests cover all three audiences, and a **runtime** keyset pin on a built projection (an optional field passes `satisfies`; code-style §Drift Detection).
- **Client** (`PlayedCardsRow.vue`):
  - New optional prop `outOfTimeCards?: UIDisplayEntry[]`, default `[]`.
  - When non-empty, it renders a labelled group (`data-testid="play-out-of-time"`) inside the existing well, before the played cards. The heading is `Out of Time — returns next turn`, with one `CardTile` per entry.
  - The "Played This Turn — N" count stays `inPlayCards.length`. The empty-state text shows only when both lists are empty.
  - `PlayDesktop.vue` and `PlayMobile.vue` pass the viewer's `outOfTimeCards`. There is no new layout slot, so the 1280×720 cockpit does not grow. No client rule logic.
- **Bots:** no change to `ai.legalMoves.ts`, `ai.competent.ts` or `apps/server`. The replay is automatic, so every loop that advances the stage gets it.
- **Determinism.** No randomness is added; the replayed play draws through the passed context exactly as a hand play does. In a match without an Out of Time card, no `G` field is written. So the sentinel `finalStateHash`, `PRE_WP080_HASH` and PAR are expected unchanged; a change = STOP.

## Played-vs-Have Map (locked — all 28 `playedCardIdsThisTurn` callers, re-synced to `main` after D-24694 / #2722)

**"Have" (10): switch to `playedCardIdsStillInPlay`.** These are hand + play "you have" / reveal-style reads. Rules v23 L3443-3447: cards you played that moved elsewhere "still count as 'cards you played this turn,' but they don't count as 'Your Heroes' or 'Heroes you Have.'"
- `hero/heroConditions.evaluate.ts`:
  - `:~311` (`heroCostAtLeastInHandOrPlay`)
  - `:~355` (cheap-or-size-changing gate)
  - `:~620` (`countDistinctHeroClassesYouHave`, "each color of Hero you have", Perfect Teamwork / Storm the Beachhead line 0 / International Strike Force). Since D-24694 (#2722) it is also the Spectrum gate and describe count ("only if you have at least 3 classes of Hero", rules L1946-1953, hand + play; the Jeff-confirmed "have" ruling), so Spectrum moves with this one site.
  - `:~653` (`countDistinctHeroCostsInHandOrPlay`)
  - `:~747` (`countCheapOrSizeChanging`)
- `hero/heroCountSource.resolve.ts` `:~692` (`collectDistinctHeroClassCards`, the diagnostics mirror of `:~620`)
- `villain/villainEffects.execute.ts` `:~1671` (`playerHasHeroMatchingTrait`) and `:~1708` (`countPlayerHeroesMatchingTrait`)
- `rules/tacticHandlers.ts` `:~675` (`resolveXaviersNemesis` → `countXMenHeroesYouHave`)
- `moves/villainDefeatRequirement.logic.ts` `:~73` (D-24076: "have" is hand or in play)

**"Played" (18): unchanged, so they now see the ledger.** These are Superpower gates and per-played-card counts.
- `hero/heroConditions.evaluate.ts` `:~119, ~140, ~164, ~188, ~200, ~475, ~800`
- `hero/heroCountSource.resolve.ts` `:~119, ~159, ~202, ~274, ~315, ~353, ~481, ~521, ~561, ~595, ~633`

If execution finds a caller whose semantics contradict its bucket, STOP and amend this map + D-24692. Do not reclassify silently.

## Card Map (locked — every recognized line)

| Card | Set | Line | Gate (as parsed today) |
|---|---|---|---|
| agent-x-13 / sniper-squad | ca75 | `[team:shield]`×4: Woman Out of Time | 4 × `requiresTeam shield`; "four other" once WP-741 lands |
| agent-x-13 / spy-network | ca75 | `[hc:covert]`: Woman Out of Time | 1 other Covert |
| captain-america-1941 / devoted-patriot | ca75 | `[hc:strength]`: Man Out of Time | 1 other Strength |
| captain-america-1941 / storm-the-beachhead | ca75 | Man Out of Time | none |
| captain-america-1941 / punch-evil-in-the-face | ca75 | `[keyword:Savior]`: Man Out of Time | 3+ Bystanders in Victory Pile |
| steve-rogers-director-of-shield / shadow-of-wars-past | ca75 | `[keyword:Savior]`: Man Out of Time | Savior |
| winter-soldier / bionic-arm | ca75 | `[hc:tech]`: Man Out of Time | 1 other Tech |
| winter-soldier / sniper-nest | ca75 | `[hc:tech]`: Man Out of Time | 1 other Tech |
| brainstorm / time-loop-experiments | anni | `[hc:tech]`: Woman Out of Time | 1 other Tech |
| brainstorm / borrow-from-the-future | anni | `[hc:ranged]`: Woman Out of Time | 1 other Ranged |
| psi-lord / avert-future-tragedy | anni | `[hc:instinct]`: Man/Woman Out of Time | 1 other Instinct |
| psi-lord / interdimensional-rescue | anni | `[hc:covert]`: Man/Woman Out of Time | 1 other Covert |
| psi-lord / slip-the-timestream | anni | `[hc:instinct][hc:covert]`: Man/Woman Out of Time | 1 other Instinct AND 1 other Covert |
| psi-lord / reshape-reality | anni | `[team:fantastic-four]`×2: Man/Woman Out of Time | 2 × `requiresTeam fantastic-four`; "two other" once WP-741 lands |

That is 14 lines on 14 cards. Each card's other lines are unaffected.

**Not recognized (stay honest hollows):** winter-soldier / 2-4, both lines ("A Hero in your hand gains [keyword:Man Out of Time] this turn" and its `[hc:tech]` sibling).

## Locked Values

- **Keyword.** `'out-of-time'`, appended last in `HERO_KEYWORDS`. It is a member of `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` and `HERO_EFFECT_HANDLERS` (`heroEffectOutOfTime`). Three length pins +1; both handler-count asserts +1.
- **Marker names.** `HERO_PARSER_RECOGNIZED_MARKER_NAMES` gains `'man-out-of-time'`, `'woman-out-of-time'` and `'man/woman-out-of-time'`.
- **Pattern.** `OUT_OF_TIME_LINE_PATTERN` exactly as in Constraints. The recognizer pushes the keyword only.
- **Storage.**
  - `LegendaryGameState.outOfTimeCards?: Record<string, CardExtId[]>`, delete-when-empty at both levels.
  - `TurnEconomy.outOfTimePlayedCardIds?: CardExtId[]`, with helper `recordOutOfTimePlayed(economy, cardId)`.
- **Functions.**
  - `playedCardIdsStillInPlay(G, inPlay)`, exported from `hero/splitCard.logic.ts`.
  - `replayOutOfTimeCards(G, context, playerID)`, exported from `moves/outOfTime.logic.ts`.
  - `TurnLoopContext.beginMain: (startingPlayerID: string) => void` (required), called only inside `if (nextStage === 'main')`.
- **Projection.** `UIPlayerState.outOfTimeCards?: UIDisplayEntry[]`, public, omitted when empty.
- **Log lines** (full sentences):
  - `Player N set <card> aside Out of Time; it plays again at the start of their next turn.`
  - `Player N's <card> returns from Out of Time and is played a second time.`
  - Blocked: `<card> is not set aside again: a card goes Out of Time only once.`
  - Blocked: `<card> is not set aside: a copy can't use Out of Time.`
  - Outcomes: set-aside `applied`; return `neutral`; the two blocked lines `blocked`.
- **Client.** Test id `play-out-of-time`; heading `Out of Time — returns next turn`.
- **Ledger.** `'out-of-time'` joins `BY_HOOK_KEYWORDS`. Provenance: `"out-of-time": { "wp": "WP-803", "decision": "D-24692" }`.

---

## Scope (In)

- **A) Keyword + parser.**
  - `rules/heroKeywords.ts` + test.
  - `rules/heroAbility.setup.test.ts`: the ordered array and the length pin.
  - `setup/heroAbility.setup.ts`: the recognizer and the recognized-marker names.
  - `setup/heroAbility.setup.test.ts`: the X-Gene pin, the recognized-names drift exemption, and parse tests:
    - each spelling (Man / Woman / Man/Woman)
    - bare token, hc gate, Savior gate (Punch Evil, Shadow of Wars Past), the `[team:shield]`×4 gate and the mixed `[hc:instinct][hc:covert]` gate. For each gate, assert that the Out of Time hook's `conditions` deep-equal those built (via `buildHeroAbilityHooks`) for the same gate prefix over a gate-only body such as `'<prefix> You may KO a card from your hand or discard pile.'`. Never assert literal counts, so the test holds before and after WP-741.
    - the two 2>4 lines stay unresolved
  - `hero/gateOnlyHollow.test.ts`: swap its example for the synthetic `'[keyword:Outwit]: [keyword:Danger Sense 2]'` (a gate plus an unresolved space-form slug; no real-data line remains), keep every assertion's intent, and add a positive assertion that Punch Evil's line now resolves `out-of-time`. This is a mandated change because the old example now resolves, so it carries a `Tests-changed:` trailer.
- **B) Handler + ledger.**
  - `hero/heroEffects.execute.ts` + test: the handler, the three sets, and both count asserts.
  - `economy/economy.types.ts` and `economy/economy.logic.ts` + test.
  - `hero/splitCard.logic.ts` + test.
  - The ten "have" sites: `hero/heroConditions.evaluate.ts`, `hero/heroCountSource.resolve.ts` (+ test), `villain/villainEffects.execute.ts`, `rules/tacticHandlers.ts` and `moves/villainDefeatRequirement.logic.ts`.
  - `types.ts`.
- **C) Replay + wiring.**
  - `moves/outOfTime.logic.ts` + `.test.ts` (new).
  - `turn/turnLoop.ts` + `turnLoop.test.ts`, `turnLoop.integration.test.ts`, `rules/tacticHandlers.test.ts` (context closures).
  - `game.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts` and `replay/replay.execute.ts`.
  - `game.test.ts`: one boardgame.io-reducer test. A seat with a card in `outOfTimeCards` reveals and advances; afterwards the card is in `discard`, its play log line is present and its economy is credited. This is the only faithful test of the live wiring (`reference_simulation_harness_bypasses_bgio`).
- **D) Projection.** `ui/uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`, `uiState.filter.test.ts` and `uiState.types.drift.test.ts`.
- **E) Client.** `PlayedCardsRow.vue` + test, `pages/PlayDesktop.vue` + test and `pages/PlayMobile.vue` + test. The page-mount tests check that a snapshot with the viewer's `outOfTimeCards` renders exactly one `play-out-of-time` group, and that a snapshot without it renders none.
- **F) Feeds.**
  - `scripts/hero-mechanic-ledger.mjs` (`BY_HOOK_KEYWORDS`) and `scripts/coverage/mechanic-provenance.json`.
  - Regenerate the hero ledger (json + csv), `card-mechanics.json`, the effect index, `runtime-observed-hollows.json` and the `sim:coverage` baseline.
  - Re-pin the dashboard `useInPlayCoverage.test.ts`.
- **G) Tests** (beyond A–E). Cover:
  - **Devoted Patriot, gate met** (another Strength card played first). Assert exact arrays on turn 1:
    - `inPlay` loses the card
    - `outOfTimeCards[p] = [card]`
    - the ledger holds the card
    - line 0's draw happened
    - a later `[hc:strength]` card played the same turn sees it as played
  - **Devoted Patriot, gate unmet:** stays in `inPlay` and is discarded at cleanup as today.
  - **Turn 2 replay.** After `revealVillainCard` + `advanceStage`, the card is played once more:
    - `Player N played` log line, printed icons credited, line 0's draw fires
    - it ends last in `discard` and stays in the ledger
    - it is not set aside again (blocked log; `outOfTimeCards` absent)
  - **No early replay** (`game.test.ts`, via the reducer, since `advanceStage` is local to `game.ts`): while a reveal choice is pending, or before `revealVillainCard`, `advanceStage` is refused and nothing replays. The turn-2 replay assertions live in the same reducer test.
  - **Two set-aside cards** replay in set-aside order.
  - **Time Loop Experiments** (its `put-hand-on-deck-top` line parks a choice):
    - turn 1: the card goes Out of Time while the choice is pending, and the choice still resolves
    - turn 2: the replay opens the choice in `main`, and it resolves after the card is discarded
  - **Copy Powers** copying an earlier-played Out of Time card whose gate failed: the original is not set aside (copy log).
  - **Steal Abilities** on an Out of Time card in the discard pile: no set-aside.
  - **The have / played split** (in `moves/outOfTime.logic.test.ts`):
    - each "have" bucket's representative ignores a ledger-only card: `heroCostAtLeastInHandOrPlay`, `countDistinctHeroClassesYouHave`, Spectrum, and WP-801's KO candidates via raw zones
    - a "played" count source counts the card exactly once during the replay
    - `playedCardIdsThisTurn` on a G slice with no `turnEconomy` returns a fresh copy of `inPlay` without throwing
  - **No Out of Time card in the match:** `outOfTimeCards` and `outOfTimePlayedCardIds` stay absent (runtime keyset assertion).
  - **Projection:** omitted when empty; present for all three audiences when set.

## Out of Scope

- **Winter Soldier "2>4"** ("A Hero in your hand gains Man Out of Time this turn" plus its `[hc:tech]` "another Hero" line). It needs a new capability: choosing a hand card (a pending choice plus a client chooser), and a per-turn granted-keyword map that the handler consults when that card is played. That is a different primitive from the self-keyword, so it is a named follow-up WP; its lines stay honest hollows.
- **Repeated-gate counts** (Sniper Squad, Reshape Reality): WP-741 / D-24563 (see Context).
- **Enemy-sent Out of Time** (anni): Pharaoh Rama-Tut's Fight, Scarlet Centurion's Ambush, and the Kang tactics "Savior From Another Timeline" (sends a card) and "Iron Lad Grows Up to Become Kang" (reads the set-aside). This packet's storage and guard 1 ("can't go Out of Time again") admit them; the villain primitives are a follow-up.
- **Iron Lad** gained as a Hero (anni villain hero text). It is not built into hero hooks today.
- **Focus** (Psi-Lord line 0) is unimplemented engine-wide. "Focus across both turns" lands with Focus.
- **Replay order and pending choices.** When several cards return, the rules let you play them in any order, and you finish one card's effect before playing the next. Here they replay in set-aside order, and a later card replays even while an earlier card's choice is pending (each choice still resolves). Recorded as deviations in D-24692.
- **Bot and choice-opening plays: resolved on `main` by D-24695 (#2723).** The Watch Bot Play autoplay's `playHandCards` now drains a pending choice after each hand play. A choice parked by Time Loop Experiments or Spy Network played from hand is drained after that play. A choice parked by the turn-2 replay (inside `advanceStage`) costs one refused `playCard` before the post-play drain resolves it; D-24697 (in flight) also drains before the first hand play. Either way the hand still plays out. The bot-ally driver always picked moves from `getLegalMoves` and was never affected, and neither were the sim / PAR loops. No server edit is in this packet.
- **End-of-game "all your cards" scoring** (`scoring/scoring.logic.ts:~131-143`, Ultron's Tech count and its Blood Frenzy mirror) does not include set-aside cards. This only matters when the game ends between a card's two turns; it is a named follow-up.
- **Opponent display** of set-aside cards (the field is public, so an `OpponentPanel` count is a follow-up), and `notableEventCardLookup` coverage of the new zone.
- **Copy Powers targeting a set-aside card.** `buildCopyPowersTargets` keeps scanning raw `inPlay`, so a set-aside card can't be copied after it leaves play. Recorded as a deviation in D-24692.
- **Dashboard alias folding.** The runtime keys (`man-out-of-time` …) never join the ledger's folded `out-of-time`, so the in-play gauge cannot credit them as resolved; it moves only because the denominator shrinks. Named follow-up.
- **`replay/replay.execute.ts` turn-economy posture (D-24322).** That harness does not reset `turnEconomy` between turns, so its ledger persists. A card cycling Out of Time twice in one match can replay differently there; this affects replay-producer snapshots only. Inherited from Penumbra, unchanged.
- **Pre-deploy matches.** A pre-deploy ca75 / anni log that played any recognized Out of Time line (including the ungated Storm the Beachhead) no longer re-executes byte-identically. This is the accepted window of WP-792 / WP-793 / WP-801 (D-24687 §4); stored `competitive_scores` stay frozen (D-24616 §5).
- **Agent X-13 Spy Network line 0** ("Choose one: Gain a S.H.I.E.L.D. Officer, or +2 Attack") is fixed separately by D-24696 (#2724). It now parks the WP-679 choose-one, so like Time Loop Experiments the card goes Out of Time with that choice pending on turn 1 and re-opens it on its turn-2 replay. The executor still runs every line in one pass (Assumes 3); no extra scope.

## Files Expected to Change

- `packages/game-engine/src/moves/outOfTime.logic.ts` + `.test.ts` — **new** (the turn-2 replay)
- `packages/game-engine/src/rules/heroKeywords.ts` (+ `.test.ts`), `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.ts` (+ `.test.ts`), `hero/gateOnlyHollow.test.ts` — modified (keyword, recognizer, recognized names, pins, fixture swap)
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ `.test.ts`) — modified (handler + keyword sets + count asserts)
- `packages/game-engine/src/economy/economy.types.ts`, `economy/economy.logic.ts` (+ `.test.ts`) — modified (ledger field, carry, helper)
- `packages/game-engine/src/hero/splitCard.logic.ts` (+ `.test.ts`) — modified (ledger in `playedCardIdsThisTurn`; new `playedCardIdsStillInPlay`)
- `packages/game-engine/src/hero/heroConditions.evaluate.ts`, `hero/heroCountSource.resolve.ts` (+ `.test.ts`), `villain/villainEffects.execute.ts`, `rules/tacticHandlers.ts`, `moves/villainDefeatRequirement.logic.ts` — modified (the ten "have" sites)
- `packages/game-engine/src/types.ts` — modified (`outOfTimeCards?`)
- `packages/game-engine/src/turn/turnLoop.ts` (+ `turnLoop.test.ts`, `turnLoop.integration.test.ts`), `rules/tacticHandlers.test.ts` — modified (`beginMain`)
- `packages/game-engine/src/game.ts`, `game.test.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`, `replay/replay.execute.ts` — modified (01.5 wiring + reducer test)
- `packages/game-engine/src/ui/uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`, `uiState.filter.test.ts`, `uiState.types.drift.test.ts` — modified (five-step projection)
- `apps/arena-client/src/components/play/PlayedCardsRow.vue` (+ `.test.ts`), `pages/PlayDesktop.vue` (+ `.test.ts`), `pages/PlayMobile.vue` (+ `.test.ts`) — modified
- `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — modified
- Regenerated: `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv`, `data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`; re-pinned: `apps/dashboard/src/composables/useInPlayCoverage.test.ts`
- Governance: `docs/ai/DECISIONS.md` (D-24692), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

**That is 57 files:** 18 tests, 7 regenerated feeds or pins, 5 governance, 6 one-line wiring closures and 5 files of one-call "have" switches. The new logic is one handler, one replay helper (~40 lines), the parser recognizer and the projection. The count exceeds the ~8-file guidance for the same reason WP-783 did: the keyword lockstep, the five turn loops and the coverage feeds are mandatory co-movers, and none of them carries independent value.

## Contract

- The Locked Values.
- `playedCardIdsThisTurn` means "played this turn, wherever the card went" (active player). `playedCardIdsStillInPlay` means "played and still in play"; the "have" reads use it.
- The start → main transition is the single Out of Time replay point. Every turn loop reaches it through `advanceTurnStage`.
- A card goes Out of Time at most once per play-chain. That is enforced by the ledger guard, the copy guards and the replay's pre-record.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §22 / §24 (replay / ranked fairness), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** none for new play. §22 / §24: pre-deploy ca75 / anni logs that played any recognized Out of Time line no longer re-execute byte-identically. That is the accepted window of D-24687 §4; stored scores stay frozen per D-24616 §5.
**Non-Goal proximity:** not crossed.
**Determinism:** no new randomness. The replay runs at a fixed point in a fixed order, so every turn loop computes the same result. The sentinel, `PRE_WP080_HASH` and PAR oracles are unchanged, because no Out of Time card is on those boards. The `sim:runtime-observed` sweep moves because it plays ca75 / anni boards; that is a legitimate behavior-driven regeneration.

## Funding Surface Gate

§20 **N/A** (no monetization surface).

## API Catalog

§21 **N/A** (no HTTP endpoint or `apps/server` library change).

---

## Acceptance Criteria

1. **Parsing.** Each Card Map line parses to keyword `out-of-time` with no unresolved marker and with its gate conditions as built today. That includes both Savior lines (Punch Evil in the Face, Shadow of Wars Past). The 2>4 lines are unchanged.
2. **Turn 1, gate met.** A played Out of Time card leaves `inPlay` into `G.outOfTimeCards[player]` after its other lines resolve and logs the set-aside line. For the rest of the turn it still counts as played for Superpower gates and count sources, but not for the ten "have" reads (incl. Spectrum, via `countDistinctHeroClassesYouHave`).
3. **Turn 1, gate unmet.** The card stays in `inPlay` and is discarded at cleanup.
4. **Turn 2 replay.** On the owner's next turn, after `revealVillainCard` and `advanceStage`, each set-aside card is played once more through `applyCardPlay`, in set-aside order: play log line, printed icons, abilities. Afterwards the card is in `discard`, `outOfTimeCards` is absent, and the card is not set aside again.
5. **No early replay.** Nothing replays before the villain card is revealed or while any reveal choice is pending.
6. **Copies.** A copy never goes Out of Time: Copy Powers on an earlier in-play card, or Steal Abilities on a discarded card.
7. **Choices.** A choice opened by an Out of Time card (Time Loop Experiments) resolves on both turns.
8. **Hashes.** A match with no Out of Time card leaves `outOfTimeCards` and `outOfTimePlayedCardIds` absent. Sentinel `finalStateHash`, `PRE_WP080_HASH` and PAR are unchanged.
9. **Live wiring.** The `game.test.ts` reducer test passes, proving the live `advanceStage` binding replays.
10. **Projection and client.** `UIPlayerState.outOfTimeCards` is omitted when empty and present for owner, other player and spectator when set. `PlayedCardsRow` renders the `play-out-of-time` group only when it is non-empty, on both `PlayDesktop` and `PlayMobile` (page-mount tests).
11. **Ledger and coverage.**
    - `ledger:heroes:check`, `mechanics:metadata:check`, `effect-index:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0.
    - The six `out-of-time` ledger rows read `executable` with WP-803 / D-24692 provenance. Winter Soldier's row reads `executable` through Bionic Arm / Sniper Nest while 2>4 stays a runtime hollow; the row granularity is hero × mechanic, recorded in D-24692.
    - The `sim:coverage` baseline shows `man-out-of-time` 8 → 4 (Winter Soldier) and `woman-out-of-time` / `man/woman-out-of-time` gone.
12. **Build and tests.** `pnpm -r build` → 0 and `pnpm -r --no-bail test` → 0 fail (dashboard pin re-pinned).

## Verification Steps

1. `pnpm -r build` → 0.
2. Regenerate, then check:
   - `pnpm ledger:heroes && pnpm mechanics:metadata && pnpm effect-index && pnpm sim:runtime-observed && pnpm sim:coverage --update-baseline`
   - then `pnpm ledger:heroes:check && pnpm mechanics:metadata:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all 0.
   - Confirm in the baseline diff that no set's `executable` count fell.
3. Run the dashboard prebuild chain: `pnpm --filter @legendary-arena/dashboard run prebuild:snapshot`, `prebuild:coverage`, `prebuild:effect-index` and `prebuild:par`. `pretest:coverage` (`check-generated-data.mjs`) needs all four in a fresh worktree. Then run `pnpm --filter @legendary-arena/dashboard test:coverage` and `pnpm --filter @legendary-arena/dashboard typecheck` → 0. Re-pin `useInPlayCoverage.test.ts` to the observed `totalObs` / `percentResolved`, with a dated `// why:` noting that the gauge moved only through a smaller denominator (no alias folding).
   - **Expected direction:** `totalObs` falls by the removed out-of-time observations (the 2>4 hits remain), and `percentResolved` is unchanged or rises.
   - Any other delta is a trajectory shift to diagnose, not just re-pin.
4. `pnpm --filter @legendary-arena/game-engine test` → 0 fail; `pnpm --filter @legendary-arena/arena-client test` and `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert `lagn-v1.json` CRLF churn.
7. Layout: open `?fixture=mid-turn&play=1` at 1280×720. Add an `outOfTimeCards` entry to `apps/arena-client/src/fixtures/uiState/mid-turn.json` **locally only** and revert it before committing (it is not in the allowlist). The Out of Time group sits inside the played well and the cockpit does not grow.
8. UIState step 5: `players[n].outOfTimeCards` appears in the Play Diagnostics `uiStateSnapshot`. The snapshot is the viewer's audience-filtered UIState and the field is public, so AC10's three-audience filter test plus the live ca75 diagnostics download (DoD) confirm it.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24692 Active. It records:
  - the set-aside storage (delete-when-empty) and the active-player-scoped turn ledger
  - played vs have, with the 28-caller map (re-synced after D-24694) and the rejected keep-in-play alternative
  - start → main as the replay point, and the required `beginMain` closure
  - the three handler guards: copies, never twice, and enemy-sent cards admitted later
  - repeated gates left to WP-741 / D-24563: until WP-741 lands, Sniper Squad goes Out of Time with one other S.H.I.E.L.D. card (starting Agents count)
  - gated Out of Time lines now count as conditional clauses (value 0) in the WP-708 Synergy Rate, so ca75 / anni Synergy figures shift (display-only, off-ranking)
  - the deviations: set-aside replay order, a later card replaying while an earlier choice is pending, and Copy Powers unable to target a set-aside card or a turn-2 replayed card (discarded at once)
  - guard 3's reliance on line order: it holds because Out of Time is the last line on every in-scope card and nothing appends to `inPlay` mid-pass; a future card with a later appending line must revisit it
  - the Spectrum ruling, quoting both passages. L1950-1953 counts "the classes you have among cards you played this turn and cards in your hand"; L3443-3447 says moved cards still count as "cards you played this turn" but not as "Heroes you Have". This packet reads Spectrum as a "have" read (10 / 18 map; since D-24694 Spectrum rides `countDistinctHeroClassesYouHave`, so it moves with that one site). **Jeff confirmed this ruling on 2026-10-12.**
  - the return line's `neutral` log outcome
  - no "you discarded" on the turn-2 discard
  - the public projection
  - hero × mechanic ledger granularity for Winter Soldier
  - the bot / choice-opening note (resolved by D-24695, not by this packet)
  - the accepted pre-deploy replay window
- [ ] `docs/ai/STATUS.md`; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-840:` then `SPEC:`), with `Tests-changed:` trailers for `gateOnlyHollow.test.ts` and the dashboard pin.
- [ ] **D-24026 live-verify (post-merge):** in a ca75 match with Captain America 1941, play Devoted Patriot after another Strength Hero.
  - It shows under **Out of Time** and the log has the set-aside line.
  - Next turn, after the villain card and **advance**, it plays again (a card is drawn) and lands in the discard pile.
  - The Hollow effects panel no longer lists `man-out-of-time` for it.
  - A diagnostics download between the two turns shows `outOfTimeCards`.
  - Recorded as a STATUS-flip.

## Reserved Decision (lands at execution)

**D-24692 — out-of-time.** It locks everything listed in the DoD item above.

---

## Lint Gate Self-Review (00.3)

- **§1 Structure:** every required section is present and non-empty. Out of Scope names 14 exclusions. There are 12 binary ACs.
- **§2 Constraints:** the engine-wide block is verbatim (full files, no diffs or snippets, ESM, Node v22+, 00.6). Packet-specific constraints, the session protocol and Locked Values are present.
- **§3 Assumes:** 12 items, each cited to file:line from a read-only survey of `c8c96134` and re-verified by the independent pre-flight. A false item → BLOCKED.
- **§4 Context:** rules v23 line ranges, ARCHITECTURE sections (Layer Boundary, Persistence, Turn Stage Cycle), the rules files, 00.2, 01.5, D-entries, the WP-741 sibling and the memory references are named.
- **§5 Output completeness:** 57 files enumerated, marked new or modified, with the count explained. Every test the change forces is in the allowlist up front:
  - the three length pins and both handler-count asserts
  - the three `TurnLoopContext` test files
  - `game.test.ts`
  - the recognized-names drift test
  - `gateOnlyHollow.test.ts`
  - the dashboard pin
- **§6 Naming:** `outOfTimeCards`, `outOfTimePlayedCardIds`, `recordOutOfTimePlayed`, `playedCardIdsStillInPlay`, `replayOutOfTimeCards`, `beginMain`, `heroEffectOutOfTime`, `OUT_OF_TIME_LINE_PATTERN`. All are full English words, and no 00.2 field is renamed.
- **§7 Dependencies:** no new npm packages. Every listed WP is Done; WP-741 is order-independent, not a dependency.
- **§8 Architecture:**
  - The engine owns the rule; the client renders a projection.
  - No server edit, no persistence change.
  - `G` stays JSON (`CardExtId` arrays in a record).
  - Randomness only through the move context.
  - Moves never throw, and no `ctx.events.*` call is added.
  - The stage changes only in `advanceTurnStage`.
- **§9 Windows:** pnpm and node commands only.
- **§10 Env vars:** N/A.
- **§11 Auth:** N/A (an in-match rule; seat authority unchanged).
- **§12 Tests:** `node:test`, `.test.ts`, no `boardgame.io/testing`. The reducer test uses boardgame.io's internal reducer per the WP-411 precedent. Negative cases (gate unmet, copies, not-twice, no early replay, "have" exclusion) are locked so a wrong implementation fails.
- **§13 Verification:** exact commands with expected exit codes and directions, plus the layout and diagnostics steps.
- **§14 ACs:** 12, binary and observable, tied to named functions and fields.
- **§15 DoD:** STATUS, DECISIONS (D-24692), WORK_INDEX, EC_INDEX, mindmap, the allowlist-only diff, the two-commit topology, and §15.1 D-24026 live-verify on `play.legendary-arena.com`.
- **§16 Code style:** 00.6 is cited. No `.reduce()`. Full-sentence log lines. One helper per concern; no premature abstraction (the replay helper is the single shared path for five loops).
- **§17 Vision:** the block is present; §1 / §22 / §24 are touched, the conflict is resolved by D-24687 §4 / D-24616 §5, and NG-1 is not crossed.
- **§18 Prose-vs-grep:** N/A (no literal forbidden-token grep in Verification).
- **§19 Bridge staleness:** the baseline `c8c96134` + #2714 is cited; the drafting commit re-checks `origin/main`.
- **§20 Funding surface:** N/A.
- **§21 API catalog:** N/A.

**Verdict: PASS (21 / 21 resolved).**

## Gate Record

**Pre-flight (01.4), round 1** (independent subagent, baseline `c8c96134`): **DO NOT EXECUTE YET.** The core design was verified against source:
- `advanceTurnStage` is the sole start → main path, with its five callers.
- The reveal gate makes "after the villain card, before any hand play" true.
- The copy guards hold on both Copy Powers paths and on Steal Abilities.
- The hash-oracle boards carry no ca75 / anni hero.
- All dependencies are Done.
- A real `buildHeroAbilityHooks` run confirmed that 2>4 stays unresolved.

Five blockers were found, all applied in this revision:
- **PS-1:** `LEADING_GATE_PREFIX_PATTERN` is hc / team only, so the Savior lines would not be recognized. Fixed with a dedicated `OUT_OF_TIME_LINE_PATTERN` that admits `[keyword:Savior]`.
- **PS-2:** the map is 10 / 20, not 8 / 22. `countDistinctHeroClassesYouHave` and `collectDistinctHeroClassCards` are "have" reads, so `heroCountSource.resolve.ts` (+ test) joined the allowlist.
- **PS-3:** collision with WP-741 / D-24563. Resolved by dropping this packet's repeated-gate count, its descriptor field, guard 4 and the `heroAbility.types.ts` contract edit. Gate counting is left to the shared evaluator, so the two packets are order-independent. This was the drafter's resolution in place of the reviewer's A / B fork; recorded in Context.
- **PS-4:** Spy Network opens no choice. The pending-choice test was retargeted to Time Loop Experiments, and the executor's no-parking behavior is now an Assumes fact.
- **PS-5:** the `sim:coverage` probe. The three slugs joined `HERO_PARSER_RECOGNIZED_MARKER_NAMES`, with a drift-test exemption.

RS items applied:
- RS-1: the recognizer pushes the keyword only.
- RS-2: `advanceStage` takes the full move context.
- RS-3: `if (nextStage === 'main')`.
- RS-4: the bot-ally limitation is now Out of Scope.
- RS-5: scoring is now Out of Scope.
- RS-6: the dashboard-gauge note.
- RS-7: the runtime keyset pin.
- RS-8: anchor and wording fixes.
- RS-9: active-player scope.
- RS-10: the deviations are recorded.
- RS-11: the layout check (Verification 7).
- RS-12: the synthetic hollow line.

RS-13 (main checkout has uncommitted `PlayDesktop` / `PlayMobile` edits on `infra/endgame-readonly-board`; PR #2698 PAR re-pin open) is noted in the EC.

**Pre-flight (01.4), round 2: READY TO EXECUTE** (2026-10-11). PS-1..PS-5 are verified against source:
- The locked pattern matches all 14 Card Map lines and rejects both 2>4 lines.
- The 10 / 20 map accounts for all 30 callers.
- No dependency on `countRepeatedBothCondition` remains, and WP-741's collapse acts regardless of order.
- Time Loop Experiments parks its choice at `heroEffects.execute.ts:~3166`.
- The AC11 `sim:coverage` numbers hold, and the file count of 57 is confirmed.

Non-scope wording locks applied:
- RS-14: the asserting `SPACE_FORM_WHOLE_LINE_NAMES` drift branch; names go on the exported literal.
- RS-15: the gate-only-body deep-equal parse test; no early-return fast path.
- RS-16: WORK_INDEX "one contract-file edit".
- RS-17: the Synergy Rate shift is recorded in the D-24692 DoD list.

**Copilot (01.7), round 1: RISK → HOLD.** The core design was verified clean:
- Nothing reads `inPlay` after the handler.
- Wait-and-see grants are keyed by `cardId` + `hookIndex`.
- No zone-conservation invariant runs past setup.
- The `pendingPutHandOnDeckTop` queue is FIFO.
- All five bindings are feasible.

Eight findings, all applied in place (no allowlist change):
1. `beginMain` fires after the `actionInStep` reset.
2. The replay snapshots its list, deletes the key once, and returns early on a missing entry or zones.
3. Spectrum (`:~225` / `:~598`) is reclassified as "have", so the map is now 12 / 18. This is an interpretation (L3443-3447 "Heroes you Have" vs L1950-1953 "cards you played this turn"). D-24692 records it as a ruling; Jeff confirmed it on 2026-10-12.
4. The EC now copies the regex, the log sentences and their outcomes verbatim; the return line is `neutral`.
5. Test homes are named; the `mid-turn.json` layout edit is local-only.
6. The arena-client and dashboard typecheck gates and the full dashboard prebuild chain were added.
7. The ledger read is optional (`turnEconomy?`) on both paths and returns a fresh array.
8. D-24692 gains guard-3 line-order fragility, the turn-2 Copy Powers deviation, the Spectrum ruling and the return outcome. The bot follow-up is corrected (the drain belongs inside `playHandCards`; pre-existing), and the pre-deploy wording now says "any recognized line".

**Pre-flight (01.4), round 3: READY TO EXECUTE** (2026-10-11). All eight copilot fixes are verified against source: the 12 / 18 map is exact across 30 callers, the replay loop is re-entrancy-safe, the `turnEconomy?` read is required by `heroConditionHoldsForInPlay`'s minimal state, and all test homes and commands exist. Applied: RS-18 (Files list says "twelve") and RS-19 (Spectrum recorded as an interpretation; Jeff confirmed it on 2026-10-12).

**Copilot (01.7), round 2: PASS, disposition CONFIRM** (2026-10-11). All eight fixes landed with no new contradiction. The regex, log sentences, heading, test id and provenance are byte-identical between WP and EC. The EC has 94 content lines (ceiling 100). Its one editorial residual (the Files list said "ten") is applied.

**Pre-flight (01.4), round 4: READY TO EXECUTE** (2026-10-12). This is a delta review after #2722 / D-24694, #2723 / D-24695 and #2724 / D-24696 landed on `main`.
- The re-synced map is exact: 28 callers, 10 have / 18 played.
- The bot and Spy Network notes are verified against source. Guards 2–3 hold with Spy Network's choice pending, and `resolveCountScaledChoice` never reads `inPlay`.
- RS-20..RS-22 are applied: the DoD map count, the baseline at `295f9dc5` plus the `gain-officer` neighbour note, and the bot-note wording.

**Copilot (01.7), round 3: PASS, disposition CONFIRM** (2026-10-12). The delta introduces no contradiction, allowlist gap or scope change. The EC is 94 content lines and copies the WP verbatim. Two editorial fixes are applied: the live D-24692 clause now reads 10 / 18, and this gate record entry. The drift-test anchor is re-pointed to `~1835`.
