# WP-778 — Split-face cost picker: disable a side whose discard cost the hand cannot pay

**Status:** Draft 2026-09-26 · **EC:** EC-815 · **Reserves:** (none — consumes D-24615)
**Primary Layer:** Arena Client (App)
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (the draft lands with WP-777's; execution is its own session). Not claimed lightweight: no draft-time scaffold is possible before WP-777's fields exist. **BLOCKED on WP-777** (unblocks when the EC-814 commit is on `main` and the two fields exist in `ui/uiState.types.ts`; WP-777's post-deploy live verify is not required first).
**Baseline:** `origin/main` @ `19b83c50` (2026-09-26)

## Goal

Make the split-face "Choose a side" picker honest about a side's play cost. When a face costs a
discard ("To play this side, you must discard a card." — bkwd Attune), the picker shows that
cost on the button. When the hand holds no card to discard, the button is disabled and says
why. Today the picker offers Attune as clickable. After WP-777 an unpayable click is rejected by the
engine with a logged "could not choose … choose the other side" line and the queue left intact
(D-24615), so the click only produces a rejection log line.

## User-Visible Impact

- The Attune button reads "Discard a card to play this side" under its economy line.
- With an empty hand the Attune button is disabled, with the hint "No card in hand to discard".
  The Atone button stays enabled, so the player is never stuck.
- Faces with no cost render exactly as today.

## Assumes

- **WP-777 ✅ (hard dependency)** — the engine projects two **optional** fields on each
  `UISplitFaceOption` (`packages/game-engine/src/ui/uiState.types.ts`), always populated by the
  builder:
  - `isSelectable?: boolean` — false only when this face's discard cost is unpayable and the
    other face is payable (D-24615 anti-freeze).
  - `discardToPlayCost?: number` — 0 when the face has no cost.
  The engine rejects an unselectable face with a logged "could not choose … choose the other side"
  line and leaves the queue intact (D-24615).
- **WP-725 ✅ + #2427 ✅** — `SplitFaceChoicePrompt.vue` renders both faces in printed order
  (`leftFace`) with an `isSubmitting` latch, `AbilityText` for ability text, and
  `data-testid="split-face-a|b"`. The `resolveSplitFaceChoice` member is already in the
  `UiMoveName` union.
- `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) and test are green on `origin/main`.

## Context (Read First)

- `apps/arena-client/src/components/play/SplitFaceChoicePrompt.vue` + `.test.ts` — the only
  files touched.
- `docs/ai/DECISIONS.md` — scan D-24615 (the served fields and logged rejection), D-24545 /
  D-24546 (the split-face choice), D-20105.
- D-20105: the client re-evaluates no rule. It renders the served `isSelectable` /
  `discardToPlayCost` verbatim, and never counts the hand itself.
- **Absent-field posture:** the fields are optional in the type (to keep engine-packet fixtures
  compiling). An absent `isSelectable` is treated as selectable and an absent `discardToPlayCost`
  as 0. That is today's behavior, so an older server frame renders exactly as before.
- **Why its own WP.** It is a different layer from WP-777 (the WP-724 → WP-725 precedent), and
  WP-777 is safe without it.

## Non-Negotiable Constraints

**Engine-wide (do not remove):** ESM only, Node v22+, `node:` prefix. Vue SFCs compile via
`vue-sfc-loader` (test-only devDep). Full file contents, no diffs, no snippets. Human-style code per
`docs/ai/REFERENCE/00.6-code-style.md` (no nested ternaries, full-word names, JSDoc on functions).

**Packet-specific:**
- Client-only: no `packages/**`, server, or engine change.
- A disabled face never calls `submitMove`. The `isSubmitting` latch and the `leftFace` order are
  unchanged.
- Copy is locked (below). No rule text composed beyond these two strings.
- vue-tsc is gated **Before** and **After**.

**Session protocol:** if WP-777's served field names or semantics differ from Assumes, STOP.

## Locked Contract Values

- A face is disabled iff `isSubmitting || option.isSelectable === false`. `aria-disabled` mirrors it.
- Cost line (rendered when `(option.discardToPlayCost ?? 0) > 0`):
  - cost 1 → `Discard a card to play this side`
  - cost N > 1 → `Discard ${N} cards to play this side`
- Unselectable hint (rendered when `option.isSelectable === false`): `No card in hand to discard`
  when `(option.discardToPlayCost ?? 0) <= 1`, else `Not enough cards in hand to discard`, with
  `data-testid="split-face-${face}-blocked"`.
- `onChoose(entry)` receives the ordered entry. Its **first line** is
  `if (isFaceDisabled(entry.option)) return;` — **before** the `isSubmitting` latch is set
  (`isFaceDisabled` already covers `isSubmitting`). A latch set by a blocked click would disable the
  other face with no server frame coming to reset it.
- The cost line carries `data-testid="split-face-${face}-cost"`.

## Scope (In)

- `SplitFaceChoicePrompt.vue` — a small `isFaceDisabled(option)` helper and a `costLabel(option)`
  helper (JSDoc on each). The two spans, the `:disabled` / `:aria-disabled` binding update, and a
  guard in `onChoose` that ignores a disabled face. The `onChoose` signature changes from `face`
  to the ordered entry. Reuse the existing `.split-face-prompt__btn:disabled`
  rule (no new disabled style). The template's `@click="onChoose(entry.face)"` becomes
  `@click="onChoose(entry)"` to match the new signature.
- `SplitFaceChoicePrompt.test.ts` — exactly **+5 tests** inside the existing `describe`
  (9 tests / 1 suite / 0 fail → 14 tests / 1 suite / 0 fail):
  1. Cost 1 → the singular cost line `Discard a card to play this side`.
  2. Cost 2 + `isSelectable: false` → the plural cost line **and** the `Not enough cards in hand to discard` hint.
  3. Absent fields, and cost 0 → no cost line, no blocked hint, button enabled (today's render).
  4. Cost 1 + `isSelectable: false` → `disabled` present + `No card in hand to discard` hint + the
     **guard proof**: `element.removeAttribute('disabled')`, `trigger('click')` → no submit
     (@vue/test-utils skips `trigger` on a disabled element, so a plain click cannot prove the guard).
  5. Mount its **own** wrapper (cost 1, face a unselectable); force-click the blocked face
     (`removeAttribute('disabled')` → `trigger`), then click the other face → exactly one call,
     `{ face: 'b' }` (proves the blocked click did not set the latch).
  - The existing 9 tests stay green unchanged.

## Out of Scope

- Any engine / projection change (WP-777). Other pending prompts. `DiscardToPlayPrompt.vue` is
  unchanged: it already handles the discard WP-777 parks.
- Showing the cost on hand cards before play.
- De-duplicating the cost line against Attune's printed ability text (both show; the cost line is locked copy).

## Files Expected to Change

- `apps/arena-client/src/components/play/SplitFaceChoicePrompt.vue` — **modified**
- `apps/arena-client/src/components/play/SplitFaceChoicePrompt.test.ts` — **modified**
- Governance: `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

## Contract

- The picker renders the served `isSelectable` / `discardToPlayCost` verbatim. An unselectable
  face is disabled and never submits.
- Absent fields render as today.

## Acceptance Criteria

1. A face with `discardToPlayCost: 1` shows "Discard a card to play this side".
2. A face with `discardToPlayCost: 2` shows "Discard 2 cards to play this side".
3. An unselectable face shows "No card in hand to discard" when its cost is ≤ 1, and "Not enough
   cards in hand to discard" when its cost is > 1.
4. An unselectable face never submits, even with its `disabled` attribute removed.
5. A blocked click does not set the latch: the other face then submits `{ face: 'b' }` exactly once.
6. A face without the fields renders exactly as before WP-778 (no cost line, no hint, enabled).
7. `aria-disabled` mirrors the disabled state.
8. vue-tsc exits 0, and the picker file reports 14 tests / 1 suite / 0 fail.

## Verification Steps

```pwsh
pnpm --filter "@legendary-arena/arena-client^..." build
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0 (Before AND After)
pnpm --filter @legendary-arena/arena-client test
# Expected: 0 failures; SplitFaceChoicePrompt.test.ts 14 tests / 1 suite / 0 fail
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All acceptance criteria pass. vue-tsc exits 0. The arena-client suite has 0 failures, with
      counts recorded.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED, post-deploy):** in a manual Falcon & Winter Soldier match,
      play Attune / Atone with an empty hand → Attune is disabled with the hint, and Atone works.
      With a card in hand → Attune shows the cost line. Record the matchId in STATUS.md.
- [ ] `docs/ai/DECISIONS.md` — no new entry (consumes D-24615); confirmed none needed.
- [ ] `docs/ai/STATUS.md` updated. WORK_INDEX WP-778 `[x]` with date. EC_INDEX EC-815 → Done.
      Mindmap `📝`→`✅`. `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** §1 / §2 (faithful card semantics surfaced honestly), §11 (stateless client:
  renders served state), §17 (accessibility: `aria-disabled` plus a visible reason). NG-1 not crossed.
- **Conflict assertion:** No conflict. This is display-only and touches no monetization surface.
- **Determinism preservation:** N/A. The client renders served state only.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** every required section is present. Baseline cited.
- **§2 constraints:** engine-wide, packet-specific, session protocol, and locked copy.
- **§3 / §4:** WP-777, WP-725, #2427, and D-20105 are cited with file anchors.
- **§5 / §7:** a 2-file allowlist plus governance. No new deps.
- **§6 naming:** served field names verbatim. Helpers are full words; boolean helper starts with `is`.
- **§8 layer:** arena-client only. It consumes the engine type (Runtime-Safe surface, type-only).
- **§9 Windows:** `pwsh` verification. **§10 / §11:** N/A.
- **§12 tests:** vue-sfc-loader `node:test`, including a negative (a disabled face never submits).
- **§13 / §14 / §15:** exact commands with the picker-file count, 8 binary ACs, and a DoD with
  D-24026 and an explicit DECISIONS (none needed) line.
- **§16 code style:** no nested ternary (the cost label uses `if/else`).
- **§17 Vision:** present. **§18:** N/A — no grep-based acceptance. **§19:** N/A.
- **§20 Funding:** N/A — display-only picker affordance; no funding surface or funding copy.
- **§21 API Catalog:** N/A — client-only; no `apps/server` endpoint or `Library-only` function touched.

## Gate Verdicts

- **Pre-flight (01.4): READY TO EXECUTE (conditional on WP-777).** Two doc blockers were applied:
  PS-1, build `arena-client^...` (vue-tsc needs `preplan` / `vue-sfc-loader` dist); PS-2, the lane
  changed to standard two-session, since no draft-time scaffold is possible before WP-777's fields
  exist. RS items applied: a guard-proof test shape (`removeAttribute('disabled')`), plural hint copy,
  +5 tests (9/1 → 14/1), reuse of the existing `:disabled` style, Vision §11 / §17, and a dependency
  gate on the EC-814 commit rather than the deploy. Baseline picker suite observed: 9 tests / 1 suite / 0 fail.
- **Delta re-run (01.4 + 01.7): READY TO EXECUTE (conditional on WP-777) / PASS after fixes.**
  Fixes: the stale "silent no-op" wording now matches WP-777's logged rejection; test 5 mounts its
  own wrapper (no cross-test state); the `@click` binding change is in scope.
- **Copilot (01.7): RISK → HOLD, fixes applied.** Three findings: the guard-before-latch order
  was locked (a blocked click must not set the latch); the five tests are enumerated, including
  the plural hint and a same-wrapper other-face proof; and the baseline notation was unified.
  Scope-neutral, so no pre-flight re-run.
- **Lint (00.3): PASS.** The first run failed on §14 (<6 ACs), §15 (no DECISIONS line), bare
  §20 / §21 N/A, and the EC hint condition not verbatim. All were fixed. The delta re-run passed,
  with 01.4 / 01.7 confirmed still holding.
