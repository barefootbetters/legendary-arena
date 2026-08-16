# EC-593 — Danger Meter on the Play Surface

**WP:** [WP-558](../work-packets/WP-558-danger-meter-hud-play-surface.md)
**Layer:** App (`apps/arena-client` only)
**Lane:** Standard two-session
**Reserves:** D-24367

> The WP is the authoritative design document. If this EC and the WP
> conflict, the WP wins. Both are subordinate to `ARCHITECTURE.md` and
> `.claude/rules/*.md`.

---

## Before Starting

- [ ] On `origin/main` at or after `879416c5`; working tree clean.
- [ ] `pnpm install` (a fresh worktree has no `node_modules`), then
      `pnpm -r build` exits 0 — arena-client imports the built engine `dist`,
      and WP-557's fields only exist there after a rebuild.
- [ ] Record baselines: `pnpm --filter arena-client test` (draft observed
      **1279 / 184 / 0**) and `pnpm --filter arena-client typecheck` (**0**).
- [ ] Read `TopHudBar.vue` `twistProgressLabel()` and both parents' call
      sites — the hardcoded prop being removed.

## Locked Values

- Read only these four, all from `UIState.progress`: `menace`,
  `menaceTier`, `schemeLossProgress`, `schemeLossThreshold`.
- `MenaceTier` = `'calm' | 'rising' | 'critical'` — **consumed**, never
  re-banded client-side.
- Bar percentage = `menace * 100`, clamped 0..100. No other transform.
- `schemeLossThreshold` absent ⇒ bare count, **no** `/`, and **never** a
  defaulted `8` or `7`.
- `menace` absent ⇒ the meter renders **nothing** (not a zero-width bar).
- Effect-Intensity gates **animation only** (pulse, width/colour
  transition). The bar, numbers, and text always render — including at
  `off` and under `prefers-reduced-motion`.
- `VfxKind` (`'shake' | 'particles' | 'word'`) is **not** extended.

## Guardrails

1. **Never re-derive a threshold or a tier.** The D-24366 resolution order is
   engine-side. The client owns zero copy of it. This is the whole reason
   WP-557 existed.
2. **The meter is information, not decoration** (D-24367 §1). Do not route
   its presence through `shouldRender(...)`. Gate only its animation.
3. **Remove the prop from all three sites** — `TopHudBar.vue` and **both**
   parents. Leaving one parent passing it makes the surfaces disagree; a grep
   for `scheme-twist-threshold` must return zero (AC-7).
4. **Pure logic goes in `vfx/menaceDisplay.ts`** with no Vue import, so it is
   unit-testable without mounting. The SFC stays thin.
5. **Client-only.** `git diff --name-only -- packages` MUST be empty. No
   runtime `registry` / `server` import. No `G` / `ctx` write. Hash-excluded.
6. **`pnpm --filter arena-client typecheck` is the load-bearing gate.**
   `vite build` uses esbuild and `node:test` runs under tsx — **neither
   typechecks SFCs**. Recurred in WP-166 / 207 / 227.
7. **Degrade, never fake.** An absent signal renders nothing; it must not be
   defaulted to a calm/zero reading. A false calm is worse than no meter.
8. **Fixtures are part of the change.** All three
   `fixtures/uiState/*.json` get the four fields, or the dev-preview route
   shows an empty meter and reads as a bug.

## Required Comments

- `// why:` on the animation gate, stating that only animation is gated and
  citing **D-24367 §1** — a future reader will otherwise "tidy" the meter
  behind `shouldRender` and silently hide game state at `off`.
- `// why:` on the absent-`schemeLossThreshold` branch, citing D-24366 §5
  (a `pile-depleted` scheme has no fixed denominator).
- `// why:` on the absent-`menace` early return, stating that an absent
  signal is not a claim of safety.
- `// why:` on the fixture backfill (in the test or the loader) noting the
  fields are optional in the type but always populated by a real engine, so
  fixtures must carry them to represent a real match.

## Files to Produce

| File | Change |
|---|---|
| `components/play/DangerMeter.vue` | new — bar + tier treatment + accessible text |
| `components/play/DangerMeter.test.ts` | new |
| `vfx/menaceDisplay.ts` | new — pure percentage / class / label / ARIA |
| `vfx/menaceDisplay.test.ts` | new |
| `components/play/TopHudBar.vue` | host meter; **remove** `schemeTwistThreshold`; read projection |
| `components/play/TopHudBar.test.ts` | migrate the 1 breaking assertion; drop 3 inert mount props |
| `pages/PlayDesktop.vue` | drop `:scheme-twist-threshold="8"` |
| `pages/PlayMobile.vue` | drop `:scheme-twist-threshold="8"` |
| `fixtures/uiState/mid-turn.json` | backfill 4 menace fields |
| `fixtures/uiState/endgame-win.json` | backfill 4 menace fields |
| `fixtures/uiState/endgame-loss.json` | backfill 4 menace fields |
| `wiki/visual-effects.md` | correct the ambient-menace bullet |

All paths under `apps/arena-client/src/` unless noted. Governance ledgers
excluded per `01.5`.

## After Completing

- [ ] `WORK_INDEX.md` row → `[x]` with observed counts.
- [ ] `EC_INDEX.md` → `Done`; mindmap → `✅`; `roadmap:counts:write` + `:check`.
- [ ] **D-24367** landed **Active**.
- [ ] `STATUS.md` updated — and **D-24026 is REQUIRED here**, unlike WP-557:
      record the live verification, or record it explicitly as
      operator-pending on the deploy.
- [ ] Name packet 3 (adaptive music) as the remaining consumer.

## Common Failure Smells

- **Routing the meter through `shouldRender`.** It reads as consistency with
  the VFX layer and is the single most likely wrong turn in this packet — it
  hides live game state whenever a player sets effects to `off`.
- **Defaulting the denominator.** `?? 8` or `?? 7` anywhere reintroduces
  exactly the defect this packet exists to remove.
- **Re-banding the tier from `menace`.** If the component computes its own
  `calm/rising/critical`, the meter and the future music channel can disagree
  — the shared contract is the projected `menaceTier`.
- **Removing the prop from only one parent.** Desktop and mobile then render
  different numbers; the grep gate (AC-7) is what catches it.
- **Skipping `typecheck` because build + tests are green.** Neither
  typechecks SFCs; a `vue-tsc` error ships to `main` unnoticed.
- **Backfilling fixtures with a plausible-looking `menace` that contradicts
  its own `schemeLossProgress` / `schemeLossThreshold`.** Make the fixture
  internally consistent — a reader will use it as the worked example.
