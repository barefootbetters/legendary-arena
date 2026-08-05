# EC-535 — Auto-Assign Changeable Handles at Sign-In + Backfill (Execution Checklist)

**Source:** docs/ai/work-packets/WP-500-auto-assign-handles.md
**Layer:** Server (`apps/server` — identity + auth). Standard two-session lane. No engine/registry/client change; no schema migration.

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] `pnpm -r build` first (server imports the registry + engine dist)
- [ ] Precond A: `grep -q "handle_canonical = \$2" apps/server/src/identity/handle.logic.ts` (claimHandle is the current sole writer)
- [ ] Precond B: `! grep -q "handle_canonical" apps/server/src/auth/accountProvisioning.logic.ts` (provisioning sets no handle)
- [ ] Precond C: `grep -q "provisionPlayerAccount(" apps/server/src/auth/accountResolver.logic.ts` (wiring point)
- [ ] Precond D: `grep -q "HANDLE_REGEX" apps/server/src/identity/handle.types.ts` (format to derive against)
- [ ] DB-gated tests runnable: `TEST_DATABASE_URL` set + migrations applied (see `project_db_backed_server_tests_local`)
- [ ] Working tree clean except this WP

## Locked Values (do not re-derive)
- `deriveHandle(displayName: string): string` in `handle.logic.ts`, PURE. **Deterministic** steps (each branch pinned to ONE choice): (1) `trim` → `toLowerCase`; (2) replace every run of `[^a-z0-9]` with a single `_`; (3) strip leading/trailing `_`; (4) if empty → return **`player`**; (5) if the first char is not `[a-z]`, **prefix `u`** (the pinned choice — not drop-leading); (6) truncate to 24; (7) if length < 3, **right-pad with `0`** to length 3; (8) if the result is in `RESERVED_HANDLES` OR (defensively) fails `HANDLE_REGEX`, return **`player`**. Pinned outputs: `Jeff`→`jeff`, `Spider-Man`→`spider_man`, `88Legend`→`u88legend`, `Jo`→`jo0`, emoji/empty/reserved→`player`. MUST always return a `HANDLE_REGEX`-valid string.
- `assignAutoHandle(accountId, displayName, database): Promise<string | null>` in `handle.logic.ts`. Compute `base = deriveHandle(displayName)`. Try candidates `base`, `base2`, `base3`, … (bounded, e.g. 20) then a final fallback `${baseTrunc}${short-hex-of-ext_id}`. **For every candidate: truncate `base` to `24 − suffix.length` BEFORE appending the suffix, then assert the candidate matches `HANDLE_REGEX` before the UPDATE** (a 24-char base must never overflow to 25 — `handle_canonical` is bare `text` with no length CHECK, so an invalid handle would silently persist). Per candidate: `UPDATE legendary.players SET handle_canonical = $2, display_handle = $2 WHERE ext_id = $1 AND handle_canonical IS NULL RETURNING handle_canonical`. On a partial-unique `23505` (candidate taken by another account), advance to the next candidate; on empty `RETURNING` with no error, the row already had a handle (or does not exist) → return `null` (idempotent no-op). **NEVER write `handle_locked_at`** (leave NULL = changeable). Return the assigned handle string, or `null`. **Do NOT `throw`** — `handle.logic.ts` advertises zero `throw` matches (WP-101 gate); on an unexpected non-`23505` DB error, `return Promise.reject(error)` (the claimHandle precedent) so the file keeps its no-`throw` property and the caller's `try/catch` handles it.
- Update the `handle.logic.ts` module header: `claimHandle` is no longer the *sole* writer — `assignAutoHandle` is a second, disjoint writer (writes only `handle_canonical` + `display_handle`, never `handle_locked_at`). State the amended mutual-presence invariant (D-24303 §5).
- Resolver wiring: in `attemptProvisioning` (`accountResolver.logic.ts`), AFTER a successful `provisionPlayerAccount`, call `assignAutoHandle(provisionResult.value.accountId, displayName, database)` inside an **explicit `try/catch`** that logs + continues. (This is a direct DB call — it needs a REAL call-site `try/catch`, NOT the D-24079 marketing-enqueue pattern, which is fail-open only because it is a dependency-injected fail-safe wrapper.) A handle failure MUST NOT change the returned `Result` (sign-in unbroken). NOTE: `attemptProvisioning` is the resolver's **no-match branch only** — this fires for newly-provisioned accounts, NOT on an existing account's login (existing NULL-handle accounts are healed by the backfill).
- `scripts/backfill-handles.mjs`: ESM, `node:` imports; run as `node --env-file=.env scripts/backfill-handles.mjs` (needs `DATABASE_URL`). Connect via `pg`; `SELECT ext_id, display_name FROM legendary.players WHERE handle_canonical IS NULL`; for each call `assignAutoHandle`; print `assigned N / skipped M`. Idempotent + re-runnable. **Import the server TS via the `scripts/process-stripe-events.mjs` / D-13405 precedent** — `apps/server` emits NO dist, so resolve `tsx` from `apps/server` devDeps via `createRequire`, call `register()` on `tsx/esm/api`, then dynamic-`import()` the `.ts` source via `pathToFileURL`. Reuses the SAME `deriveHandle`/`assignAutoHandle` — NO re-implemented slug logic, NO `import` of a non-existent dist.

