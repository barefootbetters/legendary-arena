# WP-512 — Recover Runtime-Observed Coverage: Portals Backdrop + Deterministic-Termination Guard (Shared Tooling)

**Layer:** Shared Tooling (sim harness scripts) + generated coverage artifact +
Dashboard app test · **Lane:** Standard two-session (multi-artifact: harness
scripts + committed artifact + dashboard test; the WP-259 / WP-511 harness-edit
shape) · **Baseline:** `origin/main` @ `3a51b63d` (WP-511 / D-24322 merged) ·
**User-Visible Surface:** dashboard.legendary-arena.com `/coverage`

## Goal

WP-511 / D-24322 switched the runtime-observed hollows coverage sweep
(`scripts/runtime-observed-hollows.mjs`) and the co-op win-rate yardstick
(`scripts/coop-winrate.mjs`) off the **Legacy Virus** backdrop (whose loss became
deck-dependent and stopped terminating the solo sweep) onto **Cosmic Cube**, at a
real coverage cost: the committed artifact dropped from ~16 to **10** distinct
observed hero mechanics and the `/coverage` in-play metric fell (`totalObs`
178→163). This WP recovers that signal by switching both backdrops to **Portals to
the Dark Dimension** (`core/portals-to-the-dark-dimension`) — a **faithful
true-twist-loss scheme** (printed *"Twist 7: Evil Wins!"*) whose Dark-Portal twists
buff the board (mastermind / city villains) rather than adding Wounds to hero
decks, so the competent bot draws and plays more hero abilities. Measured
(scaffolded at draft, §Scaffold): **10 → 12** distinct mechanics, dashboard
`totalObs` **163 → 188** (above even the pre-WP-511 178), `resolvedObs` **59
(unchanged)**, `percentResolved` **36.2 → 31.4** (lower because the observed
denominator is larger and more honest). It ships with **no engine change**, and
hardens the coverage harness against the exact WP-511 failure mode — a **silent CI
timeout** — with a fast deterministic-termination guard.

## User-Visible Impact

On `dashboard.legendary-arena.com/coverage`, the "Observed in play" signal
recovers: 12 distinct runtime-observed mechanics (up from 10), a larger and more
honest observed-mechanic denominator (`totalObs` 188), and two mechanics
(`rooftops`, `streets`) that Cosmic Cube's wound-polluted decks never surfaced.
The number the operator reads is a truer picture of which hero mechanics actually
fire in play.

## Assumes

- **WP-511 / D-24322 (✅ merged, `3a51b63d`).** Both harness backdrops are
  currently `core/unleash-the-power-of-the-cosmic-cube`; the sim turn loops honor
  pile-depletion losses; the dashboard test pins `totalObs 163` / `percentResolved
  36.2`. D-24322 explicitly flags this optimization as its follow-up.
- **Portals loses via the MVP fallback, deterministically, with no config.**
  `core/portals-to-the-dark-dimension` is **not** in `SCHEME_TWIST_CONFIGS`
  (`packages/game-engine/src/rules/schemeTwistConfigs.ts`), so the dispatcher
  (`schemeHandlers.ts`) uses `MVP_SCHEME_TWIST_THRESHOLD = 7`. Portals' printed
  loss is **"Twist 7: Evil Wins!"** (verified in `data/cards/core.json`), so the
  fallback coincides with the faithful count: it loses on the **twist-count path
  the sim already honors**, deck-independently, every game. This is a **true
  twist-loss** scheme (like Cosmic Cube), so it will never need a
  `resourceLossCondition` — the fragility that would re-break a backdrop does not
  apply here (§Design Rationale).
- **The sweep cell exposes termination.** `sweepSetupMatrix` surfaces
  `cell.endgameReached: boolean` and `cell.outcome`
  (`CapturedOutcomeSummary { winner, escapedVillains }`,
  `packages/game-engine/src/simulation/sweep.runner.ts`). A game that hit
  `MAX_TURNS` without reaching endgame has `cell.endgameReached === false`
  (equivalently `cell.outcome.winner === null`, since `EndgameOutcome` is never
  null — a tie is `'tie'`, so the guard never false-positives on ties) — the exact
  signal for the termination guard.
