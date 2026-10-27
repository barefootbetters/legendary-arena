/**
 * Scheme twist resolver functions for the Legendary Arena game engine.
 *
 * Each resolver implements a reusable twist pattern that mutates G directly.
 * Resolvers push messages to gameState.messages for every significant action.
 * They never throw — invalid params produce a message and return.
 *
 * The SCHEME_TWIST_RESOLVERS registry maps resolver IDs to functions.
 *
 * No boardgame.io imports. No registry imports. No .reduce().
 */

import type { SchemeTwistResolver, SchemeTwistResolverId } from './schemeTwistConfig.types.js';
import type { LegendaryGameState } from '../types.js';
// why: WP-513 / D-24325 — value import for the Killbots per-scheme twist counter key.
// why: WP-539 / D-24348 — DARK_PORTAL_COUNT is the Portals Dark Portal counter.
import { KILLBOT_TWISTS_NEXT_TO_SCHEME, DARK_PORTAL_COUNT } from '../types.js';
import { CITY_SPACE_NAMES } from '../board/citySpaceNames.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';
import { queueTimestreamPurge } from './timestreamPurge.logic.js';
import type { ImplementationMap } from './ruleRuntime.execute.js';
import { gainWoundForPlayer, gainWoundWithOutcome } from '../board/wounds.logic.js';
import { seatsInTurnOrderFrom } from '../turn/seatOrder.logic.js';
import { countPendingDivingBlockWounds } from '../moves/divingBlock.logic.js';
import { discardFromHand } from '../moves/discardFromHand.js';
import {
  performVillainReveal,
  playTopVillainDeckCards,
  resolveVillainEscape,
} from '../villainDeck/villainDeck.reveal.js';
// why: WP-823 / D-24756 — the Traitor Battalion counter key and the Brainwash the
// Military constants / City scan.
import { TRAITOR_BATTALION_TWISTS } from '../types.js';
import {
  BRAINWASHED_OFFICER_BASE_ATTACK,
  TRAITOR_BATTALION_STACK_LIMIT,
  listCityBrainwashedOfficers,
} from './brainwashTheMilitary.logic.js';
import { koCard } from '../board/ko.logic.js';
import { refillHqSlot, pushVillainIntoCity } from '../board/city.logic.js';
import { attachBystanderToVillain } from '../board/bystanders.logic.js';
import {
  composeSchemeTwistNarrative,
  composeStrikeBlockedNarrative,
} from '../events/notableEvents.compose.js';
import { pushLog } from '../log/logPush.js';
import { addHeroDeckCardToEnigmaCode } from './enigmaCode.logic.js';
import { invadeNextCountry } from './changeTheOutcomeOfWwii.logic.js';
import { offPlayCardTraits } from '../hero/splitCard.logic.js';
import {
  FIRST_MONSTER_PIT_TWIST,
  chooseGladiator,
  readPrintedVillainAttack,
} from './clashMonsterPit.logic.js';

// ---------------------------------------------------------------------------
// Internal — narrative name lookup
// ---------------------------------------------------------------------------

// why: WP-200 — pure helper used by every resolver's terminal emission to
// resolve a CardExtId to a display name (or fall back to the raw ext_id
// when no display entry exists — see the executor's defensive fallback in
// the WP §Non-Negotiable Constraints block). Centralised here so all five
// resolvers compose identically; replay-stable by construction.
function resolveCardName(
  gameState: LegendaryGameState,
  cardId: CardExtId,
): string {
  // why: WP-200 — defensive access; legacy test G states may leave
  // `cardDisplayData` undefined. Production setup always builds it.
  const display = gameState.cardDisplayData?.[cardId];
  if (display && typeof display.name === 'string' && display.name.length > 0) {
    return display.name;
  }
  return cardId;
}

/**
 * Reads the active player off a twist's reveal context (WP-846 / D-24780).
 *
 * @param context - The reveal context the twist dispatcher passed.
 * @returns The current player id, or null when the context carries none.
 */
function readTwistCurrentPlayer(context: RevealContext): string | null {
  // why: hand-built test contexts may omit `ctx`; a missing current player keeps the sorted
  // order in seatsInTurnOrderFrom (duplicate-first of mastermindHandlers' resolveCurrentPlayer).
  const currentPlayer = (context as { ctx?: { currentPlayer?: unknown } } | undefined)?.ctx?.currentPlayer;
  if (typeof currentPlayer !== 'string' || currentPlayer.length === 0) {
    return null;
  }
  return currentPlayer;
}

// why: WP-200 — sentinel ext_id used when a legacy test calls a resolver
// directly without passing the 5th `twistCardId` argument. The production
// dispatch path (`schemeHandlers.ts:schemeTwistHandler`) always passes the
// real cardId from the trigger payload, so this fallback only surfaces in
// the unit-test surface that pre-dates WP-200. Stable string ensures
// emissions still produce a well-typed `schemeTwistResolved` event without
// requiring every legacy test call site to be updated.
const UNKNOWN_TWIST_CARD_ID: CardExtId = 'unknown-twist-card' as CardExtId;

// -------------------------------------------------------------------------
// Constants (migrated from schemeHandlers.ts)
// -------------------------------------------------------------------------

// why: Midtown Bank Robbery twist text: "Any Villain in the Bank captures
// 2 Bystanders." The Bank is engine city index 1 per the engine→visual
// mapping in apps/arena-client/src/composables/useCityRow.ts (engine 0 =
// Sewers entry edge; engine 4 = Bridge escape edge).
const BANK_CITY_INDEX = 1;

// why: per printed card text, the Bank villain captures exactly 2
// bystanders per twist. Hardcoded because it comes from the physical card.
const MIDTOWN_BYSTANDERS_PER_TWIST = 2;

// -------------------------------------------------------------------------
// reveal-or-punish
// -------------------------------------------------------------------------

/**
 * "Each player reveals a [heroClass/team] hero or [suffers penalty]."
 *
 * Iterates players starting with the current player, then clockwise (rules v23
 * L2247, D-24780). For each player, checks if any
 * card in hand matches the condition. If matched, pushes a message.
 * If not matched, applies the penalty (gainWound or discardHand).
 *
 * @param gameState - Game state to mutate.
 * @param context - RevealContext; its current player starts the each-player loop (D-24780).
 * @param _implementationMap - Handler map (unused by this resolver).
 * @param params - Expected: condition { field, value }, penalty.
 */
