# WP-842 — Recruitable Sidekick Stack: recruit one Sidekick per turn for 2 Recruit; a played Sidekick returns to the Stack and draws two (Game Engine + Arena Client)

**Status:** Draft 2026-10-26 — pre-flight READY TO EXECUTE (01.4, after PS-1..4 + RS-1..6; re-confirmed after the copilot edits); copilot (01.7) RISK → CONFIRM (round 2); lint (00.3) PASS (EC-880; **D-24776** reserved, #3021). See §Gate Record.
**Primary Layer:** Game Engine + App (arena-client). Crosses layers in the allowed direction: the client submits `recruitSidekick` by name and reads two new UIState fields; the engine imports no client code.
**Dependencies:** none open. Builds on WP-648 / D-24460 (`recruitOfficer`, the move and the SharedDecks button this packet mirrors), WP-129 (`SharedDecks`, `useTurnActions`), WP-731 / D-24552 (the lazily materialized `TurnEconomy` flag pattern and the draw lock), WP-803 / D-24692 (`playedCardIdsThisTurn` counts a played card that left play). All are on `main`.
**User-Visible Surface:** `play.legendary-arena.com` (+ the ewiki page `ewiki.legendary-arena.com/sidekicks/`)
**Lane:** Standard (two-session). It crosses the engine/client boundary, adds a move, two `TurnEconomy` fields and two UIState fields, and changes what playing one card does.

> Baseline: drafted against `26cf298b`; rebased onto `origin/main` `5e28564c` (reserve #3021 and WP-835 #3020 landed; WP-835 is card data only and moves no anchor here). Re-read every line anchor and test total at execution.

---

## Goal

As a player in a match with a Sidekick Stack, I want to recruit a Sidekick for 2 Recruit once per turn and, when I play it, have it go back to the bottom of the Sidekick Stack and draw me two cards, so that the Stack shown on the board is the shop the tabletop game has.

Today the Stack is built (lobby, featured-table and guest-solo matches all set `sidekicksCount: 12`), shown as `Sidekicks [12]`, and nothing can take a card from it. A Sidekick that reached a deck some other way (the operator setter) plays for nothing and sits in the deck.

After this session:

- **Recruit.** A new non-core move `recruitSidekick` moves the top `G.piles.sidekicks` token to the current player's discard and spends 2 Recruit, **at most once per turn**.
- **Play.** Playing a Sidekick moves it from play to the bottom of `G.piles.sidekicks` and draws two cards (automatic, D-24776). The card still counts as played this turn.
- **Board.** The Sidekicks cell becomes a gated recruit button showing the Sidekick card face, like the S.H.I.E.L.D. Officers cell beside it.

## User-Visible Impact

On play.legendary-arena.com the **Sidekicks** cell in the shared-decks row becomes clickable during your Main step: click it to spend 2 Recruit and add a Sidekick to your discard. It disables with a tooltip when it is not your turn, off the Main step, after you healed this turn, after you already recruited a Sidekick this turn, when the Stack is empty, or when you have under 2 Recruit. When you later play the Sidekick, it leaves your play area for the bottom of the Stack, two cards come into your hand, and the game log says so. A new ewiki page, `ewiki.legendary-arena.com/sidekicks/`, documents the rule.

---

## Assumes

1. **Rules text** (`docs/legendary-universal-rules-v23.md`):
   - L727-729 (§"HQ"): you may recruit "Sidekicks (no more than once per turn, using Recruit points) from the Sidekick stack".
   - L3212-3233 ("Sidekicks & Special Sidekicks"): "Players can pay to recruit up to one Sidekick per turn. When card effects tell you to 'gain Sidekicks,' that doesn't count against that one-per-turn limit." … "When you play any Sidekick, return it to the bottom of the Sidekick Stack." "You still 'played' that Sidekick".
   - The printed Secret Wars Vol. 1 Sidekick (`https://images.legendary-arena.com/ssw1/ssw1-sk-sidekick.webp`, read 2026-10-25): cost 2; "You may return this card to the Sidekick Stack. If you do, draw two cards." `data/cards/ssw1.json` `other[]` holds the entry `{ name: "Sidekick", cardType: "sidekick", abilities: [] }`, so the text exists nowhere in card data.
2. **The Stack.** `setup/pilesInit.ts` L43 `SIDEKICK_EXT_ID = 'pile-sidekick'`; L92 builds `piles.sidekicks` from `sidekicksCount` fungible tokens; `pile[0]` is the top (the supply convention `recruitOfficer` uses). `state/zones.types.ts` L92 declares `sidekicks: Zone`. `invariants/gameRules.checks.ts` excludes `pile-sidekick` from the one-zone-per-card check (D-3103), so many copies may share the id.
3. **Cost.** `setup/buildInitialGameState.ts` L567 sets `cardStats[SIDEKICK_EXT_ID] = { attack: 0, recruit: 0, cost: 2, … }`.
4. **Display.** `setup/buildCardDisplayData.ts` L868-880 projects `cardDisplayData['pile-sidekick']` from the `ssw1` `other[]` sidekick entry (name `Sidekick`, the art above), with a `{ name: 'Sidekick', imageUrl: '' }` fallback.
5. **The Officer template (WP-648 / D-24460).** `moves/recruitOfficer.ts` `recruitOfficer({ G, ctx })`: supply check, zone check, `getAvailableRecruit(G.turnEconomy) >= cost`, `G.currentStage !== 'main'` gate, the block-all `hasPending*` guard list, `hasHealedThisTurn`, then `slice(1)` → discard, `spendRecruit`, `hasActedThisTurn = true`, one `pushLog`. Registered `game.ts` L567 (`client: false`), exported `index.ts` L164, dispatched `replay/replay.execute.ts` L151. Not in `CoreMoveName` / `CORE_MOVE_NAMES` / `MOVE_ALLOWED_STAGES`, not in `SIMULATION_MOVE_NAMES` (`simulation/ai.legalMoves.ts` L110).
6. **Move-count drift.** `game.test.ts` L240-277 pins the sorted 53-move set and "exactly 53 moves"; `recruitSidekick` sorts between `recruitOfficer` and `resolveCopyPowersChoice`.
7. **Turn-scoped lazy flags.** `economy/economy.types.ts` `TurnEconomy` (L60) carries optional fields that are absent until set (`drawsLocked?` L115, `isPlayBothSidesActive?`, `outOfTimePlayedCardIds?`). `economy/economy.logic.ts`: `CarriedTurnFields` (L481) and `carryConversionFlag` (L521) carry them across every `addResources` / `spendAttack` / `spendRecruit` rebuild; `resetTurnEconomy` (L1257) returns a literal without them, so they drop at turn start in `game.ts` and in every harness that resets the economy. `enablePlayBothSides` (L953) is the setter shape to copy.
8. **Play path.** `moves/coreMoves.impl.ts` `applyCardPlay` (L286) appends to `inPlay`, adds base stats, logs the play, runs `executeHeroEffects`, then `applyGrantedOutOfTime` (L337). It is called by `playCard` (L599) and by `moves/outOfTime.logic.ts` L77 (the Out of Time replay next turn). `moves/outOfTimeGrant.logic.ts` L256 `applyGrantedOutOfTime` sets a card aside only while it is the last `inPlay` entry. `pile-sidekick` has no `heroAbilityHooks`, so `executeHeroEffects` does nothing for it.
9. **Draws.** `moves/drawCards.logic.ts` L53 `drawCardsIntoHand(playerZones, count, shuffleContext)` draws with the deterministic discard reshuffle and returns the reshuffle count. `hero/heroEffects.execute.ts` L1592 `heroEffectDraw` is the effect-draw template: it draws nothing while `G.turnEconomy.drawsLocked === true` (logs `blocked`), adds the realized count to `G.turnEconomy.cardsDrawn` (D-24476 / D-24732), and logs `applied` / `partial`. `setup/shuffle.ts` `ShuffleProvider = { random: { Shuffle } }`; the `applyCardPlay` context carries `random`.
10. **Played this turn.** `hero/splitCard.logic.ts` L174 `playedCardIdsThisTurn(G, inPlay)` is the rules-facing "cards you played this turn" view used by `hero/heroConditions.evaluate.ts` (L137, L161, L173, L490, L844) and `hero/heroCountSource.resolve.ts`; it adds `outOfTimePlayedCardIds` entries not still in play (D-24692, rules v23 L3441-3453).
11. **UIState.** `ui/uiState.types.ts` `UITurnEconomyState` (L840; active-player-only optional cues such as `rescueOnFightAvailable?`) and `UISharedPilesState` (L929; `officerDisplay?: UICardDisplay`). `ui/uiState.build.ts` builds economy at ~L1092-1135 (cue spreads ~L1123) and piles at ~L1175-1188 (`officerDisplay: resolveDisplay(SHIELD_OFFICER_EXT_ID, gameState)` L1187; `resolveDisplay` L210-226 returns `{ ...entry, heroClass, team }`). `ui/uiState.filter.ts` passes economy cues for the active player only (~L478-520) and fresh-copies `officerDisplay` in the public piles block (~L699-704). `ui/uiState.types.drift.test.ts` L621 pins the `UISharedPilesState` keyset.
12. **Client.** `components/play/SharedDecks.vue` already takes `piles`, `currentStage`, `isViewerTurn`, `hasHealedThisTurn`, `economy`, `submitMove` and renders the Officers button (`officerGate`, `OFFICER_RECRUIT_COST`, `officerDisplay()` fallback); `pages/PlayDesktop.vue` ~L918 and `pages/PlayMobile.vue` ~L655 pass all six, so neither page changes. `composables/useTurnActions.ts` `canRecruitOfficer` (L369) is turn → stage → `healLockGate`. `components/play/uiMoveName.types.ts` L56 lists `'recruitOfficer'`. `apps/server/src/game/clientActionGuard.mjs` admits every `MAKE_MOVE` (no per-move list).
13. **No hashed surface plays a Sidekick.** No `[effect:]` or hero-effect path gains a Sidekick today (`gain a [rule:Sidekick]` lines are reported hollow, D-24618); the simulation never emits a recruit of one; no replay fixture under `test/fixtures/games/` holds `pile-sidekick` in a player zone. Only the operator setter (`moves/operatorSetters.logic.ts` L53, `sidekicks: 'discard'`) moves one into a deck.
14. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline (pre-flight observed engine 5825 / 0 and arena-client 2458 / 0 at `26cf298b`; the server suites need `TEST_DATABASE_URL`, so the executor records whether they ran).

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why automatic, not a choice (D-24776).** The printed card says "You may". A plain Sidekick has no Attack, no Recruit and no class, so keeping it in play only puts a blank card back in your deck at cleanup; returning it costs nothing and draws two. Declining is dominated in every case this engine can reach (Jeff, 2026-10-25: "Use auto-return + draw 2 on play for v1"). Even under Venompool's draw lock, returning still thins the deck. The interactive accept/decline (the Do-Over pattern, D-24498) is a follow-up only if a later card makes declining useful.
- **Why the return still counts as played.** Rules v23 says you still "played" the Sidekick, and L3441-3453 says a played card that moved elsewhere still counts toward "cards you played this turn". Without a record, auto-return would under-count every played-count condition the turn a Sidekick is played (a regression this packet would introduce). The Out of Time ledger (D-24692) is the precedent, but it stores ids and de-duplicates with `includes`; all Sidekicks share one id, so this packet stores a **count** and appends `SIDEKICK_EXT_ID` that many times.
- **Why the flag rides `TurnEconomy`.** `resetTurnEconomy` already clears turn-scoped lazy fields at every turn start: `game.ts` L1028, `simulation/simulation.runner.ts` L870, `simulation/par.aggregator.ts` L911 and `test/fixtures/runFixture.ts` L350 (pre-flight verified). A new top-level `G` field would need a reset in each of those loops. `replay/replay.execute.ts` has no turn rotation (D-24322) and never resets the economy, so under `replayGame` the flag persists across turns exactly as that harness's recruit totals already do; this is a known property of the flat replay, not a new gap.
- **Why not in the simulation.** Mirrors WP-648: keeping `recruitSidekick` out of `SIMULATION_MOVE_NAMES` keeps every determinism oracle byte-identical. Bot / PAR Sidekick buying is a follow-up.
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Zone & Pile Structure (`CardExtId` only), §Persistence Boundaries, §Layer Boundary; `.claude/rules/architecture.md` §UIState Projection Integrity (the five-step field contract).
- `docs/ai/DECISIONS.md`: scan D-24460, D-3103, D-10008, D-24180, D-24552, D-24476, D-24732, D-24692, D-24618, D-24372, D-12803 before coding.
- User memory: `feedback_move_registration_drift_test`, `project_arena_client_uistate_backfill_recurrence`, `reference_engine_tests_never_typechecked`, `reference_setup_hook_change_replay_compat`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+, `node:` prefix. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves never throw. Zones hold `CardExtId` only. No `Math.random`, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24776) before coding. One WP per session.

**Packet-specific:**
- `recruitSidekick` is NOT in `CoreMoveName`, `CORE_MOVE_NAMES`, `MOVE_ALLOWED_STAGES` or `SIMULATION_MOVE_NAMES`. It gates internally.
- Its block-all guard list is copied **verbatim** from `recruitOfficer` (same `hasPending*` set + `hasHealedThisTurn`), in the same order.
- The once-per-turn limit applies to `recruitSidekick` only. Nothing else sets the flag (card-effect gains are exempt by rule).
- The return-and-draw runs only for `SIDEKICK_EXT_ID` and only while it is the last `inPlay` entry; every other card's play is byte-identical.
- Both `TurnEconomy` fields and the `economy.hasRecruitedSidekickThisTurn` UIState cue are omit-when-absent; no default is seeded at setup. `piles.sidekickDisplay` is optional in the type only and always populated by `buildUIState` (the `officerDisplay` precedent).
- The block-all guard list is inlined (about 95 lines, like `recruitOfficer` L145-237), following the house precedent `moves/phaseCard.ts` L74-76 records; `phaseCard.ts` `hasAnyPendingChoice` is not a drop-in (it adds the two put-bottom-HQ guards).

## Locked Values

- **Constants** (`moves/recruitSidekick.ts`, new): `export const SIDEKICK_RECRUIT_COST = 2;` (fallback when `G.cardStats[SIDEKICK_EXT_ID]` is absent, the `OFFICER_RECRUIT_COST` precedent) and `export const SIDEKICK_RETURN_DRAW_COUNT = 2;`.
- **`TurnEconomy`** (`economy/economy.types.ts`), beside `drawsLocked`, each with a JSDoc in the house "LAZILY MATERIALIZED" style:
  - `hasRecruitedSidekickThisTurn?: true` — set by `recruitSidekick`; absent ≡ not yet.
  - `sidekicksReturnedThisTurn?: number` — count of Sidekicks played and returned this turn; absent ≡ 0.
- **`economy/economy.logic.ts`:** both names join `CarriedTurnFields` and `carryConversionFlag` (copied only when `!== undefined`). Two setters in the `enablePlayBothSides` shape (explicit base fields + `...carryConversionFlag(economy)` + the one assignment):
  - `export function markSidekickRecruited(economy: TurnEconomy): TurnEconomy` → `hasRecruitedSidekickThisTurn: true`.
  - `export function recordSidekickReturned(economy: TurnEconomy): TurnEconomy` → `sidekicksReturnedThisTurn: (economy.sidekicksReturnedThisTurn ?? 0) + 1`.
  - `resetTurnEconomy` is unchanged (it already omits both).
- **`recruitSidekick({ G, ctx }: MoveContext): void`**, the `recruitOfficer` body with these differences only:
  - top token `G.piles.sidekicks[0]`; cost `G.cardStats[SIDEKICK_EXT_ID]?.cost ?? SIDEKICK_RECRUIT_COST`;
  - after the stage gate and before the guard list: `if (G.turnEconomy.hasRecruitedSidekickThisTurn === true) return;`;
  - mutate: `G.piles.sidekicks = G.piles.sidekicks.slice(1)`; append to `zones.discard`; `G.turnEconomy = markSidekickRecruited(spendRecruit(G.turnEconomy, requiredCost))`; `G.hasActedThisTurn = true`;
  - log, exactly: `` `Player ${ctx.currentPlayer} recruited ${formatCardRef(G.cardDisplayData, sidekickId)} from the Sidekick Stack (spent ${String(requiredCost)} recruit; sidekicks pile: ${String(G.piles.sidekicks.length)}).` ``
- **`export function returnPlayedSidekick(G: LegendaryGameState, context: unknown, playerID: string): void`** (same file). `context` is `unknown` because `applyCardPlay`'s `Omit<MoveContext, 'G' | 'playerID'>` does not type-check as `ShuffleProvider` (observed TS2345 in the pre-flight scaffold); it is narrowed at the draw with `context as ShuffleProvider` and a `// why:`, the `applyGrantedOutOfTime(G, context: unknown, …)` and `heroEffectDraw` precedents:
  1. `zones = G.playerZones[playerID]`; absent → return. If `zones.inPlay[zones.inPlay.length - 1] !== SIDEKICK_EXT_ID` → return (an Out of Time set-aside already moved it).
  2. `zones.inPlay = zones.inPlay.slice(0, -1)`; `G.piles.sidekicks = [...G.piles.sidekicks, SIDEKICK_EXT_ID]` (bottom); `G.turnEconomy = recordSidekickReturned(G.turnEconomy)`.
  3. If `G.turnEconomy.drawsLocked === true`: log `` `Player ${playerID} returned a Sidekick to the bottom of the Sidekick Stack but can't draw — no more draws this turn.` `` with outcome `'blocked'` and card `SIDEKICK_EXT_ID`; return.
  4. Else `handBefore = zones.hand.length`; `drawCardsIntoHand(zones, SIDEKICK_RETURN_DRAW_COUNT, context as ShuffleProvider)`; `drawnCount = zones.hand.length - handBefore`; `G.turnEconomy.cardsDrawn += drawnCount`; log `` `Player ${playerID} returned a Sidekick to the bottom of the Sidekick Stack and drew ${String(drawnCount)} card(s).` `` with outcome `'applied'` when `drawnCount === SIDEKICK_RETURN_DRAW_COUNT`, else `'partial'`, card `SIDEKICK_EXT_ID`.
- **Hook** (`moves/coreMoves.impl.ts` `applyCardPlay`): the last statement, after `applyGrantedOutOfTime`: `if (cardId === SIDEKICK_EXT_ID) { returnPlayedSidekick(G, context, playerID); }`.
- **`playedCardIdsThisTurn`** (`hero/splitCard.logic.ts`): right after `playedCardIdsStillInPlay` and **before** the Out of Time loop, append `SIDEKICK_EXT_ID` once per `G.turnEconomy?.sidekicksReturnedThisTurn ?? 0`, with no de-duplication among those appends; the early `return played` for an absent Out of Time ledger moves below the append so it runs on both paths. Placing it first lets the Out of Time loop's existing `includes` de-dup absorb a Sidekick that was replayed from Out of Time and then returned (`replayOutOfTimeCards` records the ledger before `applyCardPlay`), so that card counts once (pre-flight PS-3). Accepted residual, named in D-24776: when two Sidekicks are played in one turn and one of them is set aside by a granted Out of Time, the de-dup absorbs the set-aside one and the turn counts one Sidekick instead of two (T11c pins it).
- **Wiring:** `game.ts` `recruitSidekick: { move: recruitSidekick, client: false }` after `recruitOfficer` (D-10008 `// why:`); `index.ts` `export { recruitSidekick, returnPlayedSidekick, SIDEKICK_RECRUIT_COST, SIDEKICK_RETURN_DRAW_COUNT } from "./moves/recruitSidekick.js";`; `replay.execute.ts` `recruitSidekick: (context) => recruitSidekick(context as never)` after `recruitOfficer`.
- **UIState:**
  - `UITurnEconomyState.hasRecruitedSidekickThisTurn?: true`. Built as `...(gameState.turnEconomy.hasRecruitedSidekickThisTurn === true ? { hasRecruitedSidekickThisTurn: true as const } : {})`; passed through for the **active player only**, the same conditional; absent from `REDACTED_ECONOMY`.
  - `UISharedPilesState.sidekickDisplay?: UICardDisplay`. Built as `sidekickDisplay: resolveDisplay(SIDEKICK_EXT_ID, gameState)` beside `officerDisplay`; PUBLIC; fresh-copied in the filter's piles block exactly like `officerDisplay`.
- **Client:**
  - `uiMoveName.types.ts`: `| 'recruitSidekick'` after `'recruitOfficer'`, with a `// why:`.
  - `useTurnActions.ts`: `canRecruitSidekick: () => GatingResult` in the interface and the implementation, body identical to `canRecruitOfficer`.
  - `SharedDecks.vue`: imports `SIDEKICK_RECRUIT_COST` and exposes `const sidekickCost = SIDEKICK_RECRUIT_COST;` (the `officerCost` shape); `sidekickGate()` precedence turn → stage → heal lock (via `canRecruitSidekick` + `healLockGate`) → `economy.hasRecruitedSidekickThisTurn === true` → `piles.sidekicksCount <= 0` → `economy.availableRecruit < SIDEKICK_RECRUIT_COST`. Reasons, exactly: `'You already recruited a Sidekick this turn.'`, `'No Sidekicks remain in the Sidekick Stack.'`, `` `Needs ${sidekickCost} recruit, you have ${props.economy.availableRecruit}.` ``. Default title `` `Recruit a Sidekick for ${sidekickCost} recruit (once per turn)` ``. `onRecruitSidekick()` → `props.submitMove('recruitSidekick', {})`. `sidekickDisplay()` falls back to `{ extId: 'pile-sidekick', name: 'Sidekick', imageUrl: '', cost: null }`. The Sidekicks `<li>` keeps `data-testid="play-shared-deck-sidekicks"`; its button is `data-testid="play-recruit-sidekick"` with the Officers button's markup (CardTile `size="sm"`, `:show-cost="false"`, name, count, `Recruit: {{ sidekickCost }}`). The header doc-comment's "the other four cells stay static counts" becomes "the other three".

---

## Scope (In)

- **A) Engine move + on-play return** — `moves/recruitSidekick.ts` (new) + `moves/recruitSidekick.test.ts` (new).
- **B) Turn economy** — `economy/economy.types.ts` (two fields), `economy/economy.logic.ts` (carry + two setters), `economy/economy.logic.test.ts` (additions).
- **C) Play hook + played-count** — `moves/coreMoves.impl.ts` (one call), `hero/splitCard.logic.ts` (the append) + `hero/splitCard.logic.test.ts` (T11, T11b, T11c, T12).
- **D) Wiring** — `game.ts`, `index.ts`, `replay/replay.execute.ts`, `game.test.ts` (add `recruitSidekick` to the sorted array AND the test-title list at L240, a WP-842 / D-24776 why line, message `exactly 54 moves`).
- **E) UIState five-step** — `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.build.test.ts`, `ui/uiState.filter.test.ts`, `ui/uiState.types.drift.test.ts` (both new names pinned); step 5 is the `uiStateSnapshot` check in Verification.
- **F) Client** — `uiMoveName.types.ts`, `useTurnActions.ts` + `useTurnActions.test.ts`, `SharedDecks.vue` + `SharedDecks.test.ts`. **Intended assertion change (Reward Integrity):** the existing `SharedDecks.test.ts` case at L186-197 ("the other four supply cells stay static counts… exactly one recruit button") encodes the pre-WP behavior and fails on the new button (observed `2 !== 1` in the scaffold); it is rewritten to two buttons (Officers, Sidekicks) and three static cells, and the `EC-880:` commit body says so.
- **G) ewiki** — `wiki/sidekicks.md` (new; the `wiki/shield-officer.md` front-matter and shape).

