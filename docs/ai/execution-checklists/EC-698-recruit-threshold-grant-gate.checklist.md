# EC-698 — Gate the co2e/ssw1 "made at least N recruit" Attack Grants on `recruit-threshold` (Execution Checklist)

**Source:** docs/ai/work-packets/WP-661-recruit-threshold-grant-gate.md
**Layer:** card-data pipeline (`hero-ability-markers.json` + regen) + tests (`packages/game-engine/src/setup/heroAbility.setup.test.ts`) — NO engine source change

## Before Starting
- [x] Baseline `origin/main` @ `7c04cb92` (after WP-660 / EC-697 merged).
- [x] Reproduce: probe `buildHeroAbilityHooks` for the five cards — confirm each attack grant is emitted with `conditions:[]` (ungated) and `mysterious-origin` has no effect.
- [x] `pnpm -r build` exits 0.

## Locked Values (do not re-derive)
- Markers (appended to `hero-ability-markers.json`): `co2e/thor/glory-of-asgard` abilityIndex 0 → `[keyword:recruit-threshold:8]`; `co2e/thor/spark-of-the-divine` abilityIndex 0 → `[keyword:recruit-threshold:8]`; `ssw1/lady-thor/chosen-by-asgard` abilityIndex 0 → `[keyword:recruit-threshold:6]`; `ssw1/lady-thor/living-thunderstorm` abilityIndex 0 → `[keyword:recruit-threshold:6]`; `ssw1/lady-thor/mysterious-origin` abilityIndex 0 → `[keyword:recruit-threshold:6]`.
- Thresholds: co2e Thor = **8**; ssw1 Lady Thor = **6** (the printed values).
- Reserved decision: **D-24472** (land Active at close). EC **EC-698**. WP **WP-661**.

## Guardrails
- **Card-data + tests only.** No `packages/game-engine/src/**` non-test edit (the `recruit-threshold` parser arm, `recruitMadeThisTurnAtLeast` evaluator, and `VALID_TOKEN_PATTERN` all ship on `main`). A source change ⇒ STOP.
- **Pipeline-applied, never hand-edited.** Add rows to `hero-ability-markers.json`, then `node scripts/convert-cards/apply-hero-ability-markers.mjs` (default output = `data/cards`). `--validate` must be clean; `cards:check` must reproduce ssw1.
- **No hash re-pin expected.** The sentinel game plays none of these cards. A hash test failure ⇒ STOP (would mean an unexpected sentinel interaction).
- **Derived-artifact regen IS expected here** (unlike WP-660): `co2e/thor` + `ssw1/lady-thor` move `(unmarked)→recruit-threshold/condition`. Regen `ledger:heroes` + `effect-index` + `mechanics:metadata`; confirm the diff is exactly those two rows + counts.
- **CRLF churn watch.** `pnpm -r build` may touch `packages/lagn-spec/schemas/lagn-v1.json` with a line-ending-only diff — `git checkout --` it; never commit it.

## Files to Produce
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 5 recruit-threshold rows.
- `data/cards/co2e.json`, `data/cards/ssw1.json` — **modified** — regenerated markers.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` — **modified** — regenerated derived feeds.
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — 6 tests (4 gated cards + control + mysterious-origin honest hollow).
- Governance: `NUMBER-LEDGER.md` + `DECISIONS.md` (D-24472) + `WORK_INDEX.md` (WP-661) + `EC_INDEX.md` (this row) + `docs/ai/STATUS.md` + `docs/05-ROADMAP-MINDMAP.md`.

## After Completing
- [x] `hero-ability-markers.json --validate` clean; only `co2e.json` + `ssw1.json` card files changed.
- [x] `pnpm -r build` → 0
- [x] `pnpm --filter @legendary-arena/game-engine test` → green (+6 tests; no hash re-pin) — **3093/3093**
- [x] whole-repo green (per-package verified: game-engine 3093, registry 248, preplan 52, lagn 102, registry-viewer 281, server 1302 +202 DB-skips, arena-client 1612)
- [x] `cards:check` + `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `sim:runtime-observed:check` green (after the expected regen)
- [x] `lagn-v1.json` CRLF churn reverted; `git diff --name-only` = the file set above and nothing else
- [x] D-24472 landed Active; WORK_INDEX (WP-661) + EC_INDEX (EC-698) + STATUS + mindmap updated
- [x] Follow-up (2) resolved: amwp Ghost mastermind INVESTIGATED — villain parser is `[effect:]`-marker-only, no phantom-recruit path, **no bug**, no change.
- [ ] **D-24026 operator-pending**: a live Lady Thor / co2e Thor match — the grant fires only after ≥N recruit this turn.

## Execution Result (2026-09-07)
Executed off `origin/main` @ `7c04cb92`. Probe confirmed all four attack grants ungated (`conditions:[]`) and `mysterious-origin` effect-less; after adding the 5 `recruit-threshold` markers each attack hook carries `recruitMadeThisTurnAtLeast:N` and `mysterious-origin` carries the gate with no fabricated effect. `apply-hero-ability-markers.mjs` updated exactly 5 lines; only `co2e.json` + `ssw1.json` changed. Hero derived chain regenerated: ledger `co2e/thor` + `ssw1/lady-thor` `(unmarked)→recruit-threshold/condition` (condition 23→25), effect-index + card-mechanics in lockstep (recruit-threshold cardCount 3→5). `pnpm -r build` 0; engine suite **3093/3093** (+6) with NO hash re-pin; whole-repo green; `cards` + `ledger:heroes` + `effect-index` + `mechanics:metadata` + `sim:runtime-observed` `:check` all green. `lagn-v1.json` CRLF churn reverted. Ghost mastermind: no bug (villain parser marker-only). **D-24026 operator-pending.** Pending commit/PR.
