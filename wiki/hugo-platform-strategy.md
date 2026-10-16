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

We run four Hugo wikis, and each carries its own forked copy of a
hand-rolled theme. The real question is whether to keep four diverging
themes or move to one shared platform; which theme that platform uses
is a second, smaller question. This page recommends converging, proposes
a Hextra pilot on the next new wiki to settle which theme, and keeps the
marketing site on PaperMod for now. It also covers selling on a static
site and the laptop-to-live publishing flow. Sources: a 2026-10-15 Claude
Chat and two Copilot reviews (2026-10-16).

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

### Where this is headed

```
Today                                   Future

Engine ewiki      -> theme copy A       Studio Hugo platform
Herbs ewiki       -> theme copy B       ├── shared theme
Personal wiki     -> theme copy C       ├── shared search
Corporate memory  -> theme copy D       ├── shared branding
Marketing         -> PaperMod           ├── shared components
                                        └── shared deployment guidance

                                        Sites on the platform
                                        ├── Engine ewiki
                                        ├── Herbs ewiki
                                        ├── Personal wiki
                                        ├── Corporate memory
                                        └── future customer ewikis

                                        Marketing stays on PaperMod
```

### One template, many ewikis

Treat "ewiki" as something we stamp out, not sites we maintain one by
one. Build one Hugo setup with the Studio branding and shared partials
(header, footer, nav, search). Each ewiki is then a content folder, a
small config with its domain and project name, and a logo. That is what
makes the ewiki a reusable Studio product.

### The cost of doing nothing

- **Every fix lands four times.** A navigation, CSS, search, or
  accessibility fix has to be made in each copy. In practice it gets
  made in one, and the others fall behind. That is how the engine and
  Herbs copies came to differ in 20 layout files.
- **Every Hugo upgrade lands four times.** Each copy has to be checked
  against each new Hugo release on its own.
- **The Studio product can't ship as a template.** Each new customer
  ewiki would fork a fifth copy, so the maintenance cost grows with
  every sale instead of staying flat.
- **The code-style rule has already been passed.** "Abstract when a
  third copy appears" — we are at four.

### The platform question

There are two decisions, in order.

**Decision 1: converge on one shared wiki theme.** Recommended, for the
reasons above. It is pending owner sign-off; once signed off it becomes
a DECISIONS entry.

**Decision 2: which shared theme.** Open, with two options.

**(a) Hextra.** Hextra is a documentation-first Hugo theme (MIT
license), built for docs and knowledge bases, not blogs. It brings
multi-level navigation, search, dark mode, and a responsive layout.
Upstream maintains it, so the platform stops carrying its own CSS,
navigation, and accessibility fixes. Its README says sites need no
Node.js to use it, which answers WP-139's original reason for rejecting
it ("introduces Tailwind tooling"). For the engine ewiki, adopting it
changes more than the theme:

- **The JS-free gate.** Hextra's built-in search is FlexSearch, which
  runs in the browser, and its interactive pieces use script. The
  ewiki's CI fails any build that ships JavaScript other than the
  Pagefind loader (D-24293). Adopting Hextra means amending that
  decision, the build rules that enforce it, and the search setup.
- **Search, twice.** The ewiki already ships Pagefind. We would keep one
  and switch off the other.
- **Determinism and Access.** The byte-identical build gate and the
  single Access-gated hostname still apply. Both should be fine, but the
  first Hextra build has to prove it.

**(b) The current theme, extracted.** Pull the hand-rolled theme out
into one shared copy that all four wikis use. Every existing gate stays
as it is, but we keep maintaining the theme ourselves.

### Recommended next step

Build the next new ewiki on Hextra as a pilot. It needs no migration,
and the WP-139 theme lock and the JS-free gate govern only the engine
ewiki, so a new wiki is free to try it. Then put the pilot next to the
engine ewiki and decide Decision 2:

- **If Hextra wins,** write the DECISIONS entry that supersedes the
  WP-139 lock, amend D-24293 for Hextra's script, and move the existing
  wikis over one at a time, starting with the smallest.
- **If it doesn't,** extract the current theme into the shared copy and
  move the wikis onto that instead.

Either way, Decision 1 holds: the four copies converge.

### The marketing site: keep PaperMod for now

Moving the marketing site from PaperMod to Hextra has also been proposed.
PaperMod is blog-first, which is a fair point against it. But the
marketing site's job is conversion: the homepage, `/shop/` with
Snipcart, the Cloudflare Pages Functions for email signup, and the
redirect map. A theme migration there is a large job that doesn't sell
anything. Revisit it when the marketing site needs a docs-style section
that PaperMod can't do.

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
- **Marketing is out of scope for convergence.** The shared platform is
  for the wikis. The marketing and Barefoot Betters sites stay on
  PaperMod until there is a business reason to move them.

## Open Questions

1. **Decision 1 sign-off.** Converge the four wiki themes into one
   shared theme? Recommended; needs a DECISIONS entry once signed off.
2. **Decision 2: which shared theme?** Hextra or the extracted current
   theme. Settled by the Hextra pilot on the next new ewiki (see
   *Recommended next step*).
3. **Does the marketing site leave PaperMod?** Not now. Revisit when it
   needs a docs-style section.

## References

- [WP-139](../docs/ai/work-packets/WP-139-engineering-wiki-viewer.md) — the engine ewiki's theme lock and the original Docsy/Hextra rejection
- [apps/wiki-viewer/README.md](../apps/wiki-viewer/README.md) — "Theme" section (lock and supersede rule)
- [.github/workflows/wiki-viewer.yml](../.github/workflows/wiki-viewer.yml) — the JS-free and determinism gates
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24293 (Pagefind and the JS-free amendment), D-24690 (Worker hosting)
- [Hextra on GitHub](https://github.com/imfing/hextra) — the theme (MIT; FlexSearch search; no Node.js needed to use it)