## Out of Scope

- **"Gain a Sidekick" card effects** (cvwr, ssw1, co2e, msmc, mdns; hollow per D-24618). A follow-up adds a `gain-sidekick` primitive on top of this Stack; it must not set `hasRecruitedSidekickThisTurn`.
- **Special Sidekicks** (cvwr Pet Avengers, co2e Daring Sidekick) with their own abilities and identities; the Stack stays fungible `pile-sidekick` tokens (D-3103).
- **The interactive "may"** (accept / decline). Automatic by D-24776.
- **Bot / PAR / simulation Sidekick buying** and any `SIMULATION_MOVE_NAMES` / `ai.*` change.
- **Copy Powers on a Sidekick** (copies no ability; unchanged), **Excessive Violence**, and **Fortify the Sidekick Stack** (cvwr).
- **Pre-planning sandbox** (`packages/preplan`): a speculative Sidekick play is reconciled by the existing disruption pipeline; no change.
- **Registry-viewer `DEFAULT_SIDEKICKS_COUNT = 0`** vs the lobby's 12 (a separate papercut).
- **Arena-client UIState JSON fixtures** under `src/fixtures/uiState/`: both new fields are optional, so they need no backfill.
- **PlayedCardsRow "Played This Turn — N"** (`apps/arena-client/src/components/play/PlayedCardsRow.vue` L133) counts physical `inPlay` only; a returned Sidekick is recorded by its log line, as Out of Time cards already are. A follow-up may surface the engine count.
- Any server, registry or card-data change.

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `moves/recruitSidekick.ts` — **new**; `moves/recruitSidekick.test.ts` — **new**
- `economy/economy.types.ts` — modified (contract file; D-24776)
- `economy/economy.logic.ts` — modified; `economy/economy.logic.test.ts` — modified
- `moves/coreMoves.impl.ts` — modified (one call)
- `hero/splitCard.logic.ts` — modified; `hero/splitCard.logic.test.ts` — modified (T11, T11b, T11c, T12)
- `game.ts` — modified; `game.test.ts` — modified (53 → 54)
- `index.ts` — modified
- `replay/replay.execute.ts` — modified
- `ui/uiState.types.ts` — modified (contract file; D-24776); `ui/uiState.build.ts`, `ui/uiState.filter.ts` — modified
- `ui/uiState.build.test.ts`, `ui/uiState.filter.test.ts`, `ui/uiState.types.drift.test.ts` — modified (additions)