function revealOrPunish(
  gameState: LegendaryGameState,
  context: RevealContext,
  _implementationMap: ImplementationMap,
  params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  const condition = params['condition'] as { field?: string; value?: string } | undefined;
  const penalty = params['penalty'] as string | undefined;

  // why: structure as branch-then-emit so the terminal event-emission call
  // fires once per call regardless of which branch ran. Invalid-params,
  // happy path, and partial-failure paths all converge on the single
  // emission site below — preserves D-20001's one-event-per-twist contract
  // AND keeps the EC grep gate at exactly 5 matches across the file.
  if (
    !condition ||
    typeof condition.field !== 'string' ||
    typeof condition.value !== 'string' ||
    typeof penalty !== 'string'
  ) {
    pushLog(gameState, 
      '[Scheme Twist] reveal-or-punish resolver received invalid params — expected condition { field, value } and penalty string.',
    );
  } else {
    // why: rules v23 L2247 — start with the current player, then clockwise (D-24780).
    const playerIds = seatsInTurnOrderFrom(Object.keys(gameState.playerZones), readTwistCurrentPlayer(context));

    for (const playerId of playerIds) {
      const playerHand = gameState.playerZones[playerId]!.hand;
      let matchFound = false;

      for (const cardId of playerHand) {
        // why: WP-772 / D-24604 — the reveal is from the HAND (off play), so a split card counts
        // as both halves' classes (rules v23 p.49), resolved through the split-face map.
        const traits = offPlayCardTraits(gameState, cardId);
        if (!traits) continue;

        // why: WP-703 / D-24523 — on a heroClass field a dual-class card matches on EITHER printed class.
        const matchesTrait = condition.field === 'heroClass'
          ? (traits.heroClass === condition.value || traits.heroClass2 === condition.value)
          : traits.team === condition.value;
        if (matchesTrait) {
          matchFound = true;
          // why: WP-643-follow-up — the player revealed a matching Hero and DODGED
          // the penalty; that is a good outcome for the player → `applied` (green).
          pushLog(gameState,
            `[Scheme Twist] Player ${playerId} reveals "${cardId}" — ${condition.field} "${condition.value}" condition met; penalty avoided.`,
            'applied',
          );
          // why: WP-644 / D-24456 — announce the dodged Scheme Twist penalty, ONE
          // per blocking player. ADDITIVE to the resolver's terminal
          // schemeTwistResolved (pushed once at the end) — the twist still fires
          // its own event; this records the per-player dodge on top.
          gameState.notableEvents.push({
            type: 'strikeBlocked',
            playerId,
            threatKind: 'schemeTwist',
            narrative: composeStrikeBlockedNarrative('schemeTwist'),
          });
          break;
        }
      }

      if (!matchFound) {
        if (penalty === 'gainWound') {
          if (gameState.piles.wounds.length === 0) {
            pushLog(gameState, 
              `[Scheme Twist] Player ${playerId} has no matching hero — wound supply empty, no wound gained.`,
            );
          } else {
            // why: WP-682 / D-24499 — gainWoundForPlayer chokepoint so a Scheme-Twist
            // Wound to a Diving-Block holder (a NON-active seat) gets the reveal window (WP-684).
            const woundOutcome = gainWoundWithOutcome(gameState, playerId);
            // why: D-24673 — while a Diving Block reveal is pending, say "would gain".
            const woundClause = woundOutcome === 'diving-block-pending'
              ? 'would gain a wound; Diving Block can prevent it'
              : 'gained a wound';
            // why: WP-643-follow-up — the player had no matching Hero and took the
            // Wound penalty; a bad outcome for the player → `blocked` (red).
            pushLog(gameState,
              `[Scheme Twist] Player ${playerId} has no matching ${condition.field} "${condition.value}" hero — ${woundClause}.`,
              'blocked',
            );
          }
        } else if (penalty === 'discardHand') {
          // why: WP-498 / D-24301 — route each hand card through the single
          // forced-discard chokepoint so a return-on-discard card discarded to
          // this scheme-twist penalty offers to return. Snapshot the hand first
          // (discardFromHand mutates it in place).
          for (const cardId of [...gameState.playerZones[playerId]!.hand]) {
            discardFromHand(gameState, playerId, cardId);
          }
          // why: WP-643-follow-up — the discard-hand penalty is a bad outcome for the
          // player, same colour class as the Wound penalty → `blocked` (red).
          pushLog(gameState,
            `[Scheme Twist] Player ${playerId} has no matching ${condition.field} "${condition.value}" hero — discarded entire hand.`,
            'blocked',
          );
        }
      }
    }
  }

  // why: WP-200 — terminal emission after all per-player mutations + message
  // pushes settle. One `schemeTwistResolved` per twist (D-20001 closed union);
  // resolverKey is the locked camelCase form of the resolverId. Pushed via
  // `.push(...)` (write-only invariant — never sort / splice / mutate prior
  // entries). One terminal `schemeTwistResolved` per resolver; WP-644 adds an
  // ADDITIVE `strikeBlocked` push in the revealOrPunish `matchFound` branch
  // above (one per dodging player) — a different event type, not a second
  // terminal.
  // why: WP-200 — fallback to UNKNOWN_TWIST_CARD_ID when called via the
  // legacy test path without the 5th argument. Production dispatch always
  // passes a real cardId; the fallback only surfaces in pre-WP-200 unit
  // tests that exercise resolvers directly.
  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'revealOrPunish',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'revealOrPunish',
    ),
  });
}

// -------------------------------------------------------------------------
// chained-reveals
// -------------------------------------------------------------------------

/**
 * "Play the top N cards of the Villain Deck."
 *
 * Calls performVillainReveal N times. Stops early if the villain deck
 * is exhausted.
 *
 * @param gameState - Game state to mutate.
 * @param context - RevealContext threaded into performVillainReveal.
 * @param implementationMap - Handler map threaded into performVillainReveal.
 * @param params - Expected: revealCount (integer >= 1).
 */
