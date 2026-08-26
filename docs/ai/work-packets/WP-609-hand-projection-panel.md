# WP-609 — Hand Projection Panel Section (Phase-2)

**Status:** Ready
**Primary Layer:** Cross-cutting — Game Engine (two additive barrel re-exports: the `HAND_SIZE` const + the `UIDeckCardStat` type) + `apps/arena-client` (the panel section + projection util)
**Dependencies:** WP-607 / EC-642 (the `DeckProbabilityPanel.vue` this extends), WP-606 / D-24417 (`deckComposition` + `discardCards`), WP-608 / D-24419 (`deckCardStats` — landed on `origin/main` @ `2a8b7f55`), WP-056 (the preplan `createSpeculativePrng` reused for a deterministic Monte Carlo)
**User-Visible Surface:** `play.legendary-arena.com`

> Baseline: `origin/main` at commit `e2903a34` (SPEC: reserve WP-609 / EC-644 / D-24420, #1656).

---

## Session Context

Phase-2 of the Deck Probability Panel (per the ewiki page) is **hand
projection**: predict the player's next hand's expected recruit/attack and a
range. The data foundations are on `main` — `deckComposition` (WP-606),
`discardCards` (WP-606), and `deckCardStats` (WP-608, the per-card `{recruit,
attack, cost}` map). This packet adds the client math + a "Next hand" section to
the existing panel.

Two engine-barrel gaps must be closed first (both additive, both in the barrel
file already in scope): `HAND_SIZE` (the `drawCards.logic` SSOT const, whose doc
comment forbids hardcoding `6` elsewhere) is not barrel-exported, and WP-608
added the `UIDeckCardStat` **type** but did not barrel-export it — so the client
cannot import either yet.

---

## Goal

After this session, the expanded `DeckProbabilityPanel` shows a **"Next hand"**
section: the **expected recruit and attack** of the next hand + a **range**
(Monte-Carlo p10/p90). All math is in a pure `handProjection.ts`. The expected
values are **exact** — modelling the engine's real two-stage draw (draw the deck
top, reshuffle the discard only when the deck runs out) — with **no RNG**; the
range is an **injectable-RNG** Monte Carlo. The engine barrel re-exports
`HAND_SIZE` + `UIDeckCardStat`; nothing else about gameplay changes.

---

## User-Visible Impact

Expanding the panel now shows, beneath the own-deck inventory, a **Next hand**
line — e.g. *"Recruit ~5 (3–7) · Attack ~6 (3–9)"* — the expected recruit and
attack of the hand the player draws next turn, with a low/high range. It turns
"what am I likely to draw" into a decision number. Advisory only; collapses with
the panel; the displayed range is **stable** for a given game state (it does not
jitter between renders).

---

## Assumes

- WP-607 on `main`: `DeckProbabilityPanel.vue` (collapsible; villain + own-deck
  sections; owner via the `handCards` redaction marker) + `deckProbability.ts`.
- WP-606 on `main`: owner-only `deckComposition?` + `discardCards?`.
- WP-608 on `main` (`2a8b7f55`): owner-only `deckCardStats?: Record<extId,
  UIDeckCardStat>`. The **field** is reachable client-side via the barrel-exported
  `UIPlayerState`; the **`UIDeckCardStat` type name is NOT yet barrel-exported**
  (this WP adds that re-export).
- `packages/game-engine/src/moves/drawCards.logic.ts` exports `HAND_SIZE = 6`
  (SSOT) and draws the deck top, reshuffling the discard on deck exhaustion.
- `packages/preplan/src/index.ts` exports `createSpeculativePrng(seed): () => number`;
  `apps/arena-client` depends on `@legendary-arena/preplan` and already runtime-
  imports engine consts from the (dev-dep) barrel (e.g. `SCORE_GRADE_BANDS` in
  `gradeDisplay.ts`) — Vite bundles them, so `HAND_SIZE` needs no `package.json` change.
