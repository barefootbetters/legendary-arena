# WP-702 — Reveal-top discard-or-keep hero keyword (Cross-layer — Game Engine + Arena Client)

**Status:** Draft 2026-09-16 (EC-739; D-24521 reserved)
**Layer:** Game Engine (parse + runtime + pending choice + UIState) + Arena Client (choice UI)
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** D-24512 (Ruthless Dictator `resolveRuthlessDictatorChoice` — snapshot + sequential per-revealed-card disposition on the own deck, the `discard`/`top` template) ✅, D-24413 (Melter `ko-cullable-each-deck-top` — each-deck snapshot-and-park) ✅, D-24354/D-24280 (heroClassMatch `[hc:X]` condition gate) ✅, D-24518 (vanquish drops parked pending-choice queues) ✅

## Goal

Implement the interactive **reveal-top discard-or-keep** disposition so Gambit's **Hypnotic
Charm** (core) and the standalone "Reveal / Look at the top card of your deck. Discard it or put
it back." family resolve. The active player reveals their own deck's top card and chooses to
**discard it** or **keep it on top** (a no-op); Hypnotic Charm's `[hc:instinct]:` clause applies
the same disposition to **each other** player's deck, with the active player deciding each.
After this WP, playing one of these cards presents a "discard it or put it back" prompt instead
of silently doing nothing.

## User-Visible Impact

`play.legendary-arena.com` — playing a reveal-top-dispose card reveals the deck's top card and
prompts "discard it or put it back"; the choice is the active player's. Hypnotic Charm with the
instinct synergy met additionally reveals + disposes each other player's deck top. Purely a
fidelity fix (a printed ability that today does nothing begins to resolve), reusing the shipped
pending-choice framework (`PendingRuthlessDictatorChoicePrompt.vue` / `PendingMelterKoChoicePrompt.vue`
are the structural models). Live-on-surface is operator-pending (D-24026).

## Assumes

- **`packages/game-engine/src/types.ts`** carries `PendingRuthlessDictatorChoice` +
  `RuthlessDictatorDisposition = 'ko'|'discard'|'top'` and `PendingMelterKoChoice` +
  `MelterRevealedTop { ownerPlayerID, cardId }` — the shape models for the new
  `PendingRevealTopDispose` (a snapshot of `{ ownerPlayerID, cardId }[]` + `availableDispositions:
  ['discard','top']`) and its `G.pendingRevealTopDispose?` queue.
- **`packages/game-engine/src/moves/melterKoChoice.resolve.ts`** and **`ruthlessDictatorChoice.resolve.ts`**
  are the resolve-move models: snapshot at park, resolve ONE revealed card per call keyed on
  `{ ownerPlayerID, cardId }`, splice, front-pop when the snapshot empties; `discard` moves the
  owner's deck-top to the owner's discard, `top`/keep is a no-op. Never throw.
- **`packages/game-engine/src/villain/villainEffects.execute.ts`** — `villainEffectKoCullableEachDeckTop`
  (each-deck snapshot, reshuffle-on-empty) is the each-deck-iteration model; the Lizard
  `for (const playerId of Object.keys(G.playerZones).sort()) { if (playerId === currentPlayer) continue; }`
  is the each-OTHER-player skip.
- **`packages/game-engine/src/hero/heroEffects.execute.ts`** exports `HANDLED_KEYWORDS`,
  `NO_MAGNITUDE_KEYWORDS`, `HERO_EFFECT_HANDLERS` (the handler-registration surface).
- **`packages/game-engine/src/rules/heroKeywords.ts`** — the `HeroKeyword` union + `HERO_KEYWORDS`
  array (RUNTIME drift pins — D-24372).
- **`packages/game-engine/src/setup/heroAbility.setup.ts`** parses `[hc:X]` tokens into a
  `heroClassMatch` condition attached to that ability's hook; **Hypnotic Charm's `[hc:instinct]`
  clause is a SEPARATE `abilities[]` entry (`core.json:587`)**, so the condition attaches to that
  entry's hook only — entry 1 (`:586`) is unconditional. `heroConditions.evaluate.ts`
  `case 'heroClassMatch'` gates the each-other hook.
