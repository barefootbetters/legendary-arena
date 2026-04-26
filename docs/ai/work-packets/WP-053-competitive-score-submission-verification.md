# WP-053 — Competitive Score Submission & Verification

**Status:** Ready for Implementation
**Primary Layer:** Server / Competition Enforcement
**Version:** 1.5
**Last Updated:** 2026-04-26
**Dependencies:** WP-048, WP-051, WP-052, WP-027, WP-004, WP-103, WP-053a

---

## Session Context

WP-048 defined the authoritative scoring contracts (`deriveScoringInputs`,
`computeRawScore`, `buildScoreBreakdown`) at the engine layer. WP-051
established the PAR publication gate — scenarios must have a published PAR
artifact before competitive results are accepted. WP-052 established player
identity, replay ownership, and access control — including the rule that
leaderboard submission requires an account identity. This packet introduces
the **competitive submission pipeline**: how replays are submitted, verified
via server-side re-execution, and accepted as immutable competitive records.
`13-REPLAYS-REFERENCE.md` §Community Scoreboard Integration is the normative
governance source for all decisions in this packet.

---

## Why This Packet Matters

This packet is the **keystone trust surface** of Legendary Arena competition.
Without it, leaderboards would rely on client-reported scores and replay
integrity could be bypassed. With it, every competitive score is
replay-verified — cheating is structurally impossible, not heuristically
detected. This fulfills Vision Goal 22 (Deterministic Scoring) and Vision
Goal 24 (Replay-Verified Competitive Integrity).

---

## Vision Alignment

Required by `00.3 §17.2` because this WP touches multiple §17.1 trigger
surfaces (scoring/PAR/leaderboards, replays/replay verification, player
identity/ownership/visibility, determinism). The vision document is
`docs/01-VISION.md`; clauses are cited by number, not paraphrased.

**Vision clauses touched:** §3 (Trust & Fairness), §11 (Identity &
Account Integrity), §18 (Replays), §20–26 (Scoring & Skill Measurement),
§22 (Deterministic Scoring), §24 (Replay-Verified Competitive Integrity).

**Conflict assertion:** No conflict — this WP preserves all touched
clauses. Server-side replay re-execution is the structural enforcement
mechanism for §22 and §24. No client-reported value is trusted (§3); only
account-owned, non-`private` replays may be submitted (§11, §18); all
scoring is delegated read-only to the engine contracts locked by WP-048
(§20–26). The competitive record (`CompetitiveScoreRecord`) is a Class 3
Snapshot per `.claude/rules/persistence.md` — immutable, never re-hydrated
as live state.

**Non-Goal proximity:** N/A — WP-053 touches no monetization, paid tier,
cosmetic, or persuasion surface. NG-1 (No Pay-to-Win) through NG-7 are
not crossed; competitive submission is gameplay enforcement, not a paid
feature. The packet adds no leaderboard read surface (deferred to WP-055)
and no public ranking, sorting, or pagination affordance.

**Determinism preservation:** Confirmed (Vision §22 / §24).
- Replay re-execution via `replayGame` is deterministic by construction
  per WP-027.
- `computeStateHash(replayResult.finalState)` must equal the submitted
  `replayHash`; any mismatch fails closed with
  `replay_verification_failed`.
- The defense-in-depth check `computeParScore(scoringConfig) === parValue`
  (D-5306 Option A) detects corruption / mismatched-artifact bugs without
  altering the deterministic-replay invariant — both `parValue` and
  `scoringConfig` flow from the same PAR artifact, so structural drift is
  impossible.
