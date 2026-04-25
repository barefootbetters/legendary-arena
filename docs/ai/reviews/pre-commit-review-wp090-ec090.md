# Pre-Commit Review — WP-090 / EC-090

**Template:** `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`
**Work Packet:** WP-090 — Live Match Client Wiring
**Execution Checklist:** EC-090
**Review Date:** 2026-04-24
**Review Session:** Independent gatekeeper session (separate from the
implementing session, per WP-081 / WP-089 precedent and the WP-090
session invocation §Pre-Commit Review).

**Artifacts Reviewed:**

- `docs/ai/work-packets/WP-090-live-match-client-wiring.md` — design intent (authoritative on conflict).
- `docs/ai/execution-checklists/EC-090-live-match-client-wiring.checklist.md` — locked execution contract.
- `docs/ai/post-mortems/01.6-WP-090-live-match-client-wiring.md` — executor's drafted post-mortem (uncommitted; staged for Commit A).
- `docs/ai/invocations/session-wp090-live-match-client-wiring.md` — session invocation with FIX-4a / FIX-4b / FIX-10 / FIX-22 folds.

**Code surfaces audited:**

- `apps/arena-client/package.json` (M)
- `apps/arena-client/.env.example` (new)
- `apps/arena-client/src/lobby/lobbyApi.ts` (new)
- `apps/arena-client/src/lobby/lobbyApi.test.ts` (new)
- `apps/arena-client/src/lobby/LobbyView.vue` (new)
- `apps/arena-client/src/client/bgioClient.ts` (new)
- `apps/arena-client/src/client/bgioClient.test.ts` (new)
- `apps/arena-client/src/App.vue` (M, rewritten)
- `apps/arena-client/vite.config.ts` (M — scope expansion; see §Runtime Boundary Check)
- `pnpm-lock.yaml` (M, dependency side-effect)
- `docs/ai/post-mortems/01.6-WP-090-live-match-client-wiring.md` (new)

---

## Executive Verdict (Binary)

**Safe to commit as-is.**

Every locked contract, guardrail, and `// why:` requirement encoded in
EC-090 is preserved by the implementation. The single runtime
engine-import invariant (`bgioClient.ts:16` is the sole runtime hit) is
intact under a multiline-aware regex; the nine `MatchSetupConfig` fields
appear verbatim in `LobbyView.vue` as `v-model` bindings; the
`createLiveClient` handle exposes exactly `{ start, stop, submitMove }`;
the subscribe callback honors the FIX-22-hardened malformed-frame
coalesce; route precedence `fixture > live > lobby` is grep- and
test-verified, including the partial-live-param fallback. The two
notable departures from the WP's literal §Files Expected to Change list
— the `vite.config.ts` `wp-090-stub-par-storage` plugin and the
`searchOverride` test seam on `App.vue` — are structurally required,
introduce no gameplay or branching logic, are limited to wiring / test
adaptation, and are explicitly justified in PM §8. They satisfy the
template's §Runtime Boundary Check exception criteria. Verification
artifacts (707 / 133 / 0 repo-wide; production bundle 272 KB / 90 KB
gzipped; zero session abort conditions fired) corroborate the
implementer's assertions. No locked contract, no layer boundary, no
governance rule is violated.

---

## Review Axis Assessment

### 1. Scope Discipline — **Pass (with two declared, justified exceptions)**

Every code-touching surface in Commit A maps to either a §Files to
Produce row in EC-090 or a structurally-required wiring exception
recorded in PM §8. No "while I'm here" refactor is observable. No
unrelated formatting churn in `package.json` (the diff is the single
`"boardgame.io": "^0.50.0"` insertion, alphabetically placed). The
arena-client test command, dev/build scripts, and devDependency tree
are byte-identical to pre-session.

The two scope-list deviations are:

- **`vite.config.ts` modified** — a `wp-090-stub-par-storage` Rollup
  plugin replaces the body of `par.storage` modules at load time with
  inert same-named exports that throw if ever invoked. PM §8 documents
  the root cause (game-engine barrel re-exports `par.storage.js`, which
  imports `node:crypto` / `node:fs/promises` / `node:path`; Vite's
  `node:*` externalization does not surface the named bindings the
  module destructures). The plugin's surface is: a single 30-line `load`
  hook scoped to `id.includes('par.storage')`, an inline
  fully-qualified error message, and a `// why:` comment block naming
  the root cause. Game-engine itself is byte-identical pre/post
  (`git diff packages/game-engine/` = empty per PM §10). The stub is
  tree-shaken from the production bundle (272 KB / 90 KB gzip
  matches the WP-090 §Verification §Build expectation).
