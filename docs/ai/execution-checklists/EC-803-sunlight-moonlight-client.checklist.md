# EC-803 — Day/Night badge (Execution Checklist)

**Source:** docs/ai/work-packets/WP-766-sunlight-moonlight-client.md
**Layer:** App (arena-client)

## Before Starting
- [ ] WP-765 is merged. `UIHQState.dayNight?` is exported, passed through the filter, and omitted when irrelevant. If not, STOP.
- [ ] `TopHudBar.vue`: the `snapshot` prop is at `:34-37`; `<DangerMeter>` is in row 2 at `:189`; row 2 is flex-wrap. The page mounts are unchanged.
- [ ] `CrossedSwordsIcon.vue` is the inline-SVG precedent.
- [ ] `pnpm -r build` → 0. arena-client `typecheck` and `test` → 0 on baseline.

## Locked Values (do not re-derive)
- New files:
  - `vfx/dayNightDisplay.ts`, exporting `dayNightLabel`, `dayNightTooltip` and `dayNightAriaText`;
  - `components/play/DayNightBadge.vue`, written as `defineComponent({ setup() { return {...} } })` (EC-132 §2 (b)+(d); D-6512).
- Test id `play-day-night-badge`, with `data-state` = `sunlight` | `moonlight` | `neither`.
- Labels: `Sunlight` / `Moonlight` / `Neither`.
- Tooltips, rendered via `title`, verbatim:
  - Sunlight: "Sunlight: most HQ Heroes have even printed costs."
  - Moonlight: "Moonlight: most HQ Heroes have odd printed costs."
  - Neither: "Sunlight and Moonlight are both off: the HQ has as many odd-cost as even-cost Heroes."
- `aria-label` = `dayNightAriaText(state)`:
  - Sunlight and Moonlight: the tooltip text.
  - Neither: "Neither. Sunlight and Moonlight are both off: the HQ has as many odd-cost as even-cost Heroes."
- `role="status"`.
- Icons:
  - Sunlight and Moonlight use inline SVG (Lucide `sun` / `moon` geometry) with `stroke="currentColor"`, `aria-hidden="true"` and `focusable="false"`.
  - `neither` renders no icon.
  - **No Unicode glyphs.**

## Guardrails
- Render `snapshot.hq.dayNight` verbatim. Never compute day/night on the client.
- When the field is absent, render no badge element. Existing TopHudBar tests stay unedited.
- All copy lives in `vfx/dayNightDisplay.ts`; none in `packages/`.
- Always show the word, so state is never conveyed by colour alone.
- At the 1280 authoring width, TopHudBar row 2 must not wrap with the badge present. On PlayMobile there must be no horizontal scroll.

## Required `// why:` Comments
- Rendering rather than computing: the engine owns the day/night truth (D-24598).
- Inline SVG: font-independent. The play-surface font lacks dingbat glyphs (the CrossedSwordsIcon precedent).
- `role="status"`: a live region; announcing a day/night flip is intended.
- No badge when the field is absent.

## Files to Produce
- `apps/arena-client/src/vfx/dayNightDisplay.ts` + `dayNightDisplay.test.ts` — **new**
- `apps/arena-client/src/components/play/DayNightBadge.vue` + `DayNightBadge.test.ts` — **new**
- `apps/arena-client/src/components/play/TopHudBar.vue` + `TopHudBar.test.ts` — **modified**
- `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. arena-client typecheck → 0 and suite passes. `pnpm -r --no-bail test` → 0 fail.
- [ ] Preview screenshots of all three states at 1280×720 and on mobile. HUD height equals the no-badge render. (The field may be injected via the dev store; do not commit that.)
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) recorded as a post-deploy STATUS-flip.

## Common Failure Smells
- The badge shows in core matches → the absent-field check is missing.
- The icon is missing → a Unicode glyph was used instead of inline SVG.
- The screen reader reads "Sunlight Sunlight: …" → `aria-label` concatenates label and tooltip instead of using `dayNightAriaText`.
- The board shrank when the badge appeared → row 2 wrapped; tighten the badge width.
