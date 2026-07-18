# WP-389 — Mastermind Base-Face Selection: Stop Silently Selecting Epic Faces (Game Engine)

**User-Visible Surface:** play.legendary-arena.com

**Status:** Draft — pending execution
**Layer:** Game Engine

## Goal

`findMastermindCards` — the internal helper behind the exported
`buildMastermindState` — classifies a mastermind's cards by assigning
`baseCard = card` for **every** non-tactic face, with no early exit — so the
**last** non-tactic face wins. Any mastermind that ships both a base and an
Epic face therefore plays its **Epic** variant, which no player chose. This
affects **65 masterminds across 24 sets**. This WP makes the classifier
select the **first** non-tactic face (the base card), restoring the intended
difficulty for every affected match and making the Epic face unreachable
until a future WP introduces it as an explicit opt-in.

## User-Visible Impact

In a deployed match using any affected mastermind, the board stops showing
the Epic card and shows the base card: its printed name, attack, VP, and
abilities. Concretely, a co2e Doctor Doom match currently faces *Epic Doctor
Doom* at attack `12+`; after this WP it faces *Dr. Doom* at attack `10+`.
Master Strike text, tactics-defeat text, and "Always Leads" all resolve from
the base face. Matches become materially easier — that is the correction, not
a regression.

## Assumes

- **D-1413** — `tactic !== true` identifies the base card and `tactic ===
  true` identifies tactic cards; this is a registry schema contract, not a
  heuristic. ✅ on `main` (cited in the existing `// why:` at the loop).
- `findMastermindCards` (internal, non-exported) in
  `packages/game-engine/src/mastermind/mastermind.setup.ts` is the sole
  **computing** writer of `MastermindState.baseCardId`. Its caller
  `buildMastermindState` also assigns `baseCardId` on three degenerate
  early-return paths (fallback `baseCardId: mastermindId` when the mastermind
  cannot be resolved); those are **unchanged** by this WP. ✅ on `main`.
- `packages/game-engine/src/mastermind/mastermind.setup.test.ts` is the
  existing test surface for this function. ✅ on `main`.
- Card data ships base faces **before** Epic faces within each mastermind's
  `cards` array — verified across all 24 affected sets at draft. This WP does
  **not** depend on that ordering for correctness beyond "the base face is
  the first non-tactic entry", which is the contract it locks.
- Baseline: `origin/main` @ `9c456412`; engine suite **1991 pass / 464 suites
  / 0 fail** observed at draft.

## Context (Read First)

- `packages/game-engine/src/mastermind/mastermind.setup.ts` —
  **AUTHORITATIVE for** mastermind face classification and
  `MastermindState` construction. The defect is the `baseCard` assignment in
  `findMastermindCards`'s card loop; the exported entry point is
  `buildMastermindState`, whose three degenerate early-returns also set
  `baseCardId` and are out of scope
- `packages/game-engine/src/mastermind/mastermind.types.ts` —
  **AUTHORITATIVE for** the `MastermindState` shape (`baseCardId`,
  `tacticsDeck`)
- `packages/game-engine/src/mastermind/mastermind.setup.test.ts` —
  **AUTHORITATIVE for** the existing setup test contract this WP extends
- `docs/ai/DECISIONS.md` — scan **D-1413** (the tactic-flag schema
  contract this classifier implements), **AUTHORITATIVE for** why
  `tactic !== true` is the discriminator
- `docs/ai/ARCHITECTURE.md` §Layer Boundary — **AUTHORITATIVE for** the
  rule that setup-time registry reads are permitted and runtime reads are
  not; this WP stays entirely setup-side
- `data/cards/co2e.json` and `data/cards/xmen.json` — representative
  two-non-tactic-face sets used for the new test fixture

## Design Rationale

The loop was written when every mastermind in the registry had exactly one
non-tactic face, so "assign on every non-tactic card" and "assign the base
card" were indistinguishable. They diverged silently the first time a set
shipped an Epic face. Nothing failed loudly because `baseCard` is always
non-null and the resulting `MastermindState` is structurally valid — only its
*content* is the wrong face.

