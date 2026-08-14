# EC-577 — Core Villain Recursive Villain-Deck Play (Execution Checklist)

**Source:** docs/ai/work-packets/WP-542-core-villain-recursive-villain-deck-play.md
**Layer:** Game Engine (`packages/game-engine`) + Card Data

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Cards unmarked: `node -e "const m=require('./scripts/convert-cards/inputs/villain-effect-markers.json'); const h=(m.villains.core||{}).hydra||{}; const r=(m.villains.core||{}).radiation||{}; process.exit((h['endless-armies-of-hydra']?.fight||r['the-leader']?.ambush)?1:0)"` → unmarked
- [ ] Machinery + precedent present: `grep -q "export function performVillainReveal" …/villainDeck.reveal.ts && grep -q "function chainedReveals" …/schemeTwistResolvers.ts && grep -q villainCardEscapeTriggersSchemeTwist …/villainEffects.execute.ts` → OK
- [ ] Static impl-map: `grep -q "export const DEFAULT_IMPLEMENTATION_MAP" packages/game-engine/src/rules/ruleRuntime.impl.ts` → OK
- [ ] Fire sites: `grep -q "executeVillainAbilities(G, ctx, cardId, 'onFight'" …/moves/fightVillain.ts && grep -q ambushResolved …/villainDeck.reveal.ts` → OK
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- New primitive (append-only, D-24034 — union + `VILLAIN_EFFECT_PRIMITIVES` array + drift test moved together): `play-villain-deck-cards`. Its executor handler is a **REACHABLE NO-OP** (`return { targets: [] }`) — the WP-481 `villainEffectBecomeSchemeTwist` template (NOT hollow; the actual reveal fires from the fire sites). Parse the `:N` count.
- Detector `villainCardPlaysVillainDeckCards(G, cardId, timing: VillainAbilityTiming): number` — mirror `villainCardEscapeTriggersSchemeTwist`; read the card's hook for `timing`, return the `play-villain-deck-cards` descriptor's count (else 0). Guard missing `villainAbilityHooks`.
- Shared `playTopVillainDeckCards(G, context, implementationMap, count)` — the `chainedReveals` loop: call `performVillainReveal(G, context, implementationMap)` up to `count` times, **break when `villainDeck.deck.length === 0 && villainDeck.discard.length === 0`**. (Place in `villainDeck.reveal.ts`, exported for the fight site.)
- **Ambush fire site** (`villainDeck.reveal.ts`, after the onAmbush abilities resolve / near `ambushResolved`): if `villainCardPlaysVillainDeckCards(G, cardId, 'onAmbush') > 0`, call `playTopVillainDeckCards(G, context, implementationMap, N)` with the IN-SCOPE `context` + `implementationMap`. The Leader → N = 1.
- **Fight fire site** (`fightVillain.ts`, after `executeVillainAbilities(...'onFight'...)`): if `villainCardPlaysVillainDeckCards(G, cardId, 'onFight') > 0`, build `const revealContext = { random: <shuffleContext ?? ctx.random>, ctx: { currentPlayer: <ctx.currentPlayer> } }` (the narrow shape `performVillainReveal` reads), import the STATIC `DEFAULT_IMPLEMENTATION_MAP` from `../rules/ruleRuntime.impl.js`, and call `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, N)`. Endless Armies → N = 2.
- Markers: `villains.core.hydra['endless-armies-of-hydra'].fight = ['play-villain-deck-cards:2']`, `villains.core.radiation['the-leader'].ambush = ['play-villain-deck-cards:1']`. Regen `core.json` via `apply-effect-markers.mjs` + ALL derived feeds (ledger:villains, effect-index, card-mechanics).
- DECISIONS reservation: **D-24351**.

