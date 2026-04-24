# MATCH-SETUP-SCHEMA.md

**Legendary Arena -- Match Setup Governance**

**Status:** Canonical
**Applies to:** All game creation, replays, verification, PAR, and simulation
**Audience:** Engine, Server, Content, Tooling, AI, Ops
**Authority:** Subordinate to `ARCHITECTURE.md`, `DECISIONS.md`,
`THEME-SCHEMA.md`, `13-REPLAYS-REFERENCE.md`

---

## Purpose

This document defines the **authoritative schema and governance rules**
for **Match Setup** in Legendary Arena.

A **Match Setup** is a **fully deterministic, versioned description of how a
single game instance begins**.

Match Setup exists to:

- ensure deterministic replay and verification
- allow game creation via UI, API, or files
- support simulation and PAR scoring
- decouple game configuration from engine code
- provide a stable artifact for long-term archival

This document defines **what match setup is and is not**.
It is a **governance reference**, not an implementation guide.

---

## Core Principle

> **Match setup is configuration, not rules.**

Match setup:

- configures **what components are used**
- configures **how randomness is seeded**
- configures **how players enter a game**

Match setup must **never**:

- change engine rules
- alter move legality
- add conditional logic
- override scoring
- inject runtime behavior
- depend on client-supplied values **after validation**

All setup data is treated as immutable and server-authoritative once accepted.
All rule enforcement remains in the engine.

---

## Relationship to boardgame.io

boardgame.io **does not define a match setup file or schema**.

Instead:

- boardgame.io accepts arbitrary **`setupData`**
- `setupData` is passed into `Game.setup(ctx, setupData)`
- the framework enforces only JSON-serializability

Legendary Arena defines **MATCH-SETUP as a first-class schema on top of
boardgame.io's `setupData`**.

### Two-Layer Structure

A MATCH-SETUP document has two conceptual layers:

1. **Envelope** (`schemaVersion`, `setupId`, `createdAt`, `createdBy`,
   `seed`, `playerCount`, `themeId`, `expansions`)
   - Consumed by the server before match creation
   - Supports versioning, replay archival, and content pool resolution
   - Not passed directly to the engine

