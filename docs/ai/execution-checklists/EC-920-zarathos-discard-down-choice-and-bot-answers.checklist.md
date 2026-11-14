# EC-920 — Zarathos discard-down choice and bot answers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-882-zarathos-discard-down-choice-and-bot-answers.md
**Layer:** Game Engine + arena-client (prompt headings)
**Risk Tier:** MEDIUM — gameplay rules (a multi-seat chained choice replaces an auto-pick) and the bot-ally policy; no auth, money, persistence or server surface

## Before Starting
- [ ] `origin/main` at or after `d13a6252` (#3278 merged) and includes the WP-882 draft SPEC.
- [ ] `pnpm install` and `pnpm -r build` → 0. `pnpm --filter @legendary-arena/game-engine test` → 0 fail. `pnpm --filter @legendary-arena/arena-client test` and `pnpm --filter @legendary-arena/arena-client typecheck` → 0. Record both counts for STATUS (engine was 6884 / 0 at WP-881's close; not locked).
- [ ] Anchors unchanged (`seatChoiceTactics.ts`): `selectDiscardToLimitCards` import `:70`, Zarathos kinds `:817-825`, `ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT` `:828`, `buildZarathosCorruptedSpiritChoice` `:960`, `discardZarathosHandDownToThree` `:1005`, `applyZarathosCorruptedSpirit` `:1058`, `buildZarathosDemonicEssenceChoice` `:1255`.
- [ ] Anchors unchanged elsewhere: `seatChoice.resolve.ts` `SEAT_CHOICE_STAGE` `:208`, `parkSeatChoice` `:374`, captures `:484-520`, apply + delete `:524-525`, Zarathos arms `:703-724`, `chainZarathosDemonicEssenceLast` `:913`, `applySeatChoiceTimeoutDefault` `:963`; `resolveReturnOnDiscard.ts` opener `:244` (called at `game.ts:910`, `simulation.runner.ts:716` / `:844`, `par.aggregator.ts:791` / `:899`); `tacticHandlers.ts` imports `:72-84` (deleted helper `:78`), `resolveCorruptedSpiritOfVengeance` `:1858`; `mastermindHandlers.ts` `selectDiscardToLimitCards` `:308`; `ai.seatChoice.ts` `chooseByKind` `:110`, `indexOfLeastValuableCard` `:344`; `types.ts` `PendingSeatChoice` `:1543`; `PendingSeatChoicePrompt.vue` `heading()` `:88`.
- [ ] `git grep -n applySeatChoiceTimeoutDefault -- packages apps` → only `seatChoice.resolve.ts` and tests (no production caller).
- [ ] Scope lock: the target file set is exactly §Files to Produce; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)
**Choice**
- `ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND = 'zarathos-corrupted-spirit-discard-down'` (`seatChoiceTactics.ts`).
- `buildZarathosDiscardDownChoice(G, seats)`: seats with hand > 3, ascending; `undefined` when none. Options = ids of `selectDiscardToLimitCards(G, hand, hand.length)` in order, one per distinct id (first kept), `{ label: 'Discard <name>', cardId }`; `defaultOptionIndex: 0`.
- `applyZarathosDiscardDown`: ascending seats; `discardFromHand`; log `Player <seat> discarded <name> (Corrupted Spirit of Vengeance).` `'applied'`.
- `buildZarathosCorruptedSpiritChoice(G, seats, classes, discardDownSeats: readonly string[] = [])`: the payload is stamped only after the base choice is defined and only when the list is non-empty (the 3-arg caller at `seatChoiceTactics.test.ts:551` stays byte-identical). Its discard-down option logs `Player <seat> chose to discard down to 3 cards (Corrupted Spirit of Vengeance).` `'neutral'` and discards nothing.
- `PendingSeatChoice.zarathosDiscardDownSeats?: string[]` — sorted, omit-when-empty, only on `zarathos-corrupted-spirit`, never projected.
- `readZarathosDiscardDownSeats(choice)` = payload ∪ addressed seats whose submitted option has no `cardId`; deduped, ascending.

**Handler + chain**
- Handler: a seat with > 3 cards and no Instinct / Covert Hero → `discardDownSeats` + log `Fight effect: Player <seat> has no Instinct or Covert Hero, so they must discard down to 3 cards (Corrupted Spirit of Vengeance).` `'neutral'`; no card moves. Choosers → park Corrupted Spirit (payload, existing park line). No chooser + forced → park the discard-down choice directly. Neither → nothing.
- `resolveSeatChoice`: capture `readZarathosDiscardDownSeats(choice)` (Corrupted Spirit) or `[...choice.addressedSeats]` (discard-down) before the apply (`if` / `else if`); after `delete`, `chainZarathosDiscardDown(G, seats, events)` → build → `parkSeatChoice(G, events, choice)` (no skip, no log).
- Timeout path unchanged, never chains (D-24833 §4 regression for forced seats, accepted).
- Delete `discardZarathosHandDownToThree`; `tacticHandlers.ts` drops only that import (`:78`); `seatChoiceTactics.ts:70` keeps `selectDiscardToLimitCards`.

**Bot + client**
- `chooseByKind`: the discard-down kind joins the `indexOfLeastValuableCard` list. Both Demonic kinds → new `indexOfPlayedFirstZeroCostKoOption`: first `sourceZone === 'inPlay'` option with `cardStats` cost 0, else first `'hand'` one, else `options.length - 1`. `ZARATHOS_CORRUPTED_SPIRIT_KIND` → new `indexOfZarathosCorruptedSpiritOption`: the option with no `cardId` when `hand.length - 3` ≤ the `WOUND_EXT_ID` count in hand, else `null` (default). No arm for Eruption or Imprison.
- `heading()` cases, verbatim:
  - `'zarathos-corrupted-spirit-discard-down'` → `Corrupted Spirit of Vengeance — discard down to 3 cards: choose a card to discard`
  - `'zarathos-eruption'` → `Eruption of Hellfire — discard a Covert or Ranged Hero, or gain a Wound`
  - `'zarathos-corrupted-spirit'` → `Corrupted Spirit of Vengeance — discard an Instinct or Covert Hero, or discard down to 3 cards`
  - `'zarathos-imprison'` → `Imprison in the Soul Crystal — KO a Villain from your Victory Pile and draw cards equal to its VP?`
  - `'zarathos-demonic-essence-first'` / `'zarathos-demonic-essence-last'` → `Demonic Essence of Ghost Rider — KO one of your Heroes?`

## Guardrails
- No card leaves a hand before its owner chooses it; the handler never discards.
- Every discard goes through `discardFromHand` (the chokepoint drift test must stay green).
- Defaults reproduce `selectDiscardToLimitCards` in set AND order — proved by the parity test (empty discard pile, no teleport-on-discard card), not argued.
- Each re-chain stage-rides exactly the seats still above 3 — proved by the recording `setActivePlayers` test (`makeSeatEvents` / `admitted` shape): one call per re-chain, `revert: true`, each seat `{ stage: SEAT_CHOICE_STAGE, moveLimit: 1 }`, no call once all hold 3.
- No comment in `packages/` or `apps/` names the deleted discard-down helper.
- Do not change `getLegalMoves`, any shipped `defaultOptionIndex`, the Crush / Dominate arms, `game.ts`, `index.ts`, `ui/*`, card data or any feed.
- Only `seatChoice.resolve.test.ts:609` and `tacticHandlers.test.ts:2026` / `:2051` migrate (intentional, named in the `EC-920:` body); no other existing assertion is edited to go green.
- A moved sentinel / `PRE_WP080_HASH` / PAR / `sim:runtime-observed` / `sim:coverage` pin is a STOP (no oracle plays Zarathos).
- Moves never throw; no `.reduce()` for branching; no nested ternaries; functions ~30 lines.

## Required `// why:` Comments
- The kind + builder: D-24588 §6 gap closed; option 0 = the selector's next pick, so defaults reproduce today (greedy selector, `discardFromHand` removes the first copy).
- One card per round: a seat choice resolves one `optionIndex` (the WP-860 Commune precedent).
- `applyZarathosDiscardDown`: ascending seat order (D-24501 / D-24780 §8, §13); forced seats' discard reactions queue ascending, not clockwise (D-24833 §5).
- The payload field (`types.ts`) and the handler: forced seats wait for the Hero-holders and join round 1; a Hero-discarder above 3 must not.
- The chain capture / park: live move context, the Monarch's / Crush shape; the timeout path does not chain (D-24501).
- The Demonic bot helper: a played starter has given its +1; a hand starter could still be played (D-24754 sibling).
- The Corrupted Spirit bot helper: discarding down costs only Wounds when the cards owed ≤ the Wounds in hand (its own rounds drop Wounds first).
- The keep-default kinds (Eruption, Imprison) in the `ai.seatChoice.ts` header (D-24833).
- The client heading cases.

## Files to Produce
- `packages/game-engine/src/moves/seatChoiceTactics.ts` + `.test.ts` — **modified** (incl. the AC-4 UIState redaction test)
- `packages/game-engine/src/moves/seatChoice.resolve.ts` + `.test.ts` — **modified** (incl. the stage-ride test)
- `packages/game-engine/src/rules/tacticHandlers.ts` + `.test.ts` — **modified**
- `packages/game-engine/src/types.ts` — **modified** (one optional field)
- `packages/game-engine/src/simulation/ai.seatChoice.ts` + `.test.ts` — **modified**
- `packages/game-engine/src/simulation/seatChoiceDispatch.test.ts` — **modified** (seeded Corrupted Spirit sim game + fixture replay)
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `.test.ts` — **modified** (six headings)
- `docs/ai/DECISIONS.md` (D-24833), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0; engine and arena-client suites 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm -r --no-bail test` 0 fail. Before / after counts in STATUS.
- [ ] `effect-index:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `ledger:numbers:check` → 0 with no file rewritten; sentinel and `PRE_WP080_HASH` unchanged.
- [ ] `git grep -n discardZarathosHandDownToThree -- packages apps` → no output.
- [ ] D-24833 Active (all eight WP §Reserved Decision items). STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` 0. NUMBER-LEDGER LANDED.
- [ ] Allowlist-only diff. Two-commit topology. Live-verify (D-24026) post-deploy on a NEW match; the Demonic Essence bot answer recorded as not live-verified.

## Common Failure Smells
- A forced seat already holds 3 cards when the Corrupted Spirit prompt appears → the handler still auto-discards.
- A seat that discarded a Hero is asked to discard down → the reader used `addressedSeats` instead of the submitted option.
- Round 2 never parks → the capture ran after `delete G.pendingSeatChoice`, or the chain filters on the pre-apply hand.
- Round 2 parks but a non-active seat cannot answer → the chain built the choice but skipped `parkSeatChoice`'s stage ride.
- The parity test discards the right cards in the wrong order → options sorted by `offPlayCardStats` / Wound-first instead of the selector.
- A return-on-discard prompt interrupts the rounds → the chain parks after the onMove opener, or the opener's pending-choice guard was bypassed.
- The sim game stalls on Corrupted Spirit → the new arm is missing from `applySeatChoiceByKind`, so the generic log apply runs and nothing is discarded.
