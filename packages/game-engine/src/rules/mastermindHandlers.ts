/**
 * Mastermind strike handler dispatcher for the ImplementationMap.
 *
 * The exported `mastermindStrikeHandler` is a dispatcher that branches on
 * `G.selection.mastermindId`. Per-mastermind handlers implement card-text
 * effects (e.g., Magneto forces each player to discard down to four cards).
 * The generic strike-counter increment and the D-15401 bystander capture
 * run for every mastermind so card-specific handlers stay focused on the
 * card text.
 *
 * No boardgame.io imports. No registry imports.
 */

import type { RuleEffect } from './ruleHooks.types.js';
import type { ImplementationMap } from './ruleRuntime.execute.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { composeMastermindStrikeNarrative } from '../events/notableEvents.compose.js';
import { pushLog } from '../log/logPush.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import { koCard } from '../board/ko.logic.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { gainWound } from '../board/wounds.logic.js';
import { formatCardRef } from '../log/logDisplay.js';

// why: mastermind ext_id constants — matching against
// G.selection.mastermindId for per-mastermind dispatch. Strings come from
// the registry; the runtime loadout
// (apps/arena-client/public/loadout-test.json) and tests use
// `core/<slug>`.
const MASTERMIND_MAGNETO = 'core/magneto';

// why: core Magneto's Master Strike text: "Each player reveals an
// [team:x-men] Hero or discards down to four cards." This takes the punitive
// branch — each player discards down to four — because the engine has no
// reveal-and-choose interaction model. Team affiliation IS available (WP-179
// put it on G.cardTraits, which the co2e resolvers below read); the blocker
// is the reveal-and-choose mechanic, not the data. A future WP can add it.
// Note this is core/magneto only — co2e/magneto prints DIFFERENT text and
// has its own resolver.
const MAGNETO_HAND_SIZE_LIMIT = 4;

// why: both Red Skull faces print the identical Master Strike text —
// "Each player KOs a Hero from their hand." The co2e 2nd-edition base face
// (`co2e/red-skull`) matches core's text verbatim, and mastermind setup
// selects the first non-tactic face, so a co2e Red Skull resolves to this
// base face. The co2e epic face (`epic-red-skull`) prints different text
// and is never engine-selectable, so it is deliberately excluded here.
const MASTERMINDS_RED_SKULL: readonly string[] = [
  'core/red-skull',
  'co2e/red-skull',
];

// why: WP-388 / D-24192 — the four remaining co2e masterminds whose printed
// Master Strike is implemented. Each is its own constant because each prints
// different text; there is no shared-text list like Red Skull's.
//
// why: co2e/magneto is deliberately SEPARATE from MASTERMIND_MAGNETO above.
// The two Magnetos print different strikes (core: reveal-or-discard-to-four;
// co2e: discard an X-Men Hero or gain a Wound), so folding co2e into the core
// branch would play the wrong card text.
//
// why: base faces only. Each co2e mastermind also ships an epic face printing
// different text, which is not engine-selectable — mastermind setup takes the
// FIRST non-tactic face (D-24193 / WP-389), and no epic opt-in exists yet.
const MASTERMIND_CO2E_DOCTOR_DOOM = 'co2e/doctor-doom';
const MASTERMIND_CO2E_LOKI = 'co2e/loki';
const MASTERMIND_CO2E_MAGNETO = 'co2e/magneto';
const MASTERMIND_CO2E_DOCTOR_OCTOPUS = 'co2e/doctor-octopus';

// why: co2e Loki and Doctor Octopus gate on these normalized lowercase trait
// slugs, matching G.cardTraits values verbatim (traits.normalize.ts lowercases
// and trims only — it does not rewrite separators).
const TEAM_X_MEN = 'x-men';
const TEAM_SPIDER_FRIENDS = 'spider-friends';
const HERO_CLASS_STRENGTH = 'strength';

// why: WP-397 — Doctor Octopus's printed strike reveals the top 8 cards of the
// deck for any player who does not discard a Spider-Friends Hero.
const DOCTOR_OCTOPUS_REVEAL_COUNT = 8;

/**
 * Whether a card is a "non-grey Hero" in the tabletop sense.
 *
 * @param gameState - The game state (read-only; supplies cardTraits).
 * @param cardExtId - The card to classify.
 * @returns True when the card carries a Hero Class.
 */
