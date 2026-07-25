# WP-422 — Seed PAR Publication (Turn On Competitive Submissions, Day-One Coverage)

**Status:** Draft 2026-07-24 · **PROPOSED (WP-422; highest landed WP is 421)** · **Standard two-session lane** (registry schema + content data authoring + an authoring-time generation script + committed data artifacts + a product-judgment rating pass). Pairs with **EC-457** (authored). Reserves **D-24242** (lands at execution). **DRAFT — not yet executed.**
**Primary Layer:** Registry (schema + content difficulty data) + Shared Tooling (an authoring-time generation script) + committed data artifacts (`data/scoring-configs/`, `data/par/seed/`). No runtime engine/server code change — the server already reads the index it produces.
**User-Visible Surface:** `legends.legendary-arena.com` + all gauntlet boards + in-match score submission — competitive scoring **turns on** (today every submission fail-closes `par_not_published` and every board is empty). **D-24026 live-verify APPLIES** (after deploy, a completed competitive match records a score and a board fills).
**Dependencies:** WP-048 ✅ (scoring config + PAR types), WP-049 ✅ (sim engine — not used here, but the storage/index API it shares), WP-050 ✅ (`buildParIndex`/`writeSeedParArtifact`/`loadParIndex`), WP-051 ✅ (the server PAR gate that reads the index), WP-054 ✅ (leaderboards that fill once scores exist). No hard-dep WP in flight.
**Baseline:** `origin/main` @ `1f22feae` (capture `git rev-parse origin/main` at execution).

---

## Goal

Turn on the competitive surface. Investigation (2026-07-25) found the whole competitive
surface is dark for a single reason: the **PAR index was never generated or delivered.** The
server gate (`apps/server/src/par/parGate.mjs`) reads `data/par/{sim,seed}/v1/index.json` from
disk; those files were never committed, there is no build/CI step that produces them, and no
runnable generator exists. So every submission fail-closes `par_not_published`,
`legendary.competitive_scores` stays empty, and the Legends board + all 110 gauntlet boards
cannot fill regardless of play volume (this is the documented "sole remaining blocker on the
whole competitive surface"). This packet publishes the **content-driven Seed PAR** (VISION §26
Phase 1 / `docs/12-SCORING-REFERENCE.md §Phase 1`) — the deliberate ~60–70%-accurate day-one
tier that lights up the boards immediately; simulation calibration (Phase 2) is a later follow-up.

---

## User-Visible Impact

A player who finishes a competitive match now sees their score submitted and appears on the
relevant board; the Legends board and gauntlet boards fill as matches complete. Nothing about
gameplay changes — only that scores are now scored against a published PAR instead of rejected.

---

## Assumes

- **The gate + storage + leaderboards already shipped** — the server reads
  `data/par/seed/v1/index.json` via `loadParIndex`, exactly like `loadRegistry('data/cards')`;
  delivering the index is a committed-data problem, not new infra. (Verified — parGate.mjs,
  par.storage.ts, WP-051/054.)
- **The Seed PAR formula is fully specified** in `docs/12-SCORING-REFERENCE.md §Phase 1`:
  `PAR_seed = BasePAR(12000) + Mastermind×1200 + Scheme×1000 + ΣVillainGroup×600 +
  PlayerCountAdj×500`, driven by an integer **Difficulty Rating (1–10)** per
  mastermind/scheme/villain-group. (Verified.)
