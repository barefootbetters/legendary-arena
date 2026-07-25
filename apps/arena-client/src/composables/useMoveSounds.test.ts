import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { useMoveSounds } from './useMoveSounds';
import { moveSfxManifest } from '../audio/moveSfxManifest';
import { createAudioEngine, type AudioEngine, type HowlFactory } from '../audio/audioEngine';

/**
 * A recording stand-in for the WP-412 audio engine: it captures each played
 * clip URL (honoring its own mute gate) so the consumer's dispatch behaviour is
 * asserted without a real Howl. Mirrors the useComboCue.test.ts recording mock.
 */
function makeRecordingEngine(): { engine: AudioEngine; played: string[] } {
  const played: string[] = [];
  let muted = false;
  const engine: AudioEngine = {
    arm() {},
    isArmed() {
      return true;
    },
    setMuted(next: boolean) {
      muted = next;
    },
    setVolume() {
      /* volume is exercised in audioEngine.test.ts; irrelevant to the cue logic */
    },
    play(clipUrl: string) {
      if (muted) return;
      played.push(clipUrl);
    },
  };
  return { engine, played };
}

describe('useMoveSounds (WP-421) — plays the mapped clip on dispatch', () => {
  test('each mapped move fires its Surface-2 clip', () => {
    const { engine, played } = makeRecordingEngine();
    const playMoveSound = useMoveSounds(engine);

    playMoveSound('playCard');
    playMoveSound('recruitHero');
    playMoveSound('fightVillain');
    playMoveSound('drawCards');
    playMoveSound('endTurn');

    assert.deepEqual(played, [
      moveSfxManifest.playCard,
      moveSfxManifest.recruitHero,
      moveSfxManifest.fightVillain,
      moveSfxManifest.drawCards,
      moveSfxManifest.endTurn,
    ]);
  });

  test('fires on every dispatch — no catch-up / coalescing (repeat draws each play)', () => {
    const { engine, played } = makeRecordingEngine();
    const playMoveSound = useMoveSounds(engine);

    playMoveSound('drawCards');
    playMoveSound('drawCards');

    assert.deepEqual(played, [moveSfxManifest.drawCards, moveSfxManifest.drawCards]);
  });
});

describe('useMoveSounds (WP-421) — unmapped moves are a silent no-op', () => {
  test('lobby / stage / resolve moves never play and never throw', () => {
    const { engine, played } = makeRecordingEngine();
    const playMoveSound = useMoveSounds(engine);

    playMoveSound('setPlayerReady');
    playMoveSound('startMatchIfReady');
    playMoveSound('advanceStage');
    playMoveSound('revealVillainCard');
    playMoveSound('fightMastermind');
    playMoveSound('resolveHeroChoice');
    playMoveSound('resolveKoHeroChoice');
    playMoveSound('resolveOptionalKoReward');
    playMoveSound('resolveDrawOrEmpowered');
    playMoveSound('resolveVictoryPileCardPick');

    assert.deepEqual(played, []);
  });
});

describe('useMoveSounds (WP-421) — respects mute', () => {
  test('a muted engine plays nothing on a mapped dispatch', () => {
    const { engine, played } = makeRecordingEngine();
    engine.setMuted(true);
    const playMoveSound = useMoveSounds(engine);

    playMoveSound('playCard');

    assert.deepEqual(played, []);
  });
});

describe('useMoveSounds (WP-421) — integration with the real WP-412 engine', () => {
  // why: the recording-engine tests prove the dispatch → clip lookup, but a
  // recording mock's play() always records — it would hide the real engine's
  // arm gate + the EC-448 lazy-load path (move clips are NOT in sfxManifest's
  // preload set). This drives the actual createAudioEngine so a dispatch
  // lazily constructs + plays the move clip through the real play() path.
  test('a mapped dispatch lazily loads + plays the move clip through createAudioEngine', () => {
    const created = new Map<string, { plays: number }>();
    const factory: HowlFactory = ({ src }) => {
      const source = src[0] ?? '';
      const clip = {
        plays: 0,
        play() {
          this.plays += 1;
          return this.plays;
        },
        volume() {},
      };
      created.set(source, clip);
      return clip;
    };
    const engine = createAudioEngine(factory);
    engine.arm();

    const playMoveSound = useMoveSounds(engine);
    playMoveSound('playCard');

    assert.equal(created.get(moveSfxManifest.playCard ?? '')?.plays, 1);
  });

  test('an unarmed real engine plays nothing (unlock gate holds)', () => {
    const created = new Map<string, { plays: number }>();
    const factory: HowlFactory = ({ src }) => {
      const source = src[0] ?? '';
      const clip = {
        plays: 0,
        play() {
          this.plays += 1;
          return this.plays;
        },
        volume() {},
      };
      created.set(source, clip);
      return clip;
    };
    const engine = createAudioEngine(factory);
    // deliberately NOT armed

    const playMoveSound = useMoveSounds(engine);
    playMoveSound('playCard');

    assert.equal(created.get(moveSfxManifest.playCard ?? '')?.plays ?? 0, 0);
  });
});
