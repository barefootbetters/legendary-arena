/**
 * Runtime validator + closed vocabulary for the executable effect-rulings corpus
 * (WP-704 / EC-741 / D-24524).
 *
 * An "effect ruling" is one entry in the private, hand-authored
 * `docs/ai/rulings/effect-rulings.json` corpus: a card-effect edge-case decision
 * captured as `scenario → expected → why` and executed by the harness in
 * `effectRulings.test.ts` against the REAL engine handlers, so a ruling can never
 * silently drift from the code it describes.
 *
 * This module is a HAND-WRITTEN runtime type guard plus closed scenario /
 * expectation unions — Node built-ins only, NO zod. The `game-engine` package may
 * import Node built-ins only (`.claude/rules/architecture.md`); zod is the registry
 * layer's dependency and a zod import here would both break `pnpm -r build` and cross
 * the layer boundary. The shape mirrors the established engine precedent — a local
 * structural interface + a runtime guard + a drift-pinned canonical readonly array —
 * exactly the `VillainEffectPrimitive` / `VILLAIN_EFFECT_PRIMITIVES` shape in
 * `villainAbility.types.ts`.
 *
 * Imports nothing (Node built-ins only, and none are needed here). No boardgame.io.
 */

// ---------------------------------------------------------------------------
// Closed scenario vocabulary
// ---------------------------------------------------------------------------

// why: D-24524 — the effect-rulings SCENARIO vocabulary is a CLOSED union that grows
// one member at a time. A new ruling that needs a new action adds exactly one member
// here, one runner in the harness's SCENARIO_RUNNERS map, and the ruling that uses it —
// together. There is deliberately NO general scenario DSL (the D-24029 effect-primitive
// discipline). The union is runtime drift-pinned in effectRulings.test.ts against the
// harness dispatch map (D-24372: a runtime keyset assertion, never a bare `satisfies` —
// engine test files were historically un-typechecked, so a compile-time pin proves
// nothing here). Each action names one existing engine handler the harness fires.
/**
 * Closed union of ruling scenario actions. Each maps to one harness runner that
 * builds a minimal `G` and fires one real engine handler.
 *
 * - `fire-villain-effect` — set a single villain-ability hook and call
 *   `executeVillainAbilities` (reveal-or-wound, ko-wounds-current-hand-and-discard,
 *   the Melter ko-cullable park).
 * - `resolve-melter-ko` — call the `resolveMelterKoChoice` move on a parked choice.
 * - `resolve-optional-ko-reward` — call the `resolveOptionalKoReward` move on a
 *   parked reward.
 * - `query-card-has-class` — call the pure `cardHasClassWhenPlayed` query.
 * - `fire-hero-effect` — call `executeSingleEffect` (the hero-effect executor) for
 *   one hero keyword against a real handler.
 * - `fire-rule-hook` — fire the `executeRuleHooks` → `applyRuleEffects` scheme /
 *   mastermind rule pipeline for one trigger (`onSchemeTwistRevealed` /
 *   `onMastermindStrikeRevealed`) against the real default handlers (D-2401).
 * - `resolve-scry-ko` — call the `resolveScryKoChoice` move on a parked Doombot
 *   scry-KO choice.
 * - `resolve-ko-hero` — call the `resolveKoHeroChoice` move on a parked KO-a-Hero
 *   choice.
 * - `resolve-discard-to-play` — call the `resolveDiscardToPlay` move on a parked
 *   discard-to-play cost choice.
 * - `resolve-smash` — call the `resolveSmashDiscard` move on a parked Smash
 *   discard-for-attack choice.
 * - `resolve-reveal-top-dispose` — call the `resolveRevealTopDispose` move on a
 *   parked reveal-top discard-or-keep choice.
 * - `resolve-give-hq-hero` — call the `resolveGiveHqHeroChoice` move on a parked
 *   give-HQ-Hero choice.
 * - `resolve-return-zero-cost-discard` — call the `resolveReturnZeroCostDiscard`
 *   move on a parked return-a-0-cost-discard choice.
 * - `resolve-do-over` — call the `resolveDoOver` move on a parked Do-Over
 *   accept/decline choice.
 * - `resolve-optional-put-bottom-hq` — call the `resolveOptionalPutBottomHQ` move on
 *   a parked put-a-card-from-the-HQ-on-the-deck-bottom choice.
 * - `resolve-victory-pile-card-pick` — call the `resolveVictoryPileCardPick` move on
 *   a parked claim-attack-from-a-victory-pile-villain choice.
 * - `resolve-ko-discard` — call the `resolveKoDiscardChoice` move on a parked
 *   KO-up-to-N-from-your-discard choice.
 * - `resolve-put-hand-on-deck-top` — call the `resolvePutHandOnDeckTop` move on a
 *   parked put-a-hand-card-on-top-of-your-deck choice.
 * - `resolve-undercover` — call the `resolveUndercoverChoice` move on a parked
 *   send-a-S.H.I.E.L.D.-Hero-Undercover choice.
 * - `resolve-discard-choice` — call the `resolveDiscardChoice` move on a parked
 *   discard-down-to-a-limit choice.
 * - `resolve-put-cards-on-deck` — call the `resolvePutCardsOnDeckChoice` move on a
 *   parked put-exactly-N-cards-on-your-deck-top choice.
 * - `resolve-reorder` — call the `resolveReorderChoice` move on a parked
 *   reorder-the-deck-top-remainder choice.
 * - `resolve-draw-or-empowered` — call the `resolveDrawOrEmpowered` move on a parked
 *   choose-one draw-a-card-or-be-Empowered choice.
 * - `resolve-put-any-number-bottom-hq` — call the `resolvePutAnyNumberBottomHQ` move on
 *   a parked put-any-number-of-HQ-cards-on-the-deck-bottom choice.
 * - `resolve-return-on-discard` — call the `resolveReturnOnDiscard` move on a parked
 *   optional return-the-just-discarded-card-to-hand choice.
 * - `resolve-hero-choice` — call the `resolveHeroChoice` move on a parked
 *   discard-or-return-the-revealed-top-card choice.
 * - `resolve-count-scaled-choice` — call the `resolveCountScaledChoice` move on a
 *   parked count-scaled choose-one choice (vnom's Symbiotic Adaptation).
 * - `resolve-electromagnetic-bubble-choice` — call the
 *   `resolveElectromagneticBubbleChoice` move on a parked Magneto Electromagnetic
 *   Bubble in-play-X-Men pick.
 * - `resolve-ruthless-dictator-choice` — call the `resolveRuthlessDictatorChoice`
 *   move on a parked Red Skull Ruthless Dictator scry-3 disposition choice.
 */
