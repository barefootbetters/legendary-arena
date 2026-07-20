# WP-398 — Loki Master Strike: The Hypno-Thrall Zone (Game Engine)

**User-Visible Surface:** none — infrastructure (the zone becomes visible in WP-399)

**Status:** Draft — pending execution
**Layer:** Game Engine

## Goal

co2e Loki's Master Strike prints *"Each player discards a [hc:strength] Hero
**or** stacks a non-grey Hero from their hand next to Loki as a
Hypno-Thrall."* WP-388 implemented the discard branch only, so a player
holding no Strength Hero takes a logged no-op and **escapes the strike**. This
WP adds the Hypno-Thrall zone to mastermind state and resolves the second
branch into it, closing the remaining half of the D-24192 gap.

## User-Visible Impact

`none — infrastructure` for this WP specifically. The Thrall zone is written
to `G` and appears in the HUD log, but it is **not projected into `UIState`
until WP-399**, so a player will see the log line and their hand shrink
without seeing where the card went. WP-399 is therefore a required follow-up,
not an optional polish — and STATUS.md must say so rather than reading this
run as visible progress.

## Assumes

- **WP-388 / D-24192** — `resolveLokiStrike` exists and implements the discard
  branch; its no-op path is what this WP replaces. ✅ on `main` (PR #836).
- **WP-179** — `G.cardTraits[extId]` carries `{ heroClass, team }`. ✅ on
  `main`. `heroClass == null` is the engine expression of "grey".
- **D-15401** — `MastermindState.attachedBystanders` is the precedent for an
  append-only mastermind-adjacent collection. ✅ on `main`.
- **Sentinel re-pin is REQUIRED and was measured, not assumed.** A throwaway
  probe adding one `MastermindState` field was scaffolded at draft: the engine
  suite produced **3 failures**, including the `PRE_WP080_HASH` regression
  guard. Any new field in this interface enters `G`'s serialization and moves
  both hash oracles.
- Baseline: `origin/main` @ `01498ac1`; engine suite **2028 pass / 473 suites
  / 0 fail** observed at draft.

## Context (Read First)

- `packages/game-engine/src/mastermind/mastermind.types.ts` —
  **AUTHORITATIVE for** `MastermindState`; the new field goes here
- `packages/game-engine/src/rules/mastermindHandlers.ts` —
  **AUTHORITATIVE for** `resolveLokiStrike` and the shared
  `selectLowestCostHero`
- `packages/game-engine/src/mastermind/mastermind.setup.ts` —
  **AUTHORITATIVE for** every construction site of `MastermindState`,
  including the three degenerate early-returns
- `scripts/record-game-fixture.mjs` — **AUTHORITATIVE for** how the sentinel
  fixture is re-recorded. The fixture is **never hand-edited**
- `packages/game-engine/src/replay/replay.execute.test.ts` —
  **AUTHORITATIVE for** `PRE_WP080_HASH`, the second oracle to re-pin
- `docs/ai/DECISIONS.md` — scan **D-24192** (the gap this closes), **D-15401**
  (the append-only precedent), **D-24188** (deterministic auto-pick)
- `docs/ai/REFERENCE/complete-game-tests.md` — **AUTHORITATIVE for** how the
  recorded sentinel game is exercised, and therefore what a legitimate re-pin
  looks like
- `docs/legendary-universal-rules-v23.md` §"Grey Heroes"

## Design Rationale

**Why a new zone is unavoidable here, when Doom's Omens needed none.** Doom's
Omens are *counted*, and the strike counter already counts them — so WP-388
derived the total instead of storing it. A Hypno-Thrall is different in kind:
specific Hero cards leave a player's hand and must be identified individually
and durably. There is no existing field that holds them, and inferring them is
impossible. This is the case where a new `G` field is the honest answer.

**Sequencing.** WP-398 and WP-397 both modify
`rules/mastermindHandlers.{ts,test.ts}` and are **not** parallel-safe. Execute
sequentially; whichever runs second re-records its baseline pass count against
the moved `main`.

**Append-only, mirroring D-15401.** `hypnoThralls` follows
`attachedBystanders`: append-only during a match, no removal path in this WP.
Loki's printed text never returns a Thrall to its owner.

**Why the auto-pick still takes the discard branch first.** D-24192's
selection rule is unchanged: a Strength Hero is discarded when the player has
one, because discarding a card you chose beats surrendering a Hero permanently.
The Thrall branch fires only when the discard branch cannot — exactly the
tabletop "or" resolution for a player who cannot pay the first cost.

**Thralls are not owned.** The card stacks next to *Loki*, not next to the
player, so `hypnoThralls` lives on `MastermindState` rather than on
`playerZones`. That also matches how the mastermind's captured bystanders are
modelled.

**The dual re-pin is the main risk in this WP, and it is a process risk, not a
design one.** Both oracles must be re-pinned in the same commit as the field
addition, the sentinel via `record-game-fixture.mjs` only. A hand-edited hash
is indistinguishable from a masked regression.

## Scope (In)

- `MastermindState.hypnoThralls: CardExtId[]` — new append-only field,
  initialised `[]` at **every** construction site including the three
  degenerate early-returns in `buildMastermindState`.
- `resolveLokiStrike`: replace the no-op path with the Thrall branch — select
  the lowest-cost **non-grey** Hero from hand, move it out of the hand and
  append it to `gameState.mastermind.hypnoThralls`, and log it. A player with
  neither a Strength Hero nor any non-grey Hero keeps the logged no-op.
- Re-record the sentinel fixture via `scripts/record-game-fixture.mjs` and
  re-pin `PRE_WP080_HASH`, both in the implementation commit.
- Tests covering the new branch, the field's presence at every construction
  site, and card conservation.

## Out of Scope

- **Any `UIState` projection or client display** — WP-399. This WP
  deliberately ships engine-only, and STATUS.md must record that the zone is
  not yet visible.
- Doctor Octopus's reveal-eight branch — WP-397.
- Any removal path for Thralls (no card returns a Thrall to its owner).
- Any scoring or victory-point treatment of Thralls.
- Any change to `attachedBystanders`, the counter, or the WP-200 emission.

## Files Expected to Change

- `packages/game-engine/src/mastermind/mastermind.types.ts` — **modified** —
  the `hypnoThralls` field
- `packages/game-engine/src/mastermind/mastermind.setup.ts` — **modified** —
  initialise `[]` at every construction site (four: three degenerate
  early-returns + the computed path)
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** —
  the Thrall branch in `resolveLokiStrike`
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** —
  Thrall-branch coverage
- `packages/game-engine/src/mastermind/mastermind.setup.test.ts` —
  **modified** — field-presence coverage at every construction site
- `packages/game-engine/src/replay/replay.execute.test.ts` — **modified** —
  `PRE_WP080_HASH` re-pin
- the recorded sentinel fixture under
  `packages/game-engine/src/test/fixtures/games/` — **modified** —
  **regenerated by `scripts/record-game-fixture.mjs`, never hand-edited**
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24201 Active),
  `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

## Non-Negotiable Constraints

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs, no snippets)
> - ESM only, Node v22+; human-style code per `00.6-code-style.md`
> - No `Math.random()`, no wall-clock, no new dependency
> - No `boardgame.io` / registry import in the touched engine modules
> - Moves never throw; the handler never throws
> - **The sentinel fixture is regenerated by its script and never hand-edited.**
>   A hand-written hash is a masked regression.
> - **Re-pin only after explaining the delta.** Both oracles are expected to
>   move for exactly one reason: `MastermindState` gained a field. If anything
>   else changed, STOP and investigate before re-pinning.
> - Locked contract values: see `## Contract` below
> - If any item is unclear or appears to conflict with the source, STOP and ask

