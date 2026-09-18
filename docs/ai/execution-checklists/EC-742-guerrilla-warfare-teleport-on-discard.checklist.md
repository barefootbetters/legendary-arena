# EC-742 — `teleport-on-discard` Reactive Hero Ability (Execution Checklist)

**Source:** docs/ai/work-packets/WP-705-guerrilla-warfare-teleport-on-discard.md
**Layer:** Game Engine + Card Data (NO client)

## Before Starting
- [ ] Baseline: `origin/main` @ `ee39dcbc` (or later); working tree clean, synced.
- [ ] WP-498 / D-24301 substrate present: `discardFromHand(G,playerID,cardId): boolean` + `checkReturnOnDiscard` (`moves/discardFromHand.ts`), the `onDiscard` timing (`heroKeywords.ts`), `DISCARD_TIME_EXECUTED_KEYWORDS`→`MVP_KEYWORDS` (`hero/heroEffects.execute.ts`), `KEYWORD_TIMING_DEFAULTS` (`heroAbility.setup.ts`). **This WP adds a SECOND keyword to that exact substrate.**
- [ ] WP-701 / D-24520 substrate present: `applyEndOfTurnCleanup` (`endOfTurnCleanup.logic.ts`) — **the discard + new-hand draw; NOT in the `turn.onEnd` hook.** It runs before `events.endTurn()` at TWO live sites (`coreMoves.impl.ts:687` endTurn move, `turnLoop.ts:139` advanceStage closure) and in the three bgio-bypassing harness closures (`simulation.runner.ts:290`, `par.aggregator.ts:450`, `test/fixtures/runFixture.ts:152`), which have NO `onEnd` hook. **Locate each of these 5 call sites before implementing.** (`pullCardIntoHand` is a zone-search helper — NOT the consume mechanism.)
- [ ] Confirm `[keyword:Teleport]` is still an inert display token (NOT a `HeroKeyword`; `content.validate.test.ts` rejects a bare `teleport` keyword) and Guerrilla Warfare (`ssw2/ruby-summers/guerrilla-warfare`, abilityIndex 0) is still an unmarked hollow in `hero-mechanic-ledger.json` / `effect-implementation-index.json`.
- [ ] `pnpm -r build` 0; engine test + `cards:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` green.

## Locked Values (do not re-derive)
- New keyword: `'teleport-on-discard'` (REACTIVE, mandatory, automatic — NOT an onPlay-family effect, NOT optional). Marker token: `[keyword:teleport-on-discard]` (bare, no magnitude), APPENDED alongside the inert `[keyword:Teleport]` display token (WP-676 smash precedent).
- Timing: reuse the EXISTING `onDiscard` — add `'teleport-on-discard': 'onDiscard'` to `KEYWORD_TIMING_DEFAULTS`. **No** `HERO_ABILITY_TIMINGS` change. `HERO_KEYWORDS` count +1 (drift test bumps).
- **Executor enrollment (REQUIRED):** add `teleport-on-discard` to `DISCARD_TIME_EXECUTED_KEYWORDS` (already folded into `MVP_KEYWORDS`); NO `HERO_EFFECT_HANDLERS` entry. Play-time hook visit trap (`getHooksForCard` is not timing-filtered) — enrollment stops the `no-handler` hollow + keeps `ledger:heroes:check` green.
- **Card marked (1, abilityIndex 0):** `ssw2/ruby-summers/guerrilla-warfare` → `[keyword:teleport-on-discard]`.
- Reaction: `checkTeleportOnDiscard(G, playerID, cardId)` co-located in `discardFromHand.ts`, called by `discardFromHand` ALONGSIDE `checkReturnOnDiscard`; G-only (no `ctx`). On a marked card: REMOVE it from the discard pile (set aside — in no zone) and append `{playerID, cardId}` to `G.pendingTeleportReturns`.
- Pending shape: `PendingTeleportReturn { playerID, cardId }`; queue `G.pendingTeleportReturns?: PendingTeleportReturn[]` (FIFO, lazy-init, **never** seeded).
- Consume: `consumeTeleportReturns(G)` — **drain-idempotent** (drains the whole queue; a second call the same turn-end is a safe no-op), **direct hand append** (NOT `pullCardIntoHand` — the card is in no zone). Placed IMMEDIATELY AFTER every `applyEndOfTurnCleanup` call so it runs after the cleanup draw and fires once per turn-end on BOTH sub-paths + the harnesses: `coreMoves.impl.ts:687` (endTurn move), `turnLoop.ts:139` (advanceStage closure), `simulation.runner.ts:290`, `par.aggregator.ts:450`, `test/fixtures/runFixture.ts:152`. **`applyEndOfTurnCleanup` is NOT in the `turn.onEnd` hook** (that hook runs only the onTurnEnd rule pipeline; the draw runs earlier, before `events.endTurn()`). Do NOT place the consume only in the onEnd hook or only in the advanceStage closure.
- **Both branches collapse to ONE mechanism** (LOCKED): end-of-CURRENT-turn add-to-owner's-hand. No turn-owner (`ctx.currentPlayer`) distinction needed at park time.
- **MANDATORY automatic** (LOCKED): NO pending choice, NO resolve move, NO block-all guard, NO UIState field, NO client component.

