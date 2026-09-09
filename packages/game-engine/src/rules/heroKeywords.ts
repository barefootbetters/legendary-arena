/**
 * Canonical keyword and timing taxonomies for hero ability hooks.
 *
 * Both HeroKeyword and HeroAbilityTiming are closed unions with canonical
 * arrays for drift-detection. Adding a new entry to either requires a
 * DECISIONS.md entry and updating both the union type and its canonical
 * array.
 *
 * No boardgame.io imports. No registry imports. Contracts only.
 */

// ---------------------------------------------------------------------------
// HeroKeyword
// ---------------------------------------------------------------------------

// why: keywords are semantic labels only; adding a keyword requires a
// DECISIONS.md entry and updating both the union type and the canonical
// array. This prevents ad-hoc keyword proliferation.

/**
 * Closed canonical union of hero ability keyword labels.
 *
 * Keywords are semantic labels only — they do not imply magnitude,
 * effect resolution, or execution semantics.
 */
export type HeroKeyword =
  | 'draw'
  | 'attack'
  | 'recruit'
  | 'ko'
  | 'rescue'
  | 'wound'
  | 'reveal'
  | 'reveal-ko'
  | 'reveal-min'
  | 'reveal-ko-or-draw' // why: D-21802
  | 'reveal-cost-attack' // why: D-21901
  | 'reveal-odd-draw' // why: D-21902
  | 'reveal-attack-choose' // why: D-22003
  | 'reveal-ko-attack' // why: D-22301 — compound executor; magnitude encodes fixed attack grant (not a cost ceiling)
  | 'attack-per-count' // why: D-24016 — count-scaled attack; magnitude is the per-unit rate, countSource resolves the count
  | 'recruit-per-count' // why: WP-674 / D-24489 — count-scaled RECRUIT (the attack-per-count sibling for a "+N recruit for each X" grant); magnitude is the per-unit rate, countSource resolves the count. Handler heroEffectRecruitPerCount grants magnitude × count to G.turnEconomy.recruit; the parser subsumes the co-located printed [icon:recruit] exactly as attack-per-count subsumes [icon:attack]. Carries a magnitude → NOT in NO_MAGNITUDE_KEYWORDS. Drives noir Follow Big Leads ("+1 recruit for each other card you played this turn that costs 4 or more").
  | 'optional-ko-reward' // why: D-24019 — "you may KO a card from hand/discard; if you do, <reward>"; rewardType carries the reward
  | 'optional-ko-hand-discard' // why: WP-667 / D-24480 — "you may KO a card from your hand or discard pile" with NO reward (Radioactive Riot; the KO is deck-thinning). Parks a no-reward entry into the shipped optional-ko-reward pending queue with koZones ['hand','discard'] (no in-play KO); carries no magnitude (NO_MAGNITUDE_KEYWORDS)
  | 'ko-wound-reward' // why: WP-382 / D-24183 — "you may KO a Wound from hand/discard; if you do, <reward>"; Wound-restricted, auto-resolving variant of optional-ko-reward (Healing Factor family); rewardType carries the reward
  | 'wall-crawl' // why: D-24049 — printed "Wall-Crawl" ("when you recruit this Hero, you may put it on top of your deck"); executable via the recruitHero deck-top placement, not an onPlay HERO_EFFECT_HANDLERS entry
  | 'dodge' // why: D-24051 — printed "Dodge" ("during your turn, you may discard this card from your hand to draw another card"); executable via the dodgeCard hand-discard-to-draw move, not an onPlay HERO_EFFECT_HANDLERS entry
  | 'conditional'
  | 'undercover' // why: D-24060 / WP-282 — "send a card face-down, play it later from face-down state"; executable via sendUndercover + playFromUndercover moves on onPlay trigger
  | 'victory-villain-attack' // why: D-24068 / WP-285 — "gain +attack equal to the printed attack of a villain in your victory pile"; parks a pending pick resolved by resolveVictoryPileCardPick
  | 'draw-or-empowered' // why: D-24069 / WP-286 — "Choose one: Draw a card, or you get Empowered by [class]"; parks a PendingDrawOrEmpowered resolved by resolveDrawOrEmpowered
  | 'count-scaled-choose' // why: WP-675 / D-24490 — "Choose one: +N recruit per other recruit-icon card / Or +N attack per other attack-icon card" (vnom Symbiotic Adaptation); parks a PendingCountScaledChoice (two count-scaled options) resolved by resolveCountScaledChoice, which dispatches the chosen option through the attack-per-count / recruit-per-count executor. Carries options (each with its own magnitude), no top-level magnitude → in NO_MAGNITUDE_KEYWORDS
  | 'size-changing' // why: D-24074 / WP-290 — printed "Size-Changing: [Class]" ("when you play this card, it has the [Class] class"); a class-grant realized at class-read time, no onPlay handler (the wall-crawl class)
  | 'optional-put-bottom-hq' // why: "You may put a card from the HQ on the bottom of the Hero Deck"; parks a PendingOptionalPutBottomHQ resolved by resolveOptionalPutBottomHQ
  | 'put-any-number-bottom-hq' // why: D-24132 — "Choose any number of cards/Heroes from the HQ. Put them on the bottom of the Hero Deck" (multi-select variant); parks a PendingPutAnyNumberBottomHQ resolved by resolvePutAnyNumberBottomHQ, then applies any trailing "Empowered by [classes]"
  | 'put-bottom-hq-icon-reward' // why: D-24133 — mandatory "Put a card from the HQ on the bottom of the Hero Deck. If that card had a recruit/attack icon, you get +N" (Absorb Ambient Power); parks a mandatory PendingOptionalPutBottomHQ with iconRewardMagnitude, resolved by resolveOptionalPutBottomHQ
  | 'return-zero-cost-discard' // why: D-24139 — mandatory "Return a 0-cost card from your discard pile to your hand" (Black Knight's Defend the Weak); parks a mandatory PendingReturnZeroCostDiscard resolved by resolveReturnZeroCostDiscard
  | 'gain-wound-self' // why: D-24156 — printed "You gain a Wound." / "Gain a Wound."; the active player gains 1 Wound (to discard) via the WP-017 gainWound helper. Immediate, no magnitude. Distinct from the still-deferred generic 'wound'.
  | 'gain-wound-each' // why: D-24156 — printed "Each player gains a Wound." (Crazed Rampage); every player gains 1 Wound via the WP-316 villain per-target loop. Immediate, no magnitude.
  | 'shuffle-discard-empty-reward' // why: D-24148 — mandatory immediate "If your discard pile is empty, you get +N[recruit|attack]. Otherwise, shuffle your discard pile into your deck." (Jocasta's Reprocess / Electromagnetic Eyebeams); rewardType carries the empty-discard grant, the non-empty branch is a combined deterministic shuffle of discard into deck. No pending choice.
  | 'discard-to-play' // why: WP-383 / D-24184 — printed play COST "To play this card, you must discard a card from your hand." (Cyclops Determination/Optic Blast + siblings); magnitude = number of cards to discard. A pre-commit precondition in playCard (D-24185) blocks an unpayable play; a payable play parks a mandatory PendingDiscardToPlay resolved by resolveDiscardToPlay.
  | 'defeat-with-bystander' // why: WP-486 / D-24291 — printed "Defeat a Villain or Mastermind that has a Bystander." (Silent Sniper); onPlay handler defeats one eligible target (city Villain with an attached Bystander, or the Mastermind tactic when it holds one) via the shared fight-defeat path, spending no attack; 0 → no-op, 1 → auto, ≥2 → parks a PendingDefeatChoice resolved by resolveDefeatChoice.
  | 'copy-powers' // why: WP-535 / D-24345 — printed "Play this card as a copy of another Hero you played this turn. This card is both covert and the color you copy." (Rogue's Copy Powers); onPlay handler re-fires the chosen Hero's ability via the reentrant executeHeroEffects and grants Copy Powers the copied class (reusing cardSizeChangingClasses); 0 → no-op, 1 → auto, ≥2 → parks a PendingCopyPowersChoice resolved by resolveCopyPowersChoice.
  | 'return-on-discard' // why: WP-498 / D-24301 — printed reactive "If a card effect makes you discard this card, you may return this card to your hand." (Cyclops Unending Energy); the first onDiscard-timing keyword. Fires at the discardFromHand chokepoint (checkReturnOnDiscard), parking an OPTIONAL PendingReturnOnDiscard resolved by resolveReturnOnDiscard. Enrolled in DISCARD_TIME_EXECUTED_KEYWORDS → MVP_KEYWORDS so the play-time hook visit does not emit a no-handler hollow; no onPlay HERO_EFFECT_HANDLERS entry.
  | 'recruit-as-attack' // why: WP-580 / D-24389 — printed "You can use Recruit as Attack this turn." (God of Thunder); the engine's first resource-conversion primitive. onPlay HERO_EFFECT_HANDLERS entry sets a lazily-materialized, turn-scoped G.turnEconomy.recruitSpendableAsAttack flag; the fight moves + bot + UIState projection then fund fight costs from unspent recruit (attack first). No magnitude.
  | 'steal-abilities' // why: WP-592 / D-24401 — printed "Each player discards the top card of their deck. Play a copy of each of those cards." (Rogue's Steal Abilities); deterministic synchronous onPlay handler — each player discards their deck top (seat order, reshuffle-on-empty), then the Steal Abilities player plays a copy of each = printed economy + a reentrant executeHeroEffects re-fire (no class/team grant). Recursion guard excludes a discarded steal-abilities OR copy-powers from re-fire (both are reentrant-copy keywords). No magnitude.
  | 'investigate' // why: WP-564 / D-24373 — printed "Investigate for <criterion>" (Alias Investigations + siblings); the static-criterion + DRAW subset. onPlay HERO_EFFECT_HANDLERS entry looks at the top investigateLookCount cards (default 2), draws the FIRST matching investigateCriteria in look order, and bottoms the rest in look order (reshuffling a short deck via reshuffleDiscardIntoDeck). Deterministic — no pending choice; the choose-a-criterion / other-zone / disposition variants stay deferred (their markers record parse-unrecognized). No magnitude.
  | 'transform' // why: WP-658 / D-24469 — printed "[keyword:Transform] this into <second-form>" (the wwhk set). Swaps a played base card for its stronger second-form pulled from the G.transformDeck side deck (D-24468). onPlay HERO_EFFECT_HANDLERS entry (heroEffectTransform) reads the base→target key from G.transformTargets, pulls the first matching second-form copy out of G.transformDeck into play, routes the base card back to the side deck (a permanent deck upgrade), and applies the second-form's printed attack/recruit. No magnitude. RESOLVED ONLY for cards in the setup parser's SUPPORTED_TRANSFORM_BASES allowlist (She-Hulk's hurl-legal-objections is the first) — every other wwhk transform card carries an UNMODELED printed condition, so its [keyword:Transform] stays an unresolved marker (an honest parse-unrecognized hollow), never an unconditional swap.
  | 'reveal-from-hand' // why: WP-659 / D-24470 — printed "Each player may reveal another [team]/[hc] Hero. Each player who does draws a card." (Emma Frost's Psychic Link). The co-located [team:X]/[hc:X] is the reveal CRITERION (captured as an InvestigateCriterion), NOT a requiresTeam/heroClassMatch play-gate — the marker suppresses it from Steps 1a/1b exactly as investigate/size-changing/copy-powers suppress theirs. onPlay HERO_EFFECT_HANDLERS entry (heroEffectRevealFromHand) iterates every player in Object.keys(G.playerZones).sort() seat order; each player whose hand holds a criterion-matching card draws 1. Auto-reveal (pure upside — declining is strictly dominated — so no pending-choice park); reveal is state-neutral (the matched card stays in hand). No magnitude, no new G field.
  | 'optional-play-villain-top' // why: WP-663 / D-24470-sibling D-24474 — printed "[hc:covert]: You may play the top card of the Villain Deck. If you do, you get +2[icon:attack]." (Emma Frost's Shadowed Thoughts). Unlike reveal-from-hand's pure-upside auto-reveal, playing the top Villain-Deck card has a real downside (a Villain enters the city, or a Master Strike / Scheme Twist fires), so it is a genuine OPTIONAL pending choice (the optional-ko-reward pattern): the onPlay HERO_EFFECT_HANDLERS entry (heroEffectOptionalPlayVillainTop) parks a PendingPlayVillainTopChoice; resolvePlayVillainTopChoice({accept}) either plays the top Villain-Deck card via playTopVillainDeckCards (city entry / Master Strike / Scheme Twist cascade) then grants +attackReward Attack, or declines. Carries magnitude 2 (the attack reward) — like optional-ko-reward it relies on the executeSingleEffect magnitude pre-gate, so it is NOT in NO_MAGNITUDE_KEYWORDS. The covert gate is a separate faithful heroClassMatch condition, untouched.
  | 'reveal-herodeck-attack' // why: WP-668 / D-24481 — printed "For every 2[icon:recruit] you made this turn, Reveal the top card of the Hero Deck, put it on the bottom of that deck, and you get that card's printed[icon:attack]." (She-Hulk's Jade Giantess). A deterministic SYNCHRONOUS onPlay effect (no pending choice — the reveals are forced pure upside). MAGNITUDE carries the "for every N Recruit" divisor (2), so it is NOT in NO_MAGNITUDE_KEYWORDS. Handler heroEffectRevealHeroDeckAttack computes iterations = Math.floor(G.turnEconomy.recruit / divisor) as a SNAPSHOT at play time (faithful tabletop resolution, NOT the WP-568 recruit-threshold wait-and-see — a scaling factor cannot re-fire cleanly), then per iteration reveals G.heroDeck[0], grants its printed attack (G.cardStats[id].attack) to G.turnEconomy.attack, and rotates that card to the BOTTOM of G.heroDeck (bottoming keeps the shared deck non-depleting). The parser subsumes the co-located printed [icon:attack] exactly as attack-per-count does (D-24016), so no phantom flat attack is emitted.
  | 'smash'; // why: WP-676 / D-24492 — printed "Smash N" ("You may discard another card from your hand. If you do, you get +N attack."; the wwhk set). An interactive OPTIONAL per-instance choice. Handler heroEffectSmash parks one PendingSmashDiscard { playerID, magnitude } per Smash hook onto the FIFO G.pendingSmashDiscards queue (two hooks → two independent choices; empty hand = logged no-op, no park); resolveSmashDiscard({ cardId }) moves the hand card to discard and grants +magnitude Attack, { decline: true } pops with no grant. Carries a magnitude (the +N Attack) → relies on the executeSingleEffect magnitude pre-gate, so it is NOT in NO_MAGNITUDE_KEYWORDS (a bare magnitude-less [keyword:Smash] verb token safe-skips at that gate — no park, no freeze). She-Hulk's Hurl Trucks prints two "Smash 2" as two separate abilities[] entries → two parks (+0/+2/+4).

