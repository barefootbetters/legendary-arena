# WP-687 — Final Blow Endgame Gate + UI (Game Engine + Arena Client)

**Status:** Draft 2026-09-10
**Primary Layer:** Game Engine + Arena Client
**User-Visible Surface:** play.legendary-arena.com (the Mastermind tile + the win condition)
**Dependencies:** WP-686 (the `finalBlow` setup flag + `G.finalBlow` storage) — **hard dep, must ship first**
**Baseline:** drafted against `origin/main` @ `4b5f2ca7`

---

## Goal

After this session, a match played with the Final Blow rule
(`G.finalBlow === true`, from WP-686) behaves per the rulebook's "Final Blow
(Optional)" variant: defeating the Mastermind's **fourth (last) Tactic no
longer wins the game**. Instead the Mastermind stays fightable a **fifth,
final time**; that final fight moves the **Mastermind card itself** into the
fighting player's Victory Pile and fires the heroes-win endgame. When
`G.finalBlow === false` (the default), behavior is exactly as today — the 4th
Tactic defeat wins immediately. The "final fight required / Mastermind
fightable again" state is surfaced through a new `UIMastermindState`
projection field so the arena-client Mastermind tile inverts its current
"all tactics defeated → locked" affordance into "fight the Mastermind (final
blow)". The loadout surface gains a toggle so a group can author the flag.

---

## Assumes

- **WP-686 is complete and merged**: `G.finalBlow?: boolean` is set at setup
  from the envelope/payload `finalBlow` — **optional, seeded only when `true`
  and omitted when off** (so absent = off). Read it as `G.finalBlow === true`.
  If WP-686 is not on `main`, this WP is **BLOCKED**.
- `packages/game-engine/src/moves/fightMastermind.ts` exports `fightMastermind`
  and `defeatMastermindTacticCore`. `fightMastermind` Step 1 returns early when
  `G.mastermind.tacticsDeck.length === 0`; `defeatMastermindTacticCore` sets
  `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1` when
  `areAllTacticsDefeated(G.mastermind)` and emits the `mastermindDefeated`
  notable event. Confirmed at `fightMastermind.ts:72` and `:262`.
- `packages/game-engine/src/mastermind/mastermind.logic.ts` exports
  `areAllTacticsDefeated` and `defeatTopTactic`; `mastermind.types.ts` declares
  `MastermindState` with `baseCardId` (the sole `G.cardStats` key).
- `packages/game-engine/src/endgame/endgame.evaluate.ts` reads
  `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED` and returns `heroes-win`;
  `endgame.types.ts` declares the condition constants.
- `packages/game-engine/src/economy/economy.resolve.ts` exports
  `resolveMastermindFightCost(G)` — the Mastermind's own fight requirement,
  which is the cost of the fifth/final fight too (no new cost logic).
- The UIState projection pipeline: `ui/uiState.types.ts` `UIMastermindState`
  (fields incl. `tacticsRemaining`, `tacticsDefeated`); `ui/uiState.build.ts`
  builds the mastermind object (block at ~lines 815-824); `ui/uiState.filter.ts`
  rebuilds it field-by-field in the whitelist (block at ~lines 461-489);
  `ui/uiState.filter.test.ts` proves fields survive per audience (template at
  ~line 342). Confirmed by the WP-687 draft survey.
- `apps/arena-client/src/components/play/MastermindTile.vue` gates the fight
  button in `gateForFight()`: `tacticsRemaining === 0` currently returns
  `allowed: false` ("All tactics defeated; mastermind already fallen.")
  (confirmed at MastermindTile.vue:83-88); `MastermindTile.test.ts` pins that
  structural lock (~line 105).
- The loadout authoring surface (registry-viewer LoadoutBuilder and/or the
  arena-client lobby loadout intake) is where the `finalBlow` envelope field is
  set — the same envelope authored with `heroSelectionMode` / `heroAlternateIds`.

If any of the above is false, re-verify against `main` before proceeding.

