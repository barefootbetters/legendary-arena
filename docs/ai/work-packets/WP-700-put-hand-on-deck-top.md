# WP-700 — Put-hand-on-deck-top: draw-then-stack hero keyword (Cross-layer — Game Engine + Arena Client)

**Status:** Draft 2026-09-15 (EC-737; D-24519 reserved)
**Layer:** Game Engine (parse + runtime + pending choice + UIState) + Arena Client (choice UI)
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** D-24492 (Smash pending-choice queue + `SmashDiscardPrompt.vue` — the mandatory-hand-pick + magnitude-carrying park model) ✅, D-24184/D-24185 (discard-to-play hand-eligibility helper + mandatory `PendingDiscardToPlay`) ✅, D-24069 (draw-or-empowered pending-choice + UIState framework) ✅, D-24518 (vanquish drops parked pending-choice queues — the new queue enrolls) ✅

## Goal

Implement the **put-hand-on-deck-top** hero keyword so a card printing "Draw N cards. Then
put a card from your hand on top of your deck." resolves fully. Per
`docs/legendary-universal-rules-v23.md`, the effect is a compound onPlay: the player draws
N cards, then **must** place one card from their (now larger) hand on **top** of their own
deck. After this WP, playing Gambit's **Stack the Deck** (core / co2e, draw 2), Brainstorm's
**Time Loop Experiments** (anni, draw 1), and the identical-text cards in `dstr` / `wpnx` /
`wtif` draws the cards and then presents an interactive "choose a card from your hand to put
on top of your deck" prompt, instead of silently doing nothing.

## User-Visible Impact

`play.legendary-arena.com` — playing one of these cards draws the printed number of cards
and then presents a mandatory "put a card from your hand on top of your deck" prompt; the
chosen card is placed on top of the acting player's deck (drawn first next turn). Purely a
fidelity fix: a printed ability that today is an honest hollow (no marker, silently dropped)
begins to resolve. It reuses the shipped pending-choice UI framework — `DiscardToPlayPrompt.vue`
is the closest structural model (a MANDATORY hand pick with no Decline button); Smash
(`SmashDiscardPrompt.vue`) is the model only for the queue/magnitude-park shape, NOT the resolve
arm (Smash is optional). Live-on-surface is operator-pending (D-24026).

## Assumes

- **`packages/game-engine/src/hero/heroEffects.execute.ts`** exports `HANDLED_KEYWORDS`,
  `NO_MAGNITUDE_KEYWORDS`, `HERO_EFFECT_HANDLERS`, and the `heroEffectSmash` /
  `heroEffectRevealHeroDeckAttack` handlers (the structural model for a magnitude-carrying
  park handler that owns its full compound line). The `executeSingleEffect` magnitude
  pre-gate requires a valid magnitude for any keyword not in `NO_MAGNITUDE_KEYWORDS`; the
  handler's draw uses the same deterministic draw helper the `draw` keyword uses.
- **`packages/game-engine/src/rules/heroKeywords.ts`** exports the `HeroKeyword` union and
  the `HERO_KEYWORDS` canonical array (kept in lockstep; a RUNTIME drift pin asserts the
  length — D-24372).
- **`packages/game-engine/src/types.ts`** carries the `pending*` queue fields on
  `LegendaryGameState`; the new `pendingPutHandOnDeckTop?` queue is added in the same block.
- **`packages/game-engine/src/moves/smashDiscard.resolve.ts`** (mandatory-arm shape) and
  **`resolveDiscardToPlay.ts`** / `getEligibleDiscardToPlayCards` are the models for the new
  resolve move + `has*` predicate + reading/removing a chosen hand card. The
  hand→deck-top placement uses the `zoneOps` helper family.
- **`packages/game-engine/src/game.ts`** holds the block-all turn guards and the moves map.
- **`packages/game-engine/src/ui/uiState.{build,filter,types}.ts`** + `index.ts` are the
  UIState projection surface (the five-step Board-Visible Field contract, per
  `.claude/rules/architecture.md §UIState Projection Integrity`).
