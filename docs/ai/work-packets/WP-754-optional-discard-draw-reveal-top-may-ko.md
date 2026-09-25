# WP-754 — Optional discard-to-draw + reveal-top-may-KO hero keywords (Cross-layer — Game Engine + Arena Client)

**Status:** Draft 2026-09-25 (EC-791; D-24581 reserved)
**Layer:** Game Engine (keywords + handlers + two optional pending-entry fields + resolve-move branches + Excessive Violence context fix + UIState) + Arena Client (two existing prompts)
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** D-24492 (Smash — the `pendingSmashDiscards` queue + `resolveSmashDiscard` + `SmashDiscardPrompt.vue`) ✅, D-24521 + D-24558 (reveal-top-dispose + its optional per-entry `isKoAllowed`) ✅, D-24555 (Digest / Indigestion fusion) ✅, D-24556 (Excessive Violence enroll-at-play / fire-at-fight fusion) ✅, D-24552 (Shenanigans draw lock) ✅, D-24285 (reveal reshuffles an empty deck from the discard) ✅

## Goal

Make two printed hero abilities work, since today they silently do nothing:

- **"You may discard a card. If you do, draw a card."** — optional: discard one hand card, then draw one.
- **"Reveal the top card of your deck. You may KO it."** — reveal the deck top; KO it or leave it on top.

Both are wired through the fusions that already carry them: Hungry for Action's **Digest 3**, and Gruesome Feast's and Remove His Spine's **Excessive Violence**. The same executors also fix five standalone cards that share the wording. The WP also fixes a latent crash on the path of every Excessive Violence ability.

## User-Visible Impact

`play.legendary-arena.com`:

- **Hungry for Action** (vnom, with 3+ cards in the Victory Pile), plus Gritty Scavenger (gotg), Bio-Engineered Cyborg (asrd), GW Bridge (shld) and Risky Science (antm, with a Tech Hero played): the existing Smash prompt opens as "discard a card to draw a card". Discarding draws one card; declining does nothing.
- **Gruesome Feast** (vnom) and **Remove His Spine** (mgtg): fighting with Excessive Violence reveals the top card of the deck and prompts **KO it** or **Keep on top**. There is no Discard option, because the card doesn't print one.
- **Electroshock Therapy** (vill): playing it prompts the same KO-or-keep choice.

Today all eight cards give only their printed resources. Operator-observed live in match `a2e01e70` (2026-09-24):

- Gruesome Feast was played on round 30 and not enrolled for Excessive Violence.
- Hungry for Action was played by both seats on eleven turns, round 32 included, with no applied line ever.

Live-on-surface is operator-pending (D-24026).

## Assumes

Verified at `origin/main` `9a694510` (after the D-24581 reserve `df7ce5a1`):

- **Smash queue (D-24492).** `types.ts` has `PendingSmashDiscard { playerID; magnitude }` at L1026–1031, and the lazy queue `pendingSmashDiscards?` at L1916.
  - `heroEffectSmash` (`hero/heroEffects.execute.ts` L2619–2649) parks `{ playerID, magnitude }`, or logs a no-op when the hand is empty.
  - `moves/smashDiscard.resolve.ts` `resolveSmashDiscard` (L109–166) takes `{ decline: true } | { cardId }`, front entry only:
    - decline logs and shifts;
    - discard goes through the `discardFromHand` chokepoint, whose `found` doubles as the stale check;
    - then `+magnitude` Attack, then shift.
    - It destructures only `{ G, playerID }`.
  - The eligible set is the whole hand (`getEligibleSmashDiscardCards`, L61–70). The played card is already in play when the handler parks, so "a card" and Smash's "another card" select the same set.
  - Bot: `selectDefaultSmashDiscardTarget` (`heroEffects.execute.ts` L5552–5574), dispatched at `simulation/ai.legalMoves.ts` L450–455.
  - UIState: `UIPendingSmashDiscard { playerID; magnitude; eligibleHand }` (`ui/uiState.types.ts` L1408–1414). Build at `uiState.build.ts` L1852–1886; chooser-only filter pass-through at `uiState.filter.ts` L1027–1041.
  - Client: `SmashDiscardPrompt.vue`, whose heading reads "Discard a card for +N attack (Smash)".
  - The block-all guard sites and the winning-turn drop for this queue already exist, and this WP adds no new queue.
