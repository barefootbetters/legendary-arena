---
title: Branding
type: Brand
tags:
  - brand
  - logo
  - design
  - identity
  - assets
related:
  - figma-logo-design.md
  - design-system-overview.md
  - workspace-map.md
  - hugo-web-system.md
  - soul-of-legendary-arena.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\branding.md (this page — https://ewiki.legendary-arena.com/branding/)
  - C:\pcloud\LA\brand\README.txt
  - C:\www\legendary-arena-com\static\brand-tokens.css
last-reviewed: 2026-09-04
---

# Branding

> This page is the visual index of the **approved** Legendary Arena marks —
> which logo is current, what each variant is for, and where the master
> files live. It shows the marks; it does not own them. The approved
> master files live in `C:\pcloud\LA\brand\` and the colour/type tokens
> live in the marketing repo's `brand-tokens.css`. Where this page and
> those sources disagree, the sources win.

## Summary

Legendary Arena's identity is a single emblem split down the centre: a
gold winged sword (the hero, the light) mirrored against a white bone-and-horn
mark (the villain, the dark). That good-versus-evil duality is the
[soul of the game](soul-of-legendary-arena.md) made into a logo. Three
approved marks are derived from it — a horizontal lockup, the square emblem,
and the isolated gold hero half — and this page renders each one so anyone
reaching for a logo can take the right file without hunting for a newer version.

## Mechanics

### The approved marks

**Primary horizontal lockup.** The emblem with the `LEGENDARY / ARENA`
wordmark. Use this wherever there is horizontal room and the name should
read alongside the mark: site headers, press, marketing heroes, video
lower-thirds, email banners.

![Legendary Arena primary horizontal lockup — the split hero/villain emblem to the left of the word LEGENDARY set in a gold gradient with ARENA below it in white between two gold flourishes, on a black field.](/branding/logo-la-lockup-black.png "width=80%")

*Rendered from the master `Legendary Arena-400x200.ai`. The `.ai` is a
vector source and does not render on the JavaScript-free wiki, so the
on-page artifact is a flattened PNG; the vector master remains the file
you export from.*

**Square dual emblem.** The mark on its own, no wordmark, in a square
frame. Use this where the identity has to work as a single tile: favicon,
app icon, social avatar, game HUD badge, the pip on a card back.

![Legendary Arena emblem — the hero/villain mark centered on black: a gold winged sword forming the left half and a white horned, skull-like mark mirroring it on the right, meeting at a single vertical blade.](/branding/logo-la-emblem-black.jpg "width=40%")

**Gold hero half.** The left (hero) side of the emblem alone — a gold
winged sword — on a transparent field. Use this for single-colour and
hero-side contexts: watermarks, gold-on-dark accents, loading spinners,
places where the full villain half would be visual noise.

![Legendary Arena gold hero mark — a single upright golden sword rising from a hilt with a fan of gold feathered wing to the left and radiating light-spikes behind the blade, on a transparent field.](/branding/logo-la-hero-gold.png "width=30%")

**Vector emblem master (SVG).** A scalable vector of the square emblem,
traced from the emblem raster in `segments.zip`. The hero half carries one
continuous brand-gold gradient; the villain half is white; the stroke-work
is near-black. It is a transparent master — use it for the favicon, the app
HUD badge, and anywhere the mark must scale crisply without a raster step.
Because the emblem is designed for dark surfaces, the version shown here sits
on a dark plate (on a light page the white villain half would disappear);
the flat transparent master is `logo-la-emblem.svg`.

![Legendary Arena emblem as a vector, on a dark rounded plate — the gold winged sword hero half on the left with a continuous gold gradient, mirrored by the white horned villain skull on the right.](/branding/logo-la-emblem-on-dark.svg "width=34%")

*Traced with [vtracer](https://github.com/visioncortex/vtracer) from the
matted raster `emblem-trace-source.png` (a flattened export of `segments.zip`).
Generator: [build-emblem-svg.py](../ewiki/branding/build-emblem-svg.py) —
regenerate both SVGs with `python build-emblem-svg.py`. This is an autotrace:
clean and fully scalable, but not a hand-tuned master — a from-scratch vector
rebuild (see [Figma Logo Design](figma-logo-design.md)) would place every
anchor by hand.*

### Which file, and where the masters live

| Mark | On-wiki artifact (`ewiki/branding/`) | Approved master (source of truth) |
|---|---|---|
| Horizontal lockup | `logo-la-lockup-black.png` (1600 px wide) | `C:\pcloud\LA\brand\Legendary Arena-400x200.ai` |
| Square emblem (raster) | `logo-la-emblem-black.jpg` (1408 × 1408) | `C:\pcloud\LA\brand\logo-la-black.jpg` |
| Square emblem (vector master) | `logo-la-emblem.svg` (transparent) | traced from `C:\pcloud\LA\brand\segments.zip` |
| Square emblem (vector, dark plate) | `logo-la-emblem-on-dark.svg` | same trace, for light-background display |
| Gold hero half | `logo-la-hero-gold.png` (800 × 800, transparent) | `C:\pcloud\LA\brand\Logo-LA-800x800.png` |

The two emblem SVGs and their trace input (`emblem-trace-source.png`) are
generated by `ewiki/branding/build-emblem-svg.py`; the two SVGs never drift
because a single run emits both. The trace is deterministic — re-running the
generator on the same input is byte-identical.

The layered/editable sources — the `.ai` master and `segments.zip`
(the emblem's raster layers: the gold wing, the stylized face, the
background) — stay in `C:\pcloud\LA\brand\` and are **not** copied into this
repo. The one exception is the flattened `emblem-trace-source.png` committed
here so the emblem SVG is reproducible from repo contents. The brand
folder's own rule is that
a source filed beside its flattened export becomes two files that drift
apart; the export ships, the source stays where it is edited.

### Colour and type are tokens, not files here

The hex values, font stacks, and spacing scale are **not** stored on this
page. They live in `C:\www\legendary-arena-com\static\brand-tokens.css`,
which is the source of truth consumed by the live `play.*` and `cards.*`
surfaces. A swatch on this page would be a snapshot that can disagree with
the CSS; the CSS is always right. The load-bearing tokens for the marks:

| Token | Role |
|---|---|
| `--la-color-gold` | The primary gold (`#b8901f` on light, `#d4af37` on dark). |
| `--la-color-gold-bright` | The highlight gold in the wordmark gradient. |
| `--la-font-display` | Bebas Neue — the display face the `LEGENDARY / ARENA` wordmark is built from. |

Changing a token *name* breaks downstream consumers on the live sites —
treat it as a code change, not a design tweak.

## Interactions

- [Figma Logo Design](figma-logo-design.md) — the deterministic
  inputs-to-outputs pipeline for *building* the mark in Figma. This page
  is the shipped result of that process; that page is how you rebuild or
  extend it.
- [Workspace Map](workspace-map.md) — the authoritative map of which
  surface owns which kind of work. It is where `C:\pcloud\LA\brand\` is
  established as the home for approved brand assets; this page is the
  visual index of what is filed there.
- [Design System Overview](design-system-overview.md) — the broader
  design language (colour roles, class palette, motion) the marks sit
  inside.
- [Hugo Web System](hugo-web-system.md) — how the marketing site consumes
  `brand-tokens.css` and the exported logo files in its templates.
- [Soul of Legendary Arena](soul-of-legendary-arena.md) — the
  good-versus-evil premise the split emblem embodies.

## Edge Cases

- **The `.ai` will not render on the wiki.** The wiki is JavaScript-free
  and serves flattened raster/SVG only. The horizontal lockup on this page
  is a PNG rendered from the vector master; to change the lockup you edit
  the `.ai`, re-export, and replace the PNG — you do not edit the PNG.
- **Two sources of truth, by design.** The *marks* are governed by
  `C:\pcloud\LA\brand\` (README rule: if a file is in that folder it is
  current and cleared for use). The *tokens* are governed by
  `brand-tokens.css` in the marketing repo. This page mirrors both and
  owns neither; when it drifts from either, the source wins and this page
  is what gets corrected.
- **Version by replacement, not by suffix.** When a mark is superseded,
  the old master moves out of `C:\pcloud\LA\brand\` (to `LA\logo-drafts\`
  or deletion) — it does not linger with a longer filename. If you update
  a master, re-render the matching artifact under `ewiki/branding/` in the
  same change so the wiki does not show a stale mark.
- **Card art is not a brand asset.** Card images are game data served from
  Cloudflare R2 at `images.legendary-arena.com`; they never live in the
  brand folder or here.
- **Committed vs. dropped assets.** An image only publishes if it is
  committed under `ewiki/branding/`; the build projects that folder to the
  Hugo static root and serves it at `/branding/<file>`. A file dropped into
  the projected `static/` copy is git-ignored and will not ship.

## Open Questions

- **The formal brand book is not written yet.** Clear-space, minimum-size,
  the light/dark background matrix, and do-and-don't examples belong in
  `C:\pcloud\LA\brand\guidelines\` (per the brand-folder structure) and do
  not exist at this revision. The usage notes above are practical
  recommendations grounded in how each mark is drawn, not a ratified spec.
  Until the guidelines are authored, treat clear-space and minimum-size as
  operator judgement, not a locked rule.
- **The emblem SVG is an autotrace, not a hand-built master.** `logo-la-emblem.svg`
  is a faithful, fully scalable vtracer trace of the emblem raster — good for
  the favicon, HUD badge, and web scaling. It is not a hand-tuned vector: a
  from-scratch rebuild via the [Figma Logo Design](figma-logo-design.md)
  pipeline would place every anchor deliberately and is the path to a
  production master if one is needed. There is still **no vector master for
  the horizontal lockup or the wordmark** — those exist only as the `.ai`
  plus raster exports.

## References

- `C:\pcloud\LA\brand\README.txt` — the approved-assets folder contract:
  what is cleared for use, the approved-vs-drafts split, the
  version-by-replacement and don't-copy-sources rules, and the naming
  convention.
- `C:\pcloud\LA\brand\` — the approved masters: `Legendary Arena-400x200.ai`
  (lockup), `logo-la-black.jpg` (emblem), `Logo-LA-800x800.png` (gold hero
  half), and `segments.zip` (the emblem's raster layers, the trace input for
  `logo-la-emblem.svg`).
- `C:\www\legendary-arena-com\static\brand-tokens.css` — the source of
  truth for brand colour, type, and spacing tokens consumed by the live
  sites.
- [Figma Logo Design](figma-logo-design.md) — the construction pipeline
  that produces the marks.
- [Workspace Map](workspace-map.md) — establishes `C:\pcloud\LA\brand\` as
  the home of approved brand assets.
