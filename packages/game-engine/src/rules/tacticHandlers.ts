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

import type {
  LegendaryGameState,
  PendingGiveHqHeroChoice,
  GiveHqHeroFilter,
  PendingDefeatChoice,
  PendingKoDiscardChoice,
  RuthlessDictatorDisposition,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { pushLog } from '../log/logPush.js';
// why: WP-693 / D-24510 — Cruel Ruler reuses the shared free-defeat family (WP-486/682):
// buildCityVillainDefeatTargets builds its all-City-Villain snapshot and
// dispatchDefeatWithBystanderTarget performs the free defeat for the exactly-1 auto path.
// defeatChoice.resolve.ts imports boardgame.io as TYPES ONLY, so this stays a pure helper.
import {
  buildCityVillainDefeatTargets,
  dispatchDefeatWithBystanderTarget,
} from '../moves/defeatChoice.resolve.js';
import { formatCardRef } from '../log/logDisplay.js';
import { gainWoundForPlayer } from '../board/wounds.logic.js';
import { addResources } from '../economy/economy.logic.js';
import { drawCardsIntoHand, HAND_SIZE } from '../moves/drawCards.logic.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import { cardHasTeamWhenPlayed } from '../hero/effectiveTeams.logic.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { refillHqSlot } from '../board/city.logic.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
// why: WP-694 / D-24511 — the two multi-seat tactics PARK a WP-684 pending seat choice.
// parkSeatChoice is the foundational park entry; the mode/KO builders are pure (from the
// no-cycle seatChoiceTactics module). tacticHandlers imports these one-directionally;
// seatChoice.resolve.ts never imports tacticHandlers (no cycle).
import { parkSeatChoice } from '../moves/seatChoice.resolve.js';
import {
  buildMonarchsDecreeModeChoice,
  buildVanishingIllusionsChoice,
} from '../moves/seatChoiceTactics.js';

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

// why: WP-695 / D-24512 - Red Skull's FOURTH tactic, "Ruthless Dictator", is now
// dispatched (resolveRuthlessDictator below). WP-567 deferred it because its printed
// text ("Look at the top three cards of your deck. KO one, discard one and put one
// back on top") is INTERACTIVE, and a parked choice shipped without its UIState
// projection and prompt HARD-FREEZES the human player. THIS packet ships the resolver
// together with the five-step UIState projection, the arena-client prompt, and the bot
// legalMoves enumeration mirror, so the deferral is discharged. See its constant +
// dispatch branch below and RED_SKULL_RUTHLESS_DICTATOR_TACTIC_ID.

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

// why: WP-696 / D-24513 — core Dr. Doom's "Secrets of Time Travel" tactic ext_id,
// same `${setAbbr}-mastermind-${slug}-${tacticSlug}` grammar as the constants above
// (mastermind slug `dr-doom`, tactic slug `secrets-of-time-travel`; printed "Fight:
// Take another turn after this one." in data/cards/core.json). This resolver is the
// arc's only novel mechanic — the extra-turn primitive.
const SECRETS_OF_TIME_TRAVEL_TACTIC_ID: CardExtId =
  'core-mastermind-dr-doom-secrets-of-time-travel';

// why: WP-692 / D-24509 — Dr. Doom's "Dark Technology" tactic ext_id, same grammar
// as the constants above. Printed Fight: "You may recruit a [hc:tech] or [hc:ranged]
// Hero from the HQ for free." (data/cards/core.json).
const DARK_TECHNOLOGY_TACTIC_ID: CardExtId =
  'core-mastermind-dr-doom-dark-technology';

// why: WP-692 / D-24509 — Magneto's "Bitter Captor" tactic ext_id. Printed Fight:
// "Recruit a [team:x-men] Hero from the HQ for free." (data/cards/core.json).
const BITTER_CAPTOR_TACTIC_ID: CardExtId =
  'core-mastermind-magneto-bitter-captor';

// why: WP-692 / D-24509 — Dark Technology's filter reads the HQ Heroes' heroClass
// trait; the printed text lists BOTH tech and ranged (OR semantics on the value list).
const DARK_TECHNOLOGY_FILTER: GiveHqHeroFilter = {
  kind: 'hero-class',
  values: ['tech', 'ranged'],
};

// why: WP-692 / D-24509 — Bitter Captor's filter reads the HQ Heroes' team trait for
// the single x-men value. Same normalized slug as TEAM_X_MEN above.
const BITTER_CAPTOR_FILTER: GiveHqHeroFilter = {
  kind: 'team',
  values: [TEAM_X_MEN],
};

// why: WP-694 / D-24511 — the two multi-seat "each other player chooses" core mastermind
// tactic ext_ids, same `${setAbbr}-mastermind-${mastermindSlug}-${tacticSlug}` grammar as
// the constants above. Each names the PRINTED Fight text (data/cards/core.json) the resolver
// parks a WP-684 pending seat choice for:
//   Monarch's Decree     "Choose one: each other player draws a card OR each other player
//                         discards a card." (Dr. Doom)
//   Vanishing Illusions  "Each other player KOs a Villain from their Victory Pile." (Loki)
const MONARCHS_DECREE_TACTIC_ID: CardExtId =
  'core-mastermind-dr-doom-monarchs-decree';
const VANISHING_ILLUSIONS_TACTIC_ID: CardExtId =
  'core-mastermind-loki-vanishing-illusions';

/**
 * The minimal boardgame.io events surface the two multi-seat tactic resolvers thread into
 * parkSeatChoice (for the setActivePlayers stage ride that admits the non-active seats).
 *
 * // why: WP-694 / D-24511 — narrowed via a structural type (mirroring seatChoice.resolve.ts's
 * SeatChoiceEvents) so this module needs no boardgame.io import. Optional so a unit/replay
 * context without a live framework parks on G and resolves directly.
 */
interface TacticSeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

// why: WP-693 / D-24510 — core Loki's "Cruel Ruler" tactic ext_id, same
// `${setAbbr}-mastermind-${slug}-${tacticSlug}` grammar as the constants above
// (mastermind slug `loki`, tactic slug `cruel-ruler` in data/cards/core.json).
// Printed Fight: "Defeat a Villain in the City for free."
const LOKI_CRUEL_RULER_TACTIC_ID: CardExtId =
  'core-mastermind-loki-cruel-ruler';

// why: WP-693 / D-24510 — core Loki's "Maniacal Tyrant" tactic ext_id, same grammar
// as the constant above (tactic slug `maniacal-tyrant`). Printed Fight: "KO up to
// four cards from your discard pile."
const LOKI_MANIACAL_TYRANT_TACTIC_ID: CardExtId =
  'core-mastermind-loki-maniacal-tyrant';

// why: WP-693 / D-24510 — the printed "up to FOUR cards" cap of Maniacal Tyrant. It is
// the maximum the player may KO; 0 is a legal choice ("up to"), and the effective cap is
// clamped by the discard size at resolve. Named, not inlined, so an audit can grep it.
export const MANIACAL_TYRANT_KO_MAX = 4;

// why: WP-695 / D-24512 — core Red Skull's FOURTH tactic, "Ruthless Dictator", now
// dispatched (the WP-567 deferral above ships in THIS packet with its UIState
// projection + prompt + bot enumeration). Same
// `${setAbbr}-mastermind-${slug}-${tacticSlug}` grammar. Printed Fight: "Look at the
// top three cards of your deck. KO one, discard one and put one back on top of your
// deck." (data/cards/core.json), read from the card text rather than the known-
// divergent keyword blurb.
const RED_SKULL_RUTHLESS_DICTATOR_TACTIC_ID: CardExtId =
  'core-mastermind-red-skull-ruthless-dictator';

// why: WP-695 / D-24512 — core Magneto's "Electromagnetic Bubble" tactic ext_id, same
// grammar. Printed Fight: "Choose one of your [team:x-men] Heroes. When you draw a new
// hand of cards at the end of this turn, add that Hero to your hand as a seventh card."
// (data/cards/core.json).
const MAGNETO_ELECTROMAGNETIC_BUBBLE_TACTIC_ID: CardExtId =
  'core-mastermind-magneto-electromagnetic-bubble';

// why: WP-695 / D-24512 — Ruthless Dictator looks at the top THREE cards; named, not
// inlined, so an audit can grep the number against the printed text.
export const RUTHLESS_DICTATOR_LOOK_COUNT = 3;

// why: WP-695 / D-24512 — the LOCKED <3-card disposition priority (D-24512): with fewer
// than three cards, apply dispositions in printed order KO → discard → top to as many
// cards as exist (a card with no remaining slot stays on top; NEVER reshuffle, no
// `ctx.random.*` — the rulebook "look at" never shuffles). With 3 cards this yields
// exactly one KO, one discard, one top. The park slices this to the revealed count.
const RUTHLESS_DICTATOR_DISPOSITION_PRIORITY: readonly RuthlessDictatorDisposition[] = [
  'ko',
  'discard',
  'top',
];

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
 * @param events - The move's boardgame.io events (WP-694 / D-24511), threaded so the
 *   two multi-seat tactics can park a WP-684 seat choice (the setActivePlayers stage ride
 *   that admits the non-active seats). Optional — a unit/replay context omits it and the
 *   parked choice resolves directly against G.
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
 * Resolves core Dr. Doom's "Secrets of Time Travel" tactic Fight effect:
 * "Take another turn after this one."
 *
 * Increments the defeating player's queued extra-turn counter by one. The counter
 * is honored at that player's next turn-end (advanceTurnStage / the endTurn move /
 * the sim / PAR / replay harnesses), which grants the SAME seat a fresh full turn
 * via boardgame.io `events.endTurn({ next })`. It **increments** rather than
 * setting to 1 so two extra-turn grants in one turn STACK into two consecutive
 * extra turns (a future set, or two such tactics defeated together) — the natural
 * faithful reading. `G.extraTurns` is lazily created here and never seeded in
 * buildInitialGameState, keeping untriggered games byte-identical (WP-696 / D-24513).
 * Mutates `G` directly; never throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (the beneficiary).
 */
