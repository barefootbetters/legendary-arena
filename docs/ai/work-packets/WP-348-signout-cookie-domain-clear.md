# WP-348 — Sign-out clears the `Domain`-scoped session cookie (fixes WP-347 regression)

**Status:** Ready
**Primary Layer:** Client (`apps/arena-client` + `apps/dashboard`)
**Dependencies:** WP-160 / WP-241 (Hanko wrappers), WP-347 (cross-subdomain cookie)
**User-Visible Surface:** play.legendary-arena.com + dashboard.legendary-arena.com

> **Production regression fix.** After WP-347, clicking "Sign out" did nothing —
> the header still showed the player's name. Observable, so D-24026 applies.

---

## Session Context

WP-347 (D-24137) set `cookieDomain: '.legendary-arena.com'` on the Hanko SDK
`register()` for cross-subdomain SSO. That broke sign-out: the cookie is now SET
with a parent `Domain`, but `@teamhanko/hanko-frontend-sdk@2.6.0`'s
`removeAuthCookie()` deletes the cookie by **name only, with no `Domain`**
(`O.remove(this.authCookieName)`). A browser requires the same `Domain` to
delete a cookie, so `hanko.logout()` cannot remove the parent-domain cookie —
the session survives and sign-out appears to do nothing.

---

## Goal

`signOutCurrentSession` (the shared broker-confined wrapper in both
`hankoClient.ts`) explicitly expires the `hanko` cookie with the matching parent
domain after `logout()`, in a `finally` so the local sign-out completes even if
the broker call fails. Sign-out works again on `play` (and `dashboard`), and —
because the cookie is now truly cleared on the shared `.legendary-arena.com`
domain — the WP-347 SSO sign-out is consistent across subdomains.

---

## User-Visible Impact

Clicking "Sign out" on `play` (or `dashboard`) actually signs the player out: the
`hanko` cookie is removed, the header returns to "Sign in", and a reload does not
silently re-authenticate. (Because the cookie is parent-scoped, this also ends
the session for the other subdomains — the flip side of WP-347 SSO.)

---

## Assumes

- WP-347 shipped: both `hankoClient.ts` export `resolveSessionCookieDomain` and
  set `cookieDomain` on production hosts.
- The broker session cookie is the JS-accessible `hanko` cookie (D-16002;
  `storageKey`/`authCookieName` default, not overridden).
- Both apps' `typecheck` / `test` + `pnpm -r build` exit 0.

---

## Context (Read First)

- `apps/arena-client/src/auth/hankoClient.ts` + `apps/dashboard/src/auth/hankoClient.ts`
  — `signOutCurrentSession` + `resolveSessionCookieDomain` (WP-347).
- `node_modules/.../@teamhanko/hanko-frontend-sdk/dist/sdk.modern.js` —
  `removeAuthCookie(){ O.remove(this.authCookieName) }` (the bug being worked
  around; `setAuthCookie` DOES use the domain).
- `docs/ai/DECISIONS.md` D-16002 (cookie name `hanko`, JS-accessible),
  D-24137 (WP-347 cross-subdomain cookie).

---

## Non-Negotiable Constraints

- Clear the cookie in the **shared wrapper** (`signOutCurrentSession`), applied
  **identically** to both apps — not scattered in each caller.
- Use the SAME domain rule as WP-347 (`resolveSessionCookieDomain`); also emit a
  bare host-scoped clear (legacy host cookie / dev/preview where no parent
  domain applies).
- The clear runs in `finally` so a rejected `logout()` still completes the local
  sign-out; the rejection still propagates to the caller (unchanged surface).
- Guard `typeof document/window === 'undefined'` (SSR/test-without-jsdom safety).
- No public-signature change; no server/engine change; cookie **name** stays
  `hanko`.

---

## Reserves

- **D-24140** — sign-out must explicitly expire the `Domain`-scoped `hanko`
  cookie because `hanko-frontend-sdk@2.6.0` `removeAuthCookie()` ignores
  `cookieDomain`; the workaround (`clearHankoSessionCookie` in the shared
  wrapper) is load-bearing for WP-347 and must NOT be removed until the SDK
  fixes the deletion (re-verify on any `@teamhanko/*` bump).

---

## Scope (In)

### `apps/arena-client/src/auth/hankoClient.ts` + `apps/dashboard/src/auth/hankoClient.ts` — modified (both, identical)
- Add `clearHankoSessionCookie()`: no-op when `document`/`window` are absent;
  else write an expiry for `hanko` (`path=/; max-age=0; expires=epoch`) with
  `domain=<resolveSessionCookieDomain(hostname)>; secure` when a parent domain
  applies, plus a bare host-scoped expiry. `// why:` documenting the SDK bug.
- Wrap `signOutCurrentSession`'s `hanko.logout()` in `try { … } finally {
  clearHankoSessionCookie(); }`. `// why:` (WP-348).

### Tests — `apps/arena-client/.../hankoClient.test.ts` — modified
- Import `../testing/jsdom-setup`; assert `signOutCurrentSession` clears a set
  `hanko` cookie, and clears it **even when `logout()` rejects** (finally).
- (Dashboard has no jsdom and its code is byte-identical to arena-client's — the
  shared logic is proven there; its existing logout test still passes via the
  no-`document` guard.)

---

## Out of Scope

- No change to `resolveSessionCookieDomain` / WP-347 set-path.
- No server / engine / registry change.
- No cookie-name / `storageKey` / `cookieSameSite` change.
- No new jsdom infra in the dashboard (disproportionate for byte-identical code).

---

## Files Expected to Change

- `apps/arena-client/src/auth/hankoClient.ts` + `.test.ts` — **modified**.
- `apps/dashboard/src/auth/hankoClient.ts` — **modified**.
- `docs/ai/DECISIONS.md` (D-24140) / `WORK_INDEX.md` / `EC_INDEX.md` /
  `STATUS.md` / `05-ROADMAP-MINDMAP.md` — **modified** — governance.

No other files may be modified.

---

## Acceptance Criteria

- [ ] `signOutCurrentSession` clears the `hanko` cookie (arena-client test) and
      clears it even when `logout()` rejects.
- [ ] Both wrappers changed identically; the clear uses `resolveSessionCookieDomain`.
- [ ] `typeof document === 'undefined'` guard present (dashboard test — no jsdom —
      still passes).
- [ ] arena-client + dashboard `typecheck` / `test` + `pnpm -r build` exit 0.
- [ ] No files outside the allowlist modified.

---

## Verification Steps

```pwsh
pnpm -r build                                              # 0
pnpm --filter @legendary-arena/arena-client typecheck      # 0
pnpm --filter @legendary-arena/arena-client test           # +2 sign-out cookie tests
pnpm --filter @legendary-arena/dashboard typecheck         # 0
pnpm --filter @legendary-arena/dashboard test              # unchanged, green
git diff --name-only                                       # only the allowlist
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** after deploy, on
      `play.legendary-arena.com` click "Sign out" → the header returns to
      "Sign in", the `hanko` cookie is gone (DevTools → Application → Cookies),
      and a reload does not re-authenticate. Evidence captured.
- [ ] All acceptance criteria pass; both apps + `pnpm -r build` 0.
- [ ] STATUS / DECISIONS (D-24140 Active) / WORK_INDEX (WP-348) / EC_INDEX
      (EC-378) / mindmap updated.

---

## Lane note (D-24028)

Standard lane — production auth behavior, two apps — but a tightly-scoped
regression fix (one helper + a `finally` per app, + arena-client tests).
