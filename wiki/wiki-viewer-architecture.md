---
title: Wiki Viewer Architecture
type: System
tags:
  - hugo
  - governance
  - documentation
related:
  - wiki-viewer.md
  - hugo-platform-strategy.md
  - private-site-hosting.md
  - hugo-web-system.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\wiki-viewer-architecture.md (this page — https://ewiki.legendary-arena.com/wiki-viewer-architecture/)
  - ../apps/wiki-viewer/hugo.toml
  - ../apps/wiki-viewer/wrangler.jsonc
  - ../apps/wiki-viewer/README.md
  - ../.github/workflows/wiki-viewer.yml
  - ../docs/ai/work-packets/WP-139-engineering-wiki-viewer.md
last-reviewed: 2026-10-16
---

## Summary

How the ewiki at `ewiki.legendary-arena.com` is built, checked, deployed,
and themed. Authors don't need this page; the how-to for writing and
publishing pages is [Wiki Viewer](wiki-viewer.md). This page is for
whoever changes the viewer itself: its CI gates, its hosting, or its
theme.

## Mechanics

### Build pipeline (what runs on push and on PRs)

1. **Projection** (`pnpm wiki-viewer:project`) — copies every
   `wiki/*.md` file into `apps/wiki-viewer/content/`. Renames the
   copy of `INDEX.md` to `_index.md` (Hugo home page convention).
   The source file under `wiki/` is never modified.
2. **Link check** (`pnpm wiki-viewer:check-links`) — case-sensitive
   validation of every internal `<page>.md` link. A broken link fails
   the build.
3. **Hugo render** (`hugo --source apps/wiki-viewer --minify`) —
   generates `apps/wiki-viewer/public/`. External `../path` links are
   rewritten to GitHub blob URLs by the markdown render hook.
4. **Gates and search index** — a page-count assert, a determinism
   check, the Pagefind search index, and a JS-free gate. The result is
   uploaded as the `wiki-viewer-public` artifact.
5. **Deploy** (`main` only: a push or a manual run) — downloads the
   `wiki-viewer-public` artifact and runs
   `pnpm dlx wrangler@4.149.0 deploy --config apps/wiki-viewer/wrangler.jsonc`.
   It ships the gated artifact byte-for-byte; nothing is rebuilt on the
   hosting side.

### Hosting and access

The site is an assets-only Cloudflare Worker, `legendary-arena-wiki`,
declared in `apps/wiki-viewer/wrangler.jsonc` (D-24690). It serves
`./public` on the custom domain `ewiki.legendary-arena.com`, with
`workers_dev` and `preview_urls` both off. Cloudflare Access gates that
hostname. CI runs the build gates on PRs and on `main`; only `main`
deploys.

To re-publish without a content change (for example after a failed
deploy): GitHub → **Actions** → **wiki-viewer** → **Run workflow** on
`main`. The deploy job needs the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repo secrets and fails the run if either is
missing.

### Theme and layout

The wiki viewer uses a hand-rolled theme (no third-party framework).
Key layout features:

- **Sidebar nav** — pages grouped by `type`, sorted alphabetically.
- **Metadata panel** — renders `type`, `status` (color-coded badge),
  `tags` (pill badges), and `last-reviewed`.
- **Related pages** and **source citations** render as panels below
  the main content.
- **Link rewriting** — a markdown render hook converts `slug.md` links
  to `/<slug>/` and `../path` links to GitHub blob URLs.

The theme is defined in `apps/wiki-viewer/layouts/` and
`apps/wiki-viewer/assets/css/style.css`.

The theme choice is recorded as locked in WP-139 (Open Decision B):
Docsy and Hextra were both considered and rejected at the time, and a
move to a third-party theme needs a DECISIONS entry that supersedes the
lock. D-24725 moves every ewiki onto one shared wiki platform, and
D-24727 makes this theme, extracted into one shared copy, the platform's
theme, after a Hextra pilot. The lock and the JS-free gate stand. The
engine ewiki moves onto the shared copy last. See
[Hugo Platform Strategy](hugo-platform-strategy.md).

## Interactions

- [Wiki Viewer](wiki-viewer.md) — the authoring guide this page backs.
- [Hugo Platform Strategy](hugo-platform-strategy.md) — the other Hugo
  sites, the reusable-template idea, and the open theme decision.
- [Private Site Hosting](private-site-hosting.md) — the Access-gated
  hosting pattern this site uses.
- [Hugo Web System](hugo-web-system.md) — the marketing site, a separate
  Hugo site on Cloudflare Pages with the PaperMod theme.

## Edge Cases

- **Only one door.** Cloudflare Access gates the hostname
  `ewiki.legendary-arena.com`, not the content. Any other public hostname
  serving the same files bypasses the gate. Keep `workers_dev` and
  `preview_urls` set to `false` in `apps/wiki-viewer/wrangler.jsonc`;
  turning either on adds an ungated address.
- **Byte-identical builds.** The determinism gate builds twice and
  compares. That is why syntax highlighting is off and why the Pagefind
  index is generated after the comparison, not before.
- **JS-free gate.** The only script allowed in the output is the Pagefind
  search loader tagged `data-wiki-search` (D-24293, amending D-13808 /
  D-13811). Any theme or shortcode that adds JavaScript fails the build
  until that decision is amended.

## History

- **2026-10-11 — moved from Render to a Cloudflare Worker (D-24690).**
  *Found:* Render's default host
  `https://legendary-arena-wiki.onrender.com` served the full wiki with
  HTTP 200 and no Access gate (verified 2026-10-05; still open
  2026-10-11), because Access gates only the custom hostname. The
  dashboard's production `legendary-arena-dashboard.pages.dev` alias had
  the same gap. *Tried:* PR #2603 set `renderSubdomainPolicy: disabled`
  in `render.yaml` and added probes, but the Render dashboard toggle
  could not take effect: Render shows `ewiki` as "Waiting for DNS /
  Waiting for Verification" because the record is Cloudflare-proxied.
  PRs #2662 and #2673 corrected the dashboard's `pages.dev` Access
  runbook and its live-mode build notes. *Changed:* the ewiki now runs on
  the assets-only Worker `legendary-arena-wiki`
  (`apps/wiki-viewer/wrangler.jsonc`), which has no default public
  hostname with `workers_dev` and `preview_urls` off, so the Access-gated
  custom domain is the only door. The wiki-viewer workflow's deploy job
  runs `wrangler deploy` on the gated artifact (on push to `main` or a
  manual run), replacing the Render deploy hook; the
  `RENDER_WIKI_DEPLOY_HOOK` secret and the Render service are retired.
  The hostname-based Access application carries over unchanged. This
  supersedes D-13811's hosting target. The game server and Postgres stay
  on Render. *Cutover:* add the `CLOUDFLARE_API_TOKEN` /
  `CLOUDFLARE_ACCOUNT_ID` repo secrets, remove the old `ewiki` CNAME to
  Render, merge (or run the wiki-viewer workflow on `main`) so Wrangler
  attaches the custom domain, confirm the Access redirect, then delete the
  Render service and the `RENDER_WIKI_DEPLOY_HOOK` secret by hand.
  Full steps: [DOMAINS.md §ewiki](../docs/ops/DOMAINS.md#ewiki).
- **2026-10-11 — cutover done (D-24690, #2697).** The old `ewiki` record
  turned out to point at the *game server's* Render host
  (`legendary-arena-server.onrender.com`), not the wiki service's, which is
  why Render never verified the wiki's custom domain and the #2603 toggle
  could not stick. The first deploy uploaded the Worker but could not
  attach `ewiki.legendary-arena.com` until the old DNS record was deleted;
  re-running the failed job attached it. Right after the domain attached,
  two probes briefly got `200` before Access applied to the new hostname;
  every probe since redirects to Access (48 of 48 across both sites). The
  Render static site was deleted the same day, and
  `legendary-arena-wiki.onrender.com` now returns `404`. The dashboard's
  Pages project (5,852 deployments) was deleted after its deployments were
  cleared through the API; `legendary-arena-dashboard.pages.dev` answered
  `530` (no such project) for a few minutes and then dropped out of DNS.

## References

- [apps/wiki-viewer/hugo.toml](../apps/wiki-viewer/hugo.toml) — Hugo config
- [apps/wiki-viewer/wrangler.jsonc](../apps/wiki-viewer/wrangler.jsonc) — Cloudflare Worker config (D-24690)
- [.github/workflows/wiki-viewer.yml](../.github/workflows/wiki-viewer.yml) — build gates and deploy job
- [apps/wiki-viewer/README.md](../apps/wiki-viewer/README.md) — viewer README (Hugo pin, theme lock)
- [WP-139](../docs/ai/work-packets/WP-139-engineering-wiki-viewer.md) — the viewer's founding work packet (theme lock, Open Decision B)
- [DOMAINS.md §ewiki](../docs/ops/DOMAINS.md#ewiki) — hostname, Access gate, and cutover steps
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24690 (move to Workers), D-24293 (Pagefind and the JS-free amendment)
- [apps/wiki-viewer/layouts/](../apps/wiki-viewer/layouts/) — theme layouts
- [apps/wiki-viewer/assets/css/style.css](../apps/wiki-viewer/assets/css/style.css) — theme stylesheet
