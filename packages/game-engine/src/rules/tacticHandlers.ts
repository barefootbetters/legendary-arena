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
 * next play-phase `onBegin` fill (see `game.ts`). The second is core Magneto's
 * "Crushing Shockwave" — each OTHER player reveals an X-Men Hero or gains two
 * Wounds (WP-506 / D-24312).
 *
 * Pure handlers: they mutate `G` directly and never throw. No boardgame.io
 * import (`ctx` is narrowed via `unknown`, mirroring `defeatMastermindTacticCore`).
 * No registry import. No `.reduce()`. No `ctx.random.*` (nothing here reveals or
 * shuffles).
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { pushLog } from '../log/logPush.js';
import { gainWound } from '../board/wounds.logic.js';

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

// why: core Magneto's Crushing Shockwave tactic ext_id, same grammar as
// OCTET_TACTIC_ID above (card slug `crushing-shockwave` in data/cards/core.json).
const MAGNETO_CRUSHING_SHOCKWAVE_TACTIC_ID: CardExtId =
  'core-mastermind-magneto-crushing-shockwave';

// why: SHOCKWAVE_WOUND_COUNT = 2 is the printed "gains two Wounds" of Crushing
// Shockwave — distinct from the co2e-Magneto Master Strike's single Wound
// (resolveCo2eMagnetoStrike in mastermindHandlers.ts). It is the max per
// penalized player, clamped by the live Wound supply.
export const SHOCKWAVE_WOUND_COUNT = 2;

// why: the normalized lowercase team slug stored on `G.cardTraits[extId].team`
// (WP-179), matching mastermindHandlers.ts verbatim. Only Heroes carry a team.
const TEAM_X_MEN = 'x-men';

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
 * Whether a player's hand holds an X-Men Hero — the Crushing Shockwave reveal
 * branch.
 *
 * Inlined here (an explicit hand scan against `G.cardTraits`) rather than
 * reusing `mastermindHandlers.ts`'s `playerHasXMenHeroInHand`, which is
 * module-private there; per the repo "duplicate first, abstract only when a
 * third copy appears" rule, this WP keeps the change to `tacticHandlers.ts` and
 * does not widen the mastermind module's surface for a single reuse.
 *
 * @param G - The game state (read-only here; supplies `cardTraits`).
 * @param hand - The player's hand, in order.
 * @returns True when the hand holds at least one card whose team is `x-men`.
 */
function handHasXMenHero(
  G: LegendaryGameState,
  hand: readonly CardExtId[],
): boolean {
  for (const cardExtId of hand) {
    // why: map-level defensive `?.` on `G.cardTraits` — legacy/unit states
    // predate WP-179 and leave the map undefined; a missing map means nothing
    // matches rather than a throw. This is a TEAM-ONLY check, by design: only
    // Heroes carry a team, so Wounds, Bystanders, and the three basic S.H.I.E.L.D.
    // cards (teamless — reference_basic_shield_cards_teamless) never false-match.
    // Do NOT add a heroClass guard and do NOT drop the map-level `?.`.
    if (G.cardTraits?.[cardExtId]?.team === TEAM_X_MEN) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves core Magneto's "Crushing Shockwave" tactic Fight effect:
 * "Each other player reveals an [team:x-men] Hero or gains two Wounds."
 *
 * For every player EXCEPT the defeating player (sorted id order): a player who
 * holds an X-Men Hero in hand reveals it and loses nothing (a pure log event);
 * a player who cannot reveal gains up to two Wounds from the supply. Mutates
 * `G.piles.wounds` and the penalized players' discard zones directly; never
 * throws (a supply shortfall is a logged no-op).
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic. Skipped — the
 *   effect targets the OTHER players.
 */
export function resolveCrushingShockwave(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  const playerIds = Object.keys(G.playerZones).sort();

  for (const playerId of playerIds) {
    // why: "each OTHER player" — a tactic Fight is the defeating player's reward
    // AGAINST the others, unlike a Master Strike, which hits every player. Skip
    // currentPlayer entirely: no reveal check, no Wounds.
    if (playerId === currentPlayer) {
      continue;
    }

    const playerZones = G.playerZones[playerId]!;

    // why: reveal branch — a player holding an X-Men Hero reveals it and loses
    // nothing (a no-op mutation, only a log line), mirroring the reveal branch of
    // Magneto's Master Strike. Deterministic auto-resolve is player-optimal (a
    // free reveal beats two Wounds), so no fidelity is lost vs a blocking
    // pending-choice (D-24312 / D-24192 precedent).
    if (handHasXMenHero(G, playerZones.hand)) {
      pushLog(G,
        `Fight effect: Player ${playerId} revealed an X-Men Hero (Crushing Shockwave) — no Wounds.`,
      );
      continue;
    }

    // why: the two gainWound calls THREAD — gainWound is non-mutating (returns
    // fresh arrays), so assign both returned arrays back to `G.piles.wounds` and
    // the player's discard after each call; a second call against the ORIGINAL
    // pile would net only one Wound. Detect a per-call no-op by the returned
    // woundsPile length not dropping (mirrors gainWoundToDiscard).
    let woundsTaken = 0;
    for (let woundIndex = 0; woundIndex < SHOCKWAVE_WOUND_COUNT; woundIndex++) {
      const woundResult = gainWound(G.piles.wounds, playerZones.discard);
      if (woundResult.woundsPile.length === G.piles.wounds.length) {
        // why: supply empty this iteration — no Wound moved; stop early rather
        // than substitute or throw (moves never throw).
        break;
      }
      G.piles.wounds = woundResult.woundsPile;
      playerZones.discard = woundResult.playerDiscard;
      woundsTaken += 1;
    }

    // why: supply-shortfall path — fewer Wounds available than the printed two is
    // a logged no-op-shortfall; report the count actually taken so the
    // play-by-play reflects the real supply outcome.
    pushLog(G,
      `Fight effect: Player ${playerId} held no X-Men Hero and gained ${String(woundsTaken)} Wound(s) (Crushing Shockwave).`,
    );
  }
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
  if (defeatedTacticId === MAGNETO_CRUSHING_SHOCKWAVE_TACTIC_ID) {
    resolveCrushingShockwave(G, currentPlayer);
    return;
  }
}
