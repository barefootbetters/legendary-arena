# WP-392 — Derive the published LAGN JSON Schema from the zod schema (Contract)

**User-Visible Surface:** none — infrastructure (the published artifact at
`https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json` becomes *tighter*,
matching what `validate()` already enforced).

## Goal

`packages/lagn-spec` stops maintaining its schema twice. `generateSchema()`
is derived from `lagnSchema` instead of being a hand-written JSON Schema
literal that describes the same shape by coincidence. Constraints JSON Schema
genuinely cannot express become an enforced, documented allowlist rather than
a silent omission.

## The defect

`src/validator.ts` held two independent descriptions of the LAGN format:

1. `lagnSchema` — the zod schema, labelled *"Single Source of Truth"* in the
   file header.
2. `generateSchema()` — a hand-written JSON Schema object literal several
   hundred lines below it, **not** derived from `lagnSchema`.

The CI gate `lagn-schema-drift` (`.github/workflows/ci.yml`) regenerates
`schemas/lagn-v1.json` and fails on a non-empty `git diff`. That proves the
committed JSON matches the **generator**. Nothing proved the generator matched
**zod**. The published contract could therefore describe a different format
than the validator enforced, with CI fully green.

It already did. Measured at execution:

| Site | Zod | Hand-written JSON Schema |
|---|---|---|
| `card_catalog.cards.items` | 9-branch `z.discriminatedUnion('card_type', …)` | `{ type: 'object' }` |
| `replay.turns.items` | fully typed `TurnSchema` | `{ type: 'object' }` |
| `seq` monotonicity | `.refine()` | absent |
| `support_pools` sum + version gate | `.refine()` / `.superRefine()` | absent |

A card-catalog entry with a bogus `card_type` **passed the published schema
and failed zod** — demonstrated end-to-end before and after the fix.

D-24195 recorded this hazard as known-and-unfixed and said deriving one from
the other was "worth its own packet." This is that packet.

## Assumes

- D-24195 landed the 1.1.0 version seam: `lagn_version` is an `enum` of
  `["1.0.0", "1.1.0"]`, not a `const`. Preserving that is a hard requirement.
- Every producer stamps `$schema:
  https://legendary-arena.com/schemas/lagn/v1/lagn-v1.json`
  (`apps/server/src/match/matchLagn.logic.ts`,
  `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts`, all four
  fixtures). The root draft URL and that default must not change.
- `src/index.ts` computes `LAGN_SCHEMA = generateSchema()` eagerly at module
  load, so the derivation library is a **runtime** dependency, not a devDep.
- `packages/lagn-spec` is a contract package — per
  `.claude/rules/code-style.md` §Contract Files, the change needs a
  `DECISIONS.md` entry (**D-24196**).

## Decision summary (full rationale in D-24196)

- `generateSchema()` derives via `zod-to-json-schema`; the hand-written
  literal is **deleted**, not parked. A retained copy is a copy that drifts.
- Four generator options are locked and commented, each against its default:
  `target: 'jsonSchema7'` (the `2019-09` target emits the draft-04 boolean
  `exclusiveMinimum`, invalid under the declared 2020-12 URL),
  `removeAdditionalStrategy: 'strict'` (yields `additionalProperties: true`,
  matching zod's strip semantics — the default `false` would reject documents
  `validate()` accepts), `$refStrategy: 'none'`, `effectStrategy: 'input'`.
- Post-derivation the function re-applies only what zod cannot carry: root
  `$schema`, title, description, the `$schema` property default, and
  `game_id`'s description. These sit **after** the spread, because the library
  injects its own `$schema`.
- `UNEXPRESSIBLE_CONSTRAINTS` documents all four dropped refinements with
  path, constraint, and reason; it is embedded in the artifact as
  `x-lagn-unexpressible-constraints` for consumers.

## Acceptance criteria

- **AC-1** — `generateSchema()` contains no hand-written structural literal;
  all shape comes from `lagnSchema`.
- **AC-2** — `schemas/lagn-v1.json` still declares
  `https://json-schema.org/draft/2020-12/schema`, the same title, the
  `lagn_version` enum `["1.0.0", "1.1.0"]`, the same `required` list, and the
  `$schema` property default. Pinned by test, not by inspection.
- **AC-3** — `card_catalog.cards.items` carries a 9-branch `anyOf` and
  `replay.turns.items` is typed. The prior divergences are closed.
- **AC-4** — every zod refinement has an `UNEXPRESSIBLE_CONSTRAINTS` entry,
  enforced by a `ZodEffects` node count walked from the schema tree. Adding an
  undocumented `.refine()` fails the suite. **Mutation-tested, not reasoned.**
- **AC-5** — all four `examples/*.lagn.json` fixtures validate against the
  **generated JSON Schema** compiled by `ajv` (2020-12), *and* against zod.
- **AC-6** — `additionalProperties` stays permissive, matching zod strip.
- **AC-7** — the committed artifact matches the generator (asserted in the
  unit suite as well as by the existing CI job).

## Out of scope

- Changing the LAGN format, the version enum, or the `$schema` URL.
- Removing or altering the `lagn-schema-drift` CI job — it still catches a
  committed artifact that was never regenerated.
- Migrating `packages/lagn-spec` to zod v4's native `z.toJSONSchema()`. The
  package declares `zod ^3.22.4` and uses the v3 API; a major-version move is
  its own packet.
- Making `LAGN_SCHEMA` lazy. Deriving at import is now real work rather than
  an object literal — a small, once-per-process cost, flagged in the PR as an
  observation rather than changed here (it would alter the public surface).

## Verification

```bash
cd packages/lagn-spec && npm test     # 44/44 (34 pre-existing + 10 added)
pnpm --filter @legendary-arena/lagn generate:schema && git diff --exit-code -- schemas/
pnpm -r build
```

## Hard-deps

D-24195 ✅ (version seam + `support_pools`), WP-244 ✅ (spec publication).