function chainedReveals(
  gameState: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  const revealCount = params['revealCount'] as number | undefined;

  // why: branch-then-emit; the terminal emission below fires once whether
  // we run the chained reveals or short-circuit on invalid params.
  if (typeof revealCount !== 'number' || revealCount < 1) {
    pushLog(gameState, 
      '[Scheme Twist] chained-reveals resolver received invalid params — expected revealCount as a positive integer.',
    );
  } else {
    pushLog(gameState, 
      `[Scheme Twist] Twist: revealing ${revealCount} card(s) from the villain deck.`,
    );

    for (let revealIndex = 0; revealIndex < revealCount; revealIndex++) {
      if (
        gameState.villainDeck.deck.length === 0 &&
        gameState.villainDeck.discard.length === 0
      ) {
        pushLog(gameState, 
          `[Scheme Twist] Villain deck exhausted after ${revealIndex} of ${revealCount} reveals.`,
        );
        break;
      }
      performVillainReveal(gameState, context, implementationMap);
    }
  }

  // why: WP-200 — terminal emission AFTER the chained reveals settle. A
  // chained reveal that triggers another scheme-twist card recurses into
  // schemeTwistHandler with that card's own payload; this top-level
  // emission represents the originating twist, the recursive one pushes
  // its own event. Push order matches resolution order (outer-first).
  // Single push site per resolver — EC grep gate is exactly 5 across the file.
  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'chainedReveals',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'chainedReveals',
    ),
  });
}

// -------------------------------------------------------------------------
// wound-all
// -------------------------------------------------------------------------

/**
 * "Each player gains N Wound(s)."
 *
 * Iterates players starting with the current player, then clockwise (rules v23
 * L2247, D-24780). Each player gains woundCount
 * wounds via gainWound. Stops early per-player if wound supply runs out.
 *
 * @param gameState - Game state to mutate.
 * @param context - RevealContext; its current player starts the each-player loop (D-24780).
 * @param _implementationMap - Handler map (unused by this resolver).
 * @param params - Expected: woundCount (integer >= 1) OR escalation ({ atOrAfterTwist, woundCount }[]).
 */
function woundAll(
  gameState: LegendaryGameState,
  context: RevealContext,
  _implementationMap: ImplementationMap,
  params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  const woundCount = params['woundCount'] as number | undefined;
  // why: WP-540 / D-24349 — Unleash the Cosmic Cube deals its wounds on the
  // printed escalation (nothing on twists 1-4, 1 each on 5-6, 3 on 7), so when
  // `escalation` is present it drives the wound count off the current twist
  // number. Other wound-all schemes keep the flat woundCount path.
  const escalation = params['escalation'] as
    | Array<{ atOrAfterTwist: number; throughTwist?: number; woundCount: number }>
    | undefined;

  // why: branch-then-emit; single terminal push — one schemeTwistResolved
  // emission per resolver. The flat-woundCount path still requires a positive
  // integer; the escalation path supplies its own count (0 is a logged no-op).
  if (escalation === undefined && (typeof woundCount !== 'number' || woundCount < 1)) {
    pushLog(gameState,
      '[Scheme Twist] wound-all resolver received invalid params — expected woundCount as a positive integer (or an escalation schedule).',
    );
  } else {
    let effectiveWoundCount: number;
    if (escalation !== undefined) {
      // why: D-24775 — the dispatcher (schemeHandlers.ts) raises schemeTwistCount
      // BEFORE it calls the resolver, so the count is THIS twist's number, also
      // for a Twist revealed while another Twist is still resolving.
      const currentTwist = gameState.counters.schemeTwistCount ?? 0;

      // why: a twist can match more than one escalation step (twist 7 matches
      // both the 5→1 and 7→3 steps), so take the MAX matching step's woundCount
      // — the highest escalation reached — not the first or last. No .reduce().
      // D-24685 — an optional `throughTwist` closes a step, so Cosmic Cube's
      // twist 8 ("Evil Wins!") matches no step and deals nothing.
      let escalatedWoundCount = 0;
      let isBelowFirstStep = true;
      for (const step of escalation) {
        if (step.atOrAfterTwist <= currentTwist) {
          isBelowFirstStep = false;
        }
        const isStepOpen = step.throughTwist === undefined || currentTwist <= step.throughTwist;
        if (step.atOrAfterTwist <= currentTwist && isStepOpen && step.woundCount > escalatedWoundCount) {
          escalatedWoundCount = step.woundCount;
        }
      }
      effectiveWoundCount = escalatedWoundCount;

      if (effectiveWoundCount === 0 && isBelowFirstStep) {
        pushLog(gameState,
          `[Scheme Twist] No wounds this twist — twist ${currentTwist} is below the escalation threshold.`,
        );
      } else if (effectiveWoundCount === 0) {
        pushLog(gameState, `[Scheme Twist] No wounds this twist — twist ${currentTwist} deals no Wounds.`);
      }
    } else {
      effectiveWoundCount = woundCount as number;
    }

    // why: rules v23 L2247 — start with the current player, then clockwise (D-24780).
    const playerIds = seatsInTurnOrderFrom(Object.keys(gameState.playerZones), readTwistCurrentPlayer(context));

    for (const playerId of playerIds) {
      const divingBlockPendingBefore = countPendingDivingBlockWounds(gameState, playerId);
      let woundsGained = 0;
      for (let woundIndex = 0; woundIndex < effectiveWoundCount; woundIndex++) {
        if (gameState.piles.wounds.length === 0) {
          pushLog(gameState,
            `[Scheme Twist] Wound supply exhausted — player ${playerId} gained ${woundsGained} of ${effectiveWoundCount} wounds.`,
          );
          break;
        }
        // why: WP-682 / D-24499 — gainWoundForPlayer chokepoint so this multi-wound
        // "each player" Scheme Twist reaches Diving-Block holders on NON-active seats (WP-684).
        gainWoundForPlayer(gameState, playerId);
        woundsGained = woundsGained + 1;
      }

      // why: D-24673 — the Wounds land first and Diving Block's reveal prompts resolve
      // afterwards (land-then-offer-undo), so "gained N" read as final even when Diving
      // Block then returned some (match EMXM2s3Ucsh: "gained 1" for a prevented Wound).
      // While reveals are pending, say "would gain" — each reveal/decline line that
      // follows states the outcome.
      const divingBlockParked =
        countPendingDivingBlockWounds(gameState, playerId) - divingBlockPendingBefore;
      if (woundsGained > 0 && woundsGained === effectiveWoundCount) {
        if (divingBlockParked > 0) {
          pushLog(gameState,
            `[Scheme Twist] Player ${playerId} would gain ${woundsGained} wound(s) — Diving Block can prevent ${divingBlockParked === 1 ? 'it' : 'each one'}.`,
          );
        } else {
          pushLog(gameState,
            `[Scheme Twist] Player ${playerId} gained ${woundsGained} wound(s).`,
          );
        }
      }
    }
  }

  // why: WP-200 — terminal emission after every player's wound loop settles.
  // Single push site per resolver — EC grep gate is exactly 5 across the file.
  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'woundAll',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'woundAll',
    ),
  });
}

