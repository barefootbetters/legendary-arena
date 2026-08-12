# WP-532 — Paibok the Power Skrull (Villain) Fight: Each Player Gains an HQ Hero (Interactive)

**User-Visible Surface:** `play.legendary-arena.com` — defeating the **core**
Skrulls villain **Paibok the Power Skrull** now lets each player gain a Hero from
the HQ (the fighting player picks interactively) instead of doing nothing.
**D-24026 live-verification applies** (operator-pending, post-deploy).

## User-Visible Impact

Paibok's printed **Fight** — *"Choose a Hero in the HQ for each player. Each player
gains that Hero."* — is currently **unmarked**, so fighting him reaches no
executable handler (D-24266 `unmarked-ability` `no-handler` breadcrumb). Reported
live from a Dr. Doom / Secret Invasion match (turn 36: Paibok fought, Fight fired
nothing; `hollowEffects[]` recorded `unmarked-ability`/`no-handler`).

## Goal

Implement the core Skrulls villain **Paibok the Power Skrull**
(`core/skrulls/paibok-the-power-skrull`, copies 1) **Fight** ability, currently
hollow (D-24266). His Fight gives **each player** one Hero from the HQ into that
player's discard, refilling each vacated HQ slot. This needs a new **interactive**
`VillainEffectPrimitive` `give-hq-hero-each-player` (the 20th; another villain-effect
primitive that introduces its own pending-choice type, after `ko-hero` (WP-242,
reused by WP-492) and `scry-ko-own-deck` (WP-470)). **Fidelity is locked
(§Fidelity):** the fighting (current) player picks *which* HQ Hero interactively;
every other player — and any bot/auto-driven player — auto-picks the **highest-cost**
HQ Hero. Cross-layer (game engine + arena-client + server bot-loops + card data),
one WP. Locks **D-24343**.

## Fidelity (locked by the operator, 2026-08-11)

The card says *"Choose a Hero in the HQ … Each player gains that Hero"* — a genuine
per-player choice. Villain effects otherwise auto-resolve, but the operator has
locked this one as **interactive for the human, highest-cost for the bot**: each
player's Hero is chosen by that player when human-controlled, or auto-picked
(highest-cost) when bot/auto-driven. In the shipped co-op case the fighting player is
the human and the allies are bots, so this maps cleanly onto the engine's
**current-player-parks / others-auto-resolve** split (D-24284, `PendingDiscardChoice`):
the current player parks an interactive pick; every other player auto-resolves.
**This is an operator design choice, not an engine limitation.** A more literal
rendering — the fighting player making N sequential picks, one Hero per player, via
the same FIFO queue — was available but deliberately not taken, because the operator's
instruction assigns the bot allies' Heroes to the auto-highest-cost rule rather than
to the human's choice. (A future WP could add current-player-multi-pick as an
extension seam on the same queue.)

- **The current (fighting) player** — the human, in the reported co-op case — gets
  the interactive pick: with ≥ 2 HQ Heroes, **park** a `pendingGiveHqHeroChoice`;
  the client renders a "choose a Hero to gain" prompt over the HQ. If the current
  player is **bot/auto-driven**, `ai.legalMoves` pre-fills the resolve move with the
  **highest-cost** HQ Hero, so the bot never blocks. With exactly 1 HQ Hero the gain
  is forced → auto-resolve (no prompt); with 0, reachable no-op.
- **Every other player** auto-gains the **highest-cost** HQ Hero synchronously (no
  park), refilling the slot each time — deterministic, no interactivity. This is the
  D-24284 "others auto-resolve" arm and satisfies the operator's "for the bot, just
  choose the highest cost."

**Ordering (determinism).** The handler first auto-resolves every **non-current**
player in `Object.keys(G.playerZones).sort()` order (each gains highest-cost from the
live HQ + refill), THEN handles the current player (park if ≥ 2 / auto-gain if 1 /
no-op if 0). The current player therefore picks from the HQ that remains after the
others resolve — a single deterministic sequence.

## Assumes

- Baseline: `origin/main` @ the WP-532 reserve (`origin/main` had the reserve line
  for WP-532/EC-567/D-24343 at draft time). Working tree clean.