2. **Composition** (`composition` block)
   - Maps 1:1 to `MatchSetupConfig` (the engine's 9-field contract)
   - Passed verbatim as boardgame.io `setupData`
   - Validated by `validateMatchSetup()` in the engine layer

All MATCH-SETUP documents must be:

- validated by Legendary Arena before use
- treated as immutable once a match begins

---

## Identity & Versioning

Every match setup **must** be uniquely identifiable and versioned.

### Required Identity Fields

- `schemaVersion`
  - Semantic string (e.g. `"1.0"`)
  - Used for forward compatibility and migrations
- `setupId`
  - Unique identifier for this setup instance
  - Must be stable for replay reference
- `createdAt`
  - ISO-8601 timestamp (metadata only)
- `createdBy`
  - `"player" | "system" | "simulation"`

Changing the meaning of a schema version requires a
`DECISIONS.md` entry.

---

## Authoritative Match Setup Schema

### Required Fields

```json
{
  "schemaVersion": "1.0",
  "setupId": "setup-2026-04-12T18:55:00Z",
  "createdAt": "2026-04-12T18:55:00Z",
  "createdBy": "player",

  "seed": "9b4a4e2d6e1c43c2",

  "playerCount": 2,

  "themeId": "dark-phoenix-saga",

  "expansions": ["base", "dark-city"],

  "heroSelectionMode": "GROUP_STANDARD",

  "composition": {
    "schemeId": "dark-phoenix-rises",
    "mastermindId": "dark-phoenix-jean-grey",
    "villainGroupIds": [
      "hellfire-club",
      "shiar-imperial-guard",
      "brood"
    ],
    "henchmanGroupIds": [
      "sentinels"
    ],
    "heroDeckIds": [
      "cyclops",
      "wolverine",
      "storm",
      "phoenix",
      "colossus"
    ],
    "bystandersCount": 30,
    "woundsCount": 30,
    "officersCount": 30,
    "sidekicksCount": 0
  }
}
```

The example above includes `heroSelectionMode: "GROUP_STANDARD"` for
illustrative purposes; the field is **optional** and defaults to
`"GROUP_STANDARD"` when omitted, so documents authored before this
field existed continue to validate and are interpreted identically.

### Optional Fields

The envelope supports optional fields that are additive and backward
compatible. Each optional field has a documented default that applies
when the field is absent; consumers must treat an absent field and the
default value identically.

| Field | Type | Required | Default | Purpose |
|---|---|---|---|---|
| `heroSelectionMode` | `string` (enum) | false | `"GROUP_STANDARD"` | Declares the interpretation rule for the composition's hero selection. `"GROUP_STANDARD"` (the only v1-allowed value) means the engine expands each `heroDeckIds` entry into the canonical group card set (classic Legendary rules). `"HERO_DRAFT"` is reserved for a future WP and is **not** in the v1 allowed enum. See §Field Semantics / Hero Selection Mode below and `DECISIONS.md` D-9301. |

### Composition Field Alignment

The `composition` block contains exactly the **9 locked fields** defined
by `MatchSetupConfig` in `matchSetup.types.ts` (per 00.2 section 8.1):

| Field | Type | Description |
|---|---|---|
| `schemeId` | `string` | Scheme ext_id |
| `mastermindId` | `string` | Mastermind ext_id |
| `villainGroupIds` | `string[]` | Villain group ext_ids |
| `henchmanGroupIds` | `string[]` | Henchman group ext_ids |
| `heroDeckIds` | `string[]` | Hero deck ext_ids |
| `bystandersCount` | `integer` | Bystander card count (>= 0) |
| `woundsCount` | `integer` | Wound card count (>= 0) |
| `officersCount` | `integer` | S.H.I.E.L.D. Officer card count (>= 0) |
| `sidekicksCount` | `integer` | Sidekick card count (>= 0) |

These field names are **locked**. Do not rename, abbreviate, or reorder.
If a field name appears wrong, STOP -- raise it as a question, update
00.2 first with a `DECISIONS.md` entry, then update code.

Some composition fields are intended to be customer-tunable ("safe knobs").
See `SAFE-KNOBS.md` for policy-level constraints on which fields may be
adjusted in response to customer feedback without engine changes.

---

## Field Semantics (Normative)

### Seed (Determinism Anchor)

`seed`:

- is mandatory
- is intended as **the root of all randomness**
- must be the same seed used for:
  - game setup randomization
  - shuffling
  - AI simulations
  - replay verification
  - PAR simulation

**Integration note:** boardgame.io manages its own internal PRNG via
`ctx.random`. Wiring `seed` into boardgame.io's random plugin is a
future integration concern. Until then, `seed` serves as the
deterministic identifier for replay and simulation matching.

A replay must be *fully reproducible* from:

- the match setup
- the move log

---

### Player Count

`playerCount`:

- must be an integer between 1 and 5
- must match `LegendaryGame.minPlayers` (1) and `maxPlayers` (5)
  as defined in `game.ts`
- is passed to boardgame.io as `numPlayers` during match creation

---

### Theme Relationship

`themeId`:

- references a `THEME-SCHEMA` entry
- acts as **intent metadata**
- must not override engine rules

The `composition` section:

- defines the **actual, concrete setup**
- may be derived from theme recommendations
- is authoritative for this match

Themes suggest; match setup decides.

---

### Composition Canonicality

The `composition` block is **authoritative** for gameplay.

Once the match begins:

- all composition values are frozen
- no component may be added, removed, or swapped
- overrides or mutations are forbidden

The composition block maps 1:1 to `MatchSetupConfig` and is validated
by `validateMatchSetup()` in `matchSetup.validate.ts`, which checks:

1. All 9 fields present and of correct type
2. Array fields are non-empty string arrays
3. Count fields are non-negative integers
4. All ext_ids exist in the card registry

---

### Hero Selection Mode

`heroSelectionMode` declares **how** the composition's hero selection
is interpreted by the engine. It is an interpretation flag, not a
ruleset selector: it narrows how the existing composition data is read,
and may not be used by any future WP as a branch point for engine-level
ruleset changes outside composition-interpretation scope.

In v1, the allowed enum has exactly one member:

- `"GROUP_STANDARD"` — the engine expands each entry of `heroDeckIds`
  into its canonical group card set at match start. This matches the
  current engine behavior (classic Legendary hero groups). The short UI
  label for this mode is `"Classic Legendary hero groups"`; the long
  explanation surfaces to help copy / tooltips as
  `"The engine expands each selected hero group into its canonical
  card set at match start."`

The value `"HERO_DRAFT"` is **reserved** for a future WP that introduces
player-curated hero card selection (individual hero cards chosen by
rarity or constraint rather than pre-defined groups). It is **not** in
the v1 allowed enum and any document whose `heroSelectionMode` is
`"HERO_DRAFT"` is rejected by Stage 1 envelope validation with the
error code `"unsupported_hero_selection_mode"` and the message template
documented in `MATCH-SETUP-VALIDATION.md §Validation Stages / Stage 1`.
The one-sentence future-notice UX copy is
`"Hero Draft rules are planned for a future update."` The naming and
semantics for `"HERO_DRAFT"` — including the in-universe flavor framing
"Contest of Champions", which is narrative UI copy only and must never
appear in enums, error messages, JSON, schema validation, lookup keys,
branch conditions, analytics dimensions, telemetry fields, or log
tokens — are locked by `DECISIONS.md` D-9301.

Documents that omit `heroSelectionMode` are treated as
`heroSelectionMode: "GROUP_STANDARD"` by every downstream consumer.
This preserves backward compatibility with any MATCH-SETUP JSON
authored before this field existed and keeps the `schemaVersion` at
`"1.0"` (the change is additive + backward compatible). See
`DECISIONS.md` D-9301 for the full rationale, the four-point
naming-governance policy for rule-mode tokens, and the
schemaVersion-no-bump analysis.

---

## Explicit Non-Goals (Hard Constraints)

Match setup must **not** include:

- Move rules
- Phase definitions
- Turn logic
- Keyword behavior
- Scoring modifiers
- PAR values
- Runtime conditionals
- Hooks or callbacks

If a change affects *how the game plays*, it is **not a setup concern**.

---

## Validation Requirements

Before a match is created, the system **must validate**:

- `schemaVersion` compatibility
- `setupId` uniqueness
- `seed` presence and non-emptiness (format is opaque but deterministic)
- `playerCount` is between 1 and 5
- `themeId` exists in THEME-SCHEMA (if provided)
- all 9 composition fields present with correct types
- all referenced ext_ids exist in content registry
- no unknown fields at any level (fail closed via `additionalProperties: false`)

Invalid setup -> match creation must be rejected.

### Existing Validation Integration

The engine provides two validation layers:

1. **Lobby gate** (`game.ts:92-101`): `validateSetupData` checks setupData
   presence at the boardgame.io create endpoint
2. **Engine gate** (`matchSetup.validate.ts:108-204`): `validateMatchSetup()`
   performs full shape + registry validation inside `Game.setup()`

Envelope validation (schemaVersion, setupId, seed, etc.) is the
server's responsibility and should be performed before passing the
composition to the engine.

---

## Replay & Verification Guarantees

Match setup:

- must be stored with replay metadata
- must be immutable forever
- must be sufficient to re-execute the match exactly

Replays must **never** depend on:

- UI state
- transient defaults
- external configuration
- client input outside the move log

---

## PAR & Simulation Integration

Match setup is the **sole configuration input** to:

- PAR simulation (WP-049)
- PAR artifact generation (WP-050)
- PAR server gate enforcement (WP-051)

Any simulation must produce identical results given:

- the same match setup
- the same engine version

---

## Why This Schema Is Strict

Match setup is the root of determinism in Legendary Arena.

Any ambiguity at setup time propagates into:

- replay invalidation
- unverifiable scores
- broken PAR guarantees
- simulation drift

For this reason:

- All fields are explicit
- No defaults are implied
- Unknown fields are rejected (`additionalProperties: false` at every level)
- Composition maps exactly to the engine's 9-field contract

Strict validation is not a developer convenience feature.
It is a correctness requirement.

---

## Extensibility Rules

New fields may be added only if they are:

- additive
- backward compatible
- deterministic
- documented here

Breaking changes require:

- schemaVersion bump
- migration strategy
- explicit decision record

Composition field changes additionally require updating
`MatchSetupConfig` in `matchSetup.types.ts` and 00.2 section 8.1.

The first envelope-level additive field governed by this rule is
`heroSelectionMode` (v1 enum `["GROUP_STANDARD"]`, optional, default
`"GROUP_STANDARD"`, `schemaVersion` unchanged at `"1.0"`). See
`DECISIONS.md` D-9301 for the decision, rationale,
schemaVersion-no-bump analysis, SCREAMING_SNAKE_CASE rule-mode token
convention, and four-point naming-governance policy. Future envelope
additions must follow the same additive + backward-compatible
discipline and reference a dedicated DECISIONS entry.

---

## Community & Tooling Compatibility

Because match setups are:

- JSON
- versioned
- deterministic

They are safe for:

- sharing
- exporting
- AI generation
- replay archival
- simulation batches

This is intentional.

---

## Summary

Match setup in Legendary Arena is:

- Deterministic
- Versioned
- Engine-agnostic
- Replay-safe
- Governance-bound

It is **not**:

- a rules engine
- a balance lever
- a scripting surface

> **Setup defines the board.
> The engine enforces the game.**
