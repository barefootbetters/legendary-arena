# WP-674 — `cost-four-plus-played-this-turn` count source + `recruit-per-count` effect family (Game Engine)

**Status:** Done 2026-09-08 (EC-711; D-24489 Active)
**Layer:** Game Engine
**Hard-deps:** WP-247 (attack-per-count / D-24016) ✅, WP-673 (worthy count source recipe / D-24488) ✅

## Goal

Make the four "costs 4 or more" sibling cards grant their printed variable bonus
instead of the flat/dropped bonus they grant today, by extending the WP-673
`attack-per-count` recipe:

- `cvwr/goliath/being-big-is-best` — "+1 attack for each other card you played
  this turn that costs 4 or more"
- `noir/luke-cage-noir/follow-big-leads` — "+1 **recruit** for each other card …
  that costs 4 or more"
- `noir/luke-cage-noir/weight-of-the-world` — "+2 attack for each other card …
  that costs 4 or more"
- `vill/juggernaut/size-matters` — "+1 attack for each other card … that costs
  4 or more"

Found alongside WP-673's live solo verification and recorded in that WP's Out of
Scope + the `reference_attack_per_count_marker_mechanism` memory. The `+N for
each` scaling was silently dropped because no `cost-four-plus-played-this-turn`
count source existed, and `attack-per-count` is attack-only (a recruit-scaled
grant had no effect family).

## User-Visible Impact

`play.legendary-arena.com` — these four Heroes now scale their attack/recruit
with the number of cost-≥4 cards already played, as printed. Purely a fidelity
fix; no new surface. Live-on-surface is operator-pending (D-24026).

## Assumes

- `attack-per-count` (D-24016) + the WP-673 `worthy-cards-played-this-turn`
  precedent: a `HeroCountSource` names X, `resolveCountSource` resolves it (with
  the optional `triggeringCardId` for "each OTHER card"), the grant is
  `magnitude × count`, and the co-located printed icon is suppressed.
- The count-scaled marker is appended to card data by
  `apply-hero-ability-markers.mjs` from `inputs/hero-ability-markers.json`; the
  parser recognises it generically for any source in `HERO_COUNT_SOURCES`.
- "costs 4 or more" = printed cost ≥ 4; cost lives in `G.cardStats[id].cost`.
- Card data is GENERATED — the fix edits the marker SOURCE + regenerates, never
  hand-edits `data/cards/*.json`.

## Design Rationale

Two additions drive all four cards through the shipped mechanism, not a new
NL-parser path:

1. **A new count source `cost-four-plus-played-this-turn`** — a digit-free slug
   (the `4` written as `four`) so it fits the existing locked
   `attack-per-count:<source>:N` / `recruit-per-count:<source>:N` lowercase-hyphen
   token form and the engine's `[a-z][a-z-]*` capture, with no gate widening (the
   WP-673 "no gate widening" norm). Its resolver mirrors the worthy resolver at
   threshold 4 and excludes the triggering card ("each OTHER card").
2. **A new `recruit-per-count` effect family** — the recruit sibling of
   `attack-per-count` (`attack-per-count` is attack-only). A new HeroKeyword +
   handler `heroEffectRecruitPerCount` granting `magnitude × count` to
   `G.turnEconomy.recruit`, a new `RECRUIT_COUNT_SCALED_PATTERN` parse arm, and a
   recruit-icon-suppression block mirroring the attack one.

## Scope (In)

- New `HeroCountSource` `'cost-four-plus-played-this-turn'` (union + array, drift
  test bumped N=2→3 as a RUNTIME assertion per D-24372).
- Resolver branch: count OTHER `inPlay` cards with cost ≥4, excluding the
  triggering card (reuses the WP-673 `triggeringCardId` param).
- New `recruit-per-count` HeroKeyword (union + `HERO_KEYWORDS` array + both length
  pins 43→44 + `HERO_EFFECT_HANDLERS` + handler-count pin 29→30 + `HANDLED_KEYWORDS`;
  NOT in `NO_MAGNITUDE_KEYWORDS` — it carries a magnitude).
