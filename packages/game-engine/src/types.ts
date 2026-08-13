/**
 * Core types for the Legendary Arena game engine.
 *
 * LegendaryGameState is the shape of boardgame.io game state (G).
 * MatchConfiguration is the match setup payload passed to Game.setup().
 *
 * Zone and player state types are defined canonically in
 * src/state/zones.types.ts and re-exported here for backward compatibility.
 */

import type { MatchSetupConfig } from './matchSetup.types.js';
import type { LogEntry } from './log/logOutcome.types.js';
import type { BoardKeyword } from './board/boardKeywords.types.js';
import type { SchemeSetupInstruction } from './scheme/schemeSetup.types.js';

// why: Persistence boundary types (PERSISTENCE_CLASSES, MatchSnapshot,
// PersistableMatchConfig) are defined canonically in
// src/persistence/persistence.types.ts (WP-013). Re-exported here so that
// consumers importing from './types.js' have access.
export type {
  MatchSnapshot,
  MatchSnapshotPlayer,
  MatchSnapshotOutcome,
  PersistableMatchConfig,
} from './persistence/persistence.types.js';
export { PERSISTENCE_CLASSES } from './persistence/persistence.types.js';

// why: LobbyState is defined canonically in src/lobby/lobby.types.ts (WP-011).
// Re-exported here so that consumers importing from './types.js' have access.
export type { LobbyState, SetPlayerReadyArgs } from './lobby/lobby.types.js';

// why: Versioning types (EngineVersion, DataVersion, ContentVersion,
// VersionedArtifact, CompatibilityStatus, CompatibilityResult) are defined
// canonically in src/versioning/versioning.types.ts (WP-034 / D-3401).
// Re-exported here so consumers importing from './types.js' have access.
export type {
  EngineVersion,
  DataVersion,
  ContentVersion,
  VersionedArtifact,
  CompatibilityStatus,
  CompatibilityResult,
} from './versioning/versioning.types.js';

// Ops metadata (WP-035 / D-3501)
// why: Operational metadata types (OpsCounters, DeploymentEnvironment,
// IncidentSeverity) are defined canonically in src/ops/ops.types.ts
// (WP-035 / D-3501). Re-exported here so consumers importing from
// './types.js' have access. These types are passive metadata — the engine
// never constructs or mutates instances (RS-1 option (a)).
export type {
  OpsCounters,
  DeploymentEnvironment,
  IncidentSeverity,
} from './ops/ops.types.js';

// why: Villain deck types (VillainDeckState, RevealedCardType) are defined
// canonically in src/villainDeck/villainDeck.types.ts (WP-014A). Re-exported
// here so that consumers importing from './types.js' have access.
export type { VillainDeckState, RevealedCardType } from './villainDeck/villainDeck.types.js';
export { REVEALED_CARD_TYPES } from './villainDeck/villainDeck.types.js';

// why: WP-513 / D-24324 — a converted card's "counts-as" villain identity, kept
// as a scheme-runtime overlay (G.convertedVillainOrigins), distinct from the
// card's RevealedCardType. 'killbot' (Killbots, WP-513); 'skrull' (Secret Invasion,
// WP-514 / D-24326 — 12 Heroes shuffled into the Villain Deck count as Skrull villains).
/** Converted-card villain origin — the named villain group a card "counts as". */
export type ConvertedVillainOrigin = 'killbot' | 'skrull';

// why: WP-513 / D-24325 — Killbots' "number of Twists next to this Scheme" counter
// key (G.counters). Seeded 3 at setup, +1 per Killbots twist; a Killbot's attack
// equals this value. A plain counter key (not an endgame condition).
/** G.counters key for Killbots' "twists next to this Scheme" (drives Killbot attack). */
export const KILLBOT_TWISTS_NEXT_TO_SCHEME = 'killbotTwistsNextToScheme';

// why: City and HQ zone types are defined canonically in
// src/board/city.types.ts (WP-015). Re-exported here so that consumers
// importing from './types.js' have access.
export type { CityZone, CitySpace, HqZone, HqSlot } from './board/city.types.js';

// why: Turn phase types (MatchPhase, TurnStage, TurnPhaseError) are defined
// canonically in src/turn/turnPhases.types.ts (WP-007A). They are re-exported
// here so that consumers importing from './types.js' have access.
export type {
  MatchPhase,
  TurnStage,
  TurnPhaseError,
} from './turn/turnPhases.types.js';

// why: Move contracts (MoveResult, MoveError, CoreMoveName) are the engine-wide
// result contract defined canonically in src/moves/coreMoves.types.ts (WP-008A).
// Re-exported here so that consumers importing from './types.js' have access.
export type {
  MoveResult,
  MoveError,
  CoreMoveName,
} from './moves/coreMoves.types.js';

// why: Rule hook contracts (RuleTriggerName, RuleEffect, HookDefinition,
// HookRegistry) are defined canonically in src/rules/ruleHooks.types.ts
// (WP-009A). Re-exported here so that consumers importing from './types.js'
// have access.
export type {
  RuleTriggerName,
  RuleEffect,
  HookDefinition,
  HookRegistry,
} from './rules/ruleHooks.types.js';

// why: Endgame types (EndgameResult, EndgameOutcome) are defined canonically
// in src/endgame/endgame.types.ts (WP-010). Re-exported here so that
// consumers importing from './types.js' have access. ENDGAME_CONDITIONS is
// a value export (const), not a type, so it uses a separate export statement.
export type {
  EndgameResult,
  EndgameOutcome,
} from './endgame/endgame.types.js';
export { ENDGAME_CONDITIONS } from './endgame/endgame.types.js';

// why: Scoring types (FinalScoreSummary, PlayerScoreBreakdown) and VP
// constants are defined canonically in src/scoring/scoring.types.ts (WP-020).
// Re-exported here so that consumers importing from './types.js' have access.
export type { FinalScoreSummary, PlayerScoreBreakdown } from './scoring/scoring.types.js';
export {
  VP_VILLAIN,
  VP_HENCHMAN,
  VP_BYSTANDER,
  VP_TACTIC,
  VP_WOUND,
} from './scoring/scoring.types.js';

// why: PAR scoring types (WP-048) are defined canonically in
// src/scoring/parScoring.types.ts. Re-exported here so that consumers
// importing from './types.js' have access to the full scoring surface.
// No LegendaryGameState field addition — the setup-time scoring config
// field is deferred to WP-067 per D-4802.
export type {
  ScenarioKey,
  TeamKey,
  ScoringWeights,
  ScoringCaps,
  PenaltyEventType,
  PenaltyEventWeights,
  ParBaseline,
  ScenarioScoringConfig,
  ScoringInputs,
  ScoreBreakdown,
  LeaderboardEntry,
  ScoringConfigValidationResult,
} from './scoring/parScoring.types.js';
export { PENALTY_EVENT_TYPES } from './scoring/parScoring.types.js';

// why: MastermindState is defined canonically in
// src/mastermind/mastermind.types.ts (WP-019). Re-exported here so that
// consumers importing from './types.js' have access.
export type { MastermindState } from './mastermind/mastermind.types.js';

// why: Economy types (TurnEconomy, CardStatEntry) are defined canonically
// in src/economy/economy.types.ts (WP-018). Re-exported here so that
// consumers importing from './types.js' have access.
export type { TurnEconomy, CardStatEntry } from './economy/economy.types.js';

// why: CardTraitEntry is defined canonically in src/state/cardTraits.types.ts
// (WP-179). Re-exported here so consumers importing from './types.js' have access.
export type { CardTraitEntry } from './state/cardTraits.types.js';

// why: Hero ability hook contracts (HeroAbilityHook, HeroCondition,
// HeroEffectDescriptor) are defined canonically in
// src/rules/heroAbility.types.ts (WP-021). HeroKeyword and HeroAbilityTiming
// are defined in src/rules/heroKeywords.ts. Re-exported here so that
// consumers importing from './types.js' have access.
export type {
  HeroAbilityHook,
  HeroCondition,
  HeroEffectDescriptor,
} from './rules/heroAbility.types.js';
export type {
  HeroKeyword,
  HeroAbilityTiming,
} from './rules/heroKeywords.js';

// why: Villain/henchman ability hook contracts (VillainAbilityHook,
// VillainAbilityTiming, VillainEffectKeyword) are defined canonically in
// src/rules/villainAbility.types.ts (WP-185). Re-exported here so consumers
// importing from './types.js' have access. The canonical drift-detection
// arrays are value exports, so they use a separate export statement.
export type {
  VillainAbilityHook,
  VillainAbilityTiming,
  VillainEffectKeyword,
  VillainDefeatRequirement,
  VillainDefeatRequirementKind,
} from './rules/villainAbility.types.js';
export {
  VILLAIN_ABILITY_TIMINGS,
  VILLAIN_EFFECT_KEYWORDS,
  VILLAIN_DEFEAT_REQUIREMENT_KINDS,
} from './rules/villainAbility.types.js';

// why: WP-257 / D-24033 + D-24034 — hollow-effect detection contracts are
// defined canonically in src/diagnostics/hollowEffect.types.ts. Re-exported here
// so consumers importing from './types.js' have access. EFFECT_EXECUTION_REASONS
// + DEFERRED_BY_DESIGN_MECHANICS + HOLLOW_EFFECTS_CAP are value exports, so they
// use a separate export statement.
export type {
  EffectExecutionReason,
  EffectExecutionOutcome,
  HollowEffectRecord,
  GameDiagnostics,
} from './diagnostics/hollowEffect.types.js';
export {
  EFFECT_EXECUTION_REASONS,
  isHollowReason,
  HOLLOW_EFFECTS_CAP,
  DEFERRED_BY_DESIGN_MECHANICS,
} from './diagnostics/hollowEffect.types.js';

