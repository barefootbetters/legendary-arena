# Decision: Effect Vocabulary Model — Closed Keywords vs. Composable Primitives

> **Status:** DRAFT — proposed architecture decision for Jeff's ratification.
> Subordinate to `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`. **Extends**
> `docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md` (this is the next chapter of that
> doc's §2b "load-bearing finding"). Reserves one `DECISIONS.md` D-entry, to be
> assigned on ratification.
> **Date:** 2026-06-16

---

## 1. The question

Should card effects keep using a **closed, one-keyword-per-mechanic** vocabulary
(an engine change for every new mechanic), or move toward **self-describing
cards** where the engine "just fires" what each card declares — so new sets stop
requiring engine work?

This was raised while scoping Berserk (the first effect-authoring "grind" WP):
implementing it the current way means adding `'berserk'` to the closed
`HeroKeyword` union + array + a `DECISIONS` entry + a handler + a drift test.
Every genuinely-new mechanic in every future set repeats that. That fights
Vision Secondary Goal 10 ("expansions should not require new engine logic").

---

## 2. Where we actually are

`DESIGN-EFFECT-AUTHORING-SCALE.md` already diagnosed this: §2a (per-mechanic WP
ceremony), §2b (closed-union-per-magnitude fragmentation, D-20201), §2c
(hardcoded `switch`). The three "Levers" (WP-250/251/252/253) shipped and
addressed §2c (the ImplementationMap replaced the switch) and **partly** §2b
(collapsed 8 `reveal-*` keywords into one parameterized `reveal`).

**But the union is still closed.** The Levers parameterized *within* the
vocabulary; they did not *open* it. So Jeff's read — "I thought we moved away
from the closed-union" — is half-right: we shrank it, we did not open it. Berserk
proves it: a brand-new mechanic still costs an engine change.

---

## 3. The hard constraint that bounds the answer

Determinism, replay, and testability (Vision Primary Goal 3) are the
competitive-integrity foundation of the whole product. **A card therefore cannot
carry arbitrary logic the engine blindly runs** — that would break replay,
auditing, and the deterministic-scoring guarantee.

So "each card carries its own rules" cannot mean *arbitrary* rules. It must mean
a **declarative description in a vocabulary the engine interprets
deterministically.** The vocabulary does not disappear. The real question is
**how rich and composable** that vocabulary is.

---

## 4. The spectrum

| Model | Cost of a new mechanic | Determinism | Where it lands |
|---|---|---|---|
| **A. One closed keyword per mechanic** (today, pre-Lever) | An engine WP every time — the grind | Easy | Doesn't scale to 40 sets |
| **B. Parameterized keyword** (the Levers, e.g. `reveal` + rule-list) | Data for variants; engine for new *families* | Easy | Where we are now |
| **C. Composable primitives** (cards compose a small orthogonal set: move-card, gain-resource, ko, draw, reveal-and-filter, count, choose, conditional, gain-from-card-stat) | **Data for ~90% of mechanics; an engine WP only for a genuinely-new primitive** | Easy (engine interprets a known primitive set) | The target |
| **D. Full per-card scripting DSL** | Data for everything | **Hard** — needs a sandboxed interpreter; harder to audit/test | Over-engineered for a co-op deck-builder |

---

## 5. Proposed decision

**Adopt model C (composable primitives) as the target, as the explicit
continuation of the Levers — not a reversal of them.** Concretely:

1. The effect descriptor evolves from a flat keyword toward a small set of
   **orthogonal, composable primitives.** A card effect becomes a composition of
   primitives, authored as data.
2. **The decision rule for every new mechanic, henceforth:** *"Is this a new
   PRIMITIVE, or a COMPOSITION of existing ones?"*
   - A **composition** ships as **pure data** — no engine WP, no union change, no
     `DECISIONS` entry, no drift test. Just card markup + a regenerated coverage
     baseline/ledger.
   - Only a **genuinely-new primitive** earns an engine WP. The closed union
     stops being "the set of mechanics" and becomes "the set of **primitives**" —
     a far smaller, slower-growing list.
3. **Explicitly NOT model D.** A full scripting DSL trades determinism-by-
   construction for interpreter complexity, and violates the code standard
   ("explicit, boring, junior-readable"). Legendary is co-op and non-stack; it
   does not need it.

### Why not stay at B (closed keywords)
The grind is real and does not scale: 124 unsupported hero mechanics today, plus
every future set inventing more. Staying at B means an engine WP for each, in
perpetuity — the exact thing Goal 10 forbids.

### Why not jump to D (full DSL)
Determinism and auditability are non-negotiable, and a card-scripting interpreter
is a large, risky surface for a finite (if large) card pool. Composable
primitives get ~90% of the benefit at a fraction of the risk.

---

## 6. Honest counter-pressure (the case against moving now)

- **Premature abstraction.** The code rules say *"duplicate first, abstract on
  the third copy."* Berserk is the *first* of its pattern. Building a whole
  primitive language speculatively would be exactly the over-engineering those
  rules guard against.
  **Mitigation:** do **not** big-bang a primitive language. Grow it
  primitive-by-primitive, but **bias** each new mechanic toward a *reusable*
  primitive rather than a one-off keyword — justified here because, unlike the
  general case, we already *know* the 124-mechanic tail is coming (the ledger
  proves it). That foreknowledge is what tips "abstract on the third copy" toward
  "abstract on the first" for this specific domain.
- **Interaction is the real hard part.** "The engine just fires the effect" is
  the easy 20%; *how effects interact* (timing, triggers, ordering, replacement)
  is the 80% where engine complexity legitimately lives. Composable primitives
  make *firing* trivial but do not solve *interaction*. Legendary being co-op and
  non-stack makes interaction far more tractable than MTG — but this is the area
  to watch as primitives compose.

---

## 7. What this changes for Berserk (the immediate case)

Instead of a narrow `'berserk'` keyword, implement the **first reusable
primitive**: *"discard the top card of your deck, then gain a resource equal to
that card's printed stat"* (working name `discard-top-gain-from-stat`). Berserk
is then a **data instance** of it: gain **attack** equal to the discarded card's
**printed attack**. The mechanically-identical cousins — a Recruit variant, or
villain analogs — become **pure data** with no further engine work.

This is one primitive's worth of engine code (no more than the narrow keyword
would have been), but it converts a family of future cards from engine-WPs into
data. The 43 Berserk rows flip `unsupported → executable`; the coverage baseline
and the mechanic ledger regenerate.

---

## 8. On ratification

- Assign the next free `DECISIONS.md` D-entry and record this decision there.
- Update `DESIGN-EFFECT-AUTHORING-SCALE.md` §2b/§5 to note the vocabulary is
  opening from *mechanic-keywords* toward *composable primitives*, with the
  §5 decision rule above.
- Keep the `HeroKeyword` / villain keyword unions closed — but reframed: a new
  entry is now justified **only** for a new *primitive*, never for a new mechanic
  expressible as a composition. The drift tests and DECISIONS-per-entry ceremony
  then apply to the (small, slow) primitive set, not to (large, fast) content.

---

## 9. Recommendation in one line

**Yes to your instinct — make cards as data-driven as possible — but the
deterministic form of "self-describing" is composable primitives, not arbitrary
per-card rules. Grow the primitive set deliberately (starting with Berserk's),
and let composition absorb the long tail.**
