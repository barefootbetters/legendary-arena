---
title: LAGN Specification
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
  - C:\pcloud\BB\DEV\legendary-arena\wiki\lagn-v1.md (this page — https://ewiki.legendary-arena.com/lagn-v1/)
  - ../packages/lagn-spec/src/validator.ts
  - ../packages/lagn-spec/README.md
  - ../docs/ai/work-packets/WP-244-lagn-spec-publication.md
  - ../docs/ai/execution-checklists/EC-275-lagn-spec-publication.checklist.md
  - ../docs/ai/execution-checklists/EC-422-lagn-1-1-support-pools.checklist.md
  - ../packages/lagn-spec/src/migrate.ts
last-reviewed: 2026-07-20
---

# LAGN Specification

## Summary

LAGN (Legendary Arena Game Notation) is the open standard format for
representing Legendary Arena game state: match setup, card catalog metadata,
and deterministic replay logs. Published as an NPM package (`@legendary-arena/lagn`)
with Zod validator, JSON Schema **derived from** that validator, TypeScript types, and CLI tooling,
and as the public GitHub repo
[legendary-arena/lagn-spec](https://github.com/legendary-arena/lagn-spec) (MIT).
LAGN enables third-party tools, bots, and replay systems to work with
Legendary Arena game data in a stable, interoperable format.

## Mechanics

### Three-Tier Format

LAGN defines three optional tiers that can be combined or used independently:

**Tier 1: Game Setup (Required)**

Mandatory fields defining the match configuration. The authoritative shapes are
the Zod schema in `validator.ts` and the fixtures under
`packages/lagn-spec/examples/` — the snippets below track them:

```json
{
  "lagn_version": "1.0.0 | 1.1.0 | 1.2.0 | 1.3.0 | 1.4.0",
  "$schema": "https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json (optional)",
  "game_id": "string",
  "variant": "solo | cooperative | competitive",
  "player_count": "integer 1-5",
  "players": "array (optional, 1.4.0+ — see below)",
  "scoring_profile": "string (optional, 1.4.0+ — a descriptive label)",
  "setup": {
    "mastermind": { "id": "CardExtId", "name": "string" },
    "scheme": { "id": "CardExtId", "name": "string" },
    "villain_groups": [ { "id": "CardExtId", "name": "string" } ],
    "henchmen_groups": [ { "id": "CardExtId", "name": "string" } ],
    "heroes": [ { "id": "CardExtId", "name": "string" } ],
    "hero_alternates": [ { "id": "CardExtId", "name": "string" } ],
    "bystanders_count": "integer >= 0",
    "wounds_count": "integer >= 0",
    "shield_officers_count": "integer >= 0",
    "sidekicks_count": "integer >= 0",
    "support_pools": "object (optional, 1.1.0+ — see below)"
  },
  "result": {
    "outcome": "victory | defeat",
    "loss_condition": "mastermind_defeated | city_overrun | deck_exhausted (optional)",
    "victory_points": "integer (optional)",
    "timestamp": "ISO 8601 datetime (optional)"
  }
}
```

Only `lagn_version`, `game_id`, `variant`, `player_count`, and `setup` are
required at the document root; `result`, `players` (1.4.0+), and
`scoring_profile` (1.4.0+) are optional. Within `setup`,
`hero_alternates` (1.3.0+) and `support_pools` (1.1.0+) are optional. Heroes are
`{ id, name }` entries — `id` is the D-10014 set-qualified `CardExtId`.
`player_count` accepts **1** (solo) through **5**.

**Tier 2: Card Catalog (Optional)**

Extended card metadata for offline analysis. A single `cards[]` array of a
discriminated union on `card_type` (nine variants):

```json
{
  "card_catalog": {
    "cards": [
      {
        "card_type": "mastermind | scheme | villain_group | henchmen_group | hero | shield_officer | sidekick | wound | bystander",
        "ext_id": "CardExtId",
        "name": "string",
        "image_url": "url (optional)",
        "image_thumb_url": "url (optional)"
      }
    ]
  }
}
```

The `hero` variant additionally carries `hero_class` (array of
`strength|instinct|covert|tech|ranged`) and `rarity_code`
(`c1|c2|c3|uc|uc2|uc3|ra`); `henchmen_group` additionally carries `rarity_code`.
Every variant may also carry the optional 1.2.0+ provenance members
(`registry_ref`, `effect_snapshot`, `image`) documented under
[LAGN Card Metadata Provenance](#tier-2-full-card-catalog-optional) below.

**Tier 3: Replay Log (Optional)**

Deterministic turn-by-turn log for perfect replay and audit:

```json
{
  "replay": {
    "turns": [
      {
        "turn_number": "integer >= 1",
        "active_player_id": "string",
        "villain_events": [
          {
            "phase": "ambush | patrol | guard | escape_attempted",
            "card_ext_id": "CardExtId"
          }
        ],
        "player_actions": [
          {
            "seq": "integer (strictly increasing from 0, no gaps)",
            "action_type": "villain_reveal | villain_attack | villain_escape | hero_recruit | hero_play | hero_discard | mastermind_twist | mastermind_attack | bystander_capture | bystander_release | wound_dealt | shield_deploy",
            "actor_player_id": "string (optional)",
            "target_card_ext_id": "CardExtId (optional)",
            "details": "object (optional)"
          }
        ],
        "stage_transitions": [
          { "from": "start | main | cleanup", "to": "start | main | cleanup" }
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
- Exports `summarize(data)` returning metadata: `{ valid, game_id, variant, player_count, result }`
- Exports `generateSchema()`, which **derives** the JSON Schema from the Zod
  schema (see below) — it is not a second hand-maintained description
- Exports the version constants `LAGN_VERSION`, `LAGN_VERSION_1_0_0`,
  `LAGN_VERSION_1_1_0`, `LAGN_VERSION_1_2_0`, `LAGN_VERSION_1_3_0`,
  `LAGN_VERSION_1_4_0`, `LAGN_SUPPORTED_VERSIONS`, and `migrateToCurrent()`

### Versioning (1.0.0 → 1.1.0 → 1.2.0 → 1.3.0 → 1.4.0)

| | 1.0.0 | 1.1.0 | 1.2.0 | 1.3.0 | 1.4.0 |
|---|---|---|---|---|---|
| Read | accepted | accepted | accepted | accepted | accepted |
| Written | no | **yes — `LAGN_VERSION`** | not yet | not yet | not yet |
| Adds | — | optional `setup.support_pools` | optional card-metadata provenance | optional `setup.hero_alternates` | optional `players` + `scoring_profile` |

**Readers accept all four; writers emit only `LAGN_VERSION`.** That asymmetry
is deliberate and is what keeps stored records readable without a migration
pass. `LAGN_SUPPORTED_VERSIONS` is the read set; `LAGN_VERSION` is the single
version this build stamps.

**1.1.0 (WP-391 / D-24195)** adds optional `setup.support_pools`, naming *which*
cards fill the four supply piles where the `*_count` fields carry only *how
many*. It is a strict superset: every valid 1.0.0 document is a valid 1.1.0
document, and 1.0.0 documents keep validating unchanged.

Two constraints are enforced in Zod and are **not** expressible in JSON Schema
(see the allowlist above): each pool's `copies` must sum to its matching
`*_count`, and `support_pools` is **version-gated** — a `1.0.0` document
carrying it is rejected rather than silently stripped. The gate matters because
`lagnSchema` does not call `.strict()`: without it, pools written into a 1.0.0
document would vanish on parse and the preset would come back empty, which is
the worst available failure mode.

`migrateToCurrent()` (`src/migrate.ts`) is a forward-only migration seam.
It never invents pools from counts — a migrated 1.0.0 document has no
`support_pools`, because the information was never there to recover.

**1.2.0 (WP-394 / D-24198) — shipped; readers accept it, writers do not emit
it yet.** Adds optional, hash-anchored card-metadata provenance so a replay is
auditable without registry or network access:

| Block | Location | Carries |
|---|---|---|
| `catalog_ref` | document root | which card data the producer read — `source`, `registry_version`, `set_content_hashes` |
| `registry_ref` | `card_catalog.cards[]` | `ext_id` (D-10014 set-qualified) + optional `face_id` |
| `effect_snapshot` | `card_catalog.cards[]` | frozen effect `text[]`, optional `tokens[]`, and a `source_hash` |
| `image` | `card_catalog.cards[]` | `uri`, optional `mime_type` / `role` |

A document carrying `catalog_ref` plus all three per-card blocks is a normative
**audit bundle** — verifiable with no registry and no network.

**Provenance is evidence, not authority.** The registry stays the source of
truth for what a card *is*; these blocks record what a producer *read*. Digests
match `^sha256:[0-9a-f]{64}$` and are validated for **shape only** here —
`packages/lagn-spec` computes no hashes and has no dependency on
`packages/registry`; RFC 8785 canonicalization is the producer's contract
(D-24197).

**Two more constraints JSON Schema cannot express** (both in the allowlist
above): any provenance block requires `lagn_version` 1.2.0 — a pre-1.2.0
document carrying one is **rejected**, not silently stripped — and an
`effect_snapshot` additionally requires a document-level `catalog_ref`, since
evidence without the snapshot it came from is unverifiable.

**Nothing emits 1.2.0 yet.** `LAGN_VERSION` deliberately stays 1.1.0, so no
endpoint payload has changed shape; `migrateToCurrent` still targets 1.1.0 and
the 1.1.0 → 1.2.0 migration step is registered but unreachable. A follow-on
packet flips the writer together with the producers.

**1.3.0 (WP-402 / D-24210) — shipped; readers accept it, writers do not emit it
yet.** Adds optional `setup.hero_alternates`: a bench of reserve heroes named in
a saved loadout alongside the heroes actually played, so a seven-hero shortlist —
five played, two held in reserve — survives a save/share/re-open round trip
instead of losing the reserves.

| Block | Location | Carries |
|---|---|---|
| `hero_alternates` | `setup` | array (min 1, **no max**) of `{ id, name }` — the reserve heroes; mirrors the `setup.heroes` entry shape exactly |

**The bench is loadout metadata, never gameplay state (D-24210).** Nothing
derives a match composition from it; `setup.heroes` stays the sole authority on
what is on the board, and no engine path reads the bench. It is a **sibling**
block, not more entries in `setup.heroes`, because played-hero count is
exact-enforced downstream against `PLAYER_COUNT_SETUP` (3/5/6 heroes by seat
count) — extra entries in `heroes` would validate here and then throw on match
create. Bench ids share the D-10014 set-qualified `setAbbr/slug` id space with
`setup.heroes[].id`; no translation.

**Two more constraints JSON Schema cannot express** (both in the allowlist):
`hero_alternates` is **version-gated** — a pre-1.3.0 document carrying it is
rejected, not silently stripped — and the bench must be **disjoint from and
non-repeating within** the played heroes (a hero is played or benched, never
both). There is deliberately **no `.max()`**: a cap in a published open standard
cannot be relaxed without a major version, and the producing UI enforces its own
limit (WP-404 offers two slots).

**The 1.2.0 → 1.3.0 migration step is registered but unreachable** — like its
predecessors it restamps only the version marker and **never invents a bench from
`setup.heroes`** (migration is forward-only and fabricates nothing that was not in
the source). Adding it exposed and fixed a latent equality-vs-ordinal defect in
`migrateToCurrent`'s forward-walk (D-24211): the loop now compares version
*positions*, so a document already at or newer than `LAGN_VERSION` is left
untouched rather than stamped forward.

> **Ordinal version gates (D-24211).** Every LAGN gate that keys an optional block
> on a minimum version compares **ordinally** ("this version or later"), never with
> `===` against a single constant. The provenance gate shipped as
> `=== LAGN_VERSION_1_2_0`, which rejected a 1.3.0 document carrying `catalog_ref`
> the moment 1.3.0 was added — the message already promised "1.2.0 or later". WP-402
> converts it (and routes the new bench gate) through `isLagnVersionAtLeast`.

**1.4.0 (WP-405 / D-24214 / D-24215) — shipped; readers accept it, writers do not
emit it yet.** Adds two optional, top-level, **reader-only** blocks so a
server-emitted result LAGN can describe *who played* and *under what profile* — a
self-describing scoresheet rather than an anonymous setup dump:

| Block | Location | Carries |
|---|---|---|
| `players` | document root | array (min 1, **no max**) of `{ seat, player_id, display_name? }` — the match participants; `seat` is `0..player_count-1`, `player_id` is a string, `display_name` is optional |
| `scoring_profile` | document root | a plain string label naming which scoring ruleset a completed match belongs to (e.g. `"legends-gauntlet-v1"`) |

**Both blocks are descriptive and NON-authoritative (D-24214 / D-24215).** Nothing
scores, credits, ranks, or verifies from them. Competitive credit is
`matchId → bgio blob → re-reduce → re-verify hash → AccountId`, server-side
(D-5301 / D-24126); the server never trusts a client-supplied identity or score, so
a reader that scored from either block would reopen that trust hole. They let a
portable record *say* who played and under which profile — nothing *scores* from
them. `player_id` MUST be a **public, shareable** id (a handle or public player id),
**never** the internal `AccountId` (D-5201) — LAGN travels in `?lagn=` links and
decorative saved loadouts, so an internal id would leak identity; the contract
validates a **string only** (no id-format regex), and the future server-producer
packet owns choosing the public id. `scoring_profile` is a **plain string, not an
enum** — the concrete profile set is owned by the leaderboard / Hall of Legends, not
this package.

**Three more constraints JSON Schema cannot express** (all in the allowlist):
`players` / `scoring_profile` are **version-gated** — a pre-1.4.0 document carrying
either is rejected, not silently stripped — and `players[]` is internally
consistent (count **≤** `player_count`, since a bot seat carries no entry; each
`seat` in `0..player_count-1`; unique seats; unique `player_id`s). There is
deliberately **no `.max()`** on the roster.

**The 1.3.0 → 1.4.0 migration step is registered but unreachable** — like its
predecessors it restamps only the version marker and **never invents participants**
(migration is forward-only, and the roster is a server producer's concern).
`LAGN_VERSION` stays 1.1.0; the writer flip belongs to the future server-producer
packet that emits `players[]` (WP-406).

### TypeScript Types

Inferred from the Zod schema via `z.infer<typeof lagnSchema>`, exported as:

- `LAGN` — the full data structure
- `GameSetup`, `CardCatalog`, `Replay` — tier structures
- `Card`, `Action`, `VillainEvent`, `Turn`, `GameResult` — component types
- `HeroAlternate` (1.3.0+), `LagnPlayer` (1.4.0+) — optional-block element types
- `ActionType`, `VillainPhaseEvent`, `Outcome`, `LossCondition`, `RarityCode`, `HeroClass`, `CardType` — enumerations

### JSON Schema Generation & Hosting

`generateSchema()` produces a JSON Schema declaring draft 2020-12, and is
**derived from `lagnSchema` via `zod-to-json-schema`** (WP-392 / D-24196). The
committed artifact is regenerated on every build and never hand-edited, and a
CI gate (`LAGN Schema Drift Guard`) fails if it drifts from the generator.

Until 2026-07-18 the generator was itself a **hand-written JSON Schema literal**
living beside the Zod schema in the same file. The CI gate proved the committed
JSON matched the *generator*, never that the generator matched *Zod* — so the
published contract could describe a different format than the validator
enforced, with CI green. It already did: `card_catalog.cards.items` and
`replay.turns.items` were bare `{ type: 'object' }` against a nine-branch
discriminated union and a fully typed turn, so a card with a bogus `card_type`
passed the published schema and failed `validate()`. Deriving one from the other
removes that class of drift by construction.

**Constraints JSON Schema cannot express.** Derivation silently drops every Zod
`.refine()` / `.superRefine()` — they are arbitrary predicates with no JSON
Schema equivalent. Dropping them is unavoidable; dropping them *unrecorded* is
not. `UNEXPRESSIBLE_CONSTRAINTS` in `validator.ts` names all four with a path,
the constraint, and the reason it cannot be carried:

1. Support-pool `mode`/`sets` coupling plus per-pool `ext_id` uniqueness
2. Each pool's `copies` summing to its matching `*_count` field
3. `seq` increasing by exactly 1 across a turn's actions
4. `support_pools` requiring `lagn_version` 1.1.0

The list is **enforced, not decorative**: the test suite walks the Zod tree,
counts refinement nodes, and fails the build if the count disagrees with the
allowlist — so a new `.refine()` cannot land undocumented. The array is also
embedded in the published artifact as `x-lagn-unexpressible-constraints`, so a
consumer validating against the schema alone can see what it does **not** check
for them.

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

Published as `@legendary-arena/lagn`:

- **Main entry:** `dist/index.js` (exports `validate`, `summarize`, `generateSchema`,
  the version constants, `migrateToCurrent`, types)
- **Schema export:** `"./schema"` entrypoint resolves to `schemas/lagn-v1.json`
- **CLI binary:** `lagn` (installed to `node_modules/.bin/lagn` via `"bin"` field)

> **Manifest lockstep (fixed 2026-07-19).** The version constants deliberately
> live in TypeScript and are never read from `package.json`; the manifest is the
> human-readable copy, bumped in lockstep. EC-422 bumped the constants and not
> the manifest, so npm briefly advertised `1.0.0` for a package emitting `1.1.0`
> documents. Both the `version` and the `description` (which read "LAGN v1.0 —")
> are corrected. Publishing is gated on a `v*` tag, so no release carried the
> mismatch. **When bumping `LAGN_VERSION`, bump `package.json` in the same
> change** — nothing enforces this automatically.

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
- **JSON Schema versioning.** The schema URI includes the MAJOR version
  (`lagn-v1.json`). Minor versions share that file — `lagn_version` is an
  `enum`, not a `const`. Future **major** versions (v2, v3) publish to separate
  schema files; consumers must pin their expected major version explicitly.
- **Readers accept; writers emit one.** `LAGN_SUPPORTED_VERSIONS` is every
  version this build can read; `LAGN_VERSION` is the single version it stamps
  on documents it writes. That asymmetry is what keeps stored records readable
  without forcing a migration pass over them.
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
  — 83 tests covering all three tiers, seq constraints, `summarize()`,
  versioning + support pools, migration, provenance and its two version gates,
  hero alternates and their version + disjointness gates, match participants +
  scoring profile and their version + internal-consistency gates, the
  ordinal-gate fix, the derived-schema contract, and `ajv` validation of all
  **seven** shipped fixtures against the generated JSON Schema
- [`packages/lagn-spec/src/migrate.ts`](../packages/lagn-spec/src/migrate.ts)
  — forward-only version migration (`migrateToCurrent`)
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