- **Difficulty ratings do NOT exist yet** — `parDifficultyRating` was intentionally excluded from
  the theme schema v2 (`packages/registry/src/theme.schema.ts:109`, D-5508 "PAR does not exist
  yet"); `grep difficultyRating data/` → 0. So they must be added + authored here. (Verified.)
- **Per-scenario scoring configs do NOT exist** — `data/scoring-configs/` holds only a README +
  one *test* config. A `ScenarioScoringConfig` (weights + caps + penalties + `parBaseline`) must
  be produced per competitive scenario; `computeParScore(config)` turns the `parBaseline` into
  the artifact's `parValue`. (Verified — scoringConfigLoader.ts, parScoring.logic.ts.)
- **Delivery = commit the generated `data/par/seed/` + `data/scoring-configs/` to the repo**, the
  same model as `data/cards`/`data/metadata`. (Verified — loadParIndex reads local fs.)

---

## Context (Read First)

- `docs/12-SCORING-REFERENCE.md §Phase 1` — the authoritative Seed PAR formula + constants + the
  1–10 difficulty scale semantics; `§Phase 2` for what a later calibration WP supersedes.
- `wiki/par-simulation-calibration.md` — names this as the sole competitive blocker.
- `packages/registry/src/theme.schema.ts` — where `difficultyRating` is added (reversing D-5508).
- `packages/game-engine/src/scoring/parScoring.types.ts` — `ScenarioScoringConfig`, `ScoringWeights`,
  `ScoringCaps`, `PenaltyEventWeights`, `ParBaseline`; `parScoring.logic.ts` — `computeParScore`,
  `validateScoringConfig` (the structural invariants any default weights MUST satisfy).
- `packages/game-engine/src/simulation/par.storage.ts` — `writeSeedParArtifact`, `buildParIndex`,
  `scenarioKeyToFilename`/`Shard` (the on-disk layout the script must match).
- `apps/server/src/competition/competition.logic.ts` — `buildScenarioKey` (the scenario identity
  the index is keyed by) + the `par_not_published` fail-closed path this unblocks.
- **Split question (resolve at pre-flight):** this touches registry (schema+data) + tooling +
  committed artifacts + a product rating pass. If pre-flight judges it too large, split into
  **WP-422a** (difficultyRating schema + first-pass ratings) → **WP-422b** (generation + delivery).
  Drafted as one arc; the Assumes chain makes the split mechanical.

---

## Non-Negotiable Constraints

- **Seed only — no simulation.** No Monte-Carlo run; PAR comes from the content formula. Phase-2
  calibration is explicitly out of scope (a later WP).
- **The formula + constants are locked to `docs/12-SCORING-REFERENCE.md §Phase 1`** — do not invent
  new constants; if a constant must change, update `docs/12` first with a D-entry.
- **Global default weights/caps/penalties** (one set for all scenarios v1) MUST satisfy every
  `validateScoringConfig` structural invariant (e.g., `bystanderReward > villainEscaped`,
  `bystanderLost > bystanderReward`) — the generator fails loudly otherwise.
- **Difficulty ratings are a reviewable product artifact** — authored as a transparent, documented
  first-pass table (banded defaults + per-item values), version-controlled, and surfaced for Jeff's
  review before the generated index is committed. Ratings are content data, never hard-coded logic.
- **Immutability** — PAR artifacts are write-once (`writeSeedParArtifact` refuses overwrite); a
  re-generation targets a new `parVersion` directory, never an in-place edit.
- **Determinism** — generation is a pure function of (ratings, formula constants, default config +
  scenario list); re-running produces byte-identical artifacts (sorted keys, stable hashing).
- **No runtime engine/server code change** — the server already loads the index; this packet only
  produces + commits data. Registry schema gains one optional additive field.

---

## Scope (In)

### A) `difficultyRating` schema + rubric-authored ratings (registry)
- Add an integer `difficultyRating` (1–10) to the mastermind / scheme / villain-group / henchman-group
  content schema (the theme schema v2 surface that deferred it, D-5508), additive + optional (so
  existing data validates), with a validator bound (1 ≤ n ≤ 10) **plus the auditable `subscores`
  basis object** (the five 0–4 rubric dimensions per type).
- Author the rating for every competitive mastermind/scheme/group across the 41 sets **per the
  rubric methodology** in [`wiki/par-simulation-calibration.md` §Phase 1](../../../wiki/par-simulation-calibration.md)
  (locked in D-24242): each entity scored from its five type-specific 0–4 dimensions →
  `clamp(1,10,ceil(rawTotal/2))`, `5` = baseline; every rating carries its `subscores` basis. The
  rating VALUES + sub-scores are the product-judgment deliverable Jeff reviews. Community difficulty
  research + the v23 rules are **anchor validation only**, never canonical scores.

### B) Scenario composition + scoring-config defaults + difficulty→baseline mapping (design, documented)
- **Scenario difficulty** is composed at scenario time (entity ratings are never scenario ratings):
  `0.40·mastermindDifficulty + 0.40·schemeDifficulty + 0.20·avg(villainGroupDifficulties)` plus an
  **explicit, enumerable** `synergyAdjustment` (`-2.0…+2.0`, each with a `reasonCode`), then
  `clamp(1,10,round(...))`.
- Define the **global default** `weights` / `caps` / `penaltyEventWeights` (v1, one set) satisfying
  `validateScoringConfig`.
- Define the documented mapping from `scenarioDifficulty` (+ the `docs/12 §Phase 1` formula) → the
  scenario `ParBaseline` (`roundsPar`/`victoryPointsPar`/`bystandersPar`/`escapesPar`) such that
  `computeParScore` yields a PAR consistent with that formula. **This mapping is the primary
  execution design task** — resolve it against `parScoring.logic.ts` and record it in D-24242.
- Stamp seed artifacts `source:'seed'` / `calibrationStatus:'uncalibrated'` + `difficultyRatingVersion`
  so a later simulation pass supersedes them (records `seedParDelta`; never silently rewrites a seed).

### C) Generation + delivery script (`scripts/generate-seed-par.mjs`, new — Shared Tooling)
- Enumerate the competitive scenarios (`buildScenarioKey` over the scheme × mastermind × villain-group
  [× player-count] scope — the gauntlet catalog's scenarios at minimum; the exact scope is a locked
  Scope decision at execution).
- For each: read difficulty ratings from the registry, build the `ScenarioScoringConfig` (defaults +
  mapped baseline), `writeSeedParArtifact` (+ the scoring config under `data/scoring-configs/`),
  then `buildParIndex('data/par','seed',parVersion)` → `data/par/seed/v1/index.json`.
- Commit the generated `data/scoring-configs/**` + `data/par/seed/**`.

### D) Verification
- A committed `data/par/seed/v1/index.json` covering the competitive scope; the server, on boot,
  logs `PAR seed index unavailable … continuing with … ` → instead `PAR index loaded: N scenarios`.
- A unit/integration test that the generator is deterministic (re-run byte-identical) and that a
  representative scenario resolves through `checkParPublished` to a non-null hit with `source:'seed'`.

---

## Out of Scope

- **Phase-2 simulation calibration** (Monte-Carlo sim index) — a later follow-up WP; seed is superseded once calibrated.
- **Any runtime engine/server code change** — the gate/leaderboards already consume the index.
- **Re-tuning the scoring formula or weights beyond the documented v1 defaults** — a separate design WP.
- **Per-player-count PAR beyond the documented adjustment** — v1 uses the formula's `PlayerCountAdjustment`.
- **Hero-difficulty or hero-dependent PAR** — PAR is scenario-only (VISION §26).

---

## Files Expected to Change

- `packages/registry/src/theme.schema.ts` (+ any validator) — **modified** (`difficultyRating` field)
- Content data files carrying the ratings — **modified/new** (the authored ratings; exact files located at execution)
- `scripts/generate-seed-par.mjs` — **new** (authoring-time generator; Shared Tooling)
- `data/scoring-configs/**` — **new** (generated per-scenario configs)
- `data/par/seed/v1/**` — **new** (generated artifacts + `index.json`, committed)
- A generator test — **new**
- `docs/ai/STATUS.md` — **modified**; Governance: `WORK_INDEX.md` (WP-422) + `DECISIONS.md` (**D-24242**) + `EC_INDEX.md`/EC-457 + `docs/05-ROADMAP-MINDMAP.md` node, at execution.

> No `api-endpoints.md` change (§21 N/A — no HTTP surface change; the existing submission/leaderboard endpoints simply stop fail-closing).

---

## Contract

| Key | Value |
|---|---|
| PAR source | content Seed PAR (`docs/12 §Phase 1`); NO simulation |
| Formula | `BasePAR 12000 + Mastermind×1200 + Scheme×1000 + ΣVillainGroup×600 + PlayerCountAdj×500` (locked to docs/12) |
| Difficulty input | integer 1–10 per mastermind/scheme/villain-group, added to the schema (reverses D-5508), authored first-pass (reviewable) |
| Config | global default weights/caps/penalties (satisfy `validateScoringConfig`) + difficulty→`ParBaseline` mapping; `parValue = computeParScore(config)` |
| Delivery | commit `data/scoring-configs/**` + `data/par/seed/v1/**` to the repo (loadParIndex reads local fs) |
| Determinism | re-generation byte-identical; artifacts write-once (new `parVersion` to re-publish) |
| Turns on | server logs `PAR index loaded`; submissions stop returning `par_not_published`; boards fill |
| Runtime code | none — data + one additive schema field + one tooling script only |

---

## Acceptance Criteria

1. `difficultyRating` (1–10) is an additive, validated field on the mastermind/scheme/villain-group schema; existing data still validates (**AC-1**).
2. Every competitive mastermind/scheme/group carries an authored first-pass rating, in a documented, reviewable table (**AC-2**).
3. `scripts/generate-seed-par.mjs` deterministically produces `data/scoring-configs/**` + `data/par/seed/v1/**` (index + artifacts); re-run is byte-identical; artifacts are write-once (**AC-3**).
4. The default `ScenarioScoringConfig` satisfies every `validateScoringConfig` invariant; `computeParScore` yields a PAR consistent with the `docs/12 §Phase 1` formula for a spot-checked scenario (**AC-4**).
5. On boot the server logs `PAR index loaded: N scenarios` (seed), and a representative scenario resolves through `checkParPublished` to a non-null `source:'seed'` hit (**AC-5**).
6. `pnpm -r build` clean; `pnpm -r --no-bail test` green repo-wide (incl. the new generator test) (**AC-6**).
7. Live (D-24026, post-deploy): a completed competitive match records a `competitive_scores` row and the relevant board fills; operator-pending on deploy (**AC-7**).

---

## Verification Steps

```pwsh
node scripts/generate-seed-par.mjs --version v1        # writes data/scoring-configs + data/par/seed/v1
node scripts/generate-seed-par.mjs --version v1        # re-run: byte-identical (git diff clean)
Get-Content data\par\seed\v1\index.json | Select-String "scenarioCount"
pnpm -r build; pnpm -r --no-bail test
# boot the server locally (or read the deploy log): expect "PAR index loaded: N scenarios"
git status  # data/scoring-configs/** + data/par/seed/** are new committed artifacts
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `difficultyRating` schema field added (additive, validated); existing data validates
- [ ] First-pass ratings authored for every competitive item, documented + reviewed
- [ ] Generator produces committed `data/scoring-configs/**` + `data/par/seed/v1/**`; deterministic; write-once
- [ ] Default config satisfies `validateScoringConfig`; PAR consistent with docs/12 formula
- [ ] Server logs `PAR index loaded`; `checkParPublished` non-null for a representative scenario
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide
- [ ] `DECISIONS.md` **D-24242** landed (difficulty→baseline mapping + default weights + delivery model); `WORK_INDEX` (WP-422) + `EC_INDEX`/EC-457 + mindmap + `STATUS.md` updated
- [ ] Live-verify (D-24026, operator-pending on deploy): a competitive match records a score; a board fills
- [ ] No files outside `## Files Expected to Change` were modified

---

## Vision Alignment

**Vision clauses touched:** §26 (PAR / competitive scoring — the three-phase pipeline; this ships
Phase 1). **Conflict assertion:** No conflict — turns on the intended competitive surface; no
gameplay/determinism change. **Non-Goal check:** NG — no pay-to-win, no gameplay change; PAR is
scenario-only, never hero-dependent. **Determinism:** generation is deterministic; runtime scoring
already deterministic (unchanged).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. Highlights — §5 standard lane (schema + data authoring + tooling +
committed artifacts; split-vs-single flagged for pre-flight); §8 layers (registry schema/data +
Shared-Tooling script + committed data; the script reads registry + engine `/setup` at authoring
time, never at runtime — no runtime engine/server change); §11 persistence (committed data artifacts,
not DB); §21 N/A (no HTTP change); §15.1 APPLIES (D-24026 boards-fill post-deploy); §17 §26 (ships
Phase 1). §22 determinism (generation byte-identical).

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight: READY (with a split flag).** Deps all on `main` (gate/storage/leaderboards); the fix is
data + one additive field + one script; no hard-dep WP in flight. **Open at pre-flight:** (a) the
split-vs-single decision (§Context); (b) the exact competitive scenario scope (gauntlet catalog vs a
broader matrix); (c) the difficulty→`ParBaseline` mapping (Scope B — the primary design task). These
are execution-resolvable and recorded in D-24242; none blocks drafting.

**Copilot: PASS.** Failure modes pinned: (a) inventing PAR out of formula → **locked to docs/12
§Phase 1, AC-4**; (b) default weights violating structural invariants → **validateScoringConfig
guards, generator fails loudly, AC-4**; (c) non-deterministic artifacts → **sorted keys + stable
hash, re-run byte-identical, AC-3**; (d) overwriting immutable artifacts → **write-once, new
parVersion, AC-3**; (e) undifferentiated PAR (flat ratings) → **documented banded first-pass,
reviewed, AC-2**; (f) scope creep into simulation → **seed-only, Phase-2 explicitly deferred**.

## Decision (reserved, lands at execution)

Reserves **D-24242**: competitive PAR is turned on via the **content-driven Seed PAR** (VISION §26
Phase 1) — a `difficultyRating` (1–10) is added to the mastermind/scheme/villain-group schema
(reversing D-5508's deferral) and authored first-pass; a deterministic authoring-time generator
(`scripts/generate-seed-par.mjs`) maps ratings → a `ScenarioScoringConfig` (documented global default
weights/caps/penalties + a difficulty→`ParBaseline` mapping; `parValue = computeParScore`) and writes
write-once `data/scoring-configs/**` + `data/par/seed/v1/**`, **committed to the repo** (the
`loadParIndex`/`loadRegistry` local-fs delivery model). No runtime engine/server change; simulation
calibration (Phase 2) supersedes seed in a later WP. The difficulty→baseline mapping + default weight
values are locked here at execution. Drafted 2026-07-24; not yet landed.
