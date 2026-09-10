# WP-683 — Here, Hold This (directed capture) + Random Acts of Unkindness (multiplayer pass-left) (Game Engine + Arena Client)

**Status:** Draft 2026-09-09 (EC-720; D-24500 reserved)
**Layer:** Game Engine + Arena Client — **heavyweight** (first hero ability to mutate other players' hands)
**Hard-deps:** **WP-684 (multi-seat pending-choice capability) ⛔** — REQUIRED by Random Acts (every seat selects simultaneously, which the active-only model cannot serve); the villain `capture-bystander` effect + `attachBystanderToVillain` (`board/bystanders.logic.ts`) ✅, the shipped active-player pending-choice / block-all model (D-24069, WP-286) ✅ (Here, Hold This uses this directly), WP-379..382 wound infrastructure (`board/wounds.logic.ts`) ✅

> **Note (gate review):** Here, Hold This is fully grounded and active-scoped — it would be READY
> to execute on its own today. Random Acts' simultaneous multi-seat pass is what needs WP-684. If
> you prefer, land Here, Hold This first (it does not depend on WP-684) and Random Acts after
> WP-684 — the split note below covers this.

## Goal

Implement Deadpool's two interactive/multiplayer abilities: **Here, Hold This for a Second**
— the acting player picks a Villain that then captures a Bystander — and **Random Acts of
Unkindness** — optionally gain a Wound to hand, then every player simultaneously passes a
card from hand to the player on their left.

## User-Visible Impact

Here, Hold This prompts the controller to pick a Villain in the city (which then captures a
Bystander). Random Acts prompts the controller to optionally take a Wound into hand, then
prompts **every** player to choose a card to pass left — the first hero ability that touches
non-active players' hands. (Solo play: the "left" pass degenerates to a self-pass / no-op —
confirm the faithful solo behavior at execution.)

## Assumes

- The villain capture path (`attachBystanderToVillain`, `board/bystanders.logic.ts`) draws
  the top supply Bystander and attaches it to a chosen Villain; awarded on that Villain's
  defeat or carried to the Escaped pile on escape (D-24314). Here, Hold This reuses this
  helper with an acting-player Villain choice (baseline assertion: read the helper + the
  empty-supply and no-Villains cases).
- Per the rulebook (v23 §capture), if there are **no Villains in the city**, the **Mastermind**
  captures the Bystander instead; empty Bystander supply → no-op.
- A plain "gain a Wound" lands in **discard** (`heroEffectGainWound` → discard) — "to your
  **hand**" is a new destination variant (baseline assertion).
- There is **no** pass-to-neighbour / seat-direction primitive today (confirmed at HEAD) —
  the simultaneous "pass a card to the player on your left" is a **new multiplayer
  interaction**; turn order / seat adjacency is derived from `ctx.playOrder` (engine-owned).
- The pending-choice / block-all model (park → block all → resolve* → UIState → renderer) is
  shipped (D-24069, WP-286); this WP extends it (via WP-684) to a **multi-seat simultaneous** choice
  (every player selects concurrently), which is new and the riskiest part.
- Card data is GENERATED; markers via the generator + regen.

## Design Rationale

### 1. Here, Hold This — an acting-player Villain pick reusing villain capture
The only new part is the **choice**: the controller selects which city Villain captures.
Everything downstream (draw top supply Bystander, attach, later award/escape) reuses
`attachBystanderToVillain`. Model it as an active-player pending target choice
(0 villains → Mastermind captures per the rules; empty supply → no-op; 1 → auto; ≥2 →
pending), then call the existing capture helper. No new capture mechanics.

### 2. Random Acts — gain-Wound-to-hand + a simultaneous pass-left
Two new pieces:
- **Gain a Wound to hand** — optional; a destination variant of the discard-bound wound gain,
  so the Wound is immediately in the pool the player can pass away.
