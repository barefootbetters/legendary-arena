/**
 * No-Ambush City entry for the Legendary Arena game engine (WP-757 / D-24587).
 *
 * enterCityIgnoringAmbush places a Villain into City space 0 WITHOUT the villain-deck
 * reveal pipeline: no Ambush, no onCardRevealed rule hooks. It is the Haunt exorcise
 * release path ("the Haunting Villain enters the city, ignoring any Ambush effects").
 *
 * Lives under villainDeck/ (not board/) because it reuses resolveVillainEscape from the
 * reveal module; placing it in board/ would create a board → villain/rules import cycle.
 *
 * No boardgame.io import. No .reduce(). Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ImplementationMap } from '../rules/ruleRuntime.execute.js';
import { pushVillainIntoCity } from '../board/city.logic.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';
import { resolveVillainEscape } from './villainDeck.reveal.js';
import type { RevealContext } from './villainDeck.reveal.js';

/**
 * Pushes `cardId` into City space 0, ignoring its Ambush, and resolves any Villain
 * pushed out of the City exactly as a villain-deck reveal would.
 *
 * // why: WP-757 / D-24587 — an exorcise is NOT a reveal, so onAmbush and the
 * onCardRevealed rule hooks never fire here. An escape it causes is still a normal
 * escape, so it keeps full reveal parity by calling resolveVillainEscape (the generic
 * wound, card-text Escape effects, bystander carry-away, captured-hero KO, the
 * escape→Scheme-Twist branch and the escaped-pile resource-loss check). Secret
 * Invasion's reduced push handling is deliberately NOT copied.
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
