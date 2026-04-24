# WP-092 — Lobby Loadout Intake (JSON → Create Match)

**Status:** Draft (awaiting review)
**Primary Layer:** Client UI (arena-client)
**Dependencies:** WP-011 (lobby HTTP endpoints — `POST
/games/legendary-arena/create`), WP-090 (arena-client lobby view + 9-
field create-match form), WP-091 (registry-viewer loadout builder that
produces MATCH-SETUP JSON documents), **WP-093 (Match-Setup Rule-Mode
Envelope Field — canonicalizes `heroSelectionMode` / error code
`"unsupported_hero_selection_mode"` / full-sentence error template;
transitive prerequisite via WP-091).** WP-091 is a hard dependency —
the JSON shape this packet consumes is the one WP-091 authors.
WP-090 is a hard dependency — the lobby view being extended is its
artifact. WP-093 is a hard dependency — the rule-mode handling in
this packet's shape guard matches WP-093's canonical error code and
message template byte-for-byte.

---

## Session Context

WP-011 added the boardgame.io lobby HTTP endpoints. WP-090 wired the
arena-client's first browser-gameplay surface and ships a create-match
form with nine verbatim `MatchSetupConfig` text fields; manually filling
those fields with ext_ids is awkward at best. WP-091 solves the
authoring side by adding a Loadout Builder tab in the Registry Viewer
that exports a MATCH-SETUP JSON document (envelope + composition) per
`docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md`. **WP-093 canonicalizes
`heroSelectionMode` as an optional envelope field with v1 enum
`["GROUP_STANDARD"]`, the error code
`"unsupported_hero_selection_mode"`, and the full-sentence error
message template consumed verbatim by this packet's shape guard.**
This packet closes the loop: the arena-client lobby accepts the
WP-091-produced JSON (via file upload or paste), parses and shape-guards
it client-side (including a rule-mode check that rejects any
`heroSelectionMode` other than `"GROUP_STANDARD"` or absent), extracts
the composition block, and submits the **composition block only** as
`setupData` to the existing `POST /games/legendary-arena/create`
endpoint. The 9-field manual form from WP-090 is retained as a fallback
for power users.

**Non-authoritative posture (explicit):** the rule-mode check
performed by this packet is a **client-side shape guard for authoring
feedback only**; authoritative enforcement and any semantic
interpretation of `heroSelectionMode` remain server-side and are out
of scope for this packet. Shape-guard rejection in the lobby is a UX
improvement — it tells a user who uploaded a bad JSON what is wrong
without making a network round-trip — not a trust boundary. The
engine's `validateMatchSetup()` inside `Game.setup()` is the
authoritative composition gate, and a future server-side Stage 1
validator will be the authoritative envelope gate.

**Cross-WP consistency:** this packet intentionally mirrors WP-091's
explicit-emission + default-normalization behavior so that
registry-viewer-authored documents and hand-authored documents are
treated identically by the intake flow. Both WP-091 (validator
output) and WP-092 (parser output) materialize
`heroSelectionMode: "GROUP_STANDARD"` on absent input per WP-093
backward-compat semantics; neither packet shares a helper (layer
rule forbids arena-client from importing registry), but both land
the same observable behavior.

---

## Goal

After this session, `apps/arena-client/src/lobby/LobbyView.vue`:

- Exposes a primary "Create match from loadout JSON (recommended)" affordance that
  accepts either a file upload or a pasted JSON string.
- Parses the uploaded/pasted text, runs a lightweight shape guard
  (JSON validity, required composition fields, correct primitive
  types), and surfaces any failure as a full-sentence error in a
  visible region above the affordance — no `alert()`, no silent
  swallow.
- On successful shape guard, extracts the `composition` block and
  calls `createMatch(composition, envelope.playerCount)` (the helper
  added in WP-090), then `joinMatch(...)` and the existing URL-rewrite
  flow that WP-090 already wired. The match is created using the
  authoritative server-side `validateMatchSetup()` — this packet does
  **not** weaken the trust boundary.
- Retains WP-090's 9-field manual form as a secondary "Fill manually"
  collapsible section for users without a JSON.
- Ships a pure parser module `parseLoadoutJson.ts` with full `node:test`
  coverage; the parser imports **no** engine or registry code (layer
  boundary — arena-client may not import registry at runtime).

No new HTTP client, no new server endpoint, no server-side envelope
validation, no persistence, no auth, no user profile integration, no
cross-layer registry import, no boardgame.io move-side changes.

---

## Assumes

- WP-011 complete. Specifically:
  - `apps/server` accepts `POST /games/legendary-arena/create` with
    body `{ numPlayers, setupData }` where `setupData` matches the
    9-field `MatchSetupConfig` composition shape
  - The CORS allow-list in [server.mjs](apps/server/src/server.mjs)
    already includes `http://localhost:5173`
