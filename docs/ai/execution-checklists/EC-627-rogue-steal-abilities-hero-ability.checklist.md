# EC-627 — Rogue "Steal Abilities" Discard-Top-and-Copy (Execution Checklist)

**Source:** docs/ai/work-packets/WP-592-rogue-steal-abilities-hero-ability.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] Baseline `origin/main` @ `09baeef7` (or later); working tree clean, ff-synced.
- [ ] WP-535 ✅ (`executeHeroEffects` `:440`, `applyCopyPowers` `:2195`, `COPY_POWERS_EXT_ID`
      `:2109`) + WP-251 ✅ (`HANDLED_KEYWORDS`→`MVP_KEYWORDS`→`HERO_EFFECT_HANDLERS`).
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Target file set = the `Files to Produce` list below. Any edit outside it is a FAIL —
      surface as a blocker first.
- [ ] **Scaffold-first (REQUIRED, determinism):** add the marker + handler on a throwaway
      branch, run `pnpm -r build && pnpm --filter @legendary-arena/game-engine test` and
      `pnpm -r --no-bail test`; record whether `finalStateHash` / `PRE_WP080_HASH` /
      `sim:runtime-observed` shift (a Rogue-inclusive fixture restages `heroAbilityHooks`).
      A re-pin is knowable only by running — not by reasoning "additive."

## Locked Values (do not re-derive)
- Keyword token: `steal-abilities`; marker: `[keyword:steal-abilities]` on `rogue/steal-abilities`
  abilityIndex 0.
- `STEAL_ABILITIES_EXT_ID = 'core/rogue/steal-abilities'` (base ext_id; strip `#N` before compare).
  The recursion guard excludes **both** this and the existing `COPY_POWERS_EXT_ID` from re-fire.
- Seat order: `Object.keys(G.playerZones).sort()` (the `gain-wound-each` precedent).
- Empty-deck reshuffle: `reshuffleDiscardIntoDeck(playerZones, ctx as ShuffleProvider)` (D-24285).
- Copy = `G.cardStats[cardId]` attack/recruit → `G.turnEconomy`, then
  `executeHeroEffects(G, fullMoveContext, stealPlayerID, cardId)`. **No class/team grant.**

## Guardrails
- **No new pending type / `G` field / move.** No block-all-guard, `game.ts`, `game.test.ts`
  move-count, `ai.legalMoves.ts`, `uiState.*`, or arena-client change. If you reach for any of
  those, STOP — the design is deterministic and delegates to copied cards' existing prompts.
- Thread the FULL move-context wrapper into every re-fire AND the reshuffle — `{G, playerID}`
  alone crashes a copied draw/reshuffle.
- Copies are ephemeral: never append to `inPlay`, never call `applyCardPlay`, never mutate
  `cardTraits`. The real discarded cards stay in their owners' discard piles.
- Recursion guard: a discarded card whose base ext_id is `STEAL_ABILITIES_EXT_ID` **or**
  `COPY_POWERS_EXT_ID` is economy-only, logged, NOT re-fired. Both are reentrant-copy keywords —
  a re-fired Copy Powers auto-copies the in-play Steal Abilities card (sole eligible Rogue Hero)
  and re-fires it → the `COPY_POWERS_EXT_ID` stack-overflow class. **Two** termination tests:
  (a) Steal Abilities on top of a deck; (b) Copy Powers on top with Steal Abilities the only
  in-play Hero.
- No `.reduce()` in the discard/copy loops; explicit `for...of` with descriptive names.
- Cascade fork: default Fork A (FIFO — re-fire fully, parked choices use existing queues). The
  scaffold cascade matrix MUST probe: (i) two copies parking `reveal-attack-choose` — the ONLY
  single-slot pending type `G.pendingHeroChoice` (all others are `[]` FIFO queues); (ii) a copied
  `discard-to-play` card (Determination/Optic Blast — re-fired via `executeHeroEffects`, bypassing
  `playCard`'s D-24185 precondition, parks its array-queue directly); (iii) a copied **purchased**
  hero (not just a starter) re-fires via reservoir-wide hooks. If the `reveal-attack-choose`
  probe corrupts the single slot, fall back to Fork B (economy-only) for THAT keyword. Operator confirms.
- Drift pins are RUNTIME assertions (D-24372), not bare `satisfies`.

## Required `// why:` Comments
- The `steal-abilities` union + array entries: `// why: WP-592 / D-24401`.
- The seat-order iteration: why `Object.keys(G.playerZones).sort()` (deterministic, all players).
- The reshuffle call: why `ctx.random` (D-24285 empty-deck reshuffle) — code-style Rule 6.
- The recursion guard: why the base-ext_id self-exclusion (copy-of-copy stack-overflow class).
- Any `finalStateHash` / `PRE_WP080` / `sim:runtime-observed` re-pin: why it moved.

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — `steal-abilities` union + array.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `heroEffectStealAbilities`
  + `STEAL_ABILITIES_EXT_ID` + `HERO_EFFECT_HANDLERS`/`HANDLED_KEYWORDS`.
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — discard/copy/
  recursion/cascade/drift + termination tests.
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — union↔array drift pin.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — `[keyword:steal-abilities]`.
- `data/cards/core.json` — **regenerated** — marker (real diff, not CRLF churn).
- card-data-derived artifacts — **regenerated** — exactly what `pnpm ledger:heroes` + the regen
  chain (coverage, keyword feeds, `sim:runtime-observed`) touch, each gated by its `:check`; an
  unexpected regenerated file is still a scope blocker (verify via `git diff --name-only`).

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0;
      `pnpm -r --no-bail test` green.
- [ ] `pnpm ledger:heroes` + regen chain run; `ledger:heroes:check`, `sim:runtime-observed:check`,
      and card-data `:check` gates exit 0.
- [ ] `finalStateHash` / `PRE_WP080_HASH` byte-identical, or a documented deliberate re-pin.
- [ ] `git diff --name-only` = allowlist + governance; card-data diff is a real marker diff.
- [ ] **Live-on-surface (D-24026 REQUIRED):** Steal Abilities played in a real match on
      play.legendary-arena.com — each player discards; copies' economy + abilities fire; log shows it.
- [ ] `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24401 Active), `WORK_INDEX.md` `[x]`,
      `EC_INDEX.md` Done, `docs/05-ROADMAP-MINDMAP.md` `📝`→`✅` + `roadmap:counts:write`;
      `roadmap:counts:check` exits 0.

## Common Failure Smells
- The card logs `(+4 attack)` but no discard/copy lines → the marker didn't regen into
  `core.json`, or the keyword isn't in `MVP_KEYWORDS`/`HERO_EFFECT_HANDLERS`.
- A copied draw draws 0 → `{G, playerID}` passed instead of the full move-context wrapper.
- Server hangs / stack overflow on Steal Abilities → recursion guard missing, comparing the
  instance ext_id (`#N`) instead of the base ext_id, OR excluding only `steal-abilities` and not
  also `copy-powers` (a discarded Copy Powers re-copies the in-play Steal Abilities → mutual re-fire).
- `sim:runtime-observed:check` non-zero after regen → investigate WHY before re-baselining;
  re-baselining to make it pass is itself a FAIL.
