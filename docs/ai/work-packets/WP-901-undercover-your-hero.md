# WP-901 — "You may send one of your (other) Heroes Undercover": bkwd Black Widow and Red Guardian (Game Engine + Arena Client + card data)

**Status:** Draft 2026-11-16 (EC-939; D-24858 reserved, #3426) — pre-flight READY TO EXECUTE; copilot CONFIRM; 00.3 PASS
**Layer:** Game Engine (two handler-bearing hero keywords, a widened `PendingUndercoverChoice`, a declinable resolve, the bot default) + Arena Client (the existing Undercover prompt gains named hand / in-play targets and a decline) + card data
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay rules on three bkwd hero lines (a hollow starts working), a widened pending-choice contract with a declinable resolve, one client prompt, card data and derived feeds; finalStateHash sentinels byte-identical; no auth, money, persistence or server surface
**Hard-deps:** WP-678 / D-24494 (Undercover → Victory Pile, `sendCardUndercover`, `PendingUndercoverChoice`, `resolveUndercoverChoice`, the block-all guards, the projection and `UndercoverChoicePrompt.vue`) ✅, WP-679 / D-24495 (client prompt) ✅, WP-665 / D-24476 (`[keyword:draw-threshold:N]` → `cardsDrawnThisTurnAtLeast`, wait-and-see) ✅, WP-568 / D-24377 (deferred conditional grants fired from `turn.onMove`) ✅, WP-856 / D-24792 (a choice parked from a deferred grant) ✅, WP-767 / D-24600 ("your Heroes" = hand + played, Heroes only) ✅, WP-745 / D-24568 (origin; this is its follow-up G) ✅
**Sibling (not a dep):** WP-899 / D-24856 (follow-up E, played-this-turn view counts a card that left play) — **landed on `main` during this draft (`293255f4b`, #3429)**, so execution takes the EC "WP-899 landed" branch; see §Context "Coordination".

## Goal

Make three bkwd lines do what they print. Today each parses to a bare `[keyword:Undercover]` hook, an honest hollow with no
handler, so nothing happens:

| Line | Printed text | Gate |
|---|---|---|
| `bkwd/black-widow/weave-a-web-of-spies` ability 1 | If you drew any cards this turn, you may send one of your other Heroes Undercover. | draw ≥ 1 this turn (wait-and-see) |
| `bkwd/black-widow/infiltrate-the-conspiracy` ability 0 | You may send one of your Heroes Undercover. | none |
| `bkwd/red-guardian/death-was-only-a-ruse` ability 2 | [hc:covert]: You may send one of your other Heroes Undercover. | Covert class (already parsed) |

After this WP, each line opens the Undercover prompt listing the player's Heroes in hand and the Heroes they played this
turn ("other" leaves out the card itself), plus a **Don't send** button. A sent Hero goes to the Victory Pile and is worth
1 VP. Weave a Web of Spies played before any draw waits and opens the prompt when a card is drawn later that turn; with no
draw that turn it never opens.

## User-Visible Impact

`play.legendary-arena.com`: playing Infiltrate the Conspiracy opens "You may send one of your Heroes Undercover", with
"From your hand" and "Played this turn" groups showing card names (not ext ids) and a "Don't send" button. Picking a card
logs "Player N sent <Name> (<extId>) Undercover (into the Victory Pile, +1 VP)." (the `formatCardRef` form) and the card
appears in the Victory Pile; the final score counts it as 1 VP. "Don't send" logs "Player N chose not to send a Hero
Undercover." Weave a Web of Spies played before any draw logs the existing waiting line ("… is waiting — it needs 1 or more
cards drawn this turn — you have drawn 0. It will apply if you reach it this turn."), and the prompt opens after the next draw. Death Was Only a Ruse opens the prompt only when another Covert Hero was played. Live-on-surface is
operator-pending (D-24026).

## Assumes

- Baseline `origin/main` = `572ff95a7` (the WP-901 reserve merge, #3426; after the WP-899 / WP-900 reserves).
- **Parse today** (observed at the baseline, `buildHeroAbilityHooks` on `data/cards/bkwd.json`):
  Weave line 1 → `{ keywords: ['undercover'], effects: [{ type: 'undercover' }] }` (no condition); Infiltrate line 0 → the same;
  Ruse line 2 → `{ keywords: ['undercover','conditional'], conditions: [{ type: 'heroClassMatch', value: 'covert' }],
  effects: [{ type: 'undercover' }] }`. `undercover` is in `HERO_KEYWORDS` with no handler (WP-678: "honest hollow").
- `hero/heroEffects.execute.ts` exports `sendCardUndercover(G, playerID, cardId, fromZone): CardExtId[]` (moves the card to
  `victory`, appends it to `zones.undercover`, logs, returns the new source array; a missing card returns `fromZone`).
  `heroEffectUndercoverHandShieldHero` (0 → no-op, 1 → auto-send, ≥2 → park) and `heroEffectUndercoverOfficerStack` are the two
  handlers; both keywords are in `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`.
- `types.ts` `PendingUndercoverChoice { playerID; cardId; source: 'hand-shield-hero'; eligibleTargets: CardExtId[] }`;
  `G.pendingUndercoverChoice?: PendingUndercoverChoice[]` (lazy FIFO). `moves/undercover.resolve.ts`
  `resolveUndercoverChoice({ targetExtId })` validates the front entry and sends from hand; `hasPendingUndercoverChoice`
  feeds the block-all guards and `getLegalMoves`.
- `ui/uiState.types.ts` `UIPendingUndercoverChoice { playerID; eligibleTargets: string[] }`; `uiState.build.ts` projects the
  front entry; `uiState.filter.ts` rebuilds it for the chooser only. `UIEligibleKoHeroCard { zone; cardId; display }` is the
  named-card shape the optional-KO and Smash prompts reuse (WP-676 precedent).
- `simulation/ai.legalMoves.ts` resolves a pending Undercover pick first with `eligibleTargets[0]`.
- `[keyword:draw-threshold:1]` → `cardsDrawnThisTurnAtLeast:1`, in `WAIT_AND_SEE_CONDITION_TYPES`: a hook that fails it at play
  records a deferred grant; `resolveDeferredHeroGrants` (`turn.onMove`) re-evaluates all of the hook's conditions and fires it
  through `runHookEffects`, the same dispatch as play, so a handler that parks a choice parks it from there (WP-856 precedent).
- Scoring awards 1 VP per `zones.undercover` entry (WP-678, `scoring/scoring.logic.ts`); unchanged.
- Other exports and shapes the change reads: `log/logDisplay.ts` `formatCardRef(cardDisplayData, extId)`; `setup/pilesInit.ts`
  `WOUND_EXT_ID`, `BYSTANDER_EXT_ID`, `SHIELD_AGENT_EXT_ID`, `SHIELD_TROOPER_EXT_ID`; `ui/uiState.build.ts` private
  `resolveDisplay` (the optional-KO named-card builder); `apps/arena-client/src/components/play/UndercoverChoicePrompt.vue` takes
  the prop `pendingUndercoverChoice: UIPendingUndercoverChoice | undefined` and submits
  `submitMove('resolveUndercoverChoice', { targetExtId })` (props unchanged here); `scripts/build-local-spike-bundle.mjs`
  supports `--check`.
- `data/cards/bkwd.json` is GENERATED; markers come from `scripts/convert-cards/inputs/hero-ability-markers.json` via
  `apply-hero-ability-markers.mjs`, whose `VALID_TOKEN_PATTERN` must list every token.

## Context (Read First)

- **Rules (primary text).** `docs/legendary-universal-rules-v23.md` §Undercover (~L2043-2052): "Some cards say things like 'You
  may send one of your other Heroes Undercover.' This means 'Put that Hero into your Victory Pile. It's worth 1 Victory
  Point.'" … "If you play a card that sends itself Undercover, you still get to use its [icons] and other abilities." Glossary
  "'Your Heroes/Allies' & 'Heroes/Allies You Have'" (~L3436-3445): "These phrases include both the cards in your hand and the
  cards you have played this turn. The Heroes in your deck and discard pile don't count." So eligibility = hand + in play.
  "Other" leaves out the triggering card (the played copy, by its per-copy ext id).
- **What is a Hero.** Not `WOUND_EXT_ID`, not `BYSTANDER_EXT_ID` (WP-828 / WP-856 / WP-767 precedent). S.H.I.E.L.D. Agents,
  Troopers, Officers and Sidekicks are Heroes.
- **Why a decline.** Unlike the shld hand-shield shape (D-24494: auto-send at 1, no decline), sending a strong Hero loses it for
  the rest of the game. "You may" is a real choice even with one eligible card, so the new shape always parks when anything is
  eligible and always offers "Don't send". The rules' own advice ("This can help get your starting S.H.I.E.L.D. Agents and
  Troopers out of your deck") is the bot default.
- **Bot default.** Send a played S.H.I.E.L.D. Agent or Trooper still in play first (it already paid out this turn), else one
  still in hand, else decline. Deterministic: first match in zone order.
- **Leaving play mid-turn.** Sending an in-play Hero removes it from `inPlay` (the same array edit the in-play KO makes,
  `optionalKoReward.resolve.ts`). Its already-granted resources stay. Per the glossary it no longer counts among "your Heroes".
  It drops out of the played-this-turn view that the play-history gates read (the D-24798 §5 / D-24568 §2 residual, now with a
  second exit).
- **Coordination (WP-899, follow-up E).** WP-899 records cards that leave play in the played-this-turn view. Whichever lands
  second wires the Undercover-from-play exit (`resolveUndercoverChoice`, `zone: 'inPlay'`) into it. Agreed with the WP-899
  session (2026-11-16): the call is `G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, targetExtId)` (exported from
  `economy/economy.logic.ts`), made in `resolveUndercoverChoice` right after an in-play send. If WP-899 has landed when this WP
  executes, make that call, add the row `moves/undercover.resolve.ts#resolveUndercoverChoice: 1` to WP-899's
  `LOCKED_LEFT_PLAY_RECORD_TABLE` drift pin (`hero/playedCardLeftPlay.test.ts`), and test the record directly (the send passes
  `zones.inPlay` as a parameter, so WP-899's literal `.inPlay` write-scan cannot see it); record the three edits in an EC
  amendment. If WP-899 has not landed, WP-899 wires it. This WP adds no played-history field of its own.
- **Bare token stays descriptive.** A line carrying a your-hero source marker suppresses the bare `[keyword:Undercover]`
  keyword (a line flag, the size-changing / investigate pattern), so the hook carries only the handled keyword and the hollow
  disappears. The ~53 other bare-token lines are unchanged.
- **Wait-and-see park.** Weave played before a draw: the hook's `cardsDrawnThisTurnAtLeast:1` fails, the grant is deferred and the
  existing waiting line logs. A later draw → `resolveDeferredHeroGrants` → `runHookEffects` → the new handler parks the choice
  after that move. Played after a draw: parks on play. Never parks without a draw. The WP-855 deck-KO draw hold does not apply
  (this grant draws nothing). A parked Undercover pick beside another open queue is fine: each resolve validates its own front,
  and `canDecline` means the pick can always be closed even if a target left its zone meanwhile.
- **Stale target.** Another queue may move a snapshotted target first. For a `'your-hero'` entry the resolve checks the card is
  still in the named zone; if not, it returns without popping (the player picks another card or declines). A hand-shield entry
  keeps today's path (send is a no-op if the card left, then pop).
- **Log names.** `sendCardUndercover`'s log prints the raw ext id today, and `computeStateHash` hashes `messages`, so changing
  that line would re-hash every older match that sent any card Undercover (shld / 2099 included). So the shared helper's log
  stays byte-identical: a new exported `moveCardUndercover(G, playerID, cardId, fromZone)` does the move + tracker with no
  log, `sendCardUndercover` becomes `moveCardUndercover` + its unchanged raw-id log, and only the `'your-hero'` send logs the
  card through `formatCardRef(G.cardDisplayData, …)`. Naming the card on the older shapes is a follow-up (it re-hashes their
  replays, a D-24616 §5 call). No sentinel sends a card Undercover.
- **Hash safety.** No new `G` key. The pending entry gains optional fields written only for the new source. No core card prints
  these lines; the sentinels (core Black Widow + Captain America) never touch the new code. A moved sentinel is a STOP.
- **Single WP.** Engine + client is one change: the widened pending entry is unusable without the prompt that renders in-play
  targets and the decline (the bot alone would ship a freeze for humans). ~25 files, most generated.
- **Out-of-scope neighbours (observed in the same corpus sweep).**
  - Infiltrate the Conspiracy line 1 ("+3 Attack if you have at least 4 Bystanders and/or Undercover Heroes in your Victory
    Pile") parses to an **unconditional +3 Attack** today. Gating it needs a new Victory-Pile count condition, and its printed
    order matters: line 0's choice parks before line 1 evaluates, so an on-play gate reads the pile before the send. A faithful
    fix is its own design call (follow-up H).
  - Yelena Belova's "Unleash one of your Heroes from Undercover" lines (Victory Pile → hand; rules "Unleash from Undercover").
  - `bkwd/yelena-belova/destroy-the-red-room` ability 1 "You may send a Hero from your discard pile Undercover" (a discard source
    shape) and the "Send this Undercover" / "When Recruited: Send this Undercover" self-sends.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (§5.1 `[keyword:X]` token types) — the two new
  markers. `docs/ai/ARCHITECTURE.md` §Layer Boundary and `.claude/rules/architecture.md` §Layer Boundary — the client change
  consumes the engine projection only (Runtime-Safe Engine Surface).
- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, Principle #1, §Persistence Boundary; `.claude/rules/architecture.md`
  §UIState Projection Integrity (the five-step Board-Visible Field Rule).
- `docs/ai/DECISIONS.md` — scan D-24494, D-24495, D-24476, D-24377, D-24792, D-24791, D-24600, D-24568, D-24798, D-12803,
  D-24372, D-24026 before coding. `docs/ai/REFERENCE/00.6-code-style.md` for every file.

## Scope (In)

- **Markers** (`hero-ability-markers.json`, `bkwd`, appended in this order):
  1. `{ heroSlug: "black-widow", cardSlug: "weave-a-web-of-spies", abilityIndex: 1, markupToken: "[keyword:undercover-your-other-hero]" }`
  2. same keys, `markupToken: "[keyword:draw-threshold:1]"`
  3. `{ heroSlug: "black-widow", cardSlug: "infiltrate-the-conspiracy", abilityIndex: 0, markupToken: "[keyword:undercover-your-hero]" }`
  4. `{ heroSlug: "red-guardian", cardSlug: "death-was-only-a-ruse", abilityIndex: 2, markupToken: "[keyword:undercover-your-other-hero]" }`
  `VALID_TOKEN_PATTERN` gains `^\[keyword:undercover-your-hero\]$` and `^\[keyword:undercover-your-other-hero\]$` (next to the
  two WP-678 arms) and the locked-forms message lists them. Regenerate `bkwd.json`.
- **Keywords.** `rules/heroKeywords.ts`: `'undercover-your-hero'` and `'undercover-your-other-hero'` join the `HeroKeyword`
  union and `HERO_KEYWORDS` after `'undercover-officer-stack'`. `heroEffects.execute.ts`: both join `HANDLED_KEYWORDS` and
  `NO_MAGNITUDE_KEYWORDS`, and `HERO_EFFECT_HANDLERS` maps both to one handler, `heroEffectUndercoverYourHero`, which reads
  `effect.type` to decide whether to leave out the triggering card. Lockstep pins (values at `572ff95a7`; the +2 / +2 intent
  governs if they moved): three `HERO_KEYWORDS.length` pins 101 → 103 (`rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`), the ordered `expectedKeywords` array in
  `rules/heroAbility.setup.test.ts` (the two names **inserted** after `'undercover-officer-stack'`), and two
  `HERO_EFFECT_HANDLERS` count pins 80 → 82 in `hero/heroEffects.execute.test.ts`. Nothing reads `HERO_KEYWORDS` by position.
- **Parser.** `setup/heroAbility.setup.ts`: the two names are valid `HeroKeyword`s, so the generic keyword arm pushes them. A
  line flag (`lineHasUndercoverYourHeroMarker`) set when the line holds either marker makes the per-token loop skip the bare
  `undercover` keyword on that line. No change to the choose-one pre-pass or its option markers.
- **Handler** `heroEffectUndercoverYourHero(G, ctx, playerID, cardId, effect)`: eligible hand = hand cards that are Heroes;
  eligible in play = in-play cards that are Heroes and, for `undercover-your-other-hero`, not `cardId`. 0 eligible → log "Player N
  had no other Hero to send Undercover for <card>." (or "no Hero") and park nothing. ≥1 → lazy-init the queue and push
  `{ playerID, cardId, source: 'your-hero', eligibleTargets: [...hand], eligibleInPlayTargets: [...inPlay], canDecline: true }`
  (silent park).
- **Contract** (`types.ts`): `PendingUndercoverChoice.source` becomes `'hand-shield-hero' | 'your-hero'`; new optional
  `eligibleInPlayTargets?: CardExtId[]` and `canDecline?: boolean`, written only for `'your-hero'`. `eligibleTargets` keeps
  meaning the hand targets. The hand-shield path writes exactly what it writes today.
- **Resolve** (`moves/undercover.resolve.ts`): `ResolveUndercoverChoiceArgs` becomes the XOR union
  `{ decline: true } | { targetExtId: CardExtId; zone?: 'hand' | 'inPlay' }` (the `optionalKoReward` / `smashDiscard`
  precedent; existing `{ targetExtId }` callers still type-check). Order: validate args (an object; exactly one form — both
  `decline` and `targetExtId` present → return, no pop; `zone` absent / `'hand'` / `'inPlay'`) → validate the front entry
  (non-empty, `playerID` match) → decline: only when `front.canDecline === true`; log "Player N chose not to send a Hero
  Undercover." and pop → send: the target must be in the snapshot for its zone (`'hand'` → `eligibleTargets`, `'inPlay'` →
  `eligibleInPlayTargets ?? []`). For a `'your-hero'` entry it must also be present in that zone now, else return without
  popping (the player picks another card or declines); then `moveCardUndercover` from that zone, log "Player N sent
  <formatCardRef> Undercover (into the Victory Pile, +1 VP).", and pop. A hand-shield entry
  rejects `decline` and `zone: 'inPlay'` and keeps today's path exactly (snapshot check → send, a no-op if the card left →
  pop), so it can never freeze.
- **Projection** (`ui/uiState.types.ts`, `uiState.build.ts`, `uiState.filter.ts`): `UIPendingUndercoverChoice` gains optional
  `eligibleHand?: UIEligibleKoHeroCard[]`, `eligibleInPlay?: UIEligibleKoHeroCard[]`, `canDecline?: boolean`, present only for a
  `'your-hero'` front entry (built from the snapshot ids **still present in their zone**, with `resolveDisplay`, fresh
  spreads, so the chooser never sees a button the resolve refuses); the filter copies them field by field
  for the chooser, entry by entry (the optional-KO copy pattern), and omits them when absent. `eligibleTargets` stays.
- **Bot** (`simulation/ai.legalMoves.ts`): for a `'your-hero'` front, a new exported pure
  `selectDefaultUndercoverYourHeroTarget(front, zones: { hand: readonly CardExtId[]; inPlay: readonly CardExtId[] })` in
  `moves/undercover.resolve.ts` returns `{ zone, targetExtId }` for the first `SHIELD_AGENT_EXT_ID` / `SHIELD_TROOPER_EXT_ID`
  in `eligibleInPlayTargets` that is still in `zones.inPlay`, else in `eligibleTargets` still in `zones.hand`, else `null` →
  `{ decline: true }`. Reading live zones keeps `getLegalMoves` from offering a move the resolve refuses (no sim / PAR /
  autoplay loop). The hand-shield front keeps `eligibleTargets[0]`. One move returned, as today.
- **Log.** `moveCardUndercover` (new, exported, no log) is extracted from `sendCardUndercover`, which keeps its raw-id log
  byte-identical; only the `'your-hero'` resolve logs the card name (§Context "Log names").
- **Write rules.** On a `'your-hero'` entry `canDecline` is always written `true` and `eligibleInPlayTargets` is always written
  (possibly `[]`); on a hand-shield entry neither key is written. `canDecline` is never written `false` and is read `=== true`
  (the D-24600 `koHeroesOnly` precedent). The same rule holds for `UIPendingUndercoverChoice.canDecline`.
- **Client** (`UndercoverChoicePrompt.vue`): when `eligibleHand` / `eligibleInPlay` are present, render heading "You may send one
  of your Heroes Undercover", a "From your hand" and a "Played this turn" group of named buttons (`display.name`, `CardImage`
  when `imageUrl`), each submitting `resolveUndercoverChoice({ zone, targetExtId })`, and, when `canDecline`, a "Don't send"
  button submitting `{ decline: true }`. Otherwise the existing S.H.I.E.L.D. rendering is unchanged. No page change (props same).
- **Ledger / coverage.** `mechanic-provenance.json` rows `undercover-your-hero` and `undercover-your-other-hero` (WP-901 /
  D-24858); pending `live-verify.json` rows `bkwd/black-widow|undercover-your-hero`, `bkwd/black-widow|undercover-your-other-hero`,
  `bkwd/red-guardian|undercover-your-other-hero`; regenerate `ledger:heroes`, `effect-index`, `mechanics:metadata`,
  `sim:runtime-observed`, `sim:coverage --update-baseline` (only if it moves), the local-spike bundle
  (`apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` embeds every set's card text, so the `bkwd.json` regen
  changes it; EC-782 precedent; its `initialStateHash` stays `495e9cc2`, the featured table is core-only), and the dashboard
  `prebuild:coverage`; re-pin `useInPlayCoverage.test.ts` only if the fresh feed moves it.
- **Tests** (new `hero/undercoverYourHero.test.ts` unless noted; hooks parsed from the committed `bkwd.json`):
  parse — Weave line 1 `keywords` include `undercover-your-other-hero` and not `undercover`, `conditions` include
  `{ cardsDrawnThisTurnAtLeast, '1' }`, no `unresolvedMarkers`; Infiltrate line 0 carries `undercover-your-hero`, no condition;
  Ruse line 2 carries `undercover-your-other-hero` and keeps `heroClassMatch:covert`; play — Weave with no draw parks nothing and
  logs the waiting line; a later draw then `resolveDeferredHeroGrants` parks one entry; Weave after a draw parks on play; no draw
  all turn → nothing parked at turn end; eligibility — hand + in play, Weave excluded from its own entry, Infiltrate included in
  its own, Wound / Bystander never listed, 0 eligible → no park + log; resolve — hand send and in-play send move the card to
  `victory` + `undercover` and pop; score +1 VP; decline pops and changes no zone; a stale `'your-hero'` target (moved away)
  returns without popping; a stale hand-shield target still pops (today's path); `zone: 'inPlay'` / `decline` against a
  hand-shield entry is rejected; bot — Agent in play beats Agent in hand beats decline; a strong-Hero-only set declines; a stale
  snapshot Agent is skipped (next Agent, or decline); args with both `decline` and `targetExtId` are refused without popping;
  multi-entry queue — two deferred Weave grants (two copies) and one draw park two entries; resolving the front sends X; the
  second front's projection omits X, the resolve refuses X without popping, and the bot picks a live target or declines; a
  hand-shield send logs the raw id exactly as before; projection — a stale snapshot id is not projected, and `uiState.filter.test.ts` chooser sees `eligibleHand` / `eligibleInPlay`
  / `canDecline`, opponents and spectators see no `pendingUndercoverChoice`, a hand-shield entry projects no new keys;
  `UndercoverChoicePrompt.test.ts` — named groups, decline button, payloads, legacy rendering unchanged (repeated starter ids:
  `findAll`). The lockstep pins move by exactly +2 keywords / +2 handlers. Existing WP-678 / WP-679 tests pass unedited.

## Out of Scope

- Infiltrate the Conspiracy line 1's "+3 if 4 Bystanders and/or Undercover Heroes" gate (follow-up H, §Context).
- Unleash from Undercover; the discard-source shape; "Send this Undercover" and "When Recruited: Send this Undercover".
- The ~53 other bare `[keyword:Undercover]` lines; any change to the shld hand-shield or officer-stack behaviour, including their raw-id
  Undercover log line (naming the card there re-hashes older replays; follow-up).
- A played-this-turn history field (WP-899 owns it, §Context "Coordination").
- New moves, `CORE_MOVE_NAMES` entries, `G` fields, phases or stages; page-level client changes.

## Files Expected to Change

- `packages/game-engine/src/rules/heroKeywords.ts` — **modified** — two union members + `HERO_KEYWORDS` entries.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — sets, handler, registry entry, `moveCardUndercover` extraction.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — bare-token suppression line flag.
- `packages/game-engine/src/types.ts` — **modified** — `PendingUndercoverChoice` widening (contract; D-24858).
- `packages/game-engine/src/moves/undercover.resolve.ts` — **modified** — args, decline, zone, stale check, bot default helper.
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIPendingUndercoverChoice` optional fields (contract; D-24858).
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — projection.
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** — pass-through.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — bot default.
- `packages/game-engine/src/index.ts` — **modified only if** the client needs a newly exported type (expected unchanged).
- `apps/arena-client/src/components/play/UndercoverChoicePrompt.vue` — **modified**.
- `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified**.
- `data/cards/bkwd.json` — **modified (generated)**.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json` (only if it moves), `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`, `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json`, dashboard data copies (gitignored
  `apps/dashboard/src/data/*`, not committed);
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, only if it moves).
- **Only if WP-899 has landed at execution:** `packages/game-engine/src/hero/playedCardLeftPlay.test.ts` — **modified** — one
  `LOCKED_LEFT_PLAY_RECORD_TABLE` row (`moves/undercover.resolve.ts#resolveUndercoverChoice: 1`); the `recordPlayedCardLeftPlay`
  call itself is in `moves/undercover.resolve.ts` (already listed) and its direct test in `undercoverYourHero.test.ts`.
- Tests: `packages/game-engine/src/hero/undercoverYourHero.test.ts` (new), `rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts` (lockstep pins), `moves/undercover.resolve.test.ts`
  (expected unchanged), `ui/uiState.filter.test.ts`, `simulation/ai.legalMoves.test.ts` (only if a bot case
  fits there better than the new file), `apps/arena-client/src/components/play/UndercoverChoicePrompt.test.ts`.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24858), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/post-mortems/` (01.6).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets; ESM only; Node v22+; human-style code — see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O; moves never throw; `for` loops, no `.reduce()`; no nested ternaries.
- `G` stays JSON; no new `G` key; the new pending fields exist only on `'your-hero'` entries. `finalStateHash` sentinels
  serialize byte-identically — **no re-pin**. A moved sentinel is a STOP.
- The hand-shield and officer-stack shapes behave exactly as before (WP-678 / WP-679 tests green and unedited; their log line
  byte-identical).
- Card data via the marker source + reproducible regen; never hand-edit `bkwd.json`. No per-card special-casing in parser or
  handler (the "other" variant is a keyword, not a card check).
- Five-step Board-Visible Field Rule for every new `UIPendingUndercoverChoice` field.

**Session protocol:** STOP and report if: a parsed hook still carries the bare `undercover` keyword on the three lines; Weave
parks with no draw this turn; a sentinel moves; a WP-678 / WP-679 test needs any change.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- Keywords `undercover-your-hero` (self-inclusive) and `undercover-your-other-hero` (leaves out the triggering card);
  markers `[keyword:undercover-your-hero]`, `[keyword:undercover-your-other-hero]`.
- `PendingUndercoverChoice { playerID; cardId; source: 'hand-shield-hero' | 'your-hero'; eligibleTargets: CardExtId[];
  eligibleInPlayTargets?: CardExtId[]; canDecline?: boolean }` (amends D-24494).
- `ResolveUndercoverChoiceArgs = { decline: true } | { targetExtId: CardExtId; zone?: 'hand' | 'inPlay' }` (absent `zone` =
  hand; both forms present → refused, no pop).
- `moveCardUndercover(G, playerID, cardId, fromZone): CardExtId[]` — `sendCardUndercover` minus its log (exported).
- Write rule: on a `'your-hero'` entry `canDecline: true` and `eligibleInPlayTargets` (possibly `[]`) are always written; on
  a hand-shield entry neither key exists; `canDecline` is never `false`, read `=== true`.
- `UIPendingUndercoverChoice` + `eligibleHand?: UIEligibleKoHeroCard[]`, `eligibleInPlay?: UIEligibleKoHeroCard[]`,
  `canDecline?: boolean`. Board-Visible steps: (1) types, (2) `uiState.build.ts`, (3) `uiState.filter.ts` pass-through,
  (4) `uiState.filter.test.ts` chooser / opponent / spectator cases, (5) the live check reads
  `uiStateSnapshot.pendingUndercoverChoice.eligibleInPlay` and `canDecline: true`.
- `selectDefaultUndercoverYourHeroTarget(front, zones: { hand: readonly CardExtId[]; inPlay: readonly CardExtId[] }):
  { zone: 'hand' | 'inPlay'; targetExtId: CardExtId } | null` (live-zone filtered).

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22.
- **No conflict:** three printed abilities that do nothing today resolve as printed, with the printed "may".
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — +1 VP per Undercover Hero is earned through a card's printed text.
- **Determinism preservation:** no randomness; the bot default is a fixed scan; no new `G` key; sentinels byte-identical.
  Seed-PAR is scheme-keyed. Replays of pre-WP-901 matches that played these three cards diverge on re-execution (the
  undercover hollow parked nothing); matches that sent a card Undercover through the shld / 2099 shapes do not (their log
  line is unchanged); stored `competitive_scores` rows stay frozen (D-24616 §5). Hooks are built in
  `Game.setup`, so in-flight matches keep the old hooks.

## Funding Surface Gate

N/A — no funding, nav or account surface; one in-game prompt gains named targets and a decline.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. The three lines parse as §Tests "parse" states; no hook on them carries the bare `undercover` keyword or an unresolved marker.
2. Weave a Web of Spies parks only after a card was drawn this turn (on play if already drawn, else after the drawing move);
   never with no draw.
3. Infiltrate parks with no gate; Death Was Only a Ruse parks only with another Covert Hero played.
4. The entry lists Heroes in hand and in play; "other" leaves out the card itself; Wounds and Bystanders never appear; 0 eligible
   parks nothing and logs why.
5. Sending moves the card from its zone to the Victory Pile and the Undercover tracker (+1 VP at scoring); "Don't send" changes
   no zone; both pop the entry. A stale `'your-hero'` target is refused without popping; a stale hand-shield target still
   pops (today's path).
6. A hand-shield entry behaves exactly as before (no decline, no in-play target).
7. The bot sends a played Agent / Trooper, else one from hand, else declines.
8. The chooser sees named hand / in-play targets and `canDecline`; opponents and spectators see no pending Undercover pick; the
   client renders both groups and "Don't send", and the S.H.I.E.L.D. prompt is unchanged.
9. `cards:check` reproduces `bkwd.json`; the ledger lists the two keywords as executable for the two heroes; every feed `:check`
   exits 0.
10. `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail; arena-client `typecheck` 0; sentinels unchanged with no pin edited.

## Verification Steps

- Add the two provenance rows and three pending live-verify rows first.
- `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exits 0; only `bkwd.json` changes; a second run is zero-diff.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `node scripts/build-local-spike-bundle.mjs` (then `--check` 0; `initialStateHash` stays `495e9cc2`),
  `pnpm --filter @legendary-arena/dashboard prebuild:coverage` — each exits 0 (plus `sim:coverage --update-baseline` only if
  its check fails).
- `pnpm -r --no-bail test` — 0 fail, per-package totals recorded (engine baseline at `572ff95a7`: 7343 pass / 0 fail, 1652
  suites; expect roughly +25 engine tests — record the exact delta).
- `pnpm --filter @legendary-arena/arena-client typecheck` — 0.
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
  `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` — each 0.
- At close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `node scripts/check-number-ledger.mjs --check` — 0.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail; arena-client typecheck 0.
- [ ] Feeds regenerated, every `:check` green; provenance + pending live-verify rows present.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** an operator match **created after the deploy** with bkwd Black Widow and Red Guardian:
      Weave before any draw waits (log), then after a draw the prompt opens with hand + in-play Heroes and "Don't send"
      (`uiStateSnapshot.pendingUndercoverChoice.canDecline === true`); sending puts the Hero in the Victory Pile (+1 VP);
      declining does nothing; Infiltrate prompts with no gate; Death Was Only a Ruse prompts only with another Covert Hero
      played — confirmed live in its own `SPEC:` PR, or operator-pending in `STATUS.md` with the pending rows.
- [ ] `STATUS.md`; D-24858 → Active; `WORK_INDEX.md` `[x]` + `[live-verify: pending]`; `EC_INDEX.md` Done; mindmap ✅ +
      `roadmap:counts:write`; NUMBER-LEDGER LANDED; 01.6 post-mortem (new contract fields).
- [ ] No files outside `## Files Expected to Change` modified — `git diff --name-only origin/main...HEAD` checked.

## Reserved Decision (lands at execution)

D-24858 — "You may send one of your [other] Heroes Undercover" is a third Undercover source shape (extends D-24494):
handler-bearing keywords `undercover-your-hero` / `undercover-your-other-hero` over the player's Heroes in hand **and in play**
(rules v23 glossary "Your Heroes"; "other" leaves out the triggering card; a Hero is not a Wound or Bystander). Unlike the
hand-shield shape it always parks when anything is eligible and is declinable ("you may"; sending a strong Hero is a real cost),
so `PendingUndercoverChoice` gains `source: 'your-hero'`, `eligibleInPlayTargets?` and `canDecline?`, and the resolve takes
`zone?` and `decline?` (the hand-shield entry is unchanged). The bot sends a S.H.I.E.L.D. Agent / Trooper (played first) or
declines. A draw-gated line waits via D-24476 and parks from the deferred resolve (D-24792 precedent). An in-play send leaves
`inPlay`; recording it in the played-this-turn view is WP-899's (whichever lands second). The `'your-hero'` send logs the card by `formatCardRef`; the shared `sendCardUndercover` log is unchanged (a
`moveCardUndercover` helper is extracted), so older Undercover replays keep their hashes. Resolve args are the XOR union
`{ decline: true } | { targetExtId; zone? }`. On a `'your-hero'` entry `canDecline` is always `true` and
`eligibleInPlayTargets` always present; neither exists on a hand-shield entry.
`UIPendingUndercoverChoice` gains `eligibleHand?` / `eligibleInPlay?` / `canDecline?` (chooser-only).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1 (independent subagent, 2026-11-16):** NOT READY — three text defects, no scope change. PS-1: the
  lockstep pin list named two `HERO_KEYWORDS` length pins; HEAD has three (101) plus the ordered array and two handler-count pins
  (80), and `setup/heroAbility.setup.test.ts` was off the allowlist — fixed in §Scope Keywords, §Files and the EC. PS-2: the
  stale-target no-pop applied to hand-shield entries too, which have no decline and would freeze — scoped to `'your-hero'`;
  hand-shield keeps today's pop, with a test. PS-3: the bot default read only the snapshot, so a stale target would loop
  `getLegalMoves` — it now takes the live hand / in-play zones, with a test. RS-1 local-spike bundle regen made unconditional
  (hash `495e9cc2` unchanged); RS-2 the waiting line and `formatCardRef` text corrected; RS-3 the projection lists only ids
  still in their zone; RS-4 repeated starter ids keyed by zone + index (EC), tests use `findAll`; RS-5 / RS-6 no action.
  Verified at HEAD: the three parses, every cited symbol and line, the deferred-grant park path, the block-all guards, no
  raw-id log assertion, the only sentinel (`sentinel-core-doom-2p`) has no shld / bkwd cards, dependencies all `[x]`, engine
  7343 / 0 / 1652 suites.
- **Pre-flight round 2:** NOT READY → two leftover one-line inconsistencies, folded: PS-4 §Context "Stale target" and AC-5 still
  applied the no-pop to every entry (now `'your-hero'` only, hand-shield pops as today); PS-5 the EC Guardrails still named the
  old pin count (now three length pins + ordered array + two handler-count pins). Optional cleanups applied (Tests wording, EC
  `// why:` scope, §Context bot "still in its zone"). Every round-1 fix verified landed; WP / EC file lists match. With PS-4 /
  PS-5 applied the subagent's verdict is **READY TO EXECUTE** (no scope change, no re-run required).
- **Copilot round 1 (independent subagent):** RISK → HOLD, five scope-neutral fixes, all folded: (#10/#21) resolve args are an
  XOR union `{ decline: true } | { targetExtId; zone? }`, both-present refused, with a test; (#28) the hashed log: changing
  `sendCardUndercover`'s line would re-hash every older shld / 2099 Undercover replay, so a log-free `moveCardUndercover` is
  extracted, the shared log stays byte-identical, and only the `'your-hero'` send names the card (naming on the old shapes is a
  follow-up); (#12/#30) the one WP-899-conditional file, `hero/playedCardLeftPlay.test.ts`, is named in §Files and the EC, and
  WP-899's session has recorded its side of the obligation in its Context (2026-11-16 message); (#11) a multi-entry queue test
  (two Weave grants, one draw, two entries, a sent card refused on the second); (#5) write rule locked — `canDecline` always
  `true` or absent, `eligibleInPlayTargets` always present (possibly `[]`) on `'your-hero'`, neither on hand-shield. Verified:
  rules fidelity, no parked entry crosses a turn (`endTurn` refuses; the cleanup draw does not count), the WP-855 hold covers
  this queue, pins 101 / 80 at HEAD, no other path keys on `source` or the args, the in-play send mirrors the shipped in-play KO.
- **Copilot round 2:** **PASS → CONFIRM** — all five fixes verified in the WP and EC and mutually consistent; one garbled EC
  line (the WP-899 amendment wording) reworded. Pre-flight READY TO EXECUTE stands (no allowlist, contract or scope change).
  Governance follow-up (not blocking): when WP-899 is drafted, its WP / EC names the `resolveUndercoverChoice` in-play exit for
  the WP-901-first case.

## Lint Gate Self-Review (00.3)

Run as an independent subagent 2026-11-16. Run 1: FAIL on five mechanical text gaps (§15.2 Risk Tier missing in WP and EC;
§4 00.2 §5 + Layer Boundary not cited; §2 "no diffs, no snippets" not explicit; §3 read exports not listed; EC lacked the
arena-client typecheck and the `roadmap:counts:check` step). All five folded verbatim, plus the two optional cleanups (dashboard
copies marked gitignored; WORK_INDEX row says only the `'your-hero'` send names the card). Run 2: PASS (below).

- **§1 structure:** every template section present and non-empty; Out of Scope names Infiltrate line 1 (follow-up H), Unleash,
  the discard-source and self-send shapes, the ~53 bare `[keyword:Undercover]` lines and the shld / officer-stack raw-id log, the
  WP-899 history field, and new moves / `G` keys / phases / page changes. **PASS.**
- **§2 constraints:** full-file output, no diffs/snippets, ESM, Node v22+, `00.6-code-style.md` cited; packet-specific
  determinism / no-new-`G`-key / sentinel-no-re-pin / hand-shield-unchanged / regen / Board-Visible constraints; session protocol
  (four STOP triggers); locked values → EC. **PASS.**
- **§3 Assumes:** baseline `572ff95a7`; observed parses of the three lines; `sendCardUndercover`, the two Undercover handlers,
  `PendingUndercoverChoice`, `resolveUndercoverChoice`, the projection, the bot, the draw-threshold wait-and-see path, scoring,
  the marker pipeline, plus `formatCardRef`, the ext-id constants, `resolveDisplay`, the prompt's props and the bundle `--check`;
  hard-deps WP-678 / 679 / 665 / 568 / 856 / 767 / 745 all ✅. **PASS.**
- **§4 Context:** rules v23 §Undercover and the "Your Heroes" glossary, Hero filter, decline rationale, bot default, leaving
  play, WP-899 coordination, bare-token suppression, wait-and-see park, stale target, hashed log, hash safety, out-of-scope
  neighbours; 00.2 §5 / §5.1; ARCHITECTURE §Rule Execution Pipeline / Principle #1 / §Persistence Boundary / §Layer Boundary;
  rules/architecture.md §UIState Projection Integrity; DECISIONS scan list; 00.6. **PASS.**
- **§5 files:** every file listed with role and full path (~25, most generated); single-WP size justified in §Context (the
  widened entry is unusable without the prompt); WP-899-conditional file named. **PASS.**
- **§6 naming:** full words (`heroEffectUndercoverYourHero`, `selectDefaultUndercoverYourHeroTarget`,
  `lineHasUndercoverYourHeroMarker`, `moveCardUndercover`); data slugs verbatim; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine decides, client renders the chooser-only projection and submits
  intent, bot in simulation; no server, registry or DB edge. **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; hooks parsed from committed `bkwd.json`; no network, DB or `boardgame.io` import;
  WP-678 / WP-679 tests unedited; lockstep pins move exactly +2 / +2. **PASS.**
- **§13 verification:** exact commands with expected exits; zero-diff regen re-run; engine baseline 7343 / 0 / 1652 recorded.
  **PASS.**
- **§14 / §15:** 10 binary criteria; DoD names STATUS / DECISIONS (D-24858) / WORK_INDEX / EC_INDEX / mindmap / NUMBER-LEDGER /
  01.6 and the scope-boundary diff; D-24026 live check on a post-deploy match (§15.1, operator-pending fallback with pending
  `live-verify.json` rows); Risk Tier MEDIUM in WP and EC, byte-identical (§15.2). **PASS.**
- **§16 code-style:** one handler for both keywords (reads `effect.type`); `moveCardUndercover` extracted to keep the hashed log
  byte-identical; pure bot helper; `for` loops, no `.reduce()`, no nested ternaries; `// why:` locations listed in the EC.
  **PASS.**
- **§17 Vision:** clauses §1/§2/§8/§10/§22, no-conflict line, NG-1 line, determinism line (replay divergence scoped,
  `competitive_scores` frozen per D-24616 §5). **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** baseline SHA only, re-checked at commit. **N/A.** Contract
  files: `types.ts` and `ui/uiState.types.ts` gain optional fields covered by D-24858.
- **§20 funding:** N/A with the statement above. **§21 API catalog:** N/A (no endpoint or `apps/server` library function).
  **PASS.**
