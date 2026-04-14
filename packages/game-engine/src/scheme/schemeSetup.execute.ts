/**
 * Deterministic executor for scheme setup instructions.
 *
 * Applies a list of SchemeSetupInstruction entries to the game state during
 * setup. Each instruction type has a dedicated handler. Unknown types log a
 * warning and are skipped — the executor never throws.
 *
 * This is separate from scheme twist execution (WP-024), which reacts to
 * events during play.
 */

import type { LegendaryGameState } from '../types.js';
import type { SchemeSetupInstruction } from './schemeSetup.types.js';
import type { BoardKeyword } from '../board/boardKeywords.types.js';
import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// Instruction value interfaces (structural, not exported)
// ---------------------------------------------------------------------------

/** Expected shape of the value for addCityKeyword instructions. */
interface AddCityKeywordValue {
  readonly cardId: string;
  readonly keyword: BoardKeyword;
}

/** Expected shape of the value for addSchemeCounter instructions. */
interface AddSchemeCounterValue {
  readonly name: string;
  readonly value?: number;
}

/** Expected shape of the value for initialCityState instructions. */
interface InitialCityStateValue {
  readonly cityIndex: number;
  readonly cardId: string;
}

// ---------------------------------------------------------------------------
// executeSchemeSetup
// ---------------------------------------------------------------------------

/**
 * Applies scheme setup instructions to the game state.
 *
 * Iterates the instruction list with for...of and applies each instruction.
 * Returns a new game state object — pure function, no in-place mutation of
 * the input.
 *
 * @param gameState - The current LegendaryGameState being constructed.
 * @param instructions - Declarative setup instructions from the scheme.
 * @returns Updated LegendaryGameState with instructions applied.
 */
export function executeSchemeSetup(
  gameState: LegendaryGameState,
  instructions: SchemeSetupInstruction[],
): LegendaryGameState {
  // why: scheme setup runs after base deck construction, before the first
  // turn. Instructions configure the board (counters, keywords, city state).
  // This is separate from scheme twist execution (WP-024), which reacts to
  // events during play.

  let result = gameState;

  for (const instruction of instructions) {
    switch (instruction.type) {
      case 'modifyCitySize': {
        // why: CityZone is a fixed 5-tuple (D-2602). Functional city resizing
        // deferred until CityZone is converted to a dynamic array.
        result = {
          ...result,
          messages: [
            ...result.messages,
            `Scheme setup instruction "modifyCitySize" is not yet supported (CityZone is a fixed tuple) — skipped`,
          ],
        };
        break;
      }

      case 'addCityKeyword': {
        // why: schemes may add keywords to City cards at setup time (e.g.,
        // adding Guard to a specific space).
        const keywordValue = instruction.value as AddCityKeywordValue;
        const cardId = keywordValue.cardId as CardExtId;
        const existingKeywords = result.cardKeywords[cardId] ?? [];
        result = {
          ...result,
          cardKeywords: {
            ...result.cardKeywords,
            [cardId]: [...existingKeywords, keywordValue.keyword],
          },
        };
        break;
      }

      case 'addSchemeCounter': {
        // why: schemes may initialize named counters for tracking
        // scheme-specific endgame conditions (e.g., "bystanders rescued"
        // threshold).
        const counterValue = instruction.value as AddSchemeCounterValue;
        const initialValue = counterValue.value ?? 0;
        result = {
          ...result,
          counters: {
            ...result.counters,
            [counterValue.name]: initialValue,
          },
        };
        break;
      }

      case 'initialCityState': {
        // why: schemes may pre-populate City spaces before the first villain
        // deck reveal (e.g., starting villain placement).
        const cityValue = instruction.value as InitialCityStateValue;
        const newCity = [...result.city] as typeof result.city;
        newCity[cityValue.cityIndex] = cityValue.cardId as CardExtId;
        result = {
          ...result,
          city: newCity,
        };
        break;
      }

      default: {
        // why: unknown instruction types are logged and skipped — never throw.
        // This follows the graceful degradation pattern (D-1234).
        const unknownType = (instruction as { type: string }).type;
        result = {
          ...result,
          messages: [
            ...result.messages,
            `Unknown scheme setup instruction type: "${unknownType}" — skipped`,
          ],
        };
        break;
      }
    }
  }

  return result;
}
