# WP-296 — Avatar CDN Host Unification

## Goal

Move player avatars from the legacy `images.barefootbetters.com/avatars`
host to `images.legendary-arena.com/avatars` — the same Cloudflare custom
domain (and the same `legendary-images` R2 bucket) that already serves
card images. The avatar bytes do not move; only the host string in the
write path, the closed-origin validation allowlist, the stored
`avatar_url` rows, and the endpoint catalog change. This resolves the
drift that `wiki/r2-image-naming-convention.md` §Edge Cases ("The host
moved.") already documents as stale and that `wiki/data-file-locations.md`
§Edge Cases logs as a known split.

## Assumes

- WP-104 complete — `legendary.player_profiles.avatar_url` column exists
  (migration `009_create_player_profiles_and_links.sql`). The migration
  runner applies numbered `data/migrations/NNN_*.sql` in order.
- WP-106 complete — `AVATAR_CDN_BASE` (write path) and the closed-origin
  `validateAvatarUrl` allowlist (D-10601) both currently target
  `https://images.barefootbetters.com/avatars/`.
- `images.legendary-arena.com` is the live Cloudflare custom domain over
  the `legendary-images` R2 bucket (it is the current card-image host,
  `R2_BASE_URL` in `packages/registry/src/heroImageUrl.ts`). Avatar
  objects live at the `avatars/{accountId}.webp` key in that same bucket,
  so the new domain already serves them — confirmed at execution time by
  the §Verification curl. No R2 object move is required.
- Baseline `origin/main` @ `f11c2de1` (captured this drafting session).

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Server layer; Persistence boundary)
- `docs/ai/DECISIONS.md` — D-10601 (upload validation policy + closed-origin
  allowlist — host superseded here), D-10602 (endpoint contract — success-URL
  host superseded here), D-11804 (api-endpoints.md same-commit obligation)
- `.claude/rules/server.md` — server layer constraints
- `.claude/rules/work-packets.md` §API Catalog Update Obligation (D-11804)
- `apps/server/src/profile/avatarUpload.logic.ts` — `AVATAR_CDN_BASE`
- `apps/server/src/profile/ownerProfile.logic.ts` — `validateAvatarUrl`
- `wiki/r2-image-naming-convention.md`, `wiki/data-file-locations.md` — Edge Cases

**Why now:** the canonical wiki already declares `images.barefootbetters.com`
the stale host; the avatar surface is the last code path still on it. Avatar
adoption is low at MVP scale, so the one-shot row rewrite is at its cheapest —
the cost only grows as profiles accumulate. This is the moment to close the drift.

**Single WP, single layer:** all code is in `apps/server/src/profile/`; the
migration is the server/app persistence concern; the catalog + wiki + DECISIONS
edits are governance ledgers. No other layer is touched.

## Scope (In)

- `avatarUpload.logic.ts` — `AVATAR_CDN_BASE` → `https://images.legendary-arena.com/avatars`
- `ownerProfile.logic.ts` `validateAvatarUrl` — the per-user canonical URL
  builder, the fallback `allowedPrefix`, the two rejection-message host
  references, and the `// why:` comment host reference → new host
- `avatarUpload.logic.test.ts`, `ownerProfile.logic.test.ts` — update the
  hard-coded host literals (these fixtures use the old host and are the
  newly-rejected inputs the validation-tightening scaffold surfaces)
- `data/migrations/021_rewrite_avatar_url_host.sql` — **new**, idempotent
  one-shot `UPDATE` rewriting the host prefix on existing
  `legendary.player_profiles.avatar_url` rows
- `docs/ai/REFERENCE/api-endpoints.md` — the `POST /api/me/avatar` row's
  success-response host (D-11804 replace-whole-row, same commit)
- `wiki/r2-image-naming-convention.md`, `wiki/data-file-locations.md` —
  Edge Cases updated to "drift resolved; both hosts now `legendary-arena`"