export function resolveSecretsOfTimeTravel(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  // why: lazy-create the container before the first per-player write — the field is
  // absent by default (never seeded in Game.setup), and index-assigning on an
  // undefined value would throw. Mirrors resolveOctetOfValenceElectrons' pattern.
  if (G.extraTurns === undefined) {
    G.extraTurns = {};
  }
  // why: `+= 1` (INCREMENT), not set-to-1, so stacked grants queue multiple extra
  // turns rather than collapsing to one (WP-696 / D-24513 stacking contract).
  G.extraTurns[currentPlayer] = (G.extraTurns[currentPlayer] ?? 0) + 1;
  pushLog(G,
    `Fight effect: Player ${currentPlayer} will take another turn after this one (Secrets of Time Travel).`,
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


/**
 * Whether an HQ Hero satisfies a free-recruit trait filter (WP-692 / D-24509).
 *
 * OR semantics over `filter.values`, read from the setup-time `G.cardTraits` snapshot
 * (Dark Technology: `hero-class` ∈ {tech, ranged}; Bitter Captor: `team` === x-men). A
 * missing traits map / entry matches nothing rather than throwing. This mirrors the
 * `hqHeroMatchesFilter` predicate in giveHqHeroChoice.resolve.ts — duplicated at the
 * park site so this module can count eligible HQ Heroes without importing a move
 * internal (duplicate-first: the two live in different modules and read the same
 * `cardTraits`; a shared predicate is extracted if a third copy appears).
 *
 * @param G - The game state (read-only; supplies `cardTraits`).
 * @param cardId - The HQ Hero ext_id to test.
 * @param filter - The eligibility predicate.
 * @returns true when the Hero is eligible under the filter.
 */
function hqHeroMatchesFreeRecruitFilter(
  G: LegendaryGameState,
  cardId: CardExtId,
  filter: GiveHqHeroFilter,
): boolean {
  const trait = G.cardTraits?.[cardId];
  if (trait === undefined) {
    return false;
  }
  for (const value of filter.values) {
    if (filter.kind === 'team') {
      if (trait.team === value) {
        return true;
      }
    } else {
      // why: the kind union is closed to 'team' | 'hero-class', so the else branch is
      // 'hero-class' — total without a default (mirrors cardTraitMatches).
      if (trait.heroClass === value) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Collects the HQ slot indices whose occupant satisfies the free-recruit filter,
 * in ascending slot order (WP-692 / D-24509).
 *
 * @param G - The game state (read-only; supplies `G.hq` + `cardTraits`).
 * @param filter - The eligibility predicate.
 * @returns The eligible HQ slot indices in ascending order.
 */
function collectEligibleHqIndices(
  G: LegendaryGameState,
  filter: GiveHqHeroFilter,
): number[] {
  const indices: number[] = [];
  for (let hqIndex = 0; hqIndex < G.hq.length; hqIndex++) {
    const slot = G.hq[hqIndex];
    if (slot !== null && slot !== undefined && hqHeroMatchesFreeRecruitFilter(G, slot, filter)) {
      indices.push(hqIndex);
    }
  }
  return indices;
}

/**
 * Gains the HQ Hero at `hqIndex` to `playerId`'s discard for FREE — the forced
 * single-eligible free-recruit path (WP-692 / D-24509).
 *
 * @param G - Game state (mutated: `G.hq`, `G.heroDeck`, the recipient's discard).
 * @param playerId - The recipient whose discard the Hero enters.
 * @param hqIndex - The HQ slot to take (expected to hold a non-null Hero).
 * @returns The gained Hero ext_id, or null when the slot was empty.
 */
function gainHqHeroFree(
  G: LegendaryGameState,
  playerId: string,
  hqIndex: number,
): CardExtId | null {
  const heroId = G.hq[hqIndex];
  if (heroId === null || heroId === undefined) {
    return null;
  }
  // why: WP-692 / D-24509 — FREE recruit: vacate the slot + refill from G.heroDeck via
  // refillHqSlot, but NEVER read or spend `turnEconomy.recruit` (the whole point of the
  // "for free" tactics vs the normal cost-paying recruit path). D-24327 — the gain routes
  // to the recipient's DISCARD, never the victory pile.
  G.hq[hqIndex] = null;
  const refillResult = refillHqSlot(G.hq, hqIndex, G.heroDeck);
  G.hq = refillResult.hq;
  G.heroDeck = refillResult.heroDeck;
  const zones = G.playerZones[playerId];
  if (zones) {
    zones.discard.push(heroId);
  }
  return heroId;
}

/**
 * Shared filtered-free-recruit-from-HQ mechanic for the two core mastermind tactics
 * (WP-692 / D-24509): the defeating player recruits an eligible HQ Hero for free.
 *
 * Cardinality (EC-729 locked): 0 eligible → no-op; when `optional` (Dark Technology's
 * "may") → always park an active pending choice so the player picks or declines, even
 * for a single eligible Hero; when mandatory (Bitter Captor) → exactly 1 eligible
 * auto-gains (the pick is forced), ≥ 2 parks. Parking reuses the give-hq-hero pending
 * queue + resolve move + block-all + projection + renderer (the sim-enrolled sibling),
 * carrying the trait `filter` and the `optional` flag on the entry. Free recruit spends
 * NO `turnEconomy.recruit`. Never throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The defeating (recruiting) player id.
 * @param filter - The eligibility predicate (heroClass or team).
 * @param optional - true for Dark Technology's "may" (decline allowed); false for Bitter Captor.
 * @param tacticName - The printed tactic name, for the self-narrated log lines.
 */
function freeRecruitFromHqByFilter(
  G: LegendaryGameState,
  currentPlayer: string,
  filter: GiveHqHeroFilter,
  optional: boolean,
  tacticName: string,
): void {
  const eligibleIndices = collectEligibleHqIndices(G, filter);

  if (eligibleIndices.length === 0) {
    // why: no HQ Hero matches the filter — a reachable no-op (never a hollow record).
    pushLog(G, `Fight effect: no eligible Hero in the HQ to recruit (${tacticName}); no effect.`, 'blocked');
    return;
  }

  if (!optional && eligibleIndices.length === 1) {
    // why: EC-729 — a mandatory tactic (Bitter Captor) with exactly one eligible Hero is a
    // FORCED gain, so auto-resolve it now (no prompt); the parked path would offer a
    // one-option pick with no decline, which is just ceremony.
    const gainedId = gainHqHeroFree(G, currentPlayer, eligibleIndices[0]!);
    if (gainedId !== null) {
      pushLog(G,
        `Fight effect: Player ${currentPlayer} recruited ${formatCardRef(G.cardDisplayData, gainedId)} from the HQ for free (${tacticName}).`,
        'applied',
      );
    }
    return;
  }

  // why: EC-729 — park an active pending choice on the give-hq-hero queue. optional ≥ 1 or
  // mandatory ≥ 2 both prompt. Lazily create the FIFO queue at the park site (never in
  // Game.setup) so an untriggered match leaves the field undefined and the hash oracles stay
  // stable. The block-all guard + resolveGiveHqHeroChoice (both already sim-enrolled) freeze
  // the board until the current player resolves.
  if (!G.pendingGiveHqHeroChoices) {
    G.pendingGiveHqHeroChoices = [];
  }
  const entry: PendingGiveHqHeroChoice = {
    choiceType: 'give-hq-hero',
    playerID: currentPlayer,
    filter,
    ...(optional ? { optional: true } : {}),
  };
  G.pendingGiveHqHeroChoices.push(entry);
  const declineHint = optional ? ' (or decline)' : '';
  pushLog(G,
    `Fight effect: Player ${currentPlayer} — recruit an eligible Hero from the HQ for free${declineHint} (${tacticName}).`,
    'neutral',
  );
}

/**
 * Resolves Dr. Doom's "Dark Technology" tactic Fight effect: the defeating player
 * MAY recruit a tech or ranged Hero from the HQ for free (WP-692 / D-24509).
 *
 * // why: optional ("may") — the player can decline (a clean no-op) via the parked
 * choice's decline arm, so this ALWAYS parks when ≥ 1 eligible Hero exists.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The defeating (recruiting) player id.
 */
export function resolveDarkTechnology(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  freeRecruitFromHqByFilter(G, currentPlayer, DARK_TECHNOLOGY_FILTER, true, 'Dark Technology');
}

/**
 * Resolves Magneto's "Bitter Captor" tactic Fight effect: the defeating player
 * recruits an X-Men Hero from the HQ for free (WP-692 / D-24509).
 *
 * // why: mandatory (no "may") — 0 eligible is a no-op, exactly 1 auto-gains, ≥ 2
 * parks a pick with no decline arm.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The defeating (recruiting) player id.
 */
export function resolveBitterCaptor(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  freeRecruitFromHqByFilter(G, currentPlayer, BITTER_CAPTOR_FILTER, false, 'Bitter Captor');
}

/**
 * Resolves core Dr. Doom's "Monarch's Decree" tactic Fight effect: "Choose one: each
 * other player draws a card OR each other player discards a card."
 *
 * Parks a WP-684 active single-seat draw-vs-discard mode choice addressed to the
 * defeating player only. On "draw" (option 0) each other player draws one card
 * deterministically inside the mode apply; on "discard" (option 1) the resolve move
 * chains a simultaneous multi-seat discard for every other seat holding a card.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events (for the stage-ride admission); optional
 *   so a unit/replay context parks on G and resolves directly.
 * @param currentPlayer - The player who defeated the tactic (the sole addressed seat).
 */
export function resolveMonarchsDecree(
  G: LegendaryGameState,
  events: TacticSeatChoiceEvents | undefined,
  currentPlayer: string,
): void {
  const modeChoice = buildMonarchsDecreeModeChoice(currentPlayer);
  parkSeatChoice(G, events, modeChoice);
  pushLog(G,
    `Fight effect: Player ${currentPlayer} must choose — each other player draws a card, or each other player discards a card (Monarch's Decree).`,
    'neutral',
  );
}

/**
 * Resolves core Loki's "Vanishing Illusions" tactic Fight effect: "Each other player
 * KOs a Villain from their Victory Pile."
 *
 * Parks a WP-684 simultaneous multi-seat KO choice addressed to every OTHER seat holding
 * ≥1 Victory-Pile Villain (one option per Villain); each addressed seat's chosen Villain
 * moves to the top-level KO pile (G.ko) atomically. A seat with no Victory-Pile Villain is
 * not addressed (no-op); when no other seat qualifies, nothing is parked.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events (for the stage-ride admission); optional
 *   so a unit/replay context parks on G and resolves directly.
 * @param currentPlayer - The player who defeated the tactic. Skipped — the effect targets
 *   the OTHER players ("each other player").
 */
export function resolveVanishingIllusions(
  G: LegendaryGameState,
  events: TacticSeatChoiceEvents | undefined,
  currentPlayer: string,
): void {
  // why: "each OTHER player" — a tactic Fight penalizes the defeater's opponents, not the
  // defeater. Enumerate every seat except currentPlayer in ascending id order (deterministic).
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== currentPlayer)
    .sort();
  const koChoice = buildVanishingIllusionsChoice(G, otherSeats);
  if (koChoice === undefined) {
    // why: no other seat holds a Victory-Pile Villain — a clean no-op (moves never throw).
    pushLog(G,
      `Fight effect: no other player had a Villain in their Victory Pile to KO (Vanishing Illusions).`,
      'neutral',
    );
    return;
  }
  parkSeatChoice(G, events, koChoice);
  pushLog(G,
    `Fight effect: each other player must KO a Villain from their Victory Pile (Vanishing Illusions).`,
    'neutral',
  );
}

/**
 * Resolves core Loki's "Cruel Ruler" tactic Fight effect: "Defeat a Villain in the
 * City for free" (WP-693 / D-24510).
 *
 * The active player defeats a chosen City Villain for free (no attack spent, no
 * acted-this-turn flag, Bystanders + captured Heroes rescued, its onFight fired) via
 * the shared free-defeat family (WP-486/682). Cardinality:
 *   0 City Villains → silent no-op;
 *   1 → auto-defeat it directly via dispatchDefeatWithBystanderTarget (no prompt);
 *   ≥2 → park a PendingDefeatChoice (choiceType 'cruel-ruler') for the active player.
 *
 * @param G - The game state, mutated in place.
 * @param ctx - The bare boardgame.io ctx (only `currentPlayer` is read), forwarded to
 *   the shared free-defeat core; typed `unknown` to avoid a framework import.
 * @param currentPlayer - The player who defeated the tactic (the free-defeat chooser).
 * @param shuffleContext - ShuffleProvider ({ random }) for a defeated villain's Fight scry reshuffle.
 */
export function resolveCruelRuler(
  G: LegendaryGameState,
  ctx: unknown,
  currentPlayer: string,
  shuffleContext: ShuffleProvider,
): void {
  const targets = buildCityVillainDefeatTargets(G);

  if (targets.length === 0) {
    // why: no Villain in the City is a reachable no-op (never a hollow record).
    pushLog(G, 'Fight effect: no Villain in the City to defeat for free (Cruel Ruler); no effect.', 'blocked');
    return;
  }

  if (targets.length === 1) {
    // why: exactly one City Villain is a FORCED free defeat — auto-resolve it now
    // (no prompt), mirroring the exactly-1 auto path of the shared free-defeat family.
    dispatchDefeatWithBystanderTarget(G, ctx, targets[0]!, shuffleContext);
    return;
  }

  // why: ≥2 City Villains — park an ACTIVE-player pending choice on the shared
  // defeat-choice queue with the 'cruel-ruler' discriminant. Lazily create the FIFO queue
  // at the park site (never in Game.setup) so an untriggered match leaves the field
  // undefined and the hash oracles stay byte-stable. The block-all guard + resolveDefeatChoice
  // (both already sim-enrolled) freeze the board until the active player picks a target.
  if (!G.pendingDefeatChoices) {
    G.pendingDefeatChoices = [];
  }
  const entry: PendingDefeatChoice = {
    choiceType: 'cruel-ruler',
    playerID: currentPlayer,
    targets,
  };
  G.pendingDefeatChoices.push(entry);
  pushLog(G,
    `Fight effect: Player ${currentPlayer} — choose a Villain in the City to defeat for free (Cruel Ruler).`,
    'neutral',
  );
}

/**
 * Resolves core Loki's "Maniacal Tyrant" tactic Fight effect: "KO up to four cards
 * from your discard pile" (WP-693 / D-24510).
 *
 * The active player may optionally KO 0..4 cards from their OWN discard into the global
 * KO pile. Empty discard → silent no-op; otherwise parks a PendingKoDiscardChoice for
 * the active player (the resolve move performs the KO). This is a discard→KO removal, so
 * it fires NO return-on-discard reaction (that chokepoint, discardFromHand, is
 * hand→discard only).
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (the KO chooser).
 */
export function resolveManiacalTyrant(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  const playerZones = G.playerZones[currentPlayer];
  if (!playerZones) {
    return;
  }

  if (playerZones.discard.length === 0) {
    // why: an empty discard leaves nothing to KO — a reachable no-op (never hollow).
    pushLog(G, `Fight effect: Player ${currentPlayer} has an empty discard pile (Maniacal Tyrant); no effect.`, 'blocked');
    return;
  }

  // why: park an ACTIVE-player pending KO-from-discard choice. Lazily create the FIFO
  // queue at the park site (never in Game.setup) so an untriggered match leaves the field
  // undefined and the hash oracles stay byte-stable. The block-all guard + resolveKoDiscardChoice
  // freeze the board until the active player selects 0..4 of their own discard cards to KO.
  if (!G.pendingKoDiscardChoices) {
    G.pendingKoDiscardChoices = [];
  }
  const entry: PendingKoDiscardChoice = {
    choiceType: 'ko-from-discard',
    playerID: currentPlayer,
    maxCount: MANIACAL_TYRANT_KO_MAX,
  };
  G.pendingKoDiscardChoices.push(entry);
  pushLog(G,
    `Fight effect: Player ${currentPlayer} — KO up to ${String(MANIACAL_TYRANT_KO_MAX)} cards from your discard pile (Maniacal Tyrant).`,
    'neutral',
  );
}

/**
 * Resolves core Red Skull's "Ruthless Dictator" tactic Fight effect: "Look at the
 * top three cards of your deck. KO one, discard one and put one back on top of your
 * deck." (WP-695 / D-24512).
 *
 * Snapshots the top `min(3, deck.length)` of the DEFEATING player's deck and PARKS a
 * single PendingRuthlessDictatorChoice carrying that snapshot plus the disposition
 * slots available (the locked <3 priority KO → discard → top, sliced to the revealed
 * count). The individual dispositions (KO / discard / top) are applied — and logged —
 * by the resolve move. An empty deck is a logged no-op (no reshuffle: a look-at never
 * shuffles, so no `ctx.random.*`). Active-scoped (parks only for `currentPlayer`).
 * Mutates `G` directly; never throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (the chooser).
 */
export function resolveRuthlessDictator(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  const playerZones = G.playerZones[currentPlayer];
  if (!playerZones) {
    return;
  }

  const lookCount = Math.min(RUTHLESS_DICTATOR_LOOK_COUNT, playerZones.deck.length);
  if (lookCount === 0) {
    // why: an empty deck is a legitimate no-op — the printed text "looks at" the top,
    // and with nothing to look at there is no reshuffle (no `ctx.random.*`) and no park.
    pushLog(G,
      `Fight effect: Player ${currentPlayer}'s deck is empty — nothing to look at (Ruthless Dictator).`,
      'blocked',
    );
    return;
  }

  // why: snapshot the top `lookCount` ext_ids (slice returns a COPY — the projection /
  // resolve never aliases into playerZones.deck). availableDispositions is the locked
  // <3 priority sliced to the revealed count (D-24512): 3 → one of each; 2 → KO+discard;
  // 1 → KO only. Both arrays shrink as the resolve move dispositions each card.
  const revealedCardIds = playerZones.deck.slice(0, lookCount);
  const availableDispositions = RUTHLESS_DICTATOR_DISPOSITION_PRIORITY.slice(0, lookCount);

  if (G.pendingRuthlessDictatorChoices === undefined) {
    G.pendingRuthlessDictatorChoices = [];
  }
  G.pendingRuthlessDictatorChoices.push({
    choiceType: 'ruthless-dictator',
    playerID: currentPlayer,
    revealedCardIds,
    availableDispositions,
  });
  pushLog(G,
    `Fight effect: Player ${currentPlayer} looks at the top ${String(lookCount)} card(s) of their deck — assign KO / discard / top (Ruthless Dictator).`,
    'neutral',
  );
}

/**
 * Collects the acting player's in-play Heroes on the X-Men team — the Electromagnetic
 * Bubble eligibility scan.
 *
 * TEAM-ONLY match against the setup-time `G.cardTraits` snapshot (the WP-506 precedent:
 * only Heroes carry a team, so Wounds / Bystanders / the teamless basic S.H.I.E.L.D.
 * cards never false-match). Map-level defensive `?.` — a legacy state predating WP-179
 * leaves the map undefined and matches nothing rather than throwing. Do NOT add a
 * heroClass guard and do NOT drop the map-level `?.` (WP-695 non-negotiable).
 *
 * @param G - The game state (read-only here; supplies `cardTraits`).
 * @param inPlay - The acting player's in-play zone, in order.
 * @returns The in-play X-Men Hero ext_ids, in play order.
 */
function collectInPlayXMenHeroes(
  G: LegendaryGameState,
  inPlay: readonly CardExtId[],
): CardExtId[] {
  const eligible: CardExtId[] = [];
  for (const cardExtId of inPlay) {
    if (G.cardTraits?.[cardExtId]?.team === TEAM_X_MEN) {
      eligible.push(cardExtId);
    }
  }
  return eligible;
}

/**
 * Records a deferred specific-card hand injection for a player (WP-695 / D-24512).
 *
 * Appends `cardId` to `G.deferredHandInjections[playerId]`, lazily creating the map and
 * the per-player array. Consumed once at that player's next play-phase `onBegin` fill
 * (game.ts), which adds it as an extra (seventh) card and clears the key. A SIBLING to
 * `handSizeOverrides`: that field bumps the fill COUNT and cannot carry WHICH card, so
 * a specific injected Hero needs this ext_id-carrying field instead.
 *
 * @param G - The game state, mutated in place.
 * @param playerId - The player whose next hand gains the card.
 * @param cardId - The specific Hero ext_id to inject.
 */
export function recordDeferredHandInjection(
  G: LegendaryGameState,
  playerId: string,
  cardId: CardExtId,
): void {
  // why: lazy-create the map + per-player array before the first write — the field is
  // absent by default (never seeded in Game.setup); index-assigning undefined throws.
  if (G.deferredHandInjections === undefined) {
    G.deferredHandInjections = {};
  }
  if (G.deferredHandInjections[playerId] === undefined) {
    G.deferredHandInjections[playerId] = [];
  }
  G.deferredHandInjections[playerId].push(cardId);
}

/**
 * Resolves core Magneto's "Electromagnetic Bubble" tactic Fight effect: "Choose one of
 * your [team:x-men] Heroes. When you draw a new hand of cards at the end of this turn,
 * add that Hero to your hand as a seventh card." (WP-695 / D-24512).
 *
 * Scans the DEFEATING player's in-play X-Men Heroes:
 *   0 → a logged no-op (no entry parked);
 *   1 → auto-select the sole Hero inline (record the deferred injection, no park — the
 *       undercover 1→auto precedent: a one-option pick with no decline is just ceremony);
 *   ≥2 → park a PendingElectromagneticBubbleChoice carrying the eligible ext_ids.
 *
 * Active-scoped (parks only for `currentPlayer`). Mutates `G` directly; never throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (the chooser/beneficiary).
 */
export function resolveElectromagneticBubble(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  const playerZones = G.playerZones[currentPlayer];
  if (!playerZones) {
    return;
  }

  const eligibleCardIds = collectInPlayXMenHeroes(G, playerZones.inPlay);

  if (eligibleCardIds.length === 0) {
    // why: 0 in-play X-Men Heroes — a reachable no-op (never a hollow record); nothing to add.
    pushLog(G,
      `Fight effect: Player ${currentPlayer} has no in-play X-Men Hero to add (Electromagnetic Bubble); no effect.`,
      'blocked',
    );
    return;
  }

  if (eligibleCardIds.length === 1) {
    // why: exactly one eligible Hero — auto-select inline (no prompt, no freeze); a parked
    // one-option pick with no decline is ceremony (the WP-678 undercover 1→auto precedent).
    const soleCardId = eligibleCardIds[0]!;
    recordDeferredHandInjection(G, currentPlayer, soleCardId);
    pushLog(G,
      `Fight effect: Player ${currentPlayer} will add ${formatCardRef(G.cardDisplayData, soleCardId)} to their next hand as a seventh card (Electromagnetic Bubble).`,
      'applied',
    );
    return;
  }

  // why: ≥2 eligible Heroes — park an active pending pick. Lazily create the FIFO queue at
  // the park site (never in Game.setup) so an untriggered match leaves the field undefined
  // and the hash oracles stay stable. The block-all guard + resolveElectromagneticBubbleChoice
  // freeze the board until the current player picks.
  if (G.pendingElectromagneticBubbleChoices === undefined) {
    G.pendingElectromagneticBubbleChoices = [];
  }
  G.pendingElectromagneticBubbleChoices.push({
    choiceType: 'electromagnetic-bubble',
    playerID: currentPlayer,
    eligibleCardIds,
  });
  pushLog(G,
    `Fight effect: Player ${currentPlayer} — choose an in-play X-Men Hero to add to your next hand (Electromagnetic Bubble).`,
    'neutral',
  );
}

export function dispatchTacticOnFight(
  G: LegendaryGameState,
  ctx: unknown,
  defeatedTacticId: CardExtId,
  shuffleContext: ShuffleProvider,
  events?: TacticSeatChoiceEvents,
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
  // why: WP-696 / D-24513 — core Dr. Doom's "Secrets of Time Travel"; the arc's
  // only novel mechanic (the extra-turn primitive). Increments G.extraTurns for the
  // defeating player, honored at their next turn-end.
  if (defeatedTacticId === SECRETS_OF_TIME_TRAVEL_TACTIC_ID) {
    resolveSecretsOfTimeTravel(G, currentPlayer);
    return;
  }
  // why: WP-692 / D-24509 — Dr. Doom's Dark Technology parks an OPTIONAL filtered
  // free-recruit (tech/ranged) active pending choice for the defeating player.
  if (defeatedTacticId === DARK_TECHNOLOGY_TACTIC_ID) {
    resolveDarkTechnology(G, currentPlayer);
    return;
  }
  // why: WP-692 / D-24509 — Magneto's Bitter Captor parks a MANDATORY filtered
  // free-recruit (x-men) choice (auto-gain when exactly one eligible; no decline).
  if (defeatedTacticId === BITTER_CAPTOR_TACTIC_ID) {
    resolveBitterCaptor(G, currentPlayer);
    return;
  }
  // why: WP-694 / D-24511 — Dr. Doom's Monarch's Decree parks an ACTIVE draw-vs-discard
  // mode choice for the defeating player (the "discard" branch chains a multi-seat discard).
  // Threads events for the WP-684 setActivePlayers stage ride that admits the other seats.
  if (defeatedTacticId === MONARCHS_DECREE_TACTIC_ID) {
    resolveMonarchsDecree(G, events, currentPlayer);
    return;
  }
  // why: WP-694 / D-24511 — Loki's Vanishing Illusions parks a simultaneous MULTI-SEAT KO
  // choice for every other seat holding a Victory-Pile Villain (skips currentPlayer).
  if (defeatedTacticId === VANISHING_ILLUSIONS_TACTIC_ID) {
    resolveVanishingIllusions(G, events, currentPlayer);
    return;
  }
  // why: WP-693 / D-24510 — Loki's Cruel Ruler defeats a chosen City Villain for free
  // (0/1/≥2 City Villains → no-op/auto-defeat/active pending choice); reuses the shared
  // WP-486/682 free-defeat family, so `ctx` + `shuffleContext` forward to its defeat core.
  if (defeatedTacticId === LOKI_CRUEL_RULER_TACTIC_ID) {
    resolveCruelRuler(G, ctx, currentPlayer, shuffleContext);
    return;
  }
  // why: WP-693 / D-24510 — Loki's Maniacal Tyrant parks an OPTIONAL 0..4 KO-from-discard
  // choice for the active player (empty discard → no-op); the resolve move performs the KO.
  if (defeatedTacticId === LOKI_MANIACAL_TYRANT_TACTIC_ID) {
    resolveManiacalTyrant(G, currentPlayer);
    return;
  }
  // why: WP-695 / D-24512 — Red Skull's Ruthless Dictator parks an INTERACTIVE scry-3
  // disposition choice (KO one / discard one / top one) for the defeating player.
  if (defeatedTacticId === RED_SKULL_RUTHLESS_DICTATOR_TACTIC_ID) {
    resolveRuthlessDictator(G, currentPlayer);
    return;
  }
  // why: WP-695 / D-24512 — Magneto's Electromagnetic Bubble picks an in-play X-Men Hero
  // (0 → no-op, 1 → auto inline, ≥2 → park) and defers adding it as a seventh card at the
  // player's next hand fill.
  if (defeatedTacticId === MAGNETO_ELECTROMAGNETIC_BUBBLE_TACTIC_ID) {
    resolveElectromagneticBubble(G, currentPlayer);
    return;
  }
}
