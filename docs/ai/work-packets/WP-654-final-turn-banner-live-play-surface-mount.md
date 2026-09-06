# WP-654 — Final-Turn Banner: Live Play-Surface Mount (Arena Client)

**Status:** Ready
**Primary Layer:** Arena Client (UI)
**Dependencies:** WP-368 (the `FinalTurnBanner.vue` component + `UIState.finalTurn`), WP-367 (the engine `finalTurn` projection)
**User-Visible Surface:** play.legendary-arena.com

---

## Session Context

WP-368 (EC-687 / D-24162) shipped a pure prop-driven `FinalTurnBanner.vue` and mounted it in `ArenaHud.vue`, on the stated premise that `ArenaHud` is "the play HUD / the sole `useUiStateStore` consumer." That premise was stale: `App.vue` renders `<ArenaHud>` **only** on the dev `?fixture=` route (`route === 'fixture'`); a **real match** (`?match=…&player=…`, `route === 'live'`) renders `<PlayViewport>` → `<PlayDesktop>` / `<PlayMobile>`. So the banner, as shipped, **never appears in a real match** — confirmed live 2026-09-06 on a deck-... (Legacy Virus scheme-loss ended the game, `finalTurn` never projected; but even a deck-exhaustion match would not have shown it, because the live surface does not mount the banner). This packet mounts the banner on the live surface and makes the dev fixture route render it end-to-end.

---

## Goal

After this session, a player in a **real match** on play.legendary-arena.com sees the final-turn warning banner the moment the engine projects `UIState.finalTurn` (a shared Hero/Villain deck runs out). The banner is mounted **once** at the `PlayViewport` shared root — the established single-host overlay precedent (WP-410/412/415/418) — reading the `useUiStateStore` snapshot and covering **both** `PlayDesktop` and `PlayMobile`. A committed `final-turn` UIState fixture makes `?fixture=final-turn&play=1` render the banner through the live `PlayViewport` path for pre-deploy verification. The `FinalTurnBanner.vue` component itself is unchanged.

---

## User-Visible Impact

Before: the final-turn banner rendered only on the dev `?fixture=` route (via `ArenaHud`), never in a real match. After: a real match that exhausts a shared deck shows "⚠ Final turn" at the top of the play surface (desktop and mobile), and it disappears at game end (the engine omits `finalTurn` once `gameOver` is set). This closes the D-24162 play-HUD intent that WP-368 did not actually deliver.

---

## Assumes

