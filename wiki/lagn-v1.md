---
title: LAGN v1.0 Specification
type: Tool
tags:
  - lagn
  - game-notation
  - schema
  - specification
  - open-standard
related:
  - complete-game-fixtures.md
status: canonical
source:
  - ../packages/lagn-spec/src/validator.ts
  - ../packages/lagn-spec/README.md
  - ../docs/ai/work-packets/WP-244-lagn-spec-publication.md
  - ../docs/ai/execution-checklists/EC-275-lagn-spec-publication.checklist.md
last-reviewed: 2026-07-16
---

# LAGN v1.0 Specification

## Summary

LAGN (Legendary Arena Game Notation) is the open standard format for
representing Legendary Arena game state: match setup, card catalog metadata,
and deterministic replay logs. Published as an NPM package (`@legendary-arena/lagn@1.0.0`)
with Zod validator, auto-generated JSON Schema, TypeScript types, and CLI tooling,
and as the public GitHub repo
[legendary-arena/lagn-spec](https://github.com/legendary-arena/lagn-spec) (MIT).
LAGN enables third-party tools, bots, and replay systems to work with
Legendary Arena game data in a stable, interoperable format.

## Mechanics

### Three-Tier Format

LAGN defines three optional tiers that can be combined or used independently:

**Tier 1: Game Setup (Required)**

Mandatory fields defining the match configuration:

```json
{
  "game_id": "string (UUID v4)",
  "variant": "classic|custom",
  "player_count": "integer 2-5",
  "outcome": "victory|loss",
  "loss_reason": "mastermind_defeated|villain_escape|player_elimination|unavailable (Tier 2+)",
  "setup": {
    "mastermind_id": "CardExtId",
    "scheme_id": "CardExtId",
    "villain_group_ids": ["CardExtId", ...],
    "henchman_group_ids": ["CardExtId", ...],
    "hero_deck_ids": ["CardExtId", ...],
    "bystanders_count": "integer >= 0",
    "wounds_count": "integer >= 0",
    "officers_count": "integer >= 0",
    "sidekicks_count": "integer >= 0"
  }
}
```

**Tier 2: Card Catalog (Optional)**

Extended card metadata for offline analysis:

```json
{
  "card_catalog": {
    "mastermind": {
      "id": "CardExtId",
      "name": "string",
      "rarity": "common|uncommon|rare|super_rare|ultra_rare"
    },
    "schemes": [...],
    "villain_groups": [...],
    "henchmen": [...],
    "heroes": [...],
    "cards": [
      {
        "ext_id": "CardExtId",
        "set_abbr": "string",
        "slug": "string",
        "name": "string",
        "type": "mastermind|scheme|villain|henchman|hero|bystander|officer|sidekick",
        "cost": "integer",
        "attack": "integer",
        "health": "integer"
      }
    ]
  }
}
```

**Tier 3: Replay Log (Optional)**

Deterministic turn-by-turn log for perfect replay and audit:

```json
{
  "replay": {
    "turns": [
      {
        "turn_number": "integer >= 0",
        "turn_player_index": "integer 0-(player_count-1)",
        "villain_events": [
          {
            "seq": "integer",
            "event_type": "patrol|strike|escape|scheme_twist|master_strike|extra_turn",
            "card_id": "CardExtId (when event_type has a card)"
          }
        ],
        "player_actions": [
          {
            "seq": "integer (strictly increasing from 0)",
            "action_type": "play|recruit|attack|defend|draw|discard",
            "source_card_id": "CardExtId (when applicable)",
            "target": "object (varies by action_type)"
          }
        ]
      }
    ]
  }
}
```

### Zod Validator & Source of Truth

The entire specification is defined in
[`packages/lagn-spec/src/validator.ts`](../packages/lagn-spec/src/validator.ts)
as a single authoritative Zod schema. The schema:

- Validates all three tiers in isolation or combination
- Enforces strict data types and closed enumerations
- Validates `seq` constraint (strictly increasing sequences, no gaps/duplicates)
- Exports the `validate(data)` function returning `{ valid: boolean, errors?: string[] }`
- Exports `summarize(data)` returning metadata: `{ valid, game_id, variant, player_count, outcome }`
- Exports `generateSchema()` returning a plain JSON Schema object (never hand-edited)

### TypeScript Types

Inferred from the Zod schema via `z.infer<typeof lagnSchema>`, exported as:

- `LAGN` — the full data structure
- `GameSetup`, `CardCatalog`, `Replay` — tier structures
- `Card`, `Action`, `VillainEvent`, `Turn`, `GameResult` — component types
- `ActionType`, `VillainPhaseEvent`, `Outcome`, `LossCondition`, `RarityCode`, `HeroClass`, `CardType` — enumerations

### JSON Schema Generation & Hosting

The `generateSchema()` function produces a valid JSON Schema (draft 2020-12).
The schema is auto-generated on every build and never hand-edited.

**Public schema URLs:**

- `https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json` — Cloudflare CDN
- `https://www.npmjs.com/package/@legendary-arena/lagn` — NPM package export (`"./schema"` entrypoint)

### CLI Tool

The `lagn` CLI command (installed via `npm install -g @legendary-arena/lagn`):

```bash
lagn validate <file.lagn.json>
```

**Exit codes:**

- `0` — File is valid; message: `✓ Valid LAGN file: game_id=..., variant=..., players=..., outcome=...`
- `1` — File is invalid; prints errors to stderr
- `2` — File not found or I/O error; prints error to stderr

### NPM Package Metadata

Published as `@legendary-arena/lagn@1.0.0`:

- **Main entry:** `dist/index.js` (exports `validate`, `summarize`, `generateSchema`, types)
- **Schema export:** `"./schema"` entrypoint resolves to `schemas/lagn-v1.json`
- **CLI binary:** `lagn` (installed to `node_modules/.bin/lagn` via `"bin"` field)

### Public GitHub Repository

The open-source publication surface (WP-244 Gate 1):
[github.com/legendary-arena/lagn-spec](https://github.com/legendary-arena/lagn-spec)
(public, MIT license).

- **Contents:** a package-only snapshot of `packages/lagn-spec` — src, schemas,
  examples, CLI, tests, README. The monorepo copy at
  [`packages/lagn-spec`](../packages/lagn-spec/) stays canonical; changes land
  there first and are pushed to the public repo on release.
- **CI:** the repo runs its own GitHub Actions matrix (`npm install`, build,
  test on Node 18/20/22) on every push and pull request.
- **History note (2026-07-16):** the repo originally received an accidental
  full-monorepo snapshot (including scheduled workflows, which failed nightly
  for lack of the main repo's secrets). It was rewritten to the package-only
  publication WP-244 specified; the same day the package's `test` script was
  fixed to name its test file explicitly (`node --test` only expands glob
  patterns on Node 21+, so the old `src/**/*.test.ts` pattern failed the
  repo's Node 18/20 CI legs).

## Interactions

- **Game Engine.** The engine's `MatchSetupConfig` shape (9 locked fields)
  aligns with LAGN Tier 1 `GameSetup`. Engine builders produce data in
  LAGN-compatible format for future serialization.
- **Registry.** LAGN Tier 2 card catalog is sourced from
  [`@legendary-arena/registry`](../packages/registry/); card `ext_id` format
  matches the registry's `CardExtId` type.
- **Replay Producer.** [`apps/replay-producer`](../apps/replay-producer) emits
  LAGN Tier 3 replay logs from deterministic turn sequences.
- **Third-party tools.** LAGN enables external bot frameworks, analysis
  pipelines, and replay viewers to validate and process Legendary Arena
  game data without importing engine code.

## Edge Cases

- **Tier independence.** Tiers 2 and 3 are optional; a minimal valid LAGN
  file contains only Tier 1 (setup). Tools consuming LAGN must handle
  any combination.
- **CardExtId format validation.** Card IDs must match `<setAbbr>/<slug>`
  format per
  [D-10014](../docs/ai/DECISIONS.md#d-10014).
  Malformed IDs fail validation.
- **seq constraint.** Replay actions and villain events within a turn are
  validated as **strictly increasing sequences starting at 0**, with no
  gaps and no duplicates. Out-of-order or duplicate `seq` values fail.
- **JSON Schema versioning.** The schema URI includes the version
  (`lagn-v1.json`). Future major versions (v2, v3) will publish to
  separate schema files; consumers must pin their expected version
  explicitly.
- **CLI exit behavior.** The CLI exits with code 1 on validation failure
  and code 2 on I/O errors. Non-zero exit codes allow shell scripts to
  detect and react to both cases.

## Code Touchpoints

- [`packages/lagn-spec/src/validator.ts`](../packages/lagn-spec/src/validator.ts)
  — Zod schema (authoritative source of truth), `validate()`, `summarize()`,
  `generateSchema()`
- [`packages/lagn-spec/src/types.ts`](../packages/lagn-spec/src/types.ts)
  — Auto-inferred TypeScript types via `z.infer<typeof lagnSchema>`
- [`packages/lagn-spec/src/index.ts`](../packages/lagn-spec/src/index.ts)
  — Public API exports
- [`packages/lagn-spec/src/cli.ts`](../packages/lagn-spec/src/cli.ts)
  — CLI entrypoint (shebang `#!/usr/bin/env node`)
- [`packages/lagn-spec/src/validator.test.ts`](../packages/lagn-spec/src/validator.test.ts)
  — 21 tests covering all three tiers, seq constraints, and summarize()
- [`packages/lagn-spec/scripts/generate-schema.mjs`](../packages/lagn-spec/scripts/generate-schema.mjs)
  — Generates `schemas/lagn-v1.json` at build time

## Cross-Surface Loadout Sharing (WP-361 ✅ + WP-362 ✅ + WP-363 ✅ — arc complete)

LAGN is the interchange format that lets a **live game on
play.legendary-arena.com** open its loadout in the **Registry Viewer's
Loadout tab** on cards.legendary-arena.com — for inspection, tweaking, or
re-export. The three-packet arc (D-24153 / D-24154 / D-24155) — **WP-361
(server) + WP-362 (viewer) + WP-363 (the in-match client link) all shipped
2026-07-12; the flow is complete end-to-end.**

1. ✅ **Server (WP-361 / D-24153, shipped).** `GET /api/match/:matchId/lagn` returns the
   current match's setup as a **Tier-1 LAGN**, projected read-only from the
   composition already persisted in the `bgio.matches` blob
   (`initial_state.G.matchConfiguration` + `ctx.numPlayers`). Access is
   `authenticated-session-required` + a participant gate; the projection
   extends the D-24095/D-24119 blob-read carve-out (never written back, never
   a save-game). `officersCount → shield_officers_count`; `variant`
   `solo`/`cooperative` by seat count; ext_ids resolve to display names via
   the registry (id-fallback); the document is `validate()`d before return.
2. ✅ **Viewer (WP-362 / D-24154, shipped).** A `?lagn=<base64url(UTF-8 LAGN JSON)>` URL
   param: on mount a pure decode-only decoder (`atob` + `TextDecoder`, never
   throws) turns it into text, the **existing** `parseLagnLoadout` (no validator
   fork) validates it once, and on success it **atomically** applies the
   composition to the Loadout draft (`resetDraft` + setters only on ok) and
   auto-switches to the Loadout tab (WP-114 machinery). It makes **no** server
   call — the payload is self-contained, so the viewer needs no auth and no
   CORS. `?lagn=` **suppresses** the WP-114 five-field setup preview; a malformed
   payload fails visible (tab + a dismissible full-sentence error banner).
3. ✅ **Client (WP-363 / D-24155, shipped).** An in-match "View loadout in Registry
   Viewer" control fetches the LAGN from WP-361 (Hanko bearer), base64url-
   encodes it into WP-362's `?lagn=` link (the exact inverse of the viewer's
   decoder), and opens it in a new tab (`noopener`). The bearer stays in the
   `Authorization` header, never in the opened URL; the `lagn` is treated
   opaquely (the server is the validation authority).

This reuses the same LAGN Tier-1 setup block documented above end-to-end: the
server emits it, the client relays it, the viewer ingests it.

## References

- [WP-244 — LAGN Spec Publication](../docs/ai/work-packets/WP-244-lagn-spec-publication.md)
  — Design and delivery specification
- [EC-275 — LAGN Spec Publication](../docs/ai/execution-checklists/EC-275-lagn-spec-publication.checklist.md)
  — Execution checklist with locked values and guardrails
- [Complete Game Fixtures](complete-game-fixtures.md) — Example LAGN files
  demonstrating all three tiers
- [`@legendary-arena/lagn` on NPM](https://www.npmjs.com/package/@legendary-arena/lagn)
  — Published package
- [legendary-arena/lagn-spec on GitHub](https://github.com/legendary-arena/lagn-spec)
  — Public repo (MIT; package-only snapshot of `packages/lagn-spec`)
- [JSON Schema Standard (2020-12)](https://json-schema.org/draft/2020-12/json-schema-core.html)
  — Schema specification version
