# EC-834 — Always Leads fidelity: Henchman-group leads + lead corrections (WP-797)

**WP:** WP-797 · **Reserves:** D-24667 · **Layer:** card-data pipeline + Registry + App (registry-viewer) + gauntlet
tooling / data / seed PAR

Authoritative execution contract for WP-797. Subordinate to ARCHITECTURE.md and `.claude/rules/*`. If this EC and
WP-797 disagree, WP-797 wins. Compliance is binary.

## Before Starting

- [ ] Target file set = WP-797 §Files Expected to Change exactly; touching any other file is STOP.
- [ ] The WP-797 / EC-834 / D-24667 reservation is on `origin/main` (#2629) and `pnpm ledger:numbers:check` exits 0.
- [ ] `pnpm -r build` exits 0; record per-package `pnpm -r --no-bail test` before-counts and `pnpm par:seed:test`.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.
- [ ] `pnpm cards:check`, `pnpm gauntlet:configs:check`, `pnpm gauntlet:loadouts:check` exit 0 on the untouched tree.
- [ ] `core.json` dr-doom still reads `alwaysLeads: ["masters-of-evil"]` and `gauntlet-configs.json` dr-doom still has
      `anchorVillainGroup: "core/masters-of-evil"`. If either differs, STOP and report.

## Locked Values

- `alwaysLeads` = Villain group slugs ONLY. New `alwaysLeadsHenchmen: string[]` on every mastermind; new
  `ledBy: string[]` on every Henchman group. Symmetric, in-set. Key position is NOT contractual (construction emits
  them after `alwaysLeads` / `slug`; the outlier reset and post-patch normaliser may append them last).
- `leads.json`: exactly the 13 edits in WP-797 §Locked Contract Values (dr-doom → `henchmen: ["doombot-legion"]`;
  new dims row `henchmen: ["spider-slayer"]`; Hela/Malekith and Thanos/Ebony Maw un-swapped; Mephisto `underworld`;
  Alchemax Executives `alchemax-enforcers`; msp1 Loki and amwp Kang drop their second group; Omega Red and Ego →
  `[]` + `"_anyVillainGroup": true`; `_note3` drops dims).
- `co2e.json` hand edits exactly as WP-797 locks (Doctor Doom → `alwaysLeadsHenchmen: ["doombot-legion"]`; Doctor
  Octopus → `["sinister-spider-foes"]`; the three `ledBy` fixes). Nothing else.
- Registry `MastermindSchema.alwaysLeadsHenchmen = z.array(z.string()).default([])`; viewer
  `.optional().default([])`.
- `resolveAlwaysLeadsGroupIds(mastermindExtId, cards, ledCardType: "villain" | "henchman")` — one function.
  `requiredHenchmanGroupIds`, `missingRequiredHenchmanGroupIds`; `readinessIssueCount` adds the missing Henchman
  count; `setMastermind` auto-adds required Henchman groups.
- Validators: `scripts/validate.ts` new warning code `ALWAYS_LEADS_HENCHMEN_UNRESOLVED` (Henchman half);
  `ALWAYS_LEADS_UNRESOLVED` now checks villain slugs only. `validate-r2.mjs` makes the same split. Both stay warnings.
- `toggleCardInLoadout` (`loadoutCardActions.ts`): Henchman removal is a no-op for a
  `requiredHenchmanGroupIds` member (the D-24054 villain guard mirrored).
- Generator: Henchman anchors from `alwaysLeadsHenchmen` in the base fill AND `buildSchemeOverrides`;
  `GenerationError` on a lead slug of the wrong type or absent from the set.
- `GauntletMastermindConfig.anchorVillainGroup?: string | undefined` and `anchorHenchmanGroup?: string | undefined`
  (`exactOptionalPropertyTypes` — `?: string` alone fails `tsc`); exactly one required.
- Dr. Doom: `anchorHenchmanGroup: "core/doombot-legion"`; null-`variety` pools + base pool `[brotherhood,
  enemies-of-asgard, hydra, masters-of-evil]`; skrulls legs `[skrulls, enemies-of-asgard, hydra, masters-of-evil]`
  (all `core/`); Henchman pools unchanged; `slicing.note` updated.
- Expected menu changes: the 16 masterminds listed in WP-797 (core/dr-doom also its NZPB override). STOP if the
  generated diff differs.
- Seed PAR: 128 scenarios; exactly 24 Dr. Doom artifacts + 24 scoring configs swapped; `index.json` modified.
- Themes: annihilation-conquest → `["universal-church-of-truth"]`; house-of-m → `["mandarins-rings"]`.
- Mandated test edits ONLY: `gauntletConfigs.test.ts` :74–83 and `scripts/generate-seed-par.test.ts` :31
  (→ `midtown-bank-robbery::dr-doom::brotherhood`). `Tests-changed:` trailer names both.

## Guardrails

1. Never hand-edit the 40 generated `data/cards` sets — run the five stages in `03-DATA-PIPELINE.md` §1 order and commit
   the output as written (Henchman `vAttack`/`vp` key-order churn is expected). Only `co2e.json` is hand-edited.
2. The semantic data diff vs `HEAD` touches only `alwaysLeads`, `alwaysLeadsHenchmen`, `ledBy`. Anything else: STOP.
   Check: the lead-stripped HEAD diff command in WP-797 §Verification Steps prints `OK: only lead fields differ from HEAD.`
3. `apply-card-counts.mjs` RESETS lead arrays before applying `leads.json`; without it 2099/amwp/wpnx keep stale leads.
4. `applyLeadsRelationships` normalises `ledBy` / `alwaysLeadsHenchmen` itself (a patch overlay rebuilds Henchman
   groups after construction).
5. Generated modules and PAR artifacts change only through `pnpm gauntlet:configs` / `gauntlet:loadouts` /
   `par:seed:generate`. Any PAR or scoring-config change outside the 24 Dr. Doom pairs: STOP.
6. No engine, server or arena-client file; no `G` / `MatchSetupConfig` field.
7. Any failing existing test beyond the two mandated edits is STOP-and-report.
8. Sentinel `finalStateHash` / `PRE_WP080_HASH` unchanged. Never re-pin.

## Required Comments (`// why:`)

- `apply-card-counts.mjs` reset: the committed outlier base carries the previous leads; appending would keep them.
- `applyLeadsRelationships` normalisation: patch overlays rebuild Henchman groups after construction.
- Registry `.default([])`: R2 metadata uploaded before the regen lacks the field.
- Generator lead-type guard: a Henchman slug in `alwaysLeads` once put `co2e/doombot-legion` in a villain slot.
- `resolveAlwaysLeadsGroupIds` `ledCardType`: the rulebook lets a mastermind lead a Villain or a Henchman group.
- `gauntletConfigs.ts` exactly-one anchor: Dr. Doom's printed lead is a Henchman group (D-24667).
- `loadoutCardActions.ts` Henchman removal no-op: the D-24054 guard extended to Henchman leads (D-24667 §5); without it
  the Cards-tab button bypasses the lock.

## Files to Produce

Exactly the WP-797 §Files Expected to Change allowlist, including new `packages/registry/src/alwaysLeads.data.test.ts`.

## After Completing

- Revert proofs 6/6: converter Henchman wiring, outlier reset, generator Henchman anchor, viewer required-Henchman
  readiness, card-action Henchman guard, exactly-one-anchor check. Run the outlier-reset proof against the baseline
  bases (restore `data/cards/{2099,amwp,wpnx}.json` from `28bc08a9` first; `cards:check` cannot see it).
- `pnpm -r build`; `pnpm -r --no-bail test` + `pnpm par:seed:test` 0 failures (before/after counts);
  `pnpm --filter registry-viewer typecheck` 0; `cards:check` and both gauntlet `:check` OK; `registry:validate`,
  `themes:check-slugs:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:villains:check`, viewer
  `lint`, `viewer:build` and `wiki:lint` 0; `sim:coverage --check`, `ledger:heroes:check`,
  `sim:runtime-observed:check`, `cards:count-markers:check`, `workindex:rows:check`, `workindex:executed:check` 0;
  `registry:validate` shows no `ALWAYS_LEADS_UNRESOLVED` / `ALWAYS_LEADS_HENCHMEN_UNRESOLVED`; replay fixtures
  byte-identical.
- At merge (before or with the viewer deploy): `rclone copy` `data/cards` → `r2:legendary-images/metadata` (never `sync`) and
  `node scripts/upload-themes-to-r2.mjs`.
- D-24026 live verify: cards (Dr. Doom locks Doombot Legion, not Masters of Evil; Magus; Hela; House of M theme ready)
  and play (core Dr. Doom 2p gauntlet leg: Brotherhood + Enemies of Asgard + Doombot Legion). matchId in STATUS.md.
- STATUS.md; DECISIONS.md D-24667 → Active (six points); WORK_INDEX `[x]`; EC_INDEX → Done; mindmap 📝 → ✅;
  `pnpm roadmap:counts:write` + `roadmap:counts:check` 0.

## Common Failure Smells

- `TypeError … reading 'includes'` in `applyLeadsRelationships`: a Henchman group without `ledBy` (Guardrail 4).
- 2099 Alchemax Executives still leads False Aesir after regen: the outlier reset is missing.
- `tsc` "Type 'undefined' is not assignable to type 'string'" in `gauntletConfigs.ts`: `?: string` without
  `| undefined`.
- A required Henchman group disappears via the Cards-tab button: the `loadoutCardActions.ts` guard is missing.
- `gauntletConfigs.test.ts` equivalence fails for dr-doom: pool order not the generator fill order.
- `par:seed:test` "expected a PAR resolution for …::masters-of-evil": the mandated :31 edit was skipped.
- A builder draft with core Dr. Doom at 1p shows 2 Henchman groups: the user's earlier pick stays beside the
  auto-added Doombot Legion (expected, same as villains) — not a defect.
