# EC-114 — Handle Claim Flow & Global Uniqueness (Execution Checklist)

**Source:** docs/ai/work-packets/WP-101-handle-claim-flow.md
**Layer:** Server / Identity (extends WP-052 `legendary.players`; engine untouched)

> *Renumbered from EC-101 to EC-114 on 2026-04-27 per filename collision
> with the older `EC-101-viewer-ci-hardening.checklist.md` (the
> "EC-101+ viewer series" namespace keystone). Follows the
> EC-103 → EC-111 retarget precedent. WP number unchanged
> (still WP-101); only the EC slot moved.*

**Execution Authority:**
This EC is the authoritative execution checklist for WP-101.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-101.

---

## Before Starting (STOP / GO Gate)

Execution **MUST NOT START** unless every box below is checked. If any
item is unchecked → **STOP**. Fix the missing precondition before
proceeding; do not paper over it.

- [ ] WP-101 status flipped Draft → Executing; pre-flight bundle registered
- [ ] WP-052 complete; `legendary.players` exists with `bigserial` PK + `ext_id text UNIQUE` + `email text UNIQUE` + `display_name text NOT NULL`
- [ ] WP-103 migration `006_create_replay_blobs_table.sql` already landed; new migration uses slot **`007`**
- [ ] `apps/server/src/identity/identity.types.ts` exports `AccountId`, `PlayerAccount`, `Result<T>`, `IdentityErrorCode`
- [ ] `apps/server/src/identity/identity.logic.ts` exports `findPlayerByAccountId`
- [ ] `pnpm -r build` exits 0; `pnpm test` exits 0 with engine **522 / 116 / 0** + server **36 / 6 / 0** (or 36 with skips when no test DB)
- [ ] `git diff --name-only packages/ apps/ data/migrations/` empty at start

## Locked Values (do not re-derive)

- Migration number: `data/migrations/007_add_handle_to_players.sql`
- Canonicalization order (locked): `trim()` → `toLowerCase()` is applied **before** regex validation, reserved-set checks, DB writes, and all comparisons. Every check in this packet runs against the canonical form, never the user-submitted casing.
- Handle format regex: `^[a-z][a-z0-9_]{2,23}$` (matches the canonical, post-`trim().toLowerCase()` form)
- Reserved-handle set (15 entries, alphabetical, canonical lowercase): `admin, administrator, anonymous, api, arena, guest, legendary, mod, moderator, null, root, staff, support, system, undefined`
- Handle column shapes added to `legendary.players`: `handle_canonical text` (nullable until claim; partial UNIQUE on IS NOT NULL); `display_handle text`; `handle_locked_at timestamptz` — three columns NULL together or non-NULL together (mutual presence)
- `HandleErrorCode` (5 values): `'invalid_handle' | 'reserved_handle' | 'handle_taken' | 'handle_already_locked' | 'unknown_account'`
- `HandleClaim` (4 fields, immutable after claim): `accountId`, `handleCanonical`, `displayHandle`, `handleLockedAt`
- `Result<T>` shape **re-imported** from `identity.types.ts`, never redeclared
- Idempotent claim SQL pattern (verbatim): `UPDATE legendary.players SET handle_canonical = $2, display_handle = $3, handle_locked_at = now() WHERE ext_id = $1 AND handle_canonical IS NULL RETURNING ext_id, handle_canonical, display_handle, handle_locked_at;` — `'23505'` on `handle_canonical` UNIQUE → `code: 'handle_taken'`; empty `RETURNING` + `findPlayerByAccountId` disambiguates `unknown_account` vs `handle_already_locked` vs idempotent re-claim
- `display_handle` is presentation-only: never used for lookup, authorization, routing, uniqueness checks, or identity inference. All authoritative operations key on `handle_canonical` or `AccountId`.
- Public-surface invariant (per WP-101 §Authorized Future Surfaces): handle is a presentation alias; `AccountId` is the stable identity key — future surfaces (WP-102 etc.) MUST dereference handle → `AccountId` at point of use

## Guardrails

- No `boardgame.io` / `@legendary-arena/game-engine` / engine `PlayerId` import in any new file under `apps/server/src/identity/handle*` (verified by `Select-String`).
- WP-052 contract files (`identity.types.ts`, `identity.logic.ts`) NOT modified; WP-052 migrations `004` and `005` NOT modified; WP-103 migration `006` NOT modified; `packages/game-engine/src/types.ts` NOT modified — all verified by `git diff`.
- `claimHandle` accepts a verified `AccountId` parameter only; never an arbitrary string from an HTTP body. The caller-injected `requireAuthenticatedSession` (future WP-112; renumbered from "WP-100" per D-10002) is the source of truth; tests inject a fixture `AccountId` directly.
- Single locked UPDATE statement is the only code path that writes handle columns. No second UPDATE may set `handle_canonical`, `display_handle`, or `handle_locked_at` on rows where they are non-NULL.
- `validateHandleFormat` is pure (no DB access, no async). Step order (locked, mirrors WP-101 §Scope (In) §B): trim input → check non-empty → check no consecutive underscores (`__`) in canonical → match `HANDLE_REGEX` → check canonical against `RESERVED_HANDLES`. Regex runs **before** reserved-set; the consecutive-underscore check is in code, not regex.
- Tombstone behavior: deleted handles drop out of the partial UNIQUE index along with the row and become re-claimable by a different account. Anti-impersonation reservation is **out of scope** for WP-101.
- "Replay handle" terminology from `DESIGN-RANKING.md` lines 145, 205 refers to `replayHash`. WP-101's `handle` / `Handle*` symbols always refer to the user-facing account identifier — no symbol introduced here is named with "replay" as a prefix.