- **The dashboard build-time copy is derived + gitignored.**
  `apps/dashboard/src/data/runtime-observed-hollows.json` is a byte-copy produced
  at prebuild by `apps/dashboard/scripts/build-coverage-ledger.mjs` from the
  committed artifact; it is not committed. `in-play-hollow-baseline.json` is a
  high-water reference held at 140 and is **not** rebuilt.

## Context (Read First)

**Why Portals, and why no engine change.** The obvious "make it robust" idea
(floated in D-24322) is to give Portals an explicit `lossThreshold: 7` in
`SCHEME_TWIST_CONFIGS`. That is **rejected**: `SchemeTwistConfig.resolverId` is a
**required** field typed to a closed union (`schemeTwistConfig.types.ts`) with no
no-op member, and an unknown id merely logs a "Resolver not found" warning every
twist. So adding a Portals entry means either a **contract-file change**
(`schemeTwistConfig.types.ts` — making `resolverId` optional or adding a member) or
a new no-op resolver — a cross-layer engine change with contract blast radius —
for **zero behavioral gain**, since Portals **already** loses at twist 7 via the
fallback. The harness-only backdrop swap achieves the coverage recovery without
touching the engine.

**Why the ~16 plateau is not recoverable (and SEEDS_PER_BOARD stays 8).** The old
16 was **Legacy-Virus-specific**: its "reveal a tech Hero or gain a Wound" twist
wounded only *tech* heroes (minimal deck pollution) and is now a deck-dependent
real loss (WP-511) that no longer terminates the solo sweep. Scaffolding (§Scaffold)
showed Portals **plateaus at 12** — 8, 16, and 24 seeds/board all surface the
identical 12-mechanic set — so bumping `SEEDS_PER_BOARD` buys nothing but CI time.
Chasing 16 would mean re-introducing a wound-on-reveal backdrop, i.e. the exact
non-termination WP-511 removed. 12 (a strict +2 over Cosmic) is the realistic,
deterministic recovery; the WP documents this so a future reader does not re-attempt
the seed bump.

**Why also switch the coop yardstick.** Scaffolding showed **all three** backdrops
(Cosmic, Portals, Legacy Virus) give the competent bot a **0.0%** co-op win rate —
the yardstick floor is a bot-strength property owned by the Bot-Ally Strengthening
epic (WP-452 lineage), **not** a backdrop property. Portals plays 60 **real** games
in the 2p config (all scheme-completed at twist 7; **no** turn-0 auto-loss, **no**
turn-cap). Switching coop to Portals costs the yardstick nothing and keeps **both**
sim harnesses on one sentinel scheme.

**The robustness mechanism is a harness guard, not a config.** WP-511's failure was
a **silent CI timeout** (Legacy Virus games ground to `MAX_TURNS`). This WP adds a
fast deterministic-termination guard to `runtime-observed-hollows.mjs`: after the
harvest, if **any** swept game did not reach endgame (`cell.outcome.winner ==
null`), throw `ProbeFailure` (exit 2) with a full-sentence message. This protects
the backdrop **regardless of why** it might stop terminating (an MVP-constant
change, an ill-advised future `resourceLossCondition` on the backdrop) — the sweep
fails **loudly and immediately** instead of timing out after 10 minutes. It is the
stronger, cheaper answer to the fragility D-24322 named — strictly better than the
rejected explicit-config approach, which would not even protect against a future
resource-condition config.

## Design Rationale

**Portals is faithful.** Its printed Evil-Wins **is** the twist count (7), so
losing at twist 7 via the fallback is correct game behavior, not an approximation —
unlike using an unconfigured resource-loss scheme (Killbots / Secret Invasion),
which would lose at the *wrong* count (their printed stacks are 5 / 8). Portals is
the one clean, non-polluting, faithful, deterministic core backdrop.

**Termination guard reuses the existing harness idioms.** The guard counts
cap-hits in the shared `aggregateCell` callback and asserts zero in the existing
`assertHarvestLoaded` sibling — same `ProbeFailure` / exit-2 path already in the
file. No new dependency, no engine read.

## Scaffold (measured at draft — evidence, not reasoning)

