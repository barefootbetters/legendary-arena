# EC-377 — Cross-subdomain Hanko session cookie (Execution Checklist)

**Source:** docs/ai/work-packets/WP-347-hanko-cross-subdomain-cookie.md
**Layer:** arena-client + dashboard (both `auth/hankoClient.ts`). **Lane:** Standard (production auth behavior, two apps).

## Before Starting
- [ ] Fresh branch/worktree off `origin/main`, clean.
- [ ] `@teamhanko/hanko-elements@2.6.0` `RegisterOptions.cookieDomain?: string` present.
- [ ] Both `hankoClient.ts` have a `defaultProductionFactory` calling `register(tenantBaseUrl, options)` + a `__hankoFactory` test seam.
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values
- `resolveSessionCookieDomain(hostname)`: return `'.legendary-arena.com'` iff `hostname === 'legendary-arena.com'` **or** `hostname.endsWith('.legendary-arena.com')`; else `undefined`.
- Production factory: `registerOptions = { ...options }`; set `cookieDomain` from `resolveSessionCookieDomain(window.location.hostname)` only when defined (guard `typeof window === 'undefined'`). Reserved decision: **D-24137** (amends D-16002).

## Guardrails
- `cookieDomain` set ONLY on `*.legendary-arena.com` + apex — never localhost / `*.pages.dev` (browser drops the cookie → sign-in breaks there).
- Leading-dot suffix guard (`.legendary-arena.com`) so `evil-legendary-arena.com` does NOT match.
- `window` read only inside the production factory (tests inject `__hankoFactory`; no module-scope `window`).
- No public-signature change; no `cookieSameSite`/`storageKey` change; no server/engine change.
- Apply IDENTICALLY to both apps.

## Required `// why:` Comments
- On `resolveSessionCookieDomain` (leading-dot guard + drop-on-wrong-domain).
- On the factory `cookieDomain` branch (WP-347 — cross-subdomain SSO; production-only).

## Files to Produce
- `apps/arena-client/src/auth/hankoClient.ts` + `.test.ts`.
- `apps/dashboard/src/auth/hankoClient.ts` + `.test.ts`.
- Governance: `DECISIONS.md` (D-24137), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`.

## After Completing
- [ ] `pnpm -r build` 0; both apps `typecheck` + `test` 0 (each auth suite +5 tests).
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24137 Active, amends D-16002) / WORK_INDEX (WP-347 `[x]`) / EC_INDEX (EC-377 Done) / mindmap node.
- [ ] `User-Visible Surface = play + dashboard` → D-24026 operator-pending: after deploy + re-login, the `hanko` cookie Domain reads `.legendary-arena.com` and dashboard shows signed-in without a fresh login.

## Common Failure Smells
- Setting `cookieDomain` unconditionally → breaks localhost/preview sign-in.
- Missing the leading-dot guard → look-alike-domain match.
- Reading `window` at module scope → crashes node:test.
- Changing only one app (both must match).
