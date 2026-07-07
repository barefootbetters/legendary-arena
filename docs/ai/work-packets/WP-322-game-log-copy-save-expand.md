# WP-322 — Copy, Save, and Full-Screen Expand for the Live HUD Game Log

**User-Visible Surface:** play.legendary-arena.com (the in-match Game Log panel).
The compact HUD log (WP-321) gains three viewer affordances: **Copy** (the whole
log to the clipboard), **Save** (the whole log as a plain-text `.txt` file), and
**Expand** (a full-screen overlay of the log, closable back to the compact
window). Order stays chronological; the engine log is never reordered or
re-authored.

## Goal

Add a small toolbar to `GameLogPanel.vue` with **Copy**, **Save**, and **Expand**
buttons. Copy writes the full log (one entry per line) to the clipboard;
Save downloads the same text as `game-log.txt`; Expand opens a full-screen
`<Teleport>` overlay (the `PileBrowseModal` pattern) showing the same log,
scrollable, closable via a Collapse button, backdrop click, or `Escape`. The
compact panel and its WP-321 polite auto-scroll are unchanged.

## Assumes

- `GameLogPanel.vue` (WP-318 + WP-321) renders `UIState.log` verbatim in append
  (chronological) order, receives the log as a `readonly string[]` prop, and owns
  its own viewport chrome (compact `max-height`, `overflow-y: auto`, polite
  auto-scroll). Locked baseline: `origin/main` @ `26912eef`.
- `PileBrowseModal.vue` exists and demonstrates the arena-client full-screen
  overlay pattern under vue-sfc-loader: `<Teleport v-if="isOpen" to="body">`, a
  `role="dialog"` backdrop, an `Escape` keydown handler wired via
  `watch(..., { immediate: true })` + `onBeforeUnmount`, backdrop-click close, and
  `@click.stop` on the panel (EC-189 / D-6512).
- `DiagnosticExportButton.vue` exists and demonstrates the arena-client
  clipboard-and-download idiom: best-effort `navigator.clipboard?.writeText`
  (guarded + swallowed) and a transient object-URL `<a download>` anchor.
- `@vue/test-utils` `mount` + the `testing/jsdom-setup` harness are available to
  `GameLogPanel.test.ts` (already used for the existing render tests).
- `vue-tsc` (`typecheck`), the arena-client `test` suite, and `build` pass on the
  baseline.

## Context (Read First)

- `docs/ai/work-packets/WP-321-game-log-compact-autoscroll.md` — the compact +
  polite-auto-scroll baseline this WP extends (read-only render; chronological).
- `apps/arena-client/src/components/play/PileBrowseModal.vue` — the full-screen
  overlay pattern to mirror for **Expand** (Teleport, dialog ARIA, ESC handler,
  listener cleanup).
- `apps/arena-client/src/components/DiagnosticExportButton.vue` +
  `apps/arena-client/src/diagnostics/diagnostics.ts` — the existing
  clipboard/download idiom to mirror for **Copy** / **Save**, and the existing
  JSON diagnostics export this WP is deliberately distinct from (WP-228 / D-22801).
- `.claude/rules/architecture.md` — "Layer Boundary (Authoritative)": arena-client
  consumes a read-only engine projection; it never re-authors game state.
- `docs/ai/DECISIONS.md` — scan D-24107 (WP-321 compact/auto-scroll), D-22801
  (diagnostics export), D-6512 (leaf `<script setup>` under vue-sfc-loader),
  D-20002 (chronological log order), D-24081 (`G.messages` hash-excluded).
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code rules the deliverables
  must satisfy.

**Why now:** WP-321 shipped the compact auto-scrolling window; the operator's
follow-up ask is the viewer affordances a compact window implies — read the whole
transcript (Expand), and get it out of the browser (Copy / Save) to attach to a
bug report or share. Single scoped client change; no engine/contract surface.

## Scope (In)

