# Legendary Arena -- Development Roadmap (Mindmap)

> **Checklist rule (hard):** one line per item; status-first; no subordinate clauses; no file lists / commit hashes / decisions / dependency prose. If the line forces the reader to *read* before answering "done / drafted / blocked", it's still wrong.
>
> **Status vocabulary (closed set):**
> `✅ Done` · `🚧 In Progress` · `📝 Drafted` (WP file authored; awaiting execution) · `📦 Queued` (deps met; WP file not yet authored) · `⏸ Blocked` (dep unmet) · `📝 Placeholder` (forward-looking only).
>
> All audit detail (per-WP file lists, commit hashes, decision IDs, baselines, deltas, post-mortems) lives in `docs/ai/work-packets/WORK_INDEX.md`, the per-WP files under `docs/ai/work-packets/`, and `docs/ai/STATUS.md`. This file is navigation — not a record.

```mermaid
mindmap
  root((Legendary Arena))
    ["Multiplayer Deck-Builder\nboardgame.io + TypeScript + R2"]

      Foundation
        ["FP-00.4 ✅ Environment check"]
        ["FP-00.5 ✅ R2 validation"]
        ["FP-01 ✅ Backend hosting"]
        ["FP-02 ✅ Database migrations"]

      Phase 0 — Coordination
        ["WP-001 ✅ Coordination system"]
        ["WP-002 ✅ Game skeleton"]
        ["WP-003 ✅ Card registry"]
        ["WP-004 ✅ Server bootstrap"]
        ["WP-043..047 ✅ Governance alignment"]

      Phase 1 — Game Setup
        ["WP-005A/B ✅ Deterministic match setup"]
        ["WP-006A/B ✅ Player zones and piles"]

      Phase 2 — Core Turn Engine
        ["WP-007A/B ✅ Turn structure and loop"]
        ["WP-008A ✅ Core move contracts"]
        ["WP-008B ✅ Core move implementation"]
        ["WP-236 ✅ Engine-authoritative start-of-turn draw (auto-draw + once-per-turn guard)"]

      Phase 3 — MVP Multiplayer
        ["WP-009A/B ✅ Rule hooks and execution"]
        ["WP-010 ✅ Victory and loss"]
        ["WP-011 ✅ Lobby flow"]
        ["WP-012 ✅ Match list and join"]
        ["WP-013 ✅ Persistence boundaries"]

      Phase 4 — Core Gameplay Loop
        ["WP-014A/B ✅ Villain deck and reveal"]
        ["WP-015 ✅ City and HQ zones"]
        ["WP-015A ✅ Reveal safety fixes (stage gate + no-card-drop)"]
        ["WP-016 ✅ Fight and recruit"]
        ["WP-017 ✅ KO, wounds, bystanders"]
        ["WP-018 ✅ Attack / recruit economy"]
        ["WP-019 ✅ Mastermind and tactics"]
        ["WP-020 ✅ VP scoring and summary"]

      Phase 5 — Card Mechanics
        ["WP-021 ✅ Hero hooks"]
        ["WP-022 ✅ Hero keywords"]
        ["WP-023 ✅ Conditional effects"]
        ["WP-024 ✅ Scheme / mastermind execution"]
        ["WP-025 ✅ Board keywords"]
        ["WP-026 ✅ Scheme setup"]
        ["WP-182 ✅ Scheme twist resolver framework (engine)"]

      Phase 6 — Verification & Production
        ["✅ Phase-6 closed (tag phase-6-complete)"]
        ["WP-027 ✅ Replay harness"]
        ["WP-028 ✅ UIState contract"]
        ["WP-029 ✅ Spectator permissions"]
        ["WP-030 ✅ Campaign framework"]
        ["WP-031 ✅ Production hardening"]
        ["WP-032 ✅ Network sync"]
        ["WP-033 ✅ Content authoring toolkit"]
        ["WP-034 ✅ Versioning and save migration"]
        ["WP-035 ✅ Release and ops playbook"]
        ["WP-042 ✅ Deployment checklists"]
        ["WP-066 ✅ Registry image/data toggle"]
        ["WP-067 ✅ UIState PAR projection"]
        ["WP-079 ✅ Determinism-only replay labeling"]
        ["WP-080 ✅ Step-level replay API"]
        ["WP-048..051 ✅ PAR pipeline (see Scoring & PAR)"]

      UI Implementation Chain
        ["WP-065 ✅ Vue SFC test transform"]
        ["WP-061 ✅ Gameplay client bootstrap"]
        ["WP-062 ✅ Arena HUD and scoreboard"]
        ["WP-063 ✅ Replay snapshot producer"]
        ["WP-064 ✅ Game log and replay inspector"]

      Content Layer
        ["WP-055 ✅ Theme data model"]
        ["WP-060 ✅ Glossary R2 migration"]
        ["WP-221 ✅ Theme supplemental setup fields + tips display"]

      Pre-Planning System
        ["WP-056 ✅ State model and lifecycle"]
        ["WP-057 ✅ Sandbox execution"]
        ["WP-058 ✅ Disruption pipeline"]
        ["WP-059 ✅ UI integration"]
        ["WP-070 ✅ Done — live mutation middleware"]

      Post-Phase-6 Hygiene
        ["WP-081 ✅ Registry build pipeline cleanup"]
        ["WP-082 ✅ Glossary schema and labels"]
        ["WP-083 ✅ Fetch-time schema validation"]
        ["WP-084 ✅ Auxiliary metadata deletion"]
        ["WP-085 ✅ Vision alignment audit"]

      Phase 7 — Beta, Launch & PAR
        ["WP-036 ✅ AI playtesting and balance simulation"]
        ["WP-037 ✅ Public beta strategy"]
        ["WP-038 ✅ Launch readiness checklist"]
        ["WP-039 ✅ Live ops framework"]
        ["WP-040 ✅ Change governance and budget"]
        ["WP-041 ✅ System architecture definition"]

      Scoring & PAR Pipeline
        ["WP-048 ✅ PAR scenario scoring and leaderboards"]
        ["WP-049 ✅ PAR simulation engine"]
        ["WP-050 ✅ PAR artifact storage and indexing"]
        ["WP-051 ✅ PAR publication and server gate"]
        ["WP-365 ✅ final-score VP by printed card VP; flat table demoted to fallback (live capture matchId sGTM7LWSIHy 2026-07-12 — victory pile Super-Skrull vp2 + Skrull-Shapeshifters vp2 + Juggernaut vp4 = printed 8 reported as villainVP 3, total 45 vs correct 50; root cause: computeFinalScores WP-020 uses flat VP_VILLAIN=VP_HENCHMAN=1/VP_TACTIC=5 and never reads printed vp — G.cardStats carries attack/recruit/cost/fightCost but NOT vp, registry VillainCardSchema.vp/MastermindSchema.vp never plumbed into G; also feeds parScoring.logic → can crown the wrong multiplayer winner; adds immutable setup snapshot G.cardVictoryPoints sibling to cardStats built in buildInitialGameState via total/defensive normalizePrintedVictoryPoints nullable string|number null/NaN/non-int→omit, computeFinalScores reads G.cardVictoryPoints[cardId] ?? VP_<category> per villain/henchman + tacticVP = tacticsDefeated × (mastermind vp ?? VP_TACTIC), flat constants DEMOTED to fallbacks values unchanged so null-vp cards score sanely; bystander stays 1 wound stays −1, PlayerScoreBreakdown shape/field-names unchanged value-only no consumer break; determinism conditional-spread/omit-when-empty per WP-290 → EMPTY_REGISTRY fixtures byte-identical sentinel re-pin execution-measured expected none; out of scope: no retro-rescore of historical DB rows, no PAR-weight change, no registry-schema change; standard two-session lane §6 scoring/competitive exclusion; executed 2026-07-12 via a dedicated setup/buildCardVictoryPoints.ts (economy/mastermind/CardStatEntry byte-unchanged — concurrency-safe amendment of the inline draft); engine 1893/441/0, sim:coverage sentinel unchanged; EC-392; D-24157 Active)"]

      Beta-Launch Pillar
        ["WP-052 ✅ Player identity and replay ownership"]
        ["WP-053a ✅ PAR artifact carries scoring config"]
        ["WP-053 ✅ Competitive score submission"]
        ["WP-054 ✅ Public leaderboards library"]
        ["WP-103 ✅ Replay storage and loader"]

      Engine Hardening
        ["WP-087 ✅ Engine type hardening"]
        ["WP-088 ✅ Setup module hardening"]

      Client Integration Cluster
        ["WP-089 ✅ Engine PlayerView wiring"]
        ["WP-090 ✅ Live match client wiring"]
        ["WP-091 ✅ Loadout builder"]
        ["WP-092 ✅ Lobby loadout intake"]
        ["WP-093 ✅ Match-setup rule-mode envelope"]
        ["WP-254 ✅ Lobby qualified-form ext_id guard (parseLoadoutJson rejects bare-slug/flat-key ids in the lobby instead of a Game.setup() 500; tenth code unqualified_ext_id; grammar-only mirror of parseQualifiedId, re-derived/layer-boundary-safe; D-24025)"]
        ["WP-094 ✅ Viewer hero key uniqueness"]
        ["WP-100 ✅ Interactive gameplay surface"]
        ["WP-163 ✅ Autoplay playback controls (server: pause/step/rewind endpoints)"]
        ["WP-165 ✅ Autoplay status endpoint (server: GET .../status read-only probe)"]
        ["WP-177 ✅ Autoplay rewind requester audience (server: D-17701 scopes D-16303)"]
        ["WP-164 ✅ Autoplay playback controls (client: media-player bar + status probe gating)"]
        ["WP-261 ✅ Autoplay bot-loop crash surfacing + defensive stage progress (server; EC-292): markAborted(reason) + abort-on-abnormal-exit keeps the controller registered for the 5-min review window + surfaces aborted/abortReason on the playback envelope; per-stage _stateID progress assertion (a stalled stage aborts instead of spinning to maxTurns); routes ALL stages through getLegalMoves so a parked KO-hero resolve fires anywhere; pure botLoopProgress.mjs helper; engine untouched; D-24037/D-24038 Active; WP-262 client banner fast-follow)"]
        ["WP-262 ✅ Autoplay 'Bot match stopped' banner + stall-detection poll (client; EC-296): consumes WP-261's aborted/abortReason envelope — mirrors both onto the client AutoplayControlResponse (no server import) + a bounded abort-state-only stall poll in AutoplayControls.vue (STALL_POLL_INTERVAL_MS=3000, single in-flight, stops on abort/stopped/unmount, never moves cursor/mode/history/paused) + a pure interpretStallProbe helper + a data-testid=autoplay-aborted banner extending the expired span + live-control disable on abort (rewind kept for the review window) + initial-aborted seed with no poll start; no server/engine/api-endpoints diff; D-24042 Active; D-24026 live-verify pending post-deploy)"]
        ["WP-166 ✅ arena-client vue-tsc green + CI typecheck gate (engine barrel publishes the 6 WP-128 UIState sub-types; D-16502)"]
        ["WP-227 ✅ arena-client vue-tsc green (WP-214/222 UIState/UICityCard fixture + prop backfill; 3rd recurrence of engine-field-add → client-typecheck drift after WP-166/207)"]
        ["WP-171 ✅ Pile browse modal (click-to-view card piles)"]
        ["WP-178 ✅ Card image rendering on play surface (CardTile component)"]
        ["WP-179 ✅ Card traits + superpower condition evaluation"]
        ["WP-228 ✅ Arena-client diagnostic capture + export (shareable freeze log)"]
        ["WP-246 ✅ Arena-client diagnostic UIState snapshot (richer freeze report)"]

      Auth Stack & Profile Surface
        ["WP-099 ✅ Auth provider selection (Hanko)"]
        ["WP-101 ✅ Handle claim flow"]
        ["WP-102 ✅ Public player profile page"]
        ["WP-104 ✅ Owner profile and /me edit"]
        ["WP-109 ✅ Team affiliation"]
        ["WP-111 ✅ UIState card display projection"]
        ["WP-112 ✅ Session token validation middleware"]
        ["WP-126 ✅ Hanko session verifier"]
        ["WP-131 ✅ Authenticated route production wiring"]
        ["WP-160 ✅ Hanko client UI (production sign-in surface)"]
        ["WP-161 ✅ Arena client API base URL surfacing (VITE_API_BASE_URL)"]
        ["WP-174 ✅ First-sign-in auto-provisioning (read-or-create account resolver)"]
        ["WP-175 ✅ Auth-aware navigation surface"]
        ["WP-192 ✅ Hanko JWKS refresh-interval parse guard"]
        ["WP-293 ✅ Game-signup → Brevo marketing list (server fire-and-forget, fail-open after WP-174 provisioning; D-24077..D-24080)"]

      Engine + Server Wiring & Leaderboard HTTP
        ["WP-113 ✅ Engine-server registry wiring"]
        ["WP-114 ✅ Viewer URL-parameterized setup preview"]
        ["WP-115 ✅ Public leaderboard HTTP and pg.Pool bootstrap"]

      Registry Viewer Enhancements
        ["WP-121 ✅ Card zoom slider"]
        ["WP-122 ✅ Henchman emission fix"]
        ["WP-123 ✅ cardType widening and other dispatch"]
        ["WP-124 ✅ Theme zoom slider"]
        ["WP-125 ✅ Card abilities effect-tag filter"]
        ["WP-086 ✅ Card-types upgrade"]
        ["WP-096 ✅ Grid data view mode"]
        ["WP-127 ✅ Grid tile team and ability text"]
        ["WP-170 ✅ Card count display"]
        ["WP-183 ✅ Scheme twist pattern taxonomy"]
        ["WP-184 ✅ Card mechanical pattern taxonomies"]
        ["WP-208 ✅ devLog category union extension (cardPatterns + schemeTwist)"]
        ["WP-213 ✅ devLog category single-source LOG_CATEGORIES array"]
        ["WP-245 ✅ LAGN export in registry viewer loadout tab"]
        ["WP-269 ✅ Hero mechanic metadata feed (producer half of the mechanic-query slice; deterministic transform turns the committed hero ledger into a normalized viewer-safe data/metadata/card-mechanics.json + data-only CardMechanicsIndexSchema + CI freshness gate; hidden fail-closed; D-24046)"]
        ["WP-270 ✅ Registry-viewer hero mechanic filter surface (consumer half; cardMechanicsClient + MechanicFilter ribbon over WP-269's feed, hidden!==true, OR-within / AND-across the text query; consumes D-24046)"]
        ["WP-271 ✅ Villain & henchman mechanic ledger (data-production half of beyond-heroes; new scripts/villain-mechanic-ledger.mjs mirrors the hero ledger, classifies [effect:X] by-hook via the dist's buildVillainAbilityHooks — resolved→executable / unresolvedMarkers→unsupported / no-marker→unmarked; ledger:villains:check CI gate; mastermind/scheme deferred — no ability-hook parser exists, named follow-ups; data-production only, feed-widening + dashboard view are consumption follow-ups per the D-24046 split; Shared Tooling, no engine/registry/app/data change, hero instruments byte-unchanged; User-Visible Surface none-infrastructure; D-24048)"]
        ["WP-276 ✅ Registry-viewer mechanic filter searchable dropdown (reworks WP-270's chip ribbon into a searchable multi-select toggle + position:fixed popover listing all 134 mechanics, escaping the drawer's overflow:hidden clip; supersedes WP-270 AC-7 curated-visible ribbon as a consumer presentation choice — feed + v-model contract unchanged, filter stays OR-within / AND-across; D-24052)"]
        ["WP-277 ✅ Mechanic dropdown scroll fix (regression in WP-276 — the capture-phase window scroll listener that closes the position:fixed popover also caught the popover list's own scroll → instantly closed the dropdown, making the list look unscrollable; onViewportChange now ignores scrolls whose target is inside the popover root, still closes on outside page/drawer scroll + resize; bugfix, no DECISIONS change)"]
        ["WP-278 ✅ Registry-viewer search header redesign — unified FilterDropdown (new shared FilterDropdown.vue standard control rebuilds Set·Class·Type·Mechanics·Effects on one row + a contextual Patterns dropdown, collapsing the scheme-twist + mechanical-pattern ribbons and deleting AbilityEffectFilter/SchemeTwistFilter/PatternFilter/MechanicFilter; filtering logic unchanged — OR-within / AND-across, D-24046 + D-24052 preserved; D-24053)"]
        ["WP-279 ✅ Cards tab add-to-loadout (lifts useLoadoutDraft from LoadoutBuilder.vue to App.vue as ONE shared instance — lifted not singletonized, instantiated post-registry-load mirroring useSetupFromUrl; CardDetail.vue gains a contextual add/remove button for the 5 composition types only, hero→addHeroGroup(card.extId)/scheme/mastermind set-clear/villain/henchman add-remove, Always-Leads groups not removable; new floating LoadoutTray.vue pill; pure loadoutCardActions.ts helper carries the tested cardType→slot invariant; no engine/contract/MatchSetupConfig change, consumes existing UseLoadoutDraftApi + FlatCard.extId D-24018; D-24054)"]
        ["WP-288 ✅ Cards tab 'View loadout as cards' gallery (reverse of WP-279 — render the loaded loadout/LAGN as a gallery via a filter MODE over the Cards tab, not a dropdown/new tab/second grid; loadoutGalleryActive state + a final inert-when-off narrowing stage in applyFilters mirroring the WP-270 mechanic stage, navigateToLoadoutGallery mirroring navigateToCard, dismissible inline banner; '🖼 View as cards' on LoadoutBuilder (disabled when empty) + a secondary tray action, both emitting view-as-cards; pure loadoutGalleryCards.ts helper — compositionExtIdSet skips empty single slots + for...of, isCardInLoadoutComposition by card.extId D-24018 — carries the composition→member-card expansion as the unit-tested invariant; no engine/registry/server/contract/loader/card-data change, CardGrid untouched; D-24072)"]
        ["WP-291 ✅ Loadout tab 'Load LAGN' import (closes the LAGN export/import round-trip surfaced after WP-288 — the tab could Download LAGN but the only importer 'Load JSON' validates the MATCH-SETUP schema so a LAGN file lagn_version/setup was rejected; adds a SEPARATE 'Load LAGN (paste or file)' control beside Load JSON, operator chose two explicit controls over auto-detect; pure loadoutLagnImport.ts parseLagnLoadout → the published @legendary-arena/lagn validate → reverse WP-245 compositionToLagnSetup into the 5 composition ext_id fields + 4 counts + playerCount, shield_officers_count→officersCount the only rename, ids already set-qualified D-24018 no registry lookup; applyLagnImport REPLACES the draft via the existing setters resetDraft→set*/add*/setCount/setPlayerCount, a non-LAGN file shows validator errors and preserves the draft; no composable/contract/loadFromJson/App.vue/gallery/CardGrid change; Lightweight Lane D-24028; D-24075)"]
        ["WP-361 📝 Current-match loadout as LAGN — GET /api/match/:matchId/lagn (server; read-only Tier-1 LAGN endpoint + blob-read carve-out extension so a live game's loadout is fetchable as a LAGN document; drafted 2026-07-11 via PR #695; EC-391 at execution-prep; D-24153)"]
        ["WP-362 📝 Loadout tab: open a LAGN from the URL ?lagn= (registry viewer; deep-link ingest into the Loadout tab so a shared ?lagn= URL renders that loadout; drafted 2026-07-11 via PR #695; EC-392 at execution-prep; D-24154)"]
        ["WP-363 📝 In-match 'View loadout in Registry Viewer' link (arena client; a link from a live match to the WP-362 ?lagn= deep-link; ⛔ BLOCKED on WP-361 + WP-362; drafted 2026-07-11 via PR #695; EC-393 at execution-prep; D-24155)"]

      Phase 8 — Interactive Board Layout
        ["WP-128 ✅ UIState board projections"]
        ["WP-129 ✅ Board layout (desktop/mobile)"]
        ["WP-130 ✅ Playmat / reskin selector"]

      G-State Extensions
        ["WP-153 ✅ Destination piles (strike, twist, escaped)"]
        ["WP-154 ✅ Mastermind attached bystanders"]
        ["WP-155 ✅ Turn economy extensions (piercing, wounds drawn)"]
        ["WP-156 ✅ Horrors pile"]

      Monetization Stack
        ["WP-132 ✅ Entitlements data model and read endpoint"]
        ["WP-133 ✅ Stripe checkout and webhook ingestion"]
        ["WP-134 ✅ Webhook to entitlement fulfillment (closed-loop LIVE for cosmetic SKUs)"]

      Engine & Test-Harness Cleanup
        ["WP-135 ✅ HQ population and hero deck reservoir"]
        ["WP-136 ✅ JSDOM opaque-origin storage fix"]
        ["WP-137 ✅ Hero card-instance distinctness + data-driven cardCounts"]
        ["WP-191 ✅ Card ext_id grammar reconciliation (zone instance IDs)"]
        ["WP-294 ✅ Separate the message log from the finalStateHash oracle (hashGameState excludes G.messages; notableEvents stays hashed; D-24081)"]

      Physical Card Pipeline
        ["WP-138 ✅ Physical card abstraction layer"]
        ["WP-140 ✅ Physical card phase 1b"]
        ["WP-141 ✅ Physical card phase 2"]
        ["WP-147 ✅ PhysicalCard companionSlug + physical-side order"]
        ["WP-151 ✅ Physical card phase 3 (imageUrl removal)"]

      Domain Cutover & Infrastructure
        ["WP-139 ✅ Engineering wiki viewer"]
        ["WP-144 ✅ Arena-client production bundle isolation"]
        ["WP-145 ✅ Architecture inventory ↔ wiki integration"]
        ["WP-146 ✅ cards.legendary-arena.com cutover prep"]
        ["WP-148 ✅ legendary-arena.com + www cutover prep"]
        ["WP-240 ✅ Roadmap count-table generator (WORK_INDEX × mindmap; cron auto-PR)"]
        ["WP-244 ✅ LAGN spec publication (npm package + GitHub repo + schema hosting)"]
        ["WP-392 ✅ Derive the published LAGN JSON Schema from the zod schema (contract; src/validator.ts maintained the format TWICE — lagnSchema (zod, labelled Single Source of Truth) and a hand-written generateSchema() literal that was not derived from it. Closes the hazard D-24193 recorded as known-and-unfixed; lagn-spec suite 34 → 44/0; generate:schema then git diff --exit-code on schemas/ is clean. D-24196 Active; done 2026-07-18)"]
        ["WP-393 📝 Registry version + per-set content hash surface (registry; CardRegistry cannot say which snapshot of the card data it loaded — RegistryInfo carries no version, SetIndexEntry no hash, and a grep for registryVersion/content_hash/sha256 over packages/registry/src returns nothing. That makes the load-bearing half of WP-394 provenance unanswerable. Reserves D-24197; EC-423; drafted 2026-07-18)"]
        ["WP-394 📝 LAGN 1.2.0 — card metadata provenance (contract; BLOCKED on WP-393. Lets a LAGN answer which card effect a replay references and whether it verifies without the registry, via optional hash-anchored provenance: catalog_ref pins the producer load scope, registry_ref uses stable ext_id + face_id rather than JSON pointers (which break on array reorder), effect_snapshot is frozen evidence and explicitly not authoritative. Registry stays authoritative. Reserves D-24198; EC-424; drafted 2026-07-18)"]

      Public Leaderboard (Marketing)
        ["WP-149 ✅ Public leaderboard Hugo page"]
        ["WP-150 ✅ Leaderboard theme + global aggregation endpoints"]

      Legends Public Scoreboard
        ["WP-142 ✅ Legends snapshot publisher"]
        ["WP-143 ✅ Legends attract board (public scoreboard SPA)"]

      Villain Deck Pipeline
        ["WP-167 ✅ Villain deck composition data (registry)"]
        ["WP-168 ✅ Villain deck composition logic (engine)"]
        ["WP-169 ✅ Scheme villain-deck count curation"]
        ["WP-172 ✅ Villain-deck display data coverage"]
        ["WP-173 ✅ Well-known ext_id display data"]

      Villain & Henchman Effects
        ["WP-185 ✅ Fight + ambush effects (engine)"]
        ["WP-186 ✅ Escape + overrun effects (engine)"]
        ["WP-187 ✅ Effect-marker enrichment (card data)"]
        ["WP-188 ✅ Escape/overrun effect-marker enrichment (card data)"]
        ["WP-189 ✅ koHeroEachPlayer vocabulary expansion (engine)"]
        ["WP-190 ✅ Each-player-KO effect-marker curation (card data)"]
        ["WP-202 ✅ Magnitude-N each-player-KO (engine + data)"]
        ["WP-212 ✅ Once-per-turn villain reveal guard (engine)"]
        ["WP-214 ✅ Villain hero capture + dynamic attack resolution (engine + data)"]
        ["WP-242 ✅ Villain Fight KO-Hero player choice (engine: park → resolve, bot auto-resolve)"]
        ["WP-386 ✅ Red Skull Master Strike — 'Each player KOs a Hero from their hand' (engine; the WP-024 per-mastermind strike dispatcher implemented only Magneto, so Red Skull's printed strike silently no-op'd — surfaced by the 2026-07-16 Red Skull live-game review, 3 strikes / 6 skipped KOs; adds a Red Skull id set core/red-skull + co2e/red-skull (identical base-face text; epic face NOT matched) + resolveRedSkullStrike on the Magneto pattern — sorted players, KO the lowest-cost Hero (cardStats cost ?? 0, tie → lowest hand index) from hand to G.ko, Wounds excluded, empty/all-Wound hand → logged no-op, one pushLog line per player; D-24188 auto-KO ≈ player-optimal pick, avoids a blocking multi-player pending-choice; generic strike behavior D-15401 capture + counter + WP-200 emission byte-unchanged; NO sentinel re-pin — recorded fixture + runtime-observed matrix are core/dr-doom; engine 1981→1991/0; EC-415)"]
        ["WP-389 ✅ Mastermind base-face selection — stop silently selecting Epic faces (engine; the setup card loop assigned baseCard on every non-tactic face with no early exit, so the LAST won — 65 masterminds across 24 sets played their Epic variant unchosen, e.g. co2e Doom at attack 12+ instead of 10+. core was unaffected (single non-tactic face), which is why no oracle caught it. Fix is one assignment guard so the FIRST non-tactic face wins, keeping tactic as the D-1413 discriminator; Epic becomes unreachable until an explicit opt-in exists. Unblocks WP-388. Reserves D-24193; executed 2026-07-18)"]
        ["WP-388 ✅ co2e mastermind strike texts — Doom / Loki / Magneto / Doctor Octopus (engine; four of five co2e base faces still no-op their printed Master Strike beyond the generic bookkeeping. Adds a per-mastermind resolver for each on the WP-386 pattern, resolving every printed or/may clause by deterministic auto-pick — no new G field, no RNG, no pending-choice. Doom derives its Omen count from masterStrikeCount+1 rather than storing a stack. Loki's Hypno-Thrall and Doc Ock's reveal-8 branches are deliberately deferred as a recorded fidelity gap. Reserves D-24192; executed 2026-07-18)"]
        ["WP-390 📝 Council masterminds resolve to an empty shell (engine; four masterminds ship ZERO non-tactic faces — 2099/sinister-six-2099, 2099/alchemax-executives, shld/hydra-high-council, shld/hydra-super-adaptoid — so findMastermindCards hits its null guard and buildMastermindState falls through to the degenerate state: no Master Strike, no tactics, no game text, no abilities. Both S.H.I.E.L.D. masterminds are affected. Surfaced as an adjacent defect while drafting WP-389, which deliberately left the null-return guard untouched. No EC yet — design questions open; drafted 2026-07-18)"]
        ["WP-391 📝 Support card pools — name the cards behind the four supply piles (registry + LAGN + viewer; MatchSetupConfig carries bystanders/wounds/officers/sidekicks as bare counts, so nothing records WHICH cards fill a pile. Blocks a frozen Support Preset that would make hero selection the only variable in a legends comparison. Pools ride the MATCH-SETUP envelope, never the composition — D-1244 stands unamended, following the heroSelectionMode precedent. Three ECs: EC-420 picker set filter, EC-421 envelope pools with a cross-block sum-equals-count validator, EC-422 LAGN 1.1.0 version seam plus version-gated pools. Design source is the marketing-site repo, where it is numbered WP-036. Reserves D-24194 and D-24195; drafted 2026-07-18)"]
        ["WP-243 ✅ Villain Fight KO-Hero player choice (UX: engine projection + client prompt + discard visibility)"]

      Hero Ability Coverage & Markup Pipeline
        ["WP-215 ✅ Hero rescue + reveal-draw effects (engine + data)"]
        ["WP-216 ✅ Markup corpus sweep: rescue + reveal-draw"]
        ["WP-217 ✅ Reveal-KO-if-zero + reveal-draw-at-least executors (engine + data)"]
        ["WP-218 ✅ Reveal compound executor + VP-cost corpus"]
        ["WP-219 ✅ Reveal cost-attack + odd-draw executors (engine + data)"]
        ["WP-220 ✅ Reveal attack-choose executor (player-choice infrastructure)"]
        ["WP-222 ✅ Pending hero choice UX (engine projection + client prompt)"]
        ["WP-223 ✅ Reveal KO-attack compound executor (engine + data)"]
        ["WP-224 ✅ Hero ability markup corpus sweep (all 40 sets)"]
        ["WP-225 ✅ Hero draw markup corpus sweep"]
        ["WP-247 ✅ Count-scaled hero attack framework (attack-per-count keyword + HeroCountSource resolver)"]
        ["WP-248 ✅ Optional-KO-then-Reward hero effect framework (optional-ko-reward keyword + resolveOptionalKoReward move + reward dispatch)"]
        ["WP-249 ✅ Optional-KO-then-Reward UX (chooser-only UIState projection + non-dismissible OptionalKoRewardPrompt + turn-end gating)"]
        ["WP-250 ✅ Hero-effect coverage gate (pnpm sim:coverage + CI non-regression; hybrid posture)"]
        ["WP-251 ✅ Hero effect ImplementationMap (executeSingleEffect switch → HERO_EFFECT_HANDLERS registry; behavior-preserving Lever-2 foundation)"]
        ["WP-252 ✅ Parameterized villain effect primitives (10 keywords → 5 VillainEffectPrimitive + VillainEffectDescriptor via VILLAIN_EFFECT_HANDLERS; dual legacy/parameterized parser; Mag3 data-only; reverse-map keeps narrative byte-identical; Lever 1; retires D-20201/D-18901)"]
        ["WP-253 ✅ Hero reveal-* collapse (8 reveal keywords → 1 parameterized reveal + RevealRule branch-list via revealRulesForLegacyKeyword; dual legacy/parameterized parser; no reverse-map needed; Lever 1 for heroes; D-24024)"]
        ["WP-255 ✅ The Amazing Spider-Man reveal-top-N (deck[peekOffset] dual-bound peek-advance multi-peek + reveal-count marker; first visible-win card under D-24026; D-24027)"]
        ["WP-256 ✅ Berserk via composable effect primitives (D-24029 first proof case; bootstraps the homogeneous effect-descriptor AST + interpreter with transient bind/ref context never in G + open HERO_COMPOSITION_MARKERS seam; Berserk + Recruit cousin are data; D-24030 + D-24031)"]
        ["WP-257 ✅ Hollow Effect Detector (engine runtime invariant; handler-reachability NOT state-diff; EFFECT_EXECUTION_REASONS + HollowEffectRecord + capped runtime-only G.diagnostics channel + parser unresolvedMarkers; DEFERRED_BY_DESIGN_MECHANICS allowlist; write-directly, no caller change; foundation for WP-258/259/260; D-24033 + D-24034)"]
        ["WP-258 ✅ Hollow effects on the arena-client diagnostics surface (reporting-loop consumer 1 of 3; optional UIState.hollowEffects projection read-only + public pass-through D-12803 + HollowEffectRecord/EffectExecutionReason barrel re-export; HollowEffectsPanel.vue mounted once in shared PlayViewport; rides the Download-diagnostics export free; no new DECISIONS)"]
        ["WP-263 ✅ Surface sim hollow-effect diagnostics on the capture/sweep projection (WP-259 predecessor; captureGameDiagnostics pure helper + additive sibling hollowEffects/hollowEffectsDropped on CapturedGameResult + SweepCellResult; runtime-only derived read, never persisted/gameplay-input, not nested into CapturedOutcomeSummary; both field-set drift guards updated; sim byte-identical, finalStateHash unchanged; unblocks WP-259; D-24039)"]
        ["WP-259 ✅ Runtime-observed hollow-effect /coverage overlay (reporting-loop surface 3 of 3; runtime-observed-hollows.mjs drives sweepSetupMatrix + reads cell.hollowEffects off the WP-263 sibling fields → committed canonical artifact + per-PR sim:runtime-observed:check in the hero-effect-coverage job; dashboard /coverage purple 'Observed in play' overlay + 'not observed in play' empty state via build-time-copy; committed artifact = fast random-policy RECORDED ZERO-STATE, heavier competent-play sweep deferred to cron per the CI-affordability fallback; D-24035)"]
        ["WP-260 ✅ Architect-lane gap intake (reporting-loop consumer 3 of 3's architect sibling; useArchitectGapIntake projects useCoverageLedger().runtimeObservedByMechanic → ArchitectGapCandidates folded into the Pipeline Architect lane via an optional 4th useAgentPipeline arg unshifted into architectBacklog only; consumer-owned ArchitectGapProjection D-23901 + single-lane D-23902 + WP-239 triageData backward-compat; fields copy the overlay entry, proposedTargetLayer from a fixed cardType map, reason opaque pass-through D-20703, invents no facts; live overlay zero-state ⇒ empty path; D-24036)"]
        ["WP-264 ✅ Parameterized simulation turn cap (maxTurns option; WP-265 enabler; optional trailing maxTurns default MAX_TURNS_PER_GAME on the six sim entry points runPerTurnLoop/buildGameOutcome/simulateOneGame/simulateOneGameAndCaptureMoves/runSimulation/sweepSetupMatrix → a downstream sweep runs short terminating games instead of grinding to the 200-turn safety cap; PARAM not a result field so field-set drift guards untouched; warm-up shares the same cap for PRNG parity; validity caller-owned no throw/clamp; finalStateHash unchanged replay-guarded; index.ts byte-unchanged; D-24040)"]
        ["WP-265 ✅ Real-signal runtime-observed hollows via a competent hero-diverse per-PR sweep (flips WP-259's /coverage overlay from zero-state to real signal via a competent-heuristic maxTurns-bounded WP-264 hero-diverse sweep — 39 hero-deck sets over the sentinel core × 8 seeds/board, the measured signal lever; enabled by WP-266/D-24043 onBegin parity; RE-SCOPE 2026-06-19 DROPPED the weekly cron — competent ~2.7ms/game so the per-PR sim:runtime-observed:check is kept, no runtime-observed-refresh.yml, no ci.yml change; matrix is a hardcoded locked value not a ledger read; artifact = 16 mechanics/176 obs/dropped 0/312 games, byte-identical; 2 files; no engine edit, dashboard untouched; D-24041 Active, D-24026 ✅ live-verified 2026-06-19 — /coverage Observed-in-play column populated, completes the hollow reporting loop end-to-end)"]
        ["WP-266 ✅ Simulation onBegin parity (WP-265 unblocker; the three observation-only per-turn loops runPerTurnLoop/par.aggregator simulateOneGame/runFixture rotateToNextTurn mirror the play-phase onBegin via ONE shared pure helper applyOnBeginParity = reset villainRevealedThisTurn+hasDrawnThisTurn + auto-draw to HAND_SIZE, rule hooks deferred D-0205, extracted at the third use since runFixture already had it inline WP-212+WP-236 but runner+aggregator did not → empty hand forever, playCard never legal; plus a one-shot reveal gate in getLegalMoves stage==='start' && !villainRevealedThisTurn ending the competent policy's turn-1 infinite re-reveal; game-determinism preserved, replay byte-behavior-identical, finalStateHash unchanged; scaffold-confirmed 1454/1454 + competent sweep surfaces ≥1 hero hollow in ~17ms; regenerates WP-259's runtime-observed-hollows.json off the zero-state; D-24043)"]
        ["WP-268 ✅ By-hook composition ledger (parser resolvedMarkers — the positive counterpart of WP-257's unresolvedMarkers — so the mechanic ledger marks a parameterized composition marker executable only when that card's hook resolved it, resolving the WP-267 by-name over-claim on /coverage By-card; parse-time provenance only, finalStateHash unchanged; D-24045)"]
        ["WP-267 ✅ Empowered via a class-count value primitive (first effect-authoring grind mechanic off /coverage; first PARAMETERIZED composition over the WP-256 substrate — new count-cards-by-class-in-zone value expr + its own shared-zone EffectCountZoneKind=['hq'] separate from per-player EFFECT_ZONE_KINDS, reads G.cardTraits[id].heroClass over G.hq no self-exclusion; buildEmpoweredComposition(color) + PARAMETERIZED_COMPOSITION_MARKER_NAMES deduped into HERO_COMPOSITION_MARKER_NAMES; parser parameterized-marker branch resolves the core ONLY on an anchored by-[hc:COLOR] tail whose color is the line's sole condition + suppresses it from heroClassConditions; Honest-Partial — deferred variants color-of-choice/Double-Triple/conditional-prefix/multi-class stay parse-unrecognized runtime hollows; no executor edit, no coverage-script edit, no HeroKeyword/node-type/EFFECT_ZONE_KINDS change, data/cards byte-unchanged; engine test 1462→1473/0, runtime-observed empowered cleared 16→15/176→163 dropped 0 byte-stable, coverage +5 core-form hooks, ledger 119→126 by-name over-claims ~4 deferred cards follow-up; finalStateHash unchanged EMPTY_REGISTRY; D-24044 Active, D-24026 ✅ live-verified 2026-06-20)"]
        ["WP-272 ✅ Empowered conditional-prefix class-gated core form (second Empowered form; parser-only — lifts WP-267/D-24044's conditional-prefix deferral for the class-gated case so [hc:X]: You get [keyword:Empowered] by [hc:Y] resolves to buildEmpoweredComposition(Y) RETAINED behind the [hc:X]: heroClassMatch gate, the WP-256 conditions-gate executor firing it only when the gate passes — no executor/interpreter/builder/contract edit; new anchored EMPOWERED_PREFIX_GATE_PATTERN + detection-only tryResolveEmpoweredConditionalPrefix structural gate (single [keyword:Empowered] marker + leading [hc:X]: + anchored fixed-color tail + no and-[hc:Z] + no [team:…]) — condition-counting forbidden, it mis-resolves fight-or-flight's choose-one; suppress-one-retain-gate removes exactly one heroClassMatch(Y) and keeps heroClassMatch(X); Honest-Partial — color-of-choice/multi-class/choose-one/team-gated/Double-Triple stay parse-unrecognized hollows, one-hit-wonder still resolves via core + fight-or-flight still unresolved; engine test 1477→1488/0, coverage executable 2614→2639 +25 hooks antm+10/bkpt+15, ledger 120→123 exactly 3 hero rows unsupported→executable by-hook antm/jocasta+bkpt/princess-shuri+bkpt/queen-storm-of-wakanda, wonder-man already executable via one-hit-wonder, torrential-downpour line-1 ambush-prefix stays hollow; runtime-observed-hollows.json byte-identical 15/163/dropped 0 empowered obs-delta 0 — competent sweep doesn't sample the 5 plays; data/cards byte-unchanged, finalStateHash unchanged EMPTY_REGISTRY; D-24047 Active, D-24026 ⏳ pending post-deploy /coverage)"]
        ["WP-280 ✅ Spectrum ≥3-hero-class conditional keyword + simple-effect markup (effect-authoring grind off /coverage — Spectrum hollows on Silk/ssw2; models the printed Spectrum gate as a new self-INCLUSIVE distinctHeroClassesAtLeast hero condition SPECTRUM_CLASS_THRESHOLD=3 attached by a parser branch recognizing [keyword:Spectrum] — NOT a HeroKeyword; marks up 3 simple gated effects quiver-of-thunderbolts/cascading-maneuver draw + long-range-spider-sense [keyword:reveal:2] cost-lte; the 6 ungated icon Spectrum lines now honor the gate + the 4 plain-English lines fire; honest-partial — borrowed-cloaking-device multi-card sum-cost reveal stays a reported hollow follow-up; ssw2-only; sentinel finalStateHash re-pins EXPECTED — bot plays Spectrum cards, gating changes effects; no new HeroKeyword, heroKeywords/apps/registry/server/ai.legalMoves byte-unchanged; D-24055 + D-24056)"]
        ["WP-281 ✅ Mechanic coverage dashboard condition-gate status display (dashboard-only UI for the new 'condition' status WP-280's ledger schema introduced; Spectrum's 5 ssw2 cards now render as 'Condition' on /coverage instead of false 'Unsupported'; AC-1..AC-6 verified, dashboard test 376→392/0; D-24057 + D-24058)"]
        ["WP-282 ✅ Undercover face-down zone architecture + send/play moves (foundational hidden-identity mechanic — Undercover is the #2 in-play hollow, 20 obs across 2099/bkwd/shld; Session 1 EC-313 adds faceDownCards: FaceDownCard[] zone on G.playerZones + sendUndercover(cardId, sourceZone)/playFromUndercover(cardId) moves under the Move Validation Contract + a determinism rule identity-stored/display-randomized-per-render; Session 2 EC-314 adds the undercover keyword to HERO_KEYWORDS + case-insensitive [keyword:Undercover] parser recognition wired into the conditional-hook system + full 2099 hero integration; move-executed MVP membership; sentinel re-pinned Option B with zero behavior change; unblocks future face-down mechanics cloaking/pending-choice; D-24059 + D-24060 + D-24061 + D-24062)"]
        ["WP-283 ✅ Empowered oracle: free-choice + binary-choose-one forms (third + fourth Empowered forms; oracle-max approximation D-24063 — scan HQ classes, grant +Attack = max count; adds tryResolveEmpoweredFreeChoice for amulet-of-avalon 'by the color of your choice' + tryResolveEmpoweredChooseOneLine pre-pass for fight-or-flight 'Choose one: by [hc:X] or by [hc:Y]'; new max-class-count-in-zone ValueExpression D-24064 with classes:'all'|string[]; processedAsChooseOne flag suppresses per-token loop for the choose-one line; no executor/interpreter/contract edit; data/cards byte-unchanged; engine test 1572/0 +17; D-24063 + D-24064 Active)"]
        ["WP-284 ✅ Empowered dynamic deck-peek (fifth Empowered form; D-24065 — final fallback tryResolveEmpoweredDynamic recognizes 'by the Hero Classes of the card you revealed this way' / cross-the-multiverse / wtif/star-lord-tchalla; new top-deck-card-class-count-in-zone ValueExpression D-24066: peek deck[0] class → count HQ matches → +Attack; playerID threaded through ValueExpressionEvaluator; guard in tryResolveEmpoweredFreeChoice prevents premature capture; peek-only no zone move; wtif.json byte-unchanged; engine test 1572→1586/0 +14; D-24065 + D-24066 Active)"]
        ["WP-285 ✅ Ebony Blade victory-pile villain-pick infrastructure (PendingVictoryPileCardPick FIFO queue mirrors WP-248 optional-ko-reward topology; new 'victory-villain-attack' keyword = 21st HERO_KEYWORDS entry D-24068; new resolveVictoryPileCardPick move reads G.cardStats[id].fightCost — villain printed attack stored as fightCost not attack; block-all guards at 8 standard sites; getEligibleVictoryVillains filters G.villainDeckCardTypes === 'villain'; bot default = highest-fightCost, ties by lowest victory-pile index; antm/the-ebony-blade prefixed [keyword:victory-villain-attack]; game.ts 14→15 moves; engine test 1586→1626/0 +40 (all 16 ACs directly asserted); D-24067 + D-24068 Active; 2026-06-24)"]
        ["WP-286 ✅ One-Hit Wonder draw-or-empowered interactive choose-one"]
        ["WP-287 ✅ Draw-or-empowered choose-one UX (projection + client prompt)"]
        ["WP-289 ✅ Sim move-dispatch completeness for interactive resolve moves (WP-286 follow-up)"]
        ["WP-295 ✅ Hero play + condition-skip observability logging (G.messages → UIState.log; condition-fail mutates only the log; D-24082)"]
        ["WP-290 ✅ Size-Changing hero class-grant on play (third re-draft target off the runtime-observed ranking — clears the size-changing/parse-unrecognized hollow on antm/jocasta/holographic-image-inducer gitSha 988ad2e; implements the printed 'when you play this card, it has the [Class] class' as a class-grant realized at class-read time, mirroring the WP-273 wall-crawl recognized-keyword-no-onPlay-handler pattern; new 'size-changing' keyword 22→23 + HeroAbilityHook.sizeChangingClasses + immutable G.cardSizeChangingClasses parsed at setup where the same-line [hc:...] is the GRANTED class NOT a heroClassMatch condition; new pure hero/sizeChanging.logic.ts cardHasClassWhenPlayed/getGrantedClasses effective class = printed ∪ granted with cardTraits never mutated, consulted by both inPlay class reads heroClassMatch + distinctHeroClassesAtLeast; 'size-changing' joins a new CLASS_GRANT_KEYWORDS set → MVP_KEYWORDS with no HERO_EFFECT_HANDLERS entry handler count unchanged at 10; grant proven load-bearing — null-printed-class yellowjacket/goliath + printed≠granted giant-ego/swarm-tactics; conditional-spread omit-when-empty G field keeps no-Size-Changing games byte-identical so no sentinel re-pin; Attack-as-VP no hero-deck VP scoring + Microscopic + villain/divided-card + UIState class display deferred follow-ups; engine test 1666→1687/0, pnpm -r build 0, ledger size-changing→executable 16 rows, runtime-observed hollow removed 11→10 mechanics, sim:coverage no regression; User-Visible Surface play.legendary-arena.com D-24026 post-deploy; 2026-06-28 commit 396526f3; D-24074)"]
        ["WP-292 ✅ Villain defeat-requirement gate — 'You can't defeat X unless you have a [class/team] Hero' (operator field report: Blob defeated with an all-Avengers/Guardians board + no X-Men Hero, gitSha b108dc4 match FC6toc2rQQG; ledger confirmed Blob=(unmarked) — the printed restriction was cosmetic card text, never enforced; a fight PRECONDITION distinct from the onFight/onAmbush/onEscape consequence hooks, the first fight-precondition primitive in the engine; new VillainDefeatRequirement {kind 'team'|'hero-class', value} + VILLAIN_DEFEAT_REQUIREMENT_KINDS drift array; new marker [require-to-defeat:<kind>:<value>] team→'team' hc→'hero-class' parsed by setup/villainDefeatRequirement.setup.ts into per-instance entries via villainCardInstanceExtIds, unknown-kind/empty-value/no-marker→no entry no throw; immutable G.villainDefeatRequirements built via conditional-spread omit-when-empty so matches without a marked villain stay byte-identical; pure moves/villainDefeatRequirement.logic.ts getDefeatRequirement + playerMeetsDefeatRequirement scanning hand∪inPlay ONLY — discard/deck excluded operator decision — the single gate authority; fightVillain silent-return precondition gate after the attack-cost check mirroring the Guard-block posture no mutation/message/event/throw on block; data overlay apply-defeat-requirement-markers.mjs + villain-defeat-requirements.json marks Blob core/brotherhood team:x-men + Venom core/spider-foes hc:covert + Zombie Venom ssw1/deadlands-the hc:covert, cvwr Size-Changing Venom left unmarked, idempotent surgical append re-run=zero-line diff; mastermind/henchman/multi-requirement/ledger-recognition/UX-hint deferred follow-ups; engine test 1687→1710/0 +23, pnpm -r build 0, sim:runtime-observed:check byte-current no re-pin; User-Visible Surface play.legendary-arena.com D-24026 post-deploy; 2026-06-29 commit 3e732c7f; D-24076)"]
        ["WP-356 ✅ shuffle-discard-empty-reward hero keyword: Jocasta Reprocess + Electromagnetic Eyebeams (clears the two-branch empty-discard-reward-or-shuffle hollow diagnosed from a live log 2026-07-11; one mandatory immediate keyword HERO_KEYWORDS 29→30 + handler registry 16→17 on the D-24029 substrate; D-24019-style 3-segment token, seeded rewards exactly recruit/attack, heroAbility.types.ts untouched; executor = empty discard → addResources grant, else combined deterministic discard→deck shuffle via ShuffleProvider + G.messages both branches; execution amendments: icon-suppression — the icon step had granted a flat unconditional +2 on every play, D-24016 precedent now subsumes it — + executor magnitude>=1 floor; 2 marker rows + antm.json + ledger + card-mechanics regen; engine 1903/444→1914/447/0 exactly the locked delta; optional-shuffle dead/ssw2 + Flying Steed deferred; Done 2026-07-12; EC-386; D-24148)"]
        ["WP-364 ✅ gain-wound-self / gain-wound-each hero keywords: the plain 'gain a Wound' family (live-game diagnosis 2026-07-11 matchId sGTM7LWSIHy — Hulk Crazed Rampage 'Each player gains a Wound' played twice with no effect: Wound supply stayed 30, player gained 0; two stacked gaps — bare-prose no marker AND generic hero 'wound' keyword is DEFERRED_BY_DESIGN_MECHANICS; two NARROW keywords reuse WP-017 gainWound(woundsPile,discard) via the WP-316 villain per-target loop, self=active player / each=sorted Object.keys(G.playerZones) + woundsDrawn bump, wound→discard so NO targeting UI needed; single-segment tokens [keyword:gain-wound-{self,each}], one shared executor under both keys + NO_MAGNITUDE/HANDLED/MVP sets, G.messages both branches; Honest-Partial — generic 'wound' + all 40 targeting/conditional hero wound forms stay deferred, heroAbility.types.ts untouched since each keyword encodes its target; 7 marker rows across 6 sets 3× crazed-rampage each + 4× self colossus/human-torch/luke-cage/hulkling + VALID_TOKEN_PATTERN + regenerated 3dtc/core/msp1/cvwr/dkcy/ff04 + hero ledger; no RNG top-of-pile draw, no VP-scoring change; executed 2026-07-12; parser UNCHANGED (generic plain-keyword builder emits {type}), only HERO_KEYWORDS + NO_MAGNITUDE_KEYWORDS registration; engine 1903/444/0, ledger all 7 executable by-hook, sentinel unchanged; EC-395 (renumbered from EC-391 — WP-361 landed EC-391 first); D-24156 Active)"]
        ["WP-382 ✅ ko-wound-reward hero keyword — auto-resolve 'you may KO a Wound → reward' (implements the hollow Healing Factor family surfaced in the Red Skull live game, played ~10× no-op; a Wound-restricted auto-resolving variant of optional-ko-reward D-24019 — executor immediately KOs one WOUND_EXT_ID hand-first else discard to G.ko + grants the reward by reusing executeSingleEffect {type:rewardType,magnitude} rewardType ∈ draw/attack/recruit, no Wound → G.messages no-op D-24017; AUTO-RESOLVE not a pending choice because a Wound is a fungible dead card + KO-plus-reward is strictly beneficial so the 'you may' decline + hand/discard choice are strategically inert unlike optional-ko-reward which KOs any card; KO filtered to WOUND_EXT_ID only so a Hero in hand is never KO'd; keyword carries reward magnitude so NOT in NO_MAGNITUDE_KEYWORDS; marker token [keyword:ko-wound-reward:rewardType:n]; marks 8 core-vocab cards draw×2 incl Healing Factor + attack×4 + recruit×2 across core/dstr/cvwr/3dtc/msp1/ff04/msis — refined from optimistic 9 after corpus inspection, 4 candidates deferred to the marker map _deferred: mdns/morbius [keyword:Moonlight]: state gate + wpnx/weapon-x [hc:instinct]: gate & Berserk reward outside seeded vocab + xmen/x-23 & cvwr/peter-parker rewardless; SIM-OUTCOME CASCADE regen mechanics:metadata + ledger:heroes + runtime-observed, NO sentinel re-pin — no recorded fixture plays a marked card so finalStateHash + PRE_WP080_HASH byte-identical; engine+data NO client; out of scope pending-choice UX + the 4 deferred family members Honest-Partial; User-Visible Surface play.legendary-arena.com D-24026 live-verify Healing Factor KOs a Wound + draws; Done 2026-07-15 exec off origin/main @ 4ed649ff, -r build 0 + engine 1957→1965/0 +8 7 handler + 1 registration; EC-411; D-24183 Active; D-24026 live-verify operator-pending)"]
        ["WP-383 ✅ discard-to-play hero card cost — mandatory 'discard a card to play this card' (Cyclops Determination/Optic Blast + 3 siblings print 'To play this card, you must discard a card from your hand' but the cost is silently skipped so the cards are played ~free, strictly stronger than printed; surfaced in the Red Skull live game; faithful fix Jeff-locked = mandatory + client prompt; new discard-to-play keyword; the engine's FIRST card-specific pre-commit precondition in playCard blocks an unpayable play before commit else the base recruit/attack leaks — every existing pending choice fires AFTER commit so the onPlay hook can't veto; a payable play commits then parks a mandatory PendingDiscardToPlay resolved by a new resolveDiscardToPlay move + DiscardToPlayPrompt.vue mirroring return-zero-cost-discard D-24139 end-to-end; block-all guard added to every action move + ai.legalMoves forced-resolve; marks 7 single-discard cards core/cyclops determination+optic-blast + ssw2/ruby-summers heir-to-legends + vill/juggernaut runaway-train + xmen/havok unleash-havok + co2e/cyclops determination+optic-blast 2nd-edition reprints (co2e landed on main mid-execution via #766), defers the one n=3 card ssw2/ruby-summers extinction-blast to _deferred; SIM-OUTCOME CASCADE regen mechanics:metadata + ledger:heroes + runtime-observed, sentinel re-pin only if a recorded game plays a marked card; engine+client+data engine-first commit; out of scope reveal-N reorder gap Amazing Spider-Man family + unpayable-play visual feedback + n>1 multi-discard; User-Visible Surface play.legendary-arena.com D-24026 live-verify Optic Blast with a spare card prompts discard, as last card cannot play no free attack; Done 2026-07-15 exec off origin/main @ 688c180e, -r build 0 + engine 1965→1981/0 +16 (incl 15-test resolveDiscardToPlay + precondition suite) + arena-client typecheck 0 + test 963→974 +11 (prompt + gate); NO sentinel re-pin — pendingDiscardToPlay optional G field undefined-unless-triggered + no recorded fixture plays a marked card so finalStateHash + PRE_WP080_HASH byte-identical, runtime-observed byte-identical too; ARCHITECTURE.md Move Validation Contract clause added + rules mirror; EC-412; D-24184 + D-24185 Active; D-24026 live-verify operator-pending)"]
        ["WP-379 ✅ Wound 'Healing' ability — KO all Wounds from hand (engine; implements the printed universal rule rules v23 §Healing Wounds — 'If you don't recruit or fight anything on your turn, you may KO all the Wounds from your hand'; new healWounds move KOs every WOUND_EXT_ID from the current player's hand into G.ko permanently, non-core contract main-gate + block-all hasPending* cluster + hasActedThisTurn precondition then mutate, no pending-choice state, one pushLog line no notableEvent; two optional LegendaryGameState flags carry the mutual exclusion — hasActedThisTurn set by fightVillain/recruitHero/fightMastermind on successful commit + gates Healing, hasHealedThisTurn set by healWounds + reverse-locks those three — both reset in play turn.onBegin, structural NOT economy-derived so a 0-cost fight/recruit still counts D-24180; move registered client:false D-10008, game.test.ts move-set drift bumped; determinism — the new G flags may re-pin a sentinel/golden hash via the canonical record tool never hand-edit, else unchanged; out of scope the client Heal-Wounds affordance + UIState projection deferred to a follow-up client WP, AI/sim integration ai.legalMoves untouched so PAR/sweep baselines unchanged, notableEvent, the playCard wound-block, Enraging-Wound variants; User-Visible Surface none — infrastructure; Done 2026-07-14 exec off origin/main @ 161cd432, engine 1927→1943/0 +16, all greps pass; determinism re-pin behaviour-neutral — sentinel finalStateHash 47afd86a→3da2c374 via record-game-fixture.mjs + PRE_WP080_HASH be266d02→ec64506a, same class as WP-236/WP-282; EC-408; D-24179+D-24180 Active — reserved D-24176/D-24177 renumbered on collision, D-24176 taken by the concurrent scoring fix + D-24178 by open PR #751)"]
        ["WP-380 ✅ Wound 'Healing' client affordance — Heal Wounds button + UIState projection (WP-379 follow-up; surfaces the engine healWounds move to players; single cross-layer WP, engine-first commit; ENGINE projects the two WP-379 per-turn flags hasActedThisTurn+hasHealedThisTurn onto UIState.game as PUBLIC read-only booleans siblings of currentStage — NOT per-player-redacted since acted/healed is observable not secret — + drift pin, UIState is not in computeStateHash so NO sentinel re-pin; CLIENT adds 'healWounds' to UiMoveName + a useTurnActions().canHealWounds() GatingResult predicate turn→main→no-pending→wound-in-hand→not-acted→not-healed with the locked disabled-tooltip precedence + a Heal Wounds button in TurnActionBar Step 2 dispatching submitMove('healWounds',{}); PlayDesktop/PlayMobile derive hasWoundInHand by scanning viewer.handCards for a client-local 'pile-wound' constant drift-tested vs engine WOUND_EXT_ID since components may not import engine runtime code, + drill the two projected flags; out of scope AI/sim integration + a heal notableEvent/overlay cosmetic follow-up + playCard wound-block + Enraging Wounds; User-Visible Surface play.legendary-arena.com D-24026 live-verify; Done 2026-07-15 exec off origin/main @ 08193a6b, -r build 0 + arena-client typecheck 0 + test 923→939 (+16) + engine 1953/0 sentinel+PRE_WP080_HASH byte-identical NO re-pin (UIState not in computeStateHash); inline amendment +12 fixture backfills for the required UIState.game field add (documented recurrence, mechanical); EC-409; D-24181 Active; D-24026 live-verify operator-pending)"]
        ["WP-381 ✅ Wound 'Healing' notableEvent overlay — healResolved center-screen announcement (WP-379/380 cosmetic follow-up; WP-380's Heal Wounds button live-verified — Red Skull game 2026-07-15 gitSha 80ba584 healed turns 16/24/32; adds a 6th notableEvent variant healResolved mirroring mastermindDefeated D-20008; healWounds emits it LAST — minimal-payload type+playerId+woundsHealed+engine-composed narrative no eventId/seq/timestamp D-20001, unconditional G.notableEvents.push like fightVillain; PUBLIC not audience-redacted, rides the existing UIState.notableEvents spread with NO UIState projection change; arena-client NotableEventOverlay renders a 'Healed' chip + verbatim narrative D-20002 via one CHIP_LABELS entry + optional CSS; composeHealNarrative pure golden-tested + NOTABLE_EVENT_TYPES drift 5→6; NO competitive-hash re-pin — no recorded sentinel/golden fixture heals since healWounds is not in ai.legalMoves so finalStateHash + PRE_WP080_HASH stay byte-identical; ~8 files 6 engine + 2 client; out of scope engine gameplay + UIState projection + AI/sim + Healing Factor hero-card wound-KO the deferred generic wound keyword family WP-364 + Enraging Wounds; User-Visible Surface play.legendary-arena.com D-24026 live-verify; Done 2026-07-15 exec off 73d015e5, -r build 0 + arena-client typecheck 0 + test 961→963 + engine 1953→1957/0 sentinel+PRE_WP080_HASH byte-identical NO re-pin; inline amendment +2 eventCardId exhaustiveness in useNotableEventStream; EC-410; D-24182 Active; D-24026 live-verify operator-pending; note WP-380 D-24026 now live-verified via the same Red Skull game gitSha 80ba584 heals turns 16/24/32)"]
        ["WP-273 ✅ Wall-Crawl onRecruit keyword + optional recruit-to-deck placement (first effect-authoring grind target off /coverage's runtime-observed ranking — wall-crawl is the 2nd-highest in-play hollow, 23 obs, 14 heroes/29 lines, Spider sets; makes the printed when-you-recruit-this-Hero-you-may-put-it-on-top-of-your-deck keyword execute: recognizes the existing [keyword:Wall-Crawl] marker + gives it an onRecruit default timing via a new KEYWORD_TIMING_DEFAULTS map so the recognized marker leaves the onPlay path empty and stops firing parse-unrecognized, + adds an additive optional toTopOfDeck arg to recruitHero placing a recruited wall-crawl hero on the top of the player's own deck instead of discard; flips wall-crawl unsupported→executable 29 lines + drops the 23 onPlay hollows; clean self-contained — no new zone model, no pending-choice/board-freeze, no new move so game.test.ts move-count unchanged; builds the first reusable onRecruit execution path; marker already in card data so no data/cards change; bot defaults toTopOfDeck false so the deterministic sweep zone state is unchanged, sentinel re-pinned only on divergence, all coverage artifacts regenerated; dodge/undercover/unleash ecosystem + the arena-client put-on-top toggle deferred; User-Visible Surface dashboard/coverage, D-24026 post-deploy; D-24049)"]
        ["WP-274 ✅ In-play coverage metric — % of in-play hollow observations resolved (dashboard /coverage gets a 2nd headline beside %-executable, OBS-WEIGHTED — each unsupported mechanic contributes its runtime-observed hitCount, resolved when it's executable in the hero ledger — so fixing a high-frequency hollow dodge-37/undercover-20/moonlight-18 moves the needle proportionally, unlike the existing mechanic-counted worst-case rollup that hides partial progress; percentResolved = Σ peakObs[executable] / Σ peakObs[all], peakObs = max(committed-baseline, live), ledger-gated NOT live-obs-gated since the sweep is a sample; reads 0% today 0/140, 26.4% once an OBSERVED mechanic like dodge-37 lands (wall-crawl is NOT in the sweep so it leaves the needle flat); self-contained dashboard layer only — no @legendary-arena import, additive existing headline+table untouched; new useInPlayCoverage composable + a committed obs-baseline seed in-play-hollow-baseline.json that preserves fixed mechanics' obs after they vanish from the live artifact + a deliberate monotonic maintenance script; the dashboard CI gate set lint/typecheck/test:coverage/format:check/build stayed green; stacks on WP-273 for governance only; User-Visible Surface dashboard/coverage D-24026 post-deploy; Done 2026-06-21 commit 8704c782; D-24050)"]
        ["WP-275 ✅ Dodge hand-discard-to-draw move + recognized keyword (second effect-authoring grind target off /coverage's runtime-observed ranking — dodge is the #1 in-play hollow, 37 obs, the single biggest player-facing gap; 25 [keyword:Dodge] lines bkwd-10+vill-15; makes the printed during-your-turn-discard-this-from-hand-to-draw-another keyword execute: recognizes the existing [keyword:Dodge] marker so the recognized keyword leaves the onPlay path empty and stops firing parse-unrecognized, + adds a new non-core dodgeCard({cardId}) move on the recruitHero internal-gating precedent that discards a Dodge card from hand to discard + draws one replacement; ignore-all-other-text is automatic since the card is discarded never played; dodge ∈ MVP_KEYWORDS via a new HAND_ACTION_EXECUTED_KEYWORDS set sibling to WP-273's RECRUIT_TIME_EXECUTED_KEYWORDS, no play-time handler so the play-time visit is a not-hollow no-op; flips dodge unsupported→executable + drops the 37 onPlay hollows; clean self-contained — no new zone model, no pending-choice/board-freeze; builds the first hand-resident optional move; marker already in card data so no data/cards change; the new move bumps game.test.ts move-count 11→12 but is NOT added to the sim's getLegalMoves so the deterministic sweep never dodges and the sentinel finalStateHash is unchanged — the determinism lever, mirrors WP-273's bot decline; honest-partial — the dodge-entangled rider lines Twilight-Ops flip not-hollow per the mixed-hook rule but undercover/unleash stay reported on their standalone lines; teaching the bot to dodge + the arena-client discard-to-draw affordance + undercover/unleash+zone-model are deferred follow-ups; extends WP-273's MVP move-executed category + ledger handler-module mapping; User-Visible Surface dashboard/coverage, D-24026 post-deploy; D-24051)"]

      Notable Events & Overlays
        ["WP-200 ✅ Notable game event log (engine)"]
        ["WP-201 ✅ Notable event overlays (arena client)"]
        ["WP-207a ✅ notableEvents fixture backfill (client)"]
        ["WP-207b ✅ notableEvents test backfill (client)"]

      Simulation Sweep & Analytics Pipeline
        ["WP-181 ✅ Bot decision logging"]
        ["WP-193 ✅ Policy-mode fixture recording (engine + scripts)"]
        ["WP-194 ✅ Setup-matrix sweep runner (scheme × mastermind)"]
        ["WP-195 ✅ Sweep manifest anomaly oracle (engine + scripts)"]
        ["WP-205 ✅ analytics_events server (capture + query endpoints)"]
        ["WP-209 ✅ sweep_runs server (storage + submission + query + nightly)"]
        ["WP-211 ✅ Cross-app sweep type drift test (dashboard ↔ server)"]
        ["WP-304 ✅ Done — Engine-runner host + CLI (Windows Engine Exe Target A / Phase-1 A1): new apps/engine-runner headless CLI that loads the local registry + drives the engine's already-public bot-vs-bot harness (runSimulation + createCompetentHeuristicPolicy) for a scenario+seed; run mode emits SimulationResult JSON, verify mode is a byte-identical determinism self-check; no packaging + no engine/registry source change (the simulation surface is already re-exported); packaging (esbuild + pkg/SEA/bun → .exe), fixture-replay + exe-vs-node finalStateHash parity are explicitly follow-on WPs; EC-334; D-24088)"]

      Dashboard & Operator Analytics
        ["WP-157 ✅ Dashboard scaffold (PrimeVue + Pinia + ECharts)"]
        ["WP-162 ✅ Dashboard daily execution panel + UI polish"]
        ["WP-196 ✅ Net revenue + paid-action errors widgets"]
        ["WP-197 ✅ Live deploy (CF Pages + Access gate)"]
        ["WP-198 ✅ Ops-machine patterns (cadence horizons + status chip + vision card)"]
        ["WP-199 ✅ Daily-driver: STATUS feed + governance KPIs"]
        ["WP-203 ✅ Acquisition + activation + retention surfaces"]
        ["WP-204 ✅ Public-surface health + error monitor + cost watchdog"]
        ["WP-206 ✅ Analytics MOCK→LIVE flip"]
        ["WP-378 ✅ Analytics client emitter — feed the acquisition/activation/retention funnel (arena client; closes the WP-205 producer gap — the guest POST /api/analytics/events + analytics_events table + dashboard reads all exist but nothing writes events, so Traffic Sources/Activation Funnel/Retention Cohorts read 'No data captured'; adds a fire-and-forget analyticsEmitter [opaque sessionStorage session id, RAW user_id server-hashed per D-20502, silent-failure, keepalive; 3-arg explicit-userId signature ratified in D-24173 for layer isolation], a pure channelClassifier [referrer/UTM → direct/search/referral/paid, paid-first precedence D-24175], and one useAnalyticsCapture reactive hub [App.vue, one mount] emitting channel + retention on load + watching auth/match stores for signup/first-match — client-local localStorage detection non-authoritative v1 D-24174, 1-day retention threshold; nine frozen event types; no server/engine/registry/preplan/framework import grep-gated; no server/schema change; EC-407; D-24173..D-24175 Active; Done 2026-07-15 — arena-client typecheck 0 / suite green / all §After greps pass; D-24026 live-verify operator-pending on deploy [dashboard.legendary-arena.com/players])"]
        ["WP-210 ✅ SweepHealthWidget dashboard surface"]
        ["WP-226 ✅ Global mock-mode banner"]
        ["WP-229 ✅ Agent Pipeline page (Architect/Builder/Inspector/Evaluator lanes)"]
        ["WP-238 ✅ Done — Sweep MOCK→LIVE flip (dashboard sweep panels render real GET /api/sweep/latest)"]
        ["WP-241 ✅ Done — Operator auth + Bearer cutover (real Hanko login → Authorization: Bearer on the LIVE fetchers; supersedes the cookie posture, complies with the bearer-only server)"]
        ["WP-373 ✅ Dashboard billing + revenue endpoints (server) — DONE 2026-07-13 (EC-402): first slice of wiring the dashboard's live /api/dash/* family to real data (operator chose billing+revenue first; the endpoints.ts family was mock-only — no server route served it). New apps/server/src/dashboard/ module + /api/dash/* sub-surface, 4 read-only admin-session-required routes (requireAdminSession; no finance role → admin per D-19603): /api/dash/metrics/billing/health (+/sparklines) fulfilling the D-19603 forward contract (BillingHealth-byte-compatible + rate invariants) from stripe_events.process_error + stripe_checkout_sessions.intent_status; /api/dash/revenue + /metrics/revenue deriving the amount from stripe_events.payload->data->object->amount_total (cents) — the price allowlist carries no amount, skip-on-missing never fabricated. Bare {data:T} (D-20503); no migration/write/dashboard-app change (live flip = deploy env). /kpis//players//matches/DAU later; /system/nodes+/alerts blocked on absent infra; executed 2026-07-13 via new apps/server/src/dashboard/dashboardBilling.{types,logic,routes}.ts + server.mjs wiring (4 admin-session-required routes); full server suite fail 0 (154 DB-skip) + DB integration 3/3 on local Postgres; 4 Wired api-endpoints.md rows (D-11804); EC-402; D-24168 Active"]
        ["WP-374 ✅ Dashboard matches + players + KPIs endpoints (server) — second /api/dash/* slice after WP-373 billing+revenue; 3 read-only admin-session-required routes on the WP-373 dashboard module: /api/dash/matches projects the bgio.matches blob (initial_state.G.matchConfiguration scheme/mastermind → registry names, ctx.numPlayers, metadata createdAt/updatedAt/gameover) as a READ-ONLY match-summary projection that EXTENDS the D-24095/24119/24153 bgio-blob-read carve-out (new D-24169 + ARCHITECTURE.md §Persistence Boundary + rules-mirror edit) — projection-only, never state/log/write, gameover absent→in_progress present→hero/villain win; /api/dash/players = players LEFT JOIN aggregated competitive_scores (matchesPlayed/winRate from outcome), status from is_suspended, approximate lastActive; /api/dash/kpis = derivable subset (players/matches/revenue-reusing-WP-373/hero-win-rate) + prior-window trends, DAU OMITTED not fabricated (honest-partial). Bare {data:T}; no migration/write/dashboard-app change. 3 Wired rows (D-11804); /system-nodes+/alerts still blocked on infra; large lane; D-24169"]

      Agent Triage Pipeline
        ["WP-230 ✅ Done — Pipeline page sweep integration (agent lanes consume nightly sweep findings)"]
        ["WP-231 ✅ Done — Scheduled agent triage sessions (Inspector reads sweep → files findings)"]
        ["WP-232 ✅ Done — Agent handoff chain (Inspector → Builder → Architect)"]
        ["WP-233 ✅ Done — Closed-loop sweep verification (Builder fix → re-sweep → Inspector verify)"]
        ["WP-234 ✅ Done — Full-corpus sweep expansion (weekly rotating window beyond 2×2 smoke)"]
        ["WP-235 ✅ Done — Pipeline page sweep health trend view (cadence-aware health-rate trends + healthy-class constant)"]
        ["WP-349 📝 Draft — Sweep health rate = anomaly-free rate (fix the structural 0% from the D-23503 endgame-reached healthy-class; D-24141)"]
        ["WP-239 ✅ Done — Triage dashboard surfaces (inspection findings + handoff lifecycle on the Pipeline Inspector lane, read-only)"]

      Admin & Route Wiring
        ["WP-110 ✅ Admin billing visibility"]
        ["WP-176 ✅ Admin billing auth cutover (shared-secret → session)"]
        ["WP-152 ✅ Wire public profile route in server.mjs"]
        ["WP-159 ✅ Admin session gate (session-based admin auth)"]

      Phase 9 — Profile Surface Follow-ups
        ["WP-105 ✅ Player badges"]
        ["WP-106 ✅ Done — avatar upload pipeline"]
        ["WP-107 ✅ Profile integrity / anti-cheat surface"]
        ["WP-108 ✅ Profile billing & funding history UI"]
        ["WP-296 ✅ Avatar CDN host unification (images.barefootbetters.com → images.legendary-arena.com — the card-image host/bucket; AVATAR_CDN_BASE + closed-origin validateAvatarUrl allowlist both retargeted + migration 021_rewrite_avatar_url_host.sql; api-endpoints catalog + wiki reconciled; D-24083 supersedes the host string in D-10601/D-10602; EC-328)"]
        ["WP-298 ✅ Owner profile avatar upload UI (wires the already-shipped WP-106 POST /api/me/avatar pipeline into MyProfilePage.vue ?route=me — a file-input + 'Upload avatar' control replacing the unusable free-text-only avatar-URL field; new uploadOwnerAvatar(authToken,file) wrapper multipart 'avatar' field no Content-Type, failure code read from body.code not the sibling body.error, + client-local drift-guarded AVATAR_UPLOAD_ERROR_CODES mirror; additive client-only, no server/contract/catalog change; consumes D-10601/D-10602/D-24083 no new D-entry; Lightweight Lane D-24028; EC-329; typecheck 0/arena-client test 618→624/build 0; User-Visible Surface play.legendary-arena.com D-24026 post-deploy)"]
        ["WP-299 ✅ Owner profile edit-page UX polish (avatar preview thumbnail that hides on broken URL, accurate PNG/JPEG/WebP up-to-5MB upload hint sourced from server ALLOWED_MIME_TYPES + MAX_FILE_SIZE_BYTES, live About-me char counter, scoped card layout + one-column link row; presentation-only, no API/contract/store change, no new D-entry; Lightweight Lane D-24028; EC-330; arena-client test 624 unchanged/build 0)"]
        ["WP-300 ✅ Public profile link-preview meta (Open Graph / Twitter Card via the repo's first Cloudflare Pages Function — functions/_middleware.ts uses HTMLRewriter to inject per-player preview meta tags into the SPA shell for ?profile=handle, fail-soft on any API failure/bad handle; buildProfileMeta.ts unit-tested attribute-escaping + §23 guard; extends client-app category to functions/; D-24085 edge-subsurface classification; EC-331; test 624→634/typecheck 0/build 0)"]
        ["WP-301 ✅ Profile loadout library — data model + endpoints (server) (migration 022_create_player_loadouts.sql — player_id FK CASCADE, lagn_json jsonb, visibility CHECK, partial-unique share_slug; loadoutLibrary.{types,logic,routes}.ts + tests; 5 endpoints POST/GET /api/me/loadouts + PATCH/DELETE /api/me/loadouts/:id + guest GET /api/loadouts/:shareSlug public-only; server-side LAGN validate on every write, 50-cap, decorative-not-merit §19b; D-24086; EC-332; server suite 716→746/build 0)"]
        ["WP-302 ✅ Profile loadout library — owner UI + public share view (client) (consumes the WP-301 endpoints, no new server surface; MyProfilePage.vue Saved Loadouts section — paste-LAGN create / list / rename / public-private toggle / delete / copy-share-link; net-new unguarded ?loadout=<shareSlug> SharedLoadoutPage.vue — name + displayHandle + composition summary, 404 on private/missing, never an account id; loadoutLibraryApi.ts Bearer client + guest read + loadoutSummary.ts defensive helper, lagn opaque unknown no @legendary-arena/lagn import, no new npm dep; decorative-not-merit §19b/§19a; D-24087; EC-333; arena-client test 634→650/typecheck 0/build 0; lobby integration deferred WP-303)"]
        ["WP-305 ✅ Owner-page identity fields — accountId / displayName / handleCanonical on OwnerProfileView + an editable display name; EC-335"]

      Architecture & API Governance
        ["WP-116 ✅ Disconnect & reconnect semantics"]
        ["WP-117 ✅ Client routing strategy"]
        ["WP-118 ✅ HTTP API surface catalog"]
        ["WP-119 ✅ Architecture doc hygiene"]

      Complete-Game Testing
        ["WP-158 ✅ Complete-game regression tests (seed-faithful fixture harness)"]

      Cross-App Infrastructure
        ["WP-180 ✅ Build-time version stamping"]

      Multiplayer Play & Match Durability (2026-07)
        ["WP-306 ✅ Setup-contract per-field ext_id validation (henchman id-space fix) — per-field FlatCard.extId checks in parseLoadoutJson/setupContract; henchmen aren't flat cards; EC-336; D-24091"]
        ["WP-307 ✅ Multiplayer-play authentication gate (soft) — server + app gate the native games create/join behind auth; EC-337; D-24092/24093"]
        ["WP-308 ✅ Multiplayer-play hard gate (close the native-lobby bypass) — server.app.middleware.unshift precedes the bgio lobby router so a raw native create returns 401; EC-338; D-24094"]
        ["WP-309 ✅ Durable boardgame.io match storage — custom StorageAPI.Async over the WP-115 pg.Pool, blob→jsonb in a dedicated bgio schema; survives deploy/restart (root-cause fix for the mid-match freeze); EC-339; D-24095"]
        ["WP-311 ✅ Client reconnect & desync auto-resync — connection store + non-blocking banner + resync() (stop/start re-anchors _stateID); EC-340; D-24096"]
        ["WP-312 ✅ Client move-ack watchdog — arm on submitMove, resync when _stateID doesn't advance within the timeout (storm-guarded); closes the connected-desync freeze; EC-341; D-24097"]
        ["WP-326 ✅ Lobby join list shows only joinable matches — filter stale/finished bgio matches out of the join list (client half of stale-match hygiene); EC-356; D-24112"]
        ["WP-327 ✅ Server-side reaper for stale bgio matches — in-process reaper DELETEs finished (1 h grace) / non-gameover (24 h) rows from the bgio schema; 15 min setInterval, SIGTERM stop; EC-357; D-24113"]

      Hero/Villain Effects & Diagnostics (2026-07)
        ["WP-310 ✅ Empowered multi-class form (by [hc:X] and [hc:Y]) — per-class composition sum on the WP-256 substrate; clears the 8th-wonder empowered hollow; EC-342; D-24098"]
        ["WP-314 ✅ Diagnostic export: card-effect provenance — awaitingPlayerInput + recentlyPlayedCards with an outcome, so a 'froze after card X' report names its own cause; EC-344; D-24100"]
        ["WP-315 ✅ Card ability text in UICardDisplay + diagnostic — optional abilityText populated from the registry at setup; rides every display projection; EC-345; D-24101"]
        ["WP-316 ✅ Villain-deck effect narration (Fight/Ambush/Escape, per-target) — executor returns VillainEffectResult[]; the log names the specific hero; byte-identity held (no new notableEvent); EC-346; D-24102"]
        ["WP-317 ✅ Composable gain-resource grant observability logging — interpretGainResourceNode logs each Empowered/Berserk grant (incl +0); the per-effect amount logging WP-295 deferred; EC-347; D-24103"]

      Live-Play HUD & Pending-Choice UX (2026-07)
        ["WP-313 ✅ Victory-pile villain-pick UX — projects pendingVictoryPileCardPick + a client prompt + End-Turn gate; closes The Ebony Blade hard-freeze; EC-343; D-24099"]
        ["WP-318 ✅ Game log panel in the live play HUD — mounts GameLogPanel in PlayDesktop/PlayMobile fed snapshot.log (was replay-inspector-only); surfaces the WP-316/317 narration during play; EC-348; D-24104"]
        ["WP-319 ✅ Per-target hero naming in the fight/ambush center-screen overlay — enriches the fightResolved/ambushResolved narrative (overlay renders it verbatim, no client change); finalStateHash byte-unchanged; EC-349; D-24105"]
        ["WP-321 ✅ Compact, auto-scrolling chronological game log in the live HUD — ~5-6 line window + polite auto-scroll-to-bottom; replaces the abandoned WP-320 newest-first (D-24106 void); EC-351; D-24107"]
        ["WP-322 ✅ Copy, Save, and full-screen Expand for the live HUD game log — Copy→clipboard / Save→game-log.txt / Expand→Teleport overlay; mirrors PileBrowseModal + DiagnosticExportButton; pure client render; EC-352; D-24108"]
        ["WP-323 ✅ Game log name enrichment: card plays + mastermind tactics — played {Name} ({ext-id}) — {printed effect}; fought {Mastermind} and defeated the tactic {Tactic}; new pure logDisplay.ts; EC-353; D-24109"]
        ["WP-324 ✅ Game log name enrichment: remaining log sites — fights/recruits/dodges/escapes/captures/claims/grants → {Name} ({ext-id}) via formatCardRef; EC-354; D-24110"]
        ["WP-325 ✅ Reveal / What If…? test-result logging — revealed {card} (cost N) — {predicate} matched: {action}; the last silent effect path; new pure hero/revealLog.ts; EC-355; D-24111"]
        ["WP-328 ✅ Turn.step.action log numbering (+ effectProvenance parse fix) — {turn}.{step}.{action} prefix (step = start/main/cleanup) via hash-excluded G.logMeta + central pushLog over 17 player-facing push files; live-only (real onBegin); folds the WP-323/324 effectProvenance ext-id regression; EC-358; D-24114"]
        ["WP-329 ✅ Remove the redundant <ol> ordinal from the HUD game log — GameLogPanel .entries list-style:none so the browser ordinal (167.) stops double-numbering the in-text {turn}.{step}.{action}; pure client CSS; EC-359; D-24115"]
        ["WP-330 ✅ Header username label (play) — useAuthNav fetches the owner profile once on sign-in via existing fetchOwnerProfile and resolves displayLabel: displayName → @handleCanonical → My account (non-blocking, silent-fallback, fetch-once); completes WP-175 Amendment 1 now that WP-305/D-24089 ship the fields; client-only; EC-360; D-24116"]
        ["WP-331 ✅ HUD turn header reads the same turn the log numbers by — uiState.build game.turn = G.logMeta.turn ?? ctx.turn so the header stops showing Turn 20 while the log ends 19.2.13 (play→end phase change bumps ctx.turn; end phase has no onBegin); read-only projection; EC-361; D-24117"]
        ["WP-346 ✅ Header username is the profile link — Header.vue merges the auth-nav-display name + the separate 'My profile' link into one <a href=?route=me> so the header reads Home · Cards · name · Sign out (name is the link); useAuthNav/displayLabel untouched; EC-375; D-24136"]
        ["WP-347 ✅ Cross-subdomain Hanko session cookie — both hankoClient.ts wrappers pass cookieDomain=.legendary-arena.com to register() on production hosts (resolveSessionCookieDomain: localhost/*.pages.dev → undefined) so play/dashboard/www share one sign-in (SSO); enabler for marketing WP-033; EC-377; D-24137 (amends D-16002)"]
        ["WP-348 ✅ Sign-out clears the Domain-scoped session cookie — fixes a WP-347 regression: hanko-frontend-sdk 2.6.0 removeAuthCookie() deletes by name with no Domain, so logout() couldn't remove the .legendary-arena.com cookie and Sign out did nothing; signOutCurrentSession now clearHankoSessionCookie() in a finally (both apps); EC-378; D-24140"]
        ["📦 Effect-outcome fill-in (WP-B.2) — reveal-action realized results + move-card/sequence no-ops; deferred per D-24111"]
        ["📝 Structured log-outcome contract + colour-coding (WP-B.3) — G.messages string array → records with a machine-readable outcome field (green/red/yellow); own design review before packets; deferred per D-24111"]

      Competitive Score Submission & Verification (2026-07)
        ["WP-332 ✅ Competitive score submission HTTP endpoint — the score-submission route lands in apps/server (12 route tests + wrapper delegation; competition.logic.ts additive-only); opens the play-to-leaderboard loop; EC-362; D-24118"]
        ["WP-333 ✅ Seat → account identity persistence at match join — migration 024 stamps which account held which seat (UPSERT re-stamp idempotent, FK-guarded); identity substrate for replay ownership; EC-363; D-24120"]
        ["WP-334 ✅ Server-layer faithful reducer-replay — reads a completed match's bgio initialState + log and re-executes through boardgame.io's own reducer (D-24119 carve-out); golden test proves reduced final G equals live final G; EC-364; D-24121"]
        ["WP-335 ✅ Live-match capture harvester — migration 025; captures finished matches' replay artifacts + replayHash→matchId mapping + scenarioKey + owners; EC-365; D-24122"]
        ["WP-336 ✅ Competitive verifier repointed onto the faithful reducer path — reduceReplayByHash / readReplayArtifactByHash; competition DB suite proves the full pipeline; EC-366; D-24123"]
        ["WP-337 ✅ Turns-native competitive scoring — retires the moveCount-as-rounds proxy; turnCount flows engine→server and the rawScore recompute proves it end-to-end; EC-367; D-24125"]
        ["WP-338 ✅ Submit-by-matchId submission + on-demand capture + GET /api/me/scores — a finished match submits by matchId (capture-on-demand + auto-publish + idempotent re-submit); EC-368; D-24126"]
        ["WP-339 ✅ Arena-client submit-after-match + 'My Scores' profile view — competitionApi + useCompetitiveSubmitOnGameover; client-only; EC-369; D-24127"]
        ["WP-340 ✅ Competitive verifier co-owner hardening — by-account ownership lookup so a non-first co-owner's submit verifies; EC-370; D-24128"]
        ["WP-341 ✅ Play-route session hydration (on-gameover submit fix) + restored My-Scores view — client-only; cleared a pre-existing vue-tsc red on main; EC-371; D-24129"]

      Gauntlet Leaderboards (Legends) (2026-07)
        ["WP-342 ✅ Mastermind set-gauntlet boards (server) — outcome persistence + gauntlet read-layer + legends publisher emitting per-gauntlet board snapshots; EC-372; D-24131"]
        ["WP-343 ✅ Legends-board gauntlet index + board panel (client) — SPA renders the gauntlet index + per-board standings; hash-route grammar locked; cleared the pre-existing legends-board vue-tsc red; EC-373; D-24131/D-24135"]
        ["WP-344 ✅ Player-count gauntlet boards (server) — migration 027 player_count column; roster-keyed standings per count from one query; publisher adds lazy per-count boards + index entryCounts/legs; EC-376; D-24134 server half"]
        ["WP-345 ✅ Player-count gauntlet boards + challenge links (legends-board client) — player-count selector, full-roster display, 'Challenge this leg' links into the WP-114 registry-viewer preview; EC-379; D-24134 client half"]
        ["WP-384 ✅ Fixed-hero-pool gauntlet division (server) — migration 034 team_key column + SQL-jsonb artifact backfill (D-24187 carve-out) + one-query {open, fixed} standings (heroCount + 2 budgets riding the catalog; exact-optimum subset search, cap 12 logged) + lazy -fixed board emission + heroPool/fixedEntryCounts; EC-413; D-24187 server half"]
        ["WP-385 ✅ Fixed-hero-pool gauntlet division (legends-board client) — Open | Fixed-Pool Championship division toggle (division = the route), Hero Pool column + championship subtitle on fixed boards, feeder line, claimed-only ★ index chips, unclaimed-guard extension for -fixed deep links; EC-414; D-24187 client half — completes the arc"]
        ["WP-395 📝 Canonical villain + henchmen loadouts for gauntlet qualification (registry + server; gives every mastermind a canonical villain-group + henchmen-group loadout sized per player count and requires it for a replay to qualify as a gauntlet leg. CASUAL PLAY IS UNCHANGED — free selection stays the game as printed; this is a ranked-surface constraint only. No EC yet — design forks open. Reserves D-24199; drafted 2026-07-18)"]
        ["WP-387 ✅ Scenario preview deep-link carries player count (registry-viewer + legends-board) — Shape A of 'play this scenario from the leaderboard': the gauntlet challenge link carries the board's player count into the cards builder so the WP-372 required-count readout matches; new parsePlayerCountFromUrl (envelope, 1..5 else null) + App.vue seeds the editor draft setPlayerCount at mount + buildChallengeUrl optional playerCount; NOT a ?lagn= switch (a seed can't be a valid LAGN); no D-entry (the WP-114 future-extension hook); Shape B save-to-profile deferred; D-24026 dev-verified; EC-416"]
        ["WP-395 📝 Canonical villain/henchmen loadouts for gauntlet legs (registry + server; ScenarioKey is scheme::mastermind::sorted-villain-groups and villain groups are unconstrained across all 41 sets (134 of them, D-24131 'any villain groups qualify'), while PAR is calibrated per scenario key with a validator rejecting sampleSize < 500 — so across 639 scheme×mastermind leg pairs the space is 85,626 scenarios at 1p and 8,205,239,889 at 5p, about 4.1 trillion simulated games. A canonical loadout collapses it to 639 scenarios / ~319,500 games. Since submission fail-closes on par_not_published, free villain choice does not make the ranked surface expensive — it makes PAR unreachable. Ranked gauntlet qualification ONLY; casual play keeps free selection, and hero choice stays free since heroes are not in ScenarioKey. Migration cost is currently zero — competitive_scores is empty — and 103/111 masterminds already declare alwaysLeads. Sequence ahead of any PAR calibration work. Reserves D-24199; drafted 2026-07-18)"]

      Friends & Ranked Trust (2026-07)
        ["WP-350 ✅ Friendships data model + status machine + mutual-clique helper (server) — new legendary.friendships table (migration 028; player_id FK CASCADE, closed status pending/accepted/declined, normalized-pair LEAST/GREATEST unique index, addressee_id/status lookup index); AccountId-keyed send/accept/decline/remove state machine + list helpers + getFriendshipStatus + areAllMutualFriends clique predicate (accepted-pair count == C(n,2); n≤1 vacuous; order/dup-independent); declined→pending is an UPDATE, removeFriend DELETEs; library-only (no endpoint/UI); EC-380; D-24142"]
        ["WP-351 ✅ Friend-request API (/api/me/friends*) — six authenticated-session-required routes over WP-350's logic (send/list-friends/list-requests/accept/decline/remove); resolves @handle→AccountId inbound (findAccountByHandle) and enriches to FriendSummary (handle+displayName, never accountId — FR-2) via one ext_id=ANY($1) round-trip; acting account needs a claimed handle (handle_required); auth-first, session-resolved actor; WP-350 contract untouched; 6 api-endpoints rows; EC-381; D-24143"]
        ["WP-352 ✅ Friends tab on the owner profile (arena client) — a Friends section on ?route=me: add-by-@handle, incoming requests (accept/decline), outgoing pending (display-only), friends list (remove) over WP-351's API; new friendsApi.ts + useFriends composable + FriendsSection.vue mounted in MyProfilePage.vue; handle-only identity on screen (never accountId — FR-2); client error-code mirror + drift test; mutate→refetch; EC-382; D-24144"]
        ["WP-353 ✅ Friend-request email notifications (Brevo transactional, server) — fire-and-forget, fail-open emails on request-received + request-accepted; adds the missing transactional path (POST /v3/smtp/email, createBrevoTransactionalSender, injectable fetch) without touching WP-293's brevoClient.types.ts; notifyFriendRequest{Received,Accepted} = single fail-open boundary (never throws; unconfigured/failed → console.warn no-op); wired void into WP-351's send/accept handlers with no endpoint-contract change; template-driven copy, no accountId in params; EC-383; D-24145"]
        ["WP-354 ✅ Ranked eligibility gate: friendship-clique check at score submission (server) — at submitCompetitiveScoreByMatchIdForRequest, readSeatAccounts + areAllMutualFriends → is_ranked_eligible on competitive_scores (migration 029, default true; n≤1 vacuous so solo stays ranked; fail-safe to Casual on any throw — submission never fails; evaluate-once/immutable FR-7); public ranked leaderboard SELECT+COUNT filter is_ranked_eligible=true, owner My-Scores unfiltered (Casual); scoring math byte-identical; lobby-invite half split to a future WP; EC-384; D-24146"]
        ["WP-355 ✅ Friend abuse controls: block list + request rate limit + re-request cooldown (server) — new legendary.player_blocks table (migration 030; separate model — blocking is never a friendship status, D-24142); blockPlayer INSERTs the block AND severs any existing friendship transactionally; symmetric isEitherBlocked + per-day cap (20) + re-request cooldown (24h) run block→cooldown→rate-limit before sendFriendRequest; 3 new POST/DELETE/GET /api/me/blocks endpoints (handle+displayName, no accountId); FriendApiErrorCode += blocked/rate_limited/request_cooldown; WP-350 contract untouched; block routes mount inside registerFriendshipRoutes (server.mjs untouched); EC-385; D-24147"]
        ["WP-357 ✅ Friend-request email opt-out preference (server) — per-account friend_request_emails boolean on legendary.player_profiles (migration 031, default true); read/written additively via OwnerProfileView/OwnerProfilePatch (12→13 keys) through the existing transactional upsertOwnerProfile; checked in WP-353's sendFriendNotification — opted-out recipient → clean no-op (no send, no warn), governing both friend emails; pref folded into resolveIdentities via LEFT JOIN + COALESCE(..., true); WP-353 signatures byte-identical; packet #6 follow-on; EC-387; D-24149"]
        ["WP-358 ✅ Match friend-invite (server) — a seated player invites an accepted friend by @handle → legendary.match_invites record (migration 032) + fail-open notifyMatchInvite email; accept returns matchId and the client joins via the existing POST /api/match/join (no server-side bgio join); friends-only by design (getFriendshipStatus==='accepted') so anti-spam + block-respecting by construction; 4 authenticated endpoints, MatchInviteView never exposes accountId; lobby-invite half of packet #5; full serialized server suite 934/934; EC-388; D-24150"]
        ["WP-359 ✅ Friend-email opt-out toggle (arena client) — a ?route=me checkbox reading/writing WP-357's friendRequestEmails via the existing owner-profile fetch/save (one ref + one PATCH field + one checkbox); client OwnerProfileView/Patch mirror gains the field; no new endpoint/composable; arena-client typecheck 0 + test 845/845; client follow-on to WP-357; EC-389; D-24151"]
        ["WP-360 ✅ Match-invite UI: invitee core (arena client) — matchInvitesApi (mirrors friendsApi) + useMatchInvites + MatchInvitesSection (?route=me: list pending invites, Accept→hand off to Lobby, Decline) mounted in MyProfilePage; handle-only identity, never accountId; mutate→refetch + client error-code drift mirror; inviter-side invite trigger + full seat-join deferred to a follow-on (LobbyView has no persistent matchId; join needs the seat/credentials flow); arena-client typecheck 0 + test 867/867; EC-390; D-24152"]
        ["WP-366 ✅ Match-invite UI: inviter trigger + join-from-invite (arena client) — completes the deferred WP-360 follow-on: new InviteFriendControl.vue mounted in PlayViewport (self-contained — reads ?match= + useAuthStore, the ViewLoadoutButton idiom; render-gated live-match+authed; never G/UIState) + additive inviteFriendToMatch wrapper & useMatchInvites().invite; MatchInvitesSection Accept upgraded to a real join via a new pure joinMatchFromInvite.ts (injected listMatches/joinMatch/navigate deps) → lobbyApi.listMatches (first open seat) + joinMatch + the joinExisting ?match&player&credentials navigate (no reimplemented join); match-absent→\"no longer available\", full→\"already full\"; handle-only identity (never accountId, FR-2); §23(b) copy; client-only, no server change; arena-client typecheck 0 + test 899/899; EC-396; D-24158"]
        ["WP-369 ✅ Pre-match waiting room: seat-aware 'Waiting for players' invite panel (arena client) — play-view waiting state (operator chose it over a dedicated new room surface): a WaitingForPlayersPanel.vue in PlayViewport that supersedes WP-366's corner InviteFriendControl (deleted), renders only for an authed live match with ≥1 open seat (auto-hides when full/gone; solo never shows), shows '{filled} of {total}' + an @handle invite (reuses useMatchInvites().invite, no new mechanic) + a Copy-join-link ${origin}/?route=lobby&match=<id> (public deep-link, no secret); seat-fill via a new useMatchSeatStatus composable that POLLS lobbyApi.listMatches (open=!seat.name) at SEAT_POLL_INTERVAL_MS=5000, cleared on full/gone/unmount, last-snapshot-preserving — no bgioClient/transport change (matchData not plumbed); LobbyView gains a minimal ?match= row highlight+order; handle-only (never accountId); client-only, no server change; arena-client typecheck 0 + test 908/908; EC-398; D-24163"]
        ["WP-370 ✅ Player-count setup table (registry source of truth) + engine composition block + villain-deck bystander fix (registry + game-engine) — a canonical PLAYER_COUNT_SETUP table (villain groups/henchmen/villain-deck bystanders/heroes = 1·1·1·3 / 2·1·2·5 / 3·1·8·5 / 3·2·8·5 / 4·2·12·6) in packages/registry as the single source of truth; the engine reads it off the CardRegistry object at setup via structural typing (no registry import — layer boundary); validateMatchSetup(input,registry,numPlayers?) BLOCKS villain-group/henchman/hero length mismatches at Game.setup (numPlayers optional so 2-arg callers + table-less mocks skip → zero fixture breaks); game.ts threads ctx.numPlayers into validateSetupData + setup(); the villainDeck.setup null-scheme in-deck bystander fallback reads the table's villainDeckBystanderCount (1/2/8/8/12) not ctx.numPlayers (D-24166 fixes 3/4/5-player under-seeding; scheme override wins); registry-side coupling ships as a pure checkPlayerCountComposition helper (setupContract byte-unchanged); supply-pile bystandersCount floor D-24032 unchanged; 2p sentinel byte-identical (no re-pin); registry 137/0 + engine 1927/0; foundation packet — unblocks WP-371/372; EC-399; D-24165/D-24166"]
        ["WP-371 ✅ Lobby player-count pre-submit check: read-only setup-requirements endpoint (server) + warn/disable-before-submit (arena client) — operator 'expand it' scope change: the drafted server composition GATE was dropped as redundant (WP-370's validateSetupData already blocks a mismatch and POST /api/match/create already propagates it as a 400). Instead a read-only GUEST GET /api/match/setup-requirements returns { requirements: PLAYER_COUNT_SETUP } (server imports @legendary-arena/registry; cacheable; guidance-only NOT a gate) + a lobby pre-check: LobbyView fetches on mount (best-effort) and computes villain-group/henchman/hero mismatches on both create paths (uploaded playerCount/composition + manual numPlayers/CSV lengths) via a new pure playerCountRequirements.ts (computePlayerCountMismatches + formatMismatchWarning), rendering a warning per mismatch and disabling Create (canSubmitFromJson + canSubmitCreate); fetchSetupRequirements shape-guarded → null (never undefined); progressive enhancement (null requirements → inert; engine 400 remains the authority); arena-client imports no registry table; POST /api/match/create/join byte-unchanged; new api-endpoints row (D-11804); arena-client 916/0 + server 797/154/0; EC-400; D-24167 reframed"]
        ["WP-372 ✅ Loadout builder: player-count required counts + warn/export-gate (registry viewer) — completes the player-count arc. The cards.legendary-arena.com Loadout tab gains two computeds off the single-source-of-truth registry table (requiredPlayerCountSetup + playerCountCompositionMismatches via checkPlayerCountComposition/getPlayerCountSetup; NO re-typed literals), a 'For a N-player match: …' required-counts readout, a full-sentence warning per villain-group/henchman/hero mismatch (mirrors the missingRequiredVillainGroupIds pattern), and the mismatch added to both export handlers + both Download :disabled bindings — the warn-in-builder/gate-export half of D-24165; authoring stays free (heroes chosen, never auto-filled); no game-engine import. Packaging refinement: WP-370 exported the table only from the node-only root barrel, so this WP re-exports it from the browser-safe setupContract barrel (playerCountSetup.ts has zero node deps) — viewer Vite build stays browser-safe. registry-viewer 127/0; D-24026 live-verified on the worktree dev server (readout + warnings + Download disabled; reactive 2→4); EC-401; consumes D-24165 (no new D-entry)"]
        ["WP-375 ✅ Solo bot-ally driver: mixed human+bot match (server) — new POST /api/match/create-with-bot + a per-match BotAllyDriver that reserves + auto-readies the bot seat(s) and drives their moves via Master.onUpdate, narrowing the WP-163 autoplay lifecycle to a mixed human+bot cooperative match (human joins seat 0 authed; bots secret-delegated with NO match_seat_accounts row per D-24120; endpoint never calls startMatchIfReady; join-before-return ordering keeps the waiting panel hidden; match tagged botSeats; no new engine variant). Driver acts only on a bot seat's turn / bot-owned pending choice, drains choices via findPendingChoiceMove, never blocks the human (endTurn→advanceStage→bot-faulted), torn down on every exit path; determinism = seeded bot PRNG only. Produces the botSeats tag WP-377 consumes; blocks WP-376. Open at execution: poll-vs-subscribe turn detection, restart re-hydration, metadata storage. Source design DESIGN-SOLO-BOT-ALLY.md; EC-404; reserves D-24170"]
        ["WP-376 ✅ Solo bot-ally lobby affordance (client) — a 'Play with a bot ally' arena-client lobby control (seat count + bot count + policy) → createMatchWithBot (POST /api/match/create-with-bot) → the human joins seat 0 via the authed joinMatch(..., authToken) (NEVER a server-returned credential — the key distinction from the autoplay spectator flow; keeps seat 0's match_seat_accounts row so WP-377's ranked guard + attribution stay correct) → play surface. Co-op copy only (§23(b)); auth-gated; botCount∈1..seats-1 client-validated; reuses buildConfig(); no WaitingForPlayersPanel logic change. Build/merge may precede WP-377 but production exposure is blocked until WP-377 Active (else the DESIGN §5b ranked-farm vector is live). Client-only; EC-405; reserves D-24171"]
        ["WP-377 ✅ Ranked eligibility: seat-count-complete roster guard (server) — hardens computeRankedEligibility so ranked ⇔ readSeatAccounts(matchId).length === seatCount AND areAllMutualFriends(roster), plus a botSeats-tag short-circuit — closes the DESIGN §5b leak where a rowless (bot/guest) seat yields a short roster that is vacuously ranked, letting a 1-human+1-bot match submit a ranked score. Predicate is !== seatCount (NOT < 2) so genuine solo stays vacuously ranked; fail-safe Casual preserved (extends the WP-354 try/catch); by-hash ?? true default untouched; guard lives only in computeRankedEligibility. Landable independently of WP-375 (the seat-count backstop is a no-op for all-human matches; the tag short-circuit activates once WP-375 writes it). No migration (is_ranked_eligible exists, WP-354/029). Gates WP-376 production exposure. Open at execution: seat-count source (ctx.numPlayers recommended / playerZones). EC-406; reserves D-24172 (amends D-24146)"]

      Next Horizons
        ["📦 Core set keyword & ability coverage — get the core set fully playable first, then add sets incrementally (in progress via the effect-authoring grind — e.g. WP-310/316/317)"]
        ["📦 Live PvP matchmaking & match-discovery UX — reconnect/desync resilience now SHIPPED (WP-116 policy + WP-311 reconnect + WP-312 move-ack watchdog); what remains is matchmaking + a match-discovery/join UX"]

      Phase 10 — Debugging, Testing & Troubleshooting
        ["Future-WP-A 📝 Placeholder — replay diff tool"]
        ["Future-WP-B 📝 Placeholder — ops histogram aggregator"]
        ["Future-WP-C 📝 Placeholder — determinism verifier"]
        ["Future-WP-D 📝 Placeholder — server error telemetry"]
        ["Future-WP-E 📝 Placeholder — engine perf profiler"]
        ["Future-WP-F 📝 Placeholder — end-to-end smoke suite"]
        ["Future-WP-G 📝 Placeholder — disconnect stress suite"]
        ["Future-WP-H 📝 Placeholder — synthetic load generator"]

      Governance Drafts
        ["WP-097 ✅ Tournament funding policy"]
        ["WP-098 ✅ Funding surface lint gate"]
        ["WP-042.1 ⏸ Blocked — PostgreSQL seeding checklists"]

      Reference (one-line pointers)
        ["docs/12-SCORING-REFERENCE.md — formula and invariants"]
        ["docs/12.1-PAR-ARTIFACT-INTEGRITY.md — hashing trust model"]
        ["cards.legendary-arena.com — registry viewer (public)"]
        [".claude/CLAUDE.md — root coordination"]
        [".claude/rules/ — 7 rule files"]
        ["EC_INDEX.md — execution checklists (range in Project Baselines)"]
        ["DECISIONS.md — D-NNNN ledger (range in Project Baselines)"]
        ["WORK_INDEX.md — authoritative per-WP audit log"]
```

