# Domains & Subdomain Runbook

**Purpose:** Authoritative map of every `legendary-arena.com` subdomain — what
it serves, where it's hosted, what infra config depends on it, and what to do
when a probe fails.

The machine-readable companion is [`domains.json`](./domains.json). The smoke
test [`scripts/check-subdomains.mjs`](../../scripts/check-subdomains.mjs) reads
that file and probes each entry. On failure, it prints the anchor below
(e.g., `docs/ops/DOMAINS.md#api`) so the operator lands on the right section.

This document is operational, not architectural. It is **subordinate to**
`docs/ai/ARCHITECTURE.md` and the rules under `.claude/rules/`. It does not
define new architectural boundaries.

---

## Overview

| Subdomain | Purpose | Host | Source | State |
|---|---|---|---|---|
| `legendary-arena.com` (apex) | Redirect to `www.` | Cloudflare zone Redirect Rule | redirect rule | live (since 2026-05-09, WP-006 lock; 301 → `www.`) |
| `www.legendary-arena.com` | Marketing site | Cloudflare Pages | `C:\www\legendary-arena-com` (Hugo) | live (since 2026-05-09, WP-006 lock) |
| `play.legendary-arena.com` | Game client | Cloudflare Pages | [apps/arena-client](../../apps/arena-client) | live |
| `cards.legendary-arena.com` | Registry viewer | Cloudflare Pages | [apps/registry-viewer](../../apps/registry-viewer) | live (migrated 2026-07-16; legacy `cards.barefootbetters.com` 301-redirects here) |
| `wiki.legendary-arena.com` | Public player wiki | Cloudflare Pages | TBD (separate Hugo site) | planned |
| `ewiki.legendary-arena.com` | Private engineering wiki | Cloudflare Worker + Access | [apps/wiki-viewer](../../apps/wiki-viewer) (Hugo build of [wiki/](../../wiki)); Worker `legendary-arena-wiki` (D-24690) | live, gated |
| `legendary-arena-wiki.onrender.com` | Retired Render origin of the eng wiki — must 404 (it was an Access bypass) | Render (service deleted 2026-10-11) | none — retired by D-24690 | live (404 since 2026-10-11; regression probe) |
| `legends.legendary-arena.com` | Public scoreboard (attract board) | Cloudflare Pages | [apps/legends-board](../../apps/legends-board) (WP-143) | live (domain since 2026-07-08; SPA shipped 2026-05-15, WP-143) |
| `api.legendary-arena.com` | Game server REST + Socket.IO | DigitalOcean droplet (proxied Cloudflare A record; Origin cert, Full strict) | [apps/server](../../apps/server) | live (on the droplet since 2026-10-12; Render 2026-05-09 to 2026-10-12) |
| `legendary-arena-server.onrender.com` | Retired Render origin of the API — must 404 | Render (suspended 2026-10-12; service deleted 2026-10-16, Phase 7) | none — not a production hostname since 2026-10-12 | live (404 since 2026-10-16; regression probe) |
| `dashboard.legendary-arena.com` | Internal admin dashboard | Cloudflare Worker + Access | [apps/dashboard](../../apps/dashboard); Worker `legendary-arena-dashboard` (D-24690) | live, gated |
| `images.legendary-arena.com` | Card image CDN | Cloudflare R2 | external | live (canonical since 2026-07-16; legacy `images.barefootbetters.com` serves the same bucket, no redirect) |

`state` legend: `live` = deployed and probed for health; `planned` = not yet
deployed (still probed by default — see verdicts below). For Cloudflare
Access-gated entries, a redirect/401 is the *healthy* response.

**Probe verdicts** (printed by [`scripts/check-subdomains.mjs`](../../scripts/check-subdomains.mjs)):

| Verdict | Meaning | Action |
|---|---|---|
| `OK` | `live` entry returned the expected status | none |
| `PENDING` | `planned` entry's hostname doesn't resolve / connect — **expected**, not deployed yet | none until you deploy it |
| `READY` | `planned` entry returned the expected status — deploy is up | flip `state` to `"live"` in [domains.json](./domains.json) |
| `FAIL` | `live` entry broken, OR `planned` entry returned an unexpected status (misconfig) | follow the per-section runbook below |

The script exits 0 unless there is at least one `FAIL`. `--live-only` skips
all planned entries (useful in CI when you only care about prod health).

---

## Per-subdomain detail

### apex
**`legendary-arena.com`** — apex domain. Live since 2026-05-09 (WP-006 lock).

Direction is locked: **apex → www**, configured as a zone-level Cloudflare
Redirect Rule on the `legendary-arena.com` zone (Rules → Redirect Rules),
NOT via Pages `_redirects` (CF Pages does not support full-URL source
patterns in `_redirects`).

Healthy response: `301`, `302`, or `308` to `https://www.legendary-arena.com/`.
The redirect target is enforced by the probe via `expectedLocation` in
[domains.json](./domains.json) — a redirect to anywhere else (wrong host,
HTTP downgrade, redirect loop) fails the row even when the status code is
in range.

Depends on: nothing. No app config consumes the apex hostname.

