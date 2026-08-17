# EC-596 — In-Play Hollow Baseline Rebuild

**Work Packet:** WP-561
**Layer:** Dashboard + Coverage Feeds
**Status:** Pending
**Locks:** D-24370 (amends D-24050)

> The WP is the authoritative design document. Where this EC and WP-561
> conflict, the WP wins. This EC extracts the drift-prone values.

---

## Before Starting

- [ ] `git fetch origin main`, branch from a clean tree, record the SHA.
- [ ] Fresh worktree? `pnpm install`, then `pnpm -r build`.
- [ ] Baseline `pnpm --filter dashboard test` — **447 / 0** at draft.
- [ ] Read the header of `apps/dashboard/scripts/build-in-play-baseline.mjs`
      before running it. You are running an existing, correct, deliberately
      out-of-build-chain maintenance script — not writing one.

## Locked Values

- Command: `pnpm --filter dashboard build:in-play-baseline`.
- Expected rebuild: **14 mechanics / 140 obs → 35 mechanics / 2285 obs**. The
  script prints this; confirm it.
- Post-rebuild metric, unchanged: `totalObs` **2285**, `resolvedObs` **59**,
  `percentResolved` **2.6**.
- The ONE breaking test:
  `useInPlayCoverage credits a fixed mechanic from the committed seed
  (dodge 37 → 26.4%)`. Re-pin `totalObs` **140 → 2285** and `percentResolved`
  **26.4 → 1.6**; `resolvedObs` stays **37**. **Its title embeds the stale
  numbers — rename it too**, and prefer a title that does not hard-code figures.
- The large snapshot test (`totalObs 2285` / `2.6`) MUST pass **untouched**.
- Top rebuilt peaks, for eyeballing the artifact: `moonlight` 293,
  `investigate` 293, `coordinate` 212, `teleport` 178, `artifact` 169,
  `outwit` 157.
- Invariant to assert (AC-4), demonstrated at draft with the real function:
  flipping `teleport` to `executable` and removing its live obs gives
  **237 / 2285 = 10.4%** against the rebuilt baseline, versus **59 / 2107 =
  2.8%** against the old seed.

## Guardrails

1. **Do NOT edit `apps/dashboard/scripts/build-in-play-baseline.mjs`.**
   `git diff --exit-code` on that path must return 0.
2. **Do NOT hand-edit the baseline JSON.** Run the writer.
3. **Do NOT lower `totalObs`.** The writer is monotonic and throws on a
   regression — that throw is the intended loud failure. Do not work around it.
4. **Do NOT re-pin the large snapshot test.** If it fails, the denominator moved
   and that is a defect in your change, not an expected update.
5. **Do NOT touch** `computeInPlayCoverage`, the `max(baseline, live)` rule, the
   sweep script, the backdrop, or `assertAllGamesTerminated`.
6. **Do NOT regenerate any other committed artifact** in this packet.
7. **Do NOT quote a live figure in `wiki/dashboard.md`.** Describe the
   mechanism; numbers drift, mechanisms do not.
8. A rebuild MUST NOT be justified by, or used to produce, a better-looking
   headline. The headline is expected to stay at 2.6%.

## Required Comments

- [ ] `// why:` on the re-pinned test — that the seed was rebuilt against the
      post-WP-453 sweep, that `resolvedObs` is unchanged at 37, and that the
      percentage fell only because the denominator became honest. Cite
      D-24370 / D-24050.
- [ ] `// why:` on the new AC-4 invariant test — that it asserts the credit
      behaviour directly so the re-pinned constants above cannot silently stop
      testing anything.

## Files to Produce

| File | New? |
|---|---|
| `apps/dashboard/src/data/in-play-hollow-baseline.json` | regenerated |
| `apps/dashboard/src/composables/useInPlayCoverage.test.ts` | edit (re-pin + new invariant test) |
| `apps/dashboard/src/pages/coverage/CoveragePage.vue` | edit (two subtitles) |
| `wiki/dashboard.md` | edit (mechanism paragraph) |
| `docs/ai/DECISIONS.md` (D-24370) | edit |

Governance close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
`docs/ai/STATUS.md`.

## After Completing

- [ ] Re-run the writer — expect a **byte no-op** (AC-5).
- [ ] `pnpm --filter dashboard test` green; `vue-tsc` clean;
      `pnpm -r --no-bail test` green.
- [ ] Confirm the four numbers: 35 mechanics / 2285 obs / 2.6% headline /
      1.6% re-pin.
- [ ] Land D-24370 **as an explicit amendment to D-24050** — state the rebuild
      trigger, and state the non-goal (never rebuild to move the number).
- [ ] Flip WORK_INDEX `[x]`, EC_INDEX `Done`, mindmap `✅`,
      `pnpm roadmap:counts:write`; STATUS.md.
- [ ] **D-24026 live-verify:** `/coverage` still reads **2.6%** with corrected
      subtitles. An unchanged number is the success condition, not a null result
      — say so explicitly when recording it.
- [ ] Two-commit topology: `EC-596:` implementation, then `SPEC:` governance close.

## Common Failure Smells

- **Treating the unchanged 2.6% as failure.** It is the proof the denominator
  held. The win is that the metric can now rise; it does not rise today.
- **Re-pinning the snapshot test to make things pass.** That masks a moved
  denominator — the one outcome this packet must not produce.
- **Deleting the re-pinned test instead of re-pinning it.** It is the invariant's
  own test; AC-4 strengthens it rather than replacing it.
- **Quoting 2285 or 2.6% in the ewiki.** Both drift on the next sweep change.
- **`git status` noise.** `packages/lagn-spec/schemas/lagn-v1.json` shows ` M`
  from line-ending churn; confirm with `git diff --ignore-cr-at-eol --numstat`
  and `git checkout --` it.