// why: WP-200 — notable game event contracts (NotableGameEvent,
// NotableGameEventType, SchemeTwistResolverKey, FightResolvedEvent,
// AmbushResolvedEvent, SchemeTwistResolvedEvent, MastermindStrikeResolvedEvent)
// are defined canonically in src/events/notableEvents.types.ts. Re-exported
// here so consumers importing from './types.js' have access. The canonical
// drift-detection arrays are value exports.
export type {
  NotableGameEvent,
  NotableGameEventType,
  SchemeTwistResolverKey,
  FightResolvedEvent,
  AmbushResolvedEvent,
  SchemeTwistResolvedEvent,
  MastermindStrikeResolvedEvent,
} from './events/notableEvents.types.js';
export {
  NOTABLE_EVENT_TYPES,
  SCHEME_TWIST_RESOLVER_KEYS,
} from './events/notableEvents.types.js';

// why: Zone types (CardExtId, PlayerZones, GlobalPiles) were originally
// defined inline in this file during WP-005B. WP-006A consolidated them
// into src/state/zones.types.ts as the canonical source. They are
// re-exported here so that existing imports from './types.js' continue
// to work without modification.
export type {
  CardExtId,
  Zone,
  PlayerZones,
  PlayerState,
  GlobalPiles,
  ZoneValidationError,
  GameStateShape,
} from './state/zones.types.js';

export type { BoardKeyword } from './board/boardKeywords.types.js';
export { BOARD_KEYWORDS } from './board/boardKeywords.types.js';
export type { SchemeSetupInstruction, SchemeSetupType } from './scheme/schemeSetup.types.js';
export type { SchemeState } from './scheme/schemeState.types.js';
export { SCHEME_SETUP_TYPES } from './scheme/schemeSetup.types.js';

// Replay types (WP-027)
export type { ReplayInput, ReplayMove, ReplayResult } from './replay/replay.types.js';

// Replay snapshot sequence types (WP-063)
export type {
  ReplaySnapshotSequence,
  ReplayInputsFile,
} from './replay/replaySnapshot.types.js';

// why: UI state types defined canonically in src/ui/uiState.types.ts
// (WP-028). Re-exported here so that consumers importing from './types.js'
// have access. UICardDisplay and UIHQCard added by WP-111 (sibling
// snapshot pattern shared with cardStats / villainDeckCardTypes /
// cardKeywords; surfaced through UIState additive shape changes).
export type {
  UIState,
  UIPlayerState,
  UICityCard,
  UICityState,
  UIHQState,
  UIMastermindState,
  UISchemeState,
  UITurnEconomyState,
  UIGameOverState,
  UICardDisplay,
  UIHQCard,
} from './ui/uiState.types.js';

// why: Campaign types (ScenarioDefinition, CampaignDefinition,
// CampaignState, ScenarioOutcome, and sub-types) are defined canonically
// in src/campaign/campaign.types.ts (WP-030). Re-exported here so that
// consumers importing from './types.js' have access. CampaignState is
// NOT a field of LegendaryGameState — campaign state is Class 2 data,
// external to the engine per D-0502.
export type {
  ScenarioOutcome,
  ScenarioOutcomeCondition,
  ScenarioReward,
  ScenarioDefinition,
  CampaignUnlockRule,
  CampaignDefinition,
  CampaignState,
} from './campaign/campaign.types.js';

// why: Invariant types (InvariantCategory, InvariantViolation,
// InvariantCheckContext) are defined canonically in
// src/invariants/invariants.types.ts (WP-031). The canonical
// INVARIANT_CATEGORIES array is a const export (not a type), so it
// uses a separate export statement. Re-exported here so that
// consumers importing from './types.js' have access.
export type {
  InvariantCategory,
  InvariantViolation,
  InvariantCheckContext,
} from './invariants/invariants.types.js';
export { INVARIANT_CATEGORIES } from './invariants/invariants.types.js';

// why: network intent contracts are engine-category types (D-3201)
// consumed by the server layer for transport wiring.
export type {
  ClientTurnIntent,
  IntentValidationResult,
  IntentRejectionCode,
  IntentValidationContext,
} from './network/intent.types.js';

// why: content validation types (WP-033) are engine-category types
// (D-3301) consumed by content-authoring tools. They are a pre-engine
// gate — NOT part of the boardgame.io lifecycle. Never wire them
// into game.ts, moves, or phase hooks.
export type {
  ContentValidationResult,
  ContentValidationError,
  ContentValidationContext,
} from './content/content.validate.js';

// why: Simulation types (WP-036 / D-3601) are engine-category types
// consumed by external balance tooling (D-0702). They live in src/simulation/
// under D-3601. Re-exported here so consumers importing from './types.js'
// have access to the pluggable AIPolicy interface and the SimulationResult
// contract.
export type {
  AIPolicy,
  LegalMove,
  SimulationConfig,
  SimulationResult,
} from './simulation/ai.types.js';

// why: PAR simulation types (WP-049) ship the T2 Competent Heuristic
// calibration pipeline. Pure types and the error-code union live in
// par.aggregator.ts; the tier taxonomy lives in ai.tiers.ts. Re-exported
// here so consumers importing from './types.js' have access to the full
// PAR surface.
export type {
  ParSimulationConfig,
  ParSimulationResult,
  ParValidationIssue,
  ParValidationSeverity,
  ParValidationResult,
  TierOrderingResult,
  ParAggregationErrorCode,
} from './simulation/par.aggregator.js';
export type {
  AIPolicyTier,
  AIPolicyTierDefinition,
} from './simulation/ai.tiers.js';

// Beta metadata (WP-037 / D-3701)
// why: Beta metadata types (BetaFeedback, BetaCohort, FeedbackCategory)
// are defined canonically in src/beta/beta.types.ts (WP-037 / D-3701).
// Re-exported here so consumers importing from './types.js' have access.
// These types are metadata-not-state — the engine never constructs or
// mutates instances, and BetaFeedback is never a field of
// LegendaryGameState. Construction lives in the server layer or future
// ops tooling per the D-3701 sub-rule.
export type {
  BetaFeedback,
  BetaCohort,
  FeedbackCategory,
} from './beta/beta.types.js';

// Governance metadata (WP-040 / D-4001)
// why: Governance metadata types (ChangeCategory, ChangeBudget,
// ChangeClassification) are defined canonically in
// src/governance/governance.types.ts (WP-040 / D-4001). Re-exported here
// so consumers importing from './types.js' have access. These types are
// out-of-band metadata — the engine never constructs or mutates instances,
// and none of them are fields of LegendaryGameState. See
// `docs/governance/CHANGE_GOVERNANCE.md` for the reader-facing prose.
export type {
  ChangeCategory,
  ChangeBudget,
  ChangeClassification,
} from './governance/governance.types.js';

import type { TurnStage } from './turn/turnPhases.types.js';
import type { CardExtId, PlayerZones, GlobalPiles } from './state/zones.types.js';
import type { TurnEconomy, CardStatEntry } from './economy/economy.types.js';
import type { CardTraitEntry } from './state/cardTraits.types.js';
import type { MastermindState } from './mastermind/mastermind.types.js';
import type { SchemeState } from './scheme/schemeState.types.js';
import type { HookDefinition } from './rules/ruleHooks.types.js';
import type { HeroAbilityHook } from './rules/heroAbility.types.js';
// why: D-24019 — PendingOptionalKoReward.rewardType is a value of the closed
// HeroKeyword union (the reward dispatched on KO).
import type { HeroKeyword } from './rules/heroKeywords.js';
import type {
  VillainAbilityHook,
  VillainDefeatRequirement,
} from './rules/villainAbility.types.js';
import type { NotableGameEvent } from './events/notableEvents.types.js';
// why: WP-257 / D-24034 — GameDiagnostics is the runtime-only hollow-effect
// channel shape (plain JSON; never persisted, never gameplay input).
import type { GameDiagnostics } from './diagnostics/hollowEffect.types.js';
import type { LobbyState } from './lobby/lobby.types.js';
import type { VillainDeckState, RevealedCardType } from './villainDeck/villainDeck.types.js';
import type { CityZone, HqZone } from './board/city.types.js';
import type { ScenarioScoringConfig } from './scoring/parScoring.types.js';
import type { UICardDisplay } from './ui/uiState.types.js';

// why: MatchConfiguration (WP-002) and MatchSetupConfig (WP-005A) have
// identical 9-field shapes. MatchSetupConfig in matchSetup.types.ts is now
// the canonical definition with full validation support. MatchConfiguration
// is retained as a type alias for backward compatibility with game.ts and
// existing tests. Both names refer to the same type. See DECISIONS.md for
// the consolidation rationale.

/**
 * Match configuration payload sent to boardgame.io Game.setup().
 *
 * This is a type alias for MatchSetupConfig — the canonical match setup
 * contract defined in matchSetup.types.ts. Both names are exported for
 * backward compatibility.
 *
 * All card references use ext_id strings from the card registry. Field names
 * are locked by 00.2 section 8.1 — do not rename, abbreviate, or reorder.
 */
export type MatchConfiguration = MatchSetupConfig;

// why: boardgame.io 0.50.x uses the string player-index convention
// ("0" | "1" | "2" | ... — the index of the seat within a match's
// playerOrder array) for every G-scoped player key. This alias names
// that convention without narrowing it — deliberately non-branded to
// avoid rippling into every test factory. A future WP may upgrade to
// `string & { readonly __brand: unique symbol }` or
// `` `${number}` `` if the ripple cost becomes justified.
export type PlayerId = string;

/**
 * Pending player-choice state set by the reveal-attack-choose executor.
 *
 * Cleared by resolveHeroChoice. Must be undefined at every turn-end.
 * Absent (undefined) means no pending choice. Second reveal-attack-choose
 * call while this field is set is rejected (reject-second, D-22001).
 */