- `docs/ai/DECISIONS.md` — land D-24083

## Scope (Out)

- No change to upload-pipeline behavior — MIME allowlist, magic-byte sniff,
  5 MB / 20 MP guards, sharp resize, EXIF strip, rate limit, compensating
  delete are all untouched (D-10601 transform policy stands)
- No change to the `POST /api/me/avatar` route, auth level, request shape,
  error codes, or `{ avatarUrl }` success shape (D-10602 stands; only the
  host substring in the documented URL value changes)
- No R2 object move or re-upload — same bucket, new domain already serves it
- No new shared host-constant module — kept a mechanical per-file value swap;
  introducing a shared constant would be a refactor (out of this WP's class)
- The `images.barefootbetters.com/metadata` and `images.barefootbetters.com/docs`
  hosts (card-metadata JSON, rules PDF) are **out of scope** — a separate
  host question, not this WP
- No change to `player_links.url` validation (retains D-10405 open policy)
- No change to `avatar_visibility` / `about_me` / privacy columns

## Files Expected to Change

- `apps/server/src/profile/avatarUpload.logic.ts` — **modified** — `AVATAR_CDN_BASE` host
- `apps/server/src/profile/ownerProfile.logic.ts` — **modified** — `validateAvatarUrl` host (4 references + 1 comment)
- `apps/server/src/profile/avatarUpload.logic.test.ts` — **modified** — host literals
- `apps/server/src/profile/ownerProfile.logic.test.ts` — **modified** — host literals
- `data/migrations/021_rewrite_avatar_url_host.sql` — **new** — idempotent host-prefix rewrite
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `POST /api/me/avatar` row success-URL host (D-11804)
- `wiki/r2-image-naming-convention.md` — **modified** — Edge Cases "host moved" note
- `wiki/data-file-locations.md` — **modified** — Edge Cases + the host-table row
- `docs/ai/DECISIONS.md` — **modified** — land D-24083
- `docs/ai/STATUS.md` — **modified** — session close
- `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip to Done

## Contract

> **Output contract for this session (execution):**
> - Full file contents for every new or modified file (no diffs)
> - ESM only, Node v22+; human-style code per `00.6-code-style.md`
> - SQL migration is idempotent (re-runnable; second run is a no-op)
> - Error messages remain full sentences per code-style rule
> - The two hosts are the only strings that change in the code path

## Non-Negotiable Constraints

### Host values (locked)

- OLD avatar host base: `https://images.barefootbetters.com/avatars`
- NEW avatar host base: `https://images.legendary-arena.com/avatars`
- `AVATAR_CDN_BASE` (new): `'https://images.legendary-arena.com/avatars'`
- Per-user canonical URL (new): `https://images.legendary-arena.com/avatars/${accountId}.webp`
- Fallback `allowedPrefix` (new): `'https://images.legendary-arena.com/avatars/'`

### Closed-origin allowlist (supersedes the host in D-10601)

- After this WP, `validateAvatarUrl` accepts ONLY `null` or the authenticated
  user's canonical URL under the NEW host. The old barefootbetters host is
  no longer accepted on write — this is the validation-tightening surface.
- The per-user `{accountId}.webp` impersonation guard is preserved verbatim;
  only the host substring changes.

### Migration 021 (locked shape)

- Idempotent `UPDATE legendary.player_profiles` rewriting only rows whose
  `avatar_url` begins with the OLD host prefix, replacing the prefix with the
  NEW host prefix and preserving the `{accountId}.webp` tail exactly.
- Does **NOT** advance `updated_at` — the host move is a system migration, not
  an owner edit; the owner's last-edit timestamp is preserved (`// why:`).
- Re-running after the first apply matches zero rows (no row carries the old
  prefix) → a clean no-op, mirroring the WP-104 / WP-101 idempotent-migration
  precedent.

### Endpoint catalog (D-11804)

- The `POST /api/me/avatar` row in `api-endpoints.md` is replaced **entirely**
  (replace-whole-row merge semantics) with only the documented success-URL host
  changed. `Status` stays `Wired`; `Auth` stays `authenticated-session-required`.

## Acceptance Criteria

- [ ] `AVATAR_CDN_BASE` and `buildAvatarUrl` produce URLs under the new host
- [ ] `validateAvatarUrl` accepts the user's canonical NEW-host URL and `null`
- [ ] `validateAvatarUrl` rejects the OLD-host URL, another user's NEW-host URL,
      and any external URL (`code: 'invalid_avatar_url'`)
- [ ] Migration 021 rewrites an old-host row to the new host, preserves the
      `{accountId}.webp` tail, leaves `updated_at` unchanged, and is a no-op on
      second run and on already-new-host rows
- [ ] `api-endpoints.md` `POST /api/me/avatar` row shows the new-host success URL
- [ ] `pnpm --filter server test` passes (both profile test files updated)
- [ ] No `images.barefootbetters.com/avatars` reference remains in
      `apps/server/src/profile/**` or `api-endpoints.md`

## Verification Steps

```pwsh
# 1. New host actually serves the avatars/ prefix (the load-bearing precondition).
#    Pick a real {accountId}.webp from legendary.player_profiles, or any known key.
curl -I https://images.legendary-arena.com/avatars/<accountId>.webp
# Expected: HTTP/2 200 (same object the barefootbetters host returns)

# 2. Scaffold + suite (validation-tightening — run before claiming additive).
pnpm --filter server test
# Expected: green; the old-host fixtures are updated to the new host

# 3. No stale host in the avatar code path.
grep -r "images.barefootbetters.com/avatars" apps/server/src/profile docs/ai/REFERENCE/api-endpoints.md
# Expected: no matches
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Migration 021 applied to the deployed database (operator step) — existing
      rows rewritten; new uploads already write the new host
- [ ] D-24083 landed (Active) in `docs/ai/DECISIONS.md`
- [ ] `api-endpoints.md` updated in the same commit (D-11804) — lint §21 passes
- [ ] Both wiki Edge Cases notes updated to "drift resolved"
- [ ] `docs/ai/STATUS.md` updated
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped to Done with date
- [ ] No files outside the "Files Expected to Change" list were modified
- [ ] Post-deploy confirmation: a real profile's avatar still renders (new host
      serves the same bytes) — `User-Visible Surface = none — infrastructure`,
      so STATUS.md states "No user-observable change — infrastructure only"

## User-Visible Surface

`none — infrastructure`. A user sees the identical avatar before and after — the
bytes are unchanged and the new domain serves the same object. The change is a
host string, a stored-value rewrite, and a catalog/wiki reconciliation. The
post-deploy confirmation is a no-regression check (avatars still load; the new
host returns 200), not a visible-change verification.

## Lane

Two-session (NOT lightweight per D-24028). Five non-governance files (4 server
logic/test + 1 migration), and a `.sql` migration does not fit the lightweight
budget's "≤4 code/test + ≤1 runtime-wiring" slot — D-24028 resolves that
ambiguity against the lane. The change also touches the persistence surface (a
stored-row rewrite) and the api-endpoints catalog (D-11804), both of which the
lightweight lane excludes.

## Reserves

- **D-24083** — Avatar CDN host unification (supersedes the host string only in
  D-10601 and D-10602; both otherwise stand).

## Lint Gate Self-Review

`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — 21 sections. Result below;
all PASS or justified N/A.

- §1 Single responsibility — PASS (one outcome: avatar host unification)
- §2 Layer boundary respected — PASS (server layer + its persistence + governance ledgers; no cross-layer code)
- §3 Scope (In)/(Out) closed enumeration — PASS (both present; metadata/docs host + transform policy explicitly excluded)
- §4 Files allowlist present — PASS (§Files Expected to Change)
- §5 Dependencies cited — PASS (WP-104, WP-106; baseline SHA recorded)
- §6 Contract section present — PASS
- §7 Acceptance criteria testable — PASS
- §8 Verification steps runnable — PASS (curl + suite + grep)
- §9 Definition of Done binary — PASS
- §10 No invented mechanics/state — PASS (string + stored-value migration only)
- §11 Determinism — N/A (no engine `G`/`ctx`/RNG/`finalStateHash` surface; `avatar_url` is app DB)
- §12 Persistence boundary — PASS (rewrite is app-layer DB only; `G` untouched; per legendary-persistence the server owns this data)
- §13 Locked values verbatim — PASS (host strings + migration shape locked)
- §14 Required `// why:` comments identified — PASS (migration `updated_at`-unchanged rationale; EC mirrors)
- §15 No `.reduce()` / no `Math.random()` in scope — PASS (no such code added)
- §16 Error messages full sentences — PASS (existing messages retained, host substring only)
- §17 Test extension `.test.ts` — PASS (existing files)
- §18 Canonical field names — PASS (`avatar_url` / `avatarUrl` unchanged; no field rename)
- §19 Contract-file lock respected — PASS (no `.types.ts`/`.validate.ts`/`.gating.ts` change)
- §20 DECISIONS entry for locked choices — PASS (D-24083 reserved)
- §21 API catalog obligation (D-11804) — PASS (api-endpoints.md `POST /api/me/avatar` row in allowlist + same commit; whole-row replace; Status/Auth closed-sets unchanged)

## Pre-flight + Copilot Verdict (Step 5, on record)

**Pre-flight (01.4): READY TO EXECUTE.**
- Dependencies complete on `main`: WP-104 (avatar_url column) ✅, WP-106 (avatar
  pipeline + allowlist) ✅. Baseline `origin/main` @ `f11c2de1` recorded.
- Cited authority/contracts present on `main`: D-10601, D-10602, D-11804.
- Scope locked: §Files Expected to Change == EC-328 §Files to Produce.
- **Empirical Scaffold (01.4 §Empirical Scaffold — validation-tightening) — OBSERVED,
  not reasoned.** Baseline `ownerProfile.logic.test.ts` + `avatarUpload.logic.test.ts`
  = 43 tests, 0 fail (7 DB-skips). With the host swap applied to the two LOGIC
  files only, re-run failed on exactly the host-literal assertions in those two
  test files (`buildAvatarUrl` canonical URL; `validateAvatarUrl` closed-origin /
  per-user / prefix). Zero failures outside the allowlist. The validation-tightening
  fixture-breakage is empirically confined to the two allowlisted test files; the
  prototype was reverted (draft branch carries only governance artifacts).

**Copilot (01.7): PASS (1 RISK documented).**
- RISK: the move's load-bearing operational precondition is that
  `images.legendary-arena.com` serves the `avatars/` prefix. It almost certainly
  does (same `legendary-images` bucket, the live card-image domain), but it is a
  Cloudflare-side fact. Mitigation: EC-328 §Before/After gates a
  `curl -I … /avatars/<accountId>.webp` → 200 check before the allowlist flips and
  again post-deploy. Not a blocker; surfaced for the executing operator.

## Decision Points

- D-24083: Avatar CDN host unification (reserved at draft 2026-06-30; lands at execution)

## Failure Conditions

- New host does not serve `avatars/` → broken avatars (the §Verification curl
  is the gate that catches this before the allowlist flips)
- Migration 021 not idempotent → second apply errors or double-rewrites the host
- Migration advances `updated_at` → silently corrupts owner last-edit timestamps
- `api-endpoints.md` not updated in the same commit → D-11804 / lint §21 violation
- Old-host barefootbetters reference left in `apps/server/src/profile/**` → mixed
  hosts; new uploads + old validator disagree
