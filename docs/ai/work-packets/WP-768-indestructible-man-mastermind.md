# WP-768 — Indestructible Man: the Elite Assassin shuffle-fight, Master Strike and tactics (Game Engine)

**Status:** Draft 2026-09-26
**Primary Layer:** Game Engine (fight rules, strike, tactics, UIState projection)
**Dependencies:**
- WP-497 (tactic `onFight` dispatch)
- WP-687 / D-24504 (`isFinalBlowAvailable`: a single-predicate gate precedent)
- WP-692 / D-24509 (filtered free-recruit from the HQ)
- WP-750 / D-24574 (the Mastermind `fightCost` projection)
- WP-765 / D-24598 (`victoryPointValueForCard`)
- D-24160 (the Villain Deck never reshuffles, so this is the first mid-game shuffle-in)

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It adds a move-argument contract, a new turn flag, a UIState field and new mechanics.
**Arc:** WP-768 (engine, this packet), then WP-770 (client chooser). Its sibling is WP-769 (Killmonger).

> Baseline: `origin/main` at `b7efb34a`, plus the reserve commit (#2412).

---

## Goal

`bkwd/indestructible-man` (`data/cards/bkwd.json:709-770`) prints:

> "You can't use [icon:attack] to fight Indestructible Man."
> "Once during each of your turns, you may shuffle two Elite Assassins from your Victory Pile into the Villain Deck. If you do, fight Indestructible Man."
> "Master Strike: Shuffle an Elite Assassin from your Victory Pile into the Villain Deck. If you can't, each player gains a Wound."

**Today he is a free win.** His printed attack is 0 (`resolveMastermindFightCost` returns 0), `fightMastermind` has no once-per-turn cap, and the bot's `fightMastermind` intent scores highest. So any player, or the bot, can defeat all four tactics on their first turn for 0 attack. He sits on every ranked gauntlet leg for bkwd (`gauntletLoadouts.generated.ts:222-232`). WP-762/750 accepted this as a residual; this packet closes it.

**After this session:**

1. **Attack no longer fights him.** A normal `fightMastermind` call against Indestructible Man is refused.
2. **The shuffle-fight.** `fightMastermind` gains an optional `shuffleAssassinIds` argument: the player's **own choice** of exactly 2 Elite Assassins from their Victory Pile (operator decision 2026-09-26).
   - It is allowed **once per turn**.
   - The engine validates the pick, removes both cards from the Victory Pile, shuffles them into the Villain Deck, and runs the normal tactic defeat with no attack spent.
3. **Master Strike.** It shuffles one Elite Assassin from the current player's Victory Pile into the Villain Deck. If the current player has none, each player gains a Wound instead.
4. **Tactics.**
   - Secrets of Indestructibility, International Arms Dealer and Unveil Project Four resolve their Fight text, plus the shared clause "If this is not the last Tactic, play two cards from the Villain Deck". Project Four uses the operator-chosen **approximation**.
   - Manipulate Murderous Mad Monk stays a recorded hollow.
5. **Projection.** A `UIMastermindState.shuffleFight` field feeds WP-770's chooser and gates the bot.

## User-Visible Impact

Indestructible Man stops being a free leaderboard win. Players must bank Elite Assassins in their Victory Pile and spend two of them, once per turn, to hit him. His strikes and tactics do what they print, and the free "fight for 0" disappears. The chooser UI ships in WP-770. Until then, the engine is correct and the live client shows a refused Fight, so **deploy WP-768 and WP-770 together**. Merging WP-768 alone still closes the exploit.

---

## Operator Decisions (2026-09-26)

- **Assassins are player-chosen.** The engine takes the ids as move arguments, following the WP-757 exorcise argument pattern, not a pending-choice queue. The bot and the default intent pick the two with the lowest VP (ties broken by `extId`).
- **Unveil Project Four is approximated.** Other players discard each hand card whose printed **cost, attack, recruit or VP** value, as a string, contains the digit `4`. The log line says "(approximate)". A 4 that appears only in a card's rules text or art is not caught. This is a named gap.

---

## Assumes

1. `fightMastermind` (`moves/fightMastermind.ts`):
   - It computes the required cost from `resolveMastermindFightCost` (`economy/economy.resolve.ts:~243`) and checks spendable attack (`:~146`).
   - It uses the block-all guards (`:~151-213`) and the Final Blow path.
   - It has optional arguments (`useExcessiveViolence?`).
   - It routes defeats through `defeatMastermindTacticCore(G, ctx, { random }, events)`, which rescues Bystanders and fires tactic `onFight` via `dispatchTacticOnFight` (`rules/tacticHandlers.ts:1300`).
   - The **move** sets `G.hasActedThisTurn` (`fightMastermind.ts:~264`), not the core.
   - The Final Blow branch is `isFinalBlow → awardMastermindOnFinalBlow`, otherwise the core (`:~233`).
   - The spendable-attack check is at `:~153`, `hasHealedThisTurn` at `:~217`, and the Diamond Form edge at `:~271`.
2. There is no Indestructible Man code anywhere in `packages/game-engine/src`. His strike takes only the generic branch (`rules/mastermindHandlers.ts:1204`), and all 4 tactics are `unmarked` (`data/metadata/effect-implementation-index.json:3667-3700`).
3. **Elite Assassins** (`bkwd.json:844`) have extIds prefixed `bkwd-villain-elite-assassins-`: Blue Talon ×2 (2 VP), Iron Maiden ×2 (2), Snapdragon ×2 (2), Black Lotus ×2 (3). He Always Leads them.
4. **Per-turn state and deck order.**
   - Per-turn flags reset where `villainRevealedThisTurn` resets (`game.ts:~860`).
   - The Villain Deck is `G.villainDeck.deck`, top = index 0, and it never reshuffles (D-24160).
   - `random.Shuffle` is available in moves.
5. **Helpers.**
   - `playTopVillainDeckCards(G, context, implementationMap, n)` is at `villainDeck/villainDeck.reveal.ts:~702`. `DEFAULT_IMPLEMENTATION_MAP` is used from moves (the `fightVillain.ts` precedent).
   - `gainWoundForPlayer` is at `board/wounds.logic.ts:70`.
   - The filtered free-recruit is `freeRecruitFromHqByFilter` (`tacticHandlers.ts:~862`, WP-692).
   - `victoryPointValueForCard` is in `economy/bloodFrenzy.logic.ts` (WP-765).
6. **Bot and sim.**
   - `ai.legalMoves.ts:~936-939` emits `fightMastermind` whenever tactics remain.
   - `scoreFightMastermind` is at `ai.competent.ts:~280`.
   - **The four MOVE_MAPs currently dispatch `fightMastermind` WITHOUT args.** Each has the form `(context) => fightMastermind(context as never)`, at:
     - `simulation/simulation.runner.ts:~324`
     - `simulation/par.aggregator.ts:~482`
     - `test/fixtures/runFixture.ts:~187`
     - `replay/replay.execute.ts:~141`
   - This packet changes each to `(context, args) => fightMastermind(context as never, args as never)`. That also fixes the pre-existing drop of `useExcessiveViolence`.
   - `simulation/onBeginParity.ts:~52` (`applyOnBeginParity`) mirrors the `game.ts` onBegin resets for the runner, PAR and fixture loops.
6a. **Shuffle sources.**
   - The strike handler receives `strikeContext: unknown`. `resolveShuffleFunction(strikeContext)` (`mastermindHandlers.ts:145`, returns a function or null) and `resolveCurrentPlayer(strikeContext)` (`:255`) exist.
   - `dispatchTacticOnFight` receives `shuffleContext` but no RevealContext or implementationMap. The precedent for building one is `fightVillain.ts:~489-494`.
   - `HollowEffectRecord.cardType` is `'hero'|'villain'|'henchman'` (`diagnostics/hollowEffect.types.ts:140`), and a record needs `turn`.
6b. **Card data in G.** `CardStatEntry` cost/attack/recruit are **parsed numbers** (`economy/economy.types.ts:112`); there are no printed strings in G. Heroes have no VP. `G.cardVictoryPoints` covers villains, henchmen and the Mastermind.
6c. **Assassin ids** carry a copy suffix (`…-blue-talon-00`, `villainDeck.setup.ts:486`), so a prefix match is correct.
7. **UIState.**
   - `UIMastermindState` (`ui/uiState.types.ts:~651`) has `fightCost?` (WP-750) and `finalBlowPending?`.
   - The filter passes these through with a conditional spread (`uiState.filter.ts:~505`).
   - Victory Piles are projected per player.
8. **Parallel packets.** WP-757 (Haunt) also adds a `fightMastermind` guard (`isMastermindHaunting`), and WP-769 (Killmonger) changes `fightMastermind` and `resolveMastermindFightCost`. These are additive, independent branches. Whichever lands second rebases and keeps both.
9. `pnpm -r build` exits 0, and the engine suite is green.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `data/cards/bkwd.json` Indestructible Man, his 4 tactics and Elite Assassins (`:709-860`). The card text is the only rules authority; v23 has no ruling.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) and §Move Validation Contract.
- `docs/ai/REFERENCE/00.2-data-requirements.md`: this packet adds a G field and a UIState field.
- `.claude/rules/architecture.md` §UIState Projection Integrity.
- `docs/ai/DECISIONS.md`: D-24504, D-24509, D-24574, D-24598, D-24160, D-24556 (Excessive Violence).
- WP-757 §Contract (the argument-choice pattern) and WP-762 §Out of Scope (the accepted residual).
- User memory: `reference_bot_legalmoves_moveguard_divergence`, `reference_uistate_filter_whitelist_drops_fields`, `reference_hashed_g_field_dual_repin`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves never throw; they follow the validation contract.
- All randomness goes through `random.Shuffle`, with a `// why:` comment.
- Engine only; the chooser UI is WP-770.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24601) before coding. One WP per session.

