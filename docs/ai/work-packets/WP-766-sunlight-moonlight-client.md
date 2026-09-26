# WP-766 — Day/Night badge on the play HUD (Arena Client)

**Status:** Draft 2026-09-25. **BLOCKED on WP-765** (which projects `UIHQState.dayNight`).
**Primary Layer:** App (`apps/arena-client`)

**Dependencies:**
- **WP-765 / D-24598:** `UIHQState.dayNight?: 'sunlight' | 'moonlight' | 'neither'`, omitted when no Hero in the match has a day/night line.
- WP-557 / 558 / D-24366: the TopHudBar DangerMeter precedent.
- WP-736 / #2289: the `CrossedSwordsIcon` inline-SVG precedent.
- WP-129 / EC-132.

**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). The packet is small, but it is user-visible and depends on an unmerged contract.
**Arc:** 2 of 2. Runs after WP-765.

> Baseline: `origin/main` at `3955ba1e` + #2389. At execution, re-baseline on WP-765's merge.

---

## Goal

When a match includes day/night Heroes, a **Day/Night badge** appears beside the DangerMeter in `TopHudBar`:

| State | Icon | Label |
|---|---|---|
| Sunlight | inline SVG sun | **Sunlight** |
| Moonlight | inline SVG moon | **Moonlight** |
| Neither | none | **Neither** |

Players can see which of their Sunlight/Moonlight abilities will fire before they play the card. The badge is absent in every other match.

## User-Visible Impact

Players of Werewolf by Night, Blade, Morbius, Wong, Sunspot, Warlock, Wolfsbane and Mirage can read the current state at a glance, instead of counting odd and even costs in the HQ themselves.

---

## Assumes

1. **WP-765 is merged.** `UIHQState.dayNight?` exists with the three-value union, passes through the audience filter, and is present iff a Hero hook carries a `sunlightInEffect`/`moonlightInEffect` condition or the `day-night-both` keyword (WP-765 presence rule).
2. **TopHudBar** (`components/play/TopHudBar.vue`):
   - receives the full `snapshot: UIState` prop (`:34-37`);
   - mounts `<DangerMeter>` in row 2 (`:189`), which is `flex-wrap`.
   - `TopHudBar.test.ts`'s `fixture()` builds `hq` without `dayNight`, so the field is absent by default. There are no `html()` or snapshot assertions.
3. **Mounts.** `TopHudBar` is mounted by `pages/PlayDesktop.vue:759` and `pages/PlayMobile.vue:513`, which pass the snapshot. **No page change is needed.**
4. **Desktop layout.** The desktop play stage is authored at a fixed 1280px and scales to fit (`PlayDesktop.vue:1412-1427`), so it never scrolls horizontally. The real layout risk is TopHudBar row 2 **wrapping**, which makes the HUD taller and shrinks the board.
5. **Glyph risk.** The play-surface font does not carry dingbat codepoints, so a missing glyph renders as nothing (`components/play/CrossedSwordsIcon.vue:2-8`; `CityRow.test.ts:170`). The fix precedent is an inline SVG.
6. **Where copy lives.** Client copy lives only in the client (the D-24367 §2 precedent, `vfx/menaceDisplay.ts`).
7. **SFC form.** EC-132 §2's `<script setup>` whitelist does **not** cover `DayNightBadge`:
   - clause (b) fails because the badge has computed state;
   - clause (d) fails because it has a sibling `.test.ts`.

   It therefore uses `defineComponent({ setup() { return {...} } })` (D-6512), matching `DangerMeter.vue:37`.