- No `Math.random`, `Date.now`, or locale-sensitive code paths are
  introduced. The migration's `created_at timestamptz NOT NULL DEFAULT
  now()` is an audit-only timestamp produced at INSERT time at the SQL
  layer; it does not enter gameplay state, replay verification, or
  scoring math.

---

## Funding Surface Gate (§20 — N/A)

**Status:** N/A by construction. WP-053 introduces no payment, donation,
subscription, tournament-funding, or supporter-tier affordance; it is a
competition-enforcement pipeline. The packet adds one new server-layer
logic file orchestrating engine contracts plus one Class 3 Snapshot
record type — none of which expose a funding surface or affect any
monetization invariant.

The §20 funding-surface lint trigger anticipated by WP-098 has not yet
landed in `00.3-prompt-lint-checklist.md`; this declaration is therefore
forward-compatible. If WP-098 lands before WP-053 executes, no
re-derivation is required — the N/A justification is structural, not
contingent on the gate's exact wording.

---

## Goal

Introduce the competitive score submission and verification pipeline. After
this session, Legendary Arena can accept, verify, and record competitive
attempts:

- Only account-owned replays may be submitted competitively
- The server always re-executes replays in isolation via engine contracts
- Raw Score and Final Score are recomputed from the replay — never trusted
  from the client
- PAR publication is enforced as a hard gate (`checkParPublished`)
- Accepted scores are immutable records of verified execution
- Submission is idempotent and auditable
- No client-computed value is ever trusted
- Replay visibility determines submission eligibility; competitive submission
  requires explicit user opt-in via visibility change from `private`

**Invariant:** The server is an **enforcer**, not a calculator. It delegates
scoring to the engine contracts and stores the verified result. Server code
must never re-implement scoring logic.

---

## Assumes

- WP-004 complete. Specifically:
  - Server startup sequence exists (`apps/server/src/index.mjs`)
  - PostgreSQL connection is established at startup
  - Migration runner (`data/migrations/`) is operational
- WP-027 complete. Specifically:
  - `ReplayInput` canonical contract exists (seed + setupConfig + playerOrder + moves)
  - `replayGame(input): ReplayResult` exists and is pure
  - `computeStateHash(G)` exists with canonical serialization
- WP-048 complete. Specifically:
  - `deriveScoringInputs(replayResult: ReplayResult, gameState: LegendaryGameState): ScoringInputs`
    is exported. Per **D-4801**, this function reads `G` state directly and
    has **no event-log dependency** — the second argument is the
    `LegendaryGameState` value (in practice, `replayResult.finalState`).
    There is no `gameLog` / `GameMessage[]` parameter.
  - `computeRawScore(inputs, config): number` is exported
  - `computeParScore(config): number` is exported
  - `computeFinalScore(rawScore, parScore): number` is exported
  - `buildScoreBreakdown(inputs, config): ScoreBreakdown` is exported
  - `ScenarioScoringConfig` is exported with `scoringConfigVersion`
- WP-051 complete. Specifically:
  - **Baseline (WP-051):** `checkParPublished(scenarioKey)` returns
    `{ parValue, version }` or `null`
  - Missing PAR → fail closed (competitive submissions rejected)
  - The baseline shape above is **superseded for WP-053** by the
    WP-053a-extended shape recorded under §"WP-053a complete" below.
- WP-052 complete. Specifically:
  - `AccountId` branded string maps to `legendary.players.ext_id`
    (per **D-5201** — formerly named `PlayerId`; this WP uses
    `AccountId` throughout to match the post-rename codebase
    exported by `apps/server/src/identity/identity.types.ts`)
  - `PlayerIdentity` discriminated union (`PlayerAccount | GuestIdentity`) and
    `isGuest(identity)` type guard are exported from
    `apps/server/src/identity/identity.types.ts`. The `PlayerAccount`
    variant carries `accountId: AccountId` (not `playerId`).
  - `findReplayOwnership(replayHash, database)` returns
    `ReplayOwnershipRecord | null` per
    `apps/server/src/identity/replayOwnership.logic.ts`
  - `ReplayOwnershipRecord` shape (locked):
    `{ ownershipId, accountId: AccountId, replayHash, scenarioKey,
    visibility, createdAt, expiresAt }`. The owner reference is the
    `accountId` field — not `playerId`.
  - Guest identities cannot submit competitively (no `AccountId`)
- WP-103 complete. Specifically:
  - `storeReplay(replayHash, replayInput, database): Promise<void>` and
    `loadReplay(replayHash, database): Promise<ReplayInput | null>` are
    exported from `apps/server/src/replay/replay.logic.ts`
  - `legendary.replay_blobs` table exists via
    `data/migrations/006_create_replay_blobs_table.sql` (content-addressed;
    immutable inserts via `ON CONFLICT (replay_hash) DO NOTHING`)
  - The replay-loader prerequisite is satisfied by `loadReplay`; this
    packet consumes that function, never re-implements storage.
- WP-053a complete. Specifically:
  - **Effective contract for WP-053:**
    `checkParPublished(scenarioKey)` returns
    `{ parValue, parVersion, source, scoringConfig }` or `null`. The
    `scoringConfig: ScenarioScoringConfig` field is non-optional.
    This shape **supersedes** the baseline `{ parValue, version }`
    documented under §"WP-051 complete" above; WP-053 callers use the
    extended shape exclusively.
  - WP-053 algorithm fields actually consumed: `parValue`,
    `parVersion`, `scoringConfig`. The `source` field is available
    for audit/logging but is not used by the verification flow.
  - PAR artifacts (`SeedParArtifact` and `SimulationParArtifact`) carry
    `scoringConfig` end-to-end; the gate returns it from the in-memory
    index materialized at startup
  - Per **D-5306 (Option A)**, drift between `scoringConfig` and
    `parValue` is structurally impossible because both flow from the
    same PAR artifact. Flow step 12 (`computeParScore(config) ===
    parValue`) is therefore **defense-in-depth / corruption
    detection** — not the primary safety net.
  - Per **D-5306d**, `legendary.competitive_scores` retains both
    `par_version` and `scoring_config_version` columns as audit
    redundancy; no `CHECK` constraint enforcing equality.
- `docs/13-REPLAYS-REFERENCE.md` exists (normative governance)
- `pnpm -r build` exits 0
- `pnpm test` exits 0

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — competition
  verification is **server layer** work. The server orchestrates engine
  contracts but must never re-implement scoring. The engine decides outcomes;
  the server enforces access and records results.
- `docs/ai/ARCHITECTURE.md — "Persistence Boundaries"` — `CompetitiveScoreRecord`
  is a Class 3 (Snapshot) record — safe to persist as an immutable record.
  It is never `G` or engine runtime state.
- `docs/13-REPLAYS-REFERENCE.md` — read §Community Scoreboard Integration
  in full. This is the normative governance source for:
  - The 5-step submission flow (select → submit → re-execute → verify → publish)
  - "Client-reported results are never trusted"
  - "The server always re-executes"
  - "No replay, no score"
- `docs/12-SCORING-REFERENCE.md` — read the scoring formula and PAR model.
  This packet consumes scoring contracts, not re-derives them.
- `packages/game-engine/src/scoring/parScoring.logic.ts` — read the scoring
  functions. This packet calls them; it does not modify them.
- `packages/game-engine/src/replay/replay.types.ts` — read `ReplayInput` and
  `ReplayResult`. This packet consumes replay output.
- `apps/server/src/identity/replayOwnership.logic.ts` — read ownership
  functions. Submission verifies ownership via these functions.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on trust decisions), Rule 11
  (full-sentence error messages), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **No client trust:** client-reported scores, states, or hashes are never
  used. All competitive verification starts from the replay alone.
- **Replay is the only input:** the server loads the replay, re-executes it
  via `replayGame`, and derives all scoring inputs from the result.
- **Engine authority only:** scoring is delegated to WP-048 contracts
  (`deriveScoringInputs`, `computeRawScore`, `computeFinalScore`,
  `buildScoreBreakdown`). Server code must never re-implement scoring logic.
- **PAR is mandatory:** `checkParPublished(scenarioKey)` must return non-null
  before any competitive submission proceeds. No PAR → no score.
- **Identity affects eligibility, never scoring:** `AccountId` determines
  who may submit; it is never passed to scoring functions.
- **Idempotency required:** `UNIQUE (player_id, replay_hash)` enforces that
  retries return the existing record unchanged.
- **Competitive records are immutable:** once created, a `CompetitiveScoreRecord`
  is never modified, updated, or soft-deleted.
- **Replay integrity is mandatory:** if deterministic re-execution fails,
  produces a different `stateHash`, or throws, submission must be rejected
  with `replay_verification_failed`. Any ambiguity defaults to rejection.
- **No scoring formula constants in server:** server code must not contain any
  scoring weights, formula coefficients, or per-scenario tuning values. The
  only allowed numeric operations are plumbing (passing values to engine
  functions, storing engine results, comparing equality).
- **Visibility gating:** replays with `visibility = 'private'` are not eligible
  for competitive submission until the owner explicitly changes visibility.
- **No re-submission across scoring versions:** once a replay has produced a
  `CompetitiveScoreRecord`, it must never be re-submitted under a new
  `scoringConfigVersion` or PAR version. The `UNIQUE (player_id, replay_hash)`
  constraint enforces this.
- **Replay immutability preserved:** verification reads replay data; it never
  modifies, repairs, or re-serializes it.
- **No UI implementation:** this packet defines server logic — no endpoints,
  no REST routes, no frontend.
- **No public leaderboard queries:** that is WP-055.
- **Layer boundary:** competition types live in `apps/server/` — never in
  `packages/game-engine/`. Engine scoring contracts are imported read-only.
- WP-048 contract files must NOT be modified — scoring logic is locked.
- WP-051 contract files must NOT be modified — PAR gate is locked.
- WP-052 contract files must NOT be modified — identity/ownership is locked.
- WP-027 contract files must NOT be modified — replay format is locked.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **Scoring formula (from WP-048):**
  `RawScore = (R × W_R) + P - (BP × W_BP) - (VP × W_VP)`
  `FinalScore = RawScore - PAR`
  Lower is always better. All arithmetic is centesimal integer.

- **Scoring function signatures (from WP-048):**
  - `deriveScoringInputs(replayResult: ReplayResult, gameState: LegendaryGameState): ScoringInputs`
    — per **D-4801**, second arg is the final state (`replayResult.finalState`); no event-log dependency
  - `computeRawScore(inputs: ScoringInputs, config: ScenarioScoringConfig): number`
  - `computeParScore(config: ScenarioScoringConfig): number`
  - `computeFinalScore(rawScore: number, parScore: number): number`
  - `buildScoreBreakdown(inputs: ScoringInputs, config: ScenarioScoringConfig): ScoreBreakdown`

- **PAR gate (baseline from WP-051; extended by WP-053a — effective contract for this packet):**
  - **Baseline (WP-051):** `checkParPublished(scenarioKey)` returns `{ parValue, version }` or `null`
  - **Effective for WP-053 (post-WP-053a, commit `e5b9d15`):**
    `checkParPublished(scenarioKey)` returns
    `{ parValue, parVersion, source, scoringConfig }` or `null`.
    Fields consumed by WP-053: `parValue`, `parVersion`, `scoringConfig`.
    The `source` field is audit-only and is not used by the algorithm.
  - `null` → reject competitive submission (fail closed)

- **Identity (from WP-052):**
  `AccountId` (formerly `PlayerId`, renamed per **D-5201**) maps to
  `legendary.players.ext_id`
  `findReplayOwnership(replayHash, database)` returns
  `ReplayOwnershipRecord | null` whose owner reference is
  `accountId: AccountId` (not `playerId`)
  Guest identities cannot submit competitively (no `AccountId`)

- **`legendary.*` namespace** (PostgreSQL):
  All tables live in the `legendary.*` schema. PKs use `bigserial`.
  Cross-service IDs use `ext_id text`.

- **Submission idempotency:**
  `UNIQUE (player_id, replay_hash)` on `legendary.competitive_scores`

- **Replay hash semantics:**
  - `replayHash` is the canonical replay reference hash and must equal
    `computeStateHash` of the re-executed replay's final state. Any mismatch
    → reject with `replay_verification_failed`.
  - `stateHash` is stored on the competitive record for audit transparency
    and must equal `replayHash` for every accepted record. The two columns
    exist for redundancy and explicit provenance, not because they may
    differ.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via deterministic
reproduction and state inspection.

The following requirements are mandatory:

- Behavior introduced by this packet must be fully reproducible given:
  - identical database state
  - identical replay data
  - identical PAR index state

- Execution must be externally observable via deterministic state changes.
  Invisible or implicit side effects are not permitted.

- This packet must not introduce any state mutation that:
  - cannot be inspected post-execution, or
  - cannot be validated via tests or database queries.

- The following invariants must always hold after execution:
  - `legendary.competitive_scores` records are uniquely constrained on
    `(player_id, replay_hash)`
  - No competitive score exists without a valid replay and published PAR
  - `state_hash` in the record matches `computeStateHash` of re-executed replay
  - `raw_score` and `final_score` match engine recomputation exactly
  - Replay re-execution must be deterministic across repeated verification
    runs; any non-determinism is treated as a verification failure

- Failures attributable to this packet must be localizable via:
  - violation of declared invariants, or
  - unexpected mutation of packet-owned state

---

## Scope (In)

### A) `apps/server/src/competition/competition.types.ts` — new

- `interface CompetitiveSubmissionRequest { replayHash: string }`
  - `// why:` comment: request references replay by hash only; replay content
    is never re-sent by the client — the server loads it from storage
