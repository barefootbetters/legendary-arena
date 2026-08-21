# WP-579 — Legends Leaderboard: Show the Claimed Handle as a Profile Link

**Status:** Draft 2026-08-21 — awaiting execution. **Reserves WP-579 / EC-614 / D-24388.** Gates (drafting session): pre-flight READY (after draft-time correction) · copilot RISK (documented) · lint SATISFIED — see Gate Verdicts below.
**User-Visible Surface:** `legends.legendary-arena.com` — each single-player leaderboard row's player is shown as the claimed, URL-safe handle, linked to that player's public profile, instead of today's plain-text account `display_name` (which falls back to the email local-part). D-24026 live-verification applies.
**Primary Layer:** Server (`apps/server` — the leaderboard/snapshot the publisher writes to R2) and App (`apps/legends-board` — the read-only board that renders the snapshot). Cross-layer, one WP.
**Dependencies:** WP-115/WP-150/WP-054 (the leaderboard query + `PublicLeaderboardEntry`, **9-field-locked by D-5201**); the legends publisher/snapshot (`legends.scheduler.ts` / `legends.logic.ts` / `legends.types.ts`) + the `apps/legends-board` client mirror (`snapshots/snapshotClient.ts`, "DO NOT import" boundary); WP-406 (the claimed-handle display already used by the match-result pipeline); the public profile route `GET /api/players/:handle/profile` + the `?profile=<handle>` client page; migration 008 (`display_handle` / `handle_canonical` on `legendary.players`). All landed. Baseline `origin/main` at draft: `3dd6fbc9`.

---

## Goal

Make the legends leaderboard identify each single-player row by the player's claimed profile handle and link that name to the player's public profile. Today the snapshot builders set `handle: entry.playerDisplayName` (`legends.logic.ts`), sourced from `legendary.players.display_name` (`leaderboard.logic.ts` selects only `p.display_name`), and the board panels render `entry.handle` as **plain text with no link**. That value is (a) not a link and (b) the account `display_name`, which falls back to the **email local-part** — so a public board can print an email prefix. A public profile page already exists at `play.legendary-arena.com/?profile=<handle>`, backed by `GET /api/players/:handle/profile` and keyed on the claimed handle (`display_handle` / `handle_canonical`). This WP sources the claimed handle into the snapshot and renders it as a profile link on the single-player boards.

## User-Visible Impact

On `legends.legendary-arena.com`, a player who has claimed a handle appears (on the global-top and scenario boards) under that handle, linked to `play.legendary-arena.com/?profile=<handle_canonical>`. A ranked player who has **not** claimed a handle still appears (never dropped) under the D-24388 fallback label — and the email-local-part `display_name` fallback stops reaching those boards. Rankings, scores, eligibility, and the 5-minute publish cadence are unchanged; only the identity label and its link change. D-24026 live-verification applies.

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The leaderboard query selects only display_name today (no handle_canonical / display_handle)
grep -q "display_name AS player_display_name" apps/server/src/leaderboards/leaderboard.logic.ts && ! grep -q "handle_canonical" apps/server/src/leaderboards/leaderboard.logic.ts && echo "A_OK"
# Expected: A_OK

# B. The snapshot builder sets the entry handle from the display name
grep -q "handle: entry.playerDisplayName" apps/server/src/legends/legends.logic.ts && echo "B_OK"
# Expected: B_OK

# C. PublicLeaderboardEntry is the 9-field D-5201-locked type (no player id, no handle)
grep -q "9-field D-5201 lock" apps/server/src/leaderboards/leaderboard.types.ts && ! grep -qE "handle_canonical|display_handle" apps/server/src/leaderboards/leaderboard.types.ts && echo "C_OK"
# Expected: C_OK

