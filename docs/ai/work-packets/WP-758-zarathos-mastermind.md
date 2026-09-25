# WP-758 — Zarathos Mastermind: Master Strike + four tactic Fight effects on the Haunt substrate (Game Engine)

**Status:** Draft 2026-09-25 — **BLOCKED on WP-757** (consumes its Haunt contract) **and WP-749** (the sim/PAR loops must resolve non-active seat choices)

**Primary Layer:** Game Engine / Implementation

**Dependencies:**
- **WP-757 / D-24587** — the Haunt substrate.
- **WP-749 / D-24573** — the sim/PAR non-active seat-choice branch.
- WP-497 — `dispatchTacticOnFight`.
- WP-684 / D-24501 — `PendingSeatChoice`.
- WP-694 / D-24511 — the multi-seat tactic kinds and the post-resolve chain precedent.
- WP-732 / D-24553 — victory latch promoted at `turn.onEnd`.

**User-Visible Surface:** `play.legendary-arena.com`

**Lane:** Standard (two-session). It adds new seat-choice kinds (multi-seat sync surface), so it is not lightweight-eligible.

**Arc:** 2 of 3 in the Zarathos arc. It follows WP-757 and is parallel-safe with WP-759 (disjoint files). The Fallen fight-side is WP-760.

> Baseline: `origin/main` at `d09d0946` (reserve #2356). At execution, re-baseline on the commit that landed WP-757 and WP-749.

---

## Goal

After this session, `mdns/zarathos` plays as printed (`data/cards/mdns.json`, base face):

- **Master Strike.** If any non-null HQ slot is haunted (by either haunter kind), each player gains a Wound. Then, if Zarathos is not already haunting, he haunts the highest-cost unhaunted Hero.
- **Tactics.** `dispatchTacticOnFight` gains four arms. Each one first has Zarathos haunt the highest-cost unhaunted Hero of that tactic's class pair, then resolves the tactic's second clause:
  - **Eruption of Hellfire:** each other player discards a covert/ranged Hero or gains a Wound.
  - **Corrupted Spirit of Vengeance:** each other player discards an instinct/covert Hero or discards down to 3.
  - **Imprison in the Soul Crystal:** if you have a strength/instinct Hero, you may KO a Victory-Pile Villain and draw cards equal to its VP.
  - **Demonic Essence of Ghost Rider:** "you may KO one of your Heroes", owed once for a ranged Hero and once for a strength Hero.

The interactive choices use five new `PendingSeatChoice` kinds, which the client's generic prompt already renders.

The gameplay loop this creates: Zarathos repeatedly possesses the priciest Hero in the HQ. While he haunts, he cannot be fought (WP-757 block), so the table must spend Recruit to exorcise before attacking him again.

## User-Visible Impact

- Zarathos's strikes wound every player while any Hero is haunted.
- He possesses the most expensive HQ Hero and cannot be fought until it is exorcised.
- Each tactic defeat re-possesses a Hero and hands opponents a real choice.
- Today, by contrast, his strike does generic bookkeeping only and all four tactics are silent no-ops.

---

## Assumes

1. **WP-757 is merged.** `board/haunt.logic.ts` exports:
   - `hauntHqSlot(G, hqIndex, haunter): boolean`
   - `isMastermindHaunting(G)`
   - `isHqSlotHaunted(G, hqIndex)`

   `fightMastermind` refuses while the Mastermind haunts, and D-24587 is Active.
2. **WP-749 is merged.** `simulation/simulation.runner.ts` and `simulation/par.aggregator.ts` resolve an open `G.pendingSeatChoice` for each outstanding addressed seat at `defaultOptionIndex`, including non-active seats.
3. `mastermindStrikeHandler` (`rules/mastermindHandlers.ts:1204-1245`):
   - It is an if/else chain on `selection.mastermindId`.
   - `captureBystanderOntoMastermind` is called at :1210 for every Mastermind.
   - `resolveCurrentPlayer` (:255), `gainWoundToDiscard` (:684) and `selectDiscardToLimitCards(G, cards, discardCount)` (:290) exist. The last one is exported and pure, works for any seat, and its **third argument is a count to discard**, not a limit.
4. Tactic ids are built as `${setAbbr}-mastermind-${slug}-${card.slug}` (`mastermind/mastermind.setup.ts:279`). The four Contract ids match `mdns.json`. `dispatchTacticOnFight(G, ctx, id, shuffleContext, events?)` (`tacticHandlers.ts:1300`) receives `events` from `fightMastermind.ts:451`.
5. `PendingSeatChoice` behavior:
   - Builders set `defaultOptionIndex`; one index is shared by every addressed seat.
   - `applySeatChoiceTimeoutDefault` (`seatChoice.resolve.ts:475-512`) is kind-agnostic. It clamps that index and dispatches `applySeatChoiceByKind`, and does **not** chain.
   - Post-resolve chains run from `resolveSeatChoice` (`chainMonarchsDiscard` / `chainRandomActsPassLeft`, :325-336).
   - The apply receives `{ random }`.
   - The active single-seat tactic-park precedent is `resolveMonarchsDecree` / `buildMonarchsDecreeModeChoice`.
6. The client `PendingSeatChoicePrompt.vue` (:65, :147) renders `options[].label` for any kind, with the heading fallback "Your choice" (:109). The UIState seat-choice build (`uiState.build.ts:1672`) and filter (`uiState.filter.ts:1199`) are kind-agnostic, and no drift test enumerates kinds.
7. Hero class data:
   - Hero class comes from `G.cardTraits[id].heroClass` / `heroClass2`.
   - `cardHasClassWhenPlayed` covers in-play cards.
   - No "has a Hero of class X (hand + in play)" boolean helper exists. `heroClassMatch` is in-play-only.
8. Card data and draws:
   - `G.cardVictoryPoints?` (`types.ts:2405`) is optional. An absent entry means the scoring fallback (`VP_VILLAIN` / `VP_HENCHMAN`, `scoring.logic.ts:136-138`), not 0.
   - `SeatChoiceOption.cardId?` exists (`types.ts:1293-1297`). Its why-comment says "absent for every other kind"; this packet reuses it for the Discard/KO options and updates that comment.
   - `drawCardsIntoHand(playerZones, count, shuffleContext)` is at `moves/drawCards.logic.ts:53`.
   - `isVictoryPileVillain` (`seatChoiceTactics.ts:76`) excludes Henchmen.
9. Endgame: the pending choices are dropped at `turn.onEnd` (`endgame/mastermindVictory.logic.ts:117`, WP-732), so a choice parked by the final tactic still resolves.
10. Tactic implementation status is recorded in `scripts/coverage/tactic-provenance.json`, which feeds `data/metadata/effect-implementation-index.json`.
11. `pnpm -r build` exits 0 and the engine suite is green.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, and `.claude/rules/architecture.md` (moves never throw; `// why:` rules).
- `docs/ai/DECISIONS.md`:
  - D-24587 (Haunt, landed by WP-757)
  - D-24501 (seat choice)
  - D-24511 (Monarch's Decree / Vanishing Illusions)
  - D-24553 (victory latch)
  - D-24499 ("Hero you have" = hand + in play)
- Rules v23:
  - `docs/legendary-universal-rules-v23.md` ~L1507-1543 (Haunt).
  - ~L3439-3446: "Your Heroes" = hand plus cards played this turn. The deck and discard pile do **not** count.
- The files in Assumes 3-10.
- User memory:
  - `reference_interactive_choice_active_player_only`
  - `reference_sim_nontermination_resolveherochoice_gap`
  - `project_mastermind_tactic_fight_arc`
  - `reference_heroes_you_have_hand_plus_play`

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Write human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. Randomness only via the provided shuffle context.
- Layer: engine only. There is no `apps/*` change. The server-autoplay non-active seat gap is a separate follow-up (see Out of Scope).

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24588) before coding. One WP per session.

**Packet-specific:**
- Do **not** modify WP-757's contract. The selector and the class helper are new and private to `mastermind/zarathos.logic.ts`.
- **Master Strike order is load-bearing:**
  1. Run the wound check first: is any non-null slot haunted, by either kind?
  2. If so, give one Wound per player in ascending seat order via `gainWoundForPlayer` (`board/wounds.logic.ts:70`). This is the chokepoint that `mastermindHandlers`' private `gainWoundToDiscard` wraps (Diving Block precedent, D-24499). `zarathos.logic.ts` never imports `mastermindHandlers`, which avoids a cycle. An empty supply is a logged no-op.
  3. Then haunt, skipped when `isMastermindHaunting(G)`.

  The existing `captureBystanderOntoMastermind` call is left unchanged.
- **Tactic haunt runs first.** `zarathosHauntHighestCost` returns a logged no-op when `isMastermindHaunting(G)` is true, for both the strike and tactic callers. There is never a second `{ kind: 'mastermind' }` haunter. With WP-757's fight and free-defeat blocks, he is not haunting on a tactic fight anyway; this guard makes that robust.
  - If the defeated tactic was the last one, victory is latched and promoted at `turn.onEnd` (WP-732 / D-24553). Both clauses still resolve.
  - The resulting haunt blocks the Final Blow `fightMastermind` until the table exorcises. This is faithful to the card.
- **"Have a Hero of class X"** is `playerHasHeroOfClasses(G, seat, classes)`. It reads `G.cardTraits[id].heroClass` / `heroClass2` over the hand, and uses `cardHasClassWhenPlayed` over in-play cards.
- Multi-seat kinds default to option 0. Active-seat "may" kinds default to the last option ("Don't KO"). The timeout path does not chain.

## Locked Values

- Ids:
  - Mastermind `mdns/zarathos`.
  - Tactics `mdns-mastermind-zarathos-{eruption-of-hellfire | corrupted-spirit-of-vengeance | imprison-in-the-soul-crystal | demonic-essence-of-ghost-rider}`.
- Class pairs:
  - Eruption: covert | ranged
  - Corrupted Spirit: instinct | covert
  - Imprison: strength | instinct
  - Demonic Essence: ranged | strength
- **Highest-cost selector:**
  - Candidates are unhaunted, non-null slots.
  - Cost is `cardStats[heroId].cost`.
  - "A and/or B" means the Hero has class A **or** class B; dual-class counts once.
  - Ties go to the lowest HQ index.
  - No candidate → a logged no-op, and Zarathos stays in the Mastermind space.
- **Kinds:** `zarathos-eruption`, `zarathos-corrupted-spirit`, `zarathos-imprison`, `zarathos-demonic-essence-first`, `zarathos-demonic-essence-last`.
- **Eruption** (each other seat, ascending):
  - A seat with ≥1 covert-or-ranged Hero in hand is addressed. Its options are "Discard <name>" per matching hand card (ascending cost, then hand order), then "Gain a Wound".
  - A seat with no such Hero auto-gains a Wound.
  - Park only if at least one seat is addressed. `defaultOptionIndex` 0.
- **Corrupted Spirit** (each other seat, ascending):
  - Hand ≤ 3: auto-resolved to "down to 3", which is free. Logged, not addressed.
  - Hand > 3 with ≥1 instinct-or-covert Hero: addressed. Its options are "Discard <name>" per match (ascending cost, then hand order), then "Discard down to 3 cards".
  - Hand > 3 with none: auto-discard the ids returned by `selectDiscardToLimitCards(G, hand, hand.length - 3)`.
  - The "down to 3" option resolves the same way.
  - `defaultOptionIndex` 0.
- **Imprison** (active seat):
  - Addressed only if `playerHasHeroOfClasses(strength, instinct)` **and** the Victory Pile holds at least one Villain.
  - "Villain" means a Victory-Pile card with `G.villainDeckCardTypes[id] ∈ {'villain','henchman'}`. Henchmen are Villains.
  - Options: "KO <name> — draw <VP>" per Villain, in Victory-Pile order, then "Don't KO".
  - VP mirrors `scoring.logic.ts:136-138`, written as an explicit `if` block: `G.cardVictoryPoints?.[id]` when present; otherwise `VP_HENCHMAN` for a henchman and `VP_VILLAIN` for a villain. Dynamic VP (Supreme HYDRA / Ultron) is a named gap in D-24588.
  - The apply must be draw-safe with an `undefined` shuffle context. The timeout path passes none, and its default is "Don't KO".
  - On KO: move the card to `G.ko`, then `drawCardsIntoHand(zones, VP, shuffleContext)`. VP 0 means no draw.
  - `defaultOptionIndex` = last.
- **Demonic Essence** (active seat):
  - Owed = (has ranged ? 1 : 0) + (has strength ? 1 : 0), evaluated once at fight time.
  - Options: "KO <name>" per **Hero** in **hand and in play** (not the discard pile, per rules v23 ~L3439; Wounds and Bystanders are not Heroes), then "Don't KO".
  - Owed 2 → park `-first`. Its `resolveSeatChoice` post-resolve chain builds a fresh `-last` from the current zones, even after a decline. A timed-out `-first` does not chain; it counts as a decline.
  - Owed 1 → park `-last` directly. Owed 0 → nothing.
  - `defaultOptionIndex` = last.

---

## Scope (In)

- **A) `mastermind/zarathos.logic.ts` (new)**
  - `selectHighestCostUnhauntedHqIndex(G, classes?)`
  - `zarathosHauntHighestCost(G, classes?)` — calls WP-757's `hauntHqSlot` with `{ kind: 'mastermind' }`
  - `playerHasHeroOfClasses(G, seat, classes)`
  - `resolveZarathosStrike(G)`
