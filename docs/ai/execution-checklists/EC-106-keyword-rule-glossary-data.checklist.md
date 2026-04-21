# EC-106 — Keyword & Rule Glossary Data Migration (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-060-keyword-rule-glossary-data.md`
(amended 2026-04-20)
**Layer:** Registry Viewer (`apps/registry-viewer`) + Content / Data
(`data/metadata/`) — **no engine, preplan, server, pg, or boardgame.io**

## Execution Authority

This EC is the authoritative execution checklist for WP-060. Compliance
is binary. Failure to satisfy any item is failed execution. If EC-106
and WP-060 conflict on **design intent**, the WP wins; on **execution
contract** (locked values, guardrails, staging discipline), the EC
wins.

**EC slot retargeting:** the file
`docs/ai/execution-checklists/EC-060-keyword-glossary.checklist.md`
was consumed by commit `6a63b1c` (earlier viewer-scope work — glossary
tooltips + mobile set-pill fix + viewer docs) and is unrelated to this
WP. Following the locked retargeting precedent chain
(EC-061 → EC-067 ... EC-064 → EC-074 ... EC-080 → EC-072 ... EC-079 →
EC-073), WP-060 uses **EC-106** — the next free slot in the registry
viewer series (101+). Commits use `EC-106:` prefix; `WP-060:` is
rejected by `.githooks/commit-msg` per P6-36.

## Execution Style

Data migration + viewer UI fetch wiring. Serialize three in-code Maps
to two JSON files, upload to R2, thread a singleton fetcher through
`App.vue` mount, re-wire `useRules.ts` lookups and `useGlossary.ts`
entry rebuild. Zero engine changes. Zero preplan / server / pg /
boardgame.io involvement. Zero `G` mutation.

---

## Before Starting (Preconditions — Blocking)

Each is a pass/fail gate.

- [ ] HEAD is at `00687c5` (SPEC: close WP-058 / EC-058 governance) or
      on a fresh `wp-060-keyword-rule-glossary` branch cut from it.
      Working tree matches `session-context-wp060.md §Inherited
      dirty-tree map` exactly (11 pre-existing items, none staged).
- [ ] WP-003 complete (`packages/registry/` + `data/metadata/` exist —
      verified: `data/metadata/` holds `sets.json`, `card-types.json`,
      `hero-classes.json`, `hero-teams.json`, `icons-meta.json`,
      `leads.json`; slots `keywords-full.json` + `rules-full.json` free)
- [ ] WP-060 amendment bundle has landed (pre-flight resolution commit
      A0) — verify WP-060 §Last Updated = `2026-04-20`
- [ ] `apps/registry-viewer/src/composables/useRules.ts` exports
      `KEYWORD_GLOSSARY` (113 entries), `RULES_GLOSSARY` (20 entries),
      `HERO_CLASS_GLOSSARY` (5 entries) — re-derive counts with:
      `node -e "const s=require('fs').readFileSync('apps/registry-viewer/src/composables/useRules.ts','utf8'); /*...*/"`
      or by reading the source file directly. **If counts drift from
      113 / 20 / 5 at execution start, STOP and ask before proceeding.**
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm -r --if-present test` exits 0 with **588 passing / 0
      failing** (record if drifted; baseline must hold through execution)
- [ ] R2 credentials are available to the executor. If not, STOP and
      escalate before beginning the code edits — do not produce a
      half-migrated commit that would break tooltips without the
      matching R2 artifacts.

---

## Locked Values (Do Not Re-Derive)

### JSON file shapes — exact

`data/metadata/keywords-full.json`:

```json
[
  { "key": "abomination", "description": "This keyword is used by Villains..." },
  { "key": "ambush",      "description": "Some Heroes say \"Instinct Ambush..." }
]
```

Entry type: `Array<{ key: string; description: string }>`.
Entries sorted alphabetically by `key` ascending.
Entry count = `KEYWORD_GLOSSARY.size` (113 at pre-flight).

`data/metadata/rules-full.json`:

```json
[
  { "key": "adaptingmasterminds", "label": "Adapting Masterminds", "summary": "Adapting Masterminds have only Tactic cards..." },
  { "key": "additional mastermind", "label": "Additional Mastermind", "summary": "This enemy ascends to become an additional Mastermind..." }
]
```

Entry type: `Array<{ key: string; label: string; summary: string }>`.
Entries sorted alphabetically by `key` ascending (note: `"additional
mastermind"` sorts before `"adaptingmasterminds"` because space < 'p'
in byte order — confirm against the exact `Array.prototype.sort`
default). Entry count = `RULES_GLOSSARY.size` (20 at pre-flight).

