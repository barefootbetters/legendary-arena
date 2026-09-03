# EC-675 — LAGN 1.5.0: Battle Plan + Report Card (Contract) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-640-lagn-1-5-0-battleplan-report.md
**Layer:** Cross-cutting contract package (`packages/lagn-spec`)

## Before Starting

- [ ] On `main`, clean, fast-forward synced; `origin/main` baseline recorded in the WP.
- [ ] Read the 1.4.0 add as the template: `validator.ts` (the players/scoring_profile `.refine()` gate ~711-725, the `UNEXPRESSIBLE_CONSTRAINTS` entries ~914-926, `EXPECTED_REFINEMENT_COUNT`), `migrate.ts` (the `migrate_1_3_0_to_1_4_0` restamp + registry), `validator.test.ts` (the `countRefinementNodes` gate + the enum re-pin array + the `fixtures` array), `examples/tier1-players.lagn.json`.
- [ ] Confirm the `ScoreGrade` values on `main`: `packages/game-engine/src/scoring/parScoring.grade.ts` → `'legendary' | 'a' | 'b' | 'c' | 'd' | 'f'`.
- [ ] `pnpm --filter @legendary-arena/lagn test` + `pnpm -r build` exit 0 (baseline; record the test count).

## Locked Values (do not re-derive)

