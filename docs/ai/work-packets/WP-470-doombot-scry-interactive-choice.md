# WP-470 — Interactive Doombot Scry-KO Choice (Look at Top 2, Pick One to KO)

**User-Visible Surface:** `play.legendary-arena.com` — defeating a Doombot Legion
henchman now **prompts the player** to look at the top two cards of their deck and
choose which one to KO (the other stays on top), instead of the engine auto-picking.
Jeff reported the missing agency from a live Magneto match (2026-07-30): the auto-resolve
KO'd a real "Dangerous Rescue" (log line 172) when both top cards were heroes, because
it fell back to lex-lowest.

**This is the deferred WP-447 phase-2 follow-on.** WP-447 shipped scry-ko-own-deck
**auto-resolved** (deterministic worst-first via `selectScryKoTarget`) and explicitly
deferred the interactive choice to "the exact koHeroCurrentPlayer WP-185 auto → WP-242
interactive path." This WP is that upgrade.

---

## Goal

After this session, a Doombot Legion Fight with **≥2 cards** in the defeating player's
deck **parks a pending choice** and prompts a **human** player to pick which of the top
two to KO (the other remains on top); a 1-card deck still auto-KOs (nothing to choose)
and an empty deck is a no-op. **Bots and the simulation harness resolve the choice
deterministically** via the existing `selectScryKoTarget` (byte-identical to today's
auto-resolve), so par/replay stay faithful — only live human play gets the prompt. The
pending state, its block-all guard, its UIState projection, and its client prompt all
ship **together** (a block-all pending state without its UX hard-freezes the client).

---

## Assumes

- **WP-447 / D-24267 ✅ (auto scry-ko-own-deck).** `villainEffectScryKoOwnDeck` looks at
  `min(2, deck.length)`, KOs the deterministic worst via `selectScryKoTarget`
  (Wound → starter S.H.I.E.L.D. → lex-lowest), and leaves the other on top. This WP
  changes the ≥2 branch to park a choice; the 1-card auto-KO, the no-op, and
  `selectScryKoTarget` (now the bot default) are unchanged. Source:
  `packages/game-engine/src/villain/villainEffects.execute.ts`.
- **WP-242 / D-24006/7 ✅ (interactive KO-a-Hero — the pattern to mirror).** The
  `G.pendingKoHeroChoices` FIFO queue + `PendingKoHeroChoice { choiceType, playerID }`
  + `resolveKoHeroChoice` bgio move (`client: false`) + `hasPendingKoHeroChoice`
  block-all guard (threaded through every action move + the End-Turn/advanceStage gates)
  is the exact machinery this WP parallels for `scry-ko`. Source:
  `packages/game-engine/src/moves/koHeroChoice.resolve.ts`; `game.ts`;
  `moves/coreMoves.impl.ts`; `moves/dodgeCard.ts`; `moves/fightMastermind.ts`; etc.
- **WP-243 / D-24010 + WP-249 / D-24020 ✅ (UIState pending projection + private
  filtering).** `uiState.pendingKoHeroChoice` projects the front of the queue, with a
  filtered variant visible only to the choosing player. `scry-ko` gets a parallel
  `pendingScryKoChoice`. Source: `packages/game-engine/src/ui/uiState.{build,filter,types}.ts`.
- **The interactive-KO client stack ✅.** `apps/arena-client/src/components/play/
  PendingKoHeroChoicePrompt.vue` + `useTurnActions.ts` (submits the resolve move) +
  `uiMoveName.types.ts` + the PlayViewport mount is the template for the scry prompt.
- **The bot/sim path handles pending choices.** `ai.legalMoves.ts`,
  `simulation.runner.ts`, and `par.aggregator.ts` already resolve `pendingKoHeroChoices`
  via the bot policy; `scry-ko` is added there with the `selectScryKoTarget` default so
  determinism is preserved.
