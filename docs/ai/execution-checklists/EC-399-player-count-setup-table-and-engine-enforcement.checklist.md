# EC-399 — WP-370: Player-Count Setup Table + Engine Enforcement + Villain-Deck Bystander Fix

**Pairs with:** [WP-370](../work-packets/WP-370-player-count-setup-table-and-engine-enforcement.md) · **Lane:** standard two-session · **Baseline:** `origin/main @ a0260362` (after the SPEC draft #724) · **Reserves → Active:** D-24165, D-24166.

## Before Starting
- Confirm baseline green: registry `130/0`, engine `1919/0`; `pnpm -r build` 0. (Captured 2026-07-13.)
- Read the layer boundary: `game-engine` imports Node built-ins only. The table lives in `registry` and reaches the engine via the registry object at setup (structural typing on `CardRegistryReader`) — **never** an import.

## Locked Values
- `PLAYER_COUNT_SETUP` (rows 1–5), `{ villainGroupCount, henchmenGroupCount, villainDeckBystanderCount, heroCount }`:
  `1·1·1·3` / `2·1·2·5` / `3·1·8·5` / `3·2·8·5` / `4·2·12·6`. These numbers appear **only** in `packages/registry/src/playerCountSetup.ts`.
- `validateMatchSetup(input, registry, numPlayers?)` — `numPlayers` is **optional**; the composition gate no-ops when it is absent, the registry has no `playerCountSetup`, or the count is out of range.
- Villain-deck bystander fallback: scheme value → table `villainDeckBystanderCount` → `ctx.numPlayers` (last-ditch). Scheme override wins.

## Guardrails
- No `@legendary-arena/registry` import in any `game-engine` source or test (inline the table fixture in engine tests).
- The supply-pile `bystandersCount` floor (D-24032) is a **different** concept — unchanged.
- Composition mismatches are BLOCK errors (push `MatchSetupError`), not warnings.
- Determinism: villain-deck change is behavior-affecting at 3p+ only; the 2p sentinel stays byte-identical (no re-pin). Verify via the engine suite (`replay.execute.test.ts`) + `pnpm sim:coverage --check`.
- Additive on the registry side: `setupContract.*` schema/validate **byte-unchanged**; the coupling is a new pure helper (`checkPlayerCountComposition`), not a parse-path tightening.

## Required Comments
- `// why: WP-370 / D-24165` on the table module, the `CardRegistryReader.playerCountSetup` field, the composition gate, and the impl `playerCountSetup` properties.
- `// why: WP-370 / D-24166` on the villain-deck bystander fallback (extend the existing supply-pile-distinction comment, do not remove it).

## Files to Produce (allowlist — 11 code/test)
- **new** `packages/registry/src/playerCountSetup.ts` (table + `getPlayerCountSetup` + `checkPlayerCountComposition`)
- **new** `packages/registry/src/playerCountSetup.test.ts`
- `packages/registry/src/types/index.ts` (CardRegistry `playerCountSetup`)
- `packages/registry/src/impl/localRegistry.ts` + `impl/httpRegistry.ts` (carry the table)
- `packages/registry/src/index.ts` (export table + helpers + types)
- `packages/game-engine/src/matchSetup.validate.ts` (reader field + `numPlayers` param + gate)
- `packages/game-engine/src/matchSetup.contracts.test.ts` (gate tests)
- `packages/game-engine/src/game.ts` (thread `numPlayers` into both call sites)
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` (bystander fallback)
- `packages/game-engine/src/villainDeck/villainDeck.setup.test.ts` (table-path bystander tests)

> **Execution refinement vs WP §Scope (scope-neutral):** the WP guessed `setupContract.schema.ts`/`validate.ts`; the registry-side coupling ships instead as a pure exported helper in `playerCountSetup.ts` (keeps the contract files byte-unchanged, zero parse-path tightening). Added `types/index.ts` + the two impls to carry the table on the `CardRegistry` object per D-24165. Same layer, additive.

## After Completing
- Registry `137/0` (+7), engine `1927/0` (+8); `pnpm sim:coverage --check` OK; `pnpm -r build` 0.
- Flip D-24165 + D-24166 → Active; WORK_INDEX WP-370 → Done; STATUS.md; EC_INDEX EC-399 row; mindmap node + `pnpm roadmap:counts --write`.

## Common Failure Smells
- A test that turns green only because the mock registry lacks `playerCountSetup` — assert the table path explicitly (provide the fixture).
- Re-typing 1/2/8/8/12 anywhere but the table module (drift). `git grep` before commit.
- Conflating the villain-deck bystander count with `bystandersCount` (supply pile).
