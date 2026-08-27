# WP-613 — Solo Mastery Badges (Tier-1 gameplay, playerCount-gated)

**Status:** Ready
**Primary Layer:** Server (`apps/server/src/badges/**` + the competition issuance caller)
**Dependencies:** WP-105 / D-1004 (the Tier-1 badge system this extends), D-24134 (`playerCount` on the competitive record), WP-048 / D-5301 (`ScoreBreakdown`)
**User-Visible Surface:** `play.legendary-arena.com` (the player profile badge list)

> Baseline: `origin/main` at commit `3143b8b8` (EC-647: Danger Meter escaped-bystander label, #1661).

---

## Session Context

The badge system already exists — WP-105 (D-1004) shipped Tier-1 rule-driven
gameplay badges: `legendary.player_badges` (append-only), 7 keys, per-run +
history predicates, an issuance hook in `competition.logic.ts`, profile display.
The `wiki/awards-and-badges.md` design page (descriptive) names a gap Tier-1 does
not yet fill: **"solo gets its own category, not nothing."** A player who beats a
scenario **solo** faces the whole mastermind alone — strictly harder — but earns
only the same player-count-agnostic badges as a full table.

This packet adds a **Solo Mastery lane**: two Tier-1 gameplay badges gated on
`playerCount === 1`, recognizing solo difficulty. It is a clean extension of the
existing per-run + breadth pattern — no new table, no new trust surface, no new
issuance path.

**Explicitly NOT this packet:** the design page's cooperative / **shared "table"**
/ retroactive badges. Those need cross-player, table-level data the per-player
`competitive_scores` row does not carry (the same class of gap the deferred
`bystander-guardian` / `steady-crew` badges hit). They are a follow-on that starts
with a data-plumbing WP, out of scope here.

---

## Goal

After this session, a player who completes a scenario **solo** at a quality bar
earns solo-specific badges: a **per-run** badge for a solo sub-PAR clear and a
**breadth** badge for solo sub-PAR clears across distinct scenarios. Multi-player
runs are unaffected.

---

## User-Visible Impact

The profile badge list gains up to two new badges for solo players — **"Lone
Defender"** (a solo sub-PAR clear) and **"Solitaire Master"** (solo sub-PAR clears
on ≥ 5 distinct scenarios). No change to any existing badge or to multi-player runs.

---

## Assumes

- WP-105 on `main`: `apps/server/src/badges/{badge.types,badge.predicates,
  badge.veteran,badge.issuance,badge.read}.ts` + migration 013 `legendary.player_badges`;
  `TIER_1_BADGE_KEYS` (7 keys) drift-pinned in `badge.predicates.test.ts`.
- `issueTier1BadgesForSubmission(playerId, scoreId, breakdown, scenarioKey,
  configVersion, database)` is the sole issuance entry point, called from
  `competition.logic.ts` inside the submission transaction.
- `evaluatePerRunBadges(breakdown)` is pure over `ScoreBreakdown`;
  `evaluateHistoryBadges(playerId, database)` runs `COUNT(DISTINCT scenario_key)
  WHERE player_id = $1 AND final_score < 0`.
- The competitive record + `legendary.competitive_scores` carry `player_count`
  (D-24134); `isEligibleSubParRun = finalScore < 0`.
