# EC-819 — Soaring Flight executor (Execution Checklist)

**Source:** docs/ai/work-packets/WP-782-soaring-flight.md
**Layer:** Game Engine + card data

## Before Starting
- [ ] Reserve PR #2476 (WP-782 / EC-819 / D-24627) is merged; `origin/main` fetched and rebased onto.
- [ ] `pnpm install` and `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail.
- [ ] Anchors re-read (all `~`): `KEYWORD_TIMING_DEFAULTS` `setup:~537`; `UNMATCHED_KEYWORD_TIMINGS` `setup:~173`; `RECRUIT_TIME_EXECUTED_KEYWORDS` `execute.ts:~316`; `heroEffectPlayBothSides` `execute.ts:~4918`; `recruitHero.ts:~175-229`; `recruitOfficer.ts:~188-202`; `gainHqHeroFree` `tacticHandlers.ts:~831`; `giveHqHeroChoice.resolve.ts:~276-294`; `consumeTeleportReturns` `endOfTurnCleanup.logic.ts:~102-138`; `carryConversionFlag` `economy.logic.ts:~518`; `enablePlayBothSides` `:~804`; `VALID_TOKEN_PATTERN` `apply-hero-ability-markers.mjs:~119`; `MOVE_EXECUTED_HANDLER_MODULES` `hero-mechanic-ledger.mjs:~100`.
- [ ] Read the current `HERO_KEYWORDS` length (three pins) and `HERO_EFFECT_HANDLERS` count (two pins) now (74 / 58 at draft; WP-781 may have moved them). They move by exactly +3 / +2.

## Locked Values (do not re-derive)
- Keywords: `'soaring-flight'` (recruit-time, no handler), `'grant-soaring-flight-next'`, `'grant-soaring-flight-all'` (handled, no-magnitude).
- `KEYWORD_TIMING_DEFAULTS['soaring-flight'] = 'onRecruit'`. `UNMATCHED_KEYWORD_TIMINGS['soaring-flight']` stays.
- `soaring-flight` joins `RECRUIT_TIME_EXECUTED_KEYWORDS` only — NOT `HANDLED_KEYWORDS`, NOT `NO_MAGNITUDE_KEYWORDS`. The two grant keywords join `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`.
- Flags: `TurnEconomy.isNextRecruitSoaringFlight?: true`, `TurnEconomy.isEveryRecruitSoaringFlight?: true` — lazy, in `CarriedTurnFields` + `carryConversionFlag`, dropped by `resetTurnEconomy()`.
- Economy helpers: `grantSoaringFlightToNextRecruit`, `grantSoaringFlightToEveryRecruit` (spread `carryConversionFlag`, then set their flag); `consumeNextRecruitSoaringFlight` (build the carried set from `carryConversionFlag`, delete `isNextRecruitSoaringFlight` from that local object, then spread — the key must be absent).
- `hero/soaringFlight.logic.ts` (boardgame.io-free, `moves/`-free; imports only `getHooksForCard`, `filterHooksByTiming`, `consumeNextRecruitSoaringFlight` and types) exports `cardHasSoaringFlight(G, cardId)` (read-only), `placeRecruitedHero(G, playerId, cardId, isWallCrawlChosen)` (mutates the passed `G`: `turnEconomy`, the recruiter's zones, `pendingTeleportReturns`; returns the placement), `RecruitPlacement = 'deck-top' | 'set-aside' | 'discard'`. No `turnEconomy` guard in the helper.
- `placeRecruitedHero` order: (1) read `hasSoaringFlight` = native OR every-flag OR next-flag; (2) consume the next-flag if set; (3) missing zones → `'discard'`, no write; (4) `isWallCrawlChosen` → `deck.unshift` → `'deck-top'`; (5) `hasSoaringFlight` → push `{ playerID: playerId, cardId }` onto lazily-created `G.pendingTeleportReturns` → `'set-aside'`; (6) `discard.push` → `'discard'`.
- `gainHqHeroFree` returns `{ heroId, placement } | null` so `freeRecruitFromHqByFilter` appends the note only on `'set-aside'`.
- Call sites: `recruitHero` passes today's `placeOnDeckTop`; `recruitOfficer`, `gainHqHeroFree`, and `giveHqHeroChoice.resolve` (only when `entry.filter !== undefined`) pass `false`. Paibok (no `filter`) keeps its `discard.push` + log byte-identical.
- Log note, appended only on `'set-aside'`: ` (Soaring Flight: set aside until end of turn)`. Filtered give-hq-hero set-aside line: `Player N recruited <card> from the HQ (Soaring Flight: set aside until end of turn).`
- Markers, 17 rows in `hero-ability-markers.json` `"xmen"`, abilityIndex 0 `[keyword:soaring-flight]` on: aurora-northstar northern-lights, twin-blast, mach-10; banshee speed-of-sound; cannonball kinetic-blast-field, carry-to-the-air, natural-leader, human-cannon; colossus-wolverine fastball-special; kitty-pryde lockheed-kittys-dragon; legion maelstrom-of-clashing-powers; phoenix obliterating-fire; polaris ride-the-magnetic-waves, subtle-attunement, reverse-polarity. Plus `cannonball/carry-to-the-air` abilityIndex 1 `[keyword:grant-soaring-flight-next]` and `aurora-northstar/mach-10` abilityIndex 1 `[keyword:grant-soaring-flight-all]`.
- `VALID_TOKEN_PATTERN` gains exactly `^\[keyword:soaring-flight\]$`, `^\[keyword:grant-soaring-flight-next\]$`, `^\[keyword:grant-soaring-flight-all\]$`.
- `types.ts`: JSDoc/comment edits only, on `PendingTeleportReturn` / `pendingTeleportReturns` (the queue holds Teleport-on-discard and Soaring Flight cards) and on `PendingGiveHqHeroChoice.filter` (a present `filter` marks a free recruit, D-24627; a future filtered gain must add its own discriminant). `endOfTurnCleanup.logic.ts` untouched.
- `giveHqHeroChoice.resolve.test.ts` `makeG` gains the baseline `turnEconomy` literal (`{ attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0 }`) — fixture completion only (a real `G` always carries `turnEconomy`); no assertion changes.
- Ledger: `MOVE_EXECUTED_HANDLER_MODULES['soaring-flight'] = 'packages/game-engine/src/hero/soaringFlight.logic.ts'`; provenance rows for all three keywords → `{ wp: 'WP-782', decision: 'D-24627' }`.
- The §Card Map, verbatim.

## Guardrails
- One placement authority: every recruit path calls `placeRecruitedHero`; no gain path does. No second copy of the destination rule.
- Soaring Flight is mandatory; only an explicit `toTopOfDeck: true` on a Wall-Crawl card overrides it.
- The next-recruit grant is consumed by the next recruit on any path, whatever its destination.
- No new top-level `G` field, no UIState field, no client or server edit, no new move, no `CORE_MOVE_NAMES` change.
- Plain recruits and Paibok gains stay byte-identical (zones + log).
- Moves never throw; validate, gate, mutate, return void. No `.reduce()` with branching; `for…of` only.
- A changed oracle with no xmen hero on its board = STOP and diagnose; never re-pin it.

## Required `// why:` Comments
- `KEYWORD_TIMING_DEFAULTS['soaring-flight']`: printed "When you recruit this Hero" (D-24627; the Wall-Crawl D-24049 precedent).
- `RECRUIT_TIME_EXECUTED_KEYWORDS` entry: executes at recruit via `placeRecruitedHero`; membership keeps the play-time visit `applied`, not a `no-handler` hollow.
- `placeRecruitedHero`: rules v23 ~L2084-2087 player's choice via `toTopOfDeck`; the grant is read before it is consumed; reuse of the D-24526 queue (same printed effect as Teleport).
- The two handlers: two Carry to the Air plays name the same next Hero (idempotent flag).
- `carryConversionFlag` entries: a rebuild must not drop either grant.
- `giveHqHeroChoice.resolve` branch: `filter` present = a free recruit (Soaring Flight applies); absent = Paibok's give, a gain (it does not).
- `VALID_TOKEN_PATTERN`: WP-782 / D-24627 closed-set extension.

