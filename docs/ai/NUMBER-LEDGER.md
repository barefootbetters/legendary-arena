# Number Ledger — WP / EC / D allocation lock

The append-only reservation ledger that stops two concurrent sessions from
allocating the **same** WP / EC / D number (the failure that renumbered WP-419 →
WP-421). See **D-24245** (this mechanism; renumbered from D-24242 — see the D
section below) and the allocation protocol in
[`01.0a-wp-drafting-phase.md`](REFERENCE/01.0a-wp-drafting-phase.md).

## How it works

Each space (`WP` / `EC` / `D`) has a **`high-water`** — the highest number that
was already allocated when this ledger was adopted (2026-07-25). Numbers at or
below the high-water are grandfathered (they live in WORK_INDEX / EC_INDEX /
DECISIONS and are stable). **Every new allocation above the high-water gets one
reservation line here**, newest last:

```
- WP-422 — <kebab-slug or short title> (YYYY-MM-DD, <branch-or-PR>)
```

**The protocol (reserve first):**

1. `node scripts/check-number-ledger.mjs --next wp` (or `ec` / `d`) → the next free number.
2. Append its reservation line under the matching `## ` section **in your SPEC
   commit**, and get that tiny append merged **first** — claim the number before
   the bulky work.
3. `node scripts/check-number-ledger.mjs --check` must pass (CI runs it too).

**Why this holds under concurrency:**

- `.gitattributes` marks this file `merge=union`, so two sessions reserving
  *different* numbers auto-merge with **no conflict** on local rebase/merge (the
  big prose indices do not — that is why reservations live in this minimal file).
- If two sessions reserve the **same** number, union-merge keeps both identical
  lines and `--check` **fails loudly** (`DUPLICATE reservation`) — the collision
  surfaces early in CI, not silently at merge time. One session renumbers.
- `--check` also fails on **drift**: a number used in an index above the
  high-water with no reservation here (`UNRESERVED`).

Union-merge is a *local* git driver (it does not run on GitHub's server-side
squash) — that is fine: the duplicate check is the real safety net and catches a
same-number race however the merge happened.

---

## WP

high-water: 422

<!-- reservations (WP-423 and up), newest last -->

- WP-423 — hugo-version-upgrade (2026-07-24, spec/wp-423-hugo-version-upgrade)
- WP-424 — bot-ally stop-drivers-on-sigterm (2026-07-25, fix/bot-ally-stop-drivers-on-sigterm)
- WP-425 — apex-legendary-combo-tier (2026-07-25, spec/wp-425-apex-combo-tier)
- WP-426 — bot-ally survive-db-blip (2026-07-25, fix/bot-ally-survive-db-blip)
- WP-428 — diagnostic-transport-block (2026-07-25, spec/wp-428-transport-diagnostics)
- WP-427 — bot-resolve-putbottomhq (2026-07-25, fix/bot-resolve-putbottomhq)
- WP-429 — transport-reconnect-resync-counters (2026-07-25, spec/wp-429-transport-counters)
- WP-430 — fluid-desktop responsive scaling (2026-07-25, spec/wp-429-fluid-desktop-scaling)
- WP-431 — log-entry-bystander-and-hero-return (2026-07-25, fix/log-entry-bystander-and-hero-return)
- WP-432 — remove-noncanonical-entry-bystander (2026-07-25, fix/remove-noncanonical-entry-bystander)
- WP-433 — bot-ally-fault-observability (2026-07-26, fix/bot-ally-fault-observability)
- WP-434 — log-outcome-engine-contract (WP-B.3a: G.messages/UIState.log string[]→LogEntry[] + LOG_OUTCOMES enum + pushLog outcome arg; implements D-24253; renumbered from WP-432 after a landed collision; 2026-07-26, spec/wp432-log-outcome-engine-contract)
- WP-435 — log-outcome-client-colour (WP-B.3b: GameLogPanel colours each log line by LogEntry.outcome + non-colour glyph/aria signal + export tag policy; arena-client only; implements D-24253; 2026-07-26, spec/wpb3b-log-colour)
- WP-436 — effectprovenance-outcome-retire (WP-B.3c: effectProvenance recentlyPlayedCards[].outcome reads the authoritative LogEntry.outcome instead of string-matching; awaitingPlayerInput + hollowEffects reads kept; arena-client only; implements D-24253 §Fork F; 2026-07-26, spec/wpb3c-effectprovenance-retire)
- WP-437 — bot-ally-ownership-guard (cross-instance driver ownership lease — driver_owner + heartbeat_at side-table columns + tick-level lease arbitration so only ONE instance drives a bot seat; closes the WP-424/D-24244-deferred deploy-overlap two-writer window; server only; 2026-07-26, worktree-wp-bot-ally-ownership-guard)
- WP-438 — logentry-card-field (structured LogEntry.card{?} so effectProvenance stops parsing 'played X' ext-id prose; retires PLAYED_LABEL_EXTID + the B.3c (extId) substring; realizes D-24253 §14; 2026-07-27, spec/wp-logentry-card)
- WP-439 — dashboard-runtime-health (server process CPU%/event-loop-lag/mem/uptime signal on a new admin-gated GET /api/dash/runtime + a dashboard runtime-health tile; answers do-we-need-to-cluster with data; server + dashboard; 2026-07-27, worktree-wp-dashboard-runtime-health)
- WP-440 — gauntlet-pack-contract (identity-only GauntletPack Zod schema + buildGauntletPack/validateGauntletPack in packages/registry, strict per-pack_version validation with a major-version reject gate; first WP of the Mastermind Gauntlets download→import→build→track epic; registry only; 2026-07-27, claude/wp440-gauntlet-pack)
- WP-441 — legends-gauntlet-download (legends-board pin core/magneto to the top of the gauntlet index + a "Download Mastermind Gauntlet" control with a player-count 1..5 / division fixed|open selector defaulting to solo+fixed that Blob/anchor-downloads gauntlet-<set>-<mm>-<div>-p<N>.gauntlet.json; builds the WP-440 pack INLINE via a type-only contract import to preserve the vue-sole-runtime-dep / zero-API invariant; second WP of the Mastermind Gauntlets epic; apps/legends-board only; 2026-07-27, claude/wp441-legends-download)

