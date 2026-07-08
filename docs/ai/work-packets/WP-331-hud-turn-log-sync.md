# WP-331 — HUD Turn Header Reads the Same Turn the Game Log Numbers By

**User-Visible Surface:** play.legendary-arena.com (the HUD turn header + the Game Log panel).
At game-over the HUD header showed `Turn 20` while the log's last line read `19.2.13` — an
off-by-one the operator reported. The two must agree.

## Goal

Make the HUD turn header (`UIState.game.turn`) resolve from `G.logMeta.turn` (the value the
game log numbers its lines by, stamped in the play-phase `onBegin`) instead of live `ctx.turn`,
falling back to `ctx.turn` when `logMeta` is unset. One projection line in
`uiState.build.ts` + two unit tests.

## Assumes

- WP-328 (D-24114) added the hash-excluded `G.logMeta = { turn, actionInStep }`, stamped from
  `ctx.turn` in the **play**-phase `onBegin` (`game.ts`), and numbers every live log line by
  `logMeta.turn`.
- `buildUIState` projects `game.turn` from `ctx.turn` (`uiState.build.ts:426`). Baseline
  `origin/main` @ `7644a04d`.

## Context (Read First)

- `packages/game-engine/src/game.ts` — the `play` phase, its `turn.onBegin` (stamps
  `logMeta`), `play.next: 'end'`, and `end: {}` (no `onBegin`).
- `packages/game-engine/src/ui/uiState.build.ts` — the `game` projection block (~424).
- `docs/ai/DECISIONS.md` — D-24114 (the numbering this aligns to).

## Root Cause

The match ends by transitioning the `play` phase to the `end` phase (`play.next: 'end'`). In
boardgame.io a **phase change starts a fresh framework turn**, so `ctx.turn` bumps one past the
last real play turn (19 → 20) on entering `end`. The `end` phase is `end: {}` — no `onBegin` —
so `G.logMeta.turn` is never re-stamped and stays frozen at the last play turn (19), which is
what the log's last line shows. The HUD header read live `ctx.turn` (20); the log read
`logMeta.turn` (19). They diverge **only at game-over** — during live play both resolve to the
same `ctx.turn` for the active turn.

## Scope (In)

- **`uiState.build.ts`** — `game.turn` changes from `ctx.turn` to
  `gameState.logMeta?.turn ?? ctx.turn`, with a `// why:` comment.
- **`uiState.build.test.ts`** — two tests: (a) with `logMeta` set + a higher `ctx.turn`
  (the game-over case), `game.turn` follows `logMeta.turn`; (b) with `logMeta` absent,
  `game.turn` falls back to `ctx.turn`.

## Out of Scope

- **The lobby turn-base offset** — the log opens at `2.2.1` because the lobby is boardgame.io
  turn 1, so the first *play* turn is `ctx.turn === 2`. Rebasing so "play turn 1 = 1" is a
  separate, heavier change (re-pins fixtures, shifts every log line) and is **not** part of
  this fix. This WP only makes the header and log *agree*.
- **The `end` phase / phase-transition turn mechanics** — untouched; boardgame.io owns turn
  advancement. We fix the display source, not the framework's turn counter.
- **The log numbering itself (WP-328) or `logMeta` shape** — unchanged; this is read-only.

## Files Expected to Change

| File | Action |
|------|--------|
| `packages/game-engine/src/ui/uiState.build.ts` | **Modified** — `game.turn = gameState.logMeta?.turn ?? ctx.turn` |
| `packages/game-engine/src/ui/uiState.build.test.ts` | **Modified** — 2 tests (logMeta-present + fallback) |
| `docs/ai/DECISIONS.md` | **Modified** — D-24117 |
| `docs/ai/STATUS.md` | **Modified** — record the change |
| `docs/ai/work-packets/WORK_INDEX.md` | **Modified** — WP-331 row |
| `docs/ai/execution-checklists/EC_INDEX.md` | **Modified** — EC-361 row |
| `docs/05-ROADMAP-MINDMAP.md` | **Modified** — WP-331 node + `roadmap-counts --write` |

