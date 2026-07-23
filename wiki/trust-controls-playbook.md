---
title: Trust Controls Playbook
type: Guide
tags:
  - trust
  - safety
  - threat-model
  - kyc
  - bot-detection
  - captcha
  - verification
  - designer-reference
  - research
related:
  - legendary-arena-tribe-and-trust.md
  - profile-login.md
  - monetization-model.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\trust-controls-playbook.md (this page — https://ewiki.legendary-arena.com/trust-controls-playbook/)
  - ../docs/01-VISION.md
last-reviewed: 2026-07-23
---

# Trust Controls Playbook

> **Companion to [Legendary Arena — Tribe and Trust](legendary-arena-tribe-and-trust.md).**
> That page owns the strategy, the four-layer trust fence, and the threat
> model; this page is the *implementation* surface — the concrete techniques
> that would build each layer's controls. It is a **proposed** playbook (what
> the controls would look like), not an implemented system, and it defines
> nothing. The threat numbers (T1–T10), attack **Trees**, and the four layers
> (L1 Gate → L2 Quarantine → L3 Community flag → L4 Behavioural backstop)
> referenced throughout are defined in that page's
> [Threat Model](legendary-arena-tribe-and-trust.md#threat-model); this page
> maps techniques onto them.

## Summary

Dating apps and large social platforms solve the same core problem Legendary
Arena is solving — untrusted strangers must be filtered before they reach a
valued community — and have converged on a mature toolkit after years of real
abuse. This page collects those techniques (platform vetting, external-account
linking, bot detection, and CAPTCHA) and maps each onto the four-layer fence
and threat numbers from the [Tribe and Trust](legendary-arena-tribe-and-trust.md)
page, without changing the "birds of a feather" product goal. Everything here
is proposed; the thresholds and vendor choices remain open items.

## Mechanics

### Vetting techniques from mature platforms

- **Liveness photo verification** (Tinder/Bumble/Hinge pattern) — a
  real-time selfie/video matched to the profile, with a liveness gesture
  (blink, head-turn) so a static stolen photo fails; optional government-ID
  match for higher assurance. For LA: make liveness + face-match mandatory
  at the L1 gate, and store only the *result* plus a minimal hash — not the
  raw biometric long-term (hardens the faked-photo signal T2 while limiting
  T8 exposure).
- **Phone + multi-signal identity binding** — cross-check the phone against
  device, IP/geolocation, and payment; score or block disposable/VoIP
  numbers. For LA: this is the multi-signal location corroboration proposed
  in the threat model (Tree 1's first AND); conflicting signals force longer
  quarantine.
- **Optional external-account linking** (Instagram/Spotify/Facebook pattern)
  — a long-lived, active external account raises confidence a person is
  real. For LA: offer optional linking of an aged gaming/social account as
  *corroboration that can shorten* quarantine — never as sufficient alone.
  See *External-account linking* below for the per-platform reliability
  ranking and the LA priority order (BoardGameGeek and Steam lead).
- **Progressive trust / restricted mode** — new accounts start with limited
  reach; features unlock on time + clean activity. For LA: this *is* the
  quarantine tier, strengthened by the high-assurance early-matching rule.
- **Reporting + reputation weighting** — one-tap reports, reporter-reputation
  scoring, serial-false-reporter down-weighting, burst-coordination
  detection. For LA: this is L3, with explicit reporter reputation + a
  required reason category (covers T5, T6).
- **Age assurance** — self-declared age is increasingly insufficient;
  credit-card / ID / third-party estimation corroborate it. For LA: move the
  age-bracket filter to at least one corroborating signal where feasible;
  when weak, take the elevated-risk path (longer quarantine) rather than a
  block.

Recommended implementation order (highest leverage first):

| Priority | Practice | Layer | Effort | Impact |
|---|---|---|---|---|
| 1 | Liveness photo verification | L1 Gate | Medium | High — stops most photo fakes (T2) |
| 2 | Multi-signal phone + location + payment consistency | L1 Gate | Medium | High — hardens the location filter (T1) |
| 3 | Strict early-matching (high-assurance signals only) | L2 Quarantine | Low | High — protects tribe placement (T3) |
| 4 | Device fingerprint + anomaly detection | L1 + L4 | Higher | High — multi-accounting defence (T4) |
| 5 | Reporter reputation + burst detection | L3 Community | Medium | Med–High (T5, T6) |
| 6 | Optional external-account linking | L1 / L2 | Low | Medium — positive signal |
| 7 | Continuous post-promotion monitoring | L4 Backstop | Medium | High — catches adaptation (T10) |

**How the mature dating apps actually stack it** (the toolkit the bullets
above compress). It is a *tiered* stack, weakest-first, with each tier
treated as untrusted on its own:

1. **Account binding** — email + SMS one-time code, optional social login.
   Weakest tier: disposable/VoIP numbers and temp emails defeat it, so apps
   now score/block VoIP ranges and high-velocity same-device signups (T1, T4).
2. **Photo / liveness** — an in-app *video* selfie with an active
   challenge-response (head-turn, blink, random pose) matched to the profile
   photos; active liveness beats passive "is this a face?" and resists
   pre-recorded video / weaker deepfakes (T2).
3. **Government ID + face match** — scan an ID (authenticity, MRZ, expiry),
   match a live selfie to the ID photo, extract DOB. The closest analog to
   bank KYC; used for age compliance or an optional higher-assurance path.
4. **Age estimation** — AI age-estimation from the selfie as a lighter first
   filter, with document DOB when inconclusive — driven by regulation (UK
   Online Safety Act and similar in AU/EU/Brazil/California).
5. **Social proof / referral** — Instagram linking as a soft
   identity/lifestyle signal; Raya's member-referral + committee review is
   the extreme (high friction, high perceived quality). Closer to
   *community fit* than identity — it parallels the tribe-fit + quarantine
   idea, not the gate.

| App | Liveness method | Badge | Mandatory? | Data discipline |
|---|---|---|---|---|
| **Tinder** | Video selfie + liveness + FaceMap/FaceVector match to profile (Face Check) | Photo Verified | Mandatory for new users in some regions, expanding | FaceVector kept for account life (cross-account likeness); raw video deleted quickly; encrypted, non-reversible |
| **Hinge** | Video selfie → liveness + 3D face auth; also facial age estimation | Selfie Verified | Becoming mandatory in more regions for age rules | Templates often deleted within 24h (or kept for account life in Face-Check regions) |
| **Bumble** | Mimic a random on-screen pose → automated **+ human** review vs profile | Photo / ID Verified | Optional; sometimes forced after flags | Human review catches edge cases AI misses but doesn't scale perfectly |

The transferable discipline for LA — beyond "add liveness" — is the **PII
posture**: leading apps keep raw biometric video only briefly, store a
hashed/encrypted, non-reversible template, and delete on account closure.
That is exactly the T8 mitigation the threat model calls net-new — store the
verification *result* and a minimal likeness hash, never the raw face
long-term, and expose an assurance **badge** so the community can see each
account's verification level. The persistent gaps the apps still live with —
patient deepfakes, coached live proxies, fresh-device multi-accounting, and
low-activity accounts that never generate behavioural signal — are the same
residual risks the [Tribe and Trust](legendary-arena-tribe-and-trust.md#residual-risk-state-it-dont-hide-it)
model already accepts.

### External-account linking (corroboration only, never a gate)

Linking a LinkedIn, Facebook, Discord, Instagram, YouTube, TikTok, Steam, or
BoardGameGeek account proves only that the person controls *an* account — not
that the account is genuine, unique, or has a clean history. Meta actions
over a billion fake accounts in some quarters; Discord accounts are free and
bulk-created; even the strongest (LinkedIn) has cultivated fakes. Dating apps
learned this and *demoted* social linking from a core gate to an optional
boost (early Tinder required Facebook login for years, then dropped the hard
requirement after the post-Cambridge-Analytica API crackdown). Over-relying
on a link would recreate the exact spoofing and early-matching gaps the
threat model already flags (T1, T3). So linking stays a **positive signal
that can shorten quarantine** — subordinate to the hard verification and
behavioural layers, never sufficient alone, never a quarantine skip.

| Platform | Strength as corroborator | Best use for LA | Risk if over-relied on |
|---|---|---|---|
| **BoardGameGeek** | High (audience-specific) | Multi-year account with logged plays, ratings, collection = hard-to-fake community footprint | Rare, but a cultivated aged account is possible |
| **Steam** | Medium–High | Library + playtime + account age; very common among digital card/board players | Purchased/aged accounts exist |
| **LinkedIn** | Medium | Real-name culture, coherent history + organic connections raise confidence | Shared or carefully faked professional accounts |
| **Instagram** | Medium | Visual + activity history; the common dating-app link | Bought/aged accounts |
| **YouTube** | Medium | Aged channel with real engagement, thematically relevant | Channels bought/transferred; low coverage |
| **Facebook** | Low | Mild positive if aged + visible activity | Fakes and bought accounts are endemic |
| **TikTok / X / Reddit** | Low–Medium | Only if long-standing with organic activity | Trivial multi-accounting; farmed engagement |
| **Discord** | Very Low | Continuity / community-presence signal only | Bulk throwaways; multi-accounting trivial |

**LA priority order** (highest signal density for this community first):
BoardGameGeek → Steam → LinkedIn / Instagram → YouTube → TikTok / X / Reddit /
Discord. BoardGameGeek and Steam lead precisely because they are
audience-specific and expensive to fabricate convincingly — a generic social
link is weaker than a multi-year play history.

**Guardrails:** linking is strictly optional; no trusted-table access or
quarantine skip on a link alone; prefer accounts that are *aged and show
organic activity* over brand-new ones (a freshly-created linked account
should not reduce friction and is itself a mild risk signal); a sudden
disconnection or change of a linked account triggers re-evaluation (as with
the tribe-fit continuous re-verification rule); be resilient to third-party
API/permission changes (platforms restrict access periodically); and, on
privacy — many players keep gaming separate from professional or personal
social accounts, so declining to link must carry no penalty beyond the
standard quarantine path.

### Bot detection

Bots appear as account farmers, collusion/multi-accounting helpers, spam or
harassment amplifiers, quarantine reconnaissance probes, and matchmaking /
leaderboard distorters. No single signal is reliable — the strongest systems
combine several weak signals into a risk score and act *proportionally*
(longer quarantine, restricted matching, forced re-verification, removal)
rather than a binary ban.

- **Behavioural analysis** (highest value for games) — timing regularity,
  inhumanly fast or invariant decisions, always-optimal scripted paths,
  session shape, never using chat, low input entropy. Baseline legitimate
  players per skill/playstyle band and score deviation; treat high deviation
  as elevated risk, not an instant ban (protects skilled/unusual humans).
  Runs on L4 and inside quarantine.
- **Device / browser / network fingerprinting** — canvas/WebGL/audio/font
  fingerprints, setting consistency, IP reputation, data-center/VPN
  detection, TLS (JA3/JA4) fingerprints, and *sudden fingerprint change on a
  trusted account*. Cross-account fingerprint sharing is a strong bot-farm /
  multi-accounting signal (T4).
- **Velocity & rate limits** — account-creation velocity per IP/subnet/device
  cluster; friend-request/message/join rates; rapid cycling through short
  games (classic farming). Respond graduated, not hard-block-on-first.
- **Graph / social signals** — dense mutual connections among new accounts,
  rating/report rings, accounts that only ever play the same small set.
  Especially visible inside quarantine (collusive farming, Tree 3).
- **Challenge-response / progressive friction, honeypots, and ML anomaly
  detection** — escalate friction only when risk is already elevated; hidden
  UI elements or decoy tables that scripts trip; and, once labelled data and
  volume exist, unsupervised clustering + supervised models. Start with rules
  + statistical baselines; add ML later.

| Detection | Best placement | Threats |
|---|---|---|
| Signup velocity + device/IP | L1 Gate | Bot farms, multi-accounting (T4) |
| Early behavioural anomalies | L2 Quarantine | Farming, reconnaissance (T7) |
| Graph / collusion patterns | L2 + L3 | Coordinated rings (T5, T9) |
| Long-term behavioural drift | L4 Backstop | Adaptive / low-and-slow bots (T10) |
| Continuous device changes | All layers | Takeover + bot reuse (T4) |

### CAPTCHA — risk-triggered, never blanket

CAPTCHA is one signal among many, most effective when triggered *by risk*
and paired with the harder identity and behavioural controls. The governing
rules:

- **Risk-based triggering (most important).** Never show a CAPTCHA to every
  user on every action — only when other signals already indicate elevated
  risk (new account, device/IP change, high velocity, conflicting identity
  signals, quarantine anomalies).
- **Progressive friction.** Low risk → invisible score only; medium →
  lightweight checkbox/invisible challenge; high → stronger challenge or
  forced liveness re-check; very high → temporary restriction + manual review.
- **Fail closed for sensitive actions, open for casual ones.** Account
  creation, quarantine promotion, and bulk messaging require a good score;
  ordinary game actions for trusted accounts prefer invisible monitoring.
- **Accessibility.** Always offer an audio/alternative challenge and a human
  support path; don't rely on visual perception alone; mind mobile UX.

For LA, prefer an invisible score-based system (Cloudflare Turnstile, hCaptcha,
or reCAPTCHA v3 — weighing the Google dependency/privacy trade-off), combine
its score with the platform's own device/identity/behavioural signals, and
escalate to a visible challenge — or better, **liveness re-verification** —
only when combined risk is elevated. Pitfalls to avoid: CAPTCHA on every
login (kills conversion/retention), relying on CAPTCHA alone, identical
difficulty for veterans and new accounts, and not logging outcomes to tune
false-positive rates.

> **One thread across bot detection, CAPTCHA, and the filters:** prefer a
> *risk score + graduated response* over a binary decision, measure the
> false-positive rate on known-good players, and always give legitimate users
> a recovery path (re-verify / appeal / temporary restriction, not a straight
> permanent ban at medium confidence). This is the same conversion-vs-friction
> discipline in the [Tribe and Trust](legendary-arena-tribe-and-trust.md#residual-risk-state-it-dont-hide-it)
> Residual risk — friction rises with risk, not for everyone.

## Interactions

- **[Legendary Arena — Tribe and Trust](legendary-arena-tribe-and-trust.md)** —
  the parent strategy and threat model. It owns the four-layer fence, the
  threat numbers (T1–T10), the attack Trees, the tribe-fit filters, and the
  residual-risk framing; this page is its implementation companion and cites
  it for every T-number and layer reference.
- **[Profile & Login](profile-login.md)** — the identity and verification
  surface these controls would attach to: liveness/photo, phone, external
  linking, and the quarantine account-state live at this boundary.
- **[Monetization Model](monetization-model.md)** — the conversion-vs-friction
  tension runs through every control here: friction added to stop a threat
  actor also risks turning away a paying player, so each control is tuned by
  risk rather than applied flat.

## Edge Cases

- **Every control here is proposed, not specified.** Thresholds (mandatory
  vs optional checks, quarantine length, risk-score cutoffs) and vendor
  choices (which CAPTCHA, which fingerprinting/liveness provider) are open
  items. Until they exist and are hardened, none of these can be assessed for
  effectiveness — see the [Tribe and Trust](legendary-arena-tribe-and-trust.md#open-questions)
  Open Questions.
- **Bot scoring has no false-positive/negative design yet.** The behavioural
  and device signals assume an accurate scorer; a badly-tuned one either
  churns skilled/unusual humans or lets low-and-slow bots (T10) through.
- **Third-party dependency risk.** External-account linking and hosted CAPTCHA
  depend on platform APIs that restrict access periodically; a control that
  silently degrades when an API changes is worse than one that fails loudly.
- **PII created by the controls is itself a liability (T8).** Liveness,
  ID-match, and fingerprinting all generate sensitive data; the retention /
  encryption / minimisation posture must be designed alongside the control,
  not after.
- **None of these replace the behavioural and community layers.** Every
  technique here is subordinate to L4 + L3; treating any single control as
  sufficient recreates the gaps the threat model already flags.

## References

- [Legendary Arena — Tribe and Trust](legendary-arena-tribe-and-trust.md) —
  the parent page: strategy, four-layer fence, threat model (T1–T10, attack
  Trees), and residual risk. This playbook implements against it.
- [VISION](../docs/01-VISION.md) — the monetization bright lines (no
  pay-to-win) and identity/profile boundaries these controls must respect.
- Consumer-platform trust practice (dating-app liveness — Tinder Face Check,
  Hinge 3D face auth, Bumble pose+human review; progressive trust; age
  assurance; Raya referral curation), bot-detection via behavioural + device
  fingerprinting, and CAPTCHA services (Cloudflare Turnstile, hCaptcha,
  reCAPTCHA v3) — referenced as method; naming a service is not an
  endorsement or a selection decision.
- External-account-linking reliability assessment (LinkedIn, Facebook,
  Discord, Instagram, YouTube, TikTok, Steam, BoardGameGeek) — these prove
  account *control*, not unique real identity; ranked for the LA audience
  (BoardGameGeek and Steam lead). Referenced as method.
- This page is a **working draft** and defines no controls of its own.
  Promote to `canonical` only once the verification stack, quarantine
  criteria, and behavioural-scoring design exist and are cited.
