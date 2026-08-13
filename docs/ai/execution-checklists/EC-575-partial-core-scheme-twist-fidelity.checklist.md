# EC-575 — Partial Core Scheme-Twist Fidelity (Civil War KO-all + Cosmic Cube escalation) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-540-partial-core-scheme-twist-fidelity.md
**Layer:** Game Engine (`packages/game-engine`) only

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Partial configs present: `grep -q "resolverId: 'ko-from-hq'" … && grep -q "koCount: 2" … && grep -q "resolverId: 'wound-all'" … && grep -q "woundCount: 1" …/schemeTwistConfigs.ts` → OK
- [ ] Resolvers present: `grep -q "function koFromHq" … && grep -q "function woundAll" …/schemeTwistResolvers.ts` → OK
- [ ] Dispatch order: `schemeTwistHandler` calls the resolver, THEN returns the `schemeTwistCount +1` `modifyCounter` effect (resolver reads the pre-increment count) — confirm in `schemeHandlers.ts` before relying on `schemeTwistCount + 1`
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
### Part A — Super Hero Civil War (KO-all)
- `koFromHq` gains `const koAll = params['koAll'] as boolean | undefined;`. When `koAll === true`, KO **all** eligible HQ Heroes: build the same `eligible` list, KO `eligible.length` (cheapest-first, slot-index tiebreak), refill each slot. When `koAll` is absent/false, the existing `koCount` path is UNCHANGED. Full-sentence `[Scheme Twist]` logs.
- Config `super-hero-civil-war`: `params: { koCount: 2 }` → `params: { koAll: true }`. Loss config (`lossThresholdByPlayerCount` + `resourceLossCondition` pile-depleted heroDeck) UNCHANGED. Update the `// why:`.

### Part B — Unleash the Cosmic Cube (escalation)
- `woundAll` gains `const escalation = params['escalation'] as Array<{ atOrAfterTwist: number; woundCount: number }> | undefined;`. When present: `const currentTwist = (gameState.counters.schemeTwistCount ?? 0) + 1;` then set `effectiveWoundCount` to the **MAX** `step.woundCount` among steps with `step.atOrAfterTwist <= currentTwist` (0 when none match — a logged no-op, never a throw), then deal that many wounds to each player. When `escalation` is absent, the existing flat-`woundCount` path is UNCHANGED. **No `.reduce()`** in the step selection — use `for...of` tracking the max.
- Config `unleash-the-power-of-the-cosmic-cube`: `params: { woundCount: 1 }` → `params: { escalation: [{ atOrAfterTwist: 5, woundCount: 1 }, { atOrAfterTwist: 7, woundCount: 3 }] }`. `lossThreshold: 8` UNCHANGED. Update the `// why:`.

### Both
- `currentTwist = schemeTwistCount + 1` (the resolver runs BEFORE the increment effect applies — the load-bearing invariant; `// why:` it).
- No new `SchemeTwistResolverId` / `SchemeTwistResolverKey` / registry / phrases (both resolvers keep their existing `koFromHq` / `woundAll` keys).
- DECISIONS reservation: **D-24349**.

## Guardrails
- ADDITIVE params only — `koCount` and flat `woundCount` paths MUST remain the default when `koAll` / `escalation` is absent (behavior-preserving for any current/future caller).
- Do NOT change either scheme's LOSS config (Civil War heroDeck-empty; Cosmic Cube twist-8) — this WP is the twist EFFECT only.
- `escalation` picks the MAX matching step, not the first — twist 7 matches both `5→1` and `7→3` → 3 wounds.
- No `ctx.random`, no I/O; resolvers mutate `G` via the existing `koCard` / `refillHqSlot` / `gainWound` idioms; no new persistent shape (config data + `schemeTwistCount`).
- Do NOT touch `data/cards`, any marker file, the mechanic ledgers, the effect-implementation index, or any other scheme config/resolver.
- Keep one `schemeTwistResolved` notable-event emission per resolver (the existing EC-209 single-terminal-push discipline; the file's emission-count grep gate must still hold).
- `finalStateHash`/`PRE_WP080` re-pin only on a real fixture diff (none expected — no committed fixture reaches these twists); verify, do not pre-pin.

## Required `// why:` Comments
- On the `koAll` branch: the printed "KO all the Heroes in the HQ" (KO every eligible slot, not `koCount`).
- On `currentTwist = schemeTwistCount + 1`: the resolver runs before the counter-increment effect, so the pre-increment count + 1 is this twist's number.
- On the `escalation` max-step selection: why the MAX matching step (twist 7 matches two steps).

## Files to Produce
- `packages/game-engine/src/rules/schemeTwistResolvers.ts` — **modified** — `koFromHq` `koAll` + `woundAll` `escalation`
- `packages/game-engine/src/rules/schemeTwistConfigs.ts` — **modified** — Civil War + Cosmic Cube `params` + two `// why:`
- `packages/game-engine/src/rules/schemeTwistResolvers.test.ts` — **modified** — KO-all + escalation-by-twist cases
- `packages/game-engine/src/rules/schemeTwistConfigs.test.ts` — **modified** — the two `params` assertions
- `docs/ai/DECISIONS.md` (D-24349 → Active) · `STATUS.md` (D-24026 operator-pending) · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-540 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] `grep -nE "koAll|escalation|atOrAfterTwist" packages/game-engine/src/rules/schemeTwistConfigs.ts` → both configs updated; `grep -c "koCount: 2\|woundCount: 1" …` → 0
- [ ] `grep -nE "koAll|escalation|schemeTwistCount" packages/game-engine/src/rules/schemeTwistResolvers.ts` → param handling present
- [ ] No new resolverId: `SchemeTwistResolverId` / `SCHEME_TWIST_RESOLVER_KEYS` unchanged
- [ ] `git diff --name-only | grep -E '^(data/cards|data/metadata|apps/|docs/ai/coverage)'` → **NO MATCH** (governance aside)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24349 landed (Active)
- [ ] Commit prefix `EC-575:` (code) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Cosmic Cube deals wounds one twist early/late → the current twist is `schemeTwistCount + 1` (pre-increment), not `schemeTwistCount`
- Twist 7 deals 1 wound, not 3 → the escalation picked the first matching step, not the MAX
- Civil War still KOs 2 → the config `params` weren't switched to `{ koAll: true }`, or `koFromHq` ignored `koAll`
- A non-Cosmic-Cube scheme's wounds changed → the flat-`woundCount` path wasn't preserved when `escalation` is absent
- A `data/cards`/ledger file in the diff → schemes are selection-keyed; no marker/ledger change
- The file's `schemeTwistResolved` emission-count gate fails → you added a second emission; keep one terminal push per resolver