- **B) `rules/mastermindHandlers.ts`:** `MASTERMIND_ZARATHOS` constant and branch.
- **C) `rules/tacticHandlers.ts`:** four tactic-id constants, four arms and four resolvers. Each resolver builds its choice and parks it via `parkSeatChoice(G, events, choice)`, following the Monarch's Decree pattern.
- **D) `moves/seatChoiceTactics.ts`:** five kind constants, the builders (each setting `defaultOptionIndex`), and the applies.
- **E) `moves/seatChoice.resolve.ts`:**
  - five `applySeatChoiceByKind` arms;
  - the `-first` → `-last` post-resolve chain.
  - No edit to `applySeatChoiceTimeoutDefault`.
- **F) `scripts/coverage/tactic-provenance.json`:** four entries, then regenerate `data/metadata/effect-implementation-index.json`.
- **G) Tests:**
  - `mastermind/zarathos.logic.test.ts` (new).
  - Cases in `rules/mastermindHandlers.test.ts`, `rules/tacticHandlers.test.ts`, `moves/seatChoiceTactics.test.ts` and `moves/seatChoice.resolve.test.ts`.
  - An end-to-end case in `moves/fightMastermind.test.ts`: strike → haunt → fight refused → exorcise → fight → tactic → re-haunt.
  - A ≥2-player sim case in `simulation/simulation.runner.test.ts`.