### www
**`www.legendary-arena.com`** — Hugo marketing site. Live since 2026-05-09
(WP-006 lock).

- **CF Pages project:** `legendary-arena-website`
- **Build:** `hugo --minify` from the marketing repo root
- **Output dir:** `public/`
- **Source:** external repo at `C:\www\legendary-arena-com` (not part of this monorepo)
- **Env:** none required for build

Healthy response: `200` with `text/html` body.

Depends on: nothing. Pure static content; no API calls from marketing pages.

### play
**`play.legendary-arena.com`** — game client SPA. Live since 2026-05-10
(WP-007a lock).

- **CF Pages project:** `legendary-arena-play`
- **Build:** `pnpm install --frozen-lockfile && pnpm --filter "@legendary-arena/arena-client..." build`
  (verbatim; the trailing `...` is pnpm's topology selector that
  builds workspace dependencies in dependency order — locked under
  WP-144 / D-14401 because the single-package filter does not build
  workspace deps and `packages/game-engine/dist/` is gitignored)
- **Output dir:** `apps/arena-client/dist/`
- **Env:** `VITE_SERVER_URL` (set to `https://api.legendary-arena.com`
  in Cloudflare Pages env vars, Production scope). Required: the
  arena-client bundles `import.meta.env.VITE_SERVER_URL` at build
  time per `apps/arena-client/src/lobby/lobbyApi.ts:14-21`; the
  `http://localhost:8000` fallback string in that file must never
  reach production. `NODE_VERSION = 22` is the only other env var
  pinned (pnpm version auto-detected from root `package.json`'s
  `packageManager: pnpm@10.32.1` field).

Healthy response: `200` with the SPA shell.

Depends on:
- `api.legendary-arena.com` (Socket.IO transport, REST endpoints under `/api/*`)
- `images.legendary-arena.com` (card images)
- The server's CORS allowlist must include `https://play.legendary-arena.com`
  AND `https://legendary-arena-play.pages.dev` (the `*.pages.dev`
  hostname is needed for build-parity verification before the custom
  domain binds, and as a stable preview-target). Both origins were
  added under EC-147 (WP-007a Step 9 errata).
- Cross-origin brand-tokens contract: arena-client consumes
  `https://www.legendary-arena.com/brand-tokens.css` cross-origin
  via `<link rel="stylesheet">` in `index.html`; bundled local
  fallback at `apps/arena-client/public/brand-tokens.local.css`
  ships byte-identical to the live URL (SHA-256 parity gate at WP
  lock time). The cascade contract is local-fallback first,
  cross-origin live URL second; live wins when reachable, fallback
  takes over invisibly under outage. Documented in
  `apps/arena-client/index.html` `<head>` comment block.

### cards
**`cards.legendary-arena.com`** — registry viewer SPA.

- **Build:** `pnpm install && pnpm registry:build && pnpm --filter registry-viewer build`
- **Output dir:** `apps/registry-viewer/dist/`
- **Env:** none — viewer is fully static and embeds registry data at build time

Healthy response: `200` with the SPA shell.

Depends on:
- `images.legendary-arena.com` (card images)
- No API. Viewer does not call the game server.

**Migration note (done 2026-07-16):** the Cloudflare Pages project named
`legendary-arena` serves this app at `cards.legendary-arena.com`. The legacy
`cards.barefootbetters.com` hostname 301-redirects here via a zone Redirect
Rule on the barefootbetters.com CF zone (path+query preserved), so old links
keep working.

### wiki
**`wiki.legendary-arena.com`** — public player help wiki.

- **Build:** `hugo --minify` (from wherever the public wiki source lives)
- **Output dir:** `public/`

Healthy response: `200`.

Depends on: nothing.

**Status:** content not yet authored. The Pages project should not be created
until there is something to deploy, otherwise the URL serves a 404 placeholder
that confuses anyone who clicks it.

### ewiki
**`ewiki.legendary-arena.com`** — private engineering wiki, gated. Live since 2026-05-08; on a Cloudflare Worker since the D-24690 cutover.

