WP-029 is complete (commit 356a001). Key context for WP-030:

- 340 engine tests passing, 89 suites
- 10 moves: drawCards, playCard, revealVillainCard, fightVillain,
  fightMastermind, recruitHero, advanceStage, endTurn, setPlayerReady,
  startMatchIfReady
- Phase 6 (Verification, UI & Production) continues
- WP-030 is the next unblocked WP (depends on WP-029, which is complete)
- WP-030: Campaign / Scenario Framework (ScenarioDefinition, CampaignDefinition,
  CampaignState, applyScenarioOverrides)
- WP-031 also depends on WP-029 (parallel to WP-030)

UIState + audience filter contract exists (WP-028 + WP-029):
- `UIState` interface with 9 sub-types defined in `src/ui/uiState.types.ts`
- `UIPlayerState` now includes optional `handCards?: string[]` (WP-029)
- `buildUIState(gameState, ctx)` pure function in `src/ui/uiState.build.ts`
  — populates handCards for all players via spread copy
- `UIAudience` discriminated union in `src/ui/uiAudience.types.ts`:
  `{ kind: 'player'; playerId: string } | { kind: 'spectator' }`
- `filterUIStateForAudience(uiState, audience)` pure post-processing filter
  in `src/ui/uiState.filter.ts` — redacts handCards and economy based on
  audience
- Information visibility: active player sees own hand ext_ids + economy;
  non-active players see hand counts only + zeroed economy; spectators
  see hand counts only + zeroed economy
- D-0302 (Single UIState, Multiple Audiences) is now implemented
- Replay viewers use the spectator audience
- All UI state/filter files are engine category (no boardgame.io, no registry)

Key architectural patterns still in effect:
- D-0301 (UI Consumes Projections Only) — implemented by WP-028
- D-0302 (Single UIState, Multiple Audiences) — implemented by WP-029
- D-2801 (`src/ui/` is engine category) — no boardgame.io, no registry
- D-2802 (Zone Projection as Counts) — player zones are counts, not arrays
- D-2803 (UIState Hides Engine Internals) — canonical forbidden list
- D-2804 (Card Display Resolution Separate) — buildUIState exposes ext_ids only
- D-2901 (Filter operates on UIState, not G) — pure post-processing
- D-2902 (handCards optional, populated by buildUIState, redacted by filter)
- D-2903 (Economy zeroed for non-active and spectators)

WP-029 lessons (propagated to 01.4):
- Upstream producer modification for downstream filter: pre-flight must
  verify filter input type contains all data the filter needs to expose
- `exactOptionalPropertyTypes` strictness: use conditional assignment for
  optional fields, not inline ternaries that produce `T | undefined`
- Filter aliasing is lower-risk than projection aliasing (operates on
  UIState, not G)
- Top-level field redaction by audience: zero values instead of optional

WP-030 key principle: D-0501 / D-0502 (campaigns external to engine)
- ScenarioDefinition, CampaignDefinition, CampaignState are all data-only
- Engine never knows about campaigns
- applyScenarioOverrides produces a valid MatchSetupConfig
- CampaignState is Class 2 (Configuration), NOT part of LegendaryGameState
- No engine modifications expected

Files WP-030 will need to read or depend on:
- `packages/game-engine/src/matchSetup.types.ts` — MatchSetupConfig (9 locked fields)
- `packages/game-engine/src/replay/replay.types.ts` — ReplayInput (campaign replay)
- `packages/game-engine/src/ui/uiState.types.ts` — UIState (campaign UI may consume)
- `packages/game-engine/src/index.ts` — current exports
- `docs/ai/ARCHITECTURE.md` — persistence classes, layer boundaries

EC and WP files exist for WP-030:
- docs/ai/work-packets/WP-030-campaign-scenario-framework.md (if exists)
- docs/ai/execution-checklists/EC-030-*.checklist.md (if exists)

Steps completed for WP-029:
0: session-context-wp029.md (loaded)
1: pre-flight (2026-04-14, READY — conditional on scope fix)
2: session-wp029-spectator-views.md (generated)
3: execution (2026-04-14, 340 tests, 0 fail)
4: post-mortem (clean — no code fixes needed)
5: pre-commit review (2026-04-14, safe to commit)
6: commit (da33fac SPEC + 356a001 EC-029, two-commit split)
7: lessons learned (5 new patterns, 1 new DCV check, 2 new risks,
   2 new precedent log entries)
8: this file

Run pre-flight for WP-030 next.