- `pnpm -r build` 0; arena-client `typecheck` + `test` green on `e2903a34`.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `packages/game-engine/src/index.ts` — the engine barrel; it value-re-exports
  consts (`SCORE_GRADE_BANDS`, `MENACE_TIERS`) and the UIState types. Add
  `HAND_SIZE` (from `./moves/drawCards.logic.js`) + `UIDeckCardStat` (from
  `./ui/uiState.types.js`).
- `packages/game-engine/src/moves/drawCards.logic.ts` — `HAND_SIZE = 6`, the
  "forbids hardcoding 6" note, and the **two-stage** draw (deck top first, then
  reshuffle discard) the projection models exactly.
- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — the `viewer`
  computed (`players.find(p => p.handCards !== undefined)`), the two
  `.deck-probability-section` blocks; the new section slots after the own-deck
  section, reusing `viewer` + adding `discardCards` / `deckCardStats` computeds.
- `apps/arena-client/src/components/play/deckProbability.ts` — the sibling pure
  helper; `handProjection.ts` colocates.
- `apps/arena-client/src/components/play/HollowEffectsPanel.test.ts` — the
  node:test / @vue/test-utils / jsdom / `loadUiStateFixture('mid-turn')` pattern.
- `packages/preplan/src/speculativePrng.ts` — `createSpeculativePrng` + the
  `random: () => number` shuffle idiom the `rng` seam mirrors.
- `docs/ai/ARCHITECTURE.md §Layer Boundary` (Package Import Rules; the
  `apps/arena-client` runtime-safe engine surface, WP-090) + `.claude/rules/architecture.md`
  — the authority for the client's runtime-const import from the engine barrel.
- `wiki/deck-probability-panel.md` — the hand-projection design (Phase 2).
- `docs/ai/DECISIONS.md` — D-24417 / D-24418 / D-24419; land D-24420 at execution.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+, `node:` prefix; `.test.ts`. Full file contents — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; no branching `.reduce()`; JSDoc per export.

**Packet-specific:**
- **Client-side advisory only.** All math in `handProjection.ts` from the UIState
  projection; NEVER `ctx.random`; NEVER a `boardgame.io`/engine-**logic** runtime
  import; NEVER a game-state write. The engine touches are two additive **barrel
  re-exports** (the `HAND_SIZE` pure const + the `UIDeckCardStat` type — the WP-090
  runtime-safe surface, per ARCHITECTURE.md Package Import Rules).
- **`HAND_SIZE` via the barrel, never hardcoded.** Import `HAND_SIZE` + type
  `UIDeckCardStat` from `@legendary-arena/game-engine`; never hardcode `6`.
- **Expected values are the EXACT two-stage mean (no RNG).** The engine draws up
  to `HAND_SIZE` off the deck top, reshuffling the discard only on exhaustion:
  - `deckDraw = min(HAND_SIZE, |deck|)`, `discardDraw = min(HAND_SIZE − deckDraw, |discard|)`.
  - `E[stat] = deckDraw·Σdeck_stat/|deck|  +  discardDraw·Σdiscard_stat/|discard|`
    (each term 0 when its zone is empty). When `|deck| ≥ HAND_SIZE` this is the
    deck-only hypergeometric mean; when the deck is short, ALL deck cards are
    certain (`deckDraw = |deck|`, the term = `Σdeck_stat`) plus a proportional
    discard draw. Exact by linearity of expectation.
- **The range is an injectable-RNG Monte Carlo mirroring the two stages.**
  `rng: () => number` (default `Math.random`); sample a random `deckDraw`-subset
  of the deck (all of it when short) + a random `discardDraw`-subset of the
  discard (Fisher-Yates with the injected `rng`), sum recruit + attack, repeat;
  report p10/p50/p90.
- **Stable display seed.** The component seeds the Monte Carlo from a
  **deterministic function of the current game state** (`createSpeculativePrng`
  of a stable seed derived from the turn + pool), so the rendered range does NOT
  jitter on reactive recompute for identical state. Tests inject their own seed/stub.
