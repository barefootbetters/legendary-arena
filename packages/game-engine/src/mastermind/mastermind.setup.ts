/**
 * Mastermind setup for the Legendary Arena game engine.
 *
 * buildMastermindState resolves the mastermind from registry data at
 * setup time, constructs the tactics deck, and adds the mastermind
 * base card to G.cardStats so fightMastermind can read the fight
 * requirement without registry access.
 *
 * Per WP-113 / D-10014, mastermindId is the set-qualified form
 * `<setAbbr>/<mastermindSlug>`. The builder parses the qualified form,
 * then iterates ONLY the named set's masterminds[] — no cross-set
 * fallback exists.
 *
 * No @legendary-arena/registry imports. No .reduce(). Setup-time only.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { SetupContext } from '../types.js';
import type { CardStatEntry } from '../economy/economy.types.js';
import type { MastermindState } from './mastermind.types.js';
import { parseCardStatValue } from '../economy/economy.logic.js';
import { shuffleDeck } from '../setup/shuffle.js';

// ---------------------------------------------------------------------------
// Structural types for registry access
// ---------------------------------------------------------------------------

// why: game-engine must not import @legendary-arena/registry; these types
// are satisfied structurally by the real CardRegistry/SetData. Defined
// locally to respect the layer boundary (same pattern as
// VillainDeckRegistryReader in villainDeck.setup.ts).

/**
 * Minimal structural type for a mastermind card entry in SetData.
 */
interface MastermindCardEntry {
  slug: string;
  tactic?: boolean;
  vAttack?: string | number | null;
  abilities?: string[];
}

/**
 * Minimal structural type for a mastermind entry in SetData.
 */
interface MastermindEntry {
  slug: string;
  cards: MastermindCardEntry[];
}

/**
 * Minimal structural type for set data returned by getSet().
 * Only the fields needed for mastermind resolution.
 */
interface MastermindSetData {
  abbr: string;
  masterminds: MastermindEntry[];
}

/**
 * Setup-time registry interface for mastermind resolution.
 *
 * Satisfied structurally by the real CardRegistry from the registry
 * package. Defined locally to respect the layer boundary.
 */
export interface MastermindRegistryReader {
  /** All loaded set index entries. */
  listSets(): Array<{ abbr: string }>;
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// ---------------------------------------------------------------------------
// Runtime type guard
// ---------------------------------------------------------------------------

/**
 * Runtime type guard for MastermindRegistryReader.
 *
 * Returns true if the registry object has the required methods (listSets,
 * getSet). Narrow test mocks that only implement CardRegistryReader will
 * return false.
 */
// why: D-10014 — orchestration-side diagnostic detection seam. The
// orchestration layer (buildInitialGameState) imports this guard to detect
// registry-reader interface mismatches and emit G.messages diagnostics.
export function isMastermindRegistryReader(
  registry: unknown,
): registry is MastermindRegistryReader {
  if (!registry || typeof registry !== 'object') return false;

  const candidate = registry as Record<string, unknown>;
  return (
    typeof candidate.listSets === 'function' &&
    typeof candidate.getSet === 'function'
  );
}

/**
 * Enumerates mastermind slugs in a single set's data.
 *
 * Reads `setData.masterminds[].slug` defensively. Returns an empty array
 * on any malformed shape — never throws. Used by the validator's
 * `buildKnownMastermindQualifiedIds` (Class B: set-data slug enumerator)
 * as the single source of truth for mastermind slug semantics.
 */
// why: D-10014 — single source of truth — set-data slug enumerator.
export function listMastermindSlugsInSet(setData: unknown): string[] {
  if (!setData || typeof setData !== 'object') return [];
  const candidate = setData as { masterminds?: unknown };
  if (!Array.isArray(candidate.masterminds)) return [];

  const slugs: string[] = [];
  for (const entry of candidate.masterminds) {
    if (entry && typeof entry === 'object') {
      const mastermind = entry as { slug?: unknown };
      if (typeof mastermind.slug === 'string' && mastermind.slug.length > 0) {
        slugs.push(mastermind.slug);
      }
    }
  }
  return slugs;
}

/**
 * Parses a set-qualified ID `<setAbbr>/<slug>` into its components.
 *
 * Returns null on malformed input. Locally duplicated per WP-113 §6 step 1
 * — `// why: import or duplicate locally — author choice`.
 */
// why: D-10014 — duplicated locally to avoid a circular import between
// builders and matchSetup.validate.ts.
function parseQualifiedId(input: string): { setAbbr: string; slug: string } | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  if (input !== input.trim()) return null;
  const slashIndex = input.indexOf('/');
  if (slashIndex === -1) return null;
  if (input.indexOf('/', slashIndex + 1) !== -1) return null;
  const setAbbr = input.slice(0, slashIndex);
  const slug = input.slice(slashIndex + 1);
  if (setAbbr.length === 0 || slug.length === 0) return null;
  return { setAbbr, slug };
}

