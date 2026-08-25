# WP-603 — Melter (Villain) Fight: Interactive Per-Card KO / Keep Choice

**User-Visible Surface:** `play.legendary-arena.com` — fighting the core
**Melter** villain (Masters of Evil) now **prompts the fighting player** to KO or
keep each player's revealed deck-top card, instead of silently auto-culling.
**D-24026 live-verification applies** (operator-pending: fight Melter, confirm a
KO/keep prompt appears for every player's revealed top, KO removes the card and
keep leaves it on top).

## Goal

Upgrade the core Masters-of-Evil villain **Melter**
(`core/masters-of-evil/melter`, copies 2) Fight ability from the WP-519 / D-24332
**deterministic auto-resolve** to the **faithful interactive** per-card KO/keep
choice. His printed Fight is *"Each player reveals the top card of their deck. For
each card, you choose to KO it or put it back."* Today the engine collapses that
choice to a rational cooperative chooser — it KOs only Wounds / basic S.H.I.E.L.D.
starters and keeps everything else, with **no prompt** — so when every deck top is
a real Hero the fight logs *"revealed each player's deck top; nothing worth
KO'ing"* and looks like nothing fired (Jeff, live 2p Midtown / Red Skull match,
2026-08-24; game-log line `23.2.13`). This WP parks a real pending choice: the
fighting (active) player is prompted to **KO or keep** each revealed deck top (their
own **and** every other player's), and a kept card stays face-up on top of that
player's deck. Engine pending-choice + arena-client prompt, shipped together (the
no-UX-freeze rule). **Reverses D-24332; locks D-24413.**

## Assumes

- Baseline: `origin/main` @ the WP-603 reserve (`9182654a` or later — the
  `SPEC: reserve WP-603 / EC-638 / D-24413` commit). Working tree clean.
- **WP-519 / D-24332** — the current Melter implementation: the
  `ko-cullable-each-deck-top` villain-effect primitive (position 16 in the
  `VillainEffectPrimitive` union / `VILLAIN_EFFECT_PRIMITIVES` array), its marked
  Fight line on `core/masters-of-evil/melter` in `data/cards/core.json` (marker
  rows in `inputs/villain-effect-markers.json`), the `villainEffectKoCullableEachDeckTop`
  handler, and the `isCullableDeckTopCard` predicate. **This WP keeps the primitive
  token and all marker/card-data unchanged** — it swaps the handler body from
  auto-resolve to an interactive park, and repurposes `isCullableDeckTopCard` as the
  bot/sim default-pick. No union/array/marker/`core.json`/provenance churn.
- **WP-470 / D-24282** — the interactive **scry-ko** pending choice
  (`villainEffectScryKoOwnDeck` → `PendingScryKoChoice` → `resolveScryKoChoice` →
  `pendingScryKoChoice` UIState → `PendingScryKoChoicePrompt.vue`). This is the
  **structural template** for every layer of this WP. Melter differs in exactly two
  ways: (1) it reveals **each player's** deck top, not only the fighting player's,
  and (2) the per-card decision is **KO-or-keep** (a binary action on one card), not
  pick-one-of-two. It reuses scry-ko's **snapshot** discipline (freeze the deck top,
  snapshot the revealed ext_id) — NOT ko-hero's recompute-from-live-G discipline.
- **WP-242 / D-24006** — the `ko-hero` interactive current-player KO: the second
  pending-choice precedent, the source of the **block-all guard** pattern that
  freezes every turn/stage/action seam while a choice is pending.
- **D-24284** — pending choices are **active-player-scoped**. The fighting player is
  the active player, and they make ALL of Melter's KO/keep decisions (own + every
  ally's). This is exactly the shape Jeff requested ("the option to KO the other
  players card along with the option to KO my card") and requires **no** non-active
  / turn-engine change.
- **D-24285** — the scry-ko reveal-reshuffle rule: "reveals the top card" is a
  reveal, so a player with an empty deck reshuffles their discard into the deck
  first (`reshuffleDiscardIntoDeck(zones, shuffleContext)`) before their top is
  revealed; a player with empty deck **and** empty discard is a reachable no-op (no
  reveal, no choice for that player) — never a hollow.