**Token markup preserved verbatim** in all `description` / `summary`
fields: `[icon:X]`, `[hc:X]`, `[keyword:N]`, `[rule:N]`, smart quotes,
escape characters. Use `JSON.stringify(map.entries, null, 2)` shape or
equivalent — do not hand-author.

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

Internal shape mirrors `themeClient.ts:49–113` verbatim in structure:

- Module-scope `_keywordPromise: Promise<KeywordGlossary> | null`
- Module-scope `_rulePromise: Promise<RuleGlossary> | null`
- One IIFE-style async body per accessor; re-entry returns the
  cached promise
- `devLog("glossary", "load start" | "load complete" | "load failed",
  { baseUrl, durationMs?, entryCount?, message? })` on every entry and
  exit point — identical event-shape to `themeClient.ts`
- `resetGlossaries()` nulls both promises (for tests only)

Fetched URLs:
- `${metadataBaseUrl}/metadata/keywords-full.json`
- `${metadataBaseUrl}/metadata/rules-full.json`

On fetch failure: `throw new Error(...)` inside the IIFE (caller in
`App.vue` catches and `console.warn`s — matching the `getThemes()`
non-blocking pattern).

### `lookupKeyword` / `lookupRule` preservation — hard lock

The current 40-line matcher in `useRules.ts:319–361` (exact-lowercase
→ space-hyphen-stripped → prefix → suffix → substring) must be preserved
**byte-for-byte** in the new implementation. Only the read source
changes (from module-const Map to module-scope ref populated by
`setGlossaries` at mount).

Concretely: the body between the `export function lookupKeyword(name:
string): string | null {` signature and its closing `}` must match the
current source modulo the `KEYWORD_GLOSSARY` identifier being replaced
with the module-scope holder. Comments (`// why: exact match covers
most tokens` etc.) preserved verbatim.

Same rule for `lookupRule` (`useRules.ts:369–381`): preserve the
`RULES_GLOSSARY.has(code.toLowerCase())` → `for (const [key, entry] of
RULES_GLOSSARY)` structure verbatim, retargeting the Map source only.

Return `null` when the fetch has not yet resolved. Never throw. Never
return `""`.

### `useGlossary.ts` rebuild — exact shape

Convert `useGlossary.ts:101 — const allEntries = buildAllEntries();`
to a reactive `ref<GlossaryEntry[]>([])` populated once after the
glossary fetch resolves:

```ts
const allEntries = ref<GlossaryEntry[]>([]);

export function rebuildGlossaryEntries(): void {
  allEntries.value = buildAllEntries();
}
```

`rebuildGlossaryEntries()` is called once from `App.vue`'s mount
handler after `getKeywordGlossary` + `getRuleGlossary` both resolve.
`buildAllEntries()` reads the same three Maps it reads today (two via
`setGlossaries`-populated module holders in `useRules.ts`, one via the
still-hardcoded `HERO_CLASS_GLOSSARY` export).

`filteredEntries` is already a `computed` over `allEntries` — no
change needed there.

The `// why: some keywords appear twice in the map (villainousweapons).
Skip duplicates.` check at `useGlossary.ts:47–49` stays **as is** —
belt-and-suspenders insurance against upstream duplication even though
the migrated JSON will be pre-deduplicated.

### `App.vue` onMounted wiring — exact shape

Inside the existing `try` block in `onMounted` (currently
`App.vue:142–177`), parallel to the existing theme-load block at
lines 158–166, add:

```ts
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

`setGlossaries` is a new named export from `useRules.ts` that writes
the two Maps into module-scope holders read by `lookupKeyword` /
`lookupRule`. No other `App.vue` edit is permitted under this EC.

### Commit prefix

`EC-106:` on the execution commit. `SPEC:` on the pre-flight bundle
(A0) and governance close (B). `WP-060:` is **forbidden** — the
commit-msg hook at `.githooks/commit-msg` rejects it per P6-36.
Subject lines containing `WIP` / `misc` / `tmp` / `updates` /
`changes` / `debug` / `fix stuff` are also rejected.

### Three-commit topology

1. **A0 `SPEC:`** — pre-flight bundle: WP-060 amendments + this EC
   file + `EC_INDEX.md` row + updated pre-flight verdict +
   (optional) 01.7 copilot check + session prompt. Must land before
   Commit A.
2. **A `EC-106:`** — execution: 2 new JSONs + `glossaryClient.ts` +
   modified `useRules.ts` / `useGlossary.ts` / `App.vue` / viewer
   `CLAUDE.md` + `docs/03.1-DATA-SOURCES.md` + (if MANDATORY) 01.6
   post-mortem. R2 upload is a separate operator step performed
   between the code commit and verification — NOT a `git` action.
3. **B `SPEC:`** — governance close: `STATUS.md` (if exists) +
   `WORK_INDEX.md` (flip WP-060 `[ ]` → `[x]` with date + Commit A
   hash) + `EC_INDEX.md` (EC-106 → `Done`) + DECISIONS.md entries.

### 01.6 post-mortem disposition

Evaluate each trigger explicitly:

- **New long-lived abstraction?** `glossaryClient.ts` is a new file,
  but it is a **new instance of an existing abstraction**
  (`themeClient.ts`), not a new pattern. Not triggered.
- **New code category?** No — viewer `src/lib/` is pre-classified.
- **New contract consumed by engine / other packages?** No — all
  consumers are viewer-local.
- **New setup artifact in `G`?** No — zero engine involvement.

**Disposition: NOT TRIGGERED. 01.6 post-mortem is NOT required.**
Matches WP-055 theme data-migration precedent. If execution surfaces
any finding that *would* trigger a post-mortem (e.g., a genuinely new
abstraction introduced mid-execution), re-evaluate and author one.

---

## Guardrails (Non-Negotiable)

- **No imports from `packages/game-engine/`, `packages/preplan/`,
  `apps/server/`, `pg`, or `boardgame.io`** in any changed file.
  Viewer layer only.
- **No changes to `lookupKeyword` / `lookupRule` algorithmic bodies.**
  Only the backing Map source changes. See §Locked Values.
- **No touching `HERO_CLASS_GLOSSARY`** — preserved verbatim in
  `useRules.ts`.
- **No touching function/type signatures** of `lookupKeyword`,
  `lookupRule`, `lookupHeroClass`, `parseAbilityText`, `RuleEntry`,
  `AbilityToken`, `TokenType`. `CardDetail.vue` depends on all of them.
- **No Zod schema** for the new JSON files — WP §Scope (Out) explicitly
  forbids it (display-only content).
- **No token markup transformation** inside the migrated JSON
  (`[icon:X]`, `[hc:X]`, `[keyword:N]`, `[rule:N]` preserved verbatim).
- **No staging any of the 11 inherited dirty-tree items** from
  `session-context-wp060.md §Inherited dirty-tree map`. Stage by exact
  filename only. `git add .` / `git add -A` / `git add -u` are
  forbidden (P6-27 / P6-44).
- **Never pop `stash@{0}`, `stash@{1}`, `stash@{2}`** (quarantined
  per session-context lines 142–147).
- **Never push to remote** unless explicitly asked (WP-056/057/058
  all stayed local; WP-060 follows suit).
- **Never use `--no-verify`** or `--no-gpg-sign` — commit-msg hook
  must pass on its merits.
- **R2 upload requires R2 credentials.** If authentication fails,
  STOP and escalate. Do NOT silently skip and commit a half-migrated
  state.
- **Baseline invariance:** `pnpm -r --if-present test` must exit 0
  with 588 / 0 preserved. No new test file is required by WP-060.
  If the executor adds tests for `glossaryClient.ts` (optional —
  mirror the `themeClient.ts` pattern), they must be plain TS under
  `node:test` with one `describe()` per file (WP-031 / WP-057
  precedent), and the count is noted in the execution summary.

---

## Required `// why:` Comments

- `glossaryClient.ts` — one `// why:` on the module-scope `_promise`
  holders explaining that singleton caching prevents duplicate R2
  fetches within a session (mirror `themeClient.ts:51`).
