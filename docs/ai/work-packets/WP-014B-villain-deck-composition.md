# WP-014B — Villain Deck Composition Rules & Registry Integration

**Status:** Ready (decisions accepted in DECISIONS.md D-1410 through D-1413)
**Primary Layer:** Game Engine / Setup / Rules Definition
**Dependencies:** WP-014A
**Blocks:** Real villain deck population at runtime

---

## Session Context

WP-014A implemented the Villain Reveal Pipeline (card reveal, classification,
triggers, routing) independent of deck origin. That work deliberately deferred
villain deck construction due to four unresolved registry and rules-data gaps.

This packet closes those gaps and implements `buildVillainDeck` in a single
session:

- **Phase 1:** Make 4 decisions about ext_id conventions, card counts, and
  the registry interface. Record all decisions in `DECISIONS.md`.
- **Phase 2:** Implement `buildVillainDeck` as a pure function using those
  decisions.
- **Phase 3:** Wire into `buildInitialGameState`, write tests.

No reveal pipeline changes. No new moves. No new triggers.

---

## Problem Statement (Why This Packet Exists)

The current registry schema and game setup contracts do not provide sufficient
information to deterministically construct a villain deck. Specifically:

1. **Henchmen** — exist only at group level in the registry
   (`SetData.henchmen` is `z.array(z.unknown())`). Have no individual card
   entries, no `cards` sub-array, and no ext_ids. Physical copies are
   identical but must be individually representable in `G.villainDeck.deck`.

2. **Scheme Twists** — have no card-level identifiers. `Scheme.cards` is
   `{ abilities: string[] }[]` — no slug, key, or ext_id. Count varies by
   scheme but that count is not stored in the current schema.

3. **Deck Counts** — not in `MatchSetupConfig`. Depend on rules (player
   count, scheme). No existing contract specifies where these live.

4. **Mastermind Strikes** — partial information exists (`MastermindCard.tactic`
   boolean). The ext_id filtering convention and the mapping from
   `config.mastermindId` to underlying card keys must be made explicit.

Implementing `buildVillainDeck` without resolving these requires guesswork,
which is prohibited.

---

## Goal

Define authoritative, deterministic rules for villain deck construction,
then implement `buildVillainDeck` so that:

- Every card placed in the villain deck has a valid `CardExtId`
- All card counts are decidable at setup time from config + player count
- The registry -> setup -> `G` boundary is respected
- `buildVillainDeck` is a pure function (no I/O, no randomness except shuffle)
- Replays and snapshots remain valid long-term
- `G.villainDeck` and `G.villainDeckCardTypes` are populated with real data

---

## Execution Checklist

WP-014B intentionally has no execution checklist.

The decisions recorded in `DECISIONS.md` (D-1410 through D-1413) are the
executable contract. The implementation phase of WP-014B is mechanically
constrained by those decisions and introduces no discretionary logic beyond
them — `buildVillainDeck` is a direct translation of the adopted conventions
into code.

Adding an EC here would duplicate governance without increasing enforcement.

If WP-014B is later split into separate decision and implementation packets,
the implementation packet would receive an EC at that time.

---

## Explicit Non-Goals

This packet does **not**:

- Modify the reveal pipeline (WP-014A)
- Add new gameplay rules, moves, or triggers
- Add persistence or database logic
- Modify WP-015 through WP-020
- Add henchman or scheme twist cards as real entries in registry set files
  (see "Virtual Cards" below)

---

## Design Approach: Virtual Cards (Not Registry Expansion)

The villain deck contains card types that do not exist as individual entries
in the registry: henchmen (group-level only) and scheme twists (no card-level
identifiers). Two approaches were considered:

**Rejected: Add real card instances to the registry.**
This would require modifying 40+ set JSON files, extending `flattenSet()`,
updating `SetDataSchema`, and expanding `FlatCard.cardType` from 4 to 6+
values. This is a massive cross-layer refactor disproportionate to the need.

