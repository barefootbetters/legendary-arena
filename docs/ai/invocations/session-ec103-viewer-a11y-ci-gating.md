# Session Execution Prompt — EC-103 (Viewer A11y + CI Gating)

> **This is a session execution prompt.** Open a fresh Claude Code
> session in `C:\pcloud\BB\DEV\legendary-arena` and paste this entire
> file as the first user message. Do not execute it in the session
> that generated it.
>
> **Shell requirement:** all commands in this prompt use Bash
> syntax (heredocs, pipes with `grep -cE`, `&&` chains). The
> repo's `.githooks/*` are POSIX shell scripts. Use **Git Bash**
> on Windows (installed by default with Git for Windows). If you
> must use PowerShell, translate pipe-counts with
> `(… | Select-String "PATTERN").Count` and commit messages with
> `git commit -F message.txt` instead of heredocs. Do not mix
> shells mid-session.

---

## Session Identity

**Execution Checklist:** EC-103 — Viewer A11y Cleanup + Typecheck/Lint CI Gating
**Source EC file:** `docs/ai/execution-checklists/EC-103-viewer-a11y-and-ci-gating.checklist.md`
**Layer:** Registry Viewer (`apps/registry-viewer`) + CI wiring
**No backing WP.** This EC is ad-hoc follow-up to EC-102 (commit `830064f`).

**Success Condition (Binary):**
- `pnpm --filter registry-viewer typecheck` exits 0, zero errors
- `pnpm --filter registry-viewer lint` exits 0, zero errors (warnings OK)
- `pnpm --filter registry-viewer build` exits 0
- `.github/workflows/ci.yml` `build-viewer` job contains `Lint viewer`
  and `Typecheck viewer` steps before `Build viewer`
- Manual keyboard smoke test passes (documented in §Verification)
- Any deviation: **STOP and report failure**

---

## Runtime Wiring Allowance — NOT INVOKED

`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` does not apply
to this session. 01.5 governs edits to game-engine lifecycle plumbing
(`LegendaryGameState`, moves, phase hooks). EC-103 touches only:

- Vue SFC markup + behavior (`<div @click>` → `<button>` conversions)
- `localRegistry.ts` type import path + one parameter annotation
- `package.json` devDep addition (`@types/node`)
- `.github/workflows/ci.yml` (two new steps)

None of those are game-engine lifecycle surfaces. **01.5 MAY NOT be
cited during this session.** If mid-execution you discover any need
to edit `packages/game-engine/**`, STOP and escalate — it is out of
scope.

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md` — repo-wide rules
2. `apps/registry-viewer/CLAUDE.md` — viewer-specific architecture
3. `docs/ai/execution-checklists/EC-103-viewer-a11y-and-ci-gating.checklist.md` — **THE EXECUTION CONTRACT**
4. `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` — commit
   prefix rules; hook behavior; `--no-verify` prohibition
5. `docs/ai/execution-checklists/EC-102-viewer-typecheck-cleanup.checklist.md`
   — specifically the §Deferred to EC-103 section that documents
   the vue-tsc bug and the 29 a11y inventory

**Do NOT read:**
- Game-engine WPs, their ECs, or DECISIONS.md — engine is out of scope
- `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` (not invoked)
- `docs/ai/REFERENCE/00.6-code-style.md` — this session is viewer Vue
  SFCs, not TypeScript engine code; the relevant style is "change as
  little as possible, preserve existing patterns"

---

## Pre-Execution Verification (Run Before Editing)

Verify categorical assertions, not exact counts — plugin minor
versions, line-ending quirks, and dependency resolution can shift
totals without changing the underlying debt.

```bash
cd C:/pcloud/BB/DEV/legendary-arena

# 1. Confirm base commit ancestry (EC-103 draft or later on top of main)
git log --oneline -6
# expect: top 2 entries include "EC-103" and "EC-102" references

# 2. Build is green (this is the absolute must-not-regress gate)
pnpm --filter registry-viewer build
# expect: exits 0; dist/ emitted

