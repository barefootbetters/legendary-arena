/**
 * Shared fixture builders for the UI-projection types (WP-573 / EC-608 /
 * D-24382).
 *
 * why: the same terms as the engine-state builders in `fixtureBuilders.ts` — a
 * builder per type supplying the canonical default for EVERY required field, so
 * the next required field on a UI projection is added HERE, once, and every
 * fixture inherits it. That property is the reason these exist, and it is
 * proven by mutation rather than assumed (EC-608 AC-1); a falling error count is
 * explicitly not evidence (D-24381 §3).
 *
 * why: every default is READ from `ui/uiState.types.ts` and the `buildUIState`
 * code that populates it, never invented. In particular the display default is
 * `UNKNOWN_DISPLAY_PLACEHOLDER` — production's OWN answer to "what is an unknown
 * display", which `resolveDisplay` spreads as `{...UNKNOWN_DISPLAY_PLACEHOLDER,
 * extId}` for a card with no registry entry. Hand-rolling a display literal here
 * would invent a second answer to a question production has already settled.
 *
 * why: OPTIONAL fields are left unset. `gameText` and `UISchemeState.display`
 * are optional on the production types, and a builder that fills them starts
 * asserting a presence the type does not require.
 */

import type {
  UICityCard,
  UICityState,
  UIMastermindState,
  UISchemeState,
  UITurnEconomyState,
  UIDecksState,
  UISharedPilesState,
  UIKoPileState,
} from '../ui/uiState.types.js';
import { UNKNOWN_DISPLAY_PLACEHOLDER } from '../ui/uiState.build.js';

/**
 * Builds a complete UICityCard, defaulting to an empty unknown card.
 *
 * @param overrides - Fields to set explicitly.
 * @returns A structurally complete UICityCard.
 */
export function makeUICityCard(overrides: Partial<UICityCard> = {}): UICityCard {
  return {
    extId: '',
    type: '',
    keywords: [],
    display: UNKNOWN_DISPLAY_PLACEHOLDER,
    attachedHeroes: [],
    attachedHeroDisplay: [],
    attachedBystanderCount: 0,
    fightCost: 0,
    ...overrides,
  };
}

/**
 * Builds a complete UICityState with no spaces and nothing escaped.
 *
 * @param overrides - Fields to set explicitly.
 * @returns A structurally complete UICityState.
 */
export function makeUICityState(overrides: Partial<UICityState> = {}): UICityState {
  return {
    spaces: [],
    escapedPile: [],
    ...overrides,
  };
}

/**
 * Builds a complete UIMastermindState with no tactics resolved.
 *
 * why: `attachedBystanders` and `strikePile` default to empty because both are
 * append-only piles that start empty at setup — the same reasoning as their
 * engine-side counterparts on `MastermindState`.
 *
 * @param overrides - Fields to set explicitly.
 * @returns A structurally complete UIMastermindState.
 */
export function makeUIMastermindState(
  overrides: Partial<UIMastermindState> = {},
): UIMastermindState {
  return {
    id: '',
    tacticsRemaining: 0,
    tacticsDefeated: 0,
    display: UNKNOWN_DISPLAY_PLACEHOLDER,
    attachedBystanders: [],
    strikePile: [],
    ...overrides,
  };
}

/**
 * Builds a complete UISchemeState with no twists resolved.
 *
 * @param overrides - Fields to set explicitly.
 * @returns A structurally complete UISchemeState.
 */
export function makeUISchemeState(overrides: Partial<UISchemeState> = {}): UISchemeState {
  return {
    id: '',
    twistCount: 0,
    twistPile: [],
    ...overrides,
  };
}

/**
 * Builds a complete UITurnEconomyState with every counter at zero.
 *
 * @param overrides - Counters to set explicitly.
 * @returns A structurally complete UITurnEconomyState.
 */
export function makeUITurnEconomyState(
  overrides: Partial<UITurnEconomyState> = {},
): UITurnEconomyState {
  return {
    attack: 0,
    recruit: 0,
    availableAttack: 0,
    availableRecruit: 0,
    piercing: 0,
    woundsDrawn: 0,
    ...overrides,
  };
}

/**
 * Builds a complete UIDecksState with both deck counts at zero.
 *
 * @param overrides - Counts to set explicitly.
 * @returns A structurally complete UIDecksState.
 */
export function makeUIDecksState(overrides: Partial<UIDecksState> = {}): UIDecksState {
  return {
    villainDeckCount: 0,
    heroDeckCount: 0,
    ...overrides,
  };
}

/**
 * Builds a complete UISharedPilesState with every pile count at zero.
 *
 * @param overrides - Counts to set explicitly.
 * @returns A structurally complete UISharedPilesState.
 */
export function makeUISharedPilesState(
  overrides: Partial<UISharedPilesState> = {},
): UISharedPilesState {
  return {
    bystandersCount: 0,
    woundsCount: 0,
    horrorsCount: 0,
    officersCount: 0,
    sidekicksCount: 0,
    ...overrides,
  };
}

/**
 * Builds a complete UIKoPileState representing an empty KO pile.
 *
 * why: `topCard` defaults to null rather than a placeholder display — the type
 * models "no top card" as null, and inventing a card would assert a presence the
 * projection does not have.
 *
 * @param overrides - Fields to set explicitly.
 * @returns A structurally complete UIKoPileState.
 */
export function makeUIKoPileState(overrides: Partial<UIKoPileState> = {}): UIKoPileState {
  return {
    count: 0,
    topCard: null,
    cards: [],
    ...overrides,
  };
}