- **Missing stat → 0/0.** A pool ext_id absent from `deckCardStats` (non-hero,
  e.g. a Wound) contributes 0 recruit / 0 attack.
- **Owner-only inputs; self-hide on empty pool.** Read `deckComposition` /
  `discardCards` / `deckCardStats` off the `handCards`-redaction-marker `viewer`;
  the section renders only when the viewer is present AND the pool is non-empty
  (`|deck| + |discard| > 0`) — no "~0 (0–0)".
- **`vue-tsc` gates** — run `pnpm --filter arena-client typecheck`.

**Session protocol:** if the two-stage draw, `HAND_SIZE` source, or a field name
is unclear, STOP and read the cited file — never guess.

**Locked values (do not re-derive):**
- Barrel: `index.ts` re-exports `HAND_SIZE` (const, from `./moves/drawCards.logic.js`)
  + `UIDeckCardStat` (type, from `./ui/uiState.types.js`).
- `handProjection.ts` (colocated). `projectNextHand(deckComposition, discardCards,
  deckCardStats, rng?, sampleCount?)` → `{ handSize, poolSize, expectedRecruit,
  expectedAttack, recruit: {p10,p50,p90}, attack: {p10,p50,p90} }`.
- EV (exact two-stage): `deckDraw·Σdeck/|deck| + discardDraw·Σdiscard/|discard|`,
  `deckDraw = min(HAND_SIZE,|deck|)`, `discardDraw = min(HAND_SIZE−deckDraw,|discard|)`.
- RNG: injectable `rng: () => number` (default `Math.random`); component seeds a
  stable `createSpeculativePrng(seed)`; tests inject their own.
- Owner select: `players.find(p => p.handCards !== undefined)`.

---

## Scope (In)

### A) Engine barrel (`packages/game-engine/src/index.ts`, **modified**)
- Two additive re-export rows: `HAND_SIZE` (const, from `./moves/drawCards.logic.js`)
  and `UIDeckCardStat` (type, from `./ui/uiState.types.js` — WP-608 added the type
  but did not barrel-export it). No other engine change. Add a `// why:` (re-export
  the `HAND_SIZE` SSOT const + the `UIDeckCardStat` type for the client consumer).

### B) `handProjection.ts` (`apps/arena-client/src/components/play/handProjection.ts`, **new**)
- Import `HAND_SIZE` (value) + type `UIDeckCardStat` from `@legendary-arena/game-engine`.
- `sumStat(cards, deckCardStats, pick)` — `Σ` of a stat over a card list, missing
  key → 0 (`for...of`, no reduce).
- `expectedNextHand(deckComposition, discardCards, deckCardStats)` — the EXACT
  two-stage mean (locked formula above); no RNG. Returns `{ handSize, poolSize,
  expectedRecruit, expectedAttack }`.
- `sampleNextHand(deckComposition, discardCards, deckCardStats, rng)` — one Monte
  Carlo hand: a random `deckDraw`-subset of the deck (all when short) + a random
  `discardDraw`-subset of the discard (Fisher-Yates with `rng`); return the
  summed `{recruit, attack}`.
- `projectNextHand(deckComposition, discardCards, deckCardStats, rng = Math.random,
  sampleCount = 500)` — the EV (via `expectedNextHand`) + p10/p50/p90 (via
  `sampleCount` `sampleNextHand` runs, sorted percentiles). Empty pool → all zeros.
- Pure; no engine-logic import; JSDoc + `// why:` on the two-stage model, the
  approximation-free EV, and the injectable-rng seam.

### C) Panel section (`apps/arena-client/src/components/play/DeckProbabilityPanel.vue`, **modified**)
- Add `discardCards` + `deckCardStats` computeds off the existing `viewer`.
- A `nextHand` computed = `projectNextHand(..., createSpeculativePrng(seed))`
  where `seed` is a **stable** deterministic function of the current state (the
  turn number combined with the pool size — same state → same seed → same
  range), computed only when the viewer is present and the pool is non-empty
  (else `null`).
