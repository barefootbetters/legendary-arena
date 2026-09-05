# WP-648 — Recruitable S.H.I.E.L.D. Officer Supply

**Status:** Done 2026-09-04
**Primary Layer:** Game Engine + App (arena-client) — cross-layer, boundary-respecting (the client depends on the engine move; the engine imports no client code)
**Dependencies:** WP-016 (recruitHero), WP-541 / D-24350 (gain-officer-current pile mutation), WP-129 (SharedDecks / useTurnActions / useCardCostGating)
**User-Visible Surface:** play.legendary-arena.com

---

## Session Context

WP-016 established the `recruitHero` non-core, internally-stage-gated move pattern; WP-541 / D-24350 established the `G.piles.officers[0] → current player's discard` pile mutation (the free Fight reward `gain-officer-current`); WP-129 established the `SharedDecks` leaf, `useTurnActions` stage gating, and `useCardCostGating` resource gating. This packet composes those three to add a **player-initiated** Officer buy without modifying their outputs.

---

## Goal

After this packet, a player can **recruit a S.H.I.E.L.D. Officer from the shared supply for 3 recruit** during their Main step. The engine gains a new registered non-core move `recruitOfficer` (`packages/game-engine/src/moves/recruitOfficer.ts`) that moves the top `G.piles.officers` token to the current player's discard, spends the officer recruit cost, and marks `hasActedThisTurn`. The arena client's `SharedDecks` Officers cell becomes a gated recruit button that dispatches `recruitOfficer`.

---

## User-Visible Impact

On play.legendary-arena.com, the **S.H.I.E.L.D. Officers** cell in the shared-decks row becomes clickable during your Main step: click it to spend 3 recruit and add an Officer (worth +2 recruit when played) to your discard. It disables — with an explanatory tooltip — when it is not your turn, off the Main step, when you have fewer than 3 recruit, or when the supply is empty. This closes the reported bug: previously the only way to gain an Officer was a villain Fight reward (WP-541); there was no way to buy one.

---

## Assumes

- WP-016 complete: `packages/game-engine/src/moves/recruitHero.ts` exports `recruitHero`; it is registered in `game.ts` and NOT in `CoreMoveName` / `CORE_MOVE_NAMES` / `MOVE_ALLOWED_STAGES`.
- WP-541 / D-24350 complete: `G.piles.officers` holds `SHIELD_OFFICER_EXT_ID` tokens; `buildInitialGameState` sets `cardStats[SHIELD_OFFICER_EXT_ID] = { attack: 0, recruit: 2, cost: 3, ... }`.
- WP-129 complete: `apps/arena-client/src/components/play/SharedDecks.vue`, `composables/useTurnActions.ts`, `composables/useCardCostGating.ts` exist with the shapes cited in Scope.
- `UIState` exposes `economy.availableRecruit` (`uiState.build.ts`) and `piles.officersCount`.
- `pnpm -r build`, `pnpm --filter @legendary-arena/game-engine test`, and `pnpm --filter @legendary-arena/arena-client typecheck` exit 0 on `origin/main`.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the client may runtime-import the engine's `.` (Runtime-Safe) surface; the engine imports no client code. This WP respects that direction (client submits `recruitOfficer` by name; engine owns the move).
- `packages/game-engine/src/moves/recruitHero.ts` — the move-shell analog (three-step contract; the full block-all pending-guard set; the heal-lock).
- `packages/game-engine/src/villain/villainEffects.execute.ts` (`villainEffectGainOfficerCurrent`, WP-541) — the pile→discard mutation analog.
- `apps/arena-client/src/components/play/HQRow.vue` — the gate-composition + recruit-button pattern to mirror.
- `docs/legendary-universal-rules-v23.md §"HQ"` — "You can also recruit 'S.H.I.E.L.D. Officer' Heroes from the S.H.I.E.L.D. Officer stack"; core Officer cost 3, provides +2 recruit; no per-turn limit (unlike Sidekicks).

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never `Math.random()`; never throw inside a move (return void on invalid input).
- Never persist `G`; `G` stays JSON-serializable; ESM only; `node:` import prefix; `.test.ts` tests.