// why: canonical array for drift-detection. Must match HeroKeyword
// union exactly. Drift-detection test in heroAbility.setup.test.ts
// asserts array/union parity.

/**
 * All hero keywords in canonical order. Single source of truth.
 */
export const HERO_KEYWORDS: readonly HeroKeyword[] = [
  'draw',
  'attack',
  'recruit',
  'ko',
  'rescue',
  'wound',
  'reveal',
  'reveal-ko',
  'reveal-min',
  'reveal-ko-or-draw', // why: D-21802
  'reveal-cost-attack', // why: D-21901
  'reveal-odd-draw', // why: D-21902
  'reveal-attack-choose', // why: D-22003
  'reveal-ko-attack', // why: D-22301 — compound executor; magnitude encodes fixed attack grant (not a cost ceiling)
  'attack-per-count', // why: D-24016 — count-scaled attack; magnitude is the per-unit rate, countSource resolves the count
  'recruit-per-count', // why: WP-674 / D-24489 — count-scaled recruit (the attack-per-count sibling); magnitude is the per-unit rate, countSource resolves the count; handler heroEffectRecruitPerCount grants to G.turnEconomy.recruit
  'optional-ko-reward', // why: D-24019 — "you may KO a card from hand/discard; if you do, <reward>"; rewardType carries the reward
  'optional-ko-hand-discard', // why: WP-667 / D-24480 — "you may KO a card from your hand or discard pile" (no reward, Radioactive Riot); parks a no-reward entry into the optional-ko-reward pending queue (koZones hand/discard); no magnitude
  'ko-wound-reward', // why: WP-382 / D-24183 — Wound-restricted, auto-resolving variant of optional-ko-reward (Healing Factor family); rewardType carries the reward
  'wall-crawl', // why: D-24049 — printed "Wall-Crawl"; executable via the recruitHero deck-top placement, not an onPlay HERO_EFFECT_HANDLERS entry
  'dodge', // why: D-24051 — printed "Dodge"; executable via the dodgeCard hand-discard-to-draw move, not an onPlay HERO_EFFECT_HANDLERS entry
  'undercover', // why: D-24060 / WP-282 — "send a card face-down, play it later"; executable via sendUndercover + playFromUndercover moves on onPlay trigger
  'conditional',
  'victory-villain-attack', // why: D-24068 / WP-285 — "gain +attack equal to the printed attack of a villain in your victory pile"; parks a pending pick resolved by resolveVictoryPileCardPick
  'draw-or-empowered', // why: D-24069 / WP-286 — "Choose one: Draw a card, or you get Empowered by [class]"; parks a PendingDrawOrEmpowered resolved by resolveDrawOrEmpowered
  'count-scaled-choose', // why: WP-675 / D-24490 — "Choose one: +N recruit/attack per other icon-bearing card" (vnom Symbiotic Adaptation); parks a PendingCountScaledChoice resolved by resolveCountScaledChoice
  'size-changing', // why: D-24074 / WP-290 — printed "Size-Changing: [Class]"; a class-grant realized at class-read time, no onPlay handler (the wall-crawl class)
  'optional-put-bottom-hq', // why: "You may put a card from the HQ on the bottom of the Hero Deck"; parks a pending choice resolved by resolveOptionalPutBottomHQ
  'put-any-number-bottom-hq', // why: D-24132 — "Choose any number of cards/Heroes from the HQ. Put them on the bottom of the Hero Deck" (multi-select); parks a pending choice resolved by resolvePutAnyNumberBottomHQ
  'put-bottom-hq-icon-reward', // why: D-24133 — mandatory single-card "Put a card from the HQ on the bottom of the Hero Deck. If that card had a recruit/attack icon, +N" (Absorb Ambient Power); parks a mandatory PendingOptionalPutBottomHQ resolved by resolveOptionalPutBottomHQ
  'return-zero-cost-discard', // why: D-24139 — mandatory "Return a 0-cost card from your discard pile to your hand" (Defend the Weak); parks a mandatory PendingReturnZeroCostDiscard resolved by resolveReturnZeroCostDiscard
  'gain-wound-self', // why: D-24156 — "You gain a Wound."; active player gains 1 Wound (to discard) via the WP-017 gainWound helper
  'gain-wound-each', // why: D-24156 — "Each player gains a Wound." (Crazed Rampage); every player gains 1 Wound via the WP-316 villain per-target loop
  'shuffle-discard-empty-reward', // why: D-24148 — mandatory immediate "empty discard → +N reward; otherwise shuffle discard into deck" (Jocasta's Reprocess / Electromagnetic Eyebeams); no pending choice
  'discard-to-play', // why: WP-383 / D-24184 — mandatory play COST "discard a card to play this card"; pre-commit precondition (D-24185) + a mandatory PendingDiscardToPlay resolved by resolveDiscardToPlay
  'defeat-with-bystander', // why: WP-486 / D-24291 — printed "Defeat a Villain or Mastermind that has a Bystander." (Silent Sniper); onPlay handler defeats one eligible target via the shared fight-defeat path (no attack spend); ≥2 targets parks a PendingDefeatChoice resolved by resolveDefeatChoice
  'copy-powers', // why: WP-535 / D-24345 — printed "Play this card as a copy of another Hero you played this turn." (Rogue's Copy Powers); onPlay handler re-fires the chosen Hero's ability + grants Copy Powers the copied class; ≥2 eligible Heroes parks a PendingCopyPowersChoice resolved by resolveCopyPowersChoice
  'return-on-discard', // why: WP-498 / D-24301 — reactive "If a card effect makes you discard this card, you may return this card to your hand." (Cyclops Unending Energy); onDiscard timing, fires at the discardFromHand chokepoint, parks an OPTIONAL PendingReturnOnDiscard; enrolled in DISCARD_TIME_EXECUTED_KEYWORDS (no onPlay handler)
  'recruit-as-attack', // why: WP-580 / D-24389 — "You can use Recruit as Attack this turn." (God of Thunder); onPlay handler sets the turn-scoped recruit-as-attack conversion flag; the first resource-conversion primitive
  'steal-abilities', // why: WP-592 / D-24401 — Rogue's Steal Abilities "Each player discards the top card of their deck. Play a copy of each of those cards." (deterministic synchronous onPlay handler: each player discards their deck top, then the Steal Abilities player plays a copy of each = economy + reentrant executeHeroEffects re-fire, no class/team; recursion guard excludes a discarded steal-abilities OR copy-powers)
  'investigate', // why: WP-564 / D-24373 — "Investigate for <criterion>" static-criterion + DRAW subset (Alias Investigations + siblings); onPlay handler looks at the top investigateLookCount (default 2), draws the FIRST card matching investigateCriteria in look order, bottoms the rest in look order. Deterministic — no pending choice; deferred variants keep their parse-unrecognized markers
  'transform', // why: WP-658 / D-24469 — "[keyword:Transform] this into <second-form>" (wwhk); swaps a played base card for its second-form from the G.transformDeck side deck (D-24468). Handler heroEffectTransform reads G.transformTargets, pulls the second-form into play, routes the base back to the side deck (permanent upgrade), applies its printed attack/recruit. Resolved only for the SUPPORTED_TRANSFORM_BASES allowlist (She-Hulk first); other wwhk transform cards keep their parse-unrecognized markers (unmodeled condition → honest hollow)
  'reveal-from-hand', // why: WP-659 / D-24470 — "Each player may reveal another [team]/[hc] Hero. Each player who does draws a card." (Psychic Link); the co-located token is the reveal CRITERION (an InvestigateCriterion), not a play-gate — the marker suppresses it from Steps 1a/1b. Handler heroEffectRevealFromHand: each player (Object.keys(G.playerZones).sort()) holding a criterion match draws 1. Auto-reveal (pure upside, no park); reveal is state-neutral (card stays in hand). No magnitude, no new G field
  'optional-play-villain-top', // why: WP-663 / D-24474 — "[hc:covert]: You may play the top card of the Villain Deck. If you do, +2 Attack." (Shadowed Thoughts); an OPTIONAL pending choice (the optional-ko-reward pattern — real downside, so no auto-take). Handler heroEffectOptionalPlayVillainTop parks a PendingPlayVillainTopChoice; resolvePlayVillainTopChoice({accept}) plays the top Villain-Deck card via playTopVillainDeckCards (city entry / Master Strike / Scheme Twist cascade) + grants +2 Attack, or declines. Carries magnitude 2 → relies on the pre-gate, NOT in NO_MAGNITUDE_KEYWORDS. Covert gate untouched
  'reveal-herodeck-attack', // why: WP-668 / D-24481 — "For every 2[icon:recruit] you made this turn, Reveal the top card of the Hero Deck, put it on the bottom of that deck, and you get that card's printed[icon:attack]." (Jade Giantess). A deterministic SYNCHRONOUS onPlay effect; magnitude carries the "for every N Recruit" divisor (2), so NOT in NO_MAGNITUDE_KEYWORDS. Handler heroEffectRevealHeroDeckAttack: iterations = Math.floor(G.turnEconomy.recruit / divisor) snapshotted at play time (faithful tabletop timing, NOT wait-and-see); per iteration reveals G.heroDeck[0], grants its printed attack (G.cardStats[id].attack) to G.turnEconomy.attack, rotates it to the bottom of G.heroDeck. Parser subsumes the co-located printed [icon:attack] (the D-24016 attack-per-count precedent)
  'smash', // why: WP-676 / D-24492 — printed "Smash N" ("You may discard another card from your hand. If you do, you get +N attack."; wwhk). Handler heroEffectSmash parks a PendingSmashDiscard per Smash hook; resolveSmashDiscard discards a hand card for +N Attack or declines. Carries a magnitude → NOT in NO_MAGNITUDE_KEYWORDS. Hurl Trucks' two "Smash 2" entries → two independent parks (+0/+2/+4)
] as const;

