# EC-093 — Match-Setup Rule-Mode Envelope Field (Governance) (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-093-match-setup-rule-mode-envelope-field.md`
**Layer:** Governance / Reference Documentation

> **Status: DRAFT.** Do not execute until (a) WP-093 is registered in `WORK_INDEX.md` (done 2026-04-24); (b) the 00.3 lint gate has been run against WP-093 and recorded passing (done 2026-04-24); (c) this EC is registered in `EC_INDEX.md`.

## Before Starting

> **STOP** if any checkbox below is false.

- [ ] `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md`, `MATCH-SETUP-JSON-SCHEMA.json`, `MATCH-SETUP-VALIDATION.md`, `00.2-data-requirements.md` all exist and are at canonical versions
- [ ] `.claude/rules/code-style.md` contains the "MatchSetupConfig has 9 locked fields" language unchanged
- [ ] `docs/ai/DECISIONS.md` exists; next free ID in the D-9300 range is identified (e.g., `D-9301`)
- [ ] No parallel session is editing any of the seven files under `## Files to Produce`
- [ ] Baseline captured: `node -e "JSON.parse(require('node:fs').readFileSync('docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json', 'utf8'))"` exits 0

## Session Abort Conditions

Immediately ABORT execution if any of the following occurs:

- `schemaVersion` is changed or even tentatively discussed as `"1.1"` or higher.
- `heroSelectionMode` is added to the composition block anywhere
  (schema prose, tables, examples, or JSON Schema).
- `"HERO_DRAFT"` appears in a JSON Schema `enum`, `required` array,
  or any validation constraint rather than prose-only sections.
- Existing prose in governance docs is rewritten rather than extended
  additively (diff shows deletion or modification of non-whitespace text).
- Any file under `packages/**` or `apps/**` appears in `git diff`.

## Locked Values (do not re-derive)

- **Field name:** `heroSelectionMode`
- **Type:** string (enum)
- **Allowed values in v1:** `["GROUP_STANDARD"]` — exactly one member
- **Required in JSON Schema:** false (optional; not added to root `required` array)
- **Default when absent:** `"GROUP_STANDARD"`
- **Position in envelope:** after `expansions`, before `composition` — *rationale: identity/provenance first, interpretation intent next, content last — improves human readability, diff stability, and schema reviews.*
- **Reserved future token (prose only, NOT in allowed enum):** `"HERO_DRAFT"`
- **Flavor / lore label (narrative UI only; never in enums, errors, JSON, schema validation, logs, analytics, telemetry, or branch conditions):** `"Contest of Champions"`
- **Error code:** `"unsupported_hero_selection_mode"`
- **Error message template (normative, verbatim; `<value>` is the only permitted substitution):**
  `"The loadout envelope's heroSelectionMode is <value>, which is not a supported rule mode in v1 of the match setup schema. Supported modes: GROUP_STANDARD. (HERO_DRAFT is reserved for a future release and is not yet implemented.)"`
- **Human-readable label mapping (authoritative; consumed byte-for-byte by WP-091/092):**
  - `"GROUP_STANDARD"` → machine `"GROUP_STANDARD"` / short UI label `"Classic Legendary hero groups"` / long explanation `"The engine expands each selected hero group into its canonical card set at match start."`
  - `"HERO_DRAFT"` → machine `"HERO_DRAFT"` / short UI label `"Hero Draft"` / long explanation `"Player-curated hero card selection — individual hero cards chosen by rarity or constraint rather than pre-defined groups. Reserved for a future release."` / future-notice UX copy `"Hero Draft rules are planned for a future update."`
- **schemaVersion:** stays at `"1.0"` — no bump (additive + backward compatible)

## Guardrails

- **Governance-only execution.** Zero changes under `packages/**` or `apps/**`. `git diff --name-only packages/ apps/` must return empty at the end of the session.
- **9-field composition lock preserved.** `00.2 §8.1` composition table unchanged; `matchSetup.types.ts`/`matchSetup.validate.ts` unchanged; the `.claude/rules/code-style.md` clarification is additive (scope-narrows the lock to composition), never a rescission.
- **Envelope-level only.** `heroSelectionMode` goes into the envelope section of `MATCH-SETUP-SCHEMA.md` / JSON Schema / 00.2, never into composition.
- **Additive, minimal-diff edits to governance docs.** No reordering, paraphrasing, or condensing of existing prose. Diffs must be purely additive.
- **Naming-governance policy:** this packet is the sole source of rule-mode names and labels; future WPs consume, never invent.
- **Lore strings (e.g., `"Contest of Champions"`) must never appear as lookup keys, branch conditions, analytics dimensions, telemetry fields, or log tokens** — narrative UI copy only.
- **`heroSelectionMode` is an interpretation flag, not a ruleset selector.** No future WP may use it as a branch point for engine-level ruleset changes outside composition-interpretation scope. No governance document may describe it as enabling, toggling, or activating gameplay mechanics. Any such wording requires a separate WP that introduces engine behavior alongside an enum expansion.
- **Enum coherence is mandatory.** The allowed enum values, reserved-future tokens, labels, and error messages for `heroSelectionMode` must match **exactly** across: `MATCH-SETUP-SCHEMA.md`, `MATCH-SETUP-JSON-SCHEMA.json`, `MATCH-SETUP-VALIDATION.md`, and `DECISIONS.md`. Any divergence requires aborting this EC and opening a new governance WP.

