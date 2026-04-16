# Session Execution Prompt — EC-103 (Viewer A11y + CI Gating)

> **This is a session execution prompt.** Open a fresh Claude Code
> session in `C:\pcloud\BB\DEV\legendary-arena` and paste this entire
> file as the first user message. Do not execute it in the session
> that generated it.

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

```bash
cd C:/pcloud/BB/DEV/legendary-arena

# 1. Confirm baseline at commit 05f27da (EC-103 draft) or later
git log --oneline -1

# 2. Confirm EC-102 baseline errors
pnpm --filter registry-viewer build           # expect: exits 0
pnpm --filter registry-viewer typecheck 2>&1 | grep -cE "error TS"
# expect: 8 (5 localRegistry + 3 vue-tsc cascade)

pnpm --filter registry-viewer lint 2>&1 | grep -cE "vuejs-accessibility"
# expect: 29

# 3. Confirm no other working-tree changes
git status --short
# expect: only pre-existing untracked files (.claude/settings.local.json,
# marketing docs, session-context-wp029.md) — NOT EC-103-related
```

If any of these don't match, **STOP and report**.

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
- Any visual regression (elements must render identically before/after)
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

**1a. Add `@types/node` as viewer devDep.**
```bash
pnpm --filter registry-viewer add -D @types/node@^20
```
(Match the Node version in `package.json` `engines.node` if specified;
otherwise `^20` aligns with CI's `node-version: 20`.)

**1b. Re-point `localRegistry.ts` type import.**
Edit `apps/registry-viewer/src/registry/impl/localRegistry.ts` lines
11–20: change `from "../types/index.js"` to
`from "../types/types-index.js"`. This follows the EC-102
consolidation pattern already applied to browser.ts/httpRegistry.ts/
shared.ts.

**1c. Annotate the `readdir` callback parameter.**
Line 64 of `localRegistry.ts`: change `.filter((f) => ...)` to
`.filter((f: string) => ...)`. This eliminates TS7006.

**1d. Verify typecheck exits 0.**
```bash
pnpm --filter registry-viewer typecheck
# expect: exit 0, zero errors
```

If typecheck still fails, STOP and report. Do NOT proceed to Step 2.

---

### Step 2 — Fix the 29 a11y errors

**Error inventory (from EC-103 §Locked Values):**

| Rule | Count | Canonical fix |
|---|---|---|
| `vuejs-accessibility/no-static-element-interactions` | 13 | `<div @click>` → `<button @click>` (preferred) or `role="button" tabindex="0"` (fallback) |
| `vuejs-accessibility/click-events-have-key-events` | 10 | Same elements as above also need `@keydown.enter.space.prevent="handler"` when using the ARIA fallback; NOT needed if semantic swap used |
| `vuejs-accessibility/form-control-has-label` | 3 | Add `<label for="id">` or wrap input in `<label>` |
| `vuejs-accessibility/no-redundant-roles` | 1 | Drop `role="complementary"` from `<aside>` (implicit role) |

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
   - **Default:** convert to `<button @click>`. Add scoped CSS to
     neutralize native button styling if needed:
     ```css
     .my-div-turned-button {
       border: none;
       background: none;
       padding: 0;
       font: inherit;
       color: inherit;
       text-align: left; /* buttons default to center */
       cursor: pointer;
     }
     ```
   - **Only if semantic swap breaks layout/CSS:** keep as `<div>`,
     add `role="button"` + `tabindex="0"` +
     `@keydown.enter.space.prevent="sameHandler"`.
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

1. **Tab** to focus it. Confirm focus ring visible.
2. Press **Enter** — confirm activation (click handler fires).
3. Press **Space** — confirm activation (click handler fires).
4. Confirm the element renders identically to the pre-edit version
   (no accidental padding, border, background, or font change).

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

# 5. CI workflow has the two new steps
grep -A 1 "Lint viewer\|Typecheck viewer" .github/workflows/ci.yml
# expect: both step names appear once each

# 6. No --no-verify or --no-gpg-sign anywhere
grep -r "no-verify\|no-gpg-sign" .github/ apps/ packages/ 2>/dev/null
# expect: no matches
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
