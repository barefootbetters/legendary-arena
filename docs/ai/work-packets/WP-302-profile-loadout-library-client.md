# WP-302 — Profile Loadout Library: Owner UI + Public Share View (Client)

**Status:** Draft — ready to execute (drafted 2026-07-01) · **Standard two-session lane** (D-24028 — net-new page + new route + new API client across a management surface; NOT lightweight)
**Primary Layer:** App (`apps/arena-client` — play.legendary-arena.com)
**User-Visible Surface:** play.legendary-arena.com — the owner profile page (`?route=me`) gains a "Saved Loadouts" section, and a net-new public shared-loadout page (`?loadout=<shareSlug>`).
**Dependencies:** WP-301 (the server data model + the five `/api/me/loadouts*` + guest `/api/loadouts/:shareSlug` endpoints — **Done**, on `main` @ D-24086 Active); WP-104 (the `ownerProfileApi.ts` client pattern + MyProfilePage) ✅; WP-160 / WP-131 (the Hanko bearer session the client already attaches) ✅.
**Baseline:** `origin/main` @ `9c61eb5c` (capture `git rev-parse origin/main` at execution). The arena-client has `MyProfilePage.vue`, `ownerProfileApi.ts` (the Bearer-authed `/api/me/*` client pattern), the Pinia `auth` store (`useAuthStore().token`), and the query-string router in `App.vue` — but **no** saved-loadout surface.

---

## Goal

A signed-in player on play.legendary-arena.com gains a "Saved Loadouts" section on their profile page: they can save a loadout (by pasting a LAGN JSON document), see their saved list, rename a loadout, toggle it public/private, delete one, and copy a public share link. Anyone with a share link can open a net-new public page that renders the loadout's name, its owner's display handle, and a composition summary. This is the **client half** of the Vision §19b Profile Loadout Library; it consumes the WP-301 server contract (no new endpoints). Saved loadouts are decorative, user-authored content (§19a/§19b) — never a competitive-submission path.

---

## User-Visible Impact

On play.legendary-arena.com: a signed-in player opens their profile (`?route=me`), pastes a LAGN loadout under a name, and it appears in their Saved Loadouts list. They can rename it, flip it public (which reveals a share link they can copy) or back to private, and delete it. Opening a copied share link (`?loadout=<shareSlug>`) — even signed-out, even in another browser — renders the public loadout's name, the owner's handle, and its composition summary. A private or unknown link shows a "not found" state and never exposes an account identifier.

---

## Assumes