# D. The client mirror + the public profile route + the claimed-handle column exist
grep -q "DO NOT import" apps/legends-board/src/snapshots/snapshotClient.ts && grep -q "players/:handle/profile" apps/server/src/profile/profile.routes.ts && grep -q "handle_canonical" data/migrations/008_add_handle_to_players.sql && echo "D_OK"
# Expected: D_OK
```

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §"Layer Boundary (Authoritative)" — this WP touches the server (leaderboard/snapshot publisher) and the `apps/legends-board` read-only app. The board reads the R2 snapshot directly and **mirrors** the snapshot entry types in `snapshots/snapshotClient.ts` ("DO NOT import from @legendary-arena/server") — so the mirror is a second contract copy that MUST move with the server type.
- `docs/ai/DECISIONS.md` — scan **D-24388** (this WP), **D-5201** (the `PublicLeaderboardEntry` 9-field never-expose lock), and the WP-406 claimed-handle-display decision.
- `apps/server/src/leaderboards/leaderboard.types.ts` — `PublicLeaderboardEntry` is **9 fields, locked by D-5201** ("preserves the 9-field D-5201 lock"), and carries **no player/account id** (sensitive fields `accountId`/`email`/… are stripped at this boundary). It is served **verbatim** by four **Wired** HTTP endpoints (`/api/leaderboards/scenarios/:scenarioKey`, `/scores/:replayHash`, `/themes/:themeId`, `/top`). Widening it is a D-5201 amendment **and** a §21 four-row catalog update — see the Path A / Path B fork in Notes.
- `apps/server/src/leaderboards/leaderboard.logic.ts` — the leaderboard query `INNER JOIN legendary.players p` selects `p.display_name AS player_display_name` (≈ line 196). `legendary.players` also has `display_handle` / `handle_canonical` (migration 008), nullable until claimed.
- `apps/server/src/legends/legends.types.ts` + `legends.logic.ts` — the snapshot entry types (`GlobalTopSnapshotEntry`, `ScenarioSnapshotEntry`, `schemaVersion: 1` **literal**) and the builders (`buildGlobalTopSnapshot` ≈ line 62, plus the scenario builder) that construct explicit object literals `{ handle: entry.playerDisplayName, rank, scenarioKey, score }` (no spread, per EC-157). The house convention for a new snapshot field is **additive-optional with NO version bump** (WP-342/344/385/472/474 all added fields at version 1).
- `apps/legends-board/src/snapshots/snapshotClient.ts` — the client **mirror** of the snapshot entry types (schemaVersion literal `1`). Panels read `entry.*` off this mirror.
- `apps/legends-board/src/panels/OverallPanel.vue` / `WeeklyPanel.vue` / `BySchemePanel.vue` — the single-player boards; each renders `<td class="col-handle">{{ entry.handle }}</td>` with no anchor. The board fetches the R2 snapshot at runtime and polls the manifest every 60s.
- `apps/server/src/profile/profile.routes.ts` (`GET /api/players/:handle/profile`) + the client `?profile=<handle>` page — the link target, keyed on the claimed handle (`handle_canonical`, canonicalized lowercase).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — confirm `display_handle` / `handle_canonical` / `display_name` spellings before use.
- `docs/01-VISION.md` §3, §11 (identity), §20–26 (leaderboards).

## Scope (In)

- **Source the claimed handle into the snapshot (Path A — recommended; see Notes).** In the leaderboard/snapshot generation path (`leaderboard.logic.ts` + `legends.logic.ts`), carry each entry's `display_handle` + `handle_canonical` (from the existing `legendary.players` JOIN) to the snapshot builders via a **snapshot-internal enriched row/query** — WITHOUT widening the D-5201-locked `PublicLeaderboardEntry` and WITHOUT touching the four HTTP leaderboard endpoints. (Path B — amend D-5201 to add the two public handle fields to `PublicLeaderboardEntry`, surfacing them on the four endpoints with a §21 four-row update — is the documented alternative; the executing session confirms the seam with the operator and locks it in D-24388.)
- **`apps/server/src/legends/legends.types.ts`** — additively extend `GlobalTopSnapshotEntry` + `ScenarioSnapshotEntry` with optional `handle` (claimed display form) + `handleCanonical` (URL key). **NO `schemaVersion` bump** (additive-optional, per the house convention). Keep `handle` back-compatible: when a claimed handle exists it is the claimed form; the fallback path (below) governs the absent case.
- **`apps/server/src/legends/legends.logic.ts`** — in the builders (explicit-literal construction, no spread), emit the claimed handle + canonical form when present; when absent, apply the **D-24388 fallback**: a neutral non-PII label, and do **not** emit the email-local-part `display_name` to these boards.
- **`apps/legends-board/src/snapshots/snapshotClient.ts`** — mirror the same optional fields on the client entry types (the "DO NOT import" boundary means this mirror must move in lockstep or the board's gated typecheck fails / the link field is silently `undefined`).
- **`apps/legends-board/src/panels/OverallPanel.vue` / `WeeklyPanel.vue` / `BySchemePanel.vue`** — render the claimed handle as `<a href="https://play.legendary-arena.com/?profile=<handleCanonical>">…</a>` (handle percent-encoded) when present; render the D-24388 fallback label as plain text (no anchor) when absent.
- **Tests** — a server test asserting the snapshot builders carry the claimed handle and apply the fallback (claimed → handle + canonical; unclaimed → fallback label, no email-local-part); a legends-board panel test asserting a claimed row links to the profile URL and an unclaimed row renders plain text.

## Out of Scope

- **Widening `PublicLeaderboardEntry` / the four HTTP leaderboard endpoints (unless Path B is chosen).** The recommended Path A leaves the D-5201-locked type and the four `Wired` endpoints untouched; only Path B (a documented alternative) engages a D-5201 amendment + a §21 four-row catalog update.
- **The Gauntlet board.** `GauntletBoardPanel.vue` renders a **team roster** (`rosterForEntry`), not a single handle, and its snapshot handle is built in `gauntlet.logic.ts` (a different source than the ≈70/110/175 sites). Linking a multi-player roster to profiles is a distinct model — a follow-up WP, not this one.
- **The `NowPlaying` and `RecentAchievements` panels.** They consume `LegendsSnapshotBoard` entries but are **latent** — the server's `buildBoardList` publishes only `global-top` + `scenario-*` today, so no board currently feeds them. Not touched.
- **The `MatchResult` panel.** A separate, already-correct pipeline that already uses the WP-406 claimed handle and omits anonymous seats — no change needed.
- **Score computation, ranking, eligibility, and the publisher cadence.** `parScoring.logic.ts`, ordering, `is_ranked_eligible`, the ranked/casual split, the 5-minute publish interval, and the 60s manifest poll are unchanged.
- **The profile page / route and handle claiming.** `GET /api/players/:handle/profile`, `?profile=<handle>`, and any claim flow are the link target / precondition, not modified here.
- **The endgame score panel.** That is WP-578.

---

## Files Expected to Change

- `apps/server/src/leaderboards/leaderboard.logic.ts` — **modified** (carry `display_handle` / `handle_canonical` from the JOIN into the snapshot-generation path; Path A keeps `PublicLeaderboardEntry` unchanged)
- `apps/server/src/legends/legends.types.ts` — **modified** (optional `handle` / `handleCanonical` on the snapshot entry types; NO version bump)
- `apps/server/src/legends/legends.logic.ts` — **modified** (carry the handle through the builders + fallback)
- `apps/legends-board/src/snapshots/snapshotClient.ts` — **modified** (mirror the optional fields — required by the "DO NOT import" boundary)
- `apps/legends-board/src/panels/OverallPanel.vue` — **modified** (handle as profile link / fallback)
- `apps/legends-board/src/panels/WeeklyPanel.vue` — **modified** (same)
- `apps/legends-board/src/panels/BySchemePanel.vue` — **modified** (same)
- `apps/server/src/legends/legends.logic.test.ts` (or the nearest existing legends/leaderboard test) — **modified** (handle carried + fallback)
- `apps/legends-board/src/panels/<panel>.test.ts` — **modified** (link when claimed / plain when unclaimed)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified only under Path B** (four leaderboard rows replaced whole per §21); untouched under Path A
- `docs/ai/DECISIONS.md` — **modified** (land D-24388; under Path B also the D-5201 amendment)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** (governance close)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (WP-579 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

Cross-layer (server snapshot + legends-board render). Standard two-session lane (leaderboard + identity surface excluded from the lightweight lane). If Path B is chosen, the D-5201 amendment + four-endpoint surface may warrant splitting the public-type change from the render change.

## Contract (Locked by D-24388)

- **Handle is the label; profile is the link.** A claimed-handle row shows `display_handle` linked to `play.legendary-arena.com/?profile=<handle_canonical>` (percent-encoded). The snapshot carries both the display form and the canonical (URL) form.
- **Source without widening the locked public type (Path A default).** The claimed handle reaches the snapshot via a snapshot-internal enriched row, leaving `PublicLeaderboardEntry` (D-5201, 9 fields) and the four HTTP leaderboard endpoints unchanged. Path B (amend D-5201 + §21 four-row) is the documented alternative, operator-decided.
- **Unclaimed-handle fallback (operator-decided at draft; see Notes).** A ranked player with no claimed handle is **never dropped**; they render under a neutral, non-PII fallback label as plain text (no link), and the email-local-part `display_name` fallback is **not** emitted to these boards.
- **Additive snapshot, NO version bump.** The snapshot entry types gain optional `handle` / `handleCanonical`; `schemaVersion` stays the literal `1`, per the additive-optional house convention (an older board ignores unknown fields; a newer board reads them when present). The client mirror (`snapshotClient.ts`) gains the same optional fields in lockstep.
- **No ranking/eligibility change.** Ordering, filters (`is_ranked_eligible`, visibility), scores, and the publish cadence are byte-unchanged.

### Determinism / persistence

No gameplay determinism surface. This WP reads existing domain columns and reshapes a derived R2 snapshot; there is no `G`, no `ctx.random`, no move, and no engine change. `finalStateHash` / `PRE_WP080` are untouched. The `competitive_scores` table is **not** altered (identity stays a publish-time JOIN); no migration is added. Snapshot builders are already clock-free.

### Code-style / output discipline

Human-style per `00.6-code-style.md` — full-word field names (`handle`, `handleCanonical`), explicit object-literal construction (no spread, per EC-157), a `// why:` on the fallback branch (no-link / no-email-local-part rule), and `encodeURIComponent` on the handle in the URL (a `// why:` cites the injection defense; paraphrase the token in prose per §18). ESM, Node v22+. `apps/legends-board` typecheck is gated. **Output discipline (engine-wide):** the executing session emits **full file contents** for every modified file — no diffs, no snippets.

