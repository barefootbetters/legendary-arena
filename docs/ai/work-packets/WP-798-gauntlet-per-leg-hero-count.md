# WP-798 — Gauntlet per-leg hero count: each leg asks for its scheme's hero count, and the pool budget fits the largest leg

**Status:** Draft 2026-10-08 · **EC:** EC-835 · **Reserves:** D-24671 (reserve PR #2642)
**Primary Layer:** Server (gauntlet catalog wiring, run-progress derivation) + App (arena-client profile "Gauntlet
Runs") + blog tooling (`scripts/gauntlet-post-block.mjs`)
**User-Visible Surface:** play.legendary-arena.com profile → Gauntlet Runs ("Play this leg"), the Legends fixed-division
standings, and the generated gauntlet blog block
**Lane:** standard two-session (a ranked-surface rule change amending D-24187 §4 and D-24265 — NOT
lightweight-eligible: leaderboards / competitive integrity)
**Baseline:** `origin/main` @ `3fbb03f3` (2026-10-08)

## Goal

A gauntlet run asks the player for the same number of heroes on every leg: the base per-player-count count
(`PLAYER_COUNT_SETUP[n].heroCount`). But a leg's scheme can require a different count
(`resolveEffectiveHeroCount`, D-24337 / D-24385). Today that makes two Core legs unlaunchable from "Play this leg":
- **core Secret Invasion** at 1–4 players (requires 6; the tracker wants 3 / 5 / 5 / 5);
- **core Super Hero Civil War** at 2 players (requires 4; the tracker wants 5).

Saving the tracker's count enables Play, and `Game.setup` then rejects the match (create 400). Saving the printed count
leaves "full picks" false, so Play stays disabled under a hint naming the wrong count. Separately, the fixed-division
pool budget is `heroCount + 2` per player count, so a solo Core run (budget 5) can never hold a 6-hero Secret
Invasion team: a solo Core fixed-division champion is impossible.

After this packet:
- each leg's required hero pick is ``resolveEffectiveHeroCount(`${setAbbr}/${schemeSlug}`, playerCount, base)``,
  shown and enforced per leg;
- each gauntlet's fixed-division pool budget at a player count is **`max(base, largest leg count) + 2`**.

Every count rule then reaches the gauntlet through the one resolver, including the 24 printed rules WP-799 adds.

## User-Visible Impact

- **Gauntlet Runs (profile):** each leg's hint names that leg's count ("Enter a full hero pick (6 heroes)" on Secret
  Invasion; 4 on a 2-player Civil War leg). "Full picks" and "Play this leg" follow it, and the leg launches.
- **Pool budget:** a Core gauntlet's budget becomes 8 at every player count (the Secret Invasion leg needs 6
  everywhere). Sets with no overridden leg keep `base + 2` exactly. The tracker's "Hero pool: N / budget" line and the
  fixed-division standings use the new value.
- **Blog block:** the generated gauntlet post's budget table shows the gauntlet's real budget.

## Assumes

- **WP-384 / D-24187 ✅** — the fixed division. §4 (`docs/ai/DECISIONS.md` :29353–29366): "Pool budget =
  **`heroCount + 2`** exactly, player-count-relative per the registry setup table … the union of distinct hero ids
  across the assignment's `team_key`s has size **≤ the budget**." The budgets are built once, globally, at
  `apps/server/src/server.mjs` :622–630 (`heroPoolBudgets[n] = setupRow.heroCount + 2`) and stamped unchanged on every
  definition by `buildGauntletCatalog` (`apps/server/src/legends/gauntlet.logic.ts` :219–224, :276–279;
  `GauntletHeroPoolBudgets` :120–127; `GauntletDefinition.heroPoolBudgets` :172). Standings read
  `definition.heroPoolBudgets?.[playerCount]` (:768) into `findBestPoolAssignment` (:787–806).
- **`findBestPoolAssignment`** (`apps/server/src/legends/gauntletTruth.logic.ts` :403–469) checks only the union size
  against the budget (:436). `qualifiesAsLegClear` (:190–248) has no team-size check. `team_key` is the sorted
  `heroDeckIds` (`apps/server/src/competition/competition.logic.ts` :915–929), variable length. **Nothing assumes team
  size == heroCount**; the only coupling is the budget value.
- **WP-446 / D-24264 / D-24265 ✅ and WP-449 / D-24269 ✅** — the run tracker.
  - `resolveGauntletRunProgressInputs` (`server.mjs` :1253–1302) injects `poolBudget` (:1261, :1288) and
    `heroCount: setupRow.heroCount` (:1289), plus `legs: definition.legs` (:1286).
  - `deriveGauntletRunProgress` (`apps/server/src/gauntlet/gauntletRunProgress.logic.ts`) sets
    `hasFullPicks: pickCount === inputs.heroCount` (:426) in the leg loop (:413–429), and returns
    `heroCount: inputs.heroCount, budget` (:462–472); the budget comment is at :441–446.
  - `GauntletRunLegProgress` (`apps/server/src/gauntlet/gauntletRun.types.ts` :249–255) has no per-leg count; the
    view and inputs docs are at :239–248, :336–379.
  - The PATCH save path is structural only (`gauntletRun.logic.ts` :154–201, :392–446; D-24264 §2) and is NOT changed.
- **Client** — the `GauntletRunLegProgress` mirror (`apps/arena-client/src/lib/api/gauntletRunApi.ts` :55–67) and
  view (:131–140); `MyProfilePage.vue` `canPlayLeg` (:313–324, `leg.hasFullPicks && run.launch !== null`) and the hint
  `Enter a full hero pick ({{ run.heroCount }} heroes)` (:1808).
- **Resolver access** — `resolveEffectiveHeroCount` is NOT in the registry barrel (`packages/registry/src/index.ts`
  :34–38); `apps/server/src/match/matchGate.routes.ts` :53–63 imports it from the `@legendary-arena/registry/playerCountSetup` subpath, and
  `server.mjs` will do the same.
- **WP-524 / D-24337 ✅ and WP-576 / D-24385 ✅** — `resolveEffectiveHeroCount(schemeId, numPlayers, baseHeroCount)`
  (`packages/registry/src/playerCountSetup.ts` :124–141) keyed by the set-qualified scheme ext_id
  (`core/secret-invasion-of-the-skrull-shapeshifters` :75 → `max(base, 6)`; `core/super-hero-civil-war` :85 → `4` at
  2p only). **Reservation:** PR #2642 (WP-798 / EC-835 / D-24671) is merged to `origin/main` before execution (open at
  draft time; gated in EC-835 Before Starting).
