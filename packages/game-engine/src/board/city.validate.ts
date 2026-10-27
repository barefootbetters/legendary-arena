/**
 * City zone shape validation for the Legendary Arena game engine.
 *
 * validateCityShape confirms that a city value is an array of 1-6 spaces
 * (WP-831 / D-24764), each (string | null). Used for runtime safety checks in move functions.
 *
 * No boardgame.io imports. No registry imports.
 */

import type { MoveError } from '../moves/coreMoves.types.js';
import { CITY_MAX_SIZE, CITY_MIN_SIZE } from './city.types.js';

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
 * A valid CityZone is an array of CITY_MIN_SIZE..CITY_MAX_SIZE spaces where each
 * element is either a string (CardExtId) or null.
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

  // why: WP-831 / D-24764 — a scheme can resize the City within CITY_MIN_SIZE..CITY_MAX_SIZE.
  if (city.length < CITY_MIN_SIZE || city.length > CITY_MAX_SIZE) {
    return {
      ok: false,
      errors: [{
        code: 'INVALID_CITY_LENGTH',
        message: `G.city must have between ${CITY_MIN_SIZE} and ${CITY_MAX_SIZE} spaces, but has ${city.length}.`,
        path: 'city',
      }],
    };
  }

  for (let spaceIndex = 0; spaceIndex < city.length; spaceIndex++) {
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
