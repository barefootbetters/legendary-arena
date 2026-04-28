# WP-109 — Team Affiliation (Profile-Level Cooperative Cohorts)

**Status:** Draft (drafted 2026-04-26; lint-gate self-review **PASS** —
see `## Lint Self-Review` at foot; pre-flight pending). Listed in
`WORK_INDEX.md` as a deferred placeholder pending WP-104.

**Primary Layer:** Server (persistence) + App (read surfaces on profile
page). No engine, registry, or pre-planning code.

**Dependencies:**
- **Hard:** WP-104 (Player Profile Core & Owner-Editable Extensions) —
  this WP extends the profile schema introduced by WP-104 and lives in
  the same migration / table family. WP-104 is presently a deferred
  placeholder row in `WORK_INDEX.md`; WP-109 cannot be promoted to
  executable until WP-104 lands.
- **Soft:** WP-102 (public profile page, drafted) — the read surface
  that exposes team affiliation on a player's profile reuses the
  WP-102 page composition pattern.

---

## 1. Problem Statement

Legendary Arena currently models players solely as individuals, with no
persistent way to represent long-term cooperative cohorts that choose
to play together over time.

This limits:

- Narrative continuity ("this group played the 2026 year together")
- Historical attribution of cooperative play
- Profile-level identity that reflects *who you play with*, not just
  what you achieved

The user-facing analogy is a bowling-league roster: a fixed group of
players who meet and play cooperatively across a fixed window. Unlike
bowling, Legendary's cooperative gameplay scales with player count
(3-handed, 4-handed, and 5-handed games are mechanically distinct
scenarios), so this WP treats team size as a declared gameplay
parameter rather than a fixed five. The ranking-style competition
between teams that a real bowling league implies is **explicitly out
of scope** (see §3 and §4 below).

---

## 2. Goals

- Add a **team affiliation construct** to player profiles
- Support **long-term (one-year, default) cooperative commitment**
- Support the three meaningful Legendary cooperative formats —
  3-player, 4-player, and 5-player — as distinct team sizes declared
  at creation
- Preserve Legendary Arena's **non-competitive, non-MMR, async-compatible**
  architecture
- Ensure **full auditability and historical integrity** of membership
  changes

---

## 3. Non-Goals / Explicit Constraints

- No team-based rankings, ratings, ladders, or MMR
- No rewards, unlocks, badges, or incentives tied to team membership
- No engine, rules, or gameplay logic changes
- No chat, scheduling, or real-time coordination systems
- No monetization pathways
- No inter-team competitive comparison surface (the bowling-league
  analogy ends at "fixed roster across a season"; it does not extend
  to "leaderboard between teams")
- No 1-player or 2-player team formats — solo and duo cooperative
  play exist as gameplay options but do not require a persistent team
  identity to support; the team construct starts at 3

Teams are identity and historical context only.

---

## 4. Vision Alignment (Required)

**Vision clauses touched:** §3 (Player Trust & Fairness), §4 (Faithful
Multiplayer Experience — cooperative), §23(b) (Asynchronous PvP
Comparison; no in-game player-vs-player), §25 (Skill Over Repetition).

**Conflict assertion:** No conflict — this WP preserves all touched
clauses by introducing no scoring, ranking, or comparison surface.

**Non-Goal proximity check:** None of NG-1..NG-8 are crossed. The
team construct introduces no purchase, reward, gacha, energy,
ad-surface, dark-pattern, or social-influence mechanic. Team
affiliation does not unlock content, advantage, or recognition.

**Determinism preservation:** N/A — this WP touches no engine,
scoring, replay, or RNG surface.

**Decision references:**

- **D-0005** (per [DESIGN-RANKING.md:14-20](../DESIGN-RANKING.md))
  — *Asynchronous PvP Comparison Authorized; Live PvP Combat
  Forbidden.* This WP introduces no comparison surface at all (let
  alone a synchronous one), so D-0005 is preserved trivially.
- **DESIGN-RANKING.md §12** ([line 644](../DESIGN-RANKING.md))
  explicitly lists *"Team, faction, or cooperative co-op rankings"*
  as out-of-scope future work. This WP is **narrower than that**: it
  introduces team identity without any ranking projection over team
  identity. No amendment to DESIGN-RANKING is required.