---

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` — "Final Blow (Optional)": "after the
  Mastermind has been fought 4 times and has no more face down Tactics, a
  player must still fight the Mastermind card itself in a 5th, final fight to
  put the Mastermind card into their Victory Pile and win the game." This is
  the authoritative behavior source (cite it in the DECISIONS entry).
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 (determinism) and #2
  (engine owns truth; UI consumes read-only projections), and §UIState
  Projection Integrity.
- `.claude/rules/architecture.md` §UIState Projection Integrity — the
  **five-step Board-Visible Field Rule** (declare type → populate build →
  pass through filter → filter test → Play Diagnostics snapshot). A field that
  reaches build but not filter is silently dropped.
- `.claude/rules/architecture.md` §Move & Phase Rules, §Zone Contents — moves
  never throw; zones store CardExtId strings; mutate via `zoneOps` helpers.
- `.claude/skills/legendary-game-engine/SKILL.md` — engine enforcement.
- `docs/ai/DECISIONS.md` — scan D-24291 (`defeatMastermindTacticCore` shared
  core), D-12805 (audience-filter redaction), and the WP-686 D-24503 entry; the
  reserved **D-24504** lands at execution.
- `packages/game-engine/src/moves/fightMastermind.ts` — the fight guard, the
  shared defeat core, and the all-tactics endgame block (read in full).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — field naming for any UIState
  field added.

---

## Scope (In)

### A) Engine — the endgame gate (read `G.finalBlow`)

- `packages/game-engine/src/moves/fightMastermind.ts` — **modified**:
  - In `defeatMastermindTacticCore`, when `areAllTacticsDefeated(G.mastermind)`
    is true: **branch on `G.finalBlow === true`** (the flag is optional per
    WP-686; absent = off). If off (today's behavior), set `MASTERMIND_DEFEATED`
    and emit `mastermindDefeated` as now. If on, do **not** set
    `MASTERMIND_DEFEATED` yet — instead set the Mastermind "final-blow pending"
    (the state field in §B); the vanquish log/event is deferred to the final
    fight. **Note (RS-1):** `defeatMastermindTacticCore` is the *shared* defeat
    core — Silent Sniper's `defeat-with-bystander` / `resolveDefeatChoice` (the
    free, no-attack defeat, D-24291) also drives it, so a Silent Sniper defeat
    of the last Tactic under Final Blow also defers the win and sets
    final-blow-pending. This is rulebook-correct (the Mastermind is not truly
    defeated until the 5th fight). Confirm at execution that `resolveDefeatChoice`
    has no separate win path that would bypass or double-set the counter.
  - In `fightMastermind`, add a **distinct, self-contained final-fight branch**
    (RS-2): when `G.finalBlow === true` and the Mastermind is final-blow-pending
    (tactics deck empty), handle the final fight **before** the Step 1
    `tacticsDeck.length === 0` early-return and **without** falling into
    `defeatMastermindTacticCore` (whose own empty-deck early-return would no-op
    while `spendFightCost` / `hasActedThisTurn` still ran, spending attack for
    nothing). The final-fight branch, after the same stage + all-block guards
    and the healed/acted check: validates `spendableAttack >=
    resolveMastermindFightCost(G)` (silent no-op if short), moves the Mastermind
    **base card** (`G.mastermind.baseCardId`) into the current player's Victory
    Pile via `zoneOps`, sets `MASTERMIND_DEFEATED`, emits the `mastermindDefeated`
    notable event, spends the fight cost, and marks acted. When `G.finalBlow` is
    off, Step 1's early-return is unchanged (regression pin).
  - Every `MASTERMIND_DEFEATED` write keeps a `// why:` comment; the deferred
    branch and the final-fight branch each cite the Final Blow rule + D-24504.

### B) Engine — the "final blow pending" state

- `packages/game-engine/src/mastermind/mastermind.types.ts` — **modified** —
  add `finalBlowPending?: boolean` to `MastermindState` (optional, so existing
  fixtures + serialization stay byte-identical when the flag is off, per the
  `hypnoThralls?` / `gameText?` optional-field precedent). Set true when the
  last Tactic is defeated under `G.finalBlow`; cleared/irrelevant once the
  Mastermind card is awarded.
