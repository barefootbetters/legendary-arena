# WP-680 — Per-count sources for five unmarked core heroes (Game Engine)

**Status:** Draft 2026-09-09 (EC-717; D-24497 reserved)
**Layer:** Game Engine (runtime count sources) + card-data markers
**Hard-deps:** WP-247 (attack-per-count / D-24016) ✅, WP-674 (recruit-per-count family + count-source recipe / D-24489) ✅, WP-675 (count-scaled descriptor precedent / D-24490) ✅

## Goal

Light up five printed abilities on three core heroes that do nothing today — they carry no
`[keyword]` markers, so the engine runs no effect — by registering the count sources they
need and feeding the **already-shipped** `attack-per-count` / `recruit-per-count` grant
family. No new grant mechanism is built; this WP adds the missing *count sources* and the
card-data markers that reference them. The five cards:

| Card | Hero | Printed effect | Source | Grant |
|---|---|---|---|---|
| Perfect Teamwork | Captain America | +1 attack for each color of Hero you have | `distinct-hero-classes-played-this-turn` | attack-per-count |
| Avengers Assemble! | Captain America | +1 recruit for each color of Hero you have | `distinct-hero-classes-played-this-turn` | recruit-per-count |
| A Day Unlike Any Other | Captain America | `[team:avengers]:` +3 attack for each other Avenger played this turn | `avengers-played-this-turn` | attack-per-count (mag 3) |
| Legendary Commander | Nick Fury | +1 attack for each other S.H.I.E.L.D. Hero played this turn | `shield-heroes-played-this-turn` | attack-per-count |
| Oddball | Deadpool | +1 attack for each other Hero with an odd-numbered **cost** played this turn | `odd-cost-heroes-played-this-turn` | attack-per-count |

## User-Visible Impact

Five previously-inert core-hero abilities begin resolving faithfully: Captain America's
two "for each color" cards and his Avengers finisher, Nick Fury's S.H.I.E.L.D. finisher,
and Deadpool's Oddball. Validated by unit tests (each resolver + each card's grant) and by
`sim:runtime-observed` once the markers ship.

## Assumes

- `G.cardTraits[id].heroClass` and `.team` are populated at setup for every card and are
  part of `G` (hashed) — confirmed at HEAD (`state/cardTraits.types.ts`,
  `types.ts:cardTraits`). The class/team sources read these; **no new `G` field is added**.
- `G.cardStats[id].cost` is the per-card printed cost the `odd-cost` source reads
  (`economy/economy.types.ts CardStatEntry.cost`) — the `cost-four-plus-played-this-turn`
  source is the precedent (`hero/heroCountSource.resolve.ts`).
- The distinct-Hero-Class **counting rule already exists** as the D-24055
  `distinctHeroClassesAtLeast` condition (`hero/heroConditions.evaluate.ts`): distinct
  non-null `heroClass` across `inPlay`, **self-inclusive**, Size-Changing counts as **each**
  granted class (`getGrantedClasses`, D-24074), Copy-Powers-granted classes extend the set.
  This WP reuses that counting logic for the new source — it does not re-derive it.
- The `[team:avengers]:` synergy prefix on A Day Unlike Any Other is the existing
  `requiresTeam` gate (`heroConditions.evaluate.ts`, self-exclusive; honors Copy-Powers
  teams per D-24391). This WP does not re-implement the gate; the marker composes the
  existing gate with the new count-scaled grant.
- Card data is GENERATED; markers are authored via the hero-ability-markers source + the
  multi-stage regen (`docs/03-DATA-PIPELINE.md §1`), never hand-edited in `data/cards/`.

## Design Rationale (three load-bearing decisions)

### 1. Four new count sources — all read already-hashed `G`, so NO hash re-pin

Unlike WP-675/WP-677 (which added hashed `CardStatEntry` booleans and paid a dual hash
re-pin), every source here reads state that is **already** in `G` and already hashed:

- `distinct-hero-classes-played-this-turn` — count of distinct non-null
  `G.cardTraits[id].heroClass` among `G.playerZones[pid].inPlay`, **self-inclusive** (the
  triggering card's own color counts — "each color of Hero **you have**"), Size-Changing
  contributing each granted class per the D-24055 helper. This is the ONE source that
  ignores `triggeringCardId` (like `shield-levels`); the others self-exclude.
- `avengers-played-this-turn` / `shield-heroes-played-this-turn` — count of **other**
  `inPlay` cards whose `G.cardTraits[id].team` equals `avengers` / `shield` (self-exclusive
  via `triggeringCardId`, the `worthy-cards` precedent).
- `odd-cost-heroes-played-this-turn` — count of **other** `inPlay` cards whose
  `G.cardStats[id].cost` is odd (`cost % 2 === 1`); a card with no `cardStats` row (token)
  is cost 0 (even) and never counts.

Because no new hashed field is introduced, **no *setup-state* hash re-pin is expected** (unlike
the WP-675/677 boolean adds) — a deliberately cheaper WP. This is an **empirical** claim, not an
a-priori guarantee: `computeStateHash` hashes the whole state, so a pinned *complete-game*
fixture that actually plays one of these five previously-inert cards would shift **that
fixture's** outcome hash (the card now grants attack/recruit it didn't before). The check is
therefore: confirm the derived-feed regen produces no `cardStats`/`cardTraits` shape diff, and
re-pin only a complete-game fixture whose *play* legitimately changed — never to mask an
unrelated shift. Most core sentinels play none of these cards, so a re-pin is likely zero.

**Reuse note (RS-2):** the distinct-Hero-Class counting lives today as the module-private
`countDistinctHeroClassesInPlay(G, playerID)` in `hero/heroConditions.evaluate.ts` (lines ~383).
The resolver in `hero/heroCountSource.resolve.ts` should **export and call it** (preferred) or
duplicate the ~10-line loop per the duplicate-first rule — it is not a single importable function
across the two modules today.

### 2. Per-team slugs, not a parameterized team source (scope discipline)

"For each other [team] played this turn" appears on three teams across the corpus
(avengers — A Day; shield — Legendary Commander; x-men — the unimplemented **X-Men United**,
core id 3). This WP adds **two dedicated per-team slugs** (`avengers-played-this-turn`,
`shield-heroes-played-this-turn`) for the two teams its cards need — mirroring the WP-675
two-slug icon-source precedent — rather than generalizing the count-scaled descriptor with
a `team` parameter. Per-team slugs are additive, fit the locked
`(attack|recruit)-per-count:<source>:N` marker grammar with no gate widening, and keep this
WP single-purpose. **X-Men United is explicitly out of scope**; it is a natural follow-on
that this recipe unblocks (add `x-men-played-this-turn` the same way, or generalize then).

### 3. Oddball prints `[icon:vp]` but scales by odd COST — a card-data fidelity fix

The generated `core.json` text for Oddball reads "each other Hero with an odd-numbered
`[icon:vp]`", but **hero cards carry no victory-point value in the data model** (no `vp`
field on hero cards; the VP glyph appears only in villain/scheme card *text*), and the
standard Legendary ruling for Oddball is odd-numbered **cost**. Building "odd VP" faithfully
is impossible (no per-hero VP exists to read) and would misrepresent the card. This WP
therefore implements Oddball as `odd-cost-heroes-played-this-turn` (reads the existing
`cardStats.cost`) and **corrects the upstream card text** `[icon:vp]` → odd-numbered cost
via the convert-cards overlay/patch, regenerating `data/cards/core.json`.

**Ruling CONFIRMED (Jeff, 2026-09-09):** odd-**cost** is correct — author the
`odd-cost-heroes-played-this-turn` source and correct the upstream `[icon:vp]`→odd-cost card
text. This is now a locked decision, not an open question; the defer-to-VP fallback is retired
(hero cards carry no VP to read, and the physical card scales by cost).