- **`project_pending_choice_no_ux_freeze`** (user memory) — an engine pending choice
  that blocks all moves WITHOUT a UIState projection + client prompt is a hard
  match-freeze. This WP ships all three together (state + projection + prompt) as a
  single unit, exactly as WP-470 did.
- **`reference_bot_legalmoves_moveguard_divergence`** (user memory) — the bot's
  `getLegalMoves` MUST offer a resolve-move arg the reducer accepts, and the resolve
  move MUST be in `SIMULATION_MOVE_NAMES` + the sim MOVE_MAPs, or the per-turn
  simulation loop **hangs** (asserted by `simulation.moveDispatch.drift.test.ts`).
- **`reference_uistate_filter_whitelist_drops_fields`** + ARCHITECTURE.md
  §UIState Projection Integrity — a new client-visible UIState field is a **five-step
  contract**; a field that reaches `buildUIState` but not the
  `filterUIStateForAudience` whitelist is **silently dropped**. The new
  `pendingMelterKoChoice` field must be passed through the filter field-by-field.
- **Existing constants/helpers reused, not re-declared:** `WOUND_EXT_ID`,
  `SHIELD_AGENT_EXT_ID`, `SHIELD_TROOPER_EXT_ID` (`setup/pilesInit.ts`);
  `reshuffleDiscardIntoDeck` (`moves/drawCards.logic.ts`); `moveCardFromZone`
  (`moves/zoneOps.ts`); `koCard` (`board/ko.logic.ts`); `pushLog`,
  `villainEffectTimingLabel`, `resolveCardDisplayName` (`villain/villainEffects.execute.ts`);
  `isCullableDeckTopCard` (same file, repurposed as the bot/sim default).

## Context (Read First)

Jeff reported this from a real 2p co-op Midtown Bank Robbery / Red Skull match
(diagnostics `red-skull-Midtown-Robbery-DIAGNOSTICS-2p.lagn.json`, log
`red-skull-Midtown-Robbery-LOG-2p.txt`, line `23.2.13`): fighting Melter produced
`[blocked] Fight effect: revealed each player's deck top; nothing worth KO'ing.`
and no prompt. Diagnosis: WP-519 shipped the ability as a **non-interactive
auto-resolve** (D-24332) that KOs only cullable cards; both deck tops were real
Heroes, so it correctly kept them and did nothing visible. The mechanic fired — it
simply gave the player no agency. Jeff wants the faithful printed behavior: a
per-card KO/keep prompt over **every** player's revealed deck top, with kept cards
returned to the top of their owner's deck.

**Why now:** the auto-resolve was the operator-selected fidelity level at WP-519
drafting (2026-08-10), chosen because the keep-option means a real Hero is never
force-KO'd, so the WP-470 scry-ko agency bug could not arise. Jeff has now asked
for the full interactive fidelity (2026-08-24), superseding that choice.

**Split-vs-single decision:** ONE WP, cross-layer (game engine + arena-client), on
the WP-470 interactive-pending-choice shape. Interactive pending-choice WPs are
canonically single WPs even though they cross the engine→client boundary, because
the engine block-all guard, the UIState projection, and the client prompt MUST ship
together or the match hard-freezes (`project_pending_choice_no_ux_freeze`; the
WP-470 precedent shipped all three in one WP). Splitting by layer would land a
match-freezing half-state on `main`. So the layer crossing is intrinsic to the
feature and does not trigger a split.

**Primitive-reuse decision:** the `ko-cullable-each-deck-top` primitive token, its
two marker rows, and the regenerated `data/cards/core.json` are **kept unchanged**.
Only the handler body changes (auto-resolve → interactive park). Renaming the
primitive to reflect the new mechanic would add union/array-drift + marker
re-point + `core.json` regen + provenance churn for a naming-accuracy benefit; the
token is retained with a `// why:` note that it predates the D-24413 interactive
upgrade (D-24413 supersedes D-24332). The `isCullableDeckTopCard` predicate is
retained and repurposed as the **bot/sim default-pick** in `ai.legalMoves.ts`,
exactly as WP-470 repurposed `selectScryKoTarget` — this keeps par / replay /
bot-sim runs **byte-identical** to the WP-519 outcome (cullable → KO, else keep),
so only **live human** play gains the prompt.

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §The Move Validation
  Contract, §UIState Projection Integrity (the five-step board-visible-field
  contract), §Persistence Boundary (`G` runtime-only, pending queues never
  persisted), §Determinism.