---

## Progress Summary (counts only)

<!-- ROADMAP-COUNTS:START (generated by scripts/roadmap-counts.mjs — do not hand-edit) -->
| Cluster | Done | Open |
|---|---|---|
| Foundation (Foundation Prompts) | 4/4 | — |
| Phase 0 — Coordination | 9/9 | — |
| Phase 1 — Game Setup | 4/4 | — |
| Phase 2 — Core Turn Engine | 5/5 | — |
| Phase 3 — MVP Multiplayer | 6/6 | — |
| Phase 4 — Core Gameplay Loop | 9/9 | — |
| Phase 5 — Card Mechanics | 7/7 | — |
| Phase 6 — Verification & Production | 14/14 | — |
| UI Implementation Chain | 5/5 | — |
| Content Layer | 3/3 | — |
| Pre-Planning System | 5/5 | — |
| Post-Phase-6 Hygiene | 5/5 | — |
| Phase 7 — Beta, Launch & PAR | 6/6 | — |
| Scoring & PAR Pipeline | 5/5 | — |
| Beta-Launch Pillar | 5/5 | — |
| Engine Hardening | 2/2 | — |
| Client Integration Cluster | 21/21 | — |
| Auth Stack & Profile Surface | 15/15 | — |
| Engine + Server Wiring & Leaderboard HTTP | 3/3 | — |
| Registry Viewer Enhancements | 26/26 | — |
| Phase 8 — Interactive Board Layout | 3/3 | — |
| G-State Extensions | 4/4 | — |
| Monetization Stack | 3/3 | — |
| Engine & Test-Harness Cleanup | 5/5 | — |
| Physical Card Pipeline | 5/5 | — |
| Domain Cutover & Infrastructure | 8/10 | 2 open |
| Public Leaderboard (Marketing) | 2/2 | — |
| Legends Public Scoreboard | 2/2 | — |
| Villain Deck Pipeline | 5/5 | — |
| Villain & Henchman Effects | 14/16 | 2 open |
| Hero Ability Coverage & Markup Pipeline | 52/52 | — |
| Notable Events & Overlays | 4/4 | — |
| Simulation Sweep & Analytics Pipeline | 8/8 | — |
| Dashboard & Operator Analytics | 17/17 | — |
| Agent Triage Pipeline | 7/8 | 1 open |
| Admin & Route Wiring | 4/4 | — |
| Phase 9 — Profile Surface Follow-ups | 11/11 | — |
| Architecture & API Governance | 4/4 | — |
| Complete-Game Testing | 1/1 | — |
| Cross-App Infrastructure | 1/1 | — |
| Multiplayer Play & Match Durability (2026-07) | 8/8 | — |
| Hero/Villain Effects & Diagnostics (2026-07) | 5/5 | — |
| Live-Play HUD & Pending-Choice UX (2026-07) | 15/15 | — |
| Competitive Score Submission & Verification (2026-07) | 10/10 | — |
| Gauntlet Leaderboards (Legends) (2026-07) | 7/8 | 1 open |
| Friends & Ranked Trust (2026-07) | 18/18 | — |
| Next Horizons | 0/2 | 2 📦 queued |
| Phase 10 — Debugging, Testing & Troubleshooting | 0/8 | 8 📝 placeholders |
| Governance Drafts | 2/3 | 1 ⏸ |
| **Total** | **380/387 WP ✅** (+ 4/4 Foundation Prompts) | 1 ⏸, 6 open |

