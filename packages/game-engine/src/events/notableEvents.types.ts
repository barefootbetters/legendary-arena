/**
 * Notable game event type definitions for the Legendary Arena game engine.
 *
 * `NotableGameEvent` is the engine-emitted, JSON-serialisable, append-only
 * record of high-level player-visible outcomes. The discriminated union
 * carries nine locked variants — `fightResolved`, `ambushResolved`,
 * `schemeTwistResolved`, `mastermindStrikeResolved`, `mastermindDefeated`,
 * `healResolved`, `bystanderRevealed`, `deckReshuffled`, `strikeBlocked` —
 * each composed at its fire site via a pure narrative helper from
 * `notableEvents.compose.ts`.
 *
 * Consumed by `UIState.notableEvents` for descriptive "what happened"
 * overlays in the arena client. WP-200 ships the engine half; WP-201
 * (paired follow-on) consumes it.
 *
 * No `boardgame.io` import. No `@legendary-arena/registry` import. Pure
 * types only — no runtime behaviour lives in this module.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { VillainEffectKeyword } from '../rules/villainAbility.types.js';

// ---------------------------------------------------------------------------
// NotableGameEventType
// ---------------------------------------------------------------------------

/**
 * Closed canonical union of notable game event types.
 *
 * Nine variants in fixed canonical order: a Fight resolution, an Ambush
 * resolution at city entry, a Scheme Twist resolution, a Mastermind
 * Strike resolution, a Mastermind defeat, a Wound heal, a Bystander
 * reveal-and-capture, a hero-deck reshuffle, and a blocked/avoided threat.
 * `'mastermindDefeated'` was added per D-20008 (citing D-20001),
 * `'healResolved'` per WP-381 / D-24182, `'bystanderRevealed'` per WP-602 /
 * D-24412, `'deckReshuffled'` per WP-642 / D-24454, and `'strikeBlocked'` per
 * WP-644 / D-24456 so the arena-client overlay can report those outcomes
 * — G.messages is not projected to clients. Adding a tenth variant requires
 * a new `DECISIONS.md` entry (e.g., WP-186's eventual `'escapeResolved'` per
 * D-20001).
 */
export type NotableGameEventType =
  | 'fightResolved'
  | 'ambushResolved'
  | 'schemeTwistResolved'
  | 'mastermindStrikeResolved'
  | 'mastermindDefeated'
  | 'healResolved'
  | 'bystanderRevealed'
  | 'deckReshuffled'
  | 'strikeBlocked';

// why: drift-detection array — must match `NotableGameEventType` exactly
// (the `notableEvents.types.test.ts` drift test asserts bidirectional
// parity + length + uniqueness). The nine-entry canonical order is locked:
// `fightResolved` (Fight fire site), `ambushResolved` (Ambush fire site),
// `schemeTwistResolved` (Scheme Twist resolver terminal),
// `mastermindStrikeResolved` (Mastermind Strike handler terminal),
// `mastermindDefeated` (fightMastermind vanquish fire site, D-20008),
// `healResolved` (healWounds fire site, WP-381 / D-24182),
// `bystanderRevealed` (villainDeck.reveal bystander-capture fire site,
// WP-602 / D-24412), `deckReshuffled` (the onBegin auto-draw + its
// applyOnBeginParity mirror, on empty-deck reshuffle, WP-642 / D-24454),
// and `strikeBlocked` (the Magneto reveal-X-Men strike skip + the
// reveal-or-punish twist dodge, per blocking player, WP-644 / D-24456).
// Adding `'escapeResolved'` for WP-186's onEscape fire site requires a
// new DECISIONS entry per D-20001.
/**
 * All notable game event types in canonical order. Single source of truth.
 */
export const NOTABLE_EVENT_TYPES: readonly NotableGameEventType[] = [
  'fightResolved',
  'ambushResolved',
  'schemeTwistResolved',
  'mastermindStrikeResolved',
  'mastermindDefeated',
  'healResolved',
  'bystanderRevealed',
  'deckReshuffled',
  'strikeBlocked',
] as const;

// ---------------------------------------------------------------------------
// SchemeTwistResolverKey
// ---------------------------------------------------------------------------