- **Simultaneous pass-left** — every player (all seats, including the controller) chooses one
  card from their hand; the passes resolve **together** (a player does not see the incoming
  card before choosing the outgoing one), each moving to the seat on the chooser's left
  (`ctx.playOrder` adjacency). This is the first ability to mutate non-active players' hands,
  so it needs a multi-seat pending choice: park a per-seat outgoing selection, block all
  moves until every seat has chosen, then apply all passes atomically. The gained Wound is a
  legal card to pass.

**Determinism / fairness note (load-bearing):** the pass must apply atomically after all
selections, be deterministic given the selections, and honor `ctx.playOrder` for adjacency;
disconnect/timeout handling of a non-active seat's selection follows the existing
pending-choice posture — flag any gap at execution rather than inventing policy.

## Scope (In)

- Here, Hold This: new handler-bearing keyword (directed bystander capture) — active-player
  Villain target choice (Mastermind fallback at 0 villains; empty-supply no-op) reusing
  `attachBystanderToVillain`; pending choice + block-all + resolve move + UIState projection +
  arena-client renderer.
- Random Acts: new handler-bearing keyword — optional gain-Wound-to-hand (new destination
  variant) + a **multi-seat simultaneous pass-left** (per-seat pending selection, block-all
  until all chosen, atomic apply, `ctx.playOrder` adjacency) + UIState projection (each seat
  sees only its own prompt) + arena-client renderer.
- HeroKeyword lockstep (six sites) for both keywords; `game.test.ts` registration; sim
  dispatch (`SIMULATION_MOVE_NAMES` + both sim `MOVE_MAP`s) for the new `resolve*` moves.
- Card-data markers for both cards + regen.
- Tests: Here Hold This (choose villain → attach; 0-villain Mastermind fallback; empty
  supply no-op); Random Acts (optional wound-to-hand; pass-left with 2/3/4 players adjacency;
  simultaneity — no peeking; solo degeneracy; wound is passable); projections
  (per-seat redaction), renderers.

## Out of Scope

- Any card beyond these two; the count-scaled / optional-single-player / reactive cards
  (WP-680/681/682).
- A general seat-direction framework beyond what pass-left needs (build the minimum;
  `ctx.playOrder` adjacency helper may be extracted if a third consumer appears — duplicate-first).
- Changing default wound-to-discard for other effects.

## Files Expected to Change

See EC-720 §Files to Produce (authoritative allowlist). Primarily: `rules/heroKeywords.ts` (both
keywords, six-site lockstep incl. `NO_MAGNITUDE_KEYWORDS` — both are no-magnitude),
`hero/heroEffects.execute.ts`, `board/bystanders.logic.ts` (reuse `attachBystanderToVillain`),
`moves/*Choice.resolve.ts` + `game.ts` (block-all; the multi-seat await-all rides WP-684) + the
sim dispatch maps, `ui/uiState.{types,build,filter}.ts` (per-seat redaction), `game.test.ts`,
`mechanic-provenance.json`, the card-data generator inputs + regenerated `data/cards/core.json` +
derived feeds, and `apps/arena-client/**` renderers.

## Non-Negotiable Constraints

- Random Acts passes are **simultaneous** (no seat sees its incoming card before choosing
  outgoing), **atomic** on apply, deterministic given selections, `ctx.playOrder` adjacency.
- Per-seat UIState is redacted so a seat sees only its own pass prompt (audience-filter
  contract); the pending choice for the pass spans all seats, not only the active player.
- Here, Hold This reuses `attachBystanderToVillain`; Mastermind-captures-at-0-villains and
  empty-supply-no-op honored.
- Both new keywords: six-site lockstep + drift + `game.test.ts`; new `resolve*` moves enroll
  in `SIMULATION_MOVE_NAMES` + both sim `MOVE_MAP`s.
- Moves never throw. Card markers via the generator + full regen.

## Contract

- Here, Hold This: acting player selects a city Villain → `attachBystanderToVillain(top
  supply bystander)`; 0 villains → Mastermind captures; empty supply → no-op.
