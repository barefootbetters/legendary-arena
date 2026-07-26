/**
 * Villain deck reveal move for the Legendary Arena game engine.
 *
 * revealVillainCard draws the top card from the villain deck, looks up its
 * classification in G.villainDeckCardTypes, emits the appropriate rule
 * triggers via the WP-009B pipeline, applies the resulting effects, and
 * places the card in discard.
 *
 * This move assumes the deck already exists in G. It does not construct
 * or validate deck composition — that is WP-014B's responsibility.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { formatCardRef } from '../log/logDisplay.js';
import type { RuleEffect } from '../rules/ruleHooks.types.js';
import type { ImplementationMap } from '../rules/ruleRuntime.execute.js';
import { executeRuleHooks } from '../rules/ruleRuntime.execute.js';
import { applyRuleEffects } from '../rules/ruleRuntime.effects.js';
import { DEFAULT_IMPLEMENTATION_MAP } from '../rules/ruleRuntime.impl.js';
import { pushVillainIntoCity } from '../board/city.logic.js';
import { validateCityShape } from '../board/city.validate.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { gainWound } from '../board/wounds.logic.js';
import { resolveEscapedBystanders } from '../board/bystanders.logic.js';
import { hasAmbush } from '../board/boardKeywords.logic.js';
import { koAttachedHeroesOnEscape } from '../board/heroCapture.logic.js';
import {
  executeVillainAbilities,
  resolveEffectResultNames,
} from '../villain/villainEffects.execute.js';
import { hasPendingKoHeroChoice } from '../moves/koHeroChoice.resolve.js';
import { hasPendingOptionalKoReward } from '../moves/optionalKoReward.resolve.js';
import { hasPendingVictoryPileCardPick } from '../moves/resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from '../moves/drawOrEmpowered.resolve.js';
import { hasPendingReturnZeroCostDiscard } from '../moves/resolveReturnZeroCostDiscard.js';
import {
  composeAmbushNarrative,
  composeEffectResultLogLine,
} from '../events/notableEvents.compose.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

// why: narrow context interface for performVillainReveal so rule handlers
// can chain a reveal without importing boardgame.io. The real boardgame.io
// FnContext is structurally assignable to RevealContext.
/** Minimum context the inner reveal needs: deterministic shuffle + active player. */
export interface RevealContext {
  /** Deterministic RNG for villain-deck reshuffle. */
  random: { Shuffle: <T>(deck: T[]) => T[] };
  /** boardgame.io ctx fragment carrying the active player id. */
  ctx: { currentPlayer: string };
}

/**
 * Reveals the top card from the villain deck (boardgame.io move wrapper).
 *
 * Thin wrapper around performVillainReveal. The wrapper applies the
 * start-stage gate; performVillainReveal owns the draw → classify → route →
 * trigger → apply pipeline. Splitting the gate from the pipeline lets rule
 * handlers (e.g., Midtown Bank Robbery twist) chain another reveal without
 * re-asserting the stage gate or duplicating the body.
 *
 * @param context - boardgame.io move context with G, ctx, random, playerID.
 */
export function revealVillainCard({ G, ctx, ...context }: MoveContext): void {
  // Step 0: Stage gate (non-core move contract)
  // why: villain reveal is a start-of-turn action per tabletop Legendary
  if (G.currentStage !== 'start') return;

  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the
  // board is frozen; revealVillainCard returns with no side effects. Placed
  // immediately after the stage gate, before the once-per-turn guard and any
  // G/zone write.
  if (hasPendingKoHeroChoice(G)) return;
  // why: block-all guard (D-24019) — optional-KO-reward choice pending; the
  // board is frozen until resolved (beside the D-24008 KO-hero check above).
  if (hasPendingOptionalKoReward(G)) return;
  // why: block-all — pendingVictoryPileCardPick must be resolved before any other action (D-24067)
  if (hasPendingVictoryPileCardPick(G)) return;
  // why: block-all — pendingDrawOrEmpowered must be resolved before any other action (D-24069)
  if (hasPendingDrawOrEmpowered(G)) return;
  // why: block-all — pendingReturnZeroCostDiscard must be resolved before any other action (D-24139)
  if (hasPendingReturnZeroCostDiscard(G)) return;

  // why: the start-of-turn reveal is once per turn; scheme/card effects that
  // chain extra reveals call performVillainReveal directly and intentionally
  // bypass this guard.
  if (G.villainRevealedThisTurn) return;

  performVillainReveal(
    G,
    { random: context.random, ctx: { currentPlayer: ctx.currentPlayer } },
    DEFAULT_IMPLEMENTATION_MAP,
  );

  // why: the player's single start-of-turn reveal attempt is now consumed; set
  // regardless of whether the call above mutated the board (an exhausted-deck
  // no-op still spends the allowance, foreclosing a same-turn retry loop).
  G.villainRevealedThisTurn = true;
}