- A third `.deck-probability-section` (after the own-deck section) rendering
  "Next hand": expected recruit + attack, each with its p10–p90 range;
  `data-testid` hooks (`next-hand-recruit`, `next-hand-attack`). `v-if` on
  `nextHand !== null`.

### D) `handProjection.test.ts` (**new**)
- `sumStat` (missing key → 0). `expectedNextHand`: assert the exact two-stage
  value in BOTH branches — deck-ample (`E = HAND_SIZE·Σdeck/|deck|`) and
  short-deck (`E = Σdeck + discardDraw·Σdiscard/|discard|`, e.g. deck=[10,10]
  Σ20, discard=5×[0] → 20, NOT ~17.1); empty pool → 0.
- `projectNextHand` with a **seeded** `createSpeculativePrng(seed)`: assert
  determinism (same seed → identical output), the EV equals `expectedNextHand`,
  and p10 ≤ p50 ≤ p90 within `[0, max]`.

### E) Panel test (`DeckProbabilityPanel.test.ts`, **modified**)
- Seed a snapshot (`loadUiStateFixture('mid-turn')` + injected `deckComposition`,
  `discardCards`, `deckCardStats` on the viewer + a turn number); expand; assert
  the "Next hand" section renders the expected recruit/attack and that two
  renders of identical state show the **same** range (stable seed); assert it
  hides when the pool is absent/empty. Assert presence + the EV + range
  **ordering**, never exact percentile values.

---

## Out of Scope

- **No pace/outlook, deck-health, or trend** — later phases.
- **No engine gameplay / projection change** beyond the two barrel re-exports.
- **No hand-size-override modelling** (`G.handSizeOverrides` is transient +
  unprojected); the MVP projects a `HAND_SIZE` hand.
- **No `package.json` edit** — the engine dev-dep already carries runtime consts
  bundled by Vite (`gradeDisplay.ts` precedent).
- **No web worker; no exact convolution DP** — synchronous Monte Carlo for the range.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `packages/game-engine/src/index.ts` — **modified** — re-export `HAND_SIZE` + `UIDeckCardStat`
- `apps/arena-client/src/components/play/handProjection.ts` — **new** — two-stage EV + Monte Carlo
- `apps/arena-client/src/components/play/handProjection.test.ts` — **new** — util tests
- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — **modified** — "Next hand" section
- `apps/arena-client/src/components/play/DeckProbabilityPanel.test.ts` — **modified** — section test

No other **code** files may be modified. (The `EC-644:` implementation commit
touches exactly these 5; the STATUS / DECISIONS / WORK_INDEX / mindmap governance
edits are the separate `SPEC:` govern-close commit — the standard two-commit
topology, not a scope breach.)

---

## Vision Alignment

N/A — no scoring/PAR/leaderboards, identity, multiplayer sync,
card-data/content-semantics, or monetization. A read-only client aid.

**Determinism note:** the engine is untouched except two additive barrel
re-exports (no `G`/`ctx`/hash surface). The panel's Monte Carlo is **client-local
display randomness** via an injectable `rng` (the component seeds a **stable**
`createSpeculativePrng` from game state, so the display is deterministic per
state; tests inject their own) — never `ctx.random`, never the deterministic
engine. No hash surface, no re-pin.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy.

## API Catalog

N/A — no HTTP endpoint, no `apps/server/src/**` library function (barrel consts/types
are not server library functions).

---

## Acceptance Criteria

All binary pass/fail.

- [ ] `HAND_SIZE` + `UIDeckCardStat` are re-exported from the engine barrel;
  `handProjection.ts` imports both (no hardcoded `6`, no local `UIDeckCardStat`).
