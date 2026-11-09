# WP-877 — Deliberate-no-op villain primitives get a `secondary-site` effect trace where their real work fires (Game Engine diagnostics)

**Status:** Draft 2026-11-08 (EC-915; D-24824 reserved)
**Layer:** Game Engine only (the `EffectTrace` fire-site union, one trace helper, five bridge call sites). No UIState field, client, server or card-data change.
**User-Visible Surface:** the Operator panel's "Recent effect traces" list and the Play Diagnostics `effectTraces` capture on play.legendary-arena.com
**Risk Tier:** LOW — inert, hash-excluded diagnostics; no gameplay, persistence, auth, money or server surface
**Hard-deps:** WP-488 / D-24294 (`G.diagnostics.traces`, `recordEffectTrace`, the closed `EffectTraceStatus` / `EffectTraceFireSite` unions) ✅, WP-542 / D-24351 (`play-villain-deck-cards` executor no-op + fire-site bridges) ✅, WP-868 / D-24811 (`reenter-sewers-if-villain-deck-top`) ✅, WP-869 / D-24814 (`stack-cards-enter-city-as-villains`) ✅, WP-872 / D-24817 (`resolveVillainDeckDefeatFightEffect` runs the fight bridge for a Villain Deck defeat) ✅, D-24704 (reveal-path traces carry the framework turn) ✅, WP-575 / D-24384 (traces projected to `UIState.effectTraces`) ✅

## Goal

Three villain primitives have executor handlers that deliberately do nothing, because the real work needs the reveal
pipeline the executor cannot reach. The work runs instead in a "fire-site bridge" after the defeat or the Ambush:

- `play-villain-deck-cards`: Endless Armies of HYDRA's Fight and The Leader's Ambush ("Play the top N cards of the Villain Deck").
- `reenter-sewers-if-villain-deck-top`: Mr. Immortal's Fight.
- `stack-cards-enter-city-as-villains`: Groot from Planet X's and Agent Gabe Jones's Fight, and Agent Eric Marshall's Ambush.

Today the only trace these effects leave reads `no-op`, so the operator panel and the diagnostics capture say an effect
did nothing when it played two cards. After this WP each bridge also records a `secondary-site` trace naming where the
work fired. The executor's `no-op` trace stays: the record reads "the executor was a no-op; the work fired at the fight
bridge". That is the shape Mystique's escape twist has had since WP-488.

## User-Visible Impact

- Operator panel, "Recent effect traces": after Endless Armies of HYDRA is defeated, the list shows
  `Endless Armies of HYDRA — no-op` followed by `Endless Armies of HYDRA — secondary-site`. Today the second line is missing.
- The Play Diagnostics `effectTraces` array carries the second record, with `fireSite: "villain-fight-bridge"` (or
  `"villain-ambush-bridge"`), `handler` naming the bridge function and the framework turn.
- **Observed, operator match `eFuOfsS3j8C`** (files `C:\pcloud\matches\rvlt\Mandarin-MidtownBankRobbery-{LOG,DIAGNOSTIC,GAME}-2p-hulk.*`,
  2026-11-09T01:58Z capture, build `2405530`):
  - Endless Armies of HYDRA's onFight trace read `play-villain-deck-cards` / `no-op` three times (turns 8, 14, 17).
  - Each time, the log shows it playing the top two Villain Deck cards: 7.2.9–7.2.11, 13.2.16–13.2.18 and 16.2.6–16.2.9,
    the last of which revealed Scheme Twist #4 and two Master Strikes.
  - No other record of the play exists in the capture.
- Gameplay, logs, scoring and replays do not change.

## Assumes