- `interface CompetitiveScoreRecord { submissionId: number; accountId: AccountId; replayHash: string; scenarioKey: string; rawScore: number; finalScore: number; scoreBreakdown: ScoreBreakdown; parVersion: string; scoringConfigVersion: number; stateHash: string; createdAt: string }`
  - `// why:` comment: record is an immutable snapshot of verified execution;
    includes both `parVersion` and `scoringConfigVersion` to pin the exact
    scoring context used at verification time
  - `// why:` comment: `scoreBreakdown` stored as JSON column for full
    transparency and auditability of how the score was computed
  - `// why:` comment: owner reference uses `accountId: AccountId`
    (the WP-052 cross-service ID mapped to `legendary.players.ext_id`,
    renamed from `PlayerId` per D-5201). The SQL column is
    `player_id bigint REFERENCES legendary.players(player_id)` —
    the application maps between SQL bigint PK and the
    `AccountId` text at the persistence boundary, mirroring
    WP-052's `ReplayOwnershipRecord` pattern.
- `type SubmissionResult =
    | { ok: true; record: CompetitiveScoreRecord; wasExisting: boolean }
    | { ok: false; reason: SubmissionRejectionReason }`
  - `// why:` comment: success carries `wasExisting` so retries are safe and
    callers can surface "already submitted" UX without introducing a failure
    path; rejection reasons represent hard eligibility / verification
    failures only
