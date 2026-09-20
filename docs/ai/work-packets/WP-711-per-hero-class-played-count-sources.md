# WP-711 — Per-hero-class-played count sources (Game Engine + card-data)

**Status:** Draft 2026-09-19 (EC-748; D-24534 reserved)
**Layer:** Game Engine (runtime count sources) + card-data markers
**Hard-deps:** WP-247 (attack-per-count / D-24016) ✅, WP-674 (recruit-per-count family + count-source recipe / D-24489) ✅, WP-680 (per-team/per-class count-source recipe + `cardHasClassWhenPlayed` reuse / D-24497) ✅
**Baseline:** `origin/main` @ 67299144 (2026-09-19)

## Goal

Six printed hero abilities across four sets scale "+N for each other **[hero class]** Hero
you played this turn" but do nothing of the sort today: they carry no
`[keyword:attack-per-count:…]` / `[keyword:recruit-per-count:…]` marker, so the parser reads
the co-located `[hc:X]` count criterion as a **second** `heroClassMatch` gate and promotes the
printed `+N[icon:…]` to a **flat** grant — a flat +N gated on "have another Hero of that
class", never scaling. This WP registers the **per-hero-class-played** count sources these
lines need — the hero-class analogue of the WP-680 `avengers-played-this-turn` /
`shield-heroes-played-this-turn` team sources — and authors the markers that feed the
**already-shipped** `attack-per-count` / `recruit-per-count` grant family. No new grant
mechanism is built. The six lines:

| Set | Card | Printed effect | Source | Grant |
|---|---|---|---|---|
| ssw1 | Marvelous Strength (Captain Marvel) | `[hc:strength]:` +1 attack for each other Strength Hero played this turn | `strength-heroes-played-this-turn` | attack-per-count (mag 1) |
| ssw1 | Absorb Energies (Captain Marvel) | `[hc:ranged]:` +1 recruit for each other Ranged Hero played this turn | `ranged-heroes-played-this-turn` | recruit-per-count (mag 1) |
| dkcy | (ranged, recruit line) | `[hc:ranged]:` +1 recruit for each other Ranged Hero played this turn | `ranged-heroes-played-this-turn` | recruit-per-count (mag 1) |
| dkcy | (ranged, attack line) | `[hc:ranged]:` +1 attack for each other Ranged Hero played this turn | `ranged-heroes-played-this-turn` | attack-per-count (mag 1) |
| bkwd | (covert line) | `[hc:covert]:` +2 attack for each other Covert Hero played this turn | `covert-heroes-played-this-turn` | attack-per-count (mag 2) |
| co2e | (tech line) | `[hc:tech]:` +1 attack for each other Tech Hero played this turn | `tech-heroes-played-this-turn` | attack-per-count (mag 1) |

## User-Visible Impact