- **Baseline:** `origin/main` at `24055308` plus the reserve PR #3241 (WP-877 / EC-915 / D-24824).
- **D-24294 contract** (`docs/ai/DECISIONS.md` ~l.36003):
  - Traces are runtime-only, hash-excluded and never read as gameplay input.
  - `EffectTraceStatus` = `fired | no-op | no-handler | secondary-site`, and `EffectTraceFireSite` = `villain-executor |
    hero-executor | hero-primitive | escape-scheme-twist`. Each union is pinned to its canonical array by a drift test
    (`diagnostics/effectTrace.record.test.ts`).
  - The Deferred list names "additional secondary fire sites beyond the D-24287 escape-twist case" as a separate future WP.
    This is that WP.
- **The one existing secondary site** is `villainDeck/villainDeck.reveal.ts` ~l.756–772. It runs `recordEffectTrace` with
  `status: 'secondary-site'`, `fireSite: 'escape-scheme-twist'`, `handler: 'onSchemeTwistRevealed'`, `params: {}`, `turn:
  readRevealContextTurn(context)`. It is emitted *after* the twist fires.
- **Deliberate-no-op allowlist:** `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (`villain/villainEffects.execute.ts` ~l.848–866)
  holds five primitives: `become-scheme-twist`, `gain-attached-hero`, `play-villain-deck-cards`,
  `reenter-sewers-if-villain-deck-top` and `stack-cards-enter-city-as-villains`.
- **D-24811 §3** (`docs/ai/DECISIONS.md` ~l.50481, Mr. Immortal) says "No secondary-site trace; the log lines carry it."
  D-24824 supersedes that sentence. D-24814 and D-24351 carry no such clause.
- **Card data for each path:**
  - Endless Armies of HYDRA: `core.json` ~l.2099 `play-villain-deck-cards:2`; `co2e.json` ~l.2188, which also KOs a Hero first.
  - The Leader: `core.json` ~l.2216, ungated `:1`; `co2e.json` ~l.2310, gated `:1:hc:strength`.
  - Mr. Immortal: `cvwr.json` ~l.2509.
  - Groot from Planet X: `chmp.json` ~l.751, bystander stack, 2.
  - Agent Eric Marshall (Ambush) `cvwr.json` ~l.2660 and Agent Gabe Jones (Fight) ~l.2672, officer stack, 1.
- **Card-type resolution:** `resolveVillainCardType(G, cardId)` (same file ~l.478, module-private) returns `'henchman'` or
  `'villain'`, and is the scope the executor's traces use.
- **Fire-site bridges at HEAD:**
  - `runVillainFightFireSiteBridges` (`moves/fightVillain.ts` ~l.925–998) handles the Endless Armies play (~l.943–961), the
    Mr. Immortal reenter (~l.970–985) and the onFight stack entry (~l.992–997).
  - The Ambush block of `performVillainReveal` (`villainDeck/villainDeck.reveal.ts` ~l.446–455) handles The Leader's play
    and Agent Eric Marshall's stack entry.
  - The fight bridge also runs for a Villain defeated straight from the Villain Deck (WP-872's Nightbringer path,
    `resolveVillainDeckDefeatFightEffect`), so that path is covered without its own site.
- **Turn readers:** `readTurnNumber(ctx)` (fight bridge) and `readRevealContextTurn(context)` (Ambush block) are already in
  scope at each site (D-24704).
- **Existing tests that pin the trace count:**
  - `villain/reenterSewers.test.ts` ~l.184–191 and `villain/stackVillain.test.ts` ~l.337–344 filter traces by `effect` and
    assert exactly one `no-op`. They change intentionally (Scope In 4).
  - `moves/fightVillain.test.ts` ~l.762 and `villainDeck/villainDeck.reveal.test.ts` ~l.2236 `find` the first trace per card,
    which is still the executor's. They pass unedited.
- **Projection:** `UIState.effectTraces` is typed `EffectTrace[]` (`ui/uiState.types.ts` ~l.363), and `filterUIStateForAudience`
  copies each field verbatim (`ui/uiState.filter.ts` ~l.1763–1801). The widened union flows to arena-client by type, with no
  client edit. No consumer outside the engine enumerates `fireSite` values (checked in apps/*, scripts/*, lagn-spec and the dashboard).

## Context (Read First)

- **Why now:** the WP-872 live-verify (match `eFuOfsS3j8C`) surfaced three misleading `no-op` traces. The operator reads the
  Operator panel to tell "fired" from "did nothing" when live-verifying cards. A trace that says `no-op` while the log plays
  cards costs a diagnosis round-trip every time Endless Armies, The Leader, Mr. Immortal or a stack-entry card is checked.
- **Why additive, not a status flip:** D-24294 defines `no-op` by primitive identity, and the Operator panel and Play
  Diagnostics read one executor trace per dispatch. Mystique's
  precedent keeps the executor `no-op` and adds the `secondary-site` record. Flipping the executor trace to `fired` would
  break the D-24294 rule that status never depends on mutation.
- **Two fire sites, not three per-effect sites:** the trace already carries `effect` (the primitive token), so `fireSite`
  names *where* the work ran: `villain-fight-bridge` or `villain-ambush-bridge`. This mirrors `escape-scheme-twist`, which
  names the escape branch.
- **Emit before the bridge runs:** a played card's own Ambush and Fight traces are recorded inside the bridge. Recording the
  secondary trace first keeps cause before consequence in the trace list the operator reads. Mystique's record follows its
  consequences, because a chained-reveal scheme twist writes executor traces first. WP-877 deliberately puts cause first and
  leaves Mystique's site as it is.
- **Emit only when the bridge runs:**
  - The play bridge runs when the play count is above 0. A reveal-gated The Leader whose player revealed a Strength Hero
    plays nothing and gets no secondary trace; its executor `no-op` trace and its "revealed …" log line already tell that story.
  - The reenter and stack bridges run when their lookup is non-null. Their own logged outcomes include "stays defeated" and
    an empty-stack entry.
- **`gain-attached-hero` stays out:** its "work" is the generic WP-431 attached-Hero award at every fight, which is not
  gated on the primitive, so there is no primitive-specific bridge to trace. `become-scheme-twist` already has its secondary
  trace.
- **Drafted WP-874 (`charge`):** WP-874 (Draft) adds `charge` to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`, bridged at the
  Ambush site. D-24824 §7 states the forward rule: a future bridged deliberate-no-op primitive emits a `secondary-site` trace
  at its bridge.
  - If WP-877 lands first, WP-874's `charge` bridge emits the trace itself: this drafting commit adds that line to WP-874
    and EC-912.
  - If WP-874 lands first, the executor updates the five-primitive counts in the JSDoc and AC 8 to six and records
    `charge` under D-24824 §5 as a named, tracked exception; its trace is not added here.