- `type SubmissionRejectionReason = 'replay_not_found' | 'not_owner' | 'guest_not_eligible' | 'visibility_not_eligible' | 'par_not_published' | 'replay_verification_failed'`
  - `// why:` comment: typed reasons enable precise client error messages
    without exposing server internals; "already submitted" is intentionally
    absent — duplicate submissions are idempotent successes, not failures
- `SUBMISSION_REJECTION_REASONS: readonly SubmissionRejectionReason[]` — canonical
  array with drift-detection test
  - `// why:` comment: TypeScript unions are not enumerable at runtime; the
    canonical array enables exhaustiveness tests and matches the pattern used
    by `AUTH_PROVIDERS` and `REPLAY_VISIBILITY_VALUES`

### B) `apps/server/src/competition/competition.logic.ts` — new

- `submitCompetitiveScore(identity: PlayerIdentity, replayHash: string, database: DatabaseClient): Promise<SubmissionResult>`
  — orchestrates the full verification pipeline:
  1. Reject if `isGuest(identity)` → `{ ok: false, reason: 'guest_not_eligible' }`
     (fail fast — no DB hits before identity check). After this guard,
     `identity` narrows to `PlayerAccount` and `identity.accountId` is
     available.
  2. `findReplayOwnership(replayHash, database)` — if null,
     `{ ok: false, reason: 'replay_not_found' }`
  3. Verify `ownershipRecord.accountId === identity.accountId` — else
     `{ ok: false, reason: 'not_owner' }`
  4. Verify `ownershipRecord.visibility !== 'private'` — else
     `{ ok: false, reason: 'visibility_not_eligible' }` (private replays are
     not eligible until visibility is explicitly changed)
  4b. **Idempotency fast-path:** look up an existing competitive record
     keyed on `(accountId, replayHash)`. If present, return
     `{ ok: true, record: existingRecord, wasExisting: true }`
     immediately — no `loadReplay` call, no `replayGame` re-execution,
     no PAR gate I/O, no record mutation. Implementation choice
     between a JOIN against `legendary.players` (resolving
     `accountId → player_id` in SQL) versus a two-query lookup is
     left to the implementer; both satisfy the contract.
     - `// why:` placed here so retries short-circuit *before* any
       expensive replay load or re-execution. PAR is monotonic per
       WP-051 (once published, always published), so re-validating
       PAR for a record that already passed it on its original
       submission is wasted work.
  5. Extract `scenarioKey` from `ownershipRecord.scenarioKey` (the
     literal field name on `ReplayOwnershipRecord` per WP-052) —
     do **not** re-derive from the replay; ownership is the
     authority for which scenario this replay belongs to.
  6. `checkParPublished(scenarioKey)` — enforce PAR gate; on null,
     `{ ok: false, reason: 'par_not_published' }`; on success returns
     `{ parValue, parVersion, source, scoringConfig }` (per WP-053a).
     WP-053 algorithm consumes `parValue`, `parVersion`, and
     `scoringConfig`; `source` is audit-only.
  7. `loadReplay(replayHash, database)` — load `ReplayInput` from
     `legendary.replay_blobs` (per WP-103). On `null` →
     `{ ok: false, reason: 'replay_verification_failed' }` (the
     ownership record exists but the blob is missing — treat as a
     verification failure, never silently 404).
  8. `replayGame(replayInput)` — re-execute deterministically
  9. `computeStateHash(replayResult.finalState)` — must equal `replayHash`;
     otherwise `{ ok: false, reason: 'replay_verification_failed' }`
  10. `deriveScoringInputs(replayResult, replayResult.finalState)` —
     extract scoring inputs. Per **D-4801**, the second argument is
     the final `LegendaryGameState` (read directly from
     `replayResult.finalState`); there is no `gameLog` /
     `GameMessage[]` parameter.
  11. `computeRawScore(inputs, scoringConfig)` — compute raw score via
     the engine, using the `scoringConfig` returned by the gate in
     step 6
  12. **Defense-in-depth check (corruption detection):**
     `computeParScore(scoringConfig)` must equal `parValue` from
     step 6; mismatch → `{ ok: false, reason: 'replay_verification_failed' }`.
     Per **D-5306 Option A**, drift is *structurally* impossible
     because both `parValue` and `scoringConfig` flow from the same
     PAR artifact. This check is therefore a corruption / bit-flip
     / mismatched-artifact safety net, not the primary integrity
     mechanism.
  13. `computeFinalScore(rawScore, parValue)` — normalize against the
     **published** `parValue` from step 6 (server enforces, never derives)
  14. `buildScoreBreakdown(inputs, scoringConfig)` — full breakdown for
     transparency
  15. Insert `CompetitiveScoreRecord` into `legendary.competitive_scores`
     with `stateHash === replayHash`
  - Returns `{ ok: true, record, wasExisting: false }` on a fresh accepted
    submission
  - Returns `{ ok: false, reason }` on any rejection — never throws
  - **Race condition (post-step-4b):** if step 4b's existence check
    misses a row that another process inserts before step 15, the
    INSERT raises a `UNIQUE (player_id, replay_hash)` violation
    (`23505`). Application logic must treat this violation as an
    idempotent success — re-read the existing row and return
    `{ ok: true, record: existingRecord, wasExisting: true }`.
    Never re-throw; never re-execute verification.
  - `// why:` comment: idempotency prevents double submissions from retries;
    `wasExisting` lets callers surface "already submitted" without a failure
    branch
  - `// why:` comment: every scoring call delegates to engine contracts —
    server never re-implements scoring
  - `// why:` comment: step 12 is defense-in-depth per D-5306 Option A —
    structural drift is impossible because `parValue` and `scoringConfig`
    flow from the same PAR artifact; the equality check guards against
    corruption, bit-flips, and mismatched-artifact hand-off bugs only

