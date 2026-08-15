# EC-586 — Loadout Import Format Sniff (Execution Checklist)

**Source:** docs/ai/work-packets/WP-551-loadout-import-format-sniff.md
**Layer:** App (`apps/registry-viewer`) — single layer

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] **Sequencing:** this WP and WP-552 were drafted in one SPEC PR. Their code files are DISJOINT (either order is fine) but they share five governance files plus `pnpm roadmap:counts:write` — execute **sequentially, never in parallel worktrees**. If the other landed first, rebase onto it, re-anchor this WP's `DECISIONS.md` append on the newly-landed entry, and re-run `roadmap:counts:write` before committing
- [ ] `pnpm install` then `pnpm -r build` in this worktree **first** — a fresh worktree has no `node_modules` / `dist`, and an absent `dist` reports as failing tests
- [ ] Baseline green + **record the count**: `pnpm --filter registry-viewer test` exit 0. The filter is **`registry-viewer`**, NOT `@legendary-arena/registry-viewer` (that name matches no project and exits 1)
- [ ] All three handlers present: `grep -c "function onPasteImport\|function applyLagnImport\|parseGauntletPack" apps/registry-viewer/src/components/LoadoutBuilder.vue` → **≥ 3**
- [ ] Discriminators are real **in the SCHEMAS, not in prose** (the importers mention these keys only in JSDoc, so grepping them passes vacuously): `node -e "const s=require('./docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json'); process.exit(s.required.includes('schemaVersion')&&s.required.includes('composition')&&s.additionalProperties===false?0:1)"` → exit 0; `node -e "const s=require('./packages/lagn-spec/schemas/lagn-v1.json'); process.exit(s.required.includes('lagn_version')&&s.required.includes('setup')?0:1)"` → exit 0; `grep -n "pack_version" packages/registry/src/gauntletPack.ts` shows the `.strict()` object
- [ ] Capture the CURRENT wrong-box error text for at least one pairing (paste a LAGN fixture through `loadFromJson` in a scratch script) — you need it to prove AC-1 removed the dump

## Locked Values (do not re-derive)
- **Locked signature (do NOT choose between readings):**
  `sniffLoadoutImportFormat(rawText: string): LoadoutImportFormat` where
  `type LoadoutImportFormat = 'match-setup' | 'lagn' | 'gauntlet-pack' | 'unknown'`.
  **The helper parses internally** and returns `unknown` on ANY parse failure — that is
  what makes AC-4's "malformed/non-JSON → `unknown`" assertable at all. Do NOT take a
  pre-parsed value; that reading would push three `JSON.parse` try/catch sites into
  `LoadoutBuilder.vue` and make AC-4 untestable at the helper level.
- **The box parameter is the same union minus `unknown`:** `type LoadoutImportBox = 'match-setup' | 'lagn' | 'gauntlet-pack'`.
- **The lookup is an exported FUNCTION**, not a bare map: `redirectSentenceFor(box: LoadoutImportBox, detected: LoadoutImportFormat): string | null` — `null` when `detected` is `unknown` or equals `box` (no redirect).
- **The helper EXPORTS the redirect lookup** (a `(box, detected) -> sentence` map or function), because `apps/registry-viewer` has **no SFC test harness** — its test script is `node --import tsx --test "src/**/*.test.ts"` with no `@vue/test-utils`, no `jsdom`, no `vue-sfc-loader`, and none of its 22 test files imports a `.vue`. Every assertion therefore lands on the exported helper; box-level behaviour is gated by the D-24026 live-verify, exactly as shipped WP-549 did for its own `.vue` changes. **Do NOT build an SFC harness for this WP.**
- **Multi-match → `unknown`.** A document satisfying more than one discriminator pair is NOT resolved by precedence; it returns `unknown` and gets the real validator errors. Reachable only because LAGN is `additionalProperties: true`.
- **Discriminator pairs (positive-only — BOTH keys required to claim a format):**
  - `match-setup` → `schemaVersion` **and** `composition`
  - `lagn` → `lagn_version` **and** `setup`
  - `gauntlet-pack` → `pack_version` **and** `gauntlet`
  - anything else → `unknown`. Never guess from a single key; never fall back to "probably MATCH-SETUP".
- **Redirect sentences (exact — full sentences per `code-style.md §Error Handling`):**
  - into `Load JSON`, detected LAGN → `This looks like a LAGN file (it has a "lagn_version" field). Use the "Load LAGN" box below instead.`
  - into `Load JSON`, detected pack → `This looks like a Gauntlet Pack (it has a "pack_version" field). Use the "Load Gauntlet Pack" box below instead.`
  - into `Load LAGN`, detected MATCH-SETUP → `This looks like a MATCH-SETUP document (it has a "schemaVersion" field). Use the "Load JSON" box above instead.`
  - into `Load LAGN`, detected pack → `This looks like a Gauntlet Pack (it has a "pack_version" field). Use the "Load Gauntlet Pack" box below instead.`
  - into `Load Gauntlet Pack`, detected MATCH-SETUP → `This looks like a MATCH-SETUP document (it has a "schemaVersion" field). Use the "Load JSON" box above instead.`
  - into `Load Gauntlet Pack`, detected LAGN → `This looks like a LAGN file (it has a "lagn_version" field). Use the "Load LAGN" box above instead.`