function isNonGreyHero(
  gameState: LegendaryGameState,
  cardExtId: CardExtId,
): boolean {
  // why: the rulebook defines "grey Heroes" as grey-coloured cards with NO
  // Hero Class (S.H.I.E.L.D. Agents, Troopers, Officers, Sidekicks), so
  // non-grey is exactly "has a Hero Class". Loose `!=` so both null and
  // undefined read as grey. Wounds carry no Hero Class and are therefore grey
  // — they are never discarded by this branch, which is correct: a Wound is
  // not a Hero. Defensive `?.` on the map itself for legacy states predating
  // WP-179.
  return gameState.cardTraits?.[cardExtId]?.heroClass != null;
}

/**
 * Narrows the rule-pipeline context to its deterministic shuffle function.
 *
 * @param context - The context the rule pipeline passed to the handler.
 * @returns The Shuffle function, or null when the context does not carry one.
 */
function resolveShuffleFunction(
  context: unknown,
): (<T>(items: T[]) => T[]) | null {
  // why: `performVillainReveal` passes the full RevealContext into
  // executeRuleHooks precisely so handlers can reach `context.random.Shuffle`
  // (see the Step-5 `// why:` there) — the strike handler previously ignored
  // it. Narrowed structurally rather than by importing RevealContext, which
  // would couple the rules module to the villain-deck module, and without any
  // boardgame.io type.
  if (typeof context !== 'object' || context === null) {
    return null;
  }
  const random = (context as { random?: unknown }).random;
  if (typeof random !== 'object' || random === null) {
    return null;
  }
  const shuffle = (random as { Shuffle?: unknown }).Shuffle;
  if (typeof shuffle !== 'function') {
    return null;
  }
  return shuffle as <T>(items: T[]) => T[];
}

/**
 * Captures one bystander from the top of the bystander supply onto the
 * mastermind per D-15401. If the supply is empty, logs a message and
 * skips. Mutates G directly so callers do not need a new effect type.
 *
 * @param gameState - The game state to mutate.
 */
function captureBystanderOntoMastermind(gameState: LegendaryGameState): void {
  if (gameState.piles.bystanders.length > 0) {
    const [captured, ...remainingBystanders] = gameState.piles.bystanders;
    gameState.piles.bystanders = remainingBystanders;
    gameState.mastermind.attachedBystanders = [
      ...gameState.mastermind.attachedBystanders,
      captured!,
    ];
  } else {
    // why: bystander supply exhausted, no capture per D-15401
    gameState.messages = [
      ...gameState.messages,
      '[Master Strike] Bystander supply is empty — no bystander captured.',
    ];
  }
}

/**
 * Builds the shared counter-increment effects that fire for every
 * mastermind strike regardless of the card-specific text.
 *
 * @returns Generic RuleEffect[] applied to every strike.
 */
function buildGenericStrikeEffects(): RuleEffect[] {
  return [
    {
      type: 'modifyCounter',
      counter: 'masterStrikeCount',
      delta: 1,
    },
    {
      type: 'queueMessage',
      message: 'Mastermind strike revealed — strike count incremented.',
    },
  ];
}

/**
 * Resolves Magneto's Master Strike (MVP punitive branch).
 *
 * Strike text: "Each player reveals an [team:x-men] Hero or discards
 * down to four cards." MVP simplification: every player simply discards
 * down to four cards. Cards are moved from the top of each player's
 * hand into their discard pile until the hand has four or fewer cards.
 *
 * Mutates G directly. Per-player messages are appended to G.messages so
 * replay tooling can observe the effect.
 *
 * @param gameState - The game state to mutate.
 */
function resolveMagnetoStrike(gameState: LegendaryGameState): void {
  const playerIds = Object.keys(gameState.playerZones).sort();

  for (const playerId of playerIds) {
    const playerZones = gameState.playerZones[playerId]!;
    const startingHandSize = playerZones.hand.length;

    if (startingHandSize <= MAGNETO_HAND_SIZE_LIMIT) {
      pushLog(gameState, 
        `[Magneto Master Strike] Player ${playerId} already has ${startingHandSize} card(s) in hand — no discard.`,
      );
      continue;
    }

    const discardCount = startingHandSize - MAGNETO_HAND_SIZE_LIMIT;
    // why: discard from the front of the hand (top-of-hand convention)
    // so the kept cards are the most recently drawn. The choice is
    // arbitrary for MVP; future WP may let the player choose.
    const discarded = playerZones.hand.slice(0, discardCount);
    const kept = playerZones.hand.slice(discardCount);
    playerZones.hand = kept;
    playerZones.discard = [...playerZones.discard, ...discarded];

    pushLog(gameState,
      `[Magneto Master Strike] Player ${playerId} discarded ${discardCount} card(s) down to ${MAGNETO_HAND_SIZE_LIMIT}.`,
    );
  }
}

