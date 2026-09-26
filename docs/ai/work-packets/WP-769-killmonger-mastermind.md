# WP-769 — Killmonger: Mastermind Wounds, the "Wound him" move, Master Strike and tactics (Game Engine)

**Status:** Draft 2026-09-26
**Primary Layer:** Game Engine (a Mastermind state field, a new move, fight rules, strike, tactics, UIState)
**Dependencies:**
- WP-497 (tactic `onFight`)
- WP-750 / D-24574 (the Mastermind `fightCost` projection)
- WP-684 / D-24501 (`PendingSeatChoice`)
- WP-476 / D-24284 (the Magneto discard-to-limit precedent)
- D-24591 (autoplay picks up non-`resolve…` moves)
- WP-648 (the new-move lockstep template)

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). This packet adds a contract field on `mastermind.types.ts`, a new move, and a new projection field.
**Arc:** WP-769 (engine, this packet) → WP-771 (client "Wound him" button). The sibling packet is WP-768 (Indestructible Man).

> Baseline: `origin/main` at `b7efb34a`, plus the reserve commit (#2412).

---

## Goal

`bkpt/killmonger` (`data/cards/bkpt.json:584-640`) prints:

> "While Killmonger has more than 0[icon:attack], you cannot fight him. Instead, you may spend [icon:attack] equal to his [icon:attack] to [keyword:Wound him] and get +1[icon:recruit]."
> "Master Strike: Each player must reveal 4 different Hero Classes or gain one of the [keyword:Wounds on Killmonger]. Any player who can't do either must discard down to 4 cards."

**The keyword** (`keywords-full.json:714`): a Wound on a Villain or Mastermind comes from the Wound Stack or the KO pile, and gives −1 attack per Wound.

**Rulebook v23 L2213-2246:**
- A Mastermind's Wounds return to the Wound Stack after a Mastermind Tactic is fought.
- Killmonger (5) is wounded at 5, then 4, 3, 2 and 1. At 0 he is fought for 0, you take a tactic, and his Wounds are removed; you get no +1 recruit for that fight.
- Wounding can be repeated any number of times per turn.
- Wounding is **not** a fight: it rescues no Bystanders, and Healing is still allowed that turn.

**Today:** he is fought at a flat 5 per tactic, about 20 attack in total, where the printed rule needs about 60. There is no Mastermind wound state anywhere, and his strike and tactics are inert.

**After this session:**

1. **Generic Mastermind Wounds.** `G.mastermind.wounds?: CardExtId[]` is added (omit-when-empty). The effective fight cost is `max(0, base + portal − wounds.length)` for **any** Mastermind, because the rule is general. The Wounds return to `G.piles.wounds` after **every** tactic defeat.
2. **The `woundMastermind` move** (Killmonger only):
   - you spend attack equal to his current effective cost;
   - he takes a Wound, from the Wound Stack first, then from the KO pile;
   - you get +1 recruit;
   - it is repeatable, is not a fight, and is not blocked by Healing.
3. **The fight gate.** `fightMastermind` refuses Killmonger while his effective cost is greater than 0.
4. **Master Strike** and three tactics (A Scar for Every Kill, Rite of Challenge, Throw from the Waterfall) resolve their text. Altar of Resurrection is a recorded hollow.
5. **Projection.** New fields `UIMastermindState.wounds?: number` and `woundable?: true` feed WP-771 and keep the client's Fight button honest.

## User-Visible Impact

Players must wound Killmonger down to 0, earning +1 Recruit each time, before they can take a tactic. At 0 he is fought for free. This is his signature mechanic, and it is roughly three times the work of today's flat 5-attack fight. His strikes pressure players to diversify their Hero Classes, and his tactics do what they print. The button ships in WP-771, and **WP-769 and WP-771 should deploy together**, because until WP-771 lands the live client can't wound him.

---

## Rule locks (from the rulebook and card text; no operator choice needed)

- **Wound source.** A Wound comes from the Wound Stack, or from the KO pile if the stack is empty. If neither has a Wound, `woundMastermind` is **not legal**.
- **Seat order (v23 L2247-2248):** "start with the current player then go clockwise". Seats resolve in `seatOrder = ctx?.playOrder ?? Object.keys(G.playerZones).sort()`, rotated to start at the current player (index 0 if `resolveCurrentPlayer` returns null; the precedent is `heroEffects.execute.ts:~3514` and `seatChoice.resolve.ts:~414`). `ctx.playOrder` is absent on the strike's `RevealContext` and on the sim, PAR, fixture and replay contexts, so the fallback is required. Rite starts with the seat **after** the current player. With a finite pool of Wounds on Killmonger, order decides who is hit.
- **Master Strike "reveal 4 different Hero Classes".** Only cards in **hand** count. A dual-class Hero counts **both** classes (the D-24523 precedent, `heroConditions.evaluate.ts:~168`).
  - A player who reveals 4 classes is unaffected.
  - Otherwise, if Killmonger has ≥ 1 Wound, the player gains one of his Wounds into their discard pile. Seats resolve in the locked seat order; once his Wounds run out, the remaining players fall through.
  - A player who can do neither discards down to 4.
    - The current player parks `{ choiceType: 'discard-to-limit', playerID, limit: 4 }` (the Magneto precedent, `mastermindHandlers.ts:~401`).
    - Every other player whose hand is over 4 auto-discards `selectDiscardToLimitCards(G, hand, hand.length − 4)`. The third argument is a **count**, not a limit (`:~290`).
- **Rite of Challenge ordering.** Rite's Fight text ("each player with no Killmonger Tactics in their Victory Pile gains a Wound that was on Killmonger") resolves **before** the generic Wound return. Whatever Wounds remain afterwards return to the Wound Stack.
- **The fight at 0** gives no +1 recruit.

---

## Assumes

1. **Contract file.** `G.mastermind` is `MastermindState` (`mastermind/mastermind.types.ts`), a contract file. It holds `strikePile`, `attachedBystanders` and `hypnoThralls`, and has **no** wound field.
2. **Fight cost.** `resolveMastermindFightCost` (`economy/economy.resolve.ts:~243`) returns base plus the Dark-Portal term. `fightMastermind` (`moves/fightMastermind.ts`) checks spendable attack, the block-all guards (`:~151-213`) and the Final Blow path. `defeatMastermindTacticCore` handles every tactic defeat, including Silent Sniper.
3. **Killmonger in data.** There is no Killmonger code. All four tactics are `unmarked` (`effect-implementation-index.json:3140-3173`), and the ids follow `bkpt-mastermind-killmonger-<slug>` (verify against `mastermind.setup.ts:279`).
4. **Wound supply.** `G.piles.wounds` and `G.ko` hold the Wound cards. `gainWoundForPlayer` lives at `board/wounds.logic.ts:70`.
4a. **Wound-gain chokepoint.** `gainWoundForPlayer` draws only from `G.piles.wounds`, and it is the Diving Block chokepoint. `checkDivingBlock(G, playerId, WOUND_EXT_ID)` lives in `moves/divingBlock.logic.ts`.
4b. **Excessive Violence re-read.** Fight's EV affordability re-reads `getSpendableAttack` **after** the core (`fightMastermind.ts:~246-249`). The comments at `:~230-232` and `:~288` still claim tactics fire no `onFight` ability, which is stale since WP-497.
4c. **Existing multi-seat discard.** `buildMonarchsDiscardChoice` / `applyMonarchsDiscard` (`seatChoiceTactics.ts:~198-263`) is the "each other seat with cards discards one" precedent. `applySeatChoiceByKind` (`seatChoice.resolve.ts:~357`) also serves the timeout path (`:~510`). The client heading falls back to "Your choice" (`PendingSeatChoicePrompt.vue:~104`).
4d. **UIState contract.** `uiState.types.ts` is a `.types.ts` contract file.
5. **New-move lockstep sites:**
   - `game.ts:~538` (the move map, `client: false`);
   - `game.test.ts:~213` (the move list; `:181` is only the `it()` title string, so update its text too);
   - `ai.legalMoves.ts:~92` (`SIMULATION_MOVE_NAMES`) plus intent emission;
   - `ai.competent.ts:~314` (unknown moves score 0);
   - `simulation.runner.ts:~324`;
   - `par.aggregator.ts:~482`;
   - the move-dispatch drift test;
   - `replay/replay.execute.ts:~141`;
   - `test/fixtures/runFixture.ts:~187`;
   - `index.ts:~274` (export).

   Server autoplay picks up the move automatically because its name does not start with `resolve…` (D-24591).
6. **Hero class and seat choice.** Hero classes are read from `G.cardTraits[id].heroClass` / `heroClass2`. The seat choice (WP-684) exposes `parkSeatChoice`, `applySeatChoiceByKind` and `defaultOptionIndex`, and the client renders it generically.
7. **UIState.** `UIMastermindState` has `fightCost?` (WP-750). The filter passes optional fields through with a conditional spread.
8. **Parallel packets.**
   - WP-768 (Indestructible Man) also branches `fightMastermind` and adds projection fields.
   - WP-757 (Haunt) adds a `fightMastermind` guard.

   All of these are independent, additive branches. Whichever packet lands second rebases and keeps both.
9. `pnpm -r build` exits 0. The engine suite is green.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `data/cards/bkpt.json` Killmonger + tactics (`:584-640`); `keywords-full.json:714`; `docs/legendary-universal-rules-v23.md` L2213-2246.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) and §Move Validation Contract.
- `.claude/rules/architecture.md` §UIState Projection Integrity; `.claude/rules/code-style.md` (contract files need a DECISIONS entry).
- `docs/ai/DECISIONS.md`: D-24574, D-24501, D-24284, D-24591.
- User memory:
  - `feedback_move_registration_drift_test`
  - `reference_new_resolve_move_sim_dispatch_lockstep`
  - `reference_bot_legalmoves_moveguard_divergence`
  - `reference_hashed_g_field_dual_repin`
  - `reference_uistate_filter_whitelist_drops_fields`

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves never throw. Follow the validation contract.
- No randomness is added.
- Engine only.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24602) before coding. One WP per session.

