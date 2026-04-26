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
- [ ] WP-048 complete: `deriveScoringInputs(replayResult, gameState: LegendaryGameState)` (per **D-4801** — second arg is the final state, *not* a `gameLog` / `GameMessage[]`), `computeRawScore`, `computeFinalScore`, `buildScoreBreakdown`, `ScenarioScoringConfig` exported. Verify with `grep -nE "export function deriveScoringInputs" packages/game-engine/src/scoring/parScoring.logic.ts` returning a single line whose signature names `gameState: LegendaryGameState` (not `gameLog`).
- [ ] WP-051 complete: `checkParPublished(scenarioKey)` exists and fails closed (baseline shape `{ parValue, version } | null`; **superseded for WP-053 by the WP-053a-extended shape** `{ parValue, parVersion, source, scoringConfig } | null` — see WP-053a entry below)
- [ ] WP-052 complete: `AccountId` (formerly `PlayerId` — renamed per **D-5201**; verify `grep -nE "export type AccountId" apps/server/src/identity/identity.types.ts` returns a line, and `grep -nE "export type PlayerId|export.*PlayerId\\b" apps/server/src/identity/` returns no output), `PlayerIdentity` (discriminated union), `isGuest` type guard, `findReplayOwnership`, and `ReplayOwnershipRecord` (whose owner reference field is `accountId: AccountId`, not `playerId`) are exported; guests cannot submit
- [ ] WP-103 complete: `storeReplay(replayHash, replayInput, database): Promise<void>` and `loadReplay(replayHash, database): Promise<ReplayInput | null>` exported from `apps/server/src/replay/replay.logic.ts`; `legendary.replay_blobs` table created via `data/migrations/006_create_replay_blobs_table.sql` (content-addressed; immutable inserts via `ON CONFLICT (replay_hash) DO NOTHING`). Verify with `grep -n "export async function loadReplay" apps/server/src/replay/replay.logic.ts` returning at least one line, and `git log --oneline -- data/migrations/006_create_replay_blobs_table.sql` returning at least one commit (expected: `fe7db3e` or later).
- [ ] WP-053a complete: `checkParPublished(scenarioKey)` returns `{ parValue, parVersion, source, scoringConfig }` (the `scoringConfig: ScenarioScoringConfig` field is non-optional). The competitive submission flow's step 12 PAR-equality check (`computeParScore(config) === parValue`) is **defense-in-depth, not a primary safety net** under D-5306 (Option A) — drift between `scoringConfig` and `parValue` is structurally impossible because both flow from the same PAR artifact. Verify with `grep -n "scoringConfig" apps/server/src/par/parGate.mjs` returning at least three lines (typedef, return, gate construction guard), and `grep -n "ParGateHit" packages/game-engine/src/` returning the extended type definition. If WP-053a has not landed on `main`, WP-053 is **BLOCKED** and must not proceed.
- [ ] `docs/13-REPLAYS-REFERENCE.md` §Community Scoreboard Integration read in full
- [ ] Server replay loader prerequisite is satisfied by WP-103's `loadReplay`. If `apps/server/src/replay/replay.logic.ts` does not exist on `main`, WP-053 is **BLOCKED** and must not proceed. A test-only mock satisfies test fixtures, not the prerequisite — the application must use the real `loadReplay` at runtime; mocks may not be the way this gate is satisfied.
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
- `submitCompetitiveScore` signature: `(identity: PlayerIdentity, replayHash: string, database)` — accepts `PlayerIdentity` so guest rejection is enforceable inside the server, not delegated upstream. After the `isGuest(identity)` guard, `identity` narrows to `PlayerAccount` and `identity.accountId` is the canonical owner reference (not `identity.playerId` — `PlayerId` was renamed to `AccountId` per **D-5201**).
- `ReplayOwnershipRecord` owner field is `accountId: AccountId`. Step 3 of the flow uses `ownershipRecord.accountId === identity.accountId`.
- Scoring contract: `deriveScoringInputs(replayResult, replayResult.finalState)`. Per **D-4801**, the second argument is the `LegendaryGameState` (the function reads G state directly); there is **no** `gameLog: GameMessage[]` parameter. Any reference to `gameLog` in implementation is a contract violation.
- Replay verification hash rule: `computeStateHash(replayResult.finalState)` must equal the submitted `replayHash`; mismatch → `replay_verification_failed`
- `stateHash` stored on the record must equal `replayHash` for every accepted competitive record
- Published PAR is authoritative: `parScore` passed to `computeFinalScore` is the `parValue` returned by `checkParPublished` — server enforces, never derives. The `scoringConfig` returned by the gate is the value passed to `computeRawScore`, `computeParScore`, and `buildScoreBreakdown` (per WP-053a — both flow from the same PAR artifact).
- **Defense-in-depth check (D-5306 Option A):** `computeParScore(scoringConfig)` must equal published `parValue`; mismatch → reject as `replay_verification_failed`. This is **corruption / mismatched-artifact detection**, not the primary drift safety net — structural drift is impossible by construction (both values flow from the same artifact).
- `SubmissionRejectionReason` (hard failures only — duplicates are idempotent successes, not rejections):
  - `'replay_not_found' | 'not_owner' | 'guest_not_eligible' | 'visibility_not_eligible' | 'par_not_published' | 'replay_verification_failed'`