## Guardrails
- Do NOT widen `executeVillainAbilities` / the villain-effect handler signature to add `implementationMap` / `RevealContext` — the secondary-fire pattern fires from the sites that already own the pipeline (WP-481 discipline).
- Keep the shared loop's both-empty guard — never call `performVillainReveal` on an exhausted deck+discard (avoids an infinite / degenerate loop); recursion terminates on exhaustion.
- Reuse `performVillainReveal` VERBATIM — no new reveal/classification/routing behavior; a played card resolves exactly as a normal villain-deck reveal (villain→city, henchman/bystander/scheme-twist/master-strike as usual, recursing through the rule pipeline).
- Determinism: randomness is `context.random.Shuffle` (reshuffle on empty deck) — the allowed reveal-path RNG; NO `Math.random`, no new RNG source.
- The fight site imports the STATIC `DEFAULT_IMPLEMENTATION_MAP` (a module constant) — do NOT construct one at runtime.
- Regenerate EVERY card-data-derived feed after the marker edit (partial = red `main`); byte-check `core.json` is a REAL diff (`git diff --numstat`).
- Do NOT mark Maestro / Supreme HYDRA (out of scope) or reorder existing primitives (append-only).

## Required `// why:` Comments
- On the `play-villain-deck-cards` no-op handler: it is a REACHABLE no-op (the executor lacks the reveal pipeline); the actual reveal fires from the reveal/fight sites (WP-481 pattern).
- On the fight-site `RevealContext` construction + static `DEFAULT_IMPLEMENTATION_MAP` import: why the fight path builds/imports these (the move doesn't receive them).
- On the shared loop's both-empty guard: recursion terminates on deck+discard exhaustion.

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` — **modified** — union + array
- `packages/game-engine/src/villain/villainEffects.execute.ts` — **modified** — no-op handler + registry + parse + detector
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — `playTopVillainDeckCards` helper + onAmbush fire site
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — onFight fire site (build RevealContext + import static impl-map)
- `scripts/convert-cards/inputs/villain-effect-markers.json` — **modified** — 2 markers
- `data/cards/core.json` — **modified** — regenerated (2 markers)
- villain mechanic ledger + effect-implementation index — **modified** — regenerated feeds
- Tests (`villainEffects.execute.test.ts` / `villainDeck.reveal.test.ts` / `fightVillain.test.ts` + drift + marker) — **modified**
- `docs/ai/DECISIONS.md` (D-24351 → Active) · `STATUS.md` (D-24026 operator-pending) · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-542 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "play-villain-deck-cards|villainCardPlaysVillainDeckCards|playTopVillainDeckCards" villainAbility.types.ts villainEffects.execute.ts villainDeck.reveal.ts fightVillain.ts` → all present
- [ ] `grep -n DEFAULT_IMPLEMENTATION_MAP …/moves/fightVillain.ts` → the fight site imports the static map
- [ ] Executor NOT widened: no `implementationMap`/`RevealContext` added to `executeVillainAbilities` or the handler signature
- [ ] `node -e "process.exit(JSON.stringify(require('./data/cards/core.json')).includes('play-villain-deck-cards')?0:1)"` → exit 0; `git diff --numstat data/cards/core.json` real diff; feeds regenerated
- [ ] `grep -c Math.random villainDeck.reveal.ts fightVillain.ts` → 0 new
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24351 landed (Active)
- [ ] Commit prefix `EC-577:` (code + regenerated card data) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- The played cards don't resolve (no city entry / no chain) → the fight site passed a bad `RevealContext` or the wrong impl-map; build `{ random, ctx: { currentPlayer } }` + import the static `DEFAULT_IMPLEMENTATION_MAP`
- Infinite / hanging loop → the shared loop dropped the both-empty guard, or called `performVillainReveal` past exhaustion
- The primitive shows hollow in the detector → the executor handler must be a reachable no-op that RETURNS `{ targets: [] }` (not an unhandled/throwing branch)
- CI "Hero/Villain Effect Coverage" red though tests pass → a card-data-derived feed wasn't regenerated after the marker edit
- `core.json` dirty but `git diff --numstat` 0/0 → CRLF noise; the marker didn't apply (check the group/card slug + timing key)
- The executor grew an `implementationMap`/`RevealContext` param → wrong approach; fire from the reveal/fight sites (WP-481 pattern)