- **`apps/arena-client/src/components/play/PendingMelterKoChoicePrompt.vue`** /
  `PendingRuthlessDictatorChoicePrompt.vue` + their `PlayDesktop.vue` / `PlayMobile.vue` /
  `TurnActionBar.vue` / `useTurnActions.ts` / `uiMoveName.types.ts` / `diagnostics/effectProvenance.ts`
  wiring are the shipped client models.
- **`packages/game-engine/src/moves/fightMastermind.ts`** `dropAllPendingPlayerChoices` (D-24518)
  drops the parked pending queues on a true vanquish — the new queue enrolls.
- **`data/cards/{core,rvlt,dstr,cvwr,gotg,shld,xmen,wwhk,wpnx}.json` are GENERATED.** Markers are
  authored in `scripts/convert-cards/inputs/hero-ability-markers.json` + applied by
  `apply-hero-ability-markers.mjs`; never hand-edited.
- Baseline: `origin/main` at the D-24521 reserve. **Drift pins at HEAD: `HERO_KEYWORDS` = 55,
  `HERO_EFFECT_HANDLERS`/`HANDLED_KEYWORDS` = 40, `game.test.ts` move count = 40.**

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` — the reveal-top / look-top disposition primitive.
- `docs/ai/DECISIONS.md` — D-24512 (Ruthless Dictator disposition), D-24413 (Melter each-deck),
  D-24280/D-24354 (heroClassMatch), D-24518 (vanquish drop), D-24372 (RUNTIME drift pins).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary + §Principle #2; `.claude/rules/architecture.md
  §UIState Projection Integrity` (five-step Board-Visible Field contract).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — canonical field names (`ext_id`/`CardExtId`, zones).

## Scope (In)

- **Two keywords (both NO_MAGNITUDE):**
  - `reveal-top-dispose` — the active player's OWN deck. Snapshot `deck[0]` (reshuffle on empty
    via `ctx.random`), park a `PendingRevealTopDispose { playerID: active, revealedTops: [{owner:
    active, deck[0]}], availableDispositions: ['discard','top'] }`. Covers the 11 standalone cards
    + Hypnotic Charm entry 1.
  - `reveal-top-dispose-others` — EACH OTHER player's deck (`Object.keys(playerZones).sort()`,
    skip `currentPlayer`). Snapshot each other deck's top → park a `PendingRevealTopDispose` whose
    `revealedTops` is the (seats−1) other tops, the active player disposing each. Hypnotic Charm
    entry 2 ONLY; the `[hc:instinct]` gate rides its separate-entry hook (no gate code). Degenerate
    solo game (no other seats) → park nothing (logged no-op).
- **Keyword registration:** add both to the `HeroKeyword` union + `HERO_KEYWORDS` array (lockstep,
  RUNTIME pin 55→57); `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` (40→42); both in
  `NO_MAGNITUDE_KEYWORDS`.
- **Handlers:** `heroEffectRevealTopDispose` (own deck) + `heroEffectRevealTopDisposeOthers`
  (each other). Both snapshot (do NOT remove) the deck top and park; an empty snapshot (no other
  seats / no cards) is a logged no-op.
- **Pending type + queue:** `RevealTopDisposition = 'discard'|'top'`, `RevealedTopEntry {
  ownerPlayerID, cardId }`, `PendingRevealTopDispose { choiceType:'reveal-top-dispose', playerID,
  revealedTops[] }` + `G.pendingRevealTopDispose?` (types.ts), lazily initialized at the park site.
- **Resolve move:** `moves/revealTopDispose.resolve.ts` — `resolveRevealTopDispose({ ownerPlayerID,
  cardId, disposition })` + `hasPendingRevealTopDispose(G)`. Resolve ONE revealed card per call
  (round-trip keyed on `{ ownerPlayerID, cardId }`): `discard` → move the owner's `deck[0]` to the
  owner's discard (that exact card, still on top); `top` → no-op (kept). Splice the entry; front-pop
  when `revealedTops` empties. Server-only (`client:false`); silent `void` on any invalid state.
- **Block-all guard:** `hasPendingRevealTopDispose(G)` replicated at every action-move site (the
  `hasPendingMelterKoChoice` set — `coreMoves.impl.ts` ×3, `game.ts`, `villainDeck.reveal.ts`,
  `dodgeCard`, `fightMastermind`, `fightVillain`, `healWounds`, `recruitOfficer`, `recruitHero`)
  + the bot short-circuit in `ai.legalMoves.ts`.
- **Vanquish-drop (D-24518):** `pendingRevealTopDispose` added to `dropAllPendingPlayerChoices`
  + its drift test.
- **UIState five-step:** `UIRevealedTopEntry` + `UIPendingRevealTopDispose` (uiState.types.ts),
  built from the FRONT queue entry with display resolved (uiState.build.ts), chooser-only
  pass-through (uiState.filter.ts), re-export (index.ts); audience-filter test + diagnostics
  snapshot.
- **Client prompt:** `PendingRevealTopDisposePrompt.vue` (model on `PendingMelterKoChoicePrompt.vue`)
  — renders for the active viewer, lists the revealed top(s) with a Discard / Keep-on-top choice
  each, submits `resolveRevealTopDispose`. Wired into `PlayDesktop.vue`, `PlayMobile.vue`,
  `TurnActionBar.vue`, `useTurnActions.ts`, `uiMoveName.types.ts`, `diagnostics/effectProvenance.ts`.
- **Bot / sim:** `ai.legalMoves.ts` short-circuit emitting `resolveRevealTopDispose` with a
  deterministic default (`selectDefaultRevealTopDisposition`: keep-on-top for a Hero, discard for
  Wound/low-value — Locked Values); `SIMULATION_MOVE_NAMES` + `MOVE_MAP` in BOTH `simulation.runner.ts`
  and `par.aggregator.ts`.
- **Card data (GENERATED):** add token arms for `[keyword:reveal-top-dispose]` +
  `[keyword:reveal-top-dispose-others]` to `apply-hero-ability-markers.mjs`; author markers on the
  11 standalone base instances (attach to the "Reveal/Look the top card…" line; for the wpnx SPLIT
  form attach to the first "Look at the top card of your deck." entry) + Hypnotic Charm entry 2
  (`reveal-top-dispose-others`, alongside its existing `[hc:instinct]` gate token). Regenerate the
  9 sets.
- **Coverage regen:** `ledger:heroes` (both keywords → `executable`), `effect-index`,
  `mechanics:metadata`, `sim:runtime-observed`; `mechanic-provenance.json` rows.
- **Tests:** parser (a marked line → the keyword hook; the [hc:instinct] entry gates on
  heroClassMatch), handlers (own-deck snapshot+park; each-other snapshot+park; solo/empty no-op),
  resolve move (discard moves owner deck-top to owner discard; keep no-ops; front-pop; illegal
  cases), block-all, vanquish-drop, UIState audience-filter, client prompt.

## Out of Scope

- **The reveal-for-attack family** (`co2e` reveal-cost-attack, `2099` reveal-attack-choose) — the
  trailing "Discard it or put it back" there is NOT double-marked: under those keywords the revealed
  deck top defaults to KEEP (reveal-cost-attack leaves the deck top in place — its test asserts deck
  identity preserved), so the interactive discard option is simply not offered. Marking it again would
  park a redundant dispose choice over the attack grant. (Pre-flight RS-2.)
- **The conditional reveal-draw-else-dispose card** (`co2e:482` supernatural-senses-adjacent: "Reveal
  the top card of your deck. If it's an [team:x-men] Hero, draw it. Otherwise, discard it or put it
  back.") — a compound-conditional primitive, NOT one of the 11 standalone "Discard it or put it back"
  lines. Its disposition is gated on a class test the reveal-top-dispose keyword does not model.
  Correctly excluded (markers are authored by explicit card list, so it is never picked up). (Pre-flight RS-1.)
- **The bottom-card variant** (`fear` "Look at the bottom card…") — a different primitive.
- **Public-vs-private reveal distinction** — "Reveal" and "Look at" resolve identically (the
  disposition is the same top-card keep-or-discard); no engine primitive reads the difference. The
  prompt copy may say "the top card of your deck" neutrally.
- **A shared abstraction with Melter/Ruthless Dictator** — the queue/move/prompt are
  reveal-top-dispose-specific, modelled on those precedents; no generalisation (code-style §16.1).

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — two keywords (union + array).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `HANDLED_KEYWORDS` +
  `HERO_EFFECT_HANDLERS` + `NO_MAGNITUDE_KEYWORDS`; `heroEffectRevealTopDispose` +
  `heroEffectRevealTopDisposeOthers` + `selectDefaultRevealTopDisposition`.
- `packages/game-engine/src/types.ts` — **modified** — `RevealTopDisposition` / `RevealedTopEntry`
  / `PendingRevealTopDispose` + queue field.
- `packages/game-engine/src/moves/revealTopDispose.resolve.ts` — **new** — resolve + predicate.
- `packages/game-engine/src/game.ts` — **modified** — import + move entry (server-only) + block-all guard.
- `packages/game-engine/src/moves/{coreMoves.impl,fightVillain,fightMastermind,recruitHero,
  recruitOfficer,healWounds,dodgeCard}.ts` + `villainDeck/villainDeck.reveal.ts` — **modified** —
  block-all guard.
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — `dropAllPendingPlayerChoices`
  gains the new queue (D-24518).
- `packages/game-engine/src/game.test.ts` — **modified** — move-registration pin (40→41).
- `packages/game-engine/src/ui/uiState.{types,build,filter}.ts` + `index.ts` — **modified** — five-step.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` + `simulation.runner.ts` + `par.aggregator.ts`
  — **modified** — bot short-circuit + `SIMULATION_MOVE_NAMES` + both `MOVE_MAP`s.
