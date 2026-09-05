# EC-683 — Recruitable S.H.I.E.L.D. Officer Supply (Execution Checklist)

**Source:** docs/ai/work-packets/WP-648-recruitable-shield-officer-supply.md
**Layer:** Cross-cutting (Game Engine + arena-client)

## Before Starting
- [ ] WP-016 (`recruitHero`), WP-541 / D-24350 (`gain-officer-current`), WP-129 (`SharedDecks` / `useTurnActions` / `useCardCostGating`) are on `main`.
- [ ] `buildInitialGameState` sets `cardStats[SHIELD_OFFICER_EXT_ID] = { attack: 0, recruit: 2, cost: 3, ... }`.
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] Target file set == `## Files to Produce` below; any modification outside it is a FAIL.

## Locked Values (do not re-derive)
- `SHIELD_OFFICER_EXT_ID = 'pile-shield-officer'`
- `OFFICER_RECRUIT_COST = 3` (buy cost); officer play-value is `recruit: 2` — gate on **cost**, never play-value
- Cost source: `G.cardStats[SHIELD_OFFICER_EXT_ID]?.cost ?? OFFICER_RECRUIT_COST`
- `G.currentStage !== 'main'` → return; `GlobalPiles`: `bystanders | wounds | officers | sidekicks | horrors`
- Move-count drift: `LegendaryGame.moves` 31 → 32 (`game.test.ts`)
- Block-all guard set: identical to `recruitHero` (same 15 `hasPending*` + `hasHealedThisTurn`)

## Guardrails
- `recruitOfficer` is NOT in `CoreMoveName` / `CORE_MOVE_NAMES` / `MOVE_ALLOWED_STAGES` (gates internally).
- `recruitOfficer` is NOT in `SIMULATION_MOVE_NAMES` — determinism oracles (`finalStateHash`, `PRE_WP080_HASH`, sentinel, `sim:runtime-observed`, Seed-PAR) MUST stay byte-identical. If any moves → STOP and investigate before re-pinning.
- Move never throws; empty supply / missing zone / short recruit / wrong stage / pending choice / heal-lock are silent no-ops.
- Client dispatches `recruitOfficer` with `{}` (no args); the Officer's `UICardDisplay.cost` is `null`, so do NOT route through `useCardCostGating.canRecruit`.
- Only the Officers cell becomes a button; the other four supply cells stay static counts.

## Required `// why:` Comments
- `recruitOfficer.ts`: the cost source + `OFFICER_RECRUIT_COST` fallback; the `piles.officers[0]` supply convention; the locked `pushLog` line.
- `game.ts`: the `client: false` (D-10008) registration rationale.
- `SharedDecks.vue`: the turn→stage→resource→empty-supply gate precedence; why `canRecruit` is not reused (null cost).
- `useTurnActions.ts`: the resource/supply check layers at the call-site.

## Files to Produce
- `packages/game-engine/src/moves/recruitOfficer.ts` — **new**
- `packages/game-engine/src/moves/recruitOfficer.test.ts` — **new**
- `packages/game-engine/src/game.ts` — **modified** (import + register)
- `packages/game-engine/src/index.ts` — **modified** (re-export)
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** (dispatch)
- `packages/game-engine/src/game.test.ts` — **modified** (move-count 31 → 32)
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified**
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified**
- `apps/arena-client/src/components/play/SharedDecks.vue` — **modified**
- `apps/arena-client/src/components/play/SharedDecks.test.ts` — **new**
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified**
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified**
- Governance: `docs/ai/NUMBER-LEDGER.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `DECISIONS.md`, `STATUS.md`, `wiki/shield-officer.md`

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm sim:runtime-observed:check` exits 0 (no regen)
- [ ] `Select-String ai.legalMoves.ts recruitOfficer` → no output
- [ ] Live-on-surface (D-24026): Officers cell recruitable in a live match on play.legendary-arena.com (post-deploy)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24460 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0
- [ ] Commit topology: `EC-683:` implementation + `SPEC:` governance close

## Common Failure Smells
- Move-count drift test fails "must define exactly 31/32 moves" → the `game.test.ts` expected array or count wasn't updated to 32.
- A hash oracle re-pins → `recruitOfficer` leaked into `SIMULATION_MOVE_NAMES` (or a fixture/replay recorded it); STOP, do not re-baseline.
- `SharedDecks` button always disabled → `canRecruit` (null-cost) reused instead of the dedicated officer gate.
- Client test `ERR_MODULE_NOT_FOUND` → run `pnpm -r build` first (workspace `vue-sfc-loader` / `game-engine` dist).
