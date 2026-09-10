# WP-686 — Final Blow Mastermind Setup Flag (registry + engine)

**Status:** Draft 2026-09-10
**Primary Layer:** Registry + Game Engine
**User-Visible Surface:** none — infrastructure
**Dependencies:** None (the flag is additive and inert; WP-687 consumes it)
**Baseline:** drafted against `origin/main` @ `4b5f2ca7`

---

## Goal

After this session, a match may be marked as playing the optional **Final
Blow** Mastermind rule via a single additive, optional match-setup **envelope**
field, `finalBlow?: boolean`. The registry-side setup contract accepts and
shape-validates the field (mirroring the `heroSelectionMode` / `heroAlternateIds`
extensibility precedent), the governance docs document it, and — unlike every
prior envelope field — the **engine consumes it**: the engine's setup payload
(`MatchConfiguration`) gains the same additive optional `finalBlow`, and the
state constructor `buildInitialGameState` stores it on `G` as an **optional**
`finalBlow?: boolean` that is **set only when the flag is `true`** and
**omitted entirely when false or absent**. The flag is **inert** in this WP: no
gameplay behavior changes, and because the field is omitted when off, a
non–Final-Blow match's `G` serializes **byte-identically** to today — so no
state-hash oracle moves and no re-pin is required. Its sole observable effect is
that a match created with `finalBlow: true` carries `G.finalBlow === true`,
ready for WP-687's endgame gate to read. The 9-field `MatchSetupConfig`
composition lock is untouched.

---

## Assumes

- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md`, `MATCH-SETUP-JSON-SCHEMA.json`,
  and `MATCH-SETUP-VALIDATION.md` exist and are the canonical governance set
  (`schemaVersion: "1.0"`).
- `packages/registry/src/setupContract/setupContract.types.ts` exports
  `SetupEnvelope` (currently carrying `heroSelectionMode?`, `supportPools?`,
  `heroAlternateIds?` as additive optional envelope fields) and
  `setupContract.schema.ts` validates the envelope with a `.strict()` zod
  object.
- `packages/game-engine/src/matchSetup.types.ts` exports `MatchSetupConfig`
  (the 9-field composition contract); `packages/game-engine/src/types.ts`
  aliases `MatchConfiguration = MatchSetupConfig` (a bare alias today,
  `types.ts:445`) and declares `LegendaryGameState`.
- `packages/game-engine/src/game.ts` `LegendaryGame.setup()` does **not** build
  `G` itself: it calls `validateMatchSetup(...)` (reading only `result.ok`) and
  delegates to `buildInitialGameState(matchConfiguration, registryForSetup,
  context)` (`game.ts:374`), returning that object verbatim.
- `packages/game-engine/src/setup/buildInitialGameState.ts` is the sole `G`
  constructor: it builds the `baseState` object literal
  (`buildInitialGameState.ts:580`) with `matchConfiguration: config`, and its
  first parameter is typed `config: MatchSetupConfig` (the narrow 9-field type,
  `:248`) — so it must be widened to `MatchConfiguration` to read
  `config.finalBlow`.
- `packages/game-engine/src/matchSetup.validate.ts` `validateMatchSetup` builds
  its success `value` from the 9 composition fields only (it strips extra
  fields) and does not reject unknown envelope fields — so `finalBlow` passes
  through the engine validator untouched and is **not** carried on the
  validator's returned value; storage reads it off the raw payload in
  `buildInitialGameState`.
- `apps/server/src/match/matchGate.routes.ts` `POST /api/match/create`
  forwards `requestBody.setupData` **verbatim** to boardgame.io's native
  `/games/legendary-arena/create` endpoint (`matchGate.routes.ts:320`, no
  server-side reshaping) — so a new optional field inside `setupData` reaches
  the engine with no server code change.
- The heroSelectionMode envelope-field precedent (`docs/ai/DECISIONS.md`
  D-9301, `docs/ai/work-packets/WP-093-*.md`) is the model.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` — the "Final Blow (Optional)" box:
  after the Mastermind's 4 Tactics are gone, a player must still fight the
  Mastermind card itself a 5th, final time to put it into their Victory Pile
  and win; a group decides at the start whether to use it. This WP adds only
  the "decide at the start" flag; the gameplay is WP-687.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) — Registry → Game
  Engine → Server; the registry setup contract is browser-safe and must not
  import the engine.
