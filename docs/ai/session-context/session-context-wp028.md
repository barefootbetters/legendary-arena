WP-027 is complete (commit 29f8038). Key context for WP-030:

- 322 engine tests passing, 87 suites
- 10 moves: drawCards, playCard, revealVillainCard, fightVillain,
  fightMastermind, recruitHero, advanceStage, endTurn, setPlayerReady,
  startMatchIfReady
- Phase 6 (Verification, UI & Production) has begun
- WP-028 and WP-029 are NOT yet complete — WP-030 depends on WP-029
  which depends on WP-028 which depends on WP-027 (serial chain)
- WP-028: UI State Contract (UIState, buildUIState pure function)
- WP-029: Spectator & Permissions View Models (UIAudience, filterUIStateForAudience)
- WP-030: Campaign / Scenario Framework (ScenarioDefinition, CampaignDefinition,
  CampaignState — all data-only, external to engine)

Replay harness exists (WP-027):
- ReplayInput (seed + setupConfig + playerOrder + moves) is Class 2 data
- replayGame() reconstructs games from inputs via buildInitialGameState + MOVE_MAP
- computeStateHash() uses sorted-key JSON + djb2 for canonical state hashing
- verifyDeterminism() runs replay twice, compares hashes
- MVP uses makeMockCtx deterministic reverse-shuffle, NOT seed-faithful replay
- Seed field in ReplayInput stored for future use (D-2704)
- advanceStage replicated via advanceTurnStage since game.ts wrapper not exported (D-2705)
- All replay files in src/replay/ — engine category, no boardgame.io imports
- Campaign replay = sequence of ReplayInput objects (per WP-030 notes)

Setup-time builders use registry: unknown with local structural interfaces:
- buildCardStats, buildVillainDeck, buildMastermindState,
  buildHeroAbilityHooks, buildCardKeywords, buildSchemeSetupInstructions
- All follow the same pattern: local interface + runtime type guard + graceful empty return

Key architectural patterns still in effect:
- D-2601 (Representation Before Execution) — data-only contracts, deterministic executors
- WP-030 key principle: engine never knows about campaigns (D-0501, D-0502)
- CampaignState is Class 2 (Configuration), NOT part of LegendaryGameState
- applyScenarioOverrides produces valid MatchSetupConfig — engine boundary preserved
- ScenarioDefinition and CampaignDefinition are JSON-serializable, no functions

Pre-flight template updated with WP-027 lessons (commit f47c686):
- 4th WP class: Infrastructure & Verification
- Function exportability checks (non-exported functions caught)
- Forbidden import verification (framework bypass patterns)
- New directory classification requirement
- Pre-flight template at docs/ai/REFERENCE/01.4-pre-flight-invocation.md
- Session prompt format: see docs/ai/invocations/session-wp027-replay-harness.md
  or session-wp026-scheme-setup.md as templates

EC and WP files exist for WP-030:
- docs/ai/work-packets/WP-030-campaign-scenario-framework.md
- docs/ai/execution-checklists/EC-030-campaign-framework.checklist.md

Decisions relevant to WP-030:
- D-0002: Determinism Is Non-Negotiable (immutable)
- D-0201: Replay as a First-Class Feature (immutable, implemented by WP-027)
- D-0501, D-0502: Campaign/scenario decisions (referenced by WP-030)
- D-2701 through D-2706: WP-027 implementation decisions

WP-028 is the next unblocked WP. EC and WP files exist:
- docs/ai/work-packets/WP-028-ui-state-contract.md (verify filename)
- docs/ai/execution-checklists/EC-028-ui-state.checklist.md (verify filename)

Run pre-flight for WP-028 next.