- WP-090 complete. Specifically:
  - `apps/arena-client/src/lobby/lobbyApi.ts` exports `createMatch`,
    `listMatches`, `joinMatch`, and the `LobbyMatchSummary` type
  - `apps/arena-client/src/lobby/LobbyView.vue` renders a
    create-match form containing exactly the nine `MatchSetupConfig`
    text fields plus `numPlayers`
  - `createMatch(config, numPlayers)` posts the composition block as
    `setupData` verbatim (no translation) to the lobby endpoint
  - `apps/arena-client/src/App.vue` routes to `<LobbyView />` when no
    `?match=` or `?fixture=` query string is present
  - The WP-090 DECISIONS entry clarifying the `join` endpoint
    credentials field is landed and `joinMatch` returns
    `{ playerCredentials }`
- WP-091 complete. Specifically:
  - The Loadout Builder in `cards.barefootbetters.com` produces
    MATCH-SETUP documents that match `MATCH-SETUP-JSON-SCHEMA.json`
  - The composition block in the exported JSON is exactly the nine
    locked fields from 00.2 §8.1 — the parser in this packet can
    rely on the shape
  - The envelope in the exported JSON always carries
    `heroSelectionMode: "GROUP_STANDARD"` explicitly (per WP-091's
    "explicit emission" rule); the parser in this packet can rely on
    the field being present in WP-091-authored documents, but must
    still handle absent (legacy/hand-authored) documents by treating
    them as `"GROUP_STANDARD"` per WP-093 backward-compat semantics
- WP-093 complete. Specifically:
  - `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md`,
    `MATCH-SETUP-JSON-SCHEMA.json`, and `MATCH-SETUP-VALIDATION.md`
    canonicalize `heroSelectionMode` with v1 enum `["GROUP_STANDARD"]`,
    optional, default `"GROUP_STANDARD"` when absent
  - `docs/ai/DECISIONS.md` contains the D-9300-range entry defining
    the error code `"unsupported_hero_selection_mode"` and the
    full-sentence error message template this packet's shape guard
    emits verbatim when a document declares an unsupported mode
- `pnpm --filter @legendary-arena/arena-client build` exits 0
- `pnpm --filter @legendary-arena/arena-client test` exits 0
- `docs/ai/ARCHITECTURE.md` exists
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the
  arena-client app may import `@legendary-arena/game-engine` only as
  types (with WP-090's explicit runtime carve-out for
  `LegendaryGame` in `bgioClient.ts`). The arena-client must **not**
  import `@legendary-arena/registry` at runtime. This packet therefore
  implements a **lightweight shape guard** in arena-client rather
  than calling `validateMatchSetupDocument` from the registry package.
  The shape guard is intentionally weaker than the registry-side
  validator — its job is to catch obvious garbage and surface
  typed errors before submission; authoritative validation remains
  server-side (`matchSetup.validate.ts` inside `Game.setup()`).
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md §Two-Layer Structure` —
  the envelope + composition structure. This packet consumes both
  layers: envelope provides `playerCount` (forwarded to
  `createMatch`), composition is submitted as `setupData`.
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` — read the full
  JSON Schema. The client-side shape guard does **not** re-implement
  every constraint (no regex checks, no minLength, no uniqueItems)
  — those are the server's authoritative responsibility. The guard
  only checks: valid JSON, root is object, `composition` exists and is
  an object, all nine composition fields exist with correct primitive
  types, `playerCount` exists at the envelope level and is an integer
  in `[1, 5]`.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1 Match
  Configuration` — the nine composition field names are locked. They
  must appear verbatim in the parser and in any error message that
  references a field. No abbreviation or rename.
- `apps/arena-client/src/lobby/LobbyView.vue` — read the full file as
  produced by WP-090. The new JSON intake integrates **above** the
  existing form, which becomes a collapsible "Fill manually"
  subsection. Do not rewrite the form — it is a locked WP-090
  contract; only its visibility and placement change.
- `apps/arena-client/src/lobby/lobbyApi.ts` — the `createMatch` and
  `joinMatch` helpers are the submission surface. This packet adds
  no new HTTP call; it re-uses them verbatim.
- `apps/arena-client/src/App.vue` — read the URL-rewrite logic that
  WP-090 wired after `joinMatch` returns. This packet's submission
  flow must rewrite `window.location.search` to the same
  `?match=...&player=0&credentials=...` shape so the existing live-
  match branch takes over on reload.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-
  negotiable constraints: clients submit intent, not outcomes; the
  server/engine is the sole authority on validity. This packet
  explicitly does **not** duplicate server-side validation.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations),
  Rule 6 (`// why:` comments), Rule 11 (full-sentence error
  messages), Rule 13 (ESM only), Rule 14 (field names match data
  contract).
- `docs/ai/DECISIONS.md` — scan for prior decisions on setup
  submission, lobby UX, and client-side validation scope.
- `.claude/rules/architecture.md §Layer Overview` — confirms
  arena-client's forbidden runtime imports include `registry`. The
  shape guard is therefore internal to arena-client and cannot
  reference the registry-side validator.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
  (not applicable to this packet; client performs no RNG)
- Never throw inside boardgame.io move functions — return void on
  invalid input (not applicable; no moves in scope)
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md
  §Section 3
