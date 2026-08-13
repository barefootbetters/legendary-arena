/**
 * UI state type definitions for the Legendary Arena game engine.
 *
 * UIState is the authoritative UI state contract. It is the only state
 * the UI consumes. The UI never reads G directly — it receives UIState,
 * a projection built from G and ctx by buildUIState.
 *
 * All types are JSON-serializable. No engine internals are exposed.
 *
 * Implements D-0301 (UI Consumes Projections Only).
 *
 * WP-128 / EC-131 — extends UIState with the projection contract for the
 * board-layout wireframe (`docs/ai/DESIGN-BOARD-LAYOUT.md §4`). New
 * top-level fields: `decks`, `piles`, `koPile`. New per-player optional
 * fields: `inPlayCards?`, `inPlayDisplay?`, `discardTopCard?`,
 * `victoryCards?`, `victoryVP?`. New required fields on existing types:
 * `mastermind.attachedBystanders`, `mastermind.strikePile`,
 * `scheme.twistPile`, `city.escapedPile`, `economy.piercing`,
 * `economy.woundsDrawn`. Eight projections lack a `G` source today and
 * ship as Option A safe-skips per D-12806 — see `uiState.build.ts`.
 */

import type { FinalScoreSummary } from "../scoring/scoring.types.js";
import type { NotableGameEvent } from "../events/notableEvents.types.js";
import type { LogEntry } from "../log/logOutcome.types.js";
// why: WP-258 — reuse the engine's canonical HollowEffectRecord rather than
// declaring a parallel UI type. The projection surfaces the WP-257 runtime
// channel (G.diagnostics.hollowEffects) to the client unchanged.
import type { HollowEffectRecord } from "../diagnostics/hollowEffect.types.js";

// why: UIState is the only data the UI sees. All items in the canonical
// forbidden internals list (hookRegistry, ImplementationMap, cardStats,
// heroAbilityHooks, villainDeckCardTypes, schemeSetupInstructions, registry
// objects, setup builders) are hidden to prevent logic leakage and maintain
// the Layer Boundary. Implements D-0301 (UI Consumes Projections Only).

/**
 * The authoritative UI state contract.
 *
 * Derived from G and ctx by buildUIState. The UI never reads G directly.
 * JSON-serializable. Contains no engine internals.
 *
 * // why: WP-128 / EC-131 — `decks`, `piles`, `koPile` added as required
 * top-level fields so the board-layout wireframe binds to a stable shape.
 * Each is always-present (deterministic safe-skip when the underlying G
 * source is absent — see D-12806).
 */
