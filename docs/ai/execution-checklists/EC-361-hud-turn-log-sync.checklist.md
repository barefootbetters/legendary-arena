# EC-361 — HUD Turn Header Reads the Same Turn the Game Log Numbers By (Execution Checklist)

**Source:** docs/ai/work-packets/WP-331-hud-turn-log-sync.md
**Layer:** game-engine only (`ui/uiState.build.ts` projection + its test). **Lane:** Lightweight (single session; read-only projection).

## Before Starting
- [ ] On `main`, clean, synced; baseline `origin/main` @ `7644a04d`.
- [ ] Confirm `uiState.build.ts` `game.turn` reads `ctx.turn`, and `game.ts` stamps `G.logMeta.turn` only in the **play**-phase `onBegin` (the `end` phase is `end: {}`, no `onBegin`).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values
- `turn: gameState.logMeta?.turn ?? ctx.turn` (was `ctx.turn`). Reserved decision: **D-24117**.

## Guardrails
- Read-only projection — `game.turn` stays a `number`; UIState shape unchanged (no arena-client re-export/type impact).
- Keep the `?? ctx.turn` fallback (lobby/setup before the first play `onBegin`; observation harnesses that skip `onBegin`).
- Do NOT touch the WP-328 numbering, `logMeta` shape, `game.ts` phase/turn config, or the lobby turn-base offset (the log starting at `2` is out of scope).
- `logMeta` is hash-excluded (WP-328) — reading it adds no `finalStateHash`/persistence surface.

## Required `// why:` Comments
- The `game.turn` line (why: WP-331 — header must follow the log's turn source, `G.logMeta.turn`; at game-over `play → end` bumps `ctx.turn` one past the last play turn while the `end` phase never re-stamps `logMeta`; fall back to `ctx.turn` before the first play `onBegin`).

## Files to Produce
- `packages/game-engine/src/ui/uiState.build.ts` [`game.turn` projection].
- `packages/game-engine/src/ui/uiState.build.test.ts` [2 tests: logMeta-present game-over case + logMeta-absent fallback].
- Governance: `DECISIONS.md` (D-24117), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md` (+ `roadmap-counts --write`).

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` clean; `node --test --import tsx packages/game-engine/src/ui/*.test.ts` 0 fail; `pnpm -r build` clean.
- [ ] `git diff --name-only` = the allowlist; `roadmap-counts --check` 0.
- [ ] STATUS / DECISIONS (D-24117 Active) / WORK_INDEX (WP-331 `[x]`) / EC_INDEX (EC-361 Done) / mindmap node.
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (on a completed match the header matches the log's last line, no off-by-one).

## Common Failure Smells
- Dropping the `?? ctx.turn` fallback → lobby/setup + observation harnesses (which skip `onBegin`, so `logMeta` is unset) project `undefined` for the turn.
- Trying to "fix" the log starting at `2` in the same WP → that is the lobby-is-turn-1 offset, explicitly Out of Scope; folding it in re-pins fixtures and shifts every line.
- Editing `game.ts` to stamp `logMeta` in the `end` phase → wrong layer of fix; the display source is the projection, not the framework turn counter.
