/**
 * Player Feedback & Voting — Persistence (WP-604 / EC-639 / D-24414)
 *
 * The only `pg`-touching file in the feedback module. Reads and writes the two
 * domain tables — legendary.feedback_item and legendary.feedback_vote — for the
 * four feedback endpoints: insert an item, list the public enhancement roadmap,
 * add a vote, remove a vote (plus a vote-count projection helper the routes use to
 * report the fresh tally).
 *
 * Invariants encoded here:
 *   * insert never sets `status` — the column DEFAULT ('under_review') is the only
 *     status this packet writes; no path rewrites an item's status after insert.
 *   * `vote_count` is a COUNT projection over legendary.feedback_vote, never a
 *     stored column (the DB owns the tally, D-24414).
 *   * one vote per account is the UNIQUE (feedback_item_id, account_ext_id)
 *     constraint; addVote uses ON CONFLICT DO NOTHING against it, so a repeat vote
 *     is idempotent and can never double-count.
 *   * the public list returns the enhancement kind only and strips author PII via
 *     the pure projection shaper.
 *
 * Layer-boundary contract: imports nothing from boardgame.io,
 * @legendary-arena/game-engine (runtime), @legendary-arena/registry, or any UI
 * package. The `pg` driver is reachable only through the injected DatabaseClient.
 *
 * Authority: WP-604 §Scope D; EC-639; D-24414.
 */

import type { DatabaseClient } from '../identity/identity.types.js';
import { toOperatorFeedbackItem, toPublicFeedbackItem } from './feedback.logic.js';
import {
  PUBLIC_ROADMAP_STATUSES,
  type FeedbackItemRecord,
  type FeedbackStatus,
  type OperatorFeedbackItem,
  type PublicFeedbackItem,
  type SubmitFeedbackInput,
} from './feedback.types.js';