export interface UIState {
  game: {
    phase: string;
    turn: number;
    activePlayerId: string;
    currentStage: string;
    // why: WP-380 / D-24181 — mirrors the WP-379 per-turn G flags so the client
    // can gate the Heal-Wounds affordance (a player may heal only if they have
    // not acted; not again after healing). Public (like currentStage): whether the
    // active player has acted/healed this turn is observable, not secret — no
    // per-player redaction. Always-present boolean projections (undefined G flag
    // projects as false).
    hasActedThisTurn: boolean;
    hasHealedThisTurn: boolean;
    // why: WP-409 / D-24221 — the per-turn count of hero effects that fired for the
    // most recent play, projected publicly (like currentStage: a played card is
    // face-up, the count is not secret; no per-player redaction). Always-present
    // (an undefined G field projects as 0). Feeds the future client tiered combo cue.
    lastPlayEffectsFired: number;
  };
  players: UIPlayerState[];
  city: UICityState;
  hq: UIHQState;
  mastermind: UIMastermindState;
  scheme: UISchemeState;
  economy: UITurnEconomyState;
  // why: WP-434 — the projected log carries LogEntry records ({ text, outcome }),
  // read-only from G.messages, so the client renders each line's colour from its
  // engine-authored outcome instead of re-parsing prose.
  log: LogEntry[];
  // why: WP-200 — typed event projection mirroring `log: string[]`. UI
  // consumers (WP-201) render descriptive "what happened" overlays from
  // these structured events without parsing free-text log strings. Cloned
  // by `uiState.build.ts` (spread copy) and by `uiState.filter.ts` so
  // UIState never aliases G's array.
  notableEvents: NotableGameEvent[];
  // why: WP-214 — top-level projection of G.villainAttachedHeroes for
  // the arena-client to render captured heroes beneath villain city tiles.
  // Spread copy prevents aliasing with G state.
  villainAttachedHeroes: Record<string, string[]>;
  progress: UIProgressCounters;
  decks: UIDecksState;
  piles: UISharedPilesState;
  koPile: UIKoPileState;
  // why: WP-410 / D-24222 — the deduped set of every non-empty card-face image
  // URL this match can show (from G.cardDisplayData). The arena client warms these
  // into the browser image cache at match start so a card paints from cache on
  // reveal instead of round-tripping to R2 mid-turn. OPTIONAL in the type only so
  // pre-existing hand-written UIState fixtures need no backfill (the WP-179
  // pattern); `uiState.build.ts` ALWAYS populates it (`[]` for an empty match), and
  // `uiState.filter.ts` passes it through public (the design set is public from the
  // composition — information-safe; no face-down order). Projection-only: never a G
  // field, so no state-hash surface.
  matchCardImageUrls?: string[];
  gameOver?: UIGameOverState;
  // why: WP-367 / D-24159 — present ONLY while the deck-exhaustion final-turn
  // latch is active (a shared deck has reached zero cards) and the game has not
  // yet ended. Drives the client's "final turn" warning banner / countdown.
  // Absent (undefined) means the game is not in its final turn; the client must
  // not render the warning in that case. Omit-when-absent mirrors gameOver and
  // pendingHeroChoice so existing fixtures are unaffected.
  finalTurn?: UIFinalTurnState;
  // why: D-22201 + WP-222 — projects G.pendingHeroChoice so the client can
  // render the "Discard / Put it back" prompt. Absent (undefined) means no
  // pending choice; the client must not render the prompt in that case.
  pendingHeroChoice?: UIPendingHeroChoice;
  // why: D-24010 + WP-243 — projects the FRONT of G.pendingKoHeroChoices with
  // the freshly-computed eligible targets so the choosing player can render the
  // "Choose a Hero to KO" prompt. Redacted (omitted) for every audience except
  // the chooser — the eligible list carries the chooser's hand identities
  // (D-24011 hand-leak). Absent (undefined) means no pending KO choice.
  pendingKoHeroChoice?: UIPendingKoHeroChoice;
  // why: WP-470 / D-24282 — projects the FRONT of G.pendingScryKoChoices with the
  // two revealed deck-top cards so the choosing player can render the "Look at the
  // top two — choose one to KO" prompt. Redacted (omitted) for every audience
  // except the chooser — the revealed cards are the top of the chooser's own deck
  // (private information; opponents must not learn the chooser's next draws). Absent
  // (undefined) means no pending scry-KO choice.
  pendingScryKoChoice?: UIPendingScryKoChoice;
  // why: WP-476 / D-24284 — projects the FRONT of G.pendingDiscardChoices with the
  // choosing player's current hand (the cards they may discard) and the limit, so
  // the current player can render the "Choose which cards to discard down to four"
  // prompt. Redacted (omitted) for every audience except the chooser — the hand
  // carries the chooser's private card identities (D-24011). Absent (undefined)
  // means no pending discard choice.
  pendingDiscardChoice?: UIPendingDiscardChoice;
  // why: WP-538 / D-24347 — projects the FRONT of G.pendingPutCardsOnDeckChoices with
  // the chooser's current hand (the cards they may put on top) and the count, so the
  // current player can render the "Choose 2 cards to put on top of your deck" prompt.
  // Redacted (omitted) for every audience except the chooser — the hand carries the
  // chooser's private card identities (D-24011). Absent (undefined) means no pending
  // put-cards-on-deck choice.
  pendingPutCardsOnDeckChoice?: UIPendingPutCardsOnDeckChoice;
  // why: WP-479 / D-24286 — projects the FRONT of G.pendingReorderChoices with the
  // revealed remainder (the top-N of the chooser's deck the reveal left in place) so
  // the current player can render the "Put the rest back in any order" prompt.
  // Redacted (omitted) for every audience except the chooser — the remainder is the
  // chooser's next draws (D-24011). Absent (undefined) means no pending reorder choice.
  pendingReorderChoice?: UIPendingReorderChoice;
  // why: WP-486 / D-24291 — projects the FRONT of G.pendingDefeatChoices with the
  // eligible-target set (City Villains holding a Bystander + the Mastermind) so the
  // current player can render the "Choose which to defeat" prompt for Silent Sniper.
  // Redacted (omitted) for every audience except the chooser — it is the chooser's
  // pending decision (D-24011). Absent (undefined) means no pending defeat choice.
  pendingDefeatChoice?: UIPendingDefeatChoice;
  // why: D-24020 + WP-249 — projects the FRONT of G.pendingOptionalKoRewards
  // with the derived reward label + the chooser's eligible hand/discard cards so
  // the choosing player can render the "KO a card for a reward, or Decline"
  // prompt. Redacted (omitted) for every audience except the chooser — the
  // eligible lists carry the chooser's private hand/discard identities (D-24011
  // hand-privacy analog). Absent (undefined) means no pending optional-KO-reward
  // choice.
  pendingOptionalKoReward?: UIPendingOptionalKoReward;
  // why: D-24071 + WP-287 — projects the FRONT of G.pendingDrawOrEmpowered with the
  // derived empoweredLabel so the choosing player can render the "Choose one: Draw a
  // card / Empowered by {class}" prompt. Redacted (omitted) for every audience except
  // the chooser (the D-24011 hand-privacy analog — keyed on .playerID). Absent
  // (undefined) means no pending draw-or-empowered choice; the client must not render
  // the prompt in that case.
  pendingDrawOrEmpowered?: UIPendingDrawOrEmpowered;
  // why: WP-313 / D-24099 — projects the FRONT entry of G.pendingVictoryPileCardPick
  // with the eligible victory-pile villains (each carrying its printed-attack value =
  // the villain's fightCost) so the chooser can render the "Choose a Villain from your
  // Victory Pile" prompt. Redacted (omitted) for every audience except the chooser
  // (keyed on .playerID), mirroring pendingDrawOrEmpowered. Absent (undefined) means no
  // pending victory-pile pick; the client must not render the prompt in that case.
  pendingVictoryPileCardPick?: UIPendingVictoryPileCardPick;
  // why: projects the FRONT entry of G.pendingOptionalPutBottomHQ with the eligible
  // HQ cards (each carrying its instance cardId + display) so the chooser can render
  // the "put a card from the HQ on the bottom of the Hero Deck" prompt (optional —
  // Decline is a first-class exit). Redacted (omitted) for every audience except the
  // chooser (keyed on .playerID), mirroring pendingVictoryPileCardPick. Absent
  // (undefined) means no pending choice; the client must not render the prompt then.
  pendingOptionalPutBottomHQ?: UIPendingOptionalPutBottomHQ;
  // why: D-24132 — projects the FRONT entry of G.pendingPutAnyNumberBottomHQ with the eligible
  // HQ cards (each carrying its instance cardId + display) so the chooser can render the multi-
  // select "Choose any number of cards/Heroes from the HQ" prompt. Redacted (omitted) for every
  // audience except the chooser (keyed on .playerID), mirroring pendingOptionalPutBottomHQ.
  // Absent (undefined) means no pending choice; the client must not render the prompt then.
  pendingPutAnyNumberBottomHQ?: UIPendingPutAnyNumberBottomHQ;
  // why: D-24139 — projects the FRONT entry of G.pendingReturnZeroCostDiscard with the
  // eligible 0-cost discard cards (each carrying its instance cardId + display) so the
  // chooser can render the mandatory "Return a 0-cost card from your discard pile to
  // your hand" prompt. Redacted (omitted) for every audience except the chooser (keyed
  // on .playerID), mirroring pendingOptionalPutBottomHQ. Absent (undefined) means no
  // pending choice; the client must not render the prompt then.
  pendingReturnZeroCostDiscard?: UIPendingReturnZeroCostDiscard;
  // why: WP-383 / D-24184 — projects the FRONT entry of G.pendingDiscardToPlay with the
  // eligible hand cards (each carrying its instance cardId + display) so the chooser can
  // render the mandatory "discard a card to play this card" prompt. Redacted (omitted)
  // for every audience except the chooser (keyed on .playerID). Absent (undefined) means
  // no pending choice; the client must not render the prompt then.
  pendingDiscardToPlay?: UIPendingDiscardToPlay;
  // why: WP-498 / D-24301 — projects the FRONT entry of G.pendingReturnOnDiscard with the
  // single returnable card (its instance cardId + display) so the chooser can render the
  // OPTIONAL "you may return this card to your hand" prompt (Return + Decline). Redacted
  // (omitted) for every audience except the chooser (keyed on .playerID). Absent
  // (undefined) means no pending choice; the client must not render the prompt then.
  pendingReturnOnDiscard?: UIPendingReturnOnDiscard;
  // why: WP-532 / D-24343 — the current (fighting) player's interactive give-HQ-Hero
  // pick (Paibok Fight). OPTIONAL: absent omits the field (existing UIState fixtures need
  // no backfill), chooser-only (filterUIStateForAudience keys on .playerID).
  pendingGiveHqHeroChoice?: UIPendingGiveHqHeroChoice;
  // why: WP-535 / D-24345 — the current player's interactive Copy Powers copy-a-Hero
  // pick (Rogue). OPTIONAL: absent omits the field (existing UIState fixtures need no
  // backfill), chooser-only (filterUIStateForAudience keys on .playerID).
  pendingCopyPowersChoice?: UIPendingCopyPowersChoice;
  // why: WP-258 — projects the WP-257 runtime hollow-effect channel
  // (G.diagnostics.hollowEffects) so the client can render a structured debug
  // panel + carry the records on the Download-diagnostics export. OPTIONAL on
  // purpose: an absent channel omits the field entirely, so existing client
  // UIState fixtures need no backfill (the WP-166/207/227 required-field
  // recurrence). The records are PUBLIC (card/mechanic identities, never hidden
  // state) and pass through the audience filter value-unchanged for every
  // audience (D-12803 public-projection posture — like `log`/`piles`).
  hollowEffects?: HollowEffectRecord[];
}

