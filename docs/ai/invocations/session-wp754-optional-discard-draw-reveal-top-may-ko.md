# Session Prompt — WP-754 / EC-791: Optional discard-to-draw + reveal-top-may-KO hero keywords

**WP:** docs/ai/work-packets/WP-754-optional-discard-draw-reveal-top-may-ko.md
**EC:** docs/ai/execution-checklists/EC-791-optional-discard-draw-reveal-top-may-ko.checklist.md (authoritative)
**Reserves:** D-24581 (lands Active at govern-close). **Status:** READY TO EXECUTE (pre-flight READY r2, copilot PASS r2, lint PASS — recorded in the WP).

> Committed via `git add -f` (session-*.md is gitignored). Fixes the operator-reported bug in match `a2e01e70`: Gruesome Feast (round 30) and Hungry for Action (round 32) did nothing.

## Invocation intent

Make two printed hero abilities resolve as written:

- "You may discard a card. If you do, draw a card." (`optional-discard-draw`, riding the Smash queue).
- "Reveal the top card of your deck. You may KO it." (`reveal-top-may-ko`, riding the reveal-top-dispose queue).

Wire them through Hungry for Action's Digest 3, Gruesome Feast / Remove His Spine's Excessive Violence, and five standalone cards. Fix the latent fight-move bare-`ctx` throw on an empty-deck EV reshuffle. There is NO new move, queue, prompt, or block-all site.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` (UIState five-step; determinism; moves never throw)
3. `.claude/rules/code-style.md` (RUNTIME drift pins, D-24372)
4. WP-754 (design) → EC-791 (execution contract)
5. Source anchors:
   - `moves/smashDiscard.resolve.ts` + `heroEffectSmash`
   - `moves/revealTopDispose.resolve.ts` + `revealDeckTopForDispose`
   - `fireExcessiveViolencePlays`, `resolveDeferredHeroGrants`, `heroEffectDigestIndigestion`
   - `moves/fightVillain.ts` L109/L258, `moves/fightMastermind.ts` L253
   - `moves/revealThreeAssign.resolve.ts` (draw lock + `cardsDrawn` idiom), `doOver.resolve.ts` L131 (ShuffleProvider idiom)
   - `SmashDiscardPrompt.vue`, `PendingRevealTopDisposePrompt.vue`
6. User memory:
   - `reference_hero_ability_marker_curated_map`
   - `reference_sim_coverage_baseline_gate_distinct`
   - `reference_inplay_totalobs_pin_stale_on_feed_regen` (run `prebuild:coverage` BEFORE the local dashboard test)
   - `reference_fresh_worktree_needs_pnpm_install`
   - `reference_uistate_filter_whitelist_drops_fields`

## Pre-execution checks

- Baseline `origin/main` clean + synced, containing the WP-754 SPEC draft. In a fresh worktree run `pnpm install`, then `pnpm -r build`.
- Record engine, arena-client, dashboard and server test counts. Re-read the pin literals at HEAD: HERO_KEYWORDS 67, handlers 51, moves 44.

## Execution rules (operationalizing WP-754 + EC-791 — no new scope)

- Implement exactly the EC Locked Values:
  - the two keywords (`optional-discard-draw` carries magnitude; `reveal-top-may-ko` is NO_MAGNITUDE);
  - the optional fields `PendingSmashDiscard.reward?` / `RevealedTopEntry.isDiscardAllowed?`, omit-when-absent;
  - the `resolveSmashDiscard` draw branch (draw lock blocks only the draw; `cardsDrawn` delta measured after the discard, just before the draw);
  - the `resolveRevealTopDispose` discard gate.
- `refreshStaleKoOrKeepFront`:
  - It is a new export beside `revealDeckTopForDispose`, and it chains.
  - Call it at the END of `fireExcessiveViolencePlays`, at the END of `resolveDeferredHeroGrants`, and after EVERY `queue.shift()` in `resolveRevealTopDispose`.
  - Each call gets a `// why:`.
- Fight moves take `({ G, ...context })` and pass `context` to `fireExcessiveViolencePlays`. Change nothing else in them.
- `heroEffectRevealTopMayKo` pushes its own entry with the locked log. Do NOT use `parkRevealTopDispose`.
- Bot: a draw-reward entry under `drawsLocked` → `{ decline: true }`.
- Allowlists + comment updates. Retarget the gruesome-feast negative fixture to feast-or-famine.
- Digest-not-met neutral log. Locked tooltip strings.
- Correct the four now-false comments named in the EC.
- UIState five-step for both optional fields. The prompt changes are rendering-only.
- Card data only via 8 markers in `hero-ability-markers.json` + the two token arms + regen:
  - remove the two `_deferred` entries;
  - run `--validate`;
  - never hand-edit `data/cards/*.json`.
- Coverage:
  - regenerate `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:coverage --check` (`--update-baseline` if it moves), and `sim:runtime-observed`;
  - `prebuild:coverage`, then the dashboard in-play pin;
  - two `mechanic-provenance.json` rows.
  - Re-pin honestly; never edit a pin to force green.
- Existing Smash and reveal-top-dispose tests must pass UNEDITED. STOP if any of these happens:
  - a `finalStateHash` sentinel moves;
  - a fused marker yields no inner effect;
  - the parser emits a stray auto-detected effect on any of the eight lines.

## SAFE-KNOBS scope

N/A.

## Session task

Execute WP-754 per EC-791 with the two-commit topology on one branch:

1. The `EC-791:` implementation (the EC allowlist exactly).
2. The `SPEC:` govern-close:
   - land D-24581 Active in DECISIONS (text from the WP's Reserved Decision, including the accepted deviation and the D-24521 amendment);
   - a dated STATUS.md entry;
   - WORK_INDEX `[x]`; EC_INDEX Done;
   - mindmap ✅ + `roadmap:counts:write`;
   - `ledger:numbers:check`.

Open one PR titled with the `EC-791:` prefix.

**D-24026** is operator-manual: in a real match, Gruesome Feast + an EV fight shows KO-or-keep, and Hungry for Action with 3+ Victory Pile cards shows discard-to-draw. Record it; don't claim it until confirmed.

## Post-merge close ritual (REQUIRED)

After the operator merges:

1. `node scripts/prune-empty-claude-branch.mjs --verify-current` (expect `VERIFY PASS`).
2. `git branch -D <branch>` + `git push origin --delete <branch>`.
3. `node scripts/prune-empty-claude-branch.mjs --report` from canonical (expect silent).

## Scope restriction

This prompt restates and operationalizes WP-754 + EC-791 only. It adds no new scope, files, contract elements, locked values or forbidden patterns.