**Chosen: Virtual cards generated at setup time.**
`buildVillainDeck` generates `CardExtId` strings for henchmen and scheme
twists using deterministic naming conventions. These ext_ids exist only in
`G.villainDeck.deck` and `G.villainDeckCardTypes` — they are never stored in
the registry. The registry provides the source data (group slugs, scheme
identity); the engine generates the card instances.

This is consistent with the existing pattern: `BYSTANDER_EXT_ID` is already
a well-known constant (`'bystander'`) that exists only in the engine, not as
a registry entry with card data.

**Virtual card hard limits:**
- Exist only as `CardExtId` strings in `G`
- Have no intrinsic metadata beyond their `RevealedCardType` classification
- Must not be queried for cost, attack, VP, or text
- Must derive all behaviour from rule triggers and game context

Any virtual card that requires intrinsic data must graduate to a
registry-backed card in a future packet.

---

## Player Count as a Rules Input (Locked)

Player count (`context.ctx.numPlayers`) is a valid and authoritative input to
villain deck composition rules.

Derived quantities (e.g., bystanders added to the villain deck) may depend on
player count, but may not be overridden via `MatchSetupConfig` or UI-level
configuration. Introducing a config override (e.g., `villainBystandersCountOverride`)
would fracture replay equivalence and is prohibited without a new DECISIONS.md entry.

---

## Base Legendary Rules Lock (MVP)

Unless explicitly overridden by a future DECISIONS.md entry:
- Henchmen contribute **10** copies per group
- Scheme twists contribute **8** copies per scheme
- Villain-deck bystanders contribute **1 per player**

These values define the MVP ruleset and are considered authoritative.
They live as named constants in the game-engine setup layer.

---

## Scope — Decisions to Make (Phase 1)

### A) Henchman Card Instancing Rules

Define:
- How many cards each henchman group contributes to the villain deck
- The `CardExtId` convention for identical copies

**Adopted convention (authoritative — must not be inferred, overridden, or
parameterized without a new DECISIONS.md entry):**
- Count: 10 copies per henchman group (standard Legendary rule for 1-5
  players). If future expansions change this, the count becomes a parameter.
- ext_id format: `henchman-{groupSlug}-{index}` where `{index}` is
  zero-padded (e.g., `henchman-doombot-legion-00` through
  `henchman-doombot-legion-09`). Namespaced to prevent collision with
  villain card slugs and to allow unambiguous identification in logs
  and replays.
- All copies map to `RevealedCardType: 'henchman'` in `villainDeckCardTypes`
- `config.henchmanGroupIds` contains group-level identifiers. The mapping
  from config ID to henchman group data must be documented.

**Required DECISIONS.md entry:** ext_id convention, copy count, and how
`config.henchmanGroupIds` values map to `SetData.henchmen[].slug`.

### B) Scheme Twist Card Model

Define:
- Whether scheme twists are generic or per-scheme virtual cards
- How many twists each scheme contributes
- The `CardExtId` naming convention

**Adopted convention (authoritative — must not be inferred, overridden, or
parameterized without a new DECISIONS.md entry):**
- Scheme twists are generic in behaviour but **scheme-scoped in identity**.
  All scheme twists are functionally identical (the scheme's rules determine
  behaviour, not the card itself), but their ext_ids reflect the active
  scheme to preserve auditability and replay clarity.
- ext_id format: `scheme-twist-{schemeSlug}-{index}` where `{index}` is
  zero-padded (e.g., `scheme-twist-midtown-bank-robbery-00` through
  `scheme-twist-midtown-bank-robbery-07`)
- Default count: 8 (standard Legendary rule). The count may vary per scheme
  in future expansions — if so, scheme metadata must carry a `twistCount`
  field. For MVP, use constant 8.
- All copies map to `RevealedCardType: 'scheme-twist'` in `villainDeckCardTypes`