**Why first-wins rather than an explicit `epic` flag check.** The registry
schema's discriminator is `tactic`, per D-1413; there is no `epic` field to
key on, and inventing one is a registry-contract change well outside a bug
fix. "First non-tactic face is the base card" is the minimal contract that
makes the existing data resolve correctly, and it matches how the data is
authored across all 24 affected sets.

**Why alternate faces become unreachable, deliberately — and why that needs
two different follow-ups.** On the tabletop, Epic is an opt-in harder variant
chosen during setup; the engine has no such switch (`MatchSetupConfig`
carries a `mastermindId`, not a variant). The 9 transformation faces are a
*different* feature: they are not chosen at setup at all, they are entered
mid-match when the card's condition fires. So the honest post-fix state is
starting-face-always, with **two** distinct capabilities deferred: an Epic
opt-in in the match-setup envelope (56 masterminds), and in-match mastermind
transformation (9). D-24193 names both; neither is in scope here. Collapsing
them into a single "Epic opt-in" would mis-scope the transformation work.

**Scaffold result (observed at draft, not reasoned).** The one-line guard was
prototyped on the draft worktree and both gates run against it. Engine
suite: **1991 pass / 464 suites / 0 fail** — byte-identical to the baseline,
so **no existing fixture, snapshot, or test encodes alternate-face values as
expected output.** `pnpm sim:runtime-observed:check` with the guard applied
printed `OK: runtime-observed hollows artifact is current` with **no
regeneration** (`docs/ai/coverage/` unmodified) — AC-6 observed, not
asserted. That is the
WP-254 failure class this check exists to catch, and it is clear. The
behavior change was confirmed in the same run:

| Mastermind | Before (last-wins) | After (first-wins) | Tactics |
|---|---|---|---|
| `co2e/doctor-doom` | Epic Doctor Doom, attack `12+` | Dr. Doom, attack `10+` | 4 → 4 |
| `co2e/red-skull` | Epic Red Skull, attack `10+` | Red Skull, attack `7` | 4 → 4 |

Red Skull is the larger swing — `10+` to `7` — and is the affected mastermind
most likely to be noticed, since it is the one WP-386 just shipped a strike
resolver for. Tactic counts are unchanged in both cases, confirming the guard
does not disturb tactic collection (AC-3).

The scaffold was reverted; it is not part of this WP's diff. These numbers
are **draft-observed — re-observe them at execution and do not carry them
forward if the baseline has moved** (`main` advances; see EC-419
§Before Starting).

**Determinism surfaces are expected byte-identical.** Every `core` mastermind
has exactly one non-tactic face, and both the recorded sentinel fixture and
the runtime-observed sim matrix pin `core/dr-doom` — so no committed hash or
artifact is reachable from the changed behavior. Any drift is a
STOP-and-investigate, never a re-pin. Exact paths:
`packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
and `docs/ai/coverage/runtime-observed-hollows.json`, whose
`matrixDescription` reads `mastermind=core/dr-doom`.

**One non-committed surface does shift, by design.** The weekly full-axis
sweep fixture `data/sweep-fixtures/mastermind-ids.full.json` (106 entries)
covers every affected mastermind, so `.github/workflows/sweep-weekly.yml`
outcomes will change for all 65. It is neither a repo-committed oracle nor a
PR gate, so it blocks nothing — but "determinism surfaces byte-identical"
means *committed* surfaces, not this one. The nightly axis
(`mastermind-ids.json` = `core/dr-doom`, `core/magneto`) is unaffected.

## Scope (In)

- The `baseCard` assignment in `findMastermindCards`'s card loop: assign
  only when no base card has been chosen yet, so the **first** non-tactic
  face wins. Tactic collection is unchanged: the guard sits inside the
  existing `else`, so every `tactic === true` card is still appended
  regardless of position. (Defensive only — across all 41 sets, zero
  masterminds ship a tactic before their first non-tactic face. Do not treat
  the ordering tolerance as load-bearing, and do not add a `break`, which
  WOULD drop later tactics.)
- The `// why:` comment at that loop, extended to state that the first
  non-tactic face is the base card and that later non-tactic faces are Epic
  variants deliberately not selected.
