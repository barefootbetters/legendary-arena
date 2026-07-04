# EC-336 — Setup-Contract Per-Field ext_id Validation (Henchman Id-Space Fix)

**WP:** WP-306 · **Layer:** Registry (+ mechanical App-layer fixture ripple)
**Baseline:** `origin/main` @ `71a6165c`

> Authoritative execution contract for WP-306. Subordinate to
> `ARCHITECTURE.md` and `.claude/rules/*.md`. If the WP and this EC conflict,
> the WP wins.

## Before Starting

- [ ] `origin/main` clean + fast-forward synced; baseline `71a6165c`.
- [ ] Deps landed: WP-091, WP-113/D-10014, D-24018, WP-304.
- [ ] Baselines observed: `pnpm --filter @legendary-arena/registry test` = **19 / 0**;
      `pnpm --filter engine-runner test` = **7 / 0**; registry-viewer suite green.
- [ ] Read WP-306 §Context + `matchSetup.validate.ts`
      (`buildKnownHenchmanGroupQualifiedIds`) + `villainDeck.setup.ts`
      (`listHenchmanGroupSlugsInSet`).

## Locked Values (verbatim — do not re-derive)

- **Henchman-id derivation:** `` `${abbr}/${slug}` `` from
  `setData.henchmen[].slug` (mirror the engine; re-derive locally, NO
  `@legendary-arena/game-engine` import).
- **Widened `CardRegistryReader`:** `listCards(): Array<{ extId: string;
  cardType: string }>`, `listSets(): Array<{ abbr: string }>`,
  `getSet(abbr: string): unknown | undefined`.
- **Corrected engine-runner henchman fixture value:** `core/sentinel`
  (a real core henchman; `core/hydra` is a villain and must not appear in a
  `henchmanGroupIds` slot).
- **Per-field entity kinds in messages:** "scheme", "mastermind",
  "villain group", "henchman group", "hero".

## Guardrails

1. Logic changes stay in `packages/registry/src/setupContract/**`; viewer +
   engine-runner edits are fixture/stub-shape only.
2. NO `@legendary-arena/game-engine` import registry-side (grep-gated).
3. NO `flattenSet` change (either copy) — henchman ids come from set data.
4. `for...of` only in the per-field set builders — no `.reduce()`.
5. Contract widen is authorized ONLY by D-24091; no other `.types.ts` edit.
6. NO `MatchSetupConfig` / 9-field composition change; NO `apps/server` touch.
7. Correct the false "never rejects an engine-valid id" comment — do not
   leave it asserting the old (untrue) global-set property.

## Required `// why:` Comments

- On the widened `CardRegistryReader`: cite D-24091 + D-10014 (henchman ids
  are not flat cards; derive from set data). Paraphrase so it does not
  self-trip the `game-engine` grep gate.
- On `buildKnownHenchmanGroupExtIds`: cite the engine mirror
  (`buildKnownHenchmanGroupQualifiedIds`) and the layer-boundary reason for
  local re-derivation.
- Replacing the old Step 2 comment: describe per-field isolation (accept
  exactly the layer-3 id space, D-24018) — not the retired global-set claim.

## Files to Produce (allowlist — must match WP §Files Expected to Change)

- `packages/registry/src/setupContract/setupContract.types.ts` (contract widen)
- `packages/registry/src/setupContract/setupContract.validate.ts` (per-field sets)
- `packages/registry/src/setupContract/setupContract.test.ts` (stub rebuild + 2 henchman cases)
- `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` (stub +listSets/getSet)
- `apps/registry-viewer/src/composables/useSetupFromUrl.test.ts` (stub +listSets/getSet)
- `apps/engine-runner/src/fixtures/scenario.valid.json` (henchman → core/sentinel)
- `apps/engine-runner/src/fixtures/scenario.invalid.json` (henchman → core/sentinel)
- `apps/engine-runner/src/runMatch.test.ts` (inline henchman → core/sentinel)
- Governance: `DECISIONS.md` (D-24091 → Active), `WORK_INDEX.md`, `EC_INDEX.md`, `STATUS.md`

## After Completing

- [ ] `pnpm --filter @legendary-arena/registry test` ≥ 21 / 0; `pnpm -r build` 0;
      `pnpm --filter engine-runner test` 7 / 0; registry-viewer suite green.
- [ ] `Select-String packages/registry/src/setupContract/*.ts -Pattern game-engine` → 0.
- [ ] `git diff --name-only` = allowlist only.
- [ ] D-24091 → Active; STATUS/WORK_INDEX/EC_INDEX updated.
- [ ] Two-commit topology: `EC-336:` impl + `SPEC:` govern-close.

## Common Failure Smells

- Registry suite still red after the validator change but before the stub
  rebuild — expected (8 existence tests); the stub rebuild is REQUIRED, not
  optional.
- Engine-runner "valid scenario" test red — you left `core/hydra` in a
  `henchmanGroupIds` slot; it is a villain.
- A viewer test throwing "getSet is not a function" — the narrow stub needs
  `listSets`/`getSet` added.
