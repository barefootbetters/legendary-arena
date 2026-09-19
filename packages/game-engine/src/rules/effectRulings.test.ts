/**
 * Executable effect-rulings harness (WP-704 / EC-741 / D-24524).
 *
 * Loads + validates the private `docs/ai/rulings/effect-rulings.json` corpus and, for
 * EACH ruling, builds a minimal `G` (via `buildInitialGameState` + the engine's own
 * fixtureBuilders), fires the ruling's action through the REAL engine handler, and
 * asserts the expectation on the handler's OUTPUT — reusing the proven
 * `ruleRuntime.integration.test.ts` pattern (minimal G → real pipeline → assert on G).
 * Because each ruling exercises production code, a ruling and the handler it describes
 * cannot drift: change the handler and the ruling reddens.
 *
 * The per-ruling NON-VACUITY self-test is the reward-integrity core: it perturbs every
 * ruling's `expected` and asserts THAT ruling then fails, proving each asserts on the
 * handler's output rather than a value the setup already placed. A ruling that passes
 * when perturbed is vacuous and is a hard failure.
 *
 * The corpus path is resolved via `import.meta.url` (never `process.cwd()`) so the
 * harness works under `pnpm --filter` and CI; this one fs read is a deliberate
 * test-harness exemption to the `src/rules/` no-I/O rule. Uses node:test + node:assert
 * only; no boardgame.io import.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makePlayerZones, makeGlobalPiles, makeCardRegistryReader, makeCardStatEntry } from '../test/fixtureBuilders.js';
import { executeVillainAbilities } from '../villain/villainEffects.execute.js';
import { resolveMelterKoChoice } from '../moves/melterKoChoice.resolve.js';
import { resolveOptionalKoReward } from '../moves/optionalKoReward.resolve.js';
import { resolveScryKoChoice } from '../moves/scryKoChoice.resolve.js';
import { resolveKoHeroChoice } from '../moves/koHeroChoice.resolve.js';
import { resolveDiscardToPlay } from '../moves/resolveDiscardToPlay.js';
import { resolveSmashDiscard } from '../moves/smashDiscard.resolve.js';
import { resolveRevealTopDispose } from '../moves/revealTopDispose.resolve.js';
import { resolveGiveHqHeroChoice } from '../moves/giveHqHeroChoice.resolve.js';
import { resolveReturnZeroCostDiscard } from '../moves/resolveReturnZeroCostDiscard.js';
import { resolveDoOver } from '../moves/doOver.resolve.js';
import { resolveOptionalPutBottomHQ } from '../moves/resolveOptionalPutBottomHQ.js';
import { resolveVictoryPileCardPick } from '../moves/resolveVictoryPileCardPick.js';
import { resolveKoDiscardChoice } from '../moves/koDiscardChoice.resolve.js';
import { executeSingleEffect } from '../hero/heroEffects.execute.js';
import { cardHasClassWhenPlayed } from '../hero/sizeChanging.logic.js';
import { executeRuleHooks } from './ruleRuntime.execute.js';
import { applyRuleEffects } from './ruleRuntime.effects.js';
import { DEFAULT_IMPLEMENTATION_MAP } from './ruleRuntime.impl.js';
import {
  validateRulingCorpus,
  RULING_SCENARIO_ACTIONS,
  RULING_EXPECTATION_KINDS,
} from './effectRulings.validate.js';
import type {
  Ruling,
  RulingScenario,
  RulingExpectation,
  RulingScenarioAction,
  RulingExpectationKind,
  RulingZoneName,
  RulingCounterField,
  RulingEconomyFlag,
} from './effectRulings.validate.js';
import type { RuleTriggerName } from './ruleHooks.types.js';
import type {
  LegendaryGameState,
  MatchSetupConfig,
  PendingMelterKoChoice,
  PendingOptionalKoReward,
  PendingScryKoChoice,
  PendingKoHeroChoice,
  PendingDiscardToPlay,
  PendingSmashDiscard,
  PendingRevealTopDispose,
  PendingGiveHqHeroChoice,
  PendingReturnZeroCostDiscard,
  PendingDoOver,
  PendingOptionalPutBottomHQ,
  PendingVictoryPileCardPick,
  PendingKoDiscardChoice,
  MelterRevealedTop,
} from '../types.js';
import type { CardExtId, PlayerZones } from '../state/zones.types.js';
import type { VillainAbilityTiming, VillainEffectDescriptor } from './villainAbility.types.js';

// ---------------------------------------------------------------------------
// Corpus loading (import.meta.url — never process.cwd())
// ---------------------------------------------------------------------------

// why: EC-741 — resolve the corpus relative to THIS test file, not the process cwd, so
// the harness reads the same corpus under `pnpm --filter` and CI regardless of where
// node:test is launched. From packages/game-engine/src/rules/, the repo root is four
// levels up. This fs read is the one sanctioned exemption to the src/rules/ no-I/O rule.
const CORPUS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/ai/rulings/effect-rulings.json',
);

/**
 * Reads, parses, and validates the effect-rulings corpus, throwing loudly on any
 * failure (a malformed or unreadable corpus is a hard failure, never a silent skip).
 *
 * @returns The validated rulings in file order.
 */
function loadCorpus(): Ruling[] {
  let raw: string;
  try {
    raw = readFileSync(CORPUS_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `Could not read the effect-rulings corpus at ${CORPUS_PATH}: ${(error as Error).message}. ` +
        'The harness resolves the path via import.meta.url; check that the corpus file exists.',
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`The effect-rulings corpus at ${CORPUS_PATH} is not valid JSON: ${(error as Error).message}.`);
  }
  return validateRulingCorpus(parsed);
}

const CORPUS: Ruling[] = loadCorpus();

// ---------------------------------------------------------------------------
// Minimal-G construction (buildInitialGameState + fixtureBuilders)
// ---------------------------------------------------------------------------

/**
 * A valid MatchSetupConfig for a synthetic test match. Set-qualified ids per the
 * D-10014 qualified-id contract (mirrors ruleRuntime.integration.test.ts).
 *
 * @returns The base match-setup config.
 */
