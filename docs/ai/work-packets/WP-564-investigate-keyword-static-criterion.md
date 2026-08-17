# WP-564 — `investigate` Keyword (Static Criterion)

**Status:** Draft 2026-08-17
**Layer:** Game Engine (`packages/game-engine`) + card-data-derived feeds
**Depends on:** WP-253 / D-24024 (the `reveal` family this mirrors) · WP-561 / D-24370 (the baseline that makes the coverage credit real)
**Reserves:** EC-599 · D-24373
**Baseline:** `origin/main` @ `8b111459`
**Lane:** Standard two-session (new engine keyword + canonical-array lockstep +
three derived feeds; well outside the Lightweight Lane).

---

## 1. Goal

Implement the `investigate` hero keyword for the cards whose criterion is fixed
on the card, so ten ability lines across ten Heroes stop silently doing nothing
when played. `investigate` is the joint-largest unimplemented mechanic by real
player impact: **293 in-play hollow observations, every one `parse-unrecognized`.**

## 2. Assumes

- **The mechanic contract is read from card text, not the keyword blurb.**
  `data/metadata/keywords-full.json` is a known-divergent source (its
  `investigate` entry is also mojibake-corrupted). The printed contract, from
  the cards themselves: *look at the top two cards of your deck, reveal a card
  matching the criterion and draw it, put the rest on the bottom of your deck.*
- **`HeroKeyword` union + `HERO_KEYWORDS` canonical array** live in
  `packages/game-engine/src/rules/heroKeywords.ts`, with an array/union parity
  drift test in `heroAbility.setup.test.ts`. `MVP_KEYWORDS` gates whether a
  played hook emits a `no-handler` hollow.
- **`reshuffleDiscardIntoDeck`** already exists at
  `packages/game-engine/src/moves/drawCards.logic.ts:109`. Looking at the top of
  a deck that holds fewer than the look count MUST reuse it; a second reshuffle
  path is forbidden.
- **The `reveal` family (WP-253 / D-24024) is the nearest precedent** — a
  look-at-top-N + criterion + act mechanic, including its `revealCount`
  descriptor field and its per-variant mechanic naming
  (`reveal-ko`, `reveal-min`, `reveal-cost-attack`, …). That naming precedent is
  why the deferred variants below get their own mechanics rather than flags.
- **A new hero keyword stales three derived feeds**, because keyword recognition
  flips a mechanic's `source` from `free-text` to `keyword`:
  `mechanics:metadata`, `ledger:heroes`, `effect-index`.

## 3. Context

Post-WP-453 the runtime sweep plays real games, and post-WP-561 the baseline
credits a shipped mechanic its full observed weight instead of zero. Together
those made `/coverage` a usable priority list for the first time, and
`investigate` sits at its top: **293 observations, 15 Hero cards, 3 sets
(`dims`, `msmc`, `noir`), 28 ability lines.**

**`investigate` is a mechanic family, not one effect.** The 28 lines partition
exactly:

| Group | Lines | Example |
|---|---|---|
| **static criterion + draw — THIS WP** | **10** | *Investigate for a card with an `[icon:attack]` icon* |
| choose-a-criterion first | 6 | *Choose a number 1 or more. Investigate for a card of that cost* |
| other zone | 5 | *Investigate the Villain Deck for a Villain* |
| modifiers | 3 | *…look at three cards instead of two* |
| disposition | 2 | *You may draw that card or KO it* |
| composes with unimplemented | 1 | *…and `[keyword:Teleport]` that card* |
| name-match | 1 | *…the same card name as any of your cards* |

**Scope correction made during drafting.** The reservation estimated "~12" base
lines. Reading every line individually moved three out: `Superhuman Senses` and
`Listen for Heartbeats` are both *"Choose a number 1 or more"* (choose-first, not
static), and `Trace the Fault Lines` carries a *"KO it or discard it"*
disposition. The base is **10**, and the seven groups now sum to 28 exactly.

**The ten in scope:**

| Hero | Card | Criterion |
|---|---|---|
| `dims/jessica-jones` | Alias Investigations | `[icon:attack]` |
| `msmc/stepford-cuckoos` | Shared Thoughts | `[icon:attack]` |
| `dims/squirrel-girl` | Find Tiny Friends | cost ≤ 3 |
| `msmc/m` | Uncover Family Secrets | cost = 3 |
| `noir/daredevil-noir` | Discover the Bodies | cost = 0 |
| `noir/luke-cage-noir` | Private Investigations | cost ≥ 4 |
| `noir/spider-man-noir` | Gumshoe's Revolver | cost ≤ 2 |
| `noir/iron-man-noir` | Mechanized Plate-Mail | `[hc:tech]` |
| `msmc/strong-guy` | X-Factor Investigations | `[hc:strength]` and/or `[team:x-factor-investigations]` |
| `msmc/rictor` | Unearth Tectonic Power | `[hc:ranged]` and/or `[hc:instinct]` |

