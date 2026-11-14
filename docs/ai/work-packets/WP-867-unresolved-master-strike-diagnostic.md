# WP-867 — A Master Strike with no resolver is flagged as a hollow effect, and the effect index lists every Master Strike (Game Engine + coverage feed)

**Status:** Draft 2026-11-06 (EC-905; D-24810 reserved, PR #3182)
**Layer:** Game Engine (the strike dispatcher's fall-through arm; one locked contract union widened) + coverage feed (the
effect-implementation index gains Master Strike rows from a new provenance overlay)
**User-Visible Surface:** play.legendary-arena.com (game log line, Play Diagnostics hollow-effects panel); dashboard `/debug/effects`
**Risk Tier:** MEDIUM — a locked contract union (`HollowEffectRecord.cardType`) and the hashed `G.messages` log for every match
whose Mastermind has no strike resolver; no gameplay state, no new `G` field, no auth, money, persistence or server surface
**Hard-deps:** WP-257 / D-24033 + D-24034 (hollow-effect records, `recordHollowEffect`, the `G.diagnostics` channel) ✅, WP-258
(the UIState `hollowEffects` projection and filter pass-through) ✅, WP-507 / D-24313 (the effect index's mastermind-tactic feed
and its provenance overlay) ✅, WP-792 / D-24654 (a Master Strike resolves only its printed text; the accepted replay window) ✅

## Goal

A Master Strike for a Mastermind whose strike text the engine does not resolve does nothing and says nothing. In operator match
`vZXSkk4xJNC` (Fin Fang Foom) both strikes logged only "Mastermind strike revealed — strike count incremented.", and neither the
hollow-effects panel nor Play Diagnostics showed a gap. After this WP:

- When `mastermindStrikeHandler` reaches no per-Mastermind arm, it records a `HollowEffectRecord` with `cardType: 'mastermind'`,
  `mechanic: 'master-strike'`, `reason: 'no-handler'`. `recordHollowEffect` also writes its standard red `blocked` line ("Unhandled
  effect observed: …") to the game log. The panel and the Play Diagnostics export pick the record up through the existing
  projection.
- The effect-implementation index (`data/metadata/effect-implementation-index.json`, dashboard `/debug/effects`) gains one Master
  Strike row per Mastermind (111 today). Rows for the Masterminds the dispatcher resolves come from a new curated overlay,
  `scripts/coverage/strike-provenance.json`, and every other row defaults to `unmarked`.

## User-Visible Impact

`play.legendary-arena.com`: at a Master Strike for a Mastermind without a strike resolver, the log shows a red line naming the
Mastermind card and the `master-strike` mechanic, just before the existing "strike count incremented" line. The Play Diagnostics
hollow-effects panel shows a row with card type `mastermind`. Masterminds that do have a resolver behave and log exactly as
before. Dashboard `/debug/effects` lists a Master Strike row per Mastermind with its implementation status. Live-on-surface is
operator-pending (D-24026).

## Assumes

- Baseline `origin/main` `a0a0c197` (2026-11-06, the WP-867 reservation #3182 on top of WP-863 #3181; re-recorded at commit).
  `pnpm -r build` 0; game-engine 6335 / 0 (measured on `4d474e93`; #3182 is ledger-only).
- `rules/mastermindHandlers.ts` `mastermindStrikeHandler(gameState, strikeContext, payload, _implementationMap)` (~1356) is one
  `if / else if` chain on `gameState.selection.mastermindId` with 11 branches covering 12 Mastermind ids today (~1373-1414; the
  Red Skull branch matches both `MASTERMINDS_RED_SKULL` ids): `core/magneto`, the Red Skull pair (`core/red-skull`, `co2e/red-skull`), `core/loki`, `core/dr-doom`, `co2e/doctor-doom`, `co2e/loki`, `co2e/magneto`,
  `co2e/doctor-octopus`, `wwhk/general-thunderbolt-ross`, `ca75/baron-heinrich-zemo` (`BARON_ZEMO_MASTERMIND_ID`),
  `ca75/arnim-zola` (`ARNIM_ZOLA_MASTERMIND_ID`). The chain has no `else`; the comment at ~1365-1367 says an unmatched Mastermind
  "takes no branch and the strike is generic bookkeeping only". After the chain the handler pushes the `mastermindStrikeResolved`
  notable event and returns `buildGenericStrikeEffects()` (~179-180: `modifyCounter masterStrikeCount +1` and the
  `queueMessage` "Mastermind strike revealed — strike count incremented."), which the pipeline applies after the handler returns.
- `resolveCurrentPlayer(context)` (~211) narrows `context.ctx.currentPlayer` structurally with no `RevealContext` import, returning
  `null` for stub contexts. `RevealContext` (`villainDeck/villainDeck.reveal.ts` ~96-101) carries `ctx: { currentPlayer; turn }`,
  and every production site forwards the framework turn (D-24704).
- The strike trigger is `'onMastermindStrikeRevealed'`, a member of `RuleTriggerName` / `RULE_TRIGGER_NAMES`
  (`rules/ruleHooks.types.ts` ~29 / ~43).
- `G.mastermind.baseCardId` is the selected face's card ext_id, `${setAbbr}-mastermind-${mastermindSlug}-${baseCard.slug}`
  (`mastermind/mastermind.setup.ts` ~253). Test paths set it to the mastermind id (~199-237).
- `diagnostics/hollowEffect.types.ts` (contract file, D-24034): `HollowEffectRecord.cardType: 'hero' | 'villain' | 'henchman'`
  (~140). `diagnostics/hollowEffect.record.ts` `recordHollowEffect(G, record)` lazy-inits `G.diagnostics`, honours
  `HOLLOW_EFFECTS_CAP` (256), and pushes `Unhandled effect observed: card "${cardId}" declared a "${mechanic}" mechanic at ${timing},
  but no executable handler was reached (${reason}).` as `blocked` with `card = cardId`. `EffectTrace.scope` is a separate union and
  is not touched.
- Projection: `ui/uiState.build.ts` (~2397-2424) and `ui/uiState.filter.ts` (~1657-1679) copy `cardType` verbatim; no UIState field
  is added. arena-client `components/play/hollowEffects.group.ts` types `cardType` as `HollowEffectRecord['cardType']` and
  `HollowEffectsPanel.vue` (~111) prints it as text, so `'mastermind'` renders with no client change. `diagnostics/effectProvenance.ts`
  (`apps/arena-client/src/diagnostics/effectProvenance.ts`, ~123) reads only `cardId`, for played cards. Dashboard `types/coverage.ts` types `cardType` as `string`. `scripts/runtime-observed-hollows.mjs` keys on
  `mechanic` and copies `cardType`.
- Hashes: `replay/replay.hash.ts` `computeStateHash` excludes only `G.diagnostics`; `G.messages` and `G.logMeta` stay hashed. The
  fixture oracle `test/fixtures/hashGameState.ts` excludes `messages`, `logMeta`, `lastPlayEffectsFired` and `diagnostics`. The one
  `finalStateHash` sentinel (`test/fixtures/games/sentinel-core-doom-2p.replay.json`) and the `sim:runtime-observed` sweep
  (`scripts/runtime-observed-hollows.mjs` ~133) use `core/dr-doom`, which has an arm; `sim:coverage` (`scripts/hero-effect-coverage.mjs`)
  is a static hero card-data scan that fires no strike. `PRE_WP080_HASH` (`replay/replay.execute.test.ts` ~188) fires no
  strike. Scoring reads only `G.diagnostics.conditionalClauses` (display-only, `scoring/parScoring.logic.ts` ~127).
- Server: `replay/matchCapture.logic.ts` stores `replayHash = computeStateHash(finalState)`; competitive submission re-reduces the
  artifact and rejects a mismatch (`competition/competition.logic.ts` ~827-835).
- Effect index: `scripts/build-effect-implementation-index.mjs` builds hero and villain rows from the ledgers and mastermind
  **tactic** rows from card data plus `scripts/coverage/tactic-provenance.json` (`readMastermindTactics` ~236, `normalizeTactic`
  ~197). There are no Master Strike rows. Summary at HEAD: 2064 entries, `byScope.mastermind` 456. `STATUS_ORDER` (~80) is
  `executable, deferred, condition, unsupported, unmarked, subsystem`. The dashboard copy `apps/dashboard/src/data/effect-implementation-index.json`
  is gitignored; dashboard tests use synthetic data.
- Registry: `packages/registry/src/schema.ts` `EffectImplementationIndexSchema` validates the committed index
  (`schema.effectImplementationIndex.test.ts`); `mechanic` is a free string and `mastermind` is already in the scope enum, so the
  strike rows validate with no schema change.
- Card data: 111 Masterminds across 40 set files, each with a `slug` and `name` and no duplicate `${abbr}/${slug}`.
- **Scaffold (observed, 2026-11-06, on `4d474e93`):** the prototype (widened union + an `else` arm calling `recordHollowEffect`)
  built clean; game-engine 6335 tests, 6332 pass, 3 fail, all asserting "an unimplemented mastermind records nothing":
  `rules/mastermindHandlers.test.ts` ~155 (Test 4, `messages.length` unchanged), `simulation/simulation.captureMoves.test.ts` ~619 and
  `simulation/sweep.runner.test.ts` ~371 (`hollowEffects` `[]` under the mock registry, whose Mastermind has no arm). Every other
  package was green (registry 311, arena-client 2546, server 1847, dashboard 594, registry-viewer 341, legends-board 138,
  lagn-spec 108, preplan 52, engine-runner 20, vue-sfc-loader 11, replay-producer 4). `sim:runtime-observed:check`,
  `sim:coverage --check` and `effect-index:check` exited 0 with no diff. The sentinel and `PRE_WP080_HASH` held.

## Context (Read First)

- **Why now.** WP-864 fixes Fin Fang Foom, but about 99 of 111 Masterminds still have no strike resolver, and each of those strikes
  is silent. The hollow detector (WP-257) exists to make exactly this visible; it covers heroes, villains and henchmen, not the
  Mastermind. WP-864 deferred it here (`WP-864-demolish-keyword.md` Context, "The hollow flag is out").
- **Record and log line: both, through the one seam.** `recordHollowEffect` already writes the structured record (the contract the
  panel, Play Diagnostics and the sim harvest read) and the red log line (what a player sees). A bespoke `blocked` line like
  General Ross's (`resolveGeneralRossStrike` ~1304) would be a second, unstructured channel that the panel and the sweep cannot
  read, so no extra line is added. Widening `cardType` is the honest classification: the strike belongs to the Mastermind card, and
  calling it `villain` would mislabel it in the panel and the sweep.
- **Where the flag fires.** Only in the dispatcher's new terminal `else`, so "flagged" means "no arm reached", the D-24033
  reachability rule. An arm that legitimately does nothing on this board (no player qualifies, an empty deck) is not hollow. General
  Ross has an arm and its own honest-partial `neutral` line, so it is not flagged.
- **Hash consequence (accepted, the D-24654 precedent).** No gameplay state changes. The new log line is in `G.messages` /
  `G.logMeta`, which `computeStateHash` hashes, so for a match whose Mastermind has no arm, the replay hash changes from the first
  strike on. Consequences, as D-24654 §5 recorded for the capture removal (which touched every Mastermind):
  - The `finalStateHash` fixture oracle ignores `messages` and `diagnostics`; the sentinel uses `core/dr-doom`. No re-pin.
    `PRE_WP080_HASH` fires no strike. No re-pin. The runtime-observed sweep uses `core/dr-doom`, and `sim:coverage` is a static
    scan that fires no strike. No regeneration.
  - PAR: scoring reads neither `G.messages` nor the hollow records, and gameplay is identical, so no PAR profile moves.
  - Matches in progress get the flag at their next strike after deploy (dispatcher code, not a setup hook). No migration.
  - A legacy artifact still waiting for the D-24719 gameover backfill (`apps/server/src/replay/matchCapture.logic.ts` ~217-281
    `fillMissingArtifactGameovers` → `deriveArtifactGameover`), with a strike from a Mastermind that has no arm, re-reduces to a new
    hash and stores an unknown outcome (`{}`). Accepted: the same window as D-24654, and likely already closed by the backfill.
  - A competitive match captured before the deploy, with a strike from an unflagged-then Mastermind, and submitted after it fails
    `replay_verification_failed`: the accepted window D-24654 / D-24652 / D-24637 carried. Read-time re-execution (coach, submit by
    `replayHash`) reflects the new log. Stored `competitive_scores` rows stay frozen (D-24616 §5).
- **Coverage feed: yes, as a curated overlay (the WP-507 tactic pattern).** The index enumerates identity from card data (one
  `master-strike` row per Mastermind) and reads status / handler / WP / decision from `scripts/coverage/strike-provenance.json`.
  A Mastermind absent from the overlay is `unmarked`, never a fabricated attribution. `normalizeTactic` already produces exactly this
  row shape (mechanic = its fourth argument), so the strike rows reuse it with `'master-strike'`; no second normalizer.
- **Overlay honesty is tested against the real dispatcher.** A new engine test reads the overlay and the card data, maps each row to
  its engine Mastermind id (`${abbr}/${slug}`), and runs the real `mastermindStrikeHandler` for every row marked `executable` or
  `deferred`: none may record a `master-strike` hollow. An overlay row that claims a resolver the dispatcher lacks fails. The other
  direction (an arm with no overlay row) is not enforced, as with tactics: it under-reports on the dashboard and never over-claims.
- **WP-864 is order-independent.** Both WPs edit the end of the dispatcher chain; whichever lands second rebases (WP-864 adds an
  `else if` arm, WP-867 adds the terminal `else`). The new tests use a synthetic Mastermind id (`'test/no-strike-resolver'`) and the
  mock registry, so neither WP's tests break the other. If WP-864 has landed when WP-867 executes, `chmp/fin-fang-foom` gets an
  `executable` overlay row (WP-864 / D-24807); if not, its row is a one-line `INFRA:` follow-up after WP-864.
- **General Ross is `deferred`.** Its arm flips the boss face; its named follow-on effect is logged as not modeled (WP-669
  honest-partial). `executable` would over-claim.
- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, Principle #1 (determinism), §Persistence Boundary (`G.diagnostics` is
  runtime-only, never gameplay input). Scan D-24033, D-24034, D-24271, D-24294, D-24313, D-24654 and D-24704 in
  `docs/ai/DECISIONS.md` before coding. `docs/ai/REFERENCE/00.2-data-requirements.md` §1.3 Mastermind Shape (the `slug` / `name`
  fields the strike feed enumerates and the parity test reads). `docs/ai/REFERENCE/00.6-code-style.md`.

### RS-1 — The unresolved-strike record (default locked)

In `rules/mastermindHandlers.ts`:

- `const MASTER_STRIKE_HOLLOW_MECHANIC = 'master-strike';` and `const MASTER_STRIKE_TRIGGER: RuleTriggerName =
  'onMastermindStrikeRevealed';` (type-only import of `RuleTriggerName`, so the string is checked against the trigger union).
- `function resolveStrikeTurn(context: unknown): number`, mirroring `resolveCurrentPlayer`: returns `context.ctx.turn` when it is a
  finite number, else `0`. No `RevealContext` import, no boardgame.io type. This is the third copy of the narrow
  (`hero/heroEffects.execute.ts` ~1175 `readTurnNumber`, `villainDeck/villainDeck.reveal.ts` ~114 `readRevealContextTurn`); both are
  module-private and one is `RevealContext`-typed, so exporting either would widen the allowlist. The `// why:` says so; no
  extraction this WP.
- The chain gains a terminal `else` arm:
  `recordHollowEffect(gameState, { cardId: gameState.mastermind.baseCardId, cardType: 'mastermind', timing: MASTER_STRIKE_TRIGGER,
  mechanic: MASTER_STRIKE_HOLLOW_MECHANIC, reason: 'no-handler', turn: resolveStrikeTurn(strikeContext) });`
- Nothing else in the handler changes: the 11 branches, the `mastermindStrikeResolved` emission and `buildGenericStrikeEffects()` stay
  byte-identical. The log order at an unresolved strike is therefore the hollow line, then "Mastermind strike revealed — strike
  count incremented.". The comment at ~1365-1367 is rewritten to say the unmatched case is flagged (WP-867 / D-24810).

### RS-2 — The contract widening (default locked)

`diagnostics/hollowEffect.types.ts`: `HollowEffectRecord.cardType: 'hero' | 'villain' | 'henchman' | 'mastermind'` (appended last)
and its `@property cardType` JSDoc. `EffectTrace.scope`, `EFFECT_EXECUTION_REASONS`, `HOLLOW_EFFECTS_CAP` and every other member are
unchanged. `docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md` (~210) states the same union.

### RS-3 — The strike rows in the effect index (default locked)

- New `scripts/coverage/strike-provenance.json`: `{ "schemaVersion": 1, "_comment": "<one paragraph, the tactic-provenance
  comment's shape, naming WP-867 / D-24810>", "strikes": { "<extId>": { "status", "handler", "wp", "decision" } } }`, keyed by
  `${setAbbr}-mastermind-${mastermindSlug}-master-strike`, keys sorted. Rows (handler =
  `packages/game-engine/src/rules/mastermindHandlers.ts#<function>`):

| extId | status | handler function | wp | decision |
|---|---|---|---|---|
| `ca75-mastermind-arnim-zola-master-strike` | executable | `resolveArnimZolaStrike` | WP-821 | D-24754 |
| `ca75-mastermind-baron-heinrich-zemo-master-strike` | executable | `resolveBaronZemoStrike` | WP-818 | D-24752 |
| `co2e-mastermind-doctor-doom-master-strike` | executable | `resolveDoctorDoomStrike` | WP-388 | D-24192 |
| `co2e-mastermind-doctor-octopus-master-strike` | executable | `resolveDoctorOctopusStrike` | WP-397 | D-24200 |
| `co2e-mastermind-loki-master-strike` | executable | `resolveLokiStrike` | WP-398 | D-24201 |
| `co2e-mastermind-magneto-master-strike` | executable | `resolveCo2eMagnetoStrike` | WP-388 | D-24192 |
| `co2e-mastermind-red-skull-master-strike` | executable | `resolveRedSkullStrike` | WP-577 | D-24386 |
| `core-mastermind-dr-doom-master-strike` | executable | `resolveCoreDoomStrike` | WP-538 | D-24347 |
| `core-mastermind-loki-master-strike` | executable | `resolveCoreLokiStrike` | WP-537 | D-24346 |
| `core-mastermind-magneto-master-strike` | executable | `resolveMagnetoStrike` | WP-476 | D-24284 |
| `core-mastermind-red-skull-master-strike` | executable | `resolveRedSkullStrike` | WP-577 | D-24386 |
| `wwhk-mastermind-general-thunderbolt-ross-master-strike` | deferred | `resolveGeneralRossStrike` | WP-669 | D-24483 |

  Plus `chmp-mastermind-fin-fang-foom-master-strike` (executable, `resolveFinFangFoomStrike`, WP-864, D-24807) **only if** WP-864's
  arm is on `main` at execution. The row set equals the Mastermind ids the dispatcher resolves at HEAD; the executor checks each
  handler function exists. `wp` / `decision` name the WP and decision that made the printed strike resolve in full (so the co2e
  Doctor Octopus and Loki rows cite WP-397 / D-24200 and WP-398 / D-24201, which finished the branches D-24192 left open, and the
  Red Skull rows cite WP-577 / D-24386, which superseded the D-24188 auto-pick); the
  overlay `_comment` states this rule.
- `scripts/build-effect-implementation-index.mjs`: `STRIKE_PROVENANCE_PATH`, a reader mirroring `readTacticProvenance`, and
  an exported `readMastermindStrikes(provenance, tacticEntries)` mirroring `readMastermindTactics`: one row per `setData.masterminds` entry with a non-empty
  `slug` and `name`, built by ``normalizeTactic(extId, `${mastermind.name} Master Strike`, setAbbr, 'master-strike',
  provenance[extId])``. An overlay key that matches no enumerated Mastermind is a `TransformFailure` with a full-sentence message.
  The strike entries join the tactic entries in `buildIndex`'s mastermind input. The orphan check is new behaviour (the tactic feed
  ignores orphan keys). `readMastermindStrikes` also raises a full-sentence `TransformFailure` when a strike extId is in the
  `tacticEntries` extId set (the caller passes `readMastermindTactics`' result): both feeds use `scope: 'mastermind'`, so `buildCards` would merge
  them silently (0 collisions today). `TransformFailure` stays module-private: the orphan test uses the real card data plus a bogus overlay key
  and asserts with `assert.throws(fn, /<full-sentence regex>/)`. Summary: `byScope.mastermind` 456 → 567,
  `totalEntries` 2064 → 2175 (12 or 13 move out of `unmarked`; record the exact counts).
- `scripts/build-effect-implementation-index.test.ts`: a strike row's shape, the `unmarked` default, an overlay row applied
  verbatim, the orphan-key failure, the strike/tactic extId-collision failure (a synthetic tactic entry with extId `core-mastermind-magneto-master-strike`,
  `assert.throws` + regex; real data has none), and one real-data row per status (`core-mastermind-magneto-master-strike` executable; an
  unmapped Mastermind unmarked).

### RS-4 — Tests (default locked)

- **New** `packages/game-engine/src/rules/mastermindStrike.unresolved.test.ts` (state copied from `mastermindHandlers.test.ts`
  `makeTestState`):
  1. `selection.mastermindId = 'test/no-strike-resolver'`, context `{ ctx: { currentPlayer: '0', turn: 7 } }`: exactly one
     `G.diagnostics.hollowEffects` record, deep-equal to `{ cardId: <mastermind.baseCardId>, cardType: 'mastermind', timing:
     'onMastermindStrikeRevealed', mechanic: 'master-strike', reason: 'no-handler', turn: 7 }`, and exactly one new `G.messages`
     entry, the `blocked` "Unhandled effect observed: …" line for that card.
  2. A stub context `{}` records `turn: 0`.
  3. The returned effects deep-equal the pre-WP generic pair, and the `mastermindStrikeResolved` notable event is still pushed.
  4. `core/magneto` and `wwhk/general-thunderbolt-ross` record no `master-strike` hollow.
  5. With `G.diagnostics.hollowEffects` at `HOLLOW_EFFECTS_CAP`, the strike pushes nothing and `hollowEffectsDropped` increments.
  6. **Overlay parity:** read `scripts/coverage/strike-provenance.json` and `data/cards/*.json` with `node:fs` (paths resolved from
     `import.meta.url`, four levels up to the repo root; test-only reads, the `rules/effectRulings.test.ts` ~121 /
     `hero/deckCardKoTrigger.test.ts` ~39 precedent); every overlay key maps to an enumerated Mastermind, and for every `executable` / `deferred` row the real
     handler on a fresh state with that `${abbr}/${slug}` records no `master-strike` hollow. Before the loop it asserts the overlay
     has at least 12 keys; the loop counts the rows it checked and asserts `checkedCount === 12` (13 if the WP-864 row is present),
     so an empty read or a misspelled status filter fails.
  7. **Log order:** after the unresolved strike, pass the handler's returned effects to `applyRuleEffects` (the pipeline step that
     writes the generic `queueMessage`) and assert the last two `G.messages` texts are the hollow `blocked` line, then "Mastermind
     strike revealed — strike count incremented.".
- **Projection** (`ui/uiState.filter.test.ts`, the WP-258 hollowEffects block ~2031-2152, `describe` ~2073): one added case, a `mastermind` /
  `master-strike` record survives `filterUIStateForAudience` for a player and a spectator audience with `cardType: 'mastermind'`.
- **Sanctioned product-change edits** (the behavior they pinned is what this WP changes; the commit says so):
  - `rules/mastermindHandlers.test.ts` Test 4 (~155): still no Bystander captured; now exactly one new message, the hollow line.
    Retitle to say the strike is flagged, not silent (D-24654 + WP-867).
  - `simulation/simulation.captureMoves.test.ts` (~619) and `simulation/sweep.runner.test.ts` (~371): every captured record is a
    `master-strike` / `mastermind` / `no-handler` record (the mock Mastermind has no arm), `hollowEffects.length >= 1` (the
    scaffold observed records for both seeds), the subset of any other record is `[]`, and `hollowEffectsDropped` is 0. The
    degenerate no-game asserts (captureMoves ~648 / ~658) stay `[]`. Update the `// why` comments. Do not loosen to "length ≥ 0" or delete the assertion.
- Expected unchanged: the sentinel `finalStateHash` and messages oracle, `PRE_WP080_HASH`, every per-Mastermind strike test,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`.

## Scope (In)

- **Engine:** RS-1 in `rules/mastermindHandlers.ts`; RS-2 in `diagnostics/hollowEffect.types.ts` (contract file, D-24810).
- **Coverage feed:** RS-3 (`strike-provenance.json` new, the index builder, its test, the regenerated index).
- **Tests:** RS-4.
- **Docs:** `docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md` union line; ewiki `wiki/master-strike.md` (~106, the "takes no branch ...
  generic counter only" paragraph now says the strike is flagged) and `wiki/debug-effects.md` (the `source:` list ~22 gains the
  strike overlay; the feed description ~115-163 covers Master Strike rows).

## Out of Scope

- Implementing any Master Strike, including Fin Fang Foom (WP-864) and the D-24654 §4 follow-ups.
- A bespoke per-Mastermind "not yet modeled" line, a new UIState field, any arena-client, dashboard UI or server change.
- Flagging unresolved tactic Fight effects (`dispatchTacticOnFight` keeps its silent fall-through; the tactic overlay already shows
  them `unmarked`), Scheme Twists, or Epic faces.
- The `/debug/effects` page subtitle (`apps/dashboard/src/pages/debug/EffectsPage.vue` ~78-81, "the mastermind-tactic feed"): a
  follow-up, since this WP changes no dashboard UI.
- Enforcing "every arm has an overlay row" (the reverse parity), `EffectTrace` records for strikes, `replay/replay.hash.ts`,
  re-verifying stored competitive rows.

## Files Expected to Change

- `packages/game-engine/src/rules/mastermindHandlers.ts`: **modified**, RS-1.
- `packages/game-engine/src/diagnostics/hollowEffect.types.ts`: **modified**, RS-2 (contract file; D-24810).
- `packages/game-engine/src/rules/mastermindStrike.unresolved.test.ts`: **new**, RS-4.
- `packages/game-engine/src/ui/uiState.filter.test.ts`: **modified**, one added projection case (RS-4); no existing case changes.
- `packages/game-engine/src/rules/mastermindHandlers.test.ts`, `packages/game-engine/src/simulation/simulation.captureMoves.test.ts`,
  `packages/game-engine/src/simulation/sweep.runner.test.ts`: **modified**, the sanctioned RS-4 edits only.
- `scripts/coverage/strike-provenance.json`: **new**. `scripts/build-effect-implementation-index.mjs`,
  `scripts/build-effect-implementation-index.test.ts`: **modified**. `data/metadata/effect-implementation-index.json`: **generated**.
- `docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md`: **modified**, the union line. `wiki/master-strike.md`, `wiki/debug-effects.md`:
  **modified**, docs only (`pnpm wiki:lint` 0).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24810), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code; see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- The flag goes through `recordHollowEffect` only: no direct `G.diagnostics` push, no second log line. `G.diagnostics` is never read
  as gameplay input.
- Determinism: no randomness, clocks or I/O in engine code (the parity test's `node:fs` reads are test-only). Handlers never throw.
  No `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`.
- Never edit a test to pass beyond the three sanctioned RS-4 edits. Never `git stash`.

**Session protocol:** STOP and report if the sentinel `finalStateHash`, its messages oracle or `PRE_WP080_HASH` moves; if
`sim:runtime-observed:check` or `sim:coverage --check` reports drift; if any per-Mastermind strike test changes; or if any test
outside the three sanctioned ones fails.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `HollowEffectRecord.cardType` gains `'mastermind'` (RS-2).
- `mastermindStrikeHandler` records one `master-strike` hollow when no arm matches; its signature, arms, notable event and returned
  effects are unchanged (RS-1).
- The effect index gains `scope: 'mastermind'`, `mechanic: 'master-strike'` rows keyed `${setAbbr}-mastermind-${slug}-master-strike`,
  with provenance from `scripts/coverage/strike-provenance.json` (RS-3).

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation), §24 (Replay-Verified Competitive Integrity: the accepted pre-deploy verification window).
- **No conflict:** a printed ability the engine does not resolve stops being silent; players and the operator can see the gap.
- **Non-Goal proximity:** NG-1..7: none crossed (NG-1 no pay-to-win: diagnostics only, nothing is bought).
- **Determinism preservation:** no gameplay state changes and no randomness. The new log line shifts the replay hash for matches
  whose Mastermind has no arm; pre-deploy captures submitted after the deploy fail verification (the accepted D-24654 window);
  stored competitive rows stay frozen (D-24616 §5).

## Funding Surface Gate

N/A: no nav, pricing or funding surface. The outputs are a log line, a diagnostics record and coverage rows.

## API Catalog Update

N/A: no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. A Master Strike for a Mastermind with no dispatcher arm records exactly one `HollowEffectRecord` with the RS-1 fields and the
   turn from the reveal context, and writes one `blocked` "Unhandled effect observed" line before the strike-count line.
2. A Master Strike for any of the 12 (13 with WP-864) resolved Mastermind ids records no `master-strike` hollow and logs exactly as
   before.
3. The record reaches UIState `hollowEffects` and the Play Diagnostics panel with `cardType` `mastermind` through the existing
   projection, with no client change (the RS-4 filter case).
4. `effect-implementation-index.json` has one `master-strike` row per Mastermind; the overlay rows carry their status, handler, WP
   and decision; every other row is `unmarked`; `effect-index:check` exits 0.
5. The overlay parity test checks exactly 12 rows (13 with WP-864) and fails if an `executable` row names a Mastermind with no arm.
6. Engine, arena-client, dashboard and server suites are green; `pnpm -r build` exits 0; the sentinel, `PRE_WP080_HASH`,
   `sim:runtime-observed` and `sim:coverage` are unchanged.

## Verification Steps

- `pnpm -r build`: exits 0; `git status` shows no unexpected generated churn.
- `pnpm effect-index`: exits 0; only `data/metadata/effect-implementation-index.json` changes; record the new summary counts.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test`: green. Baseline 6335; record the exact delta (expect at least +6).
- `pnpm -r --no-bail test` (arena-client 2546, server 1847, dashboard 594, registry 311 unchanged in count), `pnpm --filter
  @legendary-arena/arena-client typecheck`, `pnpm --filter @legendary-arena/dashboard typecheck`.
- `pnpm effect-index:check`, `pnpm effect-index:test`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`,
  `pnpm --filter @legendary-arena/dashboard prebuild:effect-index`, `pnpm wiki:lint`.
- Revert proofs: removing the `else` arm fails RS-4 test 1; flipping a non-resolved Mastermind's overlay row to `executable` fails
  the parity test. Restore both.
- At govern-close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check` and
  `node scripts/check-number-ledger.mjs --check`.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Suites green; `pnpm -r build` exits 0; the two revert proofs observed and restored.
- [ ] Effect index regenerated; every `:check` above green; sentinel, `PRE_WP080_HASH` and both sim feeds byte-unchanged.
- [ ] **Live-on-surface (D-24026):** in any match whose Mastermind has no strike arm (in-flight matches qualify; this is dispatcher
      code), a Master Strike logs the red "Unhandled effect observed … master-strike …" line and the Play Diagnostics hollow panel
      shows a `mastermind` row; dashboard `/debug/effects` lists Master Strike rows. Confirmed live, or operator-pending in
      `STATUS.md`.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24810 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap
      ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] If WP-864 had not landed at execution, the `chmp-mastermind-fin-fang-foom-master-strike` overlay row is recorded as a
      follow-up in `docs/ai/STATUS.md`.
- [ ] No files outside `## Files Expected to Change` were modified; checked with `git diff --name-only origin/main...HEAD`.

## Reserved Decision (lands at execution)

D-24810: A Master Strike that reaches no per-Mastermind arm in `mastermindStrikeHandler` is a hollow effect (the D-24033
reachability rule). The dispatcher's terminal `else` calls `recordHollowEffect` with `cardId` = `G.mastermind.baseCardId`,
`cardType: 'mastermind'`, `timing: 'onMastermindStrikeRevealed'`, `mechanic: 'master-strike'`, `reason: 'no-handler'` and the
reveal context's turn, which also writes the standard `blocked` log line; no bespoke line. `HollowEffectRecord.cardType` (a D-24034
contract union) gains `'mastermind'`. An arm that resolves partially (General Ross) or legitimately does nothing on the board is not
hollow. The record's `cardId` (the base card ext_id) and the index row's extId (`...-master-strike`) differ by design; a future
record-to-row join maps both through the engine id `${abbr}/${slug}`. The effect index gains one `master-strike` row per Mastermind, with status / handler / WP / decision from the curated
`scripts/coverage/strike-provenance.json` (the WP-507 tactic pattern; absent = `unmarked`), and an engine test checks every
overlay row that claims a resolver against the real dispatcher. No gameplay state changes. The log line shifts `computeStateHash`
for matches whose Mastermind has no arm: no sentinel, `PRE_WP080_HASH`, sim feed or PAR re-pin; pre-deploy competitive captures
submitted after the deploy fail `replay_verification_failed`, and a legacy artifact still awaiting the D-24719 gameover backfill
stores an unknown outcome (both the accepted D-24654 window); stored rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1 (HEAD `a0a0c197`):** NOT READY on four factual PS items, all folded with no scope or contract change, which
  01.4 §Verdict treats as READY once applied: (1) the chain has 11 branches covering 12 Mastermind ids (Red Skull's branch matches
  two), now stated in Assumes, RS-1 and the EC; (2) `sim:coverage` is a static hero card-data scan, not a sweep, now stated in
  Assumes and Context; (3) `effectProvenance.ts` is the arena-client file, path corrected; (4) the co2e Doctor Octopus and Loki
  overlay rows now cite WP-397 / D-24200 and WP-398 / D-24201, which finished the branches D-24192 left open, and the overlay
  `_comment` states the "made it resolve in full" rule. Eight RS items folded: the sim test edits also assert `length >= 1` and the
  no-game asserts stay `[]`; `resolveStrikeTurn` stays a local third copy with a `// why:` (both existing copies are module-private);
  the parity test's `node:fs` reads are locked to `import.meta.url` with the `effectRulings.test.ts` / `deckCardKoTrigger.test.ts`
  precedent and a `// why:`; `wiki/master-strike.md` and `wiki/debug-effects.md` join the allowlist and the EffectsPage subtitle is
  an Out-of-Scope follow-up; D-24810 says how record and row ids join; the WORK_INDEX row reads "11 `executable` + General Ross
  `deferred`"; the orphan test uses `assert.throws` with `TransformFailure` kept private. RS-7 (guard `mastermind.baseCardId`) is not
  taken: `LegendaryGameState` requires `mastermind`, every direct caller supplies it, and the scaffold run was green.
  Everything else was verified at HEAD: every Assumes path and line, the 111 Masterminds with no extId collision, the 2064 / 456 →
  2175 / 567 arithmetic, the `normalizeTactic` row shape, all hard-deps `[x]`, every RS-3 WP / D, and the three sanctioned tests as
  the only ones that pin the old behavior. **Verdict: READY TO EXECUTE.**