- `apps/arena-client/src/components/play/PendingRevealTopDisposePrompt.vue` — **new** — the prompt.
- `apps/arena-client/src/pages/PlayDesktop.vue`, `pages/PlayMobile.vue`,
  `components/play/TurnActionBar.vue`, `composables/useTurnActions.ts`,
  `components/play/uiMoveName.types.ts`, `diagnostics/effectProvenance.ts` — **modified** — wiring.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — two token arms + detector.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 11 base + 1 each-other markers.
- `data/cards/{core,rvlt,dstr,cvwr,gotg,shld,xmen,wwhk,wpnx}.json` — **modified (generated)** — regenerated.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/mechanic-provenance.json` — **modified (generated / provenance)**.
- Paired `*.test.ts` for each engine/client source above — **new/modified**.

> ~30 hand-edited files — broad, but ONE WP: a block-all pending choice without its client prompt
> freezes the game ([[project_pending_choice_no_ux_freeze]]), so the engine park + client renderer
> ship together (the WP-603 Melter / WP-695 Ruthless Dictator precedent). Exact allowlist in the EC.

## Non-Negotiable Constraints

- Full file contents for every new/modified file; ESM; Node v22+; human-style code.
- Determinism: the reveal's reshuffle-on-empty uses `ctx.random.*` via the shared shuffle; no
  `Math.random()`; moves never throw (validate → `void`); zone moves via `zoneOps`.
- `G` stores `CardExtId` strings only; the pending entry carries `{ ownerPlayerID, cardId }` strings.
- Both keywords carry no magnitude → BOTH in `NO_MAGNITUDE_KEYWORDS`.
- The `HeroKeyword` union + `HERO_KEYWORDS` array change in lockstep; RUNTIME drift pins (D-24372).
- The block-all pending choice ships WITH its UIState projection AND client prompt (freeze
  prevention — five-step Board-Visible Field contract).
- The new queue enrolls in the D-24518 vanquish-drop set.
- The resolve move is server-only (`client:false`); the client submits intent, never the outcome.
- Card data via marker SOURCE + reproducible regen; `cards:check` byte-reproducible. Never hand-edit.

**Session protocol:** if the wpnx SPLIT disposition (two `abilities[]` strings) cannot be marked on
a single hook without changing the parser's per-entry model, STOP and raise it before authoring
markers — do not silently merge the two entries.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `PendingRevealTopDispose { choiceType:'reveal-top-dispose', playerID, revealedTops:
  { ownerPlayerID, cardId }[] }`; `RevealTopDisposition = 'discard'|'top'`.
- `heroEffectRevealTopDispose(G, ctx, playerID, cardId, effect)` — snapshot the active player's
  `deck[0]` (reshuffle-on-empty), park one entry; empty deck+discard → logged no-op.
- `heroEffectRevealTopDisposeOthers(G, ctx, playerID, cardId, effect)` — snapshot each OTHER
  seat's `deck[0]` (skip `currentPlayer`), park one entry with those tops; no other seats → no-op.
- `resolveRevealTopDispose({ ownerPlayerID, cardId, disposition })` — validate the entry is in the
  front snapshot and `cardId` is still `deck[0]` of `ownerPlayerID`; `discard` → deck-top → owner
  discard; `top` → no-op; splice; front-pop when empty. Illegal (silent `void`) otherwise.
- `selectDefaultRevealTopDisposition(G, ownerPlayerID, cardId)` (bot/sim): `discard` a Wound or a
  basic S.H.I.E.L.D. starter, else `top` (keep) — deterministic, mirrors `selectScryKoTarget` tiers.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §10.
- **No conflict:** makes a printed ability resolve exactly as the card reads.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — a printed hero ability, nothing bought.
- **Determinism preservation:** deterministic and replay-faithful — the reveal/reshuffle uses
  `ctx.random.*`; the disposition is the player's choice recorded as an ordinary move. The
  `pendingRevealTopDispose?` field is optional and absent for any game that never plays one of
  these cards, so a non-reveal-top-dispose game (incl. the core `finalStateHash` sentinels — verify
  none play these cards) serializes byte-identically → **no `finalStateHash` re-pin**. The
  card-data regen changes the 11 cards' parsed abilities (intended). Seed-PAR is scheme-keyed and
  hero-agnostic.

## Funding Surface Gate

N/A — no funding surface. A hero card ability only.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched. `resolveRevealTopDispose` is a
boardgame.io move (an engine surface).

## Acceptance Criteria

1. Playing a `reveal-top-dispose` card reveals the active player's deck top and parks a
   `PendingRevealTopDispose` (1 revealed top, owner = active); the game blocks other moves until it
   resolves.
2. `resolveRevealTopDispose({ disposition:'discard' })` moves that exact deck-top card to the
   owner's discard; `{ disposition:'top' }` leaves it on top (no-op); the entry is resolved and the
   queue front-pops when empty.
3. Playing Hypnotic Charm with `[hc:instinct]` satisfied (another instinct Hero in play) ALSO parks
   a `reveal-top-dispose-others` choice with each other seat's deck top; without the instinct
   Hero, only the own-deck choice parks (entry 2 gated out).
4. A solo game (no other seats) parks nothing for the each-other clause (logged no-op).
5. `resolveRevealTopDispose` is rejected (silent `void`) with no parked choice, a stale card
   (no longer `deck[0]`), or a wrong `{ ownerPlayerID, cardId }`.
6. `UIPendingRevealTopDispose` is present for the active player and absent for other audiences;
   survives `filterUIStateForAudience`; appears in the Play Diagnostics `uiStateSnapshot`.
7. `PendingRevealTopDisposePrompt.vue` renders for the active viewer, lists the revealed top(s)
   with Discard / Keep, and dispatches `resolveRevealTopDispose`; the client never mutates a deck.
8. A mastermind vanquish drops a parked `PendingRevealTopDispose` (D-24518).
9. `HERO_KEYWORDS` 55→57, `HERO_EFFECT_HANDLERS` 40→42, `game.test.ts` moves 40→41 — RUNTIME pins.
10. `cards:check` reproduces the 9 sets byte-identically; the ledger shows both keywords `executable`.
11. Engine + arena-client suites green; `pnpm --filter @legendary-arena/arena-client typecheck`
    exits 0; `pnpm -r build` exits 0; `finalStateHash` sentinels byte-unchanged (no re-pin).

## Verification Steps

- `pnpm --filter @legendary-arena/game-engine build` — exits 0.
- `pnpm --filter @legendary-arena/game-engine test` — green (parser/handlers/resolve/UIState/
  vanquish-drop + drift pins).
- `pnpm --filter @legendary-arena/arena-client typecheck` + `test` — exits 0 / green.
- `pnpm -r build && pnpm ledger:heroes && pnpm effect-index` then the `:check` variants — exit 0;
  both keyword rows `executable`.
- `pnpm cards:check` — the 9 sets reproduce byte-identically.
- `pnpm sim:runtime-observed:check` — exits 0 (regenerate + commit if the sweep shifts).
- Confirm the engine hash-pin tests pass unchanged (no `finalStateHash` re-pin).

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client suites green; `typecheck` 0; `pnpm -r build` 0.
- [ ] `cards:check` reproducible; `ledger:heroes` / `effect-index` / `mechanics:metadata` /
      `sim:runtime-observed` regenerated + `:check` green; `mechanic-provenance` rows added.
- [ ] `finalStateHash` sentinels byte-unchanged (no re-pin), confirmed by a clean run; if the
      sim sweep shifts, `sim:runtime-observed` + the dashboard in-play coverage pin re-pinned honestly.
- [ ] **Live-on-surface (D-24026):** a real match plays a reveal-top-dispose card, the prompt
      appears, and Discard / Keep resolve correctly.
- [ ] `docs/ai/STATUS.md` updated; `DECISIONS.md` D-24521 → Active; `WORK_INDEX.md` checked off;
      `05-ROADMAP-MINDMAP.md` node ✅ + `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified.

