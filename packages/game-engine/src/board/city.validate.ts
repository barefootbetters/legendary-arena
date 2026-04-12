/**
 * City zone shape validation for the Legendary Arena game engine.
 *
 * validateCityShape confirms that a city value is a 5-element array
 * of (string | null). Used for runtime safety checks in move functions.
 *
 * No boardgame.io imports. No registry imports.
 */

import type { MoveError } from '../moves/coreMoves.types.js';

/** Successful validation result. */
interface CityValidOk {
  ok: true;
}

/** Failed validation result with error details. */
interface CityValidFail {
  ok: false;
  errors: MoveError[];
}

/** Discriminated union result from validateCityShape. */
export type ValidateCityShapeResult = CityValidOk | CityValidFail;

/**
 * Validates that the given value is a valid CityZone shape.
 *
 * A valid CityZone is a 5-element array where each element is either
 * a string (CardExtId) or null.
 *
 * @param city - The value to validate.
 * @returns ok: true if valid, ok: false with errors if invalid.
 */
export function validateCityShape(city: unknown): ValidateCityShapeResult {
  if (!Array.isArray(city)) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_CITY_SHAPE',
        message: 'G.city must be an array.',
        path: 'city',
      }],
    };
  }

  if (city.length !== 5) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_CITY_LENGTH',
        message: `G.city must have exactly 5 elements, but has ${city.length}.`,
        path: 'city',
      }],
    };
  }

  for (let spaceIndex = 0; spaceIndex < 5; spaceIndex++) {
    const space = city[spaceIndex];
    if (space !== null && typeof space !== 'string') {
      return {
        ok: false,
        errors: [{
          code: 'INVALID_CITY_SPACE',
          message: `G.city[${spaceIndex}] must be a string or null, but is ${typeof space}.`,
          path: `city[${spaceIndex}]`,
        }],
      };
    }
  }

  return { ok: true };
}