export interface PendingHeroChoice {
  /** Discriminant for future extensibility (D-22001). */
  choiceType: 'discard-or-return';
  /** The revealed card still at deck[0] until the choice is resolved. */
  cardId: CardExtId;
  /** Only this player's resolveHeroChoice call is accepted. */
  playerID: string;
}

/**
 * Pending KO-a-Hero player choice state (WP-242 / D-24006).
 *
 * Created when a koHeroCurrentPlayer effect discovers ≥2 eligible targets.
 * Appended to G.pendingKoHeroChoices[] (FIFO queue). Removed (front-popped) by
 * resolveKoHeroChoice after the player selects a target. Must be undefined or
 * empty at every turn-end (enforced by dual turn-end guards).
 *
 * // why: D-24006 — the choice is "which of N cards to KO", not a binary
 * discard-vs-return. The pending entry records only the choosing player and
 * the queue position; eligibility is derived fresh from current G by the
 * projection, the move validation, and the bot auto-resolver. This eliminates
 * stale-target bugs across multi-KO queues.
 */
export interface PendingKoHeroChoice {
  /** Discriminant for future extensibility; always 'ko-hero'. */
  choiceType: 'ko-hero';
  /** The player who must select a hero to KO. */
  playerID: string;
  // why: WP-492 / D-24298 — the count of KOs this one entry still owes (Whirlwind
  // "KO two of your Heroes"). Additive OPTIONAL and append-only (D-24034): ABSENT
  // means 1, so every pre-existing single-KO entry is byte-identical (the M=1
  // parker OMITS this field, and resolveKoHeroChoice / the UIState projection read
  // `remaining ?? 1`). Present only on a magnitude ≥ 2 park (the parker writes the
  // owed count); the resolve move decrements it and front-pops when it reaches 0.
  remaining?: number;
}

/**
 * Pending Doombot scry-KO player choice state (WP-470 / D-24282).
 *
 * Created when a scry-ko-own-deck effect (Doombot Legion's Fight) looks at the
 * top two cards of the defeating player's own deck and there are ≥2 cards to
 * choose from. Appended to G.pendingScryKoChoices[] (FIFO queue). Removed
 * (front-popped) by resolveScryKoChoice after the player selects which revealed
 * card to KO. Must be undefined or empty at every turn-end (enforced by the
 * block-all guards).
 *
 * // why: D-24282 — unlike PendingKoHeroChoice (which stores NO snapshot and
 * recomputes eligibility fresh from current G, D-24007), this stores a snapshot
 * of the top two ext_ids in `revealedCardIds`. Justified: the block-all guard
 * freezes the deck top while the choice is pending, and KO-by-ext_id is
 * outcome-identical (moveCardFromZone removes the first occurrence, always
 * within the looked-at window — the same reasoning `villainEffectScryKoOwnDeck`
 * relied on for its auto-resolve). Recomputing like ko-hero would re-read the
 * deck the guard already froze, so the snapshot is both simpler and correct.
 */
export interface PendingScryKoChoice {
  /** Discriminant for future extensibility; always 'scry-ko'. */
  choiceType: 'scry-ko';
  /** The player who must select which revealed card to KO. */
  playerID: string;
  /** The top `min(2, deck.length)` deck ext_ids revealed at park time (the choices). */
  revealedCardIds: CardExtId[];
}

/**
 * Pending discard-to-limit player choice state (WP-476 / D-24284).
 *
 * Created when Magneto's Master Strike ("Each player reveals an [team:x-men]
 * Hero or discards down to four cards") forces the CURRENT player — who holds
 * no X-Men Hero to reveal — to discard down to the hand-size limit. Appended to
 * G.pendingDiscardChoices[] (FIFO queue). Removed (front-popped) by
 * resolveDiscardChoice after the player picks which cards to discard. Must be
 * undefined or empty at every turn-end (enforced by the block-all guards).
 *
 * // why: D-24284 — only the current player parks an interactive choice; every
 * non-current player who must discard is auto-picked synchronously inside the
 * strike (cheapest-first), because the pending-choice architecture is
 * single-current-player-scoped (the block-all guards + UIState projection + bot
 * resolver all key on the active player). Stores NO card snapshot — the choice
 * is "which of your hand cards to discard down to `limit`", validated fresh
 * against the current hand by the resolve move (the block-all guard freezes the
 * hand while pending). For 1p (the reported case) the current player is the
 * only player, so this fully fixes it.
 */
export interface PendingDiscardChoice {
  /** Discriminant for future extensibility; always 'discard-to-limit'. */
  choiceType: 'discard-to-limit';
  /** The player who must choose which cards to discard. */
  playerID: string;
  /** The hand-size the player must discard down to (MAGNETO_HAND_SIZE_LIMIT = 4). */
  limit: number;
}

/**
 * Pending put-cards-on-deck player choice state (WP-538 / D-24347).
 *
 * Created when core Dr. Doom's Master Strike ("Each player with exactly 6 cards
 * in hand reveals a [hc:tech] Hero or puts 2 cards from their hand on top of
 * their deck") forces the CURRENT player — who holds no Tech Hero to reveal — to
 * put cards on top of their deck. Appended to G.pendingPutCardsOnDeckChoices[]
 * (FIFO queue). Removed (front-popped) by resolvePutCardsOnDeckChoice after the
 * player picks which cards. Must be undefined or empty at every turn-end
 * (enforced by the block-all guards).
 *
 * // why: D-24347 — only the current player parks an interactive choice; every
 * non-current player who must put cards on deck is auto-picked synchronously
 * inside the strike (cheapest-first), because the pending-choice architecture is
 * single-current-player-scoped (mirrors PendingDiscardChoice, WP-476). Stores NO
 * card snapshot — the choice is "which `count` of your hand cards to put on top",
 * validated fresh against the current hand by the resolve move (the block-all
 * guard freezes the hand while pending). Selection order = deck-top order
 * (cardIds[0] ends up on top, drawn first).
 */
export interface PendingPutCardsOnDeckChoice {
  /** Discriminant for future extensibility; always 'put-cards-on-deck'. */
  choiceType: 'put-cards-on-deck';
  /** The player who must choose which cards to put on top of their deck. */
  playerID: string;
  /** How many cards the player must put on top (DOOM_PUT_ON_DECK_COUNT = 2). */
  count: number;
}

/**
 * Pending reveal-remainder reorder player choice state (WP-479 / D-24286).
 *
 * Created when a reveal marked `reorderRemainder` (The Amazing Spider-Man's
 * "Put the rest back in any order") leaves ≥2 revealed-but-not-drawn cards on
 * top of the current player's deck. Appended to G.pendingReorderChoices[] (FIFO
 * queue). Removed (front-popped) by resolveReorderChoice after the player picks
 * the order to put those cards back on top. Must be undefined or empty at every
 * turn-end (enforced by the block-all guards).
 *
 * // why: D-24286 — like PendingScryKoChoice this stores a snapshot of the
 * remainder ext_ids in `cardIds` (the top-N of the deck at park time). The
 * block-all guard freezes the deck top while the choice is pending, so the
 * snapshot cannot drift; resolveReorderChoice accepts only a permutation of
 * `cardIds` and rewrites the top-N to that order. Only the current player
 * reorders their own deck (reveal is a current-player effect).
 */
export interface PendingReorderChoice {
  /** Discriminant for future extensibility; always 'reorder-deck-top'. */
  choiceType: 'reorder-deck-top';
  /** The player who must choose the order of the remainder. */
  playerID: string;
  /** The revealed remainder (top-N of the deck) at park time, in current order (the cards to reorder). */
  cardIds: CardExtId[];
}

/**
 * One eligible target of Silent Sniper's `defeat-with-bystander` hero effect
 * (WP-486 / D-24291).
 *
 * A target is either a City Villain that holds ≥1 attached Bystander, or the
 * Mastermind (its current tactic) when the Mastermind holds ≥1 captured Bystander
 * AND at least one tactic remains. The eligible-target list is built
 * deterministically (City spaces ascending, Mastermind last) so the UIState
 * projection and the bot/sim default agree byte-for-byte.
 */
export interface DefeatWithBystanderTarget {
  /** Which store the target lives in — a City villain or the Mastermind tactic. */
  kind: 'villain' | 'mastermind';
  /**
   * The City space index for a `villain` target (its unique, block-all-frozen
   * selector); `undefined` for the `mastermind` target.
   */
  cityIndex?: number | undefined;
  /**
   * Display identity: the villain's ext_id for a `villain` target, or the
   * Mastermind's baseCardId for the `mastermind` target (used only for the
   * client prompt label — never a stat/gameplay key).
   */
  cardId: CardExtId;
}

/**
 * Pending defeat-with-a-Bystander player choice state (WP-486 / D-24291).
 *
 * Created when Silent Sniper is played and ≥2 eligible targets qualify — the
 * player must pick which Villain or the Mastermind to defeat for free. Appended
 * to G.pendingDefeatChoices[] (FIFO queue); front-popped by resolveDefeatChoice
 * BEFORE it dispatches the defeat (so a villain's onFight-parked nested choice
 * lands behind it in FIFO). Must be undefined or empty at every turn-end
 * (enforced by the block-all guards).
 *
 * // why: D-24291 — the block-all guard freezes the board while pending, so the
 * snapshotted `targets` cannot drift; resolveDefeatChoice accepts only a target
 * present in this snapshot. Only the current player (who played the card)
 * resolves it.
 */
export interface PendingDefeatChoice {
  /** Discriminant; always 'defeat-with-bystander'. */
  choiceType: 'defeat-with-bystander';
  /** The player who must choose which target to defeat. */
  playerID: string;
  /** The eligible targets at park time, in deterministic order (City ascending, Mastermind last). */
  targets: DefeatWithBystanderTarget[];
}