**Important constraint:** scheme twist ext_ids must be unique within the deck
so that rule effects and replay logs can target individual reveal events.
Using indexed ext_ids (`scheme-twist-0`, `scheme-twist-1`, ...) satisfies
this.

**Required DECISIONS.md entry:** generic vs per-scheme, count source, ext_id
convention.

### C) Bystander Contribution to Villain Deck

Clarify the two distinct bystander pools:
- `config.bystandersCount` sizes the **bystander pile** (the supply that
  players rescue from). This is NOT the villain deck contribution.
- The villain deck receives a **separate, rules-derived count** of bystanders,
  typically 1 per player in standard Legendary rules.

**Adopted convention (authoritative — must not be inferred, overridden, or
parameterized without a new DECISIONS.md entry):**
- Villain deck bystander count: `context.ctx.numPlayers` (1 per player)
- ext_id: reuse existing `BYSTANDER_EXT_ID` (`'bystander'`). Since bystanders
  are functionally identical, duplicates in the deck are acceptable. However,
  for replay targeting, indexed ext_ids may be preferred:
  `bystander-villain-deck-{index}` (e.g., `bystander-villain-deck-0` through
  `bystander-villain-deck-3` for a 4-player game).
- All copies map to `RevealedCardType: 'bystander'` in `villainDeckCardTypes`

**Required DECISIONS.md entry:** count derivation rule, whether to use indexed
ext_ids or reuse `BYSTANDER_EXT_ID`, relationship to `config.bystandersCount`.

**Note:** D-1412 locks the *count* of bystanders in the villain deck (1 per
player). If the ext_id format is not explicitly specified in D-1412, Phase 1
of WP-014B confirms the ext_id convention before implementation and records
a D-1412 amendment if required. This step confirms whether D-1412 already
specifies the ext_id format. It is not an opportunity to redesign the rule,
only to record an explicit amendment if the format is missing.

### D) Mastermind Strike Identification Contract

Mastermind strikes are identified exclusively by the `tactic !== true`
contract on `MastermindCard` entries. This is a **registry schema guarantee**,
not a heuristic — there is no separate `cardType` slug on individual
mastermind cards.
- `config.mastermindId` is a mastermind-level ext_id. The implementation must
  map it to `SetData.masterminds[].slug` to find the correct mastermind, then
  iterate its `cards` array.

**Adopted convention (authoritative — must not be inferred, overridden, or
parameterized without a new DECISIONS.md entry):**
- ext_id: use existing FlatCard key format
  `{setAbbr}-mastermind-{mastermindSlug}-{cardSlug}` for each non-tactic card
- Classification: `RevealedCardType: 'mastermind-strike'`
- `// why:` comment required on the `tactic !== true` filter explaining that
  `FlatCard.cardType` is only `"mastermind"` for all mastermind cards — the
  strike vs tactic distinction comes from the `tactic` boolean field on
  `MastermindCard` in the per-set data

**Required DECISIONS.md entry:** identification mechanism, ext_id mapping
from `config.mastermindId` to FlatCard keys, `tactic` field interpretation.

### E) Ownership — Where These Rules Live

| Rule | Lives In | Rationale |
|---|---|---|
| Card ext_id format conventions | `ARCHITECTURE.md` + `DECISIONS.md` | Cross-cutting contract |
| Henchman copies per group | Game engine constant | Rules-layer value |
| Scheme twist count | Game engine constant (MVP: 8) | Rules-layer value; future: scheme metadata |
| Bystanders-in-villain-deck count | Derived from `ctx.numPlayers` | Rules-layer derivation |
| Mastermind strike identification | `tactic !== true` on `MastermindCard` | Registry schema contract |
| `config.*Id` to registry slug mapping | `buildVillainDeck` implementation | Setup-layer logic |