/**
 * Closed canonical union of camelCase scheme-twist resolver keys.
 *
 * The seven resolver framework entries (WP-182 shipped five; WP-513 added
 * `killbots`; WP-514 added `secretInvasion`). Each key maps to a resolver
 * function in `schemeTwistResolvers.ts`. The resolver registry keys are
 * hyphen-case identifiers (`'reveal-or-punish'`, etc.) — this union is the
 * camelCase form embedded in `SchemeTwistResolvedEvent.resolverKey` so UI
 * consumers receive a JavaScript-idiomatic key.
 */
export type SchemeTwistResolverKey =
  | 'revealOrPunish'
  | 'chainedReveals'
  | 'woundAll'
  | 'koFromHq'
  | 'midtownBankRobbery'
  | 'killbots'
  | 'secretInvasion'
  | 'portals';

// why: drift-detection array — must match `SchemeTwistResolverKey` exactly.
// The seven-entry canonical order tracks the resolver framework byte-for-byte.
// Adding a resolver key tracks with the resolver framework, not WP-200 — the
// framework owns its own vocabulary.
/**
 * All scheme-twist resolver keys in canonical order. Single source of truth.
 */
export const SCHEME_TWIST_RESOLVER_KEYS: readonly SchemeTwistResolverKey[] = [
  'revealOrPunish',
  'chainedReveals',
  'woundAll',
  'koFromHq',
  'midtownBankRobbery',
  'killbots',
  'secretInvasion',
  'portals',
] as const;

// ---------------------------------------------------------------------------
// StrikeBlockThreatKind
// ---------------------------------------------------------------------------

/**
 * Closed canonical union of the threat classes a `strikeBlocked` event can
 * report (WP-644 / D-24456).
 *
 * The three reveal-to-avoid threat classes the shield-block effect targets,
 * each with a real producer:
 *   - `masterStrike` — a Master Strike avoided by revealing a Hero: the Magneto
 *     reveal-an-X-Men-Hero skip (WP-644) and the Dr. Doom reveal-a-Tech-Hero skip
 *     (WP-645), both in `mastermindHandlers.ts`.
 *   - `schemeTwist` — a Scheme Twist penalty avoided by the reveal-or-punish
 *     matched-Hero dodge in `schemeTwistResolvers.ts` (WP-644).
 *   - `ambush` — a villain Ambush avoided by the `reveal-or-wound` matched-Hero
 *     reveal on the `onAmbush` timing, in `villainEffectRevealOrWound`
 *     (`villain/villainEffects.execute.ts`, WP-646 / D-24458).
 * The same `reveal-or-wound` handler also fires at the `onFight` / `onEscape`
 * timings; those reveal-avoidances are a different threat class and are NOT yet
 * producers — each would add its own value (`'fight'` / `'escape'`) with its emit
 * site in a future WP. A value with no emit site is drift, so none is added
 * speculatively.
 */
export type StrikeBlockThreatKind = 'masterStrike' | 'schemeTwist' | 'ambush';

// why: drift-detection array — must match `StrikeBlockThreatKind` exactly
// (the `notableEvents.types.test.ts` runtime drift assertion checks keyset +
// length + uniqueness, per WP-563 / D-24372 — a runtime check, never a bare
// `satisfies`). Mirrors the `SchemeTwistResolverKey` / `SCHEME_TWIST_RESOLVER_KEYS`
// pair. Three entries: `masterStrike` (Magneto + Dr. Doom reveal-Hero strike
// skips), `schemeTwist` (reveal-or-punish twist dodge), `ambush` (reveal-or-wound
// onAmbush reveal, WP-646).
/**
 * All strike-block threat kinds in canonical order. Single source of truth.
 */
export const STRIKE_BLOCK_THREAT_KINDS: readonly StrikeBlockThreatKind[] = [
  'masterStrike',
  'schemeTwist',
  'ambush',
] as const;

// ---------------------------------------------------------------------------
// Event payload interfaces
// ---------------------------------------------------------------------------

/**
 * Emitted by `moves/fightVillain.ts` when a player defeats a villain or
 * henchman in the City. Payload observes post-mutation state: the card is
 * already in the player's victory pile, bystanders have been awarded, and
 * `appliedEffects` lists the Fight: effects that actually mutated G
 * (dispatch order from the executor).
 */
export interface FightResolvedEvent {
  /** Discriminator. */
  type: 'fightResolved';
  /** boardgame.io player-index string ("0", "1", ...) of the defeating player. */
  playerId: string;
  /** Zone-instance ext_id of the defeated villain or henchman. */
  cardId: CardExtId;
  /** City space the defeated card occupied (0..4). */
  citySpace: number;
  /** Count of bystanders rescued into the player's victory pile by this fight. */
  bystandersRescued: number;
  /** Fight: effect keywords that the executor actually applied, in dispatch order. */
  appliedEffects: VillainEffectKeyword[];
  /** Engine-composed single-sentence English narrative. */
  narrative: string;
}