- **Reveal-top-dispose queue (D-24521 / D-24558).** `RevealedTopEntry { ownerPlayerID; cardId; isKoAllowed? }` (`types.ts` L649–661), `PendingRevealTopDispose` (L680–687), queue `pendingRevealTopDispose?` (L1939).
  - `revealDeckTopForDispose` (`heroEffects.execute.ts` L2735–2751) snapshots the deck top, reshuffling an empty deck via a `ShuffleProvider`. `parkRevealTopDispose` (L2765–2783) pushes the entry.
  - `resolveRevealTopDispose` (`moves/revealTopDispose.resolve.ts` L104–212):
    - `'ko'` is gated per entry by `isKoAllowed` (L139); `'discard'` is not gated per entry.
    - A card no longer on top resolves as a neutral "moot" clear (L158–168).
    - It destructures only `{ G, playerID }`.
  - The bot's `selectDefaultRevealTopDisposition(cardId, isKoAllowed)` (L236–247) never returns `'discard'` when KO is allowed, so it already fits KO-or-keep.
  - Client: `PendingRevealTopDisposePrompt.vue` shows the Discard and Keep buttons unconditionally, and KO only under `isKoAllowed`.
- **Digest fusion (D-24555).** `DIGEST_INDIGESTION_CARDS` (`setup/heroAbility.setup.ts` L514–520). Its comment at L507–508 names `hungry-for-action` as deferred.
  - `buildDigestIndigestionFusion` (L2994–3063) treats the Indigestion line as optional: Cauldron of the Cosmos is an allowlisted Digest-only card.
  - `heroEffectDigestIndigestion` (`heroEffects.execute.ts` L5040–5080) dispatches branch effects synchronously through the reentrant `executeSingleEffect`. A park from a branch is therefore identical to a direct onPlay park.
  - With no Indigestion line, the below-threshold branch runs nothing **and logs nothing**.
- **Excessive Violence fusion (D-24556).** `EXCESSIVE_VIOLENCE_CARDS` (L555–560); its comment at L551–553 names `carnage/gruesome-feast` as deferred for lack of a reveal-top-may-KO executor.
  - `fireExcessiveViolencePlays` (`heroEffects.execute.ts` L5151–5209) dispatches each enrolled card's inner effects through `executeSingleEffect`. There is no inner-keyword whitelist.
  - Inner effects already park at fight time: Serious Overkill's inner `optional-ko-hand-discard`.
- **Latent Excessive Violence context bug.** `fightVillain` destructures `{ G, ctx, random }` (`moves/fightVillain.ts` L109) and calls `fireExcessiveViolencePlays(G, ctx, …)` with bgio's bare `ctx` (L258). `fightMastermind.ts` does the same at L253.
  - Hero handlers expect the spread move context `playCard` passes (`coreMoves.impl.ts` L335–336: `({ G, playerID, ...context })` → `executeHeroEffects(G, context, …)`), where `random` lives.
  - So any Excessive Violence inner effect that reshuffles an empty deck calls `.random.Shuffle` on `undefined` and throws inside a move. That includes Rending Claws' `draw:1` today and the new reveal.
  - Unit tests pass a `makeMockCtx()` that carries `random`, which masks the bug.
- **Draw accounting.** A resolve-time draw uses `drawCardsIntoHand(zones, n, shuffleProvider)` (`moves/drawCards.logic.ts` L53). It returns the reshuffle count, so the number drawn is the hand-length delta (`doOver.resolve.ts` L130–132).
  - It honours `G.turnEconomy.drawsLocked` (a `[blocked]` log, no draw — `revealThreeAssign.resolve.ts` L201–207).
  - It adds the realized draws to `G.turnEconomy.cardsDrawn` (`revealThreeAssign.resolve.ts` L215).
  - The resolve-move randomness idiom is `{ G, playerID, ...context }` + `context as unknown as ShuffleProvider` (`doOver.resolve.ts` L131). The sim `MOVE_MAP` contexts carry `random`.
- **Keywords.** `rules/heroKeywords.ts` union + `HERO_KEYWORDS` array (L102–170). RUNTIME drift pins at HEAD:
  - `HERO_KEYWORDS` = **67**: `rules/heroKeywords.test.ts` L65–70; `rules/heroAbility.setup.test.ts` ordered `expectedKeywords` (deepStrictEqual) + count (~L631); `setup/heroAbility.setup.test.ts` L1430.
  - `HERO_EFFECT_HANDLERS` = **51**: `heroEffects.execute.test.ts` L114 + L7135.
  - `game.test.ts` moves = 44 — **unchanged**, because no new move is added.
  - Neither new keyword joins the frozen `REVEAL_KEYWORDS` family (the reveal-top-dispose precedent).