## Out of Scope

- Epic Zarathos. No Epic-face selection exists (D-24193); this is a named follow-up.
- The Fallen fight-side (Blood Frenzy, Atrocity, Patriarch, Salomé), which is WP-760.
- Server autoplay resolving non-active seat choices (`apps/server/src/autoplay/autoplay.mjs` `drainPendingChoices` dispatches only as `currentPlayer`). This is a pre-existing gap that also affects Vanishing Illusions and Monarch's Decree, and is a separate follow-up. Consequence: until it lands, an **all-bot** Zarathos autoplay match can stall on Eruption / Corrupted Spirit. Human and solo play are unaffected.
- The generic `captureBystanderOntoMastermind` strike bookkeeping (pre-existing, all Masterminds).
- Letting players choose which cards "discard down to 3" drops.
- Any client change (the generic prompt suffices; WP-759 owns the haunt UI).

## Files Expected to Change

- `packages/game-engine/src/mastermind/zarathos.logic.ts` — **new**
- `packages/game-engine/src/mastermind/zarathos.logic.test.ts` — **new**
- `packages/game-engine/src/types.ts` — modified — comment-only update to `SeatChoiceOption.cardId`'s why-comment (the Zarathos kinds reuse it)
- `packages/game-engine/src/rules/mastermindHandlers.ts` — modified — Zarathos branch
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — modified
- `packages/game-engine/src/rules/tacticHandlers.ts` — modified — four arms and resolvers
- `packages/game-engine/src/rules/tacticHandlers.test.ts` — modified
- `packages/game-engine/src/moves/seatChoiceTactics.ts` — modified — kinds, builders, applies
- `packages/game-engine/src/moves/seatChoiceTactics.test.ts` — modified
- `packages/game-engine/src/moves/seatChoice.resolve.ts` — modified — arms and chain
- `packages/game-engine/src/moves/seatChoice.resolve.test.ts` — modified
- `packages/game-engine/src/moves/fightMastermind.test.ts` — modified — end-to-end case
- `packages/game-engine/src/simulation/simulation.runner.test.ts` — modified — ≥2-player Zarathos sim case
- `scripts/coverage/tactic-provenance.json` — modified — four entries
- `data/metadata/effect-implementation-index.json` — regenerated
- Governance:
  - `docs/ai/DECISIONS.md` (D-24588)
  - `docs/ai/STATUS.md`
  - `WORK_INDEX.md`
  - `EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`

