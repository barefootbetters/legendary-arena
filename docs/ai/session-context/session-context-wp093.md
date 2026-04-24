# Session Context — WP-093 (Match-Setup Rule-Mode Envelope Field — Governance)

> **Authored:** 2026-04-24 post the WP-090/091/092/093 A0 SPEC bundle
> session + WP-094 landing. **Purpose:** give the WP-093 executor a
> concise, current baseline so they don't re-derive: the main SHA, the
> cross-packet naming-governance contract, the byte-for-byte string
> discipline (WP-091 and WP-092 consume WP-093's outputs verbatim),
> the §18 legacy-token grep trap, or the composition-lock boundary.
>
> **This file is NOT a design-rationale bridge.** WP-093 is fully
> authored; its design intent lives in WP-093 itself. What follows is
> operational handoff only.
>
> **This file is NOT authoritative.** See §6 for the authority chain.

---

## 1. State as of authoring

**Branch:** `main` at `7e63771` (post-WP-094 close).

- WP-094 — Viewer Hero FlatCard Key Uniqueness — **executed and merged
  2026-04-24** (A0 SPEC `681e608` → content `eac678c` → governance
  close `7e63771`). Resolved the long-standing parallel-session
  `shared.ts` Vue v-for key edit that WP-087/088/089/090 had been
  deliberately not staging. **No longer a handoff concern.**
- WP-090 / WP-091 / WP-092 / WP-093 — all drafted and registered
  2026-04-24. Commit chain:
  - `887539a` — SPEC: WP-090 pre-flight bundle
  - `09c6a51` — SPEC: WP-093 pre-flight bundle (this packet)
  - `6770fa6` — SPEC: WP-091 pre-flight bundle (loadout builder)
  - `2385776` — SPEC: WP-092 pre-flight bundle (lobby loadout intake)
  - `f8a0684` — SPEC: session-context-wp090 §19.3 reconciliation
  - `15752bb` — SPEC: WP-090 forward-reference to WP-091/092/093
- WP-090 is **Ready** (pre-flight bundle on main; executor pending).
- WP-091 and WP-092 are Ready-but-blocked on **WP-093 executing first**
  (they consume its canonicalized strings byte-for-byte).
- WP-093 is the unblocker for the loadout-authoring-and-intake arc.

**Repo-wide test baseline (unchanged across all A0 governance commits
and WP-094 because no engine code was touched):**

| Package | tests / suites / fail |
|---|---|
| `packages/game-engine` | 513 / 115 / 0 |
| `apps/arena-client` | 66 / 0 / 0 |
| Repo-wide total | 678 / 129 / 0 |

WP-093 executes governance-only — **test counts must remain unchanged
after execution.** Re-verify with `pnpm -r test` at pre-flight and
after the content commit.

**Next free D-ID for WP-093:** **`D-9301`**. The D-9400 range is
allocated to WP-094 (D-9401 landed 2026-04-24 at `7e63771`). Even
though WP-094 executed *before* WP-093 in file-order, WP-093's
DECISIONS entry uses the D-9300 range per the standard
WP-NNN → D-NN01+ mapping.

---

## 2. WP-093 Governance Status — READY (all prerequisites met)

Unlike WP-090's session-context, which described a "pending A0
reintroduction" — **WP-093's governance rows are already on `main`**
as of commit `09c6a51`:

- `docs/ai/work-packets/WORK_INDEX.md` contains the
  `- [ ] WP-093 — Match-Setup Rule-Mode Envelope Field (Governance)
  ⬜ Draft` row in Phase 7 after WP-092
- `docs/ai/execution-checklists/EC_INDEX.md` contains
  `| EC-093 | WP-093 | Governance / Reference Documentation | ... | Draft |`
- The "Loadout Authoring + Intake" block in the WORK_INDEX Dependency
  Chain Quick Reference shows `WP-093 → {WP-091, WP-092}` prerequisite
  ordering (landed at `2385776`)
- WP-093 source + EC-093 checklist files are committed on main

**WP-093 execution work is purely content edits across 7 governance
files plus the DECISIONS entry.** No packet registration, no EC
registration — both already done.

**Pre-flight / session-prompt / copilot check: NOT YET AUTHORED.**
For a governance-only docs packet the pre-flight burden is lighter
than engine-side WPs, but the session prompt should still be authored
so the executor has a crisp invocation surface. WP-088 / WP-089
precedent applies.

---

## 3. Operational Handoff From This Session

Five items surfaced during the WP-090/091/092/093 drafting session
that apply directly to WP-093 execution.

### 3.1 Byte-for-byte string discipline for WP-091 and WP-092

**This is the single most important handoff.** WP-093 canonicalizes
five strings that WP-091 and WP-092 consume **verbatim, byte-for-byte:**

1. Error code: `"unsupported_hero_selection_mode"`
2. Error message template (with `<value>` placeholder) — see WP-093
   §Locked Contract Values for the exact text
3. Short UI label: `"Classic Legendary hero groups"` (capital "C" on
   "Classic")
4. Long explanation: `"The engine expands each selected hero group
   into its canonical card set at match start."`
5. Future-notice UX copy: `"Hero Draft rules are planned for a future
   update."`

These strings **must be copied into the `docs/ai/REFERENCE/*` files
and the DECISIONS.md entry exactly as locked in WP-093's §Locked
Contract Values section.** WP-091's validator tests and WP-092's
parser tests assert **exact-string equality** (not substring, not
regex, not `.includes()`) on the error-message template. Any
whitespace change, punctuation shift, or capitalization drift
introduced during WP-093 execution will cause WP-091 and WP-092
tests to fail when those packets execute.

### 3.2 Legacy planning-alias grep trap (§18)

WP-093's Verification Steps include a grep (Step 8.5) searching
`WP-091-*.md`, `WP-092-*.md`, and `WORK_INDEX.md` for the legacy
planning-alias token that was renamed to `HERO_DRAFT` during the
drafting session. The grep must return **zero matches** against those
three files. The only legitimate occurrence of the legacy token
anywhere in the repo is inside WP-093's **own** grep pattern string
— and the Verification Step explicitly excludes WP-093 from its
search path.

**During execution, DO NOT:**
- Add the legacy token back to WP-091, WP-092, or WORK_INDEX.md
- Change WP-093's Verification Step grep pattern (the search-path
  exclusion is load-bearing for §18 compliance)
