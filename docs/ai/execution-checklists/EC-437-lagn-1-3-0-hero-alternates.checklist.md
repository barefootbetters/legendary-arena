# EC-437 — LAGN 1.3.0 Hero Alternates (Execution Checklist)

**Source:** docs/ai/work-packets/WP-402-lagn-1-3-0-hero-alternates.md
**Layer:** Cross-cutting (contract package `packages/lagn-spec`)

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything else
      = STOP, with ONE sanctioned exception: files surfaced by a re-run of the
      §Empirical Scaffold are folded into the WP's Scope (In) + Files list FIRST,
      then edited. Undocumented additions remain a STOP.
- [ ] **Re-verify WP-402 / EC-437 / D-24210 / D-24211 are still free** against
      `origin/main` — include open PR branches (`gh pr list`), not just `main`.
      D-24209 landed with PR #872 (`1c8809f3`); the next free D-number starts at D-24210.
- [ ] LAGN 1.2.0 on `main` — `LAGN_VERSION_1_2_0`, provenance blocks, five fixtures
      (WP-394 / D-24198). Verify, don't assume.
- [ ] Derived-schema gate on `main` — `UNEXPRESSIBLE_CONSTRAINTS` + the `ZodEffects`
      count gate (WP-392 / D-24196). Verify.
- [ ] `pnpm --filter @legendary-arena/lagn test` exits 0 — record the count
      (expected **54**; if it differs, the baseline moved — re-read the WP).
- [ ] `pnpm -r build` exits 0.
- [ ] `ajv` + `ajv-formats` are ALREADY devDeps — a precondition to CHECK, never a
      file to edit for that reason.
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit.
- [ ] **Scaffold already RUN at draft** (WP §Empirical Scaffold: 54 → 52/2, zero
      fixture breakage). Re-run only if `main` moved under the package since
      `1c8809f3`.

## Locked Values (do not re-derive)
- **`LAGN_VERSION` STAYS `1.1.0`.** Bumping it is WP-404's job and moves a
  catalogued endpoint. Do NOT bump it here.
- Version string, verbatim: `1.3.0`; constant name `LAGN_VERSION_1_3_0`
- Enum after this WP, verbatim: `['1.0.0','1.1.0','1.2.0','1.3.0']`
- Block name, verbatim: `hero_alternates`, under `setup` — NOT at the document root
- Entry shape, verbatim: `{ id: string, name: string }` — mirrors `setup.heroes`
  exactly. No `slug`, no `hero_class`, no `role`, no `order` field.
- `.min(1).optional()` — **NO `.max()`.** A cap in a published standard cannot be
  relaxed without a major version; the UI offers two slots (WP-404).
- Version-gate message, verbatim (00.6 Rule 11):
  `setup.hero_alternates requires lagn_version 1.3.0 or later — an earlier document cannot carry hero alternates`
- Overlap message, verbatim:
  `<ext_id> is listed as both a played hero and an alternate — a hero is one or the other, never both`
- Duplicate message, verbatim:
  `<ext_id> is listed more than once among the hero alternates`
- Fixture filename, verbatim: `examples/tier1-hero-alternates.lagn.json`
- `ext_id` grammar is D-10014 set-qualified `setAbbr/slug`
- Root `$schema` stays `https://json-schema.org/draft/2020-12/schema`

## Guardrails
- **Additive only.** Every 1.0.0 / 1.1.0 / 1.2.0 document valid today MUST still
  validate. An existing fixture that stops validating means a field was tightened,
  not added — revert and re-approach.
- **`setup.heroes` is untouched.** Do not add a max, a min, a bench flag, or a
  discriminator to it. The bench is a sibling block, never entries in `heroes`.
- **Do not hardcode 5, 6, 7, or 2 anywhere.** Played-hero count comes from
  `PLAYER_COUNT_SETUP` and is not this package's business; bench size is unbounded.
- **The ordinal-gate fix is REQUIRED, not optional.** Converting the provenance
  gate from `=== LAGN_VERSION_1_2_0` to an ordinal comparison is in scope; shipping
  1.3.0 without it silently breaks the D-24198 audit bundle. AC-5 pins it.