That is 14 code/data files, above the ~8 guideline. Half are tests; the rest is the minimum set for one strike and four tactics on the existing seat-choice substrate.

## Contract

- The ids and kinds listed under Locked Values.
- The helpers in `zarathos.logic.ts` are internal: not exported from `index.ts`.
- `defaultOptionIndex` per kind, as listed under Locked Values.

## Vision Alignment

**Vision clauses touched:**
- §8 / §22: determinism and replay faithfulness.
- Card faithfulness: the game plays as printed.
- NG-1: no pay-to-win.

**Conflict assertion:** No conflict.

**Non-Goal proximity:** NG-1..7 are not crossed. This is a pure gameplay rule implementation.

**Determinism preservation:**
- Seat order is ascending and option order is locked.
- The only randomness is the draw reshuffle, through the provided shuffle context.
- The core sentinel and the PRE_WP080 replay play no Zarathos, so `finalStateHash` is expected unchanged. If a pin moves, dual re-pin honestly.

## Funding Surface Gate

§20 **N/A** — an engine gameplay rule. No nav, profile, funding copy or channel.

## API Catalog

§21 **N/A** — no HTTP endpoint and no `apps/server/src/**` library surface.

---

## Acceptance Criteria

1. **First strike.** With no haunted Hero, there are no Wounds and Zarathos haunts the highest-cost Hero (ties → lowest index).
   - A second strike gives every player a Wound and does not re-haunt.