- `.claude/rules/*.md` + `.claude/skills/legendary-game-engine/SKILL.md`.
- `docs/ai/DECISIONS.md` — D-24282 (scry-ko pending-choice upgrade), D-24006 /
  D-24007 (ko-hero interactive), D-24284 (active-player-scoped choices), D-24285
  (reveal-reshuffle), D-24332 (the auto-resolve this WP reverses), D-24011 (pending
  choices redacted to the chooser in the audience filter).
- **The template WPs** — `docs/ai/work-packets/WP-470-*.md` (interactive scry-ko;
  the closest end-to-end shape) and `WP-242-*.md` (ko-hero interactive + block-all
  guard). `WP-519-melter-fight-ko-cullable-deck-top.md` (the auto-resolve this
  reverses).
- Source seams (from the drafting-session pipeline map; verify at execution):
  - State: `packages/game-engine/src/types.ts` (`PendingScryKoChoice` ~524-531,
    `pendingScryKoChoices?` ~1093 — the shape to mirror).
  - Park: `villain/villainEffects.execute.ts` (`villainEffectScryKoOwnDeck`
    ~1114-1182 template; `villainEffectKoCullableEachDeckTop` ~1930-2000 the handler
    to rewrite; `VILLAIN_EFFECT_HANDLERS` ~2899; `isCullableDeckTopCard` ~1905).
  - Resolve: `moves/scryKoChoice.resolve.ts` (template) → new
    `moves/melterKoChoice.resolve.ts`; registration `game.ts` ~455-460; block-all
    guards — the scry-ko predicate `hasPendingScryKoChoice` sits at
    `game.ts:118` (advanceStage — single site), `moves/coreMoves.impl.ts` 80/270/409
    (drawCards/playCard/endTurn — the endTurn guard lives HERE, not in `game.ts`),
    `fightVillain.ts:151`, `fightMastermind.ts:97`, `recruitHero.ts:101`,
    `healWounds.ts:79`, `dodgeCard.ts:83`, `playFromUndercover.ts:83`, **and
    `villainDeck/villainDeck.reveal.ts:113`** (`revealVillainCard`).
  - legalMoves/sim: `simulation/ai.legalMoves.ts` (`SIMULATION_MOVE_NAMES` ~71;
    scry-ko short-circuit ~388 — place the Melter short-circuit **beside** it, same
    precedence tier) + the two sim MOVE_MAP dispatch tables
    `simulation/simulation.runner.ts` + `simulation/par.aggregator.ts` (both pinned
    by `simulation.moveDispatch.drift.test.ts`).
  - UIState: `ui/uiState.types.ts` (`UIPendingScryKoChoice` ~771-775),
    `ui/uiState.build.ts` (block 13b.2 ~962-988, spread ~1557),
    `ui/uiState.filter.ts` (scry-ko pass-through ~555-572).
  - Client: `apps/arena-client/src/components/play/PendingScryKoChoicePrompt.vue`
    (template) → new `PendingMelterKoChoicePrompt.vue`; wiring in
    `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`, `composables/useTurnActions.ts`.

## Scope (In)

- **Rewrite** `villainEffectKoCullableEachDeckTop` (`villain/villainEffects.execute.ts`)
  from auto-resolve to an **interactive park**: iterate every player in
  `Object.keys(G.playerZones).sort()` (D-18902), reshuffle each empty deck first
  (D-24285), snapshot each non-empty deck top as `{ ownerPlayerID, cardId }`, and if
  at least one top was revealed, park **one** `PendingMelterKoChoice` for the
  fighting player carrying the snapshot list; KO nothing at park time. A revealed
  count of zero (all decks exhausted) is a reachable no-op (self-narrated, no park).
  Self-narrate the park via `pushLog`. Return `{ targets: [], pending: true }`.
