# EC-867 — Go Back in Time Purge (Execution Checklist)

**Source:** docs/ai/work-packets/WP-829-go-back-in-time-purge.md
**Layer:** Game Engine (scheme resolver + Purge module, onMove, dispatch, bot, setter guard) plus one arena-client heading

## Before Starting
- [ ] The scheme's config is `resolverId: 'counter-only'` with the `pile-depleted` heroDeck loss (`rules/schemeTwistConfigs.ts`); `SchemeTwistResolverId` ends with `'counter-only'` (`rules/schemeTwistConfig.types.ts`).
- [ ] `game.ts` onMove runs the escape-procedure opener and then re-runs `latchFinalTurnIfDeckExhausted` / `applyPileDepletionResourceLoss`; the escape opener waits on `hasAnyPendingChoice(G) || G.pendingHeroChoice` and `evaluateEndgame(G)`.
- [ ] `schemeTwistConfigs.test.ts`' D-pure audit asserts `counter-only` for every pile-runout scheme.
- [ ] The drafting scaffold patch is evidence only; re-author from Locked Values and the Test Contract.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] Rebuild first. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine test total.

## Locked Values (do not re-derive)
- **Resolver id**: `'go-back-in-time'`, added to `SchemeTwistResolverId` before `'counter-only'` and registered in `SCHEME_TWIST_RESOLVERS` as `goBackInTime`. The scheme's config switches to `resolverId: 'go-back-in-time'`; `params: {}` and `resourceLossCondition` unchanged.
- **Resolver** `goBackInTime`: `queueTimestreamPurge(gameState, context.ctx.currentPlayer, twistCardId ?? UNKNOWN_TWIST_CARD_ID)`, log (`'threat'`) `[Go Back in Time] Player ${currentPlayer} must Purge a Hero in the HQ from the Timestream.`, and push the `schemeTwistResolved` notable event with `resolverKey: 'goBackInTime'` (the WP-823 lockstep).
- **Notable-event key**: `'goBackInTime'` appended to `SchemeTwistResolverKey` and `SCHEME_TWIST_RESOLVER_KEYS` (`events/notableEvents.types.ts`, ten → eleven), to both lists in `notableEvents.types.test.ts`, and to `RESOLVER_KEY_PHRASES` (`events/notableEvents.compose.ts`) as `'a Hero in the HQ must be Purged from the Timestream'`.
- **Types** (`types.ts`): `PendingTimestreamPurge { chooserPlayerID: string; twistCardId: CardExtId }`, placed with its own JSDoc ABOVE the `PendingDivingBlockWound` JSDoc (never between that JSDoc and its interface); `LegendaryGameState.pendingTimestreamPurges?: PendingTimestreamPurge[] | undefined`; `LegendaryGameState.purgedFromTimestream?: CardExtId[] | undefined`.
- **Module** `rules/timestreamPurge.logic.ts`:
  - `TIMESTREAM_PURGE_SEAT_CHOICE_KIND = 'timestream-purge'`.
  - `queueTimestreamPurge(G, chooserPlayerID, twistCardId)`: push (lazy-init).
  - `heroNameOf(cardId)`: the first two `/` segments, `{set}/{hero}`.
  - `sweepPurgedHeroesFromHq(G): number`: no-op (0) when nothing is Purged; else repeat full HQ passes, KO'ing (`koCard`) every HQ card whose `heroNameOf` matches a Purged card's and refilling its slot (`refillHqSlot`), logging (`'threat'`) `[Go Back in Time] ${card} was KO'd from the HQ: its Hero was Purged from the Timestream.`, until a pass KOs nothing; return the KO count.
  - **Text sources** (every log and label): `${card}` is `formatCardRef(G.cardDisplayData, cardId)`; an option label's name is `resolveCardName(G.cardDisplayData, cardId)` and its cost `String(G.cardStats[cardId]?.cost ?? 0)` (the `buildEscapeHqKoChoice` form). `G.cardDisplayData` carries no Hero Name, so no log prints one or the raw `{set}/{hero}` slug.
  - `purgeHeroFromTimestream(G, cardId, chooserPlayerID): boolean` (shared by the auto and resolved paths; `false`, doing nothing, when the card is not in the HQ): remove the card from its HQ slot, push it to `purgedFromTimestream` (lazy-init), refill the slot, log (`'threat'`) `[Go Back in Time] Player ${chooser} Purged ${card} from the Timestream: every other card of its Hero in the HQ is now KO'd.`, run the sweep, then `applyPileDepletionResourceLoss(G)`.
  - Named helpers: `isPurgedHeroName`, `listHqHeroes`, `isAnotherChoiceOpenOrMatchOver` (the opener's five waits) and `buildTimestreamPurgeChoice`, so each function stays under one screen.
  - `openTimestreamPurgeSeatChoiceIfNeeded(G, events, currentPlayer?)`: no-op when the queue is absent, `G.pendingSeatChoice` is set, `hasAnyPendingChoice(G)` is true, `G.pendingHeroChoice` is set, or `evaluateEndgame(G) !== null`. Then run the sweep and `applyPileDepletionResourceLoss(G)`, and return if `evaluateEndgame(G) !== null` (the pick never lists a Hero the rule is about to KO). Front to back: ≥ 2 HQ Heroes → `parkSeatChoice` a one-seat choice for the entry's chooser (`buildTimestreamPurgeChoice`: options in slot order, each `` { label: `${name} (cost ${cost})`, cardId } `` per the text sources above, `defaultOptionIndex: 0`) and stop; 1 → Purge it and pop; 0 → log (`'neutral'`) `[Go Back in Time] No Hero in the HQ to Purge from the Timestream.` and pop. Delete the queue when empty.
  - `applyTimestreamPurgeResolvedSeatChoice(G, choice)`: Purge the chosen option's `cardId`; pop; delete the queue when empty. If the card is no longer in the HQ, nothing is Purged, it logs (`'neutral'`) `[Go Back in Time] ${card} is no longer in the HQ: the Purge is still owed.`, and the entry stays queued, so the next onMove re-opens it (a mandatory Purge is never lost).
- **onMove** (`game.ts`): `sweepPurgedHeroesFromHq(G)` right BEFORE the escape-procedure opener (so neither HQ pick lists a Hero the rule KOs); then, right after that opener, `openTimestreamPurgeSeatChoiceIfNeeded(G, events, ctx?.currentPlayer)` and `if (G.pendingSeatChoice === undefined) sweepPurgedHeroesFromHq(G);` (an escape auto-KO's refill; never under a parked seat-choice HQ pick, which blocks every move until the next onMove's first sweep). The first sweep is unconditional: an active-player choice that lists HQ cards (`pendingGiveHqHeroChoice`, the put-bottom-HQ choices) re-validates against the live HQ when it resolves, so a KO under it cannot stick a pick, all before the `latchFinalTurnIfDeckExhausted` / `applyPileDepletionResourceLoss` re-runs.
- **Dispatch**: `applySeatChoiceByKind` routes the kind to `applyTimestreamPurgeResolvedSeatChoice` (after the escape HQ-KO branch). **Bot**: `chooseByKind` answers the kind with `indexOfLeastValuableCard` (beside the discard kinds).
- **Drop and guard**: `dropAllPendingPlayerChoices` sets `pendingTimestreamPurges = undefined` (after `pendingSmashDiscards`); `ALL_PENDING_FIELDS` gains `'pendingTimestreamPurges'` in the same place; `operatorSetters.logic.ts` treats a non-empty queue as owed, pinned by a `GATE_BLOCKERS` row `pendingTimestreamPurges is non-empty`.
- **Client heading**: `case 'timestream-purge': return 'Go Back in Time — choose a Hero in the HQ to Purge from the Timestream';`, pinned by one case in `PendingSeatChoicePrompt.test.ts`.

## Guardrails
- No setup, loss or card-data change; the 8-Hero setup and the `pile-depleted` loss stay.
- Both `G` fields are lazily created; never in `Game.setup`.
- Tests open owed Purges through the LIVE `turn.onMove`.
- The `SchemeTwistResolverId` member is a contract change, recorded in D-24762.
- The only edited existing assertions: `ALL_PENDING_FIELDS`, the new `GATE_BLOCKERS` row, the D-pure audit's named resolver exception, and the two resolver-key drift lists.
- Regenerate only what a `:check` reports stale after a rebuild; hash oracles byte-identical, else STOP.

## Required `// why:` Comments
- The union member, the config entry and the resolver: WP-829 / D-24762, the printed Twist, queues one owed Purge.
- `queueTimestreamPurge`: why the Purge is queued (no seat choice inside a reveal).
- The opener's waits; the mandatory timeout default; the bot's least-valuable pick.
- `sweepPurgedHeroesFromHq`: "whenever" as a repeat-until-clean sweep after each Purge and each move; the onMove sweeps run before any HQ pick lists the HQ and never under a parked seat-choice pick; escape before Purge.
- `applyTimestreamPurgeResolvedSeatChoice`: why a pick whose Hero has gone keeps the Purge owed.
- The onMove placement (before the deck-out / loss re-runs) and the D-pure audit exception.

## Files to Produce
- `packages/game-engine/src/rules/timestreamPurge.logic.ts` + `timestreamPurge.logic.test.ts` — **new** (B1-B16)
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`, `rules/schemeTwistConfigs.ts` + `schemeTwistConfigs.test.ts` (the named exception), `rules/schemeTwistResolvers.ts`, `types.ts`, `game.ts`, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts`, `endgame/mastermindVictory.logic.ts` + test, `moves/operatorSetters.logic.ts` + `operatorSetters.test.ts`, `events/notableEvents.types.ts` + test, `events/notableEvents.compose.ts` — **modified**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `PendingSeatChoicePrompt.test.ts` — **modified** (one heading, one case)
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-829-go-back-in-time-purge.md` — **modified / new** (governance close)

## After Completing
- [ ] B1-B16 pass (owed Purges opened through the live `turn.onMove`); the client heading case and the `GATE_BLOCKERS` row pass; `ALL_PENDING_FIELDS` lists the queue; engine delta as in WP §Scaffold.
- [ ] Revert proofs as listed in WP AC 3, each restored.
- [ ] Every card / coverage `:check` → 0 after the rebuild; `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.
- [ ] D-24762 Active; 01.6 post-mortem WP COMPLETE; STATUS updated; WORK_INDEX `[x]` with date; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Allowlist-only diff (revert `lagn-v1.json` CRLF churn). Two-commit topology `EC-867:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: a 2-player operator match with this scheme created after the deploy (gitSha checked) where a staged Twist prompts the Purge, the pick leaves the HQ unKO'd while its same-name HQ Hero is KO'd, and a later same-name arrival is KO'd after the move.

## Common Failure Smells
- A Twist does nothing → the config still says `counter-only`, or the onMove opener is missing.
- The Purged Hero lands in the KO pile → the Purge used `koCard` instead of the Purged list.
- A same-name Hero sits in the HQ after a recruit → the onMove sweep is missing.
- A refill brings a second same-name Hero that stays → the sweep runs one pass only.
- A Purge prompt stacks on another choice → a wait is missing.
- A prompt lists a Hero that is KO'd right after → a sweep runs after the opener instead of before it.
- A Twist is missing from the notable events → the `goBackInTime` key or its push is missing.
- The heading reads "Your choice" → the client case is missing.