**Open / blocked WPs (derived from WORK_INDEX, 7):** WP-042.1 ⏸ blocked; WP-349 open; WP-391 open; WP-390 open; WP-395 open; WP-393 open; WP-394 open.
<!-- ROADMAP-COUNTS:END -->

> Counts only. Description, deps, baselines, hashes — all in the mindmap line above or in `WORK_INDEX.md`. The table inside the markers above is **generated** by `scripts/roadmap-counts.mjs` (sole writer; D-24001), derived from `WORK_INDEX.md` status × mindmap cluster membership — it is no longer hand-maintained, so it no longer drifts. Status is authoritative from `WORK_INDEX.md`; cluster membership is authoritative from the mindmap nodes above. The generator **fails loudly** on a WORK_INDEX WP with no mindmap node (D-24002), so no work packet can be silently uncounted.
>
> **Counting convention (encoded by the generator, not redefined):** each row counts the distinct `WORK_INDEX.md` work-packets homed in that cluster (combined lines like `WP-005A/B` count their members; range lines like `WP-043..047` expand to each member; the Phase-6 `WP-048..051` line is a cross-reference — any node containing `(see ` — counted once under Scoring & PAR). Foundation = 4 Foundation Prompts (not WPs), reported as a separate `+N/N` addend. `Next Horizons` (3 📦) and `Phase 10` (8 📝) are forward-looking nav placeholders rendered `0/N`, not WPs; the `Reference (one-line pointers)` cluster is navigation and is excluded from the table. Open and blocked WPs are enumerated on the generated summary line inside the markers above (single source; not restated here).