# 3. Typecheck has exactly the known-categories debt (not a strict count)
pnpm --filter registry-viewer typecheck 2>&1 | tee /tmp/ec103-typecheck.txt
# assertions (verify ALL of these hold; do NOT count):
#   a. errors exist in src/registry/impl/localRegistry.ts
#      referencing `node:fs/promises` and `node:path`
#   b. the vue-tsc module-resolution cascade appears in
#      src/components/CardDetail.vue, CardGrid.vue, and/or
#      HealthPanel.vue with "Cannot find module '../../registry/browser'"
#   c. NO typecheck errors in browser.ts, httpRegistry.ts, or shared.ts
#      (EC-102 consolidated those)
#
# PowerShell equivalent (if Git Bash unavailable):
#   pnpm --filter registry-viewer typecheck 2>&1 |
#     Select-String "localRegistry|Cannot find module '../../registry/browser'"

# 4. Lint has the known a11y debt categories
pnpm --filter registry-viewer lint 2>&1 | tee /tmp/ec103-lint.txt
# assertions (verify ALL hold; do NOT count exact numbers):
#   a. rule `vuejs-accessibility/no-static-element-interactions` appears
#   b. rule `vuejs-accessibility/click-events-have-key-events` appears
#   c. rule `vuejs-accessibility/form-control-has-label` appears
#   d. rule `vuejs-accessibility/no-redundant-roles` appears
#   e. all a11y errors are inside apps/registry-viewer/src/App.vue
#      or apps/registry-viewer/src/components/*.vue — NO other files
#      (if any other file flagged, STOP — plugin config changed)

