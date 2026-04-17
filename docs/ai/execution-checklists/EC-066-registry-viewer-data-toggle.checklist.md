# EC-066 — Registry Viewer: Card Image-to-Data Toggle (Execution Checklist)

**Source:** docs/ai/work-packets/WP-066-registry-viewer-data-toggle.md
**Layer:** Client UI (Vue 3 SPA — `apps/registry-viewer/`)

---

## Before Starting

- [ ] `apps/registry-viewer/` runs without errors (`pnpm --filter registry-viewer dev` and `pnpm --filter registry-viewer build`)
- [ ] `FlatCard` type fully available with all attributes from `src/registry/browser.ts`
- [ ] Vue 3 Composition API is the standard pattern (confirmed in existing components)
- [ ] `localStorage` accessible in browser environment
- [ ] No new npm dependencies will be added (use only Vue 3 + existing project tooling)
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer lint` exits 0

---

## Locked Values (do not re-derive)

**localStorage Persistence:**
- Key: `cardViewMode` (exact spelling — case-sensitive)
- Allowed values: `'image'` | `'data'` (strings, not booleans or other types)
- Default (on first visit): `'image'`

**FlatCard Display Field Names (use EXACTLY as specified):**
- `cost` → "Cost"
- `attack` → "Attack"
- `recruit` → "Recruit"
- `victoryPoints` → "Victory Points"
- `recruiterText` → "Recruiting Effect"
- `attackerText` → "Attack Effect"
- `abilityText` → "Ability"
- `heroClass` → "Class"
- `team` → "Team"
- `rarity` → "Rarity"
- `edition` → "Edition"
- `type` → "Type"
- `name` → "Name"

**Conditional Logic (AND semantics):**
- Data view displays attributes only if non-null and non-empty
- Empty/null fields rendered as em-dash (—) or omitted entirely (designer choice)
- Both modes show identical selected card; only presentation differs

---

## Guardrails

- **Never break existing display:** image view must render identically before/after this packet
- **Toggling view MUST NOT reset:** selectedCard, filteredCards, searchText, filterSet, filterHC, or any filter state
- **localStorage must persist:** closing/reopening browser should restore the user's last view mode choice
- **Field names locked:** do NOT rename, abbreviate, or derive `FlatCard` field names; use exact names from contract
- **No new dependencies:** use Vue 3 built-ins only; no date pickers, UI frameworks, or additional libraries
- **Component modification scope:** only modify `App.vue`, `CardDetail.vue`; do NOT touch `CardGrid.vue` unless necessary; if changes needed there, document with DECISIONS.md entry

---

## Required `// why:` Comments

- `src/composables/useCardViewMode.ts` (or wherever created): comment explaining why localStorage key is `cardViewMode` (not abbreviated or namespaced differently)
- `App.vue` onMounted: comment explaining why viewMode is read from localStorage on mount
- `App.vue` toggle handler: comment explaining the localStorage update and reactive state sync

---

## Files to Produce

- `src/composables/useCardViewMode.ts` — **new** — composable managing viewMode state + localStorage persistence
- `src/components/ViewModeToggle.vue` — **new** — button/switch UI component with toggle logic
- `src/components/CardDataDisplay.vue` — **new** — structured card data table/display component
- `src/App.vue` — **modified** — add global viewMode state, pass to detail/grid, integrate toggle into toolbar
- `src/components/CardDetail.vue` — **modified** — conditional render (image view OR data view based on viewMode)

---

## After Completing

- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer lint` exits 0
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] Browser DevTools → Application → Local Storage shows `cardViewMode` key with value `'image'` or `'data'`
- [ ] Toggling view mode updates `localStorage` value in real-time
- [ ] Selecting a card, toggling view mode, toggling back restores same card selected (no state loss)
- [ ] Toggling view mode does NOT reset search text, filters, or selected card
- [ ] Data view displays printable card information (verified via browser print preview)
- [ ] Both view modes render without TypeScript errors or ESLint violations
- [ ] Code follows `docs/ai/REFERENCE/00.6-code-style.md` conventions (full names, no abbreviations)

---

## Common Failure Smells (Optional)

- **localStorage key is misspelled or varies case** → toggles don't persist across page reload; check exact key name `'cardViewMode'` in composable
- **viewMode state resets when toggling** → indicates state not properly wired to toggle component; check `CardDetail.vue` props binding
- **Toggling view resets selected card** → indicates App.vue is accidentally clearing `selectedCard` ref when viewMode changes; check toggle handler
- **Data view shows null/undefined values** → field names don't match `FlatCard` contract; check exact field names against browser console inspection of actual card objects
- **Both modes don't show same card** → type mismatch or prop not passed correctly; verify `CardDetail.vue` receives `card` prop in both branches (image and data)