- **Baseline:** `origin/main` @ `371345d5` (`git rev-parse origin/main` — the WP-469
  reveal-or-wound merge). Ledger next-free confirmed WP-470 / EC-505 / D-24282.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Rule Execution Pipeline; §Move Validation Contract (moves
  never throw; validate → mutate → void); §Determinism.
- `.claude/rules/architecture.md` (Engine owns truth; clients submit intent);
  `.claude/skills/legendary-game-engine/SKILL.md` (pending-choice discipline).
- The `project_pending_choice_no_ux_freeze` memory: a block-all pending state without a
  UIState projection + prompt hard-freezes the client. So this WP ships the engine
  pending state, the projection, AND the client prompt as one unit.
- **One WP / one EC / one PR (locked):** the scry-KO interactive is a tight vertical
  slice that *extends existing infrastructure* (the WP-242/243 queue/move/projection/
  prompt framework already exists — this adds a parallel `scry-ko` variant, it does not
  build the framework). It stays **one WP (WP-470/EC-505), one PR** — do NOT spawn a
  second WP number. If worked across two sessions, both halves land under WP-470 and the
  client half must **never** merge to a deployed branch without the engine half. This
  atomicity is deliberate: the WP-242/243 co-release split *failed* (the UX shipped, the
  engine never did, and the auto-pick bug persisted — WORK_INDEX "⚠ Status correction");
  one atomic WP structurally eliminates that gap and serves `project_pending_choice_no_ux_freeze`.

---

## Scope (In)

**Engine (`packages/game-engine`):**
- New runtime field `G.pendingScryKoChoices?: PendingScryKoChoice[]` (FIFO queue) +
  `interface PendingScryKoChoice { choiceType: 'scry-ko'; playerID: string;
  revealedCardIds: CardExtId[] }` (the top `min(2, deck.length)` ext_ids). Runtime-only,
  never persisted (mirrors `pendingKoHeroChoices`).
- Change `villainEffectScryKoOwnDeck`: `deck.length === 0` → no-op; `=== 1` → auto-KO
  (unchanged, no choice); `>= 2` → push a `PendingScryKoChoice` with the top 2 ext_ids,
  KO nothing yet, self-narrate "look at the top two…". `selectScryKoTarget` is untouched
  (now the bot/sim default).
- New move `resolveScryKoChoice({ G, playerID }, { cardId })` in a new
  `moves/scryKoChoice.resolve.ts` + `hasPendingScryKoChoice(G)` predicate; register in
  `game.ts` as `{ move: resolveScryKoChoice, client: false }`. Validate front
  (playerID + choiceType + `cardId ∈ front.revealedCardIds`), KO `cardId` from the deck
  (leaving the other on top), front-pop, narrate; all invalid states silent no-ops with
  the queue intact (resubmit).
- Thread `hasPendingScryKoChoice` into **every** action-move block-all guard that
  already checks `hasPendingKoHeroChoice`. The **complete** current set (grep-parity
  target — the set of files matching `hasPendingScryKoChoice(` MUST equal the set
  matching `hasPendingKoHeroChoice(` after the change): `game.ts` (end-turn/advanceStage),
  `moves/coreMoves.impl.ts` (3 sites), `moves/dodgeCard.ts`, `moves/fightMastermind.ts`,
  **`moves/fightVillain.ts`** (the Doombot trigger path itself), **`moves/recruitHero.ts`**,
  **`moves/healWounds.ts`**, **`moves/playFromUndercover.ts`**,
  **`villainDeck/villainDeck.reveal.ts`**, and the sim `simulation/ai.legalMoves.ts`
  short-circuit. AC-4 requires **recruit and fight** blocked, so `recruitHero.ts` +
  `fightVillain.ts` are non-optional.
- `uiState.{types,build,filter}.ts`: add `pendingScryKoChoice?: UIPendingScryKoChoice`
  (front-of-queue: `{ playerID, revealedCards: UICard[] }`) + the WP-249/D-24020
  filtered private variant (revealed cards visible only to `playerID`).