## Required `// why:` Comments

- `handle.types.ts` `HandleClaim` interface: 4-field shape locked; addition or rename requires DECISIONS.md.
- `handle.types.ts` `RESERVED_HANDLES` export: array (not regex) so tests can assert exact content and future WPs can read the locked set without duplicating it.
- `handle.types.ts` `HANDLE_REGEX` export: pattern exposed so the drift test can assert `HANDLE_REGEX.source === '^[a-z][a-z0-9_]{2,23}$'` byte-for-byte.
- `handle.logic.ts` `validateHandleFormat`: separated from `claimHandle` so future "is this handle available?" preview APIs can validate without writing.
- `handle.logic.ts` `claimHandle` idempotency: matches WP-052 `assignReplayOwnership` precedent; safe under network retry.
- `007_add_handle_to_players.sql` partial unique index: `WHERE handle_canonical IS NOT NULL` permits multiple pre-claim NULLs while enforcing global uniqueness once any handle is claimed.
- `007_add_handle_to_players.sql` `ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS`: WP-052 idempotency precedent for migration runner safety.

## Files to Produce

### Commit A (EC-114 execution — handle-claim logic)

- `apps/server/src/identity/handle.types.ts` — **new** — `HandleClaim`, `HandleErrorCode`, `HANDLE_ERROR_CODES`, `RESERVED_HANDLES`, `HANDLE_REGEX`; re-imports `Result<T>` and `AccountId` from `identity.types.ts`
- `apps/server/src/identity/handle.logic.ts` — **new** — `validateHandleFormat`, `claimHandle`, `findAccountByHandle`, `getHandleForAccount`
- `apps/server/src/identity/handle.logic.test.ts` — **new** — 12 tests in one `describe('handle logic (WP-101)', …)` block (+1 suite); tests 10–12 require test DB and use `hasTestDatabase ? {} : { skip: 'requires test database' }` per WP-052 precedent
- `data/migrations/007_add_handle_to_players.sql` — **new** — `ADD COLUMN IF NOT EXISTS` for three columns + partial `CREATE UNIQUE INDEX IF NOT EXISTS … WHERE handle_canonical IS NOT NULL`

### Commit B (SPEC governance close — not EC-114)

- `docs/ai/STATUS.md` — **modified** — `### WP-101 / EC-114 Executed — Handle Claim Flow ({YYYY-MM-DD}, EC-114)` block at top of `## Current State`
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-101 row flipped `[ ]` → `[x]` with date + SPEC commit hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-114 row flipped `Draft` → `Done {YYYY-MM-DD}`
- `docs/ai/DECISIONS.md` — **modified (optional per author)** — at minimum a one-line decision noting the no-tombstone policy is recorded if the executor judges it worth a `D-101NN` anchor; otherwise the policy lives in WP-101 alone

## After Completing

- [ ] WP-101 acceptance criteria pass; engine baseline **522 / 116 / 0** unchanged; server **36 / 6 / 0** → **48 / 7 / 0** (+12 tests / +1 suite; or 48 with skips when no test DB)
- [ ] `Select-String -Path "apps\server\src\identity\handle*" -Pattern "from ['\"]boardgame\.io"` returns no output
- [ ] `Select-String -Path "apps\server\src\identity\handle*" -Pattern "from ['\"]@legendary-arena/game-engine"` returns no output
- [ ] `Select-String -Path "packages\game-engine\src" -Pattern "HandleClaim|HANDLE_ERROR_CODES|RESERVED_HANDLES|HANDLE_REGEX" -Recurse` returns no output
- [ ] `Select-String -Path "data\migrations\007_add_handle_to_players.sql" -Pattern "ADD COLUMN IF NOT EXISTS"` returns three matches
- [ ] `Select-String -Path "data\migrations\007_add_handle_to_players.sql" -Pattern "WHERE handle_canonical IS NOT NULL"` returns at least one match
- [ ] `Select-String -Path "apps\server\src\identity\handle.logic.ts" -Pattern "UPDATE legendary\.players"` returns exactly one match (the locked claim SQL)
- [ ] `git diff` empty for `identity.types.ts`, `identity.logic.ts`, migrations `004`/`005`/`006`, and `packages/game-engine/src/types.ts`
- [ ] `git diff --name-only` limited to the files listed in `## Files to Produce`
- [ ] EC-114 commit body includes a `Vision: §3, §11, §14, §25` trailer per `01.3-commit-hygiene-under-ec-mode.md`
- [ ] EC_INDEX EC-114 row updated `Draft` → `Done {YYYY-MM-DD}`

## Common Failure Smells

- Migration named `006_*` — STOP; WP-103 already took slot `006`. Rename to `007_add_handle_to_players.sql` and re-grep.
- Engine baseline reads `513 / 115 / 0` after run — STOP; the post-WP-053a baseline is `522 / 116 / 0`. Re-read WP-101 §Assumes; if engine drifted from `522 / 116 / 0`, this WP touched the engine (layer violation).
- `Result<T>` redeclared in `handle.types.ts` — STOP; the locked value says re-import from `identity.types.ts`. A parallel declaration creates two incompatible structural types and breaks WP-052 callers.
- Tombstone column or `legendary.deleted_handles` table introduced — STOP; the no-tombstone policy is locked in WP-101 §Non-Negotiable Constraints. Anti-impersonation reservation requires a successor WP, not a covert addition here.
- `handleHash` / `replayHandle` / similar "replay-prefixed" symbol introduced — STOP; the terminology disambiguation rule forbids it. The user-facing account identifier never carries a "replay" prefix.
