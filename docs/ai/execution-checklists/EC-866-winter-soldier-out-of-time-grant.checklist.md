# EC-866 — Winter Soldier 2>4 Man Out of Time Grant (Execution Checklist)

**Source:** docs/ai/work-packets/WP-828-winter-soldier-out-of-time-grant.md
**Layer:** Game Engine (grant queue + seat choice, play core, turn boundary, bot) plus card-data markers and one arena-client heading

## Before Starting
- [ ] `heroEffectOutOfTime` runs its three guards and is registered as `'out-of-time'` in `NO_MAGNITUDE_KEYWORDS`; `executeSingleEffect` is exported (`hero/heroEffects.execute.ts`).
- [ ] `applyCardPlay` ends with `executeHeroEffects` (`moves/coreMoves.impl.ts`); `replayOutOfTimeCards` replays through it.
- [ ] The two 2>4 lines in `data/cards/ca75.json` are unmarked and leave an unresolved `man-out-of-time` marker; `OUT_OF_TIME_LINE_PATTERN` does not match them.
- [ ] `HERO_KEYWORDS` 78 / handlers 61 at baseline (81 / 64 if WP-826 landed, 79 / 61 if WP-827 landed, …: N+1 / M+1 governs).
- [ ] The drafting scaffold patch is evidence only; re-author from Locked Values and the Test Contract.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] Rebuild first (a stale `dist` is not the baseline). `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm --filter @legendary-arena/dashboard typecheck` → 0; record the engine test total.

## Locked Values (do not re-derive)
- **Keyword**: `'grant-out-of-time'`, appended as the last member of the `HeroKeyword` union and `HERO_KEYWORDS` (N → N+1; 78 → 79 at baseline), in `HANDLED_KEYWORDS`, in `NO_MAGNITUDE_KEYWORDS`, and in `HERO_EFFECT_HANDLERS` (M → M+1; 61 → 62) as `heroEffectGrantOutOfTime`, which calls `queueOutOfTimeGrant(G, playerID, cardId)`.
- **Types** (`types.ts`): `PendingOutOfTimeGrant { playerID: string; sourceCardId: CardExtId }`; `LegendaryGameState.pendingOutOfTimeGrants?: PendingOutOfTimeGrant[] | undefined`; `LegendaryGameState.outOfTimeGrantedThisTurn?: CardExtId[] | undefined`.
- **Module** `moves/outOfTimeGrant.logic.ts`:
  - `OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND = 'out-of-time-grant'`.
  - `queueOutOfTimeGrant(G, playerID, sourceCardId)`: push `{ playerID, sourceCardId }` (lazy-init).
  - Eligible = the player's hand cards in hand order, excluding `WOUND_EXT_ID` and `BYSTANDER_EXT_ID` (the engine's "not a Hero" discriminant), cards in `outOfTimeGrantedThisTurn`, and duplicates.
  - `openOutOfTimeGrantSeatChoiceIfNeeded(G, events, currentPlayer?)`: no-op when the queue is absent, `G.pendingSeatChoice` is set, `hasAnyPendingChoice(G)` is true, `G.pendingHeroChoice` is set, or `evaluateEndgame(G) !== null` (the escape-opener precedent). Front to back: ≥ 2 eligible → `parkSeatChoice` a one-seat choice (options `{ label: resolveCardName(…), cardId }` in hand order, `defaultOptionIndex: 0`) and stop; exactly 1 → grant it and pop; 0 → log (`'neutral'`) `Player ${playerID} has no Hero left in hand to gain Man Out of Time (${source}).` and pop. Delete the queue when empty. The eligible collector and the grant are named helpers.
  - Grant: push the card to `outOfTimeGrantedThisTurn` (lazy-init) and log (`'applied'`) `Player ${playerID}'s ${card} gains Man Out of Time this turn (${source}).`
  - `applyOutOfTimeGrantResolvedSeatChoice(G, choice)`: the chosen option's `cardId`, if still in the seat's hand, is granted; pop the front entry; delete the queue when empty.
  - `applyGrantedOutOfTime(G, context, playerID, cardId)`: when the card is in `outOfTimeGrantedThisTurn`, not in `turnEconomy.outOfTimePlayedCardIds`, and still the last card of the player's `inPlay`, call `executeSingleEffect(G, context, playerID, cardId, { type: 'out-of-time' })`; otherwise return silently.