## Guardrails
- `checkTeleportOnDiscard` + `consumeTeleportReturns` are **G-only** (no `ctx`, no `ctx.random`). `discardFromHand.ts` keeps NO `boardgame.io` import.
- **Set-aside = removed from discard.** The reaction runs AFTER `discardFromHand` placed the card in discard, so it removes the card from the discard pile and holds it ONLY in the pending record (no zone). Confirm no zone-completeness invariant treats a pending-held card as missing.
- **Play-time visit is real:** playing Guerrilla Warfare VISITS the `teleport-on-discard` hook (`getHooksForCard` not timing-filtered). Without the `DISCARD_TIME_EXECUTED_KEYWORDS`/`MVP_KEYWORDS` enrollment it emits a `no-handler` hollow every play and reddens `ledger:heroes:check`. Enrollment is mandatory, not optional.
- **Consume placement (determinism-critical):** `consumeTeleportReturns` runs immediately AFTER `applyEndOfTurnCleanup` at EVERY one of the 5 call sites (so the active player's return is an extra on top of the freshly drawn `HAND_SIZE` hand, and it fires once per turn-end on BOTH the endTurn-move and advanceStage sub-paths). The drain-idempotent design makes the multi-site placement safe. Placing it only in the `turn.onEnd` hook, or only in the advanceStage closure, leaves the endTurn-move path drawing-but-not-consuming in the harnesses → replay divergence. The parity test MUST exercise the endTurn-move path.
- **Set-aside removal is load-bearing:** the reaction MUST remove the card from discard. If it doesn't, the card is in discard AND appended to a hand at turn-end → `checkNoCardInMultipleZones` (`invariants/gameRules.checks.ts`) fires. That invariant is at-most-one-zone (never at-least-one) and does not scan pending records, so a card held only in the pending record is safe.
- `pendingTeleportReturns` is **lazy-init** — never in `Game.setup()`. This keeps the empty-replay `PRE_WP080_HASH` + `hashGameState` oracles from re-pinning. A setup-seeded value shifting the oracles is a defect, not a re-pin.
- The reaction fires ONLY on hand→discard by a card effect (via the chokepoint). Deck→discard, KO-pile moves, and end-of-turn cleanup are NOT this reaction — do not add it anywhere but the chokepoint.
- `HeroKeyword` union AND `HERO_KEYWORDS` array move in lockstep. Do NOT add a timing (`onDiscard` exists) or a `HERO_EFFECT_HANDLERS` entry. No `.reduce()` in the reaction/consume loops; `PendingTeleportReturn` JSON-serializable.
- **No interactive surface** — grep-confirm NO new resolve move (no `game.ts` moves entry, no `game.test.ts` count bump), NO new block-all `hasPending*` guard, NO new UIState field, NO arena-client change. If any is added, the mandatory-automatic contract was misread.

## Required `// why:` Comments
- `checkTeleportOnDiscard`: D-24526 — a SECOND reactive on-discard keyword at the shared chokepoint; MANDATORY automatic (no "you may"); set-aside = removed from discard, held in the pending record.
- `pendingTeleportReturns` lazy-init: D-24526 — never seeded so canonical JSON omits it from the empty-replay final state (no oracle re-pin).
- `consumeTeleportReturns` onEnd call site (`game.ts` + each harness): D-24526 — runs AFTER the WP-701 new-hand draw so the return is an EXTRA card; both printed branches collapse here; harness replication keeps replays byte-identical.
- `heroKeywords.ts` entry: D-24526 — reactive teleport-on-discard; the general `[keyword:Teleport]` onPlay family stays out of scope.
- `KEYWORD_TIMING_DEFAULTS` entry: D-24526 — parser default is `onPlay`; `teleport-on-discard` classifies `onDiscard`; the reaction keys on the KEYWORD, not the timing.
- `DISCARD_TIME_EXECUTED_KEYWORDS` addition: D-24526 — the executor VISITS this hook at play time; enrollment prevents a `no-handler` hollow. No `HERO_EFFECT_HANDLERS` entry.

## Files to Produce
- Engine: `heroKeywords.ts` (union+array +1), `setup/heroAbility.setup.ts` (`KEYWORD_TIMING_DEFAULTS`), `hero/heroEffects.execute.ts` (`DISCARD_TIME_EXECUTED_KEYWORDS`), `types.ts` (`PendingTeleportReturn` + queue), `moves/discardFromHand.ts` (`checkTeleportOnDiscard` + `cardCarriesTeleportOnDiscard`), `endOfTurnCleanup.logic.ts` **or new** `moves/teleportReturn.logic.ts` (`consumeTeleportReturns`), `game.ts` (onEnd call), `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, the `replay/runFixture` harness — **modified/new**
- Engine tests: `discardFromHand.test.ts` (reaction + set-aside removal + unmarked no-op), the `consumeTeleportReturns` onEnd test (new or in the cleanup test — active extra-card + non-active existing-hand cases), `heroKeywords.test.ts` (+1), `heroAbility.setup.test.ts` (Guerrilla Warfare → `teleport-on-discard` hook), `heroEffects.execute.test.ts` (no `no-handler` hollow on a normal play), a replay/harness-parity assertion
- Data / pipeline: `apply-hero-ability-markers.mjs` (`VALID_TOKEN_PATTERN` +token), `inputs/hero-ability-markers.json` [1 row] + `data/cards/ssw2.json` regen + `hero-mechanic-ledger.{json,csv}` + `effect-implementation-index.json` regen
- Governance: DECISIONS (D-24526), STATUS, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm -r build` 0; engine test pass
- [ ] `cards:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `effect-index:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0
- [ ] `git diff --name-only` = allowlist (+ regenerated data / coverage artifacts); NO arena-client file, NO new move/guard/UIState field
- [ ] No oracle re-pin (`PRE_WP080_HASH` + `hashGameState` unchanged); committed fixture `finalStateHash` unchanged (no committed fixture returns Guerrilla Warfare — verify)
- [ ] D-24526 Active; §11/§21 N/A (no HTTP/auth); STATUS/WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026, operator, post-deploy): force-discard Guerrilla Warfare → set aside → returns to owner's hand at end of the current turn (extra card)