export type RulingScenarioAction =
  | 'fire-villain-effect'
  | 'resolve-melter-ko'
  | 'resolve-optional-ko-reward'
  | 'query-card-has-class'
  | 'fire-hero-effect'
  | 'fire-rule-hook'
  | 'resolve-scry-ko'
  | 'resolve-ko-hero'
  | 'resolve-discard-to-play'
  | 'resolve-smash'
  | 'resolve-reveal-top-dispose'
  | 'resolve-give-hq-hero'
  | 'resolve-return-zero-cost-discard'
  | 'resolve-do-over'
  | 'resolve-optional-put-bottom-hq'
  | 'resolve-victory-pile-card-pick'
  | 'resolve-ko-discard'
  | 'resolve-put-hand-on-deck-top'
  | 'resolve-undercover'
  | 'resolve-discard-choice'
  | 'resolve-put-cards-on-deck'
  | 'resolve-reorder'
  | 'resolve-draw-or-empowered'
  | 'resolve-put-any-number-bottom-hq'
  | 'resolve-return-on-discard'
  | 'resolve-hero-choice'
  | 'resolve-count-scaled-choice'
  | 'resolve-electromagnetic-bubble-choice'
  | 'resolve-ruthless-dictator-choice';

/**
 * All ruling scenario actions in canonical order. Single source of truth; runtime
 * drift-pinned against the harness's SCENARIO_RUNNERS keys (D-24372).
 */
