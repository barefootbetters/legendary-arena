/**
 * Mastermind types for the Legendary Arena game engine.
 *
 * MastermindState tracks the selected mastermind's identity, tactics
 * deck, and defeated tactics list. Built at setup time from registry
 * data. All fields are CardExtId or CardExtId[] — JSON-serializable.
 */

import type { CardExtId } from '../state/zones.types.js';

/**
 * Runtime mastermind state for boss fight resolution.
 *
 * Built at setup time by buildMastermindState. The tactics deck is
 * shuffled deterministically; defeated tactics are append-only.
 */
export interface MastermindState {
  // why: id is the mastermind identity from MatchSetupConfig — used
  // for configuration and reference only, never for stat lookup
  /** Mastermind ext_id from MatchSetupConfig. */
  id: CardExtId;

  // why: baseCardId is the ONLY card ID used for stat lookup in
  // G.cardStats. All combat validation reads
  // G.cardStats[baseCardId].fightCost (per D-1805). Tactic IDs never
  // participate in stat lookup and never carry combat values in MVP.
  /** The mastermind's non-tactic card ext_id — sole key for G.cardStats. */
  baseCardId: CardExtId;

  // why: tacticsDeck is drawn from index 0 (top-of-deck convention);
  // tacticsDefeated is append-only on successful fight
  /** Shuffled tactics deck — drawn from index 0. */
  tacticsDeck: CardExtId[];
  /** Defeated tactics — append-only. */
  tacticsDefeated: CardExtId[];

  // why: append-only destination pile for resolved mastermind-strike cards.
  // Order is chronological (insertion order); no reshuffle in MVP.
  /** Resolved mastermind-strike cards — append-only, chronological. */
  strikePile: CardExtId[];

  // why: D-15401 — mastermind-side bystander captures only (D-12805
  // Interpretation B separates from city-villain G.attachedBystanders).
  // Append-only during strike resolution; no removal in MVP.
  /** Bystanders captured by mastermind strikes — append-only. */
  attachedBystanders: CardExtId[];

  // why: WP-398 / D-24201 — Hypno-Thralls are the non-grey Heroes co2e Loki's
  // Master Strike stacks next to Loki when a player cannot pay the Strength-Hero
  // discard cost. Append-only, mirroring the D-15401 attachedBystanders
  // precedent: no removal path, because no printed text ever returns a Thrall.
  //
  // why: a new G field is unavoidable here when Doom's Omens needed none. Omens
  // are COUNTED (the strike counter already counts them, so WP-388 derived the
  // total), whereas Thralls are SPECIFIC cards that leave a hand and must be
  // identified individually and durably — no existing field holds them and they
  // cannot be inferred.
  //
  // why: attaches to the MASTERMIND, not a player — the card stacks next to
  // Loki — so it lives on MastermindState, not on playerZones.
  //
  // why: optional on the G type (the gameText precedent above) so existing test
  // fixtures compile without modification; buildMastermindState always populates
  // it `[]` at every construction site.
  /** Non-grey Heroes stacked next to Loki as Hypno-Thralls — append-only. */
  hypnoThralls?: CardExtId[];

  // why: setup-time snapshot of the mastermind base card's abilities text
  // from the registry. Projected through UIState so the play surface can
  // tell the player what happens on a Master Strike.
  // Optional on the G type so existing test fixtures compile without
  // modification; the builder always populates it.
  /** Mastermind base card ability text lines. Built at setup, read-only at runtime. */
  readonly gameText?: readonly string[];
}
