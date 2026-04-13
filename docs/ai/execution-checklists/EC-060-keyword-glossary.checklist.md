# EC-060 — Keyword & Rule Glossary Tooltips (Execution Checklist)

**Source:** docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md
**Layer:** Registry Viewer (apps/registry-viewer)

## Before Starting
- [x] WP-003 complete (registry exists)
- [x] Build passes: `pnpm --filter registry-viewer build`

## Guardrails
- No imports from `packages/game-engine/`
- No imports from `boardgame.io`
- Glossary fetch is non-blocking (card view works if fetch fails)
- Hero class glossary (5 entries) stays hardcoded — not in external data

## Files to Produce
- `apps/registry-viewer/CLAUDE.md` — **new** — onboarding context doc
- `apps/registry-viewer/HISTORY-modern-master-strike.md` — **new** — predecessor history
- `apps/registry-viewer/src/App.vue` — **modified** — hide set pills on mobile
- `apps/registry-viewer/src/components/CardDetail.vue` — **modified** — hero class tooltips
- `apps/registry-viewer/src/composables/useRules.ts` — **modified** — full keyword glossary + hero class glossary

## After Completing
- [x] Build passes: `pnpm --filter registry-viewer build`
- [x] No engine imports in changed files