// -------------------------------------------------------------------------
// ko-from-hq
// -------------------------------------------------------------------------

/**
 * "KO N hero(es) from the HQ."
 *
 * Scans HQ for eligible heroes, sorts by cost ascending then slot index
 * for deterministic tie-breaking, KOs up to koCount, and refills each
 * vacated slot.
 *
 * @param gameState - Game state to mutate.
 * @param _context - RevealContext (unused by this resolver).
 * @param _implementationMap - Handler map (unused by this resolver).
 * @param params - Expected: koCount (integer >= 1) OR koAll (boolean); optional costThreshold.
 */
function koFromHq(
  gameState: LegendaryGameState,
  _context: RevealContext,
  _implementationMap: ImplementationMap,
  params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  const koCount = params['koCount'] as number | undefined;
  const costThreshold = params['costThreshold'] as number | undefined;
  // why: WP-540 / D-24349 — Super Hero Civil War's printed Twist is "KO all the
  // Heroes in the HQ", so koAll KOs every eligible HQ slot (then refills each),
  // distinct from the fixed koCount path other ko-from-hq schemes use. koCount is
  // not required when koAll is true.
  const koAll = params['koAll'] as boolean | undefined;

  // why: branch-then-emit; single terminal push at the end so the EC grep
  // counts exactly one event-emission call in this resolver.
  if (koAll !== true && (typeof koCount !== 'number' || koCount < 1)) {
    pushLog(gameState,
      '[Scheme Twist] ko-from-hq resolver received invalid params — expected koCount as a positive integer (or koAll: true).',
    );
  } else {
    const eligible: Array<{ cardId: string; slotIndex: number; cost: number }> = [];

    for (let slotIndex = 0; slotIndex < gameState.hq.length; slotIndex++) {
      const cardId = gameState.hq[slotIndex];
      if (cardId === null || cardId === undefined) continue;

      const stats = gameState.cardStats[cardId];
      const cardCost = stats ? stats.cost : 0;

      if (costThreshold !== undefined && typeof costThreshold === 'number') {
        if (cardCost > costThreshold) continue;
      }

      eligible.push({ cardId, slotIndex, cost: cardCost });
    }

    // why: sort cheapest-first (cost ascending) with ties broken by HQ slot
    // index left-to-right (lower index first) for deterministic selection
    eligible.sort((entryA, entryB) => {
      if (entryA.cost !== entryB.cost) return entryA.cost - entryB.cost;
      return entryA.slotIndex - entryB.slotIndex;
    });

    if (eligible.length === 0) {
      pushLog(gameState, 
        '[Scheme Twist] No eligible heroes in the HQ to KO.',
      );
    } else {
      // why: WP-540 — koAll KOs every eligible HQ Hero (the printed "KO all the
      // Heroes in the HQ"); the koCount path clamps to the requested count.
      let actualKoCount: number;
      if (koAll === true) {
        actualKoCount = eligible.length;
        pushLog(gameState,
          `[Scheme Twist] KO'ing all ${eligible.length} eligible hero(es) from the HQ.`,
        );
      } else {
        const requestedKoCount = koCount as number;
        actualKoCount = Math.min(requestedKoCount, eligible.length);
        if (eligible.length < requestedKoCount) {
          pushLog(gameState,
            `[Scheme Twist] Only ${eligible.length} eligible hero(es) in HQ — KO'ing all of them instead of ${requestedKoCount}.`,
          );
        }
      }

      for (let koIndex = 0; koIndex < actualKoCount; koIndex++) {
        const target = eligible[koIndex]!;

        gameState.ko = koCard(gameState.ko, target.cardId);
        gameState.hq[target.slotIndex] = null;

        pushLog(gameState, 
          `[Scheme Twist] KO'd "${target.cardId}" (cost ${target.cost}) from HQ slot ${target.slotIndex}.`,
        );

        const refillResult = refillHqSlot(
          gameState.hq,
          target.slotIndex,
          gameState.heroDeck,
        );
        gameState.hq = refillResult.hq;
        gameState.heroDeck = refillResult.heroDeck;
      }
    }
  }

  // why: WP-200 — terminal emission after all KOs + refills settle.
  // Single push site per resolver — EC grep gate is exactly 5 across the file.
  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'koFromHq',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'koFromHq',
    ),
  });
}

// -------------------------------------------------------------------------
// midtown-bank-robbery (migrated from schemeHandlers.ts)
// -------------------------------------------------------------------------

/**
 * Resolves the Midtown Bank Robbery twist card text by direct G mutation.
 *
 * Twist text: "Any Villain in the Bank captures 2 Bystanders. Then play
 * the top card of the Villain Deck."
 *
 * 1. If a villain occupies the Bank (city index 1), attach up to 2
 *    bystanders to it from the supply (fewer if the supply runs out).
 * 2. Chain another villain-deck reveal via performVillainReveal.
 *
 * @param gameState - Game state to mutate.
 * @param context - RevealContext threaded into the chained reveal.
 * @param implementationMap - Handler map threaded into the chained reveal.
 * @param _params - Unused — Midtown Bank Robbery has no configurable params.
 */
function midtownBankRobbery(
  gameState: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  _params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  const bankOccupant = gameState.city[BANK_CITY_INDEX];

  if (bankOccupant === null || bankOccupant === undefined) {
    pushLog(gameState, 
      '[Midtown Bank Robbery] Twist: Bank is empty — no bystander capture.',
    );
  } else {
    let captured = 0;
    while (
      captured < MIDTOWN_BYSTANDERS_PER_TWIST &&
      gameState.piles.bystanders.length > 0
    ) {
      const attachResult = attachBystanderToVillain(
        gameState.piles.bystanders,
        bankOccupant,
        gameState.attachedBystanders,
      );
      gameState.piles.bystanders = attachResult.bystandersPile;
      gameState.attachedBystanders = attachResult.attachedBystanders;
      captured = captured + 1;
    }

    // why: D-24646 — the log is player-facing, so name the villain (e.g. "Sabretooth")
    // instead of printing its ext_id.
    const bankOccupantName = resolveCardName(gameState, bankOccupant);
    if (captured === 0) {
      pushLog(gameState,
        `[Midtown Bank Robbery] Twist: villain "${bankOccupantName}" in Bank found no bystanders to capture (supply empty).`,
      );
    } else {
      pushLog(gameState, 
        `[Midtown Bank Robbery] Twist: villain "${bankOccupantName}" in Bank captured ${captured} bystander(s).`,
      );
    }
  }

  pushLog(gameState, 
    '[Midtown Bank Robbery] Twist: playing the next villain-deck card.',
  );
  performVillainReveal(gameState, context, implementationMap);

  // why: WP-200 — terminal emission after the chained villain reveal settles.
  // The chained reveal may itself emit a fightResolved / ambushResolved /
  // schemeTwistResolved depending on the next card's type; this twist's
  // event is pushed AFTER those, so the array's order reflects the
  // resolution sequence (outer-twist concludes last).
  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'midtownBankRobbery',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'midtownBankRobbery',
    ),
  });
}

