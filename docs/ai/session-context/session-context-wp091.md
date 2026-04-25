# Session Context — WP-091 (Loadout Builder in Registry Viewer)

> **Authored:** 2026-04-24 post-WP-093 execution. **Purpose:** give the
> WP-091 executor a concise, current baseline so they don't re-derive:
> the main SHA, the WP-093 byte-for-byte locked strings (all four
> categories WP-091 consumes verbatim), the post-WP-093 test baseline,
> the parallel-drift precedent captured in WP-093's post-mortem, and
> the layer-boundary constraints that keep `packages/registry/**` and
> `apps/registry-viewer/**` engine-free.
>
> **This file is NOT a design-rationale bridge.** WP-091 is fully
> authored; its design intent lives in WP-091 itself. What follows is
> operational handoff only.
>
> **This file is NOT authoritative.** See §6 for the authority chain.

---

## 1. State as of authoring

**Branch:** `main` at `90a5026` (post-WP-093 governance close).

- WP-093 — Match-Setup Rule-Mode Envelope Field (Governance) — **executed
  and merged 2026-04-24**. Commit chain:
  - `d7241e8` — `EC-093: lock heroSelectionMode envelope field governance (v1)` — content: 7 §6.1 REFERENCE/rules/DECISIONS/STATUS files + §6.3 01.6 post-mortem. +899 lines, all additive. Vision trailer `Vision: §3, §10a, §22, NG-1..7`.
  - `90a5026` — `SPEC: WP-093 / EC-093 governance close — flip status to Done 2026-04-24` — WORK_INDEX.md + EC_INDEX.md status flips.
- **WP-091 is now unblocked.** Its one governance dependency (WP-093)
  is on `main`; the byte-for-byte consumer strings are canonicalized
  and ready to quote verbatim.
- WP-092 (Lobby Loadout Intake) is still waiting — it depends on both
  WP-091 and WP-093. WP-093 is done; WP-091 is next in sequence.

**Repo-wide test baseline (post-WP-093, unchanged because WP-093 is
governance-only):**

| Package | tests / suites / fail |
|---|---|
| `packages/game-engine` | 513 / 115 / 0 |
| `packages/registry` | 13 / 2 / 0 |
| `packages/vue-sfc-loader` | 11 / 0 / 0 |
| `packages/preplan` | 52 / 7 / 0 |
| `apps/server` | 19 / 3 / 0 |
| `apps/arena-client` | 66 / 0 / 0 |
| `apps/replay-producer` | 4 / 2 / 0 |
| **Repo-wide total** | **678 / 129 / 0** |

WP-091 is a registry-contract + registry-viewer packet. It adds a new
zod schema module under `packages/registry/src/setupContract/` and a
new "Loadout" tab in `apps/registry-viewer`. Expected test deltas land
in `packages/registry` (new `setupContract` tests — count locked by
WP-091 §Scope E). `apps/registry-viewer` has no Vue component-test
harness today, so view-level behavior is verified by manual smoke +
`pnpm --filter registry-viewer build` / `typecheck`. The engine /
preplan / server / arena-client / replay-producer baselines must stay
unchanged — WP-091 touches none of them.

**Next free D-ID for WP-091:** likely **`D-9101`** (WP-NNN → D-NN01+
mapping). Grep DECISIONS.md for `^### D-91` at session start to
confirm. D-9301 (WP-093) and D-9401 (WP-094) are on `main`; D-9101
should be free.

---

## 2. WP-091 Governance Status — READY (all prerequisites met)

WP-091's governance rows are already on `main` (registered during the
A0 pre-flight session at `6770fa6`):

- [WP-091-loadout-builder-registry-viewer.md](../work-packets/WP-091-loadout-builder-registry-viewer.md)
  — full design, 1122 lines
- [EC-091-loadout-builder-registry-viewer.checklist.md](../execution-checklists/EC-091-loadout-builder-registry-viewer.checklist.md)
  — execution checklist, 138 lines
- `WORK_INDEX.md` contains `- [ ] WP-091 — Loadout Builder in Registry
  Viewer ⬜ Draft …` row
- `EC_INDEX.md` contains `EC-091 | WP-091 | Registry / Contracts +
  Client UI | … | Draft |` row

