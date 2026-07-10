# WP-345 — Player-Count Gauntlet Boards + Challenge Links (Legends-Board Client)

**Status:** Drafted 2026-07-09; **execution-ready 2026-07-10** (EC-379 drafted at execution-prep; the WP-344 hard dep executed 2026-07-09 via PR #643)
**Primary Layer:** Client (`apps/legends-board/**` only)
**Dependencies:** WP-344 ✅ (per-count snapshots + `entryCounts` + `legs` on the index — executed 2026-07-09), WP-343 ✅ (gauntlet index/panel + hash routing), WP-342 ✅, D-24134 (design lock), D-24135 (routing + display-format locks), WP-114 ✅ (the registry-viewer URL-parameterized preview the challenge links target)
**EC:** [EC-379](../execution-checklists/EC-379-player-count-gauntlet-client.checklist.md) (drafted 2026-07-10; locks §Files item 8 to `gauntletDisplay.ts` + its test — 7-file set)
**Baseline:** `origin/main` at `321e4f05` (2026-07-09)
**User-Visible Surface:** legends.legendary-arena.com (per-count boards, team rosters, challenge links; the links land on cards.legendary-arena.com)

---

## Goal

Make the D-24134 player-count dimension visible on the public Hall of
Legends: the gauntlet board view gains a **player-count selector** (1–5;
counts with entries link to their board, empty counts render the unclaimed
state), multiplayer entries display the **full team roster** ("Alice +
Bob"), the index shows per-count claim state, and every leg (and every
unclaimed gauntlet) gains a **"Challenge this leg" link** that lands on the
Registry Viewer's existing URL-parameterized loadout preview with the leg's
scheme + mastermind pinned — the player adds heroes there. Zero-API posture
is unchanged; the challenge link is a plain `<a href>`, not a fetch.

---

## Assumes

- **WP-344 is executed**; gauntlet snapshots carry
  `players: readonly string[]` per entry; the index entries carry
  `entryCounts` (per-count complete-entry counts) and
  `legs: readonly { schemeSlug, schemeName }[]`; multiplayer boards are
  named `gauntlet-<setAbbr>-<mastermindSlug>-p<N>.json` and exist only
  when ≥1 complete entry. Until real multiplayer wins accumulate, every
  count but (possibly) solo reports zero — the selector MUST look good in
  exactly that state (it is the launch state).
- The WP-343 hash route grammar `^gauntlet-[a-z0-9-]+$` already admits
  `-p<N>` board names; `parseHashRoute` needs no change.
- The Registry Viewer preview (WP-114) accepts
  `?schemeId=<setAbbr>/<slug>&mastermindId=<setAbbr>/<slug>` (canonical
  9-field names, set-qualified ids, URL-encoded) at
  `https://cards.legendary-arena.com/` and its "Edit this loadout" button
  promotes the preview into the full builder with hero/villain pickers.
- The SPA is Vue 3 + Vite, sole runtime dependency `vue`; tests
  `node --import tsx --test src/**/*.test.ts`; `vue-tsc --noEmit`
  typecheck; the WP-343 test posture (pure helpers unit-tested; component
  rendering via vue-tsc + dev smoke + D-24026 live-verify).
- `pnpm --filter @legendary-arena/legends-board build` exits 0 on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24134** (§2 board identity, §4 entry shape,
  §5 index shape, §6 challenge links; read in full), D-24135 (routing +
  display locks this packet must not break), D-24131.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) — the board is
  a UI app; no engine / registry / server imports; zero server API calls.
- `apps/legends-board/src/panels/GauntletIndexPanel.vue`,
  `GauntletBoardPanel.vue`, `gauntletDisplay.ts`, `router/hashRoute.ts`,
  `snapshots/snapshotClient.ts`, `App.vue` — the WP-343 surfaces this
  packet extends.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 — the canonical
  `schemeId` / `mastermindId` field names the challenge URL's query keys
  reuse verbatim.
- `apps/registry-viewer/src/lib/setupUrlParams.ts` — the URL grammar the
  challenge links must emit (read for the exact key names and the
  set-qualified id format; no import — the link is a string).
- `wiki/leaderboard.md` §Gauntlets — the descriptive companion.

---

