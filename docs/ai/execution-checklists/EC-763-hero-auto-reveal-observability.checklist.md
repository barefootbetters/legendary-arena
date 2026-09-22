# EC-763 — Auto-resolving hero-effect reveal observability

**WP:** WP-726 · **Layer:** Game Engine (+ one Arena Client render test) · **Status:** Pending
**Lands:** D-24547

> Emit the WP-697 `heroEffectResolved` "Hero Ability" overlay from the auto-resolving
> deck-top reveal family (`heroEffectReveal` → `applyRevealRules`) so a reveal names the
> flipped card + its grant on-screen. Reuses the WP-697 variant + overlay verbatim.

## Before Starting

- [ ] Baseline: `origin/main` @ the WP-726 reserve commit (`ba472a07`) or later; fresh worktree, `pnpm install`.
- [ ] Read `docs/ai/work-packets/WP-726-hero-auto-reveal-observability.md`, `.claude/rules/architecture.md §UIState Projection Integrity`, `.claude/rules/code-style.md`, and auto-memories `project_hero_effect_resolved_overlay` + `reference_hashed_g_field_dual_repin`.
- [ ] Confirm on `main`: `HeroEffectResolvedEvent {type,playerId,narrative}` (notableEvents.types.ts), `composeHeroRevealAttackNarrative` (notableEvents.compose.ts:433), the WP-325 `pushLog` in `applyRevealRules` (heroEffects.execute.ts ~1703), and that `NotableEventOverlay.vue` renders `heroEffectResolved` narratives with the card row suppressed.
- [ ] Confirm `G.notableEvents` is hashed by BOTH `computeStateHash` (replay.hash.ts) and `hashGameState` (it is NOT in the exclusion list). Record the current engine test totals + the sentinel `finalStateHash` + `PRE_WP080_HASH` BEFORE editing (the byte-unchanged baseline).

## Locked Values