- **One WP, engine only:** five call sites, one helper and one union in four engine files. No layer is crossed.
- **Not the lightweight lane:** this WP extends a contract file (`hollowEffect.types.ts`, a `.types.ts`), so D-24028's
  structural criterion 4 fails. The full two-commit topology and the gates apply. The work runs in one session at Jeff's
  request (2026-11-08, "Do this task here").
- Cites ARCHITECTURE §Principles #1 (determinism: diagnostics are hash-excluded) and #2, rules §Rule Execution Pipeline
  (unknown effects never throw; the executor is unchanged), code-style §Drift Detection (union + array + D-entry together)
  and 00.6.

## Scope (In)

1. **Contract (`diagnostics/hollowEffect.types.ts`):**
   - Append `'villain-fight-bridge'` and `'villain-ambush-bridge'` to `EffectTraceFireSite` and, in the same order, to
     `EFFECT_TRACE_FIRE_SITES`, and document both members in the union's JSDoc.
   - Refresh the `EffectTraceStatus` JSDoc: the `no-op` allowlist now names all five primitives, and the `secondary-site`
     line names the three bridged primitives alongside Mystique.
2. **Helper (`villain/villainEffects.execute.ts`):** a new export `recordVillainSecondarySiteTrace(G: LegendaryGameState,
   cardId: CardExtId, timing: VillainAbilityTiming, effect: 'play-villain-deck-cards' | 'reenter-sewers-if-villain-deck-top' |
   'stack-cards-enter-city-as-villains', handler:
   'playTopVillainDeckCards' | 'reenterSewersOnVillainDeckReveal' | 'enterStackCardsAsVillains', fireSite: 'villain-fight-bridge' | 'villain-ambush-bridge',
   params: Record<string, string | number | boolean>, turn: number): void`.
   The narrow `effect`, `handler` and `fireSite` types keep a normally-firing primitive or the executor's own site from
   being stamped `secondary-site` (D-24294 decides status by primitive identity). A future bridged primitive extends them.
   - It builds the `EffectTrace` with `scope: resolveVillainCardType(G, cardId)` and `status: 'secondary-site'`, then calls
     `recordEffectTrace`.
   - The `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` why-comment gains one line saying the three bridged primitives also emit a
     secondary trace at their bridge.