# 5. Working tree is clean of EC-103-scoped files
git status --short
# expect: only pre-existing untracked items
#   .claude/settings.local.json, session-context-wp029.md,
#   docs/legendary-arena-*.{md,docx}, docs/upper-deck-licensing-contacts.md
# NONE of the files in §Scope Lock may be modified yet.
```

If any assertion fails, **STOP and report** — do not start editing.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any edit to `packages/**` (engine, registry as a package, etc.)
- Any edit to `apps/server/**`
- Any edit to `apps/registry-viewer/src/registry/schema.ts`
- Any edit to `FlatCard`, `CardQuery`, `CardQueryExtended`, or Zod
  schemas
- Any new union member added to `FlatCard.cardType`
- Any `eslint --fix` invocation (hand-apply fixes only)
- Any `eslint-disable-next-line` / `@ts-ignore` comment without a
  matching `// why:` explaining the genuine edge case
- Any `git commit --no-verify` or `--no-gpg-sign` — prohibited
- Any new dependency beyond `@types/node`
- Any visual regression **in the default/unfocused state** (elements
  must render identically pre- and post-edit when not focused).
  Focused-state changes are EXPECTED and REQUIRED: after a semantic
  `<div>` → `<button>` swap, Tab-to-focus must show a visible focus
  indicator (the browser's default outline is sufficient). Do NOT
  suppress focus outlines to hide this change.
- Any new feature, keyboard shortcut, focus-ring restyle, or
  animation
- Any commit prefix other than `EC-103:` (hook will block `INFRA:` /
  `SPEC:` for apps/ files)
- Any scope expansion into lint warning cleanup (only the 29 a11y
  errors are in scope)
- Any modification to `apps/registry-viewer/.eslintrc.cjs` beyond
  what EC-102 already set (do NOT disable more rules to hide a11y
  errors)

---

## Implementation Plan (Ordered)

### Step 1 — Unblock typecheck

**1a. Add `@types/node` as viewer devDep — match the repo runtime baseline.**

The canonical runtime target is set in the root `package.json`
`engines.node`. Read that value first:

```bash
node -e "const p=require('./package.json'); console.log('engines.node =', p.engines?.node)"
# at this moment, repo declares: engines.node = ">=22"
```

Install `@types/node` matching **the repo's `engines.node` baseline**,
NOT CI's `node-version`:

```bash
pnpm --filter registry-viewer add -D @types/node@^22
```

Why not match CI's `node-version: 20`? Because the repo baseline is
v22+ (root `engines.node: ">=22"`; `CLAUDE.md` notes "uses built-in
fetch" which is a Node 18+ feature but semantically relies on the
v22+ target). CI running on Node 20 is a **pre-existing repo
inconsistency** (already pinned before EC-103). Fixing CI's
`node-version` is **OUT OF SCOPE for EC-103** — flag it in your
post-commit summary as debt for a future INFRA commit. Do NOT change
`.github/workflows/ci.yml` `node-version: 20` values in this session.

If `engines.node` changes in the future, `@types/node` should track
it — not CI.

**1b. Re-point `localRegistry.ts` type import.**

Do NOT trust line numbers — the file has drifted. Use search anchors:

- Open `apps/registry-viewer/src/registry/impl/localRegistry.ts`
- Find the import block that reads `from "../types/index.js"` and
  whose `import type {` list contains `CardRegistry, SetIndexEntry,
  SetData, Hero, FlatCard, CardQuery, RegistryInfo, HealthReport`
- Change the `from` clause to `from "../types/types-index.js"`
- No other edits in this block

This matches the EC-102 consolidation pattern already applied to
`browser.ts`, `httpRegistry.ts`, `shared.ts`.

**1c. Annotate the `readdir` callback parameter.**

Search anchor: find `.filter((f) =>` in
`apps/registry-viewer/src/registry/impl/localRegistry.ts`.
Change `(f) =>` to `(f: string) =>`. This eliminates `TS7006`
(`Parameter 'f' implicitly has an 'any' type`).

**1d. Verify typecheck exits 0.**
```bash
pnpm --filter registry-viewer typecheck
# expect: exit 0, zero errors
```

If typecheck still fails, STOP and report. Do NOT proceed to Step 2.

---

### Step 2 — Fix the 29 a11y errors

**Error inventory (from EC-103 §Locked Values):**

Work by rule category, not raw count. Exact totals may drift between
plugin minor versions.

| Rule | Canonical fix |
|---|---|
| `vuejs-accessibility/no-static-element-interactions` | `<div @click>` → `<button type="button" @click>` (preferred) or `role="button" tabindex="0"` (fallback, only when semantic swap is impossible) |
| `vuejs-accessibility/click-events-have-key-events` | If semantic swap used: automatic (native button handles Enter/Space). If ARIA fallback used: add **TWO separate handlers** — `@keydown.enter.prevent="handler"` AND `@keydown.space.prevent="handler"`. Do NOT chain as `@keydown.enter.space` — Vue interprets chained key modifiers as AND, which a single keystroke can never satisfy; the handler will never fire. |
| `vuejs-accessibility/form-control-has-label` | Add `<label for="id">…</label>` paired with matching `id=` on the input, OR wrap the input inside a `<label>…<input>…</label>` block |
| `vuejs-accessibility/no-redundant-roles` | Drop `role="complementary"` from `<aside>` (implicit role already matches) |

**Affected files (8 SFCs):**
- `apps/registry-viewer/src/App.vue`
- `apps/registry-viewer/src/components/CardDetail.vue`
- `apps/registry-viewer/src/components/CardGrid.vue`
- `apps/registry-viewer/src/components/GlossaryPanel.vue`
- `apps/registry-viewer/src/components/HealthPanel.vue`
- `apps/registry-viewer/src/components/ImageLightbox.vue`
- `apps/registry-viewer/src/components/ThemeDetail.vue`
- `apps/registry-viewer/src/components/ThemeGrid.vue`

**Recommended per-file workflow:**

1. Run `pnpm --filter registry-viewer lint 2>&1 | grep -A 0 -B 0 "path/to/file.vue"` to pull just that file's errors.
2. Read the file top to bottom. Note which elements are flagged.
3. For each flagged `<div @click>`:
   - **Default (preferred):** convert to `<button type="button" @click>`.
     `type="button"` is **mandatory** — without it, a `<button>` inside
     any future `<form>` will default to `submit` and trigger page
     reloads or unintended form submissions. Add scoped CSS to
     neutralize native button styling:
     ```css
     .my-div-turned-button {
       /* why: preserve the visual appearance of the original <div>.
          Do NOT touch `outline` — the browser focus ring must remain
          visible when keyboard users Tab to this button (EC-103). */
       appearance: none;
       -webkit-appearance: none;
       border: none;
       background: none;
       padding: 0;
       margin: 0;
       font: inherit;
       color: inherit;
       text-align: left;      /* buttons default to center */
       cursor: pointer;
       /* Preserve block-level layout if the original <div> was block:
          uncomment if needed. Buttons are inline-block by default. */
       /* display: block; */
       /* width: 100%; */     /* only if the parent relied on it */
     }
     ```
     Do NOT add `outline: none` or `outline: 0` anywhere in the reset.
     The default browser focus ring is the minimum viable a11y
     indicator; removing it fails WCAG 2.4.7.
   - **Only if semantic swap breaks layout/CSS:** keep as `<div>`,
     add `role="button"` + `tabindex="0"` + **two separate key
     handlers**:
     ```vue
     <div
       role="button"
       tabindex="0"
       @click="handler"
       @keydown.enter.prevent="handler"
       @keydown.space.prevent="handler"
     >
     ```
     Do NOT chain `.enter.space` on one handler — it means AND and
     never fires.
4. For `<aside role="complementary">`: remove the `role` attribute.
5. For unlabeled `<input>` / `<select>`: add an `id` to the input
   and a `<label for="id">...</label>`, OR wrap the input inside a
   `<label>` element.
6. Add a brief `// why:` or `<!-- why: -->` comment on any ARIA
   fallback citing EC-103 and the layout reason.