- **Card data is GENERATED.** Markers `{ heroSlug, cardSlug, abilityIndex, markupToken }` go in `scripts/convert-cards/inputs/hero-ability-markers.json`, applied by `apply-hero-ability-markers.mjs` (token grammar `VALID_TOKEN_PATTERN` L105).
  - `_deferred` entries exist for vill `electroshock-therapy` (L2161–2166) and vnom `gruesome-feast` (L2192–2199). The other five target lines have no entry at all.
  - `rules/heroAbility.setup.test.ts` L2582–2603 uses **gruesome-feast** as its "not allowlisted" Excessive Violence negative fixture.
- **The eight target lines** (0-based index; all unmarked today):
  - `vnom/venom-rocket/hungry-for-action` [0] `[keyword:Digest 3]: You may discard a card. If you do, draw a card.`
  - `gotg/rocket-raccoon/gritty-scavenger` [0], `asrd/beta-ray-bill/bio-engineered-cyborg` [0], `shld/gw-bridge/gw-bridge` [0] — the plain discard-to-draw line.
  - `antm/ant-man/risky-science` [1] `[hc:tech]: You may discard a card. If you do, draw a card.`
  - `vnom/carnage/gruesome-feast` [0], `mgtg/drax/remove-his-spine` [0] `[keyword:Excessive Violence]: Reveal the top card of your deck. You may KO it.`
  - `vill/electro/electroshock-therapy` [1] `Reveal the top card of your deck. You may KO it.`

