# WP-834 — Core-first gauntlet fill: ranked loadouts take Core groups before Core 2E

**Status:** Done 2026-10-25 (EC-872 `94915538`; **D-24767** Active). Live-verify PASS 2026-10-25 (STATUS).
**Primary Layer:** Shared tooling (`scripts/generate-gauntlet-loadouts.mjs`) + Registry (its generated module
`packages/registry/src/gauntletLoadouts.generated.ts`, and one registry test file)
**User-Visible Surface:** legends.legendary-arena.com gauntlet boards and play.legendary-arena.com "Play this leg" (the
approved villain / henchmen loadout of 51 non-Core masterminds)
**Lane:** Standard (two-commit topology). Not lightweight-eligible: it changes the approved ranked compositions
(competitive surface) and D-24767 locks a fill-order invariant for future regenerations.
**Baseline:** `origin/main` @ `40b9ef77` (2026-10-25).

## Goal

Ranked gauntlet loadouts stop fielding Core 2E (co2e) villain and henchmen groups whose printed effects the engine
does not run, by filling out-of-set slots from **Core first, then Core 2E**.

When a mastermind's own set cannot fill every villain or henchmen slot, the menu generator fills the rest from the Core
Set + Core 2E pool (D-24199). Its code comment says the pool is "the two Core sets, in this order" (`['core', 'co2e']`),
but two lines later it sorts the combined list, and `co2e/…` sorts before `core/…`. So every fallback slot takes the
Core 2E group first. Six of the eight co2e villain groups carry no `[effect:]` marker on any Ambush / Fight / Escape line
(Brotherhood of Mutants 0/7, Enemies of Asgard 0/8, HYDRA 0/6, Radiation 0/5, Sinister Spider-Foes 0/6, Sinister
Syndicate 0/5), Skulls has 1 of 6, and co2e Hand Ninjas and Savage Land Mutates are unmarked too. Their Core versions are fully
marked (Brotherhood 5/5, Enemies of Asgard 7/7, HYDRA 4/4, Radiation 5/5, Spider-Foes 4/4; Hand Ninjas and Savage Land
Mutates marked).

Jeff's 2-player WWII match `cfWSKCGr0ZL` (2026-10-25) showed it live: 13 "Unhandled effect … no-handler" lines, all from
co2e Brotherhood of Mutants, the group the ca75 gauntlet leg fields at 2 players.

After this packet the fallback pool keeps set order (Core, then Core 2E), each set sorted. No menu outside Core 2E
fields a Core 2E group.

## User-Visible Impact

- **Ranked gauntlet:** 51 masterminds' approved loadouts change (48 base variants, 13 scheme overrides), all in non-Core
  sets. Every out-of-set slot now holds a Core group. For example the ca75 Change the Outcome of WWII leg fields
  `core/brotherhood` at 2 players (was `co2e/brotherhood-of-mutants`) and `core/doombot-legion` henchmen (was
  `co2e/doombot-legion`).
- **Measured** over all 3,195 leg × player-count compositions: compositions fielding a hollow co2e fallback group go
  from 592 (51 masterminds) to 0, and 203 compositions become free of any group with no implemented effect (a group
  counts when it has at least one Ambush / Fight / Escape / Overrun line and none carries `[effect:]`). The other hollow
  compositions come from each set's own unmarked groups (the general villain-effect backlog, out of scope).
- **Operator note:** a player partway through a non-Core gauntlet who saved a draft with the old co2e loadout sees the
  cards builder's qualification badge flip to not-qualified; re-applying the leg's loadout fixes it. No score is
  affected.
- **Scores:** none affected, and none exist to affect. Checked live on 2026-10-25: `GET
  https://api.legendary-arena.com/api/leaderboards/scenarios` returns `{"scenarioKeys":[]}` (the distinct scenario keys
  of link/public-visible `competitive_scores` rows, `leaderboard.logic.ts` :325–331; a private row cannot qualify a leg
  either, since qualification requires every owner to be link or public), `/api/leaderboards/top` returns 0 eligible entries, and the published legends
  index shows 0 entries on all 110 gauntlet boards. Structurally, submission rejects a scenario without published PAR
  before any insert (`competition.logic.ts` :797–800, `par_not_published`). The PAR gate checks a sim index first
  (`parGate.mjs` :83–105), but `data/par/sim` is not committed and the server deploys by git checkout of a SHA, so only
  the Core seed PAR (`data/par/seed/v1`, 8 Core schemes) is published. Core and Core 2E masterminds' menus do not change.