- **Copilot round 1:** RISK → HOLD, five findings, all folded with no allowlist-category or contract change (pre-flight not
  re-run): (11) the parity test gains a lower bound (overlay ≥ 12 keys, `checkedCount === 12` / 13) so an empty read fails;
  (11/26) a strike extId equal to a tactic extId is now a `TransformFailure` with its own test, since both feeds are `scope:
  'mastermind'` and `buildCards` would merge them silently (the wrong EC smell was replaced); (11) AC-1's log order gets RS-4 case
  7 (handler effects through `applyRuleEffects`) and AC-3 gets one projection case in `ui/uiState.filter.test.ts` (added to the
  allowlist); (28) the D-24719 gameover backfill is named as a second consumer of the accepted hash window, in Context and D-24810;
  (30) the WP-864-not-landed Fin Fang Foom overlay row gets a home in the DoD / EC (`STATUS.md` follow-up), and the 00.3 section
  is filled below. The other 25 modes were verified clean.
- **Copilot round 2:** all five round-1 folds confirmed consistent across WP and EC; RISK → HOLD on one finding (11 / 25): the
  collision check's placement was left open and the `buildIndex` option is module-private, so its test could not reach it. Locked:
  the exported `readMastermindStrikes(provenance, tacticEntries)` throws on a strike extId in the tactic set, tested with a
  synthetic tactic entry; the `buildIndex` alternative is dropped. Nit folded: the WORK_INDEX row names the conditional 13th row.
  Re-checked by the same gate: CONFIRM. **Verdict: PASS.**
