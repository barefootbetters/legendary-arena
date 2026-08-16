# EC-590 — `getLegalMoves` Discard-to-Play Payability

**Work Packet:** WP-555
**Layer:** Game Engine (`packages/game-engine/src/simulation`)
**Status:** Pending
**Locks:** D-24364

> The WP is the authoritative design document. Where this EC and WP-555
> conflict, the WP wins. This EC extracts the drift-prone values.

---

## Before Starting

- [ ] `git fetch origin main`, branch from a clean tree, record the SHA.
- [ ] Fresh worktree? `pnpm install` first — otherwise the suite fails with
      `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` and a "node_modules missing" warning
      that reads like a real failure.
- [ ] `pnpm -r build` **before** any test run (stale `dist` = false red). Record
      the pre-change `pnpm --filter @legendary-arena/game-engine test` count;
      **2656 / 0** at draft. AC-4 uses it as a floor.
- [ ] Read `coreMoves.impl.ts:340-350` — the precondition you are mirroring.
      Note the `+ 1` and why it exists before writing any code.

## Locked Values

- Enumeration site: `ai.legalMoves.ts:495-497` — the
  `for (const cardId of zones.hand)` loop.
- Condition, matching the reducer exactly:
  `cost > 0 && zones.hand.length < cost + 1` → `continue`.
- Cost source: `getDiscardToPlayCost(gameState, cardId)` from
  `../moves/resolveDiscardToPlay.js` — **already imported** in that file's
  import block; add the name to the existing braces, do not add a new import
  statement.
- **The `+ 1` is load-bearing.** The played card is still in hand at enumeration
  time, exactly as at the move's precondition, so paying the cost requires that
  many *other* cards. `hand.length < cost` is an off-by-one that leaves the
  wedge in place for the single-card case — the only case that actually occurs.
- Repro board (for a manual sanity check, not a test): the `core` hero-deck set
  on the `runtime-observed-hollows.mjs` sentinel core; Cyclops `optic-blast` and
  `determination` both carry `[keyword:discard-to-play:1]`.

## Guardrails

1. **Do NOT edit `packages/game-engine/src/moves/coreMoves.impl.ts`.** The
   reducer is correct and is the reference behaviour. `git diff --exit-code` on
   that path must return 0.
2. **Do NOT swap the sweep backdrop.** `core/portals-to-the-dark-dimension` is
   not the cause — all five failing games are the same `core` hero board, and a
   `MAX_TURNS` sweep of 50/75/100/150/200 changes nothing. Swapping it masks the
   defect and discards the coverage D-24323 chose it for.
3. **Do NOT relax `assertAllGamesTerminated`** in
   `scripts/runtime-observed-hollows.mjs`. That guard is what caught this.
4. **Do NOT change `MAX_TURNS`** in either direction (D-24363 rejects turn-cap
   tuning as a substitute for a root fix).
5. **Do NOT regenerate `docs/ai/coverage/runtime-observed-hollows.json`.** It
   stays current under this fix; it shifts only under WP-453.
6. **Do NOT re-implement the payability arithmetic.** Read the cost from
   `getDiscardToPlayCost` — the single authority, per D-24363 part 1.
7. **No `.reduce()`**; keep the `continue` idiom already used twice in this loop
   body's siblings.
8. **`ai.legalMoves.ts` stays boardgame.io-free.**

## Required Comments

- [ ] `// why:` at the enumeration site — that this mirrors the D-24185 /
      WP-383 pre-commit precondition in `playCard`, that the `+ 1` is because
      the played card is still in hand, and that this is the third application
      of D-24363 part 1 (after WP-214 fight cost and WP-554 defeat requirement).

## Files to Produce

| File | New? |
|---|---|
| `packages/game-engine/src/simulation/ai.legalMoves.ts` | edit |
| `packages/game-engine/src/simulation/ai.legalMoves.test.ts` | edit |
| `docs/ai/DECISIONS.md` (D-24364) | edit |

Governance close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`docs/ai/STATUS.md`.

## After Completing

- [ ] `pnpm -r build && pnpm --filter @legendary-arena/game-engine test` green,
      count ≥ 2656.
- [ ] `pnpm sim:runtime-observed:check` on `main` — expect *artifact is current*.
- [ ] `node scripts/check-number-ledger.mjs --check` and
      `pnpm roadmap:counts:check` exit 0.
- [ ] Confirm the sentinel fixture `finalStateHash` is unchanged against your own
      build (observed unchanged at draft — verify, do not inherit).
- [ ] Land D-24364; flip WORK_INDEX `[x]`, EC_INDEX `Done`, mindmap node to `✅`,
      then `pnpm roadmap:counts:write`; STATUS.md.
- [ ] Assess the `01.6` trigger — expected not fired (third application of an
      existing rule; no new contract, abstraction, builder, or category).
- [ ] Two-commit topology: `EC-590:` implementation, then `SPEC:` governance close.
- [ ] Report back so WP-453 (PR #1440) can rebase, regenerate its artifact, and
      unhold.

## Common Failure Smells

- **Off-by-one.** `hand.length < cost` instead of `cost + 1` leaves the
  single-card case — the only one that occurs in practice — still wedged, while
  looking correct. AC-2 pins the boundary; make it fail first.
- **Filtering on keyword presence.** Suppressing whenever the card *has* a
  discard-to-play cost passes AC-1 and breaks every legitimate play of Cyclops'
  cards.
- **"Fixing" the sweep instead.** Swapping the backdrop, relaxing the
  termination guard, or raising `MAX_TURNS` all turn the gate green while
  leaving a live bot-ally stall in production.
- **`git status` noise after building.** `packages/lagn-spec/schemas/lagn-v1.json`
  shows ` M` from line-ending churn. Confirm with
  `git diff --ignore-cr-at-eol --numstat`, then `git checkout --` it.
