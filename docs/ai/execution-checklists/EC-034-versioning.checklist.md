# EC-034 — Versioning & Save Migration Strategy (Execution Checklist)

**Source:** docs/ai/work-packets/WP-034-versioning-save-migration-strategy.md
**Layer:** Game Engine / Versioning

**Execution Authority:**
This EC is the authoritative execution checklist for WP-034.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-034.

---

## Before Starting

- [ ] WP-033 complete: `validateContent` exported (WP-033)
- [ ] `ReplayInput` exported from `replay.types.ts` (WP-027)
- [ ] `CampaignState`, `ScenarioDefinition` exported (WP-030)
- [ ] `MatchSnapshot`, `PersistableMatchConfig` exported (WP-013)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-034.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `EngineVersion = { major: number; minor: number; patch: number }`
- `DataVersion = { version: number }`
- `ContentVersion = { version: number }`
- `VersionedArtifact<T> = { engineVersion: EngineVersion; dataVersion: DataVersion; contentVersion?: ContentVersion; payload: T; savedAt: string }`
- `CompatibilityStatus = 'compatible' | 'migratable' | 'incompatible'`
- `CompatibilityResult = { status: CompatibilityStatus; message: string; migrations?: string[] }`
- Three axes are independent — engine bump does not require data bump
- Migrations are forward-only — no downgrade support
- Missing/unrecognized version = fail loud (D-0802)

---

## Guardrails

- Version stamps embedded at save time — never reconstructed or inferred
- Migration functions are pure and deterministic
- `migrateArtifact` throws on no migration path (correct — unmigratable is an error)
- All version types are JSON-serializable
- No `.reduce()` in migration logic
- No `boardgame.io` imports in versioning files
- No database or network access

---

## Required `// why:` Comments

- `versioning.types.ts`: three axes independent per D-0801; stamps embedded at save time
- `versioning.check.ts`: major = breaking; minor = migratable; patch = always compatible
- `versioning.migrate.ts`: migrations explicit and deterministic (D-0003)
- `versioning.stamp.ts`: stamps embedded at save time — never reconstructed

---

## Files to Produce

- `packages/game-engine/src/versioning/versioning.types.ts` — **new** — version types + VersionedArtifact
- `packages/game-engine/src/versioning/versioning.check.ts` — **new** — checkCompatibility
- `packages/game-engine/src/versioning/versioning.migrate.ts` — **new** — migrateArtifact
- `packages/game-engine/src/versioning/versioning.stamp.ts` — **new** — stampArtifact
- `packages/game-engine/src/types.ts` — **modified** — re-export versioning types
- `packages/game-engine/src/index.ts` — **modified** — export versioning API
- `packages/game-engine/src/versioning/versioning.test.ts` — **new** — 9 tests

---

## Common Failure Smells (Optional)

- Version stamps inferred at load time instead of embedded at save time
- Axes coupled — engine bump forces data bump
- `checkCompatibility` throws instead of returning structured result
- Downgrade migration path implemented (violates forward-only)

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `boardgame.io` import in versioning files
- [ ] No `.reduce()` in versioning
- [ ] `docs/ai/STATUS.md` updated
      (versioning strategy; three axes; D-0003, D-0801, D-0802)
- [ ] `docs/ai/DECISIONS.md` updated
      (independent axes; forward-only migrations; major vs minor; D-1002 relationship)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-034 checked off with date
