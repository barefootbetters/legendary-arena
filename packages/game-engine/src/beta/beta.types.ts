/**
 * Public-beta metadata type contracts for the Legendary Arena game engine.
 *
 * why: feedback tied to build version for traceability; replay reference
 * enables reproduction.
 *
 * These types describe metadata artifacts produced by controlled public-beta
 * participants — structured feedback records, cohort identifiers, and
 * feedback category labels. `BetaFeedback` is metadata-not-state: it never
 * enters `G`, is never constructed or mutated by the engine at runtime, and
 * must never appear as a field of `LegendaryGameState`. Construction,
 * transport, and persistence of `BetaFeedback` instances live in the
 * server layer or future ops tooling per the D-3701 sub-rule. Beta games
 * run the same deterministic engine as production — no "beta mode" exists.
 *
 * Pure type definitions only. No runtime values, no behavior.
 * Engine-category invariants apply per D-3701: see D-3701 in
 * `docs/ai/DECISIONS.md` for the full list of forbidden imports, I/O
 * surfaces, wall-clock reads, and randomness sources.
 *
 * See `docs/beta/BETA_STRATEGY.md` and `docs/beta/BETA_EXIT_CRITERIA.md`
 * for the strategy these types support.
 */

// why: All six required fields plus one optional field. Field order is
// locked — `sessionId`, `buildVersion`, `category`, `description`,
// `severity`, `reproductionReplayId` — and must not be alphabetized,
// grouped, or renamed (EC-037 §Locked Values). D-1232 applies: plain-object
// shape, JSON-serializable, no `Map` / `Set` / `Date` / functions / class
// instances. Feedback tied to build version — unversioned feedback is
// discarded by downstream collectors (WP-037 §Non-Negotiable). The
// optional `reproductionReplayId` references the WP-027 replay harness to
// enable deterministic reproduction of the reported symptom without
// perturbing the replay itself.

/**
 * Structured feedback record emitted by a beta participant.
 *
 * Metadata-not-state: the engine never constructs, reads, or mutates an
 * instance of this type. Construction and transport live in the server
 * layer or future ops tooling per the D-3701 sub-rule. The `severity`
 * field is a closed numeric union (`1 | 2 | 3`) — widening to a fourth
 * level requires a new `DECISIONS.md` entry.
 *
 * Field order is locked by EC-037 §Locked Values.
 */
export interface BetaFeedback {
  /** Opaque identifier for the gameplay session that produced this feedback. */
  sessionId: string;
  /** Engine+data+content build version the feedback was captured against. */
  buildVersion: string;
  /** Feedback category — matches the five-member `FeedbackCategory` union. */
  category: 'rules' | 'ui' | 'balance' | 'performance' | 'confusion';
  /** Human-authored description of the observed behavior or concern. */
  description: string;
  /** Severity level: `1` highest urgency, `3` lowest. Closed numeric union. */
  severity: 1 | 2 | 3;
  /** Optional replay harness reference for deterministic reproduction. */
  reproductionReplayId?: string;
}

// why: Three cohorts in signal-target order: `expert-tabletop` (rules-aware,
// edge-case focused), `general-strategy` (UX, clarity, onboarding signal),
// `passive-observer` (spectator and replay usability). Union member order
// is locked (EC-037 §Locked Values) to match the cohort ordering in
// `docs/beta/BETA_STRATEGY.md`. Adding a fourth cohort requires a new
// D-entry and a coordinated documentation update — this is a governance
// change, not a silent code change (WP-037 §Vision Alignment: NG-1 / NG-3
// proximity is locked behind governance events, never by payer status).

/**
 * Closed union of the three beta participant cohorts.
 *
 * Ordered to match the signal-target sequence documented in
 * `docs/beta/BETA_STRATEGY.md`:
 *   - `expert-tabletop`: rules-aware, edge-case focused.
 *   - `general-strategy`: UX, clarity, onboarding signal.
 *   - `passive-observer`: spectator and replay usability.
 *
 * Cohorts partition participants by expertise and role only — never by
 * payer status, ownership, or paid-tier intent (Vision NG-1, NG-3).
 */
export type BetaCohort =
  | 'expert-tabletop'
  | 'general-strategy'
  | 'passive-observer';

// why: Five categories matching the `BetaFeedback.category` field
// verbatim. Widening or reordering requires a new D-entry — this is a
// governance change, not a code change. The inline union on
// `BetaFeedback.category` is a deliberate verbatim lock per EC-037
// §Locked Values; do not refactor into a `FeedbackCategory` reference
// inside the interface definition.

/**
 * Closed union of the five supported beta feedback categories.
 *
 * Ordered to match the exit-criteria layout in
 * `docs/beta/BETA_EXIT_CRITERIA.md` (rules correctness → UX clarity →
 * balance perception → stability, with `confusion` tracked as a UX
 * sub-signal). Widening requires a new `DECISIONS.md` entry.
 */
export type FeedbackCategory =
  | 'rules'
  | 'ui'
  | 'balance'
  | 'performance'
  | 'confusion';