## Guardrails
- `assignAutoHandle` writes ONLY `handle_canonical` + `display_handle`; `handle_locked_at` stays NULL. Any write to `handle_locked_at` here is a contract violation (that column marks an explicit lock, D-24303).
- Idempotent: assign ONLY `WHERE handle_canonical IS NULL`. Never overwrite an existing handle (that is the follow-up change/claim path).
- Fail-open: a handle-assign error never breaks sign-in / resolution — swallow + log with a `// why:`.
- `deriveHandle` is PURE (no DB, no I/O) and ALWAYS returns a `HANDLE_REGEX`-valid string (fall back to `player`).
- No SQL-migration backfill (slug divergence); reuse the TS functions in the Node script.
- Do NOT touch `claimHandle`'s guard, `findAccountByHandle`, `getHandleForAccount`, the profile projections, the friends/invite flows, or `handle.types.ts` closed unions.
- Zero determinism/persistence-of-`G` surface; no re-pin (N/A — server identity).
- If any of {new closed-union/contract file change, layer crossing, a schema migration turns out necessary, scope ambiguity} arises → STOP and re-scope.

## Required `// why:` Comments
- On `assignAutoHandle` NOT writing `handle_locked_at` (why: NULL lock = auto-assigned/changeable; a claim later sets it — D-24303).
- On the `23505` retry branch (why: the partial-unique on `handle_canonical` means the candidate was taken concurrently; advance the suffix).
- On the resolver fail-open wrap (why: a handle-assign hiccup must never break sign-in; mirrors the D-24079 marketing-enqueue boundary).

## Files to Produce
- `apps/server/src/identity/handle.logic.ts` — **modified** — `deriveHandle` + `assignAutoHandle` + amended header
- `apps/server/src/identity/handle.logic.test.ts` — **modified** — `deriveHandle` + `assignAutoHandle` (DB-gated) tests
- `apps/server/src/auth/accountResolver.logic.ts` — **modified** — fail-open `assignAutoHandle` wiring
- `apps/server/src/auth/accountResolver.logic.test.ts` — **modified** — assign-on-provision + fail-open tests
- `scripts/backfill-handles.mjs` — **new** — one-time backfill
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` / `NUMBER-LEDGER.md` / `DECISIONS.md` — **modified** — governance close

## After Completing
- [ ] `deriveHandle` + `assignAutoHandle` unit + DB-gated tests green; resolver assign-on-provision + fail-open tests green
- [ ] Backfill script run against the test DB: `findAccountByHandle(deriveHandle(name))` resolves a previously-NULL account
- [ ] `pnpm -r build` + `pnpm --filter @legendary-arena/server test` exit 0
- [ ] `git diff --name-only | grep -vE '^(apps/server/src/(identity/handle\.logic|auth/accountResolver\.logic)\.(ts|test\.ts)|scripts/backfill-handles\.mjs|docs/)'` → NO MATCH
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; NUMBER-LEDGER RESERVED→LANDED; D-24303 Active; ROADMAP node `✅` + counts; `api-endpoints.md` updated if a Library-only row changed
- [ ] Commit prefix: `EC-535:` (code) + `SPEC:` (governance); D-24026 live-verify (handle shows + friend-request resolves) operator-pending after the prod backfill run

## Common Failure Smells
- `assignAutoHandle` overwrites an existing handle → missing the `AND handle_canonical IS NULL` guard; it must be idempotent.
- `handle_locked_at` set non-NULL by the auto path → breaks the changeable model; only an explicit claim (follow-up WP) may lock.
- Sign-in fails when the handle can't be assigned → the fail-open wrap is missing/incorrect; resolution must succeed regardless.
- `deriveHandle` returns a value that fails `HANDLE_REGEX` (e.g. leading digit, `__`, too short) → the fallback chain is incomplete; every path must end in a valid slug or `player`.
- A sole-writer verification note/grep for `handle_locked_at` trips → update the header + the note in lockstep (assignAutoHandle is a sanctioned second writer of canonical+display only).
- Backfill re-implements the slug in SQL → divergence from `deriveHandle`; the script MUST call the TS function.
