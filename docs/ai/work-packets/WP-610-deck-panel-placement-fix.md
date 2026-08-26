# WP-610 — Deck Probability Panel Placement Fix

**Status:** Ready
**Primary Layer:** `apps/arena-client` (one scoped-CSS property)
**Dependencies:** WP-607 / EC-642 / D-24418 (the `DeckProbabilityPanel.vue` whose placement this corrects)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `3195cf73` (EC-644: Hand Projection Panel Section, #1658).

---

## Session Context

Operator-reported: the Deck Probability Panel's collapsed **"Deck odds"** toggle
is not visible in a live match — it renders **behind** the "Download diagnostics"
and "View loadout in Registry Viewer" buttons in the bottom-left corner.

Root cause: `DeckProbabilityPanel.vue` is pinned `position: fixed; bottom: 8px;
left: 8px; z-index: 9997`. But the bottom-left corner already stacks two fixed
utility overlays — `DiagnosticExportButton` (`bottom: 8px`, `z-index: 9999`) and
`ViewLoadoutButton` (`bottom: 40px`, `z-index: 9999`). WP-607 placed the panel in
the **exact same slot** as the diagnostics button but a **lower** z-index, so both
buttons paint over the collapsed toggle. The two buttons already document a 32px
vertical stride (8px → 40px); the panel must take the next free slot.

---

## Goal

The collapsed "Deck odds" toggle sits **clear of** the two bottom-left utility
buttons and is clickable; expanding it grows upward into open space. One scoped
CSS property changes: `bottom: 8px` → `bottom: 72px`.

---

## User-Visible Impact

The "Deck odds" toggle is now visible and reachable in a live match (previously
hidden behind the diagnostics / loadout buttons). No behavioural change —
same collapsible panel, same content.

---

## Assumes

- WP-607 on `main`: `DeckProbabilityPanel.vue` with `.deck-probability-panel`
  `position: fixed; bottom: 8px; left: 8px; z-index: 9997`.
- `DiagnosticExportButton.vue` (`bottom: 8px`, `z-index: 9999`) and
  `ViewLoadoutButton.vue` (`bottom: 40px`, `z-index: 9999`) occupy the bottom-left
  corner; both are mounted siblings in `PlayViewport.vue`.
- `pnpm -r build` 0; arena-client `typecheck` + `test` green on `3195cf73`.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — the
  `.deck-probability-panel` scoped-CSS block (the only edit).
- `apps/arena-client/src/components/DiagnosticExportButton.vue` — `bottom: 8px`,
  `z-index: 9999` (the slot WP-607 collided with).
- `apps/arena-client/src/components/ViewLoadoutButton.vue` — `bottom: 40px`,
  `z-index: 9999`; its own comment documents "sits above the diagnostics button
  (bottom: 8px) so the two never overlap" — the 32px stride this WP extends.
- `apps/arena-client/src/pages/PlayViewport.vue` — mounts all three as siblings.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; a `// why:`
  comment on the non-obvious offset (the 8/40/72 stride + the collision it fixes).

**Packet-specific:**
- **One property, scoped CSS only.** `.deck-probability-panel { bottom: 8px }` →
  `bottom: 72px`. No logic, template, z-index, or other-file change.
- **No new test.** jsdom (`@vue/test-utils`) does not lay out `position: fixed`
  elements, so a layout assertion is not meaningful; the fix is verified by a
  live dev-server measurement (see Verification Steps). The existing panel tests
  must still pass unchanged.

**Locked values:** `bottom: 72px` (continues the corner's 8 → 40 → 72 32px stride).

---

## Scope (In)

### A) `DeckProbabilityPanel.vue` (**modified**)
- `.deck-probability-panel` scoped CSS: `bottom: 8px` → `bottom: 72px`, with a
  `// why:` comment naming the `DiagnosticExportButton` (8px) / `ViewLoadoutButton`
  (40px) stack it now clears. No other change.

---

## Out of Scope

- **No z-index change** — the panel now clears the buttons vertically; stacking
  order is moot.
- **No redesign of the expand-upward anchoring** — the panel stays bottom-anchored;
  only its offset moves.
- **No change to the two utility buttons** — they keep their 8px / 40px slots.
- **No new/changed tests** — layout is not jsdom-observable.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — **modified** — `bottom: 8px` → `72px`

No other **code** files may be modified. (The `EC-645:` implementation commit
touches exactly this 1 file; the STATUS / DECISIONS / WORK_INDEX / mindmap
governance edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

N/A — no scoring/PAR/leaderboards, identity, multiplayer sync, card-data, or
monetization. A CSS placement correction to a read-only client aid. No engine /
`G` / `ctx` / hash surface.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint, no `apps/server/src/**` library function.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `.deck-probability-panel` uses `bottom: 72px` (not `8px`) with a `// why:`
  comment naming the two colliding buttons.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; arena-client
  suite green (the existing panel tests unchanged).
- [ ] The `EC-645:` implementation diff is exactly the 1 code file.
- [ ] Live measurement: the collapsed toggle's box does not overlap the
  diagnostics button; the expanded panel does not overlap it either.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: all exit 0 / pass

Select-String -Path "apps\arena-client\src\components\play\DeckProbabilityPanel.vue" -Pattern "bottom: 72px"
# Expected: one match

git diff --name-only
# Expected (implementation commit): only DeckProbabilityPanel.vue.
```

Live layout check (dev server + injected snapshot; not a committed test):
measure the toggle's and diagnostics button's bounding boxes and assert no
overlap collapsed AND expanded.

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  in a real deployed match, the "Deck odds" toggle is visible in the bottom-left,
  clear of the diagnostics / loadout buttons, and expands.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; suites green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land D-24421 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-610 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS
  (always-apply + packet-specific one-property lock; locked value). §3 Assumes —
  PASS. §4 Context — PASS (cites the two colliding buttons + the mount host).
- §5 Files — PASS (1 code file; governance is the separate SPEC commit). §6 Naming
  — PASS. §7 Deps — PASS (none). §8 Boundaries — PASS (client CSS only). §9 Windows
  — PASS. §10/§11 — N/A.
- §12 Tests — PASS (no new test; layout not jsdom-observable — justified; existing
  tests unchanged). §13 Commands — PASS. §14 Acceptance — PASS (4 binary items).
  §15/§15.1 — PASS (surface + D-24026 live-on-surface).
- §16 Code style — PASS (`// why:` on the offset). §17 Vision — N/A + no-hash note.
  §18 Prose-vs-grep — PASS (presence grep for `bottom: 72px`). §19 — N/A.
  §20 Funding / §21 API — N/A with reasons.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-26).**

- **Dependencies verified against `origin/main` (`3195cf73`):** `.deck-probability-panel`
  is `bottom: 8px; left: 8px; z-index: 9997`; `DiagnosticExportButton` `bottom: 8px`
  `z-9999`; `ViewLoadoutButton` `bottom: 40px` `z-9999` — the collision is real and
  reproduced. The 72px slot is free.
- **PS items (blocking): none.** Trivial, self-contained, low-risk CSS offset.
- **Verification note:** layout is not jsdom-observable, so correctness is proven
  by a live dev-server bounding-box measurement rather than a committed test —
  recorded in the execution notes.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-26).** One-property scoped-CSS change; no logic, no
new dependency, no test surface. The only judgement call is the offset value:
72px continues the two buttons' established 8 → 40 32px stride and clears both
(ViewLoadout occupies ~40–68px; the toggle's box starts at 72px). No hidden
coupling. Session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24421 (reserved; Drafted 2026-08-26, not yet landed)** — Bottom-left fixed
  play-surface overlays stack on a shared 32px vertical stride from the corner:
  `DiagnosticExportButton` `bottom: 8px`, `ViewLoadoutButton` `bottom: 40px`,
  `DeckProbabilityPanel` `bottom: 72px`. WP-607 had pinned the Deck panel to
  `bottom: 8px` (the diagnostics slot, `z-9997 < 9999`), hiding the collapsed
  toggle. Any future bottom-left overlay takes the next 32px slot (104px). Pure
  client CSS; no engine / projection / hash surface.

---

## See Also

- [WP-607](WP-607-deck-probability-panel-mvp.md) / D-24418 — the panel this repositions
- `apps/arena-client/src/pages/PlayViewport.vue` — the shared fixed-overlay mount host