/**
 * A pending Copy Powers choice — parked by the `copy-powers` hero-effect handler
 * (Rogue's "Copy Powers": "Play this card as a copy of another Hero you played this
 * turn.") when the current player has ≥ 2 eligible Heroes to copy (WP-535 / D-24345).
 *
 * The player picks which Hero to copy; `resolveCopyPowersChoice` re-fires that Hero's
 * on-play ability (via the reentrant `executeHeroEffects`) and grants Copy Powers the
 * copied class. Appended to `G.pendingCopyPowersChoices[]` (FIFO queue); front-popped by
 * `resolveCopyPowersChoice` BEFORE it applies the copy (so a copied ability that parks
 * its OWN nested pending lands behind it in FIFO). Must be undefined or empty at every
 * turn-end (enforced by the block-all guards).
 *
 * // why: WP-535 — the block-all guard freezes the board while pending, so the eligible
 * Hero set (recomputed fresh from `inPlay`, the round-trip rule) cannot drift;
 * resolveCopyPowersChoice accepts only a Hero eligible NOW. Only the current player (who
 * played Copy Powers) resolves it. No eligible snapshot is stored — `sourceCardId` alone
 * identifies which Copy Powers card the runtime dual-class is granted to.
 */
export interface PendingCopyPowersChoice {
  /** Discriminant; always 'copy-powers'. */
  choiceType: 'copy-powers';
  /** The player who must choose which Hero to copy. */
  playerID: string;
  /** The Copy Powers card ext_id doing the copying (the runtime dual-class grant target). */
  sourceCardId: CardExtId;
}

/**
 * Pending optional-KO-then-reward player choice state (WP-248 / D-24019).
 *
 * Created when an optional-ko-reward hero effect is played (`onPlay`) and the
 * player has at least one card in hand or discard. Appended to
 * G.pendingOptionalKoRewards[] (FIFO queue). Removed (front-popped) by
 * resolveOptionalKoReward after the player declines or KOs a chosen card. Must
 * be undefined or empty at every turn-end (enforced by the block-all guards).
 *
 * // why: D-24019 — the choice is "decline, or KO one of your hand/discard
 * cards (→ reward)". The pending entry records the choosing player, the reward
 * to grant on KO, the reward magnitude, and the source card; eligible cards are
 * recomputed fresh from current G by the move validation and the bot
 * auto-resolver (no snapshot, mirrors WP-242's PendingKoHeroChoice).
 */
export interface PendingOptionalKoReward {
  /** The player who must decline or choose a card to KO. */
  playerID: string;
  /** The reward granted iff the player KOs a card (dispatched to the existing executor). */
  rewardType: HeroKeyword;
  /** The reward magnitude passed to the reward executor. */
  rewardMagnitude: number;
  /** The hero card whose ability parked this choice (passed to the reward executor). */
  sourceCardId: CardExtId;
}

/**
 * Pending victory-pile villain-pick player choice state (WP-285 / D-24067).
 *
 * Created when a victory-villain-attack hero effect fires (`onPlay`) and the
 * player has at least one villain in their victory pile. Appended to
 * G.pendingVictoryPileCardPick[] (FIFO queue). Removed (front-popped) by
 * resolveVictoryPileCardPick after the player picks a villain. Must be
 * undefined or empty at every turn-end (enforced by the block-all guards).
 *
 * // why: D-24067 — the player picks one villain from their victory pile and
 * gains attack equal to its printed attack value. The pending entry records the
 * player owed a pick. Eligible villains are recomputed fresh from G at resolve
 * time (no snapshot — the victory pile may change between park and resolve).
 */
export interface PendingVictoryPileCardPick {
  /** The player who must pick a villain from their victory pile. */
  playerID: string;
  /** Discriminant for future extensibility; always 'attack'. */
  rewardType: 'attack';
}

/**
 * Pending draw-or-empowered player choice state (WP-286 / D-24069).
 *
 * Created when a draw-or-empowered hero effect is played (`onPlay`) — the printed
 * "Choose one: Draw a card, or you get Empowered by [class]" form (One-Hit Wonder).
 * Appended to G.pendingDrawOrEmpowered[] (FIFO queue). Removed (front-popped) by
 * resolveDrawOrEmpowered after the player (or bot) picks 'draw' or 'empowered'. Must
 * be undefined or empty at every turn-end (enforced by the block-all guards).
 *
 * // why: D-24069 — the choice is heterogeneous (draw a card vs. an attack bonus), so
 * it is modeled as an interactive pending choice, NOT an oracle-max like the WP-283
 * two-empowered choose-one form. The pending entry records the choosing player and the
 * empowered hero class parsed at setup time; the 'empowered' branch reuses
 * buildEmpoweredComposition(empoweredClass) at resolve time (no re-implementation of
 * the count).
 */
export interface PendingDrawOrEmpowered {
  /** The player who must pick 'draw' or 'empowered'. */
  playerID: string;
  /** The normalized empowered hero class parsed from the card text (the count parameter). */
  empoweredClass: string;
}

/**
 * Pending mandatory return-zero-cost-discard player choice state (D-24139).
 *
 * Created when a return-zero-cost-discard hero effect fires (`onPlay`) — the
 * printed "Return a 0-cost card from your discard pile to your hand" form
 * (Black Knight's Defend the Weak) — and the chooser's discard pile holds at
 * least one 0-cost card. Appended to G.pendingReturnZeroCostDiscard[] (FIFO
 * queue). Removed (front-popped) by resolveReturnZeroCostDiscard after the
 * player (or bot) picks a card. Must be undefined or empty at every turn-end
 * (enforced by the block-all guards).
 *
 * // why: the choice is mandatory — the printed text has no "you may", so no
 * decline shape exists. Discard contents are read fresh at resolve time via
 * the shared isZeroCostCard predicate (the full block-all guard set freezes
 * the board between park and resolve, so the discard cannot drift).
 */
export interface PendingReturnZeroCostDiscard {
  /** The player who must pick a 0-cost discard-pile card to return to hand. */
  playerID: string;
  /** The hero card whose ability parked this choice (for provenance logging). */
  sourceCardId: CardExtId;
}

/**
 * Pending optional return-on-discard choice state (D-24301).
 *
 * Created when a card effect discards a hero card carrying the `return-on-discard`
 * keyword (Cyclops Unending Energy) from a player's hand — the discardFromHand
 * chokepoint's checkReturnOnDiscard reaction appends one entry to
 * G.pendingReturnOnDiscard[] (FIFO). resolveReturnOnDiscard front-pops it after the
 * player accepts (moving the card discard→hand) or declines. Must be undefined or
 * empty at every turn-end (enforced by the block-all guards).
 *
 * // why: the printed text is "you MAY return this card to your hand" — an OPTIONAL,
 * decline-shaped choice (unlike the mandatory PendingReturnZeroCostDiscard /
 * PendingDiscardToPlay). The reaction fires at the chokepoint AFTER the card has
 * already moved to the discard pile, so `cardId` is the exact discarded card that
 * may be returned; discard contents are read fresh at resolve time.
 */
export interface PendingReturnOnDiscard {
  /** The player who may return the discarded card to their hand. */
  playerID: string;
  /** The just-discarded hero card (now in the player's discard pile) that may return. */
  cardId: CardExtId;
}

/**
 * Pending give-HQ-Hero player choice state (WP-532 / D-24343).
 *
 * Created when the `give-hq-hero-each-player` villain-effect handler (Paibok the
 * Power Skrull Fight) reaches the CURRENT (fighting) player with ≥ 2 HQ Heroes
 * available — it appends one entry to G.pendingGiveHqHeroChoices[] (FIFO).
 * resolveGiveHqHeroChoice front-pops it after the player picks which HQ Hero to
 * gain (moving that Hero into their discard + refilling the HQ slot). Must be
 * undefined or empty at every turn-end (enforced by the block-all guards).
 *
 * // why: D-24343 — the current (fighting) player picks WHICH HQ Hero interactively
 * (the D-24284 current-parks / others-auto split); every OTHER player — and a
 * bot-driven current player, via ai.legalMoves — auto-gains the highest-cost HQ
 * Hero synchronously, so only the current player ever parks an entry. Eligibility is
 * derived fresh from the PUBLIC G.hq by the projection, the move validation, and the
 * bot default (no snapshot) — HQ contents are public, so no hand-leak redaction. The
 * choice is single-Hero (no `remaining`): each player gains exactly one Hero.
 */
export interface PendingGiveHqHeroChoice {
  /** Discriminant for future extensibility; always 'give-hq-hero'. */
  choiceType: 'give-hq-hero';
  /** The player who must pick an HQ Hero to gain. */
  playerID: string;
}

/**
 * Pending mandatory discard-to-play cost choice state (D-24184).
 *
 * Created when a card printed "To play this card, you must discard a card from
 * your hand" is played (Cyclops Determination/Optic Blast + siblings). The
 * `discard-to-play` keyword's park handler appends one entry to
 * G.pendingDiscardToPlay[] (FIFO). The player must discard `remaining` card(s)
 * FROM THEIR HAND; resolveDiscardToPlay moves one chosen hand card to discard
 * per call, decrementing `remaining`, and front-pops the entry when it reaches
 * 0. Must be undefined or empty at every turn-end (enforced by the block-all
 * guards).
 *
 * // why: the choice is a mandatory COST — there is no "you may", so no decline
 * shape. Payability (hand holds ≥ `remaining` OTHER cards) is pre-guaranteed by
 * the D-24185 pre-commit precondition in playCard, so the base power never leaks
 * on an unpayable play. Hand contents are read fresh at resolve time; the full
 * block-all guard set freezes the board between park and resolve.
 */