---

## Acceptance Criteria

1. The snapshot-generation path carries `display_handle` + `handle_canonical` (from the existing `legendary.players` JOIN) to the snapshot builders; under Path A, `PublicLeaderboardEntry` and the four HTTP leaderboard endpoints are unchanged.
2. `GlobalTopSnapshotEntry` + `ScenarioSnapshotEntry` (and their `snapshotClient.ts` mirrors) gain optional `handle` / `handleCanonical`; `schemaVersion` stays the literal `1` (no bump).
3. The snapshot builders emit the claimed handle when present and the D-24388 fallback label (no email-local-part) when absent; no ranked row is dropped.
4. `OverallPanel` / `WeeklyPanel` / `BySchemePanel` render a claimed-handle row as an anchor to `https://play.legendary-arena.com/?profile=<handleCanonical>` (handle percent-encoded) and an unclaimed row as plain text.
5. Score computation, `is_ranked_eligible`, ordering, and the publish cadence are unchanged; the Gauntlet / NowPlaying / RecentAchievements / MatchResult surfaces are untouched.
6. Under Path A, `docs/ai/REFERENCE/api-endpoints.md` is unchanged (§21 N/A); under Path B, the four leaderboard rows are replaced whole (§21) and D-5201 is amended.
7. `apps/server` build + `apps/legends-board` typecheck exit 0; server legends + board panel tests green; `pnpm -r --no-bail test` shows no new failures.

