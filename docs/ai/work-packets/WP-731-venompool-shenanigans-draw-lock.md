# WP-731 — Venompool "Shenanigans" turn-scoped draw-lock (`no-more-draws` keyword; Engine + Data)

**Status:** Ready
**Primary Layer:** Game Engine / Implementation + Card Data
**Dependencies:** D-24551 (the deferral this closes), WP-580 / D-24389 (`recruit-as-attack` — the turn-scoped `TurnEconomy` flag precedent this reuses), WP-021/022/023 (hero-keyword + parser + executor substrate), WP-236 / D-24051 (`drawFromPlayerDeck` / `heroEffectDraw` — the hero-effect draw chokepoint), WP-667 / D-24480 (multi-marker-per-line precedent)
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). NOT lightweight-lane eligible: adds a new `G.turnEconomy` field (determinism surface) and a new guard on a core draw chokepoint — a new mechanic category, and "any ambiguity resolves against eligibility" (01.0a).

> Baseline: `origin/main` at commit `1f8fa8f4` (WP-730 swap SPEC) + the `SPEC: reserve WP-731 / EC-768 / D-24552` ledger commit.

---

## Session Context

`vnom/venompool/shenanigans` (abilityIndex 0) reads:

> "Draw two cards. But you can't draw any more cards until the end of this turn."

It is broken two ways in committed `data/cards/vnom.json`:

1. **The base "Draw two cards" is hollow** — no marker. The draw-marker author `apply-hero-ability-markers.mjs` (`suggestDrawToken`) matches only a whole-line fixed-count draw via a `^…$` anchor; the trailing "But you can't draw…" clause defeats the `$`, so no `[keyword:draw:2]` is proposed and the card draws nothing when played.
2. **The "can't draw any more cards until the end of this turn" restriction is unmodeled** — there is no engine mechanic for a per-turn draw lock.

D-24551 fixed the sibling cumulative-draw hollows (Iron Man / Wiccan tech-draws) by marking them `[keyword:draw:N]`, and **explicitly deferred Shenanigans** as "genuinely different mechanics" because of the draw restriction. This packet adds the restriction mechanic, then marks the base draw so it fires.

---

## Goal

After this session, `@legendary-arena/game-engine` recognizes a new hero keyword `no-more-draws`. Playing a card that carries it sets a turn-scoped, lazily-materialized `G.turnEconomy.drawsLocked` flag; the hero-effect draw chokepoint `heroEffectDraw` then **skips** (draws 0, logs a `blocked` line) for the rest of that player's turn. Venompool's Shenanigans is marked `[keyword:draw:2] [keyword:no-more-draws]` (in that order) so it draws two cards and **then** arms the lock — stopping the card from being hollow while faithfully modeling the restriction.

---

## User-Visible Impact

A player who plays **Shenanigans** now draws two cards (today it draws nothing), and any subsequent hero-card draw effect they play the same turn is blocked with a clear game-log line — the "you can't draw any more cards until the end of this turn" the card promises. The lock lifts at the turn boundary, so the normal end-of-turn hand refill still happens.

---

## Assumes