Copy-count constants live in the game-engine setup layer (e.g., in
`villainDeck.setup.ts`), not in the registry or in `MatchSetupConfig`.
Player-count-dependent values are derived from `context.ctx.numPlayers` at
setup time.

### Config-to-Registry Mapping (Required Before Implementation)

Before any code is written, the executor must verify and document a 1:1
mapping statement for each config field to its registry data source:
- `villainGroupIds` -> `SetData.villains[].slug`
- `henchmanGroupIds` -> `SetData.henchmen[].slug`
- `schemeId` -> `SetData.schemes[].slug`
- `mastermindId` -> `SetData.masterminds[].slug`

The mapping statement must be written before any code appears in the diff.
If the mapping statement cannot be written unambiguously, STOP.

---

## Scope — Implementation (Phase 2 + 3)

At the start of Phase 2, all decisions are considered closed. No further
interpretation or invention is permitted. Implementation is a direct
translation of the adopted conventions into code.

### F) `VillainDeckRegistryReader` interface — new

Define a wider setup-time registry interface local to `game-engine` that
`buildVillainDeck` accepts as a parameter. This interface must:

- NOT import from `@legendary-arena/registry`
- Be satisfied structurally by the real `CardRegistry` from the registry
  package
- Expose the minimum methods needed to resolve cards by group, scheme, and
  mastermind

Read `packages/registry/src/types/index.ts` (`CardRegistry` interface) to
determine the exact method subset. Required methods:
- `listCards(): Array<{ key: string; cardType: string; slug: string; setAbbr: string }>`
  — for villain card ext_ids, since `FlatCard.key` already encodes the
  canonical ext_id format `{setAbbr}-villain-{groupSlug}-{cardSlug}`.
  Prefer this over manually reconstructing keys from SetData.
- `listSets(): Array<{ abbr: string }>` — enumerate loaded sets
- `getSet(abbr: string): unknown` — access per-set data for traversal of
  henchmen, schemes, and masterminds (where FlatCard is insufficient)

The `SetData` return from `getSet` must be handled structurally (cast or
validate at runtime) since game-engine cannot import the registry's types.
Define minimal structural types locally for the fields you traverse
(henchmen, masterminds and their cards, schemes).

### G) `src/villainDeck/villainDeck.setup.ts` — new

`buildVillainDeck(config, registry, context)` — pure function that:
1. Resolves villain cards from `config.villainGroupIds` via registry
   — tags each as `'villain'`
2. Resolves henchman cards from `config.henchmanGroupIds` via registry
   — generates indexed virtual ext_ids, tags each as `'henchman'`
3. Generates scheme twist virtual cards using the decided count and
   ext_id convention — tags each as `'scheme-twist'`
4. Generates bystander virtual cards (count from `context.ctx.numPlayers`)
   — tags each as `'bystander'`
5. Resolves mastermind strike cards from `config.mastermindId` via registry
   — filters by `tactic !== true`, tags each as `'mastermind-strike'`
6. Combines all cards into one deck array, then sorts lexically before
   shuffling — registry list ordering may vary depending on load order;
   stable pre-shuffle ordering ensures the same inputs always generate the
   same pre-shuffle sequence, making `shuffleDeck` fully deterministic
7. Shuffles the sorted deck using `shuffleDeck(sortedDeck, context)`.
   This shuffle step MUST be preceded by the explicit lexical sort in step 6.
   Relying on registry iteration order is forbidden.
8. Returns `{ state: { deck: shuffled, discard: [] }, cardTypes }`

- Uses `for...of` loops — no `.reduce()`
- `// why:` comments on shuffle, tactic filter, and count constants

### H) `src/setup/buildInitialGameState.ts` — modified

Replace the empty defaults added by WP-014A with the real
`buildVillainDeck` call:

```typescript
const villainDeckResult = buildVillainDeck(config, registry, context);
// ...
villainDeck: villainDeckResult.state,
villainDeckCardTypes: villainDeckResult.cardTypes,
```