**Client (`apps/arena-client/src/`)**
- `components/play/uiMoveName.types.ts` — modified (contract file; D-24776)
- `composables/useTurnActions.ts` — modified; `composables/useTurnActions.test.ts` — modified
- `components/play/SharedDecks.vue` — modified; `components/play/SharedDecks.test.ts` — modified

**ewiki:** `wiki/sidekicks.md` — **new**

**Governance close:** `docs/ai/post-mortems/01.6-WP-842-recruitable-sidekick-stack.md` (**new**; mandatory under 01.6: a new execution path and new projection fields), `docs/ai/DECISIONS.md` (D-24776), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

That is 24 code / test / wiki files (3 new, 21 modified, 9 of them tests; T15b lives in `moves/recruitSidekick.test.ts`). Above the ~10 guideline because a move is wired at four fixed sites (WP-648 touched 12 files for the move alone), the played-count fix adds two engine files, and the five-step UIState contract adds six. Every edit is a small anchored addition; no file is refactored.

## Contract

- The Locked Values: the two constants, the two `TurnEconomy` fields and setters, `recruitSidekick`, `returnPlayedSidekick`, the hook placement, the `playedCardIdsThisTurn` append, the three wiring entries, the two UIState fields and their audiences, `'recruitSidekick'` / `canRecruitSidekick`, the SharedDecks gate order, reasons and test ids.
- `applyCardPlay`, `playCard`, `recruitOfficer` and `resetTurnEconomy` keep their signatures.