If a future WP proposes to project team identity into a ranking or
comparison surface, that is a distinct design delta requiring its own
Vision review and DECISIONS.md entry — not an extension of this WP.

---

## 5. Architectural Placement

- **Ownership:** Server-side persistence layer
- **Explicitly excluded from:**
  - Game engine (`G`, `ctx`)
  - Match resolution and turn-flow
  - Deterministic replay logic
  - Registry layer
  - Pre-planning layer
- **Data classification:** observational, not rule-bearing. A failure
  in this layer can never affect run correctness, replay verification,
  or any scoring surface.
- Mirrors the same layer-boundary model as ranking aggregation (see
  [DESIGN-RANKING.md §4.1](../DESIGN-RANKING.md)).

---

## 6. Concept Definition

### Team (Cohort)

A **Team** represents a named, time-bounded cooperative cohort that
plays a specific Legendary format together.

- **Team size**: declared at creation as one of `3 | 4 | 5`. Immutable
  for the lifetime of the team — a team cannot be resized after
  creation. Resizing requires retiring the team and creating a new
  one.
- **Members**: exactly `teamSize` core members at full roster.
- **Substitutes**: up to `min(2, teamSize − 2)` substitutes (1 for
  3-player teams, 2 for 4- and 5-player teams).
- **Fixed duration**: default one calendar year.

Teams are independent of individual runs or scenarios. A team's
existence neither requires nor implies any specific number of
cooperative runs played together.

> **Why size is declared and immutable:** Legendary's cooperative
> gameplay scales with player count — villain row width, attack
> values, and several scenario constraints are sized to the table.
> A "team" that drifts between 3-handed and 5-handed play is not a
> coherent cohort in the gameplay sense. Locking size at creation
> keeps the team identity tied to a specific format.

---

## 7. Data Model (Authoritative)

### Team Entity

```ts
Team {
  teamId: string                       // immutable
  name: string
  cohortLabel: string                  // e.g. "2026 Cohort"
  teamSize: 3 | 4 | 5                  // immutable; declared at creation
  startDate: ISODate
  endDate: ISODate
  status: 'active' | 'completed' | 'retired'

  captainPlayerId: string

  members: {
    playerId: string
    role: 'member' | 'substitute'
    joinedAt: ISODate
    leftAt?: ISODate
  }[]

  visibility: 'public' | 'friends' | 'private'
}
```

> **Why `cohortLabel` and not `seasonLabel`:** the term "Season" is
> already a bound concept in
> [DESIGN-RANKING.md §2](../DESIGN-RANKING.md) (a fixed Jan 1 – Dec 31
> ranking window). Two parallel "season" concepts will diverge. A
> team's window is calendar-aligned by default but conceptually
> independent of the ranking season; `cohortLabel` is the
> non-colliding name.

### Player Profile Extension (via WP-104)

```ts
teamAffiliations: {
  teamId: string
  teamSize: 3 | 4 | 5                  // denormalized for display
  role: 'member' | 'substitute'
  joinedAt: ISODate
  leftAt?: ISODate
}[]
```

This field is added to the owner-editable profile shape introduced by
WP-104. The denormalization (including `teamSize`) is intentional: it
makes "show this player's teams" a single-row read on the profile,
rather than a join across the team-membership table for every render.

---

## 8. Membership Semantics

### 8.1 Roster constraints (parameterized by `teamSize`)

| `teamSize` | Members at full roster | Max substitutes |
|------------|------------------------|-----------------|
| 3          | 3                      | 1               |
| 4          | 4                      | 2               |
| 5          | 5                      | 2               |

### 8.2 Validity rule (generalized)

A team is **valid** (eligible to remain in `active` status) if:

- `liveMembers ≥ teamSize − 2`, AND
- `liveMembers + liveSubs ≥ teamSize − 1`

Where `liveMembers` and `liveSubs` count members and substitutes whose
`leftAt` is unset.

Concrete expansion:

| `teamSize` | Validity (equivalent statements)                         |
|------------|----------------------------------------------------------|
| 5          | ≥4 members, OR ≥3 members + ≥1 substitute                |
| 4          | ≥3 members, OR ≥2 members + ≥1 substitute                |
| 3          | ≥2 members, OR ≥1 member + ≥1 substitute                 |

The 3-player case allows a thinner roster (1 member + 1 sub) by
design; 3-player teams have less roster headroom and the grace-of-one
rule preserves continuity through a single departure.

### 8.3 Promotion semantics

- **Promotion is explicit only.** Two events are required:
  1. Departing member's `leftAt` is set
  2. A substitute's `role` updates from `'substitute'` to `'member'`
     in a separate event record
- No implicit or automatic promotion on departure. The captain (or an
  operator under §9) must take the action.

### 8.4 Acceptance constraint

- Initial creation requires explicit acceptance by every initial
  member (§10 Creation). No silent enrollment.

---

## 9. Authority & Overrides

- The **captain** may:
  - Rename the team
  - Change the team `visibility`
  - Initiate invitations
  - Record membership changes (joins, departures, role promotions)
  - Initiate transition to `completed` before `endDate`
- **Operator override** (admin) may:
  - Reassign the captain (e.g., when a captain becomes inactive)
  - Force-retire a team
  - Correct clerical errors in membership records via amendment
    (mirrors [DESIGN-RANKING.md §10.2](../DESIGN-RANKING.md) archive
    amendment pattern: new record with new identifier, never in-place
    edit)
- Every override action requires a recorded `reason` text and operator
  identity, preserved on the event log.

This prevents deadlock if a captain becomes inactive mid-cohort while
keeping all mutations attributable.

---

## 10. Lifecycle

### Creation

- Initiated by captain
- Captain declares `teamSize` at creation; the field is immutable for
  the team's lifetime
- Requires explicit acceptance by every initial member (no
  silent enrollment)
- Team enters `active` status

### Active Changes

- Membership changes require explicit events (timestamped, attributed,
  optional `reason`)
- Historical entries are preserved verbatim — no in-place edits
- `teamSize` is **not** an active-change target. A captain who wants
  to play a different format must retire the current team and create
  a new one.

### Completion

- At `endDate`, status auto-transitions to `completed`
- Roster becomes read-only

### Retirement

- Manual terminal state for abandoned or dissolved cohorts
- Data remains visible based on `visibility`

---

## 11. Visibility Rules

`visibility` is a three-state enum on the Team entity:

- `public` — visible to all
- `friends` — visible to mutual connections of any current member
- `private` — visible only to current and historical members

No ACL matrices, no per-field permissions. The historical "friends-of"
graph is not part of this WP — `friends` semantics depend on a
friend-graph surface that does not yet exist; if WP-109 lands before
that surface, `friends` collapses to `private` until the graph exists.
That fallback is an implementation detail to confirm at execution-time
pre-flight.

---

## 12. Team-Play Attribution (Deferred but Intentional)

This WP defines *who is affiliated with whom*, not how cooperative
play is attributed.

To fulfill the broader goal of **tracking team play**, a follow-on
projection is anticipated but not in scope here:

> When ≥2 active members of the same team appear in a cooperative
> run **of the team's declared `teamSize`**, that run may optionally
> be attributed to the team for observational statistics (e.g., "this
> team played 14 cooperative runs together in their 2026 cohort").

Constraints any such follow-on must satisfy:

- Attribution is **format-aware**: a 5-player team's run is attributed
  only when the run is itself 5-handed; it is not attributed to a
  3-handed run that happens to involve some of its members.
- Attribution does **not** affect scoring, ranking, or any comparison
  surface (preserves §4 Vision Alignment and DESIGN-RANKING §12)
- Attribution is **query-derived** from existing run records joined
  against team membership at run time, not authoritative state stored
  on the run
- Attribution is **opt-in or default-on at the team level**, never
  forced individually
- Attribution will be scoped as a **separate WP** (provisionally
  WP-110 or later) dependent on WP-109 landing first

This deferral is intentional: the identity layer can be designed,
validated, and shipped without committing to the attribution
question, and the attribution question can be answered with live data
once teams exist.

---

## 13. Migration & Compatibility

- Existing player profiles receive empty `teamAffiliations: []`
- No backfill, no inferred memberships from co-play history
- No retroactive team creation from past cooperative runs
- Historical integrity preserved — pre-WP-109 runs carry no team
  attribution and never will

---

## 14. Risks & Mitigations

| Risk                                  | Mitigation                                                        |
| ------------------------------------- | ----------------------------------------------------------------- |
| Drift into guild-like systems         | Explicit non-goals (§3) and layer boundary (§5)                   |
| Season-semantics collision            | `cohortLabel` avoids the DESIGN-RANKING.md §2 Season entity       |
| Captain-abandonment deadlock          | Operator override defined (§9)                                    |
| Silent attribution drift into ranking | §12 explicit deferral; any future projection requires its own WP  |
| Friend-graph dependency               | `friends` visibility falls back to `private` until graph exists   |
| Format drift within a single team     | `teamSize` immutable post-creation (§6, §10)                      |

---

## 15. Acceptance Criteria

1. Team affiliation visible on player profiles, with `teamSize` shown
   alongside the team name (read surface).
2. Historical memberships preserved verbatim after team `completed`
   or `retired`.
3. No engine, registry, ranking, or gameplay code references the team
   data model (verified by grep against `packages/game-engine/`,
   `packages/registry/`, and any ranking-aggregation source).
4. All team mutations (create, member-add, member-leave, role-change,
   rename, status-change, captain-change) produce auditable event
   records with timestamp + actor + optional reason.
5. No competitive framing introduced in any user-facing copy
   (no "match," "opponent," "win/loss," "standings between teams").
6. The `teamSize` field is rejected by validation if set to any value
   other than `3`, `4`, or `5` at creation, and is rejected on any
   subsequent update attempt.
7. The validity rule (§8.2) is enforced at creation and on every
   membership mutation; transitions that would leave a team invalid
   either fail with a full-sentence error or transition the team to
   a defined recovery state (chosen at execution-time pre-flight).
8. Operator-override audit rows are distinguishable from
   captain-driven rows in the audit log (operator identity field
   populated; `reason` text non-empty).
9. Migration leaves every pre-existing profile row with
   `teamAffiliations: []` (verified by SQL count comparison
   pre/post migration).

---

## 16. Execution Checklist (Separate File)

Tracked in:
[`docs/ai/execution-checklists/EC-115-team-affiliation.checklist.md`](../execution-checklists/EC-115-team-affiliation.checklist.md)

The EC extracts the most drift-prone elements (locked field names,
the `cohortLabel`-not-`seasonLabel` rename, the `teamSize` enum,
the parameterized validity rule, the visibility enum values, the §9
operator-override authority statement) into a quick-reference format
per [`docs/ai/REFERENCE/01.1-how-to-use-ecs-while-coding.md`](../REFERENCE/01.1-how-to-use-ecs-while-coding.md).

---

## 17. Open Questions (Tracked, Not Blocking)

- **Friend-graph dependency:** does a friend-graph surface exist by
  the time WP-109 executes, or does `friends` visibility collapse to
  `private`? Resolvable at pre-flight.
- **Auto-promotion of substitute on member departure:** §8.3 currently
  requires explicit promotion. Confirm this is the desired UX before
  schema lock — a one-event "departure-triggers-promotion" flow may
  be preferable for captains' day-to-day ergonomics.
- **Cohort overlap rule (cross-size):** may a player belong to
  multiple `active` teams simultaneously when those teams have
  **different** `teamSize` values (e.g., a 3-player cohort and a
  5-player cohort that meet on different nights)? Default reading:
  yes — different `teamSize` values represent different gameplay
  formats and are not mutually exclusive. Resolvable at pre-flight.
- **Cohort overlap rule (same-size):** may a player belong to
  multiple `active` teams of the **same** `teamSize` simultaneously?
  Default reading: no — within a single format, a player's
  cooperative cohort identity should be singular. Resolvable at
  pre-flight.
- **Cohort rollover:** does an `active` team automatically create a
  successor team for the next `cohortLabel`, or must each cohort be
  initiated explicitly? Default reading: explicit creation only.
- **Invalidity recovery state:** when a membership mutation would
  leave a team invalid (§8.2), does the team transition to a
  `paused` or similar recovery status, or does the mutation simply
  fail? Either is defensible; pre-flight should pick one and the EC
  Locked Values record it.

---

## Verdict

This document is Vision-safe, layer-correct, and governance-aligned.
It properly distinguishes:

- **Roster definition (this WP)** — identity, history, audit trail
- **Team-play attribution (future projection)** — observational
  statistics derived from existing run records, scoped as a separate
  WP that depends on this one

Variable team size (3 / 4 / 5) is supported as an immutable
declaration at creation, mapping to Legendary's three meaningful
cooperative formats.

---

# Lint-Required Sections

> **Purpose of this block:** the design content above (§1–§17) is the
> authoritative narrative. The sections below satisfy the structural
> requirements of
> [`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`](../REFERENCE/00.3-prompt-lint-checklist.md)
> §1 by name and cross-reference the design content. Where a lint
> section duplicates a design section, the design section wins on
> conflict; the lint section exists for grep-discoverability and
> structural completeness.

## Goal

After this session, the Server persistence layer exposes a
team-affiliation data model (Team entity + audit log + profile
extension), the migration adds the supporting tables idempotently,
and a player's public profile page composes their team affiliations
into a read-only display block. Captains can create, edit, and
complete teams via authenticated HTTP routes; operators can perform
overrides via admin routes (gated by a future admin-auth WP — until
that lands, override paths exist in code but are not exposed by HTTP).
No engine, registry, or pre-planning code is touched. No ranking,
scoring, comparison, or rewards surface is introduced.

## Assumes

- **WP-104 complete.** Specifically:
  - `legendary.player_profiles` table exists with WP-104's locked
    column set
  - `apps/server/src/profile/` module exists and exports the
    profile-composition function reused by WP-102
  - The `PlayerProfile` shape is extensible (the `teamAffiliations[]`
    field is additive)
- **WP-052 complete** (player identity + `legendary.players`).
- **WP-101 complete** (handle claim flow; `findAccountByHandle` available).
- **WP-102 landed** — the profile page component (Vue) exists and is
  the reuse target for the team-affiliation read surface.
- **No friend-graph surface yet.** WP-109 ships with `friends`
  visibility falling back to `private` at read time. A future WP that
  introduces the friend graph removes the fallback in a follow-up edit.
- **No admin-auth surface yet.** Operator-override code paths exist
  but are not HTTP-exposed until the admin-auth WP lands.
- **`pnpm -r build` exits 0** post-WP-104 baseline.
- **`pnpm test` baseline** must be captured at pre-flight (depends on
  the exact test counts WP-104 leaves behind).

If any of the above is false, this packet is **BLOCKED** and must
not proceed.

## Context (Read First)

- [`docs/ai/ARCHITECTURE.md §"Layer Boundary (Authoritative)"`](../ARCHITECTURE.md)
  — server/persistence layer rules; no engine/registry/preplan touch.
- [`docs/ai/ARCHITECTURE.md §"Persistence Boundaries"`](../ARCHITECTURE.md)
  — `G`/`ctx` are runtime-only; team data is server-layer state only.
- [`.claude/rules/architecture.md §"Layer Boundary"`](../../.claude/rules/architecture.md)
  — runtime enforcement of the above.
- [`.claude/rules/work-packets.md`](../../.claude/rules/work-packets.md)
  — one packet per session, dependency discipline.
- [`docs/01-VISION.md §3, §4, §23(b), §25`](../../01-VISION.md)
  — Vision clauses cited in §4 of this WP.
- [`docs/ai/DESIGN-RANKING.md §2, §4.1, §10.2, §12`](../DESIGN-RANKING.md)
  — Season terminology collision (§2), layer ownership precedent
  (§4.1), amendment pattern (§10.2), team-rankings deferral (§12).
- [`docs/ai/work-packets/WP-104-*.md`](.) (when drafted) — profile
  schema and migration this WP extends.
- [`docs/ai/work-packets/WP-102-public-profile-page.md`](WP-102-public-profile-page.md)
  — page-composition pattern reused for the read surface.
- [`docs/ai/REFERENCE/00.6-code-style.md`](../REFERENCE/00.6-code-style.md)
  — full English words, JSDoc on every function, named imports only,
  full-sentence error messages, no `.reduce()` for branching.
- [`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`](../REFERENCE/00.3-prompt-lint-checklist.md)
  — Vision Alignment block requirement (satisfied by §4 above).
- [`docs/ai/DECISIONS.md`](../DECISIONS.md) — scan for D-0005,
  D-9701..D-9905, and any team/profile-related entries that landed
  between draft and execution.

## Scope (In)

- New server module: `apps/server/src/teams/` (types, logic, routes,
  tests).
- New migration: `data/migrations/NNN-team-affiliation.sql` (team
  table + member events table + audit log table).
- Profile DTO extension: `apps/server/src/profile/profile.types.ts`
  and `apps/server/src/profile/profile.logic.ts` updated to compose
  `teamAffiliations[]` into the public profile DTO.
- Public profile page: `apps/arena-client/src/pages/PublicProfile.vue`
  renders a read-only team-affiliation block.
- New D-entry classifying `apps/server/src/teams/` as a server-layer
  directory (mirrors D-5202 / D-10301).

## Out of Scope

(Cross-references §3 Non-Goals; restated here for lint §1
discoverability.)

- Team scoring, rankings, ladders, MMR.
- Rewards, unlocks, badges tied to team membership.
- Engine, registry, or pre-planning code changes.
- Real-time chat, scheduling, or coordination features.
- Monetization or paid surfaces.
- Inter-team comparison or league standings.
- 1-player or 2-player team formats.
- Team-play attribution onto run records (deferred to a future WP per
  §12).
- Avatar upload, badges, integrity admin, payments — all deferred to
  WP-105..WP-108 per their existing placeholders.
- Admin-auth surface (operator-override HTTP exposure) — depends on
  the future admin-auth WP.

## Files Expected to Change

- `apps/server/src/teams/team.types.ts` — **new** — `Team`,
  `TeamMember`, audit-event shapes; Zod validators including the
  `teamSize: 3 | 4 | 5` constraint.
- `apps/server/src/teams/team.logic.ts` — **new** — create / invite /
  accept / member-add / member-leave / role-change / rename /
  visibility-change / status-change / captain-change /
  operator-override paths; parameterized validity rule (§8.2).
- `apps/server/src/teams/team.routes.ts` — **new** — HTTP routes for
  captain-driven actions; admin-route stubs deferred to admin-auth WP.
- `apps/server/src/teams/team.logic.test.ts` — **new** — invariant
  tests covering the §Guardrails list in EC-115.
- `data/migrations/NNN-team-affiliation.sql` — **new** — team table,
  member events table, audit log table; idempotent.
- `apps/server/src/profile/profile.types.ts` — **modified** — extend
  WP-104's profile DTO with `teamAffiliations[]`.
- `apps/server/src/profile/profile.logic.ts` — **modified** — compose
  `teamAffiliations[]` into the public profile DTO.
- `apps/arena-client/src/pages/PublicProfile.vue` — **modified** —
  render team-affiliation block (read-only, no competitive copy).

Migration number, exact route prefix, and the new D-entry number are
all pre-flight items.

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**

- Never use `Math.random()` — engine randomness uses `ctx.random.*`.
  **N/A here** (no engine touch); preserved for template completeness.
- Never throw inside boardgame.io move functions. **N/A here**.
- Never persist `G`, `ctx`, or any runtime engine state. **N/A here**.
- `G` must be JSON-serializable at all times. **N/A here**.
- `.reduce()` is forbidden in zone operations and effect application;
  in this WP specifically, `.reduce()` must NOT be used to compose
  the team-affiliation list — use explicit `for...of`.
- ESM only, Node v22+ — `import`/`export`, never `require()`.
- `node:` prefix on all Node built-in imports.
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents required for every new or modified file in the
  output — no diffs, no snippets.
- Human-style code per [`docs/ai/REFERENCE/00.6-code-style.md`](../REFERENCE/00.6-code-style.md).

**Packet-specific:**

- **`teamSize` is immutable post-creation.** No code path may UPDATE
  the `team_size` column on an existing team row. Verified by grep
  for `UPDATE.*team_size` returning zero matches.
- **`cohortLabel` is the field name.** Not `seasonLabel`. The rename
  is intentional (DESIGN-RANKING §2 collision) and not negotiable.
- **No in-place edit of historical records.** Clerical corrections
  follow the [DESIGN-RANKING.md §10.2](../DESIGN-RANKING.md)
  amendment pattern — new record with new identifier, original
  preserved.
- **Promotion is two events, not one.** A substitute does not
  auto-promote when a member's `leftAt` is set; the captain (or
  operator) must record both events.
