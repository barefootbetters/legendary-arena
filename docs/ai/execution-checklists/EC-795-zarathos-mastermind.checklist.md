# EC-795 — Zarathos Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-758-zarathos-mastermind.md
**Layer:** Game Engine

## Before Starting
- [ ] WP-757 is merged: `hauntHqSlot`, `isMastermindHaunting` and `isHqSlotHaunted` are exported from `board/haunt.logic.ts`. The `fightMastermind` haunting guard is live, and D-24587 is Active.
- [ ] WP-749 is merged: the sim/PAR loops resolve an open `pendingSeatChoice` for each outstanding addressed seat at `defaultOptionIndex`.
- [ ] `mastermindStrikeHandler` still has the ~1204 chain. `resolveCurrentPlayer`, `gainWoundToDiscard` and `selectDiscardToLimitCards(G, cards, discardCount)` still exist, with the third argument being a discard **count**.
- [ ] Tactic ids are built at `mastermind.setup.ts:279`. `dispatchTacticOnFight(G, ctx, id, shuffleContext, events?)` exists.
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
- Hero class source: `G.cardTraits[id].heroClass` / `heroClass2`, plus `cardHasClassWhenPlayed` for in-play cards.
- Highest-cost selector:
  - candidates are unhaunted, non-null slots, costed by `cardStats` cost;
  - a class filter matches class A OR class B, and a dual-class card counts once;
  - ties go to the lowest index;
  - no match → logged no-op.
- Strike order:
  1. Wound check: any non-null haunted slot, either kind.
  2. Each player takes a Wound, in ascending order, via `gainWoundForPlayer` (`board/wounds.logic.ts:70`). `zarathos.logic.ts` never imports `mastermindHandlers` (no cycle).
  3. Haunt, unless `isMastermindHaunting`.
  4. The generic `captureBystanderOntoMastermind` stays untouched.
- Kinds: `zarathos-eruption`, `zarathos-corrupted-spirit`, `zarathos-imprison`, `zarathos-demonic-essence-first`, `zarathos-demonic-essence-last`.
- **Eruption:**
  - Options: "Discard <name>" for each matching hand card (ascending cost, then hand order), then "Gain a Wound". Default 0.
  - A seat with no match auto-Wounds.
- **Corrupted:**
  - Same option order, then "Discard down to 3 cards". Default 0.
  - Hand ≤3 → nothing happens.
  - Hand >3 with no match → discard `selectDiscardToLimitCards(G, hand, hand.length - 3)`.
- **Imprison** (active):
  - Condition: has a strength or instinct Hero (hand + inPlay) AND ≥1 card in the Victory Pile with `villainDeckCardTypes[id] ∈ {'villain','henchman'}`.
  - Options: "KO <name> — draw <VP>" for each, then "Don't KO". Default last.
  - VP = `G.cardVictoryPoints?.[id]`, else `VP_HENCHMAN` for a henchman and `VP_VILLAIN` for a villain (explicit `if`, mirroring `scoring.logic.ts:136-138`). Draw-safe with an undefined shuffle context.
  - KO → `G.ko`, then `drawCardsIntoHand(zones, VP, shuffleContext)`.
- **Demonic** (active):
  - Owed = ranged?1:0 + strength?1:0, evaluated once.
  - Options: "KO <name>" for each **Hero in hand + inPlay only** (never discard), then "Don't KO". Default last.
  - Owed 2 → `-first`, which chains `-last` after accept or decline; a timeout does not chain.
  - Owed 1 → `-last`.

## Guardrails
- Never modify WP-757's contract. The selector, the class helper and the strike resolver live in the new `mastermind/zarathos.logic.ts` and are not exported from `index.ts`.
- `zarathosHauntHighestCost` is a logged no-op while `isMastermindHaunting(G)`, for both the strike and tactic callers. Never create a second Mastermind haunter.
- Reuse `SeatChoiceOption.cardId` for the Discard/KO options, and update its why-comment in `types.ts` (comment-only).
- "Each other player" skips the defeater. Apply order is ascending seat.
- No edit to `applySeatChoiceTimeoutDefault`. Each builder sets `defaultOptionIndex`: 0 for the multi-seat kinds, the last option for the "may" kinds.
- Parks go through `parkSeatChoice(G, events, choice)`, following Monarch's Decree.
- No RNG beyond the draw reshuffle. Moves never throw. No `.reduce()`.
- No `apps/*` change. The autoplay non-active-seat gap is out of scope; do not fix it here.

## Required `// why:` Comments
- Wound-before-haunt order and the skip-when-haunting rule (D-24588).
- The lowest-index tie-break and the class OR filter (D-24588).
- Corrupted Spirit's hand ≤3 auto-resolve and the discard-count argument.
- Henchmen count as Villains for Imprison.
- Demonic hand + inPlay only (rules v23 ~L3439), and the owed count evaluated once.
- The `-first` → `-last` chain, with no chain on timeout.
- Each `defaultOptionIndex` choice.

## Files to Produce
- `packages/game-engine/src/mastermind/zarathos.logic.ts` + `zarathos.logic.test.ts` — **new**
- `types.ts` — **modified** (comment-only, `SeatChoiceOption.cardId`)
- `rules/mastermindHandlers.ts` + test — **modified**
- `rules/tacticHandlers.ts` + test — **modified**
- `moves/seatChoiceTactics.ts` + test — **modified**
- `moves/seatChoice.resolve.ts` + test — **modified**
- `moves/fightMastermind.test.ts` — **modified** (end-to-end case)
- `simulation/simulation.runner.test.ts` — **modified** (≥2-player Zarathos sim)
- `scripts/coverage/tactic-provenance.json` — **modified** (4 entries)
- `data/metadata/effect-implementation-index.json` — **regenerated**

## After Completing
- [ ] `pnpm -r build` exits 0. The engine suite passes. `pnpm -r --no-bail test` has 0 failures.
- [ ] `effect-index:check`, `sim:runtime-observed:check` and `sim:coverage --check` all exit 0. The four tactics show as implemented.
- [ ] `finalStateHash` is unchanged, or re-pinned honestly with a dual re-pin.
- [ ] D-24588 Active. `STATUS.md` updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026), human-driven, recorded as a post-deploy STATUS-flip.

## Common Failure Smells
- A tactic does nothing → its id doesn't match the built id.
- The first strike wounds everyone → the haunt ran before the wound check.
- The sim is flagged stuck → WP-749 is not in, or a builder left `defaultOptionIndex` unset.
- The defeater gets the Eruption prompt → the "other" filter is missing.
- Corrupted Spirit discards exactly 3 cards → the limit was passed instead of the count.
- Imprison on a no-printed-VP Villain draws 0 → the `?? 0` fallback was used instead of the scoring fallback.
- Demonic lists discard-pile cards → the zones are wrong.
- The second Demonic KO is never offered → the chain is missing, or gated on accept.