- Each new `.refine()` / `.superRefine()` MUST get its `UNEXPRESSIBLE_CONSTRAINTS`
  entry **in the same edit**, or the `ZodEffects` count gate fails the build.
  The allowlist is 1:1 with refinement **nodes**, not with prose constraints —
  one node raising two issues gets one entry describing both.
- Do NOT hand-edit `schemas/lagn-v1.json`; regenerate it.
- `lagn_version` stays **required**. Never `.optional()`, never `.default()`.
- No `z.any()`. No new root runtime export beyond the existing four without an
  ARCHITECTURE.md edit in the same commit (D-24086).
- No `@legendary-arena/registry` dependency, no hash computation, no canonicalizer.
- `support_pools` and all provenance blocks survive 1.2.0 → 1.3.0 migration untouched.

## Required `// why:` Comments
- `LAGN_VERSION_1_3_0`: why 1.3.0 — 1.2.0 is allocated to provenance (D-24198) and
  must survive untouched
- `hero_alternates`: why a sibling block and not more entries in `setup.heroes` —
  hero count is exact-enforced against `PLAYER_COUNT_SETUP` (3/5/6 by seat count)
- `hero_alternates`: why this is loadout metadata and never gameplay state (D-24210)
- The ordinal comparison: why equality was wrong — cite the observed
  `1.3.0 + provenance → INVALID` scaffold result and D-24211
- The version gate: why rejection beats silent stripping — `lagnSchema` is not
  `.strict()`, so an ungated bench vanishes on parse and the preset returns empty
- Each new refinement: why JSON Schema cannot express it (mirrors its allowlist entry)
- Absence of `.max()`: why the cap lives in the UI and not the standard

## Files to Produce
- `packages/lagn-spec/src/validator.ts` — **modified** — constant, block, 2 refinements,
  2 allowlist entries, ordinal gate fix
- `packages/lagn-spec/src/migrate.ts` — **modified** — 1.2.0 → 1.3.0 step, unreachable
- `packages/lagn-spec/src/types.ts` — **modified** — `HeroAlternate`
- `packages/lagn-spec/src/index.ts` — **modified** — re-exports
- `packages/lagn-spec/src/validator.test.ts` — **modified** — new cases + enum re-pin
- `packages/lagn-spec/examples/tier1-hero-alternates.lagn.json` — **new**
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated
- `wiki/lagn-v1.md` — **modified** — 1.3.0 read row + `hero_alternates`
- `docs/ai/DECISIONS.md` — **modified** — D-24210 + D-24211 Active
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — rows replaced WHOLE (D-11804)
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — `📝` → `✅`

## After Completing
- [ ] AC-1..AC-11 each demonstrated with observed output
- [ ] All **six** fixtures validated against the generated JSON Schema via `ajv` AND zod
- [ ] Refinement-count gate **mutation-tested** (inject undocumented `.refine()` → red → revert → green)
- [ ] AC-5 test fails against the pre-fix equality gate — demonstrate it, don't assert it
- [ ] `generate:schema` then `git diff --exit-code -- schemas/` clean
- [ ] `packages/lagn-spec/package.json` UNCHANGED — manifest is already `1.1.0` and
      `LAGN_VERSION` stays `1.1.0`; the bump belongs to WP-404 (AC-10)
- [ ] D-24210 + D-24211 landed **Active**; `00.2` updated
- [ ] `docs/ai/STATUS.md` states: *No user-observable change — infrastructure only.*
- [ ] `git diff --name-only` matches Files to Produce exactly
- [ ] `api-endpoints.md` rows replaced WHOLE (D-11804); no partial-column edit
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- An existing fixture stops validating → a field was tightened, not added
- Refinement-count gate red → a `.refine()` landed without an allowlist entry
- `git diff` dirty on `schemas/` after regenerate → the file was hand-edited
- A 1.1.0 document accepts `hero_alternates` → the version gate refinement is missing
  (and the block is being silently stripped — the worst available failure)
- `1.3.0 + catalog_ref` rejected → the ordinal-gate fix was skipped
- `setup.heroes` grew a `.max()` or a bench flag → wrong shape; the bench is a sibling
- A `.max(2)` appeared on `hero_alternates` → the cap belongs in the UI, revert
- A producer starts emitting 1.3.0 → `LAGN_VERSION` was bumped; that is WP-404
- `migrateToCurrent` invented a bench from `setup.heroes` → migration is forward-only
  and never fabricates information that was never there