- Tests in `mastermind.setup.test.ts`: a two-non-tactic-face mastermind
  resolves `baseCardId` to the **first** face, with a **negative assertion**
  that it is not the Epic face; a single-non-tactic-face mastermind is
  unchanged; tactics are still fully collected when a second non-tactic face
  is present.

## Out of Scope

- Any `epic` opt-in in `MatchSetupConfig` or the loadout envelope — the
  9-field composition lock stands; the future WP is named in D-24193.
- Any registry schema change (no new `epic` field).
- Any card-data change.
- `WP-388`'s co2e strike-text resolvers — WP-388 hard-deps on this WP and
  resumes after it lands.
- **No edit to the WP-386 `// why:` comment in `mastermindHandlers.ts`.**
  It asserts that setup "selects the first non-tactic face" and that the
  epic face "is never engine-selectable" — both false today, and both made
  **true** by this WP. Landing this fix validates the comment as written
  rather than requiring a correction. (`wiki/master-strike.md` was corrected
  separately, at the drafting commit, because a wiki page has no such
  self-healing property.)
- Any new `G` field, zone, `RuleEffect` type, move, or phase change.
- **Masterminds with ZERO non-tactic faces** — `2099/sinister-six-2099`,
  `2099/alchemax-executives`, `shld/hydra-high-council`,
  `shld/hydra-super-adaptoid`. These already resolve to the degenerate empty
  state today (`baseCardId = mastermindId`, empty `tacticsDeck`); this WP
  leaves that guard untouched (AC-4) and does not fix them. A separate
  pre-existing defect — `hydra-high-council` is referenced by
  `content/themes/aim-modok.json` and `hydra-uprising.json`, so it is
  reachable content. Flagged as a follow-up, deliberately not bundled.

## Files Expected to Change

- `packages/game-engine/src/mastermind/mastermind.setup.ts` — **modified** —
  first-wins `baseCard` assignment + the extended `// why:` comment
- `packages/game-engine/src/mastermind/mastermind.setup.test.ts` —
  **modified** — the two-non-tactic-face describe-block covering AC-1..AC-4
- `docs/ai/STATUS.md` — **modified** — close-out entry for this WP
- `docs/ai/DECISIONS.md` — **modified** — D-24193 flips from Drafted to
  Active
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-389 checkbox flip
  with date
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-419 status
  flip to Done
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip this WP's node glyph
  `📝` → `✅`, then `pnpm roadmap:counts:write`. Required: the drafting commit
  added the `📝` node, and the WP-386 precedent (`7bd2cc6e`) flips it at
  execution. The counts table self-heals via the `roadmap-counts.yml` cron;
  the node glyph does not.

## Non-Negotiable Constraints

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs, no snippets)
> - ESM only, Node v22+
> - Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`
> - No `Math.random()`; no wall-clock reads; no new dependency
> - No `boardgame.io` import in `mastermind.setup.ts` (it has none today)
> - `Game.setup()` may throw; this function keeps its existing null-return
>   contract on an unresolvable mastermind — do not convert it to a throw
> - No new `G` field, zone, `RuleEffect` type, move, or phase change
> - Do not "fix" the ordering by sorting, filtering, or reordering the
>   registry `cards` array — the fix is the assignment guard, nothing else
> - Locked behavior: see `## Contract` below — do not re-derive it
> - If any item is unclear or appears to conflict with the source, STOP and
>   ask rather than improvising

## Contract

**Locked behavior.** Within `findMastermindCards`'s loop over
`mastermind.cards` (the internal helper called by `buildMastermindState`):

