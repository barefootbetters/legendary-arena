# WP-344 — Gauntlet Progress on Profiles + Completed-Gauntlet Badges (Server + Client)

**Status:** Drafted 2026-07-09 (design per D-24131 §8b; executed same-session per the WP-338/339 co-delivery shape)
**Primary Layer:** Server (`apps/server/**`) + Client (`apps/arena-client/**`)
**Dependencies:** WP-342 ✅ (outcome column + gauntlet catalog + read-layer), WP-343 ✅ (public board surface), WP-338/339 ✅ (`/api/me/scores` + My-Scores UI patterns), WP-105 ✅ (badge infrastructure), D-24131 (design lock), DESIGN-RANKING (identity rule)
**EC:** EC-374
**Baseline:** `origin/main` at `ceadcfff` (2026-07-09)
**User-Visible Surface:** play.legendary-arena.com (My Profile gauntlet progress; public-profile champion badges)
**Reserves:** D-24133

> **Execution addendum (2026-07-09).** One reconciliation and one
> out-of-list fix, both discovered at the gates:
> (1) `buildGauntletBadgeDefinitions` lives in `badge.gauntlet.ts` (not
> `gauntlet.logic.ts` as listed) to keep the import edge one-directional
> badges → legends.
> (2) 16th file: `apps/server/src/profile/loadoutLibrary.logic.test.ts` —
> a pre-existing timing flake surfaced in the full serialized run: its
> `makeIdProvider` seeded ext_ids from `Date.now()` with a counter that
> reset per provider, so two back-to-back provisions in the same
> millisecond (the cross-account test) collided on the UNIQUE ext_id.
> Fixed with a module-level sequence; isolated + full-suite verified.
> (3) arena-client typecheck reports 6 errors on this baseline — the
> pre-existing `PutAnyNumberBottomHQ` client/engine UIState drift on
> `main` (baseline-identical, zero errors in WP-344 files; flagged as a
> follow-up task chip).

---

## Goal