- Rename `HERO_DRAFT` to anything else — the naming-governance policy
  in D-9301 locks this name as **the** reserved-future token

The §18 prose-vs-grep guard is subtle: prose in the WP that discusses
the legacy token must cite D-9301 (or the WP-093 DECISIONS entry's
naming-governance policy) rather than restate the token inline.
WP-093 is already compliant; preserve that compliance.

### 3.3 Additive-only edits to governance docs

**All WP-093 edits must be purely additive.** No existing prose may
be rewritten, reordered, paraphrased, or condensed. This applies
especially to:

- `MATCH-SETUP-SCHEMA.md` — add new §Optional Fields + §Field
  Semantics / Hero Selection Mode + §Extensibility bullet; do not
  restructure existing subsections
- `MATCH-SETUP-JSON-SCHEMA.json` — add `properties.heroSelectionMode`
  with `enum: ["GROUP_STANDARD"]`; **DO NOT** add it to the root
  `required` array; **DO NOT** change root `additionalProperties`
- `MATCH-SETUP-VALIDATION.md` — add a Stage 1 rule-mode bullet +
  valid/invalid Test Coverage entries; do not touch Stage 2 or Stage 3
- `00.2-data-requirements.md §8.1` — composition table **MUST NOT**
  be modified; add a new "Envelope Extensibility" subsection AFTER
  the existing 9-field table
- `.claude/rules/code-style.md` — the "MatchSetupConfig has 9 locked
  fields" enumeration stays verbatim; add a clarifying sentence
  AFTER it that scope-narrows the lock to composition (see §4.3 for
  the exact constraint)

Post-execution `git diff` on these files should show only insertions
around additive seams, never deletion-plus-insertion blocks.

### 3.4 Flavor / lore separation ("Contest of Champions")

WP-093's DECISIONS entry and Locked Contract Values explicitly carve
"Contest of Champions" out of the machine-readable surface. That
label is **narrative UI copy only** — it must never appear in:
- Enums (anywhere)
- Error messages
- JSON property names or values
- Schema validation constraints
- Lookup keys
- Branch conditions
- Analytics dimensions / telemetry fields
- Log tokens

WP-093 is the **first packet to establish this flavor/lore separation
discipline.** Every future rule-mode lore label will inherit it. If
the executor is tempted to use "Contest of Champions" in any
machine-addressable surface during execution, STOP — that's the exact
guardrail this packet is enshrining.

### 3.5 No `schemaVersion` bump — backward-compat analysis is normative

**`schemaVersion` stays at `"1.0"`.** The analysis:
- Documents authored before this change still validate (the field is
  optional at the JSON Schema level)
- Documents without `heroSelectionMode` are interpreted identically
  to their pre-change meaning (absent → `"GROUP_STANDARD"` by default)
