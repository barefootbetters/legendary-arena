# WP-808 — LAGN 1.7.0: A Re-Executable Replay Block (Contract)

**Status:** Draft 2026-10-13
**Layer:** Shared Tooling — contract package (`packages/lagn-spec`) + docs
**Dependencies:** WP-698 ✅ / D-24517 (LAGN 1.6.0, the current writer), WP-640 ✅ / D-24452 (the reader-only contract precedent this mirrors), WP-402 ✅ / D-24211 (ordinal version gates), WP-334 ✅ + WP-336 ✅ / D-24119 / D-24124 (the server faithful reducer-replay whose inputs this block names)
**User-Visible Surface:** none — infrastructure (a contract addition; nothing emits 1.7.0 until the follow-on producer packet flips the writer)
**Baseline:** `origin/main` @ `44724482` (drafted on `5d933a62`, the WP-808 / EC-845 / D-24714 reserve commit
#2771; rebased before the drafting commit)
**EC:** EC-845 · **Decision:** D-24714 (reserved; landed Active at execution)

## Goal

Add one optional block, `replay.execution`, to LAGN at version **1.7.0**. The block carries everything the D-24119 server
reducer needs to re-execute a completed match and prove it re-executed correctly:

- the match **seed**;
- the ordered **engine moves** (`seq`, seat, move name, positional args, plus the live turn/phase stamps);
- the **engine version** (and the build, when known);
- the expected **final-state hash**.

The block uses the Tier-1 `setup` already in the document for the match composition. Today's Tier 3 (`replay.turns`) is
a narrated log that cannot be re-executed, and nothing writes it. After this packet, a 1.7.0 LAGN *can* describe a match
completely enough to rebuild any position in it. This packet is the **reader contract only**: readers accept 1.7.0, and
the writer stays at 1.6.0. The producer that emits the block is a follow-on packet.

## Assumes

- **WP-698 ✅ / D-24517 Active.** `packages/lagn-spec/src/validator.ts` has `LAGN_VERSION = LAGN_VERSION_1_6_0`,
  `LAGN_SUPPORTED_VERSIONS` ending at `1.6.0`, `isLagnVersionAtLeast`, 12 `UNEXPRESSIBLE_CONSTRAINTS` entries with
  `EXPECTED_REFINEMENT_COUNT = UNEXPRESSIBLE_CONSTRAINTS.length`, and `ReplaySchema = z.object({ turns: … .optional() })`.
- **WP-640 ✅ / D-24452.** The reader-only asymmetry is in place: readers accept a version before any writer emits it,
  and `package.json` is not bumped.
- **D-24211 ordinal gates.** Every version gate uses `isLagnVersionAtLeast`, never `===`.
- **D-24119 / WP-334 / WP-336** (`apps/server/src/replay/matchReplay.logic.ts`):
  - Faithful replay re-dispatches only player `MAKE_MOVE` actions through
    `CreateGameReducer({ game: LegendaryGame, isClient: false })`.
  - It hashes the final `G` with `computeStateHash`.
  - The seed lives at `initialState.plugins.random.data.seed` (D-24119 landmines).
  - A persisted `MAKE_MOVE` payload is `{ type, args, playerID }`. boardgame.io strips `credentials` before logging.
  - `args` is a positional array.
- **`computeStateHash`** (`packages/game-engine/src/replay/replay.hash.ts`) returns an unsigned 32-bit djb2 value as
  lowercase hex: 1–8 characters, not zero-padded, non-cryptographic.
- **The engine version** is read through the exported `getCurrentEngineVersion()` + `formatEngineVersion()`
  (`packages/game-engine/src/versioning/versioning.check.ts`).
  - The backing `CURRENT_ENGINE_VERSION_VALUE` is module-private. It is `1.1.0` at baseline and unchanged since WP-137,
    even though later packets changed play.
  - So it is **not** a re-executability signal. Only `final_state_hash` (and `engine_build`, when present) decides.
- **The data version** is `CURRENT_DATA_VERSION` (`{ version: 2 }` at baseline; exported from the engine package entry;
  `versioning.check.ts`, D-0801 in `versioning.types.ts`).
  - It bumps when the wire format of a persisted artifact changes.
  - WP-137 bumped it to 2 because `ReplayInput.moves[].args` changed shape (`#copyIndex`, with
    `migrateHeroExtIdsForCopyIndex`).
  - So it is the axis that says which `args` shape a move list uses.
- **Tier-1 `setup` maps 1:1 to the engine's setup data** for the 9 `MatchSetupConfig` fields and `finalBlow`:
  - ids map verbatim and in order;
  - the counts map 1:1, with the single rename `officersCount → shield_officers_count`;
  - `final_blow` is written only when true;
  - `numPlayers = player_count`.

  Evidence: `apps/server/src/match/matchLagn.logic.ts`, `apps/arena-client/src/lobby/lagnLoadout.ts`.
- **`isDebugMatch` is never carried in a LAGN document** (D-24689 §1), so a Tier-1 `setup` cannot rebuild an operator
  match's `G`. The producer packet must exclude operator matches (D-24714 producer discipline).
- **The mapping holds only for well-formed setup data.** `G.matchConfiguration` stores the raw setup data verbatim
  (`buildInitialGameState.ts` ~L636) and it is hashed. So an extra caller key, or an explicit `finalBlow: false`, cannot
  be recovered from Tier-1 `setup`. This is a producer proof obligation (below).
- The validate-gated `POST /api/me/loadouts` row in `docs/ai/REFERENCE/api-endpoints.md` exists. It auto-accepts any
  version in `LAGN_SUPPORTED_VERSIONS`.
- `pnpm --filter @legendary-arena/lagn test` is 108 / 0 at baseline; `generate:schema` regenerates
  `schemas/lagn-v1.json`, and the `LAGN Schema Drift Guard` CI job enforces it.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Context (Read First)

- `.claude/CLAUDE.md`; `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) and §Persistence Boundaries;
  `.claude/rules/architecture.md` §Persistence Boundary (the D-24095 framework-store carve-outs).
- `docs/ai/DECISIONS.md`:
  - **D-0205** — the engine `replayGame` is determinism-only and ignores the seed. That is why this block targets the
    server reducer, not the engine harness.
  - **D-24119** — faithful replay architecture and its landmines.
  - **D-24124** — re-dispatch only `MAKE_MOVE`.
  - **D-24095** — the blob carve-outs.
  - **D-24689 §1 / §8** — operator matches are never in LAGN; no build is recorded per match.
  - **D-24452 / D-24517** — the precedent reader contracts.
  - **D-24211** — ordinal gates.
  - **D-5301 / D-24126** — competitive credit is server-side.
  - **D-11804** — whole-row API-catalog updates.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7b–§7e (the LAGN canonical field-name sections this extends).
- `wiki/lagn-v1.md` (the published spec page, corrected in #2766).
- `docs/ai/work-packets/WP-640-lagn-1-5-0-battleplan-report.md` and `EC-675` (the template for every mechanical step).
- `docs/ai/DESIGN-SEED-CHALLENGES.md` §binding (a future shared-seed surface; not touched here).

### Why a new block, and why this shape

**The design is forced, not chosen.** Re-executing a match needs the engine's own move vocabulary, so a re-executable
replay is engine-bound by nature. The block says so with `engine: "legendary-arena"`. A third party can still validate
its shape, but only this engine can run it. That is a scoped exception to the declarative-LAGN principle
(`docs/lagn-architecture-brief.md` §2), and D-24714 records it.

**It carries the seed, not the initial state.**

- The persisted boardgame.io `initialState` holds the full post-setup `G`. Exporting it in a document would be a new
  application read of `G` well beyond the D-24095 carve-outs.
- Instead, the seed plus the Tier-1 setup (which yields the setup data) plus `player_count` rebuild the same initial
  state. The re-executor does this through `InitializeGame` over `{ ...LegendaryGame, seed }`, the pattern already used
  in `matchReplay.logic.test.ts` (`SEEDED_GAME`) and `game.test.ts` (`createSeededLobby`).
- Whether a seed-rebuilt initial state hashes identically to the stored one is the **producer packet's** proof
  obligation. It is an acceptance criterion there, not here.
- The producer must also refuse (or flag) a match whose stored setup data carries anything beyond the 9 composition
  fields + `finalBlow: true`. Tier-1 `setup` cannot reproduce it.
- The producer should emit `catalog_ref` (1.2.0 provenance), so a divergence can be attributed to registry content
  rather than to the engine.

**It carries `final_state_hash`, so divergence is loud, never silent.** A different engine build, registry content, or
lossy setup produces a different hash. The re-executor reports the mismatch and never "corrects" it. The hash is a
32-bit non-cryptographic checksum: an integrity aid, not tamper-proofing. Competitive integrity stays where it is,
`matchId → bgio blob → re-reduce → re-verify hash → AccountId` (D-5301 / D-24126). A LAGN execution block is never a
competitive submission input.

**It does not replace `replay.turns`.** The narrated log stays as it is (no deprecation), and a document may carry
either one or both.

**Reader-only, like 1.2.0 / 1.4.0 / 1.5.0.** The writer stays at 1.6.0, and `package.json` is not bumped. The paired
follow-on producer packet does the following:

- adds `GET /api/match/:matchId/replay-lagn`, which emits only **completed**, non-operator matches;
- adds a new D-24095 carve-out for reading `initialState.plugins.random.data.seed` + `log` for export;
- proves the round trip: re-execute from the LAGN and get the stored `replay_artifacts.replay_hash`;
- flips the writer to 1.7.0.

That packet is named here and not reserved; it is drafted when Jeff schedules it.

**The block exists to support "open this LAGN at turn N"** (the 2026-10-13 state-snapshot research). With a
re-executable replay, any board position is derived on demand (`buildSnapshotSequence`-style). A frozen state-snapshot
tier was rejected:

- raw `G` holds hidden information and is runtime-only;
- `UIState` is audience-scoped and changes often;
- a position the engine cannot load is a save-game.

### Scaffold result (01.4 §Empirical Scaffold — RUN, not reasoned)

This packet **tightens validation**. Today a `replay.execution` key on any document is silently stripped, because the
schema is not `.strict()`. After this packet, the key on a pre-1.7.0 document is rejected.

The validator change was prototyped in the draft worktree on `5d933a62`:

- 1.7.0 constant;
- `replay.execution` schema;
- ordinal version gate;
- root consistency `superRefine`;
- two allowlist entries.

The suites were then run after `pnpm -r build` (exit 0):

| Suite | Baseline | With prototype |
|---|---|---|
| `@legendary-arena/lagn` | 108 / 0 fail | 108 / **1 fail** — `published contract fields survive derivation` (the inline `lagn_version.enum` re-pin; the expected lockstep edit in §Scope 7). The refinement-count gate passed with the two entries. All 9 fixtures passed ajv + zod. |
| `registry-viewer` | — | 329 / 0 fail |
| `@legendary-arena/legends-board` | — | 135 / 0 fail |
| `@legendary-arena/server` | — | 1767 tests / 1560 pass / 0 fail / 207 skipped (DB-gated) |

No downstream fixture carries a `replay.execution` key, so no consumer breakage surfaced. The prototype was reverted
(`git checkout`) before this WP was written.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`:
  - full-word names; booleans start with `is` / `has` / `can`;
  - JSDoc on every function;
  - no nested ternaries, no `import *`, no new barrel;
  - full-sentence messages; `// why:` on every non-obvious rule.
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- No commit subject may contain a `.githooks/commit-msg` Rule 1 token.

**Packet-specific:**
- `packages/lagn-spec` imports only `zod` / `zod-to-json-schema`. It never imports the engine, the registry,
  `boardgame.io`, or any app. This packet adds **no** re-executor and no dependency.
- Additive only: every valid 1.0.0–1.6.0 document still validates unchanged. `lagn_version` stays required, and there
  is no `.strict()`.
- `LAGN_VERSION` stays `LAGN_VERSION_1_6_0`. `packages/lagn-spec/package.json` is untouched.
- The block is **non-authoritative for competition**. Nothing scores, credits, ranks, or verifies a competitive entry
  from it (D-5301 / D-24126).
- No field may carry a credential, an `AccountId`, or `isDebugMatch`. The contract defines no such field.
- Each new refinement node gets its `UNEXPRESSIBLE_CONSTRAINTS` entry **in the same edit**.
- `schemas/lagn-v1.json` is regenerated, never hand-edited.

**Session protocol:** if any Assumes line is false, or a value below cannot be applied verbatim, STOP and ask. Do not
improvise a field.

## Locked Contract Values

- Version `1.7.0`; constant `LAGN_VERSION_1_7_0`, appended newest-last to `LAGN_SUPPORTED_VERSIONS` and re-exported from
  `index.ts`.
- `ReplaySchema` gains `execution: ReplayExecutionSchema.optional()` beside the unchanged `turns`.
- `ReplayExecutionSchema` (all members required unless marked):
  - `engine: z.literal('legendary-arena')`
  - `engine_version: z.string().regex(/^\d+\.\d+\.\d+$/)` — the game-engine `CURRENT_ENGINE_VERSION_VALUE` as
    `major.minor.patch`
  - `engine_build: z.string().min(1).optional()` — the deployed build id, when the producer knows it (D-24689 §8)
  - `data_version: z.number().int().min(1)` — the D-0801 data-axis value naming the wire format of the exported
    `moves[].args`. Copilot finding 1: without it, a later data-axis bump would strand exported documents.
    - A re-executor can migrate args forward, using the engine's own migration.
    - lagn-spec only validates the integer. It cannot import the engine, so it never migrates args.
    - The producer's source for the value is bound by D-24714 (pre-flight re-run RS-1).
  - `seed: z.string().min(1)` — the boardgame.io match seed
  - `moves: z.array(ReplayExecutionMoveSchema).min(1)`
  - `final_state_hash: z.string().regex(/^[0-9a-f]{1,8}$/)` — the `computeStateHash` of the final `G`
- `ReplayExecutionMoveSchema`:
  - `seq: z.number().int().min(0)`
  - `seat: z.number().int().min(0).max(4)` — the acting seat
    - It mirrors `players[].seat`, so the two join.
    - It is never named `player_id`: LAGN already defines that name as a public handle (00.2 §7d).
  - `move_name: z.string().min(1)` — the `MAKE_MOVE` `type`
  - `args: z.array(z.unknown())` — positional, verbatim
  - `turn: z.number().int().min(1).optional()`
  - `phase: z.string().nullable().optional()` — the live log stamps, descriptive
- **Gate A (ordinal `.refine`, chained immediately after the `final_blow` refine).** Condition:
  `isLagnVersionAtLeast(data.lagn_version, LAGN_VERSION_1_7_0) || data.replay?.execution === undefined`. Path
  `['replay', 'execution']`. Message verbatim:
  `replay.execution requires lagn_version 1.7.0 or later — an earlier document cannot carry a re-executable replay`.
- **Gate B (root `.superRefine`, one node).** Two independent checks, both at path
  `['replay', 'execution', 'moves']`. It emits one issue per failing check per move:
  - For every index `i`, `moves[i].seq === i`. The sequence starts at 0 and has no gaps or duplicates. Message:
    `` `replay.execution.moves[${index}] has seq ${move.seq} but must have seq ${index} — moves are numbered from 0 with no gaps or duplicates` ``.
  - `seat <= player_count - 1`. Message:
    `` `replay.execution.moves[${index}] names seat ${move.seat} but player_count is ${data.player_count} — seats run 0 to ${data.player_count - 1}` ``.
- `UNEXPRESSIBLE_CONSTRAINTS` gains exactly **2** entries, appended in this order. `EXPECTED_REFINEMENT_COUNT` goes
  from 12 to 14. Wiki constraint rows 13–14 summarize them in the existing one-line style of rows 1–12; they are not
  copies of `path` / `constraint` / `reason`.
  1. `path: 'lagn_version / replay.execution'`;
     `` constraint: `replay.execution requires lagn_version ${LAGN_VERSION_1_7_0}; an earlier document may not carry it.` ``;
     `reason: 'Cross-field dependency between the root version and a nested optional block. Expressible as a deeply-nested if/then, but only by hand-writing exactly the duplicate structure this derivation exists to eliminate.'`
  2. `path: 'replay.execution.moves / player_count'`;
     `constraint: 'replay.execution.moves are numbered by seq from 0 with no gaps or duplicates, and each move seat is in 0..player_count-1.'`;
     `reason: 'An index-keyed sequence rule and a per-item range keyed on a root sibling field. JSON Schema has no positional arithmetic across array items and no cross-field comparison.'`
- Gate B is a **new** `.superRefine` chained after the existing `players` superRefine. Never fold it into that one:
  folding gives a count of 13.
- Migration `migrate_1_6_0_to_1_7_0`: a pure restamp, registered but unreachable (the writer stays at 1.6.0).
- Fixture `packages/lagn-spec/examples/tier3-execution.lagn.json`:
  - `lagn_version: "1.7.0"`, `variant: "solo"`, `player_count: 1`;
  - a valid Tier-1 `setup`;
  - a `replay.execution` whose `moves` open with `setPlayerReady` (`args: [{ "ready": true }]`) then
    `startMatchIfReady` (`args: [{}]`).

  It is a **shape** example: its `final_state_hash` is syntactically valid but is not claimed to match a real match.
- Types `ReplayExecution` and `ReplayExecutionMove` are inferred and re-exported.

## Scope (In)

1. `LAGN_VERSION_1_7_0` constant (JSDoc explains why 1.7.0: 1.6.0 is allocated to `final_blow`, D-24517). Append it to
   `LAGN_SUPPORTED_VERSIONS`.
2. `ReplayExecutionMoveSchema` + `ReplayExecutionSchema`; `ReplaySchema.execution` optional.
3. Gate A + Gate B on the root schema, with 2 `UNEXPRESSIBLE_CONSTRAINTS` entries.
4. `migrate.ts`: `migrate_1_6_0_to_1_7_0` restamp + registry entry. The `// why:` is written against the true writer
   (1.6.0).
5. `types.ts`: `ReplayExecution`, `ReplayExecutionMove`. `index.ts`: re-export both + `LAGN_VERSION_1_7_0`.
6. `examples/tier3-execution.lagn.json` (new).
7. `validator.test.ts`:
   - accept: a 1.7.0 document with the block; a 1.7.0 document without it; a 1.7.0 document carrying both
     `replay.turns` and `replay.execution` (the existing `replay.turns` seq refine still applies to it — a bad turns
     `seq` in that document is still rejected);
   - reject: the block at 1.6.0 (Gate A); a seq gap, a duplicate, and a non-zero start (Gate B); a `seat` out of range
     for `player_count`; `seat: 5` (fails `max(4)`); `data_version: 0`; `engine` ≠ `legendary-arena`; a non-hex or 9-character hash; a non-semver `engine_version`;
     empty `moves`;
   - extend the inline `lagn_version.enum` re-pin (~L927–935) and the import block with `LAGN_VERSION_1_7_0`;
   - append the fixture to the ajv `fixtures` array;
   - add a migration test: a 1.7.0 document migrates to itself and a 1.6.0 document is untouched (the writer is 1.6.0).
8. Regenerate `schemas/lagn-v1.json`.
9. `wiki/lagn-v1.md`:
   - the Tier-1 `lagn_version` union string (~L58) gains `| 1.7.0`;
   - "Readers accept all seven" becomes "all eight";
   - the Code Touchpoints `validator.test.ts` bullet: the observed test count, and ajv validation of all ten fixtures
     (the current text — "107 tests", "eight of the nine" — is already stale since #2768);
   - 1.7.0 column (Read accepted / Written no / Adds `replay.execution`);
   - the constant list and the Versioning heading;
   - a 1.7.0 prose block covering:
     - the re-execution semantics;
     - engine-bound;
     - seed, not state;
     - the hash as the divergence check (a matching `engine_version` does not imply re-executability);
     - non-authoritative;
     - the producer discipline: completed, non-operator matches only;
   - the Tier 3 snippet and intro;
   - the Interactions → Replay Producer bullet;
   - constraint rows 13–14 (one-line summaries, matching rows 1–12);
   - the constraints preamble (~L419): "names all twelve" becomes "names all fourteen".
10. `00.2-data-requirements.md`: a new **§7f LAGN Replay Execution (WP-808 / D-24714)** with every canonical field
    name above.
11. `api-endpoints.md` — **§21 TRIGGERED (D-11804).** Replace the `POST /api/me/loadouts` row **whole**. A whole-row
    replace must be true, so it also repairs what WP-698 left out:
    - (a) Accepted versions: `1.0.0`, `1.1.0`, `1.2.0`, `1.3.0`, `1.4.0`, `1.5.0`, `1.6.0`, `1.7.0`.
    - (a2) Immediately after the WP-640 sentence's closing parenthetical ("(A saved loadout would never legitimately
      carry a battle plan or a report card … so the acceptance envelope still moves.)"), insert verbatim: **Further narrowed by WP-698 / D-24517:** a pre-`1.6.0` body
      carrying `setup.final_blow` is likewise **rejected** with `400 { "error": "invalid_lagn" }` where it previously
      returned `201`, for the same silent-strip reason; the flag on a `1.6.0` body is accepted and persisted verbatim.
    - (b) Then insert verbatim: **Further narrowed by WP-808 / D-24714:** a pre-`1.7.0` body carrying
      `replay.execution` (the re-executable replay block) is likewise **rejected** with `400 { "error": "invalid_lagn" }`
      where it previously returned `201`, for the same silent-strip reason; the block on a `1.7.0` body is accepted and
      persisted verbatim. (A saved loadout would never legitimately carry a replay, but the endpoint validates the whole
      LAGN, so the acceptance envelope still moves.)
    - (b2) Replace the "All these blocks are descriptive and non-authoritative" sentence with verbatim: The provenance,
      `players` / `scoring_profile`, `battle_plan` / `result.score`, and `replay.execution` blocks are **descriptive and
      non-authoritative** — never a scoring, credit, ranking, or verification input (D-24198 / D-24214 / D-24215 /
      D-24452 / D-24714); `setup.final_blow` is a loadout rule flag, not a descriptive block.
    - (c) Replace the writer-value tail sentence with verbatim: This endpoint persists the client's document
      verbatim and never re-stamps its version; the server's own LAGN write value (`LAGN_VERSION` at
      [`packages/lagn-spec`](../../../packages/lagn-spec)) is `1.6.0` as of WP-698 (the loadout LAGN writer flipped
      1.5.0 → 1.6.0 to carry `setup.final_blow`; readers still accept every version back to `1.0.0`).
    - Every other part of the row (the response, error, and status columns) is preserved unchanged.

