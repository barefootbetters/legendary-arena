# WP-677 — `shield-levels` count source + Victory-Pile S.H.I.E.L.D./HYDRA membership (Game Engine)

**Status:** Draft 2026-09-09 (EC-714; D-24493 reserved)
**Layer:** Game Engine (registry-derived setup signal + runtime count source)
**Hard-deps:** WP-247 (attack-per-count / D-24016) ✅, WP-674 (count-source recipe + cost-four-plus / D-24489) ✅, WP-675 (icon-presence `CardStatEntry` fields + dual hash re-pin precedent / D-24490) ✅

## Goal

Add the `shield-levels` `HeroCountSource` so a hero effect can scale by the acting
player's **S.H.I.E.L.D. Level** — defined in `docs/legendary-universal-rules-v23.md`
§S.H.I.E.L.D. Level as "the number of S.H.I.E.L.D. and/or HYDRA cards in your
Victory Pile." The source counts qualifying cards in the player's victory pile and
feeds the existing `attack-per-count` / `recruit-per-count` grant family, extended
here with an optional `perEach` divisor so the printed shape "+1 [icon] for each **2**
S.H.I.E.L.D. Levels" resolves to `floor(level / 2)`.

This is the first of the narrow 3-WP arc (WP-677 / WP-678 / WP-679) that makes
`shld/agent-phil-coulson/approve-orbital-strike` and `shld/mockingbird/spymaster`
faithful. This WP ships the **count source only** — no card is wired here; WP-679
composes the source (this WP) and Undercover (WP-678) into the mixed choose-one.

## User-Visible Impact

None directly — this WP registers a count source and a setup-derived membership
signal with no card consumer yet. The visible fidelity fix lands in WP-679. Purely
foundational; validated by unit tests (resolver, membership, `perEach`, re-pin).

## Assumes