- `useRules.ts` at the new module-scope glossary holders — one
  `// why:` explaining they are populated by `setGlossaries()` at
  `App.vue` mount and are `null` before that point, which is why
  `lookupKeyword` / `lookupRule` return `null` pre-fetch.
- `useRules.ts` — preserve **every existing** `// why:` comment in
  `lookupKeyword` (lines 321, 324, 329–332, 345, 354–355) and
  `lookupRule` verbatim. These document the algorithm that the
  §Locked Values preservation rule pins.
- `useGlossary.ts` — one `// why:` on `rebuildGlossaryEntries()`
  explaining it is called once from `App.vue` after the async fetch
  resolves, and that the `filteredEntries` computed re-evaluates
  automatically via Vue reactivity when `allEntries.value` is
  reassigned.
- `App.vue` — one `// why:` on the new glossary-load block
  explaining parity with the adjacent `getThemes` non-blocking
  pattern and why glossary fetch failure is `console.warn` + continue
  rather than a hard error.

---

## Files to Produce

Exact files. Anything outside this list is out of scope.

- `data/metadata/keywords-full.json` — **new** — 113 keyword entries
  serialized from `KEYWORD_GLOSSARY`, alphabetical by `key`
- `data/metadata/rules-full.json` — **new** — 20 rule entries
  serialized from `RULES_GLOSSARY`, alphabetical by `key`
- `apps/registry-viewer/src/lib/glossaryClient.ts` — **new** — singleton
  fetchers per §Locked Values
- `apps/registry-viewer/src/composables/useRules.ts` — **modified** —
  remove `KEYWORD_GLOSSARY` and `RULES_GLOSSARY` Map bodies; add
  module-scope holders + `setGlossaries` setter; retarget
  `lookupKeyword` / `lookupRule` to the holders with algorithmic
  bodies preserved verbatim; keep `HERO_CLASS_GLOSSARY`, `RuleEntry`,
  `parseAbilityText`, `lookupHeroClass`, `AbilityToken`, `TokenType`
  verbatim
- `apps/registry-viewer/src/composables/useGlossary.ts` — **modified**
  (viewer analog of 01.5 wiring allowance) — reactive `allEntries`
  ref + exported `rebuildGlossaryEntries()`
- `apps/registry-viewer/src/App.vue` — **modified** — add the glossary
  load block per §Locked Values inside existing `onMounted` try
- `apps/registry-viewer/CLAUDE.md` — **modified** — update "Keyword &
  Rule Glossary" + "Architecture & Data Flow" + "Key Files" sections
- `docs/03.1-DATA-SOURCES.md` — **modified** — add two rows under
  §Registry Metadata Files table
- `docs/ai/DECISIONS.md` — **modified** — add seven decisions per
  WP §Governance
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (Commit B) —
  flip WP-060 `[ ]` → `[x]` with date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (Commit B) —
  flip EC-106 → `Done`
- `docs/ai/execution-checklists/EC-106-keyword-rule-glossary-data.checklist.md`
  — **this file** (lands in Commit A0)

---

## Out of Scope (Do NOT Expand)

- **No changes to `packages/game-engine/`, `packages/preplan/`,
  `packages/registry/`, `packages/vue-sfc-loader/`, `apps/server/`,
  `apps/arena-client/`, `apps/replay-producer/`, or any file under
  `content/themes/`.**
- **No new Zod schema** for glossary data.
- **No modifications to `CardDetail.vue`, `GlossaryPanel.vue`, or any
  other component that imports only the lookup functions** — their
  contract surface is preserved and they must work unchanged.
- **No conversion of `HERO_CLASS_GLOSSARY` to R2** — it stays hardcoded.
- **No new `devLog` categories beyond `"glossary"`** (if EC-104's
  allowed-category set is strict, add `"glossary"` with a one-line EC
  amendment; otherwise proceed).
- **No mid-execution refactoring of `lookupKeyword` / `lookupRule`**
  beyond retargeting the Map source. If a simplification seems
  attractive, STOP — it is forbidden by the §Locked Values preservation
  rule.
- **No simplification or reformatting of existing `// why:` comments.**
- **No extension of `pnpm validate` to cover glossary JSON** — out of
  scope; the files are display-only text, not contract data.
