# Session Context — WP-082 (Keyword & Rule Glossary Schema, Labels, and Rulebook Deep-Links)

> **Authored:** 2026-04-21 during the pre-flight / copilot / session-prompt drafting session (this file is the bridge into the EC-107 execution session).
> **Purpose:** Bridge doc for the next executor. Captures the baseline, the inherited dirty-tree classification, the 113 → 123 keyword-count drift, the `rules-full.json` diff-pending gate, and the `pdfPage` propagation option (α) lock. The executing session must re-derive the baselines at session start and fail fast if they drift.

WP-082 is a **registry + viewer-layer Runtime Wiring WP**. It adds two Zod schemas at the Registry boundary, backfills `label` / `pdfPage` metadata into two existing content JSON files under `data/metadata/`, wires `.safeParse(...)` into the viewer fetch path, deletes a long-standing `titleCase()` heuristic that broke rulebook capitalization in five confirmed cases (WP-060 audit), and adds a new PDF deep-link anchor in the glossary panel. **Zero** engine / preplan / server / pg / boardgame.io touch points. **Zero** `G` mutations. **Zero** new tests required.

The authority documents are, in order:
1. `.claude/CLAUDE.md` → `docs/ai/ARCHITECTURE.md` → `.claude/rules/*.md`
2. `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md` (primary execution authority — §Locked Values are binary)
3. `docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md` (authoritative WP specification)
4. `docs/ai/invocations/preflight-wp082-keyword-rule-glossary-schema-and-labels.md` (pre-flight + 01.7 copilot check)
5. `docs/ai/invocations/session-wp082-keyword-rule-glossary-schema-and-labels.md` (session prompt — the single execution brief)

If this file conflicts with the EC or the pre-flight, **the EC + pre-flight win**.

---

## 1. Baseline (Must Re-Verify at Session Start)

### 1.1 Git state

- **HEAD at authoring time:** `45ddb49` (`SPEC: close WP-036 / EC-036 governance …`).
- **Branch at authoring time:** `wp-036-ai-playtesting`. **Execute from `wp-082-keyword-rule-glossary-schema-and-labels`** cut from `45ddb49` (PS-4).
- **Upstream to re-check before A0:** `git rev-parse HEAD` must still resolve to `45ddb49`; if `main` has advanced, rebase the new branch accordingly before Commit A0 or STOP and reconcile.
- **Stashes:** at authoring time, `git stash list` was empty. Re-derive at session start; preserve any inherited stash (do NOT `git stash drop` / `git stash pop` without authorization).

### 1.2 Test baseline (LOCKED — enforced as binary AC)

Re-derive with `pnpm -r --if-present test` from the WP-082 branch tip. Expected:

| Package | Tests | Suites | Fail |
|---|---|---|---|
| `packages/registry` | 13 | 2 | 0 |
| `packages/vue-sfc-loader` | 11 | 0 | 0 |
| `packages/game-engine` | 444 | 110 | 0 |
| `apps/replay-producer` | 4 | 2 | 0 |
| `apps/server` | 6 | 2 | 0 |
| `packages/preplan` | 52 | 7 | 0 |
| `apps/arena-client` | 66 | 0 | 0 |
| `apps/registry-viewer` | — (no test script) | — | — |
| **Repo-wide** | **596** | — | **0** |

A delta of even one test (pass or fail) invalidates the zero-new-tests guarantee — STOP and escalate.

### 1.3 Build baseline

`pnpm -r build` must exit 0 from the WP-082 branch tip before Commit A. Verified clean at authoring time.

---

## 2. Mid-Authoring Findings (Not in the WP / EC Body)

### 2.1 Keywords-full.json has drifted from WP-060 close (113 → 123)

The committed `data/metadata/keywords-full.json` at `412a31c` had **113 entries**. The working-tree copy at authoring time has **123 entries** — ten new keys appended in `{ key, description }` shape **before this session began**:

```
chooseavillaingroup   galactusconsumestheearth   locations      reveal    wound
defeat                greyheroes                 poisonvillains shards
halfpoints
```

These 10 entries are authored but **do not yet carry `label` or `pdfPage` fields**. EC-107 §Before Starting treats the modified `keywords-full.json` as **in-scope partial work** folded into Commit A. The 123-entry baseline is the number locked in EC-107 §Locked Values "Entry counts — exact" and acceptance criterion item 3.

