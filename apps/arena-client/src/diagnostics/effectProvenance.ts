/**
 * Card-effect provenance for the freeze diagnostic (WP-314 / EC-344 / D-24100).
 *
 * Derives a compact, top-level "why is this stuck / did that card fire" summary from
 * the audience-filtered UIState snapshot the diagnostic already carries — so a
 * "froze after I played card X" report names its own cause instead of needing an
 * engine trace. Two fields:
 *
 * - `awaitingPlayerInput` — what (if anything) the turn is blocked on: the pending-choice
 *   kind + chooser, read from the projected `pending*` UIState fields. `null` when nothing
 *   is pending. This is the primary deliverable — a block-all pending choice (e.g. The
 *   Ebony Blade's victory-pile pick, WP-313) is exactly the freeze class this was motivated
 *   by, and it was previously invisible in the export.
 * - `recentlyPlayedCards` — for the last {@link RECENTLY_PLAYED_CARDS_CAP} "played …" log
 *   lines, each card's ext_id, an `outcome` classification inferred from the signals
 *   already in the snapshot (`hollowEffects` + the pending kind + the "did not activate"
 *   log lines), and an `abilityText` populated via an injected resolver.
 *
 * // why: PURE + boundary-clean. This module imports NOTHING from the engine / registry
 * (mirrors diagnostics.ts, EC-260 boundary). The snapshot is read structurally from
 * `unknown`; card text is INJECTED via `resolveCardText`, never imported. The arena-client
 * has no client-side card-text source today, so the default resolver returns `null` and
 * every `abilityText` degrades to `null` (fail-soft) — the injection point stays open for
 * a future engine UIState projection or registry client to populate it (WP-314 Option B).
 */

/** The block-all pending-choice kinds that freeze the turn until resolved. */
export type AwaitingInputKind =
  | 'victoryPileCardPick'
  | 'optionalKoReward'
  | 'drawOrEmpowered'
  | 'koHeroChoice';

/** What the turn is currently blocked on, awaiting the chooser's input. */
export interface AwaitingPlayerInput {
  kind: AwaitingInputKind;
  /** The chooser's playerID, or null when the projected field carried none. */
  playerID: string | null;
}

/** Inferred outcome of a recently-played card, from signals already in the snapshot. */
export type PlayedCardOutcome =
  | 'resolved'
  | 'hollow'
  | 'awaitingChoice'
  | 'conditionNotMet';

/** One recently-played card with its inferred outcome + (injected) ability text. */
export interface RecentlyPlayedCard {
  extId: string;
  /**
   * The card's printed ability text, via the injected `resolveCardText`. `null` when no
   * resolver is supplied (the arena-client has no client-side card-text source today) or
   * the resolver returns null — fail-soft, never a throw. Look up the ext_id in the card
   * data for the text until a resolver is wired.
   */
  abilityText: string | null;
  outcome: PlayedCardOutcome;
}

/** The top-level effect-provenance block attached to the diagnostic export. */
export interface EffectProvenance {
  awaitingPlayerInput: AwaitingPlayerInput | null;
  recentlyPlayedCards: RecentlyPlayedCard[];
}

// why: bound the played-card scan so the export cannot bloat on a long (900-line) match
// log. Five is enough to cover the last turn's plays that could have caused a freeze.
export const RECENTLY_PLAYED_CARDS_CAP = 5;

/** The projected `pending*` fields this reads, mapped to their `AwaitingInputKind`. */
const PENDING_FIELD_TO_KIND: ReadonlyArray<readonly [string, AwaitingInputKind]> = [
  ['pendingVictoryPileCardPick', 'victoryPileCardPick'],
  ['pendingOptionalKoReward', 'optionalKoReward'],
  ['pendingDrawOrEmpowered', 'drawOrEmpowered'],
  ['pendingKoHeroChoice', 'koHeroChoice'],
];

/** Narrows an unknown value to a plain record for structural field reads. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Reads the pending-choice the turn is blocked on from the snapshot's projected
 * `pending*` fields. Only one is set at a time (the engine's block-all guard), so the
 * first present field wins. Returns null when nothing is pending.
 */
function readAwaitingPlayerInput(snapshotRecord: Record<string, unknown>): AwaitingPlayerInput | null {
  for (const [field, kind] of PENDING_FIELD_TO_KIND) {
    const pending = asRecord(snapshotRecord[field]);
    if (pending !== null) {
      const playerID = pending['playerID'];
      return { kind, playerID: typeof playerID === 'string' ? playerID : null };
    }
  }
  return null;
}