Close the D-24131 arc's personal surface: (1) **owner-profile gauntlet
progress** — `GET /api/me/gauntlets` returns the authenticated player's
per-gauntlet progress ("5/8 schemes defeated", per-leg bests) and
`MyProfilePage` renders it; (2) **completed-gauntlet badges** — finishing
a gauntlet's last leg issues a per-gauntlet badge
(`gauntlet.<setAbbr>.<mastermindSlug>`, e.g. "Dr. Doom Champion — Core
Set") through the existing WP-105 badge pipeline, which the public
profile already renders with zero client change. Identity resolves by
`AccountId`, never handle; the zero-auth legends board is untouched.

---

## Assumes

- **WP-342 shipped:** `legendary.competitive_scores.outcome` exists;
  `gauntlet.logic.ts` exports `GauntletDefinition`/`buildGauntletCatalog`;
  `server.mjs` builds `gauntletCatalog` at startup and already returns it
  from `startServer()`.
- **Badge infrastructure (WP-105):** `legendary.player_badges` with the
  composite UNIQUE `(player_id, badge_key, source_ref)` AND the partial
  unique index `(player_id, badge_key) WHERE source_ref IS NULL`;
  `issueTier1BadgesForSubmission` fires inside the submission's
  fire-and-forget badge try/catch; `composeBadgeSummaries` maps badge rows
  via `BADGE_DEFINITIONS` and **drops unrecognized keys**; both profile
  surfaces render `badges[]` (the public page's badge tab loops generic
  label/description entries).
- **Route pattern:** `GET /api/me/scores` in `competition.routes.ts` is the
  auth-chain template (WP-112 session → WP-107 unsuspended → read);
  `CompetitionRouteDependencies` already carries `checkParPublished`.
- **Client pattern:** `competitionApi.fetchMyScores` + `MyProfilePage`'s
  `loadScores` (WP-339/WP-341) are the templates to mirror.
- `pnpm -r build` exits 0 on `main`; server no-DB suite green; arena-client
  test/typecheck green.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — D-24131 (§3 qualification predicate, §8b this
  surface), D-24132, D-1004 (tiered badge issuer), D-5302 (append-only),
  D-9905 (auth taxonomy); scan for `badge` and `gauntlet`.
- `docs/ai/DESIGN-RANKING.md` — ranking identity keys on the stable player
  ID, never handle.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary + `.claude/rules/architecture.md`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 — canonical field names.
- `docs/ai/REFERENCE/api-endpoints.md` — §21 catalog (this WP adds a row).
- `apps/server/src/badges/*` (issuance/type/read), `legends/gauntlet.logic.ts`,
  `competition/competition.{logic,routes}.ts`, `profile/profile.logic.ts`
  (`composeBadgeSummaries`), `server.mjs` wiring;
  `apps/arena-client/src/lib/api/competitionApi.ts`, `pages/MyProfilePage.vue`.

---

## Scope (In)

- `getPlayerGauntletProgress` in `gauntlet.logic.ts` (per-player fold over
  the same qualification predicate as the public board) +
  `buildGauntletBadgeDefinitions` (catalog → dynamic `BadgeDefinition`s).
- `GET /api/me/gauntlets` in `competition.routes.ts` (auth chain mirrored
  from `/api/me/scores`; `gauntletCatalog` joins the route deps).
- `badge.gauntlet.ts`: gauntlet-completion issuance, called from the
  submission's existing badge try/catch; catalog + PAR gate reach it via
  **startup registration** (module-level `registerGauntletBadgeContext`,
  the `setRegistryForSetup` precedent) so the locked 16-step submission
  deps stay untouched.
- Dynamic badge definitions: `badge.types.ts` gains
  `registerDynamicBadgeDefinitions` + `resolveBadgeDefinition`;
  `composeBadgeSummaries` resolves through it (static map first).
- `server.mjs`: register the badge context + dynamic definitions at
  startup; pass `gauntletCatalog` into `registerCompetitionRoutes`.
- `api-endpoints.md`: the `GET /api/me/gauntlets` row (§21).
- Client: `fetchMyGauntlets` + mirrored `MyGauntletProgress` type in
  `competitionApi.ts`; a "Gauntlet Progress" section on `MyProfilePage`
  (per-gauntlet `completed/legCount` with a complete marker).
- Tests: progress fold + badge-definition builder + issuance (stub DB);
  route additions; client API function.

## Out of Scope

- **Any legends-board change** — the public board stays zero-auth and
  never shows personal progress (D-24131 §8b).
- **Public-profile rank/standing surface** (the inert WP-054/055 tab) —
  unchanged; badges are the only public-profile addition, and they flow
  through the existing render loop.
- **Retroactive badge backfill** — badges issue on the completing
  submission going forward; a player already complete before this deploy
  earns the badge on their next winning submission in that gauntlet (or a
  future backfill job, not built here).
- **Engine, migrations, publisher, windowed boards/streaks/levels.**
- **`TIER_1_BADGE_KEYS` / `BADGE_DEFINITIONS` static content** — the
  locked 7-entry set is untouched; gauntlet definitions are dynamic.

---

## Files Expected to Change

> 15 files — above the ~8 soft cap of 00.3 §5, accepted at draft time:
> 5 are test files and the arc (progress read → route → client render;
> completion → badge → existing profile render) is one cohesive
> co-delivery per the WP-338/339 precedent — the server surface is inert
> without the client half.

1. `apps/server/src/legends/gauntlet.logic.ts` — **modified** — progress
   types + `getPlayerGauntletProgress` + `buildGauntletBadgeDefinitions`.
2. `apps/server/src/legends/gauntlet.logic.test.ts` — **modified** —
   progress fold matrix + definition-builder tests (stub DB).
3. `apps/server/src/badges/badge.types.ts` — **modified** — dynamic
   definition registry (`registerDynamicBadgeDefinitions`,
   `resolveBadgeDefinition`); static content untouched.
4. `apps/server/src/badges/badge.gauntlet.ts` — **new** — completion
   issuance + `registerGauntletBadgeContext`.
5. `apps/server/src/badges/badge.gauntlet.test.ts` — **new**.
6. `apps/server/src/profile/profile.logic.ts` — **modified** —
   `composeBadgeSummaries` resolves via `resolveBadgeDefinition`.
7. `apps/server/src/competition/competition.logic.ts` — **modified** —
   gauntlet issuance call inside the existing badge try/catch.
8. `apps/server/src/competition/competition.routes.ts` — **modified** —
   `GET /api/me/gauntlets` + `gauntletCatalog` dep.
9. `apps/server/src/competition/competition.routes.test.ts` — **modified**
   — the new route's auth/read paths via the fake-logic seam.
10. `apps/server/src/server.mjs` — **modified** — startup registration +
    route dep.
11. `docs/ai/REFERENCE/api-endpoints.md` — **modified** — new row.
12. `apps/arena-client/src/lib/api/competitionApi.ts` — **modified** —
    `MyGauntletProgress` + `fetchMyGauntlets`.
13. `apps/arena-client/src/lib/api/competitionApi.test.ts` — **modified**.
14. `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** —
    "Gauntlet Progress" section (loadScores pattern mirrored).
15. Governance (`DECISIONS.md` D-24133, `WORK_INDEX.md`, `STATUS.md`,
    `EC_INDEX.md`) per the Definition of Done.

---

## Contract

Locked by **D-24133** (written at execution); restated for convenience.

- **Progress qualification = the board predicate.** A leg counts iff
  `outcome = 'heroes-win'`, ownership visibility ∈ (`link`,`public`), and
  `scoring_config_version` equals the currently-published version for its
  scenario (via the injected/registered `checkParPublished`). Personal
  progress therefore always agrees with the public board.
- **`GauntletProgress` shape** (server; hand-mirrored on the client):
  `{ setAbbr, setName, mastermindSlug, mastermindName, board, legCount,
  completedLegCount, isComplete, legs: [{ schemeSlug, bestFinalScore:
  number | null }] }`. The endpoint returns only gauntlets with
  `completedLegCount >= 1` (105 zero-rows is noise; the client renders its
  own no-progress state). Envelope: `{ gauntlets }`;
  `authenticated-session-required`; `Cache-Control: no-store`.
- **Badge key grammar (locked):** `gauntlet.<setAbbr>.<mastermindSlug>`;
  `tier = 1`; `source_kind = 'competitive_history'`; `source_ref = NULL`
  (the WP-105 partial unique index makes re-issuance a no-op). Label
  `"<MastermindName> Champion — <SetName>"`; description names the
  set-gauntlet feat and leg count.
- **Issuance site:** inside the submission's existing fire-and-forget
  badge try/catch, after `issueTier1BadgesForSubmission`; no-op unless the
  just-stored row is `heroes-win` and the player is now complete in a
  catalog gauntlet containing that (scheme, mastermind) pair. Badge
  failure never fails a submission (WP-105 posture preserved).
- **Startup registration, not deps-threading:** the gauntlet badge
  context (catalog + bound PAR gate) and the dynamic badge definitions
  register once at startup from `server.mjs` (the `setRegistryForSetup`
  precedent). Unregistered context ⇒ issuance no-ops and unknown badge
  keys keep dropping — every existing test path is byte-compatible.
- **Identity:** the route resolves the caller by `AccountId` from the
  session; SQL keys on `player_id` via the `ext_id` join (DESIGN-RANKING —
  never handle).

---

## Non-Negotiable Constraints

**Engine-wide:** ESM only, Node v22+. Human-style code — see
`docs/ai/REFERENCE/00.6-code-style.md`. Full file contents — no diffs.
Tests `.test.ts` with `node:test`; DB-dependent tests use the non-silent
skip; no `.reduce()` in aggregation; parameterized SQL only; no new npm
dependencies; no new environment variables.

**Packet-specific:**
- `packages/game-engine/**` and `apps/legends-board/**` untouched.
- The 16-step `submitCompetitiveScoreImpl` flow and its
  `SubmissionDependencies` seam are byte-untouched except the one
  issuance call inside the existing badge try/catch.
- `TIER_1_BADGE_KEYS` (locked 7) and the static `BADGE_DEFINITIONS`
  entries are unmodified; the drift test's expected content is unchanged.
- No migration — the badges table and constraints fit as-is.
- `MyProfilePage` mirrors the WP-339 section pattern (loading / empty /
  error states); the existing Competitive Scores section is untouched.
- §21 discipline: the new endpoint's catalog row lands in the same
  commit; `Auth = authenticated-session-required` (D-9905 closed set).

**Session protocol:** stop and ask on any unclear item; if the badge
constraints differ from the Assumes, STOP and reconcile against
migration 013 before choosing the conflict target.

---

## Acceptance Criteria

1. `getPlayerGauntletProgress` (stub-DB tests): per-leg best selection,
   version filter, completion detection, and the ≥1-leg inclusion rule
   each proven; a player with no winning rows yields `[]`.
2. `buildGauntletBadgeDefinitions` yields one definition per catalog
   gauntlet with the locked key grammar and label format.
3. `issueGauntletBadgesForSubmission` (stub-DB tests): no-op on a loss,
   no-op when incomplete, single idempotent INSERT (`ON CONFLICT DO
   NOTHING`, `source_ref NULL`) on the completing win; unregistered
   context no-ops.
4. `composeBadgeSummaries` resolves a registered dynamic gauntlet key to
   its label/description and still drops unknown keys.
5. `GET /api/me/gauntlets` (fake-logic route tests): 401 unauthenticated;
   403 suspended; 200 `{ gauntlets }` with `Cache-Control: no-store`.
6. `api-endpoints.md` carries the complete new row (whole-row semantics).
7. `fetchMyGauntlets` mirrors the `fetchMyScores` never-throw contract
   (client test with stubbed fetch).
8. `MyProfilePage` renders the Gauntlet Progress section states
   (loading / no-progress / list with `completed/legCount` and a complete
   marker) — vue-tsc + existing suite green; no regression to the
   Competitive Scores section.
9. `pnpm -r build` 0; server suite green (DB-gated serialized where
   applicable); arena-client build/typecheck/test green.
10. `git diff --name-only` = the listed files (+ governance).

---

## Verification Steps

```bash
# 1. Build + suites (expect exit 0 / green)
pnpm -r build
pnpm --filter @legendary-arena/server test          # no-DB portion
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client typecheck

# 2. DB-gated (PowerShell): $env:TEST_DATABASE_URL = "<local url>";
#    then from apps/server: node --import tsx --test --test-concurrency=1 scripts/**/*.test.ts src/**/*.test.ts

# 3. Scope check
git diff --name-only
```

---

## Vision Alignment

**Vision clauses touched:** §20–26 (PAR scoring surfaces), §3/§11
(identity), §19b proximity (profile competitive surface), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched
clauses. Progress and badges are derived read-side projections of
replay-verified rows (§24); identity keys on `AccountId`/`player_id`
per §3/§11 and DESIGN-RANKING; badges confer recognition only (NG-1 —
no gameplay power, no paid surface). The owner-profile competitive
surface extends the WP-339 precedent that already amended the §19b
posture for the owner's own data; the public profile gains only badge
rows through the existing WP-105 pipeline.

**Determinism preservation:** deterministic and replay-faithful (§22):
no engine/RNG/replay change; issuance and progress are pure functions of
stored rows plus startup catalog data.

## Funding Surface Gate

N/A — profile progress display and gameplay badges; no funding
affordances, no donate/support copy, no payment channels (§20.1 trigger
surfaces absent).

## API Catalog (§21)

**Triggered** — `GET /api/me/gauntlets` is a new HTTP endpoint; the
catalog row lands in the same commit (Status `Wired`,
Auth `authenticated-session-required`, canonical field names per 00.2).

---

## User-Visible Impact

play.legendary-arena.com: My Profile gains a **Gauntlet Progress**
section ("Dr. Doom — Core Set: 5/8 schemes defeated"); completing a
gauntlet's last leg awards a champion badge visible on the public
profile's badge tab. D-24026 live-verify is deploy-dependent (Render +
CF Pages): sign in, check My Profile renders the section (no-progress
state until wins accumulate).

---

## Definition of Done

- [ ] All Acceptance Criteria pass (1–10).
- [ ] **Live-on-surface verification (D-24026), deploy-dependent:** on
      play.legendary-arena.com, My Profile renders the Gauntlet Progress
      section (its no-progress state is the honest launch state); recorded
      post-deploy.
- [ ] `docs/ai/DECISIONS.md` — D-24133 written.
- [ ] `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md` updated.
- [ ] No files outside `## Files Expected to Change` were modified.
