# EC-935 — The Ambush overlay names keyword-less Ambush effects (Execution Checklist)

**Source:** docs/ai/work-packets/WP-897-ambush-overlay-keywordless-narration.md
**Risk Tier:** MEDIUM — the hashed `notableEvents` narrative changes for every match that reveals one of about 25 Ambush cards; no gameplay rule, new `G` write (the existing `ambushResolved` push carries a different narrative), card data, client, server, auth, money or persistence change
**Layer:** Game Engine (executor narrative channel, Ambush composer, Ambush fire site)

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Reserve PR #3397 merged; `pnpm -r build`, then `pnpm -r --no-bail test` exit 0 (record the engine count).
- [ ] Re-read at HEAD every anchor in WP `## Assumes` (executor ~195-348 / ~1070-1084 / ~881, composer ~445-482, fire site
      ~376-480, `villainAmbushHuntsForVictims` ~877 with one caller). The RS-5 data-walk test must find exactly the 16
      primitives in WP `## Context` (15 with handler clauses + the bridged stack entry). A difference is a STOP.
- [ ] Confirm `villainAmbushHuntsForVictims` has no caller besides `villainDeck.reveal.ts`.

## Locked Values (do not re-derive; verify at HEAD)
- **Field:** `VillainEffectApplication.narrativeClause?: string` — the clause of the `<Timing> effect:` line(s) the handler
  logged for this dispatch, prefix and final period removed, joined with `; ` in log order; set only non-empty, never
  `undefined` / `''`. A directly-logging handler builds `clause` once and logs `` `${label} effect: ${clause}.` `` from it.
- **Channel:** `export interface VillainAbilityExecution { results: VillainEffectResult[]; narrativeClauses: string[] }`;
  `executeVillainAbilitiesWithNarrative(G, ctx, cardId, timing, shuffleContext?, cityIndex?)` holds the loop;
  `executeVillainAbilities(…)` returns its `.results` (Fight / Escape / fortify callers untouched).
