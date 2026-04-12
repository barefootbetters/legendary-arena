# Session Execution Prompt — WP-014B: Villain Deck Composition Rules & Registry Integration

**Pre-flight:** `docs/ai/invocations/preflight-wp014b-villain-deck-composition.md`
**Pre-flight verdict:** READY TO EXECUTE (2026-04-11)
**Execution contract:** DECISIONS.md D-1410 through D-1413 (no EC — decisions are the contract)

---

## Instruction to Claude Code

You are executing **WP-014B — Villain Deck Composition Rules & Registry Integration**.

This session implements `buildVillainDeck` and replaces the empty defaults
added by WP-014A with real villain deck data resolved from the registry at
setup time. After this session:

- `G.villainDeck.deck` contains a shuffled array of `CardExtId` strings
  (villain cards + henchman virtual copies + scheme twist virtual copies +
  bystander virtual copies + mastermind strike cards)
- `G.villainDeckCardTypes` maps every card in the deck to its
  `RevealedCardType` classification
- `buildVillainDeck` is a pure function that receives config, registry, and
  setup context
- `VillainDeckRegistryReader` is a locally-defined structural interface
  satisfied by the real `CardRegistry`
- 10+ new tests verify composition, counts, ext_id formats, and serialization

**You are implementing. You are not planning, researching, or exploring.**

**The reveal pipeline (WP-014A) must NOT be modified.** Do not touch
`villainDeck.reveal.ts`, `villainDeck.types.ts`, or any WP-014A test files.

---

## Execution Phases

This session has 3 phases executed in order:

**Phase 1 — Confirm Decisions and Verify Mappings (before writing code)**
- Confirm bystander ext_id convention (check D-1412)
- Verify all 4 config-to-registry slug mappings
- Write the mapping statement
- Record any amendments

**Phase 2 — Implement `buildVillainDeck`**
- Create `VillainDeckRegistryReader` interface
- Create count constants
- Create `buildVillainDeck` pure function

**Phase 3 — Wire and Test**
- Replace empty defaults in `buildInitialGameState`
- Export new public API
- Write 10+ tests
- Build, test, verify

---

## Authority Chain (Read Before Writing Code)

Read these documents **in this exact order** before writing any code.
If conflicts exist, higher-authority documents win.

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
   - Section 1: Package import rules
   - Section 3: Field Classification Reference (villainDeckCardTypes entry)
   - Section 4: Villain Deck Authority Boundary + Registry Access Rule
3. `docs/ai/work-packets/WP-014B-villain-deck-composition.md`
4. `DECISIONS.md` D-1410 through D-1413 (these are the execution contract)
5. `docs/ai/REFERENCE/00.6-code-style.md` (key rules: 4, 6, 8, 13)

---

## Read Before Implementing (Mandatory)

Read each of these files in full before writing any code:

- `packages/game-engine/src/setup/buildInitialGameState.ts` — current setup
  orchestrator with empty villain deck defaults to replace
- `packages/game-engine/src/villainDeck/villainDeck.types.ts` — types to
  import (DO NOT MODIFY)
- `packages/game-engine/src/setup/shuffle.ts` — `shuffleDeck` and
  `ShuffleProvider` interface
- `packages/game-engine/src/test/mockCtx.ts` — `makeMockCtx` (reverses arrays)
- `packages/game-engine/src/matchSetup.types.ts` — `MatchSetupConfig` fields
- `packages/game-engine/src/matchSetup.validate.ts` — `CardRegistryReader`
  pattern (how a local interface is defined for layer boundary)
- `packages/game-engine/src/types.ts` — `SetupContext` interface
- `packages/game-engine/src/index.ts` — current exports
- `packages/registry/src/types/index.ts` — full `CardRegistry` interface
  (to determine minimum methods for `VillainDeckRegistryReader`)
- `packages/registry/src/schema.ts` — `SetDataSchema`, `VillainGroupSchema`,
  `VillainCardSchema`, `MastermindSchema`, `MastermindCardSchema`,
  `SchemeSchema` (data shapes for traversal)
- `data/cards/core.json` — sample set file to understand actual data shapes
  (especially `henchmen`, `villains`, `masterminds`, `schemes`)

---

## Adopted Conventions (From DECISIONS.md — Do Not Re-Derive)

### D-1410: Henchman Virtual Cards

- **Count:** 10 copies per henchman group (game-engine constant)
- **ext_id:** `henchman-{groupSlug}-{index}` zero-padded
  (e.g., `henchman-doombot-legion-00` through `henchman-doombot-legion-09`)