- **No token-text transformation, normalization, or stripping.**
- **No new test infrastructure** (no `vue-sfc-loader` changes, no
  `jsdom` setup). If tests are authored for `glossaryClient.ts` they
  are plain TS under `node:test`.
- **No staging of any pre-existing untracked file or modified doc** —
  see §Guardrails "Inherited dirty-tree."

---

## Verification Steps (Run In Order; All Must Pass)

```bash
# 1. Dependencies up to date
pnpm install --frozen-lockfile

# 2. Typecheck
pnpm --filter registry-viewer typecheck
# expect: exits 0

# 3. Lint — warning budget inherits EC-105 baseline
pnpm --filter registry-viewer lint
# expect: 0 errors; warnings ≤ 180

# 4. Build
pnpm -r build
# expect: exits 0

# 5. Test baseline preserved
pnpm -r --if-present test
# expect: 588 passing / 0 failing (adjust upward only if EC-106 adds tests)

# 6. JSON entry counts match in-code Map sizes
node -e "const k=JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8')); console.log('keywords='+k.length)"
# expect: keywords=113
node -e "const r=JSON.parse(require('fs').readFileSync('data/metadata/rules-full.json','utf8')); console.log('rules='+r.length)"
# expect: rules=20

# 7. JSON entries sorted alphabetically by key
node -e "const k=JSON.parse(require('fs').readFileSync('data/metadata/keywords-full.json','utf8')); const sorted=[...k].sort((a,b)=>a.key.localeCompare(b.key)); console.log(JSON.stringify(k)===JSON.stringify(sorted) ? 'OK' : 'FAIL')"
# expect: OK
node -e "const r=JSON.parse(require('fs').readFileSync('data/metadata/rules-full.json','utf8')); const sorted=[...r].sort((a,b)=>a.key.localeCompare(b.key)); console.log(JSON.stringify(r)===JSON.stringify(sorted) ? 'OK' : 'FAIL')"
# expect: OK

# 8. No engine or boardgame.io imports in new viewer file
grep -E "from ['\"](@legendary-arena/game-engine|boardgame\.io)" apps/registry-viewer/src/lib/glossaryClient.ts
# expect: no output

# 9. Map bodies removed from useRules.ts
grep -c "^export const KEYWORD_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts
# expect: 0
grep -c "^export const RULES_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts
# expect: 0
grep -c "^export const HERO_CLASS_GLOSSARY" apps/registry-viewer/src/composables/useRules.ts
# expect: 1 (preserved)

# 10. lookupKeyword enhanced matching logic preserved
grep -cE "(Suffix match|Substring match|Prefix match)" apps/registry-viewer/src/composables/useRules.ts
# expect: >= 3

# 11. R2 upload verification (after operator-step upload)
curl -sI https://images.barefootbetters.com/metadata/keywords-full.json | head -1
# expect: HTTP/2 200
curl -sI https://images.barefootbetters.com/metadata/rules-full.json | head -1
# expect: HTTP/2 200

# 12. Files outside allowlist not modified
git diff --name-only
# expect: only files from §Files to Produce (plus EC_INDEX / WORK_INDEX
# on Commit B)
```

### Manual DEV smoke test

```bash
pnpm --filter registry-viewer dev
```

- 13a. Visit `http://localhost:5173/`. Console should show
       `[glossary] load start` → `[glossary] load complete` events.
- 13b. Open any hero card with tokenized ability text. Hover a
       `[keyword:Berserk]` badge → tooltip shows Berserk definition.
- 13c. Open a card with "Ultimate Abomination" / "Double Striker" /
       "Triple Empowered" / "Focus 2" / "Patrol the Bank" / "Danger
       Sense 3" in its ability text. Hover each keyword → tooltip
       shows the correct definition. **Failure here means
       `lookupKeyword` regression — STOP.**
- 13d. Hover a `[rule:shards]` badge → tooltip shows Shards rule.
- 13e. Hover `[hc:covert]` / `[hc:instinct]` / `[hc:ranged]` /
       `[hc:strength]` / `[hc:tech]` → tooltips show (hero class data
       still hardcoded — regression here means `HERO_CLASS_GLOSSARY`
       was modified).
- 13f. Open glossary panel (Ctrl+K). Entry count and ordering matches
       pre-migration (138 total entries: 20 rules + 113 keywords + 5
       hero classes). Click an entry → scrolls into view.