If any is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/ai/DECISIONS.md`: D-24492 (Smash), D-24521 §6 (synchronous siblings snapshot the same top), D-24558 (per-entry optional disposition, omit-when-absent), D-24555, D-24556, D-24552, D-24285, D-24081 (`G.messages` is hash-excluded), D-24372 (RUNTIME drift pins).
- `docs/ai/ARCHITECTURE.md` §Layer Boundary + Principle #2; `.claude/rules/architecture.md` §UIState Projection Integrity (the five-step contract, which applies to the two new optional UIState fields).
- `docs/ai/REFERENCE/00.2-data-requirements.md` for canonical names.

**Why reuse the two existing queues instead of new pending types.**

- **Smash already models this choice.** It is exactly "optionally discard a hand card, then a reward", with the same eligible set, decline path, stale check and prompt. Only the reward differs.
- **Reveal-top-dispose already models KO-or-keep.** With `isKoAllowed` it is the choice minus Discard.
- **Each needs only one optional, omit-when-absent field** (the D-24558 precedent), so games that never play these cards serialize byte-identically.
- **What a sibling type would add, for no behavioural gain:**
  - a second block-all guard set (~10 files) and a new move (44→45);
  - `ALL_PENDING_FIELDS`, both sim `MOVE_MAP`s and `botLoopProgress`;
  - a new prompt.
- Duplicate-first (code-style §Abstraction) is not in tension here: nothing is abstracted; a discriminator field is added.

**Why the context fix belongs here.** Gruesome Feast's reveal runs inside `fireExcessiveViolencePlays`. With an empty deck it must reshuffle, which is the exact path that throws under bare `ctx`. Shipping the reveal without the fix would ship a move that can throw.

**Stale KO-or-keep snapshots.** Synchronous siblings (D-24521 §6) can move a KO-or-keep snapshot off the deck top before the player decides:

- (a) two Excessive Violence reveals in one fight (two Gruesome Feasts) snapshot the same top, so after the first KO the second would clear as "moot";
- (b) Carnage's own Rending Claws (EV `draw:1`) is routinely enrolled beside Gruesome Feast, and `fireExcessiveViolencePlays` fires them in play order, so Rending Claws can draw the snapshotted card first.

Either way the KO choice vanishes with a neutral log — the "does nothing" bug again. One exported helper, `refreshStaleKoOrKeepFront(G, shuffleProvider)`, re-reveals a stale KO-or-keep front entry. It is called at the end of `fireExcessiveViolencePlays` (case b), at the end of `resolveDeferredHeroGrants` (a deferred grant that draws after the fight move), and after every `queue.shift()` in `resolveRevealTopDispose` (case a). Only KO-or-keep entries are refreshed, so shipped reveal-top-dispose behaviour is unchanged. **Accepted deviation (recorded in D-24581):** in case (b) the player keeps the drawn card, then chooses KO-or-keep on the NEW top; tabletop ordering would let them KO the first card before drawing, which needs a mid-fire continuation (out of scope). This also amends D-24521's "the snapshot cannot drift" invariant (`types.ts` ~L675) for KO-or-keep entries only.

## Scope (In)

- **Keyword `optional-discard-draw`** (carries a magnitude = cards drawn; NOT in `NO_MAGNITUDE_KEYWORDS`, like Smash).
  - Token: `[keyword:optional-discard-draw:1]`.
  - Handler `heroEffectOptionalDiscardDraw`: empty hand → logged no-op, no park. Otherwise push `{ playerID, magnitude, reward: 'draw' }` onto `pendingSmashDiscards` (lazy-init).
- **`PendingSmashDiscard.reward?: 'draw'`** — omitted for Smash (never written as `undefined`).
- **`resolveSmashDiscard` changes:**
  - Destructure `{ G, playerID, ...context }`.
  - After a successful discard, when `front.reward === 'draw'`:
    - if `drawsLocked`, the discard stands and a `[blocked]` "can't draw" log is written (D-24552);
    - otherwise `drawCardsIntoHand(zones, front.magnitude, context as unknown as ShuffleProvider)`, and `turnEconomy.cardsDrawn += (hand-length delta)`, the baseline hand length captured AFTER the successful `discardFromHand` and immediately BEFORE `drawCardsIntoHand`.
    - No Attack is granted.
  - Reward-specific decline and success log text.
  - Smash entries (no `reward`) behave byte-identically.
- **Bot:** for a `reward: 'draw'` entry under `drawsLocked`, the `ai.legalMoves.ts` Smash dispatch emits `{ decline: true }`, because discarding without a draw is pure loss. Otherwise it uses the existing `selectDefaultSmashDiscardTarget`.
- **Keyword `reveal-top-may-ko`** (NO magnitude → `NO_MAGNITUDE_KEYWORDS`).
  - Handler `heroEffectRevealTopMayKo`: `revealDeckTopForDispose` for the active player; no card → logged no-op, no park. Otherwise push one `PendingRevealTopDispose` itself (not via `parkRevealTopDispose`, whose log says "discard or keep"), whose single entry is `{ ownerPlayerID, cardId, isKoAllowed: true, isDiscardAllowed: false }`, and log `Player {p} revealed {card} from the top of their deck — KO it or keep it (reveal-top).` (`neutral`).
- **`RevealedTopEntry.isDiscardAllowed?: boolean`** — omitted = allowed (every shipped entry). Only this handler sets it, and only to `false`.
- **`resolveRevealTopDispose` changes:**
  - A `'discard'` on an entry with `isDiscardAllowed === false` is a silent `void` that leaves the queue byte-identical (the `isKoAllowed` gate precedent).
  - Destructure `{ G, playerID, ...context }`.
  - After every `queue.shift()`, call `refreshStaleKoOrKeepFront(G, context as unknown as ShuffleProvider)`.
- **`refreshStaleKoOrKeepFront(G, shuffleProvider)`** — new export in `heroEffects.execute.ts` beside (and reusing) the currently private `revealDeckTopForDispose`. It loops while `G.pendingRevealTopDispose` has a front:
  - For each front entry with `isDiscardAllowed === false` and `cardId !== owner.deck[0]`, re-reveal that owner's top (reshuffling an empty deck), replace `cardId`, and log `Player {p} reveals the new top card of their deck — {card} — KO it or keep it (reveal-top).` If no card remains, drop the entry and log `Player {p} has no card left to reveal (reveal-top).`
  - If the front empties, `shift()` and continue; otherwise stop.
  - It terminates (each pass refreshes or drops an entry) and never touches an entry without `isDiscardAllowed === false`.
  - It is also called once at the end of `fireExcessiveViolencePlays` and once at the end of `resolveDeferredHeroGrants` (`heroEffects.execute.ts` ~L5626 — runs in `turn.onMove` after every move, where a wait-and-see grant crossed by an EV recruit/draw may draw the snapshotted card), each with `// why:`. Both are no-ops when no stale KO-or-keep entry exists.
- **Excessive Violence context fix:** `fightVillain` and `fightMastermind` pass the spread move context (the `playCard` shape) to `fireExcessiveViolencePlays`. The parameter becomes `({ G, ...context })` and the moves read `context.ctx` / `context.random`. The fight logic is otherwise untouched.
- **Allowlists:**
  - Add `vnom/venom-rocket/hungry-for-action` to `DIGEST_INDIGESTION_CARDS`.
  - Add `vnom/carnage/gruesome-feast` and `mgtg/drax/remove-his-spine` to `EXCESSIVE_VIOLENCE_CARDS`.
  - Update both deferral comments. Retarget the L2582 negative fixture to `vnom/carnage/feast-or-famine`, which is still deferred.