**Pre-flight / session-prompt / copilot check: NOT YET AUTHORED.**
Follow the 01.4 / 01.7 / 01.2 workflow the same way WP-093 did. The
WP-091 design is large (setupContract zod schema + three composables +
one Vue view + tab integration + new tests); a careful pre-flight
pass is cheap and catches exactly the kind of drift the WP-095
parallel session discovered in WP-093's final hours.

---

## 3. Byte-for-Byte Locked Strings from WP-093 (Quotable Verbatim)

**This is the single most important handoff section.** WP-091's
registry-side validator and rule-mode indicator must consume these
strings byte-for-byte. WP-091's tests assert **exact-string equality**
(not substring, not regex, not `.includes()`). Any whitespace change,
smart-quote substitution, em-dash drift, or trailing-space variation
introduced during WP-091 execution will cause the tests to fail when
WP-091 executes — and, more importantly, will cascade through WP-092
(whose shape guard consumes the same strings).

**Source of truth:** `DECISIONS.md` D-9301 and
`docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md §Field Semantics / Hero
Selection Mode`. If a string below disagrees with either of those,
**the source files win** — this session-context is a convenience
quote, not the authority.

### 3.1 Envelope field contract

- **Field name:** `heroSelectionMode`
- **Type:** string (enum)
- **Allowed values in v1:** `["GROUP_STANDARD"]` — exactly one member
- **Required in JSON Schema:** **false** (optional; NOT in root `required`)
- **Default when absent:** `"GROUP_STANDARD"`
- **Position in envelope:** after `expansions`, before `composition`
- **Reserved future token (prose only, NOT in v1 allowed enum):** `"HERO_DRAFT"`
- **`schemaVersion`:** stays at `"1.0"`

### 3.2 Error contract (WP-091 validator + WP-092 shape guard consumers)

- **Error code:** `"unsupported_hero_selection_mode"`
- **Error message template (normative, verbatim; `<value>` is the only
  permitted substitution):**

  `The loadout envelope's heroSelectionMode is <value>, which is not a supported rule mode in v1 of the match setup schema. Supported modes: GROUP_STANDARD. (HERO_DRAFT is reserved for a future release and is not yet implemented.)`

### 3.3 Human-readable label mapping (WP-091 rule-mode indicator consumes these)

- `"GROUP_STANDARD"`
  - machine name: `"GROUP_STANDARD"`
  - short UI label: `"Classic Legendary hero groups"`
  - long explanation: `"The engine expands each selected hero group into its canonical card set at match start."`
- `"HERO_DRAFT"` (reserved-future; prose only)
  - machine name: `"HERO_DRAFT"`
  - short UI label: `"Hero Draft"`
  - long explanation: `"Player-curated hero card selection — individual hero cards chosen by rarity or constraint rather than pre-defined groups. Reserved for a future release."`
  - future-notice UX copy: `"Hero Draft rules are planned for a future update."`

### 3.4 Flavor / lore framing — NEVER in machine-readable surfaces

`"Contest of Champions"` is the in-universe flavor label for
`"HERO_DRAFT"` matches. It is **narrative UI copy only** and must
never appear in:

- enums (anywhere)
- error messages
- JSON property names or values
- schema validation constraints
- lookup keys
- branch conditions
- analytics dimensions / telemetry fields
- log tokens

In v1 WP-091 surfaces this label **zero times** because `"HERO_DRAFT"`
is not selectable. If a future WP enables Hero Draft gameplay and
adds the flavor string to UI copy, WP-093's four-point
naming-governance policy (D-9301) requires amending WP-093 first.

### 3.5 Rendering pattern for the rule-mode indicator (WP-091 §Scope C)

The intended render format in WP-091's rule-mode indicator, composing
the machine name and short UI label:

`"Hero selection rule: GROUP_STANDARD — Classic Legendary hero groups"`

WP-091 may compose the three strings (machine name + short UI label +
long explanation) for tooltip / help-copy purposes, but must not
paraphrase, rename, abbreviate, or invent alternates for any of them.

---

## 4. Operational Handoff From WP-093 Execution

