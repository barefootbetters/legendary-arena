# WP-692 — Free-recruit-from-HQ core mastermind tactics (Game Engine + Arena Client)

**Status:** Draft 2026-09-10 (EC-729; D-24509 reserved)
**Layer:** Game Engine + Arena Client
**Hard-deps:** WP-497 (tactic-onFight framework / D-24300) ✅, the shipped active-player pending-choice / block-all model (D-24069, WP-286) ✅, the give-hq-hero flow (`moves/giveHqHeroChoice.resolve.ts`, `refillHqSlot`, WP-532/D-24343) ✅ — the primary reuse template
**User-Visible Surface:** play.legendary-arena.com (D-24026) — the recruit prompt + effect fire in live matches.

## Goal

Implement the two core mastermind tactics that let the defeating player **recruit an HQ Hero for
free** (no recruit cost), sharing one new filtered-free-recruit mechanic, as per-tactic resolvers
in `rules/tacticHandlers.ts` (the WP-497/506/567 ext_id-keyed pattern):

| Tactic | Mastermind | Printed Fight text | Filter |
|---|---|---|---|
| Dark Technology | Dr. Doom | **may** recruit a `[hc:tech]` or `[hc:ranged]` Hero from the HQ for free | heroClass ∈ {tech, ranged}; optional |
| Bitter Captor | Magneto | recruit a `[team:x-men]` Hero from the HQ for free | team === x-men |

## User-Visible Impact

Two previously-inert core mastermind tactics resolve: on defeat, the player is prompted to pick
an eligible HQ Hero and gains it (to discard) without paying its cost. Validated by unit tests +
the client prompt renderer.

## Context

Per [[project_mastermind_tactic_fight_arc]], mastermind tactic Fight abilities fire nothing. This
WP takes the two "free HQ recruit by filter" tactics — one shared mechanic, two filters.

## Assumes

- `dispatchTacticOnFight` (`rules/tacticHandlers.ts`) dispatches by ext_id
  `core-mastermind-<mm>-<tactic>`; add two cases (`...-dr-doom-dark-technology`,
  `...-magneto-bitter-captor`).
- The HQ zone + the existing recruit path (which normally spends recruit points) exist; free
  recruit = the same card-movement (HQ → player discard + HQ refill) **without** the cost check
  (baseline assertion: locate the recruit helper and confirm the HQ refill behavior; the resolver
  moves the chosen card and refills without touching `turnEconomy.recruit`).
- `G.cardTraits[id].heroClass` / `.team` classify HQ cards for the filter (the
  `cardHasTeamWhenPlayed` / heroClass precedents).
- The active-player pending-choice pattern (park choice → block-all → `resolve*` move → five-step
  UIState projection → arena-client renderer) is the draw-or-empowered / optional-ko-reward family
  (D-24069). **Baseline assertion:** identify the closest existing pending-choice + renderer to
  extend (a "pick a card from a zone" prompt) rather than inventing new infra; the executor
  confirms the exact reuse site.

## Scope (In)

- `rules/tacticHandlers.ts`: `resolveDarkTechnology`, `resolveBitterCaptor` + two dispatch cases;
  a shared free-recruit-from-HQ helper parameterized by the eligibility filter.
- A pending choice for "which eligible HQ Hero" (Dark Technology's "may" allows decline; 0 eligible
  → no-op; 1 → auto or still prompt-with-decline for the "may"; ≥2 → prompt) + resolve move +
  block-all + five-step UIState projection + arena-client renderer.
- **Reuse-first:** prefer extending the already-sim-enrolled `give-hq-hero` resolve move / pending
  choice (a "pick an eligible HQ card" prompt) over standing up a new move. Only if a distinct move
  is genuinely unavoidable does it enroll in `SIMULATION_MOVE_NAMES` + both sim `MOVE_MAP`s +
  `game.test.ts` — the executor commits to reuse-first and documents any deviation.
- `scripts/coverage/tactic-provenance.json` rows for the two tactics; regenerate the
  effect-implementation index.
- Tests: resolver eligibility (tech/ranged filter; x-men filter; 0/1/≥2 eligible; Dark Technology
  decline), free-recruit (card moves to discard, HQ refills, no recruit spent), UIState projection,
  renderer.

## Out of Scope

- Any other tactic; non-core masterminds.
- Changing the normal (cost-paying) recruit path — free recruit is an additive path.

## Files Expected to Change

See EC-729 §Files to Produce (authoritative). Primarily: `rules/tacticHandlers.ts` (2 resolvers +
shared filtered-free-recruit helper + 2 dispatch cases), the give-hq-hero pending-choice move/
projection/renderer extended (reuse-first: `moves/giveHqHeroChoice.resolve.ts`,
`ui/uiState.{types,build,filter}.ts`, `apps/arena-client/**` `PendingGiveHqHeroChoicePrompt.vue`),
`scripts/coverage/tactic-provenance.json` (2 rows), regenerated effect-index, tests.

## Non-Negotiable Constraints

- Free recruit does NOT touch `turnEconomy.recruit`; it reuses the card-movement + HQ-refill only.
- Dark Technology is optional (decline is a clean no-op); Bitter Captor auto/prompt but no decline.
- Active-scoped pending choice; new board-visible UIState fields follow the five-step filter
  pass-through; new `resolve*` move → sim-dispatch lockstep. Moves never throw.
- Resolver-only (no card-data edit); tactic coverage regenerated.

## Contract

- `dispatchTacticOnFight(..., 'core-mastermind-dr-doom-dark-technology', p)` → offer to recruit a
  tech/ranged HQ Hero free (or decline).
- `...-magneto-bitter-captor` → recruit an x-men HQ Hero free (no-op if none).
- Marker/token forms N/A (dispatch is by ext_id, not a card marker).

## Vision Alignment

- §1 Rules Authenticity — the filter, the "for free", and the optional/non-optional distinction
  match the printed text.
- §3 Player Trust & Fairness — deterministic, active-scoped choice; §17.2 no pay-to-win; determinism
  preserved (re-pin only if a hashed field is added).

## Acceptance Criteria

- Each tactic prompts only eligible HQ Heroes; recruiting one moves it to discard + refills HQ,
  spending no recruit; Dark Technology can decline; empty-eligible → no-op.
- Engine + arena-client suites green; `pnpm -r build` 0; `cards:check` reproducible;
  `effect-index:check` + tactic coverage regenerated + green.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — resolvers + projection green.
2. `pnpm --filter @legendary-arena/arena-client test` — the recruit-pick renderer.
3. `pnpm -r build` 0; effect-index + tactic coverage regenerated.
4. Confirm re-pin only if a hashed field was added (else none).

## Definition of Done

Both suites green, `pnpm -r build` 0, tactic coverage regenerated, D-24509 Active, WORK_INDEX +
EC_INDEX rows flipped, roadmap mindmap node flipped, STATUS.md updated, PR squash-merged.

## Reserved Decision (lands at execution)

D-24509 — a filtered free-recruit-from-HQ mechanic (Dark Technology tech/ranged optional; Bitter
Captor x-men) as tactic resolvers parking an active pending choice. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

§1 Context + Files (Scope In / EC-729) present. Locked values (filters; free = no recruit spent;
Dark Technology optional) stated. Cross-layer (engine decides, client renders); no inversion.
Sim-dispatch + five-step UIState contract as guardrails. Determinism: re-pin only if a hashed field
is added. Reuse sites flagged as execution baseline assertions. §20 funding N/A; §21 API catalog
N/A. Applicable items satisfied or N/A.
