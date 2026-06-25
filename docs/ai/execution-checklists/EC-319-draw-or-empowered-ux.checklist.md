# EC-319 — Draw-or-Empowered Choose-One UX (Projection + Client Prompt)
# Execution Checklist

**Source:** docs/ai/work-packets/WP-287-draw-or-empowered-ux.md
**Layer:** Game Engine UIState projection (`packages/game-engine/src/ui`) + arena-client
**Decisions:** D-24071 (projection + client prompt for the draw-or-empowered choice)

---

## Before Starting

- [ ] `git status` — working tree clean; on a `claude/*` branch
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — record ENGINE_BASELINE
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 — record CLIENT_BASELINE
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (vue-tsc baseline)
- [ ] Confirm WP-286 engine surface present: `PendingDrawOrEmpowered { playerID, empoweredClass }`,
      `resolveDrawOrEmpowered`, `hasPendingDrawOrEmpowered` — if missing, STOP (co-release; execute WP-286 first or together)
- [ ] Confirm the WP-249 reuse surface: `UIPendingOptionalKoReward` in `ui/uiState.types.ts`, its
      projection in `ui/uiState.build.ts`, its redaction in `ui/uiState.filter.ts`,
      `OptionalKoRewardPrompt.vue`, `uiMoveName.types.ts`, `useTurnActions.ts` — if absent, STOP
- [ ] Confirm D-24071 present in `docs/ai/DECISIONS.md` — if missing, STOP
- [ ] Read `OptionalKoRewardPrompt.vue` + the WP-249 projection/redaction blocks in full — mirror them
- [ ] Read WP-287 in full before touching a file

---

## Locked Values (do not re-derive)

| Name | Locked Value | Source |
|---|---|---|
| Projection type | `UIPendingDrawOrEmpowered` (`{ playerID: string; empoweredLabel: string }`) | D-24071 |
| Projected field | `pendingDrawOrEmpowered?: UIPendingDrawOrEmpowered` (optional) | D-24071 |
| Redaction key | `pendingDrawOrEmpowered.playerID` vs `audience.playerId` | D-24011 analog |
| Empowered-label mapping | strength→"Empowered by Strength", instinct/covert/tech/ranged likewise; else "Empowered" | D-24071 |
| Draw-button label | "Draw a card" (component constant) | D-24071 |
| Move name | `'resolveDrawOrEmpowered'` (appended to `UiMoveName`) | D-24071 |
| Move args submitted | `{ choice: 'draw' }` / `{ choice: 'empowered' }` | WP-286 contract |
| Component | `apps/arena-client/src/components/play/DrawOrEmpoweredPrompt.vue` | D-24071 |
| Gating param | `hasPendingDrawOrEmpowered` on `useTurnActions` | D-24071 |
| Barrel re-export | `UIPendingDrawOrEmpowered` from `packages/game-engine/src/index.ts` | D-16502 / WP-166 recurrence |

---

## Guardrails

1. **No engine gameplay change** — engine diff limited to the `ui/` files + their tests + the
   `index.ts` type-only re-export. No move/rule/`G`-mutation file touched (AC-8).
2. **Chooser-only redaction (HARD)** — `pendingDrawOrEmpowered` visible ONLY to the chooser; redact
   for all others/spectators, keyed on `.playerID`. Prove with a filter test (not a grep).
3. **`empoweredLabel` is a single mapping in `uiState.build.ts`** — never an ad-hoc/per-card string;
   unrecognized class → "Empowered" fallback, never a crash.
4. **Optional field → no fixture backfill** — `pendingDrawOrEmpowered?` is optional; existing
   arena-client UIState fixtures must typecheck UNCHANGED. If `vue-tsc` reds on a fixture, STOP and
   reconcile; do NOT widen scope.
5. **Barrel re-export up front** — add `UIPendingDrawOrEmpowered` to `index.ts` so the client
   `import type` resolves (do not discover this mid-execution).
6. **Prompt is non-dismissible** while pending; the only exits are the two buttons; disable controls
   after a submit (no double-submit). A stale resubmit is harmless (engine no-ops) but must not fire.
7. **Mount in BOTH `PlayDesktop.vue` and `PlayMobile.vue`**, gated on the projected pending choice.
8. **No `boardgame.io` import in components**; no `Math.random()` / mutation in the projection.

---

## Required Implementation Order

