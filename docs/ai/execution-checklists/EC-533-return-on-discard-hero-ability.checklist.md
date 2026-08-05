# EC-533 — `return-on-discard` Reactive Hero Ability (Execution Checklist)

**Source:** docs/ai/work-packets/WP-498-return-on-discard-hero-ability.md
**Layer:** Game Engine + Arena Client + Card Data

> **Execution amendments (as-built, 2026-08-05 — inline, 01.0b file-allowlist class):**
> **(1)** The chokepoint landed in a dedicated `moves/discardFromHand.ts` (below it says
> `zoneOps.ts`) — `zoneOps.ts`'s module contract is "pure array helpers that never mutate
> their inputs", which a G-mutating, reaction-parking chokepoint violates. **(2)** The closed
> set is **SIX** sites, not five: the drift-guard surfaced `rules/ruleRuntime.effects.ts`
> `applyDiscardHand` (the generic `discardHand` rule effect) the surface study missed. See
> D-24301 for the full as-built record.

## Before Starting
- [ ] Baseline: `origin/main` @ `cb54a7d0` (or later — the WP-498 draft/reserve); working tree clean, synced.
- [ ] D-24139 + WP-383 substrate present: `HeroKeyword` union + `HERO_KEYWORDS`, the marker pipeline (`apply-hero-ability-markers.mjs` + `inputs/hero-ability-markers.json`), `getHooksForCard`, `setup/heroAbility.setup.ts`.
- [ ] Optional-decline template present: `resolveOptionalPutBottomHQ` (`{ decline: true } | { cardId }`) + `PendingOptionalPutBottomHQ` + `OptionalPutBottomHQPrompt.vue`. **This WP mirrors the OPTIONAL shape, not the mandatory `resolveDiscardToPlay`.**
- [ ] Confirm the five hand→discard sites still exist as mapped (resolveDiscardToPlay:175-179; discardChoice.resolve:104-113; mastermindHandlers.discardCardFromHand:462-478; schemeTwistResolvers:150-156; dodgeCard:120-123) and that `zoneOps.ts` has no `discardFromHand` yet.
- [ ] `pnpm -r build` 0; engine test + arena-client typecheck + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` green.
- [ ] (Recommended, ~30s de-risk) On a throwaway branch, route the 5 sites through a no-op `discardFromHand` (discard only, no reaction) and run `pnpm --filter @legendary-arena/game-engine test`; confirm green (esp. `schemeTwistResolvers.test.ts` whole-hand order + `dodgeCard.test.ts`), then discard. Fold any broken fixture into scope before implementing.

## Locked Values (do not re-derive)
- New keyword: `'return-on-discard'` (a REACTIVE marker, NOT an onPlay-family effect). Marker token: `[keyword:return-on-discard]` (bare — no magnitude).
- New timing: `'onDiscard'` — the first reactive `HeroAbilityTiming`. `HERO_ABILITY_TIMINGS` 5→6; `HERO_KEYWORDS` 33→34 (both drift tests bump).
- **Parser (REQUIRED, not conditional):** add `'return-on-discard': 'onDiscard'` to `KEYWORD_TIMING_DEFAULTS` in `setup/heroAbility.setup.ts` (default timing is `onPlay`; no generic `onDiscard` arm). `checkReturnOnDiscard` matches on the KEYWORD, not the timing (the timing label is declarative-only).
- **Executor enrollment (REQUIRED):** add a new `DISCARD_TIME_EXECUTED_KEYWORDS: readonly HeroKeyword[] = ['return-on-discard']` set in `hero/heroEffects.execute.ts` and fold it into `MVP_KEYWORDS` (mirror `HAND_ACTION_EXECUTED_KEYWORDS`); NO `HERO_EFFECT_HANDLERS` entry. No `NO_MAGNITUDE_KEYWORDS` entry is needed (the classifier keys only on `MVP_KEYWORDS`; the mirror keywords `dodge`/`undercover` omit it). `MVP_KEYWORDS` membership alone stops the `no-handler` hollow on a normal play + keeps `ledger:heroes:check` green.
- Chokepoint signature: `discardFromHand(G, playerID, cardId): boolean` — returns `found` so `dodgeCard` keeps its not-found early-return AND its post-discard reshuffle-then-draw order.
- **Card marked (1, abilityIndex 0):** `core/cyclops/unending-energy` → `[keyword:return-on-discard]`.
- Chokepoint: `discardFromHand(G, playerID, cardId)` (in `zoneOps.ts`) — the SINGLE hand→discard owner; moves hand→discard via `moveCardFromZone`, then calls `checkReturnOnDiscard(G, playerID, cardId)` (G-only, no `ctx`).
- Pending shape: `PendingReturnOnDiscard { playerID, cardId }`; queue `G.pendingReturnOnDiscard?: PendingReturnOnDiscard[]` (FIFO, lazy-init, **never** seeded).
- Resolve move: `resolveReturnOnDiscard`, args `{ decline: true } | { cardId }`, `client: false` (D-10008). Accept → `moveCardFromZone` discard→hand; decline → front-pop only.
- Five routed sites (closed set): resolveDiscardToPlay, discardChoice.resolve, mastermindHandlers.discardCardFromHand (one edit → its 5 call sites), schemeTwistResolvers.discardHand, dodgeCard.
- Broad-reading scope LOCKED: discard-to-play cost + dodge COUNT; end-of-turn cleanup does NOT.

## Guardrails
- `checkReturnOnDiscard` is **G-only** (no `ctx`, no `ctx.random`) — parking a pending choice needs only G. `zoneOps.ts` keeps NO `boardgame.io` import.
- **Play-time visit is real:** `executeHeroEffects` reads `getHooksForCard` (NOT timing-filtered), so playing Unending Energy VISITS the `return-on-discard` hook. Without the `MVP_KEYWORDS`/`DISCARD_TIME_EXECUTED_KEYWORDS` enrollment it emits a `no-handler` hollow every play and reddens `ledger:heroes:check`. Enrollment is mandatory, not optional.
- Drift-guard must cover all FOUR mutation idioms (inline slice/append; `moveCardFromZone`+`.discard =`; `moveAllCards`; loop+append) — scan the general `playerZones.discard = …`-paired-with-hand-read, and inject a synthetic mutation of EACH idiom in the negative assertion (else the guard is vacuous against a re-introduction in an un-scanned shape).
- Block-all guard placement MIRRORS the WP-383 `hasPendingDiscardToPlay` guard exactly (same 8 files: `coreMoves.impl.ts` ×3 + `game.ts advanceStage` + recruitHero/fightVillain/fightMastermind/healWounds/dodgeCard/playFromUndercover). Grep each existing `hasPending*` cluster and confirm `hasPendingReturnOnDiscard` is present in every one; confirm `sendUndercover`'s guard posture is unchanged (pre-existing — not a new leak).
- `pendingReturnOnDiscard` is **lazy-init** — never in `Game.setup()`. This is what keeps the empty-replay `PRE_WP080_HASH` + `hashGameState` oracles from re-pinning. If a setup-seeded value creeps in, the oracles shift — that is a defect, not a re-pin.
- The reaction fires ONLY on hand→discard by a card effect. Deck→discard, KO-pile moves, and cleanup are NOT discards — do not route them through `discardFromHand`.
- Drift-guard test (cheat-proof): assert no hand→discard mutation exists outside `discardFromHand`; include a NEGATIVE assertion (a synthetic outside mutation FAILS) so the guard is non-vacuous. No mocking/mutating the asserted-over source set.
- Add `hasPendingReturnOnDiscard(G)` to the block-all guard on EVERY action move (the three `coreMoves.impl.ts` clusters + `game.ts advanceStage` + recruitHero/fightVillain/fightMastermind/healWounds/dodgeCard/playFromUndercover). Missing one = a legal move leaks past the pending choice.
- `ai.legalMoves.ts`: add `resolveReturnOnDiscard` to `SIMULATION_MOVE_NAMES` AND the forced-resolve short-circuit — bot default = **accept** the return (strictly beneficial + deterministic).
- Keyword in BOTH union AND `HERO_KEYWORDS`; timing in BOTH union AND `HERO_ABILITY_TIMINGS`. Move in `game.ts` moves block + `game.test.ts` move-set array + count. No `.reduce()` in the discard/scan loops; `PendingReturnOnDiscard` JSON-serializable.
- New UIState field → five-step Board-Visible Field Rule (declare → build → **filter pass-through** → filter test → Play Diagnostics); chooser-only redaction; re-export new type in `index.ts`; arena-client fixture backfill (documented recurrence).

## Required `// why:` Comments
- `discardFromHand` / `checkReturnOnDiscard`: D-24301 — the single hand→discard chokepoint; the reactive fire-point for `onDiscard` (first non-play-initiated timing).
- `pendingReturnOnDiscard` lazy-init: D-24301 — never seeded so canonical JSON omits it from the empty-replay final state (no oracle re-pin).
- resolve move accept/decline branch + discard-membership recompute (round-trip rule; the "you may" decline shape).
- `heroKeywords.ts` entry: D-24301 — reactive return-on-discard; broad reading of "a card effect makes you discard".
- `DISCARD_TIME_EXECUTED_KEYWORDS` in `heroEffects.execute.ts`: D-24301 — the executor VISITS this hook at play time (getHooksForCard is not timing-filtered); enrollment prevents a `no-handler` hollow + keeps the mechanic ledger executable. No `HERO_EFFECT_HANDLERS` entry — the reaction fires at the chokepoint.
- `KEYWORD_TIMING_DEFAULTS` entry: D-24301 — parser default is `onPlay`; `return-on-discard` must classify `onDiscard`.