## Out of Scope

- **No producer or writer flip.** `GET /api/match/:matchId/replay-lagn`, the D-24095 seed/log export carve-out, the
  round-trip proof against `replay_artifacts`, and the `LAGN_VERSION` / `package.json` bump all belong to the follow-on
  producer packet.
- **No re-executor anywhere.** `packages/lagn-spec` cannot import the engine or boardgame.io. A CLI/server re-executor is
  a later packet.
- **No per-match build recording** (D-24689 §8) and no change to `computeStateHash`.
- **No change to `replay.turns`** or its `seq` rule, and no deprecation.
- **No `UIState` / board-state tier** (rejected by the 2026-10-13 research).
- **No seed-entropy hardening.** The seed is `Date.now()`-derived (`plugin-random` `Random.seed()`) and sits near the
  public `createdAt`. Pre-existing; tracked as a separate task chip from this drafting session.
- **No WP-698 doc back-fill outside the loadouts row.** This packet does not add the missing 1.6.0 `final_blow` section
  to 00.2, and does not fix the `GET /api/match/:matchId/result-lagn` row's "LAGN 1.5.0" claim (it emits 1.6.0). Both
  are pre-existing doc drift, tracked as a separate task chip.
- **No change to whether `/lagn` / `/result-lagn` serve operator matches.** That is a possible D-24689 follow-up.