- **`GauntletLeg`** (`gauntlet.logic.ts` :108–118: `schemeSlug`, `schemeName`, `approvedLoadouts?`) is the natural home
  for a per-leg count, stamped at catalog build like `approvedLoadouts` (D-24283).
- **`scripts/gauntlet-post-block.mjs`** — `renderBudgetTable` (:198–216) prints `heroCount + 2` from
  `PLAYER_COUNT_SETUP` and cites "D-24187 §5" (the rule is §4); the script has the gauntlet's scheme list (:235) and
  imports from `packages/registry/dist/playerCountSetup.js` (:26), which also exports the resolver.
- **Pack format** — `packages/registry/src/gauntletPack.ts` carries no legs, picks, heroCount or budget (:7, :46–50).
  Unchanged.
- **Determinism:** no engine or `G` change.
- **Baselines** are re-recorded at execution (`pnpm -r build && pnpm -r --no-bail test`).

## Context (Read First)

**Why now.** WP-796's live-verify and the WP-799 scope found that the run tracker sizes picks by the base table. That
breaks two Core legs today, and WP-799 would add 24 more schemes whose legs ask for the wrong count. So this packet
lands first, and WP-799 then reaches the gauntlet with no further change.

**Why `max(base, largest leg) + 2`.** The budget is a single pool across all legs (D-24187 §4). It must at least hold
the largest team, or the run can never be champion; keeping the "+2 alternates" margin above that team preserves the
format's intent. Taking `max(base, …)` guarantees no gauntlet's budget ever shrinks below today's (a leg that lowers
its count, like 2-player Civil War, never lowers the pool). For a set with no overridden leg the result is exactly
today's `base + 2`.

**Locked default: `max(base, largest leg) + 2` unless Jeff selects the alternative before the execution session
opens.** Alternative considered: `max(base + 2, largest leg)`, which gives Core
6 / 7 / 7 / 7 / 8. It also always fits the largest team, and only solo Core changes (5 → 6). The draft recommends
`max(base, largest leg) + 2` (Core 8 / 8 / 8 / 8 / 8) because it keeps the format's two alternates above the largest
team on every gauntlet. If Jeff chooses the alternative, the formula changes in §Locked Contract Values, the EC and
D-24671 §2, the expected budgets become 6 / 7 / 7 / 7 / 8, and the gates re-run.

**Why per leg, not per run.** A run's legs are every scheme of the mastermind's set. Different schemes need different
counts, so the count belongs on the leg. The run-level `heroCount` stays in the view as the base count (back
compatible), and each leg gains its own `heroCount`.

