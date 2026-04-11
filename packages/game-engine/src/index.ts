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
export type {
  CoreMoveName,
  DrawCardsArgs,
  PlayCardArgs,
  EndTurnArgs,
  MoveError,
  MoveResult,
} from './moves/coreMoves.types.js';
export { CORE_MOVE_NAMES } from './moves/coreMoves.types.js';
export { MOVE_ALLOWED_STAGES, isMoveAllowedInStage } from './moves/coreMoves.gating.js';
export {
  validateDrawCardsArgs,
  validatePlayCardArgs,
  validateEndTurnArgs,
  validateMoveAllowedInStage,
} from './moves/coreMoves.validate.js';
export { moveCardFromZone, moveAllCards } from './moves/zoneOps.js';
export type { MoveCardResult, MoveAllResult } from './moves/zoneOps.js';
export type {
  RuleTriggerName,
  RuleEffect,
  HookDefinition,
  HookRegistry,
  OnTurnStartPayload,
  OnTurnEndPayload,
  OnCardRevealedPayload,
  OnSchemeTwistRevealedPayload,
  OnMastermindStrikeRevealedPayload,
  TriggerPayloadMap,
} from './rules/ruleHooks.types.js';
export { RULE_TRIGGER_NAMES, RULE_EFFECT_TYPES } from './rules/ruleHooks.types.js';
export {
  validateTriggerPayload,
  validateRuleEffect,
  validateHookDefinition,
} from './rules/ruleHooks.validate.js';
export { createHookRegistry, getHooksForTrigger } from './rules/ruleHooks.registry.js';