- **WP-522 / D-24335 — HQ-hero remove + gift-to-discard + refill.**
  `villainEffectGiveHqHeroByTraitToCurrent` (`villain/villainEffects.execute.ts`)
  removes the highest-cost HQ Hero matching a trait predicate, `refillHqSlot(G.hq,
  index, G.heroDeck)` (`board/city.logic.ts`), and pushes it onto a player's
  `discard`. This WP reuses that mutation shape **minus the trait filter** (any HQ
  Hero) and **broadened to each player** + an interactive park for the current one.
  Highest-cost selection helper `selectHqHeroIndexByTraitHighestCost`
  (`villainEffects.execute.ts`, cost from `G.cardStats[id]?.cost ?? 0`, ties →
  rightmost) is the bot/others selector without the predicate.
- **WP-242 / D-24007 + WP-243 / D-24010 — the interactive KO-hero pipeline** is the
  structural template: `PendingKoHeroChoice` / `G.pendingKoHeroChoices`
  (`types.ts`), `resolveKoHeroChoice` (`moves/koHeroChoice.resolve.ts`), the
  block-all guard cascade (`fightVillain.ts` + coreMoves/recruit/… ~14 sites), the
  `buildUIState` "13b" projection + `filterUIStateForAudience` arm, the
  `PendingKoHeroChoicePrompt.vue`, the `ai.legalMoves` short-circuit.
- **WP-476 / D-24284 — `PendingDiscardChoice`** is the closest behavioural twin:
  **current player parks; other players auto-resolve.** This WP follows that split.
- **WP-514 / D-24327 — "gain" routes to discard**, never victory
  (`G.playerZones[player].discard.push(heroId)`).
- **D-24034** — append-only primitive drift (union + array lockstep, count 19 → 20).
- **G.hq** 5-tuple; `G.cardStats[id].cost`; `G.heroDeck` FIFO reservoir; the reported
  card `core/skrulls/paibok-the-power-skrull`, Fight line currently unmarked.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, **§UIState Projection
  Integrity (the Board-Visible Field five-step contract — a missed
  `filterUIStateForAudience` arm silently drops the prompt)**, §Zone & Pile
  Structure, §Determinism.
- `.claude/rules/*.md`, `.claude/skills/legendary-game-engine/SKILL.md`,
  `project_pending_choice_no_ux_freeze` (an engine block-all `pending*` shipped
  WITHOUT a UIState projection + client prompt is a hard-freeze — ship the guard,
  projection, and prompt **together**, atomically).
- `docs/ai/DECISIONS.md` — D-24284 (current-parks/others-auto split, the pattern
  this WP reuses), D-24327 (gain → discard), D-24335 (HQ-hero remove+refill+gift),
  D-24007/D-24010 (interactive KO pipeline), D-24034, D-24266.
- Source: `villain/villainEffects.execute.ts` (`villainEffectKoHero` `target:'each'`
  loop + `target:'current'` park; `villainEffectGiveHqHeroByTraitToCurrent`;
  `selectHqHeroIndexByTraitHighestCost`); `moves/koHeroChoice.resolve.ts` (resolve
  move template); `moves/fightVillain.ts:274` (the `onFight` fire site);
  `ui/uiState.{types,build,filter}.ts` (projection 13b); `game.ts` (move
  registration) + `game.test.ts` (move-count drift, 27 → 28);
  `simulation/ai.legalMoves.ts` (bot short-circuit);
  `apps/server/src/autoplay/botLoopProgress.mjs` (`PENDING_CHOICE_MOVE_NAMES`);
  `apps/server/src/bot-ally/botAllyDriver.mjs` (`PENDING_CHOICE_FLAGS`);
  `apps/arena-client/src/components/play/PendingKoHeroChoicePrompt.vue` +
  `pages/PlayDesktop.vue` / `PlayMobile.vue`.
- **The card** — `data/cards/core.json` (villains → `skrulls` →
  `paibok-the-power-skrull`), Fight line (read verbatim).

**Split-vs-single decision:** ONE WP. This is a single card's mechanic and the
pending-choice-freeze invariant requires the engine guard, the UIState projection,
and the client prompt to land together — splitting engine from client opens a
hard-freeze window on `main`. The new-pending-choice-type precedent (WP-476
`PendingDiscardChoice`, WP-479 `PendingReorderChoice`) shipped engine + client as a
single WP; this follows it. Cross-layer → standard two-session lane (lightweight lane
is disqualified by the layer crossing).

## Scope (In)

