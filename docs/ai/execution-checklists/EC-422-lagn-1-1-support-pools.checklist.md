# EC-422 — LAGN 1.1.0: Version Seam + Support Pools (Execution Checklist)

**Source:** docs/ai/work-packets/WP-390-support-card-pools.md
**Layer:** Cross-cutting (`packages/lagn-spec` + two producers)

> **Retroactive registration.** Authored after the change was written, to bring
> PR #825 into EC-mode commit hygiene. Documents the change as landed.
> **Stacks on EC-421** — PR #825's base is PR #824's branch.

## Before Starting
- [ ] EC-421 landed (or its branch is the base) — D-24194 defers the wire
      format to this EC
- [ ] Confirm all three hazards are still present before changing anything:
      (a) `lagn_version` is `z.literal('1.0.0')` — a hard gate, no migration
      path; (b) the root schema has **no `.strict()`**, so zod STRIPS unknown
      keys rather than rejecting them; (c) `generateSchema()` is a
      **hand-written duplicate** of the zod schema in the same file
- [ ] `pnpm --filter @legendary-arena/lagn test` exits 0 at baseline —
      observed **21 pass / 0 fail**
- [ ] CI's LAGN Schema Drift Guard regenerates `schemas/lagn-v1.json` and fails
      on a non-empty `git diff` — the regenerated file MUST be committed

## Locked Values (do not re-derive)
- `LAGN_VERSION_1_0_0 = '1.0.0'`, `LAGN_VERSION_1_1_0 = '1.1.0'`,
  `LAGN_VERSION = LAGN_VERSION_1_1_0`
- `LAGN_SUPPORTED_VERSIONS = ['1.0.0', '1.1.0']`, **oldest first** — the
  migration walk indexes this array
- Version constants live in TS, deliberately NOT read from `package.json`
  (`versioning.check.ts` convention); `package.json` is the human-readable
  copy bumped in lockstep
- LAGN pool keys are snake_case and use `shield_officers` (matching
  `shield_officers_count`), NOT `officers`
- Migration key form is `"<from>-><to>"`; the registry is `Object.freeze`d and
  forward-only
- One schema file per MAJOR version: `schemas/lagn-v1.json` stays the single
  generated artifact; `lagn_version` moves `const` → `enum`

## Guardrails
- **Readers accept every supported version; writers emit only `LAGN_VERSION`.**
  That asymmetry is what avoids a migration pass over stored records
- Do NOT add `.strict()` to the root schema — it would newly reject documents
  that pass today. Close the silent-strip hole by **version-gating**
  `support_pools` (rejected on a 1.0.0 document) instead
- The `1.0.0 -> 1.1.0` migration is a **pure restamp**. It must NOT synthesize
  pools from counts — no card identity is recoverable from a count, and a
  fabricated pool is worse than an absent one. Assert this with a test
- Migration functions stay pure: no I/O, no RNG, no wall clock
- `migrateToCurrent` fails loud (returns an `error`) on an unknown version or a
  registry gap — never a partially-migrated payload (D-0802 posture)
- `generateSchema()` is hand-written: every zod change must be mirrored there
  **by hand**. CI only checks committed-JSON-matches-generator, NOT
  generator-matches-zod — the two can diverge with CI green
- Do NOT change the `$schema` URL; every producer stamps it

## Required `// why:` Comments
- The version constants block: why constants and not a literal; the
  `versioning.check.ts` precedent and the not-from-`package.json` rationale
- The version gate on `support_pools`: that zod strips rather than rejects, and
  what silently breaks without the gate
- The restamp migration: why pools are NOT synthesized from counts
- `support_pools` placement on `setup`: why a local refinement here, versus the
  cross-block invariant EC-421 had to accept
- The JSON Schema `support_pools` block: which constraints have no JSON Schema
  equivalent (sum-equals-count, version gate), as the `seq` constraint already does

## Files to Produce
- `packages/lagn-spec/src/validator.ts` — **modified** — version constants,
  pool schemas, `support_pools` on `GameSetupSchema` + sum refinement, root
  version enum + version gate, hand-written JSON Schema mirror + `$defs`
- `packages/lagn-spec/src/migrate.ts` — **new** — forward-only migration seam
- `packages/lagn-spec/src/index.ts` — **modified** — export constants + migration
- `packages/lagn-spec/src/validator.test.ts` — **modified** — version, pool,
  and migration cases + a shared fixture builder
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — REGENERATED via
  `generate:schema`, never hand-edited
- `packages/lagn-spec/examples/tier1-support-pools.lagn.json` — **new**
- `apps/server/src/match/matchLagn.logic.ts` — **modified** — stamp the constant
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` — **modified** —
  stamp the constant
- `docs/ai/DECISIONS.md` — **modified** — D-24195

## After Completing
- [ ] `pnpm --filter @legendary-arena/lagn test` exits 0 — **34 pass** (21 + 13)
- [ ] `pnpm --filter @legendary-arena/lagn generate:schema` leaves a clean
      `git diff` (the CI drift guard's exact check)
- [ ] **All four `examples/*.lagn.json` validate**, including the three
      pre-existing 1.0.0 ones — this is the back-compat evidence, not an assertion
- [ ] `pnpm -r build` exits 0; Typecheck Arena Client green in CI
- [ ] `docs/ai/DECISIONS.md` — D-24195 Active
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped with date

## Common Failure Smells
- An existing 1.0.0 example stops validating → the version enum was replaced
  rather than widened; back-compat is broken
- A pool on a 1.0.0 document validates → the version gate is missing and zod is
  silently stripping the field
- The drift guard fails → `schemas/lagn-v1.json` was hand-edited, or
  `generateSchema()` was not updated alongside the zod change
- A migrated document carries pools that were never authored → the restamp is
  synthesizing from counts
