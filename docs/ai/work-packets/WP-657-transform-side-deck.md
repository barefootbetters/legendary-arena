# WP-657 — Partition Transform Cards into a Side Deck at Setup (Game Engine)

**Status:** Draft 2026-09-06 · **PROPOSED (WP-657; next free WP per the number ledger)** · **Standard engine lane** (single layer — `packages/game-engine` setup — additive G field + tests + two sanctioned determinism re-pins). Reserves **D-24468** and **EC-694** (both reserved in `NUMBER-LEDGER.md` on the SPEC commit; land at execution).

**Primary Layer:** Game Engine (`packages/game-engine/src/setup/`)
**User-Visible Surface:** none directly — a setup-correctness fix. Payoff surfaces later: once the `[keyword:Transform]` runtime lands (follow-up WP), a base card's transform second-form will come from the side deck instead of being recruited/played as an ordinary hero. **D-24026 N/A for WP-657** (no runtime/board behaviour change; the side deck is populated and read-only).
**Dependencies:** WP-135 ✅ (`buildHeroDeck` reservoir), WP-137/WP-138 ✅ (`cardCounts` / `physicalCards` emission the emitter walks). No hard-dep WP in flight; the concurrent WP-653 (hero condition gates: Worthy/Outwit) is independent — it touches hook conditions, not deck construction.
**Baseline:** `origin/main` @ `343195d3` (capture `git rev-parse origin/main` at execution).

---

## Goal

