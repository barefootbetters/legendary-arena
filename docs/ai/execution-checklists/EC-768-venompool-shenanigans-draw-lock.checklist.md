# EC-768 — Venompool "Shenanigans" turn-scoped draw-lock (Execution Checklist)

**Source:** docs/ai/work-packets/WP-731-venompool-shenanigans-draw-lock.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] Baseline: `origin/main` @ `1f8fa8f4` (or later, incl. the WP-731 reserve commit); working tree clean, synced.
- [ ] D-24551 landed (Shenanigans deferral + `[keyword:draw:N]` marker pipeline).
- [ ] WP-580 / D-24389: `TurnEconomy.recruitSpendableAsAttack?`, `carryConversionFlag` (single carry chokepoint, 3 sites), `enableRecruitSpendableAsAttack`, `resetTurnEconomy` (`economy/economy.{types,logic}.ts`).
- [ ] Hero-effect draw chokepoint `heroEffectDraw(G, ctx, playerID, cardId, effect)` present (`hero/heroEffects.execute.ts` ~1298); distinct from `drawCardsIntoHand`.
- [ ] Hero substrate: `HeroKeyword` union + `HERO_KEYWORDS`; `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` + `NO_MAGNITUDE_KEYWORDS` + `MVP_KEYWORDS`; generic `KEYWORD_PATTERN` scan + `{ type: keyword }` fallback; parity drift tests.
- [ ] Marker pipeline: `apply-hero-ability-markers.mjs` (+`VALID_TOKEN_PATTERN`) + `inputs/hero-ability-markers.json`; multi-token-per-line supported (WP-667 / D-24543).
- [ ] `pnpm -r build` 0; engine test + `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `sim:coverage --check` green.
- [ ] Scope lock — target files = `Files to Produce` (+ regenerated `data/cards/vnom.json` and derived feeds). Anything else is a FAIL; surface it as a blocker.

## Locked Values (do not re-derive)
- New keyword: `'no-more-draws'` (single segment, NO magnitude).
- New flag: `TurnEconomy.drawsLocked?: boolean` (optional / omit-when-off — never an always-present `false`).
- Guard site: `heroEffectDraw` ONLY (the `draw` keyword path); NOT `drawCardsIntoHand` / `endOfTurnCleanup` / setup / other-seat draws.
- Carry chokepoint: `carryConversionFlag` — extend to carry `drawsLocked` too (conditional spread, keep ABSENT when unset). New setter: `enableDrawLock(economy)`. Route BOTH setters (`enableRecruitSpendableAsAttack` + `enableDrawLock`) through `...carryConversionFlag(economy)` so it is genuinely singular.
- Marker order (LOAD-BEARING): `[keyword:draw:2]` BEFORE `[keyword:no-more-draws]` on `vnom/venompool/shenanigans` abilityIndex **0**.
- Drift counts: `HERO_KEYWORDS` and `HERO_EFFECT_HANDLERS` each **+1** — READ the current baseline count at execution (concurrent WPs move it; do NOT trust a number written here).

## Guardrails
- Draw-2-before-lock: the draw effect MUST fire before the lock arms — else Shenanigans self-blocks its own draw. Enforced by marker order; assert it with a test (draw-2 lands AND a later same-turn draw is blocked).
- `drawsLocked` is omit-when-off: set only via `enableDrawLock`, carried only by `carryConversionFlag` when present, cleared by `resetTurnEconomy` rebuilding a fresh economy. Do NOT seed it in `Game.setup` or write a present `false` — that breaks the byte-stable hash guarantee and forces a re-pin.
- **Both setters route through `carryConversionFlag`.** `enableRecruitSpendableAsAttack` today bypasses it (rebuilds from a literal) — with two flags that silently drops the other flag when both are set the same turn (Venompool + God of Thunder = legal loadout, either order). Add `...carryConversionFlag(economy)` to BOTH setters, each then setting only its own field true. A test MUST assert the two flags COEXIST across both setters (both directions).
- `'no-more-draws'` goes in BOTH the union AND `HERO_KEYWORDS`; the handler in BOTH `HERO_EFFECT_HANDLERS` AND `HANDLED_KEYWORDS`; AND in `NO_MAGNITUDE_KEYWORDS` (no magnitude — a missed entry drops it at the pre-gate and the lock never arms).
- Guard `heroEffectDraw` ONLY. The end-of-turn refill (lock lifts at turn end), setup deal, and other-seat draws (Covering Fire, villain each-player) route through `drawCardsIntoHand` and MUST stay unblocked — do NOT thread the lock into them.
- NO dedicated parser branch — the bare `[keyword:no-more-draws]` rides the generic scan → `{ type: 'no-more-draws' }`. Adding a branch is a FAIL (dead code).
- Effects never throw; the guard is a `pushLog('blocked')` + early return. No `.reduce()`.
- Marker edits touch only `abilities[i]` text. After the card-data change REGEN + commit all four derived feeds (effect-index / mechanics:metadata / ledger:heroes / runtime-observed); a stale feed fails its `:check`. Revert `lagn-v1.json` CRLF churn before commit.
- **Coverage cascade:** a new keyword grows the hook universe → run `sim:coverage --check`; regen the baseline with `--update-baseline` ONLY if it flags this keyword (a distinct baseline from runtime-observed, per `reference_sim_coverage_baseline_gate_distinct`). Never re-baseline to paper over an unexpected shift.
- **Determinism:** the sentinel replay is core-only and Venompool is non-core → `finalStateHash` expected unchanged. If a pin moves, investigate WHY, then dual re-pin HONESTLY (record-game-fixture sentinel + PRE_WP080_HASH constant, per `reference_hashed_g_field_dual_repin`) — never hand-edit a pin to force green, never re-route to dodge it.

## Required `// why:` Comments
- `heroKeywords.ts` entry: D-24552 — the turn-scoped draw restriction (Venompool Shenanigans).
- `economy.types.ts` `drawsLocked?`: D-24552 — omit-when-off turn-scoped draw lock; mirrors `recruitSpendableAsAttack`.
- `carryConversionFlag` extension: the draw-lock flag must survive same-turn rebuilds like the conversion flag; conditional spread keeps it ABSENT when unset (hash byte-stability).
- Both setters spread `carryConversionFlag`: so setting one turn-scoped flag never drops the other (the single-chokepoint invariant).
- `heroEffectDraw` guard: D-24552 — a `no-more-draws` card locked draws this turn; skip + `blocked` log; end-of-turn refill uses `drawCardsIntoHand` so it is exempt.
- `NO_MAGNITUDE_KEYWORDS` inclusion: the keyword carries no magnitude — a missed entry drops it at the pre-gate.

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + array
- `packages/game-engine/src/economy/economy.types.ts` — **modified** — `drawsLocked?` field
- `packages/game-engine/src/economy/economy.logic.ts` — **modified** — `carryConversionFlag` carries `drawsLocked` + new `enableDrawLock` + route `enableRecruitSpendableAsAttack` through `carryConversionFlag`
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `heroEffectNoMoreDraws` + `heroEffectDraw` guard + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS` + registration
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — handler-count drift (TWO sites: the map-count assertion ~line 103 AND the X-Gene "stays N" assertion ~line 6889) + behavior tests (draw-2-then-lock, later-draw-blocked, refill-not-blocked)
- `packages/game-engine/src/rules/heroKeywords.test.ts` — **modified** — count +1 + registration test
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — expected-array + count +1
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified** — the `HERO_KEYWORDS.length` count assertion (~line 1427, the "X-Gene is not a keyword" test): bump +1 + update its "stays N" message
- `packages/game-engine/src/economy/economy.logic.test.ts` — **modified** — carry / reset / setter tests + a setter-coexistence test (both flags survive both setters, both directions)
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — `VALID_TOKEN_PATTERN` gains `^\[keyword:no-more-draws\]$`
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 1 apply row (Shenanigans, both tokens in order)
- `data/cards/vnom.json` — **modified (regenerated)** — appended tokens
- derived feeds for `effect-index` / `mechanics:metadata` / `ledger:heroes` / `sim:runtime-observed` — **modified (regenerated)**
- (conditional) `sim:coverage` baseline — only if `sim:coverage --check` flags the new keyword

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` passes (+behavior +registration tests)
- [ ] `apply-hero-ability-markers.mjs` idempotent (re-run 0 updates); `cards:check` + `effect-index:check` + `mechanics:metadata:check` + `ledger:heroes:check` + `sim:runtime-observed:check` + `sim:coverage --check` all 0
- [ ] `grep "no-more-draws" docs/ai/coverage/hero-mechanic-ledger.csv` → Shenanigans `executable`
- [ ] `finalStateHash` fixtures unchanged (or dual-re-pinned honestly with provenance)
- [ ] Live-on-surface verification (D-24026, surface = `play.legendary-arena.com`): a live match shows Shenanigans draws 2 then a later same-turn hero draw is blocked — post-deploy STATUS-flip
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` — land D-24552 (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-731 checked off; `EC_INDEX.md` Done; mindmap `✅`; `roadmap:counts:check` 0
- [ ] `git diff --name-only` shows only the allowlist (+ regenerated data/feeds)

## Common Failure Smells
- Shenanigans draws 0 → the lock armed before the draw (marker order wrong; draw:2 must precede no-more-draws).
- A later same-turn draw still fires → the `heroEffectDraw` guard is missing, or `drawsLocked` was dropped by a rebuild not routed through `carryConversionFlag`.
- After a same-turn God-of-Thunder play the lock (or the recruit-as-attack conversion) silently vanished → a `TurnEconomy` setter still rebuilds from a literal without spreading `carryConversionFlag` (route BOTH setters through it).
- A count-assertion message reads stale (e.g. `heroKeywords.test.ts:67` "…after WP-719 covering-fire + WP-721 ko-wound (59 + …)") → update the message text alongside the count bump, not just the number.
- End-of-turn refill blocked / hand shrinks → the lock was threaded into `drawCardsIntoHand` (guard belongs in `heroEffectDraw` only).
- The lock persists into next turn → `resetTurnEconomy` is carrying it (it must rebuild fresh, no carry).
- `finalStateHash` re-pin needed unexpectedly → `drawsLocked` was seeded/always-present (make it omit-when-off).
- Drift test red → keyword in union not array (or vice versa), handler count mismatch, or a missed `NO_MAGNITUDE_KEYWORDS` entry (then the lock silently never arms).
- `sim:coverage --check` red → the new keyword grew the hook universe; regen the baseline (only if it flags this keyword) — do NOT re-baseline to hide an unrelated shift.