**Verify at session start:**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8')).length)"
# expect: 123
```

If the count has drifted from 123 (either higher or lower), STOP and ask. The number is **not renegotiable inside the session**.

### 2.2 Rules-full.json shows M in git status (RS-3 gate — diff-pending)

At authoring time, `data/metadata/rules-full.json` shows `M` in `git status`. The committed copy at `412a31c` was 20 entries of `{ key, label, summary }`. **The scope of the M drift was not determined at authoring time and is deferred to the execution session's first action.** EC-107 §Before Starting and pre-flight §Risk RS-3 both require a focused diff as the very first step of Commit A:

```bash
git diff data/metadata/rules-full.json
```

- **If whitespace-only or re-ordering-only** → revert (`git checkout HEAD -- data/metadata/rules-full.json`) and re-apply **only** the `pdfPage` additions per EC-107 §Scope item D.
- **If content-altering** (any `label` / `summary` text change, any key change) → STOP and escalate. This violates the byte-for-byte preservation guardrail at WP-082 §Non-Negotiable Constraints.

Re-derived at session start: 20 entries, alphabetical, duplicate-free, fields `{ key, label, summary }`. The executor must re-confirm.

### 2.3 Inherited dirty-tree classification (CRITICAL)

`git status --short` at authoring time (2026-04-21, HEAD `45ddb49`, branch `wp-036-ai-playtesting`):

**In scope for Commit A (exactly 5 items):**

| Status | Path | Action |
|---|---|---|
| M | `data/metadata/keywords-full.json` | Fold into Commit A after RS-3 diff check passes; add `label` (required) + `pdfPage` (optional) to all 123 entries. |
| M | `data/metadata/rules-full.json` | Fold into Commit A after RS-3 diff check passes; add `pdfPage` (optional) only. |
| ?? | `docs/Marvel Legendary Universal Rules v23.txt` | Commit as-is; 5250 lines, raw `pdftotext -layout` output, reproducible source. |
| ?? | `docs/legendary-universal-rules-v23.md` | Commit in Commit A; prepend Authority Notice blockquote before any heading (EC-107 §Locked Values "Authority Notice"). Rest of file preserved as-is — no further "light cleaning." |
| ?? | `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md` | Lands in **Commit A0**, not A. |

**Out of scope — quarantine, DO NOT touch or stage in any commit of this WP:**

- `D data/metadata/card-types-old.json` *(deletion owned by WP-084 / EC-109)*
- `M docs/00-INDEX.md`
- `M docs/05-ROADMAP-MINDMAP.md`
- `M docs/05-ROADMAP.md`
- `M docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
- `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`
- `M docs/ai/session-context/session-context-wp060.md`
- `?? .claude/worktrees/`
- `?? content/themes/heroes/`
- `?? docs/ai/ideas/`
- `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
- `?? docs/ai/invocations/forensics-move-log-format.md`
- `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `?? docs/ai/invocations/session-wp068-preferences-foundation.md`
- `?? docs/ai/post-mortems/01.6-applyReplayStep.md`
- `?? docs/ai/session-context/session-context-forensics-move-log-format.md`
- `?? docs/ai/session-context/session-context-wp037.md`
- `?? docs/ai/session-context/session-context-wp067.md`
- `?? docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md` *(staged at A0 alongside EC-107, session prompt, pre-flight)*
- `?? docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` *(future WP — NOT this one)*
- `?? docs/ai/work-packets/WP-084-delete-unused-auxiliary-metadata.md` *(future WP — NOT this one)*

**Staging discipline:** stage by exact filename only. `git add .` / `git add -A` / `git add -u` are **forbidden** per P6-27 / P6-44 / P6-50. If a quarantined file is staged by accident, unstage it with `git restore --staged <path>` before committing.

### 2.4 `apps/registry-viewer/` has no formal code-category row

