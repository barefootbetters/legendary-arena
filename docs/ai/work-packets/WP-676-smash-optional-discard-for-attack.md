# WP-676 — Smash: optional discard-for-attack hero keyword (Cross-layer — Game Engine + Arena Client)

**Status:** Draft 2026-09-08 (EC-713; D-24492 reserved)
**Layer:** Game Engine (parse + runtime + pending choice + UIState) + Arena Client (choice UI)
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** D-24442 (optional-ko-reward pending-choice queue + `OptionalKoRewardPrompt.vue` client prompt) ✅, D-24069 (draw-or-empowered pending-choice + UIState framework) ✅, D-24185 (discard-to-play hand-eligibility helper `getEligibleDiscardToPlayCards`) ✅, D-24464 (the Honest-Partial note that named `[keyword:Smash N]` an inner hollow) ✅

## Goal

Implement the **Smash** hero keyword so a card printing "Smash N" grants its printed
optional attack bonus. Per `docs/legendary-universal-rules-v23.md` §Smash: *"Smash N"
means "You may discard another card from your hand. If you do, you get +N attack."* The
player is offered an interactive choice — discard one hand card for +N attack, or decline
— once per printed Smash instance. A card printing two "Smash 2" (She-Hulk's Hurl Trucks)
offers two independent optional discards, for +0 / +2 / +4 total. After this WP, playing
Hurl Trucks prompts the discard choice instead of silently doing nothing.

## User-Visible Impact

`play.legendary-arena.com` — playing a Smash card (She-Hulk's Hurl Trucks and the other
wwhk Smash cards) presents a "discard a card for +N attack, or decline" prompt, and the
chosen discard grants the attack. Purely a fidelity fix: a printed ability that today
does nothing begins to resolve. It reuses the shipped pending-choice UI framework
(`OptionalKoRewardPrompt.vue` is the structural model). Live-on-surface is
operator-pending (D-24026).

## Assumes

- **`packages/game-engine/src/hero/heroEffects.execute.ts`** exports `HANDLED_KEYWORDS`,
  `NO_MAGNITUDE_KEYWORDS`, `HERO_EFFECT_HANDLERS`, and the `heroEffectOptionalKoReward` /
  `heroEffectOptionalKoHandDiscard` park handlers (the structural model for the new
  `heroEffectSmash` park). The `executeSingleEffect` magnitude pre-gate requires a valid
  magnitude for any keyword not in `NO_MAGNITUDE_KEYWORDS`.
- **`packages/game-engine/src/rules/heroKeywords.ts`** exports the `HeroKeyword` union and
  the `HERO_KEYWORDS` canonical array (kept in lockstep; a drift pin asserts the length).
- **`packages/game-engine/src/types.ts`** carries the `pending*` queue fields on
  `LegendaryGameState` (e.g. `pendingOptionalKoRewards?: PendingOptionalKoReward[]`); the
  new `pendingSmashDiscards?` queue is added in the same block.
- **`packages/game-engine/src/moves/optionalKoReward.resolve.ts`** is the shape model for
  the new resolve move + `has*` predicate; **`resolveDiscardToPlay.ts`** /
  `getEligibleDiscardToPlayCards` is the model for reading and removing a chosen hand card.
- **`packages/game-engine/src/game.ts`** holds the block-all turn guards and the moves map.
- **`packages/game-engine/src/ui/uiState.{build,filter,types}.ts`** + `index.ts` are the
  UIState projection surface (the five-step Board-Visible Field contract, per
  `.claude/rules/architecture.md §UIState Projection Integrity`).
- **`apps/arena-client/src/components/play/OptionalKoRewardPrompt.vue`** plus its
  `PlayDesktop.vue` / `PlayMobile.vue` / `useTurnActions.ts` / `uiMoveName.types.ts` /
  `diagnostics/effectProvenance.ts` wiring are the shipped client model.
- **`data/cards/wwhk.json` is GENERATED.** The Smash markers are authored in the marker
  SOURCE (`scripts/convert-cards/inputs/hero-ability-markers.json`, validated by
  `apply-hero-ability-markers.mjs`) and the file is reproduced by regen — never hand-edited
  (CLAUDE.md §Card Data). Every card printing Smash is in `wwhk.json` (World War Hulk);
  no other set carries the keyword.
- Baseline: `origin/main` at the WP-675 SPEC (`19e7e058`), with the D-24492 reserve landed.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` §Smash — the authoritative rule text (the
  "you may discard another card … +N attack" definition).
- `data/metadata/keywords-full.json` `"smash"` entry — the mirrored keyword description.
- `docs/ai/DECISIONS.md` — scan D-24442 (optional-ko-reward pending-choice + client
  prompt), D-24069 (draw-or-empowered pending-choice + UIState framework), D-24185
  (discard-to-play hand cost + eligibility helper), D-24464 (Smash named as an
  Honest-Partial inner hollow), D-24372 (drift pins are RUNTIME assertions).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) and §Architectural Principles
  #2 (UI consumes read-only projections); `.claude/rules/architecture.md §UIState
  Projection Integrity` — the five-step Board-Visible Field contract.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical field names (`ext_id` /
  `CardExtId`, zone names) for the pending-choice and move payloads.
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code (this WP produces engine + Vue).
- ewiki [Play Board](../../wiki/play-board.md) — zone→field map + projection pipeline.

## Scope (In)

- **Keyword registration:** add `'smash'` to the `HeroKeyword` union and `HERO_KEYWORDS`
  array in lockstep (`heroKeywords.ts`); bump the length drift pin; add to
  `HANDLED_KEYWORDS` and the `HERO_EFFECT_HANDLERS` map (`heroEffects.execute.ts`); bump
  the handler-count pin. `smash` carries a magnitude, so it is **NOT** added to
  `NO_MAGNITUDE_KEYWORDS` (its +N flows through the `executeSingleEffect` magnitude gate).
- **Park handler:** `heroEffectSmash` — an onPlay handler that parks one
  `PendingSmashDiscard { playerID, magnitude }` per Smash hook onto the new FIFO
  `G.pendingSmashDiscards` queue (two Smash hooks on one card → two queue entries). A
  defensive empty-hand no-op logs and parks nothing (nothing to discard → no choice).
- **Pending-choice type + queue:** `PendingSmashDiscard` interface + `pendingSmashDiscards?:
  PendingSmashDiscard[]` on `LegendaryGameState` (`types.ts`), in the existing `pending*`
  block.
- **Resolve move:** new `moves/smashDiscard.resolve.ts` exporting `resolveSmashDiscard` +
  the `hasPendingSmashDiscard(G)` predicate. Discard-arm `{ cardId }`: validate `cardId` is
  in the active player's hand, move it to discard via `zoneOps`, grant `+magnitude` attack
  to `G.turnEconomy`, pop the front queue entry. Decline-arm `{ decline: true }`: pop the
  front entry, no grant. Illegal until a `PendingSmashDiscard` is parked for the active
  player. Registered in `game.ts` as a server-only move (`client: false`).
- **Block-all guard:** `hasPendingSmashDiscard(G)` added to the `game.ts` turn-end guard
  block (alongside `hasPendingOptionalKoReward`), so no other move proceeds until every
  parked Smash choice resolves.
- **UIState projection (five-step):** `UIPendingSmashDiscard` type (`uiState.types.ts`),
  built from the FRONT queue entry with the eligible hand list recomputed fresh
  (`uiState.build.ts`), passed through `filterUIStateForAudience` active-player-scoped
  (`uiState.filter.ts`), re-exported from `index.ts`; audience-filter test + Play
  Diagnostics `uiStateSnapshot` check.
- **Client prompt:** `SmashDiscardPrompt.vue` (modelled on `OptionalKoRewardPrompt.vue`) —
  renders for the active viewer only, lists eligible hand cards to discard, submits
  `resolveSmashDiscard({ cardId })` or `{ decline: true }`. Wired into `PlayDesktop.vue`,
  `PlayMobile.vue`, `useTurnActions.ts` (block-all tooltip), `uiMoveName.types.ts`, and
  `diagnostics/effectProvenance.ts`.
- **Bot / sim:** `ai.legalMoves.ts` short-circuit that emits `resolveSmashDiscard` using a
  deterministic `selectDefaultSmashDiscardTarget` (Locked Values), with `resolveSmashDiscard`
  added to `SIMULATION_MOVE_NAMES`. The drift-pinned invariant
  (`simulation.moveDispatch.drift.test.ts`, the WP-286 / D-24073 within-turn-hang guard) then
  requires `resolveSmashDiscard` to be a `MOVE_MAP` key in **both** `simulation.runner.ts` AND
  `par.aggregator.ts` (the `resolveOptionalKoReward` / `resolveDrawOrEmpowered` precedent —
  each touched all three sim files). Server autoplay drains it generically via `getLegalMoves`.
- **Card data (GENERATED):** add a `smash:N` arm to `apply-hero-ability-markers.mjs`
  `VALID_TOKEN_PATTERN`; author markers normalising the wwhk Smash text
  `[keyword:Smash N]` → `[keyword:smash:N]` in `hero-ability-markers.json`, preserving the
  two-separate-`abilities[]`-entries shape for Hurl Trucks (Locked Values); regenerate
  `wwhk.json`.
- **Coverage regen:** `ledger:heroes` (smash flips `unsupported`/`unrecognized`→`executable`),
  `effect-index`, `mechanics:metadata`, `sim:runtime-observed`; add a `mechanic-provenance.json`
  row `smash → WP-676 / D-24492`.
- **Tests:** parser (a `smash:N` line → a smash hook with magnitude; two lines → two hooks),
  park handler (empty hand no-op; parks N entries), resolve move (discard grants +N and pops;
  decline pops with no grant; illegal without a parked choice), block-all, UIState
  audience-filter, and the client prompt.

## Out of Scope

- **Any other unimplemented mechanic co-printed on a Smash card.** If a wwhk card prints
  Smash alongside a still-hollow mechanic, only the Smash portion is wired; the other stays
  an honest inner hollow (D-24464 posture). This WP does not implement `[keyword:Transform]`,
  scry, or any non-Smash keyword.
- **Non-hero Smash.** No Villain/Mastermind uses Smash; nothing outside `wwhk.json`.
- **Bare magnitude-less `[keyword:Smash]` verb tokens.** Two wwhk cards print a
  magnitude-less `[keyword:Smash]` as a verb inside a co-printed conditional-KO clause
  (`wwhk.json` "If you `[keyword:Smash]` a Wound this way, KO it" / "…a 0-cost Hero this
  way, KO it"). The marker normalisation targets ONLY the with-magnitude `[keyword:Smash N]`
  grant form; a bare `[keyword:smash]` carries no magnitude, so it safe-skips at the
  `executeSingleEffect` magnitude pre-gate (no park, no freeze) and stays an honest
  unresolved marker (the co-printed conditional-KO is a separate hollow, D-24464 posture).
  The normalisation regex must not lowercase the bare verb into a spurious `smash` hook.
- **Generalising the pending-choice framework.** The queue, move, and prompt are
  Smash-specific, modelled on optional-ko-reward; no shared abstraction is extracted (fewer
  than three consumers — code-style §16.1).

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — add `'smash'` to the
  `HeroKeyword` union + `HERO_KEYWORDS` array (lockstep).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `HANDLED_KEYWORDS`
  + `HERO_EFFECT_HANDLERS` add `smash`; new `heroEffectSmash` park handler +
  `selectDefaultSmashDiscardTarget`; NOT in `NO_MAGNITUDE_KEYWORDS`.
- `packages/game-engine/src/types.ts` — **modified** — `PendingSmashDiscard` interface +
  `pendingSmashDiscards?` queue field.
- `packages/game-engine/src/moves/smashDiscard.resolve.ts` — **new** — `resolveSmashDiscard`
  + `hasPendingSmashDiscard`.
- `packages/game-engine/src/game.ts` — **modified** — import + moves-map entry (server-only)
  + block-all guard.
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIPendingSmashDiscard`.
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — build the projection from
  the front queue entry.
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — active-player pass-through.
- `packages/game-engine/src/index.ts` — **modified** — re-export `UIPendingSmashDiscard`.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — bot short-circuit +
  `resolveSmashDiscard` in `SIMULATION_MOVE_NAMES`.
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** —
  `resolveSmashDiscard` import + `MOVE_MAP` entry (the drift-pinned dual-dispatch invariant).
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** —
  `resolveSmashDiscard` import + `MOVE_MAP` entry (mirrors the runner; same invariant).
- `apps/arena-client/src/components/play/SmashDiscardPrompt.vue` — **new** — the prompt.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — import/register/render.
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — import/register/render.
- `apps/arena-client/src/composables/useTurnActions.ts` — **modified** — block-all tooltip.
- `apps/arena-client/src/components/play/uiMoveName.types.ts` — **modified** — move name.
- `apps/arena-client/src/diagnostics/effectProvenance.ts` — **modified** — provenance row.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — `smash:N` token arm.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — wwhk Smash markers.
- `data/cards/wwhk.json` — **modified (generated)** — regenerated Smash markers.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/mechanic-provenance.json` — **modified (generated / provenance row)**.
- Test files paired with each engine/client source above — **new/modified**.

> The engine + client + card-data + generated-artifact surface is broad (~20 hand-edited
> files) but it is **one** WP, not a split: a block-all pending choice without its client
> prompt **freezes the game** ([[project_pending_choice_no_ux_freeze]]), so the engine park
> and the client renderer must ship together. This is the WP-675 / draw-or-empowered
> precedent (a pending-choice hero mechanic is one cross-layer WP).

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new or modified file — no diffs, no snippets, no "show only
  the changed section."
- ESM only; Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no `Math.random()`, no wall-clock, no I/O in moves/handlers; all zone
  mutations via `zoneOps` helpers; moves never throw (validate → return `void`).
- `G` stores `CardExtId` strings only; no card objects in the pending entry.

**Packet-specific:**
- `smash` carries a magnitude → it MUST NOT be added to `NO_MAGNITUDE_KEYWORDS`.
- The `HeroKeyword` union and `HERO_KEYWORDS` array change in lockstep; the drift pin is a
  RUNTIME assertion (D-24372), not a bare `satisfies`.
- The block-all pending choice MUST have its UIState projection AND client prompt before it
  ships (freeze prevention) — the five-step Board-Visible Field contract is binding.
- The resolve move is server-only (`client: false`); the client submits intent, never the
  outcome.
- Card data via marker SOURCE + reproducible regen; `cards:check` must confirm byte
  reproducibility. Never hand-edit `data/cards/wwhk.json`.

**Session protocol:** if the two-Smash-instance parse (below) cannot be satisfied by the
two-separate-`abilities[]`-entries shape, STOP and raise it before authoring markers —
do not silently collapse the two discards into one.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- **Marker form:** `[keyword:smash:N]`, `N` ∈ {1,2,3,4,5}. The parser slug capture is
  `[a-zA-Z][a-zA-Z-]*` (letters/hyphens only — no digit), so the magnitude rides the
  `:N` colon-segment; `[keyword:Smash N]` (capital-S, space) does NOT parse and is the
  inert form being replaced.
- **Two independent discards:** two Smash instances are authored as **two separate
  `abilities[]` array entries** (two hooks → two `PendingSmashDiscard` entries). A single
  ability line carrying two identical `[keyword:smash:2]` tokens would be **collapsed to one**
  by the parser's `uniqueKeywords` dedup — that form is forbidden for multi-Smash cards.
- **`heroEffectSmash(G, playerID, magnitude, …)`** parks `PendingSmashDiscard { playerID,
  magnitude }`; a no-op (logged) when the player's hand is empty.
- **`resolveSmashDiscard({ cardId })`** validates `cardId` ∈ active hand, moves it to
  discard, adds `magnitude` to `G.turnEconomy.attack`, pops the front entry.
  **`resolveSmashDiscard({ decline: true })`** pops the front entry with no grant. Illegal
  until a `PendingSmashDiscard` is parked for the active player.
- **`selectDefaultSmashDiscardTarget(G, playerID)`** (bot/sim): discard the lowest-`cost`
  hand card (`CardExtId` ascending tie-break, discard-before-nothing — the
  `selectDefaultOptionalKoTarget` convention); decline only when the hand is empty.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity — card data / content semantics), §2, §10.
- **No conflict:** this WP preserves all touched clauses — it makes a printed ability
  resolve exactly as the physical card reads.
- **Non-Goal proximity:** NG-1 (no pay-to-win) is not crossed — Smash is a printed hero
  ability available to any player who drafts the card; nothing is bought.
- **Determinism preservation:** the mechanic is fully deterministic and replay-faithful —
  the choice is the player's, recorded as an ordinary move in the boardgame.io log; no RNG.
  The new `pendingSmashDiscards?` field is optional and absent for any game with no parked
  Smash choice, so a non-Smash game (including the core sentinels) serializes byte-identically
  → **no `finalStateHash` re-pin.** The wwhk card-data regen changes wwhk matches' parsed
  abilities (intended — the fix changes behavior); Seed-PAR is scheme-keyed and hero-agnostic
  (unaffected), and no committed wwhk replay oracle exists.

## Funding Surface Gate

N/A — no funding surface: this WP touches no global-nav / registry-viewer / profile funding
affordance, no tournament funding channel, and no user-visible "donate"/"support" copy. It
implements a hero card ability only.

## API Catalog Update

N/A — no HTTP endpoints touched and no `apps/server/src/**` library function added or
modified. `resolveSmashDiscard` is a boardgame.io move (an engine surface), not an HTTP or
`Library-only` catalog surface.

## Acceptance Criteria

1. Playing a `[keyword:smash:N]` card parks a `PendingSmashDiscard` for the active player,
   and the game blocks all other moves until it resolves.
2. Playing Hurl Trucks (two Smash 2 entries) parks **two** pending choices resolved
   independently; discarding on both grants +4 attack, declining both grants +0. (Hurl
   Trucks is a Transform target — `isTransform`, cost 6, `transformOf: hurl-legal-objections`;
   the test fixture reaches it in play via the shipped Transform route, WP-658, not by
   drafting it directly.)
3. `resolveSmashDiscard({ cardId })` moves the named hand card to discard and adds exactly
   `N` to `G.turnEconomy.attack`; `{ decline: true }` grants 0 and discards nothing.
4. `resolveSmashDiscard` is rejected (silent `void`) when no `PendingSmashDiscard` is parked,
   or when `cardId` is not in the active player's hand.
5. `heroEffectSmash` on an empty hand parks nothing and logs a neutral no-op (no freeze).
6. `UIPendingSmashDiscard` is present in the active player's UIState and absent for other
   audiences; it survives `filterUIStateForAudience` and appears in the Play Diagnostics
   `uiStateSnapshot`.
7. `SmashDiscardPrompt.vue` renders for the active viewer, lists eligible hand cards, and
   dispatches `resolveSmashDiscard`; the client never computes the attack grant.
8. `HERO_KEYWORDS` length pin and `HERO_EFFECT_HANDLERS` count pin are updated in lockstep;
   both drift tests pass as RUNTIME assertions.
9. `cards:check` confirms `wwhk.json` regenerates byte-identically from the markers; the
   hero-mechanic ledger shows `smash` `executable`.
10. Engine + arena-client suites green; `pnpm -r build` exits 0; `finalStateHash` sentinels
    byte-unchanged (no re-pin).

## Verification Steps

- `pnpm --filter @legendary-arena/game-engine build` — exits 0.
- `pnpm --filter @legendary-arena/game-engine test` — all green, including the new
  smash parser/handler/resolve/UIState tests and the updated drift pins.
- `pnpm --filter @legendary-arena/arena-client typecheck` — exits 0 (`vue-tsc --noEmit`;
  build/test do not type-check).
- `pnpm --filter @legendary-arena/arena-client test` — green, including `SmashDiscardPrompt`.
- `pnpm -r build && pnpm ledger:heroes && pnpm effect-index` then `pnpm ledger:heroes:check`
  + `pnpm effect-index:check` — exit 0; `smash` row reads `executable`.
- `pnpm cards:check` — `wwhk.json` reproduces byte-identically from the marker source.
- `pnpm sim:runtime-observed:check` — exits 0, no regeneration (artifact current).
- Confirm the two engine hash-pin tests pass unchanged (no `finalStateHash` re-pin).

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client suites green; `pnpm --filter @legendary-arena/arena-client
      typecheck` exits 0; `pnpm -r build` exits 0.
- [ ] `cards:check` reproducible; `ledger:heroes` / `effect-index` / `mechanics:metadata` /
      `sim:runtime-observed` regenerated and `:check` green; `mechanic-provenance.json` row
      added.
- [ ] `finalStateHash` sentinels byte-unchanged (no re-pin), confirmed by a clean run.
- [ ] **Live-on-surface verification (D-24026):** a real match on play.legendary-arena.com
      plays a Smash card, the discard prompt appears, and the chosen discard grants +N
      attack — with observable evidence (not tests + merge alone).
- [ ] `docs/ai/STATUS.md` updated with what changed.
- [ ] `docs/ai/DECISIONS.md` D-24492 flipped to Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph → `✅`, then `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified.

## Reserved Decision (lands at execution)

D-24492 — the Smash keyword as a handler-bearing `HeroKeyword` with a magnitude, resolved
through a per-instance optional-discard pending choice (the optional-ko-reward / D-24069
pending-choice precedent); the marker normalisation `[keyword:Smash N]` → `[keyword:smash:N]`;
and the two-separate-`abilities[]`-entries rule for multi-Smash cards. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

- **§1 structure:** all required sections present (Goal, Assumes, Context (Read First),
  Scope (In), Out of Scope, Files Expected to Change, Non-Negotiable Constraints, Acceptance
  Criteria, Verification Steps, Definition of Done); Out of Scope excludes ≥2 related things
  (co-printed hollows; framework generalisation). **PASS.**
- **§2 constraints:** engine-wide (full files, ESM, determinism) + packet-specific + session
  protocol + locked-value pointer; references 00.6. Partial output forbidden. **PASS.**
- **§3 Assumes / §4 Context:** every dependency file + decision cited specifically; 00.2 and
  ARCHITECTURE §UIState + Layer Boundary listed. **PASS.**
- **§5 files:** every file listed with new/modified + description; the ~20 hand-edited count
  is justified inline (indivisible pending-choice, WP-675 precedent). **PASS.**
- **§6 naming:** `CardExtId`, `ext_id`, zone names, `turnEconomy` per 00.2. **PASS.**
- **§7 deps:** no new npm dependency. **PASS.**
- **§8 boundaries:** engine decides / client renders; move is server-only; no upward import.
  **PASS.**
- **§9 Windows / §10 env:** `pnpm` commands only; no new env var. **PASS.**
- **§11 auth:** N/A — no authentication surface.
- **§12 tests:** `node:test`; no boardgame.io import in helpers; deterministic. **PASS.**
- **§13 verification / §14 acceptance / §15 DoD:** exact `pnpm` commands with expected
  results; 10 binary observable criteria; DoD includes STATUS/DECISIONS/WORK_INDEX + the
  D-24026 live-on-surface item (surface ≠ infrastructure). **PASS.**
- **§16 code-style:** no premature abstraction (Smash-specific, not generalised); explicit
  control flow; `// why:` on the magnitude-gate exclusion and the block-all guard. **PASS.**
- **§17 Vision:** `## Vision Alignment` present with clause numbers (§1/§2/§10), no-conflict
  assertion, NG-1 proximity line, determinism-preservation line. **PASS.**
- **§18 prose-vs-grep:** no literal-string-scoped forbidden-token grep in verification. **PASS.**
- **§20 funding / §21 API catalog:** N/A with named justification (above). **PASS.**
