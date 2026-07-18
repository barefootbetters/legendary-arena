export { validate, summarize, generateSchema, lagnSchema } from './validator.js'
export {
  LAGN_VERSION,
  LAGN_VERSION_1_0_0,
  LAGN_VERSION_1_1_0,
  LAGN_SUPPORTED_VERSIONS
} from './validator.js'
export type { LagnVersion } from './validator.js'
export {
  migrateToCurrent,
  buildLagnMigrationKey
} from './migrate.js'
export type {
  LagnMigrationFn,
  LagnMigrationKey,
  LagnMigrationResult
} from './migrate.js'
export type {
  LAGN,
  GameSetup,
  CardCatalog,
  Replay,
  Card,
  Action,
  VillainEvent,
  Turn,
  GameResult,
  ActionType,
  VillainPhaseEvent,
  Outcome,
  LossCondition,
  RarityCode,
  HeroClass,
  CardType,
  Variant
} from './types.js'

// Re-export LAGN_SCHEMA as a constant for programmatic use
import { generateSchema } from './validator.js'

export const LAGN_SCHEMA = generateSchema()