**Packet-specific:**
- `recruitOfficer` is NOT added to `CoreMoveName`, `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES` — it gates internally via `G.currentStage !== 'main'` (the recruitHero precedent).
- The block-all pending-guard set MUST match `recruitHero` exactly (same guard list + `hasHealedThisTurn`).
- The buy cost is `G.cardStats[SHIELD_OFFICER_EXT_ID]?.cost ?? OFFICER_RECRUIT_COST` where `OFFICER_RECRUIT_COST = 3`. The gate is on **cost (3)**, never the officer play-value (`recruit: 2`).
- `recruitOfficer` MUST NOT be added to `SIMULATION_MOVE_NAMES` (`ai.legalMoves.ts`) — keeping the simulation move-set unchanged so every determinism oracle (`finalStateHash`, `PRE_WP080_HASH`, sentinel, `sim:runtime-observed`, Seed-PAR) stays byte-identical. AI/PAR officer-buy behavior is a deferred follow-up.

**Locked contract values:**
- `SHIELD_OFFICER_EXT_ID = 'pile-shield-officer'`; `OFFICER_RECRUIT_COST = 3`.
- `GlobalPiles keys`: `bystanders | wounds | officers | sidekicks | horrors`.
- `TurnStage`: `'start' | 'main' | 'cleanup'`.

---

## Debuggability & Diagnostics

`recruitOfficer` appends one replay-visible `pushLog` line naming the recruited Officer, the spent recruit, and the remaining supply count. `G.messages` is hash-excluded (D-24081), so the line moves no oracle. Every branch (empty supply / missing zone / insufficient recruit / wrong stage / pending choice / heal-lock) is a deterministic silent no-op, covered by tests.

---

## Scope (In)

### A) Engine move — `packages/game-engine/src/moves/recruitOfficer.ts` (new)
- `recruitOfficer({ G, ctx }: MoveContext): void` and `export const OFFICER_RECRUIT_COST = 3`.
- Step 1 validate: supply non-empty; current-player zone present; `getAvailableRecruit(G.turnEconomy) >= cost`.
- Step 2 stage gate: `G.currentStage !== 'main'` → return.
- Block-all pending-guard set + `hasHealedThisTurn` (verbatim from recruitHero).
- Step 3 mutate: `G.piles.officers = G.piles.officers.slice(1)`; append token to `zones.discard`; `spendRecruit`; `G.hasActedThisTurn = true`; one `pushLog`.
- `// why:` on: silent-no-op cost contract; the cost source + OFFICER_RECRUIT_COST fallback; the pile[0] convention; the locked log line.

### B) Engine wiring
- `game.ts` — import + `recruitOfficer: { move: recruitOfficer, client: false }` (D-10008).
- `index.ts` — `export { recruitOfficer, OFFICER_RECRUIT_COST }`.
- `replay/replay.execute.ts` — import + `recruitOfficer: (context) => recruitOfficer(context as never)` dispatch entry.

### C) Client
- `components/play/uiMoveName.types.ts` — add `'recruitOfficer'` to `UiMoveName`.
- `composables/useTurnActions.ts` — add `canRecruitOfficer` (turn → stage, mirrors `canRecruitHero`).
- `components/play/SharedDecks.vue` — new props `currentStage` / `isViewerTurn` / `economy` / `submitMove`; the Officers cell becomes a gated recruit button (gate: turn → stage → `availableRecruit >= 3` → `officersCount > 0`) dispatching `recruitOfficer` with `{}`. Uses the engine `OFFICER_RECRUIT_COST`.
- `pages/PlayDesktop.vue` + `pages/PlayMobile.vue` — pass the four new props to `<SharedDecks>`.

### D) Tests
- `moves/recruitOfficer.test.ts` (new) — success; spend 3 + hasActedThisTurn; one log line; insufficient recruit; cost-not-play-value gating; cardStats-sourced cost; empty supply; wrong stage; heal-lock; block-all pending choice; fallback constant; JSON-serializable.
- `components/play/SharedDecks.test.ts` (new) — renders button + count; click emits `recruitOfficer {}`; stage / cost / empty-supply / not-your-turn disabled tooltips; only the Officers cell is a button.
- `game.test.ts` (modified) — move-count drift 31 → 32 (add `recruitOfficer`).

---

## Out of Scope

- AI / PAR simulation officer-buy heuristic (`SIMULATION_MOVE_NAMES`, `ai.competent.ts`, the sim MOVE_MAPs) — deferred; it would move the PAR/sentinel surfaces and needs its own re-pin.
- Sidekick recruiting, and any change to the other four supply cells.
- Any new `UIState` field (the client reads existing `economy.availableRecruit` + `piles.officersCount`).
- Officer SFX cue (the SFX manifest is a partial map; unmapped is a silent no-op).

---

## Files Expected to Change

