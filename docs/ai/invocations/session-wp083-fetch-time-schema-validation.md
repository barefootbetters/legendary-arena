# Session Execution Prompt — WP-083 (Fetch-Time Schema Validation for Registry-Viewer Clients)

> **Authority:** This prompt is a strict transcription + ordering artifact produced by the WP-083 A0 SPEC pre-flight bundle. It does NOT introduce new scope, new locked values, new verification steps, or new ambiguity resolutions beyond what EC-108 + WP-083 (with amendments A-083-01 through A-083-04) lock.
>
> **Execution contract:** EC-108 (`docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md`).
> **Design intent:** WP-083 (`docs/ai/work-packets/WP-083-fetch-time-schema-validation.md`).
> **Session context:** `docs/ai/session-context/session-context-wp083.md` (read first).
> **Pre-flight v2 verdict:** READY TO EXECUTE (`docs/ai/invocations/preflight-wp083.md` §"Re-Run 2026-04-21 (v2)").
> **Copilot-check v2 disposition:** CONFIRM (`docs/ai/invocations/copilot-check-wp083.md` §"Re-Run 2026-04-21 (v2)").

---

## Mandatory Read Order

Before writing any code, read in this order:

1. `.claude/CLAUDE.md` — EC-mode rules, lint gate, commit discipline.
2. `docs/ai/session-context/session-context-wp083.md` — dependency chain, test baseline, working-tree coordination with in-flight WP-084, in/out-of-scope tables, conflict-resolution rules, amendments record.
3. `docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md` — authoritative contract. Every locked value, guardrail, and verification step applies binary.
4. `docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` — design intent (subordinate to EC-108 on execution contract).
5. `docs/ai/invocations/preflight-wp083.md` §"Re-Run 2026-04-21 (v2)" — READY verdict + PS-1/2/3 resolution log.
6. `docs/ai/invocations/copilot-check-wp083.md` §"Re-Run 2026-04-21 (v2)" — CONFIRM disposition + 30/30 PASS.
7. `apps/registry-viewer/src/lib/glossaryClient.ts` — the canonical fetch-boundary validation precedent EC-107 / WP-082 established. Lines 20–32 document the browser-bundle rationale for the subpath import that A-083-04 extends.
8. `packages/registry/src/theme.schema.ts` — the theme schemas this packet REUSES (D-5504 / D-5509 / EC-055 lock; must not modify — empty `git diff` post-execution is a mandatory Acceptance Criterion).

If EC-108 and WP-083 conflict on **execution contract**, EC-108 wins. On **design intent**, WP-083 wins. Higher-level documents (`.claude/CLAUDE.md`, `docs/ai/ARCHITECTURE.md`) override both.

---

## Branch Strategy (MANDATORY — cut from main, not from current working tree)

Per session-context-wp083 §2.1 + pre-flight v2 RS-9:

```bash
git fetch origin
git checkout main
git pull --ff-only
git checkout -b wp-083-fetch-time-schema-validation
```

**Do not inherit the current working tree.** At session-context authoring time (2026-04-21), the working tree held ~60 modified / deleted items driven largely by WP-084 execution being partially applied uncommitted. Those changes are WP-084's responsibility; WP-083 executes atop a clean `main` cut. WP-083 and WP-084 are declared independent; their file overlaps (`packages/registry/src/schema.ts`, `apps/registry-viewer/CLAUDE.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md`, `docs/03.1-DATA-SOURCES.md`) produce clean merges in either ordering per session-context §2.4.

---

## Baseline Re-Derivation

On the fresh branch, confirm baselines before any edit:

```bash
pnpm install --frozen-lockfile
pnpm -r build                      # expect: exits 0
pnpm -r --if-present test          # expect: 596 passing / 0 failing
                                   #   (or post-WP-084 equivalent; must match
                                   #    the value on `main` at branch-cut)
```

Record the exact baseline in your execution summary. If the count differs from 596, investigate before proceeding — do not edit code against an unknown baseline.

