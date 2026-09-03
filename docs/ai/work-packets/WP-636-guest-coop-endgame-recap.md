# WP-636 — Guest Co-op Endgame VP Recap (Arena Client)

**Status:** Done 2026-09-02
**Primary Layer:** App (`apps/arena-client`)
**Dependencies:** WP-578 (the EndgameSummary competitive-score panel this extends); the engine `gameOver.scores` projection (already shipped — per-player VP on every runtime gameover); D-24441 (guest play).
**User-Visible Surface:** `play.legendary-arena.com` — the endgame report card a **guest** (or any non-scored viewer) sees. D-24026 live-verify applies.

> Operator-reported (Jeff, across two live guest wins): a **guest** who finishes a game sees only the outcome banner, the "Sign in to save your score" prompt, and a bare **"Final scores recorded (N players)."** line — no result. The rich report (grade / PAR / per-player / luck / coach) lives in `competitiveScore`, which the server correctly withholds from an unranked guest. But the **per-player VP is already on the guest's client** in `gameOver.scores` — the `scores` block just threw it away. This renders it as a real co-op recap.

## Goal

After this session a viewer with **no** `competitiveScore` (a guest, or any non-scored match) sees a **per-player VP recap** (each seat's total VP + villain/henchman/bystander/tactic breakdown) in the EndgameSummary, built from `gameOver.scores` they already have. The ranked grade, PAR, leaderboard, and coach stay account-gated (unchanged); the sign-in CTA still shows.

## User-Visible Impact (D-24026)

A grandchild who plays as a guest and wins now sees "here's how our team did" (per-player VP) instead of only a sign-in wall. Verified post-deploy on `play.legendary-arena.com`.

## Assumes

- `gameOver.scores` carries `players[].{ villainVP, henchmanVP, bystanderVP, tacticVP, woundVP, totalVP }` + `winner` at runtime (confirmed from a live guest diagnostics snapshot).
- The account holder's rich per-player block (`workedCalc.perPlayer`, WP-621) already covers per-player detail when `competitiveScore` is present.
- If either is false, this WP is **BLOCKED**.

## Non-Negotiable Constraints

Engine determinism constraints **N/A** (arena-client presentational change).

**Locked contract values:**

- **No server / engine / contract change** — renders data already on `gameOver.scores`.
- The recap renders **only when `!competitiveScore`** (guest / non-scored) — otherwise it duplicates the account holder's richer block.
- **§23(b):** individual VP contribution only — **no winner/loser** framing between co-op teammates (do not surface `gameOver.scores.winner` as a "winner").
- The **sign-in CTA is unchanged** (the ranked grade stays account-gated); the recap is additive.

**Session protocol:** full-file contents; human-style per `00.6`; no new deps; SFC keeps `defineComponent({ setup })` (D-6512).

## Scope (In)

- **A.** `EndgameSummary.vue` — the `scores` block renders a per-player VP recap (stacked rows: `Player N` · `total VP` · category detail) when `!competitiveScore`; the bare count note remains for the account-holder path.
- **B. Tests** — `EndgameSummary.test.ts`: guest sees the recap (both seats, totals) + the sign-in CTA and NOT the count line; an account holder does NOT get the recap; §23(b) no winner/loser text.

## Out of Scope

- Any server change to send guests the competitive breakdown (rescued / twists / defeated-counts / luck) — those stay account-gated (a separate WP if ever wanted).
- The competitive grade / PAR / leaderboard / coach (account-gated, unchanged).
- Any engine / `G` / `ctx` change.

## Vision Alignment

Triggers §17.1 — identity/visibility (§3, §11) + multiplayer (§4). Surfaces a co-op result a guest already has; ranked merit stays account-gated (conversion CTA intact). §23(b): no PvP framing between teammates. NG-proximity: none. Determinism: unaffected.

## Files Expected to Change

- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** — the recap + styles.
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified** — the tests.

Allowlist ≤ 2 code files, single app, additive.

## Acceptance Criteria

1. A viewer with `competitiveScore: null` and a `gameOver.scores` sees a per-player VP recap (each seat's total + category breakdown).
2. The recap is absent when `competitiveScore` is present (no duplication of the WP-621 block).
3. The recap declares no winner/loser between teammates (§23(b)).
4. The guest sign-in CTA still renders alongside the recap.
5. `pnpm --filter @legendary-arena/arena-client build`, `test`, `typecheck` all exit 0.
6. No file outside the allowlist; no server/contract change.

## Verification Steps

```pwsh
pnpm --filter @legendary-arena/arena-client build      # exit 0
pnpm --filter @legendary-arena/arena-client test        # exit 0
pnpm --filter @legendary-arena/arena-client typecheck   # exit 0
Select-String -Path apps/arena-client/src/components/hud/EndgameSummary.vue -Pattern "arena-hud-coop-scores"
```

## Definition of Done

- [x] All acceptance criteria pass
- [x] `docs/ai/STATUS.md` updated
- [x] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [x] `docs/05-ROADMAP-MINDMAP.md` node `✅`; `roadmap:counts` exits 0
- [ ] D-24026 live-verify (a guest sees the VP recap) — pending post-deploy
- [x] No files outside the allowlist

## Lint Gate Self-Review

Per `00.3`: **§1** PASS (sections; Out-of-Scope 3). **§2** PASS (engine N/A; locked values; `00.6`). **§3** PASS (deps + BLOCKED clause). **§4** PASS (files + D-24441). **§5** PASS (≤2 files). **§6** PASS (`gameOver.scores`, `competitiveScore` match the shipped shapes). **§7** PASS (no deps). **§8** PASS (arena-client only; no server/`G`). **§9** PASS (`pwsh`). **§10** N/A. **§11** PASS (no auth change; ranked stays gated — stated). **§12** PASS (arena-client tests; vue-tsc gated). **§13** PASS. **§14** PASS (6 binary). **§15/§15.1** PASS (surface + D-24026). **§16** PASS. **§17** PASS (Vision block; §23(b) explicit). **§18** PASS. **§19** N/A. **§20** N/A. **§21** N/A (no api-catalog change).
