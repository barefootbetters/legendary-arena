# EC-655 — Shared-Badge Tiers Reflect Human Count (Execution Checklist)

**Source:** docs/ai/work-packets/WP-620-human-count-tiers.md
**Layer:** Server (`apps/server/src/badges/badge.shared.ts`)

## Before Starting
- [ ] WP-615/619 on `origin/main`: `issueSharedMatchBadges` awards `united-front`
      (+ `SIZE_TIER_KEYS[playerCount]`) once `rows.length === (humanSeatCount ?? playerCount)`.
- [ ] Fresh worktree off `origin/main`; baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 2 code files: `badge.shared.ts`, `badge.shared.test.ts`. Any edit outside → STOP.
- [ ] `pnpm -r build` 0; server suite green.

## Locked Values (do not re-derive)
- Tier key changes from `SIZE_TIER_KEYS[playerCount]` to `SIZE_TIER_KEYS[rows.length]`
  (the human submitter count; `rows.length === (humanSeatCount ?? playerCount)` past the gate).
- `united-front`'s `playerCount >= 2` table-size gate is UNCHANGED.

## Guardrails
- **Tier keying only.** One line: `SIZE_TIER_KEYS[playerCount]` → `SIZE_TIER_KEYS[rows.length]`
  (+ the stale `playerCount === rows.length` comment fixed). No change to the base gate,
  the completeness gate, all-sub-PAR, or the INSERT.
- **`united-front` still gates on `playerCount >= 2`** — a human+bot table earns the base.
- **`// why:`** the tier reflects human count (bots never submit; 1-human+4-bot must not earn Quintet).
- **No migration, no hash surface.**

## Files to Produce
- `apps/server/src/badges/badge.shared.ts` — **modified** — tier key `playerCount` → `rows.length` + comment
- `apps/server/src/badges/badge.shared.test.ts` — **modified** — human-count tier cases

## After Completing
- [ ] `pnpm -r build` 0; server suite green (WP-615 all-human tier tests unchanged; new human-count cases pass).
- [ ] **Live-on-surface (D-24026):** a 3-human + 2-bot sub-PAR win earns Trio (not Quintet); a 1-human+4-bot earns no tier.
- [ ] `git diff --name-only` — the `EC-655:` implementation commit is only the 2 files.
- [ ] STATUS.md updated; DECISIONS.md D-24431 Active (supersedes D-24430 corollary 3's tier-size statement);
      WORK_INDEX WP-620 `[x]`; mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- A 1-human+4-bot earns Quintet → the tier still keys on `playerCount`.
- A WP-615 all-human tier test breaks → `rows.length !== playerCount` in that fixture (it should be equal).
- United Front no longer fires for human+bot → you changed the base gate (out of scope).
