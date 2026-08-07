# WP-506 — Core Magneto Tactic "Crushing Shockwave" onFight Resolver (Game Engine)

**Layer:** Game Engine · **Lane:** Standard two-session (mutates the
determinism surface — engine game-state effect; lightweight-lane
ineligible per 01.0a eligibility #6/#8) · **Baseline:** `origin/main` @
`7dbebf94` · **User-Visible Surface:** play.legendary-arena.com

## Goal

Defeating core Magneto's **"Crushing Shockwave"** tactic currently fires
**none** of its printed **Fight:** ability. The tactic-onFight dispatch
framework (WP-497 / D-24300) is in place and fires correctly, but ships a
single resolver — co2e Doctor Octopus's "Octet of Valence Electrons" — so
every other tactic ext_id, including all four core Magneto tactics, falls
through `dispatchTacticOnFight` to the silent no-op. This WP adds the second
resolver in the arc: **"Fight: Each other player reveals an [team:x-men] Hero
or gains two Wounds."** After it lands, defeating Crushing Shockwave makes
each *other* player who cannot reveal an X-Men Hero gain two Wounds.

## User-Visible Impact

On `play.legendary-arena.com`, when a player defeats Magneto's "Crushing
Shockwave" tactic, every **other** player who holds no X-Men Hero in hand
gains **two Wounds**, and the play-by-play log records the Fight effect
firing per player. Today that tactic (and every other Magneto tactic) is
inert — confirmed live 2026-08-06 in a core Magneto co-op match (log lines
17.2.10 Bitter Captor and 20.2.15 Xavier's Nemesis: tactic defeated, zero
tactic effect).

## Assumes

- **WP-497 / D-24300** (Mastermind Tactic onFight Execution Framework, ✅) —
  `dispatchTacticOnFight(G, ctx, defeatedTacticId)` in
  `rules/tacticHandlers.ts`, already wired as the final step of
  `defeatMastermindTacticCore` (`moves/fightMastermind.ts`), firing on
  `ctx.currentPlayer` for every tactic defeat. This WP adds one more branch to
  that dispatcher. **Hard dependency** — WP-497 must be landed on `main`
  before this executes.
- **WP-388 / D-24192** (co2e strike texts, ✅) and **WP-476 / D-24284**
  (Magneto Master Strike, ✅) — the per-mastermind reveal-or-penalty resolver
  pattern in `rules/mastermindHandlers.ts` this resolver mirrors, and the
  **deterministic auto-resolution** stance for printed "reveals … or …"
  clauses (auto-reveal when able; else take the penalty — the player-optimal
  read, no blocking multi-player pending-choice). `resolveCo2eMagnetoStrike`
  ("each player discards an X-Men Hero or gains a Wound") is the closest
  sibling.
- **WP-179** — team affiliation lives on `G.cardTraits[extId]?.team`
  (normalized lowercase, e.g. `'x-men'`), resolved at setup; no registry read
  at runtime.
- **WP-016 / D-15401 wound supply** — `board/wounds.logic.ts` `gainWound`
  (pure; top wound from `G.piles.wounds` → player discard; empty pile =
  deterministic no-op).
- Tactic ext_id grammar `${setAbbr}-mastermind-${slug}-${tacticSlug}` built at
  `mastermind.setup.ts:240`; core Magneto's Crushing Shockwave resolves to
  **`core-mastermind-magneto-crushing-shockwave`** (card slug
  `crushing-shockwave`, `data/cards/core.json`).

## Context (Read First)

**"Each other player."** The printed text targets every player **except** the
one who defeated the tactic — `ctx.currentPlayer`. This differs from every
Master Strike resolver in `mastermindHandlers.ts`, which target **every**
player (a strike hits the table, a tactic Fight is the defeating player's
reward *against the others*). Iterate `Object.keys(G.playerZones).sort()` and
**skip `currentPlayer`**. In the reported 2-player co-op match the "other"
player is the bot ally — correct per rules.

**Reveal, not discard.** A player who holds an X-Men Hero in hand **reveals**
it and loses nothing — this is a pure log event, no zone mutation (identical
to the reveal branch of core Magneto's Master Strike,
`playerHasXMenHeroInHand` → log-and-continue). Only a player who cannot
reveal pays the penalty.

**Two Wounds, not one.** The penalty is **two** Wounds (`resolveCo2eMagnetoStrike`
gives one). Call `gainWound` up to twice, stopping early if the supply
empties, and log the count actually taken (a supply-empty shortfall is a
logged no-op, never a throw — moves never throw).

**Determinism (the re-pin question).** The resolver mutates `G.piles.wounds`
and player discard zones — gameplay-affecting, correctly reflected in the
hashed `G`. But it fires **only** when a `core-mastermind-magneto-crushing-shockwave`
tactic is defeated, and **no committed replay/sentinel fixture does so**
(neither the empty-registry PRE_WP080 replay nor the `core/dr-doom` recorded
sentinel involves Magneto tactics). So both hash oracles stay byte-identical
and **no re-pin is expected**. Verify both at execution; **STOP on any drift,
never blind-re-pin** (`reference_hashed_g_field_dual_repin`). No new `G`
field is added — a further reason nothing shifts.

## Design Rationale

**Inline the two small checks; do not export from `mastermindHandlers.ts`.**
The X-Men-in-hand scan and the wound-gain are each a handful of lines. Per the
repo's "duplicate first, abstract only when a third copy appears" rule
(`code-style.md`), `tacticHandlers.ts` inlines both against `G.cardTraits`
and `gainWound` directly, rather than exporting `playerHasXMenHeroInHand` /
`gainWoundToDiscard` from `mastermindHandlers.ts`. This keeps the change to
`tacticHandlers.ts` + its test (no second production file touched) and avoids
widening `mastermindHandlers.ts`'s surface for a single reuse. If a third
tactic/strike needs the same scan, extract then.

**Deterministic auto-resolve, no pending-choice.** For "reveal X or penalty"
the player-optimal choice is invariant — reveal if you hold an X-Men Hero
(free), else take the Wounds. Auto-revealing when able is therefore fully
faithful (no fidelity lost) and avoids a blocking multi-player pending-choice,
matching the D-24192 / D-24284 stance. Locked in D-24312.

## Scope (In)

- `packages/game-engine/src/rules/tacticHandlers.ts`:
  - New `resolveCrushingShockwave(G, currentPlayer)` — for each player id in
    `Object.keys(G.playerZones).sort()` **except** `currentPlayer`: if the
    player holds a card whose `G.cardTraits?.[extId]?.team === 'x-men'`, log a
    reveal line and continue (no mutation); otherwise call `gainWound` up to
    two times against `G.piles.wounds` + that player's discard — **assigning
    both returned arrays back between the two calls** so the second call reads
    the post-first-call pile/discard (mirroring `gainWoundToDiscard`, which
    re-reads `G.piles.wounds` each invocation) — and log the count actually
    taken.
  - New `MAGNETO_CRUSHING_SHOCKWAVE_TACTIC_ID` const (=
    `core-mastermind-magneto-crushing-shockwave`), `SHOCKWAVE_WOUND_COUNT`
    const (= 2), and `TEAM_X_MEN` const (= `'x-men'`).
  - Add a branch to `dispatchTacticOnFight` keyed by that tactic id →
    `resolveCrushingShockwave(G, currentPlayer)`.
- Tests: extend `rules/tacticHandlers.test.ts` — dispatch fires for the
  Crushing Shockwave id; an "other" player with no X-Men Hero gains exactly 2
  Wounds; an "other" player holding an X-Men Hero gains 0 (reveal); the
  **defeating** player is never affected; a near-empty wounds supply gives the
  available count and logs the shortfall; an unrelated tactic id remains a
  silent no-op.

## Out of Scope

- The other three core Magneto tactics — **Bitter Captor** (recruit an X-Men
  Hero from the HQ for free — needs a pending-choice), **Electromagnetic
  Bubble** (add a chosen X-Men Hero to next hand as a 7th card — needs a
  pending-choice + deferred hand injection), **Xavier's Nemesis** (rescue a
  Bystander per X-Men Hero you control). Each is a separate follow-on WP.
