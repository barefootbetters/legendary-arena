# WP-385 — Fixed-Hero-Pool Gauntlet Division: Division Toggle + Hero-Pool Display (Legends-Board Client)

**Status:** Drafted 2026-07-16; **execution-ready + executing 2026-07-16** (EC-414 drafted at execution-prep; the WP-384 hard dep executed the same day via PR #784)
**Primary Layer:** Client (`apps/legends-board/**` only)
**Dependencies:** WP-384 ✅ (the D-24187 server half — executed 2026-07-16, PR #784), WP-345 ✅ (player-count selector + roster display + challenge links), WP-343 ✅ (gauntlet index/panel + hash routing), D-24187 (design lock), D-24134 / D-24131 (parent designs), D-24135 (routing + display-format locks)
**EC:** [EC-414](../execution-checklists/EC-414-fixed-hero-pool-gauntlet-client.checklist.md) (drafted 2026-07-16 at execution-prep)
**Baseline:** `origin/main` at `a3a43666` (2026-07-16, execution; drafted @ `9340236b`)
**User-Visible Surface:** legends.legendary-arena.com (the fixed-hero-pool championship division beside each open gauntlet board; hero-pool display on fixed entries)

> **Execution addendum (2026-07-16, EC-414 draft).** Five reconciliations
> against the shipped WP-345 code, locked at EC time:
> (1) **7-file set** — the §Files item-8 fork resolves to the pure helpers
> living in `gauntletDisplay.ts` + its test (no `App.test.ts`), the EC-379
> precedent.
> (2) **The division is the route, not component state** — the active
> division derives from the routed board name via a pure
> `isFixedBoardName`; hash routing already carries all navigation state.
> (3) **The client mirrors `heroPool` as an OPTIONAL field on the single
> `GauntletSnapshotEntry` type** (the server's distinct
> `GauntletFixedSnapshotEntry` collapses into the optional field —
> additive, old snapshots degrade).
> (4) **Index fixed chips render CLAIMED counts only** (noise control on
> the 105-row index; the unclaimed fixed state lives on the board panel's
> toggle) — entries without `fixedEntryCounts` render exactly the WP-345
> chips.
> (5) **The WP-345 unclaimed-count guard extends to fixed boards** via a
> pure `findRoutedCountTab` (open then fixed tab sets), so an unclaimed
> `-fixed[-p<N>]` deep link renders the open-championship state, never a
> 404 fetch — satisfying AC-6 with the tab-link contract intact.

---

## Goal

Make the D-24187 fixed-hero-pool division visible on the public Hall of
Legends: the gauntlet board view gains a **division toggle** (Open |
Fixed-Pool; open remains the default and the acquisition surface), fixed
boards render each entry's **hero pool** (the team the championship was
earned with), the index shows fixed-division claim state from
`fixedEntryCounts`, and the championship framing attaches to the fixed
division ("you've cleared every leg — now clear them with one team" is the
feeder copy on the open board). Zero-API posture is unchanged; a fixed
board is just another snapshot file the SPA fetches by name.

---

## Assumes

- **WP-384 is executed**; the publisher emits
  `gauntlet-<setAbbr>-<mastermindSlug>-fixed.json` and
  `…-fixed-p<N>.json` (lazily, ≥1 complete entry), fixed-board entries
  carry `heroPool: readonly string[]`, and index entries carry
  `fixedEntryCounts`. Until real fixed-pool clears accumulate, every
  fixed board is unclaimed — the toggle MUST look good in exactly that
  state (it is the launch state).
- The WP-343 hash route grammar `^gauntlet-[a-z0-9-]+$` already admits
  `-fixed` and `-fixed-p<N>` board names; `parseHashRoute` needs no
  change.
- WP-345's `resolveBoardIndexEntry` strips a trailing `-p[2-5]` to find
  the parent gauntlet's index entry; this packet extends the resolution
  to also strip a trailing `-fixed` (after the count suffix), so
  `gauntlet-core-dr-doom-fixed-p2` resolves to the
  `gauntlet-core-dr-doom` entry.
- The SPA is Vue 3 + Vite, sole runtime dependency `vue`; tests
  `node --import tsx --test src/**/*.test.ts`; `vue-tsc --noEmit`
  typecheck; the WP-343/WP-345 test posture (pure helpers unit-tested;
  component rendering via vue-tsc + dev smoke + D-24026 live-verify).
- `pnpm --filter @legendary-arena/legends-board build` exits 0 on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24187** (§3 division identity, §4 pool
  rule, §6 entry/index shape, §7 presentation; read in full), D-24134
  (player-count selector + roster semantics this packet composes with),
  D-24135 (routing + display locks this packet must not break), D-24131.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) — the board is
  a UI app; no engine / registry / server imports; zero server API calls.