3. **Emissions.** One call each, placed immediately before the bridge call and inside its existing guard:
   - **a.** Fight play (`fightVillain.ts`, inside `if (fightPlayCount > 0)`, after the `revealContext` is built and
     immediately before `playTopVillainDeckCards`): `'onFight'`, `'play-villain-deck-cards'`,
     handler `'playTopVillainDeckCards'`, `'villain-fight-bridge'`, params `{ magnitude: fightPlayCount }`, turn
     `readTurnNumber(ctx)`.
   - **b.** Fight reenter (`fightVillain.ts`, inside `if (reenterKinds !== null)`): `'onFight'`,
     `'reenter-sewers-if-villain-deck-top'`, handler `'reenterSewersOnVillainDeckReveal'`, `'villain-fight-bridge'`, params
     `{}`, turn `readTurnNumber(ctx)`.
   - **c.** Fight stack (`fightVillain.ts`, inside `if (fightStackEntry !== null)`): `'onFight'`,
     `'stack-cards-enter-city-as-villains'`, handler `'enterStackCardsAsVillains'`, `'villain-fight-bridge'`, params
     `{ magnitude: fightStackEntry.count, stackVillainKind: fightStackEntry.kind }`, turn `readTurnNumber(ctx)`.
   - **d.** Ambush play (`villainDeck.reveal.ts`, inside `if (ambushPlayCount > 0)`): `'onAmbush'`, `'play-villain-deck-cards'`,
     handler `'playTopVillainDeckCards'`, `'villain-ambush-bridge'`, params `{ magnitude: ambushPlayCount }`, turn
     `readRevealContextTurn(context)`.
   - **e.** Ambush stack (`villainDeck.reveal.ts`, inside `if (ambushStackEntry !== null)`): `'onAmbush'`,
     `'stack-cards-enter-city-as-villains'`, handler `'enterStackCardsAsVillains'`, `'villain-ambush-bridge'`, params
     `{ magnitude: ambushStackEntry.count, stackVillainKind: ambushStackEntry.kind }`, turn `readRevealContextTurn(context)`.
4. **Intentional test changes:**
   - `villain/reenterSewers.test.ts` "the onFight trace for the primitive reads no-op, not fired" and
     `villain/stackVillain.test.ts` "the onFight trace for the primitive reads no-op, not fired" now assert two traces for
     the primitive: the executor's `no-op` (fireSite `villain-executor`), then the bridge's `secondary-site` (fireSite
     `villain-fight-bridge`).
   - The `stackVillain` case's no-hollow assertion stays (the `reenterSewers` case has none).
5. **Drift pin:** `diagnostics/effectTrace.record.test.ts` (~l.112–137) gets three edits:
   - the expected list goes to six members;
   - the exhaustive `switch` gains the two new `case` labels;
   - the test title says 6, not 4.

   It stays a runtime assertion (code-style D-24372).