---

## Project Baselines (canonical — single source; do not restate elsewhere)

- **Phase 3 Gate:** Closed (D-1320)
- **Phase 6 Gate:** Closed 2026-04-19 — tag `phase-6-complete` at `c376467`
- **Engine test baseline:** `1872 / 0 / 0` (438 suites)
- **Registry test baseline:** `130 / 0 / 0` (14 suites)
- **Server test baseline (no-DB):** `753 / 0 / 103` (856 total; 151 suites — the 103 are DB-gated non-silent skips; with `TEST_DATABASE_URL` + migrations the full serialized suite is `856 / 0 / 0`, last run 2026-07-09 under EC-376)
- **arena-client test baseline:** `809 / 0 / 0` (115 suites)
- **Dashboard test baseline:** `409 / 0 / 0` (15 suites)
- **Registry-viewer test baseline:** `110 / 0 / 0` (23 suites)
- **legends-board test baseline:** `40 / 0 / 0` (8 suites)
- **Preplan test baseline:** `52 / 0 / 0` (7 suites)
- **lagn test baseline:** `21 / 0 / 0` (8 suites)
- **vue-sfc-loader test baseline:** `11 / 0 / 0`
- **engine-runner test baseline:** `19 / 0 / 0` (2 suites)
- **replay-producer test baseline:** `4 / 0 / 0` (2 suites)
- **DECISIONS.md range:** `D-0203..D-24139` (870 entries; extends through the 2026-07-09 gauntlet/SSO arcs)
- **EC range:** `EC-001..EC-377` (extends through WP-347)

