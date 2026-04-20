# EC-055 — Theme Data Model (Execution Checklist)

**Source:** docs/ai/work-packets/WP-055-theme-data-model.md
**Layer:** Registry / Content Contracts

## Before Starting
- [ ] WP-003 complete (registry + Zod patterns exist in `packages/registry/src/schema.ts`)
- [ ] WP-005A complete (`MatchSetupConfig` field names locked)
- [ ] Card metadata has stable `ext_id` values usable by authors
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 (baseline: 3 tests / 1 suite / 0 failing)
- [ ] `apps/registry-viewer/src/lib/themeClient.ts` and `apps/registry-viewer/CLAUDE.md` are quarantined in `stash@{0}` "wp-055-quarantine-viewer" (stashed 2026-04-20 per pre-flight PS-4; do NOT pop during WP-055 execution)

## Locked Values (do not re-derive)
- `themeSchemaVersion: 2` (literal; `z.literal(2)`, not generic `number`)
- `themeId` regex: `/^[a-z0-9]+(-[a-z0-9]+)*$/` (kebab-case)
- `setupIntent` field names (verbatim from `MatchSetupConfig`, WP-005A): `mastermindId`, `schemeId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`
- Count fields (`bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`) are **excluded** from `setupIntent` — themes describe composition, not pile sizing
- `ThemeMusicAssets` fields (all optional URLs): `previewIntroUrl`, `matchStartUrl`, `ambientLoopUrl`, `mainThemeUrl`, `schemeTwistUrl`, `masterStrikeUrl`, `villainAmbushUrl`, `bystanderUrl`
- `playerCount` refinements: `min <= max`; every `recommended[i]` within `[min, max]`
- Storage layout: one JSON file per theme in `content/themes/`, filename slug equals `themeId`
- Manifest-driven test discovery: `content/themes/index.json` is the authoritative list of shipped theme files (NOT `readdir`)
- Test-file suite wrapping: all 10 tests live inside a single `describe('theme schema (WP-055)')` block (+1 suite) — baseline shift `3/1 → 13/2`
- `validateTheme` / `validateThemeFile` never throw — all failures return `ValidationFailure`
- Four stable error-path labels on `validateThemeFile` failures: `'file'` (I/O), `'json'` (malformed JSON), `'themeId'` (filename mismatch), or Zod issue path (schema violation)
- I/O failure message template (verbatim): `` `Cannot read theme file "${filePath}": ${message}.` ``
- JSON parse failure message template (verbatim): `` `Theme file "${filePath}" contains invalid JSON: ${message}.` ``
- filename-mismatch message template (verbatim): `` `Filename slug "${filenameSlug}" does not match themeId "${validation.theme.themeId}". Theme files must be named {themeId}.json.` ``
- Test #8 is a single `test()` call with Parts A/B/C internal assertions (WP-033 P6-23 count-preservation); Part C writes its malformed-JSON fixture under `os.tmpdir()` and cleans up in `t.after()`
- Test #1 carries one additional assertion (`assert.notStrictEqual(result.theme, inputData)`) pinning the WP-028 / D-2802 top-level aliasing-prevention semantic; nested-reference semantics remain documented-but-untested by design

## Guardrails
- Registry-layer only — no imports from `packages/game-engine/`, no `boardgame.io`, no `apps/server/`, no `apps/registry-viewer/`
- Node built-ins only (`node:fs/promises`, `node:path`) + `zod` — no other runtime dependencies
- `validateTheme` / `validateThemeFile` return structured results; **never throw** — `validateThemeFile` wraps `readFile` and `JSON.parse` in try/catch and returns a `ValidationFailure` with error-path `'file'` or `'json'`
- Zone contents, runtime mutation, and engine integration are out of scope — themes are data only
- Immutable files from WP-003 (`schema.ts`, `shared.ts`, `impl/localRegistry.ts`) remain untouched
- `parDifficultyRating` excluded from v2 (WP-048 owns PAR scoring)
- External URLs (Marvel Unlimited, Fandom, CMRO, Comic Vine) are editorial — never required at runtime

