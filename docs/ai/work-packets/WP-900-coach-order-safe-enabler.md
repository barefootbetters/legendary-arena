# WP-900 — The coach's play-order tip never moves a card whose own bonus depends on play order (Server + one engine export)

**Status:** Done 2026-11-16 (EC-938; D-24857 Active). Drafted 2026-11-16 (#3428). Gates: pre-flight READY TO EXECUTE (round 3); copilot CONFIRM (round 3); lint PASS (run 2).
**Layer:** Server (`apps/server/src/coach/sequenceTeacher.logic.ts`) plus one new Runtime-Safe engine export (`packages/game-engine/src/hero/orderSafeEnabler.ts`, barrel-exported from `index.ts`)
**User-Visible Surface:** play.legendary-arena.com (the post-match coach card, Legendary Pass)
**Risk Tier:** LOW — a paid-feature advice text narrows (fewer tips, never different ones); no `G` write, gameplay rule, hash, card data, client, auth, money or persistence change; reports already cached keep their tips
**Hard-deps:** WP-710 / D-24533 (the sequence teacher) ✅, WP-745 / D-24568 (the play-history gates) ✅, WP-861 / D-24798 (first-card gates) ✅, D-24746 (`playedThisTurn` produced by the parser) Active

## Goal

The endgame coach's play-order tip ("Next time, play X before Y — you'd have landed its <class> synergy bonus.") only names an X that loses nothing by being played earlier. Today it can tell a player to play Winter Soldier's KGB Training, Four of a Kind or Eighth Time's a Charm earlier, which costs that card its own Attack. After this WP, a card qualifies as the enabler X only when every condition on every one of its hooks is a type the engine classifies as order-safe, and none of its effect descriptors carries a field that reads turn or board state the move can change (a count, a "you get both" upgrade, Digest, Empowered, day / night, a reward composition, a composition primitive) or locks the rest of the turn's draws (Shenanigans). A new condition type or descriptor field costs the coach a tip, never the player a bonus. Effect keywords whose handler reads state with no descriptor field are an enumerated residual (D-24857).

## User-Visible Impact

`play.legendary-arena.com`, the coach card's play-order tips (`CoachReport.sequenceTips`, WP-713 render): newly generated reports no longer recommend moving an order-dependent card earlier. Tips whose enabler is unconditional, or gated only on a wait-and-see condition or "first Hero you played this turn", are unchanged. Reports already in `legendary.coach_reports` keep the tips they were generated with (one paid call per match; no backfill).

## Assumes

- **Baseline:** `origin/main` at `decede76a` (reserve PR #3424 merged), re-recorded at commit.
- **Server teacher** (`apps/server/src/coach/sequenceTeacher.logic.ts`, 210 lines):
  - Module doc ~1-24; its "Net-gain, never net-zero" bullet (~17-20) says the enabler "MUST be unconditional (no snapshot-gate clause of its own)".
  - `isUnconditionalEnabler(finalState, cardId)` (~56-66) rejects a card only when a hook condition is in `SEQUENCE_GATE_CONDITION_TYPES`. Its `// why:` (~45-50) says "`playedThisTurn` is unproduced by any card parser today", false since D-24746.
  - `findUnconditionalEnabler` (~186-210) calls it (~200) for each same-turn later play; `firstTeachableTip` (~138-173) finds the whiff with `SEQUENCE_GATE_CONDITION_TYPES` + `heroConditionHoldsForInPlay` (unchanged here).
  - Imports (~26-33): `getHooksForCard`, `heroConditionHoldsForInPlay`, `SEQUENCE_GATE_CONDITION_TYPES` from `@legendary-arena/game-engine`.
- **Server test** `apps/server/src/coach/sequenceTeacher.logic.test.ts`: 13 tests in `describe('computeSequenceTips (WP-710 / D-24533)')`, hand-built hooks via a `hook()` helper and `makeFinalState()`.
- **Tips are merged** in `apps/server/src/coach/coach.logic.ts` ~452-459 (`{ ...report, sequenceTips, tableCooperation }`) before `writeCoachReport`; the cache-hit path serves the stored blob.
- **Engine** (`packages/game-engine/src/`):
  - `hero/deferredConditionalGrants.ts` ~86: `export const WAIT_AND_SEE_CONDITION_TYPES` (13 members), with a runtime drift pin in `deferredConditionalGrants.test.ts` that every member has an `evaluateCondition` case. It imports from `heroConditions.evaluate.ts`, so `heroConditions.evaluate.ts` cannot import it back at module load (cycle).
  - `hero/heroConditions.evaluate.ts`: `PLAY_HISTORY_CONDITION_TYPES` (~232, 4 members), `SEQUENCE_GATE_CONDITION_TYPES` (~1444, 3 members), `heroConditionHoldsForInPlay` (~1507), and the `evaluateCondition` switch (~268-668, 32 condition-type labels). The `firstHeroPlayedThisTurn` case (~322) passes when no OTHER played card is in the played view.
  - `rules/heroAbility.types.ts`: `HeroAbilityHook` ~35-95 (`conditions?` ~49, `effects?` ~52, `primitiveEffects?` ~57). `HeroEffectDescriptor` fields that read turn or board state when the effect resolves: `countSource?` ~133, `countScaledChoiceOptions?: ChooseOneOption[]` ~146 (`CountScaledChoiceOption.kind === 'count-scaled'`, `rules/heroCountSource.ts` ~111 / union ~189), `empoweredClass?` ~164, `empoweredClasses?` ~171, `digestThreshold?` ~209, `bothCondition?: HeroCondition` ~229, `sunlightEffects?` / `moonlightEffects?` ~254-255 (both `'rejected'` in the tables), `attackRestriction.widenToMastermindWhen?: HeroCondition[]` ~262, `rewardComposition?` ~158, `nonGreyHeroKoAttack?` ~277. Nested effect arrays: `digestEffects` / `indigestionEffects` ~218-219, `excessiveViolenceEffects` ~238, `heistEffects` ~246.
  - `rules/heroCountSource.ts`: 19 count sources, every one read when the grant resolves (played-this-turn, hand + play, victory pile, draws, deck KOs).
  - `index.ts` ~316-324 exports `heroConditionHoldsForInPlay` / `SEQUENCE_GATE_CONDITION_TYPES` and `buildHeroAbilityHooks` (~314) on the `.` surface, which `apps/server` may import (`.claude/rules/architecture.md` import table).
- **Committed card data** (parsed with `buildHeroAbilityHooks`, first copy `#0`, at the baseline) carries the cards the tests read:
  - `ca75/winter-soldier/kgb-training` (covert): one `onPlay` hook, `playedThisTurn` `8`, `attack`.
  - `vill/dr-octopus/eighth-times-a-charm` (strength): `cardPlayOrdinalEquals` `8`, `attack`.
  - `ff04/invisible-woman/four-of-a-kind` (ranged): `otherCardOfCostPlayedThisTurn` `4`, `attack`.
  - `mdns/blade-daywalker/hunt-high-and-low` (instinct): two hooks, `patrolSpaceEmpty` `rooftops` / `sewers`.
  - `ca75/captain-america-falcon/winged-salvation` (ranged): `bystandersInVictoryAtLeast` `3`, `attack`.
  - `core/deadpool/oddball` (covert): no condition; `attack-per-count` / `odd-cost-heroes-played-this-turn`.
  - `xmen/legion/bend-steel` (strength): no condition; one `primitiveEffects` entry.
  - `vnom/venom/devouring-drool` (instinct): no hook condition; one `digest-indigestion` effect with `digestThreshold` `3` and `bothCondition` `heroClassMatch` `instinct`.
  - `vnom/venompool/shenanigans` (tech): no condition; effects `draw` 2 then `no-more-draws` (`packages/game-engine/src/rules/heroKeywords.ts` ~90: sets `G.turnEconomy.drawsLocked`, so every later effect draw this turn draws 0).
  - `core/thor/surge-of-power` (ranged): `recruitMadeThisTurnAtLeast` `8` (wait-and-see), `attack`.
  - `dkcy/elektra/first-strike` (covert): `firstHeroPlayedThisTurn`, `attack`.
- **Prior WPs complete:** the header Hard-deps, all `[x]` in WORK_INDEX.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Architectural Principles #2 (engine owns truth) and §Layer Boundary; `.claude/rules/architecture.md` import table (`apps/server` may import the engine `.` surface).
- D-24533 (the net-gain rule this amends), D-20105 (the engine is the sole authority on condition semantics), D-24746 (`playedThisTurn` now produced), D-24568 §1 (play-history gates are read on play; turn-event accumulators wait), D-24377 / D-24467 (wait-and-see shapes), D-24798 (first-card gates), D-24529 (hand + play reading of `distinct-hero-classes-played-this-turn`).
- `docs/ai/REFERENCE/00.6-code-style.md`.

**Why the deny-list is wrong.** D-24533 asked "does the enabler carry a class / team / keyword gate?" Every condition type added since (play history, board state, present state) passes that test, so the teacher can name an enabler whose own grant needs the late position. The fix inverts the rule: list what is proven safe, reject everything else.

**Order-safe condition types (the allowlist).** Playing a card earlier never makes these false that were true later:
- the 13 `WAIT_AND_SEE_CONDITION_TYPES`: a failed gate is re-checked for the rest of the turn (`deferredConditionalGrants.ts`), and the edge-triggered ones count events after the card is in play, so an earlier play sees at least as many;
- `firstHeroPlayedThisTurn`: it passes only when no other card was played before it, so moving the card earlier only helps.

**Everything else is rejected**, including all of these (each verified against its `evaluateCondition` case):
- reads the played view, so an earlier play sees fewer cards: `heroClassMatch`, `requiresTeam`, `requiresKeyword`, `playedThisTurn`, `cardPlayOrdinalEquals` (exactly the Nth card; any move breaks it), `otherCardOfCostPlayedThisTurn`, `cardOfCostPlayedThisTurn`, `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast`;
- reads present state that a fight, rescue, recruit, draw or KO between the two positions can change: `bystandersInVictoryAtLeast`, `distinctHeroCostsAtLeast` (Outwit), `heroCostAtLeastInHandOrPlay` (Worthy), `cheapOrSizeChangingAtLeast`, `heroClassInDiscardPile`, `sunlightInEffect`, `moonlightInEffect`, `patrolSpaceEmpty`, `patrolSpaceOccupied`, `conquerorSpaceHasVillain`;
- any type added later, until the engine lists it as order-safe.

**Grants that read state inside the effect.** An enabler with no hook condition can still lose by moving earlier: Deadpool's Oddball counts the other odd-cost Heroes played before it, and Venom's Devouring Drool carries its "[hc:instinct]: Instead, you get both" upgrade as a `bothCondition` inside its effect, so playing it before the instinct card it was waiting for loses the upgrade (the mutually-enabling pair D-24533 forbids). A hook is therefore also rejected when it carries `primitiveEffects` (Berserk, Empowered and the other composition markers read the deck or HQ when they resolve), or when any effect, checked recursively through `digestEffects`, `indigestionEffects`, `excessiveViolenceEffects` and `heistEffects` (`sunlightEffects` / `moonlightEffects` are rejected outright when non-empty, not recursed):
- carries a `countSource`, or a `countScaledChoiceOptions` entry with `kind === 'count-scaled'`;
- carries a `bothCondition`, or an `attackRestriction.widenToMastermindWhen` condition, whose type is not order-safe;
- carries `digestThreshold` (Digest reads the Victory Pile size at play), `empoweredClass` or a non-empty `empoweredClasses` (Empowered reads the HQ);
- carries a non-empty `sunlightEffects` or `moonlightEffects` (day / night is read at play);
- has `type === 'no-more-draws'`: moving it earlier locks the draws of every card it now precedes, including the whiffed card (Shenanigans before Iron Man's Endless Invention blocks both its draws: a net loss);
- carries a `rewardComposition` (Berserk reads the deck top, `rooftops-conqueror` the City, when the reward resolves; `wpnx` Violent Conditioning) or a `nonGreyHeroKoAttack` (a deck-KO count read at resolve; every current carrier is already rejected by its `countSource` effect, so this is defence in depth).
Recursing into Excessive Violence and Heist (which fire later, at a fight or heist) costs a few tips that would have been safe; accepted, fail-closed.

**The forward rule is compile-enforced.** `orderSafeEnabler.ts` holds two classification tables (readable by its test through the non-barrel module export `ORDER_SAFETY_FIELD_TABLES`; never re-exported from `index.ts`), `Record<keyof Required<HeroEffectDescriptor>, 'safe' | 'rejected' | 'recursed'>` and `Record<keyof Required<HeroAbilityHook>, 'safe' | 'rejected' | 'recursed'>`. `src` is type-checked by `tsc` in `pnpm -r build`, so a new descriptor or hook field fails the build until someone classifies it here. A runtime test asserts that every `'rejected'` / `'recursed'` key is exercised by an AC 3 case. No count source is order-safe: each reads the played view, the hand, the victory pile, the draw count or the deck-KO record at resolve time, and a draw or fight between the two positions changes them (`distinct-hero-classes-played-this-turn`, D-24529's hand + play reading, included: a card drawn between the two positions is counted late but not early). Perfect Teamwork and Avengers Assemble stop being enablers; that is a lost tip, accepted.

**Engine owns the classification (D-20105).** The allowlist and the hook predicate live in a new `hero/orderSafeEnabler.ts`. It imports `WAIT_AND_SEE_CONDITION_TYPES`; putting it in `heroConditions.evaluate.ts` beside `SEQUENCE_GATE_CONDITION_TYPES` would close an import cycle (`deferredConditionalGrants.ts` imports that module). The server keeps no condition-type or count-source string of its own.

**Rejected designs.** A per-type deny-list on the server (the current bug, again); a reordered re-simulation (D-24533 rejected it: RNG divergence); keeping count-scaled cards as enablers when their count happens to be unchanged by the move (needs a counterfactual count the teacher cannot compute faithfully).

**Residuals (recorded in D-24857, not built).**
- Effect keywords whose handler reads present state when it resolves, with no descriptor field the structural test can see. The 01.7 corpus probe at draft found, on cards that still qualify: `reveal` (18 cards, deck top), `investigate` (8, deck), `feast` (3, deck top), `reveal-three-assign` (2, deck), `put-bottom-hq-icon-reward` (2, HQ), `shuffle-discard-empty-reward` (2, discard pile), `reveal-top-may-ko` (1, deck top), `reveal-from-hand` (1, hand), and `victory-villain-attack`, `pure-fury`, `reveal-herodeck-attack`. Deck and hand reads can go either way rather than systematically losing. The execution session re-runs the probe and records the final keyword + card-count list in the `EC-938:` body and D-24857. A per-keyword classification is a follow-up.
- Enabler effects that change the turn for the cards they now precede, beyond `no-more-draws`, are not classified (follow-up, with the displaced-card residual).
- The rule reads the match's setup-time hooks (`finalState.heroAbilityHooks` comes from the replay's `initialState`): a match created before a parser change (e.g. KGB Training before D-24746) is judged on its older hooks.
- Displaced cards: moving X earlier also shifts the whiffed card and every card between them one position later. A displaced `cardPlayOrdinalEquals` card (exactly 8th) or a whiffed card that is itself first-Hero-gated on another line can lose. Follow-up.
- Teaching tips for play-history gates ("play Winter Soldier later, after 7 other cards") is a different tip shape and voice. Follow-up.

## Scope (In)

- **Engine (RS-1):** new `packages/game-engine/src/hero/orderSafeEnabler.ts`:
  - `export const ORDER_SAFE_ENABLER_CONDITION_TYPES: readonly string[]` = every `WAIT_AND_SEE_CONDITION_TYPES` member, then `'firstHeroPlayedThisTurn'`.
  - `export function isOrderSafeEnablerHook(hook: HeroAbilityHook): boolean`: `false` when any `hook.conditions` type is not in the allowlist, `primitiveEffects` is non-empty, or any effect fails the recursive descriptor check in `## Context` (a module-private `isOrderSafeEffect(effect)`, split per EC-938 into `effectReadsResolveTimeState`, `effectHasUnsafeCondition` and `nestedEffectsAreOrderSafe`, each ≤ ~30 lines with JSDoc); otherwise `true`. The two classification tables in `## Context` live in the same module. It ignores `hook.timing`: a card is rejected if any of its hooks fails, whatever that hook's timing (fail-closed; stated in the JSDoc).
  - Barrel-export both from `packages/game-engine/src/index.ts` beside `SEQUENCE_GATE_CONDITION_TYPES`.
- **Server (RS-2):** in `sequenceTeacher.logic.ts`, `isUnconditionalEnabler` becomes `isOrderSafeEnabler(finalState, cardId)`: `false` when any of the card's hooks fails `isOrderSafeEnablerHook`. `findUnconditionalEnabler` becomes `findOrderSafeEnabler` (name only). The `// why:`, the module doc's net-gain bullet and the function JSDoc say the D-24857 rule; the stale `playedThisTurn` sentence goes.
- **Tests (RS-3):** a new `packages/game-engine/src/hero/orderSafeEnabler.test.ts`, and new cases in `sequenceTeacher.logic.test.ts` (see Acceptance Criteria).
- Governance at close: `docs/ai/DECISIONS.md` (D-24857), `docs/ai/STATUS.md`, WORK_INDEX, EC_INDEX, `docs/05-ROADMAP-MINDMAP.md`, NUMBER-LEDGER, `docs/ai/post-mortems/01.6-WP-900-coach-order-safe-enabler.md`, and `docs/ai/coverage/live-verify.json` only if the live check records a row.

## Out of Scope

- The whiff side (`firstTeachableTip`, `SEQUENCE_GATE_CONDITION_TYPES`, `heroConditionHoldsForInPlay`): unchanged.
- The residuals above; any new tip shape; the tip wording; the client render (WP-713).
- Regenerating or editing cached `legendary.coach_reports` rows.
- Any engine behaviour, `G` field, hash, card data, `evaluateCondition` case or wait-and-see membership.
- Editing Done WPs, ECs or past DECISIONS entries (D-24533 stays as written; D-24857 amends it).

## Files Expected to Change

- `packages/game-engine/src/hero/orderSafeEnabler.ts` — **new** — RS-1.
- `packages/game-engine/src/hero/orderSafeEnabler.test.ts` — **new** — drift pin and predicate cases.
- `packages/game-engine/src/index.ts` — **modified** — two exports.
- `apps/server/src/coach/sequenceTeacher.logic.ts` — **modified** — RS-2.
- `apps/server/src/coach/sequenceTeacher.logic.test.ts` — **modified** — new cases only; the 13 existing tests unedited.
- Governance at close: as listed in Scope; `docs/ai/post-mortems/01.6-WP-900-coach-order-safe-enabler.md` — **new**.

## Non-Negotiable Constraints

- Full file contents for every new or modified file, no diffs or snippets. ESM only; Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (functions ≤ ~30 lines, `for...of`, no `.reduce()`, no nested ternaries, full-word names, JSDoc on every function). No new npm dependency; tests use `node:test` / `node:assert` only.
- The engine module is pure: no `boardgame.io`, no registry, no I/O, no `G`. It imports `WAIT_AND_SEE_CONDITION_TYPES` and types only.
- The server holds no condition-type or count-source literal for the enabler rule; it calls `isOrderSafeEnablerHook`.
- No existing assertion is weakened, skipped or edited; the 13 existing server tests pass unedited.
- Determinism: no hash pin, golden or `finalStateHash` moves. A moved pin is a STOP.
- **STOP and report** if: a hash pin moves; an existing server test needs an edit; a test card in `## Assumes` parses to different hooks at HEAD; the new module cannot import `WAIT_AND_SEE_CONDITION_TYPES` without a cycle.
- **Locked values:** EC-938 `## Locked Values`.

## Contract

- `ORDER_SAFE_ENABLER_CONDITION_TYPES` (order and membership as in Scope) and `isOrderSafeEnablerHook(hook)` on the engine `.` surface.
- The enabler rule: a later same-turn card is a tip enabler only when every one of its hooks passes `isOrderSafeEnablerHook`, and `heroConditionHoldsForInPlay(gate, whiffed, [candidate], cardData) === 'holds'` (unchanged).

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §10, §22 (Deterministic & Reproducible Evaluation).
- **No conflict:** the coach stops giving advice that costs the player Attack or Recruit.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched: display-only advice; never score, PAR or grade.
- **Determinism preservation:** no engine behaviour or hash change; the teacher stays a pure read over the D-24119 replay.

## Funding Surface Gate

N/A — the Legendary Pass coach card's tip content narrows; no nav, profile, pricing, entitlement or tournament-funding surface, and no donate / support copy.

## API Catalog Update

N/A, decided: the `/api/me/scores/:replayHash/coach` row describes `sequenceTips` as "deterministic server-computed play-order opportunity tips merged onto the report before persistence", and the `/api/me/matches/:matchId/coach` row says it returns the same shape. That stays true; the response shape, auth and status of both are unchanged. `computeSequenceTips` is not a catalogued library function. D-24857 records the decision.

## Acceptance Criteria

1. Engine drift pin (runtime): `ORDER_SAFE_ENABLER_CONDITION_TYPES` deep-equals an explicit 14-literal list in the test (the 13 wait-and-see literals in `WAIT_AND_SEE_CONDITION_TYPES` order, then `'firstHeroPlayedThisTurn'`), so a wait-and-see addition is a visible, reviewed change here; has no duplicate; contains every `WAIT_AND_SEE_CONDITION_TYPES` member; and is disjoint from `SEQUENCE_GATE_CONDITION_TYPES` and `PLAY_HISTORY_CONDITION_TYPES`.
2. `isOrderSafeEnablerHook` is `true` for: a hook with no conditions and a flat `attack` effect; a hook whose only condition is `recruitMadeThisTurnAtLeast`; one whose only condition is `firstHeroPlayedThisTurn`; an `attack` effect whose `attackRestriction` has no `widenToMastermindWhen`; an effect whose `bothCondition` is `recruitMadeThisTurnAtLeast`; an `attackRestriction.widenToMastermindWhen` of `firstHeroPlayedThisTurn` only (these two prove the allowlist branches are not blanket rejections).
3. Every `false` fixture is the AC 2 baseline (no conditions, one flat `attack` effect) plus exactly one rejecting field; a nested fixture's outer effect carries no top-level rejecting field (e.g. a `heist` outer effect, not a `digest-indigestion` one with `digestThreshold`). It is `false` for one hook each of: `heroClassMatch`; `playedThisTurn`; each `PLAY_HISTORY_CONDITION_TYPES` member; `bystandersInVictoryAtLeast`; `patrolSpaceEmpty`; an unknown type `'notARealCondition'`; an allowlisted condition beside a disallowed one; an `attack-per-count` effect with a `countSource`; a `count-scaled-choose` effect with a `count-scaled` option; a non-empty `primitiveEffects`; a `bothCondition` `heroClassMatch`; an `attackRestriction.widenToMastermindWhen` `heroClassMatch`; a `digestThreshold`; an `empoweredClass`; a non-empty `empoweredClasses`; a non-empty `sunlightEffects`; a non-empty `moonlightEffects`; a `countSource` nested in each of `digestEffects`, `indigestionEffects`, `excessiveViolenceEffects` and `heistEffects` (each outer effect otherwise clean); a `rewardComposition`; a `nonGreyHeroKoAttack`; `type: 'no-more-draws'`. A keyset test asserts every key the classification tables mark `'rejected'` or `'recursed'` (other than `conditions` / `effects` / `primitiveEffects`, covered above) appears in this case list: the AC 3 `false` cases are a test-local record keyed by field name, which the keyset test reads. The `type` key is `'safe'` in the table; `no-more-draws` is a case keyed under that keyword, outside the keyset check.
4. Server, real card data (hooks from `buildHeroAbilityHooks` over `data/cards/<abbr>.json`, the first copy; class from the card's `hc`; `cardDisplayData[<id>] = { name: <card displayName> }`, the `sequenceTeacher.logic.test.ts` ~326-357 precedent): a hand-built test card with a `heroClassMatch` gate on the enabler's class is played first and whiffs; the real card is played later the same turn. **No tip** for each of: KGB Training (`playedThisTurn`), Eighth Time's a Charm (`cardPlayOrdinalEquals`), Four of a Kind (other-cost), Hunt High and Low (`patrolSpaceEmpty`), Winged Salvation (`bystandersInVictoryAtLeast`), Oddball (count-scaled), Bend Steel (composition primitive), Devouring Drool (`bothCondition` + `digestThreshold`), Shenanigans (`no-more-draws`). Each case first asserts that the real card's hooks carry the expected condition type or structure, and then re-runs the same plays with the real card's hooks removed from `heroAbilityHooks` and asserts exactly one tip, so fixture drift (a missing `cardTraits` entry, a mismatched class) fails in-file rather than passing vacuously.
5. Controls, same shape: Surge of Power (wait-and-see only) and First Strike (`firstHeroPlayedThisTurn` only) each yield exactly one tip, `Next time, play Surge of Power before <test card> — …` / `Next time, play First Strike before <test card> — …`.
6. The 13 existing `computeSequenceTips` tests pass with no edit.
7. Revert proof: with the server check temporarily restored to the `SEQUENCE_GATE_CONDITION_TYPES` deny-list, all nine AC 4 cases fail (each yields a tip). Recorded in the `EC-938:` body; not committed.
8. `pnpm -r build`; `pnpm -r --no-bail test` 0 fail, per-package totals recorded (server DB-gated skips stay skips); every hash pin unchanged; `ledger:numbers:check`, `roadmap:counts:check`, `workindex:rows:check`, `workindex:executed:check` exit 0.

## Verification Steps

Run in order; each exits 0. Record the engine and server test counts before and after.

```pwsh
pnpm -r build
pnpm -r --no-bail test
pnpm ledger:numbers:check
pnpm roadmap:counts:check
pnpm workindex:rows:check
pnpm workindex:executed:check
git diff --name-only origin/main...HEAD   # a subset of ## Files Expected to Change
```

Live (D-24026, after deploy): an operator match (Jeff's account, Legendary Pass) whose coach is first generated after the deploy (reports are cached per match). The teacher emits at most one tip per seat, the first teachable one in log order, so one match covers both checks only if the negative turn comes first: on an early turn a covert-gated card is played first and whiffs and KGB Training (or Four of a Kind / Eighth Time's a Charm with a matching gate class) is played later; on a later turn a covert-gated card whiffs and First Strike (or Surge of Power, ranged) follows. Stage the hands with the operator setter pane. Finish the match and open the coach: the tip names the control card, never the negative one. If a finished, coachable match cannot be staged, propose `[live-verify: n/a]` with the reason for Jeff to decide; never record a pass that did not happen.

## Definition of Done

- [ ] Acceptance Criteria 1-8 pass, with the Verification tails recorded in the `EC-938:` body.
- [ ] Hash pins byte-unchanged.
- [ ] **Live-on-surface (D-24026):** confirmed on a post-deploy report, or `n/a` decided by Jeff, recorded in STATUS and the WORK_INDEX token.
- [ ] D-24857 Active; STATUS entry; WORK_INDEX `[x]` with its live-verify token; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write`; NUMBER-LEDGER LANDED.
- [ ] 01.6 post-mortem authored (a new engine export consumed across a layer).
- [ ] No files outside `## Files Expected to Change` modified.

## Reserved Decision (lands at execution)

D-24857 — The sequence teacher's enabler rule is fail-closed and engine-classified (amends D-24533's net-gain rule):

- **Trigger:** D-24746 made `playedThisTurn` real and D-24568 added play-history gates, so D-24533's deny-list ("no class / team / keyword gate") let order-dependent cards through as enablers.
- **Rule:** a later same-turn card is an enabler only when every hook, whatever its timing, passes the engine's `isOrderSafeEnablerHook`: every hook condition type in `ORDER_SAFE_ENABLER_CONDITION_TYPES` (wait-and-see ∪ `firstHeroPlayedThisTurn`), no composition primitive, and every effect (recursively through its nested effect arrays) free of a count source, a count-scaled choose option, a non-order-safe `bothCondition` or `widenToMastermindWhen` condition, Digest, Empowered, day / night branches, a reward composition and a deck-KO Attack count, and no `no-more-draws` effect.
- **Forward rule:** a new condition type is not order-safe until the engine adds it to the allowlist with a reason; a new wait-and-see type joins through `WAIT_AND_SEE_CONDITION_TYPES` (correct: a whole-turn re-check is order-safe) and also changes the explicit drift pin, so the addition is reviewed. A new `HeroEffectDescriptor` or `HeroAbilityHook` field fails `tsc` until it is classified in the module's two `Record<keyof Required<...>>` tables.
- **Accepted loss:** unconditional count-scaled cards (Perfect Teamwork, Avengers Assemble, Oddball), Digest, Empowered and day / night cards, and cards carrying Excessive Violence or Heist effects that read state, stop being enablers.
- **Cached reports:** reports generated before the deploy keep their tips; no backfill.
- **API catalog:** no row change (behaviour text still accurate).
- **Residuals / follow-ups:** effect keywords whose handler reads present state at resolve (the enumerated list from the execution probe); enabler effects other than `no-more-draws` that change the turn for the cards they precede; a match created before a parser change is judged on its setup-time hooks; displaced-card losses (ordinal and first-Hero gates of the cards the move pushes later); teaching tips for play-history gates.

## Gate Record

Each gate ran as an independent subagent against the files at HEAD `decede76a` (after reserve PR #3424 merged).

- **01.4 pre-flight: READY TO EXECUTE** (round 3).
  - Round 1 NOT READY. PS-1: conditions and count sources nested in effect descriptors escaped the predicate (Devouring Drool's `bothCondition` + `digestThreshold`, Warlock's day / night, a nested `digestEffects` count source, Empowered). Folded as the recursive `isOrderSafeEffect`. RS items applied: the keyword residual worded as a class; anchors corrected; AC 5 via `cardDisplayData`; an explicit 14-literal drift pin; timing-agnostic rejection stated.
  - Round 2 READY, with three clarifications applied: `rewardComposition` (Violent Conditioning) and `nonGreyHeroKoAttack` rejected; the `HeroEffectDescriptor` type import.
  - Round 3 READY (folds confirmed); descriptor-field anchors corrected.
- **01.7 copilot check: CONFIRM** (round 3).
  - Round 1 RISK → HOLD, nine findings, all applied: Shenanigans (`no-more-draws`) still gave a wrong tip, now rejected (#26); the Goal reworded and the keyword residual enumerated from a corpus probe (#26 / #14); the forward rule made compile-enforced by two `Record<keyof Required<…>>` tables (#14 / #4); AC 3 fixture discipline and the missing nested cases (#11); a permanent in-file control per AC 4 case (#11); the setup-time-hooks residual (#28); the three-helper split pre-locked (#25); the live plan's one-tip-per-seat ordering (#9).
  - Round 2 RISK → HOLD, six fold consistency items, all applied (the `moonlightEffects` case, day / night rejected not recursed, the tables' non-barrel export, the probe defined as a throwaway script, a stale count, the keyset record).
  - Round 3 CONFIRM.
- **00.3 lint: PASS** (run 2). Run 1 FAIL on §2 (full-file rule did not cover modified files) and §7 (no `node:test`-only / no-new-dependency line); both fixed, plus five wording fixes (keyword path, §21 wording, EC type-import lock, WORK_INDEX summary, post-mortem marked new). Run 2 confirmed none changed scope, allowlist, contract or predicate semantics, so the 01.4 / 01.7 verdicts stand.

## Lint Gate Self-Review (00.3)

- §1 Structure: PASS — all ten required sections; Out of Scope names five exclusions (whiff side; residuals, tip shape, wording, client; cached reports; engine behaviour, hash, card data; Done docs).
- §2 Constraints: PASS — full contents for every new or modified file, no diffs; ESM; Node v22+; `00.6`; purity and server-literal rules; a four-trigger STOP protocol; locked values in EC-938.
- §3 Assumes: PASS — baseline `decede76a`; server, test, merge-point and engine anchors by file and line; the eleven test cards verified against the built engine; Hard-deps ✅.
- §4 Context: PASS — ARCHITECTURE §Principles #2 and §Layer Boundary; the rules import table; a D-entry list; `00.6`; no `00.2` field touched.
- §5 Files: PASS — 5 code files (2 new, 3 modified) plus governance, the post-mortem marked new; matches EC Files to Produce.
- §6 Naming: PASS — full-word names, consistent across WP, EC and index rows.
- §7 Dependencies: PASS — no new npm dependency; `node:test` / `node:assert` only.
- §8 Boundaries: PASS — pure engine module; the server imports only the `.` surface and holds no condition-type literal.
- §9 Windows: PASS — `pnpm` / `git` only.
- §10 Env vars: N/A — none.
- §11 Auth: N/A — coach auth and the Legendary Pass gate unchanged.
- §12 Tests: PASS — `node:test` `.test.ts`; real `data/cards` parsed from disk; in-file controls; a revert proof.
- §13 Verification: PASS — exact build / test / `:check` commands; a scope diff; a concrete live plan.
- §14 Acceptance Criteria: PASS — 8 binary criteria naming real cards, literals and fixture discipline.
- §15 Definition of Done: PASS — STATUS, D-24857, WORK_INDEX token, EC_INDEX, mindmap, NUMBER-LEDGER, 01.6, scope check; §15.1 surface + live item; §15.2 Risk Tier verbatim in the EC.
- §16 Code style: PASS — `00.6`; the three-helper split locked; `for...of`, no `.reduce()`, no nested ternaries; `// why:` sites in the EC.
- §17 Vision: PASS — §1, §10, §22; no-conflict, NG-1 and determinism lines.
- §18 Prose-vs-grep: N/A — no literal grep step.
- §19 Bridge staleness: N/A — baseline re-recorded at commit.
- §20 Funding: PASS (N/A with reason).
- §21 API catalog: PASS (N/A with reason).
- **EC-938:** 81 non-empty lines, under the ceiling; Risk Tier verbatim; Locked Values match the WP.
- **Overall:** PASS.