## Files Expected to Change

- `packages/lagn-spec/src/validator.ts` — **modified** — 1.7.0 constant, `replay.execution` schemas, Gate A + Gate B,
  2 allowlist entries
- `packages/lagn-spec/src/migrate.ts` — **modified** — `migrate_1_6_0_to_1_7_0` restamp (unreachable)
- `packages/lagn-spec/src/types.ts` — **modified** — `ReplayExecution`, `ReplayExecutionMove`
- `packages/lagn-spec/src/index.ts` — **modified** — re-export the two types + `LAGN_VERSION_1_7_0`
- `packages/lagn-spec/src/validator.test.ts` — **modified** — gate cases, enum re-pin, fixture registration, migration
  case
- `packages/lagn-spec/examples/tier3-execution.lagn.json` — **new** — 1.7.0 shape fixture
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated
- `wiki/lagn-v1.md` — **modified** — 1.7.0 column + block docs + constraints 13–14
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — §7f field names
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `POST /api/me/loadouts` row replaced WHOLE

Governance close only beyond these: `DECISIONS.md` (D-24714 Active), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md`. Ten content files exceed the ~8 guideline; this matches the WP-640 precedent, where every
file is a lockstep site of one contract change.

## Contract

**LAGN 1.7.0** is a strict superset of 1.6.0. New and optional: `replay.execution`, the shape locked above. Its semantics
are recorded in D-24714 and the wiki. A re-executor:

1. Rebuilds the initial state from `{ ...LegendaryGame, seed }` with `numPlayers = player_count`. The setup data is
   mapped from Tier-1 `setup`:
   - only the 9 composition ids/counts map (`shield_officers_count → officersCount`), plus `finalBlow: true` when
     `final_blow` is true;
   - display names, `hero_alternates`, and `support_pools` are ignored.
2. Dispatches each move in `seq` order as `MAKE_MOVE { type: move_name, args, playerID: String(seat) }` through the
   non-client reducer.
3. Compares `computeStateHash(final G)` to `final_state_hash`. A mismatch is reported as divergence, never repaired.

A pre-1.7.0 document carrying the block is **rejected** (ordinal gate). The block is engine-bound and non-authoritative
for competition.

## D-24714 Content (create Active at execution)

### D-24714 — LAGN 1.7.0 `replay.execution`: an opt-in, engine-bound re-executable replay (Active — WP-808 / EC-845)

- **Decision.** LAGN's replay tier gains an optional `replay.execution` block (seed, ordered `MAKE_MOVE`s, engine
  version/build, expected final-state hash) at 1.7.0, gated ordinally. Re-execution targets the D-24119 server reducer,
  never the D-0205 determinism-only engine harness.
- **Scoped exception.** The block is engine-bound (`engine: "legendary-arena"`). This is a deliberate, scoped exception
  to the declarative-LAGN principle: re-execution needs the engine's own moves. The rest of LAGN stays declarative.
- **Seed, not initial state.** `G` is never exported in a LAGN. The seed plus Tier-1 setup plus `player_count` rebuild
  the initial state.
- **Divergence is loud.** `final_state_hash` makes divergence (engine build, registry, lossy setup) detectable.
  - It is a non-cryptographic integrity aid, not tamper-proofing.
  - A matching `engine_version` does not imply re-executability, because that value is rarely bumped. Only the hash,
    and `engine_build` when present, decides.
- **No blob-read carve-out.** This decision grants no read of the `bgio` blob. Exporting
  `initialState.plugins.random.data.seed` + `log` requires its own D-24095 carve-out entry (and a
  `.claude/rules/architecture.md` §Persistence Boundary update) in the producer packet.
- **The args wire format is versioned.** `data_version` names the `moves[].args` shape (D-0801's data axis).
  - A later data-axis bump lets a re-executor migrate exported args forward, using the engine's own migration. That
    migration never lives in lagn-spec, which cannot import the engine.
  - The hash still decides re-executability.
- **Seats, not ids.** A move names its acting `seat` (an integer that joins `players[].seat`). LAGN's `player_id` stays
  the public handle.
- **Non-authoritative.** The block is never a scoring, credit, ranking, or verification input (D-5301 / D-24126).
- **Producer discipline (binds the follow-on):**
  - Emit only for completed, non-operator matches. A live match's seed reveals future shuffles. This is defense in
    depth: today's clock-derived seed is already guessable from `createdAt`.
  - Never copy `metadata.players[].credentials`.
  - Refuse or flag setup data that Tier-1 `setup` cannot reproduce.
  - Stamp `data_version` from a per-match record. If none exists, refuse matches older than the last data-axis bump.
    Never stamp the export-time `CURRENT_DATA_VERSION` onto a match that was played under an earlier one.
- **Reader-only at 1.7.0.** The writer stays at 1.6.0.

## Acceptance Criteria

- **AC-1** — A 1.7.0 document with a well-formed `replay.execution` validates; a 1.7.0 document without it validates;
  a 1.7.0 document carrying both `replay.turns` and `replay.execution` validates, and a bad `replay.turns` seq in it is
  still rejected.
- **AC-2** — A 1.6.0 (or earlier) document carrying `replay.execution` is rejected with the Gate A message.
- **AC-3** — Moves with a seq gap, a duplicate seq, or a first seq ≠ 0 are each rejected with the Gate B seq message.
- **AC-4** — A move whose `seat` ≥ `player_count` is rejected with the Gate B seat message. `seat: 5` fails `max(4)`.
- **AC-5** — `engine` other than `legendary-arena`, an `engine_version` not `d.d.d`, a `data_version` below 1, a
  `final_state_hash` that is non-hex or longer than 8 characters, and empty `moves` each fail.
- **AC-6** — Every 1.0.0–1.6.0 example fixture still validates unchanged (additive).
- **AC-7** — `tier3-execution.lagn.json` validates under both ajv (the published schema) and zod.
- **AC-8** — `EXPECTED_REFINEMENT_COUNT` rose by exactly 2. The refinement-count gate fails red on an undocumented
  `.refine()` (mutation-tested).
- **AC-9** — `generate:schema` then `git diff --exit-code -- packages/lagn-spec/schemas/` is clean, and the committed
  `lagn_version.enum` ends at `1.7.0`.
- **AC-10** — `LAGN_VERSION === LAGN_VERSION_1_6_0`, and `packages/lagn-spec/package.json` is unchanged.
- **AC-11** — `ReplayExecution` / `ReplayExecutionMove` and `LAGN_VERSION_1_7_0` are exported from the package entry.
- **AC-12** — `api-endpoints.md` `POST /api/me/loadouts` is replaced whole: versions through 1.7.0, the narrowing
  sentence, and the writer at 1.6.0. `00.2` §7f carries every field name.

## Verification Steps

```pwsh
pnpm -r build                                                   # exit 0
pnpm --filter @legendary-arena/lagn test                        # 0 fail; count recorded (baseline 108)
pnpm --filter @legendary-arena/lagn generate:schema
git diff --exit-code -- packages/lagn-spec/schemas/             # clean
pnpm --filter registry-viewer test                              # 0 fail
pnpm --filter @legendary-arena/legends-board test               # 0 fail
pnpm --filter @legendary-arena/server test                      # 0 fail
pnpm -r --no-bail test                                          # no new failures
git diff --name-only origin/main                                # matches §Files Expected to Change + governance
```

## Definition of Done

- [ ] AC-1..AC-12 each demonstrated with observed output pasted into the session log
- [ ] lagn test 0 fail, count recorded (108 → +N); `pnpm -r build` 0; `pnpm -r --no-bail test` no new failures
- [ ] `generate:schema` clean; `package.json` untouched (AC-10)
- [ ] `DECISIONS.md` — D-24714 created **Active** with the §D-24714 Content above
- [ ] `wiki/lagn-v1.md`, `00.2` §7f, and the `api-endpoints.md` row updated per Scope 9–11
- [ ] `STATUS.md` states "No user-observable change — infrastructure only"
- [ ] WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `📝 → ✅`; `pnpm roadmap:counts:check` exits 0
- [ ] `git diff --name-only` matches §Files Expected to Change exactly (+ the governance files)

## Vision Alignment

`00.3 §17.1` is **TRIGGERED** on two surfaces: replays / replay verification, and RNG sourcing (the block carries a seed).

- **Clauses touched:** §3 (Player Trust & Fairness), §18 (Replayability & Spectation), §19 (AI-Ready Export & Analysis
  Support), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity), NG-1.
- **Conflict assertion:** No conflict: this WP preserves all touched clauses. It directly advances §18 ("replays are
  perfectly faithful", "shareable log") and §19 (machine-readable replay files).
- **Non-Goal proximity:** NG-1..NG-7 are not crossed. Nothing is purchasable, and no outcome changes. The block is
  non-authoritative: competitive credit stays the server blob re-reduce path (§24, D-5301 / D-24126).
- **Determinism preservation:**
  - This packet is a data contract. `packages/lagn-spec` reads no clock, sources no RNG, and runs no game.
  - The block it defines is replay-faithful by construction: re-execution is the D-24119 seeded framework reducer, and
    `final_state_hash` turns any non-faithful re-execution into a reported divergence rather than a silent one.
  - No engine, `G`, persistence, or `finalStateHash` surface changes.
- **Seed exposure (§3):** a seed reveals shuffle order. D-24714 binds producers to completed matches only.
  - That is defense in depth, not the protection boundary. Today's seed is `Date.now()`-derived and guessable from a
    live match's public `createdAt`. That pre-existing weakness is tracked as a separate task chip from this drafting
    session.
  - No seed is shared across matches today (DESIGN-SEED-CHALLENGES is design-only), so exporting a finished match's
    seed exposes no other match.

## Funding Surface Gate

N/A — contract-package and documentation change only: no UI, no user-visible copy, and no funding channel or affordance
is defined, proposed, or implemented (WP-097 §F; §20.1 surfaces absent).

## API Catalog

§21 is **TRIGGERED** (D-11804). The validate-gated `POST /api/me/loadouts` endpoint's acceptance envelope moves (a
pre-1.7.0 body carrying `replay.execution` newly returns `400 invalid_lagn`). Its row is replaced whole (Scope 11). No
endpoint is added, removed, or re-statused.

## Lint Gate Self-Review (00.3)

- §1 PASS — all required sections present; Out of Scope lists 7 adjacent exclusions.
- §2 PASS — engine-wide (full files, ESM/Node 22, 00.6) + packet-specific + session protocol + locked values.
- §3 PASS — WP-698/640/402/334/336 ✅ + file shapes + BLOCKED clause.
- §4 PASS — specific D-entries, 00.2 §7b–§7e, ARCHITECTURE layer/persistence sections.
- §5 PASS — 10-file allowlist, each `new`/`modified` with a one-line description; >8 justified (WP-640 lockstep
  precedent).
- §6 PASS — snake_case LAGN names locked; `seat` / `player_count` / `shield_officers_count` keep their 00.2 meanings.
  The move's actor is `seat`, never `player_id`, which 00.2 §7d defines as a public handle (pre-flight PS-2).
- §7 PASS — no new dependency.
- §8 PASS — Shared Tooling only; no engine/registry/boardgame.io import (§Non-Negotiable).
- §9 PASS — `pwsh` verification block; no shell-specific paths.
- §10 N/A — no environment variables are read or added.
- §11 N/A — no authentication surface changes (the loadouts row keeps its auth class).
- §12 PASS — accept/reject per gate, ajv+zod fixture, mutation-tested refinement count, migration case.
- §13 PASS — exact `pnpm` commands with expected outcomes.
- §14 PASS — 12 binary ACs.
- §15 PASS — DoD includes STATUS/DECISIONS/WORK_INDEX/EC_INDEX/mindmap; §15.1 user-visible = none (infrastructure
  line).
- §16 PASS — full-sentence messages locked; `// why:` sites listed in EC-845.
- §17 TRIGGERED — PASS (see Vision Alignment).
- §18 N/A — no forbidden-token grep in Verification Steps.
- §19 PASS — baseline `44724482` recorded (rebased from the `5d933a62` reserve commit); the commit re-checks HEAD.
- §20 N/A — justified above.
- §21 TRIGGERED — PASS (see API Catalog).

