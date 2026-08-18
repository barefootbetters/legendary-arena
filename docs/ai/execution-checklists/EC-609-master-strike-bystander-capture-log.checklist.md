# EC-609 — Master Strike Bystander Capture Log

**WP:** [WP-574](../work-packets/WP-574-master-strike-bystander-capture-log.md)
**Layer:** Game Engine
**Lane:** Standard two-session
**Reserves:** D-24383

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] Clean tree on `origin/main`; `pnpm install`; `pnpm -r build` exits 0;
      `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Record baselines: engine test count and **both** sentinel hash values.
- [ ] Read the helper (`captureBystanderOntoMastermind` in
      `rules/mastermindHandlers.ts`) — lines ~160-180. The success branch has no
      `pushLog`; the `else` branch does. That is the entire defect.
- [ ] Target file set is EXACTLY: `rules/mastermindHandlers.ts` (+ test). Anything
      else is a FAIL.

## Locked Values

- The captured card is a generic `pile-bystander` supply token. The log line names
  the **mastermind**, not the bystander (there is nothing to name — all bystanders
  in the supply are identical tokens).
- Outcome is `applied` per the WP-434 taxonomy.
- The `[Master Strike]` prefix matches the existing strike-logging convention.
- The empty-supply `blocked` line wording is **byte-unchanged**.

## Guardrails

1. **D-15401 is Immutable and UNAMENDED.** Do NOT change when or whether a
   bystander is captured. This is observability only.
2. **The empty-supply line stays byte-unchanged.** A test asserts it survives.
3. **Both hash oracles must stay byte-unchanged.** Sentinel uses `hashGameState`
   (messages excluded, D-24081); `PRE_WP080_HASH` uses `computeStateHash` (messages
   INCLUDED) but replays an empty move list, so no strike fires. A moved oracle is
   a **STOP**, never a re-pin.
4. **Do NOT add `LogEntry.card`.** The helper runs inside a generic strike path —
   there is no card context to thread.
5. **Two branches, two wordings.** The success and empty-supply branches must
   produce distinguishable messages. A test must assert both wordings independently.

## Required Comments

- `// why:` on the new `pushLog` explaining it is additive (D-15401 said nothing
  about the success case).

## Acceptance Criteria (from WP)

- AC-1: success-path log line with `applied`, naming the mastermind.
- AC-2: empty-supply `blocked` line byte-unchanged; both wordings tested.
- AC-3: no mechanic change — D-15401 Immutable.
- AC-4: both hash oracles byte-unchanged.
- AC-5: `pnpm -r build` 0; engine suite green; `pnpm -r --no-bail test` 0 new
  failures.
- AC-6: D-24026 live verify.

## Execution Amendment (2026-08-18)

- **Target file set expanded by one forced, additive fixture re-record.** The WP
  determinism analysis reasoned only about the two HASH oracles (both
  message-excluding) and did not anticipate the complete-game regression suite's
  `messages` oracle. The committed sentinel fixture
  `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`
  fires two core Dr. Doom Master Strikes and records their log lines, so the new
  `applied` capture line diverged its pinned `messages` / `snapshotPerTurn[].messages`
  blocks. Re-recorded via `scripts/record-game-fixture.mjs` (never hand-edited):
  **+2 `applied` capture lines, `finalStateHash` byte-unchanged (`813287eb…`)** — an
  additive re-record proving no hashed-state drift. This is the "EC missed a file"
  mid-execution amendment (01.0b §deviations), documented under D-24383 §5. It does
  NOT relax any guardrail: both hash oracles remain byte-unchanged; the empty-supply
  line is byte-unchanged; `LogEntry.card` was not added; D-15401 stays unamended.

## Completion

- [x] Two-commit topology: `EC-609:` implementation, `SPEC:` governance close.
- [x] D-24383 landed **Active** in `DECISIONS.md`.
- [x] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `✅`; counts 0.