/**
 * Display-safe card data projected once at setup time and surfaced through
 * UIState. Read-only. JSON-serializable. Contains only primitive fields.
 *
 * Field set is locked at exactly six entries — adding `setName`,
 * `cardType`, `attack`, `recruit`, or `keywords` here is scope creep
 * and requires a separate WP. The drift-detection test in
 * uiState.types.drift.test.ts pins the field set.
 *
 * // why: gives the UI enough to render a real card (name + image + cost)
 * without granting the client a runtime registry import. Mirrors the
 * G.cardStats / G.villainDeckCardTypes setup-snapshot pattern (sibling
 * to WP-018, WP-014B). Sourced once at Game.setup() from the registry
 * and never mutated thereafter.
 */
export interface UICardDisplay {
  extId: string;
  name: string;
  imageUrl: string;
  cost: number | null;
  heroClass?: string | null;
  team?: string | null;
  /**
   * The card's printed ability lines joined by a single newline, with marker
   * annotations (`[keyword:…]`, `[hc:…]`) preserved verbatim. Optional — populated
   * only for hero card instances at setup (WP-315 / D-24101), from the registry's
   * `card.abilities`; absent when the card has no abilities (never an empty string).
   * Consumed by the diagnostic export (WP-314 Option B) to show printed-text-vs-outcome.
   */
  abilityText?: string;
}

/**
 * Display-bearing entry for an occupied HQ slot.
 *
 * Two-field shape locked: extId (the canonical join key, repeated for UI
 * convenience and drift-detection sanity) plus the display payload.
 */
export interface UIHQCard {
  extId: string;
  display: UICardDisplay;
}

/**
 * Generic display-bearing entry: the (extId, display) pair used by every
 * face-up pile / array projection in WP-128.
 *
 * // why: WP-128 / D-12805 — defined once and reused by `victoryCards`,
 * `strikePile`, `twistPile`, `escapedPile`, `koPile.cards`, `koPile.topCard`,
 * `discardTopCard`, and `attachedBystanders`. Repeating the inline literal
 * `{ extId: string; display: UICardDisplay }` at every consumer site is
 * a DRY violation; the shared alias keeps the projection contract uniform.
 */
export interface UIDisplayEntry {
  extId: string;
  display: UICardDisplay;
}

/**
 * Per-player state projection. Zones projected as counts — not card arrays.
 *
 * // why: zone counts prevent the UI from accessing card identities it
 * shouldn't see (other players' hands, decks). Card display resolution
 * is a separate UI concern using the registry.
 */
