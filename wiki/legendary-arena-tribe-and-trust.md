---
title: Legendary Arena — Tribe and Trust
type: Guide
tags:
  - governance
  - trust
  - safety
  - threat-model
  - zero-trust
  - least-privilege
  - kyc
  - training
  - attack-trees
  - community-fit
  - retention
  - monetization
  - survey
  - designer-reference
  - research
related:
  - trust-controls-playbook.md
  - vision.md
  - profile-login.md
  - monetization-model.md
  - newsletter-authoring.md
  - leaderboard.md
  - homepage-spec.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\legendary-arena-tribe-and-trust.md (this page — https://ewiki.legendary-arena.com/legendary-arena-tribe-and-trust/)
  - ../docs/01-VISION.md
last-reviewed: 2026-07-23
---

# Legendary Arena — Tribe and Trust

> **Working draft — not a shipped system.** This page records a
> product/growth strategy and a *first-pass threat model against it*. The
> "security" content is intended principles plus a review of where those
> principles are still underspecified — it is **not** a description of
> implemented controls. Nothing here is a governance decision; design and
> policy locks live in [DECISIONS.md](../docs/ai/DECISIONS.md) and
> [VISION](../docs/01-VISION.md), which this page defers to. Treat the
> Threat Model and Edge Cases sections as a checklist of gaps to close
> before any of this is built, not as a claim that they are handled.

## Summary

Legendary Arena's growth thesis is that **the filtering is the product**:
players stay for a table of people who feel like their tribe and for the
confidence that predators and toxic actors have been kept out. This page
captures that strategy — the layered trust model, the tribe-fit filters,
and the player survey that feeds it — and then subjects it to a structured
threat model. The strategy's core insight (front-load verification and
quarantine; use behaviour only as a safety net) is sound in principle; its
real weaknesses are **underspecification and missing operational detail**,
which the Threat Model and Edge Cases sections enumerate so the product
owners can close them before launch.

## Trust Model Contract

The strategy rests on four load-bearing claims. Everything else on the page
either implements or pressure-tests these.

1. **The filtering is the product.** People do not stay for the cards; they
   stay for the people who feel like them. The games come free with the
   vetting. This is the subscription pitch: *"we do the vetting so you
   don't have to."*

2. **Verify the signals worth faking.** A scammer only counterfeits
   something valuable — nobody forges a worthless currency. So *the group
   predators try to infiltrate is proof of which tribe is worth
   protecting*, and the effort they spend faking their way in
   reverse-engineers what a good member looks like. We screen on **verified**
   signals (photo, location, payment region, phone) rather than
   self-reported profiles anyone can fake.

3. **Defence is front-loaded, in layers.** Waiting for a wolf to hunt
   before you act is counting carcasses, not shepherding. The sequence is
   **gate → quarantine → community flag → behavioural backstop**, in that
   order — not the reverse.

4. **Behaviour is the net, not the gate.** The subtle actor who games
   clean signals still cannot fake conduct across dozens of games. Over
   time, pool the toxic with the toxic and let the good tables stay good.

> **This contract is aspirational until the Threat Model open items close.**
> Claims 2 and 3 both depend on a concrete verification stack and concrete
> quarantine exit criteria that do not yet exist. Until those are defined
> and hardened, "expensive to fake" and "clean record" cannot be evaluated.

## Mechanics

### The layered trust model (the shepherd's fence)

The behavioural loop alone is *not* a front gate. Defence is four layers,
in order:

| # | Layer | What it does | Where it runs |
|---|---|---|---|
| 1 | **Verify hard at the door** | Verified photo, verified location, payment region, phone. Expensive to fake *because we actually check* — turns away most opportunists on its own. | Signup / onboarding, before any table access |
| 2 | **Quarantine newcomers** | New accounts play among themselves or in lower-stakes tables until they've built a clean record. The unproven never reach the prized tribe on day one. | A separate population; the behavioural loop runs here *before* anyone vulnerable is exposed |
| 3 | **Reputation & fast flagging** | Ratings, reports, one-tap flags. The community catches what the door missed. | Live, across all tables |
| 4 | **Behavioural backstop** | Detects the subtle actor who games clean signals — rage-quitting, bullying newer players, collusion — across many games. | Continuous, over the account's history |

> Sequence matters: **gate and quarantine first, behaviour as the safety
> net** — not the other way around.

### The vetting process (proposed)

This is a **proposed starting point** for how L1 (gate) and L2 (quarantine)
would actually operate — a first attempt at the "verification stack is
undefined" open item, not an implemented flow. The governing rule:
**questions surface inconsistencies; independent verification and
observation catch what questions miss.** Self-reported answers are weak on
their own, so the process weights independently verifiable evidence far
above self-description, and asks the questions *in combination with*
technical and documentary checks rather than as a pure questionnaire.

**What to probe, and why.** Four areas, each pairing a question with the
check that corroborates it:

| Probe area | Representative questions | Corroborating check | Actor it targets |
|---|---|---|---|
| **Identity & basic legitimacy** | Confirm the name, age bracket, and location you're using. Is the contact method (phone, email, payment region) consistent with that identity and location? | Cross-check location against payment region, connection data, and device; liveness/document link on photo | Opportunist, Infiltrator |
| **History & consistency** | Have you held accounts here or on similar platforms under other identities? Been suspended, banned, or restricted — and for what? | Device / browser fingerprint and signup-anomaly checks; external corroboration where verifiable | Ban evader / multi-accounter |
| **Intent & fit** | Your primary reason for joining? How do you interact in group or competitive settings? What conduct do you consider unacceptable in shared spaces? | Treat as provisional; validate through observed behaviour in quarantine | Griefer, Infiltrator |
| **Risk indicators** | Are you willing to complete additional verification (photo liveness, payment-method confirmation, a waiting period)? Do you accept the community rules and the consequences for breaking them? | Willingness itself is a signal; refusal of low-cost verification is a red flag | Opportunist, Colluding group |

**Signals threat actors commonly fake — treat as untrusted until
independently verified.** The principle is the strategy's own contract
claim #2: *the more valuable a signal is for matching or trust, the more
incentive there is to fake it.* So the highest-value signals get the
heaviest verification, never the benefit of the doubt.