## Test Contract

Engine cases build a minimal `G` in the `recruitOfficer.test.ts` style (`makeMockCtx`, a Main-stage `G` with `piles.sidekicks = ['pile-sidekick', 'pile-sidekick', 'pile-sidekick']`, `cardStats['pile-sidekick'].cost = 2`).

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| T1 | `recruitSidekick` with 2 recruit | pile 3 → 2; discard ends with `pile-sidekick`; `spentRecruit` +2; `hasActedThisTurn` true; `turnEconomy.hasRecruitedSidekickThisTurn === true`; one log line equal to the locked text | |
| T2 | T1, then a second `recruitSidekick` with 2 more recruit | no change on the second call | once per turn |
| T3 | 1 recruit; empty pile; stage `start`; `hasHealedThisTurn`; a parked `pendingKoHeroChoices` entry (`hasPendingKoHeroChoice`; the field `recruitOfficer.test.ts` parks for its block-all case); missing current-player zone | no mutation each; never throws | silent no-ops |
| T4 | `cardStats['pile-sidekick']` absent, 2 recruit | succeeds (fallback 2); with 1 recruit fails | fallback constant |
| T5 | `recruitSidekick`, then `resetTurnEconomy()` | the reset economy has no `hasRecruitedSidekickThisTurn` key; a fresh recruit succeeds | flag drops at turn start |
| T6 | `playCard` of `pile-sidekick` from hand; deck of 3; `G.piles.sidekicks = ['sidekick-stack-marker', 'pile-sidekick']` (a distinct test string so the end is observable; all real tokens share one id) | `inPlay` has no `pile-sidekick`; `deepStrictEqual(G.piles.sidekicks, ['sidekick-stack-marker', 'pile-sidekick', 'pile-sidekick'])`; hand gained the top 2 deck cards; `cardsDrawn` +2; `sidekicksReturnedThisTurn === 1`; log line `applied` with the locked text | other zones untouched |
| T7 | T6 with deck 1, discard 2 | draws 2 (one reshuffle); with deck 0 / discard 0 draws 0, outcome `partial` | short draw honest |
| T8 | T6 with `drawsLocked: true` | Sidekick returned, hand unchanged, `cardsDrawn` unchanged, outcome `blocked` | draw lock respected |
| T9 | `playCard` of a S.H.I.E.L.D. Agent (`starting-shield-agent`) | identical to today: stays in play, no draw, no `sidekicksReturnedThisTurn` key | other cards byte-identical |
| T10 | `returnPlayedSidekick` when the last `inPlay` entry is not `pile-sidekick` (Out of Time set it aside) | no change | |
| T10b | `replayOutOfTimeCards` (`moves/outOfTime.logic.ts` L46) with `outOfTimeCards['0'] = ['pile-sidekick']`, deck of 3 | Stack +1, hand +2, discard unchanged, `outOfTimePlayedCardIds = ['pile-sidekick']`, `sidekicksReturnedThisTurn === 1` | the turn-2 replay returns the Sidekick instead of the keyword discard (D-24776) |
| T11 | Two Sidekicks played and returned, plus an Agent in play: `playedCardIdsThisTurn(G, inPlay)` | `['starting-shield-agent', 'pile-sidekick', 'pile-sidekick']` | count, not de-duplicated |
| T11b | Out of Time replay of a Sidekick: `outOfTimePlayedCardIds: ['pile-sidekick']`, `sidekicksReturnedThisTurn: 1`, empty `inPlay` | `['pile-sidekick']` | counted once, not twice |
| T11c | the residual: `outOfTimePlayedCardIds: ['pile-sidekick']` (a set-aside this turn) plus `sidekicksReturnedThisTurn: 1` (a second Sidekick), `inPlay: []` | `['pile-sidekick']` (one, the accepted D-24776 undercount) | the same state as T11b: pins that the two histories collapse to one count |
| T12 | `playedCardIdsThisTurn` with no `sidekicksReturnedThisTurn` and no Out of Time ledger | equals today's output | byte-identical path |
| T13 | `markSidekickRecruited` / `recordSidekickReturned` then `addResources`, `spendAttack`, `spendRecruit` | both fields survive every rebuild; `recordSidekickReturned` twice → 2 | carry chokepoint |
| T14 | `resetTurnEconomy()` and a base economy round-tripped through `JSON.stringify` | neither key present | omit-when-absent |
| T15 | `LegendaryGame.moves` | 54 names incl. `recruitSidekick`; `recruitSidekick` not in `CORE_MOVE_NAMES`; `SIMULATION_MOVE_NAMES` lacks it (runtime assertion) | D-24372 |
| T15b | `applyReplayStep(G, { moveName: 'recruitSidekick', playerId: '0', args: {} }, 1)` (`replay/replay.execute.ts` L213) on a minimal Main-stage `G` with 2 recruit (a `replayGame` run from setup would no-op the move at stage `start` / recruit 0) | one token popped from `piles.sidekicks` | replay dispatch wired |
| T16 | `buildUIState` after a recruit; before | `economy.hasRecruitedSidekickThisTurn === true`; key absent (keyset assertion on the built projection) | omit-when-absent |
| T17 | `buildUIState` piles | `piles.sidekickDisplay` deep-equals `{ ...cardDisplayData['pile-sidekick'], heroClass: null, team: null }` (the `resolveDisplay` shape, `uiState.build.ts` L210-227) and is not the same object | fresh copy |
| T18 | `filterUIStateForAudience`: active player; another player; spectator | cue present; absent; absent. `sidekickDisplay` present for all three, survives a JSON round-trip, not aliased to the full UIState | audience whitelist |
| T19 | drift test | `UISharedPilesState` keyset includes `sidekickDisplay`; a built-projection keyset pins `hasRecruitedSidekickThisTurn` | runtime keyset |
| T20 | `useTurnActions(...).canRecruitSidekick()` off-turn; at `start`; healed; at `main` | not your turn; stage reason; heal reason; allowed | |
| T21 | `SharedDecks` mount: allowed; already recruited; count 0; 1 recruit; not your turn | button enabled and click emits `('recruitSidekick', {})`; disabled with each locked reason; the Officers button is unaffected | gate order |
| T22 | `SharedDecks` with `piles.sidekickDisplay` absent | renders the fallback name `Sidekick` | no crash on old snapshots |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed. Recruiting a Sidekick spends in-game Recruit only; no money, cosmetic or account state reaches it.