- `.claude/rules/architecture.md` §Import Rules and §Persistence Boundary — `G`
  is JSON-serializable and runtime-only.
- `.claude/rules/code-style.md` §Data Contracts — the 9-field composition lock
  applies to `MatchSetupConfig`; the envelope is extensible per
  `MATCH-SETUP-SCHEMA.md §Extensibility Rules`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 Match Configuration — the
  9 composition field names (unchanged) + the envelope-extensibility subsection.
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` §Extensibility Rules and the
  envelope optional-fields table.
- `docs/ai/DECISIONS.md` — scan D-9301, D-24194, D-24212 for the
  envelope-additive precedent; the reserved D-24503 entry lands at execution.
- `packages/game-engine/src/replay/replay.hash.ts` (`computeStateHash`, the
  `PRE_WP080` oracle) and `packages/game-engine/src/test/fixtures/hashGameState.ts`
  (`hashGameState`, the `finalStateHash` oracle) — both serialize the **entire**
  `LegendaryGameState` excluding only a small denylist. Read the "absent on
  fresh G → byte-identical" precedent: an **optional field omitted when off**
  does not move these oracles; an always-present field would. This is why
  `G.finalBlow` is optional/omit-when-false.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — the `baseState`
  literal (the storage site) and its narrow `config` parameter.
- `docs/ai/REFERENCE/api-endpoints.md` — the `POST /api/match/create` catalog
  row whose request shape gains the optional `finalBlow` (§21 update).

---

## Scope (In)

### A) Registry setup contract — the envelope field

- `packages/registry/src/setupContract/setupContract.types.ts` — **modified** —
  add `finalBlow?: boolean` to `SetupEnvelope` (after `heroAlternateIds`),
  with a `// why:` block citing the envelope-extensibility precedent and
  noting that, unlike prior envelope fields, the engine consumes this one.
- `packages/registry/src/setupContract/setupContract.schema.ts` — **modified** —
  add `finalBlow: z.boolean().optional()` to the envelope schema object, so a
  document with a non-boolean `finalBlow` is rejected and an absent field is
  accepted.
- `packages/registry/src/setupContract/setupContract.test.ts` — **modified** —
  cases: (1) `finalBlow: true` validates; (2) `finalBlow: false` validates;
  (3) absent `finalBlow` validates; (4) `finalBlow: "yes"` (non-boolean) is
  rejected with a `wrong_type` diagnostic.

### B) Engine setup payload + G storage — the flag reaches the engine

- `packages/game-engine/src/types.ts` — **modified** — change
  `MatchConfiguration` from a bare alias to
  `MatchSetupConfig & { readonly finalBlow?: boolean }` (additive optional
  field over the unchanged 9-field composition), and add
  `readonly finalBlow?: boolean;` to `LegendaryGameState` — **optional**, with
  a `// why:` block: runtime Final Blow rule flag, seeded only when true so a
  non–Final-Blow match serializes byte-identically (the absent-on-fresh
  precedent); read by WP-687.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  widen the first parameter from `config: MatchSetupConfig` to
  `config: MatchConfiguration`, and in the `baseState` literal set
  `finalBlow` **only when** `config.finalBlow === true` (conditional spread:
  `...(config.finalBlow === true ? { finalBlow: true } : {})`), so the field
  is omitted for every non–Final-Blow match. `// why:` comment on the
  conditional. The 9-field composition read is unchanged; widening the param
  type does not touch the `MatchSetupConfig` lock.

### C) Engine test — round-trip proof (inert, byte-identical off)

