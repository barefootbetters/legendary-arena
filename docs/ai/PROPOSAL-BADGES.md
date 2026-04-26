# PROPOSAL — Badge System: Issuer Model + Gameplay-First Criteria Slice

**Status:** ✅ **RATIFIED 2026-04-26** — D-1004 inserted into `DECISIONS.md` and `DECISIONS_INDEX.md`. Composes with D-0006 (veteran recognition; PROPOSAL-VISION-25-AMENDMENT.md). WORK_INDEX WP-105 placeholder updated. Tier 1 first slice expanded from 6 to 10 badges (6 per-run gameplay + 4 veteran recognition).

This file is retained as the historical proposal record. Live decision text is in `DECISIONS.md` D-1004 (and D-0006 for the veteran branch). Do not edit the proposal text below; raise a new proposal if revisiting.

---

**Date:** 2026-04-26
**Informs:** WP-105 (deferred placeholder, "Player Badges Data Model & Display")
**Authority chain:** `docs/ai/ARCHITECTURE.md` → `docs/01-VISION.md` §22–§25 (revised) → `DECISIONS.md` D-0005, D-0006, D-1004 → this proposal

---

## 1. Why this proposal exists

Two unresolved items currently block WP-105 from being drafted at the right grain:

1. **Issuer model unresolved.** WP-105's placeholder in `WORK_INDEX.md` records the gap explicitly: *"decision on issuer model (admin-only vs rule-driven) — currently unresolved."* A recent badge-system sketch assumed a single answer ("Legendary Arena is the sole authoritative artifact") without distinguishing badge classes that have fundamentally different trust surfaces (rule-driven gameplay achievement vs. admin attestation of community work vs. external-system attestation of GitHub merges).
2. **Vision-§25 conflict.** The same sketch leaned heavily on volume criteria — *"play 100 games"*, *"50 games with average turn time under X"*, *"1,000 lifetime VP"*, *"50+ multiplayer games as the same registered party"*. D-0005 (ratified 2026-04-24 during DESIGN-RANKING review) explicitly forbids volume-based recognition: *"raw volume-based scoring is forbidden by §25 and by this decision."* §25's carve-out for non-ranking telemetry does **not** rescue badges, because a badge is by construction a title-awarding artifact.

This proposal answers both questions narrowly enough that WP-105 can be drafted at its target grain (≤7 files, single table, read-only display) without absorbing scope it cannot honor.

---

## 2. Draft DECISIONS entry

> Drop-in text for `DECISIONS.md` once approved. Numbering slot is open; the next entry in **Growth & Governance** is **D-1004**.

### D-1004 — Badge Issuer Model Is Tiered; Gameplay Badges Ship First

**Type:** Growth / Governance
**Packet:** WP-105 (and successors WP-105a..n if a split is later authorized)
**Date:** 2026-04-26

**Decision:** Legendary Arena badges are issued under a **tiered issuer model**. Three issuance tiers are defined, each with a distinct trust surface, verification path, and storage contract. WP-105 (and any single-WP successor) ships **only Tier 1 (rule-driven gameplay badges)**. Tiers 2 and 3 are deferred to dedicated, separately-scoped Work Packets and may not be conflated with Tier 1 in the same migration, table, or issuance code path.

**The three tiers:**

| Tier | Class | Issuer | Trust substrate | Source of truth | First WP |
|---|---|---|---|---|---|
| 1 | Rule-driven gameplay | Engine / server (automated) | `legendary.competitive_scores` (immutable per D-5302) + `ScoreBreakdown` fields (engine-computed per D-5301) | Replay verification | WP-105 |
| 2 | Admin-attested community | Operator (manual) | Out-of-band evidence + admin signature | Operator review | Future WP — not before WP-105 lands |
| 3 | External-system-attested | Webhook / CI ingestor | GitHub merges, pull request closures, schema-file blame | Third-party API + signed event | Future WP — depends on Tier 2 admin-auth contract |

**Constraints binding all tiers:**

