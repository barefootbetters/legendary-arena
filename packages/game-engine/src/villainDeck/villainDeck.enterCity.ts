/**
 * No-Ambush City entry for the Legendary Arena game engine (WP-757 / D-24587).
 *
 * enterCityIgnoringAmbush places a Villain into City space 0 WITHOUT the villain-deck
 * reveal pipeline: no Ambush, no onCardRevealed rule hooks. It is the Haunt exorcise
 * release path ("the Haunting Villain enters the city, ignoring any Ambush effects").
 *
 * reenterSewersOnVillainDeckReveal (WP-868 / D-24811) is Mr. Immortal's Fight: on a matching
 * Villain Deck top, the defeated card leaves the Victory Pile and enters City space 0 the same way.
 *
 * Lives under villainDeck/ (not board/) because it reuses resolveVillainEscape from the
 * reveal module; placing it in board/ would create a board → villain/rules import cycle.
 *
 * No boardgame.io import. No .reduce(). Never throws.
 */

import type { LegendaryGameState, RevealedCardType } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ImplementationMap } from '../rules/ruleRuntime.execute.js';
import { pushVillainIntoCity } from '../board/city.logic.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import { resolveCardDisplayName } from '../villain/villainEffects.execute.js';
import { resolveVillainEscape } from './villainDeck.reveal.js';
import type { RevealContext } from './villainDeck.reveal.js';

/**
 * Pushes `cardId` into City space 0, ignoring its Ambush, and resolves any Villain
 * pushed out of the City exactly as a villain-deck reveal would.
 *
 * // why: WP-757 / D-24587 — an exorcise is NOT a reveal, so onAmbush and the
 * onCardRevealed rule hooks never fire here. An escape it causes is still a normal
 * escape, so it keeps full reveal parity by calling resolveVillainEscape (the rulebook
 * escape procedure — the owed HQ KO + Bystander discard, opened after the move, then
 * card-text Escape effects — plus bystander carry-away, captured heroes to the Escape
 * Pile, the escape→Scheme-Twist branch and the escaped-pile resource-loss check;
 * D-24656). The Secret Invasion Skrull push now runs the same procedure (D-24656).
 *
 * @param G - The game state to mutate (`G.city`, plus escape consequences).
 * @param context - Narrow reveal context (random + ctx.currentPlayer) for the escape.
 * @param implementationMap - Handler map for the escape→Scheme-Twist branch.
 * @param cardId - The Villain instance entering the City.
 */
export function enterCityIgnoringAmbush(
  G: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  cardId: CardExtId,
): void {
  const pushResult = pushVillainIntoCity(G.city, cardId);
  G.city = pushResult.city;

  pushLog(
    G,
    `${formatCardRef(G.cardDisplayData, cardId)} entered the city (exorcised; Ambush ignored).`,
    'threat',
  );

  if (pushResult.escapedCard !== null) {
    resolveVillainEscape(G, context, implementationMap, pushResult.escapedCard);
  }
}

/**
 * Mr. Immortal's Fight (WP-868 / D-24811): "Reveal the top card of the Villain Deck. If it's a
 * Villain or Bystander, Mr. Immortal reenters the Sewers."
 *
 * The bridge for the `reenter-sewers-if-villain-deck-top` executor no-op, called as the LAST step
 * of defeatCityVillainCore. In order: an empty Villain Deck stops; the top card is revealed and
 * named in the log (it never moves); a type outside `kinds` stops; a card no longer in the
 * defeating player's Victory Pile stops; otherwise the card leaves that Victory Pile, enters City
 * space 0 and any card it pushes out escapes through the full escape procedure.
 *
 * // why: D-24351 — the executor handler cannot reach the escape procedure (no RevealContext and
 * no implementationMap), so the work runs here, after the defeat has fully settled (the WP-542
 * Endless Armies bridge pattern). Reentering is NOT a reveal of the reentering card: no Ambush and
 * no onCardRevealed hooks fire, exactly as enterCityIgnoringAmbush. Bystanders rescued from Mr.
 * Immortal and the fightResolved event stand: he was defeated, then came back.
 *
 * @param G - The game state to mutate.
 * @param context - Narrow reveal context (random + ctx) for an escape the entry causes.
 * @param implementationMap - Handler map for the escape→Scheme-Twist branch.
 * @param currentPlayer - The defeating player, whose Victory Pile holds the card.
 * @param cardId - The defeated card instance.
 * @param kinds - The Villain Deck card kinds that send it back into the Sewers.
 */
export function reenterSewersOnVillainDeckReveal(
  G: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  currentPlayer: string,
  cardId: CardExtId,
  kinds: readonly ('villain' | 'bystander')[],
): void {
  const sourceName = resolveCardDisplayName(G, cardId);
  const topCardId = G.villainDeck.deck[0];
  if (topCardId === undefined) {
    pushLog(G, `Fight effect: the Villain Deck is empty, so ${sourceName} stays defeated.`, 'blocked');
    return;
  }
  const topName = resolveCardDisplayName(G, topCardId);
  pushLog(G, `Fight effect: ${sourceName} revealed ${topName} from the Villain Deck.`, 'neutral');
  if (!revealedTypeMatchesReenterKinds(G.villainDeckCardTypes[topCardId], kinds)) {
    pushLog(G, `${topName} is not a Villain or Bystander, so ${sourceName} stays defeated.`, 'neutral');
    return;
  }
  const zones = G.playerZones[currentPlayer];
  if (zones === undefined || !zones.victory.includes(cardId)) {
    pushLog(G, `Fight effect: ${sourceName} is no longer in the Victory Pile, so it cannot reenter the Sewers.`, 'blocked');
    return;
  }
  const moveResult = moveCardFromZone(zones.victory, [], cardId);
  zones.victory = moveResult.from;
  const pushResult = pushVillainIntoCity(G.city, cardId);
  G.city = pushResult.city;
  pushLog(G, `${sourceName} reenters the Sewers.`, 'threat');
  if (pushResult.escapedCard !== null) {
    resolveVillainEscape(G, context, implementationMap, pushResult.escapedCard);
  }
}

/**
 * Whether a revealed Villain Deck card's type is one of the reenter kinds.
 *
 * // why: Henchmen are Villains (rules v23), so `villain` matches a `henchman` card too.
 * Converted cards (Skrulls, Brainwashed Officers, Micro-Sized Heroes) already carry `villain`.
 *
 * @param revealedType - The card's RevealedCardType, or undefined when unclassified.
 * @param kinds - The reenter kinds.
 * @returns True when the type matches a listed kind.
 */
function revealedTypeMatchesReenterKinds(
  revealedType: RevealedCardType | undefined,
  kinds: readonly ('villain' | 'bystander')[],
): boolean {
  if (kinds.includes('villain') && (revealedType === 'villain' || revealedType === 'henchman')) {
    return true;
  }
  return kinds.includes('bystander') && revealedType === 'bystander';
}