- **Classification:** `'henchman'`
- Namespaced to prevent collision with villain card slugs

### D-1411: Scheme Twist Virtual Cards

- **Count:** 8 per scheme (game-engine constant; future: per-scheme metadata)
- **ext_id:** `scheme-twist-{schemeSlug}-{index}` zero-padded
  (e.g., `scheme-twist-midtown-bank-robbery-00`)
- **Classification:** `'scheme-twist'`
- Scheme-scoped in identity for replay auditability

### D-1412: Composition Counts Are Rules-Driven

- Henchman copies per group: **10**
- Scheme twist count: **8**
- Bystanders in villain deck: **1 per player** (`context.ctx.numPlayers`)
- Bystanders in villain deck are SEPARATE from `config.bystandersCount`
  (which sizes the bystander pile)
- Mastermind strikes: all non-tactic cards (count from mastermind data)

### D-1413: Mastermind Strike Identification

- Identified by `tactic !== true` on `MastermindCard`
- This is a **registry schema contract**, not a heuristic
- ext_id: use FlatCard key format `{setAbbr}-mastermind-{mastermindSlug}-{cardSlug}`
- Classification: `'mastermind-strike'`

### Base Rules Lock (MVP Constants)

```typescript
const HENCHMAN_COPIES_PER_GROUP = 10;
const SCHEME_TWIST_COUNT = 8;
// Bystander count = context.ctx.numPlayers (derived, not a constant)
```

### Bystander ext_id Convention (Confirm or Amend D-1412)

Check D-1412 in DECISIONS.md. If it already specifies the villain-deck
bystander ext_id format, treat it as locked and do not revisit it. If D-1412
specifies the count but not the ext_id format, resolve the ext_id format now
and record a D-1412 amendment.

Options if not yet locked:
- **Option A (recommended):** `bystander-villain-deck-{index}` zero-padded
  — consistent with henchman and scheme twist patterns, enables replay
  targeting of individual bystander reveal events
- **Option B:** reuse `BYSTANDER_EXT_ID` (`'bystander'`) with duplicates
  — simpler but prevents replay targeting of individual bystanders

Record the decision in a `// why:` comment in the code. This step confirms
whether D-1412 already specifies the ext_id format. It is not an opportunity
to redesign the rule, only to record an explicit amendment if the format is
missing.

---

## Non-Negotiable Constraints

### Engine-Wide (Always Apply)

- Never use `Math.random()` — all randomness via `shuffleDeck`
- `G` must be JSON-serializable at all times
- ESM only, Node v22+ — `import`/`export` only, never `require()`
- `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` extension
- No database or network access
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

### Packet-Specific

- No module-scope import of `@legendary-arena/registry` — define
  `VillainDeckRegistryReader` locally, satisfied structurally by `CardRegistry`
- `buildVillainDeck` is a pure function — no I/O, no side effects, only
  `shuffleDeck` for randomness
- No `.reduce()` — use `for...of`
- No modification of WP-014A files (`villainDeck.types.ts`,
  `villainDeck.reveal.ts`, `villainDeck.types.test.ts`,
  `villainDeck.reveal.test.ts`)
- Tests use `makeMockCtx` — do not modify shared test helpers
- Virtual cards have no intrinsic metadata — no cost, attack, VP, or text
- `Game.setup()` may throw — `buildVillainDeck` may throw on invalid
  registry data (setup-time code, not a move)
- Pre-shuffle deck must be sorted lexically for deterministic input ordering

### Absolute Exclusions

- **No modification of `villainDeck.types.ts`** (WP-014A, committed)
- **No modification of `villainDeck.reveal.ts`** (WP-014A, committed)
- **No modification of WP-014A test files**
- No new moves, triggers, or effects
- No City or HQ logic (WP-015)
- No registry set JSON file modifications
- No `makeMockCtx` modifications
- No refactors, cleanups, or "while I'm here" improvements

---

## Scope Lock

### Allowed Files (Exhaustive)

| Action | File | Purpose |
|---|---|---|
| Create | `src/villainDeck/villainDeck.setup.ts` | `buildVillainDeck`, `VillainDeckRegistryReader`, count constants, local structural types |
| Create | `src/villainDeck/villainDeck.setup.test.ts` | 10+ composition tests |
| Modify | `src/setup/buildInitialGameState.ts` | Replace empty defaults with `buildVillainDeck` call |
| Modify | `src/index.ts` | Export `buildVillainDeck`, `VillainDeckRegistryReader` |
| Update | `docs/ai/STATUS.md` | Villain deck fully populated |
| Update | `docs/ai/ARCHITECTURE.md` | Add Deck Composition Contract section |
| Update | `docs/ai/work-packets/WORK_INDEX.md` | Check off WP-014B |