- New `VillainEffectPrimitive` `'give-hq-hero-each-player'` (union + array lockstep,
  append-only, D-24034; count 19 → 20). No-param; marker `[effect:give-hq-hero-each-player]`.
- **Parser arm** — the generic terminal no-param branch (like
  `ko-cullable-each-deck-top` / `swap-two-city-villains`), returns
  `{ primitive: 'give-hq-hero-each-player' }`.
- **Handler** `villainEffectGiveHqHeroEachPlayer` (`onFight`): for each non-current
  player (sorted) auto-gain the highest-cost HQ Hero → their discard + `refillHqSlot`;
  then for the current player park a `pendingGiveHqHeroChoice` when ≥ 2 HQ Heroes,
  auto-gain when exactly 1, no-op when 0. Keyword-less → self-narrates via `pushLog`.
- **New pending type** `PendingGiveHqHeroChoice` (`{ choiceType:
  'give-hq-hero'; playerID }`) + `G.pendingGiveHqHeroChoices?` FIFO queue (`types.ts`).
- **New resolve move** `resolveGiveHqHeroChoice` (`moves/giveHqHeroChoice.resolve.ts`)
  + `hasPendingGiveHqHeroChoice(G)` predicate; registered in `game.ts` (`client:
  false`, NOT in `CORE_MOVE_NAMES`); `game.test.ts` move count 27 → 28.
- **Block-all guard** — add `hasPendingGiveHqHeroChoice` following the **newest
  D-24301 `returnOnDiscard` convention** (the pattern this WP mirrors): the 9 core
  enforcement sites (`game.ts`, `moves/coreMoves.impl.ts`, `moves/recruitHero.ts`,
  `moves/fightMastermind.ts`, `moves/fightVillain.ts`, `moves/playFromUndercover.ts`,
  `moves/healWounds.ts`, `moves/dodgeCard.ts`, `simulation/ai.legalMoves.ts`) + the
  new resolve move's own guard. Do **NOT** add it to the older `optionalKoReward` /
  `scryKoChoice` resolve-move cross-guards or to `villainDeck/villainDeck.reveal.ts`
  (the returnOnDiscard convention omits them; `endTurn` is guarded, so a next-turn
  reveal cannot fire with a choice outstanding).
- **UIState** — `UIPendingGiveHqHeroChoice` (`uiState.types.ts`), projection in
  `buildUIState` from `G.pendingGiveHqHeroChoices[0]` with `eligible` recomputed from
  the **public** `G.hq` (HQ hero slots), a `filterUIStateForAudience` arm (HQ is
  public, so no hand-leak redaction; still per-chooser).
- **Bot / auto** — `ai.legalMoves` short-circuit returns the single
  `resolveGiveHqHeroChoice` move pre-filled with the **highest-cost** HQ Hero;
  `PENDING_CHOICE_MOVE_NAMES` (`botLoopProgress.mjs`) + `PENDING_CHOICE_FLAGS`
  (`botAllyDriver.mjs`) gain the new move / queue field.
- **Client** — `PendingGiveHqHeroChoicePrompt.vue` mounted in `PlayDesktop.vue` +
  `PlayMobile.vue` (renders when `pendingGiveHqHeroChoice && viewerPlayerId ===
  playerID`; click submits `resolveGiveHqHeroChoice { cardId }`).
- **Card marker** — `core.json` Paibok Fight line + marker vocabulary + regen
  `core.json` / `villain-mechanic-ledger.{json,csv}` / `effect-implementation-index.json`
  / `mechanic-provenance.json` (`{ WP-532, D-24343 }` net-new row).

## Out of Scope

- **The co2e Paibok twin** (`co2e/skrulls/paibok…`, also `(unmarked)`) — a fast
  follow-up WP (identical primitive; only a co2e marker + regen). Not this WP.
- **Non-current / current-player-multi-pick interactive choice** — other players
  auto-resolve to highest-cost; the fighting player does NOT pick Heroes on their
  behalf. This is the operator-locked reading (D-24343): the FIFO queue *could* carry
  N current-player picks, but that rendering was deliberately not chosen because the
  operator assigns bot allies' Heroes to the auto-highest-cost rule. A future WP could
  add it as an extension seam.
- **The KO alternative** — the card gives a Hero unconditionally; there is no KO
  branch.
- Gains land in **discard**, never victory (D-24327). No scoring/PAR change; no new
  contract file.