No other files may be modified.

## Non-Negotiable Constraints

**Engine-wide:** full file contents; ESM (explicit `.js` on relative imports); human-style code
per `00.6-code-style.md`; determinism preserved.

**Packet-specific:**
- Read-only projection change — `game.turn` is still a `number`; the UIState shape is
  unchanged, so no arena-client type/re-export impact.
- `logMeta` is already hash-excluded (D-24081-style, via WP-328) — no `finalStateHash`,
  persistence, or determinism surface. This reads it; it does not write or persist it.
- Keep the `?? ctx.turn` fallback so states before the first play `onBegin` (lobby/setup) and
  observation harnesses that skip `onBegin` still project a turn.

**Session protocol:** stop and ask on any ambiguity.

**Locked contract values:** `turn: gameState.logMeta?.turn ?? ctx.turn`. Reserved decision:
**D-24117**.

## Vision Alignment

- **Vision clauses touched:** §14 (observability / a readable, self-consistent feed), §11
  (read-only projection). **Conflict:** `No conflict.` **Determinism:** N/A (read-only
  display; `logMeta` hash-excluded).

## Acceptance Criteria

1. `uiState.build.ts` projects `game.turn` as `gameState.logMeta?.turn ?? ctx.turn` with a
   `// why:` comment.
2. New test: `logMeta.turn = 19` + `ctx.turn = 20` (phase `end`) → `game.turn === 19`.
3. New test: `logMeta` absent → `game.turn === ctx.turn`.
4. Full `game-engine` suite green; `pnpm -r build` clean.
5. No files outside `## Files Expected to Change` modified.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine build            # tsc clean
node --test --import tsx packages/game-engine/src/ui/*.test.ts   # 0 fail
pnpm -r build                                               # succeeds
git diff --name-only                                        # only ## Files Expected to Change
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `game-engine` suite green; `pnpm -r build` clean
- [ ] **User-visible verification (D-24026, surface = play.legendary-arena.com):** after merge
      + deploy, on a completed match the HUD turn header matches the log's last line (e.g.
      header `Turn 19` with the log ending `19.2.13`) — no off-by-one; STATUS.md records the
      evidence until then.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24117 Active; `WORK_INDEX.md` WP-331 `[x]`;
      `EC_INDEX.md` EC-361 Done; roadmap-mindmap node (`--check` green)
- [ ] No files outside `## Files Expected to Change` modified

## Lint Gate Self-Review (00.3)

21/21 resolved. §1 sections present + ≥2 Out-of-Scope; §2 constraints + 00.6; §5 single engine
file + its test + governance; §14 four+ binary criteria; §15 DoD + User-Visible Surface + live
D-24026 item; §16 read-only projection, no contract; §17 Vision §14/§11 no conflict; §12/§13
engine build + `ui/*` tests; §21 N/A (no HTTP/`apps/server` endpoint or catalog function).
§4/§6/§7/§8/§9/§10/§11/§18/§19/§20 N/A or PASS (engine projection, no deps/env/auth/funding/
forbidden-token/new-state-field — `logMeta` already exists).

## Pre-Flight Verdict (01.4)

**READY / lightweight lane.** Single engine projection line + two unit tests, additive and
read-only. Reads an existing hash-excluded field (`logMeta.turn`) so the HUD header tracks the
same turn the log numbers by; corrects a game-over-only off-by-one caused by the `play → end`
phase-transition turn bump. No contract/determinism/persistence/type-shape surface.

## Copilot Check Verdict (01.7)

**PASS.** No layer crossing (engine-internal projection), no monetization/identity/RNG, no
contract change, no determinism/hash surface (`logMeta` hash-excluded). Operator-directed
observability fix. No BLOCK modes.
