# EC-348 — Game Log Panel in the Live Play HUD (Execution Checklist)

**Source:** docs/ai/work-packets/WP-318-live-hud-game-log.md
**Layer:** arena-client only (two play pages + their tests; no engine/server/registry change)
**Lane:** Lightweight (single session — mounts an existing tested component over an existing projection)

## Before Starting
- [ ] On `main`, clean, synced; baseline recorded.
- [ ] Confirm `GameLogPanel.vue` renders a `readonly string[]` `log` prop verbatim (append-only, index-keyed).
- [ ] Confirm `snapshot.log` is available in both pages' template scope.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Prop binding: `:log="snapshot.log"` (a `readonly string[]`).
- Desktop section testid: `play-desktop-log`; mobile: `play-mobile-log`; the panel's own testid `game-log-panel` / lines `game-log-line` are unchanged.
- Desktop mount: inside `boardVisible`, OUTSIDE the `viewer !== null` gate (spectators see the log), before the `preplan-affordance` slot.
- Mobile mount: bottom of `<main>`, a `play-mobile__log` column section.
- `defineComponent({ components })` registration (no `<script setup>` on these pages, D-6512).
- Reserved decision: **D-24104**.

## Guardrails
- **Read-only:** the client never authors/interprets log content (D-20002) — render `snapshot.log` verbatim through the existing leaf. Do NOT re-implement log formatting in the page.
- **No engine change.** If any change to `UIState` / the projection / `G.messages` seems needed, STOP — the log is already projected; this is client-only.
- **No hash / determinism impact** (client render; `G.messages` hash-excluded, D-24081).
- Layer boundary: no new dependency; no engine import beyond existing UIState types.
- Desktop log stays OUTSIDE the `viewer !== null` gate; mobile is always-viewer (D-16501) so `<main>` placement is fine.

## Required `// why:` Comments
- Each mount (why: WP-318 — surface the durable game log / WP-316 + WP-317 narration in the live HUD; read-only projection, engine owns log authorship D-20002; desktop note: outside the viewer gate so spectators see it).

## Files to Produce
- `apps/arena-client/src/pages/PlayDesktop.vue` [import + register + mount `GameLogPanel`; minimal `play-desktop__log` style].
- `apps/arena-client/src/pages/PlayMobile.vue` [same; `play-mobile__log` column style].
- `apps/arena-client/src/pages/PlayDesktop.test.ts` [assert the log section + panel render; a `Fight effect:` / grant line surfaces verbatim].
- `apps/arena-client/src/pages/PlayMobile.test.ts` [assert the log section + panel render; an `Ambush effect:` line surfaces verbatim].
- Governance: `docs/ai/DECISIONS.md` (D-24104), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `cd apps/arena-client && npm run typecheck` clean; `npm run test` 0 fail; `npm run build` succeeds.
- [ ] `git diff --name-only` = the allowlist (4 client + 4 governance).
- [ ] STATUS / DECISIONS (D-24104 Active) / WORK_INDEX (WP-318 `[x]`) / EC_INDEX (EC-348 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (a live match shows the Game Log with the Fight/Ambush/Escape effect lines + Empowered/Berserk grants).

## Common Failure Smells
- Any engine/`UIState`/projection edit → out of scope (the log is already projected; client-only mount).
- Re-implementing log formatting in the page instead of rendering `snapshot.log` through `GameLogPanel` → D-20002 breach.
- Desktop log placed INSIDE the `viewer !== null` gate → spectators lose the log.
- `<script setup>` refactor of the pages → violates the D-6512 SFC-authoring rule for these tested composer pages.
- Engine edited but the arena-client suite run without a fresh `pnpm -r build` of the engine dep (only if an engine dep changed — it should NOT here).