- Bot/sim: `ai.legalMoves.ts` offers `resolveScryKoChoice` with the `selectScryKoTarget`
  default pick — **`selectScryKoTarget` is currently module-private and must be
  `export`ed** (intra-package, layer-clean) so `ai.legalMoves.ts` can import it. Add
  `resolveScryKoChoice` to `SIMULATION_MOVE_NAMES` (`simulation/ai.types.ts`) **and both
  `MOVE_MAP`s** (`simulation.runner.ts` + `par.aggregator.ts`) so the sim per-turn loop
  dispatches it — **omitting this HANGS the sim** (infinite within-turn loop;
  `sim:runtime-observed:check` never returns); `simulation.moveDispatch.drift.test.ts`
  asserts membership.
- **Publish the new UIState type from the engine barrel:** add `UIPendingScryKoChoice`
  to `packages/game-engine/src/index.ts` (next to `UIPendingKoHeroChoice`), or the
  client `import type` fails `vue-tsc` (the D-16502/WP-166 barrel-publish trap).

**Client (`apps/arena-client`):**
- `components/play/PendingScryKoChoicePrompt.vue` — mirrors `PendingKoHeroChoicePrompt.vue`:
  shows the ≤2 revealed cards, click one to KO (submits `resolveScryKoChoice`). Mounted
  in **BOTH** `pages/PlayDesktop.vue` **and** `pages/PlayMobile.vue` (where the KO-hero
  prompt mounts — NOT `PlayViewport.vue`, which is only the desktop/mobile discriminator).
- `composables/useTurnActions.ts` + `components/play/uiMoveName.types.ts` — the
  `resolveScryKoChoice` move name + submit wiring.

## Scope (Out)

- **Any change to `selectScryKoTarget`** (the bot default = today's auto-resolve, byte-
  identical) or to the 0/1-card branches.
- **Reordering the two revealed cards, or a "put either back" swap** — the printed text
  keeps them on top in their existing order; only the KO'd one is removed.
- **The non-Doombot scry variants** (none exist — `scry-ko-own-deck` is Doombot-only).
- **A multi-select or "KO both / KO none" option** — exactly one is KO'd (Doombot's
  printed value), matching the auto-resolve's count.
- **Preplan / speculative-reveal integration** — the pending choice is authoritative
  engine state only.

---

## Files Expected to Change

**Engine:**
- `packages/game-engine/src/types.ts` — `PendingScryKoChoice` + `G.pendingScryKoChoices`.
- `packages/game-engine/src/villain/villainEffects.execute.ts` — parker branch (≥2 → park);
  **`export` `selectScryKoTarget`**.
- `packages/game-engine/src/moves/scryKoChoice.resolve.ts` — **new** — move + `hasPendingScryKoChoice`.
- `packages/game-engine/src/game.ts` — register `{ move, client: false }` + end-turn/advanceStage guard.
- **All 9 block-all guard sites** (grep-parity with `hasPendingKoHeroChoice`):
  `moves/coreMoves.impl.ts`, `moves/dodgeCard.ts`, `moves/fightMastermind.ts`,
  `moves/fightVillain.ts`, `moves/recruitHero.ts`, `moves/healWounds.ts`,
  `moves/playFromUndercover.ts`, `villainDeck/villainDeck.reveal.ts` (+ `game.ts` above).
