# EC-350 — Newest-First Game Log Feed in the Live HUD (Execution Checklist)

**Source:** docs/ai/work-packets/WP-320-game-log-newest-first.md
**Layer:** arena-client only (GameLogPanel + two play pages + tests; no engine/server/registry change)
**Lane:** Lightweight (single session — additive display-order prop, default off)

## Before Starting
- [ ] On `main`, clean, synced; baseline recorded.
- [ ] Confirm `GameLogPanel.vue` renders `UIState.log` verbatim and is mounted in both live pages (WP-318).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Prop: `newestFirst?: boolean`, **default `false`** (chronological preserved for replay inspector / pre-plan).
- HUD pages pass `:newest-first="true"`.
- `:key` / `data-index` = the **original** append-order index (never the display position).
- `displayEntries` reverses via `props.log.map(...).slice().reverse()` (copies — never mutates the source).
- `GameLogPanel` converts `<script setup>` → `defineComponent({ setup() { return { displayEntries } } })` (D-6512 — the vue-sfc-loader separate-compile pipeline exposes only props from a leaf `<script setup>`, not setup computeds).
- Reserved decision: **D-24106**.

## Guardrails
- Read-only render: the client chooses **display direction** only — it never re-authors the log (D-20002).
- No engine/`UIState`/projection edit; no `finalStateHash` impact (client render; `G.messages` hash-excluded).
- Default `false` → zero behaviour change for `ReplayInspector`/`PrePlanNotification`; do NOT flip their order.
- Do NOT mutate the `log` prop (use copies). Do NOT key by display position.

## Required `// why:` Comments
- The `newestFirst` prop (why: WP-320 — live HUD newest-first feed; default false keeps the replay inspector chronological).
- The reversed `displayEntries` + original-index pairing (why: stable `:key` across direction; append moves rows, no rebuild).
- The `<script setup>` → `defineComponent` conversion (why: D-6512 / vue-sfc-loader exposes only props from a leaf `<script setup>`; a computed must be an explicit setup return).

## Files to Produce
- `components/log/GameLogPanel.vue` [`newestFirst` prop + `displayEntries` + defineComponent] · `.test.ts` [reversed order + original index + no-mutation].
- `pages/PlayDesktop.vue` [`:newest-first="true"`] · `.test.ts` [newest-on-top].
- `pages/PlayMobile.vue` [`:newest-first="true"`].
- Governance: `docs/ai/DECISIONS.md` (D-24106), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `cd apps/arena-client && npm run typecheck` clean; `npm run test` 0 fail; `npm run build` succeeds.
- [ ] `git diff --name-only` = the allowlist (5 client + 4 governance).
- [ ] STATUS / DECISIONS (D-24106 Active) / WORK_INDEX (WP-320 `[x]`) / EC_INDEX (EC-350 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (live HUD log shows latest on top).

## Common Failure Smells
- Any engine/`UIState`/projection edit → out of scope (client display only).
- Flipping the replay inspector / pre-plan order → default must stay `false`.
- Keying by display position → append thrash + wrong `data-index` (use the original index).
- Mutating the `log` prop (`.reverse()` in place) → breaks the no-mutation contract; use `.slice().reverse()`.
- Leaving GameLogPanel as `<script setup>` with a computed → `displayEntries` won't reach the template under vue-sfc-loader (0 rows render).