- `G` must be JSON-serializable at all times — no class instances,
  Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never
  `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`,
  `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output —
  no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **No import from `@legendary-arena/registry`** anywhere in
  `apps/arena-client/**`. Layer rules forbid runtime registry imports
  in arena-client; adding a carve-out is out of scope for this packet.
  The shape guard is implemented with hand-rolled type predicates.
- **No new npm dependencies.** No `ajv`, `jsonschema`, `zod`, or any
  JSON Schema runtime in arena-client. The guard is ~60 lines of
  TypeScript type predicates.
- **No server-side changes.** `apps/server/**` is untouched. Server-
  side envelope validation (`MATCH-SETUP-VALIDATION.md` Stage 1) is
  deferred to a future WP that is expected to land alongside user-
  profile / loadout-persistence work, when envelope archival becomes
  functionally relevant.
- **No engine-side changes.** `packages/game-engine/**` is untouched.
- **No registry-side changes.** `packages/registry/**` is untouched.
  The `setupContract` module from WP-091 is not imported by this
  packet.
- **No changes to the WP-090 form.** The nine-field manual form in
  `LobbyView.vue` is repositioned (wrapped in a collapsible section)
  but its internal structure, field names, and submission logic are
  preserved byte-for-byte where possible. If any form-handling code
  must move, move it as-is — no refactor.
- **No changes to `lobbyApi.ts`.** Its signatures are final per
  WP-090. The JSON intake calls `createMatch` and `joinMatch`
  exactly as the manual form does.
- **Parser imports nothing beyond built-in types.** No `fetch`, no
  `window`, no `document` inside the parser module — it is a pure
  function that takes a string and returns a typed result. UI-level
  concerns (file reading, download triggering) live in `LobbyView.vue`.
- **All error messages are full sentences** — per 00.6 rule 11. The
  parser's error messages identify the offending field path and what
  the user should check (e.g., "The loadout JSON is missing the
  required composition field 'schemeId' — confirm the file was
  produced by the Registry Viewer loadout builder.").
- **All nine composition field names verbatim** — same list as WP-091
  (see Locked Contract Values).
- **No `localStorage` / `sessionStorage` / `IndexedDB` writes** — the
  uploaded JSON is read into memory, validated, submitted, and
  discarded. No client-side persistence.
- **Layer-boundary guard preserved** — after this packet,
  `apps/arena-client/src/**` continues to have exactly one runtime
  engine import (WP-090's `bgioClient.ts` for `LegendaryGame`) and
  zero runtime registry imports.

**Session protocol:**
- If the shape guard surfaces a case that reveals a real bug in
  WP-091's exporter (e.g., the builder is producing JSON with the
  wrong field type), stop and open a follow-up WP to fix WP-091 —
  do not patch around the bug in WP-092.
- If the WP-090 form layout needs more than a wrapping
  `<details>` / collapsible container to accommodate the new JSON
  intake above it, stop and ask before refactoring the form.
- If the `/games/legendary-arena/create` endpoint shape has drifted
  from what WP-090 documented, stop and ask — the JSON intake must
  submit the exact same body shape that WP-090's manual form
  submits.

**Locked contract values (paste verbatim — do not paraphrase):**

- **MatchSetupConfig composition fields** (exactly these nine, in
  this order, in the parser and every UI reference):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **Envelope fields consumed by this packet** (exactly these three):
  `playerCount` (integer 1..5, forwarded to `createMatch` as
  `numPlayers`), `schemaVersion` (string `"1.0"` — verified but not
  otherwise consumed), `heroSelectionMode` (optional, must be
  `"GROUP_STANDARD"` or absent; rejected with the WP-093 error
  template otherwise)

- **`heroSelectionMode` handling** (canonical per WP-093):
  - Allowed values in v1: `["GROUP_STANDARD"]` — exactly one
  - Required in the JSON: **false** (optional)
  - Default when absent: `"GROUP_STANDARD"` (backward compat; the
    parser normalizes on output to the same behavior as WP-091)
  - Rejected values: anything other than `"GROUP_STANDARD"` — any
    other string value (e.g., `"HERO_DRAFT"`, `"MADE_UP"`) and any
    non-string type (e.g., numbers, booleans, arrays, objects) —
    surfaced as error code `"unsupported_hero_selection_mode"` with
    the full-sentence template below, verbatim
  - Error message template (copy byte-for-byte from WP-093):
    `"The loadout envelope's heroSelectionMode is <value>, which is not a supported rule mode in v1 of the match setup schema. Supported modes: GROUP_STANDARD. (HERO_DRAFT is reserved for a future release and is not yet implemented.)"`

- **Envelope fields ignored by this packet** (preserved in the JSON
  for future archival but not parsed or acted upon):
  `setupId`, `createdAt`, `createdBy`, `seed`, `themeId`, `expansions`
  — the client forwards only the composition block as `setupData`;
  envelope archival is deferred to a later WP. This packet
  intentionally discards the envelope on submission because the
  current `POST /games/legendary-arena/create` endpoint accepts
  only the composition block as `setupData`; preserving the
  envelope for archival (replay indexing, seed reproduction,
  `setupId` uniqueness checks, `themeId` analytics) requires
  server-side persistence that does not exist yet. The future WP
  that introduces envelope persistence will either extend the
  create endpoint or add a parallel ingestion path; until then,
  dropping the envelope here is the right answer and "why didn't
  we forward the envelope?" has a documented answer on this line.

- **`createMatch` submission body** (exactly this shape — matches
  WP-090):
  `{ numPlayers: <envelope.playerCount>, setupData: <composition> }`

- **Parser error codes** (enum of exactly these literal strings):
  `"invalid_json"` | `"not_object"` | `"missing_composition"` |
  `"composition_not_object"` | `"missing_field"` | `"wrong_type"` |
  `"missing_player_count"` | `"player_count_out_of_range"` |
  `"unsupported_hero_selection_mode"` (the last one is canonicalized
  by WP-093 and must match that WP's DECISIONS entry byte-for-byte)

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via
deterministic reproduction and state inspection.

- `parseLoadoutJson(text)` is a pure function. Given identical input it
  produces identical output. Every failure path surfaces a typed
  error code and full-sentence message so UI bugs can be reproduced
  by pasting the same string.
- Upload and paste paths flow through the same parser — a bug in one
  reproduces in the other. The `<input type="file">` handler reads
  the file into a string via `FileReader` and hands the string to
  `parseLoadoutJson` unchanged.
- Submission failures surface through WP-090's existing `createMatch`
  / `joinMatch` error path — this packet adds no parallel error
  channel. The "Create match" button disables while the request is
  in flight to prevent double-submit.
- No `console.error` for user-visible errors — all errors render
  into the visible error region. `console.warn` is permitted for
  dev diagnostics that never surface to the UI.
- The existing dev fixture path (`?fixture=<name>`) is unaffected —
  regression guard in `bgioClient.test.ts` from WP-090 still passes.

---

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness), §4 (Faithful
Multiplayer Experience), NG-1..7 (monetization proximity — no paid
feature added).

**Conflict assertion:** No conflict. This packet preserves all touched
clauses:

- §3 — The client-side shape guard is explicitly **not** a trust
  boundary. Authoritative validation remains server-side via
  `matchSetup.validate.ts`. The guard exists only to fail fast on
  obvious garbage and to keep the submission payload well-formed;
  the server rejects anything the guard misses.
- §4 — Multiplayer correctness is unchanged: the submitted
  composition block is identical in shape to what WP-090's manual
  form submits, so match creation, per-player seating, and state
  propagation (via WP-089's `playerView`) are unaffected.
- NG-1..7 — Loadout intake is free tooling; no paid tier, no
  loot-box proximity, no randomized purchase surface.

**Non-Goal proximity check:** None of NG-1..7 are crossed.

**Determinism preservation:** The envelope's `seed` field is preserved
verbatim in any downstream archival but is not parsed or mutated by
this packet. The engine's `ctx.random` receives its own boardgame.io-
provided PRNG; wiring the envelope `seed` into `ctx.random` is a
future integration concern documented in `MATCH-SETUP-SCHEMA.md §Seed
(Determinism Anchor)` and is out of scope here. Replay faithfulness
(Vision §22) is preserved — the composition submitted is the same one
the engine's validator consumes.

---

## Scope (In)

### A) Shape-guard parser module

- **`apps/arena-client/src/lobby/parseLoadoutJson.ts`** — new:
  - `export type HeroSelectionMode = "GROUP_STANDARD"` — literal-union
    type; v1 has exactly one member per WP-093. `// why:` comment
    references WP-093 as the canonical source; future additions
    (e.g., `"HERO_DRAFT"`) require a new WP that amends WP-093 first.
  - `export interface ParsedLoadout { composition: { schemeId: string;
    mastermindId: string; villainGroupIds: string[];
    henchmanGroupIds: string[]; heroDeckIds: string[];
    bystandersCount: number; woundsCount: number;
    officersCount: number; sidekicksCount: number };
    playerCount: number; heroSelectionMode: HeroSelectionMode }` —
    the three data surfaces this packet consumes; other envelope
    fields are discarded by the parser. `heroSelectionMode` is
    normalized to `"GROUP_STANDARD"` by the parser when the input
    JSON omits it, so downstream callers never see `undefined`.
    Add a `// why:` comment on the `heroSelectionMode` field:
    "included so callers can log or branch on rule mode in the
    future without reparsing the raw JSON; v1 value is always
    `\"GROUP_STANDARD\"` per WP-093."
  - `export type ParseErrorCode` — union of the nine literal codes in
    Locked Contract Values (including
    `"unsupported_hero_selection_mode"`)
  - `export interface ParseError { code: ParseErrorCode; message:
    string; field?: string }`
  - `export type ParseResult = { ok: true; value: ParsedLoadout } |
    { ok: false; error: ParseError }`
  - `export function parseLoadoutJson(input: string): ParseResult`
    — pure function, never throws. Control flow:
    1. `JSON.parse(input)` in try/catch → on SyntaxError return
       `{ ok: false, error: { code: 'invalid_json', message: ... } }`
    2. Check root is a non-null object → else `'not_object'`
    3. Check `composition` property exists → else
       `'missing_composition'`
    4. Check `composition` is a non-null object → else
       `'composition_not_object'`
    5. For each of the nine composition fields: check presence
       → `'missing_field'`; check primitive type (string for IDs,
       string[] for arrays, integer-valued number for counts)
       → `'wrong_type'`
    6. Check envelope `playerCount` exists and is an integer
       → `'missing_player_count'`; check `1 ≤ playerCount ≤ 5`
       → `'player_count_out_of_range'`
    7. Rule-mode check: if envelope has a `heroSelectionMode`
       property, it must be the string `"GROUP_STANDARD"`; any other
       value or type (including non-string types like numbers,
       booleans, arrays, objects) returns
       `'unsupported_hero_selection_mode'` with the verbatim WP-093
       error-message template and `field: "heroSelectionMode"`. If
       the property is absent, default to `"GROUP_STANDARD"` per
       WP-093 backward-compat semantics.
    8. Return `{ ok: true, value: { composition, playerCount,
       heroSelectionMode } }` with `heroSelectionMode` always set to
       `"GROUP_STANDARD"` in v1 (either from input or defaulted).
  - Array type checks verify `Array.isArray(x)` and every entry is a
    non-empty string. Empty arrays and non-string entries return
    `'wrong_type'`.
  - Integer checks use `Number.isInteger(x)` to reject `3.5` and
    `NaN`.
  - Every error message is a full sentence naming the field path
    (e.g., `"composition.villainGroupIds"`) and telling the user what
    to do (e.g., "...confirm the file was produced by the Registry
    Viewer loadout builder at cards.barefootbetters.com.").
  - Add `// why:` comment at the top of the file explaining that
    this is a **shape guard**, not a validator — the server performs
    authoritative ext_id and structural validation, and this guard
    only catches obvious garbage before submission.
  - No imports from `@legendary-arena/registry`, `@legendary-arena/
    game-engine`, `zod`, `ajv`, or any other external package. Only
    TypeScript built-in types.

### B) Parser tests

- **`apps/arena-client/src/lobby/parseLoadoutJson.test.ts`** — new:
  - Valid minimal document (one entry per array, valid counts,
    `playerCount: 2`) → `{ ok: true }`; returned value's composition
    matches the input
  - Valid document with multiple entries per array →
    `{ ok: true }`
  - Invalid: malformed JSON → `code: 'invalid_json'`
  - Invalid: root is an array / number / null → `code: 'not_object'`
  - Invalid: no `composition` key → `code: 'missing_composition'`
  - Invalid: `composition: null` / `composition: "string"` →
    `code: 'composition_not_object'`
  - For each of the nine composition fields: missing →
    `code: 'missing_field'` with `field` naming the field
  - For each of the nine composition fields: wrong type →
    `code: 'wrong_type'` with `field` naming the field (e.g., pass
    a number for `schemeId`, pass a string for `bystandersCount`,
    pass a non-array for `villainGroupIds`, pass an array with a
    non-string entry for `heroDeckIds`)
  - Invalid: `bystandersCount: 3.5` → `code: 'wrong_type'` (integers
    only)
  - Invalid: `bystandersCount: -1` → `code: 'wrong_type'` (non-
    negative integers only)
  - Invalid: `playerCount` missing → `code: 'missing_player_count'`
  - Invalid: `playerCount: 0` / `playerCount: 6` →
    `code: 'player_count_out_of_range'`
  - Valid document with extra envelope fields (`setupId`,
    `createdAt`, `createdBy`, `seed`, `themeId`, `expansions`) →
    `{ ok: true }`; those fields are ignored but do not trigger
    errors (the parser is **permissive on envelope extras** because
    envelope validation is a future server-side concern)
  - Valid document with `heroSelectionMode: "GROUP_STANDARD"` →
    `{ ok: true }`; returned `value.heroSelectionMode ===
    "GROUP_STANDARD"`
  - Valid document with `heroSelectionMode` absent → `{ ok: true }`;
    returned `value.heroSelectionMode === "GROUP_STANDARD"`
    (default materialized per WP-093 backward-compat)
  - Invalid: `heroSelectionMode: "HERO_DRAFT"` →
    `code: 'unsupported_hero_selection_mode'`; `field:
    "heroSelectionMode"`; message body matches the WP-093 template
    verbatim (test asserts exact-string equality, not substring)
  - Invalid: `heroSelectionMode: "MADE_UP"` → same rejection
  - Invalid: `heroSelectionMode: 42` (non-string) →
    `code: 'unsupported_hero_selection_mode'` (the parser treats
    non-string modes as unsupported, surfacing the same full-sentence
    message with `42` substituted in the `<value>` placeholder)
  - Every error message is a full sentence containing the field
    path where applicable
  - All tests use `node:test` + `node:assert`.
  - No `fetch` stubs, no DOM, no `jsdom` — the parser is pure.
  - No import from `boardgame.io`, `@legendary-arena/game-engine`,
    `@legendary-arena/registry`.

### C) Lobby view JSON intake UI

- **`apps/arena-client/src/lobby/LobbyView.vue`** — modified:
  - Add a new section **above** the existing create-match form,
    titled "Create match from loadout JSON (recommended)":
    - File upload: `<input type="file" accept="application/json,.json">`
      with a label prompting "Upload a loadout JSON file"
    - Paste area: a collapsible `<details>` containing a `<textarea>`
      and a "Parse pasted JSON" button
    - Error region: a visible div that renders the parser's
      full-sentence error message when `ok: false`
    - Submit button: "Create match from loadout" — disabled while
      no valid parse is cached and while submission is in flight
  - Uploaded files are read via `FileReader.readAsText(file)`; the
    resulting string is handed to `parseLoadoutJson` unchanged
  - On successful parse, the button is enabled; on click, the
    submission flow runs:
    1. Call `createMatch(parsed.composition, parsed.playerCount)` —
       note: the helper's parameter name is `numPlayers` inside
       WP-090's `lobbyApi.ts`; the mapping from envelope
       `playerCount` to `numPlayers` happens at the call site with a
       `// why:` comment referencing the envelope-to-engine mapping
       in `MATCH-SETUP-SCHEMA.md §Player Count`
    2. On success, call `joinMatch(matchID, '0', playerName)` — use
       a simple text input for `playerName` (shared with the manual
       form; do not duplicate the input)
    3. Rewrite `window.location.search` to
       `?match=${matchID}&player=0&credentials=${credentials}` —
       identical to WP-090's post-create flow
  - Wrap the existing 9-field manual form in a `<details>` element
    titled "Fill in manually (advanced)" so the JSON intake is the
    primary surface and the manual form becomes a fallback:
    - The `<details>` is closed by default
    - All existing form field IDs, names, `v-model` bindings, and
      submission handlers are preserved byte-for-byte
    - The existing "Create" / "Join" buttons inside the manual form
      continue to work unchanged
  - Add `// why:` comment on the JSON-first layout explaining that
    WP-091 is now the expected authoring path and the manual form is
    a power-user fallback
  - Add `// why:` comment on the `playerCount → numPlayers` mapping
    at the `createMatch` call site

### D) Regression coverage

- **`apps/arena-client/src/lobby/LobbyView.test.ts`** — modified (or
  new, if WP-090 did not introduce a LobbyView test file):
  - Check whether WP-090's test surface includes a LobbyView.vue
    component test. If yes, extend it; if no (arena-client's tests
    are centralized in `bgioClient.test.ts` / `lobbyApi.test.ts`),
    extend the existing `lobbyApi.test.ts` with a test that runs a
    fixed valid JSON through `parseLoadoutJson` and then asserts the
    mocked `createMatch` stub receives `{ numPlayers: 2, setupData:
    <composition> }` — confirming the end-to-end shape mapping
  - The regression test must verify that the manual form's
    submission path is **also** unchanged (i.e., the original
    WP-090 test still passes).
  - `// why:` comment on the new test explaining that it is a
    scope-guard for WP-090 compatibility.
  - Uses `node:test` + `node:assert` only; no `boardgame.io/testing`;
    no live server contact; `fetch` is stubbed at `globalThis.fetch`.

### E) Status doc + index update (see Definition of Done)

No additional `Scope (In)` deliverable. STATUS/DECISIONS/WORK_INDEX
updates are covered in Definition of Done.

---

## Out of Scope

- No server-side envelope validation — `MATCH-SETUP-VALIDATION.md`
  Stage 1 is deferred to a later WP (likely alongside user-profile
  work when envelope archival becomes relevant).
- No server-side `setupData` schema tightening — the existing
  `validateSetupData` + `validateMatchSetup()` path is authoritative
  and unchanged.
- No envelope archival — the `setupId`, `seed`, `createdAt`,
  `createdBy`, `themeId`, and `expansions` fields are dropped on
  submission (the server only receives the composition). Archival is
  a future WP.
- No user accounts, user profiles, or saved-loadout library — same
  deferral as WP-091.
- No cross-layer registry import in arena-client — this packet
  preserves WP-061's "type-only engine, zero registry" rule. Sharing
  the WP-091 validator with arena-client requires a new DECISIONS
  entry and a layer-rule carve-out, which is a separate WP.
- No `ajv` / `jsonschema` / `zod` dependency in arena-client.
- No changes to `packages/game-engine/**`, `packages/registry/**`,
  or `apps/server/**`.
- No changes to WP-090's form fields, field names, or submission
  body shape — only visibility and placement change.
- No router library; no `history.pushState` — the URL-rewrite
  mechanism from WP-090 is preserved verbatim.
- No new HTTP client — browser-native `fetch` (via WP-090's
  `lobbyApi.ts`) is the sole network surface.
- No `localStorage` / `sessionStorage` / `IndexedDB` writes —
  credentials continue to live in the URL query string (WP-052
  scope).
- No i18n; English-only strings.
- Refactors, cleanups, or "while I'm here" improvements are
  **out of scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/arena-client/src/lobby/parseLoadoutJson.ts` — **new** —
  pure shape-guard parser for uploaded/pasted MATCH-SETUP JSON
- `apps/arena-client/src/lobby/parseLoadoutJson.test.ts` — **new**
  — `node:test` coverage of every error code + valid paths
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — adds
  JSON intake section above the manual form; wraps the WP-090 form
  in a collapsible `<details>`; preserves all form submission logic
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** —
  adds a regression test that `parseLoadoutJson` + `createMatch`
  compose correctly (verifies the envelope `playerCount` →
  `numPlayers` mapping)

No other files may be modified.

---

## Acceptance Criteria

### A) Parser
- [ ] `parseLoadoutJson.ts` exports exactly: `ParsedLoadout`,
      `ParseErrorCode`, `ParseError`, `ParseResult`,
      `parseLoadoutJson`
- [ ] `parseLoadoutJson` never throws — every non-ok path returns
      `{ ok: false, error: ... }` (verified by test: passing
      arbitrary garbage strings does not throw)
- [ ] Every `ParseErrorCode` literal is covered by at least one
      test case (including `"unsupported_hero_selection_mode"`)
- [ ] Every error message is a full sentence containing the field
      path where applicable (verified by `Select-String` for
      sentence-ending punctuation in every error message literal)
- [ ] The `"unsupported_hero_selection_mode"` error message matches
      the WP-093 template byte-for-byte (test asserts exact-string
      equality on the concrete message, with `<value>` substitution
      verified for `"HERO_DRAFT"`, `"MADE_UP"`, and the number `42`)
- [ ] The `"unsupported_hero_selection_mode"` error message is
      **not constructed ad-hoc** in the parser — no template-literal
      assembly, no string interpolation in the parser's control
      flow, no alternative phrasing. The message must be sourced
      from a single locked constant literal at the top of
      `parseLoadoutJson.ts` that matches the WP-093 template
      byte-for-byte. Substitution of `<value>` is the only permitted
      transformation, and it must happen via a single well-named
      helper (e.g., `renderUnsupportedModeMessage(value)`) that
      takes the observed value as an argument and returns the
      locked string with the single substitution applied. Verified
      by: (a) code inspection — the constant is declared exactly
      once and referenced by the helper; (b) test — exact-string
      equality as above; (c) grep — `Select-String` confirms no
      alternative `"is not a supported rule mode"` or similar
      phrasings leaked in.
- [ ] The parser's `ParsedLoadout.heroSelectionMode` is always the
      literal `"GROUP_STANDARD"` on a successful parse (whether the
      input JSON contained the field or omitted it)
- [ ] No import from `@legendary-arena/registry`,
      `@legendary-arena/game-engine`, `boardgame.io`, `zod`, `ajv`,
      or any external validation library

### B) UI intake
- [ ] `LobbyView.vue` renders a "Create match from loadout JSON (recommended)"
      section above the existing manual form
- [ ] The JSON intake section contains a file upload input with
      `accept="application/json,.json"` and a collapsible paste area
- [ ] Parser errors render as full-sentence strings in a visible
      region (not `alert()`, not silent swallow)
- [ ] The "Create match from loadout" button is disabled until a
      valid parse is cached and re-disables during submission
- [ ] The existing 9-field manual form is wrapped in a `<details>`
      titled "Fill in manually (advanced)", closed by default
- [ ] All WP-090 form field IDs, `v-model` bindings, and submission
      logic are preserved (confirmed by `git diff` showing only
      additive wrapping changes)

### C) Submission
- [ ] On "Create match from loadout" click, `createMatch` is called
      with `{ numPlayers: parsed.playerCount, setupData:
      parsed.composition }` (verified by test using a stubbed
      `globalThis.fetch`)
- [ ] On successful `createMatch`, `joinMatch` is called with
      `matchID`, `'0'`, and a player name
- [ ] On successful `joinMatch`, `window.location.search` is
      rewritten to `?match=<id>&player=0&credentials=<s>` (verified
      by test with a stubbed `window.location`)
- [ ] Submission errors from `createMatch` or `joinMatch` surface
      as full-sentence strings in the same visible region (no
      duplicate error channel)

### D) Layer boundary & dependencies
- [ ] No `from '@legendary-arena/registry'` import anywhere in
      `apps/arena-client/**` (confirmed with `Select-String`)
- [ ] No new entries in `dependencies` or `devDependencies` of
      `apps/arena-client/package.json` (confirmed with `git diff`)
- [ ] `apps/arena-client/src/client/bgioClient.ts` remains the sole
      runtime engine import site (confirmed with `Select-String`
      allowing `import type` hits elsewhere — unchanged from WP-090)

### E) Tests
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
      (all test files including `parseLoadoutJson.test.ts` and
      the extended `lobbyApi.test.ts`)
- [ ] No test file imports `boardgame.io/testing`
- [ ] No test file contacts a live server (all `fetch` calls are
      stubbed)

### F) Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No files under `packages/game-engine/**`,
      `packages/registry/**`, `apps/server/**`, or
      `apps/registry-viewer/**` were modified (confirmed with
      `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0, Vite build succeeds

# Step 2 — run all arena-client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no registry or new engine runtime imports
Select-String -Path "apps\arena-client\src" -Pattern "from '@legendary-arena/registry'" -Recurse
# Expected: no output

Select-String -Path "apps\arena-client\src" -Pattern "from '@legendary-arena/game-engine'" -Recurse |
  Where-Object { $_.Line -notmatch "import type" }
# Expected: exactly one match, in src/client/bgioClient.ts (WP-090 carve-out, unchanged)

# Step 4 — confirm no new dependencies
git diff apps/arena-client/package.json
# Expected: no changes

# Step 5 — confirm no forbidden packages in parseLoadoutJson
Select-String -Path "apps\arena-client\src\lobby\parseLoadoutJson.ts" -Pattern "zod|ajv|jsonschema|boardgame.io|@legendary-arena"
# Expected: no output

# Step 6 — confirm all nine composition field names appear in parseLoadoutJson
Select-String -Path "apps\arena-client\src\lobby\parseLoadoutJson.ts" -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"
# Expected: at least 9 matches (one per field in the type + validation logic)

# Step 6.5 — confirm rule-mode handling is present and matches WP-093
Select-String -Path "apps\arena-client\src\lobby\parseLoadoutJson.ts" -Pattern "heroSelectionMode|GROUP_STANDARD|unsupported_hero_selection_mode"
# Expected: multiple matches (type + normalization branch + error code + message template)

Select-String -Path "apps\arena-client\src\lobby\parseLoadoutJson.ts" -Pattern "HERO_DRAFT"
# Expected: at most one match (in the WP-093 error-message template's reserved-future note — not as an allowed enum value)

# Step 7 — confirm WP-090 form is preserved (structure test)
Select-String -Path "apps\arena-client\src\lobby\LobbyView.vue" -Pattern "v-model=\"(schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount)\""
# Expected: 9 matches (one per field — the manual form bindings are unchanged)

# Step 8 — manual smoke (not a test gate; recorded in the invocation)
# Terminal A: node --env-file=.env apps/server/src/index.mjs
# Terminal B: pnpm --filter @legendary-arena/arena-client dev
# 1. Open http://localhost:5173 — confirm lobby view renders
# 2. Confirm "Create match from loadout JSON (recommended)" section is visible above
#    the manual form, and the manual form is collapsed inside "Fill in
#    manually (advanced)"
# 3. Paste a valid WP-091-exported JSON into the paste area, click
#    "Parse pasted JSON" — confirm no error, the submit button enables
# 4. Click "Create match from loadout" — confirm the URL rewrites to
#    ?match=<id>&player=0&credentials=<s> and the live-match branch
#    takes over (HUD renders)
# 5. Go back to the lobby. Upload the same JSON via the file input —
#    confirm the same flow works
# 6. Upload a malformed JSON file — confirm a full-sentence error
#    renders and the submit button stays disabled
# 7. Paste a JSON missing the `composition` key — confirm the correct
#    error code / message renders
# 8. Open "Fill in manually (advanced)", confirm all 9 fields still
#    render and the existing form-submit flow still creates a match
# 9. Smoke-test the fixture path (?fixture=mid-turn) — confirm no
#    regression

# Step 9 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] Manual smoke per Verification Step 8 passes end-to-end
      (recorded in the session invocation)
- [ ] No import from `@legendary-arena/registry` anywhere in
      `apps/arena-client/**` (confirmed with `Select-String`)
- [ ] No new runtime engine imports in arena-client (the WP-090
      carve-out in `bgioClient.ts` is the sole runtime import site,
      unchanged)
- [ ] No new dependencies in `apps/arena-client/package.json`
      (confirmed with `git diff`)
- [ ] No `Math.random`, `localStorage`, `sessionStorage`, or
      `IndexedDB` writes in any new or modified file (confirmed
      with `Select-String`)
- [ ] WP-090 form bindings and submission logic unchanged (confirmed
      by `git diff` showing only additive wrapping changes)
- [ ] No files under `packages/game-engine/**`,
      `packages/registry/**`, `apps/server/**`, or
      `apps/registry-viewer/**` were modified (confirmed with
      `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — a user can now build a loadout
      in the Registry Viewer (WP-091), download the JSON, upload or
      paste it into the arena-client lobby, and create a match in
      one click without typing any ext_ids manually
- [ ] `docs/ai/DECISIONS.md` updated — at minimum:
  - `D-92xx` — arena-client uses a hand-rolled shape guard rather
    than importing the WP-091 registry validator at runtime; the
    layer-rule carve-out for registry-side runtime imports in
    arena-client is explicitly deferred to a future WP (if ever
    needed); authoritative validation remains server-side
  - `D-92xx` — WP-090's 9-field manual form is preserved as a
    collapsible "Fill in manually (advanced)" fallback; the JSON
    intake becomes the primary lobby authoring surface
  - `D-92xx` — envelope fields `setupId`, `seed`, `createdAt`,
    `createdBy`, `themeId`, `expansions` are dropped on submission;
    envelope archival is deferred to a later WP that lands alongside
    user-profile work
  - `D-92xx` — envelope `playerCount` maps to the `numPlayers`
    parameter of `createMatch` at the call site; the mapping lives
    in `LobbyView.vue` with a `// why:` comment referencing
    `MATCH-SETUP-SCHEMA.md §Player Count`
  - `D-92xx` — rule-mode shape guard: the parser accepts absent or
    `"GROUP_STANDARD"` and rejects any other `heroSelectionMode` with
    the error code `"unsupported_hero_selection_mode"` and the
    verbatim WP-093 full-sentence error-message template. Absent
    inputs are normalized to `"GROUP_STANDARD"` on the parser's
    output so downstream code in `LobbyView.vue` and `lobbyApi.ts`
    never has to handle `undefined`. `"HERO_DRAFT"` must not appear
    in the allowed-values path; the only reference to it in this
    packet is inside the WP-093 error-message template's reserved-
    future note.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-092 added in the
      correct phase slot (after WP-090 and WP-091), dependencies
      listed, and checked off with today's date