1. `ui/uiState.types.ts` — `UIPendingDrawOrEmpowered` + optional `pendingDrawOrEmpowered?` field
2. `ui/uiState.build.ts` — project front entry + derive `empoweredLabel` (single mapping)
3. `ui/uiState.filter.ts` — chooser-only redaction keyed on `.playerID`
4. `index.ts` — re-export `UIPendingDrawOrEmpowered`
5. `ui/uiState.build.test.ts` + `ui/uiState.filter.test.ts` — projection + redaction tests; run engine suite
6. `components/play/uiMoveName.types.ts` — append `'resolveDrawOrEmpowered'`
7. `components/play/DrawOrEmpoweredPrompt.vue` — the prompt
8. `components/play/DrawOrEmpoweredPrompt.test.ts` — component tests
9. `composables/useTurnActions.ts` — add `hasPendingDrawOrEmpowered` param + gating
10. `composables/useTurnActions.test.ts` — gating test (End Turn disabled while pending)
11. `components/play/TurnActionBar.vue` — disable while pending
12. `pages/PlayDesktop.vue` + `pages/PlayMobile.vue` — mount the prompt
13. Run arena-client `test` + `typecheck`

**Checkpoint:** engine `test` after step 5; arena-client `test` + `typecheck` after step 12.

---

## Required `// why:` Comments

- `ui/uiState.types.ts`: `// why: D-24071 — projects G.pendingDrawOrEmpowered (chooser-only); absent means no pending choice`
- `ui/uiState.build.ts`: `// why: D-24071 — empoweredLabel derived by a single class→display mapping; never per-card`
- `ui/uiState.filter.ts`: `// why: D-24071 / D-24011 analog — the pending choice is private to the chooser`
- `DrawOrEmpoweredPrompt.vue`: `// why: D-24071 — non-dismissible; controls disable after submit to prevent a double move`
- `useTurnActions.ts`: `// why: D-24071 — End Turn / Pass Priority blocked at any stage while a draw-or-empowered choice is pending`

---

## Files to Produce

**New files:**
- `apps/arena-client/src/components/play/DrawOrEmpoweredPrompt.vue`
- `apps/arena-client/src/components/play/DrawOrEmpoweredPrompt.test.ts`

**Modified (engine UIState — runtime-safe surface only):**
- `packages/game-engine/src/ui/uiState.types.ts`
- `packages/game-engine/src/ui/uiState.build.ts`
- `packages/game-engine/src/ui/uiState.filter.ts`
- `packages/game-engine/src/ui/uiState.build.test.ts`
- `packages/game-engine/src/ui/uiState.filter.test.ts`
- `packages/game-engine/src/index.ts`

**Modified (arena-client):**
- `apps/arena-client/src/components/play/uiMoveName.types.ts`
- `apps/arena-client/src/composables/useTurnActions.ts`
- `apps/arena-client/src/composables/useTurnActions.test.ts`
- `apps/arena-client/src/components/play/TurnActionBar.vue`
- `apps/arena-client/src/pages/PlayDesktop.vue`
- `apps/arena-client/src/pages/PlayMobile.vue`

**Governance (govern-close):**
- `docs/ai/DECISIONS.md` (D-24071 Active)
- `docs/ai/work-packets/WORK_INDEX.md` (WP-287 Done)
- `docs/ai/execution-checklists/EC_INDEX.md` (EC-319 Done)
- `docs/ai/STATUS.md` (execution summary)
- `docs/05-ROADMAP-MINDMAP.md` (WP-287 node)

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — ≥ ENGINE_BASELINE + projection/redaction cases
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 — ≥ CLIENT_BASELINE + component/gating cases
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (no fixture backfill — optional field)
- [ ] `pnpm -r build` exits 0
- [ ] Spot-check: engine diff = `ui/` files + tests + `index.ts` only (no move/rule/G file)
- [ ] Spot-check: `'resolveDrawOrEmpowered'` in `uiMoveName.types.ts`; `UIPendingDrawOrEmpowered` in `index.ts`
- [ ] Spot-check: `DrawOrEmpoweredPrompt` mounted in both `PlayDesktop.vue` and `PlayMobile.vue`
- [ ] **Co-released with WP-286** — not merged as a dangling UX; both deploy together
- [ ] **D-24026 live-verify** on play.legendary-arena.com (post-co-deploy): One-Hit Wonder shows the
      two-button prompt; each choice resolves; End Turn blocked until resolved
- [ ] Governance close — `SPEC:` commit with DECISIONS, WORK_INDEX, EC_INDEX, STATUS, mindmap

---

## Common Failure Smells

- **`vue-tsc` reds on a UIState fixture** — the new field was made required, not optional; make
  `pendingDrawOrEmpowered?` optional (then no backfill is needed).
- **Client `import type { UIPendingDrawOrEmpowered }` fails to resolve** — the `index.ts` barrel
  re-export was omitted (the recurring WP-166 gap).
- **Prompt fires the move twice** — controls not disabled after the first submit.
- **Prompt renders for a non-chooser** — redaction not keyed on `.playerID`, or the page mount isn't
  gated on the projected (already-redacted) field.
- **Engine diff touches a move/rule file** — that is WP-286's territory; this packet is projection +
  client only.
