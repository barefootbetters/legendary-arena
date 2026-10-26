/**
 * Villain defeat-requirement builder for setup-time resolution (WP-292 / D-24076).
 *
 * Reads villain per-card ability text from the registry, detects the
 * `[require-to-defeat:<kind>:<value>]` marker, and produces the deterministic
 * per-instance Record<CardExtId, VillainDefeatRequirement> stored in
 * G.villainDefeatRequirements.
 *
 * A defeat requirement is a fight PRECONDITION ("You can't defeat X unless you
 * have a [class/team] Hero"), architecturally distinct from the onFight /
 * onAmbush / onEscape consequence hooks built by villainAbility.setup.ts. It is
 * built here in its own table so the fightVillain gate reads it directly.
 *
 * Mirrors the villainAbility.setup.ts discipline: a local structural registry
 * reader (no registry-package import), markup validated against a canonical
 * union, no NL parsing, no .reduce(), no throws. Setup-time only.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type {
  VillainDefeatRequirement,
  VillainDefeatRequirementKind,
  VillainFightDiscardCost,
} from '../rules/villainAbility.types.js';
import { normalizeTraitSlug } from '../state/traits.normalize.js';
// why: WP-841 / D-24774 — the variable-Attack entry type and its source list live in
// the fight-cost logic file (the WP-815 precedent); the marker parser validates the
// source and the City gate against these canonical arrays.
import type {
  VillainVariableAttack,
  VillainVariableAttackSource,
} from '../economy/villainVariableAttack.logic.js';
import { VILLAIN_VARIABLE_ATTACK_SOURCES } from '../economy/villainVariableAttack.logic.js';
import type { CitySpaceName } from '../board/citySpaceNames.js';
import { CITY_SPACE_NAMES } from '../board/citySpaceNames.js';
// why: D-18704 — defeat requirements must key by the copy-indexed instance
// ext_id (matching the fightVillain fire site, which passes a zone id), fanning
// out exactly like the villain hook path. The shared emitter is imported, not
// re-implemented (D-13702 RS-4).
import { villainCardInstanceExtIds } from '../villainDeck/villainDeck.setup.js';

// ---------------------------------------------------------------------------
// Structural registry reader (local) — mirrors villainAbility.setup.ts
// ---------------------------------------------------------------------------

// why: game-engine must not import the registry package; this interface is
// satisfied structurally by CardRegistry. Only getSet is needed (the same
// getSet-per-group pattern as buildVillainAbilityHooks). Duplicated locally per
// the D-10014 no-circular-import convention.

/** Minimal structural type for a single villain card within a group. */
interface DefeatRequirementVillainCard {
  slug: string;
  abilities: string[];
  /** Copy count (WP-167 / D-16701); read by the shared instance-id emitter. */
  copies?: number;
}

/** Setup-time registry reader for villain defeat-requirement resolution. */
export interface VillainDefeatRequirementRegistryReader {
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// ---------------------------------------------------------------------------
// Marker extraction (structured pattern only — no NL parsing)
// ---------------------------------------------------------------------------

/** Regex for the [require-to-defeat:<kind>:<value>] marker. */
const DEFEAT_REQUIREMENT_MARKER_PATTERN = /\[require-to-defeat:([^\]]+)\]/g;

/**
 * Maps a marker `<kind>` token to its canonical requirement kind.
 *
 * @param kindToken - The raw kind token inside the marker (`team` or `hc`).
 * @returns The canonical kind, or null when the token is unrecognized.
 */
// why: D-24076 — only `team` and `hc` are recognized; `hc` maps to
// 'hero-class'. Any other token yields no requirement (no throw) so a malformed
// marker is inert rather than fatal.
function markerKindToRequirementKind(
  kindToken: string,
): VillainDefeatRequirementKind | null {
  if (kindToken === 'team') {
    return 'team';
  }
  if (kindToken === 'hc') {
    return 'hero-class';
  }
  return null;
}

/**
 * Parses the first valid `[require-to-defeat:<kind>:<value>]` marker on an
 * ability line into a requirement, or null when the line carries none.
 *
 * The marker value is `<kind>:<value>` (e.g. `team:x-men`, `hc:covert`). An
 * unknown kind, a missing or empty value, or extra colon-separated tokens yield
 * null — the marker is then inert.
 *
 * @param abilityLine - One villain ability text line.
 * @returns The parsed requirement, or null.
 */