2. **Strike while only a Villain haunts.** Wounds are dealt, then Zarathos haunts a different, unhaunted Hero.
3. While Zarathos haunts, `fightMastermind` is refused. After `exorciseHauntedHero` on his slot, it succeeds. A second strike or tactic haunt while he is already haunting is a logged no-op, so there is never a second Mastermind haunter.
4. **Tactic haunt.** Each tactic haunts the highest-cost Hero of its class pair (dual-class counts). With no match there is no haunt, and the no-op is logged.
   - After the **final** tactic, a successful haunt blocks the Final Blow until the table exorcises.
5. **Eruption / Corrupted Spirit.**
   - Only qualifying *other* seats are addressed; the defeater never is.
   - Non-qualifying seats auto-resolve exactly as locked, including `selectDiscardToLimitCards(G, hand, hand.length - 3)` for hand > 3.
   - Option order and `defaultOptionIndex` 0 are as locked.
   - Apply order is ascending seat.
6. **Imprison.**
   - A false condition, or an empty Villain set, means no park.
   - A Henchman in the Victory Pile is offered.
   - Choosing a card moves it to `G.ko` and draws VP cards. A Villain with no printed VP draws `VP_VILLAIN` (1), mirroring scoring.
   - "Don't KO" changes nothing.
7. **Demonic Essence.**
   - Owed 0 / 1 / 2 parks nothing / `-last` / `-first`.
   - `-first` chains `-last` after both accept and decline. A timed-out `-first` does not chain.
   - Options never include discard-pile cards.
8. **Sim.** A seeded 2-player Zarathos engine-runner game terminates and is not flagged stuck. At least one Eruption or Corrupted Spirit defeat is forced by the test fixture.
9. **Suites.** The engine suite is green and `pnpm -r --no-bail test` has 0 failures.
   - `effect-index:check`, `sim:runtime-observed:check` and `sim:coverage --check` all exit 0.
   - `finalStateHash` is unchanged, or dual-re-pinned honestly.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass, including the new cases.
3. `pnpm -r --no-bail test` → 0 fail.
4. `pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all exit 0. The index shows the four Zarathos tactics as implemented.
5. `git diff --name-only` ⊆ Files Expected to Change. Revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes, and the diff is allowlist-only.
- [ ] D-24588 appended Active to `DECISIONS.md`.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, and `roadmap:counts:check` 0.
- [ ] Two-commit topology: `EC-795:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED, with WP-757 and WP-759 deployed). In a live **human-driven** (solo or multi-seat) Zarathos match on `play.legendary-arena.com`, with the deployed gitSha checked, observe:
  - a Master Strike haunting a Hero;
  - the Mastermind unfightable until exorcised;
  - a tactic's second clause resolving.

  This is recorded as operator-pending until seen. Do not use all-bot autoplay; see Out of Scope.

## Reserved Decision (lands at execution)