- **`GameLogPanel.vue`** — add a toolbar (Copy / Save / Expand buttons) visible in
  the compact panel; add an `isExpanded` ref (default `false`); when expanded,
  render a full-screen overlay via `<Teleport v-if="isExpanded" to="body">`
  (mirroring `PileBrowseModal`) containing the same chronological log, a Collapse
  button, Copy / Save buttons, `role="dialog"` + `aria-modal`, ESC-to-close (wired
  via `watch(() => isExpanded, ..., { immediate: true })` + `onBeforeUnmount`
  listener cleanup), and backdrop-click close with `@click.stop` on the panel. The
  overlay viewport scrolls to the bottom (newest) when it opens. The compact
  viewport keeps the exact WP-321 polite auto-scroll (unchanged). The component is
  already `defineComponent({ setup() {...} })` (D-6512) — no conversion needed.
- **`gameLogExport.ts`** (new) — a pure `buildGameLogText(log: readonly string[]):
  string` (one entry per line, trailing newline; empty log → empty string) plus
  the constant `GAME_LOG_EXPORT_FILE_NAME = 'game-log.txt'`. Extracted so the
  export text is unit-testable without the clipboard/Blob browser APIs (the WP-321
  `gameLogScroll.ts` testability precedent; §16.1 disposition below).
- **`gameLogExport.test.ts`** (new) — boundary tests for `buildGameLogText`
  (empty, single line, multi-line with trailing newline).
- **`GameLogPanel.test.ts`** (modified) — add interaction tests: the three toolbar
  buttons render; clicking Expand mounts the `role="dialog"` overlay and clicking
  Collapse unmounts it; Copy invokes a stubbed `navigator.clipboard.writeText` with
  the `buildGameLogText(log)` payload. Existing render tests pass unchanged.

## Out of Scope

- **Any engine / `UIState` / projection change** — pure client display of an
  existing read-only projection. No new field, no reorder, no re-author.
- **Reversing display order** — chronological is retained (WP-320 rejected; D-20002).
- **Replacing or extending the JSON diagnostics export** (`DiagnosticExportButton` /
  `diagnostics.ts`, WP-228). Save here is a **human-readable log transcript**
  (`.txt`), a different artifact for a different audience; the developer JSON
  snapshot is untouched and not reused.
- **`PlayDesktop.vue` / `PlayMobile.vue`** — no change; the toolbar, expand overlay,
  and copy/save live entirely inside `GameLogPanel` (the WP-321 containment precedent).
- **Full polite-stick inside the expanded overlay, timestamps, per-entry copy,
  scroll-position persistence, a "jump to latest" button** — cosmetic follow-ups.
- **New npm dependencies** — none; `<Teleport>`, `navigator.clipboard`, and
  `Blob`/`URL.createObjectURL` are Vue/browser built-ins already used in this app.

## Files Expected to Change

| File | Action |
|------|--------|
| `apps/arena-client/src/components/log/GameLogPanel.vue` | **Modified** — toolbar (Copy/Save/Expand) + `isExpanded` Teleport full-screen overlay + copy/save handlers; WP-321 compact auto-scroll retained |
| `apps/arena-client/src/components/log/gameLogExport.ts` | **New** — pure `buildGameLogText` + `GAME_LOG_EXPORT_FILE_NAME` |
| `apps/arena-client/src/components/log/gameLogExport.test.ts` | **New** — `buildGameLogText` boundary tests |
| `apps/arena-client/src/components/log/GameLogPanel.test.ts` | **Modified** — toolbar/expand/copy interaction tests; existing render tests unchanged |
| `docs/ai/DECISIONS.md` | **Modified** — D-24108 (Active on execution) |
| `docs/ai/STATUS.md` | **Modified** — record the change (execution) |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-322 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-352 row |

No other files may be modified.

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Deliver **full file contents** for every new or modified file — no diffs,
  snippets, or "show only the changed section."
- ESM only; Node v22+.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (explicit control
  flow, descriptive names, JSDoc on every function, `// why:` on non-obvious code).

