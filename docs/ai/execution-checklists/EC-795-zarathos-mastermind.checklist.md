# EC-795 — Zarathos Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-758-zarathos-mastermind.md
**Layer:** Game Engine
**Re-baselined:** 2026-11-10 on `fb28b03d` (WP-758 §Execution Re-baseline, R-1..R-12).

## Before Starting
- [ ] WP-757 is merged: `hauntHqSlot`, `isMastermindHaunting` and `isHqSlotHaunted` are exported from `board/haunt.logic.ts`. The `fightMastermind` haunting guard is live, and D-24587 is Active.
- [ ] WP-749 is merged: the sim/PAR loops resolve an open `pendingSeatChoice` for each outstanding addressed seat at `defaultOptionIndex`.
- [ ] `mastermindStrikeHandler` still has the :1521 chain, with the D-24810 hollow `else`. `resolveCurrentPlayer`, `gainWoundToDiscard` and `selectDiscardToLimitCards(G, cards, discardCount)` (:305) still exist, with the third argument being a discard **count**.
- [ ] Tactic ids are built at `mastermind.setup.ts:279`. `dispatchTacticOnFight(G, ctx, id, shuffleContext, events?)` exists (:1529).
- [ ] The re-baseline helpers exist: `seatsInTurnOrderFrom`, `gainWoundWithOutcome`, `offPlayCardTraits`, `offPlayCardStats`, `playedCardIdsStillInPlay`, `getEligibleVictoryVillains`, `victoryPointValueForCard`, `recordOwnedCardKoed`, and `scripts/coverage/strike-provenance.json`.
- [ ] Seat choice:
  - builders set `defaultOptionIndex`;
  - `applySeatChoiceTimeoutDefault` is kind-agnostic and does not chain;
  - the post-resolve chain block is in `resolveSeatChoice`;
  - `PendingSeatChoicePrompt.vue` renders any kind by label.
- [ ] `pnpm -r build` exits 0 and the engine suite is green.

## Locked Values (do not re-derive)
- `MASTERMIND_ZARATHOS = 'mdns/zarathos'`.
- Tactic ids: `mdns-mastermind-zarathos-{eruption-of-hellfire | corrupted-spirit-of-vengeance | imprison-in-the-soul-crystal | demonic-essence-of-ghost-rider}`.
- Class pairs:
  - Eruption: covert|ranged
  - Corrupted: instinct|covert
  - Imprison: strength|instinct
  - Demonic: ranged|strength
- Hero class source: `offPlayCardTraits` (`heroClass` / `heroClass2`) for hand and HQ cards, plus `cardHasClassWhenPlayed` over `playedCardIdsStillInPlay` for played cards (R-4).
- Highest-cost selector:
  - candidates are unhaunted, non-null slots, costed by `offPlayCardStats(G, id)?.cost ?? 0`;
  - a class filter matches class A OR class B, and a dual-class card counts once;
  - ties go to the lowest index;
  - no match → logged no-op.
- Strike order:
  1. Wound check: any non-null haunted slot, either kind.
  2. Each player takes a Wound, current player first then clockwise (`seatsInTurnOrderFrom`, D-24780), via `gainWoundWithOutcome` (`board/wounds.logic.ts:125`). `zarathos.logic.ts` never imports `mastermindHandlers` (no direct dependency on the strike dispatcher).
  3. Haunt, unless `isMastermindHaunting`.
  4. Nothing generic runs beside the arm (D-24654 removed capture-a-Bystander).
- Kinds: `zarathos-eruption`, `zarathos-corrupted-spirit`, `zarathos-imprison`, `zarathos-demonic-essence-first`, `zarathos-demonic-essence-last`.
- **Eruption** (two passes):
  - Pass 1, clockwise from the defeater (defeater skipped): a seat with no match auto-Wounds.
  - Pass 2, ascending: options "Discard <name>" for each matching hand card (ascending cost, then hand order), then "Gain a Wound" only while the Wound supply is non-empty. Default 0.
- **Corrupted** (pass 1 clockwise, pass 2 ascending):
  - Same option order, then "Discard down to 3 cards". Default 0.
  - Hand ≤3 → logged, not addressed (the free "down to 3").
  - Hand >3 with no match → discard `selectDiscardToLimitCards(G, hand, hand.length - 3)` through `discardFromHand`.
- **Imprison** (active):
  - Condition: has a strength or instinct Hero (hand + inPlay) AND `getEligibleVictoryVillains(G, seat)` is non-empty (Henchmen in, defeated Killbots out).
  - Options: "KO <name> — draw <VP>" for each, in Victory-Pile order, then "Don't KO". Default last.
  - VP = `victoryPointValueForCard(G, seat, id)` (the shared scoring mirror, dynamic VP included), read before the card leaves the pile, floored at 0. Draw-safe with an undefined shuffle context.
  - KO → `G.ko`, then `drawCardsIntoHand(zones, VP, shuffleContext)`; the cards drawn add to `turnEconomy.cardsDrawn` (D-24732).
