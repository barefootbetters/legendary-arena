# EC-837 — The Time Heist hero count: exactly 4 Heroes (WP-800)

**WP:** WP-800 · **Reserves:** D-24675 · **Layer:** Registry (+ the API catalog row)

Authoritative execution contract for WP-800. Subordinate to ARCHITECTURE.md and `.claude/rules/*`. If this EC and
WP-800 disagree, WP-800 wins. Compliance is binary.

## Before Starting

- [ ] Target file set = WP-800 §Files Expected to Change exactly; touching any other file is STOP.
- [ ] WP-799 / EC-836 is Done on `origin/main` (WORK_INDEX `[x]`).
- [ ] The WP-800 / EC-837 / D-24675 reservation (#2650) is on `origin/main`, and `pnpm ledger:numbers:check` exits 0.
- [ ] `pnpm -r build` exits 0. Record the per-package `pnpm -r --no-bail test` before-counts (registry 290 at draft).
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.
- [ ] `SCHEME_HERO_COUNT_RULES` at baseline has exactly 26 rows ending with `cosm/destroy-the-nova-corps`, and no
      `msis/the-time-heist` key. If it differs, STOP and report.

## Locked Values

- The row, appended as the 27th and last entry: `'msis/the-time-heist': { kind: 'exact', count: 4 },`
- Effective counts 1p..5p: `msis/the-time-heist` → 4 / 4 / 4 / 4 / 4. Every other row unchanged.
- Drift pin: the 26 WP-799 ids in their existing order + `msis/the-time-heist`; `length, 27`.
- msis gauntlet budget (`gauntlet-post-block.mjs msis thanos`): 6 / 7 / 7 / 7 / 8.
- Mandated existing-test edits (exactly these, in `playerCountSetup.test.ts`):
  - `EXPECTED_HERO_COUNTS_BY_SCHEME` + `['msis/the-time-heist', [4, 4, 4, 4, 4]]` last, JSDoc "27";
  - the drift-pin title "27" + `length, 27`;
  - "keeps msis The Time Heist at the base count (deliberately not a row)" removed.
- New cases (one `it` each, in the existing `describe('checkPlayerCountComposition — printed Hero Deck counts
  (D-24672)')`; full-array `assert.deepEqual`): 2p ×5 → `[{ field: 'heroDeckIds', label: 'heroes', required: 4,
  actual: 5 }]`; 2p ×4 → `[]`; 1p ×3 → `required 4, actual 3`; 5p ×6 → `required 4, actual 6`. 1p / 2p use
  `heroInput`; the 5p input is inline (4 villain groups, 2 Henchman groups — `heroInput` supplies 1) and `heroInput`
  is not modified. Registry 290 → 293 tests, suites 43 → 43.
- API catalog setup-requirements row replaced whole: Status `Wired`, Auth `guest`, schemas unchanged; Authorizing WP
  appends `WP-800 / D-24675 (The Time Heist main Hero Deck = 4)`; Notes say 27 rows.
- `EC-837:` commit carries `Tests-changed: <the three mandated edits — WP-800 makes The Time Heist a row>`.

## Guardrails

1. One production change: the row plus the table-comment update in `playerCountSetup.ts`. No new rule kind; the
   resolver body and signature are untouched.
2. No CODE edit to any resolver consumer (engine, server route, viewer, registry impls, `types/index.ts`,
   arena-client). If one is needed, STOP.
3. No Past machinery: no `G` field, no city / HQ / deck, no `schemeSetupSizing` or Twist-resolver change.
4. Existing-test edits are exactly the mandated set; any other failing existing test is STOP-and-report.
5. Test expectations are written-out literals, never computed from the rule.
6. Sentinel `finalStateHash` / `PRE_WP080_HASH` unchanged; never re-pin.

## Required Comments (`// why:`)

- The row: the printed "Use 4 Heroes in the Hero Deck" clause, exactly 4 at every player count; the Past Hero Deck
  is the separately named full-fidelity arc (D-24675).
- The table comment: drop "msis The Time Heist is deliberately absent …"; keep the requirement-override rationale.
- Comments name the scheme in prose ("The Time Heist"), never by its ext_id.

## Files to Produce

Exactly the WP-800 §Files Expected to Change allowlist.

## After Completing

- Revert proof 1/1: removing the row fails a new test.
- `git grep`: `msis/the-time-heist` has one non-test match in `packages/registry/src`; "Time Heist is deliberately
  absent" has none.
- `pnpm -r build`; `pnpm -r --no-bail test` 0 failures (before/after per package); viewer typecheck 0; replay
  fixtures byte-identical; post-block msis 6 / 7 / 7 / 7 / 8.
- Read-only production count of msis heroes-win rows (or the psql command handed to Jeff) recorded in D-24675 §4.
- Live-on-surface verification (D-24026), after deploy: builder "4 heroes" for a 2p Time Heist loadout and export
  blocked with 5; lobby warning after a hard refresh; a 4-hero match plays; the msis Time Heist leg asks for 4.
  Record the matchId in STATUS.md.
- `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24675 → Active (the five points; §5 states the
  saved-loadout / in-progress `leg_picks` read-time behavior).
- WORK_INDEX WP-800 `[x]` with date; EC_INDEX EC-837 → Done; mindmap 📝 → ✅, then `pnpm roadmap:counts:write` and
  `pnpm roadmap:counts:check` exit 0.

## Common Failure Smells

- The `Tests-changed:` trailer is missing. D-24444 Guard B will NOT catch it (the commit also stages
  `playerCountSetup.ts`), so its absence is a silent DoD miss — add it anyway.
- The 5p case reports a Henchman mismatch too: it used `heroInput` (one Henchman group) instead of the inline input.
- Time Heist returns 5 at 2p: the key is mistyped (the card-data test should catch it) or the dist was not rebuilt.
- The lobby still says 5: the registry dist was not rebuilt, or the response is cached.