- `pnpm -r build` 0; server suite green on `3143b8b8` (DB-backed badge tests run
  serialized against the local pg — see Verification).

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/server/src/badges/badge.types.ts` — `TIER_1_BADGE_KEYS`, `BADGE_DEFINITIONS`,
  `BadgeDefinition` (`sourceKind: 'competitive_score' | 'competitive_history'`).
- `apps/server/src/badges/badge.predicates.ts` — `isEligibleSubParRun`,
  `evaluatePerRunBadges` (extend its signature), the deferred-badge stub comments.
- `apps/server/src/badges/badge.veteran.ts` — `evaluateHistoryBadges` + the
  `COUNT(DISTINCT scenario_key)` query + the threshold consts (mirror for solo).
- `apps/server/src/badges/badge.issuance.ts` — `issueTier1BadgesForSubmission`
  (thread `playerCount` in; pass to `evaluatePerRunBadges`).
- `apps/server/src/competition/competition.logic.ts` — the caller (pass the
  submission's `playerCount`); `competition.types.ts` `CompetitiveScoreRecord.playerCount`.
- `docs/ai/PROPOSAL-BADGES.md` + `DECISIONS.md` D-1004 — the anti-volume / no-PvP /
  append-only / tiered-issuer constraints binding every badge.
- `.claude/skills/legendary-server/SKILL.md`; `.claude/skills/legendary-persistence/SKILL.md`.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, `node:` prefix; `.test.ts`; human-style code per `00.6`; JSDoc per export.

**Packet-specific (D-1004 binding):**
- **Anti-volume (§25 / D-0005).** Neither badge may count games/hours/VP.
  `lone-defender` is **quality-gated** (sub-PAR); `solitaire-master` is
  **breadth-gated** (distinct `scenario_key`s) — the D-1004-permitted forms. NOT
  "played N solo games."
- **No PvP framing (§23b).** Titles/flavor stay cooperative-model-safe (solo =
  alone against the mastermind, never head-to-head).
- **Per-player, immutable-source, append-only.** Both badges project from the
  immutable `competitive_scores` row / history; the existing multi-row INSERT +
  `ON CONFLICT DO NOTHING` is reused unchanged. No UPDATE, no new table, no
  `tier IN (2,3)` row, no `/badges/*` route.
- **`playerCount === 1` is "solo".** `player_count` is `number | null`; `null`
  (unknown) is NOT solo — the per-run predicate returns false, the history query
  filters `player_count = 1`.
- **Layer purity.** `badge.predicates.ts` keeps its type-only game-engine import;
  no runtime engine/`boardgame.io`/registry/preplan import; server owns the SQL.
- **Drift pin.** `TIER_1_BADGE_KEYS` 7 → 9 with `BADGE_DEFINITIONS` in lockstep;
  the exact-count drift test updated.

**Locked values (do not re-derive):**
- Keys: `gameplay.solo.lone-defender` (per-run), `gameplay.solo.solitaire-master` (history).
- `lone-defender` ⇔ `playerCount === 1 && finalScore < 0`.
- `solitaire-master` ⇔ `COUNT(DISTINCT scenario_key WHERE final_score < 0 AND player_count = 1) >= 5`.
- Threshold 5 (mirrors `MULTIVERSE_MASTERY_THRESHOLD`). Labels "Lone Defender" /
  "Solitaire Master".

---

## Scope (In)

### A) `badge.types.ts` (**modified**)
- Add the 2 keys to `TIER_1_BADGE_KEYS` (7 → 9) + their `BADGE_DEFINITIONS`
  entries (`lone-defender` `sourceKind: 'competitive_score'`; `solitaire-master`
  `sourceKind: 'competitive_history'`; descriptions per Goal).

### B) `badge.predicates.ts` (**modified**)
- `isEligibleLoneDefender(breakdown, playerCount)` = `playerCount === 1 &&
  isEligibleSubParRun(breakdown)`. Extend `evaluatePerRunBadges(breakdown,
  playerCount)` to push `gameplay.solo.lone-defender` when eligible. Existing
  per-run keys unchanged.

### C) `badge.veteran.ts` (**modified**)
- Add `SOLITAIRE_MASTER_THRESHOLD = 5` + a solo distinct-scenario `COUNT(DISTINCT
  scenario_key) WHERE player_id = $1 AND final_score < 0 AND player_count = 1`
  query; `evaluateHistoryBadges` pushes `gameplay.solo.solitaire-master` at ≥ 5.
  (One extra query; the existing veteran query is unchanged.)

### D) `badge.issuance.ts` (**modified**)
- Thread `playerCount: number | null` into `issueTier1BadgesForSubmission`; pass
  it to `evaluatePerRunBadges(breakdown, playerCount)`. INSERT path unchanged.

### E) `competition.logic.ts` (**modified**)
- The `issueTier1BadgesForSubmission(...)` call passes the submission's
  `playerCount` (from the record it already has). No other change.

### F) Tests (**modified**)
- `badge.predicates.test.ts` — `lone-defender` eligibility (solo+sub-PAR true;
  solo+non-sub-PAR false; multi-player+sub-PAR false; null-count false) + the
  `TIER_1_BADGE_KEYS` exact-count drift pin 7 → 9.
- `badge.veteran.test.ts` — `solitaire-master` at the 5-distinct-solo-scenario
  boundary (4 → none, 5 → earned; a multi-player sub-PAR row does not advance it).

---

## Out of Scope

- **No cooperative / shared "table" / retroactive badges** — they need
  cross-player data the per-player record lacks; a follow-on begins with a
  data-plumbing WP.
- **No team-vs-selfish signal** (the design page's open question — badge vs stat
  vs coaching line is undecided).
- **No Tier 2/3, no `/badges/*` route, no credential export, no new table.**
- **No new engine/scoring field** (no `masterStrikeResolved`, no per-scenario
  bystander count — those deferrals stand).
- **No difficulty-tier grading beyond sub-PAR** (grade-band solo badges are a
  possible later refinement, not this slice).
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/badges/badge.types.ts` — **modified** — 2 keys + definitions; 7 → 9
- `apps/server/src/badges/badge.predicates.ts` — **modified** — `isEligibleLoneDefender` + `evaluatePerRunBadges(breakdown, playerCount)`
- `apps/server/src/badges/badge.veteran.ts` — **modified** — solo breadth query + threshold
- `apps/server/src/badges/badge.issuance.ts` — **modified** — thread `playerCount`
- `apps/server/src/competition/competition.logic.ts` — **modified** — pass `playerCount`
- `apps/server/src/badges/badge.predicates.test.ts` — **modified** — solo per-run + drift 7 → 9
- `apps/server/src/badges/badge.veteran.test.ts` — **modified** — solo breadth boundary

No other **code** files may be modified. (The `EC-648:` implementation commit
touches exactly these 7; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

Serves the cooperative good-vs-evil fantasy without violating it: badges are
**recognition, never gameplay power** (§24 no-pay-to-win — a badge confers no
in-match advantage). Anti-volume (§25 / D-0005) and no-PvP (§23b) are honored by
construction (quality/breadth gating; solo-vs-mastermind framing). No scoring / PAR
/ leaderboard math changes — badges are a pure projection over the immutable
`competitive_scores` row (D-5301 / D-5302), so **no state-hash surface**.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy. (Badges are not
monetized; the overjustification caution in the design page is respected — no
purchase path.)

## API Catalog

N/A — no HTTP endpoint added/changed (issuance is an internal library call inside
the existing competition pipeline; no `/badges/*` route, per D-1004). No
`Library-only` catalog row changes: `issueTier1BadgesForSubmission` keeps its
name; its signature gains one parameter but it is not a cataloged public surface.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `TIER_1_BADGE_KEYS` has 9 keys (adds `gameplay.solo.lone-defender` +
  `gameplay.solo.solitaire-master`); `BADGE_DEFINITIONS` matches; the exact-count
  drift test passes at 9.
- [ ] `isEligibleLoneDefender`: true only for `playerCount === 1 && finalScore < 0`;
  false for multi-player, non-sub-PAR, and `null` count.
- [ ] `evaluatePerRunBadges(breakdown, playerCount)` returns the solo key alongside
  the existing per-run keys when eligible; multi-player runs are unchanged.
- [ ] `evaluateHistoryBadges` awards `solitaire-master` at ≥ 5 distinct
  `scenario_key`s with `final_score < 0 AND player_count = 1`; a multi-player
  sub-PAR row does not advance it.
- [ ] `issueTier1BadgesForSubmission` threads `playerCount`; `competition.logic.ts`
  passes it; issuance stays append-only / `ON CONFLICT DO NOTHING`.
- [ ] `pnpm -r build` 0; server suite green; the `EC-648:` diff is exactly the 7 files.

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0

# DB-backed badge tests run serialized against the local pg (TEST_DATABASE_URL);
# node:test --test-concurrency=1 for the DB suites (per the DB-gated-serialization rule).
pnpm --filter @legendary-arena/server test
# Expected: exits 0 / all pass (+ the new solo per-run + breadth tests)

Select-String -Path "apps\server\src\badges\badge.types.ts" -Pattern "solo.lone-defender|solo.solitaire-master"
# Expected: both keys present in TIER_1_BADGE_KEYS + BADGE_DEFINITIONS

git diff --name-only
# Expected (implementation commit): only the 7 files in ## Files Expected to Change.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  a solo sub-PAR run's profile shows "Lone Defender"; 5 distinct solo sub-PAR
  scenarios shows "Solitaire Master".
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; server suite green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24424 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-613 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS
  (D-1004 anti-volume / no-PvP / append-only; layer purity; drift; locked values).
- §3 Assumes — PASS. §4 Context — PASS (cites WP-105 modules, D-1004, the two
  layer skills). §5 Files — PASS (7 code files; governance separate). §6 Naming —
  PASS (badge keys match `00.2` slug style; no abbreviations). §7 Deps — PASS
  (none; `playerCount` already on the record).
- §8 Boundaries — PASS (server layer; predicates type-only from engine; SQL in
  server). §9 Windows — PASS. §10 — N/A. §11 Persistence — PASS (append-only,
  counts-only class; no `G` persistence; immutable-source projection).
- §12 Tests — PASS (per-run pure + DB-backed breadth, serialized). §13 Commands —
  PASS. §14 Acceptance — PASS (6 binary items). §15/§15.1 — PASS (surface +
  D-24026). §16 Code style — PASS. §17 Vision — PASS (§23b/§24/§25 addressed).
  §18 Prose-vs-grep — PASS (presence grep). §19 — N/A. §20 Funding — N/A (badges
  not monetized). §21 API Catalog — N/A with reason (no HTTP route; internal call).

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-26).**

- **Dependencies verified against `origin/main` (`3143b8b8`):** the WP-105 badge
  modules + issuance entry point + `evaluatePerRunBadges` / `evaluateHistoryBadges`
  present as described; `isEligibleSubParRun = finalScore < 0`; the history query
  filters `final_score < 0`; `competitive_scores.player_count` exists (D-24134);
  `CompetitiveScoreRecord.playerCount` present. No name collision on the new keys.
- **Anti-volume audit:** both criteria are D-1004-permitted (quality + breadth);
  neither is a raw count of plays.
- **PS items (blocking): none.** The one cross-cutting seam (thread `playerCount`
  from `competition.logic.ts` → issuance → per-run predicate) is additive.
- **DB posture:** the breadth test needs the local pg; run the badge DB suites at
  `--test-concurrency=1` (the DB-gated-serialization rule).

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-26).** The slice mirrors the shipped `sub-par-run` +
`multiverse-mastery` pair exactly, one solo-gated tier up, and reuses the issuance
INSERT verbatim. The only judgement calls: (1) `null` `playerCount` is treated as
not-solo (safe — an unknown count never awards a solo badge); (2) `lone-defender`
co-fires with the general `sub-par-run` for a solo player (intended — the solo
lane is additive recognition, per the design page, not a replacement). Anti-volume
and no-PvP both hold. Session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24424 (reserved; Drafted 2026-08-26, not yet landed)** — Add a **Solo Mastery
  lane** to Tier-1 gameplay badges (extends D-1004): two `playerCount`-gated badges
  — `gameplay.solo.lone-defender` (per-run: `playerCount === 1 && finalScore < 0`)
  and `gameplay.solo.solitaire-master` (breadth: ≥ 5 distinct `scenario_key`s with
  `final_score < 0 AND player_count = 1`). Both honor D-1004: quality-/breadth-gated
  (never volume), cooperative-model-safe framing (solo = alone vs the mastermind),
  per-player projection over the immutable `competitive_scores` row, append-only via
  the existing issuance path. `null` player_count is not solo. The design page's
  cooperative / shared-table / retroactive badges remain **deferred** — they need
  cross-player, table-level data the per-player record does not carry (a follow-on
  data-plumbing WP).

---

## See Also

- WP-105 / D-1004 / `docs/ai/PROPOSAL-BADGES.md` — the Tier-1 badge system + issuer model
- `wiki/awards-and-badges.md` — the awards/badges design point of view (the solo-lane gap)
- `.claude/skills/legendary-server/SKILL.md`, `.claude/skills/legendary-persistence/SKILL.md`
