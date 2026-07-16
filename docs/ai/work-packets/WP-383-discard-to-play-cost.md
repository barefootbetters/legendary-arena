# WP-383 — `discard-to-play` Hero Card Cost (mandatory "discard a card to play this card")

## Goal

Certain hero cards print *"To play this card, you must discard a card from
your hand."* (Cyclops's **Determination** and **Optic Blast** in the core
set, plus ~4 siblings across other sets). Today that text carries no keyword
marker and no engine handler, so the discard cost is **silently skipped** —
the player pockets the card's printed recruit/attack for free. This WP makes
the cost faithful: playing such a card **requires** the player to discard
another card from hand (player-chosen via a prompt), and the play is
**blocked** when the player has no other card to discard. Engine + arena
client, one cross-layer WP.

## Assumes

- Baseline: `origin/main` @ `aaaa5c95` (WP-382 / EC-411 landed; working tree clean).
- **WP-353-era pending-choice infrastructure** — the mandatory, no-decline
  pending-choice pattern is established by `return-zero-cost-discard`
  (D-24139): `PendingReturnZeroCostDiscard` (`types.ts`), the park handler
  (`heroEffects.execute.ts`), `resolveReturnZeroCostDiscard` move, the
  `UIPendingReturnZeroCostDiscard` projection (`uiState.build.ts` /
  `uiState.filter.ts`), and `ReturnZeroCostDiscardPrompt.vue`. This WP mirrors
  that end-to-end.
- **The playCard commit sequence** — `applyCardPlay` (`coreMoves.impl.ts`)
  appends the card to `inPlay`, adds base attack/recruit, then fires hero
  abilities *last*. No card currently gates its own play; every existing
  pending choice fires **after** the card has committed. This WP adds the
  engine's **first pre-commit, card-specific precondition** (see §Contract).
- **The keyword substrate** — `HeroKeyword` union + `HERO_KEYWORDS` array
  (`heroKeywords.ts`); the generic 2-segment `[keyword:X:N]` parser arm
  (`heroAbility.setup.ts`); the marker pipeline
  (`apply-hero-ability-markers.mjs` + `inputs/hero-ability-markers.json`).
- **Move-registration drift** — a new boardgame.io move must also update
  `game.test.ts` (move-set list + count) and `ai.legalMoves.ts`
  (`SIMULATION_MOVE_NAMES` + the forced-resolve short-circuit).
- WP-017 `moveCardFromZone` (`zoneOps.ts`); the block-all-pending guard
  cluster on every action move.

## Context

Surfaced in the Red Skull live game (2026-07-15, gitSha `aaaa5c9`): Player 0
played Optic Blast (+3 attack) and Determination (+3 recruit) repeatedly (log
lines 98, 105, 174, 214, 241…) and **never discarded** — the printed cost was
free. Corpus-wide, ~6 cards across sets print this mandatory discard cost and
**zero are implemented**. This makes every "discard to play" card strictly
stronger than printed — a fairness/faithfulness gap, not cosmetic.

**Why one cross-layer WP (not a split):** the mechanic is a single cohesive
unit — a pre-commit precondition + a mandatory pending discard + its prompt —
that is meaningless split across a layer boundary (an engine-only half would
ship an unpromptable pending choice; a client-only half has nothing to
render). This mirrors the WP-380/WP-381 single-cross-layer precedent for the
same pending-choice family. Engine-first commit order (client typechecks
against the built engine dist).

**Design decision — the hybrid (locked by Jeff, 2026-07-15):** faithful =
*mandatory + client prompt*. The player must be able to pay (blocked
otherwise) and chooses which card to pitch. This forces the engine's first
pre-commit card-specific precondition, because the onPlay hook fires only
*after* commit — too late to veto an unpayable play or withhold the base
power. See §Contract.

## Scope (In)