- **`apps/arena-client/src/components/play/DiscardToPlayPrompt.vue`** (MANDATORY, no Decline
  button) is the shipped client model for the resolve arm; `SmashDiscardPrompt.vue` is the model
  for the queue/magnitude park only. Their `PlayDesktop.vue` / `PlayMobile.vue` /
  `TurnActionBar.vue` / `useTurnActions.ts` / `uiMoveName.types.ts` /
  `diagnostics/effectProvenance.ts` wiring is the shipped cross-layer pending-choice client set.
- **The vanquish-drop set (D-24518)** — the function that drops parked pending-choice queues
  when a mastermind is vanquished — MUST gain the new queue.
- **`data/cards/{core,co2e,anni,dstr,wpnx,wtif}.json` are GENERATED.** The markers are
  authored in the marker SOURCE (`scripts/convert-cards/inputs/hero-ability-markers.json`,
  applied by `apply-hero-ability-markers.mjs`) and the files are reproduced by regen — never
  hand-edited (CLAUDE.md §Card Data).
- Baseline: `origin/main` at the D-24519 reserve (`claude/wp700-put-hand-on-deck-top`).

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` — the "put a card from your hand on top of your
  deck" primitive (a mandatory placement, player chooses which card).
- `scripts/convert-cards/inputs/hero-ability-markers.json` — the deferred entry for
  Brainstorm's Time Loop Experiments (`anni`, D-22501: "compound multi-effect line …
  compound-executor territory") is the mechanic this WP resolves; Gambit's Stack the Deck was
  hollow and untracked. Both flip to handled.
- `docs/ai/DECISIONS.md` — scan D-24492 (Smash mandatory-hand-pick + magnitude park + client
  prompt), D-24184/D-24185 (discard-to-play mandatory hand cost + eligibility helper), D-24069
  (draw-or-empowered pending-choice + UIState framework), D-24518 (vanquish drops parked
  choices), D-24372 (drift pins are RUNTIME assertions).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) and §Architectural Principles
  #2 (UI consumes read-only projections); `.claude/rules/architecture.md §UIState Projection
  Integrity` — the five-step Board-Visible Field contract.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical field names (`ext_id` /
  `CardExtId`, zone names) for the pending-choice and move payloads.
- ewiki [Play Board](../../wiki/play-board.md) — zone→field map + projection pipeline.

## Scope (In)

- **Keyword registration:** add `'put-hand-on-deck-top'` to the `HeroKeyword` union and
  `HERO_KEYWORDS` array in lockstep (`heroKeywords.ts`); bump the RUNTIME length drift pin;
  add to `HANDLED_KEYWORDS` and the `HERO_EFFECT_HANDLERS` map (`heroEffects.execute.ts`);
  bump the handler-count pin. The keyword carries a magnitude (the **draw count**), so it is
  **NOT** added to `NO_MAGNITUDE_KEYWORDS` (its magnitude flows through the
  `executeSingleEffect` magnitude gate).
- **Compound park handler:** `heroEffectPutHandOnDeckTop` — an onPlay handler that (1) draws
  `magnitude` cards for the acting player via the shared deterministic draw helper, then (2)
  parks a single MANDATORY `PendingPutHandOnDeckTop { playerID }` onto the new FIFO
  `G.pendingPutHandOnDeckTop` queue. A defensive empty-hand no-op (hand empty after the draw
  — degenerate) logs and parks nothing.
- **Pending-choice type + queue:** `PendingPutHandOnDeckTop` interface +
  `pendingPutHandOnDeckTop?: PendingPutHandOnDeckTop[]` on `LegendaryGameState` (`types.ts`),
  in the existing `pending*` block.
- **Resolve move:** new `moves/putHandOnDeckTop.resolve.ts` exporting `resolvePutHandOnDeckTop`
  + the `hasPendingPutHandOnDeckTop(G)` predicate. Arm `{ cardId }`: validate `cardId` is in
  the active player's hand, move it to the **top (index 0)** of that player's deck via the
  `zoneOps` deck-top helper, pop the front queue entry. **Mandatory — no decline arm.** Illegal
  (silent `void`) until a `PendingPutHandOnDeckTop` is parked for the active player, or when
  `cardId` is not in hand. Registered in `game.ts` as a server-only move (`client: false`).
- **Block-all guard:** `hasPendingPutHandOnDeckTop(G)` added to every action-move block-all
  guard site (the replicated `hasPendingSmashDiscard` set — `game.ts` turn-end,
  `coreMoves.impl.ts`, `fightVillain`, `fightMastermind`, `recruitHero`, `recruitOfficer`,
  `dodgeCard`, `healWounds`, `villainDeck.reveal.ts`, and the bot short-circuit in
  `ai.legalMoves.ts` — the exact `hasPendingSmashDiscard` replication set), so no other move
  proceeds until the parked choice resolves.
- **Vanquish-drop enrollment (D-24518):** the new queue is added to the pending-choice drop
  set cleared on a true mastermind vanquish, so a vanquishing final blow does not leave the
  choice dangling on the won game.
- **UIState projection (five-step):** `UIPendingPutHandOnDeckTop` type (`uiState.types.ts`),
  built from the FRONT queue entry with the eligible hand list recomputed fresh
  (`uiState.build.ts`), passed through `filterUIStateForAudience` active-player-scoped
  (`uiState.filter.ts`), re-exported from `index.ts`; audience-filter test + Play Diagnostics
  `uiStateSnapshot` check.
- **Client prompt:** `PutHandOnDeckTopPrompt.vue` (modelled on `SmashDiscardPrompt.vue`) —
  renders for the active viewer only, lists eligible hand cards, submits
  `resolvePutHandOnDeckTop({ cardId })` (no decline — mandatory). Wired into `PlayDesktop.vue`,
  `PlayMobile.vue`, `useTurnActions.ts` (block-all tooltip), `uiMoveName.types.ts`, and
  `diagnostics/effectProvenance.ts`.
- **Bot / sim:** `ai.legalMoves.ts` short-circuit that emits `resolvePutHandOnDeckTop` using a
  deterministic `selectDefaultPutHandOnDeckTopTarget` (Locked Values), with
  `resolvePutHandOnDeckTop` added to `SIMULATION_MOVE_NAMES`. The drift-pinned invariant
  (`simulation.moveDispatch.drift.test.ts`) then requires `resolvePutHandOnDeckTop` to be a
  `MOVE_MAP` key in **both** `simulation.runner.ts` AND `par.aggregator.ts`.
- **Card data (GENERATED):** add a `put-hand-on-deck-top:N` arm to
  `apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN`; author markers replacing the seven
  "Draw N cards. Then put a card from your hand on top of your deck." lines with
  `[keyword:put-hand-on-deck-top:N]` (N = draw count: 2 for core/co2e/wpnx + one wtif line,
  1 for anni/dstr + one wtif line) in `hero-ability-markers.json`; remove the stale `anni`
  deferred entry. Regenerate `core`, `co2e`, `anni`, `dstr`, `wpnx`, `wtif`.
- **Coverage regen:** `ledger:heroes` (the keyword flips `unsupported`/`unrecognized`→
  `executable`), `effect-index`, `mechanics:metadata`, `sim:runtime-observed`; add a
  `mechanic-provenance.json` row `put-hand-on-deck-top → WP-700 / D-24519`.
- **Tests:** parser (a `put-hand-on-deck-top:N` line → a hook with magnitude N), compound
  handler (draws N then parks one entry; empty-hand degenerate no-op), resolve move (places
  named card on deck top and pops; illegal without a parked choice or with a non-hand card),
  block-all, vanquish-drop, UIState audience-filter, and the client prompt.

## Out of Scope

- **A decline arm.** The placement is mandatory (the printed text is "put a card…", not "you
  may"). The resolve move has no `{ decline }` arm — the only degenerate is an empty hand,
  handled at park time (no park), never at resolve.
- **Any other unimplemented mechanic co-printed on these cards.** Where one of the seven cards
  prints an additional still-hollow ability line (a separate `abilities[]` entry), only the
  draw-then-stack line is wired; the co-printed line stays an honest hollow (D-24464 posture).
- **Non-hero / villain "put on top of deck" effects.** This WP wires only the hero onPlay
  compound; villain deck-top manipulation (the existing `heroDeckTopToEscape` family) is
  untouched.
- **The draw-a-new-hand-timing variant.** `wpnx` Fantomex's Misdirection (`abilities[1]`:
  "When you draw a new hand this turn, draw an extra card, then put a card from your hand on
  top of your deck.") is a **different mechanic** — an end-of-turn hand-replacement trigger
  with no onPlay dispatch (the viv-vision *Expanding Neural Network* / D-22501 deferral class),
  NOT the onPlay draw-then-stack. It stays an honest hollow (recorded in the marker `_deferred`
  list with its timing reason); only its sibling `wpnx` Marrow's Osteogenesis (the onPlay form)
  is wired.
- **Generalising the pending-choice framework.** The queue, move, and prompt are keyword-
  specific, modelled on Smash; no shared abstraction is extracted (fewer than three
  consumers — code-style §16.1).

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — union + array (lockstep).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `HANDLED_KEYWORDS`
  + `HERO_EFFECT_HANDLERS` add the keyword; new `heroEffectPutHandOnDeckTop` compound handler
  + `selectDefaultPutHandOnDeckTopTarget`; NOT in `NO_MAGNITUDE_KEYWORDS`.
- `packages/game-engine/src/types.ts` — **modified** — `PendingPutHandOnDeckTop` interface +
  `pendingPutHandOnDeckTop?` queue field.
- `packages/game-engine/src/moves/putHandOnDeckTop.resolve.ts` — **new** —
  `resolvePutHandOnDeckTop` + `hasPendingPutHandOnDeckTop`.
  (No `zoneOps.ts` change — verified no deck-top placement helper exists; the established idiom
  is the inline `moveCardFromZone(hand, [], cardId)` validate-remove + `deck = [cardId, ...deck]`
  prepend, the `putCardsOnDeckChoice.resolve.ts` precedent.)
- `packages/game-engine/src/game.ts` — **modified** — import + moves-map entry (server-only)
  + block-all guard; the vanquish-drop enrollment if the drop set lives here.
- The block-all guard replication sites listed in Scope (In) — **modified**.
- The D-24518 vanquish-drop function — **modified** — add the new queue.
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIPendingPutHandOnDeckTop`.
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — build from front entry.
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — active-player pass-through.
- `packages/game-engine/src/index.ts` — **modified** — re-export the UI type.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — bot short-circuit +
  `SIMULATION_MOVE_NAMES`.
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — `MOVE_MAP` entry.
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — `MOVE_MAP` entry.
- `packages/game-engine/src/game.test.ts` — **modified** — move-registration drift pin
  (count + sorted array + `it('defines moves …')` title).