// -------------------------------------------------------------------------
// killbots
// -------------------------------------------------------------------------

/**
 * "Put the Twist next to this Scheme." (Replace Earth's Leaders with Killbots)
 *
 * Increments the per-scheme "twists next to this Scheme" counter
 * (`KILLBOT_TWISTS_NEXT_TO_SCHEME`, seeded 3 at setup). Every converted Killbot
 * Villain's attack equals this counter (`resolveFightCost`, D-24325), so each
 * Killbots twist raises all Killbot attack by 1. No card is moved — the counter
 * IS the "twists next to the Scheme" pile. Emits one `schemeTwistResolved` event
 * (one push per resolver — six across this file after WP-513).
 *
 * @param gameState - Game state to mutate (counter + log + notable event).
 * @param _context - Unused (no villain-deck reveal).
 * @param _implementationMap - Unused.
 * @param _params - Unused (no resolver params).
 * @param twistCardId - The scheme-twist card instance that triggered.
 */
function killbots(
  gameState: LegendaryGameState,
  _context: RevealContext,
  _implementationMap: ImplementationMap,
  _params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  const nextCount = (gameState.counters[KILLBOT_TWISTS_NEXT_TO_SCHEME] ?? 0) + 1;
  gameState.counters[KILLBOT_TWISTS_NEXT_TO_SCHEME] = nextCount;
  pushLog(
    gameState,
    `[Scheme Twist] A Twist is placed next to the Scheme — Killbots now attack for ${nextCount}.`,
  );

  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'killbots',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'killbots',
    ),
  });
}

// -------------------------------------------------------------------------
// secret-invasion
// -------------------------------------------------------------------------

/**
 * "The highest-cost Hero from the HQ moves into the Sewers as a Skrull Villain."
 * (Secret Invasion of the Skrull Shapeshifters, WP-514 / D-24327)
 *
 * Selects the highest-cost Hero in the HQ (ties broken by lowest slot index — the
 * flip of koFromHq's cost-ascending comparator), converts it to a Skrull Villain
 * (typed `'villain'` in villainDeckCardTypes + origin `'skrull'` in
 * convertedVillainOrigins, so it routes/fights/escapes via the existing villain
 * path and attacks for its cost + 2 — resolveFightCost), pushes it into the Sewers
 * (city space 0 via pushVillainIntoCity), refills the vacated HQ slot, and emits one
 * `schemeTwistResolved` event. If the city was full, the displaced card escapes and
 * runs the full escape through `resolveVillainEscape` (WP-793 / D-24656): counter +
 * Escaped Villains pile, carried bystanders, the owed rulebook HQ KO + Bystander
 * discard, its card-text Escape effect, captured heroes to the Escape Pile, and the
 * escaped-converted-count loss check — rules v23 L2826–L2829, an escape caused by a
 * card effect "causes all the same effects".
 *
 * @param gameState - Game state to mutate (HQ + city + overlay + log + notable event).
 * @param context - Reveal context threaded into the escape (random + currentPlayer).
 * @param implementationMap - Handler map threaded into the escape (Mystique's twist).
 * @param _params - Unused (no resolver params).
 * @param twistCardId - The scheme-twist card instance that triggered.
 */
function secretInvasion(
  gameState: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  _params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  // why: scan the HQ and pick the highest-cost Hero, ties broken by lowest slot
  // index — the flip of koFromHq's cost-ascending comparator (RS-3).
  const eligible: Array<{ cardId: string; slotIndex: number; cost: number }> = [];
  for (let slotIndex = 0; slotIndex < gameState.hq.length; slotIndex++) {
    const cardId = gameState.hq[slotIndex];
    if (cardId === null || cardId === undefined) continue;
    const stats = gameState.cardStats[cardId];
    const cardCost = stats ? stats.cost : 0;
    eligible.push({ cardId, slotIndex, cost: cardCost });
  }
  eligible.sort((entryA, entryB) => {
    if (entryA.cost !== entryB.cost) return entryB.cost - entryA.cost;
    return entryA.slotIndex - entryB.slotIndex;
  });

  if (eligible.length === 0) {
    pushLog(gameState, '[Scheme Twist] No Hero in the HQ to convert into a Skrull.');
  } else {
    const target = eligible[0]!;

    // why: convert the Hero to a Skrull Villain — typed 'villain' for native
    // routing/fight/escape, origin 'skrull' for identity (attack = cost + 2, the
    // escaped-converted-count loss). The overlay object already exists for this
    // scheme (materialized at setup), but guard defensively.
    gameState.villainDeckCardTypes[target.cardId] = 'villain';
    if (!gameState.convertedVillainOrigins) {
      gameState.convertedVillainOrigins = {};
    }
    gameState.convertedVillainOrigins[target.cardId] = 'skrull';

    // why: remove the Hero from its HQ slot before it enters the city, then refill
    // the vacated slot from the hero deck (mirrors koFromHq's remove-then-refill).
    gameState.hq[target.slotIndex] = null;

    // why: the Skrull enters the Sewers (city space 0) via pushVillainIntoCity,
    // cascading the entry-side block toward the escape edge.
    const pushResult = pushVillainIntoCity(gameState.city, target.cardId);
    gameState.city = pushResult.city;
    pushLog(gameState,
      `[Scheme Twist] The highest-cost HQ Hero "${resolveCardName(gameState, target.cardId)}" moved into the Sewers as a Skrull Villain (cost ${target.cost}).`,
    );

    // why: WP-793 / D-24656 — refill the vacated HQ slot from the hero deck front (FIFO;
    // empty deck leaves the slot null per D-13503) BEFORE the City push's escape resolves,
    // so the HQ is full when the escape's owed HQ KO is offered ("immediately flip a new
    // Hero") and a nested twist from Mystique's Escape never sees a null slot.
    const refillResult = refillHqSlot(gameState.hq, target.slotIndex, gameState.heroDeck);
    gameState.hq = refillResult.hq;
    gameState.heroDeck = refillResult.heroDeck;

    if (pushResult.escapedCard !== null) {
      // why: WP-793 / D-24656 — a full city displaces the card at the escape edge, and an
      // escape caused by a card effect "causes all the same effects" (rules v23
      // L2826–L2829). Run the full escape every other path runs, not a reduced copy.
      resolveVillainEscape(gameState, context, implementationMap, pushResult.escapedCard);
    }
  }

  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'secretInvasion',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'secretInvasion',
    ),
  });
}

