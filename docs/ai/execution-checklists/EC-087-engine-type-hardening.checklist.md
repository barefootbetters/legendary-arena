# EC-087 — Engine Type Hardening: `PlayerId` + Setup-Only `readonly` (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-087-engine-type-hardening.md`
**Layer:** Game Engine

> **Status: DONE 2026-04-23** (Commit A `73aeada`; governance close `0b7fe22`; A1 amendment `d5880d2`).
>
> **Scope deviation at execution (post-close amendment, 2026-04-23):** the three `readonly` modifiers on `hookRegistry`, `schemeSetupInstructions`, and `heroAbilityHooks` listed in `## Locked Values` below were **reverted mid-session** after applying them surfaced seven TS errors in four production-code files outside the 4-file allowlist (`game.ts`, `hero/heroConditions.evaluate.ts`, `hero/heroEffects.execute.ts`, `villainDeck/villainDeck.reveal.ts`). Per session prompt §AI Agent Warning #1 and generic-ripple Hard Stop, the tightening was deferred. The `PlayerId` alias, the three `Record<PlayerId, …>` swaps, and the factory-time `hookRegistry` construction all landed cleanly per `## Locked Values`. See **D-8702** for the deferral rationale.
>
> **Superseding decision (A1 amendment):** **D-8705** replaces the compile-time `readonly` path with a test-time drift-detection scan at [`packages/game-engine/src/rules/ruleRuntime.setupOnlyFields.drift.test.ts`](../../../packages/game-engine/src/rules/ruleRuntime.setupOnlyFields.drift.test.ts). Same three fields, same six mutation operations, zero consumer ripple. **D-8706** authorizes the narrow `node:fs` carve-out that makes the drift scan possible in engine test files. The `readonly` modifiers will not be applied in any future WP.
>
> The body below preserves the original executor contract as the authoring record. Read `D-8701..D-8706` for the authoritative post-execution contract.
>
> ---
>
> **(Original ready-to-execute status — preserved for historical record):** READY TO EXECUTE (A0 pre-flight bundle landed 2026-04-23). All four gating items resolved: (a) WP-049 merged to `main` at `956306c` (also WP-050 `0bf9020`, WP-051 `372bf71`); (b) WP-087 registered in `WORK_INDEX.md` under Gameplay; (c) 00.3 lint gate PASS recorded in [preflight-wp087-engine-type-hardening.md](../invocations/preflight-wp087-engine-type-hardening.md); (d) EC-087 registered in `EC_INDEX.md` as `Draft`.

## Before Starting

- [ ] WP-049 merged to `main`; WP-087 registered in `WORK_INDEX.md`; 00.3 lint gate passed for WP-087
- [ ] No parallel session is editing `types.ts`, `state/zones.types.ts`, or `persistence/persistence.types.ts`
- [ ] Baseline captured: `pnpm -r build` exits 0; `pnpm test` exits 0 with passing count noted for later comparison
- [ ] `PlayerId` / `PlayerKey` does not already exist anywhere in `packages/**` (re-verify — WP-049 may have introduced one)

## Locked Values (do not re-derive)

- Alias declaration (verbatim): `export type PlayerId = string;` — non-branded
- Three `LegendaryGameState` fields receiving `readonly`: `hookRegistry`, `schemeSetupInstructions`, `heroAbilityHooks`
- Three `Record` keys changing `string` → `PlayerId`:
  - `LegendaryGameState.playerZones` in `packages/game-engine/src/types.ts`
  - `GameStateShape.playerZones` in `packages/game-engine/src/state/zones.types.ts`
  - `MatchSnapshot.playerNames` in `packages/game-engine/src/persistence/persistence.types.ts`
- Sole non-setup mutation site being fixed: `packages/game-engine/src/rules/ruleRuntime.ordering.test.ts:56`

## Guardrails

- Do NOT brand `PlayerId` (no `string & { __brand }`, no `` `${number}` ``)
- Do NOT add `readonly` to any other `LegendaryGameState` field (`messages`, `counters`, `playerZones`, `piles`, `cardStats`, `cardKeywords`, `villainDeckCardTypes`, `attachedBystanders` are out of scope)
- Do NOT modify `MatchSetupConfig`, `MatchSetupError`, or `ValidateMatchSetupResult` in `matchSetup.types.ts`
- Do NOT touch UI state types, move handlers, phase hooks, endgame logic, setup logic, or any effect-application code
- Do NOT split, reorder, or reorganize `types.ts` barrel re-exports
- Do NOT run `eslint --fix`, `prettier --write`, or any blanket formatter / code-generation pass
- No files outside `## Files to Produce` are modified

## Required `// why:` Comments

- `packages/game-engine/src/types.ts` at the `PlayerId` declaration — cite the boardgame.io `"0" | "1" | …` player-ID string convention and state that the alias is intentionally non-branded

## Files to Produce

- `packages/game-engine/src/types.ts` — **modified** — add `PlayerId` with `// why:`; apply `readonly` to the three arrays; swap one `Record` key
- `packages/game-engine/src/state/zones.types.ts` — **modified** — import `PlayerId`; swap `playerZones` key
- `packages/game-engine/src/persistence/persistence.types.ts` — **modified** — import `PlayerId`; swap `playerNames` key
- `packages/game-engine/src/rules/ruleRuntime.ordering.test.ts` — **modified** — move `hookRegistry` construction into the factory
- `docs/ai/DECISIONS.md` — **modified** — append D-NNNN covering (1) non-branded rationale, (2) `readonly` only on three arrays, (3) non-applicability to `MatchSetupConfig` and siblings, (4) `heroDeckIds` communal-deck semantics
- `docs/ai/STATUS.md` — **modified** — one-line note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-087
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — mark EC-087 Done

## After Completing

- [ ] `pnpm -r build` exits 0 with zero new TS errors or warnings
- [ ] `pnpm test` exits 0 with test count identical to the Before Starting baseline
- [ ] `pnpm --filter game-engine exec tsc --noEmit` exits 0
- [ ] Grep invariant passes with zero matches: `Select-String -Path "packages/game-engine/src/**/*.ts" -Pattern "(G|gameState)\.(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" -Exclude "*.test.ts"` — pattern requires `G.` / `gameState.` qualifier per PS-1 resolution (otherwise `buildInitialGameState.ts:178 const schemeSetupInstructions = ...` false-positives)
- [ ] `DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, and `EC_INDEX.md` all updated per `## Files to Produce`

## Common Failure Smells

- TS error in a file not listed under `## Files to Produce` → generic ripple; fix belongs in a separate WP
- Test count changed from the Before Starting baseline → a test was deleted, duplicated, or scope-crept in
- `eslint --fix` / `prettier --write` diff present → formatter-pass guardrail was violated
- New `import` in a file outside the three type files → `PlayerId` leaked beyond its three intended swap sites
