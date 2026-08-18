/**
 * Shared fixture builders for the engine's required-field state types
 * (WP-571 / EC-606 / D-24380).
 *
 * why: engine test files were never compiled before WP-563, so six separate
 * required-field additions each left the test fixtures structurally invalid and
 * nothing said so — `git log -S` dates `faceDownCards` to WP-282 and `horrors`
 * to WP-156, packets months apart. Fixing those 195 sites inline would make the
 * errors disappear and restore the exact preconditions for a seventh. Each
 * builder below supplies the canonical default for EVERY required field and
 * accepts a partial override, so the next required field is added HERE, once,
 * and every fixture inherits it. That property is the reason these exist; it is
 * proven by mutation rather than assumed (EC-606 AC-2).
 *
 * why: every default is READ from the production type and the setup code that
 * populates it, never invented — a wrong default silently changes what dozens of
 * tests assert, and a builder that lies is worse than the literals it replaced.
 * Provenance is cited per field below.
 */

import type { PlayerZones, GlobalPiles } from '../state/zones.types.js';
import type { TurnEconomy, CardStatEntry } from '../economy/economy.types.js';
import type { MastermindState } from '../mastermind/mastermind.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';

/**
 * Builds a complete PlayerZones, defaulting every zone to empty.
 *
 * why: `faceDownCards` defaults to `[]` — it is `readonly FaceDownCard[]` and a
 * player owns no face-down cards until `sendUndercover` runs (WP-282).
 *
 * @param overrides - Zones to set explicitly; the rest default to empty.
 * @returns A structurally complete PlayerZones.
 */
export function makePlayerZones(overrides: Partial<PlayerZones> = {}): PlayerZones {
  return {
    deck: [],
    hand: [],
    discard: [],
    inPlay: [],
    victory: [],
    faceDownCards: [],
    ...overrides,
  };
}

/**
 * Builds a complete GlobalPiles, defaulting every pile to empty.
 *
 * why: `horrors` defaults to `[]` — the type states it is scheme-controlled and
 * "empty in MVP"; no scheme populates it, and it exists for the projection
 * contract (UISharedPilesState.horrorsCount, D-12802).
 *
 * @param overrides - Piles to set explicitly; the rest default to empty.
 * @returns A structurally complete GlobalPiles.
 */
export function makeGlobalPiles(overrides: Partial<GlobalPiles> = {}): GlobalPiles {
  return {
    bystanders: [],
    wounds: [],
    officers: [],
    sidekicks: [],
    horrors: [],
    ...overrides,
  };
}

/**
 * Builds a complete TurnEconomy, defaulting every counter to zero.
 *
 * why: all six fields default to 0 — the type states the economy is "reset to
 * all zeros at the start of each player turn", and `piercing` carries its own
 * note that there is "no MVP producer — always 0 until a future hero ability WP".
 *
 * @param overrides - Counters to set explicitly; the rest default to 0.
 * @returns A structurally complete TurnEconomy.
 */
export function makeTurnEconomy(overrides: Partial<TurnEconomy> = {}): TurnEconomy {
  return {
    attack: 0,
    recruit: 0,
    spentAttack: 0,
    spentRecruit: 0,
    piercing: 0,
    woundsDrawn: 0,
    ...overrides,
  };
}

/**
 * Builds a complete CardStatEntry, defaulting to a zero-cost static card.
 *
 * why: `fightCostMode` defaults to `'static'` and `fightCostBase` to `0`. Both
 * are stated on the type ("All existing cards default to 'static'. WP-214";
 * "Always 0 for static") and written verbatim by the setup code — see the
 * S.H.I.E.L.D. Agent / Trooper / Officer / Sidekick entries in
 * `buildInitialGameState.ts` and the mastermind entry in `mastermind.setup.ts`.
 *
 * @param overrides - Stats to set explicitly; the rest default to 0 / static.
 * @returns A structurally complete CardStatEntry.
 */
export function makeCardStatEntry(overrides: Partial<CardStatEntry> = {}): CardStatEntry {
  return {
    attack: 0,
    recruit: 0,
    cost: 0,
    fightCost: 0,
    fightCostMode: 'static',
    fightCostBase: 0,
    ...overrides,
  };
}

/**
 * Builds a complete MastermindState for a given mastermind identity.
 *
 * why: `strikePile` and `attachedBystanders` both default to `[]` — the type
 * describes each as append-only, and `mastermind.setup.ts` writes `[]` for both
 * at every construction site. `gameText` is optional on the type and is left
 * unset unless overridden.
 *
 * @param overrides - Fields to set explicitly; id and baseCardId default to a
 *   recognisable test identity.
 * @returns A structurally complete MastermindState.
 */
export function makeMastermindState(
  overrides: Partial<MastermindState> = {},
): MastermindState {
  return {
    id: 'test-mastermind-001',
    baseCardId: 'test-mastermind-001',
    tacticsDeck: [],
    tacticsDefeated: [],
    strikePile: [],
    attachedBystanders: [],
    ...overrides,
  };
}

/**
 * Builds a complete CardRegistryReader that returns no data.
 *
 * why: `listSets` and `getSet` are REQUIRED on the interface, and
 * `buildInitialGameState` silently SKIPS builders for an incomplete reader — a
 * narrow mock therefore tests a degraded setup path without saying so. The
 * optional members (`playerCountSetup`, `resolveEffectiveHeroCount`) are left
 * unset so callers fall back to the same defaults production uses.
 *
 * @param overrides - Reader members to set explicitly.
 * @returns A structurally complete CardRegistryReader.
 */
export function makeCardRegistryReader(
  overrides: Partial<CardRegistryReader> = {},
): CardRegistryReader {
  return {
    listCards: () => [],
    listSets: () => [],
    getSet: () => undefined,
    ...overrides,
  };
}
