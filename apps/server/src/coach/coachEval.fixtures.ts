/**
 * Endgame AI Coach — Model Eval Scenarios (WP-737 / EC-774 / D-24559)
 *
 * The fixed scenario set the operator-run `coach:eval` sends through a candidate
 * model before `COACH_MODEL` is swapped to it. Each scenario is a production-shaped
 * `CoachMatchSummary` (display names from the real card data, seat labels in the
 * production `Player N` form) plus a deterministic rubric. At least one scenario
 * per `CoachEvalCategory`.
 *
 * Layer/boundary: server layer only — imports only the coach and eval types.
 */

import type { CoachPlayerLine } from './coach.types.js';
import type { CoachEvalScenario } from './coachEval.types.js';

// why: a luck read is the coach's job whenever actual adversity is far from PAR's
// expectation, but there is no stemming in the rubric, so every inflection the
// model might use is listed. The list is deliberately loose: it catches a report
// that never touches luck or adversity at all, not the quality of the read.
const LUCK_LANGUAGE_TERMS: readonly string[] = [
  'luck',
  'lucky',
  'luckily',
  'unlucky',
  'fortunate',
  'unfortunate',
  'adversity',
  'twist',
  'twists',
  'escape',
  'escapes',
  'escaped',
];

/** Purchase language, with every inflection listed (no stemming in the rubric). */
const PURCHASE_LANGUAGE_TERMS: readonly string[] = [
  'buy',
  'buys',
  'bought',
  'buying',
  'recruit',
  'recruited',
  'recruiting',
  'purchase',
  'purchases',
  'purchased',
  'acquire',
  'acquired',
  'acquiring',
];

/** The per-seat counts a fixture seat varies; the synergy counts default to 0. */
interface FixtureSeatCounts {
  readonly victoryPoints: number;
  readonly bystandersRescued: number;
  readonly villainsDefeated: number;
  readonly henchmenDefeated: number;
  readonly mastermindTacticsDefeated: number;
  readonly acquiredCards: readonly string[];
}

/**
 * Build one production-shaped seat line. Seat labels are always `Player N`, as
 * `buildPerPlayerLines` emits them.
 *
 * @param seatNumber The 1-based seat number.
 * @param counts The seat's contribution counts and acquired cards.
 * @returns The seat line.
 */
function buildSeat(seatNumber: number, counts: FixtureSeatCounts): CoachPlayerLine {
  return {
    label: `Player ${seatNumber}`,
    victoryPoints: counts.victoryPoints,
    bystandersRescued: counts.bystandersRescued,
    villainsDefeated: counts.villainsDefeated,
    henchmenDefeated: counts.henchmenDefeated,
    mastermindTacticsDefeated: counts.mastermindTacticsDefeated,
    conditionalClausesPlayed: 0,
    conditionalClausesAssembled: 0,
    conditionalClausesPotentialValue: 0,
    conditionalClausesRealizedValue: 0,
    acquiredCards: counts.acquiredCards,
  };
}

