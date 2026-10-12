---
title: Ubuntu Lab Provisioning
type: Tutorial
tags:
  - infrastructure
  - digitalocean
  - ubuntu
  - postgres
  - deployment
  - operator-reference
  - migration
  - draft
related:
  - architecture-inventory.md
  - development-workflow.md
  - operational-health-checks.md
  - data-file-locations.md
  - workspace-map.md
  - ai-second-brain.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\ubuntu-lab-provisioning.md (this page — https://ewiki.legendary-arena.com/ubuntu-lab-provisioning/)
  - ../render.yaml
  - ../docs/ops/DOMAINS.md
  - ../docs/ops/domains.json
  - C:\pcloud\LA\ops\accounting\expenses2026\render-Invoice-0SPQWPNF-0005.pdf (Render bill, Aug 2026)
  - C:\pcloud\LA\ops\accounting\expenses2026\render-Invoice-0SPQWPNF-0006.pdf (Render bill, Sep 2026)
last-reviewed: 2026-10-11
---

# Ubuntu Lab Provisioning

> **Migration in progress.** `api.legendary-arena.com` and its PostgreSQL are
> moving off Render onto a self-hosted DigitalOcean Ubuntu droplet fronted by
> Cloudflare. (The ewiki already left Render on 2026-10-11, for an assets-only
> Cloudflare Worker rather than Pages — D-24690.) The move is decided at the
> migration-program level: the `legendary-arena-lab` repo holds the runbook and the
> infrastructure-as-code (`docs/PLAN.md`, `infra/`, and its operator wiki). Until
> the final decommission phase, Render stays warm as the rollback target (see the
> [Architecture & Library Adoption Inventory](architecture-inventory.md) for the
> live-until-cutover topology). This page defines nothing and governs nothing — it
> is the engine-repo record that the migration is happening; the program repo owns
> the executable steps.
>
> **Governance status — pending transcription.** This page is being flipped ahead
> of the engine-repo governance it will ultimately cite. The `DECISIONS.md` lock
> ("api + Postgres leave Render for DigitalOcean + Cloudflare; ewiki → Cloudflare
> Pages") and the migration Work Packet are **not yet written** (when this
> callout was first written, the latest decision was D-24236). Until they land, the migration PLAN in the
> `legendary-arena-lab` repo is the governing source; this page stays
> `status: draft` and deliberately cites no `D-`/`WP-` IDs it cannot yet resolve.
> The former "records no decision to leave Render" disclaimer is superseded: that
> decision is made — only its transcription into `DECISIONS.md` is outstanding.
> **Update 2026-10-11:** the ewiki half is now transcribed, as D-24690 — onto an
> assets-only Cloudflare **Worker**, not Pages (a Pages project always serves an
> ungated `*.pages.dev` alias). The api + Postgres half is still untranscribed.

## Summary

The single DigitalOcean droplet (Ubuntu 24.04 LTS) that `api.legendary-arena.com`
and its PostgreSQL are migrating onto, with Postgres self-hosted on the same box
and Cloudflare in front. It starts at **2 vCPU / 4 GB / 80 GB ($24/mo) with a
2 GB swapfile** and resizes up only on evidence. The migration program first
planned 4 vCPU / 8 GB, but measured Render use (2026-10-11) is about 1 GB and
well under one core in total; see
[Sizing from measured use](#sizing-from-measured-use-2026-10-11).

This page is the engine-repo **record** of that migration. The executable
runbooks and infrastructure-as-code — cloud-init, the numbered provisioners,
Nginx + Cloudflare TLS, self-hosted Postgres, the systemd unit, and the SSH
deploy pipeline — live in the **`legendary-arena-lab`** repo (`infra/`,
`content/`, and its operator wiki). The hand-run steps below are retained as the
original rehearsal procedure and as background; where they differ from the program
(PM2 → systemd, Certbot → Cloudflare Origin Certificate, cross-provider probe →
co-located localhost DB), the program's `infra/` artifacts are authoritative.

The operator-capability and disaster-recovery-rehearsal value that first justified
the box still holds — but the box is no longer exploratory. The move is decided
(see the callout) and in progress. When it was planned in July, cost looked
roughly even and control was the driver. That changed once Render's plans were
raised under load: the August and September 2026 bills were **$146.50** and
**$146.35**, against $24 a month for the target droplet ($48 on the first resize
step). Cost is now a driver too (see
[Cost case](#cost-case-september-2026)).

## Mechanics

### What this host is — and the migration phase it is in

- **Is becoming:** the production host for `apps/server` and a self-hosted
  PostgreSQL 18, behind Nginx + Cloudflare, under systemd — the target
  architecture locked in the migration PLAN (`legendary-arena-lab` repo).
- **Is not yet carrying production traffic.** Until the cutover phase, the box is
  provisioned and rehearsed against a **copy** of the data, never the live prod
  DB. The Render managed Postgres allows credential-gated public inbound
  (`ipAllowList: ['0.0.0.0/0']` in `render.yaml`) — that is a footgun, not an
  invitation; rehearsal always runs against a restored copy (see the Restore
  drill). Render stays warm as the rollback target through the decommission phase.

Self-hosting Postgres on this box is now the **chosen** path, not an open
question: the migration PLAN co-locates the server and database on one host
(no cross-provider hop). What remains is the disciplined execution and the
governance transcription noted in the callout — not the architecture decision.

### Cost case (September 2026)

The vendor was reconfirmed as **DigitalOcean** on 2026-10-02. It held after a
NameHero price comparison on 2026-10-04. It held again on 2026-10-11, after
NameHero's written month-to-month quote and a multi-vendor survey led by
Hetzner (see
[Vendor comparison](#vendor-comparison-digitalocean-vs-namehero-2026-10-04) and
[Vendor survey](#vendor-survey-2026-10-11)).
NameHero had been named elsewhere, but only as a candidate host for the
[AI Second Brain](ai-second-brain.md), never for this migration.

What Render charged for August 2026 (invoice `0SPQWPNF-0005`, paid
2026-09-01) and September 2026 (invoice `0SPQWPNF-0006`, paid 2026-10-01):

| Line | Render plan | Aug 2026 | Sep 2026 | After migration |
|---|---|---|---|---|
| Game server | `pro`, 2 CPU / 4 GB | $85.00 | $85.00 | on the droplet |
| PostgreSQL | `pro-4gb` plus storage | $55.30 | $55.30 | on the droplet, `localhost` |
| Builds | pipeline minutes (Aug 41 m, Sep 6 h 42 m) | $5.00 | $5.00 | GitHub Actions deploy |
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
1. **Finish the migration.** It restarted on 2026-10-04. The work that needs
   no droplet is merged: `legendary-arena-lab` #17 and #18 fixed the
   provisioners and proved them in CI on Ubuntu 24.04. What remains starts
   with a payment method on the DigitalOcean account. Every month on Render
   costs about $120 more than the $24 droplet would. The phases and gates in the
   PLAN are unchanged.
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
4. **Trim Render only if cutover is more than a month or two out.**
   - Build only the server and the packages it depends on
     (`pnpm --filter @legendary-arena/server... build`) instead of
     `pnpm -r build`. That shortens deploys, but it probably won't lower the
     $5 build line: August's 41 minutes billed the same $5 as September's
     6 h 42 m.
   - Step the server from `pro` down to `standard`, which saves $60 a month,
     but only if the September figures show headroom. Under-provisioning is
     what caused the July freezes.
5. **Keep the rollback window short.** Render bills in full while it stays
   warm, so set the PLAN's "N days" deliberately (for example, 14) and
   decommission on schedule.

### Vendor comparison: DigitalOcean vs NameHero (2026-10-04)

**Current call (2026-10-11): stay with DigitalOcean for this cutover.**
NameHero's written reply settled the price, and the price gap is now small.
It did not settle any of the operational questions the cutover depends on:
the Ubuntu 24.04 image, cloud-init, self-service snapshots and rebuilds, the
data center, and whether vCPUs are dedicated. DigitalOcean answers all of
those today. NameHero remains a reasonable host for a separate
[AI Second Brain](ai-second-brain.md) box, uncoupled from the arena deploy
pipeline.

This section was first written on 2026-10-04 from NameHero's published
prices. Those turned out to be 3-year-term rates. NameHero reopened the
question on 2026-10-05 with month-to-month quotes for the existing account,
and its answers to six follow-up questions arrived on 2026-10-11.

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
long as no add-ons are bought. The VPS can be cancelled at any time. The
$15.92 and $27.94 "regular" figures in the 2026-10-04 version of this section
were 3-year prepaid rates and are withdrawn.

At like-for-like sizes the gap is small:
- Plus costs 49 cents more than DigitalOcean's 2 vCPU / 4 GB box, for double
  the RAM and NVMe disk.
- Turbo costs about $5 a month less (~$60 a year) than DigitalOcean's 4 vCPU /
  8 GB box, for double the RAM and disk.

The "about $240 a year" gap claimed on 2026-10-04 came from the 3-year rates
and is gone. Either vendor saves roughly $1,180 to $1,470 a year against
Render.

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
  self-service destroy-and-rebuild for the §6 drill. DigitalOcean provides all
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

### Sizing from measured use (2026-10-11)

Render gives production 8 GB and
3 CPUs in total: 4 GB / 2 CPU for the server and 4 GB / 1 CPU for Postgres. The
Render metrics for the 7 days to 2026-10-11 show both far below that:

| Service | Memory | CPU |
|---|---|---|
| Game server (`pro`, 4 GB / 2 CPU) | ~5% (~200 MB) steady; spikes to ~10–13% (~400–500 MB) around deploys | ~0–1% steady; spikes to ~10–13% (~0.25 core) at deploys |
| `legendary-arena-db` (`pro-4gb`, 4 GB / 1 CPU) | Flat, under ~10% (under ~400 MB) | Flat, near 0% |

The database figures are read from a low-resolution screenshot, so treat them
as upper bounds. Active connections were a few out of 100, and the transaction
volume came in short bursts. Production uses about 1 GB and well under one core
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

### Vendor survey (2026-10-11)

A separate research session surveyed Hetzner Cloud in depth and four other
providers against the cutover's hard requirements, using vendor pricing and
docs pages. An earlier Hetzner look was never recorded, so this replaces it.
Figures marked *verified* were re-checked against the vendor page in this pass.
The current call is unchanged: DigitalOcean, `sfo3`.

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

One correction to the survey: it said the $48 droplet matches today's footprint
"with headroom". It matches Render's 8 GB *allocation* exactly. Measured use is
about 1 GB, so the real headroom question is answered by usage, not allocation
(see [Sizing from measured use](#sizing-from-measured-use-2026-10-11)).

### Prerequisites & effort

- A DigitalOcean account with an SSH key pair already uploaded.

  **Account status (2026-10-04).** The account is open but has **no payment
  method**, so it cannot create a droplet yet. Usage is $0 and no resources
  exist. The account also holds a $5 "Inference Cloud Trial" credit that
  expires 2026-10-21. It is named for the inference products, so do not count
  on it covering droplet usage. Remaining setup, in order:
  1. Add a payment method (operator only).
  2. Set a spend alert a little above the planned droplet price, for example
     $30 a month for the $24 box (raise it on a resize). The billing page now offers spend alerts.
  3. Upload the SSH public key, and create an API token if provisioning goes
     through `doctl` or Terraform.
- A throwaway lab hostname (e.g. `lab.<your-domain>`) ready to point at the
  droplet IP.
- Familiarity with the production topology in the
  [Architecture Inventory](architecture-inventory.md).
- A local repo clone and the ability to produce a Postgres dump from a
  **non-production** source.

**Effort:** first full provision ~2–4 hours; rebuilds are much faster once the
procedure is muscle memory (that speed is itself the §6 goal).

### Why "the server is relocatable at all"

`apps/server` is **persistence-stateless**: live match state is written to Postgres
(the boardgame.io adapter's `bgio` schema), so a server restart does not drop live
matches. That single property is what makes relocating the server — which this
migration does — safe in the first place. "Stateless" here means
*persistence-stateless*, **not** *connection-stateless* — live WebSocket
connections and the server's cron singletons (legends publisher, match reaper,
capture harvester) still live in-process. One box is fine; see Edge Cases for what
multi-node would additionally require.

### 1 — Provision the droplet

- **Region:** `sfo3` (San Francisco). It was first chosen as the closest
  DigitalOcean region to Render's Oregon Postgres. With the database now
  co-located on the droplet, the pin holds for a different reason: Socket.IO
  rides Cloudflare to the origin, so origin round-trip time reaches live
  matches, and San Francisco serves a West Coast player base.
- **Image:** Ubuntu 24.04 (LTS). **Size:** 2 vCPU / 4 GB / 80 GB SSD ($24/mo)
  with a 2 GB swapfile (`08-swap.ps1`), per lab D-002 (2026-10-11, sized from
  measured Render use). The PLAN's original 4 vCPU / 8 GB / 160 GB ($48/mo) is
  the first resize step. See
  [Vendor comparison](#vendor-comparison-digitalocean-vs-namehero-2026-10-04).
- **Auth:** SSH key only. Create via the DigitalOcean UI or `doctl`.

Baseline hardening (first boot as root, create the working user, then switch to it):

```bash
adduser operator && usermod -aG sudo operator      # non-root working user
# Log out, back in as operator, then harden SSH:
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload ssh

sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable   # 'Nginx Full' = 80 + 443

sudo apt update && sudo apt install -y fail2ban unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades    # enable auto security patches
```

### 2 — Base application stack

Install Node **before** the global `pm2`, and match the repo pin exactly
(`.node-version` → `24.18.0`, D-24205) — a version manager keeps that pin explicit:

```bash
curl -fsSL https://fnm.vercel.app/install | bash   # or nvm
source ~/.bashrc
fnm install 24.18.0 && fnm use 24.18.0 && fnm default 24.18.0
node -v                                            # confirm v24.18.0
corepack enable                                    # pnpm per the packageManager pin

sudo apt install -y git nginx postgresql certbot python3-certbot-nginx  # OS-level pieces
sudo npm install -g pm2                            # after Node is on PATH
```

`apt` installs only the **OS-level** pieces (Nginx, PM2's runtime, the lab
**Postgres server**). The application's own runtime dependencies —
`boardgame.io`, `pg`, the `@legendary-arena/*` workspace packages — are **not**
system packages: they come from `pnpm install` (§3) and run **inside** the Node
process. There is nothing to `apt install` for boardgame.io.

Nginx as a TLS-terminating reverse proxy. Point `lab.<your-domain>` at the droplet
IP, run `sudo certbot --nginx -d lab.<your-domain>`, and use a server block whose
`location /` forwards WebSocket upgrades (Socket.IO needs the `Upgrade`/`Connection`
headers, or live match traffic silently fails):

```nginx
server {
    server_name lab.<your-domain>;
    location / {
        proxy_pass http://127.0.0.1:3000;      # apps/server port — export PORT=3000 (§3); it defaults to 8000
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade; # WebSocket upgrade for Socket.IO
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # Certbot inserts the listen 443 / ssl_certificate lines here.
}
```

### 3 — Deploy `apps/server` against a COPY of the DB

The build/start commands mirror what `render.yaml` runs; the difference is the lab
runs them by hand under PM2 instead of Render's build pipeline:

```bash
git clone <repo-url> legendary-arena && cd legendary-arena
pnpm install && pnpm -r build                      # same as render.yaml buildCommand

# Create the lab role + database once (never the production DB):
sudo -u postgres createuser -P la_lab              # prompts for a lab password
sudo -u postgres createdb -O la_lab la_lab
export DATABASE_URL="postgres://la_lab:<password>@localhost:5432/la_lab"
export PORT=3000                                    # apps/server defaults to 8000
                                                    # (process.env.PORT ?? '8000'); pin it to
                                                    # match the Nginx proxy_pass in §2

node scripts/migrate.mjs                            # migrations against the LAB DB
pm2 start "node --import ./apps/server/node_modules/tsx/dist/loader.mjs \
  apps/server/src/index.mjs" --name la-server
pm2 save && pm2 startup                             # survive reboots
```

Environment: the server reads ~15 secrets that `render.yaml` marks `sync: false`
(JWT, Hanko ×3, Stripe ×3, analytics salt, four submit tokens, R2 ×4, Brevo ×2).
For a lab, supply **throwaway / test-mode** values (Stripe test keys, a scratch R2
bucket, a lab JWT secret) — never copy production secrets onto a learning box.
`DATABASE_URL` points at the local lab Postgres, never at prod. Confirm health via
the `/health` endpoint (and `/health/legends-publisher` if that loop is enabled).

### 4 — Latency probe (superseded by the co-located target — historical)

> **Moot for the chosen architecture.** The migration co-locates the server and
> PostgreSQL on the same host (app ↔ DB over `localhost`), so the cross-provider
> app↔DB hop this probe measured no longer exists. This section is retained as
> background for why a "keep Postgres on Render" option was rejected; it is not a
> step in the migration.

A production "move only the stateless server, keep managed Postgres" step would put
the app↔DB link across the public internet instead of Render's internal network. A
boardgame.io move handler issues many small queries, and the bot-ally poll runs
every 250 ms per live match — a chatty, latency-sensitive profile. Stand the server
on the droplet, point it at a **copy** DB reachable over the same provider boundary
you would use in production (the §1 region), and measure per-round-trip query
latency under a simulated match load. Treat the result as the gate on whether that
move is worth doing — measure, don't assume.

### 5 — Restore drill (rehearse before self-managed PG ever touches prod)

Self-hosting Postgres means owning backups and restores. Rehearse it on the lab
against a copy, on a schedule, until it is boring:

```bash
pg_dump "$SOURCE_COPY_URL" -Fc -f /tmp/la-lab.dump # capture from a NON-prod source
createdb la_restore_test                           # fresh target
pg_restore -d la_restore_test /tmp/la-lab.dump     # restore
# Verify: row counts on key legendary.* tables, and that apps/server starts
# clean against the restored copy. A restore you have not tested is not a backup.
```

### 6 — Disaster-recovery exercise (full rebuild from docs)

The restore drill proves the data; this proves the *whole procedure*. At least
once, destroy the entire lab host and rebuild it using only what is written down —
no memory, no undocumented step. A rebuild has demonstrated recovery when a fresh
host is provisioned, the app redeployed, Postgres restored from a backup, TLS
re-established, and `/health` returns green — all from the documented steps alone.
Backups are only proven after a full recovery has actually been demonstrated.

The authoritative, executable version of this exercise — recovery objectives
(RPO/RTO), the DR-01…DR-05 scenario procedures, and the binary
business-capability validation checklist — lives in the operator runbook at
[`docs/ops/DISASTER_RECOVERY.md`](../docs/ops/DISASTER_RECOVERY.md) (a
prescriptive runbook, deliberately kept out of the descriptive ewiki). This lab
is where that runbook is *rehearsed*; the runbook is what you follow when it is
not a drill.

### Ownership boundary (what a self-managed move would transfer)

Render currently owns, and a move to a self-managed droplet would transfer to the
operator, each of the following:

- Host maintenance and OS/kernel security patching
- Service lifecycle (restarts, health recovery, deploy pipeline)
- Managed Postgres operations (tuning, connection management, version upgrades)
- Backup infrastructure and point-in-time recovery
- Service monitoring and alerting
- Platform-level security updates

This list is the operational cost side of the migration, and the program has
**accepted** the transfer: patching, service lifecycle, Postgres operations,
backups/point-in-time recovery, monitoring, and platform security updates become
operator responsibilities. The single-box SPOF that comes with it is mitigated by
tested `pg_dump` → R2 backups and a rehearsed restore (Mechanics §5–6), which the
PLAN makes a hard gate before cutover.

### What a successful lab looks like

Descriptive, not a pass/fail gate: the lab has served its purpose once the
operator can, unaided —

- provision a fresh Ubuntu host from scratch,
- deploy `apps/server` against a lab database,
- perform a complete Postgres backup **and** restore,
- recover the host after a simulated failure (the §6 rebuild),
- rotate TLS certificates and application secrets,
- measure and document app↔database latency (§4), and
- patch and maintain the host across at least one release cycle.

### Architecture candidates (decided — retained as evaluation history)

The evaluation is now resolved. The migration PLAN selects a **single
self-hosted host with the server and PostgreSQL co-located** on it (Ubuntu server
+ self-hosted Ubuntu Postgres on one box, no cross-provider hop) — the family of
Options C/D below, minus a second database server. The table is retained as the
record of what was weighed and why the highest-risk option was avoided:

| Option | Configuration | Notes |
|---|---|---|
| **A** | Render server + Render Postgres | Current production. |
| **B** | Ubuntu server + Render Postgres | Stateless-server move only; introduces the cross-provider app↔DB hop the §4 probe measures. |
| **C** | Ubuntu server + managed Postgres (co-located) | Self-hosted app tier, DB still managed, app and DB back on one fast private network. |
| **D** | Ubuntu app server + Ubuntu database server | Fully self-managed. |
| **E** | Render server + self-hosted Ubuntu Postgres | **Highest-risk of the set — avoid.** Self-hosts the crown-jewel DB *and* forces the app↔DB link over the public internet, inverting the safer "self-host the stateless tier first, keep the stateful tier managed" ordering. |

The choice is made at the migration-program level (`legendary-arena-lab` repo,
`docs/PLAN.md`). Its transcription into an engine-repo `DECISIONS` entry and a
migration Work Packet is the pending governance noted in the callout.

## Interactions

- **[Architecture & Library Adoption Inventory](architecture-inventory.md)** —
  the authoritative live picture this lab shadows: Render account model and
  sizing (server `pro`, Postgres `pro-4gb`, both raised under load in July
  2026; treat `render.yaml` as authoritative if the generated inventory ever
  lags a plan change), the
  managed-database notes, and the full deployment topology. Read it first.
- **[Development Workflow](development-workflow.md)** — the production
  develop-from-anywhere loop (Claude Code → GitHub → auto-deploy on merge to
  `main`). The migration replaces Render's push-to-main auto-deploy with a GitHub
  Actions → SSH → `git pull` + build + `systemctl reload` pipeline (owned by the
  `legendary-arena-lab` program); the hand-run steps on this page are its manual,
  rehearsal-time equivalent.
- **[Operational Health Checks](operational-health-checks.md)** — `pnpm check`
  walks toolchain and external-service connectivity (PostgreSQL, R2, Hanko, CORS);
  validate a lab deploy the same way production is validated.
- **[Data & File Locations](data-file-locations.md)** and
  **[Workspace Map](workspace-map.md)** — where the `legendary.*` tables, R2
  prefixes, and env/config live, so a lab copy pulls from the right places.

## Edge Cases

- **Region is about players now, not the database.** DigitalOcean has no Oregon
  region; `sfo3` was the closest to Render's Oregon DB. Co-location removed that
  hop, but origin round-trip time still reaches live matches through Cloudflare,
  so keep the West Coast pin. A central-US host (such as NameHero's Lenexa site)
  would trade West Coast latency for national evenness.
- **Never point the lab at production data.** The credential-gated `0.0.0.0/0`
  inbound rule makes prod *reachable* — that convenience is exactly the footgun.
  Always run against a restored copy.
- **Do not copy production secrets onto the box.** Use test-mode credentials for
  the `sync: false` env set. A learning box is a soft target.
- **"Stateless" is persistence-stateless, not connection-stateless.** One droplet
  is fine. A future multi-node app tier would additionally need a Socket.IO Redis
  adapter (WebSocket fan-out) and leader-election / single-owner scheduling for the
  cron singletons, or the reaper and publisher double-fire.
- **`bgio` blob growth rides along.** The match store never prunes finished
  matches, so a restored copy carries that bloat (fine for a lab; a retention job
  is the standing production follow-up noted in the inventory's DB notes).
- **Build cost moves onto the box.** `pnpm -r build` is heavy; on a 2 vCPU droplet
  it is real wall-clock time, not Render's managed pipeline.
- **Version pins still bind.** Node must be `24.18.0` to match `.node-version`
  (D-24205); `boardgame.io` stays on the `^0.50.0` line. A lab on a newer Node or
  bgio is testing a different system than production.
- **Certificates and kernel patches are now yours.** Certificate renewal (Certbot
  in the hand-run steps, the Cloudflare Origin Certificate in the program) and
  kernel patches are operator responsibilities on a droplet that Render otherwise
  absorbs; unattended-upgrades may schedule a reboot.

## Open Questions

- **Governance transcription is pending (the one real open item).** The decision
  to move `api.` + Postgres off Render is made at the migration-program level, but
  it is **not yet recorded** in [DECISIONS.md](../docs/ai/DECISIONS.md) (only the
  ewiki half is, as D-24690) and has no migration Work Packet. Until both land, this page
  cites the migration PLAN rather than a `D-`/`WP-` ID and stays `status: draft`.
  The still-required execution gates are unchanged and now owned by the program:
  validated backup **and tested** restore (Mechanics §5–6), documented monitoring,
  a tested rollback (repoint Cloudflare DNS `api.` → Render), the
  operational-burden transfer (accepted — see Ownership boundary), and a check
  against the server-layer boundary in
  [`.claude/rules/architecture.md`](../.claude/rules/architecture.md).
- **Droplet size** — decided 2026-10-11: start at 2 vCPU / 4 GB ($24) with a
  2 GB swapfile, sized from measured Render use. The lab PLAN adopted it as
  lab D-002 (`legendary-arena-lab` #19, which adds `infra/scripts/08-swap.ps1`).
  This box is too small to also host the [AI Second Brain](ai-second-brain.md)
  (its floor is 8 GB). Voice (used only while driving, up to about two hours a
  day) does not require local STT/TTS on any VPS, so it does not reopen the
  16 GB question for either host.
- **Managed vs self-hosted Postgres** — decided: self-hosted on the same host
  (co-located, `localhost`), per the PLAN. No longer open.
- **The cross-provider latency threshold** — moot: the co-located target removes
  the app↔DB hop the Mechanics §4 probe measured.

## References

- [`render.yaml`](../render.yaml) — the blueprint-managed production infra source
  (authoritative for plan values): server `plan: pro`, the managed-DB `plan: pro-4gb`,
  the `sync: false` secret set, and the build/start commands this runbook mirrors.
- [Architecture & Library Adoption Inventory](architecture-inventory.md) — Render
  account model & sizing, managed-database operational notes, and deployment
  topology (generated by `scripts/architecture-inventory.mjs`).
- [`docs/ops/DISASTER_RECOVERY.md`](../docs/ops/DISASTER_RECOVERY.md) — the
  authoritative operator disaster-recovery runbook this lab rehearses.
- [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md) and
  [`docs/ops/domains.json`](../docs/ops/domains.json) — canonical subdomain manifest
  and ops runbook for the live hosts.
- [Development Workflow](development-workflow.md),
  [Operational Health Checks](operational-health-checks.md),
  [Data & File Locations](data-file-locations.md),
  [Workspace Map](workspace-map.md) — companion operator references.
