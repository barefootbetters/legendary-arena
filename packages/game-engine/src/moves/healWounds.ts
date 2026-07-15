/**
 * Wound "Healing" ability move for the Legendary Arena game engine (WP-379).
 *
 * healWounds realizes the printed universal Wound ability — "If you don't
 * recruit or fight anything on your turn, you may KO all the Wounds from your
 * hand." (Universal Rules v23 §Healing Wounds). It KOs every Wound in the
 * current player's hand into G.ko (permanent removal — never back to the wounds
 * supply, never to discard). Wounds are used directly from hand and are never
 * "played".
 *
 * This is a non-core move that gates internally (same pattern as fightVillain /
 * recruitHero / fightMastermind from WP-016 / WP-014A): stage gate, then the
 * block-all pending-choice guards, then a "has not acted this turn" precondition,
 * then mutate G. It creates no pending-choice state (healing is synchronous).
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { koCard } from '../board/ko.logic.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';
import { hasPendingVictoryPileCardPick } from './resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from './drawOrEmpowered.resolve.js';
import { hasPendingReturnZeroCostDiscard } from './resolveReturnZeroCostDiscard.js';
import { pushLog } from '../log/logPush.js';
import { composeHealNarrative } from '../events/notableEvents.compose.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Returns whether the current player has already used the Healing ability this
 * turn. Read by fightVillain / recruitHero / fightMastermind to enforce the
 * reverse lock — a player who heals may not fight or recruit for the rest of the
 * turn (D-24180). Mirrors the hasPending*(G) predicate shape.
 *
 * @param G - The game state.
 * @returns True when G.hasHealedThisTurn is set.
 */
export function hasHealedThisTurn(G: LegendaryGameState): boolean {
  return G.hasHealedThisTurn === true;
}

/**
 * Uses the Wound "Healing" ability: KOs every Wound in the current player's hand.
 *
 * Follows the non-core move contract. On a successful heal, each Wound moves from
 * the player's hand to G.ko, G.hasHealedThisTurn is set, and one line is appended
 * to G.messages. Any blocked, out-of-stage, already-acted, or no-Wounds call
 * returns void with no mutation. Moves never throw.
 *
 * @param context - boardgame.io move context with G, ctx.
 */
export function healWounds({ G, ctx }: MoveContext): void {
  // Step 2: Stage gate (non-core move, internal gating)
  // why: Healing is a your-turn main-action-window action, mirroring fightVillain
  // / recruitHero — non-core moves gate internally per the WP-014A precedent.
  if (G.currentStage !== 'main') return;

  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the board
  // is frozen; healWounds returns with no side effects. This is the identical
  // block-all cluster the fight/recruit moves carry, so a pending choice freezes
  // Healing too.
  if (hasPendingKoHeroChoice(G)) return;
  // why: block-all guard (D-24019) — optional-KO-reward choice pending.
  if (hasPendingOptionalKoReward(G)) return;
  // why: block-all — pendingVictoryPileCardPick must be resolved first (D-24067)
  if (hasPendingVictoryPileCardPick(G)) return;
  // why: block-all — pendingDrawOrEmpowered must be resolved first (D-24069)
  if (hasPendingDrawOrEmpowered(G)) return;
  // why: block-all — pendingReturnZeroCostDiscard must be resolved first (D-24139)
  if (hasPendingReturnZeroCostDiscard(G)) return;

  // why: D-24179 — Healing is barred once the player has recruited or fought this
  // turn ("If you don't recruit or fight anything on your turn, you may KO all the
  // Wounds from your hand"). hasActedThisTurn is set on a successful fightVillain /
  // recruitHero / fightMastermind.
  if (G.hasActedThisTurn === true) return;

  const playerZones = G.playerZones[ctx.currentPlayer];
  if (!playerZones) return;

  // why: partition the hand into surviving (non-Wound) cards and a Wound count in
  // a single explicit pass — no .reduce() / .filter() per the zone-op style.
  const survivingHand: string[] = [];
  let woundsToKo = 0;
  for (const cardId of playerZones.hand) {
    if (cardId === WOUND_EXT_ID) {
      woundsToKo += 1;
    } else {
      survivingHand.push(cardId);
    }
  }

  // why: no Wounds in hand means there is nothing to heal — deterministic no-op.
  if (woundsToKo === 0) return;

  // Step 3: Mutate G — KO every Wound to G.ko, keep the rest of the hand, set the
  // reverse-lock flag.
  // why: koCard appends one card and every KO'd Wound shares WOUND_EXT_ID, so KO
  // one copy per counted Wound.
  for (let woundIndex = 0; woundIndex < woundsToKo; woundIndex += 1) {
    G.ko = koCard(G.ko, WOUND_EXT_ID);
  }
  playerZones.hand = survivingHand;
  // why: D-24180 — once the player heals they may not fight or recruit for the rest
  // of the turn; fightVillain / recruitHero / fightMastermind read this via
  // hasHealedThisTurn(G).
  G.hasHealedThisTurn = true;

  pushLog(
    G,
    `Player ${ctx.currentPlayer} used Healing: KO'd ${woundsToKo} Wound(s) from hand.`,
  );

  // why: WP-381 / D-24182 — emit the healResolved notable event LAST (after the
  // reverse-lock flag and the log push), observing settled state — the
  // fightVillain emission precedent. Unconditional push; setup guarantees
  // G.notableEvents. G.messages is not projected to clients, so this event is
  // what drives the center-screen "Healed" overlay.
  G.notableEvents.push({
    type: 'healResolved',
    playerId: ctx.currentPlayer,
    woundsHealed: woundsToKo,
    narrative: composeHealNarrative(woundsToKo),
  });
}
