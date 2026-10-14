# EC-845 — LAGN 1.7.0: A Re-Executable Replay Block (Contract) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-808-lagn-tier3-execution-block.md
**Layer:** Shared Tooling — contract package (`packages/lagn-spec`) + docs

## Before Starting

- [ ] On a fresh worktree off `origin/main`; baseline `44724482` or later recorded; the WP-808 Assumes lines all hold.
- [ ] Read the 1.6.0 add as the template:
  - `validator.ts`: the `final_blow` gate (~L855–867), the `UNEXPRESSIBLE_CONSTRAINTS` tail, `EXPECTED_REFINEMENT_COUNT`;
  - `migrate.ts`: `migrate_1_5_0_to_1_6_0` + registry;
  - `validator.test.ts`: the enum re-pin ~L927–935, the `fixtures` array, the refinement-count gate.
- [ ] `pnpm -r build` exit 0; `pnpm --filter @legendary-arena/lagn test` = 108 / 0 (record).

## Locked Values (do not re-derive)

- `LAGN_VERSION_1_7_0 = '1.7.0'`, newest-last in `LAGN_SUPPORTED_VERSIONS`, re-exported from `index.ts`.
  `LAGN_VERSION` STAYS `LAGN_VERSION_1_6_0`; `package.json` untouched.
- `ReplaySchema` = `{ turns?: …unchanged, execution?: ReplayExecutionSchema }`.
- `ReplayExecutionSchema`:
  - `engine: z.literal('legendary-arena')`
  - `engine_version: z.string().regex(/^\d+\.\d+\.\d+$/)`
  - `engine_build: z.string().min(1).optional()`
  - `data_version: z.number().int().min(1)`
  - `seed: z.string().min(1)`
  - `moves: z.array(ReplayExecutionMoveSchema).min(1)`
  - `final_state_hash: z.string().regex(/^[0-9a-f]{1,8}$/)`