- `packages/game-engine/src/mastermind/mastermind.logic.ts` — **modified** — a
  small pure helper `isFinalBlowAvailable(mastermindState, finalBlow)` returning
  `finalBlow === true && tacticsDeck empty && finalBlowPending === true`. It is
  a **single source of truth** shared by exactly two engine sites — the
  `fightMastermind` final-fight gate and the `uiState.build` projection — so the
  engine's "can the final blow happen" decision and the tile's "show fight
  again" affordance cannot disagree (the `resolveMastermindFightCost`
  centralization precedent, D-24348: one resolver "so combat / UI / AI never
  disagree"). This is a consistency requirement, not a premature abstraction;
  the client tile consumes the projected `finalBlowPending` field, never the
  helper (layer boundary). No `.reduce()`; copy-then-override for any state set.

### C) Engine — endgame evaluator (unchanged contract, verified)

- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **verify only**
  (likely no change): the evaluator already returns `heroes-win` on
  `MASTERMIND_DEFEATED >= 1`; Final Blow just changes *when* that counter is
  set (in §A), not how the evaluator reads it. If a change is required it is a
  documented deviation; default expectation is no edit.

### D) Engine — hashed-G re-pin (empirical; likely NONE)

- `packages/game-engine/src/**` state-hash oracles — **verify; edit only if a
  pin actually moves** — `finalBlowPending?` on `MastermindState` is hashed G,
  but it is **optional and omitted when off** (the WP-686 `G.finalBlow`
  discipline), so a non–Final-Blow match — which is every committed sentinel /
  golden replay fixture (none of them set `finalBlow`) — serializes
  byte-identically and **no oracle moves**. The field is only ever present in a
  match that used Final Blow, and no such match is pinned. Expectation:
  **no re-pin.** Do not re-pin speculatively; run the suite and confirm the
  sentinel `finalStateHash` is unchanged. If a pin unexpectedly moves,
  STOP — the field is not being omitted when off. Record the empirical result
  (expected: no re-pin) in the DECISIONS entry.

### E) Engine — the five-step board-visible field

1. `packages/game-engine/src/ui/uiState.types.ts` — **modified** — add
   `finalBlowPending?: boolean` to `UIMastermindState` (this exact name; no
   alternative).
2. `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate it
   in the mastermind object literal from `isFinalBlowAvailable(...)`.
3. `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass it
   through the mastermind field-by-field whitelist (public shared-board field).
