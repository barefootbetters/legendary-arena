# EC-415 — Red Skull Master Strike (Execution Checklist)

**Source:** docs/ai/work-packets/WP-386-red-skull-master-strike.md
**Layer:** Game Engine

## Before Starting
- [ ] WP-024 dispatcher present: `mastermindStrikeHandler` in
      `packages/game-engine/src/rules/mastermindHandlers.ts` branches on
      `G.selection.mastermindId`; `resolveMagnetoStrike` is the pattern
- [ ] WP-200 emission is the handler's final step — read it; do not reorder
- [ ] `WOUND_EXT_ID` exported from `src/setup/pilesInit.ts`; `G.ko` exists in
      `types.ts`; else STOP
- [ ] Exact target file set = the six files in Files to Produce; any edit
      outside it is a FAIL — surface as a blocker first
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — record the
      observed baseline (1981 pass / 463 suites at draft `a7a1150d`); if it
      moved, re-record and continue (main advances), do not force the number

## Locked Values (do not re-derive)
- Red Skull ids: `'core/red-skull'` and `'co2e/red-skull'` (readonly array
  constant beside `MASTERMIND_MAGNETO`; the co2e epic face is NOT matched)
- Hero eligibility: hand card is a Hero iff `extId !== WOUND_EXT_ID`
- Selection: lowest `gameState.cardStats[extId]?.cost ?? 0`; tie → lowest
  hand index
- Destination: append to `gameState.ko`; remove from the player's hand via
  the WP-382 / D-24183 idiom — `moveCardFromZone(playerZones.hand, [],
  selectedExtId)` + `koCard(gameState.ko, selectedExtId)` (fungible ids:
  first-match removal ≡ index removal)
- Player iteration: `Object.keys(gameState.playerZones).sort()`
- Log lines via `pushLog` + `formatCardRef(G.cardDisplayData, cardId)`:
  - `[Red Skull Master Strike] Player ${playerId} KO'd <cardRef> from their hand.`
  - `[Red Skull Master Strike] Player ${playerId} has no Hero in hand to KO.`
- Handler ordering: `captureBystanderOntoMastermind` → per-mastermind branch
  → WP-200 emission → `return buildGenericStrikeEffects()`

## Guardrails
- The handler never throws — empty hand / all-Wound hand / missing
  `cardStats` entry all degrade to the logged no-op or cost-0 treatment
- No new G field, no new `RuleEffect` type, no new move, no phase change
- Do not touch the `mastermindStrikeResolved` emission, its payload, or
  `composeMastermindStrikeNarrative`
- No `boardgame.io` or registry import in `mastermindHandlers.ts`
- No `Math.random()` / wall-clock; the auto-pick is cost-then-index only
- Determinism gates are binary and script-behavior-pinned: sentinel
  `finalStateHash`, `PRE_WP080_HASH`, and `sim:runtime-observed:check` must
  pass with **no regeneration**; drift = STOP and investigate, never re-pin

## Required `// why:` Comments
- The Red Skull id array: both faces print the identical strike text; the
  epic face is excluded (different text; first-non-tactic face selection)
- The auto-pick rule: D-24188 — lowest-cost ≈ player-optimal tabletop pick;
  avoids a blocking multi-player pending-choice
- The `?? 0` cost fallback: statless S.H.I.E.L.D. starters per D-21502
- The `!== WOUND_EXT_ID` filter: Wounds are not Heroes

## Files to Produce
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** —
  id constant + `resolveRedSkullStrike` + dispatch branch
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified**
  — new Red Skull describe-block (mirror the Magneto block; cover: KO per
  player, lowest-cost pick, tie→index, statless→cost-0, all-Wound no-op,
  empty-hand no-op, non-Red-Skull skip, both ids match, generic effects
  preserved)
- `docs/ai/STATUS.md` — **modified** — close-out entry
- `docs/ai/DECISIONS.md` — **modified** — D-24188 lands Active (anchor the
  append on the unique tail of the last real entry, never on a trailing
  sentinel line; assert heading count once after)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — checkbox flip
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — status flip

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — baseline
      + new tests, 0 fail; sentinel `finalStateHash` + `PRE_WP080_HASH`
      byte-identical (fixture mastermind is core/dr-doom)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm sim:runtime-observed:check` exits 0, no regeneration performed
- [ ] `git diff --name-only` = exactly the six-file allowlist
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated — D-24188 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] Live-on-surface (D-24026): deployed Red Skull match — a strike KOs a
      hero from each hand + per-player log lines in the HUD log
      (operator-pending on deploy acceptable; record it)

## Common Failure Smells
- New tests pass but Magneto tests fail → the branch was not isolated
  (dispatch must be per-id, mutually exclusive with Magneto)
- A hand shrinks by more than 1 → the resolver looped effects or re-ran on
  emission; exactly one KO per player per strike
- `sim:runtime-observed:check` regenerates → something leaked outside the
  Red Skull branch (the matrix mastermind is dr-doom); investigate, do not
  re-baseline