Six previously-flat hero abilities begin scaling faithfully: Captain Marvel's Marvelous
Strength and Absorb Energies stop granting a flat +1 (the observed 2p Red Skull symptom) and
grant +1 per other Strength / Ranged Hero played this turn; the dkcy ranged pair, the bkwd
covert line, and the co2e tech line likewise scale. Validated by unit tests (each resolver +
each card's grant) and by `sim:runtime-observed` once the markers ship.

## Assumes

- `G.cardTraits[id].heroClass` / `.heroClass2` are populated at setup for every card and are
  part of `G` (hashed) — confirmed at HEAD (`state/cardTraits.types.ts`, `types.ts:cardTraits`).
  The new sources read these; **no new `G` field is added**.
- The class-membership test **already exists** as `cardHasClassWhenPlayed(G, id, class)`
  (`hero/sizeChanging.logic.ts:62`): a card has class `C` iff its printed `heroClass` OR
  `heroClass2` equals `C` (D-24523 dual-class) OR `C` is a Size-Changing granted class
  (D-24074). This WP reuses that helper for the new sources — it does not re-derive class
  membership. It is the class analogue of `cardCountsAsTeamMember`, which the WP-680 team
  sources use.
- The `attack-per-count` / `recruit-per-count` grant family, the `COUNT_SCALED_PATTERN` /
  `RECRUIT_COUNT_SCALED_PATTERN` extraction (Steps 2d / 2d'), and the Step-4 printed-icon
  suppression that drops the flat `[icon:attack]` / `[icon:recruit]` when the count-scaled
  keyword is present (D-24016 / D-24489) all ship at HEAD (`setup/heroAbility.setup.ts`).
- The `[hc:X]:` synergy prefix on each line is the existing `heroClassMatch` gate; it stays.
  The **inline** `[hc:X]` count criterion currently emits a *second* `heroClassMatch` of the
  same class — a duplicate that collapses to one gate — exactly as Legendary Commander's
  inline `[team:shield]` emits one `requiresTeam:shield` today (accepted, shipped behavior).
- Card data is GENERATED; markers are authored via the hero-ability-markers source + the
  multi-stage regen (`docs/03-DATA-PIPELINE.md §1`), never hand-edited in `data/cards/`. The
  apply script's `VALID_TOKEN_PATTERN` already admits the `(attack|recruit)-per-count:<source>:N`
  token shape (source membership is enforced by the engine's `isValidHeroCountSource`), so
  **no apply-script change** is required.

## Design Rationale (three load-bearing decisions)

### 1. A per-hero-class-played family, mirroring the team sources — reads already-hashed `G`

WP-680 added `avengers-played-this-turn` / `shield-heroes-played-this-turn` as **per-team**
slugs. This WP adds the **per-hero-class** analogue for the classes real cards need:

- `strength-heroes-played-this-turn`, `ranged-heroes-played-this-turn`,
  `tech-heroes-played-this-turn`, `covert-heroes-played-this-turn` — count of **other**
  `inPlay` cards for which `cardHasClassWhenPlayed(G, id, <class>)` is true (self-exclusive via
  `triggeringCardId`, the `worthy-cards` / team-source precedent). "Played this turn" is the
  play-area, order-dependent reading — **not** the hand+play "Heroes you have" term of art of
  `distinct-hero-classes-played-this-turn` (D-24529). Each reads `G.cardTraits` +
  Size-Changing granted classes — state already in `G` and already hashed. **No new hashed
  field is introduced.**

Because no new hashed field is added, no *setup-state* hash re-pin is expected. This is an
**empirical** claim, not an a-priori guarantee: `computeStateHash` hashes the whole state, so
a pinned *complete-game* fixture that actually plays one of these six previously-flat cards
shifts **that fixture's** outcome hash (the card now grants scaled attack/recruit it didn't
before — and, on ssw1, the flat +1 it used to grant disappears). The check at execution is:
confirm the derived-feed regen produces no `cardStats`/`cardTraits` shape diff, and re-pin only
a complete-game fixture whose *play* legitimately changed — never to mask an unrelated shift.
Most sentinels play none of these cards, so a re-pin is likely zero.

### 2. Four classes, not all five — taxonomy discipline

The corpus grep (`for each other [hc:X] Hero … played this turn` with no per-count marker)
returns exactly six lines across four classes: strength, ranged, tech, covert. **`instinct`
has no card in this shape**, so no `instinct-heroes-played-this-turn` source is added. Sources
are added when a card needs them (the WP-680 per-team precedent — x-men was left out for the
same reason). A fifth class is one additive slug + one resolver branch away if a future card
needs it.

### 3. No new parser suppression — the marker + printed icon is the shipped pattern

Each line carries the printed `+N[icon:attack|recruit]` AND (after backfill) the count-scaled
marker on the same line. That is exactly the D-24016 / D-24489 shape: the existing Step-4
suppression drops the flat `attack` / `recruit` keyword + magnitude once the `attack-per-count`
/ `recruit-per-count` keyword is emitted, so there is **no double-count** and **no new parser
code**. The inline `[hc:X]` count criterion still emits a duplicate `heroClassMatch` gate
(same class as the leading prefix), which collapses to the one strength/ranged/tech/covert
synergy gate the card already prints — parity with Legendary Commander's accepted inline
`[team:shield]` gate. Suppressing the inline token is **out of scope** (a separate, corpus-wide
cleanup if ever wanted); it changes no outcome here.

## Scope (In)

- `HERO_COUNT_SOURCES` gains four values: `strength-heroes-played-this-turn`,
  `ranged-heroes-played-this-turn`, `tech-heroes-played-this-turn`,
  `covert-heroes-played-this-turn` (union + array in lockstep; drift pin bumped from 10 → 14
  as a RUNTIME assertion per D-24372).
- `hero/heroCountSource.resolve.ts` — one shared `countHeroClassCardsPlayedThisTurn(G, p,
  trig, class)` helper (self-exclusive, `cardHasClassWhenPlayed`), four `resolveCountSource`
  branches, and four `explainCountSourceInputs` branches (a shared
  `collectHeroClassCardsPlayedThisTurn` collector mirroring the team collector).
- Card-data markers for the six lines via the hero-ability-markers source + full regen of
  `data/cards/{ssw1,dkcy,bkwd,co2e}.json` and all derived feeds.
- Tests: the new helper (self-exclusive; hc2 dual-class; Size-Changing granted class; absent
  `cardTraits`), each of the four resolver branches, each card's grant end-to-end (mag 1 and
  mag 2), the explain-inputs parity (`count === length`), and the drift pin (14 entries).

## Out of Scope

- `instinct-heroes-played-this-turn` — no card needs it (Rationale 2).
- A parameterized/generic class count source — per-class slugs chosen, matching the WP-680
  per-team precedent.
- Suppressing the inline `[hc:X]` count-criterion gate (Rationale 3) — a separate corpus-wide
  cleanup; outcome-neutral here.
- Any new grant mechanism — `attack-per-count` / `recruit-per-count` ship already.
- Any apply-script change — `VALID_TOKEN_PATTERN` already admits the token shape.
- Any new hashed `G` field.
- The `distinct-hero-classes-played-this-turn` "Heroes you have" hand+play family (WP-680 /
  D-24529) — a different reading; these six lines are play-area "played this turn".

## Files Expected to Change

See EC-748 §Files to Produce (authoritative allowlist). Primarily:
`packages/game-engine/src/rules/heroCountSource.ts` (four slugs, union + array + drift pin),
`packages/game-engine/src/hero/heroCountSource.resolve.ts` (+ its `.test.ts`) with the shared
class helper, four resolver branches, four explain branches; the card-data generator input
`scripts/convert-cards/inputs/hero-ability-markers.json` (six markers) + regenerated
`data/cards/{ssw1,dkcy,bkwd,co2e}.json` + all derived feeds regenerated in the same commit. No
arena-client change (no UI), no new hashed field, no parser change, no apply-script change.

## Non-Negotiable Constraints

- `HERO_COUNT_SOURCES` union + array updated together; drift pin a RUNTIME assertion (14
  entries), not a bare `satisfies` (D-24372).
- Resolvers pure/total: read only `G`, never mutate, never throw, no registry read; unknown
  source → 0 (the shipped default branch).
- The four class sources are **self-exclusive** (thread `triggeringCardId`) and reuse
  `cardHasClassWhenPlayed` (hc2 + Size-Changing granted classes) — no fresh, divergent
  class-match loop.
- `explainCountSourceInputs` mirrors each resolver branch (`count === length`, self-exclusive)
  — the diagnostics-only path never alters the gameplay count (WP-706 invariant).
- Card markers authored via the generator + regen, never by editing `data/cards/` directly;
  all card-data derived CI feeds regenerated in the same commit.
- No new parser suppression; the existing D-24016 / D-24489 icon suppression handles the
  double-count.

## Contract

- `resolveCountSource(G, p, 'strength-heroes-played-this-turn', trig)` (and `ranged-` /
  `tech-` / `covert-`) = count of **other** `inPlay` cards for which
  `cardHasClassWhenPlayed(G, id, <class>)` is true.
- `explainCountSourceInputs(G, p, '<class>-heroes-played-this-turn', trig)` = the ext_ids of
  those same other cards (`count === length`).
- Markers (exact token forms confirmed against the parser at execution):
  - Marvelous Strength `[keyword:attack-per-count:strength-heroes-played-this-turn:1]`
  - Absorb Energies `[keyword:recruit-per-count:ranged-heroes-played-this-turn:1]`
  - dkcy ranged-recruit line `[keyword:recruit-per-count:ranged-heroes-played-this-turn:1]`
  - dkcy ranged-attack line `[keyword:attack-per-count:ranged-heroes-played-this-turn:1]`
  - bkwd covert line `[keyword:attack-per-count:covert-heroes-played-this-turn:2]`
  - co2e tech line `[keyword:attack-per-count:tech-heroes-played-this-turn:1]`

## Vision Alignment

- §1 Rules Authenticity — each ability now scales exactly as the rulebook defines "+N for each
  other [class] Hero you played this turn"; the flat-grant misparse is corrected.
- §3 Player Trust & Fairness — deterministic, replay-faithful; the sources read state and never
  consume it. Off-ranking (no scoring surface touched).

## Acceptance Criteria

- Each of the six cards, played into a constructed `inPlay`, grants the correct scaled
  attack/recruit (self-exclusive; +2 for bkwd) and no longer a flat +N.
- The class helper counts a dual-class (hc2) card and a Size-Changing granted class, and
  ignores no-class cards (Officers/Sidekicks/Wounds).
- `explainCountSourceInputs` returns exactly the counted ext_ids for each class source
  (`count === length`).
- Drift pin asserts 14 entries; union ↔ array parity holds.
- Engine suite green; `pnpm -r build` 0; `pnpm cards:check` reproducible; all card-data
  derived feeds regenerated; no hash re-pin unless a complete-game fixture legitimately plays
  one of these cards (empirical; re-record honestly if so).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — class helper, four resolvers, six
   grants, explain parity, drift pin green.
2. `pnpm --filter @legendary-arena/game-engine typecheck:tests` (D-24372, informational — not
   a required CI gate; fix any surfaced error in the test file, never widen a type).
3. `pnpm -r build` exits 0.
4. `pnpm cards:check` reproducible; `ledger:heroes:check` + `mechanics:metadata:check` +
   `effect-index:check` + `sim:runtime-observed:check` regenerated + green; `sim:coverage
   --check` OK (new-source warnings acceptable until card-observed; floor not regressed).
5. Confirm `git status` shows no unexpected state-hash fixture churn; re-pin only a
   complete-game fixture whose play legitimately changed, and say so.

## Definition of Done

Engine suite green, `pnpm -r build` 0, `cards:check` reproducible, six markers live + all
derived feeds regenerated, D-24534 Active, WORK_INDEX + EC_INDEX rows flipped, roadmap mindmap
node flipped, PR squash-merged. Marvelous Strength / Absorb Energies (ssw1), the dkcy ranged
pair, the bkwd covert line, and the co2e tech line each scale per other Hero of the class.

## Reserved Decision (lands at execution)

D-24534 — per-hero-class-played count-source family (`strength-` / `ranged-` / `tech-` /
`covert-heroes-played-this-turn`) reusing the shipped attack/recruit-per-count grant family and
`cardHasClassWhenPlayed`; self-exclusive, play-area "played this turn"; four classes only
(instinct unneeded); no new hashed field; six card-data marker backfills; existing D-24016 /
D-24489 icon suppression, no new parser suppression. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

Locked values (four source slugs; self-exclusive; `cardHasClassWhenPlayed` reuse; mags 1/1/1/1/2/1;
drift pin 14 RUNTIME; no hash re-pin absent a fixture play) stated, not re-derived.
Canonical-array change updates BOTH union and array. Single layer (Game Engine) + generated
card data; no layer inversion. Determinism: no new hashed field → no re-pin (asserted, with a
no-`cardStats`/`cardTraits`-diff guard; fixture re-record honest if a play changed). Card data
regenerated via the generator, never hand-edited; all derived CI feeds regenerated in-commit
(card-data-derived-CI-gates). Tests specified per helper + per resolver + per grant + explain
parity + drift. §21 API catalog: N/A (no HTTP/library surface). §20 funding: N/A. §1: Files
Expected to Change present; Context carried by Goal + Assumes + Design Rationale. §17.2
Non-Goal proximity: no pay-to-win / no client authority; determinism preserved. All applicable
items satisfied or explicitly N/A.
