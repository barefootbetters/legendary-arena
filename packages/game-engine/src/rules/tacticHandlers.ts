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
 * No registry import. No `.reduce()`. No direct `ctx.random.*`: the only shuffle is
 * Baron Zemo's Finding Zemo, through the move's `shuffleContext.random.Shuffle`
 * (WP-818 / D-24752).
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
import { gainWoundWithOutcome } from '../board/wounds.logic.js';
import { addResources } from '../economy/economy.logic.js';
import { drawCardsIntoHand, HAND_SIZE } from '../moves/drawCards.logic.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import { cardHasTeamWhenPlayed } from '../hero/effectiveTeams.logic.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { koCard } from '../board/ko.logic.js';
import { isHqSlotHaunted } from '../board/haunt.logic.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
// why: WP-694 / D-24511 — the two multi-seat tactics PARK a WP-684 pending seat choice.
// parkSeatChoice is the foundational park entry; the mode/KO builders are pure (from the
// no-cycle seatChoiceTactics module). tacticHandlers imports these one-directionally;
// seatChoice.resolve.ts never imports tacticHandlers (no cycle).
import { parkSeatChoice } from '../moves/seatChoice.resolve.js';
import { offPlayCardTraits, playedCardIdsStillInPlay } from '../hero/splitCard.logic.js';
import {
  buildMonarchsDecreeModeChoice,
  buildVanishingIllusionsChoice,
  buildFallenIdolsDiscardChoice,
  // why: WP-821 / D-24754 — the free HQ gain moved to the pure seatChoiceTactics module
  // (Dominate the Weak's apply shares it), plus Arnim Zola's tactic builders.
  gainHqHeroToDiscard,
  buildComputerUploadedGeniusDiscardChoice,
  buildDominateTheWeakChoice,
  gainDominateTheWeakHero,
  buildCrushPacifistResistanceChoice,
  CRUSH_PACIFIST_RESISTANCE_KO_KIND,
} from '../moves/seatChoiceTactics.js';
// why: WP-821 / D-24754 — the one "less than 2 printed Attack" HQ read.
import { listZolaWeakHqSlots } from '../mastermind/arnimZola.logic.js';
// why: WP-818 / D-24752 — Baron Zemo's tactics read Savior status and the first
// Victory-Pile Bystander through the shared WP-816 helpers (defeated Killbots included).
import {
  SAVIOR_BYSTANDER_THRESHOLD,
  countVictoryPileBystanders,
  findFirstVictoryPileBystander,
} from '../board/bystanders.logic.js';

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

// why: WP-818 / D-24752 — ca75 Baron Heinrich Zemo's four tactic ext_ids, same
// `${setAbbr}-mastermind-${mastermindSlug}-${tacticSlug}` grammar as the constants above.
// Printed Fight text (data/cards/ca75.json):
//   Fallen Idols            "Each other player that is not a Savior discards a card."
//   Finding Zemo            "Reveal the top five cards of the Villain Deck. If you revealed
//                            any Bystanders, KO them and each other player gains a Wound.
//                            Put the rest back in random order."
//   Hatred for the Avengers "For each of your [team:avengers] Heroes, rescue a Bystander."
//   Prisoners of War        "Each other player reveals an [team:avengers] Hero or chooses a
//                            Bystander from their Victory Pile, and you rescue that Bystander."
const ZEMO_FALLEN_IDOLS_TACTIC_ID: CardExtId =
  'ca75-mastermind-baron-heinrich-zemo-fallen-idols';
const ZEMO_FINDING_ZEMO_TACTIC_ID: CardExtId =
  'ca75-mastermind-baron-heinrich-zemo-finding-zemo';
const ZEMO_HATRED_FOR_THE_AVENGERS_TACTIC_ID: CardExtId =
  'ca75-mastermind-baron-heinrich-zemo-hatred-for-the-avengers';
const ZEMO_PRISONERS_OF_WAR_TACTIC_ID: CardExtId =
  'ca75-mastermind-baron-heinrich-zemo-prisoners-of-war';

// why: WP-818 / D-24752 — Finding Zemo's printed "top five cards". Fewer are revealed
// when the Villain Deck is shorter.
export const FINDING_ZEMO_REVEAL_COUNT = 5;

// why: the normalized team slug for Hatred for the Avengers and Prisoners of War, the
// same lowercase form as TEAM_X_MEN.
const TEAM_AVENGERS = 'avengers';

// why: WP-821 / D-24754 — ca75 Arnim Zola's four tactic ext_ids, same
// `${setAbbr}-mastermind-${mastermindSlug}-${tacticSlug}` grammar as the constants above.
// Printed Fight text (data/cards/ca75.json):
//   Dominate the Weak          "The player of your choice gains a Hero from the HQ that has
//                               less than 2 printed [icon:attack]."
//   Computer-Uploaded Genius   "Each other player reveals a [hc:tech] Hero or discards a card."
//   Pet Projects               "Each other player reveals a Zola's Creations Villain from their
//                               Victory Pile or gains a Wound."
//   Crush Pacifist Resistance  "KO up to two of your Heroes that have less than 2 printed
//                               [icon:attack]."
const ZOLA_DOMINATE_THE_WEAK_TACTIC_ID: CardExtId =
  'ca75-mastermind-arnim-zola-dominate-the-weak';
