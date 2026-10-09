# WP-800 — The Time Heist hero count: exactly 4 Heroes (one `SCHEME_HERO_COUNT_RULES` row)

**Status:** Draft 2026-10-08 · **EC:** EC-837 · **Reserves:** D-24675 (reserve PR #2650)
**Primary Layer:** Registry (source of truth). Every enforcement surface already reads the resolver.
**User-Visible Surface:** cards.legendary-arena.com loadout builder and preview, play.legendary-arena.com lobby and
`Game.setup`, gauntlet "Play this leg" (msis)
**Lane:** standard two-session (a validation tightening on a competitive surface: the msis fixed-division budget moves
at 1 player, and a D-entry amends D-24672 — NOT lightweight-eligible)
**Baseline:** `origin/main` @ `74d42215` (2026-10-08)
**Depends on:** WP-799 (scheme hero-count table) ✅

## Goal

msis The Time Heist prints "Use 4 Heroes in the Hero Deck, plus 4 other Heroes to make a 'Past Hero Deck'." WP-799
deferred it (D-24672 §4) because the 4 Past Heroes have nowhere to live. The engine implements none of The Past
(alternate city, Past HQ, Past Hero Deck, odd-Twist timeline swap), so today's requirement is the base count, which
matches neither printed number. Operator ruling (Jeff, 2026-10-08): enforce the **printed main Hero Deck, exactly 4
Heroes at every player count**, as one more `SCHEME_HERO_COUNT_RULES` row. The Past stays a separately named
full-fidelity arc.

## User-Visible Impact

- **Loadout builder (cards):** a Time Heist loadout needs exactly 4 heroes at 1–5 players (was 3 / 5 / 5 / 5 / 6).
  Export is blocked with any other count. Every other scheme is unchanged.
- **Play lobby:** the requirement line and the create gate follow (projection-driven, no client change).
- **Match:** the Hero Deck holds 4 Heroes (56 cards). The Past still does not exist (unchanged from today).
- **Gauntlet:** the msis Time Heist leg asks for and launches with 4 heroes (WP-798 path). Through D-24671 the msis
  fixed-division budget becomes **6 / 7 / 7 / 7 / 8** (1-player 5 → 6; others unchanged). Every other set is unchanged.

## Assumes

- **WP-799 / D-24672 ✅** — `SchemeHeroCountRule`, the 26-row `SCHEME_HERO_COUNT_RULES` (last row
  `cosm/destroy-the-nova-corps`) and the table-driven `resolveEffectiveHeroCount`
  (`packages/registry/src/playerCountSetup.ts` :74–133, :135–195). The table's `// why:` comment (:88–92) says The Time
  Heist is "deliberately absent".
- **WP-799 tests** (`packages/registry/src/playerCountSetup.test.ts`): `EXPECTED_HERO_COUNTS_BY_SCHEME` (26 rows,
  :260–292), the drift pin "holds exactly the 26 printed Hero Deck count rows, in order" (:311–318, asserting
  `length, 26`), and "keeps msis The Time Heist at the base count (deliberately not a row)" (:354–356). This packet
  intentionally changes those three locked values (see §Scope C). The `heroInput(schemeId, playerCount, heroCount)`
  helper (:371–381) supplies the base villain-group count and exactly one Henchman group (`['h']`).
- **Every surface already calls the resolver** (verified by WP-799, unchanged since): `checkPlayerCountComposition`, the
  engine `validatePlayerCountComposition`, `matchGate.routes.ts` setup-requirements, the viewer `useLoadoutDraft.ts`
  and `previewSetupRequirement.ts`, and the gauntlet per-leg count and budget (WP-798 / D-24671).
- **Engine** — the Hero Deck is built from every `heroDeckIds` entry. Time Heist is `counter-only` with
  `lossThreshold: 10` (`packages/game-engine/src/rules/schemeTwistConfigs.ts` :432–438). No engine code reads a hero
  count for it.
- **Card data** — `data/cards/msis.json` carries `the-time-heist` (the existing fail-loud test covers the new key).
- **Nothing else is keyed to the scheme:** no theme, scoring config, PAR artifact or gauntlet config names it
  (`git grep the-time-heist -- content data`, excluding card data: only `CATALOG.md`, scheme-twist assignments and the
  sweep scheme axis). Approved gauntlet loadouts carry no heroes.
- **Production (read-only, `transaction_read_only = on`, 2026-10-08):** 0 msis heroes-win replays on any msis scheme,
  so a wider msis 1-player budget qualifies nothing today. Execution re-runs the count.
- **Reservation** — WP-800 / EC-837 / D-24675 are reserved by PR #2650; it must be on `origin/main` before execution.
- **Scaffold (01.4 §Empirical Scaffold, run 2026-10-08 at `74d42215`):** the row was patched in and `pnpm -r build`
  exited 0. `pnpm -r --no-bail test` was 0 failures in every package **except registry 290 / 288 pass / 2 fail**,
  exactly the two locked WP-799 tests this packet changes: the drift pin (26 ids) and the "deliberately not a row"
  test. `node --import tsx --test scripts/*.test.ts` was 108 / 108 (with `sh` on PATH).
  `gauntlet-post-block.mjs msis thanos` gave 6 / 7 / 7 / 7 / 8.

## Context (Read First)

**Rules.** "Setup: 11 Twists. Use 4 Heroes in the Hero Deck, plus 4 other Heroes to make a 'Past Hero Deck.' … The
Past has its own 'Past HQ' filled by the 'Past Hero Deck.' To start, play as if 'The Past' city, HQ, and Hero Deck
don't exist." The main Hero Deck is exactly 4 Heroes, independent of player count.

**Why 4, not 8 (operator ruling, Jeff, 2026-10-08).** Three options were weighed:
- **(a) count only, exactly 4** — chosen;
- **(b) full fidelity** — The Past as a second city / HQ / Hero Deck with the odd-Twist swap, requirement 8. That is a
  multi-WP engine + client arc for one scheme;
- **(c) require 8 now with the Past 4 inert** — players would supply 4 heroes that do nothing.

(a) makes the requirement match the printed main deck today at near-zero cost. When the full-fidelity arc lands, it
moves the requirement to 8 and decides where the Past Heroes live; saved 4-hero loadouts are then flagged on load,
not rewritten.

**Why a row, not new code.** WP-799 built the table so the next printed rule is a data row (D-24672 §2). `exact 4` is
an existing kind.

**Existing-test edits are mandated.** WP-799 pinned "26 rows" and "Time Heist is not a row" as locked values. Changing
that decision is this packet's purpose, so those two tests (plus the `EXPECTED_HERO_COUNTS_BY_SCHEME` list and its
JSDoc count) change in the same commit, with a `Tests-changed:` trailer naming the behavior change (per
`.claude/CLAUDE.md` Reward Integrity; D-24444 Guard B does not require it on a code-plus-test commit, so it is a DoD
item, not a hook check). No other
existing assertion changes.

