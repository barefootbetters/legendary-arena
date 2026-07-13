# WP-368 — Final-Turn Warning Banner (Arena Client)

**Status:** Ready
**Primary Layer:** Arena Client (UI)
**Dependencies:** WP-367 (engine `UIState.finalTurn` projection + `UIFinalTurnState` export)
**User-Visible Surface:** play.legendary-arena.com

---

## Session Context

WP-367 added the engine's deck-exhaustion final-turn mechanic and an optional `UIState.finalTurn?: UIFinalTurnState` projection (present only while a shared deck is exhausted and the game has not yet ended); WP-062/WP-061 established that `ArenaHud.vue` is the SOLE `useUiStateStore` consumer and prop-drills `snapshot.*` into pure child components (e.g. `TurnPhaseBanner.vue`) — this packet renders that projection as a warning banner without touching the engine.

---

## Goal

After this session the play HUD shows a prominent, accessible **final-turn warning banner** whenever the engine reports `UIState.finalTurn`. A new pure, prop-driven `FinalTurnBanner.vue` renders the projection's `reason` plus the hero/villain deck-remaining counts (the "how close to losing" readout) and communicates the stakes — win or lose this turn, or the game ends in a tie. It is mounted once in `ArenaHud.vue` (passed `snapshot.finalTurn`), renders nothing when the field is absent, and needs no client-side game logic (the engine already omits `finalTurn` once the game is over).

---

## User-Visible Impact

A player at play.legendary-arena.com sees a clearly-styled warning banner appear at the top of the HUD the moment a shared deck runs out: "⚠ Final turn — the villain deck is empty. Win or lose this turn, or the game ends in a tie. (Hero deck: N · Villain deck: 0)". Screen-reader users hear it announced as an alert. When the final turn ends, the banner disappears and (on a tie) the existing endgame summary shows the tie result. Before this packet, the engine ran the final-turn/tie behavior (WP-367) but the client gave no advance warning — the player only saw the tie after the fact.

---

## Assumes

- WP-367 complete and merged. Specifically:
  - `@legendary-arena/game-engine` exports `UIFinalTurnState` and `UIState.finalTurn?: UIFinalTurnState`
  - `UIFinalTurnState` has exactly `{ reason: string; heroDeckRemaining: number; villainDeckRemaining: number }`
  - The engine omits `finalTurn` once `gameOver` is set (no client suppression needed)
- `apps/arena-client/src/components/hud/ArenaHud.vue` is the sole `useUiStateStore` consumer and prop-drills `snapshot.*` to children
- `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- `pnpm --filter @legendary-arena/arena-client test` exits 0

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — `apps/arena-client` consumes read-only UIState projections only; no engine/registry runtime import beyond the Runtime-Safe Engine Surface; components contain no game logic.
- `packages/game-engine/src/ui/uiState.types.ts` (`UIFinalTurnState`, `UIState.finalTurn`) — the exact projected shape (read-only; do not re-derive).
- `apps/arena-client/src/components/hud/ArenaHud.vue` — the SOLE `useUiStateStore` consumer; read how it prop-drills `snapshot.game` etc. into children. The new banner mounts here.
- `apps/arena-client/src/components/hud/TurnPhaseBanner.vue` — the closest analog: a pure prop-driven `<header>` banner with `aria-live`. Mirror its structure and theming (`var(--color-*)`).
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` + `TurnPhaseBanner.test.ts` — the test idiom (`@vue/test-utils` + `node:test`) to mirror.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+; `node:` prefix on Node built-in imports in tests
- Test files use `.test.ts` — never `.test.mjs`; `node:test` + `@vue/test-utils` only, no Jest/Vitest/Mocha
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `FinalTurnBanner.vue` is a **pure prop-driven** component — it takes `finalTurn` as a prop and reads NO store, NO engine, NO registry, NO browser globals. `ArenaHud.vue` remains the sole store consumer.
- The banner renders **nothing** when the `finalTurn` prop is absent (`v-if`).
- No client-side game logic: do not re-derive "is it the final turn", suppress-on-gameover, or the tie — those are the engine's (the engine omits `finalTurn` once `gameOver` is set).
- The `finalTurn` field is consumed read-only; the component must not mutate it.
- No new npm dependency.

**Session protocol:**
- If the `UIFinalTurnState` shape differs from `## Assumes`, STOP — do not guess field names; re-read `uiState.types.ts`.

**Locked contract values:**
- `UIFinalTurnState` fields: `reason` (string), `heroDeckRemaining` (number), `villainDeckRemaining` (number)

---

## Debuggability & Diagnostics

- The banner is a pure function of its `finalTurn` prop — fully reproducible by loading a UIState fixture with `finalTurn` set.
- No side effects, no state; failures localize to prop → render.
- Add a UIState fixture (or extend an existing one) carrying `finalTurn` for the test.

---

## Scope (In)

### A) FinalTurnBanner component
- **`apps/arena-client/src/components/hud/FinalTurnBanner.vue`** — new:
  - `defineProps<{ finalTurn: UIState['finalTurn'] }>()` (optional by the type).
  - `v-if="finalTurn"` guards the whole banner; absent → renders nothing.
  - Renders: a "Final turn" heading (with a ⚠ affordance), `finalTurn.reason`, and a deck-remaining readout (`Hero deck: {{ finalTurn.heroDeckRemaining }} · Villain deck: {{ finalTurn.villainDeckRemaining }}`).
  - `role="alert"` + `aria-live="assertive"` — a `// why:` comment contrasting with `TurnPhaseBanner`'s polite: the final turn is urgent, not informative context.
  - Scoped styles using `var(--color-*)` tokens with a warning accent; theme-aware; wraps on narrow (mobile) viewports.

