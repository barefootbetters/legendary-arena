# WP-286 — One-Hit Wonder: Interactive "Draw a card OR Empowered" Choose-One Form (Engine)

**Status:** Ready to Execute
**Layer:** Game Engine (`packages/game-engine`) + card data (`data/cards`, `scripts/convert-cards`)
**Depends on:** WP-248 ✅, WP-283 ✅, WP-285 ✅, WP-256 ✅
**EC:** EC-318
**Decisions:** D-24069, D-24070
**User-Visible Surface:** none — infrastructure (engine-only; bot-resolved; the human picker UX is the co-release-locked sibling WP-287)

---

## Goal

`antm/wonder-man/one-hit-wonder` reads "Choose one: Draw a card, or you get Empowered by
[strength]," but the engine never offers the choice — it silently applies Empowered every time
(the player's report, diagnostics `gitSha f1f8f67`). Two faults compound: (1) the card text has a
typo, "**Chose** one:", that misses the WP-283 choose-one prefix gate; and (2) even spelled
correctly, the WP-283 choose-one path matches only the *two-empowered-markers* shape
(fight-or-flight), not "Draw a card OR a single Empowered." So the line falls through to the core
empowered path, which applies Empowered unconditionally and drops the draw alternative and the
player's choice.

This WP builds the **interactive draw-or-empowered pending-choice infrastructure** (mirroring the
WP-248 `optional-ko-reward` topology) and wires One-Hit Wonder as its first consumer. After this WP
executes:

- The "Chose one" typo is corrected to "Choose one" in both `data/cards/antm.json` and the source
  `scripts/convert-cards/inputs/cards/antman.js`.
- The setup parser recognizes the "Choose one: Draw a card … [keyword:Empowered] by [hc:X]" shape
  and emits a `draw-or-empowered` hero effect carrying the empowered hero class, suppressing the
  core empowered path for that line.
- Playing One-Hit Wonder parks a `PendingDrawOrEmpowered` entry on `G.pendingDrawOrEmpowered`
  (FIFO queue, lazy-init, never in `Game.setup()`).
- A new move `resolveDrawOrEmpowered({ choice })` lets the active player (or bot) pick `'draw'`
  (reuses the existing draw executor) or `'empowered'` (reuses the existing empowered composition).
- Block-all guards at all 8 standard sites prevent any other move from firing while a pending
  choice is outstanding.
- The bot auto-resolves deterministically (always `'empowered'`; a smarter expected-value default
  is deferred).

---

## Assumes

- **WP-248 ✅** (D-24019 Active) — `G.pendingOptionalKoRewards` FIFO pending-choice infrastructure
  established the exact topology this WP mirrors: lazy-init at the park site, block-all guards,
  a `resolve*` move that dispatches its effect via `executeSingleEffect`, a `hasPending*` helper,
  and a bot default in `ai.legalMoves.ts`. `resolveOptionalKoReward` in
  `packages/game-engine/src/moves/optionalKoReward.resolve.ts` is the file to mirror.
- **WP-283 ✅** (D-24063 Active) — added the choose-one Empowered pre-pass
  (`tryResolveEmpoweredChooseOneLine`) and the `EMPOWERED_CHOOSE_ONE_PREFIX_PATTERN`
  (`/^\s*Choose one\s*:/i`) in `packages/game-engine/src/setup/heroAbility.setup.ts`. That path
  matches the *two-empowered-markers* form only; this WP adds a sibling pre-pass for the
  *draw + single-empowered* form, running before the core empowered dispatch.
- **WP-285 ✅** (D-24067, D-24068 Active) — `PendingVictoryPileCardPick` is the freshest
  pending-choice precedent; `HERO_KEYWORDS` is currently 21 entries (the 21st is
  `'victory-villain-attack'`); the 8 block-all guard sites listed below were last confirmed by it.
- **WP-256 ✅** — the primitive-effect interpreter. `buildEmpoweredComposition(heroClass)`
  (`packages/game-engine/src/rules/heroCompositions.ts:64`) builds the empowered `EffectNode`, and
  `interpretHeroPrimitiveEffect(G, ctx, playerID, node)`
  (`packages/game-engine/src/hero/effectPrimitive.interpret.ts:550`) executes it. The
  `'empowered'` branch of the new move reuses both — it does not re-implement the count.
- **`executeSingleEffect(G, context, playerID, sourceCardId, descriptor)`** —
  exported from `packages/game-engine/src/hero/heroEffects.execute.ts`; the `'draw'` branch of the
  new move dispatches `{ type: 'draw', magnitude: 1 }` through it (no re-implementation), exactly
  as `resolveOptionalKoReward` dispatches its reward.
- **`HeroEffectDescriptor`** (`packages/game-engine/src/rules/heroAbility.types.ts:99`) — additive
  optional fields are the established extension pattern (WP-248 `rewardType?`, WP-253
  `revealCount?`/`revealRules?`). This WP adds `empoweredClass?: string` to carry the parsed hero
  class from parse-time to the park site.
- **`one-hit-wonder` card** in `data/cards/antm.json` — ability text:
  `"Chose one: Draw a card, or you get [keyword:Empowered] by [hc:strength]."`. The source is
  `scripts/convert-cards/inputs/cards/antman.js` (the `"Chose one: Draw a card, or you get "`
  fragment). `data/cards/antm.json` is the runtime-loaded artifact; the source keeps a regen stable.
- **Block-all guard sites** — as of WP-285, the 8 sites that gate a move behind any pending choice:
  1. `packages/game-engine/src/game.ts` (`advanceStage` — this is also the turn-progression guard)
  2. `packages/game-engine/src/moves/coreMoves.impl.ts` (`drawCards`)
  3. `packages/game-engine/src/moves/fightVillain.ts`
  4. `packages/game-engine/src/moves/fightMastermind.ts`
  5. `packages/game-engine/src/moves/recruitHero.ts`
  6. `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`
  7. `packages/game-engine/src/moves/dodgeCard.ts`
  8. `packages/game-engine/src/moves/playFromUndercover.ts`

---

## Context

The bug was reported from a live match on play.legendary-arena.com (diagnostics
`legendary-arena-diagnostics-empower.json`, `gitSha f1f8f67`, 2026-06-24): One-Hit Wonder "just
defaults to empowered" with no choice offered. Tracing the parser
(`packages/game-engine/src/setup/heroAbility.setup.ts`):

- The choose-one pre-pass (`tryResolveEmpoweredChooseOneLine`, line ~926) gates on
  `EMPOWERED_CHOOSE_ONE_PREFIX_PATTERN = /^\s*Choose one\s*:/i` (line 157) AND requires
  **exactly 2** `[keyword:Empowered]` markers (line 937). One-Hit Wonder fails the prefix (typo
  "Chose one") and has only **1** empowered marker plus a "Draw a card" option — it fails both gates.
- The line then falls through to `tryResolveEmpoweredCore` (line ~800), which matches the trailing
  `by [hc:strength]` and applies Empowered unconditionally. The comment at lines 410–412 even names
  `one-hit-wonder` as the baseline core-path case; the regression test feeds a *synthetic* clean
  `"You get [keyword:Empowered] by [hc:strength]."` string under the slug, so the real card text was
  never exercised. The hollow detector cannot catch this — the marker *did* resolve, just wrongly.

**Why interactive, not oracle:** WP-283's choose-one auto-resolves via "oracle-max" — it picks the
strictly-better of two *empowered classes*. Draw-vs-empowered is heterogeneous (a card draw vs an
attack bonus); an oracle cannot cleanly compare them, and the player's report ("I'm never given the
option") is an explicit ask for a genuine choice. The mature `pendingHeroChoice` family
(WP-242/248/285) already models interactive choices with a deterministic bot fallback, so the
interactive path costs no new architecture. Recorded as D-24069.

**Why one WP, not two (within the engine layer):** the block-all guard additions are mechanical
one-liners inseparable from the pending-choice type they guard. The parser branch + descriptor
field + park site + move + guards + bot default are a single cohesive engine unit; splitting at
"types vs. consumers" produces an unusable stub. The WP-248 and WP-285 precedents reasoned the same.
The **client picker UX is a separate layer** and is the co-release-locked sibling WP-287 (below).

**⚠ Co-release / deploy hazard (load-bearing):** `antm/wonder-man` is in live hero decks — this very
bug came from a live match. Render auto-deploys on every `main` push. If the engine ships without
WP-287's client prompt, a human who plays One-Hit Wonder parks a `PendingDrawOrEmpowered` the client
cannot render, and the block-all guard wedges their turn (no End Turn until resolved). Therefore
WP-286 and WP-287 are **co-release-locked**: the engine MUST NOT reach a deploy of
play.legendary-arena.com without WP-287. Merge both in the same deploy window (mirrors WP-248↔WP-249,
whose `optional-ko-reward` also lives in a live deck).

**finalStateHash:** Expected unchanged. The sentinel board uses only `core/*` heroes; no `antm` card
is in the sentinel fixture, so no `pendingDrawOrEmpowered` is ever parked during a sentinel replay.
Executor must confirm empirically.

---

## Context (Read First)

1. `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative), §The Rule Execution Pipeline,
   §Move Validation Contract, §The Turn Stage Cycle
2. `.claude/rules/architecture.md` — Layer Boundary enforcement
3. `.claude/rules/code-style.md` — No `.reduce()` in zone/effect operations; `for...of` required
4. `docs/ai/REFERENCE/00.6-code-style.md` — Full style guide
5. `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical field names (card ability text,
   `ext_id`, hero-class slugs)
6. `docs/ai/DECISIONS.md` — D-24019 (optional-ko-reward, the pending-choice precedent), D-24063
   (WP-283 choose-one pre-pass), D-24067 (WP-285 pending-choice), D-24030 (closed-union drift rule),
   D-24069 (this WP's pending-choice decision), D-24070 (this WP's keyword + card-data decision)
7. `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — the move to mirror exactly
8. `packages/game-engine/src/setup/heroAbility.setup.ts` — `tryResolveEmpoweredChooseOneLine`
   (pre-pass to sibling), `tryResolveEmpoweredCore`, the keyword-emit path
9. `packages/game-engine/src/hero/heroEffects.execute.ts` — park-site dispatch + `executeSingleEffect`
10. `packages/game-engine/src/hero/effectPrimitive.interpret.ts` — `interpretHeroPrimitiveEffect`
11. `packages/game-engine/src/rules/heroCompositions.ts` — `buildEmpoweredComposition`
12. `packages/game-engine/src/simulation/ai.legalMoves.ts` — short-circuit + bot-default pattern
13. `packages/game-engine/src/rules/heroKeywords.ts` — current union + array (21 entries)
14. `packages/game-engine/src/rules/heroAbility.types.ts` — `HeroEffectDescriptor`
15. `data/cards/antm.json` + `scripts/convert-cards/inputs/cards/antman.js` — the typo source

---

## Scope (In)

- Correct the typo `"Chose one"` → `"Choose one"` on `one-hit-wonder` in **both**
  `data/cards/antm.json` and `scripts/convert-cards/inputs/cards/antman.js`.
- Add `PendingDrawOrEmpowered` interface + `pendingDrawOrEmpowered?: PendingDrawOrEmpowered[]` field
  to `types.ts`.
- Add `'draw-or-empowered'` to `HERO_KEYWORDS` union + array (21 → 22).
- Add `empoweredClass?: string` to `HeroEffectDescriptor` (`rules/heroAbility.types.ts`).
- New parser detection `tryResolveDrawOrEmpoweredLine` in `setup/heroAbility.setup.ts`: gate on the
  `Choose one:` prefix + a "Draw a card" draw option + exactly one `[keyword:Empowered] by [hc:X]`
  marker; on match, emit a `draw-or-empowered` descriptor carrying `empoweredClass = X` and suppress
  the per-token empowered path for the line (mirrors the existing choose-one suppression).
- Park site in `hero/heroEffects.execute.ts` (`'draw-or-empowered'` onPlay case): push a
  `PendingDrawOrEmpowered { playerID, empoweredClass }`.
- New move file `moves/drawOrEmpowered.resolve.ts`: `resolveDrawOrEmpowered({ choice })` move +
  `hasPendingDrawOrEmpowered(G)` helper.
- New test file `moves/drawOrEmpowered.resolve.test.ts`.
- Move registration + `advanceStage` block-all guard in `game.ts`.
- Block-all guard at the 7 additional sites (listed in Assumes).
- Bot auto-resolve in `simulation/ai.legalMoves.ts` (short-circuit + deterministic `'empowered'`).
- Drift test update in `rules/heroKeywords.test.ts` (array length 21 → 22; new entry present).
- Move-registration drift test in `game.test.ts` (move count N → N+1; `'resolveDrawOrEmpowered'`
  in the set).
- Parser test update in `setup/heroAbility.setup.test.ts` (the draw-or-empowered shape resolves to
  the new descriptor; the core empowered baseline is untouched).

## Out of Scope

- **Client picker UI** — no `PendingDrawOrEmpowered` surfaces in `apps/arena-client`; the bot
  resolves all picks automatically. The player-facing panel is the co-release-locked sibling WP-287.
- **The xmen "Choose one: Draw a card or you get +2[icon:attack]" card**
  (`data/cards/xmen.json:2965`) — a *draw-or-flat-attack* sibling form with the same "Chose one"
  typo but no empowered marker. It is a different effect family and is deferred to a future WP; this
  WP does not touch `xmen.json`.
- **The fight-or-flight two-empowered choose-one path** (WP-283) — untouched; the new pre-pass runs
  beside it, not over it.
- **A smarter expected-value bot default** — the bot always picks `'empowered'` here; an EV-aware
  default (draw when the empowered amount is low) is deferred to competent-AI tuning.
- **Full card-data pipeline regeneration** — only the two typo edits are made; the multi-stage
  pipeline (`reference_card_pipeline_multistage`) is not re-run.

---

## Files Expected to Change

**New files** (`packages/game-engine/src/`):

- `moves/drawOrEmpowered.resolve.ts` — **new**: `resolveDrawOrEmpowered` move + `hasPendingDrawOrEmpowered`
- `moves/drawOrEmpowered.resolve.test.ts` — **new**: tests for the move + helper

**Modified files** (`packages/game-engine/src/`):

- `types.ts` — modified: add `PendingDrawOrEmpowered` interface + `pendingDrawOrEmpowered` G field
- `rules/heroKeywords.ts` — modified: add `'draw-or-empowered'` (union + array, 21 → 22)
- `rules/heroKeywords.test.ts` — modified: drift test (array length 21 → 22, new entry)
- `rules/heroAbility.types.ts` — modified: add `empoweredClass?: string` to `HeroEffectDescriptor`
- `setup/heroAbility.setup.ts` — modified: `tryResolveDrawOrEmpoweredLine` pre-pass + dispatch
- `setup/heroAbility.setup.test.ts` — modified: draw-or-empowered parse tests + core baseline pin
- `hero/heroEffects.execute.ts` — modified: `'draw-or-empowered'` onPlay park case
- `game.ts` — modified: move registration + `advanceStage` block-all guard
- `moves/coreMoves.impl.ts` — modified: `drawCards` block-all guard
- `moves/fightVillain.ts` — modified: block-all guard
- `moves/fightMastermind.ts` — modified: block-all guard
- `moves/recruitHero.ts` — modified: block-all guard
- `villainDeck/villainDeck.reveal.ts` — modified: block-all guard
- `moves/dodgeCard.ts` — modified: block-all guard
- `moves/playFromUndercover.ts` — modified: block-all guard
- `game.test.ts` — modified: move count N → N+1, `'resolveDrawOrEmpowered'` in move-name set
- `simulation/ai.legalMoves.ts` — modified: `hasPendingDrawOrEmpowered` short-circuit + bot default

**Card data:**

- `data/cards/antm.json` — modified: `"Chose one"` → `"Choose one"` on `one-hit-wonder`
- `scripts/convert-cards/inputs/cards/antman.js` — modified: same typo fix at source

**Note on file count:** 20 code/test files + 2 data files exceeds the ~8-file split guidance in §5.
The 8 block-all guard additions are mechanical one-liner imports + guard insertions inseparable from
the pending-choice type they guard. The pattern is identical to WP-248 (25 files) and WP-285 (18
files). No layer boundary is crossed (engine + its own card data; the UX layer is WP-287).

---

## Non-Negotiable Constraints

### Engine-wide
- Every new or modified file must be written in full — no diffs, no snippets, no "show only the
  changed section." Every line of every file.
- ESM only (`import`/`export`). Node.js v22+. No CommonJS.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English names, `for...of` loops,
  no `.reduce()` in zone or effect operations, JSDoc on every function, `// why:` on every
  non-obvious decision, no nested ternaries.
- All randomness via `ctx.random.*` — never `Math.random()` (D-3701). The `'draw'` branch reuses the
  existing draw executor, which sources its reshuffle from `ctx.random`.
- `G` is runtime-only: never persist, serialize, or store it.
- Moves never throw. Only `Game.setup()` may throw.
- All zones store `CardExtId` strings only.

### Packet-specific
- `PendingDrawOrEmpowered` is **lazy-init only** — never initialized in `Game.setup()`;
  `G.pendingDrawOrEmpowered` is `undefined` by default and created on first park.
- `hasPendingDrawOrEmpowered(G)` returns `false` for both `undefined` and `[]`.
- Block-all guards must call `hasPendingDrawOrEmpowered` from the new resolve file — never inline
  the check.
- **Queue integrity:** `pendingDrawOrEmpowered` is a strict FIFO queue — reads access index `[0]`,
  pushes append, removal uses `.shift()`. No `null` entries; every entry carries `playerID` and
  `empoweredClass`. Multiple entries resolve in insertion order.
- **The `'draw'` branch reuses `executeSingleEffect` with `{ type: 'draw', magnitude: 1 }`** — never
  re-implement card draw.
- **The `'empowered'` branch reuses `buildEmpoweredComposition(front.empoweredClass)` executed via
  `interpretHeroPrimitiveEffect`** — never re-implement the count-by-class evaluation.
- The new parser pre-pass must run **before** the per-token empowered dispatch and, on match,
  suppress it for that line (mirroring `processedAsChooseOne`), so One-Hit Wonder no longer falls
  through to `tryResolveEmpoweredCore`.
- The new pre-pass must **not** alter the WP-283 two-empowered choose-one path or the core empowered
  path for any other card (gated strictly to the draw + single-empowered shape).
- The bot default is deterministic — always `'empowered'`, no `ctx.random.*`.

### Session protocol
- If any file in `## Files Expected to Change` does not exist as expected, STOP and report. Do not
  create a placeholder.
- If any `// why:` comment location is unclear, STOP and ask.
- After implementation, run `pnpm --filter @legendary-arena/game-engine test` and confirm passing
  before reporting done.

### Locked contract values
- New keyword literal: `'draw-or-empowered'` (exact, no variant spellings)
- New pending-choice type name: `PendingDrawOrEmpowered` (exact)
- New G field name: `pendingDrawOrEmpowered` (exact)
- New move name: `resolveDrawOrEmpowered` (exact)
- New move file: `moves/drawOrEmpowered.resolve.ts` (exact)
- Helper name: `hasPendingDrawOrEmpowered` (exact)
- New descriptor field: `empoweredClass` (exact; optional `string`)
- New parser function: `tryResolveDrawOrEmpoweredLine` (exact)
- Move args shape: `{ choice: 'draw' | 'empowered' }` (exact)
- Pending entry fields: `{ playerID: string, empoweredClass: string }` (exact)
- Typo correction: `"Chose one"` → `"Choose one"` (exact; only the `one-hit-wonder` line)
- HERO_KEYWORDS length after: `22` (was 21 post-WP-285)

---

## Acceptance Criteria

- **AC-1:** `data/cards/antm.json` `one-hit-wonder` ability text reads `"Choose one: Draw a card,
  or you get [keyword:Empowered] by [hc:strength]."`; `scripts/convert-cards/inputs/cards/antman.js`
  carries the same corrected fragment. No other card text changes.
- **AC-2:** `heroKeywords.test.ts` drift test passes with 22 entries; `HERO_KEYWORDS` includes
  `'draw-or-empowered'`.
- **AC-3:** Parser — One-Hit Wonder's corrected text resolves to a single `draw-or-empowered`
  effect with `empoweredClass === 'strength'`, and produces **no** core empowered `primitiveEffects`
  entry and **no** `empowered` unresolved marker for that line.
- **AC-4:** Parser baseline pin — the synthetic core form `"You get [keyword:Empowered] by
  [hc:strength]."` still resolves to the core empowered composition (`count-cards-by-class-in-zone`),
  unchanged; the fight-or-flight two-empowered choose-one form still resolves via the WP-283 path.
- **AC-5:** Park site — playing a `draw-or-empowered` card pushes one
  `PendingDrawOrEmpowered { playerID, empoweredClass }`; `G.pendingDrawOrEmpowered` is lazy-init.
- **AC-6:** `hasPendingDrawOrEmpowered` returns `false` for `undefined` and `[]`, `true` for a
  non-empty array.
- **AC-7:** `resolveDrawOrEmpowered({ choice: 'draw' })` — the front entry's player draws exactly
  one card (via `executeSingleEffect` `{ type: 'draw', magnitude: 1 }`); the front entry is popped.
- **AC-8:** `resolveDrawOrEmpowered({ choice: 'empowered' })` — grants the empowered amount for the
  front entry's `empoweredClass` (via `buildEmpoweredComposition` + `interpretHeroPrimitiveEffect`),
  equal to the core empowered path's amount for the same board; the front entry is popped.
- **AC-9:** Move returns silently (no `G` mutation) when `hasPendingDrawOrEmpowered(G)` is false.
- **AC-10:** Move returns silently when `choice` is neither `'draw'` nor `'empowered'`.
- **AC-11:** Move returns silently when the FIFO front entry's `playerID` ≠ the caller's `playerID`;
  the queue is left intact.
- **AC-12:** Queue integrity — after a successful resolve, exactly one entry is removed via
  `.shift()`; with ≥2 entries, successive resolves consume entries in insertion order and the second
  entry is untouched after the first.
- **AC-13:** `game.test.ts` drift test passes with move count N+1; `'resolveDrawOrEmpowered'` is in
  the exact move-name set.
- **AC-14:** All 8 block-all guard sites import `hasPendingDrawOrEmpowered` and return silently when
  it is true.
- **AC-15:** Bot default — when `hasPendingDrawOrEmpowered` is true, `ai.legalMoves.ts` returns
  exactly one move: `resolveDrawOrEmpowered` with `{ choice: 'empowered' }` (deterministic; no
  `ctx.random.*`).
- **AC-16:** No partial mutation — if any validation step in the move fails, it returns before
  drawing, granting attack, or shifting the queue.

---

## Failure Boundaries

The following conditions must never mutate `G`. The move returns `void` immediately on any failure
(per `ARCHITECTURE.md §Move Validation Contract`):

| Condition | Required behavior |
|---|---|
| `G.pendingDrawOrEmpowered` is `undefined` or `[]` | Silent return, no state change |
| `choice` is neither `'draw'` nor `'empowered'` | Silent return, no state change |
| FIFO front entry's `playerID` ≠ caller's `playerID` | Silent return, queue intact |

No partial mutation is permitted on any failure path. The park-site no-op (a `draw-or-empowered`
effect whose `empoweredClass` is absent — should never happen post-parse) is a logged no-op and
parks nothing.

---

## Verification Steps

```pwsh
# 1. Game engine tests — all must pass
pnpm --filter @legendary-arena/game-engine test
# Expected: all pass; test count increases by at least 12 from the WP-285 baseline

# 2. Full monorepo build + test
pnpm -r build
pnpm test
# Expected: all packages build; all tests pass

# 3. TypeScript typecheck
pnpm --filter @legendary-arena/game-engine exec tsc --noEmit
# Expected: 0 errors

# 4. Move-name drift check (spot-check)
#    grep resolveDrawOrEmpowered in game.ts moves registration — expected exactly once

# 5. Keyword drift check (spot-check)
#    grep 'draw-or-empowered' in heroKeywords.ts — expected in both the union and the array

# 6. Block-all guard check (spot-check)
#    grep hasPendingDrawOrEmpowered in the 8 guard sites — expected found in each

# 7. Typo-fix check (spot-check)
#    grep "Chose one" in data/cards/antm.json — expected zero matches
```

---

## Vision Alignment

**Touched surfaces (§17.1):**
- Card data / content semantics (Vision §1, §2) — correcting `one-hit-wonder` ability text
- Determinism / RNG sourcing (Vision §3, §8) — a new move; the `'draw'` branch uses `ctx.random`

**Clause check:**
- §1 (faithful to the physical game): the printed card reads "Choose one: Draw a card, or you get
  Empowered by Strength." This WP implements that choice exactly — restoring fidelity the silent
  empowered default broke. No conflict.
- §2 (card-accurate effect execution): the typo fix + parser recognition let the engine build the
  correct hook for the printed text. No conflict.

**Conflict assertion:** No conflict — this WP preserves all touched clauses.

**Non-Goal proximity:** No NG-1..7 crossed. No monetization, pay-to-win, cosmetics, scoring, or
identity surfaces.

**Determinism preservation:** The new move is deterministic. The `'draw'` branch reuses the existing
draw executor (reshuffle via `ctx.random`, replay-faithful); the `'empowered'` branch reuses
`buildEmpoweredComposition` + `interpretHeroPrimitiveEffect` (no randomness). The bot default is
deterministic (always `'empowered'`; no `ctx.random.*`). `finalStateHash` is expected unchanged
because the sentinel board uses only `core/*` heroes (executor must confirm).

**State mutation scope:** The move mutates exactly: the resolving player's zones (the `'draw'`
branch, via the draw executor) **or** `G.turnEconomy.attack` (the `'empowered'` branch, via the
interpreter), plus `G.pendingDrawOrEmpowered` (front entry removed via `.shift()`). No other `G`
fields are mutated by the move itself.

