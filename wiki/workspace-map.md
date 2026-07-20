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
  - data-file-locations.md
  - video-production-workflow.md
  - youtube-channel-plan.md
  - blog-post-authoring.md
  - development-workflow.md
  - ewiki-authoring.md
  - newsletter-authoring.md
  - monetization-model.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\workspace-map.md (this page — https://ewiki.legendary-arena.com/workspace-map/)
  - ../docs/01-REPO-FOLDER-STRUCTURE.md
  - ../render.yaml
  - ../.env.example
  - ../data/migrations/011_create_entitlements.sql
  - ../data/migrations/012_create_stripe_events_and_checkout_sessions.sql
  - ../apps/server/src/profile/avatarUpload.logic.ts
last-reviewed: 2026-07-20
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
| A blog post + its images | Git | `legendary-arena-com/content/posts/` + `static/images/posts/<slug>/` — see [Blog Post Authoring](blog-post-authoring.md) |
| Card face art (published) | Hosted | Cloudflare R2 `legendary-images` — see [Data & File Locations](data-file-locations.md) |
| Raw video footage, Premiere project | pCloud | `C:\pcloud\LA\videos\{prefix}-{NNN}-{slug}\` — see [Video Production Workflow](video-production-workflow.md) |
| Finished video (published) | Hosted | YouTube. The blog embeds it; the file itself never enters git. |
| Reusable video assets (intros, music, overlays) | pCloud | `C:\pcloud\LA\video-assets\` |
| Logo drafts, design exploration | pCloud | `C:\pcloud\LA\logo-drafts\` |
| Vendor attachment, invoice, quote | pCloud | `C:\pcloud\LA\ops\vendors\` — **not** left in Outlook |
| Signed contract, licence, trademark or entity filing | pCloud | `C:\pcloud\LA\ops\legal\` |
| Accounting, tax, or bank document | pCloud | `C:\pcloud\LA\ops\accounting\` or `…\taxes\` — never git, never a server disk |
| Approved logo, brand guideline, press kit | pCloud | `C:\pcloud\LA\brand\` — drafts stay in `C:\pcloud\LA\logo-drafts\` |
| A payment, refund, or chargeback record | Hosted | **Stripe** is the ledger. Postgres keeps references only — see System of record |
| A player profile, entitlement, or team | Hosted | PostgreSQL `legendary.*` — see System of record |
| A user-uploaded avatar | Hosted | R2 `avatars/{accountId}.webp`; Postgres stores the URL, never the bytes |
| A secret or credential | Neither git nor a synced plain-text file | `.env` locally (gitignored), Render dashboard in production. See Edge Cases. |
| A diagnostics JSON or loadout pulled off a live match | pCloud, scoped to a project | Currently accumulating loose at the pCloud root — see Edge Cases |

### pCloud — observed layout (2026-07-20)

pCloud has two top-level project roots plus several personal ones:

```
C:\pcloud\
├── BB\                     # BarefootBetters — emptying out, see Edge Cases
│   ├── DEV\                # code checkouts
│   │   └── legendary-arena\    # ← engine monorepo; scheduled to move off pCloud
│   ├── DOCS\
│   └── MEDIA\
│
├── LA\                     # Legendary Arena — the working root
│   ├── ewiki\
│   ├── logo-drafts\
│   ├── products\
│   ├── social\
│   ├── video-assets\       # shared intros, outros, music, overlays
│   ├── videos\             # per-video production folders (see below)
│   ├── ops\                # business operations (README.txt; subfolders on first use)
│   └── brand\              # approved brand assets (README.txt; subfolders on first use)
│
├── GISE\  JJJ\  SCOOBY\    # unrelated personal roots
└── (loose files)           # see Edge Cases
```

The per-video folder shape under `C:\pcloud\LA\videos\` is owned by
[Video Production Workflow](video-production-workflow.md) and is not
restated here.

### Git repositories

| Path | Remote | Owns | Deploys to |
|---|---|---|---|
| `C:\pcloud\BB\DEV\legendary-arena` | `barefootbetters/legendary-arena` | Engine, server, clients, card data, the `wiki/` source, all AI governance | Render (server, wiki), Cloudflare Pages (viewer, client, legends board) |
| `C:\www\legendary-arena-com` | the marketing-site repo | Hugo marketing site: blog posts, brand tokens, layouts, marketing docs | Cloudflare Pages → `www.legendary-arena.com` |

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
| Cloudflare R2 `legendary-images` | Card images, avatars, the metadata JSON mirror, themes | `data/` in the engine repo — mirrored **by hand**, see [Data & File Locations](data-file-locations.md) |
| PostgreSQL (`legendary` schema) | Identity, replays, teams, commerce, telemetry | `data/migrations/` |
| YouTube | Published video | `C:\pcloud\LA\videos\…\05-edit\` |
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

**They belong under `C:\pcloud\LA\`, alongside the rest of Legendary
Arena's working files** — not under `C:\pcloud\BB\`. See the note on
`BB\` below for why.

```
C:\pcloud\LA├── ops\                    # business operations
│   ├── accounting│   │   ├── stripe\         # payout reports, merchant statements
│   │   ├── bank\           # statements, reconciliations
│   │   ├── revenue\        # sales and revenue reports
│   │   ├── expenses\       # receipts, expense reports
│   │   └── year-end\       # closing packages
│   ├── taxes\              # returns, 1099s, filings
│   ├── legal│   │   ├── entity\         # LLC formation, registered agent, annual filings
│   │   ├── trademarks\     # applications, registrations, correspondence
│   │   ├── copyright\      # registrations
│   │   ├── contracts\      # signed agreements, counterparty correspondence
│   │   └── licenses\       # inbound and outbound licensing
│   ├── insurance│   ├── vendors\            # per-vendor invoices, quotes, agreements
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
├── ewiki\                  # research notes and drafts (not published)
├── logo-drafts\            # brand exploration — see below
├── products├── social├── video-assets└── videos```

Lowercase names match the existing children of `C:\pcloud\LA\`.

**`brand\` is approved work; `logo-drafts\` is exploration.** They sit
side by side deliberately: a designer reaching for a mark should never
have to guess whether they have the current one. Drafts stay in
`logo-drafts\`; when something ships, its final files move to `brand\`.

> **`LA\ops\` and `LA\brand\` exist; their subfolders do not.** Both
> root directories were created on 2026-07-20 and each carries a
> `README.txt` restating the rules below for whoever opens the folder
> rather than this page. The subfolders above are created on first use —
> an empty folder reads as "this is where that goes" when nothing has
> been filed yet, which is the same two-destinations problem that
> retired `BB\OPS\`.

#### Why not `C:\pcloud\BB\`

`BB\` was the business root, and its `BRAND\` and `OPS\` directories
were created for exactly this work — but both are **empty**, and `BB\`
is on a path to holding nothing:

- `BB\DEV\` exists to hold the engine checkout, which is scheduled to
  move off pCloud entirely (see the sync-drive hazard under Edge Cases).
  When it goes, `DEV\` is empty too.
- `BB\DOCS\` and `BB\MEDIA\` hold very little.
- Everything with real content already lives under `LA\`.

Filing new business documents into `BB\` would rebuild the *"one product,
two roots"* split this page's Edge Cases already flag, at the moment that
split is resolving on its own. **The direction of travel is consolidation
onto `LA\`** — which is also why the D-24207 rename (`LA\` → `BB\WIP\`)
was declined under D-24208: it pointed the wrong way.

Two things that follow from the ownership table above:

- **Accounting exports are pCloud, never git and never a server disk.**
  A Stripe payout CSV or a bank statement in a repo is a permanent,
  mirrored copy of financial data. On a Render disk it is ephemeral and
  unbacked. Neither is a filing cabinet.
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
  per-video folder structure under `C:\pcloud\LA\videos\`; this page only
  locates the root and states why video files never enter git.
- **[Blog Post Authoring](blog-post-authoring.md)** owns the marketing
  repo's content lane, including the rule that post images live in-repo
  and external image hosting is prohibited for blog imagery.
- **[Development Workflow](development-workflow.md)** owns branch, commit,
  and PR discipline for the engine repo.
- **[Ewiki Authoring](ewiki-authoring.md)** owns how pages on this wiki
  are written and published.

## Edge Cases

- **`BB` and `LA` are two roots for one product — and the split is
  resolving toward `LA`.** The engine repo still lives under
  `C:\pcloud\BB\DEV\`, while everything else — video, design, research
  notes, and now business operations and brand — belongs under
  `C:\pcloud\LA\`. Nothing on disk records the division, so **the
  decision table above is the lookup.**

  Two earlier answers were both wrong about direction. D-24207 proposed
  consolidating onto `BB\WIP\`; D-24208 declined that. Neither
  anticipated the actual resolution: `LA\` becomes the working root and
  `BB\` empties out as the checkout leaves `DEV\`. No migration is
  required for that — it happens by putting new work in the right place
  and letting `BB\` drain.
- **A stale second clone of the engine repo exists at
  `C:\www\legendary-arena`.** It shares the `barefootbetters/legendary-arena`
  remote but is hundreds of commits behind `main`. It is not a worktree
  and nothing deploys from it. Searches run against `C:\www\` can match
  its files and return long-superseded content — the canonical checkout is
  `C:\pcloud\BB\DEV\legendary-arena`.
- **`C:\pcloud\BB\DEV\README.md` is a stale chat transcript, not a
  README.** It describes `cards.barefootbetters.com` and a `data/raw/`
  directory, neither of which is current. It is the closest thing to an
  existing manifest and it is wrong — which is the case for replacing it
  with a pointer to this page.
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
  `LA\ops\` and `LA\brand\` instead. Removing them was the right call
  rather than leaving them empty — two plausible destinations is worse
  than one, because a document filed into the wrong one is not missing,
  just unfindable.
- **`BB\` is on a path to holding nothing.** Its only substantial
  content is the engine checkout under `DEV\`, which is scheduled to move
  off pCloud. When that lands, `BB\` holds a thin `DOCS\` and `MEDIA\`
  and little else. The *"one product, two roots"* split above resolves by
  `BB\` emptying, not by a migration.
- **The engine repo is on the sync drive, and that is a known hazard —
  not a feature.** `C:\pcloud\BB\DEV\legendary-arena` sits on pCloud,
  which syncs the `.git` directory itself. Observed consequences, in
  increasing severity: `… [conflicted N]` sibling files (the un-suffixed
  file is canonical, and has been the *truncated* one); uncommitted edits
  silently reverting to their committed state with no conflict file at
  all; phantom uncommitted changes that later resolve themselves; `HEAD`
  and the current branch flipping between states mid-session; untracked
  draft files vanishing outright; and a commit landing on a concurrent
  session's branch and being pushed into an unrelated PR.

  Three mitigations, in order of effect:

  1. **Do sustained git work in an off-pCloud worktree**, not in the
     canonical tree — `git worktree add C:\claude-worktrees\<name> -b
     <branch> origin/main`.
  2. **Commit early and often.** A commit is sync-proof; an uncommitted
     working tree is not. Untracked work is what gets lost.
  3. **Run `git log origin/main..HEAD` before every push** and confirm
     only your own commits are listed.

  Moving the engine repo off pCloud is planned and currently deferred by
  operator decision — the target is `C:\www\legendary-arena`, alongside
  the marketing repo, which is already correctly off the sync drive. Do
  not start that migration without an explicit instruction.
- **Sync is not backup, and for a git repo it is worse than neither.**
  The durability of work in either repo comes from pushing to GitHub. A
  checkout is not made safer by living on a synced drive; it is made
  less safe. Content directories — `C:\pcloud\LA\` video assets, design
  drafts, vendor documents — are the opposite case: no `.git`, nothing
  to corrupt, and sync is exactly the right tool.
- **The R2 metadata mirror is hand-synced.** A commit to `data/` changes
  nothing the Registry Viewer serves until an explicit `rclone copy`
  runs. Detail in [Data & File Locations](data-file-locations.md).

## Open Questions

- **The folder rename was considered and declined (D-24208).** D-24207
  proposed renaming `C:\pcloud\LA\` to `C:\pcloud\BB\WIP\legendary-arena\`
  so the pCloud folder would mirror the repository name. It is **not
  happening.** `C:\pcloud\LA` is referenced 38 times across 7 pages of
  this wiki plus three marketing-repo documents, so the migration is a
  two-repo sweep rather than the single rename D-24207 estimated — and
  the problem it addressed (not knowing which root an asset class belongs
  to) is already solved by this page. D-24208 also withdrew D-24207's
  `C:\pcloud\BB\DEV\<repo-name>\` clause: checkout location belongs to
  the off-pCloud move, not to a naming convention. What survives is the
  principle — name a *newly created* pCloud working-files folder for its
  repository; rename nothing that already exists.
- **The `LA\ops\` and `LA\brand\` taxonomy is documented but not
  locked.** The subdirectory shapes above are this page's proposal for
  where business work belongs; no DECISIONS entry governs them and no
  directory has been created. If the shape should be binding — so a
  future session cannot quietly re-file things — it needs a D-entry, the
  way the pCloud naming question got D-24207 and D-24208. Until then it
  is guidance.
- **Per-repo README pointers are proposed but not written.** Each repo
  gaining a short section naming this page — rather than restating it —
  would make the map findable from inside any checkout. Scope, and whether
  it replaces the stale `BB\DEV\README.md`, is undecided.
- **The non-engine repos under `C:\www\` are not inventoried here.**
  `barefootbetters-www`, `legendary-forge`, `jefferyjjensen-wiki`,
  `stem-diorama-kit`, and others exist but have not been mapped to their
  pCloud counterparts. This page covers the Legendary Arena surfaces
  only.

## References

- [01-REPO-FOLDER-STRUCTURE.md](../docs/01-REPO-FOLDER-STRUCTURE.md) —
  the engine repo's authoritative directory layout.
- [render.yaml](../render.yaml) — production services and their secret
  bindings.
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
