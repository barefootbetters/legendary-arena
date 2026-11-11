# WP-882 — Zarathos follow-ups: Corrupted Spirit's "discards down to 3" becomes the player's pick; bot answers and prompt headings for the Zarathos seat choices (Game Engine + arena-client headings)

**Status:** Draft 2026-11-11
**Primary Layer:** Game Engine (seat-choice builders / applies / chain, one tactic handler, the bot-ally seat-choice policy) + arena-client prompt headings for the six Zarathos kinds
**Dependencies (all ✅):**
- WP-758 / D-24588 (Zarathos tactics and their five seat-choice kinds; §6 names the "down to 3" auto-pick a fidelity gap)
- WP-684 / D-24501 (the multi-seat seat-choice model: simultaneous, ascending-seat apply, deterministic default, the timeout path does not chain)
- WP-694 / D-24511 (a seat choice chained from `resolveSeatChoice` in the live move context)
- WP-821 / D-24754 (Crush Pacifist Resistance's zero-cost KO bot policy, `indexOfZeroCostKoOption`)
- WP-749 / D-24573 (sim / PAR dispatch a seat choice addressed to a non-active seat), D-24744 / D-24745 (the bot ally answers like a playing seat; autoplay / sim / PAR keep the default)
- WP-793 / D-24656 (a non-active seat's return-on-discard opens only after every seat choice closes)
- WP-860 / D-24796 (a discard owed one card at a time as re-chained seat choices, `communeSpiritWorld.discardsRemaining`)

**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — gameplay rules (a multi-seat chained choice replaces an auto-pick) and the bot-ally policy; no auth, money, persistence or server surface
**Lane:** Standard (two-session). A new multi-seat chain, a `PendingSeatChoice` payload field and six client headings; not lightweight-eligible (> 4 code/test files, crosses engine → arena-client).

> Baseline: `origin/main` at `d13a6252` (#3278 merged — the WP-882 / EC-920 / D-24833 and WP-883 / EC-921 / D-24834 reserve).

---

## Goal

Zarathos's tactic **Corrupted Spirit of Vengeance** prints: "Each other player discards a [instinct] or [covert] Hero or discards down to 3 cards." At the table the discarding player picks which cards to drop. Today the engine picks them (`discardZarathosHandDownToThree` → `selectDiscardToLimitCards`, cheapest first), for both a player who chose "Discard down to 3 cards" and a player with more than 3 cards and no Instinct / Covert Hero. D-24588 §6 names this a fidelity gap.

**After this session:**
1. **The player picks.** Every seat that owes the discard-down (chose it, or had no matching Hero) answers a new multi-seat seat choice, `zarathos-corrupted-spirit-discard-down`: one hand card per round, every owing seat at once, re-chained until each holds 3. Every card goes through `discardFromHand`.
2. **The default reproduces today.** Each seat's options are listed in `selectDiscardToLimitCards` order and the default is option 0, so an absent seat, autoplay, the simulation and PAR discard exactly the cards (and in the order) the auto-pick discards today.
3. **Bot-ally answers.**
   - Each discard-down round: the least valuable card (a Wound first).
   - Corrupted Spirit: "Discard down to 3 cards" when every card it would drop can be a Wound (`hand.length - 3` ≤ the Wounds in hand), else the default (discard the cheapest matching Hero).
   - Demonic Essence of Ghost Rider: KO a 0-cost card it already played, else a 0-cost card in hand, else decline.
   - Eruption of Hellfire and Imprison in the Soul Crystal keep their defaults (evidence in D-24833).
4. **Client.** The new kind and the five WP-758 kinds each get their own prompt heading (today the five show "Your choice").

## User-Visible Impact

- A player hit by Corrupted Spirit who picks "Discard down to 3 cards", or who holds no Instinct / Covert Hero, sees "Corrupted Spirit of Vengeance — discard down to 3 cards: choose a card to discard" with one button per card, once per card owed (6 cards → three prompts).
- The log names each card as it goes: "Player 1 discarded Wound (Corrupted Spirit of Vengeance)."
- A bot ally drops a Wound first, takes the discard-down when it would cost only Wounds, and on Demonic Essence thins a S.H.I.E.L.D. starter it already played instead of always declining.
- Every Zarathos tactic prompt names its tactic and what is being asked instead of "Your choice".

---

## Assumes

1. **Builders / applies** (`packages/game-engine/src/moves/seatChoiceTactics.ts`, at `origin/main` `d13a6252` (#3278 merged)):
   - `import { selectDiscardToLimitCards } from '../rules/mastermindHandlers.js'` `:70` (kept: the new builder uses it).
   - Kinds `ZARATHOS_ERUPTION_KIND` … `ZARATHOS_DEMONIC_ESSENCE_LAST_KIND` `:817-825`; `ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT = 3` `:828`; `ZARATHOS_DISCARD_DOWN_LABEL` `:833`.
   - `buildZarathosHandDiscardChoice` `:892` (default 0); `buildZarathosCorruptedSpiritChoice(G, seats, classes)` `:960`.
   - `discardZarathosHandDownToThree(G, seat)` `:1005` — the auto-pick: `selectDiscardToLimitCards(G, zones.hand, hand.length - 3)`, then one `discardFromHand` per card and one "discarded down to 3 cards: A, B" log line.
   - `applyZarathosCorruptedSpirit` `:1058` — ascending seats; an option with no `cardId` (the discard-down option) calls `discardZarathosHandDownToThree`.
   - `buildZarathosDemonicEssenceChoice` `:1255` — options are the hand, then the cards in play, one per (zone, id), each with `sourceZone`, then "Don't KO"; default = last.
   - `readSeatOption(choice, seat)` `:1326` (module-private).
2. **Resolve** (`moves/seatChoice.resolve.ts`): the pre-apply captures `:484-520` (Monarch's, Crush, Demonic Essence, Commune); `applySeatChoiceByKind(G, choice, { random }, ctx?.currentPlayer)` `:524`, then `delete G.pendingSeatChoice` `:525`, then the chains `:531-577`; the Zarathos dispatch arms `:703-724`; `chainZarathosDemonicEssenceLast` `:913`; `applySeatChoiceTimeoutDefault` `:963` (does not chain; **no production caller** — grep at baseline finds only tests).
2a. **Park + return-on-discard opener.**
   - `parkSeatChoice(G, events, choice, activePlayerToSkip?)` (`moves/seatChoice.resolve.ts:374`) sets `G.pendingSeatChoice` and stage-rides the addressed seats through `events.setActivePlayers({ value, revert: true })`, each seat `{ stage: SEAT_CHOICE_STAGE, moveLimit: 1 }` (`SEAT_CHOICE_STAGE = 'resolvingSeatChoice'`, `:208`); a guarded no-op without `setActivePlayers`.
   - `openNonActiveReturnOnDiscardSeatChoiceIfNeeded(G, events, currentPlayer)` (`moves/resolveReturnOnDiscard.ts:244`) is called from `game.ts:910` (`turn.onMove`) and mirrored in `simulation/simulation.runner.ts:716` / `:844` and `simulation/par.aggregator.ts:791` / `:899`. It returns at once while `G.pendingSeatChoice` is set, so a chain parked inside `resolveSeatChoice` holds every queued non-active return-on-discard until the chain ends.
3. **Handler** (`rules/tacticHandlers.ts`): `resolveCorruptedSpiritOfVengeance` `:1858`. Its loop over `otherSeatsClockwiseFrom(G, currentPlayer)` (`:1869-1881`) logs a seat with ≤ 3 cards, adds a seat holding a matching Hero to `choosingSeats`, and calls `discardZarathosHandDownToThree` for the rest (`:1880`); then it builds and parks the choice (`:1882-1890`). The imports `:72-84` include `discardZarathosHandDownToThree` (`:78`), the only import this WP drops there.
4. **Selector** (`rules/mastermindHandlers.ts:308`): `selectDiscardToLimitCards(G, hand, discardCount)` works on hand indices; each step takes the lowest `G.cardStats[id]?.cost ?? 0` with strict `<` (lowest hand index on a tie; Wounds and S.H.I.E.L.D. starters read 0). `discardFromHand` (`moves/discardFromHand.ts`) removes the **first** occurrence of the id and queues return-on-discard / teleport reactions; it never adds a card to a hand.
5. **Bot policy** (`simulation/ai.seatChoice.ts`): `choosePlayingSeatChoiceOption` `:79` is used only by the bot-ally driver (`apps/server/src/bot-ally/botAllyDriver.mjs:461`); `chooseByKind` `:110` has no Zarathos arm, so all five kinds take `clampDefault`; `indexOfLeastValuableCard` `:344` (Wound first, else lowest `cardStats` cost, earliest on a tie); `indexOfZeroCostKoOption` `:378` (first 0-cost option, else the last option).
6. **Types** (`types.ts`): `PendingSeatChoice` `:1543-1604` already carries per-kind optional payloads (`leftNeighborBySeat`, `communeSpiritWorld`, `sizeChangingGrant`, `villainFightPick`). The UIState projection (`ui/uiState.build.ts:2160-2183`) copies only `kind`, `addressedSeats`, `outstandingSeats` and option `label`s, so a payload field is never projected.
7. **Client** (`apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue`): renders any kind generically by option label; `heading()` `:88-147` maps known kinds to a heading and falls back to "Your choice". The five WP-758 kinds have no case, so they show "Your choice" today.
8. **No kind registry.** Seat-choice kinds are bare strings; no canonical array, drift pin, `index.ts` export or `game.ts` change exists for any earlier kind (`crush-pacifist-resistance-last-ko`, `zarathos-demonic-essence-last` grep at baseline: the constant, its imports, the dispatch arm, the bot arm, tests).
9. **Oracles.** D-24588 Consequences: no `finalStateHash`, sentinel, `PRE_WP080_HASH`, PAR, `sim:runtime-observed` or `sim:coverage` oracle plays Zarathos.
10. `pnpm -r build` exits 0 and the suites are green at the baseline (engine 6884 / 0 at WP-881's close, #3277). The count is not locked: record the engine and arena-client before / after counts in STATUS.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- Card text: `data/cards/mdns.json:694-697` (Corrupted Spirit of Vengeance). Rules v23 L3439-3447 (Demonic Essence "your Heroes" = hand + played).
- `docs/ai/DECISIONS.md`: D-24588 (§4, §6, §8, Consequences "Follow-ups"), D-24501, D-24511, D-24754, D-24744, D-24745, D-24573 / D-24590, D-24656 (replay-divergence position), D-24780 (§8, §11, §13), D-24779 §8b, D-24796, D-24119. D-24833 is reserved.
- User memory: `reference_interactive_choice_active_player_only` (multi-seat = `pendingSeatChoice`), `reference_setup_hook_change_replay_compat` (does **not** apply — this is handler code, not setup hooks), `reference_bot_legalmoves_moveguard_divergence`, `reference_simulation_harness_bypasses_bgio`.
- **Why rounds, not one multi-pick prompt.** A seat choice resolves one `optionIndex` per seat; a multi-select would change the WP-684 contract and the client. One card per round re-chained is the WP-860 Commune precedent (`discardsRemaining`), and every addressed seat answers each round at once (D-24501).
- **Why forced seats join the chain.** D-24588 §6's gap covers both auto-picks: the chooser's and the seat with no matching Hero. Both now pick their own cards.
- **Why a payload field.** The forced seats must wait for the Hero-holders' answer and then join the first discard-down round, but a Hero-holder who discarded a Hero may still hold more than 3 cards and must not join. Nothing in `G` distinguishes them after the apply, so the forced seats ride on the Corrupted Spirit choice as `zarathosDiscardDownSeats` (the `communeSpiritWorld` precedent). Recomputing them at chain time would need `ctx.currentPlayer`, which narrow test contexts omit.
- **Why the default reproduces today.** With options in `selectDiscardToLimitCards` order, option 0 of each round is the selector's first pick on the current hand. The selector is greedy over the remaining hand and `discardFromHand` removes the first copy of the id (equal ids share a cost, so it is the copy the selector would take), keeping the rest in order. So N defaulted rounds discard the same cards in the same order as `selectDiscardToLimitCards(G, hand, N)`.
- **Bot evidence** (D-24833 records it):
  - Eruption default 0 = discard the cheapest matching Hero (the builder sorts by cost); the alternative is a Wound.
  - Corrupted Spirit default 0 = discard the cheapest matching Hero (one card) instead of discarding down (≥ 1 card, usually 3 of the 6-card hand the seat drew for its next turn). The exception: when the cards owed (`hand.length - 3`) are no more than the Wounds in hand, discarding down costs only Wounds, which beats losing a Hero. The bot's own discard-down rounds take Wounds first (`indexOfLeastValuableCard`), so that choice really drops only Wounds. Folded into scope at the WP-882 gate round (coordinator decision 2026-11-11, open question Q2).
  - Imprison default = decline: a KO gives up the Villain's VP (`RawScore = P − (VP × 10) + lossPenalty`, `docs/12-SCORING-REFERENCE.md:130`) for that many draws. A strategy call with no engine value model (the Dominate the Weak keep-default precedent, D-24754).
  - Demonic Essence default = decline: the Crush Pacifist Resistance policy (D-24754) KOs a 0-cost S.H.I.E.L.D. starter. Here the options list the hand first, and a starter already played this turn has given its +1, so KOing it costs nothing this turn while a hand starter could still be played.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only, Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (full-word names, JSDoc, no nested ternaries, functions ~30 lines, `// why:` comments).
- Moves and effects never throw. No randomness, no clock. Only the files in §Files Expected to Change.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24833) before coding. One WP per session.

**Packet-specific:**

- **Kind.** `export const ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND = 'zarathos-corrupted-spirit-discard-down';` in `seatChoiceTactics.ts`, beside the other Zarathos kinds. Every engine site uses the constant; the client heading matches the literal.
- **Builder** `buildZarathosDiscardDownChoice(G, seats): PendingSeatChoice | undefined`:
  - Addresses each given seat whose hand holds more than `ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT` cards, in ascending seat order; `undefined` when none.
  - A seat's options: the ids of `selectDiscardToLimitCards(G, hand, hand.length)` in that order, one option per distinct id (first occurrence kept), each `{ label: \`Discard ${resolveCardName(G.cardDisplayData, cardId)}\`, cardId }`.
  - `defaultOptionIndex: 0` (the selector's next pick), with a `// why:` naming the parity.
- **Apply** `applyZarathosDiscardDown(G, choice)`: ascending seats (D-24501; the D-24780 §8 / §13 ascending-apply exception, so forced seats' discard reactions queue ascending, not clockwise — D-24833 §5); each submitted option's card through `discardFromHand`; on success log `` `Player ${seat} discarded ${name} (Corrupted Spirit of Vengeance).` `` `'applied'` (the Hero-discard line's wording).
- **Corrupted Spirit choice payload.** The signature becomes `buildZarathosCorruptedSpiritChoice(G, seats, classes, discardDownSeats: readonly string[] = [])`. The payload `zarathosDiscardDownSeats: [...discardDownSeats].sort()` is stamped only after the base choice is defined (the builder still returns `undefined` when no seat is addressed) and only when the list is non-empty. So a choice with no forced seat is byte-identical to today's, and the existing three-argument caller (`seatChoiceTactics.test.ts:551`) stays byte-identical.
- **Corrupted Spirit apply.** The discard-down option (no `cardId`) logs `` `Player ${seat} chose to discard down to ${String(ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT)} cards (Corrupted Spirit of Vengeance).` `` `'neutral'` and discards nothing. The Hero option is unchanged.
- **Reader** `readZarathosDiscardDownSeats(choice): string[]`: the payload seats plus every addressed seat whose submitted option has no `cardId`, deduplicated and sorted ascending.
- **`types.ts`.** `PendingSeatChoice` gains `zarathosDiscardDownSeats?: string[]` with a `// why: WP-882 / D-24833` comment: present only on a `zarathos-corrupted-spirit` choice that has forced seats; read by the chain; never projected to the client.
- **Handler** `resolveCorruptedSpiritOfVengeance`. The loop is unchanged except that a seat with more than 3 cards and no matching Hero is pushed to `discardDownSeats` and logged `` `Fight effect: Player ${seat} has no Instinct or Covert Hero, so they must discard down to ${String(ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT)} cards (Corrupted Spirit of Vengeance).` `` `'neutral'` — no card moves at handler time. Then:
  - choosers present → build the Corrupted Spirit choice with the `discardDownSeats` payload, park it and log the existing park line (unchanged);
  - no chooser, `discardDownSeats` non-empty → build the discard-down choice for them and `parkSeatChoice(G, events, choice)` directly (no extra log line);
  - neither → nothing parks.
- **Chain** (`seatChoice.resolve.ts`, live move context, the Monarch's / Crush shape):
  - Before the apply, when `appliedKind === ZARATHOS_CORRUPTED_SPIRIT_KIND`, capture `readZarathosDiscardDownSeats(choice)`; when `appliedKind === ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND`, capture `[...choice.addressedSeats]`. Use `if` / `else if`, not a ternary.
  - A new dispatch arm in `applySeatChoiceByKind` calls `applyZarathosDiscardDown` (before the generic fall-through).
  - After `delete G.pendingSeatChoice`, when captured, a new `chainZarathosDiscardDown(G, seats, events)` builds `buildZarathosDiscardDownChoice(G, seats)` from the current hands; if defined, `parkSeatChoice(G, events, choice)` (no active-seat skip: the defeater is never addressed). No log line on a re-chain.
  - So each round re-addresses exactly the seats still above 3; a seat that reaches 3 drops out; the chain ends when none remain.
- **Timeout path.** Unchanged and not chained (D-24501, the shared residual; no production caller).
  - A defaulted discard-down round discards option 0 for each outstanding seat and stops.
  - A defaulted Corrupted Spirit choice discards each chooser's cheapest Hero and leaves the forced seats above 3. This is a **regression** from today, where forced seats discard down at handler time. Accepted because the path has no production caller, and listed with the D-24501 residuals that WP-116's timeout / abandonment wiring must pick up (D-24833 §4).
- **Delete** `discardZarathosHandDownToThree` (`seatChoiceTactics.ts:1005`). `tacticHandlers.ts` drops only that import (`:78`). `seatChoiceTactics.ts:70` keeps its `selectDiscardToLimitCards` import (the new builder uses it). No comment in `packages/` or `apps/` may name the deleted function afterwards.
- **Bot answers** (`ai.seatChoice.ts`, `chooseByKind`):
  - `ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND` → `indexOfLeastValuableCard(G, options)` (added to the existing discard-kind `if` list).
  - `ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND` / `ZARATHOS_DEMONIC_ESSENCE_LAST_KIND` → new `indexOfPlayedFirstZeroCostKoOption(G, options)`: the first option with `sourceZone === 'inPlay'` and `(G.cardStats[cardId]?.cost ?? 0) === 0`; else the first such option with `sourceZone === 'hand'`; else `options.length - 1` (the decline). `indexOfZeroCostKoOption` and the Crush arm are unchanged (duplicate first, 00.6).
  - `ZARATHOS_CORRUPTED_SPIRIT_KIND` → new `indexOfZarathosCorruptedSpiritOption(G, seat, options)`:
    - let `owed = hand.length - ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT` and `wounds` = the count of `WOUND_EXT_ID` in the seat's hand;
    - when `owed <= wounds`, return the index of the option with no `cardId` (the discard-down option, last in the list);
    - otherwise return `null` (keep the default 0, the cheapest matching Hero).
  - Eruption and Imprison get no arm (they keep `clampDefault`); the module header's keep-default list names them with D-24833.
- **Client headings.** `PendingSeatChoicePrompt.vue` `heading()` gains six cases under one `// why: WP-882 / D-24833` comment (strings verbatim):
  - `'zarathos-corrupted-spirit-discard-down'` → `Corrupted Spirit of Vengeance — discard down to 3 cards: choose a card to discard`
  - `'zarathos-eruption'` → `Eruption of Hellfire — discard a Covert or Ranged Hero, or gain a Wound`
  - `'zarathos-corrupted-spirit'` → `Corrupted Spirit of Vengeance — discard an Instinct or Covert Hero, or discard down to 3 cards`
  - `'zarathos-imprison'` → `Imprison in the Soul Crystal — KO a Villain from your Victory Pile and draw cards equal to its VP?`
  - `'zarathos-demonic-essence-first'` and `'zarathos-demonic-essence-last'` (one shared return) → `Demonic Essence of Ghost Rider — KO one of your Heroes?`
  No other client change; no UIState field.
- **Not touched:** `game.ts`, `index.ts`, `ui/*`, `getLegalMoves`, every `defaultOptionIndex` of the five shipped kinds, the Eruption / Imprison / Demonic Essence builders and applies, `selectDiscardToLimitCards`, the Crush / Dominate bot arms, `tactic-provenance.json` (handler name and status unchanged), every card-data file and derived feed.
- **Determinism / replay.**
  - No RNG, no clock. Absent seats, autoplay, the simulation and PAR take option 0 each round, so each seat's discards match today's set and order.
  - What changes for them: a forced seat discards after the Hero-holders answer instead of at handler time; its discard reactions queue in ascending seat order instead of clockwise (the D-24780 §8 / D-24779 §8b mixed-order residual); `G.messages` gains the per-card lines in place of the one summary line; the move stream gains one `resolveSeatChoice` per round.
  - No oracle plays Zarathos (D-24588), so no sentinel, `PRE_WP080_HASH`, PAR, `sim:runtime-observed` or `sim:coverage` pin should move — confirm by running them, do not assume. A moved pin is a STOP.
  - **Replay (D-24119).** This is runtime handler code that stored matches reach, not setup output. A match captured before the deploy in which Corrupted Spirit resolved with a seat above 3 cards re-executes with a discard-down choice its log never answers: the later logged moves no-op at the block-all guard and the replay diverges. A competitive capture submitted after the deploy fails `replay_verification_failed`; coach re-executions reflect the new rules. Accepted window, no migration (the D-24656 / D-24780 §11 position). Zarathos shipped 2026-11-10 (#3267), so the window holds a day or two of matches.
  - **Matches in progress** switch at the next Corrupted Spirit fight after the deploy.

## Locked Values

- Kind `'zarathos-corrupted-spirit-discard-down'` via `ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND`.
- Option order = `selectDiscardToLimitCards(G, hand, hand.length)`, one per distinct id; label `Discard <name>`; `defaultOptionIndex: 0`.
- `buildZarathosCorruptedSpiritChoice(G, seats, classes, discardDownSeats: readonly string[] = [])`; payload stamped only after the base choice is defined and only when non-empty.
- Payload `PendingSeatChoice.zarathosDiscardDownSeats?: string[]` (sorted, omit-when-empty), only on `zarathos-corrupted-spirit`.
- Log lines, verbatim: handler forced seat `Fight effect: Player <seat> has no Instinct or Covert Hero, so they must discard down to 3 cards (Corrupted Spirit of Vengeance).`; chooser `Player <seat> chose to discard down to 3 cards (Corrupted Spirit of Vengeance).`; each discard `Player <seat> discarded <name> (Corrupted Spirit of Vengeance).`
- Bot: discard-down → `indexOfLeastValuableCard`; both Demonic kinds → `indexOfPlayedFirstZeroCostKoOption` (inPlay 0-cost, then hand 0-cost, then decline); Corrupted Spirit → `indexOfZarathosCorruptedSpiritOption` (the discard-down option when `hand.length - 3` ≤ Wounds in hand, else the default).
- The six client heading strings, verbatim as in Packet-specific.

---

## Scope (In)

- **A) Engine choice.** `moves/seatChoiceTactics.ts`: the kind, `buildZarathosDiscardDownChoice`, `applyZarathosDiscardDown`, `readZarathosDiscardDownSeats`, the payload parameter on `buildZarathosCorruptedSpiritChoice`, the discard-down branch of `applyZarathosCorruptedSpirit`; delete `discardZarathosHandDownToThree`; update the module header. `types.ts`: the payload field.
- **B) Chain.** `moves/seatChoice.resolve.ts`: imports, the pre-apply capture, the dispatch arm, `chainZarathosDiscardDown`.
- **C) Handler.** `rules/tacticHandlers.ts`: `resolveCorruptedSpiritOfVengeance` collects forced seats, logs them, carries them or parks the discard-down directly; drop the deleted import.
- **D) Bot.** `simulation/ai.seatChoice.ts`: the three arms (discard-down, Demonic Essence, Corrupted Spirit), `indexOfPlayedFirstZeroCostKoOption`, `indexOfZarathosCorruptedSpiritOption`, the header's keep-default list.
- **E) Client.** `PendingSeatChoicePrompt.vue`: the six heading cases (+ their tests).
- **F) Tests.**
  - `moves/seatChoiceTactics.test.ts`:
    - the builder (selector order, one option per distinct id, a Wound and a starter at cost 0, `≤ 3` seats left out, `undefined` when none, default 0);
    - the payload is absent with no forced seat (the existing three-argument call at `:551` unchanged) and sorted when present; `undefined` with no chooser even when forced seats are passed;
    - the reader (payload ∪ choosers, deduped, sorted; a Hero-discarder excluded);
    - **AC-4 UIState:** build a full G with `buildInitialGameState(createTestConfig(), createMockRegistry(), makeMockCtx())` (the `ui/uiState.filter.test.ts:1452-1455` pattern), set a payload-bearing Corrupted Spirit choice, run `buildUIState` + `filterUIStateForAudience` for an addressed seat, a forced seat and `{ kind: 'spectator' }`, and assert that `JSON.stringify` of each result does not contain `zarathosDiscardDownSeats`.
  - `moves/seatChoice.resolve.test.ts`: **migrate** `:609` ("discards hand.length - 3 cards") — choosing the discard-down now discards nothing at once and parks the new kind for that seat (intentional behavior change, D-24833). New cases:
    - two owing seats with 5 and 6 cards: round 1 and 2 address both, round 3 only the 6-card seat, then nothing parks; the apply runs in ascending seat order whatever order the seats answer in. **Stage ride:** the resolve context's `events` is a recording `setActivePlayers` stub (the `makeSeatEvents` / `admitted` shape, `rules/tacticHandlers.test.ts:875`). Each re-chain records exactly one call with `revert: true` and a `value` keyed by exactly the seats still above 3, each `{ stage: SEAT_CHOICE_STAGE, moveLimit: 1 }` (the exported constant, `'resolvingSeatChoice'`). No call is recorded once every seat holds 3;
    - **parity:** a seat whose hand has duplicate ids, a Wound and a cost tie (empty discard pile, no teleport-on-discard card), answered at `defaultOptionIndex` every round, ends with exactly `selectDiscardToLimitCards(G, originalHand, hand.length - 3)` in its discard pile, in that order;
    - a forced seat in the payload joins round 1 with a seat that chose discard-down, and a seat that discarded a Hero and still holds 4 cards does not;
    - a return-on-discard card (a hook carrying `return-on-discard`) discarded in round 1 queues on `G.pendingReturnOnDiscard`, round 2 still parks the discard-down kind, and `openNonActiveReturnOnDiscardSeatChoiceIfNeeded` opens the return only once the chain has ended;
    - `applySeatChoiceTimeoutDefault` on a discard-down round discards option 0 and does not chain.
  - `rules/tacticHandlers.test.ts`: **migrate** `:2026` (seat 2's hand is untouched at handler time, its forced log line is present, the choice for seat 3 carries `zarathosDiscardDownSeats: ['2']`) and `:2051` (with no chooser, seat 1's 4-card hand parks the discard-down kind addressed to `['1']` instead of auto-discarding). Both are intentional behavior changes (D-24833).
  - `simulation/ai.seatChoice.test.ts`:
    - discard-down → the Wound, else the cheapest;
    - Demonic Essence (both kinds) → a played 0-cost starter over a hand 0-cost starter listed earlier, a hand starter when none is played, the decline when no 0-cost card is listed;
    - Corrupted Spirit → the discard-down option with 4 cards one of them a Wound, and with 5 cards two of them Wounds; the default (option 0) with 5 cards and one Wound, and with no Wound;
    - Eruption and Imprison return their `defaultOptionIndex`.
  - `simulation/seatChoiceDispatch.test.ts`: a seeded two-seat sim game following the WP-758 Eruption game's pattern (`:636-`):
    - its single Tactic is Corrupted Spirit of Vengeance;
    - the hero deck is the re-themed `mdns/spider-man` with every hero card set to `hc = 'tech'` and no `hc2`, so no card is Instinct or Covert, dual-class included;
    - so the non-defeating seat holds no Instinct / Covert Hero, and the WP-749 dispatch drains every discard-down round: the non-defeating seat ends the effect with 3 cards, the log carries one `Player N discarded … (Corrupted Spirit of Vengeance).` line per card, and the game ends with no stuck seat choice;
    - `buildFixtureFromCapture` + `runFixture` replay the same per-card `Player N discarded … (Corrupted Spirit of Vengeance).` lines in the same order.
  - `PendingSeatChoicePrompt.test.ts`: the exact heading for each of the six kinds.

## Out of Scope

- Imprison and Eruption bot answers (kept on their defaults, D-24833).
- Wiring the timeout path to chain (the D-24501 residual shared by every chained kind).
- Epic Zarathos (D-24193; unreachable Epic faces).
- Any change to autoplay / sim / PAR policy (they stay on `defaultOptionIndex`, D-24745 §3).

## Files Expected to Change

- `packages/game-engine/src/moves/seatChoiceTactics.ts` (+ `seatChoiceTactics.test.ts`) — modified
- `packages/game-engine/src/moves/seatChoice.resolve.ts` (+ `seatChoice.resolve.test.ts`) — modified
- `packages/game-engine/src/rules/tacticHandlers.ts` (+ `tacticHandlers.test.ts`) — modified
- `packages/game-engine/src/types.ts` — modified (one optional `PendingSeatChoice` field)
- `packages/game-engine/src/simulation/ai.seatChoice.ts` (+ `ai.seatChoice.test.ts`) — modified
- `packages/game-engine/src/simulation/seatChoiceDispatch.test.ts` — modified
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` (+ `PendingSeatChoicePrompt.test.ts`) — modified
- Governance: `docs/ai/DECISIONS.md` (D-24833), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

Five engine code files, five engine test files and two client files. The client pair is six heading strings and their tests (the new kind plus the five WP-758 kinds, folded in at the gate round, coordinator decision Q1); engine seat-choice WPs ship their headings in the same packet (WP-876, WP-845, WP-837, WP-830, WP-829).

## Contract

- The Locked Values.
- `zarathos-corrupted-spirit-discard-down` is the one discard-down kind; a future "discard down to N" seat choice may reuse its builder shape (selector order, default 0) without a new decision.

## Vision Alignment

**Vision clauses touched:** §1 Rules Authenticity (the player picks the cards, as printed), §4 Faithful Multiplayer Experience (each other player answers their own discard on someone else's turn; the WP-793 precedent), §18 Replayability & Spectation (every round is a logged `resolveSeatChoice` move, so a new match replays the same picks and per-card log lines), §22 Deterministic & Reproducible Evaluation (defaults reproduce today's picks), §23 / §24 (ranked fairness, replay-verified integrity: the accepted pre-deploy window).
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** none of NG-1..NG-8 is crossed.
**Determinism (§22):** no RNG, no clock; ascending-seat apply; defaults reproduce the selector. New replays are faithful; pre-deploy Corrupted Spirit matches diverge (accepted, D-24656 / D-24780 §11 / D-24833 §8).

## Funding Surface Gate

§20 **N/A** — an engine rules change plus six prompt heading strings; no funding affordance or channel (WP-097 §A/§B/§C) is shown, moved or changed.

## API Catalog

§21 **N/A** — no `apps/server` HTTP endpoint is added, changed or removed, and no `Library-only` catalog function is touched (`docs/ai/REFERENCE/api-endpoints.md` lists none of the edited engine functions).

---

## Acceptance Criteria

1. A seat that chooses "Discard down to 3 cards", and a seat with more than 3 cards and no Instinct / Covert Hero, each discard one chosen card per round through `discardFromHand` until they hold 3; no card leaves their hand before they choose it.
2. Each round addresses exactly the owing seats still above 3; the apply runs in ascending seat order; the chain ends with no seat choice open.
3. Answered at `defaultOptionIndex` every round, a seat's discards equal `selectDiscardToLimitCards(G, hand, hand.length - 3)` in set and order (parity test).
4. A Corrupted Spirit choice with no forced seat has no `zarathosDiscardDownSeats` key; the field never appears in UIState.
5. Return-on-discard reactions from the rounds queue and open only after the chain ends.
6. The bot ally answers per the Locked Values (Corrupted Spirit picks the discard-down only when `hand.length - 3` ≤ Wounds in hand); Eruption and Imprison return their default.
7. Each of the six Zarathos kinds renders its locked heading in the client; every other kind is unchanged.
8a. A re-chained round stage-rides exactly the seats still above 3 (`setActivePlayers` once, `revert: true`, `{ stage: SEAT_CHOICE_STAGE, moveLimit: 1 }` each), and no ride follows the last round.
8. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; arena-client `typecheck` → 0; `effect-index:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `ledger:numbers:check` → 0 with no regeneration; the core `finalStateHash` sentinel (`game.test.ts`) and `PRE_WP080_HASH` unchanged.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → 0 fail.
3. `pnpm --filter @legendary-arena/arena-client test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
4. `pnpm -r --no-bail test` → 0 fail.
5. `pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check && pnpm ledger:numbers:check` → all 0, no file rewritten.
6. `git grep -n discardZarathosHandDownToThree -- packages apps` → no output (code and comments alike).
7. `git diff --name-only` ⊆ Files Expected to Change; revert `packages/lagn-spec/schemas/lagn-v1.json` CRLF churn if the build touched it.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24833 Active (§Reserved Decision).
- [ ] STATUS entry, with the engine and arena-client before / after test counts; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] Two-commit topology (`EC-920:` then `SPEC:`); the `EC-920:` body names the three migrated tests as intentional behavior changes.
- [ ] **D-24026 live-verify (post-merge):** an operator match created after the deploy with `mdns/zarathos` and two seats (a second browser, or a bot ally for the bot half). Seat 0 defeats Corrupted Spirit of Vengeance while seat 1 holds more than 3 cards.
  - A human seat 1 with an Instinct / Covert Hero sees the Corrupted Spirit heading, picks "Discard down to 3 cards", and then sees the discard-down heading once per card owed; the log names each card.
  - A bot-ally seat 1 with no matching Hero discards a Wound first when it holds one; a bot-ally seat 1 staged with 4 cards, one a Wound, and an Instinct Hero logs "chose to discard down to 3 cards" and discards the Wound.
  - **Not live-verified:** the Demonic Essence bot answer. It needs a bot-ally seat to defeat that tactic, which the operator recipe cannot stage on demand; its evidence is the `ai.seatChoice.test.ts` cases. STATUS says so.
  - Recorded as a STATUS flip.

## Reserved Decision (lands at execution)

**D-24833 — zarathos-discard-down-choice-and-bot-answers.** Lands Active in the `SPEC:` close and locks:
1. The discard-down kind, its option order and default (the selector parity), and one card per round re-chained in `resolveSeatChoice` for the seats still above 3, ascending apply, every card through `discardFromHand`. Closes D-24588 §6's named fidelity gap and its "letting a player choose" follow-up.
2. Forced seats join the chain; they ride on the Corrupted Spirit choice as `zarathosDiscardDownSeats` (omit-when-empty, never projected), or park the discard-down directly when no seat chooses.
3. The three log lines.
4. The timeout residual: a timed-out round does not chain. A timed-out Corrupted Spirit choice leaves forced seats above 3, which is a **regression** from today's handler-time discard. Accepted because `applySeatChoiceTimeoutDefault` has no production caller. Listed with the D-24501 "the timeout path does not chain" residuals WP-116's timeout / abandonment wiring must pick up (among them the Random Acts pass-left, the Crush and Demonic Essence second picks and the Mandarin's Rings steps), as two new entries: the unchained discard-down round and the forced seats left above 3.
5. Forced seats' discard reactions now queue in ascending seat order at apply time, not clockwise at handler time (the D-24780 §8 / D-24779 §8b mixed-order residual; the D-24780 §13 forward rule yields to the D-24501 ascending apply).
6. Bot answers:
   - discard-down → least valuable card (Wound first);
   - Corrupted Spirit → the discard-down option when `hand.length - 3` ≤ the Wounds in hand (every card it would drop can be a Wound, and its own rounds drop Wounds first), else the default (the cheapest matching Hero);
   - both Demonic Essence kinds → a played 0-cost card, then a hand 0-cost card, then decline;
   - Eruption and Imprison keep their defaults, with the §Context evidence.
   Closes D-24588's "playing-seat answers" follow-up. Autoplay, sim and PAR stay on the default (D-24745 §3).
7. The six client headings (the new kind and the five WP-758 kinds).
8. Replay: the accepted pre-deploy window (D-24656 / D-24780 §11), matches in progress switch at the next Corrupted Spirit fight, and the measured oracle result.

---

## Lint Gate Self-Review (00.3)

Independent subagent (2026-11-11). **Run 1: FAIL. Run 2: PASS** after the gate-round fixes listed in the Gate Record. The per-section table is in the gate subagent's report; it is not reproduced here.

## Gate Record

All three gates ran as independent subagents on 2026-11-11, after drafting.

**Pre-flight (01.4): READY TO EXECUTE, conditional on PS-1 and PS-2. Both are applied in this revision.**
- PS-1: the `buildZarathosCorruptedSpiritChoice` signature is locked with a defaulted `discardDownSeats: readonly string[] = []`. The payload is stamped only after the base choice is defined and only when non-empty, so the three-argument caller at `seatChoiceTactics.test.ts:551` stays byte-identical.
- PS-2: a stage-ride test. A recording `setActivePlayers` stub asserts one `revert: true` ride per re-chain over exactly the seats still above 3, and no ride once all hold 3.

**Copilot (01.7): RISK → HOLD; five scope-neutral fixes applied.**

**Fixes applied in this revision** (consolidated across the three gates):
- the deleted-function grep is scoped to `packages apps`, plus a no-comment Guardrail;
- Assumes 2a: `parkSeatChoice`, the return-on-discard opener and its `game.ts` / sim / PAR call sites;
- a Required `// why:` for the ascending apply (D-24833 §5);
- the AC-4 UIState redaction test;
- sim-test precision: "the non-defeating seat", a single-class Tech deck, and the `buildFixtureFromCapture` + `runFixture` replay of the per-card lines;
- the `d13a6252` baseline;
- the import note (`:70` kept, `:78` dropped);
- before / after test counts recorded in STATUS (not locked);
- the parity case starts with an empty discard pile and no teleport-on-discard card;
- the D-24833 §4 regression wording and the WP-116 residual list;
- the §17 fields (§4, §18, NG-1..NG-8, the determinism / replay line);
- the Demonic Essence live-verify named unverified.

**Scope folded in at the gate round** (coordinator decisions 2026-11-11 on the draft's open questions):
- Q1: headings for the five WP-758 kinds.
- Q2: the Corrupted Spirit bot answer (discard down when `hand.length - 3` ≤ Wounds in hand).
- Q3: covered by the D-24833 §4 regression note.

Q1 and Q2 add no file to the allowlist.