Ran the real harness dist over the committed 39-set hero matrix (throwaway
harvester + the actual `runtime-observed-hollows.mjs` with the backdrop swapped,
then reverted):

| Backdrop | distinct | artifact obs | games | terminated | dashboard totalObs | %resolved |
|---|---|---|---|---|---|---|
| Cosmic Cube (current) | 10 | 98 | 312 | 312 / 312 | 163 | 36.2 |
| **Portals (this WP)** | **12** | **125** | **312** | **312 / 312** | **188** | **31.4** |
| Legacy Virus (pre-511) | ~16 | — | — | **not deterministic** | 178 | 33.1 |

- Portals adds `rooftops` + `streets` over Cosmic; `resolvedObs` stays **59**.
- Portals @ 8 / 16 / 24 seeds all yield the **identical 12** mechanics (plateau).
- Coop (2p Magneto board): Cosmic / Portals / Legacy Virus all **0.0%** win-rate;
  Portals = 60 / 60 scheme-completed, **0** turn-cap, **0** turn-0 auto-loss.
- Sweep wall time ~3 s (unchanged); `sim:runtime-observed:check` stays fast.

## Scope (In)

- `scripts/runtime-observed-hollows.mjs`:
  - `SENTINEL_CORE.schemeId`: `core/unleash-the-power-of-the-cosmic-cube` →
    `core/portals-to-the-dark-dimension`.
  - Replace the WP-511 backdrop `why:` block with the Portals rationale (faithful
    twist-7 loss via the MVP fallback; non-polluting; no engine config).
  - **Fix the stale header comments** (drift from the Legacy-Virus era): change
    only the **mechanic-count** tokens — the matrix comment "...plateaus at **16**
    by 8 seeds" and the `SEEDS_PER_BOARD` comment "...all surface **16** mechanics"
    → **12**. **Leave the seed-count list "8, 16, and 24 seeds" intact** (those 16s
    are seed counts, not a mechanic count — do not blanket-replace 16).
  - **Add the deterministic-termination guard:** count games that did not reach
    endgame in `harvest` and throw `ProbeFailure` (exit 2, full sentence) if any,
    before writing / checking the artifact. Signal: **`cell.endgameReached ===
    false`** (the purpose-built flag on the sweep cell,
    `sweep.runner.ts`) — equivalently `cell.outcome.winner == null` today, since
    `EndgameOutcome` is never null; either is acceptable, `endgameReached` is the
    self-documenting choice.
- `scripts/coop-winrate.mjs`: `MATCH_CONFIGURATION.schemeId` → Portals; **fully
  rewrite** the scheme-substitution comment block (lines ~54–64) — it is currently
  **doubly stale**, still narrating the WP-452 / EC-487 swap to *Legacy Virus*
  though WP-511 already moved the value to Cosmic Cube. Replace the whole block with
  the Portals rationale + shared-sentinel note; do **not** append to the stale
  prose.
- `docs/ai/coverage/runtime-observed-hollows.json`: **regenerate** on the Portals
  backdrop via `pnpm sim:runtime-observed` — expected `distinctMechanics: 12`,
  `totalObservations: 125`, `gamesPlayed: 312`, `hollowEffectsDropped: 0`, with
  `rooftops` + `streets` present. (Derived artifact; the harness writes it.)
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: lockstep pinned-value
  update `totalObs` 163 → **188**, `percentResolved` 36.2 → **31.4** (`resolvedObs`
  stays 59; `remaining` stays non-empty); replace the WP-511 comment block with a
  WP-512 note.

## Out of Scope

- **Any engine change** — no `SCHEME_TWIST_CONFIGS` entry, no
  `schemeTwistConfig.types.ts` change, no resolver. Portals loses via the fallback;
  the explicit-`lossThreshold` option is contract-touching for zero behavioral gain
  (Context) and is deliberately rejected here (recorded in D-24323).
- **Bumping `SEEDS_PER_BOARD` / `MAX_TURNS` to chase ~16** — measured
  unrecoverable (Portals plateaus at 12; the 16 was Legacy-Virus-specific and is
  now deck-dependent).
- **Modeling Portals' Dark-Portal twist resolver** (board placement + villain /
  mastermind buffs) — a future scheme-fidelity item; a coverage backdrop needs only
  deterministic termination, which the fallback already gives.