Three items surfaced during WP-093 execution that apply directly to
WP-091 execution.

### 4.1 Byte-for-byte string discipline — use a cross-file grep at pre-commit

WP-093 §11 Verification Step 11 established the cross-file
byte-identity grep as a **recommended** pre-commit check:

```pwsh
Select-String -Path "<every file that contains the template>" -Pattern "unsupported_hero_selection_mode"
```

WP-091's test code and its rule-mode indicator Vue component will
both carry literal copies of the WP-093-locked strings. **Promote the
cross-file byte-identity grep to a mandatory Verification Step for
WP-091** — its test files, any shared constant file, and the Vue
component all need to share byte-identical template prose. WP-093's
post-mortem §13 Lessons Learned flags this: "Future byte-for-byte
packets should make this grep a mandatory Verification Step, not a
recommended one."

A practical WP-091-side version:

```pwsh
Select-String -Path "packages\registry\src\setupContract\*.ts","packages\registry\src\setupContract\*.test.ts","apps\registry-viewer\src\**\*.vue","apps\registry-viewer\src\**\*.ts" -Pattern "unsupported_hero_selection_mode"
```

Every hit must share the identical template prefix with D-9301 and
`MATCH-SETUP-VALIDATION.md` Stage 1. No drift, no substring matches
that are actually substrings of a paraphrased variant.

### 4.2 Parallel-drift precedent — watch for pCloud-sync working-tree drift

WP-093 discovered mid-session that a parallel WP-095 (Ranking
Aggregation Data Model) session landed four files into the shared
branch via pCloud sync **between** WP-093's implementation audit (01.6
step 4, filename-scoped) and the pre-commit review (01.6 step 5,
hunk-scoped): `docs/01-VISION.md` §23(b) + §25 amendments, a new
`D-0005` entry in `DECISIONS.md` at line ~115, untracked
`docs/ai/DESIGN-RANKING.md`, and untracked
`docs/ai/work-packets/WP-095-ranking-aggregation-data-model.md`.
WP-093's filename-level scope audit passed (all 9 modified files were
in the §6 Scope Lock), but `git add docs/ai/DECISIONS.md` would have
swept D-0005 into the WP-093 commit under the `EC-093:` prefix if the
reviewer hadn't caught it at hunk level. Resolved via surgical stage:
`git checkout HEAD -- docs/ai/DECISIONS.md` → re-apply only the
WP-093 entry → `git add` → restore working tree from backup. See
[01.6-WP-093 §10 Fixes applied during post-mortem](../post-mortems/01.6-WP-093-match-setup-rule-mode-envelope-field.md)
for the full reversible five-step sequence, and §12.3 of the same
file for the reusable precedent.

**What this means for WP-091 execution:**

- **At every commit**, run `git diff --cached docs/ai/DECISIONS.md |
  grep ^@@` and expect **exactly one** hunk (the new WP-091 entry —
  likely D-9101). If more than one hunk appears, a parallel session
  has dropped its own entry into the same file; apply the surgical
  stage pattern from WP-093's post-mortem.
- **Same vigilance for `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`
  and any other append-mostly shared governance file.** The
  append-mostly design makes these files magnets for simultaneous
  edits across parallel sessions.
- **The parallel session's work must be preserved, not discarded.**
  Back up to `/tmp` before any `git checkout HEAD --` on a shared
  file so the parallel session's work can be restored to working
  tree unstaged. A wrong `checkout` can destroy another session's
  unstaged work.
- **WP-095's bundle (VISION.md + D-0005 + DESIGN-RANKING.md +
  WP-095 draft) is still uncommitted in the working tree as of
  `90a5026`.** It may land in a separate `SPEC:` commit while WP-091
  is authored or executed; anticipate its presence in every
  `git status --short` output and be ready to stage surgically.

### 4.3 Layer-boundary vigilance for browser-safe zod schema

WP-091's new `packages/registry/src/setupContract/` module is the
**first registry-side validator that mirrors an engine contract**
(`MatchSetupConfig`'s composition 9 fields + the engine's
drift-detection guarantees). Per `.claude/rules/architecture.md §Layer
Overview`:

- `packages/registry` may import: Node built-ins, `zod`
- `packages/registry` must NOT import: `game-engine`, `preplan`,
  `server`, `vue-sfc-loader`, any `apps/*`, `pg`

WP-091's drift-detection test at
`packages/registry/src/setupContract/matchSetup.drift.test.ts`
imports the engine's `MatchSetupConfig` *type* only (via `import
type`) to assert field-set equivalence at compile time — this is
permitted because it is a type-only import and produces no runtime
edge, but **any runtime import of engine code from registry is a
hard layer violation**. WP-091 §Acceptance Criteria §E enforces
this: "No `import { … } from '@legendary-arena/game-engine'` (runtime
import); only `import type { MatchSetupConfig }` (type-only)."

Expected grep at pre-commit:

```pwsh
Select-String -Path "packages\registry\src\setupContract\*.ts" -Pattern "^import.*from ['\""]@legendary-arena/game-engine['\""]"
# Expected: only matches that include "import type"; zero value-import hits
```

The registry-viewer's `Loadout` tab adds Vue components and
composables that consume the new `setupContract` module. The
**registry-viewer is explicitly engine-free at runtime** per
`.claude/rules/architecture.md §Import Rules`. `apps/registry-viewer`
may import `registry`, UI framework, `vue-sfc-loader` (devDep only,
test scripts); it must NOT import `game-engine`, `preplan`, `server`,
`pg`, or runtime `vue-sfc-loader`.

---

## 5. Active Risks for the WP-091 Executor

### 5.1 Byte-for-byte error-message-template drift

See §3.2 and §4.1. The template in WP-091's zod-schema refinement
(the upgrade from zod's default `invalid_enum_value` message to the
WP-093 template — see WP-091 §Scope A) must be byte-identical to
D-9301. A stray space, an HTML-escaped `<value>` (the same fix
applied during WP-093 execution), or a paraphrased clause will cause
WP-091's test
`heroSelectionMode: "HERO_DRAFT"` → error code
`"unsupported_hero_selection_mode"` and message body matches the
`MATCH-SETUP-VALIDATION.md` template verbatim to fail, and will
cascade into WP-092's shape-guard tests.

**Mitigation:** source the template from a single exported constant
in `setupContract/matchSetup.errors.ts` (or similar). WP-092 imports
the same constant from `@legendary-arena/registry` (registry is the
lowest layer WP-092 may import at runtime — engine is forbidden).
That gives both packets a single source of truth and the cross-file
byte-identity grep collapses to "is this constant referenced, not
paraphrased."

Actually — re-read WP-091 §Scope A carefully. WP-092 is
`apps/arena-client` and **may not import `@legendary-arena/registry`
at runtime** per layer rules (arena-client's allowed runtime imports
are UI framework only). So WP-092 will carry its own byte-for-byte
copy of the template. That means the template lives in at least four
places after WP-091 + WP-092 execute:

1. `docs/ai/DECISIONS.md` D-9301
2. `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md`
3. `packages/registry/src/setupContract/matchSetup.errors.ts` (new, WP-091)
4. `apps/arena-client/src/lobby/loadoutParser.ts` (new, WP-092)

The grep must cover all four. WP-091 §Acceptance Criteria G already
pins this.

### 5.2 Rule-mode indicator tooltip strings

See §3.3 and §3.5. The indicator surfaces three WP-093-locked label
strings (`"GROUP_STANDARD"`, `"Classic Legendary hero groups"`,
`"The engine expands each selected hero group into its canonical
card set at match start."`) plus the future-notice sentence
(`"Hero Draft rules are planned for a future update."`) plus the
composed render format from §3.5. A common failure mode is
paraphrasing "Classic Legendary hero groups" as "Legendary hero
groups (classic)" or similar — benign-looking but breaks the
byte-for-byte consumer contract.

### 5.3 Engine type-import discipline (runtime vs type-only)

See §4.3. The drift-detection test must use `import type` (no runtime
edge). Any `import { MatchSetupConfig } from
'@legendary-arena/game-engine'` without the `type` keyword is a
layer violation.

### 5.4 No server call, no persistence, no auth, no saved-loadout library

WP-091 is pure authoring + JSON export/import. The v1 Loadout tab
does **not**:

- call the game server or any backend
- persist anything beyond a browser session's in-memory draft
- offer authentication, login, or user profiles
- maintain a library of saved loadouts (download/upload JSON is the
  MVP bridge)

If execution surfaces an impulse to add localStorage persistence or
a "save to profile" button, STOP — that scope belongs to a future WP
that also lands a persistence / identity layer.

### 5.5 `heroSelectionMode` is display-only, not user-choosable

WP-091 §Session Context paragraph 2 locks this: the v1 builder
always emits `heroSelectionMode: "GROUP_STANDARD"` explicitly in
downloaded JSON; there is **no picker, no dropdown, no toggle** for
the user to select a rule mode. The indicator is read-only. Any UI
that lets the user choose `"HERO_DRAFT"` (or any other value) before
the engine supports it is a scope violation and a Session Abort
Condition per the prompt's §9 pattern.

### 5.6 `?? 'GROUP_STANDARD'` normalization happens in exactly one place

WP-091 §Scope A.1 requires that `validateMatchSetupDocument()`
normalizes an absent `heroSelectionMode` to `"GROUP_STANDARD"` at
the boundary so downstream code **never sees `undefined`**. The Vue
components and composables must read `value.heroSelectionMode`
directly (after the validator has run); they must not implement a
second normalization rule (`value.heroSelectionMode ?? "GROUP_STANDARD"`)
because that would duplicate the boundary guarantee and mask
validator bugs. The single-boundary-normalization discipline is a
correctness guarantee; duplicate defaults are a common failure mode.

### 5.7 01.5 Runtime Wiring Allowance — consider carefully

WP-091 adds a **new top-level tab** to `App.vue` and a new
composable surface. This probably does NOT invoke 01.5 (which is
about new `LegendaryGameState` fields, `buildInitialGameState` shape
changes, new moves, or new phase hooks — all engine-side). But the
WP-091 executor should run the 01.5 trigger check at session start
and explicitly declare `NOT INVOKED` if all four triggers are
absent (the expected case), per the session-prompt template WP-093
used. If 01.5 IS invoked at session prompt time, the escalation
posture from WP-093 §5.2 applies: unanticipated structural breaks
require STOP + escalate, not a retroactive 01.5 citation.

### 5.8 01.6 post-mortem will be MANDATORY

WP-091 fires multiple 01.6 triggers:

1. **New long-lived abstraction** — `validateMatchSetupDocument()`
   and the `setupContract` module become the first registry-side
   mirror of an engine contract.
2. **New contract consumed by future WPs** — WP-092's shape guard
   matches the schema shape; any future WP that emits or parses
   MATCH-SETUP documents consumes this validator.
3. **New code category directory** — `packages/registry/src/setupContract/`
   is a new directory (confirm against `02-CODE-CATEGORIES.md`).

Any one of these triggers makes 01.6 mandatory; WP-091 fires all
three. Author the post-mortem at
`docs/ai/post-mortems/01.6-WP-091-loadout-builder-registry-viewer.md`
per the 01.6 template.

---

## 6. Patterns Still in Effect

- **Commit prefix hygiene (01.3):**
  - `EC-091:` on code-changing commits (registry-side schema + tests,
    registry-viewer components + composables, App.vue tab integration)
  - `SPEC:` on governance close (STATUS.md + WORK_INDEX.md flip +
    EC_INDEX.md flip + post-mortem if not folded into Commit A)
  - **Bundled or split** topology both acceptable; WP-093 used split.
    Code-bearing WPs typically use split because the code commit and
    governance close are logically separable; bundle only if the code
    diff is tiny.
  - `WP-091:` prefix is **forbidden** — commit-msg hook rejects per P6-36.
- **§18 prose-vs-grep** — no known legacy tokens to guard against in
  WP-091's scope; §18 applies if execution ever introduces a grep
  pattern whose own search string would self-match.
- **§19 Bridge-vs-HEAD staleness** — if WP-091 authors bridge
  artifacts (this session-context, for example), reconcile them
  against HEAD before committing. See
  [session-context-wp090.md §Reconciliation Note (2026-04-24, post-session)](session-context-wp090.md)
  for a Path 2 worked example.
- **Additive-only edits to governance docs** — any WP-091 additions
  to `DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`
  must be purely additive; no rewriting of existing prose. See
  WP-093 L9.
- **pCloud conflict vigilance** — if a `[conflicted N]` copy of any
  target file appears during execution, verify the canonical file's
  line count against the pre-execution baseline before editing.
- **Parallel-drift vigilance** (new from WP-093) — see §4.2.
- **Baseline preservation** — engine `513 / 115 / 0`, arena-client
  `66 / 0 / 0`, preplan `52 / 7 / 0`, server `19 / 3 / 0`,
  replay-producer `4 / 2 / 0`, vue-sfc-loader `11 / 0 / 0`,
  repo-wide `678 / 129 / 0`. `packages/registry` baseline
  `13 / 2 / 0` will increase by exactly the WP-091-locked test
  count (see WP-091 §Scope E for the exact delta). Other package
  baselines must remain unchanged — WP-091 touches none of them.
- **No `--no-verify` or `--no-gpg-sign`** unless the user explicitly
  requests it.
- **Staging by exact filename only** — never `git add .` / `-A` /
  `-u` (P6-27 / P6-44).
- **Inherited untracked files** — `.claude/worktrees/`,
  `WP-059-preplan-ui-integration.md`,
  `EC-059-preplan-ui-integration.checklist.md` remain untracked and
  never staged. WP-095's uncommitted bundle (`docs/01-VISION.md`
  amendments, `D-0005` entry in `DECISIONS.md`,
  `docs/ai/DESIGN-RANKING.md`, WP-095 draft) is **parallel-session
  work** and remains untouched by WP-091's commits.