## Files Expected to Change

**Engine:** `rules/villainAbility.types.ts` (union+array), `setup/villainAbility.setup.ts`
(parse arm), `villain/villainEffects.execute.ts` (handler + per-player loop + park +
highest-cost selection), `types.ts` (pending type + `G` field),
`moves/giveHqHeroChoice.resolve.ts` (**new** move + predicate), `game.ts`
(registration + block-all guard), the block-all guard sites (the D-24301
`returnOnDiscard` 9-site convention: `moves/coreMoves.impl.ts`, `moves/recruitHero.ts`,
`moves/fightMastermind.ts`, `moves/fightVillain.ts`, `moves/playFromUndercover.ts`,
`moves/healWounds.ts`, `moves/dodgeCard.ts`, `simulation/ai.legalMoves.ts` — **not**
`optionalKoReward`/`scryKoChoice` resolve moves, **not** `villainDeck/villainDeck.reveal.ts`),
`ui/uiState.{types,build,filter}.ts`; tests
(`villainAbility.types.test.ts`, `villainEffects.execute.test.ts`,
`setup/villainAbility.setup.test.ts`, `game.test.ts` move-count 27→28,
`giveHqHeroChoice.resolve.test.ts` **new**, uiState filter/build tests,
`simulation/simulation.moveDispatch.drift.test.ts`).

**Server (bot loops):** `apps/server/src/autoplay/botLoopProgress.mjs`
(`PENDING_CHOICE_MOVE_NAMES`), `apps/server/src/bot-ally/botAllyDriver.mjs`
(`PENDING_CHOICE_FLAGS`); their `.test.ts` siblings.

**Client:** `apps/arena-client/src/components/play/PendingGiveHqHeroChoicePrompt.vue`
(**new**) + `.test.ts`, `pages/PlayDesktop.vue` + `PlayMobile.vue` (mount + block-all
gate), and any `useTurnActions` / `TurnActionBar` gate that mirrors the other
`pending*` flags.

**Data / tooling:** `apply-effect-markers.mjs`,
`scripts/convert-cards/inputs/villain-effect-markers.json` (Paibok Fight row — the
`MARKER_MAP_PATH` `apply-effect-markers.mjs` reads, per WP-520/522/523),
`data/cards/core.json` regen, `villain-mechanic-ledger.{json,csv}`,
`effect-implementation-index.json`, `mechanic-provenance.json`.

**ewiki:** `wiki/card-effect-system.md` (+ `wiki/villain-deck.md` pending-choice list).

