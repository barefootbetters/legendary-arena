# WP-620 — Shared-Badge Tiers Reflect Human Count

**Status:** Ready
**Primary Layer:** Server (`apps/server/src/badges/badge.shared.ts`)
**Dependencies:** WP-615 / D-24426 (the size tiers), WP-619 / D-24430 (human+bot completeness — the `humanSeatCount` this builds on)
**User-Visible Surface:** `play.legendary-arena.com` (the player profile badge list)

> Baseline: `origin/main` at commit `4435f561`.

---

## Session Context

WP-619 let human+bot co-op matches earn the shared / tiered badges, but keyed the
size tier on `playerCount` (the full seat count, bots included) — a flagged
consequence (D-24430 §3): a **1-human + 4-bot** match would earn **Quintet**. The
operator's call: the tier should reflect how many **humans** cooperated, not the
table size padded by bots.

Past the completeness gate, `rows.length` is exactly the number of humans who
submitted (bots never submit, so `rows.length === (humanSeatCount ?? playerCount)`).
So the tier keys off `rows.length`.

---

## Goal

The size tier (trio/quartet/quintet) reflects the **human** count: a 3-human table
earns Trio regardless of bot allies; a 1-human+4-bot match earns no tier.
`united-front` still gates on `playerCount >= 2` (a human+bot table earns the base).

---

## User-Visible Impact

Playing co-op with bots earns a size tier matching the number of **humans** at the
table, not the seat count — so a lone human with bot allies no longer earns Quintet.

---

## Assumes

- WP-615/619 on `main`: `issueSharedMatchBadges` awards `united-front` (+
  `SIZE_TIER_KEYS[playerCount]`, where `SIZE_TIER_KEYS = {3:trio, 4:quartet, 5:quintet}`)
  once `rows.length === (humanSeatCount ?? playerCount)`, with a `playerCount >= 2` guard.
- Past the completeness gate, `rows.length` equals the human submitter count.
- `pnpm -r build` 0; server suite green on `4435f561` (badge tests use a mock `DatabaseClient`).

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/server/src/badges/badge.shared.ts` — `SIZE_TIER_KEYS` + the `const sizeTierKey =
  SIZE_TIER_KEYS[playerCount]` line (the one change) + the now-stale `playerCount === rows.length` comment.
- `apps/server/src/badges/badge.shared.test.ts` — the WP-615 tier tests + the WP-619 human+bot tests.
- `docs/ai/DECISIONS.md` D-24426 (the tiers), D-24430 (human+bot completeness + the flagged tier-size consequence).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only; human-style code per `00.6`; a `// why:` on the human-count keying.

**Packet-specific:**
- **Tier keying only.** `SIZE_TIER_KEYS[playerCount]` → `SIZE_TIER_KEYS[rows.length]`;
  fix the stale `playerCount === rows.length` comment. No change to the base gate, the
  completeness gate, all-sub-PAR, or the INSERT.
- **`united-front` unchanged** — still gates on `playerCount >= 2` (bots included), so
  a human+bot table earns the base badge.
- **Read-only / append-only.** No migration, no new `source_kind`, no route; no hash surface.

**Locked values:** tier key = `rows.length` (the human submitter count).

---

## Scope (In)

### A) `badge.shared.ts` (**modified**)
- `const sizeTierKey = SIZE_TIER_KEYS[playerCount]` → `SIZE_TIER_KEYS[rows.length]`,
  with a `// why:` (human count; `rows.length === (humanSeatCount ?? playerCount)` past the gate).

### B) `badge.shared.test.ts` (**modified**)
- Add: a 5-seat table with 3 humans earns Trio (not Quintet); a 2-human+3-bot table
  earns `united-front` and no tier. The WP-615 all-human tier tests are unchanged
  (`rows.length === playerCount` there).

---

## Out of Scope

- **No change to `united-front`'s gate** (`playerCount >= 2`), the completeness gate,
  or the all-sub-PAR check.
