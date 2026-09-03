# EC-671 — Guest Co-op Endgame VP Recap (Client) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-636-guest-coop-endgame-recap.md
**Layer:** App (`apps/arena-client`)

## Before Starting

- [x] Confirm `gameOver.scores` carries per-player VP at runtime (villain/henchman/bystander/tactic/wound/total + winner).
- [x] Read `EndgameSummary.vue` — the `scores` block + the account-holder `workedCalc.perPlayer` block.
- [x] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0 (baseline).

## Locked Values (do not re-derive)

- Data source is **`gameOver.scores`** (already on the wire) — NOT `competitiveScore`; **no server change**.
- Render the recap **only when `!competitiveScore`** (guest / non-scored); otherwise the account-holder block duplicates it.
- **§23(b):** individual VP only — no winner/loser between teammates; do NOT surface `gameOver.scores.winner`.
- The sign-in CTA and the competitive block are **unchanged**.
- Per-player display id is 1-indexed (`Player {Number(playerId)+1}`) to match the rest of the UI.

## Guardrails

- arena-client only — no server/contract/`G` change.
- SFC keeps `defineComponent({ setup })` (D-6512).
- Compact stacked rows (not a wide table) so the narrow endgame panel doesn't overflow.

## Required `// why:` Comments

- On the recap gated by `!competitiveScore` (why: the per-player VP is on gameOver.scores so a guest has it; the account-holder block already covers the scored case; avoid duplication).
- On the §23(b) co-op framing (no winner/loser).

## Files to Produce

- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** — recap + styles.
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified** — guest recap, account-holder no-recap, §23(b).

## After Completing

- [x] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0
- [ ] D-24026 live-verify (a guest sees the VP recap)
- [x] `docs/ai/STATUS.md` updated
- [x] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [x] `docs/05-ROADMAP-MINDMAP.md` node `✅`, then `pnpm roadmap:counts:write`

## Common Failure Smells (Optional)

- The recap shows for an account holder too → gate on `!competitiveScore` was dropped (duplicates the WP-621 block).
- A "winner" label appears → §23(b) violation; show VP only.
- The narrow panel scrolls sideways → use stacked rows, not a wide table.
