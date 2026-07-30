# WP-459 — Compact Multi-Column "Show Details" Reveal Layout (Legends Board)

**User-Visible Surface:** `legends.legendary-arena.com` (the WP-456 per-mastermind
"Show details" reveal on the gauntlet index). The expanded reveal currently stacks
every player count in a single column with generous gaps — ~40 rows of mostly
whitespace that forces scrolling. This WP lays the per-count approved-adversary
blocks in a **responsive multi-column grid** and tightens spacing, so the reveal
reads as a compact card. **D-24026 live-verification applies** (operator-pending).

## Goal

Make the WP-456 "Show details" reveal compact: render the five player-count blocks
in a **responsive grid** (multiple columns where width allows) instead of one tall
column, put each config's **Villains** / **Henchmen** on tight adjacent lines, and
reduce the inter-block whitespace — eliminating the excessive height and scrolling.
CSS-and-markup-structure only in `GauntletIndexPanel.vue`; the `buildGauntletDetails`
data (WP-456) and zero-API/`vue`-only invariants are untouched.

**Pairs with WP-458.** WP-458 collapses the approved menu 3→1, so each count block
shows **one** config instead of three — which already cuts the reveal's height ~3×.
This WP finishes the job with a grid layout. It works whether the menu has one or
three variants (it lays out whatever `buildGauntletDetails` returns), so it does
**not** hard-depend on WP-458 — but the two together are the intended end state.

## Assumes

- **On `origin/main` @ `4e0f3261`** (drafting baseline). `apps/legends-board`
  builds/tests/typechecks green.
- **The reveal + its data exist (WP-456).** `GauntletIndexPanel.vue` renders the
  `<details class="gauntlet-details">` block from `gauntletDetails(gauntlet)`
  (`buildGauntletDetails`), with `.gauntlet-details-body` (flex column),
  `.gauntlet-details-count` blocks (each `.gauntlet-details-count-label` +
  `.gauntlet-details-configs` list of `.gauntlet-details-config` items, each a
  flex-column of a Villains span + a Henchmen span). The scoped styles live in the
  same file's `<style scoped>`. (Source: the file on `main`.)
- **`apps/legends-board` is `vue`-only at runtime / zero-API** and pins
  `data-theme="dark"`; styles use the `--la-color-*` tokens already used in the
  panel. This WP adds no import, no data change. (Source: the file on `main`.)

## Context (Read First)

- `apps/registry-viewer/CLAUDE.md` note on theming does NOT apply here; per
  `apps/legends-board` (EC-417) the board pins `data-theme="dark"`, so
  `--la-color-*` tokens resolve dark — reuse them (no hardcoded hex beyond the
  existing pattern).
- `.claude/rules/code-style.md` — scoped CSS, human-style; no logic change.
- WP-456 (`docs/ai/work-packets/WP-456-*.md`) — the reveal this WP restyles; its
  `buildGauntletDetails` shape and the `Villains:` / `Henchmen:` headers are the
  contract this WP renders more compactly.
- This WP reserves **no D-entry** — it is UI layout polish that locks no decision
  (mirrors the WP-442 "no new D-entry" precedent).

## Scope (In)

- **`apps/legends-board/src/panels/GauntletIndexPanel.vue`** (modified):
  - **Grid the counts.** Change `.gauntlet-details-body` from a single flex
    column to a **responsive grid**
    (`display: grid; grid-template-columns: repeat(auto-fit, minmax(~13rem, 1fr)); gap`),
    so the five per-count blocks flow into 2–3 columns on a wide index row and 1
    column on narrow viewports. Keep the **Schemes** line full-width (spanning the
    grid) above the count grid.
  - **Tighten each count block.** Reduce the `.gauntlet-details-count` /
    `.gauntlet-details-configs` / `.gauntlet-details-config` gaps; render each
    config's **Villains** and **Henchmen** on tight adjacent lines (or inline with
    a separator) rather than widely-spaced stacked spans. Minor markup regrouping
    is allowed to support the grid (e.g. wrapping schemes vs counts), but the
    **rendered text content is unchanged** (same schemes, same `Villains:` /
    `Henchmen:` labels from WP-456).
  - Keep it **responsive** (no horizontal overflow on mobile — the grid collapses
    to one column) and keyboard-accessible (the native `<details>` is unchanged).

## Out of Scope

- **No data / helper change** — `buildGauntletDetails` and `gauntletDisplay.ts`
  are untouched; this is presentation only.
- **No change to the challenge link, download control, chips, or claimed-board
  links** — only the details reveal's layout.
- **No registry import, no `fetch`, no publisher/snapshot change** — `vue`-only,
  zero-API preserved.
- **No theming overhaul** — reuse existing `--la-color-*` tokens; do not
  retokenize or change the board's dark theme.