- `apps/arena-client/src/components/play/PutHandOnDeckTopPrompt.vue` — **new** — the prompt.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — import/register/render.
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — identical wiring.
- `apps/arena-client/src/components/play/TurnActionBar.vue` — **modified** — new
  `hasPendingPutHandOnDeckTop` prop + the `useTurnActions(...)` call-site arg.
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified** — append-last param + block-all gates.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — move name.
- `apps/arena-client/src/diagnostics/effectProvenance.ts` — **modified** — provenance row.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — token arm.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 7 onPlay markers
  (core/co2e gambit stack-the-deck; anni brainstorm time-loop-experiments; dstr clea
  prepare-dark-magic; wpnx marrow osteogenesis; wtif gamora tactical-insight + wtif uatu
  diverging-timestreams); remove the stale `anni` `_deferred` entry; add a `_deferred` entry
  for `wpnx` fantomex misdirection (draw-a-new-hand timing, out of scope).
- `data/cards/{core,co2e,anni,dstr,wpnx,wtif}.json` — **modified (generated)** — regenerated.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/mechanic-provenance.json` — **modified (generated / provenance row)**.
- Test files paired with each engine/client source above — **new/modified**.

> The engine + client + card-data surface is broad (~25 hand-edited files) but it is **one**
> WP, not a split: a block-all pending choice without its client prompt **freezes the game**
> ([[project_pending_choice_no_ux_freeze]]), so the engine park and the client renderer must
> ship together (the WP-676 / WP-675 pending-choice-is-one-cross-layer-WP precedent). Exact
> allowlist (with `01.5` runtime-wiring exceptions) is enumerated in the EC.

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only; Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no `Math.random()`, no wall-clock, no I/O in moves/handlers; all zone
  mutations via `zoneOps` helpers; moves never throw (validate → return `void`).
- `G` stores `CardExtId` strings only; no card objects in the pending entry.

**Packet-specific:**
- The keyword carries a magnitude (draw count) → it MUST NOT be added to
  `NO_MAGNITUDE_KEYWORDS`. The magnitude is the number of cards to draw, not an attack grant.
- The `HeroKeyword` union and `HERO_KEYWORDS` array change in lockstep; the drift pin is a
  RUNTIME assertion (D-24372), not a bare `satisfies`.
- The block-all pending choice MUST have its UIState projection AND client prompt before it
  ships (freeze prevention) — the five-step Board-Visible Field contract is binding.
- The new pending queue MUST enroll in the D-24518 vanquish-drop set.
- The placement is MANDATORY — no decline arm; the card goes to deck **top** (index 0), never
  shuffled or bottomed.
- The resolve move is server-only (`client: false`); the client submits intent, never outcome.
- Card data via marker SOURCE + reproducible regen; `cards:check` must confirm byte
  reproducibility. Never hand-edit `data/cards/*.json`.

**Session protocol:** if the draw helper cannot be invoked from within a hero-effect handler
without a layer/boundary violation, or if hook execution order would place the park before the
draw, STOP and raise it before authoring — do not silently reorder or duplicate draw logic.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- **Marker form:** `[keyword:put-hand-on-deck-top:N]`, `N` ∈ {1,2} (the printed draw count).
  The parser slug capture is letters/hyphens only (no digit), so the magnitude rides the
  `:N` colon-segment. The whole descriptive line is replaced by the single marker; the draw
  is subsumed into the handler (the Smash / reveal-herodeck precedent of a handler owning its
  full line).
- **`heroEffectPutHandOnDeckTop(G, playerID, magnitude, …)`** draws `magnitude` cards for
  `playerID` via the shared draw helper, then parks `PendingPutHandOnDeckTop { playerID }`;
  a logged no-op when the player's hand is empty after the draw.
- **`resolvePutHandOnDeckTop({ cardId })`** validates `cardId` ∈ active hand, moves it to the
  top (index 0) of that player's deck via `zoneOps`, pops the front entry. No decline arm.
  Illegal (silent `void`) until a `PendingPutHandOnDeckTop` is parked for the active player,
  or when `cardId` ∉ hand.
- **`selectDefaultPutHandOnDeckTopTarget(G, playerID)`** (bot/sim): the lowest-`cost` hand
  card (`CardExtId` ascending tie-break) — deterministic, not strategic; the
  `selectDefaultSmashDiscardTarget` convention.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity — card content semantics), §2, §10.
- **No conflict:** this WP makes a printed ability resolve exactly as the physical card reads.
- **Non-Goal proximity:** NG-1 (no pay-to-win) is not crossed — the keyword is a printed hero
  ability available to any player who drafts the card; nothing is bought.
- **Determinism preservation:** fully deterministic and replay-faithful — the draw uses
  `ctx.random.*` via the shared draw helper, the placement is the player's choice recorded as
  an ordinary move in the boardgame.io log. The new `pendingPutHandOnDeckTop?` field is
  optional and absent for any game with no parked choice, so a game that never plays one of
  these cards (including the core `finalStateHash` sentinels — none play Stack the Deck)
  serializes byte-identically → **no `finalStateHash` re-pin.** The card-data regen changes
  the affected cards' parsed abilities (intended — the fix changes behavior); Seed-PAR is
  scheme-keyed and hero-agnostic (unaffected), and no committed replay oracle plays these
  cards (verified: only `card-shark`, a different Gambit card, appears in engine fixtures).

## Funding Surface Gate

N/A — no funding surface: no global-nav / registry-viewer / profile funding affordance, no
tournament funding channel, no user-visible "donate"/"support" copy. A hero card ability only.

## API Catalog Update

N/A — no HTTP endpoints and no `apps/server/src/**` library function touched.
`resolvePutHandOnDeckTop` is a boardgame.io move (an engine surface), not an HTTP or
`Library-only` catalog surface.

## Acceptance Criteria

1. Playing a `[keyword:put-hand-on-deck-top:N]` card draws exactly N cards for the active
   player, then parks one `PendingPutHandOnDeckTop`, and the game blocks all other moves until
   it resolves.
2. `resolvePutHandOnDeckTop({ cardId })` moves the named hand card to the **top (index 0)** of
   the active player's deck and pops the entry; the card is drawn first on the next draw.
3. `resolvePutHandOnDeckTop` is rejected (silent `void`) when no `PendingPutHandOnDeckTop` is
   parked, or when `cardId` is not in the active player's hand. There is no decline arm.
4. `heroEffectPutHandOnDeckTop` on an empty post-draw hand parks nothing and logs a neutral
   no-op (no freeze) — a degenerate path that cannot arise from the seven shipped cards.
5. `UIPendingPutHandOnDeckTop` is present in the active player's UIState and absent for other
   audiences; it survives `filterUIStateForAudience` and appears in the Play Diagnostics
   `uiStateSnapshot`.
6. `PutHandOnDeckTopPrompt.vue` renders for the active viewer, lists eligible hand cards, and
   dispatches `resolvePutHandOnDeckTop`; the client never mutates the deck.
7. A mastermind vanquish that would leave a parked `PendingPutHandOnDeckTop` drops it
   (D-24518), leaving no dangling prompt on the won game.
8. `HERO_KEYWORDS` length pin and `HERO_EFFECT_HANDLERS` count pin are updated in lockstep;
   both drift tests pass as RUNTIME assertions. The `game.test.ts` move-registration pin
   includes `resolvePutHandOnDeckTop`.
9. `cards:check` confirms `core`/`co2e`/`anni`/`dstr`/`wpnx`/`wtif` regenerate byte-identically
   from the markers; the hero-mechanic ledger shows `put-hand-on-deck-top` `executable`.
10. Engine + arena-client suites green; `pnpm --filter @legendary-arena/arena-client typecheck`
    exits 0; `pnpm -r build` exits 0; `finalStateHash` sentinels byte-unchanged (no re-pin).

## Verification Steps

- `pnpm --filter @legendary-arena/game-engine build` — exits 0.
- `pnpm --filter @legendary-arena/game-engine test` — all green, including the new
  parser/handler/resolve/UIState/vanquish-drop tests and the updated drift pins.
- `pnpm --filter @legendary-arena/arena-client typecheck` — exits 0 (`vue-tsc --noEmit`).
- `pnpm --filter @legendary-arena/arena-client test` — green, including the new prompt.
- `pnpm -r build && pnpm ledger:heroes && pnpm effect-index` then `pnpm ledger:heroes:check`
  + `pnpm effect-index:check` — exit 0; the keyword row reads `executable`.
- `pnpm cards:check` — the six affected sets reproduce byte-identically from the marker source.
- `pnpm sim:runtime-observed:check` — exits 0 (artifact current).
- Confirm the engine hash-pin tests pass unchanged (no `finalStateHash` re-pin).

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client suites green; `pnpm --filter @legendary-arena/arena-client
      typecheck` exits 0; `pnpm -r build` exits 0.
- [ ] `cards:check` reproducible; `ledger:heroes` / `effect-index` / `mechanics:metadata` /
      `sim:runtime-observed` regenerated and `:check` green; `mechanic-provenance.json` row added.
- [ ] `finalStateHash` sentinels byte-unchanged (no re-pin), confirmed by a clean run.
- [ ] **Live-on-surface verification (D-24026):** a real match on play.legendary-arena.com
      plays Stack the Deck (or a sibling), the prompt appears, and the chosen card lands on top
      of the deck — with observable evidence (not tests + merge alone).
- [ ] `docs/ai/STATUS.md` updated with what changed.
- [ ] `docs/ai/DECISIONS.md` D-24519 flipped to Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph → `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified.

## Reserved Decision (lands at execution)

D-24519 — the put-hand-on-deck-top keyword as a handler-bearing `HeroKeyword` with a magnitude
that encodes the draw count; a compound onPlay handler that draws then parks a MANDATORY
hand-pick pending choice (the Smash / discard-to-play precedent); the hand card placed on top
(index 0) of the player's own deck via `zoneOps`; and the new queue's enrollment in the
D-24518 vanquish-drop set. Supersedes the D-22501 deferral for Time Loop Experiments / Stack
the Deck. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

- **§1 structure:** all required sections present; Out of Scope excludes ≥2 related things
  (a decline arm; co-printed hollows; framework generalisation). **PASS.**
- **§2 constraints:** engine-wide (full files, ESM, determinism) + packet-specific + session
  protocol + locked-value pointer; references 00.6. **PASS.**
- **§3 Assumes / §4 Context:** every dependency file + decision cited specifically; 00.2 and
  ARCHITECTURE §UIState + Layer Boundary listed. **PASS.**
- **§5 files:** every file listed with new/modified + description; the ~25 hand-edited count
  justified inline (indivisible pending-choice, WP-676 precedent). **PASS.**
- **§6 naming:** `CardExtId`, `ext_id`, zone names, `turnEconomy` per 00.2. **PASS.**
- **§7 deps:** no new npm dependency. **PASS.**
- **§8 boundaries:** engine decides / client renders; move is server-only; no upward import. **PASS.**
- **§9 Windows / §10 env:** `pnpm` commands only; no new env var. **PASS.**
- **§11 auth:** N/A — no authentication surface.
- **§12 tests:** `node:test`; no boardgame.io import in helpers; deterministic. **PASS.**
- **§13 verification / §14 acceptance / §15 DoD:** exact `pnpm` commands with expected results;
  10 binary observable criteria; DoD includes STATUS/DECISIONS/WORK_INDEX + the D-24026
  live-on-surface item. **PASS.**
- **§16 code-style:** no premature abstraction (keyword-specific); explicit control flow;
  `// why:` on the magnitude-gate exclusion, the block-all guard, and the vanquish-drop. **PASS.**
- **§17 Vision:** `## Vision Alignment` present with clause numbers (§1/§2/§10), no-conflict
  assertion, NG-1 proximity line, determinism-preservation line. **PASS.**
- **§18 prose-vs-grep:** no literal-string-scoped forbidden-token grep in verification. **PASS.**
- **§20 funding / §21 API catalog:** N/A with named justification (above). **PASS.**
