# EC-821 — Deck-top discards count (Execution Checklist)

**Source:** docs/ai/work-packets/WP-784-deck-top-discards-count.md
**Layer:** Game Engine

## Before Starting
- [ ] `pnpm --filter @legendary-arena/registry --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (record the baseline count)
- [ ] Re-run the deck→discard sweep at HEAD: exactly the 8 WP sites; any extra site → STOP (session protocol)
- [ ] `recordCardDiscardedThisTurn` in `moves/discardFromHand.ts` is still private, gated on `matchReadsConditionType`
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `moves/discardFromHand.ts` exports
  `recordCardDiscardedThisTurn(G: LegendaryGameState, playerID: string, count: number = 1): void`,
  with the same gate and lazy init as today. It adds `count`: a `count <= 0` call returns BEFORE the lazy
  `= {}` init (so a zero-card Doctor Octopus strike never creates an empty map).
  `discardFromHand` keeps calling it with the default.
- **Site calls** (after the successful move; `owner` = the deck's player):
  1. `applyRevealAction`, `discard` branch: `const moved = applyRevealDiscard(playerZones, topCardId); if (moved) { recordCardDiscardedThisTurn(G, playerID); } return moved;`
  2. `heroEffectStealAbilities`: right after `ownerZones.discard = moveResult.to;` (~L4812), `recordCardDiscardedThisTurn(G, ownerPlayerId)` (lower-case `d`; the site has no `found` check because `deck[0]` is guaranteed after its reshuffle).
  3. `interpretMoveCardNode`: when `moveResult.found && moveNode.from.zone === 'deck' && moveNode.to.zone === 'discard'`, `recordCardDiscardedThisTurn(G, playerID)`.
  4. `resolveHeroChoice`, `discard` resolution: after the found move, `(G, playerID)`.
  5. `resolveRevealTopDispose`, `discard` disposition: after the found move, `(G, args.ownerPlayerID)` (the owner is read from `args`; there is no bare `ownerPlayerID` in scope).
  6. `applyRevealThreeDisposition`, `discard`: after the found move, `(G, playerID)`.
  7. `resolveRuthlessDictatorChoice`, `discard`: after the found move, `(G, playerID)`.
  8. `resolveDoctorOctopusReveal`: after the rebuild, `recordCardDiscardedThisTurn(gameState, playerId, discardedCards.length)`.
- **Drift guard** (in `moves/discardFromHand.test.ts`, beside the WP-498 hand guard):
  `DECK_TO_DISCARD_IDIOM = /move(?:CardFromZone|AllCards)\([^,)]*\.deck[^,)]*,[^,)]*\.discard/`. For every non-test
  source file, the number of `recordCardDiscardedThisTurn(` CALLS (comment lines excluded) must be
  ≥ the number of idiom matches, and no comment may contain the literal `recordCardDiscardedThisTurn(`. The matching file set
  must equal exactly `{ heroEffects.execute.ts, heroChoice.resolve.ts, revealTopDispose.resolve.ts,
  revealThreeAssign.resolve.ts, ruthlessDictatorChoice.resolve.ts }` (#1 / #2 share the first). #3
  and #8 do not match the idiom (data-driven zones / hand-built arrays) and are pinned by their own
  site tests. If the set at HEAD differs, STOP (session protocol). The guard checks FILES, not sites:
  `heroEffects.execute.ts` hosts #1 and #2, so the per-site tests and revert proofs stay mandatory.
  The regex also matches comments — no new JSDoc / `// why:` may contain a literal
  `moveCardFromZone(x.deck, x.discard` form.
  The guard's per-file checker is also run on a synthetic in-memory source string (idiom present,
  zero counter calls) and must report a violation — proving it can fail. No hard-coded exemption beyond
  the locked 5-file set.

## Guardrails
- Count only after a successful move; a not-found no-op never counts.
- No other behavior change at any site: return values, reshuffles, logs, ordering and the #8 batch rebuild stay byte-identical.
- No site writes `G.cardsDiscardedThisTurn` directly — always through the gated helper.
- Reactions (return-on-discard, teleport-on-discard) stay hand-only.
- No new `G` field / move / keyword / handler; moves, `HERO_KEYWORDS` and `HERO_EFFECT_HANDLERS` pins unchanged.
- Sentinel oracles byte-unchanged — a moved oracle is a gating bug, never a re-pin.
- Existing site tests pass WITHOUT edits; new tests are additions.

## Required `// why:` Comments
- The exported counter: it counts hand AND deck-top discards now (D-24631), still gated and lazy.
- Each of the eight site calls: `// why: D-24631 — a deck-top discard is "you discarded"` (for #5, add "counts for the deck OWNER").
- The drift guard: why #3 and #8 are pinned by site tests instead (data-driven zones / hand-built arrays).
- The B2 comment-only edits cite D-24631.

## Files to Produce
- `packages/game-engine/src/moves/discardFromHand.ts` — **modified**
- `packages/game-engine/src/hero/{heroEffects.execute,effectPrimitive.interpret}.ts` — **modified**
- `packages/game-engine/src/moves/{heroChoice.resolve,revealTopDispose.resolve,revealThreeAssign.resolve,ruthlessDictatorChoice.resolve}.ts` — **modified**
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified**
- `packages/game-engine/src/{types,hero/heroConditions.evaluate,hero/deferredConditionalGrants}.ts` — **comment-only** (→ "card-effect hand discards and deck-top discards", written by `recordCardDiscardedThisTurn` from the hand chokepoint and the deck-top sites; no code change)
- Tests (**modified**): `moves/discardFromHand`, `hero/heroEffects.execute`, `hero/effectPrimitive.interpret` (or `rules/effectPrimitive`), `moves/heroChoice.resolve`,
  `moves/revealTopDispose.resolve`, `moves/revealThreeAssign.resolve`, `moves/ruthlessDictatorChoice.resolve`, `rules/mastermindHandlers` (`.test.ts`)
- **Conditional:** `docs/ai/coverage/runtime-observed-hollows.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (feed-bound pin only)
- `docs/ai/{STATUS,DECISIONS}.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 failures; engine before/after counts recorded
- [ ] Drift guard proven able to fail (synthetic source: idiom present, zero calls → violation); no exemption beyond the 5 files
- [ ] 8/8 site revert proofs (removing each site's call fails its site test); both New Wings + Berserk end-to-end cases green
      (waiting → discard → +4 once; discard first → +4 immediately)
- [ ] `replayFixtures.test.ts` green + `git diff --exit-code -- packages/game-engine/src/test/fixtures/games` exits 0
- [ ] `sim:runtime-observed:check` exits 0 (regenerated only after an attributed per-board tally); dashboard typecheck 0
- [ ] `git status --porcelain` ⊆ Files to Produce
- [ ] Live (D-24026): a turn whose only discard is from the deck top grants New Wings +4; matchId in STATUS.md
- [ ] STATUS.md updated; D-24631 → Active; D-24616 §4 annotated "revised by D-24631"
- [ ] WORK_INDEX WP-784 `[x]` with date; EC_INDEX EC-821 → Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write` + `:check` exit 0

## Common Failure Smells
- A reveal rule stops after its discard → #1's `found` return was dropped or inverted.
- Steal Abilities counts only the active player → the call used `playerID`, not each seat's id.
- Hypnotic Charm credits the chooser → #5 used `playerID` instead of `args.ownerPlayerID`.
- Sentinel hash moved → a site wrote the counter without the gate.
- Doctor Octopus counts 1 regardless → #8 dropped `discardedCards.length`.
