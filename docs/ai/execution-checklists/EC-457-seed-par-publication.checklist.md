# EC-457 — Seed PAR Publication (Turn On Competitive Submissions) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation (WP-422 / EC-457). **DRAFT — not yet executed.**
> **Source WP:** [WP-422](../work-packets/WP-422-seed-par-publication.md).
> **Lane:** Standard two-session (registry schema + content authoring + tooling + committed artifacts + a product rating pass). **Confirm the split-vs-single decision at pre-flight** (§Context) before executing as one.

**Layer:** Registry (schema + difficulty data) + Shared Tooling (`scripts/generate-seed-par.mjs`) + committed data (`data/scoring-configs/`, `data/par/seed/`)

## Scope (read first)
IN scope: add `difficultyRating` (1–10) to the mastermind/scheme/villain-group schema (reverse
D-5508); author a documented first-pass rating for every competitive item (Jeff reviews the values);
a deterministic generator that maps ratings → `ScenarioScoringConfig` (global default weights + a
difficulty→`ParBaseline` mapping) → write-once `data/scoring-configs/**` + `data/par/seed/v1/**`,
committed. OUT of scope: any Monte-Carlo simulation (Phase 2 = later WP), runtime engine/server code,
formula/weight re-tuning beyond v1 defaults, hero-dependent PAR.

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it (baseline `1f22feae`)
- [ ] **Resolve the split-vs-single decision** (WP §Context) — execute as one WP OR split 422a (schema+ratings) → 422b (generation)
- [ ] Re-read `docs/12-SCORING-REFERENCE.md §Phase 1` — the formula + constants + 1–10 scale are the LOCKED source of truth
- [ ] Confirm the competitive scenario scope (gauntlet catalog vs broader matrix) and lock it as a Scope decision
- [ ] Review `theme.schema.ts:109` (D-5508 deferral being reversed), `scoringConfigLoader.ts`, `parScoring.logic.ts` (`computeParScore`, `validateScoringConfig`), `par.storage.ts` (`writeSeedParArtifact`, `buildParIndex`, `scenarioKeyToFilename`/`Shard`), `competition.logic.ts` (`buildScenarioKey`)
- [ ] `pnpm -r build` then `pnpm -r --no-bail test` green before starting

## Locked Values (do not re-derive)
- Seed PAR formula + constants: `docs/12 §Phase 1` — `BasePAR 12000`, `M_WEIGHT 1200`, `S_WEIGHT 1000`, `V_WEIGHT 600`, `P_WEIGHT 500`, player-count adjustment table; difficulty scale integer 1–10
- `parValue = computeParScore(config)` (applies the Raw Score formula to the `parBaseline`) — NOT a second formula
- Artifact layout: `data/par/seed/<parVersion>/scenarios/<shard>/<scenarioKeyToFilename>.json` + `index.json`; scoring configs at `data/scoring-configs/<scenarioKeyToFilename>.json`
- Delivery: commit `data/scoring-configs/**` + `data/par/seed/**` (loadParIndex reads local fs, like `data/cards`)
- `parVersion` = `v1`; artifacts are WRITE-ONCE (re-publish ⇒ new version dir, never overwrite)
- Default `ScenarioScoringConfig` weights/caps/penalties: ONE global set, satisfying `validateScoringConfig` invariants (documented in D-24242)
- Difficulty→`ParBaseline` mapping: documented in D-24242 (the primary design task)

## Guardrails
- **Seed only** — no simulation/Monte-Carlo; PAR is content-derived
- Default weights MUST satisfy every `validateScoringConfig` structural invariant (`bystanderReward > villainEscaped`; `bystanderLost > bystanderReward`; positive-integer weights) — generator fails loudly otherwise
- Difficulty ratings are content DATA (version-controlled, transparent), never hard-coded logic; authored as a reviewed first-pass table
- Generation is DETERMINISTIC — sorted keys, stable hashing, no `Date.now()` in artifact bodies (or pinned) — re-run byte-identical
- Artifacts WRITE-ONCE — `writeSeedParArtifact` refuses overwrite; never edit an artifact in place
- No runtime engine/server code change; the registry schema field is additive + optional (existing data validates)
- Formula/constants come from `docs/12` — to change one, edit `docs/12` first with a D-entry

## Required `// why:` Comments
- schema — why `difficultyRating` is added now (reverses D-5508; PAR now exists)
- generator — why committed-to-repo delivery (loadParIndex local-fs model, mirrors `data/cards`)
- generator — why write-once + new-version-to-republish (PAR artifact immutability)
- generator — the difficulty→`ParBaseline` mapping rationale (cite D-24242) and why default weights satisfy the invariants

## Files to Produce
- `packages/registry/src/theme.schema.ts` (+ validator) — **modified** — `difficultyRating` 1–10 additive field
- content data files — **modified/new** — authored first-pass ratings (locate exact files at execution)
- `scripts/generate-seed-par.mjs` — **new** — deterministic ratings → configs → artifacts → index
- `scripts/generate-seed-par.test.ts` (or `.mjs` per runner) — **new** — determinism + a `checkParPublished` spot-check
- `data/scoring-configs/**` — **new** (generated, committed)
- `data/par/seed/v1/**` — **new** (generated artifacts + index.json, committed)
- `docs/ai/DECISIONS.md` — **modified** — **D-24242** lands Active (mapping + default weights + delivery)
- `docs/ai/STATUS.md` — **modified** — competitive-surface-on note
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-422 done + `roadmap:counts:write`

## After Completing
- [ ] `node scripts/generate-seed-par.mjs` twice → `git diff` clean the second time (deterministic)
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` green (incl. the generator test)
- [ ] `rg "difficultyRating" packages/registry/src` → schema field present; existing registry data still validates
- [ ] `data/par/seed/v1/index.json` exists + covers the competitive scope; `checkParPublished` non-null (`source:'seed'`) for a spot-checked scenario
- [ ] Server boot log (local or deploy) reads `PAR index loaded: N scenarios`, NOT `unavailable … disabled`
- [ ] Integration (D-24026, post-deploy): a completed competitive match records a `competitive_scores` row; a board fills
- [ ] D-24242 Active; WORK_INDEX/EC_INDEX/mindmap/STATUS updated
- [ ] Commit prefix `EC-457:` (staged files under `packages/registry/`, `scripts/`, `data/`, `docs/`)

## Common Failure Smells
- Server still logs `competitive submissions disabled` → the index isn't at `data/par/seed/v1/index.json`, or wasn't committed
- Generator non-deterministic (git diff churns on re-run) → unsorted keys / a timestamp in the artifact body
- `validateScoringConfig` throws at generation → default weights violate a structural invariant
- Flat/undifferentiated PAR → ratings all the same band (author a real first-pass spread)
- Overwrite error → artifacts are write-once; bump `parVersion` to re-publish
- Registry tests fail on existing data → the schema field wasn't made optional/additive
