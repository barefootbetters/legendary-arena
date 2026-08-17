# WP-568 — Wait-and-See Conditional Semantics (Game Engine)

**Status:** Drafted 2026-08-17
**EC:** [EC-603](../execution-checklists/EC-603-wait-and-see-conditional-semantics.checklist.md)
**Reserves:** D-24377
**Lane:** Standard two-session
**Hard-dep:** **WP-566 / EC-601** must land first (see §Assumes)
**User-Visible Surface:** `play.legendary-arena.com` — **D-24026 REQUIRED**
**Drafted off:** `origin/main` @ `d517dd26`

---

## Goal

Make a **numeric-threshold** hero condition a whole-turn window rather than a
snapshot taken when the card is played. Thor's Surge of Power — *"If you made 8 or
more recruit this turn, you get +3 attack"* — grants its +3 attack **retroactively**
once the turn's recruit total reaches 8, even if the recruit arrives after the card
is already in play.

## Assumes

- **WP-566 / D-24375 — HARD DEPENDENCY.** It establishes the per-condition
  blocked-message vocabulary. This WP adds a **third** state (*"not yet met"*) that
  must not reuse WP-566's *"not met"* wording. The two touch the same emit site and
  the same evaluator module and **must not execute concurrently**. WP-568 is
  BLOCKED until WP-566 is Done.
- **WP-545 / D-24354** — `recruitMadeThisTurnAtLeast`, reading
  `G.turnEconomy.recruit` (the **gross** recruit made this turn, not net available).
- **D-24055** — `distinctHeroClassesAtLeast` (the `[keyword:Spectrum]` gate).
- **WP-367 / D-24159 + D-24319** — the play-phase `turn.onMove` chokepoint, which
  already hosts two per-move re-checks (`latchFinalTurnIfDeckExhausted`,
  `applyPileDepletionResourceLoss`). Verified at source: it fires after **every**
  successful play-phase move and receives `G` only (no `ctx`, no `playerID`).
- **The sentinel fixture cannot materialize this state.** Its heroes are
  `core/black-widow` + `core/captain-america`; neither carries a wait-and-see
  condition, and the fixture contains no Surge of Power or Spectrum card. Read from
  the fixture, which is what licenses the no-re-pin expectation.

## Context

**Operator design decision, 2026-08-17.** The card says *"this turn"*, which names a
whole-turn window, and attack is a turn-scoped resource — so a late grant is
coherent. Reported from a real match where Surge of Power was played before the
turn's recruit total would have reached the threshold.

**The drafting recommendation was the opposite and is preserved deliberately**
(D-24377 §2): evaluate on play, because Legendary resolves an ability when the card
is played, has no continuous re-check machinery, and the rulebook's freedom to
choose play order exists *because* conditions are checked at resolution — which
makes build-recruit-then-play the card's intended skill. The operator overruled it
on the text of the card. Recorded so a future reader sees a decision that was
**made**, not one that was missed, and does not quietly revert it.

**Scope was narrowed by a second operator decision.** All four live condition types
are *"this turn"* scoped in substance — `heroClassMatch` / `requiresTeam` /
`distinctHeroClassesAtLeast` all read `playerZones.inPlay`, which clears every turn.
Applying wait-and-see to all four would change **every `[hc:X]:` synergy card in the
game** and remove the play-ordering skill from class synergy. The operator chose
**numeric thresholds only**: `recruitMadeThisTurnAtLeast` and
`distinctHeroClassesAtLeast`. `heroClassMatch` and `requiresTeam` stay **on-play**.

**The seam this draws is deliberate.** `distinctHeroClassesAtLeast` reads `inPlay`
like the class gates do, so the boundary is drawn at *"is it a numeric threshold"*
rather than at *"does it read `inPlay`"*. Stated explicitly (D-24377 §1) so the
seam reads as chosen, not accidental.

**Blast radius, counted from the actual condition markers:** **15** card lines —
`[keyword:recruit-threshold]` ×2 (Surge of Power in `core` and `msp1`) and
`[keyword:Spectrum]` ×13 (all `ssw2`). The reservation estimated 31 from a loose
text regex that also caught villain Fight effects; **15 is the corrected figure**.
Note at least one Spectrum line (`ssw2` `pink-sphinx`) is a `Fight:` effect on a
non-hero card and so never reaches the hero-play path — execution confirms the exact
reachable count.

