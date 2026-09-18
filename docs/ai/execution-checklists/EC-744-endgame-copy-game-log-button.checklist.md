# EC-744 — Endgame "Copy game log" button

**WP:** WP-707 · **Layer:** App (`apps/arena-client`) · **Lane:** Lightweight · **Status:** Pending

Governs execution of WP-707: a clipboard sibling of the shipped
`GameLogDownloadButton` on the end-of-match outcome screen. Reuses
`buildGameLogText` — no new formatter, no engine/UIState/determinism
surface.

## Before Starting

- [ ] Baseline `origin/main`; `apps/arena-client` suite green pre-change.
- [ ] Confirm the sibling exists unchanged: `GameLogDownloadButton.vue`
      (show-condition `hasDownloadableLog`, wired in `PlayViewport.vue`),
      `components/log/gameLogExport.ts` (`buildGameLogText`), and
      `GameLogPanel.copyLog` (the best-effort clipboard idiom).
- [ ] **Scaffold (Lane-required):** prototype `GameLogCopyButton.vue`,
      run `pnpm --filter @legendary-arena/arena-client test`, record the
      observed result. (Additive UX — NOT validation-tightening; no
      fixture migration expected. If the suite reveals otherwise, fold
      it into scope or self-demote.)

## Locked Values

- Component name: `GameLogCopyButton`; `data-testid="game-log-copy-button"`.
- Show condition (verbatim mirror of `hasDownloadableLog`):
  `snapshot !== null && snapshot.gameOver !== undefined && snapshot.log.length > 0`.
- Clipboard payload: `buildGameLogText(snapshot.log)` — **reuse**, do not
  re-derive a formatter.
- Placement: `position: fixed; bottom: 72px; left: 8px;` (stacks above
  `GameLogDownloadButton`'s 40px; same pill style/tokens as the siblings).
- SFC form: `defineComponent({ setup() { return {...} } })` (D-6512).

## Guardrails

- App-layer only. No import of `game-engine` runtime, `registry`,
  `server`, `preplan`, or `boardgame.io`. `LogEntry` is `import type`
  only (as `gameLogExport.ts` already does).
- Read the projected `UIState.log` from the `uiState` store snapshot —
  never reconstruct or mutate log state.
- Do NOT touch `GameLogDownloadButton`, `GameLogPanel`,
  `buildGameLogText`, `UIState`, the engine, persistence, or any hash
  surface.
- Clipboard write is **best-effort**: guard `navigator.clipboard?.writeText`
  presence and swallow a rejection — never throw into the UI.
- Exactly **one** runtime-wiring file (`PlayViewport.vue`); a second
  wiring file or any cross-layer edit is self-demotion (leave the Lane).
- No new dependency; no new `UIState` field (so no Board-Visible Field
  five-step contract).

## Required Comments (`// why:`)

- On the show-condition computed: why it mirrors the endgame download
  gate (the in-match `GameLogPanel` Copy already covers during-play).
- On the clipboard best-effort guard/catch: why the rejection is
  swallowed (non-critical transcript; Download remains).
- On the `bottom: 72px` style value: why it stacks above the 40px
  download / 8px diagnostics pills (mirror the sibling's existing
  `bottom` `// why:`).

## Files to Produce

- `apps/arena-client/src/components/GameLogCopyButton.vue` — new.
- `apps/arena-client/src/components/GameLogCopyButton.test.ts` — new
  (shown at game over · hidden during play · hidden with no snapshot ·
  click writes `buildGameLogText(log)` to a stubbed clipboard).
- `apps/arena-client/src/pages/PlayViewport.vue` — import + `components`
  registration + one `<GameLogCopyButton />` beside the siblings.

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client test` green; `vue-tsc`
      clean; `pnpm -r build` clean.
- [ ] `git diff --name-only` = the 3 files above (Lane budget holds).
- [ ] Flip WORK_INDEX `[ ] → [x]` (Done + test count), EC_INDEX
      `Pending/Draft → Done`, mindmap node `📝 → ✅`.
- [ ] Two-commit topology on the branch: `EC-744:` implementation +
      `SPEC:` govern-close. No separate execution PR (Lane).
- [ ] D-24026 live-verify (post-deploy STATUS-flip): play to game over,
      click "Copy game log", paste, confirm the transcript copied. Also
      confirm "Download game log" is visible (Context operational flag).

## Common Failure Smells

- Re-deriving the transcript instead of calling `buildGameLogText` —
  the copied bytes must equal the download `.txt`.
- Awaiting/throwing on the clipboard write (jsdom / insecure context
  lacks the API) — must be swallowed.
- Showing the button during play (duplicates the `GameLogPanel` Copy).
- Adding a `UIState` field for "log" (it is already projected — read it).
