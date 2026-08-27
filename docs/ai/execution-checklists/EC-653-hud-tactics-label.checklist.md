# EC-653 — HUD "Strikes" → "Tactics" Label Fix (Execution Checklist)

**Source:** docs/ai/work-packets/WP-618-hud-tactics-label.md
**Layer:** `apps/arena-client` (one HUD label + testid)

## Before Starting
- [ ] `TopHudBar.vue` renders `Strikes: {{ mastermindProgressLabel() }}` with
      `data-testid="play-hud-strikes"`; `mastermindProgressLabel()` = tacticsDefeated/total.
- [ ] `MasterStrikePile.vue` shows the real "Master Strikes: N" (untouched).
- [ ] The only `play-hud-strikes` reference is one `TopHudBar.test.ts` assertion.
- [ ] Fresh worktree off `origin/main` (`ba70f538`); baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 2 code files: `TopHudBar.vue` + `TopHudBar.test.ts`. Any edit outside → STOP.
- [ ] `pnpm -r build` 0; arena-client `typecheck` 0; `test` green.

## Locked Values (do not re-derive)
- Label `Strikes:` → `Tactics:`; testid `play-hud-strikes` → `play-hud-tactics`.
- `mastermindProgressLabel()` is UNCHANGED (it already reads `mastermind.tacticsDefeated`).

## Guardrails
- **Label + testid only.** No change to the counter's data, to `MasterStrikePile.vue`,
  or to any projection/engine surface.
- **`// why:` comment** distinguishing tactics from master strikes.
- **`vue-tsc` gates.**

## Files to Produce
- `apps/arena-client/src/components/play/TopHudBar.vue` — **modified** — label + testid + JSDoc
- `apps/arena-client/src/components/play/TopHudBar.test.ts` — **modified** — the assertion

## After Completing
- [ ] `pnpm -r build` 0; arena-client `vue-tsc` 0 + suite green.
- [ ] `grep -rn "play-hud-strikes|Strikes:" apps/arena-client/src` → only `MasterStrikePile.vue`'s "Master Strikes:" remains.
- [ ] **Live-on-surface (D-24026):** the HUD reads "Tactics: N/M"; "Master Strikes: N" is separate + correct.
- [ ] `git diff --name-only` — the `EC-653:` implementation commit is only the 2 files.
- [ ] STATUS.md updated; DECISIONS.md D-24429 Active; WORK_INDEX WP-618 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- "Master Strikes: N" changed → you edited `MasterStrikePile.vue` (out of scope).
- Test still asserts `play-hud-strikes` → the assertion wasn't updated.
- A third file in the diff → scope breach.
