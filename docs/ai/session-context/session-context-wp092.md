# Session Context — WP-092 (Lobby Loadout Intake)

> **Authored:** 2026-04-24 post-WP-091 execution.
> **Reconciled:** 2026-04-24 post-WP-090 execution (HEAD `55018c1`). §1 SHA, baseline, dependency-status, and post-WP-090 contract-surface checklist updated; §6 baseline updated; §8 marked RESOLVED. §3 / §4 / §5 governance-string discipline + active-risk content unchanged.
>
> **Purpose:** give the
> WP-092 executor a concise, current baseline so they don't re-derive:
> the main SHA, the WP-091 + WP-093 byte-for-byte consumer strings WP-092
> carries verbatim, the post-WP-090 test baseline, the layer-boundary
> constraint that keeps `apps/arena-client/**` from importing
> `@legendary-arena/registry` at runtime, the WP-090 surface that WP-092
> modifies (and must not rewrite), and the patterns WP-091
> established that WP-092 should extend rather than re-invent.
>
> **This file is NOT a design-rationale bridge.** WP-092 is fully
> authored; its design intent lives in WP-092 itself. What follows is
> operational handoff only.
>
> **This file is NOT authoritative.** See §6 for the authority chain.

---

## 1. State as of authoring

**Branch:** `main` at `55018c1` (post-WP-090 governance close).

WP-090 — Live Match Client Wiring — **executed and merged 2026-04-24** (the third hard-dep blocker for WP-092 is now resolved). Commit chain:

- `54b266a` — `EC-090: live match client wiring` — 11 files: 6 new arena-client files (`src/lobby/lobbyApi.ts`, `lobbyApi.test.ts`, `LobbyView.vue`, `src/client/bgioClient.ts`, `bgioClient.test.ts`, `.env.example`) + 3 modifications (`src/App.vue`, `package.json`, `vite.config.ts`) + `pnpm-lock.yaml` side-effect + 01.6 post-mortem.
- `55018c1` — `SPEC: WP-090 / EC-090 governance close — flip status to Done 2026-04-24` — DECISIONS.md D-9001..D-9005, STATUS.md, WORK_INDEX.md WP-090 row flipped + Dependency Chain update + CLI drift follow-up placeholder, EC_INDEX.md EC-090 row flipped, pre-commit review artifact.

WP-091 — Loadout Builder in Registry Viewer — executed and merged 2026-04-24. Commit chain (now upstream of WP-090):

- `6cf2a0f` — `SPEC: WP-091 / EC-091 — lock pre-flight amendments A-091-01..05` — WP-091 + EC-091 prose amendments. Zero code change.
- `bdab50b` — `EC-091: loadout builder in registry viewer (v1)` — 13 files; D-9101 landed; `packages/registry` baseline moved from 13/2/0 to 31/3/0.
- `ccc4aac` — `SPEC: WP-091 / EC-091 governance close — flip status to Done 2026-04-24`.
- `61316a6` — `SPEC: D-9301 — correct stale matchSetup.types.ts citation path (A-091-02)` (resolves the §8 Tidy-Up Note — fix has landed; one-hunk SPEC commit, no code change).

**All three of WP-092's hard deps are now Done on `main`** (WP-090 ✓, WP-091 ✓, WP-093 ✓). The "blocked on WP-090 landing" condition this file was originally authored under is **resolved**.

**REMAINING ACTION BEFORE WP-092 EXECUTES:** Per the original §1 instruction — *"Re-run this WP-092 pre-flight + copilot against HEAD-post-WP-090 before authoring the WP-092 session prompt"* — the existing pre-flight + copilot verdicts at [preflight-wp092-lobby-loadout-intake.md](../invocations/preflight-wp092-lobby-loadout-intake.md) (`DO NOT EXECUTE YET`) and [copilot-wp092-lobby-loadout-intake.md](../invocations/copilot-wp092-lobby-loadout-intake.md) (`SUSPEND`) were both authored against pre-WP-090 HEAD. They must be re-run against `55018c1` and the new verdicts appended (do **not** overwrite — append a "Re-Run 2026-04-XX post-WP-090 HEAD" section so the historical record stays intact). The WP-092 session prompt at `docs/ai/invocations/session-wp092-lobby-loadout-intake.md` (currently does not exist) should not be authored until both re-run verdicts return `READY TO EXECUTE` / `CONFIRM`.