## Verification Steps

```bash
# 1. Snapshot path carries the claimed handle (Path A: PublicLeaderboardEntry untouched)
grep -nE "display_handle|handle_canonical" apps/server/src/leaderboards/leaderboard.logic.ts apps/server/src/legends/legends.logic.ts
grep -nE "readonly (handle|handleCanonical)" apps/server/src/legends/legends.types.ts apps/legends-board/src/snapshots/snapshotClient.ts

# 2. schemaVersion NOT bumped (still the literal 1)
grep -nE "schemaVersion: 1" apps/server/src/legends/legends.types.ts apps/legends-board/src/snapshots/snapshotClient.ts   # expect present, unchanged

# 3. Panels link the handle to the profile
grep -rnE "profile=|href" apps/legends-board/src/panels/OverallPanel.vue apps/legends-board/src/panels/WeeklyPanel.vue apps/legends-board/src/panels/BySchemePanel.vue

# 4. PublicLeaderboardEntry unchanged under Path A (D-5201 lock intact)
git diff --name-only | grep -q "leaderboards/leaderboard.types.ts" && echo "TYPES CHANGED — Path B? confirm D-5201 amend + §21" || echo "PublicLeaderboardEntry untouched (Path A) ✓"

# 5. Build + typecheck + suites
pnpm --filter @legendary-arena/server build 2>&1 | tail -3
pnpm --filter @legendary-arena/legends-board typecheck 2>&1 | tail -3
pnpm -r build && pnpm -r --no-bail test 2>&1 | tail -8
# Expected: server + legends-board green; leaderboard ordering/eligibility unchanged; no new failures

# 6. Live (post-deploy; D-24026): legends.legendary-arena.com — a claimed-handle row on the
#    global-top / scenario board links to /?profile=<handle> and the profile resolves; an
#    unclaimed row renders the fallback label. Record in STATUS.
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed before the edit
- [ ] The Path A / Path B seam + the unclaimed-handle fallback confirmed with the operator and locked in D-24388 before edit
- [ ] All 7 Acceptance Criteria pass
- [ ] All Verification Steps produce the expected output (Step 6 is post-deploy)
- [ ] Snapshot carries the claimed handle; fallback label applied; no ranked row dropped; no email-local-part on these boards; `snapshotClient.ts` mirror moved in lockstep
- [ ] `schemaVersion` unchanged (literal `1`); panels link claimed handles, plain-text for unclaimed
- [ ] Gauntlet / NowPlaying / RecentAchievements / MatchResult surfaces untouched
- [ ] Path A: `PublicLeaderboardEntry` + the four HTTP endpoints + `api-endpoints.md` unchanged (§21 N/A). Path B: D-5201 amended + four rows replaced whole (§21)
- [ ] No score/ranking/eligibility/cadence change; no competitive-scores migration; no engine/hash surface touched
- [ ] `apps/server` build 0; `apps/legends-board` typecheck 0; server + board tests green; `pnpm -r` otherwise no new failures
- [ ] `docs/ai/STATUS.md` Done entry names WP-579 and records the D-24026 live-verify as operator-pending (`User-Visible Surface = legends.legendary-arena.com`)
- [ ] `docs/ai/DECISIONS.md` D-24388 landed Active (+ the D-5201 amendment under Path B)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-579 node `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-614:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification confirmed on the deployed leaderboard (operator-pending)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (after draft-time correction, 2026-08-21)

