# EC-658 — Danger Meter Names the Converted Enemy (Execution Checklist)

**Source:** docs/ai/work-packets/WP-623-converted-escape-labels.md
**Layer:** Game Engine (`schemeLossProgress.ts`) + Client (`menaceDisplay.ts`)

## Before Starting
- [ ] `ConvertedVillainOrigin = 'killbot' | 'skrull'`; both appear in
      `escaped-converted-count` loss configs (Killbots, Secret Invasion).
- [ ] Fresh worktree off `origin/main`; baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 4 code files: `schemeLossProgress.ts`,
      `schemeLossProgress.test.ts`, `menaceDisplay.ts`, `menaceDisplay.test.ts`. Any edit outside → STOP.
- [ ] `pnpm -r build` 0; engine + arena-client suites green.

## Locked Values (do not re-derive)
- `killbot` → `escaped-killbot` → "Killbots"; `skrull` → `escaped-skrull` → "Skrulls".
- `SchemeLossKind` union and `SCHEME_LOSS_KINDS` array change in lockstep; the
  runtime `deepStrictEqual` drift pin is updated to match.

## Guardrails
- **Label fidelity only.** No change to the loss threshold, the counted quantity
  (`countEscapedByConvertedOrigin`), or the projection pipeline — only the kind +
  noun. No `G`-field, no hash surface, no migration.
- **Origin-exhaustive.** `escapedConvertedKind(origin)` is an explicit `switch` so
  a future `ConvertedVillainOrigin` fails to compile, not silently mislabels.
- **`// why:`** on the origin→kind mapping (subset count; WP-612 collision precedent).
- Other five kinds' labels unchanged.

## Files to Produce
- `packages/game-engine/src/rules/schemeLossProgress.ts` — **modified** — union + array + `escapedConvertedKind` + resolver + import
- `packages/game-engine/src/rules/schemeLossProgress.test.ts` — **modified** — killbot→escaped-killbot, skrull→escaped-skrull, drift array
- `apps/arena-client/src/vfx/menaceDisplay.ts` — **modified** — Killbots/Skrulls nouns
- `apps/arena-client/src/vfx/menaceDisplay.test.ts` — **modified** — label assertions

## After Completing
- [ ] `pnpm -r build` 0; engine suite green + arena-client suite green + `vue-tsc` green.
- [ ] **Live-on-surface (D-24026):** a Killbots / Secret Invasion match's danger meter
      reads "Killbots N/5" / "Skrulls N/5".
- [ ] `git diff --name-only` — the `EC-658:` implementation commit is only the 4 files.
- [ ] STATUS.md updated; DECISIONS.md D-24434 Active; WORK_INDEX WP-623 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- The drift test fails → the union and `SCHEME_LOSS_KINDS` array are out of lockstep.
- `Record<SchemeLossKind, string>` fails to compile → `menaceDisplay.ts` still has
  `escaped-converted` or is missing one of the two new nouns.
- A future origin compiles without a kind → `escapedConvertedKind` isn't an
  exhaustive switch (it must be, so the compiler catches the gap).
- The loss count changed → you touched `countEscapedByConvertedOrigin` (out of scope; label only).
