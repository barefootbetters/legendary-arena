# EC-005A — Match Setup Contracts (Execution Checklist)

**Source:** docs/ai/work-packets/WP-005A-match-setup-contracts.md
**Layer:** Game Engine / Contracts

**Execution Authority:**
This EC is the authoritative execution checklist for WP-005A.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-005A.

---

## Before Starting

- [ ] WP-002 complete: `LegendaryGameState` and `LegendaryGame` exist in `packages/game-engine/src/`
- [ ] WP-003 complete: `@legendary-arena/registry` builds and exports `CardRegistry`
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-005A.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `MatchSetupConfig` — exactly 9 fields, character-for-character:
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`

- `MatchSetupError`: `{ field: string; message: string }` — NOT `MoveError`

- `ValidateMatchSetupResult`:
  `{ ok: true; value: MatchSetupConfig } | { ok: false; errors: MatchSetupError[] }`

- WP-008A `MoveError` (`{ code, message, path }`) must NOT be used or referenced here

---

## Guardrails

- `validateMatchSetup` never throws — returns structured result
- `validateMatchSetup` checks BOTH shape AND registry ext_id existence
- Error messages must be full sentences naming the failing field
- No randomness in this packet — contracts only
- No `MoveError` or `MoveResult` references in any matchSetup file
- No `boardgame.io` import in test file — uses inline mock registry
- No `.reduce()` — use `for...of` if iterating

---

## Required `// why:` Comments

- `MatchSetupConfig`: why it uses `ext_id` string references rather than numeric database IDs
- `src/types.ts`: reconciliation of `MatchConfiguration` (WP-002) with `MatchSetupConfig`

---

## Files to Produce

- `packages/game-engine/src/matchSetup.types.ts` — **new** — `MatchSetupConfig`, `MatchSetupError`, `ValidateMatchSetupResult`
- `packages/game-engine/src/matchSetup.validate.ts` — **new** — `validateMatchSetup(input, registry)`
- `packages/game-engine/src/types.ts` — **modified** — reconcile `MatchConfiguration` with `MatchSetupConfig`
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `packages/game-engine/src/matchSetup.contracts.test.ts` — **new** — 4 tests (`node:test`)

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (4 passing)
- [ ] No `throw` in `matchSetup.validate.ts`
- [ ] No `MoveError`/`MoveResult` in any matchSetup file
- [ ] `docs/ai/STATUS.md` updated — what contracts are now available
- [ ] `docs/ai/DECISIONS.md` updated — `MatchSetupConfig` vs `MatchConfiguration`; why `{ field, message }` not `MoveError`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-005A checked off with date