- **`App.vue` adds `searchOverride: string | null` (default `null`)** —
  test-only injection seam for the four App-routing tests in
  `bgioClient.test.ts:164-255`. Production callers never pass the prop;
  the default short-circuits to the existing `window.location.search`
  read. PM §3 documents the root cause (jsdom's non-configurable
  `window.location` and `replaceState` SecurityError against
  `about:blank`). The seam adds no production-visible behavior.

Both exceptions are subordinate to the Runtime Boundary Check axis
below; both pass that axis.

### 2. Contract & Type Correctness — **Pass**

- **`MatchSetupConfig` 9-field lock:** Preserved verbatim. `LobbyView.vue`
  declares one `ref` per field with the exact field name, and the
  template attaches a `v-model="<fieldName>"` to nine inputs (lines
  226, 231, 239, 247, 255, 263, 272, 281, 290). `buildConfig()` in the
  setup function produces a `MatchSetupConfig` shape with exactly those
  nine keys, no additions, no renames. The 9-field lock from
  `00.6-code-style.md §Data Contracts` is honored.
- **Lobby HTTP endpoints:** `createMatch` POSTs to
  `${serverUrl}/games/legendary-arena/create` with body
  `{ numPlayers, setupData: config }`; `listMatches` GETs
  `${serverUrl}/games/legendary-arena`; `joinMatch` POSTs to
  `${serverUrl}/games/legendary-arena/${matchID}/join` with body
  `{ playerID, playerName }`. All three URL templates and body shapes
  match the EC-090 §Locked Values rows verbatim.
- **`LobbyMatchSummary` shape:** Exactly the four locked fields
  (`matchID: string`, `players: { id: string; name?: string }[]`,
  `setupData: MatchSetupConfig | null`, `gameover: unknown | null`).
  `listMatches` normalizes raw `id: number` to `id: string` via
  `String(seat.id)`, omits `name` when the seat is open (no
  `name: undefined` fabrication — verified by the test at
  `lobbyApi.test.ts:127-129` which uses `assert.deepEqual` against
  `{ id: '1' }` exactly), and coalesces missing `gameover` to `null`.
- **`createLiveClient` factory return surface:** Exactly three keys —
  `{ start, stop, submitMove }` — verified by the test at
  `bgioClient.test.ts:87-91` (`Object.keys(handle).sort()` deepEquals
  `['start', 'stop', 'submitMove']`). No `client`, `moves`, or
  `subscribe` re-export.
- **Subscribe callback:** Implements the FIX-22-hardened snippet from
  the session invocation §Locked Values §Subscribe Snippet verbatim.
  The malformed-frame guard rejects non-object `state.G`, emits a
  `console.warn`, and coalesces to `null`. The valid-frame path
  preserves the EC's exact `setSnapshot((state?.G ?? null) as UIState | null)`
  semantics (the local `projection` binding is the EC snippet inlined
  for readability). Cast is `// why:`-commented to point at WP-089.
- **`MoveError` shape:** Engine-side; not constructed or interpreted
  client-side anywhere in the staged code. EC §Guardrails respected.

### 3. Boundary Integrity — **Pass**

- **Single runtime engine-import site:** `bgioClient.ts:16` is the only
  surviving runtime `from '@legendary-arena/game-engine'` line in
  arena-client under a multiline-aware regex
  (`^import\s+\{[^}]*\}\s+from\s+'@legendary-arena/game-engine'`).
  Verified independently during this review. The line-by-line
  PowerShell grep encoded in EC-090 §Verification Step 4 surfaces a
  false positive on `SharedScoreboard.vue:6` (the closing `} from
  '@legendary-arena/game-engine'` of a multi-line `import type` block).
  PM §6 captures this as a lesson and recommends future ECs adopt the
  multiline form. The discipline holds; the false positive is a
  measurement-tool defect, not a runtime invariant defect.
- **Split `import` / `import type` for the engine carve-out:**
  `bgioClient.ts:16` is `import { LegendaryGame } from '...'`;
  `bgioClient.ts:17` is `import type { UIState } from '...'`. Mixed-form
  (`import { type UIState, LegendaryGame }`) is avoided so the runtime
  hit cannot be masked from a `| grep -v "import type"` filter (RS-1
  defense; PM §5 records as canonical precedent).
- **Layer boundaries:** No `apps/server/**`, `packages/game-engine/**`,
  `packages/registry/**`, `packages/preplan/**`, or
  `apps/registry-viewer/**` modification. The `vite.config.ts` plugin
  is scoped to arena-client's build graph only — game-engine, server,
  and other consumers are unaffected.