export const RULING_SCENARIO_ACTIONS: readonly RulingScenarioAction[] = [
  'fire-villain-effect',
  'resolve-melter-ko',
  'resolve-optional-ko-reward',
  'query-card-has-class',
  'fire-hero-effect',
  'fire-rule-hook',
  'resolve-scry-ko',
  'resolve-ko-hero',
  'resolve-discard-to-play',
  'resolve-smash',
  'resolve-reveal-top-dispose',
  'resolve-give-hq-hero',
  'resolve-return-zero-cost-discard',
  'resolve-do-over',
  'resolve-optional-put-bottom-hq',
  'resolve-victory-pile-card-pick',
  'resolve-ko-discard',
  'resolve-put-hand-on-deck-top',
  'resolve-undercover',
  'resolve-discard-choice',
  'resolve-put-cards-on-deck',
  'resolve-reorder',
  'resolve-draw-or-empowered',
  'resolve-put-any-number-bottom-hq',
  'resolve-return-on-discard',
  'resolve-hero-choice',
  'resolve-count-scaled-choice',
  'resolve-electromagnetic-bubble-choice',
  'resolve-ruthless-dictator-choice',
] as const;

// ---------------------------------------------------------------------------
// Closed expectation vocabulary
// ---------------------------------------------------------------------------

// why: D-24524 — the EXPECTATION vocabulary is the second closed union, grown one
// member at a time alongside its harness checker + perturber. Every expectation is a
// STRICT-equality assertion on a concrete value the handler writes (a zone's exact
// contents, the KO pile, a pending-queue length, a boolean result) so the per-ruling
// non-vacuity self-test can perturb the expected value and be GUARANTEED a failure — a
// looser assertion that could not fail is exactly the always-pass fixture reward
// integrity forbids. Runtime drift-pinned in effectRulings.test.ts against both the
// EXPECTATION_CHECKERS and PERTURBERS maps (D-24372).
/**
 * Closed union of ruling expectation kinds. Each maps to one harness checker (a
 * strict-equality assertion on handler output) and one perturber (for the non-vacuity
 * self-test).
 *
 * - `zone-cards-equal` — a named player's named zone equals an exact card list.
 * - `ko-pile-equal` — `G.ko` equals an exact card list.
 * - `pending-queue-length` — a named pending queue has an exact length.
 * - `boolean-result` — the query action's boolean return equals an exact value.
 * - `turn-economy-value` — a named `G.turnEconomy` field equals an exact amount.
 * - `counter-value` — a named `G.counters` field equals an exact count (absent
 *   reads as 0, matching the handlers' own `?? 0` counter reads).
 * - `hand-size-override` — a named player's `G.handSizeOverrides` next-hand size
 *   equals an exact value.
 * - `villain-attached-heroes` — the heroes captured onto a named villain
 *   (`G.villainAttachedHeroes[villainCardId]`) equal an exact card list.
 * - `escaped-pile-equal` — `G.escapedPile` equals an exact card list.
 * - `attached-bystanders-equal` — the bystanders attached to a named card
 *   (`G.attachedBystanders[villainCardId]`) equal an exact card list.
 * - `city-equal` — `G.city` (the City row) equals an exact occupant list.
 * - `turn-economy-flag` — a named boolean `G.turnEconomy` flag (absent reads as
 *   false) equals an exact boolean.
 * - `hq-equal` — `G.hq` (the HQ row) equals an exact occupant list (full slots
 *   only — design the ruling so the refill leaves no `null` gap).
 * - `deferred-hand-injections-equal` — a named player's deferred hand injections
 *   (`G.deferredHandInjections[player]`, absent = `[]`) equal an exact card list.
 */
export type RulingExpectationKind =
  | 'zone-cards-equal'
  | 'ko-pile-equal'
  | 'pending-queue-length'
  | 'boolean-result'
  | 'turn-economy-value'
  | 'counter-value'
  | 'hand-size-override'
  | 'villain-attached-heroes'
  | 'escaped-pile-equal'
  | 'attached-bystanders-equal'
  | 'city-equal'
  | 'turn-economy-flag'
  | 'hq-equal'
  | 'deferred-hand-injections-equal';

/**
 * All ruling expectation kinds in canonical order. Single source of truth; runtime
 * drift-pinned against the harness's EXPECTATION_CHECKERS + PERTURBERS keys (D-24372).
 */
export const RULING_EXPECTATION_KINDS: readonly RulingExpectationKind[] = [
  'zone-cards-equal',
  'ko-pile-equal',
  'pending-queue-length',
  'boolean-result',
  'turn-economy-value',
  'counter-value',
  'hand-size-override',
  'villain-attached-heroes',
  'escaped-pile-equal',
  'attached-bystanders-equal',
  'city-equal',
  'turn-economy-flag',
  'hq-equal',
  'deferred-hand-injections-equal',
] as const;