- **Digest-not-met log:** when the chosen Digest branch is empty (below threshold with no Indigestion line), push one `neutral` line: `Player {p}'s {card} — Digest {N} not met ({count} in Victory Pile); no effect.` `G.messages` is hash-excluded (D-24081).
- **Keyword registration:** union + `HERO_KEYWORDS` 67→69; `HANDLED_KEYWORDS` + `HERO_EFFECT_HANDLERS` 51→53.
- **UIState (five-step, two optional fields):**
  - `UIPendingSmashDiscard.reward?: 'draw'` and `UIRevealedTopEntry.isDiscardAllowed?: boolean` — types, build (`uiState.build.ts` ~L1882 / ~L1181), filter pass-through (~L1039 / ~L739, both chooser-only, as today).
  - An audience-filter test per field, and the diagnostics snapshot.
- **Client:**
  - `SmashDiscardPrompt.vue`: when `reward === 'draw'`, heading "Discard a card to draw {N}" and neutral button labels; the Smash heading is otherwise unchanged.
  - `PendingRevealTopDisposePrompt.vue`: hide Discard when `isDiscardAllowed === false`, with heading "Reveal the top card — KO it or keep it".
  - Tooltip copy in `useTurnActions.ts` (booleans only, so neutral strings, no new props): both Smash strings (~L374, ~L656) → `Resolve the discard choice (discard a card or Decline) before taking another action.`; both reveal-top strings (~L493, ~L745) → `Resolve each revealed deck top before taking another action.`
- **Card data (GENERATED):**
  - Token arms `^\[keyword:optional-discard-draw:[1-9]\d*\]$` and `^\[keyword:reveal-top-may-ko\]$` in `apply-hero-ability-markers.mjs`.
  - Eight markers; remove the two `_deferred` entries (electroshock-therapy, gruesome-feast).
  - Regenerate vnom, gotg, asrd, shld, antm, mgtg, vill.
- **Coverage regen:** `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:coverage --check` (`--update-baseline` if it moves), `sim:runtime-observed` + the dashboard in-play `totalObs` pin (run `prebuild:coverage` before the local dashboard test), and two `mechanic-provenance.json` rows.
- **Tests:**
  - Parser: each marked line → exactly one hook of the new keyword. Risky Science is gated by `[hc:tech]`. Hungry for Action fuses to `digestEffects: [optional-discard-draw]` with no Indigestion. Gruesome Feast and Remove His Spine fuse to Excessive Violence.
  - Handlers: parks; empty-hand / empty-deck no-ops.
  - `resolveSmashDiscard` with the draw reward:
    - discard + draw, and `cardsDrawn += 1`;
    - a reshuffle from an empty deck;
    - draw-lock leaves the draw blocked with the discard applied;
    - decline;
    - Smash unchanged.
  - `resolveRevealTopDispose`: KO; keep; discard rejected on a KO-or-keep entry; refresh after shift (two KO-or-keep entries: the first KO, then the second shows the new top); refresh chains past an entry with nothing left to reveal; `resolveDeferredHeroGrants` re-reveals a stale KO-or-keep front; shipped entries unchanged.
  - Fight with Excessive Violence using the **real** move-context shape `{ G, ctx, random }` (no `makeMockCtx` for this case), empty deck + non-empty discard: Rending Claws' draw reshuffles and draws, and nothing throws.
  - The Digest-not-met log; the bot decline under draw lock; UIState audience filter; the two prompts; drift pins.

## Out of Scope

- `nmut/mirage/dreams-made-real` (`[keyword:Moonlight]:` gate — Moonlight is unimplemented), `mdns/blade-daywalker/hunt-high-and-low` (`[keyword:Patrol the Rooftops]:` timing), and `vnom/carnage/feast-or-famine` (a cost-0 KO **loop**).
- Villain / henchman / mastermind "Fight: Reveal … You may KO it." lines (not hero abilities).
- `insatiable-hunger` and every other still-deferred Digest or Excessive Violence card.
- The draw-lock / `cardsDrawn` gap in `resolveDoOver` (`doOver.resolve.ts` L131), noticed in passing; a separate fix.
- Merging the two queues' prompts or introducing a general "optional discard for reward" abstraction.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — two keywords.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — registrations, the two handlers, the Digest-not-met log, the new `refreshStaleKoOrKeepFront` export (beside `revealDeckTopForDispose`), and its calls at the end of `fireExcessiveViolencePlays` and `resolveDeferredHeroGrants`.
- `packages/game-engine/src/types.ts` — **modified** — `PendingSmashDiscard.reward?`, `RevealedTopEntry.isDiscardAllowed?`.
- `packages/game-engine/src/moves/smashDiscard.resolve.ts` — **modified** — context + draw reward branch.
- `packages/game-engine/src/moves/revealTopDispose.resolve.ts` — **modified** — discard gate + refresh after shift.
- `packages/game-engine/src/moves/fightVillain.ts`, `moves/fightMastermind.ts` — **modified** — spread context to Excessive Violence.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — the two allowlists + comments.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — bot decline under draw lock.
- `packages/game-engine/src/ui/uiState.{types,build,filter}.ts` — **modified** — two optional fields.
- Tests (under `packages/game-engine/src/`): `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` (count + ordered array + the L2582 fixture retarget), `setup/heroAbility.setup.test.ts` (L1430), `hero/heroEffects.execute.test.ts`, `moves/smashDiscard.resolve.test.ts`, `moves/revealTopDispose.resolve.test.ts`, `moves/fightVillain.test.ts`, `moves/fightMastermind.test.ts`, `ui/uiState.filter.test.ts` — **modified**.
- `apps/arena-client/src/components/play/SmashDiscardPrompt.vue`, `components/play/PendingRevealTopDisposePrompt.vue` + their `*.test.ts`, `composables/useTurnActions.ts` — **modified**.
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified**.
- `data/cards/{vnom,gotg,asrd,shld,antm,mgtg,vill}.json` — **modified (generated)**.
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/mechanic-provenance.json`, `scripts/coverage/hero-effect-coverage.baseline.json` (if it shifts), `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (if `totalObs` shifts) — **modified (generated / provenance)**.
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — govern-close (`SPEC:` commit).

