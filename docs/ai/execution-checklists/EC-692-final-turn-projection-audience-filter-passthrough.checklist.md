# EC-692 — Final-Turn Projection: Audience-Filter Pass-Through (Execution Checklist)

**Source:** docs/ai/work-packets/WP-655-final-turn-projection-audience-filter-passthrough.md
**Layer:** Game Engine

## Before Starting
- [ ] **WP-367 + WP-368 + WP-654 landed** — `buildUIState` populates `UIState.finalTurn` (omits it once `gameOver` is set); the client (`ArenaHud` + `PlayViewport`) already consumes `snapshot.finalTurn`.
- [ ] **Confirm the gap against HEAD** — `grep -n finalTurn packages/game-engine/src/ui/uiState.filter.ts` returns NOTHING (the field is dropped at the whitelist). If it is already present, STOP — the packet is a no-op.
- [ ] `filterUIStateForAudience` passes optional public top-level fields through with `if (uiState.X !== undefined) { result.X = ... }` (`gameOver`, `matchCardImageUrls` precedent).
- [ ] Exact scope lock (any edit outside = FAIL): `packages/game-engine/src/ui/uiState.filter.ts`, `packages/game-engine/src/ui/uiState.filter.test.ts`, plus governance (NUMBER-LEDGER / STATUS / DECISIONS / WORK_INDEX / EC_INDEX / ROADMAP-MINDMAP).
- [ ] `pnpm --filter @legendary-arena/game-engine build` + suite exit 0 (record the baseline count).

## Locked Values (do not re-derive)
- `UIFinalTurnState` = `{ reason: string; heroDeckRemaining: number; villainDeckRemaining: number }` — all PUBLIC.
- Pass-through pattern: `if (uiState.finalTurn !== undefined) { result.finalTurn = { ...uiState.finalTurn }; }` (fresh copy; never a `finalTurn: undefined` literal).

## Guardrails
- Projection-only: do NOT touch `buildUIState`, any move/phase/rule, scoring, or `G`. `finalTurn` is PUBLIC — no redaction, unchanged for every audience.
- No `finalStateHash` / `PRE_WP080_HASH` re-pin — a projection is not part of `G`. Verify the sentinel replay suite is unmoved; if a hash test fails, STOP (something is wrong — a filter change must not move the hash).
- No new npm dependency. `node:test` + `node:assert` only in the test (no boardgame.io).

## Required `// why:` Comments
- The `finalTurn` pass-through: why it is public and must survive the whitelist (the D-12803 / EC-206 / D-24466 Board-Visible Field Rule — WP-367 populated it in build but not here, so it was dropped and the WP-368/WP-654 banner never reached the client).

## Files to Produce
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — the `finalTurn` pass-through.
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — survives-for-every-audience / fresh-copy / absent-stays-absent.
- `docs/ai/{STATUS.md,DECISIONS.md (D-24466 Active),work-packets/WORK_INDEX.md,execution-checklists/EC_INDEX.md}`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` — governance.

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; the engine suite passes (+3 filter tests); the sentinel `finalStateHash` is unchanged.
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) exits 0.
- [ ] `git diff --name-only` = exactly the scope lock; `uiState.build.ts` NOT present.
- [ ] **Live-on-surface (D-24026):** on `play.legendary-arena.com`, a real deck-exhaustion match shows the banner during the final turn (disappears at game end); screenshot captured. This is the packet that makes it observable.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24466 Active; `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write` (then `roadmap:counts:check` exits 0).

## Common Failure Smells
- A `finalStateHash` test fails → the change touched `G`, not just the projection; STOP and re-scope (a filter change must never move the hash).
- The new filter tests pass but the banner still doesn't render live → check the deployed build actually includes this commit (gitSha), and that the match reached a real final turn (a shared deck hit 0 before any win/loss).
- `git diff` shows `uiState.build.ts` → out of scope; the build already populates the field, this packet only passes it through the filter.