/** Collects the ext_ids in `hollowEffects` (WP-257 records carry `cardId`). */
function collectHollowCardIds(snapshotRecord: Record<string, unknown>): Set<string> {
  const hollowCardIds = new Set<string>();
  const hollowEffects = snapshotRecord['hollowEffects'];
  if (Array.isArray(hollowEffects)) {
    for (const record of hollowEffects) {
      const hollow = asRecord(record);
      const cardId = hollow?.['cardId'];
      if (typeof cardId === 'string') {
        hollowCardIds.add(cardId);
      }
    }
  }
  return hollowCardIds;
}

// why: bound the recursion so a malformed/deeply-nested snapshot cannot blow the stack —
// the real UIState projection is shallow (zones → display entries), well under this.
const ABILITY_TEXT_WALK_MAX_DEPTH = 12;

/**
 * Collects every `{ extId, abilityText }` pair reachable in the snapshot into `target`.
 *
 * The engine projects `abilityText` onto hero-card `UICardDisplay` entries (WP-315), which
 * ride the snapshot inside per-zone display arrays. A structural deep walk keyed on the
 * presence of a string `abilityText` finds them wherever they sit without the client needing
 * to know the exact zone shape. First writer wins (all copies of a card share one text).
 */
function collectAbilityTextInto(
  value: unknown,
  target: Map<string, string>,
  depth: number,
): void {
  if (depth > ABILITY_TEXT_WALK_MAX_DEPTH || value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectAbilityTextInto(item, target, depth + 1);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  const extId = record['extId'];
  const abilityText = record['abilityText'];
  if (typeof extId === 'string' && typeof abilityText === 'string' && !target.has(extId)) {
    target.set(extId, abilityText);
  }
  for (const key of Object.keys(record)) {
    collectAbilityTextInto(record[key], target, depth + 1);
  }
}

/**
 * Builds an ext_id → ability-text resolver from the snapshot's own projected card display.
 *
 * @param snapshotRecord The audience-filtered UIState snapshot (already narrowed to a record).
 * @returns A resolver returning the printed text for an ext_id, or null when absent.
 */
function buildSnapshotAbilityTextResolver(
  snapshotRecord: Record<string, unknown>,
): (extId: string) => string | null {
  const abilityTextByExtId = new Map<string, string>();
  collectAbilityTextInto(snapshotRecord, abilityTextByExtId, 0);
  return (extId: string): string | null => abilityTextByExtId.get(extId) ?? null;
}

// why: the log lines this parses are the engine's `G.messages` prose (D-24017), projected
// to UIState.log. WP-328 prefixes every line with "{turn}.{step}.{action} " and WP-323/324
// enriched the played label to "{Name} ({ext-id}) — {effect}", so the parse must tolerate an
// optional numeric prefix and capture the whole label, then extract the real ext-id below.
const PLAYED_LINE = /^(?:\d+\.\d+\.\d+ )?Player \d+ played (.+?)\.$/;
const DID_NOT_ACTIVATE_LINE = / ability did not activate/;

// why: WP-323/324 render the played label as "{Name} ({ext-id})", and WP-417 (D-24237)
// appends an optional printed-icon clause "(+N recruit)" / "(+N attack, +N recruit)" and/or
// an effect clause " — {effect}" — so a played label can now carry MORE than one
// parenthesized group. The ext-id is the first group whose content is ext-id-SHAPED
// (lowercase-alnum start, no spaces): that skips the "(+1 recruit)" economy clause (it
// starts with '+' and contains a space) and any parens inside the effect text. The prior
// regex anchored on the end and captured the LAST group, which after WP-417 grabbed
// "+1 recruit" instead of the ext-id (observed in a live freeze diagnostic:
// recentlyPlayedCards[].extId === "+1 recruit"). Fall back to the whole label for a legacy
// raw-id line with no such group. (The durable fix is the WP-B.3 structured log-outcome
// contract, which removes prose-parsing entirely.)
const PLAYED_LABEL_EXTID = /\(([a-z0-9][^)\s]*)\)/;

/**
 * Extracts the card ext-id from an enriched `played` label, or returns the label unchanged
 * when it carries no ext-id-shaped `({ext-id})` group (a legacy raw-id line).
 */
