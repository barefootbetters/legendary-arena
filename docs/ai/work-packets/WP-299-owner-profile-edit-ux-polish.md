# WP-299 — Owner Profile Edit-Page UX Polish (Avatar Preview, Accurate Upload Hint, About-Me Counter, Card Layout)

**Status:** Draft — ready to execute (drafted 2026-06-30) · **Lightweight Lane** (D-24028)
**Primary Layer:** Arena Client (`apps/arena-client`)
**User-Visible Surface:** `play.legendary-arena.com` (the `?route=me` owner profile edit page)
**Dependencies:** WP-104 (the `?route=me` owner profile + `MyProfilePage.vue`) ✅; WP-298 / EC-329 (the avatar file-upload control this polishes) ✅; WP-106 / D-10601 (the server avatar-validation policy whose limits the hint copy must mirror) ✅.
**Baseline:** `origin/main` @ `f88aa597` (2026-06-30). `MyProfilePage.vue` renders the profile/links/teams/billing sections as a flat label-heavy column with no avatar preview, no upload-format/size guidance, and no About-me character counter; the `invalid_mime_type` error copy lists **GIF**, which the server does not accept.

---

## Goal

The owner profile edit page (`MyProfilePage.vue`, `?route=me`) gains four additive, presentation-only improvements that make it clearer and less error-prone, with **no** change to any API call, contract, or save behavior: (1) a live **avatar preview thumbnail** that renders the current `formAvatarUrl` and hides itself on a bad/unreachable URL rather than showing the browser's broken-image glyph; (2) an **accurate upload hint** stating the server's real accepted formats and size limit; (3) an **About-me character counter** showing remaining room against the existing 500-character cap; and (4) light **card treatment + a mobile breakpoint** so the sections read as distinct blocks and the link row stops overflowing on narrow screens. It also corrects the pre-existing `invalid_mime_type` error copy, which claims GIF is supported when the server's `ALLOWED_MIME_TYPES` accepts only JPEG/PNG/WebP.

---

## User-Visible Impact

On `play.legendary-arena.com`, a signed-in player editing their profile (`?route=me`) sees: their current avatar as a round thumbnail above the URL field (which disappears cleanly if the URL is broken); a one-line hint under the file picker — "PNG, JPEG, or WebP · up to 5 MB. A square image around 512×512 pixels looks best."; a live "N characters remaining" line under the About-me box; and the Profile / Links / Teams / Billing blocks rendered as bordered cards instead of one long strip, with the link editor stacking to a single column on phones. A player who picks a GIF (or reads the format hint) is no longer told GIF is acceptable when the upload would reject it.

---

## Assumes

- **`MyProfilePage.vue` is the sole owner-profile edit surface** and uses the `defineComponent({ setup() { return {...} } })` pattern (NOT `<script setup>`) required by the `@legendary-arena/vue-sfc-loader` separate-compile pipeline (D-6512 / P6-30): every template binding must be returned from `setup()`. (Verified at `MyProfilePage.vue:1-27`, `:333`.)
- **The avatar upload control + its state already exist** (WP-298): `formAvatarUrl`, `avatarFile`, `avatarUploadInFlight`, the file input (`data-testid="my-profile-avatar-file"`), the "Upload avatar" button, and the `avatarUploadMessageForCode` error map. This packet is additive to that block and does not alter the upload call. (Verified at `MyProfilePage.vue` `<section class="profile-form">`.)
- **The server avatar-validation limits are fixed and are the source of truth for the hint copy.** `ALLOWED_MIME_TYPES = ['image/jpeg','image/png','image/webp']` and `MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024`. (Verified at `apps/server/src/profile/avatarUpload.logic.ts:31-34,61`.) GIF is **not** accepted.
- **The About-me field is capped at 500 characters** via the textarea `maxlength="500"`; the counter is display-only and does not enforce (the `maxlength` already does). (Verified at `MyProfilePage.vue` About-me `<textarea>`.)
- **The test runner is `node:test`** via `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`. `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) + `test` + `build` exit 0 at baseline (test count **624**). (Verified at `apps/arena-client/package.json`.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — `apps/arena-client` owns UI only; this packet adds presentation + one trivial computed to a single page and touches no API, contract, or store.
- `apps/arena-client/src/pages/MyProfilePage.vue` — read entirely; every new binding (`avatarPreviewFailed`, `aboutMeCharactersRemaining`) MUST be declared in `setup()` and returned in the `return {...}` object, per the separate-compile `// why:` block at the top of the file.
- `apps/server/src/profile/avatarUpload.logic.ts` — the canonical accepted-format list + size limit the hint copy mirrors. Do **not** import server code; the copy is a hand-written string grounded in this contract (a drift comment cites the source).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 12 (flat structure), Rule 14 (canonical field names).
- WP-298 / EC-329 — the immediately-prior packet on this same file/block; this packet must not disturb the upload wiring it added.

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+; human-style code per `00.6`.
- Every template binding returned from `setup()` (separate-compile pipeline). A binding referenced in the template but absent from the `return {...}` object renders as `undefined` — a silent failure this pipeline is prone to.
- No cross-layer import: no `apps/server/**`, `packages/*` runtime, or `boardgame.io` import added.

