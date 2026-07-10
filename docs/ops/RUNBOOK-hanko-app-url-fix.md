# Operator Runbook — Fix the Hanko Cloud App URL (Enable Production Passkeys)

**Status:** Ready for operator action. Not urgent, not a launch blocker.
**Owner:** Jeff (dashboard action — Claude cannot touch the Hanko Cloud console).
**Blast radius if done wrong:** all sign-ins (email + passkey) on `play.legendary-arena.com`. Reversible.

---

## TL;DR — Recommendation

**Edit the App URL in place. Do NOT create a new Hanko project.**

Change the Hanko Cloud project's **App URL** from
`https://legendary-arena-play.pages.dev` → `https://play.legendary-arena.com`,
then confirm one downstream env var (`HANKO_EXPECTED_AUDIENCE` on Render) still
matches the JWT `aud` the tenant issues. The tenant id does **not** change, so
`HANKO_TENANT_BASE_URL` (Render) and `VITE_HANKO_TENANT_BASE_URL` (Cloudflare
Pages, arena-client + dashboard) are **untouched**, and no client redeploy is
required for the tenant.

This is the opposite of Hanko's generic dashboard tooltip ("create a new project
instead of changing the app URL"). The reason that generic advice does **not**
apply here is in [Why edit-in-place](#why-edit-in-place-against-hankos-generic-advice)
below — in short, a new project would strand every existing account.

Do it **now** while it is cheap: production users currently *cannot* create a
passkey (see below), so there are ~zero production passkeys to orphan. The cost
of this fix only grows as passkey adoption grows.

---

## The problem, precisely

Hanko's **App URL** is one dashboard field that drives **three** things at once:

| Derived value | Source | Consequence |
|---|---|---|
| WebAuthn **rpID** | App URL **host** | Every passkey is cryptographically bound to this rpID |
| Allowed WebAuthn / CORS **origins** | App URL (full) | Which origins may talk to the tenant |
| JWT **`aud`** claim | App URL host (Hanko Cloud default) | What downstream verifiers must expect |

Because the App URL host is `legendary-arena-play.pages.dev`, the rpID is
`legendary-arena-play.pages.dev`. A WebAuthn credential can only be used on an
origin whose registrable domain matches its rpID, so:

- A passkey created under rpID `legendary-arena-play.pages.dev` **cannot** be
  used on `https://play.legendary-arena.com` (different registrable domain), and
- A user on `play.legendary-arena.com` **cannot even register** a passkey — the
  browser rejects it at the WebAuthn layer because the origin doesn't match the
  rpID/allowed-origins derived from the App URL.

**Why nobody has noticed:** email-passcode login is a bearer-code flow, **not**
rpID-bound. It keeps working regardless of the App URL, which masks the fact that
passkeys are structurally broken on the production domain. (Source: WebAuthn
rpID binding — <https://web.dev/articles/webauthn-rp-id>; Hanko App URL → rpID /
`aud` — <https://docs.hanko.io/guides/session-management>,
<https://docs.hanko.io/community-support/troubleshoot>.)

---

## Why edit-in-place (against Hanko's generic advice)

Hanko's "create a new project" tooltip is written for the common dev→prod case:
you built against `localhost`, and when you go live you want a clean production
tenant and are willing to abandon the dev tenant's throwaway users. **That is not
our situation:**

1. **The `pages.dev` project already IS the production tenant.** Real people sign
   in on `play.legendary-arena.com` today (via email passcode) and have real
   `legendary.players` rows.
2. **A new tenant strands every existing account.** Per **D-9902**, each account
   stores Hanko's per-tenant `sub` claim as `authProviderId`, and login resolves
   the account via `findAccountByAuthProviderSub`. A **new** Hanko tenant issues
   **new** `sub` values for the same emails, so every existing account would fail
   to resolve on next login — orphaning handles, profiles, replay ownership, and
   competitive scores keyed on `AccountId`. That is *far* more destructive than
   the passkey re-binding we're trying to fix.
3. **Edit-in-place preserves all of that.** Same tenant → same `sub` values →
   every `sub`↔account mapping intact → email login keeps working. The only thing
   an in-place edit "destroys" is passkeys bound to the old `pages.dev` rpID — and
   that set is **~empty in production** because production users can't create one
   today (point above). We are re-scoping a near-empty set.

Editing the App URL **is** technically supported in Hanko Cloud ("You can change
both values later" — <https://github.com/teamhanko/docs/blob/main/setup-hanko-cloud.mdx>).
The tooltip's caution is about the *consequences* (orphaned passkeys, changed
`aud`), which we handle explicitly in the procedure — not about the field being
locked.

---

## The one real risk: the `aud` coupling

The server session verifier **rejects any token whose `aud` does not include
`HANKO_EXPECTED_AUDIENCE`** (`invalid_token`) — see
[`apps/server/src/auth/hanko/hankoVerifier.logic.ts`](../../apps/server/src/auth/hanko/hankoVerifier.logic.ts)
(`payload.aud.includes(config.expectedAudience)`), configured per **D-12602**.

Hanko Cloud's documented default is `aud` = **App URL host**. So if this tenant
uses the default, changing the App URL to `play.legendary-arena.com` changes the
`aud` of newly-issued tokens to `play.legendary-arena.com`, and
`HANKO_EXPECTED_AUDIENCE` on Render **must be updated to match** or *all* logins
(email and passkey) break.

**We cannot read the live value from the repo** — `HANKO_EXPECTED_AUDIENCE` is
`sync: false` (set only in the Render dashboard), and the `.env.example`
placeholder (`legendary-arena`) may or may not be the live value. But we know one
thing for certain: **email login works today**, so whatever is set on Render right
now already matches the `aud` Hanko issues under the current (`pages.dev`) App URL.
That gives us a clean before/after test (Steps 0b → 2 below): decode a real JWT
before and after the edit and compare `aud`.

Two possible outcomes, both handled:
- **`aud` tracks the App URL host** (Hanko default) → after the edit, set
  `HANKO_EXPECTED_AUDIENCE=play.legendary-arena.com` on Render.
- **`aud` is a fixed custom audience** (e.g. `legendary-arena`, independent of the
  App URL) → no Render change needed.

Don't guess which — the JWT `aud` decode tells you.

---

## Procedure

### Phase 0 — Baseline (before touching anything)

- **0a. Confirm passkey usage.** Hanko Cloud dashboard → this project → users /
  credentials. Confirm how many users have a passkey, and whether any are bound to
  a non-`pages.dev` rpID. Expectation: near-zero, all (if any) bound to
  `pages.dev`. A low/zero count is the green light — record it.
- **0b. Capture the current `aud`.** Sign in on `play.legendary-arena.com` (email
  passcode), grab the session JWT (the Hanko session cookie, or the `Authorization:
  Bearer` header the SPA sends to `api.legendary-arena.com`), and decode the
  payload (e.g. paste into jwt.io, or `atob` the middle segment). **Record the
  `aud` value.** Also record the current Render `HANKO_EXPECTED_AUDIENCE`. They
  must be consistent — that's your "known-good" reference.

### Phase 1 — Change the App URL

- **1. Hanko Cloud dashboard → project Settings → App URL:**
  set to `https://play.legendary-arena.com`.
  - If you want the `pages.dev` preview to keep working for staging AND Hanko
    supports multiple allowed origins on this project, add
    `https://legendary-arena-play.pages.dev` as an additional allowed origin.
    (Hanko's multi-origin support per project is not clearly documented — if it's
    single-origin, accept that preview-URL passkeys break; email still works.)
- **2. Capture the new `aud`.** Sign in again on `play.legendary-arena.com` (email
  passcode still works — it isn't rpID-bound), decode a **fresh** JWT, record the
  new `aud`.

### Phase 2 — Reconcile the audience (only if `aud` changed)

- **3.** Compare Step 2 `aud` vs Step 0b `aud`:
  - **Changed** (e.g. now `play.legendary-arena.com`): Render dashboard →
    `legendary-arena` service → Environment → set
    `HANKO_EXPECTED_AUDIENCE` = the new `aud` value → save (Render redeploys the
    server automatically). The server is fail-closed on Hanko config, so it will
    come back up validating against the new audience.
  - **Unchanged** (custom audience): no Render change.
- **4. No tenant re-point.** `HANKO_TENANT_BASE_URL` (Render) and
  `VITE_HANKO_TENANT_BASE_URL` (CF Pages — arena-client **and** dashboard) stay as
  they are: the tenant id is unchanged, so the base URL and JWKS endpoint are
  unchanged. No arena-client or dashboard rebuild is needed for this fix.

### Phase 3 — Verify the fix

- **5.** `play.legendary-arena.com`: email-passcode login still succeeds (proves
  JWKS + `aud` still validate end-to-end after the change).
- **6. The actual fix:** on `play.legendary-arena.com`, register a **new** passkey
  → it should now **succeed** (rpID is now `play.legendary-arena.com`). Sign out,
  then sign in with that passkey → success. This is the confirmation that passkeys
  work on the production domain.
- **7.** `dashboard.legendary-arena.com`: operator login still works (same tenant,
  WP-241). If the operator uses a passkey there, note it's on a different host — if
  operator passkeys matter, register a fresh one under the new rpID too.

### Rollback

Revert the App URL to `https://legendary-arena-play.pages.dev` and revert
`HANKO_EXPECTED_AUDIENCE` to the Step 0b value. Any passkey created under the
`play.*` rpID during the change window becomes orphaned, but email login is
immediately restored. Small, well-understood blast radius.

---

## Env-var / config change matrix

| What | Where | Change? |
|---|---|---|
| **App URL** | Hanko Cloud dashboard | **YES** → `https://play.legendary-arena.com` |
| `HANKO_EXPECTED_AUDIENCE` | Render (`sync:false`) | **MAYBE** — set to the new `aud` iff `aud` tracks the App URL host (verify via JWT decode) |
| `HANKO_TENANT_BASE_URL` | Render (`sync:false`) | **NO** — same tenant id |
| `VITE_HANKO_TENANT_BASE_URL` | CF Pages — arena-client | **NO** — same tenant id |
| `VITE_HANKO_TENANT_BASE_URL` | CF Pages — dashboard | **NO** — same tenant id |
| boardgame.io server CORS `origins` | `apps/server/src/server.mjs` | **NO** — already lists `https://play.legendary-arena.com` |

Note the tenant base URL only changes if you take the (rejected) new-project path.

---

## Appendix — Why NOT a new project (auditable rejection)

If you created a new Hanko project instead, this is the full cost, so the decision
is on the record:

- **New tenant id → new base URL.** Re-point `HANKO_TENANT_BASE_URL` (Render),
  `VITE_HANKO_TENANT_BASE_URL` (CF Pages arena-client **and** dashboard), and the
  JWKS endpoint; redeploy server + both SPAs (VITE vars are build-time inlined).
- **New API key / tenant secrets** to provision.
- **Account stranding (the dealbreaker).** New tenant → new `sub` per user →
  existing `legendary.players.auth_provider_id` values (D-9902) no longer resolve
  → existing accounts, handles, profiles, replay ownership, and competitive scores
  are orphaned unless you build an email-keyed re-linking migration that the
  identity layer does not have today.
- **All the same passkey re-registration** as edit-in-place (passkeys never
  migrate across rpIDs anyway).

Edit-in-place achieves the same passkey outcome with **none** of the account
stranding and **no** client re-point. That's why it wins here.

---

## Sources

- Hanko App URL → rpID / origins / `aud`: <https://docs.hanko.io/guides/session-management>, <https://docs.hanko.io/community-support/troubleshoot>
- App URL is editable after creation: <https://github.com/teamhanko/docs/blob/main/setup-hanko-cloud.mdx>
- WebAuthn rpID binding rule: <https://web.dev/articles/webauthn-rp-id>
- New project = new tenant/base URL: <https://www.hanko.io/updates/custom-domains>, <https://docs.hanko.io/passkey-api/example-implementation>
- Internal: **D-9902** (Hanko `sub` → `authProviderId`), **D-12602** (`HANKO_EXPECTED_AUDIENCE` / verifier config), **D-16010** (`VITE_HANKO_TENANT_BASE_URL`), **WP-241** (dashboard uses the same tenant).
