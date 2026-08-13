/**
 * Shared type contract for the click-to-play UI surface (WP-100, revised
 * 2026-04-27).
 *
 * `UiMoveName` is a UI-side mirror of the nine engine moves the
 * click-to-play surface is permitted to emit:
 *
 * - Two **lobby-phase** moves (registered on `LegendaryGame.phases.lobby.moves`):
 *   `'setPlayerReady'`, `'startMatchIfReady'`. These let the seated viewer
 *   ready up and trigger the phase transition out of the lobby. The 2026-04-27
 *   revision added these two names; the original WP-100 locked vocabulary at
 *   six names and the smoke test could not progress past the lobby phase as a
 *   result.
 * - Nine **play-phase + cross-phase** moves (registered on `LegendaryGame.moves`):
 *   `'drawCards'`, `'advanceStage'`, `'revealVillainCard'`, `'playCard'`,
 *   `'endTurn'`, `'fightVillain'`, `'recruitHero'`, `'fightMastermind'`,
 *   `'resolveHeroChoice'`. Per D-10011, `'advanceStage'` was added on
 *   2026-04-27 after smoke testing surfaced that the original WP-100
 *   vocabulary's exclusion of stage progression left the player stuck in
 *   `start` after drawing. Per D-10012, `'revealVillainCard'` was added the
 *   same day after smoke testing surfaced that the City stays empty without
 *   an explicit reveal — `fightVillain` has nothing to target. Per WP-222,
 *   `'resolveHeroChoice'` was added to unblock the reveal-attack-choose
 *   pending choice prompt (D-22201).
 *
 * The union is type-only and creates no runtime coupling. Every interactive
 * component under `apps/arena-client/src/components/play/` declares its
 * `submitMove` prop using the `SubmitMove` alias (NOT a bare `string` move
 * name) so typos are caught at compile time. The `args` parameter remains
 * `unknown` by design: the engine validates payload shape on receipt; the
 * UI compile-time check on the *name* is sufficient drift protection.
 */

/**
 * The thirteen engine move names the click-to-play UI surface is permitted to
 * emit. Strict subset of the engine's `LegendaryGame.moves` bag plus the
 * `LegendaryGame.phases.lobby.moves` block. Any extension requires a new
 * Work Packet. Per WP-243, `'resolveKoHeroChoice'` was added to unblock the
 * KO-a-Hero pending choice prompt (D-24010). Per WP-249, `'resolveOptionalKoReward'`
 * was added to unblock the optional-KO-then-reward prompt (D-24020). Per WP-287,
 * `'resolveDrawOrEmpowered'` was added to unblock the draw-or-empowered prompt (D-24071).
 */
export type UiMoveName =
  | 'setPlayerReady'
  | 'startMatchIfReady'
  | 'drawCards'
  | 'advanceStage'
  | 'revealVillainCard'
  | 'playCard'
  | 'endTurn'
  | 'fightVillain'
  | 'recruitHero'
  | 'fightMastermind'
  | 'resolveHeroChoice'
  | 'resolveKoHeroChoice'
  // why: WP-470 / D-24282 — unblocks the Doombot scry-KO prompt (pick which of the
  // top two deck cards to KO).
  | 'resolveScryKoChoice'
  // why: WP-476 / D-24284 — unblocks the Magneto discard-to-limit prompt (pick which
  // cards to discard down to four).
  | 'resolveDiscardChoice'
  // why: WP-479 / D-24286 — unblocks the reveal-remainder reorder prompt (put the
  // non-drawn revealed cards back on top of the deck in any order).
  | 'resolveReorderChoice'
  // why: WP-486 / D-24291 — unblocks the Silent Sniper defeat-with-a-Bystander prompt
  // (pick which Villain or the Mastermind to defeat for free).
  | 'resolveDefeatChoice'
  | 'resolveOptionalKoReward'
  | 'resolveDrawOrEmpowered'
  // why: WP-313 / D-24099 — unblocks the victory-pile villain-pick prompt (The Ebony Blade).
  | 'resolveVictoryPileCardPick'
  // why: unblocks the optional-put-bottom-hq prompt (Wonder Man's Ionic Energy).
  | 'resolveOptionalPutBottomHQ'
  // why: D-24132 — unblocks the put-any-number-bottom-hq multi-select prompt (Wonder Man's 8th
  // Wonder of the World, Sunspot's Empyreal Force, Star-Lord (T'Challa)'s Colliding Dreams).
  | 'resolvePutAnyNumberBottomHQ'
  // why: D-24139 — unblocks the return-zero-cost-discard prompt (Black Knight's Defend the Weak).
  | 'resolveReturnZeroCostDiscard'
  | 'resolveDiscardToPlay'
  // why: WP-498 / D-24301 — unblocks the optional return-on-discard prompt (Cyclops Unending Energy).
  | 'resolveReturnOnDiscard'
  // why: WP-532 / D-24343 — unblocks the Paibok the Power Skrull Fight give-HQ-Hero prompt
  // (pick which HQ Hero every player gains).
  | 'resolveGiveHqHeroChoice'
  // why: WP-535 / D-24345 — unblocks the Rogue Copy Powers copy-a-Hero prompt
  // (pick which in-play Hero to copy).
  | 'resolveCopyPowersChoice'
  // why: WP-380 / D-24181 — surfaces the WP-379 Wound "Healing" ability (engine
  // healWounds). Dispatched with an empty payload; the move takes no arguments.
  | 'healWounds'
  // why: WP-502 / D-24306 — surfaces the "End Game" control (engine endMatchEarly).
  // Dispatched with an empty payload; the move takes no arguments. Latches the
  // MATCH_ENDED_EARLY endgame counter so the match ends for every seat.
  | 'endMatchEarly';

/**
 * Function signature shared by every prop-drilled `submitMove` in the
 * click-to-play surface. The engine validates the payload shape on
 * receipt — the UI's only obligation is the typed move name.
 */
export type SubmitMove = (name: UiMoveName, args: unknown) => void;