**Out of reach of this packet (named follow-ups):**
- a count check on the PATCH save path (D-24264 §2 keeps it structural);
- the 24 printed rules beyond Secret Invasion / Civil War (WP-799);
- the stale `heroCount + 2` wording in historical WP files (e.g. WP-454 :213).

**Read:** `docs/ai/DECISIONS.md` D-24187 (§1, §4), D-24264 (§2, §3), D-24265, D-24269, D-24283, D-24337, D-24385,
D-24372, D-11804; `docs/ai/ARCHITECTURE.md` §Layer Boundary (the legends / gauntlet logic modules stay registry-free —
the wiring layer injects plain data); `.claude/rules/architecture.md` §Layer Boundary → Import Rules (the
`apps/server` row permits `@legendary-arena/registry` subpaths; the legends / gauntlet logic modules import none);
`docs/ai/REFERENCE/00.2-data-requirements.md` §7 (`schemeId` / `heroDeckIds` canonical; the `MatchSetupConfig` 9-field
lock is untouched; the per-leg key is the set-qualified scheme `schemeId`).

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- No `Math.random()`, no I/O in logic helpers. ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc on every function, no nested
  ternaries, no `.reduce()` with branching.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- No new npm dependencies; no `package.json` change.

**Packet-specific:**
- **Session protocol:** if anything here is unclear or contradicts the code at baseline, STOP and ask — never guess.
- **Layer boundary.** `gauntlet.logic.ts`, `gauntletTruth.logic.ts` and `gauntletRunProgress.logic.ts` never import
  the registry. `server.mjs` (wiring) computes the per-leg counts with `resolveEffectiveHeroCount` (imported from the
  `@legendary-arena/registry/playerCountSetup` subpath) and injects them as plain data.
- **One definition of the count.** No module re-encodes a scheme's hero count; the per-leg count always comes from
  `resolveEffectiveHeroCount`.
- **Back compatible by construction.** `buildGauntletCatalog`'s new input is OPTIONAL. Without it, every definition is
  byte-identical to today (legs carry no count; budgets equal the passed `heroPoolBudgets`). The progress derivation
  falls back to `inputs.heroCount` for a leg with no count. So the existing fixtures that use non-overridden schemes
  stay valid.
- **Grep-safe prose.** New JSDoc / comments in `gauntlet.logic.ts`, `gauntletTruth.logic.ts` and
  `gauntletRunProgress.logic.ts` cite D-24671 §5 for the registry boundary and never spell the registry package
  specifier — the Verification grep is literal (00.3 §18).
- **No mutation of inputs.** `buildGauntletCatalog` never mutates `heroPoolBudgets` or any input map. When the budget
  rule applies, each definition receives its own freshly built budgets object.
- **The budget never shrinks.** `budget[n] = max(baseHeroCount[n], max over legs of legHeroCount[n]) + 2`, computed
  only for player counts present in the passed `heroPoolBudgets` (the fixed division's existence condition is
  unchanged).
- **No change** to `gauntletTruth.logic.ts`, `gauntletRun.logic.ts` (save path), `gauntletRun.routes.ts`,
  `legends.publisher.ts`, `competition.logic.ts`, the gauntlet pack format, or any engine / registry file. If one needs
  a CODE edit, STOP and report.
- **Existing tests:** pass without edits unless the pre-flight scaffold records a mandated edit. Any other failure is
  STOP-and-report.

## Locked Contract Values

- **Wiring (`server.mjs`):** for every gauntlet set summary and every scheme of that set, compute
  ``heroCountByPlayerCount[n] = resolveEffectiveHeroCount(`${setAbbr}/${schemeSlug}`, n,
  PLAYER_COUNT_SETUP[n].heroCount)`` for n = 1..5. Collect into `legHeroCountsByScheme: Map<string, Record<number,
  number>>` keyed `${setAbbr}/${schemeSlug}`, passed as the new 5th argument of `buildGauntletCatalog`. The base map
  `heroPoolBudgets` (`heroCount + 2`, :627–630) is still built and passed as today.