- **Anti-volume (§25 / D-0005).** No badge in any tier may be issued solely on a count of games played, hours played, lifetime VP, or any other volume metric. Every badge criterion must be either (a) quality-gated relative to a published scoring contract (PAR / `ScoreBreakdown`), or (b) breadth-gated across distinct quality-verified achievements (e.g., "sub-PAR completions on N distinct `ScenarioKey`s"), or (c) categorically discrete and out-of-band-verified (e.g., "merged at least one PR that shipped a card") — never (d) "performed action X at least N times."
- **No live-PvP framing.** Badge titles, criteria text, and flavor must conform to §23(b) — players never act as opponents inside a match. Hero-vs-villain framing is permitted; head-to-head sport metaphors (e.g., "Mixed Doubles", "ladder duel") are not.
- **Sole-issuer scope is in-platform only.** Legendary Arena is the sole issuer of Legendary Arena badges *as displayed on the player profile and in-game surfaces*. Public canonical badge URLs (`legendary-arena.dev/badges/<slug>`), cross-platform mirroring (LinkedIn, Steam, Credly), and any outward-facing badge-as-credential surface are **explicitly deferred** to a post-WP-105 governance review that includes a Marvel-IP licensing check. WP-105 must not bake any URL-routing or credential-export shape into its first migration or DTO.
- **Issuance is append-only.** Badge rows are write-once. Revocation is recorded as a *new* row of class `revocation` referencing the original `badge_id`; the original row is never UPDATEd or DELETEd. (Mirrors D-5302's competitive-records immutability precedent.)

**Tier 1 — issuance path (the only one shipping in WP-105):**

- **Trigger surface:** a Tier 1 badge is awarded by an engine-or-server function that reads an immutable `legendary.competitive_scores` row (post-INSERT) and the corresponding `ScoreBreakdown` from `score_breakdown jsonb`. The function is a pure projection over already-verified data; it never re-executes a replay and never recomputes a score.
- **Trust inheritance:** because every numeric input traces to engine code (D-5301: server is enforcer, not calculator) and the source row is immutable (D-5302), Tier 1 badge issuance inherits the existing competitive-submission trust surface. **No new trust-surface decisions are required to ship Tier 1.**
- **Determinism:** badge eligibility is a deterministic function of `(ScoreBreakdown, ScoringConfigVersion, scenarioKey, playerId)`. A given competitive record produces the same eligibility set on every read. (Re-derivation under a *new* `ScoringConfigVersion` is a future feature; it would create new badge rows, never modify old ones — same precedent as D-5306d.)
- **Categories permitted in Tier 1:** "Gameplay" only. The original five-category sketch (Gameplay, Contests & Challenges, Community & Support, Creator & Artist, Contributor & Developer) is **not** ratified by this decision — only Gameplay has a Tier 1 issuance path. Other categories may exist later under Tier 2 / Tier 3 but are not assumed.

**Rationale:**

1. **Trust surfaces don't compose.** A single-issuer model presented as "Legendary Arena is the sole authority" hides the fact that the *evidence* for a Bug Hunter badge (GitHub PR merge), a Community Mentor badge (a stream happened), and a Sub-PAR Run badge (an immutable replay row) come from three categorically different places. Treating them as one system means the weakest link defines the whole system's trust ceiling. Tiering them keeps Tier 1's high-trust substrate clean.
2. **Vision §25 is anti-volume by construction.** D-0005 hardened §25 in response to a draft that proposed cumulative-win ranking. Volume-based badge criteria are the exact same anti-pattern in a different surface. Disallowing them at the decision layer prevents the pattern from re-entering through a side door.
3. **Live-PvP framing leaks into recognition systems easily.** "Mixed Doubles", "ladder", "duel", "rival" all evoke head-to-head sport. The cooperative gameplay model is preserved by §23(b) and reinforced by D-0005; badge naming has to inherit that.
4. **Public-URL / credential-export is a separate problem.** Outward-facing badge URLs are simultaneously a Marvel-IP question (badges named after Marvel characters, mirrored on LinkedIn/Credly, are derivative branding outside the in-game license envelope) and a UX-routing question (slug schema, redirect contracts, OG-image generation). Bundling them with the data model risks shipping a migration whose shape is wrong for whichever answer comes back from licensing review. Defer.
5. **Append-only mirrors the rest of the platform.** D-5302 (competitive records), D-5304 (idempotent retry), D-10302 (replay blobs as immutable PK) all treat issued artifacts as write-once. Badges follow the same pattern; revocation-as-new-row preserves audit history.

**Implementation (Tier 1, WP-105 scope):**

- New table `legendary.player_badges` (locked column structure to be specified in the WP-105 draft per the ≤7-file budget). Minimum columns implied by this decision: `badge_id bigserial PRIMARY KEY`, `player_id bigint NOT NULL REFERENCES legendary.players(player_id)`, `badge_key text NOT NULL` (stable slug; e.g., `gameplay.sub-par-run`), `tier int NOT NULL CHECK (tier IN (1, 2, 3))` (only `1` accepted at INSERT in WP-105), `source_kind text NOT NULL CHECK (source_kind IN ('competitive_score', ...))` (only `'competitive_score'` accepted in WP-105), `source_ref bigint NULL` (the originating `competitive_scores.submission_id` for Tier 1; constrained `NOT NULL WHEN source_kind = 'competitive_score'`), `awarded_at timestamptz NOT NULL DEFAULT now()`, `awarded_under_config_version int NOT NULL`, `is_revoked boolean NOT NULL DEFAULT false` (set true only by a sibling revocation row's trigger; original row's other columns never change).
- New issuance function `issueTier1BadgesForSubmission(submissionId, database) → BadgeId[]` invoked by `submitCompetitiveScoreImpl` AFTER the step-15 INSERT succeeds (or AFTER the race-recovery `wasExisting` retrieval — re-issuance is a no-op due to a `UNIQUE (player_id, badge_key, source_ref)` constraint). The function reads the immutable competitive row, projects eligibility from `ScoreBreakdown`, and INSERTs zero or more badge rows in a single transaction.
- Read surface: `getPlayerBadges(accountId, database) → PlayerBadge[]` consumed by the public profile page (WP-102) and owner profile (WP-104) as a read-only list. WP-102's existing "Badges — coming soon (WP-105)" empty-state stub is replaced by the live list when WP-105 lands.
- Forbidden in WP-105: any HTTP route under `/badges/*`; any export-format DTO (Open Badges, Credly JSON, etc.); any cross-platform sharing logic; any admin issuance endpoint; any `tier IN (2, 3)` row ever inserted; any UPDATE path against `legendary.player_badges`.

**Status:** Draft (proposed 2026-04-26). On acceptance: Active for WP-105 and any successor that touches Tier 1 issuance.

**Citation:** `WORK_INDEX.md` (WP-105 placeholder, issuer-model unresolved); `docs/01-VISION.md` §23(b), §24, §25; D-0005 (Asynchronous PvP / anti-volume); D-5301 (Server is enforcer, not calculator); D-5302 (Competitive records immutable); D-5304 (Idempotent retry); D-5306d (Re-scoring under new config creates new records); `packages/game-engine/src/scoring/parScoring.types.ts` (`ScoreBreakdown`, `ScoringInputs`, `ScenarioKey`).

---

## 3. Corrected criteria sketch — gameplay-only first slice

> All criteria below are **predicates over `ScoreBreakdown` and the immutable `legendary.competitive_scores` row**. None are volume metrics. Each is replay-verified by D-5301 / D-5302 inheritance — the engine already proved the inputs.

### Criterion-shape rules

For Tier 1, every badge has the form:

```
eligible(submission) ⇔ predicate(submission.scoreBreakdown, submission.scenarioKey, submission.parVersion)
```

where `predicate` is a pure function with no side effects, no I/O, no clock reads, and produces the same boolean for the same inputs forever. (Future config versions produce *new* badges, not retroactive flips on old ones.)

### Card tie-in rule

Every Tier 1 badge has a `cardSlug` that resolves to a real card in `data/cards/*.json`. **Card references are not invented in this proposal** — concrete pairings are listed below as candidates marked `TBD: verify against registry` and locked at WP-105 draft time by a one-shot cross-check script. The original badge sketch contained at least one questionable reference (e.g., a Thor 2099 framed as "False Aesir of Alchemax Villain") that needs verification before any catalog ships. The verification gate prevents inventing cards.

### The slice — RATIFICATION NOTE

> **2026-04-26 ratification update:** the original "six badges" slice below was expanded by D-0006 / PROPOSAL-VISION-25-AMENDMENT.md to **ten badges total**: six per-run gameplay badges (this section) plus four veteran-recognition badges (V-1..V-4 in `docs/ai/PROPOSAL-VISION-25-AMENDMENT.md` §5). All ten share the same Tier 1 issuance path. The six per-run badges below remain accurate as drafted; they are now Tier 1 *per-run* badges (one row per qualifying submission) as distinct from Tier 1 *veteran* badges (one row per qualifying aggregate history).

### The per-run sub-slice (six badges)

#### 1. Sub-PAR Run

- **Predicate:** `breakdown.finalScore < 0`
- **Shipping criterion text:** *"Completed a scenario with a final score below the published PAR baseline."*
- **Issuance:** one row per qualifying `(player_id, scenario_key, scoring_config_version)`, deduplicated by `UNIQUE (player_id, badge_key, source_ref)`.
- **Why it's here:** the canonical "you played well" badge. It is **breadth-gateable** (see #5) and is the foundation that other badges compose against.
- **Card tie-in:** TBD; verify against registry. Candidate: a precision-themed Hero (e.g., Hawkeye if present in the dataset) with flavor about "the shot under par."

#### 2. Pristine Defense

- **Predicate:** `breakdown.penaltyBreakdown['villainEscape'] === 0` AND scenario was completed (i.e., the run is in `competitive_scores` at all, which already gates on completion per WP-053 §B step 8). *Note: penalty event type name is `villainEscape` per `parScoring.types.ts:PenaltyEventType` — verify exact spelling at WP-105 draft time.*
- **Shipping criterion text:** *"Completed a scenario with zero villain escapes."*
- **Why it's here:** quality signal, replay-verified, not gameable by playing more.
- **Card tie-in:** TBD; verify. Candidate Hero with shield/defense thematics.

#### 3. Master Strike Ironwall

- **Predicate:** `breakdown.penaltyBreakdown['masterStrikeTriggered'] === 0` (or whatever the canonical Master Strike penalty event key is in `PenaltyEventType` — verify exact key at WP-105 draft).
- **Shipping criterion text:** *"Completed a scenario without ever resolving a Master Strike."*
- **Card tie-in:** TBD.

#### 4. Bystander Guardian

- **Predicate:** `breakdown.inputs.bystandersRescued === <total bystanders available in scenario>` AND `breakdown.finalScore <= 0`. The "available" count is a property of the scenario / setup, not of `ScoreBreakdown` — WP-105 must source it from a deterministic per-`ScenarioKey` lookup (likely added to PAR config or computed at submission time). Mark this dependency in the WP-105 draft as a precondition; if the lookup isn't deterministic at submission time, this badge is **deferred** rather than approximated.
- **Shipping criterion text:** *"Rescued every available bystander while still finishing at or below PAR."*
- **Card tie-in:** TBD; candidate Hero with rescue/protection flavor (the original sketch's *Black Widow — Dangerous Rescue* phrasing fits if her card text supports it; verify).

#### 5. Multiverse Mastery (breadth, not volume)

- **Predicate:** count of distinct `scenario_key` values for which this `player_id` has at least one row eligible under #1 (Sub-PAR Run) is `>= N`. Initial `N` proposed: **5**.
- **Shipping criterion text:** *"Completed at least 5 distinct scenarios with a final score below PAR."*
- **Why it's quality-gated, not volume:** the bound is on distinct *scenarios* (each `ScenarioKey` is a different scheme/mastermind/villain-group composition per `parScoring.types.ts:30`), and each qualifier is itself a quality predicate (sub-PAR). 100 sub-PAR runs of the same scenario do not advance this badge.
- **Card tie-in:** TBD; candidate a multiverse-themed card (Kang variant, multiverse Hero, etc.).

#### 6. Steady Crew (replaces "Party Thor", quality-gated)

- **Precondition:** a "registered party" concept must exist on the platform. **It does not yet exist.** This badge is therefore **deferred until a Party / Group registration WP lands** (not WP-105). The badge is included in this slice only to demonstrate that a quality-gated reformulation of the original "Party Thor" idea is achievable — it is **not** in WP-105 scope.
- **Predicate (when the prerequisite exists):** for a registered party `P` with composition `5 cores + ≤2 alternates`, the count of distinct `scenario_key` values reached at sub-PAR with at least 4 of the 5 cores present in the run is `>= N`. Initial `N` proposed: **3**.
- **Shipping criterion text:** *"With your registered crew, finished at least 3 distinct scenarios under PAR."*
- **Why this replaces "Party Thor — 50 games together":** the original "50 games" criterion is a pure volume metric and is forbidden by §25 / D-0005. The replacement honors the original *intent* (recognize crews who play together regularly and well) while measuring only quality breadth.
- **Card tie-in:** TBD; the original Thor 2099 reference needs verification before adoption. If Thor 2099 doesn't actually exist in the dataset, the badge gets a different card; the badge survives the rename.

### What's deliberately not in the slice

Each was in the original sketch and is removed here:

- ❌ *Play 100+ games in any mode* (volume).
- ❌ *Average turn time under 90 seconds across 50 games* (volume + measures speed, which §25's "how well, never how long" framing rejects).
- ❌ *1,000 lifetime VP* (volume).
- ❌ *Win 5 consecutive contest matches against a Deathbird-led Mastermind* (consecutive-win counter; gameable via low-stakes runs).
- ❌ *Achieve #1 global ranking in a weekly contest ladder* (depends on a ranking surface that does not exist yet — DESIGN-RANKING.md is itself unimplemented).
- ❌ *Mixed Doubles / Power Couple / boyfriend-girlfriend duo badge* (privacy, verification, §23(b) framing — see proposal §1 of the prior review).
- ❌ *Youth category* (COPPA/regulatory blast radius — separate track).
- ❌ *Community & Support / Creator & Artist / Contributor & Developer categories* (Tier 2 / Tier 3 — separately scoped).

### What WP-105 looks like after this slice

- Six badge keys defined in code (`gameplay.sub-par-run`, `gameplay.pristine-defense`, `gameplay.master-strike-ironwall`, `gameplay.bystander-guardian`, `gameplay.multiverse-mastery`; `gameplay.steady-crew` left as an explicit deferred placeholder). Card slugs locked in WP-105 draft after registry verification.
- One migration: `data/migrations/008_create_player_badges_table.sql` (column shape per §2 above).
- One issuance hook in `apps/server/src/competition/competition.logic.ts` invoked after step-15 INSERT.
- One read function `getPlayerBadges`.
- WP-102's badge tab stub becomes a live list of `(badge_key, awarded_at, scenario_key)` triples.
- Total file budget: well within ≤7.

---

## 4. Out of scope for this proposal (named so they aren't smuggled in later)

- Tier 2 / Tier 3 badge issuance (admin-attested, external-attested) — separate WPs, after Tier 1 lands.
- Public canonical badge URLs (`legendary-arena.dev/badges/<slug>`) — defer pending Marvel-IP review.
- Cross-platform mirroring (LinkedIn, Steam, Credly, Open Badges, JSON-LD `@type: Achievement`) — depends on URLs above.
- New-player / onboarding badges — should be designed against the onboarding system per D-1101/D-1102, not bolted onto WP-105.
- Youth category — separate track if pursued.
- Romantic-couple / Mixed-Doubles framing — withdrawn per prior review.
- Avatar / cosmetic side effects of badges (display borders, profile flair) — UI-only, post-WP-104.

## 5. Open questions for review

1. **D-1004 number.** Confirm `D-1004` is the right slot in Growth & Governance (current entries: D-1001, D-1002, D-1003).
2. **`badge_key` namespace.** Proposed `gameplay.sub-par-run` (dotted, lowercase, kebab subkey). Acceptable, or prefer alternative?
3. **Re-derivation under new `scoring_config_version`.** Proposal says new versions produce new badge rows, never modify old ones. Confirm — this matches D-5306d but worth ratifying for the badge surface specifically.
4. **Bystander Guardian's "available" count.** Is the per-scenario bystander pool deterministically derivable from `ScenarioKey + ScoringConfigVersion`? If yes, the badge ships in WP-105. If no, it defers.
5. **Penalty event key spellings.** This proposal cites `'villainEscape'` and `'masterStrikeTriggered'`. The exact `PenaltyEventType` union strings need to be verified against `parScoring.types.ts` at WP-105 draft time. The decision text doesn't depend on the spellings; only the criteria sketch does.
6. **Steady Crew prerequisite.** Confirm the "registered party" concept is not on any current WORK_INDEX track. If it is, surface the WP number here.

---

## 6. If approved

1. Copy §2 (D-1004) into `DECISIONS.md` under Growth & Governance and update `DECISIONS_INDEX.md`.
2. Update `WORK_INDEX.md` WP-105 placeholder to reference D-1004 and replace the "issuer model unresolved" line with "Tier 1 only per D-1004."
3. Draft WP-105 against §3's criteria sketch and the file budget at the end of §3.
4. Open a separate proposal for Tier 2 issuer model when the first admin-attested badge category is genuinely needed (no earlier).

---

## Addendum — 2026-04-26 polish pass

**Non-normative status.** This addendum is non-normative for the WP-105 first slice: it does not add requirements, predicates, or storage contracts that bind WP-105 implementation. Forward notes (A4, A6) describe possibilities outside the first slice; clarifications (A6) restate constraints already implied by D-1004 / D-0006 in a form that's easier for WP-105 implementers to find. Authoritative criteria remain in §3 above and in PROPOSAL-VISION-25-AMENDMENT.md §5.

This addendum was added in a follow-up review to fold non-conflicting **naming and flavor polish** from a subsequent rewrite suggestion. It does **not** alter D-1004, D-0006, D-0007, or any criteria. It adds candidate flavor titles (still pending registry verification) and forward-pointer notes for post-WP-105 reframings.

The rewrite that prompted this addendum proposed several elements that were rejected on review (five-category ratification, public canonical URLs, single-issuer claim with Marvel-IP exposure, romantic-couple badges, Youth category, volume-based party criteria); none of those are admitted here. Only the items below are folded in.

### A1. Naming convention (canonical key vs flavor title)

Every Tier 1 badge has two layers:

- A **canonical key** (e.g., `gameplay.sub-par-run`) used in code, storage, APIs, and `legendary.player_badges.badge_key`. Stable, machine-readable, never displayed.
- A **flavor title** (e.g., "The 2099 Deck-Runner") shown to players, tied to a real card via the card-tie-in lookup. May be revised over time; the canonical key never changes.

This separation is consistent with how the rest of the platform handles ext_id vs display name (e.g., `CardExtId` strings vs card display names in the registry).

### A2. Candidate flavor titles for the 10 Tier 1 badges

All card slugs remain `TBD: verify against registry` until WP-105 draft runs the verification cross-check script. Candidate titles below are taken from the original sketch where the predicate-to-title fit is clean. **None of these card-tie pairings are committed** — they are starting points for the WP-105 verification pass.

| Canonical key | Candidate flavor title | Card-tie candidate |
|---|---|---|
| `gameplay.sub-par-run` | The 2099 Deck-Runner | TBD (verify "Spider-Man 2099" exists) |
| `gameplay.pristine-defense` | Flitting Sting Tamer | TBD (verify "Wasp" — multiple candidates) |
| `gameplay.master-strike-ironwall` | Silent Sniper First Turn | TBD (verify "Black Widow" — multiple candidates) |
| `gameplay.bystander-guardian` | Unstoppable Hulk Veteran | TBD (verify "Hulk" — multiple candidates) |
| `gameplay.multiverse-mastery` | Conqueror of the Multiverse | TBD (multiverse-themed Hero or Mastermind) |
| `gameplay.steady-crew` (deferred) | Steady Crew | TBD (party / fellowship-themed Hero) |
| `gameplay.veteran.seasoned-defender` (V-1) | Seasoned Defender | TBD |
| `gameplay.veteran.decade-legend` (V-2) | Decade Legend | TBD |
| `gameplay.veteran.hall-of-sustained-mastery` (V-3) | Hall of Sustained Mastery | TBD |
| `gameplay.veteran.crossroads-of-multiverse` (V-4) | Crossroads of the Multiverse | TBD (multiverse-themed) |

Where multiple cards share a Hero name (e.g., several "Hulk" cards across sets), the WP-105 verification pass selects the specific card whose subtitle and ability text best match the badge's predicate. Subtitle + set must both be recorded on `cardTieIn`.

### A3. Flavor text convention

A short flavor line under each badge reinforces the card-tie-in. The line quotes or paraphrases the **real** card's subtitle / ability text — never invented prose. Example shape (illustrative only; final text written from verified card data at WP-105 draft):

> The 2099 Deck-Runner — *Spider-Man 2099*
> "{verbatim or close paraphrase of the actual card's subtitle / ability line}"

Per the no-invented-cards rule, candidate flavor lines from the original badge sketch are **not** retained in this addendum. Final card-tied flavor lines are written at WP-105 draft time once each card's subtitle / ability text is confirmed against `data/cards/*.json`.

### A4. Forward notes (post-WP-105 reframings)

These are **not** Tier 1 / WP-105 work. They are recorded here so the canonical model has explicit forward pointers and future proposals do not accidentally reinvent overlapping predicates.

- **Contest-themed reframing of `multiverse-mastery`.** A future Tier 2 (admin-attested) "Schemebreaker" badge series could reuse the `multiverse-mastery` predicate (sub-PAR on N distinct scenarios) scoped to admin-curated "contest" scenarios once a contest concept exists. This is a *presentation overlay*, not a new predicate. The underlying issuance contract is unchanged. No D-1004 change required.

- **Combined-quality "Flawless Run" badge.** A stricter Tier 1 per-run badge could be added later: `gameplay.flawless-run` = `pristine-defense AND master-strike-ironwall AND bystander-guardian` (zero escapes AND zero Master Strikes AND all bystanders rescued, on the same scenario). It composes the existing per-run predicates and needs no new trust surface. **Not added to the WP-105 first slice** to keep the file budget at ten badges; can be added in a successor WP without amendment to D-1004.

- **Group-play recognition.** Once a Party / Group registration concept exists on the platform, the deferred `gameplay.steady-crew` badge becomes implementable per PROPOSAL-VISION-25-AMENDMENT.md §5. The original "Party Thor — Thor 2099" sketch is recorded as a candidate flavor title only; the underlying card needs registry verification before adoption, and the criteria must remain quality-gated per §25(b).

### A5. Implementer clarifications (restating D-1004 / D-0006 constraints)

These clarifications restate constraints already implied by D-1004 and D-0006 in a form WP-105 implementers can find quickly. They do not change scope; they reduce the surface where a future reader could misread the existing rules.

**A5.1 — Tier 1 evidence-source definition.** A badge is Tier 1 if and only if its evidence originates solely from `legendary.competitive_scores` rows and engine-computed `ScoreBreakdown` projections. Per-run Tier 1 badges read a single row; veteran Tier 1 badges aggregate over multiple rows from the same player's history — both still derive solely from this substrate. Any badge whose evidence comes from operator attestation, GitHub state, off-platform action, or any source other than `competitive_scores` + `ScoreBreakdown` is **by definition not Tier 1**, regardless of how it is presented. This forecloses "Tier 1 by reclassification" as a back-door for admin-attested or external-attested badges.

**A5.2 — Aggregation rule for veteran (per-history) Tier 1 badges.** Veteran badges aggregate over **distinct, quality-gated achievements**, never over raw counts. Aggregation over history is permitted only when each contributing element independently satisfies a non-volume predicate (the per-run quality floor of §25(b) and D-0006). A "veteran" badge whose criterion would be satisfiable by repeating the same low-quality scenario, or by binge play in a short window, is by construction **not** a veteran badge under this proposal — regardless of name. This forecloses "play N games" being resurrected under the banner of "veteran."

**A5.3 — Per-run vs per-history storage shape (conceptual; constraint shape deferred).** Per-run Tier 1 badges set `source_kind = 'competitive_score'` and reference the originating row via `source_ref = competitive_scores.submission_id`. Per-history (veteran) Tier 1 badges set `source_kind = 'competitive_history'`, leave `source_ref` NULL, and use `qualifying_window_start` (per D-0006) as the temporal anchor for the aggregate. The exact UNIQUE-constraint shape for veteran rows (whether `(player_id, badge_key)` or `(player_id, badge_key, awarded_under_config_version)`) is **deferred to WP-105 draft**, contingent on resolution of §5 open question 3 (re-derivation under new `scoring_config_version`). Either shape is consistent with D-1004; locking it here would pre-decide that question.

**A5.4 — Prerequisite-gated deferrals are no-ship, no-row, no-key-reservation.** Badges whose predicates depend on platform concepts that do not yet exist — most notably `gameplay.steady-crew`, which depends on a registered-party concept that is not on any current WORK_INDEX track — are defined for conceptual completeness only. Until the prerequisite WP lands, such badges:

- MUST NOT ship as part of any WP-105 (or successor) first-slice deliverable
- MUST NOT have rows inserted into `legendary.player_badges` under any circumstance (placeholder rows, "reservation" rows, demo data, etc.)
- MUST NOT have their `badge_key` reserved or pre-registered in any code or schema artifact

This closes a "reserve the slot now" loophole that would create dangling badge keys with no implementable predicate.

---

### A6. Addendum compliance check

Before this addendum was added, the candidate items were checked against the live governance record:

- ✅ No volume criteria introduced (all candidate titles overlay existing quality-gated predicates).
- ✅ No new public-URL or sole-issuer language (D-1004's deferral preserved).
- ✅ No romantic-couple / Youth / five-category ratification (prior review cuts preserved).
- ✅ No card-tie commitments (all candidates marked TBD pending registry verification).
- ✅ No criteria changes (predicates from §3 remain authoritative; only flavor titles added).
- ✅ No WP renaming (WP-105 remains the canonical slot per WORK_INDEX).
