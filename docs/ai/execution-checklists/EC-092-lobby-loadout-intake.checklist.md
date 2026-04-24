# EC-092 — Lobby Loadout Intake (JSON → Create Match) (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-092-lobby-loadout-intake.md`
**Layer:** Client UI (`apps/arena-client/`)

> **Status: DRAFT.** Do not execute until (a) WP-011 and WP-090 are merged on `main`; (b) WP-091 is executed and merged (the JSON shape this packet consumes is what WP-091 authors); (c) WP-093 is executed and merged (the error code + message template are canonicalized there); (d) WP-092 is registered in `WORK_INDEX.md` (done 2026-04-24); (e) the 00.3 lint gate has been re-run against WP-092 and recorded passing (done 2026-04-24); (f) this EC is registered in `EC_INDEX.md`.

## Before Starting

> **STOP** if any checkbox below is false.

- [ ] WP-011 merged: server accepts `POST /games/legendary-arena/create` with `{ numPlayers, setupData }`; CORS allow-list includes `http://localhost:5173`
- [ ] WP-090 merged: `apps/arena-client/src/lobby/lobbyApi.ts` exports `createMatch`, `listMatches`, `joinMatch`, `LobbyMatchSummary`, and `serverUrl`; `LobbyView.vue` renders the 9-field `MatchSetupConfig` manual form; URL-rewrite flow in `App.vue` routes to live branch on `?match=&player=&credentials=`
- [ ] WP-091 merged: Registry Viewer Loadout Builder produces MATCH-SETUP JSON with `heroSelectionMode: "GROUP_STANDARD"` explicitly emitted
- [ ] WP-093 merged: `"unsupported_hero_selection_mode"` error code + verbatim template are canonical in `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` / `MATCH-SETUP-VALIDATION.md` / `DECISIONS.md` D-9300-range entry
- [ ] Baseline captured: `pnpm --filter @legendary-arena/arena-client build` exits 0; `pnpm --filter @legendary-arena/arena-client test` exits 0; counts noted
- [ ] `Select-String -Path "apps\arena-client\src" -Pattern "from '@legendary-arena/registry'" -Recurse` returns no match (zero registry imports pre-session; layer boundary must stay clean)
- [ ] No parallel session is editing `apps/arena-client/src/lobby/LobbyView.vue`

## Session Abort Conditions

Immediately ABORT execution if any of the following occurs:

- `parseLoadoutJson` accepts `"HERO_DRAFT"` (or any non-`"GROUP_STANDARD"`
  value) and returns `{ ok: true }`.
- The parser emits an `"unsupported_hero_selection_mode"` error message
  that is not byte-for-byte identical to the WP-093 template.
- Any code under `apps/arena-client/**` attempts to import
  `@legendary-arena/registry` (runtime or type).
- The submission body passed to `createMatch` includes any envelope
  field other than `playerCount` mapped to `numPlayers`.
- WP-090's manual form logic is modified rather than wrapped
  (changes appear inside the form rather than around it in `git diff`).

## Locked Values (do not re-derive)

- **Composition fields (exactly these nine, verbatim):** `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`
- **Envelope fields consumed by this packet (exactly three):** `playerCount`, `schemaVersion`, `heroSelectionMode`
- **Envelope fields ignored by this packet (dropped on submission):** `setupId`, `createdAt`, `createdBy`, `seed`, `themeId`, `expansions` — *ignored envelope fields are not validated, stored, or forwarded in v1; their preservation is a future server-side archival concern.*
- **`createMatch` submission body (exact shape, matches WP-090):** `{ numPlayers: <envelope.playerCount>, setupData: <composition> }`
- **`heroSelectionMode` v1 allowed values:** `["GROUP_STANDARD"]`; absent treated as `"GROUP_STANDARD"`; everything else rejected
- **Error code for unsupported rule mode (from WP-093):** `"unsupported_hero_selection_mode"`
- **Error message template (from WP-093, verbatim — byte-for-byte; `<value>` is the only permitted substitution):**
  `"The loadout envelope's heroSelectionMode is <value>, which is not a supported rule mode in v1 of the match setup schema. Supported modes: GROUP_STANDARD. (HERO_DRAFT is reserved for a future release and is not yet implemented.)"`