- **`GauntletLeg`** gains OPTIONAL `heroCountByPlayerCount?: Readonly<Record<number, number>>`, stamped from the map.
- **`buildGauntletCatalog(setSummaries, heroPoolBudgets?, approvedLoadoutsByGauntlet?, approvedLoadoutsByScheme?,
  legHeroCountsByScheme?)`:** when `legHeroCountsByScheme` and `heroPoolBudgets` are both supplied, each definition's
  `heroPoolBudgets[n]` = `max(heroPoolBudgets[n] - 2, max over its legs of leg.heroCountByPlayerCount[n]) + 2` for every
  `n` in `heroPoolBudgets`. Otherwise the passed map is stamped unchanged (today's behaviour). A leg with no
  `heroCountByPlayerCount[n]` contributes nothing to the inner max (equivalently, the base); the result is always a
  finite integer ≥ the passed `heroPoolBudgets[n]`, never `NaN`. Legs are stamped whenever `legHeroCountsByScheme` has
  their key, whether or not `heroPoolBudgets` is supplied.
- **One budget helper.** The budget rule lives in one non-exported pure helper in `gauntlet.logic.ts` (e.g.
  `deriveDefinitionHeroPoolBudgets(legs, baseBudgets)`, which returns a fresh object); `buildGauntletCatalog` calls it
  once per definition and only stamps the result.
- **`GauntletRunLegProgress`** (server type and client mirror) gains REQUIRED `heroCount: number` — the leg's required
  pick count: `leg.heroCountByPlayerCount?.[run.playerCount] ?? inputs.heroCount`.
- **JSDoc for the two `heroCount`s** (server `gauntletRun.types.ts` and client `gauntletRunApi.ts`):
  `GauntletRunProgressView.heroCount` is the BASE per-player-count count (`PLAYER_COUNT_SETUP`), not a leg's required
  pick — gating and hints read `legs[].heroCount`; `GauntletRunLegProgress.heroCount` is the leg's required pick, from
  `resolveEffectiveHeroCount`.
- **`hasFullPicks`** = `pickCount === <that leg's heroCount>`. The view's run-level `heroCount` stays the base count;
  `budget` stays `inputs.poolBudget` (now the per-gauntlet value).
- **Client hint** (`MyProfilePage.vue`): `Enter a full hero pick ({{ leg.heroCount }} heroes) and save to enable Play
  this leg.` `canPlayLeg` is unchanged (it reads `hasFullPicks`).
- **Blog block:** `renderBudgetTable` prints, per player count, `max(base, largest leg count) + 2` for the gauntlet's
  schemes (via the resolver from the registry dist), and its comment cites D-24187 §4 as amended by D-24671.
- **Expected Core budgets** (verify against the built catalog; STOP if different): 8 at 1, 2, 3, 4 and 5 players.
  A set with no overridden scheme keeps 5 / 7 / 7 / 7 / 8.
- **API catalog row** (`docs/ai/REFERENCE/api-endpoints.md`, the `GET /api/me/gauntlet-runs` row — :173 at baseline),
  replaced whole:
  Status, Method, Auth unchanged (closed sets); the response's `legs[]` gains `heroCount`; `budget` is documented as
  `max(base, largest leg count) + 2` for the run's gauntlet; Authorizing WP appends `WP-798 / D-24671 (per-leg hero
  count, per-gauntlet budget)`; the rest carried forward.
- **D-24671** is authored at execution as Active (six points in §D-24671 Content).

## Scope (In)

### A) Server
- `server.mjs`: import the resolver from the subpath; build `legHeroCountsByScheme`; pass it to `buildGauntletCatalog`;
  refresh the `// why:` comments at :621–626 and :1243–1245 to the per-gauntlet `max(base, largest leg) + 2` rule
  (D-24671).
  `resolveGauntletRunProgressInputs` is unchanged in shape (it already passes `definition.legs` and the definition's
  budget).
- `legends/gauntlet.logic.ts`: the optional leg field, the optional 5th parameter, the budget rule, and the header /
  JSDoc / standings docs (:18–28, :120–127, :201–204, :556–559) describing it.
- `gauntlet/gauntletRun.types.ts`: `GauntletRunLegProgress.heroCount`; docs at :239–248, :336–345, :363–373.
- `gauntlet/gauntletRunProgress.logic.ts`: the per-leg count, `hasFullPicks`, and the comments at :286–289 and
  :441–446.
- `docs/ai/REFERENCE/api-endpoints.md`: the progress GET row replaced whole (D-11804).

### B) arena-client
- `lib/api/gauntletRunApi.ts`: the leg mirror gains `heroCount`.
- `pages/MyProfilePage.vue`: the hint reads `leg.heroCount`.

### C) Blog tooling and docs
- `scripts/gauntlet-post-block.mjs`: `renderBudgetTable(setAbbr, schemes)` prints five rows (1–5 players, no collapsed
  2–4 row) with columns `Players | Base heroes | Largest leg | Fixed-Pool budget`, and cites D-24187 §4 as amended by
  D-24671.
- `wiki/leaderboard.md`: the budget statements (:429–434, :498, :846, :1220–1222, :1258–1262) say `max(base, largest
  leg count) + 2`, citing D-24671.

