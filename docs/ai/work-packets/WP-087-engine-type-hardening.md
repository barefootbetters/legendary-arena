# WP-087 — Engine Type Hardening: `PlayerId` Alias + Setup-Only Array `readonly`

> **Status: READY TO EXECUTE** (A0 pre-flight bundle landed 2026-04-23;
> registered in `WORK_INDEX.md` and `EC_INDEX.md`; 00.3 lint gate PASS
> — see [preflight-wp087-engine-type-hardening.md](../invocations/preflight-wp087-engine-type-hardening.md)).
>
> **Gating resolved:**
> (a) WP-049 is merged to `main` at `956306c` (followed by WP-050 `0bf9020`
>     and WP-051 `372bf71`, neither of which collides with the type files
>     in scope).
> (b) WP-087 registered in `WORK_INDEX.md` under Gameplay phase with
>     dependency on WP-049.
> (c) 00.3 Prompt Lint Gate run 2026-04-23, verdict PASS (four NON-BLOCKING
>     PS findings all resolved in the A0 bundle: grep-pattern narrowing
>     PS-1, index registrations PS-2, session-context HEAD reconciliation
>     PS-3, Appendix A confirmations PS-4).
>
> **WP number confirmed:** `WP-086` remains memory-reserved for the registry
> viewer card-types upgrade (blocked on WP-084). `WP-087` retains its number.
>
> **EC-087 confirmed retained** (Appendix A question #2 resolved): the
> already-drafted EC-087 is registered as `Draft` in `EC_INDEX.md` and
> will flip to `Done` on completion. A type-only change does not strictly
> require an EC but retaining one preserves executor guardrails (Before
> Starting baseline capture, Locked Values, Guardrails, After Completing
> checks) consistent with the EC-049/EC-050/EC-051 precedent.
>
> **`PlayerId` is non-branded** (Appendix A question #3 resolved):
> plain `string` alias. Branding is explicitly deferred — see
> `docs/ai/session-context/session-context-wp087.md` §3.2.

## Goal

Introduce a canonical `PlayerId` type alias and apply `readonly` modifiers to
the three `LegendaryGameState` array fields that are provably setup-only
(`hookRegistry`, `schemeSetupInstructions`, `heroAbilityHooks`). Purely a
type-contract tightening — zero runtime behavior change, with a small,
explicitly enumerated set of downstream signature updates, and zero
move-handler touches.

## Assumes
- WP-049 complete (merged to `main`). This WP must not start while WP-049 is
  in flight.
- A grep for `hookRegistry`, `schemeSetupInstructions`, and `heroAbilityHooks`
  assignments outside setup-time factories returns zero production hits
  (tests are tracked separately under Scope). This invariant is re-validated
  as part of acceptance.
- No existing `PlayerId` / `PlayerKey` symbol in `packages/**` (pre-verified
  on branch `wp-049-par-simulation-engine`; re-verify at execution time in
  case intervening WPs introduced one).
- boardgame.io 0.50.x player-ID convention (`"0" | "1" | ...`) remains locked
  per `.claude/rules/game-engine.md` §boardgame.io Version.

## Context (Read First)
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative)
- `docs/ai/ARCHITECTURE.md` §Persistence Boundaries
- `.claude/rules/game-engine.md` §Game State — G, §Key G Fields, §Throwing Convention
- `.claude/rules/code-style.md` §Data Contracts, §Patterns to Avoid
- `docs/ai/REFERENCE/00.2-data-requirements.md` §8.1 (MatchSetupConfig field lock)
- `docs/ai/DECISIONS.md` (scan for prior decisions touching player-ID typing,
  `LegendaryGameState` shape, or G-field immutability)

## Vision Alignment

**Vision clauses touched:** `§3, §11`.

**Conflict assertion:** No conflict: this WP preserves all touched clauses.
`PlayerId` is a type alias that names the existing boardgame.io
`"0" | "1" | "2" | ...` string identifiers already used throughout the
engine; it introduces no new semantics, no new runtime behavior, and no
change to player-identity flow, ownership, or visibility. Zero-behavior-
change refactor — purely a type-contract tightening per §17.3 "purely
structural" treatment.

**Non-Goal proximity check:** Not applicable — WP is not user-facing,
not paid, not persuasive, not competitive; `NG-1..7` are not crossed.

## Scope (In)
- Add `export type PlayerId = string;` to `packages/game-engine/src/types.ts`
  with a `// why:` comment citing the boardgame.io `"0" | "1" | ...` string
  convention.
- Replace `Record<string, PlayerZones>` with `Record<PlayerId, PlayerZones>`
  in exactly two canonical sites:
  - `packages/game-engine/src/types.ts` (`LegendaryGameState.playerZones`)
  - `packages/game-engine/src/state/zones.types.ts` (`GameStateShape.playerZones`)
- Replace `Record<string, string>` with `Record<PlayerId, string>` in
  `packages/game-engine/src/persistence/persistence.types.ts`
  (`MatchSnapshot.playerNames`).
- Apply `readonly` on three `LegendaryGameState` array fields:
  - `hookRegistry: readonly HookDefinition[]`
  - `schemeSetupInstructions: readonly SchemeSetupInstruction[]`
  - `heroAbilityHooks: readonly HeroAbilityHook[]`
- Update the sole non-setup mutation site
  (`packages/game-engine/src/rules/ruleRuntime.ordering.test.ts:56`) to
  construct `hookRegistry` at factory time, preserving test intent while
  satisfying the strengthened immutability contract.
- Add JSDoc on `PlayerId` clarifying that it is a non-branded string alias
  and that the value space matches boardgame.io's player-index strings.

## Out of Scope
- **Any other `types.ts` refactor.** No file split (e.g., `types.exports.ts` /
  `types.core.ts`). No barrel re-export reordering. No JSDoc touch-ups on
  unrelated fields.
- **Match setup contract types** — specifically `MatchSetupConfig`,
  `MatchSetupError`, and `ValidateMatchSetupResult` in
  `packages/game-engine/src/matchSetup.types.ts`. These contracts operate
  strictly pre-engine and pre-player-instantiation and contain no
  player-keyed fields. In particular, `heroDeckIds` is a pool of chosen
  hero decks that get shuffled together into one communal recruit deck
  (Legendary's standard mechanic); `heroDeckIds.length` is decoupled from
  `numPlayers` and `heroDeckIds[N]` is not "player N's deck". There is no
  latent `PlayerId` relationship to formalize in these types. WP-087 does
  not modify match setup payload shape, field ordering, validation
  semantics, or any setup-time contracts. 00.2 §8.1 field-lock is not
  reopened.
- **Branded `PlayerId`** (e.g., `string & { __brand }` or `` `${number}` ``).
  Deferred — would ripple into every test factory.
- **`readonly` on `messages`, `counters`, `playerZones`, `piles`, `cardStats`,
  `cardKeywords`, `villainDeckCardTypes`, `attachedBystanders`.** These are
  mutated by moves or by runtime effects; not in scope for this packet.
- **`Readonly<Record<...>>` wrapping** on lookup tables. Separate consideration;
  deferred.
- **UI state types** (e.g., `UIPlayerState` record keys). Separate layer;
  deferred.
- **Any move, phase, endgame, setup, or effect-application logic change.**
- **Any change to serialization shape, replay snapshots, persistence format,
  or network payloads.** Even though TypeScript types change, wire and stored
  data do not.
- **`WORK_INDEX.md` status moves on other WPs.**

## Files Expected to Change
- `packages/game-engine/src/types.ts` — modified — add `PlayerId` alias; apply
  `readonly` to three arrays; swap `string` → `PlayerId` in one `Record` key.
- `packages/game-engine/src/state/zones.types.ts` — modified — swap
  `Record<string, PlayerZones>` key to `PlayerId`; import the alias.
- `packages/game-engine/src/persistence/persistence.types.ts` — modified —
  swap `playerNames` key to `PlayerId`; import the alias.
- `packages/game-engine/src/rules/ruleRuntime.ordering.test.ts` — modified —
  replace the post-construction `hookRegistry` assignment with factory-time
  construction.
- `docs/ai/DECISIONS.md` — append a D-NNNN entry recording:
  - why `PlayerId` is introduced as a simple alias (not branded),
  - why only the three setup-only arrays were made `readonly`,
  - why broader `readonly` propagation (messages, counters, lookup
    tables, UI state) was explicitly deferred,
  - a one-line cross-reference noting that `PlayerId` does not apply
    to setup contracts (`MatchSetupConfig` and siblings) because those
    types operate pre-engine and pre-player-instantiation,
  - and a record of the `heroDeckIds` pool semantic: it is a
    communal-recruit-deck source whose length is decoupled from
    `numPlayers` and whose indices do not correspond to player seats.
    Any future WP proposing a per-seat hero-deck assignment must
    explicitly override this decision.
- `docs/ai/work-packets/WORK_INDEX.md` — check off WP-087 on completion.
- `docs/ai/STATUS.md` — one-line note that type hardening landed.

## Non-Negotiable Constraints

**Engine-wide:**
- Full file contents required for every new or modified file — no diffs,
  no snippets, no "show only the changed section".
- ESM only, Node v22+.
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- No new runtime imports in production code.
- `pnpm -r build` and `pnpm test` both pass with zero new warnings and an
  identical test count to the pre-change baseline.

**Packet-specific:**
- Type-only change set. No runtime behavior change.
- No file outside `## Files Expected to Change` is touched.
- No changes to move handlers, phase hooks, `Game.setup()` logic, or any
  serialization / replay / snapshot producer.
- `PlayerId` remains a non-branded `string` alias — no
  `string & { __brand }`, no `` `${number}` ``.
- `readonly` is applied only to the three enumerated `LegendaryGameState`
  array fields; no other field is made `readonly` in this packet.

**Session protocol:**
- Stop and ask before proceeding if any unclear item is encountered.
- If a TS error appears in a file not listed under
  `## Files Expected to Change`, stop — that is a generic-ripple signal,
  and the fix belongs in a separate WP.
- If the test count drifts from the pre-change baseline, stop.

**Locked contract values:**
- Alias declaration (verbatim): `export type PlayerId = string;`
- Three `LegendaryGameState` fields receiving `readonly`: `hookRegistry`,
  `schemeSetupInstructions`, `heroAbilityHooks`.
- Three `Record` keys changing `string` → `PlayerId`:
  - `LegendaryGameState.playerZones` in
    `packages/game-engine/src/types.ts`
  - `GameStateShape.playerZones` in
    `packages/game-engine/src/state/zones.types.ts`
  - `MatchSnapshot.playerNames` in
    `packages/game-engine/src/persistence/persistence.types.ts`
- Sole non-setup mutation site being fixed:
  `packages/game-engine/src/rules/ruleRuntime.ordering.test.ts:56`.

## Acceptance Criteria
- [ ] `packages/game-engine/src/types.ts` exports `PlayerId` as a `string`
      alias with a `// why:` comment referencing the boardgame.io player-ID
      convention.
- [ ] `LegendaryGameState.playerZones` is typed `Record<PlayerId, PlayerZones>`.
- [ ] All three setup-only array fields on `LegendaryGameState` are typed
      `readonly`: `hookRegistry: readonly HookDefinition[]`,
      `schemeSetupInstructions: readonly SchemeSetupInstruction[]`,
      `heroAbilityHooks: readonly HeroAbilityHook[]`.
- [ ] `GameStateShape.playerZones` in `zones.types.ts` uses `PlayerId`.
- [ ] `MatchSnapshot.playerNames` uses `PlayerId`.
- [ ] `ruleRuntime.ordering.test.ts` no longer assigns to `G.hookRegistry`
      post-construction.
- [ ] `pnpm -r build` and `pnpm test` both pass with zero new TS errors,
      zero new warnings, and identical test count to the pre-change
      baseline.
- [ ] No file outside `## Files Expected to Change` was modified to satisfy
      the type change (negative guarantee: widening generic ripple is not
      acceptable, and fixing unrelated type debt is not allowed in this WP).
- [ ] `docs/ai/DECISIONS.md` contains a new D-NNNN entry covering the three
      rationale points listed under `## Files Expected to Change`.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` shows WP-087 checked off with a
      completion date.

## Verification Steps

```pwsh
# 1. Full build — must pass with zero errors.
pnpm -r build
# Expected: all packages build; zero TS errors.

# 2. Full test suite — must match pre-change count.
pnpm test
# Expected: full suite green; test count matches pre-change baseline.

# 3. Type-only check on the engine package — confirms readonly propagation
#    is sound and no unlisted file needed a type change.
pnpm --filter game-engine exec tsc --noEmit
# Expected: zero errors.

# 4. Invariant re-check: no post-setup assignments to the three readonly
#    arrays anywhere in production code. Pattern is narrowed to require
#    a "G." or "gameState." qualifier so setup-time local-variable
#    declarations (e.g., `const schemeSetupInstructions = buildSchemeSetup…`
#    in `buildInitialGameState.ts`) do not false-positive. See pre-flight
#    PS-1 resolution in `docs/ai/invocations/preflight-wp087-engine-type-hardening.md`.
Select-String -Path "packages/game-engine/src/**/*.ts" `
  -Pattern "(G|gameState)\.(hookRegistry|schemeSetupInstructions|heroAbilityHooks)\s*(=|\.push|\.pop|\.splice|\.shift|\.unshift)" `
  -Exclude "*.test.ts"
# Expected: no matches.
```

## Definition of Done
This packet is complete when ALL of the following are true:
- [ ] All acceptance criteria pass.
- [ ] `docs/ai/STATUS.md` updated with what changed (one line).
- [ ] `docs/ai/DECISIONS.md` updated with the D-NNNN entry described above.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has this packet checked off with a
      completion date.
- [ ] No files outside `## Files Expected to Change` were modified.

---

## Appendix A — Prompt Lint Gate Self-Check (superseded)

> **Status: SUPERSEDED by full 00.3 lint pass at A0 pre-flight (2026-04-23).**
> See [preflight-wp087-engine-type-hardening.md](../invocations/preflight-wp087-engine-type-hardening.md)
> for the authoritative lint-gate verdict and PS-1..PS-4 resolutions.
> The self-check below is preserved for historical record of the drafting
> session.

This self-check is preliminary and does not replace the full 00.3 lint pass,
which must run at the time of `WORK_INDEX.md` registration (after WP-049
lands). Per CLAUDE.md, unmet or deferred items are listed here for explicit
human approval before execution.

**Satisfied on draft:**
- §1 Work Packet Structure — all required sections present, including
  the dedicated `## Non-Negotiable Constraints` block.
- §2 Non-Negotiable Constraints Block — Engine-wide / Packet-specific /
  Session protocol / Locked contract values sub-bullets match
  `PACKET-TEMPLATE.md` structure; full-file-output requirement and
  `00.6-code-style.md` reference both present.
- §3 Prerequisites — `## Assumes` lists WP-049 gating, grep-based invariant,
  and boardgame.io version lock.
- §4 Context References — specific sections cited, not vague "read the docs".
- §5 Output Completeness — every modified file enumerated with a one-line
  description.
- §6 Naming Consistency — `PlayerId` chosen and used consistently; no
  abbreviations.
- §7 Dependency Discipline — WP-049 dependency called out; no forbidden
  cross-layer imports introduced.
- §8 Architectural Boundaries — Game Engine layer only; no registry /
  server / preplan touches.
- §9 Windows Compatibility — verification uses `pwsh` and PowerShell cmdlets
  (`Select-String`), not Unix tools.
- §13 Commands and Verification — exact commands with expected output.
- §14 Acceptance Criteria Quality — 10 items; all binary, observable,
  specific; includes a negative guarantee (§14 best practice).
- §15 Definition of Done — includes STATUS, DECISIONS, WORK_INDEX, and file
  boundary check.
- §16 Code Style — no premature abstraction; `PlayerId` introduced only
  because it is canonical and reused across three files.
- §17 Vision Alignment — `## Vision Alignment` section cites `§3, §11`
  with explicit "No conflict" assertion and §17.3 purely-structural
  justification; Non-Goal proximity check addressed.

**Deferred pending registration:**
- §18 Prose-vs-Grep Discipline — re-verify that every mechanical claim in
  `## Assumes` is tied to a re-runnable grep.
- §19 Bridge-vs-HEAD Staleness — confirm at registration time that the
  cited line reference (`ruleRuntime.ordering.test.ts:56`) still points to
  the post-setup `hookRegistry` assignment.

**Explicit requests for human approval:**
1. Confirm `WP-087` as the final number, or renumber if `WP-086` lands first.
2. Confirm that no Execution Checklist (EC) is required for this WP. This
   change does not require an EC by default given its type-only scope.
   Flag if an EC is wanted; default is none. (Note: an EC-087 draft already
   exists on disk at
   `docs/ai/execution-checklists/EC-087-engine-type-hardening.checklist.md`;
   if the default is reaffirmed, the EC can be removed rather than
   registered.)
3. Confirm that `PlayerId` remains a non-branded `string` alias. If a
   branded variant is preferred, rescope before lint pass.