/**
 * Reveals the top card from the villain deck and runs the full trigger pipeline.
 *
 * Pipeline: draw → classify → City routing (villain/henchman) → trigger →
 * apply effects → discard routing (bystander/scheme-twist/mastermind-strike).
 *
 * Handles edge cases:
 * - Empty deck + non-empty discard: reshuffles discard into deck first.
 * - Empty deck + empty discard: logs a message and returns.
 * - Missing card type: fail-closed — logs a message, card stays in deck.
 *
 * @param G - The game state to mutate.
 * @param context - Narrow context with random + ctx.currentPlayer.
 * @param implementationMap - Handler map used by executeRuleHooks.
 */
export function performVillainReveal(
  G: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
): void {
  const ctx = context.ctx;
  const deck = G.villainDeck.deck;

  // Step 1: Handle empty deck
  // why: WP-367 / D-24160 — the Villain Deck does NOT reshuffle from its discard.
  // Per the quoted rulebook the deck running out is terminal: it latches the
  // final turn (see game.ts turn.onMove, D-24159) rather than being refilled.
  // (In practice the villain discard is already dead: revealed villains/henchmen
  // route to the City and other card types route to their own piles, so nothing
  // accumulates in villainDeck.discard to reshuffle anyway.) An empty deck here
  // is simply a no-op reveal — the latch was already set on the reveal that drew
  // the last card.
  if (deck.length === 0) {
    pushLog(G, 'Villain deck reveal skipped: the villain deck is empty.');
    return;
  }

  // Step 2: Draw the top card (top-of-deck = deck[0], locked convention)
  const cardId = G.villainDeck.deck[0];

  if (!cardId) {
    pushLog(G, 'Villain deck reveal skipped: the villain deck is empty.');
    return;
  }

  // Step 3: Look up classification — fail-closed if missing
  const cardType = G.villainDeckCardTypes[cardId];

  if (!cardType) {
    pushLog(G, 
      `Villain deck reveal failed: card "${cardId}" has no entry in villainDeckCardTypes. No removal or trigger occurred.`,
    );
    return;
  }

  // Step 4: City routing for villain and henchman cards
  // why: City placement before triggers so hooks observe post-placement state.
  // This ordering is contractual — rule hooks see the physical board state that
  // players would see immediately after a reveal (Legendary tabletop semantics).
  // why: Deck removal is deferred until placement destination is confirmed.
  // If city validation fails, the card must remain on top of the deck — removing
  // it before validation would silently lose the card (WP-015A fix).
  if (cardType === 'villain' || cardType === 'henchman') {
    const cityValidation = validateCityShape(G.city);
    if (!cityValidation.ok) {
      pushLog(G, 
        `Villain city placement skipped: G.city is malformed. Card "${cardId}" remains in deck.`,
      );
      return;
    }

    // Remove card from deck only after city validation succeeds
    G.villainDeck.deck = G.villainDeck.deck.slice(1);

    const pushResult = pushVillainIntoCity(G.city, cardId);
    G.city = pushResult.city;

    // why: every villain-deck reveal must produce a start-stage log line. The
    // bystander branch logs "revealed and captured by X" and mastermind-strike
    // logs via its rule hook, but a villain/henchman entering the city had no
    // base log line — so the first turn (empty city → the reveal fills it, no
    // escape) showed nothing at step 1 and the game log appeared to start at
    // step 2. Log the city entry here, before the escape/wound/ambush detail
    // lines below, so the reveal is always narrated. (G.messages is
    // hash-excluded, D-24081, so this is replay-safe.)
    pushLog(
      G,
      `${formatCardRef(G.cardDisplayData, cardId)} revealed and entered the city.`,
    );

    if (pushResult.escapedCard !== null) {
      // why: ENDGAME_CONDITIONS.ESCAPED_VILLAINS is the canonical counter key
      // for escape tracking. evaluateEndgame reads this counter to determine
      // scheme-wins loss condition.
      const currentEscaped = G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0;
      G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] = currentEscaped + 1;

      // why: escaped card pushed to G.escapedPile only when non-null (null
      // means no card was displaced). Counter increments regardless — the
      // counter tracks escape events, the pile tracks card identity.
      G.escapedPile = [...G.escapedPile, pushResult.escapedCard];

      pushLog(G, 
        `Villain ${formatCardRef(G.cardDisplayData, pushResult.escapedCard)} escaped from the city.`,
      );

      // why: escape causes wound — MVP rule linking escapes to player penalty.
      // Current player gains 1 wound when a villain escapes the City.
      const woundPileBefore = G.piles.wounds.length;
      const woundResult = gainWound(
        G.piles.wounds,
        G.playerZones[ctx.currentPlayer]!.discard,
      );
      G.piles.wounds = woundResult.woundsPile;
      G.playerZones[ctx.currentPlayer]!.discard = woundResult.playerDiscard;
      if (woundPileBefore > 0) {
        // why: track current player wound for UI economy projection
        G.turnEconomy.woundsDrawn += 1;
        pushLog(G, 
          `Player ${ctx.currentPlayer} gained a wound from villain escape.`,
        );
      }

      // why: escaped villain releases bystanders back to supply to prevent
      // memory leaks and bystander depletion
      const bystanderPileBefore = G.piles.bystanders.length;
      const escapeBystanderResult = resolveEscapedBystanders(
        pushResult.escapedCard,
        G.attachedBystanders,
        G.piles.bystanders,
      );
      G.attachedBystanders = escapeBystanderResult.attachedBystanders;
      G.piles.bystanders = escapeBystanderResult.bystandersPile;
      if (escapeBystanderResult.bystandersPile.length > bystanderPileBefore) {
        pushLog(G, 
          `Bystanders from escaped villain ${formatCardRef(G.cardDisplayData, pushResult.escapedCard)} returned to supply.`,
        );
      }

      // why: card-specific Escape:/Overrun: effects fire AFTER
      // resolveEscapedBystanders per D-18603 — a captureBystander effect
      // reached via an Escape: marker attaches to the escaped card now in
      // G.escapedPile (post-release), not the still-attached pre-release
      // state. The generic per-escape current-player wound above (WP-015
      // legacy system-level penalty) is PRESERVED; card-text effects layer
      // on top, they do not replace it. Overrun: is a v1 synonym of Escape:
      // (D-18602) — both prefixes resolve to onEscape at parse time, so this
      // single fire site covers both. Henchman escapes safely no-op here
      // (per-card hook lookup misses; D-18507-class filter). Per WP-191
      // (D-18704..D-18708), pushResult.escapedCard is the zone-instance
      // ext_id the per-card hook lookup expects, so villain onEscape effects
      // now fire end-to-end on real cards (D-18508 CLOSED).
      const appliedEscapeResults = executeVillainAbilities(
        G,
        ctx,
        pushResult.escapedCard,
        'onEscape',
      );
      // why: WP-316 — Escape is LOG-ONLY: narrate the Escape: effect targets
      // into G.messages (hash-excluded, D-24081) but add NO escapeResolved (or
      // any) notableEvent. G.notableEvents is hashed + projected to the
      // arena-client, so a new event would re-pin the sentinel finalStateHash.
      // Length-guarded: no line when no effect applied. Names resolve at the
      // fire site via G.cardDisplayData (the composer stays pure).
      if (appliedEscapeResults.length > 0) {
        const resolvedEscapeResults = resolveEffectResultNames(G, appliedEscapeResults);
        pushLog(G, 
          `Escape effect: ${composeEffectResultLogLine(resolvedEscapeResults)}.`,
        );
      }
      // why: captured heroes KO'd when villain escapes (tabletop rules)
      koAttachedHeroesOnEscape(G, pushResult.escapedCard);
    }

    // why: Ambush fires on City entry. The hardcoded "each player gains a
    // wound" loop previously here is deleted (D-18504; supersedes the D-2403
    // safe-skip note for the Ambush case) — it fired identical wrong behavior
    // for every Ambush card regardless of printed text. Dispatch now runs the
    // card's parsed [effect:] hooks via executeVillainAbilities, gated by the
    // existing hasAmbush fast pre-check (the keyword-detection invariant from
    // buildCardKeywords.ts). The keyword map is re-derived inline so this call
    // carries no dependency on a deleted binding.
    // why: WP-200 — capture the executor's return and emit `ambushResolved`.
    // Only genuine Ambush `[effect:]` results feed `appliedEffects` / the
    // narrative. (The MVP unconditional city-entry bystander attach — D-1701,
    // NOT the D-18504 ambush-wound deletion above — was removed by WP-432 as
    // non-canonical, so there is no longer a non-Ambush attach to exclude here.)
    // Resolving the citySpace via `G.city.indexOf(cardId)`
    // after `pushVillainIntoCity` reflects the final placement index
    // (0..4); -1 falls back to 0 if the push collapsed the card off the
    // edge (a contract violation the move never hits in production but
    // the emission must remain defensive).
    if (hasAmbush(cardId, G.cardKeywords ?? {})) {
      const appliedAmbushResults = executeVillainAbilities(G, ctx, cardId, 'onAmbush');
      // why: WP-316 — map results→keywords so the ambushResolved `appliedEffects`
      // field and the composeAmbushNarrative string stay byte-identical to main;
      // the hashed notableEvents surface (and the arena-client) never observe the
      // per-target widening, so finalStateHash is unchanged.
      const appliedAmbushEffects = appliedAmbushResults.map((result) => result.keyword);
      // why: WP-200 — defensive access; legacy test states may leave
      // `cardDisplayData` undefined. Production setup always builds it.
      const ambushCardDisplay = G.cardDisplayData?.[cardId];
      const ambushCardName =
        ambushCardDisplay && typeof ambushCardDisplay.name === 'string' && ambushCardDisplay.name.length > 0
          ? ambushCardDisplay.name
          : cardId;
      const ambushCitySpace = (() => {
        const found = G.city.indexOf(cardId);
        return found >= 0 ? found : 0;
      })();
      // why: WP-316 + WP-319 — resolve the effect targets to display names ONCE;
      // the same resolved results feed BOTH the durable `Ambush effect:` log line
      // AND the ambushResolved narrative (so the overlay + log name the same hero).
      const resolvedAmbushResults = resolveEffectResultNames(G, appliedAmbushResults);
      // why: WP-316 — narrate the Ambush: effect targets into the durable log
      // (G.messages, hash-excluded per D-24081) after the executor runs and
      // BEFORE the ambushResolved event push. Length-guarded: no line when no
      // effect applied. The unconditional city-entry bystander attach below is
      // NOT an Ambush effect and never appears here.
      if (appliedAmbushResults.length > 0) {
        pushLog(G, 
          `Ambush effect: ${composeEffectResultLogLine(resolvedAmbushResults)}.`,
        );
      }
      G.notableEvents.push({
        type: 'ambushResolved',
        revealedCardId: cardId,
        citySpace: ambushCitySpace,
        appliedEffects: appliedAmbushEffects,
        // why: WP-319 — the narrative now names the captured HQ hero / KO'd hero
        // (etc.) via the resolved results, so the center-screen overlay announces
        // the specific hero. `appliedEffects` stays the keyword array (badges).
        narrative: composeAmbushNarrative(ambushCardName, resolvedAmbushResults),
      });
    }

    // why: WP-432 (supersedes D-1701 / removes the WP-431 entry-capture log) —
    // a villain/henchman does NOT capture a bystander merely by entering the
    // City. Canonical Legendary: bystanders enter play ONLY via a bystander CARD
    // revealed from the villain deck (captured by the frontmost city villain, or
    // the Mastermind if the city is empty — the `cardType === 'bystander'` branch
    // below) or via a specific Ambush / Master-Strike / Scheme-Twist / Fight
    // `capture-bystander` effect. The former MVP unconditional attach from
    // `G.piles.bystanders` (D-1701 / WP-017) was a second, non-canonical source
    // that doubled bystanders-in-play and drained the supply pile that hero
    // "Rescue a Bystander" abilities share (D-24032 floor). It is deleted here.
  } else {
    // Non-city card types: remove from deck before trigger/discard routing
    G.villainDeck.deck = G.villainDeck.deck.slice(1);
  }

  // Step 5: Collect rule effects via the WP-009B pipeline
  // why: pass the full RevealContext (not just ctx) to executeRuleHooks /
  // applyRuleEffects so handlers/applicators that need `random` (e.g., the
  // Midtown Bank Robbery twist chaining another reveal, or the drawCards
  // effect's reshuffle path) can reach it via `context.random.Shuffle`.
  const allEffects: RuleEffect[] = [];

  // Always emit onCardRevealed
  const cardRevealedEffects = executeRuleHooks(
    G,
    context,
    'onCardRevealed',
    { cardId, cardTypeSlug: cardType },
    G.hookRegistry,
    implementationMap,
  );

  for (const effect of cardRevealedEffects) {
    allEffects.push(effect);
  }

  // Conditionally emit type-specific triggers
  if (cardType === 'scheme-twist') {
    const schemeTwistEffects = executeRuleHooks(
      G,
      context,
      'onSchemeTwistRevealed',
      { cardId },
      G.hookRegistry,
      implementationMap,
    );

    for (const effect of schemeTwistEffects) {
      allEffects.push(effect);
    }
  }

  if (cardType === 'mastermind-strike') {
    const mastermindStrikeEffects = executeRuleHooks(
      G,
      context,
      'onMastermindStrikeRevealed',
      { cardId },
      G.hookRegistry,
      implementationMap,
    );

    for (const effect of mastermindStrikeEffects) {
      allEffects.push(effect);
    }
  }

  // Step 6: Apply all collected effects
  applyRuleEffects(G, context, allEffects);

  // Step 7: Route card to final destination based on type
  // Villain and henchman cards are already in the City (step 4b above).
  // All other card types go to discard.
  if (cardType === 'villain' || cardType === 'henchman') {
    // Already placed in City in step 4b — do not also place in discard
  } else if (cardType === 'bystander') {
    // why: per Legendary tabletop rules, a bystander revealed from the
    // villain deck is captured by the frontmost villain in the City (the
    // one that will escape next — highest occupied index, since index 4
    // is the escape edge per pushVillainIntoCity). If the City has no
    // villains, the Mastermind captures the bystander instead. The
    // bystander is NOT routed to villainDeck.discard.
    let captorCardId = G.mastermind.baseCardId;
    for (let cityIndex = G.city.length - 1; cityIndex >= 0; cityIndex--) {
      const occupant = G.city[cityIndex];
      if (occupant !== null && occupant !== undefined) {
        captorCardId = occupant;
        break;
      }
    }
    const existingAttached = G.attachedBystanders[captorCardId] ?? [];
    G.attachedBystanders = {
      ...G.attachedBystanders,
      [captorCardId]: [...existingAttached, cardId],
    };
    // why: when the mastermind is the captor (city is empty), also push to
    // G.mastermind.attachedBystanders so the UI projection surfaces it on
    // the mastermind tile. G.attachedBystanders is the authoritative store
    // for all bystander attachments; G.mastermind.attachedBystanders is the
    // projection surface the UI reads (D-12805 Interpretation B).
    if (captorCardId === G.mastermind.baseCardId) {
      const existing = G.mastermind.attachedBystanders ?? [];
      G.mastermind = {
        ...G.mastermind,
        attachedBystanders: [...existing, cardId],
      };
    }
    pushLog(G, 
      `${formatCardRef(G.cardDisplayData, cardId)} revealed and captured by ${formatCardRef(G.cardDisplayData, captorCardId)}.`,
    );
  } else if (cardType === 'scheme-twist') {
    // why: scheme-twist cards route to G.scheme.twistPile (not discard)
    // so the game tracks resolved twists for UI projection and future
    // scheme-loss evaluation
    G.scheme.twistPile = [...G.scheme.twistPile, cardId];
  } else if (cardType === 'mastermind-strike') {
    // why: mastermind-strike cards route to G.mastermind.strikePile (not
    // discard) so the game tracks resolved strikes for UI projection
    G.mastermind.strikePile = [...G.mastermind.strikePile, cardId];
  }
}