## Files to Produce
- Engine: `heroKeywords.ts`, `types.ts`, `zoneOps.ts` (chokepoint + reaction helper), `resolveReturnOnDiscard.ts` (**new**), `hero/heroEffects.execute.ts` (`DISCARD_TIME_EXECUTED_KEYWORDS`→`MVP_KEYWORDS`), the 5 routed-site files, `setup/heroAbility.setup.ts` (`KEYWORD_TIMING_DEFAULTS`), `game.ts`, the block-all-guard move files, `coreMoves.impl.ts`, `ai.legalMoves.ts`, `uiState.{types,build,filter}.ts`, `index.ts` — **modified/new**
- Engine tests: `resolveReturnOnDiscard.test.ts` (**new**), `zoneOps.test.ts` (chokepoint + 4-idiom drift-guard), `heroKeywords.test.ts`, `heroAbility.setup.test.ts` (33→34, 5→6, `unending-energy` yields a discoverable `return-on-discard` hook), `heroEffects.execute.test.ts` (no `no-handler` hollow on a normal Unending-Energy play), `game.test.ts`, `discardChoice.resolve.test.ts`, `mastermindHandlers.test.ts`, `schemeTwistResolvers.test.ts`, `dodgeCard.test.ts`, `uiState.*.test.ts`, `ai.legalMoves.test.ts`
- Client: `ReturnOnDiscardPrompt.vue` (**new**) + `.test.ts`, `uiMoveName.types.ts`, `TurnActionBar.vue`, `PlayDesktop.vue`, `PlayMobile.vue`, `useTurnActions.ts` + fixtures
- Data: `inputs/hero-ability-markers.json` [1 row] + `data/cards/core.json` regen + `data/metadata/card-mechanics.json` + `docs/ai/coverage/*`
- Governance: DECISIONS (D-24301), STATUS, WORK_INDEX, EC_INDEX, mindmap