- **No hard dependency on WP-458** — the grid lays out one *or* three configs.

## Files Expected to Change

- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** — reveal
  `<style scoped>` (grid + tightened spacing) + minor supporting markup regrouping
  in the reveal template.

## Contract

> **Output contract (execution):**
> - Full file contents (no diffs). Scoped CSS; `vue`-only, zero-API — no import,
>   no data change.
> - Rendered **text** content of the reveal is unchanged from WP-456 (same
>   schemes + `Villains:`/`Henchmen:` labels); only layout/spacing changes.
> - Responsive: multi-column where width allows, single column on narrow
>   viewports, no horizontal overflow.

**Locked values (do not re-derive):**

- **Grid, not stack:** `.gauntlet-details-body` becomes a responsive CSS grid
  (`repeat(auto-fit, minmax(...))`); the Schemes line spans full width above it.
- **Compact spacing:** tighten the reveal's gaps; Villains/Henchmen sit on
  adjacent tight lines, not widely-spaced stacked blocks.
- **Content-preserving:** no scheme/villain/henchmen text or label change — only
  layout. Tokens stay `--la-color-*`; theme unchanged.

## Acceptance Criteria

- [ ] The expanded reveal renders the per-count blocks in **multiple columns** on
      a wide viewport (a responsive grid), not a single tall column.
- [ ] The **Schemes** line spans full width above the count grid; each count block
      shows its label + the approved config(s) with **Villains** / **Henchmen** on
      tight adjacent lines.
- [ ] On a narrow (mobile) viewport the grid collapses to one column with **no
      horizontal overflow**; the reveal stays keyboard-accessible (native
      `<details>` unchanged).
- [ ] The rendered **text** (schemes, `Villains:` / `Henchmen:` labels and values)
      is identical to WP-456; only layout/spacing changed. `buildGauntletDetails`
      and `gauntletDisplay.ts` are unmodified.
- [ ] No registry import / `fetch` added; `apps/legends-board` runtime deps stay
      `{ vue }`.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/legends-board test    # unchanged (data untouched)
pnpm --filter @legendary-arena/legends-board typecheck
pnpm --filter @legendary-arena/legends-board build
pnpm -r build
# Deployed/dev smoke (D-24026): open the gauntlet index, expand a mastermind's
# "Show details" — confirm the counts render in a compact multi-column grid (not a
# ~40-row single column), no excessive whitespace/scroll on desktop, and a single
# column with no horizontal scroll on a mobile-width viewport. Content matches WP-456.
```

## Vision Alignment

**Vision clauses:** §10 (Legends board presentation). No scoring/identity/RNG/
determinism/persistence surface. **Conflict assertion:** *No conflict* — a
layout-only restyle of an existing read-only reveal; renders/scores/persists
nothing new, preserves zero-API/`vue`-only. **NG check:** none — free,
account-less, no paid/cosmetic-monetization surface.

## Definition of Done

- [ ] All Acceptance Criteria pass; legends-board test/typecheck/build + `pnpm -r
      build` green.
- [ ] **D-24026 live-verify (operator-pending):** deployed legends reveal renders
      compact multi-column, no excessive scroll; mobile single-column no overflow.
- [ ] `docs/ai/STATUS.md` updated (compact reveal layout).
- [ ] `WORK_INDEX.md` row checked off; `ROADMAP-MINDMAP.md` `📝`→`✅` +
      `pnpm roadmap:counts:write` (`:check` 0); `EC_INDEX.md` EC-494 → Done.
- [ ] No files outside the list modified. (No D-entry — layout polish.)

---

## Gate Verdicts (drafting session)

Ran as a combined independent-subagent pass against the frozen WP-459/EC-494.

- **Pre-Flight (`01.4`): READY** — the WP-456 reveal exists exactly as described
  (`.gauntlet-details-body` flex column at `:511`, the count/config classes, the
  full-width Schemes line, native `<details>`, `--la-color-*` tokens, scoped
  styles in-file); genuinely single-file, presentation-only, `vue`-only/zero-API;
  hard-dep WP-456 ✅.
- **Copilot (`01.7`): PASS** — boundary (app-layer CSS, no engine/registry reach),
  scope (exact one-file allowlist), content-preserving invariant (rendered text
  unchanged — locked in 4 places), and the `// why:` requirement all hold; the
  determinism/persistence/mutation lenses are N/A (no logic, no data).
- **Lint (`00.3`): SATISFIED** — §5 matches the EC; §15.1 D-24026 a real deployed
  smoke; §17 present; §8 vue-only/zero-API. "No D-entry" is appropriate (UI polish
  locks no decision). Execution note folded into EC-494: apply `min-width: 0` /
  `overflow-wrap: anywhere` on grid items so a long adversary name can't reintroduce
  horizontal scroll.