---

## Funding Surface Gate

**N/A** — this WP adds engine infrastructure and corrects card data text. No UI surfaces, no
user-visible copy, no funding channels, no global-nav or registry-viewer affordances are introduced.
None of the §20.1 trigger surfaces are present.

---

## §21 API Catalog

**N/A** — this WP adds a boardgame.io move, not an HTTP endpoint or `apps/server` library function.
No `apps/server/src/**` surfaces are added or modified. No entry in
`docs/ai/REFERENCE/api-endpoints.md` is required.

---

## Lint Gate Self-Review

| § | Status | Notes |
|---|---|---|
| §1 Structure | ✅ PASS | All required sections present |
| §2 Constraints | ✅ PASS | Engine-wide + packet-specific + session protocol + locked values |
| §3 Assumes | ✅ PASS | WP-248/283/285/256 deps; reuse points + 8 guard sites listed |
| §4 Context | ✅ PASS | ARCHITECTURE.md, DECISIONS.md, 00.2, 00.6, source files cited |
| §5 Files | ✅ PASS | All 22 files listed with new/modified + descriptions; file-count rationale noted |
| §6 Naming | ✅ PASS | Canonical names; `ext_id`, hero-class slugs, ability-text field unchanged |
| §7 Dependencies | ✅ PASS | No new npm deps |
| §8 Boundaries | ✅ PASS | Game engine + its card data only; UX is the separate WP-287 |
| §9 Windows | ✅ PASS | `pwsh` verification steps; no Unix-only commands |
| §10 Env Vars | ✅ PASS | No new env vars |
| §11 Auth | N/A | No authentication surfaces |
| §12 Tests | ✅ PASS | `node:test`, `makeMockCtx`, no boardgame.io imports |
| §13 Verification | ✅ PASS | Exact `pnpm` commands with expected output |
| §14 AC Quality | ✅ PASS | 16 binary, observable, specific items |
| §15 DoD | ✅ PASS | STATUS.md, DECISIONS.md, WORK_INDEX.md included; D-24026 declared N/A infrastructure |
| §16.1 Abstraction | ✅ PASS | Helper appears at 8 guard sites + the bot + the move |
| §16.2 Control flow | ✅ PASS | `for...of` mandated; no nested ternaries or branching reduce() |
| §16.3 Names | ✅ PASS | Full English names; no abbreviations |
| §16.4 Functions | ✅ PASS | JSDoc required; ≤30 lines mandated |
| §16.5 Comments | ✅ PASS | `// why:` required on lazy-init, guards, bot default, pre-pass suppression |
| §16.6 Imports | ✅ PASS | Named imports only; no `import *` |
| §16.7 Errors | ✅ PASS | Full sentences required |
| §17 Vision | ✅ PASS | Triggered (card data + determinism); §1, §2, §3, §8 cited; determinism line present |
| §18 Grep/Prose | ✅ PASS | No literal-string grep gate restates a forbidden token in adjacent prose |
| §19 HEAD Staleness | N/A | Not a repo-state-summarizing artifact |
| §20 Funding | ✅ PASS | N/A with justification (no §20.1 surfaces) |
| §21 API Catalog | ✅ PASS | N/A with justification (no HTTP endpoints or server library functions) |

