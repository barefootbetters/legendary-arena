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
import { gainWoundForPlayer } from '../board/wounds.logic.js';
import { addResources } from '../economy/economy.logic.js';
import { drawCardsIntoHand, HAND_SIZE } from '../moves/drawCards.logic.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import { cardHasTeamWhenPlayed } from '../hero/effectiveTeams.logic.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import type { ShuffleProvider } from '../setup/shuffle.js';

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

// why: WP-567 / D-24376 - core Red Skull's three non-interactive tactic ext_ids,
// same grammar as the two constants above. Each names the PRINTED Fight text the
// resolver below implements, read from data/cards/core.json rather than the
// keyword blurb (which is on the known-divergent list):
//   Negablast Grenades  "Fight: You get +3[icon:attack]."
//   Endless Resources   "Fight: You get +4[icon:recruit]."
//   HYDRA Conspiracy    "Fight: Draw two cards. Then draw another card for each
//                        HYDRA Villain in your Victory Pile."
const RED_SKULL_NEGABLAST_GRENADES_TACTIC_ID: CardExtId =
  'core-mastermind-red-skull-negablast-grenades';
const RED_SKULL_ENDLESS_RESOURCES_TACTIC_ID: CardExtId =
  'core-mastermind-red-skull-endless-resources';
const RED_SKULL_HYDRA_CONSPIRACY_TACTIC_ID: CardExtId =
  'core-mastermind-red-skull-hydra-conspiracy';

// why: WP-567 - Red Skull's FOURTH tactic, "Ruthless Dictator", is deliberately
// NOT dispatched. Its printed text ("Look at the top three cards of your deck.
// KO one, discard one and put one back on top") is INTERACTIVE: it parks a
// pending choice, and a parked choice shipped without its UIState projection and
// prompt HARD-FREEZES the human player. It ships in its own packet together with
// the projection, the prompt and the bot legalMoves enumeration mirror. Three of
// four is intentional - do not "complete" this switch.

// why: the printed magnitudes, named rather than inlined so the dispatch reads as
// the card text and a future audit can grep the numbers.
export const NEGABLAST_GRENADES_ATTACK = 3;
export const ENDLESS_RESOURCES_RECRUIT = 4;
export const HYDRA_CONSPIRACY_BASE_DRAW = 2;

// why: Red Skull "Always Leads: HYDRA", so HYDRA Conspiracy's per-villain bonus
// counts the hydra villain group. Normalized lowercase-kebab, matching the group
// segment inside a villain ext_id (`${setAbbr}-villain-${group}-${cardSlug}`).
const HYDRA_VILLAIN_GROUP = 'hydra';

// why: WP-691 / D-24508 — the three no-choice core mastermind tactic ext_ids, same
// `${setAbbr}-mastermind-${mastermindSlug}-${tacticSlug}` grammar as the constants
// above. Each names the PRINTED Fight text (data/cards/core.json) the resolver
// below implements:
//   Treasures of Latveria "Fight: When you draw a new hand of cards at the end of
//                          this turn, draw three extra cards."
//   Xavier's Nemesis      "Fight: For each of your [team:x-men] Heroes, rescue a
//                          Bystander."
//   Whispers and Lies     "Fight: Each other player KOs two Bystanders from their
//                          Victory Pile."
const DR_DOOM_TREASURES_OF_LATVERIA_TACTIC_ID: CardExtId =
  'core-mastermind-dr-doom-treasures-of-latveria';
const MAGNETO_XAVIERS_NEMESIS_TACTIC_ID: CardExtId =
  'core-mastermind-magneto-xaviers-nemesis';
const LOKI_WHISPERS_AND_LIES_TACTIC_ID: CardExtId =
  'core-mastermind-loki-whispers-and-lies';

// why: WP-691 / D-24508 — Treasures of Latveria draws THREE EXTRA cards, so the
// next-hand override is ADDITIVE (base fill + 3), not a set-to-N like Octet's
// OCTET_HAND_SIZE. It reuses the WP-497 shared `G.handSizeOverrides` field via the
// `(override ?? HAND_SIZE) + delta` writer (the villainEffectAddNextHandSize /
// Savage Land Mutates D-24352 precedent), so two next-hand bonuses in one turn
// stack rather than clobber. Named, not inlined, so an audit can grep the number.
export const TREASURES_EXTRA_CARDS = 3;

// why: WP-691 / D-24508 — Whispers and Lies makes each OTHER player KO exactly two
// Bystanders from their Victory Pile; a player with fewer than two KOs all they
// have (clamped by the count present). The max per other player.
export const WHISPERS_BYSTANDER_KO = 2;

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
      // why: WP-682 / D-24499 — gainWoundForPlayer chokepoint so a tactic-Fight Wound
      // reaches a Diving-Block holder (possibly a NON-active seat) via the WP-684 wave.
      // undefined return = supply empty this iteration → stop early (moves never throw).
      const gainedWoundId = gainWoundForPlayer(G, playerId);
      if (gainedWoundId === undefined) {
        break;
      }
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
 * @param shuffleContext - Carries `random.Shuffle` for any resolver that draws
 *   (HYDRA Conspiracy). The bare `ctx` has no `random` (the D-24051 hazard the
 *   dodgeCard comment records), so the caller passes its full move context.
 */