Independent gate review verified the factual claims (preconditions A–D pass; `playerDisplayName`, the four panels, the profile route, and migration 008 are all real — no fabricated symbols) and surfaced three defects that were **corrected in this draft**: (1) the client mirror `apps/legends-board/src/snapshots/snapshotClient.ts` was missing from the allowlist — **added** (the "DO NOT import" boundary makes it a required second contract copy); (2) the Gauntlet board renders a team roster from `gauntlet.logic.ts`, not a single handle — **scoped out** as a follow-up; (3) the `PublicLeaderboardEntry` widening collided with the D-5201 9-field lock and would trigger §21 on four endpoints — the WP now recommends the **snapshot-only Path A** (locked type untouched) with Path B documented as the operator-decided alternative. With these corrections the scope is locked; the remaining Path A/B + fallback choices are explicit operator forks recorded in D-24388.

### Copilot (`01.7`) — verdict: **RISK (documented)** (2026-08-21)

Cross-layer (server snapshot + legends-board mirror) — clean, the mirror is now in scope. Determinism — N/A (no `G`/RNG/engine; builders clock-free). Two RISKs, both documented and resolved in-draft: the **two-contract-copy** drift (server type + `snapshotClient.ts` mirror) — both now in the allowlist and required to move together; the **version-bump misdescription** — corrected to additive-optional NO-bump (`schemaVersion` stays `1`), matching WP-342/344/385/472/474. The **D-5201 / §21** collision is the material RISK, resolved by defaulting to Path A and recording Path B as an operator fork. NowPlaying/RecentAchievements/MatchResult are named in Out of Scope with rationale.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (2026-08-21)

