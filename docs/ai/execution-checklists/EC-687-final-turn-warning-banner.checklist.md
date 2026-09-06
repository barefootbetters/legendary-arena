# EC-687 — Final-Turn Warning Banner (Execution Checklist)

**Source:** docs/ai/work-packets/WP-368-final-turn-warning-banner.md
**Layer:** Arena Client (UI)

## Before Starting
- [ ] **WP-367 landed on `main`** — `@legendary-arena/game-engine` exports `UIFinalTurnState` and `UIState.finalTurn?: UIFinalTurnState`, shaped EXACTLY `{ reason: string; heroDeckRemaining: number; villainDeckRemaining: number }`, and the engine OMITS `finalTurn` once `gameOver` is set. If the shape differs, STOP — re-read `packages/game-engine/src/ui/uiState.types.ts`; never guess field names.
- [ ] `apps/arena-client/src/components/hud/ArenaHud.vue` is the SOLE `useUiStateStore` consumer and prop-drills `snapshot.*` to children; `components/hud/TurnPhaseBanner.vue` is the pure-banner analog to mirror (structure, theming, `aria-live`).
- [ ] Exact scope lock (any edit outside = FAIL; surface as a blocker first): `components/hud/FinalTurnBanner.vue` (new), `components/hud/FinalTurnBanner.test.ts` (new), `components/hud/ArenaHud.vue`, `components/hud/ArenaHud.test.ts`, a `fixtures/uiState/` variant IF one is needed to carry `finalTurn`, plus governance (STATUS / DECISIONS / WORK_INDEX / EC_INDEX / ROADMAP-MINDMAP).
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 and `pnpm --filter @legendary-arena/arena-client test` exits 0 (record the baseline).

## Locked Values (do not re-derive)
- `UIFinalTurnState` fields: `reason` (string), `heroDeckRemaining` (number), `villainDeckRemaining` (number).
- Banner root: `role="alert"` + `aria-live="assertive"` (NOT polite — contrast `TurnPhaseBanner`).
- Prop typed `UIState['finalTurn']`; `v-if="finalTurn"` guards the whole banner (absent → renders nothing).
- Deck readout copy: `Hero deck: {heroDeckRemaining} · Villain deck: {villainDeckRemaining}`.

## Guardrails
- `FinalTurnBanner.vue` is PURE PROP-DRIVEN: reads NO store, NO engine, NO registry, NO browser global. `ArenaHud.vue` stays the sole store consumer.
- NO client-side game logic — do not re-derive "is it the final turn", suppress-on-gameover, or the tie; the engine omits `finalTurn` once `gameOver` is set. The `finalTurn` prop is read-only; never mutate it. No new npm dependency.
- Styling: `var(--color-*)` tokens only (no hardcoded colors), theme-aware, wraps on narrow (mobile) viewports.
- The `ArenaHud.vue` edit is ONLY import + register + `<FinalTurnBanner :final-turn="snapshot.finalTurn" />` mounted inside the existing `v-if="snapshot"` block — no other change.
- **Grep-gate prose discipline:** the Step-3 verify greps `FinalTurnBanner.vue` for `useUiStateStore|use.*Store` expecting ZERO matches — do NOT name any store symbol in a `// why:` comment or docstring in that file.

## Required `// why:` Comments
- The banner's `role="alert"` / `aria-live="assertive"`: the final turn is URGENT, not the informative context `TurnPhaseBanner` announces politely.
- The `v-if="finalTurn"` guard: the engine projects `finalTurn` only while a shared deck is exhausted and the game is not yet over, so absence = render nothing (no client suppression).

## Files to Produce
- `apps/arena-client/src/components/hud/FinalTurnBanner.vue` — **new** — pure prop-driven warning banner.
- `apps/arena-client/src/components/hud/FinalTurnBanner.test.ts` — **new** — present / absent / a11y coverage.
- `apps/arena-client/src/components/hud/ArenaHud.vue` — **modified** — import + mount the banner.
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — **modified** — banner present-when-`finalTurn` / absent-otherwise.
- `apps/arena-client/src/fixtures/uiState/*` — **modified (only if needed)** — a `finalTurn` variant for the tests.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24162 Active), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 — the load-bearing gate (vite/esbuild + tsx do NOT typecheck SFCs).
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0; `pnpm -r build` exits 0.
- [ ] Banner reads no store: `Select-String -Path apps\arena-client\src\components\hud\FinalTurnBanner.vue -Pattern "useUiStateStore|use.*Store"` → no output.
- [ ] `git diff --name-only` = exactly the scope lock.
- [ ] **Live-on-surface (D-24026):** on `play.legendary-arena.com`, a real match that exhausts a shared deck shows the banner (and it disappears at game end); screenshot captured. Green tests + a merged PR do NOT satisfy this.
- [ ] `docs/ai/STATUS.md` updated — the final-turn warning banner is live on the play HUD.
- [ ] `docs/ai/DECISIONS.md` — **D-24162 Active** (pure prop-driven, ArenaHud mount, assertive alert, present-only-when-projected).
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells
- `vite build` + `node:test` green but `main` later red on `vue-tsc` → a fixture/type was missed; the typecheck gate is the only one that catches SFC type errors.
- The Step-3 store grep returns a match → a store symbol leaked into a `FinalTurnBanner.vue` comment, or the banner actually reads the store (it must not).
- The banner renders an empty shell when `finalTurn` is absent → the `v-if` is on an inner element, not the root.