function createBaseConfig(): MatchSetupConfig {
  return {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: ['test/test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };
}

/**
 * Builds a structurally complete minimal `G` through the engine's OWN setup.
 *
 * // why: EC-741 — building via buildInitialGameState + the fixtureBuilders registry
 * reader (never a hand-built partial G) guarantees every field the real handlers touch
 * (turnEconomy, notableEvents, effect traces, the KO pile) is valid, so a ruling
 * exercises production code and cannot pass while the handler is broken. Each runner
 * then overlays only the zones/traits/hooks its ruling needs. The KO pile is reset so
 * ko-pile assertions read only what the fired handler produced.
 *
 * @param numPlayers - Seats to build (>= 1).
 * @returns A fresh, complete game state.
 */
function buildBaseState(numPlayers: number): LegendaryGameState {
  const state = buildInitialGameState(createBaseConfig(), makeCardRegistryReader(), makeMockCtx({ numPlayers }));
  state.ko = [];
  return state;
}

/**
 * Builds a pile of `count` identical token copies.
 *
 * @param token - The token ext_id to repeat (e.g. 'pile-wound').
 * @param count - How many copies.
 * @returns A pile of copies.
 */
function buildTokenPile(token: string, count: number): CardExtId[] {
  const pile: CardExtId[] = [];
  for (let index = 0; index < count; index += 1) {
    pile.push(token as CardExtId);
  }
  return pile;
}

// ---------------------------------------------------------------------------
// Per-action setup shapes (read + narrowed by each runner)
// ---------------------------------------------------------------------------

interface ZoneOverride {
  deck?: string[];
  hand?: string[];
  discard?: string[];
  inPlay?: string[];
  victory?: string[];
}

interface TraitOverride {
  heroClass: string | null;
  heroClass2?: string | null;
  team: string | null;
}

interface FireVillainEffectSetup {
  cardId: string;
  timing: VillainAbilityTiming;
  currentPlayer: string;
  descriptor: VillainEffectDescriptor;
  playerZones: Record<string, ZoneOverride>;
  cardTraits?: Record<string, TraitOverride>;
  woundsSupply?: number;
  bystandersSupply?: number;
  officersSupply?: number;
  cityIndex?: number;
  hq?: (string | null)[];
  cardStats?: Record<string, number>;
  heroDeck?: string[];
  city?: (string | null)[];
  villainDeckCardTypes?: Record<string, string>;
}

interface ResolveMelterKoSetup {
  currentPlayer: string;
  decks: Record<string, string[]>;
  revealedTops: MelterRevealedTop[];
  resolve: { ownerPlayerID: string; cardId: string; keep: boolean };
}

interface ResolveOptionalKoRewardSetup {
  currentPlayer: string;
  pending: { rewardType: PendingOptionalKoReward['rewardType']; rewardMagnitude: number; sourceCardId: string };
  inPlay: string[];
  hand?: string[];
  discard?: string[];
  bystandersSupply?: number;
  resolve: { zone: 'hand' | 'discard' | 'inPlay'; cardId: string } | { decline: true };
}

interface QueryCardHasClassSetup {
  cardId: string;
  classSlug: string;
  cardTraits: Record<string, TraitOverride>;
}

interface FireHeroEffectSetup {
  playerID?: string;
  cardId: string;
  effect: { type: string; magnitude?: number; rewardType?: string; investigateCriteria?: unknown[]; investigateLookCount?: number; countSource?: string; perEach?: number };
  playerZones?: Record<string, ZoneOverride>;
  cardTraits?: Record<string, TraitOverride>;
  bystandersSupply?: number;
}

interface FireRuleHookSetup {
  trigger: 'onSchemeTwistRevealed' | 'onMastermindStrikeRevealed';
  cardId: string;
}

interface ResolveScryKoSetup {
  currentPlayer: string;
  deck: string[];
  revealedCardIds: string[];
  resolve: { cardId: string };
}

interface ResolveKoHeroSetup {
  currentPlayer: string;
  playerZones: Record<string, ZoneOverride>;
  resolve: { zone: 'hand' | 'discard' | 'inPlay'; cardId: string };
}

interface ResolveDiscardToPlaySetup {
  currentPlayer: string;
  hand: string[];
  pending: { sourceCardId: string; remaining: number };
  resolve: { cardId: string };
}

interface ResolveSmashSetup {
  currentPlayer: string;
  hand: string[];
  magnitude: number;
  resolve: { cardId: string } | { decline: true };
}

interface ResolveRevealTopDisposeSetup {
  currentPlayer: string;
  deck: string[];
  resolve: { ownerPlayerID: string; cardId: string; disposition: 'discard' | 'top' };
}

interface ResolveGiveHqHeroSetup {
  currentPlayer: string;
  hq: (string | null)[];
  heroDeck?: string[];
  resolve: { cardId: string } | { decline: true };
}

interface ResolveReturnZeroCostDiscardSetup {
  currentPlayer: string;
  discard: string[];
  cardStats: Record<string, number>;
  sourceCardId: string;
  resolve: { cardId: string };
}

interface ResolveDoOverSetup {
  currentPlayer: string;
  hand: string[];
  deck: string[];
  resolve: { accept: true } | { decline: true };
}

interface ResolveOptionalPutBottomHqSetup {
  currentPlayer: string;
  hq: (string | null)[];
  heroDeck: string[];
  cardStats: Record<string, { recruit?: number; attack?: number; cost?: number }>;
  sourceCardId: string;
  iconRewardMagnitude: number;
  resolve: { cardId: string };
}

interface ResolveVictoryPileCardPickSetup {
  currentPlayer: string;
  victory: string[];
  villainDeckCardTypes: Record<string, string>;
  cardStats: Record<string, { fightCost?: number }>;
  resolve: { cardId: string };
}

interface ResolveKoDiscardSetup {
  currentPlayer: string;
  discard: string[];
  maxCount: number;
  resolve: { cardIds: string[] };
}

/** The result a scenario runner returns: the mutated G plus any query boolean. */
interface Outcome {
  G: LegendaryGameState;
  booleanResult?: boolean;
}

// ---------------------------------------------------------------------------
// Scenario runners — each fires ONE real engine handler
// ---------------------------------------------------------------------------

/**
 * Fires a single villain-ability descriptor through the real `executeVillainAbilities`
 * dispatcher (reveal-or-wound, ko-wounds-current-hand-and-discard, the Melter park).
 *
 * @param rawSetup - The ruling's fire-villain-effect setup payload.
 * @returns The mutated game state.
 */
function runFireVillainEffect(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as FireVillainEffectSetup;
  const seatIds = Object.keys(setup.playerZones);
  const G = buildBaseState(Math.max(seatIds.length, 1));

  const playerZones: Record<string, PlayerZones> = {};
  for (const seatId of seatIds) {
    playerZones[seatId] = makePlayerZones(setup.playerZones[seatId] as Partial<PlayerZones>);
  }
  G.playerZones = playerZones;

  if (setup.cardTraits !== undefined) {
    G.cardTraits = setup.cardTraits as LegendaryGameState['cardTraits'];
  }
  G.piles = makeGlobalPiles({
    wounds: buildTokenPile('pile-wound', setup.woundsSupply ?? 0),
    bystanders: buildTokenPile('pile-bystander', setup.bystandersSupply ?? 0),
    officers: buildTokenPile('pile-shield-officer', setup.officersSupply ?? 0),
  });

  // why: capture-hq-hero reads the 5-slot G.hq, G.cardStats[id].cost (the
  // highest/lowest-cost selectors) and refills the vacated slot from G.heroDeck.
  // Seed them only when the ruling provides them so other villain rulings keep the
  // base setup unchanged. cardStats entries are built complete via makeCardStatEntry
  // (cost overridden) so the cost selectors read exactly what the ruling declares.
  if (setup.hq !== undefined) {
    G.hq = setup.hq as (CardExtId | null)[];
  }
  if (setup.cardStats !== undefined) {
    for (const [heroId, cost] of Object.entries(setup.cardStats)) {
      G.cardStats[heroId as CardExtId] = makeCardStatEntry({ cost });
    }
  }
  if (setup.heroDeck !== undefined) {
    G.heroDeck = setup.heroDeck as CardExtId[];
  }

  // why: swap-two-city-villains reads the City row (G.city) and classifies each
  // occupant via G.villainDeckCardTypes (only 'villain' occupants swap; henchmen
  // never do). Seed both only when the ruling provides them so other villain
  // rulings keep the base City untouched.
  if (setup.city !== undefined) {
    G.city = setup.city as LegendaryGameState['city'];
  }
  if (setup.villainDeckCardTypes !== undefined) {
    G.villainDeckCardTypes = setup.villainDeckCardTypes as LegendaryGameState['villainDeckCardTypes'];
  }

  G.villainAbilityHooks = [
    { cardId: setup.cardId as CardExtId, timing: setup.timing, keywords: [], effects: [setup.descriptor] },
  ];

  // why: executeVillainAbilities reads ONLY ctx.currentPlayer + ctx.turn at the TOP
  // level of its bare-Ctx arg (it is barred from the framework FnContext type), so pass
  // makeMockMoveContext's `.ctx` (which carries both at the top level) rather than the
  // full FnContext wrapper. The full context also satisfies the ShuffleProvider 5th arg
  // (Melter's reveal-reshuffle) via its random.Shuffle. Reusing the engine helper — not
  // a re-implemented dispatch — is what makes a broken handler redden the ruling.
  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer, numPlayers: seatIds.length || 1 });
  executeVillainAbilities(G, moveContext.ctx, setup.cardId as CardExtId, setup.timing, moveContext, setup.cityIndex);

  return { G };
}