## Required `// why:` Comments

Not applicable — governance-only packet touches no code files.

## Files to Produce (Governance-Only; No Code Touches)

- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` — **modified** — Optional Fields subsection + §Field Semantics/Hero Selection Mode subsection + §Extensibility bullet
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` — **modified** — root `properties.heroSelectionMode` added with `enum: ["GROUP_STANDARD"]`; NOT added to root `required`
- `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` — **modified** — Stage 1 rule-mode bullet + valid/invalid Test Coverage entries
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — §8.1 gains an "Envelope Extensibility" subsection **after** the 9-field composition table (table unchanged)
- `.claude/rules/code-style.md` — **modified** — clarifying sentence added after the 9-field lock enumeration; original enumeration verbatim
- `docs/ai/DECISIONS.md` — **modified** — new D-9300-range entry: decision + rationale + schemaVersion-no-bump analysis + naming-governance policy + consumer list + deferred `"HERO_DRAFT"` note. *This entry is authoritative for naming, labels, defaults, and future expansion; no other document may override it.*
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-093 `[ ]` → `[x]` with today's date
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-093 Draft → Done

## After Completing

- [ ] `node -e "JSON.parse(require('node:fs').readFileSync('docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json', 'utf8'))"` exits 0
- [ ] `Select-String -Path "docs\ai\REFERENCE\MATCH-SETUP-JSON-SCHEMA.json" -Pattern "heroSelectionMode"` returns ≥ 1 match
- [ ] `Select-String -Path "docs\ai\REFERENCE\MATCH-SETUP-SCHEMA.md" -Pattern "heroSelectionMode"` returns ≥ 3 matches (Optional Fields + Field Semantics + Extensibility)
- [ ] `Select-String -Path "docs\ai\REFERENCE\MATCH-SETUP-VALIDATION.md" -Pattern "heroSelectionMode|unsupported_hero_selection_mode"` returns ≥ 2 matches
- [ ] `Select-String -Path "docs\ai\work-packets\WP-091-loadout-builder-registry-viewer.md","docs\ai\work-packets\WP-092-lobby-loadout-intake.md","docs\ai\work-packets\WORK_INDEX.md" -Pattern "CARD_DRAFT"` returns no output (legacy planning token did not leak back in)
- [ ] `Select-String -Path ".claude\rules\code-style.md" -Pattern "9 locked fields"` still matches (lock not rescinded)
- [ ] `git diff --name-only packages/ apps/` returns empty
- [ ] `git diff --name-only` lists only the files under `## Files to Produce (Governance-Only; No Code Touches)`
- [ ] No existing headings in governance docs were renumbered or reordered (diff shows only additive prose)
- [ ] `docs/ai/STATUS.md` updated — `heroSelectionMode` is now a canonical optional envelope field; engine behavior unchanged until a future WP expands the enum
- [ ] `docs/ai/DECISIONS.md` D-9300-range entry landed (covered by Scope §F; restated here for governance traceability)

## Common Failure Smells

- `schemaVersion` changes to `"1.1"` → backward-compat analysis was skipped; the field is additive + optional and cannot justify a bump
- `heroSelectionMode` appears in composition block rather than envelope → 9-field lock was confused with envelope extensibility
- `"HERO_DRAFT"` appears in the JSON Schema `enum` array → v1 enum was re-derived; HERO_DRAFT lives in prose only
- `"Contest of Champions"` appears in any enum, error message, JSON property, or schema validation path → flavor/lore separation guardrail violated
- The "9 locked fields" sentence in `.claude/rules/code-style.md` was removed or rewritten rather than amended with an additive clarification → scope-narrowing clarification was confused with rescission
- A file under `packages/` or `apps/` appears in `git diff --name-only` → governance-only scope was violated
- The example JSON in MATCH-SETUP-SCHEMA.md omits `heroSelectionMode` without an explicit note about the default → backward-compat is unclear; add a comment or sentence clarifying the implicit default
- The DECISIONS entry describes HERO_DRAFT mechanics rather than deferring them → governance leak into future-scope behavior; trim to reservation only