**Packet-specific:**
- **Read-only render.** The client chooses viewport, chrome, and export format
  only; it never reorders or re-authors the engine log (chronological, D-20002).
- No engine / `UIState` / projection edit; no `finalStateHash` impact (client
  display; `G.messages` is hash-excluded, D-24081).
- Copy and Save are **best-effort** and never throw into the UI: guard
  `navigator.clipboard?.writeText` and swallow a rejection (the
  `DiagnosticExportButton` idiom); a Save uses a transient object-URL anchor that
  is revoked after the click.
- The expand overlay mirrors `PileBrowseModal`: the `<Teleport>` node itself is
  `v-if="isExpanded"` (no always-mounted body anchor); ESC handler attaches/detaches
  on the expanded transition and detaches on `onBeforeUnmount` (no listener leak).
- No new npm dependencies.
- Do NOT modify `PlayDesktop` / `PlayMobile` / `DiagnosticExportButton` /
  `diagnostics.ts`.

**Session protocol:** if any scope, ordering, or contract question is ambiguous,
STOP and ask — do not guess or widen scope.

**Locked contract values:**
- Compact `max-height` ≈ `9rem` (unchanged from WP-321); `overflow-y: auto`.
- Export file name: `GAME_LOG_EXPORT_FILE_NAME = 'game-log.txt'`.
- `buildGameLogText`: one entry per line, trailing newline; empty log → `''`.
- Expand overlay: `<Teleport to="body">`, `role="dialog"`, `aria-modal="true"`,
  closes on Collapse button / backdrop click / `Escape`.
- Reserved decision: **D-24108**.

## Vision Alignment

- **Vision clauses touched:** §14 (observability / readable, exportable feed), §11
  (UI consumes read-only projections). **Conflict assertion:** `No conflict.` Copy /
  Save / Expand are presentational reads/exports of an engine-authored projection;
  no clause is weakened. **Non-Goal proximity:** none of NG-1..7 crossed (no
  monetization, identity, competitive, or persuasive surface). **Determinism:** N/A —
  client display; no engine/RNG/replay/hash surface touched.

## Acceptance Criteria

1. `GameLogPanel` renders a toolbar with Copy, Save, and Expand buttons (each with a
   `data-testid` and an accessible label) in the compact panel.
2. `buildGameLogText([])` returns `''`; `buildGameLogText(['a'])` returns `'a\n'`;
   `buildGameLogText(['a','b'])` returns `'a\nb\n'` (asserted).
3. Clicking Expand mounts a `role="dialog"` `aria-modal="true"` overlay containing
   the same chronological entries; clicking Collapse (or pressing `Escape`, or
   clicking the backdrop) unmounts it (dialog presence/absence asserted).
4. Clicking Copy calls `navigator.clipboard.writeText` with `buildGameLogText(log)`
   (asserted against a stubbed clipboard); a missing/failing clipboard is swallowed
   and does not throw.
5. Save downloads a `game-log.txt` file whose contents equal `buildGameLogText(log)`
   (verified live per D-24026; the payload builder is unit-asserted in criterion 2).
6. The compact panel keeps chronological order and the WP-321 polite auto-scroll
   (existing `GameLogPanel.test.ts` render tests pass unchanged).
7. `vue-tsc` clean; arena-client `test` + `build` green.
8. No files outside `## Files Expected to Change` are modified.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client run typecheck   # clean
pnpm --filter @legendary-arena/arena-client run test        # 0 fail
pnpm --filter @legendary-arena/arena-client run build       # succeeds
git diff --name-only                                        # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `vue-tsc` clean; arena-client `test` + `build` green
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):**
      after merge + deploy, the live HUD Game Log shows Copy / Save / Expand; Copy
      puts the transcript on the clipboard, Save downloads `game-log.txt`, and
      Expand opens a full-screen, scrollable, chronological log that closes back to
      the compact window. Until then STATUS.md records the test evidence + the
      deferred observation (jsdom has no clipboard/download/layout).
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24108 Active; `WORK_INDEX.md`
      WP-322 `[x]`; `EC_INDEX.md` EC-352 Done
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3 — 21 sections)

