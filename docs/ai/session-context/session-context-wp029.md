WP-028 is complete (commit 6768771). Key context for WP-029:

- 331 engine tests passing, 88 suites
- 10 moves: drawCards, playCard, revealVillainCard, fightVillain,
  fightMastermind, recruitHero, advanceStage, endTurn, setPlayerReady,
  startMatchIfReady
- Phase 6 (Verification, UI & Production) continues
- WP-029 is the next unblocked WP (depends on WP-028, which is complete)
- WP-029: Spectator & Permissions View Models (UIAudience, filterUIStateForAudience)
- WP-030 depends on WP-029 (serial chain: WP-027 -> WP-028 -> WP-029 -> WP-030)

UIState contract exists (WP-028):
- `UIState` interface with 9 sub-types defined in `src/ui/uiState.types.ts`
  - `UIState`, `UIPlayerState`, `UICityCard`, `UICityState`, `UIHQState`,
    `UIMastermindState`, `UISchemeState`, `UITurnEconomyState`, `UIGameOverState`
- `buildUIState(gameState: LegendaryGameState, ctx: UIBuildContext): UIState`
  in `src/ui/uiState.build.ts` — pure function, no boardgame.io import
- `UIBuildContext` is a local structural interface:
  `{ readonly phase: string | null, readonly turn: number, readonly currentPlayer: string }`
- Player zones projected as integer counts (deckCount, handCount, etc.),
  NOT CardExtId[] arrays (D-2802)
- City projected with display-safe `UICityCard { extId, type, keywords }`
- HQ projected as `(string | null)[]` (ext_ids for display lookup)
- Game-over derived via `evaluateEndgame(G)` + `computeFinalScores(G)`
- Twist count derived from villain deck discard card type classification
- Wound count derived via `WOUND_EXT_ID` filtering across all player zones
- Engine internals explicitly excluded from UIState (D-2803):
  hookRegistry, ImplementationMap, cardStats, heroAbilityHooks,
  villainDeckCardTypes, schemeSetupInstructions, registry objects, setup builders
- `buildUIState` is NOT part of the boardgame.io lifecycle — not called
  from game.ts, moves, or phase hooks
- All UI state files are engine category, in `src/ui/` (D-2801)
- All types re-exported from `types.ts` and `index.ts`

WP-029 key principle: D-0302 (Single UIState, Multiple Audiences)
- One authoritative UIState, filtered per audience by `filterUIStateForAudience`
- `filterUIStateForAudience` is a pure post-processing filter on UIState
  (never touches G)
- Active player sees own hand ext_ids, others see counts only
- Spectators see all public zones + hand counts
- Deck order is never revealed to any audience
- Per WORK_INDEX: `UIAudience` type (`player` + `spectator`)

Key architectural patterns still in effect:
- D-0301 (UI Consumes Projections Only) — implemented by WP-028
- D-0302 (Single UIState, Multiple Audiences) — to be implemented by WP-029
- D-2801 (`src/ui/` is engine category) — no boardgame.io, no registry
- D-2802 (Zone Projection as Counts) — player zones are counts, not arrays
- D-2803 (UIState Hides Engine Internals) — canonical forbidden list
- D-2804 (Card Display Resolution Separate) — buildUIState exposes ext_ids only

WP-028 lessons (propagated to 01.4 and 01.6):
- Projection aliasing: always spread-copy mutable G arrays in projections
  (01.6 section 5 is high-risk; 01.4 Established Patterns updated)
- Local structural interface for framework ctx subset: define readonly
  interfaces, do not widen, tests use inline mocks not makeMockCtx
- Lifecycle isolation: non-framework functions must explicitly prohibit
  wiring into game.ts/moves/hooks in session prompt
- Decision ID encoding: DECISIONS.md uses em-dashes, grep needs title fallback
- Contract enforcement tests: frame tests as non-negotiable, not illustrative

Governance updates in this session:
- 01.4 expanded to 9-step workflow (steps 0-8): session context load,
  post-mortem, lessons learned, session context output
- 01.6 created: post-mortem checklist (normative execution gate)
- Session context files moved to `docs/ai/session-context/`
- PRE-COMMIT-REVIEW.template.md updated with 01.3 handoff reference

Files WP-029 will need to read or depend on:
- `packages/game-engine/src/ui/uiState.types.ts` — UIState and all sub-types
  (WP-029 filters UIState, so it must know the full shape)
- `packages/game-engine/src/ui/uiState.build.ts` — buildUIState implementation
  (WP-029's filter consumes its output)
- `packages/game-engine/src/state/zones.types.ts` — PlayerZones, CardExtId
- `packages/game-engine/src/types.ts` — LegendaryGameState (for understanding
  what data is available if WP-029 needs to expose hand ext_ids for active player)
- `packages/game-engine/src/index.ts` — current exports (WP-029 adds new ones)

EC and WP files exist for WP-029:
- docs/ai/work-packets/WP-029-spectator-permissions-view-models.md
- docs/ai/execution-checklists/EC-029-spectator-views.checklist.md

Steps completed for WP-028:
0: session-context-wp028.md (loaded)
1: pre-flight (2026-04-14, READY)
2: session-wp028-ui-state-contract.md (generated)
3: execution (2026-04-14, 331 tests, 0 fail)
4: post-mortem (aliasing fix applied — cardKeywords spread copy)
5: pre-commit review (2026-04-14, safe to commit)
6: commit (6bc2e50 SPEC + 6768771 EC-028, two-commit split)
7: lessons learned (5 new patterns, 2 new DCV checks, 4 new risks, Phase 6 precedent log)
8: this file

Run pre-flight for WP-029 next.