- New `HeroKeyword` `'discard-to-play'` (union + `HERO_KEYWORDS` array,
  lockstep) — a **play-cost prerequisite** keyword. Marker token
  `[keyword:discard-to-play:<n>]` where `n` = number of cards to discard
  (all marked cards use `1`).
- **Pre-commit precondition in `playCard`** (`coreMoves.impl.ts`): after the
  block-all-pending guards and **before** the hand removal / commit, if the
  card being played carries `discard-to-play` (scan
  `getHooksForCard(G.heroAbilityHooks, cardId)`), require the hand to hold
  `≥ n` *other* cards (i.e. `hand.length ≥ n + 1`, since the played card is
  still in hand at this point). Unpayable → early `return` (void; no commit,
  no power, card stays in hand). A `G.messages` line records the blocked play.
- **New pending variant** `PendingDiscardToPlay { playerID, sourceCardId,
  remaining }` (`types.ts`) + `G.pendingDiscardToPlay?: PendingDiscardToPlay[]`
  (FIFO array, lazy-init, never seeded in setup).
- **Park handler** `heroEffectDiscardToPlay` (`heroEffects.execute.ts`,
  registered in `HERO_EFFECT_HANDLERS` + `HANDLED_KEYWORDS`): parks the
  mandatory choice with `remaining = magnitude ?? 1`. (Payability is already
  guaranteed by the pre-commit precondition, so no re-check/no-op branch is
  needed at park time.)
