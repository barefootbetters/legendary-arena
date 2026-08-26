# EC-646 — Hide Deck Probability Panel at Game-Over (Execution Checklist)

**Source:** docs/ai/work-packets/WP-611-hide-panel-gameover.md
**Layer:** `apps/arena-client` (one computed + a test)

## Before Starting
- [ ] WP-607 on `origin/main`: `DeckProbabilityPanel.vue` `hasData` computed gates
      the root `<section>` `v-if`; the component reads `snapshot` from `useUiStateStore`.
- [ ] `UIState.gameOver?: UIGameOverState` is projected + barrel-exported;
      `EndgameActions.vue` reads `gameOver !== undefined` as match-over.
- [ ] Fresh worktree off `origin/main` (`3c2d133f`); baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 2 code files: `DeckProbabilityPanel.vue` + `.test.ts`.
      Any edit outside → STOP. (STATUS/DECISIONS/WORK_INDEX/mindmap are the
      separate SPEC govern-close commit.)
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; `test` green.

## Locked Values (do not re-derive)
- Match-over signal = `snapshot.value?.gameOver !== undefined`.
- `hasData` = `!isMatchOver.value && (villainSummary !== null || ownDeckComposition !== undefined)`.

## Guardrails
- **One computed + the `hasData` guard.** No template, style, projection, filter,
  or engine change.
- **Client-only.** `gameOver` is already projected + barrel-exported — no engine /
  `G` / `ctx` / audience-filter edit.
- **A jsdom test is REQUIRED** (this is jsdom-observable): would-render data +
  `gameOver` present → the panel root is absent. Existing mid-match tests unchanged.
- **`// why:` comment** on the guard (a live-play aid hides at game-over; the
  endgame report card owns that surface).

## Files to Produce
- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — **modified** — `isMatchOver` guard on `hasData`
- `apps/arena-client/src/components/play/DeckProbabilityPanel.test.ts` — **modified** — `gameOver` override + hide test

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` (vue-tsc) 0;
      arena-client suite green (+1 test).
- [ ] **Live-on-surface (D-24026):** on deployed `play.legendary-arena.com`, the
      "Deck odds" panel is gone on the game-over screen and present mid-match.
- [ ] `git diff --name-only` — the `EC-646:` implementation commit is only the 2 code files.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24422 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-611 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node `📝` → `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.

## Common Failure Smells (Optional)
- Panel still shows at game-over → `hasData` not guarded by `isMatchOver`, or the
  wrong signal (not `snapshot.gameOver`).
- Panel gone mid-match → the guard is inverted or reads a mid-match-truthy field.
- A third file in the diff → scope breach.