**Packet-specific:**

- **`G.mastermind.wounds?: CardExtId[]`.**
  - Add it to `MastermindState` as an append-only contract widen (D-24602).
  - It is omit-when-empty. It is removed, not left as `[]`, when it empties. The hash oracles stay byte-stable.
  - It holds actual Wound card ids, which are moved from the stack or KO pile, never invented.
- **Effective cost.** `resolveMastermindFightCost` = `max(0, base + portal − (wounds?.length ?? 0))`. This is generic, and no current match wounds any other Mastermind, so nothing else changes. The WP-750 projection carries it automatically.
- **Wound return.** At the end of `defeatMastermindTacticCore`, after the tactic's `onFight` (so Rite of Challenge sees them), every remaining Wound on the Mastermind moves to `G.piles.wounds` and the field is removed. This covers every tactic defeat path. Final Blow (`awardMastermindOnFinalBlow`) ends the game, so any Wounds left on him then are harmless and are not returned.
- **Killmonger fight gate.** `fightMastermind` returns silently for Killmonger while the effective cost is `> 0`. Pre-flight must confirm whether the existing spendable-attack check alone already covers this. When the cost is 0, the normal fight proceeds and grants **no** +1 recruit.
- **`woundMastermind()`**, a new move with no args, registered `client: false`. Validation order:
  0. Tactics remain, or Final Blow is available: `tacticsDeck.length > 0 || isFinalBlowAvailable(G.mastermind, G.finalBlow)`. Without this, the bot would keep wounding after victory.
  1. The selected Mastermind is Killmonger (it is a "woundable" Mastermind).
  2. The effective cost is `> 0`.
  3. The Wound Stack or the KO pile holds a Wound.
  4. Spendable attack is at least the effective cost.
  5. Stage is `main`.
  6. The full `fightMastermind` block-all guard list.

  It deliberately does **not** check the healing lock and does not set `hasActedThisTurn` (rulebook: "not a fight"; Healing is still allowed).

  Mutation:
  1. Spend the effective cost through the same spend path `fightMastermind` uses.
  2. Move one Wound (stack first, else the KO pile) to `G.mastermind.wounds`.
  3. Grant +1 recruit.
  4. Log it.

  It rescues no Bystanders and fires no Fight text.
