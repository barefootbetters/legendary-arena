# EC-421 — Support Pools on the MATCH-SETUP Envelope (Execution Checklist)

**Source:** docs/ai/work-packets/WP-391-support-card-pools.md
**Layer:** Registry

> **Retroactive registration.** Authored after the change was written, to bring
> PR #824 into EC-mode commit hygiene. Documents the change as landed.

## Before Starting
- [ ] Confirm the blocker is still real: `.claude/rules/code-style.md`
      §Data Contracts says "Do not rename, abbreviate, or add fields" for the
      nine composition fields, and `docs/03.1-DATA-SOURCES.md` (D-1244)
      enforces `additionalProperties: false`. If that has changed, STOP —
      the envelope route may no longer be the right shape
- [ ] Confirm the envelope IS extensible: same rules file states the lock
      "applies specifically to the composition block" and cites
      `MATCH-SETUP-SCHEMA.md §Extensibility Rules`; `heroSelectionMode`
      (WP-093 / D-9301) is the landed precedent
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 at baseline —
      observed **138 pass / 17 suites / 0 fail**
- [ ] `tsc -p packages/registry/tsconfig.build.json` exits 0 at baseline

## Locked Values (do not re-derive)
- Envelope field name is `supportPools`; kinds are exactly
  `bystanders | wounds | officers | sidekicks`
- `SupportPool` is `{ mode: "sets" | "explicit"; sets?: string[]; cards:
  { extId, copies }[] }` — there is **no `"default"` mode**; absence expresses it
- Pool card `extId` uses the set-qualified grammar (D-10014); `sets` entries
  are bare set abbreviations and use the unqualified grammar
- `SUPPORT_POOL_COUNT_FIELD` is the single tabulation of kind → count field;
  validators read it rather than repeating four literals
- `copies` is a **positive** integer — omit the card rather than list zero
- The registry test file's locked-baseline rule: all tests live inside the one
  wrapping `describe("setupContract (WP-091)")` so the **suite count stays 17**

## Guardrails
- Do NOT add any field to `CompositionSchema` or `SetupCompositionInput` —
  D-1244 stands unamended and the two drift assertions must pass untouched
- The cross-block invariant (`sum(copies)` equals the paired count) must be
  checked where **both** blocks are visible — a `superRefine` on
  `MatchSetupDocumentSchema`, not on either object schema alone
- `validateMatchSetupDocument` rebuilds the document field-by-field; an
  envelope field not echoed there is **silently dropped from valid output**.
  Any new envelope field MUST be echoed and MUST have a round-trip test
- `SupportPools` must be written longhand with explicit `| undefined`, not as
  `Partial<Record<...>>` — the package compiles under
  `exactOptionalPropertyTypes`, where `Partial` rejects zod's inferred output
- `MatchSetupDocumentSchema` gains a `superRefine`, making it a `ZodEffects`.
  Confirm no caller uses `.extend()` / `.shape` / `.partial()` on it before
  and after (only `.safeParse()` is used today)
- Do NOT touch LAGN in this EC — that is EC-422
- `.reduce()` for the copies sum is permitted here; the repo ban is scoped to
  zone operations and effect application

## Required `// why:` Comments
- The envelope placement: why not the composition block, citing D-1244 and the
  `heroSelectionMode` precedent
- `SUPPORT_POOL_COUNT_FIELD`: why the pairing is tabulated once
- The document-level `superRefine`: why the invariant cannot live on either
  object schema
- The echo in `validateMatchSetupDocument`: what silently breaks without it
- `SupportPools` longhand: the `exactOptionalPropertyTypes` interaction

## Files to Produce
- `packages/registry/src/setupContract/setupContract.types.ts` — **modified** —
  pool types, `SUPPORT_POOL_KINDS`, `SUPPORT_POOL_COUNT_FIELD`,
  `supportPools?` on `SetupEnvelope`
- `packages/registry/src/setupContract/setupContract.schema.ts` — **modified** —
  pool zod schemas, envelope wiring, document-level cross-block `superRefine`
- `packages/registry/src/setupContract/setupContract.validate.ts` — **modified** —
  echo `supportPools` into the rebuilt validated output
- `packages/registry/src/setupContract/setupContract.test.ts` — **modified** —
  pool cases inside the existing wrapping `describe`
- `docs/ai/DECISIONS.md` — **modified** — D-24194

## After Completing
- [ ] `tsc -p packages/registry/tsconfig.build.json` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 — **145 pass**
      (138 + 7), **suite count still 17**
- [ ] Full-`tsconfig` error count unchanged at **13 pre-existing** (test-file
      strictness, untouched)
- [ ] A round-trip test asserts `supportPools` survives validation
- [ ] `docs/ai/DECISIONS.md` — D-24194 Active
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped with date

## Common Failure Smells
- A pool parses valid then disappears downstream → the echo in
  `validateMatchSetupDocument` is missing; the round-trip test is what catches it
- Suite count moves off 17 → a second top-level `describe` was added
- `exactOptionalPropertyTypes` errors on the parsed document → `Partial<Record>`
  was used instead of the longhand interface
- Drift assertions fail → a field reached the composition block