**Determinism preservation:**
- Both `TurnEconomy` fields and the `economy` cue are omit-when-absent; no setup default is seeded. `piles.sidekickDisplay` is always populated, but UIState is a projection, never hashed.
- The return-and-draw uses `drawCardsIntoHand` with the move context's `random.Shuffle`, never `Math.random`.
- No simulation, sentinel, `PRE_WP080` or replay fixture plays or recruits a Sidekick (Assumes 13), so both hash oracles, `sim:runtime-observed`, `sim:coverage` and Seed-PAR are expected unchanged. If any moves, STOP: something emitted the move or played the token.
- **Replay-compat:** a stored match that never played a Sidekick replays identically. A match created before the deploy in which an operator-setter Sidekick was played would replay differently; operator matches are not scored or verified, so this is accepted and named in D-24776. Live-verify uses a match created after the deploy.

## Funding Surface Gate

§20 **N/A**: engine rules and one board control. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Recruit.** T1-T5 pass.
2. **Play.** T6-T12 (incl. T10b, T11b, T11c) pass.
3. **Economy.** T13-T14 pass.
4. **Wiring.** T15 and T15b pass.
5. **UIState.** T16-T19 pass, and the cue plus `sidekickDisplay` appear in the Play Diagnostics `uiStateSnapshot` of a local match.
6. **Client.** T20-T22 pass; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
7. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` has 0 failures; `sim:runtime-observed:check` and `sim:coverage --check` exit 0 with nothing regenerated; hash oracles unchanged.

## Verification Steps

1. `pnpm -r build` → 0. Record the game-engine and arena-client test totals before any edit.
2. `pnpm --filter @legendary-arena/game-engine test` → 0 fail; record the total.
3. `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm --filter @legendary-arena/arena-client test` → 0 fail.
4. `pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0.
5. `Select-String -Path packages\game-engine\src\simulation\ai.legalMoves.ts -Pattern recruitSidekick` → no output.
6. `pnpm -r --no-bail test` → 0 fail.
7. Local match: `pnpm -r build`; `pnpm --filter @legendary-arena/server start` and `pnpm --filter @legendary-arena/arena-client dev`; create a lobby match (default `sidekicksCount: 12`): recruit a Sidekick, confirm the button disables with the once-per-turn reason, and confirm the Play Diagnostics `uiStateSnapshot` shows `economy.hasRecruitedSidekickThisTurn: true` and `piles.sidekickDisplay`.
8. `git status --porcelain` (tracked + untracked) ⊆ Files Expected to Change. Revert any `lagn-v1.json` line-ending churn.
9. `pnpm wiki-viewer:project && pnpm wiki-viewer:check-links` → 0 (the new `wiki/sidekicks.md` has no broken links).
10. Revert proofs, one at a time, each failing at least one T-case: drop the once-per-turn check (T2); drop `markSidekickRecruited` from the move (T2); drop the hook in `applyCardPlay` (T6); append to the pile's front instead of the end (T6, via its marker); drop the draw-lock branch (T8); drop the `playedCardIdsThisTurn` append (T11); drop the carry lines (T13); drop the active-player `hasRecruitedSidekickThisTurn` pass-through in `filterUIStateForAudience` (T18, active-player case); drop the `replay.execute` entry (T15b); move the Sidekick append after the Out of Time loop (T11b).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the ten revert proofs were observed.
- [ ] D-24776 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, with follow-up lines for the gain-Sidekick primitive, Special Sidekicks, and bot / PAR Sidekick buying.
- [ ] The 01.6 post-mortem `docs/ai/post-mortems/01.6-WP-842-recruitable-sidekick-stack.md` written (verdict WP COMPLETE).
- [ ] `wiki/sidekicks.md` written.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-880:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a match created after the deploy on `play.legendary-arena.com`, with the deployed gitSha checked and `sidekicksCount` > 0: the Sidekicks cell shows the Sidekick card face; recruiting spends 2 Recruit, the count drops by one and the cell disables with "You already recruited a Sidekick this turn."; on a later turn, playing the Sidekick removes it from play, raises the Stack count by one, draws two cards and logs the return line. After the ewiki deploy, `ewiki.legendary-arena.com/sidekicks/` returns 200 with the page title (curl with the `CF-Access-Client-Id` / `CF-Access-Client-Secret` service-token headers). Record as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24776 — recruitable-sidekick-stack.** It locks:
- `recruitSidekick` as a non-core, internally gated move mirroring `recruitOfficer` (D-24460), out of the simulation move set;
- the once-per-turn limit as `TurnEconomy.hasRecruitedSidekickThisTurn?`, set only by the recruit move (card-effect gains exempt, rules v23 L3216-3218);
- the automatic return-and-draw-two on play (the printed "may" collapsed, Jeff 2026-10-25), placed after Out of Time in `applyCardPlay`, respecting the draw lock and counting toward `cardsDrawn`;
- "still played" as a `TurnEconomy.sidekicksReturnedThisTurn?` count read by `playedCardIdsThisTurn` (a count because Sidekick tokens share one id), appended before the Out of Time loop so a replayed-then-returned Sidekick counts once; the accepted residual undercount (two Sidekicks in one turn, one set aside by a granted Out of Time) is named here and pinned by T11c;
- on the turn-2 Out of Time replay the return-and-draw runs inside the replayed play, so the Sidekick goes to the bottom of the Stack instead of the keyword's discard (T10b);
- the return hook and the played count cover the fungible `pile-sidekick` only; a Special Sidekick WP must extend the hook to its ids and record them in an id ledger, not this count;
- a granted Out of Time set-aside beats the return (the hook runs after `applyGrantedOutOfTime` and returns only while the Sidekick is the last `inPlay` entry);
- the two UIState fields and their audiences (active-player cue; public card face), and `UiMoveName` gains `'recruitSidekick'`;
- the replay-compat note (operator-staged Sidekick plays in pre-deploy matches replay differently; accepted).