Pre-flight §Risk RS-6 noted this. `apps/registry-viewer/` does not have a row in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` Category Summary table (lines 36–49). Its import rules are authoritatively codified in `docs/ai/ARCHITECTURE.md` §Package Import Rules line 201 and have been normalized by EC-101..EC-106 precedent. **This is pre-existing tech debt, out of scope for WP-082.** No new directory is created inside `apps/registry-viewer/` by this WP; all modifications are to pre-existing files. Do NOT expand WP-082 scope to fix the category-row gap — that belongs to a separate governance SPEC commit.

### 2.5 `lookupKeyword` has three `.get(...)` sites, not one

The EC-107 §Locked Values "useGlossary.ts edits" option (a) description says the widened Map value "collapses to a one-line `.description` access inside the existing branches." Reality check against `apps/registry-viewer/src/composables/useRules.ts:156–199`: there are **three** `.get(...)` call sites, not one:

- Line 160: `return _keywordGlossary.get(lower)!;` → `return _keywordGlossary.get(lower)!.description;`
- Line 164: `return _keywordGlossary.get(stripped)!;` → `return _keywordGlossary.get(stripped)!.description;`
- Line 198: `return bestMatch ? _keywordGlossary.get(bestMatch)! : null;` → `return bestMatch ? _keywordGlossary.get(bestMatch)!.description : null;`

All three are identifier-only changes — no algorithmic branch re-ordering, no signature changes. The EC-106 algorithmic-preservation lock holds byte-for-byte for the branching structure (exact / space-hyphen-stripped / prefix / suffix / substring). Every existing `// why:` comment in the function is preserved verbatim.

### 2.6 `pdfPage` propagation through `GlossaryEntry` — option (α) lock

EC-107 §Out of Scope forbids widening the keyword Map value past `{ label, description }`. Therefore `pdfPage` cannot reach `GlossaryEntry` via the keyword Map. The session prompt §Locked Values "Implementation Note on `pdfPage` propagation" locks **option (α): a parallel `Map<string, number>` keyed by `key → pdfPage` owned by `glossaryClient.ts`, exposed via a new `getKeywordPdfPageMap()` export from `useRules.ts`, consulted by `useGlossary.ts buildAllEntries()` per keyword entry.**

**Hard ownership boundary:** the parallel `pdfPage` Map is owned by the Registry-viewer fetch layer (`glossaryClient.ts`). **No viewer composable** (`useRules.ts`, `useGlossary.ts`) and **no component** (`GlossaryPanel.vue`, `App.vue`) may re-read `keywords-full.json` or `rules-full.json` directly. All `pdfPage` values flow **outward** from the `.safeParse(...)` result in `glossaryClient.ts` via the exported getter in `useRules.ts` — never re-fetched, never re-parsed. A future contributor importing `../../data/metadata/*.json` from a composable is violating this boundary regardless of what the lint gate says.

**Option (β) — widening the Map value to `{ label, description, pdfPage? }` — is forbidden without a new DECISIONS.md entry authored before adoption.** If option (α) surfaces a typecheck issue that cannot be resolved with a one-line widening, STOP and ask.

### 2.7 `titleCase()` incident context (WP-060 audit)

The deleted `titleCase()` at `apps/registry-viewer/src/composables/useGlossary.ts:94–100` was introduced as a fallback heuristic that split camelCase + hyphens and capitalized each segment. It broke canonical rulebook capitalization in five confirmed cases surfaced by the WP-060 audit:

| Key | `titleCase()` output | Correct rulebook label |
|---|---|---|
| `chooseavillaingroup` | `Chooseavillaingroup` | `Choose a Villain Group` |
| `shieldclearance` (hypothetical match) | `Shieldclearance` | `S.H.I.E.L.D. Clearance` |
| `greyheroes` | `Greyheroes` | `Grey Heroes` |
| `halfpoints` | `Half-points` | `Half-Points` |
| Punctuation-bearing keys | Unrecoverable | (various) |

No heuristic can recover these — explicit `label` fields sourced verbatim from the rulebook are the only correct answer. The HERO_CLASS_LABELS Map added in `useRules.ts` bakes this lesson into code: the `// why:` comment on the Map enumerates these exact failure cases so no future contributor "helpfully" reintroduces a string-transformation helper to "clean up" the hardcoded labels.

### 2.8 D-6001 is partially superseded by WP-082

D-6001 ("Keyword and Rule Glossary Data Is Display-Only, No Zod Schema") was authored at WP-060. WP-082 §G adds Zod schemas at the Registry boundary, superseding the "No Zod Schema" clause. The "display-only" clause remains correct — no engine consumes glossary data; the schemas govern viewer-fetch validation only.

Commit B's DECISIONS.md update must:
- Append `**Superseded by:** D-NNNN (partial — Zod schema clause only; display-only clause remains)` to D-6001 (where D-NNNN is the first WP §Governance entry).
- On the new decision, add `**Supersedes:** D-6001 (partial — Zod schema clause only; display-only clause remains)`.