- **Strike branch.** Per §Rule locks. For each seat in the locked seat order (see §Rule locks):
  - 4 distinct classes in hand → unaffected.
  - Otherwise, if Killmonger has a Wound → move that Wound from `G.mastermind.wounds` to the player's discard, then call `checkDivingBlock(G, playerId, WOUND_EXT_ID)` so Diving Block still reacts.
  - Otherwise → discard down to 4 (see §Rule locks).

  The generic Bystander capture is unchanged.
- **Tactic arms** (verify ids against `mastermind.setup.ts:279`):
  - **A Scar for Every Kill:** the defeating player gets +1 recruit for each non-Henchman Villain in their Victory Pile (`villainDeckCardTypes === 'villain'`).
  - **Rite of Challenge:** in the locked seat order but starting with the seat after the defeater, each player with no Killmonger tactic in their Victory Pile gains one of the Wounds on Killmonger while any remain. The Wound moves from `G.mastermind.wounds` to the player's discard, then `checkDivingBlock` runs. This happens **before** the Wound return.
  - **Throw from the Waterfall:**
    - The defeating player draws 2 (`drawCardsIntoHand` with the shuffle context).
    - Each other player then discards a card via a `PendingSeatChoice` of the new kind `killmonger-waterfall-discard`. It mirrors `buildMonarchsDiscardChoice` / `applyMonarchsDiscard`: it addresses other seats with ≥ 1 card in hand, the options are that seat's hand cards, and `defaultOptionIndex` is 0.
    - The new kind gets its own branch in `applySeatChoiceByKind`, which also covers the timeout path.
    - WP-771 gives it a client heading.
  - **Scar and Excessive Violence:** Scar's `onFight` grants recruit before the EV affordability check. `fightMastermind` therefore captures `preDefeatSpendable` **before** the core, and the EV check uses that value (`:~246-249`). Also correct the stale comments at `:~230-232` and `:~288`.
  - **Altar of Resurrection:** no arm. At its Fight, `recordHollowEffect` records `{ cardId, cardType: 'villain', timing: 'onFight', mechanic: 'villain-wound', reason: 'unsupported-keyword', turn: G.logMeta?.turn ?? 0 }`. Add a `// why:` noting there is no Mastermind or tactic `cardType`, and widening one is out of scope.