## Scope (In)

1. `types.ts` — a **lazily-materialized** `G` field recording deferred conditional
   grants (absent unless one is actually deferred).
2. `hero/heroEffects.execute.ts` — when an in-scope condition fails, record a
   deferred grant instead of only logging; emit the *"not yet met"* line.
3. A re-check helper invoked from the play-phase `turn.onMove` chokepoint in
   `game.ts`, beside the two existing per-move re-checks.
4. Clearing deferred grants at the turn boundary — a threshold never reached that
   turn never fires.
5. Tests: fires-late, fires-once, never-fires, cleared-at-turn-end, ordering
   stability, and the two on-play conditions **unchanged**.

## Scope (Out)

- **`heroClassMatch` and `requiresTeam` stay on-play.** Operator decision; changing
  them would alter every class-synergy card.
- Any change to *whether* a condition's predicate is true — only *when* it is
  evaluated.
- Any client change. The log renders what the engine emits; no new projection and
  **no prompt** (see §Contract — this is not a pending choice).
- Re-evaluating on every `turnEconomy` mutation. The chokepoint is the per-move
  hook, not each resource write.
- WP-566's message work. That lands first; this WP adds one state to its vocabulary.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/types.ts` | the lazy deferred-grant `G` field |
| `packages/game-engine/src/hero/heroEffects.execute.ts` | record the deferral + "not yet met" line |
| `packages/game-engine/src/hero/deferredConditionalGrants.ts` | **new** — pure record/re-check/clear helpers |
| `packages/game-engine/src/hero/deferredConditionalGrants.test.ts` | **new** |
| `packages/game-engine/src/game.ts` | invoke the re-check in `turn.onMove`; clear at the turn boundary |
| `packages/game-engine/src/hero/heroEffects.execute.test.ts` | extend |
| `packages/game-engine/src/index.ts` | export the new type |

## Contract

**Locked — wait-and-see applies to exactly two condition types (D-24377 §1):**
`recruitMadeThisTurnAtLeast` and `distinctHeroClassesAtLeast`. Every other condition
type keeps on-play evaluation.

**Locked — the `G` field is NOT named `pending*` (D-24377 §5).** This codebase's
`G.pending*Choices[]` convention means an **interactive** choice with a resolve move
and a `UIState` projection, and a parked `pending*` entry without UX **hard-freezes
the human player**. A deferred grant needs **no player input and no prompt** — it
re-checks itself. Naming it `pending*` would invite an unnecessary prompt, or a
future reader "fixing" absent UX that was never required.

**Locked — the field is LAZY.** Written only when an in-scope condition actually
fails, so a game that never defers carries no new field. The sentinel fixture's
heroes carry no in-scope condition, so **both oracles are expected byte-unchanged**.

**Locked — fire AT MOST ONCE per play.** Idempotence is the first test to write: a
threshold crossed, dropped and re-crossed within one turn must not grant twice.

**Locked — deferred grants clear at the turn boundary.** A threshold not reached
during that turn never fires; nothing carries into the next turn.

**Locked — three distinct log states.** *not yet met* (deferred, this WP) ≠ *not
met* (failed, WP-566) ≠ *applied* (fired). Reusing WP-566's wording is a FAIL.

**Locked — re-check order is insertion order**, stable and deterministic. No
set-iteration order dependence; no `.reduce()`.

## Acceptance Criteria

- **AC-1** — Surge of Power played at 5 recruit, then recruit reaches 8 later in the
  same turn: the +3 attack **is** granted, and an `applied` log line names the card.
- **AC-2** — the same state where recruit never reaches 8: **no** grant, and the
  turn ends with the deferred entry cleared.
- **AC-3** — idempotence: recruit crosses 8, drops below, crosses again → the
  ability grants **exactly once**.
- **AC-4** — a deferred grant does **not** survive into the next turn.
- **AC-5** — `heroClassMatch` and `requiresTeam` are **unchanged**: playing a
  `[hc:X]` card before its partner still fails and never fires retroactively.