- **New pending state** in `packages/game-engine/src/types.ts`:
  `PendingMelterKoChoice { choiceType: 'melter-ko', playerID: string, revealedTops:
  readonly { ownerPlayerID: string; cardId: CardExtId }[] }` + the FIFO queue field
  `pendingMelterKoChoices?: PendingMelterKoChoice[]` on `LegendaryGameState`,
  lazily initialized at the park site, runtime-only (never persisted).
- **New resolve move** `moves/melterKoChoice.resolve.ts`: `resolveMelterKoChoice`
  (payload `{ cardId: CardExtId; keep: boolean }`) + predicate
  `hasPendingMelterKoChoice(G)`. Front-entry-only; `cardId` must be in the front
  entry's `revealedTops`; `keep === false` KOs the card from its **owner's** deck
  top (`moveCardFromZone(ownerZones.deck, [], cardId)` → `G.ko = koCard(...)`);
  `keep === true` is a no-op (the card was never removed — it stays face-up on
  top). Either action removes that `{ownerPlayerID, cardId}` from `revealedTops`;
  when the list empties, `queue.shift()`. Silent no-op on every invalid state
  (moves never throw).
- **Block-all guard wiring**: register `resolveMelterKoChoice` in `game.ts` `moves`
  (long-form `{ move, client: false }`, NOT in `CORE_MOVE_NAMES`), and add
  `hasPendingMelterKoChoice(G)` to **every** turn/stage/action guard site the scry-ko
  predicate already guards. The authoritative site list is `grep -rn
  "hasPendingScryKoChoice" packages/game-engine/src` (non-test reducer guards):
  `game.ts` advanceStage (**single** site — it also freezes the cleanup→endTurn
  auto-transition; there is no separate `game.ts` endTurn guard);
  `coreMoves.impl.ts` drawCards / playCard / endTurn; `fightVillain`,
  `fightMastermind`, `recruitHero`, `healWounds`, `dodgeCard`, `playFromUndercover`;
  **and `villainDeck/villainDeck.reveal.ts`** (the next-reveal site — practically
  unreachable for Melter since a parked choice already blocks `advanceStage`, but
  guarded for parity so the "every site or none" invariant holds). The
  `ai.legalMoves.ts` scry-ko site is the sim short-circuit, covered below.
- **Simulation/bot enumeration**: add `resolveMelterKoChoice` to
  `SIMULATION_MOVE_NAMES` and the sim MOVE_MAPs; add a `getLegalMoves` short-circuit
  that, when `hasPendingMelterKoChoice`, returns a length-exactly-1 list resolving
  the front entry's next revealed card with the deterministic bot default
  `{ cardId, keep: !isCullableDeckTopCard(cardId) }` (KO cullable, keep the rest) —
  the WP-519 auto-resolve outcome, preserved byte-identically for bot/sim/replay.
- **UIState** (five-step field contract): add `UIPendingMelterKoChoice` +
  `pendingMelterKoChoice?` to `ui/uiState.types.ts`; build it from the **front**
  entry in `ui/uiState.build.ts` (each `revealedTops` entry resolved to
  `{ ownerPlayerID, cardId, display }`); pass it through `ui/uiState.filter.ts`
  **field-by-field**, redacted to the chooser only (`audience.kind === 'player' &&
  audience.playerId === choice.playerID`, per D-24011); update the
  `uiState.types.drift` test.
- **Client prompt** `apps/arena-client/src/components/play/PendingMelterKoChoicePrompt.vue`
  (mirror `PendingScryKoChoicePrompt.vue`, but **two** actions per revealed card —
  "KO" and "Keep" — labelled by owner) + its wiring into `pages/PlayDesktop.vue`,
  `pages/PlayMobile.vue` (import / register / computed / template), and the
  `composables/useTurnActions.ts` client-side endTurn gate.