7. Re-run lint for that file — confirm the errors for it are gone.
8. Move to next file.

**After all 8 files:**
```bash
pnpm --filter registry-viewer lint
# expect: exit 0, zero errors (warnings OK — 165+ cosmetic remaining)
```

If lint still has `vuejs-accessibility/*` errors, STOP and report
which files/lines remain.

---

### Step 3 — Wire CI gating

Edit `.github/workflows/ci.yml`. Find the `build-viewer` job. Add
these two steps immediately before `- name: Build viewer`:

```yaml
      - name: Lint viewer
        run: pnpm --filter registry-viewer lint

      - name: Typecheck viewer
        run: pnpm --filter registry-viewer typecheck
```

Order matters: Lint runs first (faster fail for a11y regressions).

---

### Step 4 — Full local verification

```bash
# Must all exit 0:
pnpm install --frozen-lockfile
pnpm --filter registry-viewer typecheck
pnpm --filter registry-viewer lint
pnpm --filter registry-viewer build
```

---

### Step 5 — Manual keyboard smoke test (MANDATORY)

```bash
pnpm --filter registry-viewer preview
# Open http://localhost:4173 (or whichever port Vite chose)
```

For every element you converted (every `<div>` → `<button>` swap,
every `role="button"` addition, every new `<label>`):

1. **Unfocused render check**: confirm the element looks **visually
   identical** to the pre-edit version in its default (not focused)
   state — no accidental padding, border, background, font, or layout
   shift. This is the "no visual regression" guarantee.
2. **Tab** to focus it. Confirm the browser's focus indicator is
   visible. This is a REQUIRED focused-state change — not a
   regression.
3. Press **Enter** — confirm activation (click handler fires).
4. Press **Space** — confirm activation (click handler fires).
   If the semantic swap was used (`<button type="button">`), Enter
   and Space both work natively. If the ARIA fallback was used, both
   keys must be wired to separate `@keydown.enter.prevent` and
   `@keydown.space.prevent` handlers — a chained `.enter.space`
   modifier means AND and will not fire.
5. **Form submit check** (if the converted element is inside any
   `<form>` ancestor): press Enter while focused on the button.
   Confirm the form does NOT submit / page does NOT reload — this
   verifies `type="button"` is present.

If any of the above fails, fix before committing. Do not commit
with known regressions.

---

## Scope Lock (Authoritative)

### Allowed Files