- `packages/game-engine/src/ui/uiState.{types,build,filter}.ts` — projection + private filter.
- `packages/game-engine/src/index.ts` — **barrel re-export** of `UIPendingScryKoChoice`.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` (bot default via exported
  `selectScryKoTarget`) + `ai.types.ts` (`SIMULATION_MOVE_NAMES`) + `simulation.runner.ts`
  + `par.aggregator.ts` (both `MOVE_MAP`s).
- Tests: `moves/scryKoChoice.resolve.test.ts`, `villain/villainEffects.execute.test.ts`,
  `game.test.ts` (**both** the move-list description string AND the array literal, + the
  count; `resolveScryKoChoice` sorts between `resolveReturnZeroCostDiscard` and
  `resolveVictoryPileCardPick`; it is **NOT** in `CORE_MOVE_NAMES` — mirrors
  `resolveKoHeroChoice`), `ui/uiState.build.test.ts` + `uiState.types.drift.test.ts` +
  `uiState.filter.test.ts`, `simulation/simulation.moveDispatch.drift.test.ts` + the sim tests.
- **Conditional:** re-pinned replay/sentinel fixtures + `finalStateHash` (Verification 4).

**Client:**
- `apps/arena-client/src/components/play/PendingScryKoChoicePrompt.vue` — **new**.
- `apps/arena-client/src/composables/useTurnActions.ts` +
  `apps/arena-client/src/components/play/uiMoveName.types.ts` +
  `apps/arena-client/src/pages/PlayDesktop.vue` **and** `pages/PlayMobile.vue` (mount —
  both surfaces, NOT `PlayViewport.vue`) — wiring (+ tests).

---

## Contract

- **Pending shape:** `PendingScryKoChoice { choiceType: 'scry-ko'; playerID: string;
  revealedCardIds: CardExtId[] }`, appended to `G.pendingScryKoChoices` (FIFO). Runtime-
  only; never persisted; snapshots stay counts-only. **Note — this stores a snapshot
  (`revealedCardIds`), unlike `PendingKoHeroChoice` which stores none and recomputes
  eligibility fresh (D-24007).** Justified: the block-all guard freezes the deck top
  while pending, and KO-by-ext_id is outcome-identical (the "first occurrence is within
  the looked-at window" reasoning in `villainEffectScryKoOwnDeck`). The executor
  preserves that reasoning rather than recomputing like ko-hero.
- **Parker branch:** deck 0 → no-op; 1 → auto-KO (unchanged); ≥2 → park (KO nothing yet).
- **Resolve move:** `resolveScryKoChoice({ G, playerID }, { cardId })` — front-only,
  validates `playerID`/`choiceType`/`cardId ∈ revealedCardIds`; KOs `cardId` from the
  deck; front-pops; silent no-op (queue intact) otherwise. `client: false`. Never throws.
- **Block-all + turn-end:** `hasPendingScryKoChoice(G)` gates every action move + end-turn
  + advanceStage (same sites as `hasPendingKoHeroChoice`).
- **Determinism:** bots/sims resolve via `selectScryKoTarget` (the WP-447 worst-first
  pick), so the KO'd card is byte-identical to today's auto-resolve — par/replay
  faithful. The interactive prompt affects **live human play only**.
- **UIState:** `pendingScryKoChoice` (front of queue) with the revealed cards private to
  `playerID` (WP-249/D-24020 filtering).

---

## Acceptance Criteria

1. Deck ≥2: `villainEffectScryKoOwnDeck` pushes a `PendingScryKoChoice` (with the top 2
   ext_ids) and KOs **nothing** yet; `G.ko` is unchanged until a resolve.
2. Deck == 1: auto-KOs that card (no pending pushed); deck == 0: no-op, no pending.
3. `resolveScryKoChoice` with a `cardId` in the front's `revealedCardIds` KOs that card
   (to `G.ko`), leaves the other on top of the deck, and front-pops the queue; a
   `cardId` NOT in `revealedCardIds`, a wrong `playerID`, or an empty queue is a silent
   no-op leaving the queue intact.
4. While a scry choice is pending, every action move (play, recruit, fight, dodge,
   fight-mastermind, …) and `endTurn`/`advanceStage` are blocked (`hasPendingScryKoChoice`).
5. Bot/sim: with a pending scry choice, the bot's legal moves include
   `resolveScryKoChoice` with `selectScryKoTarget`'s pick; a full bot game fighting a
   Doombot KOs the **same** card the WP-447 auto-resolve did (determinism preserved).
6. UIState: `pendingScryKoChoice` projects the front's revealed cards, visible only to
   the choosing player (filtered variant hides them from others).
7. Client: `PendingScryKoChoicePrompt.vue` renders the ≤2 cards and submits
   `resolveScryKoChoice` on click; mounted at the play root. arena-client test + vue-tsc
   + build green.
8. **Sim dispatch / no-hang:** `resolveScryKoChoice` is in `SIMULATION_MOVE_NAMES` + both
   sim `MOVE_MAP`s; `simulation.moveDispatch.drift.test.ts` asserts membership; a full bot
   game fighting a Doombot **completes** (`sim:runtime-observed:check` returns — no
   per-turn hang).
9. **Persisted-log replay disposition (backward-compat):** confirm no accepted
   competitive score / replay-reconstructed match fought a Doombot Legion henchman before
   this WP lands (see Verification 5). If confirmed empty, this WP is safe; if any exists,
   a version-gate/grandfather rule is required (escalate).
10. `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` +
    `pnpm --filter @legendary-arena/arena-client test` green; `game.test.ts` move-set/count
    updated in **both** literals (+`resolveScryKoChoice`, not in `CORE_MOVE_NAMES`);
    replay/fixture `finalStateHash` regenerated-with-note (re-pin LIKELY — bot fixtures
    fighting a Doombot now park→resolve).

---

## Verification Steps

1. `pnpm -r build`; `pnpm --filter @legendary-arena/game-engine test`;
   `pnpm --filter @legendary-arena/arena-client test` + `typecheck`.
2. **Determinism:** a bot game fighting a Doombot now emits a park + a resolve move (vs
   one auto-KO) and carries a hashed `G.pendingScryKoChoices` while pending, so
   record-game/replay/sentinel fixtures that fight a Doombot shift — **re-pin is LIKELY**;
   regenerate the affected fixtures + `finalStateHash` with a note, and confirm the KO'd
   card is unchanged (selectScryKoTarget).
3. `game.test.ts` move-registration drift test updated for `resolveScryKoChoice`.
4. Live-verify (D-24026): drive/play a match, fight a Doombot with ≥2 deck cards → the
   prompt appears, KO one → the other stays on top, no `Unhandled effect observed`.
5. **Persisted-log replay backward-compat (mandatory disposition, D-24119/D-24187).**
   This changes the reducer behavior of an existing move path (`fightVillain` → Doombot
   Fight): a pre-WP-470 match log (recorded under WP-447 auto-resolve, no
   `resolveScryKoChoice` move) replayed through the WP-470 reducer would **park a pending
   choice the old log never resolves** → subsequent logged moves hit the block-all guard
   and no-op → the replay diverges from the recorded `gameover`. Those `bgio` blobs are
   immutable (cannot be re-pinned). At execution the operator MUST confirm **no accepted
   competitive score, and no replay-reconstructed match, fought a Doombot Legion henchman
   before this WP lands** — plausibly empty (scry-ko-own-deck shipped 2026-07-30, one day
   before; Doombot Legion is an opt-in henchman group, and competitive scores require an
   approved ranked-gauntlet loadout). If empty, state it and proceed; if ANY such log
   exists, STOP and specify a version-gate/grandfather rule before landing.

---

## Definition of Done

- [ ] All 8 Acceptance Criteria pass.
- [ ] Engine: pending state + parker + resolve move + block-all guards + UIState
      projection + bot/sim default all landed; `game.test.ts` move-set updated.
- [ ] Client: `PendingScryKoChoicePrompt.vue` + wiring; arena-client test/typecheck/build green.
- [ ] `pnpm -r build` green; replay/fixture hash unchanged OR regenerated-with-note.
- [ ] `D-24282` landed (Active).
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` → Done; `docs/05-ROADMAP-MINDMAP.md`
      node `✅` + `roadmap:counts:check` green.
