# WP-093 — Match-Setup Rule-Mode Envelope Field (Governance)

**Status:** Draft (awaiting review)
**Primary Layer:** Governance / Reference Documentation
**Dependencies:** None (governance-only prerequisite for WP-091 / WP-092)
**Planning alias:** "WP-090.5" (as referenced in WP-091/092 planning notes)

---

## Session Context

`MATCH-SETUP-SCHEMA.md` / `MATCH-SETUP-JSON-SCHEMA.json` /
`MATCH-SETUP-VALIDATION.md` are the canonical governance set for match
setup; the composition block is a **9-field locked contract** tracked by
`00.2 §8.1` and reinforced in `.claude/rules/code-style.md`. WP-091
(Loadout Builder in Registry Viewer) and WP-092 (Lobby Loadout Intake)
require an **explicit rule-mode interpretation flag** so that the
authoring surface and intake pipeline can distinguish classic Legendary
rules (hero *groups* expanded deterministically by the engine) from a
future drafting ruleset (individual hero *cards*, not yet implemented).
This packet is a **pure governance change**: it adds `heroSelectionMode`
as an **optional envelope field** (not composition) with a single
allowed value (`"GROUP_STANDARD"`) in v1, and clarifies that the 9-field
lock applies specifically to the composition block — the envelope
remains extensible per the schema's §Extensibility Rules. No runtime
code changes.

**Rule-mode lifecycle (explicit):** this packet defines rule-mode
semantics at the **governance layer only**. Mechanical behavior tied
to rule modes (e.g., engine logic that expands hero cards differently
for `HERO_DRAFT` vs. `GROUP_STANDARD`) is introduced exclusively by
future WPs that both (a) expand the enum here and (b) implement
corresponding engine logic. A reader asking "where does `HERO_DRAFT`
actually do anything?" should find the answer here: nowhere yet —
WP-093 reserves the name and locks the semantics for when the
engine-side work lands.

---

## Goal

After this session, the canonical match-setup governance set documents
`heroSelectionMode` as an **optional envelope field** that:

- Is placed on the **envelope**, not inside the composition block (so
  the 9-field composition lock is preserved byte-for-byte).
- Has an `enum` of exactly one value in v1: `"GROUP_STANDARD"`. The
  value `"HERO_DRAFT"` is explicitly **reserved** for a future WP; v1
  rejects it with a clear error.
