# EC-624 — Optional-KO-Reward: Icon-Reward Fidelity (Execution Checklist)

**Source:** docs/ai/work-packets/WP-589-optional-ko-reward-icon-suppression.md
**Layer:** Game Engine (hero-ability parser) + card-data pipeline (marker map → regen). No server/client change.

## Before Starting
- [ ] Preconditions A–C in WP-589 pass (Energy Drain line has NO optional-ko-reward marker; applier already whitelists the token; parser has NO optional-ko-reward suppression block).
- [ ] Baseline: `pnpm --filter @legendary-arena/game-engine build && test` exit 0 (note count); replay/sentinel green (hash oracles must stay byte-identical unless a swept card is in a fixture — see Scaffold).
- [ ] **Scaffold (MANDATORY, before the full sweep):** prototype the suppression block + ONLY the `core/rogue/energy-drain/0` marker, regenerate `core.json`, run the engine suite + replay/sentinel. Record observed result. If a hash oracle / reference fixture moves, STOP and assess (a swept card in a pinned fixture escalates scope) before adding the remaining 5 markers.

## Locked Values (do not re-derive)
- Suppression predicate: fires iff `rewardTypes.get('optional-ko-reward')` is set AND equals a keyword the icon pass can emit (`attack` or `recruit`); then drop that plain keyword from `uniqueKeywords` + `magnitudes.delete(it)`. `draw`/`rescue` rewards → no-op (they never produce a plain icon keyword; Dangerous Rescue stays byte-identical).
- Seeded rewards: `OPTIONAL_KO_REWARD_SEEDED_REWARDS` = { rescue, draw, attack, recruit } — do NOT widen.
- The 6 marker rows (setAbbr / heroSlug / cardSlug / abilityIndex → token) — verbatim from WP-589 §Scope (In). Token forms only: `[keyword:optional-ko-reward:recruit:1]`, `:attack:1`, `:draw:1`.
- Marker applier is UNCHANGED — `VALID_TOKEN_PATTERN` already accepts `optional-ko-reward:<reward>:N`. Do NOT edit `apply-hero-ability-markers.mjs`.
- co2e is NOT edited — it already carries the marker; the parser fix removes its double-grant.

## Guardrails (execution order matters)
1. `heroAbility.setup.ts`: add the suppression block AFTER Step 4 dedup, mirroring the `shuffle-discard-empty-reward` block (lines ~970–990) verbatim in shape — `const optionalKoRewardType = rewardTypes.get('optional-ko-reward');` then the drop loop + `magnitudes.delete`.
2. Add the parser test FIRST (or alongside): icon-reward line → one `optional-ko-reward` effect, zero plain `recruit`/`attack`; draw/rescue line unchanged; a park-then-no-grant assertion for a played icon-reward card.
3. Add the 6 rows to `hero-ability-markers.json` under their `setAbbr` blocks (create the `ssw1`/`ssw2` block entries in slug order if absent).
4. Regenerate card data (`apply-hero-ability-markers.mjs`, or the full pipeline per docs/03) — the pass APPENDS the token idempotently to the named line.
5. `git status --porcelain data/cards` — diff MUST be exactly the 6 marker appends (core ×1, ssw1 ×3, ssw2 ×2). Revert any CRLF/line-ending-only churn (judge by `git diff --numstat`, not status).
6. Rebuild the engine; run the full suite.

- **Determinism:** no new `G` field. If a hash oracle moves, it is a swept card in a pinned fixture — STOP, assess, and only re-pin deliberately with the reason recorded (do NOT blanket-re-pin).
- **No applier edit. No server/client edit. No condition-parsing edit** — the Covert/team/Spectrum gates are faithful and untouched.
- **Scope lock:** only the 6 named lines gain markers; unseeded-reward and no-reward KO lines stay unmarked.

## Required `// why:` Comments
- On the suppression block: cite D-24398; mirrors D-24148 (shuffle-discard-empty-reward) / D-24016 (attack-per-count) — the marked reward icon is subsumed by the KO-gated reward, so the plain icon grant must be dropped to avoid a free/double grant.
- On the parser test's zero-plain-effect assertion: it is the double-grant regression pin.

## Files to Produce
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** (suppression block)
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (suppression + park pins; the sibling shuffle-discard-empty-reward / dangerous-rescue parser tests live HERE, not in the near-empty `src/setup/heroAbility.setup.test.ts`)
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** (6 rows)
- `data/cards/core.json`, `data/cards/ssw1.json`, `data/cards/ssw2.json` — **regenerated** (marker append only)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build && test` green (+ new pins); replay/sentinel green (or documented re-pin).
- [ ] `grep -c optional-ko-reward` rises by exactly +1 (core) / +3 (ssw1) / +2 (ssw2); co2e unchanged.
- [ ] `pnpm -r build && pnpm -r --no-bail test` — no new failures; `lagn-v1.json` / CRLF churn reverted.
- [ ] Live-on-surface (D-24026): core Rogue Energy Drain prompts "KO a card or decline" with the Covert synergy active; +1 Recruit only on a KO.
- [ ] STATUS names WP-589 (+ hash-oracle outcome, D-24026 pending); DECISIONS D-24398 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- Energy Drain STILL grants recruit with no prompt after the marker → suppression block missing or placed before the effect builder; and/or the marker didn't regenerate into `core.json`.
- Energy Drain grants recruit AND prompts a KO → the double-grant; the suppression predicate didn't match the `recruit` rewardType.
- Dangerous Rescue behavior changed → the suppression wrongly fired on a `rescue` reward; it must be a no-op for draw/rescue.
- A hash oracle moved → a swept card is in a pinned fixture; assess before re-pinning (do not blanket-re-pin).
- `data/cards` diff is large / touches unrelated cards → you ran a broader regen or CRLF churn; reduce to the 6 marker appends.
