/**
 * Shared launch primitive for the lobby's two create-and-join paths.
 *
 * WP-448 extracts the byte-identical `createMatch → persistMatchSetup →
 * joinMatch(seat 0) → navigate` chain that lived inline in both
 * `submitFromJson` (loadout path) and `submitCreate` (manual advanced form) of
 * `LobbyView.vue` into a single never-throw primitive. Both callers now build
 * their own `MatchSetupConfig` + player count (each preserving its own
 * pre-launch validation and throw→catch parity) and hand the resolved values
 * here; the extraction is behavior-preserving — identical inputs produce the
 * identical lobby behavior and the identical failure message.
 *
 * Layer posture: a plain `.ts` module with no reactive state and no
 * boardgame.io / registry / server import. `MatchSetupConfig` is imported
 * type-only from the engine and passed straight through — no field renames.
 */

import { createMatch, createMatchWithBot, joinMatch } from './lobbyApi';
import {
  persistMatchSetup,
  persistBotAllySetup,
  type BotAllySetup,
} from '../diagnostics/matchSetupSession';
import type { MatchSetupConfig } from '@legendary-arena/game-engine';

/**
 * Fully-resolved inputs for a create-and-join launch. `playerName` is already
 * trimmed by the caller; `config` and `playerCount` are already built and
 * validated at the call site so this primitive performs no re-derivation.
 */
export interface LaunchMatchInput {
  config: MatchSetupConfig;
  playerCount: number;
  playerName: string;
  authToken: string;
}

/**
 * Result of a launch attempt. Never-throw: a success carries the created
 * match id; a failure carries the human-readable message the caller assigns to
 * `errorMessage` (byte-identical to the former inline catch blocks).
 */
export type LaunchMatchResult =
  | { ok: true; matchID: string }
  | { ok: false; message: string };

/**
 * Creates a match from the given composition, stashes the input setup for
 * diagnostics, joins the human into their own seat 0 with the authed join, and
 * navigates to the play surface. Returns a typed result and never throws.
 *
 * @param input The resolved config, player count, trimmed name, and auth token.
 * @returns `{ ok: true, matchID }` on success, or `{ ok: false, message }` on
 *   any failure — the caller sets `errorMessage` from the message.
 */
export async function launchMatchFromComposition(
  input: LaunchMatchInput,
): Promise<LaunchMatchResult> {
  try {
    const created = await createMatch(
      input.config,
      input.playerCount,
      input.authToken,
    );
    // why: stash the submitted setup so the play-surface Download diagnostics
    // can include the input pile counts (matchSetupSession; client-local, no
    // network egress). Best-effort — never blocks create/join.
    persistMatchSetup(created.matchID, input.config);
    const joined = await joinMatch(
      created.matchID,
      '0',
      input.playerName,
      input.authToken,
    );
    // why: seat `'0'` + percent-encoded matchID/credentials — the human always
    // joins their own seat 0 via the authed join, mirroring the two former
    // inline chains in submitFromJson / submitCreate exactly.
    window.location.search =
      `?match=${encodeURIComponent(created.matchID)}` +
      `&player=0` +
      `&credentials=${encodeURIComponent(joined.playerCredentials)}`;
    return { ok: true, matchID: created.matchID };
  } catch (launchError) {
    // why: swallow and return a typed { ok: false } instead of throwing so the
    // caller sets `errorMessage` exactly as the former inline catch blocks did
    // (never-throw parity — the failure message stays byte-identical).
    const cause =
      launchError instanceof Error ? launchError.message : String(launchError);
    return { ok: false, message: `Failed to create and join the match. ${cause}` };
  }
}

/**
 * Fully-resolved inputs for a bot-ally create-and-join launch — the same as
 * {@link LaunchMatchInput} plus the bot parameters (WP-502 Play Again fix).
 */
export interface LaunchBotAllyInput extends LaunchMatchInput {
  /** How many of the seats the bot ally fills (1..playerCount-1). */
  botCount: number;
  /** Which driver policy drives the bot(s). */
  policy: BotAllySetup['policy'];
}

/**
 * Creates a bot-ally (co-op-with-bot) match from the given composition, stashes
 * the input setup AND the bot-ally parameters (so a later Play Again rebuilds a
 * bot-ally match again), joins the human into seat 0, and navigates to the play
 * surface. The bot seats are joined + driven server-side by the create-with-bot
 * endpoint — the human only ever joins seat 0. Returns a typed result and never
 * throws (mirrors {@link launchMatchFromComposition}).
 *
 * @param input The resolved config, seat count, bot count, policy, name, token.
 * @returns `{ ok: true, matchID }` on success, or `{ ok: false, message }`.
 */
export async function launchBotAllyFromComposition(
  input: LaunchBotAllyInput,
): Promise<LaunchMatchResult> {
  try {
    const created = await createMatchWithBot(
      input.config,
      input.playerCount,
      input.botCount,
      input.policy,
      input.authToken,
    );
    // why: stash BOTH the composition (diagnostics + Play Again) and the bot-ally
    // parameters, so a subsequent Play Again on THIS match also rebuilds a
    // bot-ally match rather than falling back to a plain human match.
    persistMatchSetup(created.matchId, input.config);
    persistBotAllySetup(created.matchId, {
      botCount: input.botCount,
      policy: input.policy,
    });
    // why: the human always joins their OWN seat 0 via the authed join; the bot
    // seats were already joined + auto-readied by create-with-bot.
    const joined = await joinMatch(
      created.matchId,
      '0',
      input.playerName,
      input.authToken,
    );
    window.location.search =
      `?match=${encodeURIComponent(created.matchId)}` +
      `&player=0` +
      `&credentials=${encodeURIComponent(joined.playerCredentials)}`;
    return { ok: true, matchID: created.matchId };
  } catch (launchError) {
    const cause =
      launchError instanceof Error ? launchError.message : String(launchError);
    return {
      ok: false,
      message: `Failed to create and join the bot-ally match. ${cause}`,
    };
  }
}
