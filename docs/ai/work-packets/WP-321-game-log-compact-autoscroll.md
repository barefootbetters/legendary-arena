# WP-321 — Compact, Auto-Scrolling Chronological Game Log in the Live HUD

**User-Visible Surface:** play.legendary-arena.com (the in-match Game Log panel).
The live HUD log is a **compact ~5-6 line window** that stays **chronological**
(cause-before-consequence) and **auto-scrolls to the bottom** so the newest entry
is always in view, while scrolling up to read history is respected. Replaces the
abandoned WP-320 newest-first approach.

## Goal

Cap `GameLogPanel.vue` to ~5-6 visible lines (`overflow-y: auto`) and add a
**polite auto-scroll-to-bottom**: on a new entry, stick to the bottom only when
the viewer was already pinned there (so a mid-game scroll-up is not yanked down);
scroll to the bottom on mount. Chronological order is preserved.

## Context (why not newest-first)

WP-320 reversed the log to newest-first so the latest line was visible without
scrolling. It was **abandoned pre-merge** (PR #576 closed) because reversing the
display order makes a multi-line event read **consequence-before-cause** — a fight
pushes three lines (`fought` → `rescued` → `Fight effect: … (hero)`), and reversed
you read the KO before the fight. This packet keeps chronological order and
solves visibility with a compact auto-scrolling window instead (the standard
chat/console/game-log pattern).

## Assumes

- `GameLogPanel.vue` (WP-318) renders `UIState.log` verbatim in append order and
  is mounted in both live pages fed `:log="snapshot.log"`.
- The engine log is append-only (an entry's index never changes).
- The panel `<section>` is the scroll viewport (`overflow-y: auto`).
- `vue-tsc`, the arena-client suite, and `vite build` pass on baseline
  (`origin/main` @ current).

## Scope (In)

- **`gameLogScroll.ts`** (new) — a pure `isPinnedToBottom(scrollHeight, scrollTop,
  clientHeight, threshold?)` helper + `GAME_LOG_STICK_THRESHOLD_PX`, so the
  stick-to-bottom decision is unit-testable without a layout engine (jsdom does
  not compute `scrollHeight`/`clientHeight`).
- **`GameLogPanel.vue`** — cap `max-height` to ~5-6 lines (`9rem`); add a
  template ref on the viewport `<section>`; on mount and on each new entry (a
  `watch` on `log.length`), scroll to the bottom **iff** `isPinnedToBottom` held
  before the entry landed (measured at the watcher's default `pre` flush; the
  scroll runs after `nextTick`). Because it now runs setup logic, it converts
  `<script setup>` → `defineComponent({ setup() { return {...} } })` per D-6512
  (a leaf `<script setup>` does not expose setup bindings to the template under
  vue-sfc-loader). Order stays chronological.
- **Tests** — `gameLogScroll.test.ts`: the pin decision (at-bottom, within/beyond
  threshold, content-fits, explicit threshold). The existing `GameLogPanel.test.ts`
  render tests (chronological order, stable index, no-mutation) pass unchanged.

## Out of Scope

- **Reversing display order** — rejected (WP-320); chronological is retained.
- **Any engine / `UIState` / projection change** — pure client display.
- **`PlayDesktop.vue` / `PlayMobile.vue`** — no change; the compact height +
  auto-scroll live entirely in `GameLogPanel`.
- **The replay inspector / pre-plan notification** — unaffected (they render the
  same component; the compact height applies there too, which is fine — they were
  already scrollable — but the auto-scroll simply keeps the newest in view).
- **Scroll-position persistence, "jump to latest" button, timestamps** — cosmetic
  follow-ups.

## Files Expected to Change

| File | Action |
|------|--------|
| `apps/arena-client/src/components/log/GameLogPanel.vue` | **Modified** — compact height + polite auto-scroll; `<script setup>` → `defineComponent` |
| `apps/arena-client/src/components/log/gameLogScroll.ts` | **New** — pure `isPinnedToBottom` helper |
| `apps/arena-client/src/components/log/gameLogScroll.test.ts` | **New** — helper unit tests |
| `docs/ai/DECISIONS.md` | **Modified** — D-24107 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-321 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-351 row |

No other files may be modified.

## Non-Negotiable Constraints

- Read-only render: the client chooses **viewport + scroll behaviour** only; it
  never reorders or re-authors the engine log (chronological, D-20002).
- Auto-scroll is **polite** — stick only when already at the bottom (within the
  threshold); never yank a scrolled-up viewer down.
- The stick decision uses the **pre-append** measurement (watcher `pre` flush),
  scrolling after `nextTick`.
- No engine/`UIState`/projection change; no `finalStateHash` impact.

## Vision Alignment

- **Vision clauses touched:** §14 (observability / readable feed), §11 (UI
  consumes read-only projections). **Conflict assertion:** `No conflict.` Pure
  presentational viewport + scroll of an engine-authored projection. **Non-Goal
  proximity:** none of NG-1..7 crossed. **Determinism:** N/A — client display.

## Acceptance Criteria

1. `isPinnedToBottom` returns true at/within-threshold of the bottom and when
   content fits; false when scrolled up past the threshold (asserted).
2. `GameLogPanel` renders chronological order with a stable per-entry index
   (existing tests pass unchanged) and a compact `max-height`.
3. On a new entry the panel scrolls to the bottom only when already pinned there
   (logic covered by `isPinnedToBottom`; DOM scroll verified live per D-24026 —
   jsdom has no layout).
4. `vue-tsc` clean; arena-client `test` + `build` green.
5. No files outside `## Files Expected to Change` modified.

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
      after merge + deploy, the live HUD Game Log is a compact window that stays
      scrolled to the newest (chronological) line, and scrolling up to read
      history is respected; until then STATUS.md records the test evidence + the
      deferred observation (jsdom cannot exercise scroll layout).
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24107 Active; `WORK_INDEX.md`
      WP-321 `[x]`; `EC_INDEX.md` EC-351 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | Sections present; Out of Scope ≥2 exclusions; single layer (arena-client) |
| 2 | ✅ PASS | Client only; renders an engine projection read-only; no engine edit |
| 3 | ✅ PASS | §Assumes lists GameLogPanel/WP-318, append-only log, the viewport, green baseline |
| 4 | ✅ N/A | No determinism surface — client display; `G.messages` hash-excluded |
| 5 | ✅ N/A | No persistence surface |
| 6 | ✅ N/A | No contract/union change (a component + a pure helper) |
| 7 | ✅ N/A | No canonical array |
| 8 | ✅ N/A | No move/phase |
| 9 | ✅ PASS | Naming: `isPinnedToBottom` / `viewport` / `scrollToBottom` full words |
| 10 | ✅ PASS | No `.reduce()`; the helper is arithmetic |
| 11 | ✅ PASS | `// why:` on the polite-stick rationale, the pre-flush measurement, the defineComponent conversion |
| 12 | ✅ PASS | Null-guarded viewport ref; no throw when jsdom scroll metrics are 0 |
| 13 | ✅ PASS | `.test.ts`; node:test; non-vacuous boundary assertions on the pin decision |
| 14 | ✅ PASS | §Files ↔ EC §Files to Produce align (3 client + 4 governance) |
| 15 | ✅ PASS | No invented mechanic — viewport/scroll of an existing projection |
| 16 | ✅ PASS | Extracts the pin decision to a pure, testable helper (avoids brittle jsdom scroll mocking) |
| 17 | ✅ PASS | `## Vision Alignment` present — §14/§11; no conflict |
| 18 | ✅ PASS | Verification: typecheck/test/build + `git diff --name-only`; no forbidden-token prose |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface |
| 21 | ✅ N/A | No HTTP / server-import surface |

**Verdict: 21/21 resolved (11 PASS, 10 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Lightweight lane (single layer arena-client; 1 component +
1 helper + 1 test; additive; no contract; no determinism/hash impact). Replaces
the abandoned WP-320 newest-first approach with the standard compact
auto-scrolling chronological pattern. The one testability wrinkle — jsdom has no
layout for scroll metrics — is handled by extracting the pin decision to a pure,
unit-tested helper and deferring the DOM-scroll behaviour to D-24026 live-verify.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (client renders an engine projection read-only), no
monetization/identity/RNG, no new contract, no hash impact. Chronological order
retained; auto-scroll is polite. No BLOCK modes.