| Faked signal | Why it's targeted | Defensive implication |
|---|---|---|
| **Name / personal identity** | Easy to invent or borrow | Require corroboration beyond self-report |
| **Age / age bracket** | Misrepresented for access or matching | Verify where feasible; never rely on the claim alone |
| **Location / timezone / region** | Strong matching signal, so worth faking (T1) | Cross-check payment, network, and device data |
| **Profile photo** | Stolen, AI-generated, or stale (T2) | Prefer liveness or document-linked verification |
| **Contact details (phone, email)** | Disposable / VoIP options exist (T1) | Prefer methods harder to obtain anonymously |
| **Prior experience / reputation** | "Clean history" is cheap to claim (T3, T4) | Seek external corroboration or behavioural evidence over time |
| **Intent / playstyle / temperament** | Easy to give the "right" answers | Provisional only; validate through observed behaviour |
| **References / social proof** | Fabricated or coordinated (T9) | Verify independently; a self-supplied reference proves nothing |

> **Layering is what makes vetting work.** Hard checks at the door catch the
> forgeable signals; time- and behaviour-based observation in quarantine
> catches what the door missed; continuous monitoring catches the actor who
> adapts. No single stage is sufficient — which is why the four-layer fence
> above exists rather than a one-time questionnaire. The concrete
> thresholds (what verification is mandatory, how long quarantine runs,
> what counts as corroboration) remain open items in the Threat Model.

### Tribe-fit filters (what we actually sort on)

**Core principle — birds of a feather, *verified*.** We still sort people
into tables with others who share language, age-band, playstyle, region,
schedule, and temperament, because that is what makes the experience
enjoyable. We simply refuse to trust the *self-reported* version of any
high-value signal: it receives independent corroboration, or it stays
provisional until behaviour confirms it. Risk-tiered friction — exactly the
Enhanced Due Diligence banks apply — kicks in when signals are weak,
conflicting, or come from higher-risk sources. The binding agent is the
shared way of life; we target that directly. Race remains, at most, a minor
correlative signal, never load-bearing.

| Signal | Why it predicts a good match | Assurance & verification posture | Bank / gov parallel | Risk-tiered handling |
|---|---|---|---|---|
| **Language** | Can't enjoy a game you can't communicate in | High — low fake incentive; light technical check | CIP-style consistency check | Standard |
| **Age bracket** | Different pace, humour, stakes, maturity | Medium — easy to misrepresent | KYC age/DOB verification where feasible; self-report provisional | Enhanced scrutiny / longer quarantine if the claim conflicts with other signals or device data |
| **Playstyle** (competitive ↔ casual) | The single strongest bond | Low until observed — revealed through play, not a dropdown | Ongoing behavioural CDD | Provisional matching only inside quarantine; final placement after observed conduct |
| **Location / timezone** | People want their own region/community — strong signal | High value → high fake incentive | Multi-signal corroboration (payment region + connection + phone), as banks cross-check address | Conflicting or high-risk geo → Enhanced Due Diligence (longer quarantine / extra review) |
| **Schedule** | Overlapping windows = games that actually happen | Low (self-reported) | Profile-consistency monitoring | Low stakes; convenience matching only |
| **Temperament** (win/loss handling) | Toxicity around a loss poisons a table | Low until observed | Behavioural backstop / continuous monitoring | Surfaces only after repeated sessions; never used for early promotion |

**Operational rules that protect the filters:**

1. **Never grant full tribe placement on self-report alone.** Early matching
   uses only the high-assurance signals (language + verified location/age
   band). Playstyle, schedule, and temperament stay provisional until the
   behavioural layer confirms them.
2. **Risk-tier the filter application (bank-style EDD).** Standard path:
   clean multi-signal verification → normal quarantine. Elevated path: weak,
   conflicting, or high-risk geo/network signals → longer quarantine,
   restricted matching pool, or mandatory extra review before trusted-table
   access. Enhanced Due Diligence, not a flat ban.
3. **Sanctions / high-risk-jurisdiction posture (OFAC pattern, applied
   proportionally).** A high-risk or restricted geo signal doesn't
   auto-block; it auto-raises the risk tier (extra friction + extended
   observation). Any hard geo-restriction stays a separate legal/compliance
   decision; this page only defines the risk-tier response.
4. **Birds-of-a-feather matching stays inside the trust tiers.** Unverified /
   early quarantine: matched only with other unproven accounts, on the
   high-assurance signals. Post-quarantine trusted tables: matched on the
   full confirmed set (including observed playstyle and temperament). The
   flock stays intact for verified members; the unproven stay away from
   them.
5. **Continuous re-verification of the filters.** A sudden change in apparent
   location, device, or play pattern after promotion triggers a risk
   re-evaluation (as banks re-monitor after onboarding). The behavioural
   backstop isn't only hunting toxicity — it's confirming the tribe-fit
   signals stay consistent.

> **Early-matching policy (closes the self-report gap).** Until playstyle and
> temperament have been observed for the defined minimum games, an account is
> matched only on language + verified age-band + verified location/timezone.
> This stops a sleeper from choosing the "right" self-reported playstyle to
> reach a desired tribe on day one — the exact early-matching gap the threat
> model flagged.

### The survey — cut through the sales lens

**Rule:** every question must feed a decision we'll make. If an answer
can't change what we build, price, or promote — cut it. That's why "why do
you play?" is out and "which missing feature would make you upgrade today?"
is in.

The survey feeds six growth buckets — **Acquisition, Activation, Retention,
Revenue, Referral, and Community fit / tribe**. Tribe is not a sixth parallel
bucket; it is the **load-bearing moat that powers the other five**. Evaluate
every feature, campaign, and survey answer by one test: *does this deliver or
protect good tables?* If it only lifts raw installs or games played,
deprioritize it. Lead with multiple choice to warm players up and give
language for the feeling, then follow with one open box to catch the gold
you'd never have guessed.

| Bucket | Refined definition | Leading indicators it feeds |
|---|---|---|
| **Acquisition** | Attract players who already value good tables and skill over grind or chaos | Source quality (organic vs paid), % completing verification intent, cost per *verified* signup |
| **Activation** | First session that feels like "this is my kind of table" | Time-to-first-good-match, % finishing a full game with a positive post-game signal, quarantine-vs-trusted drop-off |
| **Retention** | Return because the people and standards stay consistent | D7/D30 return of *promoted* accounts, games-per-active-week, % of sessions with previously-matched players (track intermittent users separately — the low-activity residual risk) |
| **Revenue** | Willingness to pay for reliable tribe access and reduced friction | Conversion after quarantine exit, churn reason (friction vs value), LTV of high-fit vs low-fit cohorts |
| **Referral** | Existing good tables pull in more of the same | Invite-acceptance rate, % of new verified users arriving via trusted invite, in-tribe viral coefficient |
| **Community fit / tribe (moat)** | Verified + *observed* match on language, age-band, location, playstyle, schedule, temperament | Match-quality score (post-game ratings + table return rate), % of promotions later flagged, early-matching compliance |

