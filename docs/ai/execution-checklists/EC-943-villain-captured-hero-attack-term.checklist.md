# EC-943 — Captured-Hero Attack term is opt-in (Execution Checklist)

**Source:** docs/ai/work-packets/WP-905-villain-captured-hero-attack-term.md
**Layer:** Game Engine
**Risk Tier:** MEDIUM — a correctness gate on the single fight-cost authority (the engine's outcome-deciding layer) plus one new contract `G` field. Zero fight-cost / gameplay change for any current match; the enforced determinism gates (the `sentinel-core-doom-2p` `finalStateHash` fixture and the core-only spike-bundle `initialStateHash`, both Skrull-free) are byte-identical; D-24026 live-verify N/A. A match that selects a hero-capturing villain group gains the omit-when-empty `villainCapturedHeroCost` field in its full-`G` hash (the accepted WP-838 / WP-841 / WP-760 omit-when-empty pattern). No auth, money, persistence, server, or client surface.

## Before Starting
- [ ] Target file set is EXACTLY the `Files to Produce` list below; any file outside it is a FAIL — surface as a blocker, do not improvise.
- [ ] `origin/main` synced; baseline SHA recorded in the WP `§Assumes` (`2fa49f587`). Rebase onto whichever of WP-902 (Elite Assassins) or WP-903 (Taskmaster's Thunderbolts, landed on `main` as #3449) has executed — all three share `economy/economy.resolve.ts` + `setup/buildInitialGameState.ts`; WP-903's Bullseye capture must opt into `villainCapturedHeroCost`.
- [ ] `pnpm -r build` exits 0; record the game-engine `test` count (before).
- [ ] Confirm builder shapes: `buildVillainVariableAttack` (`setup/villainDefeatRequirement.setup.ts:591`) + `buildVillainAttackPerCaptured` (same file, L775) use structured line parsers; `buildVillainBloodFrenzy` lives in its **own file** `setup/buildVillainBloodFrenzy.ts` (the new builder is a new file → mirror that precedent). Wiring: build at `buildInitialGameState.ts` L505-521, omit-when-empty spread at ~L1030-1043.

## Locked Values (do not re-derive)
- New field: `villainCapturedHeroCost?: Record<CardExtId, true>` — omit-when-empty, engine-internal (NOT projected), immutable after setup.
- `HERO_CAPTURE_EFFECT_MARKERS` (verbatim): `captureHqHeroRightmost`, `captureHqHeroHighestCost`, `captureHqHeroLowestCost`, `capture-hq-hero`, `capture-pile-hero`, `capture-hq-heroes-cost-lte`.
- Opt-in rule: a selected villain qualifies iff any `abilityLines` line carries a `HERO_CAPTURE_EFFECT_MARKERS` marker AND the card is NOT matched by `parseAttackPerCapturedLine` / `parseVariableAttackLine` (use those STRUCTURED parsers for the exclusion, not a raw substring test).
- Resolver gate (dynamic mode, after the `villainVariableAttack` / `villainAttackPerCaptured` early-return which stays FIRST): add `Σ(G.cardStats[heroId]?.cost ?? 0)` over `G.villainAttachedHeroes?.[id] ?? []` ONLY when `G.villainCapturedHeroCost?.[id] === true`; else return `fightCostBase`.
- Builder signature: `buildVillainCapturedHeroCost(registry: unknown, matchConfig: MatchSetupConfig): Record<CardExtId, true>`; fan one `true` per `villainCard.instanceExtIds`; narrow mock → `{}`.
- Expected opted-in set for a co2e-skulls + core-skrulls match: the four Skrull capturers only; Venom excluded (attack-per-captured); HYDRA Kidnappers may appear but is static so never resolves dynamically.

## Guardrails
- Do NOT change `fightCostMode` / `fightCostBase` assignment, the `vAttack` parser, or the overlay branches (Killbot / Skrull-conversion / micro-sized / Officer / stack).
- Do NOT edit any card data, `scripts/convert-cards/**`, or add any ability marker, primitive, move, phase, or other `G` key.
- `finalStateHash` sentinel + spike-bundle `initialStateHash` MUST stay byte-identical (the field is omit-when-empty; featured setup has no Skrull). If either drifts, STOP and investigate — do not re-baseline.
- The existing `villainVariableAttack` / `villainAttackPerCaptured` early-return stays ahead of the new gate (defence-in-depth).
- `resolveFightCost` has FOUR consumers: the fight move, the bot (`getLegalMoves`), the City `fightCost` projection, and `buildPureFuryTargets` (`hero/heroEffects.execute.ts:5785`). `git grep` all four surfaces for red tests, not just the first three.
- The breaking-fixture migrations (`economy.resolve.test.ts` base/multiple/T9/T11 + `ai.legalMoves.test.ts` dyn-villain + `pureFury.logic.test.ts` L407-418) encode an intended behaviour change (reward-integrity): MIGRATE by setting the opt-in flag to preserve the asserted totals (or adding a no-flag base case), NEVER weaken/delete an assertion to go green. T9's title asserts the INVERTED invariant ("no entry keeps it") — rewrite it; do not leave it contradicting the code.
- Spread `villainCapturedHeroCost` onto `G` ONLY when non-empty.

## Required `// why:` Comments
- `types.ts` field: WP-905 / D-24862; the `villainBloodFrenzy` precedent; opt-in, not inferred from the `+`/`*` marker.
- `economy.resolve.ts` gate: the `+`/`*` marker no longer implies the captured-Hero cost rule (D-24862); carve-outs stay first.
- `buildVillainCapturedHeroCost.ts`: why the capture-ability markers (not the `vAttack` glyph) are the opt-in signal.

## Files to Produce
- `packages/game-engine/src/types.ts` — **modified** — `villainCapturedHeroCost?` field.
- `packages/game-engine/src/setup/buildVillainCapturedHeroCost.ts` — **new** — builder + `HERO_CAPTURE_EFFECT_MARKERS`.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — build + omit-when-empty spread.
- `packages/game-engine/src/economy/economy.resolve.ts` — **modified** — gate the cost term on the new map.
- `packages/game-engine/src/setup/buildVillainCapturedHeroCost.test.ts` — **new** — builder unit test: positive (capture marker qualifies), negative (no-capture / bystander-capture line does NOT qualify), Venom excluded via structured parser, instance-id fan-out, narrow mock → `{}`; PLUS a non-vacuous drift assertion that `HERO_CAPTURE_EFFECT_MARKERS` ⊇ the FIVE data-marker tokens the builder scans (`captureHqHeroRightmost/HighestCost/LowestCost`, `capture-pile-hero`, `capture-hq-heroes-cost-lte` — NOT the kebab dispatch primitives) + a phantom-token negative.
- `packages/game-engine/src/economy/economy.resolve.test.ts` — **modified** — migrate EVERY no-flag dynamic captured-cost assertion (reward-integrity, not weakening): base `*` L74-82, `N+` L113-121, multiple-heroes L139-151 + L154-166, **T9 L965-979** (rewrite the inverted title + `OTHER_DYNAMIC` L979), **T11 L1005-1023** (L1015/L1023); `makeG` (L28-36) gains `villainCapturedHeroCost?`. Set the flag to preserve cost-capturer totals; add no-flag latent-trap (base) cases.
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** — the `dyn-villain` affordability regression (~L631-655): set `gameState.villainCapturedHeroCost = { 'dyn-villain': true }` so resolved cost stays 5 (unaffordable).
- `packages/game-engine/src/hero/pureFury.logic.test.ts` — **modified** — the `villain-dyn` captured-Hero case L407-418: set `G.villainCapturedHeroCost = { 'villain-dyn': true }` so `buildPureFuryTargets` resolves it to 3 (the `[]` assertion holds).
- `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` — **modified (required)** — a present/absent assertion pair mirroring T15 / T29 (`villainVariableAttack` L598-615 / `villainAttackPerCaptured` L640-668).
- `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md` — governance.

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0 (record after-count); `pnpm -r --no-bail test` green.
- [ ] `git grep -n villainCapturedHeroCost packages/game-engine/src` — read only in `resolveBaseFightCost`, written only in the builder + setup spread; no UIState reference.
- [ ] `finalStateHash` sentinel + spike-bundle `--check` unchanged (no determinism drift).
- [ ] Live-on-surface: **N/A** — behaviour-preserving; `docs/ai/STATUS.md` states "No user-observable change — infrastructure only"; WORK_INDEX row closes ` [live-verify: n/a]`.
- [ ] `docs/ai/DECISIONS.md` D-24862 → Active; `WORK_INDEX.md` checked with date; `EC_INDEX.md` Status `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅`; `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- A Skrull match's fight cost changes from baseline → the opted-in set is wrong (builder missed `captureHqHero*`, or the gate dropped a carve-out).
- `finalStateHash` drift → the field was spread when empty, or the gate changed a non-Skrull villain's cost.
- Venom's cost changes → the `attack-per-captured` early-return was reordered or the builder failed to exclude it.