- Executor `heroEffectRecruitPerCount` (grants recruit; threads the played card id).
- Parser: `RECRUIT_COUNT_SCALED_PATTERN` extraction (Step 2d′), recruit-icon
  suppression, and the recruit-per-count effect-builder branch.
- Marker apply script `VALID_TOKEN_PATTERN` extended with the
  `recruit-per-count:<source>:N` form.
- Four markers in `inputs/hero-ability-markers.json`; `cvwr` / `noir` / `vill`
  regenerated. `mechanic-provenance.json` gains `recruit-per-count → WP-674 / D-24489`.
- Resolver / executor / parser unit tests; all derived feeds regenerated.

## Out of Scope

- `vnom/symbiote/symbiotic-adaptation` — an icon-based count-scaled **choose-one**
  ("Choose one: +1 recruit for each other card with a recruit icon / Or +1 attack
  for each other card with an attack icon"). It needs icon-presence count sources
  AND a new count-scaled choose-one parse form + choice-resolution model (a
  distinct subsystem, not the uniform cost-≥4 shape) — its own follow-up WP.

## Files Expected to Change

- `packages/game-engine/src/rules/heroCountSource.ts`
- `packages/game-engine/src/hero/heroCountSource.resolve.ts`
- `packages/game-engine/src/rules/heroKeywords.ts`
- `packages/game-engine/src/hero/heroEffects.execute.ts`
- `packages/game-engine/src/setup/heroAbility.setup.ts`
- `packages/game-engine/src/{hero,rules,setup}/*.test.ts` (resolver drift + cost-4,
  executor recruit-per-count, parser both forms, keyword drift/length pins)
- `scripts/convert-cards/apply-hero-ability-markers.mjs`
- `scripts/convert-cards/inputs/hero-ability-markers.json`
- `scripts/coverage/mechanic-provenance.json`
- `data/cards/{cvwr,noir,vill}.json` (generated)
- `data/metadata/{card-mechanics,effect-implementation-index}.json` (generated)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `runtime-observed-hollows.json` (generated)

## Non-Negotiable Constraints

- `HERO_COUNT_SOURCES` and `HERO_KEYWORDS` union+array update in lockstep; new
  drift pins are RUNTIME assertions, not bare `satisfies`.
- Resolver stays pure/total: reads only `G`, never throws, no registry read.
- The count source slug is digit-free so no locked token form widens.
- Card data fixed via marker SOURCE + reproducible regen, never a hand-edit.
- No hash re-pin unless a real diff appears (cvwr/noir/vill only; core-set pins unaffected).

## Contract

`resolveCountSource(G, playerID, 'cost-four-plus-played-this-turn', triggeringCardId)`
returns the count of `playerZones.inPlay` cards, other than `triggeringCardId`,
whose `G.cardStats[id].cost >= 4`. `heroEffectRecruitPerCount` grants
`magnitude × count` recruit to `G.turnEconomy`.

## Vision Alignment

- §1 Rules Authenticity — the four cards now grant their printed variable bonus.
- §3 Player Trust & Fairness — deterministic, replay-faithful resolution.

## Acceptance Criteria

- Each card grants `perUnit × (other cost-≥4 cards played this turn)`; the
  recruit sibling grants recruit, not attack; a lone play yields +0.
- No phantom flat grant on any of the four lines.
- `cards:check` reproducible; engine suite green; determinism pins unchanged.

## Definition of Done

Engine suite green, `pnpm -r build` 0, `cards:check` reproducible, all derived
feeds regenerated, D-24489 Active, WORK_INDEX + EC_INDEX rows landed, PR squash-merged.

## Reserved Decision (lands at execution)

D-24489 — `cost-four-plus-played-this-turn` count source + `recruit-per-count`
effect family; see DECISIONS.md.

## Lint Gate Self-Review (00.3)

- Locked values (cost threshold 4, per-unit 1/2) stated verbatim, not re-derived.
  Canonical-array changes update BOTH union and array; keyword length + handler
  count pins bumped. Layer: Game Engine only; no cross-layer edge. Card data via
  generated regen, not hand-edit. Determinism addressed (no re-pin). Tests added.
  API catalog: N/A (no endpoint / library-surface change). All applicable items
  satisfied.