- Random Acts: optionally gain a Wound to the acting player's hand; then each seat `s` chooses
  one hand card `c_s`, and every `c_s` moves to `left(s)` per `ctx.playOrder`, applied
  atomically after all selections. Marker/token forms confirmed against the parser at execution.

## Vision Alignment

- §1 Rules Authenticity — capture (with Mastermind fallback), wound-to-hand, and simultaneous
  pass-left match the rulebook.
- §3 Player Trust & Fairness — the pass is simultaneous, deterministic, and per-seat-redacted;
  no seat gains hidden information from another's choice.
- §5 Multiplayer integrity — the first cross-seat hand mutation; it must remain
  server-authoritative and replay-faithful.

## Acceptance Criteria

- Here, Hold This attaches a Bystander to the chosen Villain; with no Villains the Mastermind
  captures; empty supply is a clean no-op.
- Random Acts optionally puts a Wound in the controller's hand; every seat passes exactly one
  chosen card to its left; the passes are simultaneous and atomic; a passed Wound moves like
  any card; solo play degenerates faithfully.
- Engine + arena-client suites green; `pnpm -r build` 0; `cards:check` reproducible; feeds
  regenerated; determinism impact assessed (re-pin only if a hashed field added; the pass
  must be replay-identical).

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine test` — both mechanics incl. multi-player
   pass adjacency + simultaneity, projections, drift/registration green.
2. `pnpm --filter @legendary-arena/arena-client test` — both renderers incl. the per-seat
   pass prompt.
3. `pnpm -r build` 0; `pnpm cards:check` reproducible; ledger/mechanics/effect-index/
   runtime-observed/coverage feeds regenerated + green.
4. Confirm the pass is replay-deterministic and any hash re-pin is limited to a
   deliberately-added hashed field.

## Definition of Done

Both suites green, `pnpm -r build` 0, `cards:check` reproducible, two markers live + feeds
regenerated, D-24500 Active, WORK_INDEX + EC_INDEX rows flipped, roadmap mindmap node
flipped, PR squash-merged. Completing this WP clears the last of the three unmarked core
heroes (Deadpool 0/4 remaining).

## Reserved Decision (lands at execution)

D-24500 — `here-hold-this` directed bystander capture (active-player Villain pick,
Mastermind fallback) + `random-acts` gain-Wound-to-hand + simultaneous multi-seat pass-left
(`ctx.playOrder` adjacency, atomic apply). See DECISIONS.md.

## Context / split note (operator review)

Random Acts is the most novel mechanic in the arc — the first cross-seat hand mutation and
the first simultaneous multi-seat pending choice. Drafted with Here, Hold This as the
"Deadpool interactive/multiplayer" WP; if execution finds the simultaneous pass-left needs
its own session (multiplayer sync, disconnect posture, replay determinism), split per the
self-demotion rule and land Here, Hold This first. Flagged for the 01.0a review pause.

## Lint Gate Self-Review (00.3)

Locked values (capture reuse + Mastermind fallback; wound-to-hand variant; simultaneous
atomic pass-left on `ctx.playOrder`; per-seat redaction) stated. Cross-layer + multiplayer:
engine decides, client renders, server stays authoritative (no inversion); §5 multiplayer
integrity explicitly engaged. Keyword six-site lockstep + sim-dispatch + UIState five-step +
audience-redaction contracts as guardrails. Determinism: the pass must be replay-identical;
re-pin only if a hashed field added. Disconnect/timeout posture flagged as an execution
baseline, not invented here. Card data regenerated via the generator. Tests specified incl.
multi-player adjacency + simultaneity + solo. §21 API catalog: N/A. §20 funding: N/A. §1: Files
Expected to Change present; Context carried by Goal + Assumes + the split note. §17.2 Non-Goal
proximity: no pay-to-win / no client authority; determinism preserved (re-pin only if a hashed
field is added). Both new keywords enroll in `NO_MAGNITUDE_KEYWORDS`. Random Acts' multi-seat need
is resolved via the WP-684 hard-dep. Heaviness + split option surfaced. All applicable items
satisfied or explicitly N/A.
