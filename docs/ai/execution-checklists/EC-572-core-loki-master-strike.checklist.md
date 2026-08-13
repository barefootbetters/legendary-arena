# EC-572 — Core Loki Master Strike (Execution Checklist)

**Source:** docs/ai/work-packets/WP-537-core-loki-master-strike.md
**Layer:** Game Engine (`packages/game-engine`) only

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] core/loki has no strike branch yet: `grep -q "MASTERMIND_CORE_LOKI\|'core/loki'" packages/game-engine/src/rules/mastermindHandlers.ts` → **ABSENT**
- [ ] Reuse targets present: `grep -q "function mastermindStrikeHandler" … && grep -q "resolveCo2eMagnetoStrike" … && grep -q "gainWoundToDiscard" … && grep -q "selectLowestCostHero" …` → OK
- [ ] `heroClass` on cardTraits: `grep -q "heroClass" packages/game-engine/src/state/cardTraits.types.ts` → OK
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0 on a clean tree

## Locked Values (do not re-derive)
- Constant: `const MASTERMIND_CORE_LOKI = 'core/loki';` — distinct from `co2e/loki` (different printed penalty). Add the `// why:`.
- Dispatch: add `else if (mastermindId === MASTERMIND_CORE_LOKI) { resolveCoreLokiStrike(gameState); }` to `mastermindStrikeHandler` (co-locate with the other core branches; keep it downstream of WP-537's shared edit).
- Resolver name: **`resolveCoreLokiStrike`** — NOT `resolveLokiStrike` (that is the existing co2e face; do not reuse or repoint it).
- Effect (per player, `Object.keys(gameState.playerZones).sort()`): if `selectLowestCostHero(gameState, hand, 'heroClass', 'strength') !== null` → reveal, **keep the hero** (hand unchanged), no Wound; else `gainWoundToDiscard(gameState, playerZones)`.
- Wound-supply-empty: the `gainWoundToDiscard` `false` return → logged no-effect, never a throw.
- Logs: full sentences prefixed `[Loki Master Strike]` (mirror the existing strike logs).
- Keyed by mastermind selection — **no** `data/cards` / marker / ledger / effect-index change.
- DECISIONS reservation: **D-24346**.

## Guardrails
- Auto-resolve ONLY — no pending-choice, no UIState, no arena-client, no new `G` field.
- Do NOT touch `co2e/loki` / `resolveLokiStrike`, any other mastermind, `tacticHandlers.ts`, `data/cards`, any marker file, or any ledger/index artifact.
- Reveal is the ESCAPE — the Strength-Hero holder keeps the hero and takes nothing (do not discard it).
- No `ctx.random`, no I/O; mutate `G` only via the existing `gainWoundToDiscard` idiom (thread the return where the helper is non-mutating).
- Engine build + full-repo test green; `finalStateHash`/`PRE_WP080` re-pin only on a real fixture diff (none expected — no committed fixture reveals a `core/loki` strike; verify, do not pre-pin).

## Required `// why:` Comments
- On `MASTERMIND_CORE_LOKI`: core Loki's printed strike + why it is separate from `co2e/loki`.
- On the reveal-escape branch (if kept terse): why a Strength-Hero holder takes no Wound (the printed "reveals … or gains a Wound" escape).

## Files to Produce
- `packages/game-engine/src/rules/mastermindHandlers.ts` — **modified** — constant + dispatch branch + `resolveCoreLokiStrike`
- `packages/game-engine/src/rules/mastermindHandlers.test.ts` — **modified** — reveal-keeps / no-hero-Wound / supply-empty / multi-player / dispatch-route cases
- `docs/ai/DECISIONS.md` — **modified** — land D-24346 (→ Active)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** — governance close (STATUS: D-24026 operator-pending)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-537 node `📝` → `✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## After Completing
- [ ] `grep -nE "MASTERMIND_CORE_LOKI|resolveCoreLokiStrike" …` → constant + branch + resolver present
- [ ] `git diff --name-only | grep -E '^(data/cards|data/metadata|apps/|docs/ai/coverage)'` → **NO MATCH** (governance docs aside)
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0; `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] Hash surfaces unchanged (or re-pinned with a note only on a real fixture diff)
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed; D-24346 landed (Active)
- [ ] Commit prefix `EC-572:` (code) + `SPEC:` (governance); D-24026 live-verify operator-pending

## Common Failure Smells
- Repointing/collision with the co2e `resolveLokiStrike` → name the new resolver `resolveCoreLokiStrike` and add a distinct dispatch branch
- The Strength-Hero holder loses a card → reveal is the escape; keep the hero, apply no penalty
- A `data/cards` or ledger file shows in the diff → strikes are mastermind-selection-keyed; no marker/ledger change
- A `finalStateHash` re-pin with no real fixture diff → CRLF/generated-artifact noise; judge by `git diff --numstat`, do not pre-pin