**Packet-specific:**
- **Presentation-only.** No change to `fetchOwnerProfile` / `updateOwnerProfile` / `replaceOwnerLinks` / `uploadOwnerAvatar` calls, the request/response shapes, the auth store, the save flow, the link model, or `ownerProfileApi.ts`. This packet adds no network behavior.
- The avatar preview hides on the `error` event; a change to `formAvatarUrl` MUST re-arm it (reset the failed flag). Without this reset, once `@error` removes the `<img>` from the DOM the `@load` event can never fire again, so a single bad URL would permanently suppress the preview for every later (valid) URL. The preview MUST NOT clear or rewrite the user's typed `formAvatarUrl` (the value is the user's, not the preview's to mutate).
- The upload-format hint text MUST match the server contract: accepted **PNG, JPEG, WebP** (no GIF); max **5 MB**. A `// why:` comment on the corrected `invalid_mime_type` copy cites `avatarUpload.logic.ts` as the source.
- The About-me counter is a `computed` (`500 - formAboutMe.value.length`) — display only; it does not enforce the cap (the textarea `maxlength` already does) and does not block save.
- Card treatment + the mobile breakpoint are **scoped `<style>`** changes plus additive class hooks; no existing `data-testid` is renamed or removed. New elements may add test ids (`my-profile-avatar-preview`, `my-profile-about-me-count`).

**Session protocol:**
- If the exact `setup()` return block or an existing `data-testid` is unclear, stop and confirm against the file — do not invent a binding name or testid.

---

## Scope (In)

### A) `MyProfilePage.vue` — avatar preview (additive)
- A round thumbnail `<img :src="formAvatarUrl" alt="Current profile avatar preview" data-testid="my-profile-avatar-preview">` above the Avatar URL field, shown only when `formAvatarUrl !== ''` and a preview-failed flag is false.
- New `avatarPreviewFailed` ref (returned from `setup()`); `@error` sets it true (hide the broken glyph). A `watch(formAvatarUrl, …)` resets it to false on every URL change so the preview re-arms (see the Non-Negotiable reset rule). The user's `formAvatarUrl` is never mutated by the preview.

