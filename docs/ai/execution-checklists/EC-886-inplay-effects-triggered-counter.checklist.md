# EC-886 — In-play "Effects triggered" counter (Execution Checklist)

**Source:** docs/ai/work-packets/WP-848-inplay-effects-triggered-counter.md
**Layer:** Game Engine (`UIState` projection) + Arena Client (render) — cross-layer
**Status:** Draft

## Before Starting
- [ ] WP-708, WP-712, WP-715, WP-803 complete in WORK_INDEX; D-24784 reserved in NUMBER-LEDGER
- [ ] `recordConditionalClause` (`diagnostics/synergyCount.record.ts`) still writes per-seat
      `{played, assembled, potentialValue, realizedValue}` to `G.diagnostics.conditionalClauses`
- [ ] `uiState.build.ts` §14 still reads `gameState.diagnostics?.conditionalClauses`;
      `outOfTimeCards` still set in the per-player loop
- [ ] `uiState.filter.ts` still rebuilds players in `redactHandCards` AND `preserveHandCards`
- [ ] `YourVictoryPile` mounted only in `PlayDesktop.vue` and `PlayMobile.vue`
- [ ] Target file set is exactly the 11 files under Files to Produce (+ post-mortem, governance)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record pass count)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (record pass count)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0

## Locked Values (do not re-derive)
- Engine field: `UIPlayerState.conditionalClauses?: { played: number; assembled: number }` —
  public to every audience; present iff `G.diagnostics.conditionalClauses[playerId]` exists.
- Client props: `conditionalClausesPlayed`, `conditionalClausesAssembled` (Number, default 0).
- Test id: `play-your-victory-effects`.
- Copy when `played > 0`: `Effects triggered: {assembled} / {played} ({percent}%)`, with
  `percent = Math.round((100 * assembled) / played)`.
- Copy when `played === 0`: `Effects triggered: 0 / 0` (no percentage).
- Forbidden words in the panel copy (case-insensitive): `whiff`, `failed`, `missed`, `wasted`,
  `error`.
- The copy / percentage helper is a named function returned from `setup()` (P6-46).
- Test counts: engine +1 `describe`/1 `it` (build) and +1 `describe`/3 `it`s (filter) =
  game-engine +4 tests; `YourVictoryPile.test.ts` +4; `PlayDesktop.test.ts` +1; `PlayMobile.test.ts` +1.

## Guardrails
- No `G` write; the build only reads `G.diagnostics.conditionalClauses`. No move, rule, `endIf`,
  bot or scoring path reads the new field.
- Project ONLY `played` and `assembled`, as a fresh object (never a reference into
  `G.diagnostics`). Omit the key when there is no entry — no `undefined` literal
  (`exactOptionalPropertyTypes`). An entry with `played === 0` IS projected.
- Pass through BOTH filter functions. Missing one silently drops the field for that audience.
- Client computes only the display percentage; no condition or effect logic (D-20105).
- Sentinel `finalStateHash` + `PRE_WP080_HASH` byte-identical. Any hash / fixture / snapshot
  re-pin = STOP and report; do not re-pin.
- Do not change what is counted (recorder, `countsTowardRate`, chokepoint) or the endgame /
  coach surfaces.
- Victory Pile header, composition counters and browse button unchanged.

## Required `// why:` Comments
- `uiState.types.ts` JSDoc on `conditionalClauses`: WP-848 / D-24784, the WP-708 tally live,
  omit-when-absent, unit = conditional clause; public because every outcome is already in the
  public game log (an assembled effect, or the `blocked` "ability did not activate" line).
- `uiState.build.ts` assignment: reads the hash-excluded diagnostics channel (D-24271), fresh copy
  so the projection never aliases `G.diagnostics`, no re-pin.
- `uiState.filter.ts` both pass-throughs: public field, fresh copy.
- `YourVictoryPile.vue` props/line: same tally as the endgame Synergy Rate; no percentage at 0.

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — declare the field
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate in the per-player loop
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass through both functions
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — values, absent key, no aliasing
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — 3 audiences, fresh ref, absent key
- `apps/arena-client/src/components/play/YourVictoryPile.vue` — **modified** — props + line
- `apps/arena-client/src/components/play/YourVictoryPile.test.ts` — **modified** — 3/5 (60%), 2/3 (67%), 0/0, copy lint
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — bind props
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — bind props
- `apps/arena-client/src/pages/PlayDesktop.test.ts` — **modified** — mount-binding test
- `apps/arena-client/src/pages/PlayMobile.test.ts` — **modified** — mount-binding test
- `docs/ai/post-mortems/01.6-WP-848-inplay-effects-triggered-counter.md` — **new** — 01.6 post-mortem

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (count up by exactly 4)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (count up by 6)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `git diff --name-only origin/main -- '*.test.ts'` = exactly the 5 allowlisted test files
- [ ] `git diff --name-only` = the 11 files + post-mortem + governance files only
- [ ] Browser preview by WP method (a) or (b): line reads `0 / 0` → `0 / 1 (0%)` → `1 / 2 (50%)`
- [ ] Live-on-surface verification (D-24026), after both the server and arena-client deploys are
      live: real match on play.legendary-arena.com; diagnostics
      `uiStateSnapshot.players[n].conditionalClauses` matches the panel — or flagged
      operator-pending in WORK_INDEX
- [ ] 01.6 post-mortem written (before the `EC-886:` commit)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — D-24784 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date; EC_INDEX row `Done`
- [ ] `docs/05-ROADMAP-MINDMAP.md` node 📝 → ✅, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0
- [ ] `docs/ai/NUMBER-LEDGER.md` WP-848 / EC-886 / D-24784 marked LANDED
- [ ] `pnpm ledger:numbers:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check` exit 0
- [ ] Commits: `EC-886:` implementation, then `SPEC:` governance close

## Common Failure Smells
- Panel always `0 / 0` in a real match → owner pass-through (`preserveHandCards`) missing, or a
  mount site misspells the binding (correct: `:conditional-clauses-played` /
  `:conditional-clauses-assembled`; neither name has consecutive capitals, so the `victoryVp`
  camelize trap does not apply); the page tests catch it.
- Line does not move after playing a threshold-gated card that was unmet at play → expected
  (WP-708 wait-and-see is uncounted), not a bug; live-verify with a class- or team-gated hero.
- Opponent / spectator view lacks the field → `redactHandCards` pass-through missing.
- A sentinel hash moved → the build wrote to `G` or read hashed state; revert and re-check.
- `NaN%` on screen → the `played === 0` branch was skipped.
- Line renders blank in tests but fine in the browser → helper not returned from `setup()`.
- vue-tsc can't see `conditionalClauses` → engine `dist` stale; run `pnpm -r build` first.
