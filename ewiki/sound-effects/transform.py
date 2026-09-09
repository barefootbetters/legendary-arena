#!/usr/bin/env python3
"""
transform.py — synthesize the "transform" gamma power-surge cue.

The audio sibling of the WP-672 transform VfxOverlay beat (the gamma-green
"power surge" bloom + burst + the "TRANSFORMED!" word), played on the
`transformResolved` notable event. It is the SOUND of a Hero base card powering
up into its stronger second form — the World War Hulk signature mechanic — so it
reads as GROWTH and TRIUMPH: an energy charge sweeping UPWARD into a bright,
confident major-chord bloom, with a low sub swell for the mass of the change.

Deliberately the opposite register from the strike-blocked clang (metallic,
defensive, inharmonic): this one is harmonic and rising — a heroic "power-up",
not an impact.

Original synthesis — no sample source — so the clip carries no third-party or
CC0 licence obligation at all. That is the cleanest commercial-safe posture for
a revenue-generating site (see wiki/sound-effects.md § Licensing posture), and
it matches the strike-blocked / wound-gained originals rather than the CC0-first
default the discrete clips use.

Four layers (mono, 44.1 kHz):
  A. Charge sweep    — band-passed noise gliding UP as it swells in (the build)
  B. Rising tone     — a sine glide up under the sweep (energy gathering)
  C. Power bloom     — a bright HARMONIC major triad struck at the peak (the
                       transform lands: root + major third + fifth + octave)
  D. Sub swell       — a low sine that swells with the charge and settles (mass)
  (+ high shimmer partials on the bloom for gamma radiance)

Dependencies: numpy only (no scipy — the band-pass is done in the FFT domain).

Regenerate the source WAV:
    python ewiki/sound-effects/transform.py transform.wav

Encode + upload to R2 (audio bytes are NEVER committed to git — D-24219, R2 is
the sole audio surface). Put transform.wav in a source dir, then:
    node scripts/upload-move-sfx-to-r2.mjs --src <that-dir>
The manifest key that plays it is `transformResolved` in
apps/arena-client/src/audio/sfxManifest.ts →
https://images.legendary-arena.com/audio/sound-effects/transform.mp3
"""

import sys
import numpy as np

SAMPLE_RATE = 44100
DURATION_SECONDS = 0.85
RANDOM_SEED = 6720  # why: deterministic output — regenerating gives the same byte.

# why: the charge builds until this moment, then the bloom is struck. Everything
# before it rises; everything after it rings out. A single shared constant keeps
# the sweep, the sub, and the bloom onset aligned to one beat.
BLOOM_ONSET_SECONDS = 0.34


def make_time_axis(duration_seconds):
    return np.linspace(0.0, duration_seconds, int(SAMPLE_RATE * duration_seconds), endpoint=False)


def exponential_decay(time_axis, tau_seconds):
    """A simple exponential amplitude envelope, 1.0 at t=0."""
    return np.exp(-time_axis / tau_seconds)


def bandpass(signal, low_hz, high_hz):
    """
    FFT-domain band-pass (numpy only, no scipy). A cosine-tapered passband
    between low_hz and high_hz — smooth edges so the shaped noise has no ringing
    artefacts. Same helper as strike-blocked.py.
    """
    spectrum = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(signal.shape[0], d=1.0 / SAMPLE_RATE)
    mask = np.zeros(freqs.shape[0])
    passband = (freqs >= low_hz) & (freqs <= high_hz)
    mask[passband] = 1.0
    # why: taper the band edges over ~300 Hz so the filter does not ring.
    taper_hz = 300.0
    for index, frequency in enumerate(freqs):
        if low_hz - taper_hz <= frequency < low_hz:
            mask[index] = 0.5 * (1.0 - np.cos(np.pi * (frequency - (low_hz - taper_hz)) / taper_hz))
        elif high_hz < frequency <= high_hz + taper_hz:
            mask[index] = 0.5 * (1.0 + np.cos(np.pi * (frequency - high_hz) / taper_hz))
    return np.fft.irfft(spectrum * mask, n=signal.shape[0])


def charge_sweep(time_axis, generator):
    """
    Layer A — the energy CHARGE: band-passed noise that swells IN toward the
    bloom onset (a quadratic ramp so it accelerates), then decays away. Reads as
    a rising whoosh of gathering power, not a hit.
    """
    noise = generator.standard_normal(time_axis.shape[0])
    shaped = bandpass(noise, 700.0, 5200.0)
    # why: quadratic swell to the bloom onset (accelerating build), then a short
    # exponential tail after it so the whoosh resolves into the bloom.
    ramp = np.clip(time_axis / BLOOM_ONSET_SECONDS, 0.0, 1.0) ** 2
    tail = np.where(
        time_axis > BLOOM_ONSET_SECONDS,
        np.exp(-(time_axis - BLOOM_ONSET_SECONDS) / 0.10),
        1.0,
    )
    return shaped * ramp * tail


def rising_tone(time_axis):
    """
    Layer B — a sine gliding UP under the sweep (start_hz -> end_hz across the
    charge), swelling in with the same accelerating ramp. The pitch rising is
    what makes the cue read as GROWTH / power-up rather than a flat tone.
    """
    start_hz, end_hz = 180.0, 560.0
    glide = np.clip(time_axis / BLOOM_ONSET_SECONDS, 0.0, 1.0)
    instantaneous_hz = start_hz + (end_hz - start_hz) * glide
    phase = 2.0 * np.pi * np.cumsum(instantaneous_hz) / SAMPLE_RATE
    tone = np.sin(phase) + 0.3 * np.sin(2.0 * phase)  # a little 2nd harmonic body
    ramp = np.clip(time_axis / BLOOM_ONSET_SECONDS, 0.0, 1.0) ** 2
    tail = np.where(
        time_axis > BLOOM_ONSET_SECONDS,
        np.exp(-(time_axis - BLOOM_ONSET_SECONDS) / 0.06),
        1.0,
    )
    return tone * ramp * tail


