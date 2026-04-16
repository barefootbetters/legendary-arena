# Session Execution Prompt — WP-033 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-033 — Content Authoring Toolkit
**Mode:** Implementation (WP-033 not yet implemented)
**Pre-Flight:** Complete (2026-04-16) — build green (367 tests, 95 suites,
0 fail), all dependencies met. All pre-session actions resolved:
- **PS-1:** D-3301 created classifying `packages/game-engine/src/content/`
  as engine code category; `02-CODE-CATEGORIES.md` §engine directories
  updated.
- **PS-2:** WP-033 §B / §C / §D / §E and EC-033 Locked Values back-synced
  to the three-parameter `validateContent(content, contentType, context?)`
  signature; `ContentValidationContext` added as a companion type.
- **RS-6:** Verified D-0601 / D-0602 / D-0603 exist in DECISIONS.md (lines
  172 / 180 / 188, em-dash IDs per P6-2).
- **RS-7:** D-3302 created — henchman author-facing schema mirrors
  `VillainCardSchema` shape for MVP (citing D-1410..D-1413 virtual-card
  precedent).

**Copilot Check:** Not yet run. Run step 1b (copilot check per
`docs/ai/REFERENCE/01.7-copilot-check.md`) before executing this prompt if
the project protocol requires it for Contract-Only WPs. If skipped, the
pre-flight verdict (READY TO EXECUTE) is sufficient authorization.

