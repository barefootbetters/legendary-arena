# EC-861 — Brainwash the Military (Execution Checklist)

**Source:** docs/ai/work-packets/WP-823-brainwash-the-military.md
**Layer:** Game Engine (+ one danger-meter noun in `apps/arena-client/src/vfx/menaceDisplay.ts`)

## Before Starting
- [ ] `SCHEME_TWIST_CONFIGS` has no `ca75/brainwash-the-military` key; `schemeTwistConfigs.test.ts` pins `size === 8 + 67 + 1`.
- [ ] `ConvertedVillainOrigin` is `'killbot' | 'skrull'` (`types.ts` ~L69); `resolveBaseFightCost` (`economy/economy.resolve.ts` ~L278) has only the Killbot and Skrull overlay branches.
- [ ] `defeatCityVillainCore` (`moves/fightVillain.ts` ~L506) has only the Skrull gain branch; `buildVillainDeck` converts only Killbots.
- [ ] `schemeTwistHandler` still increments `schemeTwistCount` after the resolver (`rules/schemeHandlers.ts` ~L46-57).
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm -r --no-bail test` → 0 fail; record the engine and arena-client test totals.

## Locked Values (do not re-derive)
- `rules/brainwashTheMilitary.logic.ts` (NEW): `BRAINWASH_THE_MILITARY_SCHEME_ID = 'ca75/brainwash-the-military'`, `BRAINWASHED_OFFICER_COUNT = 12`, `BRAINWASHED_OFFICER_BASE_ATTACK = 3`, `TRAITOR_BATTALION_STACK_LIMIT = 6`, `BRAINWASHED_OFFICER_ESCAPE_THRESHOLD = 5`; `brainwashedOfficerExtId(index)` = `` `shield-officer-villain-deck-${String(index).padStart(2, '0')}` ``; `resolveBrainwashedOfficerCount(schemeId, officersCount)` = `Math.min(BRAINWASHED_OFFICER_COUNT, officersCount)` for the scheme (negative / non-finite → 0), else 0; `countBrainwashedOfficers(origins)`; `applyBrainwashedOfficerDisplay(cardDisplayData, origins)` copies `cardDisplayData[SHIELD_OFFICER_EXT_ID]` with `extId: id` per `'shield-officer'` id; `listCityBrainwashedOfficers(G)` scans City index 4 → 0.
- `types.ts`: `ConvertedVillainOrigin = 'killbot' | 'skrull' | 'shield-officer'`; `TRAITOR_BATTALION_TWISTS = 'traitorBattalionTwists'` (never seeded).
- Setup: a `buildVillainDeck` section between §4 and §5 pushes the Officer ids typed `'villain'`, origin `'shield-officer'`; `buildInitialGameState` slices `piles.officers` by `countBrainwashedOfficers(...)` when `> 0`, and calls `applyBrainwashedOfficerDisplay` right after `applyKillbotDisplayNames`.
- Attack: after the Skrull branch, `'shield-officer'` → `BRAINWASHED_OFFICER_BASE_ATTACK + (G.counters[TRAITOR_BATTALION_TWISTS] ?? 0)`.
- Defeat: `else if` `'shield-officer'` → `officerGained = true`; push `SHIELD_OFFICER_EXT_ID` to the defeater's discard; delete the origin; `` `Player ${currentPlayer} defeated ${formatCardRef(G.cardDisplayData, cardId)} and gained it as a Hero into their discard pile.` ``; narrative arg `skrullGained || officerGained`; `composeFightNarrative`'s `@param skrullGained` JSDoc names the Officer gain (body unchanged).
- Resolver `'brainwash-the-military'`: `stackedCount < TRAITOR_BATTALION_STACK_LIMIT` → counter `stackedCount + 1`, `` `[Brainwash the Military] Twist ${nextCount} joins the Traitor Battalion next to the Scheme — S.H.I.E.L.D. Officers now have ${BRAINWASHED_OFFICER_BASE_ATTACK + nextCount} Attack. Another card is played from the Villain Deck.` `` `'threat'`, then `playTopVillainDeckCards(gameState, context, implementationMap, 1)`; else `escapeEveryCityOfficer`: none → `` `[Brainwash the Military] Twist 7: no S.H.I.E.L.D. Officer is in the City, so none escapes.` ``; else `` `[Brainwash the Military] Twist 7: all ${indices.length} S.H.I.E.L.D. Officer(s) in the City escape.` `` `'threat'`, then per index: re-read the space and skip it if empty or no longer an Officer, else null it in a copied City and `resolveVillainEscape`. One terminal `schemeTwistResolved`, key `'brainwashTheMilitary'`, phrase `'a Twist joined the Traitor Battalion, or every S.H.I.E.L.D. Officer in the City escaped'`.
- Config: `resolverId: 'brainwash-the-military'`, `params: {}`, `lossThreshold: 7`, `resourceLossCondition: { kind: 'escaped-converted-count', origin: 'shield-officer', threshold: 5 }`, after Portals.
- Loss: `'escaped-officer'` after `'escaped-skrull'` in `SchemeLossKind` + `SCHEME_LOSS_KINDS`; `case 'shield-officer': return 'escaped-officer';`; `` `${matchCount} S.H.I.E.L.D. Officers escaped` ``; client noun `'Officers'`.
- Imports: `economy.resolve.ts` ← `BRAINWASHED_OFFICER_BASE_ATTACK` (`../rules/brainwashTheMilitary.logic.js`) + `TRAITOR_BATTALION_TWISTS` (`../types.js`); `fightVillain.ts` ← `SHIELD_OFFICER_EXT_ID` (`../setup/pilesInit.js`). `state/zones.types.ts` `officers` JSDoc: starts at `config.officersCount` minus the Brainwash Officers (comment only).
- Unions: `'brainwash-the-military'` before `'counter-only'`; `'brainwashTheMilitary'` last in `SchemeTwistResolverKey` and `SCHEME_TWIST_RESOLVER_KEYS` ("exactly ten entries").

## Guardrails
- Every Officer branch tests the `'shield-officer'` origin; no runtime instance-id prefix test; no widened `'villain'` read.
- Only this scheme adds Officers or shrinks the Officer Stack; other schemes' setup and random streams byte-identical (B2).
- The Twist number comes from `TRAITOR_BATTALION_TWISTS`, raised before the extra card is played; never from `schemeTwistCount`.
- A defeated Officer is never pushed to `victory` and never drawn from `G.piles.officers`.
- Each grown union lands with its array and its runtime drift pin (D-24372). No `.reduce()`, no nested ternaries, nothing throws.
- Hash oracles byte-identical; if one moves, STOP and explain before any re-pin.

## Required `// why:` Comments
- The Officer section in `buildVillainDeck`: before the sort and shuffle, so no new random draw (D-24324 co-located conversion).
- The Officer Stack slice: the 12 come from the physical Stack (rules v23); identical tokens, shuffle already ran.
- The attack branch: overlay-first because a converted Officer has no `cardStats` row.
- The defeat branch: the token swap (identical Officers; the token carries stats, team, display, invariant exemption); not from the Stack; never VP.
- The resolver: numbering from the stack, because a nested Twist reads the pre-increment `schemeTwistCount` (Assumes 8); a Twist after six stacked runs Twist 7.
- The Twist 7 scan: Bridge first, each a full escape (D-24656); the loss latch is idempotent.
- The config entry and the client noun (D-24756, WP-623 precedent).

