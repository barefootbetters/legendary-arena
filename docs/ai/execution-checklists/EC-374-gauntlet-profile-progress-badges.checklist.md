# EC-374 — Gauntlet Progress on Profiles + Champion Badges (Execution Checklist)

> Pairs with [WP-344](../work-packets/WP-344-gauntlet-profile-progress-badges.md)
> (authoritative design) and D-24131 §8b. WP wins on conflict.

## Before Starting

- [ ] Read WP-344 in full, then D-24131 §3/§8b, migration 013's two unique
      constraints, and this file.
- [ ] Confirm baseline: `origin/main` @ `ceadcfff`; `pnpm -r build` exits 0.
- [ ] Read `badge.issuance.ts`, `composeBadgeSummaries`,
      `competition.routes.ts` (`/api/me/scores` block), and
      `MyProfilePage.vue` (`loadScores` arc) before editing.

## Locked Values (do not re-derive)

- Progress predicate = the WP-342 board predicate verbatim:
  `outcome = 'heroes-win'` AND `ro.visibility IN ('link','public')` AND
  `scoring_config_version === checkParPublished(scenario_key)
  ?.scoringConfig.scoringConfigVersion`. Personal progress must always
  agree with the public board.
- `GauntletProgress` = `{ setAbbr, setName, mastermindSlug,
  mastermindName, board, legCount, completedLegCount, isComplete, legs:
  [{ schemeSlug, bestFinalScore: number|null }] }`; endpoint returns only
  `completedLegCount >= 1` rows; envelope `{ gauntlets }`;
  `Cache-Control: no-store`; auth chain identical to `/api/me/scores`.
- Badge key `gauntlet.<setAbbr>.<mastermindSlug>`; `tier 1`;
  `source_kind 'competitive_history'`; `source_ref NULL` (the partial
  unique index is the idempotency mechanism — never add an existence
  check); label `"<MastermindName> Champion — <SetName>"`.
- Startup registration, never deps-threading: `registerGauntletBadgeContext`
  (catalog + bound PAR gate) in `badge.gauntlet.ts` and
  `registerDynamicBadgeDefinitions` in `badge.types.ts`, both called once
  from `server.mjs` (the `setRegistryForSetup` precedent). Unregistered ⇒
  no-op issuance / unknown keys keep dropping — every existing test path
  byte-compatible.
- Issuance call sits INSIDE the existing badge try/catch in
  `competition.logic.ts`, after `issueTier1BadgesForSubmission`; the
  16-step flow and `SubmissionDependencies` are otherwise byte-untouched.
- `TIER_1_BADGE_KEYS` (7) and static `BADGE_DEFINITIONS` content
  unmodified; their drift test's expectations unchanged.
- §21: the `GET /api/me/gauntlets` row lands in the SAME commit as the
  route (whole-row semantics; `Wired`; `authenticated-session-required`).
- Client mirrors: `MyGauntletProgress` hand-mirrored with a source-naming
  comment; `fetchMyGauntlets` never-throws (the `fetchMyScores` contract);
  the MyProfilePage section follows the WP-339 loading/empty/error shape.

## Guardrails

- No migration; no engine / legends-board change; no new dependency or
  env var; parameterized SQL; no `.reduce()` in folds.
- Badge failure NEVER fails a submission (WP-105 posture) — the new call
  shares the existing catch.
- Identity: route resolves `AccountId` from the session; SQL keys on
  `player_id` via the `ext_id` join — never handle (DESIGN-RANKING).
- DB-seeding test files leave the shared DB clean in `after()` (the
  WP-342/#630 pattern) — badges FK-block players wipes.

## Required `// why:` Comments

- Progress predicate: why it reuses the board predicate (personal numbers
  must never disagree with the public board; D-24131 §3/§5).
- `source_ref NULL`: why the partial unique index is the idempotency
  mechanism (re-checking completion on every later win would double-issue
  under the composite constraint).
- Startup registration: why the catalog reaches issuance via module
  registration instead of the locked submission deps.
- The ≥1-leg endpoint filter: why zero-progress gauntlets are omitted
  (105 empty rows is noise; the client owns the no-progress state).

## Files to Produce

Per WP-344 §Files Expected to Change — 15 files; no others.

## After Completing

- [ ] `pnpm -r build` 0; server no-DB suite green; DB-gated serialized
      green vs local Postgres; arena-client build/typecheck/test green.
- [ ] Governance close: D-24133; WORK_INDEX check-off; STATUS
      (user-visible change); EC_INDEX row.
- [ ] D-24026 live-verify recorded as deploy-dependent (Render + CF Pages).

## Common Failure Smells

- Existing badge drift test red ⇒ the static definitions were touched;
  only the dynamic registry may change.
- Route test 500s ⇒ `gauntletCatalog` missing from the deps fake.
- Progress disagreeing with a board entry ⇒ predicate drift — reconcile
  against `getGauntletStandings`, never fork the rules.

## Rules

Commit prefix `EC-374:` for implementation; `SPEC:` for governance
(never `WP-344:`). Bug handling per `01.2-bug-handling-under-ec-mode.md`.
