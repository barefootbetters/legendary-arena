# WP-615 — Tiered Team Badges (exact-size shared cooperative badges)

**Status:** Ready
**Primary Layer:** Server (`apps/server/src/badges/**`)
**Dependencies:** WP-614 / D-24425 (the shared `united-front` badge + `issueSharedMatchBadges` this extends), WP-105 / D-1004 (Tier-1 badge system), D-24134 (`playerCount`)
**User-Visible Surface:** `play.legendary-arena.com` (the player profile badge list)

> Baseline: `origin/main` at commit `7a64ef54` (EC-649: Shared Cooperative badges, #1665).

---

## Session Context

The `wiki/awards-and-badges.md` design page names **tiered team badges**: *"A
five-player badge, four-, three-, and two-player badges — recognition scaled to
the size of the cooperation."* WP-614 shipped the base shared badge (`united-front`
for any 2+ table) and deferred the tiers. This packet adds them.

The data + issuance already exist: `issueSharedMatchBadges` (WP-614) groups a
match's per-player rows by `replay_hash` and awards the whole table when it is
complete, `playerCount ≥ 2`, and every player finished sub-PAR. Player count is
`playerCount === rows.length` at award time, so the exact table size is known —
this packet awards an additional **size-specific** badge keyed on it.

---

## Goal

A qualifying co-op table earns `united-front` PLUS an **exact-size** tier badge
scaled to its seat count: **Trio** (3), **Quartet** (4), **Quintet** (5). The
two-player base is already `united-front`; player count maxes at 5.

---

## User-Visible Impact

Beyond "United Front," a player's profile now records the *size* of the tables
they've cleared with — "Trio", "Quartet", "Quintet" — a distinct badge for each
larger cooperation. No change to 2-player tables or to any existing badge.

---

## Assumes

- WP-614 on `main`: `badge.shared.ts` `issueSharedMatchBadges(replayHash,
  playerCount, configVersion, database)` awards `united-front` to the whole
  `replay_hash` group when complete + `playerCount ≥ 2` + all sub-PAR, via a
  multi-row INSERT + `ON CONFLICT DO NOTHING`, `source_kind 'competitive_history'`,
  `source_ref NULL`.
- `TIER_1_BADGE_KEYS` = 10 (drift-pinned in `badge.predicates.test.ts`);
  `playerCount` ∈ 1..5 (D-24134); migration 013 `source_kind` allows
  `'competitive_history'` (reuse — **no migration**).