- **No migration:** gauntlet runs store hero picks only (`player_gauntlet_runs.leg_picks`, `gauntletRun.types.ts`
  :86–97); leg clears and "Play this leg" are derived at read time from the current approved loadouts
  (`gauntletRunProgress.logic.ts` :221–260), so a run started before deploy launches its next leg with the new
  composition. Gauntlet Packs carry no composition (`loadoutGauntletPackImport.ts` :5–12).
- **Casual play:** unchanged. Only the approved ranked composition moves.

## Assumes

1. **WP-395 / D-24199 ✅** — the canonical per-mastermind menu and its fill rule (anchors → in-set → Core fallback),
   `scripts/generate-gauntlet-loadouts.mjs` `buildLoadoutMenus` (:466–496 builds the pool, the combined sort at :495–496;
   `fillGroupSlots` :206–244 takes candidates in pool order via `pickByRotation` :177–193, offset 0). D-24199 names the pool ("the Core Set / Core 2E pool") but
   no order.
2. **WP-458 / D-24278 ✅** — one canonical configuration per mastermind (variant 0).
3. **WP-472 / WP-483 / D-24283 ✅** — `getGauntletConfig` returns an authored leg (Core only) or the menu's
   `schemeOverrides`; every ranked consumer (server overlay, legends publisher, run launch, viewer pack import and
   qualification badge) reads the menu or that loader, so regenerating the menu reaches them with no code edit.
4. **WP-796 / D-24666 ✅ and WP-833 / D-24766 ✅** — `schemeOverrides` are built from the same pool with the same fill rule,
   so they follow the new order automatically. The generator's duplicate-slug guard stays.
5. **Seed PAR** (`scripts/generate-seed-par.mjs`) enumerates scenarios from `data/gauntlet-configs.json` (Core authored
   legs) and published PAR exists only for Core schemes, so no PAR artifact or `artifactHash` moves.