- **After the 00.3 folds (round 3):** copilot CONFIRM (all seven lint folds consistent in WP and EC, no new scope); pre-flight
  re-confirm **READY TO EXECUTE**, with every new fact checked at HEAD (`applyRuleEffects` order, the filter-test block, WP-577 /
  D-24386, `EffectImplementationIndexSchema`, the D-24719 backfill, 00.2 §1.3, Vision §24). Two wording nits folded: the filter-test
  block range, and the collision guard joins the EC's required `// why:` list.

## Lint Gate Self-Review (00.3)

Run by an independent gate pass after copilot round 2. Two FAILs, both folded: §4 now cites `00.2-data-requirements.md` §1.3
(the Mastermind `slug` / `name` the feed and the parity test read), and §6 the Red Skull overlay rows cite WP-577 / D-24386 (which
superseded the D-24188 auto-pick), the same "resolved in full" rule as the co2e Doctor Octopus / Loki rows. Optional folds taken:
Vision §24 and an NG-1..7 line, the registry schema line in Assumes, registry 311 in the unchanged counts, and double-backtick
code spans around the template literal. Pre-flight and copilot confirmed these folds (no scope or contract change).

- **§1 structure:** every required section is present and non-empty, plus Contract, Vision Alignment, Funding, API Catalog and
  Reserved Decision. Out of Scope names implementing any strike (Fin Fang Foom, the D-24654 §4 follow-ups), a bespoke line, a
  UIState field, client / dashboard UI / server changes, tactic Fight / Scheme Twist / Epic flags, the EffectsPage subtitle, the
  reverse parity check, `EffectTrace` and `replay.hash.ts`. Acceptance Criteria has six binary checks. **PASS.**