- `packages/game-engine/src/game.test.ts` — **modified** — assert that a match
  set up with `finalBlow: true` yields `G.finalBlow === true`; a match with
  `finalBlow: false` or absent yields `G.finalBlow === undefined` (field
  omitted); and that **no other observable behavior changes** (endgame,
  tactics, fight identical) — the inert contract. If the suite has a
  whole-`G` serialization/hash assertion available, assert a `finalBlow: false`
  match's `G` is byte-identical to the no-flag baseline.

### D) Governance docs

- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` — **modified** — add `finalBlow`
  to the envelope optional-fields table + a §Extensibility bullet citing
  D-24503; note it is the first envelope field the engine consumes.
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` — **modified** — add root
  property `"finalBlow": { "type": "boolean", ... }`; **not** in `required`;
  `additionalProperties` stays `false`.
- `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` — **modified** — Stage 1
  bullet: if `finalBlow` present it must be a boolean; absent → treated as
  `false`. Add valid + invalid test-coverage entries.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — extend the
  §8.1 "Envelope Extensibility" subsection listing `finalBlow` (the 9-field
  composition table is unchanged).
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — replace the
  `POST /api/match/create` row wholesale (D-11804) to note the request
  `setupData` accepts the additive optional `finalBlow` boolean.
- `docs/ai/DECISIONS.md` — **modified** — land **D-24503**: the envelope field,
  its engine-consumption divergence, the intersection-over-`MatchSetupConfig`
  payload widening, the optional/omit-when-false `G.finalBlow` storage in
  `buildInitialGameState`, the byte-identical-when-off analysis (no re-pin),
  schemaVersion-no-bump, and the inert scope.
- `docs/ai/STATUS.md` — **modified** — a "No user-observable change —
  infrastructure only" entry (per §15.1, this is a `none — infrastructure` WP).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — flip the WP-686 row
  `[ ]` → `[x]` with the date at close.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip EC-723
  Pending → Done at close.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip the WP-686 node `📝` →
  `✅` at close, then `pnpm roadmap:counts:write`.

---

## Out of Scope

- **No endgame behavior change.** The Mastermind still wins the instant its
  4th Tactic is defeated. The 5th-fight gate, the Mastermind-card→Victory-Pile
  award, and the UIState/MastermindTile surface are **WP-687** (D-24504).
- **No composition change.** `MatchSetupConfig` stays exactly 9 fields;
  `finalBlow` is envelope/payload-level, never composition-level.
- **No `schemaVersion` bump** — additive and backward compatible.
- **No server code change.** `apps/server` forwards `setupData` verbatim.
- **No engine-side validator change.** `matchSetup.validate.ts` already ignores
  extra envelope fields; `finalBlow` shape-checking lives registry-side (the
  zod schema). Do not add a `finalBlow` branch to `validateMatchSetup`.
- **No loadout-builder toggle / UI.** Authoring the flag from a UI surface is
  WP-687's concern; this WP only makes the flag valid and stored.
- Refactors or cleanups outside Scope (In).

---

## Files Expected to Change

- `packages/registry/src/setupContract/setupContract.types.ts` — **modified** —
  add `finalBlow?: boolean` to `SetupEnvelope`
- `packages/registry/src/setupContract/setupContract.schema.ts` — **modified** —
  add `finalBlow: z.boolean().optional()`
- `packages/registry/src/setupContract/setupContract.test.ts` — **modified** —
  valid/absent/invalid `finalBlow` cases
- `packages/game-engine/src/types.ts` — **modified** — widen
  `MatchConfiguration`; add optional `finalBlow?: boolean` to `LegendaryGameState`
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  widen `config` param to `MatchConfiguration`; seed `finalBlow: true` only
  when `config.finalBlow === true` (omit otherwise)
- `packages/game-engine/src/game.test.ts` — **modified** — round-trip + inert +
  byte-identical-off assertions
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` — **modified** — envelope field +
  extensibility bullet
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` — **modified** — add
  `finalBlow` property (not required)
- `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` — **modified** — Stage 1
  bullet + test-coverage entries
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — §8.1 envelope
  extensibility entry
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `POST /api/match/create`
  row (whole-row replace)
