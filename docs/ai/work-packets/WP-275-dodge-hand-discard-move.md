# WP-275 — Dodge: Hand-Discard-to-Draw Move + Recognized Keyword

> **Status:** DRAFT — pending review (do not execute until reviewed per
> `.claude/rules/work-packets.md` Review Gate).
> **Reserves:** D-24051.
> **Paired EC:** EC-306.
> **Depends on:** WP-021 / WP-022 (hero ability hook pipeline + `executeHeroEffects`),
> WP-016 / WP-135 (the move + draw infrastructure), WP-253 (the hero ledger's
> `executable | deferred | unsupported | unmarked` classification + `MVP_KEYWORDS`),
> WP-257 (`parse-unrecognized` hollow detection), WP-259 / WP-265 (the runtime-observed
> sweep that ranks in-play hollows), WP-273 (the move-executed-keyword `MVP_KEYWORDS`
> category + the ledger handler-module mapping this WP extends) — all landed.

---

## Goal

After this session, the printed hero keyword **Dodge** — *"During your turn, you
may discard this card from your hand to draw another card. When you Dodge a card
from your hand, ignore all the other text on that card."* (keyword glossary,
`data/metadata/keywords-full.json`) — executes as written. Today `[keyword:Dodge]`
is an **unrecognized** marker: the parser does not know it, so it defaults to
`onPlay` timing and fires a `parse-unrecognized` hollow every time a dodge hero is
played. The runtime-observed sweep ranks it the **highest in-play hollow (37
observations)** — the single biggest player-facing gap the sweep names. This WP
makes `dodge` a **recognized `HeroKeyword`** and adds a **new `dodgeCard` move**: a
player may discard a Dodge-eligible card from their hand to draw a replacement card.
The keyword flips from `unsupported` → `executable` in the hero mechanic ledger, and
the 37 `onPlay` hollows disappear from the runtime-observed sweep.

