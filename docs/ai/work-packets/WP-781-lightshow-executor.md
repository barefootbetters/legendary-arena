# WP-781 — Lightshow executor: count Lightshow cards played, once-per-turn single-ability choice (Game Engine + App arena-client)

> **Renumbered 2026-09-27** from WP-777 / EC-814 / D-24616 (and the cited D-24615 → D-24622): those numbers were claimed first by the merged split-face discard fidelity packet (#2443 / #2453 / #2461).

**Status:** Draft 2026-09-26
**Primary Layer:** Game Engine (parser fusion, count source, new move, UIState projection) + App arena-client (the Lightshow button)
**Dependencies:**
- D-24622 (INFRA #2444 — the Lightshow phantom-grant suppression this packet replaces)
- WP-736 / 739 / 738 / 746 (Excessive Violence — the record-at-setup, fire-from-a-move fusion template)
- WP-379..382 / D-24183 (healWounds — the optional player-initiated `main`-stage move template)
- WP-673 / 674 / 680 / 711 (the `*-played-this-turn` count-source family, D-24488 / D-24489 / D-24497 / D-24534)
- WP-724 / 725 / 772 (Divided Cards; D-24604 — the played face is the in-play id)
- WP-128 / D-12803 (audience-filter redaction matrix)

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). New move, new count source, new UIState field, contract-file edits, and the change touches PAR / leaderboard inputs, so it fails lightweight-lane criteria 3, 4 and 6.
**Arc:** D-24622 (INFRA, kills the phantom grants) → WP-781 (this packet, the real rule). The four unmodelled lines are named follow-ups in Out of Scope.

> Baseline: `origin/main` at `19b83c50` plus D-24622 (#2444) and the reserve commit (#2445). **#2444 must be merged before execution.**

---

## Goal

Legendary's **Lightshow** (rules v23 ~L1616-1623; `keywords-full.json` `lightshow`): "Once per turn, if you played at least two Lightshow cards this turn, you can use a single Lightshow ability from any of those cards. If you play three, four, or more Lightshow cards you still use only a single Lightshow ability."

**Today (after D-24622):**
- All 14 xmen `[keyword:Lightshow]: …` lines are inert, honest `lightshow` hollows (runtime hits: **lightshow 94**).
- Before D-24622, 9 of those lines fired as unconditional grants on every play. Operator match `19720cb4` (Core / Loki / Midtown Bank Robbery, 1p) is the evidence:
  - Turn 15: a lone Blazing Flare granted +2 recruit.
  - Turn 19: five Lightshow cards were played (Northern Lights ×2, Blazing Flare ×2, Twin Blast), and three abilities fired: +2, +2 and +3. One was legal.

**After this session:**
1. **Recognition.** Every Lightshow line is fused at setup into one hook carrying the handled keyword `lightshow` and a `lightshowEffects` descriptor list. The four unmodelled lines carry the keyword (so they count) but no wrapper effect, and keep an honest `lightshow` hollow. On play the line does nothing, which is correct: a Lightshow ability never fires on its own.
2. **Count.** `countLightshowCardsPlayedThisTurn(G, playerId)` counts the current player's `inPlay` cards whose hooks carry `lightshow`. It is self-inclusive and counts duplicate copies.
3. **Choice.** A new move `useLightshow({ cardId })` fires the chosen card's `lightshowEffects`. It is legal at most once per turn, in the `main` stage, with no pending choice open, when the count is at least 2 and `cardId` is an in-play Lightshow card with a non-empty effect list. It is optional; the player may never use it, or use it late so the "for each Lightshow card" scalers grow.
4. **Scalers.** A new count source `lightshow-played-this-turn` (self-inclusive) drives the five "+N for each Lightshow card you played this turn" lines. Four are modelled; Convert Sound to Light is not (see Card Map).
5. **Projection.** Owner-only `economy.lightshowOptions?: CardExtId[]`, present iff the move is currently legal for at least one card.
6. **Client.** A Lightshow button beside Heal in `TurnActionBar.vue` (props fed from `PlayDesktop.vue` / `PlayMobile.vue`), one per option.
7. **Bots.** `getLegalMoves` emits `useLightshow` per option, so autoplay, sim and PAR bots use it.

## User-Visible Impact

- X-Men Lightshow heroes (Aurora & Northstar, Dazzler, Havok, Jubilee, Legion) work as printed. You play two or more Lightshow cards, press **Lightshow**, and pick one ability.
- Playing one Lightshow card grants nothing. Playing five still grants one ability.
- Score inputs (PAR, leaderboard) reflect the real rule instead of free resources.

---

## Assumes

1. **D-24622 is on `main`.** `LIGHTSHOW_GATE_PATTERN` / `computeLightshowGatedRanges` live in `setup/heroAbility.setup.ts`, beside `FOCUS_COST_PATTERN` (~`:413`). All 14 lines emit no effect and record `lightshow` in `unresolvedMarkers`.
2. **Fusion template.** Excessive Violence:
   - `buildExcessiveViolenceFusion` at `setup/heroAbility.setup.ts:~3399-3430`, its allowlist at `:~597`, call and skip-line sites at `:~3607-3636`
   - descriptor field `excessiveViolenceEffects?` at `rules/heroAbility.types.ts:~207-215`
   - fire loop `fireExcessiveViolencePlays` at `hero/heroEffects.execute.ts:~5620-5701`, which calls the exported `executeSingleEffect(G, ctx, playerID, cardId, effect)` at `:~5877`
   - `getHooksForCard` at `rules/heroAbility.types.ts:~390`
3. **`executeHeroEffects`** (`hero/heroEffects.execute.ts:~754`) does not filter by hook timing (setup comment `:~479-486`). The on-play handler for `lightshow` must therefore be a no-op.
4. **Move template.** `moves/healWounds.ts:81-193`:
   - stage gate at `:85`
   - the `hasPending*` block list at `:91-138`
   - per-turn lock at `:144`
   - `pushLog`, then the `notableEvents` push last
5. **Move lockstep sites:**
   - `game.ts:~520-549` moves map, `{ move, client: false }` (D-10008)
   - `game.test.ts:~181-214` sorted move-name list plus the count comment
   - `replay/replay.execute.ts:~141`
   - `simulation/ai.legalMoves.ts:~225` (`SIMULATION_MOVE_NAMES`) plus the emit step near `:~969`
   - `simulation/simulation.runner.ts:~327` and `simulation/par.aggregator.ts:~485` move maps; the drift test is `simulation/simulation.moveDispatch.drift.test.ts`
   - `simulation/ai.competent.ts:~332` scoring
   - `CORE_MOVE_NAMES` is **not** touched (core moves only)
   - Autoplay `apps/server/src/autoplay/botLoopProgress.mjs:90-128` is a deny-list (D-24591). A non-`resolve…` move that `getLegalMoves` emits is offered automatically, so the server needs no edit.
6. **Per-turn flag.** `TurnEconomy.excessiveViolenceUsedThisTurn?` (`economy/economy.types.ts:100`) is reset by `resetTurnEconomy()` in `game.ts` `onBegin` (`:~860-887`); the sim / PAR loops reset `turnEconomy` themselves. It must be listed in `carryConversionFlag` (`economy/economy.logic.ts:505-525`), or every rebuild drops it. `simulation/onBeginParity.ts` does **not** mirror the economy reset (each sim / PAR loop resets `turnEconomy` itself), so a `turnEconomy` flag needs no parity edit.
7. **Count sources.**
   - The closed union plus canonical array is `rules/heroCountSource.ts:36-66` (drift test `hero/heroCountSource.resolve.test.ts`).
   - The resolver is `hero/heroCountSource.resolve.ts:~375`; the explainer is `:~715`.
   - Parser: `COUNT_SCALED_PATTERN` at setup `:~196` / `:~1573-1597`, gated by `isValidHeroCountSource` `:~3163`.
   - `shield-levels` is the self-inclusive precedent.
8. **Descriptors used by modelled lines:** `draw` (magnitude 1, from the `[keyword:draw:1]` marker), the `[keyword:reveal-ko]` marker, parse-translated to a `reveal` descriptor by `revealRulesForLegacyKeyword` (`revealRule.ts:~218`; cvwr text "Reveal the top card of your deck. If it costs 0, KO it."), plain `attack` / `recruit`, `attack-per-count` / `recruit-per-count`.
9. **Hollow and ledger.**
   - `detectHollowHeroHook` (`heroEffects.execute.ts:~1099-1160`) flags every `unresolvedMarkers` entry.
   - `scripts/hero-mechanic-ledger.mjs` `statusForMechanic` (`:363-408`) keys on the text token `lightshow`: `executable` only via `MVP_KEYWORDS`, `BY_HOOK_KEYWORDS` + the hook listing it, or subsystem coverage.
10. **UIState precedent:** `economy.excessiveViolenceAvailable?`:
    - declared at `ui/uiState.types.ts:~781-790`
    - built at `ui/uiState.build.ts:~1027-1036` (present only when true)
    - passed for the active player only at `ui/uiState.filter.ts:~452-459`, with `REDACTED_ECONOMY` at `:~40-49` for everyone else
11. **Client:**
    - Heal button at `apps/arena-client/src/components/play/TurnActionBar.vue:~469-472, ~590-598` (`data-testid="play-action-heal-wounds"`)
    - `uiMoveName.types.ts:~140`
    - `TurnActionBar.vue` has no economy or card-name props; its parents `pages/PlayDesktop.vue` and `pages/PlayMobile.vue` pass its props in
    - `composables/useTurnActions.ts:~888+` mirrors the pending-choice block list; it needs no edit because `lightshowOptions` already encodes legality
12. **Divided Cards.** A played Aurora & Northstar split card sits in `inPlay` under its chosen face id (WP-724 relabel). Only Blazing Flare carries Lightshow; its partner Blazing Fists does not.
13. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**; reconcile the WP and D-24621 first. Line anchors are `~` approximate; re-read at execution.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` ~L1616-1623 (Lightshow).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary; `.claude/rules/architecture.md` §UIState Projection Integrity and §Move Validation Contract; `.claude/rules/code-style.md` §Drift Detection (runtime pins, WP-563).
- `docs/ai/DECISIONS.md`: D-24622, D-24606 (Focus sibling), the Excessive Violence D-entries (WP-736 arc), D-24183, D-24488 / D-24497 / D-24534, D-24591, D-24604, D-12803. D-24621 is reserved.
- `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` (a new move is a wiring category).
- User memory: `reference_hero_keyword_lockstep_sites`, `feedback_move_registration_drift_test`, `reference_bot_legalmoves_moveguard_divergence`, `reference_sim_coverage_baseline_gate_distinct`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_arena_client_uistate_backfill_recurrence`.

**Why one packet across engine and client.** The engine move is unusable by a human without the button; shipping engine-only would leave Lightshow reachable only by bots. The client side is one button and a move-name entry (three files), so the WP-776 engine+client single-packet precedent applies rather than the WP-765 / 766 split.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. No randomness. No `.reduce()` with branching.
- The client submits intent (`useLightshow({ cardId })`); the engine decides legality and outcome.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24621) before coding. One WP per session.

**Packet-specific:**

- **Fusion (`setup/heroAbility.setup.ts`).**
  - D-24622's `LIGHTSHOW_GATE_PATTERN` and range suppression are **retired**, replaced by `buildLightshowFusion`.
  - For every ability line containing `[keyword:Lightshow]`, the fusion parses the text **after** the first Lightshow token and colon as an ordinary line. It stores the resulting effect descriptors in `lightshowEffects`, and emits one hook with `keywords: ['lightshow']` and a single `{ type: 'lightshow', lightshowEffects }` effect. The line's parsed effects are **not** also emitted at top level.
  - The fusion **removes** the inner `[keyword:Lightshow]` token (Mach 10, Prismatic Cascade: "for each [keyword:Lightshow] card") from the text before calling `parseAbilityText`. Otherwise, once `lightshow` is a valid keyword, it would parse into a nested `lightshow` effect inside `lightshowEffects`.
  - `LIGHTSHOW_UNMODELED_LINES` (keyed `{setAbbr}/{heroSlug}/{cardSlug}`, 4 entries) emit a hook with `keywords: ['lightshow']`, `effects: []` (**no** `lightshow` wrapper effect) and `unresolvedMarkers: ['lightshow']`. They **still count**, because the count keys on `keywords`. `lightshowOptions` excludes them because they have no wrapper. `detectHollowHeroHook` (`heroEffects.execute.ts:~1146`) records them, because it returns early only when an effect is reachable; a `{type:'lightshow', lightshowEffects: []}` wrapper would count as reachable and hide the hollow.
  - A count-scaled line's printed flat icon ("+2[icon:attack]for each …") must **not** also grant flat. This is **inherited**: D-24016 (attack) and D-24489 (recruit) at setup `:~1815-1864` drop the flat grant from any line carrying a per-count keyword, and it applies because the fusion runs `parseAbilityText` on the post-colon text. It is test-pinned for Mach 10 and Prismatic Cascade (which triggers both).
- **Keyword lockstep.** `lightshow` is a handled, no-magnitude `HeroKeyword`:
  - the union, `HERO_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`
  - `HANDLED_KEYWORDS`, `MVP_KEYWORDS`, `HERO_EFFECT_HANDLERS` (no-op handler)
  - every count site named in `reference_hero_keyword_lockstep_sites`
  - Re-read the base counts at execution.
- **Count helper** `countLightshowCardsPlayedThisTurn(G, playerId)` in `hero/lightshow.logic.ts` (new, pure, no boardgame.io import). The file holds **only** `LIGHTSHOW_MIN_CARDS_PLAYED` and this helper, and imports only `getHooksForCard` and types. Anything more would create a cycle: heroEffects.execute → heroCountSource.resolve → lightshow.logic → `moves/*`.
  - iterates `G.playerZones[playerId].inPlay` with `for…of`
  - counts each card id whose `getHooksForCard` result carries the `lightshow` keyword
  - self-inclusive; duplicates count; tolerates absent zones or hooks by returning 0
- **Count source** `'lightshow-played-this-turn'`, self-inclusive, appended to the union and `HERO_COUNT_SOURCES` with a parity/drift update. `resolveCountSource` returns `countLightshowCardsPlayedThisTurn`; `explainCountSourceInputs` gets a case. It is resolved **when the ability is used**, not when the card was played.
- **Move `useLightshow({ cardId })`** in `moves/useLightshow.ts` (new). The Move Validation Contract, in order:
  1. `cardId` is a non-empty string, else return.
  2. `G.currentStage === 'main'`, else return.
  3. No choice is pending, else return. There is no shared helper: the 29-guard block-all cluster is written out inline in healWounds, fightVillain, recruitHero and exorciseHauntedHero. `lightshowOptions` copies that cluster from `healWounds.ts` verbatim (the established inline pattern). A shared helper is out of scope.
  4. `G.turnEconomy.lightshowUsedThisTurn !== true`, else return.
  5. `countLightshowCardsPlayedThisTurn(G, currentPlayer) >= 2`, else return.
  6. `cardId` is in the current player's `inPlay` and has a `lightshow` hook with non-empty `lightshowEffects`, else return.
  7. Set `lightshowUsedThisTurn = true` via a TurnEconomy rebuild helper, then call `executeSingleEffect` for each effect in order.
  8. `pushLog`: "Player N used Lightshow from <cardDisplayData name>." No ability text is logged (hooks carry no text, and `cardDisplayData[id].abilityText` holds raw marker syntax). Each inner effect logs its own result (the `fireExcessiveViolencePlays` precedent). Return void.

  Using the ability does not un-play or move any card.
- **Per-turn flag:** `TurnEconomy.lightshowUsedThisTurn?: boolean`, created lazily (omitted until used), reset by `resetTurnEconomy()`, **added to `carryConversionFlag`**. There is no new top-level `G` field.
- **Legality helper.** `lightshowOptions(G, playerId): CardExtId[]`, exported from `moves/useLightshow.ts` (the `hasHealedThisTurn` precedent; `uiState.build` and `ai.legalMoves` already import from `moves/`), returns the distinct in-play card ids for which step 1-6 hold. It is empty when the move is illegal. The move, the projection and `getLegalMoves` all call this one helper (the `reference_bot_legalmoves_moveguard_divergence` rule: one predicate, three consumers).
- **Projection:** `UITurnEconomyState.lightshowOptions?: CardExtId[]` (`ui/uiState.types.ts:~765`), present iff `lightshowOptions(...)` is non-empty. The filter passes a copied array (`[...options]`) for the **active player only**, present only when non-empty; others get `REDACTED_ECONOMY` (the `excessiveViolenceAvailable` disposition).
- **Bots:**
  - `useLightshow` joins `SIMULATION_MOVE_NAMES`, both simulation move maps and the replay map.
  - `getLegalMoves` emits one `useLightshow` per `lightshowOptions` entry.
  - `ai.competent.ts` sees only `(UIState, LegalMove[])` and breaks ties by seeded random (`selectBestMove :~426`), so it scores `useLightshow` as `SCORE_USE_LIGHTSHOW_BASE = 150` minus the move's index among the emitted `useLightshow` moves. 150 is below `SCORE_PLAY_CARD_BASE` (200), so every card is played first and the scalers grow. `getLegalMoves` emits in `inPlay` order, so the first option wins deterministically. Autoplay reuses the same policy through the D-24591 deny-list.
- **Client:** `TurnActionBar.vue` gains a `lightshowOptions` prop and a card-name source (`cardDisplayData`), both passed by `PlayDesktop.vue` and `PlayMobile.vue`. It renders one button per entry, with `data-testid="play-action-lightshow"`, labelled `Lightshow: <card name>`, and submits `useLightshow({ cardId })`. `uiMoveName.types.ts` gets `useLightshow`. No ability text is projected or rendered, so `AbilityText.vue` is not involved.
- **Determinism.** No new randomness. `draw` and `reveal-ko` may reshuffle the discard into an empty deck; the move passes its full move `context` to `executeSingleEffect` (as `fightVillain :~266` does), so any reshuffle goes through `ctx.random`. The flag is lazily omitted, so matches that never use Lightshow keep identical `G` shape. Sentinel / PAR oracles are expected unchanged, and the scaffold must confirm it. xmen matches recorded before this WP will not replay identically; D-24621 records this, together with the D-24119 re-verification note.

## Card Map (locked)

| Card (`xmen/…`) | Lightshow ability | `lightshowEffects` |
|---|---|---|
| aurora-northstar/blazing-flare | +2 recruit | `recruit 2` |
| aurora-northstar/twin-blast | +3 attack | `attack 3` |
| aurora-northstar/northern-lights | Draw a card | `draw 1` (from marker `[keyword:draw:1]`) |
| aurora-northstar/mach-10 | +2 attack per Lightshow card | `attack-per-count lightshow-played-this-turn 2` |
| dazzler/dazzling-glamour | +2 attack | `attack 2` |
| legion/bend-light | +2 recruit | `recruit 2` |
| jubilee/light-a-spark | +1 recruit per Lightshow card | `recruit-per-count lightshow-played-this-turn 1` |
| jubilee/blasting-fireworks | +1 attack per Lightshow card | `attack-per-count lightshow-played-this-turn 1` |
| jubilee/prismatic-cascade | +1 recruit and +1 attack per Lightshow card | `recruit-per-count … 1`, `attack-per-count … 1` |
| jubilee/unexpected-explosion | Look at the top card; if it costs 0, KO it | the parse-translated `reveal` descriptor from marker `[keyword:reveal-ko]` (`revealRulesForLegacyKeyword`; `reveal-ko` has no runtime handler, so never hand-build `{type:'reveal-ko'}`) |

**`LIGHTSHOW_UNMODELED_LINES` (honest hollows, count but never offered):**
1. `xmen/dazzler/convert-sound-to-light` — +1 Piercing per Lightshow card (`TurnEconomy.piercing` has no producer or consumer).
2. `xmen/dazzler/citywide-mega-concert` — draw two extra cards at end of turn (no hero hand-size keyword).
3. `xmen/dazzler/inspire-the-world` — put a Hero from the HQ on top of your deck (no descriptor).
4. `xmen/havok/blinding-burst` — +3 attack usable only against the Mastermind (no restricted-attack pool).

Markers are required for exactly **6** lines, appended through the curated marker pipeline (`scripts/convert-cards/inputs/hero-ability-markers.json`, `xmen` section), then `data/cards/xmen.json` is regenerated: Northern Lights `[keyword:draw:1]`, Unexpected Explosion `[keyword:reveal-ko]`, and the per-count markers on Mach 10, Light a Spark, Blasting Fireworks and Prismatic Cascade. The 4 flat-icon lines (Blazing Flare, Twin Blast, Dazzling Glamour, Bend Light) need none; a bare "Draw a card." is not auto-parsed. "Look at" is read as "reveal" for this solo-visible effect; D-24621 records that reading.

## Locked Values

- Keyword: `'lightshow'` (handled, no-magnitude), +1 to each keyword and handler count.
- Count source: `'lightshow-played-this-turn'`, self-inclusive.
- Threshold: `2` (`LIGHTSHOW_MIN_CARDS_PLAYED`, with a `// why:` citing the rule).
- Move name: `'useLightshow'`, args `{ cardId: CardExtId }`.
- Flag: `TurnEconomy.lightshowUsedThisTurn?: boolean`.
- Projection: `UITurnEconomyState.lightshowOptions?: CardExtId[]`, active player only, copied array, present only when non-empty.
- Bot score: `SCORE_USE_LIGHTSHOW_BASE = 150`, minus the option index. Accepted: fight bonuses (+500 bystander, +800 imminent escape, 1500 mastermind) can rank a fight above Lightshow, so a bot may fight first. Lightshow stays available after the fight; the ordering is a strategy choice, not a legality one. (150 equals `SCORE_DRAW_CARDS_BASE`; harmless, because `drawCards` is never offered mid-turn once `hasDrawnThisTurn` is set in `onBegin`.)
- Test id: `play-action-lightshow`.
- The §Card Map and the 4-entry `LIGHTSHOW_UNMODELED_LINES`, verbatim.

---

## Scope (In)

- **A) Logic.** `hero/lightshow.logic.ts` (new: `LIGHTSHOW_MIN_CARDS_PLAYED`, `countLightshowCardsPlayedThisTurn`) + test. `lightshowOptions` lives in `moves/useLightshow.ts` (D).
- **B) Parser.** Retire the D-24622 range, add `buildLightshowFusion` + `LIGHTSHOW_UNMODELED_LINES` in `setup/heroAbility.setup.ts`, and add the `lightshowEffects?` descriptor field in `rules/heroAbility.types.ts`. Update `hero/lightshowGateIconSuppression.test.ts`: lines stay inert on play, but now carry the fused descriptor.
- **C) Keyword + source.** `rules/heroKeywords.ts`, `hero/heroEffects.execute.ts` (no-op handler + lockstep sets), `rules/heroCountSource.ts`, `hero/heroCountSource.resolve.ts`, and their drift/parity tests.
- **D) Move.** `moves/useLightshow.ts` + test, `economy/economy.types.ts`, `economy/economy.logic.ts` (`carryConversionFlag` + a `markLightshowUsed` rebuild helper), `game.ts`, `game.test.ts`, `replay/replay.execute.ts`.
- **E) Bots.** `simulation/ai.legalMoves.ts` (+ test), `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `simulation/ai.competent.ts` (+ test), `simulation/simulation.moveDispatch.drift.test.ts` (per-move describe block, the WP-757 precedent).
- **F) Projection.** The five steps across `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts`, plus the diagnostics snapshot check.
- **G) Client.** `TurnActionBar.vue` (+ its test), `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`, `uiMoveName.types.ts`.
- **H) Markers + feeds.** `hero-ability-markers.json` (xmen rows), regenerate `data/cards/xmen.json`, `scripts/hero-mechanic-ledger.mjs` (`lightshow` is `executable` only when the card's hook carries the keyword **and** its `lightshowEffects` is non-empty, so the 4 unmodelled cards stay honest; the nested `lightshowEffects` types are collected into `cardResolvedKeywords`, the `sunlightEffects` precedent `:~590-594`), `scripts/coverage/mechanic-provenance.json`, regenerate the effect index, `card-mechanics`, hero ledger, `runtime-observed-hollows` and the `sim:coverage` baseline, and re-pin the dashboard `totalObs`.
- **I) Tests.** Cover:
  - one Lightshow card played: the move is illegal and there are no options
  - two played: legal once; a second call is a no-op
  - five played: still exactly one ability
  - Mach 10 used after three more Lightshow cards grants +2 × 4 (the scaler reads the count at use time)
  - an unmodelled card counts toward 2 but is never an option
  - Blazing Flare played as Blazing Fists does not count
  - pending choice open: the move is blocked
  - `cleanup` stage: blocked
  - the flag survives an `addResources` rebuild and resets next turn
  - the projection is present only for the active player
  - `getLegalMoves` agrees with the move for every case
  - two copies of the same Lightshow card count as 2, and the options list follows `inPlay` order (turn 19 of match `19720cb4` had Northern Lights ×2)
  - playing Inspire the World records exactly one `lightshow` hollow; playing Blazing Flare records none
  - Unexpected Explosion used: a cost-0 top card moves to the KO pile; a card costing more than 0 stays on top (assert the outcome, not the descriptor type)

## Out of Scope

- The four `LIGHTSHOW_UNMODELED_LINES` effects (Piercing, the end-of-turn hand-size bonus, HQ-to-deck-top, Mastermind-only attack). Each needs its own subsystem; each is a named follow-up. The Mastermind-only attack pool is shared with anni / cvwr / ff04 cards.
- Any non-xmen Lightshow printing (none exist in the current data).
- Penumbra's "play both sides as if they were two different cards" (WP-780, reserved 2026-09-26, in flight). If it lands first, both halves sit in `inPlay` and each counts only if its own face carries `lightshow`. Blazing Fists does not, so the count is unaffected. No coordination edit is needed.
- Pre-planning (`packages/preplan`) awareness of Lightshow.
- Notable-event SFX for Lightshow (no new `NotableGameEventType`).

## Files Expected to Change

- `packages/game-engine/src/hero/lightshow.logic.ts` + `.test.ts` — **new**
- `packages/game-engine/src/moves/useLightshow.ts` + `.test.ts` — **new**
- `packages/game-engine/src/setup/heroAbility.setup.ts` — modified (fusion; D-24622 range retired)
- `packages/game-engine/src/hero/lightshowGateIconSuppression.test.ts` — modified
- `packages/game-engine/src/rules/heroAbility.types.ts` — modified (`lightshowEffects?`)
- `packages/game-engine/src/rules/heroKeywords.ts` (+ test), `rules/heroAbility.setup.test.ts` (`expectedKeywords` array + length pin) — modified
- `packages/game-engine/src/hero/heroEffects.execute.ts` (+ test) — modified
- `packages/game-engine/src/rules/heroCountSource.ts`, `hero/heroCountSource.resolve.ts` (+ test) — modified
- `packages/game-engine/src/economy/economy.types.ts`, `economy/economy.logic.ts` (+ test) — modified
- `packages/game-engine/src/game.ts`, `game.test.ts`, `replay/replay.execute.ts`, `index.ts` (exports `useLightshow`, the exorciseHauntedHero precedent) — modified (01.5 wiring)
- `packages/game-engine/src/simulation/ai.legalMoves.ts` (+ test), `simulation.runner.ts`, `par.aggregator.ts`, `ai.competent.ts` (+ test), `simulation.moveDispatch.drift.test.ts` — modified
- `packages/game-engine/src/ui/uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`, `uiState.filter.test.ts` — modified
- `apps/arena-client/src/components/play/TurnActionBar.vue` (+ test), `uiMoveName.types.ts`, `apps/arena-client/src/pages/PlayDesktop.vue`, `pages/PlayMobile.vue` — modified
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/xmen.json` + derived feeds + `sim:coverage` baseline + dashboard `useInPlayCoverage.test.ts` pin — regenerated / re-pinned
- Governance: `docs/ai/DECISIONS.md` (D-24621), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is about 40 files. Roughly half are tests, lockstep sites or regenerated feeds. The new logic is two small files plus one fusion. The lockstep list is long because a move, a keyword and a count source each carry fixed registration sites; splitting them across packets would ship a half-registered move.

