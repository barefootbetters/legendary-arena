# EC-061 — Rules Glossary Panel (Registry Viewer)

**Related Work Packet:** WP-060 (glossary data migration to R2) — this EC is
the UI-side work that presents the glossary; WP-060 will later replace the
hardcoded source with fetched data.

**Scope:** Add a persistent Rules Glossary panel to the registry viewer that
displays all rules, keywords, and hero classes from `useRules.ts`, with
click-to-open from keyword/rule tokens in ability text.

## Checklist

- [x] `useGlossary.ts` composable — shared reactive state, entry builder, lookup functions
- [x] `GlossaryPanel.vue` — sidebar (desktop) / bottom sheet (mobile), search, grouped entries, highlight animation
- [x] `CardDetail.vue` — keyword and rule tokens are clickable, open glossary to matching entry
- [x] `App.vue` — panel mounted at root, "📖 Glossary" header button, floating mobile button, Ctrl+K / Esc keyboard shortcuts
- [x] Vite production build passes (49 modules, 173KB JS)
- [x] No new dependencies added
- [x] Matches existing patterns (scoped CSS, Vue composables, no Tailwind/Pinia)