- `pnpm -r build` 0; server suite green on `7a64ef54` (badge tests use a mock `DatabaseClient`).

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/server/src/badges/badge.shared.ts` — `issueSharedMatchBadges` + the
  `UNITED_FRONT_KEY` constant and the multi-row INSERT loop to extend.
- `apps/server/src/badges/badge.types.ts` — `TIER_1_BADGE_KEYS` (10) + `BADGE_DEFINITIONS`.
- `apps/server/src/badges/badge.shared.test.ts` — the mock `DatabaseClient` + `findInsert` idiom.
- `apps/server/src/badges/badge.predicates.test.ts` — the `TIER_1_BADGE_KEYS` exact-count drift pin.
- `docs/ai/DECISIONS.md` D-24425 (the shared badge this extends), D-1004 (anti-volume / no-PvP / append-only).
- `wiki/awards-and-badges.md` — the tiered-team-badge design; `.claude/skills/legendary-{server,persistence}/SKILL.md`.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, `node:` prefix; `.test.ts`; human-style code per `00.6`; JSDoc per export.

**Packet-specific (D-1004 binding):**
- **Additive tiers, same qualification.** The tier badge is awarded ONLY when the
  table already qualifies for `united-front` (complete group, `playerCount ≥ 2`,
  all sub-PAR); it is keyed on the exact `playerCount` (3 → trio, 4 → quartet, 5 →
  quintet). A 2-player table earns `united-front` and NO tier.
- **Anti-volume / no-PvP / append-only.** Quality-gated (all sub-PAR, never
  volume); cooperative framing (recognition scaled to table size — never
  head-to-head). Reuse the existing multi-row INSERT + `ON CONFLICT DO NOTHING`,
  `source_kind 'competitive_history'`, `source_ref NULL`. **No migration, no new
  source_kind, no `/badges/*` route, no `tier IN (2,3)`.**
- **Projection over immutable rows (D-5302).** No replay re-exec, no score
  recompute; no state-hash surface.
- **Drift pin.** `TIER_1_BADGE_KEYS` 10 → 13 with `BADGE_DEFINITIONS` in lockstep.

**Locked values (do not re-derive):**
- Keys/labels: `gameplay.shared.trio` "Trio" (3), `gameplay.shared.quartet`
  "Quartet" (4), `gameplay.shared.quintet` "Quintet" (5); all
  `sourceKind 'competitive_history'`, `source_ref NULL`.
- Award map: `{ 3: trio, 4: quartet, 5: quintet }`, keyed on `playerCount`.

---

## Scope (In)

### A) `badge.types.ts` (**modified**)
- Add the 3 tier keys to `TIER_1_BADGE_KEYS` (10 → 13) + `BADGE_DEFINITIONS`
  (each `sourceKind: 'competitive_history'`; labels/descriptions per Goal).

### B) `badge.shared.ts` (**modified**)
- Add `SIZE_TIER_KEYS = { 3: 'gameplay.shared.trio', 4: '…quartet', 5: '…quintet' }`.
  After the qualification checks, build the award-key list =
  `[UNITED_FRONT_KEY, ...(SIZE_TIER_KEYS[playerCount] if present)]`, and emit a
  row per `(player × badgeKey)` in the existing multi-row INSERT. `// why:` on the
  exact-size keying (safe because `playerCount === rows.length` here).

### C) `badge.shared.test.ts` (**modified**)
- Tier cases: 2p → `united-front`, no tier; 3p → `+ trio` (no quartet/quintet);
  4p → `+ quartet`; 5p → `+ quintet` awarded to all five players.

### D) `badge.predicates.test.ts` (**modified**)
- The `TIER_1_BADGE_KEYS` exact-count drift pin 10 → 13.

---

## Out of Scope

- **No change to `united-front` or the qualification** (complete group, `≥ 2`,
  all sub-PAR) — the tier is strictly additive.
- **No sub-2 or above-5 tier** — `playerCount` ∈ 1..5; 2 is the `united-front` base.
- **No turn-level "enabled an ally" badge** (still deferred — no per-turn attribution).
- **No migration, no new `source_kind`, no new table, no route.**
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/badges/badge.types.ts` — **modified** — 3 keys + definitions; 10 → 13
- `apps/server/src/badges/badge.shared.ts` — **modified** — `SIZE_TIER_KEYS` + per-key award
- `apps/server/src/badges/badge.shared.test.ts` — **modified** — tier cases
- `apps/server/src/badges/badge.predicates.test.ts` — **modified** — drift 10 → 13

No other **code** files may be modified. (The `EC-650:` implementation commit
touches exactly these 4; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

The cooperative fantasy rendered as recognition — recognition **scaled to the
table**. A badge is recognition, never power (§24 no-pay-to-win). Anti-volume (§25
/ D-0005) and no-PvP (§23b) hold (quality gate, table-size framing). Projection
over immutable `competitive_scores` rows (D-5302) — **no state-hash surface**.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint; the change is inside the existing `issueSharedMatchBadges`
internal issuer (not a cataloged public surface).

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `TIER_1_BADGE_KEYS` has 13 keys (adds trio/quartet/quintet); `BADGE_DEFINITIONS`
  matches; the exact-count drift test passes at 13.
- [ ] A qualifying 3/4/5-player table earns `united-front` PLUS `trio`/`quartet`/
  `quintet` respectively, awarded to every player.
- [ ] A qualifying 2-player table earns `united-front` and NO tier badge.
- [ ] The tier is awarded only when the table already qualifies (complete group,
  `≥ 2`, all sub-PAR); reuses `competitive_history` + `ON CONFLICT DO NOTHING` (no migration).
- [ ] `pnpm -r build` 0; server suite green; the `EC-650:` diff is exactly the 4 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test   # badge tests use a mock DatabaseClient
# Expected: exits 0 / all pass (+ the tier tests)

Select-String -Path "apps\server\src\badges\badge.shared.ts" -Pattern "SIZE_TIER_KEYS|trio|quartet|quintet"
# Expected: the size-tier map + the per-key award

git diff --name-only
# Expected (implementation commit): only the 4 badge files.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  a 3-player all-sub-PAR match shows "United Front" + "Trio" on all three profiles.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; server suite green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24426 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-615 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS
  (additive tiers, same qualification; anti-volume / no-PvP / append-only; drift;
  locked values). §3 Assumes — PASS. §4 Context — PASS. §5 Files — PASS (4 code
  files; governance separate). §6 Naming — PASS. §7 Deps — PASS (none; no migration).
- §8 Boundaries — PASS (server layer; no runtime engine import). §9 Windows — PASS.
  §10 — N/A. §11 Persistence — PASS (append-only, immutable-source projection;
  reuses `competitive_history`). §12 Tests — PASS (mock-DB tier cases). §13 — PASS.
  §14 Acceptance — PASS (5 binary). §15/§15.1 — PASS (surface + D-24026). §16 —
  PASS. §17 Vision — PASS. §18 Prose-vs-grep — PASS. §19 — N/A. §20 Funding — N/A.
  §21 API — N/A with reason.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-26).**

- **Dependencies verified against `origin/main` (`7a64ef54`):** WP-614's
  `issueSharedMatchBadges` present with the group query + qualification + multi-row
  INSERT; `TIER_1_BADGE_KEYS` = 10; `playerCount` ∈ 1..5; `source_kind` allows
  `'competitive_history'` (no migration). `playerCount === rows.length` at award
  time makes the exact-size keying sound. No key collision.
- **PS items (blocking): none.** Additive to a shipped issuer.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-26).** The tier award reuses the exact qualification
and INSERT of WP-614; the only new logic is a size→key map applied after the gates.
Judgement calls: (1) tiers **stack** on `united-front` (a 5-player table earns
both) — intended, per "recognition scaled to size"; (2) keyed on `playerCount`,
which equals `rows.length` past the completeness gate, so exact; (3) 2 stays the
`united-front` base (no separate "duo" badge). Anti-volume / no-PvP hold.
Session-prompt generation folded into this combined draft+execute.

---

## Reserved Decisions (land at execution)

- **D-24426 (reserved; Drafted 2026-08-26)** — Add **tiered team badges** (extends
  D-24425): a qualifying shared table (complete `replay_hash` group, `playerCount ≥
  2`, all sub-PAR) earns `united-front` PLUS an exact-size tier badge —
  `gameplay.shared.trio` (3), `.quartet` (4), `.quintet` (5), keyed on `playerCount`
  (which equals `rows.length` past the completeness gate). The two-player base is
  `united-front`; player count maxes at 5. All `sourceKind 'competitive_history'`,
  `source_ref NULL`, awarded to every player via the existing multi-row INSERT +
  `ON CONFLICT DO NOTHING`. Honors D-1004: quality-gated (never volume),
  cooperative-model-safe framing, projection over immutable rows (D-5302),
  append-only, no migration. The turn-level "enabled an ally" flavor stays deferred.

---

## See Also

- WP-614 / D-24425 — the shared `united-front` badge + `issueSharedMatchBadges` this extends
- WP-105 / D-1004 — the Tier-1 badge system + issuer model
- `wiki/awards-and-badges.md` — the tiered-team-badge design