- The victory-pile zone is `G.playerZones[pid].victory` (confirmed against HEAD; the
  shipped `victory-bystanders` `HeroCountSource` / `countVictoryBystanders` in
  `hero/heroCountSource.resolve.ts` scans it — the precedent). **Execution baseline
  assertion (runtime):** confirm defeated Villains / fought Masterminds / earned or
  undercover'd Heroes actually land in `victory`, so the count matches the rulebook's
  "cards in your Victory Pile." (Undercover'd Heroes land there once WP-678 lands.)
- `CardStatEntry` is the correct home for a setup-derived per-card boolean, exactly
  as WP-675 added `hasAttackIcon` / `hasRecruitIcon`; the resolver reads it from
  `G.cardStats` at runtime (no runtime registry read). See [[reference_hashed_g_field_dual_repin]].
- Adding a hashed `CardStatEntry` field forces a **dual state-hash re-pin**
  (`PRE_WP080_HASH` + the sentinel `finalStateHash`) — the sanctioned
  D-24468 / D-24469 / D-24490 class.
- Card data is GENERATED; no card marker is authored in this WP (WP-679 authors the
  `shield-levels` markers).

## Design Rationale (three load-bearing decisions)

### 1. S.H.I.E.L.D./HYDRA membership must be faithful — a new registry-derived signal

Per §S.H.I.E.L.D. Level, a card counts toward your level if it is a S.H.I.E.L.D. or
HYDRA card in your Victory Pile, where "S.H.I.E.L.D./HYDRA card" means:

- the card carries the **S.H.I.E.L.D. or HYDRA team icon**, **OR**
- **"S.H.I.E.L.D." or "HYDRA" appears in** the card's name, its Villain Group name,
  or its Mastermind name (so S.H.I.E.L.D. Assault Squads, HYDRA Kidnappers, HYDRA
  High Council Tactics, etc. all count).

This is registry metadata (team + names), not gameplay state, so it is resolved
**once at setup** into a new `CardStatEntry.isShieldOrHydra` boolean, populated from
the raw registry entry at the same site that builds `cost` / `hasAttackIcon`. The
resolver then reads `G.cardStats[id].isShieldOrHydra` — pure, total, no runtime
registry read, consistent with every other count source.

**Decision:** add `CardStatEntry.isShieldOrHydra: boolean`, populated identically at
**every** `CardStatEntry` build site (real setup + mock), from: team ∈ {shield,
hydra} **OR** a case-insensitive substring match of `s.h.i.e.l.d.` / `hydra` in the
card name / villain-group name / mastermind name. Match the rulebook's own list; do
not narrow it to Heroes.

**NOT a clean mirror of `hasAttackIcon` (execution scope).** `hasAttackIcon` reuses a
value (`card.attack`) already read at the build site; `isShieldOrHydra` needs `team`
**and** `name`, which the engine's local cardStats reader structural types do **not**
expose (`CardStatsFlatCard` in `economy.logic.ts` and `VillainCardEntry` carry neither).
The data is reachable (the registry `FlatCard` carries `team` + `name`), so the fix
**extends those reader structural types to read `team`/`name`** — a real scope item,
not a "same-site copy." A literal `hasAttackIcon`-style mirror would find no `team`
field and silently narrow membership to name-only → undercount. The Mastermind build
site (`mastermind.setup.ts`) and the synthesized basics (below) are separate sites.

**Synthesized / mock entries (no raw registry card).** The 3 basic S.H.I.E.L.D. cards
(Agent / Trooper / Officer, hardcoded in `buildInitialGameState`) must be set
`isShieldOrHydra: true` (team = shield); Sidekick / Wound = `false`. Fixtures and test
mocks (`fixtureBuilders.ts`, mock setups) default the field explicitly. These sites are
enumerated in the EC so none defaults to `false` by omission.

### 2. Determinism cost (unavoidable, sanctioned): dual hash re-pin

`computeStateHash` serializes all of `G` except `diagnostics`, so `G.cardStats` is
hashed. Adding a field to every `CardStatEntry` changes the canonical JSON for every
game → **BOTH oracles re-pin** (`PRE_WP080_HASH` + the sentinel `finalStateHash`).
This is the sanctioned new-hashed-field class (D-24468 / D-24469 transform-field,
D-24490 icon-presence precedents): populate identically at every construction site,
re-pin from a clean run, and confirm the **sole** canonical-JSON delta is the new
`isShieldOrHydra` field before pinning. No gameplay changes — the re-pinned replays
play no `shield-levels` card. See [[reference_hashed_g_field_dual_repin]].

### 3. The count source + a general `perEach` divisor

- `HERO_COUNT_SOURCES` gains **`shield-levels`** (digit-free, hyphenated,
  marker-safe — fits the locked `(attack|recruit)-per-count:<source>:N` token form,
  so WP-679 authors markers with no gate widening). Union + array in lockstep; drift
  pin **N=5→6** as a RUNTIME assertion (D-24372).
- Resolver branch: count `G.playerZones[pid].victory` cards with
  `G.cardStats[id].isShieldOrHydra === true` (the zone field is `victory`, NOT
  `victoryPile` — the `victory-bystanders` / `countVictoryBystanders` precedent).
  Pure/total; reads only `G`. Unlike the
  icon sources it does **not** exclude a triggering card (S.H.I.E.L.D. Level counts
  the whole Victory Pile), and "it never consumes the cards — it just checks."
- **`perEach` divisor:** the printed cards read "for each **2** S.H.I.E.L.D. Levels."
  Baking `÷2` into the source is wrong (other cards read "for each S.H.I.E.L.D.
  Level" = ÷1). Instead extend the count-scaled grant descriptor with an **optional
  `perEach` (default 1)** so the grant is `magnitude × floor(resolveCountSource /
  perEach)`. Thread it through `heroEffectAttackPerCount` / `heroEffectRecruitPerCount`
  and the count-scaled descriptor. General and additive; the existing per-unit cards
  (`perEach` absent → 1) are unchanged.

## Scope (In)

- `CardStatEntry.isShieldOrHydra` (registry-derived at setup) + every build site
  (real + mock) + the **dual hash re-pin**.
- `HERO_COUNT_SOURCES` gains `shield-levels` (union + array; drift pin N=5→6 RUNTIME).
- Resolver branch for `shield-levels` (victory-pile membership count; no self-exclusion).
- Optional `perEach` divisor on the count-scaled grant descriptor +
  `heroEffectAttackPerCount` / `heroEffectRecruitPerCount` (default 1; `floor` division).
- `economy.logic.ts` (+ `mastermind.setup.ts`) reader structural types extended to read
  `team` / `name` so `isShieldOrHydra` can be computed; the 3 synthesized S.H.I.E.L.D.
  basics set `true`; fixtures/mocks set the field explicitly.
- Tests: membership (team-icon path, name-substring path, negative), resolver (count +
  no self-exclusion), `perEach` (`floor(count/2)`, `perEach` absent = ÷1), the re-pin fixtures.

**Provenance note (convention):** `scripts/coverage/mechanic-provenance.json` records
**mechanic** keys (`attack-per-count`, `count-scaled-choose`, …), NOT count-**source**
slugs — no existing source (`victory-bystanders`, `cost-four-plus-played-this-turn`, the
icon sources) appears there. So this WP adds **no** provenance row for `shield-levels`;
the source's coverage rides the count-source registration + `sim:runtime-observed`. (If
the executor grows a mechanic key, that would get a row — not applicable here.)

## Out of Scope

- Wiring any card (no marker authored) — WP-679 composes this source.
- The `s.h.i.e.l.d.-level` **singular gate shape** (`[keyword:S.H.I.E.L.D. Level N]:`
  usable-only-if) — a distinct condition mechanic, deferred to the Bucket-A backlog.
- The S.H.I.E.L.D.-Level **comparison shape** ("if its attack is higher than your
  S.H.I.E.L.D. Level") and the **capped** count shape ("for each Level up to 5") —
  deferred to Bucket-A.
- Undercover (WP-678) and the mixed choose-one (WP-679).

## Non-Negotiable Constraints

- `HERO_COUNT_SOURCES` union + array lockstep; drift pin a RUNTIME assertion (N=5→6).
- `isShieldOrHydra` populated identically at EVERY `CardStatEntry` build site; re-pin
  only after confirming the sole hash delta is the new field.
- Resolver pure/total; reads only `G`; no registry read; no throw.
- `perEach` is additive (default 1) — existing per-unit grants must be byte-identical.
- Membership match follows the rulebook list (team icon OR name/group/mastermind
  substring), not a narrowed Heroes-only reading.

## Contract

`resolveCountSource(G, playerID, 'shield-levels')` = count of the player's
victory-pile cards whose `G.cardStats[id].isShieldOrHydra === true` (no exclusion).
`heroEffectAttackPerCount` / `heroEffectRecruitPerCount` grant
`magnitude × floor(resolveCountSource(...) / (perEach ?? 1))`.
`CardStatEntry.isShieldOrHydra === true` iff the card's team ∈ {shield, hydra} OR its
name / villain-group name / mastermind name contains "S.H.I.E.L.D." or "HYDRA"
(case-insensitive).

## Vision Alignment

- §1 Rules Authenticity — S.H.I.E.L.D. Level is counted exactly as the rulebook defines.
- §3 Player Trust & Fairness — deterministic, replay-faithful; reads state, never consumes it.

## Acceptance Criteria

- `resolveCountSource(G, p, 'shield-levels')` returns the count of S.H.I.E.L.D./HYDRA
  cards in player `p`'s victory pile; a card qualifying by team icon and a card
  qualifying only by name substring both count; a non-S.H.I.E.L.D./HYDRA card does not.
- `perEach = 2` grants `floor(level / 2)` per magnitude unit; `perEach` absent = ÷1
  (existing behavior byte-identical).
- The dual re-pin reflects ONLY the new `isShieldOrHydra` `cardStats` field.
- Engine suite green; `pnpm -r build` 0; `cards:check` reproducible (no card edits, but
  derived feeds regenerated).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — resolver, membership, `perEach`,
   drift-pin, and re-pin fixtures green.
2. `pnpm -r build` exits 0.
3. `pnpm cards:check` reproducible; `ledger:heroes:check` / `mechanics:metadata:check`
   / `effect-index:check` / `sim:runtime-observed:check` regenerated + green;
   `sim:coverage --check` OK (a `shield-levels` new-mechanic warning is acceptable —
   registered, not yet card-observed; floor not regressed).
4. Confirm the state-hash re-pin delta is the single new field.

## Definition of Done

Engine suite green, `pnpm -r build` 0, `cards:check` reproducible, derived feeds
regenerated, the dual hash re-pin landed with a one-line rationale, D-24493 Active,
WORK_INDEX + EC_INDEX rows flipped, roadmap mindmap node flipped, PR squash-merged.

## Reserved Decision (lands at execution)

D-24493 — `shield-levels` count source + `isShieldOrHydra` `CardStatEntry` field
(dual hash re-pin) + `perEach` divisor on the count-scaled grant; see DECISIONS.md.

## Lint Gate Self-Review (00.3)

Locked values (membership rule = team ∈ {shield,hydra} OR name/group/mastermind
substring; `perEach` default 1; drift N=5→6 RUNTIME) stated, not re-derived. The
canonical-array change updates BOTH union and array. Single layer (Game Engine); no
layer inversion. Determinism re-pin called out with a rationale and the
delta-is-only-the-new-field guard. No card data edited (source-only); derived feeds
regenerated. Tests specified (membership both paths, resolver, `perEach`, drift pin,
re-pin). API catalog: N/A (no HTTP/library surface). Applicable items satisfied; the
victory-pile zone field name is flagged as an execution baseline assertion.