## Reserved Decision (lands at execution)

D-24521 — the reveal-top discard-or-keep disposition as two handler-bearing `HeroKeyword`s
(`reveal-top-dispose` own-deck; `reveal-top-dispose-others` each-other-deck, `[hc:instinct]`-gated),
sharing one `PendingRevealTopDispose` snapshot queue + `resolveRevealTopDispose` move (the Ruthless
Dictator `discard`/`top` + Melter each-deck precedent); "Reveal" and "Look at" resolve identically;
reveal-for-attack and bottom-card variants out of scope. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

- **§1 structure / §2 constraints:** all sections; Out of Scope excludes ≥2 (reveal-for-attack;
  bottom-card; public/private; framework generalisation); full-files/determinism/session-protocol. **PASS.**
- **§3 Assumes / §4 Context:** every dependency file + decision cited; ARCHITECTURE §UIState + 00.2. **PASS.**
- **§5 files:** every file new/modified with role; ~30-file count justified inline. **PASS.**
- **§6 naming:** `CardExtId`, `ext_id`, zone names per 00.2. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dep; engine decides / client renders; move server-only. **PASS.**
- **§9/§10/§11:** `pnpm` only; no env var; no auth surface. **PASS.**
- **§12 tests:** `node:test`; no boardgame.io import in helpers; deterministic. **PASS.**
- **§13/§14/§15:** exact `pnpm` commands; 11 observable criteria; DoD has STATUS/DECISIONS/
  WORK_INDEX + D-24026. **PASS.**
- **§16 code-style:** no premature abstraction (reveal-top-dispose-specific); explicit control flow;
  `// why:` on the NO_MAGNITUDE membership, block-all guard, vanquish-drop, each-other skip. **PASS.**
- **§17 Vision:** clause numbers (§1/§2/§10), no-conflict, NG-1 line, determinism line. **PASS.**
- **§18/§20/§21:** no literal-grep verification; funding N/A; API N/A. **PASS.**