## EC

high-water: 457

<!-- reservations (EC-458 and up), newest last -->

- EC-458 — hugo-version-upgrade (2026-07-24, spec/wp-423-hugo-version-upgrade)
- EC-459 — bot-ally stop-drivers-on-sigterm (2026-07-25, fix/bot-ally-stop-drivers-on-sigterm)
- EC-460 — apex-legendary-combo-tier (2026-07-25, spec/wp-425-apex-combo-tier)
- EC-461 — bot-ally survive-db-blip (2026-07-25, fix/bot-ally-survive-db-blip)
- EC-463 — diagnostic-transport-block (2026-07-25, spec/wp-428-transport-diagnostics)
- EC-462 — bot-resolve-putbottomhq (2026-07-25, fix/bot-resolve-putbottomhq)
- EC-464 — transport-reconnect-resync-counters (2026-07-25, spec/wp-429-transport-counters)
- EC-465 — fluid-desktop responsive scaling (2026-07-25, spec/wp-429-fluid-desktop-scaling)
- EC-466 — log-entry-bystander-and-hero-return (2026-07-25, fix/log-entry-bystander-and-hero-return)
- EC-467 — remove-noncanonical-entry-bystander (2026-07-25, fix/remove-noncanonical-entry-bystander)
- EC-468 — bot-ally-fault-observability (2026-07-26, fix/bot-ally-fault-observability)
- EC-469 — log-outcome-engine-contract (WP-434/WP-B.3a; renumbered from EC-467 after a landed collision; 2026-07-26, spec/wp432-log-outcome-engine-contract)
- EC-470 — log-outcome-client-colour (WP-435/WP-B.3b; 2026-07-26, spec/wpb3b-log-colour)
- EC-471 — effectprovenance-outcome-retire (WP-436/WP-B.3c; 2026-07-26, spec/wpb3c-effectprovenance-retire)
- EC-472 — bot-ally-ownership-guard (WP-437; 2026-07-26, worktree-wp-bot-ally-ownership-guard)
- EC-473 — logentry-card-field (WP-438; 2026-07-27, spec/wp-logentry-card)
- EC-474 — dashboard-runtime-health (WP-439; 2026-07-27, worktree-wp-dashboard-runtime-health)
- EC-475 — gauntlet-pack-contract (WP-440; 2026-07-27, claude/wp440-gauntlet-pack)
- EC-476 — legends-gauntlet-download (WP-441; 2026-07-27, claude/wp441-legends-download)

## D

high-water: 24241

