---
title: Workspace Map
type: Guide
tags:
  - storage
  - findability
  - governance
  - workflow
  - layer-marketing
related:
  - branding.md
  - data-file-locations.md
  - workstation-layout-migration.md
  - video-production-workflow.md
  - youtube-channel-plan.md
  - blog-post-authoring.md
  - development-workflow.md
  - ewiki-authoring.md
  - newsletter-authoring.md
  - monetization-model.md
  - gameplay-video-production-youtube.md
status: draft
source:
  - C:\dev\legendary-arena\wiki\workspace-map.md (this page — https://ewiki.legendary-arena.com/workspace-map/)
  - ../docs/01-REPO-FOLDER-STRUCTURE.md
  - ../render.yaml
  - ../.env.example
  - ../data/migrations/011_create_entitlements.sql
  - ../data/migrations/012_create_stripe_events_and_checkout_sessions.sql
  - ../apps/server/src/profile/avatarUpload.logic.ts
last-reviewed: 2026-09-29
---

# Workspace Map

## Summary

The locator map **above** the repo: which storage surface owns which
kind of work, across pCloud, the git repositories, and the hosted
services. [Data & File Locations](data-file-locations.md) answers
*"where in this repo does X live?"* — this page answers the layer
above it, *"which of my three storage surfaces does X belong to at
all?"*, and names every top-level bucket on each.

It also records **who owns which data** — which system is authoritative
for payments, player accounts, subscribers, and business documents — since
that question outlives any particular file.

It is a **navigation hub**, not an authority. The repos, the deploy
config, the database migrations, and the workflow pages cited here remain
the source of truth.

## Mechanics

### The three storage surfaces

Every file in this workspace belongs to exactly one of three surfaces.
The surface is chosen by what the file *is*, not by what project it
belongs to.

| Surface | Holds | Why |
|---|---|---|
| **Git** (GitHub repos) | Text that must be reviewed, diffed, and versioned: code, docs, wiki pages, content markdown, small committed images | Review and history are the product. A file nobody would want a diff of does not belong here. |
| **pCloud** (`C:\pcloud\…`) | Work-in-progress and binaries: raw footage, edit projects, design drafts, vendor attachments, business documents, scratch exports | Too large, too churny, or too private for git — but still needs to survive a disk failure and be findable six months later. |
| **Hosted** (R2, Postgres, YouTube, Brevo) | Published artifacts a user or service fetches at runtime | The delivery surface. Never the authoring surface. |

The rule that resolves most cases: **if you would not want to read a
diff of it, it does not go in git.** A 400 MB Premiere project and a
scanned vendor invoice both fail that test; both go to pCloud.

The corollary matters just as much: **pCloud is not a backup of git and
git is not an archive of pCloud.** A file lives on exactly one surface.
Duplicating across surfaces is how the two copies drift and how you end
up not knowing which one is current.

### Decision table — where does this file go?

| The file is… | Surface | Location |
|---|---|---|
| Engine / server / client source | Git | `legendary-arena` repo |
| A wiki page | Git | `legendary-arena/wiki/` |
| A blog post + its images | Git | `legendary-arena-com/content/blog/` + `static/images/blog/<slug>/` — see [Blog Post Authoring](blog-post-authoring.md) |
| Card face art (published) | Hosted | Cloudflare R2 `legendary-images` — see [Data & File Locations](data-file-locations.md) |
| Raw video footage, Premiere project | pCloud | `C:\pcloud\legendary-arena\videos\{prefix}-{NNN}-{slug}\` — see [Video Production Workflow](video-production-workflow.md) |
| Finished video (published) | Hosted | YouTube. The blog embeds it; the file itself never enters git. |
| Reusable video assets (intros, outros, video BGM, overlays) | pCloud | `C:\pcloud\legendary-arena\video-assets\` |
| Logo drafts, design exploration | pCloud | `C:\pcloud\legendary-arena\logo-drafts\` |
| Vendor attachment, invoice, quote | pCloud | `C:\pcloud\legendary-arena\ops\vendors\` — **not** left in Outlook |
| Signed contract, licence, trademark or entity filing | pCloud | `C:\pcloud\legendary-arena\ops\legal\` |
| Accounting, tax, or bank document | pCloud | `C:\pcloud\legendary-arena\ops\accounting\` or `…\taxes\` — never git, never a server disk |
| Approved logo, brand guideline, press kit | pCloud | `C:\pcloud\legendary-arena\brand\` — drafts stay in `C:\pcloud\legendary-arena\logo-drafts\`. The approved marks are catalogued (rendered inline, with vector masters) on the [Branding](branding.md) page |
| A payment, refund, or chargeback record | Hosted | **Stripe** is the ledger. Postgres keeps references only — see System of record |
| A player profile, entitlement, or team | Hosted | PostgreSQL `legendary.*` — see System of record |
| A user-uploaded avatar | Hosted | R2 `avatars/{accountId}.webp`; Postgres stores the URL, never the bytes |
| Per-theme / per-hero game music — WAV masters + local MP3 derivatives | pCloud | `C:\pcloud\legendary-arena\audio\` — working binaries, never git, masters never uploaded; shape locked by D-24219 — see [Music Authoring](music-authoring.md) |
| Published game audio (320 kbps MP3 — music + event stings) | Hosted | R2 `legendary-images` `audio/` prefix — the **sole** audio surface; see [Data & File Locations](data-file-locations.md) |
| A secret or credential | Neither git nor a synced plain-text file | `.env` locally (gitignored), the API droplet's root-only `/etc/la/.env` in production (the Render dashboard until 2026-10-12). See Edge Cases. |
| A diagnostics JSON or loadout pulled off a live match | pCloud, scoped to a project | Currently accumulating loose at the pCloud root — see Edge Cases |

### pCloud — observed layout (2026-07-20)

pCloud has two top-level project roots plus several personal ones:

```
C:\pcloud\
├── BB\                     # BarefootBetters — emptying out, see Edge Cases
│   ├── DEV\                # no checkouts since 2026-10-17; holds only the item below
│   │   └── legendary-arena.RETIRED-2026-10-17\   # old engine checkout; rollback until 2026-10-31, then deleted
│   ├── DOCS\
│   └── MEDIA\
│
├── legendary-arena\        # Legendary Arena — the working root (named LA\ until 2026-10-17)
│   ├── audio\              # game music masters + local MP3 derivatives (published MP3s → R2)
│   ├── barefootbetters-legendary-setup\   # card-image staging (scripts/card-image-*/README.md); from BB\DEV 2026-10-17
│   ├── ewiki\
│   ├── logo-drafts\
│   ├── products\
│   ├── social\
│   ├── video-assets\       # shared intros, outros, video BGM, overlays
│   ├── videos\             # per-video production folders (see below)
│   ├── ops\                # business operations (README.txt; subfolders on first use)
│   └── brand\              # approved brand assets (README.txt; subfolders on first use)
│
├── herbs-vs-ailments\      # Herbs vs. Ailments work in progress (its README.md is that product's system map)
├── scooby-engine\          # Scooby-Doo ScummVM engine: disc ISOs + README-SCOOBY.md system map (renamed from SCOOBY\ 2026-10-18)
│
├── GISE\  JJJ\             # unrelated personal roots
└── (loose files)           # see Edge Cases
```

The per-video folder shape under `C:\pcloud\legendary-arena\videos\` is owned by
[Video Production Workflow](video-production-workflow.md) and is not
restated here.

### Git repositories

| Path | Remote | Owns | Deploys to |
|---|---|---|---|
| `C:\dev\legendary-arena` | `barefootbetters/legendary-arena` | Engine, server, clients, card data, the `wiki/` source, all AI governance | DigitalOcean droplet (server, since 2026-10-12; Render before), Cloudflare Pages (viewer, client, legends board), Cloudflare Workers (ewiki, dashboard) |
| `C:\www\legendary-arena-com` | the marketing-site repo | Hugo marketing site: blog posts, brand tokens, layouts, marketing docs, and Legendary Arena's corporate-memory layer (`docs/corporate-memory/`) | Cloudflare Pages → `www.legendary-arena.com` |
| `C:\www\jefferyjjensen-corporate-memory` | `barefootbetters/jefferyjjensen-corporate-memory` (**private**) | Top node of the distributed corporate memory (owner profile, portfolio routing map, cross-business decision log, personal notes) and, since 2026-09-29, the [AI Second Brain](ai-second-brain.md) "ship" (AIS-OS skills, operating manuals, and since 2026-10-12 the design record in `docs/second-brain/`) | Cloudflare Pages → `brain.barefootbetters.com`, a private viewer behind Cloudflare Access, published by hand with `scripts/viewer.ps1 -Deploy` |

The engine repo's path is where it *is*, not where it *should* be — see
the sync-drive hazard under Edge Cases. The marketing repo's location
off pCloud is the correct pattern for a git checkout.

Other trees under `C:\www\` (`barefootbetters-www`, `legendary-forge`,
`jefferyjjensen-wiki`, `stem-diorama-kit`, …) are separate projects with
the same three-surface split.

The engine repo's internal layout is documented in
[01-REPO-FOLDER-STRUCTURE.md](../docs/01-REPO-FOLDER-STRUCTURE.md); its
data locations in [Data & File Locations](data-file-locations.md).

### Hosted surfaces

| Surface | Contents | Authoring source |
|---|---|---|
| Cloudflare R2 `legendary-images` | Card images, avatars, the metadata JSON mirror, themes, published audio (music + event stings) | `data/` + `content/` in the engine repo (audio masters on pCloud) — mirrored **by hand**, see [Data & File Locations](data-file-locations.md) |
| PostgreSQL (`legendary` schema) | Identity, replays, teams, commerce, telemetry | `data/migrations/` |
| YouTube | Published video | `C:\pcloud\legendary-arena\videos\…\05-edit\` |
| `www.legendary-arena.com` | Marketing site + blog | `legendary-arena-com` repo |
| `ewiki.legendary-arena.com` | This wiki | `legendary-arena/wiki/` |
| Brevo | Newsletter subscribers, campaigns, send metrics | See [Newsletter Authoring](newsletter-authoring.md) |
| Stripe | Payment transactions, refunds, chargebacks — the ledger | Stripe dashboard; this project stores references only |

### Video: the surface split in miniature

Video is the clearest illustration of the three-surface rule, because a
single video touches all three:

- **pCloud** holds every working file — raw captures, FFmpeg
  intermediates, the Premiere project, the thumbnail PSD. These are
  large and change constantly; git would be the wrong tool twice over.
- **YouTube** hosts the finished render. It is the CDN.
- **Git** holds only the blog post markdown and the embed. The marketing
  repo never contains a video file.

Full workflow: [Video Production Workflow](video-production-workflow.md).
Channel strategy: [YouTube Channel Plan](youtube-channel-plan.md).

### Vendor attachments and business documents

Vendor attachments — invoices, licences, quotes, signed contracts —
follow the same rule as everything else: they are work-related documents
that are not diffable text, so they go to pCloud, filed under the
project they belong to rather than left to be re-found in Outlook.

They do **not** go in git. Beyond the size and review argument, most
carry counterparty details that should not be in a repo that mirrors to
GitHub.

### System of record — who owns which data

The three-surface rule answers *where a file goes*. This table answers a
different question: **for a given kind of business or customer data,
which system is authoritative?** Getting this wrong is more expensive
than misfiling a document, because two systems holding the same fact
disagree eventually.

| Data | System of record | This project stores |
|---|---|---|
| Payment transactions, refunds, chargebacks | **Stripe** | References only — see below |
| Game entitlements (what an account owns) | **PostgreSQL** `legendary.entitlements` | The authoritative grant |
| Player accounts and profiles | **PostgreSQL** `legendary.players`, `player_profiles`, `player_links` | The authoritative record |
| Teams, friendships, blocks, invites | **PostgreSQL** `legendary.teams`, `friendships`, `player_blocks`, `match_invites` | The authoritative record |
| Competitive scores and replays | **PostgreSQL** `legendary.competitive_scores`, `replay_blobs`, `replay_ownership` | The authoritative record |
| Newsletter subscribers, campaign history, send metrics | **Brevo** | Nothing — see [Newsletter Authoring](newsletter-authoring.md) |
| Uploaded and published binaries | **Cloudflare R2** | A URL, never the bytes |
| Source history | **GitHub** | — |
| Published video and its analytics | **YouTube** | A blog embed |
| Accounting, tax, legal, and vendor documents | **pCloud** | — |

**Stripe is the payment ledger; this project is not.** PostgreSQL keeps
`legendary.stripe_events` and `legendary.stripe_checkout_sessions` —
Stripe's own identifiers and event records, kept so a purchase can be
traced and an entitlement reconciled. It does not attempt to reconstruct
a transaction history. When Stripe and a local row disagree about what
was paid, **Stripe is right**. What this project owns authoritatively is
the *consequence* of a payment — the entitlement — not the payment.

**Profile data and profile binaries are split, deliberately.**
`legendary.player_profiles` holds the profile record and an `avatar_url`;
the avatar image itself lives at `avatars/{accountId}.webp` on the
`legendary-images` R2 bucket. **Binaries never go in Postgres — a row
holds the URL.** Card art follows the same pattern; see
[Data & File Locations](data-file-locations.md) for the full key-prefix
list.

### Business operations — the pCloud side

Accounting, legal, and brand work produce documents that are not code,
not content, and not customer data. They are the clearest possible case
for pCloud: private, binary or near-binary, and needed for years.

**They belong under `C:\pcloud\legendary-arena\`, alongside the rest of Legendary
Arena's working files** — not under `C:\pcloud\BB\`. See the note on
`BB\` below for why.

```
C:\pcloud\legendary-arena\
├── ops\                    # business operations
│   ├── accounting\
│   │   ├── stripe\         # payout reports, merchant statements
│   │   ├── bank\           # statements, reconciliations
│   │   ├── revenue\        # sales and revenue reports
│   │   ├── expenses\       # receipts, expense reports
│   │   └── year-end\       # closing packages
│   ├── taxes\              # returns, 1099s, filings
│   ├── legal\
│   │   ├── entity\         # LLC formation, registered agent, annual filings
│   │   ├── trademarks\     # applications, registrations, correspondence
│   │   ├── copyright\      # registrations
│   │   ├── contracts\      # signed agreements, counterparty correspondence
│   │   └── licenses\       # inbound and outbound licensing
│   ├── insurance\
│   ├── vendors\            # per-vendor invoices, quotes, agreements
│   └── reports\            # operating reports not tied to a filing
│
├── brand\                  # approved, shipped brand assets
│   ├── logos\              # final marks (SVG + PNG + favicon)
│   ├── guidelines\         # brand book, usage rules
│   ├── fonts\              # licensed font files + their licences
│   ├── social\             # profile art, banners, templates
│   ├── press\              # press kit, approved screenshots
│   └── product-shots\      # photography for the shop
│
├── audio\                  # game music masters + derivatives (locked by D-24219)
├── ewiki\                  # research notes and drafts (not published)
├── logo-drafts\            # brand exploration — see below
├── products\
├── social\
├── video-assets\
└── videos\
```

Lowercase names match the existing children of `C:\pcloud\legendary-arena\`.

**`brand\` is approved work; `logo-drafts\` is exploration.** They sit
side by side deliberately: a designer reaching for a mark should never
have to guess whether they have the current one. Drafts stay in
`logo-drafts\`; when something ships, its final files move to `brand\`.

> **`legendary-arena\ops\` and `legendary-arena\brand\` exist; their subfolders do not — and the
> taxonomy is locked by D-24220.** Both root directories were created on
> 2026-07-20 and each carries a `README.txt` restating the rules below
> for whoever opens the folder rather than this page. The subfolders
> above are created on first use — an empty folder reads as "this is
> where that goes" when nothing has been filed yet, which is the same
> two-destinations problem that retired `BB\OPS\`. Their *names and
> placement* are binding under D-24220: a future session adds a sibling
> for a genuinely new category, it does not re-file or rename these.

#### Why not `C:\pcloud\BB\`

`BB\` was the business root, and its `BRAND\` and `OPS\` directories
were created for exactly this work — but both are **empty**, and `BB\`
is on a path to holding nothing:

- `BB\DEV\` existed to hold the engine checkout, which moved off pCloud
  on 2026-10-17 (see the sync-drive hazard under Edge Cases). The
  card-image staging area followed it out the same day, to
  `legendary-arena\`. Once the retired copy is deleted after 2026-10-31,
  `DEV\` holds nothing.
- `BB\DOCS\` and `BB\MEDIA\` hold very little.
- Everything with real content already lives under `legendary-arena\`.

Filing new business documents into `BB\` would rebuild the *"one product,
two roots"* split this page's Edge Cases already flag. **The direction of
travel is consolidation onto `legendary-arena\`** — which is also why the
D-24207 rename (`LA\` → `BB\WIP\`) was declined under D-24208: it pointed
the wrong way.

Two things that follow from the ownership table above:

- **Accounting exports are pCloud, never git and never a server disk.**
  A Stripe payout CSV or a bank statement in a repo is a permanent,
  mirrored copy of financial data. On the API droplet's disk it sits outside
  the database backup, and it is lost with the box. Neither is a filing cabinet.
- **Business documents are not the system of record for the facts inside
  them.** A downloaded Stripe report is a *snapshot*; Stripe remains
  authoritative. Keep the document for the year-end package and the
  audit trail, not as the number you reconcile against.

### Using this page as a manifest

This page is written to be the single file an assistant reads to learn
the whole structure. That is what makes the map worth maintaining: one
document to update, one document to point at.

For that to hold, it must be reachable from wherever the question gets
asked. Two pointers keep it reachable:

- The engine repo reaches it through [INDEX.md](INDEX.md) and this page's
  published URL.
- Surfaces outside the engine repo need a stub that names this page
  rather than restating it. A stub that restates the map becomes a
  second, silently diverging map — the exact failure this page exists to
  prevent.

## Interactions

- **[Data & File Locations](data-file-locations.md)** owns everything
  *inside* the engine repo — card data, metadata, migrations, R2 key
  prefixes, LAGN, coverage ledgers. This page stops at the repo boundary
  and defers.
- **[Video Production Workflow](video-production-workflow.md)** owns the
  per-video folder structure under `C:\pcloud\legendary-arena\videos\`; this page only
  locates the root and states why video files never enter git.
- **[Blog Post Authoring](blog-post-authoring.md)** owns the marketing
  repo's content lane, including the rule that post images live in-repo
  and external image hosting is prohibited for blog imagery.
- **[Development Workflow](development-workflow.md)** owns branch, commit,
  and PR discipline for the engine repo.
- **[Ewiki Authoring](ewiki-authoring.md)** owns how pages on this wiki
  are written and published.

## Edge Cases

- **`BB` and `legendary-arena` were two roots for one product — the
  split has resolved toward `legendary-arena`.** The engine checkout left
  `C:\pcloud\BB\DEV\` on 2026-10-17, and everything else — video, design,
  research notes, business operations and brand — belongs under
  `C:\pcloud\legendary-arena\` (named `LA\` until Phase 7 of the
  migration). Nothing on disk records the division, so **the decision
  table above is the lookup.**

  Two earlier answers were both wrong about direction. D-24207 proposed
  consolidating onto `BB\WIP\`; D-24208 declined that. Neither
  anticipated the actual resolution: `legendary-arena\` is the working
  root, and `BB\` empties out now that the checkout has left `DEV\`.
- **The stale second clone at `C:\www\legendary-arena` was deleted on
  2026-10-17** (migration Phase 6c), after every branch checked out as
  merged or superseded. It shared the engine remote but was hundreds of
  commits behind `main`, and searches across `C:\www\` used to return its
  long-superseded files. The canonical checkout is `C:\dev\legendary-arena`.
- **`C:\pcloud\BB\DEV\` was swept on 2026-10-17.** Its stale
  chat-transcript `README.md`, 15 empty worktree shells left by
  `git worktree remove` (`la-wt-*` and `legendary-arena-*`), and a few
  superseded loose scripts were deleted. Worktrees belong under
  `C:\claude-worktrees\`, not next to a checkout. The card-image staging
  area (`barefootbetters-legendary-setup\`, 4 GB of staged scans) moved to
  `C:\pcloud\legendary-arena\` the same day. `BB\DEV` was never a pCloud
  sync pair, so until then those scans had no cloud copy. What remains is
  listed in the pCloud tree above.
- **Credentials are sitting in cleartext at the pCloud root.** Several
  files there are recovery codes and exported credential lists. pCloud
  sync is not a secret store: the files replicate to every synced device
  and to pCloud's servers. They belong in the password manager. This page
  deliberately does not enumerate the filenames.
- **Loose scratch files accumulate at the pCloud root.** Match
  diagnostics JSON, exported loadouts, and game logs are being saved to
  `C:\pcloud\` directly rather than into a project folder. They are
  useful artifacts — they are just unfindable where they are.
- **`BB\BRAND\` and `BB\OPS\` were deleted (2026-07-20).** They had
  been created for business documents; that work is filed under
  `legendary-arena\ops\` and `legendary-arena\brand\` instead. Removing them was the right call
  rather than leaving them empty — two plausible destinations is worse
  than one, because a document filed into the wrong one is not missing,
  just unfindable.
- **`BB\` is on a path to holding nothing.** Its only substantial
  content was the engine checkout under `DEV\`, which moved off pCloud on
  2026-10-17 (the retired copy there is deleted after 2026-10-31). `BB\`
  now holds a thin `DOCS\` and `MEDIA\` and little else. The *"one product, two roots"* split above resolves by
  `BB\` emptying, not by a migration.
- **The engine repo was on the sync drive until 2026-10-17, and that was
  a hazard — not a feature.** It sat at `C:\pcloud\BB\DEV\legendary-arena`,
  where pCloud synced the `.git` directory itself. Observed consequences, in
  increasing severity: `… [conflicted N]` sibling files (the un-suffixed
  file is canonical, and has been the *truncated* one); uncommitted edits
  silently reverting to their committed state with no conflict file at
  all; phantom uncommitted changes that later resolve themselves; `HEAD`
  and the current branch flipping between states mid-session; untracked
  draft files vanishing outright; and a commit landing on a concurrent
  session's branch and being pushed into an unrelated PR.

  The fix was the move itself: the engine now lives at
  **`C:\dev\legendary-arena`**. Code checkouts go under `C:\dev\` and
  website checkouts under `C:\www\` (operator decision, 2026-10-17), which
  replaces the `C:\www\legendary-arena` target named in D-24208's
  rationale. The plan and its record are on
  [Workstation Layout Migration](workstation-layout-migration.md). Two
  habits from that era are still worth keeping with parallel sessions:
  do sustained git work in a worktree under `C:\claude-worktrees\`, and
  run `git log origin/main..HEAD` before every push to confirm only your
  own commits are listed.
- **Sync is not backup, and for a git repo it is worse than neither.**
  The durability of work in either repo comes from pushing to GitHub. A
  checkout is not made safer by living on a synced drive; it is made
  less safe. Content directories — `C:\pcloud\legendary-arena\` video assets, design
  drafts, vendor documents — are the opposite case: no `.git`, nothing
  to corrupt, and sync is exactly the right tool.
- **The R2 metadata mirror is hand-synced.** A commit to `data/` changes
  nothing the Registry Viewer serves until an explicit `rclone copy`
  runs. Detail in [Data & File Locations](data-file-locations.md).

## Open Questions

- **Resolved: the pCloud folder is named for its repo (D-24739,
  2026-10-17).** D-24207 proposed renaming `C:\pcloud\LA\` to
  `C:\pcloud\BB\WIP\legendary-arena\`; D-24208 declined that, since it
  pointed the wrong way and the sweep was two repos, not one rename.
  D-24739 superseded it in part: one folder name per product across
  three roots. In migration Phase 7, `C:\pcloud\LA\` became
  `C:\pcloud\legendary-arena\`, and the sweep covered this repo, the
  marketing repo and the brain repo in one pass. See
  [Workstation Layout Migration](workstation-layout-migration.md).
- **Per-repo README pointers are proposed but not written.** Each repo
  gaining a short section naming this page — rather than restating it —
  would make the map findable from inside any checkout. Scope is
  undecided. (The stale `BB\DEV\README.md` it might have replaced was
  deleted on 2026-10-17.)
- **The non-engine repos under `C:\www\` are not inventoried here.**
  `barefootbetters-www`, `legendary-forge`, `jefferyjjensen-wiki`,
  `stem-diorama-kit`, and others exist but have not been mapped to their
  pCloud counterparts. This page covers the Legendary Arena surfaces
  only.

## References

- [01-REPO-FOLDER-STRUCTURE.md](../docs/01-REPO-FOLDER-STRUCTURE.md) —
  the engine repo's authoritative directory layout.
- [render.yaml](../render.yaml) — the retired Render blueprint (production
  until 2026-10-12); now the inventory of `sync: false` secret names.
- [.env.example](../.env.example) — the shape of every required
  environment variable; the real values are never committed.
- [Data & File Locations](data-file-locations.md) — in-repo data, R2 key
  prefixes, the `legendary` schema, replays and LAGN.
- [Video Production Workflow](video-production-workflow.md),
  [YouTube Channel Plan](youtube-channel-plan.md) — the video surfaces.
- [Blog Post Authoring](blog-post-authoring.md) — the marketing repo's
  content lane and image conventions.
- [Newsletter Authoring](newsletter-authoring.md) — Brevo's ownership of
  subscriber and campaign data.
- [011_create_entitlements.sql](../data/migrations/011_create_entitlements.sql),
  [012_create_stripe_events_and_checkout_sessions.sql](../data/migrations/012_create_stripe_events_and_checkout_sessions.sql)
  — the entitlement grant and the Stripe reference tables.
- [avatarUpload.logic.ts](../apps/server/src/profile/avatarUpload.logic.ts)
  — the `avatars/{accountId}.webp` R2 key and the URL-not-bytes split.
