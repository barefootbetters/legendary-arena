# EC-836 — Printed Hero Deck counts: one scheme hero-count table (WP-799)

**WP:** WP-799 · **Reserves:** D-24672 · **Layer:** Registry (+ one server test, one viewer test, the API catalog row)

Authoritative execution contract for WP-799. Subordinate to ARCHITECTURE.md and `.claude/rules/*`. If this EC and
WP-799 disagree, WP-799 wins. Compliance is binary.

## Before Starting

- [ ] Target file set = WP-799 §Files Expected to Change exactly; touching any other file is STOP.
- [ ] WP-798 / EC-835 is Done on `origin/main` (WORK_INDEX `[x]`). If not, STOP — this packet is blocked.
- [ ] The WP-799 / EC-836 / D-24672 reservation is on `origin/main`, and `pnpm ledger:numbers:check` exits 0.
- [ ] `pnpm -r build` exits 0. Record the per-package `pnpm -r --no-bail test` before-counts.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.
- [ ] `resolveEffectiveHeroCount` at baseline still hard-codes exactly the Secret Invasion and Civil War overrides
      named in WP-799 §Assumes. If it differs, STOP and report.

## Locked Values

- `SchemeHeroCountRule` = `{ kind: 'add'; amount; fromPlayerCount }` | `{ kind: 'exact'; count }` |
  `{ kind: 'exactAtPlayerCount'; playerCount; count }` (all `readonly number` fields), exported.
- `SCHEME_HERO_COUNT_RULES: Readonly<Record<string, SchemeHeroCountRule>>`, exported, ONLY in
  `packages/registry/src/playerCountSetup.ts`, holding exactly the 26 rows of WP-799 §Locked Contract Values in that
  order (grouped by kind below for reference only — the source order and the drift-pin order are the WP table's row
  order, core Secret Invasion first, cosm Destroy the Nova Corps last):
  - `exact 6`: core Secret Invasion, msp1 Enslave Minds with the Chitauri Scepter, bkwd Frame Heroes for Murder, dkcy
    Detonate the Helicarrier, rvlt House of M, cvwr Avengers vs. X-Men;
  - `exact 7`: chmp Divide and Conquer, cvwr Reveal Heroes' Secret Identities, wwhk Break the Planet Asunder, mgtg
    Star-Lord's Awesome Mix Tape; `exact 8`: ca75 Go Back in Time to Slay Heroes' Ancestors;
  - `add 1 from 1p`: co2e Secret Invasion, 2099 Subjugate Earth…, 2099 Befoul Earth…, cosm Contest of Champions, cosm
    Annihilation: Conquest, shld Hydra Helicarriers Hunt Heroes, wpnx Go After Heroes' Loved Ones;
    `add 2 from 1p`: mdns Wager at Blackjack; `add 1 from 4p`: antm Age of Ultron;
  - `exactAtPlayerCount 2 → 4`: core / msp1 / co2e Super Hero Civil War, dead Deadpool Kills the Marvel Universe;
    `1 → 4`: cvwr Epic Super Hero Civil War; `1 → 5`: cosm Destroy the Nova Corps.
- Row lookup uses `Object.hasOwn(SCHEME_HERO_COUNT_RULES, schemeId)` (a prototype key such as `constructor` → base;
  tested). msis The Time Heist is deliberately NOT a row (WP-799 §Context).
- After the three `rule.kind` branches: `const exhaustiveCheck: never = rule;`, then return base (a fourth kind
  without a branch fails `tsc`).
- Resolver: no row → base; `add` → base + amount when `numPlayers >= fromPlayerCount`; `exact` → count;
  `exactAtPlayerCount` → count when `numPlayers === playerCount`; otherwise base. Signature unchanged.
- The constants `SECRET_INVASION_SCHEME_ID`, `SECRET_INVASION_HERO_COUNT`, `CIVIL_WAR_SCHEME_ID`,
  `CIVIL_WAR_2P_HERO_COUNT` are removed from `playerCountSetup.ts`.
