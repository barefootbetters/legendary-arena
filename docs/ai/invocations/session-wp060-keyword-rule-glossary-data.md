# Session Prompt — WP-060 Keyword & Rule Glossary Data Migration

**Work Packet:** [docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md](../work-packets/WP-060-keyword-rule-glossary-data.md) (amended 2026-04-20)
**Execution Checklist:** [docs/ai/execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md](../execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp060.md](../session-context/session-context-wp060.md)
**Pre-Flight Report:** [docs/ai/invocations/preflight-wp060-keyword-rule-glossary-data.md](preflight-wp060-keyword-rule-glossary-data.md)
**Commit prefix:** `EC-106:` on every code- or content-changing commit in the WP-060 allowlist; `SPEC:` on governance / pre-flight commits outside the allowlist; `WP-060:` is **forbidden** (commit-msg hook rejects per P6-36). `EC-060:` is **forbidden** (slot consumed by commit `6a63b1c`; retargeted to EC-106 per the seven-row precedent chain).
**Pre-flight verdict:** READY TO EXECUTE (2026-04-20) — D-1 (baseline), D-2 (EC slot), D-3 (counts), D-4 (algorithm preservation), D-5 (`useGlossary.ts` scope) all resolved in Commit A0 SPEC bundle.
**Copilot Check (01.7):** CONFIRM — 30/30 PASS, zero FIXes, zero HOLD, zero SUSPEND. See pre-flight §Copilot Check.
**WP Class:** Runtime Wiring (viewer-layer variant). No engine changes. No `G`. No moves. No phase hooks. No preplan. No boardgame.io.
**Primary layer:** Registry Viewer (`apps/registry-viewer/src/lib/` + `src/composables/`) + Content / Data (`data/metadata/`).

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-106:` on code commits inside the allowlist; `SPEC:` on governance commits. `WP-060:` / `EC-060:` forbidden. Subject lines containing `WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff` are rejected by `.githooks/commit-msg` per P6-36.

2. **Governance bundle landed (A0 SPEC).** Before writing any code file, run `git log --oneline -5` and confirm Commit A0 landed with all of:
   - `docs/ai/execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md` (new)
   - `docs/ai/execution-checklists/EC_INDEX.md` (EC-106 row appended to §Registry Viewer series)
   - `docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md` (amendments — `Last Updated: 2026-04-20`; 113 / 20 counts; `useGlossary.ts` in §Files Expected; §D algorithm preservation LOCK; §F reactive rebuild; §Governance seven decisions)
   - `docs/ai/invocations/preflight-wp060-keyword-rule-glossary-data.md` (new, with copilot-check appendix and resolution log)
   - This session prompt

   If any is unlanded, STOP — execution is blocked on pre-flight governance.

3. **Upstream dependency baseline.** Run:
   ```bash
   pnpm -r --if-present test
   ```
   Expect repo-wide `588 passing / 0 failing`. Package-level breakdown (session context §Test baselines):
   - registry `13 / 2 / 0`
   - vue-sfc-loader `11 / 0 / 0`
   - game-engine `436 / 109 / 0` (MUST hold unchanged — WP-060 touches zero engine code)
   - server `6 / 2 / 0`
   - replay-producer `4 / 2 / 0`
   - preplan `52 / 7 / 0`
   - arena-client `66 / 0 / 0`

   If the repo baseline diverges, STOP and reconcile before proceeding.

4. **Source-of-truth verification.** Before reading the WP, confirm the actual Map sizes in `apps/registry-viewer/src/composables/useRules.ts`:
   ```bash
   node -e "
   const fs=require('fs');
   const src=fs.readFileSync('apps/registry-viewer/src/composables/useRules.ts','utf8');
   function count(name){
     const start=src.indexOf('export const '+name);
     if(start<0)return 0;
     const open=src.indexOf('new Map([',start)+'new Map(['.length;
     let d=1,i=open;
     while(d>0&&i<src.length){const c=src[i];if(c==='[')d++;else if(c===']')d--;i++;}
     return (src.slice(open,i-1).match(/^\s*\[\s*\"/gm)||[]).length;
   }
   console.log('RULES_GLOSSARY=',count('RULES_GLOSSARY'));
   console.log('KEYWORD_GLOSSARY=',count('KEYWORD_GLOSSARY'));
   console.log('HERO_CLASS_GLOSSARY=',count('HERO_CLASS_GLOSSARY'));
   "
   ```
   Expected: `RULES_GLOSSARY=20`, `KEYWORD_GLOSSARY=113`, `HERO_CLASS_GLOSSARY=5`. **If any count differs from the pre-flight baseline, STOP and re-anchor** — amend the JSON output counts in Verification Step 6 accordingly and note the drift in the execution summary. Do not execute against stale counts.

5. **Working-tree hygiene (P6-27 / P6-44 discipline).** `git status --short` will show the 11 inherited dirty-tree items plus the A0-landed files. The inherited items (none in WP-060 allowlist):
   - `M docs/00-INDEX.md`
   - `M docs/05-ROADMAP-MINDMAP.md`
   - `M docs/05-ROADMAP.md`
   - `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`
   - `M docs/ai/session-context/session-context-wp060.md`
   - `?? .claude/worktrees/`
   - `?? content/themes/heroes/`
   - `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
   - `?? docs/ai/invocations/forensics-move-log-format.md`
   - `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md`
   - `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
   - `?? docs/ai/invocations/session-wp068-preferences-foundation.md`
   - `?? docs/ai/post-mortems/01.6-applyReplayStep.md`
   - `?? docs/ai/session-context/session-context-forensics-move-log-format.md`
   - `?? docs/ai/session-context/session-context-wp067.md`

   **Stage by exact filename only** — `git add .` / `git add -A` / `git add -u` are forbidden (P6-27 / P6-44). If a mystery untracked file appears mid-session (e.g., `docs/ai/ideas/` per the WP-030 precedent), flag it in the execution summary and do NOT touch it.

6. **Quarantine state — do NOT disturb.** Session context §Quarantine stashes lines 142–147:
   - `stash@{0}` — wp-055-quarantine-viewer (registry-viewer v1→v2 music-field edits; out of scope)
   - `stash@{1}` — WP-068 / MOVE_LOG_FORMAT governance edits
   - `stash@{2}` — pre-WP-062 dirty tree

   Never pop during WP-060 execution.

7. **Code-category classification confirmed.** All new/modified files land in pre-classified parents:
   - `data/metadata/keywords-full.json`, `data/metadata/rules-full.json` — **data-input** category (same as `sets.json`, `card-types.json`).
   - `apps/registry-viewer/src/lib/glossaryClient.ts` — viewer `src/lib/` (existing category; hosts `themeClient.ts`, `registryClient.ts`, `devLog.ts`, `debugMode.ts`, `theme.ts`).
   - `apps/registry-viewer/src/composables/{useRules,useGlossary}.ts` — viewer `src/composables/` (existing category).
   - `apps/registry-viewer/src/App.vue`, `apps/registry-viewer/CLAUDE.md`, `docs/03.1-DATA-SOURCES.md` — existing files, existing categories.

   No new directory is created. No D-entry for directory classification is needed.

8. **R2 credentials verification.** Before beginning Task 3, confirm the executor has R2 credentials available for the Task 9 upload step. If not, **STOP and escalate** — do NOT produce a half-migrated code commit that would break tooltips without the matching R2 artifacts.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED as engine clause

Per [01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause. WP-060 touches **zero** engine contract surface:

| 01.5 Trigger Criterion | Applies to WP-060? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No engine type modified. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No setup orchestrator touched. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. Engine baseline 436/109/0 must hold. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook added. |

**Conclusion:** 01.5 is NOT INVOKED as an engine-contract clause.

**Viewer-scope analog cited for `useGlossary.ts` only:** the principles of 01.5 (minimal, strictly dependency-driven, no new behavior beyond wiring) are applied by analogy to authorize the single viewer-local file expansion to `useGlossary.ts` outside the WP's original allowlist. The expansion is a direct consequence of removing `KEYWORD_GLOSSARY` / `RULES_GLOSSARY` exports from `useRules.ts` (without the edit, `useGlossary.ts:12–13` import fails at compile time — pre-flight §D-5 / R-1 precedent). WP-060 §Files Expected to Change (amended) includes `useGlossary.ts`; EC-106 §Files to Produce includes it. This analog does NOT authorize any other out-of-allowlist edit.

---

## Post-Mortem (01.6) — NOT TRIGGERED

Per [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md) and EC-106 §01.6 post-mortem disposition. Each mandatory trigger evaluated:

| 01.6 Trigger | Applies? | Justification |
|---|---|---|
| New long-lived abstraction | **No** | `glossaryClient.ts` is a new *instance* of the existing singleton-fetcher abstraction locked by `themeClient.ts` (WP-055). Same module-scope `_promise` pattern, same `devLog` instrumentation, same non-blocking fallback. No new abstraction type. |
| New code category | **No** | Every new file lands in a pre-classified directory (see Pre-Session Gate 7). Zero D-entries for directory classification. |
| New contract consumed by future WPs | **No** | `KeywordGlossary` / `RuleGlossary` type aliases are viewer-local; only `useRules.ts`, `useGlossary.ts`, `App.vue`, and `glossaryClient.ts` reference them. No cross-package consumer. |
| New setup artifact in `G` | **No** | Zero engine involvement. |

**Conclusion:** 01.6 post-mortem is **NOT REQUIRED**. Matches WP-055 theme data-migration precedent.

If execution surfaces a genuinely new abstraction introduced mid-session (e.g., a new lint rule or a new public export pattern), re-evaluate and author a post-mortem at that point.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (authoritative reference); viewer may import `registry`, Vue, Zod, UI framework; must NOT import `game-engine`, `preplan`, `server`, `pg`, `boardgame.io`
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — full-sentence error messages; no abbreviations; ESM only; `.test.ts` extension only; no `.reduce()` for multi-step logic
4. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Registry Layer (Data Input) — glossary JSON is registry-metadata-class data; §Layer Boundary (Authoritative) — viewer is layer-isolated
5. [docs/ai/execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md](../execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Required `// why:` Comments + Files to Produce + After Completing + Common Failure Smells)
6. [docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md](../work-packets/WP-060-keyword-rule-glossary-data.md) — authoritative WP specification as amended 2026-04-20
7. [docs/ai/session-context/session-context-wp060.md](../session-context/session-context-wp060.md) — bridge from WP-058 closure (`00687c5`); baselines, quarantine state, inherited dirty-tree map, R2-upload discipline precedents, `lookupKeyword` enhancement note
8. [docs/ai/invocations/preflight-wp060-keyword-rule-glossary-data.md](preflight-wp060-keyword-rule-glossary-data.md) — READY TO EXECUTE verdict + copilot-check 30/30 PASS + resolution log
9. [docs/ai/DECISIONS.md](../DECISIONS.md) — seven new entries will be added in Commit A per WP §Governance (see §Locked Values below)
10. [apps/registry-viewer/CLAUDE.md](../../../apps/registry-viewer/CLAUDE.md) — viewer architecture + current glossary flow (pre-migration state)
11. [apps/registry-viewer/src/lib/themeClient.ts](../../../apps/registry-viewer/src/lib/themeClient.ts) — **canonical singleton-fetcher precedent** (lines 49–113). `glossaryClient.ts` mirrors this verbatim in structure
12. [apps/registry-viewer/src/composables/useRules.ts](../../../apps/registry-viewer/src/composables/useRules.ts) — pre-migration source of truth; lines 319–361 (`lookupKeyword`) and 369–381 (`lookupRule`) are the preserved-verbatim algorithms
13. [apps/registry-viewer/src/composables/useGlossary.ts](../../../apps/registry-viewer/src/composables/useGlossary.ts) — pre-migration module-eval entry list build; the target of the viewer 01.5 analog scope expansion
14. [apps/registry-viewer/src/App.vue](../../../apps/registry-viewer/src/App.vue) — lines 142–177 (`onMounted`); lines 158–166 (`getThemes` non-blocking pattern) is the mirror for the new glossary-load block
15. [docs/ai/REFERENCE/01.4-pre-flight-invocation.md](../REFERENCE/01.4-pre-flight-invocation.md) §Established Patterns + §Precedent Log — discipline inherited
16. [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md) — 30-issue lens; CONFIRM disposition for this session

If any conflict, higher-authority documents win. WP and EC are subordinate to `ARCHITECTURE.md` and `.claude/rules/*.md`.

---

## Goal (Binary)

After this session, the registry viewer fetches its keyword and rule glossary data from R2 at startup instead of bundling hardcoded definitions. Specifically:

1. **`data/metadata/keywords-full.json`** exists with 113 entries of shape `{ key: string; description: string }`, alphabetical by `key`, token markup preserved verbatim.
2. **`data/metadata/rules-full.json`** exists with 20 entries of shape `{ key: string; label: string; summary: string }`, alphabetical by `key`, token markup preserved verbatim.
3. **Both JSON files uploaded to R2** at `images.barefootbetters.com/metadata/keywords-full.json` and `.../rules-full.json`; `curl -sI` returns HTTP/2 200 from both URLs.
4. **`apps/registry-viewer/src/lib/glossaryClient.ts`** exists with `KeywordGlossary` / `RuleGlossary` type aliases, `getKeywordGlossary(metadataBaseUrl)` / `getRuleGlossary(metadataBaseUrl)` / `resetGlossaries()` exports, singleton-cached promises mirroring `themeClient.ts:49–113` verbatim in structure, `devLog("glossary", ...)` instrumented.
5. **`apps/registry-viewer/src/composables/useRules.ts`** no longer contains hardcoded `KEYWORD_GLOSSARY` / `RULES_GLOSSARY` Map bodies; `HERO_CLASS_GLOSSARY` (5 entries) preserved verbatim; `RuleEntry`, `parseAbilityText`, `lookupHeroClass`, `AbilityToken`, `TokenType` preserved verbatim; `lookupKeyword` and `lookupRule` bodies preserved byte-for-byte with only the backing-Map source retargeted to module-scope holders; new `setGlossaries(keywords, rules)` exported setter.
6. **`apps/registry-viewer/src/composables/useGlossary.ts`** has `allEntries` as reactive `ref<GlossaryEntry[]>([])`; new exported `rebuildGlossaryEntries()` called once from `App.vue` after the async fetch resolves.
7. **`apps/registry-viewer/src/App.vue`** has one glossary-load block added inside the existing `onMounted` try, parallel to the `getThemes()` block, with `console.warn("[Glossary] Load failed (non-blocking):", ...)` fallback.
8. **`apps/registry-viewer/CLAUDE.md`** updated — "Keyword & Rule Glossary" section rewritten from "hardcoded" to "fetched from R2"; "Architecture & Data Flow" block adds `getKeywordGlossary()` + `getRuleGlossary()` alongside `getThemes()`; "Key Files" table gains `glossaryClient.ts`.
9. **`docs/03.1-DATA-SOURCES.md`** §Registry Metadata Files table adds two rows (`keywords-full.json` / `rules-full.json`).
10. **`docs/ai/DECISIONS.md`** updated with seven new entries per WP §Governance.
11. **Engine baseline unchanged: 436 / 109 / 0 fail.** Repo-wide baseline: 588 / 0 fail preserved. Zero engine code modified. Zero `G` touched. Zero `boardgame.io` import added to the viewer.
12. **Governance closed:** `WORK_INDEX.md` flips WP-060 `[ ]` → `[x]` with date + Commit A hash (Commit B); `EC_INDEX.md` flips EC-106 Draft → Done (Commit B). `STATUS.md` update if it exists (verify in session).

No engine changes. No server changes. No arena-client changes. No preplan changes. No new npm dependencies. No `package.json` / `pnpm-lock.yaml` edits.

---

## Locked Values (Do Not Re-Derive)

All Locked Values below are copied verbatim from EC-106. Any divergence between this prompt and EC-106 is a prompt authoring bug — escalate and re-run copilot check rather than "work around."

### Commit & governance prefixes

- **EC / commit prefix:** `EC-106:` on code commits; `SPEC:` on governance/doc commits; `WP-060:` / `EC-060:` forbidden (P6-36).
- **Three-commit topology:**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: new EC-106 file + EC_INDEX row + WP-060 amendments + pre-flight file + copilot-check appendix + this session prompt. **Landed before Commit A.**
  - **Commit A (`EC-106:`)** — execution: 2 new JSONs + `glossaryClient.ts` + modified `useRules.ts` / `useGlossary.ts` / `App.vue` / viewer `CLAUDE.md` + `docs/03.1-DATA-SOURCES.md` + DECISIONS.md entries.
  - **Commit B (`SPEC:`)** — governance close: `WORK_INDEX.md` (WP-060 `[ ]` → `[x]` with date + Commit A hash) + `EC_INDEX.md` (EC-106 Draft → Done) + `STATUS.md` if it exists.

### JSON file shapes — exact

`data/metadata/keywords-full.json`:

```json
[
  { "key": "abomination", "description": "..." },
  { "key": "ambush", "description": "..." }
]
```

- Entry type: `Array<{ key: string; description: string }>`.
- Entries sorted alphabetically by `key` ascending (JavaScript default `Array.sort` / `String.prototype.localeCompare`).
- Entry count = `KEYWORD_GLOSSARY.size` (113 at pre-flight; re-derive at execution time per Pre-Session Gate 4).
- Token markup (`[icon:X]`, `[hc:X]`, `[keyword:N]`, `[rule:N]`), smart quotes (`\u201c` / `\u201d`), and all escape characters preserved verbatim.

`data/metadata/rules-full.json`:

```json
[
  { "key": "additional mastermind", "label": "Additional Mastermind", "summary": "..." },
  { "key": "adaptingmasterminds", "label": "Adapting Masterminds", "summary": "..." }
]
```

- Entry type: `Array<{ key: string; label: string; summary: string }>`.
- Entries sorted alphabetically by `key` ascending (space `\u0020` sorts before lowercase letters in byte order; `"additional mastermind"` precedes `"adaptingmasterminds"`).
- Entry count = `RULES_GLOSSARY.size` (20 at pre-flight).
- Token markup preserved verbatim.
- `label` preserves the exact Title-Case / punctuation of the current `RuleEntry.label` values.

**Authoring approach:** serialize programmatically from the live Map via a one-shot Node script (`node --input-type=module -e "..."`) that reads `useRules.ts` as text and parses entries, or — simpler — a temporary `process` inside the first migration step that `import`s the current `useRules.ts` exports, converts them to the target shape, sorts, and writes both files. Do **not** hand-transcribe — the risk of dropping a smart-quote or a token is too high.

### `glossaryClient.ts` public API — exact shape

File: `apps/registry-viewer/src/lib/glossaryClient.ts` (new)

```ts
import type { RuleEntry } from "../composables/useRules";

export type KeywordGlossary = Map<string, string>;
export type RuleGlossary    = Map<string, RuleEntry>;

export function getKeywordGlossary(metadataBaseUrl: string): Promise<KeywordGlossary>;
export function getRuleGlossary(metadataBaseUrl: string): Promise<RuleGlossary>;
export function resetGlossaries(): void;
```

Internal structure mirrors `themeClient.ts:49–113` verbatim:

- Module-scope `_keywordPromise: Promise<KeywordGlossary> | null = null`
- Module-scope `_rulePromise: Promise<RuleGlossary> | null = null`
- Both accessors: early-return cached promise; otherwise build IIFE-style async body; on failure throw so caller `App.vue` can `console.warn`.
- `devLog("glossary", "load start", { baseUrl })` on entry.
- `devLog("glossary", "load complete", { baseUrl, durationMs, entryCount })` on success.
- `devLog("glossary", "load failed", { baseUrl, durationMs, message })` on catch before re-throwing.
- `resetGlossaries()` nulls both promises.

Fetched URLs:
- `${metadataBaseUrl}/metadata/keywords-full.json`
- `${metadataBaseUrl}/metadata/rules-full.json`

Body parse:
```ts
const entries = (await response.json()) as Array<{ key: string; description: string }>;
const map: KeywordGlossary = new Map(entries.map((e) => [e.key, e.description]));
```
(rule variant: `entries.map((e) => [e.key, { label: e.label, summary: e.summary }])`).

No Zod validation. No defensive shape-guards beyond `response.ok`. Consistent with `themeClient.ts` precedent.

### `useRules.ts` retargeting — exact contract

**Removed:** the bodies of `export const KEYWORD_GLOSSARY: Map<string, string> = new Map([...])` (lines 111–225 at pre-flight) and `export const RULES_GLOSSARY: Map<string, RuleEntry> = new Map([...])` (lines 23–105 at pre-flight). Remove the entire `new Map([...])` literal and its `export const` declaration.

**Preserved verbatim:**
- Header JSDoc (lines 1–14) — update the comment body to describe the new R2-fetched source, but keep the file-purpose framing.
- `export interface RuleEntry` (lines 16–19).
- `export const HERO_CLASS_GLOSSARY: Map<string, string>` (lines 230–236).
- `export function lookupHeroClass` (lines 242–244).
- `export type TokenType` (line 247).
- `export interface AbilityToken` (lines 249–253).
- `export function parseAbilityText` (lines 268–307).
- `export function lookupKeyword` body (lines 319–361) — **byte-for-byte**, with only the identifier `KEYWORD_GLOSSARY` replaced with the new module-scope holder name. Every `// why:` comment preserved.
- `export function lookupRule` body (lines 369–381) — byte-for-byte, with only the identifier `RULES_GLOSSARY` replaced with the new module-scope holder name. Every `// why:` comment preserved.

**Added:**

```ts
// why: Populated by setGlossaries() at App.vue mount. Before the fetch
// resolves, these are null and lookupKeyword/lookupRule return null,
// which callers (CardDetail.vue, useGlossary.ts) already handle via
// tooltip-absent paths. This matches the non-blocking fetch guardrail.
let _keywordGlossary: Map<string, string> | null = null;
let _ruleGlossary:    Map<string, RuleEntry>    | null = null;

export function setGlossaries(
  keywords: Map<string, string>,
  rules:    Map<string, RuleEntry>,
): void {
  _keywordGlossary = keywords;
  _ruleGlossary    = rules;
}
```

The two holder names (`_keywordGlossary`, `_ruleGlossary`) are the identifiers that replace `KEYWORD_GLOSSARY` / `RULES_GLOSSARY` inside the preserved `lookupKeyword` / `lookupRule` bodies. Each `.has()` / `.get()` / `.keys()` / `for (const [key, entry] of ...)` call site must null-check first:

```ts
// In lookupKeyword (preserved body, null-guarded source):
if (_keywordGlossary === null) return null;
const lower = name.toLowerCase();
if (_keywordGlossary.has(lower)) return _keywordGlossary.get(lower)!;
// ...rest of the algorithm preserved verbatim, substituting _keywordGlossary for KEYWORD_GLOSSARY
```

```ts
// In lookupRule (preserved body, null-guarded source):
export function lookupRule(code: string): RuleEntry | null {
  if (_ruleGlossary === null) return null;
  const normalizedCode = code.toLowerCase().replace(/\s+/g, "");
  if (_ruleGlossary.has(code.toLowerCase())) {
    return _ruleGlossary.get(code.toLowerCase()) ?? null;
  }
  for (const [key, entry] of _ruleGlossary) {
    if (key.replace(/\s+/g, "") === normalizedCode) {
      return entry;
    }
  }
  return null;
}
```

The null-guard is the **only** logical addition. Every other line of both function bodies must be identical to the pre-migration version except for the identifier substitution.

### `useGlossary.ts` reactive rebuild — exact shape

Replace current line 101 (`const allEntries = buildAllEntries();`) with:

```ts
const allEntries = ref<GlossaryEntry[]>([]);

// why: Called once from App.vue after the async glossary fetch resolves.
// Before this call, allEntries.value is [], filteredEntries yields [],
// and the panel shows no entries — matching the non-blocking fetch
// guardrail. Vue reactivity propagates the reassignment to filteredEntries
// and any downstream v-for.
export function rebuildGlossaryEntries(): void {
  allEntries.value = buildAllEntries();
}
```

Import `ref` from `"vue"` if not already imported. `filteredEntries` remains a `computed` over `allEntries` — no change.

`openToKeyword` / `openToRule` already early-return on null lookup results (lines 154, 174); no change needed — they gracefully no-op before the fetch resolves.

The `// why: some keywords appear twice in the map (villainousweapons). Skip duplicates.` check at lines 47–49 stays verbatim.

### `App.vue` onMounted wiring — exact shape

Inside the existing `try` block in `onMounted` (lines 142–177), parallel to the `getThemes()` block at lines 158–166, add:

```ts
// why: Parallel to getThemes() above — glossary fetch is non-blocking.
// If R2 is unreachable or the JSON files are missing, console.warn and
// continue; tooltips will be absent but the card view remains functional.
// This mirrors EC-106 Locked Values (App.vue onMounted wiring) and the
// themeClient.ts precedent locked by WP-055.
loadStatus.value = "Loading glossary…";
try {
  const [keywords, rules] = await Promise.all([
    getKeywordGlossary(metadataBaseUrl),
    getRuleGlossary(metadataBaseUrl),
  ]);
  setGlossaries(keywords, rules);
  rebuildGlossaryEntries();
} catch (glossaryError) {
  console.warn("[Glossary] Load failed (non-blocking):", glossaryError);
}
```

Imports to add to `App.vue` `<script setup lang="ts">`:
```ts
import { getKeywordGlossary, getRuleGlossary } from "./lib/glossaryClient";
import { setGlossaries } from "./composables/useRules";
import { rebuildGlossaryEntries } from "./composables/useGlossary";
```

No other `App.vue` edit is permitted.

### Governance — DECISIONS.md entries (seven new)

Add to `docs/ai/DECISIONS.md` under a new heading referencing WP-060 / EC-106:

1. Keyword and rule glossary data is display-only content, not a validated contract — no Zod schema required.
2. Glossary data lives in `data/metadata/` (same directory as sets, hero-classes, hero-teams, etc.).
3. Glossary data is served from R2 alongside card and theme data at `images.barefootbetters.com/metadata/`.
4. `[keyword:N]` numeric references in definition text refer to keyword IDs in the same file; the registry viewer resolves these at render time via `parseAbilityText`.
5. Hero class descriptions (Covert, Instinct, Ranged, Strength, Tech) remain hardcoded in `useRules.ts` (5 entries) because they are not present in any external or R2 glossary artifact and are stable engine-class labels.
6. Canonical baseline for the migration is the hardcoded `KEYWORD_GLOSSARY` (113) / `RULES_GLOSSARY` (20) Maps in `useRules.ts`, not the upstream `modern-master-strike` JSON files (102 / 18) the Maps diverged from.
7. `useGlossary.ts` scope expansion (reactive `allEntries` rebuild after fetch) is authorized under the viewer analog of `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — dependency-driven wiring only, no new behavior; and `lookupKeyword` / `lookupRule` algorithmic bodies are locked — only the backing Map source changes in this migration.

Entries #6 and #7 may be combined into one decision or kept as two depending on the existing DECISIONS.md granularity convention — preserve precedent formatting.

### Test baselines

- **Registry, vue-sfc-loader, game-engine, server, replay-producer, preplan, arena-client:** all unchanged.
- **Repo-wide:** `588 passing / 0 failing` → **`588 passing / 0 failing`** (zero new tests required; adding optional tests for `glossaryClient.ts` is permitted but not required — see EC-106 §Test Expectations).
- **Engine:** `436 / 109 / 0 fail` UNCHANGED (WP-060 touches no engine code).

If the executor adds optional tests for `glossaryClient.ts`, the arena-client / registry-viewer packages are unaffected; the viewer has no `node:test` runner wired today, so such tests would require `vue-sfc-loader` scaffolding that WP-060 explicitly disallows (EC-106 §Out of Scope: "No new test infrastructure"). **Conclusion: no unit tests are authored in this session.** The algorithm preservation invariant is verified by grep (Verification Step 10) + manual smoke (step 13c).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` (N/A here; no runtime code uses it)
- Never throw inside viewer runtime paths — return `null` / use `console.warn` fallback
- Never persist `G` or `ctx` — N/A (zero engine involvement)
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (none needed for WP-060 — the viewer uses `fetch`, not `node:fs`)
- Test files use `.test.ts` extension — never `.test.mjs` (N/A — no new tests authored)
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Viewer-layer only** — new files live in `apps/registry-viewer/src/lib/` or `apps/registry-viewer/src/composables/` or `data/metadata/` only
- **No engine imports** — zero imports from `packages/game-engine/`; grep-verified with escaped dot pattern per P6-22
- **No boardgame.io imports** — zero imports of `boardgame.io`; grep-verified (`from ['"]boardgame\.io`)
- **No preplan / server / arena-client / replay-producer / vue-sfc-loader imports** — layer-isolated
- **No `pg` imports** — N/A (viewer does not touch the database)
- **No `require()`** in any generated file — grep-verified
- **No `.reduce()`** in migration output or lookup function bodies — grep-verified
- **No `Zod` schema** for glossary JSON — WP §Scope (Out) forbids it; consistent with `themeClient.ts` precedent
- **No modification of `HERO_CLASS_GLOSSARY`** — preserved verbatim
- **No modification to `lookupKeyword` / `lookupRule` algorithmic bodies** — only backing-Map source changes
- **No modification to public contract surface** (`lookupKeyword` / `lookupRule` / `lookupHeroClass` / `parseAbilityText` / `RuleEntry` / `AbilityToken` / `TokenType` signatures all preserved)
- **No new test infrastructure** — no `vue-sfc-loader` wiring, no `jsdom` setup
- **No token markup transformation** inside migrated JSON — `[icon:X]`, `[hc:X]`, `[keyword:N]`, `[rule:N]` preserved verbatim
- **No staging of inherited dirty-tree items** — stage by exact filename; `git add .` / `-A` / `-u` forbidden
- **No popping of `stash@{0..2}`** — quarantined
- **No `--no-verify`** or `--no-gpg-sign` — commit-msg hook must pass on merits
- **No push to remote** — WP-055/056/057/058 all stayed local; WP-060 follows suit

**Paraphrase discipline (P6-43, P6-50):** `// why:` comments in viewer files may mention Vue reactivity concepts (`ref`, `computed`, `onMounted`) since that's the runtime; but must avoid `G`, `ctx`, `boardgame.io`, `LegendaryGameState`, `LegendaryGame`, `Math.random`, `Date.now`, `performance.now` tokens. The engine-token embargo holds.

**Session protocol:**
- If any contract, field name, or reference seems unclear, STOP and ask — never guess
- Reality-reconciliation at every Locked Value reference: cross-check against the current `useRules.ts`, `themeClient.ts`, `App.vue`, and `useGlossary.ts` before writing code that names them
- If the Pre-Session Gate 4 count probe returns anything other than `RULES_GLOSSARY=20, KEYWORD_GLOSSARY=113, HERO_CLASS_GLOSSARY=5`, STOP and re-anchor

---

## Files Expected to Change (Strict Allowlist)

Commit A (`EC-106:`) may modify ONLY the following files. Anything outside is a scope violation per P6-27.

### New files (3)

1. `data/metadata/keywords-full.json` — 113 keyword entries, alphabetical by `key`
2. `data/metadata/rules-full.json` — 20 rule entries, alphabetical by `key`
3. `apps/registry-viewer/src/lib/glossaryClient.ts` — singleton fetcher per §Locked Values

### Modified files (6)

4. `apps/registry-viewer/src/composables/useRules.ts` — remove `KEYWORD_GLOSSARY` / `RULES_GLOSSARY` Map bodies; add `_keywordGlossary` / `_ruleGlossary` module-scope holders + `setGlossaries` export; retarget `lookupKeyword` / `lookupRule` to holders with null-guard and byte-for-byte algorithm preservation; keep everything else verbatim
5. `apps/registry-viewer/src/composables/useGlossary.ts` — convert `allEntries` to `ref<GlossaryEntry[]>([])`; export `rebuildGlossaryEntries()`; import `ref` from `"vue"` if not already imported
6. `apps/registry-viewer/src/App.vue` — add glossary-load block inside existing `onMounted` try, per §Locked Values; add three imports
7. `apps/registry-viewer/CLAUDE.md` — update "Keyword & Rule Glossary" section + "Architecture & Data Flow" block + "Key Files" table
8. `docs/03.1-DATA-SOURCES.md` — §Registry Metadata Files table gains two rows
9. `docs/ai/DECISIONS.md` — seven new entries per WP §Governance

### Commit B (`SPEC:` governance close) modifies

10. `docs/ai/work-packets/WORK_INDEX.md` — flip WP-060 `[ ]` → `[x]` with date + Commit A hash
11. `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-106 Draft → Done; bump `Last updated:` footer only if convention requires (read the recent precedents in the file first; EC-055 / EC-071 / EC-074 all wrote new close-footer blocks)
12. `docs/STATUS.md` — add execution entry IF THE FILE EXISTS (current `git status` shows no `docs/STATUS.md`; session context line 167 references it but file-existence was not verified in pre-flight — check at Commit B time)

### Forbidden files (scope-violation tripwire)

- Any file under `packages/game-engine/**` — layer boundary violation
- Any file under `packages/preplan/**` — layer boundary violation
- Any file under `packages/registry/**` — out of scope (the registry package does not touch glossary data)
- Any file under `packages/vue-sfc-loader/**` — out of scope
- Any file under `apps/server/**` — layer boundary violation
- Any file under `apps/arena-client/**` — out of scope
- Any file under `apps/replay-producer/**` — out of scope
- Any file under `content/themes/**` — WP-055's scope
- Any new `*.mjs` / `*.ts` script under `scripts/` — WP-060 ships data + viewer code only, no new CLI tooling
- Any `package.json` edit — no new npm dependencies
- Any `pnpm-lock.yaml` edit — follows from the above (P6-44)
- `apps/registry-viewer/src/components/CardDetail.vue` / `GlossaryPanel.vue` / any other `.vue` file except `App.vue` — preserved by the contract-surface lock (they import only the preserved lookup functions and types)

---

## Required `// why:` Comments (Verbatim Placement)

### In `glossaryClient.ts`

- On the module-scope `_keywordPromise` / `_rulePromise` holders: "Singleton cache prevents duplicate R2 fetches within a session" (mirror `themeClient.ts:51` pattern).
- On the non-blocking throw inside each IIFE: "Throw here so the App.vue caller can `console.warn` + continue" (mirror `themeClient.ts:105`).

### In `useRules.ts`

- On `_keywordGlossary` / `_ruleGlossary` module-scope holders: "Populated by setGlossaries() at App.vue mount. Before the fetch resolves, these are null and lookupKeyword/lookupRule return null, which callers already handle via tooltip-absent paths."
- **Preserve verbatim** every existing `// why:` comment in `lookupKeyword` (lines 321, 324, 329–332, 345, 354–355 at pre-flight) and `lookupRule`.
- Update the file-level JSDoc (lines 1–14) to reflect that `KEYWORD_GLOSSARY` / `RULES_GLOSSARY` are now fetched from R2 via `glossaryClient.ts` — concise one-sentence update, preserve the "Two lookup sources" framing.

### In `useGlossary.ts`

- On `rebuildGlossaryEntries()`: "Called once from App.vue after the async glossary fetch resolves. Before this call, allEntries.value is [], filteredEntries yields [], and the panel shows no entries — matching the non-blocking fetch guardrail. Vue reactivity propagates the reassignment to filteredEntries and any downstream v-for."
- Preserve the existing `// why: some keywords appear twice in the map (villainousweapons). Skip duplicates.` comment at lines 47–49 verbatim.

### In `App.vue`

- On the new glossary-load block: "Parallel to getThemes() above — glossary fetch is non-blocking. If R2 is unreachable or the JSON files are missing, console.warn and continue; tooltips will be absent but the card view remains functional."

---

## Implementation Task Sequence (Strict Order)

Each task must complete before the next begins. Do not reorder. Do not skip.

**Task 1 — Verify starting baseline.** Pre-Session Gate 3 test baseline check: `pnpm -r --if-present test` returns 588/0. Pre-Session Gate 4 count probe returns `RULES_GLOSSARY=20, KEYWORD_GLOSSARY=113, HERO_CLASS_GLOSSARY=5`. If either probe diverges, STOP.

**Task 2 — Read the anchors.** Open and read:
- `apps/registry-viewer/src/lib/themeClient.ts` (the canonical singleton-fetcher pattern)
- `apps/registry-viewer/src/composables/useRules.ts` (the pre-migration source of truth; note line 319–361 for `lookupKeyword` and 369–381 for `lookupRule`)
- `apps/registry-viewer/src/composables/useGlossary.ts` (the reactive-rebuild target; note lines 101 `allEntries` binding, 47–49 dedup, 154 and 174 null-return branches)
- `apps/registry-viewer/src/App.vue` (lines 142–177 `onMounted`; lines 158–166 `getThemes` pattern to mirror)
- `apps/registry-viewer/src/lib/devLog.ts` (confirm the `Category` union — `"glossary"` may need to be added; if it is strictly typed, extend it with one line; if loosely typed as `string`, no edit needed)

If any read produces a surprise (different line numbers due to unrelated recent edits, or an unexpected dedup convention), STOP and reconcile.

**Task 3 — Author `data/metadata/keywords-full.json`.** Serialize `KEYWORD_GLOSSARY` programmatically using a throwaway Node invocation. Sort alphabetically by `key`. Preserve every smart quote (`\u201c` / `\u201d`) and every token-markup bracket verbatim.

**Task 4 — Author `data/metadata/rules-full.json`.** Same approach for `RULES_GLOSSARY`. Preserve `label` and `summary` exactly.

**Task 5 — Author `apps/registry-viewer/src/lib/glossaryClient.ts`.** Copy the structure of `themeClient.ts` verbatim; adjust the URL path, the body-parse shape, and the cache variable names. Add the two required `// why:` comments. Grep-verify: `grep -E "from ['\"](@legendary-arena/game-engine|boardgame\.io)" apps/registry-viewer/src/lib/glossaryClient.ts` returns no output.

**Task 6 — Modify `apps/registry-viewer/src/composables/useRules.ts`.** Remove the two Map literal bodies. Add module-scope holders + `setGlossaries` setter + the required `// why:` on the holders. Substitute `_keywordGlossary` for `KEYWORD_GLOSSARY` and `_ruleGlossary` for `RULES_GLOSSARY` inside the preserved `lookupKeyword` / `lookupRule` bodies, adding a null-guard at the top of each function. Preserve every existing `// why:` comment verbatim. Update the file-level JSDoc to reflect the R2 source. Grep-verify: `grep -c "^export const KEYWORD_GLOSSARY\|^export const RULES_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts` returns 0; `grep -c "^export const HERO_CLASS_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts` returns 1; `grep -cE "(Suffix match|Substring match|Prefix match)" apps/registry-viewer/src/composables/useRules.ts` returns ≥ 3 (algorithm preservation).

**Task 7 — Modify `apps/registry-viewer/src/composables/useGlossary.ts`.** Replace line 101 with the reactive `ref<GlossaryEntry[]>([])` binding. Export `rebuildGlossaryEntries()`. Add the required `// why:` comment. Import `ref` from `"vue"` if not present. Grep-verify: `grep "from \"vue\"" apps/registry-viewer/src/composables/useGlossary.ts` returns a `ref`-containing import.

**Task 8 — Modify `apps/registry-viewer/src/App.vue`.** Add three imports (see §Locked Values). Add the glossary-load block inside the existing `onMounted` try, immediately after the themes-load block. Add the required `// why:` comment. Verify: no other part of `App.vue` was modified.

**Task 9 — Upload JSON files to R2.** This is an operator-step, not a `git` action. Use your R2 upload tooling (credentials from local config — **not from the repo**). Upload:
- `data/metadata/keywords-full.json` → `images.barefootbetters.com/metadata/keywords-full.json`
- `data/metadata/rules-full.json` → `images.barefootbetters.com/metadata/rules-full.json`

Verify via `curl -sI`:
```bash
curl -sI https://images.barefootbetters.com/metadata/keywords-full.json | head -1
curl -sI https://images.barefootbetters.com/metadata/rules-full.json | head -1
```
Both must return `HTTP/2 200`. If authentication fails, **STOP and escalate** — do NOT commit the code changes without matching R2 artifacts.

**Task 10 — Update `apps/registry-viewer/CLAUDE.md`.** Rewrite the "Keyword & Rule Glossary" section from the current "hardcoded" narrative to "fetched from R2 via `glossaryClient.ts` at startup; non-blocking fallback to empty tooltips on failure." Extend the "Architecture & Data Flow" block to list `getKeywordGlossary()` + `getRuleGlossary()` alongside `getThemes()`. Add `src/lib/glossaryClient.ts` to the "Key Files" table. Preserve the "Hero class tooltips ... stay hardcoded regardless of WP-060" note.

**Task 11 — Update `docs/03.1-DATA-SOURCES.md`.** Add two rows to the §Registry Metadata Files table matching the shape of `sets.json` / `card-types.json`:
- `keywords-full.json` | Keyword glossary definitions | 113 keywords | Consumed by registry-viewer at startup; not consumed by engine
- `rules-full.json` | Rule glossary definitions | 20 rules | Consumed by registry-viewer at startup; not consumed by engine

**Task 12 — Update `docs/ai/DECISIONS.md`.** Add the seven decisions enumerated in §Locked Values §Governance. Follow the existing DECISIONS.md heading convention (em-dash vs hyphen — per the P6-2 precedent, DECISIONS.md headings typically use em-dashes but WP/EC text uses regular hyphens; match whatever the existing file uses).

**Task 13 — Run the full verification suite.** See §Verification Steps below. All 12 steps must return expected output.

**Task 14 — Stage Commit A.** `git add` by filename only — the 9 Commit A files listed in §Files Expected to Change. Commit with `EC-106: <short title + short description>` matching the Commit A structure used by EC-055 / EC-071 / EC-074. Example: `EC-106: migrate keyword and rule glossary to R2; retarget useRules + useGlossary`.

**Task 15 — Author Commit B governance close.** Update `docs/ai/work-packets/WORK_INDEX.md` (flip WP-060 `[ ]` → `[x]` with today's date + Commit A hash) and `docs/ai/execution-checklists/EC_INDEX.md` (EC-106 Draft → Done; write close-footer per convention). If `docs/STATUS.md` exists, add an execution entry. Commit with `SPEC: close WP-060 / EC-106 governance`.

**Task 16 — Final green check.** `pnpm -r build && pnpm -r --if-present test` — expect 588/0 (unchanged) and engine 436/109/0 (unchanged). `git status --short` — expect clean tree except for the 11 inherited quarantine items (plus any mystery untracked file flagged in the execution summary) and `stash@{0..2}` untouched.

---

## Verification Steps (Every Step Must Return Expected Output)

Each of the following MUST be executed and pass before Definition of Done is checked.

```bash
# Step 1 — dependencies fresh
pnpm install --frozen-lockfile
# Expected: no changes to pnpm-lock.yaml

# Step 2 — typecheck
pnpm --filter registry-viewer typecheck
# Expected: exits 0

# Step 3 — lint (inherits EC-105 warning budget)
pnpm --filter registry-viewer lint
# Expected: 0 errors; warnings ≤ 180

# Step 4 — build (all packages)
pnpm -r build
# Expected: exits 0

# Step 5 — test baseline preserved
pnpm -r --if-present test
# Expected: 588 passing / 0 failing; engine 436/109/0 UNCHANGED

# Step 6 — JSON entry counts match in-code Map sizes
node -e "console.log(JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8')).length)"
# Expected: 113
node -e "console.log(JSON.parse(require('fs').readFileSync('data/metadata/rules-full.json','utf8')).length)"
# Expected: 20

# Step 7 — JSON entries sorted alphabetically by key
node -e "const k=JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8')); const s=[...k].sort((a,b)=>a.key.localeCompare(b.key)); console.log(JSON.stringify(k)===JSON.stringify(s)?'OK':'FAIL')"
# Expected: OK
node -e "const r=JSON.parse(require('fs').readFileSync('data/metadata/rules-full.json','utf8')); const s=[...r].sort((a,b)=>a.key.localeCompare(b.key)); console.log(JSON.stringify(r)===JSON.stringify(s)?'OK':'FAIL')"
# Expected: OK

# Step 8 — no engine / preplan / boardgame.io imports in new viewer file
grep -E "from ['\"](@legendary-arena/(game-engine|preplan|server)|boardgame\.io)" apps/registry-viewer/src/lib/glossaryClient.ts
# Expected: no output

# Step 9 — Map bodies removed; HERO_CLASS preserved
grep -c "^export const KEYWORD_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts
# Expected: 0
grep -c "^export const RULES_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts
# Expected: 0
grep -c "^export const HERO_CLASS_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts
# Expected: 1

# Step 10 — lookupKeyword enhanced matching preserved (byte-for-byte check via branch-comment markers)
grep -cE "(Suffix match|Substring match|Prefix match)" apps/registry-viewer/src/composables/useRules.ts
# Expected: >= 3 (one comment per matching branch)

# Step 11 — R2 upload verified (run after Task 9 operator-step upload)
curl -sI https://images.barefootbetters.com/metadata/keywords-full.json | head -1
# Expected: HTTP/2 200
curl -sI https://images.barefootbetters.com/metadata/rules-full.json | head -1
# Expected: HTTP/2 200

# Step 12 — only allowlisted files modified
git diff --name-only HEAD
# Expected: only the 9 Commit A files (plus the 3 Commit B files after Task 15)
```

### Manual DEV smoke test (step 13)

```bash
pnpm --filter registry-viewer dev
```

- 13a. Visit `http://localhost:5173/`. Open DevTools console.
      Expect: `[glossary] load start { baseUrl: "https://images.barefootbetters.com" }` → `[glossary] load complete { baseUrl: "...", durationMs: N, entryCount: 113 }` (and one analogous pair for rules with entryCount: 20).
- 13b. Open any hero card with tokenized ability text. Hover a `[keyword:Berserk]` badge → tooltip shows Berserk definition.
- 13c. **Modifier-keyword regression smoke (critical).** Open a card whose ability text includes at least one of: "Ultimate Abomination", "Double Striker", "Triple Empowered", "Focus 2", "Patrol the Bank", "Danger Sense 3", "Cross-Dimensional Hulk Rampage". Hover each keyword → tooltip shows the correct definition. **Failure here means `lookupKeyword` algorithm regression — STOP and revert.**
- 13d. Hover a `[rule:shards]` badge → tooltip shows Shards rule.
- 13e. Hover `[hc:covert]` / `[hc:instinct]` / `[hc:ranged]` / `[hc:strength]` / `[hc:tech]` → tooltips show (hero class data still hardcoded).
- 13f. Open glossary panel (Ctrl+K). Entry count: **138 total = 20 rules + 113 keywords + 5 hero classes**. Ordering: rules first (alphabetical), then keywords, then hero classes — matches pre-migration.
- 13g. (Negative test) Edit `public/registry-config.json` temporarily to use a bad `metadataBaseUrl`. Reload. Expect: `console.warn("[Glossary] Load failed (non-blocking): ...")` AND the app still renders cards without throwing. Revert the config edit.

### Manual PROD smoke test (step 14)

```bash
pnpm --filter registry-viewer build
pnpm --filter registry-viewer preview
```

- 14a. Visit `http://localhost:4173/`. Repeat steps 13a–13f against the production bundle. All must pass.
- 14b. DevTools → Network → confirm exactly two glossary fetches: `keywords-full.json` and `rules-full.json`. No duplicate fetches (singleton pattern honoured).
- 14c. DevTools → Network → confirm both JSON fetches return HTTP 200 with the expected file sizes.

Any step producing unexpected output is a **blocking finding**. Do not proceed to Commit A without all 12 command-steps passing and the 13a–14c manual smoke tests passing.

---

## Definition of Done

Every item must be true before WP-060 is marked complete:

- [ ] All Verification Steps 1–12 pass
- [ ] Manual DEV smoke 13a–13g passes
- [ ] Manual PROD smoke 14a–14c passes
- [ ] Modifier-keyword tooltip test (13c) passes — confirms `lookupKeyword` algorithm preserved byte-for-byte
- [ ] `data/metadata/keywords-full.json` + `data/metadata/rules-full.json` exist on disk AND on R2 (HTTP 200 from both URLs)
- [ ] `apps/registry-viewer/src/lib/glossaryClient.ts` exists with public API per §Locked Values
- [ ] `useRules.ts` no longer contains `KEYWORD_GLOSSARY` / `RULES_GLOSSARY` Map bodies; `HERO_CLASS_GLOSSARY` verbatim; all existing `// why:` comments preserved
- [ ] `useGlossary.ts` `allEntries` reactive; `rebuildGlossaryEntries` exported
- [ ] `App.vue` has the glossary-load block inside `onMounted`; three new imports present
- [ ] All new `// why:` comments per §Required Comments present
- [ ] `apps/registry-viewer/CLAUDE.md` updated
- [ ] `docs/03.1-DATA-SOURCES.md` §Registry Metadata updated with two new rows
- [ ] `docs/ai/DECISIONS.md` has all seven WP-060 / EC-106 governance decisions
- [ ] Engine baseline unchanged: 436/109/0 fail
- [ ] Repo-wide baseline: 588/0 fail (or adjusted if optional tests added and documented in summary)
- [ ] `stash@{0}`, `stash@{1}`, `stash@{2}` all intact (no pops)
- [ ] None of the 11 inherited dirty-tree items staged or committed
- [ ] Mystery untracked file (if any — `docs/ai/ideas/` per pre-flight note) flagged in execution summary but NOT touched
- [ ] Three-commit topology landed: A0 `SPEC:` (pre-flight bundle — assumed already landed) → A `EC-106:` (code + data + governance entries) → B `SPEC:` (WORK_INDEX + EC_INDEX + optional STATUS)
- [ ] No `--no-verify`, no `--no-gpg-sign`, no push to remote
- [ ] WORK_INDEX.md WP-060 flipped `[ ]` → `[x]` with date + Commit A hash (Commit B)
- [ ] EC_INDEX.md EC-106 status flipped Draft → Done (Commit B)

---

## Precedents Inherited (Cite In Execution Summary Where Applicable)

- **WP-055 / EC-055 — Theme Data Model:** canonical singleton-fetcher (`themeClient.ts`) precedent for `glossaryClient.ts`; non-blocking fetch + `console.warn` fallback pattern; registry-viewer-only layer discipline; bare-array JSON convention (no version wrapper).
- **P6-22 (WP-031):** escaped-dot grep patterns for `boardgame.io` — applied in Verification Step 8
- **P6-27 (WP-031):** stage-by-name only; never `git add .` / `git add -A` — applied throughout
- **P6-36 (WP-033):** `WP-NNN:` commit prefix forbidden; `EC-NNN:` required — applied to all WP-060 commits; `EC-060:` forbidden per slot-consumed-at-6a63b1c
- **P6-43 (WP-034) / P6-50 (WP-042):** paraphrase discipline — `// why:` comments in viewer files avoid engine tokens
- **P6-44 (WP-042):** `pnpm-lock.yaml` must not change when no `package.json` edited — applied in Verification Step 1
- **EC-slot retargeting (seven-row chain):** EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069, EC-063 → EC-071, EC-080 → EC-072, EC-079 → EC-073, EC-064 → EC-074, **EC-060 → EC-106** (this WP, first use of the registry-viewer 101+ series retargeting form)
- **WP-030 precedent (mystery untracked file):** `docs/ai/ideas/` appearance during pre-flight session — flag in execution summary, do not touch
- **WP-028 / D-2802 aliasing-prevention:** applied by analogy — `buildAllEntries()` constructs fresh `GlossaryEntry` objects; no shared-reference risk
- **WP-014A / D-1234 graceful-degradation:** non-blocking fetch returns empty Map; `lookupKeyword` / `lookupRule` return null; no crash

---

## Stop Conditions (Halt Execution, Escalate, Do NOT Force-Fit)

Stop and escalate if any of these occur during execution:

1. Pre-Session Gate 3 repo-wide test baseline at session start is NOT `588/0` — reconcile before proceeding.
2. Pre-Session Gate 4 count probe returns any value other than `RULES_GLOSSARY=20, KEYWORD_GLOSSARY=113, HERO_CLASS_GLOSSARY=5` — re-anchor the counts in Verification Steps and the new JSON files; if the drift exceeds ±3 entries, re-run pre-flight to confirm the amendments still match reality.
3. Task 9 R2 upload fails authentication — STOP; do NOT commit Task 3–8 code changes without the matching R2 artifacts (they would break tooltips in production without a rollback path).
4. Task 6 reveals that `lookupKeyword` or `lookupRule` in the current `useRules.ts` differ structurally from the pre-flight reading (e.g., a recent unrelated edit added a new matching branch) — STOP, update the algorithm-preservation lock in the session summary, and continue only after confirming the "preserved-verbatim" target is correct.
5. Verification Step 5 (test baseline) shifts from 588 / 0 — diagnose which test broke and whether the cause is in WP-060 scope. If the failing test is in `packages/game-engine/`, `packages/preplan/`, `apps/server/`, `apps/arena-client/`, or `apps/replay-producer/`, STOP — WP-060 cannot break unrelated packages.
6. Verification Step 10 grep count < 3 (algorithm preservation check) — the refactor accidentally dropped a matching branch. STOP and revert the `lookupKeyword` edit; re-apply with stricter preservation.
7. Manual smoke 13c reveals a modifier-keyword tooltip returning empty — same as #6, the algorithm regressed. STOP and revert.
8. Any file outside §Files Expected to Change appears in `git diff --name-only` — STOP and remove it from staging; do not commit out-of-allowlist edits.
9. A mystery untracked file beyond `docs/ai/ideas/` appears — flag in execution summary; do not touch during this session.
10. Any of `stash@{0..2}` gets popped accidentally — STOP and restore via `git stash push` of the conflicting changes, then re-stash the quarantined branch; escalate if the restore is non-trivial.

---

## Execution Summary Requirements

At the end of the execution session, produce a summary that:

1. Lists the Commit A hash and the nine files committed under it.
2. Lists the Commit B hash and the files committed under it.
3. States the repo-wide test baseline before and after (expected: 588 / 0 unchanged).
4. States the engine baseline before and after (expected: 436 / 109 / 0 unchanged).
5. Confirms R2 HTTP 200 on both JSON URLs (Step 11 output).
6. Confirms manual smoke 13a–14c all passed, explicitly including modifier-keyword smoke 13c.
7. Confirms all three `stash@{0..2}` intact.
8. Flags any mystery untracked file observed (e.g., `docs/ai/ideas/`) and confirms it was NOT touched.
9. Declares 01.6 post-mortem NOT TRIGGERED with the four-trigger evaluation.
10. Declares 01.5 runtime wiring allowance NOT INVOKED as an engine clause; viewer-scope analog cited for `useGlossary.ts` only.
11. Cites any `// why:` comment location that required more than one sentence (expected: none).
12. Notes the Pre-Session Gate 4 count probe values (must match `RULES_GLOSSARY=20, KEYWORD_GLOSSARY=113, HERO_CLASS_GLOSSARY=5`).

No post-mortem file is authored unless a trigger fires mid-session. If one does fire, author `docs/ai/post-mortems/01.6-WP-060-keyword-rule-glossary-data.md` and fold it into Commit A before staging.

---

## Final Authorization

This session prompt is the derived artifact of:
- Pre-flight READY TO EXECUTE verdict ([preflight-wp060-keyword-rule-glossary-data.md](preflight-wp060-keyword-rule-glossary-data.md))
- Copilot check CONFIRM verdict (30/30 PASS, appended to the pre-flight)
- WP-060 amendments (landed 2026-04-20 in Commit A0 bundle)
- EC-106 (new, landed in Commit A0 bundle)
- EC_INDEX.md retargeting row (landed in Commit A0 bundle)

**No scope beyond what is locked here may be introduced during execution.** Any observed need for additional scope must be escalated via a mid-session amendment + re-run of the copilot check; it may NOT be silently folded into Commit A.

Proceed to execution. `EC-106:` on the code commit; `SPEC:` on the governance close.