The twenty questions (tagged by bucket):

1. What made you look for an online way to play Legendary in the first place? *(Acquisition)*
2. What's the most frustrating part of your current setup — physical cards, another app, or playing solo? *(Activation / Revenue)*
3. Who do you usually play with, and how often can you actually get a game going? *(Retention / Tribe)*
4. What almost stopped you from signing up? *(Acquisition / Revenue)*
5. If Legendary Arena vanished tomorrow, what would you miss most? *(Retention — your true core value, in their words)*
6. When you first tried the site, what did you expect versus what actually happened? *(Activation)*
7. Was there a moment it just clicked and felt right? *(Activation)*
8. What words would you use to describe it to a friend who's never played? *(Referral — copy fuel)*
9. What nearly made you give up during your first game? *(Activation)*
10. Which single feature do you use the most? *(Retention / Revenue)*
11. Is there something you wish it did that it doesn't yet? *(Revenue — upgrade signal)*
12. How does it compare to playing with the physical cards on your table? *(Activation / Retention)*
13. What would make you comfortable recommending it to your gaming group? *(Referral)*
14. Have you ever paid for something similar, and what made it worth it? *(Revenue)*
15. What almost made you close the tab and never come back? *(Acquisition / Activation)*
16. How did you first hear about Legendary Arena? *(Acquisition)*
17. What kind of player are you — competitive, casual, or in between? *(Tribe)*
18. When do you usually reach for it — a quiet evening, a lunch break, with the kids? *(Retention / Tribe)*
19. If you could wave a wand and change one thing, what would it be? *(Revenue / Retention)*
20. What's the one reason you keep coming back? *(Retention — the keystone)*

**Refinements (keep ~15–18 total):** every question must map to a concrete
decision (feature, price, matching rule, copy, or channel); *separate the
tribe-signal questions from pure product feedback* so neither contaminates
the other; and add a short **post-quarantine / post-promotion pulse** rather
than only asking at onboarding. Sharpen the vague expectation items — replace
"expected vs actual" with *"After your first full game, how close was the
table to what you wanted? (scale + one word)."* Add explicit tribe and
revenue probes: *"What would make a table feel like 'your people' vs just
another game?"*, *"Would you invite your regular group into a
verified/trusted table — what would they need to see first?"*, and *"What
would make the monthly fee feel like an obvious yes rather than a maybe?"*
Cut any residual "why do you play?"-style item that changes no decision.

### Delivery: newsletter + feedback channel