// why: D-24524 — the closed set of `G.turnEconomy` fields a `turn-economy-value`
// expectation may assert on. A small validated list (not any string) keeps the
// vocabulary closed; grow it one field at a time as a ruling needs another producer.
/** The `G.turnEconomy` fields a `turn-economy-value` expectation may name. */
export type RulingEconomyField = 'attack' | 'recruit' | 'woundsDrawn' | 'cardsDrawn';

/** All economy fields a `turn-economy-value` expectation may name. */
export const RULING_ECONOMY_FIELDS: readonly RulingEconomyField[] = [
  'attack',
  'recruit',
  'woundsDrawn',
  'cardsDrawn',
] as const;

// why: D-24524 — the closed set of boolean `G.turnEconomy` flags a `turn-economy-flag`
// expectation may assert on. `recruitSpendableAsAttack` is the WP-580 / D-24389 God of
// Thunder conversion flag (absent when unset — lazy-materialized so the hash oracles stay
// byte-stable). Grow this one flag at a time as a ruling needs another.
/** The boolean `G.turnEconomy` flags a `turn-economy-flag` expectation may name. */
export type RulingEconomyFlag = 'recruitSpendableAsAttack';

/** All economy flags a `turn-economy-flag` expectation may name. */
export const RULING_ECONOMY_FLAGS: readonly RulingEconomyFlag[] = ['recruitSpendableAsAttack'] as const;

// why: D-24524 — the closed set of `G.counters` keys a `counter-value` expectation
// may assert on. `G.counters` is an open `Record<string, number>` at the type level,
// so a validated closed list (not any string) keeps the ruling vocabulary closed;
// grow it one key at a time as a ruling needs another counter. `schemeTwistCount` is
// incremented by the scheme-twist handler (D-2401 / schemeHandlers.ts), and
// `masterStrikeCount` by the mastermind-strike handler (D-2403 / mastermindHandlers.ts).
/** The `G.counters` keys a `counter-value` expectation may name. */
export type RulingCounterField = 'schemeTwistCount' | 'masterStrikeCount';

/** All counter keys a `counter-value` expectation may name. */
export const RULING_COUNTER_FIELDS: readonly RulingCounterField[] = [
  'schemeTwistCount',
  'masterStrikeCount',
] as const;

/** The player zones a `zone-cards-equal` expectation may name. */
export type RulingZoneName = 'deck' | 'hand' | 'discard' | 'inPlay' | 'victory';

/** The pending queues a `pending-queue-length` expectation may name. */
export type RulingPendingQueue =
  | 'melter'
  | 'optional-ko-reward'
  | 'scry-ko'
  | 'ko-hero'
  | 'give-hq-hero'
  | 'smash'
  | 'reveal-top-dispose';

// ---------------------------------------------------------------------------
// Ruling entry shape
// ---------------------------------------------------------------------------

/**
 * A ruling's scenario: the closed action verb plus a per-action setup payload.
 *
 * `setup` is intentionally an open record here — its per-action fields are read and
 * type-narrowed by the matching harness runner, which fails loudly on a wrong shape.
 * The validator enforces the closed `action` membership and that `setup` is present;
 * the harness enforces the field-level shape when it fires the handler.
 */
export interface RulingScenario {
  action: RulingScenarioAction;
  setup: Record<string, unknown>;
}

/**
 * A ruling's expectation: the closed kind verb plus its concrete comparable value(s).
 *
 * Exactly the fields for the `kind` are read by the matching harness checker. The
 * validator enforces the closed `kind` membership and the presence + type of that
 * kind's comparable field(s).
 */
export interface RulingExpectation {
  kind: RulingExpectationKind;
  /** `zone-cards-equal` / `hand-size-override` / `deferred-hand-injections-equal`: the player whose value is asserted. */
  player?: string;
  /** `zone-cards-equal`: the zone whose contents are asserted. */
  zone?: RulingZoneName;
  /** `zone-cards-equal` / `ko-pile-equal` / `villain-attached-heroes` / `escaped-pile-equal` / `attached-bystanders-equal` / `city-equal` / `hq-equal` / `deferred-hand-injections-equal`: the exact expected card ext_ids. */
  cards?: string[];
  /** `pending-queue-length`: which pending queue to measure. */
  queue?: RulingPendingQueue;
  /** `pending-queue-length`: the exact expected queue length. */
  length?: number;
  /** `boolean-result` / `turn-economy-flag`: the exact expected boolean. */
  value?: boolean;
  /** `turn-economy-flag`: which boolean `G.turnEconomy` flag to assert. */
  economyFlag?: RulingEconomyFlag;
  /** `turn-economy-value`: which `G.turnEconomy` field to assert. */
  economyField?: RulingEconomyField;
  /** `turn-economy-value`: the exact expected amount. */
  amount?: number;
  /** `counter-value`: which `G.counters` key to assert. */
  counter?: RulingCounterField;
  /** `counter-value`: the exact expected count (absent counter reads as 0). */
  count?: number;
  /** `hand-size-override`: the exact expected `G.handSizeOverrides[player]` value. */
  size?: number;
  /** `villain-attached-heroes` / `attached-bystanders-equal`: the card ext_id whose attached-card list is asserted. */
  villainCardId?: string;
}

