# WP-640 — LAGN 1.5.0: Battle Plan + Report Card (Contract)

**Status:** Ready
**Layer:** Cross-cutting contract package (`packages/lagn-spec`)
**Dependencies:** WP-405 ✅ / D-24214 / D-24215 (the 1.4.0 reader-only contract + the version-gate pattern this mirrors), WP-402 ✅ / D-24211 (ordinal gates), WP-583..591 ✅ (the scoring system whose outputs this block descriptively carries — `ScoreBreakdown`, `ScoreGrade`, and the persisted `competitive_scores` columns)
**User-Visible Surface:** none — infrastructure (a contract addition; nothing emits 1.5.0 until the paired producer packet flips the writer)
**Baseline:** `origin/main` @ `05f3a446` (draft worktree checkout point; the reserve-only ledger commit lands on top)

## Goal

Add two optional, **DESCRIPTIVE** blocks to LAGN at version **1.5.0**, so a
server-emitted **result-LAGN** can carry the in-match **Battle Plan** and the
end-of-match **report card**: a new top-level `battle_plan` (`pre_battle` /
`battle_adjustments` / `post_battle` free text) and a nested `result.score`
(`raw_score` / `par_score` / `final_score` / `grade` / `scoring_config_version`
/ `par_version`). This is the **reader contract only** — readers accept 1.5.0,
the writer stays 1.4.0, so no stored record migrates; the producer that flips
the writer and emits these is a paired follow-on WP.

## Context

### Read this first — why 1.5.0, reader-only, and descriptive

This mirrors WP-405 exactly. LAGN's `players`/`scoring_profile` (1.4.0) let a
result-LAGN *say* who played and under which profile; this packet lets it *say*
what the team planned and how they scored — still without anything **scoring,
crediting, ranking, or verifying** from the blocks. Competitive credit stays
`matchId → bgio blob → re-reduce → re-verify hash → AccountId`, server-side
(D-5301 / D-24126). A reader that scored from `result.score` would reopen that
trust hole.

- **Why 1.5.0 and reader-only.** 1.4.0 is allocated to `players`/`scoring_profile`
  (D-24214/D-24215). Readers accepting 1.5.0 before any writer emits it is the
  deliberate asymmetry (WP-405) that keeps stored records readable without a
  migration pass. `LAGN_VERSION` (the writer) stays 1.4.0; `package.json` is NOT
  bumped (the WP-402/WP-405 AC-10 precedent) — that belongs to the producer packet.
- **The grade is a frozen snapshot.** `grade` (`legendary | a | b | c | d | f`,
  the `ScoreGrade` band from `packages/game-engine/src/scoring/parScoring.grade.ts`)
  is a **stored snapshot** of the operator-tunable banding at write time, not a
  value a reader re-derives. That is intentional — a result-LAGN records what the
  team *earned then*, even if the bands are re-tuned later.
- **`battle_plan` rides the result-LAGN only, never the `?lagn=` share link.**
  This packet only *permits* the block; the producer packet's discipline is that
  free-text battle-plan prose goes in the server-emitted result-LAGN, never the
  base64url `?lagn=` loadout link (free text bloats a URL — the same reason
  image-bytes were rejected for LAGN).

## Assumes

- **WP-405 ✅ / D-24214 / D-24215 / D-24211 Active** — LAGN 1.4.0, the ordinal
  version-gate pattern, `UNEXPRESSIBLE_CONSTRAINTS` + the build-enforced
  refinement-count test, and the reader-only asymmetry are all in place on `main`.
- `packages/lagn-spec/src/validator.ts` has `LAGN_VERSION = LAGN_VERSION_1_4_0`,
  `LAGN_SUPPORTED_VERSIONS` ending at `1.4.0`, `isLagnVersionAtLeast`, and the
  `result` block `{ outcome, loss_condition?, victory_points?, timestamp? }`.
- The report-card fields descriptively carry the shipped scoring outputs (the
  producer packet sources them — the contract only permits the shape): `raw_score`
  / `par_score` / `final_score` / `scoring_config_version` mirror
  `ScoreBreakdown.{rawScore,parScore,finalScore,scoringConfigVersion}`
  (`parScoring.types.ts`); `grade` is the **derived** `ScoreGrade` band
  (`gradeForFinalScore`, `parScoring.grade.ts`), NOT a `ScoreBreakdown` field; and
  `par_version` is the persisted `legendary.competitive_scores.par_version` column
  — a descriptive string with **no `ScoreBreakdown` counterpart** (do not hunt for
  one). This block defines no new score; it names a shape a producer can fill.