- Therefore the change is additive + backward-compatible per
  `MATCH-SETUP-SCHEMA.md §Extensibility Rules` — no `"1.1"` bump
  required

The DECISIONS entry (D-9301) **must explicitly record this analysis**
so the non-bump is auditable and future reviewers don't need to
re-derive it. If execution surfaces an impulse to bump `schemaVersion`,
STOP and re-read the backward-compat analysis before committing.

---

## 4. Active Risks for the Executor

### 4.1 Composition lock erosion

The 9-field composition lock (`schemeId`, `mastermindId`,
`villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`,
`woundsCount`, `officersCount`, `sidekicksCount`) **cannot be
modified.** The common failure mode is adding `heroSelectionMode` to
the composition block because it's "about setup." **It must live on
the envelope, not composition.** Adding a 10th composition field
would violate:
- `00.2 §8.1` composition enumeration
- `.claude/rules/code-style.md` 9-field lock
- `packages/game-engine/src/setup/matchSetup.types.ts` `MatchSetupConfig` type

If an `heroSelectionMode` entry lands inside any composition-table
context during execution, scope has crept. Revert and re-apply
correctly before committing.

### 4.2 `.claude/rules/code-style.md` clarification boundary

The clarifying sentence added after the "MatchSetupConfig has 9 locked
fields" enumeration **must scope-narrow the lock to composition** and
name the envelope as extensible (with a cross-reference to
MATCH-SETUP-SCHEMA.md §Extensibility Rules). Phrasings that would
constitute **rescission** (and must be avoided):
- "the 9-field lock no longer applies"
- "both the envelope and composition are now extensible"
- "`MatchSetupConfig` may gain additional fields"

Correct phrasings (additive, bounded):
- "The 9-field lock applies specifically to the composition block"
- "The envelope is separately extensible per MATCH-SETUP-SCHEMA.md §Extensibility Rules"
- "This clarification does not alter the composition lock"

### 4.3 Verbatim drift in the error-message template or label strings

See §3.1. The error template and the three label strings are normative.
If any source copy introduces drift (a stray trailing space, a smart
quote, an em-dash substitution, a re-indented line break), WP-091 +
WP-092 tests will fail byte-for-byte equality assertions when those
packets execute.

**Test discipline tip during execution:** after landing the strings
in `MATCH-SETUP-SCHEMA.md` / `MATCH-SETUP-VALIDATION.md` / `DECISIONS.md`,
run a cross-file grep to verify byte-identity:

```pwsh
Select-String -Path "docs\ai\REFERENCE\MATCH-SETUP-SCHEMA.md","docs\ai\REFERENCE\MATCH-SETUP-VALIDATION.md","docs\ai\DECISIONS.md" -Pattern "unsupported_hero_selection_mode"
```

All hits should return the identical template string after the code
in context. This isn't a required Verification Step, but it's a cheap
pre-commit sanity check.

### 4.4 DECISIONS.md entry placement — use D-9301, NOT D-9401

