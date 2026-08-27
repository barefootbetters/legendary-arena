# WP-619 — Human+Bot Matches Earn Shared Badges

**Status:** Ready
**Primary Layer:** Server (`apps/server/src/badges/**` + the competition issuance caller)
**Dependencies:** WP-614 / D-24425 (the shared `united-front` badge + `issueSharedMatchBadges`), WP-615 / D-24426 (the tiers), WP-617 / D-24428 (the by-matchId roster read this reuses), WP-354 (`computeRankedEligibility`'s human-vs-total-seat precedent)
**User-Visible Surface:** `play.legendary-arena.com` (the player profile badge list)

> Baseline: `origin/main` (post WP-618).

---

## Session Context

Operator-reported (from a 2-player human+bot co-op win): the shared / tiered
badges (United Front, Trio…) did not fire. Traced: `issueSharedMatchBadges` gates
completeness on `rows.length === playerCount` — every seat must have submitted a
competitive score. A **bot** (or guest) seat has no account and never submits, so
a human+bot match never completes the `replay_hash` group — making the shared
badges **unreachable in the common bot-ally co-op mode**.

The fix: complete the group when every **human** seat has submitted. The
authenticated-seat count is exactly `readSeatAccounts(matchId).length` (the same
human-vs-total-seat distinction `computeRankedEligibility` already uses), and
WP-617's by-matchId caller already reads that roster — so `humanSeatCount =
roster.length` is free to thread.

---

## Goal

A human+bot co-op match where every human finished sub-PAR earns the shared
badge (and its size tier) for the humans, awarded once every **human** seat has
submitted — not once every `playerCount` seat.

---

## User-Visible Impact

Playing co-op with bot allies now earns United Front / Trio / Quartet / Quintet
(by table size) when the humans finish sub-PAR — previously only all-human tables
could.

---

## Assumes

- WP-614/615 on `main`: `issueSharedMatchBadges(replayHash, playerCount,
  configVersion, database)` gates on `rows.length === playerCount`, requires
  `playerCount >= 2` + all-sub-PAR, and awards united-front (+ tier by `playerCount`).
- WP-617 on `main`: the by-matchId caller reads `readSeatAccounts(matchId)` →
  `[{playerId: seat, accountId}]` and threads `submitterSeatId` via `SubmissionDependencies`.
- `readSeatAccounts` returns only AUTHENTICATED (human) seats — bots/guests have no row.
- `pnpm -r build` 0; server suite green on the baseline (badge tests use a mock `DatabaseClient`).

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/server/src/badges/badge.shared.ts` — `issueSharedMatchBadges` + the
  `rows.length !== playerCount` completeness gate.
- `apps/server/src/competition/competition.logic.ts` — the WP-617 roster read (derive
  `humanSeatCount = roster.length`), `SubmissionDependencies`, `submitCompetitiveScoreForRequest`,
  the `issueSharedMatchBadges` call.
- `apps/server/src/match/seatAccount.logic` — `readSeatAccounts` (authenticated seats) + `readMatchSeatCount` (total).
- `docs/ai/DECISIONS.md` D-24425 (the shared badge), D-24426 (the tiers), D-1004 (anti-volume / append-only).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `00.6`; a `// why:` on the human-vs-total-seat gate.

**Packet-specific:**
- **Only the completeness gate changes.** `playerCount >= 2` (the table-size guard,
  bots included) stays; the tiers still key on `playerCount`; the all-sub-PAR check,
  the multi-row INSERT, and `ON CONFLICT DO NOTHING` are unchanged.
- **Reuse the WP-617 roster read** — `humanSeatCount = roster.length` from the same
  `readSeatAccounts` call; no second roster read.
- **Fail-safe fallback.** `humanSeatCount = null` (roster error, or the by-hash path)
  → the gate falls back to `playerCount` (the old behaviour). Runs inside the existing
  fire-and-forget badge try/catch — never fails the submission.
- **Read-only / append-only.** No migration, no new `source_kind`, no `/badges/*` route;
  no hash surface.

**Locked values:** new param `humanSeatCount: number | null` (last position);
gate `rows.length === (humanSeatCount ?? playerCount)`.

---

## Scope (In)

### A) `badge.shared.ts` (**modified**)
- `issueSharedMatchBadges` gains `humanSeatCount: number | null`; the completeness
  gate becomes `rows.length === (humanSeatCount ?? playerCount)`. Everything else
  (the `< 2` guard, all-sub-PAR, tiers, INSERT) unchanged, with a `// why:`.

### B) `competition.logic.ts` (**modified**)
- Derive `humanSeatCount = roster.length` in the WP-617 roster block (reuse the read);
  add `humanSeatCount?` to `SubmissionDependencies`; thread it through
  `submitCompetitiveScoreForRequest` and pass `deps.humanSeatCount ?? null` to
  `issueSharedMatchBadges`. Fail-safe null on a roster error.

### C) `badge.shared.test.ts` (**modified**)
- Thread the new arg (`null`) into the existing calls; add: a human+bot table
  (`humanSeatCount < playerCount`) completes when the humans submit; a 2-human table
  still needs both; a solo (`playerCount 1`) match stays blocked by the `< 2` guard.

---

## Out of Scope

- **No change to the tiers' keying** — they still reflect the full table size
  (`playerCount`, bots included). Human-count-based tiers are a possible later refinement.
- **No change to the `playerCount >= 2` guard** — a 2-seat human+bot table qualifies;
  a solo match does not.
- **No change to Vanguard / solo / per-run badges.**
- **No migration, no new `source_kind`, no new table, no route.**
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/badges/badge.shared.ts` — **modified** — `humanSeatCount` param + gate
- `apps/server/src/competition/competition.logic.ts` — **modified** — derive + thread `humanSeatCount`
- `apps/server/src/badges/badge.shared.test.ts` — **modified** — human+bot completeness cases

No other **code** files may be modified. (The `EC-654:` implementation commit
touches exactly these 3; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

Cooperative recognition, never power (§24). Anti-volume (§25 / D-0005) and no-PvP
(§23b) hold (a quality gate over a cooperating table). Read-only over the immutable
`competitive_scores` rows — no state-hash surface, no score change.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint; the change is inside the existing internal issuer + its caller.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `issueSharedMatchBadges` gates on `rows.length === (humanSeatCount ?? playerCount)`;
  everything else unchanged.
- [ ] A human+bot table (`humanSeatCount 1`, `playerCount 2`, 1 sub-PAR row) awards
  united-front to the human; a 2-human table still needs both; a solo (`playerCount 1`)
  match awards nothing.
- [ ] The caller derives `humanSeatCount = roster.length` (reusing the WP-617 read) and
  threads it; a roster error falls back to `playerCount` (fail-safe).
- [ ] `pnpm -r build` 0; server suite green; the `EC-654:` diff is exactly the 3 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test   # badge tests use a mock DatabaseClient
# Expected: exits 0 / all pass (+ the human+bot completeness cases)

Select-String -Path "apps\server\src\badges\badge.shared.ts" -Pattern "humanSeatCount"
# Expected: the param + the `?? playerCount` gate

git diff --name-only
# Expected (implementation commit): only the 3 files.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  a human+bot co-op sub-PAR win shows United Front (and the size tier) on the human's profile.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; server suite green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24430 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-619 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (≥2 Out-of-Scope). §2 Constraints — PASS (gate-only change;
  reuse the roster read; fail-safe; locked values). §3 Assumes — PASS. §4 Context —
  PASS (cites the gate, the WP-617 roster read, the ranked-eligibility precedent).
  §5 Files — PASS (3 code files). §6 Naming — PASS. §7 Deps — PASS (none; no migration).
  §8 Boundaries — PASS (server). §9 — PASS. §10 — N/A. §11 Persistence — PASS
  (read-only / append-only). §12 Tests — PASS (human+bot cases). §13 — PASS. §14
  Acceptance — PASS (4 binary). §15/§15.1 — PASS (surface + D-24026). §16 — PASS.
  §17 Vision — PASS. §18 Prose-vs-grep — PASS. §19 — N/A. §20 Funding / §21 API — N/A.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-27).**

- **Dependencies verified against `origin/main`:** `issueSharedMatchBadges` gates on
  `rows.length === playerCount`; the WP-617 by-matchId caller reads `readSeatAccounts`;
  `computeRankedEligibility` already distinguishes `readSeatAccounts` (humans) from
  `readMatchSeatCount` (total). No collision.
- **Soundness:** a bot/guest seat has no `competitive_scores` row, so `readSeatAccounts.length`
  (humans) is the correct expected-submitter count; the `< 2` table-size guard on
  `playerCount` (bots included) keeps a solo match ineligible.
- **PS items (blocking): none.** Reuses the existing roster read; the threading mirrors WP-617.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-27).** The only behavioural change is the completeness
denominator (human seats vs total seats). Judgement calls, documented: (1) a **lone
human + bot(s)** now earns United Front — intended (the ask was to let bot-ally co-op
count); (2) tiers still key on **table size** (`playerCount`), so a 1-human+4-bot match
would earn Quintet — consistent with "table size", flagged as a possible refinement;
(3) fail-safe falls back to `playerCount`. Anti-volume / no-PvP hold. Session-prompt
generation folded into this combined draft+execute.

---

## Reserved Decisions (land at execution)

- **D-24430 (reserved; Drafted 2026-08-27)** — The shared cooperative badge's
  completeness gate awaits every **human** seat, not every `playerCount` seat
  (extends D-24425): `rows.length === (humanSeatCount ?? playerCount)`, where
  `humanSeatCount = readSeatAccounts(matchId).length` (authenticated seats, reusing
  the WP-617 roster read, threaded via `SubmissionDependencies`). A bot/guest seat
  never submits, so a **human+bot** co-op match now earns the shared / tiered badges
  once the humans finish sub-PAR. The `playerCount >= 2` table-size guard (bots
  included) and the `playerCount`-keyed tiers are unchanged; the by-hash path
  (`humanSeatCount` null) keeps the full-`playerCount` gate. Read-only / append-only,
  no migration. Consequences accepted: a lone human + bot(s) earns United Front, and
  the size tier reflects the full table (a human-count tier is deferred).

---

## See Also

- WP-614 / D-24425 (the shared badge), WP-615 / D-24426 (the tiers), WP-617 / D-24428 (the roster read reused)
- WP-354 / `computeRankedEligibility` — the human-vs-total-seat precedent