---

## Gate Record

**Pre-flight (01.4) (independent subagent): NOT READY → READY TO EXECUTE after four blocking text fixes, all applied** (the reviewer stated the verdict flips without a re-run once PS-1..4 land). Empirical scaffold in a throwaway worktree at `26cf298b`: engine 5825 / 0 → 5825 / 0 with the rough implementation (incl. `game.test.ts` 53 → 54); `sim:runtime-observed:check` and `sim:coverage --check` OK (no hash, sentinel or replay pin moved); arena-client typecheck 0; arena-client 2458 / 0 → 1 fail, `SharedDecks.test.ts:196` (RS-1). Smoke: recruit, once-per-turn, reset re-enable and the play-return-draw path all behaved as locked.
- **PS-1 (fixed):** boolean prefix rule → `hasRecruitedSidekickThisTurn` (also matched the WORK_INDEX row).
- **PS-2 (fixed):** the locked hook did not compile (TS2345: `Omit<MoveContext, …>` is not a `ShuffleProvider`) → `returnPlayedSidekick(G, context: unknown, playerID)` narrowing at the draw.
- **PS-3 (fixed):** a Sidekick replayed from Out of Time was counted as played twice (observed) → the count is appended before the Out of Time loop; T11b, T11c; residual named in D-24776.
- **PS-4 (fixed):** T17 could not deep-equal the raw display entry (`resolveDisplay` adds `heroClass` / `team`).
- **RS-1..6 (applied):** the SharedDecks single-button assertion named as an intended change; replay has no economy reset (Context corrected); T3's parked field; file arithmetic + `splitCard.logic.test.ts`; anchors and `sidekickCost`; Assumes 14 baseline totals.