## Files to Produce
- `packages/game-engine/src/hero/soaringFlight.logic.ts` + `soaringFlight.logic.test.ts` — **new**
- `setup/heroAbility.setup.ts`, `rules/heroKeywords.ts` (+ test), `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts` (`HERO_KEYWORDS` pin ~1430) — **modified**
- `hero/heroEffects.execute.ts` (+ test) — **modified**
- `economy/economy.types.ts`, `economy/economy.logic.ts` (+ test) — **modified**
- `moves/recruitHero.ts` (+ test), `moves/recruitOfficer.ts` (+ test) — **modified**
- `rules/tacticHandlers.ts` (+ test), `moves/giveHqHeroChoice.resolve.ts` (+ test) — **modified** (01.5 wiring)
- `packages/game-engine/src/types.ts` — **modified** (JSDoc only)
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `data/cards/xmen.json`, card-mechanics, effect index, hero ledger (json + csv), runtime-observed hollows, dashboard data mirrors, `sim:coverage` baseline, dashboard `useInPlayCoverage.test.ts` pin — **regenerated / re-pinned**
- Conditional: an xmen-board replay oracle re-pin; `docs/ai/post-mortems/01.6-WP-782-soaring-flight.md` if a `01.6` trigger fires
- `docs/ai/DECISIONS.md` (D-24627), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0; marker apply reports 17 updates, then 0 on a re-run.
- [ ] `pnpm cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check`, `sim:coverage --check` → all 0; no `soaring-flight` row remains in runtime-observed or the coverage baseline.
- [ ] Engine suite 0 fail; `pnpm -r --no-bail test` → 0 fail; pins moved +3 / +2 from the execution-time baseline.
- [ ] Sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged (or the xmen-only re-pin rule followed).
- [ ] D-24627 Active. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`, `pnpm roadmap:counts:write`, `roadmap:counts:check` → 0.
- [ ] Allowlist-only diff; `lagn-v1.json` CRLF churn reverted. Two-commit topology (`EC-819:` then `SPEC:`).
- [ ] Live-verify (D-24026) on play.legendary-arena.com post-deploy, recorded as a STATUS flip.

## Common Failure Smells
- A Soaring Flight card lands in discard → the marker is missing (re-run the apply script) or `KEYWORD_TIMING_DEFAULTS` did not set onRecruit.
- Playing a Soaring Flight card logs a `no-handler` hollow → `soaring-flight` is missing from `RECRUIT_TIME_EXECUTED_KEYWORDS`.
- Carry to the Air does nothing → the grant keyword is missing from `NO_MAGNITUDE_KEYWORDS` (the magnitude pre-gate dropped it).
- The grant disappears after a recruit spend → `carryConversionFlag` lacks the flag.
- Every recruit for the rest of the turn is set aside after Carry to the Air → the next-flag was never consumed.
- The set-aside card never reaches the hand in sim → it was parked somewhere other than `G.pendingTeleportReturns`.
- The dashboard `totalObs` test fails → re-pin after regenerating the feeds, then re-run once.
