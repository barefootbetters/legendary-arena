# WP-703 — Dual-class hero cards: engine counts a card as either printed class

**Status:** Draft (reserved WP-703 / EC-740 / D-24523). Not blocked —
D-24522 (`hc2` data + registry/viewer consumption) is on `main`.
**Baseline:** `origin/main` @ `ee9b71a4` (D-24522 merged).
**Layer:** Game Engine (single layer).

> **Draft note (gate-corrected).** The first draft assumed a *new*
> `cardHasClassWhenPlayed` helper and cited D-24065 as a global single-class MVP.
> The pre-flight + copilot gates found both wrong: the helper **already exists**
> (`sizeChanging.logic.ts:62`, D-24074) and D-24065 is the *deck-peek* mechanic
> whose single-class note is scoped to one evaluator. This body is rebuilt against
> the verified engine surface (grep-confirmed 2026-09-16).

## Goal

Make the game engine treat a **dual-class hero card** (printed `hc` **and**
`hc2`) as belonging to **both** printed hero classes at every site that tests or
counts hero class. Today only the first printed class (`hc`) is read, so a
`[hc:X]` synergy gate, a class count, a "defeat a [class] Hero" requirement, or
tech-VP scoring silently ignores a card whose *second* class is `X`. After this
WP, Ruby Summers' "Heir to Legends" (Strength **+** Ranged) satisfies a Ranged
test exactly as it satisfies a Strength test.

## User-Visible Impact

In a real match, any hero-class synergy fires correctly on the 54 dual-class
cards (ssw1 / ssw2 / msis / bkpt). Before this WP those effects under-count or
refuse on the second class — a fidelity bug.

## Assumes

- **D-24522 (Active, on `main`):** card data carries additive-optional `hc2`, and
  both card schemas preserve it, so the engine's registry input exposes
  `card.hc2`. — `DECISIONS.md` D-24522; `packages/registry/src/schema.ts:73`.
- **D-24074 (Active) — the class multi-value precedent:** a played card already
  counts as more than one class. `cardHasClassWhenPlayed(G, cardId, classSlug)`
  (`packages/game-engine/src/hero/sizeChanging.logic.ts:62`) returns true for the
  printed `heroClass` **or** any Size-Changing granted class, and
  `heroConditions.evaluate.ts` already routes `heroClassMatch` (`:65`) and
  `distinctHeroClassesAtLeast` (`:160-167`, mirror `:405-415`) through the
  printed-plus-granted model. This WP **adds `hc2` as a second printed class**
  inside that existing model. — `DECISIONS.md` D-24074.
- **WP-179 cardTraits model:** `buildCardTraits.ts` resolves `{ heroClass, team }`
  per card at setup (reads `card.hc` at `:199/:211`, writes at `:206/:215`). The
  entry type is the **contract file** `packages/game-engine/src/state/cardTraits.types.ts`
  (`interface CardTraitEntry { heroClass: string | null; team: string | null }`,
  `:19`) — a `.types.ts` contract-file edit, gated by D-24523 (code-style.md
  "Contract Files"). — `state/cardTraits.types.ts:19`.

## Context (Read First)

Dual-class was cut at the data layer, not deliberately at gameplay: D-24522
restored the `hc2` data + the viewer filter but left the engine reading only
`hc`, carrying zero determinism impact. This WP is the engine half. It is a
gameplay/determinism change (it changes which `[hc:X]` effects fire and what
tech-VP scores), so it travels as a full WP with an honest hash/PAR re-pin.

The class surface is **not** three sites — grep found eleven direct
`traitEntry.heroClass === …` reads plus two set-enumeration sites and one
bucketing site. Two of them (`heroClassMatch`, `distinctHeroClassesAtLeast`) are
already routed through the D-24074 printed-plus-granted model; the rest read the
single printed class directly. The design keeps D-24074's granted-class scoping
exactly as-is and adds **only** the second printed class everywhere.

## Scope (In)

