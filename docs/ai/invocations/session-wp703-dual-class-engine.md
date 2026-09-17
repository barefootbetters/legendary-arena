# Session Prompt — WP-703 / EC-740: Dual-class hero cards (engine)

**WP:** docs/ai/work-packets/WP-703-dual-class-engine.md
**EC:** docs/ai/execution-checklists/EC-740-dual-class-engine.checklist.md (authoritative execution contract)
**Reserves:** D-24523 (lands Active at govern-close). **Status:** READY TO EXECUTE.

> Committed via `git add -f` (override of the `session-*.md` gitignore) so this
> brief is durable and reaches the execution worktree — the WP-703 draft
> worktree that first held it was removed, per
> `feedback_session_prompt_lost_on_worktree_removal`.

## Invocation intent

Make the game engine treat a dual-class hero card as belonging to **both** printed
hero classes (`hc` + `hc2`). The data + registry/viewer already ship `hc2` (D-24522,
on main); this session is the engine half. It is a gameplay/determinism change with
an honest hash/PAR re-pin for matches containing a dual-class hero.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` (Game Engine layer; determinism)
3. `.claude/rules/architecture.md`, `.claude/rules/code-style.md`, `.claude/skills/legendary-game-engine/SKILL.md`
4. WP-703 (design authority)
5. EC-740 (execution contract — satisfy every item exactly)
6. D-24074 (the printed-plus-granted class model you extend), D-24391 (team analogue), D-24522 (the `hc2` data contract), D-24065 (deck-peek — scope-relax only)
7. Source files in the EC "Files to Produce" list.

## Pre-execution checks

- `git rev-parse origin/main` clean + synced; D-24522 Active (`grep D-24522 docs/ai/DECISIONS.md`); `hc2` present at `packages/registry/src/schema.ts`.
- `pnpm --filter @legendary-arena/game-engine build && … test` green; record the baseline test count.
- Read `sizeChanging.logic.ts:62` (`cardHasClassWhenPlayed`) — you EXTEND it, never create a helper.

## Execution rules (operationalizing WP-703 + EC-740 — no new scope)

- **Extend the existing helper** `cardHasClassWhenPlayed(G, cardId, classSlug)` at `sizeChanging.logic.ts:68` with `|| traitEntry.heroClass2 === classSlug` on the printed branch. Signature unchanged. Do NOT create a new helper or file.
- **Contract field**: add `heroClass2?: string | null` to `CardTraitEntry` in `state/cardTraits.types.ts` (contract file, gated by D-24523; match sibling `heroClass: string | null`). Write it in `buildCardTraits.ts` **omit-when-absent** (no key when the card has no `hc2` — never `heroClass2: null`).
- **Reader set** — patch every value-match/membership/enumeration site the EC lists: `heroConditions.evaluate.ts:163/411` (set-add both printed classes), `effectPrimitive.interpret.ts:200/247/322-343`, `giveHqHeroChoice.resolve.ts:92`, `villainDefeatRequirement.logic.ts:71`, `tacticHandlers.ts:780`, `villainEffects.execute.ts:1479`, `dynamicVictoryPoints.ts:52`, the variable-indirection `schemeTwistResolvers.ts:133` + `mastermindHandlers.ts:628`, and the Investigate trio (`heroAbility.types.ts:219` field + `heroEffects.execute.ts:3992` builder + `heroAbility.types.ts:280` matcher). `heroClassMatch` (`heroConditions.evaluate.ts:65`) needs no change (routes through the helper).
- **Audit** with `grep -rn "\.heroClass\b" packages/game-engine/src` (NOT just `=== `); every hit patched OR annotated single-printed-class. Known annotated no-ops: `mastermindHandlers.ts:136/622` (hero-ness null-guards), `ui/uiState.build.ts:190` (display projection), `heroEffects.execute.ts:4034` (log label), comments.
- **Determinism (honest re-pin)** — omit-when-absent → a no-dual-class-hero `finalStateHash` sentinel is byte-identical (prove it + a runtime keyset assertion of key absence, D-24372). Regenerate every oracle/`PRE_WP080_HASH`/PAR (incl. `dynamicVictoryPoints` tech-VP) whose match includes a dual-class hero — a *regenerated correct value* with the cited card, NEVER an edited assertion/snapshot (reward-integrity).
- **Line refs are ±1 / verify-at-HEAD** — locate by symbol, don't re-derive from the numbers.
- Forbidden: new helper; new move/phase/stage/UIState field; changing D-24074 granted-class scoping; routing count sites through the granted-merging helper; `any`/`@ts-ignore`; editing a test to pass.

## SAFE-KNOBS scope

N/A — no knob surface.

## Session task

Execute WP-703 per EC-740: contract field + helper extension + the full reader-set
patch + honest determinism re-pin + tests. Two-commit topology on the branch:
`EC-740:` implementation, then `SPEC:` govern-close (land D-24523 Active citing
D-24074 and scoping the D-24065 deck-peek note; flip WORK_INDEX `[ ]`→`[x]`, EC_INDEX
`Pending`→`Done`, mindmap `📝`→`✅`, `roadmap:counts:write`; `ledger:numbers:check`).
Open one PR; after merge, D-24026 live-verify a real match with a dual-class hero.

## Post-merge close ritual (REQUIRED)

After the operator merges the PR (GitHub UI):
- `node scripts/prune-empty-claude-branch.mjs --verify-current` from inside the worktree (expect `VERIFY PASS`; a FAIL STOPs the ritual).
- `git branch -D <branch>` (local) + `git push origin --delete <branch>` (remote).
- `node scripts/prune-empty-claude-branch.mjs --report` from canonical (expect silent).

## Scope restriction

This prompt restates/operationalizes WP-703 + EC-740 only. It introduces no new
scope, files, contract elements, locked values, or forbidden patterns. Any new
surface goes back into the WP/EC and re-runs the gates from Step 5.