function extractPlayedExtId(label: string): string {
  const match = PLAYED_LABEL_EXTID.exec(label);
  return match !== null ? match[1]! : label;
}

/**
 * Classifies a played card's outcome from the signals already in the snapshot.
 * Priority: a paired "did not activate" line → conditionNotMet; else a hollow record for
 * the ext_id → hollow; else if it is the most-recent play and a choice is pending →
 * awaitingChoice; else resolved (the default — the absence of a negative signal, NOT a
 * positive engine confirmation).
 */
function classifyOutcome(
  extId: string,
  followingLines: string[],
  hollowCardIds: Set<string>,
  isMostRecentPlay: boolean,
  awaitingPlayerInput: AwaitingPlayerInput | null,
): PlayedCardOutcome {
  for (const line of followingLines) {
    if (line.includes(extId) && DID_NOT_ACTIVATE_LINE.test(line)) {
      return 'conditionNotMet';
    }
  }
  if (hollowCardIds.has(extId)) {
    return 'hollow';
  }
  if (isMostRecentPlay && awaitingPlayerInput !== null) {
    return 'awaitingChoice';
  }
  return 'resolved';
}

/**
 * Builds the effect-provenance block from a diagnostic UIState snapshot.
 *
 * Pure and fail-soft: a null/malformed snapshot yields an empty provenance; a resolver
 * that throws or returns null yields `abilityText: null`. Never throws (the export must
 * stay robust).
 *
 * @param snapshot The audience-filtered UIState snapshot (opaque `unknown`).
 * @param resolveCardText Optional ext_id → ability-text resolver override. When omitted, the
 *   text is read from the snapshot's own projected card display (WP-315 / D-24101: the engine
 *   projects `UICardDisplay.abilityText` for hero cards, so the played card's printed text
 *   already rides the snapshot). The parameter stays for tests / future sources.
 * @returns The `{ awaitingPlayerInput, recentlyPlayedCards }` block.
 */
export function buildEffectProvenance(
  snapshot: unknown,
  resolveCardText?: (extId: string) => string | null,
): EffectProvenance {
  const snapshotRecord = asRecord(snapshot);
  if (snapshotRecord === null) {
    return { awaitingPlayerInput: null, recentlyPlayedCards: [] };
  }

  const awaitingPlayerInput = readAwaitingPlayerInput(snapshotRecord);
  const hollowCardIds = collectHollowCardIds(snapshotRecord);
  // why: WP-315 — with no override, read each played card's printed text from the snapshot's
  // own projected display (the engine now embeds `abilityText` on hero-card `UICardDisplay`),
  // so the client needs no card-text source of its own — boundary purity (EC-260) preserved.
  const resolveText = resolveCardText ?? buildSnapshotAbilityTextResolver(snapshotRecord);

  const log = snapshotRecord['log'];
  const logLines: string[] = Array.isArray(log)
    ? log.filter((line): line is string => typeof line === 'string')
    : [];

  // why: collect the ext_id + log index of every "played …" line, then keep the last N.
  const playedEntries: Array<{ extId: string; lineIndex: number }> = [];
  for (let index = 0; index < logLines.length; index += 1) {
    const match = PLAYED_LINE.exec(logLines[index]!);
    if (match !== null) {
      playedEntries.push({ extId: extractPlayedExtId(match[1]!), lineIndex: index });
    }
  }
  const recentEntries = playedEntries.slice(-RECENTLY_PLAYED_CARDS_CAP);

  const recentlyPlayedCards: RecentlyPlayedCard[] = [];
  for (let entryIndex = 0; entryIndex < recentEntries.length; entryIndex += 1) {
    const entry = recentEntries[entryIndex]!;
    const isMostRecentPlay = entryIndex === recentEntries.length - 1;
    const followingLines = logLines.slice(entry.lineIndex + 1);
    // why: fail-soft — a resolver that throws must not break the export.
    let abilityText: string | null = null;
    try {
      abilityText = resolveText(entry.extId);
    } catch {
      abilityText = null;
    }
    recentlyPlayedCards.push({
      extId: entry.extId,
      abilityText,
      outcome: classifyOutcome(
        entry.extId,
        followingLines,
        hollowCardIds,
        isMostRecentPlay,
        awaitingPlayerInput,
      ),
    });
  }

  return { awaitingPlayerInput, recentlyPlayedCards };
}
