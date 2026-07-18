---
title: Blog Post Authoring
type: Tutorial
tags:
  - hugo
  - marketing-site
  - content-strategy
  - designer-reference
related:
  - ewiki-authoring.md
  - wiki-viewer.md
  - hugo-web-system.md
  - homepage-appendix.md
  - brevo-email-pipeline.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\blog-post-authoring.md (this page — https://ewiki.legendary-arena.com/blog-post-authoring/)
  - C:\www\legendary-arena-com\archetypes\posts.md
  - C:\www\legendary-arena-com\docs\04-CONTENT-CONVENTIONS.md
  - C:\www\legendary-arena-com\docs\05-SEO-CONVENTIONS.md
  - C:\www\legendary-arena-com\docs\06-CONTENT-LANE-WORKFLOW.md
  - C:\www\legendary-arena-com\layouts\_partials\cta-block.html
  - C:\www\legendary-arena-com\docs\brand\strategy.md
  - C:\www\legendary-arena-com\docs\marketing\homepage-review-template.md
  - C:\www\legendary-arena-com\docs\marketing\homepage-appendix.md
  - C:\www\legendary-arena-com\static\brand-tokens.css
last-reviewed: 2026-07-18
---

# Blog Post Authoring

> **Editing this page**
>
> This ewiki page is the authoring guide for blog posts on
> `www.legendary-arena.com`. The blog lives in the marketing repo
> at `C:\www\legendary-arena-com\content\posts\`.
>
> - **To edit this ewiki page:** edit
>   `C:\pcloud\BB\DEV\legendary-arena\wiki\blog-post-authoring.md` in the
>   `legendary-arena` repo and open a **PR** — wiki edits do not go
>   direct to `main`. Prefix `INFRA: wiki blog-post-authoring — <what
>   changed> (#PR)`, matching the surrounding `git log -- wiki/` history.
>   (`SPEC:` is for design/governance locks, not page edits.)
>   Deploy is not automatic on merge: `.github/workflows/wiki-viewer.yml`
>   fires the Render deploy hook, and a green build alone does not prove
>   the deploy step ran.
> - **Authoritative sources:** Content conventions live at
>   `C:\www\legendary-arena-com\docs\04-CONTENT-CONVENTIONS.md`;
>   brand voice lives at
>   `C:\www\legendary-arena-com\docs\brand\strategy.md`.

## Summary

A step-by-step guide for writing, styling, and publishing blog posts
on `www.legendary-arena.com`. Covers the Hugo front-matter contract,
the Mode C (Authority) content framework, brand voice and terminology,
image conventions, and the CTA system. All blog content should
reinforce the positioning established in the
[Homepage Review Template](homepage-review-template.md) — the same
28-problem catalog, the same SB7 framework, the same Player Needs
Pyramid.

## Mechanics

### Quick Start

Create a new post:

```
hugo new content posts/<slug>.md
```

This generates a file from the archetype at
`C:\www\legendary-arena-com\archetypes\posts.md` with all required
front-matter fields pre-populated. (The bare `hugo new posts/<slug>.md`
form still works on the pinned Hugo v0.161.1 but is deprecated; prefer
`hugo new content`.)

**Gauntlet Guides use their own archetype — do not use the one above.**
Pass `--kind gauntlet-guide` and every gauntlet field below is
pre-populated for you:

```
hugo new content posts/<slug>.md --kind gauntlet-guide
```

(Superseded note, corrected 2026-07-18: this page previously said the
archetype omits the gauntlet fields and that they must be added by hand.
That stopped being true when WP-038 shipped
`C:\www\legendary-arena-com\archetypes\gauntlet-guide.md`.) See
[Gauntlet Guides](#gauntlet-guides-series-specific-added-2026-07) below
for what that archetype enforces.

### Blog Post Template

```yaml
---
title: "Sentence-case headline; no trailing punctuation"
date: 2026-05-14
description: "1-2 sentences, max 160 chars (SEO + social preview)"
draft: false
tags: ["lowercase", "kebab-case"]
categories: ["broader-category"]
series: "Optional series name"
cta: "play"
newsletter_week: 0
newsletter_slug: ""
---
```

#### Front-Matter Field Reference

| Field | Required | Rule |
|-------|----------|------|
| `title` | yes | Sentence-case headline; no trailing punctuation |
| `date` | yes | ISO 8601 date (e.g., `2026-05-14`) |
| `description` | yes | 1-2 sentences, max 160 characters; used for SEO meta description and social share previews |
| `draft` | yes | `false` for anything intended to publish |
| `tags` | yes | Lowercase kebab-case array; reuse existing tags before inventing new ones |
| `categories` | yes | Broader than tags; same naming rules |
| `series` | no | Series name for prev/next linking (e.g., `"Fundamentals"`) |
| `cta` | yes | `"play"` (default), `"newsletter"`, or `"tournament"` |
| `newsletter_week` | no | Week number for newsletter cross-reference |
| `newsletter_slug` | no | Must match the newsletter's "Read more" link |

#### Gauntlet Guides Fields (series-specific, added 2026-07)

The Gauntlet Guides series carries three extra fields. Two are metadata
only; `gauntlet_board` becomes load-bearing when WP-037 merges.

| Field | Consumed by |
|-------|-------------|
| `gauntlet_set` | nothing yet — reserved for a gauntlet index |
| `gauntlet_mastermind` | nothing yet — reserved for a gauntlet index |
| `gauntlet_board` | `cta-block.html`, to build the `cta: "leaderboard"` href (**pending WP-037**) |

A wrong `gauntlet_board` id produces a syntactically valid URL to a board
that does not exist. Hugo cannot catch this — verify the id against the
live gauntlet catalog.

| Field | Rule | Observed values |
|-------|------|-----------------|
| `gauntlet_set` | Set code, lowercase | `core`, `co2e`, `shld` |
| `gauntlet_mastermind` | Mastermind slug, kebab-case | `red-skull`, `magneto`, `hydra-high-council` |
| `gauntlet_board` | Leaderboard board id; must match the live gauntlet catalog | `gauntlet-co2e-red-skull`, `gauntlet-core-magneto`, `gauntlet-shld-hydra-high-council` |

Gauntlet posts also use `categories: ["gauntlet-guides"]`,
`series: "Gauntlet Guides"`, and `guide_version` (bump the minor on a
strategic revision, the major when the scoring model changes what the
guide claims), and omit the `newsletter_*` fields.

#### The gauntlet archetype is the authority on content, not just fields

`C:\www\legendary-arena-com\archetypes\gauntlet-guide.md` is not a
front-matter stub — it carries the editorial rules the series is held to,
as comments that you delete as you write. Read it before drafting; the
short version:

**Three buckets.** Every fact in a gauntlet post is one of:

- **DERIVED** — generate it, never type it. Set, mastermind, scheme
  count, leg list, twist counts, Evil-Wins thresholds, escape budgets,
  per-count setup, Fixed-Pool budgets, card art URLs. Produced by
  `node scripts/gauntlet-post-block.mjs <setAbbr> <mastermindSlug>` in
  this repo. Hand-typed copies rot on the next set change — three
  different gauntlet counts were once live in the wiki simultaneously.
- **JUDGMENT** — hand-written reasoning, labelled as reasoning. Pool
  construction, per-leg pressures, common mistakes.
- **BLOCKED** — claims no data supports. PAR ranges, difficulty or
  score-risk ratings, expected-results-by-skill-level tables, clear
  rates, "usually"/"typically" frequency claims. `competitive_scores`
  is empty and PAR is deliberately unpublished, so these would be
  invented. Leave the gap visible.

**Scoring claims must match [Scoring](scoring.md).** Assert only the
three structural invariants `validateScoringConfig` enforces
(`bystanderReward > villainEscaped`; `bystanderLost > villainEscaped`;
`bystanderLost > bystanderReward`). Nothing ranks `victoryPointReward`
against `bystanderReward` — that is per-scenario config — so neither
"maximise VP first" nor its mirror may be written. And per
[Penalty producer status](scoring.md#penalty-producer-status--four-of-five-safe-skip-to-zero),
do not tell readers casualties cost them anything today; the counter has
no producer.

If this page and the archetype disagree, **the archetype is
authoritative** for gauntlet post content — it ships with the template
and is what an author actually reads at drafting time.

### File Naming

**The documented rule** (`docs\04-CONTENT-CONVENTIONS.md` line 313) is
date-prefix + kebab-case. The date prefix keeps file listings
chronological and disambiguates posts that reuse a topic word. No
spaces, capitals, or non-ASCII in slugs — ever.

```
2026-05-07-launch-announcement.md  -> /posts/2026-05-07-launch-announcement/
week-01-deck-checklist.md          -> /posts/week-01-deck-checklist/
```

> **Practice diverges from the rule (observed 2026-07-18).** Of the 58
> files in `content\posts\`, exactly **one** carries a date prefix
> (`2026-05-07-launch-announcement.md`). The other 57 use bare
> kebab-case — the 52 `week-NN-*` series files, which are already
> self-ordering, plus `hello-arena.md` and the three `gauntlet-*`
> guides.
>
> So the date prefix is the documented rule but the rare exception in
> practice. This page does not resolve the conflict:
> `04-CONTENT-CONVENTIONS.md` is authoritative on naming, and changing
> it is a `SPEC:` decision. Match the surrounding series when adding to
> one; for a standalone post, follow `04` until it says otherwise.

### Content Structure (Mode C — Authority)

Blog posts follow **Mode C (Authority)** from the content framework
in the [Homepage Appendix](homepage-appendix.md). The structure is:

**Problem -> Deep Analysis -> System/Solution -> Result -> Expansion**

| Section | Purpose | Length |
|---------|---------|--------|
| Problem | Clear, specific problem statement | 1-2 paragraphs |
| Deep Analysis | Why it exists, why it persists, what others get wrong | 2-4 paragraphs |
| System/Solution | The concept or methodology with evidence | Body of the post |
| Result | What changes when you apply the solution | 1-2 paragraphs |
| Expansion | Examples, applications, next-post teaser | 1-2 paragraphs |

A blog post is not "here's the answer" — it's "here's why this
answer is correct." The goal is **education + SEO authority**, not
conversion. Conversion is Mode A (Sales) — that's the homepage.

#### How Mode C Differs from Mode A and Mode B

| Mode | Used For | Problem Visibility | Product Visibility |
|------|----------|-------------------|-------------------|
| A (Sales) | Homepage, landing pages, campaign emails | Explicit headline | Named, CTA-driven |
| B (Narrative) | Newsletters, community posts, Discord | Implicit / story | Context, not pitch |
| C (Authority) | Blog posts, guides, long-form | Explicit + analyzed | Explained with evidence |

### Connecting to the 28-Problem Catalog

Every blog post should connect to one or more of the 28 problems
from the [Homepage Review Template](homepage-review-template.md).
This ensures consistent messaging across the entire marketing
surface.

The 28 problems are organized into four themes:

| Theme | Villain | Key Problems |
|-------|---------|--------------|
| **Fairness** | The pay-to-win model | #1-6 |
| **Skill Measurement** | Opaque/unverifiable systems | #7-10 |
| **Authenticity** | Unfaithful digital adaptations | #11-20 |
| **Scalability** | The physical game doesn't scale | #21-28 |

When writing a blog post:

1. **Identify the problem number(s)** the post addresses.
2. **Use the same language** — the problem catalog is written in
   customer-facing voice. Match it.
3. **Follow the SB7 levels** — the catalog gives external, internal,
   and philosophical problem levels for each entry. Use the level
   that fits the post's tone:
   - External for factual/analytical posts
   - Internal for empathy-driven narrative
   - Philosophical for opinion/vision pieces

#### Example Mapping

A post about deck-building strategy connects to:

- Problem #3 (balance patches destroy learned strategy) — external
- Problem #6 (competition rewards repetition over mastery) — internal
- Problem #7 (skill is hard to measure objectively) — philosophical

The post doesn't need to name these problems explicitly. The
connection ensures the underlying messaging stays consistent.

### Brand Voice and Terminology

**Voice:** Direct, confident, heroic, no irony, no hype. Read
`C:\www\legendary-arena-com\docs\brand\strategy.md` before writing.

**Canonical terms** (one concept = one term across all three sites):

| Term | Meaning |
|------|---------|
| Hero | Playable character |
| Mastermind | Final boss |
| Scenario | Game session setup |
| Villain group | Minion enemies |
| Scheme twist | Escalating threat mechanism |
| Session | Complete game instance |
| Mastery | Player skill/progression |
| Victory | Game win condition |

**Failure modes** (any of these in shipped output is a bug):

- Generic adjectives leading copy ("fun", "exciting", "epic")
- Mechanics-first explanation (problem-first wins)
- Terminology drift across pages
- Raw color/font/spacing values (use brand tokens)
- Emoji, humor undermining stakes, conversational filler
- External IP dependency (avoid Marvel references)
- Self-deprecation ("fan-made", "amateur", "side project")
- Questions as headlines

**Tone test:** Read the new post aloud back-to-back with an existing
page (home or about). If one sounds like a different writer, rewrite.

### Brand Tokens

Blog posts inherit the site's brand tokens from
`C:\www\legendary-arena-com\static\brand-tokens.css`. Authors don't
write CSS directly, but understanding the token system helps maintain
visual consistency when describing colors or requesting design
changes.

**Typography:**

| Token | Value | Usage |
|-------|-------|-------|
| `--la-font-display` | Bebas Neue, Anton, Oswald | Headlines (h1, hero) |
| `--la-font-body` | Inter, system-ui | Body text, paragraphs |
| `--la-font-mono` | JetBrains Mono, IBM Plex Mono | Code blocks |

**Colors (light mode):**

| Token | Value | Usage |
|-------|-------|-------|
| `--la-color-text-primary` | `#1a1d2e` | Body text |
| `--la-color-bg-primary` | `#fdfcf8` | Page background (warm off-white) |
| `--la-color-gold` | `#b8901f` | Victory, highlights |
| `--la-color-red` | `#7a1d1f` | CTA buttons (pinned) |
| `--la-color-blue` | `#1e3a8a` | Links, accents |

**Gameplay mapping:**

| Token | Maps To | Usage |
|-------|---------|-------|
| `--la-color-attack` | `--la-color-red` | Attack-themed content |
| `--la-color-recruit` | `--la-color-blue` | Recruit-themed content |
| `--la-color-victory` | `--la-color-gold` | Victory/achievement |

**Spacing:** 8-point grid (`--la-space-1` = 4px through
`--la-space-6` = 32px).

Never use raw hex values, font names, or pixel values in any
surface that could be tokenized. Reference the token name instead.

### Images

**Storage:** `C:\www\legendary-arena-com\static\images\posts\<slug>\`

The image directory name MUST match the post slug exactly.

```
static/images/posts/week-01-deck-checklist/
  hero.webp              # Primary image (target 80-120KB)
  curve-example.webp
  deck-flow-diagram.webp
```

**Referencing in markdown:**

```markdown
![Deck curve example](/images/posts/week-01-deck-checklist/curve-example.webp)
```

**Format rules:**

| Format | When |
|--------|------|
| `.webp` | Preferred (best compression) |
| `.png` | When transparency is required |
| `.jpg` | Photography/stock where WebP is impractical |

**Size budget:** Max 200KB per image. Hero images target 80-120KB.
Diagrams typically compress under 50KB.

**Alt text:** Describe what the image *says*, not what it *is*.
"A row of hero cards fanned out on a dark wood table" beats "image".

**Determinism:** All images must exist in-repo. External image
hosting is prohibited.

### CTA System

The `cta` front-matter field determines the end-of-post action block.

**The set is closed and enforced in the template.** `cta-block.html`
tests membership in a fixed slice and **silently rewrites anything else
to `"play"`** — no build warning, no error. An unrecognized value is not
a no-op; it renders the wrong CTA.

| Value | Renders | Use When |
|-------|---------|----------|
| `"play"` | "Play now" → `play.legendary-arena.com` | Default; strategy/gameplay posts |
| `"newsletter"` | Inline newsletter signup (`newsletter-form.html`) | Community/engagement posts |
| `"tournament"` | "Enter a tournament" → `play.legendary-arena.com` | Tournament announcements |
| `"leaderboard"` ⏳ | "View the gauntlet" → the post's own board | Gauntlet guides — **pending WP-037, see below** |

#### `"leaderboard"` — pending, not yet live

`"leaderboard"` is **not** in the deployed template. It is added by
marketing-repo **WP-037** (PR
`legendary-arena/legendary-arena-website#71`), open as of 2026-07-18.
Until that merges, a post setting `cta: "leaderboard"` still renders
"Play now".

Once merged, the branch builds its href from the post's `gauntlet_board`
field:

```
https://legends.legendary-arena.com/#/gauntlet/<gauntlet_board>
```

falling back to the leaderboard root (label "View the leaderboard") when
`gauntlet_board` is absent. WP-037 also removes the hand-written
`[View the <name> gauntlet →]` link from the end of each gauntlet post,
since the CTA block renders directly below the body and keeping both
would stack two identical links.

**When WP-037 merges, delete this subsection**, drop the ⏳ from the table
row, and update the Gauntlet Guides field note above (`gauntlet_board`
stops being inert metadata and becomes load-bearing).

> **Worked example — `cta: "leaderboard"` (caught and resolved 2026-07-18).**
>
> The three Gauntlet Guides posts originally shipped with
> `cta: "leaderboard"` (commits `be2751e`, `fbbbb83`). That value is not
> in the allowed slice, so all three silently rendered the **"Play now"**
> block. Nothing failed; the CTA was just wrong.
>
> Both routes were then taken, in order:
>
> 1. **Content lane (shipped, `7dbcf65`).** Changed the posts to
>    `cta: "play"`. Stays inside `content/**`, ships under a
>    `POST:`/`FIX:` prefix, no work packet. Made the posts *valid* — but
>    not *right*: each still ended with a hand-maintained board link, and
>    `gauntlet_board` was read by nothing.
> 2. **Template lane (pending, WP-037).** Taught `cta-block.html` the
>    value properly. Touches `layouts/`, so it required a `WP-NNN:` work
>    packet and could not ride the content lane.
>
> The lesson generalizes: **an invented `cta` value fails silently.** If a
> post needs an action the closed set doesn't cover, either link it in the
> post body or open a `WP-NNN:` to extend the partial. Do not invent a
> value and assume it renders.
>
> Worth noting what would have caught this earlier: a build-time `warnf`
> on an unrecognized `cta`. WP-037 deliberately leaves that out of scope —
> it changes build behaviour repo-wide — so the failure mode is still
> silent for any *future* invented value. Only the specific
> `"leaderboard"` case is closed.

The CTA block partial lives at
`C:\www\legendary-arena-com\layouts\_partials\cta-block.html` and is the
authoritative mapping — `docs\04-CONTENT-CONVENTIONS.md` (line 416)
explicitly defers to it.

### Internal Linking

**Series navigation:** Posts in the same `series` auto-link via
Hugo's `.PrevInSection` / `.NextInSection`. PaperMod's
`ShowPostNavLinks = true` renders prev/next nav automatically.

**Newsletter cross-reference:** The `newsletter_slug` field ties
each post to its companion newsletter. Must match between the post
and the email's "Read more" link.

**External link targets:**

| Destination | Behavior |
|-------------|----------|
| `play.*`, `cards.*`, `ewiki.*` | Same tab (ecosystem internal) |
| Third-party sites | New tab (`target="_blank" rel="noopener"`) |

### Commit Prefixes (Marketing Repo)

| Prefix | When |
|--------|------|
| `POST:` | New blog post (content lane: `content/**` + `static/images/**`) |
| `FIX:` | Content-lane edits (typo, copy tweak, broken link) |
| `WP-NNN:` | Site-affecting changes (layouts, config, templates) |
| `SPEC:` | Governance doc corrections |

The content lane is enforced by commit hooks: a `POST:` or `FIX:`
commit that touches anything outside `content/**` and
`static/images/**` — including `layouts/`, `hugo.toml`, or
`static/brand-tokens.css` — is **rejected**. That is why the
`cta: "leaderboard"` fix above cannot ride along as a `FIX:`. Full
workflow: `C:\www\legendary-arena-com\docs\06-CONTENT-LANE-WORKFLOW.md`.

### Publishing

```
git add content/posts/<slug>.md static/images/posts/<slug>/
git commit -m "POST: <post title>"
git push origin main
```

Cloudflare Pages auto-deploys within ~30 seconds. The post appears
at `https://www.legendary-arena.com/posts/<slug>/`.

For preview before merge: push to a branch and open a PR. The
Cloudflare GitHub app comments a preview URL on the PR.

### Local Preview

```
hugo server --port 1313 --bind 127.0.0.1
```

Search is not available locally (Pagefind is build-time only).

### Annotated Blog Post Example

```markdown
---
title: "Why your deck loses before the game starts"
date: 2026-06-01
description: "Most losses trace back to deck construction, not
  in-game decisions. A structured approach to building beats
  intuition every time."
draft: false
tags: ["deck-building", "strategy", "fundamentals"]
categories: ["strategy"]
series: "Fundamentals"
cta: "play"
newsletter_week: 4
newsletter_slug: "week-04-deck-construction"
---

<!-- PROBLEM (1-2 paragraphs) -->
<!-- Connects to Problem #3 (balance patches), #6 (repetition
     over mastery). Don't name the numbers — just use the same
     language and emotional register. -->

You built a deck around the strongest cards you own. It should
work. But three games in, you're losing to players with cards
you've never even considered.

The issue isn't the cards — it's the construction.

<!-- DEEP ANALYSIS (2-4 paragraphs) -->
<!-- Why does this problem exist? Why does it persist? What do
     most players get wrong? -->

Most players build top-down: pick the best cards, fill the gaps.
This produces decks that look powerful in isolation but collapse
under pressure...

<!-- SYSTEM/SOLUTION (body of the post) -->
<!-- The methodology, with evidence. This is where depth lives. -->

## The seven-point construction checklist

1. **Write a strategy sentence.** One sentence that describes
   what your deck does...

<!-- RESULT (1-2 paragraphs) -->
<!-- What changes when you apply this? -->

A deck built this way produces consistent, playable hands. You
stop losing to variance and start losing to better strategy —
which is exactly where improvement begins.

<!-- EXPANSION (1-2 paragraphs) -->
<!-- Next-post teaser, broader implications. -->

Next week: reading the resource curve — why the shape of your
deck's cost distribution matters more than its ceiling.
```

## Interactions

- **[Homepage Review Template](homepage-review-template.md)** — The
  28-problem catalog and SB7 framework that anchors all marketing
  messaging. Blog posts should map to one or more catalog problems
  for consistency.
- **[Homepage Appendix](homepage-appendix.md)** — Contains the
  content framework (Mode A/B/C) that governs how Problem -> Product
  -> Result is expressed across different content types. Blog posts
  use Mode C (Authority).
- **[Brevo Email Pipeline](brevo-email-pipeline.md)** — Newsletters
  use Mode B (Narrative) and cross-reference blog posts via
  `newsletter_slug`. Each blog post can link to its companion
  newsletter.
- **[Ewiki Authoring](ewiki-authoring.md)** — Style guide for ewiki
  content. Blog posts use a different Hugo theme (PaperMod) with
  different CSS, but the markdown syntax is standard.
- **[Hugo Web System](hugo-web-system.md)** — The marketing site's
  Hugo architecture. Blog posts render through the PaperMod template
  hierarchy with project-level overrides.

## Edge Cases

- **Newsletter slug mismatch.** If `newsletter_slug` in the blog
  post doesn't match the newsletter's "Read more" link, the
  cross-reference breaks silently. No automated check exists.
- **Image directory mismatch.** The image directory name under
  `static/images/posts/` must match the post slug exactly. A
  mismatch means images won't resolve.
- **Series ordering.** Posts in a series are ordered by date. If two
  posts share a date, the prev/next navigation may be wrong. Use
  distinct dates for series posts.
- **Draft visibility.** Posts with `draft: true` are visible in local
  dev mode but excluded from production builds. Don't forget to flip
  to `false` before pushing.
- **SEO description length.** Descriptions over 160 characters are
  truncated in search results and social previews. The SEO
  conventions doc (`05-SEO-CONVENTIONS.md`) governs the full
  discipline.
## References

- `C:\www\legendary-arena-com\archetypes\posts.md` — post archetype
  template
- `C:\www\legendary-arena-com\docs\04-CONTENT-CONVENTIONS.md` —
  content authoring conventions
- `C:\www\legendary-arena-com\docs\05-SEO-CONVENTIONS.md` — SEO
  discipline
- `C:\www\legendary-arena-com\docs\06-CONTENT-LANE-WORKFLOW.md` —
  `POST:` / `FIX:` content-lane rules and hook enforcement
- `C:\www\legendary-arena-com\docs\brand\strategy.md` — brand voice,
  terminology, failure modes
- `C:\www\legendary-arena-com\docs\marketing\homepage-review-template.md`
  — 28-problem catalog and SB7 framework
- `C:\www\legendary-arena-com\docs\marketing\homepage-appendix.md`
  — content framework (Mode A/B/C)
- `C:\www\legendary-arena-com\static\brand-tokens.css` — brand token
  CSS variables (v1, locked)
- `C:\www\legendary-arena-com\layouts\single.html` — single post
  layout
- `C:\www\legendary-arena-com\layouts\_partials\cta-block.html` —
  CTA block partial