/**
 * One executable effect ruling.
 *
 * `id` is unique + kebab-case; `mechanic` names the effect under test; `decision`
 * (optional) cites the `D-` that settled it; `rulesRef` (optional) cross-references the
 * player-facing rulebook (`docs/legendary-universal-rules-v23.md`) — e.g.
 * `"universal-rules-v23 §Smash"` — the same convention the engine's `// why:` comments
 * use; `why` is MANDATORY and non-empty (a ruling without rationale is a fixture, not a
 * ruling); `scenario` + `expected` are the closed-vocabulary action and assertion the
 * harness runs.
 */
export interface Ruling {
  id: string;
  mechanic: string;
  decision?: string;
  rulesRef?: string;
  scenario: RulingScenario;
  expected: RulingExpectation;
  why: string;
}

// ---------------------------------------------------------------------------
// Runtime guards (hand-written; no zod)
// ---------------------------------------------------------------------------

/** Whether a value is a plain non-null object (not an array). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether a value is a non-empty string once trimmed. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Whether a value is an array whose every element is a string. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((element) => typeof element === 'string');
}

/** Whether a value is a member of a readonly canonical array. */
function isMemberOf<T extends string>(value: unknown, members: readonly T[]): value is T {
  return typeof value === 'string' && (members as readonly string[]).includes(value);
}

