68 theme JSON files already exist in `content/themes/` — authored, validated
against card registry data, and deployed to R2. WP-055 needs to create the
Zod schema and validation infrastructure, NOT the theme files themselves.

What already exists (do NOT recreate):
- `content/themes/*.json` — 68 committed themes across 9 categories
- `content/themes/CATALOG.md` — generated slug reference (774 entries)
- `content/themes/THEME-INDEX.md` — canonical index with governance rules
- `content/themes/index.json` — R2 manifest of all theme filenames
- `scripts/generate-theme-catalog.mjs` — catalog generator
- `scripts/comicvine-cover-fetcher.mjs` — cover image URL fetcher
- `scripts/upload-themes-to-r2.mjs` — R2 upload script
- `apps/registry-viewer/` — Themes tab, ThemeGrid, ThemeDetail already live
- `docs/ai/DECISIONS.md` — D-5501 through D-5508 (theme governance)
- `docs/ai/work-packets/WP-055-theme-data-model.md` — full spec with schema

What WP-055 must create:
- `packages/registry/src/theme.schema.ts` — Zod schemas (ThemeDefinitionSchema,
  ThemeSetupIntentSchema, ThemePlayerCountSchema, ThemePrimaryStoryReferenceSchema)
- `packages/registry/src/theme.validate.ts` — validateTheme() sync,
  validateThemeFile() async with filename-to-themeId alignment check
- `packages/registry/src/theme.schema.test.ts` — 8 tests per the WP spec

Schema must include `comicImageUrl: z.string().url().nullable().optional()`
(added during this session — see D-5506). The WP-055 spec has been updated
to include this field.

Theme JSON shape (current, all 68 files follow this):
- themeSchemaVersion: 1
- themeId: kebab-case string
- name, description: required strings
- setupIntent: { mastermindId, schemeId, villainGroupIds, henchmanGroupIds?, heroDeckIds }
- playerCount: { recommended: number[], min, max }
- tags?: string[]
- references?: { primaryStory: { issue?, year?, externalUrl?, marvelUnlimitedUrl?, externalIndexUrls? } }
- flavorText?: string
- comicImageUrl?: string | null

MatchSetupConfig contract (WP-005A, locked):
- IDs are bare slugs matching SetData entries (e.g., "loki", "hydra")
- Count fields (bystandersCount, woundsCount, etc.) excluded from themes

Key constraint: theme schema lives in packages/registry/ ONLY. No imports
from game-engine. No boardgame.io imports. Registry layer boundary enforced.

Test runner: node:test. Test extension: .test.ts. No .test.mjs.