- [ ] `expectedNextHand` is the exact two-stage mean in BOTH branches: deck-ample
  → `HAND_SIZE·Σdeck/|deck|`; short-deck → `Σdeck + discardDraw·Σdiscard/|discard|`
  (the deck=[10,10]/discard=5×[0] case returns 20, not ~17.1); empty pool → 0;
  missing `deckCardStats` key → 0.
- [ ] `projectNextHand` is deterministic for a fixed seed; the EV equals
  `expectedNextHand`; percentiles satisfy p10 ≤ p50 ≤ p90.
- [ ] The component seeds a **stable** per-state PRNG so two renders of identical
  state show the same range (asserted in the panel test).
- [ ] The "Next hand" section renders expected recruit + attack (+ range) from a
  seeded snapshot and hides when the pool is absent/empty.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; arena-client
  suite green; the `EC-644:` implementation diff is exactly the 5 code files.

---

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0 (engine barrel re-exports + arena-client)

pnpm --filter arena-client typecheck
pnpm --filter arena-client test
# Expected: both exit 0 / all pass

Select-String -Path "apps\arena-client\src\components\play\handProjection.ts" -Pattern "HAND_SIZE"
# Expected: HAND_SIZE imported from the barrel; no hardcoded 6

git diff --name-only
# Expected (implementation commit): only the 5 code files in ## Files Expected to Change.
# (STATUS/DECISIONS/WORK_INDEX/mindmap land in the separate SPEC govern-close commit.)
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`, D-24026):**
  in a real deployed match, the expanded panel shows a "Next hand" section with
  expected recruit/attack + a range — observed on the deployed bundle.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; suites green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land D-24420 as Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-609 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`; `pnpm roadmap:counts:write`.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all sections). Verdict: **PASS**.

- §1 Structure — PASS (all sections; ≥2 Out-of-Scope). §2 Constraints — PASS (Always-apply full-file/no-diffs, ESM/Node, `00.6`; packet-specific; session protocol; locked values).
- §3 Assumes — PASS. §4 Context — PASS (now cites ARCHITECTURE.md Package Import Rules / WP-090 + `.claude/rules/architecture.md` for the cross-layer barrel edge).
- §5 Files — PASS (5 code files, bounded; governance docs are the separate SPEC commit). §6 Naming — PASS. §7 Deps — PASS (no new npm dep; game-engine + preplan already workspace deps).
- §8 Boundaries — PASS (no engine-logic runtime import beyond the two barrel exports; `UIDeckCardStat` type-only). §9 Windows — PASS. §10/§11 — N/A.
- §12 Tests — PASS (node:test + @vue/test-utils; no boardgame.io/net/DB). §13 Commands — PASS. §14 Acceptance — PASS (6 binary items). §15/§15.1 — PASS (surface + live-on-surface D-24026; vue-tsc gated).
- §16 Code style — PASS. §17 Vision — N/A + determinism note. §18 Prose-vs-grep — N/A (presence grep for HAND_SIZE). §19 — N/A. §20 Funding / §21 API Catalog — N/A with reasons.

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-08-26).**

- **Dependencies verified against `main`:** `HAND_SIZE = 6` (`drawCards.logic.ts`, not barrel-exported → this WP adds it); the barrel already value-re-exports consts (`SCORE_GRADE_BANDS`, `MENACE_TIERS`); `createSpeculativePrng` (preplan barrel); the `DeckProbabilityPanel` `viewer` + two sections; `deckComposition`/`discardCards`/`deckCardStats` owner-only on `origin/main`. No name collision.
- **PS-1 (resolved):** `UIDeckCardStat` was added by WP-608 but NOT barrel-exported → a named import would fail `vue-tsc`. Scope A now adds a second barrel line re-exporting the type (in-scope; `index.ts` already allowlisted).
- **WP-608 dependency (resolved):** the gate ran against a local checkout behind `origin/main`; WP-608 is merged (`2a8b7f55`). Execute from a fresh worktree off `origin/main`.
- **RS (folded):** Assumes wording tightened (field reachable via `UIPlayerState`, type-name added here); the new section hides on an empty pool (not "~0").
- **PS items (blocking): none** (PS-1 resolved).

