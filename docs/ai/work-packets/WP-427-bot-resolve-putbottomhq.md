# WP-427 — Bot Resolves the Put-Bottom-HQ Pending Choices (getLegalMoves Short-Circuit) (Game Engine + Server)

**Status:** Draft 2026-07-25 · **PROPOSED (WP-427; highest landed WP is 426)** · **Lightweight lane** (D-24028 — 2 files + tests, additive). Pairs with **EC-462** (authored). Reserves **D-24248** (lands at execution).
**Primary Layer:** Game Engine (`packages/game-engine/src/simulation/`) + Server (`apps/server/src/autoplay/`)
**User-Visible Surface:** `play.legendary-arena.com` — a bot ally playing a hero with a put-bottom-HQ ability completes its turn instead of faulting. **D-24026 live-verify APPLIES.**
**Dependencies:** WP-242 ✅ (the KO-hero choice + the getLegalMoves short-circuit pattern), WP-375 ✅ (the bot-ally driver). No hard-dep WP in flight.
**Baseline:** `origin/main` @ `dde79cd9` (capture `git rev-parse origin/main` at execution).

---

## Goal

Fix a **genuine bot-ally fault** (NOT an infra cause). Live diagnostic (match
`660LwoUY-Yq`, 2026-07-25): the WP-415 stall banner "The bot ally could not finish its
turn…" surfaced on a **stable server + healthy DB with no deploy churn** — every infra
cause fixed earlier this session (DB provisioning, deploy-overlap D-24244, DB-blip
D-24247) ruled out.

**Root cause.** The engine has **eight** block-all pending-choice types, each with a
`hasPending*` guard that freezes every other move until resolved. `getLegalMoves`
(`simulation/ai.legalMoves.ts`) short-circuits to the resolve move for only **six** —
it has **no case** for `hasPendingOptionalPutBottomHQ` (Ionic Energy's optional / Absorb
Ambient Power's mandatory single-card put-bottom) or `hasPendingPutAnyNumberBottomHQ`
(Wonder Man / Sunspot / Star-Lord multi-select). When one fires, `getLegalMoves` falls
through to normal-move enumeration; the engine's block-all guard then rejects whatever
the bot dispatches, the driver's fault fallback (`endTurn` → `advanceStage`) is equally
blocked, and the turn **faults**. This is the pending-choice-with-no-resolution-path
hard-freeze class — a human on such a hero would be stuck too. The triggers are
**non-core** heroes, so core-only matches never hit it (the recurring core-hero faults
this session were the infra causes).

---

## User-Visible Impact

A co-op player whose bot ally holds a put-bottom-HQ hero no longer sees the match faulted
mid-turn. The bot resolves the choice (declining the optional form, moving the first HQ
card on the mandatory form, or "put none" on the multi-select) and finishes its turn.

---

## Assumes

- **The engine's block-all guards freeze all moves for all 8 pending types** (verified —
  the `hasPending*` cluster + the resolve-move docstrings).
- **`getLegalMoves` is the single legal-move source for both the autoplay loop AND the
  bot-ally driver** (verified — both import it from `@legendary-arena/game-engine`).
- **`getLegalMoves` is a pure AI/sim helper, not the reducer** — it never mutates `G`
  and is not part of the replay / `finalStateHash` determinism surface (verified).
- **The two put-bottom resolve moves accept a deterministic default** — decline / first
  HQ card (optional) and empty selection (put-any-number). (Verified — the resolve
  moves.)

---

## Context (Read First)

- `packages/game-engine/src/simulation/ai.legalMoves.ts` — the 6 existing pending
  short-circuits + the fall-through enumeration this packet extends.
- `packages/game-engine/src/moves/resolveOptionalPutBottomHQ.ts` — args
  (`{ decline: true }` | `{ cardId }`), `front.mandatory`, the block-all guard.
- `packages/game-engine/src/moves/resolvePutAnyNumberBottomHQ.ts` — args
  (`{ cardIds: CardExtId[] }`, empty valid), the trailing Empowered grant.
