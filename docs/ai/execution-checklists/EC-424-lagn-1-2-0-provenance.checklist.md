# EC-424 — LAGN 1.2.0 Card Metadata Provenance (Execution Checklist)

**Source:** docs/ai/work-packets/WP-394-lagn-1-2-0-provenance.md
**Layer:** Cross-cutting (contract package `packages/lagn-spec`)

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything else
      = STOP, with ONE sanctioned exception: files surfaced by the §Empirical
      Scaffold run are folded into the WP's Scope (In) + Files list FIRST, then
      edited. Undocumented additions remain a STOP.
- [ ] **WP-393 landed on `main`** — `RegistryInfo.registryVersion` + `setContentHashes` exist
- [ ] LAGN 1.1.0 seam on `main` — `LAGN_SUPPORTED_VERSIONS`, `migrateToCurrent`,
      `support_pools` (EC-422 / D-24195, merged 2026-07-18). Verify, don't assume.
- [ ] Derived-schema gate on `main` — `generateSchema()` derives from `lagnSchema`;
      `UNEXPRESSIBLE_CONSTRAINTS` + `ZodEffects` gate (WP-392 / D-24196). Verify.
- [ ] `pnpm --filter @legendary-arena/lagn test` exits 0 — record the baseline count
- [ ] Confirm `ajv` + `ajv-formats` are already devDeps (PR #828) — do NOT re-add;
      `package.json` is a precondition to check, NOT a file to edit
- [ ] `pnpm -r build` exits 0
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit
- [ ] **Scaffold first** (WP §Empirical Scaffold): prototype the version gate, run
      `pnpm --filter @legendary-arena/lagn test`, RECORD the observed output. This WP
      tightens validation — a `READY` reached by argument is invalid.
- [ ] **Re-verify D-24198 and WP/EC numbers are still free against `origin/main`.**
      This packet has already been renumbered twice mid-flight (WP-391→WP-393,
      WP-392→WP-394, EC-420→EC-423, EC-421→EC-424). Check, do not trust.

## Locked Values (do not re-derive)
- **`LAGN_VERSION` STAYS `1.1.0`** — readers accept 1.2.0, writers keep stamping 1.1.0.
  Bumping it moves the wire format of a catalogued endpoint. Do NOT bump.
- `migrateToCurrent` still targets 1.1.0. Register the 1.1.0→1.2.0 step but leave it
  UNREACHABLE; a 1.2.0 input returns UNCHANGED (never downgraded, never re-stamped).
- **No canonicalizer here.** `source_hash` / `registry_version` are SHAPE-validated
  only. Do NOT add `canonicalJson.ts` or a `@legendary-arena/registry` dep —
  hash computation belongs to the producer packet.
- Version string, verbatim: `1.2.0`; constant name `LAGN_VERSION_1_2_0`
- Enum after this WP, verbatim from the WP: `['1.0.0','1.1.0','1.2.0']`
- Block names, verbatim: `catalog_ref`, `registry_ref`, `effect_snapshot`
- `catalog_ref` fields: `source`, `registry_version`, `set_content_hashes`
- `registry_ref` fields: `ext_id`, `face_id` (optional)
- `effect_snapshot` fields: `text`, `tokens` (optional), `source_hash`
- `catalog_ref.source` is a CLOSED set `['legendary-arena-registry']`, not a free string
- `image.role` closed set: `card-front | card-back | tactic | transformed`
- Version-gate message, verbatim (00.6 Rule 11). NOT under `setup`; covers all three:
  `provenance requires lagn_version 1.2.0 or later — a <version> document cannot carry catalog_ref, registry_ref, or effect_snapshot`
- Token `kind` closed set: `keyword | icon | hero_class | team | custom`
- Hash prefix `sha256:`; canonicalization **RFC 8785 (JCS)** — must match WP-393
- Root `$schema` stays `https://json-schema.org/draft/2020-12/schema`
- `ext_id` grammar is D-10014 set-qualified `setAbbr/slug`

## Guardrails
- Code style per `00.6-code-style.md`: full English names, JSDoc on every function,
  no `.reduce()` for multi-step logic, ESM + `node:` prefixes only.
- Test runner is `node:test` via `tsx`, invoked with **`pnpm`** — never `npm run`.
  `ajv` + `ajv-formats` are ALREADY devDeps (PR #828); do not add another engine.
- Export new provenance **types** only — no new root runtime export beyond
  `validate`/`summarize`/`generateSchema`/`migrateToCurrent` without an
  ARCHITECTURE.md edit in the same commit (D-24086).
- **Every provenance field is optional.** A 1.0.0 or 1.1.0 document that
  validates today MUST still validate. Additive only.
- **Do not touch** `game_id`, `variant`, `Outcome`, `LossCondition`, `RarityCode`,
  `CardType`, `shield_officers_count`, `validate`, `summarize`, or the `$schema`
  default — the rejected source proposal changed all of these. Any change is a FAIL.
- `lagn_version` stays **required**. Never `.optional()`, never `.default()`.
- No `z.any()`. No JSON-pointer field of any kind.
- Do NOT remove existing `card_catalog` fields (`name`, `image_url`,
  `hero_class`, `rarity_code`) — breaking, deferred to v2.0.
- Do NOT hand-edit `schemas/lagn-v1.json`; regenerate it.
- Each new `.refine()`/`.superRefine()` MUST get an `UNEXPRESSIBLE_CONSTRAINTS`
  entry in the same edit, or the `ZodEffects` count gate fails the build.
- `support_pools` must survive 1.1.0 → 1.2.0 migration untouched.

## Required `// why:` Comments
- `LAGN_VERSION_1_2_0`: why 1.2.0 and not 1.1.0 (1.1.0 is taken by support pools)
- `effect_snapshot`: why this is **evidence, not truth** — registry stays authoritative
- `registry_ref.face_id`: why a face discriminator is required even though
  `faces[]` is deferred (D-24193 — 65 masterminds have a second face)
- Each new refinement: why JSON Schema cannot express it (mirrors its allowlist entry)
- JSDoc on `source_hash` / `registry_version`: why these are validated for SHAPE
  only here, and that RFC 8785 canonicalization is the producer's contract

## Files to Produce
- `packages/lagn-spec/src/validator.ts` — **modified** — constants, schemas, refinements, allowlist
- `packages/lagn-spec/src/migrate.ts` — **modified** — 1.1.0 → 1.2.0 step
- `packages/lagn-spec/src/types.ts` — **modified** — provenance types
- `packages/lagn-spec/src/index.ts` — **modified** — re-exports
- `packages/lagn-spec/src/validator.test.ts` — **modified** — new cases
- `packages/lagn-spec/examples/tier2-provenance.lagn.json` — **new** — fifth fixture
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated, never hand-edited
- `docs/ai/DECISIONS.md` — **modified** — D-24198 Active
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — new field names
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `validate`-gated request
  rows replaced WHOLE per D-11804 (acceptance envelope narrows; §21 TRIGGERED)
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`

## After Completing
- [ ] AC-1..AC-10 each demonstrated with observed output
- [ ] All **five** fixtures validated against the generated JSON Schema via `ajv` AND zod
- [ ] Refinement-count gate **mutation-tested** (inject an undocumented `.refine()` → red → revert → green)
- [ ] `generate:schema` then `git diff --exit-code -- schemas/` clean
- [ ] D-24198 landed **Active**; `00.2` updated
- [ ] `docs/ai/STATUS.md` states: *No user-observable change — infrastructure only.*
- [ ] `git diff --name-only` matches Files to Produce exactly (plus any scaffold
      fold-ins already recorded in the WP) — no undocumented files
- [ ] `api-endpoints.md` rows replaced WHOLE (D-11804); no partial-column edit
- [ ] WORK_INDEX `[x]`; EC_INDEX Status → `Complete`

## Common Failure Smells
- An existing fixture stops validating → a field was tightened, not added
- Refinement-count gate red → a `.refine()` landed without an allowlist entry
- `git diff` dirty on `schemas/` after regenerate → the file was hand-edited
- `support_pools` missing after migration → the 1.1.0 → 1.2.0 step overwrote `setup`
- Provenance accepted on a 1.1.0 document → the version gate refinement is missing
- A canonicalizer or a `@legendary-arena/registry` dep appeared → out of scope, revert
- `migrateToCurrent` started stamping 1.2.0 → the frozen-writer lock was broken
- A producer starts emitting 1.2.0 → `LAGN_VERSION` was bumped; revert it
