# EC-351 — Compact, Auto-Scrolling Chronological Game Log in the Live HUD (Execution Checklist)

**Source:** docs/ai/work-packets/WP-321-game-log-compact-autoscroll.md
**Layer:** arena-client only (GameLogPanel + a pure scroll helper + its test; no engine/server/registry change)
**Lane:** Lightweight (single session — replaces abandoned WP-320; compact height + polite auto-scroll)

## Before Starting
- [ ] On `main`, clean, synced; baseline recorded. (WP-320 / PR #576 abandoned pre-merge; `main` is the WP-318 chronological baseline.)
- [ ] Confirm `GameLogPanel.vue` renders `UIState.log` in append order and the `<section>` is the scroll viewport.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Order stays **chronological** (append order) — do NOT reverse (WP-320's rejected approach).
- Compact viewport: `max-height` ≈ **9rem** (~5-6 lines), `overflow-y: auto`.
- Polite stick: on a new entry, scroll to bottom ONLY when `isPinnedToBottom(...)` held **before** the entry (measure at the watcher `pre` flush; scroll after `nextTick`). Also scroll to bottom `onMounted`.
- Pure helper `isPinnedToBottom(scrollHeight, scrollTop, clientHeight, threshold = GAME_LOG_STICK_THRESHOLD_PX)` in `gameLogScroll.ts`; threshold `24`.
- `GameLogPanel` uses `defineComponent({ setup() { return { viewport } } })` (D-6512 — a leaf `<script setup>` does not expose setup bindings under vue-sfc-loader).
- Reserved decision: **D-24107**.

## Guardrails
- Read-only render: viewport/scroll behaviour only; never reorder or re-author the engine log (D-20002).
- Auto-scroll is POLITE — never yank a scrolled-up viewer to the bottom.
- Null-guard the viewport ref (jsdom scroll metrics are 0 — no throw).
- No engine/`UIState`/projection edit; no `finalStateHash` impact (client render; `G.messages` hash-excluded, D-24081).
- Do NOT change `PlayDesktop`/`PlayMobile` (height + scroll live in `GameLogPanel`).

## Required `// why:` Comments
- The polite-stick rule (why: WP-321 — stick only when already at the bottom; a mid-game scroll-up is not yanked down).
- The pre-append measurement (why: watcher `pre` flush reflects the pre-append scroll position; scroll after nextTick once the row exists).
- The compact `max-height` (why: ~5-6 lines instead of 20rem, which dominated the board).
- The `<script setup>` → `defineComponent` conversion (why: D-6512 / vue-sfc-loader exposes only props from a leaf `<script setup>`).

## Files to Produce
- `components/log/gameLogScroll.ts` [pure `isPinnedToBottom` + `GAME_LOG_STICK_THRESHOLD_PX`] · `gameLogScroll.test.ts` [boundary tests].
- `components/log/GameLogPanel.vue` [compact height + polite auto-scroll + defineComponent].
- Governance: `docs/ai/DECISIONS.md` (D-24107), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `cd apps/arena-client && npm run typecheck` clean; `npm run test` 0 fail (existing GameLogPanel render tests pass unchanged); `npm run build` succeeds.
- [ ] `git diff --name-only` = the allowlist (3 client + 4 governance).
- [ ] STATUS / DECISIONS (D-24107 Active) / WORK_INDEX (WP-321 `[x]`) / EC_INDEX (EC-351 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (compact HUD log stays scrolled to the newest chronological line; scroll-up respected).

## Common Failure Smells
- Reversing display order → the WP-320 mistake (multi-line events read consequence-before-cause).
- Any engine/`UIState`/projection edit → out of scope (client display only).
- Yanking a scrolled-up viewer to the bottom → the stick must be polite (measure pinned-before).
- Measuring scroll position AFTER the DOM grew → always reads "at bottom"; measure at the `pre` flush.
- Trying to unit-test the DOM scroll in jsdom → jsdom has no layout; test the pure helper, live-verify the scroll.
- Leaving GameLogPanel as `<script setup>` with a `watch`/`ref` → setup bindings won't reach the template under vue-sfc-loader.