- Any other mastermind's tactics.
- A pending-choice giving the *other* player an explicit reveal-vs-Wounds
  decision (deterministic auto-resolve is the locked stance).
- A data-driven tactic effect-marker vocabulary; the /debug/effects tactic
  coverage feed (that is WP-507).
- Card-data changes; UIState/overlay work beyond the per-player log lines.
- No new `G` field; no `mastermind.setup.ts` / `game.ts` changes.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/tacticHandlers.ts` | `+ resolveCrushingShockwave` + its consts + a dispatch branch |
| `packages/game-engine/src/rules/tacticHandlers.test.ts` | reveal / two-Wounds / defeating-player-skipped / supply-shortfall / unknown-id assertions |

Governance (not counted in the code allowlist): `WORK_INDEX.md`,
`EC_INDEX.md`, `05-ROADMAP-MINDMAP.md`, `DECISIONS.md` (D-24312 flips Active
at execution), `NUMBER-LEDGER.md` (already reserved).

## Non-Negotiable Constraints

- Moves never throw; the dispatch stays a silent no-op for any unhandled id.
- **Each OTHER player** — the resolver must skip `currentPlayer`.
- **Reveal is a no-op mutation** — an X-Men holder loses nothing; only a log line.
- **Exactly two Wounds** max per penalized player; a supply shortfall gives the
  available count and logs it (never throws, never substitutes). The two
  `gainWound` calls **thread** — assign the returned `woundsPile` +
  `playerDiscard` back (to `G.piles.wounds` and the player's discard) after the
  first call so the second reads the updated arrays, or a second call against
  the original pile nets only one Wound (`gainWound` is non-mutating).
- Team match reads `G.cardTraits?.[extId]?.team === 'x-men'` — the `?.` guards
  the **map itself** (legacy/unit states predate WP-179 and leave `cardTraits`
  undefined; matches `selectLowestCostHero`). This is a **team-only** check, by
  design: only Heroes carry a team in a hand (Wounds, Bystanders, and the three
  basic S.H.I.E.L.D. cards are teamless — `reference_basic_shield_cards_teamless`),
  so a team match cannot false-positive on a non-Hero. Do not add a `heroClass`
  guard to mirror the sibling, and do not drop the map-level `?.`.
- **Log prefix** uses the `tacticHandlers.ts` prose convention `Fight effect:
  …` (as the Octet resolver does), **not** the `[… Master Strike]` bracket
  form from `mastermindHandlers.ts` — one line per affected other player.
- No `ctx.random.*` (reveals/shuffles nothing), no I/O, no wall-clock.
- No boardgame.io import in `tacticHandlers.ts` (`ctx` narrowed via `unknown`,
  as `dispatchTacticOnFight` already does); no `.reduce()`.
- No new `LegendaryGameState` field; no change to `mastermindHandlers.ts`.

**Engine-wide (standing) constraints.** The executing session must also honor
the repo-wide rules that apply to every engine change: `.claude/rules/code-style.md`
and `docs/ai/REFERENCE/00.6-code-style.md` (human-style, junior-readable code;
full English names; every function JSDoc'd; `// why:` on non-obvious constants
and any `ctx.random.*`); ESM-only with `node:`-prefixed built-ins, `.test.ts`
tests on `node:test`, Node v22+. The executor works from **full file
contents**, never diffs or elided snippets, and outputs complete files.