- `findCompetitiveScore(replayHash: string, database: DatabaseClient): Promise<CompetitiveScoreRecord | null>`
  — looks up competitive record by replay hash

- `listPlayerCompetitiveScores(accountId: AccountId, database: DatabaseClient): Promise<CompetitiveScoreRecord[]>`
  — returns all competitive records for a player, ordered by `createdAt`
  descending

### C) Database migration — new

- `data/migrations/007_create_competitive_scores_table.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS legendary.competitive_scores (
    submission_id         bigserial    PRIMARY KEY,
    player_id             bigint       NOT NULL REFERENCES legendary.players(player_id),
    replay_hash           text         NOT NULL,
    scenario_key          text         NOT NULL,
    raw_score             integer      NOT NULL,
    final_score           integer      NOT NULL,
    score_breakdown       jsonb        NOT NULL,
    par_version           text         NOT NULL,
    scoring_config_version integer     NOT NULL,
    state_hash            text         NOT NULL,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (player_id, replay_hash)
  );
  ```
  - `// why:` comment in migration: `UNIQUE (player_id, replay_hash)` enforces
    idempotent submission; scores are immutable records of verified execution
  - `// why:` comment: `score_breakdown` stored as `jsonb` for full auditability;
    `scoring_config_version` pins the scoring context
  - `// why:` comment: `replay_hash` and `state_hash` are stored
    redundantly to make verification provenance explicit. Equality
    (`state_hash === replay_hash`) is asserted at write time by
    application logic, never inferred at read time. The two columns
    exist to make audit queries trivial (`WHERE replay_hash !=
    state_hash` returns zero rows by construction); a future
    integrity audit job can rely on this without joining engine code.
  - `// why:` comment: SQL FK uses `player_id bigint REFERENCES
    legendary.players(player_id)` (the WP-052 `bigserial` PK), not
    the `AccountId` text. The application maps between SQL bigint
    and `AccountId` at the persistence boundary (mirrors WP-052's
    `legendary.replay_ownership` shape). Per WP-052 §1, the
    `legendary.*` namespace owns this mapping convention.