- **The WP-301 server contract is live on `main`.** `POST` / `GET /api/me/loadouts`, `PATCH` / `DELETE /api/me/loadouts/:id` (authenticated-session-required) and guest `GET /api/loadouts/:shareSlug` exist, validate LAGN server-side, enforce the 50-cap (`loadout_limit_reached`), mint opaque `share_slug`s, and return the `SavedLoadoutView` / `PublicLoadoutView` shapes + the closed `LoadoutLibraryErrorCode` union (`unauthorized | not_found | invalid_lagn | invalid_name | loadout_limit_reached | empty_update`). (Verified at `apps/server/src/profile/loadoutLibrary.*.ts` + `docs/ai/REFERENCE/api-endpoints.md`.)
- **The owner-API client pattern is fixed.** `apps/arena-client/src/lib/api/ownerProfileApi.ts` resolves the base URL via `buildApiUrl`, attaches `Authorization: Bearer <token>` for `/api/me/*`, returns a discriminated union `{ ok: true; value } | { ok: false; status; code }` (never throws; network error → `{ ok: false, status: 0, code: null }`), and declares inline interfaces mirroring server shapes. The new client mirrors this exactly. (Verified at `ownerProfileApi.ts`.)
- **The session token source is fixed.** `useAuthStore().token` (Pinia, `apps/arena-client/src/stores/auth.ts`) holds the Hanko bearer; `MyProfilePage.vue` reads it via a local `readAuthToken()` helper. (Verified at `stores/auth.ts` + `MyProfilePage.vue`.)
- **The router is a query-string discriminator.** `App.vue` parses the query string into `ParsedQuery`, maps it via `selectRoute()` to the closed `AppRoute` union, and renders one page per route; `?profile=<handle>` → `PlayerProfilePage` is an existing **unguarded** public route to mirror for `?loadout=<shareSlug>`. (Verified at `App.vue`.)
- **Vue components use the explicit `defineComponent({ setup() { return {...} } })` style** (NOT `<script setup>`) required by the vue-sfc-loader separate-compile pipeline (D-6512). (Verified at `MyProfilePage.vue` / `App.vue`.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `docs/01-VISION.md §19b` — the profile loadout library (decorative, shareable, never competitive); `§19a` — decorative vs merit-bearing; `§3` / `§11` — identity, ownership, visibility.
- `docs/ai/DECISIONS.md` D-24086 (the WP-301 server contract + the decorative-not-merit lock) — scan for related loadout entries.
- `docs/ai/REFERENCE/api-endpoints.md` — the five loadout rows (request/response shapes, `Auth`, status codes) this client consumes. Canonical field names per `docs/ai/REFERENCE/00.2-data-requirements.md`.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` / `.claude/rules/architecture.md` — `apps/arena-client` import rules: UI framework, `@legendary-arena/preplan` (runtime), `@legendary-arena/game-engine` (Runtime-Safe Engine Surface only); **must NOT** import `@legendary-arena/game-engine/setup` (D-14401), `registry` (runtime), `server`, or `pg`. This WP adds **no** new cross-layer import (`lagn` is treated as opaque JSON).
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` — the exact client pattern to mirror (base URL, Bearer header, discriminated-union result, inline interfaces).
- `apps/arena-client/src/pages/MyProfilePage.vue` — the owner page the Saved Loadouts section is added to (between "Your teams" and the billing section).
- `apps/arena-client/src/App.vue` — the `AppRoute` union + `parseQuery` + `selectRoute` + template branches to extend for `?loadout=<shareSlug>`.
- `apps/arena-client/src/lobby/lagnLoadout.ts` — the existing hand-rolled LAGN field reads (the precedent for reading a LAGN document's `setup` display names without importing `@legendary-arena/lagn`).

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- ESM only, Node v22+; full file contents for every new/modified file (no diffs, no snippets).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, `// why:` on non-obvious choices, JSDoc per function, functions ≤ ~30 lines, no premature abstraction, no nested ternaries, no branching `.reduce()`.

**Packet-specific:**
- **No new cross-layer import.** `apps/arena-client` MUST NOT import `@legendary-arena/lagn`, `@legendary-arena/game-engine/setup`, `@legendary-arena/registry`, `apps/server`, or `pg`. The `lagn` document is treated as **opaque JSON**: sent verbatim on create, received verbatim on read, and its `setup` display fields are read defensively via a local minimal interface (the `lagnLoadout.ts` precedent). **No new npm dependency.**
- **Vue style:** `defineComponent({ setup() { return {...} } })` only — never `<script setup>` (vue-sfc-loader / D-6512).
- **API client contract:** every function returns the discriminated union `{ ok: true; value } | { ok: false; status; code }` and NEVER throws; a network/parse failure maps to `{ ok: false, status: 0, code: null }`. The four `/api/me/loadouts*` calls attach `Authorization: Bearer <token>`; the guest `:shareSlug` read attaches no auth header.
- **Inline interfaces mirroring server shapes** (`SavedLoadoutView`, `PublicLoadoutView`) — do not import server types. `lagn` is typed `unknown`.
- **Never render an account identifier** on any loadout surface: the shared-loadout page shows only `name` + `displayHandle` + the composition summary — never `accountId` / `ext_id`.
- **Routing:** extend the closed `AppRoute` union + `parseQuery` + `selectRoute` in `App.vue`; do not re-encode routing elsewhere. The `?loadout=<shareSlug>` route is **unguarded** (guest), mirroring `?profile=<handle>`.
- **`noUncheckedIndexedAccess`-safe** code (array reads are `T | undefined`).
- Zone/engine boundary untouched — no `G`, engine, replay, RNG, or gameplay surface. Clipboard writes are best-effort (`navigator.clipboard.writeText` in try/catch).

**Session protocol:**
- If the Bearer-token flow or the `App.vue` route-discriminator wiring is unclear, STOP and read `ownerProfileApi.ts` / `App.vue` — do not invent the auth attachment or the routing.

---

## Scope (In)

### A) `loadoutLibraryApi.ts` (new API client)
- `apps/arena-client/src/lib/api/loadoutLibraryApi.ts`: inline `SavedLoadoutView` (`id`, `name`, `visibility`, `shareSlug`, `createdAt`, `updatedAt`, `lagn: unknown`) + `PublicLoadoutView` (`name`, `lagn: unknown`, `displayHandle`); discriminated-union result types; and `listLoadouts(authToken)` (GET → `{ loadouts }`), `createLoadout(authToken, { name, lagn })` (POST → 201), `updateLoadout(authToken, id, { name?, visibility? })` (PATCH), `deleteLoadout(authToken, id)` (DELETE → 204), `fetchSharedLoadout(shareSlug)` (guest GET). Base URL via `buildApiUrl`; Bearer header per the `ownerProfileApi.ts` pattern.

### B) `loadoutSummary.ts` (new pure helper)
- `apps/arena-client/src/lib/loadoutSummary.ts`: a pure function that reads a loadout `lagn` document (`unknown`) defensively and returns a display summary (mastermind name, scheme name, hero names, villain-group names, and the numeric counts) for the saved list + the shared view. Handles missing/misshaped fields without throwing; no `@legendary-arena/lagn` import.

### C) `MyProfilePage.vue` (modified — Saved Loadouts section)
- A "Saved Loadouts" card between "Your teams" and the billing section: on mount (and after any mutation) it lists the caller's loadouts (name, composition summary, visibility, and — when public — the share link + a copy button); a create control (a name input + a LAGN JSON textarea + a Save button) that `JSON.parse`s the pasted text (inline error on unparseable JSON), then calls `createLoadout`; per-row rename, a public/private toggle, and delete; inline messages for the typed server errors (`invalid_lagn`, `invalid_name`, `loadout_limit_reached`, `not_found`); an empty-state when the list is empty.

### D) `SharedLoadoutPage.vue` (new — public view)
- `apps/arena-client/src/pages/SharedLoadoutPage.vue`: takes a `shareSlug` prop, calls `fetchSharedLoadout` on mount, and renders the loadout's `name`, the owner's `displayHandle`, and the composition summary on 200; a "loadout not found or private" state on 404; a loading state; never renders an account identifier.

### E) Routing — `App.vue`
- Add `'shared-loadout'` to the `AppRoute` union; parse `?loadout=<shareSlug>` in `parseQuery` (into `ParsedQuery`); slot it into `selectRoute` (unguarded, at the same precedence tier as `?profile=`); add the template branch `<SharedLoadoutPage :shareSlug="..." />`.

### F) Tests
- `apps/arena-client/src/lib/api/loadoutLibraryApi.test.ts` — the five functions: Bearer header attached on `/api/me/*` and absent on the guest read; success returns `{ ok: true, value }`; a `{ error: code }` body surfaces the code; a network throw maps to `{ ok: false, status: 0, code: null }`; the guest 404 maps to `{ ok: false, status: 404, code: 'not_found' }` (fetch stubbed; `node:test`).
- `apps/arena-client/src/lib/loadoutSummary.test.ts` — extracts names/counts from a well-formed LAGN document; returns safe fallbacks for missing/misshaped `setup` fields without throwing.

---

## Out of Scope

- **No lobby integration.** A "Save this loadout" button in the lobby flow and a "Load into lobby" action from the saved list are a **future WP (WP-303)** — this packet's create path is paste-LAGN only. (Decision D-24087.)
- **No full card gallery** on the saved list or shared view — a name-level composition summary only. Rendering the loadout "as cards" (registry image lookup, à la the cards-site WP-288) is deferred.
- **No new server endpoint or contract change** — this WP consumes the WP-301 endpoints verbatim; `api-endpoints.md` needs no edit.
- **No `@legendary-arena/lagn` import / no LAGN schema validation on the client** — the server is the validation authority; the client treats `lagn` as opaque and reads display fields defensively.
- **No change** to `ownerProfileApi.ts`, the existing profile/links/avatar/teams/billing surfaces, or the auth store.
- **No engine / `G` / gameplay / replay / RNG surface.**

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/loadoutLibraryApi.ts` — **new** (5-endpoint client)
- `apps/arena-client/src/lib/loadoutSummary.ts` — **new** (pure composition-summary helper)
- `apps/arena-client/src/pages/SharedLoadoutPage.vue` — **new** (public shared-loadout view)
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** (Saved Loadouts section)
- `apps/arena-client/src/App.vue` — **modified** (`?loadout=<shareSlug>` route)
- `apps/arena-client/src/lib/api/loadoutLibraryApi.test.ts` — **new**
- `apps/arena-client/src/lib/loadoutSummary.test.ts` — **new**
- Governance: `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` + `DECISIONS.md` (D-24087 lands at execution)

**5 new + 2 modified code/test files + governance. Standard two-session lane** (net-new page + new route + new client across a management surface). No other files may be modified.

---

## Contract

- **Client API surface** (`loadoutLibraryApi.ts`, all returning `{ ok: true; value } | { ok: false; status; code }`):
  - `listLoadouts(authToken: string | null)` → `{ loadouts: SavedLoadoutView[] }`
  - `createLoadout(authToken, input: { name: string; lagn: unknown })` → `SavedLoadoutView` (201)
  - `updateLoadout(authToken, id: string, patch: { name?: string; visibility?: 'private' | 'public' })` → `SavedLoadoutView`
  - `deleteLoadout(authToken, id: string)` → `void` (204)
  - `fetchSharedLoadout(shareSlug: string)` → `PublicLoadoutView` (guest; no Bearer)
- **Inline view shapes** (mirror WP-301; canonical field names): `SavedLoadoutView = { id, name, visibility: 'private' | 'public', shareSlug: string | null, createdAt, updatedAt, lagn: unknown }`; `PublicLoadoutView = { name, lagn: unknown, displayHandle }`.
- **Error codes** surfaced verbatim from the server body `{ error: code }`: `unauthorized | not_found | invalid_lagn | invalid_name | loadout_limit_reached | empty_update` (+ a route-structural `invalid_request` on a malformed PATCH body).
- **Route:** `?loadout=<shareSlug>` → `SharedLoadoutPage` (unguarded, guest). Share link copied to the clipboard = `${window.location.origin}/?loadout=<shareSlug>`.
- **Auth:** the four `/api/me/loadouts*` calls attach `Authorization: Bearer <token>` (per the `ownerProfileApi.ts` pattern); the guest slug read attaches none.

---

## Acceptance Criteria

1. `loadoutLibraryApi.ts` exports the five client functions; the four `/api/me/loadouts*` calls attach `Authorization: Bearer <token>` and the guest `fetchSharedLoadout` attaches none; every function returns the discriminated union and never throws (a network throw → `{ ok: false, status: 0, code: null }`) (**AC-1**).
2. `MyProfilePage.vue` renders a "Saved Loadouts" section between the teams and billing sections that lists the caller's loadouts (name, composition summary, visibility, share link + copy button when public) and shows an empty-state when there are none (**AC-2**).
3. Create-via-paste: a name input + LAGN JSON textarea; on submit the client `JSON.parse`s the text (unparseable JSON → an inline local error, no request sent) and `POST`s `{ name, lagn }`; the server's `invalid_lagn` / `invalid_name` / `loadout_limit_reached` surface as inline messages; on 201 the list refreshes and the new loadout appears (**AC-3**).
4. Per-row rename and the public/private toggle call `PATCH` and reflect the returned `SavedLoadoutView`; flipping to public reveals a share link, flipping to private removes it; delete calls `DELETE` and removes the row on 204 (**AC-4**).
5. Copy-share-link writes `${window.location.origin}/?loadout=<shareSlug>` via `navigator.clipboard.writeText` in a try/catch (best-effort; a rejection never breaks the page) (**AC-5**).
6. `?loadout=<shareSlug>` renders `SharedLoadoutPage` (unguarded): it calls the guest endpoint and shows `name` + owner `displayHandle` + composition summary on 200, a "not found or private" state on 404, and never renders an `accountId` / `ext_id` (**AC-6**).
7. `loadoutSummary.ts` extracts mastermind/scheme/hero/villain names + counts from a LAGN document and returns safe fallbacks for missing/misshaped fields without throwing, and without importing `@legendary-arena/lagn` (**AC-7**).
8. No new npm dependency; no import of `@legendary-arena/lagn`, `@legendary-arena/game-engine/setup`, `@legendary-arena/registry`, `apps/server`, or `pg`; `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) exits 0 and the new tests pass (**AC-8**).

---

## Verification Steps

```pwsh
# Step 1 — typecheck (vite build + node:test do NOT type-check; vue-tsc does)
pnpm --filter @legendary-arena/arena-client typecheck   # Expected: exits 0

# Step 2 — tests (the two new suites plus the existing arena-client suites)
pnpm --filter @legendary-arena/arena-client test        # Expected: new suites pass, no regressions

# Step 3 — no forbidden import crept in
Select-String -Path "apps\arena-client\src\lib\api\loadoutLibraryApi.ts","apps\arena-client\src\lib\loadoutSummary.ts","apps\arena-client\src\pages\SharedLoadoutPage.vue" -Pattern "@legendary-arena/lagn|@legendary-arena/game-engine/setup|@legendary-arena/registry|apps/server|from 'pg'"
# Expected: no output

# Step 4 — the Bearer attachment + guest-read shapes exist
Select-String -Path "apps\arena-client\src\lib\api\loadoutLibraryApi.ts" -Pattern "Authorization|Bearer|fetchSharedLoadout|/api/me/loadouts|/api/loadouts/"

# Step 5 — the route landed
Select-String -Path "apps\arena-client\src\App.vue" -Pattern "shared-loadout|loadout"

# Step 6 — scope
git diff --name-only   # Expected: only the ## Files Expected to Change set
```

Live (D-24026): on the deployed play.legendary-arena.com after the deploy — sign in → paste + save a loadout → toggle it public → copy the link → open it in a signed-out/private window → the public page renders `name` + `displayHandle` + summary and no account id.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `loadoutLibraryApi.ts` (5-endpoint client, Bearer on `/api/me/*`, guest read, discriminated-union results) + `loadoutSummary.ts` (safe LAGN summary) created
- [ ] `MyProfilePage.vue` Saved Loadouts section (list / paste-create / rename / visibility toggle / delete / copy-share-link + typed-error messages + empty-state); `SharedLoadoutPage.vue` public view (name + displayHandle + summary; 404 state; no account id); `App.vue` `?loadout=<shareSlug>` unguarded route
- [ ] No new npm dep; no import of `@legendary-arena/lagn` / engine-setup / registry / server / pg (grep clean)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; the two new suites pass; no regression
- [ ] `DECISIONS.md` **D-24087** landed (Active); `WORK_INDEX` (WP-302) + `EC_INDEX` (EC-333) + `STATUS.md` updated
- [ ] **User-visible verification (D-24026):** confirmed live on play.legendary-arena.com after deploy — save (paste) → make public → open the share link signed-out → the public view renders name + handle + summary with no account id (observable evidence recorded in the session summary), NOT satisfied by tests + merge alone

---

## Vision Alignment

**Vision clauses touched:** **§19b** (the profile loadout library — this is its client half), **§19a** (decorative-not-merit), **§3** / **§11** (identity, ownership, visibility — the public/private toggle + share link), §19 (LAGN as the loadout format).

**Conflict assertion:** No conflict — the packet *implements* §19b on the client: loadouts are decorative, account-scoped, editable, and shareable only when the owner opts in; the shared read surfaces only public, user-authored content and never an account identifier. No scoring / PAR / replay / leaderboard surface.

**Non-Goal proximity check:** Crosses none of NG-1..7. **Not pay-to-win (NG-1)** — a saved/shared deck file confers no gameplay advantage; the 50-cap (server-side, WP-301) is a convenience quota the client merely surfaces as a message, not a power gate. **PvP terminology (§23(b)):** "loadout" / "library" / "share" carry no match/opponent/win-loss framing.

**Determinism preservation:** N/A — a client presentation surface; no engine, `G`, replay, RNG, or hash surface. `lagn` is opaque display data.

---

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections; `## Out of Scope` lists ≥2 exclusions (lobby integration, full card gallery, server-contract change, lagn-import).
- §2 Non-Negotiable Constraints — PASS: engine-wide (ESM/Node22/full-file/00.6) + packet-specific (no new cross-layer import, Vue style, discriminated-union client, no-account-id, routing) + session protocol; cites `00.6`.
- §3 Assumes — PASS: server contract, client API pattern, token source, router, Vue style — each with a file source.
- §4 Context — PASS: §19b/§19a/§3/§11, D-24086, api-endpoints.md + 00.2, ARCHITECTURE Layer Boundary + import rules, the four real client files.
- §5 Output Completeness — PASS: 5 new + 2 modified + governance, each with a role; standard lane (net-new page + route, correctly NOT lightweight).
- §6 Naming — PASS: `SavedLoadoutView` / `PublicLoadoutView` / `loadoutLibraryApi` / `loadoutSummary` / `shareSlug`; canonical field names preserved; no abbreviations.
- §7 Dependency Discipline — PASS: **no new npm dependency**; forbidden runtime imports explicitly rejected (`@legendary-arena/lagn`, engine-setup, registry, server, pg); no axios/node-fetch (uses `fetch` via `buildApiUrl`).
- §8 Architectural Boundaries (App) — PASS: no game logic; no forbidden import; consumes the server over HTTP only; grep-gated.
- §9 Windows Compatibility — PASS: `pwsh` + `Select-String` + `\` paths.
- §10 Env Var Hygiene — N/A: no new env var (reuses `VITE_API_BASE_URL` via `buildApiUrl`).
- §11 Authentication Clarity — PASS: no new identity model; the four `/api/me/*` calls reuse the existing Hanko bearer (`useAuthStore().token`); the guest slug read is unauthenticated. Limitation: a private loadout is protected server-side (WP-301 scoping) — the client cannot and does not enforce ownership.
- §12 Test Quality — PASS: `node:test`; fetch stubbed; no boardgame.io import; no network/DB. (No deck-construction golden test applies — this is a presentation client.)
- §13 Commands & Verification — PASS: exact `pnpm --filter … typecheck` / `test` + `Select-String` with expected output.
- §14 Acceptance Criteria — PASS: 8 binary, observable items naming real files/routes/codes.
- §15 Definition of Done — PASS: STATUS/DECISIONS/WORK_INDEX + scope-boundary + typecheck; §15.1 addressed.
- §15.1 User-Visible Verification (D-24026) — PASS: `User-Visible Surface` declared (play.legendary-arena.com); DoD carries a live-on-surface item (save → public → open share link signed-out), not tests+merge alone.
- §16 Code Style — PASS: `defineComponent`+setup; discriminated-union results; `for...of` / explicit `if-else`; `// why:` on the opaque-lagn read, the best-effort clipboard, and the unguarded-route choice; JSDoc per function; named imports.
- §17 Vision Alignment — PASS: `## Vision Alignment` present; §19b/§19a/§3/§11/§19; NG-1 + §23(b) addressed; determinism N/A.
- §18 Prose-vs-Grep — PASS: Step 3's grep targets forbidden import identifiers; no adjacent prose enumerates them verbatim outside a D-citation.
- §19 Bridge-vs-HEAD — N/A: no repo-state snapshot artifact.
- §20 Funding Surface Gate — N/A: no donate/support/tournament-funding copy or affordance; this is a loadout-library surface with no funding channel.
- §21 API Catalog Update — N/A: client-only; consumes the five endpoints WP-301 already catalogued; no `apps/server` endpoint or library function added/modified.

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight (01.4): READY.** Dependencies verified on `main` (WP-301 endpoints + D-24086 Active; WP-104 client pattern; WP-131/160 bearer). Scope locked to the 7-file allowlist + governance. Net-new page + route + client → **standard two-session lane** (D-24028; not lightweight). Not a validation-tightening change on an existing input path (net-new client surface), so `01.4 §Empirical Scaffold` does not apply.

**Copilot (01.7): PASS.** Real failure modes pinned: (a) leaking an account id on the shared view → **no-account-id constraint + AC-6 + the public projection is server-side allowlisted (WP-301)**; (b) a forbidden `@legendary-arena/lagn`/engine-setup import sneaking in → **grep gate + opaque-lagn constraint**; (c) missing the vue-tsc gate (recurring arena-client miss) → **typecheck in Before/After + AC-8**; (d) the closed `AppRoute` union not extended consistently → **routing constraint + Step 5**; (e) an unparseable paste throwing → **local JSON.parse guard in AC-3**. No BLOCK.

## Decision (reserved, lands at execution)

Reserves **D-24087**: the client owner-profile loadout-library UI. (1) **Profile-only MVP** — the create path is paste-LAGN + manage (list/rename/visibility/delete) + copy-share-link; lobby "Save this loadout" / "Load into lobby" integration is deferred to a future **WP-303**. (2) A net-new **unguarded `?loadout=<shareSlug>` public route** + `SharedLoadoutPage`, mirroring the `?profile=<handle>` public-profile route. (3) **Name-level composition summary** rendering on the saved list + shared view (via a local `loadoutSummary` helper), NOT a full card gallery — full-card rendering is deferred. (4) `apps/arena-client` treats `lagn` as **opaque JSON** and does **not** import `@legendary-arena/lagn` — the App layer stays free of the validator (consistent with the existing hand-rolled `lagnLoadout.ts` reads and the D-14401 boundary posture); the server remains the sole LAGN-validation authority. Drafted 2026-07-01; not yet landed.