6. **Determinism:** no engine, `G`, `MatchSetupConfig` or replay change; the sentinel fixture is untouched.
7. **External state:** on 2026-10-25 production held no publicly visible `competitive_scores` scenario key (the EC
   re-checks `/api/leaderboards/scenarios`); the reservation (#3008) and this drafting commit are on `main` before
   execution.

## Context (Read First)

**Read:**
- `docs/ai/DECISIONS.md`: D-24199 (fill rule), D-24278 (single variant), D-24283 (per-scheme overlay), D-24666 /
  D-24766 (scheme overrides), D-24372 (runtime drift pins), D-24026 (live-verify).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary and `.claude/rules/architecture.md` §Layer Boundary: the generator is
  offline tooling that writes a registry data module; no runtime package imports it.
- `docs/ai/coverage/villain-mechanic-ledger.csv`: the co2e rows marked `unmarked`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7 Match Configuration: the regenerated values flow into
  `villainGroupIds` / `henchmanGroupIds`; no field or shape changes.

**Why Core first, not "prefer groups with implemented effects."** A rule keyed on marker status would move approved
ranked loadouts every time a marker lands, re-keying legs repeatedly. Set order is fixed, explainable, and matches the
pool's own comment ("in this order"). Core is also the set every player is assumed to own (D-24199).

**Why now.** It is free today: no non-Core leg has published PAR, so no score is re-keyed or lost. That stops being true
the day non-Core PAR is published.

**Named follow-ups (out of scope):**
- marking the co2e villain and henchmen effects (42 unmarked Ambush / Fight / Escape lines across seven villain groups,
  plus the Hand Ninjas and Savage Land Mutates henchmen lines),
  which also fixes casual co2e play;
- the 60-odd other villain groups with no implemented effects, which in-set fill keeps fielding;
- the WP-833 / D-24766 records that name the old co2e WWII ids (historical, not rewritten);
- the synthetic-fixture comments in `apps/server/src/legends/gauntlet.logic.test.ts` (:930, :1000–1002) that say the
  2099 gauntlet pulls `co2e/enemies-of-asgard` (the fixture stays valid; the comment goes stale);
- the `server.mjs` :700–703 comment that every non-Core leg returns `undefined` from `getGauntletConfig` (stale since
  WP-796);
- the co2e villain group named and slugged `Skulls` whose cards are Skrulls (a slug change re-keys ext ids).

## Non-Negotiable Constraints

**Engine-wide:** no engine change. ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`; human-style code per
`docs/ai/REFERENCE/00.6-code-style.md` (full-word names, JSDoc on every function, `// why:` comments); full file contents
for every new or modified file — no diffs, no snippets; no new dependency, no `package.json` change.

**Packet-specific:**
- **Session protocol:** if anything here contradicts the code at baseline, STOP and ask.
- **One change in the generator:** remove the combined `fallbackVillainIds.sort()` / `fallbackHenchmenIds.sort()` so the
  pool keeps `CORE_FALLBACK_SET_ABBRS` order with each set's ids sorted by `buildGroupIds`. No other fill-rule change
  (anchors, in-set order, rotation, guards stay as they are).
- **Generated module only through its script:** `pnpm gauntlet:loadouts`. `data/gauntlet-configs.json` and
  `gauntletConfigs.generated.ts` do not change.
- **Existing tests pass without edits, EXCEPT this one, observed failing in the scaffold:**
  `packages/registry/src/gauntletConfigs.test.ts` "names the generated Change the Outcome of WWII villains at 1p and 5p"
  (WP-833). Its 5-player ids become the Core groups. The commit carries a `Tests-changed:` trailer naming it. Any other
  failing existing test is STOP-and-report.
- **Core and Core 2E menus byte-identical;** no seed-PAR artifact, PAR profile, `gauntlet-configs.json` or replay
  fixture changes.

## Locked Contract Values

- **Pool order:** `CORE_FALLBACK_SET_ABBRS = ['core', 'co2e']` (unchanged) is the pool order; the pool is the
  concatenation of `buildGroupIds('core', …)` then `buildGroupIds('co2e', …)` for villains and for henchmen. No combined
  sort.
- **Generator documentation:** the module header step 3 says "then from the Core Set, then Core 2E (the D-24199
  core-fallback rule, ordered by D-24767)", and a `// why:` comment where the sort was removed.
- **Expected regeneration** (STOP if it differs): `pnpm gauntlet:loadouts` reports 110 menus; exactly 51 menus change (48
  base variants, 13 `schemeOverrides`), across 2099, anni, antm, asrd, bkpt, bkwd, ca75, chmp, dead, dstr, fear, ff04,
  gotg, mdns, mgtg, msis, nmut, noir, pttr, rlmk, rvlt, shld, smhc, vnom, wpnx; `git diff --numstat` on the generated
  module is `313 313`; no `core` or `co2e` menu changes.
- **WWII override after** (both ca75 masterminds): 1p villains `ca75/masters-of-evil-wwii`, `ca75/zolas-creations`; 2p
  adds `core/brotherhood`; 5p adds `core/brotherhood`, `core/enemies-of-asgard`, `core/hydra`; henchmen
  `core/doombot-legion` (+ `core/hand-ninjas` at 4–5p).
