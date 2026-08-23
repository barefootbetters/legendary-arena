# WP-590 — Log the Silent KO in `resolveOptionalKoReward`

**Status:** Draft 2026-08-23 — ready to execute. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED** — see Gate Verdicts below.
**User-Visible Surface:** `play.legendary-arena.com` (game log). When you KO a card to take an optional-KO-reward Hero's payoff, the log now names the card you KO'd; today only the reward is logged and the KO is invisible. D-24026 live-verification applies.
**Primary Layer:** Game Engine (`packages/game-engine`) — a single move's logging. No client/server/registry change.
**Dependencies:** WP-248 / D-24019 (the `optional-ko-reward` framework + `resolveOptionalKoReward` move). Landed. Sibling: WP-589 (adds markers so more cards reach this move) — independent; either order. Baseline `origin/main` at draft: post-#1578.

## Goal

`resolveOptionalKoReward` KOs the player's chosen hand/discard card (Step 5) and then dispatches the reward (Step 6). The reward logs itself (e.g. "rescued 1 bystander via a hero ability", "gained +1 recruit from …"), but the KO does not — so the game log shows the payoff with no record of which card was spent to earn it. A player reading the log (or a diagnostics reviewer) cannot tell a card left their hand/discard. Add one log line naming the KO'd card, its source zone, and the ability that demanded it.

## User-Visible Impact

Playing Dangerous Rescue / Energy Drain (and the family) and choosing to KO a card now produces a log line like `Player 0 KO'd S.H.I.E.L.D. Trooper (starting-shield-trooper) from their discard pile for Dangerous Rescue's ability.` before the reward line — closing the "the card silently vanished" gap the operator noticed while reviewing a match log.

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

```bash
# A. Step 5 KOs the chosen card with NO pushLog (the silent KO)
grep -n "G.ko = koCard" packages/game-engine/src/moves/optionalKoReward.resolve.ts
# Expected: 1 hit; the surrounding block has no pushLog call

# B. The move does not yet import the log helpers (the fix adds them)
grep -cE "pushLog|formatCardRef" packages/game-engine/src/moves/optionalKoReward.resolve.ts
# Expected: 0

# C. Message log is EXCLUDED from finalStateHash (hashGameState) but INCLUDED in the replay hash (computeStateHash / PRE_WP080)
grep -n "messages" packages/game-engine/src/replay/replay.hash.ts
# Expected: the comment confirming messages stay hashed by computeStateHash (the re-pin surface)
```

## Context (Read First)

Surfaced while reviewing a real 2p Red Skull / Midtown match log (operator, 2026-08-23) alongside WP-589. `resolveOptionalKoReward.resolve.ts` Step 5 does `G.ko = koCard(G.ko, targetCardId)` and moves on to the reward with no log. The existing KO log vocabulary is right next door: the Master Strike KO logs `Player X KO'd <card>` (neutral), and `heroEffectKo` logs `KO'd <card> via its own ability` (applied). This WP mirrors that phrasing for the optional-KO-reward cost.

**Determinism note (drives the lane).** `hashGameState` (finalStateHash) excludes `messages`, so the game-state hash is unaffected. But `computeStateHash` (the replay hash / `PRE_WP080_HASH`) KEEPS `messages` hashed (the exclusion is diagnostics-only, WP-488) — so a new log line shifts the **replay** hash IFF a pinned reference replay executes a `resolveOptionalKoReward` KO-with-selection. The sole pinned replay (`sentinel-core-doom-2p`) lists Black Widow (Dangerous Rescue = an optional-KO-reward card) in its deck, but its recorded move log contains **no `resolveOptionalKoReward` move** — Black Widow is never drawn+played to park the choice — so the new line will not fire during that replay and a re-pin is **unlikely** (confirm empirically via the scaffold, do not assume). Were a re-pin ever needed, it is a legitimate, documented **log-only** re-pin (the game plays identically; only the observable log grew), NOT a behavior change. The replay-hash surface touch keeps the WP scaffold-first and out of the lightweight lane regardless.

## Scope (In)

**Game Engine:**
- `moves/optionalKoReward.resolve.ts`: import `pushLog` (`../log/logPush.js`) and `formatCardRef` (`../log/logDisplay.js`); in Step 5, after `G.ko = koCard(...)`, emit ONE `pushLog` naming the KO'd card, its source zone (`hand`/`discard pile`), and the source card (`front.sourceCardId`). Outcome `neutral` (a cost the player paid, mirroring the Master Strike KO). No change to the KO/reward mechanics or ordering.

**Tests:**
- `moves/optionalKoReward.resolve.test.ts`: assert the KO path pushes exactly one KO line naming the chosen card + zone + source card, ordered BEFORE the reward's line; assert the decline path pushes NO KO line.

