# WP-464 — Core Set Gauntlet-Coverage Matrix (Legends Board)

**User-Visible Surface:** `legends.legendary-arena.com` (the Legends Attract
Board gauntlet index). The **Core Set** group gains a collapsible **coverage
matrix** at the bottom of the group: which villain/henchman group each of the
set's (mastermind × scheme) gauntlet legs fights, with a player-count selector and
per-leg challenge links. **D-24026 live-verification applies** (operator-pending on
the Cloudflare Pages deploy).

## User-Visible Impact

A visitor expanding the Core Set matrix sees, at a glance, the full launch grid:
every mastermind × scheme fight as a row, every villain and henchman as a column,
and a ✓ in each cell the fight actually uses — each ✓ linking straight to that
leg's cards-builder challenge, ready to play. A count selector (default 2p) reveals
how the approved adversaries grow from 1 to 5 players.

## Goal

Add an operator-requested collapsible **gauntlet-coverage matrix** to the bottom of
the Core Set group on the legends gauntlet index. **Transposed** layout (per the
operator, to avoid horizontal scroll): **rows** = the set's masterminds × schemes
(Core: 4 × 8 = 32 rows, grouped by mastermind); **columns** = the set's villain and
henchman groups (Core: 7 villains + 4 henchmen = 11). A cell shows a **checkmark
hyperlink** to that scheme-leg's cards-builder challenge (approved loadout pinned)
**iff** the column's villain/henchman is in that mastermind's approved config at the
selected player count; otherwise the cell is empty. A **player-count selector**
defaults to **2 players**, switchable 1–5, and the ✓s update live. It is a
**client-only** `apps/legends-board` change — **zero-API**, rendering data already
in the published gauntlet index; **Core-only** for now, but the pure builder is
generic so extending to other sets is a template change.

## Assumes

