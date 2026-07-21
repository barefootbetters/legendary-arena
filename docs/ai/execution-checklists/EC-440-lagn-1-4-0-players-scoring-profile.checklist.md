# EC-440 — LAGN 1.4.0 Match Participants + Scoring Profile (Execution Checklist)

**Source:** docs/ai/work-packets/WP-405-lagn-1-4-0-players-scoring-profile.md
**Layer:** Cross-cutting (contract package `packages/lagn-spec`)

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything else
      = STOP, with ONE sanctioned exception: files surfaced by a re-run of the
      §Empirical Scaffold are folded into the WP's Scope (In) + Files list FIRST,
      then edited. Undocumented additions remain a STOP.
- [ ] **Re-verify WP-405 / EC-440 / D-24214 / D-24215 are still free** against
      `origin/main` — include open PR branches (`gh pr list`), not just `main`.
      D-24213 is the last reserved (WP-404); the next free D-number starts at D-24214.
- [ ] LAGN 1.3.0 on `main` — `LAGN_VERSION_1_3_0`, `isLagnVersionAtLeast`,
      `setup.hero_alternates`, six fixtures (WP-402). Verify, don't assume.
- [ ] **Reconcile with WP-404** — if WP-404 landed, `LAGN_VERSION` is now 1.3.0 and
      the enum is `[…,'1.3.0']`; if not, it is 1.1.0. WP-405 does NOT flip the
      writer either way — it only adds 1.4.0 to the READ set. Rebase the enum
      assertion against whatever `main` shows.
- [ ] Derived-schema gate on `main` — `UNEXPRESSIBLE_CONSTRAINTS` + the `ZodEffects`
      count gate (WP-392 / D-24196). Verify.
- [ ] `pnpm --filter @legendary-arena/lagn test` exits 0 — record the count
      (expected **65**; if it differs, the baseline moved — re-read the WP).
- [ ] `pnpm -r build` exits 0.
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` before the first edit.
- [ ] **Scaffold already RUN at draft** (WP §Empirical Scaffold: 65 → 64/1, zero
      fixture breakage). Re-run only if `main` moved under the package since draft.

## Locked Values (do not re-derive)
- **`LAGN_VERSION` STAYS at its `main` value.** WP-405 is reader-only; the writer
  flip to 1.4.0 is a future server-producer packet. Do NOT bump it or `package.json`.
- Version string, verbatim: `1.4.0`; constant name `LAGN_VERSION_1_4_0`
- Block names, verbatim: `players` and `scoring_profile`, at the **document root**
  (NOT under `setup`)
- `players[]` entry, verbatim: `{ seat: number(int, 0..4), player_id: string, display_name?: string }`
- `players` is `.min(1).optional()`; `scoring_profile` is `z.string().optional()`
  — **NO enum on `scoring_profile`** (the profile set is the leaderboard's, not
  this package's; an invented enum is fabrication)
- Version-gate message, verbatim (00.6 Rule 11):
  `players and scoring_profile require lagn_version 1.4.0 or later — an earlier document cannot carry match participants or a scoring profile`
- Over-count message, verbatim:
  `players lists <n> participants but player_count is <p> — a match cannot credit more players than seats`
- Seat-range message, verbatim:
  `seat <s> is out of range — seats run 0 to player_count-1 (<p-1>)`
- Duplicate-seat message, verbatim:
  `seat <s> is listed more than once — one participant per seat`
- Duplicate-player message, verbatim:
  `player_id <id> is listed more than once — a player cannot occupy two seats`
- Fixture filename, verbatim: `examples/tier1-players.lagn.json`
- Root `$schema` stays `https://json-schema.org/draft/2020-12/schema`

## Guardrails
- **Additive only.** Every 1.0.0–1.3.0 document valid today MUST still validate.
- **Non-authoritative, forbidden as an input.** `players[]` / `scoring_profile`
  must NOT be wired into scoring, credit, ranking, `team_key`, `competitive_scores`,
  or the submission flow. They are descriptive (D-24214/D-24215); reading them as
  authority reopens the D-5301 trust hole. This packet touches only `packages/lagn-spec`.