Do **both** — they feed each other. The **newsletter** is where you talk
to players (most words on *their* problem, a little on the product; quote
their own words back). The **feedback channel** is where you listen — start
lightweight, a one-question reply prompt (*"Hit reply and tell me your
toughest Mastermind"*), before building anything heavier. See
[Newsletter Authoring](newsletter-authoring.md) and the
[Brevo Email Pipeline](brevo-email-pipeline.md) for the delivery
mechanics.

### The subscription pitch (proposed)

The pitch follows directly from contract claim #1 — *the filtering is the
product.* Membership **is** the vetting: you pay for the quality of the
matchmaking pool itself, not for content or advantage. Board Game Arena's
Premium unlocks table *control*; Raya's exclusivity makes curation *the*
value — Legendary Arena can combine both by charging for the assurance of the
pool. The canonical short line: *"The games come free with the people. We
filter so every table feels like your tribe."* Variants worth testing:

- **Benefit-led** — "Stop rolling the dice on who sits down. Play with people
  who match your pace, standards, and schedule — because we already checked."
- **Subscription framing** — "Membership is the vetting: unlimited trusted
  tables, priority matching, and the confidence that predators and low-effort
  actors stayed outside."
- **Retention** — "You stay because the table still feels right next month.
  That's what you're paying for."
- **Contrast (vs free/open platforms)** — "Other sites give you volume. We
  give you the table you'd actually want to play at again."

**Positioning guardrails** (from [VISION](../docs/01-VISION.md) and Residual
risk): never *pay for advantage* — no better cards or standing (a VISION
bright line); pair the pitch with the **progressive unlock** the fence
already implies — free/low-stakes entry → verified quarantine → trusted
subscription tables; and own the conversion tension honestly rather than
overclaiming zero toxicity — friction that turns away good players is a
business risk, not a pure security win. See
[Monetization Model](monetization-model.md) for the fairness-safe
revenue-stream boundary this pitch sits inside.

## Threat Model

A threat model asks four questions: **what are we protecting, who attacks
it, how might they succeed, and what will we do about it.** This is a
defensive first pass over the strategy above — it surfaces risk early so
controls can be designed before incidents, and it is explicitly *not* an
attack guide. It should be revisited after any major design change and on a
regular cadence; treat it as a living document.

Structured this way, a threat model turns the vague question *"is this
secure enough?"* into a concrete, reviewable set of statements about what
could fail and what we're doing about it. Without one, security decisions
tend to be reactive, incomplete, or based on gut feel; with one, risks
become visible, prioritizable, and discussable across engineering, product,
and leadership. That discipline matters most for a layered-trust system
like this one — verification + quarantine + behavioural + community
flagging — because it forces the team to define the concrete mechanisms
still listed as open items. Its six core elements are exactly the
subsections below: **assets** (what we protect), **threats** (how they're
compromised), **attack surface / entry points** (where an adversary
interacts), **trust boundaries** (where trust level changes),
**mitigations** (controls that reduce risk), and **residual risk** (what
remains, and whether it's acceptable).

### Threat actors

Threats do not float free — each has an actor behind it with a motivation,
a level of sophistication, and a level of patience. Naming the actor
categories keeps the model honest: a control that stops the casual
opportunist may do nothing against the patient infiltrator, and vice versa.
Each category maps to the STRIDE threats (T1–T10) in the *Threats* table
below.

| Actor category | Motivation | Sophistication / patience | Primary threats | Layer expected to stop them |
|---|---|---|---|---|
| **Opportunist** | Casual mischief or easy gain; moves on if it's hard | Low / low | T1, T2 at low effort | Gate (L1) — the strategy's claim that verification "turns away most opportunists on its own" is *this* actor |
| **Infiltrator / sleeper** | Reach trusted, higher-stakes tables to prey on vulnerable members | High / high | T3, T9 | Quarantine (L2) exit criteria + behavioural backstop (L4) |
| **Ban evader / multi-accounter** | Re-enter after removal; rebuild reputation from scratch | Med / med | T4 | Gate (L1) fingerprinting + anti-multi-accounting (*net-new*) |
| **Griefer / harasser** | Dominate, bully, or drive off other players — especially newcomers | Low–med / low | T5, T10 | Community flag (L3) + behavioural backstop (L4) |
| **Colluding group** | Coordinate multiple accounts — false-flag rings, quarantine farming, in-table collusion | Med–high / med | T5, T7, T9 | Community-flag calibration (L3) + backstop (L4) |
| **Data thief / external attacker** | The verification PII itself, not the game | High / med | T8 + LINDDUN privacy lens | Cross-cutting PII protection (*net-new*) |
| **Malicious insider** | Privileged access (moderator/admin) misused to leak PII or manipulate reputation/reports | High / n/a | T6, T8 | Access control, audit trails, least privilege (*net-new*) |

> **The actor list is a coverage check.** Every mitigation below should
> answer *which of these actors it stops* — and where a row's "layer
> expected to stop them" is marked *net-new*, no control exists yet. Three
> of the seven actors (multi-accounter, data thief, insider) fall almost
> entirely into that gap.

### Scope and assets

**In scope:** the signup / verification flow, the quarantine tier, the
matching engine's tribe-fit inputs, the reporting system, and the
behavioural scoring pipeline.

**Assets, in priority order:**

1. **The trust of the flock** — the core asset and the thing customers pay
   for. If verified members stop believing the vetting works, the product
   is gone regardless of technical state.
2. **Verified identity signals** — verified photo, location, payment
   region, phone. Both a *control* (they gate access) and a *liability*
   (they are sensitive PII you now store and must protect).
3. **Reputation / behavioural scores** — the data that drives promotion out
   of quarantine and pooling of toxic actors.
4. **Vulnerable members** — newer or younger players the quarantine tier is
   meant to shield until an account is proven.
5. **Revenue** — subscription income, which depends directly on asset 1.

**Out of scope for this first model:** payment-processor internals, game
engine determinism, and infrastructure hardening — each deserves its own
model.

### Trust boundaries

- **Unverified → Quarantined → Trusted.** The two promotions across this
  boundary are the highest-value targets: an attacker who crosses them
  cheaply defeats the whole fence.
- **Client ↔ Server.** Per [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md),
  the engine owns truth and clients submit intent, not outcomes — any
  trust signal the client *asserts* (self-reported location, claimed age)
  is untrusted until server-verified.
- **User ↔ User.** Matching, messaging, and flagging all put one player's
  input in front of another; this is where harassment and coordinated
  abuse live.

### Threats (STRIDE-mapped, written as concrete misuse cases)

Each threat is a concrete statement, not a category, and carries a
qualitative Likelihood × Impact given *current* (undefined) controls.

| # | STRIDE class | Concrete misuse case | Likelihood | Impact | Primary layer to defend |
|---|---|---|---|---|---|
| T1 | Spoofing | Attacker uses a VoIP / temporary phone number and a VPN or proxy to defeat the "verified location + phone" gate at signup. | High | High | Gate (L1) |
| T2 | Spoofing | Photo verification without liveness / ID-match is passed with a stolen, borrowed, or AI-generated face. | High | High | Gate (L1) |
| T3 | Elevation of Privilege | A "sleeper" farms a minimal, low-stakes clean record through vague quarantine exit criteria, then moves into trusted tables (the exact pattern the fence exists to stop). | Med | High | Quarantine (L2) |
| T4 | Tampering | Multi-accounting / device sharing / browser-fingerprint evasion lets a banned actor rebuild reputation from scratch. | High | High | Gate (L1) + Backstop (L4) — *no control described* |
| T5 | Denial of Service | Coordinated false-flagging is used to silence a rival or grief newcomers; the report system itself becomes the weapon. | Med | Med | Community flag (L3) |
| T6 | Repudiation | Flags and reports carry no audit trail, so coordinated abuse can't be attributed and honest disputes can't be adjudicated. | Med | Med | Community flag (L3) |
| T7 | Information Disclosure | Quarantine tables are used for reconnaissance — a probe account learns detection thresholds by observing what does and doesn't get flagged. | Low | Med | Quarantine (L2) |
| T8 | Information Disclosure | The verification PII itself (phone, location, payment region, face photo) is breached or over-retained — a high-value target created *by* the control. | Low | High | Cross-cutting — *no control described* |
| T9 | Tampering / Collusion | Actors collude *inside the quarantine pool* to farm mutual clean records or coordinate before promotion. | Med | Med | Behavioural backstop (L4) |
| T10 | Elevation / Evasion | A sophisticated actor stays just under the behavioural threshold indefinitely, adapting as scoring changes. | Med | Med | Behavioural backstop (L4) |

### Attack trees (critical-path maps)

The table above says *what* can go wrong; attack trees say *how*, by
decomposing an attacker's goal into the paths they'd actually consider so
mitigations can be placed on the load-bearing branches. Notation: **AND** =
all children required; **OR** = any one child suffices; a leaf is a concrete
action. Each tree maps to the T-numbers above. Use them as a coverage
check — mark each branch *open* (no control) or *closed*, prioritize the
highest likelihood × impact paths (Trees 1 and 2), and add leaves as real
incidents appear.

**Tree 1 — Bypass gate & reach the trusted tribe** (Spoofing + Elevation; T1,
T2, T3) — the primary business risk:

```
Reach Trusted Tribe Tables
├── OR — Defeat L1 Gate (Spoofing)
│   ├── AND — Fake location + phone (T1)
│   │   ├── Obtain disposable / VoIP number
│   │   ├── Route traffic through proxy/VPN matching the claimed region
│   │   └── Payment method matching the claimed region (or none required)
│   └── OR — Defeat photo verification (T2)
│       ├── Stolen real photo
│       ├── AI-generated face that passes a basic check
│       └── Borrowed / coached live person (if liveness is weak)
└── AND — Defeat L2 Quarantine (Elevation)
    ├── Meet minimal "clean record" criteria (if volume-only)
    ├── Stay under behavioural thresholds while in quarantine
    └── Avoid community flags long enough to be promoted
```
Cuts: multi-signal location corroboration breaks the first AND; liveness +
ID-match breaks the photo OR; time + games + clean-conduct exit criteria
raise the cost of the second AND.

**Tree 2 — Multi-account / ban evasion** (Tampering + Spoofing; T4):

```
Rebuild / Maintain Presence After Ban
├── OR — New account creation (fresh device, new phone+payment, new identity)
├── OR — Account sharing / takeover (compromised or handed-over credentials)
└── AND — Avoid detection after re-entry
    ├── Behaviour that doesn't immediately match prior banned patterns
    └── No shared device / payment / network fingerprint with the banned account
```
Cuts: persistent device/browser/payment fingerprinting + signup-anomaly
detection; cross-account linkage on shared signals; account-recovery
protection.

**Tree 3 — Premature / fraudulent promotion** (Elevation + Tampering; T3,
T9):

```
Enter Trusted Tables Early
├── OR — Solo farming (min games, low-stakes, wait out any time gate)
└── OR — Collusive farming (T9)
    ├── Coordinate multiple accounts inside quarantine
    ├── Mutual positive ratings / flag avoidance
    └── Share which behaviours are scored
```
Cuts: exit criteria requiring volume *and* time *and* clean conduct;
intra-quarantine collusion detection (shared devices, co-play patterns,
rating rings); delayed full tribe-fit matching.

**Tree 4 — Weaponise the reporting system** (DoS + Tampering + Repudiation;
T5, T6):

```
Abuse Reporting / Flagging
├── OR — Single-actor harassment (repeated flags, timed for disruption)
└── OR — Coordinated ring
    ├── Many accounts flag one target in a short window
    └── Fabricated / exaggerated reasons
        └── AND — No durable audit trail (Repudiation) → flags unattributable
```
Cuts: rate limits + reporter-reputation weighting; immutable flag audit
trail; human review for high-impact actions; burst-coordination detection.

**Tree 5 — Persist just under the behavioural threshold** (Evasion; T10):

```
Stay in Trusted Tables While Causing Harm
├── Adapt behaviour to stay below detection thresholds
├── Rotate targets so no single victim generates repeated reports
├── Low-and-slow toxicity spread over many games
└── Adjust when scoring rules appear to change
```
Cuts: multi-signal scoring (not one brittle threshold); community flagging
as an independent sensor; periodic human sampling of borderline accounts;
toxic-with-toxic pooling once a sustained pattern appears.

**Tree 6 — Compromise the verification PII** (Information Disclosure; T8 +
LINDDUN):

```
Obtain / Misuse Verification Data
├── OR — External breach (DB compromise; insecure storage/transmission)
└── OR — Insider / privileged misuse
    ├── Moderator/admin with broad access
    └── Insufficient logging / segregation of duties
```
Cuts: encryption at rest and in transit; minimal retention; least-privilege
access to verification data; audit logging of every PII access; segregation
of duties so no single operator can both verify and freely export.

### Privacy threats (LINDDUN lens)

The verification signals are personal data, so a privacy pass matters as
much as the security one:

- **Linkability / Identifiability** — payment region, phone, and face photo
  together are strongly identifying; correlating them across accounts or
  leaking the correlation is a privacy harm in its own right.
- **Minors** — age-bracket filtering means the system knowingly processes
  data about children; that carries handling and consent obligations
  (COPPA/GDPR-K class) the strategy has not addressed.
- **Non-compliance** — collecting biometric-adjacent (face) and location
  data invokes data-protection regimes; storage, retention, and
  data-subject-access handling need explicit design.

### Mitigations, mapped to the four layers

| Layer | Prevent | Detect | Respond |
|---|---|---|---|
| **L1 Gate** | Liveness + ID-match on photo (T2); corroborate location across payment region + connection data + phone rather than any single signal (T1); block known VoIP ranges. | Signup-velocity and device/fingerprint anomaly scoring (T1, T4). | Fail closed to quarantine, not to trusted, on weak-signal signups. |
| **L2 Quarantine** | Concrete, non-trivial exit criteria — minimum game count *and* elapsed time *and* clean-conduct thresholds (T3). | Watch for reconnaissance patterns and intra-pool collusion (T7, T9). | Extend or reset quarantine on flagged conduct; never auto-promote on volume alone. |
| **L3 Community flag** | Rate-limit reports; weight by reporter reputation; require a reason (T5). | Detect coordinated flagging bursts against a single target (T5); keep an immutable flag audit trail (T6). | Human review for high-impact actions; reversible sanctions with appeal. |
| **L4 Behavioural backstop** | Define the actual signals, scoring, and false-positive/negative handling (currently unspecified). | Score conduct across many games; watch for threshold-hugging adaptation (T10). | Pool toxic-with-toxic; escalate on sustained pattern, not a single game. |

**Controls with no home in the current strategy (net-new required):**

- **Account security** — MFA, account-recovery and takeover protection.
  The entire model is social/behavioural; a hijacked *trusted* account
  bypasses every layer.
- **Multi-accounting defence** — device / browser fingerprinting and
  signup anomaly detection (T4) — the model's biggest structural gap, since
  cheap re-entry defeats every downstream layer.
- **PII protection** — encryption, minimal retention, and access control on
  the verification signals themselves (T8), plus a data-protection /
  compliance review for the minor-data and biometric-adjacent handling.

### Operational controls (segregation of duties & least privilege)

The mitigations above defend against *players*. These defend against the
**operators** — the moderators, admins, and automated jobs that run the
fence — and they are where the *malicious insider* actor (T6, T8) is
answered. They are cheap to state, need no exotic infrastructure, and raise
the cost and visibility of abuse from any single account.

The organizing principle is the accountant's **segregation of duties**: the
same reason one person handles accounts payable and a *different* person
handles accounts receivable — no one both approves a payment and reconciles
the bank. On a trust platform, no single role should be able to move a user
from outsider to fully trusted without an independent check at each stage.

- **Split the high-risk process across roles.** Identity/photo/location
  verification, promotion out of quarantine, review of reports and flags,
  and final suspension/reinstatement should be separate permissions with
  separate owners. No single moderator account both verifies a newcomer and
  promotes them into trusted tables.
- **Dual control on high-impact actions.** Quarantine promotions, permanent
  bans, and bulk trust changes need a second independent review, or an
  automated threshold *plus* human confirmation — the platform equivalent of
  "one person doesn't both cut the cheque and reconcile the account."
- **Keep the report queue independent of the reported user.** Flags feed a
  separate review queue the subject cannot influence; rate-limit and weight
  flags so no single actor or small ring can weaponize them (T5).
- **Log and reconcile privileged actions.** Every verification decision,
  quarantine exit, and moderation action is logged with actor and timestamp
  (T6); a *different* person periodically reviews a sample — reconciling the
  books.
- **Least privilege everywhere.** Players get only what they need to play;
  a moderator gets only their queue's permissions; avoid broad "super-admin"
  accounts that can touch every control at once. This directly bounds the
  blast radius of a compromised or malicious privileged account.

### Zero Trust as the organizing posture

The whole model is an instance of **Zero Trust** — *never trust, always
verify* — applied to accounts rather than network packets. It assumes no
account, session, or privilege escalation is trustworthy by default, inside
the "flock" or out, and keeps re-proving trust rather than granting it once
at the door. Its principles map onto the fence already described:

| Zero Trust principle | How it already appears here |
|---|---|
| **Never trust, always verify** | Hard verification at the gate; self-reported signals treated as untrusted until corroborated |
| **Least privilege** | Quarantine tier = minimum reach until a clean record is earned; operator least-privilege above |
| **Assume breach** | Segregation of duties + audit logs bound the blast radius of a compromised trusted or admin account |
| **Continuous verification** | Behavioural backstop + community flagging re-evaluate conduct across many games, not once at login |
| **Micro-segmentation** | Unverified → quarantined → trusted tiers isolate the unproven from vulnerable members |

Zero Trust is a posture, not a product — the point is that every new
account, every session, and every promotion is treated as untrusted until
proven, and the proof is continuous. It is worth stating explicitly because
it is the "why" behind the layered fence: the layers are not four disconnected
features, they are one continuously-verifying trust boundary.

### Regulated-finance parallels (KYC, sanctions screening, monitoring)

Banks fight the same problem — untrusted parties trying to move through a
trust boundary — under strict rules (Bank Secrecy Act, USA PATRIOT Act,
FinCEN, OFAC). Their playbook is the same shape as the fence above, and the
mature parts are worth borrowing. A game is **not** a bank, so the lesson is
the *pattern*, applied proportionally — not the full regulatory apparatus.

**What banks layer:**

- **KYC / Customer Identification Program** — verify legal identity at
  account opening (name, DOB, address, government ID). The gate's
  hard-verification step is the LA equivalent.
- **Customer Due Diligence / Enhanced Due Diligence** — understand the
  relationship; apply *extra* scrutiny to higher-risk customers. The LA
  parallel is longer quarantine or additional review for accounts that trip
  risk signals — friction matched to risk, not applied flat.
- **Ongoing transaction monitoring** — watch for patterns inconsistent with
  the customer's profile *after* onboarding. The LA parallel is the
  behavioural backstop watching post-quarantine conduct (T10).
- **Sanctions / watchlist screening (OFAC)** — screen customers and activity
  against restricted lists. The LA parallel is enhanced scrutiny or
  temporary restriction on high-risk geo / network signals (T1).
- **Fraud tooling** — device fingerprinting, IP/geolocation, behavioural
  analytics, anomaly detection. The LA parallel is the still-*net-new*
  multi-accounting and signup-anomaly defences (T4).
- **Segregation of duties + dual control, SAR-style escalation, MFA** —
  already covered under *Operational controls* above.

**On geography and non-residents.** US banks do not blanket-ban
non-residents; they apply *higher friction and more verification* (physical
address, extra documents, in-person steps), and some online-only
institutions restrict further. Separately, **OFAC** sanctions do
comprehensively restrict certain jurisdictions (e.g. Cuba, Iran, North
Korea, Syria, and specific Russia/Ukraine-related regions) plus targeted
individual/entity lists — for stated national-security, foreign-policy,
counter-terrorism, and illicit-finance reasons. The transferable idea for
LA is **risk-tiered geography, not a wall**: treat a high-risk or
sanctioned-region signal as a reason for *enhanced scrutiny* (T1, T7), while
weighing that against the business cost of turning away legitimate
international players — the same conversion-vs-friction tension in Residual
risk below. Any hard geo-restriction is a legal/compliance decision for the
business, not a control this page defines.

| Bank / government practice | Simple LA parallel | Purpose |
|---|---|---|
| Strong KYC identity verification at onboarding | Hard verification of photo, location/payment region, phone before full access | Stop low-effort fakes at the door |
| Sanctions / high-risk-jurisdiction screening | Enhanced scrutiny or temporary restriction on high-risk geo/network signals | Reduce exposure to known higher-risk sources |
| Ongoing transaction monitoring | Watch for anomalies after quarantine (play-pattern, reporting-volume shifts) | Catch what initial checks missed |
| Enhanced due diligence for higher risk | Longer quarantine / extra review for accounts that trip risk signals | Match friction to risk level |
| Segregation of duties / dual control | Separate who verifies identity from who promotes or handles serious flags | Prevent single-point abuse of privilege |
| Logging + independent review (SAR discipline) | Record verification and moderation decisions; sample them | Accountability; detect internal issues |
| Layered / least-privilege access | New accounts stay restricted until a clean record is earned | Limit damage if a bad actor gets through |

The common thread — with the accounting and Zero Trust models above — is
one rule: **never grant full trust or full power on a single check or from a
single person.** Verify hard, tier by risk, monitor continuously, keep
independent eyes on high-impact decisions.

### Residual risk (state it, don't hide it)

Perfect security is impossible; the model's job is to make what remains
visible and intentional.

- **Low-activity users never generate enough behavioural signal** for the
  L4 net to engage — the backstop is a function of volume and time, so
  intermittent accounts sit permanently under-observed.
- **Over-strict filtering is itself a business risk.** A gate that turns
  away real players, or a quarantine that frustrates genuine members, churns
  the exact customers the product needs. The filtering *is* the product —
  but a false-positive at the door is lost payroll, not just a security
  metric. Verification friction must be tuned against conversion, not
  maximised blindly. This is the tension the model must hold, not resolve
  in one direction.
- **Sophisticated, patient adversaries** (T3, T9, T10) will get through any
  automated layer; the community and human-review layers are the backstop
  of last resort, and they carry their own abuse surface (T5, T6).
- **Tribe-fit risk is now narrowed, not eliminated.** With the
  birds-of-a-feather-*verified* rules, a sufficiently patient actor can still
  mimic observed playstyle and temperament across many games — that residual
  risk is *accepted*, owned by the behavioural backstop + community flagging.
  What is no longer accepted is granting tribe placement on easily-faked
  self-reports or on unverified high-value signals; the early-matching policy
  closes that day-one path.

### Extending this model

To go from this first pass to a maintained model: keep threats written as
concrete misuse cases (as above); re-score Likelihood × Impact as controls
land; track each residual-risk item with an owner; and revisit after design
changes, after incidents, and on a cadence. STRIDE covers the technical
surface here; LINDDUN covers the privacy surface; attack trees are worth
drawing for the two highest-value paths (gate bypass and premature
promotion). The practical next artifacts are a concrete verification-stack
spec, measurable quarantine exit criteria, a reporting-system abuse policy,
and a behavioural-scoring design with explicit false-positive/negative
handling — the same four areas the strategy already lists as open.

## Control Implementation Playbook (proposed)

The concrete techniques that would build each layer's controls — the vetting
techniques mature platforms use (liveness photo verification, multi-signal
identity binding, progressive trust, reporter-reputation weighting, age
assurance), the external-account-linking reliability ranking (corroboration
only; BoardGameGeek and Steam lead), bot detection, and risk-triggered
CAPTCHA — live in a dedicated companion page:
**[Trust Controls Playbook](trust-controls-playbook.md)**.

It maps every technique onto this page's four layers and threat numbers
(T1–T10), carries the recommended implementation order, and states the PII
posture that answers the T8 gap (store the verification result and a likeness
hash, never the raw biometric). It is kept separate so the strategy and threat
model here stay readable; the playbook is the "how we'd build the controls"
surface — still proposed, defining nothing.

## Staff & Moderator Training (proposed)

Controls only work if the people running them apply them under pressure — a
threat actor's easiest path is often a helpful operator who makes "just this
once" exceptions. This is a **proposed** training outline that turns the
abstract principles above (hard verification, segregation of duties,
continuous monitoring, least privilege) into behaviours staff can rehearse.
It is scenario-heavy on purpose: people retain a practised refusal far
better than a slide. Each module below carries a goal, a memorable rule, and
the specific drills that make it stick.

**Module 1 — Identity & verification discipline.** Stops trust being granted
on easy-to-fake signals. Core idea: *a real photo and a real location are
valuable, which is exactly why people fake them — a self-reported claim is
never final, and if verification feels inconvenient, the inconvenience is
the control working.* Drills: judge three profiles (one genuine, two
fabricated) and mark which signals to accept vs independently verify;
role-play the "I already verified on another platform, just let me in"
request and rehearse the standard reply; quiz — which is the strongest
location evidence, typed city vs payment-region match vs phone country code,
and why. **Rule:** *verify hard at the door; behaviour is the safety net,
not the front gate.* Tribe-fit addition: staff must be able to say which of
the six tribe-fit signals may be trusted for *early* matching (language +
verified age-band + verified location) versus which must wait for
behavioural confirmation (playstyle, temperament). Drill: given a new account
with a perfect self-reported competitive playstyle but only a single weak
location signal, which matching pool is it allowed into today? (Answer:
early-quarantine, high-assurance signals only.)

**Module 2 — Segregation of duties in daily work.** Makes single-person
abuse or error hard. Teach the accounts-payable/receivable split adapted to
the platform: Person A runs initial identity checks, Person B reviews
quarantine-exit requests, Person C handles serious flags and suspensions;
any promotion or permanent ban needs a second reviewer to confirm. Drill: a
mock "clean record after 12 games — promote now?" ticket, where the correct
process is *check the defined criteria → a second person reviews the log →
then promote*, and the wrong process is one person doing both in one
session. **Rule:** *no single person moves someone from outsider to fully
trusted.*

**Module 3 — Recognising social engineering.** Trains staff to spot the
pressure tactics that try to bypass controls, each rehearsed as a role-play
with the exact control-preserving reply said out loud:

- **Urgency + authority** — "I'm a friend of the founder / from the payment
  processor, approve this fast, we're losing a big user."
- **Sympathy + exception** — "My other account got locked; just merge them
  and skip the waiting period."
- **Flattery + reciprocity** — "Best platform out there, I've told my whole
  group — give me trusted status so I can bring them in today."

The rehearsed answer is always a version of *"I can't make exceptions to the
verification steps; here's the standard process."*

**Module 4 — Ongoing monitoring & escalation.** Turns "set and forget" into
continuous awareness. Habit: spot-check a sample of recently promoted
accounts for sudden behaviour or reporting-volume shifts. Red flags to
memorise: a spike in friend requests or DMs right after leaving quarantine;
multiple accounts sharing one device or payment signal (T4); reports that
look coordinated (T5). Every escalation is concrete — *if you see X, do Y
within Z minutes and document it.* Drill: three short activity logs classed
*normal / watch / escalate now* with a one-sentence reason.

**Module 5 — Least-privilege mindset.** Makes staff comfortable saying *"I
don't have that permission — and that's intentional."* Practise declining an
out-of-scope request without apologising or offering a workaround: *"My role
only covers initial verification; promotion goes to the next queue,"* or
*"I can see the report but I can't clear it or suspend the account."*

**Delivery and measurement.** Keep modules short and scenario-heavy; close
each with the one rule the team repeats together; run a ~10-minute refresher
every 60–90 days on fresh anonymised examples from the platform. Track
whether it's working: attempted bypasses correctly refused, time-to-escalation
on real flags, and the share of promoted accounts later removed (which
should fall as Module 1 and 4 land).

## Interactions

- **[Trust Controls Playbook](trust-controls-playbook.md)** — the
  implementation companion. This page owns the strategy, the four-layer fence,
  and the threat model (T1–T10, attack Trees); the playbook owns the concrete
  techniques that would build each layer's controls (liveness, multi-signal
  binding, external-account linking, bot detection, CAPTCHA) and maps them
  back onto these layers and threat numbers.
- **[Vision](vision.md)** — Community fit / tribe is a VISION-level
  secondary goal; this strategy operationalises it. The trust model must
  stay inside the VISION bright lines (no pay-to-win, identity/profile
  boundaries) — the subscription pitch here is *pay for vetting*, never
  *pay for advantage*.
- **[Profile & Login](profile-login.md)** — The identity and verification
  surface this strategy depends on. Any concrete verification stack (photo,
  phone, location) and the quarantine account-state live at this boundary,
  and the client ↔ server trust boundary is where self-reported vs verified
  signals are adjudicated.
- **[Monetization Model](monetization-model.md)** — The subscription pitch
  ("we do the vetting so you don't have to") is the revenue hook; the
  residual-risk note that over-strict filtering churns real players is a
  direct monetization concern.
- **[Newsletter Authoring](newsletter-authoring.md)** and the
  [Brevo Email Pipeline](brevo-email-pipeline.md) — The delivery and
  listening channels the survey feeds.
- **[Leaderboard](leaderboard.md)** — Reputation and behavioural-conduct
  scoring are adjacent to competitive scoring; both derive per-account
  records over many games and share the same "signal accrues with volume"
  property called out in residual risk.
- **[Homepage Spec](homepage-spec.md)** — The live site is pure skill/mastery
  ("Skill decides. Mastery is earned."). The tribe value layers on top
  without diluting it — "skill decides the game; good tables decide whether
  you come back" — but the vetting should be teased only as a *coming*
  differentiator, never claimed as a live control while these remain open
  items. Keep homepage copy and this page's Residual-risk honesty aligned.

## Edge Cases

These are the specification gaps a security or red-team review flags for
the product owners to close. They are design/strategy gaps, not an
invitation to attack — and each maps to a Threat Model item above.

- **The verification stack is only proposed, not specified.** *The vetting
  process (proposed)* above sketches the questions and corroborating checks,
  but the concrete thresholds — which checks are mandatory, what counts as
  corroboration, how liveness/ID-match is enforced — remain open. Until the
  mechanisms exist and are hardened, "expensive to fake" (T1, T2) cannot be
  evaluated.
- **Quarantine has no exit criteria.** "Clean record," duration, and stakes
  are all undefined. A quarantine whose exit is vague or cheaply satisfied
  loses its protective value (T3) and says nothing about residual risk
  after promotion.
- **The behavioural backstop's signals are unspecified.** No scoring, no
  false-positive/negative handling is described, and the model assumes the
  detector is accurate and resistant to gradual adaptation and in-pool
  collusion (T9, T10).
- **Community flagging is treated as a reliable sensor.** No calibration,
  rate limits, reporter-reputation weighting, or defence against
  false-reporting is described (T5, T6). Under-reporting, retaliation fear,
  and coordinated abuse are the known failure modes of any social defence.
- **No account-security or anti-multi-accounting controls exist.** The
  model is entirely social/behavioural; multi-accounting (T4), takeover
  (account security), signup anomaly detection, and PII handling (T8) are
  all absent — outside the draft's current scope, but required for any real
  deployment.
- **Circular / unvalidated assumptions.** "The group predators infiltrate
  is proof of which tribe is worth protecting" is a sharp observation, not
  a control; "verification turns away most opportunists on its own" is
  asserted without metrics. The same evidence discipline the strategy
  applies to the six growth buckets (validate against real numbers) is
  owed to the security claims.

## Open Questions

The strategy's own open items — closing them *is* the first round of threat
mitigation:

- **Validate the six growth buckets** against actual Legendary Arena
  numbers before betting on any one — which is the weakest link now?
- **Turn the proposed vetting process into a specified verification stack** —
  fix the thresholds behind *The vetting process (proposed)*: which checks
  on photo and location (payment region, phone, connection data) are
  mandatory, how liveness/ID-match is enforced, and what counts as
  multi-signal corroboration (mitigates T1, T2).
- **Define the quarantine tier mechanics** — what counts as a "clean
  record," how long, what stakes — as measurable exit criteria (mitigates
  T3).