/**
 * Selects the Hero a player KOs for a Red Skull Master Strike: the eligible
 * hand card with the lowest recruit cost, ties broken by lowest hand index.
 * A hand card is a Hero iff it is not a Wound.
 *
 * @param gameState - The game state (read-only here; supplies cardStats).
 * @param hand - The player's hand, in order.
 * @returns The ext_id to KO, or null when the hand holds no Hero.
 */
function selectRedSkullKoTarget(
  gameState: LegendaryGameState,
  hand: readonly CardExtId[],
): CardExtId | null {
  // why: WP-388 — Red Skull's rule is the ungated case of the shared
  // selector. Delegating keeps its behavior byte-identical while giving the
  // co2e resolvers one selection rule to share.
  return selectLowestCostHero(gameState, hand, 'any', null);
}

/**
 * The trait dimension a strike gates its Hero selection on.
 *
 * `'any'` matches every Hero. `'team'` and `'heroClass'` match the
 * corresponding `G.cardTraits` field against a slug.
 */
type HeroTraitKind = 'any' | 'team' | 'heroClass';

/**
 * Selects the lowest-cost Hero in a hand, optionally gated on one trait.
 *
 * Shared by every per-mastermind strike resolver. Ties are broken by lowest
 * hand index. Returns null when the hand holds no matching Hero.
 *
 * @param gameState - The game state (read-only here; supplies cardStats and cardTraits).
 * @param hand - The player's hand, in order.
 * @param traitKind - Which trait to gate on, or `'any'` for no gate.
 * @param traitSlug - The normalized lowercase slug to match; ignored when traitKind is `'any'`.
 * @returns The selected ext_id, or null when nothing matches.
 */
function selectLowestCostHero(
  gameState: LegendaryGameState,
  hand: readonly CardExtId[],
  traitKind: HeroTraitKind,
  traitSlug: string | null,
): CardExtId | null {
  let selectedExtId: CardExtId | null = null;
  let selectedCost = Number.POSITIVE_INFINITY;
  for (const cardExtId of hand) {
    // why: Wounds are not Heroes — the only non-Hero card the engine ever
    // puts in a hand — so they are never a selection target.
    if (cardExtId === WOUND_EXT_ID) {
      continue;
    }
    // why: a plain discriminator argument rather than a predicate callback —
    // `.claude/rules/code-style.md` §Functions bans closures-as-config. Trait
    // values come from G.cardTraits (WP-179), resolved at setup so no registry
    // read is needed at runtime; a card with no entry yields undefined and
    // simply never matches.
    if (traitKind !== 'any') {
      // why: defensive `?.` on the map itself, matching the cardDisplayData
      // precedent in this file — legacy test states predate G.cardTraits
      // (WP-179) and leave it undefined. Production setup always builds it.
      // A missing map means nothing matches rather than a throw (AC-9).
      const traitEntry = gameState.cardTraits?.[cardExtId];
      const traitValue =
        traitKind === 'team' ? traitEntry?.team : traitEntry?.heroClass;
      if (traitValue !== traitSlug) {
        continue;
      }
    }
    // why: `?? 0` — S.H.I.E.L.D. starters (Agent / Trooper) carry no
    // cardStats entry (D-21502) and are treated as cost 0, so a starter is
    // picked over any priced Hero (the cheapest-card tabletop instinct).
    const cardCost = gameState.cardStats[cardExtId]?.cost ?? 0;
    // why: strict `<` keeps the FIRST (lowest hand index) card on a cost tie.
    if (cardCost < selectedCost) {
      selectedCost = cardCost;
      selectedExtId = cardExtId;
    }
  }
  return selectedExtId;
}

/**
 * Moves one card from a player's hand to their discard pile.
 *
 * @param playerZones - The player's zones, mutated in place.
 * @param cardExtId - The card to discard.
 */