export interface UIPlayerState {
  playerId: string;
  deckCount: number;
  handCount: number;
  discardCount: number;
  inPlayCount: number;
  victoryCount: number;
  woundCount: number;
  /**
   * Hand card ext_ids. Present for the viewing player's own hand;
   * undefined (redacted) for other players and spectators.
   *
   * // why: active player needs to see their own hand cards for gameplay.
   * Other players and spectators see handCount only to prevent information
   * leakage. buildUIState always populates this; filterUIStateForAudience
   * redacts it based on audience.
   */
  handCards?: string[];
  /**
   * Per-hand-card display data, parallel-aligned with handCards by index.
   * Length matches handCards exactly when both are present. Redacted
   * (omitted) alongside handCards by filterUIStateForAudience.
   *
   * // why: parallel-array form preserves backwards compatibility on the
   * existing `handCards: string[]` shape — consumers that read handCards
   * continue to work; new consumers opt into handDisplay for display
   * fields. Mirrors the WP-029 D-2902 exactOptionalPropertyTypes
   * conditional-assignment pattern: the projection and filter never
   * write `handDisplay: undefined` literally.
   */
  handDisplay?: UICardDisplay[];
  /**
   * In-play card ext_ids for this player's currently-played cards.
   *
   * // why: WP-128 / D-12803 — redacted by `filterUIStateForAudience` for
   * `audience !== ownPlayerId` and for `'spectator'`. Mirrors the
   * `handCards` privacy posture: in-play cards are technically face-up
   * at the physical table, but the wireframe shows count-only in
   * opponent panels. Length matches `inPlayCount` exactly when present.
   */
  inPlayCards?: string[];
  /**
   * Per-in-play-card display data, parallel-aligned with `inPlayCards`.
   *
   * // why: WP-128 / D-12803 — privacy-symmetric with `inPlayCards`;
   * leaking display data is identical to leaking the CardExtId.
   * Redacted (omitted) alongside `inPlayCards` by the audience filter.
   */
  inPlayDisplay?: UICardDisplay[];
  /**
   * Top of this player's discard pile, or `null` when the discard is empty.
   *
   * // why: WP-128 / D-12803 — optional AND nullable encodes two distinct
   * states: optional (`undefined`) means "redacted by audience filter";
   * `null` means "visible but empty (`discardCount === 0`)". Without this
   * distinction the `?: T | null` shape reads ambiguous. Discard top is
   * face-up at the physical table — public to all audiences.
   */
  discardTopCard?: UIDisplayEntry | null;
  /**
   * Full discard-pile card ext_ids for this player.
   *
   * // why: WP-243 / D-24010 — present for the viewing player's own discard
   * (so the KO-a-Hero prompt and the "View all" discard view can render the
   * full contents); undefined (redacted) for other players and spectators,
   * the exact `handCards` privacy posture. Length matches `discardDisplay`
   * exactly when both are present. buildUIState always populates this for the
   * own player; filterUIStateForAudience redacts it (together with
   * `discardDisplay`) based on audience.
   */
  discardCards?: string[];
  /**
   * Per-discard-card display data, parallel-aligned with `discardCards` by
   * index.
   *
   * // why: WP-243 / D-24010 — privacy-symmetric with `discardCards`; leaking
   * display data is identical to leaking the CardExtId. Assigned in the SAME
   * conditional block as `discardCards` (both or neither, length-matched) and
   * redacted alongside it by the audience filter. Mirrors the WP-029 D-2902
   * exactOptionalPropertyTypes conditional-assignment pattern: never written
   * as a literal `undefined`.
   */
  discardDisplay?: UICardDisplay[];
  /**
   * Full victory-pile contents for this player.
   *
   * // why: WP-128 / D-12803 — VP cards are public knowledge by design
   * (VP is built from face-up resolved cards). NOT redacted by the
   * audience filter. Length matches `victoryCount` exactly when present.
   * Per-entry shallow copy via `resolveDisplay` per WP-111 D-11105
   * aliasing-defense.
   */
  victoryCards?: UIDisplayEntry[];
  /**
   * Total VP this player has accumulated, derived from
   * `computeFinalScores(G).players[i].totalVP`.
   *
   * // why: WP-128 / D-12801 — projected by the engine, not computed by
   * the UI. Field name uses uppercase `VP` to match the canonical
   * `PlayerScoreBreakdown.totalVP` engine convention (`00.6` Rule 14).
   * The `?` flags audience-redaction parity with `victoryCards?` (both
   * go together).
   */
  victoryVP?: number;
}

/**
 * Display-safe card info for a card in the City.
 *
 * // why: contains only display-safe data — ext_id for registry lookup,
 * type for visual classification, keywords for gameplay indicators, and
 * the setup-snapshotted display payload. No engine internals.
 */
export interface UICityCard {
  extId: string;
  type: string;
  keywords: string[];
  display: UICardDisplay;
  /** Hero ext_ids captured under this villain (WP-214). Empty array when none. */
  attachedHeroes: string[];
  /**
   * Display payloads for the heroes captured face-up under this villain
   * (WP-505), index-aligned with `attachedHeroes` (same length, same order).
   * Captured heroes are face up — their identity is public — so the client
   * renders them as card art. This parallel-display field exists because the
   * client has no ext_id→image resolver (mirrors the HQ slots/slotDisplay
   * pattern); `attachedHeroes` alone cannot render art.
   */
  attachedHeroDisplay: UICardDisplay[];
  /**
   * Count of bystanders captured face-down under this villain (WP-505 / D-24311).
   * Count only — captured bystanders are face down, so which bystander it is
   * stays hidden; the client renders an "N captured" badge. Never the ext_ids
   * or display (that would leak a face-down identity).
   */
  attachedBystanderCount: number;
  /** Engine-resolved fight cost for this villain (WP-214). Static or dynamic. */
  fightCost: number;
}

/**
 * City zone projection with display-safe card info.
 *
 * // why: WP-128 / D-12806 — `escapedPile` ships as `[]` until a future
 * WP adds `G.city.escapedPile` for escaped-villain card preservation
 * (today only the counter `G.counters[ESCAPED_VILLAINS]` increments).
 * The composition counter is unaffected by this projection.
 */
export interface UICityState {
  spaces: (UICityCard | null)[];
  escapedPile: UIDisplayEntry[];
}

/**
 * HQ zone projection with ext_ids for display lookup.
 *
 * // why: `slots` shape preserved verbatim per pre-flight 2026-04-29 PS-6
 * (Q3 written audit blocked the breaking-change form — HQRow.vue and
 * HQRow.test.ts iterate `slots` as bare strings and live outside the
 * 9-file allowlist). The new `slotDisplay?` parallel array carries the
 * display payload aligned by index; `null` at position i in slotDisplay
 * matches `slots[i] === null` exactly. Mirrors the handCards / handDisplay
 * parallel-array pattern.
 */
export interface UIHQState {
  slots: (string | null)[];
  slotDisplay?: (UIHQCard | null)[];
}

/**
 * Mastermind projection with identity and tactics counts.
 *
 * // why: `display` is keyed internally by gameState.mastermind.baseCardId
 * (the canonical G.cardStats / G.cardDisplayData join key per pre-flight
 * 2026-04-29 PS-5); `id` continues to expose the qualified group id
 * (e.g., "core/dr-doom"). UI consumers never see the join key.
 *
 * // why: WP-128 / D-12805 — `attachedBystanders` represents bystanders
 * captured by the mastermind itself (Master Strike effects, per
 * Interpretation B). This IS populated at runtime (WP-154 / D-15401 wired
 * `G.mastermind.attachedBystanders`; `mastermindHandlers.ts` captures onto
 * it). **Still do NOT flatten `G.attachedBystanders`** (the top-level
 * city-villain captures) onto the mastermind tile — those are a separate
 * capture store, rendered on the city row as `UICityCard.attachedBystanderCount`
 * (WP-505 / D-24311), never here.
 *
 * // why: WP-128 / D-12806 — `strikePile` ships as `[]` until a future
 * WP adds `G.mastermind.strikePile` so resolved Master Strike cards are
 * preserved for replay (today they live in `G.villainDeck.discard`).
 */
export interface UIMastermindState {
  id: string;
  tacticsRemaining: number;
  tacticsDefeated: number;
  display: UICardDisplay;
  attachedBystanders: UIDisplayEntry[];
  strikePile: UIDisplayEntry[];
  gameText?: readonly string[];
}