This symmetric back-pointer pair resolves pre-flight RS-9 and copilot RISK FIX #2.

### 2.9 `.strict()` is the first use in `schema.ts`

Existing registry Zod schemas in `packages/registry/src/schema.ts` are **permissive by design** — `HeroCardSchema` uses optional/nullable extensively to accommodate real-data quirks (WP-003 precedent: `amwp` Wasp has `"2*"` star-cost cards; `msp1` uses `-1` sentinel IDs; etc.). `LeadsEntrySchema` at line 94 uses `.catchall(z.unknown())`. The new `KeywordGlossaryEntrySchema` + `RuleGlossaryEntrySchema` are the **first `.strict()` schemas** in the file.

This is the **WP-033 / D-3303 author-facing-strict-vs-loader-permissive pattern**: loader schemas accept shipped-data quirks permissively; author-facing schemas for new content are strict so typos reach the pre-flight grep, not runtime. Drift detection for glossary schemas is enforced by `.strict()` + the governed-extension path rather than canonical-array parity, because glossary entries are open-ended editorial metadata rather than a closed engine enumeration. The `// why:` block above the two new entry schemas locks this rationale in the source file; a DECISIONS.md entry in Commit B reiterates it for audit.

### 2.10 `rules-full.json` rows in `docs/03.1-DATA-SOURCES.md` carry a stale count

`docs/03.1-DATA-SOURCES.md:61` states `keywords-full.json | 113 keywords`. Per §2.1 above, the working-tree count is 123. EC-107 §Files to Produce includes the `docs/03.1-DATA-SOURCES.md` update; the row must move 113 → 123 in Commit A, plus add the schema-reference row and the rulebook PDF row.

---

## 3. Pre-Flight Open Questions (Resolved in Pre-Flight)

All twelve risks surfaced in pre-flight §Risk & Ambiguity Review (RS-1 through RS-12) have locked mitigations. Re-read them at session start:

| RS # | Topic | Resolution |
|---|---|---|
| RS-1 | Keywords 113 → 123 drift | Locked at 123; re-verify at session start; STOP if drifted. |
| RS-2 | Dirty-tree contains 20+ out-of-scope items | Enumerated in §2.3 above; stage by exact filename only. |
| RS-3 | `rules-full.json` M scope unclear | First action of Commit A is `git diff data/metadata/rules-full.json`; whitespace → revert + re-apply `pdfPage`; content → STOP. |
| RS-4 | `.strict()` first use in `schema.ts` | Author-facing-strict pattern per WP-033 / D-3303; `// why:` block documents it; no new DECISIONS.md entry beyond the six already in WP §Governance. |
| RS-5 | `lookupKeyword` has three `.get(...)` sites | §2.5 above; three identifier-only `.description` suffix adds. |
| RS-6 | `apps/registry-viewer/` category-row gap | Pre-existing tech debt; out of scope. |
| RS-7 | `setGlossaries` signature widening cascade | Option (α) locked; typecheck after each viewer-file edit; STOP if cannot resolve with a one-line widening. |
| RS-8 | `titleCase()` deletion cascades to hero-class path | `HERO_CLASS_LABELS` Map with 5 entries replaces the hero-class call site; §2.7 above. |
| RS-9 | D-6001 partial supersession | §2.8 above; symmetric back-pointer pair in Commit B. |
| RS-10 | 01.7 copilot check mandatory | Ran in same session as pre-flight; initial HOLD; re-confirmed to CONFIRM after A0 fixes; see pre-flight file appended block. |
| RS-11 | Markdown extract "light cleaning" scope | Prepend Authority Notice only; no further editing. |
| RS-12 | Zod version drift between packages | `pnpm-lock.yaml` diff is empty; verified at session start. |

---

## 4. Branch / Commit Topology

### 4.1 Branch

Execute on `wp-082-keyword-rule-glossary-schema-and-labels`, cut fresh from `45ddb49` (PS-4). All three commits (A0 / A / B) land on this branch.

### 4.2 Commit A0 (`SPEC:`) — pre-flight bundle (this session's target)

Staged files — governance only, no code:

1. `docs/ai/work-packets/WORK_INDEX.md` (M) — WP-082 row added (PS-1).
2. `docs/ai/execution-checklists/EC_INDEX.md` (M) — EC-107 row added (PS-2).
3. `docs/ai/session-context/session-context-wp082.md` (??→A) — this file (PS-3).
4. `docs/ai/work-packets/WP-082-keyword-rule-glossary-schema-and-labels.md` (??→A) — the WP itself.
5. `docs/ai/execution-checklists/EC-107-keyword-rule-glossary-schema-and-labels.checklist.md` (??→A) — the EC itself (RISK FIX #3 amendment adds item 25d to §Manual PROD smoke before A0 lands).
6. `docs/ai/invocations/preflight-wp082-keyword-rule-glossary-schema-and-labels.md` (??→A) — pre-flight + 01.7 CONFIRM 30/30 re-confirmation block (RISK FIX #4).
7. `docs/ai/invocations/session-wp082-keyword-rule-glossary-schema-and-labels.md` (??→A) — session prompt.

**Suggested A0 commit message:**

```
SPEC: WP-082 pre-flight + EC-107 preconditions resolved
```

Commit-msg hook compliance confirmed: `SPEC:` allowed prefix (Rule 2); 48 chars after prefix (Rule 3 ≥ 12); no forbidden words (Rule 1); no code files staged so Rule 5's EC-prefix requirement does not apply.

### 4.3 Commit A (`EC-107:`) — execution session

Executes in a **new Claude Code session** reading `session-wp082-keyword-rule-glossary-schema-and-labels.md` as the single brief. Allowlist: see pre-flight §Files Expected to Change — Commit A (15 files). R2 operator steps run between A and B.

### 4.4 Commit B (`SPEC:`) — governance close

- `docs/ai/STATUS.md` (if exists) — append WP-082 completion entry.
- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-082 `[ ]` → `[x]` with date + Commit A hash.
- `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-107 → `Done`; Summary counts bumped (Draft -1 / Done +1).
- `docs/ai/DECISIONS.md` — six new WP §Governance entries, including the RISK FIX #1 drift-detection sentence and the RISK FIX #2 D-6001 supersession back-pointers.

---

## 5. Do-Not-Touch List (Summary)

- **`packages/game-engine/**`**, **`packages/preplan/**`**, **`packages/vue-sfc-loader/**`**, **`apps/server/**`**, **`apps/arena-client/**`**, **`apps/replay-producer/**`**, **`content/themes/**`** — all out of scope. Any diff here is a scope violation.
- **`lookupKeyword` / `lookupRule` algorithmic bodies** — preserved byte-for-byte except the three `.description` suffix adds at lines 160 / 164 / 198.
- **`HERO_CLASS_GLOSSARY` content** — 5 entries, byte-for-byte preserved.
- **Existing `description` / `label` / `summary` text** in both JSON files — byte-for-byte preserved.
- **Token markup** (`[icon:X]`, `[hc:X]`, `[keyword:N]`, `[rule:N]`) inside JSON fields — byte-for-byte preserved.
- **`pnpm-lock.yaml`** — no diff (no new dependencies; `zod` already in `packages/registry`).
- **`.env.example`** — no change (belongs to future follow-up WP).
- **Quarantined dirty-tree items** (§2.3 out-of-scope list) — do not touch or stage.
- **01.5 runtime-wiring engine clause** — NOT INVOKED; viewer analog is invoked explicitly only for the 5 viewer files per WP-060 / D-6007 precedent; do NOT cite retroactively.
- **`--no-verify`**, **`--no-gpg-sign`** — forbidden.
- **Push to remote** — forbidden unless explicitly asked.

---

## 6. Ready Signal

When all of the following hold, the execution session may begin with Commit A:

- Commit A0 has landed on the `wp-082-keyword-rule-glossary-schema-and-labels` branch.
- `git log --oneline -1` shows the A0 commit as HEAD.
- Pre-flight §Authorized Next Step is logged with PS-1..PS-4 resolved.
- 01.7 copilot check appended block reads `CONFIRM` with 30/30 PASS.
- `pnpm -r build` and `pnpm -r --if-present test` both exit 0 with the 596 / 0 baseline.
- `git status --short` shows the same dirty-tree map as §2.3 **except** the five in-scope items have been folded into the A0 bundle's staged set for A (if adopted at A0) OR remain untouched for A (if the executor prefers to stage them at A).

If any is missing, STOP — execution is blocked on governance.