**Packet-specific:**

- **Single authority.** New `mastermind/indestructibleMan.logic.ts`:
  - `isIndestructibleMan(G)`: the selected Mastermind id is `bkwd/indestructible-man`.
  - `listEligibleAssassins(G, playerId)`: that player's Victory-Pile cards with the Elite Assassins prefix.
  - `canShuffleFight(G, playerId)`: `isIndestructibleMan`, the flag is unused this turn, and there are ≥ 2 eligible.
  - `shuffleIntoVillainDeck(G, playerId, cardIds, shuffle: (<T>(items: T[]) => T[]) | null)`: remove the cards from that player's Victory Pile, append them to `G.villainDeck.deck`, then shuffle the whole deck **once** via `shuffle`.
    - A `null` shuffle appends without shuffling and logs that it did; it never throws.
    - The file lives in `mastermind/` and never imports boardgame.io.
    - The move passes `random.Shuffle`, the strike passes `resolveShuffleFunction(strikeContext)`, and the tactic arms pass `shuffleContext.random.Shuffle`.

  The move gate, the bot and the projection all read these helpers.
- **`fightMastermind` for Indestructible Man.**
  - Without `shuffleAssassinIds` it **returns silently** (you can't use attack), with or without `useExcessiveViolence`.
  - With it, it validates in order:
    1. Exactly 2 **distinct** ids, each an eligible Assassin in the **acting** player's Victory Pile.
    2. `canShuffleFight`.
    3. Stage `main`, then the existing block-all guards, then the existing tactics-remain / Final Blow gate.
  - **Skip** the spendable-attack check (`:~153`). Dark Portal can make his cost > 0, but attack is never used for him. **Keep** the `hasHealedThisTurn` check (`:~217`).
  - Only then does it mutate:
    1. Shuffle the two cards in.
    2. Set `G.indestructibleManShuffleUsedThisTurn = true`.
    3. Mirror the existing branch: `isFinalBlow` → `awardMastermindOnFinalBlow`, otherwise `defeatMastermindTacticCore(G, ctx, { random }, events)`. Spend **no attack**, and ignore Excessive Violence.
    4. Set `G.hasActedThisTurn = true`, and apply the Diamond Form edge exactly as the attack path does (`:~264`, `:~271`).
- **The flag is omit-when-absent.** It is written only when set and never seeded, so the hash oracles stay stable. A guarded `delete` (only when the flag is present) clears it in **both** places:
  - `game.ts` onBegin, beside `villainRevealedThisTurn`;
  - `simulation/onBeginParity.ts` `applyOnBeginParity`.

  Without the second, the sim bot shuffle-fights once and never again.
- **Master Strike branch.**
  - If the current player (`resolveCurrentPlayer(strikeContext)`) has ≥ 1 eligible Assassin, shuffle in the **lowest-VP** one (ties by `extId`), using `resolveShuffleFunction(strikeContext)`. The strike is not a player choice, which is recorded in D-24601.
  - Otherwise each player, in ascending seat order, gains a Wound via `gainWoundForPlayer`. An empty supply is a logged no-op.
  - The generic Bystander capture stays unchanged.
- **Tactic arms (4 ids).** All are `bkwd-mastermind-indestructible-man-<slug>`; verify the ids against `mastermind.setup.ts:279`.
  - **Secrets of Indestructibility:** auto-KO up to two Wounds from hand first, then discard, to `G.ko`. It is always beneficial, so there is no choice.
  - **International Arms Dealer:**
    - The defeating player gains a `[hc:tech]` Hero from the HQ via `freeRecruitFromHqByFilter(..., { kind: 'hero-class', values: ['tech'] })`. With ≥ 2 eligible it parks a choice. This is a **gain**, so it is independent of WP-757's recruit block.
    - Each other player, ascending, then reveals a tech Hero **from hand** or gains a Wound. This is automatic, following the `resolveCrushingShockwave` hand-reveal precedent (`tacticHandlers.ts:~336`).
    - **Locked order:** when the gain parks, the reveal-or-wound and the play-two clause resolve **before** the parked gain is answered. The `// why:` comment says the parked choice is answered after the synchronous clauses.
  - **Unveil Project Four:** each other player discards every hand card for which `String(G.cardStats[id]?.cost)`, `String(G.cardStats[id]?.attack)`, `String(G.cardStats[id]?.recruit)` or, when defined, `String(G.cardVictoryPoints?.[id])` contains `'4'`. A card with no `cardStats` entry is kept. The log says "(approximate)".
  - **All three above:** if this is **not** the last tactic (`G.mastermind.tacticsDeck.length > 0` at dispatch time), build `const revealContext: RevealContext = { random: shuffleContext.random, ctx: { currentPlayer } }` and call `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, 2)`, following the `fightVillain.ts:~489-494` precedent. Update the `tacticHandlers.ts` header comment (`:~21`), which says nothing there reveals or shuffles.
  - **Manipulate Murderous Mad Monk:** no arm. At its Fight, call `recordHollowEffect` with `{ cardId, cardType: 'villain', timing: 'onFight', mechanic: 'tactic-becomes-villain', reason: 'unsupported-keyword', turn: G.logMeta?.turn ?? 0 }`. Add a `// why:` explaining that `'villain'` is the closest existing `cardType`, so no contract widen is needed.
- **Projection.** `UIMastermindState.shuffleFight?: { requiredCount: number; isUsedThisTurn: boolean; eligibleAssassins: { extId: string; display: UICardDisplay }[] }`.
  - It is present **only** when `isIndestructibleMan`. `eligibleAssassins` is the **active** player's list, built from `G.cardDisplayData`.
  - The filter passes it through with a conditional spread and **deep-copies** `eligibleAssassins[].display`. It is public to every audience, since Victory Piles are public. It appears in the diagnostics `uiStateSnapshot` (step 5).
  - `fightCost` is still projected (as 0). The client uses `shuffleFight` to replace the Fight affordance.
- **Bot.**
  - `ai.legalMoves` emits **no** plain `fightMastermind` for Indestructible Man.
  - When `canShuffleFight`, it emits one intent with the two lowest-VP eligible Assassins (VP via `victoryPointValueForCard`, ties by `extId`). This mirrors the move gate exactly.
- **Determinism.**
  - The only randomness is the shuffle-in, through `random.Shuffle`.
  - Core oracles are unchanged, because the core sentinel and PAR seeds don't use bkwd.
  - Pre-WP-768 Indestructible Man replays and ranked scores won't re-execute or verify identically (D-24119). Record this in D-24601.

## Locked Values

- Mastermind id `bkwd/indestructible-man`; Assassin prefix `bkwd-villain-elite-assassins-`.
- Move argument: `fightMastermind({ shuffleAssassinIds?: [CardExtId, CardExtId] })`. The count is 2 (base face; the Epic face's 3 is out of scope).
- Flag: `G.indestructibleManShuffleUsedThisTurn?: true`.
- Projection: `UIMastermindState.shuffleFight?`, shaped as above.
- Default and bot pick: the two lowest-VP Assassins, ties by `extId`. The strike picks the single lowest.
- The Project Four approximation rule, verbatim.
- Hollow record: `tactic-becomes-villain` / `unsupported-keyword` (Mad Monk).

---

## Scope (In)

- **A)** `mastermind/indestructibleMan.logic.ts` (new) plus its test.
- **B)** `moves/fightMastermind.ts` (plus test): the Indestructible Man branch and argument validation.
- **C)** `types.ts`: the flag. `game.ts` and `simulation/onBeginParity.ts`: the guarded turn reset.
- **D)** `rules/mastermindHandlers.ts` (plus test): the strike branch.
- **E)** `rules/tacticHandlers.ts` (plus test): three arms, the shared "play two unless last" clause, and the Mad Monk hollow.
- **F)** UIState five-step: `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` and `ui/uiState.filter.test.ts`.
- **G)** `simulation/ai.legalMoves.ts` (plus test): the Indestructible Man intent. The four MOVE_MAPs (`simulation.runner.ts`, `par.aggregator.ts`, `test/fixtures/runFixture.ts`, `replay/replay.execute.ts`) now pass `args` to `fightMastermind`.
- **H)** Feeds: add `scripts/coverage/tactic-provenance.json` entries, then regenerate `effect-implementation-index.json`.
- **I)** Tests. At minimum:
  - an attack-only fight is refused, including at 0 attack;
  - a shuffle-fight with 2 valid ids succeeds once, and a second in the same turn is refused;
  - invalid ids are refused: another player's, a non-Assassin, a duplicate, or only 1;
  - the Assassins land in the Villain Deck;
  - the strike covers both branches;
  - each tactic arm, including the last-tactic case;
  - a seeded 1-player sim terminates with **no** turn-1 win.