- `generate:schema` regenerates `schemas/lagn-v1.json`; the `LAGN Schema Drift
  Guard` CI job + the validator.test.ts committed-schema assertion enforce it.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Scope (In)

1. `LAGN_VERSION_1_5_0 = '1.5.0'` constant (JSDoc: strict superset of 1.4.0; why
   1.5.0 not 1.4.0); appended at the end (newest-last) of `LAGN_SUPPORTED_VERSIONS`.
2. **`battle_plan`** — a new optional **root** block:
   `z.object({ pre_battle: z.string().optional(), battle_adjustments:
   z.string().optional(), post_battle: z.string().optional() }).optional()`.
3. **`result.score`** — a new optional block **nested in `result`**:
   `z.object({ raw_score: int, par_score: int, final_score: int, grade:
   z.enum(['legendary','a','b','c','d','f']), scoring_config_version: int,
   par_version: z.string() }).optional()`.
4. One **combined ordinal `.refine()`** version gate: `battle_plan` /
   `result.score` require `lagn_version` 1.5.0 (silent-strip guard, D-24211
   ordinal). One matching `UNEXPRESSIBLE_CONSTRAINTS` entry → `EXPECTED_REFINEMENT_COUNT`
   rises by exactly 1.
5. `migrate.ts` — a pure-restamp `migrate_1_4_0_to_1_5_0` hop + registry entry
   (registered but unreachable — the writer stays 1.4.0).
6. `types.ts` — inferred `BattlePlan` + `ResultScore` types; `index.ts` re-exports
   both new types **and** the `LAGN_VERSION_1_5_0` constant (the WP-405 precedent).
7. `validator.test.ts` — 1.5.0 gate cases (accept at 1.5.0; reject each block at
   1.4.0); extend the **version-enum re-pin** (the inline literal in the
   `published contract fields survive derivation` test, ~L923-929) to include
   `1.5.0` + add `LAGN_VERSION_1_5_0` to the import block; append the new fixture
   to the `fixtures` array (~L990, which the single ajv+zod loop consumes); the
   `EXPECTED_REFINEMENT_COUNT` gate updates automatically with the new entry.
8. `examples/tier1-battle-plan-report.lagn.json` — a new 1.5.0 fixture carrying
   both blocks.
9. Regenerate `schemas/lagn-v1.json` (`generate:schema`; never hand-edited).
10. `wiki/lagn-v1.md` — a `1.5.0` column (Read accepted / Written no / Adds
    `battle_plan` + `result.score`), the constant list, the `Versioning` heading,
    the per-version prose block, and the `UNEXPRESSIBLE_CONSTRAINTS` enumeration.
11. `docs/ai/REFERENCE/00.2-data-requirements.md` — the new canonical field names.
12. `docs/ai/REFERENCE/api-endpoints.md` — **§21 TRIGGERED (D-11804)**: whole-row
    replace the `validate`-gated `POST /api/me/loadouts` row. The replacement does
    THREE things (whole-row, no partial-column edit): (a) extend the bolded
    **Accepted versions** list to `1.0.0 … 1.4.0, 1.5.0` (the endpoint auto-accepts
    1.5.0 once it joins `LAGN_SUPPORTED_VERSIONS`); (b) append the WP-640 narrowing
    sentence — a pre-1.5.0 body carrying `battle_plan` / `result.score` is rejected
    `400 { "error": "invalid_lagn" }` (the WP-405 chain); (c) preserve the existing
    tail unchanged (the writer stays 1.4.0; a stored body persists verbatim, never
    re-stamped).

## Scope (Out)

- **`LAGN_VERSION` stays at 1.4.0.** No producer emits these blocks; the writer
  flip is the paired producer WP. **`package.json` is NOT bumped** (AC-10).
- **No producer / endpoint code.** `GET /api/match/:matchId/result-lagn` and the
  battle_plan table + competitive_scores reads belong to the producer WP.
- **Non-authoritative.** Nothing scores/credits/ranks/verifies from either block.
- **No `battle_plan` in the `?lagn=` loadout link** — producer discipline, not a
  contract rule here (the contract only permits the block).
- No new package dependency; `lagn_version` stays required; no `.strict()`.

## Files Expected to Change