- `packages/game-engine/src/moves/recruitOfficer.ts` — **new** — the move + `OFFICER_RECRUIT_COST`.
- `packages/game-engine/src/moves/recruitOfficer.test.ts` — **new** — `node:test` coverage.
- `packages/game-engine/src/game.ts` — **modified** — import + register.
- `packages/game-engine/src/index.ts` — **modified** — re-export.
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** — dispatch entry.
- `packages/game-engine/src/game.test.ts` — **modified** — move-count drift 31 → 32.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — union arm.
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified** — `canRecruitOfficer`.
- `apps/arena-client/src/components/play/SharedDecks.vue` — **modified** — recruit button + props.
- `apps/arena-client/src/components/play/SharedDecks.test.ts` — **new** — component coverage.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — pass props.
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — pass props.
- Governance: `docs/ai/NUMBER-LEDGER.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `docs/ai/execution-checklists/EC-683-recruitable-shield-officer-supply.checklist.md`, `wiki/shield-officer.md`.

No other files may be modified.

---

## Acceptance Criteria

### Engine
- [ ] `recruitOfficer` moves `G.piles.officers[0]` to the current player's discard and spends 3 recruit on a funded Main-stage call.
- [ ] Insufficient recruit (2), empty supply, wrong stage, heal-lock, and a parked pending choice each produce no mutation and no throw.
- [ ] The gate uses cost (3), not the officer play-value (2): recruit=2 with `cardStats` cost 3 fails.
- [ ] `LegendaryGame.moves` defines exactly 32 moves including `recruitOfficer`; `recruitOfficer` is NOT in `CORE_MOVE_NAMES`.
- [ ] `recruitOfficer` is dispatchable in `replay.execute`; it is NOT in `SIMULATION_MOVE_NAMES`.
- [ ] No `throw` / no `Math.random` in `recruitOfficer.ts`.

### Client
- [ ] The Officers cell renders as a `[data-testid="play-recruit-officer"]` button; clicking it emits `recruitOfficer` with `{}`.
- [ ] It disables with the correct tooltip for not-your-turn / wrong-stage / `< 3` recruit / empty supply.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.

### Determinism
- [ ] `sim:runtime-observed:check` exits 0 with no regeneration; engine hash-oracle tests unchanged.

### Tests / Scope
- [ ] `pnpm --filter @legendary-arena/game-engine test` and `pnpm --filter @legendary-arena/arena-client test` exit 0.
- [ ] No files outside `## Files Expected to Change` modified.

---

## Verification Steps

```pwsh
# Step 1 — build everything
pnpm -r build
# Expected: exits 0

# Step 2 — engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass, 0 fail (move-count drift test asserts 32)

# Step 3 — client typecheck + tests
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: both exit 0

# Step 4 — determinism unchanged
pnpm sim:runtime-observed:check
# Expected: "OK: runtime-observed hollows artifact is current."

# Step 5 — recruitOfficer stays out of the simulation move-set
Select-String -Path "packages\game-engine\src\simulation\ai.legalMoves.ts" -Pattern "recruitOfficer"
# Expected: no output

# Step 6 — scope
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** the Officers cell is confirmed recruitable in a live match on play.legendary-arena.com (spend 3 recruit → Officer enters discard), with observable evidence (deploy-confirmed SHA / screenshot). *Post-merge + deploy — see STATUS.*
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0; engine + client tests exit 0; client `typecheck` exits 0.
- [ ] `sim:runtime-observed:check` exits 0; engine hash oracles byte-unchanged.
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24460 Active), `docs/ai/work-packets/WORK_INDEX.md` (checked, dated), `docs/05-ROADMAP-MINDMAP.md` (node `✅`, counts current) updated.

---

## Lint Gate Self-Review

All 21 sections of `00.3-prompt-lint-checklist.md` resolve PASS or justified N/A:
- Scope closed + file allowlist present (PASS). Locked values inlined (PASS). Determinism boundary stated + verified (PASS). User-visible surface named + D-24026 gate present (PASS). Cross-layer boundary direction stated (PASS). No external URLs (PASS). No new contract file / no `Math.random` / no throw (PASS). Roadmap-mindmap gate + typecheck gate carried in the EC (PASS). Effect-marker / villain-ledger ripple — **N/A** (no card ability marked; no `core.json` change). Migration / DB / auth / scoring / PAR — **N/A**.

## Gate Verdicts

- **Pre-flight:** READY TO EXECUTE (dependencies on `main`; scope locked; scaffold-first observed — engine 2982/0, client 1555/0, typecheck clean, sim-observed current).
- **Copilot:** PASS.