- `SUBMISSION_REJECTION_REASONS: readonly SubmissionRejectionReason[]` — canonical runtime list (TypeScript unions are not enumerable at runtime); mirrors the `AUTH_PROVIDERS` / `REPLAY_VISIBILITY_VALUES` pattern
- Idempotent retry behavior:
  - Retries return success with the existing record unchanged — never a rejection
  - Success result includes `wasExisting: boolean` so callers can surface "already submitted" UX without a failure path
  - On retry, the replay is **not** re-executed (`loadReplay` and `replayGame` are **not** called) and the record is **not** mutated. The fast-path query runs *before* PAR-gate I/O and replay load (placed at flow step 4b — after visibility check, before scenario-key extraction).
  - Race condition path: if step 4b's existence check loses a race and the INSERT raises `UNIQUE (player_id, replay_hash)` (`23505`), application logic re-reads the row and returns `{ ok: true, wasExisting: true }`. Never re-throw; never re-execute verification.
- Scoring signatures (per **D-4801** — no event log): `deriveScoringInputs(replayResult, replayResult.finalState)`, `computeRawScore(inputs, scoringConfig)`, `computeParScore(scoringConfig)`, `computeFinalScore(rawScore, parValue)`, `buildScoreBreakdown(inputs, scoringConfig)`
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
- Identity affects eligibility only — never passed to scoring functions; `PlayerIdentity` enters the pipeline, only `AccountId` (extracted from `identity.accountId` after guest rejection narrows the union to `PlayerAccount`) is stored on the record
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
- PAR equality (defense-in-depth — D-5306 Option A): `computeParScore(scoringConfig)` equality with `parValue` is corruption / mismatched-artifact detection only; structural drift is impossible because both values flow from the same PAR artifact returned by `checkParPublished`
- `SubmissionRejectionReason`: typed reasons enable precise client messages without leaking internals
- `SUBMISSION_REJECTION_REASONS` (runtime list): canonical list enables drift-detection tests since unions are not enumerable at runtime
- `submitCompetitiveScore` idempotency: retries return existing record with `wasExisting: true` — not a rejection — so retries never produce duplicates and never re-execute the replay
- `submitCompetitiveScore` delegation: server orchestrates; engine computes scoring

---

## Files to Produce

- `apps/server/src/competition/competition.types.ts` — **new** — CompetitiveSubmissionRequest, CompetitiveScoreRecord, SubmissionResult (with `wasExisting` on the success variant), SubmissionRejectionReason, `SUBMISSION_REJECTION_REASONS`
- `apps/server/src/competition/competition.logic.ts` — **new** — submitCompetitiveScore, findCompetitiveScore, listPlayerCompetitiveScores
- `data/migrations/007_create_competitive_scores_table.sql` — **new** — legendary.competitive_scores. Slot `007` follows WP-103 `006` (replay_blobs); idempotent via `CREATE TABLE IF NOT EXISTS` per WP-052 / WP-103 / FP-01 precedent. If WP-101 lands its migration first, re-confirm slot at A0 stage against a fresh `data/migrations/` listing.
- `apps/server/src/competition/competition.logic.test.ts` — **new** — 9 tests covering eligibility rejection, PAR enforcement, replay verification, idempotency, immutability, and drift detection

---

## After Completing

- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (DB tests may skip with reason)
- [ ] No competition types in `packages/game-engine/src/`; no `boardgame.io`, `require()`, or scoring weights/formula constants in `apps/server/src/competition/` (Select-String confirms all)
- [ ] Migration uses `legendary.*` namespace, `bigserial` PK, `jsonb score_breakdown`, `UNIQUE (player_id, replay_hash)`
- [ ] Hash verification enforced in code: `state_hash` stored on the record equals submitted `replay_hash` for every accepted submission
- [ ] Published PAR enforced in code: `computeFinalScore` receives `parValue` returned by `checkParPublished` (not a re-derived value)
- [ ] Defense-in-depth (D-5306 Option A): `computeParScore(scoringConfig)` equality with `parValue` is asserted; mismatch rejects as `replay_verification_failed` (corruption / mismatched-artifact detection — not the primary safety net)
- [ ] No UPDATE path for competitive scores exists. Verify with `Select-String -Path "apps\server\src" -Pattern "updateCompetitive|UPDATE\s+legendary\.competitive_scores|UPDATE\s+competitive_scores" -Recurse` returning no output.
- [ ] No `gameLog` / `GameMessage[]` reference in competition code. Verify with `Select-String -Path "apps\server\src\competition" -Pattern "gameLog|GameMessage\[\]" -Recurse` returning no output. The locked signature is `deriveScoringInputs(replayResult, replayResult.finalState)`.
- [ ] No `PlayerId` references in new code. Verify with `Select-String -Path "apps\server\src\competition" -Pattern "PlayerId\\b|playerId\\b" -Recurse` returning either no output or only matches inside `// why:` prose citing D-5201; the canonical owner reference field is `accountId: AccountId`.
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
- `submitCompetitiveScore` accepts `AccountId` instead of `PlayerIdentity` → guest rejection becomes untestable in this layer; signature must accept the discriminated union
- `computeFinalScore` is called with a re-derived PAR value rather than `parValue` from `checkParPublished` → server is deriving PAR instead of enforcing the published artifact
- Code references `PlayerId` (the pre-D-5201 type) or `ownershipRecord.playerId` → stale field name; the canonical owner reference is `accountId: AccountId` per WP-052 D-5201
- `deriveScoringInputs` is called with a `gameLog` / `GameMessage[]` argument → wrong signature; per D-4801, the function reads G state directly and the second argument is `replayResult.finalState` (a `LegendaryGameState`), not an event log
- Idempotent retry path calls `loadReplay` or `replayGame` before checking for an existing record → fast-path is incorrectly placed; flow step 4b must short-circuit before any replay I/O or PAR-gate I/O