### D) Tests
- **`legends/gauntlet.logic.test.ts`:** with `legHeroCountsByScheme`, a set whose one leg needs 6 at every count gets
  budgets 8 / 8 / 8 / 8 / 8 and the leg carries its counts; a set whose ONLY leg (every leg) has
  `heroCountByPlayerCount[2] = 4` keeps budget 7 at 2p (without `max(base, …)` it would be 6) — the revert-proof (c)
  fixture; a set with two legs, only one present in `legHeroCountsByScheme`, yields finite budgets equal to
  `max(base, that leg) + 2`; one call over an overridden set (`setAbbr` sorting FIRST) and a non-overridden set
  asserts 8/8/8/8/8 and 5/7/7/7/8 respectively, and the passed budgets object still deep-equals
  `{1:5,2:7,3:7,4:7,5:8}` afterwards — the revert-proof (e) fixture; without the map, definitions are unchanged (the
  existing assertions stay as they are).
- **`gauntlet/gauntletRunProgress.logic.test.ts`:** a leg with `heroCountByPlayerCount` 6 at the run's count reports
  `heroCount` 6, `hasFullPicks` false with 5 picks and true with 6; a leg with no count falls back to the base.
- **`lib/api/gauntletRunApi.test.ts`:** the leg's `heroCount` round-trips. The round-trip case uses a new fixture (a
  spread of `PROGRESS_VIEW` with its own `legs`); `PROGRESS_VIEW` itself is not edited.
- **Mandated existing-test edit (pre-flight scaffold):** the `legs()` helper in `gauntletRunProgress.logic.test.ts`
  (:218–232) adds `heroCount: <n>` to each built leg — a type-only fixture completion (`GauntletRunLegProgress.heroCount`
  is REQUIRED; apps/server has no typecheck lane, so it is otherwise a silent type hole). No assertion changes. Named in
  the `Tests-changed:` trailer.
- **AC7** (the profile hint) is verified by the D-24026 live verify; no `MyProfilePage` unit harness exists.
- **Non-vacuous:** reverting each of these must fail at least one new test. Report 5/5: (a) the per-leg
  `hasFullPicks` count, (b) the budget `max(…) + 2` rule, (c) the never-shrink `max(base, …)`, (d) the leg-count stamp,
  (e) the fresh per-definition budgets object (an in-place version fails the shared-object fixture).

## D-24671 Content (authored at execution, Status Active)

**Amends D-24187 §4 (pool budget) and D-24265 (per-leg `hasFullPicks` / `ready` count; `budget` definition).**

1. **Per-leg hero count.** A gauntlet leg's required hero pick is `resolveEffectiveHeroCount` for that leg's scheme at
   the run's player count, computed in the wiring layer and stamped on the leg. The view shows it per leg; "full
   picks" and "Play this leg" follow it. The run-level `heroCount` stays the base count.