- **Source:** [wiki/](../../wiki) markdown files
- **Renderer:** [apps/wiki-viewer](../../apps/wiki-viewer) — Hugo + Pagefind build, served by the assets-only Cloudflare Worker `legendary-arena-wiki` ([`apps/wiki-viewer/wrangler.jsonc`](../../apps/wiki-viewer/wrangler.jsonc), D-24690)
- **Deploy:** the `deploy` job in [`.github/workflows/wiki-viewer.yml`](../../.github/workflows/wiki-viewer.yml), on push to `main` (wiki paths) or **Actions → wiki-viewer → Run workflow** on `main`. It ships the build job's gated artifact as-is with `wrangler deploy`. Needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets. If Actions can't deploy, see [Manual deploy fallback](#manual-deploy-fallback).
- **Gate:** Cloudflare Zero Trust Access application on the hostname (Free tier, One-time PIN identity provider). It is hostname-based, so it did not change when the origin moved from Render to the Worker.
- **One door only.** The Worker sets `workers_dev: false` and `preview_urls: false`, so it has no `*.workers.dev` or preview hostname. The custom domain is the only way in. Keep both `false`: turning either on recreates the bypass this move removed. (Before D-24690, Render also served the wiki at `legendary-arena-wiki.onrender.com` with no gate — observed `200` with full content on 2026-10-05 and 2026-10-11.)

**Healthy response (unauthenticated):** `302` to a `*.cloudflareaccess.com`
login URL, or `401`/`403`. **A `200` here is a failure** — it means the
Access application is missing or disabled and the engineering wiki is
publicly readable. The redirect target is enforced by the probe via
`expectedLocation: "https://legendary-arena.cloudflareaccess.com/"` in
[domains.json](./domains.json) — a `302` to anywhere else fails the row.

**Retired origin.** `legendary-arena-wiki.onrender.com` must return `404`
(Render answers `404` for a deleted service). Its row in
[domains.json](./domains.json) is a regression probe: a `200` there means the
old Render service still exists and serves the wiki without Access — delete
it.

**Cutover from Render (D-24690, done 2026-10-11).** Kept as the record and
the rebuild runbook. Steps 1–3 come before the merge, which triggers the deploy.
1. **API token.** Cloudflare → Manage Account → **Account API tokens** →
   Create Token → **Edit Cloudflare Workers** template; account resources:
   this account; zone resources: only `legendary-arena.com` (the deploy
   attaches the `ewiki.` / `dashboard.` custom domains). An account-owned
   token suits CI: it is not tied to a person's login. In GitHub → Settings →
   Secrets and variables → Actions, add secrets `CLOUDFLARE_API_TOKEN` (the
   token) and `CLOUDFLARE_ACCOUNT_ID`. If the first deploy fails with an auth
   error on the custom-domain step, use a user token instead (My Profile →
   API Tokens, same template and scope).
2. **Confirm the Access application** for `ewiki.legendary-arena.com` exists
   and is enabled (Zero Trust → Access → Applications). It is reused as-is.
3. **Remove the old record.** Cloudflare DNS for `legendary-arena.com` →
   delete the `ewiki` CNAME to Render. A Worker custom domain cannot be
   created while another record exists for the hostname. The ewiki is down
   from here until step 4 finishes (a few minutes).
4. **Merge** (or, if already merged, Actions → wiki-viewer → Run workflow on
   `main`). The deploy job creates the custom domain, its DNS record and
   certificate.
5. **Verify.** From an incognito browser, `https://ewiki.legendary-arena.com`
   redirects to `*.cloudflareaccess.com`; after the email OTP the wiki and
   its search load. `pnpm check:domains` shows `ewiki` `OK`.
6. **Retire Render.** Render → `legendary-arena-wiki` → Settings → **Delete
   Static Site** (removing it from `render.yaml` does not delete it). Remove
   the `RENDER_WIKI_DEPLOY_HOOK` repo secret. Then `pnpm check:domains`
   should show the onrender.com row `READY`; flip it to `"live"` in
   [domains.json](./domains.json).

What actually happened (2026-10-11): the old `ewiki` CNAME pointed at the
**game server's** Render host (`legendary-arena-server.onrender.com`), not
the wiki service's — which is why Render listed the wiki's custom domain as
"Waiting for DNS" and its subdomain toggle never took effect (#2603). The
first deploy uploaded the Worker but failed to attach the domain ("already
has externally managed DNS records", code 100117) because step 3 had not
run yet; after the records were deleted, re-running the failed job attached
it. For a minute or two after the domain attached, two probes got `200`
instead of the Access redirect before Access applied to the new hostname;
every probe since redirects. The Render service was deleted the same day.

**Gate-before-expose still applies to any rebuild:** create (or confirm) the
Access application for the hostname before the Worker's custom domain
exists.

### dashboard
**`dashboard.legendary-arena.com`** — internal admin dashboard, gated. Live since 2026-06-02; on a Cloudflare Worker since the D-24690 cutover.

- **Source:** [apps/dashboard](../../apps/dashboard)
- **Renderer:** Vite SPA, served by the assets-only Cloudflare Worker `legendary-arena-dashboard` ([`apps/dashboard/wrangler.jsonc`](../../apps/dashboard/wrangler.jsonc), SPA fallback; [`public/_headers`](../../apps/dashboard/public/_headers) applies unchanged)
- **Deploy:** [`.github/workflows/dashboard-deploy.yml`](../../.github/workflows/dashboard-deploy.yml) on every push to `main` (the cadence of the Pages Git integration it replaced) or **Actions → dashboard-deploy → Run workflow**. It runs `pnpm --filter "@legendary-arena/dashboard..." build`, then `wrangler deploy`. Lint, typecheck and tests stay in `ci.yml` (Dashboard Gates). If Actions can't deploy, see [Manual deploy fallback](#manual-deploy-fallback).
- **Gate:** Cloudflare Zero Trust Access application on the hostname (Free tier, Self-hosted application, Email One-time PIN identity provider, single-operator allow rule on `jeff@barefootbetters.com`). Hostname-based, so it carried over from Pages unchanged.
- **One door only.** `workers_dev: false` and `preview_urls: false`, so there is no `*.workers.dev`, preview, or `pages.dev` hostname. Keep both `false`. (Before D-24690 the Pages project also served `legendary-arena-dashboard.pages.dev` and `<hash>.legendary-arena-dashboard.pages.dev` without Access — the production alias since 2026-06-02.)
- **App sign-in:** Hanko ([`LoginPage.vue`](../../apps/dashboard/src/pages/auth/LoginPage.vue), WP-241), behind the Access gate. Live `/api/dash/*` routes on `api.legendary-arena.com` require an admin session and return `401` without one. The API's CORS allowlist has the custom domain only (and `localhost:4173` for local dev).
- **Build env (set in the workflow):** live mode — `VITE_USE_MOCKS=false`, `VITE_API_BASE_URL=https://api.legendary-arena.com`, `VITE_HANKO_TENANT_BASE_URL` from `DASHBOARD_HANKO_TENANT_BASE_URL`, a repo variable or secret (the build refuses to run without it), `VITE_FEATURE_FLAGS` from `DASHBOARD_FEATURE_FLAGS` (optional, variable or secret). The live/mock switch is `isLiveModeEnabled()` (D-20601): live only when `VITE_USE_MOCKS !== 'true'` and `VITE_API_BASE_URL` is non-empty. See [`apps/dashboard/.env.example`](../../apps/dashboard/.env.example) for the full variable list. (Launched 2026-06-02 in mock mode per D-19702; real-data wiring landed in later WPs, starting with WP-373's billing + revenue routes.)

**Healthy response (unauthenticated):** `302` to a `*.cloudflareaccess.com`
login URL, or `401`/`403`. **A `200` here is a failure** — it means the
Access application is missing and the live operator dashboard is publicly
reachable, with the server's admin-session check as the only layer in front
of live business data. The redirect target is enforced by the probe via
`expectedLocation: "https://legendary-arena.cloudflareaccess.com/"` in
[domains.json](./domains.json) — a `302` to anywhere else fails the row.
This is the canonical **Gate-before-expose** rule (WP-197 / EC-223): the
Access application exists before the hostname serves anything.

**Cutover from Pages (D-24690, done 2026-10-11).** Uses the same API token and
secrets as the ewiki cutover (step 1 there). Do steps 1–2 before merging.
1. **Repo variable or secret.** GitHub → Settings → Secrets and variables →
   Actions (either tab works): `DASHBOARD_HANKO_TENANT_BASE_URL` = the value of
   `VITE_HANKO_TENANT_BASE_URL` in the Pages project's Production env vars
   (Workers & Pages → `legendary-arena-dashboard` → Settings → Variables).
   If the Pages project sets `VITE_FEATURE_FLAGS`, copy it to
   `DASHBOARD_FEATURE_FLAGS`.
2. **Free the hostname.** Pages project → Custom domains → remove
   `dashboard.legendary-arena.com`; then in Cloudflare DNS delete the
   `dashboard` CNAME if it is still there. The dashboard is down from here
   until step 3 finishes (a few minutes).
3. **Merge** (or, if already merged, Actions → dashboard-deploy → Run
   workflow). The deploy creates the custom domain, its DNS record and
   certificate.
4. **Verify.** Incognito: `https://dashboard.legendary-arena.com` redirects to
   Access; after OTP, `/login` shows the Hanko sign-in; after an admin
   sign-in, `/overview` loads with `LIVE` / `CACHED` / `LOCAL` badges and no
   mock-mode banner (WP-226). A deep link such as `/coverage` loads on
   refresh (SPA fallback).
5. **Retire Pages.** Workers & Pages → `legendary-arena-dashboard` (the
   **Pages** project, not the new Worker) → Settings → **Delete project**.
   This removes `legendary-arena-dashboard.pages.dev` and every preview URL.
   Cloudflare refuses to delete a Pages project with more than 100
   deployments (this one had 5,852 by then, one per branch push; clearing them took about 70 minutes at the API rate limit); delete the
   deployments through the API first, keeping the active production one
   ([Pages known issues](https://developers.cloudflare.com/pages/platform/known-issues/)).
   The Pages API rejected an **account-owned** token with `Authentication
   error` (code 10000) even though it verified as active; a **user** token
   (My Profile → API Tokens, with Cloudflare Pages: Edit) worked. Delete
   that token afterwards. Once the project is gone the `pages.dev` hostname
   briefly answers `530` (no such project), then drops out of DNS entirely
   (`ENOTFOUND`, observed within the hour). `check:domains` has no
   "must not resolve" verdict, so its [domains.json](./domains.json) row was
   removed; nothing points at the name any more (no DNS record, no CORS
   entry).

**Real data is wired.** The launch deferred real data (D-19702), and
follow-up WPs wired the widgets to admin-session-gated `/api/dash/*`
routes, starting with billing + revenue (WP-373). Widgets show where
their data comes from with the freshness badge (`LIVE` / `CACHED` /
`LOCAL`, or `MOCK` in a mock build). A `MOCK` badge or the mock-mode
banner on the production dashboard means the deploy env has drifted
back to mock mode; check the build env above. (The net-revenue chart's
`MOCK` deduction placeholder is intentional, per D-19602.)

### legends
**`legends.legendary-arena.com`** — public, no-auth scoreboard ("Hall of Legends" attract board). SPA shipped 2026-05-15 (WP-143); custom domain live since 2026-07-08.

- **CF Pages project:** `legendary-arena-legends`
- **Source:** [apps/legends-board](../../apps/legends-board) (WP-143, done 2026-05-15)
- **Build:** Vite SPA, Cloudflare Pages
- **Data source:** R2 JSON snapshots written by the publisher in `apps/server/src/legends/` (WP-142, done 2026-05-14). The leaderboards do **not** hit `api.legendary-arena.com`; the one exception is the `#/match/<id>` result panel and its download, which call `GET /api/match/:id/result-lagn` (WP-407/408, `VITE_LEGENDS_API_BASE_URL`).

Healthy response: `200` with the SPA shell.

Depends on:
- R2 snapshot bucket (public-read prefix `legends/v1/*`) populated by WP-142
- `images.legendary-arena.com` (hero/scheme art)

**Why R2 snapshots, not direct API:** decouples public scoreboard availability from game-server uptime, prevents anonymous traffic from hitting the prod Postgres, and gives Cloudflare's CDN something it can cache aggressively. A viral moment on the scoreboard must not become a game-server incident.

**Snapshot freshness is its own check** — the publisher writes a `legends/v1/manifest.json` with `generatedAt` and the SPA renders a "last updated" badge. A stale manifest is the signal that the publisher (not the SPA) is unhealthy. See WP-142.

### api
**`api.legendary-arena.com`** (live since 2026-05-09) — game server. Since
the 2026-10-12 cutover it runs on a self-hosted DigitalOcean droplet;
**`legendary-arena-server.onrender.com`** (the Render origin until then) is
retired; the Render service and database were deleted on 2026-10-16 (Phase 7).

- **Source:** [apps/server](../../apps/server)
- **Host:** DigitalOcean droplet (Ubuntu 24.04, `sfo3`). Cloudflare record
  `api` is a **proxied A record** to the droplet. Nginx terminates TLS with a
  Cloudflare Origin Certificate; the api hosts run SSL **Full (strict)** through
  a Configuration Rule while the rest of the zone stays on Full. The server is
  the systemd unit `la-server` (logs: `journalctl -u la-server`). Provisioning,
  deploys (`40-app-deploy.ps1`, run by `deploy-server.yml` after CI passes on
  main, D-24708, or by hand), backups and monitoring live in the
  `legendary-arena-lab` repo; see the ewiki
  [Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md).
- **Probe path:** `/health`
- **Database:** PostgreSQL 18 on the same droplet, `localhost` only (not
  internet-reachable)

**Healthy response:** `200` with a small JSON or text body from the health route.

**Retired Render origin.** `legendary-arena-server.onrender.com/health` must
return `404` (Render answers `404` for a deleted service; deleted 2026-10-16).
Its row in [domains.json](./domains.json) is a regression probe: a `200` there
means a `legendary-arena-server` service exists on Render again — delete it.
There is no Render rollback; a final dump of the Render database is kept under
`render-final/` in the production R2 bucket and pCloud.

Depends on (server-side runtime):
- PostgreSQL 18 on the droplet (`localhost`)
- Hanko tenant (`HANKO_TENANT_BASE_URL`, `HANKO_EXPECTED_AUDIENCE` envs)
- Stripe billing config (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ALLOWLIST`, `PUBLIC_BASE_URL`) — note `PUBLIC_BASE_URL` is the **client** URL Stripe Checkout redirects users to after success/cancel (see [apps/server/src/billing/billing.routes.ts:339-340](../../apps/server/src/billing/billing.routes.ts)), not an API URL.

**`api.` move to the droplet — completed 2026-10-12.** The Render service
was suspended, a read-only final dump was restored on the droplet with row
counts compared, and `api` changed from the DNS-only CNAME to Render into a
proxied A record to the droplet and joined the strict-TLS rule. Details:
[Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md#cutover-2026-10-12).

**`api.` cutover to Render (history) — completed 2026-05-09. The full procedure was:**
1. Add Cloudflare CNAME `api` → `legendary-arena-server.onrender.com` in the `legendary-arena.com` zone, **DNS only (gray cloud)**. Cloudflare proxying breaks Render's Let's Encrypt cert provisioning and disrupts long-lived Socket.IO connections on the Free tier.
2. Add `api.legendary-arena.com` as a custom domain in Render's dashboard. Leave "Render Subdomain" enabled so the onrender.com URL keeps working in parallel.
3. Wait for Render to issue the Let's Encrypt cert (1-5 minutes typical).
4. Verify with `pnpm check:domains` — entry reports `READY`, then flip `state` to `"live"` in [domains.json](./domains.json).

**Updates that are NOT part of the `api.` cutover** (despite being on a previous draft of this runbook — that was wrong):

- **`PUBLIC_BASE_URL`** points at the **client**, not the API. It controls Stripe Checkout success/cancel redirects, which need to land on a page the user can see. **Updated 2026-05-10** from `https://legendary-arena-server.onrender.com` to `https://play.legendary-arena.com` once WP-007a locked the `play.` deploy (see Render dashboard env vars; redeploy completed cleanly with all startup probes green). Stripe Checkout success/cancel redirects now land on the live arena-client SPA per `apps/server/src/billing/billing.routes.ts:339-340`. Note: `.env.example` and test fixtures still reference `app.` per the original WP-133 plan; refresh those in a future cleanup pass when convenient.
- **Stripe webhook endpoint URL** points at the API and CAN be updated to `https://api.legendary-arena.com/<webhook-path>` now. It was optional while both hostnames served the same routes; since the Render service was deleted (2026-10-16) the onrender.com hostname serves nothing, so a webhook still pointing there is broken and must use `api.`.
- **Hanko allowed origins / audience** — only matters when a client at a new origin calls Hanko. Update when adding new client origins (e.g., `play.`), not when the API hostname changes.
- **Server CORS allowlist** — update when adding new client origins, same reason.
- **arena-client's `VITE_API_BASE_URL`** — **shipped by WP-161 (2026-05-18).** Must be set to `https://api.legendary-arena.com` in the CF Pages `legendary-arena-play` project's Production env vars. Without it, all `/api/me/*` fetches resolve to `pages.dev/api/…` and hang. Validated post-deploy by `pnpm check` → "Arena-client bundle env" probe.

### images
**`images.legendary-arena.com`** — card image CDN.

- **Host:** Cloudflare R2 with public bucket binding
- **Source:** external (BarefootBetters)
- **Probe:** root URL — bucket index returns `403` or `404`; specific image
  keys return `200`. The probe verifies DNS/TLS, not bucket contents.

Per [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md): "Card images hosted at:
`https://images.legendary-arena.com/`. Image URLs use hyphens, not underscores."

**Canonical since 2026-07-16.** The legacy `images.barefootbetters.com`
hostname is a second custom domain on the same `legendary-images` bucket and
remains live — no redirect rule; old URLs (including `avatar_url` rows
predating migration 021 and any externally cached links) keep serving.
Unlike the `cards.` migration there is nothing to cut over: both hostnames
serve identical bytes from one bucket.

---

## Cutover order of operations

The deployment migration itself is **not** a runbook entry — it's
WP-worthy because it modifies shipped infrastructure config (server CORS,
`PUBLIC_BASE_URL`, Hanko allowed origins, Stripe redirect URLs). Track that
in a future `WP-NNN: production cutover to legendary-arena.com` work packet.
The runbook's job is to verify the result, not to drive the cutover.

Suggested sequence (for WP scoping):

1. **Cloudflare DNS authority.** Move `legendary-arena.com` to Cloudflare
   nameservers if not already. Verify with `Resolve-DnsName legendary-arena.com -Type SOA`.
2. **`api.` first.** CNAME (DNS only) + Render custom domain attachment. Done
   2026-05-09. **Note:** the PUBLIC_BASE_URL / Hanko origins / Stripe webhook /
   server-CORS updates listed under this step in earlier runbook drafts do NOT
   belong here — they are coupled to *which client URL* the system points at,
   not to the API hostname rename. They land with the `play.` deploy (step 5).
3. **`cards.` migration.** Detach `cards.barefootbetters.com` from the existing
   `legendary-arena` Pages project (or keep with redirect during transition).
   Attach `cards.legendary-arena.com` to the same project. Smoke-test. Done
   2026-07-16 — legacy hostname now 301-redirects via a zone Redirect Rule
   (path+query preserved); repo references updated the same day.
4. **`www.` and apex.** Done 2026-05-09 (WP-006 lock). Pages project
   `legendary-arena-website` for the Hugo marketing repo; apex → www via a
   zone-level Cloudflare Redirect Rule (direction locked).
5. **`play.` Pages project.** New project for `apps/arena-client`. WP-007a
   landed the brand-integration + Pages deploy + custom domain bind on
   2026-05-10. **Server CORS allowlist** updated under EC-147 to include
   `https://play.legendary-arena.com` and `https://legendary-arena-play.pages.dev`.
   **`PUBLIC_BASE_URL`** updated 2026-05-10 to `https://play.legendary-arena.com`
   on the Render `legendary-arena-server` env (one-key dashboard change;
   triggered an auto-redeploy that completed cleanly). Stripe Checkout
   success/cancel redirects now land on the live arena-client SPA.
   **Still pending separate follow-up tasks**: Hanko allowed origins to
   include `play.` (only matters when arena-client adds Hanko-authenticated
   flows), Stripe webhook redirect allowlist if the Stripe dashboard webhook
   URL needs an update. Both are owned by a future server-config or
   billing-flow WP.
6. **`wiki.`** when the public Hugo wiki has content to serve.
7. **`ewiki.`** Done 2026-05-08. Configured Cloudflare Access (Zero Trust
   Free plan, Email One-time PIN, Allow policy on operator email) before
   attaching the custom domain on the `legendary-arena-wiki` service. DNS
   record proxied (orange cloud) so Cloudflare's edge can intercept.

---

## Failure runbook

Which services each hostname depends on, and what to check in order when one
is down, is the [Service Dependency Map](../../wiki/service-dependency-map.md)
(rendered from [`service-dependencies.json`](./service-dependencies.json)).
The entries below are the per-hostname probe failures.

**`apex` returns 200 instead of a redirect.** The Cloudflare redirect rule is
missing or pointing the wrong way. Re-create the rule under the zone's "Bulk
Redirects" or a Page Rule, source `legendary-arena.com/*`, target
`https://www.legendary-arena.com/$1`, status `301`.

**`www`, `play`, `cards`, `wiki` return 404.** The Pages project has no
production deployment for the attached custom domain, or the custom domain
attachment is on the wrong project. In Cloudflare Pages: confirm the project,
confirm the latest production deployment is green, confirm the custom domain
is attached to that project (not a different one).

**`ewiki` returns 200 unauthenticated.** Cloudflare Access policy is missing
or disabled. **Treat as a security incident** until corrected. Add an
Access application for the hostname and re-probe before continuing.

**`ewiki` or `dashboard` serves without a Cloudflare Access redirect.**
Either (a) the Access application's domain doesn't match the hostname
exactly, or is disabled; or (b) the Cloudflare Zero Trust plan is not
active on the account (no Access app can be created without an active
plan, even Free). Fix the misconfigured piece and re-probe. A Worker custom
domain is always proxied, so the old "DNS only" failure mode no longer
applies.

**`ewiki` or `dashboard` shows the Access login, but after auth returns a
Cloudflare error or an empty `404`.** The gate works; the Worker is not
serving. Check, in order: the latest `wiki-viewer` / `dashboard-deploy`
workflow run on `main` succeeded (a missing `CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID` secret fails it loudly); Workers & Pages → the
Worker (`legendary-arena-wiki` / `legendary-arena-dashboard`) → Settings →
Domains & Routes lists the custom domain; a deploy that failed with a "DNS
record already exists" error means the old CNAME is still there — delete it
and re-run the workflow.

**`legendary-arena-wiki.onrender.com` returns `200`.** The retired Render
service still exists and serves the wiki without Access. **Treat as a
security incident:** delete the service in Render (D-24690).

**`legendary-arena-dashboard.pages.dev` resolves and returns `200`.** The
retired Pages project still exists and serves the dashboard without Access.
**Treat as a security incident:** delete the Pages project (D-24690).

**`api.legendary-arena.com/health` returns DNS error.** The `api` record is
missing or hasn't propagated. Check Cloudflare DNS for the proxied `api` A
record to the droplet.

**`api` returns `502`/`503`/`504`, or a Cloudflare `52x` error.** The server
on the droplet is down or restarting, or Nginx can't reach it. On the droplet:
`systemctl status la-server`, `journalctl -u la-server`, and
`systemctl status postgresql` — a DB outage surfaces as 5xx on health checks
that touch the DB. A Cloudflare `526` means the origin certificate is not
accepted under Full (strict). The healthchecks.io check `la-droplet-monitor`
and UptimeRobot alert on this too. See
[`docs/ops/INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md).

**`legendary-arena-server.onrender.com` returns `200`.** A service named
`legendary-arena-server` exists on Render again (it was deleted 2026-10-16).
Delete it, and confirm `api` still points at the droplet.

**`api` returns CORS error in browser but `/health` is 200 from curl.** The
new client origin is not in the server's CORS allowlist. Update the server
config and redeploy.

**`images.legendary-arena.com` returns DNS error.** Card images will be
broken in `play` and `cards` until restored. This is upstream of this repo;
escalate to the BarefootBetters image-bucket owner.

---

## Manual deploy fallback

Use this only when GitHub Actions can't deploy (an Actions outage, or the
`wiki-viewer` / `dashboard-deploy` workflow is broken) and the ewiki or the
dashboard needs a deploy now. It runs the same build and the same
`wrangler deploy` as the workflows (D-24690), from a workstation. When Actions
works, re-run the workflow instead (**Actions → wiki-viewer / dashboard-deploy
→ Run workflow** on `main`), because it also runs the gates this path skips.

**Before either deploy** (PowerShell 7):

1. **A clean `main`.** Work in a fresh worktree of `origin/main`, never a
   feature branch. A local deploy ships whatever is in the folder.
   ```powershell
   git -C C:\pcloud\BB\DEV\legendary-arena fetch origin main
   git -C C:\pcloud\BB\DEV\legendary-arena worktree add --detach C:\claude-worktrees\legendary-arena\manual-deploy origin/main
   Set-Location C:\claude-worktrees\legendary-arena\manual-deploy
   ```
2. **Sign in to Cloudflare** as yourself: `pnpm dlx wrangler@4.149.0 login`.
   It opens the browser for an OAuth grant. Nothing to copy, and no token is
   stored in the repo. Use the same wrangler version the workflows pin.
3. **The account:** `$env:CLOUDFLARE_ACCOUNT_ID = '<account id>'`. It's the 32-hex id in the Cloudflare dashboard URL (`dash.cloudflare.com/<account id>/…`), and it's kept out of this public repo.

**ewiki** (`legendary-arena-wiki`):

1. Build exactly as the workflow's build job does. Hugo must match
   `apps/wiki-viewer/.hugo-version` (0.161.1 Extended).
   ```powershell
   node apps/wiki-viewer/scripts/project-wiki.mjs
   node apps/wiki-viewer/scripts/check-links.mjs
   hugo --source apps/wiki-viewer --minify
   pnpm dlx pagefind@1.5.2 --site apps/wiki-viewer/public
   ```
   No `pnpm install` is needed for this path. Skipped compared with CI: the
   page-count equality, determinism and JS-free gates
   (`wiki-viewer.yml`). Only use this path for content that already passed CI
   on its PR.
2. Deploy: `pnpm dlx wrangler@4.149.0 deploy --config apps/wiki-viewer/wrangler.jsonc`.
   Add `--dry-run` first to see the file count without uploading.

**dashboard** (`legendary-arena-dashboard`):

1. Install, then build with the workflow's environment. The worktree has full
   git history, which the governance-snapshot step needs.
   ```powershell
   pnpm install --frozen-lockfile
   $env:VITE_USE_MOCKS = 'false'
   $env:VITE_API_BASE_URL = 'https://api.legendary-arena.com'
   $env:VITE_HANKO_TENANT_BASE_URL = '<tenant URL>'
   pnpm --filter "@legendary-arena/dashboard..." build
   ```
   The tenant URL is the `DASHBOARD_HANKO_TENANT_BASE_URL` repo secret, which
   GitHub can't show. Read the same value from `HANKO_TENANT_BASE_URL` in the
   API droplet's `/etc/la/.env` (Render → `legendary-arena-server` →
   Environment before the 2026-10-12 cutover); it is the same tenant
   (`apps/dashboard/.env.example`). It is not confidential: it
   ships in the public bundle. Without it the login renders its
   "unavailable" state. Also set `$env:VITE_FEATURE_FLAGS` if the
   `DASHBOARD_FEATURE_FLAGS` secret/variable is set (it isn't, as of
   2026-10-11).
2. Deploy: `pnpm dlx wrangler@4.149.0 deploy --config apps/dashboard/wrangler.jsonc`.

**After either deploy:**

- `pnpm check:domains` shows the hostname `OK` (Access redirect). From an
  incognito browser, it loads after the email OTP.
- The `wrangler.jsonc` files keep `workers_dev: false` and
  `preview_urls: false`. A local deploy reads the same file, so it can't
  reopen a default hostname unless someone edited the config.
- Remove the worktree:
  `git -C C:\pcloud\BB\DEV\legendary-arena worktree remove C:\claude-worktrees\legendary-arena\manual-deploy`.
- The next successful workflow run on `main` deploys over the manual
  version, so nothing needs reconciling afterwards.

## Adding a new subdomain

1. Add an entry to [`domains.json`](./domains.json) with all required fields:
   `name`, `url`, `host`, `source`, `expectedStatus`, `state`, `anchor`. Add
   `notes` if anything is non-obvious. Optional fields:
   - `expectedLocation` — string, validated as a **prefix** against the
     response's `Location` header on any 30x response. Use when the
     entry's correctness depends on *where* the redirect points (apex
     canonicalization, Cloudflare Access gates), not just the status
     code. A mismatch downgrades the verdict from `OK` to `FAIL` and
     prints `redirect mismatch: expected prefix "…", got "…"` inline.
     Omit when the redirect target is informational only.
2. Add a section to this file with the matching anchor (lowercase, hyphenated).
3. If the new subdomain is consumed by `apps/server` (e.g., a new client
   origin), add it to the server's CORS allowlist in the same change.
4. If the new subdomain depends on the API, document it under the new
   section's "Depends on:" list.
5. Add the subdomain as a product in
   [`service-dependencies.json`](./service-dependencies.json) — its
   `domainUrl` copied exactly from `domains.json`, and every service it
   depends on with the impact if that service is down (D-24710). The ewiki
   build fails while a live, serving entry here has no product there, and the
   [Service Dependency Map](../../wiki/service-dependency-map.md) renders from it.
6. Run `pnpm check:domains` to confirm the script parses the manifest and
   reports `PENDING` (DNS not yet resolving) for the new entry.
7. Once the deploy is up, the next probe should report `READY`. Flip
   `state` to `"live"` in [domains.json](./domains.json) — the next probe
   will then report `OK` and any future regression is treated as `FAIL`.

---

## Related documents

- [`docs/08-DEPLOYMENT.md`](../08-DEPLOYMENT.md) — high-level deployment overview
- [`docs/ops/DEPLOYMENT_FLOW.md`](./DEPLOYMENT_FLOW.md) — environments and promotion
- [`docs/ops/INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md) — incident handling
- [`service-dependencies.json`](./service-dependencies.json) — which services
  each product depends on; rendered as the ewiki
  [Service Dependency Map](../../wiki/service-dependency-map.md) (D-24710)
- [`render.yaml`](../../render.yaml) — the retired Render service + database
  config (production until 2026-10-12); now the inventory of `sync: false`
  secret names
- [Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md) — the API
  droplet and the `legendary-arena-lab` repo that provisions and deploys it
- [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md) — image CDN and tech-stack invariants