### D) Tests — `apps/server/src/competition/competition.logic.test.ts` — new

Uses `node:test` and `node:assert` only. No boardgame.io import.

- Nine tests:
  1. Reject submission when the replay **exists but is not owned by**
     the submitting account → `{ ok: false, reason: 'not_owner' }`
     (fixture: account A owns the replay; account B attempts
     submission with the same `replayHash`)
  2. Reject submission if player is a guest → `{ ok: false, reason: 'guest_not_eligible' }`
  3. Reject submission if replay visibility is `private` → `{ ok: false, reason: 'visibility_not_eligible' }`
  4. Reject submission if PAR not published → `{ ok: false, reason: 'par_not_published' }`
  5. Successful submission produces a record whose `stateHash` equals both
     `computeStateHash(finalState)` and the request's `replayHash`
  6. Successful submission recomputes `rawScore` via engine — client value ignored
  7. Idempotent submission returns existing record unchanged with
     `{ ok: true, wasExisting: true }` and **does not call `loadReplay`
     or `replayGame`** (verified via spies / counters on the injected
     dependencies)
  8. Competitive record is immutable — no UPDATE function exists
  9. `SUBMISSION_REJECTION_REASONS` array matches `SubmissionRejectionReason`
     union members (drift detection via exhaustive switch)

- **Coverage gap (intentional):** the `'replay_not_found'` rejection
  path is not covered by the test list above. Step 2 of the flow
  produces it when `findReplayOwnership` returns `null`; the
  surrounding logic is identical to the `not_owner` path (Step 3).
  A 10th test for `replay_not_found` is a defensible addition but
  would expand the test count beyond the locked 9; deferring this
  test to a follow-up coverage WP rather than scope-creeping
  WP-053. Drift-detection test #9 ensures the union member is
  reachable; integration tests in a follow-up WP (or in WP-054
  when the leaderboard read path covers similar lookups) close
  the gap.

- Tests 1–7 require a test PostgreSQL database. If unavailable, they must be
  marked with `{ skip: 'requires test database' }` — never silently omitted.

---

## Out of Scope