// -------------------------------------------------------------------------
// Resolver Registry
// -------------------------------------------------------------------------

/**
 * Maps each SchemeTwistResolverId to its resolver function.
 *
 * Plain record — no factory, no class, no dynamic registration.
 */
/**
 * Portals to the Dark Dimension (WP-539 / D-24348). Each twist places a Dark
 * Portal and raises attack: twist 1 above the Mastermind (+1 attack); twists 2-6
 * in the leftmost portal-less city space (Villains there +1 attack); twist 7 is
 * Evil Wins (handled by the config lossThreshold, not this resolver). The
 * DARK_PORTAL_COUNT counter drives BOTH buffs — read at combat time by
 * resolveFightCost (villains) and resolveMastermindFightCost (mastermind); this
 * resolver only bumps the counter and logs the placement.
 *
 * @param gameState - The game state to mutate.
 */
function portals(
  gameState: LegendaryGameState,
  _context: RevealContext,
  _implementationMap: ImplementationMap,
  _params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  const portalNumber = (gameState.counters[DARK_PORTAL_COUNT] ?? 0) + 1;
  gameState.counters[DARK_PORTAL_COUNT] = portalNumber;

  // why: twist 1 places the Dark Portal above the Mastermind; twists 2-6 fill the
  // leftmost portal-less city space (leftmost = Bridge = index 4 first, per
  // DESIGN-BOARD-LAYOUT.md §City row + WP-489/D-24295), so the space filled at
  // portal N is index 6 - N (N=2 → Bridge/4 … N=6 → Sewers/0); twist 7 is the loss.
  if (portalNumber === 1) {
    pushLog(
      gameState,
      `[Portals to the Dark Dimension] A Dark Portal opens above the Mastermind — the Mastermind gets +1 attack.`,
    );
  } else if (portalNumber >= 2 && portalNumber <= 6) {
    const citySpaceIndex = 6 - portalNumber;
    // why: CITY_SPACE_NAMES are lowercase slugs; capitalize the first letter for the
    // player-facing log ("in the Bridge").
    const rawSpaceName = CITY_SPACE_NAMES[citySpaceIndex] ?? 'city space';
    const spaceName = rawSpaceName.charAt(0).toUpperCase() + rawSpaceName.slice(1);
    pushLog(
      gameState,
      `[Portals to the Dark Dimension] A Dark Portal opens in the ${spaceName} — Villains there get +1 attack.`,
    );
  } else {
    pushLog(
      gameState,
      `[Portals to the Dark Dimension] The seventh Dark Portal tears open — the Dark Dimension breaks through.`,
    );
  }

  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'portals',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'portals',
    ),
  });
}

// -------------------------------------------------------------------------
// clash-monster-pit
// -------------------------------------------------------------------------

/**
 * Clash of the Monsters Unleashed (D-24736). "Twist 3-10: Each player chooses a
 * Villain from their Victory Pile as their 'Gladiator.' Then the top card of the
 * Monster Pit enters the city. Each player whose Gladiator has a lower printed
 * Attack than that Monster gains a Wound."
 *
 * Twists 1-2 do nothing. From twist 3, every player's Gladiator is chosen first
 * (chooseGladiator: the highest printed Attack), then the Pit's top Monster
 * enters the city, then each player whose Gladiator is weaker gains a Wound. A
 * player with no Villain in their Victory Pile has no Gladiator to match the
 * Monster, so they gain a Wound too (operator ruling, D-24736).
 *
 * @param gameState - Game state to mutate (Pit + city + wounds + log + event).
 * @param context - Reveal context threaded into the Monster's city entry.
 * @param implementationMap - Handler map threaded into the Monster's city entry.
 * @param _params - Unused (no resolver params).
 * @param twistCardId - The scheme-twist card instance that triggered.
 */
function clashMonsterPit(
  gameState: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  _params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  // why: D-24775 — the dispatcher raises schemeTwistCount before the resolver runs,
  // so the count is THIS twist's number (the woundAll escalation read). A Twist set off
  // inside this one (a Monster pushing a Mystique out) reads its own, later number.
  const currentTwist = gameState.counters.schemeTwistCount ?? 0;
  const monsterPit = gameState.monsterPit ?? [];

  if (currentTwist < FIRST_MONSTER_PIT_TWIST) {
    pushLog(
      gameState,
      `[Monster Pit] Twist ${currentTwist}: the Monster Pit stays shut (Monsters climb out on Twists 3-10).`,
    );
  } else if (monsterPit.length === 0) {
    pushLog(gameState, `[Monster Pit] Twist ${currentTwist}: the Monster Pit is empty.`);
  } else {
    releaseMonsterAgainstGladiators(gameState, context, implementationMap, currentTwist);
  }

  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'clashMonsterPit',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'clashMonsterPit',
    ),
  });
}

/**
 * Chooses every player's Gladiator, sends the Pit's top Monster into the city,
 * then wounds each player whose Gladiator has a lower printed Attack.
 *
 * @param gameState - Game state to mutate.
 * @param context - Reveal context for the Monster's city entry.
 * @param implementationMap - Handler map for the Monster's city entry.
 * @param currentTwist - This twist's number (3-10), for the log.
 */
