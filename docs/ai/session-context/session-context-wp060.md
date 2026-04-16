Glossary data is currently hardcoded in the registry viewer at
`apps/registry-viewer/src/composables/useRules.ts`. WP-060 migrates it to
external JSON files on R2 so definitions can be edited without rebuilding.

Current hardcoded glossary (as of this session):
- KEYWORD_GLOSSARY: ~130 entries (Map<string, string>)
  Includes base keywords + modifier variants added this session:
  ultimateabomination, doublestriker, triplestriker, doubleabomination,
  highestabomination, doubleempowered, tripleempowered, quadrupleempowered,
  doubledarkmemories, doublelaststand, doubleshieldclearance
- RULES_GLOSSARY: 20 entries (Map<string, RuleEntry> with label + summary)
- HERO_CLASS_GLOSSARY: 5 entries (Map<string, string>)

Canonical source data (external, NOT in this repo):
- `C:\Users\jjensen\bbcode\modern-master-strike\src\data\keywords-full.json` (102 keywords)
- `C:\Users\jjensen\bbcode\modern-master-strike\src\data\rules-full.json` (18 rules)
NOTE: the hardcoded glossary in useRules.ts has MORE entries than the source
JSON files (we added ~30 keywords during viewer development). The migration
must use the hardcoded glossary as the baseline, NOT the source JSON files.

What WP-060 must do:
1. Export current KEYWORD_GLOSSARY, RULES_GLOSSARY, HERO_CLASS_GLOSSARY from
   useRules.ts into JSON files at `data/metadata/keywords.json`,
   `data/metadata/rules.json`, `data/metadata/hero-classes.json`
2. Upload those JSON files to R2 at `{metadataBaseUrl}/metadata/`
3. Update the registry viewer to fetch glossary data from R2 at startup
   (follow the themeClient.ts singleton pattern)
4. Remove the hardcoded Map definitions from useRules.ts — keep only the
   lookup functions, parseAbilityText(), and type definitions
5. Hero class glossary stays hardcoded (5 entries, never changes)

Existing patterns to follow:
- `src/lib/themeClient.ts` — singleton loader, fetch from R2, Promise cache
- `src/lib/registryClient.ts` — config loading from registry-config.json
- `public/registry-config.json` — already has metadataBaseUrl

Key constraints:
- Glossary fetch must be non-blocking (like themes) — card view works even
  if glossary fetch fails, falling back to empty definitions
- lookupKeyword() and lookupRule() signatures must not change (callers
  throughout CardDetail.vue, GlossaryPanel.vue, useGlossary.ts)
- The useGlossary.ts composable builds its entry list from the glossary
  maps — it must rebuild after the async fetch completes

Additional context from this session:
- lookupKeyword() was enhanced with suffix + substring matching to handle
  modifier prefixes like "Ultimate Abomination", "Double Striker", etc.
  This logic must be preserved in the migration.
- The GlossaryPanel component (useGlossary.ts) builds a unified entry list
  from all three glossary sources at import time. After WP-060, this needs
  to rebuild after the async glossary fetch resolves.

Registry viewer CLAUDE.md at `apps/registry-viewer/CLAUDE.md` has full
architecture documentation for the viewer.