2. **Pool budget, amending D-24187 §4.** A gauntlet's fixed-division budget at N players is `max(base heroCount,
   largest leg count) + 2`, per gauntlet (per set), never below `base + 2`. A set with no overridden leg is unchanged.
   Core becomes 8 at every count.
3. **Ranked consequence.** Standings evaluate at read time, so a looser budget can newly qualify existing fixed-division
   entries on affected gauntlets. Execution runs a read-only production query (or hands Jeff the psql command)
   counting Core fixed-division-eligible entries per player count, and records the observed count here. Nothing is
   re-scored or deleted; `team_key`, leg-clear rules and the approved loadouts are unchanged. No migration: nothing
   persisted changes (`leg_picks`, `competitive_scores`, `team_key`, published board and index shapes), and runs and
   standings re-derive on read. Version skew between the Render and Pages deploys is accepted: gating is
   server-derived (`hasFullPicks`), so only the hint text can render without a count for a few minutes.
4. **The save path stays structural** (D-24264 §2): picks of any length save; the per-leg count gates Play, and the
   engine remains the authoritative composition block.
5. **One definition.** Counts come only from the registry resolver; the logic modules stay registry-free and fall back
   to the base count when no per-leg count is injected. WP-799's table reaches the gauntlet through this path.
6. **Not covered:** a count check on save, and historical WP wording (named follow-ups).

## Out of Scope

- `gauntletTruth.logic.ts`, `gauntletRun.logic.ts`, `gauntletRun.routes.ts`, `legends.publisher.ts`,
  `competition.logic.ts`, the pack format, the engine and the registry.
- WP-799's 24 new rules.
- The legends-board app (it shows `heroPool`, never the budget or count).

## Files Expected to Change

- `apps/server/src/server.mjs` — modified — resolver import, per-leg counts map, catalog call
- `apps/server/src/legends/gauntlet.logic.ts` — modified — leg field, 5th param, budget rule, docs
- `apps/server/src/legends/gauntlet.logic.test.ts` — modified — new cases
- `apps/server/src/gauntlet/gauntletRun.types.ts` — modified — `GauntletRunLegProgress.heroCount`, docs
- `apps/server/src/gauntlet/gauntletRunProgress.logic.ts` — modified — per-leg count, `hasFullPicks`
- `apps/server/src/gauntlet/gauntletRunProgress.logic.test.ts` — modified — new cases
- `apps/arena-client/src/lib/api/gauntletRunApi.ts` — modified — leg `heroCount`
- `apps/arena-client/src/lib/api/gauntletRunApi.test.ts` — modified — round-trip case
- `apps/arena-client/src/pages/MyProfilePage.vue` — modified — per-leg hint
- `scripts/gauntlet-post-block.mjs` — modified — per-gauntlet budget table
- `docs/ai/REFERENCE/api-endpoints.md` — modified — progress GET row replaced whole
- `wiki/leaderboard.md` — modified — budget rule wording
- Governance:
  - `docs/ai/STATUS.md`
  - `docs/ai/DECISIONS.md` (D-24671 → Active)
  - `docs/ai/work-packets/WORK_INDEX.md`
  - `docs/ai/execution-checklists/EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`

Size: 12 files + governance, kept atomic because the server type, client mirror and hint must ship together (a split
leaves the wire field unread or the hint wrong) and the blog / wiki wording restates the same amended rule.

No other files may be modified. Line-ending-only churn a build leaves in generated files is reverted.

## Contract

- Every gauntlet leg's required hero pick equals `resolveEffectiveHeroCount` for its scheme at the run's player count.
- Every gauntlet's fixed-division budget at N is `max(base, largest leg count) + 2`, and equals today's value for any
  gauntlet with no overridden leg.

## Acceptance Criteria

1. A Core run's Secret Invasion leg reports `heroCount` 6 at 1–4p; `hasFullPicks` is true only with 6 picks.
2. A Core run's Civil War leg reports `heroCount` 4 at 2p and 5 at 3p.
3. A leg with no injected count reports the base count (back compatible).
4. Core's built budgets are 8 / 8 / 8 / 8 / 8; a gauntlet with no overridden leg keeps 5 / 7 / 7 / 7 / 8.
5. A leg lowering its count never lowers the budget below `base + 2`.
6. `buildGauntletCatalog` without the new argument returns definitions byte-identical to today.
7. The profile hint names the leg's own count.
8. `pnpm -r --no-bail test` has 0 failures; arena-client typecheck 0; the only existing-test edit is the mandated
   `legs()` helper in `gauntletRunProgress.logic.test.ts`, named in the `Tests-changed:` trailer.

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0
pnpm -r --no-bail test
# Expected: 0 failures; record before/after counts per package
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0
git grep -n "@legendary-arena/registry" -- apps/server/src/legends/gauntlet.logic.ts apps/server/src/legends/gauntletTruth.logic.ts apps/server/src/gauntlet/gauntletRunProgress.logic.ts
# Expected: no output — the logic modules stay registry-free (EC-835 Guardrail 1)
node scripts/gauntlet-post-block.mjs core magneto
# Expected: Fixed-Pool budget column 8 / 8 / 8 / 8 / 8
node scripts/gauntlet-post-block.mjs dkcy apocalypse
# Expected: 5 / 7 / 7 / 7 / 8
# Real-data catalog check (scratch script in the session scratchpad, outside the worktree; never committed): build
# the catalog exactly as server.mjs does (real set summaries + the resolver map) and print (i) every gauntlet's
# heroPoolBudgets and (ii) Core's Secret Invasion and Civil War leg heroCountByPlayerCount. Expected: (i) core 8 at
# all five counts, every other scheme-hosting set 5 / 7 / 7 / 7 / 8; (ii) Secret Invasion {1:6,2:6,3:6,4:6,5:6},
# Civil War {1:3,2:4,3:5,4:5,5:6}. Record the output in the execution notes. STOP if different.
pnpm ledger:numbers:check; pnpm roadmap:counts:write; pnpm roadmap:counts:check
# Expected: each exits 0
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All ACs pass. The 5/5 revert proofs (a)–(e) are reported.
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. Arena-client typecheck is 0. Per-package
      before/after counts are recorded.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED), after deploy:**
  - import a Core gauntlet pack on play.legendary-arena.com (profile → Gauntlet Runs) at 2 players: the Secret
    Invasion leg's hint says 6 heroes and the Civil War leg's says 4;
  - save 6 heroes on Secret Invasion, "Play this leg" launches, and the match has 6 heroes;
  - the run's "Hero pool: N / 8 budget" line shows 8.

  Verify after BOTH the server (Render) and client (Pages) deploys have landed — the client reads the new per-leg
  `heroCount`. Record the matchId in STATUS.md.
- [ ] STATUS.md updated. D-24671 authored in DECISIONS.md as Active, with the six points.
- [ ] D-24671 §3 records the observed Core fixed-division-eligible entry count per player count (the read-only query
      result, or the psql command handed to Jeff and his result).
- [ ] Back-pointers appended in DECISIONS.md: under D-24187, `**§4 amended by D-24671 (<date>, WP-798):** budget =
      max(base heroCount, largest leg count) + 2 per gauntlet; never below base + 2.`; under D-24265, `**Amended by
      D-24671 (<date>, WP-798):** hasFullPicks compares each leg's own heroCount; budget is the per-gauntlet D-24671 §2
      value.`
- [ ] WORK_INDEX WP-798 `[x]` with date. EC_INDEX EC-835 → Done. Mindmap `📝`→`✅`. `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §1 / §2: faithful setup. A leg asks for the scheme's printed hero count.
  - §3: fairness. Every player's leg uses the same printed count.
  - §23 / §24: leaderboards and competitive integrity. The fixed-division budget grows to fit the largest leg; a
    looser budget can newly qualify existing entries; the observed count from the read-only production query is
    recorded in D-24671 §3.
  - §8 / §22: deterministic and replay-faithful. No engine, `G`, replay, `finalStateHash`, `competitive_scores` or
    `team_key` change; standings and run progress stay pure read-time functions of the stored rows plus the catalog.
  - §19a: the profile tracker stays a read-only derived view.
  - None of NG-1..NG-8 is crossed.