**WP-090 actually-landed surface that the re-run pre-flight must scrutinize for WP-092 contract drift** (some of these were not anticipated when WP-092 + EC-092 were drafted; verify each is compatible with WP-092's locked design):

1. **`apps/arena-client/src/lobby/lobbyApi.ts` exports `serverUrl: string` as a module constant.** WP-092's submission path can import `serverUrl` directly; do not re-derive `import.meta.env.VITE_SERVER_URL` in `loadoutParser.ts` or `LobbyView.vue` modifications.
2. **`apps/arena-client/src/lobby/lobbyApi.ts` exports `LobbyMatchSummary`** with `players: { id: string; name?: string }[]` (stringified ids; open seats lack `name`). WP-092 may consume but must not re-derive the shape.
3. **`apps/arena-client/src/client/bgioClient.ts` is the SOLE runtime engine-import site in arena-client (D-9002).** WP-092 must not add a second runtime engine-import. The existing namespace-import + fallback-chain for boardgame.io's CJS bundle is not WP-092's concern unless a new boardgame.io entrypoint is needed.
4. **`apps/arena-client/src/App.vue` exposes a `searchOverride: string | null` test-only prop (D-9005)** as the route-discriminator's input seam. Production callers never pass it; WP-092's `LobbyView.vue` modifications and any new App-routing tests must follow the same pattern (see `bgioClient.test.ts` precedent).
5. **`apps/arena-client/vite.config.ts` carries the `wp-090-stub-par-storage` Rollup plugin** (post-WP-090 PM §8 scope expansion). WP-092 must not modify this plugin; if WP-092's parser introduces a new Node-only transitive import, that's a new scope-expansion question.
6. **9-field `LobbyView.vue` form is locked byte-for-byte (RS-7 from WP-090)** — every field ID, `v-model` binding, and label string must survive the WP-092 collapse-into-`<details>` modification verbatim. Same constraint EC-092 §Locked Values already names — verify the post-WP-090 file content matches the EC's expectation.
7. **`LobbyView.vue` uses `defineComponent({ setup() })` form (NOT `<script setup>`)** per the vue-sfc-loader separate-compile pipeline (D-6512 / P6-30). WP-092's modifications must keep that form.
8. **WP-090 added 11 tests across 3 new suites** (`lobbyApi (WP-090)`, `createLiveClient`, `App routing`). WP-092's expected delta is on top of these — recompute the test count expectation against `707 / 133 / 0`, not `696 / 130 / 0`.
9. **D-9001 records the lobby join/list endpoint contract verified against running server.** WP-092's parser does not call those endpoints (WP-090's `lobbyApi.ts` does), but the canonical `playerCredentials` field name and `LobbyMatchSummary.players[].name`-presence-as-open-seat semantics are now D-9001-locked.
10. **D-9003 records URL-borne credentials as MVP** — WP-090's `LobbyView.vue` rewrites `window.location.search` on submit. WP-092's collapsed manual form must preserve this submit path verbatim; the new "Create from JSON" path does the same URL rewrite (already in WP-092's design).

**Repo-wide test baseline (post-WP-090, the current HEAD `55018c1`):**

| Package | tests / suites / fail |
|---|---|
| `packages/game-engine` | 513 / 115 / 0 |
| `packages/registry` | 31 / 3 / 0 |
| `packages/vue-sfc-loader` | 11 / 0 / 0 |
| `packages/preplan` | 52 / 7 / 0 |
| `apps/server` | 19 / 3 / 0 |
| `apps/arena-client` | **77 / 3 / 0** ← moved from 66/0/0 during WP-090 (+11 tests / +3 suites: `lobbyApi (WP-090)`, `createLiveClient`, `App routing`) |
| `apps/replay-producer` | 4 / 2 / 0 |
| **Repo-wide total** | **707 / 133 / 0** |

WP-092 is an `apps/arena-client/**` packet. Expected deltas land in
`apps/arena-client` (new `loadoutParser.ts` tests; `LobbyView.vue`
remains test-harness-free under the current arena-client convention).
Every other package baseline must stay unchanged — WP-092 touches none
of them.

**Next free D-ID for WP-092:** **`D-9201`** (verified free — `grep -n "^### D-92" docs/ai/DECISIONS.md` returns no matches as of `55018c1`; D-9001..D-9005 are WP-090's, not WP-092's). D-9101 (WP-091), D-9301 (WP-093), D-9401 (WP-094) are the adjacent landed entries.

---

## 2. WP-092 Governance Status — READY (all prerequisites met)

WP-092's governance rows are already on `main` (registered during the
A0 pre-flight session at `6770fa6`):