- **Demonic** (active):
  - Each "if you have" is read when its sentence resolves (R-9).
  - Options: "KO <name> from <zone>" for each **Hero in hand + inPlay only** (never discard, never a Wound), one per (zone, card id) with `sourceZone`, then "Don't KO". Default last. A KO calls `koCard` + `recordOwnedCardKoed`.
  - Has a Ranged Hero → `-first`; the chain re-checks for a Strength Hero and, if one remains, parks `-last` after an accept or a decline. A timeout does not chain.
  - No Ranged Hero, has a Strength Hero → `-last`. Neither → nothing.
- **Every kind:** a builder with no addressed seat (or no option besides the decline) returns `undefined`; nothing parks.
- Accepted residual: Eruption seats choosing "Gain a Wound" beyond the supply at apply time gain nothing (logged, D-24770 RS-1 precedent).

## Guardrails
- Never modify WP-757's contract. The selector, the class helper and the strike resolver live in the new `mastermind/zarathos.logic.ts` and are not exported from `index.ts`.
- `zarathosHauntHighestCost` is a logged no-op while `isMastermindHaunting(G)`, for both the strike and tactic callers. Never create a second Mastermind haunter.
- Reuse `SeatChoiceOption.cardId` (and `sourceZone` for Demonic) for the Discard/KO options, and update both why-comments in `types.ts` (comment-only).
- "Each other player" skips the defeater. Sequential passes are clockwise from the current player (D-24780); simultaneous applies are ascending.
- No edit to `applySeatChoiceTimeoutDefault`. Each builder sets `defaultOptionIndex`: 0 for the multi-seat kinds, the last option for the "may" kinds.
- Parks go through `parkSeatChoice(G, events, choice)` for the multi-seat kinds and `parkSeatChoice(G, events, choice, currentPlayer)` for the active-seat kinds (D-24648).
- No RNG beyond the draw reshuffle. Moves never throw. No `.reduce()`.
- No `apps/*` change. Autoplay already drains non-active seat choices (D-24590).

## Required `// why:` Comments
- Wound-before-haunt order and the skip-when-haunting rule (D-24588).
- The lowest-index tie-break and the class OR filter (D-24588).
- Corrupted Spirit's hand ≤3 auto-resolve and the discard-count argument.
- Henchmen count as Villains for Imprison.
- Demonic hand + inPlay only (rules v23 ~L3439), and each "if you have" read when its sentence resolves (rules v23 L3443-3447).
- The `-first` → `-last` chain, with no chain on timeout.
- Each `defaultOptionIndex` choice.

## Files to Produce
- `packages/game-engine/src/mastermind/zarathos.logic.ts` + `zarathos.logic.test.ts` — **new**
- `types.ts` — **modified** (comment-only, `SeatChoiceOption.cardId` and `sourceZone`)
- `rules/mastermindHandlers.ts` + test — **modified**
- `rules/tacticHandlers.ts` + test — **modified**
- `moves/seatChoiceTactics.ts` + test — **modified**
- `moves/seatChoice.resolve.ts` + test — **modified**
- `moves/fightMastermind.test.ts` — **modified** (end-to-end case)
- `simulation/seatChoiceDispatch.test.ts` — **modified** (≥2-player Zarathos sim; R-11)
- `rules/mastermindStrike.unresolved.test.ts` — **modified** (checked-row pin 14 → 15; R-10)
- `hero/ownedCardKoTrigger.test.ts` — **modified** (two classified KO-site rows; R-12)
- `scripts/coverage/tactic-provenance.json` — **modified** (4 entries)
- `scripts/coverage/strike-provenance.json` — **modified** (1 entry, R-6)
- `data/metadata/effect-implementation-index.json` — **regenerated**

## After Completing
- [ ] `pnpm -r build` exits 0. The engine suite passes. `pnpm -r --no-bail test` has 0 failures.
- [ ] `effect-index:check`, `sim:runtime-observed:check` and `sim:coverage --check` all exit 0. The four tactics and the Master Strike show as implemented.
- [ ] `finalStateHash` is unchanged, or re-pinned honestly with a dual re-pin.
- [ ] D-24588 Active. `STATUS.md` updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026), human-driven, recorded as a post-deploy STATUS-flip.

## Common Failure Smells
- A tactic does nothing → its id doesn't match the built id.
- The first strike wounds everyone → the haunt ran before the wound check.
- The strike still logs a `master-strike` hollow → the arm is unreached, or the provenance row is missing.
- A seat with an empty Wound supply is offered "Gain a Wound" → the supply check ran before the auto-Wound pass, or not at all.
- The sim is flagged stuck → WP-749 is not in, or a builder left `defaultOptionIndex` unset.
- The defeater gets the Eruption prompt → the "other" filter is missing.
- Corrupted Spirit discards exactly 3 cards → the limit was passed instead of the count.
- Imprison on a no-printed-VP Villain draws 0 → the `?? 0` fallback was used instead of the scoring fallback.
- Demonic lists discard-pile cards → the zones are wrong.
- The second Demonic KO is never offered → the chain is missing, or gated on accept.
- The second Demonic KO is offered after the only Strength Hero was KO'd → the chain skipped the re-check.
