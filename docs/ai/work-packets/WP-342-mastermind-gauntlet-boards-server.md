# WP-342 — Mastermind Set-Gauntlet Boards (Outcome Persistence + Gauntlet Read-Layer + Legends Publisher) (Server)

**Status:** Drafted 2026-07-09 (design-locked by D-24131; EC pending — execution-prep is the next step)
**Primary Layer:** Server (`apps/server/**`) + one migration
**Dependencies:** D-24131 (design lock), D-24119 arc / WP-333..WP-340 ✅ (write path live), WP-142 ✅ (legends publisher), WP-054/WP-115/WP-150 ✅ (leaderboard read layer), WP-050/WP-051 ✅ (PAR publication store), D-5301/D-5302 (verifier + immutability), D-10014 (set-qualified ext ids)
**EC:** pending (drafted at execution-prep)
**Baseline:** `origin/main` at `9d2e8118` (2026-07-09)
**User-Visible Surface:** none — infrastructure (the payoff surface is the follow-up legends-board index/panel WP and the profile-progress WP, both backlogged; the snapshots this packet publishes are inert until a client renders them)
**Reserves:** D-24131 (already written at draft time; this packet executes it)

> **Execution addendum (2026-07-09, EC-372 draft).** Three reconciliations
> against code reality, discovered while drafting the EC:
> (1) **Two wiring files join the list** — the publisher's start site is
> `apps/server/src/index.mjs` (not `server.mjs`), so the gauntlet catalog
> threads `server.mjs` (build from registry, return from `startServer()`) →
> `index.mjs` (pass to `startLegendsPublisher`) →
> `legends.scheduler.ts` (forward to `publishAllBoards`). 12 files total.
> (2) **No new dependency seam for the version filter** — the injected
> `LeaderboardDependencies.checkParPublished` already returns
> `scoringConfig.scoringConfigVersion` per scenario, so the gauntlet
> read-layer reuses it for both PAR-eligibility and the VISION §22 version
> filter (the WP's Assumes named a separate PAR-store lookup; not needed).
> (3) **`CompetitiveScoreRecord` carries an 11-key drift lock** (EC-053
> test #9); adding `outcome` amends it to 12 keys under D-24131 authority —
> the drift test updates in the same change.

---

## Goal

Make the D-24131 mastermind set-gauntlet standings exist as published R2
snapshots. After this session: (1) every new verified competitive score row
records the match **outcome** (`heroes-win` / `scheme-wins`), so "defeat the
mastermind" is a queryable fact; (2) a registry-driven **gauntlet catalog**
(one gauntlet per set × mastermind, legs = that set's schemes) and a
**standings read-layer** (per player: best winning score per leg, complete
gauntlets only, ranked by total = average) exist in `apps/server`; (3) the
WP-142 legends publisher emits one snapshot board per gauntlet that has at
least one complete entry, plus a `gauntlet-index.json` catalog artifact, and
the manifest gains **additive** fields listing them. No engine change, no
HTTP endpoint change, no client change.

---

## Assumes

- **The D-24119 write path is live.** `POST /api/competition/scores` submits
  by `matchId`; `submitCompetitiveScoreImpl` re-reduces the artifact via
  `reduceMatchToFinalState` (WP-334/WP-336) and inserts into
  `legendary.competitive_scores` (migration 007). The reduced final state
  carries the boardgame.io gameover payload holding the engine's
  `EndgameResult` (`outcome: 'heroes-win' | 'scheme-wins'` —
  `packages/game-engine/src/endgame/endgame.types.ts`).
- **`scenario_key` format** is `"{schemeSlug}::{mastermindSlug}::{villains}"`
  with set-stripped slugs (capture calls `buildScenarioKey` with
  `stripSetAbbreviation(...)` — `apps/server/src/replay/matchCapture.logic.ts`).
- **The registry is loaded at server startup** (`apps/server/src/server.mjs`)
  and exposes per-set schemes and masterminds with canonical `slug` fields
  (card data carries `slug` per record; sets carry `abbr` per D-10014).
- **The WP-142 publisher runs** (`legends.publisher.ts`), writes
  `legends/v1/*` inside one read-only transaction, and writes
  `manifest.json` **last** (D-14204).
- **The PAR publication store** (WP-050/WP-051) can answer "what is the
  currently-published `scoringConfigVersion` for scenario X" — the version
  filter in the standings query joins against it.
- `pnpm -r build` exits 0 on `main`; the `apps/server` no-DB suite is green;
  DB-gated suites run when `TEST_DATABASE_URL` is set.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24131** (the design lock this packet
  executes; read it in full), D-24119..D-24128 (write-path arc), D-5301
  (server-recomputed scores), D-5302 (row immutability), D-14204
  (manifest-last), D-10014 (set-qualified ids). Scan for other `gauntlet`
  mentions.
- `docs/ai/ARCHITECTURE.md` — Section 1 ("Monorepo Package Boundaries",
  "Package Import Rules") and §Layer Boundary (Authoritative);
  `.claude/rules/architecture.md` ("Layer Boundary (Authoritative)") —
  the server may load registry data at startup; the engine is untouched.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 — canonical field
  names (`schemeId`, `mastermindId`, `villainGroupIds`); the gauntlet
  catalog derives slugs from registry data, never re-slugifies names.
- `apps/server/src/legends/legends.publisher.ts`, `legends.logic.ts`,
  `legends.types.ts` — the publisher pipeline and snapshot/manifest shapes
  this packet extends.
- `apps/server/src/competition/competition.logic.ts` +
  `competition.types.ts` — the submit pipeline (`submitCompetitiveScoreImpl`
  step numbering) and `CompetitiveScoreRecord`.
- `data/migrations/007_create_competitive_scores_table.sql` — the table the
  migration extends.
- `wiki/leaderboard.md` §Open Questions — the design narrative (descriptive
  companion; DECISIONS.md is authoritative).

---

## Scope (In)

- Migration `026`: add a nullable `outcome` column (closed set) to
  `legendary.competitive_scores`.
- Persist `outcome` at submission time, derived from the reduced final
  state's gameover payload inside the existing verify+score pipeline.
- New `gauntlet.logic.ts`: `buildGauntletCatalog` (registry → gauntlet
  definitions) + `getGauntletStandings` (SQL aggregation → ranked entries).
- Publisher: emit per-gauntlet boards + `gauntlet-index.json`; add additive
  manifest fields (`gauntletBoards`, `gauntletIndex`).
- `server.mjs` wiring: build the catalog from the startup registry and
  inject it into the publisher.
- Tests for all of the above (unit + DB-gated).

## Out of Scope

- **Any engine change** (`packages/game-engine/**`) — the gauntlet is a
  derived aggregation; `EndgameResult` already exists.
- **Any HTTP endpoint change** — no new routes; `api-endpoints.md` untouched.
- **The legends-board client** (index page, routing, gauntlet panel) — the
  backlogged follow-up client WP renders what this packet publishes.
- **Profile surfaces** (owner-profile gauntlet progress, public-profile
  badges, `/api/me/gauntlets`) — backlogged follow-up WP.
- **Windowed (7/30-day) boards, streaks, levels** — separate proposals
  (wiki §Engagement), not part of D-24131.
- **Backfilling `outcome` for pre-existing rows** — legacy `NULL` rows never
  qualify as gauntlet legs (D-24131); no data rewrite.
- **Tier-1 / tier-3 / tier-4 championships and the annual reset** — still
  open questions on the wiki; not decided, not built here.

---

## Files Expected to Change

> 10 files — above the ~8 soft cap of 00.3 §5, accepted at draft time
> because 4 of the 10 are test files and 1 is a migration; the code surface
> is 5 files spanning one cohesive arc (persist the fact → aggregate it →
> publish it). Splitting would strand a column with no consumer.

1. `data/migrations/026_add_outcome_to_competitive_scores.sql` — **new** —
   `ALTER TABLE legendary.competitive_scores ADD COLUMN outcome text NULL
   CHECK (outcome IN ('heroes-win','scheme-wins'))`; idempotent
   (`IF NOT EXISTS` guard pattern per prior migrations).
2. `apps/server/src/competition/competition.types.ts` — **modified** —
   `CompetitiveScoreRecord` gains `outcome: 'heroes-win' | 'scheme-wins' | null`;
   a canonical readonly `COMPETITIVE_OUTCOMES` array pinned to the union by
   a drift test.
3. `apps/server/src/competition/competition.logic.ts` — **modified** — the
   verify+score pipeline reads the reduced final state's gameover outcome
   and writes it in the INSERT; row immutability (D-5302) unchanged.
4. `apps/server/src/competition/competition.logic.test.ts` — **modified** —
   DB-gated: a winning submission persists `heroes-win`; a losing
   submission persists `scheme-wins`; the drift test for
   `COMPETITIVE_OUTCOMES`.
5. `apps/server/src/legends/gauntlet.logic.ts` — **new** —
   `buildGauntletCatalog(registrySets)` + `getGauntletStandings(database,
   gauntletDefinition)` per the Contract below.
6. `apps/server/src/legends/gauntlet.logic.test.ts` — **new** — catalog
   derivation (≥1-scheme rule, slug pass-through, exclusion of schemeless
   sets) + DB-gated standings (inclusion/exclusion matrix).
7. `apps/server/src/legends/legends.types.ts` — **modified** — snapshot,
   index, and additive manifest shapes per the Contract.
8. `apps/server/src/legends/legends.publisher.ts` — **modified** — emit
   gauntlet boards + `gauntlet-index.json`; manifest gains the additive
   fields; manifest still written last (D-14204).
9. `apps/server/src/legends/legends.publisher.test.ts` — **modified** —
   gauntlet emission paths + existing assertions preserved byte-compatible.
10. `apps/server/src/server.mjs` — **modified** — build the catalog from
    the startup registry; pass it into the publisher wiring.

Governance files (`DECISIONS.md` status note, `WORK_INDEX.md` check-off,
`STATUS.md` entry) are updated at close per the Definition of Done, not
listed above.

---

## Contract

Locked by **D-24131** — restated here for execution convenience;
DECISIONS.md wins on any divergence.

- **Gauntlet identity.** One gauntlet per (set `abbr` × mastermind `slug`)
  for every set packaging ≥1 scheme. A set with zero schemes hosts no
  gauntlets (at current data: `dims` masterminds excluded; `3dtc` has
  neither). Legs = the set's schemes (3–8 legs at current data).
- **Slug space.** Catalog slugs come from registry `slug` fields (set
  `abbr` per D-10014); `scenario_key` parsing splits on `::` (positions:
  scheme, mastermind). Slugs are set-stripped in `scenario_key`, so a slug
  shared by two sets is one identity in score-space; a leg qualifies for a
  gauntlet when **both** its `schemeSlug` and `mastermindSlug` belong to
  that gauntlet's set (both-sides-same-set rule).
- **Qualifying row (a "leg").** `outcome = 'heroes-win'` (a `NULL` legacy
  row never qualifies) **and** the row's `scoring_config_version` equals
  the currently-published version for its `scenario_key` (VISION §22 —
  never compare across versions). Any villain groups. Best (lowest)
  `final_score` per leg wins the leg slot.
- **Standings entry.** Complete gauntlets only (a best winning score on
  *every* leg). `totalScore` = sum of best-per-leg `final_score`s (integer);
  `averageScoreCentis` = `Math.round(totalScore * 100 / legCount)` (integer,
  centesimal per the weights precedent); rank by `totalScore ASC`, then
  `handle ASC`. Handle/display name attaches via the existing read-layer
  JOIN discipline (identity keys on `player_id`, never handle —
  DESIGN-RANKING).
- **Snapshot shapes** (all JSON-serializable, `schemaVersion: 1`):
  - Board file `legends/v1/gauntlet-<setAbbr>-<mastermindSlug>.json`:
    `{ board, entries: GauntletSnapshotEntry[], rowCount, schemaVersion }`
    with `GauntletSnapshotEntry = { handle, rank, totalScore, legCount,
    averageScoreCentis }`.
  - Index file `legends/v1/gauntlet-index.json`:
    `{ gauntlets: [{ setAbbr, setName, mastermindSlug, mastermindName,
    legCount, entryCount, board }], generatedAt, schemaVersion }` — lists
    **every** catalog gauntlet (including zero-entry ones; `entryCount: 0`),
    so the future index UI can render "unclaimed" boards.
  - Manifest (additive, old clients unaffected): `gauntletBoards?: string[]`
    (only boards actually written this cycle) and
    `gauntletIndex?: "gauntlet-index"`. `boards[]` and `schemaVersion`
    unchanged. Gauntlet boards with zero complete entries are **not**
    written as board files (the index carries them).
- **Publisher ordering.** All gauntlet board files and the index are
  written before `manifest.json` (D-14204 manifest-last preserved).

---

## Non-Negotiable Constraints

**Engine-wide:** ESM only, Node v22+. Human-style code — see
`docs/ai/REFERENCE/00.6-code-style.md` (full English names, `is/has/can`
booleans, JSDoc on every function, ≤30-line functions, `// why:` on
non-obvious decisions, full-sentence error messages). Full file contents
for every new or modified file — no diffs, no snippets, no "show only the
changed section". Test files `.test.ts` with `node:test` + `node:assert`
only; DB-dependent tests use the existing non-silent skip when
`TEST_DATABASE_URL` is unset. No new npm dependencies.

**Packet-specific:**
- `packages/game-engine/**` is read-only this session (type imports of
  `EndgameOutcome` semantics are described, not imported — the server
  mirrors the two-value closed set locally per the existing mirrored-types
  discipline in `legends.types.ts`).
- No `boardgame.io` import in any new file; the reduced-state gameover is
  reached through the existing WP-334/WP-336 replay module seams.
- `apps/server` continues to import the registry only at startup wiring
  (`server.mjs`); `gauntlet.logic.ts` receives plain data (catalog /
  definitions), never a live registry handle.
- No `Math.random()`, no wall-clock reads inside logic functions —
  `generatedAt` comes from the publisher's existing timestamp source.
- `.reduce()` is not used for the standings aggregation — explicit
  `for...of` per code-style rules.
- The `competitive_scores` INSERT remains write-once (D-5302); `outcome` is
  written at insert, never updated.
- Existing snapshot/manifest fields are byte-compatible: no field renamed,
  removed, or re-typed; additions are optional fields only.
- SQL uses the existing `pg` pool patterns (parameterized queries only).
- **No new environment variables** — the publisher's existing
  `LEGENDS_PUBLISHER_ENABLED` / R2 configuration (documented in
  `render.yaml`) is unchanged; `.env.example` needs no edit.
- **No authentication change** — the submit route's
  `authenticated-session-required` posture is untouched (§11 N/A).

**Session protocol:** stop and ask on any unclear item; if the PAR
publication store's version-lookup surface differs from what `Assumes`
describes, STOP and reconcile against WP-050/WP-051 before writing the
version filter.

**Locked contract values:** the Contract section above (D-24131); the
`outcome` closed set `'heroes-win' | 'scheme-wins'`; board-file naming
`gauntlet-<setAbbr>-<mastermindSlug>.json`; manifest field names
`gauntletBoards` / `gauntletIndex`.

---

## Acceptance Criteria

1. Migration `026_add_outcome_to_competitive_scores.sql` exists, is
   idempotent (safe to re-run), and adds `outcome text NULL` with the
   two-value CHECK constraint.
2. A DB-gated test proves a winning submission persists
   `outcome = 'heroes-win'` and a losing submission persists
   `outcome = 'scheme-wins'` on the inserted row.
3. `COMPETITIVE_OUTCOMES` canonical array exists and a drift test pins it
   to the union type (both directions).
4. `buildGauntletCatalog` returns one `GauntletDefinition` per
   (set × mastermind) for sets with ≥1 scheme, with slugs passed through
   from registry data; a unit test proves a schemeless set contributes
   zero gauntlets and a multi-mastermind set contributes one per
   mastermind.
5. `getGauntletStandings` (DB-gated test matrix): a player with winning
   best scores on all legs appears with correct `totalScore` /
   `averageScoreCentis`; a player missing one leg is absent; a player
   whose only row on a leg is a loss is absent; a row at a
   non-current `scoring_config_version` does not qualify; ranking is
   `totalScore ASC, handle ASC`.
6. The publisher writes `gauntlet-<setAbbr>-<mastermindSlug>.json` only for
   gauntlets with ≥1 complete entry, always writes `gauntlet-index.json`
   (every catalog gauntlet listed with `entryCount`), and writes
   `manifest.json` last with additive `gauntletBoards` + `gauntletIndex`
   fields; publisher tests assert ordering and the empty-standings path.
7. Existing publisher outputs are unchanged in shape: prior
   `legends.publisher.test.ts` assertions pass without modification to
   their expected values (additive-only manifest).
8. `git diff --name-only` shows only the 10 listed files (plus governance
   files per DoD).
9. `pnpm -r build` exits 0; the `apps/server` no-DB suite passes; DB-gated
   suites pass against a local `TEST_DATABASE_URL` with migration 026
   applied.

---

## Verification Steps

```bash
# 1. Build everything (expect exit 0)
pnpm -r build

# 2. Server suite, no-DB portion (expect green; DB-gated tests report the
#    non-silent skip when TEST_DATABASE_URL is unset)
pnpm --filter @legendary-arena/server test

# 3. Apply the migration to the local test database, then run DB-gated
#    (expect: outcome persistence tests + gauntlet standings matrix green)
#    PowerShell (the project shell):
#      psql $env:TEST_DATABASE_URL -f data/migrations/026_add_outcome_to_competitive_scores.sql
#      $env:TEST_DATABASE_URL = "<local legendary_arena URL from .env>"; pnpm --filter @legendary-arena/server test

# 4. Scope check (expect: exactly the 10 listed files + governance)
git diff --name-only

# 5. Engine untouched (expect: empty)
git diff --name-only -- packages/game-engine
```

Expected key outputs are stated inline; any red that reproduces on the
baseline commit is pre-existing and reported, not silently absorbed.

---

## Vision Alignment

**Vision clauses touched:** §20, §21, §22, §24, §26 (PAR-based scenario
scoring and leaderboards); §3, §11 (player identity); NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses.
The gauntlet is a derived aggregation over replay-verified rows — §24 is
strengthened (only verified `heroes-win` rows qualify); §22 is enforced
structurally by the currently-published-version filter; identity keys on
`player_id` per §3/§11 and DESIGN-RANKING; NG-1 is untouched (standings
confer recognition only, no gameplay power).

**Non-Goal proximity check:** none of NG-1..7 are crossed — no paid
surface, no persuasion surface, no gameplay-affecting reward.

**Determinism preservation:** the change is deterministic and
replay-faithful (Vision §22): no engine code, no RNG, no replay or hash
change; `outcome` is derived from the same reduced final state the
verifier already computes; aggregation is a pure function of stored rows
plus registry data.

## Funding Surface Gate

N/A — server-side aggregation and snapshot publishing only; no UI
surfaces, no user-visible copy, and no funding channels referenced
(§20.1 trigger surfaces absent).

## API Catalog (§21)

N/A — no HTTP endpoint is added, modified, removed, or re-statused, and no
catalog-recorded `Library-only` function changes; the new gauntlet
functions are publisher-internal wiring, not import surfaces recorded in
`api-endpoints.md`.

---

## User-Visible Impact

None — infrastructure. The payoff is named: this packet makes the
D-24131 gauntlet standings exist as published R2 artifacts so the
backlogged legends-board index/panel WP (public boards) and
profile-progress WP (personal checklist + badges) have real data to
render. STATUS.md entry must state "No user-observable change —
infrastructure only."

---

## Definition of Done

- [ ] All Acceptance Criteria pass (1–9 above).
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change —
      infrastructure only" and names the two follow-up consumer WPs.
- [ ] `docs/ai/DECISIONS.md` D-24131 annotated with the execution date and
      any execution-discovered addenda.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — this packet checked off with
      the standard close summary.
- [ ] No files outside `## Files Expected to Change` (plus the governance
      files above) were modified.
- [ ] Migration 026 applied to the production database is recorded as an
      operator-pending step (deploy note), mirroring the 024/025 pattern.