- **Tests** cloned per layer (see §Files) — including a **new**
  `PendingMelterKoChoicePrompt.test.ts` (the scry-ko prompt has no component test;
  this WP closes that gap for the Melter prompt).
- **ewiki refresh:** `wiki/card-effect-system.md` — update the Melter /
  `ko-cullable-each-deck-top` note from "auto-resolve" to the interactive KO/keep
  choice.

## Scope (Out)

- **No primitive rename, no marker/card-data change.** The
  `ko-cullable-each-deck-top` token, `inputs/villain-effect-markers.json` rows, and
  `data/cards/core.json` are untouched; the `VillainEffectPrimitive` union / array
  count stays 16; no `mechanic-provenance.json` row (net-new primitive rule does not
  apply — the primitive already exists).
- **No change to any other villain effect**, to the auto-resolve behavior of any
  other primitive, or to the scry-ko / ko-hero choices.
- **No non-active-player interaction.** The fighting player makes every decision
  (D-24284). Other players never receive a Melter prompt.
- **No scoring / PAR / leaderboard change**, no new UIState field beyond
  `pendingMelterKoChoice`, no contract file (`.types.ts`/`.validate.ts`/`.gating.ts`)
  — `types.ts` and `uiState.types.ts` are shared type modules, not locked contract
  files.
- **No return-to-deck mutation.** "Put it back" is a no-op because the reveal never
  removes the card from the deck (scry-ko snapshot discipline); the block-all guard
  freezes every deck top so the snapshot cannot drift.

## Files Expected to Change

**Engine (`packages/game-engine/src`):**
- `types.ts` — `PendingMelterKoChoice` + `pendingMelterKoChoices?` on G
- `villain/villainEffects.execute.ts` — rewrite `villainEffectKoCullableEachDeckTop`
  (auto-resolve → interactive park); `isCullableDeckTopCard` retained (now unused by
  the handler; used by `ai.legalMoves`)
- `moves/melterKoChoice.resolve.ts` — **new**: `resolveMelterKoChoice` +
  `hasPendingMelterKoChoice`
- `game.ts` — import + register the move; add the guard to advanceStage (single
  site — it also freezes the cleanup→endTurn transition; the endTurn guard itself
  lives in `coreMoves.impl.ts` below)
- `moves/coreMoves.impl.ts` — add the guard (drawCards / playCard / endTurn sites)
- `moves/fightVillain.ts`, `moves/fightMastermind.ts`, `moves/recruitHero.ts`,
  `moves/healWounds.ts`, `moves/dodgeCard.ts`, `moves/playFromUndercover.ts` — add
  the guard
- `villainDeck/villainDeck.reveal.ts` — add the guard (the eleventh
  `hasPendingScryKoChoice` site; parity)
- `simulation/ai.legalMoves.ts` — `SIMULATION_MOVE_NAMES` + short-circuit default
- `simulation/simulation.runner.ts` + `simulation/par.aggregator.ts` — register
  `resolveMelterKoChoice` in each `MOVE_MAP` (the two dispatch tables pinned by the
  moveDispatch drift test)
- `ui/uiState.types.ts` — `UIPendingMelterKoChoice` + `pendingMelterKoChoice?`
- `ui/uiState.build.ts` — projection block + conditional spread
- `ui/uiState.filter.ts` — field-by-field chooser-only pass-through
- Tests: `villain/villainEffects.execute.test.ts`, `moves/melterKoChoice.resolve.test.ts`
  (**new**), `simulation/simulation.moveDispatch.drift.test.ts`,
  `simulation/ai.legalMoves.test.ts`, `ui/uiState.build.test.ts`,
  `ui/uiState.filter.test.ts`, `ui/uiState.types.drift.test.ts`, and the block-all
  guard fixtures (`fightVillain.test.ts` etc.)

**Client (`apps/arena-client/src`):**
- `components/play/PendingMelterKoChoicePrompt.vue` — **new**
- `components/play/PendingMelterKoChoicePrompt.test.ts` — **new**
- `pages/PlayDesktop.vue` + `pages/PlayDesktop.test.ts`
- `pages/PlayMobile.vue` + `pages/PlayMobile.test.ts`
- `composables/useTurnActions.ts` (+ its test if the endTurn-gate suite asserts it)

