# Session Prompt — WP-753 / EC-790: Reveal-three assign (draw one / discard one / KO one) hero keyword

**WP:** docs/ai/work-packets/WP-753-reveal-three-assign.md
**EC:** docs/ai/execution-checklists/EC-790-reveal-three-assign.checklist.md (authoritative)
**Reserves:** D-24580 (lands Active at govern-close). **Status:** READY TO EXECUTE (gate verdicts recorded in the WP and the SPEC PR).

> Committed via `git add -f` (session-*.md is gitignored). Fixes the operator-reported bug: Crystal of Kadavus played twice in match `ZIXtvedI6la` with no effect.

## Invocation intent

Make "Reveal the top three cards of your deck. Draw one of them, discard one, and KO one." resolve on Crystal of Kadavus (vnom) and Interplanetary Visitor (3dtc, dims), and make Crystal's "[team:venomverse][team:venomverse]: Do this ability again." repeat it on a fresh top three. Today the lines are unmarked, so the cards give only their printed attack. Engine keyword + pending choice + resolve move + UIState, the client prompt, markers and regenerated card data, coverage artifacts.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` (UIState five-step Board-Visible Field contract; determinism; moves never throw)
3. `.claude/rules/code-style.md` (drift pins are RUNTIME assertions, D-24372; duplicate-first)
4. WP-753 (design) → EC-790 (execution contract)
5. Source anchors: `moves/ruthlessDictatorChoice.resolve.ts` + `rules/tacticHandlers.ts` `resolveRuthlessDictator` (the scry-3 slot model); `moves/revealTopDispose.resolve.ts` + `heroEffectRevealTopDispose` / `heroEffectRevealTopDisposeKo` (hero keyword + park + mutate-the-just-parked-entry precedent); `moves/drawCards.logic.ts` `reshuffleDiscardIntoDeck` (appends — D-24285); `moves/doOver.resolve.ts` L131 (resolve-move `ShuffleProvider`); `endgame/mastermindVictory.logic.ts` (winning-turn drop); `apps/arena-client/src/components/play/PendingRuthlessDictatorChoicePrompt.vue`
6. User memory: `project_reveal_top_dispose_wp702`, `reference_pending_choice_wp_full_file_set`, `project_pending_choice_no_ux_freeze`, `reference_hero_ability_marker_curated_map`, `reference_new_resolve_move_sim_dispatch_lockstep`, `reference_sim_coverage_baseline_gate_distinct`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_fresh_worktree_needs_pnpm_install`

## Pre-execution checks

- Baseline `origin/main` clean + synced, containing the WP-753 SPEC draft. Fresh worktree → `pnpm install`, then `pnpm -r build` (apps import built dist).
- Record engine, arena-client, dashboard and server test counts before editing. Re-read every drift-pin literal at HEAD (EC Locked Values: HERO_KEYWORDS 65, handlers 49, moves 43).

## Execution rules (operationalizing WP-753 + EC-790 — no new scope)

- Implement exactly the EC Locked Values: the two NO_MAGNITUDE keywords, `PendingRevealThreeAssign` + queue, the reveal rule (top up per D-24285; all three dispositions always offered, the entry completing when its cards run out; empty → no park; an entry already queued for the player → bump its `remainingRepeats`, never a second snapshot), the again-handler counter, the resolve move (`front.playerID === playerID`; draw-lock branch; `cardsDrawn += 1` on a realized draw; stale-card drop; the empty check after an applied OR stale step; the repeat re-reveal via the top-up + snapshot steps ONLY — never by calling the handler; server-only), and the bot selector in the resolve file (KO cullable → draw highest-cost → discard → KO).
- Block-all guard at every `hasPendingRevealTopDispose` site + the bot short-circuit; enroll the queue in `dropAllPendingPlayerChoices` + `ALL_PENDING_FIELDS` (winning-turn drop since WP-732 — NOT at vanquish).
- UIState five-step with field `pendingRevealThreeAssign`, chooser-only; the prompt ships in the same commit (freeze prevention).
- Card data only via `hero-ability-markers.json` + `apply-hero-ability-markers.mjs` + regen; `dims` is a new top-level markers key; run `--validate`; never hand-edit `data/cards/*.json`.
- Coverage: regenerate `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:coverage` (`--check`; `--update-baseline` if it moves), `sim:runtime-observed` + the dashboard in-play pin (expected to move). Re-pin honestly; never edit a pin to force green.
- Do NOT touch `PendingRuthlessDictatorChoice`, its resolve move or its prompt. No `finalStateHash` re-pin expected — if a sentinel moves, STOP.
- Session protocol: if Crystal's gate tokens and the again marker cannot share `abilities[1]` without losing the gate, STOP and raise it.

## SAFE-KNOBS scope

N/A.

## Session task

Execute WP-753 per EC-790. Two-commit topology on one branch: `EC-790:` implementation (the EC allowlist exactly), then `SPEC:` govern-close — land D-24580 Active in DECISIONS (decision text from the WP's Reserved Decision, incl. the short-reveal rationale), STATUS.md dated entry, WORK_INDEX `[x]`, EC_INDEX Done, mindmap ✅ + `roadmap:counts:write`, `ledger:numbers:check`. One PR, titled with the `EC-790:` prefix. **D-24026:** operator-manual — a real match plays Crystal of Kadavus (with a Venomverse Hero in play for the second prompt); record, do not claim, until confirmed.

## Post-merge close ritual (REQUIRED)

After the operator merges: `node scripts/prune-empty-claude-branch.mjs --verify-current` (expect `VERIFY PASS`) → `git branch -D <branch>` + `git push origin --delete <branch>` → `node scripts/prune-empty-claude-branch.mjs --report` from canonical (expect silent).

## Scope restriction

Restates/operationalizes WP-753 + EC-790 only. No new scope, files, contract elements, locked values or forbidden patterns.
