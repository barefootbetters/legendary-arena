# WP-397 — Doctor Octopus Master Strike: The Reveal-Eight Branch (Game Engine)

**User-Visible Surface:** play.legendary-arena.com

**Status:** Draft — pending execution
**Layer:** Game Engine

## Goal

co2e Doctor Octopus's Master Strike prints a two-branch choice: *"Each player
may discard a [team:spider-friends] Hero. Any player who doesn't must reveal
the top 8 cards of their deck, discard all non-grey Heroes revealed, and put
the rest back in random order."* WP-388 implemented the first branch only, so
a player holding no Spider-Friends Hero takes a logged no-op and **escapes the
strike entirely**. This WP implements the second branch, closing half of the
fidelity gap D-24192 recorded.

## User-Visible Impact

In a deployed co2e Doctor Octopus match, a player with no Spider-Friends Hero
in hand stops getting away with the strike. Their top eight deck cards are
revealed, every non-grey Hero among them is discarded, and the remainder goes
back on top of the deck in a shuffled order — with HUD log lines naming the
count discarded. Players holding a Spider-Friends Hero are unaffected.

## Assumes

- **WP-388 / D-24192** — `resolveDoctorOctopusStrike` exists and implements
  the discard branch; the no-op path is the one this WP replaces. ✅ on `main`
  (PR #836).
- **WP-179** — `G.cardTraits[extId]` carries `{ heroClass, team }`. ✅ on
  `main`. `heroClass == null` is the engine expression of "grey" per the
  tabletop rulebook.
- **`context.random.Shuffle` already reaches this handler.** `RevealContext`
  (`villainDeck.reveal.ts`) carries `random: { Shuffle }`, and
  `performVillainReveal` passes the full context into `executeRuleHooks`
  precisely so handlers can use it — see the `// why:` at Step 5. The strike
  handler simply ignores it today (`_ctx: unknown`). ✅ on `main`. **No new
  plumbing is required**; D-24192's claim that this branch "needs `ctx.random`
  threading" was wrong.
- `moveCardFromZone` / `gainWound` return contracts unchanged (WP-388).
- Baseline: `origin/main` @ `01498ac1`; engine suite **2028 pass / 473 suites
  / 0 fail** observed at draft.

## Context (Read First)

- `packages/game-engine/src/rules/mastermindHandlers.ts` —
  **AUTHORITATIVE for** `resolveDoctorOctopusStrike`, the shared
  `selectLowestCostHero`, and the dispatch chain
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` —
  **AUTHORITATIVE for** `RevealContext` (`random: { Shuffle }`) and the Step-5
  comment stating handlers may reach `context.random.Shuffle`
- `packages/game-engine/src/state/cardTraits.types.ts` —
  **AUTHORITATIVE for** the `{ heroClass, team }` entry shape
- `docs/ai/DECISIONS.md` — scan **D-24192** (the recorded gap this closes and
  its incorrect `ctx` claim), **D-24188** (deterministic auto-pick), **D-21502**
  (statless starters), **D-24193** (base-face selection)
- `docs/legendary-universal-rules-v23.md` §"Grey Heroes" —
  **AUTHORITATIVE for** the definition this WP encodes
- `data/cards/co2e.json` — the printed Doctor Octopus base-face text

## Design Rationale

**"Non-grey" is rulebook-defined, not invented.** The tabletop rules state
that "grey Heroes" means *grey-colored cards with no Hero Class, like
S.H.I.E.L.D. Agents, Troopers, Officers or Sidekicks.* So **non-grey ⟺ the
card has a Hero Class**, which is exactly `G.cardTraits[extId]?.heroClass !=
null`. No new registry field, no slug heuristic. Wounds carry no Hero Class
and are therefore grey — they return to the deck rather than being discarded,
which is correct: a Wound is not a Hero.

**RNG here is legitimate and replay-safe.** `ctx.random.Shuffle` is the
framework PRNG, the only permitted randomness (`.claude/rules/architecture.md`
§Determinism). Using it keeps replay faithful because the same seed replays
the same shuffle. This is the first strike resolver to consume randomness, so
the handler's `_ctx` parameter stops being unused.

**Why the remainder is shuffled rather than kept in order.** The card says
"put the rest back in random order" — that is the printed anti-information
mechanism: the player must not learn their deck order for free. Preserving
revealed order would hand them eight cards of perfect information and make the
strike a *benefit*. The shuffle is the point of the effect.

**Deck shorter than eight.** Reveal whatever is there and process it; do not
reshuffle the discard pile to top up. This follows the engine's **reveal
family**, which never reshuffles (see the D-21502 no-op in
`effectPrimitive.interpret.ts`); only the *draw* path reshuffles, which is the
correct rule split — this effect reveals, it does not draw. Note that comment
cites "would need `ctx.random`" as its blocker, which no longer applies here:
the justification is reveal-family consistency, not RNG availability.

**Sequencing note.** WP-397 and WP-398 both modify `rules/mastermindHandlers.{ts,test.ts}`. They are **not** parallel-safe: execute them sequentially, and whichever runs second must re-record its baseline pass count against the moved `main` rather than reusing the drafted number.

## Scope (In)

- Replace `resolveDoctorOctopusStrike`'s no-op path with the reveal-eight
  branch: reveal up to `DOCTOR_OCTOPUS_REVEAL_COUNT` (8) cards from the top of
  the player's deck, discard every revealed card whose
  `cardTraits[extId]?.heroClass != null`, and return the remainder to the top
  of the deck in `context.random.Shuffle` order.
- Rename the handler's second parameter `_ctx` → a read name (it stays
  `unknown` — see `## Contract`) and narrow it through a local runtime guard
  `resolveShuffleFunction`, defensively: a stub context degrades to a
  deterministic fallback, never a throw.
- The discard branch (player holds a Spider-Friends Hero) is **unchanged**.
- Tests in `mastermindHandlers.test.ts` — a new describe-block covering the
  reveal branch.

## Out of Scope

- **Loki's Hypno-Thrall branch** — WP-398 / WP-399; it needs a new `G` field.
- Any new `G` field, zone, `RuleEffect` type, move, or phase change.
- Any change to the other four strike resolvers, the D-15401 capture, the
  `masterStrikeCount` counter, or the WP-200 emission.
- Any deck reshuffle-from-discard when the deck holds fewer than eight cards.
- Any pending-choice UX — the branch selection stays the D-24192 auto-pick.
- Any card-data or registry change.

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** —
  reveal-eight branch, the reveal count constant, the non-grey predicate, and
  the narrowed context parameter
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** —
  reveal-branch describe-block covering AC-1..AC-8
- `docs/ai/STATUS.md` — **modified** — close-out entry
- `docs/ai/DECISIONS.md` — **modified** — D-24200 lands Active; D-24192
  annotated that its Doctor Octopus half is closed and its `ctx` claim was
  wrong
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — checkbox flip
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — status flip
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — node `📝` → `✅` +
  `pnpm roadmap:counts:write`

## Non-Negotiable Constraints

> **Output contract for this session:**
> - Full file contents for every new or modified file (no diffs, no snippets)
> - ESM only, Node v22+
> - Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`
> - **`context.random.Shuffle` is the ONLY randomness permitted.** No
>   `Math.random()`, no wall-clock, no hand-rolled shuffle.
> - No `boardgame.io` and no registry import in `mastermindHandlers.ts`
> - Moves never throw; the handler never throws — an empty deck, a stub
>   context, or a missing `cardTraits` entry degrades to a logged path
> - No new `G` field, zone, `RuleEffect` type, move, or phase change
> - Locked contract values: see `## Contract` below — do not re-derive them
> - If any item is unclear or appears to conflict with the source, STOP and
>   ask rather than improvising

## Contract

**Locked values.**

- `DOCTOR_OCTOPUS_REVEAL_COUNT = 8`.
- Non-grey predicate: `gameState.cardTraits?.[extId]?.heroClass != null`
  (loose `!=` so `null` and `undefined` both read as grey).
- Reveal source: the **front** of `playerZones.deck` (index 0 is the top —
  the engine's existing draw convention).
- Return destination: the shuffled remainder goes back on the **front** of
  the deck, preserving the untouched tail:
  `playerZones.deck = [...shuffledRemainder, ...untouchedTail]`.
- Player iteration: `Object.keys(gameState.playerZones).sort()`.
- Branch order per player is unchanged: try the Spider-Friends discard first;
  only a `null` selection reaches the reveal branch.

**Context narrowing — the handler signature does NOT change.**
`mastermindStrikeHandler` is registered into `DEFAULT_IMPLEMENTATION_MAP`, and
`ImplementationMap` types its second parameter as `ctx: unknown`. The package
compiles under `strict: true`, so `strictFunctionTypes` makes parameters
contravariant: narrowing the handler's own parameter to a structural interface
**fails to compile** with `TS2322` (`'unknown' is not assignable to
'StrikeShuffleContext'`). This was reproduced with the repo's own `tsc` at
draft — do not re-derive it.

The locked form is a **runtime type guard**. The parameter stays `unknown`
(renamed from `_ctx` because it is now read), and a local helper narrows it:

```ts
function resolveShuffleFunction(
  context: unknown,
): (<T>(items: T[]) => T[]) | null
```

It returns `null` unless `context.random.Shuffle` is a function. Narrow
structurally — **not** by importing `RevealContext` from
`villainDeck.reveal.ts` (that would couple the rules module to the
villain-deck module) and **not** with any `boardgame.io` type. When the guard
returns `null` (unit-test stubs pass `{}`), the remainder returns in revealed
order and the log line says so: a deterministic fallback, not a silent one.

**Handler ordering (unchanged).** `captureBystanderOntoMastermind` →
per-mastermind branch → WP-200 emission → `return buildGenericStrikeEffects()`.

## Vision Alignment

- **Vision clauses touched:** §1 (Faithful Legendary rules), §2 (Real card
  content behaves as printed), §22 (Deterministic Eval).
- **Conflict assertion:** No conflict: this WP preserves all touched clauses —
  it makes a printed branch fire where the player previously escaped, and the
  randomness it introduces is the framework PRNG, which replays identically.
- **Non-Goal proximity check:** N/A — no monetization, identity, or
  competitive-scoring surface. None of NG-1..7 are crossed.
- **Determinism preservation:** `ctx.random.Shuffle` only; no `Math.random()`,
  no wall-clock. Replay-faithful by construction. The recorded sentinel
  fixture and the runtime-observed matrix pin `core/dr-doom`, so no co2e
  branch is reachable from them and no committed hash or artifact should move;
  any drift is a STOP-and-investigate, never a re-pin.

## Funding Surface Gate

N/A — engine gameplay fidelity only; no UI funding affordances, no
user-visible funding copy, no funding channels referenced (§20.1 surfaces
absent).

## API Catalog Update

N/A per D-11804 — no HTTP endpoint and no `apps/server`-reachable library
function is added, modified, removed, or status-changed.

## Acceptance Criteria

- **AC-1** A player holding a Spider-Friends Hero still discards it and does
  **not** reveal — the WP-388 branch is **behaviourally unchanged**. (Not
  byte-identical: the guard inverts to `if (targetExtId !== null) { …; continue; }`
  so the reveal branch can follow it. Observable behaviour is what is locked.)
- **AC-2** A player holding none reveals exactly 8 cards when the deck has ≥ 8,
  and exactly `deck.length` when it has fewer. The deck is never topped up
  from the discard pile.
- **AC-3** Every revealed card with a non-null `heroClass` is appended to the
  player's discard pile; every other revealed card (including Wounds and
  entries missing from `cardTraits`) returns to the deck.
- **AC-4** The returned remainder is placed at the **front** of the deck and
  the untouched tail below it is unchanged in content and order.
- **AC-5** The remainder is ordered by `context.random.Shuffle`; a context
  without `Shuffle` returns it in revealed order and logs that fallback.
- **AC-6** Card conservation holds: for each player, `deck + discard` before
  the strike equals `deck + discard` after, as multisets. No card is created
  or destroyed.
- **AC-7** The handler never throws for: empty deck, deck shorter than 8, all
  revealed cards grey, all revealed cards non-grey, absent `cardTraits`, and a
  stub context.
- **AC-8** The other four strike resolvers, the D-15401 capture, the counter,
  and the WP-200 emission are unchanged.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` exits 0.
2. `pnpm --filter @legendary-arena/game-engine test` exits 0; baseline 2028
   plus the new tests, 0 fail.
3. `pnpm -r build` exits 0.
4. `pnpm sim:runtime-observed:check` exits 0 **and performs no regeneration**.
5. Sentinel `finalStateHash` and `PRE_WP080_HASH` byte-identical — no co2e
   branch is reachable from either oracle.
6. **Control run:** revert the reveal branch to the WP-388 no-op and confirm
   the new tests fail. A reveal test that passes without the branch is
   vacuous.
7. `git diff --name-only` on staged changes equals the seven-file allowlist.

## Definition of Done

- [ ] All Acceptance Criteria AC-1..AC-8 satisfied.
- [ ] All Verification Steps green with the recorded observed output,
      including the Step-6 control run.
- [ ] **No files outside `## Files Expected to Change` were modified.**
- [ ] `docs/ai/DECISIONS.md` — D-24200 Active. **D-24192 annotation is a
      single inline amendment to D-24192's own body**, not a back-pointer and
      not a per-WP append: this WP marks the Doctor Octopus half closed and
      corrects its `ctx.random` claim; WP-398 amends the same paragraph for the
      Loki half. Locked here so the arc does not annotate one entry three
      times.
- [ ] `docs/ai/STATUS.md` close-out entry recorded.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` rows flipped with date; mindmap node
      `📝` → `✅` + counts regenerated.
- [ ] `User-Visible Surface = play.legendary-arena.com` — D-24026
      live-on-surface verification recorded (a deployed Doctor Octopus strike
      against a player with no Spider-Friends Hero reveals and discards).
      Operator-pending on deploy is acceptable if recorded as such.

## Reserved Decision (lands at execution)

**D-24200 — Doctor Octopus's reveal-eight branch resolves with the framework
PRNG; "non-grey" is `cardTraits.heroClass != null`.** Closes the Doctor
Octopus half of the D-24192 gap. Records: the rulebook definition of grey and
its one-line engine expression; that `ctx.random.Shuffle` was already reachable
by the strike handler (correcting D-24192's stated reason for deferral); that
the remainder is shuffled because the printed effect's purpose is denying free
deck information; and that a short deck is revealed as-is rather than topped
up from the discard pile.

## Lint Gate Self-Review (00.3)

Run at draft against all 21 sections and independently audited. §1–§9 PASS
(structure; constraints block with the RNG restriction; dependency-complete
`§Assumes`; caps-tagged `§Context`; per-file descriptions; canonical naming;
no new dependency; engine-layer only; Windows-safe `pnpm` commands).
§12–§17 PASS (node:test with a mandated control run per §Verification Step 6;
seven binary verification steps; eight observable ACs including a
card-conservation invariant; DoD with the scope-boundary check; no
higher-order function introduced; Vision block with the §17.2 conflict
assertion in required form). §10, §11, §18, §20, §21 resolve N/A with named
justifications — no env var, no auth surface, no count-bounded grep gate, no
funding surface, no API-catalog-bearing change.