/**
 * Fires the real `resolveMelterKoChoice` move against a parked Melter choice.
 *
 * @param rawSetup - The ruling's resolve-melter-ko setup payload.
 * @returns The mutated game state.
 */
function runResolveMelterKo(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveMelterKoSetup;
  const seatIds = Object.keys(setup.decks);
  const G = buildBaseState(Math.max(seatIds.length, 1));

  const playerZones: Record<string, PlayerZones> = {};
  for (const seatId of seatIds) {
    playerZones[seatId] = makePlayerZones({ deck: setup.decks[seatId] as CardExtId[] });
  }
  G.playerZones = playerZones;

  const pending: PendingMelterKoChoice = {
    choiceType: 'melter-ko',
    playerID: setup.currentPlayer,
    revealedTops: setup.revealedTops,
  };
  G.pendingMelterKoChoices = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer, numPlayers: seatIds.length || 1 });
  resolveMelterKoChoice(moveContext, {
    ownerPlayerID: setup.resolve.ownerPlayerID,
    cardId: setup.resolve.cardId as CardExtId,
    keep: setup.resolve.keep,
  });

  return { G };
}

/**
 * Fires the real `resolveOptionalKoReward` move against a parked reward.
 *
 * @param rawSetup - The ruling's resolve-optional-ko-reward setup payload.
 * @returns The mutated game state.
 */
function runResolveOptionalKoReward(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveOptionalKoRewardSetup;
  const G = buildBaseState(1);

  G.playerZones = {
    [setup.currentPlayer]: makePlayerZones({
      hand: (setup.hand ?? []) as CardExtId[],
      discard: (setup.discard ?? []) as CardExtId[],
      inPlay: setup.inPlay as CardExtId[],
    }),
  };
  G.piles = makeGlobalPiles({ bystanders: buildTokenPile('pile-bystander', setup.bystandersSupply ?? 0) });

  const pending: PendingOptionalKoReward = {
    playerID: setup.currentPlayer,
    rewardType: setup.pending.rewardType,
    rewardMagnitude: setup.pending.rewardMagnitude,
    sourceCardId: setup.pending.sourceCardId as CardExtId,
  };
  G.pendingOptionalKoRewards = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  // why: the resolve payload is a decline flag XOR a { zone, cardId } KO request (the
  // move's own arg union) — branch so the harness can exercise the decline path too.
  if ('decline' in setup.resolve) {
    resolveOptionalKoReward(moveContext, { decline: true });
  } else {
    resolveOptionalKoReward(moveContext, { zone: setup.resolve.zone, cardId: setup.resolve.cardId as CardExtId });
  }

  return { G };
}

/**
 * Fires the real pure `cardHasClassWhenPlayed` query.
 *
 * @param rawSetup - The ruling's query-card-has-class setup payload.
 * @returns The mutated game state plus the boolean the query returned.
 */
function runQueryCardHasClass(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as QueryCardHasClassSetup;
  const G = buildBaseState(1);
  G.cardTraits = setup.cardTraits as LegendaryGameState['cardTraits'];
  const booleanResult = cardHasClassWhenPlayed(G, setup.cardId as CardExtId, setup.classSlug);
  return { G, booleanResult };
}

/**
 * Fires one hero-effect keyword through the real `executeSingleEffect` executor.
 *
 * @param rawSetup - The ruling's fire-hero-effect setup payload.
 * @returns The mutated game state plus the executor's applied boolean.
 */