- **No new tier for 1-human tables** — 1/2 humans earn no size tier (2 is the base).
- **No migration, no new `source_kind`, no route.**
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/badges/badge.shared.ts` — **modified** — tier key `playerCount` → `rows.length`
- `apps/server/src/badges/badge.shared.test.ts` — **modified** — human-count tier cases

No other **code** files may be modified. (The `EC-655:` implementation commit
touches exactly these 2; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit.)

---

## Vision Alignment

Cooperative recognition scaled to the humans who cooperated (§24 recognition, not
power). Anti-volume (§25) and no-PvP (§23b) hold. Read-only over the immutable rows;
no state-hash surface, no score change.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint; internal issuer only.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] The size tier keys on `rows.length` (human submitter count), not `playerCount`.
- [ ] A 5-seat table with 3 humans earns `united-front` + Trio (not Quintet); a
  2-human+3-bot table earns `united-front` and no tier; the WP-615 all-human tier
  tests still pass unchanged.
- [ ] `united-front` still fires for a human+bot table (`playerCount >= 2`).
- [ ] `pnpm -r build` 0; server suite green; the `EC-655:` diff is exactly the 2 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
# Expected: exits 0 / all pass (+ the human-count tier cases)

Select-String -Path "apps\server\src\badges\badge.shared.ts" -Pattern "SIZE_TIER_KEYS\[rows.length\]"
# Expected: the tier keys on rows.length

git diff --name-only
# Expected (implementation commit): only the 2 files.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  a 3-human + bot(s) sub-PAR win earns Trio; a 1-human + bots earns no tier.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; server suite green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24431 as Active
  (supersedes D-24430 §3's tier-size statement).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-620 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (≥2 Out-of-Scope). §2 Constraints — PASS (tier keying only;
  base gate unchanged; locked value). §3 Assumes — PASS. §4 Context — PASS (cites
  the one line + D-24426/D-24430). §5 Files — PASS (2 code files). §6 Naming — PASS.
  §7 Deps — PASS (none). §8 Boundaries — PASS (server). §9 — PASS. §10 — N/A.
  §11 Persistence — PASS (read-only / append-only). §12 Tests — PASS (human-count
  cases). §13 — PASS. §14 Acceptance — PASS (4 binary). §15/§15.1 — PASS (surface +
  D-24026). §16 — PASS. §17 Vision — PASS. §18 Prose-vs-grep — PASS. §19 — N/A.
  §20 Funding / §21 API — N/A.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-27).**

- **Dependencies verified against `origin/main` (`4435f561`):** `SIZE_TIER_KEYS[playerCount]`
  is the tier line; the completeness gate is `rows.length === (humanSeatCount ?? playerCount)`,
  so `rows.length` = human count past it; the WP-615 tests use all-human tables
  (`rows.length === playerCount`), unaffected. No collision.
- **PS items (blocking): none.** One-line key change.

---

## Copilot Check (01.7)

**Verdict: CONFIRM (2026-08-27).** `rows.length` is the exact human submitter count
past the completeness gate, so keying the tier off it makes the tier reflect humans
without any new state. `united-front`'s `playerCount >= 2` gate is untouched (human+bot
still earns the base). WP-615's all-human tier tests are `rows.length === playerCount`
and stay green. Session-prompt generation folded into this combined draft+execute.

---

## Reserved Decisions (land at execution)

- **D-24431 (reserved; Drafted 2026-08-27)** — The shared-badge **size tier**
  (trio/quartet/quintet) reflects the **human** count, not the full table size:
  it keys off `rows.length` (the human submitter count, since bots never submit —
  `rows.length === (humanSeatCount ?? playerCount)` past the completeness gate),
  superseding D-24430 §3's "the tier reflects full table size" statement. A
  1-human+4-bot match earns no tier; a 3-human+2-bot match earns Trio. `united-front`
  itself is unchanged — still gated on `playerCount >= 2`, so a human+bot table earns
  the base badge. Read-only / append-only, no migration.

---

## See Also

- WP-615 / D-24426 (the tiers), WP-619 / D-24430 (human+bot completeness; the flagged tier-size consequence this resolves)
