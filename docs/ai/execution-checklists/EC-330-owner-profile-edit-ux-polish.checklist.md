# EC-330 — Owner Profile Edit-Page UX Polish (Execution Checklist)

**Source:** docs/ai/work-packets/WP-299-owner-profile-edit-ux-polish.md
**Layer:** Arena Client (`apps/arena-client`) · **Lightweight Lane** (D-24028)

## Before Starting (Hard Gate)
- [ ] Page present + separate-compile pattern: `grep -c "return {" apps/arena-client/src/pages/MyProfilePage.vue` ≥ 1 — every new binding must be added to that `setup()` return object (NOT `<script setup>`)
- [ ] WP-298 upload block present (do NOT disturb): `grep -c "my-profile-avatar-file" apps/arena-client/src/pages/MyProfilePage.vue` ≥ 1
- [ ] Server limits confirmed as the hint-copy source: `apps/server/src/profile/avatarUpload.logic.ts` → `ALLOWED_MIME_TYPES` = jpeg/png/webp (NO gif); `MAX_FILE_SIZE_BYTES` = 5 MB
- [ ] Baseline snapshot: `pnpm --filter @legendary-arena/arena-client typecheck` → **0**; `test` → **624 / 0**; `build` → 0. At close: identical (test count **unchanged at 624** — the additions are browser-event UI with no unit-testable business-logic branch)
- [ ] Scaffold (lane requirement): prototype the changes, run the arena-client suite, record the observed result BEFORE confirming eligibility

## Locked Values (do not re-derive)
- Accepted upload formats (server `ALLOWED_MIME_TYPES`): **JPEG, PNG, WebP** — **GIF is NOT accepted**. Every format claim in the file (the new hint AND the existing `invalid_mime_type` error copy) must list only PNG/JPEG/WebP.
- Max upload size (server `MAX_FILE_SIZE_BYTES`): **5 MB** (`5 * 1024 * 1024`).
- Hint copy (verbatim): `PNG, JPEG, or WebP · up to 5 MB. A square image around 512×512 pixels looks best.`
- About-me cap: **500** characters (the existing textarea `maxlength`); counter = `Math.max(0, 500 - formAboutMe.length)`, display-only, never negative.
- Preview `<img>` alt text (verbatim): `Current profile avatar preview`. Counter `<span>` carries `aria-live="polite"`.
- Mobile breakpoint: `@media (max-width: 40rem)` collapses `.profile-link-row` to one column.
- New test ids (additive only): `my-profile-avatar-preview`, `my-profile-about-me-count`. No existing `data-testid` renamed or removed.

## Guardrails
- **Presentation-only.** Do NOT touch `ownerProfileApi.ts`, the `fetchOwnerProfile` / `updateOwnerProfile` / `replaceOwnerLinks` / `uploadOwnerAvatar` calls, the request/response shapes, the auth store, `App.vue`, the link model, or the save flow. This packet adds no network behavior.
- **Every new template binding is declared in `setup()` AND returned** in the `return {...}` object (`computed` + `watch` imports added). A binding referenced in the template but absent from the return renders `undefined` — the separate-compile silent failure this file's header `// why:` warns about.
- The avatar preview hides on `@error`; a `watch(formAvatarUrl, …)` **MUST reset** `avatarPreviewFailed` to false on every URL change so a prior bad URL never permanently suppresses the preview (once `@error` removes the `<img>`, `@load` can never re-fire). It **MUST NOT** clear or rewrite `formAvatarUrl` — the URL is the user's value, not the preview's to mutate.
- No cross-layer import (`apps/server` / `packages/registry` / `packages/game-engine` runtime) and no `boardgame.io` in `MyProfilePage.vue`.
- The counter is display-only — `Math.max(0, …)` so it never shows a negative; it does not enforce the cap (the `maxlength` does) and does not gate save.
- Accessibility: the preview `<img>` carries non-empty `alt` (the Locked Value); the counter `<span>` carries `aria-live="polite"`.
- All new CSS stays in the component's `scoped <style>` block — no global stylesheet, no design-system token file, no new component.
- Full-word names (`avatarPreviewFailed`, `aboutMeCharactersRemaining`); `is/has`-style boolean flag; JSDoc/`// why:` where required below.