- **Per dispatched descriptor with a non-null application and `descriptorToLegacyKeyword === undefined`:** non-empty
  `narrativeClause` → push it; else primitive not in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` → push
  `its ${villainEffectTimingLabel(timing)} effect resolved (see the log)`; else nothing. Gated-out, hollow (`null`) and
  legacy-keyword descriptors add nothing.
- **Handlers that set a clause** (each return path that logged an `<label> effect:` line): `capture-pile-hero`,
  `capture-hq-heroes-cost-lte`, `capture-bystander-each-victory-pile`, `capture-bystanders-plus-per-hq-hero-by-trait`,
  `swap-two-city-villains`, `haunt-hq-hero`, `hq-heroes-cost-change`, `hq-heroes-to-hero-deck-bottom`,
  `recordOwedTraitDiscard` (both trait-discard primitives), `discard-hand-matching-hq-card-names-each-player` (per-player
  lines joined), `reveal-or-wound` (outcome line, then the queue line's clause, which `queueVillainRevealOrWoundChoice`
  returns), `demolish-each-player` (from `DemolishResult` + a `seatsInTurnOrderFrom` walk, three shapes: empty Hero Deck,
  no-cost reveal, reveal + one clause per seat, "discarded" if in `discards` else "has no card that costs <c> to discard";
  names via `resolveCardName`; resolver not edited), `villain-hunt-for-victims` (handler gains `timing, descriptor`;
  `it Hunts for Victims`; `it Hunts for Victims again` when `descriptor.requireCondition !== undefined`), `play-villain-deck-cards` (revealed branch only:
  `Player <p> revealed <a/an> <trait> Hero, so no card is played from the Villain Deck`).
- **Composer:** `composeAmbushNarrative(cardName, effectResults, villainDeckPlayCount = 0, stackVillainClause?,
  descriptorClauses: readonly string[] = [])`; order: keyword results, descriptor clauses, villain-deck play, stack; none →
  `"<card>" entered the city with no Ambush effect.`
- **Fire site:** `executeVillainAbilitiesWithNarrative(G, ctx, cardId, 'onAmbush', { random: context.random }, undefined)`;
  `results` replaces `appliedAmbushResults`; `narrativeClauses` is the fifth composer argument; the
  `villainAmbushHuntsForVictims` read, import and function are deleted.
- **Pinned narratives:** `"HYDRA Kidnappers" ambushed: captured S.H.I.E.L.D. Officer from the S.H.I.E.L.D. Officer Deck.`;
  `"Venom" ambushed: captured <sidekick> from the Sidekick Deck; captured <names> from the HQ (cost 2 or less).`;
  Blackout Moonlight `"Blackout" ambushed: it Hunts for Victims; it Hunts for Victims again.`
- **Comments:** `rules/villainAbility.types.ts` `descriptorToLegacyKeyword` JSDoc and `setup/villainAbility.setup.ts` ~1198-1202 drop
  "deferred to WP-253" and name WP-897's channel; the executor comment at ~276-281 stops claiming every descriptor is legacy.
- **Fixture:** the Kidnappers / Venom tests seed `G.cardDisplayData` so the pinned names resolve; never loosen the pin.
- **Data walk (RS-5):** a case in the new test builds every group's hooks from `data/cards/*.json` with the real parser,
  asserts the 16-primitive set, no keyword-less descriptor before a legacy one across a card's `onAmbush` hooks, and every conditional hunt after
  an unconditional one.
- **Fallback test:** `draw-cards-current` on a hand-built `onAmbush` hook; trace `fired`.

## Guardrails
- `appliedEffects`, `VillainEffectResult`, `EFFECT_KEYWORD_LABELS`, the legacy reverse map, every log line, hollow record and
  trace stay byte-identical; `G.messages` is unchanged for every reveal.
- No `G` mutation beyond the `ambushResolved` narrative string; no card data, `UIState`, client or server change; no new top-level `G` field.
- The composer stays pure (no `G`, boardgame.io or registry import); handlers never throw; no `.reduce()`, no nested ternary.
- Never scrape `G.messages` to build a clause; each handler supplies its own.
- A hash pin that moves is a STOP: confirm the sole delta is `ambushResolved.narrative`, then re-pin only with a commit that
  names the intended change.
- Only the two named test expectations change (compose ~717 positional argument; Blackout Moonlight ~511); every Fight /
  Escape log expectation for the shared handlers passes unchanged.

## Required `// why:` Comments
- `// why: WP-897 / D-24854` on: the `narrativeClause` field, `VillainAbilityExecution`, the channel branch in the loop, the
  fallback clause, each handler's clause assignment, the Demolish clause composer, the composer's descriptor-clause step,
  the fire-site call, and the removed hunt read (in the commit body, not a dangling comment).

## Files to Produce
- `packages/game-engine/src/villain/villainEffects.execute.ts` — modified
- `packages/game-engine/src/events/notableEvents.compose.ts` + `.test.ts` — modified
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — modified
- `packages/game-engine/src/moves/huntForVictims.logic.ts` + `moves/villainHuntForVictims.test.ts` — modified
- `packages/game-engine/src/rules/villainAbility.types.ts` (JSDoc only), `setup/villainAbility.setup.ts` (comment only) — modified
- `packages/game-engine/src/villain/ambushNarrative.keywordless.test.ts` — new
- Governance: DECISIONS (D-24854), STATUS (entry + L21 / L776), WORK_INDEX, EC_INDEX, the roadmap mindmap, NUMBER-LEDGER,
  `live-verify.json`

## After Completing
- [ ] WP Acceptance Criteria 1-11 hold, including the revert proof (AC 10); command tails recorded in the `EC-935:` body.
- [ ] `SPEC:` close: D-24854 Active, STATUS entry, WORK_INDEX `[x]` + live-verify token, EC_INDEX Done, mindmap ✅ +
      `roadmap:counts:write` + `roadmap:counts:check`, NUMBER-LEDGER LANDED, `live-verify.json` rows for Kidnappers and Venom (`ambush-narrative`).
- [ ] 01.6 post-mortem authored (new executor return channel); live-verify run or recorded operator-pending.

## Common Failure Smells
- Kidnappers still reads "no Ambush effect": the fire site still calls `executeVillainAbilities`, or the fifth argument is
  not passed.
- A narrative gains "its Ambush effect resolved (see the log)" for a listed card: that handler path set no clause.
- The Leader's unrevealed narrative gains the fallback: the no-op exclusion is missing.
- Blackout under Sunlight says "again": the gate check ran after dispatch, or the clause ignores `requireCondition`.
- A Fight / Escape test changes: a Fight or Escape caller was switched to the new function.
- `appliedEffects` grows: a clause leaked into `results`.
