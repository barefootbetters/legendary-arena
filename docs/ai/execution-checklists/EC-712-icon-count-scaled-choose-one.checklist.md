# EC-712 — icon-presence count sources + count-scaled choose-one (Execution Checklist)

**Source:** docs/ai/work-packets/WP-675-icon-count-scaled-choose-one.md
**Layer:** Game Engine + Arena Client
**Status:** Draft (pre-execution)

## Before Starting
- [ ] WP-247 (attack-per-count / D-24016) shipped
- [ ] WP-674 (recruit-per-count + count-source recipe / D-24489) shipped
- [ ] WP-286 (draw-or-empowered pending-choice + UIState precedent / D-24069) shipped — read its handler, resolve move, block-all guards, `UIPendingDrawOrEmpowered` projection, and client renderer FIRST; this WP mirrors it
- [ ] `pnpm -r build` exits 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] Per-unit rate = **1** for both options
- [ ] Icon presence = the RAW registry value is non-null (`card.attack != null` / `card.recruit != null`) — NOT `cost>0`, NOT `parsed value > 0` (a `"0+"` card HAS the icon)
- [ ] New count-source slugs = `attack-icon-played-this-turn`, `recruit-icon-played-this-turn` (digit-free, fit the locked token form — no gate widening)
- [ ] Marker target = `vnom` / `venom` / `symbiotic-adaptation` (the two option ability lines)
- [ ] recruit option → `[keyword:recruit-per-count:recruit-icon-played-this-turn:1]`; attack option → `[keyword:attack-per-count:attack-icon-played-this-turn:1]`

## Guardrails
- [ ] `HERO_COUNT_SOURCES` union AND array updated together; drift pin RUNTIME (N=3→5), not `satisfies`
- [ ] `hasAttackIcon`/`hasRecruitIcon` populated identically at EVERY `CardStatEntry` build site (mock + real setup)
- [ ] **Dual hash re-pin** (`PRE_WP080_HASH` + sentinel `finalStateHash`): re-pin ONLY after confirming the sole canonical-JSON delta is the two new `cardStats` fields; one-line rationale in the pin comment + D-24490
- [ ] Resolver pure/total: reads only `G`, no throw, no registry read; excludes `triggeringCardId`
- [ ] `"0+"` cards ARE counted (faithful presence) — add an explicit test for a `"0+"` card
- [ ] Block-all guard added to EVERY move site that guards `hasPendingDrawOrEmpowered` (grep it; ~6 sites) — a missed site lets an action bypass the choice
- [ ] The pending choice has a `UIPendingCountScaledChoice` projection through BOTH `buildUIState` AND `filterUIStateForAudience` (five-step Board-Visible Field contract) BEFORE merge — a build-only field is dropped at the filter and the game freezes with no UX
- [ ] Choice is active-player-scoped (redacted from other audiences)
- [ ] Card data fixed via marker SOURCE + reproducible regen, never a hand-edit of `vnom.json`

## Required `// why:` Comments
- [ ] `CardStatEntry` icon-presence fields cite WP-675 / D-24490 + the null-vs-`"0+"` faithfulness rationale
- [ ] `heroCountSource.ts` union + array entries (both sources) cite WP-675 / D-24490
- [ ] Every `ctx.events.*` (none expected) and the block-all guards cite D-24069 (block-all pending pattern) + WP-675
- [ ] The dual re-pin comment states the delta is only the new cardStats field

## Files to Produce
- [ ] `economy/economy.types.ts` (`CardStatEntry` + fields) + the setup build site(s) that populate them
- [ ] `rules/heroCountSource.ts` — two sources (N=5)
- [ ] `hero/heroCountSource.resolve.ts` — two resolver branches
- [ ] `types.ts` — `PendingCountScaledChoice` + `G.pendingCountScaledChoice`; `ui/uiState.types.ts` — `UIPendingCountScaledChoice`
- [ ] `hero/heroEffects.execute.ts` — park handler + HANDLED/dispatch (or a choose-one park path)
- [ ] `moves/countScaledChoice.resolve.ts` — `resolveCountScaledChoice` + `hasPendingCountScaledChoice`; register in `game.ts`; block-all guards across move sites
- [ ] `setup/heroAbility.setup.ts` — the choose-one pre-pass emitting the two-option descriptor
- [ ] `ui/uiState.build.ts` + `ui/uiState.filter.ts` — projection + pass-through
- [ ] arena-client — the choice renderer (draw-or-empowered UI model)
- [ ] `inputs/hero-ability-markers.json` (2 markers) + `vnom.json` regen
- [ ] `scripts/coverage/mechanic-provenance.json` — two source rows → WP-675 / D-24490
- [ ] tests: resolver (incl. a `"0+"` card + self-exclusion), choose-one parse, resolve move, UIState audience-filter, block-all, arena-client renderer; the re-pin fixtures
- [ ] Regenerated hero ledger + card-mechanics + effect-index + runtime-observed

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0
- [ ] `pnpm cards:check` reproducible
- [ ] `ledger:heroes:check` + `mechanics:metadata:check` + `effect-index:check` + `sim:runtime-observed:check` + `sim:coverage --check` green
- [ ] dual re-pin landed, delta verified = new cardStats field only
- [ ] D-24490 Active; WORK_INDEX `[x]` row + EC_INDEX row flipped; roadmap mindmap [d]→[x]
- [ ] `Tests-changed:` trailer (fixtures re-pinned for an intentional engine change); PR squash-merged when green

## Common Failure Smells
- Count drops `"0+"` cards → the icon test used a parsed/`>0` value instead of raw non-null.
- Game freezes on play → block-all guard added but no UIState projection (or projection stops at build, dropped by the filter).
- An action slips through during the choice → a move site missing the `hasPendingCountScaledChoice` guard.
- Every unrelated replay fixture fails → expected (the cardStats field re-pins the oracles); confirm the delta is ONLY the new field before re-pinning, never re-pin to mask an unrelated shift.