## After Completing
- [ ] `pnpm -r build` 0; engine test + arena-client typecheck (vue-tsc) + test pass
- [ ] `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `roadmap:counts:check` all 0
- [ ] `git diff --name-only` = allowlist (+ regenerated data/artifacts + fixture backfill)
- [ ] No oracle re-pin (`PRE_WP080_HASH` + `hashGameState` unchanged); fixture `finalStateHash` unchanged (no committed fixture returns Unending Energy — verify `sentinel-core-doom-2p`)
- [ ] D-24301 Active; §11/§21 N/A (no HTTP/auth); STATUS/WORK_INDEX `[x]`/EC_INDEX Done/mindmap ✅ + counts
- [ ] Live-verify (D-24026, operator, post-deploy): pay a Determination/Optic Blast discard-to-play cost with Unending Energy → return prompt; accept returns it, decline leaves it in discard

## Common Failure Smells
- Empty-replay hash re-pinned → `pendingReturnOnDiscard` was seeded at setup (must be lazy-init).
- A move slips past the pending choice → a block-all guard is missing on that move.
- Reaction fires on a deck→discard or cleanup → a non-hand or non-effect site was wrongly routed through the chokepoint.
- Drift-guard passes with a synthetic outside mutation → the negative assertion is missing/vacuous.
- Drift red → keyword/timing in union but not array (or vice-versa), or move in `game.ts` but not `game.test.ts`, or `ai.legalMoves` not updated.
- Blank prompt / "return" does nothing → UIState field skipped the filter pass-through (Board-Visible Field Rule step 3).
- `no-handler` hollow breadcrumb on a normal (non-discard) Unending-Energy play, or `ledger:heroes:check` red → the keyword was NOT enrolled in `MVP_KEYWORDS`/`DISCARD_TIME_EXECUTED_KEYWORDS` (the play-time visit trap).
- Reaction never fires though the card IS discarded → the hook wasn't registered (missing `KEYWORD_TIMING_DEFAULTS` entry), or `checkReturnOnDiscard` matched on timing instead of the keyword.
- `dodgeCard` reshuffle/draw misfires after routing → `discardFromHand` didn't surface `found`, so the not-found early-return or the post-discard ordering was lost.