> All twelve `pass / fail / skipped` figures above are a live test-run at HEAD (`5843b7dd`) on 2026-07-10 (`pnpm --filter <pkg> test`, fresh worktree, `pnpm -r build` first), not STATUS-derived. Per-row `post-WP-NNN` attributions are gone on purpose: suites grow between doc passes, so the HEAD sha + date above is the provenance. The D/EC ranges are derived from `DECISIONS.md` entry headings and `docs/ai/execution-checklists/` filenames at the same HEAD.

---

## Next Unblocked (ordered)

1. **WP-345 — Player-count gauntlet boards + challenge links (legends-board client)** — drafted 2026-07-09; its hard-dep WP-344 (the D-24134 server half) executed the same day. Execution-prep landed 2026-07-10 (EC-379 + session prompt) — **the next step is the execution session itself.** It renders the `entryCounts` / `legs` / `players[]` data WP-344 already publishes, plus the per-leg "Challenge this leg" links into the WP-114 registry-viewer preview.
2. **Finish core-set ability coverage** — in progress via the `/coverage`-driven effect-authoring grind on the composable-primitive substrate (D-24029): new mechanics land as data rows, not engine edits (recent examples: WP-310 / WP-316 / WP-317). Goal unchanged — the `core` set fully playable on play.legendary-arena.com, additional sets incrementally.
3. **Live PvP matchmaking & match-discovery UX** — the resilience half has shipped (WP-116 reconnect policy, WP-309 durable bgio match storage, WP-311 client reconnect/desync auto-resync, WP-312 move-ack watchdog, WP-326/327 stale-match hygiene); what remains is matchmaking plus a match-discovery/join UX.
4. **Gauntlet progress on profiles + champion badges** — backlog, to be drafted and numbered (the non-checkbox backlog bullet in `WORK_INDEX.md`; source D-24131 §8b): owner-profile per-gauntlet checklist + public-profile completed-gauntlet badges via the existing `badges[]` field.
5. **Phase 10 placeholders** — promote a candidate to a real WP only when a concrete production-debugging need motivates it.
6. **WP-042.1** — unblocks when Foundation Prompt 03 is revived.