/**
 * Scheme projection with identity and twist count.
 *
 * // why: WP-128 / D-12806 — `twistPile` projects `G.scheme.twistPile`
 * (scheme-twist cards route there, not to villainDeck.discard).
 * `twistCount` is derived from `twistPile.length`.
 */
export interface UISchemeState {
  id: string;
  twistCount: number;
  twistPile: UIDisplayEntry[];
  display?: UICardDisplay;
  gameText?: readonly string[];
}

/**
 * Economy projection with totals and available amounts.
 *
 * // why: WP-128 / D-12806 — `piercing` and `woundsDrawn` ship as `0`
 * until future WPs add `G.turnEconomy.piercing` (and the move logic
 * that increments it) and `G.turnEconomy.woundsDrawn` (and the
 * wound-draw tracking it requires).
 */
export interface UITurnEconomyState {
  attack: number;
  recruit: number;
  availableAttack: number;
  availableRecruit: number;
  piercing: number;
  woundsDrawn: number;
}

/**
 * Shared deck reservoirs surfaced as counts only.
 *
 * // why: WP-128 / WP-014A determinism contract — counts only; the
 * next-card identity is NEVER projected. Revealing future villain or
 * hero cards would break replay determinism. `heroDeckCount` ships as
 * `0` per D-12806 safe-skip until a future WP adds a hero-deck
 * reservoir on `G` (today HQ is static post-setup).
 */
export interface UIDecksState {
  villainDeckCount: number;
  heroDeckCount: number;
}

/**
 * Shared global pile counts (Bystanders / Wounds / Horrors / Officers /
 * Sidekicks).
 *
 * // why: WP-128 — counts only; pile contents are not card-identity-stable
 * sources for board-layout rendering. `horrorsCount` is always present
 * with `0` default per D-12802 (avoids `?: number` ergonomics tax) and
 * ships as the safe-skip default per D-12806.
 */
export interface UISharedPilesState {
  bystandersCount: number;
  woundsCount: number;
  horrorsCount: number;
  officersCount: number;
  sidekicksCount: number;
}

/**
 * KO pile projection — count, top card, and full contents.
 *
 * // why: WP-128 / D-12804 — KO pile is shared (NOT per-player) and
 * face-up; full visibility matches physical-table semantics. `topCard`
 * is the last entry (`null` when count === 0); `cards` is the full
 * pile in deterministic insertion order. Source path is top-level
 * `G.ko: CardExtId[]` per `types.ts:481` — NOT `G.piles.ko` (no such
 * path exists; pre-flight 2026-05-03 PS-1 corrected this).
 */
export interface UIKoPileState {
  count: number;
  topCard: UIDisplayEntry | null;
  cards: UIDisplayEntry[];
}

/**
 * Game-over projection with outcome, reason, and optional scores.
 */
export interface UIGameOverState {
  outcome: string;
  reason: string;
  scores?: FinalScoreSummary;
  par?: UIParBreakdown;
  // why: WP-502 / D-24306 — present ONLY when the players ended the match early
  // (the MATCH_ENDED_EARLY condition). The client reads it to (a) label the
  // endgame panel as an early end rather than a genuine tie and (b) skip the
  // competitive-score submission (an abandoned match is never scored). Absent on
  // every natural win / loss / tie. Optional + omit-when-absent, so it survives
  // the audience filter's `{ ...uiState.gameOver }` spread with no whitelist edit.
  endedEarly?: boolean;
}

// why: projected for WP-062 HUD consumption; `bystandersRescued` aggregates
// from each player's victory pile, `escapedVillains` surfaces
// G.counters[ESCAPED_VILLAINS]. See WP-067.
/**
 * Aggregate progress counters projected from G for HUD display.
 *
 * Both fields are derived at projection time from authoritative G state and
 * are required on every UIState — even during the lobby phase, where both
 * values are zero.
 */
export interface UIProgressCounters {
  /** Aggregate count of bystanders in every player's victory zone. */
  bystandersRescued: number;
  /** Cumulative count of villains that escaped the City. */
  escapedVillains: number;
}

// why: WP-367 / D-24159 — projected only while the deck-exhaustion final-turn
// latch is active. Lets the client render a "final turn" warning without
// re-deriving deck state or endgame rules. Present-only-when-active (the field
// on UIState is omitted otherwise), so the mere presence of this object is the
// signal that the game is in its final turn.
/**
 * Final-turn warning projection for the HUD.
 *
 * Emitted once a shared deck (Hero Deck or Villain Deck) has reached zero cards
 * and the game has not yet ended. The current turn is the last chance to win or
 * lose; otherwise the game ends in a tie (WP-367 / D-24159).
 */
export interface UIFinalTurnState {
  /** Human-readable description of why the final turn triggered. */
  reason: string;
  /** Cards remaining in the shared Hero Deck reservoir. */
  heroDeckRemaining: number;
  /** Cards remaining in the Villain Deck draw pile. */
  villainDeckRemaining: number;
}

// why: verbatim name-for-name mirror of WP-048 ScoreBreakdown so WP-062
// aria-labels bind to a single contract. Optional on UIGameOverState because
// not every match is PAR-scored; under D-6701 MVP the payload is deferred and
// the field is always omitted at runtime.
/**
 * PAR scoring breakdown projection for the endgame HUD.
 *
 * Field names mirror WP-048's ScoreBreakdown verbatim so WP-062 aria-labels
 * bind to a single contract. Per D-6701 the payload is deferred until the
 * follow-up WP wires `ReplayResult` into `buildUIState`; the type-level
 * contract ships here so the drift test pins the four field names today.
 */
export interface UIParBreakdown {
  /** Raw score before applying PAR baseline. */
  rawScore: number;
  /** Baseline PAR score for the scenario. */
  parScore: number;
  /** Final score after applying PAR baseline and penalty events. */
  finalScore: number;
  /** Version stamp of the ScenarioScoringConfig used to compute the breakdown. */
  scoringConfigVersion: number;
}

/**
 * UI-safe projection of a pending hero reveal choice (WP-222).
 *
 * // why: D-22201 — projects G.pendingHeroChoice into UIState so the
 * arena-client can render an inline "Discard / Put it back" prompt without
 * any registry lookup at the client layer. `display` is pre-resolved via
 * resolveDisplay() at projection time. Strict 4-field contract; no engine
 * internals (no hookRegistry, no cardStats).
 */
