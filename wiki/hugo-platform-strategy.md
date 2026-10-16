---
title: Hugo Platform Strategy
type: Concept
tags:
  - hugo
  - layer-marketing
  - documentation
related:
  - wiki-viewer.md
  - wiki-viewer-architecture.md
  - hugo-web-system.md
  - video-commerce.md
  - disaster-recovery.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\hugo-platform-strategy.md (this page — https://ewiki.legendary-arena.com/hugo-platform-strategy/)
  - ../docs/ai/work-packets/WP-139-engineering-wiki-viewer.md
  - ../apps/wiki-viewer/README.md
last-reviewed: 2026-10-16
---

## Summary

We run several Hugo sites, and each wiki carries its own copy of a
hand-rolled theme. This page records the plan to make "ewiki" a template
we stamp out as a Studio product. It also covers whether Hextra should
become the shared theme, how selling fits a static site, and the
laptop-to-live publishing flow. It came from a 2026-10-15 Claude Chat and
a Copilot review of the Wiki Viewer page on 2026-10-16. The theme
decision is still open.

## Mechanics

### The sites today

| Site | Repo | Theme | Hosting |
|---|---|---|---|
| Engine ewiki (`ewiki.legendary-arena.com`) | `legendary-arena` (`apps/wiki-viewer/`) | Hand-rolled | Cloudflare Worker, deployed by GitHub Actions |
| Herbs vs. Ailments ewiki | `herbs-vs-ailments` (`apps/ewiki/`) | Hand-rolled, a drifted copy | — |
| Corporate-memory viewer | `jefferyjjensen-corporate-memory` (`viewer/`) | Hand-rolled | Cloudflare Pages |
| Personal wiki | `jefferyjjensen-wiki` | Hand-rolled | — |
| Marketing (`www.legendary-arena.com`) | `legendary-arena-com` | PaperMod plus overrides | Cloudflare Pages |
| Barefoot Betters (`barefootbetters.com`) | `barefootbetters-www` | PaperMod | — |

A dash means this page hasn't recorded the host yet. Checked 2026-10-16:
the engine ewiki and the Herbs vs. Ailments ewiki differ in 20 layout
files, so the copies are already drifting.

### One template, many ewikis

Treat "ewiki" as something we stamp out, not sites we maintain one by
one. Build one Hugo setup with the Studio branding and shared partials
(header, footer, nav, search). Each ewiki is then a content folder, a
small config with its domain and project name, and a logo. That is what
makes the ewiki a reusable Studio product.

The four hand-rolled copies are the real maintenance cost: every fix to
navigation, CSS, search, or accessibility has to land four times. The
code-style rule "abstract when a third copy appears" was passed at the
fourth copy. Making a shared theme is the right move whichever theme it
ends up being.

### The theme question: Hextra or our own shared theme

Copilot recommends standardizing every site on Hextra, a
documentation-first Hugo theme (MIT license). Its case is good on several
points: Hextra is built for docs and knowledge bases, not blogs. It
brings multi-level navigation, search, dark mode, and a responsive
layout. Upstream maintains it, so we stop carrying custom CSS,
navigation, and accessibility fixes ourselves. Its README says sites need
no Node.js to use it. That answers WP-139's original reason for
rejecting it ("introduces Tailwind tooling").

What it would change for the engine ewiki specifically:

- **The JS-free gate.** Hextra's built-in search is FlexSearch, which
  runs in the browser, and its interactive pieces use script. The
  ewiki's CI fails any build that ships JavaScript other than the
  Pagefind loader (D-24293). Adopting Hextra means amending that
  decision, not just swapping a theme.
- **Search, twice.** The ewiki already ships Pagefind. We would keep one
  and switch off the other.
- **Determinism and Access.** The byte-identical build gate and the
  single Access-gated hostname still apply. Both should be fine, but the
  first Hextra build has to prove it.

The other option is to pull the current hand-rolled theme out into one
shared theme that the four wikis use. That keeps every existing gate as
it is, but we keep maintaining it ourselves.

### The marketing site: keep PaperMod for now

Copilot also recommends moving the marketing site from PaperMod to
Hextra. Its point that PaperMod is blog-first is fair. But the marketing
site's job is conversion: the homepage, `/shop/` with Snipcart, the
Cloudflare Pages Functions for email signup, and the redirect map. A
theme migration there is a large job that doesn't sell anything. Revisit
it when the marketing site needs a docs-style section that PaperMod
can't do.

### Selling on a static site

Hextra handles landing pages, product pages, blog posts, and newsletters
well. A shopping cart is a different problem: Hugo builds plain HTML
ahead of time, with no server running when a visitor arrives. A cart
needs live work (the basket, payment, inventory), and a static site
can't do that alone.

You don't need WooCommerce. Keep the site static and let a hosted
service handle the money:

| Option | How it works |
|---|---|
| **Snipcart** (what we use) | Add buy buttons to any static page; Snipcart runs the cart and checkout, with Stripe taking payment |
| Stripe Payment Links | Each product gets a checkout link; Stripe handles everything |

`/shop/` on the marketing site is already Hugo plus Snipcart and Stripe,
and it is the cart of record. Fourthwall is a separate YouTube-facing
shelf that mirrors a camera-friendly subset of SKUs
([Video Commerce](video-commerce.md)). Snipcart works on any static
site, so a theme change, Hextra included, needs no new store tooling.

### The publishing flow, laptop to live site

1. **Laptop.** The repo is cloned locally. You write Markdown there, with
   Claude Code helping, and preview with the local Hugo server.
2. **Hard drive.** The files live in a git repository. A **commit**
   saves a snapshot of your changes.
3. **GitHub.** A **push** uploads those snapshots. GitHub is your cloud
   copy, your backup, and your history in one place.
4. **Cloudflare.** Every push to `main` publishes on its own; the push
   is the deploy. Marketing goes through Cloudflare Pages, which pulls
   the repo, runs Hugo, and serves it. The engine ewiki goes through
   GitHub Actions, which runs the gates and the Hugo build and deploys
   that exact build to the Cloudflare Worker
   ([Wiki Viewer Architecture](wiki-viewer-architecture.md)).

Day to day, the only part you touch is "write and push." Hextra is built
for this GitHub-to-Cloudflare flow.

### pCloud: a safety net beside the flow

pCloud is not a step in the publishing flow. GitHub already backs up the
Markdown and the site code, so pCloud earns its place in two ways:

- **It guards against losing GitHub:** account lockout, or a repo
  deleted by mistake. No one provider holds everything (the 3-2-1 rule:
  three copies, two kinds of storage, one off-site).
- **It holds what git doesn't:** the off-site mirror of the nightly
  database dumps (R2 is the primary copy) and the card-image originals.
  See [Disaster Recovery](disaster-recovery.md).

One wrinkle: the engine repo's checkout lives on the pCloud sync drive,
so pCloud also syncs its `.git` folder. A commit from a parallel session
can show up in your checkout mid-work. Moving the checkout off the sync
drive is planned and deferred.

## Interactions

- [Wiki Viewer](wiki-viewer.md) — how to author and publish ewiki pages
  today.
- [Wiki Viewer Architecture](wiki-viewer-architecture.md) — the engine
  ewiki's gates, hosting, and the current theme lock.
- [Hugo Web System](hugo-web-system.md) — the marketing site's Hugo
  setup on PaperMod.
- [Video Commerce](video-commerce.md) — Snipcart as the cart of record,
  Fourthwall as the YouTube shelf.
- [Disaster Recovery](disaster-recovery.md) — the backup copies pCloud
  holds.

## Edge Cases

- **The theme lock is real.** WP-139 records the hand-rolled theme as
  locked. Adopting Hextra for the engine ewiki needs a DECISIONS entry
  that supersedes it, plus an amendment to the JS-free decision
  (D-24293).
- **A Hextra pilot on a new wiki is not bound by those locks.** They
  govern the engine ewiki only, so a new wiki is the cheap place to try
  Hextra.

## Open Questions

1. **Which theme should the shared ewiki template use?** (a) Hextra, or
   (b) the current hand-rolled theme pulled out into one shared copy.
   Suggested next step: build the next new ewiki on Hextra as a pilot,
   since no migration is needed, and decide after seeing it next to the
   engine ewiki. A Hextra decision then needs the DECISIONS entry and
   the JS-free amendment above before the engine ewiki moves.
2. **Does the marketing site leave PaperMod?** Not now (see above).
   Revisit when it needs a docs-style section.

## References

- [WP-139](../docs/ai/work-packets/WP-139-engineering-wiki-viewer.md) — the engine ewiki's theme lock and the original Docsy/Hextra rejection
- [apps/wiki-viewer/README.md](../apps/wiki-viewer/README.md) — "Theme" section (lock and supersede rule)
- [.github/workflows/wiki-viewer.yml](../.github/workflows/wiki-viewer.yml) — the JS-free and determinism gates
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24293 (Pagefind and the JS-free amendment), D-24690 (Worker hosting)
- [Hextra on GitHub](https://github.com/imfing/hextra) — the theme (MIT; FlexSearch search; no Node.js needed to use it)