- `ReplayExecutionMoveSchema`:
  - `seq: z.number().int().min(0)`
  - `seat: z.number().int().min(0).max(4)` (never `player_id` — that name is LAGN's public handle, 00.2 §7d)
  - `move_name: z.string().min(1)`
  - `args: z.array(z.unknown())`
  - `turn: z.number().int().min(1).optional()`
  - `phase: z.string().nullable().optional()`
- **Gate A** (root `.refine`, ordinal, chained immediately after the `final_blow` refine):
  `isLagnVersionAtLeast(data.lagn_version, LAGN_VERSION_1_7_0) || data.replay?.execution === undefined`.
  Path `['replay','execution']`. Message:
  `replay.execution requires lagn_version 1.7.0 or later — an earlier document cannot carry a re-executable replay`.
- **Gate B** (one NEW root `.superRefine`, chained after the existing `players` superRefine — never folded into it),
  path `['replay','execution','moves']`, one issue per failing check per move:
  - `moves[index].seq === index`, else `` `replay.execution.moves[${index}] has seq ${move.seq} but must have seq ${index} — moves are numbered from 0 with no gaps or duplicates` ``.
  - `move.seat <= data.player_count - 1`, else `` `replay.execution.moves[${index}] names seat ${move.seat} but player_count is ${data.player_count} — seats run 0 to ${data.player_count - 1}` ``.
- Exactly **2** new `UNEXPRESSIBLE_CONSTRAINTS` entries, `path` / `constraint` / `reason` verbatim from WP Locked
  Contract Values, in that order (wiki rows 13–14 summarize them in the rows 1–12 one-line style).
  `EXPECTED_REFINEMENT_COUNT` 12 → 14.
- `migrate_1_6_0_to_1_7_0`: pure restamp, registered, unreachable.
- Fixture `examples/tier3-execution.lagn.json`: `lagn_version "1.7.0"`, `solo`, `player_count 1`, valid Tier-1 `setup`;
  moves open `setPlayerReady` `[{ "ready": true }]` → `startMatchIfReady` `[{}]`; a shape-only hash.
- Types `ReplayExecution`, `ReplayExecutionMove` (inferred) re-exported.

## Guardrails

- Additive only: every 1.0.0–1.6.0 document and all 9 existing fixtures still validate.
- `packages/lagn-spec` imports only `zod` / `zod-to-json-schema`: no engine, registry, `boardgame.io`, or app import, and
  no re-executor.
- Non-authoritative: nothing in the repo may score, credit, rank, or verify from `replay.execution` (D-5301 / D-24126).
- No credential, `AccountId`, or `isDebugMatch` field; do not add any field beyond the locked set.
- Each new refinement node lands with its allowlist entry in the same edit.
- Never hand-edit `schemas/lagn-v1.json`; run `generate:schema`.
- `replay.turns` and its seq rule are untouched.

## Required `// why:` Comments

- `LAGN_VERSION_1_7_0`: why 1.7.0 (1.6.0 = `final_blow`, D-24517).
- `ReplayExecutionSchema`: engine-bound by design (D-24714); seed, not initial state (`G` never exported); re-execution
  targets the D-24119 reducer, not the D-0205 harness.
- `final_state_hash`: non-cryptographic 32-bit `computeStateHash`, a divergence check rather than tamper-proofing; why
  1–8 hex characters (not zero-padded).
- `seat` + Gate B seat check: an integer mirroring `players[].seat` so the two join; the re-executor dispatches
  `playerID: String(seat)`; the range is keyed on `player_count`.
- `engine_version`: read via `getCurrentEngineVersion()` / `formatEngineVersion()`; rarely bumped, so a match does not
  imply re-executability — only `final_state_hash` (and `engine_build`) decides.
- Gate A: the silent-strip hazard (no `.strict()`) + ordinal (D-24211).
- Gate B seq: whole-match numbering from 0, unlike `replay.turns` (per-turn, any start).
- `move_name` / `args` / `phase` stay loose strings / `unknown[]`, not enums: lagn-spec cannot import the engine, the
  move set grows, an unknown move is rejected by the reducer and surfaces as hash divergence, and `turn` / `phase` are
  descriptive log stamps never used in re-execution.
- `data_version`: the D-0801 data axis names the `args` wire format (WP-137 bumped it for `#copyIndex`), so a
  re-executor can migrate exported args forward. lagn-spec validates the integer only and never migrates args.
- `migrate_1_6_0_to_1_7_0`: pure restamp; unreachable because `LAGN_VERSION` stays **1.6.0**.

## Files to Produce

- `packages/lagn-spec/src/validator.ts` — **modified** — constant, schemas, Gate A + B, 2 allowlist entries
- `packages/lagn-spec/src/migrate.ts` — **modified** — 1.6.0 → 1.7.0 restamp
- `packages/lagn-spec/src/types.ts` — **modified** — 2 inferred types
- `packages/lagn-spec/src/index.ts` — **modified** — re-exports
- `packages/lagn-spec/src/validator.test.ts` — **modified** — gate cases, enum re-pin, fixture, migration case
- `packages/lagn-spec/examples/tier3-execution.lagn.json` — **new**
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated
- `wiki/lagn-v1.md` — **modified** — WP Scope 9 items (union string ~L58, "all eight", Code Touchpoints test/fixture
  count, constraints preamble count "fourteen", 1.7.0 column, block docs, constraints 13–14, Tier 3 + Interactions
  text)
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — §7f
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `POST /api/me/loadouts` row replaced WHOLE with the WP Scope 11
  (a)/(a2)/(b)/(b2)/(c) sentences verbatim; every other part of the row unchanged

## After Completing

- [ ] lagn test 0 fail (count recorded); `pnpm -r build` 0; registry-viewer / legends-board / server 0 fail;
  `pnpm -r --no-bail test` no new failures
- [ ] `generate:schema` + `git diff --exit-code -- packages/lagn-spec/schemas/` clean; `package.json` unchanged
- [ ] `DECISIONS.md` D-24714 Active (WP §D-24714 Content verbatim); `STATUS.md` "No user-observable change —
  infrastructure only"
- [ ] `WORK_INDEX.md` WP-808 `[x]`; `EC_INDEX.md` EC-845 Done; mindmap `📝 → ✅` + `pnpm roadmap:counts:write`;
  `roadmap:counts:check` exits 0
- [ ] `git diff --name-only` = Files to Produce + governance files

## Common Failure Smells

- Refinement-count test red → a node landed without its allowlist entry, Gate B was split into two nodes, or Gate B was
  folded into the existing `players` superRefine (count 13, not 14).
- `published contract fields survive derivation` red → the enum re-pin literal lacks `LAGN_VERSION_1_7_0` (observed in
  the draft scaffold).
- A `turns` + `execution` document passes with a bad turns `seq` → the existing `replay.turns` root refine (~L730) was
  edited, moved, or removed; it must stay byte-unchanged.
- A 1.7.0 fixture fails ajv but passes zod → a refinement was expressed where JSON Schema can see it differently;
  re-check the regexes.
- `package.json` or `LAGN_VERSION` moved → revert; the writer flip is the producer packet.
- The schema diff is dirty in CI → `generate:schema` not re-run after the last validator edit.
