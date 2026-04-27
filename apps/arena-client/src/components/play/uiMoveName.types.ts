/**
 * Shared type contract for the click-to-play UI surface (WP-100).
 *
 * `UiMoveName` is a UI-side mirror of the six engine moves the click-to-play
 * surface is permitted to emit. It is type-only and creates no runtime
 * coupling — the engine's authoritative move bag lives in
 * `packages/game-engine/src/game.ts` and includes two additional internal
 * moves (`advanceStage`, `revealVillainCard`) that the UI does not surface.
 *
 * Every interactive component under `apps/arena-client/src/components/play/`
 * declares its `submitMove` prop using this `SubmitMove` alias (NOT a bare
 * `string` move name) so typos are caught at compile time. The `args`
 * parameter remains `unknown` by design: the engine validates payload shape
 * on receipt; the UI compile-time check on the *name* is sufficient drift
 * protection.
 */

/**
 * The six engine move names the click-to-play UI surface is permitted to
 * emit. Strict subset of `LegendaryGame.moves`. Any extension requires a
 * new Work Packet.
 */
export type UiMoveName =
  | 'drawCards'
  | 'playCard'
  | 'endTurn'
  | 'fightVillain'
  | 'recruitHero'
  | 'fightMastermind';

/**
 * Function signature shared by every prop-drilled `submitMove` in the
 * click-to-play surface. The engine validates the payload shape on
 * receipt — the UI's only obligation is the typed move name.
 */
export type SubmitMove = (name: UiMoveName, args: unknown) => void;