- D-24242 — seed-par-publication (WP-422; claimed in #993 before this ledger existed — reconciled 2026-07-25, infra/dedup-d24242)
- D-24243 — hugo-version-upgrade (2026-07-24, spec/wp-423-hugo-version-upgrade)
- D-24244 — bot-ally stop-drivers-on-sigterm (2026-07-25, fix/bot-ally-stop-drivers-on-sigterm)
- D-24245 — number-allocation-ledger mechanism (renumbered from D-24242 for the seed-PAR collision; 2026-07-25, infra/dedup-d24242)
- D-24246 — apex-legendary-combo-tier (4th shared comboTierForCount boundary; 2026-07-25, spec/wp-425-apex-combo-tier)
- D-24247 — bot-ally survive-db-blip (tolerate transient empty fetch; 2026-07-25, fix/bot-ally-survive-db-blip)
- D-24249 — diagnostic-transport-block (transport block in the play-surface diagnostic report; 2026-07-25, spec/wp-428-transport-diagnostics)
- D-24248 — bot-resolve-putbottomhq (getLegalMoves short-circuit for the 2 put-bottom-HQ choices; 2026-07-25, fix/bot-resolve-putbottomhq)
- D-24250 — transport-reconnect-resync-counters (reconnect/resync/watchdog counters in the transport diagnostics block; 2026-07-25, spec/wp-429-transport-counters)
- D-24251 — fluid-desktop responsive scaling (max-width play-area cap + fluid clamp card/gutter sizing, additive to D-12909; 2026-07-25, spec/wp-429-fluid-desktop-scaling)
- D-24252 — log-entry-bystander-and-hero-return (narrate the D-1701 city-entry bystander attach + the WP-214 captured-hero return-on-defeat into G.messages; log-only, hash-excluded per D-24081; 2026-07-25, fix/log-entry-bystander-and-hero-return)
- D-24253 — log-outcome-contract-design (WP-B.3 DESIGN: G.messages string[]→LogEntry[] records carrying a coarse LogOutcome for green/red/yellow colour-coding; retires the D-24100 effectProvenance heuristic; design ruling only, no code; 2026-07-25, spec/wpb3-log-outcome-design)
- D-24254 — remove-noncanonical-entry-bystander (supersedes D-1701; a villain/henchman no longer captures a bystander merely on City entry — non-canonical; corrects the D-18504→D-1701 mis-citation; 2026-07-25, fix/remove-noncanonical-entry-bystander)
- D-24255 — bot-ally-fault-observability (every bot-turn fault return logs its reason + turn/stage + the set block-all pending-choice flags; closes the silent-fault observability gap; server log-only; 2026-07-26, fix/bot-ally-fault-observability)
- D-24256 — bot-ally-ownership-guard (cross-instance driver-ownership lease: driver_owner + heartbeat_at on legendary.match_bot_ally, a per-tick atomic claim-or-renew gates which instance drives a bot seat, SIGTERM releases; picked Option B over a pg advisory lock — the shared max=10 pool cannot pin a client per driver; server only; 2026-07-26, worktree-wp-bot-ally-ownership-guard)
- D-24257 — logentry-card-field (LogEntry gains optional structured card ext-id; effectProvenance reads it for identification + association instead of prose; extends D-24253; 2026-07-27, spec/wp-logentry-card)
- D-24258 — dashboard-runtime-health-signal (on-request sampled server runtime health — process CPU% via cpuUsage delta, event-loop lag via perf_hooks.monitorEventLoopDelay p50/p99/max, RSS, uptime, cpuCount, WEB_CONCURRENCY — on admin-gated GET /api/dash/runtime; no DB/engine read; decision-support for the clustering question; 2026-07-27, worktree-wp-dashboard-runtime-health)
- D-24259 — faction-battle-cry-ip-reconciliation (narrative/wiki governance ruling: the IP boundary is split so fabricating/lifting lore into original copy stays forbidden, while surfacing a licensed character's/team's OWN signature catchphrase as a synergy call-out is permitted within confirmed Marvel/Upper Deck license scope; the faction-cry seed set is licensing-gated; render is an identity-string swap, no new engine field; renumbered from the colliding D-24238 draft in PR #979 — D-24238 landed as the deploy stale-bundle fix, #983; 2026-07-27, infra/synergy-callout-wiki)
- D-24260 — gauntlet-pack-identity-only (the downloadable Mastermind Gauntlet pack is an identity-only import token — pack_version + gauntlet{setAbbr,mastermindSlug,division,playerCount}; the server re-resolves legs + approved compositions from the live registry, the pack never carries them; strict per-pack_version validation rejects an unknown MAJOR version and unknown fields; DRAFTED here, landed at WP-440 execution; 2026-07-27, claude/wp440-gauntlet-pack)
- D-24261 — legends-inline-pack-build-and-showcase-pin (legends-board builds the gauntlet pack INLINE via a type-only contract import — NOT a runtime registry dependency — to preserve its vue-sole-runtime-dep / zero-API invariant, WP-343/345; plus the showcase-pin policy (core/magneto pinned first on the gauntlet index, display-only) and the gauntlet-<set>-<mm>-<div>-p<N>.gauntlet.json download-filename convention; DRAFTED here, landed at WP-441 execution; 2026-07-27, claude/wp441-legends-download)
