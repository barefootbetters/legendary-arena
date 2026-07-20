# WP-395 — Canonical Villain & Henchmen Loadouts for Gauntlet Qualification (Registry + Server)

**User-Visible Surface:** legends.legendary-arena.com

**Status:** Draft — pending execution
**Layer:** Registry (data) + Server (qualification predicate)

## Goal

Give every mastermind a **canonical villain-group and henchmen-group loadout**,
and require it for a replay to qualify as a gauntlet leg. Casual play is
unchanged — free selection remains the game as printed. This is a
**competitive-surface constraint only**, scoped to the ranked boards on
`legends.legendary-arena.com`.

Reserves **D-24199**.

## Why: PAR calibration is arithmetically impossible without it

`buildScenarioKey` (`parScoring.keys.ts`) defines:

```
ScenarioKey = "{schemeSlug}::{mastermindSlug}::{sorted-villainGroupSlugs-joined-by-+}"
```

Villain groups are unconstrained today — D-24131 §3 states *"any villain groups
qualify"*, and like heroes they may come from **any** set. There are **134**
villain groups across the 41 sets. Every distinct combination is a **different
`ScenarioKey`**, and PAR is calibrated **per scenario key** with a validator
that rejects `sampleSize < 500`.

Measured against current data (639 scheme × mastermind leg pairs):

| Player count | Groups picked | Combinations | PAR scenarios | Simulated games @500 |
|---|---|---|---|---|
| 1 | 1 of 134 | 134 | 85,626 | 42,813,000 |
| 2 | 2 of 134 | 8,911 | 5,694,129 | 2,847,064,500 |
| 3–4 | 3 of 134 | 392,084 | 250,541,676 | 125,270,838,000 |
| 5 | 4 of 134 | 12,840,751 | 8,205,239,889 | 4,102,619,944,500 |

**With a canonical loadout: 639 scenarios, ~319,500 simulated games.**

This is not an efficiency argument. Publishing PAR for the ranked surface is
**not achievable** at 8.2 billion scenarios by any amount of compute or
patience, and PAR is the sole gate on every competitive score (submission
fail-closes to `par_not_published`). Free villain choice therefore does not
make the leaderboard expensive — it makes it unreachable.

## Why now: the migration cost is currently zero

`legendary.competitive_scores` is **empty** — PAR has never been published, so
no qualifying score has ever been recorded. There are no historical rows to
grandfather, re-key, or invalidate, and no player has an entry to lose.

Every day this waits, that stops being true. This is the cheapest moment this
change will ever have.

## The cards have already done most of the work

**103 of 111 masterminds declare `alwaysLeads`** — the villain group the
printed card requires (Magneto → Brotherhood, Red Skull → HYDRA). That group
is canonical by the game's own rules, so the authoring task is only the
*remaining* 0–3 villain groups plus henchmen, not the whole loadout.

The **8 without** `alwaysLeads` need a hand-authored anchor:
`cosm/magus`, `dims/j-jonah-jameson`, `rvlt/mandarin`, `ssw2/spider-queen`,
`vill/odin`, `wtif/hank-pym-yellowjacket`, and two others (enumerate at
execution — the count is data-derived, do not hard-code it).

Henchmen: 50 groups available; `PLAYER_COUNT_SETUP` requires 1–2 depending on
player count.

## Secondary benefits (real, but not the argument)

1. **Scores become comparable.** Today "best score per leg, any villain
   groups" means two entries on the same board may have fought materially
   different games. A canonical loadout makes a board a comparison rather
   than a collection.
2. **Removes an undesigned optimisation axis.** With per-key PAR, a competitor
   can hunt the villain combination where they most outperform its baseline.
   Defensible as skill, but nobody designed it, and it is invisible to other
   players.
3. **Makes strategy content writable.** The published Gauntlet Guides cannot
   give per-leg villain advice; they currently say *"any villain groups
   qualify"* and treat that as strategy, which is honest but is working
   around a hole.

## Scope (In)

- A canonical `(villainGroupIds[], henchmanGroupIds[])` per mastermind,
  sized per `PLAYER_COUNT_SETUP` for each player count 1–5.