| File | Action | Contents |
|---|---|---|
| `apps/registry-viewer/package.json` | MODIFY | Add `@types/node` devDep |
| `pnpm-lock.yaml` (repo root) | MODIFY | Reflect new devDep |
| `apps/registry-viewer/src/registry/impl/localRegistry.ts` | MODIFY | Re-point type import; annotate line 64 |
| `apps/registry-viewer/src/App.vue` | MODIFY | A11y fixes |
| `apps/registry-viewer/src/components/CardDetail.vue` | MODIFY | A11y fixes |
| `apps/registry-viewer/src/components/CardGrid.vue` | MODIFY | A11y fixes |
| `apps/registry-viewer/src/components/GlossaryPanel.vue` | MODIFY | A11y fixes + drop redundant `role` |
| `apps/registry-viewer/src/components/HealthPanel.vue` | MODIFY | A11y fixes |
| `apps/registry-viewer/src/components/ImageLightbox.vue` | MODIFY | A11y fixes |
| `apps/registry-viewer/src/components/ThemeDetail.vue` | MODIFY | A11y fixes |
| `apps/registry-viewer/src/components/ThemeGrid.vue` | MODIFY | A11y fixes |
| `.github/workflows/ci.yml` | MODIFY | Add `Lint viewer` + `Typecheck viewer` steps |
| `docs/ai/execution-checklists/EC_INDEX.md` | MODIFY | Mark EC-103 Done |

### Forbidden

- Any file under `packages/**`
- Any file under `apps/server/**`
- Any file under `apps/registry-viewer/src/registry/` other than
  `impl/localRegistry.ts`
- `apps/registry-viewer/src/registry/schema.ts` — immutable
- `apps/registry-viewer/src/registry/types/*.ts` — immutable
  (EC-102 already consolidated these)
- `apps/registry-viewer/.eslintrc.cjs` — immutable (do NOT disable
  more rules to hide errors)
- `apps/registry-viewer/tsconfig.json` — do NOT add exclusions;
  the vue-tsc bug is the reason `@types/node` is being added instead
- Any other file not explicitly listed above

**Rule:** Anything not explicitly allowed is out of scope.

---

## Verification Gate (Run Before Commit)

```bash
# 1. Typecheck green
pnpm --filter registry-viewer typecheck
# expect: exits 0

# 2. Lint green
pnpm --filter registry-viewer lint
# expect: exits 0 (warnings OK)

# 3. Build green
pnpm --filter registry-viewer build
# expect: exits 0

# 4. No files outside scope modified
git diff --name-only
# expect: only files in §Scope Lock §Allowed

# 5. CI workflow has the two new steps — in the build-viewer job,
#    in the correct order, before Build viewer.
#    Extract the build-viewer job block and eyeball the step
#    ordering manually. A raw grep for the strings would pass
#    even if the steps were misplaced in another job or after
#    `Build viewer`.
awk '/^  build-viewer:/,/^  [a-z]/' .github/workflows/ci.yml | \
  grep -E "^\s+- name:"
# expect the `- name:` sequence to be, IN THIS ORDER:
#   - name: Download registry dist
#   - name: Lint viewer
#   - name: Typecheck viewer
#   - name: Build viewer
#
# If any step is missing, out of order, or after `Build viewer`,
# fix before proceeding.
#
# PowerShell equivalent:
#   (Get-Content .github/workflows/ci.yml -Raw) `
#     -split "(?m)^  (?=[a-z])" |
#     Where-Object { $_ -match "^build-viewer:" } |
#     Select-String -Pattern "^\s+- name:" -AllMatches

