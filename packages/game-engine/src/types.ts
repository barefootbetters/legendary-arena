/**
 * Match configuration payload sent to boardgame.io Game.setup().
 *
 * Represents the immutable setup-time input that defines a match. All card
 * references use ext_id strings from the card registry. Field names are locked
 * by 00.2 section 8.1 — do not rename, abbreviate, or reorder.
 *
 * Trust boundary: the server/lobby layer is responsible for validating that
 * ext_ids resolve to real cards and that counts are within legal ranges.
 * The engine treats this payload as pre-validated and does not re-check it.
 */
// why: ext_id string references (not numeric database IDs) are stable across
// database re-seeds. Numeric IDs change whenever the seeder drops and
// re-creates rows, silently breaking saved match configurations or replay
// references. Per 00.2 section 4.4 and DECISIONS.md D-1201/D-1202.
export interface MatchConfiguration {
  /** Scheme ext_id. */
  readonly schemeId: string;

  /** Mastermind ext_id. */
  readonly mastermindId: string;

  /** Villain group ext_ids. */
  readonly villainGroupIds: readonly string[];

  /** Henchman group ext_ids. */
  readonly henchmanGroupIds: readonly string[];

  /** Hero deck ext_ids. */
  readonly heroDeckIds: readonly string[];

  /** Number of bystander cards in the game. */
  readonly bystandersCount: number;

  /** Number of wound cards in the game. */
  readonly woundsCount: number;

  /** Number of S.H.I.E.L.D. Officer cards in the game. */
  readonly officersCount: number;

  /** Number of Sidekick cards in the game. */
  readonly sidekicksCount: number;
}

/**
 * The shape of boardgame.io game state (G).
 *
 * This is the initial skeleton. Fields will be added by subsequent Work Packets
 * as gameplay features are implemented.
 *
 * Invariant: G must be JSON-serializable at all times. No functions, classes,
 * Maps, Sets, Dates, or Symbols may appear anywhere in this type or its
 * descendants.
 */
export interface LegendaryGameState {
  /** The match configuration used to set up this game. Immutable after setup. */
  readonly matchConfiguration: MatchConfiguration;
}
