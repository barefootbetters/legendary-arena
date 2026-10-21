# EC-854 — Villain-side Savior gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-816-villain-savior-gate.md
**Layer:** Game Engine (+ card-data markers and derived feeds)

## Before Starting
- [ ] `executeVillainAbilities` still checks `requireCitySpaces` before `applyVillainEffect` and `continue`s with no hollow record / trace (`villainEffects.execute.ts` ~L176-191).
- [ ] `parseParameterizedEffect` still splits `@` then calls `parseUngatedEffect`; the no-param tail still returns `{ primitive }` for a 1-part token.
- [ ] `descriptorKey` is still `primitive|target|magnitude|selector`.
- [ ] `fightVillain.ts` still awards attached Bystanders before `executeVillainAbilities(…, 'onFight', …)`.
- [ ] Hero Savior still counts `pile-bystander` + `bystander-villain-deck-*` (`heroConditions.evaluate.ts` ~L325-341).
- [ ] `VILLAIN_EFFECT_PRIMITIVES` length recorded (28 at draft). `pnpm -r build` → 0; record the engine test total.

## Locked Values (do not re-derive)
- `type VillainEffectCondition = 'savior'`; `VILLAIN_EFFECT_CONDITIONS = ['savior']`; `requireCondition?: VillainEffectCondition` (not in `descriptorKey`).
- `target` widened to `'current' | 'each' | 'each-other' | 'each-non-savior'`. Primitive `'ko-bystander-each-victory-pile'` appended last.
- Grammar `<primitive>[:<param>…][@<spaces>][!<condition>]`: split `!` first; >1 `!`, or a suffix not in the set (case-sensitive, empty included) → null. `gain-wound:each-non-savior` exactly 2 parts, no magnitude. Legacy keywords take no suffix.
- `board/bystanders.logic.ts`: `SAVIOR_BYSTANDER_THRESHOLD = 3`; `countVictoryPileBystanders(victory)`; `findFirstVictoryPileBystander(victory)`; id test = `=== BYSTANDER_EXT_ID` or `startsWith('bystander-villain-deck-')`.
- Gate block line: `` `${label} effect: Player ${currentPlayer} is not a Savior (${count} of ${SAVIOR_BYSTANDER_THRESHOLD} Bystanders in their Victory Pile); no effect.` `` `'blocked'`.
- `each-non-savior` lines: `… each player who is not a Savior gains a Wound: ${composeWoundOutcomeClause(…)}.` (Diving Block) / `… each player who is not a Savior gained a Wound (Player 1, Player 2).` `'applied'` / `… no player who is not a Savior gained a Wound.` `'blocked'`. `woundsDrawn += 1` when the current player is wounded. Returns `{ targets: [] }` only (no `woundOutcomes`).
- `board/bystanders.logic.ts` newly imports `BYSTANDER_EXT_ID` from `'../setup/pilesInit.js'`; update its header comment.
- Ledger `normalizeEffectToken`: `rawToken.split('!')[0].split('@')[0].split(':')[0].trim()`.
- KO lines: `` `${label} effect: KO'd a Bystander from the Victory Pile of Player 0, Player 2.` `` `'applied'` / `` `${label} effect: no player had a Bystander in their Victory Pile to KO.` `` `'blocked'`.
- Marker map rows and the `_unassigned` deletion exactly as WP §Locked Values. Provenance row `ko-bystander-each-victory-pile` → WP-816 / D-24749.

## Guardrails
- The condition gate lives only in the executor loop, after the location gate, before dispatch. No handler reads `requireCondition`.
- The gate reads `ctx.currentPlayer` at every timing and fails closed on missing zones.
- Do not edit `hero/heroConditions.evaluate.ts`; the T11 parity test pins the two Savior counts.
- No villain parser reads `[keyword:Savior]` or English.
- Regenerate data with `apply-effect-markers.mjs` only; never `convert-cards-v15.mjs`.
- Keep `VillainEffectKeyword`, the legacy reverse-map and `EFFECT_KEYWORD_LABELS` frozen; new outcomes self-narrate.
- Sorted player iteration; no `.reduce()`; nothing throws.
- Hash oracles must stay byte-identical; if one moves, STOP and explain before any re-pin.

## Required `// why:` Comments
- The `!` split: Savior is data on the marker, the `@` gate's sibling; split first so the suffix is always last (D-24749).
- The executor gate: rules v23 L1844-1853; current player; fail closed; not hollow (D-24295 precedent).
- `countVictoryPileBystanders`: the hero gate's predicate verbatim so hero and villain Savior never disagree; Killbots are a joint follow-up.
- `each-non-savior`: per-player exemption, so a target, not the current-player gate (the `each-other` precedent).
- `findFirstVictoryPileBystander` use: every Victory-Pile Bystander is worth the same, so pile order is a deterministic no-choice pick (Whispers and Lies).
- The script's condition list: hand-synced copy of the engine array.

## Files to Produce
- `packages/game-engine/src/rules/villainAbility.types.ts` + test — **modified**
- `packages/game-engine/src/setup/villainAbility.setup.ts` + test — **modified**
- `packages/game-engine/src/board/bystanders.logic.ts` + test — **modified**
- `packages/game-engine/src/villain/villainEffects.execute.ts` + test — **modified**
- `packages/game-engine/src/moves/fightVillain.test.ts` — **modified** (additions only)
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json`, `scripts/villain-mechanic-ledger.mjs` (normalizer only) — **modified**
- `data/cards/ca75.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json` — **regenerated**
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] T1-T23 pass. `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail.
- [ ] Marker script: `7 new [effect:] marker(s) appended`, re-run 0; data diff is `ca75.json` only, 7 lines. The 8 T7 tokens each loud-fail the script when put in the map one at a time (recorded in the commit body).
- [ ] Ledger: the 6 new rows (Radioactive Man's two markers share one `gain-wound` row) are `executable` with a handler; `ko-bystander-each-victory-pile` has WP-816 / D-24749 provenance; no mechanic name contains `!` or `@`.
- [ ] T15 uses two Heroes in hand (one Hero auto-KOs). T12 / T22 pass a shuffle context; T22 / T23 attach `bystander-villain-deck-01`.
- [ ] `pnpm ledger:villains && pnpm effect-index` (after a rebuild); then `cards:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` → 0. The last three need no regeneration; if one flags, STOP.
- [ ] Revert proofs observed (gate removed; Saviors wounded; last Bystander taken).
- [ ] `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] D-24749 Active. STATUS updated (+ the Killbot Savior follow-up). WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check` 0.
- [ ] Allowlist-only diff. Two-commit topology `EC-854:` then `SPEC:`.
- [ ] Live-verify (D-24026) post-deploy STATUS-flip.

## Common Failure Smells
- A Savior villain line still does nothing and logs nothing → the marker was written as `koHeroCurrentPlayer!savior` (unresolved) instead of `ko-hero:current!savior`.
- `apply-effect-markers.mjs` loud-fails on a new token → the script's primitive or condition copy was not updated.
- Black Knight's KO stops narrating its target → `requireCondition` was added to `descriptorKey`.
- Savior fails with exactly 3 Bystanders after rescuing one from the fought villain → the gate ran before the Bystander award, or `>` was used for `>=`.
- Radioactive Man wounds a Savior → the exemption read the current player instead of each player.
- An unrelated set's JSON changed → the base converter was run.
- The ledger shows `ko-cullable-each-deck-top!savior` as `unsupported` → the ledger normalizer still splits on `:` only.