export interface PendingDiscardToPlay {
  /** The player who must discard from hand to complete the play. */
  playerID: string;
  /** The hero card whose cost parked this choice (already in inPlay; for provenance). */
  sourceCardId: CardExtId;
  /** How many more cards the player must still discard (starts at the cost magnitude). */
  remaining: number;
}

/**
 * Pending optional-put-bottom-HQ player choice state (optional zone manipulation).
 *
 * Created when an optional-put-bottom-hq hero effect fires (`onPlay`) — the printed
 * "You may put a card from the HQ on the bottom of the Hero Deck" form (Ionic Energy).
 * Appended to G.pendingOptionalPutBottomHQ[] (FIFO queue). Removed (front-popped) by
 * resolveOptionalPutBottomHQ after the player (or bot) declines or chooses a card. Must
 * be undefined or empty at every turn-end (enforced by the block-all guards).
 *
 * // why: the choice is "decline, or select one card from the HQ and move it to the
 * bottom of the deck". The pending entry records the choosing player and the source card
 * whose ability parked this choice (for logging/provenance). HQ contents are read fresh
 * at resolve time (the HQ may change between park and resolve).
 */
export interface PendingOptionalPutBottomHQ {
  /** The player who must decline or choose an HQ card. */
  playerID: string;
  /** The hero card whose ability parked this choice (for provenance logging). */
  sourceCardId: CardExtId;
  /**
   * When true, the player MUST choose an HQ card — Decline is not offered (the
   * printed "Put a card from the HQ…" mandatory form, e.g. Absorb Ambient Power).
   * Absent/false is the optional "You may put a card…" form (Ionic Energy).
   */
  mandatory?: boolean | undefined;
  /**
   * When set, after the chosen card moves to the Hero Deck bottom the player gets
   * this many +recruit if that card had a recruit icon AND this many +attack if it
   * had an attack icon (both if both). The icon-conditional reward on Absorb Ambient
   * Power ("+3 recruit / +3 attack"). Absent = no reward (Ionic Energy).
   */
  iconRewardMagnitude?: number | undefined;
}

/**
 * Pending put-any-number-bottom-HQ player choice state (D-24132).
 *
 * Created when a put-any-number-bottom-hq hero effect fires (`onPlay`) — the printed
 * "Choose any number of cards/Heroes from the HQ. Put them on the bottom of the Hero
 * Deck" form (Wonder Man's 8th Wonder of the World, Sunspot's Empyreal Force, Star-Lord
 * (T'Challa)'s Colliding Dreams). The MULTI-select sibling of PendingOptionalPutBottomHQ.
 * Appended to G.pendingPutAnyNumberBottomHQ[] (FIFO queue). Removed (front-popped) by
 * resolvePutAnyNumberBottomHQ after the player (or bot) submits a selection (possibly
 * empty). Must be undefined or empty at every turn-end (enforced by the block-all guards).
 *
 * // why: D-24132 — the choice is "select any number of HQ cards (zero is valid) and move
 * each to the bottom of the shared Hero Deck". The pending entry records the choosing
 * player, the source card whose ability parked it (provenance logging), and any trailing
 * "Then you get Empowered by [classes]" grant to apply AFTER the moves resolve (printed
 * order — the HQ is reshaped first, then counted). HQ contents are read fresh at resolve
 * time (the HQ may change between park and resolve).
 */
export interface PendingPutAnyNumberBottomHQ {
  /** The player who must submit a selection of HQ cards (possibly empty). */
  playerID: string;
  /** The hero card whose ability parked this choice (for provenance logging). */
  sourceCardId: CardExtId;
  // why: D-24132 — the trailing "Then you get Empowered by [classes]" grant, applied
  // AFTER the moves resolve (each class reuses buildEmpoweredComposition, mirroring the
  // draw-or-empowered resolve path). Omitted entirely when the printed text has no
  // Empowered tail (Empyreal Force / Colliding Dreams line 1), so absent and present-but-
  // empty are both "no Empowered" and the field is omit-when-empty for determinism.
  empoweredClasses?: string[];
}

/**
 * Minimal setup-time context interface for deterministic operations.
 *
 * Captures what buildInitialGameState needs from the boardgame.io setup
 * context. Satisfied by the real boardgame.io context (via structural
 * typing) and by makeMockCtx (in tests).
 *
 * Defined locally to avoid importing boardgame.io in pure helpers.
 *
 * boardgame.io 0.50.x setup signature is:
 *   setup(context: { ctx: Ctx, random: RandomAPI, events, log }, setupData?)
 * The `ctx` sub-object carries match metadata (numPlayers, currentPlayer,
 * phase, turn). The `random` plugin API lives on the context itself, NOT
 * on ctx. This interface mirrors that nesting so that the real boardgame.io
 * context is structurally assignable without casting.
 */
export interface SetupContext {
  /** boardgame.io context metadata — numPlayers lives here, not at top level. */
  ctx: { numPlayers: number };
  /** Deterministic RNG provided by boardgame.io's random plugin. */
  random: { Shuffle: <T>(deck: T[]) => T[] };
}

/**
 * Resolved match selection metadata copied from the validated config.
 *
 * Stores the ext_id references for the scheme, mastermind, villain groups,
 * henchman groups, and hero decks selected for this match.
 */
export interface MatchSelection {
  /** Scheme ext_id selected for this match. */
  readonly schemeId: string;
  /** Mastermind ext_id selected for this match. */
  readonly mastermindId: string;
  /** Villain group ext_ids selected for this match. */
  readonly villainGroupIds: readonly string[];
  /** Henchman group ext_ids selected for this match. */
  readonly henchmanGroupIds: readonly string[];
  /** Hero deck ext_ids selected for this match. */
  readonly heroDeckIds: readonly string[];
}

/**
 * The shape of boardgame.io game state (G).
 *
 * Invariant: G must be JSON-serializable at all times. No functions, classes,
 * Maps, Sets, Dates, or Symbols may appear anywhere in this type or its
 * descendants.
 */
export interface LegendaryGameState {
  /** The match configuration used to set up this game. Immutable after setup. */
  readonly matchConfiguration: MatchConfiguration;

  // why: selection extracts the entity reference fields from matchConfiguration
  // for convenient read access. matchConfiguration is the full 9-field input;
  // selection holds just the scheme, mastermind, and group ext_ids.
  /** Resolved match selection metadata (scheme, mastermind, groups, heroes). */
  readonly selection: MatchSelection;

  // why: boardgame.io's ctx does not expose the inner turn stage in a form
  // that move functions can read. Storing currentStage in G makes it observable
  // to moves (for stage gating) and JSON-serializable (for replay and snapshots).
  // Reset to the first TURN_STAGES entry on each new turn by the play phase
  // onBegin hook.
  /** Current turn stage within the play phase (start, main, cleanup). */
  currentStage: TurnStage;

  // why: tracks whether the once-per-turn start-of-turn villain reveal has been
  // consumed this turn. Optional so existing full-LegendaryGameState literals
  // across the test suite need no edit (absent is treated as not-yet-revealed).
  // Set by the revealVillainCard wrapper when the player's reveal attempt is
  // consumed; reset to false each turn by the play phase onBegin hook.
  /** Whether the start-of-turn villain reveal has been consumed this turn. */
  villainRevealedThisTurn?: boolean;

  // why: tracks whether the start-of-turn draw has been consumed this turn.
  // Optional so existing full-LegendaryGameState literals across the test suite
  // need no edit (absent is treated as not-yet-drawn). Set by the play phase
  // onBegin auto-draw and by the drawCards move when a draw attempt is consumed;
  // reset to false each turn by the play phase onBegin hook. Internal G state —
  // it is NOT projected to UIState (the deleted Draw button was the only UI
  // consumer; the drawn hand surfaces through the normal UIState push).
  /** Whether the start-of-turn draw has been consumed this turn. */
  hasDrawnThisTurn?: boolean;

  // why: WP-379 / D-24180 — tracks whether the current player has recruited or
  // fought this turn. Set true by fightVillain / recruitHero / fightMastermind on a
  // successful commit; gates the Wound Healing ability (a player may heal only if
  // they have NOT acted). Structural, NOT derived from G.turnEconomy — a 0-cost
  // fight or recruit still counts as acting per the printed rule. Optional so
  // existing full-LegendaryGameState literals across the test suite need no edit
  // (absent = not-yet-acted). Reset to false each turn by the play phase onBegin hook.
  /** Whether the current player has recruited or fought this turn (gates Healing). */
  hasActedThisTurn?: boolean;

  // why: WP-379 / D-24179 / D-24180 — tracks whether the current player has used the
  // Wound "Healing" ability this turn. Set true by healWounds; reverse-locks
  // fightVillain / recruitHero / fightMastermind for the rest of the turn. Optional
  // so existing full-LegendaryGameState literals need no edit (absent = not-yet-healed).
  // Reset to false each turn by the play phase onBegin hook.
  /** Whether the current player has used the Wound Healing ability this turn. */
  hasHealedThisTurn?: boolean;

  // why: WP-409 / D-24221 — observability-only per-turn transient. Counts the hero
  // effects that FIRED for the most recent play this turn (each executeSingleEffect
  // that reached its handler + each top-level primitiveEffect that ran; condition-
  // gated and safe-skipped effects excluded). Set by applyCardPlay from the
  // executeHeroEffects return; reset to 0 each turn by the play phase onBegin hook.
  // Excluded from the finalStateHash oracle (hashGameState.ts, the same mechanism as
  // messages) so recorded sentinel hashes stay byte-unchanged. Optional so existing
  // full-LegendaryGameState literals need no edit (absent = no play yet this turn).
  // Nothing reads it for rules — it feeds the future client tiered combo/synergy cue.
  /** Count of hero effects that fired for the most recent play this turn (observability only). */
  lastPlayEffectsFired?: number;