- **The coop yardstick's 0% bot win-rate** — a bot-strength property owned by the
  Bot-Ally Strengthening epic (WP-452 lineage), not a backdrop concern.
- **`apps/dashboard/src/data/runtime-observed-hollows.json`** (gitignored,
  regenerated at prebuild) and **`in-play-hollow-baseline.json`** (high-water
  reference held at 140 — **not** rebuilt).
- Any `packages/**` source change; any `finalStateHash` / `PRE_WP080_HASH` surface;
  the `sim:coop-winrate` artifact (it is print-only — no artifact, no CI gate,
  D-24272).

## Files Expected to Change

| File | Change |
|---|---|
| `scripts/runtime-observed-hollows.mjs` | backdrop `schemeId` → Portals; Portals rationale comment; **fix stale "16" header comments** → 12; **add deterministic-termination guard** (throw on any `winner == null` game) |
| `scripts/coop-winrate.mjs` | `MATCH_CONFIGURATION.schemeId` → Portals; update comment |
| `docs/ai/coverage/runtime-observed-hollows.json` | regenerate on Portals (12 mechanics / 125 obs / 312 games / dropped 0) |
| `apps/dashboard/src/composables/useInPlayCoverage.test.ts` | lockstep pins `totalObs` 163→188, `percentResolved` 36.2→31.4 (`resolvedObs` 59) + comment |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`,
`DECISIONS.md` (D-24323 Active at execution), `NUMBER-LEDGER.md` (reserved),
`STATUS.md`.

## Non-Negotiable Constraints

- **No `packages/**` change.** The backdrop swap is harness-only; Portals loses via
  the existing MVP fallback. `git diff --name-only` must show zero `packages/`
  files.
- The termination guard reuses the file's existing `ProbeFailure` / exit-2 idiom;
  it reads `cell.outcome.winner` (already surfaced), adds no engine read, and does
  not re-classify hollow reasons.
- The artifact is **regenerated**, never hand-edited — its byte-stable serializer
  (sorted `byMechanic`, closed-order `byReason`, two-space indent, one trailing
  newline) is untouched.
- The dashboard test pins are the **measured** values (`totalObs` 188,
  `percentResolved` 31.4, `resolvedObs` 59) — read from the regenerated artifact,
  not guessed; `in-play-hollow-baseline.json` stays at its 140 high-water.
- `SEEDS_PER_BOARD` stays **8**; `MAX_TURNS` stays **50**. No knob bump.

**Engine-wide (standing) constraints.** Honor `.claude/rules/code-style.md` +
`00.6-code-style.md` (human-style, JSDoc, `// why:` on the backdrop choice + the
guard); ESM-only `.mjs` scripts, `.test.ts` on `node:test`, Node v22+. Work from
full file contents.

## Contract

- **Coverage + coop backdrop** = `core/portals-to-the-dark-dimension` (both
  harnesses), losing at printed twist 7 via `MVP_SCHEME_TWIST_THRESHOLD` (no engine
  config).
- **`runtime-observed-hollows.json`** = `distinctMechanics: 12`,
  `totalObservations: 125`, `gamesPlayed: 312`, `hollowEffectsDropped: 0`.
- **Coverage harness invariant:** every swept game reaches endgame
  (`cell.endgameReached === true`, equivalently `cell.outcome.winner != null`);
  otherwise the harness throws `ProbeFailure` (exit 2).
- **Dashboard in-play coverage** = `totalObs 188`, `resolvedObs 59`,
  `percentResolved 31.4`.

## Vision Alignment

§22 (product legibility / observability) — restores a truer `/coverage` signal.
§3 (faithful rules) — Portals loses at its printed twist 7. NG-1..7 not crossed.
**Determinism (§8):** no engine change, no `G`/RNG/wall-clock/IO surface; the
artifact stays a fixed-seed byte-stable regenerate; no `finalStateHash` /
`PRE_WP080_HASH` interaction.

## Funding Surface Gate

N/A — no pricing / checkout / account surface.

## API Catalog Update

N/A — no `apps/server` endpoint or `Library-only` export change.

## Acceptance Criteria

1. `SENTINEL_CORE.schemeId` (`runtime-observed-hollows.mjs`) and
   `MATCH_CONFIGURATION.schemeId` (`coop-winrate.mjs`) are both
   `core/portals-to-the-dark-dimension`.
2. `pnpm sim:runtime-observed` regenerates the committed artifact with
   `distinctMechanics: 12`, `totalObservations: 125`, `gamesPlayed: 312`,
   `hollowEffectsDropped: 0`, and `rooftops` + `streets` present in `byMechanic`.
3. The coverage harness throws `ProbeFailure` (exit 2, full-sentence message) if any
   swept game did not reach endgame; a control injection of a `winner == null` game
   trips it (non-vacuous), and the real Portals sweep does **not** (0 cap-hits).
4. `pnpm sim:runtime-observed:check` exits 0 and completes in ~seconds (no timeout).
5. `apps/dashboard/scripts/build-coverage-ledger.mjs` regenerates the build-time
   copy; `useInPlayCoverage` pins `totalObs === 188`, `percentResolved === 31.4`,
   `resolvedObs === 59`, `remaining.length > 0`; the dashboard suite is green.
6. `pnpm sim:coop-winrate` runs to completion on Portals (real games — no turn-0
   auto-loss, no turn-cap); print-only, no committed artifact.
7. No `packages/**` diff; no engine / determinism / `finalStateHash` surface
   touched; `git diff --name-only` = the four-file allowlist + governance.
8. Whole-workspace `pnpm -r --no-bail test` green.

## Verification Steps

1. `pnpm -r build` → 0.
2. Swap both backdrops; `pnpm sim:runtime-observed` → prints `12 distinct
   mechanic(s); 125 observation(s); dropped 0`; artifact `git diff` shows the
   12-mechanic set incl. `rooftops` + `streets`.
3. `pnpm sim:runtime-observed:check` → `OK` in ~seconds.
4. Control: temporarily force a `winner == null` cap-hit (or point the backdrop at
   a non-terminating scheme) → the harness throws `ProbeFailure` (exit 2). Restore.
5. `node apps/dashboard/scripts/build-coverage-ledger.mjs`; `node --import tsx
   --test apps/dashboard/src/composables/useInPlayCoverage.test.ts` → green on the
   188 / 31.4 pins.
6. `pnpm sim:coop-winrate` → runs, prints a real report on Portals.
7. `pnpm -r --no-bail test` → green; `git diff --name-only` = the four-file
   allowlist + governance.
8. **D-24026 live-verify (operator-pending):** `/coverage` "Observed in play" shows
   12 mechanics and the recovered `totalObs`.

## Definition of Done

- [ ] All Acceptance Criteria met; whole-workspace green.
- [ ] Artifact **regenerated** (not hand-edited): 12 / 125 / 312 / 0.
- [ ] Deterministic-termination guard added + non-vacuous control-trip verified.
- [ ] Dashboard pins `188` / `31.4` / `59`; `in-play-hollow-baseline.json`
      unchanged at 140.
- [ ] No `packages/**` diff; `git diff --name-only` = allowlist + governance.
- [ ] D-24323 Active; WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `📝`→`✅`;
      `roadmap:counts:check` 0; STATUS close-out.
- [ ] Two-commit topology (EC-547 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decisions (land at execution)

**D-24323** — The runtime-observed coverage sweep + co-op yardstick backdrop is
switched from Cosmic Cube to **Portals to the Dark Dimension**
(`core/portals-to-the-dark-dimension`), recovering the runtime-observed signal to
**12** distinct mechanics (dashboard `totalObs` 163→188, `resolvedObs` 59,
`percentResolved` 36.2→31.4). Portals is a **true twist-loss** scheme (printed
"Twist 7: Evil Wins!") that loses at twist 7 via the `MVP_SCHEME_TWIST_THRESHOLD`
fallback — **no engine change**, and its Dark-Portal twists buff the board rather
than polluting hero decks (unlike Cosmic Cube's "wound all"), so more hero
abilities fire. The explicit-`lossThreshold` engine option (D-24322's follow-up
suggestion) is **rejected**: a `SCHEME_TWIST_CONFIGS` entry needs a required
`resolverId` (contract-touching) for zero behavioral gain. The old ~16-mechanic
plateau is **not** recoverable — it was Legacy-Virus-specific and is now
deck-dependent; Portals plateaus at 12, so `SEEDS_PER_BOARD` stays 8. The coop
yardstick is switched in lockstep (cosmetic — the 0% bot win-rate is
backdrop-independent, a Bot-Ally-epic concern). The coverage harness gains a
**deterministic-termination guard** (throw `ProbeFailure` if any swept game did not
reach endgame) so a future non-terminating backdrop fails loudly instead of timing
out the `sim:runtime-observed:check` gate — the WP-511 lesson. No `finalStateHash` /
`PRE_WP080_HASH` interaction.

## Numbering note

WP-510 / WP-511 prose loosely forward-referenced "WP-512" for the *scheme-fidelity*
epic's continuation (Civil War 4-hero-2p sizing / conversion schemes). Those were
narrative pointers, not `NUMBER-LEDGER` reservations, and the two even disagree on
what "WP-512" would be. Per the ledger (D-24245, the anti-collision authority)
WP-512 was next-free and is claimed here for this D-24322 coverage-backdrop
follow-up — a different lane (sim-harness/coverage, not scheme faithfulness). The
deferred scheme-fidelity items remain unreserved and will draw their own next-free
numbers.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS. **§2 Non-Negotiable Constraints** — PASS (no
  `packages/**`; regenerate-not-edit; pins measured).
- **§3 Assumes** — PASS (WP-511 merged; Portals fallback-loss verified in card
  data; cell termination signal; derived dashboard copy).
- **§4 Context** — PASS (engine option rejected with reason; 16 unrecoverable;
  coop cosmetic; guard rationale).
- **§5 Files Expected to Change** — PASS (closed four-file allowlist + governance).
- **§6 Naming Consistency** — PASS (`SENTINEL_CORE`, `MATCH_CONFIGURATION`,
  `distinctMechanics`, `totalObs`, `percentResolved`, `resolvedObs`,
  `MVP_SCHEME_TWIST_THRESHOLD`).
- **§7 Dependency Discipline** — PASS (WP-511 / D-24322 ✅ on `main`).
- **§8 Architectural Boundaries** — PASS (Shared Tooling + dashboard test; **no
  engine change**; scripts import compiled dist per the WP-259 precedent; no
  `.reduce()` in the guard).
- **§9–§11** — N/A (no shell-injection / env / auth surface; scripts read local
  data + dist only).
- **§12 Test Quality** — PASS (`node:test`; the termination guard is non-vacuously
  control-trippable; dashboard pins are measured).
- **§13 Commands & Verification** — PASS (regenerate + `:check` + dashboard test +
  whole-workspace; explicit control-trip step).
- **§14 Acceptance Criteria** — PASS (8 testable ACs with measured numbers).
- **§15 Definition of Done** — PASS (binary gates + two-commit topology).
- **§16 Code Style** — PASS. **§17 Vision Alignment** — PASS (§22 observability;
  §3 faithful; determinism line).
- **§18 Prose-vs-Grep** — PASS (numbers scaffolded, not asserted). **§19
  Bridge-vs-HEAD** — PASS (baseline `3a51b63d` cited).
- **§20 Funding Surface** — N/A. **§21 API Catalog** — N/A.

Pre-flight verdict: **READY TO EXECUTE** — all load-bearing contract claims
verified against source by an independent adversarial reviewer (resolverId is a
required closed union with no no-op member; `MVP_SCHEME_TWIST_THRESHOLD = 7`;
Portals card text "Twist 7: Evil Wins!"; `cell.endgameReached` / `outcome.winner`
termination signal; dashboard pins internally consistent, 59/188 = 31.4). RS items
folded: RS-1 (seed-list "16" must not be blanket-replaced — now called out in Scope
+ EC); RS-2 (`endgameReached` is the canonical guard signal — now the primary);
RS-3 (the coop comment is doubly stale to Legacy Virus and must be fully rewritten,
not appended — now called out). Copilot verdict: **PASS** — no fabricated
names, no scope leak, no packages/** force; C-1..C-3 = the same three RS items,
all low-severity and folded.