All paths are relative to `packages/game-engine/` unless they start with `docs/`.

**Rule:** Any file not listed above is out of scope. Do not modify it.

---

## Implementation Order

Execute in this exact sequence. Do not skip ahead.

### Phase 1: Confirm Decisions and Verify Mappings

**1a. Confirm bystander ext_id convention.**
Check D-1412 in DECISIONS.md. If it specifies the count but not the ext_id
format, resolve now using one of the two options above. Record the decision.

**1b. Verify config-to-registry mapping for villain groups.**
Read `data/cards/core.json` to understand actual data. Examine FlatCard key
patterns for villain cards via `listCards()`. Determine how
`config.villainGroupIds` values map to villain group slugs embedded in
FlatCard keys (`{setAbbr}-villain-{groupSlug}-{cardSlug}`).

**1c. Verify config-to-registry mapping for henchman groups.**
Examine `SetData.henchmen` entries via `getSet()`. Determine how
`config.henchmanGroupIds` values map to henchman `slug` fields.

**1d. Verify config-to-registry mapping for mastermind.**
Examine `SetData.masterminds` entries and `MastermindCard` structure via
`getSet()`. Determine how `config.mastermindId` maps to `masterminds[].slug`,
and how to construct FlatCard-format ext_ids for non-tactic cards.

**1e. Verify config-to-registry mapping for scheme.**
Examine `SetData.schemes` entries via `getSet()`. Determine how
`config.schemeId` maps to `schemes[].slug` for constructing scheme-twist
ext_ids.

**1f. Write the mapping statement (required).**
Before writing any code, write a short mapping note (to be placed as a
`// why:` comment in the implementation) that states exactly which field
is matched against which registry slug:
- `villainGroupIds` -> `SetData.villains[].slug`
- `henchmanGroupIds` -> `SetData.henchmen[].slug`
- `schemeId` -> `SetData.schemes[].slug`
- `mastermindId` -> `SetData.masterminds[].slug`
If any mapping is not 1:1, STOP and ask the human.

The mapping statement must be written before any code appears in the diff.
If the mapping statement cannot be written unambiguously, STOP.

### Phase 2: Implement

At the start of Phase 2, all decisions are considered closed. No further
interpretation or invention is permitted.

**2a. Create `VillainDeckRegistryReader` interface.**

Define in `src/villainDeck/villainDeck.setup.ts`. This is a locally-defined
structural interface that `CardRegistry` satisfies without importing it.

Required methods:
- `listCards(): Array<{ key: string; cardType: string; slug: string; setAbbr: string }>`
  — for villain card ext_ids, since `FlatCard.key` already encodes the
  canonical ext_id format `{setAbbr}-villain-{groupSlug}-{cardSlug}`.
  Prefer this over manually reconstructing keys from SetData.
- `listSets(): Array<{ abbr: string }>` — enumerate loaded sets
- `getSet(abbr: string): unknown` — access per-set data for traversal of
  henchmen, schemes, and masterminds (where FlatCard is insufficient)

Define minimal structural types locally for the SetData fields you traverse
(henchmen entries, mastermind entries and their cards, scheme entries). These
are structural subsets — not imports from the registry package.

`// why: game-engine must not import @legendary-arena/registry; this
interface is satisfied structurally by CardRegistry`

**2b. Create count constants.**

```typescript
/** Number of identical copies per henchman group in the villain deck. */
// why: standard Legendary base rule (MVP); see D-1412
const HENCHMAN_COPIES_PER_GROUP = 10;

/** Number of scheme twist cards added to the villain deck. */
// why: standard Legendary base rule (MVP); see D-1412
const SCHEME_TWIST_COUNT = 8;
```

Bystander count is derived from `context.ctx.numPlayers`, not a constant.

**2c. Implement `buildVillainDeck`.**

`buildVillainDeck(config, registry, context)` — pure function:

1. For each `config.villainGroupIds` entry:
   - Use `registry.listCards()` to find all FlatCards where
     `cardType === 'villain'` and the key matches the group slug
   - Collect the `FlatCard.key` values as ext_ids
   - Tag each as `'villain'` in `cardTypes`