- **`player_id` shape only.** This packet validates it is a string. It does NOT
  decide whether the value is a public handle or an account id — that is the
  producer packet's call, bound by the §Context privacy rule (public id, never
  `AccountId`). Do not add a format regex inventing an id grammar.
- **Count ≤ player_count, not ==.** Bot seats carry no participant entry, so a
  `players[]` shorter than `player_count` is valid; only *more* than `player_count`
  is rejected.
- Each new `.refine()` / `.superRefine()` MUST get its `UNEXPRESSIBLE_CONSTRAINTS`
  entry **in the same edit**, or the `ZodEffects` count gate fails the build.
  1:1 with refinement **nodes**: the `players[]` superRefine raises four issues
  but is one node → one entry.
- Do NOT hand-edit `schemas/lagn-v1.json`; regenerate it.
- `lagn_version` stays **required**. No `z.any()`. No new package dependency.
- All existing blocks survive 1.3.0 → 1.4.0 migration untouched.

## Required `// why:` Comments
- `LAGN_VERSION_1_4_0`: why 1.4.0 — 1.3.0 is allocated to hero_alternates (D-24210)
- `players` / `scoring_profile`: why descriptive and never a scoring/credit input —
  the server re-executes the blob (D-5301 / D-24126); cite D-24214 / D-24215
- `players`: why `player_id` must be a PUBLIC id and never `AccountId` — LAGN is
  shareable (privacy boundary)
- The version gate: why rejection beats silent stripping — `lagnSchema` is not
  `.strict()`, so an ungated block vanishes on parse
- The count/seat refinement: why JSON Schema cannot express it (mirrors its allowlist entry)
- The `players[]` count check: why `≤` and not `==` (bot seats)

## Files to Produce
- `packages/lagn-spec/src/validator.ts` — **modified** — constant, 2 blocks, 2 refinements, 2 allowlist entries
- `packages/lagn-spec/src/migrate.ts` — **modified** — 1.3.0 → 1.4.0 step, unreachable
- `packages/lagn-spec/src/types.ts` — **modified** — `LagnPlayer`
- `packages/lagn-spec/src/index.ts` — **modified** — re-exports
- `packages/lagn-spec/src/validator.test.ts` — **modified** — new cases + enum re-pin
- `packages/lagn-spec/examples/tier1-players.lagn.json` — **new**
- `packages/lagn-spec/schemas/lagn-v1.json` — **modified** — regenerated
- `wiki/lagn-v1.md` — **modified** — 1.4.0 read row + `players` / `scoring_profile`
- `docs/ai/DECISIONS.md` — **modified** — D-24214 + D-24215 Active
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified**
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — row replaced WHOLE (D-11804)
- `docs/ai/STATUS.md` — **modified** — infrastructure-only line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — row → `[x]`
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — Status → `Complete`
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — `📝` → `✅`

## After Completing
- [ ] AC-1..AC-11 each demonstrated with observed output
- [ ] All **seven** fixtures validated against the generated JSON Schema via `ajv` AND zod
- [ ] Refinement-count gate **mutation-tested** (inject undocumented `.refine()` → red → revert → green)
- [ ] `generate:schema` then `git diff --exit-code -- schemas/` clean
- [ ] `packages/lagn-spec/package.json` UNCHANGED (AC-10)
- [ ] D-24214 + D-24215 landed **Active** with the non-authoritative boundary explicit; `00.2` updated
- [ ] `docs/ai/STATUS.md` states: *No user-observable change — infrastructure only.*
- [ ] `git diff --name-only` matches Files to Produce exactly
- [ ] `api-endpoints.md` row replaced WHOLE (D-11804); no partial-column edit
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- An existing fixture stops validating → a field was tightened, not added
- Refinement-count gate red → a `.refine()` landed without an allowlist entry
- `players[]` on a 1.3.0 document accepts → the version gate refinement is missing
  (and the block is being silently stripped — the worst failure)
- `scoring_profile` grew an enum → the profile set is the leaderboard's; revert
- `players[]` count check rejects a short list → it must be `≤`, not `==` (bot seats)
- Anything reads `players[]` / `scoring_profile` as a scoring or credit input →
  D-24214/D-24215 violation; this packet is `packages/lagn-spec` only
- `player_id` gained an id-format regex → shape-only; the id grammar is the producer's