// ---------------------------------------------------------------------------
// Mastermind Transform allowlist (WP-669 / D-24483)
// ---------------------------------------------------------------------------

// why: WP-669 / D-24483 — a mastermind's SECOND non-tactic face is dropped by
// findMastermindCards (D-24193), because for the 56 Epic masterminds it is a harder
// alternate that must not be auto-selected. For a TRANSFORMING mastermind the second
// face is instead the flip target (General Ross ⇄ Red Hulk). This allowlist is the opt-in
// (the SUPPORTED_TRANSFORM_BASES hero precedent): only these masterminds capture their
// second face + populate the transform fields. The other five transforming wwhk
// masterminds (illuminati-secret-society, king-hulk-sakaarson, m-o-d-o-k, red-king-the,
// sentry-the) and every Epic mastermind stay on the D-24193 first-face-only path until
// they are added here with a matching strike resolver.
const MASTERMIND_TRANSFORM_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  'wwhk/general-thunderbolt-ross',
]);

// ---------------------------------------------------------------------------
// buildMastermindState
// ---------------------------------------------------------------------------

/**
 * Builds the mastermind state from registry data at setup time.
 *
 * Resolves the mastermind by slug, classifies cards as base or tactic,
 * adds the base card's fight cost to cardStats, and returns a shuffled
 * tactics deck.
 *
 * @param mastermindId - Mastermind ext_id from MatchSetupConfig.
 * @param registry - Setup-time registry reader. Accepts unknown to support
 *   narrow test mocks. If the registry does not satisfy the interface,
 *   returns a minimal empty state gracefully.
 * @param context - Setup context providing random.Shuffle for deterministic
 *   tactics deck shuffling.
 * @param cardStats - Mutable cardStats record from buildCardStats. This
 *   function adds the mastermind base card entry to it.
 * @returns The mastermind state with shuffled tactics deck.
 */
