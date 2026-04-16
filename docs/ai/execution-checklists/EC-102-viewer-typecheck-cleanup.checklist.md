# EC-102 — Viewer Type Consolidation + Cosmetic Lint Silencing (Execution Checklist)

**Source:** Ad-hoc — direct follow-up to EC-101, no backing WP.
**Layer:** Registry Viewer (type-model consolidation + lint config)

**Execution Authority:**
This EC is the authoritative execution contract for a **scope-narrowed**
follow-up to EC-101. Original intent (full typecheck + lint CI gating)
was deferred mid-execution when two out-of-scope blockers surfaced —
documented below under "Deferred to EC-103." Compliance here is against
the narrowed scope only.

---

## Before Starting

- [ ] EC-101 landed (viewer `typecheck` and `lint` scripts exist,
      `.eslintrc.cjs` present, `on.push:` merged in CI)
- [ ] `apps/registry-viewer/src/registry/types/index.ts` (narrow,
      stale) exists alongside `types/types-index.ts` (live, wide) —
      dual-FlatCard split causes silent type-reality drift
- [ ] `pnpm --filter registry-viewer build` exits 0

---

## Locked Values (do not re-derive)

- Two ESLint rules disabled in `.eslintrc.cjs` rules block:
  ```
  'vue/max-attributes-per-line': 'off',
  'vue/multiline-html-element-content-newline': 'off',
  ```
- Canonical type-source file (post-EC-102): `src/registry/types/types-index.ts`
  (wide FlatCard — 9 cardType values, `rarity: number`).
- Files re-pointed at the canonical type source:
  - `src/registry/browser.ts`
  - `src/registry/impl/httpRegistry.ts`
  - `src/registry/shared.ts`
- `shared.ts` field mappings made null-safe:
  - `name: card.name ?? ""`
  - `slot: card.slot ?? undefined`
  - `rarity: card.rarity ?? undefined`
  - `attack: card.attack == null ? null : String(card.attack)`
  - `recruit: card.recruit == null ? null : String(card.recruit)`
- `localRegistry.ts:34` — `let setIndex` → `const setIndex`.

---

## Guardrails

- Do NOT modify `FlatCard.cardType` union or add union members.
- Do NOT modify Zod schemas.
- Do NOT add `@types/node` to viewer devDeps.
- Do NOT add CI gating steps in `build-viewer` job (deferred to EC-103
  — see below).
- Do NOT edit Vue SFCs (a11y fixes are EC-103 scope).
- No scope expansion beyond the files listed below.

---

## Required `// why:` Comments

- `browser.ts` and `httpRegistry.ts` and `shared.ts` — explain that
  `types-index.ts` is the live/wide type source chosen for
  consolidation; `types/index.ts` is a stale parallel file.
- `shared.ts` attack/recruit stringify — cite D-1204 (star-modifier
  costs stay as strings).
- `.eslintrc.cjs` — explain cosmetic rules were silenced because
  they contributed ~270/307 of EC-101-baseline warnings and have no
  semantic impact.

---

## Files to Produce

- `apps/registry-viewer/.eslintrc.cjs` — **modified** — disable 2
  cosmetic rules
- `apps/registry-viewer/src/registry/browser.ts` — **modified** —
  re-export from `./types/types-index.js`
- `apps/registry-viewer/src/registry/impl/httpRegistry.ts` —
  **modified** — type imports from `../types/types-index.js`
- `apps/registry-viewer/src/registry/shared.ts` — **modified** —
  type imports from `./types/types-index.js`, null-safe field
  mappings, stringify attack/recruit, remove unused `CardQuery`
  import
- `apps/registry-viewer/src/registry/impl/localRegistry.ts` —
  **modified** — `prefer-const` fix at line 34
- `docs/ai/execution-checklists/EC-102-viewer-typecheck-cleanup.checklist.md`
  — **new** — this file
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** —
  register EC-102 under "Registry Viewer (EC-101+ Series)"

---

## After Completing (narrowed scope)

- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer typecheck` runs (does NOT need
      to exit 0 — 8 remaining errors are deferred to EC-103)
- [ ] `pnpm --filter registry-viewer lint` runs (does NOT need to
      exit 0 — 29 remaining errors are real a11y debt deferred to
      EC-103)
- [ ] Viewer's production type graph consistently uses the wide
      FlatCard from `types-index.ts` (browser.ts, httpRegistry.ts,
      shared.ts all aligned)
- [ ] Cosmetic lint warning count dropped ≥ 100 (silencing the two
      rules)
- [ ] `EC_INDEX.md` has EC-102 registered

---

## Deferred to EC-103

Two blockers stopped EC-102 from landing full CI gating. Both are
documented here so EC-103 can pick them up cleanly:

**Blocker 1 — vue-tsc module resolution bug.**
Adding ANY file to tsconfig `exclude` breaks `"../../registry/browser"`
resolution from `src/components/*.vue` (but NOT from `App.vue`).
Tested with exclude on localRegistry.ts alone, exclude on both
localRegistry.ts + registry/index.ts, explicit `include` allowlist,
deleting the stale `types/index.ts`, and `.js` extension on imports —
all reproduce the failure. Without excluding localRegistry.ts, its
`node:fs/promises` / `node:path` imports produce 5 typecheck errors.

Resolution options for EC-103:
- Add `@types/node` to viewer devDeps (smallest change; reverses an
  EC-102 guardrail).
- Move `localRegistry.ts` out of `src/` into a sibling folder with its
  own tsconfig (e.g., `tools/`).
- Dig into vue-tsc / @volar version and file upstream bug.

**Blocker 2 — real a11y debt surfaced by `eslint-plugin-vuejs-accessibility`.**
The plugin wired in EC-101 is working correctly: it found 29 genuine
a11y issues across Vue SFCs:
- `click-events-have-key-events` on `<div @click>` elements
- `no-static-element-interactions` on non-button clickable elements
- `form-control-has-label` on unlabeled inputs
- `no-redundant-roles` on `<aside role="complementary">`

These are legitimate bugs, not false positives. Fixing them is real
a11y code work (convert clickable divs to buttons, add labels, etc.)
across ≥5 SFCs. Not an INFRA commit.

**EC-103 scope (once opened):**
- Pick a Blocker 1 resolution and enable typecheck CI gating.
- Fix the 29 a11y errors and enable lint CI gating.
- Both land together with the two CI steps added to `build-viewer`.

---

## Common Failure Smells

- Fixing typecheck errors by widening `FlatCard.cardType` → out of
  scope. Path 2 of EC-102 chose to retire `types/index.ts` (narrow)
  in favor of `types-index.ts` (wide, already runtime-accurate).
- Adding `@types/node` → EC-102 guardrail; revisit in EC-103.
- Running `eslint --fix` → would touch 165 warnings across many
  files; not mechanical.
- Commit attempting `INFRA:` with `apps/` files staged → hook
  blocks. Use `EC-102:` prefix.