## Out of Scope

- **The chooser UI** (WP-770).
- **Epic Indestructible Man** (the 3-Assassin face; not selectable, D-24193).
- **Mad Monk's tactic-becomes-a-villain.** It needs new substrate; a named follow-up.
- **Dark Memories** on Blue Talon and Iron Maiden.
- A faithful "any printed 4" check for Project Four.
- Any client or server change.

## Files Expected to Change

- `packages/game-engine/src/mastermind/indestructibleMan.logic.ts` (+ test) — **new**
- `packages/game-engine/src/moves/fightMastermind.ts` (+ `fightMastermind.test.ts`) — modified
- `packages/game-engine/src/types.ts` — modified (flag)
- `packages/game-engine/src/game.ts` — modified (turn reset)
- `packages/game-engine/src/simulation/onBeginParity.ts` — modified (turn reset parity)
- `packages/game-engine/src/simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`, `replay/replay.execute.ts` — modified (`fightMastermind` receives args)
- `packages/game-engine/src/rules/mastermindHandlers.ts` (+ test) — modified
- `packages/game-engine/src/rules/tacticHandlers.ts` (+ test) — modified
- `packages/game-engine/src/ui/uiState.types.ts`, `ui/uiState.build.ts` (+ `ui/uiState.build.test.ts`), `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified
- `packages/game-engine/src/simulation/ai.legalMoves.ts` (+ test) — modified
- `scripts/coverage/tactic-provenance.json`, `data/metadata/effect-implementation-index.json` — modified / regenerated
- Governance: `docs/ai/DECISIONS.md` (D-24601), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is about 23 files, and half are tests.

## Contract

- The Locked Values above.
- WP-770 consumes `shuffleFight` and the `shuffleAssassinIds` argument.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §23/§24 (ranked integrity: this closes a free leaderboard win), NG-1.
**Conflict assertion:** none.
**Non-Goal proximity:** not crossed.
**Determinism:** the shuffle-in goes through `random.Shuffle`, the flag is omit-when-absent, and core is unchanged. The replay and D-24119 note is recorded in D-24601.

## Funding Surface Gate

§20 **N/A**.

## API Catalog

§21 **N/A**.

---

## Acceptance Criteria

1. With Indestructible Man as the Mastermind, `fightMastermind` without `shuffleAssassinIds` changes nothing at any attack value. The bot never wins on turn 1.
2. A shuffle-fight with 2 valid, distinct, own Assassin ids:
   - moves both into the Villain Deck (deck length +2);
   - defeats a tactic;
   - rescues his Bystanders and fires the tactic's Fight;
   - spends no attack;
   - sets the flag.

   A second attempt in the same turn is refused. The flag clears at the next turn.
3. Invalid arguments (one id, duplicates, another player's Assassin, a non-Assassin, or < 2 eligible) change nothing.
4. The Master Strike shuffles in the current player's lowest-VP Assassin. With none, every player gains a Wound.
5. The tactics:
   - Secrets KOs up to 2 Wounds.
   - Arms Dealer gains a tech Hero, then applies reveal-or-Wound to the others.
   - Project Four discards the stat-4 cards, and its log says "approximate".
   - Each of these three plays 2 Villain-Deck cards unless it is the last tactic.
   - Mad Monk records its hollow.
6. `UIMastermindState.shuffleFight` is present only for Indestructible Man and carries the active player's eligible Assassins with their display. It survives the audience filter.
7. Bot legal intents match the move gate: no plain fight, and one shuffle-fight with the lowest-VP pair when available. A seeded 1-player sim terminates.
8. Checks pass:
   - `pnpm -r build` → 0;
   - the engine suite and `pnpm -r --no-bail test` → 0 fail;
   - `effect-index:check`, `sim:runtime-observed:check` and `sim:coverage --check` → 0;
   - core oracles unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass.
3. `pnpm -r --no-bail test` → 0 fail.
4. `pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → 0.
5. `git diff --name-only` ⊆ Files Expected to Change.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24601 is Active. STATUS is updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `roadmap:counts:check` 0.
- [ ] Two-commit topology.
- [ ] **D-24026 live-verify** (post-merge, with WP-770 deployed): in a live Indestructible Man match, Fight can't be used with attack, and shuffling 2 chosen Assassins defeats a tactic once per turn. Record it as a STATUS-flip.

