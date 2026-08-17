import '../../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import AudioControls from './AudioControls.vue';
import {
  createAudioEngine,
  getAudioEngine,
  __setAudioEngineForTests,
  __resetAudioEngineForTests,
  type HowlFactory,
} from '../../audio/audioEngine';
import { AUDIO_MUTED_STORAGE_KEY } from '../../composables/useAudioSettings';
import { __resetMusicEngineForTests } from '../../audio/musicEngine';

// why: a no-op Howl factory so the seeded singleton constructs no real audio;
// the component reaches it via getAudioEngine().
const mockFactory: HowlFactory = () => ({ play: () => 1, volume: () => {} });

describe('AudioControls (WP-412 §F)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetAudioEngineForTests();
    __setAudioEngineForTests(createAudioEngine(mockFactory));
  });

  test('renders the mute toggle and the volume slider', () => {
    const wrapper = mount(AudioControls);
    assert.ok(wrapper.find('[data-testid="audio-mute-toggle"]').exists());
    assert.ok(wrapper.find('[data-testid="audio-volume-slider"]').exists());
  });

  test('shows the unmuted icon by default', () => {
    const wrapper = mount(AudioControls);
    assert.equal(wrapper.find('[data-testid="audio-mute-toggle"]').text(), '🔊');
  });

  test('toggling mute flips the icon and persists to localStorage', async () => {
    const wrapper = mount(AudioControls);
    await wrapper.find('[data-testid="audio-mute-toggle"]').trigger('click');
    assert.equal(wrapper.find('[data-testid="audio-mute-toggle"]').text(), '🔇');
    assert.equal(localStorage.getItem(AUDIO_MUTED_STORAGE_KEY), 'true');
  });

  test('the volume slider updates the persisted volume', async () => {
    const wrapper = mount(AudioControls);
    await wrapper.find('[data-testid="audio-volume-slider"]').setValue('0.25');
    assert.equal(localStorage.getItem('arenaClientAudioVolume'), '0.25');
  });

  test('a first window gesture arms the engine (autoplay unlock)', async () => {
    mount(AudioControls);
    assert.equal(getAudioEngine().isArmed(), false);
    window.dispatchEvent(new window.Event('pointerdown'));
    assert.equal(getAudioEngine().isArmed(), true);
  });

  test('clicking the mute toggle also arms the engine', async () => {
    const wrapper = mount(AudioControls);
    assert.equal(getAudioEngine().isArmed(), false);
    await wrapper.find('[data-testid="audio-mute-toggle"]').trigger('click');
    assert.equal(getAudioEngine().isArmed(), true);
  });
});

describe('AudioControls — music channel (WP-560)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetAudioEngineForTests();
    __setAudioEngineForTests(createAudioEngine(mockFactory));
    __resetMusicEngineForTests();
  });

  test('renders the music toggle and the music volume slider', () => {
    const wrapper = mount(AudioControls);
    assert.ok(wrapper.find('[data-testid="audio-music-toggle"]').exists());
    assert.ok(wrapper.find('[data-testid="audio-music-volume-slider"]').exists());
  });

  test('the music toggle starts pressed — music defaults ON', () => {
    const wrapper = mount(AudioControls);
    assert.equal(
      wrapper.find('[data-testid="audio-music-toggle"]').attributes('aria-pressed'),
      'true',
    );
  });

  test('clicking the music toggle flips it without touching the SFX mute', () => {
    // why: the two gates are independent by design (D-24369 §4). Only the
    // MASTER mute reaches both channels.
    const wrapper = mount(AudioControls);
    const sfxMuteBefore = wrapper
      .find('[data-testid="audio-mute-toggle"]')
      .attributes('aria-pressed');

    return wrapper
      .find('[data-testid="audio-music-toggle"]')
      .trigger('click')
      .then(() => {
        assert.equal(
          wrapper.find('[data-testid="audio-music-toggle"]').attributes('aria-pressed'),
          'false',
        );
        assert.equal(
          wrapper.find('[data-testid="audio-mute-toggle"]').attributes('aria-pressed'),
          sfxMuteBefore,
          'the SFX mute must be untouched by the music toggle',
        );
      });
  });

  test('the music slider is disabled while music is off', () => {
    const wrapper = mount(AudioControls);

    return wrapper
      .find('[data-testid="audio-music-toggle"]')
      .trigger('click')
      .then(() => {
        assert.equal(
          wrapper.find('[data-testid="audio-music-volume-slider"]').attributes('disabled'),
          '',
        );
      });
  });
});