function parseDefeatRequirementLine(
  abilityLine: string,
): VillainDefeatRequirement | null {
  const regex = new RegExp(DEFEAT_REQUIREMENT_MARKER_PATTERN.source, 'g');
  let match: RegExpExecArray | null = regex.exec(abilityLine);
  while (match !== null) {
    const parts = match[1]!.split(':');
    if (parts.length === 2) {
      const kind = markerKindToRequirementKind(parts[0]!);
      const value = normalizeTraitSlug(parts[1]!);
      if (kind !== null && value.length > 0) {
        return { kind, value };
      }
    }
    match = regex.exec(abilityLine);
  }
  return null;
}

/** Regex for the [discard-to-fight:<kind>:<costs>] marker (WP-817 / D-24750). */
const FIGHT_DISCARD_COST_MARKER_PATTERN = /\[discard-to-fight:([^\]]+)\]/g;

/**
 * Parses a `+`-joined cost list (`2+3+5+7`) into strictly ascending non-negative
 * integers, or null when malformed.
 *
 * @param token - The raw cost-list token.
 * @returns The parsed costs, or null.
 */
// why: D-24750 — the same cost-list grammar as the `discard-hero-each-player-by-cost`
// arm in villainAbility.setup.ts (a second copy, kept local per the duplicate-first
// rule and the D-10014 no-circular-import convention). Each token is `0` or a
// positive integer without a leading zero; the list is non-empty and strictly
// ascending.
function parseEligibleCostList(token: string): number[] | null {
  const costs: number[] = [];
  for (const costToken of token.split('+')) {
    if (!/^(0|[1-9][0-9]*)$/.test(costToken)) {
      return null;
    }
    const cost = Number.parseInt(costToken, 10);
    const previousCost = costs[costs.length - 1];
    if (previousCost !== undefined && cost <= previousCost) {
      return null;
    }
    costs.push(cost);
  }
  return costs;
}

/**
 * Parses the first valid `[discard-to-fight:cost:<c>[+<c>…]]` marker on an
 * ability line into a fight discard cost, or null when the line carries none.
 *
 * Only the `cost` kind exists. A missing kind, another kind, extra colon-separated
 * tokens, or a malformed cost list yield null — the marker is then inert.
 *
 * @param abilityLine - One villain ability text line.
 * @returns The parsed fight discard cost, or null.
 */
