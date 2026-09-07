# EC-697 — Condition-Clause `[icon:recruit|attack]` Misparse Fix (Execution Checklist)

**Source:** docs/ai/work-packets/WP-660-condition-icon-misparse.md
**Layer:** Game Engine (`packages/game-engine/src/setup/heroAbility.setup.ts`) — parser-only

## Before Starting
- [ ] Baseline `origin/main` @ `a8c5a9df` (after WP-658 merged).
- [ ] Reproduce: probe `buildHeroAbilityHooks` for `wwhk/she-hulk/radioactive-riot` and `hurl-legal-objections` — confirm a phantom `{type:'recruit', magnitude:6}` effect exists.
- [ ] `pnpm -r build` exits 0.

## Locked Values (do not re-derive)
- `CONDITION_ICON_PATTERN = /(?:at least|for every)\s*\d+\s*\[icon:(?:attack|recruit)\]|\d+\s+or more\s+\[icon:(?:attack|recruit)\]/gi`.
- Suppressed range per match: `[iconStart, matchEnd)` where `iconStart = match.index + match[0].lastIndexOf('[icon:')`.
- Overlap rule: `matchStart < range.end && matchEnd > range.start`.
- Guard sites: Step 2b (`iconMagnitudeRegex` loop) and Step 3 (`iconRegex` loop) — skip an icon whose span overlaps a suppressed range.
- Reserved decision: **D-24471** (land Active at close). EC **EC-697**. WP **WP-660**.

## Guardrails
- **Parser-only, one file.** No card-data change; no new `G` field; no `ctx.random`. A change outside `heroAbility.setup.ts` (except tests) ⇒ STOP.
- **Positional, not line-level.** Suppress ONLY the condition icon; a real grant icon elsewhere on the same line ("you get +3[icon:attack]") MUST be kept. Assert it.
- **No false suppression.** A plain grant ("You get +2[icon:recruit]") MUST still emit its effect. Assert it (control test).
- **No hash re-pin expected.** The sentinel game plays none of the affected cards. If a hash test fails ⇒ STOP and investigate (a re-pin here would mean an unexpected sentinel-hero interaction).
- **No derived-artifact regen expected.** The ledger reads `[keyword:X]` markers, not the icon-promoted keyword. Confirm `ledger:heroes:check` / `effect-index:check` / `mechanics:metadata:check` / `sim:runtime-observed:check` stay green with no regen.

## Required `// why:` Comments
- `CONDITION_ICON_PATTERN`: condition icon = threshold, not a grant; names the live bug. D-24471.
- `computeConditionIconRanges` / `overlapsSuppressedRange`: the range = icon→phrase-end; positional overlap. D-24471.
- Step 2b + Step 3 guards: skip a condition-threshold icon so no phantom grant. D-24471.

## Files to Produce
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — `CONDITION_ICON_PATTERN`, the two helpers, the `suppressedIconRanges` computation, the Step 2b/3 overlap guards.
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — 4 WP-660 tests (Radioactive Riot, Jade Giantess, glory-of-asgard grant kept, control not suppressed) + strengthen the WP-658 Hurl Legal Objections test (effects === `[{transform}]`).
- Governance: `NUMBER-LEDGER.md` + `DECISIONS.md` (D-24471) + `WORK_INDEX.md` (WP-660) + `EC_INDEX.md` (this row) + `docs/ai/STATUS.md` + `docs/05-ROADMAP-MINDMAP.md`.

## After Completing
- [ ] `pnpm -r build` → 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` → green (+4 tests; no hash re-pin)
- [ ] `pnpm -r --no-bail test` whole-repo green
- [ ] `ledger:heroes:check` + `effect-index:check` + `mechanics:metadata:check` + `sim:runtime-observed:check` green (no regen)
- [ ] `git diff --name-only` = the file set above and nothing else
- [ ] D-24471 landed Active; WORK_INDEX (WP-660) + STATUS + mindmap updated
- [ ] Follow-ups flagged: gate the co2e/ssw1 recruit-threshold grants; the amwp Ghost mastermind parser
- [ ] **D-24026 operator-pending**: a live She-Hulk match — Radioactive Riot grants no recruit; Hurl Legal Objections transforms clean.

## Execution Result (2026-09-07)
Executed off `origin/main` @ `a8c5a9df`. Probe confirmed the phantom `{recruit:6}` on both She-Hulk cards, then confirmed it removed post-fix (Radioactive Riot → honest hollow; Hurl Legal Objections → `[{transform}]` + gate; glory-of-asgard keeps its +3 attack; the "+2 recruit / +1 attack" control is untouched). `pnpm -r build` 0; engine suite **3087/3087** with NO hash re-pin; whole-repo green; `ledger:heroes:check` / `effect-index:check` / `mechanics:metadata:check` / `sim:runtime-observed:check` all green with no regen. **D-24026 operator-pending.** Pending commit/PR.