### B) Mount in ArenaHud
- **`apps/arena-client/src/components/hud/ArenaHud.vue`** — modified: import `FinalTurnBanner`, register it, and mount `<FinalTurnBanner :final-turn="snapshot.finalTurn" />` (near `TurnPhaseBanner`, inside the existing `v-if="snapshot"` block). No other change; `ArenaHud` stays the sole store consumer.

### C) Tests
- **`apps/arena-client/src/components/hud/FinalTurnBanner.test.ts`** — new:
  - Renders the banner (heading, reason text, both deck counts) when `finalTurn` is provided.
  - Renders **nothing** when `finalTurn` is `undefined`.
  - Carries `role="alert"` / `aria-live="assertive"`.
- **`apps/arena-client/src/components/hud/ArenaHud.test.ts`** — modified: the banner is present when the loaded UIState snapshot has `finalTurn`, and absent otherwise.

---

## Out of Scope

- No engine changes — `UIState.finalTurn` is consumed exactly as WP-367 projects it; no new projected fields.
- No broader "loss proximity meter" (escaped-villains X/8, scheme-twists X/N). The escapes count is already projected, but a full loss-proximity readout (esp. scheme-twist proximity, which the engine does not yet project) is a **separate** WP (engine projection + client meter).
- No change to `EndgameSummary.vue` / the gameOver screen — the tie already surfaces there via `UIState.gameOver` (WP-367); no banner suppression logic (the engine omits `finalTurn` when `gameOver` is set).
- No sound, animation library, or toast/notification system.
- No `apps/registry-viewer` or `apps/dashboard` change.
- Refactors or "while I'm here" cleanups outside the list above.

---

## Files Expected to Change

- `apps/arena-client/src/components/hud/FinalTurnBanner.vue` — **new** — the warning banner (pure prop-driven)
- `apps/arena-client/src/components/hud/FinalTurnBanner.test.ts` — **new** — component coverage
- `apps/arena-client/src/components/hud/ArenaHud.vue` — **modified** — import + mount the banner
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — **modified** — banner present/absent by `finalTurn`

No other files may be modified. (If a shared UIState fixture must gain a `finalTurn` variant for the tests, extend the existing `apps/arena-client/src/fixtures/uiState/` set and add it to this list at execution-prep.)

---

## Vision Alignment

**Vision clauses touched:** §17 (accessibility/i18n surface), §10 (play surface). NG-1..7 not crossed.

**Conflict assertion:** No conflict: this WP preserves all touched clauses. It is a read-only projection render with an accessible alert affordance; no monetization, persuasion, or competitive-advantage surface.

**Non-Goal proximity check:** None of NG-1..7 are crossed — a warning banner is informational UI, not a paid or persuasive surface.

**Determinism preservation:** N/A — this is a pure client render of an engine projection; it computes no game state and touches no RNG, replay, or scoring.

## Funding Surface Gate

§20 N/A — a play-HUD warning banner; it touches no funding navigation, no registry-viewer/profile funding affordance, no tournament funding channel, and adds no "donate/support" copy.

---

## Acceptance Criteria

### FinalTurnBanner
- [ ] `FinalTurnBanner.vue` takes a single `finalTurn` prop typed `UIState['finalTurn']` and reads no store/engine/registry/browser global
- [ ] Renders nothing when `finalTurn` is `undefined` (`v-if`)
- [ ] When present, renders `finalTurn.reason`, `finalTurn.heroDeckRemaining`, and `finalTurn.villainDeckRemaining`
- [ ] Root element carries `role="alert"` and `aria-live="assertive"`
- [ ] Styling uses `var(--color-*)` tokens only (no hardcoded colors)

### Mount
- [ ] `ArenaHud.vue` imports, registers, and mounts `<FinalTurnBanner :final-turn="snapshot.finalTurn" />` inside the existing `snapshot` guard
- [ ] `ArenaHud.vue` remains the sole `useUiStateStore` consumer (no store read added to the banner)

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] Banner-present and banner-absent cases both asserted
- [ ] Test files use `node:test` + `@vue/test-utils`; no Jest/Vitest

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — typecheck (vue-tsc — the ONLY type gate for arena-client)
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0

# Step 2 — run all arena-client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests passing, 0 failing

# Step 3 — confirm the banner reads no store (pure prop-driven)
Select-String -Path "apps\arena-client\src\components\hud\FinalTurnBanner.vue" -Pattern "useUiStateStore|use.*Store"
# Expected: no output

# Step 4 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification:** surface is `play.legendary-arena.com` — the banner is confirmed **live in a real match** that exhausts a deck (final-turn banner appears; disappears at game end), with a screenshot captured. (D-24026 — not satisfied by tests + merge alone.)
- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm -r build` exits 0
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — the final-turn warning banner is now live on the play HUD
- [ ] `docs/ai/DECISIONS.md` updated — D-24162 (banner design: pure prop-driven, ArenaHud mount, assertive alert, present-only-when-projected)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-368 checked off with today's date
