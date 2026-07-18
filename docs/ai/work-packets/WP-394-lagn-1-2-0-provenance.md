# WP-394 — LAGN 1.2.0: Card Metadata Provenance (Contract)

**User-Visible Surface:** none — infrastructure

## Goal

A LAGN document can answer *"which card effect does this replay reference,
and can I verify it without the registry?"* — by carrying optional,
hash-anchored **provenance**: which card data the producer read
(`catalog_ref`), which card and face each catalog entry names
(`registry_ref`), and a frozen copy of the effect text as **evidence**
(`effect_snapshot`). The registry stays authoritative. LAGN gains audit
metadata, **not card-definition ownership**.

## User-Visible Impact

None. Readers gain the ability to *accept* 1.2.0 documents; **writers keep
stamping 1.1.0** (see §Design Rationale), so no endpoint payload changes
shape. `docs/ai/STATUS.md` records: *No user-observable change —
infrastructure only.*

## Assumes

- **WP-393 must land first** — `RegistryInfo.registryVersion` and
  `setContentHashes`. Without them `catalog_ref` has no source. **This WP is
  BLOCKED until WP-393 is `[x]`.** WP-393's `canonicalJson.ts` is **not** a
  prerequisite here — this packet computes no hashes; that helper is the
  producer-wiring packet's shared contract.
- **LAGN 1.1.0 version seam — SATISFIED.** `LAGN_SUPPORTED_VERSIONS`,
  `LAGN_VERSION`, `migrate.ts`, version-gated `setup.support_pools`, and the
  fourth fixture `tier1-support-pools.lagn.json` **merged to `main`** via
  PR #825 / EC-422 (D-24195). At original draft none of these existed; they
  do now. Re-confirm at execution rather than trusting this line.
- **Derived-schema gate — SATISFIED.** `generateSchema()` derives from
  `lagnSchema`, and the enforced `UNEXPRESSIBLE_CONSTRAINTS` allowlist with its
  `ZodEffects` count gate is on `main` (WP-392 / D-24196, PR #828, merged
  2026-07-18). Any refinement this packet adds MUST join that allowlist or the
  build fails. Re-confirm at execution rather than trusting this line.
- Shipped contract at draft (verified against
  `packages/lagn-spec/src/validator.ts`): `variant` =
  `['solo','cooperative','competitive']`; `Outcome` = `['victory','defeat']`;
  `RarityCode` = the **strings** `c1|c2|c3|uc|uc2|uc3|ra`;
  `shield_officers_count`; exports named `validate` / `summarize`;
  `lagn_version` **required**.
- Ids are set-qualified `setAbbr/slug` per **D-10014**; `setupContract` and
  the engine share that id space.
- `packages/lagn-spec` is a contract package —
  `.claude/rules/code-style.md §Contract Files`.
- **Precondition to confirm, not a file to edit:** `ajv` and `ajv-formats` are
  already devDeps of `packages/lagn-spec` via PR #828. Confirm at start; do not
  re-add and do not add a second JSON Schema engine. `package.json` is therefore
  **not** in §Files Expected to Change.
- **D-24086** admits `@legendary-arena/lagn` into `apps/server` as a pure
  zod validator (`validate` + `LAGN`). This WP widens the exported type
  surface only — see §Non-Negotiable Constraints.
- Draft baseline: `origin/main` @ `06dda61d`.

## Context (Read First)

Read in this order before editing:

1. `.claude/CLAUDE.md` — operating posture, authority chain.
2. `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — and the
   **D-24086** note admitting `lagn` into `apps/server`.
3. `.claude/rules/code-style.md §Contract Files` and §Data Contracts.
4. `docs/ai/REFERENCE/00.6-code-style.md` — naming, JSDoc, `// why:` rules.
5. `docs/ai/REFERENCE/00.2-data-requirements.md §7 (Match Configuration)`
   and its field-naming rules. Register **every** new wire name:
   `catalog_ref`, `source`, `registry_version`, `set_content_hashes`,
   `registry_ref`, `ext_id` (already canonical — confirm, do not redefine),
   `face_id`, `effect_snapshot`, `text`, `tokens`, `kind`, `value`, `amount`,
   `source_hash`, `image`, `uri`, `mime_type`, `role`. Do not work from a
   count; work from this list.