- **New resolve move** `resolveDiscardToPlay` (`moves/resolveDiscardToPlay.ts`,
  `client: false` per D-10008): args `{ cardId }`; validates the front-of-queue
  entry belongs to the chooser and `cardId` is in the chooser's hand *now*;
  moves it hand→discard; decrements `remaining`, popping the queue entry when
  it reaches 0. Shared helpers exported: `hasPendingDiscardToPlay`,
  `getEligibleDiscardToPlayCards` (the chooser's whole current hand).
- **Block-all guards** — add `if (hasPendingDiscardToPlay(G)) return;` to every
  action move (drawCards / playCard / endTurn in `coreMoves.impl.ts`,
  `recruitHero`, `fightVillain`, `fightMastermind`, `healWounds`, `dodgeCard`,
  `playFromUndercover`) and the turn-cleanup guard in `game.ts`.
- **UIState projection** `UIPendingDiscardToPlay { playerID, sourceCardId,
  remaining, eligibleDiscardCards }` (`uiState.types.ts`), built from the FRONT
  entry with `eligibleDiscardCards` recomputed via the **imported**
  `getEligibleDiscardToPlayCards` (round-trip rule), chooser-only redaction in
  `uiState.filter.ts`.
- **Client prompt** `DiscardToPlayPrompt.vue` (clone of
  `ReturnZeroCostDiscardPrompt.vue`; source list = hand, no Decline button) +
  `PlayDesktop.vue` / `PlayMobile.vue` wiring + the `useTurnActions` End-Turn /
  Pass-Priority gate.
- **Marker rows** for the discard-to-play cards in
  `inputs/hero-ability-markers.json` + regenerated `data/cards/*.json`.
- Regenerated derived artifacts (`mechanics:metadata`, `ledger:heroes`,
  `sim:runtime-observed`) + drift-test updates (`game.test.ts` move-set,
  `heroAbility.setup.test.ts` keyword parity, UIState drift, `ai.legalMoves`).

## Scope (Out)

- **The reveal-N "put the rest back in any order" reorder choice** (The
  Amazing Spider-Man family, 26 cards) — a separate deferred gap; not this WP.
- **Client visual feedback for an unpayable play** — the engine no-ops an
  unpayable discard-to-play play (returns void); a grayed-card + tooltip on the
  hand card is deferred (rare edge: only when it is the player's last/near-last
  card). The prompt itself (the payable path) is in scope.
- **The one multi-discard card** (`ssw2/ruby-summers/extinction-blast` —
  *"discard three cards"*) — deferred to the marker map `_deferred`. The
  `remaining` counter supports `n > 1` structurally, but the 3-sequential-prompt
  resolve UX and its tests are out of scope for the first ship; the 5
  single-discard cards (the reported Cyclops pair + 3 siblings) are the target.
- The `"costs 2 vp or less"` reveal-render nit (a `[icon:vp]` display bug) —
  cosmetic, folded into whichever reveal WP touches it.
- No scoring / PAR / determinism-seed change; no new contract file.

## Files Expected to Change

**Engine:**
- `packages/game-engine/src/rules/heroKeywords.ts` — union + array
- `packages/game-engine/src/types.ts` — `PendingDiscardToPlay` + queue field
- `packages/game-engine/src/moves/coreMoves.impl.ts` — pre-commit precondition + block-all guard
- `packages/game-engine/src/hero/heroEffects.execute.ts` — park handler + registration
- `packages/game-engine/src/moves/resolveDiscardToPlay.ts` — **new** resolve move + shared helpers
- `packages/game-engine/src/game.ts` — register move (`client:false`) + cleanup guard
- `packages/game-engine/src/moves/{recruitHero,fightVillain,fightMastermind,healWounds,dodgeCard,playFromUndercover}.ts` — block-all guard
- `packages/game-engine/src/setup/heroAbility.setup.ts` — parser (only if the generic arm is insufficient; likely no change)
- `packages/game-engine/src/ui/uiState.types.ts` / `uiState.build.ts` / `uiState.filter.ts` — projection
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — `SIMULATION_MOVE_NAMES` + forced-resolve short-circuit
- Tests: `game.test.ts`, `heroKeywords.test.ts`, `heroAbility.setup.test.ts`, `resolveDiscardToPlay.test.ts` (**new**), `heroEffects.execute.test.ts`, `coreMoves.*.test.ts`, `uiState.*.test.ts`, `ai.legalMoves.test.ts`

**Client:**
- `apps/arena-client/src/components/play/DiscardToPlayPrompt.vue` — **new**
- `apps/arena-client/src/pages/{PlayDesktop,PlayMobile}.vue` — wiring
- `apps/arena-client/src/composables/useTurnActions.ts` — End-Turn gate
- arena-client tests + fixtures (UIState field add → fixture backfill, documented recurrence)

**Data:**
- `scripts/convert-cards/inputs/hero-ability-markers.json` — marker rows
- `data/cards/*.json` — regenerated
- `data/metadata/card-mechanics.json` + `docs/ai/coverage/*` — regenerated

## Contract

- **Move Validation Contract extension (D-24185).** `playCard` gains a
  **card-specific pre-commit precondition** — the engine's first. It runs
  after arg-validation + stage gate + block-all-pending guards and **before**
  the hand removal / `applyCardPlay` commit. On an unpayable discard-to-play
  card it returns `void` with no state mutation except a `G.messages` line.
  This does not violate "moves never throw" (it returns) and preserves the
  "validate → gate → mutate → void" order (the precondition is part of
  validation, before mutation). ARCHITECTURE.md §The Move Validation Contract
  gains a clause acknowledging card-specific preconditions.
- **The mechanic (D-24184).** `discard-to-play` is a mandatory play-cost. A
  payable play commits normally (card → `inPlay`, base attack/recruit granted),
  then parks `PendingDiscardToPlay`; all other moves are blocked until
  `resolveDiscardToPlay` pops it. Base power is granted at commit (payability
  pre-guaranteed, so the discard is inescapable) — faithful, since the play
  itself is what grants the power and the discard is its cost.
- **Determinism:** no `ctx.random`; `PendingDiscardToPlay` is JSON-serializable
  (strings + number). `G.pendingDiscardToPlay` is hashed (it is `G` state), so
  the sentinel/golden `finalStateHash` + `PRE_WP080_HASH` **re-pin only if** a
  recorded fixture plays a marked card — re-record via the canonical tool,
  never hand-edit.
- **UIState** is not hashed; the projection adds no hash surface. Chooser-only
  redaction (opponents/spectators get the field omitted).

## Acceptance Criteria

1. Playing Determination with ≥1 other card in hand parks a
   `PendingDiscardToPlay`; `resolveDiscardToPlay` moves the chosen card
   hand→discard and clears the queue; the +3 recruit is granted.
2. Playing a discard-to-play card as the **only** card in hand is a no-op
   (returns void, card stays in hand, no power granted, a `G.messages` line
   records the block).
3. While `PendingDiscardToPlay` is open, every other action move (draw, play,
   recruit, fight, heal, dodge, endTurn) is blocked.
4. `resolveDiscardToPlay` with a `cardId` not in the chooser's hand is a silent
   no-op (queue intact, resubmit).
5. The chooser's UIState carries `pendingDiscardToPlay` with the correct
   `eligibleDiscardCards`; opponents/spectators do not.
6. `DiscardToPlayPrompt.vue` renders one button per hand card (no Decline) and
   dispatches `resolveDiscardToPlay`; End Turn is gated while it is open.
7. Drift: `HERO_KEYWORDS` +1, move-set +1 (`game.test.ts`), `ai.legalMoves`
   forces exactly `resolveDiscardToPlay` while pending. All `:check` gates green.
8. `pnpm -r build` 0; engine test + arena-client typecheck (vue-tsc) + test all
   pass; sentinel re-pin only if a recorded fixture plays a marked card.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (incl. new
   `resolveDiscardToPlay.test.ts` + drift updates).
3. `pnpm --filter @legendary-arena/arena-client typecheck && … test` → pass.
4. `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check`
   + `roadmap:counts:check` → all 0.
5. Live-verify (D-24026, operator, post-deploy): play Optic Blast with a spare
   card → prompted to discard; play it as your last card → cannot (no free
   attack).

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-412:` impl + `SPEC:` govern-close): D-24184 +
  D-24185 landed Active; ARCHITECTURE.md Move Validation Contract clause added;
  STATUS / WORK_INDEX `[x]` / EC_INDEX Done / mindmap ✅ + counts.
- `git diff --name-only` matches the allowlist (+ regenerated data/artifacts +
  documented UIState-field-add fixture backfill).
- `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify
  operator-pending on deploy.

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):