function runFireHeroEffect(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as FireHeroEffectSetup;
  const playerID = setup.playerID ?? '0';
  const G = buildBaseState(1);

  const zoneOverride = setup.playerZones?.[playerID] ?? {};
  G.playerZones = { [playerID]: makePlayerZones(zoneOverride as Partial<PlayerZones>) };

  // why: seed cardTraits only when the ruling needs it (an investigate criterion reads
  // a looked-at card's printed team / hero-class from G.cardTraits). Absent = untouched.
  if (setup.cardTraits !== undefined) {
    G.cardTraits = setup.cardTraits as LegendaryGameState['cardTraits'];
  }

  // why: seed the Bystander supply only when the ruling needs it (a rescue effect), so
  // rulings that don't touch piles keep the base setup unchanged. Default absent = untouched.
  if (setup.bystandersSupply !== undefined) {
    G.piles = makeGlobalPiles({ bystanders: buildTokenPile('pile-bystander', setup.bystandersSupply) });
  }

  // why: executeSingleEffect takes the bare ctx as `unknown`; some hero handlers (draw)
  // read ctx.random, so pass the full makeMockMoveContext. The effect is cast to the
  // executor's own descriptor parameter type so the harness needs no separate type import.
  const moveContext = makeMockMoveContext(G, { playerID });
  // why: `rewardType` is carried only by keywords whose reward is a nested keyword
  // (ko-wound-reward: KO a Wound, THEN grant this reward); it is undefined for the
  // plain grants and passes through harmlessly.
  const effect = {
    type: setup.effect.type,
    magnitude: setup.effect.magnitude,
    rewardType: setup.effect.rewardType,
    investigateCriteria: setup.effect.investigateCriteria,
    investigateLookCount: setup.effect.investigateLookCount,
    // why: D-24529 — the count-scaled family ('recruit-per-count' / 'attack-per-count')
    // reads countSource + perEach off the descriptor; forward them so a ruling can fire a
    // real count-scaled grant (e.g. Avengers Assemble!'s "for each color of Hero you have").
    // Undefined for every non-count-scaled keyword and passes through harmlessly.
    countSource: setup.effect.countSource,
    perEach: setup.effect.perEach,
  } as Parameters<typeof executeSingleEffect>[4];
  const booleanResult = executeSingleEffect(G, moveContext, playerID, setup.cardId as CardExtId, effect);

  return { G, booleanResult };
}

/**
 * Fires the real scheme / mastermind rule pipeline for one trigger, reusing the
 * proven `executeRuleHooks` → `applyRuleEffects` entry points (D-2401) exactly as
 * `ruleRuntime.integration.test.ts` does. `buildInitialGameState` (inside
 * `buildBaseState`) populates `G.hookRegistry` with the default scheme + mastermind
 * hook definitions, and `DEFAULT_IMPLEMENTATION_MAP` binds those hook ids to the real
 * `schemeTwistHandler` / `mastermindStrikeHandler`. So the ruling exercises the same
 * production pipeline a live reveal runs — the handlers are never re-implemented here.
 *
 * @param rawSetup - The ruling's fire-rule-hook setup payload.
 * @returns The mutated game state (counters + messages written by the pipeline).
 */
function runFireRuleHook(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as FireRuleHookSetup;
  const G = buildBaseState(1);

  // why: the pipeline's `ctx` param is typed `unknown` and the default scheme /
  // mastermind handlers read only the trigger payload's `{ cardId }`, so an empty
  // object satisfies it (matching the integration test). The trigger is narrowed to
  // RuleTriggerName from the closed setup shape; getHooksForTrigger fails loudly on a
  // trigger with no registered hook rather than silently doing nothing.
  const effects = executeRuleHooks(
    G,
    {},
    setup.trigger as RuleTriggerName,
    { cardId: setup.cardId },
    G.hookRegistry,
    DEFAULT_IMPLEMENTATION_MAP,
  );
  applyRuleEffects(G, {}, effects);

  return { G };
}

/**
 * Fires the real `resolveScryKoChoice` move against a parked Doombot scry-KO choice.
 *
 * @param rawSetup - The ruling's resolve-scry-ko setup payload.
 * @returns The mutated game state.
 */
function runResolveScryKo(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveScryKoSetup;
  const G = buildBaseState(1);

  G.playerZones = { [setup.currentPlayer]: makePlayerZones({ deck: setup.deck as CardExtId[] }) };
  const pending: PendingScryKoChoice = {
    choiceType: 'scry-ko',
    playerID: setup.currentPlayer,
    revealedCardIds: setup.revealedCardIds as CardExtId[],
  };
  G.pendingScryKoChoices = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  resolveScryKoChoice(moveContext, { cardId: setup.resolve.cardId as CardExtId });

  return { G };
}

/**
 * Fires the real `resolveKoHeroChoice` move against a parked KO-a-Hero choice.
 *
 * @param rawSetup - The ruling's resolve-ko-hero setup payload.
 * @returns The mutated game state.
 */
function runResolveKoHero(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveKoHeroSetup;
  const G = buildBaseState(1);

  G.playerZones = {
    [setup.currentPlayer]: makePlayerZones(setup.playerZones[setup.currentPlayer] as Partial<PlayerZones>),
  };
  const pending: PendingKoHeroChoice = { choiceType: 'ko-hero', playerID: setup.currentPlayer };
  G.pendingKoHeroChoices = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  resolveKoHeroChoice(moveContext, { zone: setup.resolve.zone, cardId: setup.resolve.cardId as CardExtId });

  return { G };
}

/**
 * Fires the real `resolveDiscardToPlay` move against a parked discard-to-play cost.
 *
 * @param rawSetup - The ruling's resolve-discard-to-play setup payload.
 * @returns The mutated game state.
 */
function runResolveDiscardToPlay(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveDiscardToPlaySetup;
  const G = buildBaseState(1);

  G.playerZones = { [setup.currentPlayer]: makePlayerZones({ hand: setup.hand as CardExtId[] }) };
  const pending: PendingDiscardToPlay = {
    playerID: setup.currentPlayer,
    sourceCardId: setup.pending.sourceCardId as CardExtId,
    remaining: setup.pending.remaining,
  };
  G.pendingDiscardToPlay = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  resolveDiscardToPlay(moveContext, { cardId: setup.resolve.cardId as CardExtId });

  return { G };
}