6. `docs/ai/DECISIONS.md` — **D-24193** (mastermind base face; the 65-
   mastermind evidence behind `face_id`), **D-10014** (id space),
   **D-24197** (WP-393 hashing), and D-24198 reserved here.
7. `docs/ai/REFERENCE/api-endpoints.md` — the five rows carrying `LAGN` as
   a payload; see §API Catalog Update.
8. `packages/lagn-spec/src/validator.ts` — the shipped schema this derives
   from. **Not** any pasted or remembered copy.

**Why now.** Proposed 2026-07-18 as a "v1.1 card metadata provenance
extension." The architectural principles were sound; the accompanying schema
draft was not adoptable and is **not** the basis for this WP. Measured at
draft, that draft rejected **every** shipped fixture (`game_id:
z.string().uuid()` against real ids like `example-tier1-001`) while
**accepting `{}`**, and additionally renamed or invented `variant`,
`Outcome`, `LossReason`, `RarityCode` (number vs the shipped strings),
`CardType`, `shield_officers_count`, and the `validate`/`summarize` export
names. This WP takes the **principles** and derives the schema from the
shipped `lagnSchema`.

**Supersession check (01.0a §Step 2).** `WP-314` / `EC-344`
(`diagnostic-effect-provenance`) is engine-side diagnostic export —
recorded false-positive near-collision on *provenance*.

## Design Rationale

**Version is 1.2.0, not 1.1.0.** 1.1.0 is already allocated to
`setup.support_pools` (D-24195, merged), which must survive untouched.