/**
 * Emitted by `villainDeck/villainDeck.reveal.ts` when a villain with at
 * least one Ambush: marker enters the City. Fires AFTER
 * `executeVillainAbilities(...,'onAmbush')` and BEFORE the unrelated
 * unconditional city-entry bystander attach. The unconditional attach is
 * NOT an Ambush effect — it is the MVP city-entry rule and is excluded
 * from `appliedEffects` and from the narrative.
 */
export interface AmbushResolvedEvent {
  /** Discriminator. */
  type: 'ambushResolved';
  /** Zone-instance ext_id of the villain that entered the City. */
  revealedCardId: CardExtId;
  /** City space the villain entered (0..4). */
  citySpace: number;
  /** Ambush: effect keywords the executor applied, in dispatch order. */
  appliedEffects: VillainEffectKeyword[];
  /** Engine-composed single-sentence English narrative. */
  narrative: string;
}

/**
 * Emitted by each resolver in `rules/schemeTwistResolvers.ts` after the
 * resolver finishes mutating G. `resolverKey` identifies which of the seven
 * resolver implementations ran (camelCase per `SchemeTwistResolverKey`).
 */
export interface SchemeTwistResolvedEvent {
  /** Discriminator. */
  type: 'schemeTwistResolved';
  /** Zone-instance ext_id of the scheme-twist card that triggered. */
  twistCardId: CardExtId;
  /** Which of the locked resolvers handled the twist. */
  resolverKey: SchemeTwistResolverKey;
  /** Engine-composed single-sentence English narrative. */
  narrative: string;
}

/**
 * Emitted by `rules/mastermindHandlers.ts:mastermindStrikeHandler` after
 * the strike's state mutations (bystander-onto-mastermind capture +
 * per-mastermind text effects). `strikeCardId` is the trigger payload's
 * ext_id (the generic `master-strike-NN` token in MVP).
 */
export interface MastermindStrikeResolvedEvent {
  /** Discriminator. */
  type: 'mastermindStrikeResolved';
  /** Zone-instance ext_id of the strike card that triggered. */
  strikeCardId: CardExtId;
  /** Engine-composed single-sentence English narrative. */
  narrative: string;
}

/**
 * Emitted by `moves/fightMastermind.ts` when a player defeats the final
 * tactic and vanquishes the Mastermind. Payload observes post-mutation
 * state. `bystandersRescued` is the count rescued on THIS vanquishing
 * fight (>= 0) — bystanders captured earlier were already rescued on the
 * fights that defeated the earlier tactics, since every tactic defeat
 * rescues the Mastermind's currently-held bystanders (Universal Rules
 * v23 §"When you fight a Mastermind/Commander"). It is therefore often 0
 * if no Master Strike re-captured a bystander after the previous fight.
 * Added per D-20008 so the arena-client overlay can surface the win +
 * any final-blow rescue — `G.messages` is not projected to clients.
 */
export interface MastermindDefeatedEvent {
  /** Discriminator. */
  type: 'mastermindDefeated';
  /** boardgame.io player-index string ("0", "1", ...) of the defeating player. */
  playerId: string;
  /** Config ext_id of the defeated mastermind (`G.mastermind.id`). */
  mastermindId: CardExtId;
  /** Bystanders rescued into the player's victory pile on the vanquishing fight (>= 0). */
  bystandersRescued: number;
  /** Engine-composed single-sentence English narrative. */
  narrative: string;
}

/**
 * Emitted by the `healWounds` move (WP-381 / D-24182) when a player uses the
 * Wound "Healing" ability. Surfaces the same center-screen overlay treatment
 * every other notable turn action gets — `G.messages` is not projected to
 * clients. Minimal payload per D-20001 (no `eventId` / `seq` / `timestamp`).
 */
export interface HealResolvedEvent {
  /** Discriminator. */
  type: 'healResolved';
  /** boardgame.io player-index string ("0", "1", ...) of the healing player. */
  playerId: string;
  /** Number of Wounds KO'd from hand this heal (>= 1). */
  woundsHealed: number;
  /** Engine-composed single-sentence English narrative. */
  narrative: string;
}

