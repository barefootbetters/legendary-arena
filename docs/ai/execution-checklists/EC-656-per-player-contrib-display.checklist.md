# EC-656 — Endgame Report Card Shows Per-Seat Team Contribution (Execution Checklist)

**Source:** docs/ai/work-packets/WP-621-per-player-contrib-display.md
**Layer:** Client (`apps/arena-client/src/components/hud/EndgameSummary.vue`)

## Before Starting
- [ ] WP-616 on `origin/main`: `PlayerScoringContribution` carries
      `mastermindTacticsDefeated` / `villainsDefeated` / `henchmenDefeated`, and the
      server's jsonb `scoreBreakdown.inputs.perPlayer` carries them to the client.
- [ ] Fresh worktree off `origin/main`; baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 5 code files: `competitionApi.ts`, `scoreCalcDisplay.ts`,
      `EndgameSummary.vue`, `scoreCalcDisplay.test.ts`, `EndgameSummary.test.ts`. Any edit outside → STOP.
- [ ] `pnpm -r build` 0; arena-client suite + `vue-tsc` green.

## Locked Values (do not re-derive)
- Field names match `PlayerScoringContribution` exactly: `mastermindTacticsDefeated`,
  `villainsDefeated`, `henchmenDefeated`.
- Client mirror fields are **optional** (`?: number`); display row is `number | null`,
  mapped `?? null`.

## Guardrails
- **Client display only.** No server / engine / wire-shape change — the fields are
  already on the wire. No hash surface, no migration, no route.
- **Backward-compatible.** A seat with no counts (pre-WP-616 record) or all-zero
  counts renders **no** contribution line — never "0 villains".
- **Singularised.** "1 villain" / "3 villains", "1 henchman" / "2 henchmen",
  "1 mastermind tactic" / "2 mastermind tactics".
- **`// why:`** on the `?? null` mapping (absent counts → line omitted, not a row of zeros).

## Files to Produce
- `apps/arena-client/src/lib/api/competitionApi.ts` — **modified** — 3 optional mirror fields
- `apps/arena-client/src/vfx/scoreCalcDisplay.ts` — **modified** — row type (`number | null`) + `?? null` mapping
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** — `contributionPhrases` helper + dimmed line + style
- `apps/arena-client/src/vfx/scoreCalcDisplay.test.ts` — **modified** — null-when-absent + carries-when-present
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified** — render line (plural/singular/zero-omit) + omits pre-WP-616

## After Completing
- [ ] `pnpm -r build` 0; arena-client suite + `vue-tsc` green (new WP-621 display cases pass).
- [ ] **Live-on-surface (D-24026):** a co-op match report card shows each seat's defeated
      villains / henchmen / tactics beneath its VP. (Component mount tests stand in for a
      staged server-scored game-over the dev fixture route cannot produce.)
- [ ] `git diff --name-only` — the `EC-656:` implementation commit is only the 5 files.
- [ ] STATUS.md updated; DECISIONS.md D-24432 Active; WORK_INDEX WP-621 `[x]`;
      mindmap `📝` → `✅` + `pnpm roadmap:counts:write`.

## Common Failure Smells (Optional)
- A pre-WP-616 record shows "0 villains" → the mapping didn't null-out absent counts, or the `v-if` guard is wrong.
- `vue-tsc` red → the display row type wasn't widened to `number | null`, or a `deepEqual` fixture wasn't updated.
- The team total / raw calc changed → contribution counts leaked into the score (they are display-only).
- A singular count reads "1 villains" → the singularisation branch is missing.