- **Parser error codes (enum — exactly these nine):** `"invalid_json"`, `"not_object"`, `"missing_composition"`, `"composition_not_object"`, `"missing_field"`, `"wrong_type"`, `"missing_player_count"`, `"player_count_out_of_range"`, `"unsupported_hero_selection_mode"`
- **`ParsedLoadout.heroSelectionMode`:** always `"GROUP_STANDARD"` on successful parse (normalized from absent; never `undefined`)
- **Primary JSON-intake section title (verbatim):** `"Create match from loadout JSON (recommended)"`
- **Manual-form collapsible title (verbatim):** `"Fill in manually (advanced)"` — `<details>` closed by default
- *Both UI titles above are regression sentinels in manual smoke and must not be reworded without updating EC-092.*

## Guardrails

- **Layer boundary:** no `from '@legendary-arena/registry'` import anywhere in `apps/arena-client/**`. The shape guard is hand-rolled type predicates.
- **WP-090's 9-field form is preserved byte-for-byte** — field IDs, `v-model` bindings, submission logic unchanged; only visibility (wrapped in `<details>`) changes.
- **Shape guard is a client-side authoring-feedback gate, not a trust boundary.** Authoritative validation remains server-side via `matchSetup.validate.ts`. Do not duplicate composition-field validation beyond the primitive type checks.
- **Error message is not constructed ad-hoc.** A single locked `const` defined at the **top of `parseLoadoutJson.ts`** holds the WP-093 error template; a single named helper (e.g., `renderUnsupportedModeMessage(value)`) performs the `<value>` substitution. Tests and helpers reference this constant directly; no file may retype or paraphrase the string. No template-literal assembly, no alternative phrasing.
- **Composition-only submission.** Only the composition block is forwarded as `setupData`; envelope fields other than `playerCount` (mapped to `numPlayers`) are dropped.
- **No new npm dependencies.** No `ajv`, `jsonschema`, `zod`, or any other validation library.
- **No new runtime engine import site.** `apps/arena-client/src/client/bgioClient.ts` from WP-090 remains the sole runtime engine-import file; `parseLoadoutJson.ts` imports only TypeScript built-in types.
- **No persistence.** No `localStorage` / `sessionStorage` / `IndexedDB` writes. Uploaded JSON is read into memory, validated, submitted, discarded.
- **Parser never throws.** Every failure path returns `{ ok: false, error: ... }`.
- **Normalization of absent `heroSelectionMode` happens only in `parseLoadoutJson`.** UI code (`LobbyView.vue`) and submission helpers (`lobbyApi.ts`) must assume the field is already normalized and must not inject defaults or branch on `undefined`.
- **No additional semantic validation.** The parser must not validate ext_ids, array length semantics, uniqueness, regex patterns, or cross-field constraints. Primitive type checks + rule-mode gate only.

## Required `// why:` Comments

- `parseLoadoutJson.ts` module header — this is a **shape guard**, not a validator; the server performs authoritative ext_id and structural validation
- `parseLoadoutJson.ts` — on `ParsedLoadout.heroSelectionMode`: included so callers can log or branch on rule mode in the future without reparsing the raw JSON; v1 value is always `"GROUP_STANDARD"` per WP-093
- `parseLoadoutJson.ts` — on the locked error-message constant: cite WP-093 as the authoritative source; forbid paraphrasing
- `LobbyView.vue` — on JSON-first layout: WP-091 is now the expected authoring path; the manual form is a power-user fallback
- `LobbyView.vue` — on the `playerCount → numPlayers` mapping at the `createMatch` call site: cites `MATCH-SETUP-SCHEMA.md §Player Count`
- `LobbyView.vue` — on disabling the submit button until parse success: prevents partially parsed or stale JSON from being submitted; ensures `createMatch` is never called with unchecked input

## Files to Produce (Exact Filenames; No Substitutions)