| § | Verdict | Notes |
|---|---------|-------|
| 1 | ✅ PASS | All required sections present; Out of Scope lists ≥2 exclusions; single layer (arena-client) |
| 2 | ✅ PASS | Engine-wide (full files, no diffs, ESM/Node22, 00.6) + packet-specific + session protocol + locked values all present |
| 3 | ✅ PASS | §Assumes lists GameLogPanel/WP-321, PileBrowseModal, DiagnosticExportButton, the test harness, green baseline @ 26912eef |
| 4 | ✅ PASS | §Context (Read First) cites specific files + D-entries to read |
| 5 | ✅ PASS | §Files Expected to Change lists all 4 code/test + 4 governance files, each with an action; bounded |
| 6 | ✅ PASS | Names match: `UIState.log`, `buildGameLogText`, `GAME_LOG_EXPORT_FILE_NAME`; no 00.2 field surface touched |
| 7 | ✅ PASS | No new npm dependency — Teleport/clipboard/Blob are built-ins; explicitly excluded in §Out of Scope |
| 8 | ✅ PASS | Layer Boundary respected — arena-client reads a projection read-only; no engine/registry/server import added |
| 9 | ✅ N/A | No shell scripts / paths introduced (Verification uses pnpm on Windows pwsh) |
| 10 | ✅ N/A | No environment variables |
| 11 | ✅ N/A | No authentication surface |
| 12 | ✅ PASS | Tests use `node:test` + `@vue/test-utils`; no boardgame.io import; no network/DB; boundary assertions on `buildGameLogText` + interaction |
| 13 | ✅ PASS | Verification uses `pnpm --filter … run …`; exact commands with expected output; `git diff --name-only` scope check |
| 14 | ✅ PASS | 8 binary, observable, file/function-specific acceptance criteria |
| 15 | ✅ PASS | DoD includes STATUS.md / DECISIONS.md / WORK_INDEX.md + scope-boundary check; User-Visible Surface declared + live D-24026 item |
| 16 | ✅ PASS | Explicit control flow; descriptive names; JSDoc + `// why:` required (see EC); `buildGameLogText` helper is testability-motivated (§16.1 disposition, WP-321 precedent) |
| 17 | ✅ PASS | `## Vision Alignment` present — §14/§11; no conflict; no NG crossed; determinism N/A |
| 18 | ✅ N/A | No literal-string-scoped forbidden-token grep in Verification Steps |
| 19 | ✅ N/A | No repo-state-summarizing artifact |
| 20 | ✅ N/A | No funding surface — no donate/support copy, no funding channel, pure log viewer affordances |
| 21 | ✅ N/A | No HTTP endpoint and no `apps/server/src/**` library function touched — arena-client only |

**Verdict: 21/21 resolved (14 PASS, 7 N/A).**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Lightweight lane: single layer (arena-client), 4 code/test
files (at the budget ceiling), additive, no contract file, no determinism /
persistence / hash surface. Every affordance mirrors a proven in-repo precedent
(`PileBrowseModal` for the Teleport overlay + ESC handler; `DiagnosticExportButton`
for the guarded clipboard + object-URL download), which removes the vue-sfc-loader
and browser-API risk. The one untestable-in-jsdom surface (real clipboard write,
file download, and scroll layout) is handled by unit-testing the pure
`buildGameLogText` builder + the DOM interaction (button/dialog presence) and
deferring the true side effects to D-24026 live-verify.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (client renders/exports a read-only projection), no
monetization / identity / RNG / multiplayer-sync, no new contract, no hash impact.
Chronological order retained; Save is deliberately distinct from the JSON
diagnostics export (no reuse, no modification of that path). No BLOCK modes.