# 6. No --no-verify or --no-gpg-sign anywhere
grep -r "no-verify\|no-gpg-sign" .github/ apps/ packages/ 2>/dev/null
# expect: no matches
# PowerShell: Get-ChildItem -Recurse .github,apps,packages |
#   Select-String "no-verify|no-gpg-sign"
```

---

## Definition of Done

Every item must be true before committing.

- [ ] Typecheck exits 0
- [ ] Lint exits 0
- [ ] Build exits 0
- [ ] All 29 `vuejs-accessibility/*` errors resolved
- [ ] `@types/node` added to viewer devDependencies
- [ ] `localRegistry.ts` types repointed to `types-index.js`
- [ ] `localRegistry.ts:64` parameter typed
- [ ] CI workflow has `Lint viewer` + `Typecheck viewer` steps
- [ ] Manual keyboard smoke test completed, results noted below
- [ ] No visual regression (spot-check against pre-edit screenshots
      or a fresh `vite preview` before editing)
- [ ] No file outside §Scope Lock modified
- [ ] `EC_INDEX.md` has EC-103 marked Done
- [ ] All `// why:` comments present on any ARIA fallback or
      unusual choice

---

## Commit

Stage ONLY files in §Scope Lock. Do NOT stage:
- `.claude/settings.local.json` (pre-existing)
- `docs/ai/session-context/session-context-wp029.md` (unrelated)
- `docs/legendary-arena-*.{md,docx}` (marketing, unrelated)
- `docs/upper-deck-licensing-contacts.md` (unrelated)

```bash
git add \
  apps/registry-viewer/package.json \
  pnpm-lock.yaml \
  apps/registry-viewer/src/registry/impl/localRegistry.ts \
  apps/registry-viewer/src/App.vue \
  apps/registry-viewer/src/components/CardDetail.vue \
  apps/registry-viewer/src/components/CardGrid.vue \
  apps/registry-viewer/src/components/GlossaryPanel.vue \
  apps/registry-viewer/src/components/HealthPanel.vue \
  apps/registry-viewer/src/components/ImageLightbox.vue \
  apps/registry-viewer/src/components/ThemeDetail.vue \
  apps/registry-viewer/src/components/ThemeGrid.vue \
  .github/workflows/ci.yml \
  docs/ai/execution-checklists/EC_INDEX.md

git status --short
# Review before committing
```

Commit message (use a heredoc for safe multiline):

```
EC-103: fix viewer a11y errors + enable typecheck/lint CI gating

- Add @types/node to viewer devDependencies (unblocks localRegistry.ts
  typecheck; reverses EC-102 guardrail — rationale documented in
  EC-102 §Deferred to EC-103 Blocker 1).
- Re-point localRegistry.ts type import to ../types/types-index.js;
  annotate readdir callback parameter `(f: string)`.
- Fix 29 vuejs-accessibility errors across 8 SFCs:
  - <X> <div @click> → <button @click> conversions (no-static-element-
    interactions + click-events-have-key-events: Y + Z resolved)
  - <N> form-control-has-label fixes (added <label>)
  - 1 no-redundant-roles fix (removed role="complementary" from <aside>)
- Wire `Lint viewer` + `Typecheck viewer` CI steps into build-viewer
  job, running before `Build viewer`.
- Manual keyboard smoke test: Tab/Enter/Space confirmed on all
  converted elements; no visual regression.

Closes EC-103 (registered in EC_INDEX under the EC-101+ viewer
series).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Replace `<X>`, `<Y>`, `<Z>`, `<N>` with actual counts from your fixes.

**Hook must pass without `--no-verify`.** If the `commit-msg` hook
rejects, read the error carefully; fix the root cause (prefix,
subject length, forbidden word) and retry. Do NOT bypass.

---

## After Commit

```bash
git log --oneline -3
# Confirm EC-103 lands on top

git push origin main
# Publish
```

Update `EC_INDEX.md` EC-103 row from `Draft` to `Done` if you
haven't already (stage, commit as part of the main EC-103 commit).

---

## Escalation

**STOP and report to the user** if any of the following happen:

- Typecheck or lint fail after completing a step's fix
- Manual keyboard smoke test reveals regression you can't fix in 10 min
- An a11y rule error appears in a file that isn't in the §Affected
  files list (means plugin config changed or new error type)
- A `<div>` → `<button>` swap causes visual regression that can't be
  fixed with simple scoped-CSS reset
- Hook blocks commit and the fix is unclear
- You discover you need to edit a forbidden file to satisfy an a11y
  rule
- `pnpm add @types/node` pulls in unexpected peer-dep upgrades
- Total edit count exceeds 50 lines per SFC (means scope creep)

Do NOT silently work around any of the above.

---

**End of session execution prompt.**