### B) `MyProfilePage.vue` — accurate upload hint (additive) + error-copy correction
- A `<p class="profile-field-hint">` under the file input: "PNG, JPEG, or WebP · up to 5 MB. A square image around 512×512 pixels looks best."
- Correct the existing `avatarUploadMessageForCode('invalid_mime_type')` string from "PNG, JPEG, GIF, or WebP" to "PNG, JPEG, or WebP" (GIF is not in the server's `ALLOWED_MIME_TYPES`); add a `// why:` citing the server contract.

### C) `MyProfilePage.vue` — About-me character counter (additive)
- A `computed` `aboutMeCharactersRemaining = Math.max(0, 500 - formAboutMe.value.length)` (returned from `setup()`); rendered as a `<span data-testid="my-profile-about-me-count" aria-live="polite">` under the About-me textarea. `computed` is imported from `vue`. `Math.max` is defensive-only — the counter never displays a negative value; the textarea `maxlength` stays the authoritative cap.

### D) `MyProfilePage.vue` — card treatment + mobile breakpoint (scoped `<style>`)
- Subtle border/padding/background on `.profile-form`, `.profile-links`, `.profile-teams`, `.profile-billing`; preview-image + hint + counter styling; a `@media (max-width: 40rem)` rule collapsing `.profile-link-row` to a single column.

---

## Out of Scope

- **No API / contract / store change.** `ownerProfileApi.ts`, the three profile wrappers + `uploadOwnerAvatar`, the auth store, `App.vue`, and the public profile page are byte-identical.
- **No new feature** — the deferred profile-page features (drag-and-drop link reorder, avatar crop modal, profile-completeness meter, "preview public profile", single-save + unsaved-changes guard, empty-state CTAs) are **each their own future WP**, not this one.
- **No "preview public profile" link** — `OwnerProfileView` exposes no handle or public-profile URL; that link is blocked on a new server field (a separate WP).
- **No enforcement change** — the counter is display-only; the 500-char cap stays enforced by the existing `maxlength`.
- **No design-system / global CSS change** — all styling stays in this component's `scoped` block.
- **Visual-only styling boundary** — the only selectors touched are the four section cards (`.profile-form`, `.profile-links`, `.profile-teams`, `.profile-billing`), the new preview/hint/counter elements (`.profile-avatar-preview`, `.profile-field-hint`, `.profile-char-count`), and the `.profile-link-row` breakpoint. No spacing, width, visibility, reorder, or interaction behavior of any element **outside** that set may be changed.
- Refactors or "while I'm here" cleanups of `MyProfilePage.vue` beyond the four items above.

---

## Files Expected to Change

- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — `computed` + `watch` imports; `avatarPreviewFailed` ref + its `watch(formAvatarUrl, …)` reset + `aboutMeCharactersRemaining` computed (both bindings returned from `setup()`); avatar preview `<img>` (with `alt`); upload-format hint `<p>`; corrected `invalid_mime_type` copy; About-me counter `<span>` (`aria-live="polite"`); scoped card + hint + preview + mobile-breakpoint CSS.
- Governance: `docs/ai/work-packets/WORK_INDEX.md` + `docs/ai/execution-checklists/EC_INDEX.md` + `docs/ai/STATUS.md` (no new D-entry — presentation polish + a copy correction; no architectural decision).

**1 code file (modified) + governance. Lightweight-lane eligible.** No other files may be modified. No dedicated unit test is required because: (1) the added behavior — image `load`/`error` handling and the URL-change reset — is native-browser-event + reactive state with no branch to assert in isolation; (2) that state transition is directly observable in the D-24026 live check; and (3) no business logic, persistence, or API behavior changes (the suite stays green at 624). `MyProfilePage.vue` also has no existing component-test harness — standing one up for this surface would be disproportionate. Verification is `typecheck` + `build` + the existing suite staying green + the D-24026 live check.

---

## Vision Alignment

**Vision clauses touched:** §3, §11 (player identity / profile presentation). No scoring / PAR / replay / RNG / simulation surface.

**Conflict assertion:** No conflict — pure presentation polish + an accuracy correction to error copy. Ownership/visibility semantics (the visibility selects, the server-enforced `avatarVisibility`) are unchanged.

**Non-Goal proximity check:** User-facing but crosses none of NG-1..7. Not pay-to-win (NG-1); not a paid/persuasive surface. **PvP terminology (§23(b)):** "avatar" / "profile" / "About me" carry no match/opponent/win-loss framing; the read-only Teams block copy is untouched.

**Determinism preservation:** N/A — client UI only; no engine, replay, RNG, persistence, or hash surface.

---

## Acceptance Criteria

1. When `formAvatarUrl` is a non-empty string, a preview `<img data-testid="my-profile-avatar-preview">` renders above the URL field; on the image's `error` event it hides (no broken-image glyph) without altering `formAvatarUrl`; and **after** a failed URL, changing `formAvatarUrl` to a valid one restores the preview (the failed flag resets on any `formAvatarUrl` change, not only via `@load`) (**AC-1**).
2. The upload block shows a hint reading exactly "PNG, JPEG, or WebP · up to 5 MB. A square image around 512×512 pixels looks best."; the `invalid_mime_type` error copy no longer contains "GIF" and lists only PNG/JPEG/WebP, matching `avatarUpload.logic.ts` `ALLOWED_MIME_TYPES` (**AC-2**).
3. A live counter (`data-testid="my-profile-about-me-count"`) shows `Math.max(0, 500 - formAboutMe.length)` characters remaining (never negative) and updates as the field changes; it does not enforce or block save (**AC-3**).
4. The Profile / Links / Teams / Billing sections render with card treatment (border + padding); `.profile-link-row` collapses to one column at ≤ 40rem; all styling stays in the component's `scoped` block (**AC-4**).
5. No API/contract/store change: `ownerProfileApi.ts`, the auth store, `App.vue`, and the public profile page are unchanged; no `apps/server` / `packages/*` / `boardgame.io` import added; the existing avatar-upload wiring (WP-298) still functions (**AC-5**).
6. `pnpm --filter @legendary-arena/arena-client typecheck` 0; `test` 0 (count **unchanged at 624** — the added behavior is browser-event UI with no unit-testable business-logic branch); `build` 0 (**AC-6**).
7. **Accessibility preserved:** the preview `<img>` carries non-empty `alt="Current profile avatar preview"`, and the counter is a plain text node with `aria-live="polite"` so a screen reader announces the remaining count as it changes (**AC-7**).

---

## Verification Steps

```pwsh
# Step 1 — typecheck (vue-tsc); every new binding must be returned from setup()
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0

# Step 2 — full arena-client suite (count unchanged — no new logic)
pnpm --filter @legendary-arena/arena-client test
# Expected: TAP — tests 624 / pass 624 / fail 0

# Step 3 — build
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0 (MyProfilePage chunk emitted)

# Step 4 — the "GIF is supported" CLAIM is gone from user-facing copy.
#          (The // why: comment legitimately says "GIF is NOT accepted", so grep the
#           OLD CLAIM SHAPE — "…, GIF, or WebP" / "JPEG, GIF" — not the bare token.)
Select-String -Path "apps\arena-client\src\pages\MyProfilePage.vue" -Pattern "GIF, or WebP|JPEG, GIF"
# Expected: no output (the old "PNG, JPEG, GIF, or WebP" copy is removed)
Select-String -Path "apps\arena-client\src\pages\MyProfilePage.vue" -Pattern "my-profile-avatar-preview|my-profile-about-me-count|profile-field-hint"
# Expected: all three present

# Step 4a — the two new bindings exist AND are returned from setup()
#           (the top separate-compile failure mode: declared but not returned →
#            renders undefined). typecheck (Step 1) is the hard proof; this is the
#            fast smell-check.
Select-String -Path "apps\arena-client\src\pages\MyProfilePage.vue" -Pattern "avatarPreviewFailed|aboutMeCharactersRemaining"
# Expected: each appears at its declaration AND inside the setup() return object

# Step 5 — no forbidden import / no API-layer edit
Select-String -Path "apps\arena-client\src\pages\MyProfilePage.vue" -Pattern "apps/server|packages/registry|packages/game-engine|boardgame.io"
# Expected: no output
git diff --name-only
# Expected: only MyProfilePage.vue + governance files
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** confirmed **live on `play.legendary-arena.com`** — on `?route=me` the avatar preview renders for a valid URL and vanishes for a broken one; the format hint + character counter show; the sections render as cards and the link row stacks on a narrow viewport (screenshot / observed behavior captured). Tests alone do NOT satisfy this item.
- [ ] All acceptance criteria pass
- [ ] `avatarPreviewFailed` + `aboutMeCharactersRemaining` declared in `setup()` **and returned**; `computed` + `watch` imported
- [ ] Avatar preview hides on `error` and re-arms on any `formAvatarUrl` change (via `watch`) — a prior bad URL never permanently suppresses it; the preview never mutates `formAvatarUrl`; hint + counter render
- [ ] `invalid_mime_type` copy corrected (no GIF) with a `// why:` citing `avatarUpload.logic.ts`
- [ ] Accessibility: preview `<img>` has non-empty `alt`; counter carries `aria-live="polite"`; counter value is `Math.max(0, …)` (never negative)
- [ ] Card + mobile-breakpoint CSS confined to the component `scoped` block; no `data-testid` renamed/removed
- [ ] No API/contract/store/`App.vue` change; no forbidden import; WP-298 upload wiring intact
- [ ] `typecheck` + `test` (624/624) + `build` exit 0; only `MyProfilePage.vue` + governance modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` + `WORK_INDEX.md` (WP-299) + `EC_INDEX.md` (EC-330) flipped with date

---

## Lightweight-Lane Eligibility (D-24028)

**Structural (provisional):** (1) single layer — `apps/arena-client` only ✓; (2) 1 code file, no separate runtime-wiring file ✓; (3) no `01.6` trigger — no new contract, abstraction, builder, runtime-wiring, or code category (a preview `<img>` + its `watch`-reset, a hint, a trivial `computed`, scoped CSS, a one-word copy fix) ✓; (4) no new contract file ✓; (5) **zero** D-entries — presentation polish + a copy correction; no durable decision ✓; (6) narrow UX surface — no scoring/identity-semantics/RNG/determinism/monetization change ✓.
**Empirical (confirmed at govern-close):** (7) strictly additive plus one in-scope copy correction — no existing logic rewritten (the upload call, save flow, wrappers, and store are untouched) ✓; (8) zero determinism/persistence/hash impact ✓; (9) file budget holds at final `git diff --name-only` (1 code file + governance) ✓.
**Scaffold (empirical independence):** the changes were prototyped in `MyProfilePage.vue` and the arena-client suite run **before** eligibility was confirmed — `typecheck` 0, `test` **624/624** (unchanged from the WP-298 baseline: the additions are browser-event UI + reactive state, with no unit-testable business-logic branch), `build` 0. Not a validation-tightening change (no input newly rejected — the hint/error copy is display text; the upload path itself is byte-identical), so `01.4 §Empirical Scaffold` does not strictly apply; the mandatory lane scaffold is satisfied by the observed run.

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections present; `## Out of Scope` lists ≥2 excluded items (API change, deferred features, public-profile link, enforcement, global CSS).
- §2 Non-Negotiable Constraints — PASS: presentation-only; forbids API/store edits + forbidden imports; the separate-compile return-binding rule and the server-sourced hint copy are explicit.
- §3 Assumes — PASS: the file/pipeline, the WP-298 upload block, the server format+size limits, the 500-char cap, and the test runner all listed with file:line sources.
- §4 Context — PASS: cites ARCHITECTURE layer rule, the real `MyProfilePage.vue` + `avatarUpload.logic.ts`, `00.6`, and WP-298/EC-329.
- §5 Output Completeness — PASS: 1 code file + governance, marked modified with a one-line role; bounded (≤4); no-new-test justified.
- §6 Naming — PASS: descriptive `avatarPreviewFailed` / `aboutMeCharactersRemaining`; canonical `avatarUrl` / `aboutMe` unchanged; no abbreviations.
- §7 Dependency Discipline — PASS: no new npm dependency; uses `vue`'s `computed` only.
- §8 Architectural Boundaries — PASS (Frontend): no game logic, no direct R2/API-shape change, no `boardgame.io`; grep-gated forbidden imports; presentation + one computed only.
- §9 Windows Compatibility — PASS: Verification Steps use `pwsh` + `Select-String` + `\` paths.
- §10 Env Var Hygiene — N/A: no env var touched.
- §11 Authentication Clarity — N/A: no auth surface changed — reuses the existing token read; adds no endpoint, identity model, or secret.
- §12 Test Quality — PASS (no-new-test justified): the added behavior (image `load`/`error` + the URL-change reset) is native-browser-event + reactive state with no isolatable business-logic branch; those transitions are directly observable in the D-24026 live check; no persistence/API behavior changes and the suite stays 624/624; `MyProfilePage.vue` has no existing component-test harness, so standing one up for this surface is disproportionate.
- §13 Commands & Verification — PASS: exact `pnpm` + `Select-String` commands with expected output (incl. the GIF-absent grep).
- §14 Acceptance Criteria — PASS: 6 binary, observable items naming real testids / files / copy.
- §15 Definition of Done — PASS: binary checkboxes incl. STATUS / WORK_INDEX / EC_INDEX + commit-prefix; §15.1 present.
- §15.1 User-Visible Verification (D-24026) — PASS: surface `play.legendary-arena.com`; `## User-Visible Impact` present; DoD has a live-on-surface verify item, not tests-only.
- §16 Code Style — PASS: `computed` / `watch` + explicit template guards (no nested ternary / branching `.reduce()`); `is/has`-style flag (`avatarPreviewFailed`); `// why:` on the preview `watch`-reset rationale, the counter rationale, and the corrected copy; named imports only.
- §17 Vision Alignment — PASS: `## Vision Alignment` present; §3/§11; NG-proximity none; determinism N/A.
- §18 Prose-vs-Grep — PASS (self-trip avoided): the required `// why:` comment legitimately contains "GIF" ("GIF is NOT accepted"), so the verification greps the **old claim shape** (`GIF, or WebP` / `JPEG, GIF`), not the bare `GIF` token — the comment cannot self-trip the gate (per the grep-gate-comment-self-trip precedent).
- §19 Bridge-vs-HEAD — N/A: no repo-state-snapshot artifact authored.
- §20 Funding Surface Gate — N/A: profile-edit UX; the untouched Community Funding block carries the existing copy; no donate/support affordance added.
- §21 API Catalog Update — N/A: no HTTP endpoint or `apps/server/src/**` library function added or modified; this packet does not call the server at all beyond what already exists.

## Lint / Pre-Flight / Copilot (lightweight lane)

**Lint (00.3): PASS** — all 21 sections resolved above; §15.1 (D-24026) + §17 (Vision) satisfied with real blocks; §11 / §20 / §21 N/A carry non-tautological reasons.

**Condensed pre-flight (01.4): READY (lane).** Class = lightweight additive client UX (single layer; one modified page; no logic branch). **Dependencies complete** — WP-104 ✅ (the page), WP-298 ✅ (the upload block being polished), WP-106 / D-10601 ✅ (the server format/size limits the hint mirrors) — all verified against source on `origin/main` @ `f88aa597`. **Scope locked** — 1 code file + governance, additive + one in-scope copy correction, no contract/server/catalog/determinism/persistence surface. **Behavior-identity** subsumed by the scaffold: the suite holds at 624/624 unchanged, proving no existing behavior was altered.

**Targeted self-review (lane copilot): PASS.** Eligibility is demonstrated with artifacts (1-file `git diff --name-only`, no new contract file, no hash/determinism surface, the observed 624/624 scaffold run), not argued in prose. The one correctness risk — the format hint drifting from the server's accepted-type list — is pinned as a Locked Value sourced from `avatarUpload.logic.ts` + a required `// why:` on the corrected copy + a grep gate asserting "GIF" is absent. No BLOCK; no inline-amendment budget consumed at draft.

## Decision

This packet reserves **no** new DECISIONS entry — it is presentation polish plus a one-word copy correction to align the `invalid_mime_type` message with the pre-existing server contract (`ALLOWED_MIME_TYPES`, WP-106 / D-10601). The design choices (preview hides on error without mutating the field; hint copy sourced from the server limit; display-only counter; scoped card CSS) are operational, not architectural, and are pinned in the WP + EC-330 rather than as a durable decision.