## Scope (In)

- `HERO_COUNT_SOURCES` gains four values: `distinct-hero-classes-played-this-turn`,
  `avengers-played-this-turn`, `shield-heroes-played-this-turn`,
  `odd-cost-heroes-played-this-turn` (union + array in lockstep; drift pin bumped as a
  RUNTIME assertion per D-24372).
- `hero/heroCountSource.resolve.ts` — four resolver branches (distinct-class self-inclusive
  reusing the D-24055 counting helper; two team branches self-exclusive; odd-cost
  self-exclusive).
- Card-data markers for the five cards via the hero-ability-markers source + full regen;
  Oddball's upstream `[icon:vp]`→odd-cost text correction.
- `mechanic-provenance.json`: no new mechanic key (count-**source** slugs are not recorded
  there — the WP-674/675/677 convention); coverage rides source registration +
  `sim:runtime-observed`.
- Tests: each resolver (self-inclusive vs self-exclusive, Size-Changing for distinct-class,
  odd/even cost boundary, empty/absent `cardStats`), each card's grant end-to-end (mag 1 and
  mag 3), the `[team:avengers]:` gate composing with the count for A Day Unlike Any Other,
  drift pin.

## Out of Scope

- X-Men United (core id 3) and any other team-scaled card — the recipe unblocks them but no
  marker is authored here.
- A parameterized/generic team count source (deferred; per-team slugs chosen — Rationale 2).
- Any new grant mechanism — `attack-per-count` / `recruit-per-count` ship already.
- The four Captain America / Deadpool / Nick Fury abilities handled by WP-681 / WP-682 /
  WP-683 (High-Tech Weaponry, Do-Over, Battlefield Promotion, Diving Block, Pure Fury,
  Here Hold This, Random Acts).
- Any new hashed `G` field or hash re-pin.

## Files Expected to Change

See EC-717 §Files to Produce (authoritative allowlist). Primarily: `rules/heroCountSource.ts`
(four slugs, union + array + drift pin), `hero/heroCountSource.resolve.ts` (+ its test) with the
four resolver branches (exporting/reusing `countDistinctHeroClassesInPlay`),
`hero/heroConditions.evaluate.ts` (export the distinct-class helper), the card-data generator
inputs (five markers + the Oddball `[icon:vp]`→cost overlay) + regenerated `data/cards/core.json`
+ all derived feeds. No arena-client change (no UI), no new hashed field, no
`mechanic-provenance.json` row.

## Non-Negotiable Constraints

- `HERO_COUNT_SOURCES` union + array updated together; drift pin a RUNTIME assertion, not a
  bare `satisfies` (D-24372).
- Resolvers pure/total: read only `G`, never mutate, never throw, no registry read; unknown
  source → 0 (the shipped default branch).
- `distinct-hero-classes-played-this-turn` is **self-inclusive** and reuses the D-24055
  counting (incl. `getGrantedClasses`); it must NOT be a fresh, divergent count.
- Team / odd-cost sources are **self-exclusive** (thread `triggeringCardId`).
- Card markers authored via the generator + regen, never by editing `data/cards/` directly;
  card-data derived CI feeds all regenerated in the same commit.

## Contract

- `resolveCountSource(G, p, 'distinct-hero-classes-played-this-turn')` = count of distinct
  non-null hero classes among player `p`'s `inPlay` (self-inclusive; Size-Changing counts as
  each granted class).
- `resolveCountSource(G, p, 'avengers-played-this-turn', trig)` /
  `'shield-heroes-played-this-turn'` = count of **other** `inPlay` cards with
  `cardTraits.team === 'avengers'` / `'shield'`.
- `resolveCountSource(G, p, 'odd-cost-heroes-played-this-turn', trig)` = count of **other**
  `inPlay` cards with odd `cardStats.cost`.