/**
 * Emitted by `villainDeck/villainDeck.reveal.ts` when a Bystander card is
 * revealed from the villain deck and captured (WP-602 / D-24412). Fires as the
 * final step of the `cardType === 'bystander'` capture branch, after the
 * "revealed and captured by" `G.messages` line and after the attach settles —
 * additive to that log line, not a replacement. The captor is the frontmost
 * City villain, or the Mastermind (`G.mastermind.baseCardId`) when the City is
 * empty. Presentation parity with `schemeTwistResolved` / `mastermindStrikeResolved`
 * so the overlay announces a revealed Bystander; not a new mechanic or reward.
 */
export interface BystanderRevealedEvent {
  /** Discriminator. */
  type: 'bystanderRevealed';
  /** Zone-instance ext_id of the Bystander card revealed from the villain deck. */
  revealedCardId: CardExtId;
  /** Ext_id of the captor — the frontmost City villain, or the Mastermind when the City is empty. */
  captorCardId: CardExtId;
  /** Engine-composed single-sentence English narrative. */
  narrative: string;
}

/**
 * Emitted by the play-phase `onBegin` auto-draw (`game.ts`) and its
 * observation-harness mirror (`applyOnBeginParity`) when a start-of-turn draw
 * exhausts the drawing player's deck and reshuffles the discard back into it
 * (WP-642 / D-24454). The empty-deck reshuffle itself is the standard rule
 * (WP-236 / D-24051, inside `drawCardsIntoHand`); this event only *announces*
 * it — the mechanic was previously silent (no log line, no notable event, no
 * VFX). Minimal payload per D-20001 (no `eventId` / `seq` / `timestamp`) and
 * carries NO card id (like `HealResolvedEvent`) — a reshuffle is not tied to a
 * card. Emitted only when a reshuffle actually occurred (`drawCardsIntoHand`
 * returned a count `> 0`). Presentation parity only, not a new mechanic.
 */
export interface DeckReshuffledEvent {
  /** Discriminator. */
  type: 'deckReshuffled';
  /** boardgame.io player-index string ("0", "1", ...) of the drawing player whose deck reshuffled. */
  playerId: string;
  /** Engine-composed single-sentence English narrative. */
  narrative: string;
}

/**
 * Emitted when a player AVOIDS an incoming threat's harmful effect by
 * revealing a Hero (WP-644 / D-24456) — the two sites the engine already
 * models but emitted silently until now:
 *   - `mastermindHandlers.ts` `resolveMagnetoStrike` reveal branch: a player
 *     holding an X-Men Hero reveals it and is skipped (`threatKind:
 *     'masterStrike'`);
 *   - `schemeTwistResolvers.ts` `revealOrPunish` `matchFound` branch: a player
 *     revealing a matching Hero dodges the penalty (`threatKind: 'schemeTwist'`).
 * Emitted ONE PER BLOCKING PLAYER (both branches iterate players); the
 * reveal-or-punish emit is ADDITIVE to the resolver's terminal
 * `schemeTwistResolved`. Minimal payload per D-20001 (no `eventId` / `seq` /
 * `timestamp` / card id — like `healResolved` / `deckReshuffled`). Public and
 * rendered verbatim by the client (D-20002); presentation parity only, not a
 * new mechanic or reward — the avoidance already happens, this announces it.
 */
export interface StrikeBlockedEvent {
  /** Discriminator. */
  type: 'strikeBlocked';
  /** boardgame.io player-index string ("0", "1", ...) of the player who blocked the threat. */
  playerId: string;
  /** Which threat class was avoided — drives the client's per-threat presentation. */
  threatKind: StrikeBlockThreatKind;
  /** Engine-composed single-sentence English narrative. */
  narrative: string;
}

/**
 * Closed discriminated union of every notable game event variant.
 *
 * Append-only on `G.notableEvents` at runtime. JSON-serialisable. Event
 * identity is implicit by index position in the array — no `eventId`,
 * `seq`, or `timestamp` field exists per D-20001 minimal-payload contract.
 */
export type NotableGameEvent =
  | FightResolvedEvent
  | AmbushResolvedEvent
  | SchemeTwistResolvedEvent
  | MastermindStrikeResolvedEvent
  | MastermindDefeatedEvent
  | HealResolvedEvent
  | BystanderRevealedEvent
  | DeckReshuffledEvent
  | StrikeBlockedEvent;
