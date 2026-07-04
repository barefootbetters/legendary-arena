# EC-335 — Owner-Page Identity Fields (WP-305)

**WP:** [WP-305](../work-packets/WP-305-owner-profile-identity-fields.md) · **Lane:** Standard two-session (D-24028) · **Baseline:** `origin/main` @ `775bd71d`
**Layers:** Server (`apps/server`) + App (`apps/arena-client`) · **Surface:** `play.legendary-arena.com` `?route=me`

Authority order: `.claude/CLAUDE.md` → `ARCHITECTURE.md` → `.claude/rules/*` → WP-305 → this EC → source. WP wins on conflict.

## Before Starting
- [ ] Deps ✅ on `main`: WP-104 (contract + page), WP-101 (`validateDisplayName` + `display_handle`), WP-131 (auth), WP-052/D-5201 (`AccountId`=`ext_id`).
- [ ] Read `ownerProfile.types.ts`, `ownerProfile.logic.ts` (esp. `loadPlayerIdByAccountId`, `synthesizeDefaultOwnerProfileView`, `composeOwnerProfileView`, `upsertOwnerProfile`), `ownerProfileApi.ts`, `MyProfilePage.vue`, and `identity.logic.ts:66-98`.
- [ ] Baseline green: `pnpm --filter @legendary-arena/server test`, `pnpm -r build`, arena-client `typecheck`/`test`/`build`. DB suites need `TEST_DATABASE_URL` (repo `.env` `DATABASE_URL`).

## Locked Values (do NOT re-derive)
- New `OwnerProfileView` sorted key set (**12**): `accountId, aboutMe, aboutMeVisibility, avatarUrl, avatarVisibility, badges, displayName, handle, links, linksVisibility, teamAffiliations, updatedAt`.
- Field types: `accountId: AccountId` · `displayName: string` (NOT NULL) · `handle: string | null` (from `display_handle`, null pre-claim).
- `OwnerProfilePatch` adds ONLY `displayName?: string` (never `| null`). `handle`/`accountId` are NOT patchable.
- `display_name` rules (mirror `identity.logic.ts:66-98`): trim; reject empty-after-trim, `>64` after trim, any `0x00-0x1F`/`0x7F` control char → `code: 'invalid_display_name'`.
- New error code `'invalid_display_name'` added to BOTH `OwnerProfileErrorCode` union AND `OWNER_PROFILE_ERROR_CODES` array. Route maps it to 400 (existing "remaining codes → 400" branch).
- `display_name` is on `legendary.players` (NOT `legendary.player_profiles`) → editable-name PATCH writes a SECOND table.

## Guardrails
- [ ] Name write (`UPDATE legendary.players SET display_name`) and the `player_profiles` upsert run in ONE `BEGIN/COMMIT` (mirror `replaceOwnerLinks`); both land or neither. No `displayName` in body → no `players` write.
- [ ] `synthesizeDefaultOwnerProfileView` is NO LONGER a static literal — it must carry the real `accountId`/`displayName`/`handle` (the `legendary.players` row always exists).
- [ ] `handle` + `accountId` are display-only — no write path, no patch field, no route acceptance.
- [ ] Client mirror stays STRUCTURAL — no `apps/server` / `packages/*` / `boardgame.io` import added to arena-client.
- [ ] No new endpoint/route; reuse `GET`/`PATCH /api/me/profile`. Auth surface unchanged.
- [ ] Every new `MyProfilePage.vue` binding (`formDisplayName`, name-error state, etc.) is returned from `setup()` (D-6512 separate-compile).
- [ ] Union+array drift: update `OwnerProfileErrorCode` and `OWNER_PROFILE_ERROR_CODES` in the SAME edit (drift test asserts both directions).

## Required `// why:` Comments
- [ ] On the local `validateDisplayName`: cite `identity.logic.ts:66-98` as the source (rules re-derived because the identity validator is not exported / WP-052 locked).
- [ ] On the `BEGIN/COMMIT` wrap in `upsertOwnerProfile`: why the two-table write must be atomic.
- [ ] On `synthesizeDefaultOwnerProfileView` gaining identity params: why the players row is always present on this path.

## Files to Produce (allowlist)
- [ ] `apps/server/src/profile/ownerProfile.types.ts` — view +3 fields; patch +`displayName?`; error union+array +`invalid_display_name`.
- [ ] `apps/server/src/profile/ownerProfile.logic.ts` — read helper +`display_name`/`display_handle`; compose/synthesize threading; local `validateDisplayName`; transactional name write.
- [ ] `apps/server/src/profile/ownerProfile.logic.test.ts` — drift 9→12; read-field + editable-name + `invalid_display_name` + atomicity tests.
- [ ] `apps/arena-client/src/lib/api/ownerProfileApi.ts` — mirror +3 read fields + `displayName?`.
- [ ] `apps/arena-client/src/lib/api/ownerProfileApi.test.ts` — shape assertions.
- [ ] `apps/arena-client/src/pages/MyProfilePage.vue` — render displayName (editable) / `@handle` / accountId; `setup()` bindings.

## After Completing
- [ ] `api-endpoints.md` GET + PATCH `/api/me/profile` rows — whole-row update (D-11804), field names per `00.2`.
- [ ] Flip `STATUS.md`, `WORK_INDEX.md` (WP-305), `EC_INDEX.md` (EC-335); DECISIONS D-24089 + D-24090 Drafted → Active.
- [ ] Two-commit topology: `EC-335:` impl + `SPEC:` governance close. `git diff --name-only` = allowlist + governance only.
- [ ] D-24026 live-verify on `play.legendary-arena.com` after deploy (heading name, `@handle`, account-ID line; edit+save persists; invalid name errors).

## Common Failure Smells
- Editing name but forgetting it writes `legendary.players`, not `player_profiles` → the upsert "succeeds" but the name never changes.
- Leaving `synthesizeDefaultOwnerProfileView` static → never-edited accounts return `undefined`/missing identity fields and the drift test fails.
- Reusing the sibling `{ error }` parse for a `displayName` validation failure — fine here (profile endpoints use `{ error }`); do NOT copy the avatar `{ code }` parser.
- Non-atomic name write → a failed profile upsert leaves a renamed player (AC-2 atomicity test catches it).
