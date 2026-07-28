# WP-448 — Extract the reusable composition→match launch primitive (arena-client)

**User-Visible Surface:** none — infrastructure (behavior-preserving refactor)

**Layer:** App (`apps/arena-client`)

**Status:** Draft 2026-07-28 · standard two-session lane · reserves **D-24268**

---

## Goal

After this session, `apps/arena-client` has a single reusable module,
`src/lobby/useCreateMatchFromComposition.ts`, that owns the
create-and-join-from-a-composition launch chain — `createMatch(config,
playerCount, authToken)` → `persistMatchSetup` → `joinMatch(seat 0)` →
navigate `?match=<id>&player=0&credentials=<c>` — as a never-throw async
function returning a typed result. `LobbyView.vue`'s two byte-identical
inline copies of that chain (`submitFromJson`, the loadout-JSON path, and
`submitCreate`, the manual-form path) are rewired to consume the module as
the single source, with **zero behavior change**: the existing arena-client
lobby test suite passes **unchanged** as the correctness gate. The module is
the reusable primitive both the lobby and the future WP-7 gauntlet-leg launch
will call, and it delivers the launch mechanism the long-deferred WP-303
("Load into lobby / play a saved loadout") placeholder needs.

## Assumes

- **`apps/arena-client/src/lobby/LobbyView.vue` exists** and, in its
  `setup()`, defines `submitFromJson()` and `submitCreate()` whose success
  chains are identical modulo their `(config, playerCount)` inputs:
  `createMatch(config, playerCount, authToken)` → `persistMatchSetup(created.matchID, config)`
  → `joinMatch(created.matchID, '0', playerName.value.trim(), authToken)` →
  `window.location.search = \`?match=…&player=0&credentials=…\``, with the
  catch producing `Failed to create and join the match. ${cause}`. (Verified
  at draft time against `origin/main` @ `71a90213`.)
- **`apps/arena-client/src/lobby/lobbyApi.ts` exists** and exports
  `createMatch(config: MatchSetupConfig, numPlayers: number, authToken: string): Promise<{ matchID: string }>`
  and `joinMatch(matchID, playerID, playerName, authToken): Promise<{ playerCredentials: string }>`.
  Both throw `Error` with a full-sentence message on non-2xx. This WP does
  **not** modify either function's contract.
- **`apps/arena-client/src/diagnostics/matchSetupSession.ts` exists** and
  exports `persistMatchSetup(matchId: string, setup: unknown): void`
  (best-effort, client-local, never throws in the success path per its
  existing contract).
- **`@legendary-arena/game-engine` provides the `MatchSetupConfig` type**,
  already imported type-only by `LobbyView.vue`. No new npm dependency.
- **`docs/ai/DECISIONS.md` D-24087 (Profile Loadout Library) is Active** and
  governs a separate profile surface; this WP does not touch it.
