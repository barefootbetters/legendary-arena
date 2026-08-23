# EC-625 — Log the Silent KO in `resolveOptionalKoReward` (Execution Checklist)

**Source:** docs/ai/work-packets/WP-590-optional-ko-reward-ko-log.md
**Layer:** Game Engine (one move's logging). No client/server/registry change.

## Before Starting
- [ ] Preconditions A–C in WP-590 pass (Step 5 KOs with no pushLog; the move imports neither `pushLog` nor `formatCardRef`; `messages` stays hashed by `computeStateHash` / excluded from `hashGameState`).
- [ ] Baseline: `pnpm --filter @legendary-arena/game-engine build && test` exit 0 (note count); replay/sentinel green.
- [ ] **Scaffold (MANDATORY):** add the log line + import prototype, run the engine suite + replay/sentinel, record whether the replay/PRE_WP080 hash moved. That answer decides whether a re-pin is in scope — do NOT assert it either way.

## Locked Values (do not re-derive)
- KO line emitted in **Step 5**, AFTER `playerZones[targetZone] = moveResult.from; G.ko = koCard(...)`, BEFORE the Step-6 `executeSingleEffect` reward dispatch.
- Outcome **`neutral`** (a cost the player paid — mirrors the Master Strike KO, not the reward's `applied`).
- Card named via `formatCardRef(G.cardDisplayData, targetCardId)`; source via `formatCardRef(G.cardDisplayData, front.sourceCardId)`; human zone label = `hand` → "their hand", `discard` → "their discard pile".
- Decline path (`{ decline: true }`, Step 3) emits **NO** KO line.
- `finalStateHash` (`hashGameState`) is byte-unchanged — messages are excluded there. Only the **replay** hash (`computeStateHash` / `PRE_WP080_HASH`) can move.

## Guardrails (execution order matters)
1. Add the two imports: `pushLog` from `../log/logPush.js`, `formatCardRef` from `../log/logDisplay.js` (verify the exact paths against a sibling move, e.g. `fightVillain.ts`).
2. Insert exactly one `pushLog(G, \`Player ${playerID} KO'd ${formatCardRef(...)} from ${zoneLabel} for ${formatCardRef(...)}'s ability.\`, 'neutral')` in Step 5 — no other edit to the move.
3. Do NOT touch Steps 1–4, 6, 7, the atomicity (no KO ⇒ no reward), the seeded-reward set, or `PendingOptionalKoReward`.
4. Test: KO path logs one KO line (card + zone + source) ordered before the reward line; decline path logs no KO line. Add to `optionalKoReward.resolve.test.ts` (existing suite).
5. If the scaffold showed the replay/sentinel hash moved: re-pin the affected constant and record the reason inline as a **log-only** re-pin (identical gameplay, richer log). If it did not move: no re-pin, and say so.

- **Determinism:** `finalStateHash` MUST stay byte-unchanged (messages excluded). If it moves, STOP — you changed game state, not just a log.
- **No mechanics change.** The KO still precedes the reward; atomicity intact; no reward-logic edit.
- **Scope lock:** only `optionalKoReward.resolve.ts` + its test (+ a conditional hash constant). No other move's logging.

## Required `// why:` Comments
- On the KO `pushLog`: cite D-24399 — the KO is the paid cost of the optional-KO-reward; log it before the reward so the spent card is observable (mirrors the Master Strike KO line). Outcome `neutral` because it is a cost, not the payoff.
- If a re-pin lands: `// why:` naming it a log-only re-pin (identical gameplay; `messages` is hashed by `computeStateHash`).

## Files to Produce
- `packages/game-engine/src/moves/optionalKoReward.resolve.ts` — **modified** (imports + one Step-5 `pushLog`)
- `packages/game-engine/src/moves/optionalKoReward.resolve.test.ts` — **modified** (KO-line + decline-no-line assertions)
- (Conditional) the pinned replay/sentinel hash constant — **re-pinned** only if the scaffold showed it moved

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (+ new assertion); `finalStateHash` byte-unchanged.
- [ ] `pnpm -r --no-bail test` green — replay/sentinel byte-unchanged OR re-pinned with the log-only reason recorded.
- [ ] Live-on-surface (D-24026): in a real match, KO a card for an optional-KO-reward Hero → the log names the KO'd card before the reward line.
- [ ] STATUS names WP-590 (+ re-pin outcome, D-24026 pending); DECISIONS D-24399 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- `finalStateHash` moved → you edited game state, not just `G.messages`; the log line must be the only change.
- The KO line prints after the reward → it must be in Step 5, before the Step-6 dispatch.
- Decline path prints a KO line → the pushLog leaked outside the `{ zone, cardId }` branch.
- Replay hash moved and you blanket-accepted it → confirm it is a pure log-only re-pin (identical moves, only `messages` grew) and record the reason; if gameplay changed, you strayed out of scope.
