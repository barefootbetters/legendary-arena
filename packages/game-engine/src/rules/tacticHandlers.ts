/**
 * Mastermind tactic onFight resolvers (WP-497 / D-24300).
 *
 * When a Mastermind tactic is defeated, its printed **Fight:** ability resolves.
 * `dispatchTacticOnFight` is the per-tactic dispatcher — keyed by the defeated
 * tactic's ext_id, mirroring the per-mastermind `mastermindStrikeHandler`
 * dispatch (operator ruling 2026-08-04: per-tactic resolvers, NOT a data-driven
 * marker vocabulary; a shared vocabulary is extracted later, once ≥3 tactics
 * reveal common primitives). An unknown / unimplemented tactic id is a silent
 * no-op, so every unimplemented tactic stays exactly as inert as before this WP
 * (strictly additive).
 *
 * The first faithful resolver is co2e Doctor Octopus's "Octet of Valence
 * Electrons" — a per-player next-hand-size override consumed at that player's
 * next play-phase `onBegin` fill (see `game.ts`).
 *
 * Pure handlers: they mutate `G` directly and never throw. No boardgame.io
 * import (`ctx` is narrowed via `unknown`, mirroring `defeatMastermindTacticCore`).
 * No registry import. No `.reduce()`. No `ctx.random.*` (the Octet path reveals
 * and shuffles nothing).
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { pushLog } from '../log/logPush.js';

// why: OCTET_HAND_SIZE = 8 is the printed draw count of Doctor Octopus's "Octet
// of Valence Electrons" tactic (co2e, corrected 9→8 in #1214) — distinct from
// the default HAND_SIZE (6). It is the target hand size, not a delta.
export const OCTET_HAND_SIZE = 8;

// why: the tactic dispatch key is the tactic's ext_id
// (`${setAbbr}-mastermind-${slug}-${tacticSlug}`, built at mastermind setup and
// captured in `defeatMastermindTacticCore` before the tactic moves to the
// victory pile). This is co2e Doctor Octopus's Octet tactic.
const OCTET_TACTIC_ID: CardExtId =
  'co2e-mastermind-doctor-octopus-octet-of-valence-electrons';

/**
 * Resolves Doctor Octopus's "Octet of Valence Electrons" tactic Fight effect:
 * the defeating player draws a new hand of 8 (instead of 6) on their next fill.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (the beneficiary).
 */
export function resolveOctetOfValenceElectrons(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  // why: "draw a new hand of cards this turn" (tabletop) ≡ this player's NEXT
  // play-phase `onBegin` fill — this engine has no end-of-turn cleanup draw, so
  // the override is recorded now and consumed once at that fill (game.ts).
  // why: lazy-create the container before the first per-player write — the field
  // is absent by default (never seeded in Game.setup), and index-assigning on an
  // undefined value would throw.
  if (G.handSizeOverrides === undefined) {
    G.handSizeOverrides = {};
  }
  G.handSizeOverrides[currentPlayer] = OCTET_HAND_SIZE;
  pushLog(G,
    `Fight effect: Player ${currentPlayer} will draw ${String(OCTET_HAND_SIZE)} cards on their next hand (Octet of Valence Electrons).`,
  );
}

/**
 * Dispatches a defeated tactic's onFight ability by its ext_id.
 *
 * Fires on `ctx.currentPlayer` (the defeating player). An unknown /
 * unimplemented tactic id is a silent no-op — moves never throw, and every
 * unimplemented tactic stays inert (D-24300 arc-additivity). Called as the final
 * step of `defeatMastermindTacticCore`.
 *
 * @param G - The game state, mutated in place.
 * @param ctx - The bare boardgame.io ctx (only `currentPlayer` is read), typed
 *   `unknown` to avoid a framework import.
 * @param defeatedTacticId - The ext_id of the tactic just defeated.
 */
export function dispatchTacticOnFight(
  G: LegendaryGameState,
  ctx: unknown,
  defeatedTacticId: CardExtId,
): void {
  // why: narrow the unknown ctx to the one field this dispatch reads (the
  // defeating player), mirroring defeatMastermindTacticCore — no framework import.
  const currentPlayer = (ctx as { currentPlayer: string }).currentPlayer;

  // why: per-tactic resolver dispatch keyed by ext_id (mirrors
  // mastermindStrikeHandler); an unhandled tactic id falls through to a silent
  // no-op, so unimplemented tactics stay exactly as inert as before WP-497.
  if (defeatedTacticId === OCTET_TACTIC_ID) {
    resolveOctetOfValenceElectrons(G, currentPlayer);
    return;
  }
}