**Conditional (scaffold-decided):**
- If the sentinel/replay hash moves, re-pin the affected constant (documented as a log-only re-pin). If it does not move, no re-pin.

## Out of Scope

- The KO/reward mechanics, ordering, atomicity, seeded-reward set, or the `PendingOptionalKoReward` shape — untouched.
- The reward's own log lines (rescue/draw/attack/recruit) — already logged; not duplicated.
- `finalStateHash` / `hashGameState` — messages are excluded there; no re-pin on that oracle.
- Marker/data work — that is WP-589. This WP is code-only.
- Any other move's silent-cost logging (a separate sweep if wanted).

## Files Expected to Change

- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — **modified** (imports + one Step-5 `pushLog`)
- `packages/game-engine/src/moves/optionalKoReward.resolve.test.ts` — **modified** (KO-line assertion; decline no-line)
- (Conditional) the pinned replay/sentinel hash constant — **re-pinned** only if the scaffold shows it moved
- Governance: `WORK_INDEX.md`, `EC_INDEX.md`, `DECISIONS.md` (D-24399 → Active), `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`

## Contract (Locked by D-24399)

- The KO line is emitted in Step 5 (after the zone shortening + `koCard`), BEFORE the Step-6 reward dispatch, with outcome `neutral`. It names the card via `formatCardRef(G.cardDisplayData, targetCardId)`, the human zone label, and the source card via `formatCardRef(G.cardDisplayData, front.sourceCardId)`.
- The decline path (`{ decline: true }`) emits NO KO line (nothing was KO'd).

### Determinism / persistence

No `G` shape change (a log line is appended to the existing `G.messages`). `finalStateHash` byte-unchanged (messages excluded from `hashGameState`). The **replay** hash may move (messages hashed by `computeStateHash`); if it does, re-pin it as a log-only change with the reason recorded. **Scaffold-first:** run the engine suite + replay/sentinel before finalizing; resolve the re-pin question empirically, never by assertion.

## Acceptance Criteria

- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green, including the new KO-line assertion.
- [ ] The KO path logs one `neutral` line naming the KO'd card + zone + source card, ordered before the reward line.
- [ ] The decline path (`{ decline: true }`) logs no KO line.
- [ ] `finalStateHash` byte-unchanged.
- [ ] `pnpm -r --no-bail test` green — replay/sentinel either byte-unchanged OR deliberately re-pinned with the log-only reason recorded.
- [ ] No mechanics/ordering change — the KO still precedes the reward; atomicity (no KO ⇒ no reward) intact.

## Verification Steps

```bash
pnpm --filter @legendary-arena/game-engine build && test
pnpm -r --no-bail test
# Live (post-deploy; D-24026): in a real match, play an optional-KO-reward Hero, KO a card;
# the log names the KO'd card before the reward line.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Step-5 `pushLog` added (imports + one line), outcome `neutral`, ordered before the reward.
- [ ] Test asserts the KO line (card + zone + source) on the KO path and its absence on decline.
- [ ] Engine build+test green; `finalStateHash` unchanged; replay/sentinel green or re-pinned (documented).
- [ ] D-24399 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`; `STATUS.md` names WP-590.
- [ ] D-24026 live-verification recorded (the KO line appears in a real match log).

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-23)
Single-move, single-layer, additive log line; the KO-log vocabulary already exists next door; the one real risk (replay-hash re-pin) is gated scaffold-first with an explicit, legitimate re-pin path.

### Copilot (`01.7`) — verdict: **PASS** (independent audit, 2026-08-23)
Reuses the existing `pushLog`/`formatCardRef` helpers and the Master-Strike KO phrasing; no new mechanic, no `G` shape change, no reward-logic touch. The one documented RISK (replay-hash re-pin) was verified **low** by the auditor: the sole pinned replay records no `resolveOptionalKoReward` move, so the new line will not fire there — the scaffold confirms empirically.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (independent audit, 2026-08-23)
No new contract file; no canonical-array change; layer boundary respected (engine move only); determinism gated scaffold-first; API catalog §21 N/A. §14 near-miss the audit flagged (5 acceptance items) corrected this pass to 6 (the decline-no-line criterion promoted to its own line). All import paths, preconditions, and the determinism claim were confirmed against source.

## Vision Alignment
**Clauses touched:** game-log observability (a paid cost is now visible), determinism (finalStateHash unchanged; replay-hash re-pin is log-only, no gameplay change). **Conflict assertion:** `No conflict`. **Non-Goal proximity:** none. **Determinism:** messages excluded from `hashGameState`; a replay-hash re-pin, if needed, records identical gameplay with a richer log.

## Funding Surface Gate
**N/A** — a log-observability fix; no §20.1 trigger. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update
**N/A** — no HTTP endpoint or `apps/server/src/**` library-function change.