const ZOLA_COMPUTER_UPLOADED_GENIUS_TACTIC_ID: CardExtId =
  'ca75-mastermind-arnim-zola-computer-uploaded-genius';
const ZOLA_PET_PROJECTS_TACTIC_ID: CardExtId =
  'ca75-mastermind-arnim-zola-pet-projects';
const ZOLA_CRUSH_PACIFIST_RESISTANCE_TACTIC_ID: CardExtId =
  'ca75-mastermind-arnim-zola-crush-pacifist-resistance';

// why: the normalized hero-class slug for Computer-Uploaded Genius, matching
// G.cardTraits[extId].heroClass / heroClass2 (D-24523).
const HERO_CLASS_TECH = 'tech';

// why: WP-821 / D-24754 — the anchored Zola's Creations villain-group prefix
// (`${setAbbr}-villain-${group}-`, D-24299) for Pet Projects' Victory-Pile reveal.
const ZOLAS_CREATIONS_VILLAIN_PREFIX = 'ca75-villain-zolas-creations-';

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

  // why: D-24665 — with no other seat (a solo match) the effect has no one to
  // reveal or take Wounds; log the no-op so the tactic does not resolve silently
  // (the Whispers and Lies D-24661 / Monarch's Decree D-24659 precedent).
  const hasOtherSeat = playerIds.some((seat) => seat !== currentPlayer);
  if (!hasOtherSeat) {
    pushLog(G,
      `Fight effect: there is no other player to reveal an X-Men Hero or gain Wounds (Crushing Shockwave).`,
      'neutral',
    );
    return;
  }

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
    let woundsPendingDivingBlock = 0;
    for (let woundIndex = 0; woundIndex < SHOCKWAVE_WOUND_COUNT; woundIndex++) {
      // why: WP-682 / D-24499 — gainWoundForPlayer chokepoint so a tactic-Fight Wound
      // reaches a Diving-Block holder (possibly a NON-active seat) via the WP-684 wave.
      // 'no-wound' = supply empty this iteration → stop early (moves never throw).
      const woundOutcome = gainWoundWithOutcome(G, playerId);
      if (woundOutcome === 'no-wound') {
        break;
      }
      woundsTaken += 1;
      if (woundOutcome === 'diving-block-pending') {
        woundsPendingDivingBlock += 1;
      }
    }

    // why: supply-shortfall path — fewer Wounds available than the printed two is
    // a logged no-op-shortfall; report the count actually taken so the
    // play-by-play reflects the real supply outcome.
    // why: D-24673 — while Diving Block reveals are pending, say "would gain"; the
    // reveal / decline lines that follow give the outcome.
    if (woundsPendingDivingBlock > 0) {
      pushLog(G,
        `Fight effect: Player ${playerId} held no X-Men Hero and would gain ${String(woundsTaken)} Wound(s) — Diving Block can prevent ${woundsPendingDivingBlock === 1 ? 'it' : 'each one'} (Crushing Shockwave).`,
      );
    } else {
      pushLog(G,
        `Fight effect: Player ${playerId} held no X-Men Hero and gained ${String(woundsTaken)} Wound(s) (Crushing Shockwave).`,
      );
    }
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
  // why: D-24732 — HYDRA Conspiracy's draws are the defeating (current) player's extra
  // cards drawn this turn, unlike the next-hand bonuses that only grow the end-of-turn draw.
  G.turnEconomy.cardsDrawn += drawn;
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
 * Counts the acting player's Heroes of one team — the "for each of your [team:X]
 * Heroes" scan (Xavier's Nemesis, Hatred for the Avengers), over the hand AND the
 * cards played this turn.
 *
 * In play, reads effective team membership via `cardHasTeamWhenPlayed` (printed
 * `G.cardTraits.team` OR a Copy-Powers granted team), so a Rogue Copy Powers card
 * that copied a Hero of the team counts. In hand, reads the printed team through
 * `offPlayCardTraits` (a Copy-Powers grant applies only in play; a Divided Card off
 * play carries its faces' team).
 *
 * @param G - The game state (read-only here).
 * @param inPlay - The acting player's played-this-turn cards, in order.
 * @param hand - The acting player's hand, in order.
 * @param team - The normalized team slug to count (e.g. `x-men`, `avengers`).
 * @returns How many cards in hand or play count as that team.
 */
// why: WP-818 / D-24752 — generalized from the X-Men-only count for its second team use
// (Hatred for the Avengers), so both tactics read "your Heroes" by the same D-24645 rule.
function countTeamHeroesYouHave(
  G: LegendaryGameState,
  inPlay: readonly CardExtId[],
  hand: readonly CardExtId[],
  team: string,
): number {
  // why: explicit loops, not .reduce() — effect application counts as rule work
  // (.claude/rules/code-style.md Patterns to Avoid).
  let total = 0;
  for (const cardExtId of inPlay) {
    if (cardHasTeamWhenPlayed(G, cardExtId, team)) {
      total = total + 1;
    }
  }
  // why: D-24645 — rules v23 "Your Heroes/Allies" & "Heroes/Allies You Have": these
  // phrases include the cards in your hand as well as the cards played this turn
  // (the D-24529 Perfect Teamwork precedent). D-24508 counted play only.
  for (const cardExtId of hand) {
    if (offPlayCardTraits(G, cardExtId)?.team === team) {
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
 * per D-21501) into the defeating player's Victory Pile, once per X-Men Hero in
 * their hand or played this turn (D-24645). Zero X-Men Heroes, or an empty supply, rescues nothing and logs a
 * `blocked` line naming why; a short supply stops early. Mutates
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

  // why: WP-780 / D-24619 — a rules-facing Hero trait / count read, so a card Penumbra played both-sides counts as both faces.
  // why: WP-803 / D-24692 — a "Heroes you have" read (hand + still in play), so a card that went Out of Time is excluded: rules v23 L3443-3447 (a played card that moved elsewhere doesn't count as "Your Heroes" or "Heroes you Have") + L3457-3470 ("Reveal a Hero" / "KO one of your Heroes" can't pick it).
  const xMenCount = countTeamHeroesYouHave(
    G,
    playedCardIdsStillInPlay(G, playerZones.inPlay),
    playerZones.hand,
    TEAM_X_MEN,
  );
  // why: nothing to rescue is a no-effect outcome, logged `blocked` with its reason —
  // the Electromagnetic Bubble "has no X-Men Hero" precedent — never an `applied`
  // "rescued 0 Bystander(s)" line, which read as a successful effect.
  if (xMenCount === 0) {
    pushLog(G,
      `Fight effect: Player ${currentPlayer} has no X-Men Hero in hand or play, so no Bystander is rescued (Xavier's Nemesis).`,
      'blocked',
    );
    return;
  }
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

  if (rescuedCount === 0) {
    pushLog(G,
      `Fight effect: Player ${currentPlayer} has X-Men Heroes but the Bystander supply is empty, so no Bystander is rescued (Xavier's Nemesis).`,
      'blocked',
    );
    return;
  }
  pushLog(G,
    `Fight effect: Player ${currentPlayer} rescued ${String(rescuedCount)} Bystander(s) — one per X-Men Hero in hand or play (Xavier's Nemesis).`,
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

  // why: D-24661 — with no other seat (a solo match) the effect has no one to
  // penalize; log the no-op so the tactic does not resolve silently (the
  // Monarch's Decree D-24659 precedent).
  const hasOtherSeat = playerIds.some((seat) => seat !== currentPlayer);
  if (!hasOtherSeat) {
    pushLog(G,
      `Fight effect: there is no other player to KO Bystanders from (Whispers and Lies).`,
      'neutral',
    );
    return;
  }

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
  // why: WP-772 / D-24604 — an HQ card is off play, so a split card matches on either half's
  // class (rules v23 p.49), resolved through the split-face map.
  const trait = offPlayCardTraits(G, cardId);
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
      // why: WP-703 / D-24523 — a dual-class card matches on either printed class.
      if (trait.heroClass === value || trait.heroClass2 === value) {
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
    // why: WP-757 / D-24587 — rulebook v23 p.27: "recruit a Hero from the HQ for free"
    // doesn't work on a Haunted Hero, since you can't recruit it. ("Gain" and put-bottom
    // effects still reach Haunted Heroes; only this free-RECRUIT path skips them.)
    if (isHqSlotHaunted(G, hqIndex)) {
      continue;
    }
    if (slot !== null && slot !== undefined && hqHeroMatchesFreeRecruitFilter(G, slot, filter)) {
      indices.push(hqIndex);
    }
  }
  return indices;
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
    const gainedId = gainHqHeroToDiscard(G, currentPlayer, eligibleIndices[0]!);
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
  // why: D-24659 — both branches only affect "each OTHER player", so with no other
  // seat (a solo match) the draw-vs-discard choice is meaningless. Log the no-op and
  // park nothing instead of prompting the player (the Vanishing Illusions precedent).
  const hasOtherSeat = Object.keys(G.playerZones).some((seat) => seat !== currentPlayer);
  if (!hasOtherSeat) {
    pushLog(G,
      `Fight effect: there is no other player to draw or discard (Monarch's Decree).`,
      'neutral',
    );
    return;
  }
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
    // D-24661: log the attribution first — the defeat core logs an ordinary "fought"
    // line, which otherwise reads as a paid fight.
    pushLog(G,
      `Fight effect: Player ${currentPlayer} defeats ${formatCardRef(G.cardDisplayData, targets[0]!.cardId)} for free (Cruel Ruler).`,
      'applied',
    );
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
 * Collects the acting player's X-Men Heroes in play, then in hand — the Electromagnetic
 * Bubble eligibility scan ("one of your [team:x-men] Heroes"; D-24645: rules v23 "Your
 * Heroes" = hand + cards played this turn).
 *
 * TEAM-ONLY match against the setup-time `G.cardTraits` snapshot plus, for a played card,
 * its Copy Powers copied team (the WP-506 precedent: only Heroes carry a team, so Wounds /
 * Bystanders / the teamless basic S.H.I.E.L.D. cards never false-match). Map-level
 * defensive guard — a legacy state predating WP-179 leaves the map undefined and matches
 * nothing rather than throwing. Do NOT add a heroClass guard and do NOT drop the map-level
 * guard (WP-695 non-negotiable).
 *
 * @param G - The game state (read-only here; supplies `cardTraits`).
 * @param inPlay - The acting player's in-play zone, in order.
 * @param hand - The acting player's hand, in order.
 * @returns The X-Men Hero ext_ids, in-play (play order) before hand (hand order).
 */
function collectXMenHeroesYouHave(
  G: LegendaryGameState,
  inPlay: readonly CardExtId[],
  hand: readonly CardExtId[],
): CardExtId[] {
  const eligible: CardExtId[] = [];
  for (const cardExtId of inPlay) {
    // why: D-24731 — the effective when-played team (D-24391), so a Copy Powers copy of an
    // X-Men Hero is eligible, matching countTeamHeroesYouHave. The undefined-map guard keeps
    // the WP-695 legacy-state posture (cardHasTeamWhenPlayed reads the map directly).
    if (G.cardTraits !== undefined && cardHasTeamWhenPlayed(G, cardExtId, TEAM_X_MEN)) {
      eligible.push(cardExtId);
    }
  }
  // why: D-24645 — a hand Hero is "one of your Heroes" too. It is discarded at cleanup,
  // and consumeDeferredHandInjections pulls it back from the discard at the next fill.
  for (const cardExtId of hand) {
    if (offPlayCardTraits(G, cardExtId)?.team === TEAM_X_MEN) {
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
 * Scans the DEFEATING player's X-Men Heroes in play and in hand (D-24645):
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

  const eligibleCardIds = collectXMenHeroesYouHave(G, playerZones.inPlay, playerZones.hand);

  if (eligibleCardIds.length === 0) {
    // why: 0 X-Men Heroes in play or hand — a reachable no-op (never a hollow record); nothing to add.
    pushLog(G,
      `Fight effect: Player ${currentPlayer} has no X-Men Hero in hand or play to add (Electromagnetic Bubble); no effect.`,
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
    `Fight effect: Player ${currentPlayer} — choose an X-Men Hero from your hand or play to add to your next hand (Electromagnetic Bubble).`,
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
  // X-Men Hero in the defeating player's hand or play (D-24645; no player choice).
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
  // why: WP-695 / D-24512 — Magneto's Electromagnetic Bubble picks an X-Men Hero
  // (0 → no-op, 1 → auto inline, ≥2 → park) and defers adding it as a seventh card at the
  // player's next hand fill.
  if (defeatedTacticId === MAGNETO_ELECTROMAGNETIC_BUBBLE_TACTIC_ID) {
    resolveElectromagneticBubble(G, currentPlayer);
    return;
  }
  // why: WP-818 / D-24752 — Baron Zemo's Fallen Idols parks a multi-seat discard for the
  // other non-Savior seats (the Monarch's discard shape; threads events for the stage ride).
  if (defeatedTacticId === ZEMO_FALLEN_IDOLS_TACTIC_ID) {
    resolveFallenIdols(G, events, currentPlayer);
    return;
  }
  // why: WP-818 / D-24752 — Baron Zemo's Finding Zemo reveals the top 5 Villain-Deck cards;
  // the shuffle context reorders the rest it puts back.
  if (defeatedTacticId === ZEMO_FINDING_ZEMO_TACTIC_ID) {
    resolveFindingZemo(G, currentPlayer, shuffleContext);
    return;
  }
  // why: WP-818 / D-24752 — Hatred for the Avengers, the Xavier's Nemesis rule with Avengers.
  if (defeatedTacticId === ZEMO_HATRED_FOR_THE_AVENGERS_TACTIC_ID) {
    resolveHatredForTheAvengers(G, currentPlayer);
    return;
  }
  // why: WP-818 / D-24752 — Prisoners of War: each other player reveals an Avengers Hero
  // or gives the defeating player a Victory-Pile Bystander (auto-resolved).
  if (defeatedTacticId === ZEMO_PRISONERS_OF_WAR_TACTIC_ID) {
    resolvePrisonersOfWar(G, currentPlayer);
    return;
  }
  // why: WP-821 / D-24754 — Arnim Zola's Dominate the Weak: one active-seat "Player N gains
  // <Hero>" choice (a single option resolves at once).
  if (defeatedTacticId === ZOLA_DOMINATE_THE_WEAK_TACTIC_ID) {
    resolveDominateTheWeak(G, events, currentPlayer);
    return;
  }
  // why: WP-821 / D-24754 — Computer-Uploaded Genius: hand Tech reveals, then a multi-seat
  // discard for the rest (threads events for the stage ride).
  if (defeatedTacticId === ZOLA_COMPUTER_UPLOADED_GENIUS_TACTIC_ID) {
    resolveComputerUploadedGenius(G, events, currentPlayer);
    return;
  }
  // why: WP-821 / D-24754 — Pet Projects: Victory-Pile reveal or a Wound (auto-resolved).
  if (defeatedTacticId === ZOLA_PET_PROJECTS_TACTIC_ID) {
    resolvePetProjects(G, currentPlayer);
    return;
  }
  // why: WP-821 / D-24754 — Crush Pacifist Resistance: the first of up to two active-seat
  // KO picks (seatChoice.resolve.ts chains the second).
  if (defeatedTacticId === ZOLA_CRUSH_PACIFIST_RESISTANCE_TACTIC_ID) {
    resolveCrushPacifistResistance(G, events, currentPlayer);
    return;
  }
}

/**
 * Resolves Baron Zemo's "Fallen Idols" tactic Fight effect (WP-818 / D-24752): "Each
 * other player that is not a Savior discards a card."
 *
 * Narrates each other Savior seat and each other non-Savior seat with an empty hand,
 * then parks a simultaneous multi-seat discard for the rest. Nothing is parked when no
 * seat qualifies. Never throws.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events (for the stage-ride admission); optional
 *   so a unit/replay context parks on G and resolves directly.
 * @param currentPlayer - The player who defeated the tactic. Skipped ("each other player").
 */
export function resolveFallenIdols(
  G: LegendaryGameState,
  events: TacticSeatChoiceEvents | undefined,
  currentPlayer: string,
): void {
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== currentPlayer)
    .sort();
  if (otherSeats.length === 0) {
    pushLog(G,
      `Fight effect: there is no other player to discard a card (Fallen Idols).`,
      'neutral',
    );
    return;
  }

  const nonSaviorSeats: string[] = [];
  for (const seat of otherSeats) {
    const zones = G.playerZones[seat]!;
    if (countVictoryPileBystanders(zones.victory) >= SAVIOR_BYSTANDER_THRESHOLD) {
      pushLog(G,
        `Fight effect: Player ${seat} is a Savior and discards nothing (Fallen Idols).`,
        'neutral',
      );
      continue;
    }
    if (zones.hand.length === 0) {
      pushLog(G,
        `Fight effect: Player ${seat} has no card to discard (Fallen Idols).`,
        'neutral',
      );
      continue;
    }
    nonSaviorSeats.push(seat);
  }

  const discardChoice = buildFallenIdolsDiscardChoice(G, nonSaviorSeats);
  if (discardChoice === undefined) {
    pushLog(G,
      `Fight effect: no other player who is not a Savior has a card to discard (Fallen Idols).`,
      'neutral',
    );
    return;
  }
  parkSeatChoice(G, events, discardChoice);
  pushLog(G,
    `Fight effect: each other player who is not a Savior must discard a card (Fallen Idols).`,
    'neutral',
  );
}

/**
 * Resolves Baron Zemo's "Finding Zemo" tactic Fight effect (WP-818 / D-24752): "Reveal
 * the top five cards of the Villain Deck. If you revealed any Bystanders, KO them and
 * each other player gains a Wound. Put the rest back in random order."
 *
 * The revealed Bystanders go to the KO pile in revealed order; the other revealed cards
 * go back on top of the Villain Deck, reshuffled. Never throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (takes no Wound).
 * @param shuffleContext - The move's deterministic shuffle for the cards put back.
 */
export function resolveFindingZemo(
  G: LegendaryGameState,
  currentPlayer: string,
  shuffleContext: ShuffleProvider,
): void {
  const deck = G.villainDeck.deck;
  const revealCount = Math.min(FINDING_ZEMO_REVEAL_COUNT, deck.length);
  if (revealCount === 0) {
    pushLog(G,
      `Fight effect: the Villain Deck is empty, so nothing is revealed (Finding Zemo).`,
      'blocked',
    );
    return;
  }

  // why: only cards typed 'bystander' count. On the Killbots scheme the villain-deck
  // Bystanders are typed 'villain' (D-24324): they are Killbots while in the deck.
  let koedCount = 0;
  let rest: CardExtId[] = [];
  for (const cardExtId of deck.slice(0, revealCount)) {
    if (G.villainDeckCardTypes[cardExtId] === 'bystander') {
      G.ko = koCard(G.ko, cardExtId);
      koedCount += 1;
    } else {
      rest.push(cardExtId);
    }
  }
  // why: "in random order" — the move's seeded Shuffle, called only when 2+ cards go back
  // (one card or none has a single order, so the call would only spend randomness).
  if (rest.length >= 2) {
    rest = shuffleContext.random.Shuffle([...rest]);
  }
  G.villainDeck.deck = [...rest, ...deck.slice(revealCount)];

  if (koedCount === 0) {
    pushLog(G,
      `Fight effect: revealed the top ${String(revealCount)} card(s) of the Villain Deck — no Bystanders (Finding Zemo).`,
      'blocked',
    );
    return;
  }
  pushLog(G,
    `Fight effect: revealed the top ${String(revealCount)} card(s) of the Villain Deck and KO'd ${String(koedCount)} Bystander(s) (Finding Zemo).`,
    'applied',
  );
  dealFindingZemoWounds(G, currentPlayer);
}

/**
 * Deals Finding Zemo's Wounds: each other player gains one Wound, however many
 * Bystanders were revealed (WP-818 / D-24752).
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (skipped).
 */
function dealFindingZemoWounds(G: LegendaryGameState, currentPlayer: string): void {
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== currentPlayer)
    .sort();
  if (otherSeats.length === 0) {
    pushLog(G,
      `Fight effect: there is no other player to gain a Wound (Finding Zemo).`,
      'neutral',
    );
    return;
  }
  for (const seat of otherSeats) {
    // why: WP-682 / D-24499 — the Wound chokepoint, so a Diving-Block holder (often a
    // non-active seat) gets the reveal window; D-24673 wording while it is pending.
    const woundOutcome = gainWoundWithOutcome(G, seat);
    if (woundOutcome === 'gained') {
      pushLog(G, `Fight effect: Player ${seat} gained a Wound (Finding Zemo).`, 'applied');
    } else if (woundOutcome === 'diving-block-pending') {
      pushLog(G,
        `Fight effect: Player ${seat} would gain a Wound — Diving Block can prevent it (Finding Zemo).`,
        'neutral',
      );
    } else {
      pushLog(G,
        `Fight effect: Player ${seat} gained no Wound — the Wound supply is empty (Finding Zemo).`,
        'blocked',
      );
    }
  }
}

/**
 * Resolves Baron Zemo's "Hatred for the Avengers" tactic Fight effect (WP-818 /
 * D-24752): "For each of your [team:avengers] Heroes, rescue a Bystander."
 *
 * Rescues one supply Bystander into the defeating player's Victory Pile per Avengers
 * Hero in their hand or still in play (the Xavier's Nemesis rule, D-24645 / D-24692).
 * Never throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (the beneficiary).
 */
export function resolveHatredForTheAvengers(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  const playerZones = G.playerZones[currentPlayer];
  if (!playerZones) {
    return;
  }

  const avengersCount = countTeamHeroesYouHave(
    G,
    playedCardIdsStillInPlay(G, playerZones.inPlay),
    playerZones.hand,
    TEAM_AVENGERS,
  );
  if (avengersCount === 0) {
    pushLog(G,
      `Fight effect: Player ${currentPlayer} has no Avengers Hero in hand or play, so no Bystander is rescued (Hatred for the Avengers).`,
      'blocked',
    );
    return;
  }
  let rescuedCount = 0;
  for (let rescueIndex = 0; rescueIndex < avengersCount; rescueIndex++) {
    // why: top-of-pile convention — bystanders[0] is the next supply Bystander (D-21501).
    const topBystander = G.piles.bystanders[0];
    if (topBystander === undefined) {
      break;
    }
    const moveResult = moveCardFromZone(G.piles.bystanders, playerZones.victory, topBystander);
    G.piles.bystanders = moveResult.from;
    playerZones.victory = moveResult.to;
    rescuedCount += 1;
  }

  if (rescuedCount === 0) {
    pushLog(G,
      `Fight effect: Player ${currentPlayer} has Avengers Heroes but the Bystander supply is empty, so no Bystander is rescued (Hatred for the Avengers).`,
      'blocked',
    );
    return;
  }
  pushLog(G,
    `Fight effect: Player ${currentPlayer} rescued ${String(rescuedCount)} Bystander(s) — one per Avengers Hero in hand or play (Hatred for the Avengers).`,
    'applied',
  );
}

/**
 * Resolves Baron Zemo's "Prisoners of War" tactic Fight effect (WP-818 / D-24752):
 * "Each other player reveals an [team:avengers] Hero or chooses a Bystander from their
 * Victory Pile, and you rescue that Bystander."
 *
 * Each other player (sorted) reveals an Avengers Hero from their hand when they hold
 * one; otherwise their first Victory-Pile Bystander moves to the defeating player's
 * Victory Pile. Never throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (the beneficiary).
 */
export function resolvePrisonersOfWar(
  G: LegendaryGameState,
  currentPlayer: string,
): void {
  const currentZones = G.playerZones[currentPlayer];
  if (!currentZones) {
    return;
  }
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== currentPlayer)
    .sort();
  if (otherSeats.length === 0) {
    pushLog(G,
      `Fight effect: there is no other player to reveal an Avengers Hero or give up a Bystander (Prisoners of War).`,
      'neutral',
    );
    return;
  }

  for (const seat of otherSeats) {
    const seatZones = G.playerZones[seat]!;
    // why: a free reveal always beats giving up a Bystander (D-24312), and every
    // Victory-Pile Bystander is worth the same, so the auto-pick is player-optimal.
    const revealedHero = seatZones.hand.find(
      (cardExtId) => offPlayCardTraits(G, cardExtId)?.team === TEAM_AVENGERS,
    );
    if (revealedHero !== undefined) {
      pushLog(G,
        `Fight effect: Player ${seat} revealed ${formatCardRef(G.cardDisplayData, revealedHero)} — no Bystander (Prisoners of War).`,
        'neutral',
      );
      continue;
    }
    const bystander = findFirstVictoryPileBystander(seatZones.victory);
    if (bystander === undefined) {
      pushLog(G,
        `Fight effect: Player ${seat} had no Avengers Hero and no Bystander in their Victory Pile (Prisoners of War).`,
        'blocked',
      );
      continue;
    }
    const moveResult = moveCardFromZone(seatZones.victory, currentZones.victory, bystander);
    seatZones.victory = moveResult.from;
    currentZones.victory = moveResult.to;
    pushLog(G,
      `Fight effect: Player ${seat} had no Avengers Hero, so Player ${currentPlayer} rescued a Bystander from their Victory Pile (Prisoners of War).`,
      'applied',
    );
  }
}

/**
 * Resolves Arnim Zola's "Dominate the Weak" tactic Fight effect (WP-821 / D-24754): "The
 * player of your choice gains a Hero from the HQ that has less than 2 printed
 * [icon:attack]."
 *
 * Parks one active-seat choice whose options pair a recipient with an eligible HQ Hero.
 * A single possible option (solo, one eligible Hero) resolves at once. Never throws.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events (unused for an active-seat-only park).
 * @param currentPlayer - The player who defeated the tactic (the chooser).
 */
export function resolveDominateTheWeak(
  G: LegendaryGameState,
  events: TacticSeatChoiceEvents | undefined,
  currentPlayer: string,
): void {
  const slots = listZolaWeakHqSlots(G);
  if (slots.length === 0) {
    pushLog(G,
      `Fight effect: no Hero in the HQ has less than 2 printed Attack, so no one gains a Hero (Dominate the Weak).`,
      'blocked',
    );
    return;
  }

  const choice = buildDominateTheWeakChoice(G, currentPlayer, slots);
  if (choice.seatPrompts[currentPlayer]!.options.length === 1) {
    // why: one recipient and one Hero is a forced pick, so it resolves now (the Bitter
    // Captor single-eligible rule, EC-729). Both fields are always set by construction;
    // the guard keeps exactOptionalPropertyTypes honest without a cast.
    const onlyOption = choice.seatPrompts[currentPlayer]!.options[0]!;
    if (onlyOption.cardId !== undefined && onlyOption.recipientSeat !== undefined) {
      gainDominateTheWeakHero(G, onlyOption.cardId, onlyOption.recipientSeat);
    }
    return;
  }
  // why: D-24648 — the defeating player is the only addressed seat, so no stage ride runs.
  parkSeatChoice(G, events, choice, currentPlayer);
  pushLog(G,
    `Fight effect: Player ${currentPlayer} chooses a player to gain a Hero with less than 2 printed Attack from the HQ (Dominate the Weak).`,
    'neutral',
  );
}

/**
 * Resolves Arnim Zola's "Computer-Uploaded Genius" tactic Fight effect (WP-821 /
 * D-24754): "Each other player reveals a [hc:tech] Hero or discards a card."
 *
 * Each other player with a Tech Hero in hand reveals it; each other player with an empty
 * hand is narrated; the rest get one simultaneous multi-seat discard. Never throws.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events (for the stage-ride admission); optional
 *   so a unit/replay context parks on G and resolves directly.
 * @param currentPlayer - The player who defeated the tactic. Skipped ("each other player").
 */
export function resolveComputerUploadedGenius(
  G: LegendaryGameState,
  events: TacticSeatChoiceEvents | undefined,
  currentPlayer: string,
): void {
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== currentPlayer)
    .sort();
  if (otherSeats.length === 0) {
    pushLog(G,
      `Fight effect: there is no other player to reveal a Tech Hero or discard a card (Computer-Uploaded Genius).`,
      'neutral',
    );
    return;
  }

  const discardSeats = collectGeniusDiscardSeats(G, otherSeats);
  const discardChoice = buildComputerUploadedGeniusDiscardChoice(G, discardSeats);
  if (discardChoice === undefined) {
    pushLog(G,
      `Fight effect: no other player must discard a card (Computer-Uploaded Genius).`,
      'neutral',
    );
    return;
  }
  parkSeatChoice(G, events, discardChoice);
  pushLog(G,
    `Fight effect: each other player without a Tech Hero must discard a card (Computer-Uploaded Genius).`,
    'neutral',
  );
}

/**
 * Narrates each other seat's Tech reveal or empty hand for Computer-Uploaded Genius and
 * returns the seats that must discard.
 *
 * @param G - The game state (read for hands + traits; G.messages appended).
 * @param otherSeats - Every seat except the defeating player (ascending).
 * @returns The seats with no Tech Hero and at least one hand card (ascending).
 */
function collectGeniusDiscardSeats(G: LegendaryGameState, otherSeats: readonly string[]): string[] {
  const discardSeats: string[] = [];
  for (const seat of otherSeats) {
    const zones = G.playerZones[seat];
    if (!zones) {
      continue;
    }
    // why: during your turn another player's Heroes are in their hand, so the reveal reads
    // the hand only (the Crushing Shockwave / Prisoners of War precedent), either class slot
    // (D-24523). A free reveal always beats a discard (D-24312), so a Tech holder is never asked.
    const techHero = zones.hand.find((cardExtId) => {
      const traits = offPlayCardTraits(G, cardExtId);
      return traits?.heroClass === HERO_CLASS_TECH || traits?.heroClass2 === HERO_CLASS_TECH;
    });
    if (techHero !== undefined) {
      pushLog(G,
        `Fight effect: Player ${seat} revealed ${formatCardRef(G.cardDisplayData, techHero)} — no discard (Computer-Uploaded Genius).`,
        'neutral',
      );
      continue;
    }
    if (zones.hand.length === 0) {
      pushLog(G,
        `Fight effect: Player ${seat} has no card to discard (Computer-Uploaded Genius).`,
        'neutral',
      );
      continue;
    }
    discardSeats.push(seat);
  }
  return discardSeats;
}

/**
 * Resolves Arnim Zola's "Pet Projects" tactic Fight effect (WP-821 / D-24754): "Each
 * other player reveals a Zola's Creations Villain from their Victory Pile or gains a
 * Wound."
 *
 * Each other player (sorted) with any Zola's Creations Villain in their Victory Pile
 * reveals it; every other one gains a Wound through the Diving Block chokepoint. Never
 * throws.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The player who defeated the tactic (skipped).
 */
export function resolvePetProjects(G: LegendaryGameState, currentPlayer: string): void {
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== currentPlayer)
    .sort();
  if (otherSeats.length === 0) {
    pushLog(G,
      `Fight effect: there is no other player to reveal a Zola's Creations Villain or gain a Wound (Pet Projects).`,
      'neutral',
    );
    return;
  }

  for (const seat of otherSeats) {
    const zones = G.playerZones[seat];
    if (!zones) {
      continue;
    }
    if (countVictoryPileGroupVillains(zones.victory, ZOLAS_CREATIONS_VILLAIN_PREFIX) > 0) {
      pushLog(G,
        `Fight effect: Player ${seat} revealed a Zola's Creations Villain from their Victory Pile — no Wound (Pet Projects).`,
        'neutral',
      );
      continue;
    }
    // why: WP-682 / D-24499 — the Wound chokepoint, so a Diving-Block holder (a non-active
    // seat here) gets the reveal window; D-24673 wording while it is pending.
    const woundOutcome = gainWoundWithOutcome(G, seat);
    if (woundOutcome === 'gained') {
      pushLog(G, `Fight effect: Player ${seat} gained a Wound (Pet Projects).`, 'applied');
    } else if (woundOutcome === 'diving-block-pending') {
      pushLog(G,
        `Fight effect: Player ${seat} would gain a Wound — Diving Block can prevent it (Pet Projects).`,
        'neutral',
      );
    } else {
      pushLog(G,
        `Fight effect: Player ${seat} gained no Wound — the Wound supply is empty (Pet Projects).`,
        'blocked',
      );
    }
  }
}

/**
 * Resolves Arnim Zola's "Crush Pacifist Resistance" tactic Fight effect (WP-821 /
 * D-24754): "KO up to two of your Heroes that have less than 2 printed [icon:attack]."
 *
 * Parks the first of up to two active-seat KO picks over the defeating player's hand and
 * played cards, with "KO nothing" last and the default. seatChoice.resolve.ts chains the
 * second pick after a KO. Never throws.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events (unused for an active-seat-only park).
 * @param currentPlayer - The player who defeated the tactic (the one who KOs).
 */
export function resolveCrushPacifistResistance(
  G: LegendaryGameState,
  events: TacticSeatChoiceEvents | undefined,
  currentPlayer: string,
): void {
  const choice = buildCrushPacifistResistanceChoice(
    G,
    currentPlayer,
    CRUSH_PACIFIST_RESISTANCE_KO_KIND,
  );
  if (choice === undefined) {
    pushLog(G,
      `Fight effect: Player ${currentPlayer} has no Hero with less than 2 printed Attack to KO (Crush Pacifist Resistance).`,
      'blocked',
    );
    return;
  }
  // why: D-24648 — the defeating player is the only addressed seat, so no stage ride runs.
  parkSeatChoice(G, events, choice, currentPlayer);
  pushLog(G,
    `Fight effect: Player ${currentPlayer} may KO up to two Heroes with less than 2 printed Attack (Crush Pacifist Resistance).`,
    'neutral',
  );
}