6. **New tests:** `villain/villainSecondarySiteTraces.test.ts`, one `describe('WP-877 secondary-site traces')` with exactly
   ten cases:
   - AC 2;
   - AC 3 ungated;
   - AC 3 gated, using the co2e shape `{ primitive: 'play-villain-deck-cards', magnitude: 1, requireKind: 'hero-class',
     requireValue: 'strength' }`;
   - AC 4 reenters, and AC 4 stays defeated;
   - AC 5 Fight stack (a one-card Bystander Stack under Groot, asserting `params.magnitude === 2`, the marked count), and
     AC 5 Ambush stack;
   - AC 6, which also holds the AC 9 invariant: a direct `recordVillainSecondarySiteTrace` call leaves `G` minus
     `diagnostics` deep-equal to a pre-call clone and `G.messages.length` unchanged, and grows `G.diagnostics.traces` by
     exactly 1. AC 6's henchman case uses a synthetic card classified `henchman` in `G.villainDeckCardTypes` (none of the
     six real cards is a henchman);
   - AC 7 and AC 8.
7. **Close:** the `SPEC:` close annotates D-24811 §3's "No secondary-site trace" sentence with "superseded by D-24824".

## Out of Scope

- The executor trace, its status rules and the allowlist membership: all unchanged.
- `gain-attached-hero` and `become-scheme-twist` (see Context).
- Any other `playTopVillainDeckCards` caller: scheme twists, Change the Outcome of WWII and `playVillainTop`. Those are not
  primitive bridges.
- Client wording for statuses: the Operator panel prints `trace.status` verbatim, and a friendlier label is a separate UI change.
- The hollow detector, coverage feeds, PAR, sim harness, scoring, replay, UIState shape, server and card data.

## Files Expected to Change

- `packages/game-engine/src/diagnostics/hollowEffect.types.ts` (modified, contract: two fire sites + JSDoc)
- `packages/game-engine/src/villain/villainEffects.execute.ts` (modified: the new helper + the allowlist comment)
- `packages/game-engine/src/moves/fightVillain.ts` (modified: three fight-bridge emissions)
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` (modified: two Ambush-bridge emissions)
- `packages/game-engine/src/diagnostics/effectTrace.record.test.ts` (modified: drift pin)
- `packages/game-engine/src/villain/reenterSewers.test.ts` (modified: intentional trace-count change)
- `packages/game-engine/src/villain/stackVillain.test.ts` (modified: intentional trace-count change)
- `packages/game-engine/src/villain/villainSecondarySiteTraces.test.ts` (**new**)
- `docs/ai/work-packets/WP-874-wrecking-crew-demolish.md` and
  `docs/ai/execution-checklists/EC-912-wrecking-crew-demolish.checklist.md` (drafting commit only: the one-line D-24824
  cross-link for `charge`)
- Close: `docs/ai/DECISIONS.md` (D-24824), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`; this WP file
  (execution amendment only, if any).

## Non-Negotiable Constraints

- **Determinism:** traces are hash-excluded (D-24294 / D-24271). `finalStateHash`, `computeStateHash`, every core sentinel and
  PAR pin stay byte-identical, and a moved pin is a STOP. No `ctx.random`, clock or I/O in the helper.
- **Inert:** no move, rule, `endIf`, bot, scoring or PAR path reads a trace. The new records are never gameplay input.
- **Gameplay byte-identical:** the bridges' behavior, log lines, narratives and event order do not change. Only
  `G.diagnostics.traces` gains entries.
- Nothing throws. The helper reuses `recordEffectTrace`'s cap and lazy init.
- `G` stays JSON-serializable: the `params` values are numbers and string literals.
- Engine layer only. No `boardgame.io` import added, and `index.ts` is not modified.
- Code style per `docs/ai/REFERENCE/00.6-code-style.md`: JSDoc on the new helper, no `.reduce()`, no nested ternaries,
  full English names, and `// why:` at each emission.
- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code
  (`docs/ai/REFERENCE/00.6-code-style.md`).
- Tests are `.test.ts` on `node:test` and `node:assert`, use `makeMockCtx` / the existing mock move contexts where a ctx
  is needed, never import `boardgame.io/testing`, and need no network or DB.

**Session protocol:** STOP and report if a cited symbol, guard or line anchor differs at HEAD, if any core sentinel /
`finalStateHash` / PAR pin moves, or if a test outside Scope In 4–6 needs editing to pass.

**Locked contract values:** see `## Contract` and the EC `## Locked Values`.

## Contract

- `EffectTraceFireSite` gains `'villain-fight-bridge' | 'villain-ambush-bridge'`, and `EFFECT_TRACE_FIRE_SITES` gains the
  same two members, in that order, after `'escape-scheme-twist'`.
- Exported `recordVillainSecondarySiteTrace` from `villain/villainEffects.execute.ts`. It is engine-internal and not
  re-exported from `index.ts`.
- The emission rules in D-24824.

## Vision Alignment

**Vision clauses touched:** §8 (Deterministic Game Engine), §22 (Deterministic & Reproducible Evaluation).

- **No conflict:** a diagnostics record that tells the truth about where an effect fired. Nothing is decided by it.
- **Non-Goal proximity:** NG-1 untouched.
- **Determinism preservation:** hash-excluded `G.diagnostics` only. Both hash oracles are diagnostics-blind (D-24294), so
  replays, stored scores and sentinels are unchanged. In-flight matches pick the traces up at once, because the
  bridges are engine code and not setup-built hooks.

## Funding Surface Gate

N/A. No funding, pricing, navigation or account surface.

## API Catalog Update

N/A. No HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. `EFFECT_TRACE_FIRE_SITES` equals `['villain-executor', 'hero-executor', 'hero-primitive', 'escape-scheme-twist',
   'villain-fight-bridge', 'villain-ambush-bridge']`, and the drift test passes.
2. Defeating Endless Armies of HYDRA (`play-villain-deck-cards:2` onFight) records, in order:
   - its executor trace (`no-op`, `villain-executor`);
   - then one `secondary-site` trace with `fireSite: 'villain-fight-bridge'`, `handler: 'playTopVillainDeckCards'`,
     `params: { magnitude: 2 }`, `timing: 'onFight'` and the framework turn;
   - then the played cards' own traces.
3. The Leader's Ambush play records one `secondary-site` trace with `fireSite: 'villain-ambush-bridge'`, `timing: 'onAmbush'`
   and the RevealContext turn. When the current player reveals the gating Hero (play count 0), no secondary trace is
   recorded and the executor `no-op` trace remains.
4. Defeating Mr. Immortal records one `secondary-site` trace (`villain-fight-bridge`, handler
   `'reenterSewersOnVillainDeckReveal'`, `params: {}`), both when he reenters and when he stays defeated.
5. Defeating Groot from Planet X records one `secondary-site` trace (`villain-fight-bridge`, handler `'enterStackCardsAsVillains'`,
   `params: { magnitude, stackVillainKind }`). Agent Eric Marshall's Ambush records the same with `villain-ambush-bridge`.
6. A henchman-classified card's secondary trace reads `scope: 'henchman'`; otherwise `scope: 'villain'`.
7. A Villain Deck defeat (the WP-872 Nightbringer path) of Endless Armies also records the fight-bridge secondary trace.
8. A card with none of the three primitives records no secondary trace, and the executor traces for all five
   deliberate-no-op primitives still read `no-op`.
9. The game log, `G.messages` and the non-diagnostics `G` are identical with and without the change for the AC 2 and 4 cases:
   the existing behavior tests in `moves/fightVillain.test.ts`, `villain/reenterSewers.test.ts`, `villain/stackVillain.test.ts`
   and `villainDeck/villainDeck.reveal.test.ts` pass with only the Scope In 4 edits.