- **No forbidden imports:** `Select-String` over `apps/arena-client/src`
  for `boardgame.io/react`, `axios`, `node-fetch`, `from 'ky'`,
  `localStorage`, `sessionStorage`, `indexedDB` returns no matches
  (per PM §10 verification evidence; spot-confirmed during this
  review). The boardgame.io import path drift to
  `boardgame.io/dist/cjs/client.js` and
  `boardgame.io/dist/cjs/multiplayer.js` is a runtime-correctness
  necessity documented at length in PM §3 stage 1+2 and §5; the
  functional contract (importing the `Client` constructor and the
  `SocketIO` transport from the boardgame.io package) is preserved.
  See §Optional Pre-Commit Nits.
- **Pure-helper layer:** `parseQuery`, `selectRoute`, `readQueryParam`,
  `splitCsv`, `parsePositiveInteger`, `isOpenSeat`, `buildConfig` are
  deterministic and side-effect free. None import boardgame.io. None
  perform I/O.

### 4. Test Integrity — **Pass**

- **Counts match the locked baseline:** Repo-wide 707 / 133 / 0
  (= baseline 696/130/0 + delta +11/+3/0 exactly). Arena-client
  77 / 3 / 0 (= prior 66/0/0 + 11 new tests / 3 new suites:
  `lobbyApi (WP-090)`, `createLiveClient`, `App routing`). Every
  non-arena-client package's test count is unchanged, confirming no
  cross-package collateral.
- **Test surface honors EC §Test contracts:** `lobbyApi.test.ts` exercises
  the four required cases (POST URL + body for createMatch; raw
  response normalization for listMatches; POST URL + body + return for
  joinMatch; full-sentence 500-error assertion for all three).
  `bgioClient.test.ts` exercises the three `createLiveClient` cases
  (return shape, `submitMove` delegation via injected stub, subscribe
  → `setSnapshot` including the FIX-22 malformed-frame coalesce) and
  the four `App routing` cases (empty → lobby; live params → live;
  fixture → fixture with no factory invocation; precedence
  `fixture > live` plus partial-param fallback). The fixture
  regression guard required by WP-090 §Acceptance Criteria §Fixture
  regression guard is satisfied by the third routing test plus the
  precedence test.
- **No `boardgame.io/testing` import:** Verified.
- **No live-server contact:** `globalThis.fetch` is stubbed per-test
  in `lobbyApi.test.ts`; `setClientFactoryForTesting` swaps the
  boardgame.io `Client` factory for a deterministic stub in
  `bgioClient.test.ts`. Both restoration paths run in `afterEach`.
- **Drift-detection / contract pinning:** Tests assert exact-shape
  invariants — `Object.keys(handle).sort()` is the locked test for
  the three-key factory surface; `assert.deepEqual` against
  `{ id: '1' }` is the locked test for the open-seat normalization
  contract. Both are appropriately atomic.

### 5. Runtime Boundary Check — **Pass (allowance exercised; explicitly justified)**

Two files outside the literal WP-090 §Files Expected to Change list
were modified. Each is assessed against the template's three-criteria
gate.

**Allowlist exception A — `apps/arena-client/vite.config.ts`:**

- *Structurally required?* **Yes.** Without the stub, `pnpm build`
  fails during Rollup pre-bundle analysis (PM §3 fourth bullet
  documents the exact failure: `node:*` externalization does not
  expose the destructured named bindings; tree-shaking cannot run
  before the analysis fails). The first runtime engine import
  (mandated by EC §Files to Produce row 6) is what surfaces the
  pre-existing transitive dependency chain.
- *New gameplay or branching logic?* **No.** The plugin is build-time
  only; the stub functions throw on invocation but are tree-shaken
  out of the production bundle. The bundle confirmation
  (272 KB / 90 KB gzip) matches the expected size profile.
- *Limited to wiring or test adaptation?* **Yes.** Vite plugin
  configuration is build-graph wiring by definition. No game logic,
  no runtime state, no rule pipeline interaction.

**Allowlist exception B — `App.vue` `searchOverride` prop:**

- *Structurally required?* **Yes.** jsdom's `window.location` is
  non-configurable and `history.replaceState` rejects URL changes
  against `about:blank` with `SecurityError` (PM §3 third bullet).
  Without an injectable seam, none of the four `App routing` tests
  (mandated by EC §Files to Produce row 7) can be authored.
- *New gameplay or branching logic?* **No.** The prop's only effect is
  to override the source string for `parseQuery`. The route-selection
  logic is identical pre/post. Production callers never pass it.
