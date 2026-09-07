# EC-694 — Partition Transform Cards into a Side Deck at Setup (Execution Checklist)

**Source:** docs/ai/work-packets/WP-657-transform-side-deck.md
**Layer:** Game Engine (`packages/game-engine/src/setup`)

## Before Starting
- [ ] Baseline `origin/main` clean + fast-forward synced; re-confirm the WP baseline (`343195d3`).
- [ ] WP-135/137/138 on `main`: `buildHeroDeck.ts` emits via `heroCardInstanceExtIds` (physicalCards path + rarity fallback), shuffles once in `shuffleHeroDeck`, and `buildInitialGameState.ts` consumes it → `fillHqFromDeck` → `G.heroDeck`.
- [ ] `data/cards/wwhk.json` transform cards carry `isTransform:true` + `transformOf:<baseSlug>` (17 total; e.g. `hurl-trucks` off `hurl-legal-objections`).
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL — surface as a blocker.

## Locked Values (do not re-derive)
- Transform predicate: a `cards[]` entry with `isTransform === true` OR `typeof transformOf === 'string'`.
- New instance field: `HeroCardInstance.isTransform: boolean` (tagged on BOTH emission paths from the hero's transform-slug set).
- New state zone: `G.transformDeck: CardExtId[]` (top-level, beside `heroDeck`; `CardExtId` strings only).
- Side deck is UNSHUFFLED — no new `ctx.random`; `shuffleHeroDeck` stays the only setup RNG.
- Entry point: `buildTransformSideDeck(heroDeckIds, registry)` — soft-skips a narrow registry with `[]` (mirrors `buildHeroDeck`); built off the SAME `effectiveHeroDeckIds` as `buildHeroDeck`.
- Determinism re-pins (sanctioned, new-`G`-field cause): `PRE_WP080_HASH` `c3ee9eb4 → d5d807a9`; sentinel `finalStateHash` `f90e4620…388e → e237a0e792…e28ac3`.
- Reserved decision: **D-24468** (land Active at close). EC **EC-694**. WP **WP-657**.

## Guardrails
- Setup-only: the partition lives in `buildHeroDeck.ts` + the orchestrator. NO move/rule/keyword runtime here — a `packages/game-engine/src/moves/**` change ⇒ STOP (out of scope).
- Emitter emits EVERYTHING: `heroCardInstanceExtIds` still returns every instance (its `buildCardStats` §1b + `buildHeroAbilityHooks` consumers need transform cards); only the reservoir/side-deck callers filter on `isTransform`.
- Complete + disjoint: every emitted instance lands in exactly one of `heroDeck` / `transformDeck`; assert no overlap and union = all instances.
- No new RNG: the side deck is deterministic + unshuffled; the empty-replay hash may shift ONLY by the new field, never by a new draw.
- Re-pin, don't mask: each hash re-pin carries a `// why:` naming the single cause (new empty `G` field), matching the WP-236/282/398 re-pin history. If a hash shifts for ANY other reason ⇒ STOP.
- `G` stays JSON-serializable; only `Game.setup()` may throw; no `.reduce()`.

## Required `// why:` Comments
- `buildHeroDeck.ts` (module header + the two partition sites + `buildTransformSideDeck`): transform cards go to the side deck, not the reservoir; the emitter still emits all; side deck unshuffled (Shuffle envelope preserved). D-24468.
- `types.ts` (`transformDeck` field): what it holds, that it is unshuffled + read-only in WP-657, and that the runtime is a follow-up WP. D-24468.
- `buildInitialGameState.ts` (the `buildTransformSideDeck` call): complementary partition of the same effective hero set; Skrull conversion never draws transform cards (not in the reservoir). D-24468.
- `replay.execute.test.ts` (`PRE_WP080_HASH` re-pin): new `G` field serializes into the empty-replay state; no behaviour change; `c3ee9eb4 → d5d807a9`.

## Files to Produce
- `packages/game-engine/src/setup/buildHeroDeck.ts` — **modified** — `isTransform` on `HeroCardEntry`/`HeroCardInstance`; transform-slug set + tagging (both paths); `buildHeroDeckCards` excludes; `buildTransformSideDeckCards` + `buildTransformSideDeck`; module header
- `packages/game-engine/src/types.ts` — **modified** — `transformDeck: CardExtId[]` on `LegendaryGameState`
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — hoist `effectiveHeroDeckIds`; call `buildTransformSideDeck`; set `transformDeck` in the state literal; import
- `packages/game-engine/src/setup/buildHeroDeck.test.ts` — **modified** — +8 partition tests; `isTransform` on existing instance-shape assertions; import the two new exports; `MockHeroCard` gains the flags
- `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` — **modified** — assert `G.transformDeck` is an array
- `packages/game-engine/src/replay/replay.execute.test.ts` — **modified** — `PRE_WP080_HASH` re-pin + `// why:`
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified** — `finalStateHash` re-pin
- Governance: `NUMBER-LEDGER.md` (reservations) + `DECISIONS.md` (D-24468) + `WORK_INDEX.md` (WP-657) + `EC_INDEX.md` (this row) + `docs/ai/STATUS.md`

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` → 0
- [ ] From `packages/game-engine`: `node --import tsx --test src/setup/buildHeroDeck.test.ts` → 45/0; `src/setup/buildInitialGameState.shape.test.ts` → 21/0
- [ ] `node --import tsx --test "src/**/*.test.ts"` → 3056/3056 (the two re-pins land; no other hash moves)
- [ ] `typecheck:tests` net-neutral vs `origin/main` (pre-existing partial-mock red unchanged, +0)
- [ ] `node scripts/check-number-ledger.mjs --check` passes; `check-workindex-rows` + `roadmap-counts` green
- [ ] `git diff --name-only` = the file set above and nothing else
- [ ] D-24468 landed Active; WORK_INDEX (WP-657) + STATUS updated
- [ ] Runtime keyword + ledger flip carried by a named follow-up WP (NOT this one)

## Execution Result (2026-09-06)
Executed off `origin/main` @ `343195d3`. `game-engine` build 0; `buildHeroDeck.test.ts` 45/0 (+8), shape 21/0 (+1), full engine suite **3056/3056** after the two sanctioned re-pins; ledger/workindex/roadmap checks green. `typecheck:tests` net-neutral (the 19 partial-mock rows already red on main swap one pre-existing missing-field error for a `transformDeck` one; +0). `generate-seed-par.test.ts` fails identically on baseline (pre-existing `ERR_MODULE_NOT_FOUND` workspace-resolution quirk in the local shell) — not this change. Pending commit/PR.
