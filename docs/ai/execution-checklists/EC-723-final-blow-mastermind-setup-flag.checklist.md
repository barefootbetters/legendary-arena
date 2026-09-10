# EC-723 — Final Blow Mastermind Setup Flag (Execution Checklist)

**Source:** docs/ai/work-packets/WP-686-final-blow-mastermind-setup-flag.md
**Layer:** Registry + Game Engine

## Before Starting
- [ ] `origin/main` is at or ahead of `4b5f2ca7`; working tree clean
- [ ] `SetupEnvelope` (setupContract.types.ts) carries `heroSelectionMode?` /
      `supportPools?` / `heroAlternateIds?` — the additive-optional precedent
- [ ] `MatchConfiguration = MatchSetupConfig` bare alias (types.ts:445);
      `MatchSetupConfig` has exactly the 9 composition fields
- [ ] `game.ts setup()` delegates to `buildInitialGameState(matchConfiguration,
      …)` (`:374`) and builds NO `G` itself; `buildInitialGameState`'s `config`
      param is `MatchSetupConfig` (`:248`) and its `baseState` literal is at
      `:580` — re-verify against HEAD
- [ ] `matchGate.routes.ts` still forwards `setupData` verbatim (`:320`, no
      server change needed) — else STOP and re-scope
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — record the
      current sentinel `finalStateHash` as the byte-identical-off baseline
- [ ] Target file set is EXACTLY `## Files to Produce`; anything outside is a FAIL

## Locked Values (do not re-derive)
- Envelope field name: `finalBlow`; Type: boolean; Required: false; Default absent: `false`
- Engine payload: `MatchConfiguration = MatchSetupConfig & { readonly finalBlow?: boolean }`
- Engine G field: `LegendaryGameState.finalBlow?: boolean` — **OPTIONAL**,
  seeded in `buildInitialGameState` **only when** `config.finalBlow === true`,
  omitted otherwise (byte-identical-off, no re-pin)
- Storage site: `buildInitialGameState` (NOT `game.ts`, NOT `matchSetup.validate.ts`)
- `schemaVersion`: unchanged `"1.0"`
- DECISIONS entry: **D-24503**

## Guardrails
- `finalBlow` is envelope/payload-level, NEVER composition — the 9-field
  `MatchSetupConfig` lock stays byte-identical (drift test green)
- `G.finalBlow` is OPTIONAL and OMITTED when off — an always-present field moves
  both whole-`G` hash oracles for every match; omit-when-false keeps a
  non–Final-Blow match byte-identical (NO re-pin). If a sentinel hash moves, STOP
- INERT: no endgame / tactics / fight branch reads `finalBlow` in this EC
  (WP-687 does) — a branch here is a scope FAIL, STOP
- `game.ts` and `matchSetup.validate.ts` need NO change (setup delegates; the
  validator ignores extra envelope fields) — editing them is out of scope
- Registry package must NOT import the engine (browser-safe boundary)
- Moves never throw; only `Game.setup()` may throw; `G` stays JSON-serializable
- No new dependency; `zod` only; full-sentence validation messages (00.6 R11)

## Required `// why:` Comments
- `setupContract.types.ts` at `finalBlow?`: envelope-extensibility precedent +
  the engine-consumes-this divergence
- `types.ts` at `LegendaryGameState.finalBlow?`: optional so a non–Final-Blow
  match serializes byte-identically (absent-on-fresh precedent); read by WP-687
- `buildInitialGameState.ts` at the conditional seed: `finalBlow` set only when
  `config.finalBlow === true` so the off path is byte-identical (no re-pin)

## Files to Produce
- `packages/registry/src/setupContract/setupContract.types.ts` — **modified** — `finalBlow?: boolean` on `SetupEnvelope`
- `packages/registry/src/setupContract/setupContract.schema.ts` — **modified** — `finalBlow: z.boolean().optional()`
- `packages/registry/src/setupContract/setupContract.test.ts` — **modified** — valid/absent/invalid cases
- `packages/game-engine/src/types.ts` — **modified** — widen `MatchConfiguration`; add optional `finalBlow?: boolean` to state
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — widen `config` param; seed `finalBlow: true` only when true
- `packages/game-engine/src/game.test.ts` — **modified** — round-trip + inert + byte-identical-off assertions
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` — **modified** — envelope field + extensibility bullet
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` — **modified** — `finalBlow` property (not required)
- `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` — **modified** — Stage 1 bullet + coverage
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — §8.1 envelope extensibility
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `POST /api/match/create` whole-row replace
- `docs/ai/DECISIONS.md` — **modified** — land D-24503
- `docs/ai/STATUS.md` — **modified** — infrastructure-only entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-686 row check-off
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-723 → Done
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-686 node `📝` → `✅` + counts

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 with NO hash
      re-pin (sentinel `finalStateHash` unchanged vs the recorded baseline)
- [ ] `node -e "JSON.parse(require('node:fs').readFileSync('docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json','utf8'))"` exits 0
- [ ] `git diff --name-only` shows only the files above (NOT `game.ts`,
      `matchSetup.validate.ts`, or any hash fixture)
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only"
- [ ] `docs/ai/DECISIONS.md` D-24503 landed (Active)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-686 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph updated, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- A sentinel/golden `finalStateHash` moved → `G.finalBlow` is always-present, not omitted when off
- A `finalBlow` grep hit in endgame/mastermind/fightMastermind → scope leak from WP-687
- Typecheck error reading `config.finalBlow` in `buildInitialGameState` → the `config` param was not widened to `MatchConfiguration`
- `MatchSetupConfig` field count changed → the composition lock was violated
- A registry test importing the engine → layer-boundary break