- **No public leaderboard queries** — that is WP-055
- **No ranking, sorting, or pagination** — that is WP-055
- **No UI endpoints or REST routes** — server logic only; HTTP layer is future work
- **No replay format changes** — WP-027 replay format is locked
- **No replay blob storage implementation** — this packet reads replays by hash;
  storage mechanism is orthogonal
- **No engine modifications** — engine scoring contracts are consumed, not changed
- **No scoring logic** — WP-048 scoring is locked; this packet delegates to it
- **No PAR gate changes** — WP-051 gate is locked
- **No identity or ownership changes** — WP-052 contracts are locked
- **No matchmaking or ratings** — future work
- **No anti-abuse heuristics** — replay re-execution is the anti-cheat mechanism
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/server/src/competition/competition.types.ts` — **new** —
  CompetitiveSubmissionRequest, CompetitiveScoreRecord, SubmissionResult
  (with `wasExisting` on the success variant), SubmissionRejectionReason,
  SUBMISSION_REJECTION_REASONS
- `apps/server/src/competition/competition.logic.ts` — **new** —
  submitCompetitiveScore, findCompetitiveScore, listPlayerCompetitiveScores
- `data/migrations/007_create_competitive_scores_table.sql` — **new** —
  legendary.competitive_scores table. Slot `007` follows WP-103's `006`
  (replay_blobs); idempotent via `CREATE TABLE IF NOT EXISTS` per the
  WP-052 / WP-103 / FP-01 migration precedent. If WP-101 (Handle Claim
  Flow) lands its migration before WP-053 executes, this slot must be
  re-confirmed at A0-stage time against a fresh `data/migrations/`
  listing — see WP-101 in `WORK_INDEX.md` line 2038.
- `apps/server/src/competition/competition.logic.test.ts` — **new** —
  `node:test` coverage (9 tests)

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Trust Surface
- [ ] Client-reported scores are never used — all values recomputed server-side
- [ ] Replay is re-executed via `replayGame` for every submission
- [ ] `stateHash` is recomputed via `computeStateHash` and stored in the record
- [ ] `stateHash` equals `replayHash` on every accepted record
- [ ] Replay re-execution failure or hash mismatch → `{ ok: false, reason: 'replay_verification_failed' }`
- [ ] Raw Score is recomputed via `computeRawScore` — never from client
- [ ] Final Score is recomputed via `computeFinalScore` — never from client
- [ ] Score breakdown is recomputed via `buildScoreBreakdown`
- [ ] No scoring logic exists in server code — all scoring delegates to engine

### PAR Gate
- [ ] `checkParPublished(scenarioKey)` is called before scoring (post
      idempotency fast-path; not called on retries that hit existing records)
- [ ] Missing PAR → `{ ok: false, reason: 'par_not_published' }`
- [ ] `parValue` from `checkParPublished` is the value passed to
      `computeFinalScore` — server enforces published PAR, never derives
- [ ] `scoringConfig` returned by the gate is the value passed to
      `computeRawScore`, `computeParScore`, and `buildScoreBreakdown`
      (per WP-053a — both `parValue` and `scoringConfig` flow from the
      same PAR artifact)
- [ ] `computeParScore(scoringConfig)` equality with `parValue` is asserted
      as **defense-in-depth** (D-5306 Option A — structural drift is
      impossible; this check guards against corruption / mismatched-
      artifact bugs only); mismatch → `replay_verification_failed`
- [ ] `parVersion` and `scoringConfigVersion` are stored in the competitive record

### Identity & Eligibility
- [ ] `submitCompetitiveScore` accepts `PlayerIdentity` (not bare `AccountId`) so
      guest rejection is enforceable inside the server, not delegated upstream
- [ ] Guest players are rejected before any DB read →
      `{ ok: false, reason: 'guest_not_eligible' }`
- [ ] Replay ownership is verified before submission proceeds
- [ ] Ownership comparison uses `ownershipRecord.accountId === identity.accountId`
      (the post-D-5201 field name; never `playerId`)
- [ ] Non-owner submissions rejected → `{ ok: false, reason: 'not_owner' }`
- [ ] Private replays rejected → `{ ok: false, reason: 'visibility_not_eligible' }`
- [ ] `AccountId` is used for eligibility only — never passed to scoring functions

### Immutability & Idempotency
- [ ] `CompetitiveScoreRecord` is immutable — no UPDATE function exists
      (verified via `Select-String` against any `UPDATE legendary.competitive_scores`
      or `updateCompetitive*` symbol)
- [ ] `UNIQUE (player_id, replay_hash)` prevents duplicate submissions and
      re-submission under new scoring/PAR versions
- [ ] Retry returns `{ ok: true, record: existingRecord, wasExisting: true }`
      without re-executing the replay
- [ ] **Idempotent retry returns existing record without loading replay
      blob** (no `loadReplay` call, no `replayGame` call — verified via
      injected dependency spies in test #7)
- [ ] Race-condition path on `(player_id, replay_hash)` UNIQUE
      violation (`23505`) at INSERT time is treated as an idempotent
      success: re-read the row and return
      `{ ok: true, wasExisting: true }` — never re-throw, never
      re-execute verification
- [ ] `'already_submitted'` is **not** a member of `SubmissionRejectionReason`
      — duplicates are idempotent successes, not failures
- [ ] `submitCompetitiveScore` never throws on expected failures — returns
      structured `SubmissionResult`

### Database
- [ ] `legendary.competitive_scores` uses `bigserial` PK
- [ ] `UNIQUE (player_id, replay_hash)` constraint present
- [ ] FK to `legendary.players(player_id)` present
- [ ] `score_breakdown` stored as `jsonb`
- [ ] Migration follows existing numbering convention

### Drift Detection
- [ ] `SUBMISSION_REJECTION_REASONS` array matches `SubmissionRejectionReason`
      union members (drift-detection test via exhaustive switch — runtime
      list, not aspirational)

### Layer Boundary
- [ ] No competition types in `packages/game-engine/`
      (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in competition files
      (confirmed with `Select-String`)
- [ ] Competition logic imports engine scoring functions read-only — never
      modifies or re-implements them

### Tests
- [ ] All 9 tests pass (or database-dependent tests are marked `skip` with reason)
- [ ] Test files use `.test.ts` extension
- [ ] Tests use `node:test` and `node:assert` only
- [ ] No boardgame.io import in test files

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] WP-048, WP-051, WP-052, WP-027 contract files unmodified

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm test
# Expected: TAP output — all tests passing (or DB tests skipped with reason)

# Step 3 — confirm no competition types leaked into game-engine
Select-String -Path "packages\game-engine\src" -Pattern "CompetitiveScoreRecord|CompetitiveSubmissionRequest|SubmissionResult|SubmissionRejectionReason" -Recurse
# Expected: no output

# Step 4 — confirm no boardgame.io import in competition files
Select-String -Path "apps\server\src\competition" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 5 — confirm no require() in competition files
Select-String -Path "apps\server\src\competition" -Pattern "require\(" -Recurse
# Expected: no output

# Step 6 — confirm no scoring logic re-implementation in server
Select-String -Path "apps\server\src\competition" -Pattern "W_R|W_BP|W_VP|bystanderReward|roundCost" -Recurse
# Expected: no output (server delegates to engine scoring functions)

# Step 7 — confirm idempotency constraint in migration
Select-String -Path "data\migrations" -Pattern "UNIQUE.*player_id.*replay_hash"
# Expected: matches in both replay_ownership and competitive_scores migrations

# Step 8 — confirm legendary.* namespace
Select-String -Path "data\migrations" -Pattern "CREATE TABLE legendary\.competitive_scores"
# Expected: one match

# Step 9 — confirm dependency contracts unmodified
git diff packages/game-engine/src/scoring/
git diff packages/game-engine/src/replay/
git diff apps/server/src/identity/
# Expected: no changes

# Step 10 — confirm no UPDATE path exists for competitive scores
# (immutability invariant — any update path is a contract violation)
Select-String -Path "apps\server\src" -Pattern "updateCompetitive|UPDATE\s+legendary\.competitive_scores|UPDATE\s+competitive_scores" -Recurse
# Expected: no output

# Step 11 — confirm no `gameLog` parameter or `GameMessage[]` reference
# leaked into competition code (the WP-053a-aware signature is
# `deriveScoringInputs(replayResult, replayResult.finalState)`; the
# event-log dependency was removed by D-4801)
Select-String -Path "apps\server\src\competition" -Pattern "gameLog|GameMessage\[\]" -Recurse
# Expected: no output

# Step 12 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (all test files; DB tests may skip with reason)
- [ ] No competition types in `packages/game-engine/`
      (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in competition files
      (confirmed with `Select-String`)
- [ ] No scoring logic re-implemented in server code
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] WP-048 scoring contract files not modified (confirmed with `git diff`)
- [ ] WP-051 PAR gate files not modified (confirmed with `git diff`)
- [ ] WP-052 identity/ownership files not modified (confirmed with `git diff`)
- [ ] WP-027 replay contract files not modified (confirmed with `git diff`)
- [ ] Migration uses `legendary.*` namespace and `bigserial` PK
- [ ] `docs/ai/STATUS.md` updated — competitive score submission pipeline
      exists; replays can be submitted, re-executed, and verified server-side;
      PAR gate is enforced; scores are immutable
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why replay re-execution
      is mandatory for every submission; why competitive records are immutable;
      why PAR gate is enforced server-side not client-side; why score breakdown
      is stored as jsonb; why idempotency uses UNIQUE constraint not application
      logic; why server delegates to engine scoring instead of re-implementing
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-053 checked off with today's date
