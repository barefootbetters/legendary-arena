# EC-309 — Registry Viewer Search Header Redesign (Execution Checklist)

**Source:** docs/ai/work-packets/WP-278-search-header-redesign.md
**Layer:** Registry Viewer (`apps/registry-viewer`)

## Before Starting (Hard Gate)
- [ ] WP-270/276/277 landed: `test -f apps/registry-viewer/src/components/MechanicFilter.vue` → OK (the component this generalizes)
- [ ] Worktree built once (`pnpm -r build`) so the viewer typechecks against the registry dist
- [ ] Baseline green: `pnpm --filter registry-viewer typecheck` 0; `test` 0 (note the count to preserve)

## Locked Values (do not re-derive)
- Controls: **Set (single) · Class (single) · Type (multi) · Mechanics (multi) · Effects (multi)** + contextual **Patterns (multi)**
- Set/Class stay single-select → `applyQuery` `setAbbr`/`heroClass` single-value semantics UNCHANGED
- Mechanics lists ALL mechanics (preserve WP-276 / D-24052); Effects lists the ability taxonomy (preserve WP-125 OR-within)
- Type preserves group→leaf expansion (a group toggles all its `types[]`, incl. SHIELD's 3 sub-types)
- Patterns is contextual: shown only when exactly one leaf type ∈ {hero,villain,henchman,mastermind,scheme} is active; lists that type's patterns or (scheme) twists
- Filter composition: OR-within each control, AND across controls — UNCHANGED
- Popover: `position: fixed`, anchored at open; carries the WP-277 scroll-origin guard (ignore scrolls whose target is inside the popover root); closes on outside-click / Escape / outside scroll / resize

## FilterDropdown.vue contract
- Props: `label`, `items: { value; label; count?; emoji?; title? }[]`, `mode?: 'single'|'multi'` (default multi), `searchable?` (default true), `emptyLabel?`
- v-model `selected: Set<string>` (≤1 in single mode; single-pick closes the popover)
- Renders nothing when `items.length === 0` (degraded/empty hide)
- Preserves caller `items` order (caller sorts: label for Type/Mechanics, `order` for Effects/Patterns/Twists)

## Guardrails
- Delete `AbilityEffectFilter.vue`, `SchemeTwistFilter.vue`, `PatternFilter.vue`, `MechanicFilter.vue`; remove all their imports/usages from `App.vue`
- `selectedTypes` becomes a **computed** over the new `selectedTypeGroupKeys` ref (union each selected group's `types[]`); move every old `selectedTypes` mutation to mutate `selectedTypeGroupKeys`
- Unify `selectedTwistSlugs` + `selectedMechanicalPatternSlugs` → one `selectedPatternSlugs`; route it by active type in `applyFilters`
- Remove the `.set-pills` block + its CSS
- Do NOT touch `cardMechanicsClient.ts` / `cardMatchesMechanics` / the feed / `applyQuery` logic
- No forbidden import (`game-engine`/`server`/`dashboard`/`scripts/`); no `parseAbilityText`
- `for...of` not `.reduce()` for branching loops; full-word names

## Required `// why:` Comments
- On the `position: fixed` popover (escapes the drawer's `overflow: hidden`)
- On the scroll-origin guard (capture-phase window scroll also catches the list's own scroll — WP-277)
- On `selectedTypes` being a computed over group keys (preserves the group→leaf expansion)

## Files to Produce
- `FilterDropdown.vue` (new); `App.vue` (rewire); delete the 4 old components
- `DECISIONS.md` (D-24053) + `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` (governance close)

## After Completing
- [ ] 4 old components gone + de-referenced; `FilterDropdown` used ≥6× in App.vue; `set-pills` removed
- [ ] No forbidden import; no `parseAbilityText`; scroll-origin guard present in FilterDropdown
- [ ] `typecheck` 0; `test` 0 (count preserved); `build` 0
- [ ] LIVE: every filter narrows the grid + composes; Patterns appears contextually; popovers scroll without closing + close on outside/Escape
- [ ] D-24053 lands; WORK_INDEX/EC_INDEX/STATUS flipped
- [ ] Commit prefix `EC-309:` (code) + `SPEC:` (governance)

## Common Failure Smells
- Type dropdown loses SHIELD grouping → list groups (not leaf types); expand group→leaf in the `selectedTypes` computed
- Patterns dropdown shows under multiple types → keep the single-leaf-type gate (`selectedTypes.size === 1`)
- Popover clipped → `position: fixed` (not absolute); list won't scroll → carry the WP-277 scroll-origin guard
- Single-select Set/Class lets you pick 2 → in single mode, selecting replaces the set
- Effects/patterns lose stable order → caller pre-sorts by `order`; FilterDropdown preserves item order
- A deleted component still imported → grep App.vue; remove the import + the `<Component>` usage