---

## Copilot Check (01.7)

**Verdict: RISK → CONFIRM (2026-08-26).** Scope unchanged (5 code files; `index.ts` already allowlisted). Copilot verified the architecture (util mirrors `deckProbability.ts`; the `HAND_SIZE` barrel re-export is correct; client-local determinism is clean) and raised four issues, **all applied in-place**:

1. **Math (the key fix).** The closed-form `n·Σpool/|pool|` is exact only when the deck is ample; the short-deck branch (≈half the turns) draws the deck certain + a proportional discard reshuffle. The WP now specifies the **exact two-stage mean** (`Σdeck + discardDraw·Σdiscard/|discard|` when short), the Monte Carlo mirrors the two stages, and the tests pin the two-stage value (the deck=[10,10]/discard=5×[0] → 20 case).
2. **Display jitter.** The panel path defaulted to `Math.random`, re-rolling the range every recompute. The component now seeds a **stable** `createSpeculativePrng` from game state; the panel test asserts identical state → identical range, and asserts presence/EV/ordering (never exact percentiles).
3. **Scope-check wording.** The `git diff` step + `## Files` now state the 5-code-file lock applies to the `EC-644:` implementation commit; the governance docs are the separate `SPEC:` commit (the standard two-commit topology).
4. **Packaging.** game-engine is a dev-dep, but arena-client already runtime-imports engine consts (`gradeDisplay.ts` `SCORE_GRADE_BANDS`), Vite-bundled — so no `package.json` edit (no 6th file).

**Disposition: CONFIRM** — the math and determinism fixes are self-contained (same files, same deps, verified empirically by the two-stage + stable-seed tests at execution); session-prompt generation authorized.

---

## Reserved Decisions (land at execution)

- **D-24420 (reserved; Drafted 2026-08-26, not yet landed)** — The Deck
  Probability Panel's hand projection is **client-side advisory** (extends
  D-24418): **exact** expected recruit/attack modelling the engine's **two-stage
  draw** — draw the deck top, reshuffling the discard only on deck exhaustion, so
  `E[stat] = deckDraw·Σdeck/|deck| + discardDraw·Σdiscard/|discard|` (`deckDraw =
  min(HAND_SIZE,|deck|)`, `discardDraw = min(HAND_SIZE−deckDraw,|discard|)`) — no
  RNG; plus a **range** via an injectable-RNG Monte Carlo (`rng: () => number`;
  the component seeds a **stable** `createSpeculativePrng` from game state so the
  display does not jitter; tests inject their own; reuses preplan's PRNG).
  **Hand size is `HAND_SIZE`** (the `drawCards.logic` SSOT), imported via a new
  game-engine **barrel re-export** (alongside the `UIDeckCardStat` type WP-608 left
  un-exported) rather than a client-hardcoded `6` — a sanctioned runtime-const /
  type import (the arena-client runtime-safe engine surface, WP-090, per
  ARCHITECTURE.md Package Import Rules), distinct from importing engine logic.
  Reads `deckComposition` + `deckCardStats` (WP-606/WP-608) + `discardCards`.
  Never `ctx.random`, never feeds gameplay.

---

## See Also

- [WP-607](WP-607-deck-probability-panel-mvp.md) — the panel this extends
- [WP-608](WP-608-uistate-deck-card-stats.md) / D-24419 — the `deckCardStats` this consumes
- `wiki/deck-probability-panel.md` — the hand-projection design (Phase 2)
- `packages/preplan/src/speculativePrng.ts` — the seedable PRNG reused
- `docs/ai/ARCHITECTURE.md §Layer Boundary` (Package Import Rules; WP-090) — the client runtime-safe engine surface