function discardCardFromHand(
  playerZones: { hand: CardExtId[]; discard: CardExtId[] },
  cardExtId: CardExtId,
): void {
  // why: moveCardFromZone is NON-mutating — it returns { from, to, found } —
  // so BOTH arrays must be assigned back. The Red Skull KO path above assigns
  // only `.from` because its destination is a throwaway `[]` and the append
  // goes through koCard; copying that shape here would drop the discarded
  // card silently. Duplicate ext_ids are fungible tokens (WP-382 / D-24183),
  // so first-match removal is observationally identical to index removal.
  const moveResult = moveCardFromZone(
    playerZones.hand,
    playerZones.discard,
    cardExtId,
  );
  playerZones.hand = moveResult.from;
  playerZones.discard = moveResult.to;
}

/**
 * Gives one Wound from the supply to a player's discard pile.
 *
 * @param gameState - The game state to mutate.
 * @param playerZones - The player's zones, mutated in place.
 * @returns True when a Wound was actually taken; false when the supply is empty.
 */
function gainWoundToDiscard(
  gameState: LegendaryGameState,
  playerZones: { discard: CardExtId[] },
): boolean {
  // why: gainWound is NON-mutating like moveCardFromZone — assign both
  // returned arrays back. An empty wounds pile returns copies unchanged, so
  // the length comparison is how we detect the no-op (never a throw, AC-9).
  const woundResult = gainWound(gameState.piles.wounds, playerZones.discard);
  const tookWound = woundResult.woundsPile.length < gameState.piles.wounds.length;
  gameState.piles.wounds = woundResult.woundsPile;
  playerZones.discard = woundResult.playerDiscard;
  return tookWound;
}

/**
 * Resolves Red Skull's Master Strike: "Each player KOs a Hero from their
 * hand." Each player (in sorted id order) KOs one Hero — the lowest-cost
 * eligible card, tie broken by lowest hand index (the D-24188 deterministic
 * auto-pick: lowest-cost ≈ the player-optimal tabletop pick, which avoids a
 * blocking multi-player pending-choice) — from their hand to the global KO
 * pile. A player with no Hero in hand (empty, or all Wounds) takes no KO and
 * logs a no-op line.
 *
 * Mutates G directly, mirroring resolveMagnetoStrike. One durable log line
 * per player.
 *
 * @param gameState - The game state to mutate.
 */
function resolveRedSkullStrike(gameState: LegendaryGameState): void {
  const playerIds = Object.keys(gameState.playerZones).sort();

  for (const playerId of playerIds) {
    const playerZones = gameState.playerZones[playerId]!;
    const targetExtId = selectRedSkullKoTarget(gameState, playerZones.hand);

    if (targetExtId === null) {
      pushLog(gameState,
        `[Red Skull Master Strike] Player ${playerId} has no Hero in hand to KO.`,
      );
      continue;
    }

    // why: remove from hand then append to the global KO pile — the WP-382 /
    // D-24183 KO idiom. Duplicate ext_ids are fungible tokens, so removing the
    // first occurrence is observationally identical to removing the exact
    // selected index.
    const moveResult = moveCardFromZone(playerZones.hand, [], targetExtId);
    playerZones.hand = moveResult.from;
    gameState.ko = koCard(gameState.ko, targetExtId);

    pushLog(gameState,
      `[Red Skull Master Strike] Player ${playerId} KO'd ${formatCardRef(gameState.cardDisplayData, targetExtId)} from their hand.`,
    );
  }
}

/**
 * Resolves co2e Doctor Doom's Master Strike: "Stack this Strike next to
 * Doctor Doom as 'Omen of Doom.' Then each player discards cards equal to
 * the number of Omens or gains a Wound."
 *
 * Each player (in sorted id order) whose hand can cover the Omen count
 * discards that many cards, lowest-cost first; everyone else gains a Wound.
 *
 * @param gameState - The game state to mutate.
 */
