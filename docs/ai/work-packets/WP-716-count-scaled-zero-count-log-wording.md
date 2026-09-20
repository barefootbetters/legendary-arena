# WP-716 — Count-scaled zero-count log wording (Game Engine)

**Status:** Draft 2026-09-20 (EC-753; D-24539 reserved)
**Layer:** Game Engine (game-log `messages` text only)
**Hard-deps:** WP-247 (attack-per-count / D-24016) ✅, WP-680 (per-team/per-class sources / D-24497) ✅, WP-711 (per-hero-class sources / D-24534) ✅, WP-295 (condition-failed log / D-24082) ✅
**Baseline:** `origin/main` @ (reserve commit)

## Goal

When a count-scaled hero ability (`attack-per-count` / `recruit-per-count`, and the WP-714
`kidnap-per-count` sibling) resolves with a count of **0**, the game log prints
*"Player X's <card> ability did not activate — it needs another <class/team> Hero played this
turn."* (`heroEffects.execute.ts` ~L743, outcome `'blocked'`). That reads like a hard-gated
failure, but the card behaved correctly — it scaled by 0 because no other matching Hero was in
play yet. This WP rewords the count-0 line for the count-scaled family to a zero-scale phrasing
(e.g. *"…scaled to +0 — no other <class/team> Hero played yet this turn"*) so a player reading
the log understands the card worked and how to get value from it (play the matching Heroes
first). **No behavior change** — grant math, conditions, and outcomes are byte-identical; only
the `messages` text changes.

## User-Visible Impact

Operator-observed live 2026-09-20 (Red Skull / Midtown casual match, `27.2.2`): Absorb Energies
was played first, scaled by 0, and logged *"did not activate — it needs another ranged Hero
played this turn"* — which read as if WP-711 hadn't worked, though it was correct order-dependent
behavior. The reworded line reads as an honest +0, not a failure.

## Assumes

- The count-0 case for these cards reaches the `heroEffects.execute.ts` condition-failed branch
  (the same-class/team gate is unmet), which today emits the shared WP-295/WP-702 "ability did
  not activate — <reason>" line at outcome `'blocked'`. Confirmed at HEAD (L743-747).
- The count-scaled keyword set is identifiable at that site (the hook's effect descriptor
  carries `attack-per-count` / `recruit-per-count` / `kidnap-per-count` with a `countSource`),
  so the reword can be scoped to the count-scaled family without altering the generic
  condition-failed wording used by flat-gated abilities (e.g. Repulsor Rays "Ranged: +1 attack").
- `LOG_OUTCOMES` is unchanged — the line keeps a sensible outcome (`'blocked'` or a softer
  existing member; no new outcome value, no drift-array change).

## Scope (In)

- Reword the count-0 game-log line in `heroEffects.execute.ts` for the count-scaled family only
  (attack/recruit/kidnap-per-count), to a zero-scale phrasing that does not read as a gated
  failure and names the count source's class/team.
- A pure helper for the phrasing if the branch warrants it (duplicate-first; inline if single-use).
- Tests: a count-scaled card at count 0 logs the new zero-scale wording (not "did not activate");
  a flat-gated non-count card (Repulsor Rays) keeps its existing wording; a count ≥ 1 still logs
  the existing "Count-scaled …: +N" line unchanged.

## Out of Scope

- Any grant/condition/behavior change — text only.
- The flat-gated (non-count) condition-failed wording (Repulsor Rays etc.) — unchanged.
- The client-side game-log rendering (`buildGameLogText` / `GameLogPanel`) — it renders the
  `messages` text verbatim; no client change.
- A new `LOG_OUTCOMES` member.

## Files Expected to Change

See EC-753 §Files to Produce. Primarily `packages/game-engine/src/hero/heroEffects.execute.ts`
(+ its test), and honest re-pin of any committed replay/log-oracle fixture whose count-0 line
text changes. No client, no card data, no new hashed field.

## Non-Negotiable Constraints

- **Behavior byte-unchanged** — only `G.messages` text differs; the finalState/gameplay hash is
  unchanged; the `messages`/replay oracle re-pins ONLY for the text delta, honestly.
- Reword scoped to the count-scaled family; the generic condition-failed line for flat-gated
  abilities is untouched (no over-broad reword).
- Two-vocabulary discipline: the new wording is neutral/instructive ("+0 — no other X played
  yet"), never "whiff/failed/missed" (aligns with the WP-708/709 copy-lint).
- No `LOG_OUTCOMES` drift; no new keyword; no `.reduce()` in the branch.

## Contract

- A count-scaled hero effect resolving at count 0 appends a `messages` entry whose text conveys
  "+0 — no other <class/team> Hero played yet this turn" (exact string locked in EC-753), not
  "ability did not activate — it needs another <X> Hero."
- Count ≥ 1 is unchanged ("Count-scaled attack/recruit: +N (…)").
- Flat-gated non-count abilities are unchanged.

## Vision Alignment

- §1 Rules Authenticity / §3 Player Trust — the log honestly reflects that the card worked
  (scaled by 0), not that it failed; teaches the sequencing lever without shaming.

## Acceptance Criteria

- A count-scaled card played with 0 matching others logs the new zero-scale wording; snapshot
  asserts the exact string.
- A flat-gated non-count card's blocked wording is unchanged (regression pin).
- Count ≥ 1 logs the existing "Count-scaled …: +N" line unchanged.
- Engine suite green; `pnpm -r build` 0; any log-oracle fixture re-pinned honestly with the
  text delta noted; gameplay `finalStateHash` unchanged.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — new wording + regression pins green.
2. `pnpm -r build` 0.
3. `git status` — only the `messages`-text log-oracle fixtures (if any) re-pinned; no gameplay
   hash churn; state which fixtures and why.

## Definition of Done

Engine suite green, build 0, D-24539 Active, WORK_INDEX + EC_INDEX rows flipped, mindmap
📝→✅, PR squash-merged. A count-scaled card at count 0 reads as +0, not a failure.

## Reserved Decision (lands at execution)

D-24539 — reword the count-scaled family's count-0 game-log line to a "+0 (no other <X> played
yet)" zero-scale phrasing; behavior byte-unchanged; `messages`/replay oracle re-pins honestly.
See DECISIONS.md.

## Lint Gate Self-Review (00.3)

Single layer (Game Engine, `messages` text). No contract/array change (no `LOG_OUTCOMES`
drift). Determinism: no gameplay-hash change; log-oracle re-pin is text-only + honest. Scoped
to the count-scaled family; flat-gated wording untouched (regression pinned). Two-vocabulary
copy-lint honored. §21 API catalog N/A; §20 funding N/A. Files Expected to Change present.
Tests specified (new wording + two regression pins). All applicable items satisfied or N/A.