> ~20 hand-edited files. One WP because both executors ride existing queues and share the drift pins and the regen. The context fix sits on the Gruesome Feast path. Exact allowlist in the EC.

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, snippets or partial sections. ESM; Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: reshuffles only via the existing `ShuffleProvider` helpers (`ctx.random`); no `Math.random()`. Moves never throw. Zone moves go via `zoneOps` / `discardFromHand` / `koCard`.
- `G` stores `CardExtId` strings only. The two new fields are optional and omitted when absent (never written as `undefined`).
- Union + `HERO_KEYWORDS` change in lockstep, with RUNTIME drift pins (D-24372).
- UIState five-step for both optional fields.
- The client submits intent only. Both resolve moves stay server-only.
- Card data via marker SOURCE + regen; `cards:check` must be byte-reproducible; never hand-edit `data/cards/*.json`.
- Smash entries and shipped reveal-top-dispose entries behave byte-identically (existing tests pass unedited).

**Session protocol:** STOP and raise it if any of these happens:

- a marker token on a Digest or Excessive Violence line is consumed by the fusion but produces no inner effect;
- the parser emits a second, auto-detected effect (e.g. a stray `draw`) on any of the eight lines;
- a `finalStateHash` sentinel moves.

## Contract

- `PendingSmashDiscard { playerID; magnitude; reward?: 'draw' }`; `RevealedTopEntry { ownerPlayerID; cardId; isKoAllowed?; isDiscardAllowed?: boolean }`.
- `heroEffectOptionalDiscardDraw(G, ctx, playerID, cardId, effect)` — parks a draw-reward Smash entry.
- `heroEffectRevealTopMayKo(G, ctx, playerID, cardId, effect)` — parks a KO-or-keep reveal-top entry.
- `resolveSmashDiscard` / `resolveRevealTopDispose` — as in Scope; the arg shapes are unchanged.
- `UIPendingSmashDiscard.reward?`, `UIRevealedTopEntry.isDiscardAllowed?`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §10, §22 (deterministic, replay-faithful).

- **No conflict:** each printed ability resolves as the card reads.
- **Non-Goal proximity:** none of NG-1..NG-7 is crossed; these are printed hero abilities, and nothing is bought, gated or timed.
- **Determinism preservation:** reshuffles use `ctx.random` through the shipped helpers, and decisions are recorded moves. The new fields are optional and absent in games that never play these cards, so the core `finalStateHash` sentinels serialize byte-identically → **no re-pin** (verify). The context fix only changes behaviour where the old code would have thrown. **No migration:** both fields are optional and omit-when-absent, so no `G` or schema migration is needed. Re-running a completed match's replay (D-24119) that played one of these eight cards under the old engine will now park the new choices. That exposure is the same for every effect-fidelity WP and is accepted.

## Funding Surface Gate

N/A — no funding surface; hero card abilities only.

## API Catalog Update

N/A — no `apps/server` endpoint or library function; engine moves only.

## Acceptance Criteria

