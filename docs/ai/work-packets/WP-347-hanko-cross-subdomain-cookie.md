# WP-347 — Cross-subdomain Hanko session cookie (`.legendary-arena.com`)

**Status:** Ready
**Primary Layer:** Client (`apps/arena-client` + `apps/dashboard`)
**Dependencies:** WP-160 (arena-client Hanko wrapper), WP-241 (dashboard Hanko wrapper)
**User-Visible Surface:** play.legendary-arena.com + dashboard.legendary-arena.com (auth behavior)

> Enables single sign-on across `*.legendary-arena.com`. A player/operator who
> signs in on one subdomain is signed in on the others. Observable (session
> shared), so the D-24026 gate applies. This is the **enabler** for the
> marketing-site username feature (marketing WP-033) — but is a standalone,
> useful auth improvement on its own.

---

## Session Context

WP-160 built the arena-client Hanko wrapper (`auth/hankoClient.ts`); WP-241
mirrored it for the dashboard. Both call the SDK `register()` with only
`{ sessionCheckInterval }`, so per **D-16002** the JS-readable `hanko` session
cookie keeps the SDK's default **host-scoped** domain — a sign-in on
`play.legendary-arena.com` writes a cookie for `play.legendary-arena.com` that
`dashboard.` and `www.` cannot read. This packet amends that to scope the cookie
to the parent domain on production hosts.

---

## Goal

On a production `*.legendary-arena.com` host, both Hanko wrappers pass
`cookieDomain: '.legendary-arena.com'` to `register()`, so the `hanko` session
cookie is shared across subdomains (SSO). On non-production hosts (`localhost`,
`*.pages.dev`) the wrappers omit `cookieDomain` and keep the default host-scoped
cookie — a browser drops a `Set-Cookie` for a domain the page is not under, so
forcing the parent domain there would break sign-in.

---

## User-Visible Impact

A player who signs in on `play.legendary-arena.com` is also signed in on
`dashboard.legendary-arena.com` (and, once marketing WP-033 ships, greeted by
name on `www.`). Existing users **re-sign-in once** to replace their host-scoped
cookie with the parent-scoped one. Dev (`localhost`) and the Cloudflare Pages
preview (`*.pages.dev`) are unchanged.

---

## Assumes

- `@teamhanko/hanko-elements@2.6.0` `RegisterOptions` includes `cookieDomain?: string`
  (verified) and `register(api, options?)`.
- `apps/arena-client/src/auth/hankoClient.ts` + `apps/dashboard/src/auth/hankoClient.ts`
  each have a `defaultProductionFactory` calling `register(tenantBaseUrl, options)`
  and a `__hankoFactory` test seam (so the production branch never runs under test).
- `pnpm -r build`, both apps' `typecheck` + `test` exit 0.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` **D-16002** (token storage = broker default cookie,
  JS-readable; "the broker owns cookie attribute decisions … `cookieDomain`") —
  this packet amends the default-domain stance.
- `apps/arena-client/src/auth/hankoClient.ts` + `apps/dashboard/src/auth/hankoClient.ts` —
  the `defaultProductionFactory` register call is the only production change.
- `docs/ai/ARCHITECTURE.md §Layer Boundary` — client-only; no server/engine change.

---

## Non-Negotiable Constraints

- The `cookieDomain` is set **only** on `*.legendary-arena.com` hosts (and the bare
  apex) — never on `localhost` / `*.pages.dev` (would drop the cookie, breaking
  sign-in there). Suffix check must require the leading dot (`.legendary-arena.com`)
  so a look-alike host (`evil-legendary-arena.com`) does NOT match.
- The host read (`window.location.hostname`) happens **only in the production
  factory**, which tests never execute (they inject `__hankoFactory`). No
  `window` access at module scope.
- No change to `initializeHankoClient`'s public signature, `HankoClientInitOptions`,
  or the wrapper's external surface — only the internal register options.
- No server / engine / registry change; no import of `apps/server/**`.
- Apply the **identical** change to both apps (arena-client + dashboard).

---

## Reserves