8. **Baseline.** `pnpm --filter @legendary-arena/arena-client typecheck` and `test` exit 0.
9. **No collisions.** No other packet touches TopHudBar or DangerMeter. `EndGameControl` is already on main, and WP-759 does not edit TopHudBar.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- WP-765 §Contract and D-24598.
- `components/play/DangerMeter.vue`, `components/play/TopHudBar.vue`, `components/play/CrossedSwordsIcon.vue`.
- `.claude/rules/architecture.md` §UIState Projection Integrity. This packet consumes the field and never re-derives day/night.
- User memory: `project_playmat_spatial_rebuild_d24502`, `reference_clipboard_verify_and_preview_block`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only; Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Client only; engine **types** only.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific:**
- **Render, never compute.** The client never computes day/night; it renders `snapshot.hq.dayNight` verbatim.
- **Absent field.** No badge element (`find('[data-testid="play-day-night-badge"]').exists() === false`). Existing TopHudBar assertions pass unedited.
- **Icons.**
  - Inline SVG sun and moon (Lucide `sun` / `moon` geometry, MIT), inlined in `DayNightBadge.vue`'s template.
  - Attributes: `stroke="currentColor"`, `aria-hidden="true"`, `focusable="false"`.
  - **No Unicode glyphs.**
  - `neither` shows no icon.
- **Copy** lives in the new `vfx/dayNightDisplay.ts`, which exports `dayNightLabel(state)`, `dayNightTooltip(state)` and `dayNightAriaText(state)`. No copy goes into `packages/`.
- **Accessibility.**
  - The badge has `role="status"`. It is a live region, and announcing a day/night flip is intended; record that in a `// why:`.
  - `aria-label` is `dayNightAriaText(state)`. The tooltip is rendered via the `title` attribute.
  - State is never conveyed by colour alone: the word is always shown.
- **SFC form.** `DayNightBadge.vue` uses `defineComponent({ setup() { return {...} } })`.
- **Layout.** At the 1280 authoring width, TopHudBar row 2 does not wrap when the badge is present. On PlayMobile the page has no horizontal scroll.

## Locked Values

- Component `components/play/DayNightBadge.vue`. Test id `play-day-night-badge`, with `data-state="sunlight|moonlight|neither"`.
- Labels: `Sunlight` / `Moonlight` / `Neither`.
- Tooltips (exact):
  - Sunlight: "Sunlight: most HQ Heroes have even printed costs."
  - Moonlight: "Moonlight: most HQ Heroes have odd printed costs."
  - Neither: "Sunlight and Moonlight are both off: the HQ has as many odd-cost as even-cost Heroes."
- `dayNightAriaText` (exact):
  - Sunlight / Moonlight: the tooltip text above.
  - Neither: "Neither. Sunlight and Moonlight are both off: the HQ has as many odd-cost as even-cost Heroes."
- Icons: inline SVG (Lucide `sun` / `moon`). None for `neither`.

---

## Scope (In)

- **A) Copy module.** `vfx/dayNightDisplay.ts` (new) + test: label, tooltip and aria text for each state.
- **B) Badge.** `components/play/DayNightBadge.vue` (new) + test:
  - renders the state and the SVG icon;
  - sets the a11y attributes;
  - renders no icon for `neither`.
- **C) Mount.** `components/play/TopHudBar.vue` (+ `TopHudBar.test.ts`) mounts the badge beside `DangerMeter` only when `snapshot.hq.dayNight !== undefined`.

## Out of Scope

Any engine change (WP-765), per-card "active now" hand highlighting, animated transitions and SFX, and villain-side day/night.

## Files Expected to Change

