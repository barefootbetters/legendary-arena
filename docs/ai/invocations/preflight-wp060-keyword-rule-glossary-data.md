# Pre-Flight — WP-060: Keyword & Rule Glossary Data Migration

> **Artifact type:** Pre-flight (Work Packet Readiness & Scope Lock) per
> `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`.
> **Subordinate to:** `.claude/CLAUDE.md` → `ARCHITECTURE.md` →
> `.claude/rules/*.md` → EC (TBD — see §Dependency Contract Verification).
> **Input session context:** `docs/ai/session-context/session-context-wp060.md`.

---

## Pre-Flight Header

- **Target Work Packet:** `WP-060 — Keyword & Rule Glossary Data Migration`
- **Title:** Keyword & Rule Glossary Data Migration
- **Previous WP Status:** `WP-058 Complete (2026-04-20, commit 00687c5 governance close)`
- **Pre-Flight Date:** 2026-04-20
- **Invocation Stage:** Pre-Execution (Scope & Readiness)
- **HEAD at pre-flight:** `00687c5` (SPEC: close WP-058 / EC-058 governance)
- **Working tree:** inherited dirty tree exactly matches
  `session-context-wp060.md §Inherited dirty-tree map` (11 untracked +
  5 modified docs, none in any WP-060 allowlist; quarantined stashes
  `stash@{0}` / `stash@{1}` / `stash@{2}` untouched).

**Work Packet Class:** **Runtime Wiring** *(viewer-layer variant)*.