- [WP-092-lobby-loadout-intake.md](../work-packets/WP-092-lobby-loadout-intake.md)
  — full design (881 lines)
- [EC-092-lobby-loadout-intake.checklist.md](../execution-checklists/EC-092-lobby-loadout-intake.checklist.md)
  — execution checklist (111 lines)
- `WORK_INDEX.md` contains `- [ ] WP-092 — Lobby Loadout Intake ⬜ Draft …` row
- `EC_INDEX.md` contains `EC-092 | WP-092 | Client UI (apps/arena-client/) | … | Draft |` row

**Pre-flight / session-prompt / copilot check: NOT YET AUTHORED.**
Follow the 01.4 / 01.7 / 01.2 workflow the same way WP-091 did. WP-092 is smaller than WP-091 (single new parser file + one modified Vue component, no new directory, no subpath-export glue), but the byte-for-byte string discipline is more fragile because the template now lives in **four** locations across the repo (see §3.2) and the arena-client cannot import the registry-side constant at runtime.

---

## 3. Byte-for-Byte Locked Strings (Quotable Verbatim)

**This is the single most important handoff section for WP-092.** The arena-client parser must consume these strings byte-for-byte, but **cannot import `@legendary-arena/registry` at runtime** per the layer rule (`.claude/rules/architecture.md §Import Rules`). WP-092 will carry its own byte-for-byte copies of the template and label strings, sourced from a single locked `const` at the top of the parser file.

**Sources of truth** (in descending authority):

1. `DECISIONS.md` D-9301 (WP-093) — the canonical byte-for-byte source.
2. `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` — documentation mirror of D-9301 for Stage 1 envelope validation.
3. `packages/registry/src/setupContract/setupContract.types.ts` — the WP-091 exported constant `UNSUPPORTED_HERO_SELECTION_MODE_TEMPLATE` (and four label constants) — already consumed by `LoadoutBuilder.vue` via the `@legendary-arena/registry/setupContract` subpath.
4. **`apps/arena-client/src/lobby/loadoutParser.ts` — the WP-092-authored copy that this session will land.** Must be byte-identical to sources 1–3.

If any source disagrees, **D-9301 wins byte-for-byte**. WP-093 is the sole governance authority for rule-mode names and labels; WP-091 and WP-092 are consumers, not authors.

### 3.1 Envelope field contract (WP-093, recap)

- **Field name:** `heroSelectionMode`
- **Allowed values in v1:** `["GROUP_STANDARD"]` — exactly one member
- **Required in JSON Schema:** **false** (optional; NOT in root `required`)
- **Default when absent:** `"GROUP_STANDARD"`
- **Reserved future token (prose only, NOT in v1 allowed enum):** `"HERO_DRAFT"`

### 3.2 Error contract — the template lives in FOUR locations after WP-092

- **Error code:** `"unsupported_hero_selection_mode"`
- **Error message template (normative, verbatim; `<value>` is the only permitted substitution):**

  `The loadout envelope's heroSelectionMode is <value>, which is not a supported rule mode in v1 of the match setup schema. Supported modes: GROUP_STANDARD. (HERO_DRAFT is reserved for a future release and is not yet implemented.)`

**Cross-file byte-identity grep at WP-092 pre-commit (mandatory):**