**Read:**
- `docs/ai/DECISIONS.md`: D-24672 (amended here), D-24671, D-24337, D-24165, D-24372, D-24444, D-11804.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary; `.claude/rules/architecture.md`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7 (`heroDeckIds`; the 9-field `MatchSetupConfig` lock is untouched).

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- No `Math.random()`, no I/O in moves or helpers. Moves never throw; only `Game.setup()` may throw.
- `G` stays JSON-serializable. No `G` field and no `MatchSetupConfig` field is added.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`. No `boardgame.io` import in helpers or tests.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc on every function, no nested
  ternaries.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- No new npm dependencies; no `package.json` change.

**Packet-specific:**
- **Session protocol:** if anything here is unclear or contradicts the code at baseline, STOP and ask — never guess.
- **One row, nothing else in production code.** The only production change is the `msis/the-time-heist` row and the
  table comment update in `playerCountSetup.ts`. No new rule kind, no resolver change, no consumer change.
- **The resolver signature and every consumer are unchanged** (engine, server route, viewer, registry impls,
  `types/index.ts`, arena-client). If one needs a CODE edit, STOP and report.
- **No Past machinery.** No `G` field, no city / HQ / deck, no `schemeSetupSizing` change, no Twist resolver change.
- **Existing-test edits are exactly the mandated set** (§Scope C). Any other failing existing test is
  STOP-and-report.
- **Sentinel / replay oracles unchanged.** The sentinel `finalStateHash` and `PRE_WP080_HASH` stay byte-identical.

## Locked Contract Values

- **The row** — appended as the 27th and last entry of `SCHEME_HERO_COUNT_RULES`, after
  `cosm/destroy-the-nova-corps`:

  ```ts
  'msis/the-time-heist': { kind: 'exact', count: 4 },
  ```

- **Effective counts** (1p..5p, base 3/5/5/5/6): `msis/the-time-heist` → **4 / 4 / 4 / 4 / 4**. Every other row's
  sequence and every unlisted scheme are unchanged.
- **Drift pin:** `Object.keys(SCHEME_HERO_COUNT_RULES)` deep-equals the 26 WP-799 ids in their existing order followed
  by `msis/the-time-heist`; length **27**.
- **msis gauntlet budget** (`max(base, largest leg) + 2`, D-24671): **6 / 7 / 7 / 7 / 8**.
- **API catalog row** (`docs/ai/REFERENCE/api-endpoints.md`, `GET /api/match/setup-requirements`), replaced whole:
  - Status `Wired`, Method `GET`, Auth `guest` (closed sets, unchanged); request and response schemas unchanged.
  - Authorizing WP appends `WP-800 / D-24675 (The Time Heist main Hero Deck = 4)`.
  - Notes say the table has 27 rows and add The Time Heist (exactly 4) to the examples; the rest is carried forward.
- **D-24675** is authored at execution as Active (five points in §D-24675 Content).

## Scope (In)

### A) Registry
- `playerCountSetup.ts`:
  - append the row, with a `// why:` comment quoting "Use 4 Heroes in the Hero Deck" and stating that the Past Hero
    Deck is the separately named full-fidelity arc (D-24675);
  - rewrite the table comment's "msis The Time Heist is deliberately absent …" sentence to drop the deferral.
  - Comments name the scheme in prose ("The Time Heist"), never by its `msis/the-time-heist` ext_id (the
    Verification grep expects exactly one non-test match: the row key).

