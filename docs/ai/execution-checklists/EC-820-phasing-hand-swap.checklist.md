# EC-820 — Phasing hand swap (Execution Checklist)

**Source:** docs/ai/work-packets/WP-783-phasing-hand-swap.md
**Layer:** Game Engine + App arena-client

## Before Starting
- [ ] Baseline `origin/main` includes the reserve commit (#2478). `pnpm install` and `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail.
- [ ] Anchors re-read (all `~`):
  - `heroKeywords.ts` union `:26-100` / array `:109-184`
  - `HAND_ACTION_EXECUTED_KEYWORDS` `heroEffects.execute.ts:331`
  - `dodgeCard.ts` `:81-184`
  - `game.ts` moves `:520-678`
  - `game.test.ts:181-217`
  - `drawCards.logic.ts` `reshuffleDiscardIntoDeck` `:120-141`
  - `excessiveViolenceAvailable` `uiState.types.ts:~790` / build `:~1034` / filter `:~452`
  - `HandRow.vue:218-242`
- [ ] Re-read the current `HERO_KEYWORDS` length (74 at draft) and move count (45 at draft); each moves by exactly +1. WP-781 (Lightshow) and WP-782 (#2476, Soaring Flight) add a keyword, a move, an economy option field and the same keyset and dashboard pins; whichever lands first shifts these values.

## Locked Values (do not re-derive)
- Keyword `'phasing'`, placed after `'dodge'`. It joins `HAND_ACTION_EXECUTED_KEYWORDS` only: not `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS` or `NO_MAGNITUDE_KEYWORDS`. The handler count is unchanged, and there is no parser edit.
- Move `'phaseCard'`, args `{ cardId }`, registered `{ move, client: false }`. Not in `CORE_MOVE_NAMES`, `SIMULATION_MOVE_NAMES`, the sim / PAR maps or `MOVE_MAP`.
- `phasingOptions(G, playerId): CardExtId[]` is exported from `moves/phaseCard.ts`. It returns distinct hand ids in hand order, each passing all four checks:
  - `main` stage
  - no pending choice: the 29-guard cluster copied verbatim from `dodgeCard.ts`, plus `hasPendingOptionalPutBottomHQ` and `hasPendingPutAnyNumberBottomHQ`
  - the card is in the hand with a `phasing` hook
  - the deck or the discard pile is non-empty
- Move order:
  1. args
  2. stage gate
  3. `phasingOptions(...).includes(cardId)`
  4. empty deck → `reshuffleDiscardIntoDeck(playerZones, context as ShuffleProvider)`; if the deck is still empty, return
  5. swap: `deck[0]` → end of `hand`, the card → `deck[0]`
  6. `pushLog`
  7. return void
- Not a draw, not a play: no `turnEconomy` write; `drawsLocked` does not block it; no hook fires.
- No per-turn limit.
- Log: `Player N phased <formatCardRef(cardId)> onto the top of their deck and took the top card into their hand.` It never names the card taken into hand.
- Projection `UITurnEconomyState.phasingOptions?: CardExtId[]`: present iff non-empty; active player only (copied array); `REDACTED_ECONOMY` for everyone else.
- Client: `HandRow.vue` prop `phasingCardIds?: CardExtId[]` (default `[]`); a **sibling** button `data-testid="play-hand-phase"`, label `Phase`, submitting `phaseCard({ cardId })`. It is an absolute overlay `.hand-card__phase` on a `position: relative` `li.hand-card`, anchored to the tile's left edge (the anchor provides visibility, since each transformed `<li>` is its own stacking context, so `z-index` only lifts it above its own tile). Add `.hand-card:focus-within { z-index: 5 }`, a hit target of at least 24×24 px, and `aria-label="Phase <display name>"`. It overrides the `.hand-card button` reset. The `<li>` box and arc are unchanged. `uiMoveName.types.ts` gets `'phaseCard'`.
- Ledger `MOVE_EXECUTED_HANDLER_MODULES`: `'phasing': 'packages/game-engine/src/moves/phaseCard.ts'`. Provenance `"phasing": { "wp": "WP-783", "decision": "D-24629" }`.

## Guardrails
- Phasing never does anything on play, and never records a hollow.
- One legality predicate: `phasingOptions` feeds the move and the projection. `getLegalMoves` never emits `phaseCard`.
- The only randomness is the empty-deck reshuffle through the move context. No `Math.random`, and no new `G` field or turn flag.
- The Phase button is never nested inside the play-card button.
- No client-side rule logic: the client renders `economy.phasingOptions` only.
- No `apps/server`, sim, PAR or replay-map edit.
- Moves never throw; validate, gate, mutate, return void.
- Tests assert the exact swap arrays (`hand` = old hand minus `cardId` plus the old top card last; `deck` = `[cardId, ...oldDeck.slice(1)]`; after a reshuffle, `discard` is empty and `deck.length` equals the old discard length). They include three pending no-op cases (both put-bottom-HQ guards plus one Dodge-cluster guard), each asserting the move no-op **and** `phasingOptions === []`.

## Required `// why:` Comments
- `'phasing'` in `heroKeywords.ts` and `HAND_ACTION_EXECUTED_KEYWORDS`: executed by the `phaseCard` hand move, not on play.
- `phasingOptions`: the single predicate for the move and the projection; bots excluded (swap cycles, D-24038 step budget).
- The empty-deck reshuffle: rules v23 L254, Jeff-confirmed 2026-09-27.
- The no-`turnEconomy`-write / draw-lock-ignored rule: rules v23 ~L1796 ("isn't … drawing a card").
- The unnamed card in the log line: `G.messages` is public.
- The two put-bottom-HQ guards in `phasingOptions`: checked only by `advanceStage` (`game.ts:216,218`); added here so the swap cannot run under an open HQ put-bottom choice.
- The `main`-only window: narrower than "during your turn" on purpose (reveal precedes hero actions; `cleanup` ends the turn; pending effects resolve atomically).
- The projection's owner-only disposition.
- The sibling button in `HandRow.vue`: interactive elements cannot nest.

## Files to Produce
- `packages/game-engine/src/moves/phaseCard.ts` + `.test.ts` — **new**
- `rules/heroKeywords.ts` (+ test), `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts` (X-Gene length pin), `hero/heroEffects.execute.ts` (+ test) — **modified**
- `game.ts`, `game.test.ts` — **modified** (01.5 wiring)
- `ui/uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`, `uiState.filter.test.ts`, `uiState.types.drift.test.ts` — **modified**
- `apps/arena-client/src/components/play/HandRow.vue` (+ test), `components/play/uiMoveName.types.ts`, `pages/PlayDesktop.vue` (+ test), `pages/PlayMobile.vue` (+ test) — **modified** (page tests: a snapshot with `economy.phasingOptions` renders one `play-hand-phase`; without it, none)
- `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv`, `data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json` — **regenerated**; `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **re-pinned**
- `docs/ai/DECISIONS.md` (D-24629), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. Regenerate the feeds, then every `:check` / `--check` → 0; the four Phasing ledger rows read `executable`, and the `phasing` runtime row is gone.
- [ ] Engine and arena-client suites pass; arena-client `typecheck` 0; `pnpm -r --no-bail test` → 0 fail; sentinel / PAR oracles unchanged (a change = STOP).
- [ ] `economy.phasingOptions` visible in the Play Diagnostics `uiStateSnapshot` for the active seat.
- [ ] D-24629 Active. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology (`EC-820:` then `SPEC:`).
- [ ] Live-verify (D-24026) post-deploy.

## Common Failure Smells
- A `phasing` hollow still records on play → `'phasing'` missing from `HAND_ACTION_EXECUTED_KEYWORDS` (so it is not in `MVP_KEYWORDS`).
- The keyword-count test fails → one of the **three** `HERO_KEYWORDS` length pins (74 → 75: `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts` X-Gene), or the ordered `expectedKeywords` array, was not updated.
- The move-count test fails → `game.test.ts` was not updated.
- The button shows but pressing it does nothing → the projection and the move use different predicates, or the move rejects a split card's face-b id.
- The draw-count condition fires after phasing → the move wrote `turnEconomy`.
- The dashboard `totalObs` test fails → re-pin after regenerating the feeds. Expect `totalObs` unchanged and `percentResolved` up; anything else is a trajectory shift to diagnose.
- The Phase button is invisible or unclickable in a full hand → it lost the `.hand-card button` reset override, or it is not anchored to the tile's left edge; for keyboard focus, check `.hand-card:focus-within`. (Raising the button's `z-index` cannot fix this: each transformed `<li>` is its own stacking context.)
