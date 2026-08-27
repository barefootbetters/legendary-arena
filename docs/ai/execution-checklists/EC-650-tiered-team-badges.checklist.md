# EC-650 — Tiered Team Badges (Execution Checklist)

**Source:** docs/ai/work-packets/WP-615-tiered-team-badges.md
**Layer:** Server (`apps/server/src/badges/**`)

## Before Starting
- [ ] WP-614 on `origin/main`: `badge.shared.ts` `issueSharedMatchBadges` awards
      `united-front` to the whole `replay_hash` group (complete + `playerCount >= 2`
      + all sub-PAR) via a multi-row INSERT + `ON CONFLICT DO NOTHING`,
      `source_kind 'competitive_history'`, `source_ref NULL`.
- [ ] `TIER_1_BADGE_KEYS` = 10 (drift-pinned); `playerCount` ∈ 1..5; migration 013
      `source_kind` allows `'competitive_history'` (reuse — NO migration).
- [ ] Fresh worktree off `origin/main` (`7a64ef54`); baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 4 code files (all in `badges/`). Any edit outside → STOP.
- [ ] Read D-24425 + D-1004 + the legendary-server / legendary-persistence skills.
- [ ] `pnpm -r build` 0; server suite green (badge tests use a mock DatabaseClient).

## Locked Values (do not re-derive)
- Keys/labels: `gameplay.shared.trio` "Trio" (3), `.quartet` "Quartet" (4),
  `.quintet` "Quintet" (5); all `sourceKind 'competitive_history'`, `source_ref` NULL.
- Award map: `{ 3: trio, 4: quartet, 5: quintet }`, keyed on `playerCount`.
- `TIER_1_BADGE_KEYS` 10 → 13.

## Guardrails
- **Additive, same qualification.** Award the tier ONLY when the table already
  qualifies for `united-front` (complete group, `playerCount >= 2`, all sub-PAR).
  2-player earns `united-front` and NO tier.
- **Exact-size keying** on `playerCount` (== `rows.length` past the completeness gate).
- **Anti-volume / no-PvP / append-only:** quality-gated; table-size framing; reuse
  the multi-row INSERT + `ON CONFLICT DO NOTHING`, `competitive_history`, NULL
  `source_ref`. NO migration, no new source_kind/route/table, no `tier IN (2,3)`.
- **Projection over immutable rows (D-5302):** no replay re-exec, no recompute; no hash surface.
- **Drift:** `TIER_1_BADGE_KEYS` 10 → 13 with `BADGE_DEFINITIONS`; update the count pin.
- **`// why:`** on the exact-size keying (safe because `playerCount === rows.length`).

## Files to Produce
- `apps/server/src/badges/badge.types.ts` — **modified** — 3 keys + definitions; 10 → 13
- `apps/server/src/badges/badge.shared.ts` — **modified** — `SIZE_TIER_KEYS` + per-key award loop
- `apps/server/src/badges/badge.shared.test.ts` — **modified** — 2p/3p/4p/5p tier cases
- `apps/server/src/badges/badge.predicates.test.ts` — **modified** — drift 10 → 13

## After Completing
- [ ] `pnpm -r build` 0; server suite green (incl. tier tests).
- [ ] `TIER_1_BADGE_KEYS` = 13; drift passes; `BADGE_DEFINITIONS` in lockstep.
- [ ] **Live-on-surface (D-24026):** a 3-player all-sub-PAR match shows "United Front" + "Trio" on all three profiles.
- [ ] `git diff --name-only` — the `EC-650:` implementation commit is only the 4 files.
- [ ] STATUS.md updated; DECISIONS.md D-24426 Active; WORK_INDEX WP-615 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- A 2-player table earns a tier → the map has a `2` key (it must not).
- A tier fires without `united-front` → you keyed off `playerCount` before the qualification gates.
- Tier awarded to only the submitter → the per-key loop isn't inside the per-player loop.
- A migration in the diff → you added a source_kind instead of reusing `competitive_history`.
- Drift red → `TIER_1_BADGE_KEYS` / `BADGE_DEFINITIONS` / the count assertion diverged.
