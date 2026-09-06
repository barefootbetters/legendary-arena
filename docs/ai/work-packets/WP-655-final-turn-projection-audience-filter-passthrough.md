# WP-655 — Final-Turn Projection: Audience-Filter Pass-Through (Game Engine)

**Status:** Ready
**Primary Layer:** Game Engine
**Dependencies:** WP-367 (`UIState.finalTurn` projection), WP-368 + WP-654 (the client banner)
**User-Visible Surface:** play.legendary-arena.com

---

## Session Context

WP-367 added `UIState.finalTurn?: UIFinalTurnState` and populated it in `buildUIState`. WP-368 built the `FinalTurnBanner` component; WP-654 mounted it on the live `PlayViewport` surface. But in a real deck-exhaustion match (Loki / Midtown Bank Robbery, 2026-09-06, gitSha `035433a`) the banner still did not appear. Root cause: `buildUIState` is only stage one of the engine→client projection; stage two is `filterUIStateForAudience` (`ui/uiState.filter.ts`), a **whitelist** that rebuilds UIState field-by-field. `finalTurn` was never added to that whitelist, so it was silently dropped at the audience boundary and never reached any client. `finalTurn` is optional, so TypeScript did not flag the omission — the exact D-12803 / EC-206 **Board-Visible Field Rule** failure mode. (WP-368/WP-654 tests passed because they feed fixtures directly, bypassing the filter; the game-log "final turn" line printed because it is a `G.messages` entry, independent of the projection.)

---

## Goal

After this session, `UIState.finalTurn` survives `filterUIStateForAudience` for every audience, so the WP-367 projection reaches the client and the WP-368 / WP-654 final-turn banner renders during a real deck-exhaustion final turn. Projection-only change — no game state, determinism, or scoring is touched.

---

## User-Visible Impact

Before: the final-turn banner never appeared in a real match — the client never received `finalTurn` (dropped at the audience filter). After: a real match that exhausts a shared Hero/Villain deck shows the "⚠ Final turn" banner on the play surface, then clears at game end. This completes the deck-exhaustion warning arc (WP-367 engine mechanic → WP-368 component → WP-654 live mount → WP-655 the data actually reaching the client).

---

## Assumes

- WP-367 merged: `buildUIState` (`ui/uiState.build.ts`) populates `finalTurn` and omits it once `gameOver` is set.
- `UIState.finalTurn?: UIFinalTurnState` = `{ reason, heroDeckRemaining, villainDeckRemaining }` (all public shared-board data).
- `filterUIStateForAudience` (`ui/uiState.filter.ts`) is the sole engine→client audience projection boundary and rebuilds UIState field-by-field (a whitelist); optional top-level public fields pass through with the `if (uiState.X !== undefined) { result.X = ... }` pattern (`gameOver`, `matchCardImageUrls`).
- WP-368 + WP-654 merged: the client consumes `snapshot.finalTurn` in `ArenaHud` and `PlayViewport`.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `.claude/rules/architecture.md §UIState Projection Integrity` — the two-stage pipeline and the Board-Visible Field Rule five-step contract (step 3: pass through the filter).
- `docs/ai/DECISIONS.md` — D-12803 (audience-filter redaction matrix), D-24466 (this fix); scan for related.
- `packages/game-engine/src/ui/uiState.filter.ts` — the whitelist; the `gameOver` / `matchCardImageUrls` pass-through precedent.
- `packages/game-engine/src/ui/uiState.build.ts` — where `finalTurn` is populated (read-only; do not change).
- `packages/game-engine/src/ui/uiState.filter.test.ts` — the audience-filter contract tests to extend.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- ESM only, Node v22+; `node:` prefix on Node built-in imports.
- Test files use `.test.ts`; `node:test` + `node:assert` only; no boardgame.io imports in the filter or its tests.
- Full file contents for every modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- Projection-only: no `G`/`ctx` write, no move/phase/rule change, no scoring change. `buildUIState` is not modified.
- `finalTurn` is PUBLIC — pass through unredacted for every audience (fresh object copy to avoid aliasing; conditional assignment, never a `finalTurn: undefined` literal, for `exactOptionalPropertyTypes`).
- No `finalStateHash` / `PRE_WP080_HASH` re-pin — verify the sentinel replay suite is unmoved (a projection is not part of `G`).
- No new npm dependency.