Transform cards (a card's second-form face, reached via the `[keyword:Transform]` ability — e.g.
She-Hulk's **Hurl Legal Objections** transforms into **Hurl Trucks**) are currently emitted straight
into the shuffled hero-deck reservoir and dealt into the HQ / `G.heroDeck`, so they get recruited and
played as ordinary heroes. Marvel Legendary keeps transform cards in a **face-up side deck**, out of
the hero deck; a base card pulls its transform copy from that side deck when it transforms.

**Root cause:** the hero-deck emitter (`heroCardInstanceExtIds` → `buildHeroDeckCards` in
`buildHeroDeck.ts`) walks every `physicalCard` with `count >= 1` and never consults the transform
flags the card data already carries (`isTransform: true` / `transformOf: <baseSlug>`). There is also
**no side-deck zone in `G`** for them to live in.

**Live evidence** — `red-skull-Midtown-Bank-Robbery` 1p log: `Hurl Trucks (wwhk/she-hulk/hurl-trucks#0)`
is **recruited from the HQ** (`HQ slot 3 refilled from heroDeck`) and later **played from hand** as a
normal hero, while the printed `[keyword:Transform] this into Hurl Trucks` line is inert. The
coverage ledger corroborates: `transform` is `unsupported` for every wwhk hero
(`docs/ai/coverage/hero-mechanic-ledger.csv`).

This packet fixes the **setup half**: partition transform cards OUT of the shuffled reservoir into a
new `G.transformDeck` side-deck zone. The `[keyword:Transform]` **runtime** (trigger detection,
pulling from the side deck, base→target resolution, placement) is a **named follow-up WP** — this
packet is the isolated, independently-landable first slice.

---

## User-Visible Impact

None in WP-657 (setup-only; the side deck is built and read-only). It unblocks the follow-up runtime
WP, after which transform second-forms stop appearing in the HQ / hand as recruitable heroes and
instead arrive via `[keyword:Transform]` from the side deck — the correct tabletop behaviour.

---

## Assumes

- **Transform cards are cleanly flaggable in the data.** All 17 transform cards today live in
  `data/cards/wwhk.json`, each carrying BOTH `isTransform: true` and `transformOf: <baseSlug>`; either
  flag marks a card. (Verified — `grep -c '"isTransform": true'` = 17; `transformOf` count = 17.)
- **The emitter is the single home for hero card-instance ids** (D-18706) — its other consumers
  (`buildCardStats` §1b, `buildHeroAbilityHooks`) need transform cards' stats + abilities and must keep
  seeing them; only the DECK RESERVOIR excludes them. (Verified — both consume `heroCardInstanceExtIds`.)
- **Adding a `G` field re-pins the state-hash oracles** — the documented, sanctioned consequence
  (`notableEvents.compose.ts` header; the WP-236/282/398 re-pin history in `replay.execute.test.ts`).
  (Verified — engine suite failed exactly the two hash pins before the re-pin, passed after.)
- **Seed-PAR is hero-agnostic** — `data/par/seed/v1/index.json` pins hard-coded scheme-keyed `parValue`
  + scoring-config `artifactHash`, never `finalStateHash`, and the generator carries no hero loadout, so
  this change cannot shift it. (Verified — grep of the index for `finalStateHash` = 0; generator has no
  hero/loadout/deck reference.)

---

## Context (Read First)

- `packages/game-engine/src/setup/buildHeroDeck.ts` — the emitter (`heroCardInstanceExtIds`), the
  reservoir builder (`buildHeroDeckCards`), and the canonical entry point (`buildHeroDeck`) + its single
  locked `ctx.random.Shuffle`.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — the orchestrator; consumes `buildHeroDeck`
  → `fillHqFromDeck` → `G.heroDeck`, runs the WP-514 Skrull conversion off the shuffled reservoir, and
  builds the `LegendaryGameState` literal.
- `packages/game-engine/src/types.ts` — `LegendaryGameState` (the `heroDeck` field is the sibling the new
  `transformDeck` sits beside).
- `data/cards/wwhk.json` — the she-hulk pair (`hurl-legal-objections` → `hurl-trucks`) and the
  `isTransform`/`transformOf` convention.

---

## Non-Negotiable Constraints

**Always apply:** human-style code (`00.6`); ESM; full-sentence errors; `// why:` on the non-obvious
bits; `G` stays JSON-serializable (CardExtId strings only); no `.reduce()`; setup-time only (no registry
import in moves); only `Game.setup()` may throw.

**Packet-specific:**
- **Preserve the single Shuffle envelope.** The side deck is built with NO `ctx.random` call — every copy
  of a transform card is identical, so the side deck needs no randomness and the single locked hero-deck
  `Shuffle` in `shuffleHeroDeck` stays the only randomness in setup.
- **Emitter keeps emitting everything.** `heroCardInstanceExtIds` still returns every instance (its
  stats/ability consumers depend on it); a new `isTransform` flag on `HeroCardInstance` lets the two
  reservoir/side-deck callers partition without changing what the other consumers see.
- **Complete + disjoint partition.** Every emitted instance lands in exactly one of `heroDeck` /
  `transformDeck`; no overlap, no drop.
- **Re-pin, don't mask.** The two state-hash oracles re-pin with a `// why:` line naming the single cause
  (a new empty `G` field), matching the existing re-pin history.

---

## Scope (In)

### A) Transform tag on the emitter (`buildHeroDeck.ts`, modified)
- Extend the local `HeroCardEntry` + the emitter param type with optional `isTransform?` / `transformOf?`.
- Add `isTransform: boolean` to `HeroCardInstance`.
- `heroCardInstanceExtIds` builds a transform-slug set from `cards[]` (either flag) and tags each emitted
  instance (both the `physicalCards` path and the rarity-fallback path).

### B) Partition (`buildHeroDeck.ts`, modified)
- `buildHeroDeckCards` skips `instance.isTransform` (reservoir excludes transform cards).
- New `buildTransformSideDeckCards` — same registry walk, keeps only `instance.isTransform`, unshuffled.
- New `buildTransformSideDeck(heroDeckIds, registry)` entry point — soft-skips a narrow registry with `[]`
  (mirrors `buildHeroDeck`).

### C) State zone (`types.ts`, modified)
- Add `transformDeck: CardExtId[]` to `LegendaryGameState`, beside `heroDeck`, with a `// why:` (D-24468).

### D) Orchestrator wiring (`buildInitialGameState.ts`, modified)
- Hoist the effective hero-deck id list; call `buildTransformSideDeck(effectiveHeroDeckIds, registry)`;
  set `transformDeck` in the state literal.

### E) Tests (`buildHeroDeck.test.ts` + `buildInitialGameState.shape.test.ts`, modified)
- Emitter tags transform instances (both paths); reservoir excludes them; side deck holds exactly them;
  partition is complete + disjoint; empty side deck for a no-transform hero; entry-point soft-skip; shape
  test asserts `G.transformDeck` is an array. Existing instance-shape assertions updated for `isTransform`.

### F) Determinism re-pins (sanctioned)
- `PRE_WP080_HASH` `c3ee9eb4 → d5d807a9` (`replay.execute.test.ts`) with a `// why:` re-pin line.
- Sentinel fixture `finalStateHash` `f90e4620… → e237a0e7…` (`sentinel-core-doom-2p.replay.json`).

---

## Out of Scope

- **The `[keyword:Transform]` runtime** — trigger detection, pulling the matching card from
  `G.transformDeck`, the base→target resolution map in `G` (moves have no registry), and discard/into-play
  placement. **Named follow-up WP** (the reason `G.transformDeck` is populated-and-read-only here).
- **Flipping `hero-mechanic-ledger.csv` `transform` rows `unsupported → supported`** — belongs with the
  runtime WP, not the setup partition.
- **Regenerating recorded wwhk match replays** — a wwhk deck's reservoir shuffle changes (expected), so
  previously-recorded wwhk `.lagn` replays diverge; re-recording them is an operator/asset task, not a
  code change here.
- **Any non-wwhk set** — no other set carries transform cards today; the partition is data-driven and
  becomes active automatically when one does.

---

## Files Expected to Change

- `packages/game-engine/src/setup/buildHeroDeck.ts` — **modified** (tag + partition + `buildTransformSideDeck`)
- `packages/game-engine/src/types.ts` — **modified** (`transformDeck` field)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** (wire side deck)
- `packages/game-engine/src/setup/buildHeroDeck.test.ts` — **modified** (partition tests + shape-assert fix)
- `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` — **modified** (transformDeck assert)
- `packages/game-engine/src/replay/replay.execute.test.ts` — **modified** (PRE_WP080_HASH re-pin)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified** (finalStateHash re-pin)
- Governance: `NUMBER-LEDGER.md` (WP-657/EC-694/D-24468 reserved) + `DECISIONS.md` (D-24468) + `WORK_INDEX.md` (WP-657) + `EC_INDEX.md`/EC-694 + `docs/ai/STATUS.md`, at execution.

> No `api-endpoints.md` change — no HTTP endpoint touched (§21 N/A). No registry-schema change — the
> `isTransform`/`transformOf` fields already exist in the card data; the engine only reads them.

---

## Contract

| Key | Value |
|---|---|
| Transform tag | a card is a transform card when its `cards[]` entry has `isTransform:true` OR `transformOf:<slug>` |
| `heroCardInstanceExtIds` | still emits EVERY instance; each now carries `isTransform` |
| `buildHeroDeckCards` / `buildHeroDeck` | reservoir EXCLUDES transform instances |
| `buildTransformSideDeckCards` / `buildTransformSideDeck` | keeps ONLY transform instances; UNSHUFFLED; `[]` on narrow registry |
| `G.transformDeck` | `CardExtId[]`; populated at setup, read-only in WP-657 |
| Randomness | unchanged — the single `shuffleHeroDeck` call remains the only setup RNG |
| Determinism | every game's `finalStateHash` shifts (new `G` field) → two oracle pins re-pinned; Seed-PAR unaffected |
| Untouched | `heroDeck`/HQ semantics for non-transform cards; Skrull conversion; the rule pipeline; moves |

---

## Acceptance Criteria

1. Transform cards do NOT appear in the shuffled hero-deck reservoir (`buildHeroDeckCards`) or in
   `G.heroDeck`/`G.hq` (asserted) (**AC-1**).
2. `G.transformDeck` holds exactly the transform-card instances for the match's heroes, unshuffled; the
   partition is complete and disjoint (asserted) (**AC-2**).
3. `heroCardInstanceExtIds` still emits every instance (transform + non-transform), each tagged
   `isTransform` correctly on both the `physicalCards` and rarity-fallback paths (asserted) (**AC-3**).
4. A hero with no transform cards yields an empty side deck and an unchanged full reservoir; the entry
   point soft-skips a narrow registry with `[]` (asserted) (**AC-4**).
5. No new `ctx.random` call — the single `shuffleHeroDeck` remains the only setup RNG (code-inspected;
   the empty-replay hash shifts only by the new field, not by a new draw) (**AC-5**).
6. `pnpm --filter @legendary-arena/game-engine build` clean; the engine test suite green (3056/3056 with
   the two sanctioned re-pins); `pnpm --filter @legendary-arena/game-engine typecheck:tests` net-neutral
   vs `origin/main` (the pre-existing partial-mock red is unchanged, +0) (**AC-6**).

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine build
# from packages/game-engine:
node --import tsx --test src/setup/buildHeroDeck.test.ts
node --import tsx --test src/setup/buildInitialGameState.shape.test.ts
node --import tsx --test "src/**/*.test.ts"          # 3056/3056 after the two re-pins
Select-String -Path "packages\game-engine\src\setup\buildHeroDeck.ts" -Pattern "buildTransformSideDeck"
Select-String -Path "packages\game-engine\src\types.ts" -Pattern "transformDeck"
node scripts\check-number-ledger.mjs --check
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Transform cards partitioned OUT of the reservoir and into `G.transformDeck` (complete + disjoint)
- [ ] `heroCardInstanceExtIds` still emits every instance; the two other consumers unaffected
- [ ] No new RNG; single `shuffleHeroDeck` envelope preserved
- [ ] The two state-hash oracles re-pinned with a `// why:` naming the new-`G`-field cause
- [ ] `game-engine` build clean; engine suite 3056/3056; `typecheck:tests` net-neutral vs main
- [ ] `DECISIONS.md` D-24468 landed; `WORK_INDEX` (WP-657) + `EC_INDEX`/EC-694 + `NUMBER-LEDGER` + `STATUS.md` updated
- [ ] `[keyword:Transform]` runtime + ledger flip carried by a named follow-up WP (NOT this one)
- [ ] No files outside `## Files Expected to Change` were modified

---

## Vision Alignment

**Vision clauses touched:** §11 (match lifecycle — correct deck construction), fidelity to the tabletop
transform rule. **Conflict assertion:** No conflict — an additive setup-correctness fix; no scoring /
variant change; the determinism re-pin is the sanctioned new-`G`-field consequence, not a semantics
change. **Non-Goal check:** NG — no gameplay behaviour change in WP-657 (side deck read-only).
**Determinism:** the single locked hero-deck Shuffle envelope is preserved (no new draw); the two
`finalStateHash` oracles re-pin because a new `G` field serializes into the hash; Seed-PAR unaffected.

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. Highlights — §5 standard engine lane (single layer; additive G field +
tests + two re-pins); §8 engine boundary (setup resolves, moves untouched; no server/registry runtime
change); §11/§21 N/A (no HTTP endpoint); §22 determinism APPLIES — single-Shuffle envelope preserved,
two oracle pins re-pinned with cause, Seed-PAR verified static; §17 §11 (no conflict).

## Pre-Flight / Copilot (drafter self-review)

**Pre-flight: READY.** Deps on `main` (WP-135/137/138); scope locked to the setup partition; runtime +
ledger flip named out of scope; no hard-dep WP in flight.
**Scaffold (empirical independence):** implemented + ran — `buildHeroDeck.test.ts` 45/0 (+8 new),
`buildInitialGameState.shape.test.ts` 21/0 (+1), full engine suite **3056/3056** after the two sanctioned
re-pins; `game-engine` build 0.

**Copilot: PASS.** Failure modes pinned: (a) transform cards still recruited → **reservoir excludes
`isTransform`, AC-1**; (b) stats/ability consumers lose transform cards → **emitter still emits all;
only reservoir filters, AC-3**; (c) a stray new RNG breaks replay determinism → **side deck unshuffled,
AC-5**; (d) partition drops/duplicates a card → **complete+disjoint test, AC-2**; (e) hash regression
masked as a real bug → **two re-pins with a `// why:` naming the new-field cause + Seed-PAR proven
static, §22**; (f) the flag misread on the physicalCards path (sides[0] vs card slug) → **both paths
tagged from the same transform-slug set, AC-3**.

## Decision (reserved, lands at execution)

Reserves **D-24468**: at setup, transform cards (`isTransform`/`transformOf`) are partitioned OUT of the
shuffled hero-deck reservoir and set aside in a new top-level `G.transformDeck: CardExtId[]` zone, built
unshuffled by `buildTransformSideDeck` (no new `ctx.random`; the single locked hero-deck Shuffle envelope
is preserved). The emitter keeps emitting every instance (stats/ability consumers need transform cards);
a new `isTransform` flag on `HeroCardInstance` drives the reservoir/side-deck split. Adding the `G` field
re-pins the two engine state-hash oracles (`PRE_WP080_HASH`, sentinel `finalStateHash`) with no behaviour
change; Seed-PAR is hero-agnostic and unaffected. The `[keyword:Transform]` runtime + the
`hero-mechanic-ledger` `transform` flip are named follow-up WPs. Drafted + executed 2026-09-06; not yet
landed (pending commit/PR).