2. For each `config.henchmanGroupIds` entry:
   - Use `registry.listSets()` + `registry.getSet()` to find the matching
     henchman group by slug
   - Generate `HENCHMAN_COPIES_PER_GROUP` virtual ext_ids:
     `henchman-{groupSlug}-{00..09}`
   - Tag each as `'henchman'`
3. For `config.schemeId`:
   - Use `getSet()` to find the matching scheme by slug
   - Generate `SCHEME_TWIST_COUNT` virtual ext_ids:
     `scheme-twist-{schemeSlug}-{00..07}`
   - Tag each as `'scheme-twist'`
4. For bystanders:
   - Generate `context.ctx.numPlayers` virtual ext_ids using the convention
     confirmed in Phase 1
   - Tag each as `'bystander'`
5. For `config.mastermindId`:
   - Use `getSet()` to find the matching mastermind by slug
   - Filter `mastermind.cards` where `tactic !== true`
   - Construct ext_ids: `{setAbbr}-mastermind-{mastermindSlug}-{cardSlug}`
   - Tag each as `'mastermind-strike'`
   - `// why: tactic !== true identifies strikes; this is a registry schema
     contract (D-1413), not a heuristic`
6. Combine all cards into one deck array
7. Sort the combined deck lexically before shuffling
   - `// why: registry list ordering may vary depending on load order;
     stable pre-shuffle ordering ensures deterministic shuffles`
8. Shuffle via `shuffleDeck(sortedDeck, context)`. This shuffle step MUST
   be preceded by the explicit lexical sort in step 7. Relying on registry
   iteration order is forbidden.
   - `// why: ctx.random.Shuffle provides deterministic shuffling`
9. Return `{ state: { deck: shuffled, discard: [] }, cardTypes }`

- Uses `for...of` loops throughout — no `.reduce()`
- Throws on invalid registry data (setup-time code may throw)

### Phase 3: Wire and Test

**3a. Replace empty defaults in `buildInitialGameState.ts`.**

Import `buildVillainDeck` from `../villainDeck/villainDeck.setup.js`.

Rename `_registry` parameter to `registry` (remove underscore since it's
now consumed). Update the JSDoc `@param` description.

Replace the empty defaults:
```typescript
const villainDeckResult = buildVillainDeck(config, registry, context);
// ...
villainDeck: villainDeckResult.state,
villainDeckCardTypes: villainDeckResult.cardTypes,
```

Remove the `// why: WP-014B will populate from registry` comment (it's now
populated). Replace with: `// why: villain deck built from registry data at
setup time; see D-1410 through D-1413`

**3b. Export new public API in `index.ts`.**

```typescript
export { buildVillainDeck } from './villainDeck/villainDeck.setup.js';
export type { VillainDeckRegistryReader } from './villainDeck/villainDeck.setup.js';
```

**3c. Create tests in `villainDeck.setup.test.ts`.**

Uses `node:test` and `node:assert` only. Uses `makeMockCtx`. Does NOT
import from `boardgame.io`. Uses mock registry data matching real schema
shapes.

Create a mock registry object that satisfies `VillainDeckRegistryReader`
with test data: at least one villain group with multiple cards, one henchman
group, one scheme, and one mastermind with both tactic and non-tactic cards.

**10+ tests:**

1. `buildVillainDeck` produces a non-empty deck for a valid config
2. Every card in the deck has an entry in `cardTypes`
3. Deck is shuffled (order differs from insertion order via `makeMockCtx`
   reversal)
4. `Object.keys(cardTypes)` is a subset of unique deck IDs, and every
   unique deck ID has a `cardTypes` entry
5. Henchman copies: correct count per group (10), correct ext_id format
   (`henchman-{slug}-{00..09}`)
6. Scheme twist copies: correct count (8), correct ext_id format
   (`scheme-twist-{slug}-{00..07}`)
7. Bystander copies: count matches `numPlayers`
8. Mastermind strikes: only non-tactic cards included; tactic cards excluded
9. `JSON.stringify({ state, cardTypes })` succeeds (serialization proof)
10. All `cardTypes` values are valid `REVEALED_CARD_TYPES` members

### Step 4: Build & Test

```bash
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
```

All existing tests plus the 10+ new WP-014B tests must pass.
No pre-existing test failures are permitted.

### Step 5: Verification Commands

On Windows/PowerShell, replace `grep` with `Select-String`. Use one
consistently. The Grep tool is also acceptable.