/**
 * Fires the real `resolveSmashDiscard` move against a parked Smash discard-for-attack
 * choice — either the discard-for-Attack path or the decline path.
 *
 * @param rawSetup - The ruling's resolve-smash setup payload.
 * @returns The mutated game state.
 */
function runResolveSmash(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveSmashSetup;
  const G = buildBaseState(1);

  G.playerZones = { [setup.currentPlayer]: makePlayerZones({ hand: setup.hand as CardExtId[] }) };
  const pending: PendingSmashDiscard = { playerID: setup.currentPlayer, magnitude: setup.magnitude };
  G.pendingSmashDiscards = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  // why: the resolve payload is a decline flag XOR a { cardId } discard request (the
  // move's own arg union) — branch so the harness can exercise both paths.
  if ('decline' in setup.resolve) {
    resolveSmashDiscard(moveContext, { decline: true });
  } else {
    resolveSmashDiscard(moveContext, { cardId: setup.resolve.cardId as CardExtId });
  }

  return { G };
}

/**
 * Fires the real `resolveRevealTopDispose` move against a parked reveal-top choice —
 * either the discard path (revealed top → owner discard) or the keep-on-top path.
 *
 * @param rawSetup - The ruling's resolve-reveal-top-dispose setup payload.
 * @returns The mutated game state.
 */
function runResolveRevealTopDispose(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveRevealTopDisposeSetup;
  const G = buildBaseState(1);

  G.playerZones = { [setup.currentPlayer]: makePlayerZones({ deck: setup.deck as CardExtId[] }) };
  const pending: PendingRevealTopDispose = {
    choiceType: 'reveal-top-dispose',
    playerID: setup.currentPlayer,
    revealedTops: [{ ownerPlayerID: setup.resolve.ownerPlayerID, cardId: setup.resolve.cardId as CardExtId }],
  };
  G.pendingRevealTopDispose = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  resolveRevealTopDispose(moveContext, {
    ownerPlayerID: setup.resolve.ownerPlayerID,
    cardId: setup.resolve.cardId as CardExtId,
    disposition: setup.resolve.disposition,
  });

  return { G };
}

/**
 * Fires the real `resolveGiveHqHeroChoice` move against a parked give-HQ-Hero choice —
 * either the gain path (chosen HQ Hero → chooser discard) or the decline path.
 *
 * @param rawSetup - The ruling's resolve-give-hq-hero setup payload.
 * @returns The mutated game state.
 */
function runResolveGiveHqHero(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveGiveHqHeroSetup;
  const G = buildBaseState(1);

  G.playerZones = { [setup.currentPlayer]: makePlayerZones({}) };
  G.hq = setup.hq as LegendaryGameState['hq'];
  if (setup.heroDeck !== undefined) {
    G.heroDeck = setup.heroDeck as CardExtId[];
  }
  const pending: PendingGiveHqHeroChoice = { choiceType: 'give-hq-hero', playerID: setup.currentPlayer };
  G.pendingGiveHqHeroChoices = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  // why: the resolve payload is a decline flag XOR a { cardId } gain request (the move's
  // own arg union) — branch so the harness exercises both the gain and decline paths.
  if ('decline' in setup.resolve) {
    resolveGiveHqHeroChoice(moveContext, { decline: true });
  } else {
    resolveGiveHqHeroChoice(moveContext, { cardId: setup.resolve.cardId as CardExtId });
  }

  return { G };
}

/**
 * Fires the real `resolveReturnZeroCostDiscard` move against a parked return-a-0-cost
 * choice — the mandatory move of a 0-cost card from discard back to hand.
 *
 * @param rawSetup - The ruling's resolve-return-zero-cost-discard setup payload.
 * @returns The mutated game state.
 */
function runResolveReturnZeroCostDiscard(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveReturnZeroCostDiscardSetup;
  const G = buildBaseState(1);

  G.playerZones = { [setup.currentPlayer]: makePlayerZones({ discard: setup.discard as CardExtId[] }) };
  // why: the eligibility predicate reads G.cardStats[id].cost (a card is returnable iff
  // 0-cost), so seed the costs the ruling declares via the complete-entry builder.
  for (const [cardId, cost] of Object.entries(setup.cardStats)) {
    G.cardStats[cardId as CardExtId] = makeCardStatEntry({ cost });
  }
  const pending: PendingReturnZeroCostDiscard = {
    playerID: setup.currentPlayer,
    sourceCardId: setup.sourceCardId as CardExtId,
  };
  G.pendingReturnZeroCostDiscard = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  resolveReturnZeroCostDiscard(moveContext, { cardId: setup.resolve.cardId as CardExtId });

  return { G };
}

/**
 * Fires the real `resolveDoOver` move against a parked Do-Over choice — accept
 * (discard the whole hand, draw a fixed 4) or decline (no-op).
 *
 * @param rawSetup - The ruling's resolve-do-over setup payload.
 * @returns The mutated game state.
 */
function runResolveDoOver(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveDoOverSetup;
  const G = buildBaseState(1);

  G.playerZones = {
    [setup.currentPlayer]: makePlayerZones({ hand: setup.hand as CardExtId[], deck: setup.deck as CardExtId[] }),
  };
  const pending: PendingDoOver = { playerID: setup.currentPlayer };
  G.pendingDoOverChoices = [pending];

  // why: resolveDoOver spreads the FnContext for the draw's ShuffleProvider (ctx.random),
  // so pass the full makeMockMoveContext (not just its .ctx) — the draw reshuffles only
  // when the deck runs short, which these rulings avoid by seeding a deep-enough deck.
  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  if ('accept' in setup.resolve) {
    resolveDoOver(moveContext, { accept: true });
  } else {
    resolveDoOver(moveContext, { decline: true });
  }

  return { G };
}

/**
 * Fires the real `resolveOptionalPutBottomHQ` move against a parked put-a-card-from-HQ
 * choice (the mandatory Absorb Ambient Power form) — the moved card goes to the Hero
 * Deck bottom and the icon-conditional +recruit/+attack reward fires per its icons.
 *
 * @param rawSetup - The ruling's resolve-optional-put-bottom-hq setup payload.
 * @returns The mutated game state.
 */