export interface UIPendingHeroChoice {
  // why: D-22201 — discriminant mirrors PendingHeroChoice.choiceType;
  // preserving it here allows the client to branch on future choice types
  // without a separate WP to extend the UI contract.
  choiceType: "discard-or-return";
  cardId: string;
  playerID: string;
  display: UICardDisplay;
}

/**
 * Eligible card for KO-a-Hero choice resolution (WP-243 / D-24010).
 * @see WP-243 §Scope (In)
 * @see EC-274 Locked Values
 */
export interface UIEligibleKoHeroCard {
  zone: "discard" | "hand" | "inPlay";
  cardId: string;
  display: UICardDisplay;
}

/**
 * UI contract for resolving a pending KO-a-Hero choice (WP-243 / D-24010).
 * Only visible to the choosing player; redacted for opponents and spectators.
 * @see WP-243 §Scope (In)
 * @see EC-274 Locked Values
 * @see DECISIONS.md D-24010..D-24012
 */
export interface UIPendingKoHeroChoice {
  choiceType: "ko-hero";
  playerID: string;
  eligible: UIEligibleKoHeroCard[];
  remaining: number;
}

/**
 * One revealed card in a pending Doombot scry-KO choice (WP-470 / D-24282). The
 * client renders each of the (up to two) revealed deck-top cards and submits
 * `resolveScryKoChoice({ cardId })` for the one the player chooses to KO. `cardId`
 * is the deck instance id the engine resolve matches against the front pending
 * entry's `revealedCardIds` snapshot (the round-trip rule).
 */
export interface UIScryKoRevealedCard {
  cardId: string;
  display: UICardDisplay;
}

/**
 * UI contract for resolving a pending Doombot scry-KO choice (WP-470 / D-24282).
 * Only visible to the choosing player; redacted for opponents and spectators (the
 * revealed cards are the top of the chooser's own deck — their next draws).
 *
 * `revealedCards` is the FRONT pending entry's `revealedCardIds` snapshot resolved
 * to display data, in deck-top order (the two cards the player was shown). The
 * client submits `{ cardId }` for the chosen card; the engine KOs it and leaves
 * the other on top.
 *
 * @see WP-470 §Scope (In)
 * @see EC-505 Locked Values
 * @see DECISIONS.md D-24282
 */
export interface UIPendingScryKoChoice {
  choiceType: "scry-ko";
  playerID: string;
  revealedCards: UIScryKoRevealedCard[];
}

/**
 * One hand card in a pending discard-to-limit choice (WP-476 / D-24284). The
 * client renders each hand card and lets the player select which to discard,
 * then submits `resolveDiscardChoice({ cardIds })` with the selected ids.
 * `cardId` is the hand instance id the engine resolve matches against the
 * current hand (the round-trip rule).
 */
export interface UIDiscardChoiceHandCard {
  cardId: string;
  display: UICardDisplay;
}

/**
 * UI contract for resolving a pending discard-to-limit choice (WP-476 / D-24284).
 * Only visible to the choosing player; redacted for opponents and spectators (the
 * hand carries the chooser's private card identities).
 *
 * `hand` is the chooser's current hand resolved to display data, in hand order
 * (the cards they may discard). `limit` is the hand-size they must discard down
 * to (4 for Magneto), so the client requires exactly `hand.length - limit`
 * selections before submitting `{ cardIds }`. The engine KOs nothing — it moves
 * the chosen cards hand→discard.
 *
 * @see WP-476 §Scope (In)
 * @see EC-511 Locked Values
 * @see DECISIONS.md D-24284
 */
export interface UIPendingDiscardChoice {
  choiceType: "discard-to-limit";
  playerID: string;
  limit: number;
  hand: UIDiscardChoiceHandCard[];
}

/**
 * UI contract for resolving a pending put-cards-on-deck choice (WP-538 / D-24347).
 * Only visible to the choosing player; redacted for opponents and spectators (the
 * hand carries the chooser's private card identities).
 *
 * `hand` is the chooser's current hand resolved to display data, in hand order
 * (the cards they may put on top). `count` is how many they must put on top (2 for
 * Dr. Doom), so the client requires exactly `count` selections, in top-down order,
 * before submitting `{ cardIds }` (cardIds[0] ends up on top). The engine moves the
 * chosen cards hand→deck-top.
 *
 * @see WP-538 §Scope (In)
 * @see EC-573 Locked Values
 * @see DECISIONS.md D-24347
 */
export interface UIPendingPutCardsOnDeckChoice {
  choiceType: "put-cards-on-deck";
  playerID: string;
  count: number;
  hand: UIDiscardChoiceHandCard[];
}

/**
 * One card in a pending reveal-remainder reorder choice (WP-479 / D-24286). The
 * client renders the remainder face-up and lets the player pick the order to put
 * them back on top of the deck, then submits
 * `resolveReorderChoice({ orderedCardIds })` — a permutation of these ids.
 * `cardId` is the deck instance id the engine resolve validates against the parked
 * remainder (the round-trip rule).
 */
export interface UIReorderChoiceCard {
  cardId: string;
  display: UICardDisplay;
}

/**
 * UI contract for resolving a pending reveal-remainder reorder choice
 * (WP-479 / D-24286). Only visible to the choosing player; redacted for opponents
 * and spectators (the remainder is the top of the chooser's own deck — their next
 * draws).
 *
 * `cards` is the revealed remainder (the top-N of the deck the reveal left in
 * place) resolved to display data, in current deck-top order. The client picks an
 * order and submits `{ orderedCardIds }` — a permutation of `cards[].cardId`. The
 * engine rewrites the top-N of the deck to that order.
 *
 * @see WP-479 §Scope (In)
 * @see EC-514 Locked Values
 * @see DECISIONS.md D-24286
 */
export interface UIPendingReorderChoice {
  choiceType: "reorder-deck-top";
  playerID: string;
  cards: UIReorderChoiceCard[];
}

/**
 * One eligible target in a pending defeat-with-a-Bystander choice (WP-486 /
 * D-24291). A City Villain holding a Bystander (identified for submission by its
 * `cityIndex`), or the Mastermind (its current tactic). `display` carries the
 * villain's or Mastermind's card display for the prompt label/image.
 *
 * The client submits `resolveDefeatChoice({ targetKind, cityIndex })` — the
 * `cityIndex` is present here for `kind:"villain"` and is the selector the engine
 * resolve validates against the parked target set (the round-trip rule).
 */
export interface UIDefeatChoiceTarget {
  kind: "villain" | "mastermind";
  cityIndex?: number;
  display: UICardDisplay;
}