```bash
# No registry import in villainDeck.setup.ts
grep "@legendary-arena/registry" packages/game-engine/src/villainDeck/villainDeck.setup.ts
# Expected: no output

# No Math.random in new files
grep "Math.random" packages/game-engine/src/villainDeck/villainDeck.setup.ts
# Expected: no output

# No .reduce() in new files
grep "\.reduce(" packages/game-engine/src/villainDeck/villainDeck.setup.ts
# Expected: no output

# No require() in new files
grep "require(" packages/game-engine/src/villainDeck/villainDeck.setup.ts
# Expected: no output

# WP-014A files unchanged
git diff --name-only -- packages/game-engine/src/villainDeck/villainDeck.types.ts packages/game-engine/src/villainDeck/villainDeck.reveal.ts packages/game-engine/src/villainDeck/villainDeck.types.test.ts packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts
# Expected: no output (no changes)

# All changed files within scope
git diff --name-only

# Catch stray/untracked files
git status --porcelain
# Expected: only allowed files appear as modified/added; no stray files
```

### Step 6: Governance Updates

- **`docs/ai/STATUS.md`** — villain deck fully populated from registry at
  setup time; all 5 card types represented; WP-015 has real deck data
- **`docs/ai/ARCHITECTURE.md`** — add "Deck Composition Contract" subsection
  near the Villain Deck Authority Boundary section, documenting:
  - ext_id conventions for each card type
  - count rules and their sources
  - pre-shuffle sort requirement
  - virtual card hard limits
- **`docs/ai/work-packets/WORK_INDEX.md`** — check off WP-014B with today's
  date

**Note:** DECISIONS.md D-1410 through D-1413 already exist. If the bystander
ext_id convention was confirmed or amended, update D-1412 accordingly.
Do not re-add existing decisions.

---

## Required `// why:` Comments

- Count constants: `// why: standard Legendary base rule (MVP); see D-1412`
- Shuffle call: `// why: ctx.random.Shuffle provides deterministic shuffling`
- Pre-shuffle sort: `// why: registry list ordering may vary; stable
  pre-shuffle ordering ensures deterministic shuffles`
- Tactic filter: `// why: tactic !== true identifies strikes; this is a
  registry schema contract (D-1413), not a heuristic`
- Bystander ext_id convention: `// why:` explaining the confirmed format
- Config-to-slug mapping: `// why:` stating the field-to-slug mapping
  (from Phase 1f mapping statement)
- `VillainDeckRegistryReader`: `// why: game-engine must not import
  @legendary-arena/registry; this interface is satisfied structurally`
- Villain deck in `buildInitialGameState`: `// why: villain deck built from
  registry data at setup time; see D-1410 through D-1413`

---

## Established Patterns (Do Not Deviate)

- `VillainDeckRegistryReader` follows the `CardRegistryReader` pattern:
  local structural interface, no registry imports
- Prefer `listCards()` for villain card ext_ids (FlatCard.key is canonical);
  use `getSet()` only for henchmen, schemes, masterminds
- Pure setup functions return new values; `buildInitialGameState` assigns
  results into the returned state
- `for...of` loops for iteration — no `.reduce()`
- Pre-shuffle lexical sort is mandatory for determinism
- `shuffleDeck` for all randomness — never `Math.random()`
- Move signature unchanged — `revealVillainCard` is not touched
- `makeMockCtx` reverses arrays (proves shuffle ran) — no modifications

---

## Stop Conditions

**STOP and ask the human if:**

- The registry data shape doesn't match expectations (henchmen missing slug,
  masterminds missing cards, etc.)
- `config.villainGroupIds` values cannot be mapped 1:1 to registry villain
  groups
- Any config-to-slug mapping is not 1:1 (Phase 1f)
- A required method is missing from `CardRegistry`
- Any WP-014A file needs modification
- Build or tests fail and the cause is not immediately traceable to this WP
- The bystander ext_id decision has implications you're unsure about

Never guess. Never invent field names, type shapes, or file paths.

---

## Execution Summary (Complete After Implementation)

After all implementation is done, provide an execution summary that includes:

1. Files created and modified (with line counts)
2. Bystander ext_id convention confirmed or amended, with rationale
3. Config-to-registry mapping statement (from Phase 1f)
4. Test results (total pass/fail counts)
5. Any deviations from the locked scope, with justification
6. Any existing tests that needed value-only updates, documented
7. Verification command results (including `git status --porcelain`)
8. Confirmation that D-1410 through D-1413 conventions are correctly
   implemented in code
