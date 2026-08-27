# WP-617 — Vanguard Badge (led the table's mastermind fight)

**Status:** Ready
**Primary Layer:** Server (`apps/server/src/badges/**` + the competition issuance caller)
**Dependencies:** WP-616 / D-24427 (`PlayerScoringContribution.mastermindTacticsDefeated`, the per-seat count this reads), WP-105 / D-1004 (Tier-1 badge system), WP-593 / D-24402 (`readAuthenticatedSeats` seat↔account roster), D-24134 (`playerCount`)
**User-Visible Surface:** `play.legendary-arena.com` (the player profile badge list)

> Baseline: `origin/main` at commit `7c5f62d7` (EC-651: Per-player team-contribution attribution, #1673).

---

## Session Context

WP-616 built the data foundation: `ScoreBreakdown.inputs.perPlayer[]` now carries
each seat's `mastermindTacticsDefeated`. This packet is its first **consumer** — a
recognition badge for the player who **led the table's mastermind fight**, the
tractable form of the design page's "who let someone else land the killing blow."

**Self-award, per-submission.** A submitting player earns `gameplay.team.vanguard`
when — in a co-op match — **their own seat** defeated the strict-maximum mastermind
tactics of the table. "Strict maximum" means their count is the highest AND at
least one other seat defeated fewer (so a table that split tactics evenly has no
standout, and no Vanguard). Reads only the submitter's own contribution against the
`perPlayer[]` split — no cross-account award, so a player only ever earns their own
badge.

The one join: `perPlayer[]` is keyed by **bgio seat id** (`"0"` / `"1"`), while
issuance targets the submitter's **account** — so the caller resolves the
submitter's seat from the match's authenticated-seat roster
(`readAuthenticatedSeats(matchId)` → `[{ playerId: seat, accountId }]`, matching the
submitter's `accountId`) and threads it to the issuer.

---

## Goal

A submitter earns `gameplay.team.vanguard` iff: `playerCount ≥ 2`; the breakdown's
`perPlayer[]` is present with ≥ 2 seats; the submitter's seat entry exists; and the
submitter's seat's `mastermindTacticsDefeated` equals the table maximum, that
maximum is ≥ 1, and it strictly exceeds the table minimum (a real standout).

---

## User-Visible Impact

The profile badge list gains **"Vanguard"** for the player who defeated the most
of the mastermind's tactics at a co-op table — recognition for carrying the team's
offensive fight. Solo runs and even-split tables never earn it.

---

## Assumes

- WP-616 on `main`: `PlayerScoringContribution` carries `mastermindTacticsDefeated`;
  `ScoreBreakdown.inputs: ScoringInputs` with `perPlayer?: PlayerScoringContribution[]`
  (sorted by seat id, optional — absent on pre-WP-588 records).
- WP-105 badge modules: `issueTier1BadgesForSubmission(playerId, scoreId, breakdown,
  scenarioKey, configVersion, database, playerCount)` (WP-613 added `playerCount`) +
  `evaluatePerRunBadges(breakdown, playerCount)`; `TIER_1_BADGE_KEYS` = 13 (drift-pinned).
- `apps/server/src/match/seatAccount.logic` exposes a read of the match's
  authenticated seats as `[{ playerId: string (seat), accountId: AccountId }]`
  (used by WP-593's endgame roster).
- The competition submission has `matchId` + the submitter's `accountId` at the
  badge-issuance point; migration 013 `source_kind` allows `'competitive_score'`
  (per-run, `source_ref` = scoreId) — no migration.
- `pnpm -r build` 0; server suite green on `7c5f62d7` (badge tests use a mock `DatabaseClient`).

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/server/src/badges/badge.predicates.ts` — `evaluatePerRunBadges` (extend
  its signature with the submitter seat) + the `isEligible*` predicates.
- `apps/server/src/badges/badge.issuance.ts` — `issueTier1BadgesForSubmission`
  (thread `submitterSeatId`; pass to `evaluatePerRunBadges`).
- `apps/server/src/badges/badge.types.ts` — `TIER_1_BADGE_KEYS` (13) + `BADGE_DEFINITIONS`.
- `apps/server/src/badges/badge.predicates.test.ts` — the mock-free predicate tests + the drift pin.
- `apps/server/src/competition/competition.logic.ts` — the issuance caller; resolve
  the submitter's seat via `readAuthenticatedSeats(matchId)` (matching `record.accountId`) and pass it.
- `apps/server/src/match/seatAccount.logic` — the seat↔account roster read.
- `packages/game-engine/src/scoring/parScoring.types.ts` — `ScoreBreakdown.inputs.perPlayer`.
- `docs/ai/DECISIONS.md` D-24427 (the per-seat counts), D-1004 (anti-volume / no-PvP / append-only), D-24402 (seat roster).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, `node:` prefix; `.test.ts`; human-style code per `00.6`; `for...of` (no branching `.reduce()`).

**Packet-specific (D-1004 binding):**
- **Self-award only.** The badge is issued to the SUBMITTER (their own `player_id`,
  the existing per-run INSERT), never to another account. `sourceKind
  'competitive_score'`, `source_ref` = the submission's scoreId.
- **Strict-standout gate.** Award iff `playerCount ≥ 2` AND `perPlayer` present (≥ 2
  seats) AND the submitter's seat's `mastermindTacticsDefeated` `=== max` AND
  `max ≥ 1` AND `max > min` across seats. A missing `perPlayer`, a missing submitter
  seat, an even split (`max === min`), or a zero max → no award.
- **Anti-volume / no-PvP / append-only.** Quality/skill-gated (led the mastermind
  fight — never a volume count); cooperative framing (the table vs the mastermind);
  reuse the existing INSERT + `ON CONFLICT DO NOTHING`. No migration, no new
  `source_kind`, no `/badges/*` route, no `tier IN (2,3)`.
- **Read-only over immutable data.** Reads the deserialized `ScoreBreakdown` +
  the seat roster; never recomputes a score or re-executes a replay. No hash surface.
- **Fail-safe seat resolution.** If the submitter's seat cannot be resolved (roster
  read error / guest seat), the Vanguard evaluation degrades to no-award — it never
  fails the submission (it rides the existing fire-and-forget badge try/catch).
- **Drift pin.** `TIER_1_BADGE_KEYS` 13 → 14 with `BADGE_DEFINITIONS` in lockstep.

**Locked values (do not re-derive):**
- Key `gameplay.team.vanguard`, label "Vanguard", `sourceKind 'competitive_score'`.
- Eligibility ⇔ `playerCount ≥ 2 && perPlayer.length ≥ 2 && submitterSeat found &&
  submitterCount === max(counts) && max ≥ 1 && max > min(counts)`, where
  `counts = perPlayer.map(mastermindTacticsDefeated)`.

---

## Scope (In)

### A) `badge.types.ts` (**modified**)
- Add `gameplay.team.vanguard` to `TIER_1_BADGE_KEYS` (13 → 14) + `BADGE_DEFINITIONS`
  (`sourceKind: 'competitive_score'`, label "Vanguard", description per Goal).

### B) `badge.predicates.ts` (**modified**)
- `isEligibleVanguard(perPlayer, submitterSeatId, playerCount)` implementing the
  strict-standout gate (pure over the deserialized `perPlayer` slice). Extend
  `evaluatePerRunBadges(breakdown, playerCount, submitterSeatId)` to push
  `gameplay.team.vanguard` when eligible (reads `breakdown.inputs?.perPlayer`).

### C) `badge.issuance.ts` (**modified**)
- Thread `submitterSeatId: string | null` into `issueTier1BadgesForSubmission`;
  pass it to `evaluatePerRunBadges`. INSERT path unchanged.

### D) `competition.logic.ts` (**modified**)
- Resolve the submitter's seat from `readAuthenticatedSeats(matchId)` (the entry
  whose `accountId === record.accountId`; null if none) and pass it to
  `issueTier1BadgesForSubmission`. Inside the existing fire-and-forget try/catch.

### E) Tests (**modified**)
- `badge.predicates.test.ts` — `isEligibleVanguard` (submitter is sole max → true;
  submitter tied at max but max === min → false; submitter not max → false; solo /
  missing perPlayer / missing seat → false) + the drift pin 13 → 14 + the
  `evaluatePerRunBadges` extra arg.
- `badge.issuance.test.ts` — thread the new arg in the existing calls + a Vanguard
  issuance case (submitter seat is the sole tactic leader → the key is INSERTed).

---

## Out of Scope

- **No cross-account / match-level award** — self-award only (the submitter earns
  their own Vanguard); the "award the objective top seat's account" variant (needs
  ext_id → player_id resolution) is deferred.
- **No win-gating** — Vanguard recognizes leading the mastermind fight whether the
  match was won or lost; a win requirement is a possible later refinement.
- **No villain/henchman Vanguard variant** — this MVP is mastermind tactics only
  (the clearest "carried the win" signal); other-metric badges are follow-ons.
- **No literal causal "A enabled B"** — infeasible (per D-24427).
- **No migration, no new `source_kind`, no new table, no route.**
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/badges/badge.types.ts` — **modified** — key + definition; 13 → 14
- `apps/server/src/badges/badge.predicates.ts` — **modified** — `isEligibleVanguard` + `evaluatePerRunBadges(…, submitterSeatId)`
- `apps/server/src/badges/badge.issuance.ts` — **modified** — thread `submitterSeatId`
- `apps/server/src/competition/competition.logic.ts` — **modified** — resolve + pass the submitter's seat
- `apps/server/src/badges/badge.predicates.test.ts` — **modified** — Vanguard predicate + drift 13 → 14
- `apps/server/src/badges/badge.issuance.test.ts` — **modified** — thread arg + Vanguard issuance case

No other **code** files may be modified. (The `EC-652:` implementation commit
touches exactly these 6; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

Cooperative recognition, never power (§24 no-pay-to-win). Anti-volume (§25 /
D-0005 — skill-gated, not a count) and no-PvP (§23b — the table vs the mastermind,
never head-to-head) hold. Read-only over the immutable `ScoreBreakdown` + the seat
roster — **no state-hash surface**, no score change.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint; the change is inside the existing `issueTier1BadgesForSubmission`
internal issuer + its caller (not a cataloged public surface).

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `TIER_1_BADGE_KEYS` has 14 keys (adds `gameplay.team.vanguard`);
  `BADGE_DEFINITIONS` matches; the drift test passes at 14.
- [ ] `isEligibleVanguard`: true only when the submitter's seat is the strict tactic
  standout (`=== max`, `max ≥ 1`, `max > min`, `playerCount ≥ 2`, ≥ 2 seats); false
  for even split, non-max submitter, solo, missing `perPlayer`, or missing seat.
- [ ] `evaluatePerRunBadges` pushes the Vanguard key alongside the existing per-run
  keys when eligible; `issueTier1BadgesForSubmission` threads the submitter seat.
- [ ] `competition.logic.ts` resolves the submitter's seat (fail-safe: null → no award).
- [ ] `pnpm -r build` 0; server suite green; the `EC-652:` diff is exactly the 6 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test   # badge tests use a mock DatabaseClient
# Expected: exits 0 / all pass (+ the Vanguard predicate + issuance tests)

Select-String -Path "apps\server\src\badges\badge.predicates.ts" -Pattern "isEligibleVanguard|team.vanguard"
# Expected: the strict-standout predicate + the key

git diff --name-only
# Expected (implementation commit): only the 6 files in ## Files Expected to Change.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  in a co-op match where one player defeated the most mastermind tactics, that
  player's profile shows "Vanguard" and the others' do not.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; server suite green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24428 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-617 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS
  (self-award, strict-standout gate, anti-volume / no-PvP / append-only, fail-safe;
  locked values). §3 Assumes — PASS. §4 Context — PASS (cites `perPlayer`, the seat
  roster, the per-run path, D-1004). §5 Files — PASS (6 code files; governance
  separate). §6 Naming — PASS. §7 Deps — PASS (none; no migration). §8 Boundaries —
  PASS (server layer; reads the engine `ScoreBreakdown` type + server roster).
  §9 Windows — PASS. §10 — N/A. §11 Persistence — PASS (read-only over immutable
  rows; append-only INSERT). §12 Tests — PASS (predicate + issuance cases).
  §13 — PASS. §14 Acceptance — PASS (5 binary). §15/§15.1 — PASS (surface + D-24026).
  §16 — PASS. §17 Vision — PASS. §18 Prose-vs-grep — PASS. §19 — N/A. §20 Funding /
  §21 API — N/A with reasons.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-26).**

- **Dependencies verified against `origin/main` (`7c5f62d7`):** `ScoreBreakdown.inputs.perPlayer`
  carries `mastermindTacticsDefeated` (WP-616); `evaluatePerRunBadges(breakdown, playerCount)`
  + the per-run INSERT path (WP-613); `readAuthenticatedSeats` returns `[{ playerId: seat,
  accountId }]` (WP-593); `TIER_1_BADGE_KEYS` = 13. No key collision.
- **The one join** (seat → account) is resolvable via the existing authenticated-seat
  read; the submitter's own `player_id` is the award target (no ext_id → player_id
  resolution needed for self-award).
- **Anti-volume audit:** skill-gated (tactic-defeat standout), not a count of plays. Compliant.
- **PS items (blocking): none.** The signature threading (submitter seat) is additive;
  `badge.issuance.test.ts` updates its calls (the WP-613 precedent).

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-26).** Self-award sidesteps the cross-account
seat→player_id resolution (the submitter's `player_id` is known; only their seat is
needed, from the existing roster read). Judgement calls: (1) **strict standout**
(`max > min`) so an even split awards no one — matches "who carried"; (2) **no
win-gate** in the MVP (leading the mastermind fight counts win or loss) — documented
as a refinement; (3) **mastermind tactics** as the metric (the clearest carried-the-win
signal), villains/henchmen deferred; (4) fail-safe seat resolution rides the existing
fire-and-forget badge try/catch. Anti-volume / no-PvP hold. Session-prompt generation
authorized.

---

## Reserved Decisions (land at execution)

- **D-24428 (reserved; Drafted 2026-08-26)** — Add the **Vanguard** badge
  (`gameplay.team.vanguard`), the first consumer of WP-616's per-seat
  `mastermindTacticsDefeated`. **Self-award, per-run:** a submitter earns it when, in
  a co-op match (`playerCount ≥ 2`), their own seat is the **strict tactic-defeat
  standout** of the table (`submitterCount === max(perPlayer counts) && max ≥ 1 &&
  max > min`). The submitter's seat is resolved from the match's authenticated-seat
  roster (`readAuthenticatedSeats`, matching `accountId`); the badge is issued to the
  submitter's own `player_id` via the existing per-run INSERT (`sourceKind
  'competitive_score'`, `source_ref` = scoreId, `ON CONFLICT DO NOTHING`). Honors
  D-1004: skill-gated (never volume), cooperative-model-safe framing, read-only over
  the immutable `ScoreBreakdown` (no hash surface), append-only, no migration.
  **Deferred:** the match-level "award the objective top seat's account" variant
  (needs ext_id → player_id resolution), win-gating, and villain/henchman variants.

---

## See Also

- WP-616 / D-24427 — the `perPlayer[].mastermindTacticsDefeated` this consumes
- WP-593 / D-24402 — the authenticated-seat roster used to resolve the submitter's seat
- WP-613 / WP-614 / WP-615 — the sibling badge lanes (solo / shared / tiered)
- `wiki/awards-and-badges.md` — the "enabled an ally" design (and the causal-form deferral)