- Extending the gauntlet **qualification predicate** so a replay qualifies as
  a leg only when its villain and henchmen groups match the canonical loadout
  for its player count.
- Publishing the canonical loadout on the board and in the "Challenge this
  leg" deep link, so a player can set up a qualifying match without guessing.

## Out of Scope

- **Casual play.** Free selection is unchanged everywhere outside gauntlet
  qualification. This WP adds no restriction to match setup itself.
- The Open vs Fixed-Pool hero rules (D-24187) — untouched.
- Hero selection, which stays free (heroes are not part of `ScenarioKey`).
- PAR calibration itself, and hero-effect coverage — this WP makes calibration
  *tractable*; it does not perform it.
- Re-keying historical rows: none exist.

## Open questions (2 of 4 settled 2026-07-19)

1. **Where does the canonical loadout live?** A new registry table beside
   `PLAYER_COUNT_SETUP` is the obvious home (server already consumes that
   table for the gauntlet catalog), versus per-set card data. Registry keeps
   it in one reviewable place; card data keeps it near the mastermind.
2. ~~**Who authors the non-`alwaysLeads` groups?**~~ **SETTLED 2026-07-19 —
   core-fallback.** The drafted recommendation ("start thematic, same set as
   the mastermind") is **withdrawn: it is impossible for roughly half the
   catalog.** Measured against `data/cards/`:

   | Fact | Value |
   |---|---|
   | Qualifying sets | 39 |
   | Sets with **zero** henchmen groups | **24** (solo needs 1; 4–5p needs 2) |
   | Sets with only 1–2 villain groups | 24 (5p needs 4) |
   | Sets able to fill a 5p loadout in-set | 15 |
   | Masterminds that CANNOT be filled in-set | **48 of 110** |

   Worked example: `anni/annihilus` at 5p needs 4 villain groups + 2 henchmen;
   his set ships 2 villain groups (`annihilation-wave` — his Always Leads — and
   `timelines-of-kang`) and **no henchmen at all**.

   **Rule:** fill unmet slots from the **Core Set / Core 2E** pool. Chosen over
   nearest-thematic (needs a set-adjacency map that does not exist for 41 sets)
   and difficulty-balanced (circular — it needs the PAR calibration this WP
   exists to unblock). Accepted cost: common Core henchmen (`doombot-legion`,
   `hand-ninjas`, `savage-land-mutates`, `sentinel`) will recur across many
   gauntlets. Bought: no invented data, and any reviewer can check the result.
3. ~~**One canonical set, or a small enumerated menu?**~~ **SETTLED 2026-07-19 —
   enumerated menu of THREE** approved configurations per mastermind.
   110 × 3 = **330 loadouts**, each sized across player counts 1–5, for ~1,917
   PAR scenarios — still trivially calibratable against the 8,205,239,889 that
   free villain choice implies, while preserving real player choice.
4. **What happens to a non-conforming replay?** It should simply not qualify
   as a leg (silently, like every other predicate clause), but the board and
   challenge link must make the requirement discoverable or players will
   assume the feature is broken — the D-24186 / D-24190 class of failure.
5. **Does `ScenarioKey` change shape?** Preferably not: the canonical loadout
   makes the villain-group segment *deterministic per mastermind* without
   altering the key format, so existing PAR machinery, `scoringConfigVersion`
   pinning, and replay verification are untouched. Confirm before executing.

## Dependencies

- No hard code dependency, but it is **pointless to execute after** PAR
  calibration begins, and **wasteful to calibrate before** this lands. Sequence
  this ahead of any PAR publication work.
- Interacts with WP-389 / WP-390 only insofar as those decide which mastermind
  a player actually faces; both should land first so canonical loadouts are
  authored against real behaviour.

## Notes

Found 2026-07-18 while researching gauntlet strategy content: the guides could
not give villain advice because villains are unconstrained, and following that
thread to the scenario-key definition exposed the calibration explosion.
Operator agreed the same day to standardise **for the ranked gauntlets only**.