**Session protocol:**
- If `finalTurn` is already present in the filter (someone fixed it first), STOP — the packet is a no-op; report it.

**Locked contract values:**
- `UIFinalTurnState` fields: `reason` (string), `heroDeckRemaining` (number), `villainDeckRemaining` (number).

---

## Scope (In)

- `packages/game-engine/src/ui/uiState.filter.ts` — add the `finalTurn` pass-through (public top-level optional field; fresh copy; conditional assignment), beside the `gameOver` pass-through.
- `packages/game-engine/src/ui/uiState.filter.test.ts` — assert `finalTurn` survives for every audience (player + spectator), is a fresh copy (not aliased), and stays absent when not in the final turn.

---

## Out of Scope

- No change to `buildUIState` or the `finalTurn` shape (WP-367 owns those).
- No client change (WP-368 / WP-654 already consume `snapshot.finalTurn`).
- No redaction of `finalTurn` (it is public shared-board data) and no other UIState field audit.
- No engine mechanic, scoring, replay, or `G` change.

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass `finalTurn` through the audience whitelist
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — audience-survival + fresh-copy + absent-stays-absent coverage

No other files may be modified.

---

## Vision Alignment

**Vision clauses touched:** §17 (accessibility surface), §10 (play surface); §3/§4 (projection integrity — the engine→client boundary). NG-1..7 not crossed.

**Conflict assertion:** No conflict: a read-only projection pass-through of public shared-board data.

**Non-Goal proximity check:** None of NG-1..7 are crossed — informational warning UI plumbing.

**Determinism preservation:** The change is projection-only — it touches no RNG, replay, scoring, or `G`; `finalStateHash` / `PRE_WP080_HASH` are unaffected (verified: the sentinel replay suite is unmoved).

## Funding Surface Gate

§20 N/A — an engine UIState projection pass-through; no funding navigation, registry-viewer/profile funding affordance, tournament funding channel, or "donate/support" copy.

## API Catalog

§21 N/A — no HTTP endpoint added, modified, or removed; no `apps/server/src/**` library function touched (game-engine projection only).

---

## Acceptance Criteria

- [ ] `filterUIStateForAudience` passes `finalTurn` through as a public top-level field (fresh copy; conditional assignment)
- [ ] `finalTurn` survives the filter for player and spectator audiences (asserted)
- [ ] The filtered `finalTurn` is a fresh object, not aliased to the input UIState (asserted)
- [ ] An absent `finalTurn` stays absent after the filter (asserted)
- [ ] `buildUIState` is unchanged (`git diff` shows no edit to `uiState.build.ts`)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0; the engine suite passes
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] No `finalStateHash` / `PRE_WP080_HASH` re-pin (sentinel replay suite unmoved)
- [ ] No files outside `## Files Expected to Change` were modified (`git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build the engine
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — engine suite (incl. the new filter tests + the sentinel replay hash)
pnpm --filter @legendary-arena/game-engine test
# Expected: all passing, 0 failing; finalStateHash unchanged

# Step 3 — whole-repo build + the client type gate
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: both exit 0

# Step 4 — confirm buildUIState was not modified + scope
git diff --name-only
# Expected: only the two ui/uiState.filter files (+ governance)
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** surface is `play.legendary-arena.com` — the banner is confirmed **live in a real match** that exhausts a deck (banner appears; disappears at game end), with a screenshot. NOT satisfied by tests + merge alone. (This is the packet that finally makes it observable.)
- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` + suite green; `pnpm -r build` 0; arena-client typecheck 0
- [ ] No `finalStateHash` re-pin
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — `finalTurn` now reaches the client; the banner renders live
- [ ] `docs/ai/DECISIONS.md` updated — D-24466 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-655 checked off with today's date