If you elect to author the optional schema-parse test file per session-context §1.2 (copilot-check Finding #11), the post-execution baseline becomes 596/0 + the test delta (typically 601/0 with +5 tests / +2 suites for 3 `ViewerConfigSchema` cases + 2 `ThemeIndexSchema` cases in one `describe()` per schema). Declare this in the execution summary before Commit A if authored.

---

## Scope Lock — Files Allowed To Modify / Create

**Commit A allowlist (exact filenames; no `git add .` / `-A` / `-u`):**

1. `packages/registry/src/schema.ts` — append `ViewerConfigSchema` + `ThemeIndexSchema` + inferred types; update comment adjacent to `RegistryConfigSchema` (schema body byte-for-byte preserved).
2. `packages/registry/src/index.ts` — extend general-schema re-export block with two new schemas + two inferred types; theme-schema block untouched.
3. `packages/registry/package.json` — **(A-083-04)** add `"./theme.schema"` subpath entry to `exports` field. No other field touched.
4. `apps/registry-viewer/src/lib/registryClient.ts` — delete inline `RegistryConfig` interface; add exact import from `@legendary-arena/registry/schema`; `.safeParse(...)` at fetch boundary; throw full-sentence `[RegistryConfig] Rejected ...` on failure.
5. `apps/registry-viewer/src/lib/themeClient.ts` — delete four inline interfaces; add split-subpath imports (`./schema` for `ThemeIndexSchema`; `./theme.schema` for `ThemeDefinitionSchema` + `ThemeDefinition`); validate index (throw) + each theme (warn + skip); preserve `Promise.allSettled` + null-filter + sort-by-name tail byte-for-byte.
6. `apps/registry-viewer/CLAUDE.md` — §"Key Files" annotations for both retrofitted clients; §"Design Patterns" Zod-inferred-types bullet extension.
7. `docs/03.1-DATA-SOURCES.md` — **optional** — only if the existing doc structure supports a small additive note for viewer public config / themes; else skip per WP-083 §F.
8. `packages/registry/src/schema.test.ts` — **optional** — executor's call per copilot-check Finding #11 and session-context §1.2.

**Commit B allowlist:**

1. `docs/ai/work-packets/WORK_INDEX.md` — flip WP-083 `[ ]` → `[x]` with date + Commit A hash.
2. `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-108 Draft → Done.
3. `docs/ai/DECISIONS.md` — add D-083A / D-083B / D-083C / D-083D / D-083E (final numeric IDs allocated at commit time).
4. `docs/ai/STATUS.md` — optional, if the file exists and prior WPs followed the convention.

**Anything else is out of scope.** If you find yourself needing to touch a file not listed above, STOP and escalate — do NOT silently expand scope, do NOT cite 01.5 retroactively.

---

## Locked Values (copied verbatim from EC-108 — do not re-derive)

### `packages/registry/package.json` subpath addition (A-083-04)

Extend the existing `exports` field (currently `.` + `./schema`) with a third entry. All other fields byte-for-byte preserved.

```json
"exports": {
  ".": {
    "import": "./dist/index.js",
    "types": "./dist/index.d.ts"
  },
  "./schema": {
    "import": "./dist/schema.js",
    "types": "./dist/schema.d.ts"
  },
  "./theme.schema": {
    "import": "./dist/theme.schema.js",
    "types": "./dist/theme.schema.d.ts"
  }
}
```

`tsconfig.build.json` is NOT modified — `tsc -p tsconfig.build.json` already emits `dist/theme.schema.js` + `dist/theme.schema.d.ts`. Verify via `ls packages/registry/dist/` after `pnpm --filter @legendary-arena/registry build`.

`pnpm-lock.yaml` MUST remain unchanged (additive `exports` entry in an already-linked workspace package).

### `ViewerConfigSchema` — exact shape

Append to `packages/registry/src/schema.ts` after the existing general schemas:

```ts
// ── Registry-viewer public config (apps/registry-viewer/public/registry-config.json) ──
// why: distinct from RegistryConfigSchema (R2 set-abbreviation artifact).
// Object shape consumed by the viewer at boot to locate metadata and optional
// rulebook PDF. rulebookPdfUrl is optional so WP-082 can add it before, after,
// or alongside EC-108 without schema churn.
export const ViewerConfigSchema = z
  .object({
    metadataBaseUrl: z.string().url(),
    eagerLoad: z.array(z.string().min(2).max(10)).optional(),
    rulebookPdfUrl: z.string().url().optional(),
  })
  .strict();

export type ViewerConfig = z.infer<typeof ViewerConfigSchema>;
```

`.strict()` is mandatory on `ViewerConfigSchema`. Do not remove it.

### `ThemeIndexSchema` — exact shape

Append to `packages/registry/src/schema.ts`:

```ts
// ── Themes directory index (R2 /themes/index.json) ────────────────────────────
// why: root manifest of theme filenames; if malformed, the Themes subsystem
// is considered unavailable and must fail fast. Individual theme failures are
// non-fatal (warn + skip) because one bad theme must not hide the rest.
export const ThemeIndexSchema = z.array(z.string().regex(/\.json$/, "theme index entries must end in .json"));

export type ThemeIndex = z.infer<typeof ThemeIndexSchema>;
```

`.strict()` is NOT applied — it is meaningless for array schemas.

### `RegistryConfigSchema` adjacent comment update

The existing schema body at `schema.ts:33` is preserved **byte-for-byte**. Only the adjacent comment is edited.

**Before (HEAD at branch cut — verify verbatim):**

```
// ── Registry config (registry-config.json at R2 root) ─────────────────────────
// Simple array of set abbreviation strings. Not a source file — R2 artifact only.
```

**After:**

```
// ── Registry set-abbreviation list (R2 /registry-config.json artifact) ────────
// Simple array of set abbreviation strings. R2 artifact only — not the viewer's
// public config. For the viewer's public/registry-config.json (object shape with
// metadataBaseUrl, eagerLoad, rulebookPdfUrl), see ViewerConfigSchema below.
```

`export const RegistryConfigSchema = z.array(z.string().min(2).max(10));` is untouched. A `git diff` of that line must show zero change.

### `packages/registry/src/index.ts` — exact re-export delta

Extend the existing general-schema block to include the two new schemas + two inferred types. **Theme-schema re-export block NOT modified.**

```ts
// Schema (for external validation use)
export {
  SetDataSchema,
  SetIndexEntrySchema,
  HeroCardSchema,
  HeroClassSchema,
  CardQuerySchema,
  KeywordGlossaryEntrySchema,
  KeywordGlossarySchema,
  RuleGlossaryEntrySchema,
  RuleGlossarySchema,
  ViewerConfigSchema,
  ThemeIndexSchema,
} from "./schema.js";

export type {
  KeywordGlossaryEntry,
  RuleGlossaryEntry,
  ViewerConfig,
  ThemeIndex,
} from "./schema.js";
```

Preserve the pre-existing theme-schema exports (`ThemeDefinition` type + five theme schemas + `validateTheme` / `validateThemeFile`) verbatim.

### `registryClient.ts` — exact import line (A-083-04 lock)

```ts
import { ViewerConfigSchema, type ViewerConfig } from "@legendary-arena/registry/schema";
```

Barrel import (`from "@legendary-arena/registry"`) is **forbidden** in this file — would regress the browser build per `glossaryClient.ts:20–28`.

The pre-existing `import { createRegistryFromHttp } from "../registry/browser";` + `import type { CardRegistry } from "../registry/browser";` at lines 1–2 are **not modified**.

### `themeClient.ts` — exact import lines (A-083-04 lock, split across subpaths)

```ts
import { ThemeIndexSchema } from "@legendary-arena/registry/schema";
import { ThemeDefinitionSchema, type ThemeDefinition } from "@legendary-arena/registry/theme.schema";
```

Barrel import (`from "@legendary-arena/registry"`) is **forbidden** in this file.

Delete the four inline interfaces at `themeClient.ts` lines ~12–47 (re-derive exact ranges at execution time via `grep -nE "^export interface" apps/registry-viewer/src/lib/themeClient.ts`).

### Zod error rendering — exact shape (mirrors EC-107 `glossaryClient.ts`)

**Viewer-config branch (`registryClient.ts`) — throw on failure:**

```ts
const result = ViewerConfigSchema.safeParse(rawPayload);
if (!result.success) {
  const issue = result.error.issues[0];
  const path  = issue.path.length > 0 ? issue.path.join(".") : "root";
  // why: dot-joined path keeps viewer logs operator-readable without
  // Zod fluency; default ["eagerLoad","0"]-style array paths are noisy.
  // First issue only — additional issues suppressed so operator logs stay
  // scannable, per WP-083 §"Zod error reporting" lock.
  throw new Error(
    `[RegistryConfig] Rejected registry-config.json from ${url}: ${path} — ${issue.message}. ` +
    `Viewer cannot boot with an invalid config; fix the file and redeploy.`,
  );
}
const config = result.data;
```

**Theme-index branch (`themeClient.ts`) — throw on failure:**

```ts
const indexResult = ThemeIndexSchema.safeParse(rawIndex);
if (!indexResult.success) {
  const issue = indexResult.error.issues[0];
  const path  = issue.path.length > 0 ? issue.path.join(".") : "root";
  throw new Error(
    `[Themes] Rejected themes/index.json from ${indexUrl}: ${path} — ${issue.message}. ` +
    `The Themes tab cannot populate without a valid index.`,
  );
}
```

**Individual-theme branch (`themeClient.ts`) — warn + skip (return null):**

```ts
const themeResult = ThemeDefinitionSchema.safeParse(rawTheme);
if (!themeResult.success) {
  const issue = themeResult.error.issues[0];
  const path  = issue.path.length > 0 ? issue.path.join(".") : "root";
  console.warn(
    `[Themes] Rejected ${filename} from ${themeUrl}: ${path} — ${issue.message}. ` +
    `Theme skipped; Themes tab will not show it.`,
  );
  return null;
}
return themeResult.data;
```

Locked invariants across all three:

- `[RegistryConfig]` / `[Themes]` category tag prefix.
- Filename named (`registry-config.json` or the specific theme filename).
- URL included.
- Dot-joined path or `"root"`.
- `issue.message` included.
- Full-sentence operator hint at end describing resulting state.
- **First issue only** — no `.format()` dumps, no multi-issue arrays.
- `.parse(...)` forbidden everywhere — `.safeParse(...)` only (enforced by Verification Step 14).

---

## Severity Policy (D-083C)

- **Throw** for hard dependencies: viewer config, theme index.
- **Warn + skip** for isolated batch entries: individual theme files (the existing `Promise.allSettled` + null-filter tail at `themeClient.ts:72–87` drops the nulls cleanly — no new filtering logic required).

---

## Guardrails (Non-Negotiable — copied from EC-108 §Guardrails)

- **No imports from `packages/game-engine/`, `packages/preplan/`, `apps/server/`, `pg`, or `boardgame.io`** in any changed file. Verification Step 17 enforces via grep (P6-22 escaped-dot pattern: `from ['"]boardgame\.io`).
- **No modification of `packages/registry/src/theme.schema.ts`** — `git diff` must be empty.
- **No modification of `packages/registry/src/theme.validate.ts`** — `git diff` must be empty.
- **`RegistryConfigSchema` schema body preserved byte-for-byte** — only adjacent comment edited. A `git diff` of the `export const RegistryConfigSchema = z.array(...)` line must be empty.
- **`.strict()` mandatory on `ViewerConfigSchema` only.** Not added to `ThemeIndexSchema` (array) or any theme schema (would break D-5509 additive music fields).
- **No `.parse(...)` at any fetch boundary** — `.safeParse(...)` only. Fatal throws raise `throw new Error(...)` **after** `safeParse` returns; they do not use `.parse()`'s automatic throw.
- **No barrel import of `@legendary-arena/registry`** in `registryClient.ts` or `themeClient.ts` — only the narrow `./schema` and `./theme.schema` subpaths. Verification Step 7.3 enforces.
- **No new Zod schemas for auxiliary metadata** — `CardTypeEntrySchema`, `HeroClassEntrySchema`, `HeroTeamEntrySchema`, `IconEntrySchema`, `LeadsEntrySchema` are untouched (and if WP-084 landed first, they are deleted — WP-083 adds nothing relating to them).
- **No content changes** to `public/registry-config.json`, `content/themes/*.json`, or any R2 artifact.
- **No refactoring or stylistic cleanup** in the two retrofitted clients beyond the validation wiring. Existing `sort` / `devLog` / `Promise.allSettled` logic preserved verbatim.
- **No `import *` or barrel re-exports** anywhere.
- **No new dependencies.** `zod` already exists in both relevant packages.
- **No staging of any file outside the Commit A / B allowlists above.** `git add .` / `git add -A` / `git add -u` are forbidden (P6-27 / P6-44). Stage by exact filename only.
- **Never use `--no-verify` or `--no-gpg-sign`.** Commit-msg hook must pass on its merits.
- **Never push to remote** unless explicitly asked.
- **Baseline invariance:** `pnpm -r --if-present test` must exit 0 with the re-derived baseline preserved (or extended by +5/+2 if optional schema-parse tests authored, pre-declared before Commit A).
- **Paraphrase discipline (P6-43 / P6-50):** JSDoc and `// why:` text in all changed files must not reference `G`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io`, `ctx.random`, or engine move names. Retrofit is Registry + Viewer only; engine vocabulary is out of scope.
- **`.reduce()` ban** in any changed file (Verification Step 19).

---

## Required `// why:` Comments

- `packages/registry/src/schema.ts` — one `// why:` block above `ViewerConfigSchema` (verbatim text in §Locked Values).
- `packages/registry/src/schema.ts` — one `// why:` block above `ThemeIndexSchema` (verbatim text in §Locked Values).
- `apps/registry-viewer/src/lib/registryClient.ts` — one `// why:` on dot-joined issue-path rendering.
- `apps/registry-viewer/src/lib/themeClient.ts` — one `// why:` on dot-joined issue-path rendering (index branch); one `// why:` on `console.warn` + `return null` preserving `Promise.allSettled` null-filter (individual-theme branch).
- Preserve every existing `// why:` comment in both clients verbatim.

---

## 01.5 Runtime-Wiring Allowance — NOT INVOKED

Four criteria enumerated and absent:

- No `LegendaryGameState` field added — this packet does not touch `packages/game-engine/`.
- No `buildInitialGameState` shape change — this packet does not touch setup.
- No `LegendaryGame.moves` entry — this packet does not touch `game.ts`.
- No phase hook added — this packet does not touch framework lifecycle.

The 01.5 allowance is not available to this WP. Per `01.5` §Escalation: it may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes. If an unanticipated structural break appears mid-execution, STOP and escalate — do not force-fit.

---

## 01.6 Post-Mortem — NOT TRIGGERED

Evaluated per `01.6-post-mortem-checklist.md`:

- **New long-lived abstraction?** `ViewerConfigSchema` and `ThemeIndexSchema` are new **instances** of an existing abstraction (Zod schemas in the registry package). `./theme.schema` subpath is a new instance of the A-082-01 `./schema` abstraction. Not triggered.
- **New code category?** No — all touched directories pre-classified (per session-context §7; `apps/registry-viewer/` category gap is pre-existing and out of scope).
- **New contract consumed by engine / other packages?** No — consumed only by the viewer.
- **New setup artifact in `G`?** No — zero engine involvement.
- **Novel keyboard / interaction pattern?** No — pure validation retrofit.

Disposition: NOT TRIGGERED. 01.6 post-mortem is NOT required. Matches EC-106 / EC-107 precedent. If execution surfaces a finding that would trigger a post-mortem (e.g., the theme type narrowing cascades into a cross-layer TS break that requires a new abstraction), re-evaluate and author one.

---

## Three-Commit Topology

1. **A0 SPEC** (`SPEC:` prefix) — governance bundle. Lands before any viewer / schema / package.json edit. Contents:
   - `docs/ai/work-packets/WP-083-fetch-time-schema-validation.md` (with A-083-01..04 amendments)
   - `docs/ai/execution-checklists/EC-108-fetch-time-schema-validation.checklist.md`
   - `docs/ai/work-packets/WORK_INDEX.md` (WP-083 row added)
   - `docs/ai/execution-checklists/EC_INDEX.md` (EC-108 row added)
   - `docs/ai/session-context/session-context-wp083.md`
   - `docs/ai/invocations/preflight-wp083.md` (v1 + v2 CONFIRM block appended)
   - `docs/ai/invocations/copilot-check-wp083.md` (v1 + v2 CONFIRM block appended)
   - `docs/ai/invocations/session-wp083-fetch-time-schema-validation.md` (this file)

2. **A** (`EC-108:` prefix) — execution. Contents:
   - `packages/registry/src/schema.ts` (two new schemas + one comment edit)
   - `packages/registry/src/index.ts` (two new named exports + two new type exports)
   - `packages/registry/package.json` (A-083-04 `./theme.schema` subpath entry)
   - `apps/registry-viewer/src/lib/registryClient.ts` (validation retrofit, `./schema` subpath import)
   - `apps/registry-viewer/src/lib/themeClient.ts` (validation retrofit, split `./schema` + `./theme.schema` subpath imports)
   - `apps/registry-viewer/CLAUDE.md` (documentation update)
   - `docs/03.1-DATA-SOURCES.md` (optional)
   - `packages/registry/src/schema.test.ts` (optional — only if authored, pre-declared in session summary)

3. **B** (`SPEC:` prefix) — governance close. Contents:
   - `docs/ai/work-packets/WORK_INDEX.md` (flip WP-083 `[ ]` → `[x]` with date + Commit A hash)
   - `docs/ai/execution-checklists/EC_INDEX.md` (flip EC-108 Draft → Done)
   - `docs/ai/DECISIONS.md` (D-083A / D-083B / D-083C / D-083D / D-083E — final numeric IDs allocated at commit time)
   - `docs/ai/STATUS.md` (optional)

**Commit prefix discipline (P6-36):** `WP-083:` is **forbidden** — `.githooks/commit-msg` rejects it. Subject must be ≥ 12 chars after prefix and must not contain `WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff`.

**No R2 operator steps** required. WP-083 is a validation retrofit — no data is re-uploaded.

---

## Verification Steps (run in order after Commit A; all must pass before Commit B)

Run EC-108 §Verification Steps 1–22 in order. Summary (full text in EC-108):

1. `pnpm install --frozen-lockfile` — 0 exit; `pnpm-lock.yaml` unchanged.
2. `pnpm -r --if-present typecheck` — 0 exit.
3. `pnpm --filter registry-viewer lint` — 0 errors; warnings ≤ post-EC-107 baseline (re-derived at pre-flight).
4. `pnpm -r build` — 0 exit.
5. `pnpm -r --if-present test` — baseline preserved (596 / 0 or post-optional-test-file 601 / 0).
6. Two new schemas present in `schema.ts`; two new schemas + two types exported from `index.ts` (grep count ≥ 4).
7. `theme.schema.ts` + `theme.validate.ts` empty `git diff`.
7.1. **(A-083-04)** `grep -rn "themeSchemaVersion" apps/registry-viewer/src/` — expect zero hits after Commit A.
7.2. **(A-083-04)** `grep -c "\"./theme.schema\"" packages/registry/package.json` — expect 1; `node --input-type=module -e "import { ThemeDefinitionSchema } from '@legendary-arena/registry/theme.schema'; console.log(typeof ThemeDefinitionSchema);"` — expect `object`.
7.3. **(A-083-04)** `grep -nE "from ['\"]@legendary-arena/registry['\"]" apps/registry-viewer/src/lib/registryClient.ts apps/registry-viewer/src/lib/themeClient.ts` — expect no output (no barrel imports).
8. `RegistryConfigSchema` body byte-for-byte preserved (`grep -A 1` match unchanged).
9. Viewer config validates via `ViewerConfigSchema.parse(...)` against `public/registry-config.json` — exit: `"viewer config: OK"`.
10. Themes index fixture validates via `ThemeIndexSchema.parse(...)` — exit: `"theme index probe: OK"`.
11. All local themes validate against `ThemeDefinitionSchema` — `themes ok: N fail: 0` where `N = 69` at 2026-04-21 (re-derive at execution).
12. Inline interfaces removed from both clients (grep count 0).
13. `safeParse` count: 1 in `registryClient.ts`; 2 in `themeClient.ts`.
14. `.parse(` forbidden at fetch boundary — grep count 0.
15. `issue.path.join` present: ≥ 1 in `registryClient.ts`; ≥ 2 in `themeClient.ts`.
16. Full-sentence error prefixes present: ≥ 1 `[RegistryConfig] Rejected` in `registryClient.ts`; ≥ 2 `[Themes] Rejected` in `themeClient.ts`.
17. No engine / preplan / server / pg / boardgame.io imports — grep no output.
18. No `Math.random` / `ctx.random` / `Date.now` — grep count 0.
19. No `.reduce(` — grep count 0.
20. P6-50 paraphrase discipline — no engine vocabulary in JSDoc / comments.
21. CLAUDE.md mentions fetch-time — grep count ≥ 1.
22. `git diff --name-only` — only allowlist files appear.

**Manual DEV smoke (23a–23h):** happy path + four negative tests (invalid metadataBaseUrl type, unknown field, corrupt theme, invalid index, absent rulebookPdfUrl).

**Manual PROD smoke (24a–24b):** `pnpm --filter registry-viewer preview` against production build; repeat 23a–23c.

If any verification step fails, STOP. Do NOT commit B until all pass. If a failure indicates a root-cause bug (not a locked-value mismatch), fix the root cause — do not work around with `--no-verify` or by weakening assertions.

---

## After Completion (Definition of Done — copied from EC-108 §After Completing)

- [ ] Verification Steps 1–22 all pass.
- [ ] Manual DEV smoke (23a–23h) passes.
- [ ] Manual PROD smoke (24a–24b) passes.
- [ ] Test baseline preserved (or extended by +5/+2 if optional schema-parse tests authored, pre-declared).
- [ ] No file outside allowlist modified (`git diff --name-only`).
- [ ] All required `// why:` comments present.
- [ ] All existing `// why:` comments in both clients preserved verbatim.
- [ ] `theme.schema.ts` + `theme.validate.ts` show empty `git diff`.
- [ ] `RegistryConfigSchema` body byte-for-byte unchanged (Step 8).
- [ ] `packages/registry/package.json` contains `"./theme.schema"` entry (Step 7.2) and zero barrel imports in retrofitted clients (Step 7.3).
- [ ] Three-commit topology: A0 `SPEC:` → A `EC-108:` → B `SPEC:` all landed with hook-compliant subjects (no `--no-verify`).
- [ ] `EC_INDEX.md` has EC-108 flipped to Done in Commit B.
- [ ] `WORK_INDEX.md` has WP-083 `[ ]` → `[x]` with date + Commit A hash in Commit B.
- [ ] `DECISIONS.md` has D-083A / D-083B / D-083C / D-083D / D-083E recorded with final numeric IDs.
- [ ] `apps/registry-viewer/CLAUDE.md` updated with fetch-time validation note for both retrofitted clients.
- [ ] WP-083 §Amendments carries A-083-01 / A-083-02 / A-083-03 / A-083-04 (already landed at A0 SPEC).
- [ ] None of the out-of-scope inherited dirty-tree items (per session-context-wp083 §2.3) staged or committed.

---

## Final Instruction

Execute WP-083 by following this prompt's read order, then EC-108's §Locked Values and §Verification Steps verbatim. Ambiguities are resolved — if one surfaces despite the locks, stop and escalate. The session prompt is the **last word** on scope and locked values; it does not introduce new scope. Everything referenced here is traceable to EC-108 + WP-083 + session-context-wp083 + pre-flight v2 + copilot-check v2.

**Go.**