- [ ] `User-Visible Surface = play.legendary-arena.com` — **D-24026 live-verify
      operator-pending** on the next client deploy.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict in the SPEC commit body). Load-bearing:

- **§ Layer boundary:** cross-layer (Game Engine + Arena Client), but a **single tightly-
  coupled interactive-choice feature** extending existing infrastructure, with a per-layer
  allowlist and engine-then-client order (§Context). Engine owns truth (parks + resolves);
  the client submits intent (the resolve move). PASS.
- **§ Determinism / persistence:** the new `G.pendingScryKoChoices` is runtime-only
  (never persisted; snapshots counts-only), matching `pendingKoHeroChoices`. Bots/sims
  resolve via `selectScryKoTarget` so par/replay are faithful; a **re-pin is LIKELY** for
  bot fixtures fighting a Doombot (Verification 4). PASS.
- **§ Move Validation Contract:** `resolveScryKoChoice` validates → mutates → returns
  void, never throws; invalid states are silent no-ops with the queue intact. PASS.
- **§ Pending-choice safety:** the block-all guard + UIState projection + client prompt
  ship together (avoids `project_pending_choice_no_ux_freeze`). PASS.
- **§ Contract / drift:** a new pending-choice type + move + G field + UIState field, and
  the `CORE_MOVE_NAMES`/move-set drift test moves with the new move; recorded by D-24282
  (§Contract Files). PASS.