- **`friends` visibility falls back to `private`** server-side when
  no friend-graph surface exists. The fallback is enforced on the
  read path, not by relying on the client.
- **No team attribution written to run records.** No file under
  `apps/server/src/teams/` (or anywhere else this WP touches) may
  add a `teamId` field, column, or join key to any run / match /
  replay record.
- **No competitive vocabulary in user-facing copy.** No "match,"
  "opponent," "win/loss," "standings between teams," "league table."
  Hero-vs-villain "vs" framing remains fine
  (project memory: `feedback_pvp_terminology_scope`).
- **No engine import.** No file under `apps/server/src/teams/` or
  `apps/arena-client/src/pages/PublicProfile.vue` may import
  `boardgame.io`, `@legendary-arena/game-engine`, or
  `@legendary-arena/registry`.
- **No pre-planning import.** `packages/preplan/**` is not imported
  from any WP-109 file.

**Session protocol:**

- If WP-104 has not landed, **STOP** — this WP is BLOCKED.
- If pre-flight reveals that the migration number, route prefix, or
  D-entry number must be assigned ad hoc, **stop and ask** rather
  than guessing.
- If the friend-graph surface has landed since draft time, **stop and
  ask** whether to remove the `friends → private` fallback in this
  same WP or defer to a follow-up.

