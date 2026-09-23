# Session Prompt — WP-746 / EC-783: Excessive Violence fire feel-beat (notable event + frame log + swords-burst VFX)

**WP:** docs/ai/work-packets/WP-746-excessive-violence-fire-feel-beat.md
**EC:** docs/ai/execution-checklists/EC-783-excessive-violence-fire-feel-beat.checklist.md (authoritative)
**Reserves:** D-24569 (lands Active at govern-close). **Status:** READY TO EXECUTE (lint PASS r2; gate verdicts recorded in the SPEC PR).

> Committed via `git add -f` (session-*.md is gitignored). Closes the visible-payoff gap on the shipped Excessive Violence arc (WP-736 mechanic → WP-739 signal → WP-738 control → this feel-beat).

## Invocation intent

Make the WP-736 Excessive Violence FIRE observable: a distinct game-log frame beat, a new `excessiveViolenceFired` notable event, and a red crossed-swords slash-burst VFX. Today `fireExcessiveViolencePlays` drains the EV ledger silently (each inner effect logs on its own; the +1-overspend MOMENT raises nothing), so the payoff reads as "nothing happened" (operator-confirmed 2026-09-22). Engine emission + client VFX + ewiki entry. Presentation-only — no rules, VP, PAR, standing, or determinism change on any core trajectory.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` (layer boundaries; determinism; the `UIState.notableEvents` projection is already PUBLIC + unconditional per D-12803 → a new event TYPE needs NO new Board-Visible Field 5-step)
3. `.claude/rules/code-style.md` (canonical-array drift lockstep; engine test drift pins are RUNTIME assertions per WP-563 / D-24372)
4. WP-746 (design) → EC-783 (execution contract)
5. Source anchors: `packages/game-engine/src/events/notableEvents.types.ts` (`NotableGameEventType` union + `NOTABLE_EVENT_TYPES` @ ~:81 + the event interfaces), `.../events/notableEvents.compose.ts` (pure narrative composers), `.../hero/heroEffects.execute.ts` (~:1780 the `heroEffectResolved` guarded-emission precedent to MIRROR EXACTLY + the `fireExcessiveViolencePlays` driver), `apps/arena-client/src/composables/useStrikeBlockedVfx.ts` + `.../vfx/strikeBlockedVfxManifest.ts` + `.../components/play/VfxOverlay.vue` (the notable-event-driven VFX template)
6. User memory: `reference_notable_event_addition_lockstep`, `reference_notable_event_sfx_asset_pipeline`, `reference_hashed_g_field_dual_repin`, `reference_confetti_options_unobservable_in_jsdom`, `project_design_system_feel_layer`, `project_excessive_violence_arc`

## Pre-execution checks

- Baseline `origin/main` clean + synced; WP-736 + WP-738 + WP-739 + the WP-746 reserve on main.
- `pnpm -r build` so dist is fresh before any cross-package test.

## Execution rules (operationalizing WP-746 + EC-783 — no new scope)

- **Type:** add `'excessiveViolenceFired'` to the `NotableGameEventType` union AND `NOTABLE_EVENT_TYPES` AND the `notableEvents.types.test.ts` drift assertion (runtime keyset); add `ExcessiveViolenceFiredEvent { type; playerId; narrative }` (card-less, D-20001) to the `NotableGameEvent` union.
- **Composer:** pure `composeExcessiveViolenceFiredNarrative(playerLabel, firedCount)` (singular/plural), no `ctx`/I/O.
- **Emit:** in `fireExcessiveViolencePlays`, when ≥1 EV ability fired, push exactly ONE `excessiveViolenceFired` event (guarded on `Array.isArray(G.notableEvents)` — MIRROR the heroEffectResolved guard) + ONE distinct frame `pushLog`; zero fired ⇒ emit nothing; inner-effect dispatch unchanged.
- **Client:** new `excessiveViolenceVfxManifest` (distinct crimson/steel palette; particle count ≤ 200 WP-556 ceiling; word "EXCESSIVE VIOLENCE"; no committed bytes) + `useExcessiveViolenceVfx` watching `UIState.notableEvents` for a new `excessiveViolenceFired` entry (mirror `useStrikeBlockedVfx`) wired into `VfxOverlay.vue`.
- **ewiki:** `wiki/visual-effects.md` (+ `ewiki/visual-effects/` source) gains the Excessive Violence entry (trigger, palette, tier).
- **Guardrails:** display-only/off-ranking (NG-1); the client learns of the fire ONLY from the notable event, never the WP-739 availability field; confetti unobservable in jsdom → assert MANIFEST spec + injected trigger seam, never rendered particles (WP-647).
- **Determinism:** `G.notableEvents` IS hashed, but EV is vnom-only and the core sentinel + PRE_WP080 replay play no EV card → both pinned hashes expected byte-unchanged (VERIFY; the WP-697 outcome). If a pin shifts, dual re-pin HONESTLY (record-game-fixture sentinel + `PRE_WP080_HASH`) — never edit a pin to force green, never re-route the event off the hashed channel.
- **Lockstep watch:** if the notable-event SFX manifest gate flags the new type, add the minimal manifest row to pass it (audio asset = named follow-up).

## SAFE-KNOBS scope

N/A.

## Session task

Execute WP-746 per EC-783: type + composer + guarded emission + client manifest/composable/overlay + ewiki entry + tests. Build engine first (client imports dist). Two-commit topology: `EC-783:` impl, then `SPEC:` govern-close (land D-24569 Active; WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅, `roadmap:counts:write`, `ledger:numbers:check`; STATUS.md with a dated `### WP-746 (YYYY-MM-DD)` heading). One PR. **D-24026:** operator-manual — seated match, Fight using Excessive Violence, observe the burst + frame log on play.legendary-arena.com; record, do not claim, until confirmed.

## Post-merge close ritual (REQUIRED)

After merge: `node scripts/prune-empty-claude-branch.mjs --verify-current` (expect `VERIFY PASS`) → `git branch -D <branch>` + `git push origin --delete <branch>` → `--report` from canonical (silent).

## Scope restriction

Restates/operationalizes WP-746 + EC-783 only. No new scope/files/contract/locked-values/forbidden-patterns.