## Common Failure Smells
- Empty-replay hash re-pinned → `pendingTeleportReturns` was seeded at setup (must be lazy-init).
- Live vs replay diverge on a set-aside card → a harness did not replicate the consume, OR the consume was placed only in the advanceStage closure / onEnd hook so the endTurn-move path drew-but-didn't-consume (make it drain-idempotent + co-located at all 5 `applyEndOfTurnCleanup` sites; the parity test must cover the endTurn-move path).
- Returned card lands in the WRONG hand size (not an extra) → the consume ran before `applyEndOfTurnCleanup` instead of after.
- `checkNoCardInMultipleZones` fires at turn-end → the discard-removal step was skipped, so the card is in discard AND was appended to hand.
- `no-handler` hollow on a normal (non-discard) Guerrilla-Warfare play, or `ledger:heroes:check` red → keyword not enrolled in `MVP_KEYWORDS`/`DISCARD_TIME_EXECUTED_KEYWORDS`.
- Reaction never fires though the card IS discarded → missing `KEYWORD_TIMING_DEFAULTS` entry, or `checkTeleportOnDiscard` matched on timing instead of the keyword, or the marker wasn't applied (check `cards:check` + the ssw2 regen).
- A card is double-discarded / lost → set-aside removal left it in discard, then end-of-turn cleanup discarded it again; or it was added back to hand but never removed from discard.
- Drift red → keyword in union but not array (or vice-versa), or an accidental `HERO_EFFECT_HANDLERS`/timing/ move addition.
- A pending choice / prompt / block-all guard appeared → the mandatory-automatic contract was misread as optional (that would be the WP-498 shape, not this WP).