function runResolveOptionalPutBottomHq(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveOptionalPutBottomHqSetup;
  const G = buildBaseState(1);

  G.playerZones = { [setup.currentPlayer]: makePlayerZones({}) };
  G.hq = setup.hq as LegendaryGameState['hq'];
  G.heroDeck = setup.heroDeck as CardExtId[];
  // why: the icon reward reads the moved card's printed recruit/attack from G.cardStats
  // (recruit > 0 / attack > 0 = "has that icon"), so seed those stats via the complete-
  // entry builder — the SAME card seeded with vs without an icon drives the two rulings.
  for (const [cardId, stats] of Object.entries(setup.cardStats)) {
    G.cardStats[cardId as CardExtId] = makeCardStatEntry(stats);
  }
  const pending: PendingOptionalPutBottomHQ = {
    playerID: setup.currentPlayer,
    sourceCardId: setup.sourceCardId as CardExtId,
    mandatory: true,
    iconRewardMagnitude: setup.iconRewardMagnitude,
  };
  G.pendingOptionalPutBottomHQ = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  resolveOptionalPutBottomHQ(moveContext, { cardId: setup.resolve.cardId as CardExtId });

  return { G };
}

/**
 * Fires the real `resolveVictoryPileCardPick` move against a parked Ebony Blade choice —
 * claim attack equal to a chosen victory-pile villain's printed fight cost.
 *
 * @param rawSetup - The ruling's resolve-victory-pile-card-pick setup payload.
 * @returns The mutated game state.
 */
function runResolveVictoryPileCardPick(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveVictoryPileCardPickSetup;
  const G = buildBaseState(1);

  G.playerZones = { [setup.currentPlayer]: makePlayerZones({ victory: setup.victory as CardExtId[] }) };
  // why: eligibility reads G.villainDeckCardTypes (only 'villain'-typed victory cards
  // qualify) and the attack grant reads G.cardStats[id].fightCost (a villain's printed
  // attack is stored as fightCost, never .attack). Seed both from the ruling.
  G.villainDeckCardTypes = setup.villainDeckCardTypes as LegendaryGameState['villainDeckCardTypes'];
  for (const [cardId, stats] of Object.entries(setup.cardStats)) {
    G.cardStats[cardId as CardExtId] = makeCardStatEntry(stats);
  }
  const pending: PendingVictoryPileCardPick = { playerID: setup.currentPlayer, rewardType: 'attack' };
  G.pendingVictoryPileCardPick = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  resolveVictoryPileCardPick(moveContext, { cardId: setup.resolve.cardId as CardExtId });

  return { G };
}

/**
 * Fires the real `resolveKoDiscardChoice` move against a parked KO-up-to-N-from-discard
 * choice (Loki's Maniacal Tyrant) — KO the chosen distinct discard cards to G.ko.
 *
 * @param rawSetup - The ruling's resolve-ko-discard setup payload.
 * @returns The mutated game state.
 */
function runResolveKoDiscard(rawSetup: Record<string, unknown>): Outcome {
  const setup = rawSetup as unknown as ResolveKoDiscardSetup;
  const G = buildBaseState(1);

  G.playerZones = { [setup.currentPlayer]: makePlayerZones({ discard: setup.discard as CardExtId[] }) };
  const pending: PendingKoDiscardChoice = {
    choiceType: 'ko-from-discard',
    playerID: setup.currentPlayer,
    maxCount: setup.maxCount,
  };
  G.pendingKoDiscardChoices = [pending];

  const moveContext = makeMockMoveContext(G, { playerID: setup.currentPlayer });
  resolveKoDiscardChoice(moveContext, { cardIds: setup.resolve.cardIds as CardExtId[] });

  return { G };
}

// why: D-24524 — the harness dispatch map is the runtime binding of the closed
// RULING_SCENARIO_ACTIONS vocabulary to real handlers. The drift-pin describe below
// asserts its keys equal the canonical array exactly (D-24372: a runtime assertion, not
// a bare `satisfies`), so a union member with no runner — or a runner with no member —
// reddens the suite.
const SCENARIO_RUNNERS: Record<RulingScenarioAction, (setup: Record<string, unknown>) => Outcome> = {
  'fire-villain-effect': runFireVillainEffect,
  'resolve-melter-ko': runResolveMelterKo,
  'resolve-optional-ko-reward': runResolveOptionalKoReward,
  'query-card-has-class': runQueryCardHasClass,
  'fire-hero-effect': runFireHeroEffect,
  'fire-rule-hook': runFireRuleHook,
  'resolve-scry-ko': runResolveScryKo,
  'resolve-ko-hero': runResolveKoHero,
  'resolve-discard-to-play': runResolveDiscardToPlay,
  'resolve-smash': runResolveSmash,
  'resolve-reveal-top-dispose': runResolveRevealTopDispose,
  'resolve-give-hq-hero': runResolveGiveHqHero,
  'resolve-return-zero-cost-discard': runResolveReturnZeroCostDiscard,
  'resolve-do-over': runResolveDoOver,
  'resolve-optional-put-bottom-hq': runResolveOptionalPutBottomHq,
  'resolve-victory-pile-card-pick': runResolveVictoryPileCardPick,
  'resolve-ko-discard': runResolveKoDiscard,
};

/**
 * Runs a ruling's scenario, firing its real handler. An unmapped action is a HARD
 * failure (never a skip) — a non-executing ruling is exactly the drift this corpus
 * prevents.
 *
 * @param scenario - The ruling scenario.
 * @returns The outcome (mutated G + any query result).
 */
function runScenario(scenario: RulingScenario): Outcome {
  const runner = SCENARIO_RUNNERS[scenario.action];
  if (runner === undefined) {
    throw new Error(`No harness runner for scenario action "${scenario.action}"; every action must map to a runner.`);
  }
  return runner(scenario.setup);
}

// ---------------------------------------------------------------------------
// Expectation checkers — strict equality on handler output
// ---------------------------------------------------------------------------

/** Asserts a named player's named zone equals the expected exact card list. */
function checkZoneCardsEqual(outcome: Outcome, expected: RulingExpectation): void {
  const zones = outcome.G.playerZones[expected.player as string];
  assert.ok(zones !== undefined, `expected player "${expected.player}" to have zones`);
  const actual = zones[expected.zone as RulingZoneName];
  assert.deepStrictEqual(actual, expected.cards, `player ${expected.player} ${expected.zone} zone mismatch`);
}

/** Asserts the KO pile equals the expected exact card list. */
function checkKoPileEqual(outcome: Outcome, expected: RulingExpectation): void {
  assert.deepStrictEqual(outcome.G.ko, expected.cards, 'KO pile mismatch');
}

