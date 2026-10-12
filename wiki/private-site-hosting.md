---
title: Private Site Hosting
type: Guide
tags:
  - operations
  - security
  - cloudflare
  - cloudflare-access
  - cloudflare-workers
  - hosting
related:
  - wiki-viewer.md
  - dashboard.md
  - operational-health-checks.md
  - development-workflow.md
  - architecture-inventory.md
  - data-file-locations.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\private-site-hosting.md (this page — https://ewiki.legendary-arena.com/private-site-hosting/)
  - ../docs/ai/DECISIONS.md
  - ../docs/ops/DOMAINS.md
  - ../docs/ops/domains.json
  - ../apps/wiki-viewer/wrangler.jsonc
  - ../apps/dashboard/wrangler.jsonc
  - ../.github/workflows/wiki-viewer.yml
  - ../.github/workflows/dashboard-deploy.yml
  - ../apps/server/src/server.mjs
  - ../scripts/check-subdomains.mjs
last-reviewed: 2026-10-12
---

## Summary

The two private operator sites, the engineering wiki and the operator
dashboard, are each an assets-only Cloudflare Worker whose only public address
is its custom domain, and that domain is gated by Cloudflare Access. This
"one door" shape exists because Access gates hostnames, not content: any
second hostname for the same site (a Render host, a Pages alias, a Workers
default host or a preview URL) is an ungated copy. Both sites had such a copy
until the October 2026 move to Workers.

## Mechanics

> **Invariant (D-24690):** `workers_dev` and `preview_urls` stay `false` on
> both Workers. Turning either on creates a second, ungated address.

**One door.** Each Worker's `wrangler.jsonc`
([`apps/wiki-viewer/wrangler.jsonc`](../apps/wiki-viewer/wrangler.jsonc),
[`apps/dashboard/wrangler.jsonc`](../apps/dashboard/wrangler.jsonc)) sets:

- `workers_dev: false` — no default `*.workers.dev` hostname;
- `preview_urls: false` — no per-version preview hostnames;
- one route with `custom_domain: true` — the Access-gated hostname
  (`ewiki.legendary-arena.com` or `dashboard.legendary-arena.com`).

With both flags off the Worker has no default hostname, so the custom domain
is the only way in. D-24690 names the two flags as the substance of the
decision ([DECISIONS.md D-24690](../docs/ai/DECISIONS.md)), and each
`wrangler.jsonc` carries a `why:` comment saying the same.

**The gate.** The Access applications are hostname-based (Self-hosted, Email
One-time PIN, single-operator allow), so they did not change when the origin
behind each hostname moved from Render or Pages to a Worker
([DOMAINS.md §ewiki](../docs/ops/DOMAINS.md#ewiki),
[§dashboard](../docs/ops/DOMAINS.md#dashboard)). The dashboard keeps a second
layer behind Access: its live `/api/dash/*` routes require an admin Hanko
session and return `401` without one, and the API's CORS allowlist names only
the custom domain plus local dev
([`server.mjs`](../apps/server/src/server.mjs)).

**Private vs. public sites.** Only these two sites are private. The public
front-ends (play, cards, legends, www, lab) stay on Cloudflare Pages, where a
public `pages.dev` alias is harmless because the site is public anyway
([development-workflow](development-workflow.md)).

**Why the old hosts leaked.** Access sat in front of the custom domains only.
Render also served the wiki at `legendary-arena-wiki.onrender.com`, and
Cloudflare Pages also served the dashboard at
`legendary-arena-dashboard.pages.dev`, plus a public
`<hash>.legendary-arena-dashboard.pages.dev` preview for every branch push.
None of those were gated. Pages' "Enable access policy" covers previews only,
not the production `pages.dev` alias. Render's "disable subdomain" setting
needs a verified custom domain, and the wiki's never became verified
([DOMAINS.md §dashboard](../docs/ops/DOMAINS.md#dashboard); D-24690
§Context).

**Deploys.** The wiki deploys from the `deploy` job in
[`wiki-viewer.yml`](../.github/workflows/wiki-viewer.yml), which ships the
build job's gated artifact unchanged with `wrangler deploy`. The dashboard
builds in live mode and deploys from
[`dashboard-deploy.yml`](../.github/workflows/dashboard-deploy.yml) on every
push to `main`. Both need the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repo secrets and fail loudly without them. When
GitHub Actions can't deploy, the same build and `wrangler deploy` can run
from a workstation against the same `wrangler.jsonc`, so the one-door
settings hold; that path skips the wiki's CI gates and is the fallback, not
the norm ([DOMAINS.md §Manual deploy fallback](../docs/ops/DOMAINS.md#manual-deploy-fallback)).

**Probes.** [`domains.json`](../docs/ops/domains.json) and
[`check-subdomains.mjs`](../scripts/check-subdomains.mjs) probe both custom
domains for the Access redirect (`302`/`401`/`403`, with the redirect pointing
at `legendary-arena.cloudflareaccess.com`). They also keep the retired
`legendary-arena-wiki.onrender.com` as a live regression row that must return
`404`. See [Operational Health Checks](operational-health-checks.md).

## Interactions

- [Wiki Viewer](wiki-viewer.md) — the ewiki build pipeline; its History
  section records the wiki side of the move.
- [Dashboard](dashboard.md) — the dashboard app, its Hanko sign-in and the
  live-mode build env the deploy workflow sets.
- [Operational Health Checks](operational-health-checks.md) — `check:domains`
  and the freshness check that read these deploys.
- [Development Workflow](development-workflow.md) — where the two Workers sit
  among the DigitalOcean droplet (game server, Postgres; Render until
  2026-10-12) and Pages (public front-ends).
- [Architecture Inventory](architecture-inventory.md) — lists both Workers
  under "Cloudflare Workers (static assets)" and the retired origin row.
- [Data & File Locations](data-file-locations.md) — where the two
  `wrangler.jsonc` files live.

## Edge Cases

- **Other private projects on the account.** An account-wide sweep on
  2026-10-11 found no other private Workers or Pages project with an open
  default address: each private site's default host was either off or behind
  Access ([#2700](https://github.com/barefootbetters/legendary-arena/pull/2700)).
- **Proxied records and Render verification.** Render could not verify
  `ewiki.legendary-arena.com` while its record was Cloudflare-proxied ("Waiting
  for DNS"). That record also pointed at the *game server's* Render host,
  `legendary-arena-server.onrender.com`, not the wiki service's. Either way,
  Render's subdomain toggle could never take effect (#2603).
- **Custom domain over an existing record.** A Worker custom domain cannot be
  created while any DNS record exists for the hostname (code 100117,
  "externally managed DNS records"). The cutover's first deploy uploaded both
  Workers but failed to attach the domains until the old records were deleted.
- **First minutes after attach.** Right after the ewiki domain attached, two
  probes got `200` before Access applied to the new hostname. Every probe
  since has redirected (D-24690 cutover note).
- **Deleting a Pages project.** Cloudflare refuses to delete a project with
  more than 100 deployments. The dashboard project had 5,852, cleared through
  the API first. The Pages API rejected an account-owned token
  (`Authentication error`, code 10000) that verified as active; a user token
  worked. Account-owned tokens do work for the Workers deploys.
- **A deleted `pages.dev` name.** After deletion the alias answered `530`
  (no such project) for a few minutes, then dropped out of DNS. The probe
  script has no "must not resolve" verdict, so that row was removed rather
  than kept (#2704).

## History

- **2026-06-02** — Dashboard launched on Cloudflare Pages behind Access
  (D-19701). Its `pages.dev` alias was ungated from day one.
- **2026-09-10** — The ungated alias was recorded as a `planned` probe row
  (#2017).
- **2026-10-05** — The wiki's Render origin was found serving the full wiki
  ungated. #2603 set `renderSubdomainPolicy: disabled`; the toggle never stuck
  (see Edge Cases).
- **2026-10-09** — #2662 corrected the dashboard's `pages.dev` Access runbook
  (the Pages toggle covers previews only).
- **2026-10-10** — #2673 updated the dashboard runbook for the live-mode build.
- **2026-10-11** — D-24690 reserved (#2691) and implemented (#2697): both
  sites moved to assets-only Workers with no default hostname, superseding
  D-13811's Render hosting target and the hosting half of D-19701. Cutover the
  same day: Access confirmed on 48 of 48 probes, and the operator verified
  both sites after login. The Render static site and the Pages project were
  deleted, and #2700 recorded the outcome.
- **2026-10-12** — #2704 dropped the retired `pages.dev` probe after the name
  left DNS. `check:domains`: 11 ok, 1 pending (`wiki.`), 0 failed.

## References

- [DECISIONS.md D-24690](../docs/ai/DECISIONS.md) — the decision, context
  and cutover note; supersedes D-13811 (hosting) and the hosting half of
  D-19701.
- [DOMAINS.md §ewiki](../docs/ops/DOMAINS.md#ewiki) and
  [§dashboard](../docs/ops/DOMAINS.md#dashboard) — operator runbooks,
  cutover record and failure runbook.
- [`docs/ops/domains.json`](../docs/ops/domains.json) — probe manifest.
- [`apps/wiki-viewer/wrangler.jsonc`](../apps/wiki-viewer/wrangler.jsonc),
  [`apps/dashboard/wrangler.jsonc`](../apps/dashboard/wrangler.jsonc) — the
  Worker configs.
- [`.github/workflows/wiki-viewer.yml`](../.github/workflows/wiki-viewer.yml),
  [`.github/workflows/dashboard-deploy.yml`](../.github/workflows/dashboard-deploy.yml)
  — deploy paths.
- PRs [#2603](https://github.com/barefootbetters/legendary-arena/pull/2603),
  [#2662](https://github.com/barefootbetters/legendary-arena/pull/2662),
  [#2673](https://github.com/barefootbetters/legendary-arena/pull/2673),
  [#2691](https://github.com/barefootbetters/legendary-arena/pull/2691),
  [#2697](https://github.com/barefootbetters/legendary-arena/pull/2697),
  [#2700](https://github.com/barefootbetters/legendary-arena/pull/2700),
  [#2704](https://github.com/barefootbetters/legendary-arena/pull/2704).