**ewiki:** `wiki/card-effect-system.md`

**Governance:** `docs/ai/DECISIONS.md` (D-24413, landed at execution),
`docs/ai/NUMBER-LEDGER.md` (reserved), `docs/ai/STATUS.md`, `WORK_INDEX.md`,
`EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The mechanic (D-24413, supersedes D-24332).** On Melter's `onFight`, reveal
  every player's deck top (sorted iteration; empty deck reshuffles discard first per
  D-24285), snapshot each revealed `{ ownerPlayerID, cardId }`, and park **one**
  `PendingMelterKoChoice` for the **fighting (active) player** carrying the snapshot
  list. No card is KO'd at park time. Zero revealed cards → reachable no-op (no
  park). The choice is active-player-scoped (D-24284).
- **Resolve.** `resolveMelterKoChoice({ cardId, keep })` acts on the **front** queue
  entry only. `cardId` must be a member of the entry's `revealedTops` (round-trip
  rule, mirrors scry-ko). `keep === false` → KO the card from **its owner's** deck
  top (`moveCardFromZone(ownerZones.deck, [], cardId)` then `G.ko = koCard(G.ko,
  cardId)`); `keep === true` → no mutation (the card stays on top). Either action
  removes the entry from `revealedTops`; an emptied list shifts the queue. Invalid
  state → silent no-op, queue byte-identical (moves never throw).
- **Block-all freeze.** While `hasPendingMelterKoChoice(G)`, every turn-stage
  advance, endTurn, and action move returns early (the ko-hero / scry-ko guard
  pattern) so no deck top can change and the snapshot cannot drift.
- **Bot/sim determinism.** The `getLegalMoves` short-circuit resolves the front
  entry's next revealed card with `{ cardId, keep: !isCullableDeckTopCard(cardId) }`
  — cullable cards KO'd, all else kept — reproducing the WP-519 auto-resolve outcome
  **byte-identically** for bot / simulation / replay. Only live human play differs
  (a real prompt). `resolveMelterKoChoice` MUST be in `SIMULATION_MOVE_NAMES` + the
  sim MOVE_MAPs or the per-turn loop hangs.
- **UIState.** `pendingMelterKoChoice` follows the five-step board-visible-field
  contract: declared in `uiState.types.ts`, built in `uiState.build.ts` from the
  front entry, **passed through `uiState.filter.ts` field-by-field, redacted to the
  chooser only** (D-24011), asserted by the filter test + the types-drift test.
- **Persistence / determinism.** `pendingMelterKoChoices` is a runtime-only pending
  queue (never persisted; snapshots stay counts-only). Randomness only via the
  seeded reshuffle (`reshuffleDiscardIntoDeck` → `shuffleContext.random.Shuffle`); no
  `Math.random()`. **Hashed-oracle posture:** the auto-resolve→park change alters the
  move-log for any fixture that FIGHTS Melter (park + resolve moves replace the inline
  auto-KO). No committed hashed oracle (`finalStateHash` via `record-game-fixture.mjs`;
  `PRE_WP080_HASH` in `replay.execute.test.ts`; the sentinel replay fixture) fights or
  includes Masters-of-Evil / Melter (verified at draft — a repo grep for
  `masters-of-evil` / `melter` under `packages/game-engine/src` fixture/hash paths
  returned empty). **Re-verify at execution**; if any hashed oracle fights Melter,
  re-record via the canonical tool (never hand-edit) and note the re-pin in D-24413.
  A **new optional G field** (`pendingMelterKoChoices`) does not shift the initial-`G`
  hash while absent; confirm the `hashGameState` / `computeStateHash` exclusion posture
  is unaffected (pending queues follow the scry-ko field's existing treatment).

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (faithful card-data / content semantics:
  giving a printed villain ability its real player agency).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed (no monetization, no
  pay-to-win; a villain-effect agency upgrade).
- **Determinism preservation** — deterministic and replay-faithful: bot/sim path
  reproduces the WP-519 outcome byte-identically; randomness only via the seeded
  reshuffle; re-pin posture stated in §Contract (verify at execution; re-record via
  the canonical tool if a hashed oracle shifts).

## Acceptance Criteria

1. Fighting `core/masters-of-evil/melter` with a **human** fighting player parks a
   `PendingMelterKoChoice` listing every player's revealed deck top and KOs nothing
   until the player resolves; the arena-client renders a per-card KO / Keep prompt
   (owner-labelled) for the fighting player only — no `no-handler` hollow, no freeze.
2. `resolveMelterKoChoice({ cardId, keep: false })` removes that card from its
   owner's deck top to `G.ko`; `{ keep: true }` leaves it on top. Resolving the last
   revealed card clears the pending entry and the block-all freeze lifts.
3. A player whose deck is empty has their discard reshuffled first, then their top
   revealed; a player with empty deck **and** empty discard contributes no revealed
   card; all decks exhausted → reachable no-op (no park, no crash, no hollow).
4. While the choice is pending, every action move + endTurn + stage advance is
   blocked (the block-all guard fires at all wired sites); the sim/bot loop resolves
   it deterministically (`keep = !isCullableDeckTopCard(cardId)`) and does **not**
   hang (`simulation.moveDispatch.drift` green).
5. `pendingMelterKoChoice` survives `filterUIStateForAudience` for the chooser and is
   redacted for every other audience (filter test + types-drift test green).
6. Bot / simulation / replay outcome is byte-identical to the WP-519 auto-resolve
   (cullable KO'd, real cards kept); hashed oracles verified unchanged (or re-recorded
   via the canonical tool with the re-pin noted in D-24413).
7. `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test` and
   `pnpm --filter @legendary-arena/arena-client test` green; `vue-tsc` clean; the
   ewiki gate green after the `card-effect-system.md` edit.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (new resolve move +
   handler park + reshuffle-on-empty + block-all guard fixtures + legalMoves default
   + UIState build/filter/drift + moveDispatch drift).
3. `pnpm --filter @legendary-arena/arena-client test` → pass (new
   `PendingMelterKoChoicePrompt.test.ts` + PlayDesktop/PlayMobile integration) and
   `vue-tsc` clean.
4. `pnpm check:wiki && pnpm check-links` (or the repo's ewiki gates) → 0.
5. `pnpm roadmap:counts:check` → 0.
6. Live-verify (D-24026, operator, post-deploy): fight Melter in a 2p match; confirm
   a KO/Keep prompt lists both players' revealed tops, KO removes a card to the KO
   pile, Keep leaves it on top, and the log records each decision.

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-638:` impl + `SPEC:` govern-close): D-24413 landed
  Active AND **D-24332's DECISIONS.md entry flipped to `Superseded by D-24413`**
  (both rows move — a clean supersession, so no future reader sees two live Melter
  decisions); STATUS updated; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap
  `📝`→`✅` + `pnpm roadmap:counts:write`.