## Contract

**`resolveCrushingShockwave(G: LegendaryGameState, currentPlayer: string):
void`** — pure handler; for each player id except `currentPlayer` (sorted),
either logs a reveal (holds an X-Men Hero) or gains up to two Wounds. Mutates
`G.piles.wounds` and player discard zones directly; never throws.

**Dispatch** — on defeat of `core-mastermind-magneto-crushing-shockwave`,
`dispatchTacticOnFight` calls `resolveCrushingShockwave(G, currentPlayer)`.
Fires on `ctx.currentPlayer`, after the tactic + bystanders are awarded and
the all-tactics-defeated block (the framework's existing final-step ordering).

## Vision Alignment

§3 (faithful Legendary rules) — implements printed tactic text currently
inert. NG-1..7 not crossed. No monetization / PvP / identity surface.
**Determinism preserved (§8 / §22):** no `ctx.random.*`, no wall-clock, no I/O;
the only new state is Wounds moved between existing hashed zones, which replays
identically given the same setup + moves and (firing only on a Magneto Crushing
Shockwave defeat, which no committed fixture does) leaves every committed
replay/sentinel oracle byte-identical — no persistence-boundary or re-pin
impact expected.

## Funding Surface Gate

N/A — no pricing, checkout, or account surface.

## API Catalog Update

N/A — no `apps/server` HTTP endpoint or `Library-only` export changes.

## Acceptance Criteria

1. Defeating `core-mastermind-magneto-crushing-shockwave` invokes
   `resolveCrushingShockwave` on the defeating player.
2. An **other** player holding no X-Men Hero in hand gains **exactly two**
   Wounds (both moved from `G.piles.wounds` to that player's discard).
3. An **other** player holding an X-Men Hero in hand gains **zero** Wounds and
   emits a reveal log line (no zone mutation).
4. The **defeating** player (`currentPlayer`) is never affected — no reveal
   check, no Wounds.
5. When the wounds supply holds fewer than the needed count, the penalized
   player gains the available count and the shortfall is logged (no throw, no
   substitute).
6. An unknown/unimplemented tactic id remains a silent no-op (unchanged from
   WP-497).
7. Determinism: full engine suite green; sentinel `finalStateHash` +
   `PRE_WP080_HASH` **byte-identical** (no committed fixture defeats a Magneto
   tactic) — any drift STOPs execution.
8. The Fight effect emits one play-by-play log line per affected other player.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all green; note the
   pass delta.
3. Control check: temporarily stub `resolveCrushingShockwave` to a no-op → the
   new two-Wounds / reveal / skip-defeater assertions FAIL (non-vacuous),
   restore.
4. Confirm sentinel `finalStateHash` + `PRE_WP080_HASH` unchanged (sweep +
   full run); `pnpm sim:runtime-observed:check` current with no regeneration.
5. `pnpm -r build` → 0.
6. `git diff --name-only` = the two-file allowlist + governance only.
7. **D-24026 live-verify (operator-pending, post-deploy):** on
   `play.legendary-arena.com`, defeat Magneto's Crushing Shockwave tactic →
   each other player without an X-Men Hero gains two Wounds + the log shows the
   Fight lines.

## Definition of Done

- [ ] All Acceptance Criteria met; engine suite green (pass delta recorded).
- [ ] Sentinel + PRE_WP080 hashes byte-identical (or drift diagnosed + a
      deliberate, documented re-pin — not expected).
- [ ] `git diff --name-only` matches the allowlist.
- [ ] `pnpm -r build` 0; `sim:runtime-observed:check` current.
- [ ] D-24312 flipped Active; WORK_INDEX row → `[x]`; EC_INDEX → `Done`;
      mindmap `📝`→`✅`; `roadmap:counts:check` 0; `docs/ai/STATUS.md`
      close-out entry added.
- [ ] Two-commit topology (EC-541 impl + SPEC close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24312** — Core Magneto "Crushing Shockwave" tactic Fight resolution: "each
other player reveals an [team:x-men] Hero or gains two Wounds" resolves as a
no-choice deterministic per-player pass (auto-reveal when able; else gain
exactly two Wounds, stopping early on a supply shortfall), scoped to every
player except the defeating `ctx.currentPlayer`. Deterministic auto-resolve
over a blocking multi-player pending-choice, per the D-24192 / D-24284
precedent.

## Lint Gate Self-Review (00.3)

All 21 sections resolved — PASS or justified N/A:

- **§1 Structure** — PASS (all required WP sections present, in order).
- **§2 Non-Negotiable Constraints** — PASS (explicit block; standing engine rules cited).
- **§3 Assumes** — PASS (every prerequisite cites its locking source; WP-497 is the hard dep).
- **§4 Context** — PASS (`## Context (Read First)` covers each-other-player, reveal, two-Wounds, re-pin).
- **§5 Files Expected to Change** — PASS (closed two-file allowlist + governance).
- **§6 Naming Consistency** — PASS (canonical `cardTraits.team`, `gainWound`, `tacticHandlers.ts`, tactic ext_id grammar).
- **§7 Dependency Discipline** — PASS (WP-497 landed on `main`; all other deps ✅).
- **§8 Architectural Boundaries** — PASS (game-engine only; no `boardgame.io`/registry import; `ctx` via `unknown`; no `.reduce()`).
- **§9 Windows Compatibility** — N/A (no shell/path-specific work).
- **§10 Env Var Hygiene** — N/A.
- **§11 Authentication Clarity** — N/A.
- **§12 Test Quality** — PASS (`node:test`, `.test.ts`; non-vacuous control-stub step).
- **§13 Commands & Verification** — PASS (`## Verification Steps` runnable).
- **§14 Acceptance Criteria Quality** — PASS (8 testable, non-vacuous ACs).
- **§15 Definition of Done** — PASS (binary gates incl. hash byte-identity + two-commit topology).
- **§16 Code Style** — PASS (human-style, JSDoc, `// why:` on the non-obvious consts, no clever control flow).
- **§17 Vision Alignment** — PASS (§3 faithful rules; NG-1..7 not crossed; determinism §8/§22 line present).
- **§18 Prose-vs-Grep Discipline** — PASS (no verification-grep token reused in prose).
- **§19 Bridge-vs-HEAD Staleness** — PASS (baseline `origin/main` @ `7dbebf94` cited; current at draft).
- **§20 Funding Surface Gate** — N/A (no pricing/checkout/account surface; stated in the WP).
- **§21 API Catalog Update** — N/A (no `apps/server` endpoint or `Library-only` export change; stated in the WP).

Pre-flight verdict: **READY TO EXECUTE** (one advisory RS — the team-only scan is
faithful and now documented as deliberate). Copilot verdict: **PASS** after three
scope-neutral wording locks (thread the two `gainWound` calls; map-level `?.` on
`G.cardTraits`; `Fight effect:` prose log prefix) were applied to the WP + EC.
