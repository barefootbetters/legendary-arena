# WP-290 — Size-Changing: Hero Class-Grant on Play

**Status:** Ready to Execute
**Layer:** Game Engine (`packages/game-engine` — setup/parser, per-card state, class-condition evaluation, hollow classification)
**Depends on:** WP-273 ✅ (recognized-keyword-with-no-onPlay-handler precedent: wall-crawl), WP-179 ✅ (`G.cardTraits.heroClass`), WP-023 ✅ (`heroClassMatch` over `inPlay`), WP-257 ✅ (the hollow detector that surfaced the gap)
**EC:** EC-322
**Decisions:** D-24074
**User-Visible Surface:** play.legendary-arena.com (a Size-Changing Hero now counts as its listed class for other Heroes' class-matching abilities the turn you play it)

---

## Goal

Implement the printed **Size-Changing** hero mechanic's **class-grant** effect: *"When you play
this card, it has the [Class] class."* (canonical rulebook text, `data/metadata/keywords-full.json`
key `sizechanging`, pdfPage 33). After this WP, when a Size-Changing Hero is played, it counts as
its listed Hero Class — in addition to any printed class — for every class-matching ability that
scans the cards you played this turn (`heroClassMatch`, `distinctHeroClassesAtLeast`). The
`[keyword:Size-Changing]` marker is recognized at parse time (clearing the live
`parse-unrecognized` hollow on `antm/jocasta/holographic-image-inducer`, diagnostics
`gitSha 988ad2e`, 2026-06-25). The mechanic's **second** printed effect — *"this card's printed
Attack is also its Victory Points"* — is **deferred** (see §Out of Scope: the engine has no
per-card / hero-deck VP scoring to attach it to).

