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
} from '../rules/villainAbility.types.js';
import { normalizeTraitSlug } from '../state/traits.normalize.js';
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