/**
 * UI contract for resolving a pending defeat-with-a-Bystander choice (WP-486 /
 * D-24291). Only visible to the choosing player (the one who played Silent
 * Sniper); redacted for opponents and spectators — the target set is public board
 * data, but WHOSE decision it is (and the resulting board freeze) is private to
 * the chooser, exactly like the reorder choice.
 *
 * `targets` is the eligible-target set at park time (City Villains holding a
 * Bystander, ascending; then the Mastermind), resolved to display data. The client
 * picks one and submits `{ targetKind, cityIndex }`.
 *
 * @see WP-486 §Scope (In)
 * @see EC-521 Locked Values
 * @see DECISIONS.md D-24291
 */
export interface UIPendingDefeatChoice {
  choiceType: "defeat-with-bystander";
  playerID: string;
  targets: UIDefeatChoiceTarget[];
}

/**
 * UI contract for resolving a pending optional-KO-then-reward choice
 * (WP-249 / D-24020). Mirrors UIPendingKoHeroChoice; only visible to the
 * choosing player, redacted for opponents and spectators.
 *
 * `playerID` is REQUIRED — `uiState.filter.ts` keys the chooser-only redaction
 * on it (`audience.playerId === playerID`), exactly as the KO-hero filter does.
 * `eligibleHand` / `eligibleDiscard` REUSE `UIEligibleKoHeroCard` so each entry
 * carries its instance `cardId` separately from `display`: the client submits
 * `{ zone, cardId }` and the zone instance id (NOT `display.extId`) is what the
 * engine resolve matches (the round-trip rule). `eligibleHand` entries carry
 * `zone:"hand"`, `eligibleDiscard` entries `zone:"discard"`.
 *
 * @see WP-249 §Locked Contract Values
 * @see EC-280 Locked Values
 * @see DECISIONS.md D-24020
 */
export interface UIPendingOptionalKoReward {
  // why: D-24020 — the redaction key; the chooser-only filter compares
  // audience.playerId against this, mirroring UIPendingKoHeroChoice.playerID.
  playerID: string;
  // why: D-24020 — derived once in uiState.build.ts by the single deterministic
  // rewardType + magnitude mapping; never an ad-hoc or per-card string.
  rewardLabel: string;
  eligibleHand: UIEligibleKoHeroCard[];
  eligibleDiscard: UIEligibleKoHeroCard[];
}

/**
 * UI contract for resolving a pending draw-or-empowered choice (WP-287 / D-24071).
 *
 * Mirrors UIPendingOptionalKoReward but simpler — a binary choice with NO eligible
 * card list (the printed "Choose one: Draw a card, or Empowered by {class}"). Only
 * visible to the choosing player; redacted for opponents and spectators.
 *
 * `playerID` is REQUIRED — uiState.filter.ts keys the chooser-only redaction on it.
 *
 * @see WP-287 §Scope (In) — projection + prompt
 * @see EC-319 Locked Values
 * @see DECISIONS.md D-24071
 */
export interface UIPendingDrawOrEmpowered {
  // why: D-24071 — the redaction key; the chooser-only filter compares
  // audience.playerId against this, mirroring UIPendingOptionalKoReward.playerID.
  playerID: string;
  // why: D-24071 — derived once in uiState.build.ts by a single deterministic
  // empoweredClass→display mapping; never an ad-hoc or per-card string.
  empoweredLabel: string;
}

/**
 * One eligible villain the player may pick from their victory pile for a
 * victory-villain-attack (`The Ebony Blade`) resolution (WP-313 / D-24099).
 * `attackValue` is the villain's printed attack (stored as `fightCost`; a
 * villain's `.attack` is always 0 — WP-285). The client renders each entry and
 * submits `resolveVictoryPileCardPick({ cardId })` for the chosen villain.
 */
export interface UIVictoryPileVillainChoice {
  cardId: string;
  display: UICardDisplay;
  attackValue: number;
}

/**
 * UI contract for resolving a pending victory-pile villain-pick choice
 * (WP-313 / D-24099 — the UX half of WP-285's `victory-villain-attack`).
 * Only visible to the choosing player; redacted for opponents and spectators.
 * `eligibleVillains` is recomputed fresh from `G` at projection time via the
 * engine's `getEligibleVictoryVillains` (victory pile ∩ villain type), in
 * victory-pile order, so the client's `{ cardId }` selection always maps to a
 * villain the engine resolve accepts (the round-trip rule).
 */
export interface UIPendingVictoryPileCardPick {
  // why: D-24099 — the redaction key; the chooser-only filter compares
  // audience.playerId against this, mirroring UIPendingDrawOrEmpowered.playerID.
  playerID: string;
  eligibleVillains: UIVictoryPileVillainChoice[];
}

/**
 * One eligible HQ card the player may put on the bottom of the Hero Deck for an
 * optional-put-bottom-hq resolution (Wonder Man's `Ionic Energy`). The client
 * renders each entry and submits `resolveOptionalPutBottomHQ({ cardId })` for the
 * chosen card. `cardId` is the HQ instance id the engine resolve matches (NOT
 * `display.extId`) — the round-trip rule.
 */
export interface UIHqCardChoice {
  cardId: string;
  display: UICardDisplay;
}

/**
 * UI contract for resolving a pending optional-put-bottom-hq choice ("You may put
 * a card from the HQ on the bottom of the Hero Deck"). Only visible to the choosing
 * player; redacted for opponents and spectators. `eligibleHqCards` is recomputed
 * fresh from `G.hq` at projection time (the non-null HQ slots, in slot order), so
 * the client's `{ cardId }` selection always maps to a card the engine resolve
 * accepts (the round-trip rule). The optional form (Ionic Energy) also offers a
 * first-class Decline (`{ decline: true }`); the MANDATORY form (Absorb Ambient
 * Power, `mandatory: true`) does not — the player must pick a card.
 */
export interface UIPendingOptionalPutBottomHQ {
  // why: the redaction key; the chooser-only filter compares audience.playerId
  // against this, mirroring UIPendingVictoryPileCardPick.playerID.
  playerID: string;
  eligibleHqCards: UIHqCardChoice[];
  // why: D-24133 — true for the mandatory "Put a card…" form (Absorb Ambient Power);
  // the client hides the Decline control so the player cannot no-op a required choice.
  // Absent/false is the optional "You may put a card…" form (Ionic Energy).
  mandatory?: boolean;
}