- **§17 gameplay fidelity:** implements Doombot's printed "look at 2, KO one, put the
  other back" with real player agency. No conflict.
- **§20 N/A** — no funding surface. **§21 N/A** — no `apps/server` endpoint (the move is
  a bgio move, not an HTTP endpoint).
- Remaining sections: PASS / N/A as recorded in the commit body.

**Gate verdicts (recorded inline per 01.0a Step 5).**
- **Pre-flight (01.4):** `NOT READY` → resolved. The mechanism verified against real
  source (the WP-242/243/447 pattern is faithful; the sim generically drains any pending
  via a per-pending short-circuit, so `scry-ko` + `selectScryKoTarget` stays
  deterministic). The 3 blocking PS-items were pure **allowlist enumeration** and are now
  applied verbatim from the pre-flight's own file list (verified by grep-parity): (PS-1)
  the 5 missing guard sites — `fightVillain.ts`, `recruitHero.ts`, `healWounds.ts`,
  `playFromUndercover.ts`, `villainDeck.reveal.ts`; (PS-2) the client mount is
  `PlayDesktop.vue` + `PlayMobile.vue`, not `PlayViewport.vue`; (PS-3) the
  `packages/game-engine/src/index.ts` barrel re-export of `UIPendingScryKoChoice`. RS-items
  folded in: `export selectScryKoTarget`, the `revealedCardIds`-snapshot justification, and
  the `uiState.types.drift`/`uiState.filter` test coverage.
- **Copilot (01.7):** `RISK`, all findings resolved in-place — (1) the one-WP/one-PR lock
  (the WP-242/243 co-release split failed, so this is atomic); (2) the **persisted-log
  replay backward-compat disposition** added to Verification 5 + AC-9 + D-24282 (the
  competitive-verification blast radius, plausibly zero but stated, with an escalation
  rule); (3) the move-registration completeness — `SIMULATION_MOVE_NAMES` + both
  `MOVE_MAP`s + `simulation.moveDispatch.drift.test.ts` (or the sim **hangs**), the dual
  `game.test.ts` literals, and `CORE_MOVE_NAMES` non-membership; (4) the full guard-site
  enumeration + grep-parity (= PS-1). Since every fix is a wording/allowlist/AC addition
  (no design, allowlist-boundary, or mutation change), pre-flight re-verification is
  satisfied by grep-confirming the exact enumerated files.