## Reserved Decision (lands at execution)

**D-24601 — indestructible-man-mastermind.** It locks:
- attack can never fight him;
- the `shuffleAssassinIds` argument choice (operator decision);
- once per turn, via the omit-when-absent flag;
- the mid-game Villain-Deck shuffle-in (a first, next to D-24160);
- the strike's lowest-VP auto-pick;
- the Project Four approximation (operator decision);
- the Mad Monk hollow;
- the replay / D-24119 note.

---

## Lint Gate Self-Review (00.3)

- **§1:** all sections present.
- **§2:** boilerplate + protocol.
- **§3:** Assumes verified by a research subagent.
- **§4:** cited.
- **§5:** about 23 files.
- **§6:** canonical names.
- **§7:** dependencies ✅.
- **§8:** engine only.
- **§9:** pnpm.
- **§10–11:** N/A.
- **§12:** `node:test`.
- **§13:** exact commands.
- **§14:** 8 ACs.
- **§15:** covered.
- **§16:** 00.6.
- **§17:** satisfied.
- **§18–21:** N/A.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent, static): DO NOT EXECUTE YET.** All findings below are fixed in this revision.

Blocking (PS):
- **PS-1:** the four MOVE_MAPs dropped `fightMastermind` args, so the bot's shuffle-fight would silently no-op. They now pass args, and the four files are added.
- **PS-2:** the flag reset was missing from `onBeginParity`. It now resets in both places.
- **PS-3:** the shuffle source was unspecified. The helper now takes a nullable shuffle; the strike uses `resolveShuffleFunction`.
- **PS-4:** the play-two call is now specified: a built `RevealContext` + `DEFAULT_IMPLEMENTATION_MAP`, where last tactic means `tacticsDeck.length === 0`.
- **PS-5:** the hollow-record contract fits: `cardType: 'villain'`, `turn` from `logMeta`.

Risks (RS):
- **Project Four:** it now reads parsed numbers plus `cardVictoryPoints`.
- **Shuffle-fight:** mirrors Final Blow, skips the attack check, keeps the heal lock, sets `hasActedThisTurn` and the Diamond Form edge.
- **Arms Dealer:** the clause order is locked.
- **UIState:** the display is deep-copied, `build.test` is added, and the diagnostics check is included.
- **Assumes:** the `hasActedThisTurn` statement is corrected.
- **Context:** 00.2 is now cited.

**Scope verdict:** READY TO EXECUTE once the reservation (#2412) is on main.

**Copilot (01.7), round 1: BLOCK (SUSPEND).** Resolved by the PS fixes.

**Pre-flight / Copilot CONFIRM (independent subagent): CONFIRM.** Every PS and RS fix is present, and the WP and EC agree. Nit applied: `cardId` added to the EC Mad Monk record. Ready once #2412 and the drafting PR are on `main`.
