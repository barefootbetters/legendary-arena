# EC-872 — Core-first gauntlet fill (Execution Checklist)

**Source:** docs/ai/work-packets/WP-834-core-first-gauntlet-fill.md
**Layer:** Shared tooling (gauntlet menu generator) + Registry (its generated module and one test file)

Authoritative execution contract for WP-834. Subordinate to ARCHITECTURE.md and `.claude/rules/*`. If this EC and WP-834
disagree, WP-834 wins. Compliance is binary.

## Before Starting
- [ ] Target file set = WP-834 §Files Expected to Change exactly; any other file is STOP.
- [ ] The WP-834 / EC-872 / D-24767 reservation is on `origin/main` (#3008); `pnpm ledger:numbers:check` exits 0.
- [ ] On `origin/main` (`git show origin/main:scripts/generate-gauntlet-loadouts.mjs`), the generator still sorts the
      combined pool (`fallbackVillainIds.sort()` / `fallbackHenchmenIds.sort()` after the `CORE_FALLBACK_SET_ABBRS`
      loop) and `CORE_FALLBACK_SET_ABBRS` is `['core', 'co2e']`. If either differs, STOP. (The drafting scaffold may sit
      uncommitted in the exec worktree; it may be kept or re-made, and the `313 313` numstat is against HEAD either way.)
- [ ] `GET https://api.legendary-arena.com/api/leaderboards/scenarios` still returns `{"scenarioKeys":[]}` (public rows
      only; the structural `par_not_published` reject covers private ones). If any key names a non-Core mastermind,
      STOP: a stored score would be re-keyed.
- [ ] `pnpm -r build` 0; record per-package `pnpm -r --no-bail test` counts (registry 310 at baseline); both gauntlet
      `:check` scripts 0; `pnpm par:seed:test` passes.

## Locked Values (do not re-derive)
- **Pool order:** `CORE_FALLBACK_SET_ABBRS = ['core', 'co2e']` (unchanged) is the pool order; the pool is the
  concatenation of `buildGroupIds('core', …)` then `buildGroupIds('co2e', …)` for villains and for henchmen. No combined
  sort.
- Generator header step 3: "then from the Core Set, then Core 2E (the D-24199 core-fallback rule, ordered by D-24767)".
- Expected regeneration (STOP if different): 110 menus; 51 changed (48 base, 13 `schemeOverrides`); numstat `313 313`;
  no `core` / `co2e` menu changes.
- **WWII override after** (both ca75 masterminds): 1p villains `ca75/masters-of-evil-wwii`, `ca75/zolas-creations`; 2p
  adds `core/brotherhood`; 5p adds `core/brotherhood`, `core/enemies-of-asgard`, `core/hydra`; henchmen
  `core/doombot-legion` (+ `core/hand-ninjas` at 4–5p).
- The pin also asserts it checked more than 0 non-co2e menus and saw at least one `core/` id; it may not filter or mock
  the menu list.
- New pin in `gauntletLoadouts.test.ts` (a top-level `test()`), "out-of-set slots fill from Core before Core 2E": no menu outside `co2e` has a
  `co2e/` villain or henchmen id in its base variant or any `schemeOverrides` composition at 1–5p.
- The only mandated existing-test edit: `gauntletConfigs.test.ts` "names the generated Change the Outcome of WWII villains
  at 1p and 5p" → the 5p ids above. Commit trailer `Tests-changed:` names it.
- Locked counts after: registry 310 → 311; every other package unchanged; 0 fail.

## Guardrails
1. Only the pool order changes; anchors, in-set order, rotation and every generator guard (lead anchor, override
   superset + duplicate slug, fill count) are untouched.
2. The generated module changes only through `pnpm gauntlet:loadouts`.
3. `data/gauntlet-configs.json`, `gauntletConfigs.generated.ts`, seed PAR, PAR profiles and replay fixtures are
   byte-identical.
4. No engine, server, legends-board, arena-client or registry-viewer file changes.
5. Existing tests change only as mandated; any other failure is STOP-and-report.

## Required `// why:` Comments
- Where the combined sort was removed: D-24767, set order kept, and why (`co2e/` sorted first; most co2e groups are
  unmarked while their Core versions are marked).
- The new pin (output-derived, because the generator runs `main()` on import).
- The mandated WWII-ids edit (D-24767 changed the fallback order).

## Files to Produce
Exactly the WP-834 §Files Expected to Change allowlist (governance: STATUS, DECISIONS, WORK_INDEX, EC_INDEX,
`docs/05-ROADMAP-MINDMAP.md`); the generated module only through its script.

## After Completing
- [ ] Revert proof: re-add the two `.sort()` lines, `pnpm gauntlet:loadouts`, `pnpm --filter @legendary-arena/registry
      test` (the new pin and the WWII-ids test fail), then restore the generator and run `pnpm gauntlet:loadouts` again.
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail with the locked counts; both gauntlet `:check` 0;
      `pnpm par:seed:test` passes; `git status --porcelain` ⊆ the allowlist (revert `lagn-v1.json` CRLF churn).
- [ ] D-24767 Active (four points); STATUS updated; WORK_INDEX `[x]` with date; EC_INDEX Done; mindmap `✅`;
      `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`,
      `workindex:executed:check` 0. Two commits: `EC-872:` then `SPEC:`.
- [ ] Live-verify (D-24026) after deploy: the published legends index shows the ca75 WWII leg at 2p with
      `core/brotherhood` and `core/doombot-legion` and no `co2e/` group outside co2e gauntlets; a 2p match from that leg
      loadout starts. Recorded in STATUS.

## Common Failure Smells
- A Core or Core 2E menu changed → the in-set or anchor order was disturbed, not only the pool.
- The numstat is not `313 313` → the generator was edited beyond the sort, or the card data moved since the draft.
- A `GenerationError` on duplicate slugs → a composition now mixes same-slug Core and Core 2E henchmen; STOP.