WP-094's DECISIONS entries occupy the D-9400 range (D-9401 landed
2026-04-24). WP-093's entries land in the D-9300 range per the
standard WP-NNN → D-NN01+ mapping. If the executor runs
`grep -oE "^### D-[0-9]{4,}" DECISIONS.md | sort -u` to find the
next free ID, they'll see D-9401 is taken — but D-9301 is still free.
**Take D-9301.** Do not use D-9402+ (that would reserve part of
WP-094's range).

### 4.5 01.6 post-mortem is MANDATORY

**WP-093 fires at least two 01.6 triggers:**
- New long-lived abstraction — `heroSelectionMode` is the first
  rule-mode field; the naming-governance policy is a new long-lived
  governance pattern that future WPs will inherit
- New contract consumed by future WPs — WP-091 validator + WP-092
  parser consume WP-093's error template, label mapping, and error
  code byte-for-byte

Per `01.6-post-mortem-checklist.md`, two triggers firing →
post-mortem is **MANDATORY**. Author at
`docs/ai/post-mortems/01.6-WP-093-match-setup-rule-mode-envelope-field.md`.

### 4.6 Scope boundary — no `packages/` or `apps/` files

`git diff --name-only packages/ apps/` must return empty at every
commit. WP-093 is docs-only. If a code file appears in the staging
area, scope has leaked. Stage by exact filename — never
`git add .` / `-A` / `-u`.

### 4.7 Interpretation-flag-not-ruleset discipline

The DECISIONS entry must state that `heroSelectionMode` is an
**interpretation flag, not a ruleset selector**. No future WP may
use the field as a branch point for engine-level ruleset changes
**outside composition-interpretation scope**. This rules out
hypothetical future misuses like "if `heroSelectionMode === X`, also
change the villain deck shuffle algorithm." The constraint is in
WP-093's §Non-Negotiable Constraints; carry it forward to the
DECISIONS entry text byte-for-byte if possible.

---

## 5. Patterns Still in Effect

- **Commit prefix hygiene (01.3):**
  - `EC-093:` on the content commit (governance-doc edits + DECISIONS)
  - `SPEC:` on the governance close (STATUS + WORK_INDEX flip + EC_INDEX flip + post-mortem)
  - **Docs-only packets may bundle** — a single `EC-093:` commit
    carrying content + governance close is defensible per WP-089
    bundled-commit precedent
  - `WP-093:` prefix is **forbidden** — commit-msg hook rejects
- **§19 Bridge-vs-HEAD staleness** — if WP-093's session authors any
  bridge documents (additional session-context files, status
  snapshots), reconcile them against HEAD at commit time per
  `00.3 §19.3`. Path 2 (strikethrough + terminal Reconciliation Note)
  is the "acceptable" remediation pattern when a stale commit has
  been built upon; see `session-context-wp090.md §Reconciliation
  Note (2026-04-24, post-session)` for a worked example landed in
  this session at commit `f8a0684`
- **§18 prose-vs-grep** — preserve WP-093's existing §18 compliance
  (the legacy-token grep is search-path-limited and adjacent prose
  cites D-9301 rather than restating the token); do not alter either
- **Additive-only governance edits** — see §3.3
- **pCloud conflict vigilance** — if a `[conflicted N]` copy of any
  WP-093 target file (`MATCH-SETUP-SCHEMA.md`, the JSON schema, the
  validation doc, `00.2`, `code-style.md`, `DECISIONS.md`) appears
  during execution, verify the canonical copy's line count against
  the pre-execution baseline before editing
- **Baseline preservation** — engine `513 / 115 / 0`, arena-client
  `66 / 0 / 0`, repo-wide `678 / 129 / 0`. WP-093 touches no code,
  so these counts must remain unchanged. Re-verify with
  `pnpm -r test` at pre-flight and after content commit
- **No `--no-verify` or `--no-gpg-sign`** unless the user explicitly
  requests it
- **Staging by exact filename only** — never `git add .` / `-A` / `-u`
  (P6-27 / P6-44)
- **Inherited untracked files** — `.claude/worktrees/` + WP-059 +
  EC-059 remain untracked and never staged. **The `shared.ts`
  parallel-workstream constraint from WP-087/088/089/090 is RESOLVED
  post-WP-094** (landed at `eac678c`); no longer a handoff item
- **01.5 runtime-wiring allowance — NOT INVOKED** (all four criteria
  absent: no `LegendaryGameState` field, no `buildInitialGameState`
  shape change, no new move, no new phase hook; WP-093 is
  governance-only)
- **01.7 Copilot Check** — recommended per WP-089 / WP-041
  precedent. For a governance-only packet the risk surface is small,
  but the check is cheap

---

## 6. Authoritative References

This file is **not authoritative**. If a conflict arises:

- On design intent → [WP-093](../work-packets/WP-093-match-setup-rule-mode-envelope-field.md) wins
- On execution contract → [EC-093](../execution-checklists/EC-093-match-setup-rule-mode-envelope-field.checklist.md) wins
- On the MATCH-SETUP schema itself → [MATCH-SETUP-SCHEMA.md](../REFERENCE/MATCH-SETUP-SCHEMA.md) + [MATCH-SETUP-JSON-SCHEMA.json](../REFERENCE/MATCH-SETUP-JSON-SCHEMA.json) + [MATCH-SETUP-VALIDATION.md](../REFERENCE/MATCH-SETUP-VALIDATION.md) win
- On the 9-field composition lock → [00.2 §8.1](../REFERENCE/00.2-data-requirements.md) + [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) win
- On layer boundaries → [ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) wins
- On commit hygiene → [01.3-commit-hygiene-under-ec-mode.md](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md) wins
- On post-mortem triggers → [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) wins
- On lint-gate prose discipline → [00.3 §18 / §19](../REFERENCE/00.3-prompt-lint-checklist.md) win

This bridge file is effectively operational-only; once WP-093 executes
and D-9301 lands in DECISIONS.md, the file serves as a historical
record of the handoff from the WP-090/091/092/093 A0 session (plus
WP-094's intervening close) to the WP-093 execution session, not a
live guide.
