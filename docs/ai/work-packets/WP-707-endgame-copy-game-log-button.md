# WP-707 — Endgame "Copy game log" button (Arena Client)

> **Status:** Drafted (Phase 1). Not yet executed.
> **Layer:** App (`apps/arena-client`) — single layer, single package.
> **Lane:** Lightweight-Lane-eligible (see `§Lane`).
> **Baseline:** `origin/main` @ `745c63fa` (2026-09-18).

## Goal

Add a one-click **"Copy game log"** button to the end-of-match outcome
screen that puts the human-readable play-by-play transcript on the
clipboard. Today the endgame screen offers "Download diagnostics",
"Download game log" (PR #2037), "View cards in Registry Viewer" and a
"View final board" link — but **no copy-to-clipboard affordance for the
log**: the only place a player can copy the transcript is the in-match
`GameLogPanel` Copy button, which at game over is collapsed behind the
"View final board" toggle. This fills that gap with a clipboard sibling
of the shipped `GameLogDownloadButton`, reusing the existing
`buildGameLogText` formatter.

## Assumes

- **PR #2037 (`GameLogDownloadButton.vue`, merged 2026-09-14)** — the
  endgame log *download* already exists, mounted at the `PlayViewport`
  root beside `DiagnosticExportButton`, shown at game over when a
  non-empty log exists. This WP mirrors its show-condition and placement
  and does **not** touch it. Locks: download/export is already shipped →
  Out of scope here.
- **WP-322 / `components/log/gameLogExport.ts`** — the pure
  `buildGameLogText(log: readonly LogEntry[]): string` transcript
  formatter (one entry per line, `[outcome]` tag on non-`neutral`
  lines, trailing newline). Reused verbatim; no new formatter.
- **WP-322 / `GameLogPanel.copyLog`** — the best-effort clipboard idiom
  (`navigator.clipboard?.writeText` presence guard + swallowed
  rejection, never throws into the UI). Mirrored.
- **WP-434 / `UIState.log: LogEntry[]`** — the engine-authored log
  projection, already carried in the client `uiState` store snapshot.
  Read-only; no engine/UIState change.
- **D-6512** — the `vue-sfc-loader` separate-compile pipeline requires
  the `defineComponent({ setup() { return {...} } })` form so template
  bindings reach `_ctx` (both sibling buttons follow this).

## Context

Observed 2026-09-18 during a live deployed match on
`play.legendary-arena.com`: Jeff expected a "copy LOG" button on the
match-over screen and it was not there. **Supersession reconciliation
(01.0a Step 2):** the download/export half of "copy or export the log"
already shipped four days earlier as `GameLogDownloadButton` (PR #2037).
The task premise ("no affordance to copy *or* export the log") is
therefore half-superseded; per the drafting-phase reconcile-and-retarget
rule this WP is **narrowed to the still-missing copy-to-clipboard
affordance only** — drafting a full "copy/export" WP would duplicate
shipped work. Jeff's own scope statement ("copies to the clipboard
**and/or** downloads") makes copy-alone a complete satisfaction of the
intent now that download exists.

> **Operational flag (not in scope, surfaced for triage):** Jeff saw
> *no* "Download game log" button on the live 2026-09-18 screen even
> though #2037 shipped it on 2026-09-14. That points at a stale
> arena-client deploy (CF Pages missed-push) or a `v-if` gate that did
> not hold on his match — a deploy/observability bug, separate from this
> draft. Worth checking at execution live-verify time; not a WP task.

Single WP, single layer (App), strictly additive UX. No split needed.

## Scope (In)

- New `apps/arena-client/src/components/GameLogCopyButton.vue` — a
  fixed-position pill button (mirroring `GameLogDownloadButton`) that:
  - shows **only at game over with a non-empty log** — same condition as
    `GameLogDownloadButton.hasDownloadableLog`
    (`snapshot !== null && snapshot.gameOver !== undefined && snapshot.log.length > 0`);
  - on click writes `buildGameLogText(snapshot.log)` to the clipboard
    via the best-effort `GameLogPanel.copyLog` idiom (presence guard +
    swallowed rejection);
  - stacks directly **above** `GameLogDownloadButton` (`bottom: 72px`
    vs its 40px vs the diagnostics button's 8px), same pill style.
- New `apps/arena-client/src/components/GameLogCopyButton.test.ts` —
  unit coverage: the show/hide cases mirror
  `GameLogDownloadButton.test.ts` (game over / during play / no
  snapshot), and the click-path assertion follows
  `GameLogPanel.test.ts`'s **clipboard-stub** pattern (the download test
  stubs `downloadTextFile`/Blob — a different mechanism).
- Wire `<GameLogCopyButton />` into `apps/arena-client/src/pages/PlayViewport.vue`
  at the shared viewport root beside the two existing buttons (the one
  same-layer runtime-wiring file, `01.5`).

## Scope (Out)

- **Download / file export of the log** — already shipped
  (`GameLogDownloadButton`, PR #2037). Not touched.
- The in-match `GameLogPanel` Copy/Save/Expand toolbar — unchanged.
- Any change to `buildGameLogText`, `UIState`, the engine, the log
  projection, persistence, determinism/hash, or scoring surfaces.
- Markdown / rich formatting of the copied text (the transcript is the
  existing plain-text `buildGameLogText` output; a markdown variant is a
  possible follow-up, not this WP).
- A toast / "Copied!" confirmation animation (a possible follow-up; v1
  matches the silent best-effort behavior of the existing Copy button).

## Files Expected to Change

| File | Change |
|---|---|
| `apps/arena-client/src/components/GameLogCopyButton.vue` | **new** — the clipboard button |
| `apps/arena-client/src/components/GameLogCopyButton.test.ts` | **new** — unit coverage |
| `apps/arena-client/src/pages/PlayViewport.vue` | **wire** — import + `components` + one `<GameLogCopyButton />` (the single `01.5` runtime-wiring file) |

Governance-only (excluded from the code allowlist): `WORK_INDEX.md`,
`EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`.
No `DECISIONS.md` entry (no new invariant locked).

## Contract

- **Component:** `GameLogCopyButton` (`name: 'GameLogCopyButton'`,
  `defineComponent({ setup })` per D-6512).
- **Show condition:** identical to `GameLogDownloadButton.hasDownloadableLog`.
- **Clipboard payload:** exactly `buildGameLogText(snapshot.log)` — the
  same bytes the download writes to the `.txt`.
- **Failure posture:** best-effort — absent Clipboard API or a rejection
  is swallowed; the button never throws into the UI (mirrors
  `GameLogPanel.copyLog`).
- **Placement:** fixed, bottom-left, `bottom: 72px; left: 8px`, stacked
  above `GameLogDownloadButton`; `data-testid="game-log-copy-button"`.

## Acceptance Criteria

- [ ] At game over with a non-empty log, the "Copy game log" button
      renders above "Download game log"; clicking it writes
      `buildGameLogText(snapshot.log)` to the clipboard.
- [ ] During play (no `gameOver`), the button is absent.
- [ ] With no snapshot, or an empty log, the button is absent.
- [ ] A missing/rejecting Clipboard API is swallowed — no throw, no
      unhandled rejection.
- [ ] `buildGameLogText` is reused (no second formatter); the copied
      bytes equal the download `.txt` bytes.
- [ ] `apps/arena-client` unit suite green; `vue-tsc` clean;
      `pnpm -r build` clean. No engine/`UIState`/persistence/hash change.

## Verification Steps

1. `pnpm --filter @legendary-arena/arena-client test` — green, including
   the new `GameLogCopyButton.test.ts` (shown at game over / hidden
   during play / hidden with no snapshot / clicking copies the
   engine-authored transcript).
2. `pnpm --filter @legendary-arena/arena-client exec vue-tsc --noEmit` — clean.
3. `pnpm -r build` — clean.
4. **D-24026 live-verify (REQUIRED, `User-Visible Surface =
   play.legendary-arena.com`):** on the deployed build, play a match to
   game over, click "Copy game log", paste — the human-readable
   transcript is on the clipboard. (Also confirm the "Download game log"
   button is visible — see the Context operational flag.)

## Definition of Done

- [ ] The three files above changed; no others in `packages/**` or other
      apps.
- [ ] All Acceptance Criteria met; Verification Steps 1–3 green.
- [ ] `git diff --name-only` shows ≤ 3 code/test files (Lane budget holds).
- [ ] Governance rows (WORK_INDEX/EC_INDEX/mindmap) flipped per the EC's
      "After Completing".
- [ ] D-24026 live-verify recorded (post-deploy; per Lane, a single
      STATUS-flip commit).

## Lane

Provisionally **Lightweight-Lane-eligible** (01.0a; confirm at
govern-close):

- **Structural:** single layer / single app; 2 new code/test files + 1
  same-layer runtime-wiring file (`PlayViewport.vue`) — within the
  ≤4-code + 1-wiring budget; no new contract file; no `01.6` trigger; no
  D-entry; surface is UX only — no scoring/PAR/identity/sync/RNG/
  determinism.
- **Empirical (to confirm at close):** strictly additive (a new
  component + one wiring line — no rewrite of existing logic); zero
  determinism impact (reads projected `UIState.log`; `finalStateHash`
  N/A); file/wiring budget holds at final `git diff --name-only`.

The **scaffold-first** safeguard for the Lane is trivially satisfiable
here (prototype the component + run `apps/arena-client` suite) but is
NOT a validation-tightening change, so no fixture-migration surprise is
expected — the scaffold still runs and its output is recorded at
execution.

## Lint Gate Self-Review (00.3)

All 21 sections resolved (App-layer additive UX WP):

- **§1 Scope closure / §2 Files allowlist** — PASS: closed In/Out;
  3-file allowlist; download explicitly Out (superseded by #2037).
- **§3 Layer boundary** — PASS: App-only; reads projected `UIState`;
  no engine/registry/server/preplan import; the one wiring file is
  same-layer (`01.5`).
- **§4 Determinism / §5 Persistence** — N/A: no `G`, no `ctx.random`,
  no snapshot/DB write; `finalStateHash` unaffected.
- **§6 Move/phase contract** — N/A (no engine).
- **§7 Zone ops / §8 `.reduce()`** — N/A.
- **§9 Naming / §10 Comments** — PASS: full-word names; `// why:` on
  the `Date.now()`-free clipboard idiom and the show-condition
  (mirrors the sibling's existing comments).
- **§11 Error handling** — PASS: clipboard rejection swallowed with a
  `// why:` (safe — the transcript is non-critical; user can still
  Download).
- **§12 File structure** — PASS: sits beside the two existing sibling
  buttons in `components/`.
- **§13 ESM / §14 canonical field names** — PASS.
- **§15–16 Testing / duplicate-first** — PASS: the test mirrors
  `GameLogDownloadButton.test.ts`'s **show/hide structure** (game over /
  during play / no snapshot) and follows `GameLogPanel.test.ts`'s
  **clipboard-stub** assertion for the click path (the download test
  stubs `downloadTextFile`/Blob — a different mechanism). Three
  deliberate duplications under duplicate-first, all matching the
  diagnostics/download sibling precedent, none extracted here (a wrong
  abstraction is worse than the copy; extraction is a separate hygiene
  follow-up if a fourth appears): (a) the ~4-line best-effort clipboard
  guard (3rd occurrence — Diagnostics + GameLogPanel are the first two);
  (b) the `hasDownloadableLog` show-condition computed (2nd copy); and
  (c) the fixed-position pill `<style scoped>` block (3rd fixed-pill
  style alongside diagnostics/download).
- **§17 Vision alignment** — PASS: pure UX affordance; NG-1 pay-to-win
  N/A; no anti-commercial surface.
- **§18 Contract-file lock** — N/A (no `.types.ts`/`.validate.ts`/`.gating.ts`).
- **§19 Canonical arrays** — N/A.
- **§20 Post-mortem trigger** — N/A (no new abstraction/contract).
- **§21 API catalog** — N/A (no HTTP endpoint / server library fn).
- **§Board-Visible Field Rule** — N/A (reads the already-projected
  `UIState.log`; no new `UIState` field, so no build/filter/five-step
  contract).

No unmet items.

## Gate Verdicts (on record)

- **Pre-flight (01.4):** **READY TO EXECUTE** (2026-09-18, independent
  subagent). No PS-items; every dependency claim verified against source
  (PR #2037 = `3d5c7009`, an ancestor of baseline `745c63fa`;
  `buildGameLogText`, `copyLog`, `UIState.log` all real). Non-blocking
  notes: mirror `GameLogDownloadButton`'s store-sourcing; watch the
  deploy-staleness flag at live-verify.
- **Copilot (01.7):** **PASS** (2026-09-18, independent subagent).
  Initial RISK → HOLD raised two wording-only FIXes (a `// why:` on the
  `72px` offset; a fuller duplicate-first note) + one test
  cross-reference accuracy note; all applied in-place and re-verified
  PASS. Scope/allowlist/mutation boundary unchanged.
- **Lint gate (00.3):** all 21 sections resolved (see §Lint Gate
  Self-Review above).

See [EC-744](../execution-checklists/EC-744-endgame-copy-game-log-button.checklist.md).