1. Playing Gritty Scavenger with a non-empty hand parks a `pendingSmashDiscards` entry `{ reward: 'draw', magnitude: 1 }`. `resolveSmashDiscard({ cardId })` discards that card, draws one, and increments `cardsDrawn` by 1 with no Attack. `{ decline: true }` changes nothing but the queue.
2. With `drawsLocked`, the discard applies and the draw is `[blocked]`; `cardsDrawn` is unchanged; the bot declines instead.
3. Hungry for Action with ≥3 cards in the Victory Pile parks the draw-reward entry. With fewer, nothing parks and one neutral "Digest 3 not met" line is logged.
4. Risky Science parks only when another Tech Hero was played this turn (the `[hc:tech]` gate; Risky Science is itself Tech).
5. Electroshock Therapy parks a reveal-top entry with `isKoAllowed: true, isDiscardAllowed: false`. `'ko'` KOs the top card, `'top'` keeps it, and `'discard'` is a silent `void`.
6. Gruesome Feast (and Remove His Spine) enroll for Excessive Violence, and a fight using it parks the KO-or-keep choice at fight time. Two enrolled reveals in one fight: after the first KO, the second prompt shows the new deck top. Gruesome Feast enrolled BEFORE Rending Claws: after the fire, the prompt shows the post-draw deck top and does not clear as moot.
7. A fight with Excessive Violence — both `fightVillain` and `fightMastermind` — using the real move context, with an empty deck and a non-empty discard, reshuffles and resolves Rending Claws' draw without throwing.
8. Smash entries and shipped reveal-top-dispose entries behave as before; their existing tests pass unedited.
9. Both optional UIState fields are chooser-only, survive `filterUIStateForAudience`, and appear in the diagnostics `uiStateSnapshot`.
10. The Smash prompt shows "Discard a card to draw 1" for a draw-reward entry. The reveal-top prompt hides Discard for a KO-or-keep entry.
11. RUNTIME pins: `HERO_KEYWORDS` 67→69, `HERO_EFFECT_HANDLERS` 51→53, moves unchanged at 44.
12. `cards:check` reproduces the seven sets; `ledger:heroes` shows both keywords `executable`. Engine + arena-client suites green; `typecheck` 0; `pnpm -r build` 0; `finalStateHash` sentinels unchanged.

## Verification Steps

