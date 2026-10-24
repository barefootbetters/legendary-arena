# EC-865 — Flying Shield Block (Execution Checklist)

**Source:** docs/ai/work-packets/WP-827-flying-shield-block.md
**Layer:** Game Engine (reactive wound interception, turn boundary, bot) plus card-data marker and one arena-client heading

## Before Starting
- [ ] `gainWoundForPlayer` calls `checkDivingBlock` (returns `void`) and nothing else after the Wound lands (`board/wounds.logic.ts`); `applyDivingBlockResolvedSeatChoice` keeps a declined Wound with only a log line (`moves/divingBlock.logic.ts`).
- [ ] `game.ts` onMove calls `openDivingBlockSeatChoiceIfNeeded` after every move; onBegin and `applyOnBeginParity` carry the guarded per-turn deletes.
- [ ] `HERO_KEYWORDS` holds 78 entries (last `'out-of-time'`) unless WP-826 landed first (then 81); `WOUND_TIME_EXECUTED_KEYWORDS` is `['diving-block']`.
- [ ] The Flying Shield Block line in `data/cards/ca75.json` is unmarked and builds an empty hook.
- [ ] The drafting scaffold patch is evidence only; re-author from Locked Values and the Test Contract.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] Rebuild first (a stale `dist` is not the baseline). `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm --filter @legendary-arena/dashboard typecheck` → 0; record the engine test total.