/** Asserts a named pending queue has the expected exact length. */
function checkPendingQueueLength(outcome: Outcome, expected: RulingExpectation): void {
  // why: code-style forbids chained ternaries; five pending queues → if/else if chain.
  // Each queue is named explicitly (no catch-all else) so a new RulingPendingQueue
  // member added without a branch here fails loudly rather than misrouting to a default.
  let queue: readonly unknown[] | undefined;
  if (expected.queue === 'melter') {
    queue = outcome.G.pendingMelterKoChoices;
  } else if (expected.queue === 'optional-ko-reward') {
    queue = outcome.G.pendingOptionalKoRewards;
  } else if (expected.queue === 'scry-ko') {
    queue = outcome.G.pendingScryKoChoices;
  } else if (expected.queue === 'ko-hero') {
    queue = outcome.G.pendingKoHeroChoices;
  } else if (expected.queue === 'give-hq-hero') {
    queue = outcome.G.pendingGiveHqHeroChoices;
  } else if (expected.queue === 'smash') {
    queue = outcome.G.pendingSmashDiscards;
  } else if (expected.queue === 'reveal-top-dispose') {
    queue = outcome.G.pendingRevealTopDispose;
  } else {
    throw new Error(`No harness mapping for pending queue "${expected.queue}"; add a branch to checkPendingQueueLength.`);
  }
  assert.equal(queue?.length ?? 0, expected.length, `pending ${expected.queue} queue length mismatch`);
}

/** Asserts the query's boolean result equals the expected value. */
function checkBooleanResult(outcome: Outcome, expected: RulingExpectation): void {
  assert.equal(outcome.booleanResult, expected.value, 'boolean result mismatch');
}

/** Asserts a named `G.turnEconomy` field equals the expected amount. */
function checkTurnEconomyValue(outcome: Outcome, expected: RulingExpectation): void {
  const field = expected.economyField as 'attack' | 'recruit' | 'woundsDrawn' | 'cardsDrawn';
  assert.equal(outcome.G.turnEconomy[field], expected.amount, `turnEconomy.${field} mismatch`);
}

// why: `G.counters` is an open Record and an untouched counter is absent, so read it
// as `?? 0` — the same default the scheme / mastermind handlers use when they read a
// counter (schemeHandlers.ts / mastermindHandlers.ts). A perturbed count still flips
// the assertion (the actual value never changes), so the non-vacuity guard holds.
/** Asserts a named `G.counters` key equals the expected count (absent reads as 0). */
function checkCounterValue(outcome: Outcome, expected: RulingExpectation): void {
  const counter = expected.counter as RulingCounterField;
  assert.equal(outcome.G.counters[counter] ?? 0, expected.count, `counters.${counter} mismatch`);
}

/** Asserts a named player's `G.handSizeOverrides` next-hand size equals the expected value. */
function checkHandSizeOverride(outcome: Outcome, expected: RulingExpectation): void {
  const player = expected.player as string;
  assert.equal(outcome.G.handSizeOverrides[player], expected.size, `handSizeOverrides.${player} mismatch`);
}

/** Asserts a named villain's captured-hero list (`G.villainAttachedHeroes[id]`) equals the expected cards. */
function checkVillainAttachedHeroes(outcome: Outcome, expected: RulingExpectation): void {
  const villainCardId = expected.villainCardId as string;
  const actual = outcome.G.villainAttachedHeroes[villainCardId] ?? [];
  assert.deepStrictEqual(actual, expected.cards, `villainAttachedHeroes.${villainCardId} mismatch`);
}

/** Asserts the escaped pile (`G.escapedPile`) equals the expected exact card list. */
function checkEscapedPileEqual(outcome: Outcome, expected: RulingExpectation): void {
  assert.deepStrictEqual(outcome.G.escapedPile, expected.cards, 'escaped pile mismatch');
}

/** Asserts a named card's attached-bystander list (`G.attachedBystanders[id]`) equals the expected cards. */
function checkAttachedBystandersEqual(outcome: Outcome, expected: RulingExpectation): void {
  const villainCardId = expected.villainCardId as string;
  const actual = outcome.G.attachedBystanders[villainCardId] ?? [];
  assert.deepStrictEqual(actual, expected.cards, `attachedBystanders.${villainCardId} mismatch`);
}

/** Asserts the City row (`G.city`) equals the expected exact occupant list. */
function checkCityEqual(outcome: Outcome, expected: RulingExpectation): void {
  assert.deepStrictEqual(outcome.G.city, expected.cards, 'City row mismatch');
}

// why: a boolean `G.turnEconomy` flag is lazily materialized (absent when unset), so read
// it as `=== true` — the same absent-is-false posture the economy helpers use. A perturbed
// value still flips the assertion (the actual boolean never changes), so non-vacuity holds.
/** Asserts a named boolean `G.turnEconomy` flag equals the expected value (absent reads as false). */
function checkTurnEconomyFlag(outcome: Outcome, expected: RulingExpectation): void {
  const flag = expected.economyFlag as RulingEconomyFlag;
  assert.equal(outcome.G.turnEconomy[flag] === true, expected.value, `turnEconomy.${flag} flag mismatch`);
}

const EXPECTATION_CHECKERS: Record<RulingExpectationKind, (outcome: Outcome, expected: RulingExpectation) => void> = {
  'zone-cards-equal': checkZoneCardsEqual,
  'ko-pile-equal': checkKoPileEqual,
  'pending-queue-length': checkPendingQueueLength,
  'boolean-result': checkBooleanResult,
  'turn-economy-value': checkTurnEconomyValue,
  'counter-value': checkCounterValue,
  'hand-size-override': checkHandSizeOverride,
  'villain-attached-heroes': checkVillainAttachedHeroes,
  'escaped-pile-equal': checkEscapedPileEqual,
  'attached-bystanders-equal': checkAttachedBystandersEqual,
  'city-equal': checkCityEqual,
  'turn-economy-flag': checkTurnEconomyFlag,
};

/**
 * Asserts a ruling's expectation against an outcome. Unknown kind is a hard failure.
 *
 * @param outcome - The scenario outcome.
 * @param expected - The ruling expectation.
 */
function checkExpectation(outcome: Outcome, expected: RulingExpectation): void {
  const checker = EXPECTATION_CHECKERS[expected.kind];
  if (checker === undefined) {
    throw new Error(`No harness checker for expectation kind "${expected.kind}".`);
  }
  checker(outcome, expected);
}

