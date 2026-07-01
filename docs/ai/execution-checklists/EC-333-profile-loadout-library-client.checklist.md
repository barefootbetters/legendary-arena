# EC-333 — Profile Loadout Library: Owner UI + Public Share View (Client) — Execution Checklist

**Source:** docs/ai/work-packets/WP-302-profile-loadout-library-client.md
**Layer:** App (`apps/arena-client` — play.legendary-arena.com) · **Standard two-session lane** (D-24028)

## Before Starting (Hard Gate)
- [ ] WP-301 server contract live on `main`: `grep -c "/api/me/loadouts" docs/ai/REFERENCE/api-endpoints.md` ≥ 4 and the guest `/api/loadouts/:shareSlug` row present
- [ ] Client pattern to mirror present: `grep -c "Authorization" apps/arena-client/src/lib/api/ownerProfileApi.ts` ≥ 1 (Bearer attach) + discriminated-union result shape
- [ ] Token source present: `apps/arena-client/src/stores/auth.ts` exports `useAuthStore` with a `token` ref
- [ ] Router anchors present: `App.vue` has `type AppRoute`, `parseQuery`, `selectRoute`, and an unguarded `?profile=` branch to mirror
- [ ] Scope lock — EXACTLY the `## Files to Produce` set below; anything else is a FAIL, surface as a blocker
- [ ] Baseline: `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` records pass/fail

## Locked Values (do not re-derive)
- Endpoints consumed: `POST` / `GET /api/me/loadouts`, `PATCH` / `DELETE /api/me/loadouts/:id` (Bearer), `GET /api/loadouts/:shareSlug` (guest, no Bearer)
- Result shape: `{ ok: true; value } | { ok: false; status; code }` — NEVER throw; network/parse failure → `{ ok: false, status: 0, code: null }`
- View shapes (inline, mirror server): `SavedLoadoutView = { id, name, visibility: 'private'|'public', shareSlug: string|null, createdAt, updatedAt, lagn: unknown }`; `PublicLoadoutView = { name, lagn: unknown, displayHandle }`
- Error codes surfaced verbatim from `{ error: code }`: `unauthorized | not_found | invalid_lagn | invalid_name | loadout_limit_reached | empty_update` (+ route-structural `invalid_request`)
- Route: `?loadout=<shareSlug>` → `SharedLoadoutPage`, **unguarded** (guest); share link = `${window.location.origin}/?loadout=<shareSlug>`
- Base URL via `buildApiUrl`; Bearer via `useAuthStore().token`

## Guardrails
- **No new cross-layer import / no new npm dep** — MUST NOT import `@legendary-arena/lagn`, `@legendary-arena/game-engine/setup`, `@legendary-arena/registry`, `apps/server`, or `pg`. `lagn` is opaque JSON; read `setup` display fields defensively (the `lagnLoadout.ts` precedent). Grep-clean.
- **Never render an account id** — the shared view shows only `name` + `displayHandle` + summary; never `accountId` / `ext_id`; 404 → "not found or private" state
- **Vue style:** `defineComponent({ setup() { return {...} } })` only — never `<script setup>` (D-6512)
- **Auth:** the four `/api/me/loadouts*` calls attach `Authorization: Bearer <token>`; the guest slug read attaches none
- **Routing:** extend the closed `AppRoute` union + `parseQuery` + `selectRoute` in `App.vue` — do not re-encode routing elsewhere; the loadout route is unguarded
- Create-via-paste: `JSON.parse` the textarea (inline local error on unparseable input; no request sent) before `createLoadout`
- `noUncheckedIndexedAccess`-safe; full-word names; JSDoc per function; `for...of` / explicit `if-else` (no branching `.reduce()`)

## Required `// why:` Comments
- On reading the opaque `lagn` document's `setup` fields defensively (no `@legendary-arena/lagn` import; the server is the validation authority)
- On the best-effort clipboard write (`navigator.clipboard.writeText` in try/catch — a rejection must not break the page)
- On the unguarded `?loadout=<shareSlug>` route (guest share link, mirrors `?profile=`; the guest endpoint returns public-only data)
- On the network/parse → `{ ok: false, status: 0, code: null }` fallback (the client never throws)

## Files to Produce
- `apps/arena-client/src/lib/api/loadoutLibraryApi.ts` — **new** — 5-endpoint client (Bearer on `/api/me/*`, guest read)
- `apps/arena-client/src/lib/loadoutSummary.ts` — **new** — pure LAGN→display-summary helper (defensive, no lagn import)
- `apps/arena-client/src/pages/SharedLoadoutPage.vue` — **new** — public shared-loadout view (name + displayHandle + summary; 404 state)
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — Saved Loadouts section (list / paste-create / rename / visibility toggle / delete / copy-link + typed-error messages + empty-state)
- `apps/arena-client/src/App.vue` — **modified** — `?loadout=<shareSlug>` unguarded route (union + parseQuery + selectRoute + template branch)
- `apps/arena-client/src/lib/api/loadoutLibraryApi.test.ts` — **new** — client tests (fetch stubbed)
- `apps/arena-client/src/lib/loadoutSummary.test.ts` — **new** — summary extraction + safe fallbacks

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (vue-tsc — vite build + tsx tests do NOT type-check)
- [ ] `pnpm --filter @legendary-arena/arena-client test` green; two new suites pass; no regression
- [ ] No forbidden import / no new npm dep (grep clean per WP Verification Step 3)
- [ ] **Live-on-surface (D-24026):** after deploy, on play.legendary-arena.com — save (paste) → make public → open the share link signed-out → public view shows name + handle + summary, no account id; evidence recorded in STATUS
- [ ] `docs/ai/DECISIONS.md` D-24087 landed Active; `WORK_INDEX` (WP-302) + `EC_INDEX` (EC-333) + `STATUS.md` updated
- [ ] Commit prefix `EC-333:` (code) + `SPEC:` (governance)
- [ ] Hand off: WP-303 (lobby "Save this loadout" / "Load into lobby" integration) remains the deferred follow-on

## Common Failure Smells
- Account id visible on the shared page → the view rendered more than the `PublicLoadoutView` allowlist
- Bearer header on the guest slug read (or missing on `/api/me/*`) → the auth attach was copied to the wrong call
- `vite build` green but CI red later → the `vue-tsc` typecheck gate was skipped (recurring arena-client miss: WP-166/207/227)
- Unparseable paste throws / white-screens → the local `JSON.parse` guard is missing before `createLoadout`
- A `@legendary-arena/lagn` import to "properly type" `lagn` → forbidden; keep `lagn: unknown` + defensive reads
