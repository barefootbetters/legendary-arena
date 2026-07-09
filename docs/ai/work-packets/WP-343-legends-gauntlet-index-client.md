# WP-343 — Legends-Board Gauntlet Index + Board Panel (Client)

**Status:** Drafted 2026-07-09 (design per D-24131 §8a; EC pending — execution-prep is the next step)
**Primary Layer:** Client (`apps/legends-board/**` only)
**Dependencies:** WP-342 ✅ (gauntlet snapshots + `gauntlet-index.json` + additive manifest fields, live once migration 026 is PROD-applied), WP-143/EC-164 ✅ (the board SPA + zero-API posture), D-24131 (design lock)
**EC:** pending (drafted at execution-prep)
**Baseline:** `origin/main` at `15e6572b` (2026-07-09)
**User-Visible Surface:** legends.legendary-arena.com
**Reserves:** D-24132 (hash-routing introduction + display-format locks; written at execution)

> **Execution addendum (2026-07-09, EC-373 draft).** Test-posture
> reconciliation against the SPA's established reality: the fetch functions
> read Vite's `import.meta.env` and cannot run under node:test (the
> existing `snapshotClient.test.ts` documents this posture), and the app
> has no Vue mount harness. Unit tests therefore cover the pure surface
> (`parseHashRoute`, `formatAverageScore`, set grouping,
> `buildAttractBoardList`, URL/key helpers); component rendering and fetch
> behavior are verified by `vue-tsc`, the local dev smoke (Verification
> Step 4), and the D-24026 live-on-surface DoD item. ACs 2 / 4 / 5 / 6 are
> satisfied through that split. The cycle-list composition is extracted to
> the pure `buildAttractBoardList` helper in `gauntletDisplay.ts` so AC-7
> stays unit-testable.

---

## Goal

Make the D-24131 gauntlet surface visible on the public Hall of Legends:
a **set-grouped gauntlet index** rendered from `gauntlet-index.json`
(entry counts; zero-entry boards as "unclaimed — be the first" per the
wiki empty-state mockup), **click-through routing** to a per-gauntlet
board view (the SPA's first navigation), a **gauntlet board panel**
(rank / handle / legs / PAR-relative average), and a **shared designed
empty state** replacing the header-only tables on the three classic
panels. Kiosk mode additionally cycles the gauntlet index as one slide.
Zero-API posture is unchanged — everything renders from R2 snapshots via
the manifest.

---

## Assumes

- **WP-342 is merged**; the publisher emits `legends/v1/gauntlet-index.json`
  (`{ gauntlets: [{ setAbbr, setName, mastermindSlug, mastermindName,
  legCount, entryCount, board }], generatedAt, schemaVersion: 1 }`),
  per-gauntlet boards `legends/v1/gauntlet-<setAbbr>-<mastermindSlug>.json`
  (`entries: [{ handle, rank, totalScore, legCount, averageScoreCentis }]`,
  written only when ≥1 complete entry), and additive manifest fields
  `gauntletBoards?: string[]` + `gauntletIndex?: 'gauntlet-index'`.
  Until migration 026 is PROD-applied and wins accumulate, the live index
  reports `entryCount: 0` everywhere — the index UI MUST look good in
  exactly that state (it is the launch state).
- The SPA is Vue 3 + Vite, sole runtime dependency `vue`, tests via
  `node --import tsx --test src/**/*.test.ts`, `vue-tsc --noEmit`
  typecheck, no router library.
- `snapshotClient.ts` mirrors server snapshot types by hand (the WP-142
  no-cross-package-import discipline) and caches boards keyed off
  `manifest.generatedAt`.
- `pnpm --filter @legendary-arena/legends-board build` exits 0 on `main`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24131** (§7 snapshot shapes, §8a this
  surface); scan for `gauntlet` entries. D-14201..D-14207 (WP-142
  snapshot contracts).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) +
  `.claude/rules/architecture.md` — the board is a UI app; no engine /
  registry / server imports; zero server API calls.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 — canonical field
  names (display only; no payloads constructed).