- Locked sequences (1p..5p): add1 4/6/6/6/7; add2 5/7/7/7/8; add1-from-4p 3/5/5/6/7; exact6 6×5; exact7 7×5;
  exact8 8×5; 2p→4 3/4/5/5/6; 1p→4 4/5/5/5/6; 1p→5 5/5/5/5/6.
- API catalog setup-requirements row replaced whole: Status `Wired`, Auth `guest`, schemas unchanged, Authorizing WP
  appends `WP-799 / D-24672 (scheme hero-count table)`.

## Guardrails

1. One definition: the table and its only reader live in `playerCountSetup.ts`. No other production file gains a
   scheme hero-count encoding; the pre-existing engine build-side `resolveEffectiveHeroDeckIds` (Civil War 2p slice,
   D-24328) is untouched.
2. No CODE edit to any resolver consumer (engine validate, server route, viewer composable/lib, registry impls,
   `types/index.ts`, arena-client). If one is needed, STOP.
3. Requirement side only: no `schemeSetupSizing` change; `PLAYER_COUNT_SETUP` never mutated.
4. Unlisted schemes byte-identical. Core Secret Invasion / Civil War results identical at 1–5p.
5. Existing tests pass unedited (scaffold-proven 0 failures); any failure is STOP-and-report.
6. Test expectations are written-out literals, never computed from the rule under test.
7. No `G`, `MatchSetupConfig` or arena-client change. Sentinel `finalStateHash` / `PRE_WP080_HASH` unchanged.
8. No comment or JSDoc under `packages/registry/src` names the four removed constants (the Verification grep counts
   prose too); cite D-24337 / D-24385 / D-24672 instead.

## Required Comments (`// why:`)

- The `never` exhaustiveness assertion: a new rule kind must get an explicit branch, never a silent base fallback.
- The table: printed Hero Deck sizes are requirement overrides (D-24337 / D-24672), one closed table so the next
  printed rule is a data row.
- The Wager at Blackjack and Star-Lord rows: the 2026-10-08 operator rulings (+2 into the Hero Deck; 7 Heroes, group
  doubling deferred).
- The migrated core Secret Invasion `exact 6` row: identical to the former `Math.max(base, 6)` because base ≤ 6.
- The test reading `data/cards`: fail-loud against a scheme-id typo.

## Files to Produce

Exactly the WP-799 §Files Expected to Change allowlist.

## After Completing

- Revert proofs 3/3: the `add`, `exact` and `exactAtPlayerCount` branches each fail a new test when reverted.
- `git grep` checks: `SCHEME_HERO_COUNT_RULES` only in `playerCountSetup.ts` (non-test source); the four removed
  constants have no match in `packages/registry/src`.
- The 16-set budget table recomputed from the built dist equals WP-799 §User-Visible Impact (AC8); recorded.
- `pnpm -r build`; `pnpm -r --no-bail test` 0 failures (before/after counts per package);
  `pnpm --filter registry-viewer typecheck` 0; replay fixtures byte-identical.
- `docs/ai/REFERENCE/api-endpoints.md` setup-requirements row replaced whole (D-11804).
- Live-on-surface verification (D-24026), after deploy: builder "6 heroes" for 2p Annihilation: Conquest and export
  blocked with 5; lobby warning after a hard refresh; a 6-hero match plays; a ca75 run shows 'Hero pool: N / 10 budget'; an affected gauntlet leg asks for and
  launches with the printed count. Record the matchId in STATUS.md.
- `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24672 → Active (the six points).
- WORK_INDEX WP-799 `[x]` with date; EC_INDEX EC-836 → Done; mindmap 📝 → ✅, then `pnpm roadmap:counts:write` and
  `pnpm roadmap:counts:check` exit 0.

## Common Failure Smells

- Core Secret Invasion returns 7 at 5p: the row was written as `add 1`, not `exact 6`.
- Age of Ultron returns 6 at 2p: `fromPlayerCount` was ignored.
- Destroy the Nova Corps changes at 2–5p: `exactAtPlayerCount` fell through to `exact`.
- The lobby still says 5 for Annihilation: Conquest: the registry dist was not rebuilt, or the response is cached.
