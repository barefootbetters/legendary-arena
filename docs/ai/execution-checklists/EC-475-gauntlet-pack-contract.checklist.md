# EC-475 — Gauntlet Pack Contract (Execution Checklist)

**Source:** docs/ai/work-packets/WP-440-gauntlet-pack-contract.md
**Layer:** Registry

## Before Starting
- [ ] On `origin/main` @ `cc206e8c` (or a clean descendant); registry builds green.
- [ ] `packages/registry/src/gauntletLoadouts.ts` exports `GauntletLoadoutMenu`
      (`{ setAbbr, mastermindSlug, variants }`).
- [ ] `packages/registry/src/playerCountSetup.ts` exports `SupportedPlayerCount`
      (`1 | 2 | 3 | 4 | 5`).
- [ ] `zod` is a `dependencies` entry of `packages/registry/package.json`.
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0.
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0.
- [ ] EXACT target file set (any edit outside this list is a FAIL, not a
      judgment call): `packages/registry/src/gauntletPack.ts`,
      `packages/registry/src/gauntletPack.test.ts`,
      `packages/registry/src/index.ts`, `packages/registry/package.json`
      (+ governance: WORK_INDEX, EC_INDEX, ROADMAP-MINDMAP, DECISIONS, STATUS).

## Locked Values (do not re-derive)
- `GAUNTLET_PACK_VERSION = 1` (integer; the supported pack major version).
- v1 shape: `{ pack_version: 1, gauntlet: { setAbbr, mastermindSlug, division,
  playerCount } }` — no other keys.
- `division` closed set: `'fixed' | 'open'`.
- `playerCount`: integer `1..5` (reuse `SupportedPlayerCount`; do not re-declare
  the union).
- Identity-only: the pack carries NO `legs`, NO `heroDeckIds`/heroes, NO
  `villainGroupIds`/`henchmanGroupIds`/compositions.

## Guardrails
- Registry layer: import `zod` + Node built-ins ONLY. No `game-engine`,
  `server`, `pg`, `apps/*`, or `boardgame.io` import — else STOP.
- `GauntletPackSchema` is STRICT at BOTH object levels (Zod `.strict()`);
  unknown keys are rejected, never silently dropped.
- `validateGauntletPack` rejects an unknown MAJOR `pack_version` with a clear
  full-sentence error BEFORE schema-parsing — never field-ignore an unknown
  version.
- `validateGauntletPack` throws a full-sentence `Error` on invalid input
  (registry is not the move layer; throwing is legal here).
- Do NOT check gauntlet EXISTENCE (registry menu lookup) — shape validation
  only. Existence/leg/composition resolution is the server's job (WP-5).
- Strictly additive: do NOT modify `gauntletLoadouts.ts`, `playerCountSetup.ts`,
  or any other existing registry contract file.
- Follow the established export pattern: `package.json` subpath `./gauntletPack`
  + `src/index.ts` re-export, mirroring `./gauntletLoadouts`.

## Required `// why:` Comments
- The `pack_version` major-reject gate: why reject an unknown major version
  loudly instead of lax-parsing (D-24260 forward-compat via version, not
  silence).
- The `.strict()` schema choice: why unknown keys are a rejection (an unknown
  key means a newer/mismatched producer — surface it, don't drop it).
- The no-existence-check boundary: why validation is shape-only and the server
  re-resolves legs/compositions (identity-only import token, D-24260).

## Files to Produce
- `packages/registry/src/gauntletPack.ts` — **new** — schema + builder +
  validator + types.
- `packages/registry/src/gauntletPack.test.ts` — **new** — round-trip +
  identity-only assertion + version/field/count/division reject paths.
- `packages/registry/src/index.ts` — **modified** — re-export new symbols/types.
- `packages/registry/package.json` — **modified** — add `./gauntletPack` subpath
  export.

## After Completing
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0.
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 (new tests green).
- [ ] `pnpm -r build` exits 0 (no dependent breakage).
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change —
      infrastructure only" (surface is `none — infrastructure`; D-24026 inverts).
- [ ] `docs/ai/DECISIONS.md` D-24260 flipped Drafted → Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-475 → `Done`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- A test that only checks required keys are present (not that extra keys are
  ABSENT) is a vacuous identity-only guard — assert the negative (no `legs`,
  `heroDeckIds`, `villainGroupIds`).
- `pack_version: 2` silently accepted usually means the major-reject gate runs
  AFTER `.strict()` parse (which may already reject it for other reasons) rather
  than as its own clear-error step — gate on version FIRST.
- A registry build that pulls in engine/server types means an illegal import
  leaked in — registry is `zod` + Node only.
