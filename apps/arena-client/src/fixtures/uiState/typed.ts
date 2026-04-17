/**
 * Typed-fixture layer — binds each committed JSON fixture to UIState
 * at its import site via `satisfies`.
 *
 * // why: `satisfies UIState` (never a bare type-assertion to the same
 * type) forces the JSON literal to be structurally checked against the
 * engine-owned UIState contract at each import site. Any fixture drift
 * becomes a compile-time error here instead of a runtime surprise
 * downstream. A bare type-assertion would silently widen the literal and
 * mask drift — explicitly forbidden by EC-067.
 */

import type { UIState } from '@legendary-arena/game-engine';
import midTurnJson from './mid-turn.json';
import endgameWinJson from './endgame-win.json';
import endgameLossJson from './endgame-loss.json';

export const midTurn = midTurnJson satisfies UIState;
export const endgameWin = endgameWinJson satisfies UIState;
export const endgameLoss = endgameLossJson satisfies UIState;