- `apps/legends-board/src/App.vue`, `snapshots/snapshotClient.ts`,
  `attract/AttractCycler.vue`, `attract/kioskMode.ts`, `panels/*.vue` —
  the surfaces this packet extends.
- `wiki/leaderboard.md` §Engagement & presentation proposal — the
  empty-state and index mockups this packet implements
  (`ewiki/leaderboard/board-mockup-empty.svg`).

---

## Scope (In)

- `snapshotClient.ts`: mirrored gauntlet types, `fetchGauntletIndex()`,
  `fetchGauntletBoard(boardName)`, manifest additive fields; cache
  invalidation on `generatedAt` change exactly as existing boards.
- A minimal hand-rolled **hash router** (`#/` = attract view;
  `#/gauntlet/<board>` = gauntlet board view) — a pure parse function +
  a `hashchange`-driven reactive ref; **no new npm dependency**.
- `GauntletIndexPanel.vue`: sets grouped with their gauntlets;
  populated boards link through; `entryCount: 0` boards render the
  "unclaimed" CTA state (not a link to an absent file).
- `GauntletBoardPanel.vue`: rank / handle / legCount / average, where
  average renders as `averageScoreCentis / 100` with one decimal and an
  explicit sign (golf-style: negative = under PAR, gold); back-link to
  the index.
- Shared `EmptyBoardCta.vue` ("No Legends yet — be the first", CTA text
  linking `https://play.legendary-arena.com`) used by the gauntlet
  surfaces AND retrofitted into `OverallPanel` / `WeeklyPanel` /
  `BySchemePanel` for their zero-entries state (closes the
  header-only-table gap recorded in wiki §Edge Cases).
- `App.vue`: route switch (attract view vs gauntlet board view); fetch
  the gauntlet index when the manifest advertises it; add the gauntlet
  index as ONE slide in the attract/kiosk cycle when present.
- Tests for the route parser, snapshot-client additions, and panel
  data-shaping helpers.

## Out of Scope

- **Any server / publisher change** — WP-342 shipped the data side.
- **vue-router or any new dependency** — the hash router is hand-rolled.
- **Personal standing / progress surfaces** — authenticated, belongs to
  the profile follow-up WP (D-24131 §8b); this board stays zero-auth.
- **Windowed boards, streaks, levels** — separate proposals, not decided.
- **The `scenario-*` board panel-mapping rework** (kiosk title vs
  hardcoded panel titles; per-scenario board routing) — a known gap
  recorded on the wiki; a later packet. This WP maps only the gauntlet
  boards it introduces.
- **Poll-retry for failed board fetches** (wiki §Edge Cases) — separate
  small fix, not bundled.

---

## Files Expected to Change

> 12 files — above the ~8 soft cap of 00.3 §5, accepted at draft time:
> 4 are test files, 3 are one-line-class empty-state retrofits sharing
> one new component, and the cohesive arc (fetch → route → render) does
> not decompose without stranding a router with no consumer.

1. `apps/legends-board/src/snapshots/snapshotClient.ts` — **modified** —
   gauntlet types + fetchers + manifest fields.
2. `apps/legends-board/src/snapshots/snapshotClient.test.ts` — **modified** —
   fetcher + cache-invalidation coverage for the additions.
3. `apps/legends-board/src/router/hashRoute.ts` — **new** — pure hash
   parser (`parseHashRoute(hash): Route`) + reactive current-route ref.
4. `apps/legends-board/src/router/hashRoute.test.ts` — **new** — parser
   table incl. malformed hashes (fall back to the attract route).
5. `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **new**.
6. `apps/legends-board/src/panels/GauntletBoardPanel.vue` — **new**.
7. `apps/legends-board/src/panels/gauntletDisplay.ts` — **new** — pure
   display helpers (`formatAverageScore(centis)`, set grouping) so the
   formatting is unit-testable outside Vue.
8. `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **new**.
9. `apps/legends-board/src/components/EmptyBoardCta.vue` — **new**.
10. `apps/legends-board/src/panels/OverallPanel.vue` — **modified** —
    zero-entries state renders `EmptyBoardCta`.
