# EC-378 — Sign-out clears the Domain-scoped session cookie (Execution Checklist)

**Source:** docs/ai/work-packets/WP-348-signout-cookie-domain-clear.md
**Layer:** arena-client + dashboard (both `auth/hankoClient.ts`). **Lane:** Standard (production auth regression, two apps).

## Before Starting
- [ ] Fresh branch/worktree off `origin/main`.
- [ ] Confirm the bug: `hanko-frontend-sdk@2.6.0` `removeAuthCookie(){ O.remove(this.authCookieName) }` — no `Domain`; `setAuthCookie` uses the domain.
- [ ] Both `hankoClient.ts` already export `resolveSessionCookieDomain` (WP-347).
- [ ] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values
- Cookie name: `hanko` (D-16002 default; not overridden).
- `clearHankoSessionCookie`: `hanko=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT` — with `domain=<resolveSessionCookieDomain(hostname)>; samesite=lax; secure` when a parent domain applies, plus a bare host-scoped clear. Guard `typeof document/window === 'undefined'`.
- `signOutCurrentSession`: `try { await handle.hanko.logout(); } finally { clearHankoSessionCookie(); }`. Reserved decision: **D-24140**.

## Guardrails
- Fix in the SHARED wrapper, IDENTICAL in both apps — not per-caller.
- Same domain rule as WP-347 (`resolveSessionCookieDomain`); no cookie-name / SameSite / storageKey change; no public-signature change; no server/engine change.
- `finally` (not `catch`) so the rejection still propagates while the cookie is cleared.

## Required `// why:` Comments
- On `clearHankoSessionCookie` (the SDK `removeAuthCookie`-ignores-Domain bug).
- On the `signOutCurrentSession` `finally` (WP-348).

## Files to Produce
- `apps/arena-client/src/auth/hankoClient.ts` + `.test.ts`.
- `apps/dashboard/src/auth/hankoClient.ts`.
- Governance: `DECISIONS.md` (D-24140), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`.

## After Completing
- [ ] arena-client `typecheck` 0 / `test` (+2 sign-out cookie tests) / dashboard `typecheck` 0 / `test` green / `pnpm -r build` 0.
- [ ] `git diff --name-only` = the allowlist.
- [ ] STATUS / DECISIONS (D-24140 Active) / WORK_INDEX (WP-348 `[x]`) / EC_INDEX (EC-378 Done) / mindmap node.
- [ ] `User-Visible Surface = play + dashboard` → D-24026 operator-pending: click Sign out → header returns to "Sign in", `hanko` cookie gone, reload doesn't re-auth.

## Common Failure Smells
- Clearing without the `Domain` (the exact SDK bug — the parent cookie survives).
- Using `catch` instead of `finally` (a rejected logout would skip the clear).
- Missing the `typeof document` guard → dashboard test (no jsdom) crashes.
- Fixing only one app.
