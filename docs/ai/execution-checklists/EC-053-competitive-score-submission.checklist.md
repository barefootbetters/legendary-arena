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
- [ ] WP-052 complete: `PlayerId`, `PlayerIdentity` (discriminated union), `isGuest` type guard, `findReplayOwnership`, and `ReplayOwnershipRecord` are exported; guests cannot submit
- [ ] `docs/13-REPLAYS-REFERENCE.md` §Community Scoreboard Integration read in full
- [ ] Server has an existing replay loader by `replayHash`; storage implementation is out of scope for WP-053. If no loader exists, WP-053 is **BLOCKED** and must not proceed. A test-only mock satisfies test fixtures, not the prerequisite — the application must have a real loader at runtime; mocks may not be the way this gate is satisfied.
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
- `submitCompetitiveScore` signature: `(identity: PlayerIdentity, replayHash: string, database)` — accepts `PlayerIdentity` so guest rejection is enforceable inside the server, not delegated upstream
- Replay verification hash rule: `computeStateHash(replayResult.finalState)` must equal the submitted `replayHash`; mismatch → `replay_verification_failed`
- `stateHash` stored on the record must equal `replayHash` for every accepted competitive record
- Published PAR is authoritative: `parScore` passed to `computeFinalScore` is the `parValue` returned by `checkParPublished` — server enforces, never derives
- PAR drift guard: `computeParScore(config)` must equal published `parValue`; mismatch → reject as `replay_verification_failed`
- `SubmissionRejectionReason` (hard failures only — duplicates are idempotent successes, not rejections):
  - `'replay_not_found' | 'not_owner' | 'guest_not_eligible' | 'visibility_not_eligible' | 'par_not_published' | 'replay_verification_failed'`
- `SUBMISSION_REJECTION_REASONS: readonly SubmissionRejectionReason[]` — canonical runtime list (TypeScript unions are not enumerable at runtime); mirrors the `AUTH_PROVIDERS` / `REPLAY_VISIBILITY_VALUES` pattern
- Idempotent retry behavior:
  - Retries return success with the existing record unchanged — never a rejection
  - Success result includes `wasExisting: boolean` so callers can surface "already submitted" UX without a failure path
  - On retry, the replay is **not** re-executed and the record is **not** mutated
- Scoring signatures: `deriveScoringInputs(replayResult, gameLog)`, `computeRawScore(inputs, config)`, `computeFinalScore(rawScore, parScore)`, `buildScoreBreakdown(inputs, config)`
- `legendary.*` schema namespace; PKs use `bigserial`; `score_breakdown` stored as `jsonb`

---

## Guardrails

- Server always re-executes replay via `replayGame` — never trusts client values
- Server never re-implements scoring math — no weights, no manual arithmetic in server code
- PAR gate enforced before scoring; missing PAR always rejects (fail closed)
- Replay integrity mandatory: re-execution failure, nondeterministic outcome, or hash mismatch → `replay_verification_failed`
- Replay verification is single-attempt and terminal: the replay is executed exactly once per submission attempt; any thrown error, non-determinism, or state-hash mismatch immediately rejects with `replay_verification_failed`. Retry-on-flakiness, tolerance windows, and "log and continue" are prohibited.
- Database uniqueness is behavioral, not incidental: if the pre-check race is lost and the INSERT raises a `UNIQUE (player_id, replay_hash)` violation, application logic must treat that violation as an idempotent success (return the existing record with `wasExisting: true`) — never as an error and never as a reason to re-execute verification.
- `submitCompetitiveScore` must not throw for any expected failure mode defined by WP-053; every such outcome must be returned via `SubmissionResult`. A thrown error on an expected failure path is an EC failure, not a stylistic issue.
- Visibility gating enforced at submission time: `private` replays are not eligible
- Guest rejection is fail-fast (no DB hits before the `isGuest(identity)` check)
- Identity affects eligibility only — never passed to scoring functions; `PlayerIdentity` enters the pipeline, only `PlayerId` (after guest rejection) is stored on the record
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
- Replay verification hash rule: state hash is recomputed from re-execution and must match `replayHash`
- Published PAR authority: server enforces published `parValue`; it does not derive PAR from client input
- PAR drift guard: `computeParScore(config)` equality with `parValue` catches config-without-republish drift
- `SubmissionRejectionReason`: typed reasons enable precise client messages without leaking internals
- `SUBMISSION_REJECTION_REASONS` (runtime list): canonical list enables drift-detection tests since unions are not enumerable at runtime
- `submitCompetitiveScore` idempotency: retries return existing record with `wasExisting: true` — not a rejection — so retries never produce duplicates and never re-execute the replay
- `submitCompetitiveScore` delegation: server orchestrates; engine computes scoring

---

## Files to Produce

- `apps/server/src/competition/competition.types.ts` — **new** — CompetitiveSubmissionRequest, CompetitiveScoreRecord, SubmissionResult (with `wasExisting` on the success variant), SubmissionRejectionReason, `SUBMISSION_REJECTION_REASONS`
- `apps/server/src/competition/competition.logic.ts` — **new** — submitCompetitiveScore, findCompetitiveScore, listPlayerCompetitiveScores
- `data/migrations/NNN_create_competitive_scores_table.sql` — **new** — legendary.competitive_scores
- `apps/server/src/competition/competition.logic.test.ts` — **new** — 9 tests covering eligibility rejection, PAR enforcement, replay verification, idempotency, immutability, and drift detection

---

## After Completing

- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (DB tests may skip with reason)
- [ ] No competition types in `packages/game-engine/src/`; no `boardgame.io`, `require()`, or scoring weights/formula constants in `apps/server/src/competition/` (Select-String confirms all)
- [ ] Migration uses `legendary.*` namespace, `bigserial` PK, `jsonb score_breakdown`, `UNIQUE (player_id, replay_hash)`
- [ ] Hash verification enforced in code: `state_hash` stored on the record equals submitted `replay_hash` for every accepted submission
- [ ] Published PAR enforced in code: `computeFinalScore` receives `parValue` returned by `checkParPublished` (not a re-derived value)
- [ ] PAR drift guard executed: `computeParScore(config)` equality with `parValue` is asserted; mismatch rejects as `replay_verification_failed`
- [ ] `'already_submitted'` does **not** appear in `SubmissionRejectionReason`; retry returns `{ ok: true, wasExisting: true }` instead
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
- `state_hash` stored in record differs from submitted `replay_hash` → replay verification is not anchored; must fail closed
- Retry returns a rejection (e.g., a resurrected `'already_submitted'`) instead of `{ ok: true, wasExisting: true }` → idempotency contract violated
- `submitCompetitiveScore` accepts `PlayerId` instead of `PlayerIdentity` → guest rejection becomes untestable in this layer; signature must accept the discriminated union
- `computeFinalScore` is called with a re-derived PAR value rather than `parValue` from `checkParPublished` → server is deriving PAR instead of enforcing the published artifact