## Locked Values (do not re-derive)
- **Keyword**: `'flying-shield-block'`, appended as the last member of the `HeroKeyword` union and `HERO_KEYWORDS` (after `'out-of-time'` at baseline; after `'optional-ko-shield-played-rescue'` if WP-826 lands first; the ordered array in `rules/heroAbility.setup.test.ts` follows), 78 → 79 (N → N+1 governs), and in `WOUND_TIME_EXECUTED_KEYWORDS` after `'diving-block'`. No `HERO_EFFECT_HANDLERS` entry; not in `HANDLED_KEYWORDS` or `NO_MAGNITUDE_KEYWORDS`.
- **Types** (`types.ts`): `PendingFlyingShieldBlockWound { recipientID: string; woundCardId: CardExtId; candidateSeats: string[]; addressedSeat?: string }`; `LegendaryGameState.pendingFlyingShieldBlockWounds?: PendingFlyingShieldBlockWound[] | undefined`; `LegendaryGameState.flyingShieldBlockUsedThisTurn?: CardExtId[] | undefined`.
- **Module** `moves/flyingShieldBlock.logic.ts`:
  - `FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND = 'flying-shield-block'`; `FLYING_SHIELD_BLOCK_REVEAL_OPTION_INDEX = 0`; decline index 1; `defaultOptionIndex` = decline.
  - `cardCarriesFlyingShieldBlock(G, cardId)`: a hook of the card has the keyword.
  - `findRevealableFlyingShieldBlockCopy(G, seat)`: first copy in hand, then `inPlay`, not in `flyingShieldBlockUsedThisTurn`.
  - `checkFlyingShieldBlock(G, recipientID, woundCardId): boolean`: `candidateSeats` = the recipient (if it has a revealable copy), then every other seat with one, in ascending id; none → `false`; else push `{ recipientID, woundCardId, candidateSeats }` (lazy-init) and return `true`.
  - `openFlyingShieldBlockSeatChoiceIfNeeded(G, events, currentPlayer?)`: no-op when the queue is empty, a seat choice is open, or any Diving Block Wound is pending. Drops entries none of whose candidates can still reveal (log `Player ${recipientID} took the Wound (no Flying Shield Block was left to reveal).`). Then, for each entry in FIFO order, it addresses that entry's first candidate in `candidateSeats` order that can still reveal; if that seat is already addressed this wave, the entry waits for the next wave (it is never offered to a later candidate first), and stamps `addressedSeat` (so a seat is asked about one Wound per wave and an entry about one seat). The opener deletes `addressedSeat` from every entry before stamping; the apply deletes the stamp of every entry it resolves, reveal or decline; labels `Reveal Flying Shield Block: prevent your Wound and rescue a Bystander` / `Take the Wound` for the recipient, else `Reveal Flying Shield Block: prevent Player ${recipientID}'s Wound and rescue a Bystander` / `Let Player ${recipientID} take the Wound`. `parkSeatChoice(G, events, choice, currentPlayer)`.
  - `applyFlyingShieldBlockResolvedSeatChoice(G, choice)`: ascending seats; each resolves the entry stamped for it. Reveal → push the copy to `flyingShieldBlockUsedThisTurn` (lazy-init), move one `WOUND_EXT_ID` from the recipient's discard to `G.piles.wounds`, rescue `G.piles.bystanders[0]` into the revealer's Victory Pile, log (`'applied'`) `Player ${seat} revealed Flying Shield Block: prevented ${their own | Player N's} Wound and ${rescued a Bystander | could not rescue a Bystander (the supply is empty)}.` (both clauses built with if/else). If no Wound is in the recipient's discard any more (a reshuffle moved it), still mark the copy and rescue, and log `Player ${seat} revealed Flying Shield Block and rescued a Bystander (Player ${recipientID}'s Wound was no longer in their discard pile).` (the Diving Block not-found precedent). Reveal and decline are separate helpers so each function fits the ~30-line rule. Decline → remove the seat from `candidateSeats`; none left → log `Player ${recipientID} took the Wound (Flying Shield Block was not revealed).` and drop the entry. Delete the queue when empty.
- **Chokepoint**: `checkDivingBlock` returns `boolean` (true when it parked); `gainWoundForPlayer` calls `checkFlyingShieldBlock` only when it returned `false`.
- **Diving Block decline**: after its decline log, `applyDivingBlockResolvedSeatChoice` calls `checkFlyingShieldBlock(G, seat, woundEntry.woundCardId)`.
- **onMove**: `openFlyingShieldBlockSeatChoiceIfNeeded(G, events, ctx?.currentPlayer)` right after the Diving Block opener. **onBegin** and **`applyOnBeginParity`**: guarded `delete G.flyingShieldBlockUsedThisTurn`.
- **Dispatch**: `applySeatChoiceByKind` routes the kind to `applyFlyingShieldBlockResolvedSeatChoice` (after the Diving Block branch). **Bot**: `chooseByKind` returns the reveal index for the kind.
- **Drop and guard**: `dropAllPendingPlayerChoices` sets `pendingFlyingShieldBlockWounds = undefined` (alphabetical, after `pendingEscapeProcedures`); `ALL_PENDING_FIELDS` gains `'pendingFlyingShieldBlockWounds'` after `'pendingEscapeProcedures'`; `operatorSetters.logic.ts` treats a non-empty queue as owed.
- **Client heading**: `case 'flying-shield-block': return 'A player would gain a Wound — Flying Shield Block?';`, pinned by one case in `PendingSeatChoicePrompt.test.ts`.
- **Marker**: `VALID_TOKEN_PATTERN` gains `^\[keyword:flying-shield-block\]$`; `hero-ability-markers.json` `ca75` gains `{ "heroSlug": "captain-america-falcon", "cardSlug": "flying-shield-block", "abilityIndex": 0, "markupToken": "[keyword:flying-shield-block]" }` after the last Paramilitary Ops entry.
- **Provenance**: `"flying-shield-block": { "wp": "WP-827", "decision": "D-24760" }` as the last `mechanic-provenance.json` row.
- **Rebase**: on a rebase over WP-826, `ca75.json`, the marker map and the derived ledgers are regenerated through the regen chain, never hand-merged.

## Guardrails
- Card data is generated: edit the marker map, run `node scripts/convert-cards/apply-hero-ability-markers.mjs` (expect 1 line updated); never hand-edit `ca75.json`.
- Diving Block is unchanged when no Flying Shield Block is on the table; existing Diving Block, seat-choice, wound and parity tests pass unedited.
- One Wound, one open interception: Flying Shield Block parks only when Diving Block did not, or after a Diving Block decline; its wave waits while any Diving Block Wound is pending.
- Both `G` fields are lazily created and deleted when empty / at turn start; never in `Game.setup`.
- The once-per-turn reset lands in `game.ts` onBegin AND `applyOnBeginParity`.
- No new move, no UIState field; the seat choice rides `resolveSeatChoice` and the existing projection.
- Regenerate only what a `:check` reports stale; hash oracles byte-identical, else STOP.

## Required `// why:` Comments
- The keyword union / array / wound-time set entries: WP-827 / D-24760, the printed line, wound-time executed (no handler).
- The chokepoint branch and the Diving Block decline chain: one interception per Wound, recipient's Diving Block first.
- `findRevealableFlyingShieldBlockCopy`: hand or played this turn (D-24651); once per turn per copy.
- The wave opener's Diving Block wait and the `addressedSeat` stamp; the decline default.
- The reveal: undoing the landed Wound + rescuing equals "rescue a Bystander instead"; the empty-supply case.
- Each new `G` field (lazy, runtime-only); the onBegin and parity deletes; the bot's always-reveal.

## Files to Produce
- `packages/game-engine/src/moves/flyingShieldBlock.logic.ts` + `flyingShieldBlock.logic.test.ts` — **new** (F1-F16, F12b)
- `packages/game-engine/src/types.ts`, `board/wounds.logic.ts`, `moves/divingBlock.logic.ts`, `game.ts`, `simulation/onBeginParity.ts`, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts`, `endgame/mastermindVictory.logic.ts` + test, `moves/operatorSetters.logic.ts`, `rules/heroKeywords.ts` + test, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.ts` — **modified**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `PendingSeatChoicePrompt.test.ts` — **modified** (one heading, one case)
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/coverage/mechanic-provenance.json` — **modified**; `data/cards/ca75.json` — **regenerated**
- If stale: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (totalObs pin)
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-827-flying-shield-block.md` — **modified / new** (governance close)

## After Completing
- [ ] F1-F16 and F12b pass (waves opened through the live `turn.onMove`); the client heading case passes; the keyword pins read N+1; `ALL_PENDING_FIELDS` lists the queue; engine delta +17 tests / +4 suites.
- [ ] Revert proofs: baseline `ca75.json` (`git restore --source "$(git merge-base HEAD origin/main)" -- data/cards/ca75.json`) fails F1-F8, F10-F16; no chokepoint call fails F2-F6, F10, F11, F13-F15; no Diving Block decline chain fails F8; no parity delete fails F12; no game.ts onMove opener fails F2; no game.ts onBegin delete fails F12b; an unconditional chokepoint call fails F8 and F9; a `candidateSeats` lookup instead of the stamp: record F15; each restored.
- [ ] Regen chain, in order: `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `pnpm -r build` → provenance row → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → `pnpm sim:runtime-observed` (+ dashboard `prebuild:coverage` and totalObs re-pin only if the feed moved); each step only if its `:check` reports stale after the prior step.
- [ ] `cards:check`, `cards:count-markers:check`, `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `gauntlet:loadouts:check`, `sim:runtime-observed:check`, `sim:coverage --check` → 0; arena-client `typecheck` → 0; if the feed moved, dashboard `test:coverage`, `typecheck`, `format:check` → 0 (only `totalObs` changed).
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.
- [ ] D-24760 Active; 01.6 post-mortem WP COMPLETE; STATUS updated; WORK_INDEX `[x]` with date; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Allowlist-only diff (revert `lagn-v1.json` CRLF churn). Two-commit topology `EC-865:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: a 2-player operator match created after the deploy (gitSha checked) where your Flying Shield Block stops the bot's Wound and rescues for you, a second Wound that turn gets no prompt, on your next turn your own Wound offers "prevent your Wound", and on the bot's turn a Master Strike that wounds everyone asks you (non-active) about your Wound, then (after a decline) about the bot's, and resolves with no reload.

## Common Failure Smells
- A Wound gets two prompts (Diving Block and Flying Shield Block at once) → the chokepoint parked both, or the FSB wave did not wait for the Diving Block queue.
- The prompt appears for a second Wound in the same turn with one copy → the reveal did not record the copy, or the opener does not drop uninterceptable Wounds.
- F12 / F12b pass with a delete removed → the test does not prove the used list is cleared at the next turn (drive the real onBegin / parity function).
- The wrong Wound is resolved when two seats are asked in one wave → the apply searched by candidate instead of the `addressedSeat` stamp.
- The prompt heading reads "Your choice" → the client case is missing.
- The setter panel refuses every action after a Wound → the onMove opener is missing, so the queue never opens.