- 13g. (Negative test) Edit `public/registry-config.json` temporarily
       to use a bad `metadataBaseUrl`. Reload. Expect:
       `console.warn("[Glossary] Load failed (non-blocking): ...")`
       AND the app still renders cards without throwing. Revert the
       config edit.

### Manual PROD smoke test

```bash
pnpm --filter registry-viewer build
pnpm --filter registry-viewer preview
```

- 14a. Visit `http://localhost:4173/`. Repeat steps 13a–13f against
       the production bundle. All must pass.
- 14b. DevTools → Network → confirm exactly two glossary fetches:
       `keywords-full.json` and `rules-full.json`. No duplicate
       fetches (singleton pattern honoured).

---

## After Completing

- [ ] Verification steps 1–12 all pass
- [ ] Manual DEV smoke (13a–13g) passes
- [ ] Manual PROD smoke (14a–14b) passes
- [ ] R2 HEAD probes (step 11) both return 200
- [ ] Test baseline 588 / 0 preserved (or adjusted upward if optional
      `glossaryClient.ts` tests were added — document in execution
      summary)
- [ ] No file outside §Files to Produce modified (`git diff --name-only`)
- [ ] All `// why:` comments from §Required Comments present
- [ ] All existing `// why:` comments in `lookupKeyword` / `lookupRule`
      preserved verbatim
- [ ] Three-commit topology: A0 `SPEC:` → A `EC-106:` → B `SPEC:` all
      landed with hook-compliant subjects (no `--no-verify`)
- [ ] `EC_INDEX.md` has EC-106 flipped to `Done` in Commit B
- [ ] `WORK_INDEX.md` has WP-060 `[ ]` → `[x]` with date + Commit A
      hash in Commit B
- [ ] `docs/ai/DECISIONS.md` has all seven WP §Governance entries
      recorded
- [ ] `docs/03.1-DATA-SOURCES.md` §Registry Metadata has new rows
- [ ] `apps/registry-viewer/CLAUDE.md` updated
- [ ] All three quarantine stashes (`stash@{0}`, `stash@{1}`,
      `stash@{2}`) intact
- [ ] None of the 11 inherited dirty-tree items staged or committed

---

## Common Failure Smells

- **Modifier keyword tooltips go blank.** `lookupKeyword` algorithm
  was not preserved. STOP — §Locked Values preservation rule violated.
  Revert and re-attempt retaining the current 40-line matcher body.
- **`allEntries` panel empty after migration.** `useGlossary.ts` was
  not re-wired reactively, or `rebuildGlossaryEntries()` is not called
  from `App.vue` after the fetch resolves.
- **TypeScript compile error "Cannot find name 'KEYWORD_GLOSSARY'"
  from `useGlossary.ts`.** `useGlossary.ts` was not added to the scope
  as §Files to Produce requires. Do not "fix" by re-adding the export
  in `useRules.ts` — the scope expansion is authorized for exactly
  this reason.
- **"102" or "18" appears in any new file.** Stale count from the
  pre-amendment WP. Re-derive from the actual Map sizes at execution
  time.
- **Tooltip for `[rule:additional mastermind]` goes blank.** The rule
  key contains a space; sorting or serialization must preserve it.
  Check the JSON entry exists with `"key": "additional mastermind"`.
- **Production bundle includes the old hardcoded glossary text.** Old
  source was reverted or not actually removed from `useRules.ts`.
  `grep "teleport" apps/registry-viewer/dist/assets/index-*.js` should
  find the definition **inside the fetched JSON path only**, not
  inside bundled JS (the description strings move from the bundle into
  R2 — that is the whole point of the migration).
- **Commit message rejected by hook.** Subject contains a forbidden
  word (`WIP`/`misc`/`tmp`/`updates`/`changes`/`debug`/`fix stuff`)
  or uses `WP-060:` prefix. Rephrase using `EC-106:` + a substantive
  ≥12-char summary.
- **`git diff` shows `pnpm-lock.yaml` modified.** Should not happen
  for WP-060 (no new dependencies). If it does, investigate — likely
  an unintended side-effect of a different `pnpm` command, revert.
- **`HERO_CLASS_GLOSSARY` moved to R2.** Explicit scope violation —
  WP §D and this EC both forbid it. Revert.
