# EC-691 — Final-Turn Banner: Live Play-Surface Mount (Execution Checklist)

**Source:** docs/ai/work-packets/WP-654-final-turn-banner-live-play-surface-mount.md
**Layer:** Arena Client (UI)

## Before Starting
- [ ] **WP-368 + WP-367 landed on `main`** — `FinalTurnBanner.vue` exists (pure prop-driven, `data-testid="arena-hud-final-turn"`, `role="alert"` / `aria-live="assertive"`), and `@legendary-arena/game-engine` projects `UIState.finalTurn?: UIFinalTurnState` = `{ reason, heroDeckRemaining, villainDeckRemaining }` (omitted once `gameOver` is set).
- [ ] **Confirm the surface premise against HEAD** — `App.vue` `selectRoute`: `route === 'live'` (real match) renders `<PlayViewport>`, `route === 'play-fixture'` (`?fixture=…&play=1`) renders `<PlayViewport>`, `route === 'fixture'` renders `<ArenaHud>`. If live no longer renders `PlayViewport`, STOP.
- [ ] `PlayViewport.vue` is the single-host overlay root (WP-410/412/415/418): banners mounted once there read `useUiStateStore` and cover both `<PlayDesktop>` and `<PlayMobile>`.
- [ ] Exact scope lock (any edit outside = FAIL): `pages/PlayViewport.vue`, `pages/PlayViewport.test.ts`, `fixtures/uiState/final-turn.json` (new), `fixtures/uiState/typed.ts`, `fixtures/uiState/index.ts`, `fixtures/uiState/index.test.ts`, `components/hud/ArenaHud.test.ts`, plus governance (NUMBER-LEDGER / STATUS / DECISIONS / WORK_INDEX / EC_INDEX / ROADMAP-MINDMAP).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` and `test` both exit 0 (record the baseline).

## Locked Values (do not re-derive)
- `UIFinalTurnState` fields: `reason` (string), `heroDeckRemaining` (number), `villainDeckRemaining` (number).
- Mount **once** at the `PlayViewport` shared root: `<FinalTurnBanner :final-turn="finalTurn" class="final-turn-banner-overlay" />`, `finalTurn = computed(() => snapshot.value?.finalTurn)`.
- `final-turn` fixture: an in-progress snapshot (carries `finalTurn`, omits `gameOver`).
- `FixtureName` gains exactly `'final-turn'`.

## Guardrails
- **`FinalTurnBanner.vue` is NOT edited** — it stays pure prop-driven and keeps rendering in `ArenaHud`. Positioning is a `PlayViewport`-scoped class on the child root (Vue applies the parent scopeId to the child's root element). Verify with `git diff --name-only` (no `FinalTurnBanner.vue`).
- Mount **once** at the shared root — never separately in `PlayDesktop` and `PlayMobile`. Reads the store snapshot via a computed; no game logic, no `finalTurn` re-derivation, no suppress-at-gameover logic (the engine omits it).
- Styling: `var(--color-*)` / scoped positioning only (no hardcoded colors, except the standard overlay `box-shadow` rgba precedent already used by the sibling banners).
- No engine/registry/server change; no new npm dependency; no `finalStateHash` re-pin.

## Required `// why:` Comments
- The `finalTurn` computed / mount in `PlayViewport`: why a single shared-root host (covers both surfaces, WP-410/412/415/418 precedent) and why it reads the store here (ArenaHud is dev-only; the live surface is PlayViewport — D-24465).
- The `.final-turn-banner-overlay` scoped rule: why a PlayViewport-scoped class on the child root positions the pure component without editing it.

## Files to Produce
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount + scoped overlay positioning.
- `apps/arena-client/src/pages/PlayViewport.test.ts` — **modified** — present / absent on the live surface.
- `apps/arena-client/src/fixtures/uiState/final-turn.json` — **new** — in-progress `finalTurn` snapshot.
- `apps/arena-client/src/fixtures/uiState/typed.ts` — **modified** — typed `finalTurn` fixture.
- `apps/arena-client/src/fixtures/uiState/index.ts` — **modified** — `FixtureName` + loader.
- `apps/arena-client/src/fixtures/uiState/index.test.ts` — **modified** — `final-turn` coverage.
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — **modified** — `final-turn` in the immutability loop.
- `docs/ai/{STATUS.md,DECISIONS.md (D-24465 Active),work-packets/WORK_INDEX.md,execution-checklists/EC_INDEX.md},docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 — the load-bearing gate (vite/esbuild + tsx do NOT typecheck SFCs).
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0; `pnpm -r build` exits 0.
- [ ] `git diff --name-only` = exactly the scope lock; `FinalTurnBanner.vue` NOT present.
- [ ] **Live-on-surface (D-24026):** on `play.legendary-arena.com`, a real match that exhausts a shared deck shows the banner on the play surface (and it disappears at game end); screenshot captured. Green tests + a merged PR do NOT satisfy this.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24465 Active; `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write` (then `roadmap:counts:check` exits 0).

## Common Failure Smells
- `vite build` + `node:test` green but `main` later red on `vue-tsc` → a fixture/type was missed; the typecheck gate is the only one that catches SFC type errors.
- The banner renders in `?fixture=final-turn` (ArenaHud) but NOT `?fixture=final-turn&play=1` (PlayViewport) → the PlayViewport mount is missing or not reading the store.
- `FinalTurnBanner.vue` appears in `git diff` → the component was edited; it must stay pure/unchanged.