- **01.5 runtime-wiring allowance** — evaluate at session-prompt
  authoring time. Expected NOT INVOKED (WP-091 is
  registry-contract + UI, not engine runtime wiring).
- **01.6 post-mortem** — **MANDATORY** (three triggers fire; see
  §5.8).
- **01.7 Copilot Check** — recommended per WP-089 / WP-041 /
  WP-051 / WP-093 precedent; cheap insurance for a large packet.

---

## 7. Authoritative References

This file is **not authoritative**. If a conflict arises:

- On design intent → [WP-091](../work-packets/WP-091-loadout-builder-registry-viewer.md) wins
- On execution contract → [EC-091](../execution-checklists/EC-091-loadout-builder-registry-viewer.checklist.md) wins
- On the MATCH-SETUP schema itself → [MATCH-SETUP-SCHEMA.md](../REFERENCE/MATCH-SETUP-SCHEMA.md) + [MATCH-SETUP-JSON-SCHEMA.json](../REFERENCE/MATCH-SETUP-JSON-SCHEMA.json) + [MATCH-SETUP-VALIDATION.md](../REFERENCE/MATCH-SETUP-VALIDATION.md) win
- On `heroSelectionMode` strings → [DECISIONS.md D-9301](../DECISIONS.md) wins (byte-for-byte source)
- On the 9-field composition lock → [00.2 §7](../REFERENCE/00.2-data-requirements.md) + [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) win (note: WP-093 landed the "Envelope Extensibility" subsection at §7 because HEAD has Match Configuration at §7; §8.1 is Subordination — a benign staleness flagged in WP-093's post-mortem §10 Notes)
- On layer boundaries → [ARCHITECTURE.md §Layer Boundary (Authoritative)](../ARCHITECTURE.md) wins
- On commit hygiene → [01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) wins
- On post-mortem triggers → [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) wins
- On lint-gate prose discipline → [00.3 §17 / §18 / §19](../REFERENCE/00.3-prompt-lint-checklist.md) win
- On pre-commit review role → [PRE-COMMIT-REVIEW.template.md](../prompts/PRE-COMMIT-REVIEW.template.md) — **run in a separate session**, per WP-093's experience where the gatekeeper caught hunk-level parallel-drift contamination the implementation session missed

This bridge file is effectively operational-only; once WP-091
executes and D-9101 lands in DECISIONS.md, the file serves as a
historical record of the handoff from WP-093 (executed 2026-04-24 at
`90a5026`) to the WP-091 execution session, not a live guide.
