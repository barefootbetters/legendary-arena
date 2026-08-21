# EC-616 — Visible Cue for the Recruit-as-Attack Conversion (Execution Checklist)

**Source:** docs/ai/work-packets/WP-581-recruit-as-attack-visible-cue.md
**Layer:** Cross-cutting — Game Engine (`packages/game-engine`) + App (`apps/arena-client`)

## Before Starting
- [ ] Preconditions A–D in WP-581 all pass (WP-580 flag exists on `G.turnEconomy`; `UITurnEconomyState` lacks it; economy is active-player-filtered; `EconomyBar` renders the Attack readout)
- [ ] Capture baseline `finalStateHash` + `PRE_WP080_HASH` (must stay byte-unchanged — display-only WP)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0

## Locked Values (do not re-derive)
- Field: `recruitSpendableAsAttack?: boolean` on `UITurnEconomyState` — a PROJECTION of the existing `G.turnEconomy.recruitSpendableAsAttack` (WP-580). NO new `G` field.
- Omit-when-absent: set in `buildUIState` and passed through the filter ONLY when `true`; absent otherwise (a non-conversion turn's economy is byte-identical to pre-WP-581).
- Audience: active-player-only (the economy branch `audience.playerId === activePlayerId`); `REDACTED_ECONOMY` (non-active + spectators) omits it.
- The cue lives in `apps/arena-client/src/components/play/EconomyBar.vue`, on the Attack line.

## Guardrails
- Display-only: do NOT change `getSpendableAttack`, `spendFightCost`, the `recruit-as-attack` handler/flag, or any WP-580 / D-24389 behaviour. Any file under `src/economy/`, `src/moves/`, or `src/hero/` in the diff is a STOP.
- NO new `G` field — the flag already exists; this projects it.
- Thread the new field through the active-player economy branch of `filterUIStateForAudience` (omit-when-absent, conditional assignment — never a `recruitSpendableAsAttack: undefined` literal), or it is silently dropped at the whitelist (the EC-206 failure). Add an audience test.
- EXTEND the `UIState` drift pin (`ui/uiState.types.drift.test.ts`) as a RUNTIME keyset assertion on a BUILT economy projection (build `gameState` with `turnEconomy.recruitSpendableAsAttack = true`, `buildUIState`, assert the projected economy keyset contains the field) — mirror the effectTraces built-projection pin already in that file. A hand-written-literal append pins only the name and does NOT catch a build/filter silent-drop of an omit-when-absent optional field (WP-562 / WP-575).
- Both hash oracles MUST stay byte-unchanged (a projection, not a `G` field). If either moves, STOP.
- The cue is ACCESSIBLE: not colour-only (icon/glyph + text), an `aria-label`/accessible name, no required animation (reduced-motion safe).
- No arena-client UIState fixture backfill (the field is optional/omit-when-absent — the WP-575 precedent).

## Required `// why:` Comments
- On the `buildUIState` economy population: why the field is omit-when-absent (byte-identical non-conversion turn).
- On the `filterUIStateForAudience` active-player pass-through: why active-player-only and conditional (whitelist-drop defense).
- On the `EconomyBar` cue: why the accessible name / non-colour-only treatment.

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — optional `recruitSpendableAsAttack` on `UITurnEconomyState`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate omit-when-absent from `G.turnEconomy`
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — active-player pass-through; `REDACTED_ECONOMY` omits it
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — audience test (present for active-when-set; absent for non-active / unset)
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **modified** — extend the drift pin
- `apps/arena-client/src/components/play/EconomyBar.vue` — **modified** — the accessible cue on the Attack line
- `apps/arena-client/src/components/play/EconomyBar.test.ts` — **modified** — cue renders when true / absent when false

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (audience test + drift pin green)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `finalStateHash` + `PRE_WP080_HASH` byte-unchanged; no `src/economy` / `src/moves` / `src/hero` file changed
- [ ] `pnpm -r --no-bail test` — no new failures
- [ ] Verify the field appears in the Play Diagnostics `uiStateSnapshot` economy for the active player
- [ ] Live-on-surface (D-24026): play God of Thunder on play.legendary-arena.com → the Economy bar shows the cue for the rest of the turn and clears next turn
- [ ] `docs/ai/STATUS.md` updated (names WP-581; D-24026 operator-pending)
- [ ] `docs/ai/DECISIONS.md` D-24390 landed Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-581 node `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- The cue never shows in a real match → the field reached `buildUIState` but not the filter (the whitelist drop); thread it through the active-player branch + the audience test.
- A hash oracle moved → a `G` field was added instead of projecting the existing one; revert to a UIState-only projection.
- The drift pin didn't catch the field → it was added as optional without extending the pin (WP-562 lesson).