**Governance:** `DECISIONS.md` (D-24343), `NUMBER-LEDGER.md`, `STATUS.md`,
`WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The mechanic (D-24343).** On Paibok `onFight`, every player gains one HQ Hero
  into their **discard** (D-24327), refilling each vacated slot from `G.heroDeck`
  (`refillHqSlot`; leaves `null` on empty reservoir). Non-current players auto-gain
  the **highest-cost** HQ Hero (ties → rightmost index, matching `captureHeroFromHq`).
  The current player parks a `pendingGiveHqHeroChoice` when ≥ 2 HQ Heroes remain,
  auto-gains when exactly 1, no-ops when 0. Keyword-less → self-narrates via `pushLog`.
- **Pending shape.** `PendingGiveHqHeroChoice { choiceType: 'give-hq-hero';
  playerID }`; `G.pendingGiveHqHeroChoices?: PendingGiveHqHeroChoice[]` (FIFO,
  lazily created, runtime-only, never persisted). Resolve move
  `resolveGiveHqHeroChoice({ G, playerID }, { cardId })` validates `queue[0]`
  (front playerID + choiceType), gains the chosen HQ Hero to the player's discard +
  `refillHqSlot`, front-pops. The chosen `cardId` MUST be a current HQ slot occupant
  (else silent no-op per the move contract — moves never throw).
- **Atomic ship (project_pending_choice_no_ux_freeze).** The block-all guard, the
  `buildUIState` + `filterUIStateForAudience` projection, and the client prompt land
  in the SAME WP. An engine guard without a prompt hard-freezes the match.
- **Determinism.** No `ctx.random` (selection is deterministic highest-cost / rightmost
  tie; refill is a FIFO `G.heroDeck` shift, already hashed). The marker adds a Fight
  descriptor to Paibok's hashed `villainAbilityHooks`; the new pending queue is a
  hashed `G` field. **Verify** whether any committed fixture / hashed oracle
  (`finalStateHash`, `PRE_WP080_HASH`, sentinel) materializes `core/skrulls` — if so,
  re-record via `record-game-fixture.mjs` (never hand-edit); expected: unaffected
  unless a fixture fights Paibok.

## Acceptance Criteria

1. Fighting `core/skrulls/paibok-the-power-skrull` with ≥ 2 HQ Heroes: every
   **non-current** player gains the highest-cost HQ Hero into their discard (HQ
   refills each time), and the **current** player parks a `pendingGiveHqHeroChoice`
   (board freezes on the next move until resolved). **No `no-handler` hollow.**
2. `resolveGiveHqHeroChoice { cardId }` for the current player moves that HQ Hero to
   the current player's discard, refills the slot, and front-pops the queue; a
   `cardId` not in the HQ is a silent no-op (move never throws).
3. Exactly 1 HQ Hero → the current player auto-gains it (no park); 0 HQ Heroes for a
   player → reachable no-op for that player. Empty `G.heroDeck` → slot left `null`.
4. Bot/auto path: with a pending `give-hq-hero` choice, `ai.legalMoves` returns
   exactly one `resolveGiveHqHeroChoice` move pre-filled with the highest-cost HQ
   Hero; `botLoopProgress` + `botAllyDriver` drain it (drift test passes).
5. Gains land in `discard`, never `victory`; tie among equal-cost auto-picks → the
   rightmost HQ index.
6. The primitive is in BOTH union AND array (drift passes); `[effect:give-hq-hero-each-player]`
   parses to the no-param descriptor; move count is 28 (`game.test.ts`).
7. UIState: `pendingGiveHqHeroChoice` is projected for the chooser (eligible = current
   HQ slots), survives `filterUIStateForAudience`, and **appears in the Play
   Diagnostics `uiStateSnapshot` for the chooser** (the canonical Board-Visible Field
   step 5); the client prompt then renders for the chooser and submits the resolve
   move. **No blank prompt (Board-Visible Field Rule).**
8. `core/skrulls/paibok-the-power-skrull` flips unmarked → executable with `{ WP-532,
   D-24343 }`; `pnpm -r build` 0; engine + arena-client + server suites green;
   `typecheck` green for arena-client; hashed oracles verified.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (handler each-player +
   park/auto/no-op + resolve move + drift + parse + move-count).
3. `pnpm --filter @legendary-arena/arena-client typecheck && … test` → pass (prompt
   render + submit + block-all gate).
4. `pnpm --filter @legendary-arena/server test` → pass (`botLoopProgress` +
   `botAllyDriver` drain the new pending move).
5. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm sim:runtime-observed:check && pnpm roadmap:counts:check` → 0.
6. `pnpm check:wiki && pnpm wiki-viewer:check-links` → 0.
7. Live-verify (D-24026, operator, post-deploy): fight Paibok in a match; confirm the
   "choose a Hero to gain" prompt appears for the fighting human, the picked Hero
   enters your discard + HQ refills, the bot ally gains the highest-cost Hero, and no
   `no-handler` hollow appears in diagnostics.

## Definition of Done

- All Acceptance Criteria pass; Verification Steps green.
- Two-commit topology (`EC-567:` + `SPEC:`): D-24343 Active; STATUS updated;
  `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap `📝`→`✅` + counts regenerated.
- `git diff --name-only` matches the allowlist; `User-Visible Surface =
  play.legendary-arena.com` — D-24026 operator-pending.

## Non-Negotiable Constraints

- Full file contents; ESM; Node v22+; `node:` imports; `00.6` human-style code; no
  `.reduce()` in zone/effect operations.
- Determinism: no `Math.random()`/`Date.now()`/I/O; no `ctx.random`.
- Union + array lockstep (append-only, D-24034); move count 27 → 28.
- Current player parks (≥ 2) / auto-gains (1) / no-ops (0); non-current players
  auto-gain **highest-cost** (rightmost tie) synchronously, in sorted order, BEFORE
  the current player is handled.
- Gain → recipient's **discard** (D-24327), never victory; refill via `refillHqSlot`.
- **Ship the pending guard + UIState projection + client prompt atomically**
  (`project_pending_choice_no_ux_freeze`) — an engine block without a prompt is a
  hard-freeze.
- Only `core/skrulls/paibok-the-power-skrull` Fight is marked (co2e twin is a
  follow-up).
- Net-new primitive → `{ "wp": "WP-532", "decision": "D-24343" }` provenance row.

**Locked contract values:** see `## Contract` and `EC-567` Locked Values.