**Execution invariant (zone state on the deterministic sweep).** The new
`dodgeCard` move is **registered** (it bumps `game.test.ts`'s move count 11 → 12) but
is **NOT added to the simulation's `getLegalMoves` enumeration** — the deterministic
bot/sim therefore never invokes it, exactly as WP-273's bot declines `toTopOfDeck`.
So the sweep's zone state is byte-unchanged and the sentinel `finalStateHash` is
**unchanged**; only the *diagnostics* change (the dodge `onPlay` hollows vanish
because the keyword is now recognized and in `MVP_KEYWORDS`). Teaching the bot to
dodge is a deferred follow-up (see Out of Scope).

**Why this keyword next.** It is the **#1** in-play hollow the runtime sweep names
(37 obs, vs wall-crawl's 23), and — like wall-crawl — it is a self-contained hand
action with **no new zone-state model** and **no pending-choice / board-freeze
machinery**. It builds the **first hand-resident optional move** (a player discards a
specific hand card to draw), reusable by any future hand-action keyword. It is modeled
as a **new non-core move** (the recruitHero internal-gating precedent), so the only
move-registration surface touched is the additive `dodgeCard` entry + the
`game.test.ts` move-set assertion.

---

## Assumes

> **Drafting baseline (01.0a Step 2):** drafted against `origin/main` @ `7a6f48b2`
> (post WP-273 / EC-304 #430 — the wall-crawl onRecruit keyword, whose
> move-executed-keyword `MVP_KEYWORDS` category and ledger handler-module mapping this
> WP extends). Supersession check (slug grep `--all -i "dodge"`, `WORK_INDEX` /
> `EC_INDEX` scan, `ls *dodge*`) returned no collision — no dodge mechanism exists; the
> only grep hits are false positives in WP-273/274 commit bodies. Next-free numbers
> confirmed: WP-275, EC-306, D-24051.

- **WP-021 / WP-022 complete.** `setup/heroAbility.setup.ts` parses `[keyword:X]`
  markers into `HeroAbilityHook`s; `hero/heroEffects.execute.ts::executeHeroEffects`
  runs from `playCard` and dispatches recognized effects via `HERO_EFFECT_HANDLERS`
  gated on `MVP_KEYWORDS`; an unrecognized `[keyword:X]` lands in `unresolvedMarkers`
  and fires a `parse-unrecognized` hollow.
- **`executeHeroEffects` visits ALL of a played card's hooks — it does NOT filter by
  timing** (the WP-273 correction). A dodge hook with the default `onPlay` timing IS
  visited at play time; the parser auto-emits an `effects: [{ type: 'dodge' }]`
  descriptor (no magnitude) for the recognized keyword, and the design relies on that
  play-time visit being a benign, not-hollow no-op (see the Dodge Execution Model §2/§5).
- **WP-273 complete (the precedent this WP mirrors).** `MVP_KEYWORDS` is the union of
  `HANDLED_KEYWORDS` (play-time `HERO_EFFECT_HANDLERS` keys), `FROZEN_REVEAL_TRANSLATED`,
  and `RECRUIT_TIME_EXECUTED_KEYWORDS` (wall-crawl — executed by a move, no play-time
  handler). The `every MVP_KEYWORD is handled directly, via reveal translation, or at
  recruit time` drift test (`heroEffects.execute.test.ts`) already admits the
  move-executed category. The ledger's `handlerForMechanic` resolves a move-executed
  keyword's handler column via `RECRUIT_TIME_HANDLER_MODULES`.
- **The move infrastructure exists.** `recruitHero` is the **non-core, internally-gated**
  move precedent (`moves/recruitHero.ts`: validate args → stage gate `G.currentStage`
  → mutate via helpers → return void; never throws; registered in `game.ts` `moves: {}`
  but NOT in `CORE_MOVE_NAMES` / `MOVE_ALLOWED_STAGES`). `playCard` targets a hand card
  by `args.cardId` via `moveCardFromZone(hand, …, cardId)`. `drawCardsIntoHand(zones,
  count, shuffleContext)` (`moves/drawCards.logic.ts`) is the deck-top draw helper
  (reshuffles discard when the deck is empty).
- **WP-253 complete.** The hero ledger classifies a mechanic `executable` iff its name
  ∈ `MVP_KEYWORDS`, else `deferred` (∈ `HERO_KEYWORDS`) or `unsupported` (∉
  `HERO_KEYWORDS`). `dodge` is currently `unsupported` (not in the union).
- **WP-257 complete.** `detectHollowHeroHook` flags a hook hollow when NO declared
  mechanic reaches a handler AND ≥1 is hollow; a **mixed hook with ≥1 reachable
  mechanic never flags**. `dodge` records at `onPlay` today.
- **The card data already carries the markers.** All 25 `[keyword:Dodge]` lines
  (bkwd 10 + vill 15) exist in `data/cards/**` today. **This WP adds NO card-data
  marker and re-marks nothing** — it only makes the parser recognize the existing token.
- `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` +
  `pnpm sim:coverage --check` + `pnpm ledger:heroes:check` +
  `pnpm sim:runtime-observed:check` + `pnpm mechanics:metadata:check` all exit 0 on
  the base.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a line:

- `docs/ai/ARCHITECTURE.md §The Move Validation Contract` + §Phase & Turn
  Transitions — the new move stays validate-args → stage/pending gate →
  mutate-via-helpers → return-void; moves never throw.
- `packages/game-engine/src/moves/recruitHero.ts` — the **non-core internally-gated
  move precedent** the new `dodgeCard` move mirrors (stage gate, block-all guards,
  `G.messages` line).
- `packages/game-engine/src/moves/coreMoves.impl.ts::playCard` — the **hand-card
  targeting precedent** (`args.cardId` + `moveCardFromZone(hand, …, cardId)`).
- `packages/game-engine/src/moves/drawCards.logic.ts::drawCardsIntoHand` — the draw
  helper the dodge move calls to draw the replacement card.
- `packages/game-engine/src/game.ts` `moves: {}` block — where the new move registers.
- `packages/game-engine/src/game.test.ts` — the **exactly-11-moves** set+count
  assertion (lines ~106–111) this WP updates to 12.
- `packages/game-engine/src/rules/heroKeywords.ts` — the `HeroKeyword` closed union +
  canonical array (drift-detected).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — `MVP_KEYWORDS`,
  `RECRUIT_TIME_EXECUTED_KEYWORDS` (the WP-273 move-executed precedent), the
  `detectHollowHeroHook` / `classifyHeroEffectReason` reachability surface.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — the **explicit** sim move
  enumeration (NOT auto-derived from `Game().moves`; no test asserts it covers the full
  move set); **this WP does NOT touch it** (the determinism lever — the bot never dodges).
- `scripts/hero-mechanic-ledger.mjs` — `handlerForMechanic` + the WP-273
  `RECRUIT_TIME_HANDLER_MODULES` move-executor mapping this WP extends for `dodge`.
- `data/metadata/keywords-full.json` — the authoritative Dodge rules text.
- `docs/ai/DECISIONS.md` — D-24024 (the ledger `MVP_KEYWORDS` classification),
  D-24049 (the WP-273 move-executed-keyword precedent) before reserving D-24051.
- `.claude/rules/code-style.md` + `00.6` + `.claude/skills/legendary-game-engine/SKILL.md`.

---

## The Dodge Execution Model (locked design — D-24051)

1. **`dodge` becomes a recognized `HeroKeyword`** (union + canonical array + the drift
   test). The parser recognizes `[keyword:Dodge]` (case-insensitively normalized to
   `dodge`), so it no longer lands in `unresolvedMarkers` and no longer fires an
   `onPlay` `parse-unrecognized` hollow on a played dodge card.
2. **`dodge` keeps the default `onPlay` timing** (it is NOT added to
   `KEYWORD_TIMING_DEFAULTS`). Dodge fires from a **move**, not a timing hook — the
   timing label is only the hook's parse-time default. `executeHeroEffects` does NOT
   filter by timing; it visits the dodge hook at play time and its auto-emitted
   `{ type: 'dodge' }` effect reaches `executeSingleEffect`, which **no-ops on the
   missing magnitude** (`[keyword:Dodge]` carries no `:N`), so playing a dodge card
   normally produces no onPlay state change. The hollow side is handled by §5.
3. **The effect is a new hand-action move.** `dodgeCard({ cardId })` is a **new
   non-core, internally-gated move** (the recruitHero precedent): after the stage +
   pending gates, it checks that `cardId` is in the player's hand AND carries a `dodge`
   hook; if so it **discards that card from hand to the player's discard pile and draws
   one replacement card** (`moveCardFromZone(hand → discard, cardId)` then
   `drawCardsIntoHand(zones, 1, ctx)`). **Discard-before-draw is ordered, not incidental:**
   pushing the dodged card to discard FIRST guarantees a replacement is always drawable
   (the discard is non-empty), so exactly one card is always drawn; in the pathological
   empty-deck case the dodged card is reshuffled and drawn straight back into hand
   (rule-correct). It appends one **byte-locked** `G.messages` line —
   `` `Player ${ctx.currentPlayer} dodged ${cardId} (discarded from hand, drew 1 replacement)` ``
   (replay-visible + snapshotted, no timestamps; the `recruitHero.ts` log-line precedent).
   Any ineligible call (card not in hand, no dodge hook, wrong stage, board frozen) returns
   silently with NO mutation of any kind. **"Ignore all the other text on that card" is
   automatically satisfied** — dodging discards+draws and never *plays* the card, so its
   other abilities never execute; no suppression logic is needed. **Play-path exclusion is
   a hard invariant:** `dodgeCard` MUST NOT call, reuse, or route through `playCard` or
   `executeHeroEffects` / any effect-execution pathway.
4. **No pending-choice, no board-freeze, no zone model.** Dodge is the player's own
   direct optional action on their own hand — no hidden information, no opponent
   interaction, no parked choice — so this WP needs **none** of the WP-242 / WP-248
   distributed block-all-guard machinery and adds no new zone-state. The move
   *respects* the existing block-all guards (it returns while a KO-hero /
   optional-KO-reward choice is pending, for board-freeze consistency) but adds none.
5. **`dodge` is `executable`, and `MVP_KEYWORDS` membership is load-bearing — not just a
   ledger signal.** It is added to `MVP_KEYWORDS` via a **new `HAND_ACTION_EXECUTED_KEYWORDS`
   set** (sibling to WP-273's `RECRUIT_TIME_EXECUTED_KEYWORDS`; NOT via `HANDLED_KEYWORDS`,
   which would demand a play-time handler). (a) The hero ledger classifies a member
   `executable`. (b) `classifyHeroEffectReason` returns `applied` for any `MVP_KEYWORDS`
   member, so when `detectHollowHeroHook` runs over the play-time-visited dodge hook it
   classifies it **not hollow**. WITHOUT the `MVP_KEYWORDS` add, the now-recognized
   `dodge` keyword would classify `no-handler` (a valid `HeroKeyword` with no
   `HERO_EFFECT_HANDLERS` entry) and `detectHollowHeroHook` would fire a NEW `no-handler`
   hollow at `onPlay` — trading the old `parse-unrecognized` hollow for a fresh one (a
   regression, NOT a fix). The `dodgeCard` move is the real executor; the play-time path
   is a benign, not-hollow no-op. The `every MVP_KEYWORD is handled-or-translated-or-
   move-executed` drift test must be extended to admit the `HAND_ACTION_EXECUTED_KEYWORDS`
   category.

> **Honest-fix invariant (binary FAIL).** The dodge action MUST be genuinely implemented.
> If `dodge` is recognized AND the `dodgeCard` move cannot demonstrably discard an eligible
> hand card + draw one replacement → this WP **FAILS**, even if the `onPlay` hollow
> disappears. A bare keyword-recognition that silences the hollow while no card can be
> dodged is the dishonest-fix failure mode — recognition alone is NOT the deliverable. The
> mandatory execution scaffold (EC §Before Starting) proves the `dodgeCard` move actually
> discards the named card from hand and draws a replacement, before close.

---

## RS-1 (resolved from source at draft; scaffold re-verifies + proves the honest fix)

**Resolved from source (drafting reads — scaffold confirms, does not discover):**
- **Hand-card targeting is by `cardId`.** `playCard` targets `args.cardId` and removes
  one matching instance via `moveCardFromZone(hand, …, cardId)`; `dodgeCard` uses the
  same model. (A hand index is NOT used; the cardId model matches the existing move
  surface and the arena-client intent shape.)
- **Eligibility = in hand AND a dodge hook.** `getHooksForCard(G.heroAbilityHooks,
  cardId).some(hook => hook.keywords.includes('dodge'))` is the read-only dodge check
  (any timing — dodge's hook is `onPlay` by default but the check is timing-agnostic).
  The hand membership is `playerZones.hand.includes(cardId)` (and `moveCardFromZone`
  returns `found:false` if absent — defensive double-gate).
- **The draw helper.** `drawCardsIntoHand(playerZones, 1, ctx as ShuffleProvider)`
  draws `deck[0]` into hand, reshuffling discard when the deck is empty (the standard
  rule). Net hand-count change is 0 (one card out, one in); the dodge card is replaced
  by a fresh draw.
- **The sim never dodges.** `ai.legalMoves.ts` enumerates moves **explicitly** (a
  hand-written `playCard` / `recruitHero` / … list), NOT from `Game().moves`. Leaving it
  untouched means the deterministic sweep never generates a `dodgeCard` intent → zone
  state + sentinel `finalStateHash` unchanged.
- **The play-time no-op + `MVP_KEYWORDS` interaction** per the Execution Model §2/§5
  (the magnitude-gate skip + the `applied` classification; the drift-test extension).

**Mandatory scaffold proof (observed run — no reasoning substitutes):**
1. The parser normalizes `[keyword:Dodge]` → `dodge` (case-insensitive) on an `onPlay`
   hook with NO `unresolvedMarkers` and an `effects: [{ type: 'dodge' }]` descriptor.
2. **Honest fix:** `dodgeCard({ cardId })` for a dodge card in hand **removes that card
   from hand, appends it to discard, and adds one drawn card to hand** — proven by
   asserting the dodge card left hand, the discard grew by the dodge card, and the hand
   re-filled from `deck[0]`. NOT a bare keyword-recognition that only silences the hollow.
3. **Ineligibility is a silent no-op:** a non-dodge card, a card not in hand, the wrong
   stage, and a pending block-all choice each leave `G` unmutated (no throw).
4. **"Ignore other text":** dodging a card that ALSO declares other ability text does
   NOT execute that text (the card is discarded, never played) — assert no onPlay
   side effects fire from the dodge path.
5. **Play-time path:** playing a dodge hero normally mutates no onPlay state (the
   `{ type: 'dodge' }` effect no-ops on the missing magnitude) AND fires no hollow —
   neither `parse-unrecognized` nor `no-handler`; `dodge ∈ MVP_KEYWORDS` holds the
   second half.
6. **Move registration:** `LegendaryGame.moves` now has **exactly 12** keys including
   `dodgeCard`; `game.test.ts`'s move-set + count assertion is updated and green.
7. **Ledger/sweep deltas:** `dodge` flips `unsupported → executable` for all dodge
   lines/heroes (handler `moves/dodgeCard.ts`); runtime-observed `dodge` 37 → 0; record
   the `sim:coverage` baseline delta and confirm the sweep sentinel `finalStateHash` is
   UNCHANGED (the bot never dodges — see Determinism).

If the scaffold contradicts any resolved-from-source fact above, fold the correction
in-scope (`01.1` mid-execution amendment) before locking.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every new/modified file. Diffs/snippets forbidden.
- No `Math.random()`; **moves never throw** (only `Game.setup()` may); `G` stays
  JSON-serializable; the new arg is a string `cardId`.
- ESM only, Node v22+; `node:` prefix; test files `.test.ts`; no `.reduce()` in
  move/effect logic — use `for...of`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — named-export imports,
  descriptive names (`cardId`, not `cid`), full-sentence errors, functions ≤ ~30 lines,
  no premature abstraction. `// why:` on non-obvious decisions.

**Packet-specific:**
- **Recognize the EXISTING marker; re-mark nothing.** The 25 `[keyword:Dodge]` lines
  already exist in `data/cards/**`. **No `data/cards/**` change, no apply-script change,
  no new marker.**
- **One new move, registered + drift-tested.** `dodgeCard` is added to `game.ts`
  `moves: {}` AND to `game.test.ts`'s move-set list + count (11 → 12) + the test
  description string, IN THE SAME COMMIT. The move is **non-core** (internally gated to
  `main`, the recruitHero pattern) — NOT added to `CoreMoveName` / `CORE_MOVE_NAMES` /
  `MOVE_ALLOWED_STAGES`.
- **Additive only; no behavior change to existing moves.** `dodge` appends to
  `HeroKeyword` + `HERO_KEYWORDS` + a new `MVP_KEYWORDS` entry (via a new
  `HAND_ACTION_EXECUTED_KEYWORDS` set); the parser, all existing moves, and every existing
  hollow path are otherwise byte-identical.
- **No board-freeze guard ADDED; existing guards RESPECTED.** Do NOT add a pending-choice
  queue or a `hasPending*` block-all guard; the dodge move *consults* the existing
  KO-hero / optional-KO-reward block-all guards (returns while one is pending) for
  consistency, but introduces none.
- **The sim/bot does NOT learn to dodge here.** Do NOT add `dodgeCard` to
  `ai.legalMoves.ts` / the competent policy. The deterministic sweep MUST never generate
  a dodge intent (determinism — see below). The bot-dodge integration is a named
  follow-up.
- **Honest-partial on entangled lines.** Recognizing `dodge` makes a **mixed** hook that
  declares `dodge` + still-unsupported `unleash`/`undercover` (e.g. Twilight Ops' rider
  line) classify **not hollow** (the WP-257 mixed-hook rule: ≥1 reachable mechanic ⇒
  not hollow). That is correct and expected — the `unleash`/`undercover` gap on those
  cards is still reported by their **standalone** `unleash` / `undercover` lines, which
  stay hollow. Do NOT special-case or suppress anything; do NOT implement
  unleash/undercover.
- **Determinism (strict).** A new registered move that the sim never invokes leaves the
  deterministic sweep's move stream + zone state byte-unchanged, so the sweep sentinel
  `finalStateHash` **MUST be unchanged**. A sentinel divergence is a FAIL to investigate —
  NOT a routine re-pin — UNLESS it traces to a deliberately added replay fixture that
  exercises `dodgeCard`, in which case re-pin per WP-236 and say so with the evidence.
  Only the **diagnostics** change on the default path (the dodge hollows vanish).
  Regenerate every committed coverage artifact in the SAME commit.
- **Engine + its tests + regenerated coverage artifacts + governance only.** No
  `apps/**`, no `packages/registry/**`, no `apps/server/**`, no `data/cards/**`.

**Locked Contract Values:**
- Keyword: `'dodge'` (appended to the `HeroKeyword` union + `HERO_KEYWORDS` array, and
  added to `MVP_KEYWORDS`), `// why: D-24051`.
- Timing: `dodge` keeps the default `onPlay` (NOT in `KEYWORD_TIMING_DEFAULTS`) — it
  fires from the `dodgeCard` move, not a timing hook.
- New move: `dodgeCard({ cardId }: DodgeCardArgs)` on a LOCAL `DodgeCardArgs` interface
  in `moves/dodgeCard.ts` — non-core, internally gated to `main`. Registered in
  `game.ts` as `dodgeCard: { move: dodgeCard, client: false }`.
- Eligibility (locked): the card is in `playerZones[pid].hand` AND
  `getHooksForCard(G.heroAbilityHooks, cardId).some(h => h.keywords.includes('dodge'))`.
  Else the move returns silently (no mutation).
- Effect (locked): `moveCardFromZone(hand, discard, cardId)` then
  `drawCardsIntoHand(playerZones, 1, ctx as ShuffleProvider)` (discard-before-draw, so a
  replacement is always drawable); append the byte-locked `G.messages` line
  `` `Player ${ctx.currentPlayer} dodged ${cardId} (discarded from hand, drew 1 replacement)` ``
  (single push, no timestamps; the recruitHero precedent). `pid = ctx.currentPlayer`.
- Eligibility is the SINGLE source of truth (locked): in
  `playerZones[ctx.currentPlayer].hand` AND `getHooksForCard(G.heroAbilityHooks,
  cardId).some(h => h.keywords.includes('dodge'))` — no inline re-derivation or alternate
  hook lookup in the move or the tests.
- Silent no-op (locked): every ineligible call leaves `G` byte-identical, proven by a
  `JSON.parse(JSON.stringify(G))` deep-equality snapshot (no zone mutation, no `G.messages`
  append, no throw).
- Play-path exclusion (locked): `dodgeCard` MUST NOT call `playCard` or `executeHeroEffects`
  / any effect-execution pathway.
- Negative classification (locked): `dodge ∉ HANDLED_KEYWORDS` and `dodge ∉
  HERO_EFFECT_HANDLERS` — it enters `MVP_KEYWORDS` ONLY via `HAND_ACTION_EXECUTED_KEYWORDS`.
- Classification: `dodge ∈ MVP_KEYWORDS` ⇒ ledger `executable`; handler column resolves
  to `moves/dodgeCard.ts` (the dodge executor), via the ledger's move-executor
  handler-module mapping (extend the WP-273 `RECRUIT_TIME_HANDLER_MODULES`).
- `MVP_KEYWORDS` mechanism: add `dodge` via a NEW `HAND_ACTION_EXECUTED_KEYWORDS` set
  spread into the `MVP_KEYWORDS` literal (sibling to `RECRUIT_TIME_EXECUTED_KEYWORDS` —
  duplicate-first, do NOT prematurely merge the two). The `every MVP_KEYWORD …` drift
  test MUST be extended to admit it; the `HANDLED_KEYWORDS` count + handler-key
  bidirectional test stay UNCHANGED (no handler added).
- Move count: `game.test.ts` asserts **exactly 12** moves (was 11); the move-set list +
  the `it('defines moves: …')` description string both add `dodgeCard` (alphabetical:
  after `advanceStage`, before `drawCards`).

---

## Scope (In)

### A) `rules/heroKeywords.ts` — modified
Append `'dodge'` to the `HeroKeyword` union + `HERO_KEYWORDS` array (a single new entry,
`// why: D-24051`). The union↔array drift test count updates (§F).

### B) `hero/heroEffects.execute.ts` — modified
Add `'dodge'` to `MVP_KEYWORDS` via a new `HAND_ACTION_EXECUTED_KEYWORDS` set (spread into
the `MVP_KEYWORDS` literal alongside `RECRUIT_TIME_EXECUTED_KEYWORDS` — NOT into
`HANDLED_KEYWORDS`). Two effects: (1) the hero ledger classifies `dodge` `executable`;
(2) `classifyHeroEffectReason` returns `applied` for it, so `detectHollowHeroHook`
classifies the **play-time-visited** dodge hook **not hollow** instead of firing a
`no-handler` hollow. The `onPlay` dispatch DOES reach the auto-emitted `{ type: 'dodge' }`
effect but no-ops on the missing magnitude — confirm it mutates nothing. `// why: D-24051`.

### C) `moves/dodgeCard.ts` — **new**
The new non-core move (mirrors `moves/recruitHero.ts` structure). `DodgeCardArgs { cardId:
string }` (local interface). Order: (1) validate `cardId` is a non-empty string → else
return; (2) stage gate `if (G.currentStage !== 'main') return;` + the two existing
block-all guards (`hasPendingKoHeroChoice` / `hasPendingOptionalKoReward`) → return while
either is pending (`// why:` board-freeze consistency, D-24008 / D-24019); (3) eligibility:
the card must be in `playerZones[pid].hand` AND carry a `dodge` hook (read-only check) —
else return; (4) mutate: `moveCardFromZone(hand, discard, cardId)` (guard `found`), then
`drawCardsIntoHand(playerZones, 1, ctx as ShuffleProvider)`, then append the byte-locked
`G.messages` dodge line. Moves never throw. `// why: D-24051` on the discard+draw and the
"ignore all other text is automatic (the card is never played)" note.

### D) `game.ts` — modified
Register `dodgeCard: { move: dodgeCard, client: false }` in the `moves: {}` block
(import from `./moves/dodgeCard.js`). No other registration surface (NOT a core move).

### E) `game.test.ts` — modified
Update the move-set assertion: add `dodgeCard` to the expected move-name array (after
`advanceStage`), bump the count `11 → 12`, and update the `it('defines moves: …')`
description string. (Per `feedback_move_registration_drift_test` — this is in the
allowlist UP FRONT, not a mid-execution amendment.)

### F) Tests
- `rules/heroAbility.setup.test.ts` — **modified**: the HERO_KEYWORDS union↔array drift
  test (new count); a parse test that `[keyword:Dodge]` yields a recognized `dodge`
  keyword on an `onPlay` hook with NO `unresolvedMarkers` and an `effects: [{ type:
  'dodge' }]` descriptor.
- `moves/dodgeCard.test.ts` — **new**: dodging a dodge card in hand removes it from hand
  exactly once, appends it to discard exactly once, and draws exactly one replacement (the
  deck-top card lands in hand; assert the hand-net-0 / discard-+1 / deck-−1 identities
  modulo the empty-deck reshuffle); each ineligible call (non-dodge card, card not in hand,
  wrong stage, pending block-all choice) is a silent no-op proven by a
  `JSON.parse(JSON.stringify(G))` deep-equality snapshot (no mutation, no message, no
  throw); the byte-locked `G.messages` dodge line asserted verbatim; `JSON.stringify(G)`
  succeeds; "ignore other text" / play-path exclusion — a dodge card that also declares an
  onPlay effect does NOT fire it via the dodge path.
- `hero/heroEffects.execute.test.ts` — **modified**: (1) **extend** the existing `every
  MVP_KEYWORD is handled directly, via reveal translation, or at recruit time` drift test
  to also admit the `HAND_ACTION_EXECUTED_KEYWORDS` category — otherwise it FAILS for
  `dodge`; (2) playing a dodge hero produces no onPlay state mutation AND no hollow
  (neither `parse-unrecognized` nor `no-handler`); (3) `dodge ∈ MVP_KEYWORDS`; (4) the
  negative contract `dodge ∉ HANDLED_KEYWORDS` and `dodge ∉ HERO_EFFECT_HANDLERS`. The
  `HANDLED_KEYWORDS` count + handler-key bidirectional test stay UNCHANGED (no handler
  added).
- `game.test.ts` — **modified** (per §E; the move-set/count + description string).

### G) Regenerated coverage artifacts (committed; CI-gated)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — `dodge` rows flip `unsupported →
  executable` (handler `moves/dodgeCard.ts`). Regenerate via `pnpm ledger:heroes`.
- `docs/ai/coverage/runtime-observed-hollows.json` — the `dodge` entry (37 obs) drops
  out; regenerate via `pnpm sim:runtime-observed`.
- The committed `sim:coverage` baseline (`scripts/coverage/hero-effect-coverage.baseline.json`)
  — regenerate via `pnpm sim:coverage --update-baseline` (dodge lines move
  NO_EFFECT → PARSED_NOT_EXECUTED, same as wall-crawl: a move-executed keyword is not an
  onPlay `EXECUTED_KEYWORDS` member, so the play-time probe reports parsed-not-executed-
  at-play; `noEffect` falls, never rises).
- `data/metadata/card-mechanics.json` — the WP-269 feed; `dodge` becomes a recognized
  mechanic. Regenerate via `pnpm mechanics:metadata`.
- `scripts/coverage/mechanic-provenance.json` — add the `dodge → { wp: "WP-275",
  decision: "D-24051" }` entry (additive).
- `scripts/hero-mechanic-ledger.mjs` — **modified**: extend the WP-273 move-executor
  handler-module mapping so `dodge`'s handler column resolves to `moves/dodgeCard.ts`
  (in the allowlist UP FRONT, learned from WP-273's mid-execution fold-in).

### H) Governance (at close)
`docs/ai/DECISIONS.md` (D-24051 Reserved → Active), `docs/ai/STATUS.md`,
`docs/ai/work-packets/WORK_INDEX.md` (WP-275 `[x]`), `docs/ai/execution-checklists/
EC_INDEX.md` (EC-306 → Done), `docs/05-ROADMAP-MINDMAP.md` (WP-275 ✅ + count table;
`roadmap-counts --check` green).

---

## Out of Scope

- **Teaching the sim/bot to dodge** (`ai.legalMoves.ts` / the competent policy). The
  move exists and is unit-tested, but the deterministic sweep never invokes it (the
  determinism lever). A follow-up WP can add dodge to the bot's repertoire (and re-pin
  the sentinel then).
- **The arena-client UI for the dodge action.** The engine accepts the `dodgeCard`
  intent; the player-facing "discard to draw" hand-card affordance in
  `apps/arena-client/**` is a follow-up client WP (the WP-248 → WP-249 engine/UX split
  pattern). No `apps/**` change here.
- **The `undercover` / `unleash` keywords + the face-down victory-pile zone model.**
  Coupled on the Black Widow deck; a separate, larger WP (or WP set). The
  dodge-entangled rider lines (Twilight Ops) flip not-hollow as a side effect of dodge
  becoming reachable, but unleash/undercover stay reported on their standalone lines.
- **The dodge "chain" rider semantics** (*"you may also Dodge another card from your
  hand"*). The base `dodgeCard` move already permits dodging any eligible hand card
  during the turn (no per-turn cap), so the rider's permission is satisfied; it adds no
  separate mechanic and is not separately modeled.
- **A per-turn dodge cap or a "once" limit.** The glossary states none; each dodge card
  may be dodged once (it leaves the hand). No counter is added.
- **Any `data/cards/**` re-marking** — the markers already exist; only the parser +
  the move change.
- **Registry / server / preplan / other-app change.**

---

## Files Expected to Change

### Implementation / tests
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** (keyword).
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** (`MVP_KEYWORDS` via `HAND_ACTION_EXECUTED_KEYWORDS`).
- `packages/game-engine/src/moves/dodgeCard.ts` — **new** (the move).
- `packages/game-engine/src/game.ts` — **modified** (register the move).
- `packages/game-engine/src/game.test.ts` — **modified** (move-set + count 11 → 12).
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (drift + parse).
- `packages/game-engine/src/moves/dodgeCard.test.ts` — **new** (the move's behavior).
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (MVP drift extend; no onPlay hollow; MVP membership).

### Regenerated artifacts (committed)
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv` — **regenerated**.
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**.
- `scripts/coverage/hero-effect-coverage.baseline.json` — **regenerated**.
- `data/metadata/card-mechanics.json` — **regenerated** (WP-269 feed).
- `scripts/coverage/mechanic-provenance.json` — **modified** (additive `dodge` entry).
- `scripts/hero-mechanic-ledger.mjs` — **modified** (extend the move-executor handler-module mapping for `dodge`).

### Governance (at close)
- `docs/ai/DECISIONS.md` — D-24051 Reserved → Active.
- `docs/ai/STATUS.md` — updated.
- `docs/ai/work-packets/WORK_INDEX.md` — WP-275 `[x]`.
- `docs/ai/execution-checklists/EC_INDEX.md` — EC-306 → Done.
- `docs/05-ROADMAP-MINDMAP.md` — WP-275 ✅ + count table.

**Total: ~14 implementation/artifact + 5 governance.** Over the lint §5 ~8 guideline —
justified inline: a recognized keyword backed by a NEW move is irreducibly *keyword +
MVP-classification + the move + its registration + the move-set drift test + their
behavior/drift tests*, and the change flips a CI-gated coverage surface so **every
committed coverage artifact must regenerate in the same commit** (the WP-273 precedent).
Single layer (game-engine + its tooling artifacts); no new contract file, no zone model,
no board-freeze guard.

---

## Vision Alignment

**Vision clauses touched:** §1 (faithful card behavior), §2 (card data — read-only),
§22 (determinism). **No conflict.** Makes a printed keyword execute as written; invents
no card text; re-marks no data. Determinism preserved (a new move the deterministic sweep
never invokes ⇒ zone state + sentinel unchanged; the move itself is a pure
hand→discard + deterministic deck-top draw). Non-Goals NG-1..7: none crossed.

## Funding Surface Gate

**N/A — justified.** Gameplay engine only; no funding affordance, copy, or channel.

## API Catalog (§21)

**N/A — justified.** `dodgeCard` is a boardgame.io move (a new gameplay intent), not an
`apps/server` HTTP endpoint or a `Library-only` catalog function. None added/modified/
removed.

---

## Acceptance Criteria

> **Binary — PASS requires ALL TRUE. Any single FALSE = failed execution (STOP).**

1. `HeroKeyword` union + `HERO_KEYWORDS` array each contain `'dodge'` once (same index);
   `'dodge' ∈ MVP_KEYWORDS`; the union↔array drift test passes.
2. Parsing a `[keyword:Dodge]` line yields a recognized `dodge` keyword on an **`onPlay`**
   hook with **no `unresolvedMarkers`** entry. Playing such a card mutates **no onPlay
   state** and fires **no hollow** — neither `parse-unrecognized` nor `no-handler` (the
   play-time-visited hook classifies `applied` via `MVP_KEYWORDS`).
3. `dodgeCard({ cardId })` for a dodge card in the player's hand **removes it from hand
   exactly once, appends it to discard exactly once, and draws exactly one replacement**
   (the deck-top card lands in hand; common case: hand net 0, discard +1, deck −1, modulo
   the empty-deck reshuffle) and appends the byte-locked `G.messages` line verbatim; it
   never routes the dodged card through `playCard` / `executeHeroEffects` (play-path
   exclusion). An ineligible call — non-dodge card, card not in hand, wrong stage, or a
   pending block-all choice — leaves `G` **unmutated**, proven by a
   `JSON.parse(JSON.stringify(G))` deep-equality snapshot (silent no-op, no throw).
4. The new move is registered: `LegendaryGame.moves` has **exactly 12** keys including
   `dodgeCard`; `game.test.ts`'s move-set list + count assertion + description string are
   updated and green. `dodgeCard` is NOT in `CORE_MOVE_NAMES` / `MOVE_ALLOWED_STAGES`;
   no `hasPending*` board-freeze guard is added.
5. The hero mechanic ledger shows `dodge` `executable` for all dodge lines/heroes with
   the `handler` column at `moves/dodgeCard.ts`; the runtime-observed sweep no longer
   lists a `dodge` entry (37 → 0).
6. `pnpm -r build` + `pnpm --filter @legendary-arena/game-engine test` exit 0 with the
   net-new cases; no pre-existing test regresses; the replay sentinel `finalStateHash`
   is unchanged OR re-pinned per WP-236 (scaffold-confirmed) AND the deterministic sweep's
   generated move stream contains **zero** `dodgeCard` intents (the bot never dodges).
7. Every committed coverage artifact is regenerated and its freshness gate passes:
   `pnpm ledger:heroes:check`, `pnpm sim:coverage --check`,
   `pnpm sim:runtime-observed:check`, `pnpm mechanics:metadata:check` all exit 0; the
   `mechanic-provenance.json` diff is additive (`dodge` only).
8. `git diff --name-only` lists exactly the files in `## Files Expected to Change`; no
   `data/cards/**`, `apps/**`, `packages/registry/**`, `apps/server/**`, or
   `ai.legalMoves.ts` change.
9. The existing `every MVP_KEYWORD is handled directly, via reveal translation, or at
   recruit time` drift test is extended to admit the `HAND_ACTION_EXECUTED_KEYWORDS`
   category and is green; the `HANDLED_KEYWORDS` count + handler-key bidirectional test
   are **unchanged** (no handler added). The negative contract is asserted: `dodge ∉
   HANDLED_KEYWORDS` and `dodge ∉ HERO_EFFECT_HANDLERS`. `dodge`'s not-hollow status holds
   at play time independent of whether the dodge move is ever invoked.

---

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine test          # BASELINE — record pass count
pnpm -r build                                            # exits 0
pnpm --filter @legendary-arena/game-engine test          # ≥ BASELINE + net-new; no regression
grep -c "dodge" packages/game-engine/src/rules/heroKeywords.ts          # 2 (union + array)
grep -n "dodgeCard" packages/game-engine/src/game.ts                    # move registered
grep -n "exactly 12 moves\|dodgeCard" packages/game-engine/src/game.test.ts   # move-set updated
grep -n "HAND_ACTION_EXECUTED\|dodge" packages/game-engine/src/hero/heroEffects.execute.ts   # MVP add via the hand-action category
pnpm ledger:heroes && pnpm sim:runtime-observed && pnpm mechanics:metadata   # regenerate
pnpm ledger:heroes:check && pnpm sim:coverage --check && pnpm sim:runtime-observed:check && pnpm mechanics:metadata:check   # all OK
grep -E ",dodge,executable," docs/ai/coverage/hero-mechanic-ledger.csv | head   # executable rows present
git diff --name-only -- data/cards/ apps/ packages/registry/ apps/server/ packages/game-engine/src/simulation/ai.legalMoves.ts   # empty
node scripts/roadmap-counts.mjs --check                  # passes (WP-275 ✅)
```

---

## Definition of Done

- [ ] All Acceptance Criteria (1–9) pass.
- [ ] `build` + engine `test` exit 0; the four coverage freshness gates pass; drift grep passes.
- [ ] `docs/ai/DECISIONS.md` D-24051 Reserved → Active (byte-identical to the EC-306 verbatim block).
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` WP-275 `[x]`; `EC_INDEX.md` EC-306 → Done; `05-ROADMAP-MINDMAP.md` WP-275 ✅; `roadmap-counts --check` green.
- [ ] No files outside `## Files Expected to Change` modified (esp. `ai.legalMoves.ts` byte-unchanged).
- [ ] `User-Visible Surface = dashboard.legendary-arena.com/coverage` — the `dodge`
      rows flip `unsupported → executable` on the deployed `/coverage` page AND the
      `/coverage` runtime-observed (Observed-in-play) section shows **zero** `dodge`
      entries (37 → 0), both D-24026 live-verified post-deploy. *(The in-game
      player-facing "discard to draw" affordance is the deferred arena-client follow-up;
      the engine move + the coverage surface are this WP's observable deliverable.)*

---

## Pre-Flight & Copilot Verdicts (01.0a Step 5)

Gate order pre-flight → copilot → lint, against `origin/main` @ `7a6f48b2`.

- **Hardening pass (2026-06-22) — gates re-affirmed, not re-run.** Post-draft tightening
  per `01.0a` Step 3 (an audit/hardening edit to an already-merged WP → `SPEC:` surgical
  correction, NOT new-WP drafting): locked the `G.messages` line to an exact byte string,
  and promoted the silent-no-op (deep-equality snapshot), move-ordering, play-path-exclusion,
  negative-classification (`dodge ∉ HANDLED_KEYWORDS`/`HERO_EFFECT_HANDLERS`), zone-count,
  honest-fix, and determinism-move-stream contracts to binary, test-asserted invariants
  (EC-306 §Hardened Invariants). **Scope, file allowlist, acceptance-criteria count (9),
  determinism posture, and the dependency set are unchanged** — the dimensions pre-flight
  (`01.4`) and copilot (`01.7`) evaluate are untouched, so READY + PASS stand; the lint
  self-review below still resolves all 21 sections (the edits strengthen §2/§12/§14/§16, add
  no files, renumber nothing). **Sequencing constraint:** this `SPEC:` correction MUST merge
  before WP-275's execution session opens (`01.0a` Step 3 critical-sequencing rule).

- **Pre-flight (01.4): READY TO EXECUTE (2026-06-21).** Class: **Behavior / State
  Mutation** (a new keyword + the first hand-resident optional move; mutates
  hand/discard/deck on dodge, no parked choice). Contract fidelity verified against
  source: `recruitHero` is the non-core internally-gated move precedent
  (`moves/recruitHero.ts`); `playCard` targets a hand card by `args.cardId`
  (`coreMoves.impl.ts:138`); `drawCardsIntoHand` is the draw helper
  (`moves/drawCards.logic.ts`); `game.test.ts` asserts **exactly 11 moves** (lines
  ~106–111) — `dodgeCard` makes it 12; `MVP_KEYWORDS` + `RECRUIT_TIME_EXECUTED_KEYWORDS`
  are the WP-273 move-executed precedent (`hero/heroEffects.execute.ts`); the marker
  `[keyword:Dodge]` exists across 25 lines (bkwd 10 + vill 15) and the glossary text is
  unambiguous. **The determinism lever is confirmed from source:**
  `packages/game-engine/src/simulation/ai.legalMoves.ts` enumerates moves **explicitly**
  (a hand-written list), NOT from `Game().moves`, and **no test asserts it covers the
  full move set** (`ai.legalMoves.test.ts` only checks per-scenario outputs) — so
  registering `dodgeCard` without adding it there is safe and keeps the sweep sentinel
  unchanged. Deps (WP-021/022/016/135/253/257/259/265/273) ✅ on `main`. Scope is a
  closed allowlist (game-engine + its tests + regenerated coverage artifacts +
  governance; `apps`/`registry`/`server`/`data/cards`/`ai.legalMoves.ts` out). **RS-1
  (clarifying, non-blocking):** the honest-fix proof (the `dodgeCard` move genuinely
  discards+draws), the ineligibility no-ops, the play-time not-hollow no-op, the 12-move
  registration, and the unchanged sentinel are scaffold-confirmed at execution. Verdict
  READY.
- **Copilot check (01.7): PASS (2026-06-21) — disposition CONFIRM.** Boundary (engine +
  its CI-gated coverage artifacts only; no `apps`/`registry`/`server`/`data/cards`; no
  registry import in the move/executor). Determinism (#2/#23 — a new registered move the
  deterministic sweep never invokes; pure hand→discard + deterministic deck-top draw;
  the sentinel is unchanged because `ai.legalMoves.ts` is untouched). Honest-fix /
  silent-vs-loud (#22 — the move is genuinely implemented, proven by the scaffold; not a
  bare keyword recognition that silences the hollow). Move-registration drift (the
  engine-specific failure mode from WP-248 — `game.test.ts` is in the allowlist UP FRONT,
  not a mid-execution amendment). Scope creep (#12/#30 — no pending-choice subsystem, no
  zone model, no bot integration, no other keyword; the undercover/unleash ecosystem +
  the client UI + bot-dodge are explicitly deferred). Honest-partial (#27 — the
  mixed-hook entanglement on Twilight Ops' rider line is correctly framed: dodge becomes
  reachable so the hook is not-hollow, while undercover/unleash stay reported on their
  standalone lines; nothing is special-cased or suppressed). No RISK/BLOCK.

---

## Lint Gate Self-Review (`00.3`)

**Verdict: PASS** — all 21 sections resolved (PASS or justified N/A); Final Gate clear.

- **§1 Structure:** PASS — Goal / Assumes / Context / Scope (In) / Out of Scope / Files /
  Non-Negotiable Constraints / Acceptance Criteria / Verification Steps / Definition of
  Done all present + non-empty; Out of Scope lists ≥4 exclusions.
- **§2 Constraints:** PASS — Engine-wide block requires full file contents, forbids
  diffs/snippets, states ESM/Node v22+, cites `00.6`; packet-specific + locked contract
  values present; no body contradiction.
- **§3 Assumes:** PASS — each dependency + the exact source surfaces (the move precedent,
  the timing-non-filter, the MVP move-executed category, the hand-card targeting, the
  existing markers) enumerated; the genuine confirm-at-execution items are flagged as RS-1.
- **§4 Context:** PASS — specific files/sections + DECISIONS ids (D-24024 / D-24049);
  the Dodge rules text sourced from the glossary; canonical field names honored.
- **§5 Files:** PASS — every changed file listed + marked (new/modified/regenerated), in
  three groups; explicit non-change list incl. `ai.legalMoves.ts`; over-8 justified inline
  (irreducible keyword + new move end-to-end + CI-gated artifact regen); single layer.
- **§6 Naming:** PASS — `dodge` / `dodgeCard` / `cardId` / `HAND_ACTION_EXECUTED_KEYWORDS`
  / `MVP_KEYWORDS` / `getHooksForCard` / `drawCardsIntoHand` match the engine vocabulary;
  no abbreviations.
- **§7 Dependencies:** PASS — no new npm deps; reuses the hook pipeline + zone/draw helpers.
- **§8 Architecture:** PASS — Game Engine layer only (+ its CI-gated coverage artifacts);
  `G` runtime-only; moves never throw; no registry import; no `.reduce()`; no
  persistence/snapshot change.
- **§9 Windows / §10 Env / §11 Auth:** N/A — Node built-ins; no shell-specific paths,
  env vars, or auth surface.
- **§12 Tests:** PASS — `node:test`, `.test.ts`, `makeMockCtx`; no boardgame.io/network/
  DB; determinism preserved (the sim never invokes the new move).
- **§13 Verification:** PASS — exact `pnpm` / `grep` / `node` commands with expected output.
- **§14 Acceptance:** PASS — 9 binary, observable, code-path-specific items.
- **§15 Definition of Done:** PASS — STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap +
  scope-boundary check. **§15.1:** `User-Visible Surface = dashboard.legendary-arena.com/
  coverage` declared with the D-24026 live-verify item (the deferred in-game affordance noted).
- **§16 Code Style:** PASS — `// why:` on the keyword, the `MVP_KEYWORDS` add, the
  block-all guards, the discard+draw, and the move registration; named imports; no
  `.reduce()`; small functions; full-sentence messages.
- **§17 Vision:** TRIGGERED (card behavior / determinism — §1/§2/§22). `## Vision
  Alignment` present with clause numbers, a no-conflict assertion, and a
  determinism-preservation line.
- **§18 Prose-vs-Grep:** PASS — the `grep` verification targets source/artifacts
  (`heroKeywords.ts` count, `game.ts`, the ledger CSV), not this WP's prose.
- **§19 Bridge-vs-HEAD:** N/A — not a repo-state-summarizing artifact.
- **§20 Funding Surface:** N/A with justification (gameplay engine; no funding surface).
- **§21 API Catalog:** N/A with justification (a boardgame.io move, not an `apps/server`
  endpoint / `Library-only` function).

Verdict: **PASS** — all 21 sections resolved; Final Gate clear. Execution remains gated on
the RS-1 scaffold confirming the move's honest-fix proof + the four coverage freshness
gates after regen.
