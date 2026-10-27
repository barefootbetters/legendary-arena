---
title: Render Migration Analysis
type: Guide
tags:
  - infrastructure
  - render
  - digitalocean
  - migration
  - cost
  - operator-reference
  - draft
related:
  - ubuntu-lab-provisioning.md
  - ai-second-brain.md
  - architecture-inventory.md
  - development-workflow.md
status: draft
source:
  - C:\dev\legendary-arena\wiki\render-migration-analysis.md (this page — https://ewiki.legendary-arena.com/render-migration-analysis/)
  - ../render.yaml
  - C:\pcloud\legendary-arena\ops\accounting\expenses2026 (Render bills, Aug and Sep 2026)
  - GitHub Actions usage alert for barefootbetters (2026-10-19) and the October run history of each repo
  - https://docs.github.com/en/billing/reference/actions-runner-pricing (runner rates, checked 2026-10-19)
last-reviewed: 2026-10-19
---

# Render Migration Analysis

## Summary

The cost, sizing, vendor and architecture analysis behind moving the game
server and its PostgreSQL off Render onto one self-hosted DigitalOcean droplet
(cutover 2026-10-12). It records what Render cost, how the starting droplet size was chosen from
measured use, and which vendors and architectures were weighed. It also records
what GitHub Actions costs (nothing for Legendary Arena; see
[GitHub Actions minutes](#github-actions-minutes-october-2026)). How to build
and run the host is on the Ubuntu Lab Provisioning page.

## Mechanics

### Current call (2026-10-11)

| Question | Answer |
|---|---|
| Vendor | DigitalOcean, `sfo3` (San Francisco) |
| Starting size | 2 vCPU / 4 GB / 80 GB SSD, $24 a month, with a 2 GB swapfile (lab D-002) |
| Resize path | 4 vCPU / 8 GB ($48), then CPU-Optimized 4 vCPU / 8 GB ($84) for dedicated CPU |
| Architecture | One host with the server and PostgreSQL co-located on `localhost` |
| AI Second Brain | Its own host, not this one (see [Sizing from measured use](#sizing-from-measured-use-2026-10-11)) |
| Savings against Render | About $1,470 a year at the starting size |

Every price on this page is dated. Re-check the vendor's page before acting on
one.

### Cost case (September 2026)
What Render charged for August 2026 (paid 2026-09-01) and September 2026
(paid 2026-10-01):

| Line | Render plan | Aug 2026 | Sep 2026 | After migration |
|---|---|---|---|---|
| Game server | `pro`, 2 CPU / 4 GB | $85.00 | $85.00 | on the droplet |
| PostgreSQL | `pro-4gb` plus storage | $55.30 | $55.30 | on the droplet, `localhost` |
| Builds | pipeline minutes (Aug 41 m, Sep 6 h 42 m) | $5.00 | $5.00 | builds on the droplet during deploy (`40-app-deploy.ps1`; no build charge) |
| Bandwidth | Aug 7.8 GB, Sep 6.5 GB | $1.20 | $1.05 | included with the droplet |
| ewiki static site | free | $0.00 | $0.00 | Cloudflare Worker (moved 2026-10-11, D-24690) |
| **Total** | | **$146.50** | **$146.35** | **~$24** at the start size (2 vCPU / 4 GB), **~$48** on the resize path (4 vCPU / 8 GB) |

The two months differ by 15 cents, all of it bandwidth, so about **$146 a
month is the steady run rate**, not a one-off spike. Builds billed $5 in both
months, at 41 minutes and at nearly seven hours, so that line behaves like a
flat charge rather than a per-minute one. August and September together cost
$292.85.

Starting at the $24 droplet saves about **$1,470 a year**; the $48 size would
save about $1,180. Both figures are before backup storage. Backups go to R2, which is inside its free tier today. Both
Render plans were raised in July to cure CPU and memory starvation; the reasons
are recorded in `render.yaml`.

**Cost-reduction order.** These steps are ranked by savings for the effort.
1. **Finish the migration.** Done: cut over 2026-10-12. It restarted on 2026-10-04. The work that needs
   no droplet is merged: `legendary-arena-lab` #17 and #18 fixed the
   provisioners and proved them in CI on Ubuntu 24.04, and on 2026-10-11 the
   whole chain was rehearsed on the real $24 droplet, including a
   production-copy restore (see
   [Rehearsal results](ubuntu-lab-provisioning.md#rehearsal-results-2026-10-11)).
   On 2026-10-12 the Cloudflare TLS step, the R2 offsite backup, and
   monitoring were rehearsed too, and the production secrets were installed on
   the droplet. The cutover followed the same day (see
   [Cutover](ubuntu-lab-provisioning.md#cutover-2026-10-12)). Every month on
   Render cost about $120 more than the $24 droplet does.
2. **Size from data, not from the July incidents.** Done 2026-10-11: both
   Render services run idle (about 1 GB and well under one core in total), so
   start at 2 vCPU / 4 GB ($24) and resize up on evidence. That saves more than
   switching vendor would. See
   [Sizing from measured use](#sizing-from-measured-use-2026-10-11).
3. **Reduce the load, which pays off on any host.**
   - The bot-ally driver polls every live match every 250 ms
     (`apps/server/src/bot-ally/botAllyDriver.mjs`). Driving it from state
     changes instead cuts server CPU and database queries.
   - Finished `bgio` matches are never pruned, so the database grows without
     bound. A retention job would stop that, but it must keep the
     completed-match data that replay verification (D-24119) and the team-key
     backfill (D-24187) read.
4. **Trim Render only if cutover is more than a month or two out.** Not
   needed: the cutover came first (2026-10-12). Kept for the record.
   - Build only the server and the packages it depends on
     (`pnpm --filter @legendary-arena/server... build`) instead of
     `pnpm -r build`. That shortens deploys, but it probably won't lower the
     $5 build line: August's 41 minutes billed the same $5 as September's
     6 h 42 m.
   - Step the server from `pro` down to `standard`, which saves $60 a month,
     but only if the September figures show headroom. Under-provisioning is
     what caused the July freezes.
5. **Keep the rollback window short.** The window is **7 days**. At the
   2026-10-12 cutover the Render web service was suspended, not downgraded:
   suspending stopped writes during the final dump, resuming it is the
   rollback, and a suspended service isn't billed for compute. The Render
   database stays up as the rollback copy until Render is deleted on day 7
   (~2026-10-20).

### GitHub Actions minutes (October 2026)

Legendary Arena pays nothing for GitHub Actions. The engine repo
(`barefootbetters/legendary-arena`) and `legendary-arena-website` are public,
and standard GitHub-hosted runners are free on public repos. The private
`legendary-arena-lab` repo bills against the `legendary-arena` organization's
own 2,000 included minutes a month. It used about 210 minutes from 2026-10-01
to 2026-10-19 (CI, provision smoke, host deploys), well inside that allowance.

The `barefootbetters` account is a separate allowance. Its 2,000 included
minutes are spent by the studio's private repos, not by this game. GitHub's
alert on 2026-10-19 put October at 1,800 minutes (90%), and the run history
matches it:

| Repo | Workflows | Runs | ~Minutes |
|---|---|---|---|
| `herbs-vs-ailments` | CI, ewiki, dashboard-ping | 1,000 | 1,174 |
| `bb-studio-dashboard` | ci, deploys, governance, ewiki | 302 | 464 |
| `jefferyjjensen-corporate-memory` | viewer-deploy, brain-checks | 110 | 118 |
| `www`, `bb-studio-www`, `bb-studio-ewiki-theme` | checks, rebuilds | 51 | 59 |
| **Total (Oct 1–19)** | | **1,463** | **1,815** |

Minutes are wall-clock per run, rounded up to a whole minute. At about 95.5
minutes a day across October's 31 days, the month ends near 2,961 minutes,
about 961 over the allowance. The standard Linux 2-core runner has cost $0.006
a minute since 2026-01-01 (it was $0.008), so October's overage comes to about
**$5.77**. The dashboard's Monetization page shows the same projection
(`apps/dashboard/src/config/githubActionsUsage.ts`). That
cost belongs to the studio and Herbs vs. Ailments, not to Legendary Arena's
infrastructure line.

- **The account's Actions budget is $20 a month (set 2026-10-19).** That covers
  the projected overage and still stops a runaway loop. A $0 budget would
  instead block every private-repo workflow, deploys included, until the
  reset on 2026-11-01. Codespaces, Packages, Git LFS, and AI credits are held
  at $0; no repo uses paid Packages or LFS.
- **If it recurs, cut it at the source.** `herbs-vs-ailments` drives about 65%
  of the minutes: two workflows (CI and the ewiki build) run on nearly every
  PR update, because nearly every PR touches `docs/`. Folding the ewiki PR
  build into CI's job removes one runner start and one whole-minute
  rounding per update. That is an estimated 300–400 minutes a month.


### Sizing from measured use (2026-10-11)

Render gave production 8 GB and
3 CPUs in total: 4 GB / 2 CPU for the server and 4 GB / 1 CPU for Postgres. The
Render metrics for the 7 days to 2026-10-11 show both far below that:

| Service | Memory | CPU |
|---|---|---|
| Game server (`pro`, 4 GB / 2 CPU) | ~5% (~200 MB) steady; spikes to ~10–13% (~400–500 MB) around deploys | ~0–1% steady; spikes to ~10–13% (~0.25 core) at deploys |
| `legendary-arena-db` (`pro-4gb`, 4 GB / 1 CPU) | Flat, under ~10% (under ~400 MB) | Flat, near 0% |

The database figures are read from a low-resolution screenshot, so treat them
as upper bounds. Active connections were a few out of 100, and the transaction
volume came in short bursts. Production used about 1 GB and well under one core
in total.

**Recommendation: start on the $24 droplet (2 vCPU / 4 GB / 80 GB), not the
$48 one.** That is $288 a year against $576, and about $1,470 a year saved
against Render. The July freezes happened at 512 MB / 0.5 CPU, well below this
box. Three guardrails:
- **Add a 2 GB swapfile.** `pnpm -r build` now runs on the box during deploys and
  spikes memory well above the steady state.
- **Resize "CPU and RAM only".** Keeping the 80 GB disk preserves the option to
  size back down; a disk resize cannot be undone.
- **Resize up on evidence.** Bot-ally load grows with the number of live
  matches. Move to the $48 box (4 vCPU / 8 GB) if memory holds above ~70% or CPU
  above ~50% under real traffic. The resize is a reboot of about a minute.

At this usage, RAM-heavy plans such as NameHero Turbo (16 GB) buy headroom the
workload doesn't use.

**The AI Second Brain does not share this box.** A 4 GB droplet is below the
[AI Second Brain](ai-second-brain.md)'s 8 GB floor, so the brain gets its own
host. Its 16 GB figure applies only if local speech-to-text and text-to-speech
models run on the VPS itself. Voice is used only while driving (up to about two
hours a day) through Claude's own app voice, which runs on Anthropic's side, so
local voice is deferred. Voice is not a reason to size the arena host, or the
brain host, at 16 GB.

### Vendor comparison: DigitalOcean vs NameHero (2026-10-04)

**Current call (2026-10-11): stay with DigitalOcean for this cutover.**
NameHero's written reply settled the price, and the price gap is now small.
It did not settle any of the operational questions the cutover depends on:
the Ubuntu 24.04 image, cloud-init, self-service snapshots and rebuilds, the
data center, and whether vCPUs are dedicated. DigitalOcean answers all of
those today. NameHero remains a reasonable host for a separate
[AI Second Brain](ai-second-brain.md) box, uncoupled from the arena deploy
pipeline.

The workload is one Ubuntu 24.04 box running `apps/server`, PostgreSQL 18 on
`localhost`, Nginx, a Cloudflare origin certificate, systemd, SSH deploy, and
`pg_dump` to R2. Bandwidth does not matter (Render moved 6.5 GB in September),
and the box is a single point of failure on either vendor. What separates them
is region, CPU class, disk, provisioning fit, and, by a small margin, price.

**Price.** DigitalOcean, list price with no term commitment (checked
2026-10-04):

| Droplet | vCPU | RAM | Disk | Transfer | Monthly |
|---|---|---|---|---|---|
| Basic (start) | 2 | 4 GB | 80 GB SSD | 4 TB | $24 |
| Basic (first resize step) | 4 | 8 GB | 160 GB SSD | 5 TB | $48 |
| CPU-Optimized (resize path) | 4 | 8 GB | 50 GB SSD | 5 TB | $84 |

NameHero unmanaged VPS, month-to-month, as quoted in writing to the existing
account (2026-10-11):

| Plan | vCPU | RAM | Disk | Transfer | Monthly |
|---|---|---|---|---|---|
| Plus | 2 | 8 GB | 100 GB NVMe | 8 TB | $24.49 |
| Turbo | 4 | 16 GB | 200 GB NVMe | 16 TB | $42.99 |

Promo pricing is for new customers only, so it never applies to this account.
The quoted rate applies from the first invoice and is held for 12 months as
long as no add-ons are bought. The VPS can be cancelled at any time.

At like-for-like sizes the gap is small:
- Plus costs 49 cents more than DigitalOcean's 2 vCPU / 4 GB box, for double
  the RAM and NVMe disk.
- Turbo costs about $5 a month less (~$60 a year) than DigitalOcean's 4 vCPU /
  8 GB box, for double the RAM and disk.

Either vendor saves roughly $1,180 to $1,470 a year against Render.

Backups: DigitalOcean's droplet backups add 20% of the droplet price weekly
($9.60 on the $48 box) or 30% daily. Neither is needed while R2 dumps are the
source of truth. NameHero's nightly full-VPS backups are an add-on ordered at
signup and restore the whole machine. Buying one would also end the 12-month
price hold.

**NameHero's answers (2026-10-11).** These are the six questions sent on
2026-10-05, plus what the reply confirmed without being asked:

| Question | NameHero's answer |
|---|---|
| Ubuntu 24.04 image | **Not confirmed.** NameHero says it would confirm availability at initial provisioning. |
| cloud-init, API deploy, snapshots, rebuilds | **Not confirmed.** NameHero says it would confirm which of these are self-service and which go through the management panel. |
| In-place Plus → Turbo upgrade | **Not answered.** |
| Dedicated vs shared vCPU | **Not answered.** The reply says the hosts are AMD EPYC, but the generation varies by host and is confirmed only after provisioning. |
| Data center and a test IP | **Declined.** NameHero would not estimate Lenexa-to-San Francisco latency before confirming a deployment location, and sent no test IP. |
| Mid-month cancel billing | **Partly answered.** Cancel any time. Proration was not stated. |
| Price and term | **Confirmed:** month-to-month, held 12 months with no add-ons. |
| Network and access | **Confirmed:** one dedicated IPv4 address and full root. |

**Where NameHero is better.**
- **RAM and disk per dollar.** Turbo's 16 GB suits Postgres plus the unpruned
  `bgio` blob store; the July freezes were memory starvation as well as CPU.
  Unmanaged plans run on NVMe. A third-party HostAdvice benchmark of a
  Turbo-class box reported about 1.3 GB/s sequential read and about 15k random
  4K IOPS (not re-verified here). DigitalOcean Basic uses SSD.
- **Price, slightly.** As above, about $5 a month at the 4-core size and level
  at the 2-core size.
- Bandwidth allowance and a 30-day money-back window. Neither matters here.

**Where DigitalOcean fits this migration.**
- **Region.** With the database co-located, `sfo3` no longer matters for the
  app-to-DB hop. It still matters because Socket.IO rides Cloudflare to the
  origin, so origin round-trip time shows up in live matches. San Francisco
  serves a West Coast player base. NameHero's US site is Lenexa, Kansas, and
  NameHero declined to name the deployment location or give a test IP to
  measure from.
- **CPU class is known.** DigitalOcean Basic is shared vCPU, and that is
  stated. The noisy-neighbor risk for the 250 ms bot-ally loop is known, and
  the fix is a resize to CPU-Optimized ($84) on the same account. NameHero
  markets EPYC cores but did not say whether they are dedicated.
- **Provisioning is confirmed.** The `legendary-arena-lab` provisioners are
  vendor-neutral: lab #18 (2026-10-04) runs the whole chain in its
  `provision-smoke` CI on a fresh Ubuntu 24.04 machine. The scripts still
  assume three things: a 24.04 image, cloud-init user-data at create, and a
  self-service destroy-and-rebuild for the full-rebuild drill on
  [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md). DigitalOcean provides all
  three, plus snapshots, cloud firewalls, and per-second billing that makes a
  rehearsal rebuild cheap. NameHero has confirmed none of the three.

**What would change the call.** NameHero becomes the better buy if it confirms
four things in writing before an order:
1. The Ubuntu 24.04 image.
2. cloud-init user-data at create.
3. A self-service snapshot and rebuild.
4. The data center, with a test IP to measure Cloudflare-to-origin latency
   from the West Coast.

If all four come back yes, Turbo at $42.99 beats DigitalOcean's $48 box on
every axis except region. At the measured start size, though, the comparison
is Plus ($24.49) against the $24 droplet: level on price, so a yes buys RAM
headroom the workload doesn't use, not savings. Don't hold the cutover for the
answers: each week on Render costs about $28 more than the $24 droplet would.


### Vendor survey (2026-10-11)

Hetzner Cloud in depth, plus four other providers, checked against the
cutover's hard requirements from vendor pricing and docs pages. Figures marked
*verified* were re-checked against the vendor page. The call is unchanged:
DigitalOcean, `sfo3`.

The hard requirements; a vendor that fails any one is out:
1. An Ubuntu 24.04 image at create.
2. cloud-init user-data at create.
3. A self-service snapshot and rebuild.
4. A named US West data center.
5. Month-to-month or hourly billing at the regular rate, with no promo or term.
6. A KVM VM with root access and a dedicated IPv4.

| Vendor | US West location | Hard reqs | ~2 vCPU | ~4 vCPU | Price source |
|---|---|---|---|---|---|
| DigitalOcean | San Francisco (`sfo3`) | Pass | 2 / 4 GB / 80 GB, $24 | 4 / 8 GB / 160 GB, $48 (CPU-Optimized dedicated 4 / 8, $84) | Vendor page, 2026-10-04 |
| Hetzner Cloud | Hillsboro, OR | Pass | CPX21: 3 / 4 GB / 80 GB, $37.49 | CPX31: 4 / 8 GB / 160 GB, $73.49 (CCX23, 4 dedicated / 16 GB, $102.99) | *Verified* (US price-adjustment page); plus ~$0.60/mo IPv4 and VAT |
| Akamai / Linode | Fremont, Seattle, Los Angeles | Pass | 2 / 4 GB / 80 GB, $24 | 4 / 8 GB / 160 GB, $48 | Survey; not re-checked |
| Vultr | Silicon Valley, Seattle, Los Angeles | Pass | 2 / 4 GB, ~$20 | 4 / 8 GB, ~$40 | Survey; not re-checked (vendor page refused the fetch) |
| AWS Lightsail | Oregon | Pass | 2 / 4 GB / 80 GB, $24 | 2 / 8 GB / 160 GB, $44; 4 / 16 GB / 320 GB, $84 | *Verified* (pricing page) |
| OVHcloud US | Not confirmed | Fails 4–5 until confirmed | VPS-1: 2 / 4 GB / 40 GB, $4.54 | VPS-2: 4 / 8 GB / 75 GB, $8.50 | Listed prices appear to be 12-month upfront; no month-to-month price or named US site shown |
| NameHero | Not confirmed (Lenexa, KS) | Fails (unconfirmed) | Plus: 2 / 8 GB / 100 GB, $24.49 | Turbo: 4 / 16 GB / 200 GB, $42.99 | Written quote, 2026-10-11 |

**Hetzner.** Hetzner raised US cloud prices for new orders and rescales on
2026-06-15. Its Hillsboro location now costs more than DigitalOcean at the size
this cutover needs: CPX31 at $73.49 plus IPv4, against $48, or about **$312 a
year more**. The "best price/performance" reputation, and the one-line
candidate entry in [AI Second Brain](ai-second-brain.md), come from before that
increase and from EU pricing.

On features, the survey found Hetzner passes every requirement:
- Ubuntu 24.04, cloud-init, snapshots and rebuilds.
- Hourly billing capped at the monthly price.
- An official Terraform provider, cloud firewalls, and private networks.
- In-place rescale, though the disk cannot shrink, so a downsize must keep the
  disk size.

Against it:
- US servers include about 1 TB of traffic, well above the 6–8 GB a month
  production uses.
- New accounts may face ID or prepayment checks.
- The US footprint is newer and runs in third-party data centers.

Hetzner is worth a second look only if dedicated vCPU becomes a requirement.
CCX13 (2 dedicated vCPU / 8 GB, $50.99) is the cheapest dedicated option
surveyed.

**The others.**
- Akamai/Linode matches DigitalOcean's prices exactly and has a Bay Area site
  (Fremont), so it is the drop-in alternative if DigitalOcean ever disappoints.
- Vultr looks about $8 a month cheaper at 4 / 8 GB with three West Coast
  cities. Re-check its price before relying on that.
- Lightsail's 4-vCPU bundle carries 16 GB but costs $84. Lightsail bundles are
  burstable-CPU per the survey, which doesn't suit the sustained 250 ms bot-ally
  loop. That point wasn't confirmed on the pricing page.
- OVHcloud and NameHero stay out until their month-to-month terms and data
  centers are confirmed in writing.

**Ranking (the decision is Jeff's).**
1. DigitalOcean `sfo3`. It passes everything and is the current call.
2. Akamai/Linode or Vultr, at the same price or slightly cheaper with true West
   Coast sites.
3. Hetzner Hillsboro, only for dedicated vCPU.
4. OVHcloud and NameHero, not until confirmed.

The survey said the $48 droplet matches today's footprint "with headroom". It
matches Render's 8 GB *allocation* exactly, but measured use is about 1 GB, so
headroom is answered by usage (see
[Sizing from measured use](#sizing-from-measured-use-2026-10-11)).

### Architecture candidates (decided)

The evaluation is resolved. The migration PLAN selects a **single
self-hosted host with the server and PostgreSQL co-located** on it (Ubuntu server
+ self-hosted Ubuntu Postgres on one box, no cross-provider hop) — the family of
Options C/D below, minus a second database server. The table is retained as the
record of what was weighed and why the highest-risk option was avoided:

| Option | Configuration | Notes |
|---|---|---|
| **A** | Render server + Render Postgres | Production until 2026-10-12. |
| **B** | Ubuntu server + Render Postgres | Stateless-server move only; puts the app↔DB link across the public internet (see below). |
| **C** | Ubuntu server + managed Postgres (co-located) | Self-hosted app tier, DB still managed, app and DB back on one fast private network. |
| **D** | Ubuntu app server + Ubuntu database server | Fully self-managed. |
| **E** | Render server + self-hosted Ubuntu Postgres | **Highest-risk of the set — avoid.** Self-hosts the crown-jewel DB *and* forces the app↔DB link over the public internet, inverting the safer "self-host the stateless tier first, keep the stateful tier managed" ordering. |

The choice is made at the migration-program level (`legendary-arena-lab` repo,
`docs/PLAN.md`). Its transcription into an engine-repo `DECISIONS` entry and a
migration Work Packet is still pending.

Option B was the only one that needed a measurement. A boardgame.io move
handler issues many small queries, and the bot-ally poll runs every 250 ms per
live match, so a cross-provider app↔DB link is a chatty, latency-sensitive
profile. A latency probe from the lab was to be the gate on whether B was worth
doing. Co-location removed that hop, so the probe is moot.

## Interactions

- **[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md)** — builds and runs
  the host these figures size. Its target configuration follows the
  [current call](#current-call-2026-10-11).
- **[AI Second Brain](ai-second-brain.md)** — sized and hosted separately; it
  shares the vendor research but not this box.
- **[Architecture & Library Adoption Inventory](architecture-inventory.md)** —
  the former Render plan values the cost case bills against (`render.yaml` is
  authoritative if the inventory lags).
- **[Development Workflow](development-workflow.md)** — the Render deploy loop
  the migration replaced: `deploy-server.yml` deploys after CI passes, through
  the droplet's `la-deploy` gate and `40-app-deploy.ps1` (D-24708).

## Edge Cases

- **Prices drift.** Every figure is dated, and vendors reprice (Hetzner's US
  increase took effect 2026-06-15). Re-check the vendor page before relying on
  a number here.
- **Allocation is not use.** Render's 8 GB is what was bought after the July
  incidents, not what production uses. Size from metrics.
- **The database figures are upper bounds.** They were read from a
  low-resolution screenshot.
- **A disk resize is one-way.** Resize CPU and RAM only on DigitalOcean, and
  note that Hetzner's rescale can't shrink a disk either.
- **The Render build line is flat.** It billed $5 at 41 minutes and at nearly
  seven hours, so build trimming won't lower the bill.
- **Promo and term pricing mislead.** NameHero's first published figures were
  3-year prepaid rates; compare month-to-month regular rates only.

## History

- **2026-07** — Both Render plans raised to cure CPU and memory starvation
  (reasons in `render.yaml`).
- **2026-10-02** — Vendor reconfirmed as DigitalOcean.
- **2026-10-04** — First NameHero comparison, from published prices. Those
  were 3-year-term rates: the $15.92 and $27.94 "regular" figures and the
  "about $240 a year" gap are withdrawn.
- **2026-10-05** — NameHero sent month-to-month quotes for the existing
  account; six follow-up questions sent.
- **2026-10-11** — NameHero's written answers arrived; DigitalOcean held. A
  multi-vendor survey led by Hetzner replaced an earlier, unrecorded Hetzner
  look; DigitalOcean held. Measured Render use set the start size at 2 vCPU /
  4 GB (lab D-002, `legendary-arena-lab` #19). This analysis moved here from
  Ubuntu Lab Provisioning so that page covers the host procedure only.
- **2026-10-12** — Cutover: `api.` and its PostgreSQL moved to the $24
  droplet, and the Render web service was suspended for the 7-day rollback
  window (see [Cutover](ubuntu-lab-provisioning.md#cutover-2026-10-12)).
- **2026-10-19** — GitHub warned that the `barefootbetters` account had used 90%
  of its Actions minutes. The run history put the overage at about $5.77 for
  October, all from studio repos. Legendary Arena's own Actions cost is $0
  (see [GitHub Actions minutes](#github-actions-minutes-october-2026)). The
  account's Actions budget was set to $20 a month the same day.

## References

- [`render.yaml`](../render.yaml) — Render plan values and the reasons both
  plans were raised.
- Render invoices for August and September 2026, in the operator accounting
  folder listed in `source`.
- `legendary-arena-lab` repo — `docs/PLAN.md` (the migration program, lab
  D-002) and `infra/` (the provisioners).
- [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md) and
  [AI Second Brain](ai-second-brain.md) — companion pages.
