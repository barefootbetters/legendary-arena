# EC-103 — Viewer A11y Cleanup + Typecheck/Lint CI Gating (Execution Checklist)

**Source:** Ad-hoc — direct follow-up to EC-102. No backing WP.
**Layer:** Registry Viewer (a11y fixes in Vue SFCs) + Cross-cutting (CI)

**Execution Authority:**
This EC picks up the two blockers EC-102 deferred: the vue-tsc /
localRegistry typecheck issue, and 29 real a11y errors surfaced by
`eslint-plugin-vuejs-accessibility`. Once both are clean, wire the
two CI gating steps EC-101 scaffolded but never activated.

**Execution style:** this is real component code work across ≥8 Vue
SFCs — NOT mechanical. Treat execution with pre-flight rigor similar
to engine ECs: read the full guardrails, plan a11y fixes per file
before editing, and verify build + typecheck + lint all exit 0 before
commit.

---

## Before Starting

- [ ] EC-102 landed (commit 830064f — type consolidation, cosmetic
      rules silenced)
- [ ] `pnpm --filter registry-viewer build` exits 0 (should be green)
- [ ] `pnpm --filter registry-viewer typecheck` shows **8** errors
      (5 `localRegistry.ts`, 3 vue-tsc resolution cascade)
- [ ] `pnpm --filter registry-viewer lint` shows **29 errors** in
      4 categories across 8 SFCs (full inventory in §Locked Values)

---

## Locked Values (do not re-derive)

### Blocker 1 resolution — typecheck

- Preferred fix: add `@types/node` to `apps/registry-viewer/devDependencies`
  and remove any tsconfig exclude for `localRegistry.ts`. EC-102's
  guardrail against this is reversed here because exclusion caused a
  vue-tsc module resolution regression (sibling Vue components lost
  ability to resolve `../../registry/browser`) that could not be
  isolated within the EC-102 budget.
- Fallback (if the team rejects `@types/node` in the viewer): move
  `src/registry/impl/localRegistry.ts` to a `tools/` sibling folder
  with its own `tsconfig.json`. Update the dev/CI scripts that call
  it (if any). Broader change; discuss before picking.
- Remaining `localRegistry.ts` issues after `@types/node` lands:
  - Line 7 / 8: `node:fs/promises`, `node:path` → resolve automatically.
  - Line 64: `Parameter 'f' implicitly has an 'any' type` → annotate
    the `readdir` callback parameter: `(f: string) => …`.
  - Lines 98, 118: FlatCard type mismatch (narrow vs wide) → re-point
    `localRegistry.ts:11-20` to import from `../types/types-index.js`
    instead of `../types/index.js`, matching the EC-102 consolidation.

### Blocker 2 resolution — a11y (29 errors)

| Rule | Count | Pattern |
|---|---|---|
| `vuejs-accessibility/no-static-element-interactions` | 13 | `<div @click>` → either change element to `<button>` OR add `role="button"` + `tabindex="0"` |
| `vuejs-accessibility/click-events-have-key-events` | 10 | Same elements above also need `@keydown.enter.space.prevent="handler"` |
| `vuejs-accessibility/form-control-has-label` | 3 | `<input>` / `<select>` missing `<label for="id">` or enclosing `<label>`; fix by wrapping or associating |
| `vuejs-accessibility/no-redundant-roles` | 1 | `<aside role="complementary">` — drop the redundant `role=` (aside has implicit role) |

**Affected files (8 SFCs):**
- `src/App.vue`
- `src/components/CardDetail.vue`
- `src/components/CardGrid.vue` *(NOTE: card tiles are already `<button>` elements — this file likely has different div+click cases inside the detail panels, not on the tiles themselves)*
- `src/components/GlossaryPanel.vue`
- `src/components/HealthPanel.vue`
- `src/components/ImageLightbox.vue`
- `src/components/ThemeDetail.vue`
- `src/components/ThemeGrid.vue`

**Fix preference order:**
1. **Semantic swap** (preferred): `<div @click>` → `<button @click>`. Native button handles keyboard focus + Enter/Space automatically; eliminates both `no-static-element-interactions` AND `click-events-have-key-events` for that element.
2. **ARIA + keyboard** (only when semantic swap breaks layout / CSS): add `role="button" tabindex="0" @keydown.enter.space.prevent="handler"`.
3. **Don't suppress** — no `eslint-disable-next-line` comments unless a genuinely untreatable edge case and a `// why:` explaining it.

### CI gating to add after both blockers clean

In `.github/workflows/ci.yml` `build-viewer` job, immediately before
`Build viewer` step:

```yaml
- name: Lint viewer
  run: pnpm --filter registry-viewer lint

- name: Typecheck viewer
  run: pnpm --filter registry-viewer typecheck
```

Lint runs before typecheck because a11y violations are faster-fail
than type errors.

---

## Guardrails

- No semantic UX changes — a `<div>` that becomes a `<button>` must
  render visually identically (use `border: none; background: none;
  padding: 0; font: inherit; cursor: pointer;` in scoped styles if
  needed). Users must not notice the swap.
- No new features, no keyboard shortcuts beyond Enter/Space on
  clickable elements, no focus rings beyond browser defaults.
- Do NOT modify `apps/registry-viewer/src/registry/**` beyond the
  localRegistry.ts type-import repoint (EC-102 already consolidated
  the rest).