- **Projection.**
  - `UIMastermindState.wounds?: number` is present iff wounds are present.
  - `UIMastermindState.woundable?: true` is present iff the Mastermind is Killmonger. Its semantics: *"Fight is refused while `fightCost > 0`; use `woundMastermind`"*.
  - Both are passed through the filter explicitly, both are public, and both appear in the Play Diagnostics `uiStateSnapshot` (step 5).
- **Bot.**
  - `ai.legalMoves` emits `woundMastermind` exactly when the move gate passes, **including step 0** (tactics remain), and emits no `fightMastermind` for Killmonger while the cost is `> 0`.
  - `ai.competent` scores `woundMastermind` at `SCORE_WOUND_MASTERMIND_BASE = 110`. That is above fight-villain (100), because each Wound progresses toward a tactic and grants recruit. It stays below `fightMastermind` (1500).
  - The sim and PAR must terminate.
- **Determinism.** No randomness beyond the Waterfall draw's reshuffle through the provided context. The new field is omit-when-empty, and core oracles are unchanged. Pre-WP-769 Killmonger replays won't re-execute identically (D-24119). This is noted in D-24602.

## Locked Values

- Mastermind id: `bkpt/killmonger`.
- Contract field: `MastermindState.wounds?: CardExtId[]`.
- Move: `woundMastermind()`.
- Bot score: `SCORE_WOUND_MASTERMIND_BASE = 110`.
- Seat-choice kind: `killmonger-waterfall-discard`.
- Projection: `UIMastermindState.wounds?: number`, `UIMastermindState.woundable?: true`.
- Hollow: `villain-wound` / `unsupported-keyword` (Altar).
- The §Rule locks, verbatim.

---

## Scope (In)

- **A) Contract.** `mastermind/mastermind.types.ts`: the `wounds?` field.
- **B) Logic.** `mastermind/killmonger.logic.ts` (new) + test:
  - `isWoundableMastermind`, `effectiveMastermindWoundCount`;
  - `takeWoundForMastermind` (stack, then KO pile);
  - `returnMastermindWounds`;
  - the class-reveal check.
- **C) Fight cost.** `economy/economy.resolve.ts` (+ test): the effective-cost term.
- **D) Moves.**
  - `moves/fightMastermind.ts` (+ test): the Killmonger gate, and the Wound return in `defeatMastermindTacticCore`.
  - `moves/woundMastermind.ts` + test (new).
- **E) Strike and tactics.**
  - `rules/mastermindHandlers.ts` (+ test): the strike branch.
  - `rules/tacticHandlers.ts` (+ test): 3 arms and the Altar hollow.
  - `moves/seatChoiceTactics.ts` and `moves/seatChoice.resolve.ts` (+ tests): the Waterfall kind.