- **WP-303 is an unfiled placeholder** referenced in WP-302's `WORK_INDEX.md`
  row ("Lobby 'Save this loadout' / 'Load into lobby' integration deferred to
  a future WP-303"); no `WP-303-*.md` file exists.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative): the App layer
  and its import rules (`apps/arena-client` may import the Runtime-Safe Engine
  Surface type-only for `MatchSetupConfig`; must NOT import `registry`,
  `server`, or `pg` at runtime).
- `.claude/rules/architecture.md` — §Import Rules (Quick Reference) row for
  `apps/arena-client`.
- `.claude/rules/code-style.md` — pure-helper discipline, no `.reduce()`,
  naming (`is/has/can` booleans, full English words), full-sentence errors.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 — the nine
  `MatchSetupConfig` field names (`schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`,
  `woundsCount`, `officersCount`, `sidekicksCount`); this WP passes a
  `MatchSetupConfig` through untouched — it renames nothing.
- `docs/ai/DECISIONS.md` — scan D-24087 (Profile Loadout Library), D-24092
  (playing a seat requires an account), D-6512 (the `defineComponent`/`setup`
  requirement noted in `LobbyView.vue`'s header), D-24153 (loadout carve-out,
  for context on the composition→match flow).
- `apps/arena-client/src/lobby/LobbyView.vue` — the source of the two chains,
  `submitFromJson` (~L560) and `submitCreate` (~L287), plus the
  `requireAuthTokenOrRedirectToLogin()` gate and the `createWithBotAlly` /
  `joinExisting` / `startAutoplay` functions that stay out of scope.
- `apps/arena-client/src/lobby/LobbyView.test.ts` — the correctness gate;
  its own header notes the create/join flows are covered by the lobbyApi
  suite, and it directly pins `createWithBotAlly` (bot API), which this WP
  does not touch.

**Split-vs-single:** single App-layer package, three files (one new module +
its new test + one modified SFC). No layer crossing, no contract file, one
scoped D-entry. One WP.

## Scope (In)

- Create `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts`
  exporting an async function `launchMatchFromComposition(input)` that:
  - takes `{ config: MatchSetupConfig; playerCount: number; playerName: string; authToken: string }`
    (the caller trims `playerName` and resolves the auth token, exactly as the
    two current call sites already do);
  - runs `createMatch(config, playerCount, authToken)` →
    `persistMatchSetup(created.matchID, config)` →
    `joinMatch(created.matchID, '0', playerName, authToken)` → sets
    `window.location.search = \`?match=${encodeURIComponent(created.matchID)}&player=0&credentials=${encodeURIComponent(joined.playerCredentials)}\``;
  - is **never-throw**: on success returns `{ ok: true, matchID }`; on any
    caught error returns `{ ok: false, message: \`Failed to create and join
    the match. ${cause}\` }` (byte-identical to the current message);
  - exports the result type (`LaunchMatchResult` discriminated union) and the
    input type from the same module (no separate contract file).
- Rewire `LobbyView.vue`'s `submitFromJson()` to build
  `{ config: parsed.composition, playerCount: parsed.playerCount, playerName:
  playerName.value.trim(), authToken }` and call the module, setting
  `errorMessage.value = result.message` on `{ ok: false }`; keep the existing
  `isSubmitting`, `parsed === null`, empty-`playerName`, and auth-token guards
  and the `isSubmitting` reset unchanged.
- Rewire `LobbyView.vue`'s `submitCreate()` the same way, keeping its
  `buildConfig()` + `parsePositiveInteger(numPlayers.value, 'numPlayers')`
  calls **inside** the try so their throw→catch behavior (message identical)
  is preserved, then calling the module with the resolved `(config,
  seatCount)`.
- Add `apps/arena-client/src/lobby/useCreateMatchFromComposition.test.ts`
  unit-testing the module in isolation (a stubbed `fetch`): success returns
  `{ ok: true }` and issues create-then-join with seat `'0'` and navigates;
  a non-2xx create returns `{ ok: false }` with the locked message and issues
  **no** join.

## Out of Scope

- **No behavior change to the lobby.** Identical inputs → identical lobby
  behavior; the existing arena-client suite passes **unchanged**. Editing any
  existing lobby test so it still passes is itself a behavior change and a
  FAIL.
- **`createWithBotAlly` is NOT extracted** — it calls a different endpoint
  (`createMatchWithBot` → `{ matchId }`) and produces a different error
  message (`Failed to create the bot-ally match.`); it is a separate
  primitive. Its tests (`LobbyView.test.ts` WP-376 cases) stay untouched.
- **`joinExisting` is NOT extracted** — it is a join-only flow (no create).
- **`startAutoplay` is NOT extracted** — it POSTs the autoplay endpoint and
  reads a server-returned credential, not the authed create/join chain.
- **No change to `createMatch` / `joinMatch` / `persistMatchSetup`
  contracts**, no new endpoint, no server change, no migration.
- **No `?loadout=` / `?pack=` deep-link "play a saved loadout"** wiring — that
  is a future WP-303 call site, not this refactor.
- **No gauntlet-run wiring** — WP-7 (the tracker UI) consumes this primitive;
  this WP does not reference gauntlet runs.

## Files Expected to Change

- `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts` — **new** —
  the reusable never-throw `launchMatchFromComposition` primitive + its input
  and `LaunchMatchResult` types.
- `apps/arena-client/src/lobby/useCreateMatchFromComposition.test.ts` —
  **new** — isolation unit tests (stubbed `fetch`) for the success and
  create-fails paths.
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — `submitFromJson`
  and `submitCreate` rewired to consume the module; the two inline chains
  removed; nothing else changed.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — add the `[ ]` WP-448
  row.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — add the EC-483 →
  WP-448 Pending row.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — add the `📝` WP-448 node; regen
  counts.
- `docs/ai/NUMBER-LEDGER.md` — **modified** — WP-448 / EC-483 / D-24268
  reservations (this SPEC commit).
- `docs/ai/DECISIONS.md` — **modified** — draft D-24268 (Drafted; not yet
  landed).

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets,
  no "show only the changed section".
- ESM only; Node v22+.
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`. Full English
  words, `is/has/can` booleans, JSDoc on every function, `// why:` on
  non-obvious code, full-sentence error messages, no `.reduce()` with
  branching, no premature abstraction.

**Packet-specific:**
- **Behavior-preserving.** The extraction must not alter any observable lobby
  behavior. The existing arena-client suite is the gate and passes UNCHANGED.
- **Single source.** After extraction, `useCreateMatchFromComposition.ts` is
  the only place the `createMatch → persist → join(seat 0) → nav` chain lives;
  no inline duplicate remains in `submitFromJson` or `submitCreate`.
- **Never-throw parity.** The module never throws; it returns a typed result.
  The locked error message text is byte-identical to the current
  `Failed to create and join the match. ${cause}`.
- **Layer boundary.** `apps/arena-client` may import `MatchSetupConfig`
  type-only from `@legendary-arena/game-engine`; it must NOT add a runtime
  import of `@legendary-arena/registry`, `apps/server`, or `pg`. The module
  imports only from `./lobbyApi` and `../diagnostics/matchSetupSession` (both
  already used by `LobbyView.vue`) plus the type-only engine import.
- **No new npm dependency.**
- **`MatchSetupConfig` passes through untouched** — the nine field names
  (00.2 §8.1) are neither renamed nor abbreviated.
- **`defineComponent`/`setup` constraint (D-6512).** `LobbyView.vue` stays a
  `defineComponent({ setup() { return {…} } })` SFC under the vue-sfc-loader
  separate-compile pipeline (its header `// why:` note); the module is a plain
  `.ts` file with no reactive state, so it does not touch that constraint.

**Session protocol:** if any step is unclear or an existing test would need to
change to pass, STOP and ask — a required test change means behavior changed,
which is out of scope.

**Locked contract values:** the `launchMatchFromComposition` signature, the
extracted sequence, and the error message string (see EC-483 Locked Values).

## Acceptance Criteria

1. `apps/arena-client/src/lobby/useCreateMatchFromComposition.ts` exists and
   exports `launchMatchFromComposition` plus its input and `LaunchMatchResult`
   types.
2. `launchMatchFromComposition` is never-throw: it returns
   `{ ok: true, matchID }` on success and `{ ok: false, message }` on any
   caught error; the failure message equals
   `Failed to create and join the match. ${cause}` verbatim.
3. On success it calls `createMatch(config, playerCount, authToken)`, then
   `persistMatchSetup(matchID, config)`, then `joinMatch(matchID, '0',
   playerName, authToken)`, then navigates
   `?match=<id>&player=0&credentials=<credentials>` (both id and credentials
   percent-encoded) — order and seat `'0'` locked.
4. `LobbyView.vue`'s `submitFromJson` and `submitCreate` both call the module;
   neither retains an inline `createMatch → join → nav` chain (`git grep` for
   `joinMatch(` inside `LobbyView.vue` finds only call sites that are NOT the
   extracted composition-launch chain — i.e. `joinExisting`).
5. `createWithBotAlly`, `joinExisting`, and `startAutoplay` are unchanged in
   `LobbyView.vue`.
6. `useCreateMatchFromComposition.test.ts` asserts the success path (create →
   join seat `'0'` → nav → `{ ok: true }`) and the create-fails path
   (`{ ok: false }` with the locked message, no join issued).
7. `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
8. `pnpm --filter @legendary-arena/arena-client test` exits 0 with **every
   pre-existing lobby test unchanged** (no edits to `LobbyView.test.ts`,
   `lobbyApi.test.ts`, or any other existing test file).
9. No new npm dependency; no runtime `@legendary-arena/registry` / `server` /
   `pg` import added to arena-client.
10. `MatchSetupConfig` is passed through unmodified — no field renamed.

## Verification Steps

```bash
# from the arena-client package
cd apps/arena-client

# 1. Typecheck (the load-bearing SFC gate — vite build + node:test do NOT typecheck)
pnpm --filter @legendary-arena/arena-client typecheck    # expect: exit 0

# 2. Full suite — the correctness gate; existing lobby tests pass UNCHANGED
pnpm --filter @legendary-arena/arena-client test         # expect: exit 0, prior count + the new module's cases

# 3. No inline composition-launch chain remains in the SFC.
#    The only joinMatch( call left in LobbyView.vue is joinExisting's join-only flow.
git grep -n "joinMatch(" -- apps/arena-client/src/lobby/LobbyView.vue   # expect: only the joinExisting call site

# 4. No new runtime registry/server/pg import in the new module or the SFC.
git grep -n "@legendary-arena/registry\|apps/server\|from 'pg'" -- apps/arena-client/src/lobby/useCreateMatchFromComposition.ts apps/arena-client/src/lobby/LobbyView.vue   # expect: zero matches

# 5. Existing lobby test files are byte-unchanged.
git diff --stat origin/main -- apps/arena-client/src/lobby/LobbyView.test.ts apps/arena-client/src/lobby/lobbyApi.test.ts   # expect: no output (unchanged)
```

## Definition of Done

- [ ] All Acceptance Criteria (1–10) pass.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0; existing
      lobby test files unchanged (`git diff` empty for them).
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change —
      infrastructure only" (behavior-preserving refactor; surface = none).
- [ ] `docs/ai/DECISIONS.md` D-24268 flipped to "Active (post-execution)".
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-448 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph moved `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` — **N/A** (no endpoint added,
      modified, or removed; no catalogued Library-only function touched).

## Vision Alignment

**Vision clauses touched:** §3 (identity — the launch requires an
authenticated account, D-24092, preserved), §19b (account-local saved content
— the primitive is what a future "Load into lobby / play a saved loadout"
uses), §20–26 (leaderboard-adjacent — the WP-7 gauntlet-leg launch will call
it), NG-1.

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
It is a behavior-preserving extraction — the account gate, the create/join
contract, and the scoring/ranking surfaces are all unchanged; nothing about
fairness, scoring, or monetization moves.

**Non-Goal proximity check:** None of NG-1..7 are crossed. The refactor adds
no pay-to-win surface, no persuasive/competitive change, no user-visible copy;
it only relocates existing lobby logic.

**Determinism preservation:** N/A to the engine — this is client-side lobby
orchestration, touches no `G`/`ctx`, no `ctx.random`, no replay/scoring/
simulation path, and no `finalStateHash` surface.

## Funding Surface Gate

**N/A** — this WP touches no WP-097 §A/§B/§C funding affordance, no
tournament funding channel, and no user-visible "donate/support" copy; it is a
behavior-preserving arena-client refactor with no UI copy change.

## §21 — API Catalog

**N/A** — no HTTP endpoint on `apps/server` is added, modified, removed, or
status-changed, and no `apps/server/src/**` library function catalogued as
`Library-only` is touched. The refactor is entirely inside `apps/arena-client`
and reuses the existing `createMatch` / `joinMatch` client helpers without
changing their contract.

## Lint Gate Self-Review (`00.3`, all 21 sections)

- **§1 Structure** — PASS. All required sections present (`## Goal`,
  `## Assumes`, `## Context (Read First)`, `## Scope (In)`, `## Out of Scope`,
  `## Files Expected to Change`, `## Non-Negotiable Constraints`,
  `## Acceptance Criteria`, `## Verification Steps`, `## Definition of Done`);
  `## Out of Scope` names four excluded items (createWithBotAlly, joinExisting,
  startAutoplay, ?loadout= deep-link).
- **§2 Non-Negotiable Constraints** — PASS. Engine-wide (full file contents,
  no diffs, ESM/Node v22+, cites `00.6-code-style.md`) + packet-specific +
  session protocol + locked contract values all present.
- **§3 Assumes** — PASS. Every file dependency (LobbyView, lobbyApi,
  matchSetupSession) listed with the exact exports/shapes relied on; no
  implicit assumption.
- **§4 Context** — PASS. Specific docs + sections (ARCHITECTURE §Layer
  Boundary, rules files, 00.2 §8.1, DECISIONS scan list, the source files).
- **§5 Files Expected to Change** — PASS. Three code/doc files marked new/
  modified with one-line descriptions + governance ledgers; bounded (< 8).
- **§6 Naming** — PASS. `MatchSetupConfig` nine fields (00.2 §8.1),
  `playerCredentials`, `matchID` used verbatim; no abbreviations introduced.
- **§7 Dependency Discipline** — PASS. No new npm dependency; forbidden
  runtime imports (registry/server/pg) explicitly excluded.
- **§8 Architectural Boundaries** — PASS. Frontend: no game logic added, no
  engine runtime import, boardgame.io client untouched; App-layer import rules
  cited and respected.
- **§9 Windows** — PASS. Verification uses `pnpm` + `git grep`; no Unix-only
  assumptions (the `cd`/grep lines run under Git Bash or pwsh equivalently).
- **§10 Env Vars** — N/A. No environment variable introduced or consumed by
  this refactor.
- **§11 Auth Clarity** — N/A. The account gate (D-24092) is unchanged; this WP
  neither adds nor alters an identity model — the auth token is resolved by
  the existing `requireAuthTokenOrRedirectToLogin()` and passed through.
- **§12 Test Quality** — PASS. New test uses `node:test` + `node:assert`, a
  stubbed `fetch`, no boardgame.io import, no network/DB.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output; no
  vague "verify manually".
- **§14 Acceptance Criteria** — PASS. Ten binary, observable, file/function-
  specific checks aligned to the deliverables.
- **§15 Definition of Done** — PASS. Includes STATUS.md, DECISIONS.md,
  WORK_INDEX.md, scope-boundary check, and the §15.1 surface declaration
  (`none — infrastructure` → STATUS states "No user-observable change").
- **§16 Code Style** — PASS. The module is one small never-throw async
  function with JSDoc + a typed result; no premature abstraction (it replaces
  two identical copies — the third-copy rule is satisfied), no `.reduce()`,
  explicit control flow, full-sentence error, `// why:` on the navigation +
  the never-throw catch.
- **§17 Vision Alignment** — PASS. Section present with clause numbers (§3,
  §19b, §20–26, NG-1), No-conflict assertion, NG proximity check, determinism
  line (N/A to engine, justified).
- **§18 Prose-vs-Grep** — PASS. Verification greps target `joinMatch(`,
  `@legendary-arena/registry`, `pg` — the WP prose discusses these as governed
  scope, not as an enumerated forbidden-token list under a literal-count gate;
  no count-bounded grep is echoed verbatim.
- **§19 Bridge-vs-HEAD** — N/A. This WP is not a repo-state-summarizing
  artifact; the `origin/main` @ `71a90213` baseline is a fixed reproducibility
  anchor, not a "recent commits" chain.
- **§20 Funding Surface Gate** — N/A with justification (see `## Funding
  Surface Gate` above — no funding affordance, channel, or user-visible copy).
- **§21 API Catalog** — N/A with justification (see `## §21 — API Catalog`
  above — no `apps/server` endpoint or catalogued Library-only function
  touched).

**Verdict:** PASS — all 21 sections resolved (§10/§11/§19 N/A with reason;
§20/§21 N/A with named justification).

## Pre-Flight (`01.4`) — READY TO EXECUTE

**Date:** 2026-07-28 · **Baseline:** `origin/main` @ `71a90213`.

- **Sequencing:** hard-dep none. Parallel-safe with the rest of the Mastermind
  Gauntlets epic (WP-440..446 shipped; WP-447 is a concurrent villain WP in a
  disjoint layer). WP-7 (tracker UI) depends on this. READY.
- **Green baseline:** the arena-client suite is green on `origin/main`; the
  correctness gate is that it stays green **unchanged**. This is not a
  validation-tightening WP (no input newly rejected), so the `01.4` empirical-
  scaffold rule does not apply; the behavior-identity claim is enforced by the
  unchanged suite at execution.
- **Scope lock:** three files (`useCreateMatchFromComposition.ts` [new] + its
  test [new] + `LobbyView.vue` [modified]) plus governance ledgers. Anything
  outside is forbidden.
- **Contract fidelity:** `createMatch`/`joinMatch`/`persistMatchSetup`
  signatures verified verbatim at draft time (see `## Assumes`); the module
  reuses them without change.
- **Risks/ambiguities resolved:** (a) `submitCreate`'s `buildConfig()` /
  `parsePositiveInteger` can throw — resolved by keeping those calls inside
  `submitCreate`'s own try so throw→catch parity holds and the module receives
  already-resolved `(config, playerCount)`; (b) the module is named `use…`
  per the epic plan but is a plain async function (no reactive state) —
  resolved: it exports `launchMatchFromComposition` directly (unit-testable
  without mounting), which the EC locks.

**Verdict: READY TO EXECUTE.**

## Copilot Check (`01.7`) — PASS

**Date:** 2026-07-28 · **Pre-flight under review:** READY TO EXECUTE
(2026-07-28). All 30 issues scanned; findings that were not clean PASS:

- **#1 / #9 / #16 / #29 Boundary drift** — PASS. The module is App-layer only;
  it adds no engine/registry/server runtime import (constraint + Verification
  Step 4 grep), and reuses existing client helpers. No engine logic moves into
  the UI.
- **#4 / #10 / #21 Contract / stringly-typed / widening** — PASS. The result
  is a discriminated union (`{ ok: true, matchID } | { ok: false, message }`),
  not a bare string or `unknown`; the input is a typed object with
  `MatchSetupConfig`; the error message is a locked verbatim string.
- **#6 Merge semantics (replace vs append)** — PASS. Not a merge WP; but the
  "single source" rule is locked in text and pinned by AC-4 (no inline chain
  remains).
- **#12 Scope creep** — PASS. Explicit three-file allowlist + `git diff
  --name-only` DoD check + four named out-of-scope functions.
- **#22 Silent vs loud failure** — PASS. The never-throw / typed-result policy
  is explicit, message text locked, and the caller sets `errorMessage` on
  `{ ok: false }` exactly as today.
- **#25 Overloaded responsibility** — PASS. The module does one thing (launch
  from a resolved composition); config-building and guards stay in the caller.
- **#11 Tests validate invariants** — PASS. The new test asserts the create-
  then-join order + seat `'0'` + no-join-on-create-failure (invariants), and
  the whole-suite-unchanged gate protects the behavior-identity invariant.

**Governance follow-ups:** D-24268 (reserved) records the primitive + the
WP-303 supersession; no other governance change required.

**Disposition:** CONFIRM — Pre-flight READY TO EXECUTE stands. Session prompt
generation authorized.