```pwsh
Select-String -Path "docs\ai\DECISIONS.md","docs\ai\REFERENCE\MATCH-SETUP-VALIDATION.md","packages\registry\src\setupContract\setupContract.types.ts","apps\arena-client\src\lobby\loadoutParser.ts" -Pattern "unsupported_hero_selection_mode"
```

Every hit must carry an identical template prefix. A stray space, a smart-quote substitution, an em-dash drift, or a paraphrased clause in any of the four files breaks the consumer contract and cascades into every future lobby-intake consumer.

### 3.3 Human-readable label mapping (WP-092 may consume if it renders rule-mode UI)

- `"GROUP_STANDARD"`
  - machine name: `"GROUP_STANDARD"`
  - short UI label: `"Classic Legendary hero groups"`
  - long explanation: `"The engine expands each selected hero group into its canonical card set at match start."`
  - future-notice UX copy: `"Hero Draft rules are planned for a future update."`

Per WP-092's current scope: the lobby intake is **parser-focused**; it does **not** render the rule-mode indicator UI (that's WP-091's surface in the Registry Viewer). If WP-092 adds any lobby-side rule-mode display (e.g., a read-only chip showing the parsed mode), the three label strings above must be copied byte-for-byte into the arena-client file — do **not** paraphrase.

### 3.4 Flavor / lore framing — NEVER in machine-readable surfaces

`"Contest of Champions"` is the in-universe flavor label for `"HERO_DRAFT"` matches. It is **narrative UI copy only** and must never appear in enums, error messages, JSON property names or values, schema validation constraints, lookup keys, branch conditions, analytics dimensions, telemetry fields, or log tokens. In v1 WP-092 surfaces this label **zero times** because `"HERO_DRAFT"` is not accepted by the parser. Same four-point naming-governance policy as WP-091 (D-9301).

### 3.5 The 9-field composition lock (00.2 §7 / `.claude/rules/code-style.md §Data Contracts`)

The parser's output type `ParsedLoadout.composition` must carry exactly these nine fields in this order, verbatim:

`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`

WP-090's existing manual create-match form already uses these field names; WP-092 forwards the composition block verbatim as `setupData` to `createMatch(setupData, numPlayers)`.

---

## 4. Operational Handoff From WP-091 Execution

Five items surfaced during WP-091 execution that apply directly to WP-092 execution.

### 4.1 Single-template-constant discipline (the reusable WP-091 pattern)

WP-091 sourced the error message template from exactly one exported `const` (`UNSUPPORTED_HERO_SELECTION_MODE_TEMPLATE`). Step 1 (zod-issue upgrade) and Step 1b (raw-input defensive fallback) both consume this constant. Tests assert exact-string equality via `assert.strictEqual`; `.includes()` / `assert.match` / substring checks are absent from the suite.

**For WP-092:** declare the template in one `const` at the top of `apps/arena-client/src/lobby/loadoutParser.ts` (suggested name: `UNSUPPORTED_HERO_SELECTION_MODE_TEMPLATE`, same name as the registry-side copy so grep finds both). Every emission site uses `TEMPLATE.replace("<value>", valueString)`. Tests assert exact-string equality. The four-file cross-file grep from §3.2 is the pre-commit gate.

### 4.2 Zod-upgrade-detector defensive fallback (new reusable pattern from WP-091)

WP-091 landed a two-path detector for the `heroSelectionMode` rejection: Step 1 maps a zod `invalid_enum_value` issue at the `heroSelectionMode` path to the WP-093 template; Step 1b inspects the raw input independently and force-injects the same template (deduplicated by `(code, field)` pair) if the raw value is a string and is not `"GROUP_STANDARD"`. Both paths reference the same exported template constant. This is belt-and-suspenders against a future zod minor-version release renaming `invalid_enum_value`, reshaping `issue.path`, or reordering issues.

**For WP-092:** WP-092 is documented as hand-rolling type predicates rather than using zod (layer rule — arena-client cannot import `@legendary-arena/registry` at runtime, and adding zod to arena-client is a new npm dep that violates L7). So the Step 1/Step 1b split doesn't directly apply. **However, the underlying discipline does:** any place in `loadoutParser.ts` that emits the `unsupported_hero_selection_mode` error must source the message from the single locked constant, and the test suite should include a compound-failure test case exercising the rejection path alongside another envelope error (e.g., missing `seed` + unsupported mode) so dedup behavior is pinned.