- `git diff --name-only` matches the §Files allowlist (`01.5` runtime-wiring
  exceptions — `game.ts` move registration + the ~8 guard-site files + the two Play
  pages — are named in the EC).
- `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify
  operator-pending on deploy.

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only; Node v22+; `node:`-prefixed built-ins.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — full-word names,
  functions ≤ 30 lines with JSDoc, `if/else` over nested ternaries, `for...of` over
  branching `.reduce()`, `// why:` on non-obvious decisions.
- Determinism: no `Math.random()` / `Date.now()` / wall-clock / I/O in engine code;
  randomness only via the seeded `shuffleContext` reshuffle.
- Moves never throw; only `Game.setup()` may throw. The resolve move silent-no-ops
  on every invalid state.

**Packet-specific:**
- Reuse the `ko-cullable-each-deck-top` primitive + all marker/card-data unchanged;
  do NOT touch the union/array/`core.json`/provenance.
- Snapshot discipline (freeze the deck top; do not remove at park) — "keep" is a
  no-op; do NOT add a return-to-deck mutation.
- The block-all guard predicate goes at EVERY site the scry-ko / ko-hero predicates
  already guard — a missed site leaves a deck top mutable mid-choice.
- `resolveMelterKoChoice` in `SIMULATION_MOVE_NAMES` + sim MOVE_MAPs (or the loop
  hangs); the bot default reproduces the WP-519 outcome.