## Contract

- The Locked Values.
- `lightshowOptions(G, playerId)` (exported from `moves/useLightshow.ts`) is the single legality authority, shared by the move, the projection and `getLegalMoves`.
- `countLightshowCardsPlayedThisTurn` is the shared count authority, shared by the count source and the legality helper.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §23 / §24 (ranked fairness; PAR / leaderboard inputs), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** none.
**Non-Goal proximity:** not crossed.
**Determinism:** no new randomness; the lazily-omitted flag keeps non-Lightshow `G` shape unchanged. The replay / D-24119 note is recorded in D-24621.

## Funding Surface Gate

§20 **N/A** (no monetization surface).

## API Catalog

§21 **N/A** (no HTTP endpoint or `apps/server` library change; autoplay picks the move up through its existing deny-list).

---

## Acceptance Criteria

1. With one Lightshow card in play, `lightshowOptions` is empty, `useLightshow` is a no-op, and no resource changes.
2. With two or more, `useLightshow` fires exactly the chosen card's effects once. A second call that turn is a no-op, and the flag resets on the next turn. `lightshowUsedThisTurn` survives every TurnEconomy rebuild within the turn.
3. With five Lightshow cards played, exactly one ability resolves.
4. The scalers read the count at use time. Mach 10 used with 4 Lightshow cards in play grants +8 attack; Prismatic Cascade with 3 grants +3 recruit and +3 attack. Neither grants its flat icon on play.
5. Each Card Map line resolves its locked effect. Each `LIGHTSHOW_UNMODELED_LINES` card counts toward the threshold, is never an option, and records a `lightshow` hollow.
6. A Blazing Flare / Blazing Fists card counts only when played as Blazing Flare.
7. The move is blocked outside `main`, while any pending choice is open, and for a `cardId` not in the current player's `inPlay`.
8. `economy.lightshowOptions` is present iff options exist, for the active player only, and survives the audience filter only for that player.
9. `getLegalMoves` emits exactly the `lightshowOptions` set, and the sim drift test and `game.test.ts` move list are green.
10. The client shows one `play-action-lightshow` button per option; clicking submits `useLightshow({ cardId })`.
11. `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0. `lightshow` runtime hollows remain only for the four unmodelled cards.
12. `pnpm -r build` → 0 and `pnpm -r --no-bail test` → 0 fail (dashboard pin re-pinned). Sentinel / PAR oracles are expected unchanged. If one changes: an oracle whose board contains xmen heroes is re-pinned with a D-24621 citation in the commit body; a changed oracle with no xmen on its board means STOP and diagnose.

## Verification Steps

1. `pnpm -r build` → 0.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` updates the xmen rows; a re-run reports 0 updates.
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all 0 (regenerate first and commit the feeds).
4. `pnpm --filter @legendary-arena/game-engine test` → all pass.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert `lagn-v1.json` CRLF churn.
7. `economy.lightshowOptions` appears in the Play Diagnostics `uiStateSnapshot` for the active seat (UIState step 5; AC8), e.g. via the `?fixture=mid-turn&play=1` dev route or a unit assertion on the diagnostics builder.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24621 Active: the unmodelled-line hollow-emission shape, the oracle re-pin rule, the count source and self-inclusion, the threshold, the once-per-turn single choice and its any-time-in-`main` timing, the unmodelled-line posture (count but never offered), the "look at" = reveal reading, the projection, the bot scoring rule, and the replay / D-24119 note.
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-818:` then `SPEC:`).
- [ ] **D-24026 live-verify (post-merge):** in an Aurora & Northstar match, play one Blazing Flare (no button, no recruit), then a Twin Blast (button appears, and one use grants exactly +3 attack or +2 recruit). Recorded as a STATUS-flip.

## Reserved Decision (lands at execution)

**D-24621 — lightshow-executor.** It locks everything listed in the DoD item above.

---

## Lint Gate Self-Review (00.3)

- §1 Structure: all required sections present and non-empty. Out of Scope names four related exclusions (the four unmodelled effects, non-xmen printings, preplan, SFX). 12 binary ACs.
- §2 Constraints: the engine-wide block is kept verbatim; packet-specific constraints are flat bullets.
- §3 Assumes: 13 items, each cited to file:line; verified by the independent pre-flight (all anchors within ~5 lines).
- §4 Context: rules v23 lines, ARCHITECTURE sections, rules files, D-entries and memory references are named.
- §5 Output completeness: about 40 files enumerated, the count justified in-section; PS-6 gaps folded in.
- §6 Naming: `useLightshow`, `lightshowOptions`, `lightshowUsedThisTurn`, `lightshow-played-this-turn`, `UITurnEconomyState` (corrected from a wrong name in round 1). Full English words.
- §7 Dependencies: every listed WP is Done; D-24622 (#2444) is the one open prerequisite and is an explicit BLOCK condition.
- §8 Architecture: engine decides; the client submits intent only; `hero/lightshow.logic.ts` has no boardgame.io or `moves/` import (the cycle is avoided); no server edit; no new top-level `G` field; no persistence change.
- §9 Windows: pnpm and node commands only.
- §10 Env vars: N/A (none).
- §11 Auth: N/A (in-match move; seat authority is unchanged).
- §12 Tests: `node:test`, `.test.ts`, no `boardgame.io/testing`; negative cases (one card, second use, pending, cleanup, unmodelled card, Blazing Fists) are locked so a wrong implementation fails.
- §13 Verification: exact commands with expected exit codes, plus the diagnostics snapshot step.
- §14 ACs: 12, binary and observable.
- §15 DoD: STATUS, DECISIONS (D-24621), WORK_INDEX, EC_INDEX, mindmap, two-commit topology, D-24026 live-verify.
- §16 Code style: 00.6 is cited; no `.reduce()` with branching; `for…of` loops; full sentences in logs.
- §17 Vision: the block is present; §1 / §23 / §24 touched, NG-1 not crossed.
- §18 Prose-vs-grep: N/A (no literal forbidden-token grep in Verification).
- §19 Bridge staleness: the baseline `19b83c50` is cited; the drafting commit re-checks `origin/main` at commit time.
- §20 Funding surface: N/A.
- §21 API catalog: N/A (no endpoint or `apps/server` library change).

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): DO NOT EXECUTE YET.** The anchors checked out (all within ~5 lines), `executeSingleEffect` is callable from a move, and a self-inclusive count source fits `resolveCountSource`. The six blocking findings, all fixed in this revision:
- **PS-1:** `lightshowOptions` in `hero/lightshow.logic.ts` would have created an import cycle, and no shared pending helper exists. `lightshowOptions` moved to `moves/useLightshow.ts`, and the healWounds block-all cluster is copied inline.
- **PS-2:** `ai.competent` cannot compute yields. Replaced with `SCORE_USE_LIGHTSHOW_BASE = 150` minus the option index.
- **PS-3:** the ledger would have marked the 4 unmodelled cards executable. Now executable only with a non-empty `lightshowEffects`.
- **PS-4:** the client parents `PlayDesktop` / `PlayMobile` were added; the `AbilityText` and `useTurnActions` clauses were corrected.
- **PS-5:** `UIEconomyState` → `UITurnEconomyState`.
- **PS-6:** allowlist gaps: `heroAbility.setup.test.ts`, the moveDispatch drift test, the `ai.legalMoves` / `ai.competent` tests, `index.ts`.

RS-1 through RS-5 (D-24016 / D-24489 citation, strip the inner token, drop `KEYWORD_TIMING_DEFAULTS`, the onBeginParity no-edit, pass the full move context) were applied. RS-6, the pre-existing gap in the shared block-all cluster, is noted only.

**Re-check verdict: READY TO EXECUTE.** The one remaining Assumes 6 wording fix is applied.

**Copilot (01.7), round 1: RISK → HOLD.** Five findings, all fixed:
1. Unmodelled lines would never record a runtime hollow. They now emit no wrapper effect.
2. Northern Lights needs a `[keyword:draw:1]` marker. There are 6 markers in total.
3. `reveal-ko` is not a runtime descriptor. The WP now uses the parse-translated `reveal`, with an outcome-asserted test.
4. The log would have shown raw markers. It now logs the card name only.
5. Soft gates. Added the oracle re-pin rule and the diagnostics snapshot step.

The duplicate-copies / `inPlay`-order test was added. The fight-before-Lightshow bot ordering is recorded as an accepted strategy choice.

**Copilot re-run: PASS → CONFIRM** (2026-09-26). The one cosmetic residual (Assumes 8 `reveal-ko` wording) is applied.

**00.3 lint:** all 21 sections resolved (above). An AC count of 13 was reduced to 12 by folding the rebuild-survival check into AC2.