- `docs/ai/DECISIONS.md` — **modified** — land D-24503
- `docs/ai/STATUS.md` — **modified** — infrastructure-only entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-686 row check-off
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-723 → Done
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-686 node glyph + counts

No other files may be modified. In particular: `game.ts` and
`matchSetup.validate.ts` need **no** change (setup delegates to
`buildInitialGameState`; the validator ignores the extra field), and no
sentinel/golden-hash fixture moves (the field is omitted when off).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only (no RNG
  in scope).
- Never throw inside boardgame.io move functions — no moves in scope; only
  `Game.setup()` may throw (unchanged).
- Never persist `G`, `ctx`, or any runtime state. `G.finalBlow` is runtime-only,
  JSON-serializable (a boolean).
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions.
- ESM only, Node v22+; `node:` prefix on Node built-in imports.
- Test files use `.test.ts` — never `.test.mjs`.
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **`finalBlow` is envelope/payload-level, never composition-level.** The
  9-field `MatchSetupConfig` composition lock is preserved byte-for-byte;
  widening the `MatchConfiguration` alias and the `buildInitialGameState`
  param does not touch it (the composition drift test stays green because
  `finalBlow?` is optional).
- **`G.finalBlow` is optional and omitted when off.** Seed it only when
  `config.finalBlow === true`. An always-present field would move both whole-`G`
  hash oracles for every match; omit-when-false keeps a non–Final-Blow match
  byte-identical to today (no re-pin). This is the WP-687 `finalBlowPending?`
  discipline applied here.
- **The engine reads it, but does nothing with it yet.** No endgame, fight, or
  tactics branch reads `finalBlow` in this WP — a branch here is a scope FAIL.
- **The registry package must not import the engine.** The registry-side and
  engine-side `finalBlow` are independent declarations; `finalBlow` is an
  envelope field, not part of the composition drift mirror.
- **No new dependency.** `zod` (already a registry dep) only.
- Full-sentence error messages per `00.6` Rule 11 where validation prose is added.

**Session protocol:**
- If widening `MatchConfiguration` or the `buildInitialGameState` param appears
  to touch the 9-field composition lock, STOP — the lock is on `MatchSetupConfig`.
- If a `finalBlow: false` sentinel hash moves, STOP — the field is not being
  omitted when off.
- If any consumer reads `finalBlow` before WP-687 lands, STOP — it must be inert.

**Locked contract values (paste verbatim — do not paraphrase):**
- **Envelope field name:** `finalBlow`
- **Type:** boolean
- **Required:** false (optional)
- **Default when absent:** `false`
- **Engine G field:** `LegendaryGameState.finalBlow?: boolean` — **optional**,
  seeded in `buildInitialGameState` **only when** `config.finalBlow === true`,
  omitted otherwise
- **Engine payload type:** `MatchConfiguration = MatchSetupConfig & { readonly finalBlow?: boolean }`
- **Storage site:** `buildInitialGameState` (NOT `game.ts setup()`, which only
  delegates); its `config` param widens to `MatchConfiguration`
- **`schemaVersion`:** unchanged at `"1.0"`
- **DECISIONS entry:** D-24503

---

## Vision Alignment

**Vision clauses touched:** §1/§2 (card/content semantics — a rulebook-faithful
optional rule), §22 (replay faithfulness), NG-1 (no pay-to-win).

**Conflict assertion:** No conflict — this WP preserves all touched clauses.

- §1/§2 — Final Blow is a printed optional rule from the Universal Rules; the
  flag records the group's pre-game choice faithfully. This WP adds only the
  flag, not the behavior.
- §22 — The field is authored at setup and never mutates during a match.
  Because `G.finalBlow` is **omitted when off**, a non–Final-Blow match's `G`
  serializes byte-identically to today: `computeStateHash` (PRE_WP080) and
  `hashGameState` (finalStateHash) are unchanged and no sentinel/golden fixture
  moves. A `finalBlow: true` match carries one extra boolean but changes no
  shuffle, card pool, or move outcome in this WP (the engine reads it and
  branches on nothing). WP-687 is where replay behavior diverges by design.