1. **`state/cardTraits.types.ts` + `buildCardTraits.ts`** — add
   `heroClass2?: string | null` to the `CardTraitEntry` contract type (matching
   the sibling `heroClass: string | null`; a contract-file edit gated by D-24523),
   then in `buildCardTraits.ts` read `card.hc2` alongside `card.hc` and write
   `heroClass2` on the trait entry **omitted entirely when the card has no `hc2`**
   (single-class entries serialize byte-identically).
2. **Extend the existing helper — do NOT create a new one.**
   `cardHasClassWhenPlayed(G, cardId, classSlug)` at `sizeChanging.logic.ts:68`:
   add `|| traitEntry.heroClass2 === classSlug` to the **printed** branch. Every
   current caller (`heroClassMatch` at `heroConditions.evaluate.ts:65`) then gets
   dual-class for free; the granted-class loop is untouched.
3. **Set-enumeration sites** — `distinctHeroClassesAtLeast`
   (`heroConditions.evaluate.ts:163` and mirror `:411`): add `heroClass2` to the
   `distinctClasses` set next to the existing `heroClass` add, so a dual-class card
   contributes **both** printed classes (the granted-class loop already there is
   untouched).
4. **Direct-read class-membership sites** — add `|| …heroClass2 === <value>`
   to each (printed-only, mirroring the printed check; NOT newly routed through the
   helper, to leave D-24074 granted-class scoping unchanged). Both the plain
   `=== value` sites and the **variable-indirection** sites (a `traitValue = …
   heroClass …; if (traitValue === value)` shape the `\.heroClass ===` grep does
   NOT see):
   - `moves/giveHqHeroChoice.resolve.ts:92` (HQ hero class filter)
   - `moves/villainDefeatRequirement.logic.ts:71` (`hero-class` "defeat a [class] Hero")
   - `rules/tacticHandlers.ts:780` (tactic class filter)
   - `villain/villainEffects.execute.ts:1479` (villain-effect class match)
   - `rules/schemeTwistResolvers.ts:133` (**variable-indirection** — the
     `traitValue` compare for the "reveal a [class] Hero or penalty" twist)
   - `rules/mastermindHandlers.ts:628` (**variable-indirection** —
     `selectLowestCostHero`'s `traitValue` compare; callers `:472/:852/:908`)
   - `scoring/dynamicVictoryPoints.ts:52` (`heroClass === 'tech'` VP) — **scoring;
     determinism-relevant, see Constraints**
   - **Investigate criterion (three coupled edits):** the matcher
     `rules/heroAbility.types.ts:280` reads `candidate.heroClass2`, so
     `InvestigateCandidate` (`heroAbility.types.ts:219`) MUST gain
     `heroClass2?: string | null` AND its builder
     `hero/heroEffects.execute.ts:3992` MUST populate it from `traits?.heroClass2`
     — the matcher patch is dead without both.
5. **effectPrimitive.interpret.ts count evaluators** — add `hc2` handling:
   - `count-cards-by-class-in-zone` (`:200`): match a card when `heroClass ===
     q || heroClass2 === q`.
   - `max-class-count-in-zone` (`:247`): a dual-class card increments **both** its
     class buckets.
   - `top-deck-card-class-count-in-zone` (`:322/:343`): the revealed card's class
     set is `{heroClass, heroClass2}` (deduped); count HQ cards whose printed class
     is in that set. Relax the `:323` "single-class MVP (D-24065)" note to cite
     **D-24523** — scoped to this evaluator only; D-24065 the decision is NOT
     superseded.
6. **Determinism re-pin (honest)** — regenerate every oracle/fixture/PAR whose
   match includes a dual-class hero (`finalStateHash` sentinels, `PRE_WP080_HASH`
   if affected, the gitignored PAR sweep). Each is a *regeneration of correct new
   behavior*, never an edit-to-pass.
7. **Tests** — dual-class card satisfies a gate on its second class; distinct-class
   counts both; a `count-cards-by-class` / `max-class` / `top-deck-class` case
   counts the second class; tech-VP counts a dual-class tech card; a single-class
   card is unchanged; `buildCardTraits` omits `heroClass2` when `hc2` is absent and
   emits it when present.

## Out of Scope

- **Changing D-24074 granted-class scoping** — sites that don't merge granted
  classes today still won't; this WP adds only the second *printed* class.
- **Copy-Powers / new class-granting mechanics** — only printed `hc2`.
  Copy-Powers copies only the **first** printed class (`heroEffects.execute.ts:3530`
  `copiedClass = …?.heroClass`); left as-is, deferred.
- **Registry / viewer** — shipped by D-24522; no card-data regen here.
- **Triple-class** — no `hc3` exists; the field is single-valued-optional.
- **UIState display projection** — `ui/uiState.build.ts:190`
  (`heroClass = traitEntry.heroClass`) is a `\.heroClass\b` audit hit but a
  **display projection, not a gameplay class-read** (no membership/count/hash/PAR
  effect). Deliberately left single-class: dual-class UI display is the
  registry/viewer's job (the card already carries `hc2` via D-24522), so the client
  shows both classes from card display data, not from this projection. Annotated so
  the `\.heroClass\b` audit terminates cleanly.

## Files Expected to Change

- `packages/game-engine/src/state/cardTraits.types.ts` (**contract file** — add
  `heroClass2?`, gated by D-24523)
- `packages/game-engine/src/setup/buildCardTraits.ts` (+ `.test.ts`)
- `packages/game-engine/src/hero/sizeChanging.logic.ts` (+ `.test.ts`)
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` (+ `.test.ts`)
- `packages/game-engine/src/hero/effectPrimitive.interpret.ts` (+ `.test.ts`)
- `packages/game-engine/src/hero/heroEffects.execute.ts` (Investigate builder `:3992`)
- `packages/game-engine/src/rules/heroAbility.types.ts` (`InvestigateCandidate`
  field `:219` + matcher `:280`)
- `packages/game-engine/src/moves/giveHqHeroChoice.resolve.ts`
- `packages/game-engine/src/moves/villainDefeatRequirement.logic.ts`
- `packages/game-engine/src/rules/tacticHandlers.ts`
- `packages/game-engine/src/rules/schemeTwistResolvers.ts`
- `packages/game-engine/src/rules/mastermindHandlers.ts`
- `packages/game-engine/src/villain/villainEffects.execute.ts`
- `packages/game-engine/src/scoring/dynamicVictoryPoints.ts`
- re-pinned determinism oracle/sentinel fixtures (only matches with a dual-class hero)
- Govern-close: `DECISIONS.md` (land D-24523), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`

## Non-Negotiable Constraints

- **Omit-when-absent (determinism).** `heroClass2` is written only when the card
  has `hc2`; a single-class-only match hashes byte-identically. Prove it with a
  `finalStateHash` sentinel that plays no dual-class hero (unchanged) and a
  runtime keyset assertion that a single-class trait entry has **no** `heroClass2`
  key (not `heroClass2: null`), per D-24372.
- **Second printed class only.** Add `hc2` to the printed checks; never change the
  granted-class (D-24074) merge or which sites consult it.
- **Enumerate the whole reader set.** A `grep "\.heroClass ===" ` audit is
  **insufficient** — value-match sites that read into a variable first
  (`schemeTwistResolvers.ts:133`, `mastermindHandlers.ts:628`) are invisible to it.
  Audit with `grep -rn "\.heroClass\b" packages/game-engine/src` and require every
  value-match / class-membership / enumeration hit to be **either** patched with
  `heroClass2` **or** annotated as consciously single-printed-class (e.g. a write,
  the helper, a comment). No class test silently stays single-printed-class.
- **Scoring is determinism-relevant.** `dynamicVictoryPoints.ts` feeds PAR; a
  dual-class tech card changes scores → honest PAR re-pin, cited.
- **Honest re-pin only** (reward-integrity); `ctx.random.*` only; moves never throw.
- **Drift pins RUNTIME** (D-24372) — none expected (no canonical array changes).

## Contract

- **`CardTraitEntry`** (contract file `state/cardTraits.types.ts:19`) gains
  `heroClass2?: string | null` (matching the sibling `heroClass: string | null`),
  omitted-when-absent at write time. Contract-file edit gated by D-24523.
- **`InvestigateCandidate`** (`heroAbility.types.ts:219`) gains
  `heroClass2?: string | null`, populated by its builder.
- **`cardHasClassWhenPlayed(G, cardId, classSlug)`** — signature **unchanged**;
  its printed branch now also matches `heroClass2`.
- No new helper, no new move/phase/stage/UIState field, no client change (class
  already projects via the registry).

## Vision Alignment

Rules-fidelity to the physical game; no pay-to-win, no monetization, no layer move.

## Funding Surface Gate

N/A — no funding/monetization/checkout surface.

## API Catalog Update

N/A — no `apps/server` endpoint or `Library-only` function changed.

## Acceptance Criteria

- [ ] A dual-class card (`ssw2/ruby-summers` "Heir to Legends", Strength+Ranged)
      satisfies a `heroClassMatch` gate on **Ranged** and on **Strength**.
- [ ] `distinctHeroClassesAtLeast` counts a single dual-class card as **two**
      distinct classes.
- [ ] `count-cards-by-class`, `max-class-count`, and `top-deck-card-class-count`
      each count a dual-class card on its second class.
- [ ] A "defeat a [ranged] Hero" requirement, the HQ class filter, a tactic class
      filter, a villain-effect class match, and the criterion matcher all accept a
      dual-class card on its second class.
- [ ] Tech-VP counts a dual-class tech card.
- [ ] `buildCardTraits` emits `heroClass2` with `hc2`, omits it without.
- [ ] A no-dual-class-hero `finalStateHash` sentinel is **byte-unchanged**;
      dual-class oracles/PAR regenerate with a cited reason.
- [ ] Engine suite green; `pnpm -r build` green; drift/ledger gates green.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build && … test`.
2. Fixed-seed engine test asserting the second-class match at each site class.
3. Omit-when-absent sentinel byte-identical; dual-class oracles reproducible.
4. `grep -rn "\.heroClass ===" packages/game-engine/src` audit (Constraints).
5. D-24026 live-verify (post-deploy): a real match with a dual-class hero shows
   the second-class synergy firing in the log.

## Definition of Done

- [ ] All Acceptance Criteria checked; grep audit clean.
- [ ] Engine tests + `pnpm -r build` green; drift RUNTIME; ledger green.
- [ ] Determinism re-pin honest + documented (which oracles, why).
- [ ] D-24523 landed Active (cites D-24074; scopes the D-24065 deck-peek note).
- [ ] WORK_INDEX / EC_INDEX / mindmap updated; `roadmap:counts:check` 0.
- [ ] D-24026 live-verify recorded.

## Reserved Decision (lands at execution)

**D-24523 — dual-hero-class engine consumption (second printed class).** The
engine reads `hc2` as a second **printed** hero class inside the existing D-24074
printed-plus-granted model: an omit-when-absent `heroClass2` on the cardTraits
entry; the existing `cardHasClassWhenPlayed` printed branch also matches
`heroClass2`; `distinctHeroClasses` adds both printed classes; the direct-read
membership + count + tech-VP sites add `heroClass2`. Builds on **D-24074** (the
class multi-value precedent) and **D-24391** (the team analogue). It does **not**
supersede D-24065; it only relaxes the "single-class" scope note on the deck-peek
class-count evaluator (`effectPrimitive.interpret.ts:323`). Honest determinism
re-pin for matches containing a dual-class hero (incl. tech-VP/PAR). (Reserved in
NUMBER-LEDGER; entry lands when WP-703 executes.)

## Lint Gate Self-Review (00.3)

- Scope closed (In/Out, full reader set enumerated); single layer. ✓
- Dependencies cited + on `main` (D-24522, D-24074, WP-179). ✓
- Contract locked (extend existing helper; inline trait field; no new helper). ✓
- Determinism: omit-when-absent + honest re-pin incl. scoring/PAR. ✓
- Reward integrity: re-pin = regenerate, never edit-to-pass. ✓
- No new contract file / canonical array / move / phase; drift RUNTIME. ✓
- Files allowlist present. Vision / Funding / API Catalog resolved (N/A justified). ✓
- Citation accuracy corrected per gates (D-24074 precedent; D-24065 scoped, not
  superseded). ✓
- All 21 §00.3 items PASS or N/A-justified; no unmet item.