- *Limited to wiring or test adaptation?* **Yes.** Pure test
  adaptation; the prop's `// why:` comment names this explicitly
  (`App.vue:83-86`).

Both exceptions are accepted under the template's §5 allowance.

**Approved** under runtime wiring allowance.

### 6. Governance & EC-Mode Alignment — **Pass**

- **Commit prefix:** Per session invocation §Commit Authoring,
  Commit A will land as `EC-090: live match client wiring` and
  Commit B as `SPEC: WP-090 / EC-090 governance close — flip status
  to Done 2026-04-24`. The forbidden `WP-090:` prefix is not used.
  This review authorizes Commit A; commit-msg hook will validate
  prefix and length at commit time per `01.3-commit-hygiene-under-ec-mode.md`.
- **01.5 Runtime Wiring Allowance — NOT INVOKED.** The four 01.5
  triggers (new `LegendaryGameState` field, `buildInitialGameState`
  shape change, new `LegendaryGame.moves` entry, new phase hook) are
  all absent. The two allowlist exceptions (vite.config.ts plus
  searchOverride) are not 01.5 triggers — they are
  build-config / test-seam concerns within the consuming app's own
  layer, not runtime engine wiring. Approving them under template
  §5 is appropriate; 01.5 retroactive citation is not invoked.
- **Decisions:** Five D-90xx entries are scoped for Commit B per
  session invocation §Files to Produce item 10
  (query-string-over-Vue-Router; single runtime engine-import site;
  credentials in URL / WP-052 deferral; `VITE_SERVER_URL` as sole
  origin var; lobby join endpoint contract + CLI drift follow-up).
  Commit B governance is out of scope for this pre-Commit-A review;
  flagging only as a downstream gate.
- **Status / index documents:** STATUS.md, WORK_INDEX.md, and
  EC_INDEX.md updates are scoped for Commit B. Not part of this
  review's surface; will be re-validated by commit-msg hook at
  Commit B authoring.
- **Post-mortem:** `docs/ai/post-mortems/01.6-WP-090-live-match-client-wiring.md`
  is staged for Commit A per the session invocation §Files Staged
  list (line 440). Sections 1–11 are filled per the 01.6 template;
  the four mandatory triggers are addressed in §7 (long-lived
  abstraction = `createLiveClient`; future-WP contract = 9-field
  form + `LobbyMatchSummary`; new subdirectories = `src/lobby/` +
  `src/client/`; first runtime engine-import site). §8 explicitly
  enumerates the scope expansions. §10 records verification
  evidence. §11 declares code-complete and verification-complete.
- **Session protocol:** D-90xx is documented in the post-mortem
  Section 2 first bullet as having been resolved against a running
  server; the buggy CLI script (`join-match.mjs`) is identified for
  follow-up. The follow-up WP placeholder is scoped for Commit B's
  WORK_INDEX.md update; not part of Commit A.
- **Architecture / .claude/rules adherence:** `MATCH_SETUP-SCHEMA.md`
  9-field lock unviolated; engine-owns-truth principle preserved
  (the client never derives `UIState`, never validates intents, never
  re-runs rules); ESM-only / `node:` prefix observed across new
  files; full-sentence error messages enforced (`lobbyApi.ts:58-60`,
  `:84-86`, `:144-147` and the parsePositiveInteger throws in
  `LobbyView.vue:37-46`).

---

## Optional Pre-Commit Nits (Non-Blocking)

- **`bgioClient.ts` import paths use the internal CJS dist subpath
  (`'boardgame.io/dist/cjs/client.js'`, `'boardgame.io/dist/cjs/multiplayer.js'`)
  rather than the WP-stated proxy-dir path (`'boardgame.io/client'`,
  `'boardgame.io/multiplayer'`).** This is a runtime-correctness
  necessity exhaustively documented in PM §3 (two-stage Vite/tsx
  interop bug) and PM §5 (canonical precedent for any future
  arena-client boardgame.io import). The functional contract — the
  `Client` constructor and the `SocketIO` transport — is preserved
  via the namespace-import + fallback-chain pattern. The internal
  subpath is technically more brittle than the public proxy-dir
  entry (a future boardgame.io minor bump that reorganizes `dist/`
  would break it; the descriptive `throw` at lines 60-69 surfaces
  that case loudly). No action required for this commit; flagging
  for future awareness if boardgame.io updates land.
- **`@ts-expect-error` on the boardgame.io namespace imports**
  (`bgioClient.ts:32, :35`) — accurate for the v0.50 published
  shape (no `.d.ts` alongside the dist CJS bundle). If a future
  boardgame.io minor adds bundled types, the directives will start
  warning; harmless and self-correcting at that point.