## Required `// why:` Comments
- `theme.schema.ts` `ThemeSetupIntentSchema`: MatchSetupConfig field-name match and count-field exclusion (WP-005A)
- `theme.schema.ts` `ThemePrimaryStoryReferenceSchema`: editorial-only, vendor URLs may rot
- `theme.schema.ts` `ThemeMusicAssetsSchema`: all URLs optional so themes can ship partial audio coverage
- `theme.schema.ts` `ThemeDefinitionSchema`: comicImageUrl editorial (D-5506); music fields are v2 additions (D-5509); parDifficultyRating intentionally excluded (WP-048 defers PAR)
- `theme.validate.ts` `validateTheme`: returned `theme` shares nested references with input `data`; callers wanting isolation must clone (WP-028 / D-2802 aliasing-prevention precedent)
- `theme.validate.ts` `validateThemeFile` I/O try/catch: I/O failures return structured result, never throw (aggregation over many files without try/catch noise)
- `theme.validate.ts` `validateThemeFile` JSON try/catch: malformed JSON returns structured result, never throws (uniform authoring-workflow error reporting)
- `theme.validate.ts` `validateThemeFile`: filename-to-themeId alignment prevents silent directory-scan mismatches
- `theme.schema.test.ts` directory-scan test: reads `content/themes/index.json` manifest (not `readdir`) to exclude aggregate/manifest files

## Files to Produce
- `packages/registry/src/theme.schema.ts` — **new** — `ThemeDefinitionSchema`, `ThemeSetupIntentSchema`, `ThemePlayerCountSchema`, `ThemePrimaryStoryReferenceSchema`, `ThemeMusicAssetsSchema` + inferred `ThemeDefinition` type
- `packages/registry/src/theme.validate.ts` — **new** — `validateTheme` (sync), `validateThemeFile` (async, filename alignment check)
- `packages/registry/src/theme.schema.test.ts` — **new** — 10 `node:test` cases inside one `describe('theme schema (WP-055)')` block
- `content/themes/minimal-example.json` — **new** — minimal theme (required fields only)
- `content/themes/*.json` — **modify (v1→v2 migration per D-5509)** — 68 shipped themes migrated to `themeSchemaVersion: 2` with optional `musicTheme` / `musicAIPrompt` / `musicAssets` (migration already staged in working tree; commit under WP-055 allowlist so §D.8 sees a fully-migrated set)
- `packages/registry/src/index.ts` — **modify (public-surface extension)** — append theme exports: `type ThemeDefinition`, the five schemas (`ThemeDefinitionSchema`, `ThemeSetupIntentSchema`, `ThemePlayerCountSchema`, `ThemePrimaryStoryReferenceSchema`, `ThemeMusicAssetsSchema`), and both validators (`validateTheme`, `validateThemeFile`). Additive only — no existing export may be reordered, renamed, or removed

## After Completing
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 (13 tests / 2 suites / 0 failing)
- [ ] `pnpm -r build` exits 0; `pnpm test` exits 0 (repo-wide 526 → 536)
- [ ] `grep -r "game-engine" packages/registry/src/theme.*.ts` — no output
- [ ] `grep -r "from ['\"]boardgame\.io" packages/registry/src/theme.*.ts` — no output (escaped dot per P6-22)
- [ ] `grep -r "require(" packages/registry/src/theme.*.ts` — no output
- [ ] `git diff packages/game-engine/src/matchSetup.types.ts` — no changes
- [ ] Every filename in `content/themes/index.json` passes `validateThemeFile`
- [ ] `docs/ai/STATUS.md` updated — theme data model v2 established
- [ ] `docs/ai/DECISIONS.md` updated — D-5501 … D-5509 confirmed still valid; no new D-entries required unless pre-flight surfaces new decisions
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-055 checked off with date + v2 title correction
- [ ] `docs/ai/post-mortems/01.6-WP-055-theme-data-model.md` produced (mandatory per pre-flight — new long-lived abstraction + contract consumed by future WPs)

## Common Failure Smells
- §D.8 directory scan uses `readdir()` instead of `index.json` manifest → aggregate files (`00-ALL_THEMES_COMBINED.json`, `01-ALL_THEMES_COMBINED.json`, `index.json` itself) fail validation
- Test file uses `.test.mjs` instead of `.test.ts` → violates repo-wide test-extension rule
- `setupIntent` gains count fields → locked-value drift from WP-005A (themes describe composition, not pile sizing)
- `themeSchemaVersion` declared as `z.number()` instead of `z.literal(2)` → v1 files silently accepted (fails test #9)
- Directory-scan test imports from `packages/registry/src/index.ts` before `index.ts` re-exports are added → import error; land §E exports before test imports
- Reordering, renaming, or removing existing exports in `packages/registry/src/index.ts` → forbidden by §E "additive only" rule; surfaces as diff noise in pre-commit review
- Registry-viewer files (`themeClient.ts`, `apps/registry-viewer/CLAUDE.md`) staged in WP-055 commit → scope violation; both are quarantined in stash@{0} "wp-055-quarantine-viewer" and must remain there