  // why: WP-497 / D-24300 — per-player next-`onBegin` hand-fill override, keyed by
  // PlayerID; value = that player's next fill target (e.g. 8 for Doc Ock's "Octet
  // of Valence Electrons" tactic). Written only by a tactic resolver
  // (rules/tacticHandlers.ts); read-and-deleted only at the play-phase `onBegin`
  // fill for the keyed player. It is gameplay-affecting so it MUST be hashed (not
  // excluded like lastPlayEffectsFired), but — following that same hygiene pattern
  // — it is **lazily created**, NEVER seeded in buildInitialGameState: an untriggered
  // game leaves it undefined, so canonical JSON omits it and every committed
  // replay/sentinel oracle stays byte-identical (no re-pin). Absent = no override.
  /** Per-player next-`onBegin` hand-fill override (lazy; WP-497 / D-24300). */
  handSizeOverrides?: Record<string, number>;

  // why: pending player-choice state set by reveal-attack-choose executor (D-22001).
  // Must be undefined at every turn-end. Optional so existing test state literals
  // do not need updating. Absent (undefined) = no pending choice.
  /** Pending hero reveal choice awaiting player resolution (WP-220 / D-22001). */
  pendingHeroChoice?: PendingHeroChoice | undefined;

  // why: WP-242 / D-24006 — FIFO queue of pending KO-a-Hero choices (one per
  // player owing a choice). Entries are appended by koHeroCurrentPlayer when
  // ≥2 eligible targets exist; front-popped by resolveKoHeroChoice after the
  // player selects. Must be undefined or empty at every turn-end. Optional so
  // existing test state literals do not need updating. Absent (undefined) or
  // empty [] both mean "no pending choice" (guards test `.length`).
  /** FIFO queue of pending KO-a-Hero choices awaiting player resolution (WP-242). */
  pendingKoHeroChoices?: PendingKoHeroChoice[] | undefined;

  // why: WP-470 / D-24282 — FIFO queue of pending Doombot scry-KO choices (one
  // per Doombot Legion Fight defeated with ≥2 cards in the defeating player's
  // deck). Entries are appended by villainEffectScryKoOwnDeck's park branch;
  // front-popped by resolveScryKoChoice after the player picks which revealed
  // card to KO. Must be undefined or empty at every turn-end. Runtime-only,
  // never persisted (snapshots stay counts-only), mirroring pendingKoHeroChoices;
  // **lazily initialized at the park site, never in Game.setup**. Optional so
  // existing test state literals need no update. Absent (undefined) or empty []
  // both mean "no pending choice" (guards test `.length`).
  /** FIFO queue of pending Doombot scry-KO choices awaiting player resolution (WP-470). */
  pendingScryKoChoices?: PendingScryKoChoice[] | undefined;

  // why: WP-476 / D-24284 — FIFO queue of pending discard-to-limit choices (at
  // most one per Magneto Master Strike, parked ONLY for the current player who
  // must discard and holds no X-Men Hero to reveal). Entries are appended by
  // resolveMagnetoStrike's park branch; front-popped by resolveDiscardChoice
  // after the player picks which cards to discard. Must be undefined or empty at
  // every turn-end. Runtime-only, never persisted (snapshots stay counts-only),
  // mirroring pendingScryKoChoices; **lazily initialized at the park site, never
  // in Game.setup**. Optional so existing test state literals need no update.
  // Absent (undefined) or empty [] both mean "no pending choice" (guards test
  // `.length`).
  /** FIFO queue of pending discard-to-limit choices awaiting player resolution (WP-476). */
  pendingDiscardChoices?: PendingDiscardChoice[] | undefined;

  // why: WP-538 / D-24347 — FIFO queue of pending put-cards-on-deck choices (at
  // most one per core Dr. Doom Master Strike, parked ONLY for the current player
  // who must put 2 cards on top and holds no Tech Hero to reveal). Entries are
  // appended by resolveCoreDoomStrike's park branch; front-popped by
  // resolvePutCardsOnDeckChoice after the player picks which cards. Must be
  // undefined or empty at every turn-end. Runtime-only, never persisted
  // (snapshots stay counts-only), mirroring pendingDiscardChoices; **lazily
  // initialized at the park site, never in Game.setup**. Optional so existing
  // test state literals need no update. Absent (undefined) or empty [] both mean
  // "no pending choice" (guards test `.length`).
  /** FIFO queue of pending put-cards-on-deck choices awaiting player resolution (WP-538). */
  pendingPutCardsOnDeckChoices?: PendingPutCardsOnDeckChoice[] | undefined;

  // why: WP-479 / D-24286 — FIFO queue of pending reveal-remainder reorder choices
  // (at most one per reorder-marked reveal, parked ONLY for the current player when
  // ≥2 revealed cards remained on top). Entries are appended by heroEffectReveal's
  // post-loop park branch; front-popped by resolveReorderChoice after the player
  // picks the order. Must be undefined or empty at every turn-end. Runtime-only,
  // never persisted (snapshots stay counts-only), mirroring pendingDiscardChoices;
  // **lazily initialized at the park site, never in Game.setup**. Optional so
  // existing test state literals need no update. Absent (undefined) or empty []
  // both mean "no pending choice" (guards test `.length`).
  /** FIFO queue of pending reveal-remainder reorder choices awaiting player resolution (WP-479). */
  pendingReorderChoices?: PendingReorderChoice[] | undefined;

  // why: WP-486 / D-24291 — FIFO queue of pending defeat-with-a-Bystander choices
  // (parked ONLY for the current player when Silent Sniper's `defeat-with-bystander`
  // effect found ≥2 eligible targets). Entries are appended by
  // heroEffectDefeatWithBystander's ≥2 branch; front-popped by resolveDefeatChoice
  // BEFORE it dispatches the defeat (a nested onFight park lands behind it, FIFO).
  // Must be undefined or empty at every turn-end. Runtime-only, never persisted
  // (snapshots stay counts-only), mirroring pendingReorderChoices; **lazily
  // initialized at the park site, never in Game.setup**. Optional so existing test
  // state literals need no update. Absent (undefined) or empty [] both mean "no
  // pending choice" (guards test `.length`).
  /** FIFO queue of pending defeat-with-a-Bystander choices awaiting player resolution (WP-486). */
  pendingDefeatChoices?: PendingDefeatChoice[] | undefined;

  // why: WP-248 / D-24019 — FIFO queue of pending optional-KO-then-reward
  // choices (one per played optional-ko-reward hero ability with ≥1 eligible
  // card). Entries are appended by the executor park case; front-popped by
  // resolveOptionalKoReward after the player declines or KOs a card. Must be
  // undefined or empty at every turn-end. Optional so existing test state
  // literals do not need updating; **lazily initialized at the park site, never
  // in Game.setup** (mirrors villainEffects.execute.ts:190). Absent (undefined)
  // or empty [] both mean "no pending choice" (guards test `.length`).
  /** FIFO queue of pending optional-KO-then-reward choices awaiting resolution (WP-248). */
  pendingOptionalKoRewards?: PendingOptionalKoReward[] | undefined;

  // why: WP-285 / D-24067 — FIFO queue of pending victory-pile villain-pick
  // choices (one per played victory-villain-attack hero ability with ≥1 villain
  // in the victory pile). Entries are appended by the executor park case;
  // front-popped by resolveVictoryPileCardPick after the player picks a villain.
  // Must be undefined or empty at every turn-end. Optional so existing test
  // state literals do not need updating; **lazily initialized at the park site,
  // never in Game.setup** (D-24067). Absent (undefined) or empty [] both mean
  // "no pending pick" (guards test `.length`).
  // why: pendingVictoryPileCardPick is lazy-init (D-24067); undefined and [] both mean no pending pick
  /** FIFO queue of pending victory-pile villain-pick choices awaiting resolution (WP-285). */
  pendingVictoryPileCardPick?: PendingVictoryPileCardPick[] | undefined;

  // why: WP-286 / D-24069 — FIFO queue of pending draw-or-empowered choices (one per
  // played draw-or-empowered hero ability — the "Choose one: Draw a card, or Empowered
  // by [class]" form). Entries are appended by the executor park case; front-popped by
  // resolveDrawOrEmpowered after the player picks 'draw' or 'empowered'. Must be undefined
  // or empty at every turn-end. Optional so existing test state literals do not need
  // updating; **lazily initialized at the park site, never in Game.setup** (D-24069).
  // Absent (undefined) or empty [] both mean "no pending choice" (guards test `.length`).
  /** FIFO queue of pending draw-or-empowered choices awaiting resolution (WP-286). */
  pendingDrawOrEmpowered?: PendingDrawOrEmpowered[] | undefined;

  // why: FIFO queue of pending optional-put-bottom-hq choices (one per played
  // optional-put-bottom-hq hero ability — the "You may put a card from the HQ on
  // the bottom of the Hero Deck" form). Entries are appended by the executor park
  // case; front-popped by resolveOptionalPutBottomHQ after the player declines or
  // chooses a card. Must be undefined or empty at every turn-end. Optional so
  // existing test state literals do not need updating; **lazily initialized at the
  // park site, never in Game.setup**. Absent (undefined) or empty [] both mean
  // "no pending choice" (guards test `.length`).
  /** FIFO queue of pending optional-put-bottom-hq choices awaiting resolution. */
  pendingOptionalPutBottomHQ?: PendingOptionalPutBottomHQ[] | undefined;

  // why: D-24132 — FIFO queue of pending put-any-number-bottom-hq choices (one per
  // played put-any-number-bottom-hq hero card). Lazy-init at the park site (never in
  // Game.setup); absent (undefined) or empty [] both mean "no pending choice" (guards
  // test `.length`). The MULTI-select sibling of pendingOptionalPutBottomHQ.
  /** FIFO queue of pending put-any-number-bottom-hq choices awaiting resolution (D-24132). */
  pendingPutAnyNumberBottomHQ?: PendingPutAnyNumberBottomHQ[] | undefined;

