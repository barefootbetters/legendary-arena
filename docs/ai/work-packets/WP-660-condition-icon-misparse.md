# WP-660 — Condition-Clause `[icon:recruit|attack]` Misparse Fix (Game Engine)

**Status:** EXECUTED 2026-09-07 (Ready — green, pending commit/PR) · **Standard engine lane** (single file — `packages/game-engine/src/setup/heroAbility.setup.ts` — a parser-only fix + tests). Reserves **D-24471** / **EC-697**.

**Primary Layer:** Game Engine (`packages/game-engine/src/setup/heroAbility.setup.ts`)
**User-Visible Surface:** `play.legendary-arena.com` — cards that print a "if you made at least N recruit this turn" / "for every N recruit" condition no longer hand out a phantom +N recruit (or +N attack). Most visible: **She-Hulk's Radioactive Riot** stops granting a free **+6 recruit every play**, and **Hurl Legal Objections** (WP-658) transforms **without** a spurious +6 recruit. **D-24026 REQUIRED** (a live She-Hulk match — Radioactive Riot grants no recruit; Hurl Legal Objections transforms clean).
**Dependencies:** none (independent parser fix). Surfaced by a live `red-skull-Midtown-Bank-Robbery` diagnostics capture during WP-658's D-24026 check.
**Baseline:** `origin/main` @ `a8c5a9df` (after WP-658 merged).

---

## Problem

The hero-ability parser's icon extractors read **any** `N[icon:recruit]` / `N[icon:attack]` as a resource **grant**:

- **Step 2b** (`ICON_MAGNITUDE_PATTERN`) captures the adjacent integer as the magnitude.
- **Step 3** (`ICON_PATTERN` → `ICON_TO_KEYWORD`) promotes the icon to a `recruit`/`attack` keyword.

Neither distinguishes a grant ("you get +3[icon:attack]") from a **condition threshold** ("if you made at least 6[icon:recruit] this turn"). So a condition clause emits a phantom `{type:'recruit', magnitude:6}` effect. Live evidence (`red-skull-Midtown-Bank-Robbery` 1p diagnostics, 2026-09-07): **Radioactive Riot** — printed recruit `null`, ability "…you may KO a card" — fires `Player 0 gained +6 recruit from Radioactive Riot` on **every** play (unconditional, no gate). **Hurl Legal Objections** carries the same phantom recruit alongside its Transform.

This is a longstanding, honest-integrity bug: a card silently grants resources it never printed.

---

## Fix (parser-only, positional)

`CONDITION_ICON_PATTERN` matches an `[icon:recruit|attack]` that is the threshold/rate of a `made at least N` / `for every N` / `N or more` clause. `computeConditionIconRanges(abilityText)` records each condition icon's character range; Steps 2b and 3 skip an icon whose span **overlaps** a suppressed range (`overlapsSuppressedRange`). Suppression is **positional**, not line-level — a real grant icon elsewhere on the same line ("if you made 8 recruit, you get +3[icon:attack]") is kept. Mirrors the existing investigate / size-changing / count-scaled icon suppressions.

---

## Scope (In)

- `CONDITION_ICON_PATTERN` + `computeConditionIconRanges` + `overlapsSuppressedRange` helpers; the Step 2b / Step 3 overlap guards.
- Tests: no phantom recruit from "made at least N[icon:recruit]" (Radioactive Riot) or "for every N[icon:recruit]" (Jade Giantess); a co-located grant icon is kept (glory-of-asgard); a plain grant is not suppressed (control); Hurl Legal Objections' only effect is the transform.

## Out of Scope (flagged follow-ups)

- **Gating the real grants** on the still-unmodeled recruit-threshold condition for the co2e / ssw1 cards (`glory-of-asgard`, `chosen-by-asgard`, `living-thunderstorm`, `mysterious-origin`, `spark-of-the-divine`). After this fix they grant attack **ungated** — a pre-existing condition-modeling gap (the WP-653-style condition-gate family, applied to `recruit-threshold` via card markers). This WP removes the *phantom recruit*, not the ungated grant.
- The **amwp Ghost mastermind** ("You can't fight Ghost unless you made at least 6[icon:recruit] this turn") — a mastermind ability on the villain/mastermind parser, a different code path.

---

## Affected hero cards (parser output corrected)

| Card | Before | After |
|---|---|---|
| wwhk `radioactive-riot` | `{recruit:6}` (unconditional) | honest hollow (KO unimplemented) |
| wwhk `hurl-legal-objections` (WP-658) | `[{transform},{recruit:6}]` | `[{transform}]` + recruit-threshold gate |
| wwhk `jade-giantess` | phantom `{recruit:2}` | phantom recruit gone |
| co2e `glory-of-asgard` / `spark-of-the-divine` | `{recruit:8}` + grant | grant only (ungated — follow-up) |
| ssw1 `mysterious-origin` / `chosen-by-asgard` / `living-thunderstorm` | `{recruit:6}` + grant | grant only (ungated — follow-up) |
| core/msp1 `surge-of-power` | cosmetic `recruit` keyword (no effect) | clean (gated +3 attack only) |

---

## Acceptance Criteria

1. A `[icon:recruit|attack]` inside a "made at least N" / "for every N" / "N or more" clause emits **no** grant keyword or effect (**AC-1**).
2. A real grant icon **elsewhere on the same line** is preserved (positional suppression) (**AC-2**).
3. A plain grant ("you get +2[icon:recruit]") is **not** suppressed (**AC-3**).
4. Hurl Legal Objections' hook is `[{transform}]` (no phantom recruit) + the recruit-threshold gate (**AC-4**).
5. `game-engine` build 0; engine suite green; no hash re-pin; all card-derived `:check` + `sim:runtime-observed:check` gates green (no artifact drift) (**AC-5**).

---

## Definition of Done

- [x] Parser fix + helpers + Step 2b/3 guards
- [x] Tests (AC-1..AC-4) added and green
- [x] `pnpm -r build` 0; engine suite 3087/3087; whole-repo green
- [x] `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `sim:runtime-observed:check` all green (no regen)
- [ ] D-24026 live-verified (post-deploy She-Hulk match)
- [x] `DECISIONS.md` D-24471 + WORK_INDEX (WP-660) + EC_INDEX/EC-697 + STATUS + mindmap
- [ ] Follow-ups flagged: gate the co2e/ssw1 recruit-threshold grants; the amwp Ghost mastermind parser

## Vision Alignment

**Vision clauses touched:** card fidelity (a card grants only what it prints). **Conflict:** none — removes a spurious grant. **Determinism:** parser-only; no new `G` field; no `ctx.random`; the sentinel game plays none of the affected cards, so both hash oracles are byte-unchanged (empirically — engine suite green with no re-pin).
