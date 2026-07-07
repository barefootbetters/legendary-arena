# WP-320 — Newest-First Game Log Feed in the Live HUD

**User-Visible Surface:** play.legendary-arena.com (the in-match Game Log panel).
After this packet the live HUD log reads as a **feed** — the latest entry on top,
older entries pushed down — instead of oldest-first. Operator request
(2026-07-07): "reverse, with latest feed pushing the log file down."

## Goal

Add an optional `newestFirst` prop to `GameLogPanel.vue` (default `false`) and
enable it in the two live play pages (`PlayDesktop.vue` / `PlayMobile.vue`), so
the HUD log shows newest-first. The replay inspector + pre-plan notification keep
their existing chronological (oldest-first) order.

## Assumes

- `GameLogPanel.vue` renders the engine log (`UIState.log`) verbatim; WP-318
  mounted it in both live pages fed `:log="snapshot.log"`.
- The engine log is append-only, so an entry's original array index is stable.
- `vue-tsc`, the arena-client suite, and `vite build` pass on baseline
  (`origin/main` @ current).

## Scope (In)

- **`GameLogPanel.vue`** — add a `newestFirst?: boolean` prop (default `false`);
  render a `displayEntries` computed that reverses the display order when set,
  pairing each entry with its **original** append-order index so the `:key`
  stays stable (an append moves rows rather than rebuilding the list). Because
  the component now has computed state, it converts from `<script setup>` to the
  `defineComponent({ setup() { return {...} } })` form per the EC-132 §2 SFC
  authoring rule (D-6512) — under vue-sfc-loader's separate-compile pipeline a
  leaf `<script setup>` reliably exposes only props to the template, not
  arbitrary setup bindings.
- **`PlayDesktop.vue` / `PlayMobile.vue`** — pass `:newest-first="true"`.
- **Tests** — `GameLogPanel.test.ts`: newest-first reverses display order + keeps
  the original `data-index`, and does not mutate the source array;
  `PlayDesktop.test.ts`: the live HUD renders the newest entry on top.

## Out of Scope

- **`ReplayInspector.vue` / `PrePlanNotification.vue`** — keep chronological
  order (default `false`); a replay is read top-to-bottom.
- **Any engine / `UIState` / projection change** — pure client display order.
- **Log filtering, autoscroll, timestamps, list-marker styling** — cosmetic
  follow-ups.

## Files Expected to Change

| File | Action |
|------|--------|
| `apps/arena-client/src/components/log/GameLogPanel.vue` | **Modified** — `newestFirst` prop + reversed `displayEntries`; `<script setup>` → `defineComponent` |
| `apps/arena-client/src/components/log/GameLogPanel.test.ts` | **Modified** — newest-first + no-mutation tests |
| `apps/arena-client/src/pages/PlayDesktop.vue` | **Modified** — `:newest-first="true"` |
| `apps/arena-client/src/pages/PlayDesktop.test.ts` | **Modified** — assert newest-on-top |
| `apps/arena-client/src/pages/PlayMobile.vue` | **Modified** — `:newest-first="true"` |
| `docs/ai/DECISIONS.md` | **Modified** — D-24106 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-320 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-350 row |

No other files may be modified.

## Non-Negotiable Constraints

- Read-only render: the client never authors/reorders the engine log's meaning —
  it only chooses **display direction** (D-20002 log authorship unchanged).
- `:key` uses the **original** append-order index, never the display position.
- No engine/`UIState`/projection change; no `finalStateHash` impact (client render).
- Default `newestFirst = false` — no behaviour change for existing consumers.

## Vision Alignment

- **Vision clauses touched:** §14 (observability / readable feed), §11 (UI
  consumes read-only projections). **Conflict assertion:** `No conflict.` Pure
  presentational reorder of an engine-authored projection. **Non-Goal proximity:**
  none of NG-1..7 crossed. **Determinism:** N/A — client display only.

## Acceptance Criteria

1. `GameLogPanel` with `newestFirst` renders entries in reversed display order,
   each `<li>` keeping its original `data-index` (asserted).
2. `GameLogPanel` does not mutate the supplied `log` array (asserted).
3. `PlayDesktop` / `PlayMobile` render the log newest-first (desktop asserted).
4. Default (`newestFirst` absent) stays chronological (existing tests + the
   replay-inspector tests pass unchanged).
5. `vue-tsc` clean; arena-client `test` + `build` green.
6. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
cd apps/arena-client
npm run typecheck   # clean
npm run test        # 0 fail
npm run build       # succeeds
cd ../..
git diff --name-only   # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `vue-tsc` clean; arena-client `test` + `build` green
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):**
      after merge + deploy, the live HUD Game Log shows the latest entry on top;
      until then STATUS.md records the test evidence + the deferred observation.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24106 Active; `WORK_INDEX.md`
      WP-320 `[x]`; `EC_INDEX.md` EC-350 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | Sections present; Out of Scope ≥2 exclusions; single layer (arena-client) |
| 2 | ✅ PASS | Client only; renders an engine projection read-only; no engine edit |
| 3 | ✅ PASS | §Assumes lists GameLogPanel/WP-318, append-only log, green baseline |
| 4 | ✅ N/A | No determinism surface — client display order; `G.messages` hash-excluded |
| 5 | ✅ N/A | No persistence surface |
| 6 | ✅ N/A | No contract/union change (a component prop is internal) |
| 7 | ✅ N/A | No canonical array |
| 8 | ✅ N/A | No move/phase |
| 9 | ✅ PASS | Naming: `newestFirst` / `displayEntries` full words; `data-testid` conventions kept |
| 10 | ✅ PASS | No `.reduce()`; `.map` + `.slice().reverse()` copies (no mutation) |
| 11 | ✅ PASS | `// why:` on the prop, the reversal, the stable-index key, the defineComponent conversion |
| 12 | ✅ PASS | Pure render; empty-log handled by the existing empty-state |
| 13 | ✅ PASS | `.test.ts`; node:test; non-vacuous order + index + no-mutation assertions |
| 14 | ✅ PASS | §Files ↔ EC §Files to Produce align (5 client + 4 governance) |
| 15 | ✅ PASS | No invented mechanic — display-direction of an existing projection |
| 16 | ✅ PASS | Reuses GameLogPanel; the defineComponent conversion follows D-6512 (no premature abstraction) |
| 17 | ✅ PASS | `## Vision Alignment` present — §14/§11; no conflict |
| 18 | ✅ PASS | Verification: typecheck/test/build + `git diff --name-only`; no forbidden-token prose |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface |
| 21 | ✅ N/A | No HTTP / server-import surface |

**Verdict: 21/21 resolved (11 PASS, 10 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Lightweight lane (single layer arena-client; 3 code + 2 test
files; additive prop, default off; no contract; no determinism/hash impact). The
only wrinkle — the vue-sfc-loader separate-compile pipeline not exposing a
`<script setup>` computed — is handled by the D-6512-mandated `defineComponent`
conversion. Directly fulfils the operator's 2026-07-07 request.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (client renders an engine projection read-only), no
monetization/identity/RNG, no new contract, no hash impact. Default-off prop, so
zero behaviour change for existing consumers. No BLOCK modes.
