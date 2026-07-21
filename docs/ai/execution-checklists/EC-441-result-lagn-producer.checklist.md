# EC-441 — Result-LAGN Producer + Writer Flip to 1.4.0 (Execution Checklist)

**Source:** docs/ai/work-packets/WP-406-result-lagn-producer.md
**Layer:** Server (`apps/server`) + the single `LAGN_VERSION` constant in `packages/lagn-spec`

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** Anything else
      = STOP, with the one sanctioned exception: files surfaced by a re-run of the
      flip scaffold are folded into Scope (In) + Files FIRST, then edited.
- [ ] **Re-verify WP-406 / EC-441 / D-24216 free** against `origin/main` AND open PR
      branches. D-24215 is the last reserved (WP-405); next free is D-24216.
- [ ] **WP-405 must be landed on `main`** — `LAGN_VERSION_1_4_0`, `players[]`,
      `scoring_profile`, the version gate. If it is not, this WP is **BLOCKED**; stop.
- [ ] Confirm the WP-361 setup emitter is intact — `matchLagn.{routes,logic}.ts`,
      `readMatchConfigurationForLagn`, `buildMatchLagn`. Reuse; do not fork.
- [ ] Confirm `readSeatAccounts` + `legendary.match_seat_accounts` exist and that
      bots/guests have no row (D-24120). Verify.
- [ ] `pnpm -r build` + `pnpm --filter @legendary-arena/server test` + `pnpm --filter @legendary-arena/lagn test` exit 0 — record counts.
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` and `.claude/skills/legendary-server/SKILL.md` before the first edit.

## Locked Values (do not re-derive)
- Endpoint path, verbatim: `GET /api/match/:matchId/result-lagn`
- Completed-match gate: `404 { "error": "match_not_finished" }` until `metadata.gameover`
- `player_id = display_handle` (the claimed public alias); `display_name = players.display_name`
- **A seat without a claimed handle is OMITTED** from `players[]`; if none qualify,
  `players[]` is **omitted entirely** (NOT `[]`)
- **NEVER emit `AccountId`** in `players[]` (D-24214)
- Writer flip: `LAGN_VERSION = LAGN_VERSION_1_4_0`; bump `package.json` version +
  description **in the same commit** (EC-422 lockstep)
- Response shape: `{ lagn }` (single top-level key, mirroring the setup emitter)
- The result LAGN carries setup + `players[]?` + `result` + `scoring_profile` —
  **NO `replay`, NO `card_catalog`**
- `scoring_profile` is a descriptive label from the match's competitive context; it
  is never read back for scoring (D-24215)

## Guardrails
- **Descriptive-only, forbidden as an input.** Do NOT wire `players[]` /
  `scoring_profile` into `competitive_scores`, `team_key`, ranking, or the
  submission flow (D-24214/D-24215; reopening this is a D-5301 violation). The
  submission path stays byte-identical.
- **Reuse, don't fork.** Build on `buildMatchLagn`'s composition mapping and
  `readMatchConfigurationForLagn`'s blob read. No parallel setup mapper.
- **No new blob-read carve-out.** Reads fit D-24119 (re-reduce for outcome) /
  D-24153 (composition) / D-24169 (`metadata.gameover`). The roster is a domain-table
  read (`match_seat_accounts`), not a blob read. If you find yourself reading
  `state`/`log` for anything beyond the D-24119 re-reduce, STOP — that needs a new
  carve-out and is out of scope.
- **`count ≤ player_count` holds by construction** — bots/guests have no roster row,
  so the WP-405 refinement is never tripped. Do not synthesize entries to fill seats.
- Flip the writer with `package.json` in the same commit. `LAGN_VERSION` moves the
  stamped version of the EXISTING setup emitter too — that is expected (§21).
- `validate()` the result LAGN before returning it (the setup emitter's precedent).
- No `packages/game-engine` edit; `finalStateHash` unmoved (AC-8).

## Required `// why:` Comments
- The writer flip: why 1.4.0 now — the producer emits `players[]`, which requires it
- `player_id = display_handle`: why the public alias and never `AccountId` (D-24214 privacy)
- Seat omission: why a seat without a claimed handle is dropped, not synthesized
- The completed-match gate: why 404 until `gameover` — a result LAGN describes a finished match
- The outcome read: why the D-24119 re-reduce (or `metadata.gameover`) and not a new blob field
- `scoring_profile`: why a descriptive label, never read back for scoring (D-24215)

## Files to Produce
- `apps/server/src/match/matchLagn.logic.ts` — **modified** — `buildResultMatchLagn` + projections
- `apps/server/src/match/matchLagn.logic.test.ts` — **modified**
- `apps/server/src/match/matchLagn.routes.ts` — **modified** — `result-lagn` route + gate
- `apps/server/src/match/matchLagn.routes.test.ts` — **modified**
- `packages/lagn-spec/src/validator.ts` — **modified** — `LAGN_VERSION` flip
- `packages/lagn-spec/package.json` — **modified** — version + description lockstep
- `packages/lagn-spec/src/validator.test.ts` — **modified** — the `LAGN_VERSION` assertion
- `docs/ai/DECISIONS.md` — **modified** — D-24216 Active
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — rows replaced WHOLE (D-11804)
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified**
- `docs/ai/STATUS.md` — **modified**
- `wiki/lagn-v1.md` — **modified** — version table (written → 1.4.0)
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] AC-1..AC-9 each demonstrated with observed output
- [ ] Flip scaffold RUN (proxy or real) + blast radius recorded
- [ ] `LAGN_VERSION === '1.4.0'` asserted; `package.json` agrees (AC-6)
- [ ] No `players[]` entry carries an `AccountId`; omitted-seat + no-roster cases tested (AC-2/AC-3)
- [ ] Submission flow byte-identical; `competitive_scores` unaffected (AC-7)
- [ ] `packages/game-engine` unchanged; `finalStateHash` unmoved (AC-8)
- [ ] D-24216 landed **Active**; `00.2` + `api-endpoints.md` rows WHOLE; `wiki` written→1.4.0
- [ ] `git diff --name-only` matches Files to Produce
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- A `players[]` entry carries an account id / a synthesized id → D-24214 violation
- A seat with no handle got a fabricated `player_id` → omit it instead
- `players[]` emitted as `[]` when no seat qualifies → omit the key entirely
- Anything reads the result LAGN back for scoring → D-24218/D-5301 violation
- `LAGN_VERSION` flipped without the `package.json` bump → EC-422 lockstep miss
- A new blob read of `state`/`log` beyond the D-24119 re-reduce → needs a carve-out; STOP
- The setup mapping got duplicated → reuse `buildMatchLagn`, don't fork