- **The redirect REPLACES the validator dump** for that attempt — it is the sole error shown, not an extra line prepended to nine others.
- **The three error sinks have DIFFERENT shapes — match each:**
  - `importErrors` (MATCH-SETUP box) is `Array<{field, message}>` and the template renders `{{ entry.field }}: {{ entry.message }}` (`LoadoutBuilder.vue:1602-1605`). Set `field` to the **empty string**, and have the template omit the `field` span **AND its `: ` separator** when `field` is empty. **The separator sits OUTSIDE the span** (`:1604` is `<span class="error-field">{{ entry.field }}</span>: {{ entry.message }}`), so omitting only the span renders `": This looks like a LAGN file…"` — a leading colon, one character from the `root:` prefix WP §3 exists to remove. Rendering must be **unchanged for every non-empty `field`**. This template tweak is IN scope (the file is allowlisted).
  - `lagnImportErrors` is `string[]` — push the sentence as the single element.
  - `gauntletPackError` is a single `string | null` — assign the sentence. It is NOT a list, so "the error list has length 1" does not apply to that box.
- **DECISIONS reservation:** **D-24360**.

## Guardrails
- **Advisory only.** NEVER auto-route and NEVER auto-load. All three importers **replace** the draft, and a wrong-format paste is often a wrong-*file* paste — auto-loading would destroy the draft the operator was building. The sniff changes the MESSAGE, nothing else.
- Do NOT modify any validator, schema, or its error strings. `unknown` / malformed / non-JSON input must fall through **byte-identically** to today's output.
- Do NOT make any previously-rejected document loadable. This WP adds zero acceptance.
- Do NOT merge the three boxes into one auto-detecting importer (WP §5 Out).
- Do NOT touch `packages/lagn-spec`, `packages/registry`, `apps/server`, or `packages/game-engine`.
- Detection is **positive-only**: both keys of a pair must be present. A document with `lagn_version` but no `setup` is `unknown`, not `lagn`.
- The sniff must be a **pure** function — no Vue reactivity, no I/O, no imports from the three importers (it reads shape only).
- **The redirect path performs the same LEADING resets as each handler already does, then returns before the parser call.** It must **NOT** run any failure-branch teardown — specifically it must **not** clear `gauntletPack.value` (`LoadoutBuilder.vue:905` nulls it on a parse failure, which tears down the loaded pack and its leg picker). Destroying a loaded pack because the operator pasted into the wrong box is the same harm the advisory-only rule exists to prevent.

## Required `// why:` Comments
- On the helper: cite D-24360 — three adjacent boxes take JSON, and the wrong one dumps its own validator's field-level errors; a LAGN pasted into `Load JSON` produced nine of them live on 2026-08-15.
- On the advisory-only decision: auto-routing was rejected because every importer replaces the draft, so silently loading a document the operator did not aim at that box would destroy work.
- On positive-only detection: a partial match is `unknown` so a truncated or hand-edited file still gets the real validator errors rather than a confidently wrong redirect.

## Files to Produce
- `apps/registry-viewer/src/lib/loadoutImportFormat.ts` — **new** — the pure sniff + the six redirect sentences
- `apps/registry-viewer/src/lib/loadoutImportFormat.test.ts` — **new** — discriminator truth table, all six `(box, detected)` pairings against the exported lookup, partial-match / empty / two-pair → `unknown`
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — the three handlers consult the sniff before their parser call; the `importErrors` template omits an empty `field`
- `docs/ai/DECISIONS.md` (D-24360 → Active) · `docs/ai/STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-551 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] AC-1 / AC-2: all six `(box, detected)` pairings return their exact locked sentence from the exported lookup
- [ ] AC-3: all three same-format pairings return NO redirect
- [ ] AC-4: `unknown` for malformed/non-JSON, a partial pair, an empty object, and a two-pair document
- [ ] AC-5: read the diff — each handler returns BEFORE its parser call on a redirect, so the `unknown` path reaches the existing validator errors untouched
- [ ] AC-6 is a **live-verify**, not a unit test: paste a LAGN into `Load JSON` on the deployed viewer — one sentence, no schema dump, draft untouched
- [ ] Scope gate — **range-scoped, allowlist-exact** (a bare `git diff --name-only` lists only UNSTAGED changes and passes vacuously once you commit): `git diff --name-only origin/main...HEAD` must equal exactly `src/lib/loadoutImportFormat.ts`, `src/lib/loadoutImportFormat.test.ts`, `src/components/LoadoutBuilder.vue` (all under `apps/registry-viewer/`) plus the five governance files — **no other file under the app**, and in particular NOT `loadoutLagnImport.test.ts`
- [ ] `pnpm --filter registry-viewer test` + `typecheck` + `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP `✅` + counts refreshed; D-24360 landed (Active)
- [ ] Commit prefix `EC-586:` + `SPEC:`
- [ ] D-24026 live-verify recorded as pending

## Common Failure Smells
- The redirect appears **above** the nine schema errors → it must REPLACE them for that attempt, not decorate them.
- A truncated LAGN (has `lagn_version`, lost `setup`) gets a redirect → positive-only means both keys; a partial match is `unknown` and deserves the real errors.
- The draft got wiped on a wrong-box paste → you auto-loaded. The sniff never loads.
- An existing importer test needed editing → you changed a validator path; only the wrong-box branch is new.
- The helper imports `parseLagnLoadout` / `loadFromJson` to "just try each" → that is auto-routing's slippery slope and re-runs validators; the sniff reads top-level keys only.
- `pnpm --filter @legendary-arena/registry-viewer test` reports "No projects matched" → wrong filter name; it is `registry-viewer`.