**Readers accept 1.2.0; writers keep stamping 1.1.0.** `LAGN_VERSION` — the
version this build *writes* — stays `1.1.0` in this packet;
`LAGN_SUPPORTED_VERSIONS` gains `1.2.0`. This uses the asymmetry the 1.1.0
seam already established ("readers accept the full list while writers emit
only `LAGN_VERSION`"). Consequences, both deliberate: no endpoint payload
changes **shape** (§21 still fires on the *acceptance* envelope — see §API
Catalog Update); and provenance cannot be emitted until a follow-on packet flips `LAGN_VERSION` **together
with** the producer wiring. Bumping the writer here would silently move the
wire format of five catalogued endpoints for zero benefit, since nothing
populates provenance yet.

**Duplication is not the hazard; unanchored duplication is.** The source
proposal argued both that LAGN should strip attributes the registry owns
*and* that an audit bundle must validate without registry access. Those
cannot both hold — you cannot check a replay's arithmetic from a bundle
missing `cost` and `attack`. Resolved by tier: the **reference** tier
(`registry_ref`) never duplicates; the **snapshot** tier
(`effect_snapshot`) duplicates deliberately, under `source_hash`.

**Stable identifiers only — no JSON pointers.** `/heroes/0/cards/0` breaks
the moment an array is reordered, and card data is regenerated by a
multi-stage pipeline with no ordering guarantee. `registry_ref` names
`ext_id` in the D-10014 space. `image_json_pointer` is likewise dropped for
`image.uri` + a hash.

**`face_id` ships even though `faces[]` is deferred.** Deferring the array is
right — the registry owns card topology. But multi-face is present-tense:
**D-24193** (Active) records **65 masterminds across 24 sets** whose Epic
face was played unchosen. Without a face discriminator an audit bundle cannot
tell a base face from an Epic face — exactly the question this packet exists
to answer. The array defers; the discriminator does not.

**`migrateToCurrent` keeps targeting 1.1.0; the 1.2.0 step is registered but
unreachable.** `migrateToCurrent` migrates *to* `LAGN_VERSION`, which this
packet freezes at 1.1.0. So the 1.1.0 → 1.2.0 step is added to the migration
table but is **not reachable** from `migrateToCurrent` here; the follow-on
producer packet flips `LAGN_VERSION` and thereby activates it. A **1.2.0**
input to `migrateToCurrent` is returned **unchanged** — never downgraded,
never re-stamped — and that is asserted by a test. Without this stated, an
executor could satisfy AC-5 by doing nothing, or by stamping 1.2.0 and
breaking the frozen-writer constraint; both comply with the checklist and
produce opposite artifacts.

**`catalog_ref` is emitted only when the registry reports both fields.**
WP-393 makes `registryVersion` optional and omits it on an empty load scope,
so a producer holds `string | undefined`. An absent `registryVersion` means
**no `catalog_ref` block at all** — never an empty string, never a placeholder
digest. Carried into the follow-on packet's hand-off.

**`catalog_ref.registry_version` pins the producer's load scope, not a global
snapshot.** Per WP-393 §Design Rationale and its AC-5, `registryVersion` is
derived from the sets **actually loaded**. The authoritative per-set evidence
is `set_content_hashes`; `registry_version` is a convenience digest of the
scope. The schema documentation must say so — describing it as a global
snapshot id would be false.

## Scope (In)

- `LAGN_VERSION_1_2_0`; extend `LAGN_SUPPORTED_VERSIONS` to
  `['1.0.0','1.1.0','1.2.0']`. **`LAGN_VERSION` stays `1.1.0`.**
- Add the 1.1.0 → 1.2.0 migration step (identity for document shape;
  `support_pools` preserved).
- **`catalog_ref`** (optional, document root):
  `{ source, registry_version, set_content_hashes }`.
- **`registry_ref`** (optional, per catalog card): `{ ext_id, face_id? }`.
- **`effect_snapshot`** (optional, per catalog card):
  `{ text[], tokens[]?, source_hash }`.
- **`image`** (optional, per catalog card): `{ uri, mime_type?, role? }`.
- `source_hash` and `registry_version` are validated for **shape only**
  (`sha256:` prefix). **No hash is computed in this packet** — nothing here
  produces a document, so a canonicalizer would be a helper with no caller
  sitting inside a locked contract file. RFC 8785 canonicalization is the
  **producer's** obligation and lands with the producer-wiring packet, tested
  there against the RFC's published vectors — independently of
  `packages/registry`, never via a `lagn-spec` → `registry` edge.
- Two refinements — `effect_snapshot` requires `catalog_ref`; any provenance
  block requires `lagn_version` ≥ 1.2.0 — each with an
  `UNEXPRESSIBLE_CONSTRAINTS` entry.
- A fifth fixture, `examples/tier2-provenance.lagn.json`, validated against
  the **generated JSON Schema** via `ajv` *and* zod.
- **Empirical scaffold (REQUIRED, before execution closes)** — see
  §Empirical Scaffold.

## Out of Scope

- **Producer wiring** — `apps/server` and `apps/registry-viewer` keep
  emitting 1.1.0. Populating provenance is a follow-on WP that flips
  `LAGN_VERSION` and updates `api-endpoints.md` in the same commit.
- **`faces[]` arrays** — only the `face_id` discriminator lands.
- **Removing existing Tier-2 fields** (`name`, `image_url`, `hero_class`,
  `rarity_code`) — they ship today and back the registry-viewer export path;
  removal is breaking and belongs to a 2.0 deprecation.
- Changing `$schema`, `game_id`, `variant`, `Outcome`, `LossCondition`,
  `RarityCode`, `CardType`, `shield_officers_count`, or the
  `validate`/`summarize` export names.
- Making `lagn_version` optional.
- `z.any()` anywhere.

## Files Expected to Change

- `packages/lagn-spec/src/validator.ts` — **modified** — constants, schemas,
  refinements, allowlist entries.
- `packages/lagn-spec/src/migrate.ts` — **modified** — 1.1.0 → 1.2.0 step.
- `packages/lagn-spec/src/types.ts` — **modified** — provenance types.
- `packages/lagn-spec/src/index.ts` — **modified** — re-exports.
- `packages/lagn-spec/src/validator.test.ts` — **modified** — new cases.
- `packages/lagn-spec/examples/tier2-provenance.lagn.json` — **new**.
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated.
- `docs/ai/DECISIONS.md` — **modified** — D-24198 lands Active.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — new names.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — affected rows replaced
  whole per D-11804 (narrowed acceptance envelope).
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status →
  `Complete`.

## Non-Negotiable Constraints

- **ESM only; Node v22+.** No `require()`. `node:` prefix on built-ins.
- **Full file contents** in responses — never diffs, never elided snippets.
- Code style per `docs/ai/REFERENCE/00.6-code-style.md`.
- **Test runner is `node:test` via `tsx`**, invoked as
  `pnpm --filter @legendary-arena/lagn test`. Never `npm run`. No Jest, no
  Vitest, no Mocha. `ajv` + `ajv-formats` are **already devDeps** (PR #828)
  — do not add a second JSON Schema engine.
- **Every provenance field is optional.** A 1.0.0 or 1.1.0 document that
  validates today MUST still validate unchanged.
- `lagn_version` stays **required**. Never `.optional()`, never `.default()`.
- **`LAGN_VERSION` stays `1.1.0`** in this packet.
- No `z.any()`. No JSON-pointer field of any kind.
- Do **not** hand-edit `schemas/lagn-v1.json` — regenerate it.
- Each new `.refine()`/`.superRefine()` MUST get an
  `UNEXPRESSIBLE_CONSTRAINTS` entry in the same edit, or the `ZodEffects`
  count gate fails the build.
- **Exported surface (D-24086):** new provenance **types** may be exported;
  do not export new runtime functions from the package root beyond the
  existing `validate` / `summarize` / `generateSchema` / `migrateToCurrent`
  set without an ARCHITECTURE.md import-rule edit in the same commit.
- **Locked values** (verbatim): `1.2.0`; `LAGN_VERSION_1_2_0`; enum order
  `['1.0.0','1.1.0','1.2.0']`; block names `catalog_ref` / `registry_ref` /
  `effect_snapshot`; token `kind` closed set
  `keyword|icon|hero_class|team|custom`; prefix `sha256:`; RFC 8785.

## Contract

```ts
const CatalogRefSchema = z.object({
  source: z.enum(['legendary-arena-registry']),   // closed set, not a free string
  registry_version: z.string().startsWith('sha256:'),
  set_content_hashes: z.record(z.string().startsWith('sha256:'))
})

const ImageSchema = z.object({
  uri: z.string().url(),
  mime_type: z.string().optional(),               // deliberately open
  role: z.enum(['card-front','card-back','tactic','transformed']).optional()
})

const RegistryRefSchema = z.object({
  ext_id: z.string(),                       // D-10014 setAbbr/slug
  face_id: z.string().optional()            // base | epic | transformed…
})

const EffectSnapshotSchema = z.object({
  text: z.array(z.string()).min(1),
  tokens: z.array(z.object({
    kind: z.enum(['keyword','icon','hero_class','team','custom']),
    value: z.string(),
    amount: z.number().int().optional()
  })).optional(),
  source_hash: z.string().startsWith('sha256:')
})
```

**Audit Bundle (normative).** A LAGN document is an *audit bundle* when it
carries `catalog_ref`, and every `card_catalog.cards[]` entry carries
`registry_ref`, `effect_snapshot`, and `image.uri`. Such a document is
verifiable without registry or network access.

## Vision Alignment

- **Vision clauses touched:** §1 / §2 (faithful rules, real card content
  behaves as printed — provenance makes the referenced text auditable);
  §22 (Deterministic Eval).
- **Conflict assertion:** No conflict. Provenance is additive, optional, and
  read-only evidence; it changes no rule, no card behavior, and no outcome.
- **Non-Goal proximity check:** N/A — no monetization, identity, or
  competitive-scoring surface. None of NG-1..8 are crossed. Audit metadata
  supports verification of existing competitive claims; it introduces no new
  scoring input.
- **Determinism preservation:** No RNG added or removed. No engine surface,
  no `G`, no `ctx`, no move, no phase, no sentinel or `finalStateHash` input.
  Replay **behavior** is untouched — only the optional description of what a
  replay referenced. Existing fixtures must validate byte-unchanged; any
  drift is STOP-and-investigate, never a silent re-pin.

## Funding Surface Gate

**N/A — declared, not inferred.** No pricing, billing, entitlement, quota,
paywall, or revenue-affecting surface. Provenance is optional audit metadata
on a notation format.

## API Catalog Update

**TRIGGERED — declared, not inferred.** An earlier draft claimed N/A on the
grounds that emitted documents are byte-identical. That reasoning covered
only the **write** side and was wrong: §21.1 fires on request shape and
status codes too, and this packet narrows the **acceptance** envelope.

The mechanism is unavoidable, not incidental. For the version gate to fire,
`catalog_ref` must become a *known* optional key — zod strips unknown keys
before refinements run. So a request body that is silently stripped and
accepted today is rejected after this lands: a 1.1.0 document carrying
`catalog_ref` currently returns `201` from `POST /api/me/loadouts` and will
return `400 { "error": "invalid_lagn" }`, because that route validates
client-supplied bodies through `@legendary-arena/lagn` `validate`
(`api-endpoints.md:130`). AC-2 makes this binding.

**Obligation for this packet.** `docs/ai/REFERENCE/api-endpoints.md` is in
§Files Expected to Change and the DoD. The executor MUST enumerate every
catalogued row whose **request body** is validated by `validate` and replace
each affected row **whole** per D-11804 replace-whole-row semantics.
Verified at draft, the affected set is exactly **one** row —
`POST /api/me/loadouts`, whose body is `{ name, lagn }`. `PATCH
/api/me/loadouts/:id` takes `{ name?, visibility? }` and carries **no** `lagn`
field, so it is NOT validate-gated and must NOT be rewritten. Re-confirm the
full set at execution rather than trusting this list — partial
column edits are a FAIL. The annotation records the narrowed acceptance
envelope. Read-only rows that merely *return* LAGN
(`GET /api/me/loadouts`, `GET /api/loadouts/:shareSlug`,
`GET /api/match/:matchId/lagn`, and `PATCH /api/me/loadouts/:id`, which
returns `SavedLoadoutView.lagn` without accepting one) are unaffected, since emitted documents do
not move.

**Hand-off to the follow-on packet.** Producer wiring flips `LAGN_VERSION`
to `1.2.0` and MUST update the same catalogue rows again, in that commit,
for the emitted-shape change. Recorded here so it cannot be lost.

## Empirical Scaffold (01.4 — REQUIRED)

This WP **tightens validation**: after it lands, a 1.1.0 document carrying
`catalog_ref` is rejected. Today such a document **validates** — `lagnSchema`
does not call `.strict()`, so the unknown key is silently stripped. That is
previously-accepted input becoming newly-rejected, so `01.4 §Empirical
Scaffold` applies and a `READY` reached by argument is invalid.

Before execution closes, the executor MUST prototype the version gate and run
`pnpm --filter @legendary-arena/lagn test`, then record the **observed**
output — specifically whether any existing fixture or test constructs a
document carrying an unknown key that the new gate now rejects. Every
observed failure is folded into §Scope (In) and §Files Expected to Change
before the WP may close.

## Acceptance Criteria

- **AC-1** — all five fixtures (four existing + `tier2-provenance`) validate
  against the **generated JSON Schema** via `ajv` 2020-12 **and** zod.
- **AC-2** — a 1.1.0 document carrying `catalog_ref` is **rejected** with the
  version-gate message; a 1.2.0 document without provenance is accepted.
- **AC-3** — `effect_snapshot` without `catalog_ref` is rejected.
- **AC-4** — both new refinements appear in `UNEXPRESSIBLE_CONSTRAINTS` and
  the `ZodEffects` count gate passes. **Mutation-tested**: inject an
  undocumented `.refine()` → suite red → revert → green, output recorded.
- **AC-5** — `migrateToCurrent` still targets `LAGN_VERSION` (1.1.0): a 1.0.0
  input migrates to 1.1.0 with `support_pools` untouched and no provenance
  invented; a **1.2.0 input is returned unchanged** (never downgraded, never
  re-stamped). The 1.1.0 → 1.2.0 step is registered but unreachable until the
  producer packet flips `LAGN_VERSION`; a test asserts it is not invoked.
- **AC-6** — `LAGN_SUPPORTED_VERSIONS` is `['1.0.0','1.1.0','1.2.0']`;
  **`LAGN_VERSION` is still `1.1.0`**; root `$schema` and the `required`
  list are unchanged.
- **AC-7** — `generate:schema` then `git diff --exit-code -- schemas/` clean.
- **AC-8** — no JSON-pointer field anywhere in the schema (grep).
- **AC-9** — `packages/lagn-spec` still has **no** dependency on
  `@legendary-arena/registry` (asserted by a `package.json` check and an
  import grep), and the provenance fixture's `source_hash` /
  `registry_version` satisfy the `sha256:` shape rule. No canonicalizer is
  added here; hash *computation* belongs to the producer packet.
- **AC-10** — the scaffold run is recorded with observed output.

## Verification Steps

```bash
pnpm --filter @legendary-arena/lagn test
# expected: exit 0; all pre-existing tests still pass; new derivation +
# provenance blocks green; 0 failing

pnpm --filter @legendary-arena/lagn generate:schema
git diff --exit-code -- packages/lagn-spec/schemas/
# expected: exit 0, empty diff — the committed schema matches the generator

pnpm -r build
# expected: exit 0 across all packages

grep -riE 'json_?pointer' packages/lagn-spec/src packages/lagn-spec/schemas
# expected: no matches, exit 1 — AC-8, no JSON-pointer field anywhere

git diff --name-only
# expected: exactly the 13 files in §Files Expected to Change, no others
#           (plus any file folded in by §Empirical Scaffold, which amends the list)
```

## Definition of Done

- All ACs pass with observed output recorded, not asserted.
- Scaffold result recorded per §Empirical Scaffold.
- `pnpm -r build` 0; `git diff --name-only` contains no file outside
  §Files Expected to Change.
- D-24198 landed **Active**.
- `api-endpoints.md` rows replaced **whole** for every `validate`-gated
  request body (D-11804); no partial-column edit.
- `00.2-data-requirements.md` carries every new canonical field name.
- `docs/ai/STATUS.md` states: *No user-observable change — infrastructure
  only.*
- WORK_INDEX row `[ ]` → `[x]`; EC_INDEX Status → `Complete`.

## Reserved Decision (lands at execution)

**D-24198** — LAGN 1.2.0 carries provenance as evidence, not authority; the
registry stays the source of truth.

## Pre-Flight Resolutions (01.4)

First pre-flight returned **NOT READY**. Resolved in-place:

- **PS-6 (validation-tightening without a scaffold)** — §Empirical Scaffold
  added as a REQUIRED section with AC-10.
- **PS-1 / PS-7** — `## Vision Alignment` and this lint self-review added.
- **RS-1 / RS-2** — "four shipped fixtures" and "the 1.1.0 seam has landed"
  corrected; §Assumes now states plainly that `migrate.ts` does not exist at
  draft and `examples/` holds three fixtures.
- **§21 (lint gate, two rounds)** — first the `LAGN_VERSION` bump contradicted
  "producers keep emitting 1.1.0"; that was resolved by freezing
  **`LAGN_VERSION` at 1.1.0** (readers accept 1.2.0). The follow-up N/A claim
  was then **also wrong**: it reasoned only about emitted documents, while the
  packet narrows the *acceptance* envelope. **§21 is therefore TRIGGERED, not
  N/A** — `api-endpoints.md` is in §Files and the DoD, with D-11804 whole-row
  semantics. The follow-on producer-wiring packet updates it again.
- **§8 (D-24086 boundary)** — export-surface constraint added.
- **§7/§12/§13** — `ajv` disposition, test runner, and `pnpm` command form
  pinned; expected output added to every Verification Step.

**PS-5 remains open by design.** Three prerequisites are incomplete
(WP-393 draft, PR #825 open, PR #828 open). Per `01.0a §Phase 1 Definition
of Done → Blocking drafts`, this WP merges as a `[ ]` placeholder marked
**BLOCKED on WP-393**, reserving its numbers and signalling the dependency.
It is **not** cleared to execute.

## Lint Gate Self-Review (00.3)

All 21 sections resolved. Highlights:

- **§1/§2** — full structure incl. `## Non-Negotiable Constraints` and
  `## Context (Read First)`.
- **§4** — eight read-first inputs with section numbers, incl. `00.2 §7`
  and `api-endpoints.md`.
- **§5** — every file marked `— new` / `— modified`; 13 files (`package.json`
  moved to §Assumes as confirm-only, so a compliant run cannot trip its own
  file-count gate).
- **§6** — every new wire name enumerated in §Context and registered in
  `00.2` (no bare count to under-satisfy).
- **§7/§12** — `ajv` already a devDep; runner is `node:test` via `tsx`; no
  network, no DB.
- **§13** — expected output on every step; all commands use `pnpm`.
- **§15/§15.1** — DoD includes STATUS.md, the infrastructure-only wording,
  and the scope-boundary check.
- **§16** — `00.6-code-style.md` cited.
- **§17** — Vision Alignment present incl. the determinism-preservation line.
- **§20** — Funding Surface Gate **N/A, declared**.
- **§21** — API Catalog **TRIGGERED, declared**. The prior N/A reasoned only
  about emitted documents; the acceptance envelope narrows, so
  `api-endpoints.md` is in scope with D-11804 whole-row semantics.
- **§11/§18/§19** — N/A: no auth surface; AC-8's grep is a
  structural-absence check, not a prose-colliding literal; commit-time.