Re-check after the copilot edits (same subagent, read-only): **READY TO EXECUTE confirmed**, no new PS; T10b traced through `replayOutOfTimeCards` and matches the earlier scaffold smoke (discard `[]`, hand +2, Stack 3→4).

**Copilot (01.7), round 1 (independent subagent): RISK (HOLD), eleven fixes, all applied.** 1. revert proof 4 was unobservable (all tokens share one id) → T6 seeds a `sidekick-stack-marker`; 2. the turn-2 Out of Time replay of a Sidekick was unnamed → T10b + a D-24776 bullet; 3. T11b/T11c had no file → split-card test list; 4. EC hard-coded 2 → `SIDEKICK_RETURN_DRAW_COUNT`; 5. proof 8 ambiguous → the active-player cue pass-through; 6. `uiState.types.ts` / `uiMoveName.types.ts` marked as contract files; 7. EC "four fields" corrected; 8. move-count edit covers the test title; 9. PlayedCardsRow count gap → Out of Scope; 10. ewiki page → check-links step + live-verify; 11. D-24776 names the plain-Sidekick-only scope.

**Copilot (01.7), round 2: CONFIRM.** All eleven fixes and the three lint tightenings verified; no new contradiction (test IDs, ten revert proofs, Verification 1-10 consistent). One literal nit applied in place: T15b's `ReplayMove` literal carries `args: {}`.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 runs. Run 1 FAILED §2 (omit-when-absent claim vs an always-built `sidekickDisplay`), §5 (file arithmetic, T11/T12 home), §13 (inexact dev-server step; `git diff` blind to new files), §14 (T17 shape, AC4 untested, T3 field), §16.3 (boolean prefix) plus two EC-TEMPLATE items (typecheck gate, verbatim Locked Values) → all fixed. Run 2 PASS with three optional tightenings (applied). Run 3 (after the copilot fixes) PASS; its two nits (`&&` in step 9, the ewiki page in User-Visible Impact) applied.

