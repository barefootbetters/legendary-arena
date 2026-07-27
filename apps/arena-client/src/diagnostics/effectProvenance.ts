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
 *   lines, each card's ext_id, an `outcome` READ from the engine-authored
 *   `LogEntry.outcome` (WP-434 / WP-B.3c): a hollow record → `hollow`, a `blocked` line
 *   in the card's own play-window → `conditionNotMet`, a pending choice → `awaitingChoice`,
 *   else `resolved`. No longer a "did not activate" string-guess (the D-24100 heuristic is
 *   retired). Card *identification* still parses the "played …" line — only the *outcome*
 *   determination became authoritative. `abilityText` is populated via an injected resolver.
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

// why: WP-438 — the ext-id now comes from the structured `LogEntry.card`; the primary
// path never parses prose. This is the MINIMAL fallback used ONLY for a `card`-less
// LEGACY saved snapshot (recorded before WP-438): pull the first ext-id-shaped
// `({ext-id})` group from the played label. It replaces the fragile WP-417-era
// `PLAYED_LABEL_EXTID` extractor (which grabbed "+1 recruit" from the economy clause) —
// live snapshots never reach it. Falls back to the whole label if no such group exists.
function legacyLabelExtId(label: string): string {
  const match = /\(([a-z0-9][^)\s]*)\)/.exec(label);
  return match !== null ? match[1]! : label;
}

/**
 * Classifies a played card's outcome by READING the engine-authored `LogEntry.outcome`
 * (WP-434 / D-24253) — no longer a string-matching guess (WP-B.3c retires the D-24100
 * heuristic). Priority, HOLLOW-FIRST: a hollow record for the ext_id → hollow; else a
 * `blocked` line naming this card within its own play-window → conditionNotMet; else the
 * most-recent play with a pending choice → awaitingChoice; else resolved (the default —
 * the 4-value taxonomy has no "unknown", but `resolved` is now reached only after the
 * authoritative blocked/hollow/pending checks, not by absence-of-a-string).
 */
function classifyOutcome(
  extId: string,
  windowRecords: ReadonlyArray<{ text: string; outcome: string; card?: string }>,
  hollowCardIds: Set<string>,
  isMostRecentPlay: boolean,
  awaitingPlayerInput: AwaitingPlayerInput | null,
): PlayedCardOutcome {
  // why: WP-B.3c — hollow-first. A hollow effect ALSO logs a `blocked` "Unhandled effect
  // observed: card …" line naming this card, so a blocked-first order would flip every
  // hollow to conditionNotMet. `hollowEffects` (a structured WP-257 record read, kept)
  // is the authoritative hollow signal; the condition-fail branch never records a hollow
  // (it `continue`s), so a card is hollow XOR condition-failed — hollow-first loses nothing.
  if (hollowCardIds.has(extId)) {
    return 'hollow';
  }
  // why: WP-438 — match the card's own `blocked` line STRUCTURALLY via `record.card`
  // (retires the B.3c `(extId)` substring scan and its collision caveat). The reveal
  // "… no branch matched" line carries the REVEALED card's ext-id (≠ this played card),
  // so it never matches. `windowRecords` is already bounded to this card's play-window.
  // On a `card`-less LEGACY snapshot no record matches, so a condition-fail downgrades to
  // `resolved` (WP-438 AC-2 — accepted; live snapshots always carry `card`); the `(extId)`
  // substring is deliberately NOT reintroduced (that is the retired RS-2 fragility).
  for (const record of windowRecords) {
    if (record.outcome === 'blocked' && record.card === extId) {
      return 'conditionNotMet';
    }
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

  // why: WP-B.3c — read UIState.log as `{ text, outcome }` RECORDS (defensively, since
  // the snapshot is typed `unknown`), not a flattened `string[]`. The engine authors an
  // authoritative `outcome` on every line (WP-434), so `classifyOutcome` reads it instead
  // of string-guessing. A missing/non-string outcome defaults to `neutral` (fail-soft).
  // why: WP-438 — read UIState.log as `{ text, outcome, card? }` records. The engine
  // authors `card` (the CardExtId) on card-attributed lines, so identification and the
  // condition-fail association read it structurally instead of parsing prose.
  const log = snapshotRecord['log'];
  const logEntries: Array<{ text: string; outcome: string; card?: string }> = Array.isArray(log)
    ? log
        .map((entry): { text: string; outcome: string; card?: string } | null => {
          if (entry !== null && typeof entry === 'object') {
            const text = (entry as { text?: unknown }).text;
            const outcome = (entry as { outcome?: unknown }).outcome;
            const card = (entry as { card?: unknown }).card;
            if (typeof text !== 'string') return null;
            const base = { text, outcome: typeof outcome === 'string' ? outcome : 'neutral' };
            return typeof card === 'string' ? { ...base, card } : base;
          }
          return null;
        })
        .filter((record): record is { text: string; outcome: string; card?: string } => record !== null)
    : [];

  // why: WP-438 — enumerate "played …" lines via PLAYED_LINE (line-KIND detection stays
  // prose; a `LogEntry.kind` field is the next increment), but take the ext-id from the
  // structured `entry.card`. `legacyLabelExtId` is the fallback for a `card`-less LEGACY
  // saved snapshot only — live snapshots always carry `card`.
  const playedEntries: Array<{ extId: string; lineIndex: number }> = [];
  for (let index = 0; index < logEntries.length; index += 1) {
    const record = logEntries[index]!;
    const match = PLAYED_LINE.exec(record.text);
    if (match !== null) {
      playedEntries.push({ extId: record.card ?? legacyLabelExtId(match[1]!), lineIndex: index });
    }
  }

  // why: keep the last N plays; iterate over the full `playedEntries` (not a slice) so
  // each card's play-window end is the NEXT play's line index across the whole log.
  const recentStart = Math.max(0, playedEntries.length - RECENTLY_PLAYED_CARDS_CAP);
  const recentlyPlayedCards: RecentlyPlayedCard[] = [];
  for (let entryIndex = recentStart; entryIndex < playedEntries.length; entryIndex += 1) {
    const entry = playedEntries[entryIndex]!;
    const isMostRecentPlay = entryIndex === playedEntries.length - 1;
    // why: WP-B.3c (RS-2) — bound the outcome scan to THIS card's own play-window
    // [play+1, next-play), so a later card's `blocked` line cannot be attributed here.
    const windowEnd =
      entryIndex + 1 < playedEntries.length
        ? playedEntries[entryIndex + 1]!.lineIndex
        : logEntries.length;
    const windowRecords = logEntries.slice(entry.lineIndex + 1, windowEnd);
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
        windowRecords,
        hollowCardIds,
        isMostRecentPlay,
        awaitingPlayerInput,
      ),
    });
  }

  return { awaitingPlayerInput, recentlyPlayedCards };
}
