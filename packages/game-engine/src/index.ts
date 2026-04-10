export { LegendaryGame, setRegistryForSetup, clearRegistryForSetup } from './game.js';
export type {
  MatchConfiguration,
  LegendaryGameState,
  CardExtId,
  SetupContext,
  PlayerZones,
  GlobalPiles,
  MatchSelection,
} from './types.js';
export type {
  Zone,
  PlayerState,
  ZoneValidationError,
  GameStateShape,
} from './state/zones.types.js';
export type {
  MatchSetupConfig,
  MatchSetupError,
  ValidateMatchSetupResult,
} from './matchSetup.types.js';
export { validateMatchSetup } from './matchSetup.validate.js';
export type { CardRegistryReader } from './matchSetup.validate.js';
export { buildInitialGameState } from './setup/buildInitialGameState.js';
export {
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
  BYSTANDER_EXT_ID,
  WOUND_EXT_ID,
  SHIELD_OFFICER_EXT_ID,
  SIDEKICK_EXT_ID,
} from './setup/buildInitialGameState.js';
export { shuffleDeck } from './setup/shuffle.js';
export type { ShuffleProvider } from './setup/shuffle.js';
export { validateGameStateShape, validatePlayerStateShape } from './state/zones.validate.js';
export type {
  MatchPhase,
  TurnStage,
  TurnPhaseError,
} from './turn/turnPhases.types.js';
export { MATCH_PHASES, TURN_STAGES } from './turn/turnPhases.types.js';
export {
  getNextTurnStage,
  isValidTurnStageTransition,
  isValidMatchPhase,
  isValidTurnStage,
} from './turn/turnPhases.logic.js';
export { validateTurnStageTransition } from './turn/turnPhases.validate.js';
export { advanceTurnStage } from './turn/turnLoop.js';
export type { TurnLoopContext, TurnLoopState } from './turn/turnLoop.js';