- **Draft the subscription pitch** built explicitly around "membership is the
  vetting," tuned so verification friction doesn't churn genuine players — and
  run **pricing experiments that measure the conversion drop from added
  friction** directly (the residual-risk tension made a metric).
- **Add the missing security workstream:** account recovery/takeover
  protection, multi-accounting defence, reporting-abuse policy, and a
  PII/compliance review for the verification signals and minor data
  (mitigates T4, T5, T6, T8, and the privacy lens).
- **Instrument the four-layer fence before launch.** Each layer needs an
  owner and a dashboard metric: gate pass rate, quarantine exit rate *and*
  later-flag rate of promoted accounts, report quality, and behavioural
  promotion accuracy. The three residual risks (low-activity users,
  over-filtering churn, patient adversaries) need explicit owners, not just a
  mention.

## References

- [VISION](../docs/01-VISION.md) — community-fit / tribe as a secondary
  goal; the monetization bright lines the subscription pitch must respect.
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — the engine-owns-truth /
  clients-submit-intent boundary that makes self-reported trust signals
  untrusted until verified.
- STRIDE (Microsoft) and LINDDUN (privacy) — the two threat-classification
  frameworks used in the Threat Model section. Referenced as method, not
  vendored.
- Zero Trust Architecture (NIST SP 800-207) — the "never trust, always
  verify" posture the *Zero Trust* subsection maps onto the layered fence.
  Referenced as method.
