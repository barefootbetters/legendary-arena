# EC-120 — LoadoutBuilder.vue Accessibility Label Association (Execution Checklist)

**Source:** Ad-hoc viewer-scoped session (no WP) — fix the 11 viewer-lint
errors blocking CI on every registry-viewer PR.
**Layer:** Registry Viewer (`apps/registry-viewer/`)

**Execution Authority:**
This EC is the authoritative execution contract for the lint cleanup that
restores the viewer's `Lint viewer` CI step to a green baseline. WP-086
(PR #10) merged via admin-override on 2026-04-29 because of these errors;
WP-114 (next viewer PR) would have hit the same gate. This unblocks both.

EC-120 follows the EC-110 ad-hoc precedent: no `WORK_INDEX.md` row, only
an `EC_INDEX.md` registration in the Registry Viewer §EC-101+ Series.

---

## Slot Selection

EC-120 was chosen because the next-numerically-free slots collide with
known/imminent WP numbers per the EC_INDEX numbering rule:

- **EC-112** would shadow WP-112 (deferred placeholder; Session Token
  Validation Middleware per D-10002).
- **EC-119** is imminent for WP-115 (Public Leaderboard HTTP Endpoints —
  drafted in untracked `docs/ai/work-packets/WP-115-*.md` +
  `docs/ai/execution-checklists/EC-119-*.checklist.md` at session start).

EC-120 is the next slot that does not shadow a known/imminent WP.

---

## Before Starting

- [ ] Current branch is NOT `main`
- [ ] `pnpm --filter registry-viewer lint` reproduces the 11-error baseline
      (9 × `vuejs-accessibility/label-has-for`, 2 × `vuejs-accessibility/form-control-has-label`)
- [ ] Pre-edit screenshot of the Loadout tab captured (or a clean `main`
      checkout in a second terminal) for the visual no-regression smoke

---

## Locked Values (do not re-derive)

- **Rule tuning:** `'vuejs-accessibility/label-has-for': ['error', { required: { some: ['nesting'] } }]`.
  Plugin default is `every: ['nesting', 'id']`; the tuned `some: ['nesting']`
  accepts the modern WAI-recommended implicit-association pattern (clicking
  a `<label>` focuses its wrapped control without a `for=`/`id=` round-trip).
- **`form-control-has-label` rule:** kept at default — still catches controls
  that have neither a wrapping label nor an `aria-label`.
- **Three-fix decomposition (locked at scope-lock):**
  1. **Rule tuning** in `apps/registry-viewer/.eslintrc.cjs` — clears 7 of
     the 9 `label-has-for` errors (lines 325/335/346/452/456/460/464 in
     pre-edit `LoadoutBuilder.vue`; nesting was already correct, only
     the `id` clause was failing).
  2. **`<label>` → `<div>`** for the two button-row fields (pre-edit lines
     367/379 — `schemeId`, `mastermindId`). They wrap a `<button>`, not a
     form control, so `<label>` is semantically wrong AND would still flag
     under `some: ['nesting']` because the button isn't in the rule's
     controlTypes. `.field` / `.field-row` styling carries identically on
     a `<div>`.
  3. **Wrap-input-in-label (pattern b)** for the file input + textarea
     (pre-edit lines 482/483). Adds `<label class="field"><span class="field-label">…</span>…</label>`
     wrappers using the file's existing convention. Visible labels match
     the rest of the form ("Choose JSON file", "Or paste JSON").
- **Visual labels for 482/483:** "Choose JSON file" (file input),
  "Or paste JSON" (textarea). Sourced from the surrounding
  `<summary>📥 Load JSON (paste or file)</summary>` framing.

---

## Guardrails

- Do not add `for=`/`id=` attribute pairs (pattern (a) was rejected at
  scope-lock; the rule-tuning replaces the need for it).
- Do not modify `<script setup>` logic or `useLoadoutDraft.ts`.
- Do not touch any other component or refactor "while you're here."
- No new npm dependencies.
- No new accessibility lint rules added (the `label-has-for` change is
  tuning an already-enabled rule, not adding a new one — consistent with
  existing tuning style in `.eslintrc.cjs` for `vue/multi-word-component-names`,
  `vue/max-attributes-per-line`, and `vue/multiline-html-element-content-newline`).
- Click handlers, focus order, and reactive state stay identical. The
  observable user-facing change is limited to clicking a `<label>` now
  focusing its associated control (via the existing implicit nesting
  association — no behavior change in the `<button>`-row demotions).

---

## Required `// why:` Comments

- `apps/registry-viewer/.eslintrc.cjs` near the new
  `vuejs-accessibility/label-has-for` rule: explain that the tuned
  `some: ['nesting']` accepts the modern WAI implicit-association pattern
  and avoids forcing duplicate `for=`/`id=` round-trips that have no
  a11y benefit when nesting already provides the association.
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` above the
  former `schemeId` / `mastermindId` `<label>` blocks: explain that
  `<label>` was the wrong semantic for a button-row (no form control
  to associate with) and that the `.field` / `.field-row` classes carry
  the styling identically on a `<div>`.

---

## Files to Produce

- `apps/registry-viewer/.eslintrc.cjs` — **modified** — adds tuned
  `vuejs-accessibility/label-has-for` rule with `// why:` comment.
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified**:
  - Two `<label class="field field-row">` button-row blocks demoted to
    `<div class="field field-row">` (former pre-edit lines 367/379).
  - File input + textarea wrapped in `<label class="field">` with
    `<span class="field-label">` text (former pre-edit lines 482/483).
  - One `// why:` block above the demoted button rows.
- `docs/ai/execution-checklists/EC-120-loadout-builder-a11y-label-association.checklist.md` — **new** — this file.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — register EC-120
  in the Registry Viewer §EC-101+ Series after EC-116.

`git diff --name-only` lists exactly four files at session end.

---

## After Completing

- [ ] `pnpm --filter registry-viewer lint` exits 0 errors (warnings
      unchanged at 227 from baseline)
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer build` exits 0; bundle-size delta < 1 KB
- [ ] `pnpm --filter registry-viewer test` exits 0 (8 tests / 2 suites,
      unchanged)
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0
      (31 / 3 / 0, unchanged)
- [ ] PowerShell grep gate confirms zero `<label … for=` matches in
      `LoadoutBuilder.vue` (pattern (a) discipline):
      `Select-String -Path "apps\registry-viewer\src\components\LoadoutBuilder.vue" -Pattern '<label[^>]*\bfor='`
- [ ] Manual smoke (operator step, recorded in commit body): `pnpm
      --filter registry-viewer dev`, navigate to the Loadout tab,
      side-by-side visual comparison against `main`. Confirm:
      (a) all field labels render at the same position with the same
      typography; (b) all inputs interactive; (c) clicking a label now
      focuses its input; (d) the new "Choose JSON file" / "Or paste JSON"
      labels appear inside the expanded `<details>` block in the same
      uppercase `.field-label` style as the rest of the form
- [ ] `git diff --name-only` lists exactly the four files above

---

## Common Failure Smells

- **Lint still reports `label-has-for` errors after tuning** → the rule
  options block is wrong (must be `['error', { required: { some: ['nesting'] } }]`,
  not `'off'` or `'warn'`).
- **Lint reports `form-control-has-label` on the file input or textarea**
  → the wrap pattern is malformed (the `<label>` must be the direct
  ancestor; an intervening `<div>` between `<label>` and the control still
  satisfies the rule via `hasNestedLabelElement` walking the parent chain,
  but accidentally closing the `<label>` early breaks it).
- **Visual regression on the schemeId / mastermindId rows** → the demotion
  to `<div>` did not preserve the `class="field field-row"` attribute.
- **Click on a label no longer focuses its control** → an unintended
  `display: contents` or wrapper insertion broke the implicit association.
