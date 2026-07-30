# EC-493 — Collapse Approved Gauntlet Loadouts to One (Execution Checklist)

**Source:** docs/ai/work-packets/WP-458-collapse-approved-loadouts-to-one.md
**Layer:** Registry / tooling (+ comment-only server touch)

## Before Starting
- [ ] On `origin/main` @ `4e0f3261`, worktree clean.
- [ ] `scripts/generate-gauntlet-loadouts.mjs:61` `VARIANTS_PER_MASTERMIND = 3`;
      variant 0 = `pickByRotation(..., 0)` (canonical). Consumers iterate
      `variants` / approved configs generically (no hard-coded 3).
- [ ] `pnpm gauntlet:loadouts:check`, `pnpm -r build`, registry + server suites
      green at baseline.
- [ ] **Exact target file set (any file outside = FAIL, STOP):** the six files
      under `## Files to Produce`.

## Locked Values (do not re-derive)
- `VARIANTS_PER_MASTERMIND = 1` — the single lever. Variant 0 is retained
  (byte-identical to the current variant 0); variants 1 and 2 are dropped.
- The generated file is **machine output** — regenerate with `pnpm gauntlet:loadouts`,
  NEVER hand-edit; `pnpm gauntlet:loadouts:check` must pass (regen == committed).
- `GauntletLoadoutMenu.variants` stays `readonly GauntletLoadoutVariant[]`, now
  length 1, `variantIndex 0`.
- Ranked-only: casual free selection untouched; `matchesApprovedLoadout` /
  qualification logic untouched (one approved config, not three); no migration.

## Guardrails
- **Regenerate, do not hand-edit** the generated file.
- **No qualification-logic / server-behavior change** — the only `apps/server`
  edit is **comment-only** (correct "three configurations" prose to one).
- **No consumer-surface code change** (legends board / cards builder pack import /
  badge) — they iterate/default to variant 0 and adapt to a one-element menu.
- **No `ScenarioKey` / `henchman_key` shape change; no PAR work.**
- **Remove** the now-meaningless "three variants are distinct" test; update the
  "exactly three" test to "exactly one"; KEEP the composition shape/size tests.

## Required `// why:` Comments
- The generator `VARIANTS_PER_MASTERMIND = 1` comment: why one canonical config is
  now the ranked configuration (D-24278 supersedes D-24199's menu-of-three; heroes
  are the ranked variable; casual stays free; competitive_scores empty = zero cost).

## Files to Produce
- `scripts/generate-gauntlet-loadouts.mjs` — **modified** — constant 3→1 + the
  four "three variants" comments (`:26`, `:58-60`, `:122`, `:199`).
- `packages/registry/src/gauntletLoadouts.generated.ts` — **regenerated** — 110 × 1.
- `packages/registry/src/gauntletLoadouts.test.ts` — **modified** — one-variant
  assertions; remove the distinctness test; keep shape/size tests.
- `packages/registry/src/gauntletLoadouts.ts` — **modified (comment-only)**.
- `apps/server/src/legends/gauntlet.logic.ts` — **modified (comment-only)**.
- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified (comment-only)**
  — the `selectApprovedLoadout` "three configurations" JSDoc (`:330-333`); the
  code (returns `approvedForCount[0]`) is unchanged.
- `docs/ai/DECISIONS.md` — **D-24278** (Drafted → Active at execution close).

> **Shared-branch note (execution):** the drafting branch is shared with WP-459
> (reveal layout). At WP-458 **execution**, only these seven files (+ the DoD
> governance edits) may appear in the WP-458 commit — WP-459's
> `GauntletIndexPanel.vue` layout change must not bleed in.

## After Completing
- [ ] `pnpm gauntlet:loadouts && pnpm gauntlet:loadouts:check` exit 0 (110 menus × 1).
- [ ] `pnpm -r build` + `pnpm --filter @legendary-arena/registry test` +
      `pnpm --filter @legendary-arena/server test` exit 0.
- [ ] Variant-0 spot-check unchanged (e.g. `core/magneto` 2p = Brotherhood,
      Enemies-of-Asgard / Doombot Legion).
- [ ] No comment says "three configurations."
- [ ] **D-24026 live-verify (operator-pending):** deployed legends Magneto "Show
      details" lists ONE config per count; challenge link pins it.
- [ ] STATUS updated; DECISIONS D-24278 Active + D-24199 menu-size-superseded note;
      WORK_INDEX row checked; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-493 Done.
- [ ] No file outside the six-file list modified.

## Common Failure Smells
- `gauntlet:loadouts:check` fails → the generated file was hand-edited or not
  regenerated after the constant change; run `pnpm gauntlet:loadouts`.
- A registry/server test still expects 3 → update the assertion (one variant).
- Variant 0's composition changed → only variants 1/2 should drop; variant 0 is
  byte-identical.
- A server logic file (not just a comment) appears in the diff → out of scope; the
  server touch is comment-only.