- `packages/lagn-spec/src/validator.ts` — **modified** — constant, 2 blocks, 1 combined version gate, 1 allowlist entry
- `packages/lagn-spec/src/migrate.ts` — **modified** — 1.4.0 → 1.5.0 restamp step (unreachable)
- `packages/lagn-spec/src/types.ts` — **modified** — `BattlePlan` + `ResultScore` inferred types
- `packages/lagn-spec/src/index.ts` — **modified** — re-export `BattlePlan` + `ResultScore` types + the `LAGN_VERSION_1_5_0` constant
- `packages/lagn-spec/src/validator.test.ts` — **modified** — 1.5.0 gate cases + enum re-pin + fixture + refinement count
- `packages/lagn-spec/examples/tier1-battle-plan-report.lagn.json` — **new** — eighth fixture (1.5.0)
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated (drift guard)
- `wiki/lagn-v1.md` — **modified** — 1.5.0 read column + block docs
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — new field names
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `POST /api/me/loadouts` row replaced WHOLE (D-11804)

No other files may be modified beyond the governance close-out (DECISIONS.md — D-24452 Active; STATUS.md; WORK_INDEX.md; EC_INDEX.md; ROADMAP-MINDMAP.md). **`packages/lagn-spec/package.json` is NOT touched.**

## Contract

**LAGN 1.5.0** — a strict superset of 1.4.0. Every valid 1.0.0–1.4.0 document
still validates unchanged. New (all optional, 1.5.0-gated):
- root `battle_plan?: { pre_battle?: string; battle_adjustments?: string; post_battle?: string }`
- `result.score?: { raw_score: int; par_score: int; final_score: int; grade: 'legendary'|'a'|'b'|'c'|'d'|'f'; scoring_config_version: int; par_version: string }`

A pre-1.5.0 document carrying either block is **rejected**, not silently stripped
(ordinal gate). Both blocks are **descriptive and non-authoritative**.
**§21 (D-11804) is TRIGGERED** — the `validate`-gated `POST /api/me/loadouts` row
is replaced whole to record the new rejection.

## Acceptance Criteria

- **AC-1** — A 1.5.0 document carrying `battle_plan` and `result.score` validates; each field is optional (a 1.5.0 doc with neither still validates).
- **AC-2** — A 1.4.0 (or earlier) document carrying `battle_plan` is rejected with the version-gate message; likewise for `result.score`.
- **AC-3** — Every valid 1.0.0–1.4.0 example fixture still validates unchanged (additive).
- **AC-4** — `grade` accepts exactly `legendary | a | b | c | d | f`; any other string fails.
- **AC-5** — `migrateToCurrent` on a 1.4.0 document is a no-op (writer stays 1.4.0); the 1.4.0→1.5.0 hop is registered but unreachable (a direct 1.5.0 doc migrates to itself only when the writer later flips).
- **AC-6** — The inferred `BattlePlan` / `ResultScore` types are exported and match the zod shape.
- **AC-7** — The new `tier1-battle-plan-report.lagn.json` fixture validates against both the published JSON Schema (ajv) and zod.
- **AC-8** — The refinement-count gate is **mutation-tested**: an undocumented `.refine()` → red; the documented entry → green. `EXPECTED_REFINEMENT_COUNT` rose by exactly 1.
- **AC-9** — `generate:schema` then `git diff --exit-code -- packages/lagn-spec/schemas/` is clean; the committed schema's `lagn_version.enum` includes `1.5.0`.
- **AC-10** — `packages/lagn-spec/package.json` is **unchanged** (`LAGN_VERSION` does not move).
- **AC-11** — `api-endpoints.md`'s `POST /api/me/loadouts` row is replaced whole with the 1.5.0 narrowing sentence (D-11804); `00.2` carries the new field names.

## Verification Steps

```pwsh
pnpm -r build                                            # exits 0
pnpm --filter @legendary-arena/lagn test                 # 0 fail; count recorded
pnpm --filter @legendary-arena/lagn generate:schema
git diff --exit-code -- packages/lagn-spec/schemas/      # clean
pnpm -r --no-bail test                                   # no new failures
git diff --name-only origin/main                         # matches §Files Expected to Change
```

## Empirical Scaffold (REQUIRED — 01.4; RUN, not reasoned)