export function buildMastermindState(
  mastermindId: CardExtId,
  registry: unknown,
  context: SetupContext,
  cardStats: Record<CardExtId, CardStatEntry>,
): MastermindState {
  // why: narrow test mocks (CardRegistryReader) only have listCards()
  // returning { key: string }[]. We check for the full interface at
  // runtime. If the registry doesn't have the required methods, we
  // return a minimal empty state — moves handle gracefully.
  if (!isMastermindRegistryReader(registry)) {
    return {
      id: mastermindId,
      baseCardId: mastermindId,
      tacticsDeck: [],
      tacticsDefeated: [],
      strikePile: [],
      attachedBystanders: [],
      // why: WP-398 / D-24201 — initialise the Hypno-Thrall zone `[]` at this
      // degenerate early-return too. A missed construction site leaves the zone
      // undefined, and co2e Loki's strike would append to nothing.
      hypnoThralls: [],
      gameText: [],
    };
  }

  // why: D-10014 — Builder Filtering Order — iterate named set only.
  // mastermindId is `<setAbbr>/<mastermindSlug>`; parse the qualified form
  // and constrain mastermind iteration to the named set's masterminds[].
  const parsed = parseQualifiedId(mastermindId);
  if (parsed === null) {
    return {
      id: mastermindId,
      baseCardId: mastermindId,
      tacticsDeck: [],
      tacticsDefeated: [],
      strikePile: [],
      attachedBystanders: [],
      // why: WP-398 / D-24201 — initialise the Hypno-Thrall zone `[]` at this
      // degenerate early-return too. A missed construction site leaves the zone
      // undefined, and co2e Loki's strike would append to nothing.
      hypnoThralls: [],
      gameText: [],
    };
  }

  const resolved = findMastermindCards(registry, parsed.setAbbr, parsed.slug);

  if (!resolved) {
    return {
      id: mastermindId,
      baseCardId: mastermindId,
      tacticsDeck: [],
      tacticsDefeated: [],
      strikePile: [],
      attachedBystanders: [],
      // why: WP-398 / D-24201 — initialise the Hypno-Thrall zone `[]` at this
      // degenerate early-return too. A missed construction site leaves the zone
      // undefined, and co2e Loki's strike would append to nothing.
      hypnoThralls: [],
      gameText: [],
    };
  }

  const { setAbbr, mastermindSlug, baseCard, tacticCards, secondFaceCard } = resolved;

  // Build base card ext_id
  const baseCardId = `${setAbbr}-mastermind-${mastermindSlug}-${baseCard.slug}` as CardExtId;

  // why: mastermind fight cost resolved at setup so fightMastermind can
  // read G.cardStats[baseCardId].fightCost without registry access —
  // same pattern as villain fightCost in buildCardStats (WP-018)
  cardStats[baseCardId] = {
    // why: masterminds do not generate resources or have recruit costs
    // — same semantics as villains/henchmen per D-1805
    attack: 0,
    recruit: 0,
    cost: 0,
    fightCost: parseCardStatValue(baseCard.vAttack),
    fightCostMode: 'static',
    fightCostBase: 0,
  };

  // Build tactic ext_ids
  const tacticExtIds: CardExtId[] = [];
  for (const tactic of tacticCards) {
    const tacticExtId = `${setAbbr}-mastermind-${mastermindSlug}-${tactic.slug}` as CardExtId;
    tacticExtIds.push(tacticExtId);
  }

  // Sort lexically for deterministic pre-shuffle ordering
  const sortedTactics = [...tacticExtIds].sort();

  // why: ctx.random.Shuffle provides deterministic shuffling seeded by
  // boardgame.io's PRNG, ensuring replay reproducibility
  const shuffledTactics = shuffleDeck(sortedTactics, context);

  // why: abilities text from the base card is the "radio announcer" —
  // tells the player what happens on Master Strike and the mastermind's
  // special rules. Stored in G at setup so the UIState projection can
  // surface it without runtime registry access.
  const gameText: string[] = [];
  if (Array.isArray(baseCard.abilities)) {
    for (const line of baseCard.abilities) {
      if (typeof line === 'string' && line.length > 0) {
        gameText.push(line);
      }
    }
  }

  // why: WP-669 / D-24483 — Mastermind Transform. For a mastermind in the transform
  // allowlist that ships a second non-tactic face, set that face aside as the flip
  // target: add its fightCost to G.cardStats (so fightMastermind reads the active face's
  // cost after a flip) and record the two OPTIONAL transform fields. Every other
  // mastermind skips this block, so alternateFaceId / faceGameText stay ABSENT and the
  // second face never touches cardStats — a non-transform game (incl. the sentinel)
  // serializes byte-identically and no state-hash oracle re-pins.
  let alternateFaceId: CardExtId | undefined;
  let faceGameText: Record<CardExtId, readonly string[]> | undefined;
  if (MASTERMIND_TRANSFORM_ALLOWLIST.has(mastermindId) && secondFaceCard !== null) {
    const secondFaceId =
      `${setAbbr}-mastermind-${mastermindSlug}-${secondFaceCard.slug}` as CardExtId;
    cardStats[secondFaceId] = {
      attack: 0,
      recruit: 0,
      cost: 0,
      fightCost: parseCardStatValue(secondFaceCard.vAttack),
      fightCostMode: 'static',
      fightCostBase: 0,
    };
    const secondFaceGameText: string[] = [];
    if (Array.isArray(secondFaceCard.abilities)) {
      for (const line of secondFaceCard.abilities) {
        if (typeof line === 'string' && line.length > 0) {
          secondFaceGameText.push(line);
        }
      }
    }
    alternateFaceId = secondFaceId;
    faceGameText = { [baseCardId]: gameText, [secondFaceId]: secondFaceGameText };
  }

  return {
    id: mastermindId,
    baseCardId,
    tacticsDeck: shuffledTactics,
    tacticsDefeated: [],
    strikePile: [],
    attachedBystanders: [],
    // why: WP-398 / D-24201 — the Hypno-Thrall zone starts empty; co2e Loki's
    // strike appends non-grey Heroes to it during play (append-only, no removal).
    hypnoThralls: [],
    gameText,
    // why: WP-669 / D-24483 — conditional spread so the transform fields are ABSENT (not
    // `undefined`) for a non-transform mastermind, keeping its serialized state
    // byte-identical to the pre-WP-669 shape (no hash re-pin).
    ...(alternateFaceId !== undefined ? { alternateFaceId } : {}),
    ...(faceGameText !== undefined ? { faceGameText } : {}),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Finds and classifies mastermind cards within the named set's masterminds[].
 *
 * Returns null if the named set is not loaded, the slug is not present in
 * it, or the mastermind has no base card. No cross-set fallback exists.
 */
// why: D-10014 — Builder Filtering Order — iterate named set only.
function findMastermindCards(
  registry: MastermindRegistryReader,
  setAbbr: string,
  mastermindSlug: string,
): {
  setAbbr: string;
  mastermindSlug: string;
  baseCard: MastermindCardEntry;
  tacticCards: MastermindCardEntry[];
  // why: WP-669 / D-24483 — the SECOND non-tactic face, captured but not selected as
  // the base. null when the mastermind ships only one non-tactic face. buildMastermindState
  // uses it ONLY for a mastermind in the MASTERMIND_TRANSFORM allowlist (a transforming
  // mastermind's second boss face); for every other mastermind it is ignored, preserving
  // the D-24193 first-face-wins behaviour (an Epic variant is still dropped).
  secondFaceCard: MastermindCardEntry | null;
} | null {
  const setData = registry.getSet(setAbbr) as MastermindSetData | undefined;
  if (!setData || !Array.isArray(setData.masterminds)) return null;

  for (const mastermind of setData.masterminds) {
    if (typeof mastermind.slug !== 'string') continue;
    if (mastermind.slug !== mastermindSlug) continue;
    if (!Array.isArray(mastermind.cards)) continue;

    let baseCard: MastermindCardEntry | null = null;
    // why: WP-669 / D-24483 — the first non-tactic face AFTER the base (the second boss
    // face of a transforming mastermind). Captured here so buildMastermindState can set it
    // aside for the flip; still only USED for an allowlisted transforming mastermind.
    let secondFaceCard: MastermindCardEntry | null = null;
    const tacticCards: MastermindCardEntry[] = [];

    for (const card of mastermind.cards) {
      // why: tactic !== true identifies a non-tactic face; tactic === true
      // identifies tactic cards. This is a registry schema contract
      // (D-1413), not a heuristic.
      if (card.tactic === true) {
        tacticCards.push(card);
      } else if (baseCard === null) {
        // why: D-24193 — the base card is the FIRST non-tactic face. A
        // mastermind may ship more than one non-tactic face; every later one
        // is an alternate face (an Epic variant for 56 masterminds, a
        // transformation / second-form face for 9) and is deliberately not
        // selected. There is no opt-in for either yet.
        //
        // why: this guard is the WP-389 fix. The loop previously assigned on
        // every non-tactic face with no early exit, so the LAST one won. That
        // was invisible for as long as every mastermind had exactly one
        // non-tactic face — first-wins and last-wins are indistinguishable in
        // that case — and diverged silently the first time a set shipped an
        // Epic face, selecting the harder variant unchosen.
        //
        // why: guard rather than `break` — tactic cards may follow the base
        // face in registry order, so the loop must keep running to collect
        // them all.
        baseCard = card;
      } else if (secondFaceCard === null) {
        // why: WP-669 / D-24483 — the second non-tactic face (a transforming
        // mastermind's second boss form). Captured, not selected. D-24193 keeps
        // baseCard as the FIRST face; this only records the runner-up so the
        // transform flip has a target when the mastermind is allowlisted.
        secondFaceCard = card;
      }
    }

    if (!baseCard) {
      // why: WP-390 / D-24206 — reaching here is NOT "mastermind not found".
      // The slug matched and `cards` parsed; every card is a tactic, so the
      // mastermind ships zero non-tactic faces and there is no base face to
      // fight. Four masterminds are in this state — `shld/hydra-high-council`,
      // `shld/hydra-super-adaptoid`, `2099/sinister-six-2099`,
      // `2099/alchemax-executives` — because they are COUNCIL masterminds
      // whose members each carry their own Master Strike, a shape the
      // one-base-face + N-tactics model cannot express.
      //
      // why: returning null (the pre-WP-390 behaviour) fell through to
      // buildMastermindState's degenerate branch and produced a mastermind
      // with no Master Strike, no tactics, and no game text — the match ran
      // against an inert obstacle and looked fine. Every `shld` gauntlet was
      // played that way. Game.setup() is the one place permitted to throw,
      // so fail loudly here: a visibly rejected match beats a silently
      // broken one. Modelling councils properly is deferred; this only makes
      // the gap impossible to ship unnoticed.
      throw new Error(
        `The mastermind "${setAbbr}/${mastermind.slug}" has no base face — all ` +
          `${tacticCards.length} of its cards are tactics, so there is no card to ` +
          `fight. This is a council-style mastermind, which the engine cannot yet ` +
          `represent (WP-390 / D-24206). Choose a different mastermind for this ` +
          `match, or add a non-tactic face to that mastermind's cards[] in the ` +
          `set's card data.`,
      );
    }

    return {
      setAbbr,
      mastermindSlug: mastermind.slug,
      baseCard,
      tacticCards,
      secondFaceCard,
    };
  }

  return null;
}