## Files to Produce
- `packages/game-engine/src/rules/brainwashTheMilitary.logic.ts`, `rules/brainwashTheMilitary.test.ts` — **new**
- `packages/game-engine/src/types.ts`, `villainDeck/villainDeck.setup.ts`, `setup/buildInitialGameState.ts`, `economy/economy.resolve.ts`, `moves/fightVillain.ts` — **modified**
- `packages/game-engine/src/rules/schemeTwistConfig.types.ts`, `rules/schemeTwistResolvers.ts`, `rules/schemeTwistConfigs.ts` + test, `rules/schemeLossProgress.ts` + test, `rules/schemeResourceLoss.ts` — **modified**
- `packages/game-engine/src/events/notableEvents.types.ts` + test, `events/notableEvents.compose.ts` — **modified**
- `packages/game-engine/src/state/zones.types.ts` — **modified** (JSDoc only)
- `apps/arena-client/src/vfx/menaceDisplay.ts` + test — **modified**
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] B1-B3, B1b, A1-A2, D1-D2, T1-T6, L1-L4, P1-P4 pass (engine +18). `pnpm --filter @legendary-arena/arena-client typecheck` → 0. `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail.
- [ ] `effect-index:check`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `cards:check`, `cards:count-markers:check`, `sim:runtime-observed:check` → 0, nothing regenerated.
- [ ] Revert proofs observed (`schemeTwistCount + 1` numbering; instance id to discard; Officer to `victory`; no Stack draw-down; no attack branch; Twist 7 escapes every City card; `'villain'`-typed escape count; Twist 7 bypasses `resolveVillainEscape`).
- [ ] `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] D-24756 Active. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check` → 0.
- [ ] Allowlist-only diff. Two-commit topology `EC-861:` then `SPEC:`.
- [ ] Live-verify (D-24026) post-deploy STATUS-flip.

## Common Failure Smells
- Twist 6 plays a Twist that stacks a seventh time → the nested Twist was numbered from `schemeTwistCount`.
- An Officer shows 0 Attack or "<unknown>" → the attack branch sits after the `cardStats` guard, or the display copy did not run.
- The fighter's Victory Pile grows after an Officer fight → the Skrull `if` was not turned into `if / else if / else`.
- The Officer Stack reads 30 in a Brainwash match, or 18 in another scheme → the slice is missing or not scheme-gated.
- "Scheme Twist #6 revealed" prints after the Twist 7 escape line → expected: the dispatcher's generic line follows the resolver (WP Known gaps); do not touch `schemeHandlers.ts`.
- A non-Brainwash hash moved → the Officer section or slice ran for every scheme, or a counter was seeded.
- The meter still reads "Twists (approximate)" → the config entry or `escapedConvertedKind` case is missing.
- arena-client fails to compile → `SCHEME_LOSS_NOUNS` lacks `'escaped-officer'`.
- Twist 7 leaves an Officer in the City → the City was read once and not rescanned per index, or an Escape effect moved it first; re-read `G.city[index]` before each escape.