- `card.tactic === true` → append to `tacticCards` (unchanged).
- Otherwise → assign to `baseCard` **only if `baseCard` is still null**.

The resulting contract: **the base card is the first non-tactic face in the
registry's `cards` array.** Every later non-tactic face is an **alternate
face** and is not selected by any code path in this WP.

Alternate faces are not all "Epic": of the 65 affected masterminds, **56
carry an Epic variant** and **9 carry a transformation / second-form face** —
`wwhk` x6 (e.g. `general-thunderbolt-ross` -> *Red Hulk*, `sentry-the` ->
*The Void*) and `amwp` x3 (e.g. `darren-cross` -> *Yellowjacket*). First-wins
is correct for both: in each case the first face is the **starting** face.

Unchanged: the `if (!baseCard) return null;` guard, `MastermindState`
construction, `tacticsDeck` contents and order, and every other field.

## Vision Alignment

- **Vision clauses touched:** §1 (Faithful Legendary rules), §2 (Real card
  content behaves as printed), §22 (Deterministic Eval).
- **Conflict assertion:** No conflict: this WP preserves all touched
  clauses — it restores the printed base card as the played card, which is
  what §1/§2 require, and changes no randomness or replay behavior.
- **Non-Goal proximity check:** N/A — no monetization, identity, or
  competitive-scoring surface. None of NG-1..7 are crossed. (Note: matches
  become easier, which is a difficulty correction, not a scoring change; no
  PAR or leaderboard input is touched.)
- **Determinism preservation:** No RNG is added or removed. All `core`
  masterminds have a single non-tactic face, and both the sentinel fixture
  and the runtime-observed matrix pin `core/dr-doom`, so committed hash and
  artifact surfaces are expected byte-identical; any drift is a
  STOP-and-investigate, never a silent re-pin.

## Funding Surface Gate

N/A — engine gameplay fidelity only; no UI funding affordances, no
user-visible funding copy, no funding channels referenced (§20.1 surfaces
absent).

## API Catalog Update

N/A per D-11804 — no HTTP endpoint and no `apps/server`-reachable library
function is added, modified, removed, or status-changed.

## Acceptance Criteria

- **AC-1** A mastermind with two non-tactic faces (base then Epic) resolves
  `baseCardId` to the **first** face. The test asserts positively on the base
  id **and negatively** that the value is not the Epic id — a guard that
  cannot pass vacuously.
- **AC-2** A mastermind with exactly one non-tactic face resolves
  `baseCardId` to that face — byte-identical to pre-WP behavior.
- **AC-3** With a second non-tactic face present, `tacticsDeck` still
  contains every `tactic === true` card, in unchanged order — the fix must
  not drop or reorder tactics.
- **AC-4** A mastermind with zero non-tactic faces still returns `null`
  (the existing guard is untouched) and does not throw.
- **AC-5** The full engine suite passes with the pre-existing baseline plus
  the new tests, 0 fail.
- **AC-6** Sentinel `finalStateHash`, `PRE_WP080_HASH`, and
  `sim:runtime-observed:check` are byte-identical with **no regeneration**.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` exits 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; baseline 1991
   plus the new tests, 0 fail.
3. `pnpm -r build` exits 0.
4. `pnpm sim:runtime-observed:check` exits 0 **and performs no
   regeneration**.
5. Sentinel `finalStateHash` and `PRE_WP080_HASH` byte-identical.
6. Ad-hoc confirmation, recorded in the close-out: resolving `co2e/doctor-doom`
   yields the base `Dr. Doom` face (attack `10+`), not `Epic Doctor Doom`
   (attack `12+`).
7. `git diff --name-only` (staged changes) equals the seven-file allowlist
   exactly.

## Definition of Done

- [ ] All Acceptance Criteria AC-1..AC-6 satisfied.
- [ ] All Verification Steps green with the recorded observed output.
- [ ] **No files outside `## Files Expected to Change` were modified**
      (`git diff --name-only` on staged changes = the seven-file allowlist).
