# EC-647 — Danger Meter escaped-bystander label (Execution Checklist)

**Source:** docs/ai/work-packets/WP-612-danger-meter-escaped-bystander-label.md
**Layer:** Cross-cutting — Game Engine (`SchemeLossKind` split) + arena-client (noun map)

## Before Starting
- [ ] `schemeLossProgress.ts` exports `SchemeLossKind` / `SCHEME_LOSS_KINDS` /
      `resolveSchemeLossKind` (with the `pile-depleted → hero-deck/wound-stack`
      split precedent); `escaped-pile-count` configs carry `cardType` (Midtown =
      bystander, Negative Zone = villain).
- [ ] `menaceDisplay.ts` `SCHEME_LOSS_NOUNS` is an exhaustive `Record<SchemeLossKind,string>`.
- [ ] Fresh worktree off `origin/main` (`8afadd16`); baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 4 code files: `schemeLossProgress.ts` + `.test.ts`,
      `menaceDisplay.ts` + `.test.ts`. Any edit outside → STOP.
- [ ] `pnpm -r build` 0; engine + arena-client suites green; `vue-tsc` 0.

## Locked Values (do not re-derive)
- New kind = `'escaped-bystander'`; client noun = `'Bystanders'`.
- Split: `condition.cardType === 'bystander' ? 'escaped-bystander' : 'escaped-pile'`.
- Add the member to BOTH the `SchemeLossKind` union AND `SCHEME_LOSS_KINDS` (drift rule).

## Guardrails
- **Split mirrors `pile-depleted`.** One new kind; the resolver branches on
  `condition.cardType`. Villain / converted escaped-pile stay "Escaped".
- **Runtime drift pin** (WP-563): the engine `everyKind` deepStrictEqual list gains
  the member (runtime, not a bare `satisfies`).
- **Client copy on the client** (D-24367 §2): the noun lives in `menaceDisplay.ts`,
  NEVER in `packages/`.
- **Projection-only:** no `G` / `ctx` / endgame-loss change — both hash oracles
  (`finalStateHash`, `PRE_WP080_HASH`) MUST stay byte-identical.
- **`// why:` comments** on the cardType split and the new noun (name the collision).
- **`vue-tsc` gates** (the exhaustive Record forces the client add).

## Files to Produce
- `packages/game-engine/src/rules/schemeLossProgress.ts` — **modified** — kind + cardType split
- `packages/game-engine/src/rules/schemeLossProgress.test.ts` — **modified** — drift list + per-scheme pin
- `apps/arena-client/src/vfx/menaceDisplay.ts` — **modified** — `'escaped-bystander' → 'Bystanders'`
- `apps/arena-client/src/vfx/menaceDisplay.test.ts` — **modified** — noun + `'Bystanders 5/8'` readout

## After Completing
- [ ] `pnpm -r build` 0; engine suite green (drift + hash oracles byte-identical);
      arena-client `vue-tsc` 0 + suite green.
- [ ] Engine pin: Midtown → `escaped-bystander`, Negative Zone → `escaped-pile`.
- [ ] Client: `menaceKindLabel('escaped-bystander') === 'Bystanders'`.
- [ ] **Live-on-surface (D-24026):** on deployed `play.legendary-arena.com`, a
      Midtown Bank Robbery danger meter reads "Bystanders N/8".
- [ ] `git diff --name-only` — the `EC-647:` implementation commit is only the 4 code files.
- [ ] STATUS.md updated; DECISIONS.md D-24423 Active; WORK_INDEX WP-612 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- Drift test red → you updated the union but not `SCHEME_LOSS_KINDS` (or the `everyKind` list).
- `vue-tsc` red on `menaceDisplay.ts` → the exhaustive Record is missing the new key.
- A hash oracle moved → you touched gameplay/endgame state, not just the projection label.
- Negative Zone now says "Bystanders" → the split predicate is inverted.