- Do NOT edit Zod schemas, FlatCard union, or any registry types.
- Do NOT run `eslint --fix` — it will touch 165+ non-a11y warnings
  and expand the diff unpredictably.
- Commit prefix: `EC-103:` (apps/ files staged; hook requires EC
  prefix per 01.3).

---

## Required `// why:` Comments

- `package.json` devDep addition: cite EC-102 §Deferred to EC-103
  Blocker 1 as the reason `@types/node` is being added.
- Each `<div>` → `<button>` swap: short `<!-- why: was <div @click>; converted to <button> for native keyboard + SR support (EC-103) -->` above the element, unless the file already has many and one file-level comment suffices.
- Any `role="button"` + `tabindex="0"` application: `// why: visual-layout
  constraint prevents native button; ARIA + keyboard parity added (EC-103)`.

---

## Files to Produce

- `apps/registry-viewer/package.json` — **modified** — add
  `@types/node` devDep (Blocker 1)
- `apps/registry-viewer/pnpm-lock.yaml` (at monorepo root: `pnpm-lock.yaml`)
  — **modified** — reflect devDep add
- `apps/registry-viewer/src/registry/impl/localRegistry.ts` —
  **modified** — re-point type import to `../types/types-index.js`
  (EC-102 consolidation follow-through) + annotate line 64 `f: string`
- `apps/registry-viewer/src/App.vue` — **modified** — a11y fixes
- `apps/registry-viewer/src/components/CardDetail.vue` — **modified** —
  a11y fixes
- `apps/registry-viewer/src/components/CardGrid.vue` — **modified** —
  a11y fixes (if any — card tiles already correct)
- `apps/registry-viewer/src/components/GlossaryPanel.vue` —
  **modified** — a11y fixes + drop redundant `role="complementary"` on `<aside>`
- `apps/registry-viewer/src/components/HealthPanel.vue` —
  **modified** — a11y fixes
- `apps/registry-viewer/src/components/ImageLightbox.vue` —
  **modified** — a11y fixes
- `apps/registry-viewer/src/components/ThemeDetail.vue` —
  **modified** — a11y fixes
- `apps/registry-viewer/src/components/ThemeGrid.vue` —
  **modified** — a11y fixes
- `.github/workflows/ci.yml` — **modified** — add `Lint viewer` +
  `Typecheck viewer` steps in `build-viewer` job
- `docs/ai/execution-checklists/EC-103-viewer-a11y-and-ci-gating.checklist.md`
  — **new** — this file
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — register
  EC-103 under "Registry Viewer (EC-101+ Series)"

---

## Verification Steps (run in this order; all must exit 0)

```bash
# 1. Dependencies
pnpm install --frozen-lockfile

# 2. Typecheck — must exit 0 with zero errors
pnpm --filter registry-viewer typecheck

# 3. Lint — must exit 0 with zero errors (warnings OK)
pnpm --filter registry-viewer lint

# 4. Build — must exit 0, produce dist/assets/*.js + *.css
pnpm --filter registry-viewer build

# 5. Smoke test — click+Enter/Space on every converted element
pnpm --filter registry-viewer preview
# Manually verify: Tab through all clickable elements; Enter and
# Space activate them; focus ring visible; no visual regression vs.
# prior deploy.
```

---

## After Completing

- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer lint` exits 0
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] CI workflow `build-viewer` job contains `Lint viewer` and
      `Typecheck viewer` steps before `Build viewer`
- [ ] Manual keyboard smoke test passed (Tab / Enter / Space on every
      converted clickable)
- [ ] No visual regression vs. pre-EC-103 build (compare screenshots)
- [ ] EC_INDEX.md has EC-103 marked Done
- [ ] Commit prefix `EC-103:`, hook passes without `--no-verify`

---

## Common Failure Smells

- Converting `<div>` to `<button>` without neutralizing native button
  CSS → visual regression (unwanted border, background, font).
- Adding `role="button"` without `tabindex="0"` → focus skip; keyboard
  users can't reach the element.
- Adding `tabindex="0"` without `@keydown.enter.space.prevent` → users
  can focus but can't activate.
- Attaching keyboard handlers to the wrong element (parent vs inner
  `<button>`) → double-firing or missed events.
- Running `eslint --fix` → reformats 165 non-a11y warnings; diff
  balloons past the EC-103 allowlist.
- Adding `@types/node` but keeping a tsconfig exclude for
  `localRegistry.ts` → one or the other; not both. The EC-102
  vue-tsc bug's workaround is to NOT exclude files.
- Skipping the manual smoke test → a11y regressions often slip past
  automated lint rules.
- Commit prefix `INFRA:` or `SPEC:` with `apps/` files staged → hook
  blocks. Use `EC-103:`.

---

## Out of Scope (do NOT expand)

- The 165+ remaining lint warnings (non-a11y, non-cosmetic — mostly
  `vue/attributes-order`, `vue/require-default-prop`). Warnings
  don't fail CI; leave for a future `EC-104: viewer lint warning
  cleanup` if anyone cares.
- Performance concerns (lazy-loading sets, bundle size) — separate
  `EC-104+` track.
- Security headers / `_headers` / `_redirects` — separate track
  (the original SPA audit's P0.1 / P1.2 items).
- Any change to `FlatCard`, `CardQuery`, or Zod schemas.
- Any change to engine packages (`packages/game-engine`, etc.).
