# EC-033 — Content Authoring Toolkit (Execution Checklist)

**Source:** docs/ai/work-packets/WP-033-content-authoring-toolkit.md
**Layer:** Game Engine / Content Validation

**Execution Authority:**
This EC is the authoritative execution checklist for WP-033.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-033.

---

## Before Starting

- [ ] WP-031 complete: engine invariant checks exist
- [ ] `HeroAbilityHook` exported from `heroAbility.types.ts` (WP-021)
- [ ] `HERO_KEYWORDS`, `BOARD_KEYWORDS` exported (WP-021, WP-025)
- [ ] `SchemeSetupInstruction` exported from `schemeSetup.types.ts` (WP-026)
- [ ] `ScenarioDefinition` exported from `campaign.types.ts` (WP-030)
- [ ] `packages/registry/src/schema.ts` exists with Zod schemas (WP-003)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-033.
If formatting, spelling, or ordering differs, the implementation is invalid.

- Content types requiring schemas:
  Hero cards, Villains, Henchmen, Masterminds (+ tactics), Schemes (+ setup
  instructions), Scenarios (from WP-030)

- `ContentValidationResult` shape:
  - `{ valid: true }` or `{ valid: false; errors: ContentValidationError[] }`

- `ContentValidationError` shape:
  - `{ contentType: string; contentId: string; field: string; message: string }`

- Validation is a pre-engine gate — invalid content never reaches `Game.setup()`
- Schemas reference canonical unions: `HERO_KEYWORDS`, `BOARD_KEYWORDS`

---

## Guardrails

- Schemas are pure declarations — no runtime code, no functions, no closures
- Validation returns structured results — never throws
- Error messages are full sentences (Rule 11)
- No `.reduce()` in validation logic — use `for...of`
- No modifications to `packages/registry/src/schema.ts`
- No `boardgame.io` imports in content files
- Tests use `node:test` and `node:assert` only

---

## Required `// why:` Comments

- Schema file: schemas are author-facing; engine-facing validation is in registry Zod schemas
- Each validation stage in `content.validate.ts`: explain what the stage catches

---

## Files to Produce

- `packages/game-engine/src/content/content.schemas.ts` — **new** — author-facing schemas
- `packages/game-engine/src/content/content.validate.ts` — **new** — validateContent, validateContentBatch
- `packages/game-engine/src/types.ts` — **modified** — re-export content types
- `packages/game-engine/src/index.ts` — **modified** — export content API
- `packages/game-engine/src/content/content.validate.test.ts` — **new** — 9 tests

---

## Common Failure Smells (Optional)

- Validation throws instead of returning structured error result
- Error messages are terse fragments instead of full sentences
- `.reduce()` used to accumulate validation errors
- Registry Zod schemas modified instead of extending with author-facing schemas

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `boardgame.io` import in content files
- [ ] No `.reduce()` in validation
- [ ] `packages/registry/src/schema.ts` not modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (content validation toolkit; D-0601, D-0602 implemented)
- [ ] `docs/ai/DECISIONS.md` updated
      (content validation vs registry Zod schemas; semantic checks; canonical keyword union references)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-033 checked off with date