**D-24588 — zarathos-mastermind.** Locks:
- the highest-cost selector: class OR, ties to the lowest index;
- the strike order: wounds before the haunt, with the haunt skipped while already haunting;
- the five seat-choice kinds, with their option orders and defaults;
- Corrupted Spirit's hand ≤ 3 auto-resolve and its `selectDiscardToLimitCards` pick (a named fidelity gap);
- Henchmen counting as Villains for Imprison; the VP fallback mirrors scoring, and dynamic VP is a named gap;
- the double-haunt guard in `zarathosHauntHighestCost`;
- Demonic Essence: hand + in-play only, owed-count evaluated once, the `-first` → `-last` chain, and no chain on timeout;
- the Final Blow blocked by a post-tactic haunt.

---

## Lint Gate Self-Review (00.3)

**Round 1: FAIL** on §1, §2, §4, §5, §8, §13, §17, §20 and §21 (gate subagent). All are fixed in this revision:
- sections added;
- engine-wide boilerplate and session protocol added;
- DECISIONS, ARCHITECTURE and rules-v23 citations added;
- the placeholder file row replaced, with per-file notes;
- the layer declaration added (engine only; the autoplay gap excluded);
- exact verification commands added.

**Round 2: PASS.**
- **§1–§5:** present; Assumes verified by the gate subagent; 14 files, with the overage justified.
- **§6:** ids verified against `mastermind.setup.ts:279`.
- **§7:** no new dependencies.
- **§8:** engine only.
- **§9–§11:** N/A.
- **§12:** `node:test`, no network.
- **§13:** exact commands.
- **§14:** nine binary ACs.
- **§15:** STATUS, DECISIONS, indexes and live-verify covered.
- **§16:** human-style code.
- **§17:** satisfied.
- **§18–§21:** N/A.

## Gate Record

**Pre-flight (01.4), round 1: NOT READY**
- PS-1: the WP-757 dependency.
- PS-2: the sim default-dispatch file did not exist. **Resolved:** hard dependency on WP-749, which adds exactly that branch, plus a ≥2-player sim AC.
- PS-3: autoplay acts only as `currentPlayer`. **Resolved:** excluded as a pre-existing, separately tracked gap; the live-verify was re-pointed to human-driven play.
- PS-4: Demonic Essence included the discard pile. **Resolved:** hand + in play only, per rules v23 ~L3439.
- RS-1..8 locked above:
  - the discard-count argument;
  - `defaultOptionIndex` set per builder, with no edit to the timeout function;
  - the timeout path does not chain;
  - the `playerHasHeroOfClasses` helper;
  - Henchmen count as Villains;
  - the Final Blow AC and the victory-latch wording;
  - the Corrupted Spirit option order;
  - the Monarch's Decree precedent.
- Allowlist additions:
  - `tactic-provenance.json`;
  - the effect-index regen (now certain);
  - `simulation.runner.test.ts`;
  - the named test files.
- The D-24588 ledger text was retitled.

**Scope verdict: READY TO EXECUTE once WP-757 and WP-749 are merged.**

**Copilot (01.7), round 1: BLOCK (SUSPEND).** The findings were #12/#30 (allowlist), #23 (ordering), #26 (semantics), #18 (Final Blow timing), #22 (silent sim-stuck), #4 (argument semantics) and #11 (vacuous solo AC). Each maps to a fix above: the allowlist is closed, ordering and defaults are locked, the semantics are locked in D-24588, and there are the Final Blow AC and the ≥2-player sim AC.

**Round 3 CONFIRM (independent subagent).** One defect fixed: D2, where strike wounds used a private `mastermindHandlers` helper that `zarathos.logic.ts` cannot import without a cycle. They now go through `gainWoundForPlayer`. With that fix, the scope verdict stands at READY once WP-757 and WP-749 merge, and copilot is RISK (documented).

**Round 2 (independent subagent).** Every round-1 code-fact fix was confirmed. Two new blockers, both fixed in this revision:
- **B1:** the Imprison VP fallback of 0 contradicted scoring. It now mirrors `?? VP_VILLAIN` / `?? VP_HENCHMAN`, and an AC asserts it.
- **B2:** no double-Mastermind-haunt guard. `zarathosHauntHighestCost` now no-ops while he is haunting, with an AC.

Non-blocking, locked: the `SeatChoiceOption.cardId` comment update (`types.ts` added, comment-only), and the Imprison apply being draw-safe without a shuffle.

Verdicts: pre-flight **READY TO EXECUTE once WP-757 and WP-749 merge**; copilot **RISK (documented)**. Residual risk: the dependency on two unmerged WPs.