- **F) Move lockstep.** `game.ts`, `game.test.ts`, `index.ts`, `ai.legalMoves.ts` (+ test), `ai.competent.ts` (+ test), `simulation.runner.ts`, `par.aggregator.ts`, the move-dispatch drift test, `replay/replay.execute.ts`, `test/fixtures/runFixture.ts`.
- **G) UIState five-step.** Types, build, filter, filter test.
- **H) Feeds.** Update `scripts/coverage/tactic-provenance.json`, then regenerate `effect-implementation-index.json` via `pnpm effect-index`.
- **I) Tests.** Cover at least:
  - Killmonger cannot be fought at cost > 0;
  - wound 5 → 4 → … → 0, each wound giving +1 recruit, from the stack and from the KO pile;
  - illegal with no Wound available;
  - allowed after Healing;
  - fight at 0 → tactic defeated, no +1, Wounds returned;
  - Rite gives Wounds out before the return;
  - the strike's three branches, including dual-class counting, current-player-first seat order, and Diving Block reacting to a gained Killmonger Wound;
  - wounding is illegal once no tactics remain;
  - Scar's recruit does not enable Excessive Violence;
  - Scar count;
  - the Waterfall draw plus seat choice;
  - a seeded 1p sim terminates;
  - core unchanged.

## Out of Scope

- **Client button and badge** → WP-771.
- **Altar of Resurrection, and the Killmonger's League villain-wounds** (Preyy, Malice, Baron Macabre, Venomm): these need a per-City-villain wound map, a −attack term in `resolveFightCost`, and a `woundVillain` move. Named follow-up WP.
- **The bkpt heroes that "Wound the Mastermind"** (`bkpt.json:180, 482, 531`): they can reuse `takeWoundForMastermind`. Named follow-up.
- **Epic Killmonger.**
- **Server changes.**

## Files Expected to Change

- `packages/game-engine/src/mastermind/mastermind.types.ts` — modified (contract; D-24602)
- `packages/game-engine/src/mastermind/killmonger.logic.ts` (+ test) — **new**
- `packages/game-engine/src/moves/woundMastermind.ts` (+ test) — **new**
- `packages/game-engine/src/economy/economy.resolve.ts` (+ test) — modified
- `packages/game-engine/src/moves/fightMastermind.ts` (+ test) — modified
- `packages/game-engine/src/rules/mastermindHandlers.ts` (+ test), `rules/tacticHandlers.ts` (+ test) — modified
- `packages/game-engine/src/moves/seatChoiceTactics.ts`, `moves/seatChoice.resolve.ts` (+ tests) — modified
- `packages/game-engine/src/game.ts`, `game.test.ts`, `index.ts` — modified
- `packages/game-engine/src/simulation/ai.legalMoves.ts` (+ test), `simulation/ai.competent.ts` (+ test), `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `simulation/simulation.moveDispatch.drift.test.ts`, `replay/replay.execute.ts`, `test/fixtures/runFixture.ts` — modified
- `packages/game-engine/src/ui/uiState.types.ts` (contract, D-24602), `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified
- `scripts/coverage/tactic-provenance.json`, `data/metadata/effect-implementation-index.json` — modified / regenerated
- Governance: `docs/ai/DECISIONS.md` (D-24602), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

About 30 files, well over the ~8 guideline. A new move carries its full lockstep set (~10 files), and half of all files are tests.

## Contract

- The Locked Values above.
- WP-771 consumes `wounds`, `woundable` and `woundMastermind`.
- `takeWoundForMastermind` and `returnMastermindWounds` are reusable by the named follow-ups.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §23 / §24 (ranked integrity: roughly three times the current effort), NG-1.
**Conflict assertion:** none.
**Non-Goal proximity:** not crossed.
**Determinism:** the new field is omit-when-empty and core is unchanged. The replay and D-24119 note is in D-24602.

## Funding Surface Gate

§20 **N/A**.

## API Catalog

§21 **N/A**.

---

## Acceptance Criteria

1. With Killmonger at a cost of 5 or less but above 0, `fightMastermind` changes nothing.
2. `woundMastermind` behaviour:
   - It spends exactly his effective cost, moves a Wound (stack, then KO pile) onto him, and grants +1 recruit.
   - Repeated calls take the cost 5 → 4 → 3 → 2 → 1 → 0.
   - It is illegal once no tactics remain and Final Blow is unavailable.
   - It is illegal at cost 0, with no Wound available, or with insufficient attack.
   - It is legal after Healing, and it does not set `hasActedThisTurn`.
