# WP-792 — Master Strikes stop capturing a Bystander: only printed strike text resolves

**Status:** Draft 2026-10-04 · **EC:** EC-829 · **Reserves:** D-24654 (reserve PR #2578)
**Primary Layer:** Game Engine
**User-Visible Surface:** play.legendary-arena.com (game log, Mastermind captured-Bystander badge, Bystander VP and score)
**Lane:** standard two-session (scoring input + determinism oracles; ineligible for the lightweight lane under 01.0a
criteria 6 and 8)
**Baseline:** `origin/main` @ `afd76ffe` (2026-10-04), plus the reserve commit `a3effc1b` (#2578, ledger-only)

## Goal

A Master Strike does only what the Mastermind's printed Master Strike says. The MVP placeholder that made **every**
Master Strike, for **every** Mastermind, capture the top Bystander onto the Mastermind is removed. Players stop
rescuing Bystanders that the rules never put on the Mastermind, so rescued-Bystander counts, Bystander VP and scores
are no longer inflated. No Mastermind's printed strike capture is modeled in this packet. The two whose printed strike
captures from the Bystander Stack (Mr. Sinister, Madelyne Pryor) also print rules that make those Bystanders cost the
player something, and those rules are unmodeled. Both are named follow-ups.

## User-Visible Impact

- Jeff's solo match `PyK5YS2L8Bo` (2026-10-04, build `afd76ff`, Magneto / Super Hero Civil War):
  - the log shows `6.1.1` and `7.1.1` `[Master Strike] Magneto captured a Bystander.`;
  - defeating the Electromagnetic Bubble tactic then rescued 3 Bystanders (`8.2.11`). Two of the three came from the
    placeholder. The third (`2.1.1`) was a real Villain-Deck Bystander, captured by the Mastermind because the City was
    empty;
  - the final score's Bystander VP was 3 and should have been 1.
- Core Magneto's printed strike is "Each player reveals an [team:x-men] Hero or discards down to four cards." It
  captures nothing.
- After this packet:
  - no Master Strike logs `[Master Strike] … captured a Bystander.` or `[Master Strike] Bystander supply is empty — no
    bystander captured.`;
  - the Mastermind tile's captured-Bystander badge (`👤 N`) counts only real captures (Villain-Deck Bystander with an
    empty City, Here, Hold This, the kidnap fallback), so it is usually absent;
  - defeating a tactic rescues only those real captures.

**Business impact.** The placeholder inflated rescued-Bystander counts and Bystander VP, and so every score built on
them (`RawScore = Penalties − BP·200 − VP·1`, the endgame grade, competitive submissions), in every match, for every
Mastermind. Each Master Strike handed the player up to 200 points of score they did not earn. It is a
scoring-integrity defect on the competitive surface (Vision §3, §20–§24).

## Assumes

- **The placeholder (D-15401, WP-154, Immutable).** `packages/game-engine/src/rules/mastermindHandlers.ts`:
  - `captureBystanderOntoMastermind(gameState)` (~L169–208, module-private) moves `G.piles.bystanders[0]` onto
    `G.mastermind.attachedBystanders` and logs the D-24383 success line or the D-15401 empty-supply line;
  - `mastermindStrikeHandler` (~L1207) calls it **unconditionally** on its first line (~L1213). It is the only call
    site. The handler then dispatches the per-Mastermind printed strike (Magneto, Red Skull, core Loki, core Dr. Doom,
    co2e Doctor Doom / Loki / Magneto / Doctor Octopus, General Ross);
  - `DECISIONS.md` D-15401 (~L17084).
- **The success log line (D-24383, WP-574)**, `[Master Strike] ${name} captured a Bystander.` (`applied`), lives inside
  `captureBystanderOntoMastermind`. D-24383 (~L37833) is explicitly additive to D-15401.
- **The strike handler is the only Master Strike dispatch.** `rules/ruleRuntime.impl.ts` ~L37 maps
  `DEFAULT_MASTERMIND_HOOK_ID` to `mastermindStrikeHandler`. It runs at strike time (runtime code), not at setup.
- **Legitimate capture-onto-Mastermind paths that stay unchanged:**
  - Villain-Deck Bystander revealed with an empty City (`villainDeck/villainDeck.reveal.ts` ~L480–503, rules v23);
  - `captureBystanderToMastermind(G)` (`moves/seatChoiceCards.ts` ~L117, exported), used by Deadpool's Here, Hold This
    (D-24500) and the hero `kidnap-per-count` empty-City fallback (D-24537, `hero/heroEffects.execute.ts` ~L2553,
    ~L3736);
  - the rescue of `G.mastermind.attachedBystanders` on each tactic defeat and on the final defeat
    (`moves/fightMastermind.ts` ~L364–387, ~L514–530) and the defeat-choice target list
    (`moves/defeatChoice.resolve.ts` ~L117).
- **Projection.** `G.mastermind.attachedBystanders` is projected by `buildUIState` (`ui/uiState.build.ts` ~L933–943),
  passed through `filterUIStateForAudience` (`ui/uiState.filter.ts` ~L508–542), and rendered as a count badge in
  `apps/arena-client/src/components/play/MastermindTile.vue` (~L354–360). No shape change: the five-step Board-Visible
  Field Rule is already satisfied and untouched.
- **Determinism oracles.**
  - The only replay fixture is `test/fixtures/games/sentinel-core-doom-2p.replay.json` (core Dr. Doom, one strike).
    It pins the capture line in `messages` and `snapshotPerTurn[].messages` and a `finalStateHash`.
  - `PRE_WP080_HASH` (`replay/replay.execute.test.ts` ~L181) hashes a `moves: []` replay, which fires no strike.
  - The runtime-observed sweep (`scripts/runtime-observed-hollows.mjs`) plays 312 fixed-seed games on `core/dr-doom`
    only (~L133).
  - The weekly full-axis sweep (`data/sweep-fixtures/mastermind-ids.full.json`, `.github/workflows/sweep-weekly.yml`)
    covers every Mastermind but compares against no committed baseline.
- **Scoring.** `scoring/parScoring.logic.ts` counts Bystanders in each player's victory pile (~L77–130). Seed PAR
  (`data/par/seed/**`) is difficulty-rating driven (`scripts/generate-seed-par.mjs` header) and does not read
  simulation trajectories.
- **Data ids.** `G.selection.mastermindId` is `{setAbbr}/{slug}` (`00.2-data-requirements.md` §8.1; constants such as
  `'core/magneto'` and `'wwhk/general-thunderbolt-ross'` in `mastermindHandlers.ts`).
- **No new dependencies.** No package, script or workflow is added.
- **Suites at baseline (scaffold worktree on `a3effc1b`, after `pnpm -r build`):** game-engine 4838 / 0;
  arena-client 2262 / 0; dashboard 570 / 0; server 1659 / 0; every other package 0 fail. Re-record at execution.

## Context (Read First)

**Rules.** `docs/legendary-universal-rules-v23.md` ~L3429: "When a Master Strike occurs, each Mastermind does its
Master Strike ability." A Master Strike has no generic Bystander effect. D-15401 was an MVP shortcut ("minimal
deterministic modeling that unblocks projection graduation"), not a rule.

**Mastermind printed-strike audit (verified 2026-10-04).** `data/cards/*.json` holds 111 Masterminds and 171 printed
`Master Strike:` lines (base and epic faces). The lines that mention Bystanders, capture or kidnapping:

| Mastermind | Printed strike (Bystander part) | Why it is not in this packet |
|---|---|---|
| dkcy **Mr. Sinister** | "Mr. Sinister captures a Bystander. Then each player with exactly 6 cards reveals a [hc:covert] Hero or discards cards equal to the number of Bystanders Mr. Sinister has." | His card also prints "Mr. Sinister gets +1[icon:attack] for each Bystander he has", which is unmodeled. A capture alone would be free Bystander VP, the defect this packet removes. Follow-up: capture + the per-Bystander attack + the discard count. |
| ssw1 **Madelyne Pryor, Goblin Queen** | "Madelyne captures 4 Bystanders. If she already had any Bystanders before that, then each player gains a Wound." | Her card also prints that captured Bystanders are 2-attack "Demon Goblin" Villains that must be fought to rescue, and she can't be fought while she has any. Unmodeled; a capture alone would rescue 4 free Bystanders per strike on the next tactic defeat. Follow-up (Demon Goblins). |
| anni Annihilus | Reveal the Villain Deck top; a Bystander is captured by Annihilus, a Villain enters and captures one | Follow-up (conditional Villain-Deck reveal) |
| xmen Mojo (+ epic) | "Mojo captures a [keyword:Human Shield]" | Follow-up (Human Shield: face-down, pay-to-rescue, blocks the fight) |
| xmen Arcade (+ epic) | captures 1–2 random Bystanders from each player's Victory Pile as Human Shields, else a Wound | Follow-up |
| noir The Goblin, Underworld Boss | 2 random Victory-Pile Bystanders per player become Hidden Witnesses | Follow-up |
| noir Charles Xavier, Professor of Crime | Heroes in the HQ capture Hidden Witnesses | Follow-up |
| wwhk General Ross (Red Hulk face) | stacks a Victory-Pile Bystander as a Helicopter, else a Wound | Follow-up (the transform already ships, WP-669) |
| msmc Bastion (+ epic) | a Bystander Stack card ascends as a "Prime Sentinel" Mastermind | Follow-up |
| ca75 Baron Heinrich Zemo | each player KOs a Victory-Pile Bystander, else a Wound | Follow-up |
| mdns Lilith (+ epic) | Hunts for Victims; a KO'd Bystander wounds everyone | Follow-up |
| amwp Ghost; asrd Malekith; mgtg Ronan | "Kidnapped Victim" Hero / captures a Weapon / captures the Strike | Not a Bystander capture |

None of these strikes is implemented today. Each got the placeholder's single capture, like every other Mastermind.
`data/metadata/mastermind-pattern-assignments.json` already tags Mr. Sinister and Madelyne Pryor `strike-capture`
(~L42, ~L77), which corroborates the audit. No gate reads that tag as "implemented".

**Why every capture is removed, including Mr. Sinister's.** Every Bystander-capturing strike in the data is tied to a
rule that makes the captured Bystanders cost the player something (more attack, a fight to rescue, a discard count, a
face-down shield). Modeling only the capture would reintroduce free Bystander VP for that Mastermind. Mr. Sinister
loses one capture per strike compared with today. That capture was never balanced by his printed attack bonus, so
this is a fidelity-neutral change and a scoring-integrity gain. Each follow-up models a capture together with its
cost.

**D-24383 and the helper.** With the call removed, `captureBystanderOntoMastermind` has no caller, so it is deleted.
Both of its log lines (the D-24383 success line and the D-15401 empty-supply line) stop firing. A later printed-strike
capture uses the exported `captureBystanderToMastermind` (seatChoiceCards) or its own resolver, decided in that
follow-up.

**Empirical scaffold (2026-10-04).** The unconditional call was commented out on a throwaway worktree of `a3effc1b`,
then `pnpm -r build`, the engine suite, `pnpm -r --no-bail test` and the root gates were run. Observed:
- game-engine 4838 → 11 fail before the sentinel re-record, 10 after:
  - `rules/mastermindHandlers.test.ts`: 9 tests (L135, L167, L202, L234, L414, L470, L851, L1585, L1811);
  - `moves/fightMastermind.test.ts`: 1 test (L468, the capture-then-rescue integration test);
  - `test/fixtures/replayFixtures.test.ts`: the sentinel. The recorder re-record moves `finalStateHash`
    `492fe6bf…` → `06f79cdd…` and drops message `1.1.1 [Master Strike] core/dr-doom captured a Bystander.`; the other
    three lines renumber `1.1.2–1.1.4` → `1.1.1–1.1.3`. The recorder writes sorted keys, so the file also shows a
    key-order reshuffle (the committed copy has not been canonical since #2420). An independent re-diff confirmed
    nothing else changes.
- `PRE_WP080_HASH`: unchanged (`replay.execute.test.ts` green).
- `sim:runtime-observed:check`: **stale**. Regenerated: 7959 → 7953 observations, 80 mechanics unchanged, 0 dropped
  (`man-out-of-time` 83 → 77, `woman-out-of-time` 69 → 66, `gate-only` 482 → 485). A sweep-trajectory shift: bots
  rescue fewer Bystanders.
- dashboard `useInPlayCoverage.test.ts` ~L543 after `prebuild:coverage`: `totalObs` 8884 → 8878 (the only dashboard
  failure; `percentResolved` stays 13.9 = 1235 / 8878).
- `sim:coverage --check`, `ledger:heroes:check`, `ledger:villains:check`, `mechanics:metadata:check`,
  `effect-index:check`: OK, no diff.
- arena-client, server, registry, preplan, legends-board, registry-viewer, replay-producer, engine-runner,
  lagn-spec, vue-sfc-loader: 0 fail.

Deleting the now-unused helper does not change these results: the scaffold already had no caller.

**PAR.**
- Seed PAR is rating-driven and unaffected; it is never regenerated by this packet.
- The diagnostic turn-distribution profiles (`data/par/profile/v1/**`, `scripts/generate-par-profiles.mjs`, WP-597,
  `authoritative: false`) are simulation-derived, so they go stale. Nothing gates them. They are re-pinned by a
  separate `INFRA:` PR after merge, following the #2297 / #2405 precedent (25,600 games; a long run whose diff
  should be reviewed on its own).

**Scores and competitive history.**
- Live scores drop by about 200 per placeholder Bystander a player would have rescued. Before and after the deploy,
  scores on the same scenario are not comparable.
- **Matches in progress at deploy:** the handler is runtime code, so the next strike in a running match stops
  capturing. Placeholder Bystanders the Mastermind already holds stay there and are rescued normally. No migration.
- **Competitive replay window:** a match captured before the deploy and submitted after it re-executes under the new
  handler. Every match with a Master Strike diverges, so it fails `replay_verification_failed`. This is the same
  accepted window WP-790 / WP-789 / WP-726 carried, but much wider (nearly every match), and it does not close on its
  own (see the next bullet).
- **Read-time re-execution of pre-deploy artifacts** reflects the post-deploy rules and may diverge: the coach
  (`apps/server/src/coach/coach.logic.ts` ~L223, `reduceReplayByHash`) and competitive submit by `replayHash`.
  Replays are durable in `bgio.replay_artifacts` (`apps/server/src/replay/matchReplay.logic.ts` ~L402–421), so for a
  captured-but-unsubmitted pre-deploy match the window is permanent, not one that ages out. Accepted; no migration.
- **Stored `competitive_scores` rows stay frozen, not re-verified or rewritten** (the D-24616 §5 / D-24600 / D-24604
  precedent). Any annotation, season boundary or recompute is an operator decision (see §Open Operator Decisions);
  this packet changes no stored data.

**Read:**
- `docs/ai/DECISIONS.md`: D-15401, D-24383, D-12805 (Interpretation B), D-24500, D-24537, D-24616 §5, D-24081 (the
  sentinel excludes messages from the hash), D-24372 (runtime drift pins).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary; `.claude/rules/architecture.md` §Move & Phase Rules and §UIState
  Projection Integrity (no new field here, but the projected count changes).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 (`mastermindId`): no shape change.
- `wiki/master-strike.md` (describes the D-15401 capture as current behavior; updated by this packet).

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()`. No I/O in moves, rule handlers or helpers. Handlers never throw.
- `G` stays JSON-serializable. Zones store `CardExtId` strings only.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`. No `boardgame.io` import in
  `mastermindHandlers.ts` or its tests.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full-word names, JSDoc on every function, explicit
  loops, no `.reduce()`.

**Packet-specific:**
- **No Master Strike capture.** After this packet, no code reachable from `mastermindStrikeHandler` adds to
  `G.mastermind.attachedBystanders` or removes from `G.piles.bystanders`.
- **Every other capture path is untouched.** `villainDeck.reveal.ts`, `seatChoiceCards.ts`,
  `heroEffects.execute.ts`, `fightMastermind.ts` and `defeatChoice.resolve.ts` are not edited.
- **Existing-test edits are limited to the authorized list** in §Scope (In) C.
- **Oracle re-pins are limited to the forced list** in §Files Expected to Change, each done by its own regenerator,
  never by hand. `PRE_WP080_HASH` must stay byte-unchanged.
- **Do not regenerate** `data/par/profile/**` or `data/par/seed/**` in this packet.
- **No stored-data change.** No migration, no `competitive_scores` read or write, no script that touches the database.
- **Session protocol — STOP and report, do not guess, if:**
  - a Before Starting check differs from this WP (the unconditional call is not the handler's first statement, a
    second caller of `captureBystanderOntoMastermind` exists, or D-24654 is not Drafted);
  - an existing test outside §Scope (In) C fails;
  - the sentinel diff contains anything beyond AC6, or `PRE_WP080_HASH` moves;
  - any gate other than the forced re-pins shows a diff.

## Locked Contract Values

- **Remove** the unconditional `captureBystanderOntoMastermind(gameState);` line from `mastermindStrikeHandler`.
- **Delete** the now-unused `captureBystanderOntoMastermind` function and its JSDoc (~L169–208). If an import becomes
  unused as a result, remove it; no other code changes.
- **Unchanged:** `buildGenericStrikeEffects()` (the `masterStrikeCount` counter effect and queued message), the
  terminal `mastermindStrikeResolved` notable event, the strike narrative, and every per-Mastermind branch.
- **Comments** stop describing a generic capture and cite D-24654:
  - the module header (~L1–12);
  - the dispatcher JSDoc (~L1138–1157: "The generic bystander capture (D-15401) runs for every strike";
    `@param gameState … mutated for bystander capture`). It currently sits above `resolveGeneralRossStrike`'s JSDoc;
    move it so it directly precedes `export function mastermindStrikeHandler`, and correct its stale
    `@param _ctx … (unused …)` to `@param strikeContext` (the parameter is used for the active player and the shuffle);
  - the WP-200 `// why:` above the notable-event emission (~L1250: "AFTER both the generic bystander capture AND the
    per-mastermind text effect").
  - A one-line `// why:` at the top of `mastermindStrikeHandler`'s body: rules v23 ~L3429, each Mastermind does its own
    printed strike; D-24654 removed the D-15401 generic capture.

## Scope (In)

### A) Engine
- `rules/mastermindHandlers.ts` — the locked changes above.

### B) Comment-only corrections (no type, value or behavior change)
- `mastermind/mastermind.types.ts` ~L42–46: the `attachedBystanders` comments ("captured by mastermind strikes —
  append-only", "no removal in MVP") become "Bystanders the Mastermind holds (Villain-Deck reveal with an empty City,
  Here, Hold This, the kidnap fallback — D-24654); cleared when a tactic is defeated".
- `ui/uiState.build.ts` ~L933–937 and `ui/uiState.types.ts` ~L674–676: "WP-154 / D-15401: Master Strike captures a
  bystander" becomes a pointer to the D-24654 capture sources.

### C) Tests (authorized edits)
- **`rules/mastermindHandlers.test.ts`, existing tests:**
  - L135 (captures top bystander): inverted. Store stays `[]`, supply length and order unchanged. Renamed to "does not
    capture a Bystander (D-24654)".
  - L167 (empty supply): inverted. With an empty supply the handler appends no message for a Mastermind with no
    printed strike. Renamed accordingly.
  - L202 (WP-574 AC-1 success line) and L234 (WP-574 AC-2 distinguishable wordings): replaced by one test asserting
    that, for both a full and an empty supply, no message ends with `captured a Bystander.` or `no bystander
    captured.`.
  - L414 (Magneto "still captures one bystander"): inverted. Store stays `[]` and the supply keeps 2. Renamed to say
    the generic capture no longer runs (D-24654).
  - L470 (non-Magneto mastermind): the final assertion becomes `attachedBystanders.length === 0`; its message is
    updated.
  - L851 (Red Skull), L1585 (co2e), L1811 (Doctor Octopus): the capture assertions become store `[]` and supply
    length unchanged, with their comments updated. The counter-effect, notable-event and hand assertions are kept.
- **New case in `rules/mastermindHandlers.test.ts`:** for `dkcy/mr-sinister`, `ssw1/madelyne-pryor-goblin-queen`,
  `core/magneto`, `core/dr-doom` and an unknown id, a strike leaves the supply and the store unchanged. The two
  printed-capture Masterminds are deferred (D-24654 points 2 and 4), so a follow-up must change this pin on purpose.
- **`moves/fightMastermind.test.ts`, the capture-then-rescue integration test (~L396–539):**
  - the two `mastermindStrikeHandler(…)` calls become `captureBystanderToMastermind(…)` (imported from
    `./seatChoiceCards.js`; it always captures the top Bystander onto the Mastermind). The now-unused
    `mastermindStrikeHandler` import is removed;
  - the section comment (~L396–401), the `makeIntegrationState` JSDoc (~L405–410), the describe title, the in-test
    comments and the two capture assertion messages (~L476 "by the first strike", ~L506 "the second strike captures")
    say "capture" instead of "Master Strike" / "strike";
  - every asserted value is kept.
- **Non-vacuous (2/2 revert proofs):** restoring the unconditional capture fails the new case and the inverted
  tests; making `mastermindStrikeHandler` capture for `dkcy/mr-sinister` only fails the new case.

### D) Forced re-pins (by their regenerators)
- The sentinel fixture, re-recorded with `node scripts/record-game-fixture.mjs --name sentinel-core-doom-2p --input
  packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` (after the engine build). The
  semantic diff must be exactly: the new `finalStateHash`, the dropped capture line in both message lists, and the
  renumbered addresses of the three remaining lines. A key-order reshuffle is expected and acceptable.
- `docs/ai/coverage/runtime-observed-hollows.json` via `pnpm sim:runtime-observed`.
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` ~L543: the `totalObs` pin only, after
  `pnpm --filter @legendary-arena/dashboard run prebuild:coverage`, with a dated provenance comment in the file's
  existing style. Scaffold value: 8878.

### E) Docs
- `wiki/master-strike.md`: the "every fire captures a bystander" description (~L51–52, ~L90–93, ~L110–115, ~L188,
  ~L259, ~L299–301, ~L310, ~L346) is rewritten to the D-24654 behavior. D-15401 is described as superseded, cited
  by ID only: the rewrite keeps neither the phrase "generic bystander capture" nor the deleted helper's name, because
  the AC8 check is a case-insensitive literal match.

## D-24654 Content

The entry is drafted in `DECISIONS.md` as `(Drafted 2026-10-04; not yet landed — WP-792 / EC-829)`. To flip it, the
executor replaces that heading suffix with `(Active <date> — WP-792 / EC-829)`, adds a `**Gates.**` paragraph with
the recorded results, and updates point 5 if the observed numbers differ. It locks:
1. A Master Strike resolves only the Mastermind's printed strike (rules v23 ~L3429). The generic capture is removed.
   **Supersedes D-15401** in full. `G.mastermind.attachedBystanders` stays the Mastermind-side store (D-12805
   Interpretation B). Its writers are the Villain-Deck reveal with an empty City and `captureBystanderToMastermind`
   (D-24500, D-24537). Rescue on tactic defeat is unchanged.
2. No printed strike capture is modeled yet. A printed capture is modeled only together with the rule that makes the
   captured Bystanders cost the player (Mr. Sinister's per-Bystander attack, Madelyne Pryor's Demon Goblins, Human
   Shields, Hidden Witnesses…). A capture alone would reintroduce free Bystander VP.
3. **D-24383** is superseded with D-15401. Its success line and the D-15401 empty-supply line stop firing, and the
   helper that held them is deleted.
4. Follow-ups: dkcy Mr. Sinister, ssw1 Madelyne Pryor, anni Annihilus, xmen Mojo and Arcade, noir The Goblin and
   Charles Xavier, wwhk Red Hulk, msmc Bastion, ca75 Zemo, mdns Lilith.
5. Determinism and scoring:
   - The sentinel `finalStateHash` and its messages are re-recorded; `PRE_WP080_HASH` is unchanged.
   - The runtime-observed feed and the dashboard `totalObs` pin are regenerated.
   - The PAR profiles are re-pinned by a follow-up `INFRA:` PR; seed PAR is unaffected.
   - In-progress matches switch at deploy with no migration.
   - Pre-deploy competitive submissions fail `replay_verification_failed`, and read-time re-execution of pre-deploy
     replays (coach, submit by `replayHash`) reflects post-deploy rules. Accepted; permanent for unsubmitted
     pre-deploy artifacts.
   - Stored `competitive_scores` rows are frozen.

At govern-close the executor also adds pointers:
- D-15401's `**Status:**` line becomes `Immutable. **Superseded by D-24654** (WP-792, <date>) — …`;
- D-24383 gets a one-line `**Superseded by D-24654**` note.
Both entries' bodies stay as written.

## Out of Scope

- Modeling any printed Bystander strike (D-24654 points 2 and 4), including Mr. Sinister's "+1 attack per Bystander" and
  Madelyne Pryor's Demon Goblins.
- Human Shield, Hidden Witness and Victory-Pile-steal mechanics.
- A "not yet modeled" log line for unimplemented strikes.
- Stale D-15401 comments in files this packet must not edit, left for one separate `INFRA:` comment commit:
  - `apps/arena-client/src/components/play/MastermindTile.vue` ~L18–20;
  - `packages/game-engine/src/moves/fightMastermind.ts` ~L364–369;
  - `packages/game-engine/src/moves/seatChoiceCards.ts` ~L112.
  The rendering and the logic need no change. `docs/ai/DESIGN-MASTERMIND-STRIKE-MIGRATION.md` (~L43, ~L62) names the
  deleted helper; it is a dated 2026-07-30 proposal and stays as a historical snapshot.
- PAR profile regeneration (`data/par/profile/v1/**`), the follow-up `INFRA:` PR. Seed PAR (`data/par/seed/**`).
- Any `competitive_scores` read, write, recompute or annotation.
- The kidnap fallback's log wording in `seatChoiceCards.ts` (it prints "Here, Hold This" text; a separate papercut).
- The pre-existing length of `mastermindStrikeHandler` (over the ~30-line guidance before this packet; this packet
  shortens it).

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts` — modified — remove the generic capture and the dead helper; comments
- `packages/game-engine/src/mastermind/mastermind.types.ts` — modified — comment only
- `packages/game-engine/src/ui/uiState.build.ts` — modified — comment only
- `packages/game-engine/src/ui/uiState.types.ts` — modified — comment only
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — modified — the authorized edits + the new case
- `packages/game-engine/src/moves/fightMastermind.test.ts` — modified — the integration test's capture source + comments
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — modified — re-recorded by the recorder
- `docs/ai/coverage/runtime-observed-hollows.json` — modified — regenerated by `pnpm sim:runtime-observed`
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — modified — the `totalObs` pin + dated provenance comment only
- `wiki/master-strike.md` — modified — the generic-capture description rewritten to D-24654; D-15401 marked superseded
- **Generated, modified ONLY if its gate shows a real diff** (none expected per the scaffold):
  `scripts/coverage/hero-effect-coverage.baseline.json`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`
- Governance — modified: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24654 → Active; the D-15401 / D-24383
  pointers), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`

No other files may be modified. A `packages/lagn-spec/schemas/lagn-v1.json` line-ending churn from the build is
reverted, not committed. No `01.6` post-mortem is required: the packet removes an execution path and adds no
contract, projection, builder, wiring or code category.

## Contract

- A Master Strike never adds a Bystander to the Mastermind and never draws from the Bystander supply.
- Every other capture and rescue path behaves exactly as before.

## Acceptance Criteria

1. For any Mastermind (including `dkcy/mr-sinister`, `ssw1/madelyne-pryor-goblin-queen`, `core/magneto`,
   `core/dr-doom` and an unknown id), a Master Strike leaves `G.piles.bystanders` and `G.mastermind.attachedBystanders`
   unchanged.
2. No Master Strike logs a line ending `captured a Bystander.` or `no bystander captured.`.
3. `captureBystanderOntoMastermind` no longer exists in `mastermindHandlers.ts`.
4. The `masterStrikeCount` effect, the queued message, the `mastermindStrikeResolved` event and every existing
   per-Mastermind branch behave as before (their existing assertions pass).
5. A Villain-Deck Bystander revealed with an empty City, Here, Hold This, and the kidnap fallback still capture onto
   the Mastermind, and tactic defeats still rescue. Existing suites pass; the only edit in `fightMastermind.test.ts` is
   the authorized integration-test capture source and comments, with every assertion kept.
6. The sentinel's key-order-independent semantic diff (the Verification Steps command) is exactly the 10 listed
   paths: the new hash, the dropped capture line and the renumbered addresses.
   `PRE_WP080_HASH` is unchanged.
7. The only edited existing tests are the ones listed in §Scope (In) C and the dashboard `totalObs` pin.
8. `wiki/master-strike.md` no longer describes a generic capture:
   `Select-String -Path wiki/master-strike.md -Pattern 'Generic bystander capture|captureBystanderOntoMastermind'` returns no
   match.

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0
node scripts/record-game-fixture.mjs --name sentinel-core-doom-2p --input packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json
git show origin/main:packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json > $env:TEMP\sentinel-before.json
node -e "const fs=require('fs');const [a,b]=process.argv.slice(1).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));const out=[];const walk=(x,y,p)=>{if(typeof x!=='object'||x===null||typeof y!=='object'||y===null){if(JSON.stringify(x)!==JSON.stringify(y))out.push(p);return;}for(const k of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[k],y[k],p+'.'+k);};walk(a,b,'');console.log(out.join('\n'));" $env:TEMP\sentinel-before.json packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json
# Expected — exactly these 10 paths, nothing else (any other path → STOP):
#   .expected.finalStateHash
#   .expected.messages.0.text  .expected.messages.0.outcome  .expected.messages.1.text  .expected.messages.2.text  .expected.messages.3
#   .expected.snapshotPerTurn.0.messages.0 .. .expected.snapshotPerTurn.0.messages.3
pnpm --filter @legendary-arena/game-engine test
# Expected: 0 fail; record before/after counts (baseline 4838)
pnpm sim:runtime-observed; pnpm sim:runtime-observed:check
# Expected: regenerated, then OK (scaffold: 7959 -> 7953, 80 mechanics, 0 dropped)
pnpm sim:coverage --check; pnpm effect-index:check; pnpm mechanics:metadata:check; pnpm ledger:heroes:check; pnpm ledger:villains:check
# Expected: OK, no diff
pnpm --filter @legendary-arena/dashboard run prebuild:coverage; pnpm --filter @legendary-arena/dashboard test; pnpm --filter @legendary-arena/dashboard test:coverage; pnpm --filter @legendary-arena/dashboard typecheck
# Expected: 0 fail after the totalObs re-pin (scaffold value 8878); typecheck exits 0
pnpm wiki:lint; pnpm wiki-viewer:check-links
# Expected: exits 0
Select-String -Path wiki/master-strike.md -Pattern 'Generic bystander capture|captureBystanderOntoMastermind'
# Expected: no output
pnpm -r --no-bail test
# Expected: 0 failures in every package
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All ACs pass; the 2/2 revert proofs are reported; engine and dashboard before/after counts are recorded.
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` has 0 failures; dashboard typecheck exits 0.
- [ ] The sentinel re-recorded by the recorder, with the semantic diff of AC6. `PRE_WP080_HASH` unchanged.
- [ ] `sim:runtime-observed:check` OK after regeneration; the other feed checks OK; the dashboard pin re-pinned.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] Two commits on one branch:
  1. `EC-829: …` — engine, tests, re-pins, wiki. The body lists each authorized test edit as an intentional behavior
     change, with a `Tests-changed:` trailer and a `Vision: §1, §3, §8, §14, §20–§24, §26` trailer.
  2. `SPEC: WP-792 / EC-829 govern-close — …` — STATUS, DECISIONS (D-24654 Active + the D-15401 / D-24383 pointers),
     WORK_INDEX, EC_INDEX, mindmap, roadmap counts.
- [ ] **D-24026 live verify (REQUIRED):** in a manual match against core Magneto, let a Master Strike resolve:
  - the log has no `[Master Strike] … captured a Bystander.` line;
  - the Mastermind tile shows no captured-Bystander badge unless a Villain-Deck Bystander was captured with an
    empty City;
  - defeating a tactic rescues only those real captures.
  Record the matchId in STATUS.md.
- [ ] **Order:** the live verify can only run after merge and deploy. The `SPEC:` govern-close records "D-24026
      live-verify pending" (the WP-783 / WP-790 precedent); the matchId is recorded by a post-deploy STATUS commit. Do
      not record a live result before it is observed.
- [ ] STATUS.md updated. D-24654 flipped to Active with gate results; the D-15401 / D-24383 pointers added.
- [ ] WORK_INDEX WP-792 `[x]` with date. EC_INDEX EC-829 → Done. Mindmap `📝`→`✅`. `pnpm roadmap:counts:write`;
      `roadmap:counts:check` exits 0. `pnpm ledger:numbers:check` exits 0.

## Open Operator Decisions (do not block execution)

- **OD-1 — competitive history.** Stored `competitive_scores` rows from before the deploy include placeholder
  Bystander VP (up to 200 points per placeholder rescue). Options: leave as-is (the default; the D-24616 §5 precedent),
  annotate the leaderboard with the deploy date, or start a new gauntlet season. Rewriting stored scores is not
  proposed.
- **OD-2 — PAR profile re-pin timing.** The follow-up `INFRA:` re-pin of `data/par/profile/v1/**` runs after merge
  (precedent #2405). It can also wait for the next calibration pass, since the profiles are diagnostic only.
- **OD-3 — the deferred printed Bystander strikes** (D-24654 point 4): which to schedule, if any. Mr. Sinister and
  Madelyne Pryor are the cheapest. Each needs its capture plus the printed cost: his per-Bystander attack and discard
  count; her Demon Goblins.

## Vision Alignment

- **Clauses touched:**
  - §1 Rules Authenticity: a Master Strike does what the card says, and nothing else.
  - §3 Player Trust & Fairness, §20–§24 (PAR scoring, scenario-aware scoring, deterministic evaluation,
    leaderboards, replay-verified integrity): removes unearned Bystander VP from every score.
  - §8 / §22 Determinism: no randomness and no new `G` field. The oracles that move are re-pinned by their
    regenerators.
  - §14 Explicit Decisions: D-24654 supersedes D-15401 in the open.
  - §26 Simulation-Calibrated PAR: the diagnostic profiles are re-pinned by the follow-up `INFRA:` PR.
  - None of NG-1..NG-8 is crossed (nothing paid, persuasive or cosmetic affects play).
- **Conflict assertion:** No conflict. Gameplay and scoring fidelity only; no monetization surface.
- **Determinism and scoring:** scores go down where the placeholder inflated them, which is the fix. The accepted
  replay window and the frozen rows are in §Context; the history choices are OD-1.

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. This was an independent subagent run: FAIL on the first pass, then PASS on a
delta re-lint and on a final confirmation after the copilot fixes.
- **§1 structure:** every required section is present. The baseline `afd76ffe` and the reserve commit `a3effc1b` are cited.
- **§2 constraints:** the engine-wide constraints (full files, ESM / Node v22+, 00.6), the packet-specific
  constraints, the Session protocol and the Locked Contract Values.
- **§3 Assumes:** D-15401, D-24383, the strike dispatch, the capture and rescue paths, the projection, the
  determinism oracles, scoring, the data ids and the baseline suite counts, each with a verified line anchor.
- **§4 Context:** rules v23 ~L3429; the 111-Mastermind printed-strike audit; the scaffold results; the DECISIONS scan
  list; ARCHITECTURE §Layer Boundary; the UIState rule; 00.2 §8.1; `wiki/master-strike.md`.
- **§5 files:** a closed allowlist with `— modified` markers: 4 source files, 2 test files, 3 forced re-pins, the
  wiki and governance. The generated artifacts are named by exact path and change only on a real gate diff. The list
  goes over the ~8-file guidance only through regenerator re-pins, so it is not split.
- **§6 naming:** `mastermindId` is `{setAbbr}/{slug}` per 00.2 §8.1. `dkcy/mr-sinister` and
  `ssw1/madelyne-pryor-goblin-queen` are verified in data.
- **§7 dependencies:** no new package, script or workflow.
- **§8 layer:** an engine-only removal. No new `G` field, the five-step projection is untouched, nothing is persisted.
- **§9 Windows:** `pwsh` verification, with `Select-String` and a pwsh-safe `node -e` semantic diff.
- **§10 / §11:** N/A. No environment variable is read or added, and no auth surface is touched.
- **§12 tests:** `node:test` + `makeMockCtx`, with no boardgame.io, network or database. The sentinel is re-recorded by
  its recorder. 2/2 revert proofs.
- **§13 verification:** exact commands with expected output. The sentinel re-record and the 10-path semantic diff run
  before the engine test, and the dashboard typecheck is included.
- **§14 ACs:** 8 binary ACs. AC5 and AC7 bound the authorized test edits, and AC6 points to the semantic-diff command.
- **§15 DoD:** STATUS; DECISIONS (D-24654 Active + the D-15401 / D-24383 pointers); WORK_INDEX; EC_INDEX; the mindmap;
  the `git status` allowlist; two commits; the D-24026 live verify, which runs after merge and deploy.
- **§16 code style:** removal only, with no new helper. JSDoc and `// why:` are locked. The handler's pre-existing
  length is listed in Out of Scope.
- **§17 Vision:** §1, §3, §8, §14, §20–§24 and §26 are touched; no NG-1..NG-8 crossing. A determinism and scoring
  line is present, and the accepted replay window and frozen rows are stated (OD-1).
- **§18 prose-vs-grep:** the one literal grep (AC8) targets only `wiki/master-strike.md`, and Scope E forbids the
  matched phrases in the rewrite.
- **§19:** N/A. Commit-time discipline for the STATUS entry at govern-close.
- **§20 Funding:** N/A. An engine strike-handler and scoring-fidelity change with no funding UI, copy or channel.
- **§21 API Catalog:** N/A. No HTTP endpoint and no `apps/server/src/**` library function is added, changed or re-statused.

## Gate Verdicts

Each gate ran as an independent subagent against the live worktree, with the scaffold logs as evidence.
- **Pre-flight (01.4): NOT READY → READY TO EXECUTE.**
  - **PS-1 (blocking).** The first draft modeled Madelyne Pryor's printed "captures 4 Bystanders". Her card also
    prints that captured Bystanders are 2-attack "Demon Goblin" Villains, and she can't be fought while she has any.
    That rule is unmodeled, so all 4 would be rescued free on the next tactic defeat: worse inflation than the
    placeholder. **Fixed:** no printed capture is modeled. The RS item on Mr. Sinister's unmodeled "+1 attack per
    Bystander" applied the same rule to him, so every Bystander-capturing strike is now a follow-up (D-24654 points 2
    and 4). The now-unused helper is deleted, and the integration test moves to `captureBystanderToMastermind`.
  - **RS items applied:**
    - stale comments locked: the dispatcher JSDoc move and the `@param strikeContext` fix;
    - stale comments in files this packet must not edit listed as out-of-scope papercuts;
    - the `fightMastermind.test.ts` JSDoc and assertion-message wording authorized;
    - `wiki:lint` and `wiki-viewer:check-links` added;
    - the weekly full-axis sweep noted (no pinned baseline);
    - the `mastermind-pattern-assignments.json` corroboration cited.
  - **Delta re-check: READY.** It verified that the helper has one caller and no external references, that every
    asserted value of the migrated integration test holds, that the 9-test edit list is complete, and that the
    re-pin list is complete.
- **Copilot (01.7): RISK → HOLD → PASS.** Five scope-neutral findings:
  - **#11:** AC6 rested on eyeballing a key-reshuffled `git diff`. Fixed: a pwsh-safe semantic-diff command with the
    10 expected paths.
  - **#18:** the D-24026 order was undefined. Fixed: the live verify runs after merge and deploy, and govern-close
    records "live-verify pending".
  - **#28:** read-time re-execution of pre-deploy replays (coach, submit by `replayHash`) and the durable
    `bgio.replay_artifacts` were missing. Fixed in the scores section and D-24654 point 5.
  - **#26:** an EC comment bullet was misnested. Fixed.
  - **#20:** how to flip D-24654 to Active was unstated. Fixed.
  - The delta re-check returned **PASS**. Its one nit, the "ages out" wording conflict, was fixed. The semantic-diff
    baseline now reads `origin/main` so it still works after commit 1.
- **Lint (00.3): FAIL → PASS.**
  - Fixed: the Session protocol bullet (§2); `— modified` markers and descriptions (§5); all stale comments locked
    (§16.5); the Verification order and the dashboard typecheck (§13); AC5's "unedited" (§14); the EC locked values
    made verbatim; the two-commit topology.
  - Advisories applied: 00.2 §8.1, the AC8 phrasing rule, and "points 2 and 4".
  - The final confirmation after the copilot fixes returned **PASS** on all 21 sections.
