# EC-672 — Battle Plan Client Panel (Arena Client) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-637-battle-plan-client-panel.md
**Layer:** App (`apps/arena-client`)

## Before Starting

- [ ] On `main`, clean, fast-forward synced; `origin/main` baseline recorded in the WP.
- [ ] WP-635 shipped `GET`/`PUT /api/match/:matchId/battle-plan` — confirm on `main` (`apps/server/src/match/battlePlan.routes.ts`): GET → `{ battlePlan: { matchId, preBattle, battleAdjustments, postBattle, updatedAt } | null }`; PUT body `{ phase, text }`; the full 5-code `BattlePlanErrorCode` (`invalid_request`/`unknown_phase`/`text_too_long`/`not_a_participant`/`internal_error`) — see §Locked Values.
- [ ] Read the precedents to clone: `apps/arena-client/src/lib/api/matchInvitesApi.ts`, `apps/arena-client/src/composables/useMatchSeatStatus.ts`, `apps/arena-client/src/components/WaitingForPlayersPanel.vue`, and the overlay-mount block + `useUiStateStore` snapshot read in `apps/arena-client/src/pages/PlayViewport.vue`.
- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0 (baseline).

## Locked Values (do not re-derive)

- Endpoints consumed verbatim from WP-635 — NO server/contract change. GET/PUT `/api/match/:matchId/battle-plan`.
- Phase closed set `'pre_battle' | 'battle_adjustments' | 'post_battle'` ↔ response `preBattle`/`battleAdjustments`/`postBattle`.
- `BATTLE_PLAN_PHASE_MAX_LENGTH = 4000` (client soft cap; `// why:` mirrors WP-635 — cannot import a server const).
- `BATTLE_PLAN_POLL_INTERVAL_MS = 5000` (mirrors `SEAT_POLL_INTERVAL_MS`).
- Client-local error union `BATTLE_PLAN_API_ERROR_CODES` `as const` = the EXACT 5-code server set `'invalid_request' | 'unknown_phase' | 'text_too_long' | 'not_a_participant' | 'internal_error'` (from `apps/server/src/match/battlePlan.types.ts`), with a **set-equality drift test** cloning `matchInvitesApi.test.ts` (sorted client == sorted server). An unmatched response code (401 session code, or any unknown) narrows to `null` → generic banner.
- Lifecycle gating (D-24450): `pre_battle` editable whenever shown; `battle_adjustments` editable once `useUiStateStore().snapshot?.game?.phase === 'play'` (equivalently `snapshot?.game?.turn >= 1`) — NOT "snapshot present" (bgioClient sets the snapshot on connect, so it exists in the waiting room); `post_battle` editable once `snapshot?.gameOver !== undefined`; a reached phase never re-locks.

## Guardrails

- arena-client ONLY — no server/contract change; no `G`/`ctx`; the panel NEVER calls `bgioClient.submitMove` and never WRITES `UIState`. It may READ `useUiStateStore().snapshot?.gameOver` for the lifecycle signal (the `EndgameActions`/`WaitingForPlayersPanel` precedent).
- `battlePlanApi.ts` mirrors `matchInvitesApi.ts`: `Result<T>` discriminator, `authHeaders(token)`, `buildApiUrl`, transport `try/catch → { ok:false, status:0 }`, status guard, client-local error union with a drift note.
- `useBattlePlan.ts` mirrors `useMatchSeatStatus.ts`: `onMounted` initial `pollOnce()` + `setInterval`, `onUnmounted` `clearInterval`, empty-`matchId` short-circuit, a failed poll `return`s (preserves the last snapshot).
- `BattlePlanPanel.vue`: `defineComponent({ name, setup })` (D-6512); self-sources `matchId` from `new URLSearchParams(window.location.search).get('match') ?? ''`; self-hides with no match; fixed-position **top-right** lane, collapsed-to-toggle default — must NOT collide with `WaitingForPlayersPanel` (bottom-right) or the bottom-left overlay stack; guard `window`/`navigator` where used.
- Mount `<BattlePlanPanel />` ONCE in `PlayViewport.vue`'s shared-root template block (covers PlayDesktop + PlayMobile) — do not mount inside `PlayDesktop`/`PlayMobile`.

## Required `// why:` Comments

- `BattlePlanPanel` mounted once in `PlayViewport`: mounted ONCE at the shared viewport root so it covers both surfaces (the WP-363/WP-502 overlay precedent).
- `BATTLE_PLAN_PHASE_MAX_LENGTH` local const: mirrors WP-635's server cap; the client cannot import a server const.
- The lifecycle-gating computed: why editability derives from the `UIState` snapshot (server stays permissive per D-24449; the CLIENT owns the phase window, D-24450) and why reached phases never re-lock.
- `battlePlanApi` client-local error union: a mirror of the server codes; a drift risk if the server union changes.

## Files to Produce

- `apps/arena-client/src/lib/api/battlePlanApi.ts` — **new** — GET/PUT wrappers (mirror `matchInvitesApi`)
- `apps/arena-client/src/lib/api/battlePlanApi.test.ts` — **new** — stubbed-fetch: success, `battlePlan:null`, 403/400 code parse, transport-fail `{status:0}`, a 500/unmatched code → `null` generic, AND the set-equality drift test vs the server `BattlePlanErrorCode` union
- `apps/arena-client/src/composables/useBattlePlan.ts` — **new** — polling read + editable-phase computed + `savePhase`
- `apps/arena-client/src/composables/useBattlePlan.test.ts` — **new** — mounted-harness: poll interval, empty-matchId short-circuit, unmount cleanup, gating derivation INCLUDING `battle_adjustments` locked while `game.phase !== 'play'`
- `apps/arena-client/src/components/BattlePlanPanel.vue` — **new** — the 3-phase overlay panel
- `apps/arena-client/src/components/BattlePlanPanel.test.ts` — **new** — `@vue/test-utils` mount: self-hide no-match, phase render, active-phase highlight, save calls the wrapper, gating
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount `<BattlePlanPanel />` once (01.5 runtime-wiring; the ONLY wiring file)

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0
- [ ] `Select-String` confirms: no `submitMove` / `game-engine` logic import in the new files
- [ ] `docs/ai/DECISIONS.md` — **create** D-24450 as Active (post-execution) (RESERVED in NUMBER-LEDGER; no prior Drafted entry)
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` WP-637 checked off; `EC_INDEX.md` EC-672 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝 → ✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] **D-24026 live-verify** (write a phase in a live match; confirm persist + reload) — pending post-deploy

## Common Failure Smells (Optional)

- The panel keeps overwriting a teammate's edit → the poll clobbers an in-progress local edit; guard the textarea against poll updates while focused/dirty.
- A phase editable too early → the lifecycle computed keyed off the wrong signal. `battle_adjustments` must key off `snapshot?.game?.phase === 'play'` (or `game.turn >= 1`), NOT snapshot presence (the snapshot exists in the waiting room); `post_battle` keys off `gameOver`.
- The client error union drifts from the server's 5 codes → the set-equality drift test (cloned from `matchInvitesApi.test.ts`) fails; do not delete it to make the build green — reconcile the union with `BattlePlanErrorCode`.
- Save silently no-ops → the bearer wasn't attached, or a `403 not_a_participant` wasn't surfaced (the caller isn't a seated participant).
- Panel collides with the waiting/deck overlays → the fixed-position lane overlaps bottom-right / bottom-left; keep the top-right lane.
- A poll blip blanks the panel → a failed `pollOnce()` must preserve the last snapshot, not reset to empty.