3. Fighting at cost 0 defeats a tactic, grants no +1 recruit, and returns every remaining Wound to the stack after the tactic's Fight text.
4. The strike's three branches behave as §Rule locks: the dual-class hand counts both classes, Wounds go out in seat order until they run out, and players who can do neither discard to 4.
5. Scar, Rite (before the return) and Waterfall resolve as locked. Altar records its hollow.
6. `UIMastermindState.wounds` / `woundable` are present exactly per rule, and survive the audience filter. `fightCost` reflects the Wounds.
7. Every move lockstep pin is green (move lists +1, `SIMULATION_MOVE_NAMES` / MOVE_MAPs +1). Bot intents match the gate, and a seeded 1p sim terminates.
8. Checks: `pnpm -r build` → 0, and `pnpm -r --no-bail test` → 0 fail. `effect-index:check`, `sim:runtime-observed:check` and `sim:coverage --check` → 0. Core oracles are unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass.
3. `pnpm -r --no-bail test` → 0 fail.
4. `pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → 0.
5. `git diff --name-only` ⊆ Files Expected to Change.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24602 is Active. STATUS is updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `roadmap:counts:check` 0.
- [ ] Two-commit topology.
- [ ] **D-24026 live-verify** (post-merge, with WP-771 deployed): in a live Killmonger match, Fight is refused above 0; wounding him five times, gaining +1 recruit each, brings him to 0; and fighting takes a tactic. Recorded as a STATUS-flip.

## Reserved Decision (lands at execution)

**D-24602 — killmonger-mastermind.** It locks:
- the generic `MastermindState.wounds` contract field and effective-cost rule;
- the Wound return after every tactic, running after `onFight`;
- the `woundMastermind` move semantics (not a fight, not heal-locked, stack before KO pile, illegal without a Wound);
- the Killmonger fight gate;
- the strike and tactic rule locks, including the v23 L2247-2248 seat order (with the `playOrder` fallback) and Diving Block reacting to Killmonger's Wounds;
- the `UIMastermindState.wounds` / `woundable` contract widen;
- the EV `preDefeatSpendable` fix;
- the discontinuity in bkpt ranked gauntlet results and PAR before vs after this WP;
- the Altar / League deferral;
- the bot score;
- the replay / D-24119 note.

---

## Lint Gate Self-Review (00.3)

- **§1:** all sections present.
- **§2:** boilerplate + protocol.
- **§3:** Assumes verified by a research subagent.
- **§4:** cited, including the rulebook lines.
- **§5:** about 30 files, justified.
- **§6:** canonical names.
- **§7:** dependencies ✅.
- **§8:** engine only.
- **§9:** pnpm.
- **§10–11:** N/A.
- **§12:** `node:test`.
- **§13:** exact commands.
- **§14:** 8 ACs.
- **§15:** covered.
- **§16:** 00.6; contract field has a DECISIONS entry.
- **§17:** satisfied.
- **§18–21:** N/A.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent, static): DO NOT EXECUTE YET.** Every rulebook lock was verified (v23 L2218-2246 quoted), and all lockstep anchors were confirmed. Findings, all fixed in this revision:
- **PS-1:** seat order. Now current player first, then clockwise, per L2247-2248.
- **PS-2:** wounding after victory. Step 0 added.
- **PS-3:** gaining Killmonger's Wounds bypassed Diving Block. `checkDivingBlock` added.
- **PS-4:** `cardType` for the hollow record. Now `'villain'`, with a comment.
- **PS-5:** `selectDiscardToLimitCards` takes a count. The Magneto park shape is now used.
- **RS-1:** the Waterfall mirrors the Monarch's discard; the kind branch and the WP-771 heading are added.
- **RS-2:** Excessive Violence no longer re-reads spendable after Scar's recruit.
- **RS-3:** D-24602 scope widened.
- **RS-4:** step 5 and the regen command added.

**Scope verdict:** READY TO EXECUTE once the reservation (#2412) is on main.

**Copilot (01.7), round 1: RISK.** Items #2, #4, #10 and #1 are all resolved above.

**Pre-flight / Copilot CONFIRM (independent subagent)**: HOLD on the seat-order source (`ctx.playOrder` is unavailable on `RevealContext` and on the sim contexts). Fixed with the sorted-`playerZones` fallback. Non-blocking notes applied: `cardId` added to the hollow record, and the Final Blow path's Wounds noted. **Verdict after fix: CONFIRM**, ready once #2412 and the drafting PR are on `main`.