10. No hash, sentinel or PAR pin moves.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm -r --no-bail test` → 0 fail in every package. The game-engine count rises by the new cases only.
3. `pnpm --filter @legendary-arena/game-engine typecheck:tests` → no new errors in the touched test files (the D-24372
   backlog is pre-existing, so compare against the baseline).
4. `git diff --name-only origin/main...HEAD` ⊆ Files Expected to Change.
5. Live (D-24026), in a 2p operator match created after the deploy, run on a Midtown Bank Robbery / HYDRA setup:
   - use the setters to put Endless Armies of HYDRA in the City and give Attack, then defeat it;
   - the Operator panel's "Recent effect traces" shows `Endless Armies of HYDRA — no-op` then `Endless Armies of HYDRA —
     secondary-site`;
   - the Play Diagnostics `effectTraces` carries the `villain-fight-bridge` record.

## Definition of Done

- All Acceptance Criteria hold, with the Verification Steps' commands and output tails pasted in the PR.
- Two-commit topology: `EC-915:` implementation, then a `SPEC:` close with:
  - D-24824 Active and a dated STATUS entry;
  - WORK_INDEX `[x]` and EC_INDEX Done;
  - mindmap ✅ plus `pnpm roadmap:counts:write`;
  - NUMBER-LEDGER LANDED.
- Live-on-surface (D-24026): Verification Step 5 is confirmed in a match created after the deploy
  (`isMatchOlderThanServer: false`). Until then it is recorded as operator-pending in `STATUS.md`.
- No files outside `## Files Expected to Change` were modified (`git diff --name-only origin/main...HEAD` checked).

## Reserved Decision (lands at execution)

**D-24824 — Secondary-site traces for the bridged deliberate-no-op villain primitives (amends D-24294's Deferred list;
supersedes the "No secondary-site trace; the log lines carry it." sentence of D-24811 §3).**

1. **Fire sites.** `EffectTraceFireSite` gains `villain-fight-bridge` (`runVillainFightFireSiteBridges`) and
   `villain-ambush-bridge` (the Ambush block of `performVillainReveal`). They name where the work ran; `effect` names what ran.
2. **Additive.** The executor trace is unchanged: `no-op` by primitive identity (D-24294). Each bridge adds one
   `secondary-site` record, the Mystique shape (D-24287).
3. **When.** Exactly when the bridge runs: play count > 0, a non-null reenter lookup, or a non-null stack entry. The record is
   written immediately before the bridge, so the played or entering cards' own traces follow their cause.
4. **Fields.**
   - `scope` comes from the executor's card-type resolution.
   - `handler` is the bridge function's name.
   - `params` is `{ magnitude }` for a play, `{}` for reenter, and `{ magnitude, stackVillainKind }` for a stack entry.
     `magnitude` is the descriptor's marked count (D-24294: params are a descriptor snapshot), not the realized count; the
     log carries the realized count. At the play site the marked and played counts are the same number.
   - `turn` is the framework turn (D-24704).
5. **Not covered.**
   - `gain-attached-hero`: its award is the generic WP-431 attached-Hero award at every fight, so no primitive bridge exists.
   - `playTopVillainDeckCards` callers that are not primitive bridges: scheme twists, WWII and `playVillainTop`.
6. **Inert.** Hash-excluded and never gameplay input (D-24294), so no hash, sentinel, PAR or replay change.
7. **Forward rule.** A future deliberate-no-op villain primitive whose work runs at a fire-site bridge emits a
   `secondary-site` trace at that bridge, through `recordVillainSecondarySiteTrace` (extending its `effect` and `handler`
   unions). A primitive listed under §5 is a named, tracked exception.

## Pre-flight (01.4) and Copilot (01.7)

**Pre-flight (01.4): READY TO EXECUTE** (2026-11-08, one independent subagent; verified every anchor at HEAD and ran the
five touched test files at baseline, 206 / 0).