/**
 * Counts villains of one group in a player's Victory Pile.
 *
 * Matches on the anchored ext_id prefix `${setAbbr}-villain-${group}-`, the same
 * convention `victoryPileHasOtherGroupVillain` uses for Viper's
 * gain-wound-unless-victory-villain-group predicate (D-24299 Path B) - derived
 * from the id grammar rather than a villain-group `G` map, because a new hashed
 * setup field would re-pin every committed fixture. The anchored full prefix
 * avoids false-matching villain-deck bystanders (`bystander-villain-deck-NN`).
 *
 * @param victory - The player's victory pile (read-only).
 * @param groupPrefix - The anchored `${setAbbr}-villain-${group}-` prefix.
 * @returns How many victory-pile cards belong to that villain group.
 */
function countVictoryPileGroupVillains(
  victory: readonly CardExtId[],
  groupPrefix: string,
): number {
  // why: explicit loop, not .reduce() - effect application counts as rule work
  // (.claude/rules/code-style.md Patterns to Avoid).
  let total = 0;
  for (const victoryId of victory) {
    if (victoryId.startsWith(groupPrefix)) {
      total = total + 1;
    }
  }
  return total;
}

/**
 * Resolves Red Skull's "Negablast Grenades": the defeating player gets +3 Attack.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The defeating player id.
 */
export function resolveNegablastGrenades(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  G.turnEconomy = addResources(G.turnEconomy, NEGABLAST_GRENADES_ATTACK, 0);
  // why: WP-567 / D-24376 section 1 - a resolver that mutates SILENTLY is the
  // other half of this packet's defect: before it, defeating a Red Skull tactic
  // changed the economy nowhere the player could see. `applied` is the
  // LOG_OUTCOMES colour for a realized effect (WP-434).
  pushLog(G,
    `Fight effect: Player ${currentPlayer} gained +${NEGABLAST_GRENADES_ATTACK} attack (Negablast Grenades).`,
    'applied',
  );
}

/**
 * Resolves Red Skull's "Endless Resources": the defeating player gets +4 Recruit.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The defeating player id.
 */
export function resolveEndlessResources(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  G.turnEconomy = addResources(G.turnEconomy, 0, ENDLESS_RESOURCES_RECRUIT);
  pushLog(G,
    `Fight effect: Player ${currentPlayer} gained +${ENDLESS_RESOURCES_RECRUIT} recruit (Endless Resources).`,
    'applied',
  );
}

/**
 * Resolves Red Skull's "HYDRA Conspiracy": draw two cards, then one more for each
 * HYDRA Villain in the defeating player's Victory Pile.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The defeating player id.
 * @param defeatedTacticId - The tactic's ext_id, used to derive the set prefix.
 * @param shuffleContext - Carries `random.Shuffle` for the empty-deck reshuffle.
 */
export function resolveHydraConspiracy(
  G: LegendaryGameState,
  currentPlayer: string,
  defeatedTacticId: CardExtId,
  shuffleContext: ShuffleProvider,
): void {
  const playerZones = G.playerZones[currentPlayer];
  if (!playerZones) {
    return;
  }

  // why: the group prefix is derived from the TACTIC's own ext_id so the set
  // segment travels with the card rather than being hardcoded - a reprint of Red
  // Skull in another set resolves against that set's HYDRA villains.
  // `-mastermind-` is the unambiguous infix (setAbbr contains no hyphen).
  const mastermindInfix = '-mastermind-';
  const infixIndex = defeatedTacticId.indexOf(mastermindInfix);
  const setAbbr = infixIndex < 0 ? '' : defeatedTacticId.slice(0, infixIndex);
  const groupPrefix = `${setAbbr}-villain-${HYDRA_VILLAIN_GROUP}-`;

  // why: the count is scoped to the DEFEATING player's victory pile only - the
  // printed text reads "in your Victory Pile". Counting every player's would
  // inflate the draw at 2+ seats, which a solo-only test would never surface.
  const hydraVillains = countVictoryPileGroupVillains(playerZones.victory, groupPrefix);
  const cardsToDraw = HYDRA_CONSPIRACY_BASE_DRAW + hydraVillains;
  const handBefore = playerZones.hand.length;

  drawCardsIntoHand(playerZones, cardsToDraw, shuffleContext);

  // why: report what was actually DRAWN, not what was requested -
  // drawCardsIntoHand stops early when deck AND discard are both empty, and a log
  // line claiming an undelivered draw is the misattribution class this arc exists
  // to remove.
  const drawn = playerZones.hand.length - handBefore;
  pushLog(G,
    `Fight effect: Player ${currentPlayer} drew ${drawn} card(s) - ${HYDRA_CONSPIRACY_BASE_DRAW} plus ${hydraVillains} HYDRA Villain(s) in their Victory Pile (HYDRA Conspiracy).`,
    'applied',
  );
}

