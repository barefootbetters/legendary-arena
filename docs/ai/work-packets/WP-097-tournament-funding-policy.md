# WP-097 — Tournament Funding Policy (Governance)

**Status:** Draft (drafted 2026-04-25; pre-flight pending; lint-gate self-review complete — see §Lint Self-Review below)
**Primary Layer:** Governance / Policy (no code; no engine, registry, server, or app touch)
**Dependencies:** None — this WP can land standalone. Vision §Financial Sustainability (`docs/01-VISION.md`) and Vision §Non-Goals NG-1..7 must already be present (they are; introduced in pre-WP-001 vision authoring).

---

## Session Context

The tournament funding policy was authored during a 2026-04-25 conversation between the project owner and the assistant. The policy text was iterated on, dropped into `docs/TOURNAMENT-FUNDING.md` outside the WP system, and the user then asked for retrospective WP governance — specifically, that this WP exist so a `D-9701` entry has a packet to anchor against (per the project convention that every `D-{WP}{seq}` ID points to a Work Packet).

This WP therefore performs three things at execution time:

1. **Reconciles** `docs/TOURNAMENT-FUNDING.md` with Vision §Financial Sustainability (the existing draft does not currently cite the platform-level revenue model and uses "infrastructure" in a way that overlaps Vision's platform-infrastructure scope).
2. **Anchors** the funding contract to `D-9701` in `docs/ai/DECISIONS.md` so future amendments have a governance hook.
3. **Records** the contract in `docs/ai/STATUS.md` and `WORK_INDEX.md` per the governance close pattern used by WP-085 and other doc/governance packets.

No engine, registry, server, app, or test code is touched. No new npm dependencies. No Vue / TypeScript / SQL files modified.

---

## Goal

After this session, `docs/TOURNAMENT-FUNDING.md` is the authoritative, governance-anchored funding contract for Legendary Arena tournaments, with explicit scope-distinction from Vision §Financial Sustainability. Specifically:

- The funding doc clearly distinguishes **tournament-level community funding** (organizer-side, no-margin, infrastructure-only — governed by this doc) from **platform-level revenue** (supporter subscriptions, cosmetics, organized-play licensing, royalties to Upper Deck / Marvel — governed by Vision §Financial Sustainability).
- `D-9701` in `docs/ai/DECISIONS.md` anchors the funding contract and provides the amendment hook every future tournament-funding decision must cite.
- The doc's "infrastructure" definition is narrowed to **incremental costs incurred specifically for a tournament** (e.g., dedicated bandwidth surge, prize-administration tooling, tournament-specific hosting), distinct from the always-on platform infrastructure funded by the Vision's revenue model.
- Open Collective remains the primary channel; PayPal remains supplemental; the disallowed-models list (organizer profit, prize pools from margin, gameplay-conditioning sponsorships, advertorials, opaque custodial handling) is locked.
- Sunset / dissolution behavior is locked: pro-rata refund where practical, otherwise donation to an aligned non-profit, never distribution to organizers.

---

## Assumes

- `docs/01-VISION.md` exists. Specifically:
  - `§Financial Sustainability ("No Margin, No Mission")` defines the platform-level revenue model (supporter subscriptions, cosmetics, community support tiers, organized-play licensing, Upper Deck / Marvel royalties)
  - `§Non-Goals: Exploitative Monetization` defines NG-1..7 (pay-to-win, gacha, content withheld, energy systems, ads/sponsorships, dark patterns, apologetic monetization)
- `docs/ai/ARCHITECTURE.md` exists and defines the project's authority hierarchy (CLAUDE.md > ARCHITECTURE.md > VISION.md > rules > WORK_INDEX > WPs > conversation context)
- `docs/ai/DECISIONS.md` exists and the highest current decision ID is `D-9601` (verified by `grep -nE "^## D-96" docs/ai/DECISIONS.md` returning exactly one match)
- `docs/ai/work-packets/WORK_INDEX.md` exists and Phase 7 is the appropriate insertion point for live-ops governance packets (per the §"Phase 7 — Beta, Launch & Live Ops" header)
- `docs/TOURNAMENT-FUNDING.md` exists in its 2026-04-25 form (created during the drafting conversation, untracked at session start)
- `.claude/rules/work-packets.md` is the governing rules file for WP discipline
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` is the lint contract this WP must satisfy

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §"Document override hierarchy"` — establishes that VISION.md is authority #3; WPs are authority #6. This WP must not redefine or override anything in VISION.md; it adds a *subordinate* policy contract that VISION.md does not currently address (tournament-level funding).
- `docs/01-VISION.md §"Financial Sustainability"` (lines ~635-687) — defines the platform-level revenue model and the "No Margin, No Mission" framing in the standard nonprofit-margin sense ("you need a margin to fund the mission"). This WP's funding doc uses "no margin" in a different sense (no organizer profit) and must explicitly reconcile the two senses.
- `docs/01-VISION.md §"Non-Goals: Exploitative Monetization"` (lines ~524-633, NG-1..NG-7) — the seven monetization non-goals. The funding doc's `## Disallowed Models` section must align with these.
- `docs/ai/DECISIONS.md` (scan recent entries 9601, 9401, 9301, 9201, 9101) — to see the format and granularity of recent governance decisions; D-9701 must match that format.
- `docs/ai/work-packets/WORK_INDEX.md §"Phase 7 — Beta, Launch & Live Ops"` (line 1197 onward) — the section this WP joins; the §17 Vision Alignment gate applies to every Phase 7 WP per the header note.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17` — Vision Alignment gate; this WP touches monetization (NG-1..7, Financial Sustainability) and therefore MUST include a `## Vision Alignment` block.
- `.claude/rules/work-packets.md` — single packet per session, dependency discipline, no historical edits, status updated only on full DoD completion, conventions are locked.
- `.claude/rules/architecture.md "Authority Hierarchy"` — confirms VISION.md (#3) wins over WPs (#6) on conflict.
- `docs/TOURNAMENT-FUNDING.md` (current draft at session start) — the existing text this WP will reconcile against Vision and lock as governed content.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents required for every new or modified file. No diffs, no snippets, no "show only the changed section."
- ESM only, Node v22+ (N/A here — no code; constraint preserved for template completeness).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — applies to any markdown / governance file authored under this packet (no clever phrasing, no abbreviations, no inline jargon).

**Packet-specific:**
- Read-only against `packages/` and `apps/`. No engine, registry, server, app, or test files may be touched. Verified by `git diff --name-only packages/ apps/` returning empty after each commit in this packet.
- No modification to `docs/01-VISION.md`. The Vision is authority #3; WP-097 is authority #6 and may not edit it. If a conflict surfaces during execution, **STOP** and escalate.
- No modification to `docs/ai/ARCHITECTURE.md` or `.claude/rules/*.md`.
- The funding doc must **cite** Vision §Financial Sustainability explicitly, not paraphrase or restate it. Citation form: `see docs/01-VISION.md §Financial Sustainability for the platform-level revenue model`.
- The funding doc's `## Definitions` section must define "infrastructure" as **incremental tournament-specific costs**, not as a duplicate or alternative to the platform's always-on infrastructure.
- Every "MUST", "SHOULD", "MAY" use must be RFC 2119 and the doc must declare RFC 2119 in its preamble (already present in the drafted text — preserve verbatim).
- The slogan "No margin, no mission" MUST NOT appear in the funding doc. Vision §Financial Sustainability uses this exact phrase in the standard nonprofit-margin sense ("you need a margin to sustain the mission") and the funding doc uses "no margin" in the opposite sense ("no organizer profit"). Repeating the slogan in the funding doc would create a documented semantic collision between two governance-tier documents.
- D-9701 must cite both `docs/TOURNAMENT-FUNDING.md` and `docs/01-VISION.md §Financial Sustainability` and explicitly enumerate the scope-boundary (tournament-level vs platform-level).

**Session protocol:**
- If during execution any phrase, term, or scope boundary in the funding doc cannot be reconciled with Vision §Financial Sustainability or NG-1..7, **STOP** and ask the human before proceeding. Never silently paraphrase or "smooth over" a conflict — log it explicitly.
- If the user objects to the scope-clarifying preamble or the "infrastructure" narrowing, the WP must be re-drafted; do not ship a doc whose scope is ambiguous.

**Locked contract values:**
- Funding doc canonical path: `docs/TOURNAMENT-FUNDING.md`
- Decision ID: `D-9701`
- Vision sections cited: `§Financial Sustainability`, `§Non-Goals: Exploitative Monetization` (NG-1..NG-7)
- Approved channels: `Open Collective` (primary), `PayPal donate link` (supplemental)
- Disallowed model count: 5 (organizer-profit entry fees; margin-funded prize pools; gameplay-conditioning sponsorships; advertorials / pay-to-win mechanisms; opaque custodial handling)

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. This WP touches
> the "Monetization, supporter tiers, cosmetics, or paid surfaces" trigger
> surface and the "Financial Sustainability" trigger; a Vision Alignment
> block is mandatory.

**Vision clauses touched:** §Financial Sustainability (platform-level revenue model), NG-1, NG-2, NG-3, NG-5, NG-6, NG-7

**Conflict assertion:** **No conflict.** The funding doc governs **tournament-level community funding** (organizer-side, no-margin, infrastructure-only). Vision §Financial Sustainability governs **platform-level revenue** (supporter subscriptions, cosmetics, community support tiers, organized-play licensing, Upper Deck / Marvel royalties). The two operate at different scopes:

- Vision's "Enterprise & Organized-Play Licensing" line item permits **the platform** to sell paid hosting tools or white-label access *to* tournament organizers. WP-097 governs what **those organizers** then do with their own community funding once they run a tournament. The platform may bill organizers; organizers may not bill players for profit.
- Vision's "modest operating buffer" applies to **the platform's** finances, not to tournament-level fundraising. WP-097's "no organizer margin" rule is not in conflict — it constrains a different actor at a different layer.
- The "no margin, no mission" slogan in Vision §Financial Sustainability is used in the **standard** nonprofit-margin sense (a sustainable platform requires revenue surplus). WP-097 explicitly avoids reusing the slogan to prevent semantic collision; the funding doc instead uses "no organizer margin" as its governing phrase. (See Non-Negotiable Constraints, "slogan" item.)

**Non-Goal proximity check:** Confirmed clear.

- **NG-1 (pay-to-win):** Funding doc forbids "advertorial or pay-to-win mechanisms" explicitly. No conflict.
- **NG-2 (gacha):** Tournament funding is donation / cost-recovery; no randomized purchasable outcomes are introduced. N/A.
- **NG-3 (content withheld):** Tournament funding does not gate any content; participants are not paywalled out of features. N/A.
- **NG-5 (ads / sponsorships):** Funding doc forbids "Sponsorships that condition gameplay, balance, or design decisions". No conflict.
- **NG-6 (dark patterns):** Funding doc requires "good-faith transparency" and a public ledger; no FOMO, no obfuscated pricing. No conflict.
- **NG-7 (apologetic monetization):** Funding doc is plainly stated, no "it's actually fair" framing required. No conflict.
- **NG-4 (energy systems / friction):** N/A — funding policy does not introduce any in-game mechanics.

**Determinism preservation:** **N/A.** This WP touches no engine, registry, scoring, replay, RNG, or simulation surface. Deterministic guarantees are unaffected.

---

## Authorized Future Surfaces (Policy)

**Definition — funding affordance.** A user-visible UI element (button,
link, label, menu item, footer entry, or attribution) whose sole purpose
is to expose approved tournament funding channels (Open Collective
primary; PayPal donate link supplemental). "Funding affordance" is the
canonical term used throughout this WP for any in-product surface that
exposes funding to users; "funding surface" appears only as part of the
historical proper-noun **§F Funding Surface Gate**, which evaluates
funding affordances as defined here. Other phrasings (e.g.,
"funding-related UI", "funding element") SHOULD NOT be introduced in
downstream WPs.

This section authorizes specific user-facing interface surfaces whose
sole purpose is to expose approved tournament funding channels (Open
Collective primary; PayPal donate link supplemental), subject to the
constraints below.

This section is **policy-only**. WP-097 implements none of the surfaces
described here. Each surface, when built, must ship as its own scoped UI
or platform WP that cites WP-097 and `D-9701` (see §E Governance
Boundary; D-9701 timing caveat noted there). The policy below exists so
those future WPs land against a fixed semantic contract rather than
re-litigating "is a Donate button monetization?" at execution time.

The section is also a **scope-fence**: any UI affordance not explicitly
authorized here is out of scope for tournament-funding exposure and
requires a new policy-authorizing entry (this WP amended, or a successor
WP) before implementation.

### A) Global Navigation Funding Affordance

The platform MAY expose a persistent, non-intrusive navigation element
(button, menu item, or footer link) — including in a top-right
navigation region — labeled with neutral language such as:

- `Support Tournaments`
- `Tournament Funding`
- `Donate`

The list is illustrative; equivalent neutral labels are permitted.

Constraints:

- The label MUST NOT imply purchase, entitlement, advantage, or reward.
  Forbidden lexicon: `Buy`, `Purchase`, `Order`, `Subscribe`, `Upgrade`,
  `Unlock`, `Get Access`.
- The element MUST link only to the Open Collective page and/or the
  PayPal donate page, as governed by `docs/TOURNAMENT-FUNDING.md`.
- If a chooser surface fronts both channels, Open Collective MUST be
  the default-selected or first-listed option per the
  `TOURNAMENT-FUNDING.md` primary-channel rule.
- No price tiers, no upsells, no urgency patterns (countdown timers,
  scarcity prompts, "limited time" framing).
- The affordance MUST NOT be modal, sticky overlay, exit-intent popup,
  or otherwise interruptive. A header button or footer link is the
  intended pattern; an attention-stealing surface is not.

### B) Registry Viewer Funding Affordance

The card registry viewer (`apps/registry-viewer/`,
`cards.barefootbetters.com`) MAY surface an identical funding
affordance, scoped as **contextual discovery only**.

Constraints:

- The registry remains fully accessible without contribution. No card
  data, images, filters, categories, or browse functionality may be
  gated behind funding status (preserves Vision §10a).
- The affordance MUST NOT be displayed per-card, per-expansion, or
  per-content-object. It is a single global surface within the viewer,
  not a per-row prompt.
- The affordance MUST NOT be modal, sticky overlay, exit-intent popup,
  or interruptive. Browsing the registry must never trigger a
  funding-related interruption.
- Constraints from §A Global Navigation apply (label discipline,
  channel-link discipline, primary-channel default).

### C) Account / Profile Attribution Surface

User profile or account pages, when they exist, MAY display
**informational attribution** indicating that a user has contributed to
tournament funding.

Permitted forms:

- Boolean markers (`Tournament Supporter`)
- Time-delimited statements (`Supported tournament infrastructure in 2026`)

Constraints:

- Attribution is **presentation-only**, not entitlement. It MUST NOT
  unlock features, affect matchmaking, visibility, ranking, replay
  exposure, or any system behavior.
- Attribution MUST NOT be framed as a subscription, membership tier,
  or entitlement (no "Member since...", "Tier:...", "Active until...").
- Attribution MUST NOT be displayed in comparison contexts — lobby
  lists, match lists, leaderboard rows, opponent panels, or any
  surface where users are sorted, compared, or shown side-by-side.
  Comparison-context display creates implicit social hierarchy that
  this surface is forbidden to introduce.
- Public attribution (visible to other users) requires explicit opt-in.
  Default scope is own-profile / private. The opt-in MUST be a clear,
  reversible UI control, not a buried preference.
- Contribution amounts MUST NOT be displayed publicly by default. If a
  contributor opts in to amount disclosure, it is a separate opt-in
  from the attribution opt-in itself.

### D) Forbidden Semantics (Applies to All Authorized Surfaces)

The following are explicitly disallowed everywhere a funding affordance
or attribution surface is rendered under this policy:

- `Buy`, `Purchase`, `Order`, or equivalent transactional language
- Subscription framing — monthly plans, renewal prompts, auto-renew UX,
  "you'll be charged" language, lapsed-subscription nags
- Perks, benefits, boosts, advantages, or features tied to funding
  status (cross-references NG-1, NG-3)
- Visual hierarchy that elevates funded users over non-funded users in
  any shared surface (cross-references NG-3, NG-6)
- Pay-to-play or pay-to-access signaling (cross-references NG-1)
- FOMO patterns — countdown timers, "limited spots", scarcity prompts,
  artificial urgency (cross-references NG-6)
- Apologetic framing — copy that needs to explain why funding is
  "actually fair" (cross-references NG-7)

Funding exposure under this policy is **discovery-only**, never
conversion-driven.

### E) Governance Boundary

Any future UI or platform WP that implements a funding-related
affordance authorized under this section MUST:

- Cite **WP-097** and **D-9701** in its `## Authority` or
  `## Assumes` block
- Stand alone as its own scoped WP — not bundled into unrelated UI
  work
- Pass §17 Vision Alignment with NG-1, NG-3, NG-5, NG-6, NG-7 listed
  and a no-conflict assertion
- List the §A / §B / §C surface it implements explicitly, so the
  policy-to-implementation mapping is auditable

**D-9701 timing caveat.** D-9701 lands at WP-097 execution time per
this WP's Definition of Done. Future UI WPs that cite D-9701 are
**blocked** until WP-097 has executed and D-9701 exists in
`docs/ai/DECISIONS.md`. A draft UI WP MAY reference WP-097 + D-9701 in
its `## Assumes` block as a hard prerequisite, but cannot pass §17
Vision Alignment until the citation target is real.

WP-097 itself implements none of these surfaces. A grep for
`Donate`, `Support Tournaments`, `Tournament Supporter`, or related
strings against `apps/` and `packages/` MUST return zero matches at
WP-097 execution.

### F) Funding Surface Gate (Pre-Merge Checklist for Downstream WPs)

Future UI or platform WPs that implement any of the surfaces authorized
in §A, §B, or §C MUST satisfy every item below before the
implementation lands. Failures are hard governance stops. Escalation is
via a Vision amendment or a new `D-NNNN` carve-out — never via
"we'll fix it post-merge" or silent exceptions.

**§F is a verification gate only.** All normative constraints are
defined in §A through §D above. G-1 through G-7 MUST NOT introduce new
policy; they only reference existing constraints for auditability. If
a future amendment changes a constraint, it amends §A–§D — the gate
items are re-derived from the new policy, never edited in isolation.
This rule exists so the gate cannot drift away from the policy it
verifies.

This gate consolidates and references the constraints already locked
in §A through §D. It introduces no new policy; it formalizes the
pre-merge verification procedure as a checkable artifact future WPs can
cite and audit against.

**Applicability is declared, never inferred.** Every UI or platform
WP MUST contain an explicit applicability line: either *"This WP
touches §A / §B / §C and runs the gate below."* or *"This WP does not
touch any §A / §B / §C surface — gate is N/A: <one-line
justification>."* The N/A path requires the justification line; a
bare "N/A" is a §17 lint FAIL. The forcing function exists because
funding-affordance drift is most likely to enter the codebase via WPs
whose authors did not consider funding to be in scope. This clause is
listed before the gate items deliberately: a WP author must classify
applicability before encountering G-1 through G-7.

**Gate items — all MUST PASS before merge.**

- [ ] **G-1 Label discipline.** No `Buy`, `Purchase`, `Order`,
  `Subscribe`, `Upgrade`, `Unlock`, `Get Access`, `Premium`,
  `Paid tier`, or transactional equivalent appears in any UI label,
  tooltip, ARIA attribute, URL, route name, component name, or
  user-visible variable name. Per §A "forbidden lexicon" + §D
  bullet 1.
- [ ] **G-2 No subscription framing.** No monthly / annual plans,
  auto-renew copy, "active / inactive" funding states, "you'll be
  charged" language, "cancel anytime" or "you are subscribed"
  indicators, or renewal countdowns. Per §D bullet 2.
- [ ] **G-3 No entitlement.** Funding status grants no gameplay
  advantage, no feature access, no priority matchmaking, no enhanced
  visibility, no exclusive content, and no cosmetic distinction that
  implies status hierarchy. Core gameplay, registry access, and
  tournament participation are byte-identical for funded and
  non-funded users. Per §D bullets 3-5; cross-references NG-1, NG-3.
- [ ] **G-4 No registry gating or contextual pressure.** The registry
  viewer is fully usable without contribution. No per-card,
  per-expansion, or per-content funding prompt. The funding
  affordance MUST NOT visually associate specific cards, sets, or
  themes with donations (no "this card brought to you by..."
  framing, no donor attribution rendered near content). Per §B.
- [ ] **G-5 No dark patterns.** No emotional manipulation
  ("Keep the game alive!"), no artificial urgency, no repeated modals
  after dismissal, no disabled close buttons, no FOMO framing, no
  obfuscated wording or fine-print reversals. Per §D bullets 6-7;
  cross-references NG-6, NG-7.
- [ ] **G-6 Platform / tournament scope clarity.** All funding copy
  refers to **tournament infrastructure support**, never to
  "supporting the platform" or "supporting the game." If
  platform-level funding is mentioned at all on the same surface, it
  MUST defer explicitly to `docs/01-VISION.md §Financial
  Sustainability` rather than blur into the tournament channel. Per
  the §Authorized Future Surfaces intro and the funding-doc
  Scope-distinction.
- [ ] **G-7 Attribution informational only.** If profile attribution
  is implemented per §C, it is presentation-only, opt-in for public
  visibility, never displayed in comparison contexts (lobby /
  leaderboard / opponent rows), and never carries amount disclosure
  by default. Removal or absence carries no stigma; presence carries
  no rank. Per §C.

**Audit discipline.** A WP that implements any §A / §B / §C surface
MUST map each implemented surface to its G-1 through G-7 disposition,
either inside its `## Vision Alignment` block or as a dedicated
`## Funding Surface Gate` subsection. Silent omission is a §17 lint
FAIL by analogy with the Vision Alignment trigger; the lint gate
should reject a WP that touches funding surfaces but contains no G-N
mapping.

**Copy deferral.** Any user-visible funding copy (button labels,
tooltips, ARIA text, headings, paragraph copy on donation pages,
modal text, and equivalent surfaces) SHOULD match or defer verbatim
to `docs/TOURNAMENT-FUNDING.md §Public Blurb (Reusable)`. Paraphrasing
the canonical blurb requires a `D-NNNN` carve-out in
`docs/ai/DECISIONS.md` documenting (a) why the canonical wording is
inadequate for the surface, (b) the exact paraphrase used, and (c) a
sunset condition under which the surface returns to the canonical
wording. The blurb's "SHOULD NOT paraphrase" clause and this gate
clause are mutually reinforcing: the funding doc forbids paraphrasing
on principle; this gate makes the forbid auditable in WP review.

This restriction applies to user-visible **explanatory** copy. Purely
mechanical micro-copy — ARIA labels, accessibility hints,
screen-reader announcements, and equivalent assistive-tech strings
that describe interaction rather than introduce new framing or
meaning — is exempt and may follow accessibility-best-practice
phrasing (e.g., `Open tournament funding page in new tab`). The
exemption covers form, not substance: micro-copy MUST still satisfy
G-1 (no transactional lexicon) and G-2 (no subscription framing).

**No silent exceptions.** Any deviation from G-1 through G-7 requires
a successor WP that either (a) amends Vision §Financial Sustainability
or §Non-Goals via a new `D-NNNN` entry, or (b) records the deviation
as a deliberate carve-out in `docs/ai/DECISIONS.md` with explicit
rationale, scope limits, and a sunset condition. Implementing a
funding surface that doesn't satisfy this gate is a direct violation
of `D-9701` and the platform's Non-Goals (NG-1, NG-3, NG-6, NG-7), and
is grounds for revert.

---

## Scope (In)

### A) `docs/TOURNAMENT-FUNDING.md` — modified

The 2026-04-25 baseline (post-cost-baseline-revision committed
2026-04-26) is the input. Modifications still required at execution:

- **Add a `## Scope` section** (between `## Authority` and `## Definitions`) that explicitly states:
  - This document governs **tournament-level community funding only**.
  - The **platform's own revenue model** (supporter subscriptions, cosmetics, organized-play licensing, IP royalties) is governed by `docs/01-VISION.md §Financial Sustainability` and is out of scope here.
  - The two coexist: the platform may sell organized-play licensing *to* tournament organizers per Vision; organizers may not extract profit from tournament participants per this document.
  - A tournament's "infrastructure costs" are **incremental costs incurred specifically for that tournament** (e.g., bandwidth surge, prize-administration tooling, dedicated hosting). The platform's always-on infrastructure (general hosting, storage, R2, etc.) is funded through the Vision's revenue model and is not a tournament-funding line item.
- **Tighten the `## Definitions` section** to align: rewrite the "Infrastructure" definition to specify "incremental tournament-specific" scope per the bullet above.
- **Add a citation line** at the foot of the `## Authority` section: `For platform-level revenue (supporter subscriptions, cosmetics, organized-play licensing, IP royalties), see docs/01-VISION.md §Financial Sustainability — that document is authoritative for the platform; this document is authoritative for tournament-level community funding.`
- **Add `D-9701` citation** at the foot of the `## Governance and Amendments` section: `Anchored in docs/ai/DECISIONS.md §D-9701.`
- The `## Cost Baseline (Public Disclosure)` section (added pre-execution
  during 2026-04-26 drafting iteration with the user) is preserved
  in its post-2026-04-26 form. Its four subsections (Cost Model;
  Typical Monthly Baseline; Variability; Cost Drivers and Non-Drivers)
  and the Non-Drivers carve-out citing Vision NG-1 and NG-3 are
  load-bearing for the AC-1 byte-identity check below — modifying any
  of them at execution time would require amending this WP first.
- The `## Public Blurb (Reusable)` section (added pre-execution during
  2026-04-26 drafting iteration) is preserved in its post-2026-04-26
  form. The blurb paragraph itself is the canonical wording for
  external surfaces (tournament pages, donation links, badges) and is
  governed under `D-9701`; the framing language around it
  ("intended for verbatim reuse" and the "SHOULD NOT paraphrase"
  rule) is also locked. Modifying the blurb wording at execution
  time would require amending this WP first.
- All other content (Funding Principles, Approved Channels, Disallowed Models, Reconciliation, Cost Baseline, Sunset / Dissolution, Summary, Public Blurb) is preserved byte-for-byte from the 2026-04-26 baseline.
- The slogan "No margin, no mission" must not appear anywhere in the doc (already absent from the 2026-04-26 baseline — verify with grep at execution).

### B) `docs/ai/DECISIONS.md` — modified

Add a new `## D-9701` entry immediately before the `## Final Note` block at the foot of the file. The entry must include:

- **Title:** `D-9701 — Tournament Funding Policy: Community-Funded, Infrastructure-Only, No Organizer Margin`
- **Decision body** stating the four pillars: (1) tournament-level scope distinction from platform-level Vision §Financial Sustainability; (2) infrastructure-only spending with payment-processor fees and direct-expense reimbursement carve-outs; (3) Open Collective primary + PayPal supplemental channel approval; (4) sunset / dissolution rule (pro-rata refund where practical, otherwise donation to an aligned non-profit, never to organizers).
- **Locked anchor list:** `docs/TOURNAMENT-FUNDING.md` (the contract); `docs/01-VISION.md §Financial Sustainability` (the platform-level peer authority); NG-1, NG-2, NG-3, NG-5, NG-6, NG-7 (Non-Goals preserved).
- **Slogan-collision note:** explicit acknowledgement that Vision §Financial Sustainability uses "No margin, no mission" in the standard nonprofit-margin sense and that WP-097's funding doc uses "no organizer margin" as its governing phrase to avoid semantic collision.
- **Rationale:** four bullets covering scope-distinction; nonprofit-by-design at the organizer layer; transparency requirements; sunset behavior.
- **Status:** `Active`. Amendments require a new `D-NNNN` entry and a citation in the amended section of the funding doc.
- **Citation:** `WP-097`; `docs/TOURNAMENT-FUNDING.md`; `docs/01-VISION.md §Financial Sustainability`.

### C) `docs/ai/STATUS.md` — modified

Add a `### WP-097 / EC-097 Executed — Tournament Funding Policy (YYYY-MM-DD, EC-097)` block at the top of `## Current State`, mirroring the format used by WP-096 / WP-092 / WP-091 STATUS blocks. Required content:

- One-paragraph summary of what is now governed (tournament-level community funding, scope-distinction from Vision, D-9701 anchor).
- Scope statement: docs-only; `git diff --name-only packages/ apps/` returns empty.
- Vision alignment: §Financial Sustainability (peer authority, no conflict), NG-1..7 preserved.
- 01.5 NOT INVOKED — N/A; engine untouched.

### D) `docs/ai/work-packets/WORK_INDEX.md` — modified

- Add `WP-097` row under Phase 7 (immediately after the WP-096 row at line ~1817) with the Phase 7 conventions: Notes section, Dependencies (None), Vision clauses touched, link to `WP-097-tournament-funding-policy.md`, link to `EC-097-tournament-funding-policy.checklist.md`, and `D-9701`.
- Flip `[ ]` to `[x]` on completion with today's date and the SPEC commit hash.
- EC reference: EC-097 is the authoritative execution checklist for this WP. The WORK_INDEX row links to it; the EC_INDEX row is flipped from `Draft` to `Done {YYYY-MM-DD}` in the same SPEC commit.

---

## Out of Scope

- **No modification to `docs/01-VISION.md`.** The Vision is authority #3; this WP is authority #6 and cannot edit it. If a Vision update is needed (e.g., to cross-reference WP-097 from §Financial Sustainability), that is a separate future packet.
- **No modification to `docs/ai/ARCHITECTURE.md` or `.claude/rules/*.md`.** This WP introduces no new layer rule, no new architectural constraint, and no new authority.
- **No platform-level revenue model changes.** Supporter subscriptions, cosmetics, licensing, royalties remain governed by Vision §Financial Sustainability. WP-097 does not amend, supplement, or override that scope.
- **No tournament rules, brackets, scoring, or operational procedures.** This WP defines the **funding contract** only. How tournaments are run (rules, bracket format, prize structure if any, schedule) is out of scope for a future operational-WP.
- **No automation, infrastructure, or banking integration.** No Open Collective API code, no PayPal IPN handler, no reconciliation script. Those are infrastructure WPs if and when needed.
- **No legal or tax treatment specifications.** "Are donations tax-deductible?" "Is this a registered non-profit?" — out of scope. The funding doc defines the **policy** the project commits to; legal structuring is a separate concern.
- **No engine, registry, server, or app code touched.** No `.ts`, `.vue`, `.mjs`, `.sql`, `.json` modifications. Doc-only.
- **No changes to historical WPs or DECISIONS entries.** D-9701 is additive; no existing decision is amended or superseded.
- **EC-097 is the authoritative execution checklist** for this WP. It was drafted alongside the WP and lives at `docs/ai/execution-checklists/EC-097-tournament-funding-policy.checklist.md`. Earlier WP-097 draft language proposed following the WP-079 no-EC precedent; that approach was superseded once EC-097 was authored. Doc-only execution still applies.
- Refactors, cleanups, or "while I'm here" improvements are **out of scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `docs/TOURNAMENT-FUNDING.md` — **modified** — add `## Scope` section; tighten `## Definitions` "Infrastructure" entry; add Vision citation in `## Authority`; add D-9701 citation in `## Governance and Amendments`; preserve all other content byte-for-byte from the 2026-04-25 baseline.
- `docs/ai/DECISIONS.md` — **modified** — add `## D-9701` entry immediately before `## Final Note`.
- `docs/ai/STATUS.md` — **modified** — add `### WP-097 / EC-097 Executed` block at top of `## Current State`.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — add `WP-097` row under Phase 7; flip `[ ]` → `[x]` on completion.
- `docs/ai/work-packets/WP-097-tournament-funding-policy.md` — **new** — this file (created at draft time, before execution).
- `docs/ai/execution-checklists/EC-097-tournament-funding-policy.checklist.md` — **new** — execution checklist (created at draft time, before execution; follows the EC-085 / EC-TEMPLATE governance-EC pattern).
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — at execution time, EC-097 row flipped `Draft` → `Done {YYYY-MM-DD}`.

No other files may be modified. Verified by `git diff --name-only` after each commit.

---

## Acceptance Criteria

### AC-1 — Funding doc reconciliation

- [ ] `docs/TOURNAMENT-FUNDING.md` contains a `## Scope` section explicitly distinguishing tournament-level community funding from platform-level Vision §Financial Sustainability.
- [ ] `docs/TOURNAMENT-FUNDING.md` `## Definitions` "Infrastructure" entry specifies "incremental tournament-specific" scope.
- [ ] `docs/TOURNAMENT-FUNDING.md` `## Authority` cites `docs/01-VISION.md §Financial Sustainability` as the platform-level peer authority.
- [ ] `docs/TOURNAMENT-FUNDING.md` `## Governance and Amendments` cites `D-9701` as the anchor.
- [ ] The slogan "No margin, no mission" does not appear anywhere in the funding doc (verified with `grep -i "no margin" docs/TOURNAMENT-FUNDING.md` returning zero matches).
- [ ] The Funding Principles, Approved Channels, Disallowed Models, Reconciliation, Cost Baseline (Public Disclosure), Sunset / Dissolution, Summary, and Public Blurb (Reusable) sections are byte-identical to the 2026-04-26 baseline (verified by checksum or character-level diff against an archived copy of the baseline).
- [ ] `docs/TOURNAMENT-FUNDING.md` Cost Baseline section contains the explicit Non-Drivers list citing Vision NG-1 and NG-3 (verified with `grep -nE "NG-1|NG-3" docs/TOURNAMENT-FUNDING.md` returning at least two matches).
- [ ] `docs/TOURNAMENT-FUNDING.md` `## Public Blurb (Reusable)` section exists, contains the canonical paragraph governed under D-9701, and contains the "SHOULD NOT paraphrase" rule (verified with `grep -nE "Public Blurb|SHOULD NOT paraphrase" docs/TOURNAMENT-FUNDING.md` returning at least two matches).

### AC-2 — DECISIONS anchor

- [ ] `docs/ai/DECISIONS.md` contains a `## D-9701` entry immediately before `## Final Note`.
- [ ] D-9701 cites `docs/TOURNAMENT-FUNDING.md` and `docs/01-VISION.md §Financial Sustainability` explicitly.
- [ ] D-9701 enumerates the four pillars (scope-distinction; infrastructure-only with carve-outs; channel approval; sunset rule).
- [ ] D-9701 explicitly notes the slogan-sense divergence between the funding doc and Vision §Financial Sustainability.
- [ ] D-9701 status is `Active` and the amendment rule is stated (new D-entry + funding-doc citation required).

### AC-3 — STATUS and WORK_INDEX governance close

- [ ] `docs/ai/STATUS.md` has a new `### WP-097` block at the top of `## Current State` matching the format of WP-096 / WP-092.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has a `[x] WP-097` row under Phase 7 with today's date, the SPEC commit hash, dependencies (None), Vision clauses touched, and a link to `WP-097-tournament-funding-policy.md` + `D-9701`.

### AC-4 — Scope enforcement (no engine touch)

- [ ] `git diff --name-only packages/ apps/` returns empty.
- [ ] `git diff --name-only docs/01-VISION.md docs/ai/ARCHITECTURE.md` returns empty (Vision and Architecture untouched).
- [ ] `git diff --name-only .claude/` returns empty (rules untouched).
- [ ] No new files outside `## Files Expected to Change`.

### AC-5 — Vision Alignment self-compliance

- [ ] WP-097 contains a `## Vision Alignment` block citing §Financial Sustainability, NG-1, NG-2, NG-3, NG-5, NG-6, NG-7 with an explicit no-conflict assertion and an N/A determinism line.
- [ ] D-9701's "slogan-collision note" matches WP-097's Non-Negotiable Constraints "slogan" item byte-for-byte (no paraphrasing).

### AC-6 — Lint gate

- [ ] WP-097 passes `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` self-review (see §Lint Self-Review at the foot of this WP). Sections N/A: §11 (auth), §12 (tests), §16 (code style — markdown only; rule §16.5 "comments explain WHY" is preserved in spirit by the WP's prose-level rationale; no executable code).

### AC-7 — Authorized Future Surfaces (Policy Authorization Present)

Verifies that the policy contract for §A–§E is intact. (Gate-mechanics
verification is split out into AC-8.)

- [ ] WP-097 contains an `## Authorized Future Surfaces (Policy)` section listing the three authorized surface classes: §A Global Navigation Funding Affordance, §B Registry Viewer Funding Affordance, §C Account / Profile Attribution Surface.
- [ ] The `## Authorized Future Surfaces (Policy)` section opens with a `**Definition — funding affordance.**` paragraph that names "funding affordance" as the canonical term and clarifies that "funding surface" is reserved for the §F Funding Surface Gate proper noun (verified with `grep -nE "Definition . funding affordance" docs/ai/work-packets/WP-097-tournament-funding-policy.md` returning exactly one match).
- [ ] §D Forbidden Semantics is present and lists at minimum: transactional language (Buy / Purchase / Order); subscription framing; perks tied to funding; visual hierarchy elevating funded users; pay-to-play signaling; FOMO patterns; apologetic framing.
- [ ] §D Forbidden Semantics cross-references at least NG-1, NG-3, NG-6, NG-7 explicitly (verified with `grep -nE "NG-1|NG-3|NG-6|NG-7" docs/ai/work-packets/WP-097-tournament-funding-policy.md` returning at least four matches inside the §D block).
- [ ] §E Governance Boundary names WP-097 + D-9701 as the required citation for any future UI WP implementing one of the surfaces.
- [ ] §E states the D-9701 timing caveat (future UI WPs are blocked from passing §17 Vision Alignment until WP-097 executes and D-9701 exists).
- [ ] §C Profile Attribution explicitly forbids comparison-context display (lobby lists, leaderboard rows, opponent panels) and requires opt-in for any public attribution.
- [ ] §A and §B name `Open Collective` as the primary-channel default in any chooser surface.
- [ ] No UI code, SFC, TypeScript, or stylesheet is created or modified by WP-097 — verified by AC-4 scope guards.
- [ ] At WP-097 execution time, `grep -nE "Donate|Support Tournaments|Tournament Supporter" apps/ packages/` returns zero matches (the WP authorizes future surfaces; it does not introduce any token of them in code).

### AC-8 — Funding Surface Gate (Verification Layer Present)

Verifies that §F is intact and structured as a verification layer over
§A–§D, not as an independent policy source.

- [ ] §F Funding Surface Gate (Pre-Merge Checklist for Downstream WPs) is present, contains exactly seven gate items labelled G-1 through G-7, and includes the **Audit discipline**, **Applicability is declared**, **Copy deferral**, and **No silent exceptions** sub-blocks (verified with `grep -nE "G-[1-7]|Audit discipline|Applicability is declared|Copy deferral|No silent exceptions" docs/ai/work-packets/WP-097-tournament-funding-policy.md` returning at least eleven matches).
- [ ] §F opens with a `**§F is a verification gate only.**` framing paragraph stating that G-1..G-7 introduce no new policy and only reference §A–§D (verified with `grep -nE "verification gate only" docs/ai/work-packets/WP-097-tournament-funding-policy.md` returning exactly one match).
- [ ] §F G-N items each end with a "Per §A/§B/§C/§D bullet N" or "cross-references NG-N" citation rather than re-deriving constraints — verifies the gate consolidates without duplicating policy.
- [ ] §F's "Audit discipline" clause names `## Funding Surface Gate` and `## Vision Alignment` as the two acceptable host subsections in downstream WPs.
- [ ] §F's "Applicability is declared, never inferred" clause appears **before** the gate items (G-1..G-7) so that WP authors classify applicability before encountering the checklist (verified by line-order check: the line matching `Applicability is declared` precedes the line matching `^- \[ \] \*\*G-1`).
- [ ] §F's "Copy deferral" clause is present, names `docs/TOURNAMENT-FUNDING.md §Public Blurb (Reusable)` as the canonical wording source, requires a `D-NNNN` carve-out for paraphrasing, and includes the micro-copy exemption clause for ARIA / accessibility hints (verified with `grep -nE "Copy deferral|Public Blurb|micro-copy" docs/ai/work-packets/WP-097-tournament-funding-policy.md` returning at least four matches across the WP).
- [ ] §F's micro-copy exemption explicitly notes that the exemption "covers form, not substance" — micro-copy still satisfies G-1 (no transactional lexicon) and G-2 (no subscription framing).
- [ ] §F's "No silent exceptions" clause names `D-9701` as the violated authority and lists at minimum NG-1, NG-3, NG-6, NG-7 as the implicated Non-Goals.

---

## Verification Steps

```bash
# Step 1 — confirm funding doc exists at the canonical path
test -f docs/TOURNAMENT-FUNDING.md
# Expected: exit 0

# Step 2 — confirm the four required additions to the funding doc
grep -n "^## Scope" docs/TOURNAMENT-FUNDING.md
# Expected: at least one match

grep -nE "incremental tournament-specific" docs/TOURNAMENT-FUNDING.md
# Expected: at least one match (the tightened Infrastructure definition)

grep -nE "docs/01-VISION\.md.*Financial Sustainability" docs/TOURNAMENT-FUNDING.md
# Expected: at least one match (the Authority citation)

grep -nE "D-9701" docs/TOURNAMENT-FUNDING.md
# Expected: at least one match (the Governance citation)

# Step 3 — confirm the slogan is absent
grep -in "no margin" docs/TOURNAMENT-FUNDING.md
# Expected: no output (zero matches)

# Step 4 — confirm D-9701 exists in DECISIONS.md
grep -n "^## D-9701" docs/ai/DECISIONS.md
# Expected: exactly one match, immediately before "## Final Note"

# Step 5 — confirm D-9701 cites both anchors
grep -A 50 "^## D-9701" docs/ai/DECISIONS.md | grep -E "TOURNAMENT-FUNDING|01-VISION"
# Expected: at least two matches (one per anchor)

# Step 6 — confirm STATUS block landed
grep -n "WP-097" docs/ai/STATUS.md | head -3
# Expected: at least one match in the Current State section

# Step 7 — confirm WORK_INDEX row landed
grep -nE "\[x\] WP-097" docs/ai/work-packets/WORK_INDEX.md
# Expected: exactly one match, under Phase 7

# Step 8 — confirm scope (no engine, no app, no Vision, no architecture, no rules)
git diff --name-only packages/ apps/ docs/01-VISION.md docs/ai/ARCHITECTURE.md .claude/
# Expected: no output

# Step 9 — confirm only the five expected files changed
git diff --name-only
# Expected: exactly the five files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification
> Steps` before checking any item below. Reading the doc is not sufficient
> — run the commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `docs/TOURNAMENT-FUNDING.md` contains the four required additions (Scope section, Infrastructure narrowing, Vision citation, D-9701 citation)
- [ ] The slogan "No margin, no mission" is absent from the funding doc (`grep -in "no margin"` returns zero)
- [ ] `docs/ai/DECISIONS.md` has a `## D-9701` entry immediately before `## Final Note`, citing both anchors and noting the slogan-sense divergence
- [ ] `docs/ai/STATUS.md` has a `### WP-097` block at the top of `## Current State`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has a `[x] WP-097` row under Phase 7 with today's date and the SPEC commit hash
- [ ] No engine, registry, server, app, Vision, Architecture, or rules files modified (verified with `git diff --name-only` against the four scope guards)
- [ ] No files outside `## Files Expected to Change` were modified (verified with `git diff --name-only`)

---

## Lint Self-Review (00.3 §1–§19)

> Performed at draft time; re-confirm before execution.

| § | Item | Status |
|---|---|---|
| §1 | All required WP sections present | PASS |
| §1 | `## Out of Scope` non-empty (≥2 items) | PASS (10+ items listed) |
| §2 | Non-Negotiable Constraints with engine-wide + packet-specific + session protocol + locked values | PASS |
| §2 | Constraints reference `00.6-code-style.md` | PASS (Engine-wide bullet 3) |
| §2 | Full file contents required, no diffs/snippets | PASS |
| §3 | `## Assumes` lists prior state and dependency files | PASS |
| §4 | `## Context (Read First)` is specific (no "read the docs") | PASS |
| §4 | Architectural sections cited where relevant | PASS (ARCHITECTURE.md authority hierarchy + .claude/rules/architecture.md) |
| §4 | DECISIONS.md scan instruction included | PASS (Context bullet 4) |
| §5 | Every file is `new` or `modified` with one-line description | PASS |
| §5 | No ambiguous "update this section" language | PASS |
| §6 | Naming consistency (no abbreviations, canonical paths) | PASS |
| §7 | No new npm dependencies | PASS (doc-only) |
| §8 | Layer boundaries respected (no engine import; no Vision edit) | PASS |
| §9 | Windows compatibility (verification commands use `bash`/`grep` cross-platform; no Linux-only constructs) | PASS |
| §10 | Env vars: N/A — no code | N/A |
| §11 | Auth: N/A — not auth-touching | N/A |
| §12 | Tests: N/A — doc-only WP, no test deliverables | N/A |
| §13 | Verification commands are exact with expected output | PASS |
| §14 | Acceptance criteria are 6–12 binary observable items grouped by sub-task | PASS (8 AC groups, ~28 items total — exceeds 12 only because of the AC-1 byte-identity sub-checks and the §F gate sub-checks split across AC-7 and AC-8; each is binary) |
| §15 | DoD includes STATUS.md + DECISIONS.md + WORK_INDEX.md + scope-boundary check | PASS |
| §16 | Code style: N/A — markdown deliverables; rule §16.5 (comments explain WHY) preserved in WP rationale prose | N/A (markdown) |
| §17 | Vision Alignment block present with cited clauses + no-conflict assertion + determinism line | PASS |
| §18 | Prose-vs-grep discipline: forbidden tokens not enumerated verbatim near literal-string greps | PASS (no engine-grep step in this WP; the only grep targets are governance-doc tokens like `D-9701` and `Financial Sustainability`, which are intentional documentation references — `D-9701` itself acts as the governing decision citation, satisfying §18 if a future iteration adds engine-token greps) |
| §19 | Bridge-vs-HEAD staleness: N/A — this WP is not a repo-state-summarizing artifact | N/A |

**Final Gate verdict:** PASS at draft time. Re-confirm before execution by re-running the §1–§19 walkthrough against the funding doc's then-current state.
