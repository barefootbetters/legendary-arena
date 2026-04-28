# EC-115 — Team Affiliation (Execution Checklist)

**Source:** [docs/ai/work-packets/WP-109-team-affiliation.md](../work-packets/WP-109-team-affiliation.md)
**Layer:** Server (persistence) + App (read surfaces on profile page)
**Status:** DRAFT — not executable until WP-109 is lint-compliant
(see WP-109 §"Lint-Compliance Status") and WP-104 has landed.

> *Renumbered from EC-109 to EC-115 on 2026-04-27 per filename collision
> with the older `EC-109-delete-unused-auxiliary-metadata.checklist.md`
> (executed 2026-04-21, cited as introducing packet by 8 immutable
> DECISIONS.md entries: D-8401, D-8402, A-084-01 amendments, D-8304
> cross-reference). Follows the EC-103 → EC-111 retarget precedent.
> WP number unchanged (still WP-109); only the EC slot moved.*

> **Authority reminder:** This EC is the execution contract once WP-109
> is promoted to executable. Until then, both files are design artifacts.
> If the EC and WP conflict on design, the **WP wins**. ECs are
> subordinate to `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`.

---

## Before Starting

- [ ] WP-109 has been expanded to satisfy the lint sections enumerated
      in its `## Lint-Compliance Status` block (`Goal`, `Assumes`,
      `Context (Read First)`, `Files Expected to Change`,
      `Non-Negotiable Constraints`, `Verification Steps`,
      `Definition of Done`); Acceptance Criteria expanded to 6–12
      items per lint §14.
- [ ] WP-109 row added to `docs/ai/work-packets/WORK_INDEX.md` with
      WP-104 dependency listed.
- [ ] WP-104 (Player Profile Core & Owner-Editable Extensions) is
      **landed** — its profile schema, migration, and
      `legendary.players` extension table are present in `main`.
- [ ] WP-109 `## Open Questions` resolved (or explicitly deferred with
      DECISIONS.md entries):
      - friend-graph existence at execution time (governs `friends`
        visibility fallback per WP-109 §11)
      - cohort overlap rule (default: a player may belong to multiple
        active cohorts simultaneously)
      - substitute auto-promotion ergonomics (default: explicit only)
- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0

---

## Locked Values (do not re-derive)

**Field names — verbatim:**

- `cohortLabel` (NOT `seasonLabel` — collides with DESIGN-RANKING §2 Season)
- `teamId` (immutable identifier; never reused after retirement)
- `teamSize` (immutable post-creation; literal type `3 | 4 | 5`)
- `captainPlayerId`
- `teamAffiliations` (the profile-side denormalized array; defined by
  WP-104 schema, populated by WP-109; carries `teamSize` for display)

**Enum values — verbatim:**

- `Team.teamSize`: `3 | 4 | 5` (no other values; no 1/2/6+)
- `Team.status`: `'active' | 'completed' | 'retired'`
- `Team.visibility`: `'public' | 'friends' | 'private'`
- `Team.members[].role`: `'member' | 'substitute'`

**Roster constraints (parameterized by `teamSize`):**

| `teamSize` | Members at full roster | Max substitutes |
|------------|------------------------|-----------------|
| 3          | 3                      | 1               |
| 4          | 4                      | 2               |
| 5          | 5                      | 2               |

Substitute cap formula: `min(2, teamSize − 2)`.

**Validity rule (generalized, do not re-derive):**

- `liveMembers ≥ teamSize − 2`, AND
- `liveMembers + liveSubs ≥ teamSize − 1`

Concrete expansion (for grep / sanity check):

| `teamSize` | Equivalent statement                                 |
|------------|------------------------------------------------------|
| 5          | ≥4 members, OR ≥3 members + ≥1 substitute            |
| 4          | ≥3 members, OR ≥2 members + ≥1 substitute            |
| 3          | ≥2 members, OR ≥1 member + ≥1 substitute             |

Where `liveMembers` and `liveSubs` count records whose `leftAt` is unset.

**Vision citations — verbatim:**

- §3 (Player Trust & Fairness)
- §4 (Faithful Multiplayer Experience)
- §23(b) (Asynchronous PvP Comparison; no in-game player-vs-player)
- §25 (Skill Over Repetition)

**Decision references — verbatim:**

- D-0005: *"Asynchronous PvP Comparison Authorized; Live PvP Combat
  Forbidden"* (per [DESIGN-RANKING.md:14-20](../DESIGN-RANKING.md))
- DESIGN-RANKING.md §12: *"Team, faction, or cooperative co-op
  rankings"* listed as out-of-scope future work