**Why the choose-first cards are deferred rather than stretched into scope.**
They park a pending choice, and a parked choice shipped without a `UIState`
projection and a client prompt is a **hard freeze** for the human player — the
failure mode this repo has already paid for. Those six need projection, prompt
and gate landing together, which is a different packet with a different risk
profile.

**Expected coverage credit is NOT the full 293.** The base covers 10 of 28
lines, so the credit is whatever those specific cards actually fire in the
sweep. The EC requires measuring the delta after regeneration rather than
asserting the headline.

## 4. Scope (In)

- Add `investigate` to the `HeroKeyword` union, `HERO_KEYWORDS`, and
  `MVP_KEYWORDS`, in lockstep with the parity drift test.
- Parse `[keyword:Investigate] for <criterion>` into a hero effect descriptor
  carrying a **look count (default 2)** and a **static criterion**.
- Implement the handler: look at the top N of the acting player's deck
  (reshuffling via the existing helper when short), take the **first** card
  matching the criterion into hand, and put the remaining looked-at cards on the
  **bottom** of that deck **in look order**.
- Criterion vocabulary, static only: `icon` (attack / recruit), `cost`
  (exact, `or less`, `or more`), `hero-class`, `team`, and `and/or`
  combinations — read as **inclusive OR**.
- Narrate all three outcomes (drew / no match / empty deck) per the WP-550
  fidelity precedent.
- Regenerate `mechanics:metadata`, `ledger:heroes`, `effect-index`.
- Land `D-24373`.

## 5. Scope (Out)

- **No pending choice of any kind.** The six choose-a-criterion lines are a
  separate packet; shipping a parked choice here without a projection and prompt
  would hard-freeze the client.