- Markers: Perfect Teamwork `[keyword:attack-per-count:distinct-hero-classes-played-this-turn:1]`;
  Avengers Assemble `[keyword:recruit-per-count:distinct-hero-classes-played-this-turn:1]`;
  A Day Unlike Any Other (`[team:avengers]:` gate) `[keyword:attack-per-count:avengers-played-this-turn:3]`;
  Legendary Commander `[keyword:attack-per-count:shield-heroes-played-this-turn:1]`;
  Oddball `[keyword:attack-per-count:odd-cost-heroes-played-this-turn:1]`. (Exact token forms
  confirmed against the parser at execution.)

## Vision Alignment

- §1 Rules Authenticity — each ability is counted exactly as the rulebook defines "color",
  "each other [team]", and (Oddball) odd cost; the `[icon:vp]` text error is corrected.
- §3 Player Trust & Fairness — deterministic, replay-faithful; the sources read state and
  never consume it.

## Acceptance Criteria

- Each of the five cards, played into a constructed `inPlay`, grants the correct
  attack/recruit (distinct-class self-inclusive; team/odd-cost self-exclusive; A Day gated by
  a second Avenger present).
- `distinct-hero-classes-played-this-turn` counts a Size-Changing card as each granted class
  and ignores no-class cards (Officers/Sidekicks/Wounds).
- `odd-cost-heroes-played-this-turn` counts odd-cost heroes only; a 0-cost basic never counts.
- Oddball's regenerated `core.json` text no longer prints `[icon:vp]` for the count.
- Engine suite green; `pnpm -r build` 0; `pnpm cards:check` reproducible; all card-data
  derived feeds regenerated; **no hash re-pin** (confirm no `cardStats`/`cardTraits` diff).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — four resolvers, five grants, gate
   composition, drift pin green.
2. `pnpm -r build` exits 0.
3. `pnpm cards:check` reproducible; `ledger:heroes:check` + `mechanics:metadata:check` +
   `effect-index:check` + `sim:runtime-observed:check` regenerated + green; `sim:coverage
   --check` OK (new-source warnings acceptable until card-observed; floor not regressed).
4. Confirm `git status` shows no state-hash fixture churn (no re-pin expected).

## Definition of Done

Engine suite green, `pnpm -r build` 0, `cards:check` reproducible, five markers live + all
derived feeds regenerated, D-24497 Active, WORK_INDEX + EC_INDEX rows flipped, roadmap
mindmap node flipped, PR squash-merged. The three unmarked heroes each drop by the cards
this WP covers (Cap 2/4 remaining, Deadpool 1/4, Nick Fury 1/4 — the arc's other WPs cover
the rest).

## Reserved Decision (lands at execution)

D-24497 — four per-count sources (`distinct-hero-classes-played-this-turn`,
`avengers-played-this-turn`, `shield-heroes-played-this-turn`,
`odd-cost-heroes-played-this-turn`) reusing the shipped attack/recruit-per-count family; no
new hashed field; Oddball `[icon:vp]`→odd-cost card-text fidelity fix. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

Locked values (four source slugs; distinct-class self-inclusive vs team/odd-cost
self-exclusive; drift pin RUNTIME; no hash re-pin) stated, not re-derived. Canonical-array
change updates BOTH union and array. Single layer (Game Engine) + generated card data; no
layer inversion. Determinism: no new hashed field → no re-pin (asserted, with a
no-`cardStats`-diff guard). Card data regenerated via the generator, never hand-edited; all
five derived CI feeds regenerated in-commit (card-data-derived-CI-gates). Tests specified
per resolver + per card + gate composition + drift. §21 API catalog: N/A (no HTTP/library
surface). §20 funding: N/A. §1: Files Expected to Change present; Context carried by Goal +
Assumes + Design Rationale. §17.2 Non-Goal proximity: no pay-to-win / no client authority;
determinism preserved. Oddball odd-cost ruling confirmed by Jeff
(2026-09-09) — no longer an open decision. All applicable items satisfied or explicitly N/A.