## Scope (In)

- `snapshotClient.ts`: mirror the additive WP-344 fields (`players` on
  entries; `entryCounts` + `legs` on index entries) per the existing
  hand-mirroring discipline.
- `gauntletDisplay.ts`: pure helpers — `buildPlayerCountTabs(indexEntry)`
  (which counts have entries; board name per count, `-p<N>` derivation),
  `formatRoster(players)` (joined display, solo unchanged), and
  `buildChallengeUrl(setAbbr, schemeSlug, mastermindSlug)` (the WP-114
  query string, URL-encoded set-qualified ids).
- `GauntletBoardPanel.vue`: the player-count selector (solo default;
  counts with `entryCounts > 0` link to `#/gauntlet/<board>-p<N>`; empty
  counts render an inline unclaimed state, not a link); a roster column
  rendering `players` (falls back to `handle` when `players` is absent —
  old snapshots); a legs list with per-leg challenge links.
- `GauntletIndexPanel.vue`: per-count claim chips from `entryCounts`
  (e.g., "1p ✓ · 2p unclaimed"); the unclaimed CTA gains the challenge
  link for the gauntlet's first leg (the "be the first" path now lands on
  a pinned loadout).
- `App.vue`: resolve the index entry for `-p<N>` board routes (strip the
  suffix to find the parent gauntlet's index entry so the panel gets its
  `entryCounts` + `legs`).
- Tests for the new pure helpers and the mirrored types.

## Out of Scope

- **Any server / publisher change** — WP-344 ships the data side.
- **Any arena-client or registry-viewer change** — the challenge link
  targets an existing surface as-is; a direct-into-lobby prefill is a
  named future WP (D-24134 §6), not this one.
- **vue-router or any new dependency** — the WP-343 hand-rolled router
  stands; `parseHashRoute` is not modified.
- **Kiosk/attract changes** — the cycle keeps exactly ONE gauntlet-index
  slide (D-24135); per-count boards never cycle.
- **Personal progress surfaces** — the D-24131 §8b profile follow-up.
- **Windowed boards, streaks, levels** — separate proposals, not decided.

---

## Files Expected to Change

> 8 files — at the 00.3 §5 soft cap; 3 are test files.

1. `apps/legends-board/src/snapshots/snapshotClient.ts` — **modified** —
   additive mirrored fields (`players`, `entryCounts`, `legs`).
2. `apps/legends-board/src/snapshots/snapshotClient.test.ts` — **modified**
   — fixture coverage for the additive fields (absent fields tolerated).
3. `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** —
   `buildPlayerCountTabs`, `formatRoster`, `buildChallengeUrl`.
4. `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified**
   — unit tables for all three helpers (exact expected strings pinned,
   including URL encoding of the `/` in set-qualified ids).
5. `apps/legends-board/src/panels/GauntletBoardPanel.vue` — **modified** —
   count selector + roster column + legs list with challenge links.