function releaseMonsterAgainstGladiators(
  gameState: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  currentTwist: number,
): void {
  // why: the card orders it — Gladiators are chosen BEFORE the Monster is revealed.
  // why: rules v23 L2247 — the Wound loop below starts with the current player, then
  // clockwise (D-24780); the Gladiator pass shares the order (each pick reads only its
  // own Victory Pile, so it is order-free).
  const playerIds = seatsInTurnOrderFrom(Object.keys(gameState.playerZones), readTwistCurrentPlayer(context));
  const gladiators = new Map<string, { cardId: CardExtId; printedAttack: number } | null>();
  for (const playerId of playerIds) {
    gladiators.set(playerId, chooseGladiator(gameState, playerId));
  }

  const monsterId = (gameState.monsterPit ?? [])[0]!;
  gameState.monsterPit = (gameState.monsterPit ?? []).slice(1);
  const monsterAttack = readPrintedVillainAttack(gameState, monsterId);
  pushLog(
    gameState,
    `[Monster Pit] Twist ${currentTwist}: ${resolveCardName(gameState, monsterId)} (printed ${monsterAttack} Attack) climbs out of the Monster Pit. ${gameState.monsterPit.length} Monster(s) remain.`,
    'threat',
  );

  // why: "enters the city" is a full Villain entry — Ambush fires, a full city
  // pushes a Villain out to escape, and the rule hooks see a revealed Villain. The
  // Monster is placed on top of the Villain Deck and played through the one reveal
  // pipeline rather than a second copy of it. It leaves the deck at once, so the
  // deck's size, and its run-out latch, are unchanged.
  gameState.villainDeck.deck = [monsterId, ...gameState.villainDeck.deck];
  performVillainReveal(gameState, context, implementationMap);

  for (const playerId of playerIds) {
    woundPlayerIfGladiatorIsWeaker(gameState, playerId, gladiators.get(playerId) ?? null, monsterAttack);
  }
}

/**
 * Wounds one player when their Gladiator's printed Attack is below the Monster's.
 *
 * @param gameState - Game state to mutate.
 * @param playerId - The player compared.
 * @param gladiator - The player's Gladiator, or null when they have none.
 * @param monsterAttack - The Monster's printed Attack.
 */
function woundPlayerIfGladiatorIsWeaker(
  gameState: LegendaryGameState,
  playerId: string,
  gladiator: { cardId: CardExtId; printedAttack: number } | null,
  monsterAttack: number,
): void {
  if (gladiator !== null && gladiator.printedAttack >= monsterAttack) {
    pushLog(
      gameState,
      `[Monster Pit] Player ${playerId}'s Gladiator ${resolveCardName(gameState, gladiator.cardId)} (${gladiator.printedAttack}) holds against the Monster.`,
    );
    return;
  }
  const reason = gladiator === null
    ? 'has no Villain in their Victory Pile to be a Gladiator'
    : `has Gladiator ${resolveCardName(gameState, gladiator.cardId)} (${gladiator.printedAttack}), weaker than the Monster`;
  if (gameState.piles.wounds.length === 0) {
    pushLog(gameState, `[Monster Pit] Player ${playerId} ${reason}, but the Wound Stack is empty.`);
    return;
  }
  const divingBlockPendingBefore = countPendingDivingBlockWounds(gameState, playerId);
  // why: WP-682 / D-24499 — the gainWoundForPlayer chokepoint, so a non-active
  // seat's Diving Block can still prevent the Wound.
  gainWoundForPlayer(gameState, playerId);
  // why: D-24673 — while a Diving Block reveal is pending, say "would gain".
  const isParkedByDivingBlock = countPendingDivingBlockWounds(gameState, playerId) > divingBlockPendingBefore;
  const outcome = isParkedByDivingBlock ? 'would gain a Wound — Diving Block can prevent it' : 'gains a Wound';
  pushLog(gameState, `[Monster Pit] Player ${playerId} ${reason}, and ${outcome}.`);
}

// -------------------------------------------------------------------------
// brainwash-the-military
// -------------------------------------------------------------------------

/**
 * Brainwash the Military (WP-823 / D-24756). "Twist 1-6: Stack this Twist next to
 * the Scheme as a 'Traitor Battalion.' Play another card from the Villain Deck.
 * Twist 7: All S.H.I.E.L.D. Officers in the city escape."
 *
 * Twists 1-6 raise the Traitor Battalion counter (`TRAITOR_BATTALION_TWISTS`), which
 * gives every Officer +1 Attack (`resolveFightCost`), then play the top card of the
 * Villain Deck through the normal reveal. Once six are stacked, the Twist is Twist 7:
 * every Officer in the City escapes. Emits one `schemeTwistResolved` event.
 *
 * @param gameState - Game state to mutate (counter + City + escapes + log + event).
 * @param context - Reveal context threaded into the extra play and the escapes.
 * @param implementationMap - Handler map threaded into the extra play and the escapes.
 * @param _params - Unused (no resolver params).
 * @param twistCardId - The scheme-twist card instance that triggered.
 */
function brainwashTheMilitary(
  gameState: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  _params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  // why: the Twist is numbered from the stack, NOT from schemeTwistCount: the stack
  // counts only the Twists stacked next to the Scheme, and it is raised BEFORE the
  // extra card is played, so a nested Twist reads the right stack position. (Since
  // D-24775 schemeTwistCount is also raised before the resolver, but it counts every
  // Twist, including ones that changed nothing.) A Twist after six are stacked (a
  // Mystique Escape) runs Twist 7 too; the card defines no Twist 8.
  const stackedCount = gameState.counters[TRAITOR_BATTALION_TWISTS] ?? 0;
  if (stackedCount < TRAITOR_BATTALION_STACK_LIMIT) {
    const nextCount = stackedCount + 1;
    gameState.counters[TRAITOR_BATTALION_TWISTS] = nextCount;
    pushLog(
      gameState,
      `[Brainwash the Military] Twist ${nextCount} joins the Traitor Battalion next to the Scheme — S.H.I.E.L.D. Officers now have ${BRAINWASHED_OFFICER_BASE_ATTACK + nextCount} Attack. Another card is played from the Villain Deck.`,
      'threat',
    );
    playTopVillainDeckCards(gameState, context, implementationMap, 1);
  } else {
    escapeEveryCityOfficer(gameState, context, implementationMap);
  }

  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'brainwashTheMilitary',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'brainwashTheMilitary',
    ),
  });
}

/**
 * Twist 7 of Brainwash the Military: every S.H.I.E.L.D. Officer in the City escapes.
 *
 * @param gameState - Game state to mutate (City + escapes + log).
 * @param context - Reveal context threaded into each escape.
 * @param implementationMap - Handler map threaded into each escape.
 */