- `apps/legends-board/src/panels/GauntletIndexPanel.vue`,
  `GauntletBoardPanel.vue`, `gauntletDisplay.ts`, `router/hashRoute.ts`,
  `snapshots/snapshotClient.ts`, `App.vue` — the WP-343/WP-345 surfaces
  this packet extends.
- `wiki/leaderboard.md` §Hero requirements — the descriptive companion
  (ratified by D-24187).

---

## Scope (In)

- `snapshotClient.ts`: mirror the additive WP-384 fields (`heroPool` on
  entries; `fixedEntryCounts` on index entries) per the existing
  hand-mirroring discipline (optional fields; old snapshots degrade).
- `gauntletDisplay.ts`: pure helpers — `buildDivisionTabs(indexEntry,
  playerCount)` (open + fixed tab per count; fixed links only when
  `fixedEntryCounts` reports ≥1 entry, else inline unclaimed state),
  `formatHeroPool(heroPool)` (display join of the pool's hero names/ids),
  and the `resolveBoardIndexEntry` extension (strip `-p[2-5]`, then
  `-fixed`, end-anchored, in that order).
- `GauntletBoardPanel.vue`: the division toggle (Open default;
  Fixed-Pool tab per D-24187 §7 championship framing); on fixed boards a
  hero-pool row/column rendering `heroPool`; the feeder copy on open
  boards ("clear them with one team") linking to the fixed tab.
- `GauntletIndexPanel.vue`: fixed-division claim chips from
  `fixedEntryCounts` beside the WP-345 per-count chips.
- `App.vue`: pass the resolved parent index entry into the board panel
  for `-fixed` / `-fixed-p<N>` routes (via the extended resolution
  helper).
- Tests for the new/extended pure helpers and the mirrored types.

## Out of Scope

- **Any server / publisher change** — WP-384 ships the data side.
- **Any arena-client or registry-viewer change** — challenge links are
  the WP-345 surface, unchanged.
- **vue-router or any new dependency** — the hand-rolled router stands;
  `parseHashRoute` is not modified.
- **Kiosk/attract changes** — the cycle keeps exactly ONE gauntlet-index
  slide (D-24135); fixed boards never cycle.
- **Open-division rendering changes** — the WP-343/WP-345 open board
  rendering is byte-compatible; this packet only adds beside it.
- **Personal progress surfaces** — the D-24131 §8b profile follow-up.

---

## Files Expected to Change

> 8 files — at the 00.3 §5 soft cap; 3 are test files.

1. `apps/legends-board/src/snapshots/snapshotClient.ts` — **modified** —
   additive mirrored fields (`heroPool`, `fixedEntryCounts`), optional.
2. `apps/legends-board/src/snapshots/snapshotClient.test.ts` — **modified**
   — fixture coverage for the additive fields (absent fields tolerated).
3. `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** —
   `buildDivisionTabs`, `formatHeroPool`, the `resolveBoardIndexEntry`
   suffix-order extension.
4. `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified**
   — unit tables for the helpers (exact expected strings pinned,
   including the strip order `-p[2-5]` then `-fixed`).
5. `apps/legends-board/src/panels/GauntletBoardPanel.vue` — **modified** —
   division toggle + hero-pool display + feeder copy.
6. `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** —
   fixed-division claim chips.
7. `apps/legends-board/src/App.vue` — **modified** — `-fixed` board-name →
   parent index entry resolution passed into the board panel.
8. `apps/legends-board/src/App.test.ts` **or** the resolution helper's
   test home in `gauntletDisplay.test.ts` — **modified** — resolution
   covered as a pure helper (the WP-343 pure-surface posture); file
   placement locked at EC time.

Governance files (`DECISIONS.md` note, `WORK_INDEX.md`, `STATUS.md`) are
updated at close per the Definition of Done.

---

## Contract

- **Route grammar unchanged (D-24135):** `-fixed` / `-fixed-p<N>` board
  names ride the existing `^gauntlet-[a-z0-9-]+$` rule;
  `parseHashRoute` is byte-identical after this packet.
- **Board-name derivation (locked, D-24187 §3):** the fixed solo board is
  `<board>-fixed`; fixed count N is `<board>-fixed-p<N>` — `-fixed`
  precedes `-p<N>`.
- **Suffix resolution (locked):** `resolveBoardIndexEntry` strips a
  trailing `-p[2-5]` (exactly one, end-anchored) and then a trailing
  `-fixed` (exactly one, end-anchored), in that order; a bare name
  resolves directly; resolution only fires when the bare lookup misses
  (the WP-345 collision rule, unchanged).
- **Division tabs (locked):** Open is the default tab (the acquisition
  surface); the Fixed-Pool tab links only when `fixedEntryCounts`
  reports ≥1 entry for the active player count, else it renders an
  inline unclaimed state (never a link to an absent file — the WP-343
  index rule). Championship framing attaches to the fixed division; the
  open board carries the feeder copy.
- **Hero-pool display (locked):** fixed entries render `heroPool` in
  published order (sorted ASC, set-qualified ids); the display helper may
  shorten `setAbbr/slug` to a readable hero name form, but the underlying
  ids are never re-slugified or reordered. A missing `heroPool` (old
  snapshot) renders nothing and never crashes.
- **Degradation:** an index entry without `fixedEntryCounts` (pre-WP-384
  snapshot) renders exactly the WP-345 behavior — no fixed tab, no fixed
  chips, no crash.
- **Terminology:** UI copy says "hero pool" / "fixed pool" for the hero
  constraint; "roster"/team-of-players language stays reserved for the
  D-24134 account dimension.
- **Display format:** the D-24135 signed one-decimal average format and
  gold-under-PAR styling apply unchanged on fixed boards.
- **Zero-API invariant:** the deployed bundle contains no reference to
  `api.legendary-arena.com` or `*.onrender.com`; all fetches remain
  `images.legendary-arena.com/legends/v1/*`.
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
- Existing open-division rendering (populated and empty states, WP-343 +
  WP-345 behavior) is preserved — additive degradation, never a crash or
  blank cell.
- All copy stays plain competitive call-to-action; §23(b) terminology
  discipline holds (hero-vs-villain framing only).

**Session protocol:** stop and ask on any unclear item; if the live
`gauntlet-index.json` lacks `fixedEntryCounts` (WP-384 not yet deployed),
develop against fixtures and note the dependency in the close — the panel
must degrade to WP-345 behavior on old snapshots.

**Locked contract values:** the Contract section above; the strip order
`-p[2-5]` then `-fixed`; Open as the default tab; the unclaimed-fixed
inline state.

---

## Acceptance Criteria

1. `buildDivisionTabs` unit table: an index entry with
   `fixedEntryCounts = {1: 1, 2: 0, ...}` yields a linked fixed tab at
   count 1 (`<board>-fixed`) and an unclaimed fixed state at count 2; an
   entry with no `fixedEntryCounts` yields no fixed tab (old-snapshot
   degradation).
2. `resolveBoardIndexEntry('gauntlet-core-dr-doom-fixed-p2', gauntlets)`
   returns the `gauntlet-core-dr-doom` entry;
   `…-fixed` (solo) resolves the same; the bare name resolves directly;
   an unknown name returns null; the WP-345 `-p<N>`-only cases pass
   unmodified.
3. `formatHeroPool` renders a pinned display string for a sample pool and
   returns an empty result (never throws) for a missing/empty pool.
4. The board panel renders the division toggle with Open active by
   default, a hero-pool display on fixed entries, and the feeder copy on
   the open board; fixture-driven vue-tsc + dev-smoke verification per
   the WP-343 test-posture split.
5. The index panel renders fixed claim chips beside the WP-345 count
   chips; entries without `fixedEntryCounts` render exactly the WP-345
   chips.
6. A `-fixed` deep link to an unclaimed board renders the unclaimed
   championship state, not an error (the WP-345 empty-count posture).
7. `pnpm --filter @legendary-arena/legends-board build`, `typecheck`, and
   `test` all exit 0 / green.
8. The built bundle contains no server-API hostname (zero-API grep
   against `dist/`, the EC-164 precedent).
9. `git diff --name-only` shows only the listed files (plus governance
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
#    - a gauntlet board shows the division toggle with Open active
#    - the Fixed-Pool tab renders the unclaimed championship state when
#      no fixed entries exist (the launch state)
#    - '#/gauntlet/<board>-fixed' deep link renders
#    - a fixture-populated fixed board shows the hero pool per entry
```

---

## Vision Alignment

**Vision clauses touched:** §20–26 (leaderboard presentation of PAR-based
scores); §3, §11 (published handles); NG-1 proximity.

**Conflict assertion:** No conflict: this WP preserves all touched
clauses. It renders already-published, replay-verified standings (§24)
without recomputing anything; the hero pool it displays is derived by the
WP-384 publisher from verified replays; handles and rosters follow the
WP-344/WP-345 visibility rules unchanged (§3/§11).

**Non-Goal proximity check:** none of NG-1..7 are crossed — read-only
recognition; the championship framing is presentation, not a paid or
persuasive surface.

**Determinism preservation:** deterministic and replay-faithful (§22) by
construction — display-only; no engine, RNG, scoring, or replay change.

## Funding Surface Gate

N/A — public scoreboard UI whose only calls-to-action are play-path
navigation (division tabs, feeder copy); no funding affordances, no
donate/support copy, no payment channels (§20.1 trigger surfaces absent).

## API Catalog (§21)

N/A — client-only; no HTTP endpoint added, modified, removed, or
re-statused, and no `apps/server/src/**` library surface touched.

---

## User-Visible Impact

legends.legendary-arena.com gains the fixed-hero-pool championship: each
gauntlet board offers an Open | Fixed-Pool division toggle, fixed entries
display the hero pool that earned them, and the open board invites the
feeder path ("you've cleared every leg — now clear them with one team").
Launch-state honesty: every fixed board starts unclaimed; the toggle is
designed to read as an open championship, not a failure state.

---

## Definition of Done

- [ ] All Acceptance Criteria pass (1–9 above).
- [ ] **Live-on-surface verification (D-24026):** on the deployed
      legends.legendary-arena.com, a gauntlet board shows the division
      toggle, a `-fixed` deep link renders the unclaimed championship
      state (or a populated fixed board if data exists) — observed and
      recorded, not inferred from green tests.
- [ ] `docs/ai/DECISIONS.md` — D-24187 annotated with the execution date
      and any execution-discovered addenda.
- [ ] `docs/ai/STATUS.md` updated with the user-visible change.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — this packet checked off.
- [ ] No files outside `## Files Expected to Change` (plus governance)
      were modified.