- Is **optional**: when omitted, consumers treat the document as
  `heroSelectionMode: "GROUP_STANDARD"` (backward compatibility for any
  MATCH-SETUP JSON authored before this field existed, including
  WP-091's first pre-release drafts).
- Is documented in every authoritative governance doc (schema,
  JSON Schema, validation doc, 00.2, code-style rules) and captured in
  a DECISIONS entry.

No engine code change, no server code change, no runtime validator
change. The field is realized at runtime by WP-091's registry-side
validator and WP-092's lobby-side shape guard — both of which consume
the canonicalized governance defined here.

---

## Assumes

- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` exists and is canonical
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` exists and is
  canonical (currently `schemaVersion: "1.0"` with
  `additionalProperties: false` at every level)
- `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` exists and defines
  Stages 1–3
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 lists the 9
  composition fields
- `.claude/rules/code-style.md` states `MatchSetupConfig` has 9 locked
  fields
- `docs/ai/DECISIONS.md` exists
- `docs/ai/work-packets/WORK_INDEX.md` exists and supports registering
  a new governance WP

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` — read in full. The new
  field lives in §Authoritative Match Setup Schema / Required Fields
  (no, it is **optional** — add it to a new "Optional Fields"
  subsection or extend the existing required list with clear
  optionality marking), §Field Semantics, and §Extensibility Rules.
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` — read in full.
  The new envelope property is additive: `properties.heroSelectionMode`
  with `enum: ["GROUP_STANDARD"]` and **not** listed in `required`
  (so it is optional at the JSON Schema level). The root's
  `additionalProperties: false` continues to reject every other
  envelope-level property — this one is now explicitly allowed.
- `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` — read §Validation
  Stages. Stage 1 (envelope, server-layer) adds a rule-mode check:
  if `heroSelectionMode` is present, it must be one of the allowed
  enum values. Default when absent: `"GROUP_STANDARD"`. Add this to
  Stage 1's bullet list.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1 Match
  Configuration` — read the full section. The composition 9-field
  lock **stays unchanged**. A new short subsection documents the
  envelope additions; cross-reference the governance docs.
- `.claude/rules/code-style.md` — read the `Data Contracts` section
  containing the "MatchSetupConfig has 9 locked fields" language.
  Clarify that the 9-field lock applies to the **composition block**
  specifically; the envelope is extensible per
  `MATCH-SETUP-SCHEMA.md §Extensibility Rules`.
- `docs/ai/DECISIONS.md` — scan recent entries for format precedent.
  Add a new entry documenting the rule-mode decision.
- `docs/ai/work-packets/WP-091-loadout-builder-registry-viewer.md` —
  read the current draft. Its Locked Contract Values, Scope, and
  Acceptance Criteria reference `heroSelectionMode`. The values
  canonicalized here must match the values WP-091 implements.
- `docs/ai/work-packets/WP-092-lobby-loadout-intake.md` — read the
  current draft. Its shape-guard error code and messages reference
  `heroSelectionMode`; canonicalize here so WP-092 matches.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 11 (full-sentence
  error messages) applies to the validation doc's new Stage 1 rule.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
  (not applicable; no runtime code in scope)
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
- **Governance-only packet.** No changes to `packages/**` or `apps/**`.
  All changes live in `docs/ai/REFERENCE/**`, `.claude/rules/**`,
  `docs/ai/DECISIONS.md`, and `docs/ai/work-packets/WORK_INDEX.md`.
- **`heroSelectionMode` is an interpretation flag, not a ruleset
  selector.** It declares *how the existing composition data is
  interpreted* by the engine; it does not by itself introduce new
  mechanics, phases, scoring rules, win/loss conditions, card
  effects, or zone behaviors. Any future WP that reads the field
  may switch interpretation of composition data but may not use it
  as a branch point for engine-level ruleset changes outside that
  interpretation scope. This constraint shuts down an entire
  category of future misuse (e.g., "if `heroSelectionMode ===
  X`, also change the villain deck shuffle algorithm").
- **9-field composition lock preserved.** `MatchSetupConfig` is not
  modified; `00.2 §8.1`'s composition enumeration is not modified;
  the "9 locked fields" statement in `.claude/rules/code-style.md` is
  **clarified** (scope-narrowed to composition) — it is not rescinded.
- **`heroSelectionMode` is envelope-level, not composition-level.**
  Placing it on the envelope keeps the composition inert and
  replay-stable, consistent with the envelope's existing role
  (metadata, provenance, interpretation intent).
- **v1 allows exactly one value: `"GROUP_STANDARD"`.** The enum has
  one member. `"HERO_DRAFT"` is named only in the DECISIONS rationale
  and in reserved-future prose — it is **not** in the allowed enum in
  v1. Any v1 document whose `heroSelectionMode` is anything other
  than `"GROUP_STANDARD"` (or absent) is rejected by Stage 1
  validation.
- **Optional with implicit default.** Documents that omit
  `heroSelectionMode` are treated as `"GROUP_STANDARD"` by all
  consumers. This preserves backward compatibility with any
  MATCH-SETUP JSON authored before this field existed.
- **`schemaVersion` stays at `"1.0"`.** This is an **additive,
  backward-compatible** field per `MATCH-SETUP-SCHEMA.md §Extensibility
  Rules`. A schemaVersion bump is not required because documents
  without `heroSelectionMode` still validate successfully (optional +
  default). The DECISIONS entry explicitly records this analysis so
  the non-bump is auditable.
- **No rewriting of existing content.** Insert new text additively
  into the governance docs; do not reorder, paraphrase, or condense
  existing prose. Future archaeology benefits from minimal-diff
  changes to governance.
- **Field-name-pattern: same as existing envelope fields.** The new
  property uses camelCase (`heroSelectionMode`), consistent with the
  eight existing envelope fields.
- **Enum-value-pattern: SCREAMING_SNAKE_CASE.** `"GROUP_STANDARD"`
  matches the convention for rule-mode tokens (deliberate contrast
  with the ext_id pattern `^[a-z0-9-]+$` which applies only to
  content identifiers, not rule-interpretation tokens). The DECISIONS
  entry explicitly notes this.
- **No runtime validator is added in this packet.** The JSON Schema
  rule and the Stage 1 prose are normative, but the server-side
  validator that enforces Stage 1 at runtime is not implemented here
  (per existing `MATCH-SETUP-VALIDATION.md` status: Stage 1 is
  server's future responsibility). WP-091's registry-side validator
  and WP-092's shape guard are the first actual consumers.
- Full-sentence error messages required anywhere the doc prescribes
  validator behavior (per `00.6 rule 11`).

**Session protocol:**
- If any existing field-name or enum-value choice surfaces a drift
  against `00.2 §8.1` or a prior DECISIONS entry, stop and ask. Do
  not paper over drift by adjusting this packet silently.
- If `MATCH-SETUP-JSON-SCHEMA.json`'s existing envelope `required`
  array or `additionalProperties` setting is unclear, stop and
  re-read the file in full before modifying.
- If any reader might interpret the clarification in
  `.claude/rules/code-style.md` as rescinding the 9-field lock,
  stop and tighten the language before proceeding — the lock is
  scope-clarified, not relaxed.

**Locked contract values (paste verbatim — do not paraphrase):**

- **New envelope field name:** `heroSelectionMode`
- **Type:** string (enum)
- **Allowed values in v1:** `["GROUP_STANDARD"]`
- **Required:** false (optional)
- **Default when omitted:** `"GROUP_STANDARD"`
- **Position in envelope:** after `expansions`, before `composition`
  (so that structure stays human-readable: identity first, intent
  second, rule-mode third, content last).
  `// why:` identity and provenance fields first, interpretation
  intent next, content last — improves human readability and
  diff stability when envelopes are archived. Future schema editors
  must resist reshuffling.
- **Reserved future values** (named in prose only, **not** in the
  allowed enum): `"HERO_DRAFT"`
- **Human-readable label mapping** (authoritative; WP-091 and WP-092
  must consume these strings verbatim when surfacing the mode in UI
  copy, never paraphrase or invent alternates). Each mode has three
  locked strings — machine name, short UI label, and long
  explanation — which UI consumers may compose but must not alter:
  - `"GROUP_STANDARD"` —
    - **machine name:** `"GROUP_STANDARD"`
    - **short UI label:** `"Classic Legendary hero groups"`
      (intended render format in WP-091's rule-mode indicator:
      `"Hero selection rule: GROUP_STANDARD — Classic Legendary hero groups"`)
    - **long explanation (tooltip / help copy):**
      `"The engine expands each selected hero group into its canonical card set at match start."`
  - `"HERO_DRAFT"` —
    - **machine name:** `"HERO_DRAFT"`
    - **short UI label:** `"Hero Draft"`
    - **long explanation (tooltip / help copy):**
      `"Player-curated hero card selection — individual hero cards chosen by rarity or constraint rather than pre-defined groups. Reserved for a future release."`
    - **future-notice UX copy** (the one sentence v1 UI surfaces may
      use to acknowledge the reserved mode without describing its
      mechanics; consumed byte-for-byte by WP-091's rule-mode info
      icon):
      `"Hero Draft rules are planned for a future update."`
  - `// why:` this mapping is locked at the governance layer so
    naming drift between UI copy in WP-091 (tooltip text) and
    validator/parser messages in WP-091/WP-092 is impossible. A
    future WP that adds another rule mode must land a label entry
    here first, before any UI or parser consumes the new name.
- **Flavor / lore framing** (explicitly separate from the machine
  name): the project may use "Contest of Champions" as in-universe
  flavor text for `HERO_DRAFT` matches; that label is **not** a
  ruleset identifier and must not appear in enums, error messages,
  JSON, or schema validation — only in narrative UI copy when a
  future WP enables `HERO_DRAFT` gameplay.
  **Additional hard prohibition: flavor strings must never be used
  as lookup keys, branch conditions, analytics dimensions,
  telemetry fields, log tokens, or any other machine-readable
  surface.** "Contest of Champions" (and any future flavor label)
  is narrative copy only. The machine distinction is always made
  via the locked enum value (`heroSelectionMode === "HERO_DRAFT"`),
  never via the flavor string.
- **Stage 1 validation rule**: if present, must be in the allowed
  enum; if absent, treat as `"GROUP_STANDARD"`
- **Error code for consumers** (WP-091 validator and WP-092 shape
  guard use this exact code): `"unsupported_hero_selection_mode"`
- **Error message template** (**normative**; consumers must emit
  exactly this string verbatim — byte-for-byte — with the single
  exception that `<value>` is substituted with the observed
  `heroSelectionMode` value at runtime. No paraphrasing, no
  reformatting, no template-literal assembly, no alternative
  phrasing. WP-091 and WP-092 tests assert exact-string equality
  against this template):
  `The loadout envelope's heroSelectionMode is <value>, which is not
  a supported rule mode in v1 of the match setup schema. Supported
  modes: GROUP_STANDARD. (HERO_DRAFT is reserved for a future
  release and is not yet implemented.)`

---

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness), §22 (Replay
Faithfulness), §10a (Registry Viewer public surfaces — indirect via
WP-091), NG-1..7 (monetization proximity — none crossed).

**Conflict assertion:** No conflict. This packet preserves all touched
clauses:

- §3 — Rule-mode is an interpretation flag, not a rule variation. v1
  allows exactly one value, which is identical to current engine
  behavior (group-based hero introduction). No authority shifts from
  engine to client; no scoring or outcome contract is affected.
- §22 — The field is envelope-only and is optional with a default, so
  every existing replay-linked MATCH-SETUP document continues to
  validate unchanged. The field is authored at setup time and never
  changes during a match, so replay determinism is unaffected.
- §10a — Not directly modified; WP-091 consumes the canonical mode in
  the Registry Viewer's public surface, but the governance change
  itself is doc-only and ships no UI.
- NG-1..7 — No monetization surface added.

**Non-Goal proximity check:** None of NG-1..7 are crossed. This is a
governance field addition.

**Determinism preservation:** The field has no runtime effect in this
packet. When WP-091 and WP-092 land, they will emit/accept only
`"GROUP_STANDARD"` (or absent), and the engine's existing deterministic
group-expansion logic runs unchanged. Replay faithfulness is
preserved — the field is ignored by the engine today and will be
enforced-but-still-ignored (pass-through with validation) after v1.
**The engine currently ignores `heroSelectionMode`; its presence in
the envelope is forward-declarative and does not alter setup, shuffle
order, or card pool construction in v1.** A replay produced before
this packet lands and a replay produced after land — for the same
composition — will be byte-identical at the engine level; the field
affects only authoring UX and intake feedback surfaces.

---

## Scope (In)

### A) Schema governance text — `MATCH-SETUP-SCHEMA.md`

- **`docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md`** — modified:
  - In §Authoritative Match Setup Schema / Required Fields, add a new
    **Optional Fields** subsection immediately after the required
    example. List `heroSelectionMode` with:
    - Type: `"GROUP_STANDARD"` (v1) — enum of exactly one value
    - Required: false
    - Default: `"GROUP_STANDARD"` when omitted
    - Purpose: declares the interpretation rule for the composition's
      hero selection — `GROUP_STANDARD` means the engine expands
      each `heroDeckIds` entry into the canonical group card set
      (classic Legendary rules)
  - Update the example JSON block to include the new field above
    `composition` (see Locked Contract Values for position). Add an
    inline comment marker or sentence noting the field is optional
    and defaults to `"GROUP_STANDARD"`.
  - Add a new subsection under §Field Semantics titled "Hero
    Selection Mode":
    - One paragraph explaining v1 semantics: `GROUP_STANDARD`
      interprets `heroDeckIds` as a list of hero group ext_ids to be
      expanded by the engine at setup time; this matches current
      engine behavior.
    - One paragraph flagging `HERO_DRAFT` as reserved for a future
      WP, not implemented, not in the allowed enum. Cross-reference
      the DECISIONS entry added in this packet.
    - One sentence stating documents that omit the field are treated
      as `GROUP_STANDARD` for backward compatibility.
  - In §Extensibility Rules, add a bullet confirming
    `heroSelectionMode` was added in this packet as an additive
    backward-compatible envelope field; reference the DECISIONS
    entry ID.
  - Do not renumber existing sections. Do not paraphrase existing
    prose. Diff is purely additive.

### B) JSON Schema — `MATCH-SETUP-JSON-SCHEMA.json`

- **`docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json`** — modified:
  - Under root `properties`, add a new property
    `heroSelectionMode` with:
    ```json
    "heroSelectionMode": {
      "type": "string",
      "description": "Optional rule mode indicating how the composition's hero selection is interpreted. v1 allows exactly one value; the field is backward compatible (absent means GROUP_STANDARD).",
      "enum": ["GROUP_STANDARD"]
    }
    ```
  - **Do not** add `heroSelectionMode` to the root `required` array
    (it is optional).
  - **Do not** change root `additionalProperties` — it stays `false`
    (the new field is now a known property and passes the closed-set
    check).
  - Do not modify any other property, constraint, or order.
  - Confirm the resulting JSON remains valid JSON (parses cleanly via
    `JSON.parse` in the verification step).

### C) Validation doc — `MATCH-SETUP-VALIDATION.md`

- **`docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md`** — modified:
  - In §Validation Stages / Stage 1 — Envelope Validation, add a
    bullet to the existing list: "if `heroSelectionMode` is present,
    it must be one of the allowed enum values (`GROUP_STANDARD` in
    v1); if absent, the envelope is treated as `heroSelectionMode:
    "GROUP_STANDARD"` for downstream consumers."
  - Add a new §Test Coverage Requirements / Invalid Cases entry
    under "Invalid Cases — Structural":
    - `heroSelectionMode` with an unrecognized value (e.g.,
      `"HERO_DRAFT"` or `"MADE_UP"`) → Stage 1 rejects with
      error code `"unsupported_hero_selection_mode"` and the
      message template in Locked Contract Values.
  - Add a new §Test Coverage Requirements / Valid Cases entry:
    - Valid envelope with `heroSelectionMode: "GROUP_STANDARD"`
    - Valid envelope without `heroSelectionMode` (backward compat)
  - Do not modify Stage 2 (structural / JSON Schema — the new field
    is consumed by Stage 2 via the JSON Schema update in §B).
  - Do not modify Stage 3 (composition — unchanged, 9-field lock
    preserved).
  - Do not renumber existing sections.

### D) Data requirements — `00.2-data-requirements.md §8.1`

- **`docs/ai/REFERENCE/00.2-data-requirements.md`** — modified:
  - Locate §8.1 Match Configuration. Add a new short subsection
    **after** the 9-composition-field table titled "Envelope
    Extensibility":
    - State that the envelope is extensible per
      `MATCH-SETUP-SCHEMA.md §Extensibility Rules`.
    - List `heroSelectionMode` as the first such addition: optional
      envelope field, v1 enum `["GROUP_STANDARD"]`, default
      `"GROUP_STANDARD"` when absent.
    - Cross-reference the DECISIONS entry added in this packet.
  - Do **not** modify the 9-field composition table. Do **not**
    add `heroSelectionMode` to that table (it is envelope-level,
    not composition-level).
  - Do not renumber existing sections.

### E) Rules file clarification — `.claude/rules/code-style.md`

- **`.claude/rules/code-style.md`** — modified:
  - Locate the **Data Contracts** section containing "MatchSetupConfig
    has **9 locked fields**".
  - Add a new sentence immediately after that enumeration clarifying
    the scope: "The 9-field lock applies to the **composition block**
    (`MatchSetupConfig`). The match-setup **envelope** is extensible
    per `MATCH-SETUP-SCHEMA.md §Extensibility Rules` and currently
    includes the additive optional field `heroSelectionMode`
    (introduced in [WP-093])."
  - Do **not** rescind the lock. The existing enumeration and its
    "Do not rename, abbreviate, or add fields" directive stay
    verbatim — they govern the composition block, which remains
    immutable at 9 fields.
  - Do not renumber or reorder existing sections.

### F) DECISIONS entry

- **`docs/ai/DECISIONS.md`** — modified:
  - Add a new decision entry (next available D-9300-range ID, e.g.,
    `D-9301`) titled "Match-Setup Rule-Mode Envelope Field —
    heroSelectionMode (v1)". Content:
    - Decision: `heroSelectionMode` is added as an **optional envelope
      field** on the MATCH-SETUP document with v1 enum
      `["GROUP_STANDARD"]`. Default when absent: `"GROUP_STANDARD"`.
      `"HERO_DRAFT"` is reserved for a future WP, not implemented,
      not in the allowed enum.
    - Rationale: authoring surfaces (WP-091) and intake surfaces
      (WP-092) need an explicit interpretation flag for hero
      selection so that a future `HERO_DRAFT` ruleset can coexist
      without ambiguity. Envelope placement preserves the 9-field
      composition lock and keeps the composition inert and
      replay-stable.
    - schemaVersion analysis: the field is additive and backward
      compatible (optional + default). `schemaVersion` stays at
      `"1.0"` per `MATCH-SETUP-SCHEMA.md §Extensibility Rules`.
      Because documents authored before this change still validate
      and are interpreted identically (absent
      `heroSelectionMode` → `"GROUP_STANDARD"` default), this change
      **does not constitute a semantic schema break** and therefore
      does not require a `"1.1"` bump. Any future change that
      rejects documents that previously validated, or reinterprets
      their outcomes, would require the bump; this one does not.
    - Enum-value style: `SCREAMING_SNAKE_CASE` for rule-mode tokens
      (contrast with the `^[a-z0-9-]+$` pattern for content ext_ids);
      this convention is established here and should govern any
      future rule-mode enum additions.
    - Consumers: WP-091 emits `heroSelectionMode: "GROUP_STANDARD"`
      in downloaded JSON and rejects any other value at the
      registry-side validator. WP-092 accepts absent or
      `"GROUP_STANDARD"` and rejects any other value at the
      arena-client shape guard. Server-side Stage 1 validation of
      this field is deferred alongside the broader Stage 1 rollout.
    - Forward compatibility: `HERO_DRAFT` will be enabled by a
      future WP that (1) expands the enum here, (2) defines
      `heroCardPool` / `heroDraftRules` structures in a new composition-
      or envelope-level field, (3) implements engine-side
      interpretation. None of that work is in scope for this packet.
      **Nothing in this packet assumes `HERO_DRAFT` is the only
      future rule mode.** Additional modes (e.g., hypothetical
      `SEALED`, `CUBE_DRAFT`, `SCENARIO_FIXED`) must follow the
      same governance process laid out here: amend this packet's
      enum + label mapping + DECISIONS entry **first**, then draft
      UI/parser/engine WPs against the new name. The naming-
      governance policy below is designed to scale to N modes, not
      only to two.
    - Naming-governance policy (locked by this entry; applies to all
      future rule-mode work):
      1. WP-093 (this packet) is the **sole** place where rule-mode
         machine names, human-readable labels, and reserved-future
         tokens are introduced. The authoritative lookup is the
         "Human-readable label mapping" block in this packet's
         Locked Contract Values.
      2. WP-091, WP-092, and any future UI or parser WP may
         **consume** the names and labels defined here verbatim —
         they may never invent, rename, paraphrase, or abbreviate
         them.
      3. A future WP that adds a new rule mode (e.g., enabling
         `HERO_DRAFT` or introducing a hypothetical `SEALED` or
         `CUBE_DRAFT`) must first amend this packet's governance
         blocks (enum, label mapping, reserved-future prose) before
         any UI or parser WP is drafted against the new name.
      4. Flavor / lore framing (e.g., "Contest of Champions" for
         `HERO_DRAFT` matches) is explicitly separate from the
         machine name and lives only in narrative UI copy. Flavor
         strings never appear in enums, error messages, JSON, or
         schema validation.
      This policy prevents schema drift, wording forks, and
      retroactive renames across the registry / engine / client
      boundary.

### G) Work index registration

- **`docs/ai/work-packets/WORK_INDEX.md`** — modified:
  - Register WP-093 in the appropriate phase/slot, with the
    dependency chain note that WP-091 and WP-092 depend on it (even
    though their file numbers are lower).
  - Mark status Draft until review lands.

---

## Out of Scope

- No addition of `"HERO_DRAFT"` to the allowed enum — it is named
  in prose as reserved-for-future only.
- No definition of `heroCardPool`, `heroDraftRules`, or any other
  draft-mode field — those are a future WP's concern.
- No engine code changes. `packages/game-engine/**` is untouched.
- No registry code changes. `packages/registry/**` is untouched.
- No server code changes. `apps/server/**` is untouched.
- No UI changes. `apps/**` is untouched.
- No server-side Stage 1 validator implementation — Stage 1 remains a
  future concern per the existing validation doc.
- No schemaVersion bump — the field is additive and backward
  compatible.
- No changes to the 9-field composition contract. `MatchSetupConfig`,
  `matchSetup.types.ts`, `matchSetup.validate.ts`, and the
  composition enumeration in `00.2 §8.1` are all unchanged.
- No changes to existing DECISIONS entries. The new entry is purely
  additive.
- No rename, reorder, or paraphrase of existing governance prose.
  Diffs are purely additive.
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` — **modified** — add
  optional envelope field `heroSelectionMode`, new §Field Semantics /
  Hero Selection Mode subsection, extensibility bullet
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` — **modified** —
  add root property `heroSelectionMode` with `enum: ["GROUP_STANDARD"]`;
  not added to `required`
- `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` — **modified** — add
  Stage 1 rule-mode bullet; add valid + invalid test-coverage
  entries
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** —
  §8.1 gains a new "Envelope Extensibility" subsection after the
  composition 9-field table (which is unchanged)
- `.claude/rules/code-style.md` — **modified** — clarify that the
  9-field lock applies to the composition block; envelope is
  extensible
- `docs/ai/DECISIONS.md` — **modified** — new entry
  (D-9300-range) documenting the rule-mode decision, rationale,
  schemaVersion analysis, enum-value convention, and deferral of
  `"HERO_DRAFT"`
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — register
  WP-093 with dependency notes for WP-091 and WP-092

No other files may be modified.

---

## Acceptance Criteria

### Governance docs
- [ ] `MATCH-SETUP-SCHEMA.md` contains an Optional Fields subsection
      listing `heroSelectionMode` with enum `["GROUP_STANDARD"]` and
      default semantics
- [ ] `MATCH-SETUP-SCHEMA.md` has a new "Hero Selection Mode"
      subsection under §Field Semantics
- [ ] `MATCH-SETUP-SCHEMA.md` §Extensibility Rules gains a bullet
      referencing the WP-093 DECISIONS entry
- [ ] `MATCH-SETUP-JSON-SCHEMA.json` defines `heroSelectionMode`
      under root `properties` with `type: "string"` and
      `enum: ["GROUP_STANDARD"]`
- [ ] `heroSelectionMode` is **not** added to the root `required`
      array in `MATCH-SETUP-JSON-SCHEMA.json`
- [ ] `MATCH-SETUP-JSON-SCHEMA.json` parses as valid JSON
      (confirmed by Verification Step)
- [ ] `MATCH-SETUP-VALIDATION.md` Stage 1 gains a bullet for
      `heroSelectionMode` validation and default semantics
- [ ] `MATCH-SETUP-VALIDATION.md` Test Coverage Requirements gains
      both a valid-case entry (`"GROUP_STANDARD"` / absent) and an
      invalid-case entry (unrecognized value)

### Naming governance
- [ ] The Locked Contract Values block contains a
      "Human-readable label mapping" entry for both `"GROUP_STANDARD"`
      and `"HERO_DRAFT"`, each with three fields: machine name, short
      human label, and one-sentence explanation
- [ ] The DECISIONS entry contains the four-point "Naming-governance
      policy" locking WP-093 as the sole source of rule-mode names
- [ ] The Locked Contract Values block explicitly names "Contest of
      Champions" as flavor/lore framing separate from the machine
      name and forbids its appearance in enums or schema validation
- [ ] The old planning-alias name (the draft-era token that was
      renamed to `HERO_DRAFT` per the naming-governance policy
      above) does not appear anywhere in
      `docs/ai/work-packets/WP-09{1,2,3}*.md` or `WORK_INDEX.md`
      (confirmed via the Verification Step grep that searches for
      the old token directly; this prose avoids citing the token
      verbatim to sidestep the §18 prose-vs-grep rule per the
      lint checklist)

### 9-field composition lock preserved
- [ ] `00.2 §8.1` composition 9-field table is **unchanged**
      (verified by confirming the 9 field names appear verbatim)
- [ ] `00.2 §8.1` gains a new "Envelope Extensibility" subsection
      **after** the composition table, not inside it
- [ ] `.claude/rules/code-style.md` still states that
      `MatchSetupConfig` has 9 locked fields; the new clarification
      sentence is additive, not a replacement
- [ ] No change to `packages/game-engine/src/setup/matchSetup.types.ts`
      (confirmed with `git diff --name-only`)
- [ ] No change to `packages/game-engine/src/setup/matchSetup.validate.ts`
      (confirmed with `git diff --name-only`)

### DECISIONS
- [ ] `DECISIONS.md` has a new entry in the D-9300 range titled
      "Match-Setup Rule-Mode Envelope Field — heroSelectionMode (v1)"
- [ ] The entry records: decision, rationale, schemaVersion analysis
      (why no bump), enum-value convention, consumer list
      (WP-091 / WP-092 / server-side future), and the deferral of
      `"HERO_DRAFT"`

### Work index
- [ ] `WORK_INDEX.md` registers WP-093 with Draft status
- [ ] `WORK_INDEX.md` documents that WP-091 and WP-092 depend on
      WP-093 (prerequisite ordering, not numeric ordering)

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No files under `packages/**` or `apps/**` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — JSON Schema parses as valid JSON
node -e "JSON.parse(require('node:fs').readFileSync('docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json', 'utf8'))"
# Expected: exits 0, no output

# Step 2 — heroSelectionMode is present in the JSON Schema properties block
Select-String -Path "docs\ai\REFERENCE\MATCH-SETUP-JSON-SCHEMA.json" -Pattern "heroSelectionMode"
# Expected: at least one match (the new property definition)

# Step 3 — heroSelectionMode is NOT in the root required array
# Manual inspection: open MATCH-SETUP-JSON-SCHEMA.json, confirm the
# root "required" array lists only the eight existing required envelope
# fields plus "composition" — and does NOT include "heroSelectionMode".
# (A grep would over-match against the property definition; inspect
# the file instead.)

# Step 4 — SCHEMA governance doc references the new field
Select-String -Path "docs\ai\REFERENCE\MATCH-SETUP-SCHEMA.md" -Pattern "heroSelectionMode"
# Expected: several matches across the Optional Fields subsection,
# the Field Semantics / Hero Selection Mode subsection, and the
# Extensibility bullet

# Step 5 — VALIDATION governance doc references the new Stage 1 rule
Select-String -Path "docs\ai\REFERENCE\MATCH-SETUP-VALIDATION.md" -Pattern "heroSelectionMode|unsupported_hero_selection_mode"
# Expected: at least two matches (Stage 1 bullet + test coverage)

# Step 6 — 00.2 §8.1 is scoped correctly (new subsection added, table unchanged)
Select-String -Path "docs\ai\REFERENCE\00.2-data-requirements.md" -Pattern "Envelope Extensibility|heroSelectionMode"
# Expected: matches inside the new subsection only; the 9 composition
# field names still appear unchanged

# Step 7 — code-style rule clarified
Select-String -Path ".claude\rules\code-style.md" -Pattern "heroSelectionMode|9-field lock applies to the \*\*composition|9-field lock applies to"
# Expected: one clarification sentence added; the "9 locked fields"
# enumeration unchanged

# Step 8 — DECISIONS entry landed
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "heroSelectionMode|Rule-Mode Envelope"
# Expected: at least one match in the new entry

# Step 8.5 — old planning-alias token did not leak back in
# why: WP-093 itself legitimately cites the old token inside this
# grep pattern and inside the §Acceptance prose that references
# this step, so WP-093 is explicitly excluded from the search path.
# The check is that WP-091 / WP-092 / WORK_INDEX.md are clean.
Select-String -Path "docs\ai\work-packets\WP-091-loadout-builder-registry-viewer.md","docs\ai\work-packets\WP-092-lobby-loadout-intake.md","docs\ai\work-packets\WORK_INDEX.md" -Pattern "CARD_DRAFT"
# Expected: no output
# Any reappearance of the old token in the three consumer files is
# a rename regression and must be fixed before acceptance. The
# reserved-future mode is now canonicalized as HERO_DRAFT per the
# naming-governance policy in this packet's DECISIONS entry.

# Step 9 — No package or app code was changed
git diff --name-only packages/ apps/
# Expected: no output

# Step 10 — Full scope confirmation
git diff --name-only
# Expected: only the files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `node -e "JSON.parse(...)"` against the JSON Schema exits 0
- [ ] `git diff --name-only packages/ apps/` produces no output
- [ ] No files under `packages/**` or `apps/**` were modified
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — `heroSelectionMode` is now a
      canonical optional envelope field; WP-091 and WP-092 may emit
      and validate it; engine behavior unchanged until a future WP
      expands the enum and implements `HERO_DRAFT`
- [ ] `docs/ai/DECISIONS.md` has the new D-9300-range entry
      (covered by Scope §F; re-stated here as a hard DoD line for
      governance traceability)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-093 registered in
      the correct slot with today's date, Draft status flipping to
      complete on acceptance, and the dependency note clarifying
      that WP-091 and WP-092 depend on WP-093 (prerequisite, not
      numeric ordering)