- **§1 Goal / §2 Scope closed** — PASS (closed In/Out enumeration).
- **§3 Layer boundary** — PASS (engine + client; engine-first; no registry/pg
  reach; the pre-commit precondition stays in the engine move layer).
- **§4 Determinism** — PASS (no RNG; JSON-serializable pending; hash re-pin
  rule stated).
- **§5 Contract/data field names** — PASS (canonical `CardExtId`; no renamed
  fields).
- **§6 Move contract** — PASS (returns void; precondition is validation-phase;
  D-24185 documents the extension + ARCHITECTURE.md edit).
- **§7 Persistence** — N/A (no persistence; `G` runtime-only; pending is `G`
  state, not stored).
- **§8 Test discipline** — PASS (`.test.ts`; `makeMockCtx`; new resolve-move
  test + drift updates enumerated).
- **§9–§16** — PASS (naming full-words; `// why:` on the precondition + park +
  cleanup guards; no `.reduce()` in the hand scan).
- **§11 Auth / §21 HTTP endpoint** — N/A (no server endpoint; no auth surface).
- **§17 Determinism/sim** — PASS (sim-outcome cascade → regen runtime-observed;
  sentinel re-pin only if a recorded fixture plays a marked card;
  `ai.legalMoves` forced-resolve wired).
- **§18–§20** — PASS (drift tests: keyword parity, move-set, UIState).
- Reserves **D-24184** (mechanic) + **D-24185** (playCard pre-commit
  precondition / Move Validation Contract extension).