- **D-24137** — amends **D-16002**: on production `*.legendary-arena.com` hosts the
  broker session cookie is scoped to `.legendary-arena.com` (parent domain) so a
  single sign-in is shared across play / dashboard / www (cross-subdomain SSO);
  non-production hosts keep the default host-scoped cookie. The token remains the
  JS-readable `hanko` cookie read via `getSessionToken()` (D-16002 otherwise intact).

---

## Scope (In)

### `apps/arena-client/src/auth/hankoClient.ts` + `apps/dashboard/src/auth/hankoClient.ts` — modified (both)
- Add an exported pure `resolveSessionCookieDomain(hostname: string): string | undefined`
  returning `'.legendary-arena.com'` when `hostname === 'legendary-arena.com'` or
  `hostname.endsWith('.legendary-arena.com')`, else `undefined`. `// why:` comment
  on the leading-dot suffix guard and the drop-on-wrong-domain rationale.
- In `defaultProductionFactory`: build `registerOptions = { ...options }`, compute
  `cookieDomain` from `window.location.hostname` via the helper (guarded by
  `typeof window === 'undefined'`), set `registerOptions.cookieDomain` when defined,
  and pass `registerOptions` to `register()`. `// why:` comment citing WP-347.

### Tests — `apps/arena-client/.../hankoClient.test.ts` + `apps/dashboard/.../hankoClient.test.ts` — modified (both)
- `resolveSessionCookieDomain`: production subdomains (play/www/dashboard) →
  `.legendary-arena.com`; bare apex → `.legendary-arena.com`; `localhost` +
  `*.pages.dev` → `undefined`; look-alike (`evil-legendary-arena.com`) → `undefined`.

---

## Out of Scope

- No `www` / marketing-site change — that is marketing WP-033 (consumes this).
- No change to the Hanko **App URL** / passkey rpID (a separate operator task).
- No `cookieSameSite` / `storageKey` / `sessionTokenLocation` change — defaults kept.
- No server-side cookie or CORS change (the server already allows the origins).
- No sign-out / session-listener behavior change.

---

## Files Expected to Change

- `apps/arena-client/src/auth/hankoClient.ts` + `.test.ts` — **modified**.
- `apps/dashboard/src/auth/hankoClient.ts` + `.test.ts` — **modified**.
- `docs/ai/DECISIONS.md` (D-24137) / `WORK_INDEX.md` / `EC_INDEX.md` /
  `STATUS.md` / `05-ROADMAP-MINDMAP.md` — **modified** — governance.

No other files may be modified.

---

## Acceptance Criteria

- [ ] Both wrappers export `resolveSessionCookieDomain` with the exact host logic;
      the production factory passes `cookieDomain` only when defined.
- [ ] `localhost`, `*.pages.dev`, and `evil-legendary-arena.com` → `undefined`.
- [ ] No `window` access outside the production factory; test seam unaffected.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` / `test` + same for
      `@legendary-arena/dashboard` all exit 0; `pnpm -r build` 0.
- [ ] No files outside `## Files Expected to Change` modified.

---

## Verification Steps

```pwsh
pnpm -r build                                              # 0
pnpm --filter @legendary-arena/arena-client typecheck      # 0
pnpm --filter @legendary-arena/arena-client test           # all pass
pnpm --filter @legendary-arena/dashboard typecheck         # 0
pnpm --filter @legendary-arena/dashboard test              # all pass
git diff --name-only                                       # only the allowlist
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** after deploy, sign in on
      `play.legendary-arena.com`, then in DevTools → Application → Cookies confirm
      the `hanko` cookie's **Domain** reads `.legendary-arena.com` (not
      `play.legendary-arena.com`); confirm `dashboard.legendary-arena.com` shows
      you signed in without a fresh login. Evidence captured.
- [ ] All acceptance criteria pass; both apps typecheck/test + `pnpm -r build` 0.
- [ ] `docs/ai/STATUS.md`, `DECISIONS.md` (D-24137 Active), `WORK_INDEX.md`,
      `EC_INDEX.md`, mindmap updated.

---

## Lane note (D-24028)

Two-app client change (4 files + tests), no contract/endpoint/server change, no
cross-layer import — but it touches **production auth behavior** across two apps,
so treat as a careful standard-lane change rather than a trivial lightweight one.
