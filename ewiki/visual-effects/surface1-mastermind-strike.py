"""
Generate the Surface-1 'mastermindStrikeResolved' signature effect
(screen-shake + red edge-vignette pulse + dark shard particles — the
'uh-oh' jolt) as a single self-contained animated SVG overlaid on a
sample card image.

Output: surface1-mastermind-strike.svg
  - card embedded as base64 (no external fetch, fully portable)
  - motion via internal CSS @keyframes (no JS, no SMIL)
  - honours @media (prefers-reduced-motion: reduce)

Deterministic: shard directions are seeded, no randomness at runtime.
"""

import base64
import math
import os
import urllib.request

# ---- layout -----------------------------------------------------------------
# Sample card art (illustrative only). Fetched on demand so this generator
# reproduces the SVG standalone, with no repo-local asset dependency.
CARD_URL = "https://images.legendary-arena.com/rlmk/rlmk-hr-medusa-splitting-hairs.webp"
SRC = "rlmk-hr-medusa-splitting-hairs.webp"
CARD_W, CARD_H = 360, 505           # card scaled from native 492x690 (ratio kept)
MARGIN = 46                         # room for shake travel + vignette bleed
CANVAS_W, CANVAS_H = CARD_W + MARGIN * 2, CARD_H + MARGIN * 2
CARD_X, CARD_Y = MARGIN, MARGIN

# ---- timing -----------------------------------------------------------------
FRAMES = 46
DUR = 2.1                           # seconds per loop
STRIKE = 10                         # frame the jolt lands on
SHAKE_TAU = 5.0
STRIKE_PCT = STRIKE / (FRAMES - 1) * 100
SHARD_LIFE = 16
SHARD_END_PCT = (STRIKE + SHARD_LIFE) / (FRAMES - 1) * 100

# ---- shards (deterministic seeded spread) -----------------------------------
NUM_SHARDS = 16
shards = []
seed = 1337
for i in range(NUM_SHARDS):
    seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
    jitter = (seed / 0x7FFFFFFF - 0.5) * 0.55
    angle = (i / NUM_SHARDS) * 2 * math.pi + jitter
    seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
    speed = 9.0 + (seed / 0x7FFFFFFF) * 7.0
    seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
    size = 8 + (seed / 0x7FFFFFFF) * 10
    shards.append({"angle": angle, "speed": speed, "size": size})


def shake_offset(f):
    if f < STRIKE:
        return (0.0, 0.0)
    amp = 15.0 * math.exp(-(f - STRIKE) / SHAKE_TAU)
    return (amp * math.sin((f - STRIKE) * 2.7), amp * math.cos((f - STRIKE) * 3.1))


def strike_env(f, tau):
    return 0.0 if f < STRIKE else math.exp(-(f - STRIKE) / tau)


# ---- shake keyframes --------------------------------------------------------
shake_kf = []
for f in range(FRAMES):
    dx, dy = shake_offset(f)
    pct = f / (FRAMES - 1) * 100
    shake_kf.append(f"    {pct:.2f}% {{ transform: translate({dx:.1f}px, {dy:.1f}px); }}")
shake_css = "\n".join(shake_kf)

# ---- vignette keyframes (two-decay = a pulse, not a fade) -------------------
vig_kf = []
for f in range(FRAMES):
    v = min(strike_env(f, 7.0) + 0.55 * strike_env(f - 3, 7.0), 1.0)
    pct = f / (FRAMES - 1) * 100
    vig_kf.append(f"    {pct:.2f}% {{ opacity: {v:.3f}; }}")
vig_css = "\n".join(vig_kf)

# ---- shard markup + per-shard target vars -----------------------------------
ecx, ecy = CARD_W / 2, CARD_H / 2
shard_nodes = []
for s in shards:
    tx = math.cos(s["angle"]) * s["speed"] * SHARD_LIFE
    ty = math.sin(s["angle"]) * s["speed"] * SHARD_LIFE
    rot = math.degrees(s["angle"])
    sz = s["size"]
    pts = f"{sz:.0f},0 {-sz*0.42:.0f},{sz*0.32:.0f} {-sz*0.42:.0f},{-sz*0.32:.0f}"
    shard_nodes.append(
        f'      <g class="shard" style="--tx:{tx:.0f}px; --ty:{ty:.0f}px;">'
        f'<polygon points="{pts}" fill="#12101a" transform="rotate({rot:.0f})"/></g>'
    )
shard_markup = "\n".join(shard_nodes)

# ---- embed card -------------------------------------------------------------
if not os.path.exists(SRC):
    print(f"Fetching sample card art from {CARD_URL}")
    urllib.request.urlretrieve(CARD_URL, SRC)
with open(SRC, "rb") as fh:
    b64 = base64.b64encode(fh.read()).decode("ascii")

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CANVAS_W} {CANVAS_H}"
     width="{CANVAS_W}" height="{CANVAS_H}" role="img"
     aria-label="Surface-1 mastermind-strike effect on a card">
  <title>Surface-1 mastermindStrikeResolved — the signature 'uh-oh' jolt</title>
  <style>
    .shake {{ animation: shake {DUR}s linear infinite; }}
    .vig   {{ opacity: 0; animation: vig {DUR}s linear infinite; }}
    .shard {{ opacity: 0; animation: shard {DUR}s ease-out infinite;
              transform: translate(0, 0); }}

    @keyframes shake {{
{shake_css}
    }}
    @keyframes vig {{
{vig_css}
    }}
    @keyframes shard {{
      0% {{ opacity: 0; transform: translate(0, 0); }}
      {STRIKE_PCT:.2f}% {{ opacity: 0; transform: translate(0, 0); }}
      {STRIKE_PCT + 1:.2f}% {{ opacity: 0.9; }}
      {SHARD_END_PCT:.2f}% {{ opacity: 0; transform: translate(var(--tx), var(--ty)); }}
      100% {{ opacity: 0; transform: translate(var(--tx), var(--ty)); }}
    }}

    /* Accessibility: no motion — hold a single static 'struck' frame. */
    @media (prefers-reduced-motion: reduce) {{
      .shake {{ animation: none; }}
      .vig   {{ animation: none; opacity: 0.55; }}
      .shard {{ animation: none; opacity: 0; }}
    }}
  </style>

  <defs>
    <radialGradient id="vig-grad" cx="50%" cy="50%" r="72%">
      <stop offset="46%" stop-color="#cd1218" stop-opacity="0"/>
      <stop offset="100%" stop-color="#cd1218" stop-opacity="0.95"/>
    </radialGradient>
    <clipPath id="card-clip"><rect width="{CARD_W}" height="{CARD_H}" rx="7"/></clipPath>
  </defs>

  <rect width="{CANVAS_W}" height="{CANVAS_H}" fill="#0e0c12"/>

  <g transform="translate({CARD_X} {CARD_Y})">
    <g class="shake">
      <image href="data:image/webp;base64,{b64}"
             width="{CARD_W}" height="{CARD_H}" clip-path="url(#card-clip)"/>
      <rect class="vig" width="{CARD_W}" height="{CARD_H}" rx="7" fill="url(#vig-grad)"/>
      <g transform="translate({ecx:.0f} {ecy:.0f})">
{shard_markup}
      </g>
    </g>
  </g>
</svg>
"""

with open("surface1-mastermind-strike.svg", "w", encoding="utf-8") as fh:
    fh.write(svg)
print("SVG written:", len(svg), "bytes")