### B) Server catalog doc
- `docs/ai/REFERENCE/api-endpoints.md`: the setup-requirements row replaced whole (D-11804). No server code change.

### C) Tests (`playerCountSetup.test.ts`)
- **Mandated edits to existing tests** (the behavior intentionally changes; `Tests-changed:` trailer):
  - `EXPECTED_HERO_COUNTS_BY_SCHEME` gains `['msis/the-time-heist', [4, 4, 4, 4, 4]]` as its last entry, and its JSDoc
    says 27 rows;
  - the drift pin's title says 27 and it asserts `length, 27`;
  - "keeps msis The Time Heist at the base count (deliberately not a row)" is **removed**; the four composition cases
    below replace it (registry 290 → 293).
- **New cases** (`checkPlayerCountComposition`, one `it` each, inside the existing
  `describe('checkPlayerCountComposition — printed Hero Deck counts (D-24672)')`, so registry stays at 43 suites).
  Each asserts the full mismatch array with `assert.deepEqual`: exactly one `heroDeckIds` entry, or `[]` for the
  passing case.
  - 2p Time Heist with 5 heroes (existing `heroInput` helper) →
    `[{ field: 'heroDeckIds', label: 'heroes', required: 4, actual: 5 }]`;
  - 2p with 4 heroes (`heroInput`) → `[]`;
  - 1p with 3 heroes (`heroInput`) → `[{ … required: 4, actual: 3 }]`;
  - 5p with 6 heroes, input built **inline**, because `heroInput` supplies one Henchman group and 5p requires 2 —
    `{ playerCount: 5, schemeId: <Time Heist>, villainGroupIds: ['v0','v1','v2','v3'], henchmanGroupIds: ['h0','h1'],
    heroDeckIds: <6 ids> }` → `[{ … required: 4, actual: 6 }]`. `heroInput` is not modified (pre-flight PS-1:
    with the helper this case also reports a Henchman mismatch).