The `_registry` parameter (currently unused underscore) is renamed to
`registry` since it is now consumed.

### I) Tests — `src/villainDeck/villainDeck.setup.test.ts` — new

Uses `node:test` and `node:assert` only. Uses `makeMockCtx`. Does not import
from `boardgame.io`. Uses mock registry data matching real schema shapes.

Tests (at minimum):
1. `buildVillainDeck` produces a non-empty deck for a valid config
2. Every card in the deck has an entry in `cardTypes`
3. Deck is shuffled (order differs from insertion order via `makeMockCtx`
   reversal)
4. `Object.keys(cardTypes)` is a subset of unique deck IDs, and every
   unique deck ID has a `cardTypes` entry
5. Henchman copies: correct count per group, correct ext_id format
6. Scheme twist copies: correct count, correct ext_id format
7. Bystander copies: count matches `numPlayers`
8. Mastermind strikes: only non-tactic cards included
9. `JSON.stringify({ state, cardTypes })` succeeds (serialization proof)
10. All `cardTypes` values are members of `REVEALED_CARD_TYPES`

### J) Exports — `src/index.ts` — modified

Add `buildVillainDeck` as a named public export.
If `VillainDeckRegistryReader` is a public contract, export it as well.

---

## Files Expected to Change

- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` — **new** —
  `buildVillainDeck`, `VillainDeckRegistryReader`
- `packages/game-engine/src/villainDeck/villainDeck.setup.test.ts` — **new** —
  setup tests (10+)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  replace empty defaults with real `buildVillainDeck` call
- `packages/game-engine/src/index.ts` — **modified** — export
  `buildVillainDeck`

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail.

### Decisions
- [ ] Every villain deck component has an ext_id convention documented in
      `DECISIONS.md`
- [ ] Every villain deck component has a deterministic count source
- [ ] No placeholder or temporary conventions exist
- [ ] A developer can read `DECISIONS.md` and `ARCHITECTURE.md` and know
      exactly how the villain deck is composed without reading code

### Implementation
- [ ] `buildVillainDeck` is a pure function — no I/O, no `Math.random()`,
      only `shuffleDeck` for randomness
- [ ] `buildVillainDeck` does not import `@legendary-arena/registry`
- [ ] `VillainDeckRegistryReader` is defined locally in game-engine and
      satisfied structurally by the real `CardRegistry`
- [ ] `buildInitialGameState` calls `buildVillainDeck` and populates
      `G.villainDeck` and `G.villainDeckCardTypes` with real data
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No files outside scope were modified

### Tests
- [ ] All new tests pass
- [ ] Henchman copy count and ext_id format verified
- [ ] Scheme twist count and ext_id format verified
- [ ] Bystander count matches `numPlayers`
- [ ] Mastermind strikes exclude tactic cards
- [ ] All `cardTypes` values are valid `RevealedCardType` members

---

## Definition of Done

This packet is complete when:

- [ ] All acceptance criteria pass
- [ ] `DECISIONS.md` updated with one entry per resolved gap
- [ ] `ARCHITECTURE.md` updated with "Deck Composition Contract" section
      documenting ext_id conventions and count rules
- [ ] `docs/ai/STATUS.md` updated — villain deck fully populated from
      registry at setup time
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-014B checked off

---

## Relationship to Other Packets

| Packet | Relationship |
|---|---|
| WP-014A | Provides reveal & trigger pipeline; provides `VillainDeckState` and `RevealedCardType` types |
| WP-014B | This packet — enables real deck construction |
| WP-015 | Unblocked by WP-014A for implementation (City routing); will consume real deck data from WP-014B at runtime |
| WP-016 | Consumes City state (no dependency on deck composition) |
| WP-017 | Consumes bystander reveal events (triggered by 014A pipeline; bystander ext_ids finalized by 014B) |
| WP-019 | Consumes mastermind tactic cards (014B defines strike identification; tactics are a separate concern) |