- **§2 constraints:** full-file output, ESM, Node v22+, `00.6-code-style.md` cited. `recordHollowEffect` is the only seam and
  `G.diagnostics` is never gameplay input. Determinism holds (the `node:fs` reads are test-only); handlers never throw. Test edits are
  limited to the three sanctioned RS-4 edits. A session protocol with four STOP triggers; locked values → EC. **PASS.**
- **§3 Assumes:** four hard-deps (WP-257 / 258 / 507 / 792), each `[x]` in WORK_INDEX; baseline `a0a0c197`, engine 6335 / 0. Every
  dispatcher, contract, projection, hash, server, index-builder, registry-schema and card-data fact has a file and line (11 branches /
  12 ids, `cardType` ~140, 2064 / 456, 111 Masterminds with no `${abbr}/${slug}` collision). The observed scaffold run names the three
  tests that pin the old behavior. **PASS.**
- **§4 Context:** why now; the record and its standard line through the one seam; the flag fires only when no arm is reached
  (D-24033); the hash consequence per D-24654 §5 (sentinel, `PRE_WP080_HASH`, sims, PAR, in-flight matches, the D-24719 backfill, the
  competitive window); the overlay pattern and its honesty test; WP-864 order independence; General Ross `deferred`; RS-1..RS-4
  locked. Cites ARCHITECTURE §Rule Execution Pipeline / Principle #1 / §Persistence Boundary, 00.2 §1.3, a DECISIONS scan list and
  00.6. **PASS.**