- **Non-vacuous:** removing the row must fail at least one test (1/1 revert proof).

## D-24675 Content (authored at execution, Status Active)

1. **The Time Heist's main Hero Deck is exactly 4 Heroes** at every player count — an `exact 4` row in
   `SCHEME_HERO_COUNT_RULES` (27 rows). Strict, like every other row: any other count is rejected.
2. **Amends D-24672 §1 and §4.** The table now holds every printed Hero Deck count rule (Heroes kept outside the Hero
   Deck remain out of scope). The Time Heist deferral is resolved for the main deck: 4, not 8 (operator ruling, Jeff,
   2026-10-08).
3. **The Past is a named full-fidelity arc:** the alternate city, Past HQ, Past Hero Deck and odd-Twist timeline swap.
   When it lands it moves the requirement to 8 and decides where the 4 Past Heroes live (the 9-field `MatchSetupConfig`
   lock stays). Saved 4-hero loadouts are flagged on load then, not rewritten.
4. **Gauntlet.** msis fixed-division budget 6 / 7 / 7 / 7 / 8 (1-player 5 → 6; never lower). Existing Time Heist
   scores that used another count remain valid leg clears (`qualifiesAsLegClear` has no team-size check); nothing is
   re-scored. Records the execution-time read-only count of msis heroes-win rows.
5. **No migration.** Matches in progress keep their setup; no theme names the scheme. Saved loadouts and in-progress
   gauntlet runs whose Time Heist leg holds any count other than 4 are flagged on read (builder warning;
   `hasFullPicks` false, so "Play this leg" waits for a re-pick), never rewritten; `leg_picks` saves stay structural
   (D-24671 §4).

## Out of Scope

- The Past (city, HQ, Hero Deck, Twist swap) and any engine, server, arena-client or registry-viewer code.
- A requirement of 8; any `G` or `MatchSetupConfig` field; seed-PAR or theme changes.

## Files Expected to Change

- `packages/registry/src/playerCountSetup.ts` — modified — one row + table comment
- `packages/registry/src/playerCountSetup.test.ts` — modified — mandated edits + new cases
- `docs/ai/REFERENCE/api-endpoints.md` — modified — setup-requirements row replaced whole
- Governance:
  - `docs/ai/STATUS.md` — modified — WP-800 entry + live-verify matchId
  - `docs/ai/DECISIONS.md` — modified — D-24675 → Active
  - `docs/ai/work-packets/WORK_INDEX.md` — modified — WP-800 `[x]`
  - `docs/ai/execution-checklists/EC_INDEX.md` — modified — EC-837 → Done
  - `docs/05-ROADMAP-MINDMAP.md` — modified — node 📝→✅ + regenerated counts

No other files may be modified. Line-ending-only churn a build leaves in generated files (e.g.
`packages/lagn-spec/schemas/lagn-v1.json`) is reverted.

## Contract

- Every enforcement surface requires exactly 4 Heroes for `msis/the-time-heist` at every player count. For every other
  scheme, nothing changes.

## Acceptance Criteria

1. `resolveEffectiveHeroCount('msis/the-time-heist', n, base)` returns 4 at n = 1..5.
2. The drift pin holds the 26 WP-799 ids in order plus `msis/the-time-heist` last (27), and every id exists in the card
   data.
3. `checkPlayerCountComposition` reports `{ required: 4 }` for a Time Heist config with 5 heroes at 2p, 3 at 1p and 6
   at 5p, and no mismatch with 4 at 2p.
4. Every other row's locked sequence and the unlisted / empty / prototype-key cases are unchanged.
5. `pnpm -r --no-bail test` has 0 failures. The only existing-test edits are the §Scope C mandated set. The sentinel
   `finalStateHash` / `PRE_WP080_HASH` are unchanged.
6. `node scripts/gauntlet-post-block.mjs msis thanos` prints a Fixed-Pool budget of 6 / 7 / 7 / 7 / 8.
7. The `docs/ai/REFERENCE/api-endpoints.md` `GET /api/match/setup-requirements` row is replaced whole: Status `Wired`,
   Auth `guest`, request/response schemas unchanged, Authorizing WP ends `WP-800 / D-24675 (The Time Heist main Hero
   Deck = 4)`, and Notes say the table has 27 rows and list The Time Heist (exactly 4).