- NG-1 — a difficulty variant chosen by the group, never a paid advantage.

**Non-Goal proximity check:** None of NG-1..7 are crossed.

**Determinism preservation:** `G.finalBlow` is set deterministically in
`buildInitialGameState` from the payload, only when true. No `ctx.random.*`, no
wall-clock, no I/O. With the field omitted when off, `finalStateHash` and every
state-hash oracle are unchanged and **no re-pin is required** — the inert claim
is genuine, verified by the byte-identical-off engine assertion (Scope C).

## Funding Surface Gate

N/A — this WP adds a match-setup rule flag and its plumbing; it touches no
global-nav, registry-viewer, or profile funding affordance, references no
donation/tournament-funding copy, and integrates no funding channel.

---

## Acceptance Criteria

- [ ] `SetupEnvelope` declares `finalBlow?: boolean`; the zod schema accepts
      `true`/`false`/absent and rejects a non-boolean with a `wrong_type`
      diagnostic (asserted by `setupContract.test.ts`).
- [ ] `MatchConfiguration` is `MatchSetupConfig & { readonly finalBlow?: boolean }`
      and `MatchSetupConfig` still lists exactly the 9 composition fields
      (composition drift test stays green).
- [ ] `LegendaryGameState` declares `readonly finalBlow?: boolean` (optional).
- [ ] `buildInitialGameState` widens its `config` param to `MatchConfiguration`
      and seeds `finalBlow: true` only when `config.finalBlow === true`.
- [ ] A match created with `finalBlow: true` yields `G.finalBlow === true`; a
      match with `finalBlow` false/absent yields `G.finalBlow === undefined`
      (field omitted) — both asserted by `game.test.ts`.
- [ ] A `finalBlow: false` match's `G` serializes byte-identically to the
      no-flag baseline: no sentinel/golden `finalStateHash` moves and
      `pnpm --filter @legendary-arena/game-engine test` passes with no re-pin.
- [ ] No endgame / tactics / fight behavior changes (inert contract).
- [ ] `MATCH-SETUP-JSON-SCHEMA.json` defines `finalBlow` under root
      `properties` with `"type": "boolean"`, is not in `required`, and parses.
- [ ] `MATCH-SETUP-SCHEMA.md`, `MATCH-SETUP-VALIDATION.md`, `00.2 §8.1`, and the
      `POST /api/match/create` api-catalog row document the field; the 9-field
      composition table is unchanged.
- [ ] `DECISIONS.md` has D-24503; `pnpm -r build` and `pnpm -r test` exit 0;
      `git diff --name-only` shows only files in `## Files Expected to Change`.

---

## Verification Steps

```pwsh
# 1 — JSON Schema parses
node -e "JSON.parse(require('node:fs').readFileSync('docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json','utf8'))"
# Expected: exits 0, no output

# 2 — registry contract validates the new field
pnpm --filter @legendary-arena/registry build
pnpm --filter @legendary-arena/registry test
# Expected: exits 0; the finalBlow valid/absent/invalid cases pass

# 3 — engine builds, types compile, round-trip + inert + byte-identical-off pass
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
# Expected: exits 0; game.test.ts finalBlow round-trip + inert; NO hash re-pin
# (sentinel finalStateHash unchanged — the field is omitted when off)

# 4 — composition lock intact (9 field names still present, unchanged)
Select-String -Path "packages\game-engine\src\matchSetup.types.ts" -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"
# Expected: the 9 composition field names, unchanged

# 5 — no endgame/tactics branch on finalBlow landed in this WP
Select-String -Path "packages\game-engine\src\endgame\*.ts","packages\game-engine\src\mastermind\*.ts","packages\game-engine\src\moves\fightMastermind.ts" -Pattern "finalBlow"
# Expected: no output (the flag is inert; WP-687 wires it)

# 6 — whole-repo scope confirmation
git diff --name-only
# Expected: only files listed in ## Files Expected to Change (game.ts and
# matchSetup.validate.ts must NOT appear; no fixture hash file appears)
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0; `pnpm -r test` (or registry + engine filters)
      exits 0, with no state-hash re-pin
- [ ] `node -e "JSON.parse(...)"` against the JSON Schema exits 0
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only`); `game.ts` / `matchSetup.validate.ts` / any hash
      fixture are NOT in the diff
