# EC-328 — Avatar CDN Host Unification (Execution Checklist)

**Source:** docs/ai/work-packets/WP-296-avatar-cdn-host-unification.md
**Layer:** Server (`apps/server/src/profile/`) + persistence (`data/migrations/`)

## Before Starting
- [ ] WP-104 complete — `legendary.player_profiles.avatar_url` column exists
- [ ] WP-106 complete — `AVATAR_CDN_BASE` + `validateAvatarUrl` on the OLD host
- [ ] Target file set is EXACTLY the §Files to Produce list — any file outside it is a FAIL
- [ ] `pnpm install` has run in this worktree (fresh worktrees ship without `node_modules`)
- [ ] `pnpm --filter server test` exits 0 (baseline green BEFORE any edit)
- [ ] **Scaffold (REQUIRED — validation-tightening):** apply the host swap to
      `ownerProfile.logic.ts` + `avatarUpload.logic.ts`, run `pnpm --filter server test`,
      and record the observed failures. They MUST be confined to the two profile test
      files in the allowlist (host literals). A failure in any other file → STOP and
      reconcile scope before proceeding.

## Locked Values (do not re-derive)
- OLD avatar host base: `https://images.barefootbetters.com/avatars`
- NEW avatar host base: `https://images.legendary-arena.com/avatars`
- `AVATAR_CDN_BASE` (new): `'https://images.legendary-arena.com/avatars'`
- Per-user canonical URL (new): `https://images.legendary-arena.com/avatars/${accountId}.webp`
- Fallback `allowedPrefix` (new): `'https://images.legendary-arena.com/avatars/'`
- Migration slot: `data/migrations/021_rewrite_avatar_url_host.sql`
- Migration WHERE matches only rows beginning with the OLD host prefix; replaces the
  prefix, preserves the `{accountId}.webp` tail exactly; does NOT set `updated_at`
- Catalog row replaced whole (D-11804): `POST /api/me/avatar`, `Status: Wired`,
  `Auth: authenticated-session-required` unchanged — only the success-URL host changes

## Guardrails
1. The two host strings are the ONLY values that change in the code path — no
   behavior, route, error-code, field-name, or transform-policy edits
2. Migration 021 MUST be idempotent — second apply matches zero rows (no-op);
   an already-new-host row is never double-rewritten
3. Migration MUST NOT advance `updated_at` — a host move is a system migration,
   not an owner edit (preserve the owner's last-edit timestamp)
4. `api-endpoints.md` `POST /api/me/avatar` row updated in the SAME commit (D-11804)
5. No `images.barefootbetters.com/avatars` reference may remain in
   `apps/server/src/profile/**` or `api-endpoints.md` after the change
6. The per-user `{accountId}.webp` impersonation guard is preserved verbatim
7. No new shared host-constant module — mechanical per-file value swap only
8. Do NOT touch the `images.barefootbetters.com/metadata` or `/docs` hosts

## Required `// why:` Comments
- `021_rewrite_avatar_url_host.sql`: why `updated_at` is deliberately left unchanged
  (system migration, not an owner edit) and why the prefix `LIKE` makes it idempotent
- `ownerProfile.logic.ts` canonical-URL comment: keep the D-10601 per-user rationale;
  update only the host in the worked example (do not echo the OLD host)

## Files to Produce
- `apps/server/src/profile/avatarUpload.logic.ts` — **modified** — `AVATAR_CDN_BASE` host
- `apps/server/src/profile/ownerProfile.logic.ts` — **modified** — `validateAvatarUrl` host (4 refs + comment)
- `apps/server/src/profile/avatarUpload.logic.test.ts` — **modified** — host literals
- `apps/server/src/profile/ownerProfile.logic.test.ts` — **modified** — host literals
- `data/migrations/021_rewrite_avatar_url_host.sql` — **new** — idempotent host-prefix rewrite
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `POST /api/me/avatar` success-URL host (D-11804)
- `wiki/r2-image-naming-convention.md` — **modified** — Edge Cases "host moved" note
- `wiki/data-file-locations.md` — **modified** — Edge Cases + host-table row
- `docs/ai/DECISIONS.md` — **modified** — land D-24083

## After Completing
- [ ] `pnpm --filter server test` exits 0 (both profile test files updated)
- [ ] `grep -r "images.barefootbetters.com/avatars" apps/server/src/profile docs/ai/REFERENCE/api-endpoints.md` → no matches
- [ ] Migration 021 idempotency proven (apply twice; second run rewrites 0 rows)
- [ ] D-24083 landed (Active) in `docs/ai/DECISIONS.md`
- [ ] `api-endpoints.md` row updated (lint §21 / D-11804 satisfied)
- [ ] Both wiki Edge Cases notes say "drift resolved"
- [ ] `docs/ai/STATUS.md` updated — "No user-observable change — infrastructure only"
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped to Done with date
- [ ] Post-deploy: a real profile's avatar still renders; `curl -I` new-host URL → 200

## Common Failure Smells
- Avatars break after deploy → the new domain does not serve `avatars/`; the
  pre-flip `curl -I` gate was skipped
- Second migration apply errors or changes row count → WHERE not prefix-guarded / not idempotent
- Owner "last edited" timestamps all jump to the migration date → migration set `updated_at`
- A later PR's CI trips lint §21 → `api-endpoints.md` host not updated in the same commit