8. `git grep -n "msis/the-time-heist" -- packages/registry/src ':!*.test.ts'` returns exactly the row, and
   `git grep -n -i "Time Heist is deliberately absent" -- packages/registry/src` returns nothing.

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0
pnpm -r --no-bail test
# Expected: 0 failures; registry 290 → 293 tests (one removed, four added), suites 43 → 43; record per package
pnpm --filter registry-viewer typecheck
# Expected: exits 0
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
# Expected: green; exits 0
node scripts/gauntlet-post-block.mjs msis thanos
# Expected: Fixed-Pool budget 6 / 7 / 7 / 7 / 8
pnpm ledger:numbers:check; pnpm roadmap:counts:write; pnpm roadmap:counts:check
# Expected: each exits 0
git grep -n "msis/the-time-heist" -- packages/registry/src ':!*.test.ts'
# Expected: exactly one match (the row) in playerCountSetup.ts
git grep -n -i "Time Heist is deliberately absent" -- packages/registry/src
# Expected: no matches (an unrelated "deliberately absent" in difficultyRatings.schema.ts stays)
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All ACs pass. The 1/1 revert proof (row removed → a new test fails) is reported.
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. Registry-viewer typecheck is 0. Per-package
      before/after counts are recorded.
- [ ] Replay oracles byte-identical, no re-pin. `git status --porcelain` ⊆ the allowlist.
- [ ] The `EC-837:` commit carries a `Tests-changed:` trailer naming the mandated edits.
- [ ] **D-24026 live verify (REQUIRED), after deploy:**
  - the cards loadout builder shows "4 heroes" for a 2p Time Heist loadout and blocks export with 5;
  - the play lobby warns for that 5-hero loadout after a hard refresh (`setup-requirements` is cached up to an hour);
  - a 4-hero Time Heist match plays;
  - the msis gauntlet's Time Heist leg asks for 4 heroes.

  Record the matchId in STATUS.md.
- [ ] STATUS.md updated. D-24675 authored in DECISIONS.md as Active, with the five points; §4 records the read-only
      count of msis heroes-win rows (or the psql command handed to Jeff).
