# EC-053 — Competitive Score Submission & Verification (Execution Checklist)

**Source:** docs/ai/work-packets/WP-053-competitive-score-submission-verification.md
**Layer:** Server / Competition Enforcement

**Execution Authority:**
This EC is the authoritative execution checklist for WP-053.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-053.

---

## Before Starting

- [ ] WP-004 complete: server startup sequence exists (`apps/server/src/index.mjs`)
- [ ] WP-027 complete: `ReplayInput`, `replayGame`, `computeStateHash` exported
- [ ] WP-048 complete: `deriveScoringInputs`, `computeRawScore`, `computeFinalScore`, `buildScoreBreakdown`, `ScenarioScoringConfig` exported
- [ ] WP-051 complete: `checkParPublished(scenarioKey)` exists and fails closed
- [ ] WP-052 complete: `PlayerId`, `findReplayOwnership`, `ReplayOwnershipRecord` exist; guests cannot submit
- [ ] `docs/13-REPLAYS-REFERENCE.md` §Community Scoreboard Integration read in full
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-053.

- No client trust: client-reported scores, states, or hashes are never used
- Server is enforcer, not calculator: delegates all scoring to engine contracts
- PAR is mandatory: `checkParPublished(scenarioKey)` must return non-null; missing PAR → reject
- `UNIQUE (player_id, replay_hash)` on `legendary.competitive_scores` — enforces idempotency and prevents re-submission under new scoring versions
- Competitive records are immutable: never updated, modified, or soft-deleted
- `SubmissionRejectionReason`: `'replay_not_found' | 'not_owner' | 'guest_not_eligible' | 'visibility_not_eligible' | 'par_not_published' | 'replay_verification_failed' | 'already_submitted'`
- Scoring signatures: `deriveScoringInputs(replayResult, gameLog)`, `computeRawScore(inputs, config)`, `computeFinalScore(rawScore, parScore)`, `buildScoreBreakdown(inputs, config)`
- `legendary.*` schema namespace; PKs use `bigserial`; `score_breakdown` stored as `jsonb`

---

## Guardrails

- Server always re-executes replay via `replayGame` — never trusts client values
- Server never re-implements scoring math — no weights, no manual arithmetic in server code
- PAR gate enforced before scoring; missing PAR always rejects (fail closed)
- Replay integrity mandatory: re-execution failure, nondeterministic outcome, or hash mismatch → `replay_verification_failed`
- Visibility gating enforced at submission time: `private` replays are not eligible
- `PlayerId` used for eligibility only — never passed to scoring functions
- `CompetitiveScoreRecord` is write-once; no UPDATE function exists
- Idempotency means returning the existing record unchanged — no re-verification or mutation on retry
- No re-submission across scoring versions: same replay cannot be re-scored under new config/PAR
- Any unknown, missing, or ambiguous state must fail closed — reject, never proceed
- WP-027, WP-048, WP-051, WP-052 contract files must not be modified

---

## Required `// why:` Comments

- `CompetitiveSubmissionRequest`: replay referenced by hash only; content not resent by client
- `CompetitiveScoreRecord`: immutable snapshot of verified execution; `parVersion` and `scoringConfigVersion` pin scoring context
- `scoreBreakdown` as jsonb: full transparency and auditability
- `SubmissionRejectionReason`: typed reasons enable precise client messages without leaking internals
- `submitCompetitiveScore` idempotency: retries must not create duplicate records
- `submitCompetitiveScore` delegation: server orchestrates; engine computes scoring

---

## Files to Produce

- `apps/server/src/competition/competition.types.ts` — **new** — CompetitiveSubmissionRequest, CompetitiveScoreRecord, SubmissionResult, SubmissionRejectionReason
- `apps/server/src/competition/competition.logic.ts` — **new** — submitCompetitiveScore, findCompetitiveScore, listPlayerCompetitiveScores
- `data/migrations/NNN_create_competitive_scores_table.sql` — **new** — legendary.competitive_scores
- `apps/server/src/competition/competition.logic.test.ts` — **new** — 9 tests

---

## After Completing

- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (DB tests may skip with reason)
- [ ] No competition types in `packages/game-engine/src/`; no `boardgame.io`, `require()`, or scoring weights in `apps/server/src/competition/` (Select-String confirms all)
- [ ] Migration uses `legendary.*` namespace, `bigserial` PK, `jsonb score_breakdown`, `UNIQUE (player_id, replay_hash)`
- [ ] WP-027, WP-048, WP-051, WP-052 contract files unmodified; no files outside scope changed (`git diff` confirms)
- [ ] `STATUS.md` updated; `DECISIONS.md` updated (mandatory re-execution, immutable records, server-side PAR gate, jsonb breakdown, UNIQUE idempotency, engine delegation); `WORK_INDEX.md` WP-053 checked off

---

## Common Failure Smells

- Server accepts client-provided score or hash → trust violation; all values must be recomputed
- Submission proceeds without `checkParPublished` call → PAR gate bypass
- Competitive record can be updated after creation → immutability violation; no UPDATE function should exist
- Server code contains `W_R`, `W_BP`, `W_VP`, or scoring arithmetic → scoring re-implemented; must delegate to engine
- Submission throws instead of returning `SubmissionResult` → contract violation; expected failures use structured result
- Guest or `private`-visibility replay submits successfully → eligibility check missing
- Visibility change after submission retroactively affects existing competitive record → visibility is checked at submission time only
