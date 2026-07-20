# EC-434 — Council Masterminds Fail Setup Loudly (Execution Checklist)

**WP:** [WP-390](../work-packets/WP-390-inert-council-masterminds.md)
**Layer:** Game Engine
**Reserves:** D-24206

## Before Starting

- [ ] WP-389 is `[x]` on `main` — its AC-4 pins the behaviour this WP inverts,
      so landing this first would force rewriting that acceptance criterion.
- [ ] `pnpm install && pnpm -r build` from the worktree root — cross-package
      tests import built `dist`, so a stale build produces false results.

## Locked Values (do not re-derive)

| Value | Locked to |
|---|---|
| D-number | **D-24206** |
| Throw site | `findMastermindCards`, the `if (!baseCard)` branch — **not** `buildMastermindState`'s null handling |
| Affected masterminds | `shld/hydra-high-council`, `shld/hydra-super-adaptoid`, `2099/sinister-six-2099`, `2099/alchemax-executives` |
| Mindmap marker | `✅` at execution (`📝` is draft-time only) |

## Guardrails

- **The guard fires ONLY for found-but-zero-base-face.** `buildMastermindState`
  has three degenerate returns — narrow-test-mock registry, unparseable id, and
  unresolved mastermind. All three MUST keep the existing fallback. Throwing on
  any null resolve breaks every narrow mock in the repo.
- **Do not model councils.** This WP answers open question 4 only. Face
  ordering, `[rule:Adapt]`, and any `MastermindState` shape change stay out —
  a shape change would force the sentinel `finalStateHash` + `PRE_WP080_HASH`
  dual re-pin.
- **Setup only.** `buildMastermindState` is called solely from
  `buildInitialGameState`. Confirm no move reaches it — moves never throw.
- **Do not delete WP-389's AC-4 test.** Replace it in place with the inverted
  contract so the supersession is legible.

## Required `// why:` Comments

- [ ] At the throw: why this is not "mastermind not found", what the degenerate
      fallback used to produce, and that `Game.setup()` is the sanctioned place
      to throw.
- [ ] On the replaced AC-4 test: that WP-389 pinned the old behaviour and
      D-24206 inverts it.

## Files to Produce

- `packages/game-engine/src/mastermind/mastermind.setup.ts` — modified
- `packages/game-engine/src/mastermind/mastermind.setup.test.ts` — modified
- `docs/ai/DECISIONS.md` — D-24206 appended **by line position** (the
  `Protect this file.` sentinel appears 75×; string anchors land early)
- `docs/ai/work-packets/WORK_INDEX.md` — row `[ ]` → `[x]`
- `docs/ai/work-packets/WP-390-*.md` — status → Done
- `docs/05-ROADMAP-MINDMAP.md` — marker `📝` → `✅`, then `roadmap:counts:write`

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine test` — 0 fail
- [ ] `pnpm --filter @legendary-arena/server test` — 0 fail (proves the throw
      reaches no real setup path)
- [ ] `node scripts/roadmap-counts.mjs --check` exits 0
- [ ] DECISIONS heading count +1, D-24206 is the LAST entry, sentinel at EOF
- [ ] **Verified against real card data, not the fixture:** all four councils
      throw with a diagnostic naming the mastermind; `core/magneto`,
      `co2e/red-skull`, `core/dr-doom` still build with tactics > 0
- [ ] `git diff --exit-code packages/lagn-spec/schemas/lagn-v1.json` — the
      build rewrites it; commit only on a REAL diff, never line-ending churn

## Common Failure Smells

- Commit subject prefixed `WP-390:` — invalid. Code commits are
  `EC-###:` / `SPEC:` / `INFRA:`, and a code path additionally requires an EC
  to exist. Both gates fail on this and it is the reason this EC exists.
- `git status` showing `lagn-v1.json` modified and committing it blind.
- Anchoring the D-entry on `Protect this file.` or a `**Packet:**` tail.

## Rules

Subordinate to `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`. The WP
remains authoritative on design; this EC only pins drift-prone execution
detail.