function resolveDoctorDoomStrike(gameState: LegendaryGameState): void {
  // why: D-24192 — the Omen count is DERIVED, not stored. Every Doom strike
  // stacks exactly one Omen, so the Omen total is the strike count. The
  // generic `modifyCounter` effect is applied by the pipeline AFTER this
  // handler returns, so the counter still holds the pre-strike value here and
  // the strike being resolved is `+ 1`. `?? 0` because G.counters is not
  // seeded at setup. No Omen zone is created.
  const omenCount = (gameState.counters.masterStrikeCount ?? 0) + 1;
  const playerIds = Object.keys(gameState.playerZones).sort();

  for (const playerId of playerIds) {
    const playerZones = gameState.playerZones[playerId]!;

    // why: the printed choice is "discard N or gain a Wound". A hand that
    // cannot cover N takes the Wound — the same branch a tabletop player is
    // forced into. Deterministic auto-pick per D-24192; no prompt.
    if (playerZones.hand.length < omenCount) {
      const tookWound = gainWoundToDiscard(gameState, playerZones);
      pushLog(gameState,
        tookWound
          ? `[Doctor Doom Master Strike] Player ${playerId} could not discard ${omenCount} card(s) (${omenCount} Omen(s)) and gained a Wound.`
          : `[Doctor Doom Master Strike] Player ${playerId} could not discard ${omenCount} card(s) and the Wound supply is empty — no effect.`,
      );
      continue;
    }

    let discardedCount = 0;
    while (discardedCount < omenCount) {
      const targetExtId = selectLowestCostHero(
        gameState,
        playerZones.hand,
        'any',
        null,
      );
      // why: the hand is large enough by count but may hold fewer Heroes than
      // Omens (Wounds are never selectable). Stop rather than loop forever or
      // throw — moves never throw, and the shortfall is logged below.
      if (targetExtId === null) {
        break;
      }
      discardCardFromHand(playerZones, targetExtId);
      discardedCount += 1;
    }

    pushLog(gameState,
      discardedCount === omenCount
        ? `[Doctor Doom Master Strike] Player ${playerId} discarded ${discardedCount} card(s) for ${omenCount} Omen(s).`
        : `[Doctor Doom Master Strike] Player ${playerId} discarded only ${discardedCount} of ${omenCount} card(s) — no eligible Heroes remained.`,
    );
  }
}

/**
 * Resolves co2e Loki's Master Strike: "Each player discards a
 * [hc:strength] Hero or stacks a non-grey Hero from their hand next to Loki
 * as a Hypno-Thrall."
 *
 * Each player (in sorted id order) discards their lowest-cost Strength Hero.
 *
 * @param gameState - The game state to mutate.
 */
function resolveLokiStrike(gameState: LegendaryGameState): void {
  const playerIds = Object.keys(gameState.playerZones).sort();

  for (const playerId of playerIds) {
    const playerZones = gameState.playerZones[playerId]!;
    const targetExtId = selectLowestCostHero(
      gameState,
      playerZones.hand,
      'heroClass',
      HERO_CLASS_STRENGTH,
    );

    // why: D-24192 — the Hypno-Thrall branch is deliberately NOT implemented
    // (it needs a new mastermind-adjacent zone), so a player with no Strength
    // Hero takes a logged no-op and escapes the strike. This is a recorded
    // fidelity gap, not an oversight: do NOT substitute a Wound or improvise
    // the Thrall stack.
    if (targetExtId === null) {
      pushLog(gameState,
        `[Loki Master Strike] Player ${playerId} has no [hc:strength] Hero in hand — no effect.`,
      );
      continue;
    }

    discardCardFromHand(playerZones, targetExtId);
    pushLog(gameState,
      `[Loki Master Strike] Player ${playerId} discarded ${formatCardRef(gameState.cardDisplayData, targetExtId)}.`,
    );
  }
}

/**
 * Resolves co2e Magneto's Master Strike: "Each player discards an
 * [team:x-men] Hero or gains a Wound."
 *
 * Each player (in sorted id order) discards their lowest-cost X-Men Hero, or
 * gains a Wound when they hold none.
 *
 * @param gameState - The game state to mutate.
 */
function resolveCo2eMagnetoStrike(gameState: LegendaryGameState): void {
  const playerIds = Object.keys(gameState.playerZones).sort();

  for (const playerId of playerIds) {
    const playerZones = gameState.playerZones[playerId]!;
    const targetExtId = selectLowestCostHero(
      gameState,
      playerZones.hand,
      'team',
      TEAM_X_MEN,
    );

    // why: this branch is fully faithful — a player holding no X-Men Hero
    // must take the Wound at the table too, so no fidelity is lost.
    if (targetExtId === null) {
      const tookWound = gainWoundToDiscard(gameState, playerZones);
      pushLog(gameState,
        tookWound
          ? `[Magneto Master Strike] Player ${playerId} has no [team:x-men] Hero in hand and gained a Wound.`
          : `[Magneto Master Strike] Player ${playerId} has no [team:x-men] Hero in hand and the Wound supply is empty — no effect.`,
      );
      continue;
    }

    discardCardFromHand(playerZones, targetExtId);
    pushLog(gameState,
      `[Magneto Master Strike] Player ${playerId} discarded ${formatCardRef(gameState.cardDisplayData, targetExtId)}.`,
    );
  }
}