- **Pass 1: NOT READY** on one blocking item, now folded in.
  - PS-1: D-24811 §3 says Mr. Immortal has "No secondary-site trace". D-24824 now names that sentence as superseded, and the
    close annotates it (Scope In 7).
- **Clarifying items, all folded in; no re-run needed, since scope was unchanged:**
  - RS-1: the drift test also needs its exhaustive `switch` labels and its title updated.
  - RS-2: the new test file is locked at ten cases covering AC 2–8.
  - RS-3: the WP-874 `charge` forward rule (D-24824 §7).
  - RS-4: three Context corrections: Mystique ordering, no other consumer of executor traces, and the typed `fireSite`.
  - RS-5: the typed helper signature and the play-site placement.
  - RS-6: WP-872 added as a hard-dep, the WORK_INDEX link tail, and Vision §10 dropped.
  - RS-7: the gated The Leader uses the co2e descriptor shape.
- No consumer outside the engine enumerates `fireSite`. No other test counts these traces.

**Copilot (01.7): PASS** (2026-11-08, one independent subagent, RISK / HOLD then a PASS confirmation).

- **Pass 1: RISK / HOLD.** Five findings, all folded in:
  - #30: WP-874 / EC-912 get the one-line D-24824 cross-link, and §7 names §5 entries as tracked exceptions.
  - #21 / #10: the helper's `effect` and `handler` are narrowed to literal unions.
  - #26: `magnitude` is the marked count, pinned by a one-card-stack case. Two wording slips are fixed.
  - #11: the AC 9 invariant is asserted directly in the AC 6 case.
- **Pass 2: PASS.** Two P2s were folded in:
  - the drafting PR must merge before execution, so the scope diff holds only execution files;
  - the EC says "named, tracked exception" in step with the WP and D-24824.

## Lint Gate Self-Review (00.3)

Independent subagent, 2026-11-08. The first pass had one FAIL, §2: the constraints let modified files be output as partial
edits, and they had no ESM / Node line, session protocol or locked-values pointer. All are now present (Non-Negotiable
Constraints). Also folded in:

- the EC's Live (D-24026) item and the three-dot scope diff;
- file descriptions and new / modified markers;
- the test-stack line;
- a named synthetic henchman fixture for AC 6.

The confirmation pass resolved every section:

- **§1 structure:** PASS. All sections are present, and Out of Scope names five exclusions.
- **§2 constraints:** PASS, after the fix above.
- **§3 Assumes:** PASS. The baseline, hard-deps, contract, symbols and anchors all match HEAD.
- **§4 Context:** PASS. ARCHITECTURE §Principles #1 / #2, rules, code-style, 00.6 and the D-entries are cited.
- **§5 files:** PASS. Eight code / test files plus governance files, each described.
- **§6 naming:** PASS. No 00.2 or setup field is touched.
- **§7 deps / §8 boundaries:** PASS. Engine only, no new dependency, `index.ts` untouched.
- **§9:** PASS. `pnpm` / `git` only.
- **§10 / §11:** N/A. No env var, no auth.
- **§12 tests:** PASS. `node:test`, no `boardgame.io/testing`, no network or DB.
- **§13 verification:** PASS. Every named script exists at HEAD.
- **§14:** PASS. Ten binary criteria.
- **§15 / §15.1 / §15.2:** PASS. The DoD covers governance, the scope diff, and the live item on a post-deploy match.
  `**Risk Tier:** LOW` is byte-identical in the EC.
- **§16 code style:** PASS. JSDoc, the `// why:` sites, no `.reduce()` and no nested ternaries; the helper has five
  callers.
- **§17 Vision:** PASS. §8 / §22, with no-conflict, NG-1 and determinism lines.
- **§18 / §19:** N/A.
- **§20 / §21:** PASS (N/A statements given).
- **EC:** 79 non-empty content lines (ceiling 100).