/** The eval scenario set. At least 10 scenarios, at least one per category. */
export const COACH_EVAL_SCENARIOS: readonly CoachEvalScenario[] = [
  {
    id: 'baseline-win-core-red-skull',
    category: 'baseline-win',
    description: 'A two-seat heroes win against Red Skull with adversity at or below PAR.',
    summary: {
      outcome: 'heroes-win',
      playerCount: 2,
      rounds: 14,
      scheme: 'Midtown Bank Robbery',
      mastermind: 'Red Skull',
      villainGroups: ['HYDRA', 'Spider-Foes'],
      henchmanGroups: ['Hand Ninjas'],
      heroes: ['Captain America', 'Spider-Man', 'Iron Man', 'Black Widow', 'Hulk'],
      rawScore: 1180,
      finalScore: 1180,
      grade: 'b',
      team: { victoryPoints: 38, bystandersRescued: 6 },
      adversity: { schemeTwists: 4, villainsEscaped: 2, bystandersLost: 2 },
      adversityExpected: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 21,
          bystandersRescued: 4,
          villainsDefeated: 5,
          henchmenDefeated: 3,
          mastermindTacticsDefeated: 2,
          acquiredCards: ['Avengers Assemble! ×2', 'Repulsor Rays ×2', 'Hulk Smash!', 'Great Responsibility'],
        }),
        buildSeat(2, {
          victoryPoints: 17,
          bystandersRescued: 2,
          villainsDefeated: 4,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 2,
          acquiredCards: ['Covert Operation ×2', 'Arc Reactor', 'Web-Shooters ×2', 'Unstoppable Hulk'],
        }),
      ],
    },
    rubric: {},
  },
  {
    id: 'unlucky-loss-core-magneto',
    category: 'unlucky-loss',
    description: 'A scheme win against Magneto where actual adversity ran well above PAR.',
    summary: {
      outcome: 'scheme-wins',
      playerCount: 2,
      rounds: 11,
      scheme: 'Negative Zone Prison Breakout',
      mastermind: 'Magneto',
      villainGroups: ['Brotherhood', 'Radiation'],
      henchmanGroups: ['Sentinel'],
      heroes: ['Cyclops', 'Storm', 'Rogue', 'Emma Frost', 'Gambit'],
      rawScore: 3920,
      finalScore: 3920,
      grade: 'e',
      team: { victoryPoints: 14, bystandersRescued: 1 },
      adversity: { schemeTwists: 8, villainsEscaped: 9, bystandersLost: 7 },
      adversityExpected: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 8,
          bystandersRescued: 1,
          villainsDefeated: 3,
          henchmenDefeated: 1,
          mastermindTacticsDefeated: 0,
          acquiredCards: ['Optic Blast ×2', 'Lightning Bolt', 'Determination'],
        }),
        buildSeat(2, {
          victoryPoints: 6,
          bystandersRescued: 0,
          villainsDefeated: 2,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 0,
          acquiredCards: ['Energy Drain ×2', 'Mental Discipline', 'Card Shark'],
        }),
      ],
    },
    rubric: { mustMentionAny: [LUCK_LANGUAGE_TERMS] },
  },
  {
    id: 'lucky-win-core-dr-doom',
    category: 'lucky-win',
    description: 'A heroes win against Dr. Doom where actual adversity ran well below PAR.',
    summary: {
      outcome: 'heroes-win',
      playerCount: 2,
      rounds: 12,
      scheme: 'Unleash the Power of the Cosmic Cube',
      mastermind: 'Dr. Doom',
      villainGroups: ['Masters of Evil', 'Radiation'],
      henchmanGroups: ['Doombot Legion'],
      heroes: ['Thor', 'Iron Man', 'Nick Fury', 'Spider-Man', 'Cyclops'],
      rawScore: 610,
      finalScore: 610,
      grade: 'a',
      team: { victoryPoints: 44, bystandersRescued: 9 },
      adversity: { schemeTwists: 1, villainsEscaped: 0, bystandersLost: 0 },
      adversityExpected: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 23,
          bystandersRescued: 5,
          villainsDefeated: 6,
          henchmenDefeated: 3,
          mastermindTacticsDefeated: 2,
          acquiredCards: ['Surge of Power ×2', 'Endless Invention ×2', 'Legendary Commander'],
        }),
        buildSeat(2, {
          victoryPoints: 21,
          bystandersRescued: 4,
          villainsDefeated: 5,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 2,
          acquiredCards: ['High-Tech Weaponry ×2', 'Astonishing Strength', 'Optic Blast', 'God of Thunder'],
        }),
      ],
    },
    rubric: { mustMentionAny: [LUCK_LANGUAGE_TERMS] },
  },
  {
    id: 'two-seat-contribution-core-loki',
    category: 'two-seat-contribution',
    description: 'A two-seat heroes win against Loki where one seat carried nearly all the combat.',
    summary: {
      outcome: 'heroes-win',
      playerCount: 2,
      rounds: 15,
      scheme: 'Super Hero Civil War',
      mastermind: 'Loki',
      villainGroups: ['Enemies of Asgard', 'Masters of Evil'],
      henchmanGroups: ['Savage Land Mutates'],
      heroes: ['Thor', 'Hulk', 'Captain America', 'Emma Frost', 'Nick Fury'],
      rawScore: 1540,
      finalScore: 1540,
      grade: 'c',
      team: { victoryPoints: 35, bystandersRescued: 5 },
      adversity: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      adversityExpected: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 29,
          bystandersRescued: 1,
          villainsDefeated: 9,
          henchmenDefeated: 4,
          mastermindTacticsDefeated: 4,
          acquiredCards: ['Hulk Smash! ×2', 'Crazed Rampage ×2', 'Odinson', 'Call Lightning'],
        }),
        buildSeat(2, {
          victoryPoints: 6,
          bystandersRescued: 4,
          villainsDefeated: 1,
          henchmenDefeated: 1,
          mastermindTacticsDefeated: 0,
          acquiredCards: ['Perfect Teamwork ×2', 'Shadowed Thoughts ×2', 'Battlefield Promotion'],
        }),
      ],
    },
    rubric: { mustMentionAny: [['Player 1', 'P1'], ['Player 2', 'P2']] },
  },
  {
    id: 'solo-core-red-skull',
    category: 'solo',
    description: 'A one-seat heroes win against Red Skull.',
    summary: {
      outcome: 'heroes-win',
      playerCount: 1,
      rounds: 18,
      scheme: 'Midtown Bank Robbery',
      mastermind: 'Red Skull',
      villainGroups: ['Spider-Foes'],
      henchmanGroups: ['Hand Ninjas'],
      heroes: ['Spider-Man', 'Black Widow', 'Iron Man'],
      rawScore: 1320,
      finalScore: 1320,
      grade: 'c',
      team: { victoryPoints: 27, bystandersRescued: 5 },
      adversity: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 2 },
      adversityExpected: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 27,
          bystandersRescued: 5,
          villainsDefeated: 7,
          henchmenDefeated: 3,
          mastermindTacticsDefeated: 4,
          acquiredCards: ['Web-Shooters ×2', 'Dangerous Rescue ×2', 'Repulsor Rays', 'Arc Reactor'],
        }),
      ],
    },
    rubric: {},
  },
  {
    id: 'hallucination-guard-core-loki',
    category: 'hallucination-guard',
    description: 'A two-seat match whose hero pool excludes several famous heroes the model might name anyway.',
    summary: {
      outcome: 'scheme-wins',
      playerCount: 2,
      rounds: 13,
      scheme: "Replace Earth's Leaders with Killbots",
      mastermind: 'Loki',
      villainGroups: ['Enemies of Asgard', 'HYDRA'],
      henchmanGroups: ['Doombot Legion'],
      heroes: ['Captain America', 'Iron Man', 'Thor', 'Black Widow', 'Hulk'],
      rawScore: 2610,
      finalScore: 2610,
      grade: 'd',
      team: { victoryPoints: 19, bystandersRescued: 2 },
      adversity: { schemeTwists: 6, villainsEscaped: 4, bystandersLost: 4 },
      adversityExpected: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 11,
          bystandersRescued: 1,
          villainsDefeated: 4,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 1,
          acquiredCards: ['Growing Anger ×3', 'Arc Reactor', 'Odinson'],
        }),
        buildSeat(2, {
          victoryPoints: 8,
          bystandersRescued: 1,
          villainsDefeated: 3,
          henchmenDefeated: 1,
          mastermindTacticsDefeated: 1,
          acquiredCards: ['Mission Accomplished ×2', 'Avengers Assemble!', 'Quantum Breakthrough'],
        }),
      ],
    },
    rubric: { mustNotMention: ['Wolverine', 'Hawkeye', 'Deadpool', 'Nightcrawler', 'Daredevil'] },
  },
  {
    id: 'no-purchases-core-magneto',
    category: 'no-purchases',
    description: 'A two-seat heroes win where one seat bought no hero cards at all.',
    summary: {
      outcome: 'heroes-win',
      playerCount: 2,
      rounds: 16,
      scheme: 'Portals to the Dark Dimension',
      mastermind: 'Magneto',
      villainGroups: ['Brotherhood', 'Skrulls'],
      henchmanGroups: ['Sentinel'],
      heroes: ['Cyclops', 'Storm', 'Hulk', 'Gambit', 'Nick Fury'],
      rawScore: 1720,
      finalScore: 1720,
      grade: 'c',
      team: { victoryPoints: 31, bystandersRescued: 4 },
      adversity: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      adversityExpected: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 27,
          bystandersRescued: 3,
          villainsDefeated: 8,
          henchmenDefeated: 3,
          mastermindTacticsDefeated: 4,
          acquiredCards: ['Optic Blast ×2', 'Tidal Wave', 'Hulk Smash! ×2', 'High Stakes Jackpot'],
        }),
        buildSeat(2, {
          victoryPoints: 4,
          bystandersRescued: 1,
          villainsDefeated: 1,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 0,
          acquiredCards: [],
        }),
      ],
    },
    rubric: { mustMentionAny: [PURCHASE_LANGUAGE_TERMS] },
  },
  {
    id: 'pre-par-summary-core-dr-doom',
    category: 'pre-par-summary',
    description: 'A match scored before PAR expectations existed, so adversityExpected is absent.',
    summary: {
      outcome: 'heroes-win',
      playerCount: 2,
      rounds: 15,
      scheme: 'Secret Invasion of the Skrull Shapeshifters',
      mastermind: 'Dr. Doom',
      villainGroups: ['Skrulls', 'Masters of Evil'],
      henchmanGroups: ['Doombot Legion'],
      heroes: ['Spider-Man', 'Iron Man', 'Emma Frost', 'Rogue', 'Thor'],
      rawScore: 1450,
      finalScore: 1450,
      grade: 'c',
      team: { victoryPoints: 33, bystandersRescued: 5 },
      adversity: { schemeTwists: 5, villainsEscaped: 4, bystandersLost: 3 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 18,
          bystandersRescued: 3,
          villainsDefeated: 5,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 2,
          acquiredCards: ['Borrowed Brawn ×2', 'Surge of Power', 'Psychic Link'],
        }),
        buildSeat(2, {
          victoryPoints: 15,
          bystandersRescued: 2,
          villainsDefeated: 4,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 2,
          acquiredCards: ['Repulsor Rays ×2', 'Great Responsibility', 'Diamond Form'],
        }),
      ],
    },
    rubric: {},
  },
  {
    id: 'tie-core-red-skull',
    category: 'tie',
    description: 'A match that ended in a tie.',
    summary: {
      outcome: 'tie',
      playerCount: 2,
      rounds: 17,
      scheme: 'Super Hero Civil War',
      mastermind: 'Red Skull',
      villainGroups: ['HYDRA', 'Radiation'],
      henchmanGroups: ['Hand Ninjas'],
      heroes: ['Captain America', 'Black Widow', 'Storm', 'Cyclops', 'Gambit'],
      rawScore: 2050,
      finalScore: 2050,
      grade: 'd',
      team: { victoryPoints: 26, bystandersRescued: 3 },
      adversity: { schemeTwists: 6, villainsEscaped: 3, bystandersLost: 4 },
      adversityExpected: { schemeTwists: 5, villainsEscaped: 3, bystandersLost: 3 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 14,
          bystandersRescued: 2,
          villainsDefeated: 4,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 2,
          acquiredCards: ['Perfect Teamwork ×2', 'Silent Sniper', 'Lightning Bolt'],
        }),
        buildSeat(2, {
          victoryPoints: 12,
          bystandersRescued: 1,
          villainsDefeated: 3,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 2,
          acquiredCards: ['Stack the Deck ×2', 'Unending Energy', 'X-Men United'],
        }),
      ],
    },
    rubric: {},
  },
  {
    id: 'five-players-core-magneto',
    category: 'five-players',
    description: 'A five-seat heroes win against Magneto, the engine maximum table.',
    summary: {
      outcome: 'heroes-win',
      playerCount: 5,
      rounds: 10,
      scheme: 'Midtown Bank Robbery',
      mastermind: 'Magneto',
      villainGroups: ['Brotherhood', 'Radiation', 'HYDRA', 'Skrulls'],
      henchmanGroups: ['Sentinel', 'Hand Ninjas'],
      heroes: ['Cyclops', 'Storm', 'Thor', 'Iron Man', 'Spider-Man', 'Hulk'],
      rawScore: 1260,
      finalScore: 1260,
      grade: 'b',
      team: { victoryPoints: 58, bystandersRescued: 11 },
      adversity: { schemeTwists: 4, villainsEscaped: 3, bystandersLost: 3 },
      adversityExpected: { schemeTwists: 5, villainsEscaped: 4, bystandersLost: 4 },
      perPlayer: [
        buildSeat(1, {
          victoryPoints: 15,
          bystandersRescued: 3,
          villainsDefeated: 4,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 1,
          acquiredCards: ['Optic Blast ×2', 'Determination'],
        }),
        buildSeat(2, {
          victoryPoints: 13,
          bystandersRescued: 2,
          villainsDefeated: 3,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 1,
          acquiredCards: ['Lightning Bolt ×2', 'Tidal Wave'],
        }),
        buildSeat(3, {
          victoryPoints: 12,
          bystandersRescued: 2,
          villainsDefeated: 3,
          henchmenDefeated: 1,
          mastermindTacticsDefeated: 1,
          acquiredCards: ['Surge of Power', 'Odinson ×2'],
        }),
        buildSeat(4, {
          victoryPoints: 10,
          bystandersRescued: 3,
          villainsDefeated: 2,
          henchmenDefeated: 2,
          mastermindTacticsDefeated: 1,
          acquiredCards: ['Repulsor Rays', 'Web-Shooters ×2'],
        }),
        buildSeat(5, {
          victoryPoints: 8,
          bystandersRescued: 1,
          villainsDefeated: 2,
          henchmenDefeated: 1,
          mastermindTacticsDefeated: 0,
          acquiredCards: ['Growing Anger ×2', 'Hulk Smash!'],
        }),
      ],
    },
    rubric: {},
  },
];
