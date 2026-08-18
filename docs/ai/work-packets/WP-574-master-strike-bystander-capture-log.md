# WP-574 — Master Strike Bystander Capture Log (Game Engine)

**Status:** Draft 2026-08-18
**EC:** [EC-609](../execution-checklists/EC-609-master-strike-bystander-capture-log.checklist.md)
**Reserves:** D-24383
**Lane:** Standard two-session
**User-Visible Surface:** `play.legendary-arena.com` (game log) — **D-24026 REQUIRED**
**Drafted off:** `origin/main` @ `d12e1f85`

---

## Goal

Log the Master Strike bystander capture on the **success** path. Today the helper
`captureBystanderOntoMastermind` (`rules/mastermindHandlers.ts`) has a `pushLog`
only on the empty-supply branch — a successful capture is **silent**. The result:
Bystanders appear in the victory pile after a mastermind fight with no log trail
explaining where they came from.

## Assumes

- **D-15401 (Immutable)** — every Master Strike captures one Bystander onto the
  Mastermind. That decision specified a message only for the empty-supply case; it
  said nothing about the success case. The silence is a gap in what the decision
  **covered**, not a violation. D-15401 stays Immutable and unamended.
- **WP-434** — the `LOG_OUTCOMES` taxonomy. A successful capture is `applied`.
- **WP-438** — `LogEntry.card` threading. The capture helper has no card context
  (it runs inside a generic strike path, not a per-card dispatch), so the log line
  does **not** carry `LogEntry.card`.

## Context

**Reported from a real match.** A solo Red Skull / Super Hero Civil War game
rescued **3** Bystanders from the mastermind on turn 8. The rescue was logged
(`"rescued 3 bystander(s) from the mastermind"`), but only **1** capture was logged
(turn 7, action 1, entry 1 — the villain-deck Ambush capture). The other two
arrived from the turn-3 and turn-6 Master Strikes with **no log line at all**.
Three Bystanders appeared in the victory pile from nowhere.

The asymmetry is the tell: the RESCUE is logged while the CAPTURES are not. Nothing
in the source looks wrong — the code works correctly — and the gap is only visible
once the rescue count is compared against the missing capture lines.

**Single-function scope.** The entire fix is one `pushLog` call on the success
branch of `captureBystanderOntoMastermind`. The helper is called from
`mastermindStrikeHandler` for every strike and every mastermind — the log line
fires automatically for every Master Strike that captures.

## Scope (In)

1. `rules/mastermindHandlers.ts` — one `pushLog` on the success path of
   `captureBystanderOntoMastermind`, outcome `applied`, naming the capturing
   mastermind. The captured card is a generic `pile-bystander` supply token, so a
   count-and-attribution reads better than an ext_id.
2. `rules/mastermindHandlers.test.ts` — extend: assert the success line exists
   **and** that the empty-supply line is unchanged (the two branches must not
   collapse into one wording).

## Scope (Out)

- **Changing when or whether a bystander is captured.** D-15401 is Immutable; this
  WP touches observability only.
- **Amending D-15401.** The silence was as-designed; the fix is additive.
- **Adding a `LogEntry.card` to the capture line.** The helper runs inside a
  generic strike path, not a per-card dispatch — there is no card to attribute. A
  future per-mastermind-strike dispatch (like WP-386/388's resolvers) could thread
  one, but that is a different packet.
- **The villain-deck Ambush capture path.** That path already logs.
- **Bystander rescue logging.** Already logged.

## Files Expected to Change

| File | Change |
|---|---|
| `packages/game-engine/src/rules/mastermindHandlers.ts` | one `pushLog` on success path |
| `packages/game-engine/src/rules/mastermindHandlers.test.ts` | extend — success + empty-supply assertions |

## Contract

**Locked — one `pushLog` on the success path with outcome `applied` (D-24383
§1).** The line names the mastermind that captured the bystander. The captured card
is a generic supply token (`pile-bystander`), not a named card.

**Locked — the empty-supply line is BYTE-UNCHANGED.** D-15401 specified this
message. The two branches must be distinguishable — a test asserts both wordings
survive.

**Locked — observability only, no mechanic change.** When and whether a bystander
is captured is unchanged. D-15401 stays Immutable and unamended.

> **Determinism — no re-pin expected, and here is the mechanism.** Two hashes
> treat messages differently and both are safe:
> - the sentinel `finalStateHash` uses `hashGameState`, which **excludes**
>   `messages` (D-24081) → unchanged;
> - `PRE_WP080_HASH` uses `computeStateHash`, which **does** hash `messages` — but
>   it replays an **empty** move list, so no Master Strike fires and no capture
>   message is emitted → unchanged.
>
> Verify both rather than assume. If either moves, **STOP**.

## Acceptance Criteria

- **AC-1** — after a Master Strike successfully captures a Bystander, a log line
  with outcome `applied` names the capturing mastermind.
- **AC-2** — the existing empty-supply `blocked` line is byte-unchanged; a test
  asserts both wordings survive independently.
- **AC-3** — no change to **when or whether** a bystander is captured — the
  mechanic is Immutable under D-15401.
- **AC-4** — determinism: sentinel `finalStateHash` and `PRE_WP080_HASH` both
  **byte-unchanged**.
- **AC-5** — `pnpm -r build` 0; engine suite green; `pnpm -r --no-bail test` no
  new failures.
- **AC-6** — **D-24026**: in a live match, every Master Strike that captures a
  Bystander shows a log line, and the count of capture lines matches the count of
  Bystanders later rescued from the mastermind.

## Verification Steps

1. `pnpm -r build` → 0.
2. Engine suite green; both the success and empty-supply log lines are tested.
3. Confirm both hash oracles byte-unchanged.
4. `pnpm -r --no-bail test` → no new failures.
5. Post-deploy: AC-6.

## Definition of Done

- [x] AC-1..AC-5 demonstrated with observed output (engine suite 2779→2781, +2 new
      tests, 0 fail; `pnpm -r --no-bail test` no new failures); AC-6 recorded
      operator-pending (post-deploy live verify).
- [x] D-24383 landed **Active**.
- [x] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` `Done`; mindmap `📝`→`✅`; counts 0.
- [x] `STATUS.md` records both oracles byte-unchanged.

## Execution Note (2026-08-18)

The determinism analysis above held for the two hash oracles (both byte-unchanged:
sentinel `finalStateHash`, `PRE_WP080_HASH = ec64506a`), but it omitted the
complete-game regression suite's **`messages` oracle**. The committed sentinel
fixture `sentinel-core-doom-2p.replay.json` fires two core Dr. Doom Master Strikes
and records their log lines, so it was re-recorded additively (+2 `applied` capture
lines; its own `finalStateHash` byte-unchanged at `813287eb…`). This one forced,
additive fixture was added to the EC-609 target set as a documented mid-execution
amendment (D-24383 §5; EC-609 §Execution Amendment) — not a scope change.

## Notes

**Sibling of WP-566 (log fidelity) on a DIFFERENT path.** WP-566 improved the
hero-hook condition message; this WP adds a missing line on the mastermind-strike
capture path. No sequencing conflict.

**The line format matches existing strike logging.** Every `mastermindStrikeHandler`
resolver and the generic strike path log with a `[Master Strike]` prefix. This line
should follow the same convention.

## Gate Verdicts

- **Pre-flight (`01.4`):** _(to be run at session prompt)_
- **Copilot (`01.7`):** _(to be run at session prompt)_