/**
 * Resolves co2e Doctor Octopus's Master Strike: "Each player may discard a
 * [team:spider-friends] Hero. Any player who doesn't must reveal the top 8
 * cards of their deck, discard all non-grey Heroes revealed, and put the rest
 * back in random order."
 *
 * Each player (in sorted id order) discards their lowest-cost Spider-Friends
 * Hero.
 *
 * @param gameState - The game state to mutate.
 */
function resolveDoctorOctopusStrike(
  gameState: LegendaryGameState,
  shuffleFunction: (<T>(items: T[]) => T[]) | null,
): void {
  const playerIds = Object.keys(gameState.playerZones).sort();

  for (const playerId of playerIds) {
    const playerZones = gameState.playerZones[playerId]!;
    const targetExtId = selectLowestCostHero(
      gameState,
      playerZones.hand,
      'team',
      TEAM_SPIDER_FRIENDS,
    );

    // why: taking the discard branch is the player-optimal read of the printed
    // "may" — surrendering one chosen Hero beats revealing eight cards and
    // losing every non-grey Hero among them. D-24192 auto-pick.
    if (targetExtId !== null) {
      discardCardFromHand(playerZones, targetExtId);
      pushLog(gameState,
        `[Doctor Octopus Master Strike] Player ${playerId} discarded ${formatCardRef(gameState.cardDisplayData, targetExtId)}.`,
      );
      continue;
    }

    // why: WP-397 / D-24200 — the printed alternative for a player who does
    // not discard: "reveal the top 8 cards of their deck, discard all non-grey
    // Heroes revealed, and put the rest back in random order."
    resolveDoctorOctopusReveal(gameState, playerId, playerZones, shuffleFunction);
  }
}

/**
 * Resolves one player's reveal-eight branch of Doctor Octopus's Master Strike.
 *
 * @param gameState - The game state to mutate (log lines).
 * @param playerId - The player being resolved, for log lines.
 * @param playerZones - The player's zones, mutated in place.
 * @param shuffleFunction - Deterministic shuffle, or null when unavailable.
 */
function resolveDoctorOctopusReveal(
  gameState: LegendaryGameState,
  playerId: string,
  playerZones: { deck: CardExtId[]; discard: CardExtId[] },
  shuffleFunction: (<T>(items: T[]) => T[]) | null,
): void {
  // why: reveal what is there and no more. The engine's reveal family never
  // reshuffles the discard to top up a short deck (see the D-21502 no-op in
  // effectPrimitive.interpret.ts); only the DRAW path reshuffles, which is the
  // correct rule split — this effect reveals, it does not draw.
  const revealCount = Math.min(
    DOCTOR_OCTOPUS_REVEAL_COUNT,
    playerZones.deck.length,
  );

  if (revealCount === 0) {
    pushLog(gameState,
      `[Doctor Octopus Master Strike] Player ${playerId} has an empty deck — nothing revealed.`,
    );
    return;
  }

  // why: index 0 is the top of the deck — the engine's draw convention
  // (`drawCardsIntoHand` reads `deck[0]`).
  const revealed = playerZones.deck.slice(0, revealCount);
  const untouchedTail = playerZones.deck.slice(revealCount);

  const discardedCards: CardExtId[] = [];
  const returnedCards: CardExtId[] = [];
  for (const cardExtId of revealed) {
    if (isNonGreyHero(gameState, cardExtId)) {
      discardedCards.push(cardExtId);
    } else {
      returnedCards.push(cardExtId);
    }
  }

  // why: the remainder goes back in RANDOM order because the printed effect
  // exists to deny the player free deck information — returning eight cards in
  // a known order would turn the strike into a benefit. ctx.random.Shuffle is
  // the framework PRNG and the only permitted randomness, so replay stays
  // faithful. A context without Shuffle (unit-test stubs pass `{}`) degrades
  // to revealed order, which is deterministic and logged rather than silent.
  const returnedInOrder = shuffleFunction
    ? shuffleFunction(returnedCards)
    : returnedCards;

  playerZones.deck = [...returnedInOrder, ...untouchedTail];
  playerZones.discard = [...playerZones.discard, ...discardedCards];

  const orderNote = shuffleFunction ? '' : ' (revealed order — no shuffle available)';
  pushLog(gameState,
    `[Doctor Octopus Master Strike] Player ${playerId} revealed ${revealCount} card(s), discarded ${discardedCards.length} non-grey Hero(es), and returned ${returnedInOrder.length} to the top of their deck${orderNote}.`,
  );
}

