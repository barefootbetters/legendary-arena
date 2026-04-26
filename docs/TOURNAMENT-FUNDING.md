# TOURNAMENT-FUNDING.md

## Purpose

This document defines the funding model for Legendary Arena tournaments.

Legendary Arena tournaments are **community-funded** and **non-profit by
design**. Funds are collected solely to cover the **shared infrastructure
costs** required to host and operate them. There is no organizer margin,
no revenue extraction, and no prize skim.

This document is normative. It defines the funding *contract*, not the
operational procedure for running a tournament.

Capitalized keywords (MUST, SHOULD, MAY) follow RFC 2119.

## Authority

This document is governed by `docs/ai/DECISIONS.md`. Material amendments
require a DECISIONS.md entry referenced from the section being amended.

If this document conflicts with `docs/ai/ARCHITECTURE.md` or
`docs/01-VISION.md`, those documents win.

## Definitions

- **Tournament** — A scheduled, organizer-run Legendary Arena competition
  with announced rules, brackets, or standings. Casual or unscheduled
  play is out of scope.
- **Organizer** — A person with operational authority to run tournaments:
  scheduling, moderating, or holding credentials for shared infrastructure.
- **Infrastructure** — The shared technical resources required to operate
  the platform: hosting, compute, storage, bandwidth, domains, monitoring,
  and equivalent line items.
- **Contribution** — Money received through any approved funding channel.

## Funding Principles

### 1. Infrastructure-only use

Funds MUST be spent only on infrastructure as defined above. Permissible
categories include:

- Hosting and compute services
- Content delivery and bandwidth
- Databases and storage
- Domains and DNS
- Monitoring and operational tooling
- Payment-processor fees on the contributions themselves

Anything not on this list requires a `DECISIONS.md` entry before spending.

### 2. No personal compensation

Organizers, maintainers, and contributors MUST NOT receive personal income
from tournament funds. Volunteer labor is not monetized.

**Direct-expense reimbursement is permitted** when an individual pays an
infrastructure invoice out of pocket (e.g., a domain renewal). Reimbursement
requires a receipt and is logged the same as any other infrastructure
expense.

### 3. Cost recovery, not profit

Contributions are cost-sharing support, not entry fees. Surplus funds roll
forward to future infrastructure costs and MUST NOT be distributed.

### 4. Transparency

Funding sources, balances, and expense categories MUST be publicly visible
or auditable. A participant must be able to confirm, in good faith, that:

> Funds in ≈ Infrastructure costs out

Perfect precision is not required; good-faith transparency is mandatory.

## Approved Funding Channels

Two channels are approved. Both are subject to every principle above.

### Open Collective (primary)

Open Collective is the preferred channel because it provides:

- A public ledger of contributions and expenses
- Clear separation between individuals and the project's funds
- Governance designed for community-funded projects

**Policy:**
- Public funding pages MUST link to the Legendary Arena Open Collective
  as the primary channel.
- Infrastructure expenses MAY be paid or reimbursed through the collective.
- The Open Collective balance is the authoritative public view of project
  funds.

### PayPal donate link (supplemental)

A PayPal donate link MAY be used as a lower-friction supplemental channel.

**Policy:**
- PayPal funds MUST be reconciled against published infrastructure expenses
  on the same cadence as Open Collective funds.
- Any PayPal-facing copy MUST state plainly that contributions are for
  infrastructure only, do not fund prizes or personal income, and are
  reconciled publicly.
- Using PayPal does not change the non-profit, no-margin nature of the
  project.

## Disallowed Models

The following are explicitly disallowed:

- Entry fees that generate organizer profit
- Prize pools funded from organizer margin
- Sponsorships that condition gameplay, balance, or design decisions
- Advertorial or pay-to-win mechanisms
- Custodial or opaque money handling with no public accountability

## Reconciliation

- Infrastructure expenses SHOULD be summarized publicly at regular
  intervals — target: at least once per tournament season.
- Material expenses (hosting invoices, recurring service fees) SHOULD be
  reconcilable against contributions.
