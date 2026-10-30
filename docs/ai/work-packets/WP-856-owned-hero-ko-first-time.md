# WP-856 — "The first time one of your Heroes is KO'd this turn": Doctor Voodoo's Possessed by Brother's Spirit (Game Engine + card data)

**Status:** Draft 2026-10-29 (EC-894; D-24792 reserved) — pre-flight READY TO EXECUTE; copilot PASS
**Layer:** Game Engine (parse marker + one-shot wait-and-see condition + Hero-aware KO signal + one choose-one option kind) + card data
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-853 / D-24789 (owned-KO recorder at the 25 OWNED KO sites, the wait-and-see always-defer, the per-function KO-site pin) ✅,
WP-568 / D-24377 (deferred conditional grants, the `turn.onMove` resolve) ✅, WP-675 / WP-679 / D-24490 / D-24495 / D-24696
(the count-scaled choose-one: `count-scaled-choose`, `ChooseOneOption`, `PendingCountScaledChoice`, `resolveCountScaledChoice`,
the `flat-attack` option) ✅, WP-744 / D-24567 (sim / PAR / fixture harnesses mirror the resolve and the onBegin clears) ✅
**Sibling (not a dep):** WP-855 / D-24791 (Miek's Endless Appetite) extends the same recorder; see §Context "Coordination".

## Goal

Make Doctor Voodoo's **Possessed by Brother's Spirit** (`dstr/doctor-voodoo/posessed-by-brothers-spirit`, slug spelled
that way in the data) do what it prints: "The first time that one of your Heroes or a Hero from your deck or discard pile is
KO'd this turn, you get +4[icon:recruit] or +4[icon:attack]." Today the setup parser emits a flat on-play **+4 Recruit AND
+4 Attack**, a phantom +8 on every play. After this WP, playing it gives nothing by itself; the first time one of the
player's Heroes (not a Wound, not a Bystander) is KO'd from their hand, cards played this turn, deck or discard pile after
the play, the player chooses +4 Recruit or +4 Attack, once. Later KOs that turn give nothing more.

## User-Visible Impact

`play.legendary-arena.com` — playing Possessed by Brother's Spirit logs "Player N's Possessed by Brother's Spirit ability is
waiting — it needs a Hero of yours to be KO'd this turn. It will apply if you reach it this turn." instead of "+4 recruit" and "+4 attack". The first later KO of one of the player's Heroes that turn (Whatever
the Cost, a Villain's "KO one of your Heroes", a deck-top KO) opens the existing choose-one prompt with two buttons, "+4
Recruit" and "+4 Attack"; the chosen one is granted. KOing a Wound (healing) does not trigger it. A second Hero KO that turn
gives nothing. Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` = `67d5f4e1` (the WP-856 reserve merge, #3103; after the WP-855 reserve, #3101).
- WP-853 shipped (`bf7150b8`, #3093): `hero/heroConditions.evaluate.ts` exports `OWNED_CARD_KOED_CONDITION_TYPE`
  (`'ownedCardKoedThisTurn'`) with `evaluateCondition` / `describeFailedCondition` cases; `hero/deferredConditionalGrants.ts`
  has it in `WAIT_AND_SEE_CONDITION_TYPES` and exports `recordOwnedCardKoed(G, ownerPlayerID)`, gated by the private
  `hasWaitingOwnedKoGrant(G)`; `types.ts` declares `ownedCardsKoedSinceResolve?: Record<string, number>`;
  `heroEffects.execute.ts` has the owned-KO always-defer branch in `executeHeroEffects` (via `findConditionOfType` /
  `conditionsWithout`), the per-KO `repeatCount` + re-arm in `resolveDeferredHeroGrants` and the guarded post-resolve
  `delete G.ownedCardsKoedSinceResolve`; `game.ts` `turn.onBegin` and `simulation/onBeginParity.ts` delete the field; the
  per-function KO-site pin in `hero/ownedCardKoTrigger.test.ts` locks 34 KO sites / 25 `recordOwnedCardKoed(` calls.
- A wait-and-see grant whose hook carries neither repeatable type fires once and is removed
  (`resolveDeferredConditionalGrants`' one-shot contract, D-24377) — exactly "the first time".
- The count-scaled choose-one (D-24490 / D-24495 / D-24696): the parser pre-pass `tryResolveCountScaledChooseOneLine`
  (gated on a `Choose one:` prefix and ≥2 recognized option markers, options in printed order) emits one `count-scaled-choose`
  effect with `countScaledChoiceOptions`; it clears the conditions pushed before it (Step 1a) but the per-token loop's
  condition arms (where `owned-card-koed` lives) run after it, so a marker condition survives; its icon-suppression drops the
  line's plain `attack` / `recruit` keywords. `heroEffectCountScaledChoose` parks a block-all `PendingCountScaledChoice`;
  `resolveCountScaledChoice` dispatches by `kind` (the `flat-attack` branch calls `executeSingleEffect` with `attack`);
  `uiState.build.ts` projects each option to `UIPendingCountScaledChoiceOption`; `uiState.filter.ts` rebuilds `kind` / `label` /
  `resource` / `total` field-by-field; `CountScaledChoicePrompt.vue` renders one button per option from `label` only.
- "Is this a Hero": the WP-828 precedent `moves/outOfTimeGrant.logic.ts` `isHeroCard` = not `WOUND_EXT_ID`, not
  `BYSTANDER_EXT_ID` (`setup/pilesInit.ts`). S.H.I.E.L.D. Agents, Troopers, Officers and Sidekicks are Heroes; Wounds are not
  (rules v23 "They're not Heroes", Enraging Wounds note).
- `data/cards/dstr.json` is GENERATED; markers live in `scripts/convert-cards/inputs/hero-ability-markers.json` and are
  appended in entry order by `apply-hero-ability-markers.mjs`, whose `VALID_TOKEN_PATTERN` must list every token
  (`[keyword:attack:N]` is already listed; `[keyword:recruit:N]` is not).

## Context (Read First)

- **Parse today (observed, `buildHeroAbilityHooks` on `data/cards/dstr.json`, baseline above):**
  `{ cardId: 'dstr/doctor-voodoo/posessed-by-brothers-spirit#0', timing: 'onPlay', keywords: ['recruit','attack'],
  effects: [{ type: 'recruit', magnitude: 4 }, { type: 'attack', magnitude: 4 }] }` — no condition, both grants, every play.
  One copy in the deck (rare).
- **Target parse (observed on a throwaway prototype of the parser change, reverted):** with the three markers below appended,
  the hook is `{ keywords: ['count-scaled-choose','conditional'], conditions: [{ type: 'ownedHeroKoedThisTurn', value: '1' }],
  effects: [{ type: 'count-scaled-choose', countScaledChoiceOptions: [{ kind: 'flat-recruit', magnitude: 4 },
  { kind: 'flat-attack', magnitude: 4 }] }] }` — printed order, no unconditional grant.
- **Zones.** "One of your Heroes" = hand + cards played this turn (rules v23 glossary "Your Heroes / Heroes You Have", the
  D-24529 reading); "a Hero from your deck or discard pile" adds deck and discard. Together: exactly WP-853's OWNED zones (hand,
  deck, discard, in play). So the trigger reuses WP-853's 25 OWNED KO sites and adds only a Hero filter; no new site, and the
  KO-site pin table is unchanged.
- **Hero filter at the recorder.** `koCard` gets only an id and each site already holds the KO'd card's id, so the recorder
  takes it as a new third parameter and decides Hero-ness itself (not a Wound, not a Bystander — the WP-828 precedent). One
  recorder call per site stays one call; the 25 sites change only by passing the id they just KO'd.
- **First time = one-shot.** The new condition is a wait-and-see type that is NOT re-armed, so the grant fires on the first
  counted Hero KO and is removed; the count is consumed per resolve like WP-853's.
- **Choose one = the existing count-scaled choose-one.** No "or" choice exists for two flat resources. D-24696 added a
  `flat-attack` option kind for Spy Network; this WP adds its sibling `flat-recruit` (one union member, one resolve branch, one
  projection case). The parser pre-pass gate gains a second entry form: a line printing `+N[icon:X] or +N[icon:Y]` (X, Y ∈
  recruit / attack) with ≥2 recognized option markers, beside the `Choose one:` prefix. Corpus scan (all 41 sets): only two
  lines print that form — this card and `cosm` "[hc:tech]: You get +1[icon:recruit] or +1[icon:attack]." (unmarked, so its
  parse is unchanged — it needs ≥2 option markers). No line carries `[keyword:recruit:N]` today.
- **Fired from the resolve.** The grant fires inside `resolveDeferredHeroGrants` (`turn.onMove`), so the choice parks after the
  KO move, like Snarling Fangs' Moonlight KO choice (WP-767). The choice is block-all (`endTurn`, `advanceStage`) until
  answered. `turn.onBegin` does not clear `pendingCountScaledChoice`, so the invariant that keeps it inside the turn is that no
  owned KO site runs in a turn-ending move (pre-flight checked: `endTurn` → `applyEndOfTurnCleanup` and the cleanup → endTurn
  path in `advanceStage` KO nothing; `settleEnigmaGuess` ends the turn before its fight). A Hero KO resolved from one entry of
  a multi-entry KO queue (Mobilize for War, a `koHeroChoice` owing two, Red Skull) parks the choose-one while that queue still
  has entries: both prompts show and resolve independently (neither resolve move guards the other; the bot takes the
  count-scaled one first). Not a freeze; covered by one test.
- **Coordination (WP-855).** Miek's Endless Appetite (WP-855 / D-24791, drafting in parallel) also extends
  `recordOwnedCardKoed`. Agreed final signature for both WPs (WP-855 session, 2026-10-29):
  `recordOwnedCardKoed(G, ownerPlayerID, cardId, fromZone)`, `fromZone: 'hand' | 'deck' | 'discard' | 'inPlay'`. If this WP
  executes first, it adds `cardId` as the third parameter and WP-855 appends `fromZone`. If WP-855 executes first, the
  signature is `(G, ownerPlayerID, fromZone)` and this WP **inserts `cardId` before `fromZone`**, keeping WP-855's argument at
  every site and its `G.deckCardsKoedSinceResolve` branch in the recorder. WP-855 also holds its draw while any pending choice
  is open at the start of `resolveDeferredHeroGrants`; that hold does not apply to this WP's grant (it parks a choice, it draws
  nothing) — leave it as WP-855 wrote it. The KO-site pin (which matches `recordOwnedCardKoed(`) is unchanged by either.
- **Single WP (~30 files).** The Hero signal is only correct if every owned site passes its id; the site edits are mechanical
  (one argument), the required parameter makes the type checker enforce the argument's presence (not its correctness —
  `CardExtId` is a `string` alias; the EC's site-by-site diff check covers that), and the pin keeps the set closed.
- **Same-set neighbours (out of scope, observed in the same parse):** `dstr/doctor-voodoo/medallion-of-many-loas` parses to a
  flat `attack:1` on every play (its printed line is a Ritual Artifact "you may discard … to get +1 attack for each Hero Class")
  and `staff-of-legba` to a magnitude-less `attack`; both belong to the unmodeled Ritual Artifact mechanic (ledger
  `ritual-artifact` unsupported). The cosm "+1 Recruit or +1 Attack" line also parses to both grants today; marking it needs its
  `[hc:tech]` gate kept through the choose-one pre-pass (which clears Step-1a conditions) — a follow-up.
- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline + Principle #1; §Persistence Boundary (G runtime-only).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (§5.1 `[keyword:X]`).
- `docs/ai/DECISIONS.md` — scan D-24789, D-24377, D-24467, D-24490, D-24495, D-24696, D-24600, D-24567, D-24322, D-24372
  before coding. `docs/ai/REFERENCE/00.6-code-style.md` for every file.

### RS-1 — "The first time … this turn" when a Hero was already KO'd before the play (LOCKED at draft)

Locked by the drafting session 2026-10-29 (pre-flight PS-1 requires it settled before the session prompt): the trigger is armed when the card is played, and the first Hero KO **after** the play fires it (the WP-853 /
D-24789 posture: a played card's ability does not see earlier events; the always-defer branch). A stricter reading — "if one
of your Heroes was already KO'd earlier this turn, the first time has passed and this gives nothing" — needs a turn-scoped,
always-written Hero-KO flag (a new hashed field outside the waiting-grant gate, which moves sentinels in every game with a Hero
KO). That is a scope change: if Jeff prefers it, it lands as a SPEC amendment to this WP before execution and pre-flight
re-runs. Execution does not reopen this.

### RS-2 — What counts as a Hero (default locked)

Default: any card that is not a Wound (`WOUND_EXT_ID`) and not a Bystander (`BYSTANDER_EXT_ID`) — hero-deck cards,
S.H.I.E.L.D. Agents / Troopers / Officers and Sidekicks count. The WP-828 `isHeroCard` precedent.

## Scope (In)

- **Markers.** Three `dstr` entries in `hero-ability-markers.json` on `heroSlug: "doctor-voodoo"`,
  `cardSlug: "posessed-by-brothers-spirit"`, `abilityIndex: 0`, in this order: `[keyword:owned-hero-koed]`,
  `[keyword:recruit:4]`, `[keyword:attack:4]`. `VALID_TOKEN_PATTERN` gains `^\[keyword:owned-hero-koed\]$` and
  `^\[keyword:recruit:[1-9]\d*\]$`, and its "locked token forms" error message lists both. Regenerate `dstr.json`.
- **Condition.** `OWNED_HERO_KOED_CONDITION_TYPE = 'ownedHeroKoedThisTurn'`, exported from `hero/heroConditions.evaluate.ts`
  beside `OWNED_CARD_KOED_CONDITION_TYPE` (same load-order reason), appended to `WAIT_AND_SEE_CONDITION_TYPES`. Evaluate:
  `(G.ownedHeroesKoedSinceResolve?.[playerID] ?? 0) > 0`. Describe: `'it needs a Hero of yours to be KO\'d this turn'`.
- **Parser.** `HERO_PARSER_RECOGNIZED_MARKER_NAMES` gains `owned-hero-koed` after `owned-card-koed`; a per-token arm beside
  `owned-card-koed` pushes `{ type: OWNED_HERO_KOED_CONDITION_TYPE, value: '1' }`. `tryResolveCountScaledChooseOneLine`: gate #1
  passes on the `Choose one:` prefix OR `FLAT_RESOURCE_OR_PATTERN`
  (`/\+[1-9]\d*\[icon:(?:recruit|attack)\] or \+[1-9]\d*\[icon:(?:recruit|attack)\]/`); a `FLAT_RECRUIT_OPTION_MARKER_PATTERN`
  (`/\[keyword:recruit:([1-9]\d*)\]/`) candidate yields `{ kind: 'flat-recruit', magnitude }`. The ≥2-option rule and
  printed-order sort are unchanged.
- **Option kind.** `rules/heroCountSource.ts`: `FlatRecruitChoiceOption { kind: 'flat-recruit'; magnitude: number }` joins
  `ChooseOneOption`. `moves/countScaledChoice.resolve.ts`: a `flat-recruit` branch calls `executeSingleEffect(…, { type:
  'recruit', magnitude })` (the `flat-attack` mirror). `ui/uiState.types.ts`: `UIPendingCountScaledChoiceOption.kind` gains
  `'flat-recruit'`. `ui/uiState.build.ts`: projects `{ kind: 'flat-recruit', resource: 'recruit', total: magnitude, label:
  '+N Recruit' }`. `uiState.filter.ts`, the client prompt and the bot (`ai.legalMoves.ts` takes the `flat-attack` option when
  offered) are unchanged.
- **Signal.** `LegendaryGameState.ownedHeroesKoedSinceResolve?: Record<string, number>` beside `ownedCardsKoedSinceResolve`.
  `recordOwnedCardKoed(G, ownerPlayerID, cardId: CardExtId)`: the private gate becomes
  `hasWaitingGrantWithCondition(G, conditionType)`; the owned-card count is written exactly as today (gated on the owned-KO
  type) as a gated block — WP-853's early `return` becomes that block's guard, so it no longer skips the rest; then, when `cardId` is not `WOUND_EXT_ID` / `BYSTANDER_EXT_ID` AND a waiting grant's hook carries
  `OWNED_HERO_KOED_CONDITION_TYPE`, lazily create the map and add 1 for the owner.
- **KO sites.** All 25 `recordOwnedCardKoed(` calls pass the id of the card they just KO'd as the third argument (the Wound
  sites — `healWounds`, `heroEffectKoWoundReward`, `heroEffectKoWound`, `villainEffectKoWoundsCurrentHandAndDiscard` — pass
  `WOUND_EXT_ID`, and `applyRevealKo` can KO a Wound off the deck top; the filter rejects those by design). No site added or
  removed.
- **Always defer at play.** WP-853's branch in `executeHeroEffects` fires for a hook carrying either owned-KO type: the guard
  finds the first condition of `OWNED_CARD_KOED_CONDITION_TYPE`, else of `OWNED_HERO_KOED_CONDITION_TYPE`; the record /
  waiting line / `continue` are unchanged, with the reason from `describeFailedCondition` on that condition.
- **Firing.** In `resolveDeferredHeroGrants`, the Hero-KO hook takes the default `repeatCount` 1 and is NOT in the re-arm
  check (one-shot). After the resolution, a guarded `delete G.ownedHeroesKoedSinceResolve` beside the owned-card delete.
- **Turn boundary.** `game.ts` `turn.onBegin` and `simulation/onBeginParity.ts` gain a guarded delete of the new field.
- **Ledger / coverage.** `scripts/hero-mechanic-ledger.mjs` `KNOWN_CONDITIONS` gains `'owned-hero-koed': 'ownedHeroKoedThisTurn'`;
  `mechanic-provenance.json` row `owned-hero-koed` (WP-856 / D-24792); pending `live-verify.json` row keyed
  `dstr/doctor-voodoo|owned-hero-koed` (the WP-853 row shape); regen `ledger:heroes`, `effect-index`, `mechanics:metadata`,
  `sim:runtime-observed`, `sim:coverage --update-baseline`, the dashboard coverage copies (+ in-play pin only if it moves).
- **Tests** (new `hero/ownedHeroKoTrigger.test.ts` unless noted; hooks built by the setup parser from the committed
  `dstr.json`, never a hand-built hook). Cases: parse (the target hook above, no unconditional effect); play gives 0 Recruit /
  0 Attack and logs the waiting line; play, then a Hero KO through `resolveOptionalKoReward` parks one
  `PendingCountScaledChoice` with options `[flat-recruit 4, flat-attack 4]`; `resolveCountScaledChoice` option 0 gives +4
  Recruit, option 1 gives +4 Attack; a second Hero KO the same turn parks nothing; a Wound KO (`healWounds`) parks nothing and,
  before the resolve, leaves no `ownedHeroesKoedSinceResolve` key (`Object.hasOwn`) while `ownedCardsKoedSinceResolve` is
  untouched by it; a Hero KO before the play parks nothing; another player's Hero KO'd (Red Skull strike) parks nothing for the
  active player and, before the resolve, `deepEqual(G.ownedHeroesKoedSinceResolve, { '1': 1 })`; one move KOing three of the player's
  Heroes (`villainEffectKoHeroesCurrentByTrait` or `koHeroesFromZoneForPlayer`): before the resolve
  `deepEqual(G.ownedHeroesKoedSinceResolve, { '0': 3 })`, after it exactly one parked choice, resolving it gives exactly +4; a Hero KO from a `koHeroChoice` owing two leaves both queues open and each resolves (hand of more than two distinct
  Heroes, or `resolveKoHeroChoice` auto-KOs the rest — `koHeroChoice.resolve.ts`); Absorb Energies and Possessed both waiting + one Hero KO → +2 Recruit and one parked choice; with no
  waiting Hero-KO grant a Hero KO leaves no key; the turn boundary clears entry and counter. `hero/deferredConditionalGrants.test.ts`
  — the list `deepEqual` + a `TRUTHY_FIXTURE` entry (both required); `simulation/onBeginParity.test.ts` deletes the field;
  `game.test.ts` — real `turn.onMove` consume and `turn.onBegin` delete (the WP-853 cases' shape); `setup/heroAbility.setup.test.ts`
  — the "or" gate: an unmarked `+1[icon:recruit] or +1[icon:attack]` line parses exactly as before, and a single option marker
  does not make a choose-one; `moves/countScaledChoice.resolve` coverage of the `flat-recruit` branch (in the new file);
  `ui/uiState.filter.test.ts` — a `flat-recruit` option survives for the chooser with `resource` / `total` / `label`.
  Expected unchanged: `hero/ownedCardKoTrigger.test.ts` (its pin table and synthetic strings), `ca75SpyNetwork.test.ts`,
  `CountScaledChoicePrompt.test.ts`.

## Out of Scope

- RS-1's strict reading (a turn-scoped always-written Hero-KO flag); a SPEC amendment if wanted.
- WP-855 (Miek's deck-source KO draw) and its recorder parameter.
- The cosm "+1 Recruit or +1 Attack" line; the Ritual Artifact mechanic (Medallion of Many Loas, Staff of Legba, Commune
  with the Spirit World).
- Any new hero keyword, handler, pending choice, move, `CORE_MOVE_NAMES` entry, UIState field, or client change. The option
  kind is a new union member on existing contracts, not a new choice.
- A new KO site or a change to the KO-site pin table. `replay/replay.execute.ts` keeps its D-24322 posture.
- The WP-853 accepted same-move edge (a Hero KO earlier in the same move as a Steal Abilities / Copy Powers replay of this card
  is counted at that move's resolve); unchanged here.

## Files Expected to Change

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — const + evaluate + describe cases.
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified** — list entry; recorder third param + Hero count;
  `hasWaitingGrantWithCondition`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — always-defer for either type; post-resolve delete;
  four KO sites pass the id.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — marker name + arm; "or" gate; flat-recruit candidate.
- `packages/game-engine/src/rules/heroCountSource.ts` — **modified** — `FlatRecruitChoiceOption`.
- `packages/game-engine/src/moves/countScaledChoice.resolve.ts` — **modified** — `flat-recruit` branch.
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — option `kind` union (contract file; D-24792).
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — projection case.
- `packages/game-engine/src/types.ts` — **modified** — `ownedHeroesKoedSinceResolve?`.
- `packages/game-engine/src/game.ts` — **modified** — onBegin guarded delete (01.5 runtime wiring).
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — mirrored delete.
- KO sites — **modified** (third argument only): `moves/healWounds.ts`, `moves/koDiscardChoice.resolve.ts`,
  `moves/koHeroChoice.resolve.ts`, `moves/melterKoChoice.resolve.ts`, `moves/optionalKoReward.resolve.ts`,
  `moves/revealThreeAssign.resolve.ts`, `moves/revealTopDispose.resolve.ts`, `moves/ruthlessDictatorChoice.resolve.ts`,
  `moves/scryKoChoice.resolve.ts`, `moves/seatChoiceTactics.ts`, `moves/operatorSetters.ts`, `rules/mastermindHandlers.ts`,
  `villain/villainEffects.execute.ts`.
- `scripts/hero-mechanic-ledger.mjs` — **modified** — `KNOWN_CONDITIONS` entry.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — two token arms.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — three dstr entries.
- `data/cards/dstr.json` — **modified (generated)**.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`,
  `scripts/coverage/hero-effect-coverage.baseline.json`, `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`, `apps/dashboard/src/data/*` coverage copies the regen rewrites;
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, only if it moves).
- Tests: `packages/game-engine/src/hero/ownedHeroKoTrigger.test.ts` (new), `hero/deferredConditionalGrants.test.ts`,
  `simulation/onBeginParity.test.ts`, `game.test.ts`, `setup/heroAbility.setup.test.ts`, `ui/uiState.filter.test.ts`;
  `hero/heroConditions.evaluate.test.ts` only if a pin there moves (expected unchanged).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24792), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets; ESM only; Node v22+; human-style code — see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O; moves never throw; `for` loops, no `.reduce()`.
- `G` stays JSON: the Hero count is a plain `Record<string, number>`, created lazily, written only while a Hero-KO grant
  waits, deleted after every resolve and at the turn boundary (live + sim / PAR / fixture mirrors; `replay.execute.ts`
  accumulates by design, D-24322). A game with no waiting Possessed grant never gains the field and never parks the choice, so
  the `finalStateHash` sentinels serialize byte-identically — **no re-pin**. A moved sentinel is a STOP.
- The recorder's owned-card branch is byte-for-byte WP-853's behaviour (Absorb Energies unchanged).
- Card data via the marker source + reproducible regen (`cards:check`); never hand-edit `dstr.json`.
- No per-card special-casing in the parser or executor; no new hero keyword.

**Session protocol:** if the parsed hook still carries an unconditional `recruit` or `attack` effect, or the
`describeFailedCondition` case is missing (the waiting line reads the generic fallback), or the cosm line's parse changes,
STOP and report.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `OWNED_HERO_KOED_CONDITION_TYPE = 'ownedHeroKoedThisTurn'` (wait-and-see, one-shot).
- `recordOwnedCardKoed(G: LegendaryGameState, ownerPlayerID: string, cardId: CardExtId): void` (amends D-24789's signature;
  + `fromZone` as the 4th parameter if WP-855 landed first — §Context "Coordination").
- `G.ownedHeroesKoedSinceResolve?: Record<string, number>` — per-owner Hero-KO count since the last resolve; absent when none.
- `FlatRecruitChoiceOption { kind: 'flat-recruit'; magnitude: number }` in `ChooseOneOption`; UI option `kind` gains
  `'flat-recruit'`.
- Markers `[keyword:owned-hero-koed]` (condition) and `[keyword:recruit:N]` (flat-recruit option on a choose-one line).
- Board-Visible rule (D-12803) for the new UI union member: step 1 the `kind` union, step 2 the `uiState.build.ts` case, step
  3 `uiState.filter.ts` already copies `kind` / `label` / `resource` / `total` (unchanged), step 4 the `uiState.filter.test.ts`
  case, step 5 the live check reads `uiStateSnapshot.pendingCountScaledChoice.options[0].kind === 'flat-recruit'`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic &
Reproducible Evaluation).
- **No conflict:** a printed trigger that over-fires today (+8 on every play) resolves as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — a printed hero ability, nothing bought.
- **Determinism preservation:** no randomness; the count lives inside a move and is consumed before the move boundary (live +
  mirrors); absent for every game with no waiting Possessed grant, so sentinels are byte-identical. Seed-PAR is scheme-keyed
  and hero-agnostic. Replays of pre-WP-856 matches that played Possessed by Brother's Spirit diverge on re-execution; stored
  `competitive_scores` rows stay frozen (D-24616 §5). In-flight matches keep their setup-built hook; no migration.

## Funding Surface Gate

N/A — no UI copy, nav or funding surface; a hero ability's engine behaviour, one log line, and one more button label in the
existing choose-one prompt.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Playing Possessed by Brother's Spirit adds 0 Recruit and 0 Attack and logs "… ability is waiting — it needs a Hero of yours
   to be KO'd this turn. It will apply if you reach it this turn."
2. The first KO after the play, the same turn, of a Hero the player owns (hand, played, deck, discard) parks one choose-one
   with "+4 Recruit" and "+4 Attack" (printed order); choosing gives exactly that resource.
3. Later Hero KOs that turn park nothing more; a Hero KO before the play parks nothing (RS-1, locked).
4. Wound and Bystander KOs, another player's Hero KOs, and HQ / City / Villain-Deck / Victory-Pile KOs park nothing for the
   player.
5. The next turn starts with no waiting grant and no Hero count; with no Hero-KO grant waiting, a KO leaves `G` without
   `ownedHeroesKoedSinceResolve`.
6. Absorb Energies behaves exactly as before (its WP-853 tests pass unedited).
7. The cosm "+1 Recruit or +1 Attack" line and Spy Network parse exactly as before; a `flat-recruit` option survives the audience
   filter for the chooser.
8. `WAIT_AND_SEE_CONDITION_TYPES` pin and evaluator lockstep updated; the KO-site pin table is unchanged.
9. `cards:check` reproduces `dstr.json`; the ledger lists `owned-hero-koed` for `dstr/doctor-voodoo` as `condition`; every feed
   `:check` exits 0.
10. Engine + dashboard suites green; `pnpm -r build` 0; `finalStateHash` sentinels unchanged with no pin edited.

## Verification Steps

Regenerate (in order, after the engine change builds):

- First add the `owned-hero-koed` row to `scripts/coverage/mechanic-provenance.json` and the pending
  `dstr/doctor-voodoo|owned-hero-koed` row to `docs/ai/coverage/live-verify.json`.
- `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exits 0; only `dstr.json` changes.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `pnpm sim:coverage --update-baseline`, `pnpm --filter @legendary-arena/dashboard prebuild:coverage` — each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test` — green (baseline at `67d5f4e1`: 6075 pass / 0 fail, 1375 suites; expect
  at least +15 new tests — record the exact delta); every `finalStateHash` / sentinel assert passes with no pin
  literal edited.
- `pnpm --filter @legendary-arena/arena-client test` and `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
  `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`.
- `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check` — at govern-close.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + arena-client + dashboard suites green; `pnpm -r build` 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance row added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a real match **created after the deploy** (diagnostics `isMatchOlderThanServer: false`;
      hooks are built in `Game.setup`, so an older match keeps the flat +4/+4 hook) with Doctor Voodoo plays Possessed by Brother's Spirit (no Recruit / Attack,
      waiting line), KOs a Hero (prompt, choose one; the Play Diagnostics `uiStateSnapshot.pendingCountScaledChoice.options[0]` reads
      `kind: 'flat-recruit'`), then KOs another Hero (nothing) — confirmed live, or operator-pending in
      `docs/ai/STATUS.md` with the pending `live-verify.json` row.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24792 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done;
      mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only origin/main...HEAD` checked.

## Reserved Decision (lands at execution)

D-24792 — "The first time one of your Heroes [or a Hero from your deck or discard pile] is KO'd this turn, <reward>" is the
`ownedHeroKoedThisTurn` wait-and-see condition (marker `owned-hero-koed`): one-shot (not re-armed), fed by a Hero-only
per-owner count that `recordOwnedCardKoed` writes at WP-853's 25 OWNED KO sites, which now pass the KO'd card id. A Hero is any
card but a Wound or a Bystander (WP-828). The trigger is armed at play (RS-1, locked at draft; the always-defer branch covers both
owned-KO types). A reward printed `+N[icon:X] or +N[icon:Y]` is the count-scaled choose-one, entered by that printed "or" form
as well as the `Choose one:` prefix, with a new `flat-recruit` option kind beside `flat-attack` (D-24696).
Contract: `LegendaryGameState.ownedHeroesKoedSinceResolve?: Record<string, number>` — lazy, gated on a waiting Hero-KO grant,
deleted after each resolve and at `turn.onBegin` / `applyOnBeginParity`, never set in `Game.setup`;
`recordOwnedCardKoed(G, ownerPlayerID, cardId)` amends D-24789; `ChooseOneOption` and `UIPendingCountScaledChoiceOption.kind`
gain `flat-recruit`. `replay.execute.ts` (D-24322) accumulates the count by design. Replays of pre-WP-856 matches that played
the card diverge; stored competitive rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** NOT READY — PS-1: RS-1 left open "at the go" while its strict reading changes scope (an
  always-written Hero-KO flag would move sentinels). Fixed: RS-1 LOCKED at draft (armed at play), strict reading routed to a SPEC
  amendment. RS-1 Wound sites named; RS-2 recorder becomes a gated block, not an early return; RS-3 turn-boundary invariant
  (no owned KO in a turn-ending move; onBegin does not clear the queue); RS-4 two-queue concurrency + test; RS-5 baseline
  6075 / 0 / 1375 suites; RS-6 full waiting line; RS-7 token error message; RS-8 shared signature. Verified at HEAD: current
  and prototyped parses (byte-exact target hook), the 41-set corpus unchanged by the gate, 25 sites with the id in scope, no
  import cycle via `pilesInit.ts`, no ChooseOneOption / UI-kind runtime pin, no sentinel uses Voodoo.
- **Pre-flight round 2:** **READY TO EXECUTE** — all items folded; two wording notes applied (the Contract signature names the
  WP-855-first form; the two-queue test's hand setup).
- **Copilot round 1:** RISK → HOLD, four scope-neutral fixes, all folded: (A) the type checker enforces the id argument's
  presence, not its correctness — an EC site-by-site diff check added, and the three-Hero case asserts the count `{ '0': 3 }`
  before the resolve and exactly +4 after; (B) the EC `// why:` list names all three deletes and the two new union members;
  (C) the live check needs a match created after the deploy (setup-built hooks), in-flight matches keep the old hook, and the
  WORK_INDEX row says RS-1 locked; (D) the five-step Board-Visible rule is walked for the new `kind` member, step 5 via the
  live `uiStateSnapshot`. Verified correct: 25 calls with the id in scope, one-shot by omission from the re-arm, the
  always-defer helpers, the PAR mirror via the shared resolve, the two-line corpus, the filter pass-through, compile-time
  failure if a `flat-recruit` branch is missing, no import cycle, the pin unchanged, runtime pins (D-24372).
- **Copilot round 2:** **PASS → CONFIRM** — fixes A–D verified in the WP, EC and WORK_INDEX row; nothing open on any of the
  30 modes; READY unaffected (no allowlist, source-file or contract change).

## Lint Gate Self-Review (00.3)

- **§1 structure:** every template section present and non-empty; Out of Scope names the strict RS-1 reading, WP-855, the cosm
  "or" line, the Ritual Artifact cards, new keyword/handler/queue/move/UIState/client surfaces, the KO-site pin table, and the
  WP-853 same-move edge. **PASS.**
- **§2 constraints:** full-file output, no diffs/snippets, ESM, Node v22+, `00.6-code-style.md` cited; packet-specific
  determinism / G-JSON / Absorb-unchanged / regen constraints; session protocol (three STOP triggers); locked values → EC. **PASS.**
- **§3 Assumes:** WP-853 / 568 / 675 / 679 / 744 and every helper, export, field and shape the change reads, with locking
  decision; baseline `67d5f4e1`. **PASS.**
- **§4 Context:** observed and prototyped parses, zones (rules glossary / D-24529), Hero filter (WP-828), one-shot, choose-one
  reuse (D-24696), resolve parking + turn-boundary invariant, coordination with WP-855, corpus scan, ARCHITECTURE sections,
  00.2 §5 / §5.1, DECISIONS scan list, 00.6. **PASS.**
- **§5 files:** every file listed with role and full path (~30, mostly one-argument KO-site edits); the size is justified in
  §Context (a Hero signal missing from any owned site misses KOs; the required parameter makes the type checker enforce it).
  **PASS.**
- **§6 naming:** full words (`ownedHeroesKoedSinceResolve`, `hasWaitingGrantWithCondition`, `FlatRecruitChoiceOption`); `KO`
  per the rules text; the data slug `posessed-by-brothers-spirit` used verbatim; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine + card data only; no registry import in the engine; no server or
  client change (the prompt renders `label`). **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; hooks built by the real parser from committed `dstr.json`; `Object.hasOwn` key checks;
  pre-resolve counter asserts on the negative cases; no `boardgame.io` import in the helpers. **PASS.**
- **§13 verification:** exact commands with expected exits; engine baseline count recorded. **PASS.**
- **§14 / §15:** 10 binary criteria; DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap / ledger and the D-24026
  live check (§15.1, operator-pending fallback with the `live-verify.json` row). **PASS.**
- **§16 code-style:** reuse of the deferred-grant path, the count-scaled choose-one and the WP-853 recorder; one generalised
  private gate; `for` loops, no `.reduce()`, no nested ternaries; `// why:` locations listed in the EC. **PASS.**
- **§17 Vision:** clauses §1/§2/§8/§10/§22, no-conflict line, NG-1 line, determinism line. **PASS.**
- **§18:** no literal-grep verification step (the KO-site pin is a test). **N/A.** **§19:** no repo-state-summarizing artifact
  in this draft beyond the baseline SHA, re-checked at commit. **N/A.** Contract files: `types.ts` gains one optional field and
  `ui/uiState.types.ts` one union member, both covered by D-24792.
- **§20 funding:** N/A with the statement above. **§21 API catalog:** N/A (no endpoint). **PASS.**