- **D-24551 landed** — the two genuinely-different lines (Wiccan clairvoyance, this Shenanigans) were deferred; the 7 clean cumulative-draw lines are already marked. This packet consumes the deferral note verbatim.
- **WP-580 / D-24389 landed** — `TurnEconomy.recruitSpendableAsAttack` (an omit-when-off optional flag), `carryConversionFlag(economy)` (the single "carry a turn-scoped flag across every `TurnEconomy` rebuild" chokepoint, called at the 3 rebuild sites), `enableRecruitSpendableAsAttack`, and `resetTurnEconomy` (which rebuilds a fresh economy at onBegin and does NOT carry the flag → cleared each turn). `economy/economy.types.ts` + `economy/economy.logic.ts`.
- **The hero-effect draw chokepoint exists** — `heroEffectDraw(G, ctx, playerID, cardId, effect)` (`hero/heroEffects.execute.ts`) draws `effect.magnitude` via `drawFromPlayerDeck` and always runs for the current player. This is the `draw` keyword path — distinct from `drawCardsIntoHand` (used by the end-of-turn refill, setup, and other-seat draws), which this WP does NOT touch.
- **The hero-keyword substrate exists** — the `HeroKeyword` union + `HERO_KEYWORDS` array (`rules/heroKeywords.ts`); the executor's `HANDLED_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `NO_MAGNITUDE_KEYWORDS`, `MVP_KEYWORDS` sets (`hero/heroEffects.execute.ts`); union↔array and handler-map↔`HANDLED_KEYWORDS` drift tests.
- **The parser preserves marker order** — the generic Step-2 `KEYWORD_PATTERN` scan pushes each `[keyword:X]` in left-to-right marker order, `deduplicateKeywords` keeps first-occurrence-preserving-order, and the effect builder iterates in that order → a line's effects fire in marker order. A bare `[keyword:no-more-draws]` rides the generic scan (`{ type: 'no-more-draws' }` fallback) — no dedicated parser branch.
- **The marker pipeline exists** — `apply-hero-ability-markers.mjs` (+ `VALID_TOKEN_PATTERN`) reads `inputs/hero-ability-markers.json` and appends tokens to `data/cards/*.json`; multi-token-per-line is supported (WP-667 / War Machine D-24543 precedent). `vnom` is non-`co2e`, so it regenerates normally (`co2e` is the only hand-edited set excluded from `cards:check`).
- `pnpm -r build` exits 0; engine test + `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` green on baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `packages/game-engine/src/hero/heroEffects.execute.ts` — read `heroEffectDraw` (~line 1298): the `drawFromPlayerDeck` call, the WP-665 `G.turnEconomy.cardsDrawn += drawnCount` count site, the short-draw vs full-draw `pushLog` outcomes. The guard is a `drawsLocked` check at the TOP of this function (before the draw). Also read `HANDLED_KEYWORDS` (~line 108), `NO_MAGNITUDE_KEYWORDS` (~line 375), `MVP_KEYWORDS` (~line 332), and the `HERO_EFFECT_HANDLERS` map (~line 4658), and the existing `heroEffectRecruitAsAttack` (~line 4211) — the near-exact template for the new setter-calling handler.
- `packages/game-engine/src/economy/economy.logic.ts` — read `carryConversionFlag` (~line 493, the conditional-spread that keeps the flag ABSENT when unset so both hash oracles stay byte-stable), its 3 call sites (~562/588/614), `enableRecruitSpendableAsAttack` (~line 626), and `resetTurnEconomy` (~line 679). The draw-lock flag piggybacks this exact carry mechanism.
- `packages/game-engine/src/economy/economy.types.ts` — the `TurnEconomy` interface (~line 16) and `recruitSpendableAsAttack?` (~line 50): add `drawsLocked?: boolean;` the same way (optional, omit-when-off).
- `packages/game-engine/src/rules/heroKeywords.ts` — the `HeroKeyword` union + `HERO_KEYWORDS` array; add `'no-more-draws'` to both in lockstep.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — the generic `KEYWORD_PATTERN` scan + `isValidHeroKeyword` push and the `{ type: keyword }` effect-builder fallback. Confirm the bare token needs no new branch. Do **not** add one.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — the `VALID_TOKEN_PATTERN` alternation; add `^\[keyword:no-more-draws\]$` (`[keyword:draw:2]` is already legal from D-24551).
- `docs/ai/DECISIONS.md` — D-24551 (the deferral + marker pipeline), D-24389 (the turn-scoped-flag precedent). D-24552 is reserved in `docs/ai/NUMBER-LEDGER.md` and is landed as Active in `DECISIONS.md` at execution (not yet present there at draft time).
- User memory: `reference_hero_ability_marker_curated_map` (markers come from the curated map, not auto-detect), `reference_hashed_g_field_dual_repin` (the re-pin escape hatch this design uses), `reference_sim_coverage_baseline_gate_distinct` (a new keyword grows the hook universe → run `sim:coverage --check`, regen baseline if it flags).