- [ ] `docs/ai/STATUS.md` updated — "No user-observable change — infrastructure
      only" (per §15.1; the payoff is that WP-687 can read `G.finalBlow`)
- [ ] `docs/ai/DECISIONS.md` has D-24503
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-686 row checked off with the date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-723 flipped Pending → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-686 node `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

---

## Lint Gate Self-Review (00.3)

Run against `00.3-prompt-lint-checklist.md`. All 21 sections resolved:

- **§1 Structure** — PASS. All required sections present and non-empty; Out of
  Scope lists 6 exclusions.
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session protocol +
  locked values; full-file-contents required, diffs forbidden, ESM/Node v22/00.6
  cited.
- **§3 Assumes** — PASS. Every dependency file with the confirmed line anchors
  (`game.ts:374`, `buildInitialGameState.ts:248/580`, `matchGate.routes.ts:320`)
  + the heroSelectionMode precedent.
- **§4 Context** — PASS. 00.2 §8.1, ARCHITECTURE §Layer Boundary, DECISIONS, the
  two hash oracles, the setup-contract and constructor source files, the
  rulebook — all cited specifically.
- **§5 Files** — PASS. Every file marked modified with a one-line description;
  the code sites are the registry contract, `types.ts`, and
  `buildInitialGameState.ts` (the real constructor — `game.ts` and the validator
  are explicitly NOT changed). No file referenced-by-necessity is off-list.
- **§6 Naming** — PASS. `finalBlow` camelCase; the 9 composition field names
  verbatim; `MatchSetupConfig` / `MatchConfiguration` per source.
- **§7 Dependency** — PASS. No new dependency; forbidden packages excluded.
- **§8 Boundaries** — PASS. Registry does not import engine; engine reads
  registry at setup only; `G` JSON-serializable; no DB in setup.
- **§9 Windows** — PASS. `pwsh` + `Select-String`.
- **§10 Env vars** — N/A. None added or read.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. `node:test`; no boardgame.io import in helpers; no
  network/DB; round-trip + inert + byte-identical-off assertions.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output,
  including the no-re-pin expectation on step 3.
- **§14 Acceptance** — PASS. 10 binary, observable, file/field-specific items,
  including the byte-identical-off hash check.
- **§15 Definition of Done** — PASS. STATUS / DECISIONS / WORK_INDEX + scope +
  roadmap; `**User-Visible Surface:**` declared; §15.1 infrastructure-only path.
- **§16 Code Style** — PASS. No premature abstraction; explicit control flow;
  `// why:` required at the `buildInitialGameState` conditional-seed site and
  the state-field declaration.
- **§17 Vision Alignment** — PASS. Clause numbers (§1/§2, §22, NG-1),
  no-conflict assertion, NG proximity, and a determinism line that now
  correctly states the oracles are unchanged because the field is omitted when
  off (no re-pin).
- **§18 Prose-vs-Grep** — PASS. Verification step 5 greps `finalBlow` in
  specific engine files (endgame/mastermind/fightMastermind), not this WP file,
  so no false-positive; no forbidden-token enumeration in code prose.
- **§19 Bridge-vs-HEAD** — N/A (no repo-state-snapshot artifact authored here).
- **§20 Funding Surface** — N/A with justification (Funding Surface Gate above).
- **§21 API Catalog** — TRIGGERED and satisfied: `POST /api/match/create`'s
  request `setupData` shape gains the optional `finalBlow`, so `api-endpoints.md`
  is updated wholesale in the same commit.