/**
 * Resolves Dr. Doom's "Treasures of Latveria" tactic Fight effect: the defeating
 * player draws THREE EXTRA cards in their next hand.
 *
 * ADDITIVE (base fill + 3), not a set-to-N: it reuses the WP-497-owned shared
 * `G.handSizeOverrides[currentPlayer]` via the `(override ?? HAND_SIZE) + delta`
 * writer (the villainEffectAddNextHandSize / Savage Land Mutates D-24352
 * precedent), so a second next-hand bonus in the same turn accumulates on the
 * absolute base rather than clobbering it. Adds NO new `G` field and NO second
 * consumption site — game.ts's play-phase `onBegin` fill consumes and clears it.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (the beneficiary).
 */
export function resolveTreasuresOfLatveria(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  // why: "draw a new hand of cards at the end of this turn" ≡ this player's NEXT
  // play-phase `onBegin` fill (this engine has no end-of-turn cleanup draw). Lazy-
  // create the WP-497 container before the first per-player write — it is absent by
  // default (never seeded in Game.setup), and index-assigning undefined would throw.
  if (G.handSizeOverrides === undefined) {
    G.handSizeOverrides = {};
  }
  const nextHandSize =
    (G.handSizeOverrides[currentPlayer] ?? HAND_SIZE) + TREASURES_EXTRA_CARDS;
  G.handSizeOverrides[currentPlayer] = nextHandSize;
  pushLog(G,
    `Fight effect: Player ${currentPlayer} will draw ${String(nextHandSize)} cards on their next hand (+${String(TREASURES_EXTRA_CARDS)} extra, Treasures of Latveria).`,
    'applied',
  );
}

/**
 * Counts the acting player's in-play Heroes on the X-Men team — Xavier's Nemesis's
 * "for each of your [team:x-men] Heroes" scan.
 *
 * Reads effective team membership via `cardHasTeamWhenPlayed` (printed
 * `G.cardTraits.team` OR a Copy-Powers granted team), so a Rogue Copy Powers card
 * that copied an X-Men Hero counts, matching the printed team faithfully rather
 * than reading `cardTraits.team` directly.
 *
 * @param G - The game state (read-only here).
 * @param inPlay - The acting player's in-play zone, in order.
 * @returns How many in-play cards count as team `x-men`.
 */
function countInPlayXMenHeroes(
  G: LegendaryGameState,
  inPlay: readonly CardExtId[],
): number {
  // why: explicit loop, not .reduce() — effect application counts as rule work
  // (.claude/rules/code-style.md Patterns to Avoid).
  let total = 0;
  for (const cardExtId of inPlay) {
    if (cardHasTeamWhenPlayed(G, cardExtId, TEAM_X_MEN)) {
      total = total + 1;
    }
  }
  return total;
}

/**
 * Resolves core Magneto's "Xavier's Nemesis" tactic Fight effect: "For each of
 * your [team:x-men] Heroes, rescue a Bystander."
 *
 * Rescues one Bystander from the shared supply (`G.piles.bystanders`, top-of-pile
 * per D-21501) into the defeating player's Victory Pile, once per in-play X-Men
 * Hero. Zero X-Men Heroes rescues nothing; an empty supply stops early. Mutates
 * `G.piles.bystanders` and the player's victory zone via `moveCardFromZone`; never
 * throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (the beneficiary).
 */
export function resolveXaviersNemesis(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  const playerZones = G.playerZones[currentPlayer];
  if (!playerZones) {
    return;
  }

  const xMenCount = countInPlayXMenHeroes(G, playerZones.inPlay);
  let rescuedCount = 0;
  for (let rescueIndex = 0; rescueIndex < xMenCount; rescueIndex++) {
    // why: top-of-pile convention — bystanders[0] is the next available supply
    // Bystander (D-21501), mirroring the hero-ability rescue in heroEffects.
    const topBystander = G.piles.bystanders[0];
    if (topBystander === undefined) {
      // why: empty supply is a legitimate no-op — stop early, never throw.
      break;
    }
    const moveResult = moveCardFromZone(
      G.piles.bystanders,
      playerZones.victory,
      topBystander,
    );
    G.piles.bystanders = moveResult.from;
    playerZones.victory = moveResult.to;
    rescuedCount += 1;
  }

  pushLog(G,
    `Fight effect: Player ${currentPlayer} rescued ${String(rescuedCount)} Bystander(s) — one per in-play X-Men Hero (Xavier's Nemesis).`,
    'applied',
  );
}