**Lint gate verdict: ALL PASS — ready for pre-flight.**

---

## Pre-flight Verdict

**READY TO EXECUTE**

- ✅ WP-248 Done (D-24019 Active; `G.pendingOptionalKoRewards` + `optionalKoReward.resolve.ts`
  confirmed — the move to mirror)
- ✅ WP-283 Done (D-24063 Active; `tryResolveEmpoweredChooseOneLine` + prefix gate confirmed in
  `heroAbility.setup.ts`)
- ✅ WP-285 Done (block-all guards confirmed at 8 sites; `HERO_KEYWORDS` at 21; new entry 22 =
  `'draw-or-empowered'`)
- ✅ WP-256 reuse points confirmed: `buildEmpoweredComposition` (`heroCompositions.ts:64`),
  `interpretHeroPrimitiveEffect` (`effectPrimitive.interpret.ts:550`),
  `executeSingleEffect` (`heroEffects.execute.ts`)
- ✅ One-Hit Wonder typo confirmed in `data/cards/antm.json` and `scripts/convert-cards/inputs/cards/antman.js`
- ✅ Scope locked: 20 code/test files + 2 data files; no layer crossing (UX is WP-287)
- ✅ No sentinel board impact expected (core-only heroes; executor must confirm `finalStateHash`)
- ✅ Ambiguity resolved: interactive choice (D-24069), reuse not re-implement for both branches,
  bot default deterministic `'empowered'`

