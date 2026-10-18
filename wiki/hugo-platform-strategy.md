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
  - C:\dev\legendary-arena\wiki\hugo-platform-strategy.md (this page — https://ewiki.legendary-arena.com/hugo-platform-strategy/)
  - ../docs/ai/work-packets/WP-139-engineering-wiki-viewer.md
  - ../apps/wiki-viewer/README.md
last-reviewed: 2026-10-17
---

## Summary

We run five Hugo wikis, and each carries its own forked copy of a
hand-rolled theme. The real question is whether to keep four diverging
themes or move to one shared platform; which theme that platform uses
is a second, smaller question. Both are decided: converge (D-24725), on
the current theme extracted into one shared copy (D-24727), after a
Hextra pilot showed Hextra doesn't fix the drift. The extracted theme is
released as `barefootbetters/bb-studio-ewiki-theme` (renamed from
`ewiki-theme` on 2026-10-18; now `v1.1.1`), vendored
into each wiki (D-24728); the wikis move onto it one at a time, and the
corporate-memory viewer is the first on it. The marketing site stays
on PaperMod for now. The page also covers selling on a static site
and the laptop-to-live publishing flow. Sources: a 2026-10-15 Claude Chat,
four Copilot reviews, and a Grok review (2026-10-16). The studio ewiki
joined the list on 2026-10-17 ([bb-studio-dashboard decision 2026-10-17-01](https://github.com/barefootbetters/bb-studio-dashboard/blob/main/docs/ai/decision-log/2026-10-17-01-the-studio-ewiki-is-the-studios-own-wiki.md)).

## Mechanics

### The sites today

| Site | Repo | Theme | Theme source | Hosting |
|---|---|---|---|---|
| Engine ewiki (`ewiki.legendary-arena.com`) | `legendary-arena` (`apps/wiki-viewer/`) | Hand-rolled | Its own copy, until its migration packet (step 4) | Cloudflare Worker, deployed by GitHub Actions |
| Herbs vs. Ailments ewiki | `herbs-vs-ailments` (`apps/ewiki/`) | Hand-rolled, a drifted copy | Its own copy, until its migration packet (step 2) | — |
| Corporate-memory viewer | `jefferyjjensen-corporate-memory` (`viewer/`) | The shared theme | `barefootbetters/bb-studio-ewiki-theme` `v1.1.1`, vendored (step 1, done 2026-10-16) | Cloudflare Pages |
| Studio ewiki (`studio-ewiki.barefootbetters.com`) | `bb-studio-dashboard` (`ewiki/`, rendering that repo's `docs/`) | Hand-rolled, copied from the herbs copy on 2026-10-15 | Its own copy, until its migration packet ([WP-014](https://github.com/barefootbetters/bb-studio-dashboard/blob/main/docs/ai/work-packets/WP-014-studio-ewiki-on-the-shared-theme.md) there, draft) | Cloudflare Worker `bb-studio-ewiki`, behind Access |
| Personal wiki | `jefferyjjensen-wiki` | Hand-rolled | Its own copy, until its migration packet (step 3) | — |
| Marketing (`www.legendary-arena.com`) | `legendary-arena-com` | PaperMod plus overrides | PaperMod upstream (not on the platform) | Cloudflare Pages |
| Barefoot Betters (`barefootbetters.com`) | `barefootbetters-www` | PaperMod | PaperMod upstream (not on the platform) | — |

A dash means this page hasn't recorded the host yet. Checked 2026-10-16:
the engine ewiki and the Herbs vs. Ailments ewiki differ in 20 layout
files, so the copies are already drifting. Checked 2026-10-17: 7 of the
studio ewiki's 13 layout files already differ from the herbs copy it was
made from two days earlier. Each wiki's theme source
becomes `barefootbetters/bb-studio-ewiki-theme` (a vendored tag) when its migration
packet lands.

### Where this is headed

```
Today                                   Future

Engine ewiki      -> theme copy A       Studio Hugo platform
Herbs ewiki       -> theme copy B       ├── shared theme
Personal wiki     -> theme copy C       ├── shared search
Corporate memory  -> theme copy D       ├── shared branding
Studio ewiki      -> theme copy E
Marketing         -> PaperMod           ├── shared components
                                        └── shared deployment guidance

                                        Sites on the platform
                                        ├── Engine ewiki
                                        ├── Herbs ewiki
                                        ├── Personal wiki
                                        ├── Corporate memory
                                        ├── Studio ewiki
                                        └── future customer ewikis

                                        Marketing stays on PaperMod
```

### One template, many ewikis

Treat "ewiki" as something we stamp out, not sites we maintain one by
one. Build one Hugo setup with the Studio branding and shared partials
(header, footer, nav, search). Each ewiki is then a content folder, a
small config with its domain and project name, and a logo. That is what
makes the ewiki a reusable Studio product. The studio's own wiki is the
first one built that way ([bb-studio-dashboard decision 2026-10-17-01](https://github.com/barefootbetters/bb-studio-dashboard/blob/main/docs/ai/decision-log/2026-10-17-01-the-studio-ewiki-is-the-studios-own-wiki.md)),
and the product's public page is `studio.barefootbetters.com/ewiki`
([decision 2026-10-17-02](https://github.com/barefootbetters/bb-studio-dashboard/blob/main/docs/ai/decision-log/2026-10-17-02-the-ewiki-products-marketing-page.md)).

### The cost of doing nothing

- **Every fix lands five times.** A navigation, CSS, search, or
  accessibility fix has to be made in each copy. In practice it gets
  made in one, and the others fall behind. That is how the engine and
  Herbs copies came to differ in 20 layout files.
- **Every Hugo upgrade lands five times.** Each copy has to be checked
  against each new Hugo release on its own.
- **The Studio product can't ship as a template.** Each new customer
  ewiki would fork a sixth copy, so the maintenance cost grows with
  every sale instead of staying flat.
- **The code-style rule has already been passed.** "Abstract when a
  third copy appears" — we are at five.

### The platform question

There were two decisions, in order. Both are now made.

**Decision 1: converge on one shared wiki platform.** Decided
2026-10-16 ([D-24725](../docs/ai/DECISIONS.md)). Every ewiki moves onto
one shared platform: one source of truth for the theme, layouts,
shortcodes, search, and branding. No new theme copy gets forked.

**Decision 2: which theme powers the platform.** Decided 2026-10-16
([D-24727](../docs/ai/DECISIONS.md)): **the current hand-rolled theme,
extracted into one shared copy.** Hextra is not adopted. The candidates
were:

- **(a) Hextra,** a documentation-first Hugo theme (MIT). It brings
  multi-level navigation, search, dark mode, a mobile drawer, and an
  accessibility baseline, with upstream doing the maintenance. Its
  Tailwind CSS comes precompiled, so sites using it need no Node, and it
  needs Hugo 0.146.0 or later (we pin 0.161.1).
- **(b) The current theme, extracted.** One shared copy of the theme the
  wikis already use. Every existing gate stays as it is, and we keep
  maintaining the theme ourselves.

A pilot settled it.

### The Hextra pilot: results

The pilot moved the Herbs vs. Ailments design wiki (409 pages) onto
Hextra v0.13.0 on a branch. It was not deployed. The full evaluation is
`apps/ewiki/HEXTRA-PILOT.md` in
[barefootbetters/herbs-vs-ailments#247](https://github.com/barefootbetters/herbs-vs-ailments/pull/247),
which was closed unmerged.

| Question | Answer |
|---|---|
| How much JavaScript ships? | Search on: 5 scripts per page, about 75 KB (24 KB gzipped), plus a 1.2 MB search index fetched when search opens. Search off: 2 scripts. Diagram pages add a 5.5 MB Mermaid (1.6 MB gzipped). |
| Could it pass the engine ewiki's one-script rule (D-24293)? | No. With Pagefind swapped in for Hextra's search, the best case is 3 scripts against 1. Dropping Hextra's own two breaks dark mode (a JS-set class) and mobile navigation (a JS-opened drawer). Fixing either is a fork. |
| Is the build byte-identical? | Yes, across five builds. But on a cold cache it fetches Mermaid and FlexSearch over the network. |
| Does the Hugo Modules install work? | In CI, yes, but only because Go happens to be preinstalled on GitHub's runner image. Locally it needs Go, which the repo doesn't otherwise require. Vendoring the theme works everywhere. |
| How much override did branding take? | The accent color took 4 CSS variables; the title, logo, footer and width were config only. The wiki's own components took about 65 lines of plain CSS, since Hextra's Tailwind is precompiled and a class Hextra doesn't already use gets no style. Hextra's 7 favicons and a web manifest named "Hextra" ship by default and would have to be replaced (the pilot didn't). Retinting the grays would take about 20 more variables. |
| How many old layout files were deleted? | 5 of 13 deleted, 8 kept, 5 new. Two of the new files replace Hextra's own (`sidebar.html`, `docs/single.html`) and have to be re-checked against every Hextra release. |

What Hextra did well: an "On this page" table of contents, a light/dark
toggle, a mobile drawer, better search, and an accessibility baseline.

Why it lost:

1. **It doesn't fix the drift.** The four copies drifted in the
   wiki-specific layouts: link and image hooks, include-section, footer,
   and nav. Under Hextra all of that stays our code, plus two overrides
   of Hextra's files that drift against upstream (seven Hextra releases
   so far in 2026). Hextra replaced only the generic chrome, which wasn't
   drifting.
2. **The flagship can't use it as-is.** The engine ewiki would need its
   JS-free gate amended or Hextra forked. A platform the flagship can't
   use isn't one platform.
3. **The weight goes the wrong way.** HTML pages went from 13 KB to
   20 KB gzipped, even after trimming the sidebar. Hugo ran about 2.7
   times slower, and diagram pages got far heavier.

### Where the two options stand (2026-10-16)

| Question | Hextra | Current theme, extracted |
|---|---|---|
| Fixes the drift between the four copies | No. The wiki-specific layouts stay per wiki, plus two overrides of Hextra's own files. | Yes. One core, a closed set of extension partials, and a manifest check that fails on any edit. |
| Passes D-24293 (one script) unamended | No. At best 3 scripts, with Pagefind swapped in. | Yes. The Pagefind loader is still the only script. |
| Installs without Go or CI credentials | Vendored, yes. As a Hugo module, no: it needs Go, and CI passed only because GitHub's runner image has it. | Yes, vendored (D-24728). |
| Byte-identical builds | Yes, but a cold build fetches Mermaid and FlexSearch over the network. | Yes, and no build needs the network. |
| Basic rebranding | Easy: 4 CSS variables plus config. | Easy: one brand-token file. |
| Full Studio look | Not free: plain-CSS overrides, Hextra's favicons, about 20 gray variables. | Already ours. |
| Reader features (TOC, anchors, skip link, breadcrumbs) | Yes, plus a theme toggle and a mobile drawer, both needing JavaScript. | Yes, with no JavaScript. Dark mode follows the system setting. |
| Outcome | Not adopted (D-24727). | Adopted; `v1.0.0` tagged, then `v1.1.0`. |

The fourth Copilot review put it in one line: Hextra isn't a theme swap
but a different platform philosophy. It brings a JavaScript-driven UI and
its own search, navigation, CSS and branding, while these wikis are built
on near-zero JavaScript, Pagefind, deterministic builds, and a
Studio-owned design.

### What the extraction cost

The pilot measured Hextra's effort. The extraction was assumed to be
cheaper until WP-814 ran. Its actuals:

- **Survey.** 27 items across the four copies (layouts, partials,
  shortcodes, hooks, CSS, config):
  - 8 common
  - 1 common config requirement
  - 11 near-common: the copies diverged in behavior and had to be
    reconciled. The largest drift was the link hook and the editing
    footer.
  - 7 wiki-specific: kept in each wiki, behind extension points.
- **The theme, `bb-studio-ewiki-theme` v1.1.0:**
  - 27 layout files (1,113 lines)
  - 3 CSS files (535 lines)
  - 4 PowerShell tools (1,531 lines): sync, check, gates, build compare
  - a 29-file fixture site
- **Elapsed.** The theme repo's first commit was at 08:15 on 2026-10-16;
  `v1.0.0` was tagged at 08:54 and `v1.1.0` at 11:30 (Pacific). That came
  after the WP-814 survey and plan (#2836, #2837). These are agent
  wall-clock times, not an estimate of human hours.
- **Packaging.** A vendored copy from a private repo, with no npm and no
  Go. A Hugo module was rejected because it needs Go and private-repo
  credentials in CI (D-24728). A git submodule wasn't evaluated.
- **The migrations, measured one at a time.** Each is its own packet, so
  the cost lands one wiki at a time. Corporate memory went first and is
  live on `v1.1.1` (2026-10-16). Herbs vs. Ailments is next: its packet
  (herbs WP-005) is drafted and waits on a theme `v1.2.0` allowance for
  its Mermaid diagrams. Then the studio ewiki (proposed), the personal
  wiki, and the engine ewiki last.

### Next step: move the remaining wikis onto `bb-studio-ewiki-theme`

The theme is extracted (WP-814). Its one shared copy is the private repo
`barefootbetters/bb-studio-ewiki-theme`, released as `v1.0.0` (commit `52f6c1b5`,
manifest digest `d3e03f52…` in the release notes). `v1.1.0` (commit
`b0971be5`) added two opt-in params for the corporate-memory viewer: a
folder's README as its section page, and folder links that open a
section page. Both are off by default, so a wiki that doesn't set them
renders as on `v1.0.0`. `v1.1.1` (commit `12400df5`) wraps long URLs on
narrow screens. D-24728 records where the theme lives and how a wiki
consumes it:

- **Vendored, not a Hugo module.** A wiki commits a tagged copy under
  `themes/ewiki/`, so no build needs Go, CI credentials for the private
  repo, or the network.
- **Read-only.** A manifest of every vendored file, a digest the wiki pins
  outside that copy, and a checker that fails on any edit or on a wiki
  file shadowing a core theme file keep the copy from drifting.
- **Closed extension points.** A wiki supplies its config, its brand
  tokens and logo, and a fixed set of extension partials (sidebar,
  metadata, after-content, editing-extra, head-end, body-end).

The extraction absorbed the Hextra wins that need no JavaScript: an "On
this page" table of contents (Hugo's `.TableOfContents`), heading
permalink anchors, a skip-to-content link and breadcrumbs. Dark mode
follows the reader's system setting, since a remembered toggle would need
script storage. The core still emits one script, the Pagefind loader.

Before the tag, a scratch shadow build of the engine ewiki on the theme
passed all five engine gates, with every link and image target kept. The
one exception is folder links, which now go to GitHub's folder view
instead of a redirect.

The wikis move in this order, each in its own packet:

1. corporate memory (done 2026-10-16, now on `v1.1.1`)
2. Herbs vs. Ailments (herbs WP-005, drafted; waits on theme `v1.2.0`)
   - **Proposed:** the studio ewiki right after herbs ([bb-studio-dashboard
     WP-014](https://github.com/barefootbetters/bb-studio-dashboard/blob/main/docs/ai/work-packets/WP-014-studio-ewiki-on-the-shared-theme.md), draft). It has the same shape as herbs (a `docs/` mount,
     Mermaid, the same footer), so herbs settles the open questions first.
     Its position is WP-014's call 4a, still Jeff's to make. A scratch
     trial on `v1.1.1` passed every gate but JS-free, which fails on one
     Mermaid page and waits on the same `v1.2.0` allowance.
3. the personal wiki
4. the engine ewiki, last

Each migration compares its wiki's build before and after the switch.

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

- **The theme lock and the JS-free gate stand.** The extracted theme is
  the theme WP-139 already locks and D-24293 already gates, so neither
  changes. Anything added during extraction has to pass the JS-free gate.
- **Hextra stays out unless a new D-entry brings it back** (D-24727 §4).
  A customer ewiki goes on the shared platform like every other ewiki.
- **Marketing is out of scope for convergence.** The shared platform is
  for the wikis. The marketing and Barefoot Betters sites stay on
  PaperMod until there is a business reason to move them.

## Open Questions

1. **Does the marketing site leave PaperMod?** Not now. Revisit when it
   needs a docs-style section.

Resolved:

- **Where does the platform live, and how do wikis consume it?** In its
  own private repo, `barefootbetters/bb-studio-ewiki-theme`, vendored into each wiki
  under `themes/ewiki/` rather than fetched as a Hugo module (D-24728,
  2026-10-16).

## References

- [WP-139](../docs/ai/work-packets/WP-139-engineering-wiki-viewer.md) — the engine ewiki's theme lock and the original Docsy/Hextra rejection
- [apps/wiki-viewer/README.md](../apps/wiki-viewer/README.md) — "Theme" section (lock and supersede rule)
- [.github/workflows/wiki-viewer.yml](../.github/workflows/wiki-viewer.yml) — the JS-free and determinism gates
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24725 (one shared wiki platform), D-24727 (theme: the current theme, extracted; Hextra not adopted), D-24728 (the theme lives in `barefootbetters/ewiki-theme`, since renamed `bb-studio-ewiki-theme`, vendored), D-24293 (Pagefind and the JS-free amendment), D-24690 (Worker hosting)
- [WP-814](../docs/ai/work-packets/WP-814-shared-wiki-theme-extraction.md) — the extraction: the survey of the four copies, the contract, and the shadow-build record
- [bb-studio-dashboard WP-014](https://github.com/barefootbetters/bb-studio-dashboard/blob/main/docs/ai/work-packets/WP-014-studio-ewiki-on-the-shared-theme.md) — the studio ewiki's migration packet (draft); decisions [2026-10-17-01](https://github.com/barefootbetters/bb-studio-dashboard/blob/main/docs/ai/decision-log/2026-10-17-01-the-studio-ewiki-is-the-studios-own-wiki.md) (the studio's own wiki) and [2026-10-17-02](https://github.com/barefootbetters/bb-studio-dashboard/blob/main/docs/ai/decision-log/2026-10-17-02-the-ewiki-products-marketing-page.md) (the product page)
- [barefootbetters/bb-studio-ewiki-theme](https://github.com/barefootbetters/bb-studio-ewiki-theme) — the shared theme (private); `v1.0.0` release notes carry the manifest digest
- [herbs-vs-ailments#247](https://github.com/barefootbetters/herbs-vs-ailments/pull/247) — the Hextra pilot and its evaluation (`apps/ewiki/HEXTRA-PILOT.md`), closed unmerged
- [Hextra on GitHub](https://github.com/imfing/hextra) — the theme evaluated (MIT; FlexSearch search; no Node.js needed to use it)