- **Play core**: `applyCardPlay` calls `applyGrantedOutOfTime(G, context, playerID, cardId)` right after `executeHeroEffects`.
- **onMove**: `openOutOfTimeGrantSeatChoiceIfNeeded(G, events, ctx?.currentPlayer)` right after the Diving Block opener (after the Flying Shield Block opener if WP-827 landed first). **onBegin** and **`applyOnBeginParity`**: guarded deletes of `outOfTimeGrantedThisTurn` and `pendingOutOfTimeGrants`.
- **Dispatch**: `applySeatChoiceByKind` routes the kind to `applyOutOfTimeGrantResolvedSeatChoice`. **Bot**: `chooseByKind` returns the index of the option whose `cardId` has the highest `cardStats` cost (first on a tie).
- **Drop and guard**: `dropAllPendingPlayerChoices` sets `pendingOutOfTimeGrants = undefined` (after `pendingOptionalPutBottomHQ`); `ALL_PENDING_FIELDS` gains `'pendingOutOfTimeGrants'` in the same place; `operatorSetters.logic.ts` treats a non-empty queue as owed, pinned by a `GATE_BLOCKERS` row `pendingOutOfTimeGrants is non-empty` in `moves/operatorSetters.test.ts`.
- **Comments**: `setup/heroAbility.setup.ts` L139-140 and L434-436 say the 2>4 lines resolve `grant-out-of-time` (from `[keyword:grant-out-of-time]`), not that the probe still flags them.
- **Client heading**: `case 'out-of-time-grant': return 'Choose a Hero in your hand to gain Man Out of Time this turn';`, pinned by one case in `PendingSeatChoicePrompt.test.ts`.
- **Marker**: `VALID_TOKEN_PATTERN` gains `^\[keyword:grant-out-of-time\]$`; `hero-ability-markers.json` `ca75` gains `{ "heroSlug": "winter-soldier", "cardSlug": "2-4", "abilityIndex": 0, "markupToken": "[keyword:grant-out-of-time]" }` and the same with `abilityIndex: 1`, after the last Paramilitary Ops entry (after the other packets' rows if they landed first).
- **Ledger comment**: the `BY_HOOK_KEYWORDS` comment in `scripts/hero-mechanic-ledger.mjs` says 2>4's grant lines resolve `grant-out-of-time`, folded into the same `out-of-time` row (replacing "2>4 stays a runtime hollow"). No `mechanic-provenance.json` row.
- **Rebase**: over WP-826 / WP-827, `ca75.json`, the marker map and the derived ledgers are regenerated through the regen chain, never hand-merged.

## Guardrails
- Card data is generated: edit the marker map, run `node scripts/convert-cards/apply-hero-ability-markers.mjs` (expect 2 lines updated); never hand-edit `ca75.json`.
- Out of Time is unchanged for cards that print it; WP-803's tests pass unedited; the set-aside is the existing handler with its guards.
- Both `G` fields are lazily created and deleted at turn start in `game.ts` onBegin AND `applyOnBeginParity`; never in `Game.setup`.
- Tests open owed grants through the LIVE `turn.onMove` and check the reset through the live `turn.onBegin`.
- No new move and no UIState field; the choice rides `resolveSeatChoice` and the existing projection.
- Regenerate only what a `:check` reports stale after a rebuild; hash oracles byte-identical, else STOP.

## Required `// why:` Comments
- The keyword union / array / set entries: WP-828 / D-24761, the printed line, queues one owed grant, no magnitude.
- `queueOutOfTimeGrant`: why the grant is not chosen inside the play ("Another Hero").
- The opener: one grant at a time; auto with one; the mandatory timeout default.
- `applyGrantedOutOfTime`: reuse of the WP-803 handler and its guards; the silent skip for a card already Out of Time.
- The `applyCardPlay` call, the onMove placement, the onBegin / parity deletes, the bot's highest-cost pick.
- The dashboard re-pin: dated, the feed delta, the mechanic that left, the unchanged resolvedObs / percent.

## Files to Produce
- `packages/game-engine/src/moves/outOfTimeGrant.logic.ts` + `outOfTimeGrant.logic.test.ts` — **new** (W1-W15)
- `packages/game-engine/src/types.ts`, `hero/heroEffects.execute.ts` + test, `moves/coreMoves.impl.ts`, `game.ts`, `simulation/onBeginParity.ts`, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts`, `endgame/mastermindVictory.logic.ts` + test, `moves/operatorSetters.logic.ts` + `operatorSetters.test.ts`, `rules/heroKeywords.ts` + test, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.ts` (comments only) + test — **modified**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `PendingSeatChoicePrompt.test.ts` — **modified** (one heading, one case)
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/hero-mechanic-ledger.mjs` (one comment) — **modified**; `data/cards/ca75.json` — **regenerated**
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**; `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **modified** (totalObs pin); if stale: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-828-winter-soldier-out-of-time-grant.md` — **modified / new** (governance close)

## After Completing
- [ ] W1-W15 pass (owed grants opened through the live `turn.onMove`); the client heading case and the new `GATE_BLOCKERS` row pass; the pins read N+1 / M+1; `ALL_PENDING_FIELDS` lists the queue; engine delta +21 tests / +4 suites (15 from the new file, 6 from the gate row).
- [ ] Revert proofs: baseline `ca75.json` (`git restore --source "$(git merge-base HEAD origin/main)" -- data/cards/ca75.json`) fails W1-W8, W10; no `applyCardPlay` call fails W8; no onMove opener fails W2-W8, W10; no onBegin deletes fails W12; no parity deletes fails W11; no already-granted exclusion fails W4, W5; no `outOfTimePlayedCardIds` skip fails W13; no setter-guard line fails the new `GATE_BLOCKERS` row; no last-in-play check fails W14; either wait (`pendingHeroChoice`, or `hasAnyPendingChoice`) removed alone fails W15; no `applySeatChoiceByKind` route fails W3, W4; no `chooseByKind` case fails W7; each restored.
- [ ] Regen chain, in order: `node scripts/convert-cards/apply-hero-ability-markers.mjs` → `pnpm -r build` → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → `pnpm sim:runtime-observed` → `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` + totalObs re-pin; each step only if its `:check` reports stale after the prior step.
- [ ] `cards:check`, `cards:count-markers:check`, `ledger:heroes:check`, `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `gauntlet:loadouts:check`, `sim:runtime-observed:check`, `sim:coverage --check` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm --filter @legendary-arena/dashboard run test:coverage`, `pnpm --filter @legendary-arena/dashboard typecheck`, `pnpm --filter @legendary-arena/dashboard run format:check` → 0 (only `totalObs` changed; `distinctMechanics` down by exactly one).
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.
- [ ] D-24761 Active; 01.6 post-mortem WP COMPLETE; STATUS updated; WORK_INDEX `[x]` with date; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Allowlist-only diff (revert `lagn-v1.json` CRLF churn). Two-commit topology `EC-866:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: a 2-player operator match created after the deploy (gitSha checked) where 2>4's prompt lists your hand Heroes, the picked Hero is set aside after play and replays next turn, and with [hc:tech] the second prompt leaves out the first pick.

## Common Failure Smells
- 2>4 itself goes Out of Time → `OUT_OF_TIME_LINE_PATTERN` matched the grant line, or the marker is `[keyword:out-of-time]`.
- The second prompt lists the first pick → the already-granted exclusion is missing.
- A granted card is logged "not set aside again" → the `outOfTimePlayedCardIds` skip is missing (its own keyword already set it aside).
- The granted card plays and stays in play → the `applyCardPlay` call is missing, or the grant list was cleared before the play.
- A grant from last turn still applies → an onBegin / parity delete is missing.
- The heading reads "Your choice" → the client case is missing.