11. `apps/legends-board/src/panels/WeeklyPanel.vue` — **modified** — same.
12. `apps/legends-board/src/panels/BySchemePanel.vue` — **modified** — same.
    Plus `apps/legends-board/src/App.vue` — **modified** — route switch +
    index fetch + cycle slide (13th file; counted here explicitly rather
    than hidden).

Governance files (`DECISIONS.md` D-24132, `WORK_INDEX.md`, `STATUS.md`,
EC_INDEX) are updated at close per the Definition of Done.

---

## Contract

- **Routes (locked):** `#/` (or empty hash) = the existing attract view;
  `#/gauntlet/<boardName>` = the gauntlet board view where `<boardName>`
  matches `^gauntlet-[a-z0-9-]+$`; anything else falls back to `#/`.
  Navigation is plain `<a href="#/...">` — no History API, no server
  rewrite rules (the Pages `_redirects` file is untouched).
- **Display format (locked):** average = `averageScoreCentis / 100`
  rendered with exactly one decimal and an explicit `+`/`−` sign; `0`
  renders as `E` (even with PAR) — the golf convention the PAR model is
  built on. Negative (under PAR) styles gold like existing best scores.
- **Index grouping (locked):** group by `setAbbr` preserving the index
  artifact's order (the publisher already emits setAbbr ASC, mastermind
  ASC); `entryCount: 0` rows are non-links rendering the unclaimed CTA
  inline; populated rows link to `#/gauntlet/<board>`.
- **Kiosk/attract integration (locked):** when the manifest carries
  `gauntletIndex`, the cycle gains exactly ONE additional slide (the
  index panel); per-gauntlet boards are NOT cycled (105 boards would
  starve the classic slides). Kiosk cursor/interaction rules unchanged.
- **Zero-API invariant:** the deployed bundle contains no reference to
  `api.legendary-arena.com` or `*.onrender.com`; all fetches remain
  `images.legendary-arena.com/legends/v1/*` (re-verify against the
  built bundle, the EC-164 precedent).
- **Type mirroring:** gauntlet types are hand-mirrored from
  `apps/server/src/legends/legends.types.ts` with a comment naming the
  source (the existing snapshotClient discipline); no cross-package
  import.

---

## Non-Negotiable Constraints

**Engine-wide:** ESM only, Node v22+. Human-style code — see
`docs/ai/REFERENCE/00.6-code-style.md` (full English names, `is/has/can`
booleans, JSDoc on every function, ≤30-line functions, `// why:` on
non-obvious decisions, full-sentence error messages). Full file contents
for every new or modified file — no diffs, no snippets. Tests `.test.ts`
with `node:test` + `node:assert`; no network or DB access in tests
(fetchers are exercised with injected/stubbed `fetch`).

**Packet-specific:**
- **No new npm dependency** (no vue-router, no state library) — `vue`
  stays the sole runtime dependency; any `package.json` change is a FAIL.
- No engine / registry / preplan / server import; no `pg`; no
  server API call; no cookies/localStorage (WP-143 posture).
- No `Math.random()` and no wall-clock reads outside the existing
  freshness-badge path; panels are pure functions of fetched snapshots.
- The existing five panels' populated-state rendering is byte-compatible:
  only their zero-entries branch changes.
- `prefers-reduced-motion` behavior of the attract cycler is unchanged.
- All copy on the unclaimed/empty states is plain competitive
  call-to-action ("be the first", link to `play.legendary-arena.com`) —
  no pricing, no account-benefit claims (copy stays inside the board's
  read-only remit).

**Session protocol:** stop and ask on any unclear item; if the live
`gauntlet-index.json` shape differs from the WP-342 contract, STOP and
reconcile against `legends.types.ts` before writing the mirror types.

**Locked contract values:** the Contract section above; route grammar
`#/gauntlet/<boardName>`; the one-decimal signed average format; the
one-slide kiosk rule.

---

## Acceptance Criteria