- **No other-zone investigate** (Villain Deck, Sidekick Stack, Hero Deck,
  Bystander Stack, each player's deck).
- **No `[keyword:Teleport]`** — itself unimplemented (178 obs).
- **No disposition variants** (draw-or-KO, KO-or-discard) and **no modifiers**
  (look-at-three, any-card, the three-option chain).
- **No name-match criterion.**
- **No card-data edit.** Every marker is correctly authored; this is a code gap.
- **No change to the `reveal` family.** It is the precedent, not the target.

## 6. Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/heroKeywords.ts` | union + `HERO_KEYWORDS` + `MVP_KEYWORDS` |
| `packages/game-engine/src/rules/heroAbility.types.ts` | descriptor fields (look count, criterion) |
| `packages/game-engine/src/setup/heroAbility.setup.ts` | marker + criterion parsing |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | the handler |
| `packages/game-engine/src/setup/heroAbility.setup.test.ts` | parity drift test + parse cases |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | handler cases |
| `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json` | regenerated |
| `docs/ai/DECISIONS.md` + indices + mindmap + STATUS | governance |

## 7. Contract

- `investigate` looks at the top **N = 2** cards of the **acting player's own**
  deck. The look count is a descriptor field so the deferred look-at-three
  modifier can set it without reshaping the effect.
- Selection is **deterministic**: the first card in look order that satisfies the
  criterion. No choice is parked.
- Non-selected looked-at cards go to the **bottom** of the deck, preserving look
  order among themselves.
- Zero matches is a legal, narrated outcome: nothing is drawn, every looked-at
  card goes to the bottom.
- `and/or` is **inclusive OR** — a card satisfying either clause qualifies.

## 8. Acceptance Criteria

- **AC-1** — each of the ten cards in §3 resolves: a matching card in the top two
  moves to hand, the other goes to the bottom.
- **AC-2** — zero matches draws nothing, bottoms both cards, and logs a
  `blocked`-outcome line **naming the criterion** (not a bare "nothing
  happened").
- **AC-3** — a deck shorter than the look count reshuffles via
  `reshuffleDiscardIntoDeck`; `grep` shows no second reshuffle implementation.
- **AC-4** — bottom order is asserted explicitly (look order preserved), not
  left to a set comparison.
- **AC-5** — `and/or` is proven inclusive: a card matching only the first clause
  and a card matching only the second both qualify.
- **AC-6** — the `HERO_KEYWORDS` / `HeroKeyword` parity drift test passes with
  `investigate` present in both.
- **AC-7** — the ten cards move off `unsupported` in the regenerated hero ledger,
  and the six choose-first / five other-zone lines **do not** silently change
  status.
- **AC-8** — `mechanics:metadata:check`, `ledger:heroes:check`,
  `effect-index:check` all exit 0 after regeneration; `pnpm -r --no-bail test`
  green.
- **AC-9** — the in-play observation delta is **measured and recorded**. Do not
  claim 293.

## 9. Verification Steps

1. `pnpm -r build && pnpm --filter @legendary-arena/game-engine test`.
2. Regenerate all three feeds, then re-run their `:check` gates.
3. Inspect the regenerated ledger for the ten cards and for the deferred lines.
4. Record the observation delta from `sim:runtime-observed`.
5. **D-24026 live-verification (REQUIRED):** play a match with one of the ten
   Heroes, play the investigate card, and confirm the game log names the
   criterion and the drawn card.

## 10. Definition of Done

- AC-1 … AC-9 satisfied.
- D-24373 landed, recording the card-text-derived contract, the static-only
  scope with its six deferred families, and the inclusive-OR reading.
- Indices / mindmap / STATUS updated; `roadmap:counts:check` and
  `ledger:numbers:check` exit 0.
- D-24026 recorded with the observed log line.
- `01.6` post-mortem assessed — **likely triggered** (a new keyword and a new
  criterion vocabulary are a new code category); author it in Session 2 if so.

## Vision Alignment

Required by `00.3 §17.1` — **card data / content semantics** (Vision §1, §2,
§10) and **simulation-observed coverage** (§26).

**Vision clauses touched:** §1, §2, §10, §26.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
§1 (Rules Authenticity) is the point — ten printed abilities currently do
nothing when played, which is precisely the unfaithfulness the clause forbids.
The contract is taken from printed card text rather than a paraphrase, and the
deferred variants are deferred rather than approximated, so nothing ships as a
half-right rule.

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed. No monetization,
paid surface, gating, or persuasive mechanic; no mechanical advantage sold.

**Determinism preservation:** deterministic and replay-faithful. Selection is
first-match in look order — no `ctx.random`, no clock. Deck manipulation goes
through existing zone helpers and the existing reshuffle path, so replay and the
`finalStateHash` surfaces behave exactly as for the `reveal` family. Any fixture
hash movement is an execution-time finding to confirm, not assume.

## Gate Record (Phase 1)

**WP class:** Behavior / State Mutation (a new hero effect that mutates `G`).

| Gate | Verdict | Notes |
|---|---|---|
| Pre-flight (`01.4`) | **READY TO EXECUTE** (2026-08-17) | Dependencies verified: `reveal` family shipped (WP-253); `reshuffleDiscardIntoDeck` exists at `drawCards.logic.ts:109`; `HERO_KEYWORDS` parity drift test present. Mechanic contract read from **card text across all three sets**, not the keyword blurb, which is on the known-divergent list and is additionally mojibake-corrupted here. **Scope corrected during pre-flight:** the reservation's "~12" base lines became **10** after reading each line — two are *Choose a number 1 or more* (choose-first) and one carries a KO-or-discard disposition. The seven groups now sum to 28 exactly, so no line is unaccounted for. Empirical Scaffold **not required**: this is additive keyword recognition, not a validation-tightening change; the derived-feed regeneration is covered by AC-8 instead. |
| Copilot (`01.7`) | **PASS** (2026-08-17) | Two RISKs closed in-text: (1) the temptation to fold the six choose-first cards in "while we're here" — §5 forbids it and §3 states the hard-freeze reason, so the boundary is a safety property rather than a preference; (2) claiming the 293-observation headline as delivered coverage — AC-9 requires the delta be measured, since the base covers 10 of 28 lines. |
| Lint gate (`00.3`) | **PASS** | 21/21 below; §17 triggered and answered. |

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Title | Verdict |
|---|---|---|
| 1 | Work Packet Structure | PASS — all 10 sections in order |
| 2 | Non-Negotiable Constraints Block | PASS — §5 (no pending choice, no other zone, no Teleport, no disposition/modifier, no card data) |
| 3 | Prerequisites (`## Assumes`) | PASS — §2; each anchor cites a file:line read at baseline `8b111459` |
| 4 | Context References | PASS — §3 carries the 28-line partition, the ten-card table, and the scope correction |
| 5 | Output Completeness | PASS — §6, including all three derived feeds |
| 6 | Naming Consistency | PASS — `investigate` matches the printed keyword; criterion names reuse existing marker vocabulary (`icon` / `hc` / `team`) |
| 7 | Dependency Discipline | PASS — WP-253 and WP-561 both merged |
| 8 | Architectural Boundaries | PASS — engine only; reuses the existing reshuffle helper rather than adding a path |
| 9 | Windows Compatibility | PASS — no shell/path work |
| 10 | Environment Variable Hygiene | N/A |
| 11 | Authentication Clarity | N/A |
| 12 | Test Quality | PASS — AC-2/AC-4/AC-5 pin the boundaries an implementation is most likely to get wrong (zero-match, bottom ORDER, inclusive OR) |
| 13 | Commands and Verification | PASS — §9, ending in a real match |
| 14 | Acceptance Criteria Quality | PASS — AC-1..AC-9 independently checkable; AC-9 forbids an unmeasured claim |
| 15 | Definition of Done | PASS — §10, binary, flags the likely `01.6` trigger |
| 16 | Code Style | PASS — `for...of` over the looked-at cards, no `.reduce()`, criterion evaluation as an explicit predicate |
| 17 | Vision Alignment | PASS — triggered; cites §1, §2, §10, §26 with the determinism line |
| 18 | Prose-vs-Grep Discipline | PASS — AC-3's grep is scoped to a named helper |
| 19 | Bridge-vs-HEAD Staleness | PASS — baseline SHA in header; all citations read at that commit |
| 20 | Funding Surface Gate | N/A |
| 21 | API Catalog Update | N/A — no `apps/server` endpoint |