/** Whether a string is kebab-case (`lower-case-words`, digits allowed within a word). */
function isKebabCase(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * Validates one expectation's comparable fields for its `kind`, returning a full-
 * sentence error string or `null` when valid.
 *
 * @param expected - The expectation object to validate (kind already checked).
 * @param rulingId - The owning ruling's id, for the error message.
 * @returns An error sentence, or null when the expectation is well-formed.
 */
function validateExpectationFields(expected: RulingExpectation, rulingId: string): string | null {
  switch (expected.kind) {
    case 'zone-cards-equal':
      if (!isNonEmptyString(expected.player)) {
        return `Ruling "${rulingId}" has a zone-cards-equal expectation with no "player"; name the player whose zone is asserted.`;
      }
      if (!isMemberOf<RulingZoneName>(expected.zone, ['deck', 'hand', 'discard', 'inPlay', 'victory'])) {
        return `Ruling "${rulingId}" has a zone-cards-equal expectation with an invalid "zone"; use one of deck/hand/discard/inPlay/victory.`;
      }
      if (!isStringArray(expected.cards)) {
        return `Ruling "${rulingId}" has a zone-cards-equal expectation whose "cards" is not an array of card ext_id strings.`;
      }
      return null;
    case 'ko-pile-equal':
      if (!isStringArray(expected.cards)) {
        return `Ruling "${rulingId}" has a ko-pile-equal expectation whose "cards" is not an array of card ext_id strings.`;
      }
      return null;
    case 'pending-queue-length':
      if (!isMemberOf<RulingPendingQueue>(expected.queue, ['melter', 'optional-ko-reward', 'scry-ko', 'ko-hero', 'give-hq-hero', 'smash', 'reveal-top-dispose'])) {
        return `Ruling "${rulingId}" has a pending-queue-length expectation with an invalid "queue"; use one of melter/optional-ko-reward/scry-ko/ko-hero/give-hq-hero/smash/reveal-top-dispose.`;
      }
      if (typeof expected.length !== 'number' || !Number.isInteger(expected.length) || expected.length < 0) {
        return `Ruling "${rulingId}" has a pending-queue-length expectation whose "length" is not a non-negative integer.`;
      }
      return null;
    case 'boolean-result':
      if (typeof expected.value !== 'boolean') {
        return `Ruling "${rulingId}" has a boolean-result expectation whose "value" is not a boolean.`;
      }
      return null;
    case 'turn-economy-value':
      if (!isMemberOf<RulingEconomyField>(expected.economyField, RULING_ECONOMY_FIELDS)) {
        return `Ruling "${rulingId}" has a turn-economy-value expectation with an invalid "economyField"; use one of ${RULING_ECONOMY_FIELDS.join('/')}.`;
      }
      if (typeof expected.amount !== 'number' || !Number.isFinite(expected.amount)) {
        return `Ruling "${rulingId}" has a turn-economy-value expectation whose "amount" is not a finite number.`;
      }
      return null;
    case 'counter-value':
      if (!isMemberOf<RulingCounterField>(expected.counter, RULING_COUNTER_FIELDS)) {
        return `Ruling "${rulingId}" has a counter-value expectation with an invalid "counter"; use one of ${RULING_COUNTER_FIELDS.join('/')}.`;
      }
      if (typeof expected.count !== 'number' || !Number.isInteger(expected.count) || expected.count < 0) {
        return `Ruling "${rulingId}" has a counter-value expectation whose "count" is not a non-negative integer.`;
      }
      return null;
    case 'hand-size-override':
      if (!isNonEmptyString(expected.player)) {
        return `Ruling "${rulingId}" has a hand-size-override expectation with no "player"; name the player whose next-hand size is asserted.`;
      }
      if (typeof expected.size !== 'number' || !Number.isInteger(expected.size) || expected.size < 0) {
        return `Ruling "${rulingId}" has a hand-size-override expectation whose "size" is not a non-negative integer.`;
      }
      return null;
    case 'villain-attached-heroes':
      if (!isNonEmptyString(expected.villainCardId)) {
        return `Ruling "${rulingId}" has a villain-attached-heroes expectation with no "villainCardId"; name the villain whose captured-hero list is asserted.`;
      }
      if (!isStringArray(expected.cards)) {
        return `Ruling "${rulingId}" has a villain-attached-heroes expectation whose "cards" is not an array of captured-hero ext_id strings.`;
      }
      return null;
    case 'escaped-pile-equal':
      if (!isStringArray(expected.cards)) {
        return `Ruling "${rulingId}" has an escaped-pile-equal expectation whose "cards" is not an array of card ext_id strings.`;
      }
      return null;
    case 'attached-bystanders-equal':
      if (!isNonEmptyString(expected.villainCardId)) {
        return `Ruling "${rulingId}" has an attached-bystanders-equal expectation with no "villainCardId"; name the card whose attached-bystander list is asserted.`;
      }
      if (!isStringArray(expected.cards)) {
        return `Ruling "${rulingId}" has an attached-bystanders-equal expectation whose "cards" is not an array of bystander ext_id strings.`;
      }
      return null;
    case 'city-equal':
      if (!isStringArray(expected.cards)) {
        return `Ruling "${rulingId}" has a city-equal expectation whose "cards" is not an array of City occupant ext_id strings.`;
      }
      return null;
    case 'turn-economy-flag':
      if (!isMemberOf<RulingEconomyFlag>(expected.economyFlag, RULING_ECONOMY_FLAGS)) {
        return `Ruling "${rulingId}" has a turn-economy-flag expectation with an invalid "economyFlag"; use one of ${RULING_ECONOMY_FLAGS.join('/')}.`;
      }
      if (typeof expected.value !== 'boolean') {
        return `Ruling "${rulingId}" has a turn-economy-flag expectation whose "value" is not a boolean.`;
      }
      return null;
    case 'hq-equal':
      if (!isStringArray(expected.cards)) {
        return `Ruling "${rulingId}" has an hq-equal expectation whose "cards" is not an array of HQ occupant ext_id strings.`;
      }
      return null;
    case 'deferred-hand-injections-equal':
      if (!isNonEmptyString(expected.player)) {
        return `Ruling "${rulingId}" has a deferred-hand-injections-equal expectation with no "player"; name the player whose deferred hand injections are asserted.`;
      }
      if (!isStringArray(expected.cards)) {
        return `Ruling "${rulingId}" has a deferred-hand-injections-equal expectation whose "cards" is not an array of card ext_id strings.`;
      }
      return null;
    default:
      // why: unreachable — the kind was already checked against RULING_EXPECTATION_KINDS
      // before this function runs. Named defensively so a future kind added to the union
      // without a field check here fails loudly rather than validating vacuously.
      return `Ruling "${rulingId}" has an expectation kind with no field validation; add a case to validateExpectationFields.`;
  }
}

/**
 * Runtime type guard for a single ruling. Returns the reason string when the value is
 * not a well-formed ruling, or `null` when it is (so callers can report which entry
 * failed and why).
 *
 * @param value - The candidate ruling (parsed from JSON).
 * @returns A full-sentence reason the value is invalid, or null when it is a Ruling.
 */
export function rulingInvalidReason(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return 'A ruling must be a JSON object.';
  }
  if (!isNonEmptyString(value.id)) {
    return 'A ruling is missing a non-empty "id".';
  }
  const id = value.id;
  if (!isKebabCase(id)) {
    return `Ruling "${id}" has a non-kebab-case id; use lower-case words joined by single hyphens.`;
  }
  if (!isNonEmptyString(value.mechanic)) {
    return `Ruling "${id}" is missing a non-empty "mechanic".`;
  }
  if (value.decision !== undefined && (typeof value.decision !== 'string' || !/^D-\d+$/.test(value.decision))) {
    return `Ruling "${id}" has a "decision" that is not a D-reference like "D-24281".`;
  }
  // why: rulesRef cross-references the player-facing rulebook (docs/legendary-universal-rules-v23.md)
  // and, when present, must anchor to that doc — the `universal-rules-vNN §<section>` convention the
  // engine's `// why:` comments already use — so a citation cannot silently point nowhere.
  if (value.rulesRef !== undefined && (typeof value.rulesRef !== 'string' || !/^universal-rules-v\d+ §.+/.test(value.rulesRef))) {
    return `Ruling "${id}" has a "rulesRef" that is not a rulebook citation like "universal-rules-v23 §Smash".`;
  }
  if (!isNonEmptyString(value.why)) {
    return `Ruling "${id}" is missing a non-empty "why"; a ruling without rationale is a fixture, not a ruling.`;
  }
  if (!isPlainObject(value.scenario)) {
    return `Ruling "${id}" is missing a "scenario" object.`;
  }
  if (!isMemberOf<RulingScenarioAction>(value.scenario.action, RULING_SCENARIO_ACTIONS)) {
    return `Ruling "${id}" has an unknown scenario action; it must be one of ${RULING_SCENARIO_ACTIONS.join(', ')}.`;
  }
  if (!isPlainObject(value.scenario.setup)) {
    return `Ruling "${id}" has a scenario with no "setup" object.`;
  }
  if (!isPlainObject(value.expected)) {
    return `Ruling "${id}" is missing an "expected" object.`;
  }
  if (!isMemberOf<RulingExpectationKind>(value.expected.kind, RULING_EXPECTATION_KINDS)) {
    return `Ruling "${id}" has an unknown expectation kind; it must be one of ${RULING_EXPECTATION_KINDS.join(', ')}.`;
  }
  return validateExpectationFields(value.expected as unknown as RulingExpectation, id);
}

/**
 * Validates a parsed corpus (an array of rulings), throwing a full-sentence Error on
 * the first malformed entry or a duplicate id. Returns the typed `Ruling[]` on success.
 *
 * A malformed corpus MUST fail loudly — a silently-skipped ruling is exactly the drift
 * this corpus exists to prevent.
 *
 * @param value - The JSON-parsed corpus contents.
 * @returns The validated rulings, in file order.
 */
export function validateRulingCorpus(value: unknown): Ruling[] {
  if (!Array.isArray(value)) {
    throw new Error(
      'The effect-rulings corpus must be a JSON array of ruling objects; check docs/ai/rulings/effect-rulings.json.',
    );
  }
  const seenIds = new Set<string>();
  const rulings: Ruling[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    const reason = rulingInvalidReason(entry);
    if (reason !== null) {
      throw new Error(`Invalid effect ruling at index ${index}: ${reason}`);
    }
    const ruling = entry as Ruling;
    if (seenIds.has(ruling.id)) {
      throw new Error(`Duplicate effect-ruling id "${ruling.id}"; every ruling id must be unique.`);
    }
    seenIds.add(ruling.id);
    rulings.push(ruling);
  }
  return rulings;
}