Rationale: WP-060 is **Content / Data + UI Integration** (the session
context's phrase) confined to the `apps/registry-viewer/` UI app. It adds
two new JSON artifacts, introduces a new runtime-visible contract
(`getKeywordGlossary()` / `getRuleGlossary()` singleton fetchers from R2),
and re-wires `useRules.ts` to consume that contract instead of inline
data. It introduces **zero** boardgame.io state, zero moves, zero phase
hooks, and zero `G` mutations. The engine/preplan/server layers are
completely untouched.

Because the "Runtime Wiring" class in `01.4` is authored for engine WPs,
the sections below interpret it for the viewer layer where relevant
(e.g., framework ctx and mutation-boundary sections are N/A; structural
readiness and scope-lock remain fully applicable). The 01.5 runtime
wiring allowance is **not invoked as an engine-contract clause**; a
parallel *viewer-scope expansion* clause is recommended to cover the
`useGlossary.ts` wiring edit discovered below (see §Risk & Ambiguity
R-1). The session prompt, not this pre-flight, is the correct surface
on which to cite either 01.5 or an equivalent scope-expansion
authorization.

---

## Pre-Flight Intent

Perform a pre-flight validation for `WP-060`.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

## Authority Chain (Must Read)

Read in order:

1. `.claude/CLAUDE.md` — EC-mode rules, bug handling, commit discipline.
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary (Authoritative); registry
   viewer's `apps/registry-viewer/**` layer rules.
3. `docs/03.1-DATA-SOURCES.md` — input-data inventory for the new
   `keywords-full.json` / `rules-full.json` entries (see §Input Data
   Traceability Check below — new entries required).
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — category rules for the
   new `src/lib/glossaryClient.ts`.
5. **EC for WP-060 — DOES NOT EXIST YET.** The file at
   `docs/ai/execution-checklists/EC-060-keyword-glossary.checklist.md`
   is **not** the EC for this WP — it is the already-executed EC for an
   earlier viewer-scope commit (`6a63b1c EC-060: add glossary tooltips,
   mobile set-pill fix, and viewer docs`). Slot `EC-060` is consumed.
   See §Dependency Contract Verification item D-2 below — an EC must
   be authored at the next free slot before a session prompt is
   generated.
6. `docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md` — the WP
   specification. Draft state as of 2026-04-13; **out of date on two
   locked inputs** (source baseline and acceptance counts — see §D-1
   and §D-3).
7. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — referenced
   for the scope-expansion pattern only; engine-scope framing does not
   directly apply (no `LegendaryGameState`, no moves, no phase hooks
   in WP-060). See §R-1 below for the viewer-scope analog.
8. Precedent: **WP-055 theme data model** at commit `dc7010e` —
   `themeClient.ts` is the canonical singleton pattern WP-060 must
   mirror (confirmed via direct read of
   `apps/registry-viewer/src/lib/themeClient.ts:49–113`).

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-003 (registry exists) | **pass** | `packages/registry/` + `data/metadata/` exist; `data/metadata/` currently holds `card-types*.json`, `hero-classes.json`, `hero-teams.json`, `icons-meta.json`, `leads.json`, `sets.json`. Slots for `keywords-full.json` / `rules-full.json` are free. |
| WP-058 (prior landed WP on this trunk) | **pass** | Close commit `00687c5`; repo-wide tests **588 passing / 0 failing** per session context §Test baselines. WP-060 must hold this baseline. |
| Foundation Prompts (FP-00.4 → 00.5 → 01 → 02) | **pass (inherited)** | No WP-060 scope touches FP-governed surfaces (DB schema, server wiring, env). |

**Verdict:** sequencing is clean. WP-060 has no runtime dependency on
any in-flight Phase 6 WP. It can execute on `wp-060-keyword-rule-glossary`
(session context line 84 recommends cutting a fresh branch off the current
`wp-081-registry-build-pipeline-cleanup` trunk before execution — WP-060
touches only `apps/registry-viewer/` + `data/metadata/` and is topically
disjoint from the preplan / build-pipeline work on the current branch).

---

## Dependency Contract Verification

### D-1 — **Source-of-truth baseline conflict** (BLOCKING; WP AMENDMENT REQUIRED)

**WP §Session Context + §Scope (In) §A** directs the executor to copy
the external source files at
`C:\Users\jjensen\bbcode\modern-master-strike\src\data\keywords-full.json`
(102 keywords) and `.../rules-full.json` (18 rules). Both files exist
on disk — verified by `ls` — so the copy path is mechanically possible.

**Session context §Domain Context (lines 34–39) explicitly contradicts
this:**

> the hardcoded glossary in useRules.ts has MORE entries than the source
> JSON files (we added ~30 keywords during viewer development). The
> migration must use the hardcoded glossary as the baseline, NOT the
> source JSON files.

**Pre-flight verification against actual code** confirms the session
context is correct:

- `apps/registry-viewer/src/composables/useRules.ts:23–105` →
  `RULES_GLOSSARY` has **20 entries** (18 base + `additional mastermind`
  + `transforms`), not 18.
- `apps/registry-viewer/src/composables/useRules.ts:111–225` →
  `KEYWORD_GLOSSARY` has **~113 entries**, including the modifier
  variants the session context enumerates (`ultimateabomination`,
  `doublestriker`, `triplestriker`, `doubleabomination`,
  `highestabomination`, `doubleempowered`, `tripleempowered`,
  `quadrupleempowered`, `doubledarkmemories`, `doublelaststand`,
  `doubleshieldclearance`) **plus** one entry the session context did
  not call out (`villainousweapons` appears once as a keyword at L204
  **and** once as a rule-style phrase — `useGlossary.ts:47–49` has a
  `// why:` comment noting `villainousweapons` appears twice and
  deduplicates at build time; this is a real data quirk the migration
  must preserve).

**Resolution required before execution:** WP-060 §Session Context +
§A must be amended to name the **hardcoded maps in useRules.ts** as
the authoritative baseline. §Goal's "102 keywords with definitions"
and §Acceptance Criteria's "102 keyword entries" / "18 rule entries"
must both be amended to match the actual exported maps
(20 rules / ~113 keywords — the exact counts must be re-derived at
execution time since the count may drift from this pre-flight).

Authority: this is a direct instance of the `01.4 §Dependency Contract
Verification` precedent **"Locked value string literals match actual
code"** (WP-023, D-2304) and **"Runtime data availability verified"**
(WP-023, D-2302) — a WP specifying input data different from the code
that actually produces / consumes it.

### D-2 — **EC-060 slot already consumed** (BLOCKING; NEW EC REQUIRED)

`docs/ai/execution-checklists/EC-060-keyword-glossary.checklist.md`
**is not** the EC for WP-060-as-specified. Direct read of the file
confirms:

- Header: "EC-060 — Keyword & Rule Glossary Tooltips".
- **Files to Produce** lists: `CLAUDE.md`, `HISTORY-modern-master-strike.md`,
  `App.vue` ("hide set pills on mobile"), `CardDetail.vue` ("hero class
  tooltips"), `useRules.ts` ("full keyword glossary + hero class
  glossary"). None overlap WP-060's "Files Expected to Change" except
  the filenames `App.vue` and `useRules.ts`, and for both the edit
  intent is disjoint.
- Every checklist item is `[x]` complete.
- Git confirms it shipped at commit `6a63b1c EC-060: add glossary
  tooltips, mobile set-pill fix, and viewer docs` — long before the
  current branch.

This is a locked-precedent EC-slot-collision pattern exactly matching
the six prior retargetings documented in `EC_INDEX.md:186–194`
(EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069, EC-063 → EC-071,
EC-080 → EC-072, EC-079 → EC-073, EC-064 → EC-074).

**Free slots available for WP-060 retargeting:**

- `060+` engine/shared-tooling series: EC-062, EC-063, EC-064, EC-070,
  EC-075+.
- `101+` registry-viewer series: **EC-106** or later (next free after
  EC-105 deferred).

**Recommendation:** assign **EC-106** — WP-060 is unambiguously an
`apps/registry-viewer/` WP (layer boundary: viewer app imports
`registry` package + Vue + `zod`; no game-engine, preplan, server, or
`pg` involvement). It belongs in the viewer series, not the
shared-tooling series. Final assignment is a human decision; the
session prompt must not be generated until the slot is picked, the
new EC file is authored, and `EC_INDEX.md` is updated with the
retargeting note following the six-row precedent. Commit prefix on
all code commits will then be `EC-106:` (or the chosen slot's number)
— not `EC-060:`, not `WP-060:` (the latter is rejected by
`.githooks/commit-msg` per P6-36).

Until both §D-1 and §D-2 are resolved, pre-flight is **NOT READY**.

### D-3 — **Acceptance criteria counts are wrong** (BLOCKING; WP AMENDMENT REQUIRED)

WP §Acceptance Criteria (lines 210–211) requires:

> - [ ] `data/metadata/keywords-full.json` exists with **102** keyword entries
> - [ ] `data/metadata/rules-full.json` exists with **18** rule entries

Per §D-1 above, the true baseline is the hardcoded maps (~113 keywords,
20 rules). If the WP-stated counts remain in the acceptance criteria,
a correctly-executed migration will fail acceptance at Step 1 of the
Verification Steps block (`node -e "JSON.parse(...).length"` — WP L230
expects `102` but will read `~113`). Amend to match the actual
re-derived counts.

### D-4 — **`lookupKeyword()` enhanced matching must be preserved** (LOCK REQUIRED)

`useRules.ts:319–361` defines `lookupKeyword` as a 40-line matcher with
exact-lowercase / space-hyphen-stripped / prefix / suffix / substring
matching, handling parameterized forms (`Focus 2`, `Patrol the Bank`),
modifier prefixes (`Ultimate Abomination`, `Double Striker`,
`Rooftops Conqueror 3`), and long compound tokens
(`Cross-Dimensional Hulk Rampage` → `crossdimensionalrampage`).

WP §D says "Update `lookupKeyword()` and `lookupRule()` to query the
fetched data." A naïve rewrite to `return fetchedMap.get(lower) ?? null`
would regress every modifier keyword — silently, because no unit tests
exist for `lookupKeyword` today (confirmed: the WP's acceptance is
build + manual tooltip check, per session context §Expected baseline
shift lines 109–112).

**Lock:** the fetched-data refactor must preserve the full suffix +
substring + modifier-prefix matching logic verbatim. The Map source
changes (module-scope constant → lazily-fetched singleton accessor);
the algorithm does not. The session prompt must state this lock
explicitly and note that `lookupKeyword` / `lookupRule` are **public
signatures** — their return types and null-on-miss contract must not
change (per WP §Key constraints line 60).

Authority: `01.4 §Established Patterns to Follow` — "No changes to
locked helpers unless a WP explicitly authorizes it." The WP authorizes
*switching the backing store* but does not authorize *simplifying the
lookup algorithm*.

### D-5 — **`useGlossary.ts` import breaks** (BLOCKING; SCOPE GAP)

`useGlossary.ts:11–17` imports `RULES_GLOSSARY`, `KEYWORD_GLOSSARY`,
and `HERO_CLASS_GLOSSARY` directly from `useRules.ts`. `useGlossary.ts:33–81`
builds `allEntries` at **module load time** by iterating those three
Maps synchronously (`useGlossary.ts:101 — const allEntries =
buildAllEntries();`).

If WP-060 §D is executed as written — "Remove the hardcoded
KEYWORD_GLOSSARY Map (102 entries). Remove the hardcoded RULES_GLOSSARY
Map (18+ entries)" — then:

1. The import at `useGlossary.ts:12–13` resolves to undefined exports,
   which is a **compile error** (`useRules.ts` exports `RULES_GLOSSARY`
   and `KEYWORD_GLOSSARY` by name; removing the `export const` line
   fails `tsc`). Build will not pass. Acceptance Criteria "build
   passes" is unsatisfiable.
2. Even if the imports are preserved as `const` references to the new
   fetched data, `buildAllEntries()` runs at module-eval time — before
   `onMounted` → `getKeywordGlossary()` resolves — and the glossary
   panel would bind to empty Maps. User-visible regression.

Session context explicitly flagged this (§Domain Context lines 70–72):

> The GlossaryPanel component (useGlossary.ts) builds a unified entry
> list from all three glossary sources at import time. After WP-060,
> this needs to rebuild after the async glossary fetch resolves.

**WP §Files Expected to Change does NOT list
`apps/registry-viewer/src/composables/useGlossary.ts`.** The WP's
allowlist is insufficient for its own stated behavior.

**Resolution:** the WP must be amended to add `useGlossary.ts` to
"Files Expected to Change" with a narrow scope — convert
`allEntries` from a module-eval constant to a reactive `ref<GlossaryEntry[]>`
(or a computed over the fetched Maps), and re-derive after the fetch
resolves. `openToKeyword()` / `openToRule()` must continue to work
(they currently read `allEntries` synchronously at call time; if the
panel is opened before the fetch completes, they must either wait or
no-op gracefully — the WP-060 non-blocking-fetch guardrail in WP §Key
constraints line 58–59 requires the latter).

This pattern is the **WP-029 precedent** enumerated at
`01.4 §Risk & Ambiguity` — "Filter input type missing required data"
(WP-029: `UIPlayerState` had no `handCards` field; `buildUIState`
needed modification to populate it. Neither WP-029 nor EC-029
originally included `uiState.build.ts` in their file lists). The
scope expansion is authorized via the viewer analog of 01.5
(minimal, strictly dependency-driven, no new behavior — the UI
continues to render the same entry list from the same three sources;
only the timing of derivation changes).

### D-6 — **No other consumer breaks** (CONFIRMED CLEAN)

Direct grep across `apps/registry-viewer/` for all three Map names
and for `from '../composables/useRules'` / `from './useRules'`
produces **exactly three consumer files**:

1. `CardDetail.vue:3–4` — imports `parseAbilityText`, `lookupKeyword`,
   `lookupRule`, `lookupHeroClass`, and the `AbilityToken` type. **All
   function imports**, no Map imports. Safe as long as D-4 lock holds.
2. `useGlossary.ts` — the D-5 case above.
3. `useRules.ts` itself (self-references in bodies and `parseAbilityText`).

No other file in the viewer reads the Maps directly. The `GlossaryPanel.vue`
component (WP §Session Context line 61) consumes `useGlossary()` only.
`CardDetail.vue` tooltip behavior is **preserved unchanged** provided
D-4 holds.

### D-7 — **Source data verification** (CONFIRMED — but supplanted by D-1)

External source files exist:

- `C:\Users\jjensen\bbcode\modern-master-strike\src\data\keywords-full.json`
- `C:\Users\jjensen\bbcode\modern-master-strike\src\data\rules-full.json`

(verified by `ls` — both present). WP §Assumes line 63 is therefore
*mechanically* true. However, per §D-1, these are **not** the correct
baseline — they are the *origin* the hardcoded maps diverged from.
WP §Assumes line 63 must be re-interpreted after the amendment as
"source files `useRules.ts:RULES_GLOSSARY` / `KEYWORD_GLOSSARY` /
`HERO_CLASS_GLOSSARY` exist in the codebase" — all three confirmed
present at `useRules.ts:23` / `:111` / `:230`.

### D-8 — **R2 upload is a live, irreversible side effect** (LOCK REQUIRED)

WP §Scope (In) §B requires uploading to
`images.barefootbetters.com/metadata/keywords-full.json` and
`images.barefootbetters.com/metadata/rules-full.json`. Per session
context §WP-060-specific concerns line 181–188, this is **not** a
`git` action and is not reversible via `git reset`. Three locks:

- **Timing:** upload must occur *after* the new JSON files are
  authored and committed (Commit A lands; upload is a separate
  operator step performed with R2 credentials; verification via
  `curl -sI` at acceptance Step 6). The session prompt must specify
  this ordering explicitly.
- **Credentials:** R2 credentials are **not** in the repo. If the
  executor cannot authenticate to R2, execution must STOP and escalate,
  not silently skip the upload. Following the WP-055 theme upload
  precedent.
- **No automated rollback:** the only post-upload check is the HTTP
  HEAD status. Session prompt must surface this as a guardrail.

### D-9 — **Immutable / contract file respect** (CONFIRMED CLEAN)

WP-060 touches zero files marked immutable by prior WPs
(`schema.ts`, `shared.ts`, `localRegistry.ts` per WP-003). All three
targeted files (`useRules.ts`, `App.vue`, `CLAUDE.md`) are
viewer-owned and have been modified by multiple prior ECs (EC-101
through EC-105). `glossaryClient.ts` is a new file with no prior
contract. `keywords-full.json` / `rules-full.json` are new
`data/metadata/` artifacts with no prior provenance in this repo.

### D-10 — **`exactOptionalPropertyTypes` guard** (CONFIRMED N/A)

Session context §WP-060-specific concerns #4 (line 201–205) notes
this tsconfig strictness does not apply to registry-viewer. The
WP-058 conditional-assignment gotcha does not carry forward. No
action required; pre-flight verified.

---

## Input Data Traceability Check

Answer YES / NO:

- [ ] All non-user-generated inputs consumed by this WP are listed in
  `docs/03.1-DATA-SOURCES.md` — **NO.** `docs/03.1-DATA-SOURCES.md`
  §Registry Metadata (line 40) does not currently list
  `keywords-full.json` or `rules-full.json`. The WP §Governance
  section (line 193–203) does require a DECISIONS.md entry but does
  **not** require a 03.1 update. **Action:** add a 03.1 update to the
  WP's governance section — the two new R2 artifacts are exactly the
  class of non-user-generated inputs 03.1 was built to inventory.
  Mirror the existing `sets.json` / `card-types.json` entries' shape.
- [x] The storage location for each input is known — YES. Source:
  `apps/registry-viewer/src/composables/useRules.ts` (post-§D-1
  amendment). Destination: `data/metadata/*.json` (git) +
  `images.barefootbetters.com/metadata/*.json` (R2).
- [x] It is possible to determine which data source(s) would need to be
  inspected if this WP's behavior is incorrect — YES. `useRules.ts`
  exports today; after WP-060, `glossaryClient.ts` fetches from R2
  with the R2 URL derivable from `public/registry-config.json`
  `metadataBaseUrl` + `/metadata/`.
- [x] The WP does not introduce "implicit data" — YES. All data is
  externalized to the two JSON files.
- [ ] Any setup-time derived fields introduced or modified are listed
  under **Setup-Time Derived Data (In-Memory)** — N/A. WP-060 is
  pure data + fetch plumbing; no setup-time derivation in `G`.

**One NO** (03.1 update) — does not block by itself per `01.4 §Input
Data Traceability Check` rule ("A NO does not block execution by
default, but multiple NO answers indicate unacceptable maintenance
and debugging risk"). Single NO; acceptable as a governance
line-item tacked onto the WP's existing DECISIONS.md update, not a
blocker.

---

## Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — YES (588 / 0 at HEAD
  `00687c5` per session context §Test baselines).
- [x] No known EC violations remain open — YES (WP-058 closed 2026-04-20).
- [ ] Required types/contracts exist and are exported as referenced by
  WP-060 — **PARTIAL.** `ThemeDefinition` in `themeClient.ts` is the
  pattern to mirror; `RuleEntry` type in `useRules.ts:16–19` is the
  rule-value shape WP-060 must preserve. New types `glossaryClient.ts`
  will introduce (e.g., a `KeywordGlossary = Map<string, string>`
  alias, a `RuleGlossary = Map<string, RuleEntry>` alias) are *not*
  authorized by the WP's current text — the WP should lock these
  shape names during pre-flight to prevent ad-hoc invention during
  execution. **Action:** lock the public API of `glossaryClient.ts`
  exactly during §Scope Lock below.
- [x] No naming or ownership conflicts — YES. `glossaryClient.ts` is a
  new file; no prior file in `apps/registry-viewer/src/lib/` claims
  the name. Git confirms absence.
- [x] No architectural boundary conflicts anticipated — YES. Viewer
  layer imports: registry package + Vue + zod. WP-060 adds fetch +
  singleton Promise — same shape as `themeClient.ts`, which is
  already the locked precedent.
- [ ] If the WP touches database schemas or migrations — N/A.
- [x] If the WP depends on R2 data: `pnpm validate` passes — YES at
  HEAD; the new `keywords-full.json` / `rules-full.json` are not in
  the validator's current scope (it validates card metadata, not
  glossary text). WP may optionally extend the validator in a
  follow-up; out of WP-060 scope.
- [x] If the WP reads data from G fields — N/A (no G).

**One partial, no blocking NO.** Structural readiness clears provided
the `glossaryClient.ts` public API is locked in §Scope Lock.

---

## Runtime Readiness Check (Mutation & Framework)

*Viewer-layer interpretation:*

- [x] Runtime touchpoints are known — YES. Two touchpoints:
  (a) `App.vue:onMounted` block (lines 142–177), parallel to the
  existing `getThemes()` call at lines 160–166; (b)
  `useGlossary.ts`'s build-time entry list (§D-5).
- [x] Framework context requirements understood — N/A for boardgame.io;
  Vue 3 Composition API requirements are well-established in the
  viewer and require no new wiring.
- [x] Existing test infrastructure can support required mocks — YES
  (no tests required by WP; if tests are added for `glossaryClient.ts`
  they are plain TS unit tests under `node:test` — no vue-sfc-loader
  needed).
- [x] Runtime wiring allowance needs anticipated — YES. See §D-5 and
  §R-1. The viewer analog of 01.5 (minimal, strictly
  dependency-driven, no new behavior beyond wiring) should be cited
  explicitly in the session prompt for the `useGlossary.ts` edit.
- [x] No architecture boundary violations expected — YES.
- [x] Integration point code has been read — YES (`themeClient.ts`
  full read; `App.vue:142–177` read; `useGlossary.ts` full read).
- [ ] New move/hook stage gating — N/A.
- [x] Multi-step mutations ordering safe — YES. Order is: (1) author
  JSONs + viewer code; (2) Commit A `EC-NNN:`; (3) R2 upload (live,
  separate operator step); (4) `curl -sI` verification. Source (git
  JSON) is authored before destination (R2) is required — correct
  ordering by default.
- [x] Registry data flow — N/A (no engine / no G).
- [ ] Phase transitions observability flag — N/A.
- [ ] Simultaneous conditions evaluation order — N/A.
- [x] Degradation path for unknown/unsupported types — YES. WP §Key
  constraints (lines 58–59) and §C ("Non-blocking — registry viewer
  works even if glossary fetch fails, falling back to empty
  definitions") already specify warn-and-continue. Lock this in the
  session prompt — consistent with the `themeClient.ts` precedent at
  `App.vue:160–166`.
- [ ] Move functions called outside framework — N/A.
- [ ] `makeMockCtx` / PRNG assumptions — N/A.

Runtime readiness clears provided §R-1 scope expansion is authorized
in the session prompt.

---

## Established Patterns to Follow (Locked Precedents)

Applicable precedents that WP-060 must reuse (not reinvent):

- **Singleton loader pattern** — `themeClient.ts:49–113` is the
  verbatim template. `glossaryClient.ts` must structurally mirror:
  module-level `_promise: Promise<T> | null`, one-shot IIFE-style
  fetch inside the promise body, `Promise.allSettled` for parallel
  sub-fetches (if any), `devLog('<category>', 'load start' / 'load
  complete' / 'load failed', {...})` logging for EC-104 debug-surface
  parity, and a `reset<Thing>()` export for tests.
- **Non-blocking app mount** — `App.vue:159–166` shows the existing
  theme-load pattern: inside `onMounted`, wrapped in `try/catch`,
  `console.warn(...)` on failure, app continues. WP-060's glossary
  load must follow the identical pattern.
- **Config read once** — `App.vue:145–148` reads
  `/registry-config.json` for `metadataBaseUrl`. The glossary fetcher
  takes `metadataBaseUrl` as a parameter (same as `getThemes`);
  `App.vue` must not re-read the config.
- **Viewer layer boundary** — `apps/registry-viewer/**` may import
  `registry`, Vue, Zod, UI framework; **must NOT import**
  `game-engine`, `preplan`, `server`, `pg`, `boardgame.io`. WP-060 is
  fully compliant at the design level (fetch-only singleton); the
  session prompt must include the `grep -r "game-engine\|boardgame\.io"
  apps/registry-viewer/src/lib/glossaryClient.ts` verification step.
- **Three-commit topology** — session context §Commit discipline
  (lines 149–171) is authoritative: **A0 SPEC** (pre-flight bundle,
  amendments, this file, copilot check, session-context, EC_INDEX row,
  session prompt) → **A EC-NNN:** (execution: 2 JSONs + `glossaryClient.ts`
  + modified `useRules.ts` / `App.vue` / `useGlossary.ts` / viewer
  `CLAUDE.md` + optional 01.6 post-mortem) → **B SPEC:** (governance
  close: STATUS + WORK_INDEX + EC_INDEX). Never `WP-060:`; never
  `git add .` / `-A` / `-u`; never `--no-verify`; no push to remote.
- **Exact-filename staging** — inherited from WP-056/057/058
  precedent. Verified by session context §Inherited dirty-tree map
  — 11 items MUST NOT be staged.
- **Quarantined stashes MUST NOT pop** — `stash@{0}`, `stash@{1}`,
  `stash@{2}` (session context lines 142–147). WP-060 does not touch
  any of their content surfaces.
- **01.6 post-mortem triggers** — this is a **data migration + UI
  fetch plumbing** WP. The 01.6 triggers are (a) new long-lived
  abstraction, (b) new code category, (c) new contract, (d) new
  setup artifact. `glossaryClient.ts` is a *new singleton file
  mirroring an existing precedent* (`themeClient.ts`) — arguably not
  "new long-lived abstraction" but rather "new instance of existing
  abstraction." Session context line 255–256 suggests OPTIONAL per
  the WP-081 doc-only-subtractive verdict. **Pre-flight
  recommendation:** declare **OPTIONAL** — matching the WP-055 theme
  data-migration precedent, which did not require a post-mortem.
  The session prompt should evaluate each trigger explicitly and
  declare NOT TRIGGERED, consistent with session-context line 256.

Patterns that do **NOT** apply to WP-060 (carried forward from
session context §What does NOT transfer from WP-058 lines 207–237):

- Full-spread 42/42 aliasing discipline — N/A (no engine projections).
- `NonNullable<>` drift-check — N/A.
- `exactOptionalPropertyTypes` conditional-assignment — N/A
  (registry-viewer tsconfig does not enable it; confirmed at §D-10).
- Ledger-sole rewind / RS-8 null-on-inactive — N/A (no preplan).
- `Date.now` carve-out — N/A.
- P6-50 paraphrase discipline — N/A (viewer JSDoc is not under the
  engine-token embargo).
- `// why:` on `ctx.events.setPhase` / `endTurn` — N/A (no engine
  lifecycle).
- One-`describe()`-per-file (WP-031 / 057 precedent) — **DOES
  transfer** if the executor elects to add tests for `glossaryClient.ts`.
- Exact-filename staging — **DOES transfer** (universal).
- Dirty-tree + quarantine discipline — **DOES transfer** (universal).

---

## Code Category Boundary Check

- [x] All new or modified files fall cleanly into one existing code
  category.
  - `data/metadata/keywords-full.json` (new) → **data-input** category
    (same as `sets.json`, `card-types.json`, etc.). Existing
    classification covers it; no DECISIONS.md entry needed.
  - `data/metadata/rules-full.json` (new) → **data-input** category.
    Same.
  - `apps/registry-viewer/src/lib/glossaryClient.ts` (new) → viewer
    `src/lib/` which already hosts `themeClient.ts`, `registryClient.ts`,
    `debugMode.ts`, `devLog.ts`, `theme.ts`. Existing classification
    covers it; no DECISIONS.md entry needed. This **contrasts with**
    D-2706 / D-2801 / D-3001 / D-3101 / D-3401 precedents — those
    were new *engine* subdirectories requiring explicit code-category
    decisions. Viewer `src/lib/` is already well-populated and does
    not need re-classification.
  - `apps/registry-viewer/src/composables/useRules.ts` (modified) —
    existing file, existing category.
  - `apps/registry-viewer/src/composables/useGlossary.ts` (modified
    per §D-5) — existing file, existing category.
  - `apps/registry-viewer/src/App.vue` (modified) — existing file,
    existing category.
  - `apps/registry-viewer/CLAUDE.md` (modified) — existing file.
- [x] Each file's category permits all imports and mutations it uses.
- [x] No file blurs category boundaries.
- [x] No new directory created — N/A.

**Clean.** No code-category decisions required. WP-060 uses only
existing, pre-classified surfaces.

---

## Scope Lock (Critical)

### WP-060 Is Allowed To

- **Create:** `data/metadata/keywords-full.json` — JSON array of
  keyword entries. Shape: `Array<{ key: string; description: string }>`
  **or** `Record<string, string>` — session prompt must pick one and
  lock it. The current hardcoded `KEYWORD_GLOSSARY: Map<string, string>`
  preserves insertion order; JSON must preserve a stable order
  (alphabetical by key, or hand-ordered-stable) to keep
  `useGlossary.ts` panel ordering deterministic post-migration.
  Count ≈ 113 (re-derive at execution time, not 102 per §D-3).
- **Create:** `data/metadata/rules-full.json` — JSON array of rule
  entries. Shape: `Array<{ key: string; label: string; summary: string }>`
  preserving the existing `RuleEntry` fields. Count ≈ 20 (re-derive
  at execution time, not 18 per §D-3).
- **Create:** `apps/registry-viewer/src/lib/glossaryClient.ts`
  mirroring `themeClient.ts` verbatim in structure:
  - Exports `KeywordGlossary = Map<string, string>` type alias (not
    `Record<string, string>` — lookup callers rely on `.has()` /
    `.get()` / iteration).
  - Exports `RuleGlossary = Map<string, RuleEntry>` type alias. (The
    `RuleEntry` type stays in `useRules.ts` and is re-imported here,
    OR is moved to `glossaryClient.ts` and re-exported from
    `useRules.ts` — session prompt locks one direction. Moving it to
    `glossaryClient.ts` is cleaner; re-importing from `useRules.ts`
    avoids churn.)
  - Exports `getKeywordGlossary(metadataBaseUrl: string):
    Promise<KeywordGlossary>`.
  - Exports `getRuleGlossary(metadataBaseUrl: string):
    Promise<RuleGlossary>`.
  - Exports `resetGlossaries(): void` for tests.
  - Uses `devLog("glossary", ...)` logging parallel to `themeClient.ts`
    ("glossary" category name must be added to EC-104's allowed-category
    set — verify during execution or amend EC-104 if strict).
- **Modify:** `apps/registry-viewer/src/composables/useRules.ts`:
  - **Remove** `export const KEYWORD_GLOSSARY = new Map([...])` and
    `export const RULES_GLOSSARY = new Map([...])` bodies.
  - **Keep** `export const HERO_CLASS_GLOSSARY = new Map([...])`
    verbatim (5 entries — NOT in external data per WP §D line 141,
    confirmed by session context line 50).
  - **Keep** `export interface RuleEntry` verbatim (unless moved per
    above).
  - **Keep** `export function parseAbilityText` verbatim.
  - **Keep** `export function lookupHeroClass` verbatim.
  - **Refactor** `lookupKeyword` to read the fetched `KeywordGlossary`
    from a module-scope holder populated by `App.vue` at mount (or
    via a getter that triggers fetch-if-empty). **LOCK: the enhanced
    matching algorithm (lines 319–361) must be preserved verbatim —
    only the Map source changes** (see §D-4).
  - **Refactor** `lookupRule` similarly, preserving the exact-then-
    slugified fallback (lines 369–381).
  - Both functions must return `null` (not throw, not return a
    sentinel) when the fetch has not yet resolved, matching the
    non-blocking guardrail and `CardDetail.vue`'s existing null-check
    tooltip path.
- **Modify:** `apps/registry-viewer/src/composables/useGlossary.ts`
  (added per §D-5 — **scope-expansion under the viewer analog of
  01.5**):
  - Convert `allEntries` from `const = buildAllEntries()` to a
    reactive `ref<GlossaryEntry[]>([])` or computed that rebuilds
    after the fetch resolves.
  - Preserve `openToKeyword` / `openToRule` / `scrollToEntry` /
    `toggle` / `open` / `close` behavior. If called before fetch
    resolves, `openToKeyword` / `openToRule` must no-op gracefully
    (their current `lookupKeyword` / `lookupRule` calls will return
    null pre-fetch; the early `return` at lines 154 and 174 already
    handles this — lock that behavior explicitly).
- **Modify:** `apps/registry-viewer/src/App.vue`:
  - In `onMounted`, add `getKeywordGlossary(metadataBaseUrl)` and
    `getRuleGlossary(metadataBaseUrl)` calls, wired parallel to the
    existing `getThemes(metadataBaseUrl)` call at lines 161–166
    (same try/catch + `console.warn` pattern).
  - On success, write the resolved Maps into the `useRules.ts`
    module-scope holders (via setter functions exported from
    `useRules.ts` or re-exported from `glossaryClient.ts`), then
    trigger `useGlossary`'s entry rebuild.
  - No other `App.vue` edits.
- **Modify:** `apps/registry-viewer/CLAUDE.md`:
  - Update the "Keyword & Rule Glossary" section (lines currently
    describing hardcoded data) to document the new R2 fetch flow +
    non-blocking fallback.
  - Update the "Architecture & Data Flow" block to add
    `getKeywordGlossary()` + `getRuleGlossary()` alongside
    `getThemes()`.
  - Update the "Key Files" table to add `src/lib/glossaryClient.ts`.
- **Add:** DECISIONS.md entries per WP §Governance (five decisions
  itemized at WP lines 195–202).
- **Update:** `WORK_INDEX.md` — flip WP-060 `[ ]` → `[x]` with
  2026-MM-DD date + Commit A hash on governance-close (Commit B).
- **Update:** `EC_INDEX.md` — add the EC-NNN retargeting row in the
  appropriate series (viewer 101+ or shared-tooling 060+), following
  the six-row precedent; mark status Done on governance-close.
- **Update:** `docs/03.1-DATA-SOURCES.md` — add `keywords-full.json`
  + `rules-full.json` under §Registry Metadata (addresses §Input
  Data Traceability Check).
- **Optional:** `apps/registry-viewer/HISTORY-modern-master-strike.md`
  — update if the predecessor history's current narrative is made
  inaccurate by the migration (WP §F line 154).

### WP-060 Is Explicitly Not Allowed To

- No modification of `packages/game-engine/` or `apps/server/` (WP
  §Packet-specific constraints line 100–102).
- No modification of `packages/registry/` (the card registry loaders
  are orthogonal; WP-060 does not route through them).
- No modification of any `CardDetail.vue`, `GlossaryPanel.vue`, or
  other component that only imports the lookup functions (per §D-6 —
  their contract surface is preserved).
- No modification of any file under `packages/preplan/`,
  `packages/vue-sfc-loader/`, `apps/arena-client/`,
  `apps/replay-producer/`, `apps/server/`.
- No new Zod schema for glossary data (WP §Scope (Out) line 160–162
  — display-only text, not validated contract).
- No new game engine keyword / rule constants (WP §Scope (Out) line
  164–165 — Phase 5 WPs define their own independently).
- No token markup transformation in the migrated JSON (WP §Key
  constraints line 105–107; WP §Scope (Out) line 168–169).
- No simplification of `lookupKeyword`'s suffix/substring/modifier
  matching (§D-4 LOCK).
- No conversion of `HERO_CLASS_GLOSSARY` to an external file (WP §D
  line 141; session context line 50).
- No `git add .` / `-A` / `-u` (inherited Phase 6 precedent P6-27 /
  P6-44).
- No `--no-verify` (commit-msg hook must pass).
- No `WP-060:` commit prefix (P6-36 / `.githooks/commit-msg` rejects
  it; use `EC-NNN:` for the code commit and `SPEC:` for the
  pre-flight + close commits).
- No push to remote (inherited; WP-056/057/058 all stayed local).
- No popping `stash@{0}`, `stash@{1}`, `stash@{2}`.
- No staging any of the 11 inherited dirty-tree items (session
  context §Inherited dirty-tree map).
- No modification of external filesystem (`C:\Users\jjensen\bbcode\...`).
- No direct network calls from test code — `glossaryClient.ts` tests
  (if authored) must mock `fetch`.

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked Before Execution)

- **New tests:** **OPTIONAL.** WP spec explicitly acceptance-tests
  via build + manual tooltip display (WP §Acceptance Criteria lines
  216–217; §Verification Steps lines 228–258). No unit tests are
  required by the WP. If the executor elects to add tests for
  `glossaryClient.ts` (following the `themeClient.ts` pattern), the
  WP amendments must authorize a specific test file path and count
  — do not add tests mid-execution without pre-flight authorization.
  **Pre-flight recommendation:** add 2–3 tests only if
  `glossaryClient.ts` contains any non-trivial error handling beyond
  the `themeClient.ts` copy-paste; otherwise skip.
- **Existing test changes:** **NONE expected.** Baselines must hold
  at **588 / 0** repo-wide. Per WP-060's file list, no existing test
  file is touched.
- **Prior test baseline:** 588 passing / 0 failing / 0 skipped
  (session context §Test baselines). Re-confirm at session start
  Step 3 (`pnpm -r --if-present test`).
- **Test boundaries:**
  - No `boardgame.io/testing` imports (universal).
  - No modifications to `makeMockCtx` or arena-client / engine test
    helpers (scope violation).
  - No vue-sfc-loader tests (the WP does not touch `.vue` files in
    `node:test`; `glossaryClient.ts` is plain TS).
  - Test files use `.test.ts` (never `.test.mjs`) — universal.
  - One `describe()` block per new test file if tests are authored
    (WP-031 / WP-057 precedent).
- **Defensive guards:** `lookupKeyword` / `lookupRule` must handle
  the pre-fetch state by returning `null` — this is a defensive
  guard on the same footing as WP-022's `heroAbilityHooks` undefined
  guard (session context implicit). The `useGlossary.ts` rebuild
  must handle the empty-initial-state render without erroring.

**Rule:** If the implementation discovers more or fewer tests are
needed, or that existing tests require changes, it is a deviation
that must be documented in the execution summary and justified in
the pre-commit review.

---

## Mutation Boundary Confirmation

**N/A — WP Class is Runtime Wiring (viewer), not Behavior / State
Mutation.** No `G` mutations occur anywhere in WP-060. The sole
"mutations" are:

1. Writing to the new `glossaryClient.ts`'s module-scope `_promise`
   variable (identical pattern to `themeClient.ts:51`).
2. Writing to `useRules.ts` module-scope glossary holders (new,
   introduced by WP-060 — populated by `App.vue` at mount).
3. Writing to `useGlossary.ts` reactive `ref` (new per §D-5).

All three are module-scoped state inside the viewer SPA — standard
Vue composable patterns. No engine authorization boundary is crossed.

---

## Risk & Ambiguity Review (Resolve Now, Lock for Execution)

### R-1 — **`useGlossary.ts` wiring edit is outside WP allowlist** (HIGH → resolved via scope expansion)

- **Risk:** WP §Files Expected to Change does not list
  `useGlossary.ts` (see §D-5). A strict-scope executor would stop at
  the compile error.
- **Impact:** HIGH — build fails; acceptance unsatisfiable; WP
  execution blocks unless allowlist is expanded.
- **Mitigation:** amend WP-060 §Files Expected to Change to add
  `apps/registry-viewer/src/composables/useGlossary.ts — modified —
  rebuild entry list after async glossary fetch resolves`. The
  session prompt cites the **viewer analog of
  `01.5-runtime-wiring-allowance.md`** — minimal, strictly
  dependency-driven (direct consequence of removing the two Map
  exports from `useRules.ts`), no new behavior (UI continues to
  render the same entry list from the same three sources; only the
  timing of derivation changes from module-eval to post-fetch). No
  new helpers, no new test cases in existing files, no logic
  branching changes.
- **Decision / pattern:** follow WP-029 precedent (filter input type
  missing required data — upstream producer added to scope under
  wiring allowance) + WP-055 theme data-migration precedent for the
  viewer-local timing shift.

### R-2 — **`lookupKeyword` enhanced matching regression** (MEDIUM → resolved via LOCK)

- **Risk:** naïve rewrite to `Map.get(lower)` silently regresses
  ~20 modifier keywords (all "ultimateabomination",
  "doublestriker", "doublelaststand", etc. variants) plus all
  parameterized forms ("Focus 2", "Patrol the Bank").
- **Impact:** MEDIUM — silent UX regression, not a build failure;
  caught only by manual tooltip testing.
- **Mitigation:** §D-4 LOCK — `lookupKeyword` / `lookupRule` bodies
  must be refactored to change only the Map source, not the
  algorithm. The session prompt pastes the algorithm verbatim as a
  locked value.

### R-3 — **Baseline-source conflict between WP and session context** (HIGH → resolved via WP amendment)

- **Risk:** §D-1. Executor reading only the WP copies the upstream
  external JSON (102 keywords, 18 rules) and loses the ~30 modifier
  keywords added in prior viewer work.
- **Impact:** HIGH — data regression; `CardDetail.vue` tooltips for
  all modifier keywords go empty.
- **Mitigation:** WP-060 §Session Context + §Goal + §Scope (In) §A
  + §Acceptance Criteria + §Verification Steps must be amended to
  name the hardcoded maps in `useRules.ts` as the canonical
  baseline. The amendment is the three-commit-topology Commit A0
  (SPEC) — done before the execution session starts.

### R-4 — **Acceptance criteria count mismatch** (MEDIUM → resolved via WP amendment)

- **Risk:** §D-3. WP requires "102 keywords" and "18 rules"; real
  counts are ~113 and 20. Verification Step 1 fails.
- **Impact:** MEDIUM — blocks acceptance even if execution is
  correct.
- **Mitigation:** amend WP §Acceptance Criteria and §Verification
  Steps to match re-derived counts. Fold into the same pre-flight
  Commit A0 bundle as R-3.

### R-5 — **EC-060 slot consumed** (HIGH → resolved via EC retargeting)

- **Risk:** §D-2. `EC-060-keyword-glossary.checklist.md` exists but
  belongs to commit `6a63b1c` (an earlier executed scope). A new EC
  must be authored at the next free slot per the six-row
  retargeting precedent.
- **Impact:** HIGH — without an EC, no `EC-NNN:` commit prefix
  passes the commit-msg hook, blocking the entire three-commit
  topology.
- **Mitigation:** human picks the slot (recommended: **EC-106**,
  registry-viewer series) → author
  `EC-106-keyword-rule-glossary-data.checklist.md` following the
  EC-TEMPLATE → add the retargeting row to `EC_INDEX.md` §Registry
  Viewer (EC-101+ Series) or §Shared Tooling (EC-060+ Series) per
  chosen slot, citing the "EC-061 → EC-067 ... EC-064 → EC-074 ...
  EC-060 → EC-NNN" precedent chain → fold into Commit A0.

### R-6 — **R2 upload authentication gap** (MEDIUM → resolved via lock)

- **Risk:** §D-8. Upload requires R2 credentials not in the repo.
- **Impact:** MEDIUM — session stalls if credentials unavailable.
- **Mitigation:** session prompt must include an explicit
  "STOP and escalate if R2 authentication fails; do NOT silently
  skip the upload" guardrail.

### R-7 — **EC-104 debug-surface `devLog` category** (LOW)

- **Risk:** `glossaryClient.ts` will use `devLog("glossary", ...)`.
  EC-104 defines the allowed-category set; "glossary" may not be
  pre-approved.
- **Impact:** LOW — either a no-op (category allowed by default) or
  a one-line addition to the EC-104 allowed-category list.
- **Mitigation:** verify during execution; if the category set is
  strict, add "glossary" as an amendment. Not a pre-flight blocker.

### R-8 — **`villainousweapons` duplicate entry** (LOW)

- **Risk:** `useGlossary.ts:47–49` has a `// why:` comment noting
  `villainousweapons` appears twice in the current Maps. Migrating
  to an external JSON without preserving this dedup logic will cause
  one extra glossary panel entry.
- **Impact:** LOW — cosmetic panel duplicate.
- **Mitigation:** (a) the migrated `keywords-full.json` should
  contain `villainousweapons` once; the RULES_GLOSSARY migration
  preserves the second occurrence in `rules-full.json` under a
  distinct key — OR (b) preserve the dedup logic in
  `useGlossary.ts`'s new reactive build. Lock either approach in the
  session prompt.

### R-9 — **03.1-DATA-SOURCES.md update** (LOW)

- **Risk:** §Input Data Traceability Check NO.
- **Impact:** LOW — documentation drift, not runtime risk.
- **Mitigation:** add two entries under §Registry Metadata to the
  WP §Governance list. Fold into Commit A (code commit) rather than
  Commit A0 (pre-flight) — it's a subordinate edit to the data
  files it documents.

### R-10 — **`HISTORY-modern-master-strike.md` accuracy** (LOW)

- **Risk:** WP §F line 154 mentions this file may need updates.
  The current history may reference the hardcoded glossary as
  authoritative in a way that migration makes inaccurate.
- **Impact:** LOW — documentation drift.
- **Mitigation:** read the file during execution; if the narrative
  is made inaccurate, include a brief update in Commit A. Otherwise
  omit.

### R-11 — **Fresh branch recommendation** (INFORMATIONAL)

- Session context line 84 recommends cutting a
  `wp-060-keyword-rule-glossary` branch off
  `wp-081-registry-build-pipeline-cleanup`. Topically disjoint;
  strongly advised for clean PR history.
- Impact: process cleanliness only; no correctness impact.

---

## Pre-Flight Verdict (Binary)

**DO NOT EXECUTE YET.**

Justification:

WP-060 is structurally sound and the layer-boundary / dependency /
determinism story is clean, but **five blocking gates must clear
before a session execution prompt may be generated.** (1) WP-060 §A
+ §Goal + §Acceptance name the wrong input baseline (external
`modern-master-strike` JSONs instead of the hardcoded
`useRules.ts` Maps — D-1 / R-3); (2) WP-060 §Acceptance count
literals (102 / 18) disagree with the real baseline (~113 / 20 —
D-3 / R-4); (3) the `EC-060` slot is already consumed by the
earlier commit `6a63b1c` and a new EC must be retargeted per the
six-row precedent (D-2 / R-5); (4) `useGlossary.ts` imports the
very Maps WP-060 removes, so its absence from §Files Expected to
Change will break the build — scope must expand under the viewer
analog of 01.5 (D-5 / R-1); (5) `lookupKeyword`'s enhanced
suffix/substring/modifier matching (40 lines at `useRules.ts:319–361`)
must be locked as-is during the Map-source refactor or ~20 modifier
keywords silently regress (D-4 / R-2). All five are resolvable
through a single pre-flight bundle (Commit A0 SPEC) authoring the
WP amendments + new EC file + EC_INDEX retargeting row + session
prompt + this pre-flight + copilot check (per `01.7` — required
for Runtime Wiring WPs). Sequencing and dirty-tree discipline are
otherwise clean and inherit cleanly from the WP-056/057/058
post-Phase-6 precedents.

**Conditional READINESS on completion of the five pre-session
actions below.** Once the bundle lands at Commit A0, no pre-flight
re-run is required — the actions resolve pre-flight-identified
risks without changing scope.

---

## Invocation Prompt Conformance Check (Pre-Generation)

Not yet applicable — verdict is DO NOT EXECUTE YET. This section
runs only after the five pre-session actions land. Run it against
the draft session prompt at that point, using the checklist in
`01.4 §Invocation Prompt Conformance Check` verbatim.

Pre-emptive notes for whoever drafts the session prompt:

- The new EC's Locked Values table must copy verbatim into the
  prompt: file paths, function signatures, the preserved
  `lookupKeyword` algorithm body, the `KeywordGlossary` /
  `RuleGlossary` type aliases, the three-commit topology, the R2
  upload ordering, the non-blocking fetch guardrail, and the
  "never `WP-060:` prefix" rule.
- No new file paths, helper names, constant strings, or behavioral
  rules may appear only in the prompt — all must originate in the
  amended WP or the new EC.
- `lookupKeyword` / `lookupRule` signatures stay identical to
  `useRules.ts:319` / `:369` — prompt must not widen, narrow, or
  change return types.
- R2 URL format is `{metadataBaseUrl}/metadata/{filename}` — mirror
  the theme URL shape at `themeClient.ts:63`.

---

## Authorized Next Step

**The verdict is DO NOT EXECUTE YET.** A session prompt MUST NOT be
generated until the following five pre-session actions land as a
single `SPEC:` pre-flight bundle commit (A0 in the three-commit
topology):

1. **Amend `docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md`:**
   - §Session Context and §A: name `useRules.ts` hardcoded maps as
     the canonical baseline (resolves D-1 / R-3).
   - §Goal: "≈113 keywords, 20 rules" language replaces "102
     keywords ... 18 rules" (resolves D-3 / R-4 language).
   - §Acceptance Criteria lines 210–211: replace "102 keyword
     entries" / "18 rule entries" with the re-derived counts
     (resolves D-3 / R-4).
   - §Verification Steps lines 230–234: update the expected
     `.length` values (resolves D-3 / R-4).
   - §Files Expected to Change: add
     `apps/registry-viewer/src/composables/useGlossary.ts — modified
     — rebuild entry list after async glossary fetch resolves`
     (resolves D-5 / R-1).
   - §Governance: add an entry directing an update to
     `docs/03.1-DATA-SOURCES.md` §Registry Metadata (resolves R-9).

2. **Author new EC at the retargeted slot:**
   - Recommended slot: **EC-106** (viewer 101+ series). Final
     choice is a human decision.
   - File: `docs/ai/execution-checklists/EC-NNN-keyword-rule-glossary-data.checklist.md`
     (name reflects chosen slot).
   - Follow `EC-TEMPLATE.md` structure.
   - Locked Values must include: the `glossaryClient.ts` public
     API; the preserved `lookupKeyword` algorithm; the
     `useGlossary.ts` reactive-ref rebuild; the R2 upload
     non-reversibility guardrail; the three-commit topology; the
     commit-prefix rule (`EC-NNN:` not `WP-060:`); the
     exact-filename staging rule; the "do NOT stage the 11
     inherited dirty-tree items" rule; the "do NOT pop the three
     quarantined stashes" rule (resolves D-2 / R-5).

3. **Update `docs/ai/execution-checklists/EC_INDEX.md`:**
   - Add a row in §Registry Viewer (EC-101+ Series) or §Shared
     Tooling (EC-060+ Series) per chosen slot.
   - Include the retargeting `**Note:**` citing the six-row
     precedent chain (EC-061 → EC-067 ... EC-064 → EC-074 ...
     EC-060 → EC-NNN).
   - Status: `Draft` until execution.

4. **(Optional but recommended) Run `01.7 copilot check`** on the
   bundle per `01.4 §Step 1b`. Mandatory for Runtime Wiring class.
   Expected disposition: `CONFIRM` if amendments above land
   correctly.

5. **Generate session execution prompt** as
   `docs/ai/invocations/session-wp060-keyword-rule-glossary-data.md`
   after actions 1–4 land. Prompt must conform exactly to the
   amended WP, the new EC, and this pre-flight — no new scope, no
   reinterpreted ambiguities, no helper names introduced only in
   the prompt.

```
**Pre-session actions — status (2026-04-20):**

1. WP-060 amendment (baseline + counts + useGlossary scope + 03.1
   governance) — **RESOLVED** (same-day edit in-place):
   - §Status + §Last Updated: bumped to 2026-04-20 with reference to
     this pre-flight.
   - §Session Context: reframed — hardcoded Maps in `useRules.ts`
     named as the canonical baseline (113 keywords, 20 rules, 5 hero
     classes).
   - §Goal + After-completion bullets: counts 113 / 20; enumerated
     `useGlossary.ts` rebuild; `03.1-DATA-SOURCES.md` update; explicit
     note that counts must be re-derived at execution time.
   - §Assumes: reframed from external-source baseline to hardcoded-Map
     baseline; added R2-credentials precondition and 588 / 0 baseline
     citation.
   - §Session protocol: STOP+ask on count drift; STOP+escalate on R2
     auth failure.
   - §Scope (In) §A: serialize Maps to JSON (alphabetical by `key`);
     token markup preserved verbatim.
   - §Scope (In) §D: `lookupKeyword` / `lookupRule` algorithmic
     preservation LOCK.
   - §Scope (In) §F: `useGlossary.ts` reactive rebuild (new section
     F); §G for documentation (renumbered from old F).
   - §Files Expected to Change: added `useGlossary.ts` + `03.1-DATA-SOURCES.md`.
   - §Governance: seven DECISIONS entries (added baseline,
     `useGlossary.ts` scope-expansion rationale, and `lookupKeyword`
     preservation).
   - §Acceptance Criteria: counts 113 / 20; modifier keyword smoke
     test; `useGlossary.ts` rebuild check; baseline 588 / 0 preserved;
     `03.1-DATA-SOURCES.md` update.
   - §Verification Steps: 8-step sequence with re-derived counts,
     algorithm preservation grep, modifier-keyword manual smoke.
   - §Definition of Done: three-commit topology explicit; EC-106
     → Done; prefix rule.
2. New EC authored at retargeted slot — **RESOLVED**. File:
   `docs/ai/execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md`.
   Status: `Draft` (flips to `Done` in Commit B per EC_INDEX §Rules).
   Structured per EC-105 template: Execution Authority, Execution
   Style, Before Starting (7 preconditions), Locked Values (JSON
   shapes + glossaryClient API + lookup preservation + useGlossary
   rebuild + App.vue wiring + commit prefix + three-commit topology
   + 01.6 NOT TRIGGERED disposition), Guardrails, Required Comments,
   Files to Produce, Out of Scope, Verification Steps (12 command
   steps + DEV + PROD smoke), After Completing, Common Failure Smells.
3. EC_INDEX.md row added — **RESOLVED**. Row appended to §Registry
   Viewer (EC-101+ Series) after EC-105 Deferred row. Retargeting
   note cites the seven-row precedent chain (EC-061 → EC-067,
   EC-066 → EC-068, EC-062 → EC-069, EC-063 → EC-071, EC-080 →
   EC-072, EC-079 → EC-073, EC-064 → EC-074). Status: `Draft`.
   §EC_INDEX Last-updated footer NOT rewritten (convention: the
   Last-updated narrative is a close-footer written on Commit B
   governance close, not on the pre-flight bundle — prior
   precedents in the series follow this pattern).
4. 01.7 copilot check — **NOT RUN** this session. Optional per
   `01.4 §Step 1b` for viewer-layer WPs; strongly recommended
   before generating the session prompt. Invoke separately if
   desired.
5. Session execution prompt — **NOT DRAFTED** this session. Author
   separately as
   `docs/ai/invocations/session-wp060-keyword-rule-glossary-data.md`.
   All scope and locks needed to draft the prompt are now in
   WP-060 (amended) + EC-106 (authored) + this pre-flight.

**Verdict transition:** Actions 1–3 resolve the five blocking gates
(D-1 via §Session Context + §A + §Goal + §Acceptance + §Verification
amendments; D-2 via EC-106 authorship + EC_INDEX row; D-3 via
§Acceptance + §Verification count amendments; D-4 via WP §D LOCK +
EC §Locked Values preservation rule; D-5 via WP §Files Expected +
§F scope expansion + EC §Files to Produce). Pre-flight verdict
transitions from **DO NOT EXECUTE YET** → **READY TO EXECUTE**
conditional on (a) running 01.7 copilot check (optional) and (b)
drafting the session prompt. No re-run of pre-flight required — the
resolutions are scope-neutral relative to what was locked above.
```

If any action cannot be completed as specified (e.g., the human
cannot author a new EC, or R2 credentials are unavailable),
**STOP and escalate** rather than force-fitting the change. This
pre-flight clause **must be invoked in the session prompt**; it
may not be cited retroactively in execution summaries or
pre-commit reviews to justify undeclared changes.

---

## Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

Five blocking gates remain (D-1, D-2, D-3, D-4 + LOCK, D-5). Without
resolution, a WP-060 execution session would either (a) migrate the
wrong data (external JSONs instead of hardcoded Maps), (b) fail
acceptance on count literals, (c) fail the commit-msg hook for lack
of a valid EC, (d) silently regress ~20 modifier keyword tooltips,
or (e) fail to compile because `useGlossary.ts` imports the removed
Maps.

**DO NOT PROCEED TO EXECUTION** until the five-action bundle lands.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM (2026-04-20)

Per [01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md)
§When Copilot Check Is Required. WP-060 is **Runtime Wiring** (viewer-
layer variant), for which 01.7 is *mandatory*.

**Inputs reviewed (union):**
- EC-106: [docs/ai/execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md](../execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md)
- WP-060: [docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md](../work-packets/WP-060-keyword-rule-glossary-data.md) (amended 2026-04-20)
- Pre-flight: this file, §Authority Chain through §Authorized Next Step

### Overall Judgment

**PASS — 30/30 issues PASS. Disposition: CONFIRM.**

Pre-flight verdict READY TO EXECUTE (conditional on pre-session actions
1–3, all now resolved in-bundle) stands. Zero `RISK` findings. Zero
architectural or determinism damage would occur if the session prompt
is generated and execution proceeds. The amendments landed in WP-060
§Scope (In) §D (algorithm-preservation LOCK), §F (`useGlossary.ts`
scope expansion), §Governance (seven DECISIONS), plus EC-106's
byte-for-byte preservation lock in §Locked Values collectively convert
every on-the-lens failure mode into a checklist-verifiable gate.

### Findings (One Line Per Issue; Category Groupings per 01.7)

**Separation of Concerns & Boundaries**

1.  PASS (#1 Engine/UI Boundary Drift) — EC-106 §Guardrails forbids
    `packages/game-engine/`, `packages/preplan/`, `apps/server/`, `pg`,
    `boardgame.io` imports; §Verification Step 8 grep enforces it;
    §Out of Scope explicit.
2.  PASS (#9 UI Re-implements Engine Logic) — viewer reads no engine
    state; glossary data is pure display content; registry-viewer
    already layer-isolated per its own `CLAUDE.md`.
3.  PASS (#16 Lifecycle Wiring Creep) — WP-060 §Scope (Out) + EC-106
    §Out of Scope forbid any engine/server/arena-client touch; Vue
    `onMounted` is the single locked lifecycle hook; EC §Locked Values
    freezes the exact wiring block.
4.  PASS (#29 Assumptions Leaking Across Layers) — engine does not
    know glossary exists; viewer does not read `G`; `RuleEntry` type
    stays viewer-local.

**Determinism & Reproducibility**

5.  PASS (#2 Non-Determinism by Convenience) — no RNG, no clocks, no
    time-of-day dependence; `Math.random` / `Date.now` absent from
    WP-060 surface.
6.  PASS (#8 No Single Debugging Truth Artifact) — N/A to viewer
    data-migration; replay-debugging scope untouched.
7.  PASS (#23 Lack of Deterministic Ordering Guarantees) — EC-106
    §Locked Values requires alphabetical-by-`key` ordering on both
    JSON files; §Verification Step 7 asserts via JSON equality against
    sorted reference.

**Immutability & Mutation Discipline**

8.  PASS (#3 Pure Functions vs Immer Mutation) — no Immer, no `G`, no
    moves; `glossaryClient.ts` is a pure async fetcher; `useGlossary.ts`
    uses Vue's `ref` assignment (not in-place mutation).
9.  PASS (#17 Hidden Mutation via Aliasing) — `buildAllEntries`
    constructs fresh `GlossaryEntry` objects each call; `allEntries.value`
    is *reassigned* not mutated; returned Maps from `glossaryClient.ts`
    are consumer-owned and never shared mutably. WP-028 / D-2802
    precedent applies by analogy, not by literal requirement.

**Type Safety & Contract Integrity**

10. PASS (#4 Contract Drift) — EC-106 §Locked Values pins
    `KeywordGlossary`/`RuleGlossary` type aliases, JSON entry shapes,
    function signatures verbatim; §Verification Steps 6, 9, 10 grep-gate
    the locks.
11. PASS (#5 Optional Field Ambiguity) — pre-flight §D-10 confirmed
    registry-viewer tsconfig does NOT enable
    `exactOptionalPropertyTypes`; N/A.
12. PASS (#6 Undefined Merge Semantics) — no merge; `setGlossaries`
    *replaces* module-scope holders wholesale; no ambiguity.
13. PASS (#10 Stringly-Typed Outcomes) — return types are
    `string | null` / `RuleEntry | null`, not enum-of-strings; token
    parsing produces discriminated `TokenType` union (preserved).
14. PASS (#21 Type Widening at Boundaries) — `metadataBaseUrl: string`
    is the only primitive at the boundary; `Map<string, string>` is
    narrow enough for display-only data; no `any` introduced. The
    intentional absence of Zod runtime validation is consistent with
    the `themeClient.ts` precedent and explicitly locked in WP §Scope
    (Out).
15. PASS (#27 Weak Canonical Naming) — every name (`keywords-full.json`,
    `KEYWORD_GLOSSARY`, `glossaryClient.ts`, `RuleEntry`,
    `parseAbilityText`) matches existing conventions; preservation
    rule forbids renames.

**Persistence & Serialization**

16. PASS (#7 Persisting Runtime State by Accident) — glossary data is
    static R2-hosted content, not runtime state; no `G`, no snapshot.
17. PASS (#19 Weak JSON-Serializability Guarantees) — the artifacts
    ARE JSON; no functions, Maps, or class instances written to disk.
    The in-memory `Map` is constructed from the JSON array at fetch
    time and lives only in memory.
18. PASS (#24 Mixed Persistence Concerns) — classification under
    §Registry Metadata in `03.1-DATA-SOURCES.md` update is explicit and
    mirrors `sets.json` / `card-types.json` row shape.

**Testing & Invariant Enforcement**

19. PASS (#11 Tests Validate Behavior, Not Invariants) — the dominant
    invariant ("lookupKeyword algorithm preserved byte-for-byte") is
    checked three ways: (a) EC-106 §Locked Values byte-for-byte lock,
    (b) §Verification Step 10 grep for branch-comment markers, (c)
    manual smoke 13c covering modifier keywords. Unit test addition
    is optional (consistent with WP-055's precedent for preservation-
    only refactors without new contracts).

**Scope & Execution Governance**

20. PASS (#12 Scope Creep During "Small" Packets) — EC-106 §Files to
    Produce: 11 exact items; §Out of Scope enumerates 10 prohibitions;
    §Verification Step 12 runs `git diff --name-only`.
21. PASS (#13 Unclassified Directories) — zero new directories; all
    new files land in pre-classified parents (`data/metadata/`,
    `apps/registry-viewer/src/lib/`).
22. PASS (#30 Missing Pre-Session Governance Fixes) — pre-flight
    enumerated five pre-session actions; three resolved as the A0
    bundle (this file, WP-060 amendments, EC-106, EC_INDEX row); the
    remaining two (01.7 copilot check = this section; session prompt
    = next action) are the current session's work. Resolution log
    explicit.

**Extensibility & Future-Proofing**

23. PASS (#14 No Extension Seams) — new keywords/rules are just new
    JSON rows; `lookupKeyword`'s parameterized-form matching already
    handles unknown-at-authoring-time compound tokens (e.g.,
    "Elusive 6", "Patrol the Bank") via prefix/suffix/substring
    heuristics.
24. PASS (#28 No Upgrade/Deprecation Story) — the migration is a
    *lift*, not a shape change; the JSON schema matches the existing
    hardcoded shape 1:1. No version wrapper added — consistent with
    the bare-array convention used by every other
    `data/metadata/*.json` file. Future breaking changes can introduce
    a wrapper via a D-entry without touching WP-060.

**Documentation & Intent Clarity**

25. PASS (#15 Missing "Why" for Invariants) — EC-106 §Required
    Comments enumerates five mandatory `// why:` placements plus
    verbatim preservation of every existing `// why:` in
    `lookupKeyword` / `lookupRule`.
26. PASS (#20 Ambiguous Authority Chain) — EC-106 §Execution Authority
    explicit ("if EC-106 and WP-060 conflict on design intent, the
    WP wins; on execution contract, the EC wins"); pre-flight §Authority
    Chain ordered.
27. PASS (#26 Implicit Content Semantics) — token markup preservation,
    non-blocking fetch semantics, `null`-before-fetch semantics, and
    three-commit topology all locked in prose.

**Error Handling & Failure Semantics**

28. PASS (#18 Outcome Evaluation Timing Ambiguity) — N/A for game
    outcomes. Glossary-load timing locked in EC §Locked Values
    (App.vue onMounted wiring): parallel fetches → `setGlossaries` +
    `rebuildGlossaryEntries` on success.
29. PASS (#22 Silent vs Loud Failure Decisions) — explicit three-layer
    policy: (a) runtime fetch failure → `console.warn` + continue
    (matches `themeClient.ts` precedent); (b) missing R2 credentials
    at authoring-time → STOP + escalate; (c) preservation-lock
    violation at code-author-time → static grep gate fails verification.

**Single Responsibility & Logic Clarity**

30. PASS (#25 Overloaded Function Responsibilities) — every new
    function does one thing: `getKeywordGlossary` fetches + caches;
    `setGlossaries` writes holders; `rebuildGlossaryEntries` rebuilds
    entries list; `lookupKeyword` / `lookupRule` preserved verbatim
    (their responsibilities are narrow and locked).

### Mandatory Governance Follow-ups

None. All governance entries (seven DECISIONS items, `03.1-DATA-SOURCES.md`
update, `EC_INDEX.md` row, `WORK_INDEX.md` flip) are already enumerated
in the WP-060 §Governance block and EC-106 §Files to Produce. No
additional governance is required to reach `CONFIRM`.

### Pre-Flight Verdict Disposition

- [x] **CONFIRM** — Pre-flight READY TO EXECUTE verdict stands.
      Session prompt generation authorized.
- [ ] HOLD (not triggered — zero FIXes needed)
- [ ] SUSPEND (not triggered — zero BLOCKs)

**Authorization:** proceed to generate the session execution prompt as
`docs/ai/invocations/session-wp060-keyword-rule-glossary-data.md`.
The prompt must conform exactly to the scope, constraints, and locks
established in WP-060 (amended), EC-106, and this pre-flight (inclusive
of the copilot-check row above). No new scope may be introduced; no
reinterpretation of the 30 PASS verdicts.