§1 structure PASS (house `## Contract` substitutes for `## Non-Negotiable Constraints`, per WP-576/577). §3 Assumes PASS (A–D). §4 Context PASS (cites ARCHITECTURE, DECISIONS incl. D-5201, 00.2). §5 Files PASS (mirror added; Gauntlet dropped; §21/Path-B branch explicit). §6 naming per 00.2. §13 Verification PASS. §14 AC PASS (7 binary; version + §21 corrected). §15/§15.1 DoD PASS (STATUS + DECISIONS + indices + mindmap + D-24026). §16 Code Style PASS (+ output-discipline clause). §17 Vision present (§20–26, §3/§11, NG-check, determinism line). §18 prose-vs-grep PASS. §20 Funding N/A justified. §21 correctly N/A under Path A / triggered-with-four-rows under Path B (no longer mis-stated). No ❌ FAIL triggers.

---

## Vision Alignment

**Clauses touched:** §20–26 (leaderboards — the public ranking now identifies players by their claimed handle and links to their profile), §3 / §11 (identity / ownership — the public label is the claimed handle, and the email-local-part fallback is removed from these boards). **Conflict assertion:** `No conflict: this WP preserves all touched clauses` — it improves identity fidelity and closes a PII-leak on the public board without changing scoring, ranking, eligibility, or determinism. **Non-Goal proximity:** none of NG-1..NG-8 — no monetization, no pay-gating, no player-interaction ("vs") terminology; the profile link is a public, free navigation affordance. **Determinism preservation:** no engine, RNG, replay, or game-state-persistence change — this reshapes a derived R2 snapshot from existing domain columns; `finalStateHash` / `PRE_WP080` untouched.

## Funding Surface Gate

**N/A** — a leaderboard identity/label change; no §20.1 funding surface, no funding copy, no funding channel. (Authority: WP-097 / D-9701 / D-9801.)

## API Catalog Update

**N/A under Path A (recommended); TRIGGERED under Path B.** Path A carries the handle snapshot-only and leaves `PublicLeaderboardEntry` and the four `Wired` leaderboard endpoints (`/api/leaderboards/scenarios/:scenarioKey`, `/scores/:replayHash`, `/themes/:themeId`, `/top`) unchanged — no HTTP endpoint added/modified/removed, so `docs/ai/REFERENCE/api-endpoints.md` is unaffected. Path B widens `PublicLeaderboardEntry` (D-5201 amendment), which changes all four response shapes → the four catalog rows are replaced **whole** per D-11804 (`Status`/`Auth` closed sets preserved; field names per 00.2). The executing session applies the branch matching the locked seam. (Authority: WP-118 / D-11804.)

## Decision (reserved, lands at execution)

**D-24388 — leaderboard-handle-profile-link.** Reserved in `NUMBER-LEDGER.md` at draft; the `DECISIONS.md` entry lands **Active** when the WP executes. Records: the handle-as-link contract; the source seam (Path A snapshot-only default vs Path B `PublicLeaderboardEntry` widening + D-5201 amendment + §21 four-row); the unclaimed-handle fallback (no link, no email-local-part on these boards); the additive-no-bump snapshot change with the client mirror in lockstep; the Gauntlet/latent/MatchResult exclusions; and that ranking/eligibility/cadence are untouched.

## Notes

**Two operator forks (surfaced at draft, resolve before execution).**

1. **Source seam — Path A vs Path B.** `PublicLeaderboardEntry` is locked at 9 fields by D-5201 and carries no player id, and it is served verbatim by four `Wired` HTTP endpoints. **Path A (recommended):** carry the claimed handle to the snapshot via a snapshot-internal enriched row, leaving the locked type and the four endpoints untouched (§21 N/A, no D-5201 amendment) — the minimal change for the snapshot-fed board. **Path B:** amend D-5201 to add the two public (non-sensitive) handle fields to `PublicLeaderboardEntry`, which also exposes them on the four endpoints (§21 four-row update) — broader, but makes the handle available API-wide. The recommendation is Path A; the executing session confirms with the operator and locks it in D-24388.

2. **Unclaimed-handle fallback.** A ranked player with no claimed handle has only `display_name`, which is not a valid profile-URL key and can be an email local-part. **Recommended (drafted default):** render a neutral, non-PII fallback label as plain text (no link) and do **not** emit the email-local-part to these boards — closing the PII leak. **Alternative:** keep rendering the account `display_name` as plain text and treat the leak as a separate follow-up. The recommendation is preserved so a future reader sees a decision that was **made**, not missed.