- **On `origin/main` @ `fa3c0007`.** `apps/legends-board` builds/tests/typechecks
  green. **WP-461 ✅ + WP-462 ✅** landed: the gauntlet index publishes and the
  client mirrors the per-set `sets` roster (`SetDetails` — villains/henchmen with
  authoritative names); **WP-395 ✅** publishes each gauntlet's `approvedLoadouts`
  (villain/henchmen ids per player count) and `legs` (the set's schemes).
- **The client already holds every input** (verified in the deployed snapshot):
  each Core gauntlet entry carries `mastermindSlug`/`mastermindName`, `legs`
  (8 schemes), and `approvedLoadouts` (one config per count); the `sets` field
  carries Core's full villain/henchman roster with names. `buildChallengeUrl`
  (`gauntletDisplay.ts`) already builds the per-leg cards-builder URL with the
  approved loadout pinned. **No new fetch, no new snapshot field.**
- The approved villain/henchmen config is fixed per **mastermind × player count**,
  **not** per scheme (confirmed in the live data) — so within a mastermind's 8
  scheme-rows the ✓ pattern is identical; the *link* differs per scheme (each
  (scheme, mastermind) is a distinct leg). This is intended: the matrix is a
  per-leg launch grid.

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md §Layer Boundary` (legends board
is `vue`-only / zero-API, mirrors snapshot types, never imports the server),
`.claude/rules/code-style.md`, and the existing `gauntletDisplay.ts` helpers
(`buildChallengeUrl`, `selectApprovedLoadout`, `findSetDetails`,
`groupGauntletsBySet`) + `GauntletIndexPanel.vue` (the set-group render + the
existing per-count selector pattern `selectionFor`/`onPlayerCountChange`).

The operator asked (2026-07-30) for this matrix after the WP-462 per-set reveal, to
see the full (mastermind × scheme) × (villain/henchman) coverage as a launch grid.
The transpose (masterminds×schemes as rows, adversaries as columns) is the
operator's choice to keep 11 columns and avoid horizontal scroll.

## Scope (In)

- **`apps/legends-board/src/panels/gauntletDisplay.ts`** — a pure
  `buildCoverageMatrix(gauntlets, setDetails, playerCount)` returning the matrix:
  `columns` (villains then henchmen — `{ slug, name, kind }`) and `rows` (one per
  mastermind × leg, grouped mastermind-major then scheme, each with
  `mastermindName`, `schemeName`, and per-column `cells` — `{ covered,
  challengeUrl }`, `challengeUrl` set only when covered). Coverage: the column's
  set-qualified id `` `${setAbbr}/${slug}` `` is in the mastermind's approved config
  (`selectApprovedLoadout(entry, playerCount)`) villain (resp. henchman) ids. Pure,
  data-injected; reuses `buildChallengeUrl`.
- **`apps/legends-board/src/panels/gauntletDisplay.test.ts`** — tests for
  `buildCoverageMatrix` (columns order + kinds; a covered cell has a ✓ challenge
  URL, an uncovered cell has none; count sensitivity 1p vs 5p; a set with no
  `SetDetails`/`approvedLoadouts` yields an empty matrix, no throw).
- **`apps/legends-board/src/panels/GauntletIndexPanel.vue`** — render the matrix as
  a collapsible `<details>` at the **bottom of the Core Set group only** (guard on
  `setGroup.setAbbr === 'core'` + `setDetailsFor('core')` present), with a
  player-count `<select>` (default 2, options 1–5) driving the matrix; a `<table>`
  with a header row of adversary names (villains then henchmen, a visual divider
  between) and mastermind-grouped rows; covered cells render a `<a>`✓ to the
  challenge URL (`target="_blank" rel="noopener"`), empty cells a non-interactive
  placeholder with an accessible empty state. Scoped CSS with `overflow-x: auto`
  as a safety net.

## Out of Scope

- No server/publisher/snapshot change; no registry import; no new `fetch`.
- No change to the WP-462 per-set reveal, the per-mastermind WP-456 reveal, the
  count chips, challenge CTAs, download control, or kiosk cycling.
- Not generalized to other sets in this WP (Core-only pilot; the builder is generic
  so a later WP flips the render guard).
- No new competitive/scoring/PAR semantics — the ✓ is a read of already-published
  approved-loadout data.

## Files Expected to Change

- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified**
  (`buildCoverageMatrix` + types)
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** (tests)
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** (matrix +
  count selector + scoped CSS)

## Contract

> Full file contents (no diffs); ESM/Node v22+; human-style code per
> `00.6-code-style.md`; `vue`-only runtime / zero-API; no registry/server import;
> pure data-injected builder; reuses `buildChallengeUrl`/`selectApprovedLoadout`.

**Locked:**
- **Transposed axes:** rows = mastermind × scheme (mastermind-major, then scheme
  ASC as published in `legs`); columns = villains (roster order) then henchmen.
- **Cell rule:** ✓ + challenge link iff the column adversary's `` `${setAbbr}/${slug}` ``
  ∈ the mastermind's approved config at the selected count; else empty (no link).
- **Count selector:** default `2`, options `1..5`; the matrix reflects the selected
  count. Its own per-set state, not shared with the row download selectors.
- **Link:** `buildChallengeUrl(setAbbr, schemeSlug, mastermindSlug, playerCount,
  selectApprovedLoadout(entry, playerCount))` — the existing per-leg URL.
- **Core-only render guard** (`setGroup.setAbbr === 'core'`); absent `SetDetails`
  or `approvedLoadouts` → the matrix does not render (no throw).
- **Coverage source:** the cell's covered flag derives from
  `selectApprovedLoadout(entry, count)` (the per-mastermind × count config),
  **never** `SetAdversaryGroup.usedByGauntlets` (which is per-*set* — "any of this
  set's gauntlets" — and would over-mark cells). A count whose
  `selectApprovedLoadout` is `undefined` (missing/empty count key) → every cell in
  that mastermind's rows uncovered, no throw.
- **Accessibility:** the count `<select>` carries an `aria-label` (e.g. "Coverage
  matrix player count"); each ✓ link carries an accessible name describing its
  destination (e.g. "Play {scheme} vs {adversary} at {n}-player") with the ✓ glyph
  `aria-hidden`, mirroring the component's existing `coverageLabel` / `aria-label`
  conventions.

## Acceptance Criteria

- [ ] The Core Set group shows a collapsible matrix at its bottom; no other set
      does.
- [ ] Rows = 4 masterminds × 8 schemes (32), grouped by mastermind; columns = 7
      villains + 4 henchmen (11).
- [ ] A cell where the adversary is approved for that mastermind at the selected
      count shows a ✓ linking to that leg's `cards.legendary-arena.com` challenge
      (with `schemeId`, `mastermindId`, `playerCount`, and the pinned groups);
      other cells are empty.
- [ ] The count selector defaults to 2 and, when changed 1–5, updates the ✓s (e.g.
      Dr. Doom at 1p shows only Masters of Evil; at 5p shows Brotherhood + Enemies
      of Asgard + HYDRA + Masters of Evil).
- [ ] Runtime deps stay `{ vue }`; no registry import; no new `fetch`; no publisher/
      snapshot change.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/legends-board test
pnpm --filter @legendary-arena/legends-board typecheck
pnpm --filter @legendary-arena/legends-board build
pnpm -r build
# Live smoke (D-24026): expand the Core Set matrix; at 2p, Magneto's rows check
# Brotherhood + Enemies of Asgard (villains) + Doombot Legion (henchman); a ✓
# links to a cards.legendary-arena.com challenge carrying playerCount=2. Switch
# the selector to 5p and confirm the ✓s widen.
```

## Vision Alignment

**Clauses:** §10 (Legends board presentation). No scoring / identity / RNG /
determinism / persistence surface. **Conflict:** *No conflict* — a read-only render
of already-published approved-loadout data. **NG:** none.

## Definition of Done

- [ ] All Acceptance Criteria pass; legends-board test/typecheck/build + `pnpm -r
      build` green.
- [ ] **D-24026 live-verify (operator-pending):** deployed board shows the Core
      matrix with correct ✓s + working challenge links.
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` row checked off;
      `ROADMAP-MINDMAP.md` `📝`→`✅` + `pnpm roadmap:counts:write` (`:check` 0);
      `EC_INDEX.md` EC-499 → Done.
- [ ] No files outside the allowlist (+ governance) modified. (No D-entry —
      presentation-only, reads published data.)

## Lint Gate Self-Review

- **§1/§15:** `**User-Visible Surface:**` header + `## User-Visible Impact` present;
  surface = `legends.legendary-arena.com`; D-24026 live-verify in DoD. PASS.
- **§2 (Contract):** full-file / no-diffs / ESM-Node v22+ / `00.6` cited. PASS.
- **§4 (Context Read First):** doc read-list present. PASS.
- **§5 (allowlist):** 3 client files, single layer/app. PASS.
- **§8 (layer boundary):** `vue`-only/zero-API, no server/registry import, reads
  published data. PASS.
- **§17 (Vision):** §10, No conflict. PASS.
- **§20 (Funding Surface Gate):** N/A — no funding/donation surface or copy.
- **§21:** N/A (no `apps/server` endpoint). No new contract file; no D-entry
  (presentation-only, like WP-459).

## Gate Verdicts (drafting session)

Run as independent subagents against this WP + EC-499:

- **Pre-flight — READY TO EXECUTE.** Every cited helper/signature/data field
  verified against the repo (`buildChallengeUrl` / `selectApprovedLoadout` /
  `findSetDetails` / `groupGauntletsBySet`; `approvedLoadouts` + `legs` + `sets`
  present on the client mirror); the `${setAbbr}/${slug}` cell rule matches the
  server's own WP-462 coverage construction.
- **Lint (00.3) — SATISFIED** (both files; structure tracks WP-462 one-for-one).
- **Copilot (01.7) — RISK → resolved in-place.** Core design sound (coverage
  logic, count-state separation, Core-only guard, no-D-entry all confirmed
  correct). Three scope-neutral concerns, all now **locked** in `§Contract` + EC-499
  (no scope/allowlist change, so no pre-flight re-run): **(1)** `selectApprovedLoadout`
  can return `undefined` for a missing/empty count key — locked "that mastermind's
  rows all-uncovered, no throw" + a test; **(2)** accessibility — the count `<select>`
  must carry an `aria-label` and each ✓ link an accessible destination name with the
  glyph `aria-hidden` (mirroring the component's `coverageLabel` pattern); **(3)**
  coverage must derive from `selectApprovedLoadout`, never the per-*set*
  `SetAdversaryGroup.usedByGauntlets` (which would over-mark).
