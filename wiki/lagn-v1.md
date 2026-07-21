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
  - data-file-locations.md
  - r2-image-naming-convention.md
  - music-authoring.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\lagn-v1.md (this page — https://ewiki.legendary-arena.com/lagn-v1/)
  - ../packages/lagn-spec/src/validator.ts
  - ../packages/lagn-spec/README.md
  - ../docs/ai/work-packets/WP-244-lagn-spec-publication.md
  - ../docs/ai/execution-checklists/EC-275-lagn-spec-publication.checklist.md
  - ../docs/ai/execution-checklists/EC-422-lagn-1-1-support-pools.checklist.md
  - ../packages/lagn-spec/src/migrate.ts
  - ../packages/registry/src/heroImageUrl.ts
  - ../apps/arena-client/src/components/play/CardTile.vue
last-reviewed: 2026-07-21
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
| Written | no | no | no | no | **yes — `LAGN_VERSION`** |
| Adds | — | optional `setup.support_pools` | optional card-metadata provenance | optional `setup.hero_alternates` | optional `players` + `scoring_profile` |

**Readers accept all five; writers emit only `LAGN_VERSION` (now `1.4.0`).** That asymmetry
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

**1.4.0 (WP-405 contract + WP-406 producer / D-24214 / D-24215 / D-24216) —
shipped and emitted.** Adds two optional, top-level blocks so a server-emitted
result LAGN can describe *who played* and *under what profile* — a self-describing
scoresheet rather than an anonymous setup dump:

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

**The producer (WP-406 / D-24216).** `GET /api/match/:matchId/result-lagn` emits a
completed match's result LAGN — setup + `players[]` + `result` + `scoring_profile` —
projected read-only from the `bgio` blob (composition via D-24153, outcome via
`metadata.gameover` per D-24169) and the `legendary.match_seat_accounts` roster (a
domain table). `player_id` is the account's **claimed public handle**
(`display_handle`), never the internal `AccountId`; a seat whose account has not
claimed a handle is **omitted** (when none qualify, `players[]` is omitted entirely).
The endpoint is **guest-readable** — a finished match's result is public. WP-406
flipped `LAGN_VERSION` to **1.4.0**, so the emitted `players[]` clears the version
gate; readers still accept every version back to 1.0.0, so **no stored record
migrates**. With the writer now at 1.4.0, the `migrateToCurrent` chain
1.0.0 → 1.4.0 is fully reachable — each step is a pure restamp that **never invents
participants** (migration is forward-only; the roster is the server producer's
concern).

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
not. `UNEXPRESSIBLE_CONSTRAINTS` in `validator.ts` names all ten with a path,
the constraint, and the reason it cannot be carried (in array order, matching
`x-lagn-unexpressible-constraints` in the published schema):

1. Support-pool `mode`/`sets` coupling plus per-pool `ext_id` uniqueness
2. Each pool's `copies` summing to its matching `*_count` field
3. `seq` increasing by exactly 1 across a turn's actions
4. Any provenance block (`catalog_ref` / `registry_ref` / `effect_snapshot`) requiring `lagn_version` 1.2.0
5. `effect_snapshot` requiring a document-level `catalog_ref`
6. `support_pools` requiring `lagn_version` 1.1.0
7. `hero_alternates` being disjoint from `setup.heroes` and unique within itself
8. `hero_alternates` requiring `lagn_version` 1.3.0
9. `players` / `scoring_profile` requiring `lagn_version` 1.4.0
10. `players[]` internal consistency — count ≤ `player_count`, each `seat` in `0..player_count-1`, unique seats, unique `player_id`s

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

## Card Images: Embed, Side-Cart, or Prefetch? (Design Discussion)

> **Status: analysis + recommendation, not a locked decision.** This section
> weighs whether card *image bytes* should ride inside a LAGN document (or a
> companion bundle) so a live game never waits on an image mid-turn. It records
> no `D-` entry and changes no schema. The recommended path (prefetch, below)
> is the one to turn into a Work Packet if pursued; the two rejected paths are
> documented so the question stays answered.

### The question

A LAGN file today references images by **URL**, never by bytes: Tier-2 card
entries carry optional `image_url` / `image_thumb_url`, and the 1.2.0 provenance
`image` block carries a `uri` (plus optional `mime_type` / `role`) — all strings,
never embedded pixels. The proposal on the table is to change that: carry the
actual image data with the notation so a match is fully self-contained, and — the
real goal — **download every image a match needs during setup, so gameplay never
stalls waiting on `images.legendary-arena.com`.**

The instinct to keep bytes *out* of the LAGN is correct, and the "download it all
at setup" goal is achievable **without** touching the file format at all. The rest
of this section shows why, grounded in the real numbers.

### Ground truth (measured)

| Fact | Value | Source |
|---|---|---|
| Distinct card-face images (whole corpus) | **3,104** `.webp` across 41 sets | `grep` over `data/cards/*.json` (3,107 `imageUrl` refs) |
| Typical image weight | ~**90–110 KB** (live: `2099` Doctor Doom **108 KB**, `core` Spider-Man **86 KB**) | `HEAD` on R2, 2026-07-21 |
| Heavy-set outlier | `co2e` averages **~2.7 MB/image** (~408 MB / 151 images — unusually large scans) | [Card Image Acquisition](card-image-acquisition.md) |
| Whole-corpus footprint | order of **~1–8 GB** depending on set mix — never embeddable | derived from the two rows above |
| **Working set per match** | **known and bounded at setup** — every needed URL is already materialized in `G.cardDisplayData` → UIState; roughly **70–100 distinct images ≈ ~10–25 MB** for a 2–3-player game (set-dependent) | [`buildCardDisplayData.ts`](../packages/game-engine/src/setup/buildCardDisplayData.ts), estimate |
| Format / host / CORS | `.webp`, `images.legendary-arena.com` (R2 bucket `legendary-images` + Cloudflare CDN), `Access-Control-Allow-Origin: *` | [`heroImageUrl.ts`](../packages/registry/src/heroImageUrl.ts), [Data & File Locations](data-file-locations.md) |
| Client behavior today | **no prefetch, no service worker** — `CardTile.vue` renders `<img loading="lazy">`, which *defers* each load until the card nears the viewport | [`CardTile.vue`](../apps/arena-client/src/components/play/CardTile.vue) |

Two facts drive everything below. First, **the working set is a small, bounded,
fully-known subset** — not the 3,104-image corpus. The composition is fixed when
the match is created (the same `matchConfiguration` the Tier-1 LAGN already
projects, D-24153), and the client already holds every image URL it will ever need
in `G.cardDisplayData` the moment setup completes. Second, **the current default is
the opposite of prefetch**: `loading="lazy"` is exactly the mid-turn wait the
proposal wants to kill — the first time a card scrolls into view, its bytes cross
the wire.

### Option A — Embed image bytes inside the LAGN (rejected)

Base64-encode each image into the JSON (`data:` URIs in the `image` block, or a new
bytes member).

**Pros:** one fully self-contained artifact; a replay/audit bundle that works with
no registry, no CDN, no network — a natural extension of the 1.2.0 audit-bundle idea
to pixels.

**Cons (decisive):**

- **+33% on already-large bytes.** Base64 inflates binary by a third, and JSON can't
  hold raw bytes. A ~15 MB working set becomes a ~20 MB JSON document.
- **It breaks LAGN's transport.** LAGN travels in `?lagn=<base64url>` **URL params**
  (WP-362) and in decorative saved loadouts. A multi-megabyte base64 blob is
  categorically incompatible with a URL — the cross-surface loadout link would simply
  stop working.
- **It re-ships immutable bytes the CDN already caches.** Every card image is
  immutable and content-addressable by filename. Embedding copies those bytes into
  every shared record, defeating the browser HTTP cache and Cloudflare edge that would
  otherwise serve a repeat card for free.
- **It fights the project's asset invariant.** *Binaries live in R2; their metadata
  lives in Postgres — never the reverse* ([Data & File Locations](data-file-locations.md)).
  LAGN fixtures are committed to git; embedding bytes would put images in git, the exact
  thing [D-24219](../docs/ai/DECISIONS.md) rejects for audio ("no size exception — a
  non-diffable blob does not go in git").
- **It taxes every consumer.** The Zod validator and derived JSON Schema stay cheap
  precisely because a LAGN is small text. A validator that must ingest tens of MB per
  document is a different, slower contract for every third-party tool.

**Verdict: no.** Bytes-in-the-file trades a solved caching problem for a bloated,
un-shareable, un-committable document. Jeff's instinct here is right.

### Option B — A zip "side-cart" alongside the LAGN (rejected for live play; fine for offline archival)

Ship the LAGN text lean (references only) plus a companion `images.zip` of the
match's working-set `.webp` files — one downloadable bundle.

**Pros:** keeps the notation itself lean and URL-safe; gives a genuinely **offline,
R2-independent** archive — a "sealed replay" you can open years later even if the CDN
is gone; a single download; zip dedupes repeats within the set.

**Cons (for the live-play goal):**

- **Zipping WebP buys almost nothing.** `.webp` is already compressed; DEFLATE over it
  recovers ~0–3%. The "bundle" is essentially the raw bytes with a directory.
- **It's all-or-nothing before first paint.** A zip must be fully downloaded and
  unpacked before any image is usable — no progressive decode, no HTTP range, no
  "show the starting hand first." That's *worse* first-card latency than streaming
  individual images.
- **It defeats cross-match cache reuse.** Bytes pulled from a zip don't populate the
  HTTP cache under their canonical R2 URLs, so a hero you played last match is
  re-downloaded inside every new match's zip instead of being a free cache hit.
- **It re-solves a solved problem and adds a pipeline.** The images are already
  immutable, CDN-fronted, and content-addressable. A zip adds a packaging step, a
  hosting/MIME story, and a second artifact that can version-drift from its LAGN.

**Verdict: the right tool for an *offline export* feature ("Download this match as a
sealed bundle"), the wrong tool for the in-match prefetch.** If offline archival is
wanted, produce the zip **on demand, server-side**, and never make it the default LAGN.

### Option C — Prefetch the match working-set from R2 at setup (recommended)

Leave the LAGN format unchanged (references only) and solve the actual goal —
no mid-turn image wait — where it belongs: in the client, at setup. **This is the
audio model applied to images.** Audio already does exactly this: R2 is the sole
surface, nothing is bundled or committed, and *"the arena client prefetches a theme's
stings into decoded audio buffers at match start rather than bundling audio into the
build"* ([D-24219](../docs/ai/DECISIONS.md); [Music Authoring](music-authoring.md)).
Card images are the same shape of problem with an even easier answer, because the
working set is already enumerated on the client.

**Mechanics:**

1. **Enumerate.** At setup completion, iterate the `display.imageUrl` values already
   present in `G.cardDisplayData` / UIState and dedupe. No registry access, no URL
   reconstruction, no CORS concern (R2 serves ACAO `*`; `<img>`/`fetch` both work).
   This yields the exact, complete working set — every image the match can show.
2. **Warm the cache during dead time.** Fetch the set concurrently (a small cap,
   ~6–8 in flight, to ride HTTP/2 multiplexing without head-of-line stalls) while the
   player is on the setup/confirm screen — time they're already spending. Warm into
   **Cache Storage via a service worker** (durable across reloads/reconnects) or, as a
   first cut, the HTTP cache plus `createImageBitmap()` to pre-decode so first paint is
   instant.
3. **Prioritize first-visible cards.** Fetch the opening hand, the HQ/city, and the
   mastermind first; background the rest. Even a slow connection then has the
   first-needed pixels before first paint.
4. **Fail soft and idempotent.** A failed prefetch is non-fatal — the card falls back
   to today's lazy `<img>` load. A reconnect re-runs the pass and hits a warm cache, so
   it's cheap to repeat.

**Why it wins:** each unique image crosses the wire **at most once per client, ever**
(immutable + cached), the whole set is warmed in one burst during setup instead of
lazily mid-turn, and **nothing about the file format, git, or the CDN topology
changes.** It is strictly less network traffic than today *and* strictly less than
either embed or zip, which both re-ship cached bytes.

**Companion — immutable cache headers on the images (applied 2026-07-21).** The images
are immutable (the filename encodes set/ribbon/slug/sides), so they are served
`Cache-Control: public, max-age=31536000, immutable`. This is the highest-leverage
traffic reduction available and is now **live in both layers** — the object header
(browser cache; 4451 objects) and a Cloudflare edge Cache Rule (`cf-cache-status: HIT`
on a GET) — so a previously-seen card is free on every subsequent match, turning the
setup prefetch from a per-match cost into a one-time-per-client cost. It was an
operations change (R2 object metadata + a CDN cache rule), not a repo change; the
procedure and applied-state record live in
[`docs/ops/RUNBOOK-r2-image-cache-control.md`](../docs/ops/RUNBOOK-r2-image-cache-control.md).
Verify with a **GET**, not a `HEAD` — `curl -sI` misreads `cf-cache-status: DYNAMIC`
even when GETs are `HIT`, because Cloudflare caches GET responses.

**Optional, format-level follow-on (not required):** a small optional LAGN *manifest* —
URLs + content hashes of the working set, still **no bytes** — would hand a third-party
prefetcher or verifier a ready-made, integrity-checkable list instead of making it
re-derive the set. That aligns with the 1.2.0 provenance direction (`image.uri` +
`source_hash`) and would be a future minor version, gated like every other optional
block. It's a convenience, not a dependency — the client already computes the set
locally — so it's noted here as a possibility, not a recommendation.

### How this maps to the three asks

- *"Add the images into the LAGN — which I discourage"* → **Option A, rejected.** The
  discouragement is correct: it bloats the file, breaks the `?lagn=` URL transport, and
  puts binaries in git.
- *"A system to minimize network traffic play ↔ R2, all images downloaded during setup"*
  → **Option C, recommended.** Enumerate the already-known working set at setup, warm it
  concurrently into a durable cache during the setup screen, immutable-cache the objects
  so repeats are free.
- *"A zip side-cart to the LAGN — pros/cons"* → **Option B.** Useful only as an on-demand,
  server-produced **offline archival** export; counter-productive for live play, where it
  re-downloads CDN-cached bytes and blocks first paint on a full unpack.

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
- [Data & File Locations](data-file-locations.md) — the cross-asset locator map
  ("binaries live in R2, metadata in Postgres, never the reverse")
- [R2 Image Naming Convention](r2-image-naming-convention.md) — card-image
  filename rules and the `images.legendary-arena.com` host
- [Card Image Acquisition](card-image-acquisition.md) — the `.webp` pipeline and
  the per-set size figures cited in the image discussion above
- [Music Authoring](music-authoring.md) — the audio delivery model (R2 sole
  surface; prefetch-at-match-start) that the card-image prefetch mirrors