- **AC-6** — the *"not yet met"* line is textually distinct from WP-566's *"not
  met"* line, and both differ from the unrecognized-type line.
- **AC-7** — the `G` field is **absent** on a game where nothing defers.
- **AC-8** — the field is **not** named `pending*`, and no `UIState` projection or
  resolve move is added (a grep pins zero new `pending` entries for it).
- **AC-9** — determinism: sentinel `finalStateHash` and `PRE_WP080_HASH` both
  **byte-unchanged** (no in-scope condition exists in the fixture). If either moves,
  **STOP** — the field is being written unconditionally.
- **AC-10** — re-check order is insertion-stable across two identical runs.
- **AC-11** — `pnpm -r build` 0; engine suite green; `pnpm -r --no-bail test` no new
  failures.
- **AC-12** — **D-24026**: a live turn where recruit crosses 8 **after** Surge of
  Power is in play grants the +3 attack, visible in the HUD and the game log.

## Verification Steps

1. `pnpm -r build` → 0.
2. Engine suite green; the six behavioural tests present.
3. Confirm the `G` field is absent on a non-deferring game.
4. Confirm both hash oracles byte-unchanged.
5. `pnpm -r --no-bail test` → no new failures.
6. Post-deploy: AC-12.

## Definition of Done

- [ ] AC-1..AC-11 demonstrated with observed output; AC-12 verified or recorded
      operator-pending.
- [ ] D-24377 landed **Active**, recording BOTH readings and the narrowed scope.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.
- [ ] `STATUS.md` records both oracles byte-unchanged and names the two condition
      types in scope (and the two deliberately left on-play).

## Notes

**If WP-566 has not landed, this WP is BLOCKED.** Do not start it — the *"not yet
met"* state has no message vocabulary to extend, and both packets edit the same
emit site.

**Deliberately not in scope:** re-evaluating on each `turnEconomy` write. The
per-move chokepoint is coarser but is the cadence two existing per-move re-checks
already use, and it needs no new hook.

## Gate Verdicts

- **Pre-flight (`01.4`):** `READY TO EXECUTE` (with the WP-566 sequencing
  constraint recorded) —
  `docs/ai/invocations/preflight-wp568-wait-and-see-conditional-semantics.md`
- **Copilot (`01.7`):** `PASS` (1 RISK, fixed in place) —
  `docs/ai/invocations/copilot-wp568-wait-and-see-conditional-semantics.md`

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Verdict |
|---|---|
| 1 Goal is one user-visible outcome | PASS |
| 2 Assumes cites each dependency's source | PASS — WP-566 named as a hard dep |
| 3 Context states why now | PASS — operator decision, both readings recorded |
| 4 Scope In is a closed enumeration | PASS — two condition types |
| 5 Scope Out is explicit | PASS — the other two conditions named as on-play |
| 6 Files Expected to Change is an allowlist | PASS — 7 files |
| 7 Contract locks the surface | PASS — seven locked clauses |
| 8 Acceptance Criteria are testable | PASS |
| 9 Verification Steps are operator-runnable | PASS |
| 10 Definition of Done is binary | PASS |
| 11 Layer boundary respected | PASS — engine only, single package |
| 12 Determinism impact stated | PASS — AC-9 + AC-10; lazy field, fixture verified |
| 13 Persistence boundary untouched | PASS — runtime `G` only, no DB, no snapshot |
| 14 Observability | PASS — three distinct log states |
| 15 No invented mechanics | PASS — an operator ruling on printed card text, recorded with the opposing case |
| 16 Canonical field names | PASS — and the WP forbids the misleading `pending*` name |
| 17 Contract files untouched | PASS — no `.types.ts` contract-file lock broken; `types.ts` gains one optional field per the lazy-field precedent |
| 18 Grep-gate prose discipline | PASS — AC-8's grep targets `pending`; this WP body uses the token in prose but the gate's scope is the engine source, which carries no WP prose |
| 19 Scaffold run for validation-tightening | N/A — loosens rather than tightens; no input becomes newly invalid, and AC-5 pins the untouched conditions |
| 20 D-24026 named for a user-visible surface | PASS — AC-12 |
| 21 API catalog obligation | N/A — no HTTP endpoint or library-only catalog function |