4. `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — assert
   the field survives for PLAYER_0 / PLAYER_1 / SPECTATOR (the ~line-342
   template).
5. Play Diagnostics `uiStateSnapshot` — **verify** the field appears (no code
   change if the snapshot serializes the whole mastermind object).

### F) Engine tests

- `packages/game-engine/src/moves/fightMastermind.test.ts` — **modified** —
  Final Blow ON: 4th-tactic defeat does NOT win; the Mastermind stays
  fightable; the 5th fight (paying the cost) awards the Mastermind base card to
  the Victory Pile and sets `MASTERMIND_DEFEATED`; insufficient attack on the
  5th fight is a silent no-op. Final Blow OFF (default): 4th-tactic defeat wins
  immediately (unchanged regression pin).
- `packages/game-engine/src/ui/uiState.build.test.ts` (or the existing build
  test) — **modified** — `finalBlowPending` reflects the state.

### G) Arena client — the Mastermind tile

- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified** —
  `gateForFight()` inverts the `tacticsRemaining === 0` terminal lock: when the
  new `finalBlowPending` field is true, the structural lock no longer fires so
  the fight is **allowed** — but the existing precedence stage → **cost** →
  structural is preserved (RS-4): the cost gate (the branch above the structural
  lock) must still be able to block an under-resourced final fight, matching the
  engine's silent no-op. When `finalBlowPending` is false, the existing "already
  fallen" lock stands. Show a "Final blow — fight the Mastermind" affordance /
  badge next to the tactics-remaining status line.
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — **modified** —
  pin: `tacticsRemaining === 0` + `finalBlowPending: true` → fight enabled with
  the final-blow label; `finalBlowPending: false/absent` → the existing lock.

### H) Arena client lobby — the authoring toggle (RS-3, OR resolved; full thread)

The authoring surface is the **arena-client lobby match-create path**, not the
registry-viewer (which only exports a LAGN document, out of scope). The config
threads `LobbyView.vue` (build config + checkbox) → `useCreateMatchFromComposition.ts`
(`launchMatchFromComposition`, `LaunchMatchInput.config`) → `lobbyApi.ts`
(`createMatch` / `createMatchWithBot`, which POST `setupData: config`). Every
hop types `config` as the 9-field `MatchSetupConfig` today, so for `finalBlow` to
reach the engine **type-clean** the whole thread widens to `MatchConfiguration`
(the WP-686 payload alias; assignable, so the widening is additive). Both create
functions are widened — a Final Blow **bot** match must carry the flag too, not
only human matches.

- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — widen the create
  `setupData`/`config` type from `MatchSetupConfig` to `MatchConfiguration` on
  **both** `createMatch` and `createMatchWithBot` (both POST `setupData: config`)
  so `finalBlow` rides in `setupData` for human and bot matches alike.
- `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts` — **modified** —
  widen `LaunchMatchInput.config` to `MatchConfiguration` so the flag threads
  type-clean from the form to `createMatch`.
- `apps/arena-client/src/lobby/LobbyView.vue` (the create form; confirm at
  execution it is the `launchMatchFromComposition` caller) — **modified** — a
  "Final Blow (optional)" checkbox, default unchecked, that sets `finalBlow` on
  the config it launches.
- the matching lobby test(s) — **modified** — assert the checkbox round-trips
  `finalBlow: true` into the POSTed `setupData` (human path; bot path covered by
  the widened `createMatchWithBot` type).

### I) Governance

- `docs/ai/DECISIONS.md` — **modified** — land **D-24504**.
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` —
  **modified** — close-out updates (WP-687 → done/✅, EC-724 → Done, counts).

---

## Out of Scope

- **No change to the setup flag or its plumbing** — WP-686 owns
  `finalBlow` envelope validation and `G.finalBlow` storage.
- **No change to the normal (non-final-blow) win** beyond the branch: with
  `G.finalBlow === false`, the 4th-tactic defeat wins exactly as today (pinned
  by a regression test).
- **No new endgame condition constant** — Final Blow reuses
  `MASTERMIND_DEFEATED`; it only defers *when* that counter is set. Adding a new
  `ENDGAME_CONDITIONS` member is out of scope (and would need a canonical-array
  drift update it does not warrant).
- **No new fight-cost logic** — the 5th fight pays the Mastermind's existing
  `resolveMastermindFightCost(G)`.
- **No scheme-side / Final Showdown variant** — the adjacent rulebook "Final
  Showdown (Optional)" is a different rule and is not in scope.
- Refactors or cleanups outside Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — final-blow-aware defeat core + 5th-fight path + Mastermind-card award
- `packages/game-engine/src/mastermind/mastermind.types.ts` — **modified** — `finalBlowPending?: boolean`
- `packages/game-engine/src/mastermind/mastermind.logic.ts` — **modified** — `isFinalBlowAvailable` helper + state helper
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **verify** (edit only if required; document deviation)
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `finalBlowPending?` on `UIMastermindState`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — populate the field
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass-through in the whitelist
- `packages/game-engine/src/ui/uiState.filter.test.ts` — **modified** — per-audience survival
- `packages/game-engine/src/moves/fightMastermind.test.ts` — **modified** — final-blow ON/OFF behavior
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** — field value
- engine state-hash oracle tests — **verify only; edit only if a pin unexpectedly moves** — expected: no re-pin (the field is omitted when off; no committed fixture uses Final Blow)
- `apps/arena-client/src/components/play/MastermindTile.vue` — **modified** — invert the 0-tactics lock; final-blow affordance
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — **modified** — final-blow gate pins
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — widen `createMatch` AND `createMatchWithBot` `config`/`setupData` type to `MatchConfiguration`
- `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts` — **modified** — widen `LaunchMatchInput.config` to `MatchConfiguration`
- `apps/arena-client/src/lobby/LobbyView.vue` (the `launchMatchFromComposition` caller; confirm at execution) + its test — **modified** — "Final Blow (optional)" toggle + round-trip assertion
- `docs/ai/DECISIONS.md` — **modified** — land D-24504
- `docs/ai/STATUS.md` — **modified** — live-verified entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-687 row check-off
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-724 → Done
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-687 node `📝` → `✅` + counts