- WP-368 merged: `apps/arena-client/src/components/hud/FinalTurnBanner.vue` exists, is pure prop-driven (`finalTurn: UIState['finalTurn']`), self-hides via `v-if`, and carries `data-testid="arena-hud-final-turn"` + `role="alert"` / `aria-live="assertive"`.
- WP-367 merged: `@legendary-arena/game-engine` projects `UIState.finalTurn?: UIFinalTurnState` (present only while a shared deck is exhausted and the game is not over).
- `apps/arena-client/src/pages/PlayViewport.vue` is the shared single-host root for cross-surface overlays (reads `useUiStateStore`, renders `<PlayDesktop>` / `<PlayMobile>`).
- `App.vue` renders `<PlayViewport>` for `route === 'live'` and `route === 'play-fixture'` (`?fixture=…&play=1`), and `<ArenaHud>` for `route === 'fixture'`.
- `apps/arena-client/src/fixtures/uiState/` holds committed UIState fixtures resolved through `typed.ts` + `index.ts`; the `?fixture=` harness in `main.ts` sets the store from `loadUiStateFixture`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — D-24162 (WP-368 banner design), D-24465 (this packet's mount decision); scan for related.
- `.claude/rules/architecture.md §Layer Boundary` — `apps/arena-client` consumes read-only UIState projections; no game logic in components.
- `apps/arena-client/src/App.vue` — the `route` discriminator (`selectRoute`); confirm `live` → `PlayViewport`, `fixture` → `ArenaHud`.
- `apps/arena-client/src/pages/PlayViewport.vue` — the single-host overlay precedent (WP-410/412/415/418): banners mounted once here reading the store snapshot.
- `apps/arena-client/src/components/hud/FinalTurnBanner.vue` — the pure component (unchanged by this packet).
- `apps/arena-client/src/fixtures/uiState/{typed.ts,index.ts,mid-turn.json}` — the committed-fixture pattern + the `narrowLog`/`narrowProgress` field-by-field rebuild.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- ESM only, Node v22+; `node:` prefix on Node built-in imports in tests.
- Test files use `.test.ts`; `node:test` + `@vue/test-utils` only, no Jest/Vitest/Mocha.
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- `FinalTurnBanner.vue` is **not modified** — it stays pure prop-driven and keeps rendering in `ArenaHud`. Positioning on the play surface is a `PlayViewport`-scoped class applied to the child root (Vue propagates the parent scopeId to the child's root element).
- The banner is mounted **once** at the `PlayViewport` shared root (never separately in `PlayDesktop` and `PlayMobile`); it reads `snapshot.finalTurn` from `useUiStateStore` via a computed. No new store, no game logic, no `finalTurn` re-derivation (the engine omits it at gameOver).
- No engine / registry / server change. No new npm dependency.
- The committed `final-turn` fixture is an in-progress snapshot (carries `finalTurn`, omits `gameOver`).

**Session protocol:**
- If `App.vue`'s live-route rendering differs from `## Assumes` (e.g. `route === 'live'` no longer renders `PlayViewport`), STOP and re-read `App.vue`.

**Locked contract values:**
- `UIFinalTurnState` fields: `reason` (string), `heroDeckRemaining` (number), `villainDeckRemaining` (number) — read-only.

---

## Scope (In)

### A) Mount on the live surface
- `apps/arena-client/src/pages/PlayViewport.vue` — import + register `FinalTurnBanner`; add a `finalTurn` computed off the `useUiStateStore` snapshot; mount `<FinalTurnBanner :final-turn="finalTurn" class="final-turn-banner-overlay" />` once at the shared root; add a scoped `.final-turn-banner-overlay` fixed top-center positioning rule.

### B) Committed fixture + dev route
- `apps/arena-client/src/fixtures/uiState/final-turn.json` — new; an in-progress snapshot carrying `finalTurn`.
- `apps/arena-client/src/fixtures/uiState/typed.ts` — import + export the `finalTurn` typed fixture (`satisfies UIState`).
- `apps/arena-client/src/fixtures/uiState/index.ts` — `FixtureName` += `'final-turn'`; `KNOWN_FIXTURE_NAMES` += it; loader switch case. (`?fixture=final-turn` then works via the existing `isFixtureName` gate; `&play=1` renders it through `PlayViewport`.)

### C) Tests
- `apps/arena-client/src/pages/PlayViewport.test.ts` — banner present when the snapshot carries `finalTurn`, absent otherwise.
- `apps/arena-client/src/fixtures/uiState/index.test.ts` — the `final-turn` fixture loads with `finalTurn` set and omits `gameOver`; `isFixtureName('final-turn')` is true.
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — add `'final-turn'` to the fixture-immutability `FIXTURE_VARIANTS` loop.

---

## Out of Scope

- No change to `FinalTurnBanner.vue` (component is unchanged; it already carries the a11y attributes and content).
- No engine / registry / server change; no new `UIState` field; no `finalStateHash` re-pin.
- No change to `ArenaHud.vue`'s existing mount (it keeps the banner for the `?fixture=` non-play route).
- No broader loss-proximity meter (a separate WP), and no restyle of the banner's content/colors.

---

## Files Expected to Change

- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount the banner at the shared root + scoped overlay positioning
- `apps/arena-client/src/pages/PlayViewport.test.ts` — **modified** — banner present/absent on the live surface
- `apps/arena-client/src/fixtures/uiState/final-turn.json` — **new** — in-progress snapshot carrying `finalTurn`
- `apps/arena-client/src/fixtures/uiState/typed.ts` — **modified** — typed `finalTurn` fixture
- `apps/arena-client/src/fixtures/uiState/index.ts` — **modified** — `FixtureName` + loader
- `apps/arena-client/src/fixtures/uiState/index.test.ts` — **modified** — `final-turn` fixture coverage
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — **modified** — add `final-turn` to the immutability loop

No other files may be modified.

---

## Vision Alignment

**Vision clauses touched:** §17 (accessibility surface), §10 (play surface). NG-1..7 not crossed.

**Conflict assertion:** No conflict: a read-only projection render of an accessible alert on the play surface; no monetization, persuasion, or competitive-advantage surface.

**Non-Goal proximity check:** None of NG-1..7 are crossed — informational warning UI.

**Determinism preservation:** N/A — pure client render of an engine projection; no RNG, replay, scoring, or `G` touched.

## Funding Surface Gate

§20 N/A — a play-HUD warning banner; it touches no funding navigation, no registry-viewer/profile funding affordance, no tournament funding channel, and adds no "donate/support" copy.

## API Catalog

§21 N/A — no HTTP endpoint added, modified, or removed; no `apps/server/src/**` library function touched (arena-client only).

---

## Acceptance Criteria

- [ ] `PlayViewport.vue` mounts `<FinalTurnBanner :final-turn="finalTurn" />` once at the shared root, fed a computed off `useUiStateStore`
- [ ] The banner renders on the live surface when the snapshot carries `finalTurn`, and renders nothing otherwise (both asserted)
- [ ] `FinalTurnBanner.vue` is unchanged (`git diff` shows no edit to it)
- [ ] A committed `final-turn` fixture carries `finalTurn` and omits `gameOver`; `isFixtureName('final-turn')` is true
- [ ] `?fixture=final-turn&play=1` renders the banner through `PlayViewport` (proven by the PlayViewport present-case test using the committed fixture)
- [ ] Styling uses `var(--color-*)` tokens / scoped positioning only (no hardcoded colors)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0; `pnpm -r build` exits 0
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — typecheck (vue-tsc — the ONLY type gate for arena-client)
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0

# Step 2 — arena-client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all passing, 0 failing

# Step 3 — confirm FinalTurnBanner.vue was not modified
git diff --name-only | Select-String "FinalTurnBanner.vue"
# Expected: no output

# Step 4 — confirm no files outside scope changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** surface is `play.legendary-arena.com` — the banner is confirmed **live in a real match** that exhausts a deck (banner appears on the play surface; disappears at game end), with a screenshot. NOT satisfied by tests + merge alone.
- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm -r build` exits 0
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — the final-turn banner now renders on the live play surface
- [ ] `docs/ai/DECISIONS.md` updated — D-24465 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-654 checked off with today's date