6. `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** —
   per-count claim chips + challenge link on the unclaimed CTA.
7. `apps/legends-board/src/App.vue` — **modified** — `-p<N>` board-name →
   parent index entry resolution passed into the board panel.
8. `apps/legends-board/src/App.test.ts` **or** the suffix-resolution
   helper's home in `gauntletDisplay.ts` + its test — **modified** — the
   parent-gauntlet resolution is implemented as a pure helper
   (`resolveBoardIndexEntry(boardName, gauntlets)`) so it is unit-testable
   (the WP-343 pure-surface posture); file placement locked at EC time.

Governance files (`DECISIONS.md` note, `WORK_INDEX.md`, `STATUS.md`) are
updated at close per the Definition of Done.

---

## Contract

- **Route grammar unchanged (D-24135):** `-p<N>` board names ride the
  existing `^gauntlet-[a-z0-9-]+$` rule; `#/gauntlet/gauntlet-core-
  dr-doom-p2` is a valid route today and simply fetches that board file.
  `parseHashRoute` is byte-identical after this packet.
- **Count-tab derivation (locked):** tabs render counts 1..5 in order;
  the solo tab's board name is the bare gauntlet board; count N's is
  `<board>-p<N>`; a count links only when `entryCounts` reports ≥1 entry
  for it; otherwise it renders inline unclaimed state (never a link to an
  absent file — the WP-343 index rule, applied per count).
- **Suffix resolution (locked):** `resolveBoardIndexEntry` strips a
  trailing `-p[2-5]` (exactly one, end-anchored) to find the parent
  gauntlet's index entry; a bare board name resolves directly. A
  mastermind slug can never collide with the suffix because resolution
  only fires when the bare lookup misses.
- **Roster display (locked):** `formatRoster(players)` joins handles with
  `" + "` in the order published (handle ASC per D-24134 §4); a missing
  `players` field falls back to the entry's `handle` — old snapshots keep
  rendering.
- **Challenge URL (locked):** `https://cards.legendary-arena.com/?schemeId=
  <encoded setAbbr/schemeSlug>&mastermindId=<encoded setAbbr/mastermindSlug>`
  built with `URLSearchParams` (the WP-114 parser's own round-trip
  discipline); exactly these two keys — villain groups, henchmen, heroes,
  counts, and player count are deliberately NOT in the URL (D-24134 §6:
  hero/villain choice is the player's; counts and envelope are the
  builder's defaults). Links open in a new tab (`target="_blank"
  rel="noopener"`).
- **Display format:** the D-24135 signed one-decimal average format and
  gold-under-PAR styling apply unchanged on every count's board.
- **Zero-API invariant:** the deployed bundle contains no reference to
  `api.legendary-arena.com` or `*.onrender.com`; all fetches remain
  `images.legendary-arena.com/legends/v1/*`; `cards.legendary-arena.com`
  appears only inside `<a href>` values, never a fetch target.
- **Type mirroring:** additive fields hand-mirrored from
  `apps/server/src/legends/legends.types.ts` with a source comment; no
  cross-package import.

---

## Non-Negotiable Constraints

**Engine-wide:** ESM only, Node v22+. Human-style code — see
`docs/ai/REFERENCE/00.6-code-style.md` (full English names, `is/has/can`
booleans, JSDoc on every function, ≤30-line functions, `// why:` on
non-obvious decisions, full-sentence error messages). Full file contents
for every new or modified file — no diffs, no snippets. Tests `.test.ts`
with `node:test` + `node:assert`; no network or DB access in tests.

**Packet-specific:**
- **No new npm dependency**; any `package.json` change is a FAIL.
- No engine / registry / preplan / server import; no `pg`; no server API
  call; no cookies/localStorage (WP-143 posture).
- No `Math.random()` and no wall-clock reads outside the existing
  freshness-badge path.
- `parseHashRoute` and the kiosk/attract cycle are byte-identical.
- Existing populated-state rendering for solo boards with old-shape
  entries (no `players`) is preserved — additive degradation, never a
  crash or blank cell.
- All copy stays plain competitive call-to-action; the challenge link's
  visible text names the leg ("Challenge: <schemeName>"), no pricing, no
  account-benefit claims.

**Session protocol:** stop and ask on any unclear item; if the live
`gauntlet-index.json` lacks `entryCounts`/`legs` (WP-344 not yet deployed),
develop against fixtures and note the dependency in the close — the panel
must degrade to WP-343 behavior on old snapshots.

**Locked contract values:** the Contract section above; the `" + "` roster
join; the two-key challenge URL; the `-p[2-5]` end-anchored suffix rule.

---

## Acceptance Criteria

1. `buildPlayerCountTabs` unit table: an index entry with
   `entryCounts = {1: 3, 2: 1, 3: 0, 4: 0, 5: 0}` yields a linked solo
   tab (bare board name), a linked p2 tab (`<board>-p2`), and unclaimed
   p3–p5; an entry with no `entryCounts` field yields solo-linked-only
   (old-snapshot degradation).
2. `formatRoster(['alice','bob'])` → `'alice + bob'`;
   `formatRoster(['solo'])` → `'solo'`; a missing `players` falls back to
   `handle` (pinned in the panel's data-shaping helper test).
3. `buildChallengeUrl('core','midtown-bank-robbery','dr-doom')` produces
   exactly
   `https://cards.legendary-arena.com/?schemeId=core%2Fmidtown-bank-robbery&mastermindId=core%2Fdr-doom`
   (pinned string, encoding asserted).
4. `resolveBoardIndexEntry('gauntlet-core-dr-doom-p2', gauntlets)` returns
   the `gauntlet-core-dr-doom` entry; the bare name resolves directly; an
   unknown name returns null (panel renders the WP-343 missing-board
   state).
5. The board panel renders the count selector, roster column, and a legs
   list where each leg carries a challenge link built from the index
   entry's `legs`; fixture-driven vue-tsc + dev-smoke verification per the
   WP-343 test-posture split.
6. The index panel renders per-count claim chips and the unclaimed CTA
   carries the first leg's challenge link.
7. When the index entry lacks `legs` (old snapshot), no challenge links
   render and nothing crashes.
8. `pnpm --filter @legendary-arena/legends-board build`, `typecheck`, and
   `test` all exit 0 / green.
9. The built bundle contains no server-API hostname (zero-API grep against
   `dist/`, the EC-164 precedent); `cards.legendary-arena.com` appears
   only in anchor hrefs.
10. `git diff --name-only` shows only the listed files (plus governance
    per DoD).

---

## Verification Steps

```bash
# 1. Build, typecheck, test (expect all exit 0)
pnpm --filter @legendary-arena/legends-board build
pnpm --filter @legendary-arena/legends-board typecheck
pnpm --filter @legendary-arena/legends-board test

# 2. Zero-API bundle check (expect: no matches)
#    PowerShell: Select-String -Path apps/legends-board/dist/assets/*.js -Pattern "onrender|api\.legendary-arena"

# 3. Scope check (expect: exactly the listed files + governance)
git diff --name-only

# 4. Local visual pass (vite dev):
pnpm --filter @legendary-arena/legends-board dev
#    - a populated board shows the count selector with solo active
#    - '#/gauntlet/<board>-p2' renders (unclaimed state if no entries)
#    - a leg row's "Challenge" link opens the cards.legendary-arena.com
#      preview with scheme + mastermind pinned (manual click-through)
```

---

## Vision Alignment

**Vision clauses touched:** §20–26 (leaderboard presentation of PAR-based
scores); §3, §11 (published handles); NG-1 proximity.

**Conflict assertion:** No conflict: this WP preserves all touched
clauses. It renders already-published, replay-verified standings (§24)
without recomputing anything; rosters display only handles the WP-344
publisher already vetted for link/public visibility (§3/§11); the
per-count segmentation it surfaces is the §22-honest presentation.

**Non-Goal proximity check:** none of NG-1..7 are crossed — read-only
recognition plus a play-path link; no paid or persuasive surface.

**Determinism preservation:** deterministic and replay-faithful (§22) by
construction — display-only; no engine, RNG, scoring, or replay change.

## Funding Surface Gate

N/A — public scoreboard UI whose only calls-to-action are play-path links
(challenge links to the loadout builder); no funding affordances, no
donate/support copy, no payment channels (§20.1 trigger surfaces absent).

## API Catalog (§21)

N/A — client-only; no HTTP endpoint added, modified, removed, or
re-statused, and no `apps/server/src/**` library surface touched.

---

## User-Visible Impact

legends.legendary-arena.com gains per-player-count gauntlet boards with
full team rosters ("alice + bob" on the 2-player core Dr. Doom board) and
one-click challenge links that land on a loadout preview with the leg's
scheme and mastermind already pinned — the "just add heroes" path.
Launch-state honesty: multiplayer counts start unclaimed everywhere; the
selector is designed to read as open championships, not a failure state.

---

## Definition of Done

- [ ] All Acceptance Criteria pass (1–10 above).
- [ ] **Live-on-surface verification (D-24026):** on the deployed
      legends.legendary-arena.com, a board shows the count selector, a
      `-p<N>` deep link renders, and a challenge link click lands on the
      cards.legendary-arena.com preview with the leg's scheme +
      mastermind pinned — observed and recorded, not inferred from green
      tests.
- [ ] `docs/ai/DECISIONS.md` — D-24134 annotated with the execution date
      and any execution-discovered addenda.
- [ ] `docs/ai/STATUS.md` updated with the user-visible change.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — this packet checked off.
- [ ] No files outside `## Files Expected to Change` (plus governance)
      were modified.