function escapeEveryCityOfficer(
  gameState: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
): void {
  const officerIndices = listCityBrainwashedOfficers(gameState);
  if (officerIndices.length === 0) {
    pushLog(gameState, '[Brainwash the Military] Twist 7: no S.H.I.E.L.D. Officer is in the City, so none escapes.');
    return;
  }
  pushLog(
    gameState,
    `[Brainwash the Military] Twist 7: all ${officerIndices.length} S.H.I.E.L.D. Officer(s) in the City escape.`,
    'threat',
  );
  // why: Bridge first (listCityBrainwashedOfficers), the order Villains leave the
  // City in. Each is a full escape (D-24656: an escape caused by a card effect
  // "causes all the same effects"), so each owes its own HQ KO, its carried
  // Bystanders' discard, and the loss check, whose latch is idempotent. The space is
  // re-read before each escape, since an earlier escape's effects may have moved it.
  for (const cityIndex of officerIndices) {
    const cardId = gameState.city[cityIndex];
    if (cardId === null || cardId === undefined) {
      continue;
    }
    if (gameState.convertedVillainOrigins?.[cardId] !== 'shield-officer') {
      continue;
    }
    // why: resolveVillainEscape does not touch G.city (its callers clear the space
    // first), as in operatorEscapeVillain.
    const city = [...gameState.city] as typeof gameState.city;
    city[cityIndex] = null;
    gameState.city = city;
    resolveVillainEscape(gameState, context, implementationMap, cardId);
  }
}

/**
 * Counter-only resolver (WP-763 / D-24595). Deliberately does nothing.
 *
 * why: lets a scheme be configured for its Evil-Wins condition (a printed twist
 * count, or a pile running out) without inventing a twist effect the engine does
 * not model yet. The dispatcher's generic twist-count increment and loss check
 * still run after it, so the "twist count incremented" log line the PAR anchors
 * count is unaffected. A pure no-op: no log, no notable event, no G write — so it
 * needs no SchemeTwistResolverKey.
 */
function counterOnly(): void {
  return;
}

/**
 * Go Back in Time to Slay Heroes' Ancestors (WP-829 / D-24762): "Twist: Put a Hero from the HQ
 * next to the Scheme, 'Purged from the Timestream.'" Queues one owed Purge for the active
 * player; the play-phase onMove opener resolves it after the move (see timestreamPurge.logic.ts).
 *
 * @param gameState - The game state, mutated in place (queue appended).
 * @param context - The reveal context (the active player picks the Hero).
 * @param _implementationMap - Unused.
 * @param _params - Unused.
 * @param twistCardId - The Twist card that triggered.
 */
function goBackInTime(
  gameState: LegendaryGameState,
  context: RevealContext,
  _implementationMap: ImplementationMap,
  _params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  // why: WP-829 / D-24762 — the Twist resolves inside a Villain Deck reveal, where no seat
  // choice can be answered, so it owes the Purge and the onMove opener makes it after the move.
  queueTimestreamPurge(gameState, context.ctx.currentPlayer, resolvedTwistCardId);
  pushLog(gameState,
    `[Go Back in Time] Player ${context.ctx.currentPlayer} must Purge a Hero in the HQ from the Timestream.`,
    'threat',
    resolvedTwistCardId,
  );
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'goBackInTime',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'goBackInTime',
    ),
  });
}

/**
 * The Unbreakable Enigma Code (WP-830 / D-24763): "Twists 1-5: Put a card from the Hero Deck face
 * down next to the scheme as part of the 'Enigma Code.' Mix up those cards face-down." Twist 6 is
 * the scheme's loss (its lossThreshold), so this resolver adds nothing then.
 *
 * @param gameState - The game state, mutated in place (Hero Deck, code, log, notable event).
 * @param context - The reveal context (its random mixes the code).
 * @param _implementationMap - Unused.
 * @param _params - Unused.
 * @param twistCardId - The Twist card that triggered.
 */
function unbreakableEnigmaCode(
  gameState: LegendaryGameState,
  context: RevealContext,
  _implementationMap: ImplementationMap,
  _params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  // why: WP-830 / D-24763 — the mix uses the reveal context's deterministic random (ctx.random).
  addHeroDeckCardToEnigmaCode(gameState, context.random);
  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'enigmaCode',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'enigmaCode',
    ),
  });
}

/**
 * Change the Outcome of WWII (WP-832 / D-24765): "Twist: The Axis invades a new country. Put all
 * Villains and Bystanders from the city on the bottom of the Villain Deck. The number of city
 * spaces changes. Play 2 cards from the Villain Deck. If any Villains escape this country, stack a
 * Twist next to the scheme as a 'conquered capital.'"
 *
 * @param gameState - The game state, mutated in place.
 * @param context - The reveal context (the 2 plays use it).
 * @param implementationMap - The rule handler map (the 2 plays use it).
 * @param _params - Unused.
 * @param twistCardId - The Twist card that triggered.
 */
function changeTheOutcomeOfWwii(
  gameState: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  _params: Record<string, unknown>,
  twistCardId?: CardExtId,
): void {
  // why: WP-832 / D-24765 — the invasion (return, resize, play 2, settle) lives in its module.
  invadeNextCountry(gameState, context, implementationMap);
  const resolvedTwistCardId = twistCardId ?? UNKNOWN_TWIST_CARD_ID;
  gameState.notableEvents.push({
    type: 'schemeTwistResolved',
    twistCardId: resolvedTwistCardId,
    resolverKey: 'changeTheOutcomeOfWwii',
    narrative: composeSchemeTwistNarrative(
      resolveCardName(gameState, resolvedTwistCardId),
      'changeTheOutcomeOfWwii',
    ),
  });
}

export const SCHEME_TWIST_RESOLVERS: Record<SchemeTwistResolverId, SchemeTwistResolver> = {
  'reveal-or-punish': revealOrPunish,
  'chained-reveals': chainedReveals,
  'wound-all': woundAll,
  'ko-from-hq': koFromHq,
  'midtown-bank-robbery': midtownBankRobbery,
  'killbots': killbots,
  'secret-invasion': secretInvasion,
  'portals': portals,
  'clash-monster-pit': clashMonsterPit,
  'brainwash-the-military': brainwashTheMilitary,
  'go-back-in-time': goBackInTime,
  'enigma-code': unbreakableEnigmaCode,
  'change-the-outcome-of-wwii': changeTheOutcomeOfWwii,
  'counter-only': counterOnly,
};