**Locked contract values:**

- `Team.teamSize`: `3 | 4 | 5` (no other values)
- `Team.status`: `'active' | 'completed' | 'retired'`
- `Team.visibility`: `'public' | 'friends' | 'private'`
- `Team.members[].role`: `'member' | 'substitute'`
- Substitute cap: `min(2, teamSize − 2)` → 1 / 2 / 2
- Validity: `liveMembers ≥ teamSize − 2` AND
  `liveMembers + liveSubs ≥ teamSize − 1`

## Verification Steps

> **Pre-flight note:** the exact `pnpm` filter targets depend on
> WP-104's final package layout. The commands below assume the
> precedent of WP-102 (`@legendary-arena/server` filter). Pre-flight
> reconciles if WP-104 introduced a different filter.

1. `pnpm -r build` exits 0.
2. `pnpm --filter @legendary-arena/server build` exits 0.
3. `pnpm --filter @legendary-arena/server test` exits 0; new tests
   under `apps/server/src/teams/` are listed in the output.
4. `git diff --name-only` shows only files in `## Files Expected to
   Change`.
5. Grep for engine-import leaks (PowerShell):
   `Select-String -Path apps/server/src/teams/*.ts -Pattern '(boardgame\.io|@legendary-arena/game-engine|@legendary-arena/registry)'`
   returns **zero** matches.
