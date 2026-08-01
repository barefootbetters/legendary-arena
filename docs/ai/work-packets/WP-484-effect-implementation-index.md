# WP-484 — Effect Implementation Index (Contract + Transform + CI Gate)

**Status:** Draft 2026-08-01 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `none — infrastructure` (a derived metadata artifact + CI freshness gate; the surface that would make it user-visible — a `/debug/effects` viewer — is explicitly Out of Scope and a separate future WP).
**Primary Layer:** Shared tooling (`scripts/`) + Registry (`packages/registry` — contract schema) + Metadata staging (`data/metadata/`)
**Dependencies:** WP-251-era hero mechanic ledger (`docs/ai/coverage/hero-mechanic-ledger.json`); WP-271 villain mechanic ledger (`docs/ai/coverage/villain-mechanic-ledger.json`); WP-269 / D-24046 metadata-feed precedent (`data/metadata/card-mechanics.json` + the `@legendary-arena/registry/schema` export site).

---

## Session Context

The effect-debugging question — *"card X's printed ability didn't fire, why?"* (the canonical example: *"Mystique's Escape didn't fire a Scheme Twist"*) — has no single answer surface. It is spread across the two committed mechanic ledgers, the generated `card-mechanics.json` hero index, the hollow-effect detector, and the client-side Play Diagnostics provenance. A companion ewiki "Debug Effects" page (`wiki/debug-effects.md`, landed on `main` via PR #1153) maps those surfaces and records the recommended unification: a **generated** effect-implementation index (never a hand-maintained per-card lookup) plus runtime traces behind a future `/debug/effects` viewer. That page is context, not authority; this WP stands on its own.

This WP builds the **first slice** of that direction: the generated index. Critically, the descriptor→handler provenance it needs is **already derived** — BOTH committed mechanic ledgers already populate a per-card×mechanic `handler` (`<file>#<primitive>`), `wp`, and `decision` for every **resolved** effect: the villain ledger (e.g. `packages/game-engine/src/villain/villainEffects.execute.ts#capture-bystander`, `WP-185`, `D-18506`) and the hero ledger alike (e.g. `packages/game-engine/src/hero/heroEffects.execute.ts#undercover`; 230 of the hero ledger's 647 rows carry a populated handler). Rows for `unsupported` mechanics (no handler exists yet) or `unmarked` mechanics (no marker) legitimately carry the empty string `""` in **both** scopes — a meaningful signal ("this effect reached no handler"), not a gap to backfill. So this WP is a **pure verbatim join** of the two committed ledgers into one published, schema-validated, dual-scope artifact — it invents no new lookup, reads no engine code, and fabricates nothing. It surfaces the provenance `card-mechanics.json` deliberately drops (`status`/`handler`/`wp`/`decision`) and widens scope from hero-only to hero + villain.

The canonical debugging example (Mystique, a villain) and every executable hero effect are all covered, because both ledgers already carry provenance. The blank (`""`) values are exactly the `unsupported`/`unmarked` rows — precisely the "no handler ran" cases a debug index should surface.

---

## Goal

After this session, a deterministic transform script generates `data/metadata/effect-implementation-index.json` — a **versioned, dual-scope (hero + villain) effect-implementation index** — by joining the two committed mechanic ledgers, validated by a new `EffectImplementationIndexSchema` exported from `@legendary-arena/registry/schema`. The published file carries (a) an `entries[]` collection (each with `extId`, `name`, `set`, `scope`, `mechanic`, `status`, `handler`, `wp`, `decision`), (b) a per-card `cards{ extId: { scope, mechanics: string[] } }` join so a consumer never re-parses a ledger, and (c) a `summary` (counts by scope + status). A CI freshness gate (`effect-index:check`) fails if the committed file drifts from a fresh regeneration, mirroring `ledger:heroes:check`. The contract shape + dual-scope + derived-not-authored policy are locked by D-24289. **No `packages/game-engine`, `apps/registry-viewer`, or `apps/dashboard` file is touched.**

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each command. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The hero mechanic ledger exists and is hero-scoped (a derivation source)
node -e "const d=require('./docs/ai/coverage/hero-mechanic-ledger.json'); if(d.cardType!=='hero'||!Array.isArray(d.rows)) process.exit(1); console.log('A_OK hero rows='+d.rows.length);"
# Expected: A_OK hero rows=<n>

# B. The villain mechanic ledger exists and is villain-scoped (the other derivation source)
node -e "const d=require('./docs/ai/coverage/villain-mechanic-ledger.json'); if(d.cardType!=='villain'||!Array.isArray(d.rows)) process.exit(1); console.log('B_OK villain rows='+d.rows.length);"
# Expected: B_OK villain rows=<n>

# C. Both ledgers carry the expected row fields (join inputs)
node -e "const h=require('./docs/ai/coverage/hero-mechanic-ledger.json').rows[0], v=require('./docs/ai/coverage/villain-mechanic-ledger.json').rows[0]; for(const k of ['extId','set','mechanic','status']){ if(!(k in h)||!(k in v)) process.exit(1);} if(!('handler' in v)||!('wp' in v)||!('decision' in v)) process.exit(1); console.log('C_OK');"
# Expected: C_OK  (both ledgers expose extId/set/mechanic/status; villain also handler/wp/decision)

# D. BOTH ledgers already populate handler provenance for their executable rows
node -e "const h=require('./docs/ai/coverage/hero-mechanic-ledger.json'),v=require('./docs/ai/coverage/villain-mechanic-ledger.json'); const eh=h.rows.find(r=>r.status==='executable'&&r.handler), ev=v.rows.find(r=>r.status==='executable'&&r.handler); if(!eh||!ev){console.error('D_FAIL',{hero:!!eh,villain:!!ev});process.exit(1)} console.log('D_OK hero='+eh.handler+' villain='+ev.handler);"
# Expected: D_OK hero=packages/game-engine/src/hero/heroEffects.execute.ts#... villain=packages/game-engine/src/villain/villainEffects.execute.ts#...

# E. The metadata staging dir + registry schema export site exist (WP-269 precedent)
test -f data/metadata/card-mechanics.json && test -f packages/registry/src/schema.ts && echo "E_OK"
# Expected: E_OK

# F. No effect-implementation index exists yet (this WP introduces it)
test -f data/metadata/effect-implementation-index.json && echo "EXISTS" || echo "ABSENT"
# Expected: ABSENT on a first run. If EXISTS, inspect `git status` + provenance: continue
#   ONLY if it is this WP-branch's own regenerated artifact. STOP if it came from another
#   branch or an unexplained abandoned attempt — do not silently overwrite it.

# G. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "G_OK"
# Expected: G_OK
```

If either ledger's `cardType` is unexpected (A/B fail), a ledger was rescoped under another WP — STOP and reconcile before pinning a dual-scope feed.

---

## Context (Read First)

- `docs/ai/coverage/hero-mechanic-ledger.json` — hero derivation source. Row shape `{ extId, heroName, set, mechanic, status, wp, decision, handler }` (`handler`/`wp`/`decision` populated for resolved rows — 230 of 647 carry a handler — `""` on `unsupported`/`unmarked`) + `summary`. The transform reads `rows[]` and joins by `extId`.
- `docs/ai/coverage/villain-mechanic-ledger.json` — villain derivation source. Row shape `{ extId, cardName, set, cardType, mechanic, status, wp, decision, handler }` — `handler` already populated as `<file>#<primitive>` for executable rows. `heroName` (hero) vs `cardName` (villain) is the only field-name divergence the transform normalizes into `name`.
- `scripts/build-card-mechanics-metadata.mjs` (WP-269) — the closest transform precedent: reads a committed ledger, self-validates against a registry schema imported from `../packages/registry/dist/schema.js`, `--check` regenerates-in-memory and CRLF-normalizes both sides before comparison, and resolves a byte-stable `generatedAt` via a `1970-01-01T00:00:00.000Z` sentinel (never `Date.now()`). Mirror its determinism, `--check`, and self-validation patterns exactly — but read the TWO ledgers, and DO NOT import the game-engine dist (this transform needs no source classification; the ledgers already carry `status`/`handler`).
- `packages/registry/src/schema.ts` (`CardMechanicsIndexSchema`, WP-269 / D-24046) — the contract precedent: a data-only Zod schema exported via the `/schema` subpath, with a `.superRefine` enforcing count integrity + bidirectional mechanic↔card join. Mirror its shape and export site; add `EffectImplementationIndexSchema` beside it.
- `.github/workflows/ci.yml` — the `hero-effect-coverage` job runs `pnpm ledger:heroes:check`, `ledger:villains:check`, `mechanics:metadata:check` (all after `pnpm -r build`). Add the new `effect-index:check` step in the same job, after `pnpm -r build`.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` + `.claude/rules/architecture.md §Import Rules` — the registry package may import `zod` + Node built-ins only (never game-engine). The schema added here is data-only. The transform is a repo-root build script; it reads only committed JSON ledgers (no engine dist).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 11 (full-sentence errors), `for...of` over `.reduce()` for the join/group logic.
- `wiki/debug-effects.md` (landed on `main` via PR #1153) — the companion ewiki page that records this index as the recommended debugging direction (context, not authority; not a hard code dependency).

---

## Scope (In)

- Add `scripts/build-effect-implementation-index.mjs` — a deterministic ESM transform that reads `docs/ai/coverage/hero-mechanic-ledger.json` and `docs/ai/coverage/villain-mechanic-ledger.json`, normalizes each row into a `scope`-tagged entry (`heroName`/`cardName` → `name`; `scope` = `"hero"`|`"villain"`), joins by card into `cards{ extId: { scope, mechanics } }`, computes a `summary` (counts by scope + status), self-validates against `EffectImplementationIndexSchema`, and writes `data/metadata/effect-implementation-index.json`. Supports `--check` (regenerate-in-memory vs committed, CRLF-normalized; non-zero exit on drift) mirroring `ledger:heroes:check`.
- Add the generated `data/metadata/effect-implementation-index.json` (committed — the staging copy + CI freshness target).
- Add `EffectImplementationIndexSchema` (+ inferred `EffectImplementationIndex` / `EffectImplementationEntry` types) to `packages/registry/src/schema.ts`, exported via the existing `@legendary-arena/registry/schema` subpath. Data-only Zod; no engine import.
- Add root `package.json` scripts `effect-index` and `effect-index:check`.
- Add a `.github/workflows/ci.yml` freshness step running `pnpm effect-index:check` (in the existing `hero-effect-coverage` job, after `pnpm -r build`).
- Reserve and land D-24289 (the published-contract shape + dual-scope + derived-not-authored lock).

## Out of Scope

- Any `packages/game-engine` file — no handler map is edited, no metadata is co-located in engine code, no engine dist is imported. Co-locating `{decision, file, notes}` on the villain/hero handler maps is a deliberate **future refinement**, not this WP.
- Any `apps/registry-viewer`, `apps/dashboard`, or `apps/arena-client` file — no consumer, no `/debug/effects` route, no viewer wiring. The `/debug/effects` viewer is a separate future WP.
- **Runtime effect tracing** — the structured per-dispatch `[EFFECT]` trace described in the Debug Effects page is a separate future WP; this WP produces the static index only.
- **Resolving provenance the ledgers don't already carry** — the index passes `handler`/`wp`/`decision` through verbatim; it does NOT extend either ledger generator to resolve new provenance. The `""` on `unsupported`/`unmarked` rows (both scopes) is passed through as-is, never synthesized.
- **Normalizing mechanic tokens** — unlike `card-mechanics.json`, the index carries the ledger's `mechanic` string verbatim (including the `"(unmarked)"` sentinel). A UI-safe slug layer, if ever wanted, is a separate concern.
- **Per-ability-line / per-descriptor granularity** — the index is per card × mechanic (the ledger granularity). Finer per-ability-line, multi-descriptor-per-line rows are a future refinement.
- Modifying, replacing, or re-scoping `card-mechanics.json`, the mechanic ledgers, or the hollow-effect detector — this feed is additive and reads the ledgers read-only.
- The actual R2 upload — the artifact is staged in-repo and rides the existing metadata-publish flow (same as `card-mechanics.json`).

---

## Files Expected to Change

- `scripts/build-effect-implementation-index.mjs` — **new** (deterministic two-ledger join transform + `--check`; self-validates output against `EffectImplementationIndexSchema` before writing / comparing)
- `data/metadata/effect-implementation-index.json` — **new** (generated artifact, committed)
- `packages/registry/src/schema.ts` — **modified** (additive: `EffectImplementationIndexSchema` + inferred types)
- `packages/registry/src/schema.effectImplementationIndex.test.ts` — **new** (`node:test` accept/reject coverage; mirrors the `schema.cardMechanicsIndex.test.ts` naming)
- `package.json` — **modified** (`effect-index` + `effect-index:check` scripts)
- `.github/workflows/ci.yml` — **modified** (freshness gate step in `hero-effect-coverage`)
- `docs/ai/DECISIONS.md` — **modified** (land D-24289)
- `docs/ai/STATUS.md` — **modified** (Done entry)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status flip)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status flip)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (flip the WP-484 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

11 files (6 producer/test/CI + 5 governance). The producer surface has no value in partial landing — the schema, the generated artifact, the schema tests, and the freshness gate form one contract — so the bundle is justified inline per the §5 file-count guidance.

---

## Contract (Locked by D-24289)

The published `data/metadata/effect-implementation-index.json` shape:

```json
{
  "version": 1,
  "scope": "all",
  "generatedAt": "1970-01-01T00:00:00.000Z",
  "summary": {
    "totalEntries": 0,
    "byScope": { "hero": 0, "villain": 0 },
    "byStatus": { "executable": 0, "deferred": 0, "condition": 0, "unsupported": 0, "unmarked": 0 }
  },
  "entries": [
    {
      "extId": "2099-villain-alchemax-enforcers-cyber-nostra",
      "name": "Cyber-Nostra",
      "set": "2099",
      "scope": "villain",
      "mechanic": "heroDeckTopToEscape",
      "status": "executable",
      "handler": "packages/game-engine/src/villain/villainEffects.execute.ts#hero-deck-top-to-escape",
      "wp": "WP-185",
      "decision": ""
    }
  ],
  "cards": {
    "2099-villain-alchemax-enforcers-cyber-nostra": { "scope": "villain", "mechanics": ["heroDeckTopToEscape"] }
  }
}
```

- `version` integer `1`; `scope` the literal `"all"` (dual-scope index — distinct from `card-mechanics.json`'s `"hero"`).
- `entries[]` sorted ascending by `extId`, then `mechanic`. Each entry carries exactly `extId`, `name`, `set`, `scope`, `mechanic`, `status`, `handler`, `wp`, `decision` — in that property order.
- `scope` per entry ∈ the closed union `"hero" | "villain"`.
- `status` ∈ the closed union `"executable" | "deferred" | "condition" | "unsupported" | "unmarked"` (the ledger status vocabulary).
- `handler`, `wp`, `decision` are **pass-through strings from the source ledger** — populated for **resolved** rows in BOTH scopes (executable hero + villain effects each carry a `<file>#<primitive>` handler), and the empty string `""` for `unsupported`/`unmarked` rows where no handler exists. Empty string, never `null` and never a fabricated value.
- `mechanic` is the ledger's mechanic token **verbatim** — NOT normalized (unlike `card-mechanics.json`); the villain `unmarked` sentinel appears as the literal `"(unmarked)"` the ledger carries. The index mirrors the ledgers exactly.
- `cards{}` keys are engine ext_ids, sorted ascending; each `cards[extId]` carries its single `scope` and a sorted, de-duplicated `mechanics[]`.
- `summary.totalEntries === entries.length`; `byScope`/`byStatus` are exact counts over `entries`.
- `generatedAt` is deterministic (no `Date.now()` in the transform) — see Generated Timestamp below.

### Generated Timestamp

`generatedAt` MUST be input-derived and byte-stable. Neither committed ledger exposes a timestamp field, so the transform resolves it as: (1) `heroLedger.generatedAt` if a valid ISO-8601 UTC string; (2) else `villainLedger.generatedAt` if valid; (3) otherwise the fixed sentinel `"1970-01-01T00:00:00.000Z"` (the current outcome). The transform MUST NOT call `Date.now()`, `new Date()`, or any wall-clock API. The sentinel keeps the contract shape stable while `--check` stays byte-identical (the WP-269 pattern).

### Deterministic Ordering

- Top-level property order: `version`, `scope`, `generatedAt`, `summary`, `entries`, `cards`.
- Entry property order: `extId`, `name`, `set`, `scope`, `mechanic`, `status`, `handler`, `wp`, `decision`.
- `entries[]` sorted ascending by `(extId, mechanic)`; `cards{}` keys sorted ascending; each `cards[extId].mechanics[]` sorted ascending + de-duplicated.
- `summary` property order: `totalEntries`, `byScope`, `byStatus`; the `byStatus` keys are emitted in the fixed status-union order above (a status with zero rows is still emitted as `0`, so the shape is stable across card-data changes).
- Written as pretty JSON with two-space indentation and a final trailing newline.

### Schema Refinements

`EffectImplementationIndexSchema` MUST reject (via `.superRefine`, mirroring the `CardMechanicsIndexSchema` precedent) at minimum:

- missing `version`; `version` other than `1`; top-level `scope` other than `"all"`.
- an entry `scope` outside `{ hero, villain }`; an entry `status` outside the closed status union.
- `summary.totalEntries !== entries.length`; a `byScope`/`byStatus` count that disagrees with the actual entry tally.
- a `cards[extId].mechanics[]` slug/mechanic with no matching `entries[]` row for that `extId` (card→entry join).
- an `entries[]` `(extId, mechanic)` pair absent from `cards[extId].mechanics` (entry→card join).
- a `cards[extId].scope` disagreeing with the `scope` of that card's entries.

These are pure structural checks over the parsed object; they MUST NOT import game-engine data.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — N/A (deterministic transform; ordering via explicit sorts).
- Never throw inside boardgame.io move functions — N/A (build script + data schema).
- Never persist `G`, `ctx`, or runtime state — N/A.
- ESM only, Node v22+ — the transform is `.mjs`; `node:` prefix on all built-in imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — `for...of` for the join/group (no `.reduce()` with branching), full-word names, `// why:` on the `generatedAt` sentinel and the empty-string pass-through.
- Full file contents required for every new/modified file in the session output — no diffs, no snippets.

**Packet-specific:**
- `packages/registry/src/schema.ts` MUST NOT import `@legendary-arena/game-engine` (or any non-`zod`, non-Node module) — the schema is data-only.
- The transform MUST NOT import the game-engine dist or any `packages/**` runtime module except the registry dist schema (`../packages/registry/dist/schema.js`) for self-validation. It reads only the two committed JSON ledgers. (This is why it needs no `pnpm -r build` of the engine to run — but CI runs it after `-r build` anyway, harmlessly.)
- The transform MUST be deterministic: identical ledger inputs ⇒ byte-identical `effect-implementation-index.json`. No wall-clock reads; `generatedAt` derives from input. `--check` regenerates in memory, CRLF-normalizes both sides, and exits non-zero on any byte difference.
- `handler`/`wp`/`decision` are pass-through: emit the ledger value verbatim, or `""` when the ledger value is empty. NEVER synthesize, infer, or fabricate a handler path or decision id the ledger does not carry.
- The feed carries BOTH scopes; `scope` top-level is the literal `"all"`. Do not emit a hero-only or villain-only feed (that would duplicate `card-mechanics.json` / the villain ledger).
- The transform MUST validate its own output with `EffectImplementationIndexSchema` (imported from `../packages/registry/dist/schema.js`) before writing and before returning success in `--check`. Producer loop: read hero ledger → read villain ledger → normalize + join → validate → write or compare.

**Session protocol:**
- If either ledger shape differs from preconditions A–C (missing `rows[]`, wrong `cardType`, or missing row fields): STOP and report — a derivation source changed.
- If a registry-package consumer test fails after adding the schema (the schema is additive): STOP and report; do not modify an existing schema to compensate.
- If `--check` cannot be made byte-stable (a nondeterministic ordering surfaces): STOP — fix the ordering (explicit sort), do not relax the gate.

**Locked contract values:**
- Published path: exactly `data/metadata/effect-implementation-index.json`; R2 path `/metadata/effect-implementation-index.json`.
- Schema export: `EffectImplementationIndexSchema` from `@legendary-arena/registry/schema`.
- Top-level `scope`: the literal `"all"`.
- Entry `scope` closed union: `hero` | `villain`.
- `status` closed union: `executable` | `deferred` | `condition` | `unsupported` | `unmarked`.
- `handler`/`wp`/`decision`: verbatim ledger pass-through, `""` when blank; never fabricated.
- `generatedAt` sentinel: `"1970-01-01T00:00:00.000Z"` (neither ledger exposes a timestamp).
- Entry sort key: `(extId, mechanic)` ascending; `cards{}` keys + each `mechanics[]` sorted + de-duped; 2-space indent + trailing newline.
- Transform self-validates output via `EffectImplementationIndexSchema` (registry dist) before write/compare.
- npm scripts: `effect-index`, `effect-index:check`.
- DECISIONS reservation: D-24289.

---

## Acceptance Criteria

1. `pnpm effect-index` produces `data/metadata/effect-implementation-index.json` with top-level `version: 1`, `scope: "all"`, the deterministic `generatedAt` sentinel, a `summary`, an `entries[]` collection, and a per-card `cards{}` mapping.
2. Every `entries[]` entry carries exactly `extId`, `name`, `set`, `scope`, `mechanic`, `status`, `handler`, `wp`, `decision` — in that property order.
3. Every entry `scope` ∈ `{ hero, villain }`; both scopes are present (`summary.byScope.hero > 0` and `summary.byScope.villain > 0`).
4. Every entry `status` ∈ `{ executable, deferred, condition, unsupported, unmarked }`.
5. `handler`/`wp`/`decision` are verbatim ledger pass-throughs: at least one executable **hero** entry AND one executable **villain** entry each carry a non-empty `handler` of the form `<file>#<primitive>`; `unsupported`/`unmarked` rows appear as `""` (never `null`, never fabricated).
6. Ordering is locked: `entries[]` sorted by `(extId, mechanic)`; `cards{}` keys sorted; each `cards[extId].mechanics[]` sorted + de-duped; two-space indent + trailing newline.
7. `summary.totalEntries === entries.length`; `byScope`/`byStatus` counts equal the actual entry tallies; all five status keys are present (zero-count keys emitted as `0`).
8. Bidirectional join integrity holds: every `entries[]` `(extId, mechanic)` appears in `cards[extId].mechanics`, AND every `cards[extId].mechanics[]` entry has a matching `entries[]` row; `cards[extId].scope` matches that card's entries' scope.
9. `EffectImplementationIndexSchema.safeParse()` accepts the generated file and is exported from `@legendary-arena/registry/schema`.
10. `EffectImplementationIndexSchema.safeParse()` rejects malformed payloads — at minimum wrong `version`, wrong top-level `scope`, an invalid entry `scope`/`status`, a `summary` count mismatch, and each join-mismatch direction — covered by `schema.effectImplementationIndex.test.ts`.
11. `packages/registry/src/schema.ts` does NOT import `@legendary-arena/game-engine` or any engine module (data-only schema); the transform imports no game-engine dist module.
12. The transform self-validates its output against `EffectImplementationIndexSchema` before writing / comparing.
13. `pnpm effect-index:check` exits 0 against the committed file and non-zero after a deliberate edit (freshness gate works); the CI step is added to `hero-effect-coverage` after `pnpm -r build`.
14. The transform is deterministic — two consecutive `pnpm effect-index` runs produce byte-identical output (no `Date.now()`).
15. `pnpm -r build` and `pnpm test` exit 0; no `packages/game-engine`, `apps/registry-viewer`, `apps/dashboard`, or `apps/arena-client` file is modified.

---

## Verification Steps

```bash
# 1. Generate + confirm top-level contract
pnpm effect-index
node -e "const d=require('./data/metadata/effect-implementation-index.json'); console.log(d.version, d.scope, Array.isArray(d.entries), typeof d.cards==='object', typeof d.summary==='object');"
# Expected: 1 all true true true

# 2. Entry shape + closed unions + both scopes present
node -e "const d=require('./data/metadata/effect-implementation-index.json'); const sc=new Set(['hero','villain']); const st=new Set(['executable','deferred','condition','unsupported','unmarked']); const bad=d.entries.find(e=>!sc.has(e.scope)||!st.has(e.status)); if(bad){console.error('BAD',bad.extId,bad.mechanic);process.exit(1)} if(!(d.summary.byScope.hero>0&&d.summary.byScope.villain>0)){console.error('missing a scope');process.exit(1)} console.log('OK', d.entries.length, 'entries', d.summary.byScope);"
# Expected: OK <n> entries { hero: <h>, villain: <v> }

# 3. handler pass-through (a populated handler exists in EACH scope; blanks are "")
node -e "const d=require('./data/metadata/effect-implementation-index.json'); const hv=d.entries.find(e=>e.scope==='villain'&&e.status==='executable'&&e.handler.includes('#')); const hh=d.entries.find(e=>e.scope==='hero'&&e.status==='executable'&&e.handler.includes('#')); if(!hv||!hh){console.error('missing a populated handler', {villain:!!hv, hero:!!hh});process.exit(1)} const nulls=d.entries.find(e=>e.handler===null||e.wp===null||e.decision===null); if(nulls){console.error('null pass-through',nulls.extId);process.exit(1)} console.log('handler samples:', hh.handler, '|', hv.handler);"
# Expected: handler samples: packages/game-engine/src/hero/heroEffects.execute.ts#... | packages/game-engine/src/villain/villainEffects.execute.ts#...

# 4. summary integrity + all five status keys present
node -e "const d=require('./data/metadata/effect-implementation-index.json'); if(d.summary.totalEntries!==d.entries.length)process.exit(1); for(const k of ['executable','deferred','condition','unsupported','unmarked']){ if(!(k in d.summary.byStatus))process.exit(1);} console.log('summary OK', d.summary.totalEntries);"
# Expected: summary OK <n>

# 5. Bidirectional join integrity (entry<->card, scope agreement)
node -e "const d=require('./data/metadata/effect-implementation-index.json'); const byCard={}; for(const e of d.entries){(byCard[e.extId]=byCard[e.extId]||new Set()).add(e.mechanic); const c=d.cards[e.extId]; if(!c||c.scope!==e.scope||!c.mechanics.includes(e.mechanic)){console.error('entry->card miss',e.extId,e.mechanic);process.exit(1)}} for(const [id,c] of Object.entries(d.cards)){for(const m of c.mechanics){if(!byCard[id]||!byCard[id].has(m)){console.error('card->entry miss',id,m);process.exit(1)}}} console.log('join integrity OK');"
# Expected: join integrity OK

# 6. Schema validates the generated file + rejects malformed
pnpm --filter @legendary-arena/registry test 2>&1 | tail -3
# Expected: exit 0; the EffectImplementationIndexSchema accept/reject tests pass

# 7. Schema is data-only (no engine import); transform reads no engine dist
grep -n 'game-engine' packages/registry/src/schema.ts scripts/build-effect-implementation-index.mjs
# Expected: NO MATCH

# 8. Freshness gate
pnpm effect-index:check; echo "clean exit=$?"   # Expected: exit 0
# (after a manual edit to the committed file, expect non-zero)

# 9. Determinism
pnpm effect-index && cp data/metadata/effect-implementation-index.json /tmp/a.json && pnpm effect-index && diff -q /tmp/a.json data/metadata/effect-implementation-index.json
# Expected: files identical (no diff)

# 10. No engine/viewer/dashboard/client files touched
git diff --name-only | grep -E '^(packages/game-engine|apps/(registry-viewer|dashboard|arena-client))/' ; echo "hits above (expect none)"

# 11. Full build/test
pnpm -r build && pnpm test
# Expected: both exit 0
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All preconditions (A–G) passed before the edit
- [ ] All 15 Acceptance Criteria pass
- [ ] All 11 Verification Steps produce the expected output
- [ ] `data/metadata/effect-implementation-index.json` carries the locked contract shape + property/array ordering; `entries[]` + `cards{}` + `summary` present; both scopes populated
- [ ] `handler`/`wp`/`decision` are verbatim ledger pass-throughs (`""` on `unsupported`/`unmarked` rows; never fabricated); ≥1 executable hero entry AND ≥1 executable villain entry each carry a `<file>#<primitive>` handler
- [ ] Bidirectional entry/card join integrity + scope agreement pass
- [ ] `EffectImplementationIndexSchema` exported from `@legendary-arena/registry/schema`; data-only (no engine import); rejects the AC-10 malformed payloads
- [ ] Transform self-validates output against the schema before write/compare; imports no game-engine dist
- [ ] `effect-index:check` gate green on the committed file; CI step added to `hero-effect-coverage` (after `pnpm -r build`)
- [ ] Transform deterministic (byte-stable across runs)
- [ ] No `packages/game-engine` / `apps/registry-viewer` / `apps/dashboard` / `apps/arena-client` file modified
- [ ] `docs/ai/STATUS.md` Done entry names WP-484 + the feed, and states "No user-observable change — infrastructure only" (per §15.1, `User-Visible Surface = none — infrastructure`)
- [ ] `docs/ai/DECISIONS.md` D-24289 landed (contract + dual-scope + derived-not-authored + deterministic-generation lock); Status flips to Active
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-484 node flipped `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-519:` for code/test/CI, `SPEC:` for governance close

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (re-issued after adversarial verify, 2026-08-01)

Dependencies verified empirically this session against the actual ledger files, not asserted: both committed mechanic ledgers exist and are correctly scoped (`hero-mechanic-ledger.json` `cardType: "hero"`, `villain-mechanic-ledger.json` `cardType: "villain"`), both expose the join row fields, and — corrected after an independent adversarial verify — **both** ledgers already populate `handler` in the `<file>#<primitive>` form for resolved rows (the hero ledger carries a handler on 230 of 647 rows, e.g. `heroEffects.execute.ts#undercover`; the villain ledger likewise). The draft's original "hero provenance is blank" premise was **false** and has been struck throughout — the corrected framing (both scopes populated for resolved rows; `""` for `unsupported`/`unmarked` in both) is the one verified here. The `data/metadata/` staging dir + the `@legendary-arena/registry/schema` export site are present (WP-269 precedent). Scope is locked (11-file allowlist); the design resolves the shape ambiguities (dual-scope `"all"`, entry/card join, `byStatus` fixed-key ordering, verbatim pass-through incl. the `"(unmarked)"` mechanic sentinel). Architectural boundary holds: the schema is data-only Zod, and the transform reads only committed JSON (no engine dist, no `packages/**` runtime import except the registry dist schema for self-validation). **Empirical Scaffold N/A** — this WP adds a brand-new input path (new artifact + new schema + its own new test); it tightens no existing validation path with pre-existing fixtures. **Mutation Boundary N/A** — no `G`/move mutation (build script + data schema).

### Copilot (`01.7`) — verdict: **PASS** (re-issued after adversarial verify, 2026-08-01)

No RISK/BLOCK across the failure-mode lens. Separation of concerns (join isolated to the transform; schema `zod`-only, no engine import), determinism (sentinel + locked ordering + no `Date.now()` + `--check` CRLF-normalized + self-validation), type-safety/contract (closed `scope`/`status` unions + `superRefine` count/join rejects), persistence (no `G`/runtime state — N/A), testing (new `schema.effectImplementationIndex.test.ts` accept/reject), scope/governance (11-file allowlist, two-commit topology), and error handling (full-sentence errors; STOP-on-shape-drift) are all covered. The pass-through-not-fabricate rule (never synthesize a handler/decision the ledger lacks) is the load-bearing honesty constraint and is locked in both Non-Negotiable Constraints and AC-5. **Correction folded from the adversarial verify:** the draft originally treated hero provenance as a blank "gap" and dispositioned a RISK around it; that premise was false (both ledgers already populate provenance), so the RISK is withdrawn and the framing corrected — `""` values are the `unsupported`/`unmarked` rows in both scopes, a meaningful "no handler ran" signal rather than a gap. The independent verify also confirmed no fabricated identifiers and every referenced existing identifier (ledger fields, schema export site, `hero-effect-coverage` CI job, script names) resolves.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS (all required sections; Out of Scope lists 7 exclusions).
- **§2 Non-Negotiable Constraints** — PASS (Engine-wide + Packet-specific + Session protocol + Locked values; full-file-contents required; references 00.6).
- **§3 Assumes** — PASS (preconditions A–G with exact expected output).
- **§4 Context** — PASS (both ledgers, the WP-269 transform + schema precedents, the CI gate, ARCHITECTURE layer boundary, 00.6 — all specific). 00.2 N/A — the row fields are coverage-ledger tokens, not 00.2 card-data/setup-payload fields.
- **§5 Files Expected to Change** — PASS (11 files incl. the schema test, each marked new/modified + described; bundling justified inline).
- **§6 Naming** — PASS (full-word names; `effect-implementation-index.json` mirrors `card-mechanics.json`; `scope`/`status`/`handler` descriptive; `ext_id`/`extId` per ledger convention).
- **§7 Dependencies** — PASS (no new npm deps).
- **§8 Architectural Boundaries** — PASS (schema data-only; transform reads only committed JSON; explicit grep gate Verification-7 enforces no `game-engine` import in either file).
- **§9 Windows Compatibility** — PASS (`pnpm` + `node -e` + `grep`/`diff` via the Bash tool, established convention).
- **§10 Env Vars** — N/A (none).
- **§11 Auth** — N/A.
- **§12 Test Quality** — PASS (schema unit tests via `node:test`; no boardgame.io; no network/DB; deterministic-output assertion is invariant-focused).
- **§13 Verification Commands** — PASS (all `pnpm`/`node`; exact with expected output).
- **§14 Acceptance Criteria** — PASS (15 binary, observable, file-specific).
- **§15 Definition of Done** — PASS (STATUS + DECISIONS D-24289 + WORK_INDEX + EC_INDEX + ROADMAP-MINDMAP + scope-boundary check; §15.1 `none — infrastructure` STATUS wording required).
- **§16 Code Style** — PASS (`for...of` join, no reduce-with-branching, `// why:` on the sentinel + empty-string pass-through, full-sentence errors).
- **§17 Vision Alignment** — present below (§10a Registry Viewer + §1/§2/§10 card-data trigger considered).
- **§18 Prose-vs-Grep** — N/A (Verification-7 greps `game-engine` in the schema + transform source, not this doc; no verbatim forbidden-token enumeration in those files).
- **§19 Bridge-vs-HEAD** — commit-time discipline; STATUS entry authored at execution against live HEAD.
- **§20 Funding Surface Gate** — N/A (see below).
- **§21 API Catalog** — N/A (see below).

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Vision clauses touched:** §10 (card data / content semantics — read-only), §10a (Registry Viewer public surfaces — the artifact is R2-staged metadata like `card-mechanics.json`), §22 (determinism, via the byte-stable generation).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The index is a read-only re-projection of two existing committed coverage ledgers into one published artifact — it changes no card semantics, adds no gameplay behavior, and wires no new public surface in this WP (the `/debug/effects` consumer is future work).

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed — the index carries no monetization, persuasion, pay-to-win, or competitive-integrity surface; it is developer/debug data-tooling.

**Determinism preservation:** the transform is deterministic and replay-irrelevant — it reads static committed JSON, uses explicit sorts and an input-derived `generatedAt` sentinel (no `Date.now()`), touches no `G`/`ctx`/RNG/replay/scoring surface, and its `--check` gate proves byte-stability.

## Funding Surface Gate

**N/A — no funding surface touched.** No §20.1 trigger surface: no navigation / registry-viewer funding affordance, no profile/account funding attribution, no tournament-funding integration, no user-visible funding copy. Internal data-tooling only. (Authority chain per §20 form: WP-097, D-9701, D-9801.)

## API Catalog Update

**N/A — no API surface touched.** Per lint §21.4: no HTTP endpoint and no `apps/server/src/**` library function added or modified. The feed is a static R2 metadata JSON, not a server route; `docs/ai/REFERENCE/api-endpoints.md` is unaffected.