**EC:** `docs/ai/execution-checklists/EC-033-content-toolkit.checklist.md`
**Pre-flight:** `docs/ai/invocations/preflight-wp033-content-toolkit.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- Test count: 367 → **376** (9 new content validation tests, 0 existing
  test changes)
- Suite count: 95 → **96** (1 new `describe('validateContent /
  validateContentBatch (WP-033)')` block)
- All WP-033 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Runtime Wiring Allowance — NOT INVOKED

**`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` is NOT invoked by
this session prompt.**

Per 01.5 §Purpose (line 28): *"This is an allowance, not a default
right."* And per 01.5 §Escalation (line 136): *"This clause **must be
invoked in the session prompt**."* Silence therefore means the clause
does **not** apply — there is no default invocation.

Pre-flight verified WP-033 is **purely additive**, measured against the
four criteria enumerated in 01.5 §When to Include (lines 32-47):

- No new fields on `LegendaryGameState` — ABSENT
- No changes to `buildInitialGameState` return shape — ABSENT
- No new moves in `LegendaryGame.moves` — ABSENT
- No new phases or phase hooks — ABSENT

Per 01.5 §When to Include (lines 48-49): *"If a WP is purely additive
(new files only, no type or shape changes), this clause does not
apply."*

**Consequence:** the 01.5 allowance **may not be cited** during
execution or pre-commit review to justify edits outside the Scope Lock
below. If execution discovers an unanticipated structural break in an
existing test, **STOP and escalate** — do not force-fit the change.
Per 01.5 §Escalation (lines 137-138): *"It may **not** be cited
retroactively in execution summaries or pre-commit reviews to justify
undeclared changes."*

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - "Layer Boundary (Authoritative)" — content validation is game-engine
     layer logic, separate from registry Zod schemas.
   - "Architectural Principles" — #1 Determinism, #2 Engine Owns Truth
3. `docs/ai/execution-checklists/EC-033-content-toolkit.checklist.md`
4. `docs/ai/work-packets/WP-033-content-authoring-toolkit.md`
5. `docs/ai/invocations/preflight-wp033-content-toolkit.md` — read the
   §Risk & Ambiguity Review (**RS-1 through RS-9 are locked for
   execution**)
6. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 11 (full-sentence error
   messages), 13 (ESM only)
7. `docs/ai/DECISIONS.md` — read:
   - D-0601 (Content Is Data, Not Code) — line 172
   - D-0602 (Invalid Content Cannot Reach Runtime) — line 180
   - D-0603 (Representation Before Execution) — line 188
   - D-3301 (Content Directory Classified as Engine Code Category) —
     appended after D-3201
   - D-3302 (Henchman Author-Facing Schema Mirrors VillainCard Shape) —
     appended after D-3301
   - D-1204 (FlatCard.cost Is string | number | undefined) — for RS-1
     context
   - D-1410..D-1413 (henchman virtual card conventions) — for RS-7
     context

   **Note:** DECISIONS.md uses em-dashes in headings (e.g., `D‑0601`);
   grep by title keyword if the regular-hyphen ID search misses.
8. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — §engine "Directories" —
   verify `packages/game-engine/src/content/` is listed with `(D-3301)`
9. `.claude/rules/registry.md` — `packages/registry/src/schema.ts` is
   **immutable**; WP-033 **must not** modify it or import from it

**Implementation anchors (read before coding):**

10. `packages/game-engine/src/rules/heroKeywords.ts` — read
    `HERO_KEYWORDS` (line 43) and `HERO_ABILITY_TIMINGS` (line 81)
    canonical arrays and their closed-union types.
11. `packages/game-engine/src/board/boardKeywords.types.ts` — read
    `BOARD_KEYWORDS` (line 24) and `BoardKeyword` type.
12. `packages/game-engine/src/rules/heroAbility.types.ts` — read
    `HeroAbilityHook` (line 31), `HeroCondition` (line 61),
    `HeroEffectDescriptor` (line 75) for hook consistency checks.
13. `packages/game-engine/src/scheme/schemeSetup.types.ts` — read
    `SchemeSetupType`, `SchemeSetupInstruction`, and
    `SCHEME_SETUP_TYPES` (line 43).
14. `packages/game-engine/src/campaign/campaign.types.ts` — read
    `ScenarioDefinition` (line 66) — the **split
    `victoryConditions?` / `failureConditions?` shape**, NOT a single
    `conditions` array (RS-4).
15. `packages/game-engine/src/types.ts` — read the current re-export
    section. Content types will be re-exported after existing
    re-export blocks.
16. `packages/game-engine/src/index.ts` — read current exports. Content
    exports will be added at the end.
17. `packages/registry/src/schema.ts` — **read only** — understand why
    registry schemas are permissive (e.g., `HeroCardSchema.name` is
    optional, `cost` accepts `string | number | optional`). WP-033
    author-facing schemas are **deliberately stricter** (RS-1).

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for
execution. Do **not** revisit them or propose alternatives.

### 1. Author-facing schemas are stricter than registry schemas (RS-1)

Registry schemas in `packages/registry/src/schema.ts` are permissive for
real-data quirks (per D-1204, D-1227 — e.g., `anni` cards have only
`slug + imageUrl`; `amwp` Wasp has `cost: "2*"`). Author-facing schemas
in `content.schemas.ts` are **deliberately stricter**: they require
fields that the registry treats as optional because authors of **new
content** must fill them in.

Do **not** relax WP-033 §A required-field lists to match registry
permissiveness. Do **not** import from `packages/registry/src/schema.ts`.
`content.schemas.ts` declares its shapes independently.

### 2. Test wrapping: one `describe` block → 376 / 96 / 0 (RS-2)

Wrap all 9 tests inside a single `describe('validateContent /
validateContentBatch (WP-033)')` block. Bare top-level `test()` calls
do NOT register as suites in `node:test` (WP-031 P6-19 precedent).

Final baseline: **376 tests / 96 suites / 0 fail.**

### 3. Caller-injected `ContentValidationContext` (RS-3, Selected: Option B)

`validateContent` accepts an optional `ContentValidationContext` for
cross-reference checks. Signature is locked as:

```ts
export function validateContent(
  content: unknown,
  contentType: string,
  context?: ContentValidationContext,
): ContentValidationResult
```

and

```ts
export function validateContentBatch(
  items: { content: unknown; contentType: string }[],
  context?: ContentValidationContext,
): ContentValidationResult
```

When `context` is absent, cross-reference checks are **silently
skipped** — not failed. Structural, enum, and hook-consistency checks
still run.

`ContentValidationContext` is defined in `content.validate.ts` (local
to the validator — not a separate file):

```ts
export interface ContentValidationContext {
  readonly validVillainGroupSlugs?: ReadonlySet<string>
  readonly validMastermindSlugs?: ReadonlySet<string>
  readonly validSchemeSlugs?: ReadonlySet<string>
  readonly validHeroSlugs?: ReadonlySet<string>
}
```

All fields `readonly`, all optional. Pattern mirrors WP-032's
`validMoveNames: readonly string[]` injection (P6-20) and D-2801's
local structural interface for framework ctx subset.

### 4. Scenario schema validates the split shape (RS-4)

`ScenarioDefinition` uses **separate** `victoryConditions?:
ScenarioOutcomeCondition[]` and `failureConditions?:
ScenarioOutcomeCondition[]` arrays (not a single `conditions` array).
The scenario schema in `content.schemas.ts` must validate this split
shape. `ScenarioOutcomeCondition` is a discriminated union at
`campaign/campaign.types.ts:41` — the scenario schema may reference it
structurally for type-level validation, but must NOT add any new
runtime dependency on `campaign.types.ts` beyond the type import.

### 5. §01.5 NOT INVOKED (RS-5)

See "Runtime Wiring Allowance — NOT INVOKED" above. If an
unanticipated structural break appears mid-execution, **STOP and
escalate** — do not force-fit.

### 6. D-0601 / D-0602 / D-0603 confirmed present (RS-6)

All three exist at DECISIONS.md lines 172 / 180 / 188 with em-dash
IDs. Reference by regular-hyphen ID in WP-033 / EC-033 is the
established cross-artifact pattern (hyphen in references, em-dash in
DECISIONS.md headings per P6-2). No adjustment required.

### 7. Henchman schema mirrors `VillainCardSchema` (RS-7, D-3302)

The henchman author-facing schema in `content.schemas.ts` uses the
required fields of the registry's `VillainCardSchema`:

- `name: string` (required, non-empty)
- `slug: string` (required, non-empty)
- `vp: number` (required — stricter than registry which allows `null`)
- `vAttack: number | string` (required — stricter than registry)
- `abilities: string[]` (required)

Add a `// why:` comment citing D-3302 and D-1410..D-1413 (henchmen
are virtual cards with no dedicated registry schema; this mirrors the
nearest analog until a dedicated henchman authoring WP supersedes).

**Do NOT** import from `packages/registry/src/schema.ts`. Re-declare
the shape locally in `content.schemas.ts`.

### 8. Team is validated as non-empty string only (RS-8)

No canonical `TEAMS` union exists. WP-033 is **forbidden** from
inventing one. Team validation is:

```ts
typeof hero.team === 'string' && hero.team.length > 0
```

Add a `// why:` comment explaining the deferral: team names are
data-driven across 40 sets; a canonical union would require deriving
it from registry data at build time, which is out of scope for WP-033.

### 9. Hero classes re-declared locally (RS-9)

Define `HERO_CLASSES` locally in `content.schemas.ts`:

```ts
// why: HeroClassSchema lives in packages/registry/src/schema.ts, and
// the engine category must not import from the registry package. This
// local re-declaration is the engine's canonical source for content
// validation. A future WP may add a build-time drift-detection test;
// for MVP, no drift test is required (RS-9 / D-3301 lock).
export const HERO_CLASSES = [
  'tech',
  'covert',
  'strength',
  'ranged',
  'instinct',
] as const;

export type HeroClass = (typeof HERO_CLASSES)[number];
```

### 10. `contentType` accept list and unknown-type handling (copilot RISK #13/#14)

The `contentType: string` parameter accepts **exactly** these six
lowercase strings — no others:

```ts
const ACCEPTED_CONTENT_TYPES = [
  'hero',
  'villain',
  'henchman',
  'mastermind',
  'scheme',
  'scenario',
] as const;

export type ContentType = (typeof ACCEPTED_CONTENT_TYPES)[number];
```

Place this declaration in `content.schemas.ts` alongside
`HERO_CLASSES`. It is an accept-list constant, NOT a canonical
drift-detection array with a paired test (that would be out of scope
per §AI Agent Warning "produce synthesized canonical arrays…").
`ACCEPTED_CONTENT_TYPES` is internal to the validator — it need not be
re-exported from `index.ts` or `types.ts`.

**Unknown `contentType` behavior (locked):** if `contentType` is not
one of the six accepted strings — including typos, casing variants
(`"Hero"`), pluralizations (`"heroes"`), or empty string — the
validator MUST return:

```ts
{
  valid: false,
  errors: [{
    contentType: contentType,   // the unrecognized value as-supplied
    contentId: '',              // no contentId derivable for unknown type
    field: 'contentType',
    message: `The contentType "${contentType}" is not a recognized content type. Accepted values are: hero, villain, henchman, mastermind, scheme, scenario.`,
  }],
}
```

Silent pass on unknown `contentType` is **forbidden** — it would let
authoring typos reach runtime as "valid" content (copilot finding
#10 / #21).

In `validateContentBatch`, an unknown `contentType` in any item is
recorded as an error for that item; remaining items continue to be
validated (batch does not short-circuit).

Test coverage: test 9 ("All error messages are full sentences") is
extended to also assert that an unknown-`contentType` input produces
exactly one error whose `field === 'contentType'` and whose
`message` starts with `"The contentType"` and ends with a period.
Baseline stays locked at **376 tests / 96 suites / 0 fail**.

Add a `// why:` comment on the accept-list check stage:

```ts
// why: free-form contentType silently passing an unrecognized value
// would let authoring typos reach runtime as "valid" content (copilot
// RISK #10 / #21 resolution). The accept list is the single source of
// truth for the six supported content types at MVP.
```

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any content file or test
- Any `import ... from '@legendary-arena/registry'` in any content file
  or test
- Any `import ... from '../../registry'` or any path crossing into the
  registry package
- Any modification of `packages/registry/src/schema.ts`, `shared.ts`,
  or `localRegistry.ts`
- Any `.reduce()` in content logic or tests
- Any `Math.random()`, `Date.now()`, `performance.now()`, or any
  randomness/time in any new file
- Any `require()` in any file
- Any `throw` in `content.schemas.ts` or `content.validate.ts`
- Any IO, network, filesystem, or environment access
- Any mutation of any input parameter (`content`, `items`, `context`,
  etc.) — validators are pure
- Any modification to `game.ts`, any file under `src/moves/`, any file
  under `src/rules/`, any file under `src/setup/`, or any file under
  `apps/server/`
- Any new field added to `LegendaryGameState`
- Any new phase, stage, move, trigger name, effect type, or G counter
- Any modification to `makeMockCtx` or other shared test helpers
- Any files modified outside the allowlist (see Scope Lock)
- Any wiring of content validation into `game.ts`, moves, or phase
  hooks
- Adding a `TEAMS` canonical union (RS-8 forbids this)
- Adding a canonical `CONTENT_TYPES` array + drift test (out of scope
  for this WP — the accept list in §Pre-Flight Locked Decisions #10
  is an internal validator constant, not a drift-checked canonical
  array)
- Any assignment of `ContentValidationContext` (or any of its
  `ReadonlySet<string>` fields) into `LegendaryGameState`, any
  snapshot type, any persisted record, or any JSON-serialized
  payload. `Set` is forbidden in `G` per D-1232 (copilot RISK #19
  resolution)
- Silently passing an unrecognized `contentType` value (copilot RISK
  #10 / #21 resolution — see §Pre-Flight Locked Decisions #10 for the
  required error shape)
- Expanding scope beyond WP-033 (no "while I'm here" improvements)

---

## AI Agent Warning (Strict)

Content validation code is a **pre-engine gate**. It runs before the
boardgame.io lifecycle — not during it. `validateContent` and
`validateContentBatch` are called by content-authoring tools, tests,
and future build-time checks — never by moves, phases, or setup
functions.

**Lifecycle prohibition:** `validateContent` and `validateContentBatch`
are NOT part of the boardgame.io lifecycle. They MUST NOT be called
from:
- `game.ts`
- any move function under `src/moves/`
- any phase hook (`onBegin`, `onEnd`, `endIf`)
- any setup-time builder under `src/setup/`
- any rule hook executor under `src/rules/`

They are consumed exclusively by:
- the 9 tests in this WP
- future content-authoring tools (not in this WP)

**Do NOT:**
- Import `boardgame.io` in any content file
- Import `@legendary-arena/registry` in any content file
- Mutate any input object — always return new result objects
- Add content-validation types to `LegendaryGameState`
- Wire content validation into the boardgame.io lifecycle
- Invent new error fields beyond
  `{ contentType, contentId, field, message }`
- Invent new content types beyond hero / villain / henchman /
  mastermind / scheme / scenario
- Produce synthesized canonical arrays for teams, hero classes, or
  content types that didn't exist before this WP (only
  `HERO_CLASSES` is permitted per RS-9)

**Instead:**
- Accept `unknown` content and a string `contentType`, return new
  `ContentValidationResult` objects
- Use `for...of` for any iteration
- Use `// why:` comments on the required points (see §Required `//
  why:` Comments below)
- Return structured `ContentValidationResult` — never throw

---

## Scope Lock (Authoritative)

### Allowed Files

| File | Action | Contents |
|---|---|---|
| `packages/game-engine/src/content/content.schemas.ts` | CREATE | Author-facing declarative schemas (hero, villain, henchman, mastermind, scheme, scenario) + `HERO_CLASSES` local re-declaration |
| `packages/game-engine/src/content/content.validate.ts` | CREATE | `ContentValidationContext` interface, `validateContent`, `validateContentBatch` |
| `packages/game-engine/src/content/content.validate.test.ts` | CREATE | 9 tests inside **one** `describe` block |
| `packages/game-engine/src/types.ts` | MODIFY | Additive re-exports of `ContentValidationResult`, `ContentValidationError`, `ContentValidationContext` |
| `packages/game-engine/src/index.ts` | MODIFY | Additive exports of `validateContent`, `validateContentBatch`, `ContentValidationResult`, `ContentValidationError`, `ContentValidationContext` |
| `docs/ai/STATUS.md` | MODIFY | Append content-toolkit entry per EC-033 "After Completing" |
| `docs/ai/DECISIONS.md` | MODIFY | Append one entry: author-facing-vs-registry schema rationale + semantic check list + canonical-keyword-union references (EC-033 "After Completing") |
| `docs/ai/work-packets/WORK_INDEX.md` | MODIFY | Check off WP-033 with today's date |

### Forbidden

- Any file not in the table above
- Any file under `packages/registry/`
- Any file under `apps/server/`
- Any file under `packages/game-engine/src/` other than
  `content/*`, `types.ts`, `index.ts`
- Any existing test file
- Any file under `docs/ai/` other than the three listed above
  (pre-flight, EC, WP are read-only during execution — do not edit
  them mid-session)

**Rule:** Anything not explicitly allowed is out of scope.

---

## Required `// why:` Comments

The following `// why:` comments are required by EC-033 and WP-033 and
must appear in the implementation:

1. **`content.schemas.ts` — top of file:** schemas are author-facing;
   engine-facing validation is in registry Zod schemas
   (`packages/registry/src/schema.ts`). Author-facing schemas are
   stricter because authors of new content must supply fields that
   historical data sometimes omits.
2. **`content.schemas.ts` — `HERO_CLASSES`:** local re-declaration
   avoids a forbidden registry import (RS-9).
3. **`content.schemas.ts` — team field:** validated as non-empty
   string only; no canonical teams union at MVP (RS-8).
4. **`content.schemas.ts` — henchman schema:** mirrors
   `VillainCardSchema` shape per D-3302; henchmen are virtual cards
   (D-1410..D-1413) with no dedicated registry schema until a future
   authoring WP supersedes.
5. **`content.validate.ts` — `ContentValidationContext`:** caller-
   injected data; absent fields mean "skip that cross-reference
   check," not "fail." Engine must not import the registry to
   populate it (D-3301).
6. **`content.validate.ts` — each validation stage** (one `// why:`
   per stage, four total):
   - Structural checks: catches missing required fields and wrong
     types
   - Enum checks: catches keywords / classes outside canonical
     unions
   - Cross-reference checks: catches broken references between
     content items when caller supplies the reference sets
   - Hook consistency checks: catches hero-ability-hook keyword and
     timing drift against WP-021 canonical unions

7. **`content.validate.ts` — `ContentValidationContext` definition:**
   `ContentValidationContext` uses `ReadonlySet<string>` for O(1)
   membership checks. It is a **runtime call-site parameter only**.
   It MUST NOT be stored in `G`, persisted to any database or
   snapshot, serialized over the wire, or embedded in any type that
   crosses a persistence boundary. `Set` is forbidden in `G` per
   D-1232 (WP-009A/009B precedent). If a future caller needs to
   transport this data across a serialization boundary, convert to
   `readonly string[]` at the boundary. See §Hard Stops.

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/content/content.schemas.ts` (new)

**No `boardgame.io` imports. No `@legendary-arena/registry` imports. No
runtime code — schemas are declarative data only.**

**Imports (type-only from engine types):**

```ts
import type { HeroKeyword } from '../rules/heroKeywords.js';
import type { HeroAbilityTiming } from '../rules/heroKeywords.js';
import type { BoardKeyword } from '../board/boardKeywords.types.js';
import type { SchemeSetupType } from '../scheme/schemeSetup.types.js';
import type { ScenarioOutcomeCondition } from '../campaign/campaign.types.js';
```

**Declarations:**

- `ACCEPTED_CONTENT_TYPES` (`readonly ['hero', 'villain', 'henchman',
  'mastermind', 'scheme', 'scenario']`) and `ContentType` type —
  internal to the validator per §Pre-Flight Locked Decisions #10
- `HERO_CLASSES` (`readonly ['tech', 'covert', 'strength', 'ranged',
  'instinct']`) and `HeroClass` type
- Schemas as plain descriptor objects (NOT Zod, NOT classes, NOT
  functions). Example shape:

  ```ts
  export const HERO_CARD_SCHEMA = {
    requiredFields: ['name', 'slug', 'team', 'hc', 'cost', 'attack',
                     'recruit', 'abilities'] as const,
    numericFields: ['cost', 'attack', 'recruit'] as const,
    enumFields: {
      hc: HERO_CLASSES,
      keywords: HERO_KEYWORDS_REF, // reference, not value
    },
  } as const;
  ```

  The exact object shape is an implementation detail — the validator
  reads it. Keep it declarative; no functions, no closures.

- Include schemas for: hero card, villain, henchman, mastermind (with
  tactic flag handling), scheme (with setup instructions), scenario
  (split victory / failure conditions per RS-4)

### B) Create `packages/game-engine/src/content/content.validate.ts` (new)

**No `boardgame.io` imports. No `@legendary-arena/registry` imports. No
`.reduce()`.**

**Imports:**

```ts
import { HERO_KEYWORDS } from '../rules/heroKeywords.js';
import { HERO_ABILITY_TIMINGS } from '../rules/heroKeywords.js';
import { BOARD_KEYWORDS } from '../board/boardKeywords.types.js';
import { SCHEME_SETUP_TYPES } from '../scheme/schemeSetup.types.js';
import {
  ACCEPTED_CONTENT_TYPES,
  HERO_CLASSES,
  HERO_CARD_SCHEMA,
  /* etc. */
} from './content.schemas.js';
```

**Types (co-located with validators):**

```ts
export interface ContentValidationError {
  contentType: string;
  contentId: string;
  field: string;
  message: string;
}

export type ContentValidationResult =
  | { valid: true }
  | { valid: false; errors: ContentValidationError[] };

/**
 * Caller-injected cross-reference data. All fields optional; absent
 * field ⇒ that cross-reference check is silently skipped.
 *
 * // why: cross-reference checks need a caller-supplied set of valid
 * slugs. The engine must not import the registry to populate this
 * (D-3301). Pattern mirrors WP-032's validMoveNames injection (P6-20).
 */
export interface ContentValidationContext {
  readonly validVillainGroupSlugs?: ReadonlySet<string>;
  readonly validMastermindSlugs?: ReadonlySet<string>;
  readonly validSchemeSlugs?: ReadonlySet<string>;
  readonly validHeroSlugs?: ReadonlySet<string>;
}
```

**Functions:**

- `validateContent(content, contentType, context?)` — stages run in
  order:
  0. **Accept-list check** (new, from §Pre-Flight Locked Decisions
     #10): if `contentType` is not in `ACCEPTED_CONTENT_TYPES`, return
     the locked unknown-contentType error shape immediately. Do not
     run subsequent stages for unknown types.
  1. **Structural checks:** required fields present, correct types,
     valid ranges.
  2. **Enum checks:** keywords / classes in canonical unions.
  3. **Cross-reference checks:** skipped silently when `context` is
     absent; otherwise check `alwaysLeads`, setup instruction types,
     tactic card presence against `context`.
  4. **Hook consistency checks:** hero ability hooks reference valid
     keywords and timings.

  Each stage uses `for...of`. Accumulate errors into a local array.
  Return `{ valid: true }` if empty else `{ valid: false, errors }`.

- `validateContentBatch(items, context?)` — iterate items, call
  `validateContent` on each, concatenate errors. Single invalid item
  does **not** short-circuit the batch. An unknown `contentType` in
  any item produces one error for that item; other items continue to
  validate.

**Error messages** must be full sentences per Rule 11. Examples:

- `"The hero card with slug \"black-widow\" is missing required field \"team\"."`
- `"The mastermind \"dr-doom\" references alwaysLeads slug \"doom-minions\" which is not in the supplied valid-villain-groups set."`
- `"The scheme \"negative-zone-prison-break\" has setup instruction type \"modifyCitySiz\" which is not a valid SCHEME_SETUP_TYPES value."` (typo intentional — demonstrates the catch)

### C) Modify `packages/game-engine/src/types.ts`

**Additive re-exports only.** Append after the existing re-export
block:

```ts
export type {
  ContentValidationResult,
  ContentValidationError,
  ContentValidationContext,
} from './content/content.validate.js';
```

Do not modify any existing re-export. Do not reorder.

### D) Modify `packages/game-engine/src/index.ts`

**Additive exports only.** Append at the end:

```ts
export {
  validateContent,
  validateContentBatch,
} from './content/content.validate.js';
export type {
  ContentValidationResult,
  ContentValidationError,
  ContentValidationContext,
} from './content/content.validate.js';
```

Do not modify any existing export. Do not reorder.

### E) Create `packages/game-engine/src/content/content.validate.test.ts` (new)

**Use `node:test` and `node:assert` only. No `boardgame.io` import. No
`boardgame.io/testing` import. No `makeMockCtx` — content validation
is pure and needs no mock context.**

Wrap all 9 tests in a single `describe` block:

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateContent,
  validateContentBatch,
  type ContentValidationContext,
} from './content.validate.js';

describe('validateContent / validateContentBatch (WP-033)', () => {
  test('Valid hero card passes validation', () => { /* ... */ });
  test('Hero card missing required field fails with specific error', () => { /* ... */ });
  test('Hero card with invalid keyword fails with enum error', () => { /* ... */ });
  test('Valid mastermind with tactics passes', () => { /* ... */ });
  test('Mastermind with no tactic cards fails', () => { /* ... */ });
  test('Scheme with invalid setup instruction type fails', () => { /* ... */ });
  test('Cross-reference check: alwaysLeads referencing non-existent group with context fails, without context passes', () => {
    // Test both halves in one test per RS-3 locked decision.
    const mastermind = { slug: 'dr-doom', alwaysLeads: ['unknown-group'], /* ... */ };
    const context: ContentValidationContext = {
      validVillainGroupSlugs: new Set(['hand-ninjas', 'brotherhood']),
    };
    const withContext = validateContent(mastermind, 'mastermind', context);
    assert.equal(withContext.valid, false);
    // assert specific error shape/message
    const withoutContext = validateContent(mastermind, 'mastermind');
    assert.equal(withoutContext.valid, true);
  });
  test('Batch validation aggregates errors from multiple items', () => { /* ... */ });
  test('All error messages are full sentences, including unknown-contentType', () => {
    // Part A: pattern check — produce several failures and assert each
    // message matches /^[A-Z].*\.$/ (starts with capital, ends with period).
    //
    // Part B: unknown-contentType branch (copilot RISK #10/#21 lock,
    // §Pre-Flight Locked Decisions #10). Call
    //   validateContent({}, 'Hero')
    // and assert:
    //   - result.valid === false
    //   - result.errors.length === 1
    //   - result.errors[0].field === 'contentType'
    //   - result.errors[0].contentType === 'Hero'
    //   - result.errors[0].message starts with 'The contentType'
    //   - result.errors[0].message ends with '.'
    //
    // Part C: repeat Part B with an empty string and a pluralized form
    // ('heroes') to confirm the accept-list is strict.
  });
});
```

Use inline synthetic test data. Do NOT import registry data files.

---

## Verification Steps

Run these in order. All must pass.

```bash
# 1. Build — must exit 0, no TypeScript errors
pnpm --filter @legendary-arena/game-engine build

# 2. Tests — must exit 0, show 376 tests / 96 suites / 0 fail
pnpm --filter @legendary-arena/game-engine test

# 3. No boardgame.io imports in content directory (import-line-specific
#    pattern per P6-17)
grep -rn "from ['\"]boardgame\\.io" packages/game-engine/src/content/
# Expected: no output

# 4. No registry imports in content directory
grep -rn "from ['\"]@legendary-arena/registry" packages/game-engine/src/content/
# Expected: no output

# 5. No .reduce() in content directory
grep -rn "\\.reduce(" packages/game-engine/src/content/
# Expected: no output

# 6. No throw in content validators or schemas
grep -n "throw " packages/game-engine/src/content/content.schemas.ts \
                  packages/game-engine/src/content/content.validate.ts
# Expected: no output

# 7. No require() anywhere
grep -rn "require(" packages/game-engine/src/content/
# Expected: no output

# 8. Registry schema not modified
git diff --name-only packages/registry/src/schema.ts
# Expected: no output

# 9. No files outside scope modified
git diff --name-only
# Expected: only files listed in §Scope Lock §Allowed Files
```

---

## Definition of Done

Every item must be true before this packet is considered complete.

- [ ] Build exits 0
- [ ] Tests exit 0: **376 tests / 96 suites / 0 fail**
- [ ] All 9 WP-033 §E test cases pass
- [ ] All 367 pre-existing tests unchanged and passing
- [ ] No `boardgame.io` import in `src/content/` (confirmed by verification step 3)
- [ ] No `@legendary-arena/registry` import in `src/content/` (confirmed by verification step 4)
- [ ] No `.reduce()` in `src/content/` (confirmed by verification step 5)
- [ ] No `throw` in schemas or validators (confirmed by verification step 6)
- [ ] No `require()` anywhere (confirmed by verification step 7)
- [ ] `packages/registry/src/schema.ts` not modified (confirmed by verification step 8)
- [ ] No files outside §Scope Lock modified (confirmed by verification step 9)
- [ ] All required `// why:` comments present (per §Required `// why:` Comments)
- [ ] `docs/ai/STATUS.md` updated — content validation toolkit exists; D-0601 and D-0602 implemented
- [ ] `docs/ai/DECISIONS.md` has one new entry covering: author-facing vs registry Zod schemas, semantic check list beyond structural shape, canonical-keyword-union reference pattern
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-033 checked off with today's date
- [ ] All 9 RS locks (RS-1 through RS-9) cited in code or decision entries — not re-derived

If any item fails, **STOP and report**. Do not attempt to
self-remediate by expanding scope. Follow `01.6-post-mortem-checklist.md`
(step 4) for fixes to items inside the allowlist.

---

## After Execution (Step 4 — Post-Mortem)

When the Definition of Done is satisfied:

1. Run the post-mortem per `docs/ai/REFERENCE/01.6-post-mortem-checklist.md`
   (same session).
2. Pay particular attention to:
   - **Aliasing audit:** verify no schema object returned by
     `content.schemas.ts` is a reference to a mutable `G` field. (Should
     not happen — schemas are module-level constants — but check per
     WP-028 precedent.)
   - **Purity audit:** confirm `validateContent` and
     `validateContentBatch` do not mutate any input parameter. Add a
     test-time mutation check if not already present.
   - **Context-absent behavior audit:** confirm absent `context`
     truly skips cross-reference checks silently. If any code path
     produces an error when `context` is undefined, fix it in-session
     as a post-mortem refinement (in-allowlist; not a 01.5
     invocation per WP-031 precedent).
3. Record findings in
   `docs/ai/invocations/postmortem-wp033-content-toolkit.md`.

Then proceed to step 5 (pre-commit review) in a **separate session**.

---

**End of session execution prompt.**