- `apps/arena-client/src/lobby/parseLoadoutJson.ts` — **new** — pure shape-guard parser; nine error codes; locked error-message constant + named substitution helper
- `apps/arena-client/src/lobby/parseLoadoutJson.test.ts` — **new** — `node:test` coverage: every error code, byte-for-byte message equality (`assert.strictEqual`) for `"HERO_DRAFT"` / `"MADE_UP"` / numeric `42`, round-trip for valid docs, permissive on extra envelope fields
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — JSON intake section above WP-090's form; manual form wrapped in `<details>` titled "Fill in manually (advanced)"; all WP-090 bindings preserved
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** — end-to-end regression: `parseLoadoutJson` + `createMatch` stub assert `{ numPlayers, setupData: <composition> }` body shape
- `docs/ai/STATUS.md` — **modified** — WP-092 complete note (user can now upload WP-091 JSON and create a match in one click)
- `docs/ai/DECISIONS.md` — **modified** — D-92xx entries: hand-rolled shape guard over cross-layer registry import; WP-090 form preserved as fallback; envelope dropped on submission; `playerCount → numPlayers` mapping at call site; rule-mode shape guard
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-092 `[ ]` → `[x]` with today's date
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-092 Draft → Done

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0 with zero new TS errors
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0; new `parseLoadoutJson.test.ts` + extended `lobbyApi.test.ts` pass
- [ ] `Select-String -Path "apps\arena-client\src" -Pattern "from '@legendary-arena/registry'" -Recurse` returns no match
- [ ] `Select-String -Path "apps\arena-client\src" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }` returns exactly one match, in `src/client/bgioClient.ts` (WP-090 carve-out unchanged)
- [ ] `Select-String -Path "apps\arena-client\src\lobby\parseLoadoutJson.ts" -Pattern "zod|ajv|jsonschema|boardgame.io|@legendary-arena"` returns no match
- [ ] `Select-String -Path "apps\arena-client\src\lobby\parseLoadoutJson.ts" -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"` returns ≥ 9 matches
- [ ] `Select-String -Path "apps\arena-client\src\lobby\parseLoadoutJson.ts" -Pattern "heroSelectionMode|GROUP_STANDARD|unsupported_hero_selection_mode"` returns multiple matches (type + normalization + constant + helper)
- [ ] `Select-String -Path "apps\arena-client\src\lobby\LobbyView.vue" -Pattern "v-model=\`"(schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount)\`""` returns exactly 9 matches (WP-090 bindings preserved)
- [ ] `git diff apps/arena-client/package.json` shows no changes
- [ ] Smoke-boot end-to-end: Terminal A runs server; Terminal B runs arena-client dev; (1) Paste valid WP-091 JSON → match created, URL rewrites, live HUD renders; (2) Upload same JSON via file input → same flow; (3) Malformed JSON → full-sentence error, submit disabled; (4) JSON missing `composition` → correct error code/message; (5) Manual-form fallback still creates a match; (6) Fixture path (`?fixture=mid-turn`) unregressed. Recorded in session invocation with screenshots.
- [ ] `git diff --name-only packages/ apps/server/ apps/registry-viewer/` returns empty
- [ ] `git diff --name-only` lists only files under `## Files to Produce (Exact Filenames; No Substitutions)`

## Common Failure Smells

- Test passes `assert.ok(error.message.includes("not supported"))` → substring match; byte-for-byte rule was relaxed (use `assert.strictEqual` on the full message)
- Error message reads "heroSelectionMode value not recognized" or any paraphrase → constructed ad-hoc; fix by extracting the WP-093 template to a `const` and using the named helper for `<value>` substitution
- `ParsedLoadout.heroSelectionMode` is typed `HeroSelectionMode | undefined` → normalization was skipped; Step 7 of the parser must materialize `"GROUP_STANDARD"` on absent input
- Submission body includes envelope fields (`seed`, `setupId`, etc.) → composition-only rule violated; only `{ numPlayers, setupData: composition }` goes on the wire
- `apps/arena-client/src/` gains `import { … } from '@legendary-arena/registry'` → layer boundary breach; the shape guard is hand-rolled precisely to avoid this
- WP-090's 9 `v-model` bindings in `LobbyView.vue` differ from the baseline → manual form modified rather than wrapped; `git diff` should show additive changes only around the form, not inside it
- Uploaded JSON with `heroSelectionMode: "HERO_DRAFT"` creates a match → rule-mode check bypassed; the shape guard must gate submission
- Fixture path test (`?fixture=mid-turn`) breaks → JSON-intake UI mounted outside the lobby branch; intake lives only in `<LobbyView />`
- Tests assert on the rendered UI error string instead of the parser error message constant → UI-layer coupling; tests must target the parser output
- Parser returns `{ ok: false }` without a `field` for field-specific errors → reduces debuggability; include `field` whenever applicable