---

## Non-Negotiable Constraints

- Follow `docs/ai/REFERENCE/00.6-code-style.md`: no abbreviations (Rule 4); `// why:` on every non-obvious constant / choice (Rule 6); no `.reduce()` (Rule 7/8); ESM + `node:` imports (Rule 13).
- Architecture (`.claude/rules/architecture.md`): moves/effects **never throw**; the guard is a silent-skip + log, never a throw; zones store `CardExtId` strings only; the flag lives on `G.turnEconomy` (runtime-only) — it is never persisted and never written to any `legendary.*` table.
- `no-more-draws` is added to the `HeroKeyword` union **and** `HERO_KEYWORDS` (lockstep); the handler to `HERO_EFFECT_HANDLERS` **and** `HANDLED_KEYWORDS`; **and** to `NO_MAGNITUDE_KEYWORDS` (it carries no magnitude — an unmarked `[keyword:no-more-draws]`; a missed entry silently drops it at the magnitude pre-gate and the lock never arms).
- **Draw-2-before-lock ordering is load-bearing.** The `[keyword:draw:2]` token MUST precede `[keyword:no-more-draws]` in the ability string, so the draw effect fires before the lock arms. If the lock armed first, Shenanigans' own draw-2 would be blocked by the lock it sets. A test MUST assert the draw-2 lands AND a later same-turn draw is blocked.
- **`drawsLocked` is omit-when-off.** It is set only by the setter (never seeded in `Game.setup`, never reset to a present `false`), carried across rebuilds only by the conditional-spread `carryConversionFlag`, and cleared by `resetTurnEconomy` rebuilding a fresh economy. This preserves the byte-stable hash guarantee — do NOT add an always-present `drawsLocked: false`.
- **Both `TurnEconomy` setters MUST route through `carryConversionFlag`.** `enableRecruitSpendableAsAttack` today rebuilds from an explicit literal and bypasses the carry helper — safe with one flag, but with two flags it silently drops the *other* flag whenever both are set the same turn (Venompool's Shenanigans + God of Thunder is a legal multi-hero loadout: either play order would cancel the flag set first). The fix makes `carryConversionFlag` genuinely singular — both `enableRecruitSpendableAsAttack` and the new `enableDrawLock` spread `...carryConversionFlag(economy)` and then set only their own field true. A test MUST assert the two flags COEXIST across BOTH setters (set one, call the other setter, assert both present — and the reverse).
- **Guard scope = `heroEffectDraw` only.** Do NOT thread the lock into `drawCardsIntoHand`, `endOfTurnCleanup`, setup, or the other-seat draw paths. The end-of-turn refill (lock lifts at turn end), setup deal, and other-seat draws (Covering Fire, villain each-player) route through `drawCardsIntoHand` directly and MUST stay unaffected.
- Marker edits touch only the `abilities[i]` text — no other card field.

---

## Scope

### In

- New `no-more-draws` `HeroKeyword` (union + array) — `rules/heroKeywords.ts`.
- New `drawsLocked?: boolean` field on `TurnEconomy` — `economy/economy.types.ts`.
- `carryConversionFlag` extended to also carry `drawsLocked` (conditional spread), a new `enableDrawLock(economy)` setter, **and** `enableRecruitSpendableAsAttack` + `enableDrawLock` both routed through `...carryConversionFlag(economy)` so it becomes genuinely the single carry chokepoint — `economy/economy.logic.ts`. (Today `enableRecruitSpendableAsAttack` rebuilds from a literal and bypasses the carry helper; harmless with one flag, but a silent cross-flag drop once a second flag exists — see the setter-coexistence constraint.)
- New `heroEffectNoMoreDraws` executor (calls `enableDrawLock`) + its registration in `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS`; **and** a `drawsLocked` guard at the top of `heroEffectDraw` — `hero/heroEffects.execute.ts`.
- Drift-test updates (keyword count +1; handler count +1; expected-array + registration) — the three engine test files; carry/reset/setter tests — `economy/economy.logic.test.ts`.
- New focused behavior tests: draw-2-then-lock (Shenanigans path), a later same-turn `draw` blocked, the lock cleared next turn (reset), the flag carried across a same-turn economy rebuild, and the end-of-turn refill NOT blocked.
- `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` gains `^\[keyword:no-more-draws\]$`.
- One apply row (`vnom/venompool/shenanigans` idx 0 → append `[keyword:draw:2] [keyword:no-more-draws]`) — `inputs/hero-ability-markers.json`.
- Regenerated `data/cards/vnom.json` + the derived feeds (`effect-implementation-index.json`, `card-mechanics.json`, `hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json`); `sim:coverage` baseline if the check flags the new keyword.

### Out

- No dedicated parser branch for the bare token (the generic scan handles it).
- No pending choice / resolve move / bgio move / `UIState` field / arena-client surface — the lock is a synchronous engine flag, not an interactive choice.
- **Guard breadth (a deliberate, noted faithfulness gap):** Dodge (`dodgeCard`), Do-Over (`doOver`), and a tactic/villain effect drawing FOR the active player route around `heroEffectDraw` via `drawCardsIntoHand` and are NOT blocked by v1. A comprehensive per-seat chokepoint guard is a possible future WP; it would carry a larger surface and likely a hash re-pin. The dominant real interaction (play Shenanigans, then play another draw hero) IS covered.
- No scoring / PAR / leaderboard / RNG / identity / multiplayer-sync / monetization surface.
- Wiccan clairvoyance (the other D-24551 deferral, a compound reveal-then-draw) stays deferred — different family.

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — union + array
- `packages/game-engine/src/economy/economy.types.ts` — `drawsLocked?` field
- `packages/game-engine/src/economy/economy.logic.ts` — `carryConversionFlag` (carry `drawsLocked` too) + new `enableDrawLock` + route `enableRecruitSpendableAsAttack` through `carryConversionFlag`
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `heroEffectNoMoreDraws` + `heroEffectDraw` guard + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS` + registration
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — handler-count drift (TWO sites: the map-count assertion ~line 103 AND the X-Gene "stays N" assertion ~line 6889 — bump both) + behavior tests
- `packages/game-engine/src/rules/heroKeywords.test.ts` — keyword count + registration test
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — expected-array + count
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — the `HERO_KEYWORDS.length` count assertion (~line 1427, the "X-Gene is not a keyword" test): bump the count +1 and update its "stays N" message
- `packages/game-engine/src/economy/economy.logic.test.ts` — carry / reset / setter tests
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — `VALID_TOKEN_PATTERN`
- `scripts/convert-cards/inputs/hero-ability-markers.json` — 1 apply row
- `data/cards/vnom.json` — regenerated (appended tokens)
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- (conditional) `scripts/coverage/*coverage-baseline*` — only if `sim:coverage --check` flags the new keyword

(No `finalStateHash` re-pin expected: `drawsLocked` is omit-when-off + turn-cleared and the core-only sentinel / empty PRE_WP080 replay play no Venompool. VERIFY empirically; if a pin shifts, dual re-pin honestly per `reference_hashed_g_field_dual_repin` — never edit a pin to force green.)

---

## Contract

- Keyword label `no-more-draws`; marker token `[keyword:no-more-draws]` (single segment, no magnitude).
- Flag `TurnEconomy.drawsLocked?: boolean` — set true by `enableDrawLock`, carried across rebuilds only when set (`carryConversionFlag`), cleared by `resetTurnEconomy` at onBegin.
- Executor `heroEffectNoMoreDraws(G, _ctx, _playerID, _cardId, _effect)`: `G.turnEconomy = enableDrawLock(G.turnEconomy)`; logs the lock; never throws.
- Guard: `heroEffectDraw` returns early (draws 0) with a `blocked` `pushLog` line when `G.turnEconomy.drawsLocked === true`.
- Card marker order: `[keyword:draw:2]` **before** `[keyword:no-more-draws]` on `vnom/venompool/shenanigans` idx 0.

---

## Acceptance Criteria

1. `no-more-draws` is in the `HeroKeyword` union and `HERO_KEYWORDS` (drift test count +1, order matched); `heroEffectNoMoreDraws` is in `HERO_EFFECT_HANDLERS` (+1) + `HANDLED_KEYWORDS` + `NO_MAGNITUDE_KEYWORDS`.
2. `TurnEconomy.drawsLocked` is omit-when-off: `enableDrawLock` sets it, `carryConversionFlag` carries it only when present, `resetTurnEconomy` produces an economy without it.
3. Playing Shenanigans draws exactly two cards **and then** arms the lock (draw-2-before-lock ordering).
4. A later same-turn `draw`-keyword play draws 0 and writes a `blocked` log line while `drawsLocked` is set.
5. The lock clears at the next `resetTurnEconomy` (next turn draws normally); the flag survives a same-turn economy rebuild (an intervening attack/recruit grant does not drop it); and `drawsLocked` + `recruitSpendableAsAttack` COEXIST across BOTH setters (set one, call the other setter → both present, and the reverse — both route through `carryConversionFlag`).
6. The end-of-turn hand refill, setup deal, and other-seat draws are NOT blocked (they use `drawCardsIntoHand`, not `heroEffectDraw`).
7. `data/cards/vnom.json` carries `[keyword:draw:2] [keyword:no-more-draws]` (in that order) on Shenanigans idx 0.
8. `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` all exit 0; Shenanigans reads `no-more-draws` (+ `draw`) / `executable` in the hero mechanic ledger.
9. Full `@legendary-arena/game-engine` suite green; `finalStateHash` unchanged (or dual-re-pinned honestly with provenance if it moved).

---

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0; `pnpm --filter @legendary-arena/game-engine test` → all pass.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → "Updated 1 line"; re-run → 0 updates (idempotent).
3. `pnpm cards:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → all 0.
4. `grep "no-more-draws" docs/ai/coverage/hero-mechanic-ledger.csv` → Shenanigans `executable`.
5. `git diff --name-only` shows only the allowlist (+ regenerated data/feeds); confirm `finalStateHash` fixtures unchanged (or re-pinned with a one-line provenance); `lagn-v1.json` CRLF churn reverted.

---

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `git diff --name-only` = the allowlist only.
- [ ] D-24552 flipped Active in `DECISIONS.md`; WORK_INDEX row checked; EC_INDEX Done; mindmap node `✅`; `roadmap:counts:check` 0.
- [ ] **D-24026 live-verify (post-merge, REQUIRED):** in a live match on `play.legendary-arena.com`, playing Venompool's Shenanigans draws two cards and a subsequent same-turn hero draw is blocked with the log line (verified against the deployed `/api/version` gitSha). Inherently post-deploy; recorded as a follow-up STATUS-flip, not a merge blocker.

---

## Lint Gate Self-Review (00.3)

All 21 sections resolved:

- **§1–3 (identity / status / layer):** `## Goal`, `## Assumes`, `## Context (Read First)` present; `**User-Visible Surface:** play.legendary-arena.com` + `## User-Visible Impact` present. Layer = Game Engine + Card Data (single runtime layer).
- **§4 (scope closed):** `## Scope (In)/(Out)` is a closed enumeration; the allowlist matches EC-768 `Files to Produce`. The guard-breadth gap is named in Scope (Out).
- **§5 (dependencies):** D-24551 + WP-580/D-24389 + the hero-keyword substrate + `heroEffectDraw` all landed on baseline (verified — `recruit-as-attack`/`carryConversionFlag`/`heroEffectDraw` present).
- **§6–8 (contract / AC / verification):** present and testable.
- **§9–12 (determinism / persistence / layer / RNG):** the flag is a runtime-only `turnEconomy` field, omit-when-off + turn-cleared → `finalStateHash` unchanged (core-only sentinel; non-core card); no persistence write; no RNG (guard adds none); no layer crossing.
- **§13 (00.6 ref):** cited in Non-Negotiable Constraints.
- **§14–20 (canonical field names / no invented mechanics / no reduce / drift lockstep / marker-only card edits / gate regen / no client):** honored — the mechanic is faithful to the printed card; drift arrays + counts in lockstep; card edits append markers only; all four card-derived feeds regenerated; no client surface.
- **§21 (API catalog / D-11804):** N/A — no HTTP endpoint or `apps/server` library surface changes.
- **Live-verify DoD item:** present (D-24026, post-merge).

**Verdict:** all sections PASS or justified N/A.

## Pre-flight (01.4)

Run as an independent gate subagent against live code on this branch (synced to
`origin/main`). Every mechanic-level claim verified TRUE: `heroEffectDraw`
(`heroEffects.execute.ts:1298`) is the `draw`-keyword path, distinct from
`drawCardsIntoHand`; `carryConversionFlag` (`economy.logic.ts:493`) is the single
conditional-spread carry chokepoint (3 sites) and `resetTurnEconomy` (line 679)
does not carry it; the end-of-turn refill, setup deal, and other-seat draws
(Covering Fire, villain each-player) plus Dodge/Do-Over all call
`drawCardsIntoHand` directly (guard-scope claim holds); the parser preserves
marker order so `draw:2` fires before `no-more-draws`; `computeStateHash`
(`replay.hash.ts:67`) hashes whole-G-minus-`diagnostics` so an omit-when-off
field is byte-stable; the card line is unmarked as stated; deps D-24551 + WP-580/
D-24389 present; `MVP_KEYWORDS` auto-derives from `HANDLED_KEYWORDS`.

**PS-1 (blocking, FIXED):** a third `HERO_KEYWORDS.length` drift assertion at
`packages/game-engine/src/setup/heroAbility.setup.test.ts:1427` (the "X-Gene is
not a keyword" count test) was missing from the allowlist — adding the keyword
breaks it, forcing a scope violation or a red suite. Fixed: that file is now in
`§Files Expected to Change` (WP) and `§Files to Produce` (EC), and the
`heroEffects.execute.test.ts` entry now names both count-assertion sites (~103
and ~6889). Allowlist-only amendment — no mechanic-scope change.

**RS-1 (clarifying, addressed):** `§Context` wording corrected — D-24552 is
reserved in `NUMBER-LEDGER.md` and lands Active in `DECISIONS.md` at execution.

**Verdict: READY TO EXECUTE** (after the PS-1 allowlist amendment).

## Copilot (01.7)

Run as an independent gate subagent (30-mode audit) against the WP + EC +
pre-flight report. First pass returned **RISK / HOLD** on one substantive,
scope-neutral defect (#6/#11/#4): the WP's "`carryConversionFlag` is the single
carry chokepoint" premise was false — `enableRecruitSpendableAsAttack` rebuilds
`TurnEconomy` from an explicit literal and bypasses the carry helper, so adding a
second flag would silently drop the *other* flag whenever both are set the same
turn (Venompool's Shenanigans + God of Thunder is a legal loadout, either play
order). Fixed in-place (scope-unchanged, both edits within the already-allowlisted
`economy.logic.ts` + `economy.logic.test.ts`): both setters now route through
`...carryConversionFlag(economy)` (making it genuinely singular), and a required
setter-coexistence test (both flags, both directions) pins the invariant so the
drop cannot pass CI. WP §Scope/§Constraints/§Files/AC-5 and EC §Locked Values/
§Guardrails/§Required Comments/§Files/§Smells all updated; the stale
`heroKeywords.test.ts:67` count-message note added.

**Re-run verdict: PASS** — all RISK findings remediated; all first-pass PASS
confirmations (guard-breadth honesty, determinism/re-pin fallback, drift lockstep
across all four count sites, marker-order guard, lane classification, gate
obligations) intact. Session-prompt + commit authorized.