/** The raw legendary.feedback_item row shape as node-pg returns it (snake_case). */
interface FeedbackItemRow {
  id: string | number;
  feedback_type: FeedbackItemRecord['feedbackType'];
  title: string;
  description: string;
  author_ext_id: string;
  status: FeedbackStatus;
  resolution_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Convert a timestamptz value (a Date from node-pg, or a string) to an ISO string.
 *
 * @param value The raw timestamp value from a row.
 * @returns The ISO-8601 string form.
 */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Map a raw legendary.feedback_item row to the camelCase FeedbackItemRecord. The
 * bigserial `id` arrives as a string from node-pg (bigint) and is converted to a
 * number here — feedback item ids stay well within the safe-integer range.
 *
 * @param row The raw snake_case row.
 * @returns The mapped record.
 */
function mapFeedbackItemRow(row: FeedbackItemRow): FeedbackItemRecord {
  return {
    id: typeof row.id === 'string' ? Number(row.id) : row.id,
    feedbackType: row.feedback_type,
    title: row.title,
    description: row.description,
    authorExtId: row.author_ext_id,
    status: row.status,
    resolutionReason: row.resolution_reason,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

/**
 * Insert a new feedback item and return the persisted record. The `status` column
 * is deliberately omitted from the INSERT so the table DEFAULT ('under_review')
 * applies — this packet never writes any other status.
 *
 * @param database The caller-injected `pg` pool.
 * @param input The validated submission (type, trimmed title, trimmed description).
 * @param authorExtId The submitting account's ext_id (= legendary.players.ext_id).
 * @returns The persisted feedback item record.
 */
export async function insertFeedbackItem(
  database: DatabaseClient,
  input: SubmitFeedbackInput,
  authorExtId: string,
): Promise<FeedbackItemRecord> {
  const result = await database.query(
    'INSERT INTO legendary.feedback_item ' +
      '(feedback_type, title, description, author_ext_id) ' +
      'VALUES ($1, $2, $3, $4) ' +
      'RETURNING id, feedback_type, title, description, author_ext_id, ' +
      'status, resolution_reason, created_at, updated_at',
    [input.type, input.title, input.description, authorExtId],
  );
  return mapFeedbackItemRow(result.rows[0] as FeedbackItemRow);
}

/** Options for the public enhancement list read. */
export interface ListPublicEnhancementsOptions {
  /** Statuses to include; defaults to the public roadmap set when omitted. */
  readonly statusFilter?: readonly FeedbackStatus[];
  /** The identified viewer's ext_id, when a session token resolved one. */
  readonly viewerExtId?: string;
}

/**
 * List the public roadmap: enhancement items with a projected `voteCount` and a
 * per-viewer `viewerHasVoted`, ordered most-voted first then newest. Restricted to
 * the enhancement kind only — bug and review rows never surface publicly, and the
 * projection shaper strips author PII. When `statusFilter` is omitted it defaults
 * to the public roadmap statuses (planned / in_progress / shipped), so raw
 * 'under_review' intake and 'declined' items are hidden by default.
 *
 * @param database The caller-injected `pg` pool.
 * @param options Optional status filter + the identified viewer's ext_id.
 * @returns The redacted public items, most-voted first.
 */
export async function listPublicEnhancements(
  database: DatabaseClient,
  options: ListPublicEnhancementsOptions = {},
): Promise<PublicFeedbackItem[]> {
  const statusFilter = options.statusFilter ?? PUBLIC_ROADMAP_STATUSES;
  // why: a null viewer makes `fv.account_ext_id = $2` NULL for every row, so
  // BOOL_OR yields NULL and COALESCE returns false — a guest sees viewerHasVoted
  // false everywhere without a separate query path.
  const viewerExtId = options.viewerExtId ?? null;

  const result = await database.query(
    'SELECT ' +
      'fi.id, fi.feedback_type, fi.title, fi.description, fi.author_ext_id, ' +
      'fi.status, fi.resolution_reason, fi.created_at, fi.updated_at, ' +
      'COUNT(fv.id) AS vote_count, ' +
      'COALESCE(BOOL_OR(fv.account_ext_id = $2), false) AS viewer_has_voted ' +
      'FROM legendary.feedback_item fi ' +
      'LEFT JOIN legendary.feedback_vote fv ON fv.feedback_item_id = fi.id ' +
      "WHERE fi.feedback_type = 'enhancement' " +
      'AND fi.status = ANY($1::text[]) ' +
      'GROUP BY fi.id ' +
      'ORDER BY COUNT(fv.id) DESC, fi.created_at DESC',
    [statusFilter, viewerExtId],
  );

  const items: PublicFeedbackItem[] = [];
  for (const rawRow of result.rows) {
    const row = rawRow as FeedbackItemRow & {
      vote_count: string | number;
      viewer_has_voted: boolean;
    };
    const record = mapFeedbackItemRow(row);
    const voteCount =
      typeof row.vote_count === 'string' ? Number(row.vote_count) : row.vote_count;
    items.push(toPublicFeedbackItem(record, voteCount, row.viewer_has_voted));
  }
  return items;
}

/**
 * Count the votes for one feedback item — the COUNT projection the vote routes use
 * to report the fresh tally after an add/remove. There is no stored counter; this
 * is the single source of truth for a vote_count.
 *
 * @param database The caller-injected `pg` pool.
 * @param itemId The feedback item id.
 * @returns The current vote count for the item (0 when none).
 */
export async function countVotesForItem(
  database: DatabaseClient,
  itemId: number,
): Promise<number> {
  const result = await database.query(
    'SELECT COUNT(id) AS vote_count FROM legendary.feedback_vote ' +
      'WHERE feedback_item_id = $1',
    [itemId],
  );
  const raw = result.rows[0]?.vote_count as string | number | undefined;
  if (raw === undefined) {
    return 0;
  }
  return typeof raw === 'string' ? Number(raw) : raw;
}

/**
 * Add one vote for an item by an account. Idempotent via ON CONFLICT DO NOTHING
 * against the UNIQUE (feedback_item_id, account_ext_id) constraint: a repeat vote
 * by the same account returns 'already_voted' without double-counting. A vote for a
 * non-existent item trips the foreign-key constraint, reported as 'no_such_item'.
 *
 * @param database The caller-injected `pg` pool.
 * @param itemId The feedback item id being voted for.
 * @param accountExtId The voting account's ext_id.
 * @returns 'added' on a new vote, 'already_voted' on a repeat, 'no_such_item' when
 *   the item does not exist.
 */
export async function addVote(
  database: DatabaseClient,
  itemId: number,
  accountExtId: string,
): Promise<'added' | 'already_voted' | 'no_such_item'> {
  try {
    const result = await database.query(
      'INSERT INTO legendary.feedback_vote (feedback_item_id, account_ext_id) ' +
        'VALUES ($1, $2) ' +
        'ON CONFLICT (feedback_item_id, account_ext_id) DO NOTHING ' +
        'RETURNING id',
      [itemId, accountExtId],
    );
    return result.rows.length > 0 ? 'added' : 'already_voted';
  } catch (caughtError) {
    // why: Postgres SQLSTATE 23503 is foreign_key_violation — the referenced
    // feedback_item does not exist. That is an expected caller-facing outcome (404),
    // not an internal fault, so translate it rather than letting it surface as a 500.
    // Any other error is a genuine fault and re-throws.
    if ((caughtError as { code?: string }).code === '23503') {
      return 'no_such_item';
    }
    throw caughtError;
  }
}

/**
 * Remove an account's vote for an item. Returns 'removed' when a vote was deleted,
 * or 'not_voted' when the account had no vote on the item (a no-op).
 *
 * @param database The caller-injected `pg` pool.
 * @param itemId The feedback item id.
 * @param accountExtId The voting account's ext_id.
 * @returns 'removed' when a vote was deleted, 'not_voted' otherwise.
 */
export async function removeVote(
  database: DatabaseClient,
  itemId: number,
  accountExtId: string,
): Promise<'removed' | 'not_voted'> {
  const result = await database.query(
    'DELETE FROM legendary.feedback_vote ' +
      'WHERE feedback_item_id = $1 AND account_ext_id = $2 ' +
      'RETURNING id',
    [itemId, accountExtId],
  );
  return result.rows.length > 0 ? 'removed' : 'not_voted';
}

/**
 * List EVERY feedback item for the operator triage queue — all types (bug /
 * enhancement / review) and all statuses, each with its projected `voteCount`,
 * newest first. This is the operator-only read (WP-605 / D-24416): it applies no
 * type filter and no PII strip, so it must only ever be reached behind the admin
 * gate; it is NOT the public `listPublicEnhancements`.
 *
 * @param database The caller-injected `pg` pool.
 * @returns Every feedback item as an operator projection, newest first.
 */
export async function listAllFeedbackItems(
  database: DatabaseClient,
): Promise<OperatorFeedbackItem[]> {
  const result = await database.query(
    'SELECT ' +
      'fi.id, fi.feedback_type, fi.title, fi.description, fi.author_ext_id, ' +
      'fi.status, fi.resolution_reason, fi.created_at, fi.updated_at, ' +
      'COUNT(fv.id) AS vote_count ' +
      'FROM legendary.feedback_item fi ' +
      'LEFT JOIN legendary.feedback_vote fv ON fv.feedback_item_id = fi.id ' +
      'GROUP BY fi.id ' +
      'ORDER BY fi.created_at DESC',
    [],
  );

  const items: OperatorFeedbackItem[] = [];
  for (const rawRow of result.rows) {
    const row = rawRow as FeedbackItemRow & { vote_count: string | number };
    const record = mapFeedbackItemRow(row);
    const voteCount =
      typeof row.vote_count === 'string' ? Number(row.vote_count) : row.vote_count;
    items.push(toOperatorFeedbackItem(record, voteCount));
  }
  return items;
}

/**
 * Author an item's status — the ONLY code path in the codebase that writes
 * `feedback_item.status` / `resolution_reason` / advances `updated_at` (WP-605 /
 * D-24416; WP-604 / EC-639 deferred all status authoring to this writer). The
 * caller (the pure validator) has already enforced the closed status set and the
 * Declined-requires-a-reason rule, so `status` and `resolutionReason` are trusted
 * here. Returns the updated record, or `null` when no item matches the id.
 *
 * @param database The caller-injected `pg` pool.
 * @param itemId The feedback item to update.
 * @param status The new status (a validated FeedbackStatus).
 * @param resolutionReason The reason (non-empty on Declined; `null` otherwise).
 * @returns The updated record, or `null` when the id does not exist.
 */
export async function updateFeedbackItemStatus(
  database: DatabaseClient,
  itemId: number,
  status: FeedbackStatus,
  resolutionReason: string | null,
): Promise<FeedbackItemRecord | null> {
  const result = await database.query(
    'UPDATE legendary.feedback_item ' +
      'SET status = $2, resolution_reason = $3, updated_at = now() ' +
      'WHERE id = $1 ' +
      'RETURNING id, feedback_type, title, description, author_ext_id, ' +
      'status, resolution_reason, created_at, updated_at',
    [itemId, status, resolutionReason],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapFeedbackItemRow(result.rows[0] as FeedbackItemRow);
}