// ---------------------------------------------------------------------------
// HeroAbilityTiming
// ---------------------------------------------------------------------------

// why: timing labels are declarative only — no execution semantics.
// Defaults to 'onPlay' when markup does not encode timing explicitly.
// Same closed-union pattern as HeroKeyword.

/**
 * Closed canonical union of hero ability timing labels.
 *
 * Adding a new timing requires a DECISIONS.md entry and updating both
 * the type and the HERO_ABILITY_TIMINGS array.
 */
export type HeroAbilityTiming =
  | 'onPlay'
  | 'onFight'
  | 'onRecruit'
  | 'onKO'
  | 'onReveal'
  | 'onDiscard'; // why: WP-498 / D-24301 — the first reactive timing; a card effect discarding the marked card from hand fires it at the discardFromHand chokepoint. Declarative-only (the chokepoint keys on the keyword, not this timing); there is no onDiscard dispatch in the onPlay executor loop.

// why: canonical array for drift-detection. Must match HeroAbilityTiming
// union exactly. Same pattern as HERO_KEYWORDS.

/**
 * All hero ability timings in canonical order. Single source of truth.
 */
export const HERO_ABILITY_TIMINGS: readonly HeroAbilityTiming[] = [
  'onPlay',
  'onFight',
  'onRecruit',
  'onKO',
  'onReveal',
  'onDiscard', // why: WP-498 / D-24301 — the first reactive timing (discardFromHand chokepoint); declarative-only
] as const;