**Recently completed (2026-07-08..09):** the competitive score-submission arc **WP-332..341** (submission endpoint → seat→account identity → faithful reducer-replay → verifier repoint → turns-native scoring → submit-by-matchId + `GET /api/me/scores` → client submit-after-match + My-Scores → co-owner hardening → session-hydration fix) and the gauntlet leaderboard arc **WP-342/343/344** (set-gauntlet boards server + client, player-count server half), plus **WP-346** (header username is the profile link) and **WP-347** (cross-subdomain Hanko SSO cookie). Per-WP detail lives in the two 2026-07 mindmap clusters above and `WORK_INDEX.md` — not restated here (the dated per-WP ladders this block used to carry drifted a month stale; cluster granularity + a pointer is the durable form).

**Blocked (cannot start):**
- ⏸ WP-042.1 — Deferred PostgreSQL seeding checklists; unblocks when Foundation Prompt 03 (seed runner + migrations) is revived.

**Pending (WP files not yet authored):**
- Gauntlet progress on profiles + champion badges (backlog bullet in `WORK_INDEX.md`; D-24131 §8b)
- Direct-into-lobby challenge prefill (named future WP in WP-345 §Out of scope)

---

## Phase Closure Records

### Phase 6 (Closed 2026-04-19)
- Tag: `phase-6-complete` @ `c376467`
- Engine baseline at close: `604 / 132 / 0`
- Server baseline at close: `124 / 0 / 54`