---

## Guardrails

1. **No engine touch.** No file under `packages/game-engine/`,
   `packages/registry/`, or `packages/preplan/` may import or
   reference team data shapes. Verified by grep at acceptance time.
2. **No comparison surface.** No code path may project team
   membership into a ranking, leaderboard, score, or other
   inter-team comparison. This is the load-bearing Vision-alignment
   guarantee — violating it converts WP-109 into a DESIGN-RANKING §12
   amendment, which it is not.
3. **No in-place edit of historical records.** Clerical corrections
   follow the [DESIGN-RANKING.md §10.2](../DESIGN-RANKING.md) archive
   amendment pattern: new record with new identifier, original
   preserved. The data model must make in-place mutation
   *impossible*, not merely *discouraged*.
4. **Promotion is explicit.** A substitute does not auto-promote when
   a member's `leftAt` is set. Promotion requires a separate event
   (departing member's `leftAt` AND substitute's `role` change to
   `'member'`). Two events, two records.
5. **Operator override requires a `reason` text and operator
   identity.** No anonymous or reasonless override path exists.
   Captain-driven mutations are distinguishable from operator-driven
   mutations in the audit log.
6. **`friends` visibility falls back to `private`** at read time when
   no friend-graph surface exists. The fallback is enforced server-side
   on the read path, not by relying on the client to behave.
7. **No team attribution written to run records.** WP-109 §12 defers
   team-play attribution to a separate WP and constrains it to be
   query-derived, never authoritative state on the run record.
   Adding any `teamId` field to a run / match / replay record in this
   WP is a scope violation.
8. **No competitive vocabulary in user-facing copy.** No "match,"
   "opponent," "win/loss," "standings between teams," "league table."
   Hero-vs-villain "vs" framing remains fine
   (see project memory `feedback_pvp_terminology_scope`).
9. **`teamSize` is immutable post-creation.** No code path may
   `UPDATE` the `team_size` column on an existing team row. A
   captain who wants to change formats must retire the team and
   create a new one. Verified by grep for `UPDATE.*team_size`
   returning zero matches across migrations and server code.
10. **`teamSize` validation rejects out-of-range values.** Zod
    validators reject any `teamSize` not in `{3, 4, 5}` at creation
    AND on any subsequent attempted update (defense in depth — even
    if the route layer never exposes update, the validator does
    not permit it).

---

## Required `// why:` Comments

- **Server: `cohortLabel` field declaration** — explain the rename
  from `seasonLabel` and link to DESIGN-RANKING.md §2 Season collision.
- **Server: `teamSize` field declaration** — explain why size is
  declared at creation and immutable; cite WP-109 §6 (Legendary's
  cooperative gameplay scales with player count, so a "team" that
  drifts between 3-handed and 5-handed play is not coherent).
- **Server: parameterized validity check** — explain the
  `liveMembers ≥ teamSize − 2 AND liveMembers + liveSubs ≥ teamSize − 1`
  formula; cite WP-109 §8.2 and note the grace-of-one design
  (a single departure does not invalidate the team).
- **Server: `friends` visibility fallback branch** — explain the
  fallback to `private` when no friend-graph surface exists; cite
  WP-109 §11.
- **Server: amendment-record creation path** — explain the "new
  record, original preserved" pattern; cite DESIGN-RANKING.md §10.2
  precedent.
- **Server: validity check (`≥4 members OR ≥3 members + ≥1 sub`)** —
  explain the asymmetry (a sub counts as one of the four minimum
  but not as a primary, mirroring bowling-league grace rules).
- **Server: any place team membership is read in a non-team context**
  — explain why (e.g., profile composition for WP-102 reuse) and
  confirm no scoring or ranking layer is the consumer.

---

## Files to Produce

> **Reminder:** WP-109 currently lacks a `## Files Expected to
> Change` section. The list below is the EC's best-effort projection
> from §5 and §7 of WP-109; the WP's eventual list is authoritative
> when promoted to executable.

- `apps/server/src/teams/team.types.ts` — **new** — `Team`,
  `TeamMember`, audit-event shapes; Zod validators.
- `apps/server/src/teams/team.logic.ts` — **new** — create / invite
  / accept / member-add / member-leave / role-change / rename /
  visibility-change / status-change / captain-change / operator-
  override paths.
- `apps/server/src/teams/team.routes.ts` — **new** — HTTP routes for
  captain and operator surfaces; read endpoint(s) for profile-page
  composition.
- `apps/server/src/teams/team.logic.test.ts` — **new** — invariant
  tests covering the §Guardrails list (no in-place edits, explicit
  promotion, friends fallback, validity rules, audit completeness).