- **EC-090 §Verification Step 4 grep formulation surfaces a false
  positive on `SharedScoreboard.vue:6`.** PM §6 already records this
  and recommends future ECs adopt the multiline-aware regex
  `^import\s+\{[^}]*\}\s+from\s+'@legendary-arena/game-engine'`.
  Not blocking for WP-090; the actual single-runtime-import-site
  invariant holds. Flagging as documentation hygiene for the EC
  template.

---

## Explicit Deferrals (Correctly NOT in This WP)

The following are appropriately omitted and remain scoped to future
work:

- **CLI script drift fix** — `apps/server/scripts/join-match.mjs`'s
  buggy `result.credentials` read (vs the canonical
  `playerCredentials`) is identified by D-90xx but explicitly
  out of scope; queued for a follow-up WP placeholder added to
  WORK_INDEX.md in Commit B. The arena-client matches server reality,
  not the buggy CLI.
- **Player identity / accounts / durable session persistence** —
  WP-052's scope. Credentials live in the URL query string for MVP;
  no `localStorage` / `sessionStorage` / `IndexedDB` writes.
- **Spectator HUD** — WP-089 supports spectator projections; the
  arena-client does not surface a spectator-specific UI in this
  packet. Future WP.
- **Replay playback integration** — `<ReplayInspector />` from WP-064
  is fixture-driven and untouched.
- **Pre-planning UI** — WP-059 remains deferred per project memory.
- **Rematch / lobby chat / ready-check polling** — Out of scope per
  WP-090 §Out of Scope.
- **Reconnect UX beyond boardgame.io's built-in transport** — Page
  refresh with the same `?match=&player=&credentials=` is the MVP
  reconnect mechanism.
- **Vue Router or any routing library** — Query-string discriminator
  is the locked MVP mechanism; D-90xx records the decision for
  Commit B.
- **MATCH-SETUP envelope authoring** — WP-091 / WP-092 / WP-093 own
  the envelope-aware loadout intake; this packet ships the locked
  9-field manual form that WP-092 will wrap byte-for-byte.
- **No engine, server, registry, preplan, or registry-viewer
  modification** — `git diff packages/ apps/server/ apps/registry-viewer/ apps/replay-producer/`
  empty per PM §10.

---

## Commit Hygiene Recommendations

- **Commit A files staged by exact name only.** The session
  invocation §Pre-Session Gates item 6 calls out the parallel-session
  `apps/registry-viewer/src/registry/shared.ts` Vue v-for-key drift
  that must NOT be staged. Stage the nine files (eight code + the
  post-mortem) plus the `vite.config.ts` build-config exception and
  `pnpm-lock.yaml` (dependency side-effect) by exact filename. Avoid
  `git add .` / `-A` / `-u`.
- **Commit message format.** Use the `EC-090:` prefix and the body
  drafted in the session invocation §Commit Authoring §Commit A.
  The `WP-090:` prefix is forbidden per P6-36 and will be rejected
  by the commit-msg hook.
- **Commit B follow-up.** This review authorizes only Commit A. The
  governance close (DECISIONS.md D-9001..D-9005, STATUS.md note,
  WORK_INDEX.md flip + CLI-drift placeholder, EC_INDEX.md
  Draft → Done flip) lands separately under `SPEC:` prefix and is
  out of scope for this gate. Commit B authoring should re-run the
  Lint Gate (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`) on
  any added text.
- **Hook compliance.** `core.hooksPath = .githooks` is set; the
  pre-commit and commit-msg hooks will run automatically. Do not
  pass `--no-verify`. Per the WP-079 / WP-081 precedents, hook
  failures must be addressed by fixing the underlying issue, not
  bypassed.

---

## Methodology Note

This review was run as an independent gatekeeper session distinct
from the implementing session (the WP-090 session invocation §Pre-Commit
Review explicitly required this separation). The reviewer read the WP,
EC, post-mortem, and session invocation cold, then audited the staged
diffs against the locked contracts without inheriting the
implementing session's chat context. Verification artifacts cited
(test counts, bundle size, smoke-test outcomes) were taken from the
post-mortem's §10 evidence block; spot-checks against the actual
staged file contents found no contradictions.

The review's authority extends to Commit A only. Commit B (governance
close) lands under separate SPEC-prefix authoring and is not
authorized here.

---

**Review complete. WP-090 is safe to commit as-is. Proceed to Commit A
authoring per `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`
using the `EC-090:` prefix and the body drafted in the session
invocation. Commit B follows once Commit A lands.**