- [ ] `composeHeroRevealTopNarrative(sourceCardName: string, revealedCardName: string, cost: number, outcomeText: string): string` — pure; one byte-stable THIRD-PERSON sentence, NO "Player N" prefix (sibling composer's voice; seat rides on the event `playerId`); NO `G`/registry read. Golden shape e.g. `"High Stakes Jackpot revealed Sneak Attack (cost 4) — gained +4 attack."`.
- [ ] `HeroEffectResolvedEvent {type:'heroEffectResolved'; playerId:string; narrative:string}` — REUSED verbatim. No new type, no new field, no `NOTABLE_EVENT_TYPES` change.
- [ ] Emit gate (ALL four): `matchedPredicateText !== undefined` AND matched actions exclude `choose-discard-or-return` AND `revealLogOutcome !== 'blocked'` AND `Array.isArray(G.notableEvents)`.
- [ ] Emit site: `applyRevealRules`, immediately after the WP-325 `pushLog(...)`; `sourceCardId` threaded in as an added parameter from the `heroEffectReveal` caller (its 4th param `_cardId`, `heroEffects.execute.ts:1526`, currently underscore-unused — rename to `cardId`; single call site at `:1593`). The WP-325 `pushLog` sits INSIDE `if (Array.isArray(G.messages))` (`:1682`), which is where `matchedActionPhrases`/`revealLogOutcome` are scoped — so emitting right after it is transitively gated on `G.messages` too: either accept that (tests seed BOTH `messages` + `notableEvents`) or hoist `revealLogOutcome`/`matched*` to function scope and emit after the block.
- [ ] Auto-resolve gate realization: use the existing `revealRulesContainAnyAction(rules, ['choose-discard-or-return'])` (`heroEffects.execute.ts:1859`) — do NOT hand-roll a matched-action-kind accumulator (the loop collects action PHRASES, not kinds). Exact for the card set because `reveal-attack-choose`'s choose rule predicate is `always`.

## Guardrails

- [ ] **Reveal behavior byte-identical.** The peek, the grant (`G.turnEconomy`), deck order, KO/draw, and the WP-325 `G.messages` line are unchanged; only a `heroEffectResolved` event is appended.
- [ ] **Auto-resolve only.** No emit when a choose action matched (parking reveals surface via the pending-choice UI) or when `revealLogOutcome === 'blocked'`.
- [ ] **Determinism.** `G.notableEvents` is hashed by BOTH oracles → NO re-pin expected (core-only sentinel + empty PRE_WP080 play no deck-top-reveal hero — WP-697 outcome). VERIFY empirically. If a pin shifts, dual re-pin HONESTLY: `scripts/record-game-fixture.mjs` for `sentinel-core-doom-2p.replay.json` (never hand-edit) + `PRE_WP080_HASH` constant with a provenance comment. NEVER edit a pin to force green; NEVER re-route the event to dodge a pin.
- [ ] **Reuse the WP-697 variant + overlay.** No client source change; the arena-client touch is a render test only.
- [ ] **Guarded + best-effort.** Wrap the emit in `Array.isArray(G.notableEvents)`; handlers never throw.
- [ ] **No `.reduce()`** in the compose/emit path; explicit `for...of`; JSDoc on every new function.

## Required Comments (`// why:`)

- [ ] On the emit: `// why: WP-726 / D-24547 — surface the auto-resolving deck-top reveal on the WP-697 heroEffectResolved overlay (auto-resolve gate; parking reveals own their own UI).`
- [ ] On `composeHeroRevealTopNarrative`: `// why: WP-726 — reveal-family sibling of composeHeroRevealAttackNarrative; pure assembler (D-20001 card-less payload).`
- [ ] If a re-pin proves necessary: provenance comment on `PRE_WP080_HASH` naming WP-726 + the fixture that shifted.

## Files to Produce

- [ ] `packages/game-engine/src/events/notableEvents.compose.ts` — modified — `composeHeroRevealTopNarrative`
- [ ] `packages/game-engine/src/events/notableEvents.compose.test.ts` — modified — golden + purity
- [ ] `packages/game-engine/src/hero/heroEffects.execute.ts` — modified — guarded emit + `sourceCardId` pass-through
- [ ] `packages/game-engine/src/hero/heroEffects.execute.test.ts` — modified — emit / no-emit-on-park-or-blocked / guarded / byte-identical-grant
- [ ] `apps/arena-client/src/components/play/NotableEventOverlay.test.ts` — modified — reveal narrative renders (no `.vue` change)
- [ ] A filter regression test asserting `notableEvents` (carrying a `heroEffectResolved` reveal event) survives `filterUIStateForAudience` for every audience — add to `packages/game-engine/src/ui/uiState.filter.test.ts` (absent today).
- [ ] Conditional (only if a pin shifted): `sentinel-core-doom-2p.replay.json` + `PRE_WP080_HASH` (dual re-pin).

## After Completing

- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` green with hash pins UNCHANGED (or honestly re-pinned + named); arena-client `vue-tsc` 0 + suite green.
- [ ] Land D-24547 (Active) in `DECISIONS.md`; update `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ `pnpm roadmap:counts:write`), `NUMBER-LEDGER.md` (mark WP-726/EC-763/D-24547 landed) in the governance-close commit.
- [ ] D-24026 live-verify on `play.legendary-arena.com`: a real match plays Gambit *High Stakes Jackpot*; the "Hero Ability" overlay names the revealed card + grant (bundle `gitSha` descends from the merge).

## Common Failure Smells

- [ ] Emit fires for a parking reveal (`reveal-attack-choose`) → doubled surface. The choose-action gate must exclude it.
- [ ] A hash pin shifts and gets hand-edited to green instead of re-recorded → reward-integrity violation. Re-pin via the recorder + constant, or find the leaked mutation.
- [ ] The narrative composer reads `G`/registry → impurity; keep name resolution in the caller (the WP-697 pattern).
