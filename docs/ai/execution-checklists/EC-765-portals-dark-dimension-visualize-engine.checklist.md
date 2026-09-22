# EC-765 — Portals Dark-Portal UIState projection (Execution Checklist)

**Source:** docs/ai/work-packets/WP-728-portals-dark-dimension-visualize-engine.md
**Layer:** Game Engine

## Before Starting
- [ ] WP-539 on `main`: `DARK_PORTAL_COUNT` (types.ts) + `function portals` (schemeTwistResolvers.ts) present
- [ ] `resolveMastermindFightCost` + `darkPortalVillainBonus` present in `economy.resolve.ts`
- [ ] `buildUIState` / `filterUIStateForAudience` / `interface UISchemeState` present; the `scheme` object is rebuilt field-by-field in the filter
- [ ] `packages/game-engine/src/board/citySpaceNames.ts` exists (5 spaces, Sewers(0)…Bridge(4))
- [ ] Target file set = the `Files to Produce` list below; any file outside it is a FAIL — surface as a blocker
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

## Locked Values (do not re-derive)
- Scheme id: `core/portals-to-the-dark-dimension`
- Counter key: `DARK_PORTAL_COUNT` (existing — do NOT add a new counter)
- `onMastermind` ⇔ Portals scheme AND `DARK_PORTAL_COUNT >= 1`
- City index `K ∈ 0..4` portal'd ⇔ Portals scheme AND `DARK_PORTAL_COUNT >= 6 - K` (twist 2 → index 4 … twist 6 → index 0)
- `DARK_PORTAL_ATTACK_BONUS = 1`
- Field: `UISchemeState.darkPortals?: UIDarkPortalState` = `{ onMastermind, mastermindAttackBonus, citySpaceIndices, citySpaceAttackBonus }`
- `mastermindAttackBonus = onMastermind ? DARK_PORTAL_ATTACK_BONUS : 0`; `citySpaceAttackBonus = DARK_PORTAL_ATTACK_BONUS`

## Guardrails
- **Pure projection — NO new hashed `G` field, NO persistence/snapshot change, NO re-pin.** `finalStateHash` MUST be unchanged (the descriptor is not part of `G`).
- The helper mutates nothing; no `ctx.random`, no `Math.random()`, no I/O.
- **Board-Visible Field Rule (5 steps):** types → build → filter pass-through (PUBLIC shared-board, no owner redaction) → audience-filter survival test → Play Diagnostics `uiStateSnapshot`. A field in build but not the filter is dropped (EC-206 mode) — FAIL.
- `citySpaceIndices` built by an explicit `for` loop over `0..4` — never `.reduce()`. The filter copies it into a fresh array (no aliasing).
- `darkPortals` is conditional-spread: present under Portals, OMITTED for every non-Portals scheme (the `gameText?` precedent — satisfies `exactOptionalPropertyTypes`).
- Bonus fields read the constant / combat helpers — never a hardcoded literal at the projection site.
- Display-only / off-ranking (NG-1); the +1 attack values are WP-539's, unchanged (factoring `1` into a named constant is value-identical).

## Required `// why:` Comments
- `darkPortalLocations` derivation: the `6 - K` fill predicate is the same one `darkPortalVillainBonus` reads (single source, combat/UI cannot disagree)
- `DARK_PORTAL_ATTACK_BONUS`: the named constant replaces the literal `1` so combat and the projection share one value
- `uiState.filter.ts` `darkPortals` pass-through: public shared-board (portal locations are public), rebuilt to avoid the EC-206 drop
- `uiState.build.ts` conditional spread: omitted for non-Portals schemes

## Files to Produce
- `packages/game-engine/src/economy/economy.resolve.ts` — **modified** — `darkPortalLocations` helper + `DARK_PORTAL_ATTACK_BONUS`; route the two buffs through the constant
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIDarkPortalState` + `UISchemeState.darkPortals?`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate `scheme.darkPortals`
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass `darkPortals` through the `scheme` rebuild
- `packages/game-engine/src/economy/economy.resolve.test.ts` — **modified** — helper + constant-value cases
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — populate/omit cases
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — `darkPortals` survives the audience filter
- `docs/ai/DECISIONS.md` — **modified** — land D-24549
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — governance close
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-728 `📝` → `✅`

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm -r build && pnpm -r --no-bail test` exit 0; `finalStateHash` unchanged
- [ ] `darkPortals` visible in the Play Diagnostics `uiStateSnapshot` for a Portals match (Board-Visible Field Rule step 5)
- [ ] `git diff --name-only` shows no `data/cards` / `data/metadata` / `apps/` change (governance docs only)
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only" (surface = `none — infrastructure`)
- [ ] `docs/ai/DECISIONS.md` D-24549 landed; WORK_INDEX + EC_INDEX flipped to Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`; `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- A blank/absent portal on the board later (WP-727) usually means the filter pass-through was skipped — the EC-206 drop-at-filter mode.
- A `finalStateHash` change means a new `G` field was added — STOP; the descriptor must be a pure projection, never stored in `G`.
- The build test passing but a non-Portals scheme carrying `darkPortals` means the conditional spread was missed.