1. `parseHashRoute` unit table passes: `''`/`'#/'` → attract;
   `'#/gauntlet/gauntlet-core-dr-doom'` → gauntlet route with that board
   name; malformed values (`'#/gauntlet/'`, `'#/x'`,
   `'#/gauntlet/UPPER!'`) → attract fallback.
2. `fetchGauntletIndex` / `fetchGauntletBoard` fetch
   `legends/v1/gauntlet-index.json` / `legends/v1/<board>.json`, cache,
   and invalidate on `manifest.generatedAt` change (stubbed-fetch tests).
3. `formatAverageScore(-350)` → `−3.5`-style signed one-decimal output;
   `formatAverageScore(0)` → `E`; `formatAverageScore(125)` → `+1.3`
   (exact expected strings pinned in the unit test).
4. The index panel renders every gauntlet from a fixture index; a
   zero-entry gauntlet renders the unclaimed CTA and no link; a
   populated gauntlet links to `#/gauntlet/<board>`.
5. The gauntlet board panel renders rank / handle / legs / formatted
   average rows from a fixture board and a back-link to `#/`.
6. `OverallPanel`, `WeeklyPanel`, and `BySchemePanel` render
   `EmptyBoardCta` when `entries` is empty and their populated-state
   markup is unchanged (existing tests, if any, still pass).
7. When the manifest lacks `gauntletIndex`, the SPA renders exactly as
   today (no gauntlet fetches, no extra cycle slide) — proven by a test
   on the cycle-list builder.
8. `pnpm --filter @legendary-arena/legends-board build` exits 0;
   `typecheck` (vue-tsc) exits 0; `test` green.
9. The built bundle contains no server-API hostname (zero-API grep
   against `dist/`, the EC-164 precedent).
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

# 4. Local visual pass (vite dev against the LIVE manifest):
pnpm --filter @legendary-arena/legends-board dev
#    - '#/' renders the attract view with the gauntlet-index slide
#    - '#/gauntlet/<a populated board>' renders standings
#    - a zero-entry gauntlet shows the unclaimed CTA
```

---

## Vision Alignment

**Vision clauses touched:** §20–26 (leaderboard presentation of
PAR-based scores); NG-1 proximity.

**Conflict assertion:** No conflict: this WP preserves all touched
clauses. It renders already-published, replay-verified standings (§24)
without recomputing anything; the golf-scale display convention follows
§20's PAR model.

**Non-Goal proximity check:** none of NG-1..7 are crossed — the surface
is read-only recognition; the CTA links to play, no paid or persuasive
surface is introduced.

**Determinism preservation:** deterministic and replay-faithful (§22) by
construction — display-only; no engine, RNG, scoring, or replay change.

## Funding Surface Gate

N/A — public scoreboard UI with a play-now call-to-action only; no
funding affordances, no donate/support copy, no payment channels
(§20.1 trigger surfaces absent).

## API Catalog (§21)

N/A — client-only; no HTTP endpoint added, modified, removed, or
re-statused, and no `apps/server/src/**` library surface touched.

---

## User-Visible Impact

legends.legendary-arena.com gains the gauntlet index and board views.
Launch-state honesty: until PROD migration 026 + real wins accumulate,
every gauntlet shows `entryCount: 0` — the index is deliberately
designed to read as "105 unclaimed championships", which is the
acquisition surface, not a failure state.

---

## Definition of Done

- [ ] All Acceptance Criteria pass (1–10 above).
- [ ] **Live-on-surface verification (D-24026):** on the deployed
      legends.legendary-arena.com, the gauntlet index renders from the
      live `gauntlet-index.json`, a board URL deep-links correctly, and
      the unclaimed CTA shows for a zero-entry gauntlet — observed and
      recorded (screenshot or fetch evidence), not inferred from green
      tests.
- [ ] `docs/ai/DECISIONS.md` — D-24132 written (hash routing + display
      format locks).
- [ ] `docs/ai/STATUS.md` updated with the user-visible change.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — this packet checked off.
- [ ] No files outside `## Files Expected to Change` (plus governance)
      were modified.