This set spans two layers (engine + client) and ~13 code/test files; that is
why the arc is split from WP-686 and why this WP is heavyweight/two-session
(the engine gate can execute first, the client surface second, sharing the
`finalBlowPending` projection field). The executor MAY split it at that seam.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only. The
  final fight adds no RNG; if any reshuffle path is touched, thread `random`.
- Never throw inside move functions — `fightMastermind` returns void on an
  invalid/insufficient final fight (silent no-op). Only `Game.setup()` throws.
- Never persist `G`/`ctx`; `G` stays JSON-serializable (the new fields are
  booleans). Snapshots stay counts-only.
- All zone mutations go through `zoneOps` helpers; zones store CardExtId strings
  only — the Mastermind card awarded to the Victory Pile is
  `G.mastermind.baseCardId` (a string), pushed via the same path the tactic
  award uses.
- No `.reduce()` in zone or effect operations; explicit `for...of`.
- ESM only, Node v22+, `node:` prefix; `.test.ts` only; full file contents.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Gate on `G.finalBlow`, default off.** Every new branch must leave the
  `G.finalBlow === false` path byte-identical to today. The regression pin is
  mandatory.
- **Reuse `MASTERMIND_DEFEATED`.** Do not add a new endgame condition; Final
  Blow only defers when that counter is set.
- **Five-step Board-Visible Field Rule (Invariant).** The new
  `UIMastermindState` field must be declared, populated, passed through the
  audience filter, covered by a filter test, and visible in Play Diagnostics —
  a field that reaches build but not filter is silently dropped.
- **The Mastermind card enters exactly one Victory Pile once.** Guard against
  double-award (the deferred 4th-tactic branch must NOT also push the card).
- **Client renders through `AbilityText.vue` for any gameText** and never shows
  raw marker syntax; the new badge is plain status copy.
- **arena-client `typecheck` is load-bearing** (`vue-tsc --noEmit`) — build +
  test do not type-check SFCs.
- No new dependency; no forbidden package (§7).

**Session protocol:**
- If the 5th-fight path appears to need a new endgame condition, STOP — reuse
  `MASTERMIND_DEFEATED` and re-read `fightMastermind.ts`.
- If the audience filter is not updated for the new field, STOP — it will be
  silently dropped (the shipped EC-206 failure mode).
- If a state-hash oracle moves for a `finalBlow: false` match, STOP and
  investigate — the off-path must be byte-identical.

**Locked contract values (paste verbatim — do not paraphrase):**
- Engine reads: `G.finalBlow === true` (optional, from WP-686; absent = off)
  and `G.mastermind.finalBlowPending?: boolean` (optional, omitted when off)
- Final-blow availability: `G.finalBlow === true && tacticsDeck.length === 0 &&
  finalBlowPending && Mastermind card not yet awarded`