- **Conflict assertion:** no conflict. Rules fidelity and a ranked-format correction; no monetization surface.

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. This was an independent subagent run: PASS (no Final Gate row fires), with
advisory edits A1–A11 applied before commit and a delta re-check confirming PASS (EC-835 81 non-empty lines, under
the 100 cap).
- **§1 structure:** all required sections are present. Baseline `3fbb03f3` is cited.
- **§2 constraints:** engine-wide constraints (ESM, Node v22+, full files with no diffs or snippets, `00.6`),
  packet-specific constraints with the session protocol and named STOP points (five untouched modules, registry-free
  logic, grep-safe prose, no input mutation, never-shrink budget), and the Locked Contract Values.
- **§3 / §4:**
  - WP-384 / D-24187 §4, WP-446 / D-24265, WP-449 / D-24269, WP-472 / D-24283 and WP-524 / D-24337 + WP-576 /
    D-24385 (the resolver) are cited with verified line anchors. The reservation (#2642) is gated in EC Before
    Starting.
  - Also cited: the DECISIONS scan list (incl. D-24264, D-24372, D-11804), 00.2 §7 canonical names, ARCHITECTURE
    §Layer Boundary and `.claude/rules/architecture.md` Import Rules.
- **§5 / §7:**
  - A closed allowlist: 12 server / arena-client / blog-tooling / wiki / API-catalog files plus governance, each
    marked modified. The size is justified by the atomic server-type + client-mirror + hint change.
  - No new dependencies and no `package.json` change.
- **§6 naming:** `schemeId`, `heroDeckIds` and the set-qualified scheme ext_id key are canonical; the new names
  (`heroCountByPlayerCount`, `legHeroCountsByScheme`, `GauntletRunLegProgress.heroCount`) are full words.
- **§8 layer:** `server.mjs` (wiring) imports the resolver from the registry `playerCountSetup` subpath and injects
  plain per-leg counts; `gauntlet.logic.ts`, `gauntletTruth.logic.ts` and `gauntletRunProgress.logic.ts` stay
  registry-free (grep-verified). The client only reads `leg.heroCount`. No `G` field, no engine change, nothing
  persisted.
- **§9 Windows:** `pwsh` verification.
- **§10 / §11:** N/A — no environment variable; the progress GET stays `authenticated-session-required` and no auth
  code is touched.
- **§12 tests:** `node:test` only; pure logic tests and a client round-trip on a new fixture; no boardgame.io,
  network or database; 5/5 revert proofs (a)–(e); one mandated type-only `legs()` fixture edit, named in the
  `Tests-changed:` trailer.
- **§13 / §14 / §15:**
  - exact commands with their expected output, including the logic-module registry grep, both blog-block budget
    rows (`core magneto`, `dkcy apocalypse`) and the scratch real-data catalog check (Core 8×5, others 5/7/7/7/8;
    Secret Invasion / Civil War leg counts);
  - 8 binary ACs;
  - a DoD covering STATUS, DECISIONS (D-24671 Active plus the D-24187 / D-24265 back-pointers and the §3 observed
    count), WORK_INDEX, EC_INDEX, the mindmap and roadmap counts, the allowlist scope check and the D-24026 live
    verify on play (2-player Core run, after both the Render and Pages deploys; matchId recorded).
- **§16 code style:** JSDoc, no nested ternaries, no branching `.reduce()`, one non-exported budget helper, the
  blog script's deliberate duplicate-first copy, and the `// why:` list in the EC.
- **§17 Vision:** §1/§2/§3/§8/§19a/§22/§23/§24 touched; no NG-1..NG-8 crossing; the determinism line (no engine,
  `G`, replay, `finalStateHash`, `competitive_scores` or `team_key` change; standings re-derive on read) and the
  accepted ranked consequence (D-24671 §3) are stated.
- **§18:** the Verification grep is literal and scoped to the three logic modules; it is clean at baseline, and new
  prose there cites D-24671 §5 instead of the package specifier.
- **§19:** N/A — commit-time discipline.
- **§20 Funding:** N/A — the touched surfaces are the profile Gauntlet Runs "Play this leg" hint, the fixed-division
  standings budget and the generated blog budget table. None is a navigation, viewer, profile-attribution or
  tournament funding affordance, and there is no donate/support copy.
- **§21 API Catalog:** triggered. `GET /api/me/gauntlet-runs` gains `legs[].heroCount` and documents `budget` as
  `max(base, largest leg count) + 2` per gauntlet. Its `api-endpoints.md` row is replaced whole (D-11804) in the
  execution commit: Status `Wired`, Auth `authenticated-session-required` (closed sets, unchanged), field names
  canonical, Authorizing WP gains WP-798 / D-24671.

## Gate Verdicts

All three gates ran as independent subagents.
- **Pre-flight (01.4): NOT READY → READY TO EXECUTE.**
  - Empirical scaffold (own throwaway worktree at `3fbb03f3`): the Locked Contract Values implemented in 7 allowlisted
    files. `pnpm -r build` 0; `pnpm -r --no-bail test` 0 failures in every package with baseline-identical counts
    (registry 281, game-engine 5011, server 1663 / 1457 pass, registry-viewer 326, arena-client 2297, dashboard 570,
    legends-board 135, engine-runner 20, preplan 52, lagn-spec 107, vue-sfc-loader 11, replay-producer 4);
    arena-client typecheck 0; scripts 105 / 105.
  - Real-data check: Core budgets 8×5; the other 38 scheme-hosting sets 5/7/7/7/8; the 4-argument and
    5th-argument-omitted catalogs byte-identical; Core Secret Invasion legs 6 at 1–5p, Civil War 3/4/5/5/6; the
    post-block script prints 8s for Core and 5/7/7/7/8 for dkcy.
  - PS-1: the mandated type-only `legs()` helper edit recorded. PS-2: the never-shrink fixture pinned (every leg 4 at
    2p → 7). RS-1..RS-7 applied (stale `server.mjs` comments, the five-row blog table, the alternative formula as an
    operator decision, the D-24671 §3 wording, deploy order, AC7 via live verify, the `passedBudget - 2` comment).
    Delta re-check: **READY**, with the formula locked as the default unless Jeff selects the alternative.
- **Copilot (01.7): RISK → HOLD → HOLD → PASS (CONFIRM).** Nine scope-neutral fixes: #1 the registry-free grep; #4 the
  blog-script duplicate-first comment; #6 partial-map semantics (no `NaN`); #11 the post-block commands and the
  real-data catalog check; #17 no input mutation plus the shared-object fixture as revert proof (e); #20 the Amends
  lead-in and DECISIONS back-pointers; #25 one pure budget helper; #27 JSDoc for both `heroCount` meanings; #28 the
  no-migration / deploy-skew text and the read-only production count. The re-run found two stale lines (4/4 → 5/5;
  the "unverified" Vision wording), fixed; its CONFIRM criterion (no "4/4", "believed" or "unverified" in either
  file) holds.
- **Lint (00.3): PASS.** No Final Gate row fires. Advisories A1–A11 applied (architecture Import Rules + 00.2 §7 in
  Read; the resolver + reservation Assumes bullet; full paths; `dkcy apocalypse`; the expanded real-data check;
  grep-safe prose; the §8/§22/§19a vision lines; AC8 + the new-fixture note; double-backtick spans; the API row by
  path; the allowlist size line and the §3 observed-count DoD bullet). The delta re-check returned **PASS**.