- [ ] `docs/ai/DECISIONS.md` — D-24193 flipped to Active.
- [ ] `docs/ai/STATUS.md` close-out entry recorded.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` rows flipped with date.
- [ ] `User-Visible Surface = play.legendary-arena.com` — D-24026
      live-on-surface verification recorded (a deployed match on an affected
      mastermind shows the base face, not the Epic face). Operator-pending on
      deploy is acceptable if recorded as such.

## Reserved Decision (lands at execution)

**D-24193 — the base card is the first non-tactic mastermind face; Epic
faces are unreachable until an explicit opt-in exists.** Drafted in
`docs/ai/DECISIONS.md` at this WP's drafting commit; flips to Active at
execution. The D-entry carries the defect's history, the 65-mastermind blast
radius, why first-wins is the minimal correct contract under D-1413, and the
named future WP for an opt-in Epic variant.

## Pre-Flight Resolutions (01.4)

First pre-flight returned **NOT READY** with five blocking items. All resolved
in place; scope unchanged, so no full re-run was required.

- **PS-1 — the WP named a function that does not exist.** Every artifact said
  `resolveMastermindSetup`; there is no such symbol. The exported entry point
  is `buildMastermindState` and the defect lives in its internal helper
  `findMastermindCards`. Renamed across the WP, EC-419, D-24193, WORK_INDEX,
  and the wiki page. `§Assumes` also over-claimed "sole producer of
  `baseCardId`" — `buildMastermindState` assigns it on three degenerate
  early-returns too; restated as sole *computing* writer with those paths
  named out of scope.
- **PS-2 — "every later non-tactic face is an Epic variant" was false for 9 of
  65.** `wwhk` x6 and `amwp` x3 carry transformation / second-form faces, not
  Epic variants. The fix direction is unaffected (first face is the starting
  face either way), but the framing mattered: D-24193 would have landed a
  false generalization permanently, and it would have mis-scoped the follow-up
  by folding in-match transformation into an "Epic opt-in". Now recorded as
  two distinct deferred features.
- **PS-3 — WORK_INDEX contradicted the six-file allowlist** ("two downstream
  corrections landed alongside"). Corrected: the wiki fix rides the drafting
  commit, and the WP-386 `// why:` comment needs no edit because this WP makes
  its claim true.
- **PS-4 — no Empirical Scaffold.** Run: guard prototyped, engine suite
  **1991 / 0 fail**, `sim:runtime-observed:check` current with no
  regeneration, tactic counts 4 -> 4, behavior flip confirmed on two
  masterminds. Recorded in `§Design Rationale`; scaffold reverted.
- **PS-5 — drafting commit not landed.** Closes at the `SPEC:` drafting
  commit that carries this file; it is not verifiable until that lands.

Clarifications folded in: the weekly full-axis sweep fixture shifts for all 65
(non-committed, not a PR gate) is now stated explicitly; the sentinel fixture
path was wrong and is corrected; the four zero-non-tactic-face masterminds are
recorded as an adjacent unfixed defect; the tactic-ordering tolerance is
marked defensive-only so no future reader treats it as load-bearing.

## Lint Gate Self-Review (00.3)

Run at draft against all 21 sections, independently audited rather than
self-asserted. §1–§9 PASS (structure, constraints block, dependency-complete
`§Assumes`, caps-tagged AUTHORITATIVE `§Context`, per-file descriptions in
`§Files Expected to Change`, canonical naming, no new dependency, engine-layer
boundary respected, Windows-safe `pnpm` commands). §12–§17 PASS (node:test
extension with a non-vacuous negative assertion per AC-1; six binary
verification steps; six observable ACs; DoD with the scope-boundary check;
boring first-wins guard with no higher-order function; Vision block with the
§17.2 conflict assertion stated in required form). §10, §11, §18, §20, §21
resolve N/A with named justifications — no env var, no auth surface, no
count-bounded grep gate, no funding surface, no API-catalog-bearing change.