/**
 * Mastermind strike handler dispatcher.
 *
 * Branches on `G.selection.mastermindId`. The generic bystander capture
 * (D-15401) runs for every strike. Per-mastermind text effects mutate G
 * directly. The returned RuleEffect[] carries only the shared counter
 * increment and message — card-specific work is done inline.
 *
 * @param gameState - Current game state (mutated for bystander capture and per-mastermind effects).
 * @param _ctx - Context (unused — chained reveals are scheme-side for now).
 * @param payload - Trigger payload `{ cardId }` from villain reveal.
 *   WP-200: read to source `strikeCardId` for the terminal
 *   `mastermindStrikeResolved` emission. Production dispatch always
 *   passes a real `{ cardId: string }`; unit tests that call the handler
 *   directly with a stub fall back to an empty string so the emission
 *   produces a well-typed event without throwing.
 * @param _implementationMap - Handler map (unused; reserved for future cascading strikes).
 * @returns Array of RuleEffect descriptions to apply.
 */
export function mastermindStrikeHandler(
  gameState: LegendaryGameState,
  strikeContext: unknown,
  payload: unknown,
  _implementationMap: ImplementationMap,
): RuleEffect[] {
  captureBystanderOntoMastermind(gameState);

  // why: branches are mutually exclusive per mastermind id — a mastermind
  // matching none of them takes no branch and the strike is generic
  // bookkeeping only (its printed text is not yet implemented).
  const mastermindId = gameState.selection.mastermindId;
  if (mastermindId === MASTERMIND_MAGNETO) {
    resolveMagnetoStrike(gameState);
  } else if (MASTERMINDS_RED_SKULL.includes(mastermindId)) {
    resolveRedSkullStrike(gameState);
  } else if (mastermindId === MASTERMIND_CO2E_DOCTOR_DOOM) {
    resolveDoctorDoomStrike(gameState);
  } else if (mastermindId === MASTERMIND_CO2E_LOKI) {
    resolveLokiStrike(gameState);
  } else if (mastermindId === MASTERMIND_CO2E_MAGNETO) {
    resolveCo2eMagnetoStrike(gameState);
  } else if (mastermindId === MASTERMIND_CO2E_DOCTOR_OCTOPUS) {
    resolveDoctorOctopusStrike(gameState, resolveShuffleFunction(strikeContext));
  }

  // why: WP-200 — terminal emission AFTER both the generic bystander
  // capture AND the per-mastermind text effect. Narrows the trigger
  // payload defensively (`unknown` from the rule pipeline) so a missing
  // / malformed payload produces an empty `strikeCardId` rather than a
  // throw — moves never throw, per architecture rules. Production dispatch
  // path from `villainDeck.reveal.ts` always supplies `{ cardId }` so the
  // empty-string fallback only surfaces in unit-test harnesses that
  // pre-date WP-200.
  const strikeCardId = (() => {
    if (payload === null || payload === undefined) return '' as CardExtId;
    if (typeof payload !== 'object') return '' as CardExtId;
    const candidate = (payload as { cardId?: unknown }).cardId;
    if (typeof candidate !== 'string') return '' as CardExtId;
    return candidate as CardExtId;
  })();
  // why: WP-200 — defensive access (`?.`) because some legacy test states
  // do not populate `cardDisplayData`. Production setup always builds it
  // (WP-111), but tests that pre-date that field cast through `as unknown
  // as LegendaryGameState` and leave it undefined. Falling back to the
  // raw `strikeCardId` keeps the emission from throwing — moves never
  // throw, per architecture rules.
  const strikeCardDisplay = gameState.cardDisplayData?.[strikeCardId];
  const strikeCardName =
    strikeCardDisplay && typeof strikeCardDisplay.name === 'string' && strikeCardDisplay.name.length > 0
      ? strikeCardDisplay.name
      : strikeCardId;
  gameState.notableEvents.push({
    type: 'mastermindStrikeResolved',
    strikeCardId,
    narrative: composeMastermindStrikeNarrative(strikeCardName),
  });

  return buildGenericStrikeEffects();
}
