# WP-305 — Owner-Page Identity Fields (`accountId` / `displayName` / `handle` on `OwnerProfileView`; editable display name)

**Status:** Draft — ready to execute (drafted 2026-07-03) · **Standard two-session lane** (D-24028 — extends two locked `.types.ts` contract files + a two-table transactional write + api-catalog rows; NOT lightweight)
**Primary Layer:** Server (`apps/server`) + App (`apps/arena-client` — play.legendary-arena.com)
**User-Visible Surface:** `play.legendary-arena.com` (the `?route=me` owner profile page)
**Dependencies:** WP-104 (the `OwnerProfileView` / `OwnerProfilePatch` contract + `MyProfilePage.vue` this extends) ✅; WP-101 (`display_name` validation + `handle` columns this mirrors/surfaces) ✅; WP-131 (production auth wiring the endpoints already run under) ✅; WP-052 / D-5201 (`AccountId` = `ext_id` mapping) ✅.
**Baseline:** `origin/main` @ `775bd71d` (2026-07-03).

---

## Goal

The owner profile page (`MyProfilePage.vue`, `?route=me`) gains the player's own identity on the surface it most obviously belongs: **`GET /api/me/profile` returns `accountId`, `displayName`, and `handle`**, and the page renders `displayName` as the heading, `@handle` beneath it, and the raw `accountId` as an always-visible support line. Per the operator decision (2026-07-03), **`displayName` is editable here** — `PATCH /api/me/profile` accepts a `displayName` field, validated against the same rules the identity layer enforces at provisioning, and written to `legendary.players.display_name`. `handle` stays immutable (claimed once via WP-101 `claimHandle`, never edited) and `accountId` is display-only. Today the owner-edit response omits all three by design, so the page shows a generic "Your profile" heading and the player cannot see or change their own name.

---

## Assumes

- **`OwnerProfileView` and `OwnerProfilePatch` are the locked WP-104 contract** in `apps/server/src/profile/ownerProfile.types.ts`, mirrored structurally (not imported) in `apps/arena-client/src/lib/api/ownerProfileApi.ts`. Both are contract files; this WP edits both. (Verified `ownerProfile.types.ts:136-233`, `ownerProfileApi.ts:55-77`.)
- **`legendary.players` carries the three identity fields.** `ext_id` = the `AccountId` (opaque UUID, D-5201); `display_name text NOT NULL` (trimmed, 1-64, no control chars — migration `004_create_players_table.sql:27-30`); `display_handle` (cased presentation form, nullable pre-claim, immutable — migration `008_add_handle_to_players.sql`). (Verified.)
- **The identity-layer display-name rules are the source of truth for the editable-name validator.** `validateDisplayName` in `apps/server/src/identity/identity.logic.ts:66-98` enforces: non-empty after trim, ≤ 64 chars after trim, no `0x00-0x1F`/`0x7F` control chars; failure code `invalid_display_name`. It is **not exported** (WP-052 locked module), so this WP re-derives the same rules locally with a drift `// why:` citing the source. (Verified.)
- **`display_name` lives on `legendary.players`, not `legendary.player_profiles`.** The owner-profile PATCH currently writes only `legendary.player_profiles` via a single `INSERT ... ON CONFLICT` upsert. Editing `display_name` therefore adds a write to a **second table** (`legendary.players`), which this WP wraps with the profile upsert in one transaction. (Verified `ownerProfile.logic.ts:567-781`.)
- **`loadPlayerIdByAccountId` currently selects only `player_id`.** `getOwnerProfile` / `upsertOwnerProfile` / `replaceOwnerLinks` all compose the view through it; fetching `display_name` + `display_handle` requires extending that read (or a sibling helper). `accountId` is already the function input — no extra read. (Verified `ownerProfile.logic.ts:120-133`.)
- **The endpoints are genuinely authenticated** (`authenticated-session-required`, WP-131). No auth surface changes.
- **The arena-client uses the `defineComponent({ setup() })` separate-compile pattern** (D-6512): every template binding must be returned from `setup()`. `MyProfilePage.vue` already reads the auth token and calls `updateOwnerProfile`. (Verified via WP-298/WP-299.)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context

The wiki reference [`profile-login`](../../../wiki/profile-login.md) recorded this as a pending design note (§"Owner-page identity fields", status "proposed — not scheduled"). The operator ratified two decisions on 2026-07-03, which this WP encodes:

1. **`display_name` is editable on the owner page** (not merely displayed). This is the larger of the two options: it extends the write contract (`OwnerProfilePatch`) and adds a `legendary.players` write, not just a read field.
2. **`accountId` is always shown** (a visible support line), not hidden behind a copy control or omitted.

**Single WP, server + client (split-vs-single rationale).** This follows the WP-104 / WP-298 precedent — the owner-profile surface's server contract and its structural client mirror are extended together in one WP (the client mirror is structural compatibility, **not** a cross-layer import, so no forbidden edge is introduced). It is deliberately *not* split into paired server/client WPs like WP-301/WP-302, because that split was for a net-new subsystem (new table, five endpoints, new page); this is an **extension of the existing** WP-104 contract, endpoints, and page. If review prefers the paired-WP shape, the scope below decomposes cleanly at the server/client seam.

**Why two DECISIONS.** The read-surface extension (D-24089) and the write-surface extension (D-24090) are distinct contract changes with distinct blast radii — the read is additive to every `OwnerProfileView` return path; the write introduces a second-table transactional mutation and a new error code. They are reserved separately so a future reader can cite the exact one that load-bears.

---

## Scope (In)

### A) `ownerProfile.types.ts` (server, locked contract) — read + write shape
- Add to `OwnerProfileView`: `readonly accountId: AccountId`, `readonly displayName: string`, `readonly handleCanonical: string | null`. **Field name matches `PublicProfileView` (`handleCanonical`, sourced from `handle_canonical` — the lowercased canonical form; `null` pre-claim). Do NOT introduce a second `handle` / `display_handle` representation on the owner view** — one concept, one wire name (copilot #27 fix; the owner sees the same handle form as everyone else). New sorted key set (**9 → 12 keys**): `accountId, aboutMe, aboutMeVisibility, avatarUrl, avatarVisibility, badges, displayName, handleCanonical, links, linksVisibility, teamAffiliations, updatedAt`.
- Add to `OwnerProfilePatch`: `readonly displayName?: string`. **Not** `| null` — `display_name` is `NOT NULL`; it cannot be cleared. `handleCanonical` and `accountId` are **not** in the patch (immutable / non-editable).
- Add `'invalid_display_name'` to `OwnerProfileErrorCode` **and** `OWNER_PROFILE_ERROR_CODES` (both, same change — the drift test asserts forward+backward inclusion).

### B) `ownerProfile.logic.ts` (server) — read composition + editable name write
- Extend the player-row read (`loadPlayerIdByAccountId` → a helper that also returns `display_name` + `handle_canonical`) so `accountId` (the input), `displayName`, and `handleCanonical` reach the view.
- Thread the three fields into `composeOwnerProfileView` and `synthesizeDefaultOwnerProfileView` (the latter can no longer be a static literal — the `legendary.players` row always exists, so the synthesized-default branch carries real identity fields).
- Add a **local** `validateDisplayName` (trim / 1-64 / no control chars) with a drift `// why:` citing `identity.logic.ts` as the source; failure returns `code: 'invalid_display_name'`.
- In `upsertOwnerProfile`: when `Object.hasOwn(patch, 'displayName')`, validate it, then `UPDATE legendary.players SET display_name = $ WHERE player_id = $` **in the same transaction** as the `player_profiles` upsert (wrap both in `BEGIN/COMMIT`, mirroring the `replaceOwnerLinks` transaction posture). Absent `displayName` → no `players` write and no transaction-shape change beyond the wrap.
- **Return the just-written name (copilot #18 fix).** The composed `OwnerProfileView` returned by a PATCH that carried `displayName` MUST reflect the **post-write** value — read it from `UPDATE ... RETURNING display_name`, or re-read the `players` row inside the transaction. Composing from a `display_name` captured at the top of the function (before the UPDATE) returns the **stale** name; AC-2 pins a test that a rename's response shows the new name.
- **Transaction-failure posture (copilot #22 fix).** On a SQL error inside the `BEGIN/COMMIT`, mirror `replaceOwnerLinks` exactly: capture the error, issue `ROLLBACK`, `release()` the client, then `Promise.reject` the captured error so the route's outer `catch` maps it to `500 { error: 'internal_error' }`. Do **not** invent a typed `Result.fail` — `OwnerProfileErrorCode` has no infra-failure member.

### C) `ownerProfileApi.ts` (arena-client, locked mirror) — mirror the shapes
- Mirror the three read fields on the client `OwnerProfileView` and `displayName?: string` on the client `OwnerProfilePatch`. No behavior change to the fetch/patch wrappers.

### D) `MyProfilePage.vue` (arena-client) — render + edit
- Render `displayName` as the page heading via an editable field (bound to a `formDisplayName` ref, saved through the existing `updateOwnerProfile` PATCH — no new API call); `@handle` (display-only) beneath it; `accountId` as an always-visible muted support line ("Account ID: <uuid>").
- Surface the `invalid_display_name` server code as an inline validation message. Every new binding returned from `setup()`.

### E) Tests
- `ownerProfile.logic.test.ts`: update the drift key-set assertion (**9 → 12**); add coverage for the three read fields (incl. the synthesized-default branch) and for the editable-name path (valid update, `invalid_display_name` on empty/too-long/control-char, atomicity: a name write + profile write both land or neither).
- `ownerProfileApi.test.ts`: extend the structural-shape assertions to include the three new fields.

### F) Governance / catalog
- `api-endpoints.md`: **whole-row** update (D-11804) of the `GET /api/me/profile` row (response gains `accountId`/`displayName`/`handleCanonical`) and the `PATCH /api/me/profile` row (recognized fields gain `displayName`; error set gains `invalid_display_name`). Updated in the **impl commit**, not the draft.
- `WORK_INDEX.md` (WP-305) + `EC_INDEX.md` (EC-335) + `STATUS.md`; `DECISIONS.md` D-24089 + D-24090 flip Drafted → Active at execution.

---

## Out of Scope

- **`handle` editing.** `handle` is immutable by design (migration 008; `claimHandle` is the sole writer). This WP displays it; it never writes it. A handle-rename feature is a separate WP with its own uniqueness/lock semantics.
- **`accountId` editing or any new identity/account model.** It is surfaced read-only; no new account fields, no re-mapping of `ext_id`↔`AccountId`.
- **Making `email` / `authProvider` / `authProviderId` / `createdAt` visible.** They remain deliberately absent from the owner-edit surface (private account fields).
- **New endpoint or route.** No `PUT /api/me/profile`, no new `/api/me/*` path; the change rides the existing `GET`/`PATCH /api/me/profile`.
- **Public-profile changes.** `PublicProfileView` already surfaces `displayName` + `handleCanonical` (WP-102); untouched here.
- **Cross-layer import.** The client mirror stays structural; no `apps/server/**` / `packages/*` runtime / `boardgame.io` import is added to the client.
- **Visual redesign** (the identity-header / card-grid direction evaluated on the wiki page) — that is the separate multi-WP player-identity subsystem, not this contract extension.

---

## Files Expected to Change

**Code / test (allowlist):**
- `apps/server/src/profile/ownerProfile.types.ts` — **modified** — 3 read fields on `OwnerProfileView`; `displayName?` on `OwnerProfilePatch`; `invalid_display_name` on the error union + array.
- `apps/server/src/profile/ownerProfile.logic.ts` — **modified** — identity-field read + compose + synthesized-default threading; local `validateDisplayName`; transactional `legendary.players` name write in `upsertOwnerProfile`.
- `apps/server/src/profile/ownerProfile.logic.test.ts` — **modified** — drift key-set 9→12; read-field + editable-name + atomicity coverage.
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` — **modified** — mirror the 3 read fields + `displayName?`.
- `apps/arena-client/src/lib/api/ownerProfileApi.test.ts` — **modified** — shape assertions.
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — render displayName (editable) / handle / accountId; new `setup()` bindings.

**Governance / catalog (excluded from the allowlist count):**
- `docs/ai/REFERENCE/api-endpoints.md` (GET + PATCH `/api/me/profile` whole-row per D-11804) · `docs/ai/work-packets/WORK_INDEX.md` · `docs/ai/execution-checklists/EC_INDEX.md` · `docs/ai/STATUS.md` · `docs/ai/DECISIONS.md` (D-24089 + D-24090).

**6 code/test files across two layers (server + client mirror, no cross-layer import). Standard two-session lane** — two locked contract files, a two-table transactional write, a new error code, and an api-catalog change put this outside the lightweight lane (D-24028).

---

## Contract

- **`OwnerProfileView` (read):** `+accountId: AccountId` (always present; `ext_id`), `+displayName: string` (`players.display_name`, NOT NULL), `+handleCanonical: string | null` (`players.handle_canonical`, null pre-claim — **same wire name + form as `PublicProfileView`**). Every return path (`getOwnerProfile` including synthesized default, `upsertOwnerProfile`, `replaceOwnerLinks`) carries all three. Sorted key set = the 12 listed in Scope A; the drift test locks it.
- **`OwnerProfilePatch` (write):** `+displayName?: string`. Present → validated + written to `legendary.players.display_name`; absent → unchanged. Cannot be `null`. **The PATCH response reflects the post-write `display_name`** (RETURNING / re-read inside the transaction), never the pre-write value.
- **Validation (`displayName`):** trim; reject empty-after-trim, `> 64` after trim, or any `0x00-0x1F`/`0x7F` control char → `code: 'invalid_display_name'` (HTTP 400 via the existing route mapping). Rules mirror `identity.logic.ts:66-98` verbatim (drift `// why:` required).
- **Atomicity:** a PATCH carrying `displayName` writes `legendary.players` **and** `legendary.player_profiles` inside one transaction — both land or neither; a SQL failure `ROLLBACK`s and surfaces as a route `500` via `Promise.reject` (mirrors `replaceOwnerLinks`).
- **Immutability:** `handleCanonical` and `accountId` are display-only; no write path, no patch field.
- **Error set:** `OwnerProfileErrorCode` gains `'invalid_display_name'`; union + `OWNER_PROFILE_ERROR_CODES` array updated together.

---

## Acceptance Criteria

1. `GET /api/me/profile` returns `accountId`, `displayName`, `handleCanonical` on every path (real row, synthesized default, post-PATCH, post-PUT); the drift test asserts the exact 12-key set (**AC-1**).
2. `PATCH /api/me/profile` with a valid `displayName` updates `legendary.players.display_name` and **returns a view whose `displayName` is the just-written value** (a test renames and asserts the response shows the new name, not the old); the name write and the profile upsert are atomic (both or neither) (**AC-2**).
3. `PATCH` with an empty/whitespace, `>64`-char, or control-char `displayName` returns `400 { error: 'invalid_display_name' }` and writes nothing (**AC-3**).
4. `handleCanonical` and `accountId` have no write path — no patch field accepts them; a body attempting them leaves both unchanged (**AC-4**).
5. `MyProfilePage.vue` renders `displayName` (editable, saved via the existing PATCH), `@handle` (display-only), and `accountId` (always-visible support line); every new binding is returned from `setup()` (**AC-5**).
6. Client `OwnerProfileView` / `OwnerProfilePatch` mirrors carry the new fields; the `ownerProfileApi.test.ts` shape assertions pass (**AC-6**).
7. `api-endpoints.md` GET + PATCH `/api/me/profile` rows updated whole-row (D-11804), field names matching `00.2` (**AC-7**).
8. `pnpm --filter @legendary-arena/server test` + `typecheck` (tsconfig-less server: `pnpm -r build`) and `pnpm --filter @legendary-arena/arena-client typecheck` + `test` + `build` all exit 0; new server tests added, arena-client suite green (**AC-8**).
9. No forbidden import (client adds no `apps/server` / `packages/*` / `boardgame.io`); no new endpoint/route; auth surface unchanged (**AC-9**).

---

## Verification Steps

```pwsh
# Server logic + drift + editable-name (DB-backed suite needs TEST_DATABASE_URL)
pnpm --filter @legendary-arena/server test
pnpm -r build                       # server has no tsconfig; build is the typecheck proxy

# Client mirror + page
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client build

# 12-key drift assertion present
Select-String -Path "apps\server\src\profile\ownerProfile.logic.test.ts" -Pattern "accountId','aboutMe|displayName','handle|'handle',"
# New error code wired in both union and array
Select-String -Path "apps\server\src\profile\ownerProfile.types.ts" -Pattern "invalid_display_name"
# Client mirror carries the fields
Select-String -Path "apps\arena-client\src\lib\api\ownerProfileApi.ts" -Pattern "accountId|displayName|handle"
# No forbidden client import
Select-String -Path "apps\arena-client\src\pages\MyProfilePage.vue" -Pattern "apps/server|packages/registry|packages/game-engine|boardgame.io"   # expect: no output
git diff --name-only   # expect: only the 6 allowlist files + governance/catalog
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** live on `play.legendary-arena.com` `?route=me` — the heading shows the player's display name, `@handle` renders, the account-ID line shows; editing the name and saving persists (reload shows the new name); an invalid name shows the inline error (screenshot / observed behavior).
- [ ] All acceptance criteria pass
- [ ] `OwnerProfileView` +3 read fields; `OwnerProfilePatch` +`displayName?`; `OwnerProfileErrorCode` +`invalid_display_name` (union + array together)
- [ ] `validateDisplayName` local mirror with a `// why:` citing `identity.logic.ts`; editable-name write is transactional with the profile upsert
- [ ] Drift key-set test updated 9→12; server read-field + editable-name + atomicity tests added
- [ ] Client mirrors + `ownerProfileApi.test.ts` updated; `MyProfilePage.vue` renders/edits with all bindings returned from `setup()`
- [ ] `api-endpoints.md` GET + PATCH rows whole-row updated (D-11804) in the impl commit
- [ ] No forbidden import; no new endpoint/route; auth unchanged
- [ ] Server suite + `pnpm -r build` 0; arena-client `typecheck`/`test`/`build` 0; `git diff --name-only` = allowlist + governance
- [ ] `STATUS.md` + `WORK_INDEX.md` (WP-305) + `EC_INDEX.md` (EC-335) flipped with date; D-24089 + D-24090 flipped Drafted → Active

---

## Vision Alignment

**Vision clauses touched:** §3, §11 (player identity / profile presentation). No scoring / PAR / replay / RNG / determinism / persistence-of-`G` surface.

**Conflict assertion:** No conflict — surfaces and lets the player edit their own already-owned identity (`display_name` was always theirs, set at provisioning). Ownership/visibility of profile sections is unchanged.

**Non-Goal proximity check:** Crosses none of NG-1..7. Not pay-to-win, not a paid/persuasive surface. **PvP terminology (§23):** "display name" / "handle" / "account ID" carry no match/opponent/win-loss framing.

**Determinism preservation:** N/A — server profile I/O + client UI only; no engine, replay, RNG, or hash surface.

---

## Decision

Reserves **D-24089** and **D-24090** (drafted 2026-07-03; land Active at execution):

- **D-24089 — Owner-page identity fields on `OwnerProfileView` (read).** `GET /api/me/profile` surfaces `accountId` (opaque `ext_id` UUID, always shown as a support line), `displayName`, and `handle` (`display_handle`, display-only, immutable). Extends the WP-104-locked `OwnerProfileView` 9 → 12 keys; every return path composes all three. Rationale: the owner page had no access to the player's own name/handle/id, forcing a generic heading; these are the player's own identity and belong on their own page.
- **D-24090 — Editable `display_name` via `OwnerProfilePatch` (write).** `PATCH /api/me/profile` accepts `displayName?: string`, validated against the identity-layer rules (trim / 1-64 / no control chars; new code `invalid_display_name`) and written to `legendary.players.display_name` inside a transaction with the `player_profiles` upsert. `handle` stays immutable (`claimHandle` sole writer); `accountId` non-editable. Rationale (operator, 2026-07-03): the owner page is the natural place to rename; `handle` immutability is preserved as the stable identifier.

---

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections present; `## Out of Scope` lists ≥2 excluded items.
- §2 Non-Negotiable Constraints — PASS: contract-file edits enumerated; transactional two-table write + immutability + forbidden-import bans explicit.
- §3 Assumes — PASS: contract files, DB columns, identity validator, two-table fact, and read-helper all cited with file:line.
- §4 Context — split-vs-single + two-DECISIONS rationale recorded.
- §5 Output Completeness — PASS: 6 code/test files + governance, each with a one-line role; two-layer, no cross-layer import.
- §6 Naming — PASS: canonical `displayName` / `handleCanonical` / `accountId` — `handleCanonical` matches the `PublicProfileView` precedent (WP-102); no abbreviations.
- §7 Dependency Discipline — PASS: WP-104 / WP-101 / WP-131 / WP-052 all ✅ on `main`; no new npm dep.
- §8 Architectural Boundaries — PASS: server contract + structural client mirror (no import edge); no new endpoint; auth unchanged.
- §9 Windows Compatibility — PASS: `pwsh` + `Select-String` + `\` paths.
- §10 Env Var Hygiene — N/A: no env var touched.
- §11 Authentication Clarity — PASS: reuses the existing `authenticated-session-required` gate; adds no endpoint/identity model/secret.
- §12 Test Quality — PASS: drift-key update + read-field + editable-name + atomicity + client-shape tests specified.
- §13 Commands & Verification — PASS: exact `pnpm` + `Select-String` commands with expected output.
- §14 Acceptance Criteria — PASS: 9 binary, observable items naming real files / fields / codes.
- §15 Definition of Done — PASS: binary checkboxes incl. STATUS / WORK_INDEX / EC_INDEX / DECISIONS + §15.1.
- §15.1 User-Visible Verification (D-24026) — PASS: surface `play.legendary-arena.com`; DoD has a live-on-surface verify item, not tests-only.
- §16 Code Style — PASS: explicit `for`/`if` (no branching `.reduce()`), `// why:` on the display-name drift mirror + the transaction, named imports only.
- §17 Vision Alignment — PASS: block present; §3/§11; NG-proximity none; determinism N/A.
- §18 Prose-vs-Grep — PASS: verification greps the new field/code tokens, not a comment that could self-trip.
- §19 Bridge-vs-HEAD — N/A: no repo-state-snapshot artifact authored.
- §20 Funding Surface Gate — N/A: identity display/edit; no donate/support affordance.
- §21 API Catalog Update — **APPLIES**: GET + PATCH `/api/me/profile` change → whole-row update per D-11804 in the impl commit; both gates (this §21 + `work-packets.md §API Catalog Update Obligation`) satisfied.

## Lint / Pre-Flight / Copilot

**Lint (00.3): PASS** — 21 sections resolved; §21 applies and is scoped to the impl commit; §10/§19/§20 carry non-tautological N/A.

**Pre-flight (01.4): READY TO EXECUTE** (full procedure run 2026-07-03 against source, post-draft-merge). Class = standard two-session (contract + two-layer + api-catalog). **Dependencies complete** — WP-104 ✅ (contract + page), WP-101 ✅ (name validation + handle), WP-131 ✅ (auth wiring), WP-052 ✅ (`AccountId` mapping) — all verified against source. **Scope locked** — 6 code/test files + governance; extension of an existing contract, no new endpoint/route/table. **Ambiguities resolved** — the two operator decisions (editable name; always-show accountId) are locked in D-24089/D-24090; the two-table transactional write and the `synthesizeDefaultOwnerProfileView` non-static change are called out so the executor does not discover them mid-flight.

**Copilot (01.7): HOLD → CONFIRM** (30-issue lens run 2026-07-03; four scope-neutral FIXes applied in-place, then re-confirmed). Findings and resolutions:

- **#18 Outcome-timing / #4 Contract drift — the PATCH response returned the stale `display_name`.** Composing the returned view from a `display_name` captured before the `UPDATE` would show the old name after a rename. **FIX (applied):** Scope B + Contract + AC-2 now require the returned view to reflect the post-write value (`RETURNING` / re-read inside the transaction) with a rename-response test.
- **#27 Canonical naming / #4 Contract drift — `handle` vs the public `handleCanonical`.** The owner field was named `handle` (from `display_handle`) while `PublicProfileView` exposes `handleCanonical` (from `handle_canonical`) — two names + two forms for one concept. **FIX (applied):** renamed the owner field to `handleCanonical`, sourced from `handle_canonical`, matching the public contract; 12-key set updated.
- **#22 Fail semantics — transaction-failure posture unspecified.** **FIX (applied):** locked to mirror `replaceOwnerLinks` (`ROLLBACK` + `release` + `Promise.reject` → route `500`; no invented `Result.fail`).
- **#11 Invariant testing — no locked baseline.** **FIX (applied in EC-335):** record the server + arena-client baseline test counts at session start; the suite may grow only by the new tests.

All four are scope-neutral (no allowlist change). Remaining 26 issues: PASS. Disposition **CONFIRM** after the fixes — session-prompt/execution authorized.