## Gate Verdicts

- **Pre-flight (01.4):** independent subagent run on 2026-10-13, against `5d933a62`. The first verdict was NOT READY,
  with 3 PS items, all scope-neutral text fixes. All are now resolved, so the verdict is **READY TO EXECUTE**: per 01.4
  §Authorized Next Step, no re-run was required, because each fix was applied as the reviewer proposed.

  **Pre-session actions — ALL RESOLVED (2026-10-13):**
  1. **PS-1.** The Assumes claim that operator matches are "never represented in LAGN" was false. It now reads:
     `isDebugMatch` is never carried in LAGN, so the producer must exclude operator matches.
  2. **PS-2.** The move actor was renamed from `player_id` (string) to `seat` (`z.number().int().min(0).max(4)`), joining
     `players[].seat`. This avoids a second meaning for the canonical `player_id` (00.2 §7d). Gate B, AC-4, Contract,
     D-24714, the EC and the index rows were all updated to match.
  3. **PS-3.** The whole-row `POST /api/me/loadouts` replacement now also restores the missing WP-698 `final_blow`
     narrowing. Every new sentence is locked verbatim (Scope 11 (a2)/(b)/(b2)).

  RS-1 through RS-5 were folded in:
  - the exported engine-version accessors, and the rule that a matching version is not a re-executability signal;
  - the well-formed-setup producer obligation, plus the ignored Tier-1 members;
  - the seed rule framed as defense in depth;
  - the Gate B chain position;
  - two more wiki sites.

  RS-6 (the producer emits `catalog_ref`) went into Context. RS-7 is pre-existing drift, moved to Out of Scope and a
  separate task chip.