### Phase 3 Gate
- Closed (D-1320)

---

## WP Disambiguators

- **WP-042 vs WP-042.1** — WP-042 is intentionally scope-reduced per D-4201; the four PostgreSQL seeding checklist sections are partitioned to a sibling sequel WP-042.1 (Governance Drafts). WP-042 is **complete**; WP-042.1 is **blocked** on FP-03 revival. Not a partial undo.
- **WP-128/129/130 vs WP-131 EC slot** — WP-128/129/130 reserved EC-131/132/133 by chronological-tail ordering; WP-131 (next free WP slot) retargets to EC-134 per the locked WP-keyed-EC retarget precedent.
- **WP-207a vs WP-207b** — both backfill the arena client for the new `UIState.notableEvents` projection (WP-200/201): 207a = JSON fixtures, 207b = test backfill. Sequential halves of one client follow-up, not a renumber.
- **arena-client typecheck-drift recurrences (WP-166 → WP-207a/b → WP-227)** — three distinct WPs that each restored arena-client `vue-tsc` green after an engine field-add; each is a separate recurrence of the same pattern, not a re-do of the prior. (WP-207a/b is the 2nd; WP-227 the 3rd.)

---

*Last updated: 2026-07-10 (Project Baselines refresh — the block carried a 2026-06-09 live-run (`2e99369`): six packages, engine `1177`, server `477/0/66`, DECISIONS through D-22801, ECs through EC-260. Re-run at HEAD `5843b7dd` on a fresh worktree (`pnpm install` + `pnpm -r build` + `pnpm --filter <pkg> test`): **all twelve** test-bearing packages now listed (adds legends-board, preplan, lagn, vue-sfc-loader, engine-runner, replay-producer), all green — engine `1872/0/0`, server no-DB `753/0/103` (856 total; full DB-gated `856/0/0` per EC-376), arena-client `809/0/0`, dashboard `409/0/0`, registry-viewer `110/0/0`. Ranges re-derived: `D-0203..D-24139` (870 entries), `EC-001..EC-377`. Dropped the per-row `post-WP-NNN` attributions — suites grow between passes, so HEAD sha + date is the provenance now. Prose-only; `roadmap:counts:check` green.)*