- [ ] WORK_INDEX WP-800 `[x]` with date. EC_INDEX EC-837 → Done. Mindmap `📝`→`✅`. `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §1 / §2: faithful setup (the printed main Hero Deck size).
  - §3: fairness (the leg count is the printed one for every player).
  - §10a: Registry Viewer (required row and export gate).
  - §19b: saved loadouts with the old count are flagged on load, not rewritten.
  - §8 / §22: determinism (no `G` change; the sentinel scheme is unlisted).
  - §23 / §24: leaderboards (approved loadouts carry no heroes; the msis budget widens through D-24671).
  - None of NG-1..NG-8 is crossed.
- **Conflict assertion:** no conflict. Rules fidelity only; no monetization surface.

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. The gate ran as an independent subagent: **PASS** with no Final Gate row firing; advisories A1–A5 were applied before commit (EC-837: 54 content lines).
- **§1 structure:** all required sections are present; baseline `74d42215` is cited; Locked Contract Values is its own section (WP-799 precedent).
- **§2 constraints:** engine-wide constraints (ESM, Node v22+, full files, `00.6`, no new dependencies), packet-specific STOP points (one row only, unchanged consumers, no Past machinery, the mandated test-edit set only, oracles unchanged) and the locked values.
- **§3 / §4:** WP-799 / D-24672 with verified line anchors; the three locked tests and the `heroInput` helper shape (A3); every resolver consumer; the engine twist config; the card data; the #2650 reservation; the production state; the scaffold. Context cites D-24672 / D-24671 / D-24337 / D-24165 / D-24372 / D-24444 / D-11804, ARCHITECTURE §Layer Boundary, `.claude/rules/architecture.md` and 00.2 §7.
- **§5 / §7:** a closed allowlist (3 files + 5 governance files, each marked modified, A4); no new dependency, no `package.json` change.
- **§6 naming:** `heroDeckIds`, `schemeId`, `ext_id`, `MatchSetupConfig` (9-field lock untouched), `field: 'heroDeckIds'` / `label: 'heroes'`; quoted test titles are exact.
- **§8 layer:** a registry data row only; the resolver and every consumer are untouched; no `G` field, nothing persisted.
- **§9 Windows:** `pwsh` verification.
- **§10 / §11:** N/A — no environment variable; setup-requirements stays `guest` and no auth code is touched.
- **§12 tests:** `node:test`; no boardgame.io, network or database; literal expectations with full-array `deepEqual`; 1/1 revert proof; sentinel `finalStateHash` / `PRE_WP080_HASH` pinned unchanged.
- **§13 / §14 / §15:** exact commands with expected output (290 → 293 tests, 43 suites, post-block 6 / 7 / 7 / 7 / 8, grep counts); 8 binary ACs including the catalog row and the greps (A1); a DoD covering STATUS, DECISIONS (D-24675 with the msis count or the psql command, A2), WORK_INDEX, EC_INDEX, the mindmap and counts, the allowlist check and the D-24026 live verify (matchId recorded; the one-hour cache noted).
- **§16 code style:** one data row with a required `// why:`; no new function or helper; the 5p test input is inline rather than a helper change.
- **§17 Vision:** §1/§2/§3/§8/§10a/§19b/§22/§23/§24 cited; no conflict; none of NG-1..NG-8 crossed; the determinism line (no `G` change; sentinel scheme unlisted) is stated.
- **§18:** the ext_id grep is scoped to non-test `packages/registry/src`; comments name the scheme in prose only (RS-2).
- **§19:** N/A — commit-time discipline.
- **§20 Funding:** N/A — the touched surfaces are the cards loadout builder requirement and export gate, the play lobby requirement line and gauntlet "Play this leg". None is a navigation, viewer, profile or tournament funding affordance, and there is no donate/support copy.
- **§21 API Catalog:** triggered. `GET /api/match/setup-requirements` now projects 4 for The Time Heist. The row is replaced whole (D-11804): Status `Wired`, Auth `guest` (closed sets), schemas and field names unchanged, Authorizing WP gains WP-800 / D-24675, Notes say 27 rows.

## Gate Verdicts

All three gates ran as independent subagents, in order.
- **Pre-flight (01.4): NOT READY → READY TO EXECUTE.**
  - Empirical scaffold (own throwaway worktree at `74d42215`): row only → registry 290 / 288 pass / 2 fail, exactly the two mandated locked tests; every other package 0 failures (game-engine 5019, server 1678 / 1472 pass, registry-viewer 327, arena-client 2298, dashboard 571, legends-board 135, lagn-spec 107, preplan 52, engine-runner 20, vue-sfc-loader 11, replay-producer 4). With the mandated edits and the four new cases: registry 293 / 293, 43 suites. Revert proof: 6 / 293 fail. Scripts 108 / 108; post-block msis 6 / 7 / 7 / 7 / 8; viewer typecheck 0; replay fixtures unchanged.
  - PS-1 (the 5p case builds its input inline — `heroInput` supplies one Henchman group) and PS-2 (the cleanup grep narrowed to "Time Heist is deliberately absent" — an unrelated match exists in `difficultyRatings.schema.ts`) applied; RS-1 (the `Tests-changed:` trailer is not hook-enforced on a code-plus-test commit), RS-2 (no ext_id in comments) and RS-3 (suites 43 → 43) applied → **READY**.
- **Copilot (01.7): RISK → HOLD → PASS (CONFIRM).** #28: D-24675 §5 now states that saved loadouts and in-progress gauntlet runs holding another Time Heist count are flagged on read (`hasFullPicks` false), never rewritten. The re-run returned **PASS / CONFIRM**.
- **Lint (00.3): PASS** — no Final Gate row fires; advisories A1–A5 applied (two ACs for the catalog row and greps; the psql fallback; the `heroInput` shape in Assumes; allowlist markers; the N/A justifications above).