- `data/migrations/NNN-team-affiliation.sql` — **new** — schema for
  team table, member events table, audit log table; idempotent.
- `apps/server/src/profile/profile.logic.ts` — **modified** —
  compose `teamAffiliations[]` into the public profile DTO.
- `apps/server/src/profile/profile.types.ts` — **modified** — extend
  the WP-104 profile shape with the `teamAffiliations[]` field.
- `apps/arena-client/src/pages/PublicProfile.vue` — **modified** —
  render team affiliation block (read-only, no competitive copy).

A migration number, an exact route prefix (likely `/api/teams`), and
a new D-entry classifying `apps/server/src/teams/` as a server-layer
directory (mirrors D-5202 for `identity/` and D-10301 for `replay/`)
are all pre-flight items per the WP-102 precedent.

---

## After Completing

- [ ] All WP-109 Acceptance Criteria (post-expansion to 6–12 items)
      pass.
- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0
- [ ] No file under `packages/game-engine/`, `packages/registry/`,
      or `packages/preplan/` was touched (verified by `git diff
      --name-only`).
- [ ] No reference to `Team`, `teamId`, `cohortLabel`, or
      `teamAffiliations` exists in any ranking-aggregation,
      scoring, or leaderboard source (verified by grep).
- [ ] `docs/ai/STATUS.md` updated with what landed.
- [ ] `docs/ai/DECISIONS.md` updated **only** if an Open Question
      was resolved into a durable rule (e.g., the cohort overlap rule;
      the friends-fallback behavior; classification of
      `apps/server/src/teams/` as server-layer).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-109 row checked off
      with completion date.
- [ ] No files outside the `## Files to Produce` list were modified.

---

## Common Failure Smells

- **A `teamId` field appears on a run / match / replay record** —
  Guardrail 7 violated; team-play attribution leaked into this WP's
  scope. Remove and defer to the future attribution WP.
- **A migration includes `ALTER TABLE teams ... team_size` or any
  `UPDATE` against `team_size`** — Guardrail 9 violated. `teamSize`
  is immutable post-creation; format changes require retire+recreate,
  never in-place mutation.
- **A `teamSize` value of 1, 2, or 6+ is accepted somewhere** —
  Guardrail 10 violated. The validator must reject every non-`{3,4,5}`
  value at every entry point, not just the HTTP route.
- **A migration uses `UPDATE` to correct a member-event record** —
  Guardrail 3 violated. The amendment pattern requires a new
  record with a new identifier; in-place `UPDATE` is structurally
  forbidden, not merely discouraged.
- **A test passes when a sub auto-promotes on member departure** —
  Guardrail 4 violated. Two events are required (member's `leftAt`
  AND sub's `role` change). Auto-promotion is a UX decision deferred
  to the WP-109 §17 Open Question; do not pre-decide it.
- **A `friends`-visibility profile read returns team data when no
  friend-graph surface exists** — Guardrail 6 violated. The
  fallback to `private` must be enforced server-side on the read
  path; the client must not be the gate.
- **Field renamed to `seasonLabel` "for consistency with the ranking
  system"** — locked-value violation. The rename to `cohortLabel`
  is intentional (DESIGN-RANKING.md §2 collision); paraphrasing it
  back is the exact failure mode this EC exists to prevent.
- **Operator-override audit row has the same shape as a captain-
  driven row** — Guardrail 5 partially violated. Operator overrides
  must be distinguishable in the audit log (operator identity field
  populated; `reason` text required).
- **A `# why:` comment cites WP-109 generically without naming the
  specific section (e.g., "per WP-109" instead of "per WP-109 §11
  friends fallback")** — minor lint / drift smell. WP sections evolve;
  comments should pin the specific clause.

---

## Notes on Format

This EC condenses the design-form draft proposal (10 numbered
sections, ~70 sub-bullets) into the project's compact EC template
([EC-TEMPLATE.md](EC-TEMPLATE.md)). What was condensed:

- §0 Pre-Flight Gates → `## Before Starting`
- §1 Data Shapes → `## Locked Values` (field/enum/citation strings)
- §§2–8 invariants and exclusions → `## Guardrails` (8 most
  load-bearing rules)
- §9 Verification Steps → deferred to WP-109's eventual
  `## Verification Steps` section, as the EC must not invent
  commands the WP does not authorize
- §10 Definition of Done → `## After Completing`

Nothing was dropped; everything compressed. If the executor wants
the full sub-bulleted version during a session, it can be
regenerated from this EC + the WP without loss of fidelity.