- `apps/server/src/autoplay/botLoopProgress.mjs` — `findPendingChoiceMove` +
  `PENDING_CHOICE_MOVE_NAMES` (the drifted 2-name list).
- The live diagnostic: match `660LwoUY-Yq` — WP-415 banner, `status:faulted`, no deploy
  during the match.

---

## Non-Negotiable Constraints

**Always apply:** human-style code (`00.6`); ESM; `// why:` on the non-obvious bits; no
`.reduce()`; `getLegalMoves` stays pure (no `G` mutation, no I/O).

**Packet-specific:**
- **Mirror the existing 6.** Each new short-circuit returns a list of length EXACTLY 1;
  deterministic default; fail-closed (empty list) on an engine-invariant violation.
- **Deterministic defaults:** optional-put-bottom → `{ decline: true }` unless
  `front.mandatory`, then `{ cardId: <first present HQ card, lowest slot index> }`;
  put-any-number-bottom → `{ cardIds: [] }`.
- **No determinism re-pin.** `getLegalMoves` is not the reducer; the full engine suite
  must stay green with no `finalStateHash` change.
- **Sync, don't fork.** `findPendingChoiceMove`'s name list is brought in lockstep with
  the engine's resolve set (all 8); the resolve semantics are unchanged.

---

## Scope (In)

### A) getLegalMoves short-circuits (`packages/game-engine/src/simulation/ai.legalMoves.ts`, modified)
- Import `hasPendingOptionalPutBottomHQ` + `hasPendingPutAnyNumberBottomHQ`.
- Add a `selectFirstHqCard` helper (first non-null HQ slot, deterministic).
- Two short-circuits after the KO-hero check, before normal enumeration.

### B) findPendingChoiceMove sync (`apps/server/src/autoplay/botLoopProgress.mjs`, modified)
- `PENDING_CHOICE_MOVE_NAMES` → all 8 resolve-move names.

### C) Tests
- `ai.legalMoves.test.ts` — mandatory→first-HQ-card; optional→decline; put-any-number→put-none; mandatory-empty-HQ→fail-closed.
- `botLoopProgress.test.ts` — `findPendingChoiceMove` recognizes all 8 resolve names.

---

## Out of Scope