  // why: D-24139 — FIFO queue of pending return-zero-cost-discard choices (one
  // per played return-zero-cost-discard hero ability with ≥1 eligible 0-cost
  // discard card). Entries are appended by the executor park case; front-popped
  // by resolveReturnZeroCostDiscard after the player picks a card. Must be
  // undefined or empty at every turn-end. Optional so existing test state
  // literals do not need updating; **lazily initialized at the park site, never
  // in Game.setup**. Absent (undefined) or empty [] both mean "no pending
  // choice" (guards test `.length`).
  /** FIFO queue of pending return-zero-cost-discard choices awaiting resolution (D-24139). */
  pendingReturnZeroCostDiscard?: PendingReturnZeroCostDiscard[] | undefined;

  // why: WP-383 / D-24184 — a discard-to-play COST parks one entry when a card
  // printed "To play this card, you must discard a card from your hand" is
  // played (Cyclops Determination/Optic Blast + siblings). Payability is
  // pre-guaranteed by the D-24185 precondition in playCard (an unpayable play
  // never commits), so the park always has ≥ `remaining` eligible hand cards.
  // Front-popped by resolveDiscardToPlay once `remaining` reaches 0. Must be
  // undefined or empty at every turn-end. Optional so existing test state
  // literals do not need updating; **lazily initialized at the park site, never
  // in Game.setup**.
  /** FIFO queue of pending discard-to-play cost choices awaiting resolution (D-24184). */
  pendingDiscardToPlay?: PendingDiscardToPlay[] | undefined;

  // why: WP-498 / D-24301 — a card effect that discards a `return-on-discard` hero
  // card (Cyclops Unending Energy) from a player's hand parks one entry at the
  // discardFromHand chokepoint (checkReturnOnDiscard). The choice is OPTIONAL ("you
  // may return this card"); resolveReturnOnDiscard front-pops it on accept (card
  // moves discard→hand) or decline (card stays in discard). Must be undefined or
  // empty at every turn-end. Optional so existing test state literals do not need
  // updating; **lazily initialized at the park site, never in Game.setup** — this
  // is what keeps the empty-replay PRE_WP080_HASH / hashGameState oracles from
  // re-pinning (canonical JSON omits an undefined field).
  /** FIFO queue of pending optional return-on-discard choices awaiting resolution (D-24301). */
  pendingReturnOnDiscard?: PendingReturnOnDiscard[] | undefined;
  // why: WP-532 / D-24343 — the current (fighting) player's pending give-HQ-Hero pick
  // (Paibok Fight). Optional so existing test-state literals need no update; **lazily
  // initialized at the park site, never in Game.setup** — an undefined field is omitted
  // from canonical JSON, keeping the empty-replay PRE_WP080_HASH / hashGameState oracles
  // from re-pinning. Absent (undefined) or empty [] both mean "no pending choice".
  /** FIFO queue of pending give-HQ-Hero choices awaiting player resolution (WP-532). */
  pendingGiveHqHeroChoices?: PendingGiveHqHeroChoice[] | undefined;
  // why: WP-535 / D-24345 — the current player's pending Copy-a-Hero pick (Rogue's Copy
  // Powers). Optional so existing test-state literals need no update; **lazily initialized
  // at the park site, never in Game.setup** — an undefined field is omitted from canonical
  // JSON, keeping the empty-replay PRE_WP080_HASH / hashGameState oracles from re-pinning.
  // Absent (undefined) or empty [] both mean "no pending choice". The copied class reuses
  // the EXISTING lazy cardSizeChangingClasses map (D-24074), so no second new G field.
  /** FIFO queue of pending Copy Powers choices awaiting player resolution (WP-535). */
  pendingCopyPowersChoices?: PendingCopyPowersChoice[] | undefined;

  // why: playerZones is keyed by player ID string (boardgame.io uses "0", "1",
  // etc.). Each player has exactly 5 zone arrays. Only deck is non-empty after
  // setup — cards enter other zones via moves only.
  /** Per-player card zones, keyed by player ID ("0", "1", ...). */
  playerZones: Record<PlayerId, PlayerZones>;

  // why: piles contains the shared global card piles sized from config count
  // fields. Each pile array contains CardExtId strings. Piles are consumed by
  // game moves (e.g., gaining a wound, rescuing a bystander).
  /** Shared global card piles (bystanders, wounds, officers, sidekicks). */
  piles: GlobalPiles;

  // why: messages is a deterministic event log that records rule effects,
  // warnings, and diagnostic entries. It is append-only during gameplay and
  // supports replay inspection and debugging. WP-434 — each entry is a LogEntry
  // ({ text, outcome }) so the client can colour a line by its authored outcome
  // instead of re-parsing prose; the array stays hash-excluded (D-24081).
  /** Deterministic event log populated by rule effects. */
  messages: LogEntry[];

  // why: WP-328 — the numbering data for the `{turn}.{step}.{action}` game-log prefix.
  // `turn` is the PLAYER-FACING, play-relative turn number (first play turn = 1), not the
  // raw framework `ctx.turn`: the lobby phase consumes framework turn 1, so the play phase's
  // first turn arrives as `ctx.turn === 2`. `firstPlayTurn` captures the framework turn of
  // the first play turn once (at play-phase onBegin) so `turn = ctx.turn - firstPlayTurn + 1`
  // renders play-relative regardless of how many framework turns preceded play. `actionInStep`
  // resets at onBegin and each stage advance. Optional so narrow unit fixtures omit it (pushLog
  // falls back to unprefixed). Excluded from finalStateHash (D-24081-style), so it is replay-safe.
  /** Game-log numbering metadata (WP-328); hash-excluded. */
  logMeta?: { turn: number; actionInStep: number; firstPlayTurn?: number };

  // why: counters tracks named numeric values used by endgame conditions and
  // scheme/mastermind rules. Counters are modified by modifyCounter effects
  // and read by evaluateEndgame.
  /** Named numeric counters for endgame conditions and rule tracking. */
  counters: Record<string, number>;

  // why: hookRegistry stores data-only HookDefinition entries that describe
  // which triggers each hook subscribes to and its execution priority. Handler
  // functions live in the ImplementationMap outside of G — they are never
  // stored here. This keeps G JSON-serializable.
  /** Data-only rule hook definitions (no functions). */
  hookRegistry: HookDefinition[];

  // why: classification stored at setup so moves never access registry at runtime.
  // G.villainDeckCardTypes maps each card in the villain deck to its
  // RevealedCardType. Populated by buildVillainDeck (WP-014B) at setup time;
  // revealVillainCard reads it in O(1) without registry access.
  /** Villain deck zone (deck + discard). */
  villainDeck: VillainDeckState;
  /** Card type classification for O(1) lookup during reveal. */
  villainDeckCardTypes: Record<CardExtId, RevealedCardType>;

  // why: City is a 5-space row where revealed villains and henchmen are placed
  // via pushVillainIntoCity. Only the contiguous entry-side block advances on
  // each push; the leftmost empty space absorbs the cascade. Space 4 is the
  // escape edge — a card escapes only when every space is occupied at push
  // time. Initialized to all nulls at setup; populated during play by
  // revealVillainCard.
  /** City zone: 5 spaces for villain/henchman cards. */
  city: CityZone;

  // why: HQ is a 5-slot row for hero recruit cards. Populated at setup time
  // from the first 5 cards of the shuffled hero deck reservoir
  // (G.heroDeck) via fillHqFromDeck per WP-135. Refilled on each
  // successful recruitHero via refillHqSlot; empty-deck branch leaves the
  // vacated slot null per D-13503 (no auto-reshuffle).
  /** HQ zone: 5 hero recruit slots. */
  hq: HqZone;

  // why: WP-135 — sibling pattern with G.villainDeck.deck. CardExtId-strings-only
  // array seeded once at Game.setup() by buildHeroDeck (single ctx.random.Shuffle
  // call) from MatchSetupConfig.heroDeckIds and the locked rarity → copy-count
  // map (D-13501; 5/3/3/3 = 14 cards per hero across the four-label set
  // { 'Common 1', 'Common 2', 'Uncommon', 'Rare' }). The first 5 cards of the
  // shuffled reservoir populate G.hq; the remainder lives here. Front-popped on
  // every successful recruitHero (FIFO via shift through refillHqSlot). Closes
  // the WP-128 D-12806 safe-skip for decks.heroDeckCount projection — the count
  // graduates from the constant 0 to gameState.heroDeck.length.
  /** Shared hero deck reservoir (post-shuffle, post-HQ-fill remainder). */
  heroDeck: CardExtId[];

  // why: KO pile stores cards permanently removed from the game. Destination-only
  // zone — cards enter via koCard helper and never return in MVP. Initialized
  // empty at setup.
  /** Cards removed from the game (knocked out). Destination-only zone. */
  ko: CardExtId[];

  // why: attachedBystanders maps villains/henchmen in the City to their captured
  // bystanders. Plain Record (not Map) for JSON serializability. Entries are
  // created on City entry and removed on defeat (award) or escape (return to
  // supply). See D-1703.
  /** Bystanders attached to villains/henchmen currently in the City. */
  attachedBystanders: Record<CardExtId, CardExtId[]>;

  // why: villainAttachedHeroes maps villains in the City to their captured
  // heroes. Heroes enter via captureHqHero* keywords and are either awarded
  // to the defeating player's discard (Fight: Gain that Hero) or KO'd on
  // escape. Mirrors attachedBystanders structure. Entries are deleted (not
  // set to []) when all heroes are removed. See D-21401.
  /** Heroes attached to villains currently in the City (WP-214). */
  villainAttachedHeroes: Record<CardExtId, CardExtId[]>;