> **Supersedes the prior WP-290 draft.** The prior draft (`…-recruit-discount`, merged as the SPEC
> bundle in PR #462) modelled Size-Changing as a *recruit-cost discount* — a mechanic that does not
> exist on the card. The rulebook keyword grants a **class on play** (and makes Attack = VP); it
> never discounts recruiting. This re-draft replaces that design wholesale; D-24074 and the indices
> are rewritten to match. See §Context for the correction record.

---

## Assumes

- **The canonical rule is the class-grant, not a discount.** `data/metadata/keywords-full.json`
  (`key: "sizechanging"`, pdfPage 33): *"Some Hero cards say 'Size-Changing: Covert.' This means
  'This card's printed Attack is also its Victory Points. When you play this card, it has the Covert
  class.'"* The prior `recruit-cost discount` reading was an invented mechanic; this WP implements
  the printed rule. (`architecture.md` §Prohibited AI Failure Patterns forbids inventing mechanics —
  the correction record is in §Context.)
- **`G.cardTraits[id].heroClass`** (`state/cardTraits.types.ts`) is a **single nullable string**,
  built once at setup from each card's `hc` field (`setup/buildCardTraits.ts:199-215`) and
  **read-only at runtime** (`types.ts:789`). There is **no** existing per-turn class-mutation or
  class-overlay mechanism. The grant therefore must NOT mutate `cardTraits`; it is a **second,
  static class source** consulted alongside the printed class.
- **The class-matching reads that scan `inPlay`** are `heroClassMatch`
  (`hero/heroConditions.evaluate.ts:49-68`, self-**excludes** the triggering card) and
  `distinctHeroClassesAtLeast` (`:126-149`, self-**includes**; counts distinct classes among
  `inPlay`). These are the two sites the granted class must reach. The Empowered class-counts in
  `effectPrimitive.interpret.ts` scan the **HQ / top-deck** (not played cards), so the on-play grant
  does not apply there — they are correctly unaffected.
- **`inPlay` holds exactly the cards played this turn**, reset to `[]` at turn setup
  (`setup/playerInit.ts:39`). A Size-Changing card "has" the granted class only while it is in
  `inPlay`; because the reads already scan `inPlay`, consulting the card's static granted-class list
  for in-play cards realizes "it has the class when played" with **no mutation and no end-of-turn
  cleanup** — the grant expires naturally when `inPlay` clears.
- **The grant is load-bearing, not cosmetic** (proven against `data/cards/{amwp,antm}.json`):
  `amwp/yellowjacket`, `amwp/steal-pym-particles`, `amwp/goliath`, `antm/ultron-pym` have **null
  printed class** — Size-Changing is their only class; `antm/giant-ego` (strength + tech) and
  `antm/swarm-tactics` (ranged + covert) have a **printed class that differs** from the granted one.
  A recognition-only fix would mis-count all of these. Most other Size-Changing cards have
  printed == granted (the grant is then a harmless duplicate, deduped by a `Set`).
- **WP-273 ✅ (D-24049)** established the *recognized-keyword-with-no-`onPlay`-handler* pattern
  (`wall-crawl`): a `HeroKeyword` in a dedicated executed-category set joined into `MVP_KEYWORDS`,
  with **no** `HERO_EFFECT_HANDLERS` entry, classifies not-hollow because its effect executes
  elsewhere. Size-Changing mirrors this: its effect executes at **class-read time** (the evaluators
  consult the granted-class list), so it needs a category-membership entry, not an onPlay handler.

---

## Context

The hollow-effect detector (WP-257) flagged `antm/jocasta/holographic-image-inducer#2`:
`size-changing` / `onPlay` / `parse-unrecognized` / turn 28, in a real `play.legendary-arena.com`
match. The same gap is tracked as `unsupported` across the Ant-Man family (amwp + antm) in the
`/coverage` ledger and the committed runtime-observed sweep. The `onPlay` timing in the flag is a
parser artifact (an unrecognized `[keyword:…]` marker parks on a default `onPlay` hook); the
mechanic has no `onPlay` *action* — its effect is the standing class-grant realized at read time.

**Correction record (why this is a re-draft).** The first WP-290 draft mis-identified Size-Changing
as *"recruit a Hero for 2 Recruit less per listed class played this turn,"* pattern-matching the
`Size-Changing [hc:X]` grammar onto the patrol fight-cost modifier without reading the rulebook
keyword text. No such discount exists on the card; the printed rule is a class-grant plus
Attack-as-VP. Implementing the discount would have shipped a fabricated rule on a licensed Marvel
card (Vision §1/§2 card-accuracy; `architecture.md` "never invent mechanics") and left the real
mechanic unimplemented. The draft SPEC bundle merged (PR #462) before the error was caught; this
re-draft replaces the WP + EC + D-24074 + index rows in place, reusing the reserved numbers
(`01.0a §Number reservation ownership`). Drafted against `origin/main` at `1dbea8b6`. Supersession
check: WP-290/EC-322/D-24074 already reserved by this slug (the slot being corrected); no *other*
WP/EC/PR covers Size-Changing.

**Why one WP, engine-only:** the change is a single cohesive engine unit (recognize → store →
consult at the two class reads → classify not-hollow), entirely within `packages/game-engine`; no
layer is crossed. There is no client surface — class-matching is engine-internal, and the granted
class is not a gated display affordance (UIState class display is cosmetic and deferred, §Out of
Scope). ~13 files; comparable to WP-285 (18) / WP-286 (22).

---

## Scope (In)

- **Recognize the keyword.** Add `'size-changing'` to `HERO_KEYWORDS` (union + array, 22 → 23) and
  its drift tests.
- **Parse the granted-class list.** In `setup/heroAbility.setup.ts`, when an ability line carries
  `[keyword:Size-Changing]`, extract the `[hc:...]` token(s) **on that same line** as the
  **granted-class list** onto `HeroAbilityHook.sizeChangingClasses?: string[]` (normalized via
  `normalizeTraitSlug`), and **do NOT** emit them as `heroClassMatch` play-conditions, and emit
  **no** `unresolvedMarkers` entry. `[hc:X]` tokens on *other* ability lines remain ordinary
  conditions (e.g. `colossal-stomp` line 2 `[hc:strength]: …` is a real condition on a separate
  hook). A Size-Changing marker with no following `[hc:X]` parses to an empty class list — recognized,
  no grant, no hollow, no throw.
- **Store per-card at setup.** Build `G.cardSizeChangingClasses: Record<CardExtId, string[]>` (a
  sibling snapshot to `cardKeywords`/`cardTraits`) from the parsed hooks in
  `setup/buildInitialGameState.ts`.
- **The effective-class helper.** New `hero/sizeChanging.logic.ts`:
  `getGrantedClasses(G, cardId): readonly string[]` (the card's Size-Changing classes, `[]` when
  none) and `cardHasClassWhenPlayed(G, cardId, classSlug): boolean` (true if `classSlug` is the
  card's printed `heroClass` **or** in its granted list). Pure, `for...of`, no `.reduce()`, no
  mutation; reads only `G.cardTraits` + `G.cardSizeChangingClasses`.
- **Consult at both class reads.** `hero/heroConditions.evaluate.ts`: `heroClassMatch` and
  `distinctHeroClassesAtLeast` use the helper so an in-play Size-Changing card counts as **each** of
  its effective classes (printed ∪ granted), preserving each evaluator's existing self-exclusion /
  self-inclusion semantics.
- **Classify not-hollow.** Add `'size-changing'` to a new `CLASS_GRANT_KEYWORDS` set →
  `MVP_KEYWORDS` in `hero/heroEffects.execute.ts` (the wall-crawl category pattern); **no**
  `HERO_EFFECT_HANDLERS` entry (handler count unchanged).
- **Tests** for each: keyword drift, parser extraction (granted-class, multi-line condition
  isolation, empty/no-`[hc]`), the helper, the two evaluator reads (printed-only, granted-only,
  printed≠granted dual-class), MVP-coverage drift, and the hollow removal.

## Out of Scope

- **Attack-as-Victory-Points** (the keyword's second printed effect). The engine scores VP only from
  the **victory pile by card type** (`scoring/scoring.logic.ts` — villain/henchman/bystander/tactic/
  wound); there is **no per-card VP field** (`CardStatEntry` has none) and **no scoring of a player's
  own Hero cards at all**. "Printed Attack is also its VP" has nothing to attach to until a hero-deck
  VP-scoring subsystem exists. Deferred as a named follow-up, **blocked on that subsystem**.
- **Microscopic Size-Changing** (`[keyword:Microscopic Size-Changing]`, repeated `[hc:X]` icons) —
  a materially different keyword (its own follow-up); not added here.
- **Villain / city-card Size-Changing** and the **divided-card two-sided form** — named follow-ups.
- **UIState class-display projection** — reflecting the granted class in the client's trait display
  is cosmetic (class is not a gating affordance); deferred. No client change.
- **No change** to `G.cardTraits` (immutable), to card data, or to any economy/cost surface (this
  mechanic touches neither cost nor recruiting).

---

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — add `'size-changing'` (union + array, 22 → 23)
- `packages/game-engine/src/rules/heroKeywords.test.ts` — drift 22 → 23
- `packages/game-engine/src/rules/heroAbility.types.ts` — add `sizeChangingClasses?: string[]` to `HeroAbilityHook`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — recognize `[keyword:Size-Changing]`; extract same-line `[hc:...]` as granted classes (NOT conditions); no unresolved marker; graceful empty
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — drift 22 → 23 + Size-Changing parse tests
- `packages/game-engine/src/types.ts` — add `cardSizeChangingClasses?: Record<CardExtId, string[]>` G field
- `packages/game-engine/src/setup/buildInitialGameState.ts` — build `G.cardSizeChangingClasses` from the parsed hooks
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `'size-changing'` in new `CLASS_GRANT_KEYWORDS` → MVP_KEYWORDS (not-hollow at onPlay; no handler)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — MVP-coverage drift for the new category; handler count unchanged
- `packages/game-engine/src/hero/sizeChanging.logic.ts` — **new**: `getGrantedClasses` + `cardHasClassWhenPlayed`
- `packages/game-engine/src/hero/sizeChanging.logic.test.ts` — **new**: helper tests
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — `heroClassMatch` + `distinctHeroClassesAtLeast` consult the helper
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — granted-class condition tests

**Note on file count:** ~13 files, single layer (`packages/game-engine`); no layer crossed. The
mechanic is one cohesive unit (parse → store → consult at the two reads → recognize). The
helper-file pair and the keyword/G-field/hook additions are inseparable from the evaluator wiring.

---

## Contract

- **D-24074:** `G.cardSizeChangingClasses[id]` is the per-card normalized list of Hero Classes that
  card **gains when played** (its Size-Changing grant), stored immutably at setup. A card in `inPlay`
  is treated as having class `C` iff `C` is its printed `G.cardTraits[id].heroClass` **or** `C ∈
  G.cardSizeChangingClasses[id]`. Class membership is **presence, not count**: each effective class is
  one element of a `Set`; a card contributes each of its effective classes at most once (printed and
  granted being equal collapses to one). This effective-class test is the **single helper**
  (`cardHasClassWhenPlayed` / `getGrantedClasses` in `hero/sizeChanging.logic.ts`); `heroClassMatch`
  and `distinctHeroClassesAtLeast` MUST both derive class membership from it — neither may
  re-implement printed-vs-granted matching independently (a divergence is a contract violation).
- The helper is **pure**: a deterministic function of exactly `G.cardTraits[id].heroClass` and
  `G.cardSizeChangingClasses[id]`; no mutation, no caching/memoization, recomputed at each call.
- `'size-changing'` is a `HeroKeyword` recognized at parse time with **no** `onPlay` handler (the
  wall-crawl class): its play-time hook visit classifies not-hollow via `CLASS_GRANT_KEYWORDS` →
  `MVP_KEYWORDS`; the grant is realized at class-read time.
- `G.cardTraits` remains immutable; the grant is an additive second class source, never a rewrite.

---

## Acceptance Criteria

- **AC-1 (recognize):** `HERO_KEYWORDS` is 23 entries incl. `'size-changing'`; both drift tests
  (`heroKeywords.test.ts`, `heroAbility.setup.test.ts`) pass at 23.
- **AC-2 (parse granted class):** `[keyword:Size-Changing] [hc:tech]` resolves to a hook carrying
  `sizeChangingClasses: ['tech']`, produces **no** `heroClassMatch` condition for that token, and
  **no** `unresolvedMarkers` entry / no hollow for that line.
- **AC-3 (parser isolation + graceful empty):** an `[hc:X]` token on a *different* ability line is
  still parsed as an ordinary `heroClassMatch` condition (not a grant); a `[keyword:Size-Changing]`
  line with no following `[hc:X]` parses to `sizeChangingClasses: []` — recognized, no grant, no
  hollow, no throw.
- **AC-4 (hollow cleared):** `antm/jocasta/holographic-image-inducer` no longer fires a
  `size-changing` / `parse-unrecognized` hollow at `onPlay` (its second line still draws 2).
- **AC-5 (helper):** `getGrantedClasses` returns the normalized granted list (`[]` when none);
  `cardHasClassWhenPlayed` returns true for the printed class, true for a granted class, and true for
  **both** when printed ≠ granted (dual-class); false otherwise. Pure, reads only `cardTraits` +
  `cardSizeChangingClasses`.
- **AC-6 (heroClassMatch honors grant):** an in-play card whose class comes **only** from
  Size-Changing (null printed class, e.g. `yellowjacket`→instinct) satisfies another card's
  `heroClassMatch` for that class; a dual-class card (`giant-ego` strength+tech) satisfies
  `heroClassMatch` for **either** class. Self-exclusion of the triggering card is preserved.
- **AC-7 (distinctHeroClassesAtLeast honors grant):** a dual-class Size-Changing card in `inPlay`
  contributes **both** its printed and granted classes to the distinct-class count (self-inclusive
  semantics preserved).
- **AC-8 (not-hollow, no handler):** the MVP-coverage test recognizes `'size-changing'` via
  `CLASS_GRANT_KEYWORDS`; there is **no** `HERO_EFFECT_HANDLERS` entry for it (handler count
  unchanged).
- **AC-9 (build/test):** `pnpm --filter @legendary-arena/game-engine build` 0; `test` green
  (≥ baseline + the new cases); `tsc --noEmit` 0; `pnpm -r build` 0.
- **AC-10 (determinism):** `pnpm sim:runtime-observed:check` — the `size-changing` hollow is
  **removed** from the runtime-observed artifact (the mechanic now classifies applied); the artifact
  is regenerated and committed. `finalStateHash`: the grant changes class-condition outcomes, so a
  bot whose play path depends on a class-match may diverge — **the only acceptable cause of a
  `finalStateHash` shift is a changed class-condition outcome from the new grant**; any other cause
  is a FAIL — STOP and investigate, do **not** re-pin. If the shift is grant-attributable, re-pin the
  sentinel and record the divergence as EXPECTED. Confirm empirically.

---

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/game-engine build         # 0
pnpm --filter @legendary-arena/game-engine test          # green; ≥ baseline + new cases
pnpm --filter @legendary-arena/game-engine exec tsc --noEmit  # 0
pnpm ledger:heroes                                       # regenerate; size-changing flips unsupported → executable
pnpm sim:runtime-observed                                # regenerate; size-changing hollow removed
pnpm sim:coverage --check                                # no coverage regression
pnpm -r build                                            # 0
git diff --name-only -- packages/game-engine             # only the ~13 listed files (+ coverage artifacts)
```

---

## Vision Alignment

**Touched surfaces (§17.1):** Card-accurate effect execution (Vision §1, §2) — implements the
printed rulebook keyword faithfully (correcting an earlier fabricated reading); determinism (§3, §8)
— the grant is a pure read over immutable setup data.

**Clause check:** §1/§2 — Size-Changing's class-grant is printed on the physical card; this
implements it exactly (and removes the invented-discount risk). No conflict.

**Conflict assertion:** No conflict.

**Non-Goal proximity:** No NG-1..7 (no monetization, scoring weights, identity, or pay-to-win).

**Determinism preservation:** `cardHasClassWhenPlayed` / `getGrantedClasses` are pure (read
`cardTraits` + `cardSizeChangingClasses`, no RNG, no mutation, no caching). `cardSizeChangingClasses`
is immutable setup data; `cardTraits` is untouched. The only determinism effect is that a
class-condition can now resolve true where it previously resolved false (the grant) — a legitimate,
deterministic rule change; the sentinel re-pins only on that grant-attributable divergence (executor
confirms via `sim:runtime-observed`).

---

## Funding Surface Gate

**N/A** — gameplay-fidelity mechanic; no funding affordance, copy, or channel; no §20.1 surface.

## §21 API Catalog

**N/A** — no `apps/server` HTTP endpoint or `Library-only` function added or modified.

---

## Lint Gate Self-Review

| § | Status | Notes |
|---|---|---|
| §1 Structure | ✅ PASS | All required sections present |
| §2 Constraints | ✅ PASS | Reuse wall-crawl category + the heroClassMatch read; single effective-class helper; cardTraits immutable |
| §3 Assumes | ✅ PASS | Rulebook text cited; immutable cardTraits + the two inPlay reads + load-bearing-grant data evidence with file:line |
| §4 Context | ✅ PASS | Live hollow + correction record (supersedes the discount draft); baseline 1dbea8b6; supersession reconciled |
| §5 Files | ✅ PASS | ~13 files; cohesive single-layer rationale |
| §6 Naming | ✅ PASS | Canonical `[hc:X]` slugs; `sizeChangingClasses` / `cardSizeChangingClasses` consistent |
| §7 Dependencies | ✅ PASS | No new npm deps |
| §8 Boundaries | ✅ PASS | All `packages/game-engine`; no layer crossing |
| §9 Windows | ✅ PASS | `pwsh` verification steps |
| §10 Env Vars | ✅ PASS | None |
| §11 Auth | N/A | No auth surface |
| §12 Tests | ✅ PASS | `node:test`; parser/helper/two-evaluator/drift/hollow coverage incl. dual-class + null-class |
| §13 Verification | ✅ PASS | Exact commands incl. coverage-artifact regen + the sweep |
| §14 AC Quality | ✅ PASS | 10 binary, observable items |
| §15 DoD | ✅ PASS | STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap + coverage artifacts; D-24026 live-verify (class-match in play) |
| §16 Code Style | ✅ PASS | `// why:` on the helper, the grant consult, the keyword category; `for...of`; no `.reduce()` |
| §17 Vision | ✅ PASS | §1/§2/§3/§8 cited; determinism line present |
| §18 Grep/Prose | ✅ PASS | No literal-string grep gate restates a forbidden token in adjacent prose |
| §19 HEAD Staleness | N/A | Not a repo-state-summarizing artifact |
| §20 Funding | ✅ PASS | N/A with justification |
| §21 API Catalog | ✅ PASS | N/A with justification |

**Lint gate verdict: ALL PASS — ready for pre-flight.**

---

## Pre-flight Verdict

**READY TO EXECUTE**

- ✅ Canonical rule confirmed (`keywords-full.json` key `sizechanging`, pdfPage 33): class-grant +
  Attack-as-VP — NOT a recruit discount (the prior draft's error, corrected here)
- ✅ Live hollow confirmed (`antm/jocasta/holographic-image-inducer`, `gitSha 988ad2e`) + ledger/sweep agreement
- ✅ Grant proven load-bearing: null-printed-class + printed≠granted cards exist (`yellowjacket`,
  `goliath`, `giant-ego`, `swarm-tactics`) — recognition-only would mis-count them
- ✅ `cardTraits` immutable + no existing class-overlay confirmed → static second-source design (no mutation, no cleanup)
- ✅ The two inPlay class reads identified (`heroClassMatch`, `distinctHeroClassesAtLeast`); Empowered HQ/top-deck scans correctly unaffected
- ✅ Attack-as-VP correctly deferred (no hero-deck VP scoring exists to attach to)
- ✅ Scope locked: class-grant only; VP + Microscopic + villain + divided-card + UIState display deferred

---

## Copilot Check Verdict

**PASS**

Re-draft against the verified rulebook keyword after the prior draft implemented a fabricated
recruit discount. Mirrors the wall-crawl recognized-keyword-no-onPlay-handler pattern; realizes the
grant as a pure static second class source consulted by the two inPlay class reads (no `cardTraits`
mutation, no per-turn overlay, determinism-clean). Load-bearing risks: (1) the parser mis-treating
the Size-Changing line's `[hc:X]` as a play-condition instead of the granted class — covered by
AC-2/AC-3 (extraction + multi-line isolation tests); (2) one of the two class reads left
un-consulting the helper → silent mis-count — covered by the single-helper contract + AC-6/AC-7;
(3) a determinism shift from the new grant — handled by AC-10's grant-attributable fail-fast. The
Attack-as-VP half is honestly deferred behind a missing subsystem. No new contract beyond the
additive G field + hook field (D-24074).

---

## Definition of Done

- [ ] All 10 Acceptance Criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine test` green (≥ baseline + new cases)
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` 0; `pnpm -r build` 0
- [ ] `pnpm sim:runtime-observed` regenerated (size-changing hollow removed) + `pnpm ledger:heroes` regenerated (size-changing → executable) + `sim:coverage --check` no regression; sentinel re-pinned only on a grant-attributable divergence
- [ ] `docs/ai/STATUS.md` updated with the WP-290 execution summary
- [ ] `docs/ai/DECISIONS.md` — D-24074 flipped to Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-290 checkbox flipped to `[x]`
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-322 flipped to Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-290 node added
- [ ] No files outside `## Files Expected to Change` (+ the regenerated coverage artifacts) modified
- [ ] **User-Visible Surface: play.legendary-arena.com.** D-24026 live-verify (post-deploy): play a
      Size-Changing Hero whose class (printed or granted) another in-hand Hero's ability checks for,
      then confirm that ability now sees the class (e.g. a `[hc:tech]`-gated effect fires after
      playing a Size-Changing `[hc:tech]` Hero such as Holographic Image Inducer).