/**
 * Whether a Victory-Pile card is a Bystander — the two-arm predicate (a supply
 * Bystander OR a rescued villain-deck Bystander), mirroring
 * `countBystandersInVictory` in heroConditions.evaluate.ts.
 *
 * @param cardExtId - A card ext_id from a player's Victory Pile.
 * @returns Whether the card is a Bystander.
 */
function isVictoryPileBystander(cardExtId: CardExtId): boolean {
  return (
    cardExtId === BYSTANDER_EXT_ID ||
    cardExtId.startsWith('bystander-villain-deck-')
  );
}

/**
 * Resolves Loki's "Whispers and Lies" tactic Fight effect: "Each other player KOs
 * two Bystanders from their Victory Pile."
 *
 * For every player EXCEPT the defeating player (sorted id order), removes up to
 * `WHISPERS_BYSTANDER_KO` (2) Bystanders from their Victory Pile to the global KO
 * pile (`G.ko`); a player with fewer than two KOs all they have. Mutates each
 * penalized player's victory zone and `G.ko`; never throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic. Skipped — the effect
 *   targets the OTHER players ("each other player").
 */
export function resolveWhispersAndLies(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  const playerIds = Object.keys(G.playerZones).sort();

  for (const playerId of playerIds) {
    // why: "each OTHER player" — a tactic Fight penalizes the defeater's opponents,
    // not the defeater. Skip currentPlayer entirely (the most common Whispers bug).
    if (playerId === currentPlayer) {
      continue;
    }

    const playerZones = G.playerZones[playerId]!;
    let koedCount = 0;
    for (let koIndex = 0; koIndex < WHISPERS_BYSTANDER_KO; koIndex++) {
      // why: rescan each pass — the pile shrinks as bystanders leave; find the
      // first remaining Bystander (supply or rescued villain-deck) to KO.
      let bystanderToKo: CardExtId | undefined = undefined;
      for (const cardExtId of playerZones.victory) {
        if (isVictoryPileBystander(cardExtId)) {
          bystanderToKo = cardExtId;
          break;
        }
      }
      if (bystanderToKo === undefined) {
        // why: fewer than two Bystanders present → KO what they have and stop.
        break;
      }
      const moveResult = moveCardFromZone(
        playerZones.victory,
        G.ko,
        bystanderToKo,
      );
      playerZones.victory = moveResult.from;
      G.ko = moveResult.to;
      koedCount += 1;
    }

    pushLog(G,
      `Fight effect: Player ${playerId} KO'd ${String(koedCount)} Bystander(s) from their Victory Pile (Whispers and Lies).`,
      'applied',
    );
  }
}

export function dispatchTacticOnFight(
  G: LegendaryGameState,
  ctx: unknown,
  defeatedTacticId: CardExtId,
  shuffleContext: ShuffleProvider,
): void {
  // why: narrow the unknown ctx to the one field this dispatch reads (the
  // defeating player), mirroring defeatMastermindTacticCore - no framework import.
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
  if (defeatedTacticId === RED_SKULL_NEGABLAST_GRENADES_TACTIC_ID) {
    resolveNegablastGrenades(G, currentPlayer);
    return;
  }
  if (defeatedTacticId === RED_SKULL_ENDLESS_RESOURCES_TACTIC_ID) {
    resolveEndlessResources(G, currentPlayer);
    return;
  }
  if (defeatedTacticId === RED_SKULL_HYDRA_CONSPIRACY_TACTIC_ID) {
    resolveHydraConspiracy(G, currentPlayer, defeatedTacticId, shuffleContext);
    return;
  }
  // why: WP-691 / D-24508 — Dr. Doom's Treasures of Latveria: +3 additive to the
  // defeating player's next-hand fill (no player choice).
  if (defeatedTacticId === DR_DOOM_TREASURES_OF_LATVERIA_TACTIC_ID) {
    resolveTreasuresOfLatveria(G, currentPlayer);
    return;
  }
  // why: WP-691 / D-24508 — Magneto's Xavier's Nemesis: rescue one Bystander per
  // in-play X-Men Hero of the defeating player (no player choice).
  if (defeatedTacticId === MAGNETO_XAVIERS_NEMESIS_TACTIC_ID) {
    resolveXaviersNemesis(G, currentPlayer);
    return;
  }
  // why: WP-691 / D-24508 — Loki's Whispers and Lies: each OTHER player KOs two
  // Victory-Pile Bystanders (no player choice; skips currentPlayer).
  if (defeatedTacticId === LOKI_WHISPERS_AND_LIES_TACTIC_ID) {
    resolveWhispersAndLies(G, currentPlayer);
    return;
  }
}
