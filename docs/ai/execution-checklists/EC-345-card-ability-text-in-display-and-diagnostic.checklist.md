# EC-345 — Card Ability Text in `UICardDisplay` + Diagnostic Embedding (Execution Checklist)

**Source:** docs/ai/work-packets/WP-315-card-ability-text-in-display-and-diagnostic.md
**Layer:** Game Engine (produce) + arena-client diagnostics (consume the snapshot) — boundary-respecting

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `7ade7532` recorded.
- [ ] WP-314 / D-24100 present: `apps/arena-client/src/diagnostics/effectProvenance.ts` has the
      injected `resolveCardText` seam + `recentlyPlayedCards[].abilityText`.
- [ ] `buildCardDisplayData §1b` hero card-instance branches present (physicalCards + fallback).
- [ ] `resolveDisplay` returns `{ ...entry, heroClass, team }` (spread carries new fields).
- [ ] Fresh worktree → `pnpm -r build` before tests; registry consumers read `dist` (build engine
      after editing it, before running arena-client suite).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL (except the conditional
      filter fold-inline below + the move-registration N/A).

## Locked Values (do not re-derive)
- New field: `UICardDisplay.abilityText?: string` — **optional**; absent when the card has no
  `abilities` (NEVER an empty string).
- Join: `card.abilities.join('\n')` — printed lines joined by a single newline, **marker
  annotations preserved verbatim** (`[keyword:…]`, `[hc:…]` are NOT stripped).
- Scope: hero card instances (`§1b`) ONLY. Villain / mastermind / henchman / scheme / bystander /
  master-strike display entries do NOT get `abilityText`.
- Reserved decision: **D-24101**.

## Guardrails
- Additive + read-side only: NO gameplay / move / phase / zone-op / RNG change; `finalStateHash`
  unchanged (setup-time static registry data already in `G`).
- Layer boundary: NO `@legendary-arena/registry` import in any engine or client file; the client
  reads `abilityText` ONLY structurally from the (audience-filtered) snapshot — NO engine import
  in `diagnostics/*` (EC-260 boundary holds).
- Fail-soft: absent/empty/malformed `abilities` → field omitted, never a throw; `buildEffectProvenance`
  never throws on a missing map entry (degrades to `null`).
- **Conditional fold-inline (WP-313 precedent):** IF `uiState.filter.ts` rebuilds a `UICardDisplay`
  for any viewer-visible zone, preserve `abilityText` there and record it in D-24101. Expected: NO
  change (filter redacts hidden cards; it does not reconstruct visible-card display).
- No `diagnostics.ts` / `DiagnosticExportButton.vue` / on-screen play-component edit.

## Required `// why:` Comments
- The `abilities.join('\n')` marker-preservation (why raw markers are kept: diagnostic reads the
  printed text-plus-annotation to check effect-vs-text).
- The omit-when-empty degrade (why absent, not `''` — preserves the optional-field contract).
- The snapshot-derived resolver (why the client reads text from the snapshot it already holds, not
  a new source — boundary purity + D-24100 Option B).

## Files to Produce
- Engine: `src/ui/uiState.types.ts` [+`abilityText?`] · `src/setup/buildCardDisplayData.ts`
  [populate §1b both branches + extend local `DisplayDataHeroCardEntry`] ·
  `src/ui/uiState.types.drift.test.ts` [fixture] · `src/setup/buildCardDisplayData.test.ts` ·
  `src/ui/uiState.build.test.ts` [projection-carry].
- Client: `src/diagnostics/effectProvenance.ts` [snapshot-derived map] · `effectProvenance.test.ts`.
- Governance: `docs/ai/DECISIONS.md` (D-24101), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine test` + `build`, arena-client `test` + `typecheck`,
      `pnpm -r build` — all green/0.
- [ ] `git diff --name-only` matches the allowlist (+ any recorded fold-inline only).
- [ ] `Select-String abilityText uiState.types.ts` present; drift fixture updated.
- [ ] STATUS / DECISIONS (D-24101 Active) / WORK_INDEX (WP-315 [x]) / EC_INDEX (EC-345 Done).
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 live-verify operator-pending
      (play a hero card → export → `abilityText` shows the printed text).

## Common Failure Smells
- `abilityText: ''` on a card with no `abilities` → omit-when-empty not honored.
- Markers stripped from the text → the raw-marker preservation lock ignored.
- Engine edited but arena-client suite run without rebuilding `dist` → false "still green".
- `abilityText` missing from the projected zone → `resolveDisplay` spread not carrying it (or a
  filter reconstruction dropped it — the conditional fold-inline).
- Any `packages/registry` import, or a `diagnostics/*` engine import → boundary breach.
