# EC-644 — Hand Projection Panel Section (Execution Checklist)

**Source:** docs/ai/work-packets/WP-609-hand-projection-panel.md
**Layer:** Cross-cutting — Game Engine (two barrel re-exports) + arena-client

## Before Starting
- [ ] WP-607 (panel), WP-606 (`deckComposition`/`discardCards`), WP-608
      (`deckCardStats`, `2a8b7f55`) all on `origin/main`; execute from a fresh
      worktree off `origin/main` (a stale local checkout misses WP-608).
- [ ] `HAND_SIZE = 6` in `packages/game-engine/src/moves/drawCards.logic.ts`;
      `createSpeculativePrng` exported from `@legendary-arena/preplan`.
- [ ] Baseline clean + synced; capture `git rev-parse origin/main`.
- [ ] Scope lock — EXACTLY these 5 files: `packages/game-engine/src/index.ts`
      + `apps/arena-client/src/components/play/{handProjection.ts,
      handProjection.test.ts, DeckProbabilityPanel.vue, DeckProbabilityPanel.test.ts}`.
      Any edit outside → STOP. (STATUS/DECISIONS/WORK_INDEX/mindmap are the
      separate SPEC govern-close commit, not a scope breach.)
- [ ] Read WP-607 `DeckProbabilityPanel.vue` (`viewer`, section structure) + `deckProbability.ts`.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; `test` green.

## Locked Values (do not re-derive)
- Barrel: `index.ts` re-exports `HAND_SIZE` (const, `./moves/drawCards.logic.js`)
  + `UIDeckCardStat` (type, `./ui/uiState.types.js`).
- `handProjection.ts` + `.test.ts` + the panel `.vue` + `.test.ts`, in `components/play/`.
- EV (exact two-stage): `deckDraw·Σdeck/|deck| + discardDraw·Σdiscard/|discard|`,
  `deckDraw = min(HAND_SIZE,|deck|)`, `discardDraw = min(HAND_SIZE−deckDraw,|discard|)`.
- Pool zones: deck = `deckComposition`, discard = `discardCards`; each term 0 when its zone is empty.
- RNG: injectable `rng: () => number` (default `Math.random`); component seeds a
  STABLE `createSpeculativePrng(seed)` from game state; tests inject their own.
- Owner select: `players.find(p => p.handCards !== undefined)`.

## Guardrails
- **Client-side advisory only** — math in `handProjection.ts`; NEVER `ctx.random`,
  NEVER a `boardgame.io`/engine-LOGIC runtime import (the only engine touches are
  the two additive barrel re-exports: the `HAND_SIZE` const + `UIDeckCardStat`
  type; use `import type` for the type), NEVER a store/game-state write.
- **`HAND_SIZE` via the barrel, NEVER a hardcoded 6** (the engine SSOT rule).
- **EXACT two-stage EV, no approximation.** The engine draws the deck top first
  (certain when short), reshuffling the discard only on exhaustion — NOT a single
  combined-pool draw. deck=[10,10]/discard=5×[0] must project 20, not ~17.1.
- **Stable display seed.** The component seeds the Monte Carlo from a
  deterministic function of game state (turn + pool) so the range does NOT jitter
  on recompute; tests inject their own seed. Panel test asserts presence + EV +
  range ORDERING, never exact percentile values (else flaky).
- **Only the range uses the Monte Carlo; the EV is closed-form.** Missing
  `deckCardStats` key → 0/0. Empty pool → all zeros.
- **Self-hide, never throw** — `v-if` on viewer present AND pool non-empty.
- **No `.reduce()` with branching; `for...of`.** **`vue-tsc` gates.**

## Required `// why:` Comments
- `handProjection.ts`: the TWO-STAGE draw (deck certain when short + proportional
  discard reshuffle; exact, not a single-pool approximation) + the injectable-`rng`
  seam (default `Math.random`, seeded in tests).
- `DeckProbabilityPanel.vue`: the new section reads owner-only fields off the
  `handCards`-redaction-marker `viewer`; seeds a STABLE PRNG from game state (no
  jitter); self-hides on empty pool.
- `index.ts`: re-export of the `HAND_SIZE` SSOT const + the `UIDeckCardStat` type.

## Files to Produce
- `packages/game-engine/src/index.ts` — **modified** — re-export `HAND_SIZE` + `UIDeckCardStat`
- `apps/arena-client/src/components/play/handProjection.ts` — **new** — two-stage EV + Monte Carlo
- `apps/arena-client/src/components/play/handProjection.test.ts` — **new** — util tests (both EV branches + seeded determinism)
- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — **modified** — "Next hand" section (stable seed)
- `apps/arena-client/src/components/play/DeckProbabilityPanel.test.ts` — **modified** — section test (stable-range assertion)

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` (vue-tsc) 0; `test` green.
- [ ] **Live-on-surface (D-24026):** on deployed `play.legendary-arena.com`, the
      expanded panel shows a "Next hand" section with expected recruit/attack + range.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24420 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-609 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node `📝` → `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.
- [ ] `git diff --name-only` — the `EC-644:` implementation commit is only the 5 code files.

## Common Failure Smells (Optional)
- A hardcoded `6` in the client → you didn't import `HAND_SIZE` from the barrel.
- `import type { UIDeckCardStat }` fails `vue-tsc` → you didn't add the barrel re-export (Scope A).
- EV runs ~14% low on a short deck → you used a single combined-pool draw instead of the two-stage model.
- Flaky panel test / jittery displayed range → the component used `Math.random` instead of a state-seeded PRNG.
- EV drifts with sample count → you sampled the expected value instead of the closed-form `expectedNextHand`.
- A runtime `@legendary-arena/game-engine` import beyond `HAND_SIZE` (+ `import type UIDeckCardStat`) → engine logic in the client.
