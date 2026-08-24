/**
 * Endgame AI Coach — Types (WP-594 / EC-629 / D-24403)
 *
 * Durable contracts for the Legendary-Pass endgame coach: the match summary fed
 * to the model, the coaching report it returns, the persisted cache row, and the
 * typed request result. The coach is a Pass-gated, lazy-on-demand, cached Claude
 * call that reads a finished match and returns opinionated advice (hero-fit vs
 * the scheme/mastermind, a critique of what was acquired, 2-3 concrete next-time
 * tips). It complements the free, deterministic WP-593 report card.
 *
 * Layer/boundary: server layer only. Engine imports are type-only (the reduced
 * final `G` is read via the WP-336 replay reducer). The report is a DERIVED,
 * read-only advisory artifact — never runtime `G`/`ctx`, never hashed, never a
 * score-row column, never affects score or gameplay (D-24403).
 *
 * Authority: WP-594 §Contract; EC-629 §Locked Values; D-24403.
 */

import type { DatabaseClient } from '../identity/identity.types.js';

/**
 * One player's contribution + the hero cards they acquired during the match, for
 * the coach's per-player read. `acquiredCards` is the hero cards that entered the
 * player's deck (deck + hand + discard + in-play, minus the fixed starting deck
 * and Wounds) — i.e. what they bought/gained, the input to the purchase critique.
 * The victory pile (KO'd enemies + rescued bystanders) is deliberately excluded.
 */
export interface CoachPlayerLine {
  readonly label: string;
  readonly victoryPoints: number;
  readonly bystandersRescued: number;
  /** Acquired hero cards as "Display Name ×N" strings, most-acquired first. */
  readonly acquiredCards: readonly string[];
}

/**
 * The compact, display-name-resolved match summary handed to the model. Every
 * field is server-generated from the registry + the reduced final state + the
 * stored score breakdown — NO player free-text enters it, so there is no
 * prompt-injection surface.
 */
export interface CoachMatchSummary {
  readonly outcome: 'heroes-win' | 'scheme-wins' | 'tie';
  readonly playerCount: number;
  readonly rounds: number;
  /** The scenario the players faced, resolved to display names. */
  readonly scheme: string;
  readonly mastermind: string;
  readonly villainGroups: readonly string[];
  readonly henchmanGroups: readonly string[];
  /** The hero decks available in this match (the selection being critiqued). */
  readonly heroes: readonly string[];
  readonly rawScore: number;
  readonly finalScore: number;
  /** Lower-is-better grade token for the final score (e.g. "a", "b"). */
  readonly grade: string;
  /** Team totals across all players (a shared-team score). */
  readonly team: {
    readonly victoryPoints: number;
    readonly bystandersRescued: number;
  };
  /** The adversity the match actually dealt (for the model's luck read). */
  readonly adversity: {
    readonly schemeTwists: number;
    readonly villainsEscaped: number;
    readonly bystandersLost: number;
  };
  /** What this scenario's PAR expects (absent for pre-WP-591 scored rows). */
  readonly adversityExpected?: {
    readonly schemeTwists: number;
    readonly villainsEscaped: number;
    readonly bystandersLost: number;
  };
  readonly perPlayer: readonly CoachPlayerLine[];
}

/**
 * The coaching report the model returns and the client renders verbatim. Bounded
 * to the WP-B1 scope: hero-fit, a purchases critique, and 2-3 concrete tips.
 */
export interface CoachReport {
  /** One-line takeaway. */
  readonly headline: string;
  /** How the hero selection fit this scheme + mastermind. */
  readonly heroFit: string;
  /** A critique of what was acquired and what would have served better. */
  readonly purchases: string;
  /** 2-3 concrete "next time" suggestions. */
  readonly suggestions: readonly string[];
}

/**
 * A persisted coach report (the cache row shape). `report` is the model output;
 * `model` pins which model produced it; `generatedAt` is the ISO timestamp.
 */
export interface StoredCoachReport {
  readonly report: CoachReport;
  readonly model: string;
  readonly generatedAt: string;
}

/**
 * The reasons a coach request is refused, mapped to HTTP by the route.
 * `not_entitled` → 403 (no Legendary Pass); `not_owner` → 403; `not_found` →
 * 404 (no such scored replay for this caller); `coach_unavailable` → 503
 * (the model call failed — a fail-soft, retriable signal, never a card blocker).
 */
export type CoachRefusalReason =
  | 'not_entitled'
  | 'not_owner'
  | 'not_found'
  | 'coach_unavailable';

/**
 * The typed result of a coach request. `ok: true` carries the (fresh or cached)
 * report + whether it was served from cache; `ok: false` carries a typed reason.
 * Never throws for an expected failure — infrastructure faults propagate.
 */
export type CoachResult =
  | { ok: true; report: StoredCoachReport; wasCached: boolean }
  | { ok: false; reason: CoachRefusalReason };

/**
 * The injected model client. The real implementation calls Anthropic; tests pass
 * a stub, so the whole coach pipeline is exercised with ZERO paid calls. The
 * client resolves a summary to a report or throws (the orchestrator catches the
 * throw and returns `coach_unavailable` — fail-soft).
 */
export interface CoachModelClient {
  /** The model id this client uses (persisted with the report). */
  readonly model: string;
  generate(summary: CoachMatchSummary): Promise<CoachReport>;
}

/** Resolve a set-qualified ext_id to its registry display name (or the ext_id). */
export type ResolveCardName = (extId: string) => string;

/**
 * The caller-injected dependencies for the coach orchestrator. Every external
 * surface is injected so the orchestrator is unit-testable with fakes (no real
 * database, no real model call).
 */
export interface CoachDependencies {
  readonly database: DatabaseClient;
  readonly modelClient: CoachModelClient;
  readonly resolveCardName: ResolveCardName;
}