- `pnpm --filter @legendary-arena/game-engine build` + `test` — exit 0.
- `pnpm --filter @legendary-arena/arena-client typecheck` + `test` — exit 0.
- `node scripts/convert-cards/apply-hero-ability-markers.mjs --validate`, then `pnpm cards:check` — the seven sets reproduce byte-identically.
- `pnpm -r build && pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata`, then `pnpm ledger:heroes:check && pnpm effect-index:check` — exit 0; both keyword rows `executable`.
- `pnpm sim:coverage --check` and `pnpm sim:runtime-observed:check` — exit 0 (regenerated honestly if shifted).
- `pnpm --filter @legendary-arena/dashboard prebuild:coverage && pnpm --filter @legendary-arena/dashboard test` — green (in-play pin re-pinned if `totalObs` moved).
- `pnpm --filter @legendary-arena/server test` — green.
- No `finalStateHash` re-pin: covered by the engine `test` run (no `finalStateHash` / `PRE_WP080_HASH` literal edited).
- `pnpm roadmap:counts:check` — exit 0.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client suites green; `typecheck` 0; `pnpm -r build` 0.
- [ ] Card data + coverage artifacts regenerated and their `:check` gates green.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a real match fights with Excessive Violence after playing Gruesome Feast (KO-or-keep prompt appears), and plays Hungry for Action with 3+ Victory Pile cards (discard-to-draw prompt appears).
- [ ] `docs/ai/STATUS.md` updated; write D-24581 (Active) in `DECISIONS.md`; `WORK_INDEX.md` checked off; `05-ROADMAP-MINDMAP.md` node ✅ + `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified.

## Reserved Decision (lands at execution)

D-24581 — the decision text to land:

- **"You may discard a card. If you do, draw a card."** is the `optional-discard-draw` keyword. It rides the Smash queue with an omit-when-absent `reward: 'draw'` (magnitude = cards drawn; draw lock blocks the draw but not the discard; realized draws count toward `cardsDrawn`).
- **"Reveal the top card of your deck. You may KO it."** is the `reveal-top-may-ko` keyword. It rides the reveal-top-dispose queue with `isKoAllowed: true` + an omit-when-absent `isDiscardAllowed: false`.
- **Stale-front refresh:** a KO-or-keep entry whose snapshot left the deck top (a later synchronous Excessive Violence effect, or a queue advance) is re-revealed via `refreshStaleKoOrKeepFront`, called at the end of `fireExcessiveViolencePlays`, at the end of `resolveDeferredHeroGrants`, and after every queue shift. This amends D-24521's "snapshot cannot drift" for KO-or-keep entries only. Accepted deviation: a card drawn by a later EV effect stays drawn and the choice moves to the new top.
- **Allowlists:** Hungry for Action joins the Digest allowlist; Gruesome Feast and Remove His Spine join the Excessive Violence allowlist.
- **Digest-not-met log:** every single-branch Digest card below threshold (Cauldron of the Cosmos included) logs a neutral "not met" line.
- **Context fix:** the fight moves pass the spread move context to `fireExcessiveViolencePlays`, fixing a latent throw when an Excessive Violence effect reshuffles an empty deck.
- **No new move, queue, or prompt.**

## Lint Gate Self-Review (00.3)

Independent reviewer (subagent), after pre-flight READY + copilot PASS. One count fix was applied (eight target lines across seven sets) plus one file-description tightening.

- **§1 structure / §2 constraints:** all sections present. Out of Scope excludes ≥2: the Mirage / Blade / Feast-or-Famine near-siblings; non-hero "Fight: Reveal…" lines; other deferred Digest/EV cards; the `resolveDoOver` draw-lock gap; merging the queues/prompts. Full-files / determinism / session-protocol + `## Contract`. **PASS.**
- **§3 Assumes / §4 Context:** every dependency file + line + decision cited (spot-verified at `9a694510`); ARCHITECTURE §Layer Boundary + rules §UIState + 00.2. **PASS.**
- **§5 files:** every file modified with a role. ~20 hand-edited files, justified because both executors ride existing queues and share pins + regen. `refreshStaleKoOrKeepFront` and its call sites are named; exact allowlist in EC-791. **PASS.**
- **§6 naming:** `CardExtId`, `playerID`, `cardsDrawn`, `drawsLocked` per 00.2 / shipped types. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dep; engine decides, client renders; both resolve moves server-only; reshuffles via `ShuffleProvider` only. **PASS.**
- **§9/§10/§11:** `pnpm` only; no env var; no auth surface. **PASS / N/A.**
- **§12 tests:** `node:test`; real `{ G, ctx, random }` fight shape; no boardgame.io import; deterministic. **PASS.**
- **§13/§14/§15:** exact `pnpm` commands with expected exits; 12 observable criteria; DoD has STATUS / DECISIONS / WORK_INDEX + scope boundary + a D-24026 live item. **PASS.**
- **§16 code-style:** discriminator fields on existing queues, not a new abstraction; the refresh helper has 3 call sites (keep it ≤30 lines, and split the per-entry re-reveal out if it grows). `// why:` on NO_MAGNITUDE, queue reuse, draw lock, `cardsDrawn` delta, discard gate, refresh, spread context, bot decline, Digest-not-met log; four now-false comments corrected. **PASS.**
- **§17 Vision:** clause numbers (§1/§2/§10/§22), no-conflict line, NG line, determinism + no-migration line. **PASS.**
- **§18/§19/§20/§21:** no literal-grep verification; §19 applies at the govern-close commit; funding N/A (hero abilities only); API N/A (engine moves, no `apps/server` surface). **PASS / N/A.**

## Pre-Flight Verdict (01.4)

Independent reviewer, two rounds.

**Round 1: NOT READY** on PS-1. Gruesome Feast's KO-or-keep snapshot goes stale when a later Rending Claws EV `draw:1` fires synchronously in the same `fireExcessiveViolencePlays` run, so the choice would clear as moot. Fix: `refreshStaleKoOrKeepFront`, called at the end of the fire and after every queue shift.

RS items applied:
- RS-1: the refresh chains.
- RS-2: the helper lives beside the private `revealDeckTopForDispose` and reuses it.
- RS-3: the handler parks its own entry with a locked log.
- RS-4: neutral tooltip strings.
- RS-5: a `fightMastermind` EV test.
- RS-6: the Digest-not-met log also covers Cauldron of the Cosmos.
- RS-7: AC-4 now reads "another Tech Hero".

**Round 2: READY TO EXECUTE**, no blocking items.

## Copilot Check (01.7)

**Round 1: RISK (HOLD).**
- #18: a deferred wait-and-see grant resolving in `turn.onMove` can draw the snapshotted card after the fight. Fix: the refresh is also called at the end of `resolveDeferredHeroGrants`.
- #12: `moves/fightMastermind.test.ts` added to the WP allowlist.
- #26: the `cardsDrawn` baseline is taken after the discard and immediately before the draw.
- #15: four now-false comments corrected.
- #28: no-migration statement + accepted D-24119 replay exposure.

**Round 2: PASS.**

Accepted deviation (D-24581): a card drawn by a later EV effect stays drawn, and the KO-or-keep choice moves to the new top.