---

## Copilot Check Verdict

**PASS**

No failure modes detected from the standard 30-mode audit. Key points:
- Direct structural mirror of WP-248 (FIFO pending-choice, block-all guards, bot default, reuse via
  `executeSingleEffect`)
- The new parser pre-pass is strictly gated (prefix + draw option + exactly one empowered marker) and
  suppresses the core path only for the matched line — the WP-283 and core empowered paths are pinned
  by AC-4
- The typo fix is the load-bearing data change; without it the prefix gate never matches
- Co-release / Render-auto-deploy wedge hazard surfaced explicitly (WP-287 lock)
- Determinism preserved; lint gate all-pass

---

## Definition of Done

- [ ] All 16 Acceptance Criteria pass (AC-1..16)
- [ ] `pnpm --filter @legendary-arena/game-engine test` — all pass; test count ≥ baseline + 12
- [ ] `pnpm -r build && pnpm test` — all packages build and test green
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` — 0 errors
- [ ] `docs/ai/STATUS.md` updated with WP-286 execution summary
- [ ] `docs/ai/DECISIONS.md` — D-24069 flipped to Active; D-24070 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-286 checkbox flipped to `[x]`
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-318 flipped to Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-286 node added under the correct subsystem cluster
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] **User-Visible Surface: none — infrastructure.** STATUS.md entry states "No user-observable
      change — infrastructure only; One-Hit Wonder's choice is bot-resolved until the co-release-locked
      WP-287 client picker ships. WP-286 MUST NOT deploy to play.legendary-arena.com without WP-287."