export function parseFightDiscardCostLine(
  abilityLine: string,
): VillainFightDiscardCost | null {
  const regex = new RegExp(FIGHT_DISCARD_COST_MARKER_PATTERN.source, 'g');
  let match: RegExpExecArray | null = regex.exec(abilityLine);
  while (match !== null) {
    const parts = match[1]!.split(':');
    if (parts.length === 2 && parts[0] === 'cost') {
      const eligibleCosts = parseEligibleCostList(parts[1]!);
      if (eligibleCosts !== null) {
        return { eligibleCosts };
      }
    }
    match = regex.exec(abilityLine);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Set-qualified ID parsing + registry finders (local copies)
// ---------------------------------------------------------------------------

/**
 * Parses a set-qualified ID `<setAbbr>/<slug>` into its components.
 *
 * Returns null on malformed input — empty string, missing or multiple slashes,
 * empty parts, or surrounding whitespace.
 */
// why: D-10014 — duplicated locally to avoid a circular import between
// setup-time builders and matchSetup.validate.ts. Identical rejection rules to
// the copies in villainAbility.setup.ts and villainDeck.setup.ts.
function parseQualifiedId(
  input: string,
): { setAbbr: string; slug: string } | null {
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

/**
 * Runtime guard for the VillainDefeatRequirementRegistryReader interface.
 *
 * @param registry - Candidate registry object.
 * @returns True when getSet is callable.
 */
function isRegistryReader(
  registry: unknown,
): registry is VillainDefeatRequirementRegistryReader {
  if (!registry || typeof registry !== 'object') return false;
  const candidate = registry as Record<string, unknown>;
  return typeof candidate.getSet === 'function';
}

/**
 * Finds a villain group's cards within a set's villains[].
 *
 * @param setData - Raw set data from getSet().
 * @param groupSlug - The villain group slug to match.
 * @returns The group's villain cards, or null when absent/malformed.
 */
function findVillainGroupCards(
  setData: unknown,
  groupSlug: string,
): DefeatRequirementVillainCard[] | null {
  if (!setData || typeof setData !== 'object') return null;
  const candidate = setData as { villains?: unknown };
  if (!Array.isArray(candidate.villains)) return null;

  for (const rawGroup of candidate.villains) {
    if (!rawGroup || typeof rawGroup !== 'object') continue;
    const group = rawGroup as { slug?: unknown; cards?: unknown };
    if (group.slug !== groupSlug) continue;
    if (!Array.isArray(group.cards)) return null;
    return group.cards as DefeatRequirementVillainCard[];
  }
  return null;
}

// ---------------------------------------------------------------------------
// buildVillainDefeatRequirements — setup-time builder
// ---------------------------------------------------------------------------

/**
 * Builds the per-villain-instance defeat-requirement table from registry data
 * at setup.
 *
 * Called during Game.setup() via buildInitialGameState. Reads villain per-card
 * ability text for the selected villain groups, parses the first
 * `[require-to-defeat:<kind>:<value>]` marker on any line (regardless of any
 * timing prefix), and fans one entry out per copy-indexed instance ext_id via
 * the shared villainCardInstanceExtIds emitter.
 *
 * After setup, G.villainDefeatRequirements is immutable — moves must never
 * modify it.
 *
 * @param registry - Card registry for resolving ability text. Setup-time only.
 *   Accepts unknown to support narrow test mocks; returns an empty record when
 *   the registry does not satisfy the reader interface.
 * @param matchConfig - Validated match setup config (villainGroupIds).
 * @returns The defeat-requirement table; empty when no villain is marked.
 */
export function buildVillainDefeatRequirements(
  registry: unknown,
  matchConfig: MatchSetupConfig,
): Record<CardExtId, VillainDefeatRequirement> {
  const requirements: Record<CardExtId, VillainDefeatRequirement> = {};
  if (!isRegistryReader(registry)) {
    return requirements;
  }

  for (const villainGroupId of matchConfig.villainGroupIds) {
    const parsed = parseQualifiedId(villainGroupId);
    if (parsed === null) continue;
    const setData = registry.getSet(parsed.setAbbr);
    const groupCards = findVillainGroupCards(setData, parsed.slug);
    if (groupCards === null) continue;

    for (const card of groupCards) {
      if (typeof card.slug !== 'string') continue;
      if (!Array.isArray(card.abilities)) continue;

      let requirement: VillainDefeatRequirement | null = null;
      for (const abilityLine of card.abilities) {
        if (typeof abilityLine !== 'string') continue;
        requirement = parseDefeatRequirementLine(abilityLine);
        if (requirement !== null) break;
      }
      if (requirement === null) continue;

      const instanceExtIds = villainCardInstanceExtIds(
        parsed.setAbbr,
        parsed.slug,
        card.slug,
        card,
      );
      // why: fan out a freshly-constructed requirement per copy instance so
      // copies never alias one object (D-13502), and so the gate keyed by a
      // zone-instance ext_id finds its entry.
      for (const cardId of instanceExtIds) {
        requirements[cardId] = { kind: requirement.kind, value: requirement.value };
      }
    }
  }

  return requirements;
}

// ---------------------------------------------------------------------------
// buildVillainFightDiscardCosts — setup-time builder (WP-817 / D-24750)
// ---------------------------------------------------------------------------

/**
 * Builds the per-villain-instance fight-discard-cost table from registry data
 * at setup.
 *
 * Called during Game.setup() via buildInitialGameState, beside
 * buildVillainDefeatRequirements. Reads villain per-card ability text for the
 * selected villain groups, parses the first valid
 * `[discard-to-fight:cost:<c>[+<c>…]]` marker on any line, and fans one entry out
 * per copy-indexed instance ext_id via the shared villainCardInstanceExtIds
 * emitter.
 *
 * After setup, G.villainFightDiscardCosts is immutable — moves must never
 * modify it.
 *
 * @param registry - Card registry for resolving ability text. Setup-time only.
 *   Accepts unknown to support narrow test mocks; returns an empty record when
 *   the registry does not satisfy the reader interface.
 * @param matchConfig - Validated match setup config (villainGroupIds).
 * @returns The fight-discard-cost table; empty when no villain is marked.
 */
export function buildVillainFightDiscardCosts(
  registry: unknown,
  matchConfig: MatchSetupConfig,
): Record<CardExtId, VillainFightDiscardCost> {
  const discardCosts: Record<CardExtId, VillainFightDiscardCost> = {};
  if (!isRegistryReader(registry)) {
    return discardCosts;
  }

  for (const villainGroupId of matchConfig.villainGroupIds) {
    const parsed = parseQualifiedId(villainGroupId);
    if (parsed === null) continue;
    const setData = registry.getSet(parsed.setAbbr);
    const groupCards = findVillainGroupCards(setData, parsed.slug);
    if (groupCards === null) continue;

    for (const card of groupCards) {
      if (typeof card.slug !== 'string') continue;
      if (!Array.isArray(card.abilities)) continue;

      let discardCost: VillainFightDiscardCost | null = null;
      for (const abilityLine of card.abilities) {
        if (typeof abilityLine !== 'string') continue;
        discardCost = parseFightDiscardCostLine(abilityLine);
        if (discardCost !== null) break;
      }
      if (discardCost === null) continue;

      const instanceExtIds = villainCardInstanceExtIds(
        parsed.setAbbr,
        parsed.slug,
        card.slug,
        card,
      );
      // why: a fresh object and a fresh costs array per copy instance, so copies
      // never alias one another (D-13502) and the fightVillain gate keyed by a
      // zone-instance ext_id finds its entry.
      for (const cardId of instanceExtIds) {
        discardCosts[cardId] = { eligibleCosts: [...discardCost.eligibleCosts] };
      }
    }
  }

  return discardCosts;
}

// ---------------------------------------------------------------------------
// Variable-Attack marker (WP-841 / D-24774)
// ---------------------------------------------------------------------------

/** Regex for the [variable-attack:<source>:<N>[@<space>[+<space>…]]] marker. */
const VARIABLE_ATTACK_MARKER_PATTERN = /\[variable-attack:([^\]]+)\]/g;

/**
 * Checks whether a string is one of the canonical variable-Attack sources.
 *
 * @param value - The candidate source token.
 * @returns True when value is a member of VILLAIN_VARIABLE_ATTACK_SOURCES.
 */
function isVariableAttackSource(value: string): value is VillainVariableAttackSource {
  for (const source of VILLAIN_VARIABLE_ATTACK_SOURCES) {
    if (source === value) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a string is one of the canonical City space names.
 *
 * @param value - The candidate space token.
 * @returns True when value is a member of CITY_SPACE_NAMES.
 */
function isVariableAttackCitySpaceName(value: string): value is CitySpaceName {
  for (const spaceName of CITY_SPACE_NAMES) {
    if (spaceName === value) {
      return true;
    }
  }
  return false;
}

/**
 * Validates a `+`-joined City space list and lifts it to a `requireCitySpaces`
 * list, or null when it is empty, names an unknown space, or repeats a space.
 *
 * @param spacesToken - The text after the `@` (e.g. `sewers+bridge`).
 * @returns The validated space list, or null.
 */
// why: a second copy of villainAbility.setup.ts's private parseCityGateSuffix (the
// D-24295 grammar) plus a no-repeat check, kept local per the duplicate-first rule;
// the third copy is the one that gets abstracted.
function parseVariableAttackCityGate(spacesToken: string): CitySpaceName[] | null {
  if (spacesToken.length === 0) {
    return null;
  }
  const spaces: CitySpaceName[] = [];
  for (const rawSpace of spacesToken.split('+')) {
    if (!isVariableAttackCitySpaceName(rawSpace)) {
      return null;
    }
    for (const listedSpace of spaces) {
      if (listedSpace === rawSpace) {
        return null;
      }
    }
    spaces.push(rawSpace);
  }
  return spaces;
}

/**
 * Parses one `[variable-attack:…]` marker value into an entry, or null when it is
 * malformed.
 *
 * @param markerValue - The text inside the marker after `variable-attack:`.
 * @returns The parsed entry, or null.
 */
function parseVariableAttackMarkerValue(markerValue: string): VillainVariableAttack | null {
  const gateParts = markerValue.split('@');
  if (gateParts.length > 2) {
    return null;
  }
  const valueParts = gateParts[0]!.split(':');
  if (valueParts.length !== 2) {
    return null;
  }
  const source = valueParts[0]!;
  const attackToken = valueParts[1]!;
  if (!isVariableAttackSource(source) || !/^[1-9][0-9]*$/.test(attackToken)) {
    return null;
  }
  const attackPerUnit = Number.parseInt(attackToken, 10);
  if (gateParts.length === 1) {
    // why: a flat bonus with no gate would apply everywhere; every printed flat
    // passive names its spaces, so an ungated flat marker is malformed (inert).
    if (source === 'flat') {
      return null;
    }
    return { source, attackPerUnit };
  }
  const requireCitySpaces = parseVariableAttackCityGate(gateParts[1]!);
  if (requireCitySpaces === null) {
    return null;
  }
  return { source, attackPerUnit, requireCitySpaces };
}

/**
 * Parses the first valid `[variable-attack:<source>:<N>[@<space>[+<space>…]]]`
 * marker on an ability line into a variable-Attack entry, or null when the line
 * carries none.
 *
 * An unknown source, an `N` that is not a positive integer, extra colon-separated
 * tokens, more than one `@`, an empty / unknown / repeated space, or an ungated
 * `flat` yield null — the marker is then inert. An ungated entry has no
 * `requireCitySpaces` key at all.
 *
 * @param abilityLine - One villain ability text line.
 * @returns The parsed entry, or null.
 */
export function parseVariableAttackLine(abilityLine: string): VillainVariableAttack | null {
  const regex = new RegExp(VARIABLE_ATTACK_MARKER_PATTERN.source, 'g');
  let match: RegExpExecArray | null = regex.exec(abilityLine);
  while (match !== null) {
    const entry = parseVariableAttackMarkerValue(match[1]!);
    if (entry !== null) {
      return entry;
    }
    match = regex.exec(abilityLine);
  }
  return null;
}

/**
 * Copies a parsed entry into a fresh object for one villain copy.
 *
 * @param entry - The parsed entry.
 * @returns A fresh entry with its own `requireCitySpaces` array, or no such key
 *   when the parsed entry is ungated.
 */
function copyVariableAttackEntry(entry: VillainVariableAttack): VillainVariableAttack {
  // why: the engine has exactOptionalPropertyTypes, so an ungated entry omits
  // requireCitySpaces rather than carrying `requireCitySpaces: undefined`.
  if (entry.requireCitySpaces === undefined) {
    return { source: entry.source, attackPerUnit: entry.attackPerUnit };
  }
  return {
    source: entry.source,
    attackPerUnit: entry.attackPerUnit,
    requireCitySpaces: [...entry.requireCitySpaces],
  };
}

// ---------------------------------------------------------------------------
// buildVillainVariableAttack — setup-time builder (WP-841 / D-24774)
// ---------------------------------------------------------------------------

/**
 * Builds the per-villain-instance variable-Attack table from registry data at
 * setup.
 *
 * Called during Game.setup() via buildInitialGameState, beside
 * buildVillainFightDiscardCosts. Reads villain per-card ability text for the
 * selected villain groups, parses the first valid `[variable-attack:…]` marker on
 * any line, and fans one entry out per copy-indexed instance ext_id via the shared
 * villainCardInstanceExtIds emitter.
 *
 * After setup, G.villainVariableAttack is immutable — moves must never modify it.
 *
 * @param registry - Card registry for resolving ability text. Setup-time only.
 *   Accepts unknown to support narrow test mocks; returns an empty record when
 *   the registry does not satisfy the reader interface.
 * @param matchConfig - Validated match setup config (villainGroupIds).
 * @returns The variable-Attack table; empty when no villain is marked.
 */
// why: D-24774 — a deliberate third copy of the setup registry walk (beside
// buildVillainDefeatRequirements and buildVillainFightDiscardCosts). A shared walk
// would put the two shipped tables at risk for no behavior gain; folding the walks
// is a STATUS follow-up.
export function buildVillainVariableAttack(
  registry: unknown,
  matchConfig: MatchSetupConfig,
): Record<CardExtId, VillainVariableAttack> {
  const variableAttack: Record<CardExtId, VillainVariableAttack> = {};
  if (!isRegistryReader(registry)) {
    return variableAttack;
  }

  for (const villainGroupId of matchConfig.villainGroupIds) {
    const parsed = parseQualifiedId(villainGroupId);
    if (parsed === null) continue;
    const setData = registry.getSet(parsed.setAbbr);
    const groupCards = findVillainGroupCards(setData, parsed.slug);
    if (groupCards === null) continue;

    for (const card of groupCards) {
      if (typeof card.slug !== 'string') continue;
      if (!Array.isArray(card.abilities)) continue;

      let entry: VillainVariableAttack | null = null;
      for (const abilityLine of card.abilities) {
        if (typeof abilityLine !== 'string') continue;
        entry = parseVariableAttackLine(abilityLine);
        if (entry !== null) break;
      }
      if (entry === null) continue;

      const instanceExtIds = villainCardInstanceExtIds(
        parsed.setAbbr,
        parsed.slug,
        card.slug,
        card,
      );
      // why: a fresh object and a fresh requireCitySpaces array per copy instance, so
      // copies never alias one another (D-13502) and resolveFightCost keyed by a
      // zone-instance ext_id finds its entry.
      for (const cardId of instanceExtIds) {
        variableAttack[cardId] = copyVariableAttackEntry(entry);
      }
    }
  }

  return variableAttack;
}