| § | Result |
|---|---|
| §1 | PASS — all sections; Out of Scope closed (10 items); 7 ACs |
| §2 | PASS — engine-wide block, session protocol, packet constraints, Locked Values; no contradiction |
| §3 | PASS — Assumes 1-14 cover every anchor; STOP if false |
| §4 | PASS — ARCHITECTURE sections, UIState rules contract, 11 D-ids, memory refs; 00.2 not needed (runtime state) |
| §5 | PASS — 24 files (3 new, 21 modified, 9 tests), three contract files flagged, size justified |
| §6 | PASS — names match code; no setup-payload field touched |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine → client via the `.` surface only; zones hold `CardExtId` |
| §9 | PASS — pnpm / `Select-String` / git only |
| §10 | N/A — no new environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — `node:test`, in-memory G, no boardgame.io / network / DB |
| §13 | PASS — exact commands; every script exists |
| §14 | PASS — 7 binary ACs tied to T1-T22 + T10b, T11b, T11c, T15b |
| §15 / §15.1 | PASS — DoD covers ACs, allowlist, ten revert proofs, STATUS, DECISIONS, indexes, post-mortem; D-24026 live-verify on `play.legendary-arena.com` (new match) + the ewiki page |
| §16 | PASS — boolean prefix; `// why:` sites enumerated; inlined guard list justified by precedent |
| §17 | PASS — §1 / §8 / §22 / NG-1; conflict line; determinism + replay-compat |
| §18 | PASS — the only grep targets an untouched file |
| §19 | N/A at draft — commit-time (baseline line updated) |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |

**Verdict:** PASS.