// ---------------------------------------------------------------------------
// Perturbers — produce a definitely-different expectation for the non-vacuity test
// ---------------------------------------------------------------------------

// why: a sentinel card ext_id no engine handler ever produces, so appending it to an
// expected card list guarantees the perturbed expectation fails against real output.
const PERTURB_SENTINEL = 'ruling-perturbation-sentinel';

const PERTURBERS: Record<RulingExpectationKind, (expected: RulingExpectation) => RulingExpectation> = {
  'zone-cards-equal': (expected) => ({ ...expected, cards: [...(expected.cards ?? []), PERTURB_SENTINEL] }),
  'ko-pile-equal': (expected) => ({ ...expected, cards: [...(expected.cards ?? []), PERTURB_SENTINEL] }),
  'pending-queue-length': (expected) => ({ ...expected, length: (expected.length ?? 0) + 1 }),
  'boolean-result': (expected) => ({ ...expected, value: !(expected.value ?? false) }),
  'turn-economy-value': (expected) => ({ ...expected, amount: (expected.amount ?? 0) + 1 }),
  'counter-value': (expected) => ({ ...expected, count: (expected.count ?? 0) + 1 }),
  'hand-size-override': (expected) => ({ ...expected, size: (expected.size ?? 0) + 1 }),
  'villain-attached-heroes': (expected) => ({ ...expected, cards: [...(expected.cards ?? []), PERTURB_SENTINEL] }),
  'escaped-pile-equal': (expected) => ({ ...expected, cards: [...(expected.cards ?? []), PERTURB_SENTINEL] }),
  'attached-bystanders-equal': (expected) => ({ ...expected, cards: [...(expected.cards ?? []), PERTURB_SENTINEL] }),
  'city-equal': (expected) => ({ ...expected, cards: [...(expected.cards ?? []), PERTURB_SENTINEL] }),
  'turn-economy-flag': (expected) => ({ ...expected, value: !(expected.value ?? false) }),
};

/**
 * Perturbs an expectation into one the correct handler output cannot satisfy.
 *
 * @param expected - The ruling expectation.
 * @returns A perturbed expectation guaranteed to differ from the original.
 */
function perturbExpectation(expected: RulingExpectation): RulingExpectation {
  const perturber = PERTURBERS[expected.kind];
  if (perturber === undefined) {
    throw new Error(`No perturber for expectation kind "${expected.kind}".`);
  }
  return perturber(expected);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('effect-rulings closed vocabulary — runtime drift pins (D-24524 / D-24372)', () => {
  // why: D-24372 — runtime keyset assertions, NOT bare `satisfies`. Engine test files
  // were historically un-typechecked, so a compile-time pin would prove nothing; these
  // bind the canonical arrays to the executable harness maps at run time.
  it('RULING_SCENARIO_ACTIONS matches the SCENARIO_RUNNERS keys exactly', () => {
    assert.deepStrictEqual([...RULING_SCENARIO_ACTIONS].slice().sort(), Object.keys(SCENARIO_RUNNERS).slice().sort());
  });

  it('RULING_EXPECTATION_KINDS matches the EXPECTATION_CHECKERS keys exactly', () => {
    assert.deepStrictEqual([...RULING_EXPECTATION_KINDS].slice().sort(), Object.keys(EXPECTATION_CHECKERS).slice().sort());
  });

  it('RULING_EXPECTATION_KINDS matches the PERTURBERS keys exactly', () => {
    assert.deepStrictEqual([...RULING_EXPECTATION_KINDS].slice().sort(), Object.keys(PERTURBERS).slice().sort());
  });

  it('the canonical vocabulary arrays have no duplicates', () => {
    assert.equal(new Set(RULING_SCENARIO_ACTIONS).size, RULING_SCENARIO_ACTIONS.length);
    assert.equal(new Set(RULING_EXPECTATION_KINDS).size, RULING_EXPECTATION_KINDS.length);
  });
});

describe('effect-rulings corpus — shape', () => {
  it('loads at least 8 seed rulings (the WP-704 target)', () => {
    assert.ok(CORPUS.length >= 8, `expected >= 8 seed rulings, got ${CORPUS.length}`);
  });

  it('every ruling cites a decision and carries a non-empty why', () => {
    for (const ruling of CORPUS) {
      assert.ok(
        typeof ruling.decision === 'string' && /^D-\d+$/.test(ruling.decision),
        `ruling "${ruling.id}" must cite a D- reference`,
      );
      assert.ok(ruling.why.trim().length > 0, `ruling "${ruling.id}" must carry a non-empty why`);
    }
  });
});

describe('effect rulings — executed against the real engine handlers (D-24524)', () => {
  for (const ruling of CORPUS) {
    const label = ruling.decision ? `${ruling.mechanic} · ${ruling.decision}` : ruling.mechanic;
    it(`${ruling.id} [${label}]`, () => {
      const outcome = runScenario(ruling.scenario);
      checkExpectation(outcome, ruling.expected);
    });
  }
});

describe('per-ruling non-vacuity self-test (reward-integrity core, D-24524)', () => {
  for (const ruling of CORPUS) {
    it(`${ruling.id} reddens when its expected is perturbed`, () => {
      const perturbed = perturbExpectation(ruling.expected);
      assert.notDeepStrictEqual(
        perturbed,
        ruling.expected,
        `perturbation must change the expectation for "${ruling.id}"`,
      );
      const outcome = runScenario(ruling.scenario);
      // why: reward-integrity guard — perturbing the expected value MUST flip a live
      // ruling from pass to fail. A ruling that still passes when perturbed has an
      // assertion that does not depend on its expected value at all (a constant-true /
      // always-pass check) — the exact vacuous fixture forbidden here; a hard failure.
      // This proves the assertion is a real strict-equality check. It does NOT by itself
      // prove the asserted value came from the handler rather than the setup baseline, so
      // a non-mutation ("spared" / "unchanged") ruling must be paired with a positive
      // sibling ruling that asserts the handler produced a change (see
      // docs/ai/rulings/README.md §How to add a ruling).
      assert.throws(
        () => checkExpectation(outcome, perturbed),
        `ruling "${ruling.id}" is vacuous: perturbing its expected did not change the assertion outcome, so its assertion is a constant-true check that ignores its expected value.`,
      );
    });
  }
});