- **The resolve moves themselves** — unchanged (the args + defaults are theirs).
- **The client prompts** for these choices (the human path already projects them).
- **Icon-optimal mandatory selection** (Absorb Ambient Power's reward) — the fix uses
  the first HQ card (always valid, unblocking); an icon-maximizing default is a future
  refinement, not needed to fix the freeze.
- **PAR / sim baselines** — unaffected (PAR unpublished; these are non-core heroes).

---

## Files Expected to Change

- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** (2 imports + helper + 2 short-circuits)
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** (+4 tests)
- `apps/server/src/autoplay/botLoopProgress.mjs` — **modified** (name list → 8)
- `apps/server/src/autoplay/botLoopProgress.test.ts` — **modified** (+1 test)
- `docs/ai/STATUS.md` — **modified**
- Governance: `WORK_INDEX.md` (WP-427) + `DECISIONS.md` (**D-24248**) + `EC_INDEX.md`/EC-462 + `NUMBER-LEDGER.md` + `docs/05-ROADMAP-MINDMAP.md`, at execution.

> No `api-endpoints.md` change (§21 N/A — no HTTP surface).

---

## Contract

| Key | Value |
|---|---|
| optional-put-bottom default | `{ decline: true }` unless `front.mandatory`, then `{ cardId: selectFirstHqCard(hq) }` |
| put-any-number-bottom default | `{ cardIds: [] }` |
| Each short-circuit | returns a list of length EXACTLY 1; fail-closed (empty) on invariant violation |
| `findPendingChoiceMove` | recognizes all 8 resolve-move names |
| Determinism | `getLegalMoves` is a pure AI helper — no reducer / hash / persistence surface |

---

## Acceptance Criteria

1. A pending mandatory optional-put-bottom → `getLegalMoves` returns exactly `[resolveOptionalPutBottomHQ, { cardId: <first HQ card> }]` (asserted) (**AC-1**).
2. A pending optional (non-mandatory) put-bottom → exactly `[resolveOptionalPutBottomHQ, { decline: true }]` (asserted) (**AC-2**).
3. A pending put-any-number-bottom → exactly `[resolvePutAnyNumberBottomHQ, { cardIds: [] }]` (asserted) (**AC-3**).
4. A mandatory put-bottom over an empty HQ → fail-closed (empty list) (asserted) (**AC-4**).
5. `findPendingChoiceMove` recognizes all 8 resolve-move names (asserted) (**AC-5**).
6. Full engine suite green with NO `finalStateHash` re-pin; `pnpm -r build` clean; `pnpm -r --no-bail test` green repo-wide (**AC-6**).
7. A bot ally playing a put-bottom-HQ hero completes its turn (D-24026, operator-pending on deploy) (**AC-7**).

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
pnpm --filter @legendary-arena/server test
pnpm -r --no-bail test
Select-String -Path "packages\game-engine\src\simulation\ai.legalMoves.ts" -Pattern "hasPendingOptionalPutBottomHQ|hasPendingPutAnyNumberBottomHQ|selectFirstHqCard"
git diff --name-only
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] Both put-bottom short-circuits present + deterministic; `findPendingChoiceMove` lists all 8
- [ ] Full engine suite green, NO `finalStateHash` re-pin; no `G`/reducer/persistence change
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide
- [ ] `DECISIONS.md` **D-24248** landed; `WORK_INDEX` (WP-427) + `EC_INDEX`/EC-462 + `NUMBER-LEDGER` + mindmap + `STATUS.md` updated
- [ ] Live-verify (D-24026, operator-pending on deploy): a bot ally on a put-bottom-HQ hero finishes its turn
- [ ] No files outside `## Files Expected to Change` were modified

---

## Vision Alignment

**Vision clauses touched:** §14 (reliability — the bot no longer faults on a valid game
state), §11 (engine owns truth — the AI helper now enumerates the real legal move).
**Conflict assertion:** No conflict — a legal-move-enumeration completeness fix; no
scoring / variant / determinism / persistence change. **Non-Goal check:** NG — no
gameplay-rule change (the resolve semantics are unchanged). **Determinism:** none touched
(pure AI helper; reducer + hash unchanged).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. Highlights — §5 lightweight lane (2 files + tests,
additive); §8 boundaries (engine AI helper + server autoplay helper; no cross-layer
runtime edge); §11/§21 N/A (no HTTP); §15.1 APPLIES (D-24026 bot finishes a
put-bottom-HQ turn); §17 §11/§14 (no conflict); §22 determinism N/A (pure helper, no
hash surface).

## Pre-Flight / Copilot (drafter self-review, lightweight lane)

**Pre-flight: READY.** Deps on `main` (WP-242/375); scope locked.
**Scaffold:** implemented + ran — engine suite 2069/0 (+4), bot-loop 17/0 (+1), `pnpm -r build` 0.

**Copilot: PASS.** Failure modes pinned: (a) mandatory form can't decline → **`front.mandatory` branch moves the first HQ card, AC-1**; (b) an unresolvable move emitted on an empty HQ → **fail-closed, AC-4**; (c) determinism drift → **pure AI helper, engine suite unchanged, no re-pin, AC-6**; (d) the name-list drifts again → **synced to all 8 + a test that pins the full set, AC-5**; (e) the multi-select mis-defaults → **`{ cardIds: [] }` "put none", AC-3**.

## Decision (reserved, lands at execution)

Reserves **D-24248**: `getLegalMoves` adds short-circuits for `hasPendingOptionalPutBottomHQ`
and `hasPendingPutAnyNumberBottomHQ` (mirroring the existing six) so the bot can resolve
those block-all choices instead of faulting; `findPendingChoiceMove` is synced to all
eight resolve-move names. `getLegalMoves` is a pure AI/sim helper — no reducer / hash /
persistence surface. Drafted 2026-07-25; not yet landed.