- `apps/arena-client/src/vfx/dayNightDisplay.ts` — **new**
- `apps/arena-client/src/vfx/dayNightDisplay.test.ts` — **new**
- `apps/arena-client/src/components/play/DayNightBadge.vue` — **new**
- `apps/arena-client/src/components/play/DayNightBadge.test.ts` — **new**
- `apps/arena-client/src/components/play/TopHudBar.vue` — modified (mount)
- `apps/arena-client/src/components/play/TopHudBar.test.ts` — modified (present / absent cases)
- Governance: `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## Contract

- The Locked Values above.
- The badge consumes `UIHQState.dayNight` only.

## Vision Alignment

**Vision clauses touched:** §17 (accessibility: word plus icon, screen-reader status), §1 (makes a printed rule legible), NG-1.
**Conflict assertion:** none.
**Non-Goal proximity:** not crossed.
**Determinism:** client-only; nothing touches `G`.

## Funding Surface Gate

§20 **N/A**: an in-match HUD badge.

## API Catalog

§21 **N/A**: arena-client only.

---

## Acceptance Criteria

1. With `snapshot.hq.dayNight` absent there is no badge element, and TopHudBar's existing tests pass unedited.
2. `sunlight`, `moonlight` and `neither` each render the locked label, `title` tooltip and `aria-label`, with `data-state` matching. Sunlight and Moonlight render their SVG icon; Neither renders none.
3. The badge has `role="status"` and is a `defineComponent` SFC.
4. At the 1280 authoring width, TopHudBar row 2 does not wrap with the badge present: the HUD height equals the no-badge render. On PlayMobile the page has no horizontal scroll. Both are verified by preview screenshot.
5. `pnpm --filter @legendary-arena/arena-client typecheck` → 0, `test` → all pass, and `pnpm -r --no-bail test` → 0 fail.

## Verification Steps

1. `pnpm -r build`; `pnpm --filter @legendary-arena/arena-client typecheck`; `pnpm --filter @legendary-arena/arena-client test`.
2. **Preview.** Start the arena-client preview. Either use a live guest match with a day/night Hero, or inject `hq.dayNight` into the mid-turn fixture via the dev store in the browser (not committed). Screenshot all three states at 1280×720 and on mobile, and compare the HUD height against the no-badge render.
3. `git diff --name-only` ⊆ Files Expected to Change.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] STATUS updated. DECISIONS: none (this packet consumes D-24598).
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `roadmap:counts:check` 0.
- [ ] Two-commit topology.
- [ ] **D-24026 live-verify (post-merge, with WP-765 deployed).** In a Werewolf by Night match the badge shows the right state and flips as the HQ changes. Recorded as a STATUS-flip.

---

## Lint Gate Self-Review (00.3)

- **§1:** all sections present.
- **§2:** boilerplate + session protocol.
- **§3:** Assumes line refs verified by the gate subagent.
- **§4:** precedents verified (CrossedSwordsIcon, EC-132 §2).
- **§5:** 6 files.
- **§6:** canonical names.
- **§7:** hard dependency on WP-765.
- **§8:** client only.
- **§9:** pnpm.
- **§10–11:** N/A.
- **§12:** `node:test` + vue-sfc-loader.
- **§13:** exact commands + preview.
- **§14:** 5 testable ACs.
- **§15:** STATUS, indexes, live-verify.
- **§16:** D-6512.
- **§17:** aria text locked.
- **§18–21:** N/A.

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent, static): DO NOT EXECUTE YET.** Two reasons: the expected WP-765 dependency, and PS-1..3. All are fixed in this revision:

- **PS-1:** the glyph precedent was misread. The WP-736 bug was a missing font glyph, and U+FE0E cannot fix that. Icons are now inline SVG.
- **PS-2:** the SFC form is locked to `defineComponent`.
- **PS-3:** `dayNightAriaText` is locked.
- **RS-1:** the "byte-identical" claim is reworded to a testable no-element check.
- **RS-2:** line refs corrected.
- **RS-3:** stale WP-563 citation dropped.
- The AC-4 layout criterion is rewritten (the desktop stage scales, so row 2 wrapping is the real failure).

**Scope verdict:** READY TO EXECUTE once WP-765 merges. Re-baseline on the merge.

**Copilot (01.7): RISK.** Findings were #4, #6 and #9. All are resolved by the PS fixes and the AC-4 rewrite; the `role="status"` live-region intent is recorded. **Residual: none beyond the dependency.**

**Final CONFIRM (independent subagent, 2026-09-25):** CONFIRM after two text fixes (Assume 1 presence rule; WORK_INDEX row wording).