  // why: mastermind state with identity, tactics deck, and defeated list.
  // Built at setup from registry data. tacticsDeck drawn from index 0;
  // tacticsDefeated append-only. All fields are CardExtId or CardExtId[].
  /** Mastermind state for boss fight resolution. */
  mastermind: MastermindState;

  // why: scheme runtime state holds the twist pile destination for resolved
  // scheme-twist cards. Separate from G.schemeSetupInstructions (D-2601).
  /** Scheme runtime state (twist pile for resolved scheme-twist cards). */
  scheme: SchemeState;

  // why: append-only destination pile for villains that escaped the City.
  // Top-level on G because CityZone is a fixed 5-tuple that cannot host
  // named fields. Order is chronological (insertion order); no reshuffle in MVP.
  /** Escaped villain cards — append-only, chronological. */
  escapedPile: CardExtId[];

  // why: WP-513 / D-24324 — converted-card villain overlay. Some schemes make a
  // card "count as" a villain of a named group (Killbots: villain-deck Bystanders
  // count as Killbot Villains). Such cards are typed 'villain' in
  // villainDeckCardTypes (native reveal/fight/escape routing) and recorded here
  // with their converted identity, used for the distinct escaped count, dynamic
  // attack, and (future) display. Materialized LAZILY — present only for schemes
  // that convert cards, ABSENT (undefined) otherwise — so it is omitted from the
  // state hash for every other game (no re-pin; mirrors lastPlayEffectsFired /
  // diagnostics). Readers guard with `?? {}`.
  /** Converted-card villain identities (e.g. 'killbot'); absent unless a scheme converts. */
  convertedVillainOrigins?: Record<CardExtId, ConvertedVillainOrigin>;

  // why: per-turn attack/recruit point accumulation and spend tracking.
  // Reset at start of each player turn. Values are integers >= 0.
  /** Per-turn economy tracking (attack/recruit points accumulated and spent). */
  turnEconomy: TurnEconomy;

  // why: card stat values resolved at setup time from registry so moves
  // can look up attack, recruit, cost, and fightCost without registry
  // access — same pattern as G.villainDeckCardTypes (WP-014).
  // Read-only after setup.
  /** Card stat lookup keyed by CardExtId. Built at setup, read-only at runtime. */
  cardStats: Record<CardExtId, CardStatEntry>;

  // why: WP-179 — categorical traits (heroClass, team) resolved at setup time
  // from registry. Sibling snapshot to G.cardStats, G.cardKeywords,
  // G.cardDisplayData. Keyed by copy-suffixed CardExtId. Read-only at runtime.
  /** Card trait lookup keyed by CardExtId. Built at setup, read-only at runtime. */
  cardTraits: Record<CardExtId, CardTraitEntry>;

  // why: D-24074 / WP-290 — per-card Size-Changing granted Hero Classes ("when you
  // play this card, it has the [Class] class"). A SECOND, static class source sibling
  // to cardTraits.heroClass — NOT a mutation of it. A card in inPlay is treated as
  // having class C iff C is its printed cardTraits[id].heroClass OR C ∈
  // cardSizeChangingClasses[id]; the grant expires naturally when inPlay clears (no
  // cleanup). Built once at setup from the parsed hooks; read-only at runtime via the
  // sizeChanging.logic.ts helper. Additive optional: absent means no card grants a class.
  /** Per-card Size-Changing granted Hero Classes. Built at setup, read-only at runtime. */
  cardSizeChangingClasses?: Record<CardExtId, string[]>;

  // why: D-24157 / WP-365 — printed victory points for VP-bearing cards (villains,
  // henchmen, the mastermind base card) resolved at setup from registry so
  // computeFinalScores awards printed VP without runtime registry access. Sibling
  // snapshot to G.cardStats, keyed by the same copy-suffixed zone ext_ids.
  // Additive optional + omit-when-empty (like cardSizeChangingClasses): absent
  // means no card carries a printed vp, and scoring applies the fallback constant.
  /** Per-card printed victory points. Built at setup, read-only at runtime. */
  cardVictoryPoints?: Record<CardExtId, number>;

  // why: board keyword data resolved at setup time from registry so moves
  // never query registry at runtime — same setup-time resolution pattern as
  // G.cardStats and G.villainDeckCardTypes. No runtime registry access.
  /** Board keywords for villain/henchman cards. Built at setup, read-only at runtime. */
  cardKeywords: Record<CardExtId, BoardKeyword[]>;

  // why: WP-111 / EC-118 sibling snapshot to G.cardStats (WP-018),
  // G.villainDeckCardTypes (WP-014B), and G.cardKeywords (WP-025). Built
  // once at setup from the registry; surfaced through buildUIState as
  // additive `display` / `slotDisplay?` / `handDisplay?` fields on
  // UICityCard / UIHQState / UIPlayerState / UIMastermindState. The
  // Readonly<...> wrapper is a documentational signal at the type
  // boundary — TypeScript does not enforce runtime immutability for
  // Record values, but the type signal makes accidental writes
  // grep-able in review. Read only by uiState.build.ts; gameplay reads
  // G.cardStats (presentation-vs-gameplay separation lock).
  /**
   * Card display data lookup keyed by CardExtId. Built at setup,
   * read-only at runtime, projected through UIState. Sourced from the
   * registry once at Game.setup(); never queried at runtime.
   */
  cardDisplayData: Readonly<Record<CardExtId, UICardDisplay>>;

  // why: scheme instructions follow the "Representation Before Execution"
  // decision (D-2601). Stored for replay observability. Empty at MVP until
  // structured metadata exists in the registry.
  /**
   * Scheme setup instructions applied during Game.setup().
   *
   * Stores the instruction list (empty at MVP until structured metadata
   * exists) for replay observability. Setup-only — never modified after
   * initial construction.
   */
  schemeSetupInstructions: SchemeSetupInstruction[];

  // why: hero ability hooks are built at setup time and immutable during
  // gameplay. Data-only — no functions or closures. Execution is WP-022+.
  /** Hero ability hook declarations (data-only, inert in WP-021). */
  heroAbilityHooks: HeroAbilityHook[];

  // why: villain/henchman ability hooks built from registry at setup time —
  // same pattern as heroAbilityHooks/hookRegistry/cardStats. Data-only,
  // immutable during gameplay; executed at the Fight/Ambush fire sites by
  // villainEffects.execute.ts (WP-185).
  /** Villain/henchman ability hook declarations (data-only). */
  villainAbilityHooks: Readonly<VillainAbilityHook[]>;

  // why: WP-292 / D-24076 — per-villain-instance defeat requirement ("You can't
  // defeat X unless you have a [class/team] Hero"). A fight PRECONDITION read by
  // the fightVillain gate, distinct from villainAbilityHooks (post-defeat
  // consequences). Built once at setup from the [require-to-defeat:<kind>:<value>]
  // marker, keyed by copy-suffixed instance ext_id, read-only at runtime. Additive
  // optional + OMITTED ENTIRELY when no marked villain is in the match, so matches
  // without these villains keep a byte-identical G shape (determinism).
  /** Per-villain defeat requirements. Built at setup, read-only; absent when none. */
  villainDefeatRequirements?: Record<CardExtId, VillainDefeatRequirement>;

  // why: WP-200 — append-only structured event log emitted at four fire
  // sites (fightVillain.ts, villainDeck.reveal.ts ambush branch,
  // schemeTwistResolvers.ts × 5 resolvers, mastermindHandlers.ts). Each
  // entry is a JSON-serialisable NotableGameEvent (discriminated union —
  // see events/notableEvents.types.ts). Append-only via `.push(...)` —
  // never spliced, reassigned, sorted, or mutated. Replay determinism: same
  // setup + same moves produces a byte-identical sequence. Projected
  // through UIState.notableEvents so the arena client (WP-201) renders
  // descriptive "what happened" overlays without parsing G.messages
  // strings. Empty array initialiser lives in
  // setup/buildInitialGameState.ts.
  /** Append-only typed event log for player-visible outcomes (WP-200). */
  notableEvents: NotableGameEvent[];

  // why: lobby state is stored in G so the UI can observe lobby completion
  // and readiness status. Initialized at setup time from ctx.numPlayers.
  /** Lobby phase state (player readiness and match start flag). */
  lobby: LobbyState;

  // why: runtime-only — never persisted (see ARCHITECTURE.md Section 3); its
  // presence marks the match as PAR-scored for future `buildUIState` gating
  // once D-6701's follow-up WP lands. WP-067 adds the field; WP-048
  // explicitly deferred it per D-4802.
  /** Optional setup-time scoring config; presence marks the match as PAR-scored. */
  readonly activeScoringConfig?: ScenarioScoringConfig;

  // why: WP-257 / D-24034 — runtime-only hollow-effect diagnostics channel.
  // Seeded empty at buildInitialGameState; written ONLY by recordHollowEffect
  // (lazy-init there too, for older snapshots / narrow test mocks). Plain JSON,
  // bounded by HOLLOW_EFFECTS_CAP, never persisted as a save-game, and NEVER
  // read as gameplay input (no move/rule/endIf may consume it — observation,
  // not state). Optional so existing full-state literals across the test suite
  // need no edit (absent is treated as not-yet-written). Not projected to
  // UIState here — that is WP-258.
  diagnostics?: GameDiagnostics;
}

// why: PAR artifact storage types (WP-050) ship the immutable artifact +
// index layer. Pure types and the error class live in par.storage.ts.
// Re-exported here so consumers importing from './types.js' have access to
// the full PAR storage surface.
export type {
  ParArtifactSource,
  SeedParArtifact,
  SimulationParArtifact,
  ParArtifact,
  ParResolution,
  ParIndex,
  ParStorageConfig,
  ParStoreValidationResult,
  ParStoreValidationError,
  ParCoverageResult,
} from './simulation/par.storage.js';