- Receipts or invoice summaries SHOULD be shared where the vendor's terms
  permit.

## Cost Baseline (Public Disclosure)

This section publishes a good-faith baseline of the infrastructure costs
this funding model exists to cover, so contributors can verify that
funding requests are proportionate to actual costs.

It is a **disclosure**, not a forecast or invoice. Figures are USD,
rounded, and reflect typical operating ranges. It does not constrain the
platform's own revenue model — see `docs/01-VISION.md §Financial
Sustainability` for that.

### Cost Model

Monthly costs decompose into:

- **Baseline infrastructure** — always-on services keeping tournaments
  reachable and replays available.
- **Variable overages** — usage spikes during active tournaments
  (concurrent players, replay traffic, prize-administration tooling).

This document publishes the baseline only. Variable overages are
reconciled against contributions as they occur (per `## Reconciliation`).

### Typical Monthly Baseline

| Category                    | Service                          | Typical Monthly Cost |
|-----------------------------|----------------------------------|---------------------:|
| Compute & app hosting       | Render web services / workers    |               $7–85  |
| Database                    | Render PostgreSQL (managed)      |               $7–25  |
| CDN / edge / DNS            | Cloudflare                       |               $0–20  |
| Static hosting              | Cloudflare Pages (free tier)     |                  $0  |
| Object storage & bandwidth  | Cloudflare R2 (free tier today)  |               $0–15  |
| Domain renewals (amortized) | DNS / domains                    |               $1–3   |
| **Total**                   |                                  |    **~$15–150 / mo** |

Free-tier line items reflect current vendor terms, not a permanent
guarantee. If a vendor's pricing model changes, the baseline is updated
per `## Governance and Amendments`.

### Variability

- **Lower bound** reflects light usage, off-season periods, and active
  free-tier credits.
- **Upper bound** reflects active tournaments, increased concurrent
  players, and higher database / worker tiers.
- Costs scale **gradually** with usage — never per-player or per-entry.

### Cost Drivers (and Non-Drivers)

Baseline cost is **not** driven by:

- Player success or skill rating
- Match outcomes or scenario completion
- Tournament winners or prize allocation
- Time spent playing

These are explicit non-drivers because tying infrastructure cost to any
of them would create a back-door pay-to-win surface (Vision NG-1) or a
competitive-advantage paywall (Vision NG-3). Funding from this channel
is also not used for development labor — the platform's revenue model
in Vision §Financial Sustainability covers that scope.

## Governance and Amendments

This document is the baseline funding contract for Legendary Arena
tournaments.

Amendments MUST preserve:

- No-margin operation
- Infrastructure-only spending
- Public accountability

Material changes require a `docs/ai/DECISIONS.md` entry and a reference to
that entry in the amended section.

## Sunset / Dissolution

If the project is wound down, any remaining balance MUST be either:

1. Refunded pro-rata to identifiable contributors where practical, or
2. Donated to an aligned non-profit at organizer discretion, with the
   recipient disclosed publicly.

Distribution to organizers is not permitted under any wind-down scenario.

## Summary

Legendary Arena tournaments exist to support fair, competitive play — not
to monetize participation. Community funding sustains the platform; the
platform sustains the tournaments; no one extracts value in between.

## Public Blurb (Reusable)

The following paragraph is intended for verbatim reuse on tournament
pages, donation links, and any external surface where this funding
model is referenced.

> Legendary Arena tournaments are community-funded and non-profit by
> design. Contributions cover incremental infrastructure costs only —
> hosting, bandwidth, and similar operational line items — never prizes,
> organizer income, or platform development. Contributions are
> reconciled against published costs at regular intervals on Open
> Collective. See `TOURNAMENT-FUNDING.md` for the full policy.

External surfaces SHOULD NOT paraphrase. The exact wording is governed
under `D-9701`; rewriting it in each surface's own voice causes drift
across the disclosure surfaces and undermines the transparency the
blurb exists to communicate.