- **`LAGN_VERSION` STAYS at 1.4.0** (reader-only; the writer flip is the producer packet). Do NOT bump it or `package.json` (AC-10 / WP-405 precedent).
- Version string verbatim `1.5.0`; constant `LAGN_VERSION_1_5_0`; appended at the end (newest-last) of `LAGN_SUPPORTED_VERSIONS`; also re-export `LAGN_VERSION_1_5_0` from `index.ts` (WP-405 precedent).
- The score fields SOURCE (producer's, noted for accuracy): `raw_score`/`par_score`/`final_score`/`scoring_config_version` mirror `ScoreBreakdown` fields; `grade` is the derived `ScoreGrade` (`gradeForFinalScore`); `par_version` = the persisted `competitive_scores.par_version` column — NOT a `ScoreBreakdown` field, do not hunt for one. The contract only permits the shape.
- `battle_plan` at the **document root** (NOT under `setup`/`result`): `{ pre_battle?: string, battle_adjustments?: string, post_battle?: string }`, all optional; the block itself `.optional()`.
- `result.score` **nested in `result`**: `{ raw_score: int, par_score: int, final_score: int, grade: z.enum(['legendary','a','b','c','d','f']), scoring_config_version: int, par_version: string }`, `.optional()`. Ints are `z.number().int()`.
- `grade` enum matches `ScoreGrade` EXACTLY — do NOT invent labels; the display strings ("Legendary"/"A"…) live client-side, the enum carries the codes.
- **ONE combined** ordinal version gate (like the 1.4.0 players/scoring_profile gate): `isLagnVersionAtLeast(data.lagn_version, LAGN_VERSION_1_5_0) || (data.battle_plan === undefined && data.result?.score === undefined)`. Message verbatim: `battle_plan and result.score require lagn_version 1.5.0 or later — an earlier document cannot carry a battle plan or a report card`. `path: ['battle_plan']`.
- ONE new `UNEXPRESSIBLE_CONSTRAINTS` entry → `EXPECTED_REFINEMENT_COUNT` rises by exactly **1** (no internal-consistency superRefine — the blocks have no cross-field rule beyond the version gate).
- Fixture filename verbatim: `examples/tier1-battle-plan-report.lagn.json` (`lagn_version: "1.5.0"`, both blocks).
- Root `$schema` stays `https://json-schema.org/draft/2020-12/schema`.

## Guardrails

- **Additive only.** Every 1.0.0–1.4.0 document valid today MUST still validate.
- **Non-authoritative, forbidden as an input.** `battle_plan` / `result.score` must NOT be wired into scoring/credit/ranking/verification anywhere — reading them as authority reopens the D-5301 trust hole (D-24214/D-24215 posture). This packet touches only `packages/lagn-spec` + docs; NO server/engine code.
- **Grade is a stored snapshot, not re-derived.** The contract validates the enum value; it does not recompute a grade from `final_score`.
- The new `.refine()` node MUST get its `UNEXPRESSIBLE_CONSTRAINTS` entry **in the same edit**, or the `ZodEffects` count gate fails the build (1:1 with refinement NODES).
- Extend the **version-enum re-pin** — the inline literal inside the `published contract fields survive derivation` test (`validator.test.ts` ~L923-929) — to include `LAGN_VERSION_1_5_0`, and add that constant to the test's import block (~L6-19). Otherwise the committed-schema `lagn_version.enum` test fails.
- Append the new fixture filename to the `fixtures` array (`validator.test.ts` ~L990) — the single ajv+zod loop consumes it; that one array entry is the whole edit.
- Do NOT hand-edit `schemas/lagn-v1.json`; run `generate:schema`.
- `lagn_version` stays **required**; no `z.any()`; no new package dependency; no `.strict()`.
- The 1.4.0 → 1.5.0 migration is a pure restamp — synthesizes nothing; registered but unreachable until the producer flips the writer.

## Required `// why:` Comments

- `LAGN_VERSION_1_5_0` JSDoc: why 1.5.0 not 1.4.0 (1.4.0 is allocated to players/scoring_profile, D-24214/24215).
- The combined version gate: the silent-strip hazard (schema is not `.strict()`; an ungated block on a pre-1.5.0 doc vanishes on parse) + ordinal (D-24211).
- `result.score.grade`: why the enum is a frozen snapshot of the operator-tunable `ScoreGrade` banding, not re-derived (a result-LAGN records what was earned then).
- `battle_plan`: why DESCRIPTIVE-only + why (in the producer's discipline, noted here) it belongs in the result-LAGN, never the `?lagn=` share link.
- `migrate_1_4_0_to_1_5_0`: pure restamp, synthesizes nothing; REGISTERED BUT UNREACHABLE until the writer flips. Write the `// why:` against the TRUE current writer — "…targets `LAGN_VERSION`, which stays **1.4.0** here" — do NOT copy the stale `migrate_1_3_0_to_1_4_0` template comment, which still says "stays 1.1.0" (pre-existing drift; do not propagate it).

## Files to Produce

- `packages/lagn-spec/src/validator.ts` — **modified** — const + `battle_plan` + `result.score` + combined gate + 1 allowlist entry
- `packages/lagn-spec/src/migrate.ts` — **modified** — `migrate_1_4_0_to_1_5_0` restamp + registry entry
- `packages/lagn-spec/src/types.ts` — **modified** — inferred `BattlePlan` + `ResultScore`
- `packages/lagn-spec/src/index.ts` — **modified** — re-export `BattlePlan` + `ResultScore` types + the `LAGN_VERSION_1_5_0` constant
- `packages/lagn-spec/src/validator.test.ts` — **modified** — gate accept/reject cases + enum re-pin + fixture registration + refinement count
- `packages/lagn-spec/examples/tier1-battle-plan-report.lagn.json` — **new** — 1.5.0 fixture (both blocks)
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated (`generate:schema`)
- `wiki/lagn-v1.md` — **modified** — 1.5.0 read column + block docs + constraint enumeration
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — new field names
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `POST /api/me/loadouts` row replaced WHOLE (D-11804): (a) accepted-versions list gains `1.5.0`, (b) append the pre-1.5.0 `battle_plan`/`result.score` → `400 invalid_lagn` narrowing sentence, (c) preserve the writer-stays-1.4.0 tail unchanged

## After Completing

- [ ] `pnpm --filter @legendary-arena/lagn test` 0 fail (count recorded); `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] `generate:schema` + `git diff --exit-code -- packages/lagn-spec/schemas/` clean; committed schema `lagn_version.enum` includes `1.5.0`
- [ ] `packages/lagn-spec/package.json` untouched (AC-10)
- [ ] `docs/ai/DECISIONS.md` — create D-24452 Active (post-execution)
- [ ] `docs/ai/STATUS.md` — infrastructure-only line; `WORK_INDEX.md` WP-640 checked off; `EC_INDEX.md` EC-675 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝 → ✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells

- Build red on `EXPECTED_REFINEMENT_COUNT` → the new `.refine()` landed without its `UNEXPRESSIBLE_CONSTRAINTS` entry (or vice versa).
- The committed-schema enum test fails → the re-pin array in `validator.test.ts` wasn't extended to `1.5.0`.
- `schemas/lagn-v1.json` diff dirty in CI → you hand-edited it or forgot `generate:schema`.
- A pre-1.5.0 fixture newly fails → an existing example carried a shape the new gate now rejects (fold into scope) — OR the gate is keyed on the wrong nesting (`result.score`, not a root `score`).
- `package.json` shows in the diff → you bumped it; revert (the writer isn't flipping here).
- The grade enum drifts from `ScoreGrade` → hard-code the same six codes; a mismatch means the client can't render a value the contract permits.