*Prior: 2026-07-09 (Next Unblocked refresh — the section had drifted a month stale: the "Score submission HTTP wiring" item was shipped in full by WP-332..341, "Live PvP matchmaking & reconnect" had its resilience half shipped (WP-116/309/311/312/326/327), and the agent-triage "complete" note plus the 2026-06-07..10 dated per-WP ladders were history duplicating the mindmap/WORK_INDEX. Rewritten: WP-345 (now unblocked — WP-344 executed) leads the ordered list; core-set coverage reframed onto the D-24029 grind; matchmaking item narrowed to what actually remains; the D-24131 §8b profiles/badges backlog item added; Recently-completed collapsed to cluster granularity with a pointer instead of dated ladders; Pending block now names the two known unauthored WPs. Prose-only — no mermaid node or generated-table change; `roadmap:counts:check` green.)*

*Prior: 2026-07-09 (14-WP mindmap orphan backfill — `roadmap:counts:check` failed on `main` naming **WP-332..345** (none had been noded since 2026-06-20; the executing ECs' locked file sets omitted the mindmap). Added two new clusters: **Competitive Score Submission & Verification (2026-07)** (WP-332..341, all ✅) and **Gauntlet Leaderboards (Legends) (2026-07)** (WP-342/343/344 ✅ + WP-345 📝 drafted). Removed the now-shipped "Score submission HTTP wiring" 📦 Next-Horizons placeholder (WP-332/338/339/341 closed that loop). Also fixed a WORK_INDEX parser mis-key: the D-24131 §8b backlog bullet ("Gauntlet progress on profiles") was a checkbox row with no own WP id, so the generator keyed it by its first prose WP mention and falsely flipped **WP-339 → open**; the bullet is now a plain (non-checkbox) list item until drafted and numbered. Generated table: Total **339/341 WP ✅**; open = WP-345, blocked = WP-042.1.)*

*Prior: 2026-06-20 (node-icon hygiene — flipped the **WP-270 📝 → ✅** node to match its WORK_INDEX state: the consumer-half registry-viewer mechanic filter surface shipped via #415, but its EC's locked file set omitted the mindmap so the node stayed Drafted. Pure navigation hygiene; the count table is derived from WORK_INDEX and was already current, so `roadmap:counts --write` produced no table change and `roadmap:counts:check` is green. Prior update: the WP-268/269/270/271 mindmap orphan backfill — see git history.)*

*Prior: 2026-06-12 (WP-241 ✅ done — Dashboard Operator Auth + Bearer Cutover. The dashboard's mock login is replaced with real Hanko auth (mirroring `apps/arena-client`: local-copy `auth/hankoClient.ts` + the WP-160 token store + `<hanko-auth>`), and the three LIVE fetchers attach `Authorization: Bearer` via the shared `services/authToken.ts` seam instead of `credentials:'include'` — superseding D-20601's cookie posture so the client complies with the bearer-only server (D-11202). Added the **WP-241** node to Dashboard & Operator Analytics; the generated count table moved **13 → 14/14**, Total **237/238 WP ✅** (WP-241 was a latent orphan — drafted after WP-240's generator shipped — now noded). D-24003/D-24004/D-24005 Active. Operator cutover (post-merge): set `VITE_HANKO_TENANT_BASE_URL` + `VITE_API_BASE_URL=https://api.legendary-arena.com` + `VITE_USE_MOCKS=false` in CF Pages + redeploy.)*

*Prior: 2026-06-12 (WP-240 ✅ done — Roadmap Count-Table Generator. The Progress Summary count table is now **generated content** bounded by the `ROADMAP-COUNTS` start/end markers, derived by `scripts/roadmap-counts.mjs` from `WORK_INDEX.md` status × mindmap cluster membership (sole writer; hand-edits inside the markers are overwritten by the next run). Added the missing **WP-236** node (Phase 2 — Core Turn Engine) + the **WP-240** node (Domain Cutover & Infrastructure) — both were orphans the loud-fail gate (D-24002) named on the first run. The generated table corrected the WP-238 count drift the prior note flagged: Dashboard & Operator Analytics **12 → 13/13**, Total **WP ✅ 236/237** (= the raw WORK_INDEX checkbox count). Weekly cron `.github/workflows/roadmap-counts.yml` (`'0 6 * * 1'`) PRs the regenerated table on diff. D-24001/D-24002 Active.)*

*Prior: 2026-06-11 (WP-238 ✅ done — Sweep MOCK→LIVE flip. New `sweepLiveFetchers.ts` (`fetchSweepHealthLive`) mirrors the WP-206 analytics live-fetch pattern for the single object-envelope `GET /api/sweep/latest` resource (shared `isLiveModeEnabled()` gate, synchronous cached-`Ref` getter, fail-silent, `credentials:'include'` session parity, `{latest,recentRuns}` object guard); `mocks.ts` gates the existing `fetchSweepHealth` alias via the existing `liveMode` (no second env gate). `SweepHealthWidget.vue`/`PipelinePage.vue` byte-identical; MOCK stays the local-dev/test default. Added a WP-238 ✅ node under Dashboard & Operator Analytics; D-23801/D-23802 Active. Gates: dashboard test 247→274 / 0 fail, `vue-tsc --noEmit` 0, build 0. NOTE: the pre-existing Progress Summary count drift (the counting convention line still reads "WP-231..235 pending" though those nodes show ✅) was left as-is — not introduced or reconciled by this WP.)*

*Prior: 2026-06-10 (WP-235 drafted + revised: the Pipeline page sweep HEALTH trend view (cadence-aware health-rate trends) WP + EC-268 authored, reserving D-23501/D-23502/D-23503. A metric-review pass found the original aggregate anomaly-rate degenerate (`sum(anomalyCounts) === cellCount`) — and the EXISTING health-rate KPI/Architect-lane likewise ≡ 0 on live data; revised to a true health rate (`endgame-reached / cellCount`) via a narrow documented healthy-class-constant exception to D-20703 (D-23503), repairing both degenerate sites. Flipped WP-235 📦 → 📝 in the mindmap + moved it Pending → Drafted; Agent Triage Pipeline open `1 📦 → 1 📝`; Total `1 📦 → 1 📝 + 1 ⏸`. The only remaining Agent Triage Pipeline step, now authored and ready for execution.)*

*Prior: 2026-06-10 (status reconcile: WP-231/232/233/234 ✅ done — the Agent Triage Pipeline's scheduled-triage → handoff-chain → closed-loop-verify sequence plus the parallel-safe full-corpus weekly sweep expansion all landed on `origin/main`. Flipped 📦→✅ in the mindmap + bullet list; Agent Triage Pipeline cluster 1/6 → 5/6 ✅; Progress Summary **226/232 → 230/232 WP ✅**, 5 📦 → 1 📦 (only WP-235 trend view remains), 1 ⏸. Next Unblocked item 4 narrowed to WP-235.)*

*Prior: 2026-06-09 (session add: WP-230 ✅ done — Pipeline page sweep integration; the Pipeline page's agent lanes now consume nightly sweep findings via `useSweepHealth` (Inspector anomalies, Builder fatals, Architect health rate, Evaluator freshness + trend), with priority escalation on real findings. Agent Triage Pipeline cluster now 1/6 ✅; Progress Summary **226/232 WP ✅**, 0 📝, 5 📦, 1 ⏸. Next Unblocked reordered (WP-230 removed; core-set ability coverage now #1).)*

*Prior: 2026-06-09 (session add: WP-229 ✅ folded into Dashboard & Operator Analytics; new **Agent Triage Pipeline** cluster added with WP-230 📝 drafted + WP-231..235 📦 pending — the simulation-sweep-to-agent-lane pipeline. WP-230 wires existing `useSweepHealth` into the Pipeline page; WP-231..233 are sequential triage → handoff → verify; WP-234 full-corpus expansion is parallel-safe; WP-235 trend view depends on WP-230. Progress Summary updated: **225/232 WP ✅**, 1 📝, 5 📦, 1 ⏸. Next Unblocked reordered with WP-230 at #1.)*

*Prior: 2026-06-09 (**FULL reconciliation to `origin/main` HEAD `2e99369`**: folded WP-181..228 plus the pre-existing WP-015A gap into the mindmap — 49 work-packets across **4 new clusters** (Villain & Henchman Effects, Hero Ability Coverage & Markup Pipeline, Notable Events & Overlays, Simulation Sweep & Analytics Pipeline) plus extensions to Phase 4/5, Content Layer, Client Integration, Auth Stack, Registry Viewer Enhancements, Engine & Test-Harness Cleanup, and a renamed/expanded **Dashboard & Operator Analytics**. Rebuilt the Progress Summary to one row per cluster — **225/226 WP ✅, 1 ⏸** (WP-042.1). Re-derived Project Baselines from a live test-run at HEAD (engine 1177, registry 115, registry-viewer 39, server 477/0/66, arena-client 517, dashboard 191) and bumped the DECISIONS range to D-22801 + EC range to EC-260. This supersedes the 2026-06-08 staleness flag below — the mindmap is now current to HEAD.)*

*Prior: 2026-06-08 (session add: WP-227 ✅ arena-client vue-tsc green — WP-214/222 UIState/UICityCard fixture + prop backfill, the 3rd recurrence of the engine-field-add → client-typecheck-drift pattern after WP-166/207; WP-225 ✅ hero draw markup noted under Recently Completed. **Staleness flag:** this was a targeted single-session add, NOT a full catchup. The mindmap is still behind `origin/main` — the last full reconciliation was WP-180 (2026-05-26); WP-181..226 are not yet folded into the mindmap, and the Progress Summary counts (181/195) + Project Baselines remain frozen at the WP-180 state. A full catchup is a separate pass.)*

*Prior: 2026-05-26 (roadmap catchup: added 25 missing WPs to mindmap — WP-086/096/116-119/153-158/162/164/167-173/175/178-180; added Next Horizons section with 3 forward-looking strategic directions (card keyword coverage, live PvP reconnect, score submission wiring); trimmed Recently Completed to one-liners per checklist rule; total 181/195 ✅.)*
