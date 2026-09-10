# WP-691 — Deterministic core mastermind tactics (Game Engine)

**Status:** Draft 2026-09-10 (EC-728; D-24508 reserved)
**Layer:** Game Engine
**Hard-deps:** WP-497 (tactic-onFight framework + `tacticHandlers.ts` / `dispatchTacticOnFight` / D-24300) ✅, WP-379..382 wound/bystander infra ✅
**User-Visible Surface:** play.legendary-arena.com (D-24026) — the tactic effects fire in live matches.

## Goal

Implement the three **no-choice** remaining core mastermind tactics as deterministic
per-tactic resolvers in `rules/tacticHandlers.ts` (the WP-497/506/567 ext_id-keyed pattern),
so they stop firing nothing when their tactic is defeated:

| Tactic | Mastermind | Printed Fight text | Resolver behavior |
|---|---|---|---|
| Treasures of Latveria | Dr. Doom | draw three extra cards in your next hand | +3 additive to the defeating player's next-hand fill |
| Xavier's Nemesis | Magneto | rescue a Bystander for each of your X-Men | rescue N Bystanders where N = the player's in-play `[team:x-men]` Heroes |
| Whispers and Lies | Loki | each other player KOs two Bystanders from their Victory Pile | remove 2 Bystanders from every OTHER player's victory pile |

## User-Visible Impact

Three previously-inert core mastermind tactics resolve faithfully on defeat. Validated by
unit tests; no UI (no pending choice).

## Context

Per [[project_mastermind_tactic_fight_arc]], `defeatMastermindTacticCore` runs no tactic text —
every tactic's Fight ability is inert. The arc (WP-497+) implements per-tactic resolvers. This
WP takes the three that need **no player choice**, the lightest slice.

## Assumes

- `dispatchTacticOnFight` (`rules/tacticHandlers.ts`) dispatches by defeated tactic ext_id
  `core-mastermind-<mastermindSlug>-<tacticSlug>`; unknown id → silent no-op. Add three cases.
- The `handSizeOverrides?: Record<string,number>` lazy-materialized pattern (WP-497 Octet) is the
  next-hand override mechanism; there is **no** end-of-turn cleanup draw — the hand fills at the
  play-phase `onBegin`, so "next hand" = the defeating player's next `onBegin` fill (baseline
  assertion: confirm the field name + that it is applied per-player at `onBegin`). Treasures is
  **additive +3** (not set-to-N like Octet's set-to-8) — confirm whether the override is a
  set-value or supports an additive delta; if set-value only, Treasures adds a sibling
  additive-override field or resolves the base hand size + 3.
- `G.cardTraits[id].team === 'x-men'` identifies an X-Men Hero (the `cardHasTeamWhenPlayed`
  precedent; in-play scan) for Xavier's Nemesis; `attachBystanderToVillain`/rescue helpers +
  the bystander supply for the rescue.
- Bystanders in a victory pile are fungible (identical ext_ids), so Whispers and Lies removes 2
  with no choice; skip `ctx.currentPlayer`; a player with <2 removes what they have.

## Scope (In)

- `rules/tacticHandlers.ts`: `resolveTreasuresOfLatveria`, `resolveXaviersNemesis`,
  `resolveWhispersAndLies` + three `dispatchTacticOnFight` cases + any locked constants
  (`TREASURES_EXTRA_CARDS = 3`, `WHISPERS_BYSTANDER_KO = 2`).
- `scripts/coverage/tactic-provenance.json`: rows marking the three tactics `executable` (WP-507
  overlay) so /debug/effects reflects them; regenerate the effect-implementation index.
- Tests: each resolver (+3 next-hand override applied at the right player's onBegin; rescue count
  = X-Men count incl. 0 and Size-Changing; each-other KO-2 with skip-self + <2 edge).

## Out of Scope

- Any tactic needing a player choice (WP-692..695) or the extra-turn mechanic (WP-696).
- Non-core masterminds' tactics.

## Files Expected to Change

See EC-728 §Files to Produce (authoritative). Primarily: `rules/tacticHandlers.ts` (3 resolvers
+ 3 dispatch cases + 2 constants), `rules/tacticHandlers.test.ts` (or the tactic suite),
`scripts/coverage/tactic-provenance.json` (3 rows), regenerated `data/metadata/effect-implementation-index.json`.
No card-data edit, no client change.

## Non-Negotiable Constraints

- Deterministic: `ctx.random.*` only if any (rescue/KO are not random); no `Math.random`, no I/O.
- Resolvers mutate `G` via helpers, never throw (tactic resolution runs inside a move).
- No `.reduce()` in the zone/count loops. Unknown tactic id stays a silent no-op.
- Whispers/Xavier's touch other players' / the acting player's zones only through zone helpers.

## Contract

- `dispatchTacticOnFight(G, ctx, 'core-mastermind-dr-doom-treasures-of-latveria', playerID)` →
  the player's next `onBegin` hand fill is +3.
- `...-magneto-xaviers-nemesis` → rescue `count(in-play x-men Heroes)` Bystanders to the player.
- `...-loki-whispers-and-lies` → each other player's victory pile loses up to 2 Bystanders.

## Vision Alignment

- §1 Rules Authenticity — each tactic resolves exactly as printed.
- §3 Player Trust & Fairness — deterministic, replay-faithful.
- §17.2 Non-Goal proximity: no pay-to-win; determinism preserved (no re-pin — see below).

## Acceptance Criteria

- Defeating each tactic produces its effect; a match that defeats none is byte-identical.
- Treasures adds exactly 3 to the correct player's next hand; Xavier's scales with X-Men (0 → 0);
  Whispers removes 2 per other player (skip self; <2 → all they have).
- Engine suite green; `pnpm -r build` 0; `cards:check` reproducible (no card edits);
  `effect-index:check` + tactic coverage regenerated + green.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — the three resolvers green.
2. `pnpm -r build` 0.
3. `pnpm effect-index:check` current after regen; tactic-provenance rows present.
4. Confirm no state-hash fixture churn (no committed fixture defeats these tactics → no re-pin).

## Definition of Done

Engine suite green, `pnpm -r build` 0, effect-index + tactic coverage regenerated, D-24508 Active,
WORK_INDEX + EC_INDEX rows flipped, roadmap mindmap node flipped, STATUS.md updated, PR squash-merged.

## Reserved Decision (lands at execution)

D-24508 — three deterministic core tactic resolvers (Treasures +3 next-hand additive, Xavier's
rescue-per-X-Men, Whispers each-other-KO-2-bystanders). See DECISIONS.md.

## Lint Gate Self-Review (00.3)

§1 Context + Files (via Scope In / EC-728) present. Locked values (TREASURES_EXTRA_CARDS=3,
WHISPERS_BYSTANDER_KO=2) stated. Single layer (Game Engine). Determinism: no new hashed field
beyond the existing lazy `handSizeOverrides` (no committed fixture creates the key → no re-pin;
asserted). Card data not edited (resolver-only); tactic coverage regenerated. Tests per resolver
incl. edges. §20 funding N/A; §21 API catalog N/A. Applicable items satisfied or N/A.