## Required `// why:` Comments
- On `avatarPreviewFailed` (a bad/unreachable URL should hide the preview rather than show the broken-image glyph; never mutates the user's `formAvatarUrl`).
- On the `watch(formAvatarUrl, …)` reset (once `@error` removes the `<img>`, `@load` cannot re-fire — the watch re-arms the preview so a prior bad URL doesn't permanently suppress it).
- On the corrected `invalid_mime_type` copy (the server's `ALLOWED_MIME_TYPES` accepts only JPEG/PNG/WebP — GIF is not accepted; copy must match the contract).
- On `aboutMeCharactersRemaining` (display-only remaining-count against the 500 cap the textarea `maxlength` enforces; `Math.max(0, …)` is defensive).

## Files to Produce
- `apps/arena-client/src/pages/MyProfilePage.vue` (modify — `computed` + `watch` imports; `avatarPreviewFailed` ref + its `watch`-reset + `aboutMeCharactersRemaining` computed, all returned; avatar preview `<img>` with `alt`; upload hint `<p>`; corrected `invalid_mime_type` copy; About-me counter `<span>` with `aria-live`; scoped card + hint + preview + `@media` CSS)
- `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` (governance close; **no DECISIONS change**)

## File Responsibilities (no logic duplication)
- `MyProfilePage.vue` — the ONLY file changed for behavior; presentation + browser-event handling + one arithmetic `computed` only. No request shape, error mapping, or store logic is added or duplicated here (the WP-298 upload wiring already owns the upload path).

## Tests
- **No new unit test.** The added behavior (image `load`/`error` + the URL-change reset) is native-browser-event + reactive state with no isolatable business-logic branch; the transitions are observable in the D-24026 live check; no persistence/API behavior changes. `MyProfilePage.vue` has no existing component-test harness, so standing one up here is disproportionate. The gate is: existing suite stays **624/624**, `typecheck` 0, `build` 0, plus the D-24026 live check. If any of those three moves, STOP — something non-presentational changed.

## After Completing

**Setup() return-object gate (separate-compile)**
- [ ] `computed` + `watch` imported from `vue`
- [ ] `avatarPreviewFailed` added to the `setup()` return object
- [ ] `aboutMeCharactersRemaining` added to the `setup()` return object

**Preview state (AC-1)**
- [ ] Valid `formAvatarUrl` shows the preview `<img data-testid="my-profile-avatar-preview">`
- [ ] Broken URL hides the preview (no broken-image glyph) via `@error`
- [ ] Broken URL does NOT mutate `formAvatarUrl`
- [ ] After a broken URL, changing `formAvatarUrl` to a valid one restores the preview (the `watch` reset — NOT `@load`)

**Contract-copy (AC-2)**
- [ ] Upload hint says "PNG, JPEG, or WebP" and "up to 5 MB" (verbatim Locked Value)
- [ ] `invalid_mime_type` user-facing copy no longer lists GIF — grep the old claim shape (`GIF, or WebP` / `JPEG, GIF`), not the bare token (the `// why:` comment legitimately says "GIF is NOT accepted")
- [ ] The corrected copy carries a `// why:` citing `avatarUpload.logic.ts`

**Counter + accessibility (AC-3 / AC-7)**
- [ ] Counter `<span data-testid="my-profile-about-me-count">` shows `Math.max(0, 500 - formAboutMe.length)` (never negative); does not gate save
- [ ] Preview `<img>` has non-empty `alt`; counter carries `aria-live="polite"`

**Layout (AC-4)**
- [ ] Card CSS on the four sections, all in the `scoped` block; no `data-testid` renamed/removed
- [ ] `.profile-link-row` is multi-column above 40rem and one column at ≤ 40rem (no horizontal overflow)

**Boundaries + gates (AC-5 / AC-6)**
- [ ] No API/contract/store/`App.vue` change; no forbidden import; WP-298 upload wiring intact
- [ ] `typecheck` 0; `test` **624/624** (unchanged); `build` 0; `git diff --name-only` = `MyProfilePage.vue` + governance only

**Live + governance close**
- [ ] LIVE (D-24026, post-deploy): on `?route=me` the preview shows for a valid URL, vanishes for a broken one, and returns after a valid re-entry; hint + counter render; sections read as cards; the link row stacks on a narrow viewport
- [ ] STATUS.md updated · WORK_INDEX.md (WP-299) flipped · EC_INDEX.md (EC-330) flipped · no new D-entry created
- [ ] Commit prefix `EC-330:` (code) + `SPEC:` (governance)

## Common Failure Smells
- A new element renders blank / a binding is `undefined` at runtime → it was declared in `setup()` but not added to the `return {...}` object (separate-compile pipeline).
- The broken-image glyph flashes on a bad URL → the `@error → avatarPreviewFailed = true` guard is missing, or the `v-if` doesn't check the flag.
- The typed avatar URL gets wiped when the image fails → the `@error` handler mutated `formAvatarUrl` instead of only the `avatarPreviewFailed` flag.
- The preview never comes back after one bad URL → the `watch(formAvatarUrl, …)` reset is missing; `@load` alone can't re-arm it because the `<img>` already left the DOM.
- The format hint or error copy still says "GIF" → it wasn't reconciled against the server's `ALLOWED_MIME_TYPES` (jpeg/png/webp only).
- Test count moves off 624 → a logic change slipped in; this packet is presentation-only.
- CSS bleeds into other pages → a rule escaped the `scoped` block or targeted a global selector.