def power_bloom(time_axis, generator):
    """
    Layer C — the transform LANDS: a bright HARMONIC major triad struck at the
    bloom onset (root + major third + fifth + octave + a couple of high shimmer
    partials). Harmonic (a real chord), unlike the shield's inharmonic clang, so
    it reads as triumphant power rather than struck metal.
    """
    root_hz = 261.63  # C4 — a confident, open base for the bloom.
    # why: a major triad plus the octave and two high shimmer partials = a bright,
    # heroic "power-up" chord. Ratios are the just-intonation-ish major triad.
    partial_ratios = [1.00, 1.2599, 1.4983, 2.00, 3.00, 4.00, 6.00]
    partial_gains = [1.00, 0.80, 0.85, 0.62, 0.34, 0.22, 0.14]

    bloom = np.zeros(time_axis.shape[0])
    for ratio, gain in zip(partial_ratios, partial_gains):
        frequency_hz = root_hz * ratio
        # why: higher partials ring a little shorter so the chord brightens on the
        # attack then warms as it rings out.
        tau = 0.40 / (1.0 + 0.28 * ratio)
        detune = 1.0 + generator.uniform(-0.003, 0.003)  # subtle per-strike detune
        partial = np.sin(2.0 * np.pi * frequency_hz * detune * time_axis)
        # why: a faint detuned twin on the strongest partials -> a slow shimmer.
        if gain >= 0.8:
            twin = np.sin(2.0 * np.pi * frequency_hz * (detune + 0.005) * time_axis)
            partial = 0.72 * partial + 0.28 * twin
        bloom += gain * partial * exponential_decay(time_axis, tau)

    # why: gate the whole chord to the bloom onset with a fast (4 ms) attack so it
    # is struck cleanly on the peak of the charge, not smeared across the build.
    attack_seconds = 0.004
    attack = np.clip((time_axis - BLOOM_ONSET_SECONDS) / attack_seconds, 0.0, 1.0)
    gate = (time_axis >= BLOOM_ONSET_SECONDS).astype(float)
    # why: the chord's own decay must count from the onset, not t=0 — shift the
    # envelope so a partial does not start already-decayed.
    since_onset = np.clip(time_axis - BLOOM_ONSET_SECONDS, 0.0, None)
    onset_decay = np.exp(-since_onset / 0.42)
    return bloom * gate * attack * onset_decay


def sub_swell(time_axis):
    """
    Layer D — a low sine that swells with the charge and settles just after the
    bloom: the mass of the transformation (the Hulk gaining weight). Never muddy —
    it is gone well before the chord finishes ringing.
    """
    sub = np.sin(2.0 * np.pi * 72.0 * time_axis)
    ramp = np.clip(time_axis / BLOOM_ONSET_SECONDS, 0.0, 1.0) ** 2
    tail = np.where(
        time_axis > BLOOM_ONSET_SECONDS,
        np.exp(-(time_axis - BLOOM_ONSET_SECONDS) / 0.09),
        1.0,
    )
    return sub * ramp * tail


def soft_clip(signal, drive=1.25):
    """Gentle tanh saturation — glues the layers and adds a little brightness."""
    return np.tanh(signal * drive) / np.tanh(drive)


def apply_edge_fades(signal, fade_in_ms=1.5, fade_out_ms=70.0):
    """Kill start/end clicks (the encode step adds its own 80 ms tail fade too)."""
    out = signal.copy()
    fade_in = int(SAMPLE_RATE * fade_in_ms / 1000.0)
    fade_out = int(SAMPLE_RATE * fade_out_ms / 1000.0)
    if fade_in > 0:
        out[:fade_in] *= np.linspace(0.0, 1.0, fade_in)
    if fade_out > 0:
        out[-fade_out:] *= np.linspace(1.0, 0.0, fade_out)
    return out


def write_wav_16bit_mono(path, signal):
    import wave

    peak = float(np.max(np.abs(signal)))
    normalized = signal / peak * 0.92 if peak > 0 else signal  # ~ -0.7 dBFS peak
    samples = np.int16(np.clip(normalized, -1.0, 1.0) * 32767)
    with wave.open(path, "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(samples.tobytes())


def main(output_path):
    generator = np.random.default_rng(RANDOM_SEED)
    time_axis = make_time_axis(DURATION_SECONDS)

    mix = (
        0.42 * charge_sweep(time_axis, generator)
        + 0.34 * rising_tone(time_axis)
        + 0.90 * power_bloom(time_axis, generator)
        + 0.40 * sub_swell(time_axis)
    )
    mix = soft_clip(mix, drive=1.25)
    mix = apply_edge_fades(mix)
    write_wav_16bit_mono(output_path, mix)

    rms = float(np.sqrt(np.mean(mix ** 2)))
    print(f"wrote {output_path}  {DURATION_SECONDS:.2f}s  peak={np.max(np.abs(mix)):.3f}  rms={rms:.3f}")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "transform.wav"
    main(out)