## Vision Alignment

- **Vision clauses touched** — §1, §2, §10 (faithful card semantics; interactive
  player agency).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed (no PvP interaction: gaining
  a Hero is a per-player benefit, not a player-vs-player action).
- **Determinism preservation** — deterministic; no `ctx.random`; re-pin posture in
  §Contract (expected: unaffected unless a fixture fights Paibok).

## Lint Gate Self-Review (00.3)

All 21 sections resolved:
- **§1 Goal / §2 Impact** PASS. **§3 Assumes** PASS (WP-522/242/243/476/514 anchors +
  D-24284 pattern).
- **§4 Context** PASS (ARCHITECTURE incl. §UIState five-step contract; DECISIONS;
  sources; the no-freeze invariant).
- **§5 Files** PASS (cross-layer allowlist enumerated: engine + server-bot + client +
  card-data).
- **§6 Naming** PASS (canonical field names, `give-hq-hero`, `pendingGiveHqHeroChoices`).
  **§7 Deps** PASS (no new external dep).
- **§8 Architecture** PASS (cross-layer, boundary-respecting: engine decides, client
  projects read-only, server bot-loops drain; the freeze invariant is honored).
- **§9/§10/§11** N/A. **§12 Test Quality** PASS (drift + handler each-player + park/auto/
  no-op + resolve + move-count + bot-drain + UIState filter, non-vacuous).
- **§13 Verification** PASS. **§14 Acceptance** PASS (8 binary items).
- **§15/§15.1 DoD** PASS (two-commit topology + user-visible surface + D-24026).
- **§16 Code Style** PASS (models `villainEffectKoHero`/`giveHqHeroByTrait…`;
  `// why:` on the each-player loop, the current-parks/others-auto split, gift→discard,
  highest-cost tie-break, and every `pending*`/guard addition).
- **§17 Vision** PASS. **§18 Prose-vs-Grep** PASS (no policed literal echoed).
  **§19** N/A.
- **§20 Funding** N/A. **§21 API Catalog** N/A (no HTTP endpoint / library-surface
  change — the bot loops consume the engine move set, not a catalogued library fn).
- Reserves **D-24343**. Fidelity locked by the operator (§Fidelity) — not left implicit.

## Gate Verdicts (Step 5, on record)

- **Pre-flight (01.4): READY TO EXECUTE** — after the two blocking path fixes it
  named were applied. PS-1: the block-all guard path `villain/villainDeck.reveal.ts`
  did not exist; corrected to the D-24301 9-site convention and `villainDeck/`
  dropped from the guard set (the returnOnDiscard convention omits it). PS-2:
  `inputs/card-effect-markers*` did not exist; corrected to
  `scripts/convert-cards/inputs/villain-effect-markers.json` (the `MARKER_MAP_PATH`).
  RS-1 folded (count: not "second interactive" — `ko-hero`/WP-242+492 and
  `scry-ko-own-deck`/WP-470 already park; reworded to "another primitive with its own
  pending type"). RS-2 folded (EC pins the 9-site returnOnDiscard convention, not the
  12-file `hasPendingKoHeroChoice` grep that would hit `optionalKoReward`/`scryKoChoice`
  and trip the scope-lock). Verified-correct on record: primitive count 19→20, move
  count 27→28, all four hard-deps Done on `main`, all cited symbols/paths present.
- **Copilot (01.7): RISK → resolved (documented, HOLD-class fixes applied).** (1)
  Fidelity rationale reworded — the others-auto design is an **operator design
  choice**, not an engine limitation (a current-player-multi-pick rendering was
  available on the same FIFO queue but deliberately not taken). (2) Board-Visible
  Field step 5 restored — AC-7 + EC now require confirming `pendingGiveHqHeroChoice`
  in the Play Diagnostics `uiStateSnapshot`, alongside the client-render check. No
  scope/allowlist/mutation-boundary change → no pre-flight re-run required (per the
  copilot verdict's own disposition).
- **Lint gate (00.3):** all 21 sections resolved (above).
