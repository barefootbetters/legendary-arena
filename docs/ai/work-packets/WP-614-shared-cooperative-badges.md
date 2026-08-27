# WP-614 — Shared Cooperative Badges (whole-table, grouped by replay_hash)

**Status:** Ready
**Primary Layer:** Server (`apps/server/src/badges/**` + the competition issuance caller)
**Dependencies:** WP-105 / D-1004 (Tier-1 badge system), WP-613 / D-24424 (the Solo Mastery lane this sits beside), D-24134 (`playerCount`), WP-338 (submit-by-`matchId` → server-derived `replay_hash`)
**User-Visible Surface:** `play.legendary-arena.com` (the player profile badge list)

> Baseline: `origin/main` at commit `444341d7` (EC-648: Solo Mastery badges, #1663).

---

## Session Context

The `wiki/awards-and-badges.md` design page's **centerpiece** is cooperative
recognition: *"reward the goose, not the eggs"* — and the strongest form it names
is the **shared / table badge**: *"awarded to the whole table, not a person. Nobody
can farm it alone, so it cannot be gamed selfishly."* WP-613 added the solo lane
but left this deferred, because a shared badge needs cross-player, table-level
data — which the per-player `competitive_scores` row does not obviously carry.

**The data path exists after all.** Competitive submission is by `matchId`
(WP-338): the server resolves `replay_hash` from the shared
`bgio.replay_artifacts` and re-executes it. Every player of one co-op match
therefore derives the **same `replay_hash`** — the table's per-account rows
(`UNIQUE (player_id, replay_hash)`) share it. So **`replay_hash` is a natural
match-grouping key**: the set of `competitive_scores` rows with a given
`replay_hash` is exactly that match's players. No new column, no migration.

This packet adds the first shared cooperative badge on that grouping.

**Still deferred:** the design's "player A enabled player B's finish" flavor needs
**turn-level contribution attribution** that scoring does not capture — out of
scope here (a much larger engine-projection effort).

---

## Goal

A co-op match (`playerCount ≥ 2`) in which **every** player finished sub-PAR
earns a single shared badge — **United Front** — awarded to **all** players in the
match, evaluated over the `replay_hash` group when it is complete.

---

## User-Visible Impact

The profile badge list gains **"United Front"** — a whole-table achievement a
player can only earn *with* their table, never alone. Solo and single-player runs
never earn it.

---

## Assumes

- WP-105 + WP-613 on `main`: the `apps/server/src/badges/**` modules,
  `issueTier1BadgesForSubmission(...)` called from `competition.logic.ts` in the
  submission transaction, `TIER_1_BADGE_KEYS` (9) drift-pinned.
- `competitive_scores` carries `replay_hash`, `player_count`, `final_score`,
  `player_id`; migration 013 `source_kind CHECK (... IN ('competitive_score',
  'competitive_history'))` — a shared badge reuses `'competitive_history'`
  (`source_ref` NULL), so **no migration**.
- All co-op players of one match share the same `replay_hash` (server-derived from
  the match's replay artifact, WP-338); each submits their own per-account row.
- `CompetitiveScoreRecord.replayHash` + `.playerCount` are on the record the caller
  already holds.
- `pnpm -r build` 0; server suite green on `444341d7` (DB-gated suites skip without
  a local pg; badge tests use a mock `DatabaseClient`).

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/server/src/badges/badge.issuance.ts` — the per-player issuance path + the
  multi-row INSERT + `ON CONFLICT DO NOTHING` idiom to reuse for the group award.
- `apps/server/src/badges/badge.veteran.ts` — the `DatabaseClient` query idiom.
- `apps/server/src/badges/badge.types.ts` — `TIER_1_BADGE_KEYS` (9),
  `BADGE_DEFINITIONS`, `BadgeDefinition`.
- `apps/server/src/competition/competition.logic.ts` — the submission hook (call
  the shared issuer after `issueTier1BadgesForSubmission`); `competition.types.ts`
  `CompetitiveScoreRecord.{replayHash, playerCount}`.
- `docs/ai/DECISIONS.md` D-1004 (Tier-1 issuer model, anti-volume, no-PvP,
  append-only), D-24424 (the solo lane), D-24134 (`playerCount`), D-5302 (immutable
  competitive rows).
- `wiki/awards-and-badges.md` — the shared-badge design; `.claude/skills/legendary-{server,persistence}/SKILL.md`.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, `node:` prefix; `.test.ts`; human-style code per `00.6`; JSDoc per export.

**Packet-specific (D-1004 binding):**
- **Shared, ungameable.** Gated on `playerCount ≥ 2` AND **every** row in the
  `replay_hash` group `final_score < 0`. A solo/1-player match never qualifies.
- **Anti-volume / no-PvP / append-only (D-1004).** Quality-gated (all sub-PAR),
  cooperative framing (the whole table vs the mastermind — never head-to-head).
  Reuses the existing INSERT + `ON CONFLICT DO NOTHING`; `source_kind =
  'competitive_history'`, `source_ref NULL`. **No migration, no new source_kind,
  no `/badges/*` route, no `tier IN (2,3)`.**
- **Last-submitter-awards-all.** The group is evaluated on every submission; the
  badge is INSERTed for **all** players in the group only when the group is
  **complete** (`rows.length === playerCount`) and qualifies. Earlier submissions
  (incomplete group) award nothing; `ON CONFLICT DO NOTHING` makes the repeated
  full-group INSERT idempotent.
- **Projection over immutable rows (D-5302 / D-1004).** Reads `competitive_scores`
  only; never re-executes a replay, never recomputes a score. No state-hash surface.
- **Fire-and-forget.** Shared issuance runs in the same try/catch as the per-player
  issuer — a failure degrades to a warning, never fails the submission.
- **Drift pin.** `TIER_1_BADGE_KEYS` 9 → 10 with `BADGE_DEFINITIONS` in lockstep.

**Locked values (do not re-derive):**
- Key: `gameplay.shared.united-front`; label "United Front"; `sourceKind
  'competitive_history'`; `source_ref` NULL.
- Qualify ⇔ `playerCount ≥ 2 && rows.length === playerCount && every(final_score < 0)`.
- Group query: `SELECT player_id, final_score FROM legendary.competitive_scores
  WHERE replay_hash = $1`.

---

## Scope (In)

### A) `badge.types.ts` (**modified**)
- Add `gameplay.shared.united-front` to `TIER_1_BADGE_KEYS` (9 → 10) +
  `BADGE_DEFINITIONS` (`sourceKind: 'competitive_history'`, label "United Front",
  description per Goal).

### B) `badge.shared.ts` (**new**)
- `issueSharedMatchBadges(replayHash, playerCount, configVersion, database)`:
  queries the `replay_hash` group; when `playerCount ≥ 2 && rows.length ===
  playerCount && every final_score < 0`, INSERTs `gameplay.shared.united-front`
  for **every** `player_id` in the group (one multi-row INSERT + `ON CONFLICT DO
  NOTHING`), `source_kind 'competitive_history'`, `source_ref NULL`. Otherwise a
  no-op. Same layer purity as `badge.veteran.ts` (no runtime engine import).

### C) `competition.logic.ts` (**modified**)
- After `issueTier1BadgesForSubmission(...)`, inside the same try/catch, call
  `issueSharedMatchBadges(record.replayHash, record.playerCount, record.scoringConfigVersion, database)`.

### D) `badge.shared.test.ts` (**new**)
- Mock `DatabaseClient`: qualifying complete group (2 players, both sub-PAR) →
  INSERT for both player_ids; incomplete group (`rows.length < playerCount`) →
  no INSERT; complete but one player ≥ 0 → no INSERT; `playerCount < 2` → no
  INSERT; INSERT uses `competitive_history` + NULL `source_ref` + `ON CONFLICT DO NOTHING`.

### E) `badge.predicates.test.ts` (**modified**)
- The `TIER_1_BADGE_KEYS` exact-count drift pin 9 → 10.

---

## Out of Scope

- **No "player A enabled player B" / turn-level contribution badges** — scoring
  captures no per-turn attribution; a much larger engine-projection effort.
- **No tiered team badges (5/4/3/2-player variants)** — a later refinement once
  the single shared badge validates the grouping model.
- **No retroactive re-issuance of shared badges to already-completed matches** —
  forward-only from this WP (a backfill would be a separate ops WP).
- **No migration, no new `source_kind`, no new table, no `/badges/*` route.**
- **No change to the per-player or solo issuance paths** (WP-105 / WP-613).
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/badges/badge.types.ts` — **modified** — key + definition; 9 → 10
- `apps/server/src/badges/badge.shared.ts` — **new** — `issueSharedMatchBadges`
- `apps/server/src/competition/competition.logic.ts` — **modified** — call the shared issuer
- `apps/server/src/badges/badge.shared.test.ts` — **new** — group evaluation + multi-player award
- `apps/server/src/badges/badge.predicates.test.ts` — **modified** — drift 9 → 10

No other **code** files may be modified. (The `EC-649:` implementation commit
touches exactly these 5; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

The cooperative fantasy rendered as recognition — the design page's thesis. A
shared badge is **recognition, never power** (§24 no-pay-to-win). Anti-volume
(§25 / D-0005) and no-PvP (§23b) hold: it is a quality gate over a cooperating
table, never a count, never head-to-head. Projection over immutable
`competitive_scores` rows (D-5302), so **no state-hash surface**.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint (issuance is an internal library call in the existing
competition pipeline). `issueSharedMatchBadges` is a new server library function
but not a cataloged public surface (the badge issuers are internal, like
`issueTier1BadgesForSubmission`).

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `TIER_1_BADGE_KEYS` has 10 keys (adds `gameplay.shared.united-front`);
  `BADGE_DEFINITIONS` matches; the exact-count drift test passes at 10.
- [ ] `issueSharedMatchBadges` awards `united-front` to **every** player in a
  complete (`rows.length === playerCount`), `playerCount ≥ 2`, all-sub-PAR group.
- [ ] It awards nothing for: an incomplete group, a group with any `final_score ≥
  0`, or `playerCount < 2`.
- [ ] The INSERT uses `source_kind 'competitive_history'`, `source_ref NULL`, and
  `ON CONFLICT DO NOTHING` (idempotent across the N submitters' hooks).
- [ ] The caller invokes it fire-and-forget (a failure warns, never fails the submission).
- [ ] `pnpm -r build` 0; server suite green; the `EC-649:` diff is exactly the 5 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test   # badge tests use a mock DatabaseClient; DB suites --test-concurrency=1
# Expected: exits 0 / all pass (+ the shared-badge group tests)

Select-String -Path "apps\server\src\badges\badge.shared.ts" -Pattern "replay_hash|united-front|ON CONFLICT"
# Expected: the group query + key + append-only INSERT

git diff --name-only
# Expected (implementation commit): only the 5 files in ## Files Expected to Change.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  a 2-player match where both players finished sub-PAR shows "United Front" on both profiles.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; server suite green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24425 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-614 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS
  (D-1004 anti-volume / no-PvP / append-only; shared-ungameable; last-submitter
  model; drift; locked values). §3 Assumes — PASS. §4 Context — PASS (cites the
  issuance idiom, D-1004, WP-338 replay_hash derivation, the two layer skills).
- §5 Files — PASS (5 code files; governance separate). §6 Naming — PASS. §7 Deps
  — PASS (none; no migration). §8 Boundaries — PASS (server layer; no runtime
  engine import; SQL server-side). §9 Windows — PASS. §10 — N/A. §11 Persistence
  — PASS (append-only, immutable-source projection; no `G` persistence; reuses
  `competitive_history`).
- §12 Tests — PASS (mock-DB group cases). §13 Commands — PASS. §14 Acceptance —
  PASS (6 binary). §15/§15.1 — PASS (surface + D-24026). §16 Code style — PASS.
  §17 Vision — PASS (§23b/§24/§25). §18 Prose-vs-grep — PASS. §19 — N/A. §20
  Funding — N/A. §21 API Catalog — N/A with reason (internal issuer, no route).

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-26).**

- **Dependencies verified against `origin/main` (`444341d7`):** WP-105 + WP-613
  badge modules present; `competitive_scores.{replay_hash, player_count,
  final_score, player_id}` exist; migration 013 `source_kind` allows
  `'competitive_history'` (no migration needed); submit-by-`matchId` (WP-338)
  derives `replay_hash` server-side from the shared artifact; `TIER_1_BADGE_KEYS`
  is 9 after WP-613. No name collision on the new key.
- **Grouping soundness:** all co-op players of one match share `replay_hash`
  (server-derived from the one replay artifact), so `WHERE replay_hash = $1` is the
  match's player set. `rows.length === playerCount` is the completeness gate.
- **Idempotency:** `ON CONFLICT DO NOTHING` on `(player_id, badge_key, source_ref)`
  / the partial index (`source_ref IS NULL`) makes the repeated full-group INSERT
  a no-op after the first complete evaluation — safe across the N submitters.
- **PS items (blocking): none.** The multi-player award is a new but additive INSERT path.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-26).** The grouping key (`replay_hash`) and the no-
migration `competitive_history` reuse are the two load-bearing choices, both
verified above. Judgement calls: (1) **last-submitter-awards-all** — earlier
submitters' hooks see an incomplete group and no-op; only the completing
submission awards everyone (correct, and idempotent under `ON CONFLICT`); (2) a
player who **never submits** blocks the badge for the whole table — accepted (the
shared achievement requires the whole table to record it, matching "nobody can
farm it alone"); (3) `united-front` is history-sourced (`source_ref NULL`) so it
sits with the veteran/breadth badges, not the per-run ones. Anti-volume and no-PvP
hold. Session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24425 (reserved; Drafted 2026-08-26, not yet landed)** — Add the first
  **shared cooperative badge** (extends D-1004 / D-24424), grouping the per-player
  `competitive_scores` rows by **`replay_hash`** (identical across a co-op match's
  players — server-derived from the shared replay artifact, WP-338). Badge
  `gameplay.shared.united-front` (`sourceKind 'competitive_history'`, `source_ref
  NULL`) is awarded to **all** players of a match when the `replay_hash` group is
  **complete** (`rows.length === playerCount`), `playerCount ≥ 2`, and **every**
  player finished sub-PAR (`final_score < 0`) — last-submitter-awards-all,
  idempotent via `ON CONFLICT DO NOTHING`. Honors D-1004: quality-gated (never
  volume), cooperative-model-safe framing, projection over immutable rows (D-5302),
  append-only, no migration (reuses `competitive_history`). The design's turn-level
  "enabled an ally" flavor + tiered team badges remain deferred.

---

## See Also

- WP-613 / D-24424 — the Solo Mastery lane this sits beside
- WP-105 / D-1004 — the Tier-1 badge system + issuer model
- WP-338 — submit-by-`matchId`, the server-side `replay_hash` derivation this groups on
- `wiki/awards-and-badges.md` — the shared / table badge design (the centerpiece)
