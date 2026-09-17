---
title: Valuable Assets
type: Guide
tags:
  - strategy
  - moat
  - business
  - architecture
  - asset-inventory
  - governance
  - vision
related:
  - card-effect-system.md
  - effect-rulings.md
  - lagn-v1.md
  - play-board.md
  - scoring.md
  - monetization-model.md
  - reward-integrity.md
  - vision.md
  - soul-of-legendary-arena.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\valuable-assets.md (this page — https://ewiki.legendary-arena.com/valuable-assets/)
  - ../docs/lagn-architecture-brief.md
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/01-VISION.md
last-reviewed: 2026-09-17
---

# Valuable Assets

## Summary

An editorial inventory of the highest-value things Legendary Arena has **actually
built**, ranked along **two different lenses that deliberately disagree**:

- **Strategic moat** — replacement cost. *If you lost asset X tomorrow, how long
  to rebuild it, and would a competitor be able to?*
- **Revenue / survival** — cashflow. *What actually collects the money that makes
  Friday's payroll?*

Keeping both is the point: the asset that earns is not the asset that is hardest
to replace, and conflating them produces a misleading single list. The card IP is
licensed (not owned) and the tech stack is commodity; what is genuinely expensive
to reproduce is the accumulated engineering and analytical work.

**In one line:** the moat is the engine plus the catalogue; the product is how you
collect rent on that moat; governance is why the moat does not rot; the vision is
why the product is more than "another online Legendary"; and rulings are the
insurance policy you have not bought yet.

> **This is a snapshot, not a metric.** It reflects what has been built as of
> 2026-09-17 and a judgment about durability. The revenue lens in particular
> needs real billing data to sharpen — see [Open Questions](#open-questions).

## Mechanics

### The lens

Value here is measured by **replacement cost and survival**, not line count or
cleverness. The test for the moat ranking is: *if this vanished, how long would
the rebuild take, and would the company survive the rebuild?* The test for the
revenue ranking is simpler: *does money flow through it?* An asset can score high
on one and low on the other — the live product is the clearest example (earns the
most, reproducible the fastest), which is exactly why the two rankings are kept
separate.

### Ranking A — strategic moat (replacement cost)

**1. Encoded Legendary knowledge base (engine + effect system).** The faithful
Marvel Legendary rules engine: moves / phases / turn flow, the hero
effect-primitive AST and compositions, ~25 villain primitives, mastermind /
scheme / twist handlers, the reusable pending-choice interaction model, and hard
determinism (all randomness through `ctx.random.*`, replay-pinned by
`finalStateHash`). This is not "software" so much as **captured game knowledge** —
thousands of hours of reading Marvel Legendary's design, distilled into
machine-executable form. A competitor can hire engineers; they cannot quickly
recreate the accumulated rules interpretation. Replacement cost: extreme.
Survival impact: existential. See [Card Effect System](card-effect-system.md) and
[Rule Execution Pipeline](rule-execution-pipeline.md).

**2. Card catalogue + image corpus.** 41 sets converted into the registry format
with inline effect markers, a reproducible 5-stage regeneration pipeline gated by
a semantic-diff check, searchable taxonomy metadata, and the Cloudflare R2 image
library. Data outranks code more often than people expect: **code can be
rewritten; clean data must be re-discovered.** Even with the physical cards in
hand, reproducing the normalised, imaged, searchable catalogue is enormous manual
labour. See [Card Effect System](card-effect-system.md),
[Card Image Acquisition](card-image-acquisition.md), and
[R2 Image Naming Convention](r2-image-naming-convention.md).

**3. AI-development governance + institutional memory.** The WP / EC / DECISIONS /
number-ledger machine, the `.claude` rules, this ~80-page ewiki, and the CI gate
lattice (coverage / ledger, dashboard, reward-integrity). This is **a factory for
producing Legendary Arena** — and the factory is often worth more than any single
product it makes. It compounds, scales contributors, and preserves the decisions
that would otherwise be lost to drift. Even if the game vanished, the governance
system could build the next one. See [Development Workflow](development-workflow.md)
and [Reward Integrity](reward-integrity.md).

**4. Vision / Soul / design philosophy.** Years of refinement on *why the game
exists* and *what makes it different*: merit-based competition, cooperative
heroism, mentorship themes, the anti-pay-to-win line, skill expression. This is
intellectual capital, not a mission statement — a future team could rebuild the
code faster than it could re-discover this clarity, and without it the engine
becomes generic, monetisation drifts, and the product loses its identity. See
[Vision](vision.md) and [Soul of Legendary Arena](soul-of-legendary-arena.md).

**5. Live product + deploy infrastructure.** The arena client (play surface,
playmats, feel layers), the server wiring boardgame.io into Postgres with
reconnect, guest play, the solo bot-ally, and the deploy pipeline. It ranks
**last on this lens** precisely because it is the most reproducible — a capable
team could rebuild the Vue client, the boardgame.io integration, the Postgres
backend, and the deploy path in months. Its low moat rank is not a knock; it is
why it tops the *other* lens. See [Play Board](play-board.md) and
[Turn System](turn-system.md).

*Just below the top five on this lens sits the **competitive / economy layer**
(PAR / seed-challenge scoring, leaderboards, LAGN notation, report cards, the
Legendary Pass) — real accumulated calibration work, but downstream of #1–#2: you
cannot score what you cannot play faithfully.*

### Ranking B — revenue / survival (what pays Friday)

Revenue and moat are not the same thing — Netflix's moat is its content, not its
video player; Bloomberg's is its data, not its desktop app. Ranked by what
actually collects money:

1. **Live product + deploy infrastructure** — the only surface that takes payment
   and keeps players at the table. Nothing bills without it.
2. **Competitive / economy layer** — the [Legendary Pass](monetization-model.md),
   the Gauntlet, and [scoring](scoring.md): the conversion and retention engine
   sitting directly on the product.
3. **Engine + catalogue (assets #1–#2 above)** — necessary inputs to everything
   that earns, but they do not bill directly; they make the product worth paying for.
4. **Vision / Soul** — drives differentiation and therefore conversion, but
   indirectly; it is why a customer chooses this over a generic clone.
5. **Governance** — zero direct revenue, maximal indirect leverage: it is why the
   earning surfaces keep shipping without rotting.

The two lenses cross over most sharply at the top and bottom: the live product is
#5 on moat but #1 on revenue; governance is #3 on moat but #5 on revenue. Both
readings are true at once.

### The effect-rulings corpus: current rank vs strategic potential

- **Current rank: unranked — it is not built.** Scoped as
  [WP-704](effect-rulings.md) (drafted 2026-09-17), not shipped. It cannot rank on
  either lens today.
- **Strategic potential: a candidate for moat #1 *if* WP-704 is fully realised.**
  The engine is *machine-executable* knowledge; the rulings corpus is
  *human-readable* knowledge of the same interactions — and that is what makes it
  powerful. If the engine disappeared, a mature rulings corpus could let another
  team reconstruct it; if the corpus never exists, hundreds of edge-case decisions
  stay trapped inside code, legible only by reading handlers. Its future value
  compounds across AI training / verification, onboarding, dispute resolution,
  regression testing, and any future engine rewrite. It is [insurance on asset
  #1](effect-rulings.md) today; it could become the clearest statement *of* asset
  #1 once filled.

### What does not rank

Naming the non-assets sharpens the boundary. These matter — some pay the bills —
but none is the moat:

| Thing | Why it does not rank |
|---|---|
| Marvel / Legendary card IP | Licensed, not owned. It can be lost; a moat you can lose is not yours. |
| boardgame.io, Vue, Postgres, R2 | Reproducible commodity architecture — anyone can stand it up. |
| Marketing site, brand tokens, merch SKUs | Useful distribution and cash, not the moat. A starter box and a playmat are copyable. |
| "Crown jewel" as a *file* | The asset is the encoded rules, not any one document. Do not let a JSON corpus inherit the title. |

### How to use this ranking

- **Protect first (moat lens):** the engine + catalogue. Treat effect-system
  changes and registry regeneration as high-risk surfaces — this is where the
  [reward-integrity](reward-integrity.md) CI and the semantic-diff gate earn their keep.
- **Fund first (revenue lens):** the live product + economy layer. An engine with
  no table anyone sits at pays no bills; keep the earning surface healthy.
- **Monetize after fidelity:** scoring / Pass / LAGN only carry integrity while
  the engine is stable. That ordering is why reward-integrity is a gate, not a nicety.
- **Re-rank on data, not vibes.** The revenue lens is a judgment until billing
  data confirms which surface actually converts — an operator-dashboard question,
  not an engineering one. See [Open Questions](#open-questions).

## Interactions

- **[Card Effect System](card-effect-system.md)** / [Rule Execution Pipeline](rule-execution-pipeline.md)
  — the engine (moat #1).
- **[Card Image Acquisition](card-image-acquisition.md)** / [R2 Image Naming Convention](r2-image-naming-convention.md)
  — the catalogue + images (moat #2).
- **[Development Workflow](development-workflow.md)** / [Reward Integrity](reward-integrity.md)
  — the governance system (moat #3).
- **[Vision](vision.md)** / [Soul of Legendary Arena](soul-of-legendary-arena.md)
  — the vision / soul (moat #4), and *why* every other asset matters.
- **[Play Board](play-board.md)** / [Turn System](turn-system.md)
  — the live product (moat #5, revenue #1).
- **[Scoring](scoring.md)** / [LAGN Specification](lagn-v1.md) / [Monetization Model](monetization-model.md)
  — the competitive / economy layer (revenue #2).
- **[Effect Rulings](effect-rulings.md)** — insurance on moat #1; a future moat-#1
  candidate if WP-704 is realised.

## Edge Cases

- **The two lenses will keep disagreeing — that is intended.** Do not "resolve"
  them into one list; the disagreement carries information (revenue ≠ replacement
  cost). Collapse them only if you are willing to lose one of the two truths.
- **The revenue ranking is the softer of the two.** It is a judgment until the
  operator dashboard's billing data says which surface actually converts. The moat
  ranking is more stable because replacement cost changes slowly.
- **"Crown jewel" language is about the analytical work, not a file.** The brief's
  moat argument is sound; the mistake is reading it as "the rulings JSON is the
  main asset." The analytical work is mostly already captured in the engine and
  the markers — which is why the corpus is a *future* candidate, not a current one.
- **This page will drift.** It is a dated snapshot. Re-review when a major
  subsystem ships (especially WP-704) or the business model shifts; do not treat
  an old ranking as current truth.

## History

- **2026-09-17** — Page created to capture the asset ranking and moat reasoning,
  alongside the [effect-rulings](effect-rulings.md) page and the reconciled LAGN
  architecture brief (PR #2085 / #2088).
- **2026-09-17** — Sharpened with the "what does not rank" boundary and the "how
  to use this ranking" guidance after a first cross-review (PR #2090).
- **2026-09-17** — Restructured to **dual-lens (moat vs revenue)** after a second
  cross-review argued a pure replacement-cost lens: added Vision / Soul as a
  ranked asset, moved governance up and the live product down on the moat lens,
  and reframed the rulings corpus as a *future* moat-#1 candidate rather than a
  current also-ran.

## Open Questions

- **Revenue-weighted precision.** Ranking B is a reasoned judgment; the exact
  order (does the Pass out-earn the base product experience? does the Gauntlet
  drive retention more than new-player conversion?) needs the billing and
  engagement data the operator dashboard holds. Sharpen it once that data is at hand.
- **When does the rulings corpus actually climb?** It becomes a moat-tier asset
  only past a completeness threshold (a dozen rulings is a gesture; several
  hundred is a moat). Worth revisiting its rank after WP-704 ships and the corpus
  has been filled for a while.

## References

- [`docs/lagn-architecture-brief.md`](../docs/lagn-architecture-brief.md) — the
  moat argument and the "crown jewel" framing (in context).
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) — the layer boundaries
  the engine / registry / product assets are built on.
- [`docs/01-VISION.md`](../docs/01-VISION.md) — what the game is for.
- [Effect Rulings](effect-rulings.md), [Card Effect System](card-effect-system.md),
  [LAGN Specification](lagn-v1.md), [Scoring](scoring.md),
  [Monetization Model](monetization-model.md),
  [Soul of Legendary Arena](soul-of-legendary-arena.md).