/**
 * The chooser-facing projection of the front pending return-zero-cost-discard
 * choice (D-24139) — the mandatory "Return a 0-cost card from your discard
 * pile to your hand" form (Black Knight's Defend the Weak).
 *
 * `eligibleDiscardCards` REUSES `UIEligibleKoHeroCard` (zone is always
 * 'discard' here) so each entry carries the instance cardId + display the
 * prompt renders. The list holds ONLY the 0-cost cards, filtered by the same
 * isZeroCostCard predicate the resolve move validates with (the round-trip
 * rule), preserving discard order.
 */
export interface UIPendingReturnZeroCostDiscard {
  // why: the redaction key; the chooser-only filter compares audience.playerId
  // against this, mirroring UIPendingOptionalPutBottomHQ.playerID.
  playerID: string;
  eligibleDiscardCards: UIEligibleKoHeroCard[];
}

/**
 * UI contract for resolving a pending discard-to-play cost ("To play this card,
 * you must discard a card from your hand" — Cyclops Determination/Optic Blast +
 * siblings, WP-383 / D-24184).
 *
 * `eligibleDiscardCards` REUSES `UIEligibleKoHeroCard` (zone is always 'hand'
 * here) — the chooser's whole current hand, in hand order (the same list the
 * resolve move validates against, the round-trip rule). The choice is mandatory
 * (no decline). `remaining` is how many cards still must be discarded (starts at
 * the cost magnitude; the client can label progress for multi-discard cards).
 */
export interface UIPendingDiscardToPlay {
  // why: the redaction key; the chooser-only filter compares audience.playerId
  // against this, mirroring UIPendingReturnZeroCostDiscard.playerID.
  playerID: string;
  /** How many more cards the player must discard to complete the play. */
  remaining: number;
  eligibleDiscardCards: UIEligibleKoHeroCard[];
}

/**
 * UI contract for resolving a pending OPTIONAL return-on-discard choice ("If a
 * card effect makes you discard this card, you may return this card to your
 * hand" — Cyclops Unending Energy, WP-498 / D-24301).
 *
 * `eligibleReturnCards` REUSES `UIEligibleKoHeroCard` (zone is always 'discard'
 * here) — the single just-discarded card that may be returned, recomputed fresh
 * via getEligibleReturnOnDiscardCards (the same predicate the resolve move
 * validates against, the round-trip rule). The choice is OPTIONAL: the client
 * renders one Return button (per eligible card) AND a Decline button
 * (`resolveReturnOnDiscard({ decline: true })`). Only visible to the chooser;
 * redacted for opponents and spectators (keyed on .playerID).
 */
export interface UIPendingReturnOnDiscard {
  // why: the redaction key; the chooser-only filter compares audience.playerId
  // against this, mirroring UIPendingDiscardToPlay.playerID.
  playerID: string;
  eligibleReturnCards: UIEligibleKoHeroCard[];
}

/**
 * UI contract for resolving a pending give-HQ-Hero choice ("Choose a Hero in the
 * HQ for each player. Each player gains that Hero." — Paibok the Power Skrull Fight,
 * WP-532 / D-24343).
 *
 * `eligible` REUSES `UIHqCardChoice` (a Hero + its display; the HQ is the implied
 * zone) — the non-null `G.hq` occupants recomputed fresh via
 * getEligibleGiveHqHeroCards (the same predicate the resolve move validates against,
 * the round-trip rule). The client renders one Gain button per eligible HQ Hero and
 * submits `resolveGiveHqHeroChoice({ cardId })`. Only visible to the choosing player;
 * redacted (omitted) for opponents and spectators (keyed on .playerID) — the HQ is
 * PUBLIC, but only the chooser's prompt is projected so no one else sees the choice UI.
 */
export interface UIPendingGiveHqHeroChoice {
  choiceType: "give-hq-hero";
  // why: the redaction key; the chooser-only filter compares audience.playerId
  // against this, mirroring UIPendingReturnOnDiscard.playerID.
  playerID: string;
  eligible: UIHqCardChoice[];
}

/**
 * A single Copy Powers candidate — an in-play Hero the player may copy + its display.
 * Duplicate-first sibling of UIHqCardChoice (identical shape, different implied zone: the
 * candidates live in `inPlay`, not the HQ).
 */
export interface UICopyHeroChoice {
  cardId: string;
  display: UICardDisplay;
}

/**
 * UI contract for resolving a pending Copy Powers choice ("Play this card as a copy of
 * another Hero you played this turn." — Rogue's Copy Powers, WP-535 / D-24345).
 *
 * `eligible` is the current player's real in-play Heroes (minus Copy Powers) recomputed
 * fresh via getEligibleCopyPowersCards (the same predicate the resolve move validates
 * against, the round-trip rule). The client renders one Copy button per eligible Hero and
 * submits `resolveCopyPowersChoice({ cardId })`. Only visible to the choosing player;
 * redacted (omitted) for opponents and spectators (keyed on .playerID).
 */
export interface UIPendingCopyPowersChoice {
  choiceType: "copy-powers";
  // why: the redaction key; the chooser-only filter compares audience.playerId
  // against this, mirroring UIPendingGiveHqHeroChoice.playerID.
  playerID: string;
  eligible: UICopyHeroChoice[];
}

/**
 * UI contract for resolving a pending put-any-number-bottom-hq choice ("Choose any number of
 * cards/Heroes from the HQ. Put them on the bottom of the Hero Deck" — D-24132). The MULTI-
 * select sibling of UIPendingOptionalPutBottomHQ: the client renders a checkbox/toggle per
 * eligible HQ card and submits `resolvePutAnyNumberBottomHQ({ cardIds })` for all selected
 * cards (possibly an empty array — "any number" includes zero). Only visible to the choosing
 * player; redacted for opponents and spectators. `eligibleHqCards` is recomputed fresh from
 * `G.hq` at projection time (the non-null HQ slots, in slot order), so each `{ cardId }` in the
 * submitted selection always maps to a card the engine resolve accepts (the round-trip rule).
 */
export interface UIPendingPutAnyNumberBottomHQ {
  // why: the redaction key; the chooser-only filter compares audience.playerId
  // against this, mirroring UIPendingOptionalPutBottomHQ.playerID.
  playerID: string;
  eligibleHqCards: UIHqCardChoice[];
}

export type { UIAudience } from "./uiAudience.types.js";