- **§5 files:** every file with full path and new / modified / generated: 2 engine source files, 1 new + 4 modified engine tests
  (three sanctioned edits, one added case), the new overlay, the index builder and its test, the generated index (the dashboard copy is
  gitignored), 3 docs, governance. Every other path in the body is a read-only reference. **PASS.**
- **§6 naming:** full words (`resolveStrikeTurn`, `MASTER_STRIKE_HOLLOW_MECHANIC`, `MASTER_STRIKE_TRIGGER`, `readMastermindStrikes`,
  `STRIKE_PROVENANCE_PATH`). `slug` / `name` match 00.2 §1.3 and the engine; extIds follow the tactic feed's grammar. Every overlay WP / D
  checked against DECISIONS and the resolver `// why:` comments. No 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency. The engine change is one dispatcher arm and one contract union through
  `recordHollowEffect`, with no registry, boardgame.io or I/O import in engine source. The parity test's `node:fs` reads are test-only
  (the `effectRulings.test.ts` / `deckCardKoTrigger.test.ts` precedent). The coverage feed imports no engine code. No client,
  dashboard UI or server change. **PASS.**
- **§9 Windows:** `pnpm` / `node` / `git` commands only; test paths resolve from `import.meta.url`. **PASS.** **§10 / §11:** no env
  var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`, no boardgame.io, network or DB. The real `mastermindStrikeHandler` and `applyRuleEffects`;
  the synthetic id `test/no-strike-resolver` (WP-864-independent); the parity floor (≥ 12 keys, `checkedCount === 12` / 13); two revert
  proofs; sanctioned edits assert exact records and `length >= 1`. **PASS.**
- **§13 verification:** exact commands with expected exits and counts: build, `effect-index` (only the index changes), engine
  baseline 6335 with a ≥ +6 delta, `-r --no-bail test` counts, arena-client and dashboard `typecheck`, `effect-index:check` / `:test`,
  `sim:runtime-observed:check`, `sim:coverage --check`, dashboard `prebuild:effect-index`, `wiki:lint`, and the govern-close checks.
  Every script exists. **PASS.**
- **§14 / §15:** six binary criteria tied to RS items and commands. The DoD names STATUS, DECISIONS (D-24810 → Active), WORK_INDEX,
  EC_INDEX, the mindmap and the ledger, the diff allowlist check, the revert proofs and the WP-864-not-landed follow-up, plus the
  D-24026 live check (§15.1: `play.legendary-arena.com` + dashboard `/debug/effects`, operator-pending fallback in STATUS).
  **§15.2:** `**Risk Tier:** MEDIUM` in the WP header and verbatim in the EC (not HIGH, so no threat-model section). **PASS.**
- **§16 code-style:** reuses `recordHollowEffect`, `normalizeTactic` and the tactic-provenance reader shape. `resolveStrikeTurn` is a
  third local copy of the turn narrow, kept local with a `// why:` (both existing copies are module-private, one `RevealContext`-typed).
  A terminal `else` on the existing chain. No `.reduce()`, nested ternary or `any`; full-sentence `TransformFailure` messages; `// why:`
  locations listed in the EC. **PASS.**
- **§17 Vision:** clauses §1 / §8 / §10 / §22 / §24, a no-conflict line, an NG-1..7 line, and a determinism line naming the accepted
  D-24654 replay-hash window. **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** the baseline SHA and counts are re-recorded at commit. **PASS.**
  Contract file: `hollowEffect.types.ts` gains one appended `cardType` member, covered by D-24810.
- **§20 funding:** N/A, with the statement above. **§21 API catalog:** N/A (no endpoint, no `apps/server` library function).
  **PASS.**
