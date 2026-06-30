# EC-325 — Game-Signup → Brevo Marketing List (Execution Checklist)

**Source:** docs/ai/work-packets/WP-293-game-signup-brevo-enqueue.md
**Layer:** Server

## Before Starting
- [ ] WP-174 provisioning path present: `provisionPlayerAccount` +
      `attemptProvisioning` in `apps/server/src/auth/` — confirmed on `main`
- [ ] WP-131 `productionAccountResolver` constructed in `apps/server/src/server.mjs`
- [ ] Read the badge fire-and-forget precedent (`competition.logic.ts`, D-10501)
      and the `AvatarR2Client` caller-injected pattern (`avatarUpload.types.ts`)
- [ ] Exact target file set = `## Files to Produce` below; any file outside it is a FAIL — surface as a blocker, do not edit
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (record baseline)

## Locked Values (do not re-derive)
- New directory: `apps/server/src/marketing/`
- `BrevoClient.addContactToList({ email: string; listId: number }): Promise<void>`
- Brevo: `POST https://api.brevo.com/v3/contacts`; header `api-key: <BREVO_API_KEY>`;
  body `{ email, listIds: [listId], updateEnabled: true }`
- Wrapper `enqueuePlayerToMarketingList(account, brevoClient, listId)`:
  `undefined` client → return; else awaited `try/catch` → `console.warn` on failure; never throws/rejects
- Resolver dependency: `marketingEnqueue?: (account: ProvisionedAccount) => Promise<void>`
- Hook site: immediately after `provisionPlayerAccount` success, before the `accountId` return
- Env: `BREVO_API_KEY` (secret) + `BREVO_LIST_ID` (`Number.parseInt` → `Number.isInteger` → `> 0`); any failure → marketing unwired (`undefined`), one-shot `console.warn`, NOT production-fatal
- Email source: `ProvisionedAccount.email` (already trim+lowercased)

## Guardrails
- Fail-open: the enqueue NEVER throws, NEVER rejects, NEVER alters the resolver `Result`. STOP if any path can fail signup.
- `accountProvisioning.logic.ts` + `identity.*` + `accountLookup.logic.ts` + `sessionToken.logic.ts` stay BYTE-IDENTICAL (`git diff` empty) — else STOP.
- No new npm dependency; built-in `fetch` only — `axios`/`node-fetch` forbidden.
- No HTTP route added (outbound call only); no `auth_provider` value or token-shape change.
- Missing BREVO env must NOT crash startup or signup.

## Required `// why:` Comments
- `brevoEnqueue.logic.ts` wrapper: why failures are swallowed (fail-open marketing must not block signup; cite D-24077 — do not re-enumerate forbidden tokens)
- `accountResolver.logic.ts` hook site: why the enqueue is best-effort + fires only on fresh provision (D-24079)
- `server.mjs` env load: why missing BREVO env is a no-op not a fatal guard (D-24080)

## Files to Produce
- `apps/server/src/marketing/brevoClient.types.ts` — **new** — `BrevoClient` interface
- `apps/server/src/marketing/brevoEnqueue.logic.ts` — **new** — fail-open wrapper + `createBrevoClient` factory
- `apps/server/src/marketing/brevoEnqueue.logic.test.ts` — **new** — fake-client tests: fail-open, success-path body shape, undefined-client no-op
- `apps/server/src/auth/accountResolver.logic.ts` — **modified** — call injected `marketingEnqueue` after provision success
- `apps/server/src/server.mjs` — **modified** — build Brevo client from env (undefined if unset), inject into resolver wiring
- `.env.example` — **modified** — document `BREVO_API_KEY`, `BREVO_LIST_ID`
- `render.yaml` — **modified** — declare both (`sync: false`)

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (baseline increased)
- [ ] `git diff HEAD -- apps/server/src/auth/accountProvisioning.logic.ts` empty
- [ ] Live verification (D-24026): test first-sign-in against a test list adds a Brevo contact + DOI email (observed), OR STATUS.md records fake-client evidence + deferred operator dashboard step
- [ ] `docs/ai/STATUS.md` updated ("No in-app user-observable change — server-side marketing capture")
- [ ] `docs/ai/DECISIONS.md` updated: D-24077..D-24080 landed (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-325 flipped to Done
- [ ] 01.6 post-mortem authored (new `marketing/` category + `BrevoClient` seam)

## Common Failure Smells
- Awaiting the enqueue WITHOUT swallowing → a Brevo outage fails signup (fail-open violated)
- Adding a `wasCreated` flag to `accountProvisioning.logic.ts` → locked file touched; rely on Brevo `updateEnabled` idempotency instead
- A production-fatal guard on `BREVO_*` → server refuses to start when marketing is simply unconfigured
- `import axios` / `node-fetch` → built-in `fetch` is required