- Segregation of duties / least privilege — the operational-control
  principles behind the *Operational controls* subsection (the accounting
  separation-of-duties analogy). Referenced as method.
- Regulated-finance practice (Bank Secrecy Act, USA PATRIOT Act, FinCEN,
  OFAC sanctions) — the KYC / due-diligence / monitoring / sanctions-screening
  playbook the *Regulated-finance parallels* subsection borrows the pattern
  from (applied proportionally; a game is not a bank). Referenced as method;
  any hard geo/compliance restriction is a business/legal decision, not a
  control this page defines.
- Attack trees (Schneier) — the AND/OR goal-decomposition method used in the
  *Attack trees* subsection to map T1–T10 to concrete attacker paths.
  Referenced as method.
- [Trust Controls Playbook](trust-controls-playbook.md) — the companion page
  carrying the implementation techniques (dating-app liveness, bot detection,
  risk-triggered CAPTCHA, and the external-account-linking reliability
  ranking) and their method citations. Split out of this page to keep the
  strategy and threat model readable.
- Board Game Arena Premium (unlocking table *control*) and Raya
  (referral/committee curation) — the two monetization/curation models the
  *subscription pitch* borrows. Referenced as method; naming a service is not
  an endorsement or a selection decision.
- This page is a **working draft**; it cites the frameworks and VISION but
  defines no controls of its own. Promote to `canonical` only once the
  verification stack, quarantine criteria, and behavioural-scoring design
  exist and are cited.