- **Copilot check (01.7), run 1:** independent subagent, verdict **RISK / HOLD** with 8 findings. All were fixed in
  place:
  1. `data_version` added;
  2. D-24714 grants no blob-read carve-out;
  3. the Scope 11(c) writer tail locked verbatim;
  4. the wiki Code Touchpoints count added to Scope 9;
  5. a `// why:` for the loose move fields;
  6. the Gate B template literals and both allowlist entries locked;
  7. `turns` + `execution` coexistence test/AC;
  8. rebased to `44724482`, the duplicate line removed, and a full pre-flight re-run because finding 1 added a field.
- **Pre-flight (01.4), run 2:** independent subagent, **READY TO EXECUTE**, with no PS items. It found no fresh scaffold
  needed: the only newly rejected input class (Gate A) is unchanged by the field and rename edits.

  **Pre-session actions — ALL RESOLVED (2026-10-13):** RS-1 through RS-8 were applied without changing scope:
  1. RS-1: the `data_version` producer source is bound in D-24714, and the args migration lives in the re-executor,
     never in lagn-spec;
  2. RS-2: this log;
  3. RS-3: one issue per failing check;
  4. RS-4: wiki rows 13–14 use the one-line style;
  5. RS-5: D-24198 is cited in (b2);
  6. RS-6: the (a2) insertion point is exact;
  7. RS-7: the EC_INDEX status is `Draft`;
  8. RS-8: Gate A's position is locked.
- **Copilot check (01.7), run 2:** independent subagent, verdict **RISK / HOLD** with 4 text/staging findings. All
  were fixed in place, with no change to scope, the allowlist, or the contract:
  1. the EC_INDEX `Draft` row is staged;
  2. the session-prompt gate placeholder is filled;
  3. Scope 9 and the EC gain the wiki constraints-preamble count ("twelve" → "fourteen");
  4. the EC failure-smell for a bad `replay.turns` seq now names the real cause (the existing root refine was edited).

  The run-2 pre-flight READY TO EXECUTE stands. The residual RISK is documented here: it was text-only, and nothing is
  open.