6. Grep for ranking-system leaks:
   `Select-String -Path apps/server/src/teams/*.ts -Pattern '(ranking|leaderboard|standings|MMR)'`
   returns **zero** matches.
7. Grep for `seasonLabel` (the forbidden alias):
   `Select-String -Path apps/server/src/teams/*.ts,apps/server/src/profile/*.ts -Pattern 'seasonLabel'`
   returns **zero** matches.
8. Grep for in-place team-size mutation:
   `Select-String -Path data/migrations/*team*.sql,apps/server/src/teams/*.ts -Pattern 'UPDATE.*team_size'`
   returns **zero** matches.
9. Pre-migration profile row count = post-migration profile row count
   (no row loss); every row has `team_affiliations = '[]'::jsonb` (or
   the project's chosen empty representation).

## Definition of Done

- [ ] All §15 Acceptance Criteria pass.
- [ ] All `## Verification Steps` pass with the expected outputs.
- [ ] [`docs/ai/STATUS.md`](../STATUS.md) updated with what landed in
      this session.
- [ ] [`docs/ai/DECISIONS.md`](../DECISIONS.md) updated with the new
      D-entry classifying `apps/server/src/teams/` as a server-layer
      directory; any §17 Open Question resolved during execution
      recorded as its own D-entry.
- [ ] [`docs/ai/work-packets/WORK_INDEX.md`](WORK_INDEX.md) WP-109
      row updated from `(deferred placeholder)` to `[x] Completed
      YYYY-MM-DD`.
- [ ] No files outside `## Files Expected to Change` were modified
      (verified by `git diff --name-only`).
- [ ] EC-115 satisfied — every checkbox under
      [`EC-115-team-affiliation.checklist.md`](../execution-checklists/EC-115-team-affiliation.checklist.md)
      is checked or has a documented exception.

---

## Lint Self-Review

Self-reviewed against
[`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`](../REFERENCE/00.3-prompt-lint-checklist.md)
on 2026-04-26:

- §1 (structure): all required sections present (`Goal`, `Assumes`,
  `Context (Read First)`, `Scope (In)`, `Out of Scope`, `Files
  Expected to Change`, `Non-Negotiable Constraints`, `Acceptance
  Criteria`, `Verification Steps`, `Definition of Done`). **PASS**
- §2 (constraints block): engine-wide + packet-specific + session
  protocol + locked contract values all present; references
  `00.6-code-style.md`. **PASS**
- §3 (Assumes): WP-104, WP-052, WP-101, WP-102 listed; build/test
  baseline noted as pre-flight. **PASS**
- §4 (Context): specific docs and sections cited. **PASS**
- §5 (Files Expected to Change): 8 files listed with new/modified
  markers, each with one-line description. Within the ≤8 cap. **PASS**
- §6 (naming): `cohortLabel`, `teamSize`, `teamAffiliations`,
  `Team.status`, `Team.visibility` consistent throughout. **PASS**
- §7 (dependencies): no new npm dependencies introduced; forbidden
  packages not used. **PASS**
- §8 (architectural): server-layer only; engine/registry/preplan
  forbidden by Non-Negotiable Constraints. **PASS**
- §9 (Windows): verification steps use PowerShell `Select-String`.
  **PASS**
- §10 (env vars): no new env vars introduced. **N/A**
- §11 (auth): admin-route HTTP exposure deferred to future admin-auth
  WP; captain-driven HTTP routes use the same auth model as WP-104.
  **PASS** (no auth-model ambiguity).
- §12 (tests): tests use `node:test`; no boardgame.io import. **PASS**
- §13 (verification commands): exact `pnpm` and PowerShell commands
  given. **PASS**
- §14 (acceptance criteria): 9 binary observable items. **PASS**
  (within 6–12 range)
- §15 (Definition of Done): includes STATUS / DECISIONS /
  WORK_INDEX updates and scope-boundary check. **PASS**
- §16 (code style): WP body references `00.6-code-style.md`; no
  abbreviations or magic identifiers in the WP itself. **PASS**
- §17 (Vision Alignment): §4 above provides the required block with
  clause numbers, conflict assertion, non-goal proximity check, and
  determinism preservation note. **PASS**
- §18 (prose-vs-grep): verification step 7 greps for `seasonLabel`;
  prose mentions `seasonLabel` in §7 with the rationale rather than
  enumerating it as a forbidden token list. Cite-by-clause discipline
  preserved. **PASS**
- §19 (bridge-vs-HEAD): N/A at draft time; applies at commit time.

**Overall: PASS.** Ready for promotion to executable when WP-104
lands and pre-flight items are resolved.