- Final fight cost: `resolveMastermindFightCost(G)` (the Mastermind's own cost)
- Victory-Pile award on final blow: `G.mastermind.baseCardId`
- Endgame counter set on final blow: `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED = 1`
- UIState field: `UIMastermindState.finalBlowPending?: boolean`
- DECISIONS entry: D-24504

---

## Vision Alignment

**Vision clauses touched:** §3 (player trust & fairness — a win condition),
§8/§3 (determinism / RNG sourcing), §22 (replay faithfulness), §1/§2 (card
semantics — a rulebook-faithful optional rule), NG-1 (no pay-to-win).

**Conflict assertion:** No conflict — this WP preserves all touched clauses.

- §3 — Final Blow is a group-chosen difficulty variant applied symmetrically
  to the whole table; it never advantages one seat and never sells an outcome.
  The engine remains the sole authority on when the win fires.
- §8/§3 — The final fight adds no `Math.random()` and no wall-clock; it reuses
  the deterministic fight-cost resolution and `zoneOps`.
- §22 — With Final Blow off (default), replays are byte-identical to today
  (regression pin) — `finalBlowPending?` is optional and omitted when off, so no
  state-hash oracle moves. With Final Blow on, the match genuinely ends later by
  design; the transition is deterministic and replay-faithful. Because no
  committed sentinel/golden fixture uses Final Blow, no oracle is expected to
  re-pin — verify empirically and re-pin only if one actually moves.
- §1/§2 — The behavior matches the Universal Rules v23 "Final Blow (Optional)"
  box verbatim (cited in D-24504).
- NG-1 — A difficulty variant, never a paid advantage.

**Non-Goal proximity check:** None of NG-1..7 are crossed.

**Determinism preservation:** All state transitions are deterministic; the final
fight is a pure `G` mutation via `zoneOps` with no RNG or I/O. The `finalBlow:
false` path is byte-identical (pinned), and `finalBlowPending?` is omitted when
off so no committed fixture's hash moves — the expected outcome is **no
re-pin**; verify empirically and re-pin only if an oracle actually moves
(documented in D-24504).

## Funding Surface Gate

N/A — this WP implements an optional gameplay rule and its play-surface tile; it
touches no global-nav / registry-viewer / profile funding affordance, no
donation or tournament-funding copy, and no funding channel.

---

## Acceptance Criteria

- [ ] With `G.finalBlow === true`, defeating the last Tactic does NOT set
      `MASTERMIND_DEFEATED`; the Mastermind is final-blow-pending and remains
      fightable (asserted in `fightMastermind.test.ts`).
- [ ] The final (5th) fight, with sufficient attack, moves
      `G.mastermind.baseCardId` into the current player's Victory Pile exactly
      once and sets `MASTERMIND_DEFEATED = 1` → `endgame` returns `heroes-win`.
- [ ] The final fight with insufficient attack is a silent no-op (move returns
      void; no partial mutation).
- [ ] With `G.finalBlow === false` (default), the 4th-tactic defeat wins
      immediately, byte-identical to pre-WP-687 (regression pin passes).
- [ ] `UIMastermindState.finalBlowPending` is declared, populated in build,
      passed through `filterUIStateForAudience`, survives for PLAYER_0 /
      PLAYER_1 / SPECTATOR (filter test), and appears in Play Diagnostics.
- [ ] `MastermindTile.vue` enables the fight (subject to the resource gate) and
      shows the "final blow" affordance when `finalBlowPending` is true, and
      keeps the "already fallen" lock when false (pinned in the tile test).
- [ ] The loadout authoring surface has a "Final Blow (optional)" toggle that
      round-trips `finalBlow` into the emitted MATCH-SETUP document (unit test).
- [ ] `pnpm -r build`, `pnpm -r test`, and
      `pnpm --filter @legendary-arena/arena-client typecheck` all exit 0.
- [ ] `DECISIONS.md` has D-24504; the hashed-G re-pin (if any oracle moved when
      Final Blow is exercised) is documented there; `git diff --name-only`
      shows only files in `## Files Expected to Change`.
- [ ] D-24026 live verification: on play.legendary-arena.com, a Final Blow
      match shows the Mastermind fightable after the 4th tactic and the win
      fires only on the 5th fight (observable evidence recorded in STATUS.md).

---

## Verification Steps

```pwsh
# 1 — engine builds + tests (final-blow ON/OFF, award, no-op, regression)
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
# Expected: exits 0; fightMastermind.test.ts final-blow cases pass

# 2 — the new UIState field survives the audience filter
pnpm --filter @legendary-arena/game-engine test -- --test-name-pattern "finalBlowPending|mastermind"
# Expected: the filter test asserts survival for all three audiences

# 3 — arena-client typecheck (SFC gate) + tests
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: exits 0; MastermindTile + loadout-toggle tests pass

# 4 — off-path byte-identical: no state-hash oracle moved for finalBlow=false
Select-String -Path "packages\game-engine\src\**\*hash*.test.ts" -Pattern "PRE_WP080|finalStateHash"
# Expected: unchanged pins for the finalBlow=false sentinels (inspect diff)

# 5 — whole-repo scope confirmation
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0; `pnpm -r test` exits 0;
      `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — includes the D-24026 live-on-surface
      verification evidence (a Final Blow match wins only on the 5th fight,
      observed on play.legendary-arena.com)
- [ ] `docs/ai/DECISIONS.md` has D-24504 (incl. the hashed-G re-pin note)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-687 row checked off with the date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-724 flipped Pending → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-687 node `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

---

## Lint Gate Self-Review (00.3)

- **§1 Structure** — PASS. All required sections present and non-empty; Out of
  Scope lists 6 exclusions (single instance, before Files Expected to Change).
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol +
  locked values; full-file-contents required, diffs forbidden, 00.6 cited.
- **§3 Assumes** — PASS. WP-686 hard dep + every engine/client file with the
  confirmed line anchors; BLOCKED-if-false stated.
- **§4 Context** — PASS. ARCHITECTURE §UIState Integrity, the five-step rule,
  the rulebook, DECISIONS, source files cited specifically.
- **§5 Files** — PASS. Every file marked modified with a one-line change; the
  ~13-file cross-layer count is why the arc is split and this WP is heavyweight.
- **§6 Naming** — PASS. `finalBlow` / `finalBlowPending` / `baseCardId` /
  `MASTERMIND_DEFEATED` used verbatim per source.
- **§7 Dependency** — PASS. No new dependency; forbidden packages excluded.
- **§8 Boundaries** — PASS. Engine decides the win; UI consumes the projection;
  zones store strings; `zoneOps` for mutation; no DB in moves.
- **§9 Windows** — PASS. `pwsh` + `Select-String` verification.
- **§10 Env vars** — N/A. None added or read.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. `node:test`; `makeMockCtx`; no boardgame.io import in
  helpers; regression pin for the off-path.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output;
  arena-client `typecheck` gated.
- **§14 Acceptance** — PASS. 10 binary, observable items incl. live-verify.
- **§15 Definition of Done** — PASS. STATUS / DECISIONS / WORK_INDEX + scope +
  roadmap; `**User-Visible Surface:**` = play.legendary-arena.com; §15.1
  live-on-surface item present (not satisfiable by tests+merge alone).
- **§16 Code Style** — PASS. `isFinalBlowAvailable` is shared by exactly two
  engine sites — the `fightMastermind` final-fight gate and the `uiState.build`
  projection — as a single source of truth so combat and the tile cannot
  disagree (the `resolveMastermindFightCost` / D-24348 centralization
  precedent); the client tile consumes the projected field, not the helper
  (layer boundary). This is a consistency requirement, not a premature
  abstraction. Explicit control flow; `// why:` on every endgame-counter write.
- **§17 Vision Alignment** — PASS. Clause numbers (§3, §8, §22, §1/§2, NG-1),
  no-conflict assertion, NG proximity, determinism line (scoring/replay/RNG).
- **§18 Prose-vs-Grep** — PASS. Verification step 4 greps hash-pin tokens in
  `*hash*.test.ts` only; this WP file is outside that path, so no
  false-positive; no forbidden-token enumeration in code prose.
- **§19 Bridge-vs-HEAD** — N/A (no repo-state-snapshot artifact authored here).
- **§20 Funding Surface** — N/A with justification (Funding Surface Gate above).
- **§21 API Catalog** — N/A with justification: this WP touches no HTTP endpoint
  and no `apps/server/src/**` library function; the request-shape change to
  `POST /api/match/create` was already cataloged by WP-686. No server code here.
