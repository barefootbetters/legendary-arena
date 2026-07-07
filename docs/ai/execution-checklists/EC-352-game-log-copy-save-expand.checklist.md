# EC-352 — Copy, Save, and Full-Screen Expand for the Live HUD Game Log (Execution Checklist)

**Source:** docs/ai/work-packets/WP-322-game-log-copy-save-expand.md
**Layer:** arena-client only (GameLogPanel + a pure export-text helper + tests; no engine/server/registry change)
**Lane:** Lightweight (single session — extends WP-321; adds Copy / Save / Expand affordances)

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `26912eef` recorded.
- [ ] Confirm `GameLogPanel.vue` (WP-321) renders `UIState.log` in append order, is already `defineComponent`, and keeps the compact `max-height` + polite auto-scroll.
- [ ] Re-read `PileBrowseModal.vue` (Teleport overlay + ESC handler) and `DiagnosticExportButton.vue` (guarded clipboard + object-URL download) — the two patterns to mirror.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Order stays **chronological** (append order) — never reverse (D-20002).
- Compact viewport unchanged: `max-height` ≈ **9rem**, `overflow-y: auto`, WP-321 polite auto-scroll retained verbatim.
- Export file name: `GAME_LOG_EXPORT_FILE_NAME = 'game-log.txt'`.
- `buildGameLogText(log)`: one entry per line, **trailing newline**; empty log → `''`.
- Expand overlay mirrors `PileBrowseModal`: `<Teleport v-if="isExpanded" to="body">`, `role="dialog"`, `aria-modal="true"`; closes on Collapse button / backdrop click / `Escape`; ESC wired via `watch(() => isExpanded, ..., { immediate: true })` + `onBeforeUnmount`; `@click.stop` on the panel.
- Copy / Save are **best-effort**: guard `navigator.clipboard?.writeText`, swallow rejection; Save revokes the object URL after `anchor.click()`.
- Reserved decision: **D-24108**.

## Guardrails
- Read-only render: viewport / chrome / export format only; never reorder or re-author the engine log.
- No engine / `UIState` / projection edit; no `finalStateHash` impact (`G.messages` hash-excluded, D-24081).
- Null/absence-guard the clipboard API and the viewport ref (jsdom has no clipboard/layout — no throw).
- The `<Teleport>` node itself carries `v-if="isExpanded"` (no always-mounted body anchor); detach the ESC listener on collapse AND on unmount (no leak).
- Duplicate the ~6-line Blob-download idiom inline (2nd copy — do NOT extract from, or import, `DiagnosticExportButton`; that file is out of scope).
- Do NOT change `PlayDesktop` / `PlayMobile` / `DiagnosticExportButton` / `diagnostics.ts` (no new npm dep).

## Required `// why:` Comments
- The Teleport `v-if` on the node itself (why: PileBrowseModal/EC-189 — gating an inner child leaves an always-mounted body anchor).
- The ESC listener attach/detach + `onBeforeUnmount` cleanup (why: no listener leak across expand/collapse/unmount).
- The best-effort clipboard guard + swallowed rejection (why: never block/throw the UI; the download is the fallback share path).
- The inline Blob-download duplication (why: 2nd copy of the idiom; extracting would touch out-of-scope `DiagnosticExportButton`; §16.1 duplicate-first).
- `buildGameLogText` extracted as a pure helper (why: makes export text unit-testable without clipboard/Blob APIs — WP-321 `gameLogScroll` precedent).

## Files to Produce
- `components/log/gameLogExport.ts` [pure `buildGameLogText` + `GAME_LOG_EXPORT_FILE_NAME`] · `gameLogExport.test.ts` [empty / single / multi-line + trailing-newline].
- `components/log/GameLogPanel.vue` [toolbar + `isExpanded` Teleport overlay + copy/save handlers; WP-321 auto-scroll retained].
- `components/log/GameLogPanel.test.ts` [add: 3 toolbar buttons render; Expand mounts / Collapse+ESC+backdrop unmount the dialog; Copy calls stubbed `writeText` with the built text; existing render tests unchanged].
- Governance: `docs/ai/DECISIONS.md` (D-24108), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client run typecheck` clean; `run test` 0 fail (existing GameLogPanel render tests pass unchanged); `run build` succeeds.
- [ ] `git diff --name-only` = the allowlist (4 client + 4 governance).
- [ ] STATUS / DECISIONS (D-24108 Active) / WORK_INDEX (WP-322 `[x]`) / EC_INDEX (EC-352 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (Copy → clipboard; Save → `game-log.txt`; Expand → full-screen scrollable chronological log, closes back to compact).

## Common Failure Smells
- Reversing display order → the WP-320 mistake (chronological is locked).
- Reusing/importing `DiagnosticExportButton`'s download or building the JSON diagnostics report → out of scope; Save is a plain `.txt` transcript.
- Any engine / `UIState` / projection edit → out of scope (client display only).
- Teleporting an always-mounted overlay (gating an inner child instead of the `<Teleport>` node) → leaks a body anchor.
- Forgetting to revoke the object URL, or not swallowing a clipboard rejection → resource/UX leak.
- Breaking the WP-321 compact auto-scroll while adding the toolbar/overlay → the polite-stick watch + viewport ref must stay intact.
- Trying to unit-test the real clipboard write / file download / scroll layout in jsdom → test the pure builder + DOM presence; live-verify the side effects (D-24026).
