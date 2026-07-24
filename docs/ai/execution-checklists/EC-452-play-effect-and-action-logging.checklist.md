# EC-452 — Every Played Card Prints Its Effect and the Action Taken (Execution Checklist)

**Source:** docs/ai/work-packets/WP-417-play-effect-and-action-logging.md
**Layer:** game-engine only (log helpers + move call-sites + onPlay handlers + reveal composer + tests; no client/server/registry change)
**Lane:** Standard. Completes the WP-323/324/325 log-enrichment arc + the deferred WP-B.2 reveal realized-results slice (D-24111). B.3 (structured contract) + the remaining move-card/sequence no-op slivers stay deferred.

## Before Starting
- [x] On a worktree off `main`, clean, synced; baseline `origin/main` @ `5a885079` recorded.
- [x] **Scaffold first:** census the `[keyword:…]` tokens across `data/cards/*.json` to confirm the marker-vs-printed-keyword **shape** split (lowercase-kebab/`:` = marker; Title Case / punctuation = printed) before writing the regex. Run the engine suite to record which display / reveal tests + the `sentinel-core-doom-2p` fixture move on the new lines.
- [x] Confirm `heroAttack` / `heroRecruit` are in scope at the `applyCardPlay` play line; `applyRevealRuleActions` knows per-action which mutated.
- [x] Target file set = `## Files to Produce`. Any edit outside is a FAIL.

## Locked Values (do not re-derive)
- Marker shape: `^[a-z0-9]+(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)*$` (`isEngineEffectMarker`).
- Play line: `Player {id} played {Name} ({ext-id})[ ({+A attack, +R recruit})][ — {effect}].` (effect clause has its single trailing `.` trimmed — the caller supplies terminal punctuation).
- Draw: `Player {id} drew {N} card(s) from {ref}.` · shortfall `Player {id} drew {n} of {N} card(s) from {ref} — their deck and discard pile were empty.`
- Attack/recruit: `Player {id} gained +{N} attack|recruit from {ref}.`
- Self-KO: `Player {id} KO'd {ref} via its own ability.`
- Reveal unapplied clause: `… matched: {actions}, but {unapplied} could not be applied.` (unapplied phrases: draw → `the draw`; ko → `the KO`; attack → `the attack grant`; choose → `the choice`).
- Card naming: `formatCardRef(cardDisplayData, extId)` (`?? extId` fallback). Reserved decision: **D-24237**.

## Guardrails
- **Message text only** — no change to `G` economy/zone state, draw/KO/reveal behavior, RNG, or turn flow. The only non-text deltas are the two return-type widenings that FEED the lines (`drawFromPlayerDeck` → `number`, `applyRevealRuleActions` → `RevealActionKind[]`); neither changes what mutates.
- Guard `Array.isArray(G.messages)` before every push (via `pushLog`, which already does).
- Determinism: `G.messages` hash-excluded (D-24081) — **regenerate** the fixture (`record-game-fixture.mjs`), never hand-edit; its `finalStateHash` MUST stay byte-identical.
- **Shape, not allowlist** — an allowlist would silently keep leaking markers for mechanics not yet `HeroKeyword` members (`demolish`, `reveal-multi-take`).
- `logDisplay.ts` / `revealLog.ts` stay pure (no `boardgame.io`, args in). No `.reduce()`.
- Do NOT touch: economy/draw/KO/reveal behavior, `effectProvenance`, the client, the already-logged lines (condition-gate / rescue / count-scaled / hollow / pending parks).

## Required `// why:` Comments
- The marker-drop + shape rationale (why: WP-417 — the pipeline's effect-markers leaked into player-facing prose; shape beats an allowlist because non-`HeroKeyword` markers must drop too).
- The base-economy clause on the play line (why: printed icons ARE a starter's whole effect; folded into one line to keep six-starters-in-a-row readable).
- The trailing-`.` trim (why: the caller finishes the sentence; before WP-417 the marker hid the doubling).
- The `''` economy clause on the reject + face-down annotation lines (why: no economy granted / already reported by `applyCardPlay`).
- Each of the four handler log lines + the realized-draw count (why: WP-417 — these onPlay handlers were silent; a short draw was indistinguishable from a full one).
- The reveal unapplied-action threading (why: WP-B.2 — a guard-blocked matched action was reported as success).

## Files to Produce
- `log/logDisplay.ts` [`isEngineEffectMarker` + marker-drop + `formatBaseEconomyClause` + `formatPlayedCardLabel` third param + trailing-`.` trim] · `log/logDisplay.test.ts`.
- `moves/coreMoves.impl.ts` [play line economy clause; reject line `''`] · `moves/playFromUndercover.ts` [annotation line `''`].
- `hero/heroEffects.execute.ts` [realized-draw count + 4 handler lines + reveal unapplied threading] · `hero/heroEffects.execute.test.ts`.
- `hero/revealLog.ts` [`describeUnappliedRevealActions` + `unappliedActionsText`] · `hero/revealLog.test.ts`.
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` [regenerated; hash unchanged].
- Governance: `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/DECISIONS.md` (D-24237), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`.

## After Completing
- [x] `pnpm --filter @legendary-arena/game-engine test` 0 fail; `pnpm -r --no-bail test` 0 fail repo-wide; `pnpm -r build` clean.
- [x] `git diff --numstat -- packages/lagn-spec/schemas/lagn-v1.json` empty (no CI-gated schema drift); `git diff --name-only` = the allowlist.
- [x] STATUS / DECISIONS (D-24237 Active) / WORK_INDEX (WP-417 `[x]`) / EC_INDEX (EC-452 Done); mindmap WP-B.2 node flipped `📦 → ✅` + roadmap-counts written.
- [ ] `User-Visible Surface = play.legendary-arena.com` → D-24026 operator-pending (a match log shows the printed effect markers-stripped, the starter base-icon clause, and the draw/attack/recruit/KO action lines).

## Common Failure Smells
- Changing economy/draw/KO/reveal behavior — this WP is log text + two feeding return-types ONLY; the fixture `finalStateHash` must stay byte-identical.
- Using a keyword allowlist instead of the shape test → markers for non-`HeroKeyword` mechanics keep leaking.
- Forgetting the trailing-`.` trim → `— Draw a card..` on the play line.
- Hand-editing the fixture message oracle instead of regenerating.
- Reaching into `G` from `logDisplay.ts` / `revealLog.ts` — pass `cardDisplayData` in.
- Double-counting the base economy on the face-down annotation line (pass `''`; `applyCardPlay` already reported it).