**If WP-092 execution reveals a need for zod** (e.g., structural validation gets complex enough that type predicates become unwieldy), **STOP and escalate** — adding zod to arena-client is a scope expansion that needs explicit user approval and a DECISIONS.md entry; do not silently add the dep.

### 4.3 Parallel-drift vigilance — watch for pCloud-sync working-tree drift

WP-093 discovered mid-session that a parallel WP-095 (Ranking Aggregation Data Model) session landed four files into the shared branch via pCloud sync **between** the implementation audit (01.6 step 4, filename-scoped) and the pre-commit review (01.6 step 5, hunk-scoped): `docs/01-VISION.md` §23(b) + §25 amendments, a new `D-0005` entry in `DECISIONS.md` at line ~115, untracked `docs/ai/DESIGN-RANKING.md`, and untracked `docs/ai/work-packets/WP-095-ranking-aggregation-data-model.md`. WP-091's filename-level scope audit passed but `git add docs/ai/DECISIONS.md` would have swept parallel work under the `EC-091:` prefix if the three-commit topology hadn't already staged DECISIONS.md after the parallel check.

**For WP-092 execution:** at every commit, run `git diff --cached docs/ai/DECISIONS.md | grep "^@@"` and expect **exactly one** hunk (the new WP-092 entry — D-9201). Same vigilance for `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`. If more than one hunk appears, a parallel session has dropped its own entry into the same file; apply the surgical-stage pattern from WP-093's post-mortem §10 / §12.3:

1. Back up the parallel-session file to `/tmp` (preserves the other session's working-tree work).
2. `git checkout HEAD -- <file>` to clean slate.
3. Re-apply only WP-092's hunk (via `Edit` or patch).
4. `git add <file>` — verify hunk count === 1.
5. Restore parallel-session's unstaged work from `/tmp` to working tree.

**The parallel session's work must be preserved, not discarded.** A wrong `checkout` can destroy another session's unstaged work.

### 4.4 Three-commit topology (WP-091 precedent, recommended for WP-092)

WP-091 executed under a three-commit topology rather than the invocation's default two-commit split:

- **A0 — SPEC:** pre-flight amendments (WP-091 + EC-091 prose) that landed in the working tree before execution but weren't in the scope lock.
- **A — EC-091:** code content + DECISIONS.md D-9101 + STATUS.md + 01.6 post-mortem.
- **B — SPEC:** governance close (WORK_INDEX.md + EC_INDEX.md status flips).

**For WP-092:** if pre-flight amendments land in the working tree (copilot check, A-092-## corrections, etc.), keep the same split. A0 SPEC first, then EC-092 content, then SPEC governance close. WP-093 used a two-commit split because it had no pre-flight amendments; WP-091 used three because it did. Choose based on actual state, not invocation default.

### 4.5 Scope expansion precedent — packaging glue is defensible if documented

WP-091 landed two glue files beyond the invocation's §6.1 scope: `setupContract/index.ts` (browser-safe subpath barrel) and a new `./setupContract` entry in `packages/registry/package.json`. Both were required so the viewer's Vite build didn't pull `node:fs/promises` through the root barrel. Post-mortem §8 documents this explicitly; the pre-commit review flagged it as a scope-expansion Concern requiring user ratification, and the user ratified.

**For WP-092:** a similar expansion could surface if arena-client's bundler has an unexpected issue with some locked design choice. If so, document it in the post-mortem §Scope Expansions section and flag it in the pre-commit review. **Do not silently expand scope.**

---

## 5. Active Risks for the WP-092 Executor

### 5.1 Byte-for-byte error-message-template drift across four files

See §3.2 and §4.1. After WP-092 lands, the template lives in **four** files:

1. `docs/ai/DECISIONS.md` D-9301
2. `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md`
3. `packages/registry/src/setupContract/setupContract.types.ts` (WP-091)
4. `apps/arena-client/src/lobby/loadoutParser.ts` (WP-092 — new)

The four-file cross-file byte-identity grep is the mandatory pre-commit gate. WP-091's post-mortem §10 records this exact grep. Any drift — even a trailing space, a smart-quote, an em-dash variant — breaks the consumer contract.

**Mitigation:** source the template from a single locked `const` at the top of `loadoutParser.ts`; never paraphrase in-line; tests use `assert.strictEqual` (never `.includes()` / `assert.match`). WP-091's test #5 is the reference pattern.

### 5.2 Layer boundary — arena-client is engine-free AND registry-free at runtime

Per `.claude/rules/architecture.md §Import Rules`:

| Package | May import | Must NOT import |
|---|---|---|
| `apps/arena-client` | UI framework, `vue-sfc-loader` (devDep only, test scripts) | `game-engine`, **`registry`** (runtime), `preplan`, `server`, `pg`, runtime `vue-sfc-loader` |

**Notably,** arena-client **cannot import `@legendary-arena/registry`** — not even the new `./setupContract` subpath WP-091 added. The parser must hand-roll its own type predicates and its own byte-for-byte copy of the template constant. No sharing with the registry-side module is possible.

Expected grep at WP-092 pre-commit:

```pwsh
Select-String -Path "apps\arena-client\src\**\*.ts","apps\arena-client\src\**\*.vue" -Pattern "from ['\""]@legendary-arena/(game-engine|registry|preplan)['\""]"
# Expected: only any existing `from 'boardgame.io'` / `from 'boardgame.io/client'` / single engine-carve-out site in bgioClient.ts already documented in WP-090. No new registry runtime imports from WP-092.
```

### 5.3 Single-site default normalization at parser boundary

WP-091 §Scope A.1 / D-9101 established the rule that `heroSelectionMode: undefined → "GROUP_STANDARD"` normalization happens in exactly one place per layer. For WP-092, that place is **inside `parseLoadoutJson()` before returning `{ ok: true, value }`**. Downstream code (LobbyView.vue, `createMatch` call site, any UI display) reads `value.heroSelectionMode` directly and relies on it being set.

Duplicate `?? "GROUP_STANDARD"` fallbacks anywhere else in the arena-client — in the Vue component's template, in the submission path, in a helper — are forbidden. They would mask parser bugs and duplicate default logic. The single-site discipline is a correctness guarantee.

### 5.4 Composition envelope vs composition submission

WP-092 forwards the **composition block only** as `setupData` to `createMatch()`. Envelope fields (`setupId`, `seed`, `createdAt`, `createdBy`, `themeId`, `expansions`) are **dropped on submission** — envelope archival is a future server-side WP alongside user profiles. The one envelope-to-submission mapping: `envelope.playerCount → numPlayers` at the call site.

**Do not forward the envelope.** The server endpoint (WP-011) accepts the composition shape `MatchSetupConfig`, not the MATCH-SETUP document. If WP-092 submits the envelope, the server will reject (or worse, silently coerce). WP-091's downloaded JSON is the MATCH-SETUP document; the parser extracts composition for submission and discards the envelope.

### 5.5 No new npm dependencies

Arena-client already has what it needs: Vue, boardgame.io/client, SocketIO transport. No zod, no ajv, no jsonschema. The parser must be hand-rolled.

If an argument for adding zod arises mid-execution (e.g., structural validation becomes tedious), **STOP and escalate** — adding a runtime dep to arena-client is scope expansion. Precedent: WP-091 maintained zod as the only runtime validator and used registry-side zod via a browser-safe subpath; arena-client has no analogous escape hatch.

### 5.6 WP-090 form preservation — do not rewrite

EC-092 is explicit that WP-090's 9-field manual create-match form must be **preserved byte-for-byte**:

- All field IDs unchanged.
- All `v-model` bindings unchanged.
- All submission logic unchanged.
- The form collapses into a `<details>` titled "Fill in manually (advanced)" above which the new "Create match from loadout JSON (recommended)" affordance lives.

**Do not rewrite any WP-090 surface.** If a field's structure seems awkward, leave it alone — WP-090 is locked. Any WP-090 correction belongs in a follow-up WP.

### 5.7 Server-side Stage 1 validation is NOT in scope

The lobby's client-side parser is a **shape guard for authoring feedback only**, not a trust boundary. The engine's `validateMatchSetup()` inside `Game.setup()` remains the authoritative composition gate. Any future server-side Stage 1 envelope validator lands in a separate WP; WP-092 does not implement it.

If execution surfaces an impulse to "also add server-side validation while I'm here", **STOP** — that's a separate WP alongside a PostgreSQL / identity layer.

### 5.8 01.5 Runtime Wiring Allowance — expect NOT INVOKED

WP-092 adds a parser + modifies a Vue component. No `LegendaryGameState` field added, no `buildInitialGameState` shape change, no new moves, no new phase hooks. All four 01.5 triggers absent. Expected declaration in the session prompt: **01.5 NOT INVOKED.**

If 01.5 appears to be needed mid-execution, that indicates mis-scoped WP — STOP and escalate rather than retroactively citing 01.5.

### 5.9 01.6 post-mortem will be MANDATORY

WP-092 fires at least two 01.6 triggers:

1. **New contract consumed by future WPs** — the lobby-side `ParsedLoadout` type and the parser's error-code taxonomy become the first consumer surface for the WP-091-authored JSON shape. Any future arena-client WP that accepts a MATCH-SETUP document consumes this parser.
2. **Second byte-for-byte consumer of WP-093 strings** — WP-091 established the single-template-constant precedent registry-side; WP-092 establishes the second arena-client-side copy. The four-file cross-file grep gate becomes permanent.

Potentially a third:

3. **New code subdirectory** — if `apps/arena-client/src/lobby/loadoutParser.ts` is the first file under a new `src/lobby/` subdirectory (check `02-CODE-CATEGORIES.md` and the current arena-client tree). Likely YES given WP-090's `LobbyView.vue` path.

Any one trigger makes 01.6 mandatory. Author the post-mortem at `docs/ai/post-mortems/01.6-WP-092-lobby-loadout-intake.md` per the 01.6 template.

---

## 6. Patterns Still in Effect

- **Commit prefix hygiene (01.3):**
  - `EC-092:` on code-changing commits (the parser + `LobbyView.vue` modifications + governance close if bundled).
  - `SPEC:` on pre-flight amendments and governance close (WORK_INDEX.md + EC_INDEX.md flips).
  - **Bundled or split topology both acceptable;** WP-091 used three-commit split (A0 SPEC pre-flight + A EC content + B SPEC governance close), WP-093 used two-commit (A EC content + B SPEC governance close).
  - `WP-092:` prefix is **forbidden** — commit-msg hook rejects per P6-36.
- **Co-authored trailer** — every commit in this branch carries `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`; follow the convention.
- **§18 prose-vs-grep** — no known legacy tokens to guard against in WP-092's scope; §18 applies if execution introduces a grep pattern whose own search string would self-match (e.g., documenting `"HERO_DRAFT"` in a comment adjacent to a `grep "HERO_DRAFT"` verification step).
- **§19 Bridge-vs-HEAD staleness** — if WP-092 authors bridge artifacts (this session-context, for example), reconcile them against HEAD before committing.
- **Additive-only edits to governance docs** — any WP-092 additions to `DECISIONS.md` (D-9201), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md` must be purely additive; no rewriting of existing prose. WP-091 L9 precedent.
- **pCloud conflict vigilance** — if a `[conflicted N]` copy of any target file appears during execution, verify the canonical file's line count against the pre-execution baseline before editing.
- **Parallel-drift vigilance** (still active) — see §4.3.
- **Baseline preservation** — engine `513 / 115 / 0`, registry `31 / 3 / 0`, preplan `52 / 7 / 0`, vue-sfc-loader `11 / 0 / 0`, server `19 / 3 / 0`, arena-client baseline **`77 / 3 / 0`** (post-WP-090; up from 66/0/0) will increase by the WP-092-locked test count (see WP-092 §Scope / EC-092 for the exact delta), replay-producer `4 / 2 / 0`, repo-wide `707 / 133 / 0`. Other package baselines must remain unchanged — WP-092 touches none of them.
- **No `--no-verify` or `--no-gpg-sign`** unless the user explicitly requests it.
- **Staging by exact filename only** — never `git add .` / `-A` / `-u` (P6-27 / P6-44).
- **Inherited untracked files** — `.claude/worktrees/`, `WP-059-preplan-ui-integration.md`, `EC-059-preplan-ui-integration.checklist.md`, the now-spent session artifacts (`session-wp091-loadout-builder-registry-viewer.md`, `session-wp093-match-setup-rule-mode-envelope-field.md`, `session-context-wp091.md`) remain untracked and **never staged by WP-092**. Any parallel session's uncommitted work surfaces as untracked too — preserve it.
- **01.5 runtime-wiring allowance** — evaluate at session-prompt authoring time. Expected NOT INVOKED (WP-092 is UI + parser, not engine runtime wiring).
- **01.6 post-mortem** — **MANDATORY** (two or three triggers; see §5.9).
- **01.7 Copilot Check** — recommended per WP-089 / WP-091 / WP-093 precedent; cheap insurance even for a smaller packet, especially given the byte-for-byte consumer discipline.
- **Pre-commit review in a separate session** — run `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md` as a standalone gate session. WP-091's experience confirms this catches hunk-level parallel-drift and scope-expansion concerns the implementation session misses (see WP-091 pre-commit review report for the three-axis-expansion call-out).

---

## 7. Authoritative References

This file is **not authoritative**. If a conflict arises:

- On design intent → [WP-092](../work-packets/WP-092-lobby-loadout-intake.md) wins
- On execution contract → [EC-092](../execution-checklists/EC-092-lobby-loadout-intake.checklist.md) wins
- On the MATCH-SETUP schema itself → [MATCH-SETUP-SCHEMA.md](../REFERENCE/MATCH-SETUP-SCHEMA.md) + [MATCH-SETUP-JSON-SCHEMA.json](../REFERENCE/MATCH-SETUP-JSON-SCHEMA.json) + [MATCH-SETUP-VALIDATION.md](../REFERENCE/MATCH-SETUP-VALIDATION.md) win
- On `heroSelectionMode` strings → [DECISIONS.md D-9301](../DECISIONS.md) wins (byte-for-byte source)
- On the 9-field composition lock → [00.2 §7](../REFERENCE/00.2-data-requirements.md) + [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) win
- On layer boundaries → [ARCHITECTURE.md §Layer Boundary (Authoritative)](../ARCHITECTURE.md) wins (including the registry-is-forbidden-at-runtime rule for arena-client)
- On the registry-side consumer pattern → [DECISIONS.md D-9101](../DECISIONS.md) wins (the registry-side template constant, the single-site default normalization rule, the defensive-fallback pattern)
- On commit hygiene → [01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) wins
- On post-mortem triggers → [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) wins
- On lint-gate prose discipline → [00.3 §17 / §18 / §19](../REFERENCE/00.3-prompt-lint-checklist.md) win
- On pre-commit review role → [PRE-COMMIT-REVIEW.template.md](../prompts/PRE-COMMIT-REVIEW.template.md) — **run in a separate session**, per WP-091/WP-093 precedent

This bridge file is effectively operational-only; once WP-092 executes and D-9201 lands in DECISIONS.md, the file serves as a historical record of the handoff from WP-090 (executed 2026-04-24 at `54b266a` / governance close `55018c1`) to the WP-092 execution session, not a live guide.

---

## 8. Tidy-Up Note — D-9301 stale path citation (RESOLVED)

During WP-091 execution, A-091-02 flagged that D-9301's citation line referenced `packages/game-engine/src/setup/matchSetup.types.ts`, but the actual file lives at `packages/game-engine/src/matchSetup.types.ts` (no `setup/` subdirectory). WP-091 did **not** touch D-9301 (scope lock — §6.6 forbids modifying existing DECISIONS entries). The fix was flagged for a separate follow-up `SPEC:` commit.

**Resolution:** the fix landed as a one-hunk SPEC commit at **`61316a6`** (`SPEC: D-9301 — correct stale matchSetup.types.ts citation path (A-091-02)`), upstream of WP-090. No further action needed at WP-092 session start.