- `pendingMelterKoChoice` passes the UIState audience filter field-by-field,
  chooser-only; verify it appears in Play Diagnostics `uiStateSnapshot`.
- Pending queue is runtime-only — never persisted; snapshots stay counts-only.

**Session protocol:** if any locked value here conflicts with the code on `main` at
execution time, STOP and reconcile against ARCHITECTURE.md before proceeding — do
not guess. In particular, re-verify the 11 block-all guard sites and the sim
MOVE_MAP location against the live tree (the drafting-session line anchors are
approximate).

**Locked contract values:** see `## Contract` and `EC-638` Locked Values.

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):

- **§1 Structure / §2 Constraints** — PASS (all sections present; constraints
  reference `00.6`; forbid partial output).
- **§3 Assumes** — PASS (WP-519 current impl, WP-470 scry-ko template, WP-242
  block-all guard, D-24284/D-24285/D-24011, no-UX-freeze + bot-divergence +
  filter-whitelist memories, reused constants enumerated).
- **§4 Context (Read First)** — PASS (live-match provenance, why-now, split-vs-single
  + primitive-reuse rationale, ARCHITECTURE sections, DECISIONS scan, template WPs,
  source seams with approximate anchors flagged for execution verification).
- **§5 Files** — PASS (each marked new/modified; cross-layer engine + client, the
  intrinsic pending-choice shape; `01.5` wiring files named).
- **§6 Naming** — PASS (`ext_id`, canonical field/primitive names; `PendingMelterKoChoice`
  / `pendingMelterKoChoice` mirror the scry-ko naming; reused `WOUND_EXT_ID` /
  `SHIELD_*_EXT_ID` / `isCullableDeckTopCard`).
- **§7 Dependencies** — PASS (no new dep).
- **§8 Architecture** — PASS (engine owns the choice; client consumes a read-only
  projection; UIState five-step field contract enforced; no layer crossing beyond the
  sanctioned engine→client projection).
- **§9 Windows / §10 Env** — N/A (no new shell scripts; no new env var).
- **§11 Auth** — N/A (no auth surface; the resolve move is a normal in-match move).
- **§12 Test Quality** — PASS (`node:test`; per-layer tests incl. the new resolve
  move + the new client component test filling the scry-ko gap; no
  `boardgame.io/testing`).
- **§13 Verification** — PASS (exact `pnpm` commands + expected exits).
- **§14 Acceptance** — PASS (7 binary, observable, file/function-specific items).
- **§15 / §15.1 Definition of Done** — PASS (STATUS/DECISIONS/WORK_INDEX +
  scope-boundary; `**User-Visible Surface:**` + `## User-Visible Impact` via §Goal /
  §Context; live-on-surface D-24026 item present).
- **§16 Code Style** — PASS (models the scry-ko pending-choice pipeline without
  over-sharing; explicit `for...of`; full-word names; small functions + JSDoc; `//
  why:` on the snapshot discipline, keep-no-op, bot-default, reveal-reshuffle,
  primitive-reuse, and block-all-guard decisions).
- **§17 Vision Alignment** — PASS (present; §1/§2/§10; no conflict; NG clear;
  determinism line — bot/sim byte-identical, seeded reshuffle only).
- **§18 Prose-vs-Grep** — PASS (no literal-string-scoped forbidden-token grep in
  Verification Steps).
- **§19 Bridge staleness** — N/A.
- **§20 Funding Surface** — N/A: gameplay-mechanic WP, no funding/donate copy.
- **§21 API Catalog** — N/A: no HTTP endpoint; no `apps/server/src/**` library
  function touched (the resolve move is an in-engine boardgame.io move, not an API
  endpoint).
- Reverses **D-24332**; reserves **D-24413** (the interactive Melter KO/keep
  contract).