- **New pin** (`packages/registry/src/gauntletLoadouts.test.ts`, a top-level `test()` per the file's convention): "out-of-set slots fill from Core before Core 2E" —
  across every menu outside `co2e` (base variant and every `schemeOverrides` composition at 1–5p), no villain or henchmen
  id starts with `co2e/`. Output-derived (the generator runs `main()` on import), the D-24666 precedent.
- The pin also asserts it checked more than 0 non-co2e menus and saw at least one `core/` id; it may not filter or mock
  the menu list.
- **D-24767** is authored at execution as Active (four points in §Reserved Decision).

## Scope (In)

- `scripts/generate-gauntlet-loadouts.mjs`: remove the combined sort; update the header and add the `// why:`.
- `packages/registry/src/gauntletLoadouts.generated.ts`: regenerated.
- `packages/registry/src/gauntletLoadouts.test.ts`: the new pin.
- `packages/registry/src/gauntletConfigs.test.ts`: the mandated WWII-ids edit.

## Out of Scope

- Marking co2e (or any other set's) villain / henchmen effects.
- Any change to D-24199's anchors, in-set order, rotation or the duplicate-slug guard.
- `data/gauntlet-configs.json` (Core authored legs), seed PAR, PAR profiles, legends-board or server code.
- Rewriting the WP-833 / D-24766 historical records.

## Files Expected to Change

- `scripts/generate-gauntlet-loadouts.mjs` — modified — pool order + docs
- `packages/registry/src/gauntletLoadouts.generated.ts` — modified — regenerated via `pnpm gauntlet:loadouts`
- `packages/registry/src/gauntletLoadouts.test.ts` — modified — the Core-first pin
- `packages/registry/src/gauntletConfigs.test.ts` — modified — the mandated WWII-ids edit
- Governance:
  - `docs/ai/STATUS.md` — modified — the WP-834 entry
  - `docs/ai/DECISIONS.md` — modified — D-24767 appended as Active
  - `docs/ai/work-packets/WORK_INDEX.md` — modified — the row flips to `[x]`
  - `docs/ai/execution-checklists/EC_INDEX.md` — modified — EC-872 → Done
  - `docs/05-ROADMAP-MINDMAP.md` — modified — node `✅` + regenerated counts
  - `docs/ai/work-packets/WP-834-core-first-gauntlet-fill.md`, `docs/ai/execution-checklists/EC-872-core-first-gauntlet-fill.checklist.md`
    — modified — status lines only

No other files. Line-ending-only build churn (e.g. `packages/lagn-spec/schemas/lagn-v1.json`) is reverted.

## Scaffold (observed at drafting, REQUIRED evidence)

The generator change was made on the baseline and the menu regenerated:
- `pnpm gauntlet:loadouts` wrote 110 menus, no `GenerationError`; numstat `313 313`; 51 menus changed (48 base, 13
  overrides), none in `core` / `co2e`; no co2e group in any non-co2e menu.
- `pnpm -r build` 0. `pnpm -r --no-bail test`: **only** the WWII-ids test failed (registry 310 / 1). Every other package
  0 fail: game-engine 5729, server 1838, registry-viewer 335, arena-client 2437, dashboard 584, legends-board 138,
  lagn-spec 108, preplan 52, engine-runner 20, vue-sfc-loader 11, replay-producer 4. `pnpm par:seed:test` 2 / 0.
- **Locked post-execution counts:** registry 310 → 311 (+1, the new pin; the mandated edit replaces assertions in place),
  every other package unchanged, 0 fail. A different count is STOP-and-report.

## Contract

- The Core fallback pool is ordered Core, then Core 2E. No ranked approved composition outside Core 2E fields a Core 2E
  group.

## Acceptance Criteria

1. The generator's fallback pool is `core` ids then `co2e` ids, each sorted; no combined sort remains.
2. The regenerated menu matches the Expected regeneration values (51 menus, `313 313`, no core / co2e menu change).
3. The new pin passes; restoring the combined sort and regenerating makes it fail.
4. `getGauntletConfig('ca75', <mastermind>, 'change-the-outcome-of-wwii', n)` returns the locked WWII ids.
5. `pnpm gauntlet:loadouts:check` and `pnpm gauntlet:configs:check` exit 0; `pnpm par:seed:test` passes; no seed-PAR or
   `gauntlet-configs.json` diff.
6. The only edited existing assertion is the mandated WWII-ids test.

## Verification Steps

```pwsh
pnpm gauntlet:loadouts
git diff --numstat -- packages/registry/src/gauntletLoadouts.generated.ts
# Expected: "313 313"
pnpm gauntlet:loadouts:check && pnpm gauntlet:configs:check
pnpm -r build
pnpm -r --no-bail test
# Expected: 0 failures; registry 311, every other package unchanged
pnpm par:seed:test
pnpm ledger:numbers:check; pnpm roadmap:counts:write; pnpm roadmap:counts:check
pnpm workindex:rows:check; pnpm workindex:executed:check
# Revert proof (AC 3): re-add the two .sort() lines in the generator, then
pnpm gauntlet:loadouts; pnpm --filter @legendary-arena/registry test
# Expected: the new pin and the WWII-ids test fail; restore the generator and run pnpm gauntlet:loadouts again
git status --porcelain
# Expected: each exits 0; only the §Files Expected to Change allowlist
```

## Definition of Done

- [ ] ACs 1–6 pass; the revert proof (AC 3) reported.
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail with the locked counts; both gauntlet `:check` 0;
      `par:seed:test` passes.
- [ ] `git status --porcelain` ⊆ the allowlist. Two-commit topology `EC-872:` then `SPEC:`.
- [ ] STATUS.md updated; D-24767 authored in DECISIONS.md as Active; WORK_INDEX `[x]` with date; EC_INDEX Done; mindmap
      `📝` → `✅`; `pnpm roadmap:counts:write`, `roadmap:counts:check` and `ledger:numbers:check` 0.
- [ ] **D-24026 live-verify (REQUIRED, after deploy):** the published legends index
      (`https://images.legendary-arena.com/legends/v1/gauntlet-index.json`, regenerated by the server on its next
      publish) shows the ca75 WWII leg at 2p with `core/brotherhood` and `core/doombot-legion`, and no non-co2e
      gauntlet's legs carry a `co2e/` group; a 2p match created from that leg loadout starts. Record it in STATUS.

## Reserved Decision (lands at execution)

**D-24767 — core-first-gauntlet-fill.** Four points:
1. **Order.** The D-24199 Core fallback pool is ordered Core Set, then Core 2E, each set's groups sorted by id. It
   applies to villain and henchmen slots, base variants and `schemeOverrides` alike. Because Core has 7 Villain Groups
   and 4 Henchman groups, more than the largest out-of-set demand (5 villain, 3 henchmen at 5 players with an extra-group
   override), no menu outside Core 2E fields a Core 2E group; the output-derived pin locks that consequence. If a future
   set legitimately needs Core 2E spill, amend this decision rather than loosen the pin.
2. **Why set order, not marker status.** A fixed order keeps approved ranked loadouts stable as effects land; Core is
   the set every player is assumed to own; it matches the pool's original intent.
3. **No score impact, no migration.** Submission rejects a scenario without published PAR before any insert, only the
   Core seed PAR is published (no sim index is committed or deployed), and on 2026-10-25 `competitive_scores` held no
   publicly visible scenario key (`/api/leaderboards/scenarios` empty; all 110 gauntlet boards at 0). Runs store hero
   picks only; leg clears and leg launch are derived at read time; Gauntlet Packs carry no composition. Core and Core 2E
   menus are unchanged.
4. **Not covered** (named follow-ups): marking the co2e villain and henchmen effects; the other unmarked in-set groups.

## Vision Alignment

- **Clauses touched:** §1 / §2 faithful play (ranked loadouts field villains whose printed effects run); §3 / §23
  fairness and leaderboards (the approved composition of 51 masterminds changes; no published PAR on those legs, so no
  qualifying score moves); §24 competitive integrity (no seed-PAR artifact moves); §8 / §22 deterministic and
  replay-faithful (the generator is a pure function of card data; no engine, `G`, replay or seed-PAR artifact changes).
- None of NG-1..NG-8 is crossed. **Conflict assertion:** no conflict; rules fidelity only, no monetization surface.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run (advisories A1–A6 applied).

| § | Result |
|---|---|
| §1 | PASS — 10 sections, 6 ACs, 4 Out-of-Scope items |
| §2 | PASS — full files, "no diffs, no snippets", ESM / Node 22, 00.6; packet rules, session protocol, Locked Values |
| §3 | PASS — WP-395 / 458 / 472 / 483 / 796 / 833 anchored; external state (scores, reservation) stated |
| §4 | PASS — DECISIONS scan, ARCHITECTURE / rules §Layer Boundary, the ledger, 00.2 §7 (values only, no shape) |
| §5 | PASS — 4 code files + governance; the generated module regenerated by its script |
| §6 | PASS — ids exist in the generated output; no setup-payload field renamed |
| §7 | PASS — no new dependency |
| §8 | PASS — offline script writes a registry data module; the pin reads it without importing the script |
| §9 | PASS — `pwsh` |
| §10 | N/A — no environment variable |
| §11 | N/A — no auth surface |
| §12 | PASS — one `node:test` pin over the committed module; non-vacuous guard |
| §13 | PASS — exact commands, `313 313`, registry 311, the revert proof as commands |
| §14 | PASS — 6 binary ACs |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes, allowlist check; post-deploy legends-index + match live-verify |
| §16 | PASS — JSDoc, full words, the three `// why:` sites |
| §17 | PASS — §1 / §2 / §3 / §8 / §22 / §23 / §24 exist; NG line, conflict and determinism lines |
| §18 | N/A — no grep verification |
| §19 | N/A at lint — commit-time |
| §20 | N/A — no funding affordance or copy |
| §21 | N/A — no endpoint shape, status, auth or catalog Status changes; only composition values in existing responses |

EC-872 vs EC-TEMPLATE: PASS; Locked Values copied verbatim from the WP. **Verdict:** PASS.

## Gate Record

**Pre-flight (01.4) (independent subagent): READY TO EXECUTE after one blocking anchor fix, applied (no re-run
needed).** It reproduced the scaffold independently: registry 310 / 1 (only the mandated test), registry-viewer 335 / 0,
legends-board 138 / 0, server 1838 / 0, `par:seed:test` 2 / 0, both gauntlet `:check` OK; diffing the generated modules
gave exactly 110 menus, 51 changed (48 base, 13 overrides), `313 313`, the same 25 sets, Core / Core 2E byte-identical,
co2e groups in non-co2e menus 313 → 0, hollow co2e fallback compositions 592 → 0, the WWII ids as locked; 0 duplicate
slugs across all 830 compositions before and after. It confirmed the marker counts, the ledger, and that seed PAR is
Core-only (128 scenarios) with qualification fail-closed on unpublished PAR.
- **PS-1 (blocking, fixed):** the `fillGroupSlots` anchor (:206–244, `pickByRotation` :177–193).
- Non-blocking, applied: RS-1 the Skulls wording; RS-2 the hollow-composition delta and its definition instead of
  absolutes; RS-3 every generator guard named; RS-4 the pin as a top-level `test()`; RS-5 the WP / EC status-line edits
  in the allowlist and the two `workindex` checks in Verification; RS-7 and the two papercuts as named follow-ups; RS-8
  the operator note. RS-6 (merge #3008 and the drafting commit before execution) is the plan.

**Copilot (01.7) (independent subagent): round 1 RISK → HOLD, four scope-neutral fixes, applied.** It re-derived the
locked numbers menu by menu (51 / 48 / 13, `313 313`, the 25 sets, `co2e/` ids outside co2e menus 388 → 0, the WWII
ids), confirmed the fill can never reach Core 2E outside co2e menus (capacity 7 / 4 vs demand 5 / 3), that no open PR
touches these files, and that "Core first by set order" is the right invariant.
- **#1 (blocking, fixed):** "no score impact" leaned on the weaker gate and an unchecked premise (the PAR gate reads a
  sim index first; production's was unverified) → the submission-side `par_not_published` reject, the not-committed /
  git-deployed sim index, and live evidence (`/api/leaderboards/scenarios` empty, top board 0, all 110 gauntlet boards
  0, checked 2026-10-25); an EC Before-Starting re-check of the scenarios endpoint.
- Non-blocking, applied: #2 the no-migration facts (runs store hero picks only; derived leg clears / launch; packs carry
  no composition); #3 the capacity fact and "amend, don't loosen the pin" in D-24767 §1; #4 the EC baseline check reads
  `origin/main`, not the scaffold worktree.
- Delta re-run: **CONFIRM**, all four fixes verified (it re-ran both live endpoints); its one wording nit, applied: the
  scenarios endpoint lists link/public-visible rows only, so the claims say "publicly visible".

**Lint (00.3) (independent subagent): PASS**, no Final Gate trigger. Advisories applied: A1 EC Locked Values copied
verbatim; A2 external-state Assumes; A3 the 00.2 §7 citation; A4 the generated-module marker; A5 the revert proof as
commands and a non-vacuous pin; A6 the explicit determinism line.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.