This packet **tightens validation**: a body carrying `battle_plan` / `result.score`
at a pre-1.5.0 `lagn_version` becomes newly rejected. Before READY, prototype the
validator change on a throwaway branch and run `pnpm --filter @legendary-arena/lagn
test` + `pnpm -r --no-bail test`; fold any surfaced fixture breakage (existing
fixtures carrying an unexpected shape, or a downstream consumer's LAGN fixture)
into `§Scope (In)` + the allowlist. Record the observed pre/post counts.

## Vision Alignment

`00.3 §17.1` **TRIGGERED** — `result.score` carries scores + a grade band, a
**scoring surface** (the trigger is surface-touch, not authority).

- **Clauses touched:** `§20–26` (Scoring & Skill Measurement), `§3` (Trust &
  Fairness), `NG-1` (No Pay-to-Win).
- **Conflict assertion:** **No conflict — this WP preserves all touched clauses.**
- **Non-Goal proximity:** `NG-1..NG-7` are not crossed. Both blocks are
  **descriptive, reader-only, and non-authoritative** — nothing scores, credits,
  ranks, or verifies from them. Competitive credit stays `matchId → bgio blob →
  re-reduce → re-verify hash → AccountId` (D-5301 / D-24126). No pay-gate, no
  balance change — a contract-shape addition.
- **Determinism preservation (required — scoring surface):** the contract stores
  a **frozen snapshot** of `grade` / the score values at write time and validates
  the `grade` enum only — it **re-derives nothing**, sources no RNG, reads no
  clock, and has **zero replay-verification impact**. A reader never recomputes
  the grade from `final_score`. `finalStateHash` / replay are untouched (this
  packet is `packages/lagn-spec` + docs; no engine, no `G`, no persistence).

## Lint Gate Self-Review (`00.3`, 21 sections)

- §1 PASS (all sections; Out-of-Scope closed). §2 PASS (packet-specific; `00.6`). §3 PASS (deps incl. WP-405/402 ✅ + BLOCKED clause). §4 PASS (Context: consumer story + non-authoritative boundary + the reader-only/frozen-grade rationale). §5 PASS (10-file allowlist + governance close; package.json explicitly untouched). §6 PASS (constant/block/gate/grade-enum/fixture names locked; grade mirrors `ScoreGrade`). §7 PASS (no new dependency). §8 PASS (`pnpm` block). §9 PASS (contract-package; additive superset). §10 N/A (no engine/G). §11 N/A (determinism). §12 N/A (no persistence). §13 **PASS — canonical arrays:** `EXPECTED_REFINEMENT_COUNT` bumps by 1 with its `UNEXPRESSIBLE_CONSTRAINTS` entry in the same edit; the version-enum re-pin literal extends to `1.5.0`. §14 PASS (naming; field names → 00.2). §15 PASS (full-sentence version-gate message). §16 PASS (`tsx --test`; refinement-count mutation test; ajv+zod fixture). §17 **TRIGGERED — PASS** (§17.1 scoring surface — see `## Vision Alignment`: descriptive/reader-only, non-authoritative, determinism-preserving frozen snapshot; §20-26 / §3 / NG-1 touched, no conflict). §18 PASS (D-24452 reserved; Active at execution). §19 PASS (WP-405/402/583-591 shipped). §20 PASS (one WP; producer is a separate WP). §21 **TRIGGERED — PASS** (D-11804: `POST /api/me/loadouts` `validate`-gated row replaced WHOLE with the 1.5.0 rejection sentence; no endpoint added — that is the producer packet).

## Definition of Done

- [ ] AC-1..AC-11 each demonstrated with observed output pasted into the session log
- [ ] `pnpm --filter @legendary-arena/lagn test` 0 fail; count recorded (baseline → +N)
- [ ] `generate:schema` + `git diff --exit-code -- packages/lagn-spec/schemas/` clean
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] **create D-24452 Active** in `DECISIONS.md` (RESERVED in NUMBER-LEDGER; no prior Drafted entry): the two descriptive 1.5.0 blocks, the reader-only asymmetry, the frozen grade, and the battle_plan-not-in-share-link discipline
- [ ] `00.2` carries the new field names; `api-endpoints.md` `POST /api/me/loadouts` row replaced WHOLE (D-11804)
- [ ] `packages/lagn-spec/package.json` **untouched** (AC-10)
- [ ] `wiki/lagn-v1.md` — 1.5.0 read column + block docs + the `UNEXPRESSIBLE_CONSTRAINTS` enumeration extended
- [ ] `git diff --name-only` matches §Files Expected to Change exactly
- [ ] WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `📝 → ✅`; `roadmap:counts:check` exits 0