## Contract

**Locked values.**

- Field: `hypnoThralls: CardExtId[]` on `MastermindState`, append-only,
  initialised `[]` at every construction site.
- Non-grey predicate: `gameState.cardTraits?.[extId]?.heroClass != null`
  (identical to WP-397's).
- Selection: the shared `selectLowestCostHero` with a **new** trait kind for
  "any non-grey Hero", or an equivalent plain-discriminator extension —
  **not** a predicate callback (`code-style.md` §Functions).
- Branch order per player: Strength-Hero discard first; only a `null`
  selection reaches the Thrall branch; only a second `null` reaches the no-op.
- Hand removal uses the WP-382 / D-24183 idiom with **both** returned arrays
  assigned back.
- Player iteration: `Object.keys(gameState.playerZones).sort()`.

## Vision Alignment

- **Vision clauses touched:** §1, §2, §22.
- **Conflict assertion:** No conflict: this WP preserves all touched clauses —
  it makes a printed branch fire where the player previously escaped, with no
  randomness introduced.
- **Non-Goal proximity check:** N/A — none of NG-1..7 are crossed.
- **Determinism preservation:** No RNG added. Both hash oracles **will** move,
  for the single reason that `G` gained a field; that is an expected,
  explained re-pin performed with the recording script, not a silent
  re-baseline. `sim:runtime-observed:check` is expected to stay current (the
  matrix is `core/dr-doom`); if it regenerates, STOP.

## Funding Surface Gate

N/A — engine gameplay only; no funding surface (§20.1 absent).

## API Catalog Update

N/A per D-11804 — no HTTP endpoint or server-reachable library function.

## Acceptance Criteria

- **AC-1** A player with a Strength Hero discards it and stacks nothing — the
  WP-388 branch is byte-identical.
- **AC-2** A player with no Strength Hero but at least one non-grey Hero has
  their lowest-cost non-grey Hero removed from hand and appended to
  `G.mastermind.hypnoThralls`.
- **AC-3** A player with neither keeps the logged no-op; no Wound is
  substituted and nothing is stacked.
- **AC-4** Grey cards and Wounds are never stacked as Thralls.
- **AC-5** `hypnoThralls` is present and `[]` at every `MastermindState`
  construction site, including all three degenerate early-returns.
- **AC-6** Card conservation: for each player, `hand + discard + thralls`
  before equals after, as multisets.
- **AC-7** The handler never throws: empty hand, all-Wound hand, absent
  `cardTraits`, missing `cardStats`.
- **AC-8** Both hash oracles are re-pinned in the implementation commit, the
  sentinel via `record-game-fixture.mjs`, and the close-out records the
  before/after values with the one-line reason for the delta.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` exits 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0 after the
   re-pins; record the pass count.
3. `pnpm -r build` exits 0.
4. `pnpm sim:runtime-observed:check` exits 0 **with no regeneration**.
5. Inspect the sentinel fixture diff. **The fixture stores no serialized `G`**
   — its keys are `name`, `input`, `meta`, and
   `expected{finalStateHash, messages, outcome, snapshotPerTurn}` (verified at
   draft; `attachedBystanders` appears nowhere in it). So do **not** look for a
   `hypnoThralls: []` addition — it cannot exist. The pass condition is:
   **only `expected.finalStateHash` changes**, with `name`, `input`, `meta`,
   `expected.messages`, `expected.outcome`, and `expected.snapshotPerTurn` all
   byte-identical. Anything else changing = STOP and investigate.
   Re-record by pinning the original metadata so `meta` does not churn and
   self-trip this gate — read `name`, the seed, `created-at`, `engine-version`,
   and the `input` block out of the existing fixture and pass them back to
   `scripts/record-game-fixture.mjs`; run the script with `--help` first and
   match its current flags rather than copying an invocation from memory.
6. **Control run:** revert the Thrall branch and confirm the new tests fail.
7. `git diff --name-only` on staged changes equals the allowlist.

## Definition of Done

- [ ] All Acceptance Criteria AC-1..AC-8 satisfied.
- [ ] All Verification Steps green, including the Step-5 fixture inspection
      and the Step-6 control run.
- [ ] **No files outside `## Files Expected to Change` were modified.**
- [ ] `docs/ai/DECISIONS.md` — D-24201 Active, **and D-24192 amended inline
      to mark the Loki half closed**. With WP-397 that completes D-24192's
      recorded fidelity gap: after this WP both deferred branches are
      implemented, and D-24192 must not still read as half-open. (WP-399 adds
      observability, not fidelity — it does not close this gap.)
- [ ] `docs/ai/STATUS.md` close-out entry, explicitly stating **"No
      user-observable change — infrastructure only; the Thrall zone is not
      visible until WP-399"**, and recording both hash values with the reason.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped; mindmap node `📝` → `✅` +
      counts regenerated.
- [ ] WP-399 confirmed queued as the required follow-up.

## Reserved Decision (lands at execution)

**D-24201 — Hypno-Thralls are an append-only zone on `MastermindState`.**
Records why a new `G` field is unavoidable here when Doom's Omens needed none
(counted vs. individually identified cards); the D-15401 append-only
precedent; that Thralls attach to the mastermind rather than to a player
because the card stacks them next to Loki; the measured dual-oracle re-pin and
the rule that the sentinel is regenerated, never hand-edited; and that no
removal path exists because no printed text returns a Thrall.

## Lint Gate Self-Review (00.3)

Run at draft against all 21 sections. §1–§9 PASS. §12–§17 PASS (control run
mandated; card-conservation invariant; DoD carries the scope-boundary check;
`§15.1` declares `none — infrastructure` with the inverted STATUS.md
requirement per EC-TEMPLATE; Vision block carries the §17.2 conflict
assertion). §10, §11, §18, §20, §21 resolve N/A with named justifications.
